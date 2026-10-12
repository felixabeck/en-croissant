---
name: push
description: Validate, independently review, remediate, commit, and push ChessFable changes when Felix requests a push or a drain session or build run invokes this skill. Push is not release or deployment.
---

# push (Codex bridge)

Read `.claude/skills/push/SKILL.md` first and follow that canonical ChessFable workflow.
Read `~/.claude/references/push-review-policy.md` before its first step.

Follow the canonical execution order and stage-emission contract above.

In an opted-in linked worktree, require target `master` and upstream `origin/master`, then release
rebased commits with `git push origin HEAD:refs/heads/master`. Never push a `build/*` or `drain/*`
branch or open it as a PR. Keep the canonical remote-CI wait. After a verified release to `master`,
run `bash scripts/install-local.sh` from the main checkout on `master` or the releasing worktree
whose target is `master`.

* Use `GIT_COMMITTER_NAME="Codex"` for every commit; leave the author untouched and add no
  co-author trailer.
