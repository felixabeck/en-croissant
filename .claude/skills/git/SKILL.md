---
name: git
description: Create one explicit, well-scoped En Croissant commit without pushing or adding AI/co-author trailers.
---

# Git — smart commit

This is the canonical En Croissant commit workflow. It commits only when Felix explicitly asks to
commit, invokes `/git`, or invokes `$git`.

## Inspect and scope

* Read `git status`, the unstaged and staged diffs, and the recent log before staging anything.
* Select one cohesive change. Preserve foreign work and never use `git add -A` or `git add .`.
* Match the repository's concise conventional-commit style; use an imperative summary and add a
  body only when it carries useful context.

## Verify and commit

* Never commit on red. Use the verification already run for the affected change. If nothing ran,
  run the narrowest affected check from `.claude/skills/push/SKILL.md`; do not copy its mapping here
  and do not run the full push workflow.
* Never bypass hooks with `--no-verify`.
* Commit with `GIT_COMMITTER_NAME="Claude Code"`. Leave the author untouched and add no AI or
  co-author trailer.
* Do not push. Push requires a separate explicit request and the canonical push workflow.
