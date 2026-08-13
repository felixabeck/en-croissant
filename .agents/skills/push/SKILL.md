---
name: push
description: Validate, independently review, remediate, commit, and ordinarily push En Croissant changes to the current branch's configured upstream. Use only when Felix explicitly asks to push; push is not a release or deployment.
---

# Push En Croissant

Complete the push autonomously. Read `~/.claude/references/push-review-policy.md` first; it is the single source for authorization, attribution, review lenses, model allocation, triage, remediation, and red-gate behavior. This skill adds only En-Croissant mechanics.

## 1. Establish the exact push scope

- Inspect `git status --porcelain=v1`, `git branch --show-current`, `git rev-parse --abbrev-ref @{u}`, `git remote get-url origin`, and `git remote get-url --push origin`.
- This repository's expected fetch and push URL is exactly `https://github.com/felixabeck/en-croissant.git`; reject a separate `remote.origin.pushurl`. The current local branch must track the same-named `origin/<branch>`; `master` therefore must track `origin/master`. Stop for Felix if any identity is missing or different. Never invent or change a remote/upstream.
- Build an explicit owned-path manifest from files created or edited in the invoking conversation plus file scopes assigned to its finished workers. Compare it with the initial status. Ambiguous or foreign paths are excluded and left untouched; if an already-committed foreign change would be exported, stop for Felix. Commit only manifest paths in cohesive atomic commits and never use `git add -A`.
- Gates execute against the complete worktree. Therefore stop before any compile, generator, formatter, or browser gate when a foreign dirty path is code, generated output, dependency/configuration, test, asset, locale, workflow, or another input to an affected gate. Only clearly inert foreign Markdown/planning files may remain. Never generate or commit an owned output from foreign dirty inputs.
- Every workflow-created commit uses `GIT_COMMITTER_NAME="Codex" git commit ...`; leave the author untouched and add no co-author trailer.
- Determine pushed files from `BASE=$(git merge-base HEAD @{u})` and both the committed and owned dirty diffs. Review `git diff "$BASE"..HEAD`, `git diff -- <owned tracked paths>`, `git diff --cached -- <owned tracked paths>`, plus each owned untracked file as a new-file diff. An explicit push includes already-ahead commits, so review their effective diff too.

Markdown/planning-only changes need no build gate, but still require the shared review and clean-diff checks.

## 2. Run affected gates

Run commands serially for readable failures. A failure is repaired and the affected gates rerun before review.

### Rust/Tauri backend

Affected by `src-tauri/**` or root Rust/Tauri configuration:

```bash
cargo fmt --manifest-path src-tauri/Cargo.toml -- --check
cargo check --manifest-path src-tauri/Cargo.toml --all-targets
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings
cargo test --manifest-path src-tauri/Cargo.toml --all-targets
```

### TypeScript/React frontend

Affected by `src/**`, `public/**`, `index.html`, `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `vite.config.*`, or i18n configuration/catalogs:

```bash
pnpm lint:ci
pnpm test
pnpm build-vite
```

For visible UI changes, run `pnpm test:e2e` and the repo-local `$verify-ui` real-browser workflow after the static gates, then retain screenshots of every affected flow. Missing screenshots are not evidence that layout is correct.

### Cross-layer contracts

Changes to Specta commands/events/types, `src-tauri/src/main.rs`, or `src/bindings/generated.ts` require both backend and frontend gates plus `pnpm bindings:check`. That command runs the debug Specta exporter in export-only mode and then proves the checked-in binding is exact. Never hand-edit a generated binding to make the gate pass.

### CI, dependencies, and release mechanics

- Changes to `.github/workflows/**`, `package.json`, `pnpm-lock.yaml`, `src-tauri/Cargo.toml`, or `src-tauri/Cargo.lock` run every gate whose toolchain they can affect.
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
src/components/accounts/**
src/components/engines/**
.github/workflows/**
package.json
pnpm-lock.yaml
src-tauri/Cargo.toml
src-tauri/Cargo.lock
```

Triage every ≥80-confidence finding as `Fix` or `Skip(reason)`, repair every genuine long-term gain, inspect each repair diff, and rerun every gate invalidated by the repair. Security and filesystem refusal paths must be exercised, not merely read.

En-Croissant runtime compatibility addition: the lens executor, its model rungs and the fallback switch are governed by `~/.claude/references/review-lens-contract.md` — Codex by default (`gpt-5.6-sol`/`medium` on sensitive paths, `gpt-5.6-luna`/`xhigh` otherwise), Claude `Agent` fan-out with pinned `model:` only on the named fallback triggers. A Codex-orchestrated run uses its own read-only subagents on the same rung instead of a nested `codex exec`. If a runtime exposes none of those model names, use independent typed reviewer agents with the smallest self-contained context and disclose that the review used the same model family as the author. Do not silently run the lenses inline while fan-out exists. AntiGravity reviews follow Felix's configured quota order: Gemini first, then Claude Opus at its second-highest reasoning level; never Sonnet or GPT there.

## 4. Commit, push, and verify

- Require `git diff --check`, all affected gates green on the final tree, and no unresolved `Fix` finding.
- Commit only the remaining authorized paths with the attribution above.
- Run ordinary non-force `git push` to the configured upstream.
- Verify local `HEAD` equals `@{u}` and report commits, destination, gate results, review findings/verdicts, and that no release/deployment occurred.
- On any persistent red gate, follow the shared policy: do not push and report the exact blocker.

En-Croissant override to shared policy §7: this workflow never performs a force push. A message containing `force push` requires a separate stop for the exact refspec and force-with-lease decision; it is not treated as an automatic gate-skip-and-push marker here.
