# En Croissant — project context

Chess GUI: Tauri v2 desktop shell (Rust) + React/TypeScript renderer. This is Felix's **fork**
(`origin` = `felixabeck/en-croissant`, `upstream` = the original project). Upstream history is the
error history this project learns from; foreign upstream changes are never rewritten casually.

## Layout

| Path | What lives there |
| --- | --- |
| `src-tauri/src/` | Rust: commands, engine supervision, SQLite/Diesel database, PGN parsing, OAuth |
| `src/` | React renderer: components, state, utils |
| `src/bindings/generated.ts` | **Generated** by Specta from the Rust command/event registry — never hand-edited |
| `src/platform/` | The renderer's only sanctioned door to Tauri (`tauri.ts`, `native.ts`, `errors.ts`, `operation.ts`) |
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

**`.agents/skills/push/SKILL.md` is the single source for which gate runs for which changed path.**
Read it rather than reconstructing the mapping here; `.claude/skills/push/SKILL.md` is only a bridge
to it, and both defer to `~/.claude/references/push-review-policy.md` for authorization, review,
triage, and red-gate behavior.

Gate commands themselves live in `package.json` scripts. Two properties worth knowing before
planning any change:

- **The binding is proven, not trusted.** `pnpm bindings:check` re-runs the debug Specta exporter
  and fails if the checked-in `src/bindings/generated.ts` differs by a byte. Editing the generated
  file to make a gate pass is always the wrong move; regenerate with `pnpm bindings:generate`.
- **Coverage and bundle size are ratcheted, not just floored.** `coverage-areas.json` /
  `backend-coverage-areas.json` set permanent per-area minimums, and
  `coverage-baselines.json` / `backend-coverage-baselines.json` reject a lower covered count or a
  larger total even when the percentage still clears the floor. `bundle-budgets.json` caps entry,
  largest-lazy, and total gzip bytes. Never lower a floor or rewrite a baseline to accept a
  regression — see `docs/coverage.md`.

**Mutation testing is not a per-commit gate.** It lives in `.github/workflows/mutation.yml`,
dispatchable and scheduled weekly, with the eight backend packages as a matrix over the runner's
`BACKEND_MUTATION_PACKAGE` selector. It answers a different question from the gates — a surviving
mutant means a test is missing, not that the change under review is wrong — and a single sequential
backend run is slow enough to crowd GitHub's 6-hour per-job limit. `test.yml` therefore runs neither
suite.

`pnpm mutation:backend` runs `cargo-mutants` with `--in-place`: it mutates the **real** working
tree rather than a copy, to avoid duplicating the multi-gigabyte target directory. Nothing else may
touch the tree while it runs — no other gate, no `git add`, no parallel session — and an interrupted
run leaves `/* ~ changed by cargo-mutants ~ */` markers in tracked source, so check
`git status -- src-tauri` after any abort.

Mechanical classes already covered by a checker, so review effort belongs elsewhere:
untranslated JSX and missing locale keys (`pnpm i18n:jsx`, `pnpm i18n:check`), direct
`@tauri-apps/*` imports and raw `listen()` outside the platform facade
(`pnpm tauri:boundary:check`), and direct `ActionIcon`/`Modal` imports plus unsafe focus resets
(`pnpm ui:boundary:check`).

## Review lenses

Adversarial review runs in two tiers, and names never collide between them. Six project-independent
lenses live in `~/.claude/agents/review-*.md` (`plan`, `minimalism`, `root-cause`, `tests`,
`code-quality`, `error-handling`); five En-Croissant-specific ones live in `.claude/agents/` and
carry this codebase's failure history:

| Lens | Owns | Triggered by a diff touching |
| --- | --- | --- |
| `review-chess-semantics` | position identity from FEN fields, ply/colour parity off a non-standard start FEN, `number[]` move paths after tree mutation, mainline-vs-variation assumptions | `src/utils/treeReducer.ts`, `src/state/store/tree.ts`, `src/utils/chess*.ts`, `src/utils/repertoire.ts`, `src/components/common/GameNotation.tsx`, `src/components/panels/practice/**`, `src-tauri/src/chess.rs`, `src-tauri/src/game.rs` |
| `review-engine-protocol` | UCI process lifecycle, multipv aggregation, cached option state, binding an async result to the position/tab/engine that asked | `src-tauri/src/engine/**`, `src-tauri/src/chess.rs`, `src/components/engines/**`, `src/components/panels/analysis/**`, `src/components/boards/EvalListener.tsx`, `src/utils/engines.ts` |
| `review-ipc-contract` | bare-string events vs. the Specta registry, correlation ids on broadcasts, stale generated bindings, listener lifetimes, capability scope | `src-tauri/src/main.rs`, any `#[tauri::command]`, any emit/listen call, `src/bindings/**`, `src/platform/**`, `src-tauri/capabilities/**`, `src-tauri/tauri.conf.json` |
| `review-persisted-state` | `sessionStorage`/`localStorage` size and quota, write/read symmetry, keys shared across tabs, hydration of corrupt or absent data | `src/state/**`, `src/hooks/**`, `src/utils/tabs.ts`, `src/components/tabs/**`, any direct web-storage access |
| `review-pgn-index` | game-boundary detection, the cached byte-offset index, reader position, `CastlingMode` symmetry across encode/decode, whole-file materialisation | `src-tauri/src/pgn.rs`, `src-tauri/src/lexer.rs`, `src-tauri/src/db/**`, `src-tauri/src/opening.rs`, `src-tauri/src/puzzle.rs`, `src/components/tabs/ImportModal.tsx`, `src/utils/db.ts` |

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
  `~/.claude/references/findings-ledger-contract.md`. `scripts/findings.py` is deliberately
  identical across Felix's projects; nothing project-specific may be added to it.

This repository has no Python test suite, so nothing gates `findings.py check` automatically. Run it
directly whenever a diff touches `tasks/`.

## Verifying UI changes

`.claude/skills/verify-ui/SKILL.md` is the canonical contract (`.agents/skills/verify-ui/SKILL.md`
is its Codex bridge). **Read it before verifying any visible change.** The short version, because
getting this wrong is the recurring mistake: Chrome MCP cannot attach to the Tauri webview, and
`pnpm start-vite` plus a browser is not evidence — `TopBar.tsx` calls `getCurrentWebviewWindow()`
at module scope and the page crashes without a Tauri backend. Automated proof is
`pnpm test:e2e:container`; the live product is the window `pnpm dev` opens, and that check is
Felix's, not an agent's.

## Repository state (as of 2026-08-29)

The audit implementation is **committed and pushed**; `master` tracks `origin/master` in sync and is
33 commits ahead of `upstream/master`. Work here is a side project, picked up in bursts.

The working checkout is on **`tuxedo-atlas`** (cloned 2026-08-29 from `felixabeck/en-croissant` over
SSH; commits are ssh-signed). Measured green on this machine: `pnpm test`, `cargo test` (306),
`pnpm lint:ci`, `pnpm bindings:check`, both boundary checks, `pnpm bundle:check`, `pnpm build`
(Tauri release, `--no-bundle`), and — since the toolchain was completed on 2026-08-29 —
`pnpm test:coverage:backend`.

What is **not** settled, all of it filed in `tasks/findings.md` rather than only described here:

- **Both coverage ratchets are red on atlas, and neither is a regression** — `f-20260829-01`
  (backend: `app-infrastructure` 745/2018 against a baseline of 746/2018, deterministic across two
  runs, on a tree whose branch total matches the baseline exactly) and `f-20260829-06` (frontend:
  `tauri-ipc-platform` 156/218 against 155/215, with six of ten areas measuring differently here
  than the baselines record, none of those files changed). They share the root
  `machine-dependent-measurement`: the baselines describe some other machine's instrumentation.
  **Never rewrite a baseline to clear this** (`docs/coverage.md`); `coverage:baseline:*` is denied
  in `.claude/settings.json` for the same reason.
- **Mutation testing** — the tooling (`cargo-mutants` 27.1.0, `cargo-llvm-cov` 0.8.7,
  `nightly-2025-06-01`) was installed on atlas on 2026-08-29 at the versions
  `.github/workflows/test.yml` pins, and `pnpm mutation:frontend` then produced the first valid
  evidence on this tree: **red**, 97.93 on the `game-practice` package with three surviving mutants
  in `src/components/boards/gameSession.ts` (`f-20260829-08`), which stops the runner before its
  other two packages. Backend mutation evidence is still outstanding — `f-20260829-05`.
- **The 320px / 200% font-scale layout is broken** — `f-20260829-02`. The committed screenshots
  record the clipping rather than contradict it.
- **`src/App.tsx` is untested** (0 of 75 lines) — `f-20260829-03`.
- **The backend coverage exporter measures `#[cfg(test)]` modules** alongside production code —
  `f-20260829-04`.

E2E runs go through `pnpm test:e2e:container`, inside the pinned Playwright image — the reasoning
is `d-20260829-01` in `tasks/decisions.md`. The committed snapshots already match what that image
renders (8/8 green there on 2026-08-29, none rewritten); it is the *native* run on atlas that fails,
on glyph antialiasing alone. Never re-record snapshots on a host.

Also note that the 2026-08-09 audit was produced by a Gemini-driven agent run and **has not been
reviewed line by line**. What is proven is that every gate passes, not that every change is right.
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
