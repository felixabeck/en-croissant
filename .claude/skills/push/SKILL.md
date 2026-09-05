---
name: push
description: Validate, independently review, remediate, commit, and ordinarily push ChessFable changes to the current branch's configured upstream. Use only when Felix explicitly asks to push; push is not a release or deployment.
disable-model-invocation: false
---

# Push ChessFable

Complete the push autonomously. Read `~/.claude/references/push-review-policy.md` first; it is the single source for authorization, attribution, review lenses, model allocation, triage, remediation, and red-gate behavior. This skill adds only ChessFable mechanics.

## Relationship to the `build` skill

The normal route for a change is the user-wide `build` skill
(`~/.claude/skills/build/SKILL.md`). It orchestrates planning, implementation, review, and
delivery in one session and consumes this file's gate mapping, sensitive-path globs, review tier,
and project `Skip` catalog instead of duplicating them.

`$push` remains standalone for changes created outside that workflow, including manual commits,
interrupted runs, and accumulated work from another session.

## 1. Establish the exact push scope

- Inspect `git status --porcelain=v1`, `git branch --show-current`, `git rev-parse --abbrev-ref @{u}`, `git remote get-url origin`, and `git remote get-url --push origin`.
- This repository's expected remote is `felixabeck/en-croissant` in either of its two legitimate forms — `git@github.com:felixabeck/en-croissant.git` (the `tuxedo-atlas` clone) or `https://github.com/felixabeck/en-croissant.git`. Any other owner, repository or host is a stop. Reject a separate `remote.origin.pushurl`. The current local branch must track the same-named `origin/<branch>`; `master` therefore must track `origin/master`. Stop for Felix if any identity is missing or different. Never invent or change a remote/upstream.
- Build an explicit owned-path manifest from files created or edited in the invoking conversation plus file scopes assigned to its finished workers. Compare it with the initial status. Ambiguous or foreign paths are excluded and left untouched; if an already-committed foreign change would be exported, stop for Felix. Commit only manifest paths in cohesive atomic commits and never use `git add -A`.
- Gates execute against the complete worktree. Therefore stop before any compile, generator, formatter, or browser gate when a foreign dirty path is code, generated output, dependency/configuration, test, asset, locale, workflow, or another input to an affected gate. Only clearly inert foreign Markdown/planning files may remain. Never generate or commit an owned output from foreign dirty inputs.
- Every workflow-created commit sets `GIT_COMMITTER_NAME` to the acting agent per `~/.claude/references/push-review-policy.md` §1 (`Claude Code`, `Codex`, or `Grok`). Claude Code reads this file directly; Codex reaches it through `.agents/skills/push/SKILL.md`, which names its own committer. Leave the author untouched and add no co-author trailer.
- Determine pushed files from `BASE=$(git merge-base HEAD @{u})` and both the committed and owned dirty diffs. Review `git diff "$BASE"..HEAD`, `git diff -- <owned tracked paths>`, `git diff --cached -- <owned tracked paths>`, plus each owned untracked file as a new-file diff. An explicit push includes already-ahead commits, so review their effective diff too.

Markdown/planning-only changes need no build gate, but still require the shared review and clean-diff checks.

## 2. Run affected gates

Run commands serially for readable failures. A failure is repaired and the affected gates rerun before review.

Before any other gate, refuse a checkout whose interrupted in-place mutation run still owns the
backend tree:

```bash
pnpm mutation:guard:check
```

**Gate on the exit code, never on a line of output.** `pnpm lint:ci && echo green || echo red` reports the failure and still leaves the shell at exit 0, so a `&&`-chained commit behind it proceeds over a red gate. Check `$?` (or `${PIPESTATUS[0]}` behind a pipe, with `set -o pipefail`) and stop. *Measured 2026-08-29: a formatting failure was printed as `lint:ci RED` and the same command committed and pushed anyway, which took a second commit to repair.*

### Rust/Tauri backend

Affected by `src-tauri/**` or root Rust/Tauri configuration:

```bash
pnpm rust:surface:check
cargo fmt --manifest-path src-tauri/Cargo.toml -- --check
cargo check --manifest-path src-tauri/Cargo.toml --all-targets
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings
pnpm gate:ensure backend-test
pnpm gate:ensure backend-coverage
```

`test:coverage:backend` needs the pinned `nightly-2025-06-01` toolchain with `llvm-tools-preview` and `cargo-llvm-cov` 0.8.7 (the versions `.github/workflows/test.yml` installs); `coverage:backend:check` reads the LCOV it writes, so the two run in that order. `spawn cargo ENOENT` from any of these means `~/.cargo/bin` is missing from that shell's `PATH`, not that the checkout is broken — prefix the call with `PATH="$HOME/.cargo/bin:$PATH"`.

### TypeScript/React frontend

Affected by `src/**`, `public/**`, `index.html`, `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `vite.config.*`, `stryker.config.mjs`, `scripts/run-frontend-mutation.mjs`, `scripts/frontend-mutation-packages.mjs`, or i18n configuration/catalogs:

```bash
pnpm lint:ci
pnpm tauri:boundary:check
pnpm ui:boundary:check
pnpm coverage:report:test
pnpm bundle:report:test
pnpm gate:ensure frontend-coverage
pnpm gate:ensure frontend-mutation
pnpm gate:ensure frontend-build
pnpm bundle:check
```

The order is not cosmetic: `coverage:frontend:check` reads `coverage/lcov.info` written by `test:coverage`, and `bundle:check` reads `dist/.vite/manifest.json` written by `build-vite`. `pnpm test` alone is not sufficient — it produces no LCOV, so the coverage ratchet then measures a stale or absent file.

`ui:boundary:check` scans the whole tree, reading files from disk, so it sees committed and uncommitted content alike. It was diff-scoped for two of its rules until 2026-08-29, which made those two vacuous on any clean checkout — including every CI run.

The coverage floors in `coverage-areas.json` / `backend-coverage-areas.json` and the baselines in the two `*-baselines.json` files are ratchets, and `bundle-budgets.json` caps gzip bytes. A red ratchet is a finding about the diff. Never run `coverage:baseline:*` or edit a budget to make a gate pass.

For visible UI changes, run the repo-local `$verify-ui` workflow after the static gates (it owns `pnpm test:e2e:container` and the live Tauri-window check). Retain screenshots of every affected flow. Missing screenshots are not evidence that layout is correct.

### Exact-tree gate receipts

The seven expensive gates are registered in `scripts/gate-receipt.mjs`. Use `ensure` for normal gate
runs, `run` when fresh evidence is required, and `check` only to query the cache:

```bash
pnpm gate:ensure backend-test
pnpm gate:ensure backend-coverage
pnpm gate:ensure frontend-coverage
pnpm gate:ensure frontend-mutation
pnpm gate:ensure frontend-build
pnpm gate:ensure e2e-container
pnpm gate:ensure tauri-build
pnpm gate:run frontend-build
pnpm gate:check frontend-build
pnpm gates:receipt:test
```

Receipts are reusable only for a clean exact tree with the same command, platform, toolchain, and
an unexpired timestamp. A miss runs the gate under `ensure`; `check` never starts one. Gate failures
propagate their own exit codes, and a tree change during a run refuses the receipt.

### Cross-layer contracts

Changes to Specta commands/events/types, `src-tauri/src/main.rs`, or `src/bindings/generated.ts` require both backend and frontend gates plus `pnpm bindings:check`. That command runs the debug Specta exporter in export-only mode and then proves the checked-in binding is exact. Never hand-edit a generated binding to make the gate pass.

### Findings ledger

`pnpm findings:kit:check` runs `kit sync --check .` and is local-only (`bash "$HOME/Projekte/agent-kit/bin/kit" sync --check .`;
CI has no kit). It runs on **every** push: `scripts/findings.py` is the kit's vendored copy, and
this line fails if those bytes have drifted from `~/Projekte/agent-kit`.

```bash
pnpm findings:kit:check
```

`python3 scripts/findings.py check` and `pnpm findings:test` run **only** when `tasks/**` or
`scripts/findings.py` changed:

```bash
python3 scripts/findings.py check
pnpm findings:test
```

`check` validates the ledger: a malformed header or an area outside the closed vocabulary silently
drops a finding out of the derived queue, which is exactly the loss the ledger exists to prevent.
`tasks/findings.md` names this gate as `$push`'s job, so it runs here.

`findings:test` is the only test over `scripts/findings.py` itself, and it is deliberately narrow —
it pins the failure reporting of `_atomic_write` (f-20260829-14), not the tool's behaviour at large.
`scripts/findings.py` is byte-identical across Felix's projects by contract, so **nothing
repository-specific may be added to it**; a change there is a change to every copy, and the test
lives beside it rather than inside it for that reason.

### CI, dependencies, and release mechanics

Changes to `.claude/hooks/**` or `.claude/settings.json` run:

```bash
pnpm hooks:check
```

- Changes to `.github/workflows/**` run:

```bash
pnpm workflows:check
pnpm workflows:permissions:test
pnpm tools:parity:check
```

  Changes to those paths, `package.json`, `pnpm-lock.yaml`, `src-tauri/Cargo.toml`, or `src-tauri/Cargo.lock` also run every gate whose toolchain they can affect.
- `pnpm verify:app` is not a push gate either, and for a different reason: it drives the real Tauri window through `tauri-driver` under an off-screen compositor, so it needs a release build and a compositor that CI does not have. Run it by hand when a diff changes lifecycle, IPC or process teardown — it is the only check in this repository that observes the actual product. `d-20260830-18` and `.claude/skills/verify-ui/SKILL.md` carry the contract and the limits.
- The frontend mutation suite is a receipt-backed frontend push gate: run it through `pnpm gate:ensure frontend-mutation` (measured 323 s on the runner). The backend suite remains only in `.github/workflows/mutation.yml` (dispatchable, weekly, one job per package) because the eight packages take about an hour. **Never start `pnpm mutation:backend` as part of a push:** it runs `cargo-mutants --in-place`, so it edits tracked source while it runs, every other gate would then measure mutated code, and an interruption leaves an injected mutant behind (`f-20260829-09`).
- Exercise changed shell/workflow mechanics against their refusal/error case where locally possible.
- `$push` never tags, publishes a GitHub release, signs bundles, or deploys. Those require their own explicit workflow.

## 3. Independent review and remediation

Run the review exactly as `~/.claude/references/push-review-policy.md` §§2–4 specify — named
lenses over the effective pushed diff plus enclosing code; `review-correctness` and
`review-root-cause` always on; the rest when their `description:` line applies. Every finding
gets a `Fix` / `Defer` / `Skip(reason)` verdict. Out-of-area findings are `Defer`d autonomously
to `tasks/findings.md` plus one handoff prompt (policy §4, universal rule 4b); never ask Felix
which.

A path below is a Sensitive-Path glob: a hit is `--role sensitive` for that lens (and for
fixes); everything else is `--role normal`. The globs do not replace named-lens selection.

```text
src-tauri/capabilities/**
src-tauri/tauri.conf.json
src-tauri/src/oauth.rs
src-tauri/src/fs.rs
src-tauri/src/pgn.rs
src-tauri/src/puzzle.rs
src-tauri/src/infra/**
src-tauri/src/db/**
src-tauri/src/chess.rs
src-tauri/src/game.rs
src-tauri/src/engine/**
src-tauri/src/main.rs
src/bindings/generated.ts
src/state/**
src/utils/lichess/**
src/utils/session.ts
src/components/home/Account*.tsx
src/components/common/AccountCards.tsx
src/routes/accounts*.tsx
src/components/engines/**
.github/workflows/**
package.json
pnpm-lock.yaml
src-tauri/Cargo.toml
src-tauri/Cargo.lock
```

`review-tauri-security` is a mandatory additive lens whenever the diff touches any of these
paths:

```text
src-tauri/src/oauth.rs
src-tauri/src/credentials.rs
src/utils/session.ts
src-tauri/src/fs.rs
src-tauri/src/infra/**
docs/signed-download-manifests.md
```

It does not replace `review-ipc-contract`: capability and CSP scope, `src-tauri/tauri.conf.json`,
the Specta registry and generated bindings, and listener lifetimes remain owned by that lens.

Repair every `Fix`, inspect each repair diff, and rerun every gate invalidated by the repair.
Security and filesystem refusal paths must be exercised, not merely read.

ChessFable runtime compatibility addition: the lens executor, its model rungs and the fallback switch are governed by `~/.claude/references/review-lens-contract.md`. Do not restate them here. If a runtime exposes none of the contract's model names, use independent typed reviewer agents with the smallest self-contained context and disclose that the review used the same model family as the author. Do not silently run the lenses inline while fan-out exists. AntiGravity reviews follow Felix's configured quota order: Gemini first, then Claude Opus at its second-highest reasoning level; never Sonnet or GPT there.

## Project `Skip` catalog

ChessFable adds these rejected actions to the shared policy §4 `Skip` catalog:

* Rebaselining coverage or lowering a coverage floor to clear a ratchet.
* Re-recording e2e snapshots natively.
* Hand-editing `src/bindings/generated.ts`.
* Running `mutation:backend` during a push.
* Widening a capability scope to make a build pass.

## Override keywords

Use the exact-string override keywords from
`~/.claude/references/push-review-policy.md` §7.

## 4. Commit, push, and verify

- Require `git diff --check`, all affected gates green on the final tree, and no unresolved `Fix` finding.
- Commit only the remaining authorized paths with the attribution above.
- Run ordinary non-force `git push` to the configured upstream.
- Verify local `HEAD` equals `@{u}` and report commits, destination, gate results, review findings/verdicts, and that no release/deployment occurred.
- On `master`, after that verification, run `bash scripts/install-local.sh` (a Tauri release build followed by an atomic swap of `~/.local/opt/chessfable/current`). This is how a pushed change reaches the application-menu entry Felix uses; nothing else updates it, and it is not a release or deployment. Report the installed short commit from `~/.local/opt/chessfable/current/VERSION`. If the build fails, the push stands and the failure is reported as its own blocker — the previous installed copy keeps running.
- On any persistent red gate, follow the shared policy: do not push and report the exact blocker.

ChessFable override to shared policy §7: this workflow never performs a force push. A message containing `force push` requires a separate stop for the exact refspec and force-with-lease decision; it is not treated as an automatic gate-skip-and-push marker here.
