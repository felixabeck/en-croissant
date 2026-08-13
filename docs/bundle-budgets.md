# Bundle-Budgets

`pnpm build-vite` writes Vite's manifest to `dist/.vite/manifest.json`. `node scripts/check-bundle-budget.mjs` walks that graph and measures compressed transfer bytes, not source-file sizes:

- **Entry**: the initial route shell and all of its static JS/CSS imports.
- **Largest lazy**: the largest incremental dynamic import after Entry assets are cached. Its name is printed so an oversized route can be found immediately.
- **Total**: every emitted JS/CSS asset exactly once. It protects installed-package and feature growth even when a chunk is rarely reached.

The measured baseline and enforced ceilings live in `bundle-budgets.json`. The 2026-08-09 production build measured 526,418 B Entry, 729,006 B largest lazy route (`src/routes/index.lazy.tsx`), and 1,503,906 B total (all gzip). Its ceilings are 550,000 B, 750,000 B, and 1,550,000 B respectively. Increasing a limit requires a conscious update of both measurement and rationale in review. The route tree owns dynamic imports, so navigation waits only for the selected feature route; sidebar intent-preload may warm the destination a user is about to select, without eagerly downloading every route.
