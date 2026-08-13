---
name: verify-ui
description: Verify UI changes in a real browser — measure layout, inspect console, and check the main case plus a regression anchor. Invoke after every UI code change; tsc green + vitest green is not enough for layout correctness.
---

# Verify UI (En Croissant)

This file is the source of truth for the shared contract and for the Claude and Grok browser branches. Codex reads this file for the shared contract, then follows `.agents/skills/verify-ui/SKILL.md` for its own browser runtime.

Invoke after UI-relevant code changes. TypeScript + vitest catch code correctness, not layout rendering. `pnpm test:e2e` is the committed visual matrix; this skill is the live-browser pass.

## Shared: renderer lifecycle

1. Target `http://localhost:1420`, the Vite URL printed by `pnpm start-vite` (`vite.config.ts` port 1420, `strictPort: true`). On this host that binds `[::1]:1420` only — `http://127.0.0.1:1420` is refused. Do not probe or guess another port.
2. Reuse a renderer already serving that URL. If nothing is listening, start `pnpm start-vite`, remember that this verification owns that process, and stop only that process at the end. This repo has no `scripts/dev-up.sh` / `dev-down.sh` — do not invent one, and do not run `pnpm dev` for Chrome MCP. `pnpm dev` opens the Tauri webview, which neither Chrome profile can attach to.
3. Vite-only mode has no Tauri backend. `TopBar.tsx` calls `getCurrentWebviewWindow()` at module scope, so the home shell currently crashes with `Cannot read properties of undefined (reading 'metadata')` and stays blank. Invoke failures, missing splash close, and empty native lists are also expected unless the change is in `src/platform/`. Do not treat those as layout regressions. The committed Playwright suite (`pnpm test:e2e`, preview on `:4173`) is the mocked-native visual matrix; do not invent a second login or Tauri-mock driver for Chrome MCP.

There is no authenticated local page. Do not invent a login driver.

## Browser branch

Pick exactly one branch. Never mix the two Chrome profiles. Never fall back from Grok to claude-in-chrome.

### Claude (claude-in-chrome)

4. **`chrome-bereitmachen`** — run it every time before touching a browser tool (one word, exit 0 = ready). Never start Chrome by hand: a Chrome process that hung during startup still holds the profile's singleton lock, and every further start then only prints "Wird in einer aktuellen Browsersitzung geöffnet" and exits without a window — for the agent and for Felix alike. That state is exactly what this tool detects and repairs. Do not judge Chrome by `pgrep -f google-chrome`; it matches the crashpad handler's arguments and reports a running Chrome when none exists.
5. `mcp__claude-in-chrome__tabs_context_mcp` — get tab state. Read the reply literally: `Browser extension is not connected` = broken (report it as a blocker), `No tab group exists` **or** a tab list = connected.
6. Navigate to the affected route via `mcp__claude-in-chrome__navigate`.
7. Screenshot with `mcp__claude-in-chrome__read_page`.
8. Measure with `mcp__claude-in-chrome__javascript_tool`: `getBoundingClientRect`, computed `grid-template-columns`, overflow state.

### Grok (chrome-devtools)

4. Use the already-configured user-wide `chrome-devtools` MCP. Do **not** run `chrome-bereitmachen` — that tool repairs the visible claude-in-chrome profile. chrome-devtools is headless and has its own profile under `~/.cache/chrome-devtools-mcp/chrome-profile`. If chrome-devtools cannot connect, fix the headless server; do not fall back to claude-in-chrome.
5. `chrome-devtools__list_pages` — confirm the headless browser is up. Open or reuse a tab with `chrome-devtools__new_page` / `chrome-devtools__select_page`.
6. Navigate to the affected route via `chrome-devtools__navigate_page` (`type=url`).
7. Screenshot with `chrome-devtools__take_screenshot`.
8. Measure with `chrome-devtools__evaluate_script` (`getBoundingClientRect`, computed `grid-template-columns`, overflow state) and `chrome-devtools__take_snapshot` for the live DOM.

### Codex

Codex does not use either branch above. Follow `.agents/skills/verify-ui/SKILL.md`.

## Shared: what to verify

9. Navigate to the page affected by the change. Cheap unauthenticated smoke page is `/`. Other renderer routes: `/settings`, `/files`, `/databases`, `/engines`, `/accounts`.
10. Measure layout. Do not rely on screenshot vibe-check alone for grid/flex changes. For responsive work, check desktop (1440) and the 320px viewport. The 320px / 200% font-scale layout is a known open defect (clipped headings); a screenshot that records the clip is not evidence that it is fixed.
11. Main case + regression anchor: the specific change plus at least one mode or route that could silently regress (usually `/` or `/settings`).
12. Screenshot the verified end state so the result is visually auditable.
13. Read the console (`chrome-devtools__list_console_messages` on Grok; Claude's console/read-page path on Claude). Filter expected Vite-only Tauri invoke noise and HMR residue; real renderer exceptions are not ignorable.
14. If this verification started `pnpm start-vite`, stop that process. Leave a pre-existing renderer untouched.

## Report

Report done only when layout matches the intended end state — not "tsc green, done". Include the route, screenshot path, console result, and what was measured.
