# ChessFable — project context

Chess GUI: Tauri v2 desktop shell (Rust) + React/TypeScript renderer. **ChessFable** is Felix's
fork of En Croissant (`origin` = `felixabeck/en-croissant`, `upstream` = the original project).
Foreign upstream changes are never rewritten casually. En Croissant is the upstream name and the
GitHub remote, not this project's name.

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
| `docs/` | `coverage.md`, `bundle-budgets.md`, `localization.md`, `signed-download-manifests.md`, `context/RULE-HISTORY.md` (on-demand history) |
| `tasks/` | `findings.md` (deferred-findings ledger), `decisions.md`; driven by `scripts/findings.py` |

`CHESS_LOGIC_MAP.md` describes the engine/database/streaming architecture.

## Domain rules — `.claude/rules/*.md` (MANDATORY, all agents)

`.claude/rules/*.md` carry the mandatory write-time invariants of this codebase.

| File | Read before working on | Loads |
| --- | --- | --- |
| `async-resource-invariants.md` | any command, spawned process, subscription, or registry | **always** — it applies to nearly every diff, so it is deliberately not path-scoped |
| `chess-tree-semantics.md` | position comparison, move paths, move numbering, colour parity | `src/utils/{treeReducer,chess,chessops,repertoire}.ts`, `src/state/store/tree.ts`, `GameNotation.tsx`, `panels/practice/**`, `chess.rs`, `game.rs` |
| `engine-lifecycle.md` | spawning/killing engines, UCI info aggregation, cached options, result routing | `src-tauri/src/engine/**`, `chess.rs`, `components/engines/**`, `panels/analysis/**`, `EvalListener.tsx`, `src/utils/engines.ts` |
| `ipc-events.md` | any `#[tauri::command]`, emit, listen, progress report, or capability scope | `src-tauri/src/{main,progress}.rs`, `db/search.rs`, `src/platform/**`, `src/bindings/**`, `capabilities/**`, `tauri.conf.json` |
| `persisted-state.md` | anything written to session/local storage, persisted atoms, tab lifecycle | `src/state/**`, `src/hooks/**`, `src/utils/tabs.ts`, `src/components/tabs/**` |
| `pgn-scanning.md` | PGN boundaries, the byte-offset index, move encoding, search predicates, imports | `src-tauri/src/{pgn,lexer,opening,puzzle}.rs`, `db/**`, `ImportModal.tsx`, `src/utils/db.ts` |
| `gate-tooling.md` | running, changing or recovering a gate, including a gate command typed before any file is opened | `scripts/**`, `.github/workflows/**`, `package.json`, `pnpm-workspace.yaml`, `stryker.config.mjs`, `*coverage-*.json`, `bundle-budgets.json`, `.claude/skills/push/**`, `mutants.out/**` |
| `desktop-installation.md` | installing the desktop app, its desktop entry or launcher identity | `scripts/install-local*`, `src-tauri/tauri.conf.json`, `src-tauri/icons/**`, `.claude/skills/push/**` |

Claude Code loads `async-resource-invariants.md` in every session and pulls the path-scoped rules in
automatically the moment it touches a matching path (`paths:` frontmatter in each file).
**This is a delivery mechanism, not a scope limit: the rule binds whether or not it happens to be in
context.** Codex, Grok and review subagents auto-load none of them — open the file yourself before
working in that area. An interactive Grok session opens the always row
(`async-resource-invariants.md`) at session start, and every other row before working in its area or
replying in it; a Grok leaf reads only the rules its assignment names. A path that should trigger one
of these but does not is a bug in the frontmatter — add the glob to the file rather than working
around it.

## Gates

**`.claude/skills/push/SKILL.md` is the single source for which gate runs for which changed path.**
Read it rather than reconstructing the mapping here; `.agents/skills/push/SKILL.md` is only a bridge
to it, and both defer to `~/.claude/references/push-review-policy.md` for authorization, review,
triage, and red-gate behavior.

`pnpm gates:contract:check` is the unconditional pre-push gate and the single CI step for tooling
checks.

Never add another `flock` on `heavy-gate.lock`: it deadlocks against the launcher's own lock.
Never start `pnpm mutation:backend` as part of a push. Never `git checkout -- src-tauri` wholesale,
which destroys a concurrent editor's work along with a legacy mutant.

Gate scripts live in `package.json`. The path mapping and any direct tool invocations live in the
canonical push contract.

- Generated bindings are proven by `pnpm bindings:check`. Regenerate with `pnpm bindings:generate`, never hand-edit `src/bindings/generated.ts`.
- Coverage and bundle size are ratcheted. Never lower a floor or rewrite a baseline to accept a regression — see `docs/coverage.md`.

Mechanical classes already covered by a checker, so review effort belongs elsewhere:
untranslated JSX and missing locale keys (`pnpm i18n:jsx`, `pnpm i18n:check`), direct
`@tauri-apps/*` imports and raw `listen()` outside the platform facade
(`pnpm tauri:boundary:check`), exported IPC commands without a production renderer consumer
(`pnpm ipc:consumers:check`), and direct `ActionIcon`/`Modal` imports plus unsafe focus resets
(`pnpm ui:boundary:check`).

## Review lenses

Adversarial review runs in two tiers, and names never collide between them. Project-independent
lenses live in `~/.claude/agents/`, ChessFable-specific ones in `.claude/agents/`.

| Lens | Owns | Triggered by a diff touching |
| --- | --- | --- |
| `review-chess-semantics` | position identity from FEN fields, ply/colour parity off a non-standard start FEN, `number[]` move paths after tree mutation, mainline-vs-variation assumptions | `src/utils/treeReducer.ts`, `src/state/store/tree.ts`, `src/utils/chess*.ts`, `src/utils/repertoire.ts`, `src/components/common/GameNotation.tsx`, `src/components/panels/practice/**`, `src-tauri/src/chess.rs`, `src-tauri/src/game.rs` |
| `review-engine-protocol` | UCI process lifecycle, multipv aggregation, cached option state, binding an async result to the position/tab/engine that asked | `src-tauri/src/engine/**`, `src-tauri/src/chess.rs`, `src/components/engines/**`, `src/components/panels/analysis/**`, `src/components/boards/EvalListener.tsx`, `src/utils/engines.ts` |
| `review-ipc-contract` | bare-string events vs. the Specta registry, correlation ids on broadcasts, stale generated bindings, listener lifetimes, capability scope | `src-tauri/src/main.rs`, any `#[tauri::command]`, any emit/listen call, `src/bindings/**`, `src/platform/**`, `src-tauri/capabilities/**`, `src-tauri/tauri.conf.json` |
| `review-persisted-state` | `sessionStorage`/`localStorage` size and quota, write/read symmetry, keys shared across tabs, hydration of corrupt or absent data | `src/state/**`, `src/hooks/**`, `src/utils/tabs.ts`, `src/components/tabs/**`, any direct web-storage access |
| `review-pgn-index` | game-boundary detection, the cached byte-offset index, reader position, `CastlingMode` symmetry across encode/decode, whole-file materialisation | `src-tauri/src/pgn.rs`, `src-tauri/src/lexer.rs`, `src-tauri/src/db/**`, `src-tauri/src/opening.rs`, `src-tauri/src/puzzle.rs`, `src/components/tabs/ImportModal.tsx`, `src/utils/db.ts` |
| `review-tauri-security` | OAuth token acquisition, credential storage and refresh, renderer-session sanitization, path containment and recursive deletion, signed download manifest verification, bearer-token and raw-diagnostic egress | `src-tauri/src/oauth.rs`, `src-tauri/src/credentials.rs`, `src/utils/session.ts`, `src-tauri/src/fs.rs`, `src-tauri/src/infra/**`, `docs/signed-download-manifests.md` |
| `review-platform-semantics` | OS behavior of filesystem, handle, process and FFI code; platform-gated test parity across Linux, macOS and Windows | `src-tauri/src/**` with `cfg` on `target_os`, `windows` or `unix`, or filesystem/process/handle/FFI code; tests with platform-specific fixtures or cfg-gated helpers |

Which lenses run for a push is decided by `~/.claude/references/push-review-policy.md`; this table
says what each one knows, so a plan can be sanity-checked against the right lens before code exists.

## Findings ledger

Deferred findings go on disk the moment they are found, per universal rule 4b — never only into a
session's context, and never only into a handoff message.

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
  after the shebang; nothing
  project-specific may be added to it — project specifics live in the ledger header.

CI runs `./scripts/findings.py check` in `.github/workflows/test.yml`. Run it directly whenever
a diff touches `tasks/`.

## Multi-agent coordination

Shared contract: `/home/felixb/Projekte/agent-kit/references/multi-agent-coordination.md`.
This repository is worked on by Claude Code, Codex, and Grok.

**Division of labour.** The selected orchestrator uses the user-wide `build` skill
(`~/.claude/skills/build/SKILL.md`) when its proportionality rule calls for it, and reads project
gates from `.claude/skills/push/SKILL.md`. Executor selection and leaf launch belong to
`~/.claude/references/executor-profiles.md`; Codex orchestration uses
`~/.codex/skills/build/SKILL.md`. An interactive Codex session
follows `~/.claude/references/codex-interactive-workflow.md`, including its scoped commit
authorization.

* Claude Code reads `.claude/skills/push/SKILL.md` directly; Codex reaches it through
  `.agents/skills/push/SKILL.md`, whose Codex delta names its own committer; and
  `.grok/rules/grok-chessfable.md` points at the canonical file.
* Gate scope is split. Per commit and after every repair batch, run `pnpm checks:pre-review` from
  `.claude/skills/push/SKILL.md`. Once per task, after the last commit, run the full affected set.
  Never commit on red.

### Worktree builds

* **DO:** run `build` in its own worktree via `kit worktree create`. Outreach, records and small edits stay in the main checkout on `master`.
* **DO:** start drains with the usual `drain-findings.sh` command from the main checkout. It automatically creates or reuses its own drain worktree. `--stop`/`--resume`/`--queue-plans` from the main checkout reach it. Run `findings.py` with the worktree as cwd.
* **DO NOT:** push a `build/*` or `drain/*` branch or open it as a PR. Only its rebased commits reach `master` through `git push origin HEAD:refs/heads/master`, with upstream `origin/master`.
* Dev-server ports stay shared across checkouts. Coordinate `pnpm dev` with any existing dev server before starting another checkout.
* All Rust checkouts share the sccache compile cache through machine wiring in tuxedo-config's `rust-toolchain` module, with no repository Cargo configuration.

## Verifying UI changes

`.claude/skills/verify-ui/SKILL.md` is the canonical contract (`.agents/skills/verify-ui/SKILL.md`
is its Codex bridge). **Read it before verifying any visible change.** Chrome MCP cannot attach to
the Tauri webview — the window is WebKitGTK and speaks no CDP — and `pnpm start-vite` plus a browser is not evidence,
because `TopBar.tsx` calls `getCurrentWebviewWindow()` at module scope and the page crashes without
a Tauri backend.

There are two automated proofs, answering different questions. `pnpm test:e2e:container` pins
renderer **pixels** in Chromium against a mocked IPC surface. `pnpm verify:app` pins **behaviour**
in the actual product: it drives the real window off-screen through `kwin_wayland --virtual` →
`tauri-driver` → `WebKitWebDriver` → the release binary, with the real Rust backend and real IPC
(`scripts/app-driver.mjs`). Use it for lifecycle, IPC and process-teardown claims. It needs
`webkit2gtk-driver` and `gstreamer1.0-plugins-bad` (apt) and `tauri-driver` (cargo), plus a
`pnpm build`, and is not a push gate.

What remains Felix's is now only **native GTK chrome** — menus, file dialogs, window decorations.
WebDriver sees the page, not the GTK widgets around it, and `issue_engine_binary` always opens a
native picker, so registering an engine (and therefore any check needing a live engine child)
cannot be automated this way.

## Standing cautions

- **Do not restate an exact commit count or "in sync" here**.
- **Before attributing the next ratchet disagreement to the machine, check whether the
  divergent records are simply untested**. Note that `BRDA` block/branch identity is not stable
  across builds, so ~170 records routinely flip in each direction and cancel.
- **Never rewrite a baseline to clear a red ratchet** (`docs/coverage.md`). Baseline writes are
  protected by the `scripts/coverage-report.mjs` writer guard (`d-20260927-23`):
  `--instrument-change <d-id> --finding <f-id>` must name a decision in `tasks/decisions.md` whose
  `Governs:` line names the finding before any decrease or recorded scope/area-set change is
  accepted. The writer prints every per-area, per-metric delta.
- Never re-record snapshots on a host.
- A gate is settled when the runner agrees with this machine, not when it passes here.
- The 2026-08-09 audit **has not been reviewed line by line**. What was proven at the time is
  that the gates then run were green — not that every change is right, and not that every gate is
  green today. Defects found while getting the gates green are listed in `BACKEND_AUDIT_PLAN.md`
  and `FRONTEND_AUDIT_PLAN.md`. Treat the rest of that diff as unreviewed.

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
atomically per cohesive area. Verified task-owned work is committed automatically under the active
workflow's authority; delegated leaves never stage or commit. Pushes go through `$push`; a `build`
run or drain session invoking it is the request (global rule 13). `$push` never tags, releases,
or deploys.
