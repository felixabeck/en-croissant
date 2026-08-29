---
name: verify-ui
description: Verify En Croissant UI changes. Automated proof is Playwright e2e; the live product is the Tauri window. Chrome MCP is not a valid verifier for this desktop app.
---

# verify-ui (Codex)

Read `.claude/skills/verify-ui/SKILL.md` first and follow that contract.
This file only names the Codex runtime: do not use in-app Browser or
chrome-devtools on `pnpm start-vite` as layout evidence.

One pointer, because it is the command you will otherwise guess wrong:
the automated proof is `pnpm test:e2e:container`, never the native
`pnpm test:e2e`. The reasoning lives in the canonical file.
