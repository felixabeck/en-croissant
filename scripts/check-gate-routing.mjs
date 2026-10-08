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
import { readFile, stat } from "node:fs/promises";
import { resolve, sep } from "node:path";
import { globToRegExp, matches } from "./coverage-scope.mjs";
import { isEntrypoint } from "./entrypoint.mjs";
import { GATES } from "./gate-receipt.mjs";
import {
  PRE_REVIEW_GATE_SCHEDULE,
  PUSH_GATE_SCHEDULE,
  preReviewGateScheduleCommands,
  pushGateScheduleCommands,
} from "./run-push-gates.mjs";
import { listWorkingTreeFiles } from "./working-tree-files.mjs";

const PUSH_SKILL = ".claude/skills/push/SKILL.md";
const PACKAGE_JSON = "package.json";
const TEST_WORKFLOW = ".github/workflows/test.yml";
const VITE_CONFIG = "vite.config.ts";
const CONTRACT_GATE = "gates:contract:check";
// The strict launcher takes the machine-wide heavy-gate lock and its own agents.slice scope;
// it fails closed, nests in place, and permits no command -v fallback (d-20261002-01).
const GATE_LAUNCHER = "agent-gate";
const GATE_RUNNER_SCRIPTS = Object.freeze({
  "gates:push": `${GATE_LAUNCHER} node scripts/run-push-gates.mjs`,
  "checks:pre-review": `${GATE_LAUNCHER} node scripts/run-push-gates.mjs --pre-review`,
  "gate:ensure": `${GATE_LAUNCHER} node scripts/gate-receipt.mjs ensure`,
  "gate:run": `${GATE_LAUNCHER} node scripts/gate-receipt.mjs run`,
});
const PUSH_GATE_INVOCATION = "pnpm gates:push -- <blocks>";
const PRE_REVIEW_SECTION = "## 2a. Pre-review checks";
const PRE_REVIEW_INVOCATION = "pnpm checks:pre-review";
const PUSH_GATE_SECTIONS = Object.freeze([
  "### Unconditional contract gate",
  "### Rust/Tauri backend",
  "### TypeScript/React frontend",
  "### Cross-layer contracts",
  "### Findings ledger",
]);
// The kit-parity gate must run the RELEASED kit. `kit` on PATH resolves to
// $HOME/.local/share/agent-kit/current/bin/kit, an immutable release worktree
// that only a gated agent-kit push publishes. A script spelling out a path into
// ~/Projekte/agent-kit would run whatever is saved in that checkout right now,
// including half-written edits, which is what the release channel exists to keep
// out of this gate. Reachability alone does not catch that, so it is asserted here.
const KIT_PARITY_SCRIPT = "findings:kit:check";
const KIT_PARITY_COMMAND = "env -u KIT_ROOT kit sync --check .";
const KIT_WORKBENCH_PATH = "Projekte/agent-kit";
// Policy presence only. These selectors do not prove model obedience or runtime scheduling.
// Compiler and runtime gates cannot prove the placement of maintained Markdown commands.
const GATE_PLACEMENTS = Object.freeze([
  { script: "test:coverage", heading: "### TypeScript/React frontend" },
  { script: "coverage:frontend:check", heading: "### TypeScript/React frontend" },
  { script: "build-vite", heading: "### TypeScript/React frontend" },
  { script: "bindings:check", heading: "### Cross-layer contracts" },
  { script: "bundle:check", heading: "### TypeScript/React frontend" },
  { script: "test:e2e:container", heading: "### TypeScript/React frontend" },
  { script: "mutation:frontend", heading: "### TypeScript/React frontend" },
  { script: "test:coverage:backend", heading: "### Rust/Tauri backend" },
  { script: "coverage:backend:check", heading: "### Rust/Tauri backend" },
  { command: "bash scripts/setup-rust.sh", heading: "### Rust/Tauri backend" },
  {
    command: "cargo fmt --manifest-path src-tauri/Cargo.toml -- --check",
    heading: "### Rust/Tauri backend",
  },
  {
    command:
      "cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets --locked -- -D warnings",
    heading: "### Rust/Tauri backend",
  },
  { command: "pnpm rust:windows:check", heading: "### Rust/Tauri backend" },
  { command: "pnpm gate:ensure backend-test", heading: "### Rust/Tauri backend" },
  { command: "env -u KIT_ROOT pnpm findings:kit:check", heading: "### Findings ledger" },
]);
// CI membership is independent of placement. Local commands may also occur in CI.
const CI_REQUIRED_SCRIPTS = new Set([
  "test:coverage",
  "coverage:frontend:check",
  "build-vite",
  "bindings:check",
  "bundle:check",
  "test:e2e:container",
  "mutation:frontend",
  "test:coverage:backend",
  "coverage:backend:check",
]);

const ALLOWED_CARGO_COMMANDS = new Set(["fmt", "check", "clippy", "test"]);
// This closed list mirrors the repository's deliberate test naming conventions:
// node:test uses *-tests.mjs, Vitest uses *.test.mjs, Python uses *-tests.py or
// *_test.py, and shell tests use *-tests.sh. Keeping it closed prevents arbitrary
// script names from being silently treated as tests instead of routed tools.
const TEST_FILE_PATTERNS = [
  "scripts/*-tests.mjs",
  "scripts/*.test.mjs",
  "scripts/*-tests.py",
  "scripts/*_test.py",
  "scripts/*-tests.sh",
];
const SCRIPT_RUNNERS = new Set(["node", "python", "python3", "bash", "sh"]);

export function fencedBlocks(markdown) {
  const blocks = [];
  const pattern = /^```([^\n]*)\n([\s\S]*?)^```\s*$/gmu;
  for (const match of markdown.matchAll(pattern)) {
    blocks.push({ language: match[1].trim(), contents: match[2] });
  }
  return blocks;
}

// pnpm subcommands that take a PACKAGE or a path, not a script name. Without this
// set, `pnpm dlx shellcheck@4.1.0` resolves as a nested script called "dlx" and the
// checker reports a missing script that was never referenced. Leading flags are
// skipped for the same reason: `pnpm -s lint:ci` must resolve to lint:ci, not "-s".
const PNPM_SUBCOMMANDS = new Set([
  "add",
  "audit",
  "bin",
  "config",
  "create",
  "dedupe",
  "deploy",
  "dlx",
  "env",
  "exec",
  "fetch",
  "import",
  "init",
  "install",
  "licenses",
  "link",
  "ls",
  "list",
  "outdated",
  "pack",
  "patch",
  "patch-commit",
  "prune",
  "publish",
  "rebuild",
  "recursive",
  "remove",
  "root",
  "server",
  "setup",
  "store",
  "unlink",
  "update",
  "why",
]);

export function pnpmReferences(command) {
  const matches = [
    ...command.matchAll(/(?:^|[;&|]\s*|\s)pnpm((?:\s+-{1,2}[\w-]+)*)(?:\s+run)?\s+([\w:@.-]+)/gu),
  ];
  return matches
    .map((match) => match[2])
    .filter((name) => !PNPM_SUBCOMMANDS.has(name) && !name.startsWith("-"));
}

function unquoteYamlScalar(value) {
  if (value.length >= 2 && value.startsWith('"') && value.endsWith('"')) {
    const scalar = value.slice(1, -1);
    const backslash = String.fromCodePoint(92);
    let decoded = "";
    for (let index = 0; index < scalar.length; index += 1) {
      if (scalar[index] !== backslash) {
        decoded += scalar[index];
        continue;
      }
      const escape = scalar[index + 1];
      if (escape === String.fromCodePoint(34) || escape === backslash) decoded += escape;
      else if (escape === "n") decoded += "\n";
      else if (escape === "t") decoded += "\t";
      else {
        const length = { x: 2, u: 4, U: 8 }[escape];
        const hexadecimal = scalar.slice(index + 2, index + 2 + (length ?? 0));
        const valid = length !== undefined && /^[0-9a-fA-F]+$/u.test(hexadecimal);
        if (!valid || hexadecimal.length !== length) {
          return {
            error: `unsupported YAML escape in run: ${backslash}${escape ?? ""}`,
            value,
          };
        }
        const codePoint = Number.parseInt(hexadecimal, 16);
        if (codePoint > 0x10ffff) {
          return {
            error: `unsupported YAML escape in run: ${backslash}${escape}${hexadecimal}`,
            value,
          };
        }
        decoded += String.fromCodePoint(codePoint);
        index += length;
      }
      index += 1;
    }
    return { value: decoded };
  }
  if (value.length >= 2 && value.startsWith("'") && value.endsWith("'")) {
    return { value: value.slice(1, -1).replaceAll("''", "'") };
  }
  return { value };
}

export function workflowSteps(workflow) {
  const steps = [];
  const lines = workflow.split(/\r?\n/u);
  for (let index = 0; index < lines.length; index += 1) {
    const item = /^(\s*)-\s+(.*)$/u.exec(lines[index]);
    if (!item) continue;
    const indentation = item[1].length;
    const block = [{ line: item[2], index }];
    let end = index + 1;
    while (end < lines.length) {
      const next = lines[end];
      if (next.trim() && next.match(/^\s*/u)[0].length <= indentation) break;
      block.push({ line: next.slice(indentation + 2), index: end });
      end += 1;
    }

    const name = block.find(({ line }) => /^name:\s*/u.test(line))?.line.replace(/^name:\s*/u, "");
    const runEntry = block.find(({ line }) => /^run:\s*/u.test(line));
    if (!runEntry) continue;
    const runValue = runEntry.line.replace(/^run:\s*/u, "");
    const decodedRun = unquoteYamlScalar(runValue);
    let run = decodedRun.value;
    const scalar = /^([|>])(?:[0-9][-+]?|[-+]?[0-9]?)$/u.exec(runValue);
    if (scalar) {
      const runLineIndentation = lines[runEntry.index].match(/^\s*/u)[0].length;
      const commandLines = [];
      for (let lineIndex = runEntry.index + 1; lineIndex < end; lineIndex += 1) {
        const line = lines[lineIndex];
        if (line.trim() && line.match(/^\s*/u)[0].length <= runLineIndentation) break;
        commandLines.push(line.trim());
      }
      run = commandLines.join(scalar[1] === "|" ? "\n" : " ").trim();
    }
    const ifValue = block
      .find(({ line }) => /^if:\s*/u.test(line))
      ?.line.replace(/^if:\s*/u, "")
      .trim();
    const continueOnError = block
      .find(({ line }) => /^continue-on-error:\s*/u.test(line))
      ?.line.replace(/^continue-on-error:\s*/u, "")
      .trim();
    const shell = block
      .find(({ line }) => /^shell:\s*/u.test(line))
      ?.line.replace(/^shell:\s*/u, "")
      .trim();
    steps.push({
      name: name ?? "",
      run,
      runError: decodedRun.error,
      hasIf: ifValue !== undefined,
      ifValue,
      continueOnError,
      shell,
    });
  }
  return steps;
}

export function workflowJobs(workflow) {
  const jobs = [];
  const lines = workflow.split(/\r?\n/u);
  const jobsIndex = lines.findIndex((line) => /^\s*jobs:\s*$/u.test(line));
  if (jobsIndex < 0) return jobs;
  const jobsIndentation = lines[jobsIndex].match(/^\s*/u)[0].length;
  for (let index = jobsIndex + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (line.trim() && line.match(/^\s*/u)[0].length <= jobsIndentation) break;
    const job = new RegExp(`^\\s{${jobsIndentation + 2}}([\\w.-]+):\\s*$`, "u").exec(line);
    if (!job) continue;
    const indentation = jobsIndentation + 2;
    let end = index + 1;
    while (end < lines.length) {
      const next = lines[end];
      if (next.trim() && next.match(/^\s*/u)[0].length <= indentation) break;
      end += 1;
    }
    const properties = lines
      .slice(index + 1, end)
      .filter(
        (candidate) => candidate.trim() && candidate.match(/^\s*/u)[0].length === indentation + 2,
      );
    const valueFor = (key) =>
      properties
        .find((property) => new RegExp(`^\\s+${key}:\\s*`, "u").test(property))
        ?.replace(new RegExp(`^\\s+${key}:\\s*`, "u"), "")
        .trim();
    jobs.push({
      name: job[1],
      body: lines.slice(index + 1, end).join("\n"),
      ifValue: valueFor("if"),
      continueOnError: valueFor("continue-on-error"),
    });
    index = end - 1;
  }
  return jobs;
}

function testIncludes(viteConfig) {
  const testBlock = /test\s*:\s*\{[\s\S]*?include\s*:\s*\[([\s\S]*?)\]/u.exec(viteConfig);
  if (!testBlock) return [];
  return [...testBlock[1].matchAll(/["']([^"']+)["']/gu)].map((match) => match[1]);
}

function reviewPathGlobPatterns(pushSkill) {
  const bounded = markdownSection(pushSkill, (heading) => /^## 3\./u.test(heading));
  if (!bounded) throw new Error(`${PUSH_SKILL} has no unambiguous "## 3." section`);
  // EVERY text block in the review section is a path-glob list: the sensitive-path
  // registry that sets the review tier, and any mandatory-lens path list beside it.
  // All of them are validated. An earlier version demanded exactly ONE block, which
  // coupled "the glob registry" to "the only fenced text here" and broke the moment a
  // second, entirely legitimate list was added.
  const blocks = fencedBlocks(bounded).filter((block) => block.language === "text");
  if (blocks.length === 0) {
    throw new Error(`${PUSH_SKILL} has no path-glob text block in its "## 3." section`);
  }
  return blocks.flatMap((block) =>
    block.contents
      .split(/\r?\n/u)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#")),
  );
}

function receiptReferences(command) {
  return [
    ...command.matchAll(
      /(?:^|[;&|]\s*|\s)pnpm(?:\s+-{1,2}[\w-]+)*(?:\s+run)?\s+(gate:(?:ensure|run|check))\s+([\w.-]+)/gu,
    ),
  ].map((match) => ({ script: match[1], gate: match[2] }));
}

function routeCommands(commands, scripts, findings) {
  const routed = new Set();
  const pending = [];
  const enqueue = (command, source) => {
    pending.push(...pnpmReferences(command).map((name) => ({ name, source })));
    for (const { gate } of receiptReferences(command)) {
      if (!(gate in GATES)) {
        findings.push(
          `unknown receipt gate ${gate} in ${source}; register it in scripts/gate-receipt.mjs GATES or use a registered gate`,
        );
        continue;
      }
      pending.push(...pnpmReferences(GATES[gate]).map((name) => ({ name, source })));
    }
  };
  for (const { command, source } of commands) enqueue(command, source);

  while (pending.length > 0) {
    const { name, source } = pending.shift();
    if (!(name in scripts)) {
      findings.push(`${source} invokes missing package script ${name}`);
      continue;
    }
    if (routed.has(name)) continue;
    routed.add(name);
    enqueue(scripts[name], `package script ${name}`);
  }
  return routed;
}

function validateGateCommands(
  pushSkill,
  scripts,
  repoRoot,
  preReviewCommands = new Set(preReviewGateScheduleCommands()),
) {
  const findings = [];
  const directGateCommands = shellFencedCommandLines(pushSkill);
  const routedCommands = [];

  for (const line of directGateCommands) {
    const pnpmScripts = pnpmReferences(line);
    if (pnpmScripts.length > 0) {
      routedCommands.push({ command: line, source: `${PUSH_SKILL}: ${line}` });
      continue;
    }
    const cargo = /^cargo\s+(\w+)/u.exec(line);
    if (cargo && ALLOWED_CARGO_COMMANDS.has(cargo[1])) continue;
    if (/^pnpm\s+exec\s+/u.test(line) && preReviewCommands.has(line)) continue;
    const words = shellWords(line);
    if (SCRIPT_RUNNERS.has(words[0]) && words[1]) {
      const target = resolve(repoRoot, words[1]);
      const scriptsDirectory = resolve(repoRoot, "scripts");
      if (target !== scriptsDirectory && !target.startsWith(`${scriptsDirectory}${sep}`)) {
        findings.push(`gate command escapes scripts/: ${line}; use a path inside scripts/`);
      }
      continue;
    }
    findings.push(`unresolved gate command in ${PUSH_SKILL}: ${line}`);
  }

  const routed = routeCommands(routedCommands, scripts, findings);
  return { directGateCommands, findings, routed };
}

// Returns the §2 text before the first path-scoped subsection. When the
// "Unconditional contract gate" subsection comes first, it is included.
function contractGateHome(pushSkill) {
  const bounded = markdownSection(pushSkill, (heading) => /^## 2\./u.test(heading));
  const firstSubsection =
    markdownHeadings(bounded).find((heading) => heading.level === 3)?.start ?? -1;
  if (firstSubsection < 0) return bounded;
  const subsection = bounded.slice(firstSubsection);
  if (markdownHeadings(subsection)[0]?.text !== "### Unconditional contract gate") {
    return bounded.slice(0, firstSubsection);
  }
  const nextSubsection = markdownHeadings(subsection).find(
    (heading) => heading.level === 3 && heading.start > 0,
  );
  return nextSubsection ? bounded.slice(0, firstSubsection + nextSubsection.start) : bounded;
}

// Only standalone headings outside code fences establish section identity.
function markdownHeadings(markdown) {
  const headings = [];
  let fence;
  let start = 0;
  for (const line of markdown.split(/(?<=\n)/u)) {
    const text = line.trimEnd();
    const delimiter = /^ {0,3}(`{3,}|~{3,})(.*)$/u.exec(text);
    if (fence) {
      if (
        delimiter &&
        delimiter[1][0] === fence[0] &&
        delimiter[1].length >= fence.length &&
        !delimiter[2].trim()
      )
        fence = undefined;
    } else if (delimiter) {
      fence = delimiter[1];
    } else {
      const heading = /^(#{2,3}) .+$/u.exec(text);
      if (heading) headings.push({ text, level: heading[1].length, start });
    }
    start += line.length;
  }
  return headings;
}

function markdownSection(markdown, matchesHeading, { level = 2, stopAtSubsection = false } = {}) {
  const headings = markdownHeadings(markdown);
  const homes = headings.filter(
    (heading) => heading.level === level && matchesHeading(heading.text),
  );
  if (homes.length !== 1) return "";
  const home = homes[0];
  const end = headings.find(
    (heading) => (stopAtSubsection || heading.level <= level) && heading.start > home.start,
  )?.start;
  return markdown.slice(home.start, end);
}

function skillSubsection(pushSkill, heading) {
  const section = markdownSection(pushSkill, (text) => /^## 2\./u.test(text));
  return markdownSection(section, (text) => text === heading, { level: 3 });
}

function shellFencedCommandLines(markdown, { includeCommentLines = false } = {}) {
  return fencedBlocks(markdown)
    .filter((block) => ["bash", "sh", "shell"].includes(block.language))
    .flatMap((block) =>
      block.contents
        .split(/\r?\n/u)
        .map((line) => line.trim())
        .filter((line) => line && (includeCommentLines || !line.startsWith("#"))),
    );
}

function pushSkillPreamble(pushSkill) {
  const bounded = markdownSection(pushSkill, (heading) => /^## 2\./u.test(heading));
  const firstSubsection =
    markdownHeadings(bounded).find((heading) => heading.level === 3)?.start ?? -1;
  return firstSubsection < 0 ? bounded : bounded.slice(0, firstSubsection);
}

export function validatePushGateSchedule(pushSkill, contractRouted, schedule = PUSH_GATE_SCHEDULE) {
  const findings = [];
  const preambleLines = shellFencedCommandLines(pushSkillPreamble(pushSkill));
  const invocations = preambleLines.filter((line) => line === PUSH_GATE_INVOCATION);
  if (invocations.length !== 1) {
    findings.push(
      `${PUSH_SKILL} §2 must fence ${PUSH_GATE_INVOCATION} exactly once in its preamble`,
    );
  }

  const fencedLines = new Set(
    PUSH_GATE_SECTIONS.flatMap((heading) =>
      shellFencedCommandLines(skillSubsection(pushSkill, heading)),
    ),
  );
  const runnerCommands = pushGateScheduleCommands(schedule);
  findings.push(
    ...compareScheduleToFence(runnerCommands, fencedLines, {
      runnerCommandIsCovered(command) {
        const references = pnpmReferences(command);
        return references.length > 0 && references.every((name) => contractRouted.has(name));
      },
      missingFenceMessage: (command) =>
        `push gate runner command is neither an exact fenced line nor a ${CONTRACT_GATE} member: ${command}`,
      extraFenceMessage: (command) =>
        `fenced §2 gate command is not run by the push gate runner: ${command}`,
    }),
  );
  return findings;
}

export function validatePreReviewGateSchedule(pushSkill, schedule = PRE_REVIEW_GATE_SCHEDULE) {
  const findings = [];
  const section = markdownSection(pushSkill, (heading) => heading === PRE_REVIEW_SECTION, {
    stopAtSubsection: true,
  });
  if (!section) {
    findings.push(`${PUSH_SKILL} must contain ${PRE_REVIEW_SECTION}`);
    return findings;
  }
  const fencedLines = shellFencedCommandLines(section);
  const invocations = fencedLines.filter((line) => line === PRE_REVIEW_INVOCATION);
  if (invocations.length !== 1) {
    findings.push(
      `${PUSH_SKILL} ${PRE_REVIEW_SECTION} must fence ${PRE_REVIEW_INVOCATION} exactly once`,
    );
  }

  const runnerCommands = preReviewGateScheduleCommands(schedule);
  const laneCommands = fencedLines.filter((line) => line !== PRE_REVIEW_INVOCATION);
  findings.push(
    ...compareScheduleToFence(runnerCommands, laneCommands, {
      missingFenceMessage: (command) =>
        `pre-review runner command is not fenced in ${PRE_REVIEW_SECTION}: ${command}`,
      extraFenceMessage: (command) =>
        `fenced pre-review command is not run by the scheduler: ${command}`,
    }),
  );
  return findings;
}

function compareScheduleToFence(
  runnerCommands,
  fencedCommands,
  { runnerCommandIsCovered = () => false, missingFenceMessage, extraFenceMessage },
) {
  const findings = [];
  const fenced = new Set(fencedCommands);
  const scheduled = new Set(runnerCommands);
  for (const command of runnerCommands) {
    if (fenced.has(command) || runnerCommandIsCovered(command)) continue;
    findings.push(missingFenceMessage(command));
  }
  for (const command of fenced) {
    if (!scheduled.has(command)) findings.push(extraFenceMessage(command));
  }
  return findings;
}

function validateGateRunnerScripts(scripts) {
  const findings = [];
  for (const [name, expected] of Object.entries(GATE_RUNNER_SCRIPTS)) {
    const actual = scripts[name];
    if (typeof actual === "string" && actual.trim() === expected) continue;
    findings.push(
      `package.json ${name} must invoke ${expected}; found ${JSON.stringify(actual ?? "<missing>")}`,
    );
  }
  return findings;
}

async function scriptFiles(repoRoot, listedPaths) {
  const files = [];
  for (const path of listedPaths) {
    if (!path.startsWith("scripts/")) continue;
    const absolute = resolve(repoRoot, path);
    let metadata;
    try {
      metadata = await stat(absolute);
    } catch (error) {
      if (error?.code === "ENOENT") continue;
      throw error;
    }
    if (!metadata.isFile()) continue;
    files.push({ executable: (metadata.mode & 0o111) !== 0, path });
  }
  return files;
}

function shellWords(command) {
  return [...command.matchAll(/"(?:\\.|[^"])*"|'[^']*'|[^\s]+/gu)].map((match) => {
    const word = match[0];
    return /^(["']).*\1$/su.test(word) ? word.slice(1, -1) : word;
  });
}

function commandSegments(command) {
  return command
    .split(/&&|\|\||[;|\n]/u)
    .map((segment) => segment.trim())
    .filter(Boolean);
}

function invokesGate(command, repoRoot) {
  if (pnpmReferences(command).length > 0) return true;
  const scriptsDirectory = resolve(repoRoot, "scripts");
  return commandSegments(command).some((segment) => {
    const words = shellWords(segment);
    if (words.length === 0) return false;
    const executable = words[0].replace(/^\.\//u, "");
    if (executable === "cargo" && ALLOWED_CARGO_COMMANDS.has(words[1])) return true;
    if (executable.startsWith("scripts/")) return true;
    if (!SCRIPT_RUNNERS.has(executable) || !words[1]) return false;
    const target = resolve(repoRoot, words[1]);
    return target === scriptsDirectory || target.startsWith(`${scriptsDirectory}${sep}`);
  });
}

function invokesScript(command, path) {
  for (const segment of commandSegments(command)) {
    const words = shellWords(segment);
    if (words.length === 0) continue;
    const executable = words[0].replace(/^\.\//u, "");
    if (executable === path) return true;
    if (SCRIPT_RUNNERS.has(executable) && words.slice(1).includes(path)) return true;
  }
  return false;
}

function defaultListFiles(repoRoot, pathspec = ".") {
  return listWorkingTreeFiles({ workspaceRoot: repoRoot, pathspec });
}

export async function checkGateRouting(
  repoRoot,
  { paths = undefined, listFiles = defaultListFiles } = {},
) {
  const listed = listFiles(repoRoot);
  const [packageText, pushSkill, workflow, viteConfig, files] = await Promise.all([
    readFile(resolve(repoRoot, PACKAGE_JSON), "utf8"),
    readFile(resolve(repoRoot, PUSH_SKILL), "utf8"),
    readFile(resolve(repoRoot, TEST_WORKFLOW), "utf8"),
    readFile(resolve(repoRoot, VITE_CONFIG), "utf8"),
    scriptFiles(repoRoot, listed),
  ]);
  const scripts = JSON.parse(packageText).scripts ?? {};
  const { directGateCommands, findings, routed } = validateGateCommands(
    pushSkill,
    scripts,
    repoRoot,
  );
  findings.push(...validateGateRunnerScripts(scripts));

  if (!(CONTRACT_GATE in scripts)) {
    findings.push(`package.json is missing ${CONTRACT_GATE}; add the shared contract chain`);
  }

  // Only the CONTENT is asserted here. A missing script is already caught by the
  // routing rule above: the push skill invokes `pnpm findings:kit:check`, and a
  // command naming a package script that does not exist is reported there. A
  // second missing-script rule would duplicate it and would fire on fixtures
  // that legitimately model only part of the manifest.
  const kitParity = scripts[KIT_PARITY_SCRIPT];
  if (typeof kitParity === "string") {
    if (kitParity.trim() !== KIT_PARITY_COMMAND) {
      findings.push(
        `${KIT_PARITY_SCRIPT} must be exactly ${KIT_PARITY_COMMAND}, not ${kitParity}; ` +
          "the gate runs the released kit on PATH",
      );
    }
    if (kitParity.includes(KIT_WORKBENCH_PATH)) {
      findings.push(
        `${KIT_PARITY_SCRIPT} names the kit workbench path ${KIT_WORKBENCH_PATH}; ` +
          "use the released kit on PATH so an unreleased edit cannot reach this gate",
      );
    }
  }
  if (pushSkill.includes(`${KIT_WORKBENCH_PATH}/bin/kit`)) {
    findings.push(
      `${PUSH_SKILL} names the kit workbench driver ${KIT_WORKBENCH_PATH}/bin/kit; ` +
        "the kit-parity gate runs the released kit on PATH",
    );
  }

  const skillContractReferences = directGateCommands.flatMap((command) =>
    pnpmReferences(command).filter((name) => name === CONTRACT_GATE),
  );
  const preambleContractReferences = fencedBlocks(contractGateHome(pushSkill))
    .filter((block) => ["bash", "sh", "shell"].includes(block.language))
    .flatMap((block) => pnpmReferences(block.contents))
    .filter((name) => name === CONTRACT_GATE);
  if (skillContractReferences.length !== 1 || preambleContractReferences.length !== 1) {
    findings.push(
      `${CONTRACT_GATE} must be fenced exactly once in the ${PUSH_SKILL} §2 preamble; add or move its sole fence there`,
    );
  }

  const steps = workflowSteps(workflow);
  for (const step of steps) {
    if (step.runError) findings.push(step.runError);
  }
  for (const job of workflowJobs(workflow)) {
    if (job.ifValue !== undefined) {
      findings.push(
        `${TEST_WORKFLOW} workflow job has if: ${JSON.stringify(job.ifValue)}: ${job.name}`,
      );
    }
    if (job.continueOnError !== undefined && job.continueOnError !== "false") {
      findings.push(
        `${TEST_WORKFLOW} workflow job has continue-on-error: ${JSON.stringify(job.continueOnError)}: ${job.name}`,
      );
    }
  }
  const workflowContractSteps = steps.filter((step) =>
    pnpmReferences(step.run).includes(CONTRACT_GATE),
  );
  if (workflowContractSteps.length !== 1) {
    findings.push(
      `${TEST_WORKFLOW} must run ${CONTRACT_GATE} exactly once; replace duplicate tooling steps with one contract-gate step`,
    );
  } else if (workflowContractSteps[0].run.trim() !== `pnpm ${CONTRACT_GATE}`) {
    findings.push(`${TEST_WORKFLOW} contract-gate step must be exactly pnpm ${CONTRACT_GATE}`);
  }

  const workflowCommands = steps.map((step) => step.run);
  const workflowFindings = [];
  const workflowRouted = routeCommands(
    workflowCommands.map((command) => ({ command, source: TEST_WORKFLOW })),
    scripts,
    workflowFindings,
  );
  findings.push(...workflowFindings);

  const contractFindings = [];
  const contractRouted =
    CONTRACT_GATE in scripts
      ? routeCommands(
          [{ command: `pnpm ${CONTRACT_GATE}`, source: `package script ${CONTRACT_GATE}` }],
          scripts,
          contractFindings,
        )
      : new Set();
  findings.push(...contractFindings);
  contractRouted.delete(CONTRACT_GATE);
  findings.push(...validatePushGateSchedule(pushSkill, contractRouted));
  findings.push(...validatePreReviewGateSchedule(pushSkill));

  const directWorkflowScripts = new Set(steps.flatMap((step) => pnpmReferences(step.run)));
  directWorkflowScripts.delete(CONTRACT_GATE);
  const subsectionRoutes = new Map();
  const subsectionLines = new Map();
  for (const heading of new Set(GATE_PLACEMENTS.map((placement) => placement.heading))) {
    const subsection = skillSubsection(pushSkill, heading);
    if (!subsection) {
      findings.push(`${PUSH_SKILL} §2 must contain one unambiguous ${heading} home`);
    }
    subsectionLines.set(heading, new Set(shellFencedCommandLines(subsection)));
    const commands = shellFencedCommandLines(subsection, { includeCommentLines: true }).map(
      (command) => ({ command, source: `${PUSH_SKILL} ${heading}` }),
    );
    subsectionRoutes.set(heading, routeCommands(commands, scripts, findings));
  }
  for (const name of [...directWorkflowScripts].sort()) {
    if (name === CONTRACT_GATE || contractRouted.has(name)) continue;
    const heading = GATE_PLACEMENTS.find((placement) => placement.script === name)?.heading;
    if (heading && subsectionRoutes.get(heading)?.has(name)) continue;
    findings.push(
      `workflow-routed package script ${name} is neither reachable from ${CONTRACT_GATE} nor declared in GATE_PLACEMENTS and fenced in its named ${PUSH_SKILL} subsection; add it to the contract gate or add both the placement entry and subsection fence`,
    );
  }
  for (const name of CI_REQUIRED_SCRIPTS) {
    if (!directWorkflowScripts.has(name)) {
      findings.push(
        `CI_REQUIRED_SCRIPTS key ${name} is absent from ${TEST_WORKFLOW}; remove the stale CI requirement or restore the workflow step`,
      );
    }
  }
  for (const { script, command, heading } of GATE_PLACEMENTS) {
    const present = script
      ? subsectionRoutes.get(heading)?.has(script)
      : subsectionLines.get(heading)?.has(command);
    if (!present) {
      findings.push(
        `${script ? `package script ${script}` : `command ${command}`} must be fenced in ${heading} within ${PUSH_SKILL} §2. Move or add its route in that subsection`,
      );
    }
  }

  const fencedLines = new Set(directGateCommands);
  const routedPackageSegments = new Set(
    [...routed].flatMap((name) => commandSegments(scripts[name] ?? "")),
  );
  for (const command of directGateCommands) {
    for (const { gate } of receiptReferences(command)) {
      if (gate in GATES) {
        for (const segment of commandSegments(GATES[gate])) routedPackageSegments.add(segment);
      }
    }
  }
  for (const step of steps) {
    if (step.hasIf && invokesGate(step.run, repoRoot)) {
      findings.push(
        `${TEST_WORKFLOW} workflow step has if: ${JSON.stringify(step.ifValue)}: ${step.name || step.run}`,
      );
    }
    if (
      step.continueOnError !== undefined &&
      step.continueOnError !== "false" &&
      invokesGate(step.run, repoRoot)
    ) {
      findings.push(
        `${TEST_WORKFLOW} workflow step ignores the gate's exit status with continue-on-error: ${JSON.stringify(step.continueOnError)}: ${step.name || step.run}`,
      );
    }
    if (invokesGate(step.run, repoRoot) && /\|\||[;|]/u.test(step.run)) {
      findings.push(
        `${TEST_WORKFLOW} workflow step neutralises or chains gate exit codes: ${step.name || step.run}`,
      );
    }
    for (const segment of commandSegments(step.run)) {
      if (!invokesGate(segment, repoRoot)) continue;
      if (fencedLines.has(segment) || routedPackageSegments.has(segment)) continue;
      findings.push(
        `workflow command must exactly match a fenced line or routed package-script segment: ${segment}`,
      );
    }
  }

  for (const command of directGateCommands) {
    for (const name of pnpmReferences(command)) {
      if (contractRouted.has(name)) {
        findings.push(
          `contract-gate member ${name} is also invoked directly by ${PUSH_SKILL}; keep it only in ${CONTRACT_GATE}`,
        );
      }
    }
  }
  for (const step of steps) {
    for (const name of pnpmReferences(step.run)) {
      if (contractRouted.has(name)) {
        findings.push(
          `contract-gate member ${name} is also invoked directly by ${TEST_WORKFLOW}; keep it only in ${CONTRACT_GATE}`,
        );
      }
    }
  }

  const allRouted = new Set([...routed, ...workflowRouted]);

  for (const name of Object.keys(scripts).sort()) {
    if (/:(?:check|test)$/u.test(name) && !allRouted.has(name)) {
      findings.push(
        `package script ${name} is not routed through ${PUSH_SKILL} or ${TEST_WORKFLOW}`,
      );
    }
  }

  const includes = testIncludes(viteConfig);
  const isRouted = (path) =>
    directGateCommands.some((command) => invokesScript(command, path)) ||
    Object.entries(scripts).some(
      ([name, command]) => allRouted.has(name) && invokesScript(command, path),
    );
  for (const { path } of files.filter((file) => matches(file.path, TEST_FILE_PATTERNS))) {
    if (!isRouted(path) && !matches(path, includes)) {
      findings.push(
        `test file ${path} is not reachable from a routed package script or Vitest include`,
      );
    }
  }

  for (const { path } of files.filter(
    (file) => file.executable || /^scripts\/check-.*\.mjs$/u.test(file.path),
  )) {
    if (!isRouted(path) && !matches(path, includes)) {
      findings.push(
        `checker file ${path} is not reachable from a routed package script or Vitest include`,
      );
    }
  }

  const repositoryPaths = paths ?? listed;
  for (const pattern of reviewPathGlobPatterns(pushSkill)) {
    const matcher = globToRegExp(pattern);
    if (!repositoryPaths.some((path) => matcher.test(path))) {
      findings.push(`sensitive-path glob ${pattern} matches no file`);
    }
  }

  return findings;
}

function parseArguments(argumentsList) {
  const options = { repoRoot: "." };
  for (let index = 0; index < argumentsList.length; index += 1) {
    const argument = argumentsList[index];
    if (argument === "--repo-root") options.repoRoot = argumentsList[++index];
    else throw new Error(`Unknown argument: ${argument}`);
    if (!options.repoRoot) throw new Error(`Missing value for ${argument}`);
  }
  return options;
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const findings = await checkGateRouting(resolve(process.cwd(), options.repoRoot));
  if (findings.length > 0) {
    console.error("Gate routing check: FAIL");
    for (const finding of findings) console.error(`  * ${finding}`);
    process.exitCode = 1;
    return;
  }
  console.log("Gate routing check: OK");
}

if (isEntrypoint(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
