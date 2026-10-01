# Database view Back button returns to the overview — plan and implementation review record

Scope: Felix's in-session report (2026-10-01, with a screenshot of the "Meine Partien" database
view): "When I click on the back button next to meine Partien in the header, then I would expect to
come back to the database overview. But nothing happens when I click on back. Is this a mistake or
what's the problem here?" No ledger finding: the defect was reported and planned in-session, then
implemented in a second session from a handover prompt. Plan (ignored run artefact):
`tasks/plans/2026-10-01-database-back-button.md`. This tracked record preserves the plan's premises,
its full review history and the implementation evidence, so the plan, its probe and the lens reports
may disappear. Decision recorded by this run: `d-20261001-08` (sidebar active state from a separate match path),
which supersedes `d-20261001-07`.

## Root cause (measured on `62c627b8`)

* The `/databases/` route had a `beforeLoad` that redirected to `/databases/$databaseId` whenever
  `activeDatabaseViewStore` held a database (`src/routes/databases/index.tsx`).
* The Back control was `<Link onClick={() => clearDatabase()} to="/databases">`. The click cleared
  the store synchronously; the still-mounted `DatabaseView` then re-derived `synchronizing` from its
  URL and its effect put the database straight back before the navigation's `beforeLoad` ran, which
  redirected back to the view.
* Probe (Vitest, real TanStack memory router, real store and `DatabaseView`, `beforeLoad` copied
  verbatim), output retained at plan time:

  ```text
  ## variant current
  STORE current db -> false path /databases/db-1 overview mounted false
  STORE current db -> true path /databases/db-1 overview mounted false
  beforeLoad saw db = true
  current after click: path = /databases/db-1 store db = true overview shown = false
  ## variant fixed
  STORE fixed db -> false path /databases/db-1 overview mounted false
  STORE fixed db -> true path /databases/db-1 overview mounted false
  STORE fixed db -> false path /databases overview mounted true
  fixed after click: path = /databases store db = false overview shown = true
  ```

* Because of the same redirect, every link to `/databases` (sidebar, the board's
  "select a reference database" link in `NoDatabaseWarning`, the not-found fallback) landed in the
  last opened database instead of the overview.

## Fix (plan O1-O5)

* O1: `/databases` always renders the overview (redirect removed).
* O2: Back is a plain link; no store write during the navigation.
* O3: mounting the overview ends the active-database session (mount-only clear in `DatabasesPage`).
* O4: the sidebar Databases entry resumes the active database explicitly (its destination is the
  view when a well-formed database is stored, else `/databases`), and stays marked on every
  `/databases*` route.
* O5: one builder, `databaseRouteTarget` in `src/components/databases/databaseRoute.ts`, used at all
  four sites; validated with `databaseHandleSchema`, never throws on a malformed persisted value.

## Plan review

Copied verbatim from the plan's `## Reviews` section.

### Round 1 (r1, 2026-10-01) — lenses on Codex: plan, minimalism, correctness, tests, persisted-state

Raw verdicts: correctness APPROVED; persisted-state REVISE; plan REVISE; minimalism REVISE;
tests REVISE. Raw reports: `$RUN_TMP/lens-*.txt` (scratchpad run dir), verbatim below per issue.

| ID | Witness (rank) | Claim | Evidence checked | Disposition | Authority |
| --- | --- | --- | --- | --- | --- |
| R1-I1 | persisted-state (blocker, 94) | O4 builds the sidebar link from the hydrated, unvalidated `database.file`; a malformed value throws in `capabilityKey` on every route | `database.ts:201-204` (no validation), `pathCapabilities.ts:15-22` (dereference) — confirmed | Fix: O4 failure semantics + O5 non-throwing builder + A5 test. Pre-existing view/route exposure filed (P10), not fixed here | Threat model: "app reloads with a persisted `database-view` sessionStorage entry" |
| R1-I2 | plan (blocker, 90) | O4 promises the marker active "nowhere else", but on HEAD the visual class freezes (sidebar-active-marker plan P5) and the test checks only positive states | sidebar-active-marker plan P4/P5 — confirmed | Fix: O4 scoped to `aria-current` (works on HEAD), visual class excluded as P8's; negative assertion added | MANDATE dependency of O4 |
| R1-I3 | plan (limitation) | P4/P5 probe not supplied | — | Fix: probe source and output copied to `tasks/plans/.probe-…` and cited | — |
| R1-I4 | minimalism (should-fix, 88) | O4 adds a third copy of the database-view route target | P11 — confirmed (four sites incl. the Explore Link) | Fix: O5 shared builder used at all four sites | Rule 11 |
| R1-I5 | minimalism (nit, 85) | Drop the DatabaseView "Back has no store write" test | — | Fix (arbiter-closed nit): test dropped | — |
| R1-I6 | tests (blocker, 100) | A new `e2e/database-navigation.spec.ts` runs in no Playwright project | `playwright.config.ts:44-48` — confirmed (P9) | Fix: e2e appended to `database-files.spec.ts` | Regression proof obligation |
| R1-I7 | tests (should-fix, 96) | Sidebar tests only assert positive routes | — | Fix (merged with R1-I2): negative `/files` assertion | — |

### Round 2 (r2, 2026-10-01) — closure round: plan, minimalism, correctness, tests, persisted-state

Raw verdicts: correctness APPROVED; minimalism APPROVED (R1-I4 CLOSED); persisted-state APPROVED
(R1-I1, I2, I3, I4, I6, I7 CLOSED); tests APPROVED (R1-I6, I7 CLOSED; one should-fix); plan REVISE
(R1-I1, I2, I3, I4, I6, I7 CLOSED; one blocker). R1-I5 arbiter-closed. All round-1 issues closed.

| ID | Witness (rank) | Claim | Evidence checked | Disposition | Authority |
| --- | --- | --- | --- | --- | --- |
| R2-I8 | tests (should-fix, 91) | O5's builder tests omit the empty-string key boundary | O5 text "non-empty string key" — confirmed gap | Fix (test case only, contract unchanged): A5 adds the empty-key value | O5 |
| R2-I9 | plan (blocker) | Tests do not catch a sidebar match that follows the dynamic target: store A, URL `/databases/<B>` while the view synchronizes loses `aria-current` | `Sidebar.tsx:28,31` (same `url` for destination and match), `DatabaseView.tsx:38` (sync effect) — confirmed reachable | Fix (test case only; O4 already requires the prefix match): A3 + Sidebar test add the A/B case | O4 |

### Round 3 (r3, 2026-10-01) — closure round: plan, tests

Raw verdicts: tests APPROVED (R2-I8, R2-I9 CLOSED); plan APPROVED (R2-I8, R2-I9 CLOSED).
All issues R1-I1..R2-I9 closed (R1-I5 by arbiter record). Plan review converged in 3 rounds;
plan-level adoptions r1=6, r2=2, r3=0. No carried items. Final verdict set: plan, minimalism,
correctness, tests, persisted-state — all APPROVED on their last round.
Reviewed body: `tasks/plans/.plan-2026-10-01-database-back-button-r3.body.md` (HEAD `62c627b8`).

## Drift at implementation (HEAD `99b78e70`)

P1-P7 and P9-P11 re-verified unchanged. P8 drifted: the sidebar active-marker plan had landed
(`b32ea2e1`, `d-20261001-07`), so `NavbarLink` took its marker from TanStack `Link`'s `activeProps`
and `src/components/Sidebar.test.tsx` already existed. `Link` in `@tanstack/react-router` 1.161.1
computes `isActive` only against its own destination (`dist/esm/link.js:315-356`), so O4's
requirement (match on the `/databases` prefix, never on the resolved target) could not be met with
Link-native state. `NavbarLink` now computes one boolean per link with `useRouterState({ select })`
(segment-boundary prefix test against a separate match path) and drives `.active` and
`aria-current` from it. A selected primitive cannot be frozen by React Compiler memoization, which
was the property `d-20261001-07` needed; `useMatchRoute` stays excluded. Recorded as
`d-20261001-08`, superseding `d-20261001-07`. No plan-level issue was reopened: O4's acceptance was already stated independent of the
`NavbarLink` implementation.

## Implementation evidence

* Run: interactive Claude Code (Opus 5.5) session, 2026-10-01, from Felix's handover prompt;
  executor selection `gemini`, whose write route is Codex (`gpt-6-luna`, role `normal`). No drain
  was running (`findings.py drain-status` exit 1); the tree was clean at start. Another session
  filed ledger entries (`f-20261001-18`, `-19`) into the same checkout during the run and touched no
  file of this change.
* Phase 1 (one Codex write leaf, O1-O5 plus tests): leaf proofs `pnpm checks:pre-review` green and
  `pnpm exec vitest run src/components/databases src/components/Sidebar.test.tsx
  src/components/panels/info src/routes` 18 files / 143 tests green. A first launch failed before
  the leaf started: the brief was written to the launcher's own report path
  (`<name>.txt`), which the launcher truncates; relaunched with the brief under another name.
* First `pnpm test:e2e:container`: 56 passed, 2 failed. Both new journeys reached their final
  state but the fixture rejected an unexpected `edit_db_info` IPC. Cause, pre-existing in the same
  file: `GeneralSettings` wrote the unchanged title and description on every selection, never
  handled the rejection, and wrote an empty title despite the "name required" error; the two
  game-cleanup buttons swallowed failures. Handled in-run as its own fix (rule 4b, same area) by a
  second Codex write leaf: write only on a real change, never an empty title,
  `notifyUnlessCancelled` on failure. Five new Vitest cases, each reported red on the old code.
  The fix-only state was verified separately in a worktree (tsgo, 62 database tests, oxfmt, oxlint)
  after moving one fixture return type (`SuccessDatabaseInfo`) from the phase hunk into the fix
  commit (orchestrator one-line edit to resolve the hunk overlap).
* Combined tree: vitest set 18 files / 148 tests green, `pnpm checks:pre-review` green,
  `pnpm test:e2e:container` 58 passed, no snapshot moved.
* Regression proof: with the old `beforeLoad` redirect restored in
  `src/routes/databases/index.tsx`, `pnpm test:e2e:container -- --project=database-files` failed A1
  (`Expected: ".../databases"`, `Received: ".../databases/navigation-db"`); the other two cases
  passed. Fix restored afterwards.
* Filed, not fixed (different area): `f-20261001-20` — `DatabaseInfo.storage_size` is declared
  `bigint` but crosses IPC as a JSON number; the persisted store would throw on a real bigint, so
  the new fixtures cast the value `as unknown as bigint` (`0` in `Sidebar.test.tsx`, `1` in
  `ConcurrentConversion.test.tsx`).
* Commits: `4a1d1aa9` fix(databases): write database info only after an edit; `560174d7`
  fix(databases): Back returns to the database overview; `a458ba1e` / `11acc776` decision
  `d-20261001-08` and the supersession trailer on `d-20261001-07`.

## Push review

Executor selection `gemini`: every lens ran on agy (Gemini), every write leaf on Codex, so detection
was family-separated from the code author. The arbitration was not independent: the arbitrating
session also wrote this implementation's briefs and amended the plan's P8 drift.

### Round 1 (`REVIEWED_THROUGH=d2f3f0a5`, range `99b78e70..d2f3f0a5`)

Lenses: correctness, root-cause, tests, code-quality, minimalism, error-handling, persisted-state
(code paths, role normal) and the records lens (record paths, role mechanical). All eight returned
`VERDICT: APPROVED`; correctness, root-cause and persisted-state reported no findings.

| ID | Lens (confidence) | Finding | Verdict |
| --- | --- | --- | --- |
| P1-1 | tests (92) | duplicate-cleanup failure notification untested | Fix |
| P1-2 | tests (88) | description-only edit untested | Fix |
| P1-3 | tests (85) | Explore route target exercised by no test | Fix — second e2e journey opens via Explore |
| P1-4 | tests (82) | InfoPanel database-card navigation untested | Fix |
| P1-5 | code-quality (85) | anonymous route-target union type | Fix — `DatabaseRouteTarget` |
| P1-6 | code-quality (85) | mount-only session clear lacks its reason | Fix — comment |
| P1-7 | code-quality (90, nit) | two `@/utils/db` imports in `databaseRoute.ts` | Fix |
| P1-8 | minimalism (90) | two near-identical cleanup handlers | Fix — `runCleanup` |
| P1-9 | minimalism (85, nit) | sidebar target repeats the match path | Fix — optional, defaults to it |
| P1-10 | error-handling (94) | `IndexInput` failure leaves loading stuck, unreported (pre-existing) | Fix |
| P1-11 | error-handling (90) | `mergePlayers` rejection unhandled (pre-existing) | Fix |
| P1-12 | records (95, nit) | `f-20261001-20` says both fixtures cast `1`; the Sidebar fixture casts `0` | Fix — appended correction |
| P1-13 | records (95, nit) | same claim in this record | Fix — line corrected |

Repairs: one Codex write leaf for P1-1..P1-11 (commit `acf1dbfa`; leaf proofs: vitest set 18 files
/ 153 tests, `pnpm checks:pre-review` green), the `f-20261001-20` annotation (`89aa2161`) and this
record's correction.
