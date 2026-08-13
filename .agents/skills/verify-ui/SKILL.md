---
name: verify-ui
description: Verify En Croissant renderer changes in a real browser by checking the live DOM, console, screenshots, main case, and a regression anchor. Use after any frontend code change; static checks passing is not enough.
---

# verify-ui (Codex)

Read `.claude/skills/verify-ui/SKILL.md` first for the shared browser-verification
contract — the Vite port, the layout checks, the regression anchor, the reporting
bar, and the Claude/Grok browser branches. Those branches live only in that file.

Harness routing:
- Claude follows the Claude branch in `.claude/skills/verify-ui/SKILL.md`.
- Grok follows the Grok branch in that file (user-wide `chrome-devtools` MCP;
  never `chrome-bereitmachen`).
- Codex: the `mcp__claude-in-chrome__*` tools and `chrome-bereitmachen` belong
  to Claude's extension-driven Chrome, which Codex does not have. Your runtime
  is the in-app Browser with the headless `chrome-devtools` MCP server as
  fallback (`~/.codex/config.toml`), and the steps below take precedence.

Use after any frontend code change.

1. Target `http://localhost:1420`, as printed by `pnpm start-vite`
   (`vite.config.ts` port 1420). On this host that binds `[::1]:1420` only —
   `http://127.0.0.1:1420` is refused. Do not probe or guess another port.
2. Reuse a renderer already serving that URL. If nothing is listening, start
   `pnpm start-vite`, remember that this verification owns that process, and
   stop only that process at the end. This repo has no `scripts/dev-up.sh`.
   Do not run `pnpm dev` for browser MCP — that opens the Tauri webview.
3. Use the built-in in-app Browser first and reuse an existing En Croissant
   tab when possible.
4. If the in-app Browser cannot initialize its bridge/runtime before tab access,
   retry once only, then use the globally configured `chrome-devtools` MCP
   fallback. Do not spend the feature session repeatedly debugging the same
   bridge.
5. Navigate to the affected route. Cheap smoke page is `/`. Other routes:
   `/settings`, `/files`, `/databases`, `/engines`, `/accounts`.
6. Check the live DOM with bounding boxes, computed styles, overflow, and grid
   columns. Do not rely on screenshots alone for layout changes. Vite-only
   Tauri invoke failures are expected unless the change is in `src/platform/`.
   Vite-only currently crashes in `TopBar.tsx` (`getCurrentWebviewWindow()` at
   module scope) and stays blank; that is not a layout regression.
7. Verify the main case plus one unaffected regression anchor, usually `/` or
   `/settings`. For responsive changes, check desktop and 320px. The 320px /
   200% font-scale layout is a known open defect.
8. Capture the verified end state and regression anchor as screenshots, then
   check the console for real renderer exceptions; ignore expected Vite-only
   native noise and confirmed HMR residue.
9. Stop only the `pnpm start-vite` process this verification started. Never
   stop a pre-existing renderer.
10. Report the routes, screenshots/observations, console result, and layout
    deltas. Report completion only when the rendered result matches the
    intended end state.
