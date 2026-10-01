# Sidebar active marker follows the route — plan and implementation review record

Scope: Felix's in-session report (2026-10-01, with a screenshot): "I switch to users and I can also
switch to files and databases but the blue mark that is currently next to board at the top always
stays at the top. Should the blue mark move when I select a different folder?" No ledger finding:
the defect was reported in-session and fixed in-session. Plan (ignored run artefact):
`tasks/plans/2026-10-01-sidebar-active-marker.md`. This tracked record preserves the issue and round
history so the plan and the lens reports under `/tmp` may disappear. Decision recorded by this run:
`d-20261001-07` (Link-native active state).

## Lineage and run facts

* Interactive build run, one Claude Code (Opus 5.5) session, 2026-10-01. Executor: Codex
  (`gpt-6-luna`; `review-plan` role for the plan lens, `normal` for the other lenses and the phase,
  `mechanical` for one fix). Plan authorship and arbitration shared one context; detection ran in
  separate Codex processes of a different model family.
* A findings drain was running when implementation began; a drain cluster session was active in the
  shared checkout. Implementation and every gate therefore ran in an isolated worktree
  (`~/Projekte/chessfable-sidebar`, branch `sidebar-active-marker` off `origin/master`) and the
  commits were moved onto `master` only after the drain had stopped.
* Root cause, measured (rule 12b) on `78766420`:
  * `@tanstack/react-router` 1.161.1 `useMatchRoute` returns `React.useCallback(..., [router])`
    (`dist/esm/Matches.js:54-68`): identity never changes across navigations.
  * The React Compiler (`vite.config.ts` babel preset, also active under Vitest — the compiled
    `SideBar` began with `const $ = (0,__vite_ssr_import_0__.c)(11);`) memoized the class input of
    `NavbarLink` on `[match, url]` (`if ($[1] !== match || $[2] !== url) { t2 = match(...) } else
    { t2 = $[3] }`), while `aria-current` was recomputed every render.
  * Probe with a real router: after `/ → /accounts` the Board anchor kept `_active_0f2f5d` while
    `aria-current` had moved to User.
  * Upstream had fixed this in `abe54ab8` with `"use no memo";`; the fork's unreviewed audit commit
    `3afed031` deleted that line. No other upstream `"use no memo"` exists.

## Plan review

| Round | Lenses | Raw verdicts | Adopted plan-level |
| --- | --- | --- | --- |
| r1 | review-plan, review-minimalism, review-correctness, review-tests | APPROVED (1 should-fix), APPROVED, APPROVED, APPROVED | 1 |
| r2 | review-plan | REVISE (I1 closed, 1 blocker) | 1 |
| r3 | review-plan, review-tests | APPROVED (I2 closed, 1 should-fix), APPROVED (I2 closed) | 0 (I3 arbiter-closed) |

| ID | Claim | Witness | Disposition | Closure |
| --- | --- | --- | --- | --- |
| I1 | Snapshot criterion "differ only at the marker" would reject the intended update: `.active` also sets the icon colour (`Sidebar.module.css:27-37`) | review-plan r1 (should-fix, 98) | Fix — expected diff named as border and icon colour of the two affected links | closed r2 by review-plan |
| I2 | Production-bundle proof was screenshot-only over two flows | review-plan r2 (blocker, 88) | Fix — a screenshot-free Playwright walk over every sidebar link from `/`, asserting `aria-current` and computed `border-left-color` | closed r3 by review-plan and review-tests |
| I3 | O2 carried executor detail (click order, style recipe) | review-plan r3 (should-fix, 88) | Fix — moved to the Phase 1 brief; contract, assertions and command unchanged | closed r3 by arbiter record |
| I4 | Premise P10 (snapshots that record the bug) listed only sidebar-click flows; `file-freshness.spec.ts` opens a game from `/files`, which navigates client-side to `/` (`expect(page).toHaveURL(/\/$/)`), so its two snapshots also recorded the stale marker on Files | orchestrator, first container run after the fix | Fix — prediction corrected to four snapshots after reading all four `*-diff.png`: each differs only in the border/icon of the two affected sidebar links | closed at implementation (evidence below) |

Totals: 4 issues opened, 4 closed, 0 open. Final lens verdicts: all APPROVED.

## Implementation evidence

* Phase 1 (one Codex write leaf): `src/components/Sidebar.tsx` uses `Link`'s
  `activeProps={{ className: classes.active }}`; `useMatchRoute`, the hand-set `aria-current` and
  `clsx` removed. `fix-1` (mechanical leaf) removed the dead `NavbarLinkProps.active` prop.
* `src/components/Sidebar.test.tsx` red on the old `Sidebar.tsx` at the first navigation:
  `AssertionError: expected [ 'SideBar.Board' ] to deeply equal [ 'SideBar.User' ]`; green after.
  The `/engines?selected=2` step was measured to produce pathname `/engines`, search
  `{ selected: 2 }`.
* New e2e test `accounts-puzzles-engines: moves the active sidebar marker with navigation`, run in the
  container against the old `Sidebar.tsx`: red at the User click (`Expected: not "rgba(0, 0, 0, 0)"`).
* `pnpm test:e2e:container` with the fix: 52 passed, 4 failed — exactly the four snapshots of I4,
  all diffs confined to two sidebar links. `pnpm test:e2e:update` rewrote exactly those four;
  the following `pnpm test:e2e:container` run: 56 passed.
* Moved snapshots: `accounts-puzzles-engines-accounts-puzzles-engines.png` (marker User → Board),
  `async-errors-async-errors.png` (Settings → Databases),
  `file-freshness-conflict-file-freshness.png` and `file-freshness-unavailable-file-freshness.png`
  (Files → Board).
