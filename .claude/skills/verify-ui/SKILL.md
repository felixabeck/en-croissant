---
name: verify-ui
description: Verify En Croissant UI changes. Automated proof is Playwright e2e; the live product is the Tauri window. Chrome MCP is not a valid verifier for this desktop app.
---

# Verify UI (En Croissant)

This file is the source of truth. Codex follows
`.agents/skills/verify-ui/SKILL.md` after reading this contract.

TypeScript + vitest catch code correctness, not layout. Chrome MCP cannot
attach to the Tauri webview. There is no documented remote-devtools path.

## What counts as proof

1. **Automated visual matrix:** `pnpm test:e2e`. Playwright builds the
   renderer, serves preview on `http://127.0.0.1:4173`, and mocks native
   commands. That is the committed screenshot suite. Do not invent a
   second login or Tauri-mock driver.
2. **Live product window:** `pnpm dev` opens the Tauri webview. The agent
   cannot attach Chrome MCP (Claude-in-chrome or user-wide
   chrome-devtools) to that window. Say so and ask Felix to look, or stop
   at the e2e evidence. Do not report the Tauri window as browser-verified.
3. **Invalid evidence:** `pnpm start-vite` on `http://localhost:1420`
   plus any Chrome MCP. Vite-only has no Tauri backend. `TopBar.tsx` calls
   `getCurrentWebviewWindow()` at module scope and crashes with
   `Cannot read properties of undefined (reading 'metadata')`. A blank
   page is not a layout check.

There is no authenticated local page. Do not invent a login driver. This
repo has no `scripts/dev-up.sh`.

## After a visible UI change

4. Run `pnpm test:e2e` (or the affected Playwright project). Keep the
   snapshots. Missing snapshots are not evidence that layout is correct.
5. For responsive work, the committed matrix already includes 320px and
   200% font-scale. That layout is a known open defect (clipped headings);
   a screenshot that records the clip is not evidence that it is fixed.
6. If the change can only be judged in the real webview (native dialogs,
   engine process, window chrome), start `pnpm dev` if it is not already
   running and name the window check as Felix's, not the agent's.

## Report

Name the e2e command and result, which snapshots moved, and whether a
Tauri window check is still needed. Do not claim Chrome MCP verified the
app.
