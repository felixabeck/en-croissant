---
name: push
description: Validate, independently review, remediate, commit, and push ChessFable changes when Felix requests a push or a drain session or build run invokes this skill. Push is not release or deployment.
---

# push (Codex bridge)

Read `.claude/skills/push/SKILL.md` first and follow that canonical ChessFable workflow.
Read `~/.claude/references/push-review-policy.md` before its first step.

Codex runtime deltas:

* Use `GIT_COMMITTER_NAME="Codex"` for every commit this workflow creates. Leave the author
  untouched and add no AI or co-author trailer.
* Run the shared review-policy lenses and fixes on the selected executor as directed by
  `~/.claude/references/review-lens-contract.md` and `~/.claude/references/executor-profiles.md`.
* Push when Felix requests it, or when a drain session (`--yes` at drain start) or a `build` run invokes this skill — that invocation is the explicit request (`~/.claude/references/push-review-policy.md` §1); commits already ahead of the upstream are carried, never a stop. Push never releases or deploys.
