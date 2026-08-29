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

1. **Automated visual matrix:** `pnpm test:e2e:container`. Playwright
   builds the renderer, serves preview on `http://127.0.0.1:4173`, and
   mocks native commands. That is the committed screenshot suite. Do not
   invent a second login or Tauri-mock driver.

   **Run it in the container, not natively.** `pnpm test:e2e` runs the same
   specs on the host, and the committed screenshots match what
   `mcr.microsoft.com/playwright:v<version>-noble` renders - measured
   2026-08-29, 8/8 green in the image with no snapshot rewritten. Natively on
   `tuxedo-atlas` the same specs fail on text rasterization alone - 47-680
   pixels differing along glyph edges, every box and control aligned to the
   pixel. That is not a layout regression and re-recording is not the fix;
   see `tasks/decisions.md`, `d-20260829-01`. `scripts/run-e2e-container.mjs`
   derives the image tag from the installed `@playwright/test` version, runs
   as the invoking user so nothing lands root-owned, and needs docker.

   Snapshots are re-recorded with `pnpm test:e2e:container:update` and
   **never** with `pnpm test:e2e:update`, which would write host-rendered
   images back over the canonical ones. The project settings deny the native
   variant for that reason.
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

4. Run `pnpm test:e2e:container` (add `-- --project=<name>` for a single
   affected project). Keep the snapshots. Missing snapshots are not
   evidence that layout is correct.
5. For responsive work, the committed matrix already includes 320px and
   200% font-scale. That layout is a known open defect (clipped headings,
   `f-20260829-02` in `tasks/findings.md`); a screenshot that records the
   clip is not evidence that it is fixed.
6. If the change can only be judged in the real webview (native dialogs,
   engine process, window chrome), start `pnpm dev` if it is not already
   running and name the window check as Felix's, not the agent's.

## Report

Name the e2e command and result, which snapshots moved, and whether a
Tauri window check is still needed. Do not claim Chrome MCP verified the
app.
