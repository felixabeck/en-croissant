---
name: verify-ui
description: Verify En Croissant UI changes. Automated proof is Playwright e2e; the live product is the Tauri window. Chrome MCP is not a valid verifier for this desktop app.
---

# verify-ui (Codex)

Read `.claude/skills/verify-ui/SKILL.md` first and follow that contract.
This file only names the Codex runtime: do not use in-app Browser or
chrome-devtools on `pnpm start-vite` as layout evidence.

Two things from that contract that are easy to miss: the automated proof is
`pnpm test:e2e:container` (the committed screenshots match what the pinned
Playwright image renders, so a native run fails on font rasterization alone),
and snapshots are re-recorded only with `pnpm test:e2e:container:update`.
