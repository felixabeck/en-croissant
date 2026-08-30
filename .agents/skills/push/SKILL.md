---
name: push
description: Validate, independently review, remediate, commit, and ordinarily push En Croissant changes to the current branch's configured upstream. Use only when Felix explicitly asks to push; push is not a release or deployment.
---

# Push En Croissant

Complete the push autonomously. Read `~/.claude/references/push-review-policy.md` first; it is the single source for authorization, attribution, review lenses, model allocation, triage, remediation, and red-gate behavior. This skill adds only En-Croissant mechanics.

## 1. Establish the exact push scope

- Inspect `git status --porcelain=v1`, `git branch --show-current`, `git rev-parse --abbrev-ref @{u}`, `git remote get-url origin`, and `git remote get-url --push origin`.
- This repository's expected remote is `felixabeck/en-croissant` in either of its two legitimate forms — `git@github.com:felixabeck/en-croissant.git` (the `tuxedo-atlas` clone) or `https://github.com/felixabeck/en-croissant.git`. Any other owner, repository or host is a stop. Reject a separate `remote.origin.pushurl`. The current local branch must track the same-named `origin/<branch>`; `master` therefore must track `origin/master`. Stop for Felix if any identity is missing or different. Never invent or change a remote/upstream.
- Build an explicit owned-path manifest from files created or edited in the invoking conversation plus file scopes assigned to its finished workers. Compare it with the initial status. Ambiguous or foreign paths are excluded and left untouched; if an already-committed foreign change would be exported, stop for Felix. Commit only manifest paths in cohesive atomic commits and never use `git add -A`.
- Gates execute against the complete worktree. Therefore stop before any compile, generator, formatter, or browser gate when a foreign dirty path is code, generated output, dependency/configuration, test, asset, locale, workflow, or another input to an affected gate. Only clearly inert foreign Markdown/planning files may remain. Never generate or commit an owned output from foreign dirty inputs.
- Every workflow-created commit sets `GIT_COMMITTER_NAME` to the acting agent per `~/.claude/references/push-review-policy.md` §1 (`Codex`, `Claude Code`, or `Grok`). Leave the author untouched and add no co-author trailer.
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
cargo fmt --manifest-path src-tauri/Cargo.toml -- --check
cargo check --manifest-path src-tauri/Cargo.toml --all-targets
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings
cargo test --manifest-path src-tauri/Cargo.toml --all-targets
pnpm test:coverage:backend
pnpm coverage:backend:check
```

`test:coverage:backend` needs the pinned `nightly-2025-06-01` toolchain with `llvm-tools-preview` and `cargo-llvm-cov` 0.8.7 (the versions `.github/workflows/test.yml` installs); `coverage:backend:check` reads the LCOV it writes, so the two run in that order. `spawn cargo ENOENT` from any of these means `~/.cargo/bin` is missing from that shell's `PATH`, not that the checkout is broken — prefix the call with `PATH="$HOME/.cargo/bin:$PATH"`.

### TypeScript/React frontend

Affected by `src/**`, `public/**`, `index.html`, `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `vite.config.*`, or i18n configuration/catalogs:

```bash
pnpm lint:ci
pnpm tauri:boundary:check
pnpm ui:boundary:check
pnpm coverage:report:test
pnpm bundle:report:test
pnpm test:coverage
pnpm coverage:frontend:check
pnpm build-vite
pnpm bundle:check
```

The order is not cosmetic: `coverage:frontend:check` reads `coverage/lcov.info` written by `test:coverage`, and `bundle:check` reads `dist/.vite/manifest.json` written by `build-vite`. `pnpm test` alone is not sufficient — it produces no LCOV, so the coverage ratchet then measures a stale or absent file.

`ui:boundary:check` scans the whole tree, reading files from disk, so it sees committed and uncommitted content alike. It was diff-scoped for two of its rules until 2026-08-29, which made those two vacuous on any clean checkout — including every CI run.

The coverage floors in `coverage-areas.json` / `backend-coverage-areas.json` and the baselines in the two `*-baselines.json` files are ratchets, and `bundle-budgets.json` caps gzip bytes. A red ratchet is a finding about the diff. Never run `coverage:baseline:*` or edit a budget to make a gate pass.

For visible UI changes, run the repo-local `$verify-ui` workflow after the static gates (it owns `pnpm test:e2e:container` and the live Tauri-window check). Retain screenshots of every affected flow. Missing screenshots are not evidence that layout is correct.

### Cross-layer contracts

Changes to Specta commands/events/types, `src-tauri/src/main.rs`, or `src/bindings/generated.ts` require both backend and frontend gates plus `pnpm bindings:check`. That command runs the debug Specta exporter in export-only mode and then proves the checked-in binding is exact. Never hand-edit a generated binding to make the gate pass.

### Findings ledger

Affected by `tasks/**` or `scripts/findings.py`:

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

- Changes to `.github/workflows/**`, `package.json`, `pnpm-lock.yaml`, `src-tauri/Cargo.toml`, or `src-tauri/Cargo.lock` run every gate whose toolchain they can affect.
- `pnpm verify:app` is not a push gate either, and for a different reason: it drives the real Tauri window through `tauri-driver` under an off-screen compositor, so it needs a release build and a compositor that CI does not have. Run it by hand when a diff changes lifecycle, IPC or process teardown — it is the only check in this repository that observes the actual product. `d-20260830-18` and `.claude/skills/verify-ui/SKILL.md` carry the contract and the limits.
- Neither mutation suite is a *local* push gate, but they are not equivalent. `mutation:frontend` (~21 s) runs in `test.yml` on every push, so CI covers it; `mutation:backend` runs only in `.github/workflows/mutation.yml` (dispatchable, weekly, one job per package) because the eight packages take about an hour. **Never start `pnpm mutation:backend` as part of a push:** it runs `cargo-mutants --in-place`, so it edits tracked source while it runs, every other gate would then measure mutated code, and an interruption leaves an injected mutant behind (`f-20260829-09`).
- Exercise changed shell/workflow mechanics against their refusal/error case where locally possible.
- `$push` never tags, publishes a GitHub release, signs bundles, or deploys. Those require their own explicit workflow.

## 3. Independent review and remediation

Apply the shared policy's medium three-lens or high five-lens review over the effective pushed diff plus enclosing code. Run high review when any path below is touched:

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

Triage every ≥80-confidence finding as `Fix` or `Skip(reason)`, repair every genuine long-term gain, inspect each repair diff, and rerun every gate invalidated by the repair. Security and filesystem refusal paths must be exercised, not merely read.

En-Croissant runtime compatibility addition: the lens executor, its model rungs and the fallback switch are governed by `~/.claude/references/review-lens-contract.md`. Do not restate them here. If a runtime exposes none of the contract's model names, use independent typed reviewer agents with the smallest self-contained context and disclose that the review used the same model family as the author. Do not silently run the lenses inline while fan-out exists. AntiGravity reviews follow Felix's configured quota order: Gemini first, then Claude Opus at its second-highest reasoning level; never Sonnet or GPT there.

## 4. Commit, push, and verify

- Require `git diff --check`, all affected gates green on the final tree, and no unresolved `Fix` finding.
- Commit only the remaining authorized paths with the attribution above.
- Run ordinary non-force `git push` to the configured upstream.
- Verify local `HEAD` equals `@{u}` and report commits, destination, gate results, review findings/verdicts, and that no release/deployment occurred.
- On any persistent red gate, follow the shared policy: do not push and report the exact blocker.

En-Croissant override to shared policy §7: this workflow never performs a force push. A message containing `force push` requires a separate stop for the exact refspec and force-with-lease decision; it is not treated as an automatic gate-skip-and-push marker here.
