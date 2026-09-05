# ChessFable — project context

Chess GUI: Tauri v2 desktop shell (Rust) + React/TypeScript renderer. **ChessFable** is Felix's
fork of En Croissant (`origin` = `felixabeck/en-croissant`, `upstream` = the original project).
Upstream history is the error history this project learns from; foreign upstream changes are
never rewritten casually. En Croissant is the upstream name and the GitHub remote, not this
project's name.

## Layout

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

`BACKEND_AUDIT_PLAN.md` and `FRONTEND_AUDIT_PLAN.md` are the wave-structured audit plans that
produced most of the current tooling; `CHESS_LOGIC_MAP.md` describes the engine/database/streaming
architecture.

## Domain rules — `.claude/rules/*.md` (MANDATORY, all agents)

These carry the write-time invariants of this codebase: the facts that stop the defect from being
written, as opposed to the review lenses below, which catch it afterwards. Each file states one rule
and the incidents that produced it.

| File | Read before working on | Loads |
| --- | --- | --- |
| `async-resource-invariants.md` | any command, spawned process, subscription, or registry | **always** — it applies to nearly every diff, so it is deliberately not path-scoped |
| `chess-tree-semantics.md` | position comparison, move paths, move numbering, colour parity | `src/utils/{treeReducer,chess,chessops,repertoire}.ts`, `src/state/store/tree.ts`, `GameNotation.tsx`, `panels/practice/**`, `chess.rs`, `game.rs` |
| `engine-lifecycle.md` | spawning/killing engines, UCI info aggregation, cached options, result routing | `src-tauri/src/engine/**`, `chess.rs`, `components/engines/**`, `panels/analysis/**`, `EvalListener.tsx`, `src/utils/engines.ts` |
| `ipc-events.md` | any `#[tauri::command]`, emit, listen, progress report, or capability scope | `src-tauri/src/{main,progress}.rs`, `db/search.rs`, `src/platform/**`, `src/bindings/**`, `capabilities/**`, `tauri.conf.json` |
| `persisted-state.md` | anything written to session/local storage, persisted atoms, tab lifecycle | `src/state/**`, `src/hooks/**`, `src/utils/tabs.ts`, `src/components/tabs/**` |
| `pgn-scanning.md` | PGN boundaries, the byte-offset index, move encoding, search predicates, imports | `src-tauri/src/{pgn,lexer,opening,puzzle}.rs`, `db/**`, `ImportModal.tsx`, `src/utils/db.ts` |

Claude Code loads `async-resource-invariants.md` in every session and pulls the other five in
automatically the moment it touches a matching path (`paths:` frontmatter in each file).
**This is a delivery mechanism, not a scope limit: the rule binds whether or not it happens to be in
context.** Codex and review subagents auto-load none of them — open the file yourself before working
in that area. A path that should trigger one of these but does not is a bug in the frontmatter — add
the glob to the file rather than working around it.

## Gates

**`.claude/skills/push/SKILL.md` is the single source for which gate runs for which changed path.**
Read it rather than reconstructing the mapping here; `.agents/skills/push/SKILL.md` is only a bridge
to it, and both defer to `~/.claude/references/push-review-policy.md` for authorization, review,
triage, and red-gate behavior.

Gate scripts live in `package.json`; the path mapping and any direct tool invocations live in the
canonical push contract. Two properties worth knowing before planning any change:

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
  printed, and it makes the recorded *scope* the only remaining guard against narrowing the measured
  set. `bundle-budgets.json` caps entry, largest-lazy, and total gzip bytes. Never lower a floor or
  rewrite a baseline to accept a regression — see `docs/coverage.md`.

**Mutation testing is not a per-commit gate.** It lives in `.github/workflows/mutation.yml`,
dispatchable and scheduled weekly, with the eight backend packages as a matrix over the runner's
`BACKEND_MUTATION_PACKAGE` selector. It answers a different question from the gates — a surviving
mutant means a test is missing, not that the change under review is wrong — and a single sequential
backend run is slow enough to crowd GitHub's 6-hour per-job limit. `test.yml` runs
`mutation:frontend` (~21 s) on every push and never `mutation:backend`.

`pnpm mutation:backend` runs `cargo-mutants` with `--in-place`: it mutates the **real** working
tree rather than a copy, to avoid duplicating the multi-gigabyte target directory. Nothing else may
touch the tree while it runs — no other gate, no `git add`, no parallel session. That is now
enforced rather than merely written down (`f-20260829-09`): the runner refuses to start on a dirty
`src-tauri` or a failing `git`, holds an fsynced exclusive fence at
`mutants.out/backend/.mutation-in-progress` for the whole run, and clears it only after proving no
tracked file under `src-tauri` still carries a `~ changed by cargo-mutants ~` marker. An abort
leaves the fence behind by construction, and the next run — or `pnpm mutation:guard:check`, which
`$push` runs before any other gate — refuses and prints an ordered recovery: terminate any live
mutator first, then restore **only** the marked files, then remove the fence. Never
`git checkout -- src-tauri` wholesale; that destroys a concurrent editor's work along with the
mutant.

Mechanical classes already covered by a checker, so review effort belongs elsewhere:
untranslated JSX and missing locale keys (`pnpm i18n:jsx`, `pnpm i18n:check`), direct
`@tauri-apps/*` imports and raw `listen()` outside the platform facade
(`pnpm tauri:boundary:check`), and direct `ActionIcon`/`Modal` imports plus unsafe focus resets
(`pnpm ui:boundary:check`).

## Review lenses

Adversarial review runs in two tiers, and names never collide between them. Six project-independent
lenses live in `~/.claude/agents/review-*.md` (`plan`, `minimalism`, `root-cause`, `tests`,
`code-quality`, `error-handling`); six ChessFable-specific ones live in `.claude/agents/` and
carry this codebase's failure history:

| Lens | Owns | Triggered by a diff touching |
| --- | --- | --- |
| `review-chess-semantics` | position identity from FEN fields, ply/colour parity off a non-standard start FEN, `number[]` move paths after tree mutation, mainline-vs-variation assumptions | `src/utils/treeReducer.ts`, `src/state/store/tree.ts`, `src/utils/chess*.ts`, `src/utils/repertoire.ts`, `src/components/common/GameNotation.tsx`, `src/components/panels/practice/**`, `src-tauri/src/chess.rs`, `src-tauri/src/game.rs` |
| `review-engine-protocol` | UCI process lifecycle, multipv aggregation, cached option state, binding an async result to the position/tab/engine that asked | `src-tauri/src/engine/**`, `src-tauri/src/chess.rs`, `src/components/engines/**`, `src/components/panels/analysis/**`, `src/components/boards/EvalListener.tsx`, `src/utils/engines.ts` |
| `review-ipc-contract` | bare-string events vs. the Specta registry, correlation ids on broadcasts, stale generated bindings, listener lifetimes, capability scope | `src-tauri/src/main.rs`, any `#[tauri::command]`, any emit/listen call, `src/bindings/**`, `src/platform/**`, `src-tauri/capabilities/**`, `src-tauri/tauri.conf.json` |
| `review-persisted-state` | `sessionStorage`/`localStorage` size and quota, write/read symmetry, keys shared across tabs, hydration of corrupt or absent data | `src/state/**`, `src/hooks/**`, `src/utils/tabs.ts`, `src/components/tabs/**`, any direct web-storage access |
| `review-pgn-index` | game-boundary detection, the cached byte-offset index, reader position, `CastlingMode` symmetry across encode/decode, whole-file materialisation | `src-tauri/src/pgn.rs`, `src-tauri/src/lexer.rs`, `src-tauri/src/db/**`, `src-tauri/src/opening.rs`, `src-tauri/src/puzzle.rs`, `src/components/tabs/ImportModal.tsx`, `src/utils/db.ts` |
| `review-tauri-security` | OAuth token acquisition, credential storage and refresh, renderer-session sanitization, path containment and recursive deletion, signed download manifest verification, bearer-token and raw-diagnostic egress | `src-tauri/src/oauth.rs`, `src-tauri/src/credentials.rs`, `src/utils/session.ts`, `src-tauri/src/fs.rs`, `src-tauri/src/infra/**`, `docs/signed-download-manifests.md` |

Which lenses run for a push is decided by `~/.claude/references/push-review-policy.md`; this table
says what each one knows, so a plan can be sanity-checked against the right lens before code exists.

## Findings ledger

Deferred findings go on disk the moment they are found, per universal rule 4b — never only into a
session's context, and never only into a handoff message.

- The ledger is `tasks/findings.md`, an **append-only log**; the work queue is derived from it by
  `python3 scripts/findings.py`, grouped by `Root` first and `Area` second. Position in the file
  carries no meaning.
- **File every new finding with one command**, whether or not a drain is running. Write the complete
  `###` entry to a file with `**ID:** f-PENDING`, then run
  `python3 scripts/findings.py file <path-to-entry-file>`. It validates, publishes atomically
  through the inbox spool `tasks/findings-inbox/`, and reports the allocated id — or, if a drain
  holds the lock, that the drain will merge it. **Never pick an id yourself and never edit
  `tasks/findings.md` by hand while a drain is running.**
- `python3 scripts/findings.py next` picks the next cluster, `related` finds siblings before you
  file, `decisions` lists what is parked on Felix, `drain-status` answers whether a drain is
  running (exit 0 = yes). `check` validates every header and the area vocabulary.
- `tasks/decisions.md` records the technical calls made while working findings, so a later session
  reads them instead of re-deriving the question.
- The area vocabulary is a **closed set**, listed in the ledger header; `check` rejects any other
  value. Adding an area is a deliberate edit to that list.
- The universal contract — field meanings, ranking, the decision discipline, the lock protocol — is
  `~/.claude/references/findings-ledger-contract.md`. `scripts/findings.py` is the vendored copy
  of `~/Projekte/agent-kit/scripts/findings.py`, written by `kit sync` and verified byte-exact by
  `kit sync --check` (since 2026-09-02; the former parity-test mesh is gone); nothing
  project-specific may be added to it — project specifics live in the ledger header.

CI runs `python3 scripts/findings.py check` in `.github/workflows/test.yml`. Run it directly whenever
a diff touches `tasks/`.

## Multi-agent coordination

Shared contract: `/home/felixb/Projekte/agent-kit/references/multi-agent-coordination.md`.
This repository is worked on by Claude Code, Codex, and Grok.

* Claude Code reads `.claude/skills/push/SKILL.md` directly; Codex reaches it through
  `.agents/skills/push/SKILL.md`, whose Codex delta names its own committer; and
  `.grok/rules/grok-chessfable.md` points at the canonical file.
* Gate scope is split, because the full set is slow enough that running it per commit is not
  practical. Per commit, run the narrowest affected checks from the mapping in
  `.claude/skills/push/SKILL.md`. Once per task, after the last commit, run the full affected set.
  Never commit on red.

## Verifying UI changes

`.claude/skills/verify-ui/SKILL.md` is the canonical contract (`.agents/skills/verify-ui/SKILL.md`
is its Codex bridge). **Read it before verifying any visible change.** The short version, because
getting this wrong is the recurring mistake: Chrome MCP cannot attach to the Tauri webview — the
window is WebKitGTK and speaks no CDP — and `pnpm start-vite` plus a browser is not evidence,
because `TopBar.tsx` calls `getCurrentWebviewWindow()` at module scope and the page crashes without
a Tauri backend.

There are two automated proofs, answering different questions. `pnpm test:e2e:container` pins
renderer **pixels** in Chromium against a mocked IPC surface. `pnpm verify:app` pins **behaviour**
in the actual product: it drives the real window off-screen through `kwin_wayland --virtual` →
`tauri-driver` → `WebKitWebDriver` → the release binary, with the real Rust backend and real IPC
(`scripts/app-driver.mjs`). Use it for lifecycle, IPC and process-teardown claims. It needs
`webkit2gtk-driver` (apt) and `tauri-driver` (cargo), plus a `pnpm build`, and is not a push gate.

The daily desktop app is **not** `src-tauri/target/release/en-croissant`: the application-menu
entry runs a copy under `~/.local/opt/chessfable/`, written only by `scripts/install-local.sh`
from a clean tree whose HEAD is on the pushed upstream (`VERSION` there names the commit). So
`pnpm build`, `verify:app` and a drain may overwrite `target/release` freely without changing what
Felix is using; a reviewed change reaches him only through that install step.

What remains Felix's is now only **native GTK chrome** — menus, file dialogs, window decorations.
WebDriver sees the page, not the GTK widgets around it, and `issue_engine_binary` always opens a
native picker, so registering an engine (and therefore any check needing a live engine child)
cannot be automated this way.

## Repository state (as of 2026-08-30)

The audit implementation is committed; `master` tracks `origin/master` and is well ahead of
`upstream/master`. Work here is a side project, picked up in bursts. **Do not restate an exact
commit count or "in sync" here** — it is wrong the moment anything is committed, and it was.

The working checkout is on **`tuxedo-atlas`** (cloned 2026-08-29 from `felixabeck/en-croissant` over
SSH; commits are ssh-signed). Measured green on this machine: `pnpm test`, `cargo test` (338),
`pnpm lint:ci`, `pnpm bindings:check`, both boundary checks, `pnpm bundle:check`, `pnpm build`
(Tauri release, `--no-bundle`), and — since the toolchain was completed on 2026-08-29 —
`pnpm test:coverage:backend`.

What is **not** settled, all of it filed in `tasks/findings.md` rather than only described here:

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
  delete that guards against directory traversal. `.claude/settings.json` denies the known spellings
  of `coverage:baseline:*` and of a direct `--write-baseline` call, as well as the repository's e2e
  snapshot-update and force-push command forms. `.claude/hooks/block-env-files.sh` adds semantic
  protection for secret-file access. These are defense-in-depth guards: the rule is what binds, and
  a determined invocation can phrase a command differently.
- **Mutation testing now has valid evidence on this tree for the first time** (`f-20260829-05`,
  handled), after the pinned tooling was installed on atlas on 2026-08-29. The **backend is green**:
  all eight packages, 324 mutants, 305 caught, 9 timeouts, 10 unviable, **0 survivors**. The
  **frontend is red**: 97.93 on `game-practice` with three survivors in
  `src/components/boards/gameSession.ts` (`f-20260829-08`), which stops the runner before its other
  two packages, so those stay unmeasured until the survivors are killed.
- **The 320px / 200% font-scale layout is broken** — `f-20260829-02`. The committed screenshots
  record the clipping rather than contradict it.
- **`src/App.tsx` is untested** (0 of 67 lines) — `f-20260829-03`.
- **The backend coverage exporter measures `#[cfg(test)]` modules** alongside production code —
  `f-20260829-04`.

E2E runs go through `pnpm test:e2e:container`, inside the pinned Playwright image — the reasoning
is `d-20260829-01` in `tasks/decisions.md`. The committed snapshots already match what that image
renders (8/8 green there on 2026-08-29, none rewritten); it is the *native* run on atlas that fails,
on glyph antialiasing alone. Never re-record snapshots on a host.

CI on the fork is green end to end as of run 33298305678 (2026-08-30) — linter, both boundary
checks, both coverage ratchets, bindings, bundle budgets, container e2e, and `mutation:frontend`.
The current test workflow additionally runs routing, skills, tool-parity, workflow-permission,
hook-lint and findings-ledger validation.
That is the reference measurement: a gate is settled when the runner agrees with this machine, not
when it passes here.

Also note that the 2026-08-09 audit was produced by a Gemini-driven agent run and **has not been
reviewed line by line**. What was proven at the time is that the gates then run were green — not
that every change is right, and not that every gate is green today. The two coverage ratchets it
once reddened are green again, for the reasons recorded above.
Defects found while getting the gates green are listed in `BACKEND_AUDIT_PLAN.md` and
`FRONTEND_AUDIT_PLAN.md`; treat the rest of that diff as unreviewed.

## Conventions

- Rust talks to the renderer only through Specta-registered commands and events; a new event must be
  added to `collect_events!` in `src-tauri/src/main.rs`, not emitted by a bare string. No event is
  outside the registry today; the two incidents that got there — `search_progress` and
  `convert_progress` — are written up in `.claude/rules/ipc-events.md`.
- The renderer reaches native capability only through `src/platform/`.
- Filesystem and HTTP reach are declared in `src-tauri/capabilities/main.json` and
  `src-tauri/tauri.conf.json`; widening a scope is a security decision, not a build fix.
- User-facing strings go through i18next (`src/translation/`); `pnpm i18n:extract` after adding keys.
- Formatting and linting are `oxfmt` / `oxlint` (`pnpm format`, `pnpm lint:fix`), not Prettier/ESLint.

## Commits

Author stays Felix Beck, committer is the acting agent, and no co-author trailer is added. Commit
atomically per cohesive area. Pushing to the fork requires an explicit request; `$push` never tags,
releases, or deploys.
