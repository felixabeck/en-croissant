---
name: push
description: Validate, independently review, remediate, commit, and push En Croissant changes when Felix explicitly requests a push. Push is not release or deployment.
---

# push (Codex bridge)

Read `.claude/skills/push/SKILL.md` first and follow that canonical En Croissant workflow.
Read `~/.claude/references/push-review-policy.md` before its first step.

Codex runtime deltas:

* Use `GIT_COMMITTER_NAME="Codex"` for every commit this workflow creates. Leave the author
  untouched and add no AI or co-author trailer.
* Run the shared review-policy lenses and fixes with Codex's available subagents as directed by
  `~/.claude/references/review-lens-contract.md`.
* Push only when Felix explicitly requests it. Push never releases or deploys.
