# Plan-review record — f-20260920-03 (board-route lazy-chunk budget), 2026-09-20

Durable record under rule 12a and `build` step 10. The plan itself lives at the git-ignored
`tasks/plans/2026-09-20-board-route-bundle-budget.md`; its complete text and `## Reviews` history
are copied below so this file alone recovers the run. Raw lens reports were retained at
`/tmp/build-bundle-20260920/lens-*-r<N>.txt` (ephemeral).

**Status: approved by every lens, NOT authorized for implementation.** `f-20260920-03` is
`Blocked: felix-decision`; the plan's opening section says why and what he is deciding.

---

# Plan: the board route's lazy-chunk budget (f-20260920-03)

## MANDATE (fixed, verbatim from the ledger title)

"The `largestLazy` bundle budget has no headroom left: the board route sits 33 gzip bytes over the
cap."

The 17 commits of `f-20260906-07` (download cancellation) are committed and otherwise green on every
gate; `pnpm bundle:check` is the only red one and is what stops the push. The mandate is to make
`pnpm bundle:check` green on this tree without lowering a budget to accept a regression
(`docs/coverage.md` and the repo-root `CLAUDE.md` both forbid that), and to leave the gate
meaningful afterwards.

Out of scope, to be filed rather than done here: the `total` cap's remaining headroom (below, R3),
and any other route's **byte budget**. That exclusion is about sizes, not about shared code (S1):
`FideInfo` is rendered by the board route (`Board.tsx:705-706`), by `GameInfo.tsx:46-47` wherever a
game header is shown, and by the accounts route (`PersonalCard.tsx:47`), so deferring its flag pack
necessarily changes all three. That is a consequence of touching one shared component rather than a
scope expansion, it is stated here rather than discovered later, and it is part of what Felix is
deciding below. **In scope, on the strength of the mandate's second clause:** the
`largestLazy` limit itself, because a limit left at 750,000 over a 508,162-byte route is not a
meaningful gate (I6).

## This plan does not authorize itself (M4)

`review-plan` was right to stop on this in round 3: option C changes what a user sees. Today the
flag is present the instant the FIDE modal paints; afterwards it appears when a dynamic import
resolves — in practice alongside or before the FIDE network lookup the modal is already waiting on,
but not synchronously. The governing finding `f-20260920-03` is `Blocked: felix-decision`, and it
offered Felix two branches; option C is a third. **Under universal rule 33 the choice is his, so
this plan is a proposal awaiting his answer, and nothing in it is implemented until he gives one.**
The plan is written out in full because his decision is between concrete, measured alternatives,
not between sketches. **What he is deciding covers every surface that renders `FideInfo`** — the
board, any game-header view, and the accounts page — because the deferral lives in the shared
component, not in one route (S1).

## Measured starting point

All numbers are gzip bytes from `scripts/check-bundle-budget.mjs` over a real `vite build` of this
tree. Caps: `entry` 550,000 · `largestLazy` 750,000 · `total` 1,550,000.

| metric | today | cap | verdict |
| --- | --- | --- | --- |
| `entry` | 513,920 | 550,000 | green |
| `largestLazy` (`src/routes/index.lazy.tsx`) | **750,033** | 750,000 | **red by 33** |
| `total` | 1,547,311 | 1,550,000 | green, 2,689 spare |

`largestLazy` is defined by `buildBundleReport` (`scripts/check-bundle-budget.mjs:63-90`) as the
greatest incremental closure of one of the entry's dynamic imports after the entry closure is
subtracted — i.e. what the board route costs on top of startup. Its composition, measured by
rebuilding with a throwaway rollup plugin that dumps `chunk.modules`:

| chunk | gzip | share |
| --- | --- | --- |
| `assets/AreaChart-*.js` (a shared chunk) | 347,778 | 46% |
| `assets/index.lazy-*.js` (the route's own code) | 243,635 | 32% |
| `assets/MoveControls-*.js` | 71,265 | 9% |
| `assets/GameInfo-*.js` | 28,919 | 4% |
| 27 further chunks | ~58,400 | 8% |

And inside that 347,778-byte shared chunk, by raw (pre-gzip) rendered length:

| package | raw bytes |
| --- | --- |
| **`mantine-flagpack`** | **955,312** |
| `recharts` | 446,618 |
| `src/components/databases/countries.json` | 59,616 |
| `es-toolkit` | 45,141 |
| `@reduxjs/toolkit` | 31,543 |
| `d3-scale`, `d3-shape`, `d3-time-format`, `d3-time`, `d3-format`, `d3-color`, `d3-array`, `d3-interpolate` | 119,445 |
| `decimal.js-light` | 25,453 |
| `@mantine/core` (residual), `immer`, `react-redux`, `redux`, `reselect`, `FideInfo.tsx` | ~66,000 |

The chunk is named after `AreaChart` because that is one of the modules in it; it is an
automatically formed shared chunk, not the chart.

**The single largest thing in the board route is a complete set of country flags.**
`src/components/databases/FideInfo.tsx:3` does `import * as Flags from "mantine-flagpack"` and
`FideInfo.tsx:12-15` iterates `Object.entries(Flags)` at module scope, so every flag in the package
is retained — 955 KB raw — in order to render at most one of them. `Board.tsx:54`,
`GameInfo.tsx:10` and `PersonalCard.tsx:12` all import `FideInfo` statically, so the board route,
the database route and the accounts route each carry the whole pack.

`FideInfo` renders a modal whose body is gated on `opened`, and its data fetch is gated the same
way: `useSWR(!opened ? null : name, …)` (`FideInfo.tsx:29-33`) does not fire until the modal opens.

## Options

Each row below was built and measured, not reasoned. Five `vite build` runs, same config.

| # | option | `entry` | `largestLazy` | `total` | gate |
| --- | --- | --- | --- | --- | --- |
| — | today | 513,920 | **750,033** | 1,547,311 | **red** |
| A | lazy `EvalChart` in `ReportPanel` | 514,759 | 642,166 | **1,550,268** | **red** |
| B | re-record the `largestLazy` limit | 513,920 | 750,033 | 1,547,311 | green by definition |
| **C** | **load the flag pack on demand** | 514,298 | **508,162** | **1,546,072** | **green** |
| C' | lazy `FideInfo` as a whole component | 515,253 | 506,307 | 1,549,692 | green, 308 spare |
| A+C | both | 515,341 | 401,283 | **1,550,239** | **red** |

### Option A — lazy-load `EvalChart` (the previously recommended option): rejected

Recommended by the `f-20260906-07` session and filed as branch (a) of the parked decision. Measured,
it **does not pass the gate**: splitting the chart out duplicates shared code across chunks and
pushes `total` to 1,550,268, 268 bytes over its cap. It also buys the least (-108 KB on the route)
and is the only option with a user-visible cost — a `Suspense` boundary in the analysis panel, so
the evaluation chart appears after the rest of the panel on every open. Rejected on the measurement;
it would have replaced a red `largestLazy` with a red `total`.

The finding's premise that "`EvalChart` is 1.18 MB raw" is also not what the chunk contains: the
chart's own share is recharts + d3 + `decimal.js-light` ≈ 590 KB raw. The 1.18 MB figure attributes
the whole shared chunk, flags included, to the chart.

### Option B — re-record the budget: rejected unless Felix overrules

Branch (b) of the parked decision. Costs nothing today and changes nothing visible. What it buys is
the permanent acceptance that every board route parses ~1.7 MB of raw JavaScript, roughly half of it
flags for a modal that is rarely opened.

To be accurate about the repository's own rule: `docs/bundle-budgets.md` does **not** forbid this —
it says "Increasing a limit requires a conscious update of both measurement and rationale in
review", which is a procedure for exactly this case. What forbids it is the weaker general
statement, that a cap re-recorded whenever it binds stops being a cap, and the fact that option C
exists and is strictly better on every measured number. This is the fallback if Felix rejects C,
not a recommendation, and if it is taken it needs the rationale the doc requires.

### Option C — load the flag pack on demand: adopted

Keep `FideInfo` statically imported, and load `mantine-flagpack` plus `countries.json` from inside
it when the modal is actually open. The flag pack then forms its own dynamic chunk that no route
carries statically. Measured: `largestLazy` 750,033 → **508,162** (-32%), and `total` goes *down*
(1,547,311 → 1,546,072) because nothing is duplicated — the pack simply moves out of a shared chunk
that four routes were paying for. All three caps green with 241,838 bytes of `largestLazy` headroom.

Variant C' — making `FideInfo` itself a `lazy()` component behind a mounted-once wrapper at its
three call sites — was measured too and is **not** adopted: it reaches the same route figure
(506,307) but costs `total` (1,549,692, 308 bytes spare), because it adds a wrapper module and
splits `FideInfo` itself out of the chunk it shares with its callers. 308 bytes of headroom is how
this plan came to exist.

Considered and rejected inside C:

* **Deep-import one flag** (`import("mantine-flagpack/dist/esm/flags/DE.mjs")`) — the package's
  `exports` map (`package.json`) exposes only `"."` and the two stylesheets, so a subpath import is
  blocked by Node/Vite resolution. Rejected as unavailable, not as undesirable.
* **Tree-shaking the namespace import** — `Object.entries(Flags)` is a runtime iteration over the
  namespace; no bundler can prove which flags are reachable. This is exactly why the pack is
  retained whole today.

### Option D — remove the flag pack: not proposed here

Replacing `mantine-flagpack` with a Unicode regional-indicator flag or a single inline SVG would
delete 955 KB raw outright rather than defer it, which is the only option that also relieves the
`total` cap. It changes what a user sees (a different flag rendering, and on WebKitGTK under Linux
regional-indicator sequences frequently have no glyph and fall back to two letters), so it is a
product decision and it is not required by the MANDATE. Filed as a finding instead (R3).

## Implementation

One phase. **The complete set of files this plan changes**, which supersedes any narrower list:

| file | change |
| --- | --- |
| `src/components/databases/flagpack.ts` | new — the dynamic-import boundary, in one named module |
| `src/components/databases/FideInfo.tsx` | edited — the flag pack moves behind that boundary |
| `src/components/databases/FideInfo.test.tsx` | new |
| `bundle-budgets.json` | `largestLazy` limit 750,000 → 550,000, and a refreshed `measurement` block |
| `docs/bundle-budgets.md` | the prose figures and ceiling it quotes |
| `tasks/findings.md`, `tasks/decisions.md` | the closure of `f-20260920-03` and the follow-ups this plan files |

### C1 — `src/components/databases/FideInfo.tsx`

* Delete the module-scope `import * as Flags from "mantine-flagpack"` (line 3),
  `import COUNTRIES from "./countries.json"` (line 10) and the module-scope `flags` array
  (lines 12-15).
* Put the loader in its own module, `src/components/databases/flagpack.ts`, exporting one
  `loadFlagpack` function (M2). r3 kept it module-private inside `FideInfo.tsx`; `review-tests`
  then showed that a private `import()` is not observable, so no test could count attempts and the
  retry guard of criterion 5 could be deleted with every assertion still green. A named module is
  the seam that makes the behaviour assertable — `review-minimalism` asked twice for the loader to
  be inlined (J5, L2) and that request is **declined with this reason**: the seam exists for
  observability, which is a contract requirement here, not for a hypothetical second caller.
  It is a plain `async` function with **no hand-rolled cache** (I5, I8): ESM module caching already makes a second `import()` of the same
  specifier resolve the same module instance, and `useSWR` under one constant key deduplicates
  concurrent callers, so a `flagpack ??=` promise cache would be a third cache that neither the
  plan nor a test can distinguish from the two that are already there — and it would additionally
  pin a rejected promise for the lifetime of the window.

  ```ts
  // src/components/databases/flagpack.ts
  export async function loadFlagpack() {
    const [Flags, countries] = await Promise.all([
      import("mantine-flagpack"),
      import("./countries.json"),
    ]);
    return {
      flags: Object.entries(Flags).map(([key, value]) => ({
        key: key.replace("Flag", ""),
        component: value,
      })),
      countries: countries.default,
    };
  }
  ```

  **No hand-written types** (J5): the namespace import is typed by the package and
  `countries.json` by `resolveJsonModule`, both of which the file already relies on today, so
  `flags[].component` and `countries[]` are inferred exactly as the current module-scope constants
  are. The `ComponentType`/`Country` aliases proposed in r2 were single-use scaffolding; `tsgo
  --noEmit` inside `pnpm build-vite` is the check that inference suffices.
* Inside the component, load it with the same gate the data fetch already uses, through the SWR
  instance the file already depends on:

  ```ts
  const { data: flagpack } = useSWR(opened ? ["fide-flagpack"] : null, loadFlagpack, {
    shouldRetryOnError: false,
  });
  ```

  **The key is an array, not the string `"fide-flagpack"` (K1).** The player lookup two lines above
  keys on the raw player `name` (`FideInfo.tsx:29`), so a plain string key would collide with a
  player actually called "fide-flagpack": both hooks would share one SWR cache entry, and whichever
  resolved second would hand the other's payload to code expecting the opposite shape. SWR
  serialises an array key through `unstable_serialize`, which cannot collide with a bare string
  key. The probability is negligible; the cost of avoiding it is one pair of brackets.

  `swr/immutable` is already imported (`FideInfo.tsx:5`); a constant string key gives one shared
  load, a re-render on arrival, and no work at all while the modal is closed. **No new dependency,
  no `Suspense` boundary, no loading state in the markup**: `Flag` and `country` are simply
  `undefined` until the pack arrives, which is the state the component already renders
  (`FideInfo.tsx:79` guards on `Flag && country?.name`).

  `shouldRetryOnError: false` is explicit and measured, not decorative: `swr/immutable`
  (`swr@2.4.0`, `dist/immutable/index.mjs`) overrides only `revalidateOnFocus`,
  `revalidateIfStale`, `revalidateOnReconnect` and `refreshInterval`, and leaves the default
  `shouldRetryOnError: true` from `dist/_internal/config-context-*.mjs:495` in place. Without the
  option, a missing or corrupt bundled asset would be retried with backoff for as long as the modal
  stays open. **What the option does not do (K2):** it suppresses the backoff loop of a *mounted*
  hook. Closing the modal sets the key to `null` and unsubscribes; reopening mounts a hook whose
  cached `data` is `undefined`, and SWR then performs its initial revalidation, so the import is
  attempted once more per open. That is the correct behaviour and is what the criteria and R5 now
  state — r2 claimed the opposite.

  **With one exception, measured (S2).** The key is shared by every mounted `FideInfo`, and the
  board mounts two of them. SWR's `shouldDoInitialRevalidation` contains
  `if (hasRevalidator && !isUndefined(error)) return false;` — "if a key already has revalidators
  and also has error, we should not trigger revalidation" (`swr@2.4.0`,
  `dist/index/index.mjs:309-314`). So while a *second* instance of the modal is still mounted on a
  key that has already errored, reopening the first does not re-attempt the import; it renders
  without a flag, which is the same outcome by a different route. "One attempt per open" therefore
  holds for the last mounted instance, not unconditionally. **Test case 5** pins this.
* Derive `country` and `Flag` from `flagpack` with the same `find` calls the file uses today
  (I8 — the array shape is kept, no `Map` is introduced); the JSX is unchanged.

**Failure path:** if the dynamic import rejects (a corrupt or missing asset), `useSWR` surfaces the
rejection as its own error, `data` stays `undefined`, and no further attempt is made while the
modal stays open. The modal then renders exactly as it does today for a player with no federation —
name, title, year and the three rating cards, no flag row. No throw reaches the modal, and the
existing `error` branch continues to belong to the FIDE lookup alone. A missing flag is a
deliberate degradation, not an error surface. Each subsequent open attempts the import once more
(K2); on a genuinely broken installation that is one failed import per open, not a timer loop.

### C2 — `src/components/databases/FideInfo.test.tsx` (new)

The file has no test today, and the `databases-files` coverage area is ratcheted on both covered
count and ratio (`coverage-baselines.json`: 953/1804 lines, 194/409 functions, 1141/2773 branches),
so adding uncovered lines alone would redden the gate.

**What a unit test here can and cannot prove (I9).** It cannot prove that `mantine-flagpack` is
absent from a route's *static* import closure: the test imports `FideInfo` itself, so a mocked
`mantine-flagpack` is evaluated either way, and a revert to `import * as Flags` would still pass an
assertion made after render. That property belongs to the built bundle and is handled in C3 and
criterion 3. The unit tests own the *behaviour*.

**Harness, because three findings in round 3 turned on it.** Every case does its mocking with
`vi.doMock` and then imports `FideInfo` **dynamically, inside the case, after the mock is
installed** (M8): a top-level `import FideInfo from "./FideInfo"` is evaluated before any
`vi.resetModules()` in a `beforeEach`, so a case that mocks afterwards would silently exercise the
real module and prove nothing. Each case calls `vi.resetModules()` first and renders under its own
SWR cache provider, so a cached rejection cannot leak forward (I5). Cases that assert attempt
counts spy on `loadFlagpack` from `./flagpack` (M2) — the exported boundary, which is observable,
unlike the bare `import()` r3 proposed.

Two further harness properties, both of which a lens caught as silently defeating the tests that
depend on them:

* **`vi.resetModules()` does not clear the mock registry** (P2). It resets the module cache; a
  `vi.doMock` registration survives it, so case 2's rejecting `mantine-flagpack` would still be in
  force when case 6 renders and expects real flag data. Every case therefore ends with an explicit
  `vi.doUnmock` of whatever it mocked, in an `afterEach` or a `finally`. **`vi.resetAllMocks()` is
  not an alternative** (Q1): it resets mock implementations, not `vi.doMock` registrations, so
  offering it as a fallback in r6 would have left case 2's rejecting `mantine-flagpack` active for
  case 6. **Cases 1 and 6** — the two that need the real package — additionally assert positively
  that a real flag rendered, rather than inferring it from an absence.
* **The per-case `SWRConfig` must leave `shouldRetryOnError` at SWR's default** (P1). This is not
  hypothetical: `src/components/databases/PlayerCard.test.tsx:41`, in this very directory, wraps in
  `<SWRConfig value={{ provider: () => new Map(), shouldRetryOnError: false }}>`, and
  `src/components/engines/EnginesPage.test.tsx` does the same four times. Copying that pattern here
  would make case 2 pass with exactly one call after 60 s even if `FideInfo`'s own
  `shouldRetryOnError: false` were deleted — the assertion would be measuring the test's own
  provider. The provider in these cases supplies **only** `provider: () => new Map()`.

1. **Open modal, real flag pack, player with a federation** → that federation's flag renders once
   the loader resolves. This case does **not** mock `mantine-flagpack` (J6): it imports the real
   package, so the export-name convention `XXFlag`, the `key.replace("Flag", "")` mapping and the
   `ioc` → `a2` lookup are exercised against the real module rather than a fixture that agrees with
   the code by construction. Goes red if the loader is keyed wrongly, never awaited, or if the
   package's export naming changes under a dependency bump.
2. **Open modal whose flag import rejects** → the modal still renders the player's name, title and
   the three rating cards, no flag row appears, **and no error text is rendered anywhere in the
   modal** (O2). Without that last assertion, a regression that surfaces the flag failure as user
   text would keep the case green while violating criterion 5, whose whole point is that a missing
   flag is silent. The case spies on `loadFlagpack`, advances fake
   timers by **60 seconds** — far past SWR's first retry, which is *jittered*, not fixed: the
   backoff is `~(random + 1) * interval` around the 5,000 ms default
   (`swr@2.4.0`, `dist/_internal/config-context-12s-CCVTDPOP.mjs:470-478,495-497`), i.e. roughly
   2.5-10 s for the first attempt, so advancing exactly 5,000 ms could leave a real retry pending
   and pass (M5) — and asserts the spy was called **exactly once**. Deleting
   `shouldRetryOnError: false` makes this case red.
3. **Close and reopen after a rejection** → the spy is called exactly once more, and the modal
   still renders without a flag row. This pins the behaviour K2 identified, so neither it nor a
   future change to it passes silently.
4. **Closed modal** (`opened: false`) → neither the FIDE lookup nor `loadFlagpack` runs, and no
   flag row is rendered. This asserts the SWR key gate; it is explicitly *not* offered as proof of
   static-closure absence.
5. **Two instances mounted at once, one failing** — the board renders two `FideInfo` modals, white
   and black (`Board.tsx:705-706`, `GameInfo.tsx:46-47`), sharing the one flag key. With the second
   instance still mounted after a failed load, reopening the first does **not** re-attempt the
   import, and it still renders without a flag row rather than hanging on a loading state (S2).
   This is the measured exception to case 3, and it is tested rather than merely described.
6. **A player literally named `fide-flagpack`** → the modal renders that player's data and the flag
   hook still resolves to flag data; neither hook receives the other's payload (M7). This is the
   behavioural anchor for K1: with the key reverted from `["fide-flagpack"]` to the bare string,
   the two hooks share one SWR entry and this case goes red. Without it, K1's fix has no test and
   could be undone by a later tidy-up.

**Retained evidence for what no test covers (J6, M3).** The flag renders inside WebKitGTK, and
`FideInfo` appears in no e2e spec. No automated native proof is possible either: the modal only
populates from a live FIDE lookup over the network, which `pnpm verify:app` cannot make
deterministic. The manual check is therefore pinned to a named build rather than left vague — see
C4 — and its result is recorded in the commit message with the player used and the flag observed.

### C3 — `bundle-budgets.json` and `docs/bundle-budgets.md`

Two edits, and the second one is the substantive half of this plan:

* Refresh the stale `measurement` block. It records `pnpm build-vite` on 2026-08-09 with
  `largestLazy: 729006`, which has not described this tree for some time. Re-record it from the
  post-change build, with today's date.
* **Tighten the `largestLazy` limit from 750,000 to 550,000** (I4, I6). The mandate requires the
  gate to stay meaningful, and a cap 47% above the measured route is not one: it would not notice
  the next 200 KB, and — the concrete case — it would not notice `mantine-flagpack` being pulled
  back into a static import, because 508,162 + ~242,000 lands just under the old cap again, which
  is exactly the accident this plan is repairing. At 550,000 the route keeps ~42 KB (8%) of
  ordinary growing room and any re-static-linking of the pack fails the gate by ~200 KB. This is
  the ratchet direction; `docs/bundle-budgets.md` requires a conscious update with a rationale for
  *raising* a limit, and nothing forbids lowering one that measurement has overtaken.
  `entry` (550,000) and `total` (1,550,000) are not touched.
* `docs/bundle-budgets.md` quotes the 2026-08-09 figures and the 750,000 ceiling in prose. It is
  updated in the same commit, or the repository ships a document that contradicts its own gate
  configuration.

**What the tightened cap does and does not prove (J1, K3).** Three lenses converged on the same
correction, and they are right: `buildBundleReport` sums gzip bytes per route closure
(`scripts/check-bundle-budget.mjs:63-90`) and never inspects module identity or which edge a chunk
sits behind. So the cap is a *quantitative* guard, not a placement guard. Concretely, at 550,000 it
does catch the whole pack returning to the board route's static closure — that costs ~242,000
bytes on a 508,162-byte route — and it does not catch the pack being statically imported by a
small route that stays under the limit anyway, nor a single named flag. Criterion 3 is narrowed
accordingly, and the residual gap is filed rather than papered over.

Closing that gap properly would mean a manifest-edge assertion — the checker refusing any route
whose *static* closure contains a named chunk. That is new executable checking code rather than a
prose repair, so under universal rule 6d it is named to Felix before it is written rather than
grown quietly inside this change, and it is not part of this plan. No new checker, script or gate
is introduced here.

### C4 — verification

Affected-path gates per `.claude/skills/push/SKILL.md`:

* `pnpm gates:contract:check` (unconditional). It already contains `lint:ci`, both boundary checks
  and the i18n checks (`package.json:18`), so those are not listed separately below (O3).
* `pnpm build-vite && pnpm bundle:check` — the gate this plan exists for, run against the tightened
  550,000 limit. Expected: `entry` ~514,298, `largestLazy` ~508,162, `total` ~1,546,072, all green.
  **This command does not prove criterion 3** (M1): `collectRecordAssets` walks manifest `imports`
  and sums gzip bytes (`scripts/check-bundle-budget.mjs:26-50,63-90`); it never inspects which edge
  a chunk hangs off. r3 still said otherwise in this section — corrected here.
* **A manifest read, once, as a named verification step** (M1): after the build, read
  `dist/.vite/manifest.json` and confirm that the chunk carrying `mantine-flagpack` is reachable
  from `src/routes/index.lazy.tsx` only through a `dynamicImports` edge and appears nowhere in its
  transitive `imports`. The observed chunk name and the edge go into the commit message. This is
  evidence produced by hand, not a gate; what guards it afterwards, and how far, is criterion 3.
* `pnpm test` — the new test.
* `pnpm test:coverage` **followed by `pnpm coverage:frontend:check`** — `test:coverage` is
  `vitest run --coverage.enabled` (`package.json:36`) and only writes `coverage/lcov.info`; the
  ratchet is the separate `coverage:frontend:check` (`package.json:37`), which compares that LCOV
  against `coverage-areas.json` floors and `coverage-baselines.json`. Running only the first would
  leave criterion 6 unverified (I2).
* `pnpm test:e2e:container` — no committed snapshot may move. `FideInfo` appears in no e2e spec, so
  a moved snapshot means the change reached further than intended.
* Frontend mutation is unaffected by construction: `scripts/frontend-mutation-packages.mjs` mutates
  only `gameSession.ts`, `session.ts`, `workspace.ts`, `tabStorage.ts`, `pathCapabilities.ts` and
  `treeReducer.ts`. It still runs as a push gate.
* No Rust file changes, so no cargo gate is in the affected set.

**Manual check, against a named build (M3).** No automated proof covers native rendering, and none
can: the modal only fills from a live FIDE lookup, so `pnpm verify:app` cannot make it
deterministic. The check therefore has to say *which* binary it was performed on, because this
repository has two and the daily one is not the candidate: the application-menu entry runs
`~/.local/opt/chessfable/current/bin/chessfable`, a versioned copy that `scripts/install-local.sh`
writes only from a clean pushed tree (repo-root `CLAUDE.md`). The check runs on the **candidate
build** — `pnpm build` in this working tree, then `src-tauri/target/release/chessfable` started
directly — not on the installed copy, which keeps the old code until `$push` reinstalls it. Open a
game whose player has a FIDE federation, click the player name, confirm the flag appears in the
modal. The binary path, the player used and the flag observed go into the commit message (J6).

### C5 — the frontend coverage baseline is NOT refreshed in this change (J2)

`docs/coverage.md:43-56` requires a deliberate frontend baseline refresh after coverage is added,
so the new gains become binding. That procedure cannot run inside this change, and the dependency
is structural rather than a matter of effort: it requires the `frontend-coverage` LCOV artifact
from a **successful `Test` run in `felixabeck/en-croissant` on a tree matching the candidate**, and
this tree cannot reach CI until the push this plan unblocks has landed. It further requires a green
full coverage run against the *existing* baseline first, which is exactly criterion 6.

So: this change satisfies the ratchet (`coverage:frontend:check` green, nothing falls) and files
the upward refresh as its own follow-up, to run after the push, with the CI run, commit, artifact
and every metric delta recorded in `tasks/decisions.md` as `d-20260911-02` did. Refreshing a
baseline is also denied by default in `.claude/settings.json`; that denial is honoured, not
circumvented.

## Acceptance criteria

1. `pnpm bundle:check` exits 0 on a fresh `pnpm build-vite` of this tree.
2. `bundle-budgets.json` contains no *raised* limit: `entry` and `total` are unchanged, and
   `largestLazy` is 550,000 — lower than today's 750,000. Its `measurement` block is the build the
   gate was run against; this is verified by reading the printed report against the file, because
   no command compares the two.
3. `mantine-flagpack` is behind a dynamic edge in the built manifest, not in the board route's
   static closure. Proven **once, at implementation time**, by reading
   `dist/.vite/manifest.json` — the pack's chunk must be absent from the board route's transitive
   `imports` and reachable only through `dynamicImports` — and recorded in the commit message.
   Thereafter criterion 1 under the tightened cap guards the board route quantitatively: returning
   the whole pack to its static closure costs ~242,000 bytes and fails the gate. It does **not**
   guard a small route statically importing the pack, nor a single named flag (J1, K3); that
   residual gap is filed, with the manifest-edge assertion named as its candidate fix.
4. Opening the FIDE modal for a player with a federation still renders that federation's flag, with
   the real `mantine-flagpack` module in the test, not a fixture.
5. A rejected flag import leaves the modal rendering the player's name, title and ratings, with no
   flag row and no error beyond the existing FIDE-lookup error branch. No backoff loop runs while
   the modal is open. A reopen re-attempts the import exactly once **unless another `FideInfo` on
   the same key is still mounted and already holds the error**, in which case it does not
   re-attempt and still renders without a flag (S2, measured against `swr@2.4.0`).
6. `pnpm coverage:frontend:check` exits 0: the `databases-files` area loses no covered lines,
   functions or branches, and its three ratios do not fall. The upward baseline refresh is filed as
   a follow-up, not performed here (C5).
7. No committed e2e snapshot moves.
8. `docs/bundle-budgets.md` states the same limits and measurement as `bundle-budgets.json`,
   verified by reading both.

## Risks

* **R1 — retired in r2.** The memoised promise that could pin a rejected import is gone; C1 relies
  on ESM module caching and SWR's constant-key deduplication instead (I5, I7).
* **R2 — the tightened cap could bite ordinary work.** At 550,000 the board route has ~42 KB of
  headroom instead of 242 KB. That is the point of the change, but it means the next sizeable board
  feature will meet the gate rather than sail past it. The measured maximum over every lazy route
  after this change is the board route itself at 508,162, so no other route is affected.
* **R3 — `total` is the next wall.** It ends at 1,546,072 of 1,550,000 — 0.25% headroom. The next
  feature of any size hits `total`, and no chunk-splitting can help there, because `total` counts
  every asset once. Out of scope by the MANDATE; to be filed, with option D (removing the flag pack
  outright, ~955 KB raw) named as the candidate that actually moves it.
* **R4 — this is not the cancellation diff.** The flags predate `f-20260906-07`; that work merely
  consumed the last 33 bytes. Fixing it here is right under the repo's own rule that a finding in
  the loaded area is handled now, but it means the push carries a change whose cause is older than
  the commits it unblocks. The commit message must say so.
* **R5 — at most one import attempt per open on a broken installation.** `shouldRetryOnError: false`
  stops the backoff loop of a mounted hook; each reopen mounts a hook with no cached `data` and SWR
  revalidates once (K2), except while a second instance on the same key still holds the error, when
  it does not revalidate at all (S2). Both measured against `swr@2.4.0`. Accepted: the import reads
  a bundled asset from local disk, so a failure means a broken installation; one failed import per
  open is cheap, and the suppressed case merely repeats the same outcome without the attempt.
* **R6 — the placement gap the byte cap cannot close.** A small lazy route could statically import
  the flag pack, or any route could statically import one named flag, without the 550,000 cap
  noticing (J1, K3). Filed, with a manifest-edge assertion in `check-bundle-budget.mjs` named as
  the candidate fix and deliberately not built here (rule 6d).
* **R7 — the coverage baseline stays where it is.** The gains from the new test are not locked in
  until the follow-up refresh in C5 runs against a CI artifact from a tree containing this change.
  Until then a later change could give those lines back without the ratchet objecting.

## What is deliberately NOT in this plan

* Raising any `limits` value, or touching `entry` and `total` at all.
* Lazy-loading `EvalChart`, `AddPuzzle`, `AddDatabase` or any other component (option A and the
  variants the `f-20260906-07` session measured); none of them are needed once the flags move, and
  each costs `total`.
* Replacing or removing `mantine-flagpack` (option D, R3).
* Any change to `src-tauri/`.

## Reviews

Round 1 — revision r1, four Codex lenses (`review-plan` `--role review-plan`, `review-minimalism`,
`review-correctness`, `review-tests`, all `--role normal`; no planned path hits a Sensitive-Path
glob). Raw verdicts: `review-plan` **REVISE**, `review-correctness` **REVISE**, `review-tests`
**REVISE**, `review-minimalism` **APPROVED**.

| ID | witnesses | claim | disposition |
| --- | --- | --- | --- |
| I1 | plan (blocker, 99), correctness (blocker, 99) | the C1 loader does not typecheck — `ReactNode` and `Country` are undeclared, and `pnpm build-vite` runs `tsgo --noEmit` first | **Fix** — C1 declares `ComponentType` and a local `Country` shape |
| I2 | plan (blocker, 99), correctness (should-fix, 99), tests (should-fix, 100) | `pnpm test:coverage` does not run the ratchet; `coverage:frontend:check` is a separate script | **Fix** — C4 and criterion 6 name it |
| I3 | plan (blocker+should-fix, 99/97), correctness (should-fix, 97), tests (should-fix, 100), minimalism (nit, 93) | criterion 2's 520,000 target and pre-change `total` clause expand the fixed MANDATE and are not what any command enforces | **Fix** — both invented thresholds deleted; the criteria now name only what a command proves |
| I4 | plan (blocker, 96), tests (should-fix, 96) | no listed check proves criterion 3 — `bundle:check` measures bytes, never manifest placement | **Fix**, jointly with I6 — the tightened 550,000 limit *is* the check: re-static-linking the pack costs ~242,000 bytes |
| I5 | plan (blocker, 94), tests (should-fix, 96), minimalism (nit, 86) | the memoisation test cannot prove memoisation — ESM and SWR already deduplicate — and no module/SWR cache isolation was specified | **Fix** — the hand-rolled promise cache is deleted outright and the test case with it; C2 states per-case `resetModules` and a fresh SWR cache |
| I6 | plan (blocker, 91) | leaving `largestLazy` at 750,000 over a 508,162-byte route contradicts the MANDATE clause "leave the gate meaningful" | **Fix** — the limit is tightened to 550,000 inside this plan; it was an out-of-scope follow-up in r1 |
| I7 | plan (nit, 99) | the failure narrative contradicted the cached rejected promise | **Fix** — dissolved by I5; R5 now states the surviving cached-error behaviour |
| I8 | minimalism (nit, 91) | the `Map` and `FlagComponent` scaffolding is structure for one lookup | **Fix** — the array plus `find` shape of the current file is kept |

No issue was rejected, deferred or withdrawn. Open after round 1: none. All eight corrections are
substantive under rule 12a (they change the implementation obligation, the verification, or the
acceptance semantics), so every one of them needs an explicit reviewer closure check against r2.

Round 2 — revision r2, the same four lenses with the `plan-review-delta.py` round-2 block and the
I1-I8 history. Raw verdicts: `review-plan` **REVISE**, `review-correctness` **REVISE**,
`review-tests` **REVISE**, `review-minimalism` **APPROVED**.

Closure of the round-1 issues against r2, as reported: I1, I2, I3, I5, I7 and I8 closed by all
lenses that had raised them (`review-minimalism` recorded all eight closed). **I4 and I6 were
reported as only partially closed** by `review-plan`, `review-correctness` and `review-tests`
independently, and I7's narrative was accepted while its behaviour was found untested. Those
partial closures are the source of J1 and J4 below; the underlying corrections stand.

| ID | witnesses | claim | disposition |
| --- | --- | --- | --- |
| J1 | plan (blocker, 99), correctness (should-fix, 95), tests (should-fix, 96) | the tightened byte cap does not prove criterion 3 — `bundle:check` sums bytes and never inspects manifest edges, so a small route statically importing the pack, or one named flag, would pass | **Fix** — criterion 3 is narrowed to what is actually proven (a one-time manifest read at implementation, plus a quantitative guard on the board route); the residual gap becomes R6 and is filed. The manifest-edge assertion that would close it is named to Felix under rule 6d rather than built |
| J2 | plan (blocker, 98) | `docs/coverage.md:43-56` requires a deliberate frontend baseline refresh after adding coverage; the plan omitted it | **Fix** — C5 states why the refresh cannot run inside this change (it needs a CI artifact from a tree containing it) and files it as the follow-up, with the existing denial honoured |
| J3 | plan (blocker, 99) | the plan changes a limit and a doc while the supplied file list permitted only the JSON measurement block | **Fix** — the Implementation section now carries the complete file list and says it supersedes any narrower one; the round-3 lens inputs carry the same list |
| J4 | plan (blocker, 95), tests (should-fix, 99) | the rejection test asserts markup only; it never advances SWR's retry timer or exercises close/reopen, so deleting `shouldRetryOnError: false` would stay green | **Fix** — C2 case 2 advances fake timers past the five-second retry interval and asserts exactly one attempt; case 3 is new and pins the reopen behaviour |
| K1 | correctness (blocker, 99) | `"fide-flagpack"` as a plain SWR key can collide with the player-lookup key, which is the raw player name; both hooks would then share one cache entry | **Fix** — the key becomes the array `["fide-flagpack"]`, which `unstable_serialize` cannot collide with a bare string |
| K2 | correctness (blocker, 99) | `shouldRetryOnError: false` suppresses the loop only while mounted; a reopen revalidates because cached `data` is `undefined`, contradicting r2's "no retry on reopen" claim and criterion 5 | **Fix** — r2's claim was simply wrong. C1, criterion 5 and R5 now state one attempt per open, and C2 case 3 tests it |
| J5 | minimalism (nit, 94) | `loadFlagpack`, `FlagComponent` and `Country` are single-use scaffolding; inline and let types be inferred | **Fix in part** — both type aliases are deleted and inference carries them (which also satisfies I1, since `tsgo --noEmit` is the check). The named `loadFlagpack` is **kept**: it is the only dynamic-import boundary in the file and is what a reader greps for; hiding it in a hook argument costs more than the declaration does |
| J6 | tests (should-fix, 92) | the success test need not use the real flagpack module, and the manual check leaves no retained evidence | **Fix** — case 1 imports the real package so export naming and the `ioc` → `a2` mapping are exercised; the manual check is recorded in the commit message |
| J7 | tests (nit, 99) | no listed command compares the `measurement` block or the documentation against the build | **Fix as stated scope** — criteria 2 and 8 now say explicitly that these are verified by reading, because no command does it. Automating that comparison is the same rule-6d decision as R6 and is not taken here |

No issue was rejected or deferred. J5 is the single partial adoption, with its reason recorded.

Round 3 — revision r3. Raw verdicts: `review-plan` **REVISE**, `review-tests` **REVISE**,
`review-correctness` **APPROVED** ("I found no correctness defects in the r3 candidate"),
`review-minimalism` **APPROVED**. Closures reported against r3: I1, I2, I3, I5, I6, I7, I8, J2,
J3, J5, J7, K1, K2 closed; I4/J1/K3 still open on the manifest-proof point; J4 not closed on the
retry timing; J6 partially closed.

| ID | witnesses | claim | disposition |
| --- | --- | --- | --- |
| M1 | plan (blocker, 99) | C4 still claimed `bundle:check` proves criterion 3, and listed no manifest evidence — a leftover from r2 that C3 had already corrected elsewhere in the same file | **Fix** — C4 now says plainly that the command does not prove it, and adds the one-time manifest read as a named verification step with its result in the commit message |
| M2 | tests (blocker, 98) | the rejection test cannot count import attempts: `loadFlagpack` was module-private, `import()` is not observable, and Vitest caches the throwing factory | **Fix** — the loader moves into `src/components/databases/flagpack.ts` as an exported function, which the tests spy on. This is the seam `review-minimalism` twice asked to remove (J5, L2); declined, with observability as the recorded reason |
| M3 | plan (blocker, 95), tests (should-fix, 89) | the manual check never said which build it runs on, and this repository's daily binary is an installed copy of a *pushed* tree, not the candidate | **Fix** — the check is pinned to `pnpm build` plus `src-tauri/target/release/chessfable`, with the binary path recorded; the impossibility of an automated native proof (the modal needs a live FIDE lookup) is stated rather than left implicit |
| M4 | plan (blocker, 93) | option C is adopted although the governing finding is `Blocked: felix-decision` and C changes what a user sees; the MANDATE does not authorize that choice | **Fix** — a new opening section states that this plan is a proposal awaiting Felix's answer under universal rule 33, and that nothing is implemented until he gives one. The lens found a governance defect in the plan's framing, and it was right |
| M5 | plan (blocker, 99), tests (should-fix, 94) | advancing timers by exactly 5 s does not pass SWR's *jittered* first retry (~2.5-10 s), so a deleted retry guard could stay green | **Fix** — 60 s, with the jitter formula and its source line quoted in the plan |
| M7 | tests (should-fix, 95) | K1's array-key fix had no behavioural anchor | **Fix** — new case 5 uses a player literally named `fide-flagpack` and asserts the two hooks do not share a cache entry |
| M8 | tests (should-fix, 93) | `vi.resetModules()` cannot re-evaluate a top-level `FideInfo` import, so the mocked cases could exercise the real module | **Fix** — every case installs its mock with `vi.doMock` and imports `FideInfo` dynamically afterwards; stated in the harness paragraph |
| L1 | minimalism (nit, 94) | `countries.json` need not be dynamic; keeping it static would still fit under the cap | **Skip**, measured: flag pack dynamic with `countries.json` static gives `largestLazy` 520,038 against 508,162 with both dynamic — the JSON is 11,876 gzip bytes, 28% of the headroom the tightened cap leaves — and both imports share one `await` and one rejection path, so it is not an additional failure surface |
| L2 | minimalism (nit, 91) | inline `loadFlagpack`; one caller | **Skip**, superseded by M2 — the module is now required as an observable boundary |

`review-tests` additionally restated J1/K3 (the manifest gap) and J7 (nothing compares the
measurement block to the build) as surviving limitations rather than new defects; both are recorded
as such in R6 and criteria 2 and 8, and closing either means writing new executable checking code,
which is Felix's call under rule 6d.

Round 4 — revision r4. Raw verdicts: `review-minimalism` **APPROVED**, `review-correctness`
**REVISE**, `review-tests` **REVISE**, `review-plan` **REVISE**. `review-minimalism` recorded that
`flagpack.ts` is "the smallest observable seam for the required retry-attempt assertion" and that
inlining would make the contract untestable — the M2-versus-J5/L2 dispute is settled by the lens
that raised it. Closures reported against r4: I1-I3, I5-I8, J2-J7, K1, K2, M1, M3-M5, M7, M8 closed;
I4/J1/K3 and J7 recorded as accepted limitations rather than open defects by three of the four
lenses; L1 accepted as a measured Skip, L2 as superseded.

| ID | witnesses | claim | disposition |
| --- | --- | --- | --- |
| O1 | correctness (blocker, 99) | the `flagpack.ts` snippet declares `loadFlagpack` without `export`, although `FideInfo` and the tests import and spy on it — the snippet as written would not compile | **Fix** — `export async function loadFlagpack()`, with the file path in the snippet |
| O2 | tests (should-fix, 96) | case 2 never asserts the *absence* of an error surface; a regression that renders flag-load error text would pass it while violating criterion 5 | **Fix** — the case now asserts no error text anywhere in the modal |
| O3 | minimalism (nit, 96) | `gates:contract:check` already runs `lint:ci`, both boundary checks and the i18n checks; C4 listed them again | **Fix** — the duplicate bullet is removed and the containment is stated once |
| O4 | plan (blocker, 100) | `## Reviews` ends at round 3, so the r4 block is missing from the candidate | **Skip**, structural: the round-N record is written *after* round N returns, which is this entry. The lens was reviewing r4 with the r4 delta supplied in its prompt; from round 5 on the file carries r1-r4 |
| O5 | plan (blocker, 100) | the ACCEPTANCE field said "seven numbered criteria" while the plan enumerates eight | **Fix in the review inputs**, not the plan — the stale count was in the lens prompt, written when there were seven; criterion 8 has been in the plan since r2 and is authorized by the same MANDATE clause as the rest of C3 |

Round 5 — revision r5. Raw verdicts: `review-minimalism` **APPROVED** ("No bloat or duplication
defect reaches 80% confidence"), `review-correctness` **APPROVED** ("No correctness defects found
in the r5 candidate"), `review-tests` **REVISE**, `review-plan` **REVISE**. Both REVISEs are single
findings, and both are about the test harness rather than the change.

| ID | witnesses | claim | disposition |
| --- | --- | --- | --- |
| P1 | tests (blocker, 92) | the per-case `SWRConfig` must not itself set `shouldRetryOnError: false`, or case 2 measures the test's own provider instead of `FideInfo` | **Fix**, and the lens's suspicion is confirmed against this repository: `src/components/databases/PlayerCard.test.tsx:41` — the same directory — wraps in `<SWRConfig value={{ provider: () => new Map(), shouldRetryOnError: false }}>`, and `src/components/engines/EnginesPage.test.tsx` does it four times. The harness paragraph now says the provider supplies only `provider: () => new Map()` |
| P2 | plan (blocker, 96) | `vi.resetModules()` resets the module cache but leaves the mock registry intact, so case 2's rejecting mock survives into case 5, which needs the real package | **Fix** — every case explicitly `vi.doUnmock`s what it mocked, and the two cases that need the real package assert a real flag positively rather than inferring it from an absence |

Round 6 — revision r6, `review-plan` and `review-tests` only (the two lenses that returned REVISE
on r5; `review-minimalism` and `review-correctness` had both APPROVED r5 and the r6 delta touches
only the C2 harness paragraph). Raw verdicts: `review-plan` **REVISE**, `review-tests` **REVISE**.
Both closed P1 and both raised the same single finding, independently:

| ID | witnesses | claim | disposition |
| --- | --- | --- | --- |
| Q1 | plan (blocker, 99), tests (blocker, 98) | r6's parenthetical allowed `vi.resetAllMocks()` as an alternative to `vi.doUnmock`; it resets mock implementations, not `vi.doMock` registrations, so taking the fallback leaves case 2's rejecting mock active for case 5 | **Fix** — the fallback is deleted and named as wrong, with the required `vi.doUnmock` in `afterEach`/`finally` |

`review-plan` also recorded a limitation rather than a finding: the implementation does not exist
yet and the manifest on disk is pre-change, so it could not independently verify the post-change
byte figures. That is correct and expected for a plan review; the figures come from the five builds
in "## Options", which are reproducible with `pnpm build-vite`.

Round 7 — revision r7, `review-plan` and `review-tests`. Raw verdicts: `review-tests` **APPROVED**
("No findings at or above 80% confidence"), `review-plan` **REVISE**. Both closed Q1 and P1.
`review-plan` then found two things four earlier rounds and three other lenses had missed:

| ID | witnesses | claim | disposition |
| --- | --- | --- | --- |
| S1 | plan (blocker, 96) | C1 changes behaviour on the database and accounts routes too, although the MANDATE puts other routes out of scope — `FideInfo` is rendered from `Board.tsx:705-706`, `GameInfo.tsx:46-47` and `PersonalCard.tsx:47` | **Fix** — the exclusion is clarified to mean other routes' *byte budgets*; the behavioural reach of a shared component is stated in the MANDATE scope note and in the decision section, so what Felix decides visibly covers all three surfaces |
| S2 | plan (blocker, 97) | "one fresh attempt on each reopen" is false while a second `FideInfo` on the same key is mounted and already holds the error | **Fix**, and the lens's citation checks out verbatim: `swr@2.4.0`, `dist/index/index.mjs:309-314` — `if (hasRevalidator && !isUndefined(error)) return false;`, commented "if a key already has revalidators and also has error, we should not trigger revalidation". C1, criterion 5 and R5 now state the exception, and new test case 5 pins it with two mounted instances |

S2 is the second time a lens has corrected a claim I made about SWR's behaviour from reading its
configuration rather than its control flow (K2 was the first). Both were caught only because the
lens went to the source.

Round 8 — revision r8, `review-plan`, `review-tests` and `review-correctness`. Raw verdicts:
`review-plan` **APPROVED**, `review-correctness` **APPROVED**, `review-tests` **REVISE**. All three
closed S1 and S2 on their substance; all three then reported the same clerical defect, and
`review-tests` rightly treated it as a blocker, because a test suite written from stale case
numbers attaches the assertions and the mock cleanup to the wrong cases.

| ID | witnesses | claim | disposition |
| --- | --- | --- | --- |
| T1 | tests (blocker, 98), plan (should-fix, 99), correctness (nit, 99) | inserting the new S2 case as case 5 renumbered the K1 collision case to 6, and three cross-references still pointed at the old numbers | **Fix** — C1 now points at case 5 for S2, and the harness paragraph at cases 1 and 6 for the real-package cases |

`review-plan` and `review-tests` both recorded the same standing limitation: the implementation does
not exist yet, so a read-only review cannot reproduce the measured byte figures. They come from the
five builds in "## Options" and are reproducible with `pnpm build-vite`.
