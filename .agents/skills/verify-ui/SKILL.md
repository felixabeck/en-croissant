---
name: verify-ui
description: Verify En Croissant UI changes. Automated proof is Playwright e2e; the live product is the Tauri window. Chrome MCP is not a valid verifier for this desktop app.
---

# verify-ui (Codex)

Read `.claude/skills/verify-ui/SKILL.md` first. That file is the source
of truth. This file only names the Codex runtime.

- Automated visual proof: `pnpm test:e2e` (mocked native, preview `:4173`).
- Live product: `pnpm dev`. You cannot attach a browser to the Tauri
  webview. Do not use in-app Browser or chrome-devtools on
  `pnpm start-vite` as layout evidence — Vite-only crashes in `TopBar.tsx`.
- Report the e2e result and whether Felix still needs to look at the
  Tauri window. Do not claim a browser verified the app.
