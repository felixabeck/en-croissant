# Context-trim rule map

Block-conservation evidence for Phase 1 of `tasks/plans/2026-10-11-context-trim.md`. Base commit: `b48cf60d`. Source: `CLAUDE.md`. One-based block numbers refer to blank-line-separated blocks in `git show b48cf60d:CLAUDE.md`. Every base block absent unchanged after whitespace collapse has one section below. History spans are contiguous original text preserved verbatim apart from wrapping in `docs/context/RULE-HISTORY.md`. Operative homes remain always loaded or path scoped with always-loaded table triggers. Archived originals preserve the pre-trim wording, including corrected stale statements and the push contradiction.

## Block CLAUDE.md 2: ChessFable — project context

Disposition: kept-condensed
New home: kept-condensed in CLAUDE.md under ChessFable — project context: identity, remotes, upstream naming and prohibition on casually rewriting foreign upstream changes.
History spans:
- Upstream history is the error history this project learns from;
Original:
~~~
Chess GUI: Tauri v2 desktop shell (Rust) + React/TypeScript renderer. **ChessFable** is Felix's
fork of En Croissant (`origin` = `felixabeck/en-croissant`, `upstream` = the original project).
Upstream history is the error history this project learns from; foreign upstream changes are
never rewritten casually. En Croissant is the upstream name and the GitHub remote, not this
project's name.
~~~

## Block CLAUDE.md 4: Layout

Disposition: kept-condensed
New home: kept-condensed in CLAUDE.md under Layout: every path and description, with the on-demand history file added.
History spans: none
Original:
~~~
| Path | What lives there |
| --- | --- |
| `src-tauri/src/` | Rust: commands, engine supervision, SQLite/Diesel database, PGN parsing, OAuth |
| `src/` | React renderer: components, state, utils |
| `src/bindings/generated.ts` | **Generated** by Specta from the Rust command/event registry — never hand-edited |
| `src/platform/` | The renderer's only sanctioned door to Tauri (`tauri.ts`, `native.ts`, `errors.ts`) |
| `src/state/` | Jotai atoms + per-tab zustand tree stores with `sessionStorage` persistence |
| `e2e/` | Playwright specs with committed snapshots |
| `scripts/` | Repo-local gate checkers (`check-bindings.mjs`, `check-tauri-command-boundary.mjs`, `check-ui-boundaries.mjs`, coverage and bundle reporters) |
| `docs/` | `coverage.md`, `bundle-budgets.md`, `localization.md`, `signed-download-manifests.md` |
| `tasks/` | `findings.md` (deferred-findings ledger), `decisions.md`; driven by `scripts/findings.py` |
~~~

## Block CLAUDE.md 5: Layout

Disposition: kept-condensed
New home: kept-condensed in CLAUDE.md under Layout: CHESS_LOGIC_MAP.md architecture pointer. Audit-plan provenance moved to docs/context/RULE-HISTORY.md under Layout.
History spans:
- `BACKEND_AUDIT_PLAN.md` and `FRONTEND_AUDIT_PLAN.md` are the wave-structured audit plans that produced most of the current tooling;
Original:
~~~
`BACKEND_AUDIT_PLAN.md` and `FRONTEND_AUDIT_PLAN.md` are the wave-structured audit plans that
produced most of the current tooling; `CHESS_LOGIC_MAP.md` describes the engine/database/streaming
architecture.
~~~

## Block CLAUDE.md 7: Domain rules — `.claude/rules/*.md` (MANDATORY, all agents)

Disposition: kept-condensed
New home: kept-condensed in CLAUDE.md under Domain rules: mandatory write-time invariants. Explanatory rationale moved to docs/context/RULE-HISTORY.md under Domain rules.
History spans:
- These carry the write-time invariants of this codebase: the facts that stop the defect from being written, as opposed to the review lenses below, which catch it afterwards. Each file states one rule and the incidents that produced it.
Original:
~~~
These carry the write-time invariants of this codebase: the facts that stop the defect from being
written, as opposed to the review lenses below, which catch it afterwards. Each file states one rule
and the incidents that produced it.
~~~

## Block CLAUDE.md 9: Domain rules — `.claude/rules/*.md` (MANDATORY, all agents)

Disposition: kept-condensed
New home: kept-condensed in CLAUDE.md under Domain rules: always-loaded async rule, automatic path delivery, delivery versus applicability, explicit Codex/reviewer reads and missing-glob repair. Only the inventory count changes.
History spans: none
Original:
~~~
Claude Code loads `async-resource-invariants.md` in every session and pulls the other five in
automatically the moment it touches a matching path (`paths:` frontmatter in each file).
**This is a delivery mechanism, not a scope limit: the rule binds whether or not it happens to be in
context.** Codex and review subagents auto-load none of them — open the file yourself before working
in that area. A path that should trigger one of these but does not is a bug in the frontmatter — add
the glob to the file rather than working around it.
~~~

## Block CLAUDE.md 12: Gates

Disposition: duplicate
New home: kept-condensed in CLAUDE.md under Gates: unconditional contract gate. Expensive path mapping is duplicate of .claude/skills/push/SKILL.md:60 and its Rust/Tauri, TypeScript/React and Cross-layer contracts headings.
History spans: none
Original:
~~~
`pnpm gates:contract:check` is the unconditional pre-push gate and the single CI step for tooling
checks. The path map in the push skill covers the expensive path-scoped gates (coverage, build,
bindings, bundle, container e2e, mutation, and the Rust compile, clippy and test gates).
~~~

## Block CLAUDE.md 13: Gates

Disposition: moved
New home: moved to .claude/rules/gate-tooling.md under Scheduling and placement: scheduler lanes and dependencies, push/pre-review launcher routing, strict launcher ownership, refusal 125, missing-launcher failure, safe nested placement, standalone receipt placement/locking, cache-only gate:check, flock deadlock prohibition, cgroup sizing/fallback, e2e reserve and all decision ids. kept-condensed in CLAUDE.md under Gates: never add another flock on heavy-gate.lock.
History spans: none
Original:
~~~
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
retry is safe; a missing launcher fails the gate with no in-place fallback. `gate:ensure` and
`gate:run` are wrapped too; a nested `agent-gate` runs in place. Never add another `flock` on
`heavy-gate.lock`: it deadlocks against the launcher's own lock. `scripts/gate-parallelism.mjs` sizes
workers from that scope's complete cgroup chain, including the `agents.slice` budget, and uses the
recorded conservative 8 GiB configuration if an ancestor limit cannot be read or no finite limit
exists. The e2e container runs with a 4 GiB limit reserved from frontend coverage and from frontend
mutation only when mutation shares its concurrent schedule. The schedule and its constants are
`d-20260930-03`, `d-20260930-04`, `d-20261002-01` (placement), and `d-20261002-03` (reserve).
~~~

## Block CLAUDE.md 14: Gates

Disposition: kept-condensed
New home: kept-condensed in CLAUDE.md under Gates: package.json scripts and canonical push mapping/direct-invocation pointer.
History spans: none
Original:
~~~
Gate scripts live in `package.json`; the path mapping and any direct tool invocations live in the
canonical push contract. Two properties worth knowing before planning any change:
~~~

## Block CLAUDE.md 15: Gates

Disposition: duplicate
New home: kept-condensed in CLAUDE.md under Gates: generated binding proof/regeneration prohibition and coverage/bundle ratchet prohibitions. Binding mechanism is duplicate of .claude/skills/push/SKILL.md:191. Numeric ratchets, shrink allowance/reporting, scope and blank-measurement guards are duplicate of docs/coverage.md:3, docs/coverage.md:22 and docs/coverage.md:70. Bundle caps are duplicate of .claude/skills/push/SKILL.md:139.
History spans:
- — before that, removing one provably dead branch reddened the gate and the cheapest way to stay green was to leave dead code in place (`f-20260829-15`, `d-20260829-03`).
Original:
~~~
- **The binding is proven, not trusted.** `pnpm bindings:check` re-runs the debug Specta exporter
  and fails if the checked-in `src/bindings/generated.ts` differs by a byte. Editing the generated
  file to make a gate pass is always the wrong move; regenerate with `pnpm bindings:generate`.
- **Coverage and bundle size are ratcheted, not just floored.** `coverage-areas.json` /
  `backend-coverage-areas.json` set permanent per-area minimums, and
  `coverage-baselines.json` / `backend-coverage-baselines.json` independently reject a lower
  covered count or a lower coverage ratio; deliberately, there is no total-count ratchet. Both
  comparisons run against a baseline shrunk by however many records the measurement lost, so
  deleting covered code is neutral rather than a regression — before that, removing one provably
  dead branch reddened the gate and the cheapest way to stay green was to leave dead code in place
  (`f-20260829-15`, `d-20260829-03`). The allowance is bounded by the shrink and every use is
  printed. That allowance is also why neither ratchet can see the measured set *shrinking*, so two
  non-numeric guards do that instead: the recorded *scope*, which pins what is measured, and the
  blank-measurement check, which fails a measured file that contributes no line, function or branch
  record unless it is declared `statementFree`. `bundle-budgets.json` caps entry,
  largest-lazy, and total gzip bytes. Never lower a floor or rewrite a baseline to accept a
  regression — see `docs/coverage.md`.
~~~

## Block CLAUDE.md 16: Gates

Disposition: duplicate
New home: duplicate of .claude/skills/push/SKILL.md:234 under CI, dependencies, and release mechanics: receipt-backed three-package frontend mutation and memory-sized scheduling. moved to .claude/rules/gate-tooling.md under Mutation gate routing: backend workflow, dispatch/weekly matrix and BACKEND_MUTATION_PACKAGE selector. kept-condensed in CLAUDE.md under Gates: never start pnpm mutation:backend as part of a push.
History spans:
- inside the `agent-gate` scope (28 GiB `memory.max` on tuxedo-atlas, a 27 GiB budget after the reserve) one package at a time with 21 Stryker runners. Measured 2026-10-02 as the last lane of an all-blocks `pnpm gates:push` on `c49a852c`: 346.9 s for the mutation lane and 444 s for the whole gate, the three packages strictly sequential, with no observed OOM event and no swap use, under load average 14.9 / 19.8 / 21.0 at start. The scope's `memory.peak` reached `memory.max` because it includes page cache (post-exit split 0.75 MB anonymous against 8.48 GB file); a second run that day took 382.3 s and 481 s.
- A single sequential backend run is slow enough to crowd GitHub's 6-hour per-job limit,
Original:
~~~
**Frontend mutation testing is a receipt-backed frontend push gate.** It runs its three packages
through `gate:ensure frontend-mutation` in memory-sized slots: inside the `agent-gate` scope (28 GiB
`memory.max` on tuxedo-atlas, a 27 GiB budget after the reserve) one package at a time with 21 Stryker
runners. Measured 2026-10-02 as the last lane of an all-blocks `pnpm gates:push` on `c49a852c`: 346.9 s
for the mutation lane and 444 s for the whole gate, the three packages strictly sequential, with no
observed OOM event and no swap use, under load average 14.9 / 19.8 / 21.0 at start. The scope's
`memory.peak` reached `memory.max` because it includes page cache (post-exit split 0.75 MB anonymous
against 8.48 GB file); a second run that day took 382.3 s and 481 s. The backend suite stays in
`.github/workflows/mutation.yml`, dispatchable and scheduled weekly, with the eight backend
packages as a matrix over the runner's `BACKEND_MUTATION_PACKAGE` selector. A single sequential
backend run is slow enough to crowd GitHub's 6-hour per-job limit, so `test.yml` and local pushes
never run `mutation:backend`.
~~~

## Block CLAUDE.md 17: Gates

Disposition: moved
New home: moved to .claude/rules/gate-tooling.md under Backend mutation snapshot and recovery: external snapshot, capture validation, build prerequisite, cache, report paths and live-tree isolation.
History spans: none
Original:
~~~
`pnpm mutation:backend` runs `cargo-mutants --in-place` inside a verified private
snapshot under the system temporary directory, outside the checkout. It copies tracked
working-tree inputs and the required built `dist/` as independent files, refuses symlinks
or an inconsistent capture, and requires `pnpm build-vite` first. Cargo uses the reusable
`mutants.out/backend/cargo-target` cache, never the live `src-tauri/target`. Reports stay at
`mutants.out/backend/<package>/`. Mutation therefore cannot inject source or build output
into a checkout being read by another gate.
~~~

## Block CLAUDE.md 18: Gates

Disposition: moved
New home: moved to .claude/rules/gate-tooling.md under Backend mutation snapshot and recovery: dirty-tree/Git refusal, exclusive durable fence, atomic owner records, subreaper terminal evidence, marker checks, safe cleanup and retained cache.
History spans: none
Original:
~~~
The runner still refuses a dirty `src-tauri` or failing Git, and holds an exclusive durable
regular-file fence at `mutants.out/backend/.mutation-in-progress`. Whole atomic owner records
name the runner, snapshot, cache and Linux Python 3 subreaper. Cleanup requires its terminal
evidence proving all descendants have been reaped across groups/sessions, then checks the live
tree for legacy cargo-mutants markers before removing the snapshot and fence. Missing evidence
or an unsafe cleanup retains owned state. The cache remains for the next run.
~~~

## Block CLAUDE.md 19: Gates

Disposition: moved
New home: moved to .claude/rules/gate-tooling.md under Backend mutation snapshot and recovery: first guard, retained-fence refusal and every ordered recovery step. kept-condensed in CLAUDE.md under Gates: never git checkout -- src-tauri wholesale and concurrent-editor rationale.
History spans: none
Original:
~~~
The next run or `pnpm mutation:guard:check`, which `$push` runs before any other gate, refuses
an existing fence and prints ordered recovery: stop every relevant mutation descendant,
restore **only** live files marked by a legacy interrupted in-place run, remove the recorded
snapshot only when its path is valid, then remove the fence. Never
`git checkout -- src-tauri` wholesale, which destroys a concurrent editor's work along with
a legacy mutant.
~~~

## Block CLAUDE.md 22: Review lenses

Disposition: kept-condensed
New home: kept-condensed in CLAUDE.md under Review lenses: two tiers, collision prohibition and both lens directories without inventory counts. Every lens, ownership and trigger stays in the unchanged table.
History spans:
- carry this codebase's failure history:
Original:
~~~
Adversarial review runs in two tiers, and names never collide between them. Seven project-independent
lenses live in `~/.claude/agents/review-*.md` (`plan`, `minimalism`, `root-cause`, `correctness`,
`tests`, `code-quality`, `error-handling`); seven ChessFable-specific ones live in `.claude/agents/` and
carry this codebase's failure history:
~~~

## Block CLAUDE.md 27: Findings ledger

Disposition: kept-condensed
New home: kept-condensed in CLAUDE.md under Findings ledger: all queue, filing, locking, CLI, decisions, area, universal contract, vendoring, byte-parity, stamp and project-specific-code prohibitions.
History spans:
- (since 2026-09-02; the former parity-test mesh is gone)
Original:
~~~
- The ledger is `tasks/findings.md`, an **append-only log**; the work queue is derived from it by
  `./scripts/findings.py`, grouped by `Root` only; findings without a root are singletons,
  ranked by relation then age. Position in the file carries no meaning.
- **File every new finding with one command**, whether or not a drain is running. Write the complete
  `###` entry to a file with `**ID:** f-PENDING`, then run
  `./scripts/findings.py file <path-to-entry-file>`. It validates, publishes atomically
  through the inbox spool `tasks/findings-inbox/`, and reports the allocated id — or, if a drain
  holds the lock, that the drain will merge it. **Never pick an id yourself and never edit
  `tasks/findings.md` by hand while a drain is running.**
- `./scripts/findings.py next` picks the next cluster, `related` finds siblings before you
  file, `decisions` lists what is parked on Felix, `drain-status` answers whether a drain is
  running (exit 0 = yes). `check` validates every header and the area vocabulary.
- `tasks/decisions.md` records the technical calls made while working findings, so a later session
  reads them instead of re-deriving the question.
- The area vocabulary is a **closed set**, listed in the ledger header; `check` rejects any other
  value. Adding an area is a deliberate edit to that list.
- The universal contract — field meanings, ranking, the decision discipline, the lock protocol — is
  `~/.claude/references/findings-ledger-contract.md`. `scripts/findings.py` is the vendored copy
  of `~/Projekte/agent-kit/scripts/findings.py`, written by `kit sync` and verified byte-exact by
  `kit sync --check` apart from the `agent-kit-sha256` stamp line that `kit sync` itself inserts
  after the shebang (since 2026-09-02; the former parity-test mesh is gone); nothing
  project-specific may be added to it — project specifics live in the ledger header.
~~~

## Block CLAUDE.md 32: Multi-agent coordination

Disposition: kept-condensed
New home: kept-condensed in CLAUDE.md under Multi-agent coordination: canonical agent bridges/committer identity, gate-scope split, pre-review after each commit/repair batch, full affected gates after the last commit and never commit on red.
History spans:
- because the full set is slow enough that running it per commit is not practical.
Original:
~~~
* Claude Code reads `.claude/skills/push/SKILL.md` directly; Codex reaches it through
  `.agents/skills/push/SKILL.md`, whose Codex delta names its own committer; and
  `.grok/rules/grok-chessfable.md` points at the canonical file.
* Gate scope is split, because the full set is slow enough that running it per commit is not
  practical. Per commit and after every repair batch, run `pnpm checks:pre-review` from
  `.claude/skills/push/SKILL.md`. Once per task, after the last commit, run the full affected set.
  Never commit on red.
~~~

## Block CLAUDE.md 34: Verifying UI changes

Disposition: kept-condensed
New home: kept-condensed in CLAUDE.md under Verifying UI changes: canonical skill and bridge, mandatory read, WebKitGTK/no-CDP limitation and invalid browser-only evidence including the TopBar failure.
History spans:
- The short version, because getting this wrong is the recurring mistake:
Original:
~~~
`.claude/skills/verify-ui/SKILL.md` is the canonical contract (`.agents/skills/verify-ui/SKILL.md`
is its Codex bridge). **Read it before verifying any visible change.** The short version, because
getting this wrong is the recurring mistake: Chrome MCP cannot attach to the Tauri webview — the
window is WebKitGTK and speaks no CDP — and `pnpm start-vite` plus a browser is not evidence,
because `TopBar.tsx` calls `getCurrentWebviewWindow()` at module scope and the page crashes without
a Tauri backend.
~~~

## Block CLAUDE.md 36: Verifying UI changes

Disposition: moved
New home: moved to .claude/rules/desktop-installation.md under Daily desktop app: daily path, installer-only ownership, commit VERSION/master push install, target/release isolation, next-launch activation, compatibility binary and resource_dir layout. The clean-tree absolute is corrected to clean pushed tree or explicitly marked UNREVIEWED install, supported by scripts/install-local.sh:7-9.
History spans:
- (measured 2026-09-05)
Original:
~~~
The daily desktop app is **not** `src-tauri/target/release/chessfable`: the application-menu
entry runs `~/.local/opt/chessfable/current/bin/chessfable`, a versioned copy written only by
`scripts/install-local.sh` from a clean tree whose HEAD is on the pushed upstream (`VERSION`
beside it names the commit; `$push` runs the install as its last step on master). So `pnpm build`,
`verify:app` and a drain may overwrite `target/release` freely without changing what Felix is
using, and an install while the app is running takes effect only at the next launch. The
`bin/chessfable` (plus the `bin/en-croissant` compatibility link) + `lib/ChessFable/` layout is what Tauri's `resource_dir()` requires outside a cargo
output directory; resources beside the binary are not found (measured 2026-09-05).
~~~

## Block CLAUDE.md 37: Verifying UI changes

Disposition: moved
New home: moved to .claude/rules/desktop-installation.md under Desktop entry and launcher identity: exactly one entry, mainBinaryName identity, argv[0]/Wayland/Plasma matching, install-root retirement restricted to regular files, symlink/pin ownership and rename repointing route.
History spans:
- Naming the entry after `productName` between 2026-09-07 and 2026-09-10 published a second entry beside the older one and split the taskbar icon (`f-20260910-01`).
Original:
~~~
The installer owns exactly one desktop entry, `~/.local/share/applications/chessfable.desktop`,
and its basename is `mainBinaryName`, not `productName`. A GTK window takes its Wayland app id
from `argv[0]`, and Plasma matches a window to its pinned launcher by that id, so the entry, the
`StartupWMClass` and the launched binary must all carry the same string. Naming the entry after
`productName` between 2026-09-07 and 2026-09-10 published a second entry beside the older one and
split the taskbar icon (`f-20260910-01`). The installer now deletes any other desktop entry whose
`Exec` points into the install root, so a future rename cannot leave a duplicate behind. That
retirement covers only regular files it could have written itself: a **symlinked** entry belongs to
whoever installed it and is left alone, and the installer never touches Plasma's pinned-launcher
list. A rename therefore still leaves a pin naming the old id, which has to be repointed by hand or
through `panel-launcher-sync` in `~/Projekte/tuxedo-config`.
~~~

## Block CLAUDE.md 39: Repository state (as of 2026-08-30; later updates are dated inline)

Disposition: history
New home: moved to docs/context/RULE-HISTORY.md under Repository state. The dated snapshot heading is replaced by Standing cautions in CLAUDE.md.
History spans:
- ## Repository state (as of 2026-08-30; later updates are dated inline)
Original:
~~~
## Repository state (as of 2026-08-30; later updates are dated inline)
~~~

## Block CLAUDE.md 40: Repository state (as of 2026-08-30; later updates are dated inline)

Disposition: kept-condensed
New home: kept-condensed in CLAUDE.md under Standing cautions: never restate exact commit counts or in-sync claims. Snapshot and rationale moved to docs/context/RULE-HISTORY.md under Repository state.
History spans:
- The audit implementation is committed; `master` tracks `origin/master` and is well ahead of `upstream/master`. Work here is a side project, picked up in bursts.
- — it is wrong the moment anything is committed, and it was.
Original:
~~~
The audit implementation is committed; `master` tracks `origin/master` and is well ahead of
`upstream/master`. Work here is a side project, picked up in bursts. **Do not restate an exact
commit count or "in sync" here** — it is wrong the moment anything is committed, and it was.
~~~

## Block CLAUDE.md 41: Repository state (as of 2026-08-30; later updates are dated inline)

Disposition: history
New home: moved to docs/context/RULE-HISTORY.md under Repository state: dated machine, clone and green-gate snapshot, with no operative sentence.
History spans:
- The working checkout is on **`tuxedo-atlas`** (cloned 2026-08-29 from `felixabeck/en-croissant` over SSH; commits are ssh-signed). Measured green on this machine: `pnpm test`, `cargo test` (338), `pnpm lint:ci`, `pnpm bindings:check`, both boundary checks, `pnpm bundle:check`, `pnpm build` (Tauri release, `--no-bundle`), and — since the toolchain was completed on 2026-08-29 — `pnpm test:coverage:backend`.
Original:
~~~
The working checkout is on **`tuxedo-atlas`** (cloned 2026-08-29 from `felixabeck/en-croissant` over
SSH; commits are ssh-signed). Measured green on this machine: `pnpm test`, `cargo test` (338),
`pnpm lint:ci`, `pnpm bindings:check`, both boundary checks, `pnpm bundle:check`, `pnpm build`
(Tauri release, `--no-bundle`), and — since the toolchain was completed on 2026-08-29 —
`pnpm test:coverage:backend`.
~~~

## Block CLAUDE.md 42: Repository state (as of 2026-08-30; later updates are dated inline)

Disposition: history
New home: moved to docs/context/RULE-HISTORY.md under Repository state: historical open-status framing. The moved layout and App.tsx claims have an explicit 2026-10-11 handled note.
History spans:
- What is **not** settled, all of it filed in `tasks/findings.md` rather than only described here:
Original:
~~~
What is **not** settled, all of it filed in `tasks/findings.md` rather than only described here:
~~~

## Block CLAUDE.md 43: Repository state (as of 2026-08-30; later updates are dated inline)

Disposition: kept-condensed
New home: kept-condensed in CLAUDE.md under Standing cautions: check untested divergent records before machine blame, BRDA instability, never rewrite red baselines, d-20260927-23 writer authorization and delta reporting. Container snapshot refresh policy is duplicate of .claude/skills/verify-ui/SKILL.md:40. Historical guard descriptions, ratchet/mutation measurements and stale finding claims moved to docs/context/RULE-HISTORY.md under Repository state, with the dated handled note.
History spans:
- - **Both coverage ratchets are green again, and only one of them was a stale instrument.** They looked like one problem under the root `machine-dependent-measurement` and were two. The frontend (`f-20260829-06`) really was a baseline describing a machine nobody uses, and was re-recorded from CI under `d-20260829-02`. The backend (`f-20260829-01`) was a **missing test wearing the same symptoms**: the entire atlas-versus-runner gap was three branch records in `remove_tree_at`'s directory walk, which no test drove deliberately — it was reached only as a side effect of other tests' workspace cleanup, 21 times here and once on the runner. Asserting the descent (`f-20260830-01`) made all six areas measure *identically* in both environments, with no baseline touched.
- — lowering the backend floor to the runner's 744 would have permanently retired the only enforcement of a recursive delete that guards against directory traversal.
- `.claude/settings.json` denies direct host `playwright … --update-snapshots` and force-push command forms.
- Re-recording inside the pinned container is open to every agent under the rule in `.claude/skills/verify-ui/SKILL.md` (`d-20260919-13`). `.claude/hooks/block-env-files.sh` adds semantic protection for secret-file access. These are defense-in-depth guards: the rule is what binds, and a determined invocation can phrase a command differently.
- - **Mutation testing now has valid evidence on this tree for the first time** (`f-20260829-05`, handled), after the pinned tooling was installed on atlas on 2026-08-29. The **backend is green**: all eight packages, 324 mutants, 305 caught, 9 timeouts, 10 unviable, **0 survivors**. The **frontend is green** as of 2026-09-30: all three packages at a 100 % score in the final push-gate run of the gate-parallelism change. The first red package now terminates its running siblings and starts no queued package, so a red package still hides the others' results until it is fixed.
- - **The 320px / 200% font-scale layout is broken** — `f-20260829-02`. The committed screenshots record the clipping rather than contradict it. - **`src/App.tsx` is untested** (0 of 67 lines) — `f-20260829-03`.
Original:
~~~
- **Both coverage ratchets are green again, and only one of them was a stale instrument.** They
  looked like one problem under the root `machine-dependent-measurement` and were two. The frontend
  (`f-20260829-06`) really was a baseline describing a machine nobody uses, and was re-recorded from
  CI under `d-20260829-02`. The backend (`f-20260829-01`) was a **missing test wearing the same
  symptoms**: the entire atlas-versus-runner gap was three branch records in `remove_tree_at`'s
  directory walk, which no test drove deliberately — it was reached only as a side effect of other
  tests' workspace cleanup, 21 times here and once on the runner. Asserting the descent
  (`f-20260830-01`) made all six areas measure *identically* in both environments, with no baseline
  touched. **Before attributing the next ratchet disagreement to the machine, check whether the
  divergent records are simply untested**; and note that `BRDA` block/branch identity is not stable
  across builds, so ~170 records routinely flip in each direction and cancel.
  **Never rewrite a baseline to clear a red ratchet** (`docs/coverage.md`) — lowering the backend
  floor to the runner's 744 would have permanently retired the only enforcement of a recursive
  delete that guards against directory traversal. `.claude/settings.json` denies direct host
  `playwright … --update-snapshots` and force-push command forms. Baseline writes are protected by
  the `scripts/coverage-report.mjs` writer guard (`d-20260927-23`):
  `--instrument-change <d-id> --finding <f-id>` must name a decision in `tasks/decisions.md` whose
  `Governs:` line names the finding before any decrease or recorded scope/area-set change is
  accepted. The writer prints every per-area, per-metric delta. Re-recording inside the pinned
  container is open to every agent under the rule in `.claude/skills/verify-ui/SKILL.md`
  (`d-20260919-13`). `.claude/hooks/block-env-files.sh` adds semantic
  protection for secret-file access. These are defense-in-depth guards: the rule is what binds, and
  a determined invocation can phrase a command differently.
- **Mutation testing now has valid evidence on this tree for the first time** (`f-20260829-05`,
  handled), after the pinned tooling was installed on atlas on 2026-08-29. The **backend is green**:
  all eight packages, 324 mutants, 305 caught, 9 timeouts, 10 unviable, **0 survivors**. The
  **frontend is green** as of 2026-09-30: all three packages at a 100 % score in the final push-gate
  run of the gate-parallelism change. The first red package now terminates its running siblings and
  starts no queued package, so a red package still hides the others' results until it is fixed.
- **The 320px / 200% font-scale layout is broken** — `f-20260829-02`. The committed screenshots
  record the clipping rather than contradict it.
- **`src/App.tsx` is untested** (0 of 67 lines) — `f-20260829-03`.
~~~

## Block CLAUDE.md 44: Repository state (as of 2026-08-30; later updates are dated inline)

Disposition: kept-condensed
New home: kept-condensed in CLAUDE.md under Standing cautions: never re-record snapshots on a host. Pinned-container route is duplicate of .claude/skills/verify-ui/SKILL.md:25 and remains in CLAUDE.md under Verifying UI changes.
History spans:
- E2E runs go through `pnpm test:e2e:container`, inside the pinned Playwright image — the reasoning is `d-20260829-01` in `tasks/decisions.md`. The committed snapshots already match what that image renders (8/8 green there on 2026-08-29, none rewritten); it is the *native* run on atlas that fails, on glyph antialiasing alone.
Original:
~~~
E2E runs go through `pnpm test:e2e:container`, inside the pinned Playwright image — the reasoning
is `d-20260829-01` in `tasks/decisions.md`. The committed snapshots already match what that image
renders (8/8 green there on 2026-08-29, none rewritten); it is the *native* run on atlas that fails,
on glyph antialiasing alone. Never re-record snapshots on a host.
~~~

## Block CLAUDE.md 45: Repository state (as of 2026-08-30; later updates are dated inline)

Disposition: kept-condensed
New home: kept-condensed in CLAUDE.md under Standing cautions: a gate is settled only when runner and local machine agree. Historical CI run and workflow inventory moved to docs/context/RULE-HISTORY.md under Repository state.
History spans:
- CI on the fork is green end to end as of run 33298305678 (2026-08-30) — linter, both boundary checks, both coverage ratchets, bindings, bundle budgets, container e2e, and `mutation:frontend`. The current test workflow additionally runs routing, skills, tool-parity, workflow-permission, hook-lint and findings-ledger validation.
Original:
~~~
CI on the fork is green end to end as of run 33298305678 (2026-08-30) — linter, both boundary
checks, both coverage ratchets, bindings, bundle budgets, container e2e, and `mutation:frontend`.
The current test workflow additionally runs routing, skills, tool-parity, workflow-permission,
hook-lint and findings-ledger validation.
That is the reference measurement: a gate is settled when the runner agrees with this machine, not
when it passes here.
~~~

## Block CLAUDE.md 46: Repository state (as of 2026-08-30; later updates are dated inline)

Disposition: kept-condensed
New home: kept-condensed in CLAUDE.md under Standing cautions: audit not reviewed line by line, gates-at-the-time limits, backend/frontend defect-plan pointers and treat the rest of the audit diff as unreviewed.
History spans:
- the 2026-08-09 audit was produced by a Gemini-driven agent run
- The two coverage ratchets it once reddened are green again, for the reasons recorded above.
Original:
~~~
Also note that the 2026-08-09 audit was produced by a Gemini-driven agent run and **has not been
reviewed line by line**. What was proven at the time is that the gates then run were green — not
that every change is right, and not that every gate is green today. The two coverage ratchets it
once reddened are green again, for the reasons recorded above.
Defects found while getting the gates green are listed in `BACKEND_AUDIT_PLAN.md` and
`FRONTEND_AUDIT_PLAN.md`; treat the rest of that diff as unreviewed.
~~~

## Block CLAUDE.md 50: Commits

Disposition: kept-condensed
New home: kept-condensed in CLAUDE.md under Commits: author/committer/no-trailer, atomic cohesion, scoped automatic commits, delegated-leaf prohibition and push never tags/releases/deploys. Push authorization corrected to $push, with build/drain invocation as the request under global rule 13.
History spans: none
Original:
~~~
Author stays Felix Beck, committer is the acting agent, and no co-author trailer is added. Commit
atomically per cohesive area. Verified task-owned work is committed automatically under the active
workflow's authority; delegated leaves never stage or commit. Pushing to the fork requires an
explicit request; `$push` never tags, releases, or deploys.

~~~

## Proof (2026-10-11)

- `python3 /tmp/build-ctxtrim-chessfable/o1check-repo.py /home/felixb/Projekte/chessfable b48cf60d CLAUDE.md AGENTS.md .claude/rules/gate-tooling.md .claude/rules/desktop-installation.md .claude/skills/push/SKILL.md .claude/skills/verify-ui/SKILL.md docs/coverage.md docs/context/RULE-HISTORY.md` — status: 0, summary: `source=CLAUDE.md rows=28 problems=0`
- `python3 /tmp/build-ctxtrim-chessfable/delivery-check.py` — status: 0, summary: `delivery-check problems=0`
- `node scripts/check-skill-bridges.mjs && node scripts/check-skill-bridges-tests.mjs` — status: 0, summary: exit 0
- `./scripts/findings.py check` — status: 0, summary: exit 0
- `pnpm gates:contract:check` — status: 0, summary: exit 0
- `wc -c CLAUDE.md AGENTS.md .claude/rules/gate-tooling.md .claude/rules/desktop-installation.md docs/context/RULE-HISTORY.md` — status: 0, summary: exit 0
