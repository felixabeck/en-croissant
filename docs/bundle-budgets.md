# Bundle-Budgets

`pnpm build-vite` writes Vite's manifest to `dist/.vite/manifest.json`. `node scripts/check-bundle-budget.mjs` walks that graph and measures compressed transfer bytes, not source-file sizes:

- **Entry**: the initial route shell and all of its static JS/CSS imports.
- **Largest lazy**: the largest incremental dynamic import after Entry assets are cached. Its name is printed so an oversized route can be found immediately.
- **Total**: every emitted JS/CSS asset exactly once. It protects installed-package and feature growth even when a chunk is rarely reached.

The measured baseline and enforced ceilings live in `bundle-budgets.json`. The 2026-09-23 production build measured 519,061 B Entry, 511,414 B largest lazy route (`src/routes/index.lazy.tsx`), and 1,563,393 B total (all gzip). Its ceilings are 550,000 B, 550,000 B, and 1,567,000 B respectively. The total ceiling rose from 1,550,000 B on 2026-09-23 (`d-20260923-03`): durable practice storage (`f-20260906-23`) added 17,022 B of feature code, about 9.5 KB of it the 25 new strings in each of the 16 locale catalogues and the rest its storage client and the virtualized notation that replaced O(tree) rendering, with no unused key or dead chunk to cut. Increasing a limit requires a conscious update of both measurement and rationale in review.

The largest-lazy ceiling was 750,000 B until 2026-09-20, when `f-20260920-03` moved `mantine-flagpack` out of the static import closure of every route and the board route fell from 750,033 B to 508,291 B. A ceiling 47 % above the measured route is not a gate: it would not have noticed the flag pack returning, which is the accident that change repaired. Tightening a limit toward a measurement is the ratchet direction and needs no rationale beyond the measurement; raising one still does. The route tree owns dynamic imports, so navigation waits only for the selected feature route; sidebar intent-preload may warm the destination a user is about to select, without eagerly downloading every route.
