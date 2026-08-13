---
name: push
description: Validate, independently review, remediate, commit, and push En Croissant changes when Felix explicitly requests a push. Push is not release or deployment.
---

# Push En Croissant

Read `.agents/skills/push/SKILL.md` and execute that canonical project workflow. Read `~/.claude/references/push-review-policy.md` before its first step. Do not copy either policy into this bridge.

When Claude runs the workflow, use `GIT_COMMITTER_NAME="Claude Code"` as the acting-agent name from `~/.claude/references/push-review-policy.md` §1. All other gates, review requirements, boundaries, and configured-upstream checks remain identical.
