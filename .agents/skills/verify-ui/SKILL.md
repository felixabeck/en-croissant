---
name: verify-ui
description: Verify En Croissant UI changes. Pixels are Playwright e2e; the real product is driven off-screen by `pnpm verify:app`; only native GTK chrome is left to Felix. Chrome MCP is never a valid verifier for this desktop app.
---

# verify-ui (Codex)

Read `.claude/skills/verify-ui/SKILL.md` first and follow that contract.
This file only names the Codex runtime: do not use in-app Browser or
chrome-devtools on `pnpm start-vite` as layout evidence.

Two pointers, because these are the commands you will otherwise guess wrong:

* Pixels: `pnpm test:e2e:container`, never the native `pnpm test:e2e`.
* Real product behaviour: `pnpm verify:app`. It drives the actual Tauri window
  off-screen through `tauri-driver` and `WebKitWebDriver` — real backend, real
  IPC, real WebKitGTK. Use it for lifecycle, IPC and process-teardown claims
  that the mocked container suite cannot answer.

Native GTK chrome — menus, file dialogs, window decorations — is outside both,
and stays Felix's. The reasoning lives in the canonical file.
