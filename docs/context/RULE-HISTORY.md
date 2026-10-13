# Rule history

History, rationale and dated state moved from `CLAUDE.md` on 2026-10-11. Operative rules and their delivery remain in the homes recorded in `tasks/handoffs/2026-10-11-context-trim-rule-map.md`. Quotations preserve the original wording apart from wrapping. Historical claims do not override the current rules.

## CLAUDE.md — Identity

From `CLAUDE.md` → project identity, this rationale describes learning from En Croissant's upstream history.

> Upstream history is the error history this project learns from;

## CLAUDE.md — Layout

From `CLAUDE.md` → Layout, this provenance describes the backend and frontend audit plans and the tooling they produced.

> `BACKEND_AUDIT_PLAN.md` and `FRONTEND_AUDIT_PLAN.md` are the wave-structured audit plans that produced most of the current tooling;

## CLAUDE.md — Domain rules

From `CLAUDE.md` → Domain rules, “These” names `.claude/rules/*.md` and “below” refers to the Review lenses table retained in the root context.

> These carry the write-time invariants of this codebase: the facts that stop the defect from being written, as opposed to the review lenses below, which catch it afterwards. Each file states one rule and the incidents that produced it.

## CLAUDE.md — Gates

From `CLAUDE.md` → Gates → coverage ratchets, “before that” means before the shrink allowance described in `docs/coverage.md`, and “it” is the dead code the old ratchet discouraged deleting.

> — before that, removing one provably dead branch reddened the gate and the cheapest way to stay green was to leave dead code in place (`f-20260829-15`, `d-20260829-03`).

From `CLAUDE.md` → Gates → frontend mutation, these dated measurements describe the frontend-mutation lane's memory sizing, sequential packages and timings on tuxedo-atlas, including the all-blocks push runs.

> inside the `agent-gate` scope (28 GiB `memory.max` on tuxedo-atlas, a 27 GiB budget after the reserve) one package at a time with 21 Stryker runners. Measured 2026-10-02 as the last lane of an all-blocks `pnpm gates:push` on `c49a852c`: 346.9 s for the mutation lane and 444 s for the whole gate, the three packages strictly sequential, with no observed OOM event and no swap use, under load average 14.9 / 19.8 / 21.0 at start. The scope's `memory.peak` reached `memory.max` because it includes page cache (post-exit split 0.75 MB anonymous against 8.48 GB file); a second run that day took 382.3 s and 481 s.

From `CLAUDE.md` → Gates → backend mutation, this runtime rationale explains keeping the eight backend packages outside test.yml and local push gates.

> A single sequential backend run is slow enough to crowd GitHub's 6-hour per-job limit,

## CLAUDE.md — Review lenses

From `CLAUDE.md` → Review lenses, the ChessFable-specific lenses in `.claude/agents/` carry the codebase's failure history.

> carry this codebase's failure history:

## CLAUDE.md — Findings ledger

From `CLAUDE.md` → Findings ledger → vendored findings.py, this date describes the stamp exception to kit byte-parity and replacement of the former parity-test mesh.

> (since 2026-09-02; the former parity-test mesh is gone)

## CLAUDE.md — Multi-agent coordination

From `CLAUDE.md` → Multi-agent coordination → gate scope, this explains splitting per-commit pre-review checks from the once-per-task full affected gate set.

> because the full set is slow enough that running it per commit is not practical.

## CLAUDE.md — Verifying UI changes

From `CLAUDE.md` → Verifying UI changes, “this” refers to treating Chrome MCP or a Vite-only browser as proof for the Tauri app, a recurring verification mistake.

> The short version, because getting this wrong is the recurring mistake:

From `CLAUDE.md` → Verifying UI changes → daily desktop app, this dates the measurement that resources beside the installed binary are not found and Tauri requires the bin/ plus lib/ChessFable/ layout.

> (measured 2026-09-05)

From `CLAUDE.md` → Verifying UI changes → desktop-entry identity, this incident describes naming the entry after productName instead of mainBinaryName, which left a duplicate entry and split the taskbar icon.

> Naming the entry after `productName` between 2026-09-07 and 2026-09-10 published a second entry beside the older one and split the taskbar icon (`f-20260910-01`).

## CLAUDE.md — Repository state

From `CLAUDE.md` → Repository state, this is the original snapshot heading. The dated material below is historical, with operative cautions retained in the root context.

> ## Repository state (as of 2026-08-30; later updates are dated inline)

From `CLAUDE.md` → Repository state, this describes the committed audit implementation and branch relationships at the recorded snapshot date.

> The audit implementation is committed; `master` tracks `origin/master` and is well ahead of `upstream/master`. Work here is a side project, picked up in bursts.

From `CLAUDE.md` → Repository state → commit-count caution, “it” names an exact commit count or an in-sync claim that becomes stale after a commit.

> — it is wrong the moment anything is committed, and it was.

From `CLAUDE.md` → Repository state, “this machine” means tuxedo-atlas, and the listed green gates are measurements from the recorded 2026-08-29 snapshot.

> The working checkout is on **`tuxedo-atlas`** (cloned 2026-08-29 from `felixabeck/en-croissant` over SSH; commits are ssh-signed). Measured green on this machine: `pnpm test`, `cargo test` (338), `pnpm lint:ci`, `pnpm bindings:check`, both boundary checks, `pnpm bundle:check`, `pnpm build` (Tauri release, `--no-bundle`), and — since the toolchain was completed on 2026-08-29 — `pnpm test:coverage:backend`.

From `CLAUDE.md` → Repository state, this introduces the historical snapshot list. As of 2026-10-11, the listed layout and App.tsx findings f-20260829-02 and f-20260829-03 are handled.

> What is **not** settled, all of it filed in `tasks/findings.md` rather than only described here:

From `CLAUDE.md` → Repository state → ratchet disagreement, “They” names the two coverage ratchets, “here” means tuxedo-atlas, and “runner” means CI. This records the former machine-measurement diagnosis and missing recursive-delete test.

> - **Both coverage ratchets are green again, and only one of them was a stale instrument.** They looked like one problem under the root `machine-dependent-measurement` and were two. The frontend (`f-20260829-06`) really was a baseline describing a machine nobody uses, and was re-recorded from CI under `d-20260829-02`. The backend (`f-20260829-01`) was a **missing test wearing the same symptoms**: the entire atlas-versus-runner gap was three branch records in `remove_tree_at`'s directory walk, which no test drove deliberately — it was reached only as a side effect of other tests' workspace cleanup, 21 times here and once on the runner. Asserting the descent (`f-20260830-01`) made all six areas measure *identically* in both environments, with no baseline touched.

From `CLAUDE.md` → Repository state → never rewrite a red ratchet baseline, this explains why the runner's former floor of 744 would have removed recursive-delete enforcement.

> — lowering the backend floor to the runner's 744 would have permanently retired the only enforcement of a recursive delete that guards against directory traversal.

From `CLAUDE.md` → Repository state → ratchet guard mechanisms, these settings describe host-snapshot and force-push protection alongside the operative baseline writer guard retained under Standing cautions.

> `.claude/settings.json` denies direct host `playwright … --update-snapshots` and force-push command forms.

From `CLAUDE.md` → Repository state → snapshot and secret-file guards, container snapshot re-recording remains governed by the canonical verify-ui skill. “These” names the settings deny forms, coverage baseline writer and secret-file hook, whose defenses do not replace the rules.

> Re-recording inside the pinned container is open to every agent under the rule in `.claude/skills/verify-ui/SKILL.md` (`d-20260919-13`). The user-wide guards `~/.claude/hooks/block-secret-file-access.py` (Bash, Claude and Codex) and `~/.claude/hooks/restrict-file-access.py` (file tools) protect secret-file access in every repository (`agent-kit` decision `d-20261013-14`). These are defense-in-depth guards: the rule is what binds, and a determined invocation can phrase a command differently.

From `CLAUDE.md` → Repository state → mutation evidence, “this tree” is the checkout measured on the listed dates. The green scores and first-red-package behavior describe that dated tooling snapshot.

> - **Mutation testing now has valid evidence on this tree for the first time** (`f-20260829-05`, handled), after the pinned tooling was installed on atlas on 2026-08-29. The **backend is green**: all eight packages, 324 mutants, 305 caught, 9 timeouts, 10 unviable, **0 survivors**. The **frontend is green** as of 2026-09-30: all three packages at a 100 % score in the final push-gate run of the gate-parallelism change. The first red package now terminates its running siblings and starts no queued package, so a red package still hides the others' results until it is fixed.

From `CLAUDE.md` → Repository state → layout clipping and App.tsx coverage, these are stale historical claims. As of 2026-10-11, f-20260829-02 and f-20260829-03 are handled in tasks/findings.md.

> - **The 320px / 200% font-scale layout is broken** — `f-20260829-02`. The committed screenshots record the clipping rather than contradict it. - **`src/App.tsx` is untested** (0 of 67 lines) — `f-20260829-03`.

From `CLAUDE.md` → Repository state → e2e measurement, “that image” is the pinned Playwright container. This records the former atlas-only glyph-antialiasing failure and decision d-20260829-01.

> E2E runs go through `pnpm test:e2e:container`, inside the pinned Playwright image — the reasoning is `d-20260829-01` in `tasks/decisions.md`. The committed snapshots already match what that image renders (8/8 green there on 2026-08-29, none rewritten); it is the *native* run on atlas that fails, on glyph antialiasing alone.

From `CLAUDE.md` → Repository state → CI measurement, this names run 33298305678 and the workflow inventory recorded in that snapshot.

> CI on the fork is green end to end as of run 33298305678 (2026-08-30) — linter, both boundary checks, both coverage ratchets, bindings, bundle budgets, container e2e, and `mutation:frontend`. The current test workflow additionally runs routing, skills, tool-parity, workflow-permission, hook-lint and findings-ledger validation.

From `CLAUDE.md` → Repository state → audit provenance, this names the producer of the 2026-08-09 audit, whose unreviewed status stays operative under Standing cautions.

> the 2026-08-09 audit was produced by a Gemini-driven agent run

From `CLAUDE.md` → Repository state → audit coverage ratchets, “above” refers to the ratchet diagnosis and repair history quoted earlier in this history section.

> The two coverage ratchets it once reddened are green again, for the reasons recorded above.

## Async and resource invariants

## Why

These three sentences are the distilled result of the backend and frontend audits of 2026-08-09
(107 and 98 execution items). They are stated once here because the two plans that produced them,
`BACKEND_AUDIT_PLAN.md` and `FRONTEND_AUDIT_PLAN.md`, are wave-structured process documents:
their section 1 is the only normative part and the remaining 600+ lines are completed history.
Both files are committed, but working from them means reading a plan to find a rule.

Each clause has a repository incident behind it, catalogued in the review lenses:

* **Identity and stale-result guard** — `4e8d10b0`: an engine result guard compared
  `payload.moves.join(",")`, which silently matches across different move lists. `03826167`:
  results from unloaded engines were still consumed.
* **Cancellation before use** — `06c23b6a`: search cancellation was checked *after* the progress
  emit, dropping in-flight results. A cancel flag checked after the emit is not cancellation.
* **Cleanup on every exit path** — `e5422566`: no `Drop` on `BaseEngine` and no handling of
  `RunEvent::ExitRequested`, so engine children outlived the application (issue #723).
  `aebc490e`: `app.listen_global("stop_engine", …)` never unlistened.
* **Panic-free on untrusted input** — `4e46ed52`: `btoi(...).expect("WhiteElo")` and
  `Fen::from_ascii(...).unwrap()` crashed an entire import on one malformed tag; `d12f43cc` is the
  same class for `Unrated` ratings.


## scripts/check-gate-routing.mjs — historical evidence

Archived verbatim on 2026-10-13. These observations describe the source at their recorded dates.

```javascript
// Staged policy-presence proof, 2026-10-08, f-20260926-01.
// This checker proves maintained source routes and placement, not agent obedience,
// scheduler path selection, or execution of any gate. Runtime and compiler gates
// cannot establish a Markdown subsection's identity.
//
// Complete final-source failure inventory, including inherited paths:
// - unquoteYamlScalar invalid/incomplete escapes and out-of-range code points: yaml-*.
// - reviewPathGlobPatterns missing/ambiguous section and absent text fences: review-*.
// - routeCommands unknown receipt names for every verb: receipt-*.
// - routeCommands missing scripts from skill, subsection comments, workflow and
//   contract expansion: missing-{push,subsection,workflow,contract}-script.
// - validateGateCommands escaping runners and unresolved forms: escape, unresolved.
// - validateGateRunnerScripts every strict wrapper: launcher-*.
// - checkGateRouting absent contract, exact kit script, kit workbench paths in
//   package and skill: contract-absent, kit-command, kit-workbench, skill-workbench.
// - contract fence count and preamble location: contract-fence-*.
// - push invocation count: push-invocation-*. Schedule comparison in both directions:
//   push-command-{missing,extra}, push-contract-member-missing.
// - pre-review section, invocation count and both schedule directions: pre-*.
// - workflow job if/continue-on-error: job-*. Workflow contract count and spelling:
//   workflow-contract-*. Invalid run escapes propagate the yaml-* diagnostics.
// - §2 home identity for every required heading, including absent, ambiguous,
//   prose/prefix/fence examples and another parent: home-*, section-*.
// - every script placement, including both backend-coverage receipt targets:
//   placement-*, move-backend-coverage. Separate CI membership for all nine: ci-*.
// - every local exact placement: move-*, missing-*, only-*, kit-env-prefix.
// - workflow route outside the registry or misplaced: workflow-unregistered-route,
//   placement-*. Step if, ignored exit and chained exit codes: step-*.
// - workflow command must match its route: workflow-command. Duplicate contract
//   members in skill/workflow: contract-member-*. Unrouted check/test: unrouted-*.
// - every test filename shape and checker/executable route: file-*.
// - dead review globs: glob.
// - parseArguments unknown flags/missing values: argument-*.
// - main's finding exit 1: every policy row below. Top-level error exit 1 covers
//   JSON syntax, malformed script/command types, all four input reads, non-ENOENT
//   script stat errors and Git enumeration: json-invalid, scripts-invalid-type,
//   command-invalid-type, read-*, stat-error, git-error.
//
// Method: unchanged production CLI, node scripts/check-gate-routing.mjs --repo-root
// /tmp/build-aa086ec3/phase-proof/inputs, against disposable copies of real tracked
// inputs. No staging edit touched verifier logic or live inputs. Each row changes
// one input condition, records its own diagnostic with exit 1, restores the input,
// then observes "Gate routing check: OK" with exit 0. The .test.mjs control first
// adds a permitted file, then changes only its Vitest include to stage rejection.
// Raw runs and controls: /tmp/build-aa086ec3/phase-proof/<row-id>.log.
// Driver and machine-readable record: stage.py and matrix.json in that directory.
// No prior matrix was relied on. All 135 staged rows and their 135 controls passed.
//
// Argued, excluded from measured coverage: forcing main's non-Error catch rendering
// requires changing verifier logic. All input-driven throws here are Error objects.
// Module-load failures also require altering the checker or its imported verifier
// logic, which is forbidden as a staged input. Neither is a policy assertion proved
// by a green result. No policy assertion is left unstaged.
//
// Independent regression anchor: BASE 237626177b506f04d74bd34ce031ee0e8cd776fe checker
// obtained with git show in disposable inputs, retaining the new tests. The test
// pattern "pins each local command" exited 1 with all six moved-command assertions
// failing. Restoring the fixed checker exited 0, seven tests passed. Logs:
// /tmp/build-aa086ec3/phase-proof/{base-anchor,fixed-anchor}.log.
//
// Staged matrix. Diagnostics below are verbatim output, quoted as evidence.
// [move-setup] exit=1 restored=0
//   "command bash scripts/setup-rust.sh must be fenced in ### Rust/Tauri backend within .claude/skills/push/SKILL.md §2. Move or add its route in that subsection"
// [missing-setup] exit=1 restored=0
//   "command bash scripts/setup-rust.sh must be fenced in ### Rust/Tauri backend within .claude/skills/push/SKILL.md §2. Move or add its route in that subsection"
// [move-fmt] exit=1 restored=0
//   "command cargo fmt --manifest-path src-tauri/Cargo.toml -- --check must be fenced in ### Rust/Tauri backend within .claude/skills/push/SKILL.md §2. Move or add its route in that subsection"
// [missing-fmt] exit=1 restored=0
//   "command cargo fmt --manifest-path src-tauri/Cargo.toml -- --check must be fenced in ### Rust/Tauri backend within .claude/skills/push/SKILL.md §2. Move or add its route in that subsection"
// [move-clippy] exit=1 restored=0
//   "command cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets --locked -- -D warnings must be fenced in ### Rust/Tauri backend within .claude/skills/push/SKILL.md §2. Move or add its route in that subsection"
// [missing-clippy] exit=1 restored=0
//   "command cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets --locked -- -D warnings must be fenced in ### Rust/Tauri backend within .claude/skills/push/SKILL.md §2. Move or add its route in that subsection"
// [move-windows] exit=1 restored=0
//   "command pnpm rust:windows:check must be fenced in ### Rust/Tauri backend within .claude/skills/push/SKILL.md §2. Move or add its route in that subsection"
// [missing-windows] exit=1 restored=0
//   "command pnpm rust:windows:check must be fenced in ### Rust/Tauri backend within .claude/skills/push/SKILL.md §2. Move or add its route in that subsection"
// [move-backend-test] exit=1 restored=0
//   "command pnpm gate:ensure backend-test must be fenced in ### Rust/Tauri backend within .claude/skills/push/SKILL.md §2. Move or add its route in that subsection"
// [missing-backend-test] exit=1 restored=0
//   "command pnpm gate:ensure backend-test must be fenced in ### Rust/Tauri backend within .claude/skills/push/SKILL.md §2. Move or add its route in that subsection"
// [move-kit] exit=1 restored=0
//   "command env -u KIT_ROOT pnpm findings:kit:check must be fenced in ### Findings ledger within .claude/skills/push/SKILL.md §2. Move or add its route in that subsection"
// [missing-kit] exit=1 restored=0
//   "command env -u KIT_ROOT pnpm findings:kit:check must be fenced in ### Findings ledger within .claude/skills/push/SKILL.md §2. Move or add its route in that subsection"
// [move-backend-coverage] exit=1 restored=0
//   "package script test:coverage:backend must be fenced in ### Rust/Tauri backend within .claude/skills/push/SKILL.md §2. Move or add its route in that subsection"
//   "package script coverage:backend:check must be fenced in ### Rust/Tauri backend within .claude/skills/push/SKILL.md §2. Move or add its route in that subsection"
// [placement-test-coverage] exit=1 restored=0
//   "workflow-routed package script test:coverage is neither reachable from gates:contract:check nor declared in GATE_PLACEMENTS and fenced in its named .claude/skills/push/SKILL.md subsection; add it to the contract gate or add both the placement entry and subsection fence"
//   "package script test:coverage must be fenced in ### TypeScript/React frontend within .claude/skills/push/SKILL.md §2. Move or add its route in that subsection"
// [ci-test-coverage] exit=1 restored=0
//   "CI_REQUIRED_SCRIPTS key test:coverage is absent from .github/workflows/test.yml; remove the stale CI requirement or restore the workflow step"
// [placement-coverage-frontend-check] exit=1 restored=0
//   "workflow-routed package script coverage:frontend:check is neither reachable from gates:contract:check nor declared in GATE_PLACEMENTS and fenced in its named .claude/skills/push/SKILL.md subsection; add it to the contract gate or add both the placement entry and subsection fence"
//   "package script coverage:frontend:check must be fenced in ### TypeScript/React frontend within .claude/skills/push/SKILL.md §2. Move or add its route in that subsection"
// [ci-coverage-frontend-check] exit=1 restored=0
//   "CI_REQUIRED_SCRIPTS key coverage:frontend:check is absent from .github/workflows/test.yml; remove the stale CI requirement or restore the workflow step"
// [placement-build-vite] exit=1 restored=0
//   "workflow-routed package script build-vite is neither reachable from gates:contract:check nor declared in GATE_PLACEMENTS and fenced in its named .claude/skills/push/SKILL.md subsection; add it to the contract gate or add both the placement entry and subsection fence"
//   "package script build-vite must be fenced in ### TypeScript/React frontend within .claude/skills/push/SKILL.md §2. Move or add its route in that subsection"
// [ci-build-vite] exit=1 restored=0
//   "CI_REQUIRED_SCRIPTS key build-vite is absent from .github/workflows/test.yml; remove the stale CI requirement or restore the workflow step"
// [placement-bindings-check] exit=1 restored=0
//   "workflow-routed package script bindings:check is neither reachable from gates:contract:check nor declared in GATE_PLACEMENTS and fenced in its named .claude/skills/push/SKILL.md subsection; add it to the contract gate or add both the placement entry and subsection fence"
//   "package script bindings:check must be fenced in ### Cross-layer contracts within .claude/skills/push/SKILL.md §2. Move or add its route in that subsection"
// [ci-bindings-check] exit=1 restored=0
//   "CI_REQUIRED_SCRIPTS key bindings:check is absent from .github/workflows/test.yml; remove the stale CI requirement or restore the workflow step"
// [placement-bundle-check] exit=1 restored=0
//   "workflow-routed package script bundle:check is neither reachable from gates:contract:check nor declared in GATE_PLACEMENTS and fenced in its named .claude/skills/push/SKILL.md subsection; add it to the contract gate or add both the placement entry and subsection fence"
//   "package script bundle:check must be fenced in ### TypeScript/React frontend within .claude/skills/push/SKILL.md §2. Move or add its route in that subsection"
// [ci-bundle-check] exit=1 restored=0
//   "CI_REQUIRED_SCRIPTS key bundle:check is absent from .github/workflows/test.yml; remove the stale CI requirement or restore the workflow step"
// [placement-test-e2e-container] exit=1 restored=0
//   "workflow-routed package script test:e2e:container is neither reachable from gates:contract:check nor declared in GATE_PLACEMENTS and fenced in its named .claude/skills/push/SKILL.md subsection; add it to the contract gate or add both the placement entry and subsection fence"
//   "package script test:e2e:container must be fenced in ### TypeScript/React frontend within .claude/skills/push/SKILL.md §2. Move or add its route in that subsection"
// [ci-test-e2e-container] exit=1 restored=0
//   "CI_REQUIRED_SCRIPTS key test:e2e:container is absent from .github/workflows/test.yml; remove the stale CI requirement or restore the workflow step"
// [placement-mutation-frontend] exit=1 restored=0
//   "workflow-routed package script mutation:frontend is neither reachable from gates:contract:check nor declared in GATE_PLACEMENTS and fenced in its named .claude/skills/push/SKILL.md subsection; add it to the contract gate or add both the placement entry and subsection fence"
//   "package script mutation:frontend must be fenced in ### TypeScript/React frontend within .claude/skills/push/SKILL.md §2. Move or add its route in that subsection"
// [ci-mutation-frontend] exit=1 restored=0
//   "CI_REQUIRED_SCRIPTS key mutation:frontend is absent from .github/workflows/test.yml; remove the stale CI requirement or restore the workflow step"
// [placement-test-coverage-backend] exit=1 restored=0
//   "workflow-routed package script test:coverage:backend is neither reachable from gates:contract:check nor declared in GATE_PLACEMENTS and fenced in its named .claude/skills/push/SKILL.md subsection; add it to the contract gate or add both the placement entry and subsection fence"
//   "package script test:coverage:backend must be fenced in ### Rust/Tauri backend within .claude/skills/push/SKILL.md §2. Move or add its route in that subsection"
// [ci-test-coverage-backend] exit=1 restored=0
//   "CI_REQUIRED_SCRIPTS key test:coverage:backend is absent from .github/workflows/test.yml; remove the stale CI requirement or restore the workflow step"
// [placement-coverage-backend-check] exit=1 restored=0
//   "workflow-routed package script coverage:backend:check is neither reachable from gates:contract:check nor declared in GATE_PLACEMENTS and fenced in its named .claude/skills/push/SKILL.md subsection; add it to the contract gate or add both the placement entry and subsection fence"
//   "package script coverage:backend:check must be fenced in ### Rust/Tauri backend within .claude/skills/push/SKILL.md §2. Move or add its route in that subsection"
// [ci-coverage-backend-check] exit=1 restored=0
//   "CI_REQUIRED_SCRIPTS key coverage:backend:check is absent from .github/workflows/test.yml; remove the stale CI requirement or restore the workflow step"
// [home-backend-missing] exit=1 restored=0
//   ".claude/skills/push/SKILL.md §2 must contain one unambiguous ### Rust/Tauri backend home"
// [home-backend-duplicate] exit=1 restored=0
//   ".claude/skills/push/SKILL.md §2 must contain one unambiguous ### Rust/Tauri backend home"
// [home-backend-prose] exit=1 restored=0
//   ".claude/skills/push/SKILL.md §2 must contain one unambiguous ### Rust/Tauri backend home"
// [home-backend-prefix] exit=1 restored=0
//   ".claude/skills/push/SKILL.md §2 must contain one unambiguous ### Rust/Tauri backend home"
// [home-backend-fenced] exit=1 restored=0
//   ".claude/skills/push/SKILL.md §2 must contain one unambiguous ### Rust/Tauri backend home"
// [home-backend-parent] exit=1 restored=0
//   ".claude/skills/push/SKILL.md §2 must contain one unambiguous ### Rust/Tauri backend home"
// [home-frontend-missing] exit=1 restored=0
//   ".claude/skills/push/SKILL.md §2 must contain one unambiguous ### TypeScript/React frontend home"
// [home-frontend-duplicate] exit=1 restored=0
//   ".claude/skills/push/SKILL.md §2 must contain one unambiguous ### TypeScript/React frontend home"
// [home-frontend-prose] exit=1 restored=0
//   ".claude/skills/push/SKILL.md §2 must contain one unambiguous ### TypeScript/React frontend home"
// [home-frontend-prefix] exit=1 restored=0
//   ".claude/skills/push/SKILL.md §2 must contain one unambiguous ### TypeScript/React frontend home"
// [home-frontend-fenced] exit=1 restored=0
//   ".claude/skills/push/SKILL.md §2 must contain one unambiguous ### TypeScript/React frontend home"
// [home-frontend-parent] exit=1 restored=0
//   ".claude/skills/push/SKILL.md §2 must contain one unambiguous ### TypeScript/React frontend home"
// [home-contracts-missing] exit=1 restored=0
//   ".claude/skills/push/SKILL.md §2 must contain one unambiguous ### Cross-layer contracts home"
// [home-contracts-duplicate] exit=1 restored=0
//   ".claude/skills/push/SKILL.md §2 must contain one unambiguous ### Cross-layer contracts home"
// [home-contracts-prose] exit=1 restored=0
//   ".claude/skills/push/SKILL.md §2 must contain one unambiguous ### Cross-layer contracts home"
// [home-contracts-prefix] exit=1 restored=0
//   ".claude/skills/push/SKILL.md §2 must contain one unambiguous ### Cross-layer contracts home"
// [home-contracts-fenced] exit=1 restored=0
//   ".claude/skills/push/SKILL.md §2 must contain one unambiguous ### Cross-layer contracts home"
// [home-contracts-parent] exit=1 restored=0
//   ".claude/skills/push/SKILL.md §2 must contain one unambiguous ### Cross-layer contracts home"
// [home-ledger-missing] exit=1 restored=0
//   ".claude/skills/push/SKILL.md §2 must contain one unambiguous ### Findings ledger home"
// [home-ledger-duplicate] exit=1 restored=0
//   ".claude/skills/push/SKILL.md §2 must contain one unambiguous ### Findings ledger home"
// [home-ledger-prose] exit=1 restored=0
//   ".claude/skills/push/SKILL.md §2 must contain one unambiguous ### Findings ledger home"
// [home-ledger-prefix] exit=1 restored=0
//   ".claude/skills/push/SKILL.md §2 must contain one unambiguous ### Findings ledger home"
// [home-ledger-fenced] exit=1 restored=0
//   ".claude/skills/push/SKILL.md §2 must contain one unambiguous ### Findings ledger home"
// [home-ledger-parent] exit=1 restored=0
//   ".claude/skills/push/SKILL.md §2 must contain one unambiguous ### Findings ledger home"
// [section-missing] exit=1 restored=0
//   ".claude/skills/push/SKILL.md §2 must contain one unambiguous ### Rust/Tauri backend home"
// [section-duplicate] exit=1 restored=0
//   ".claude/skills/push/SKILL.md §2 must contain one unambiguous ### Rust/Tauri backend home"
// [section-fenced] exit=1 restored=0
//   ".claude/skills/push/SKILL.md §2 must contain one unambiguous ### Rust/Tauri backend home"
// [only-reference] exit=1 restored=0
//   "command pnpm rust:windows:check must be fenced in ### Rust/Tauri backend within .claude/skills/push/SKILL.md §2. Move or add its route in that subsection"
// [only-pre-review] exit=1 restored=0
//   "command pnpm rust:windows:check must be fenced in ### Rust/Tauri backend within .claude/skills/push/SKILL.md §2. Move or add its route in that subsection"
// [only-comment] exit=1 restored=0
//   "command pnpm rust:windows:check must be fenced in ### Rust/Tauri backend within .claude/skills/push/SKILL.md §2. Move or add its route in that subsection"
// [only-prose] exit=1 restored=0
//   "command pnpm rust:windows:check must be fenced in ### Rust/Tauri backend within .claude/skills/push/SKILL.md §2. Move or add its route in that subsection"
// [only-arguments] exit=1 restored=0
//   "command pnpm rust:windows:check must be fenced in ### Rust/Tauri backend within .claude/skills/push/SKILL.md §2. Move or add its route in that subsection"
// [kit-env-prefix] exit=1 restored=0
//   "command env -u KIT_ROOT pnpm findings:kit:check must be fenced in ### Findings ledger within .claude/skills/push/SKILL.md §2. Move or add its route in that subsection"
// [receipt-ensure] exit=1 restored=0
//   "unknown receipt gate absent-gate in .claude/skills/push/SKILL.md: pnpm gate:ensure absent-gate; register it in scripts/gate-receipt.mjs GATES or use a registered gate"
// [receipt-run] exit=1 restored=0
//   "unknown receipt gate absent-gate in .claude/skills/push/SKILL.md: pnpm gate:run absent-gate; register it in scripts/gate-receipt.mjs GATES or use a registered gate"
// [receipt-check] exit=1 restored=0
//   "unknown receipt gate absent-gate in .claude/skills/push/SKILL.md: pnpm gate:check absent-gate; register it in scripts/gate-receipt.mjs GATES or use a registered gate"
// [missing-push-script] exit=1 restored=0
//   ".claude/skills/push/SKILL.md: pnpm absent:run invokes missing package script absent:run"
// [missing-subsection-script] exit=1 restored=0
//   ".claude/skills/push/SKILL.md ### TypeScript/React frontend invokes missing package script absent:comment"
// [missing-workflow-script] exit=1 restored=0
//   ".github/workflows/test.yml invokes missing package script absent:workflow"
// [missing-contract-script] exit=1 restored=0
//   "package script gates:contract:check invokes missing package script absent:contract"
//   "package script gates:contract:check invokes missing package script absent:contract"
//   "package script gates:contract:check invokes missing package script absent:contract"
// [escape] exit=1 restored=0
//   "gate command escapes scripts/: bash scripts/../package.json; use a path inside scripts/"
// [unresolved] exit=1 restored=0
//   "unresolved gate command in .claude/skills/push/SKILL.md: kit sync --check ."
// [launcher-gates-push] exit=1 restored=0
//   "package.json gates:push must invoke agent-gate node scripts/run-push-gates.mjs; found \"node scripts/run-push-gates.mjs\""
// [launcher-checks-pre-review] exit=1 restored=0
//   "package.json checks:pre-review must invoke agent-gate node scripts/run-push-gates.mjs --pre-review; found \"node scripts/run-push-gates.mjs --pre-review\""
// [launcher-gate-ensure] exit=1 restored=0
//   "package.json gate:ensure must invoke agent-gate node scripts/gate-receipt.mjs ensure; found \"node scripts/gate-receipt.mjs ensure\""
// [launcher-gate-run] exit=1 restored=0
//   "package.json gate:run must invoke agent-gate node scripts/gate-receipt.mjs run; found \"node scripts/gate-receipt.mjs run\""
// [contract-absent] exit=1 restored=0
//   "package.json is missing gates:contract:check; add the shared contract chain"
// [kit-command] exit=1 restored=0
//   "findings:kit:check must be exactly env -u KIT_ROOT kit sync --check ., not kit sync --check .; the gate runs the released kit on PATH"
// [kit-workbench] exit=1 restored=0
//   "findings:kit:check names the kit workbench path Projekte/agent-kit; use the released kit on PATH so an unreleased edit cannot reach this gate"
// [skill-workbench] exit=1 restored=0
//   ".claude/skills/push/SKILL.md names the kit workbench driver Projekte/agent-kit/bin/kit; the kit-parity gate runs the released kit on PATH"
// [contract-fence-missing] exit=1 restored=0
//   "gates:contract:check must be fenced exactly once in the .claude/skills/push/SKILL.md §2 preamble; add or move its sole fence there"
// [contract-fence-duplicate] exit=1 restored=0
//   "gates:contract:check must be fenced exactly once in the .claude/skills/push/SKILL.md §2 preamble; add or move its sole fence there"
// [contract-fence-moved] exit=1 restored=0
//   "gates:contract:check must be fenced exactly once in the .claude/skills/push/SKILL.md §2 preamble; add or move its sole fence there"
// [push-invocation-missing] exit=1 restored=0
//   ".claude/skills/push/SKILL.md §2 must fence pnpm gates:push -- <blocks> exactly once in its preamble"
// [push-invocation-duplicate] exit=1 restored=0
//   ".claude/skills/push/SKILL.md §2 must fence pnpm gates:push -- <blocks> exactly once in its preamble"
// [push-command-missing] exit=1 restored=0
//   "push gate runner command is neither an exact fenced line nor a gates:contract:check member: cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets --locked -- -D warnings"
// [push-contract-member-missing] exit=1 restored=0
//   "push gate runner command is neither an exact fenced line nor a gates:contract:check member: pnpm mutation:guard:check"
// [push-command-extra] exit=1 restored=0
//   "fenced §2 gate command is not run by the push gate runner: pnpm gate:ensure frontend-build"
// [pre-section-missing] exit=1 restored=0
//   ".claude/skills/push/SKILL.md must contain ## 2a. Pre-review checks"
// [pre-invocation-missing] exit=1 restored=0
//   ".claude/skills/push/SKILL.md ## 2a. Pre-review checks must fence pnpm checks:pre-review exactly once"
// [pre-invocation-duplicate] exit=1 restored=0
//   ".claude/skills/push/SKILL.md ## 2a. Pre-review checks must fence pnpm checks:pre-review exactly once"
// [pre-command-missing] exit=1 restored=0
//   "pre-review runner command is not fenced in ## 2a. Pre-review checks: pnpm exec tsgo --noEmit"
// [pre-command-extra] exit=1 restored=0
//   "fenced pre-review command is not run by the scheduler: pnpm gate:ensure frontend-build"
// [yaml-q] exit=1 restored=0
//   "unsupported YAML escape in run: \\q"
// [yaml-x2] exit=1 restored=0
//   "unsupported YAML escape in run: \\x"
// [yaml-U00110000] exit=1 restored=0
//   "unsupported YAML escape in run: \\U00110000"
// [job-if] exit=1 restored=0
//   ".github/workflows/test.yml workflow job has if: \"success()\": test"
// [job-continue] exit=1 restored=0
//   ".github/workflows/test.yml workflow job has continue-on-error: \"true\": test"
// [workflow-contract-missing] exit=1 restored=0
//   ".github/workflows/test.yml must run gates:contract:check exactly once; replace duplicate tooling steps with one contract-gate step"
// [workflow-contract-duplicate] exit=1 restored=0
//   ".github/workflows/test.yml must run gates:contract:check exactly once; replace duplicate tooling steps with one contract-gate step"
// [workflow-contract-arguments] exit=1 restored=0
//   ".github/workflows/test.yml contract-gate step must be exactly pnpm gates:contract:check"
// [workflow-unregistered-route] exit=1 restored=0
//   "workflow-routed package script gate:ensure is neither reachable from gates:contract:check nor declared in GATE_PLACEMENTS and fenced in its named .claude/skills/push/SKILL.md subsection; add it to the contract gate or add both the placement entry and subsection fence"
// [step-if] exit=1 restored=0
//   ".github/workflows/test.yml workflow step has if: \"success()\": Run the contract gate"
// [step-continue] exit=1 restored=0
//   ".github/workflows/test.yml workflow step ignores the gate's exit status with continue-on-error: \"true\": Run the contract gate"
// [step-chain-or] exit=1 restored=0
//   ".github/workflows/test.yml workflow step neutralises or chains gate exit codes: Run the contract gate"
// [step-chain-semicolon] exit=1 restored=0
//   ".github/workflows/test.yml workflow step neutralises or chains gate exit codes: Run the contract gate"
// [step-chain-pipe] exit=1 restored=0
//   ".github/workflows/test.yml workflow step neutralises or chains gate exit codes: Run the contract gate"
// [workflow-command] exit=1 restored=0
//   "workflow command must exactly match a fenced line or routed package-script segment: node scripts/check-gate-routing.mjs --example"
// [contract-member-skill] exit=1 restored=0
//   "contract-gate member gates:routing:check is also invoked directly by .claude/skills/push/SKILL.md; keep it only in gates:contract:check"
// [contract-member-workflow] exit=1 restored=0
//   "contract-gate member gates:routing:check is also invoked directly by .github/workflows/test.yml; keep it only in gates:contract:check"
// [unrouted-check] exit=1 restored=0
//   "package script orphan:check is not routed through .claude/skills/push/SKILL.md or .github/workflows/test.yml"
// [unrouted-test] exit=1 restored=0
//   "package script orphan:test is not routed through .claude/skills/push/SKILL.md or .github/workflows/test.yml"
// [file-orphan-tests-mjs] exit=1 restored=0
//   "test file scripts/orphan-tests.mjs is not reachable from a routed package script or Vitest include"
// [file-orphan-test-mjs] exit=1 restored=0
//   "test file scripts/orphan.test.mjs is not reachable from a routed package script or Vitest include"
// [file-orphan-tests-py] exit=1 restored=0
//   "test file scripts/orphan-tests.py is not reachable from a routed package script or Vitest include"
// [file-orphan_test-py] exit=1 restored=0
//   "test file scripts/orphan_test.py is not reachable from a routed package script or Vitest include"
// [file-orphan-tests-sh] exit=1 restored=0
//   "test file scripts/orphan-tests.sh is not reachable from a routed package script or Vitest include"
// [file-check-orphan-mjs] exit=1 restored=0
//   "checker file scripts/check-orphan.mjs is not reachable from a routed package script or Vitest include"
// [file-orphan-executable] exit=1 restored=0
//   "checker file scripts/orphan-executable is not reachable from a routed package script or Vitest include"
// [glob] exit=1 restored=0
//   "sensitive-path glob absent-path/** matches no file"
// [review-missing] exit=1 restored=0
//   ".claude/skills/push/SKILL.md has no unambiguous \"## 3.\" section"
// [review-ambiguous] exit=1 restored=0
//   ".claude/skills/push/SKILL.md has no unambiguous \"## 3.\" section"
// [review-no-block] exit=1 restored=0
//   ".claude/skills/push/SKILL.md has no path-glob text block in its \"## 3.\" section"
// [argument-unknown] exit=1 restored=0
//   "Unknown argument: --unknown"
// [argument-missing] exit=1 restored=0
//   "Missing value for --repo-root"
// [json-invalid] exit=1 restored=0
//   "Expected property name or '}' in JSON at position 1 (line 1 column 2)"
// [scripts-invalid-type] exit=1 restored=0
//   "Cannot use 'in' operator to search for 'gates:push' in invalid"
// [command-invalid-type] exit=1 restored=0
//   "command.matchAll is not a function or its return value is not iterable"
// [read-SKILL-md] exit=1 restored=0
//   "ENOENT: no such file or directory, open '/tmp/build-aa086ec3/phase-proof/inputs/.claude/skills/push/SKILL.md'"
// [read-test-yml] exit=1 restored=0
//   "ENOENT: no such file or directory, open '/tmp/build-aa086ec3/phase-proof/inputs/.github/workflows/test.yml'"
// [read-package-json] exit=1 restored=0
//   "ENOENT: no such file or directory, open '/tmp/build-aa086ec3/phase-proof/inputs/package.json'"
// [read-vite-config-ts] exit=1 restored=0
//   "ENOENT: no such file or directory, open '/tmp/build-aa086ec3/phase-proof/inputs/vite.config.ts'"
// [stat-error] exit=1 restored=0
//   "ELOOP: too many symbolic links encountered, stat '/tmp/build-aa086ec3/phase-proof/inputs/scripts/loop'"
// [git-error] exit=1 restored=0
//   "Cannot enumerate working-tree files: git ls-files --others --exclude-standard -z -- . failed (fatal: not a git repository (or any of the parent directories): .git)"
```

## scripts/coverage-report.mjs — historical evidence

Archived verbatim on 2026-10-13. These observations describe the source at their recorded dates.

```javascript
/**
 * The failure matrix for this artefact.
 *
 * `push-review-policy.md:300-307` asks that a verification artefact whose output is read as
 * evidence outside a test run carry, in its own header, the message and exit status each of its
 * assertions was *seen* to produce; `:376-380` asks that the enumeration be complete, every path
 * staged or argued. This script is such an artefact — `package.json:48,52` and
 * `.github/workflows/test.yml:154,226` cite its exit status for both coverage ratchets and both
 * area-floor gates — and until 2026-09-22 it had no matrix at all (`f-20260921-02`).
 *
 * **Every row below was run.** The enumeration was rebuilt from this source rather than copied
 * from the finding: two `grep` passes — `throw new Error|process.exitCode|stderr.write`, then
 * `await |spawnSync` for the rejections that reach `main().catch` — plus a reading of every entry
 * point's parameters for the class neither pattern can see, a property access on unvalidated input
 * before it is checked. Five consecutive review rounds corrected a matrix that had been assembled
 * from the previous matrix, and each inherited the last one's errors; that is why this one starts
 * from the file.
 *
 * **114 distinct failure paths**, plus one swallowed cleanup path that deliberately produces no
 * failure of its own (row 32) and one shared sink (row 41). Rows 8–13, 15–17, 19–20, 22–26,
 * and 33–40 are not staged by a test; every other path is staged. No row is *argued*: that is
 * reserved for a path reachable only by editing the verifier, doing harm that outlives the run,
 * or touching something the run may not modify. Failure-case CLI tests use scratch inputs;
 * writer tests target only scratch baselines.
 *
 * Module-level rows are reached by calling the exported function directly, which is a real caller:
 * `scripts/coverage-report-tests.mjs` does the same. Their exit status is the CLI's only when they
 * are reached through it, and row 41 records what that is. `TypeError` rows are the wrong-shape
 * class and are recorded as what they are, not dressed up as diagnostics.
 *
 *  #  site                what fails                          message (to its distinguishing part)
 * --- ------------------- ---------------------------------- ------------------------------------
 *  1  :566    assignArea   no area claims a production file   `Unmapped production file: src/other.ts`
 *  2  :567    assignArea   two areas claim the same file      `Production file belongs to multiple
 *                                                             coverage areas: src/utils/a.ts
 *                                                             (utilities, second)`
 *  3  :615                 an area's declared source is not   `Coverage area utilities has the
 *                          the source the file came from      wrong source for src/utils/example.ts`
 *  4  :690                 a production file has no LCOV      `Coverage data missing for production
 *                          record at all                      files: src/utils/example.ts`
 *  5  :704                 an undeclared blank record         `Coverage measurement is blank for
 *                          (condition 1)                      production files: src/utils/blank.ts.`
 *  6  :639                 a declared path outside the        `Coverage statementFree declarations
 *                          measured set (condition 2)         are outside the measured production
 *                                                             set: src/gone.ts.`
 *  7  :716                 a declared path that is measured   `Coverage statementFree declarations
 *                          and not blank (condition 3)        are no longer blank:
 *                                                             src/utils/example.ts.`
 *  8  :721                 a configured area with no          `Coverage data missing for area:
 *                          measured file at all               empty` — not staged by a test
 *  9  :589    ->           the source root is unreadable      `EACCES: permission denied, scandir
 *      files-below.mjs:5   (readdir at the root)              '<root>/src'` — not staged by a test
 * 10  files-below.mjs:5    a directory *below* the source     `EACCES: permission denied, scandir
 *      via :9 recursion    root is unreadable                 '<root>/src/locked'` — not staged by a test
 * 11  :583                 config of the wrong shape: `{}`    TypeError: `config.sources is not
 *                                                             iterable` — not staged by a test
 * 12  :611                 `{"sources":[],"areas":null}`      TypeError: `Cannot read properties of
 *                                                             null (reading 'map')` — not staged by a test
 * 13  :602    ->           a source with no `include` list    TypeError: `Cannot read properties of
 *      coverage-scope.mjs:34                                   undefined (reading 'some')` — not staged by a test
 * 14  :603    ->           a source with no `exclude` list    TypeError: `Cannot read properties of
 *      coverage-scope.mjs:39                                   undefined (reading 'map')` — not staged by a test
 * 14a :624                 a `statementFree` that is not an    TypeError: `(source.statementFree ??
 *                          array: `{}`                        []).map is not a function`
 * 14b :624                 a `statementFree` entry that is     TypeError: `Cannot destructure
 *                          not an object: `[null]`            property 'path' of 'object null' as
 *                                                             it is null.`
 * 15  :433    parseLcov    given something not a string       TypeError: `Cannot read properties of
 *                                                             null (reading 'replaceAll')` — not staged by a test
 * 16  :771                 the baseline's version is not 1    `Unsupported coverage baseline format`
 *                          or it carries no `areas` — not staged by a test
 * 17  :755                 no recorded scope, checked         `Coverage baseline is missing its
 *                          against a config                   recorded scope` — not staged by a test
 * 18  :758                 the recorded scope no longer       `Coverage measurement scope changed:
 *                          matches the config                 source ids and roots, include globs,
 *                                                             exclude globs, statementFree
 *                                                             declarations, or area ids, sources,
 *                                                             and paths ... Re-record the scope
 *                                                             subtree by hand ...`
 * 19  :775                 a measured area the baseline       `Missing baseline for area: utilities`
 *                          does not carry — not staged by a test
 * 20  :780                 a baseline area missing one        `Missing functions baseline for area:
 *                          metric                             utilities` — not staged by a test
 * 21  :813                 a covered count or ratio           `utilities lines regressed: 1/2,
 *                          regressed                          baseline 2/2`
 * 22  :819                 a baseline area absent from the    `Baseline references unknown area:
 *                          report                             ghost` — not staged by a test
 * 23  :770                 a baseline of the wrong shape:     TypeError: `Cannot read properties of
 *                          `null`                             null (reading 'version')` — not staged by a test
 * 24  :831                 an area with no                    `Missing minimum coverage for area:
 *                          `minimumCoverage`                  utilities` — not staged by a test
 * 25  :833                 an area with no entry in the       `Missing coverage report for area:
 *                          report. Reachable through the      utilities`
 *                          exported API, not through the
 *                          CLI, and it stays for that — not staged by a test
 * 26  :837                 a minimum that is not a            `Invalid lines minimum coverage for
 *                          percentage                         area: utilities` — not staged by a test
 * 27  :843                 a measured area below its floor    `utilities lines is below minimum
 *                                                             coverage: 50.00% < 80.00%`
 * 28  :1117                the temporary write rejects        the rejection, unchanged:
 *                                                             `writeFile refused`
 * 29  :1135                the formatter exits non-zero       `Failed to format coverage baseline
 *                                                             with <path>: status=23; signal=null;
 *                                                             stderr="rejected"`
 * 29b :1135                the formatter is killed by a       `... status=null; signal=SIGTERM;
 *                          signal                             stderr=""` -- `status !== 0` is true
 *                                                             for `null`, so a kill is caught
 *                                                             rather than reported as success
 * 30  :1135                the formatter binary is missing    `... status=null; signal=null;
 *                                                             stderr=""; error.code=ENOENT;
 *                                                             error.message="spawnSync <path>
 *                                                             ENOENT"`
 * 31  :1139                the rename into place rejects      the rejection, unchanged:
 *                                                             `rename refused`
 * 32  :1108                cleanup's unlink rejects after a   **no failure of its own**: the
 *                          failure. Deliberately swallowed    primary error is rethrown unchanged
 *                          so it cannot replace the           (`rename refused`) and the temporary
 *                          actionable error                   file survives as evidence
 * 33  :1159                an option with no value            `Missing value for --config`
 *                                                             — exit 1; not staged by a test
 * 34  :1162                an unknown argument                `Unknown argument: --nope` — exit 1; not staged by a test
 * 35  :1166                a required option omitted          `Usage: coverage-report.mjs --config
 *                                                             <file> ...` — exit 1; not staged by a test
 * 36  :1189                the config file does not exist     `ENOENT: no such file or directory,
 *                                                             open '<root>/missing.json'` — exit 1; not staged by a test
 * 37  :1189                the config file is not JSON        SyntaxError: `Expected property name
 *                                                             or '}' in JSON at position 2` — exit 1; not staged by a test
 * 38  :1200                an LCOV file does not exist        `ENOENT: ... '<root>/missing.info'`
 *                                                             — exit 1; not staged by a test
 * 39  :1220                the baseline file does not exist   `ENOENT: ... '<root>/missing.json'`
 *                                                             — exit 1; not staged by a test
 * 40  :1220                the baseline file is not JSON      SyntaxError, as row 37 — exit 1; not staged by a test
 * 41  :1233                `main().catch` — the shared sink,  every CLI throw, reached through
 *                          **not an independent failure**     the CLI, prints `error.message` on
 *                                                             stderr and exits **1**. Measured with
 *                                                             row 18's throw: exit 1, message on
 *                                                             stderr, nothing on stdout
 * 42  :910    write guard  prior baseline is not JSON          `Invalid prior coverage baseline at
 *                                                             <path>: <JSON parse message>` — exit 1
 * 43  :859    validate     prior version or `areas` is         `Invalid prior coverage baseline
 *                          wrong-shaped                        from <path>: expected version 1
 *                                                             and an areas object` — exit 1
 * 44  :865    validate     a prior area's metrics container    `Invalid prior coverage baseline
 *                          is not an object                     from <path>: utilities must
 *                                                             contain all metrics` — exit 1
 * 45  :879    validate     a prior area is missing one metric  `Invalid prior coverage baseline
 *                                                             from <path>: utilities lines must
 *                                                             have non-negative integer covered
 *                                                             and total counts with covered <=
 *                                                             total` — exit 1
 * 46  :879    validate     prior `covered` is not an integer  same invalid-count message, with
 *                                                             `covered: "bad"` — exit 1
 * 47  :879    validate     prior `covered` is negative        same invalid-count message, with
 *                                                             `covered: -1` — exit 1
 * 48  :879    validate     prior `covered > total`             same invalid-count message, with
 *                                                             `covered: 2, total: 1` — exit 1
 * 49  :879    validate     prior `covered` is fractional      same invalid-count message, with
 *                                                             `covered: 1.5` — exit 1
 * 50  :879    validate     prior `total` is fractional        same invalid-count message, with
 *                                                             `total: 2.5` — exit 1
 * 51  :879    validate     prior `total` is negative          same invalid-count message, with
 *                                                             `total: -1` — exit 1
 * 52  :1097   write guard  covered count decreases while the  `Coverage baseline write refused
 *                          ratio stays level                    (decreases: utilities lines
 *                                                             (covered count 10 → 9)); ...` — exit 1
 * 53  :1097   write guard  ratio decreases while `covered`   `Coverage baseline write refused
 *                          rises                                (decreases: utilities lines
 *                                                             (ratio 50.00% → 46.15%)); ...` — exit 1
 * 54  :1097   write guard  an area is removed                 `Coverage baseline write refused
 *                                                             (... retired lines (area removed)
 *                                                             ...); ...` — exit 1
 * 55  :985→1097 ratio check `0/0 → 0/1` is a decrease          `Coverage baseline write refused
 *                                                             (... utilities lines (ratio
 *                                                             100.00% → 0.00%)); ...` — exit 1
 * 56  :1097   write guard  recorded scope changes             `Coverage baseline write refused
 *                                                             (... scope keys changed:
 *                                                             sources[0].exclude[0]); ...` — exit 1
 * 57  :1097   write guard  an area is added                   `Coverage baseline write refused
 *                                                             (... areas changed: added=[puzzles],
 *                                                             removed=[]); ...` — exit 1
 * 58  :1047    authorize    `tasks/decisions.md` is missing    `Instrument change authorization
 *                                                             requires tasks/decisions.md for
 *                                                             decision d-20260927-23 governing
 *                                                             f-20260829-04` — exit 1
 * 59  :1055    authorize    decision id has no entry           `No decision entry found for
 *                                                             --instrument-change d-20260927-23
 *                                                             in tasks/decisions.md` — exit 1
 * 60  :1059    authorize    `Governs:` misses the exact finding `Decision d-20260927-23 does not
 *                                                             govern finding f-20260829-04` — exit 1
 * 61  :1154   parse         `--instrument-change` has no value `Missing value for
 *                                                             --instrument-change` — exit 1
 * 62  :1154   parse         `--finding` has no value           `Missing value for --finding` — exit 1
 * 63  :1178   parse         authorization flags without       `--instrument-change and --finding
 *                          `--write-baseline`                 require --write-baseline` — exit 1
 * 64  :1181   parse         only `--instrument-change`        `--instrument-change and --finding
 *                                                             must be used together` — exit 1
 * 65  :1181   parse         only `--finding`                  `--instrument-change and --finding
 *                                                             must be used together` — exit 1
 * 66  :926    git           `rev-parse` fails for another     `Failed to inspect prior coverage
 *                          reason than not-a-repository        baseline with git rev-parse
 *                                                             --is-inside-work-tree: status=37;
 *                                                             stderr="fatal: simulated repository
 *                                                             metadata error\n"` — exit 1
 * 67  :899    git           git cannot be spawned             `Failed to inspect prior coverage
 *                                                             baseline with git rev-parse
 *                                                             --is-inside-work-tree: status=null;
 *                                                             stderr=""; error.code=ENOENT;
 *                                                             error.message="spawnSync git
 *                                                             ENOENT"` — exit 1
 * 68  :931    git           `ls-tree` fails for unborn `HEAD` `Failed to inspect prior coverage
 *                                                             baseline with git ls-tree
 *                                                             --full-name HEAD -- scratch-
 *                                                             baseline.json: status=128;
 *                                                             stderr="fatal: Not a valid object
 *                                                             name HEAD\n"` — exit 1
 * 69  :936    git           `ls-tree` output is ambiguous or  `Failed to inspect prior coverage
 *                          malformed                            baseline with git ls-tree
 *                                                             --full-name HEAD -- scratch-
 *                                                             baseline.json: expected one tracked
 *                                                             file entry; stderr=""` — exit 1
 * 70  :943    git           `show` fails for a tracked path    `Failed to inspect prior coverage
 *                                                             baseline with git show
 *                                                             HEAD:scratch-baseline.json:
 *                                                             status=38; stderr="fatal: simulated
 *                                                             committed object failure\n"` — exit 1
 * 71  rust-test-only.mjs   invalid exclusion object or        `Coverage source backend
 *     validateExclusionConfig empty reason                      excludeTestOnlyItems must be an
 *                                                             object with a non-empty reason
 *                                                             string` — exit 1
 * 72  rust-test-only.mjs   include-matched non-Rust file       `src-tauri/src/config.ts:1:
 *     scanRustTestOnly                                         excludeTestOnlyItems can scan only
 *                                                             .rs files` — exit 1
 * 73  rust-test-only.mjs   unbalanced delimiter at EOF         `src-tauri/src/lib.rs:2: unbalanced
 *     delimiterPairs                                           delimiter at end of file` — exit 1
 * 74  rust-test-only.mjs   unparseable `cfg` predicate         `src-tauri/src/lib.rs:1:
 *     parsePredicate                                           unparseable cfg predicate (not()
 *                                                             requires one cfg predicate)` — exit 1
 * 75  rust-test-only.mjs   unparseable `cfg_attr` predicate    `src-tauri/src/lib.rs:1:
 *     evaluateCfgAttribute                                      unparseable cfg_attr predicate
 *                                                             (expected a condition and
 *                                                             attribute)` — exit 1
 * 76  rust-test-only.mjs   braced macro expression followed    `src-tauri/src/lib.rs:4: unsupported
 *     findStatementEnd      by `?`                              test-only form; give it its own
 *                                                             item/statement or extend
 *                                                             rust-test-only.mjs` — exit 1
 * 77  rust-test-only.mjs   test-only attribute in unplaced     `src-tauri/src/lib.rs:3:
 *     analyzeRustFile       `try` block                         unplaceable test-only context;
 *                                                             extend rust-test-only.mjs only for
 *                                                             a listed Rust form` — exit 1
 * 78  rust-test-only.mjs   statement reaches `}` without `;`   `src-tauri/src/lib.rs:3: test-only
 *     findStatementEnd                                         statement reaches its enclosing }
 *                                                             without a terminator` — exit 1
 * 79  rust-test-only.mjs   shared line with production call    `src-tauri/src/lib.rs:1: shared
 *     lineRanges                                               coverage line; give the test-only
 *                                                             item its own lines` — exit 1
 * 80  rust-test-only.mjs   shared line with production string  same shared-line message, with
 *     lineRanges                                                `const VALUE: &str = "production"`
 *                                                             outside the test-only fn — exit 1
 * 81  rust-test-only.mjs   nested module in a test-only inline `src-tauri/src/lib.rs:1: unsupported
 *     resolveModulePath    module                               test-only module declaration inside
 *                                                             an inline module` — exit 1
 * 82  rust-test-only.mjs   `#[path]` on test-only `mod`        `src-tauri/src/lib.rs:3: unsupported
 *     resolveModulePath                                          #[path] on a test-only module
 *                                                             declaration` — exit 1
 * 83  rust-test-only.mjs   unresolved test-only `mod`          `src-tauri/src/lib.rs:2: cannot
 *     resolveModulePath                                          resolve test-only module missing`
 *                                                             — exit 1
 * 84  rust-test-only.mjs   ambiguous module file layouts       `src-tauri/src/lib.rs:2: ambiguous
 *     resolveModulePath                                          test-only module helper:
 *                                                             src-tauri/src/helper.rs,
 *                                                             src-tauri/src/helper/mod.rs` — exit 1
 * 85  rust-test-only.mjs   test-only attribute in unrelated    `src-tauri/src/lib.rs:2: unsupported
 *     analyzeRustFile       macro input                          test-only context inside a macro
 *                                                             input` — exit 1
 * 86  rust-test-only.mjs   unreadable included Rust file       `src-tauri/src/unreadable.rs:1:
 *     scanRustTestOnly                                          unable to read Rust source: EACCES`
 *                                                             — exit 1
 * 87  rust-test-only.mjs   `.`, `?` or `as` after the `}` of a `src-tauri/src/lib.rs:4: unsupported
 *     findStatementEnd      statement-position braced macro or   test-only form; give it its own
 *                          `if`/`else` (four staged cases:      item/statement or extend
 *                          `.await`, `.method()`, `as`, `?`)    rust-test-only.mjs` — exit 1
 * 88  rust-test-only.mjs   `path = …` reached through a         `src-tauri/src/lib.rs:3: unsupported
 *     resolveModulePath    (nested) `cfg_attr` on a test-only   #[path] on a test-only module
 *                          `mod name;`                          declaration` — exit 1
 * 89  rust-test-only.mjs   module candidate not accessible for  `src-tauri/src/parent.rs:2: unable to
 *     resolveModulePath    a reason other than ENOENT/ENOTDIR   access test-only module candidate
 *                          (parent directory chmod 000)         …: EACCES: permission denied …`
 *                                                             — exit 1
 * 90  :651   mapping-only an area has no production files; test "area claims no production file":
 *                          `Coverage areas claim no production files: empty` — exit 1
 * 91  :1170  parse         `--mapping-only` with `--lcov`; test "mapping-only rejects LCOV arguments":
 *                          `--mapping-only cannot be combined with --lcov` — exit 1
 * 92  :1173  parse         `--mapping-only` with `--write-baseline`; test "mapping-only rejects baseline writes":
 *                          `--mapping-only cannot be combined with --write-baseline` — exit 1
 * 93  :465   parseLcov DA has neither 2 nor 3 fields       `Malformed LCOV ... DA requires 2 or 3 fields` — exit 1
 * 94  :469             DA line is not canonical and >= 1   `Malformed LCOV ... DA line must be a canonical decimal >= 1` — exit 1
 * 95  :472             DA hits are not canonical decimal   `Malformed LCOV ... DA hits must be a canonical decimal` — exit 1
 * 96  :475             present DA checksum is empty        `Malformed LCOV ... DA checksum must be non-empty when present` — exit 1
 * 97  :481             FN has other than 2 fields          `Malformed LCOV ... FN requires 2 fields` — exit 1
 * 98  :484             FN line is not canonical and >= 1   `Malformed LCOV ... FN line must be a canonical decimal >= 1` — exit 1
 * 99  :486             FN name is empty                    `Malformed LCOV ... FN name must be non-empty` — exit 1
 * 100 :504             FNDA has other than 2 fields        `Malformed LCOV ... FNDA requires 2 fields` — exit 1
 * 101 :507             FNDA hits are not canonical decimal `Malformed LCOV ... FNDA hits must be a canonical decimal` — exit 1
 * 102 :509             FNDA name is empty                  `Malformed LCOV ... FNDA name must be non-empty` — exit 1
 * 103 :518             BRDA has other than 4 fields        `Malformed LCOV ... BRDA requires 4 fields` — exit 1
 * 104 :521             BRDA line is not canonical and >= 1 `Malformed LCOV ... BRDA line must be a canonical decimal >= 1` — exit 1
 * 105 :524             BRDA block is not canonical decimal `Malformed LCOV ... BRDA block must be a canonical decimal` — exit 1
 * 106 :527             BRDA branch is not canonical decimal `Malformed LCOV ... BRDA branch must be a canonical decimal` — exit 1
 * 107 :530             BRDA taken is neither decimal nor - `Malformed LCOV ... BRDA taken must be a canonical decimal or -` — exit 1
 * 108 :446             empty SF path                       `Malformed LCOV ... SF path is empty` — exit 1
 * 109 :447             SF while a record is open           `Malformed LCOV ... SF before end_of_record` — exit 1
 * 110 :461             counter with no open record         `Malformed LCOV ... counter without an open record` — exit 1
 * 111 :436             end_of_record with no open record   `Malformed LCOV ... end_of_record without an open record` — exit 1
 * 112 :538             input ends with an open record      `Malformed LCOV at end of input: open record for SF "..."` — exit 1
 * 113 :512             FNDA has no earlier matching FN     `Malformed LCOV ... FNDA has no earlier matching FN` — exit 1
 *
 * **The rows the blank-measurement work added or changed were also staged against the real
 * frontend LCOV**, not only against fixtures, because that is the artefact an operator runs. Rows
 * 5 and 7 were run twice there, once with one offender and once with two, since a message naming
 * only the first offender passes every single-offender run; row 6 four times, because a dead
 * declaration has two distinct shapes and each got both offender counts; row 18 once, a scope
 * mismatch having no offender list to aggregate. Nine runs, one record each, all exit 1:
 *
 *   row 5   staged by raw-importing one never-imported production file, then two:
 *           `... files: src/components/boards/EditingCard.tsx.` and
 *           `... files: src/components/boards/AnnotationHint.tsx,
 *           src/components/boards/EditingCard.tsx.` — one message, both paths, sorted. The gate
 *           was measured green before and green again after the throwaway test was deleted.
 *   row 6   scratch config declaring `src/does-not-exist.ts`, then it and `src/also-missing.ts`;
 *           and separately `src/routeTree.gen.ts`, then it and `src/vite-env.d.ts` — files that
 *           exist on disk and are excluded, because condition 2 is measured-set membership and
 *           not filesystem existence.
 *   row 7   scratch config declaring `src/utils/format.ts`, then it and `src/utils/chess.ts`.
 *   row 18  a scratch baseline whose recorded scope was one `statementFree` entry stale — and the
 *           message does **not** name a baseline-write command. The baseline denies were removed
 *           under `d-20260927-23`; write protection now lives in the writer guard (rows 42-70).
 *
 * **Baseline-writer rows 42-70 and Rust-exclusion rows 71-86** were staged by CLI subtests in
 * `scripts/coverage-report-tests.mjs`; every refused write asserts exit 1 and byte-identical
 * scratch baseline-file bytes. Rows 42-51 are the individual prior-JSON/schema/counter cases; 52-55
 * are covered-count, ratio, removed-area, and zero-total decreases; 56-57 are scope and area-set
 * changes; 58-60 are missing or non-governing decisions; 61-65 are authorization-flag usage
 * errors; and 66-70 stage unexpected `rev-parse`, missing git, unborn `HEAD`, ambiguous/malformed
 * `ls-tree`, and failing `show` results. The tracked-`HEAD`, untracked-disk, first-write, accepted increase,
 * and accepted authorization cases also use scratch baselines; none names a repository baseline.
 *
 * **Malformed-LCOV rows 93–113** are each staged by a CLI subtest in
 * `scripts/coverage-report-tests.mjs`, asserting exit 1, the complete unique diagnostic and empty
 * stdout. Row 95 is also staged through `--write-baseline`, with unchanged scratch baseline bytes.
 * Diagnostics name the 1-based input line, JSON-quoted raw line and the open record's raw SF.
 * Row 112 names the open SF at end of input instead of a line.
 *
 * **Real-instrument negative controls, measured 2026-10-07:** scratch copies under /tmp of the
 * just-written frontend `coverage/lcov.info` (41,466 lines) and backend
 * `backend-coverage/lcov.info` (140,818 lines), run through the CLI with each package script's
 * own --config/--baseline and --lcov pointing at the copy. Both untouched files exited 0.
 * Four damaged copies, four runs, all exit 1. `<repo>` abbreviates the absolute checkout path:
 *
 *   row 112 frontend, final end_of_record removed:
 *           `Malformed LCOV at end of input: open record for SF "src/utils/lichess/explorer.ts"`
 *   row 112 backend, final end_of_record removed:
 *           `Malformed LCOV at end of input: open record for SF "<repo>/src-tauri/src/sound.rs"`
 *   row 95  frontend, first DA at input line 39, DA:46,1 → DA:46,x:
 *           `Malformed LCOV at line 39 in SF "src/App.tsx": DA hits must be a canonical decimal: "DA:46,x"`
 *   row 95  backend, first DA at input line 52, DA:27,47 → DA:27,x:
 *           `Malformed LCOV at line 52 in SF "<repo>/src-tauri/src/cancellable_read.rs": DA hits must be a canonical decimal: "DA:27,x"`
 *
 * What this matrix does **not** cover, stated rather than implied: unknown keys are ignored,
 * including damaged counter keys, to tolerate informational keys from future instruments.
 * Summary lines are not cross-checked, because llvm-cov's own summaries disagree with records in
 * 45 of 49 backend records measured 2026-10-07. Repeated DA or BRDA identities within a record take
 * the maximum hit count. Repeated identical FN declarations remain distinct functions. Line
 * numbers count the joined input when several `--lcov` files are supplied. Current callers each
 * pass one LCOV (`package.json:48,52`), so those numbers are file-local. Source-side line existence
 * (`f-20260920-20`) and consumer behaviour beyond exit status and `error.message` remain unchecked.
 */
```

## scripts/verify-app.mjs — historical evidence

Archived verbatim on 2026-10-13. These observations describe the source at their recorded dates.

```javascript
// Behavioural check against the real application window. See `scripts/app-driver.mjs` for the
// stack it builds and for what it deliberately cannot reach.
//
//   pnpm verify:app                 run the checks
//   pnpm verify:app --screenshot X  also write a PNG of the page to X
//   pnpm verify:app --progress-contract  run only the progress transport/cancellation scenario
//     --application /absolute/binary    select a disposable measurement binary
//     --expect-progress-generation N    require the first lease's exact decimal digits
//     --expect-clear-rejection          expect the disposable binary's typed clear failure
//
// Progress assertion staging: 2026-10-08, disposable APPLICATION INPUTS.
// Unmodified verifier. Every row below actually emitted its unique failure with exit 1.
// Durable record of full actual messages, commands, hashes and exact mutation patches:
// [Progress runtime proof](../tasks/handoffs/2026-10-08-f-20260925-02-review.md)
// Supplemental logs, exact mutations, commands, input/binary hashes and screenshots:
// /tmp/build-progress-aa086ec3/runtime/proof-report.md and manifest.json
// Original raw verifier SHA-256: c76499e2850dd1e1f99ea6237482aed271625f81db5c4d6ce7fb5534a5f0c457.
// Historical executable-body byte identity covers the matrix documentation step before the
// cumulative-review prerequisite and named timing-constant repairs below.
// Normal transport 13/13, high rejected-clear renderer 17/17, restoration 13/13, all exit 0.
// High clock seed 9007199254740992, first exact string generation 9007199254740993.
// Failure message -> application-input case (all exit 1):
// progress native event listener registers -> denied-events
// progress start lease has exact canonical string generation -> start-number
// progress running event has exact canonical string generation -> event-number
// progress state-update string lease reaches native with exact identity -> update-reject
// progress snapshot has exact canonical string generation -> snapshot-number
// progress terminal state update accepts the string lease -> update-reject
// progress terminal event has exact canonical string generation -> event-number
// progress malformed lease rejects without changing the snapshot -> malformed-accept
// progress invalid clear rejects as a native IPC operation -> null-clear-accept
// progress deliberate clear failure returns a typed native rejection -> rejection-absent-low
// progress clear return has exact canonical string generation -> clear-number
// progress cleared event has exact canonical string generation -> event-number
// progress clear removes the native snapshot -> clear-retain
// progress native event listener is released -> denied-events
// progress high-generation wire event drives the real renderer bar -> low-reject
// progress cancellation presses the production pre-claim job button -> ui-no-cancel
// progress rejected-clear null acknowledgement hides the cancelled generation -> ui-no-null-fence
// progress fenced old native event cannot resurrect the bar -> ui-no-fence
// progress newer retry remains distinct and visible after rejected clear -> ui-retry-gap
// progress newer retry continues updating through the real facade -> ui-no-update
// progress application must name an existing absolute binary path -> option-application
// expected progress generation must be a canonical unsigned u64 decimal string -> option-generation
// disposable progress measurement options require --progress-contract -> option-focused
// timed out waiting for progress renderer startup -> precondition-startup
// timed out waiting for progress database catalog opener -> precondition-opener
// timed out waiting for progress database catalog card -> precondition-catalog
// No argued or unstageable assertions. Disposable source restored byte-for-byte.
//
// The cancellation probe replays the catalog button's production
// onClick handler and presses Cancel synchronously before prepare_download can settle. This
// exercises the production pre-claim cancellation and failed-clear cleanup without a network
// download, while a native lease already drives the real facade, hook and ProgressButton.
//
// Workspace reload assertion staging: completed 2026-10-09 against disposable application inputs.
// The ordinary unchanged full verifier ran against a separately built application-input fault.
// No focused mode or --application routing option was used. Both unique workspace checks emitted
// FAIL, the verifier exited 1, and the other 86 checks passed. The byte-restored source was rebuilt
// and the full verifier exited 0 with 88 reported checks.
//   application-input case       | assertion/message                                                                | result
//   publish a fresh default      | a real document reload preserves both exact seeded workspace tab identities       | FAIL, full verifier exit 1
//   publish a fresh default      | a real document reload selects the second seeded workspace tab                    | FAIL, full verifier exit 1
// Durable record of exact commands, messages, hashes and source patch:
// [Workspace initialization runtime proof](../tasks/handoffs/2026-10-09-workspace-initialization.md)
// Original staging SHA-256: verifier f09d930fb0c721db26f21283a049a2a1671eca99841d20521283bc707f660e4b,
// app-driver 727687d7b7a93b1544ecee582f73c8e903b4a8ae50b68f6f78b6bfb42a0cbd69.
// This is a later comments-only update. Staging used the unchanged verifier and driver above.
//
// It asserts one hundred and four independently reported checks, plus one conditional reload check, that no other gate in this repository can:
//   group | assertions
//   startup | 5: production authority, user-file safety, owned-image cleanup, real IPC bridge,
//             document title
//   single instance | 5: refusal before initialization, unchanged registry bytes,
//                        primary responsiveness, shared-config refusal, different-HOME coexistence
//   practice durable storage | 14: seeded positions, paged reviews, migration, owner retention,
//                                legacy-key preservation, renderer ratings, real sync, exact counts
//   download destinations | 3: persisted destination, fresh-id refusal, database-root refusal
//   image/CSP | 4: retained-engine-portrait-render, retained-engine-data-url,
//                  retained-engine-WebKitGTK-decode, detached-blob-CSP-rejection
//   native services | 3: path capability refusal, live sound port, bundled sound bytes
//   attachments | 4: prepare, retire, live-session bytes/intent, titlebar cleanup
//   native reads | 6: mint, cancel, cancelled-ticket refusal, document-reload sweep, retained ticket,
//                     destroyed-window log
//   workspace reload | 2: exact seeded tab identities, second-tab selection after DOM readiness
//   Files | 7: seeded-row-render, double-click-route, opened-game-notation,
//              metadata-dialog-no-error, metadata-repertoire-filter, metadata-sidecar-type,
//              metadata-filename-preserved
//   Databases | 2: default-root-unusable, selected-root-missing
//   Library | 2: single destination and mixed tree, source-specific selection and actions
//   game opening | 14: native fixtures, labelled database opener, handle route/synchronization,
//                      database selection without admission, database button/double-click/Enter,
//                      labelled Files opener, stationary PGN selection without admission,
//                      Files button/double-click/Enter, empty-PGN refusal, dirty owner-bound discard
//   NAGs | 9: hint path/title/visibility, unknown hint absence, saved edit, four preserved NAGs
//   file freshness | 5: in-place rewrite, open-tab reload/withhold, native-read timing,
//                      main-thread apply budget, one-poll-interval freshness budget;
//                      +1 conditional Reload-from-disk check
//   titlebar/process | 3: rendered controls, process-before-close, process-after-close
//   shutdown | 3: start, bounded completion, sound signal
//   progress | 13: listener registration, start lease, running event, state-update identity,
//                  snapshot, terminal update, terminal event, malformed-lease refusal,
//                  invalid-clear refusal, clear return, cleared event, cleared snapshot,
//                  listener release
//
// Staged-failure record for the single-instance checks (2026-10-07).
// Extended on 2026-10-08 for the distinct application-data, configuration and local-data roots.
// B1 bypassed advisory locking, B2 appended one space to the refused launch's path-authority.json,
// and B3 locked an identifier-wide temporary leaf instead of the application-data leaf. Each
// Rust break was built with pnpm build and read by pnpm verify:app. The verifier logic stayed
// unchanged across these runs. After each run, the Rust diff was restored byte-for-byte to the
// intended Phase 2 changes. The B3 temporary lock leaf was removed after its processes exited.
// Every completed run also printed the three known $8 hint FAILs (f-20261005-07). B1 additionally
// printed the Repertoire-filter and metadata-sidecar FAILs. Those checks were left unchanged.
//   break                         | assertion/message                                                                                        | exit
//   B1: bypass advisory locking   | FAIL  a second process on the same app-data directory is refused before initialization                    | 1
//   B1: dependent setup failure   | FAIL  the refused launch leaves authority and credential registry bytes unchanged                        | 1
//   B1: dependent setup failure   | FAIL  the primary still answers WebDriver after the refused launch                                       | 1
//   B2: append one registry byte  | FAIL  the refused launch leaves authority and credential registry bytes unchanged                        | 1
//   B3: identifier-wide lock      | FAIL  a process on a different app-data directory initializes while the primary runs                      | 1
//   B4: stop matching-HOME peers  | FAIL  the primary still answers WebDriver after the refused launch                                       | 1
//   B5: omit configuration root  | FAIL  a second process sharing only the configuration directory is refused                               | 1
// The B1 rows each printed "not attempted: wait for same-directory refusal: timed out waiting
// for another ChessFable process holds the application data directory". Its dependent rows prove
// setup-failure reporting, not registry immutability or primary responsiveness. B2 directly
// exercised the byte comparison. Same-directory refusal stayed ok in both B2 and B3.
// B4 stopped only other processes whose /proc environment HOME exactly matched the refused
// launch's temporary HOME. The primary's five-second WebDriver request failed with
// "not attempted: query the primary WebDriver session after refusal: This operation was aborted".
// Same-directory refusal, unchanged bytes and shared-configuration refusal stayed ok. B4 also
// printed the different-HOME coexistence, document-reload and retained-reservation FAILs because
// they queried the stopped primary. The subsequent window-control wait expired, and harness
// cleanup escalated the stopped WebDriver process group to SIGKILL before exiting with status 1.
// B5 omitted the configuration root from the binary's admission list. The new assertion printed
// "not attempted: wait for shared-configuration refusal: timed out waiting for another ChessFable
// process holds the application data directory". Same-directory refusal, unchanged bytes,
// primary responsiveness and different-HOME coexistence stayed ok. B4 and B5 each used pnpm build
// followed by pnpm verify:app, with verifier logic unchanged between them. Both breaks were
// restored exactly, checked against the intended Rust diff and source hashes, before final proof.
// B1-B3 retain their earlier evidence: bypassing all locks now means injecting Ok(()) for every
// root, with the same refusal wait and message, so B1 needed no restage. B2 still changes the
// shared configuration registry, and B3 replaces the roots with one identifier-wide lock.
// The first B1 attempt aborted before any assertion because the resumed shell lacked the desktop
// environment and the nested compositor socket timed out. It is not assertion evidence. The
// completed runs used the existing desktop session's WAYLAND_DISPLAY, XDG_RUNTIME_DIR and bus.
//
// STAGED-FAILURE RECORD (push-review-policy §2), one row per assertion. The policy's fifth
// condition is that an inherited artefact is a finding, not a licence: until every assertion here
// carries a row, this file's green is not citable as evidence. A break is made in what the
// artefact READS — the built binary, its configuration and its bundled resources — never in this
// file's own logic, and is restored immediately afterwards.
//
// retained-engine-portrait-render, retained-engine-data-url, retained-engine-WebKitGTK-decode,
// and detached-blob-CSP-rejection (2026-09-20). Two breaks, chosen so that each half fails alone:
// that is what proves the CSP control is independent of the positive check, and therefore that a
// green run cannot have come from a widened policy.
//   break                                   | check                        | message printed     | exit
//   production LocalImage reverted to        | retained-engine-portrait-    | FAIL  the retained  | 1
//   URL.createObjectURL, i.e. the pre-fix    |      render                  |   engine LocalImage |
//   state of f-20260906-09; CSP untouched.   |                              |   rendered on the   |
//   All three retained-engine assertions fail,|                              |   Engines page —    |
//   each printing its own line, and detached- |                              |   timed out waiting |
//   blob-CSP-rejection stays green — so the   |                              |   for the retained  |
//   two are not entangled.                   |                              |   engine portrait   |
//                                            |                              |   to render and     |
//                                            |                              |   decode            |
//                                            | retained-engine-data-url     | FAIL  … uses an     | 1
//                                            |                              |   image/png data    |
//                                            |                              |   URL — same detail |
//                                            | retained-engine-WebKitGTK-   | FAIL  … data URL    | 1
//                                            |   decode                     |                  |
//                                            |                              |   decodes in        |
//                                            |                              |   WebKitGTK — same  |
//                                            |                              |   detail            |
//   img-src gains `blob:` in tauri.conf.json,| detached-blob-CSP-rejection  | FAIL  the           | 1
//   production left correct. Exactly one     |      image URL               |   production CSP    |
//   check fails; all three retained-engine   |                              |   rejects a detached|
//   assertions stay green.                   |                              |   blob image URL    |
//                                            |                              |   with an img-src   |
//                                            |                              |   violation —       |
//                                            |                              |   {"timeout":true}  |
//
// Rows for the other assertions (all runs exited 1):
//   break                                   | assertion/message                              | exit
//   active-root retention removed and the   | FAIL  production startup reclaims unowned      | 1
//   disposable owned-root directory removed |   authority and preserves native-owned          |
//                                            |   authority; FAIL  startup authority             |
//                                            |   reconciliation deletes no user files          |
//   startup image reconciliation retired the | FAIL  trusted production startup preserves     | 1
//   retained fixture image                  |   owned images and cleans only the orphan       |
//   path capability was re-added and sound  | FAIL  the renderer cannot resolve a base        | 1
//   port returned 0                         |   directory (core:path grants are gone) —      |
//                                            |   /tmp/chessfable-verify-nKX32P/.local/share/  |
//                                            |   com.chessriddle.encroissant/x                 |
//                                            | FAIL  the renderer reaches a live loopback      |
//                                            |   sound-server port — 0                         |
//                                            | FAIL  the loopback sound server serves the      |
//                                            |   bundled standard move sound — fetch failed    |
//   index.html title changed and            | FAIL  the real renderer exposes the ChessFable  | 1
//   prepare_native_read returned Err         |   document title                               |
//                                            | FAIL  the native backend mints an opaque read   |
//                                            |   reservation — {"category":"invalid-input",   |
//                                            |   "message":"Invalid input: STAGED BREAK",     |
//                                            |   "tag":"backend-error"}                       |
//                                            | FAIL  the native backend acknowledges            |
//                                            |   reservation cancellation                      |
//                                            | FAIL  a cancelled reservation cannot be claimed  |
//                                            |   by a later native read — [object Object],     |
//                                            |   [object Object]                               |
//   non-startup attachment actions returned  | FAIL  real attachment IPC prepares the exact    | 1
//   Err                                     |   next durable owner set — {"category":         |
//                                            |   "message":"Invalid input: STAGED BREAK d",    |
//                                            |   "tag":"backend-error"}                       |
//                                            | FAIL  real attachment IPC retires the selected  |
//                                            |   managed image — {"category":"invalid-input", |
//                                            |   "message":"Invalid input: STAGED BREAK d",    |
//                                            |   "tag":"backend-error"}                       |
//   live-session retirement deleted bytes    | FAIL  retirement preserves image bytes for the  | 1
//   while retaining cleanup intent           |   live session and records cleanup intent       |
//   the stage-4 reservation break            | FAIL  a native read reservation is retained      | 1
//                                            |   until titlebar close — {"category":            |
//                                            |   "message":"Invalid input: STAGED BREAK",      |
//                                            |   "tag":"backend-error"}                       |
//                                            | FAIL  the real destroyed-window event cancels   |
//                                            |   the exact retained main-webview reservation    |
//   the three shutdown log lines were        | FAIL  the shutdown sequence started              | 1
//   renamed                                  | FAIL  the shutdown cleanup ran to completion    |
//                                            |   inside its budget                            |
//                                            | FAIL  the sound server shutdown was signalled    |
//   assertion close retained the app and    | FAIL  application pid 4078384 and recorded      | 1
//   first WebKit service process             |   WebKit service pids [4078409, 4078446] do not |
//                                            |   exist after the close — surviving pids:       |
//                                            |   4078384, 4078409                             |
//   shutdown skipped image cleanup           | FAIL  titlebar shutdown removes retired image    | 1
//                                            |   bytes and intent while retaining the owner    |
//
// Staged-failure record for the document-reload sweep (2026-10-05). The verifier stayed unchanged;
// src/index.tsx omitted only the startup releasePreviousDocumentOperations call, then pnpm build
// and pnpm verify:app ran against that binary. The source was restored byte-exact before the next
// break. This run reported 4 failed checks (the reload assertion and three NAG hint assertions).
//   break                                   | assertion/message                              | exit
//   applicationStartup omits the startup   | FAIL  a real document reload cancels the      | 1
//   reservation sweep                      |   previous document's retained reservation     |
//                                           |   timed out waiting for the reloaded renderer  |
//                                           |   and its previous-document reservation sweep  |
//
// Staged-failure record for post-reload reservation survival (2026-10-05). After render,
// src/index.tsx used a sessionStorage reload marker to schedule another sweep every 50 ms only in
// the reloaded document. pnpm build and pnpm verify:app read that binary with unchanged verifier
// logic. The reload and retained-ticket checks stayed green; the destroyed-window assertion
// printed its own FAIL line. The run reported 4 failed checks (that assertion and three NAG hint
// assertions). The temporary source was restored byte-exact and rebuilt before the final proof.
//   break                                   | assertion/message                              | exit
//   repeated reservation sweeps after      | FAIL  the real destroyed-window event cancels | 1
//   render in the reloaded document        |   the exact retained main-webview reservation  |
//
// Download-destination assertions (2026-09-22). Each staged break fails only its own assertion;
// the fixture or assertion argument was restored immediately after the run.
//   break                                   | assertion/message                              | exit
//   verify-download-destination entry      | FAIL  real IPC preserves the persisted          | 1
//   removed from the fixture                |   offline download destination                 |
//                                            |   false                                        |
//   assertion 2 receives the known id       | FAIL  real IPC rejects a fresh download         | 1
//                                            |   destination id                               |
//                                            |   true                                         |
//   assertion 3 receives the known id       | FAIL  real IPC rejects a database-root id       | 1
//                                            |   true                                         |
//
// Rows above are deliberately not inferred from collateral failures: the same assertion was
// retained only where its own FAIL line was printed. The "retain nothing" break printed the
// existing Files rows (seeded-row-render, double-click-route, and opened-game-notation) (and
// exited 1), because it reclaimed the Files workspace; it did not move the three startup
// assertions above.
//
// Staged-failure record for the Files checks (push-review-policy §2), one row per check. The
// double-click-route and opened-game-notation checks were red on 2026-09-19 against the unfixed release binary, in one run where every other
// check was ok; that run printed "2 check(s) failed" and exited with status 1.
// The seeded-row-render check was staged the same day on the fixed tree by a release build whose Files page rendered
// an empty tree ("3 check(s) failed", status 1); the file was restored and the rebuild ran green.
//   check                                   | message printed                                   | exit
//   seeded-row-render                        | FAIL  the seeded workspace file row renders on    | 1
//                                           |   the Files page — timed out waiting for the      |
//                                           |   Files row; (2) and (3) then print "not          |
//                                           |   attempted: the Files row never rendered"        |
//   double-click-route                        | FAIL  a real double-click on the unselected Files | 1
//                                           |   row navigates to / — timed out waiting for the  |
//                                           |   double-click to navigate to /; path is /files   |
//   opened-game-notation                      | FAIL  a real double-click on the unselected Files | 1
//                                           |   row shows its game — timed out waiting for the  |
//                                           |   opened game's notation; expected 1.e4e52.d4d5   |
//
// Metadata-edit staged failures (2026-10-07). Each break changed only production source read by
// pnpm build, followed by pnpm verify:app. A: write_workspace_file_metadata_blocking returned
// InvalidInput("STAGED metadata write refusal") before writing. B: FilesPage sent unchanged-name
// edits through renameWorkspaceFile with a "-staged-renamed" suffix. Both builds exited 0 and
// both verification runs printed "6 check(s) failed" and exited 1 (three Files and three NAG hint
// checks in each). A kept metadata-filename-preserved green; B kept metadata-dialog-no-error green.
// Both production files were confirmed clean before staging and restored with git checkout after
// their runs. An earlier option-lookup setup failure is excluded: it never reached the native break.
// The new scenario now follows the NAG checks to preserve their original navigation sequence;
// the four assertion bodies used for these measured failures are unchanged.
//   break | check                       | exact message printed                                              | exit
//   A     | metadata-dialog-no-error    | FAIL  the Files metadata edit submits without a dialog error        | 1
//         |                             |       The file operation could not be completed. Please try again.   |
//   B     | metadata-repertoire-filter  | FAIL  the Repertoire filter lists the metadata-edited workspace file | 1
//         |                             |       timed out waiting for verify-metadata-only Files row           |
//   A     | metadata-sidecar-type       | FAIL  the metadata-edited workspace sidecar records repertoire on disk | 1
//         |                             |       ENOENT: no such file or directory, open '/tmp/chessfable-verify-8rOp69/path-owner-fixture/files-workspace/verify-metadata-only.info' |
//   B     | metadata-filename-preserved | FAIL  the Files metadata edit preserves the PGN filename             | 1
//         |                             |       original PGN exists: false; PGN filenames: ["verify-metadata-only-staged-renamed.pgn","verify-nags.pgn","verify-practice-large.pgn","verify-sample.pgn"] |

// Staged-failure record for default-root-unusable (2026-10-03). Both full runs used the same
// harness inside a 4 GiB scope. The correct release printed 62 ok lines and "all checks passed",
// exit 0. Removing only the default-root label and rebuilding left all 61 existing checks green:
// "1 check(s) failed", exit 1. main.rs was restored byte-exact and the release rebuilt afterwards.
//   break                                   | assertion/message                              | exit
//   get_default_database_workspace removes | FAIL  default-root-unusable: the Databases     | 1
//   .map_err(Error::label_root_failure)     |   alert offers a visible folder chooser         |
//   from ensure_app_owned_default_dir      |   observed Databases alert: {"button":null,     |
//                                           |   "message":"Could not load databases. Please  |
//                                           |   try again.","buttonDisplayed":false}          |

// Staged-failure record for selected-root-missing (2026-10-04). Changing only resolve_active_root's
// refusal branch to Ok(None) and rebuilding left all 62 other checks green: "1 check(s) failed",
// exit 1. The verifier was unchanged. mod.rs was restored with git checkout, git status --short
// src-tauri was empty, and the correct release was rebuilt before the final green run.
//   break                                   | assertion/message                              | exit
//   resolve_active_root maps the refusal   | FAIL  selected-root-missing: the Databases     | 1
//   branch to Ok(None), the pre-fix         |   alert offers a visible folder chooser         |
//   behaviour                              |   without recreating db                         |
//                                           |   timed out waiting for the missing selected   |
//                                           |   database root alert; db exists: true          |

// Staged-failure record for the NAG checks (push-review-policy §2), 2026-10-03, one row per
// assertion. Three runs against a release binary the harness reads, with the same harness in all
// three: run A is the pre-fix baseline, and runs B1 and B2 each staged exactly one change. Run A
// used a pre-fix release binary (built 2026-10-03 from master before the lossless-NAG change):
// "7 check(s) failed", exit 1. Run B1 used a release build of 2f4dc8c4 whose only change was
// `opacity: 0` on the AnnotationHint glyph box: "1 check(s) failed", exit 1, so the hint path, hint
// title and $220 assertions are independent of it. Run B2 used a release build of 2f4dc8c4 whose
// only change was a no-op SAVE_FILE handler in BoardAnalysis.tsx: "5 check(s) failed" (the save
// assertion and its four dependants), exit 1. Both staged sources were restored and rebuilt clean
// afterwards.
//   check                                   | run | message printed                                | exit
//   hint-glyph-path                          | A   | FAIL  the $8 board hint is rendered with a    | 1
//                                           |     |   glyph path — observed board hint:           |
//                                           |     |   {"title":"",…}                               |
//   hint-title                               | A   | FAIL  the $8 board hint SVG title is □ —      | 1
//                                           |     |   observed board hint: {"title":"",…}         |
//   hint-visibility                          | B1  | FAIL  the $8 board hint has a visible box and | 1
//                                           |     |   positive opacity through its board          |
//                                           |     |   ancestors — observed board hint:            |
//                                           |     |   {"title":"□",…,"opacity":"0",…}             |
//   unknown-hint-absence                     | A   | FAIL  the unknown $220 renders no board       | 1
//                                           |     |   annotation hint — observed board hint:      |
//                                           |     |   {"title":"",…}                               |
//   saved-edit                               | B2  | FAIL  SAVE_FILE writes Nc3?! to the seeded NAG | 1
//                                           |     |   file — timed out waiting for the NAG file's |
//                                           |     |   saved Nc3?! edit; file changed: false       |
//   preserves-$8                             | A   | FAIL  the saved NAG game preserves $8 —       | 1
//                                           |     |   observed saved movetext: 1. e4 e5 2. d4!?   |
//                                           |     |   d5 3. Nc3?! *                                |
//   preserves-$11                            | A   | FAIL  the saved NAG game preserves $11 — same | 1
//                                           |     |   observed movetext                            |
//   preserves-d4!-$2                         | A   | FAIL  the saved NAG game preserves d4! $2 —   | 1
//                                           |     |   same observed movetext                       |
//   preserves-$220                           | A   | FAIL  the saved NAG game preserves $220 — same | 1
//                                           |     |   observed movetext                            |
// The NAG row lookup, double-click open, the three navigations and the Annotate-panel click are
// setup, not assertions: a setup failure prints FAIL on every dependent assertion above with
// "not attempted: <step>: <error>", as run B2 shows for the four preserves-* checks.

// Board-surface selector repair staging (f-20261005-07), 2026-10-09. The corrected verifier
// stayed byte-identical in all three runs. Each changed only one AnnotationHint renderer input,
// built the real release successfully (exit 0), then ran pnpm verify:app (exit 1, exactly one
// failure and 85 successes). In every run the other two $8 assertions, unknown-$220 absence
// and all NAG-save assertions stayed green. The 2026-10-03 evidence above remains historical.
//   check            | renderer input             | actual unique message printed                                      | exit
//   hint-glyph-path  | square glyph paths removed | FAIL  the $8 board hint is rendered with a glyph path               | 1
//   hint-title       | incorrect square title     | FAIL  the $8 board hint SVG title is □                              | 1
//   hint-visibility  | actual square badge opacity 0 | FAIL  the $8 board hint has a visible box and positive opacity through its board ancestors | 1
// Path run observed rendered=true, path=false, title=□, visible=true. Title run observed
// rendered=true, path=true, title="incorrect square title", visible=true. Opacity run observed
// rendered=true, path=true, title=□, visible=false, badge opacity="0" and all ancestor opacities="1".
// All three observed badge dimensions were 18 by 18.15625. Full observed ancestor JSON, complete
// output, source snapshots and named completion records are retained under:
// /tmp/build-a51461c5-317b-40c0-8297-ab16a2fc6904/phase-2-evidence/
//   path:    gate-phase2-path.3BVzvg/{log,completion.record}, AnnotationHint.path-staged.tsx
//   title:   gate-phase2-title.NDZGFb/{log,completion.record}, AnnotationHint.title-staged.tsx
//   opacity: gate-phase2-opacity.SF8Rs4/{log,completion.record}, AnnotationHint.opacity-staged.tsx
// Before each next stage, apply_patch restored the intended source byte-for-byte. All three
// restoration SHA-256 values were 1304089c32f62fed2f62e7cbb1340496d1ce22f6a08fc4641559c47f059e35b9.
// Evidence: {path,title,opacity}-restored.sha256, corresponding *-restoration-check.log files
// and AnnotationHint.intended.tsx. The corrected verifier's unchanged SHA-256 during staging
// was b90067266716202d90f88c27f66d0faa8199d7bc8f3667cafbda69989108e198 (intended.sha256).

// Staged-failure record for the file-freshness checks (2026-09-25). Each break was restored
// before the next run. The in-place row replaced the file by rename. The read row did not
// install the recorder. The apply row set the ceiling to 0. The withhold row deleted the PGN
// after the in-place write. The conditional Reload check is not on the clean-tree path, so
// this run did not enter it.
//   break                                   | assertion/message                              | exit
//   rename over the open PGN                | FAIL  the stale-file scenario rewrites the PGN | 1
//                                           |   in place — inode changed from 92699786 to    |
//                                           |   92703392                                     |
//   recorder not installed                  | FAIL  the file freshness transition includes a | 1
//                                           |   measured native read_game call — read_game   |
//                                           |   duration: null                               |
//   apply ceiling 0                         | FAIL  the freshness transition applies within  | 1
//                                           |   0 ms of the measured read — apply duration:  |
//                                           |   448.0 ms; read_game duration: 9.0 ms         |
//   PGN removed after the in-place write    | FAIL  the open file-backed tab reloads or      | 1
//                                           |   withholds the changed PGN — freshness state: |
//                                           |   unavailable                                  |

// Staged-failure record for the practice checks (2026-09-23). Each break was made in the
// release artifact, rebuilt, run inside the 4 GiB scope, and restored with a clean rebuild.
// The sync assertion now records a failed wait through the assertion helper so its own FAIL line and the final
// count FAIL line remain independently visible.
//   break                                   | assertion/message                              | exit
//   native positions snapshot drops one    | FAIL  the native practice read returns all     | 1
//   seeded position                        |   12,000 seeded positions                      |
//   review paging omits the oldest entry   | FAIL  native practice review paging returns    | 1
//                                           |   every seeded entry and reaches the oldest    |
//                                           |   review                                        |
//   migration command refuses the legacy   | FAIL  the legacy practice deck is migrated    | 1
//   document                               |   into the native store through real IPC       |
//   renderer rating also writes a          | FAIL  renderer ratings create no new legacy   | 1
//   deck-id-game key                        |   key and do not grow the existing key         |
//   sync command acknowledges without      | FAIL  the real sync path stores 500 further    | 1
//   writing                                |   repertoire positions; FAIL  final restart   |
//                                           |   preserves exact native position and review   |
//                                           |   counts for both decks                         |
//   post-rating review page omits one      | FAIL  fifty renderer ratings land in the      | 1
//   seeded entry at revision 100051         |   native practice review store                 |
//   post-rating deck snapshot omits one    | FAIL  renderer ratings do not alter the       | 1
//   position at revision 100051             |   large deck's 12,000 native positions         |
//   panel maps Good (3) to Hard (2)         | FAIL  the 50 new native reviews record the    | 1
//                                           |   panel's Good rating — ratings: [2, ...]      |
//   loading/read-failed sync reset removed | FAIL  the real sync path stores 500 further    | 1
//                                           |   repertoire positions; FAIL  final restart   |
//                                           |   preserves exact native position and review   |
//                                           |   counts for both decks                         |
//
// The native position/review/migration breaks were grouped once and aborted at the disabled
// practice prerequisite after their own FAIL lines; the renderer-writer break reached its own
// key assertion and then aborted in the extended-sync wait. Those observed aborts are listed
// below rather than inferred as additional assertion evidence.

// ARGUED, NOT STAGED. These assertions have no row because the only available break aborts before
// their check (or requires editing this verifier):
//   assertion                              | reason observed
//   the real Tauri IPC bridge is present   | Removing the bridge from the bundled renderer made
//                                         | the seed run abort at "timed out waiting for seed
//                                         | window controls", before any assertion line.
//   the custom title bar rendered its     | Removing the controls made the same prerequisite
//   window controls                       | wait abort at "timed out waiting for seed window
//                                         | controls". Once that wait succeeds, its probe can
//                                         | return only "label" or "fallback", both accepted
//                                         | by the assertion; making it fail would edit the
//                                         | verifier or abort the prerequisite.
//   the application process is running    | A binary that exited during setup made the run abort
//   before the close                     | at "WebDriver session creation failed: This operation
//                                         | was aborted". The close helper reads appProcesses()
//                                         | and throws if no application exists before it can
//                                         | call this check, so a dead application cannot print
//                                         | this assertion's FAIL line.
//
// Abort-only attempts are not rows: the break described as "unconditional startup attachment error"
// aborted at "timed out waiting for production startup to reconcile the seeded path registry";
// the break described as "managed-image cleanup intent" then aborted at
// "timed out waiting for the managed-image cleanup intent" after its two rows. A first
// process-survival break also aborted at "seed processes survived close: 4062332, 4062375" before
// the assertion session. A first image-cleanup break left all checks green because startup never
// put the retained image through that cleanup path; it was restored and replaced by the staged
// startup-retirement break above. None of these aborts is cited as assertion evidence.
//
// Practice staged-break aborts:
//   assertion                              | reason observed
//   migration capability retention         | The migration refusal left the final retained-owner
//                                         | startup prerequisite unsatisfied before final
//                                         | inventory/count checks; its direct migration FAIL
//                                         | is recorded above.
//   legacy-key untouched                   | No binary-only break can delete a browser key;
//                                         | doing so would edit this verifier's WebDriver
//                                         | fixture or stage the explicitly excluded key
//                                         | deletion behavior.
//   final native inventory and migrated   | The migration refusal aborts final practice
//   counts                                 | retention startup before those checks; the sync
//                                         | break independently reached and failed final
//                                         | exact counts while inventory and migrated counts
//                                         | remained green.
//   legacy capability after key removal   | Dropping this exact id from the native inventory
//                                         | contribution makes the app drop its owner after
//                                         | the browser key is removed, but the kept
//                                         | reopenAssertionSession wait aborts first at
//                                         | "legacy-key removal startup to retain practice
//                                         | capabilities" (exit 1), before the retention
//                                         | assertion can print a FAIL line. Reaching the
//                                         | assertion would require changing that kept
//                                         | verifier wait, so no binary-only independent row
//                                         | is possible.

```
