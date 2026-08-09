---
name: push
description: Validate, independently review, remediate, commit, and push En Croissant changes when Felix explicitly requests a push. Push is not release or deployment.
---

# Push En Croissant

Read `.agents/skills/push/SKILL.md` and execute that canonical project workflow. Read `~/.claude/rules/push-review-policy.md` before its first step. Do not copy either policy into this bridge.

When Claude runs the workflow, use `GIT_COMMITTER_NAME="Claude Code"` instead of the Codex attribution named by the canonical mechanics. All other gates, review requirements, boundaries, and configured-upstream checks remain identical.
