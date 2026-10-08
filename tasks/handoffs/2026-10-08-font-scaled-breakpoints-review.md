# Review handoff: f-20260927-08

> Adoption note, 2026-10-08: the opening summary and embedded plan snapshots below are historical records of the original five-round plan run. The Round 6 refresh section records the final cumulative six-round history on base `53a2a911994d023a8cd3cd1dc735045cfbaf47a9`. Adoption passed with `clear`. The adopting Codex run recorded the four retained decisions as `d-20261008-18` through `d-20261008-21`. The implementation and cumulative review record is [2026-10-08-f-20260927-08-implementation-review.md](2026-10-08-f-20260927-08-implementation-review.md). Original plan authorship and arbitration shared one context. Detection ran on the same model family as the code.

Plan: `tasks/plans/2026-10-08-font-scaled-breakpoints.md`. Base `a990c06a66ca856dd59ba452b9105b0289e6c99e`. Planner session `8bbaeb31-3e89-42fc-b718-16465f54845c` (drain run `a28f99b3-2237-4fa8-b5ca-715d97e8cd6a`). Plan-only; stopped before Preflight. Executor Codex (`DRAIN_EXECUTOR=codex`); `review-plan` at role `review-plan`, every other lens at `normal` (no planned file matches a Sensitive-Path glob in `.claude/skills/push/SKILL.md`).

Finding `f-20260927-08` (entry `build`, revalidated: the open design question — one mechanism for all sites and global vs per-site theme breakpoints — is not settled by `d-20260831-16`, which only fixes the reflow-not-clip contract; the plan answers it under `## Decided autonomously` D1–D5, recorded in `tasks/decisions.md` by the adopting session). Five rounds. Adopted `r1=4 r2=2 r3=3 r4=1 r5=0`. Elapsed 289 s, 285 s, 144 s, 183 s, 280 s. Opened 9 (I1–I9), resolved 9, skipped 0, deferred 0, carried 0, open 0. One withdrawn mechanism (O4, issue I3); one correction-introduced defect (I7, lineage I4). No rewrites or splits. Dispositions are the arbiter's (this planner session, which also wrote the plan); every lens ran on the same model family (Codex).

Locate evidence: probes `probe-1-r1` (inventory of every width switch, Mantine 8.3.14 breakpoint resolution, SimpleGrid container mode) and `probe-2-r1` (e2e font-scale matrix, clipping helpers, snapshot exposure), summarised in the plan's `## Traced premises` P4–P7.

Out-of-area filing (before r1, not a plan issue): inbox entry `20261008-091923-1457949-1791443963092296318-6.md` — "The persisted app font scale is accepted at any finite value, so a corrupt `font-size` makes the app unusable" (`frontend-state`, `inline`).

## Reviews

### Round 1 — r1 (12 lenses, every plan-capable lens; elapsed 289 s wall; adopted 4)

Lens set: review-plan (`--role review-plan`), and at `--role normal` (no Sensitive-Path glob in
the plan's files): review-minimalism, review-correctness, review-tests, review-error-handling,
review-chess-semantics, review-engine-protocol, review-ipc-contract, review-persisted-state,
review-pgn-index, review-platform-semantics, review-tauri-security. Executor: codex (OpenAI high
tier). Not run: review-code-quality, review-root-cause (`plan-review: false`).

Raw verdicts: plan REVISE · minimalism REVISE · correctness APPROVED · tests APPROVED ·
error-handling APPROVED · chess-semantics APPROVED (NOT APPLICABLE) · engine-protocol APPROVED
(NOT APPLICABLE) · ipc-contract APPROVED (NOT APPLICABLE) · persisted-state APPROVED (NOT
APPLICABLE) · pgn-index APPROVED (NOT APPLICABLE) · platform-semantics APPROVED (NOT APPLICABLE) ·
tauri-security APPROVED (NOT APPLICABLE). NOT APPLICABLE reasons checked by the arbiter: each
names only chess trees, engines, IPC, storage encoding/hydration, PGN, OS/FFI or credential
surfaces; the plan reads `fontSizeAtom` without changing its storage, and touches none of the
others — correct.

Raw findings (verbatim):

**lens-plan-r1:**

```text
[blocker] tasks/plans/2026-10-08-font-scaled-breakpoints.md:144 — O5 does not prove that changing the font scale updates the mounted App’s theme. The proposed App test checks only initial arguments (`src/App.test.tsx:560`), and the e2e cases seed each scale before startup. A theme cached at the initial scale could pass these proofs while grids remain unchanged after a slider adjustment. This integration matters because the current theme memo excludes font size (`src/App.tsx:214`). Require a mounted-app scale change that verifies the grid switches without reloading. (confidence: 97)

[blocker] tasks/plans/2026-10-08-font-scaled-breakpoints.md:169 — The promised WebKitGTK proof cannot run as written. `pnpm verify:app` invokes `scripts/verify-app.mjs` (`package.json:78`), whose only parsed option is `--screenshot` (`scripts/verify-app.mjs:433`). It contains no font-scale, Settings orientation, or window-resizing check and starts the compositor with default dimensions (`scripts/verify-app.mjs:1064`, `scripts/app-driver.mjs:168`). Neither phase includes changes to that verifier. Specify an executable real-app probe or include the necessary verifier extension so this command can actually reject incorrect breakpoint behavior. (confidence: 100)

VERDICT: REVISE```

**lens-minimalism-r1:**

```text
[should-fix] tasks/plans/2026-10-08-font-scaled-breakpoints.md:133 — O4 adds two renderer-wide source restrictions without identifying a mandate obligation that O1–O3 and O5 cannot satisfy. Its blanket `useMediaQuery` import ban also covers unrelated features such as `prefers-reduced-motion`. The shared push-review policy’s “Proof selection before custom source verification” requires an uncovered obligation and an explanation of why behavioral checks cannot prove it, even when extending an existing checker. The smallest sufficient plan retains the shared scaling function, two-caller hook, Settings marker and behavioral proofs, while removing O4 and all changes to the two boundary-checker files. This preserves mandate coverage and removes an entire tooling obligation (confidence: 95).

VERDICT: REVISE```

**lens-correctness-r1:**

```text
No correctness defects found in O0–O5. At 1000px/200%, Settings’ threshold becomes 1600px and the grid’s `sm` threshold becomes 1536px, producing horizontal tabs and stacked panes. At 100%, both retain their existing layout.

Limitation: implementation and browser behavior remain unverified in this plan-only review (confidence: 100).

VERDICT: APPROVED```

**lens-tests-r1:**

```text
[should-fix] tasks/plans/2026-10-08-font-scaled-breakpoints.md:147 — No proposed assertion exercises App’s theme update after changing font scale without remounting. Omitting `fontSize` from the theme memo dependencies would pass the factory tests, initial App argument assertion, isolated hook test and startup-seeded e2e cases. Add a live scale-change test that asserts the grid changes columns. (confidence: 98)

[should-fix] tasks/plans/2026-10-08-font-scaled-breakpoints.md:169 — The named `pnpm verify:app` command runs `scripts/verify-app.mjs`, which neither seeds 200% font scale nor asserts Settings’ orientation. No phase adds that check or names a runnable custom probe. The claimed WebKitGTK proof would therefore miss fixed breakpoints. Specify the probe and its failing-on-revert orientation assertion. (confidence: 99)

VERDICT: APPROVED```

**lens-error-handling-r1:**

```text
[should-fix] tasks/plans/2026-10-08-font-scaled-breakpoints.md:119 — O2 leaves subscription-failure semantics unspecified. Mantine catches media-query setup failures silently, returning false initially or retaining the previous result after a query change. O3 would then apply wide or stale Settings styles without any diagnostic. State whether this fallback is intentional and how failure should surface. (confidence: 94)

VERDICT: APPROVED```

Issues (stable IDs):

| ID | Claim | Witnesses | Evidence (arbiter) | Disposition | Authority | Correction (r2) | Status |
|---|---|---|---|---|---|---|---|
| I1 | No proof that a font-scale change updates the mounted App's theme and hook; every proof seeds the scale before startup. | plan r1 #1 (blocker), tests r1 #1 (should-fix) | Confirmed: `src/App.tsx:214-217` memo deps are `[primaryColor, spellCheck]`; `App.test.tsx:563` asserts only the initial argument. | Fix | MANDATE "make the compact/column switch follow the effective width in scaled root-em" (a switch that ignores a live scale change does not follow it) | O5 e2e adds a live change: 100 % → 200 % through the Settings slider without reload; Settings tablist turns horizontal and, after in-app navigation, the grid panes are stacked. | open → r2 |
| I2 | The promised WebKitGTK proof (`pnpm verify:app`) cannot run as written. | plan r1 #2 (blocker), tests r1 #2 (should-fix) | Confirmed: `scripts/verify-app.mjs:433` parses only `--screenshot`; `scripts/app-driver.mjs:168` `startCompositor({ width, height })` and `Session.call`/`/execute/sync` (`:250-305`) are exported. | Fix | Not a new mechanism (a scratch probe on the existing harness; nothing committed). | O5's real-webview item is a one-off scratch probe on `scripts/app-driver.mjs` exports: font-size 200 then 100, innerWidth in [801, 1599], tablist `aria-orientation` horizontal / vertical; fails on revert. | open → r2 |
| I3 | O4's two `ui:boundary:check` rules serve no MANDATE obligation the behavioural proofs cannot; the `useMediaQuery` ban is overbroad. | minimalism r1 #1 (should-fix) | Confirmed: `~/.claude/references/push-review-policy.md:427-436` "Proof selection before custom source verification" applies equally to extending an existing checker. | Fix (withdraw mechanism) | — (removal) | O4 withdrawn; D4 removed; the two checker files leave Phase 1's file list and proof. | open → r2 |
| I4 | O2 does not state subscription-failure semantics (Mantine silently keeps `false`). | error-handling r1 #1 (should-fix) | Confirmed: `@mantine/hooks/esm/use-media-query/use-media-query.mjs:19-34` catches a `matchMedia` throw and keeps the initial value. | Fix | Not a new mechanism (states existing behaviour). | O2 gains a "Failure semantics" paragraph: always a well-formed finite-em query; on missing/throwing `matchMedia` the hook reports `false` exactly as today; no diagnostic added, deliberately. | open → r2 |

Adopted plan-level corrections r1: 4 (I1–I4). Carried: none. Skipped: none. Deferred: none.
Out-of-area filing during Locate (before r1): inbox entry
`20261008-091923-1457949-1791443963092296318-6.md` (persisted font scale not range-checked;
`frontend-state`, `inline`); not a plan issue.

### Round 2 — r2 (closure round: review-plan + witnesses review-minimalism, review-tests, review-error-handling; elapsed 285 s wall; adopted 2)

Raw verdicts: plan REVISE · minimalism APPROVED · tests APPROVED · error-handling APPROVED.

Raw findings (verbatim):

**lens-plan-r2:**

```text
I1 CLOSED — r2 O5:166 adds a slider-driven change without reload and checks Settings plus the grid. This exercises the missing dependency in `src/App.tsx:214` (confidence: 98).

I2 CLOSED — r2 O5:179 replaces the ineffective command with a scratch probe using the existing exports at `scripts/app-driver.mjs:168,250,291,304`, with discriminating viewport and orientation assertions (confidence: 95).

I3 CLOSED — r2 O4:141 withdraws the source restrictions, and Phase 1:257 removes the checker changes (confidence: 100).

[should-fix] tasks/plans/.plan-2026-10-08-font-scaled-breakpoints.md-r2.body.md:128 — I4 NOT CLOSED. Mantine does not always report initial `false` after setup failure. Its catch leaves state unchanged after a query change, and listener registration happens after `setMatches(mediaQuery.matches)`. Evidence: `/home/felixb/Projekte/chessfable/node_modules/@mantine/hooks/esm/use-media-query/use-media-query.mjs:4,25`. State the actual retained-result behavior and whether that degradation is intentional (confidence: 100).

[blocker] tasks/plans/.plan-2026-10-08-font-scaled-breakpoints.md-r2.body.md:257 — Phase 1 omits `src/components/files/FilesPage.test.tsx`. Its atom mock exposes no `fontSizeAtom` (`:25,51`), its Jotai mock exposes only `useAtom` (`:45`), and it renders the real FilesPage (`:313`). O2 introduces an atom-reading hook into that render path, so the required Vitest proof cannot pass with these mocks unchanged. Add this test file and its mock updates to the phase’s write set (confidence: 99).

[should-fix] tasks/plans/2026-10-08-font-scaled-breakpoints.md:287 — The supplied `Full record:` lookup path is empty, despite the required history field in `/home/felixb/.claude/references/review-lens-contract.md:137`. The complete record was accessible through the full-plan path named in DELTA. Include that path explicitly in subsequent review packets (confidence: 100).

VERDICT: REVISE```

**lens-minimalism-r2:**

```text
I3 CLOSED — r2 withdraws O4, removes D4, and drops both checker files from Phase 1. The remaining shared hook serves two existing callers. No new bloat or duplication findings in the revised obligations.

VERDICT: APPROVED```

**lens-tests-r2:**

```text
I1 CLOSED — O5’s slider-driven, no-reload test would fail on the grid-stacking assertion if App’s theme memo omitted the font-scale dependency.
I2 CLOSED — O5 now uses the exported WebDriver harness with a discriminating viewport range. Reverting the scaled Settings query would fail the 200% horizontal-orientation assertion.
VERDICT: APPROVED```

**lens-error-handling-r2:**

```text
[should-fix] I4 NOT CLOSED — O2 specifies a fallback that Mantine does not guarantee.

[should-fix] tasks/plans/.plan-2026-10-08-font-scaled-breakpoints.md-r2.body.md:128 — Mantine’s catch does not reset `matches` to `false`. If a live font-scale change causes `matchMedia` to throw, the hook retains its previous boolean. If listener attachment fails, it retains the newly sampled boolean but stops tracking viewport changes. Settings’ orientation/CSS and Files’ fullscreen state can therefore remain compact or become stale, without diagnostics. The cited Mantine source establishes these outcomes directly. Specify whether retaining that silent degradation is intentional, or require the stated wide-layout fallback (confidence: 99).

VERDICT: APPROVED```

Closures: I1 CLOSED (plan r2, tests r2) · I2 CLOSED (plan r2, tests r2) · I3 CLOSED (plan r2,
minimalism r2). I4 NOT CLOSED (plan r2 #1, error-handling r2 #1/#2) — residual keeps ID I4.

| ID | Claim | Witnesses | Evidence (arbiter) | Disposition | Authority | Correction (r3) | Status |
|---|---|---|---|---|---|---|---|
| I4 (residual) | The r2 failure-semantics text is wrong: Mantine's catch keeps the previous result after a query change, and a failed listener attachment keeps the sampled value untracked; it does not always report `false`. | plan r2 #1 (should-fix), error-handling r2 #1, #2 (should-fix) | Confirmed: `use-media-query.mjs:4-11` (`attachMediaListener`), `:25-33` (`setMatches` before attach; catch returns `undefined` without resetting). | Fix | Not a new mechanism (corrects the statement of inherited behaviour). | O2 "Failure semantics" rewritten to the actual retained-result behaviour, stated as deliberately kept (today's behaviour; a fallback would be a mechanism without MANDATE obligation). | open → r3 |
| I5 | Phase 1's write set omits `src/components/files/FilesPage.test.tsx`, whose `jotai` mock exposes only `useAtom` and whose `@/state/atoms` mock has no `fontSizeAtom`; the Vitest proof cannot pass once FilesPage calls O2's hook. | plan r2 #2 (blocker) | Confirmed: `FilesPage.test.tsx:25` (`stateAtoms` = two atoms), `:45-50` (`jotai` mock = `useAtom` only), `:51`. | Fix | Not a new mechanism (phase write set). | Phase 1 file list names `FilesPage.test.tsx` and the mock obligation. | open → r3 |
| I6 | The r2 packet's `Full record:` lookup path was empty. | plan r2 #3 (should-fix) | Confirmed: the orchestrator's `sed` used `#` as delimiter, so `## Reviews in <path>` was cut (`inputs-r2.txt`). Packet defect, not a plan defect. | Fix (packet) | — | r3 packets carry the full-record path explicitly (built without `sed`). | open → r3 |

Adopted plan-level corrections r2: 2 (I4 residual, I5). I6 is a review-packet correction, not
counted as a plan adoption.

### Round 3 — r3 (closure round: review-plan + review-error-handling (I4) + review-tests (affected by I5's test-file change); elapsed 144 s wall; adopted 3)

Raw verdicts: plan REVISE · tests REVISE · error-handling APPROVED.

Raw findings (verbatim):

**lens-plan-r3:**

```text
I4 CLOSED — r3:125–136 correctly states Mantine’s retained-result behavior and intentionally preserves it. Confirmed in `/home/felixb/Projekte/chessfable/node_modules/@mantine/hooks/esm/use-media-query/use-media-query.mjs:22–34` (confidence: 100).

I5 CLOSED — r3:257–258 adds `FilesPage.test.tsx` and its mock updates, addressing the incomplete mocks at `src/components/files/FilesPage.test.tsx:25,45–51` (confidence: 100).

I6 CLOSED — this packet supplies the full-record path, whose Reviews section exists at `tasks/plans/2026-10-08-font-scaled-breakpoints.md:286` (confidence: 100).

[blocker] tasks/plans/.plan-2026-10-08-font-scaled-breakpoints.md-r3.body.md:262 — Phase 1 requires O3, but the r3 delta deletes that obligation entirely. Its contract required replacing the fixed CSS query while preserving every compact rule and covering both Tabs and search results. Those consumers remain at `src/components/settings/SettingsPage.module.css:69–104` and `src/components/settings/SettingsPage.tsx:731,784`. Restore O3 so the mandate’s shared JS/CSS condition remains an explicit obligation (confidence: 100).

[blocker] tasks/plans/.plan-2026-10-08-font-scaled-breakpoints.md-r3.body.md:254 — Phase 1 omits another affected consumer, `src/components/home/StartupStorageFailure.test.tsx`. O1 adds the required font-scale argument to StartupStorageFailure’s theme call, but this test asserts the exact old argument object at `src/components/home/StartupStorageFailure.test.tsx:130–133`. That assertion will fail, and the narrow Vitest command at plan:265 excludes the home directory. Add this file, update its expectation, and include it in the proof (confidence: 100).

VERDICT: REVISE```

**lens-tests-r3:**

```text
[blocker] tasks/plans/.plan-2026-10-08-font-scaled-breakpoints.md-r3.body.md:155 — R3 deletes O3, while the remaining Settings proof asserts tab orientation, marker presence and clipping, without asserting compact CSS reflow or exercising search results. Restricting the compact styles to the Tabs subtree would leave search-result rows unscaled and pass the named proofs, which never render that branch. Restore the CSS obligation and name a browser assertion that checks compact row geometry in search results at 1000px/200%, with the 100% comparison. (confidence: 96)

VERDICT: REVISE```

**lens-error-handling-r3:**

```text
I4 CLOSED — O2 now matches Mantine’s source: `matchMedia` failure retains false on mount or the previous result after a query change. Failed listener attachment retains the sampled value without resize tracking. The plan explicitly accepts this undiagnosed degradation (confidence: 99).

VERDICT: APPROVED```

Closures: I4 CLOSED (plan r3, error-handling r3) · I5 CLOSED (plan r3) · I6 CLOSED (plan r3).

| ID | Claim | Witnesses | Evidence (arbiter) | Disposition | Authority | Correction (r4) | Status |
|---|---|---|---|---|---|---|---|
| I7 (lineage: I4) | The r3 revision deleted O3 (Settings CSS driven by the same boolean) entirely. Correction-introduced: the I4 rewrite replaced the text from O2's failure paragraph up to the O4 heading, and O3 sat in between. | plan r3 #1 (blocker), tests r3 #1 (blocker, first half) | Confirmed: `plan-r3.md` has no `### O3`; the r3 delta lists no O3 heading. | Fix | Restores r1 content (MANDATE "drive the CSS side from the same source"). | O3 restored byte-identical to r1 (checked with `diff` of the O3 section against `plan-r1.md`). | open → r4 |
| I8 | Phase 1 omits `src/components/home/StartupStorageFailure.test.tsx`, which asserts the exact old `createAppTheme` argument; the vitest proof excludes `src/components/home`. | plan r3 #2 (blocker) | Confirmed: `StartupStorageFailure.test.tsx:130-133` (`toHaveBeenCalledExactlyOnceWith({ primaryColor: "blue", spellCheck: false })`). All four test callers of `createAppTheme` now listed (grep: App.test, ThemeButton.test, ColorControl.test, StartupStorageFailure.test). | Fix | Not a new mechanism (phase write set and proof). | Phase 1 file list adds the file; proof 1 adds it to the vitest command. | open → r4 |
| I9 | No proof exercises O3's compact CSS, and none renders the search-results branch; a marker placed on the Tabs subtree only would pass. | tests r3 #1 (blocker, second half) | Confirmed: O5 asserted orientation, marker presence and clipping only; `SettingsPage.tsx:693-731` renders search results outside the Tabs. | Fix | MANDATE "drive the CSS side from the same source" (O3) — verification of an existing obligation, no new mechanism. | O5 e2e adds: at 1000px/200 % a setting row's control sits below its copy in an open tab panel and in the search-results list; at 1000px/100 % the same rows are side by side. | open → r4 |

Adopted plan-level corrections r3: 3 (I7, I8, I9).

### Round 4 — r4 (closure round: review-plan + review-tests; elapsed 183 s wall; adopted 1)

Raw verdicts: plan REVISE · tests REVISE.

Raw findings (verbatim):

**lens-plan-r4:**

```text
I7 CLOSED — r4:138 restores O3, including preservation of every compact rule and coverage of both branches. Confirmed against `src/components/settings/SettingsPage.module.css:69` and `SettingsPage.tsx:761` (confidence: 100).

I8 CLOSED — r4:267 includes `StartupStorageFailure.test.tsx`, and r4:279 includes it in the proof command. This covers the exact-argument assertion at `src/components/home/StartupStorageFailure.test.tsx:130` (confidence: 100).

[blocker] tasks/plans/.plan-2026-10-08-font-scaled-breakpoints.md-r4.body.md:166 — I9 NOT CLOSED. Below-copy geometry does not prove compact CSS applies. `SettingsLayout.tsx:19` uses a Group whose default is wrapping (`/home/felixb/Projekte/chessfable/node_modules/@mantine/core/esm/components/Group/Group.mjs:27`). The existing copy basis, control minimum and gap (`SettingsPage.module.css:35`, `SettingsPage.module.css:40`, `SettingsLayout.tsx:21`) total 32rem, or 1024px at 200%. They already force wrapping inside a 1000px viewport without the compact rules. Consequently, a marker incorrectly restricted to Tabs can still pass the new search-results geometry comparison. Require an assertion that distinguishes compact CSS from ordinary wrapping in both branches, such as computed column direction or full-width controls (confidence: 96).

Limitation: browser geometry was not executed in this read-only review. The finding rests on the current CSS and Mantine source (confidence: 100).

VERDICT: REVISE```

**lens-tests-r4:**

```text
I7 CLOSED — O3 again requires the shared compact condition on the outer Settings root, covering Tabs and search results.

[blocker] tasks/plans/.plan-2026-10-08-font-scaled-breakpoints.md-r4.body.md:166 — I9 NOT CLOSED. “Control below copy” does not distinguish compact CSS from existing flex wrapping. `SettingRow` uses Mantine Group’s default `wrap: "wrap"`. The unchanged CSS gives copy an 18rem basis and controls a 12rem minimum, with a 2rem gap. At 200%, these require 1024px before page padding, so they already wrap at a 1000px viewport without the compact rules. At 100%, they can sit side by side. Reverting only the compact `.item` and `.settingControl` rules could therefore pass both proposed geometry assertions, including search results. Require an assertion distinguishing the compact layout, such as computed column direction and full-width controls in both branches, and independently revert those CSS rules to prove failure. The shared-scale revert checks orientation and grids but does not isolate this CSS regression. (confidence: 98)

VERDICT: REVISE```

Closures: I7 CLOSED (plan r4, tests r4) · I8 CLOSED (plan r4). I9 NOT CLOSED (plan r4 #1, tests r4
#1) — residual keeps ID I9 (first failed closure of this lineage).

| ID | Claim | Witnesses | Evidence (arbiter) | Disposition | Authority | Correction (r5) | Status |
|---|---|---|---|---|---|---|---|
| I9 (residual) | "Control below copy" does not distinguish O3's compact CSS from the row's ordinary flex wrap: copy basis 18rem + control minimum 12rem + gap 2rem = 32rem = 1024px at 200 %, so the row already wraps at 1000px without the compact rules; the shared-scale revert check does not isolate a CSS regression. | plan r4 #1 (blocker), tests r4 #1 (blocker) | Confirmed: `SettingsLayout.tsx:19-23` (`Group gap="xl"`, Mantine default `wrap`), `SettingsPage.module.css:35-43` (`flex: 1 1 18rem`, `min-width: min(100%, 12rem)`). | Fix | MANDATE "drive the CSS side from the same source" (O3) — verification only, no new mechanism. | O5: the oracle is the row's computed `flex-direction` (`column` at 200 %, `row` at 100 %) and the control wrapper's width equal to the row's content width, in a tab panel and in search results. Phase 2 proof 2 gains two isolated revert checks: (b) marker moved to the Tabs element → search-results assertion red; (c) compact `.item`/`.settingControl` rules removed → both branches red. | open → r5 |

Adopted plan-level corrections r4: 1 (I9 residual).

### Round 5 — r5 (closure round: review-plan + review-tests; elapsed 280 s wall; adopted 0)

Raw verdicts: plan APPROVED · tests APPROVED.

Raw findings (verbatim):

**lens-plan-r5:**

```text
I9 CLOSED — r5 O5 (`tasks/plans/.plan-2026-10-08-font-scaled-breakpoints.md-r5.body.md:166`) requires computed column direction and full-width controls in both branches. These distinguish compact CSS (`src/components/settings/SettingsPage.module.css:95`) from ordinary wrapping (`src/components/settings/SettingsLayout.tsx:19`). Phase 2:297 independently tests marker placement and removal of the compact rules, covering the search branch outside Tabs (`src/components/settings/SettingsPage.tsx:784`). No new defects found in the delta or affected obligations (confidence: 99).

Limitation: browser assertions and revert checks were reviewed against source, not executed in this read-only plan review (confidence: 100).

VERDICT: APPROVED```

**lens-tests-r5:**

```text
I9 CLOSED — O5 now asserts computed `flex-direction: column` and full control-wrapper width in both Settings branches. Ordinary wrapping cannot satisfy the direction assertion. Phase 2 independently reverts marker placement and compact CSS, requiring the search-results assertion and both branches’ assertions to fail respectively.

VERDICT: APPROVED```

Closures: I9 CLOSED (plan r5, tests r5).

### Summary

Five completed rounds; `plan_adopted_per_round` r1=4 r2=2 r3=3 r4=1 r5=0. Per-round wall elapsed
289 s, 285 s, 144 s, 183 s, 280 s (lens wall time, polling included; no quota, dependency or
release waits). Unique issues opened 9 (I1–I9), resolved 9, open 0; skipped 0, deferred 0,
carried 0. Withdrawn mechanism: O4 (`ui:boundary:check` source rules; issue I3). Correction-introduced
defect: I7 (lineage I4, the r3 revision of O2 deleted O3; restored in r4 byte-identical to r1).
I6 was a review-packet defect, not counted as a plan adoption. No rewrite, no split, no
non-convergence trigger (adoptions r3–r5 = 4 against r1–r2 = 6). Same-model disclosure: every lens
ran on Codex (OpenAI high tier); this planner session wrote the plan and arbitrated every
disposition. Out-of-area filing during Locate: inbox entry
`20261008-091923-1457949-1791443963092296318-6.md` (persisted font scale not range-checked).


### Round 6 — r6 (PLAN-REFRESH drift round, 12 supplied lenses, elapsed 180 s wall, adopted 0)

BASE `a990c06a66ca856dd59ba452b9105b0289e6c99e` → NEW-BASE `53a2a911994d023a8cd3cd1dc735045cfbaf47a9`.
The process-generated drift file is `drift-a990c06a66ca856dd59ba452b9105b0289e6c99e-53a2a911994d023a8cd3cd1dc735045cfbaf47a9.diff` under the supplied RUN_TMP.
It was verified byte-for-byte against `git diff a990c06a66ca856dd59ba452b9105b0289e6c99e..53a2a911994d023a8cd3cd1dc735045cfbaf47a9` before launch.
All prompts name both bases and this drift file. Review scope requires each finding to name
an altered path or symbol and the plan obligation it invalidates.

Entry revalidation: retained `build`. The mechanism for scale-aware theme, hook and CSS
coordination still requires the reviewed design. `d-20260831-16` establishes reflow and zoom
semantics but does not settle that mechanism. Newly appended `d-20261008-10` through
`d-20261008-17` concern engine termination and search-index identity, with no change to this
finding's design or proof contracts. The inherited Locate evidence remains applicable.

Lens set exactly as supplied by REFRESH-LENSES: chess-semantics, correctness, engine-protocol,
error-handling, ipc-contract, minimalism, persisted-state, pgn-index, plan, platform-semantics,
tauri-security, tests. Every lens ran through the shared read-only launcher. Executor: Codex.
`review-plan` used `--role review-plan`, the others `--role normal`, determined by the plan's
frontend paths rather than the drift's backend paths. All 12 raw verdicts were APPROVED.

Raw reports (verbatim):

**lens-chess-semantics-r6:**

```text
NOT APPLICABLE: O0–O5 change font-scaled breakpoints, responsive layout, and UI verification. They do not change in-memory chess trees, position identity, move paths, or chess-rule semantics.

VERDICT: APPROVED
```

**lens-correctness-r6:**

```text
No correctness drift invalidates O0–O3 or O5 between `a990c06a66ca856dd59ba452b9105b0289e6c99e` and `53a2a911994d023a8cd3cd1dc735045cfbaf47a9`.

`SearchIndexIdentity`, cache invalidation, and `EngineActor` termination changes leave the renderer contracts, mocked grid proof, and WebKitGTK probe interface intact.

Limitation: static dependency review only. Runtime verification was prohibited (confidence: 95).

VERDICT: APPROVED
```

**lens-engine-protocol-r6:**

```text
NOT APPLICABLE: O0–O5 concern renderer font scaling, responsive layouts, and UI verification. They change no engine identity, process ownership, UCI sequencing, or asynchronous result routing. Backend engine drift does not invalidate these obligations.

VERDICT: APPROVED
```

**lens-error-handling-r6:**

```text
No error-handling drift between BASE `a990c06a` and NEW-BASE `53a2a911` invalidates O0–O5. Renderer dependencies and the WebDriver harness are unchanged. Backend search-cache and engine-termination changes do not alter O2’s accepted fallback or O5’s layout probes.

VERDICT: APPROVED
```

**lens-ipc-contract-r6:**

```text
NOT APPLICABLE: O0–O5 concern renderer breakpoint scaling, layout state, and UI verification. The planned files and obligations introduce no Rust↔renderer events, commands, payloads, subscriptions, or capability changes.

VERDICT: APPROVED
```

**lens-minimalism-r6:**

```text
No drift invalidates O0–O3 or O5. BASE `a990c06a` → NEW-BASE `53a2a911` leaves the renderer, e2e fixtures, and app-driver harness unchanged. The backend and Rust gate changes introduce no duplicate breakpoint mechanism or additional abstraction required by this plan.

VERDICT: APPROVED
```

**lens-persisted-state-r6:**

```text
No persisted-state drift findings in `a990c06a..53a2a911`. The `font-size` writer and reader still agree on JSON encoding. Renderer storage, hydration, tab lifecycle and verification harnesses are unchanged. No drift invalidates O1, O2 or O5 within this lens.

Static review only. No writes or gates run.

VERDICT: APPROVED
```

**lens-pgn-index-r6:**

```text
NOT APPLICABLE: The plan’s files and O0–O5 obligations concern renderer font scaling, responsive layouts, and UI verification. They do not scan, index, encode, store, or search PGN bytes. Backend drift alone does not bring those changes within this plan’s scope.

VERDICT: APPROVED
```

**lens-plan-r6:**

```text
No drift between BASE `a990c06a66ca856dd59ba452b9105b0289e6c99e` and NEW-BASE `53a2a911994d023a8cd3cd1dc735045cfbaf47a9` invalidates O0–O3 or O5. The backend search, engine supervision and Rust checker changes leave renderer contracts, mocked e2e wiring and the real-app harness intact. No changed premise reopens I1–I9.

Limitation: gates, browser assertions and the WebKitGTK probe were inspected against source, not executed in this read-only review (confidence: 100).

VERDICT: APPROVED
```

**lens-platform-semantics-r6:**

```text
No platform drift finding from `a990c06a` to `53a2a911` invalidates O0–O3 or O5. Renderer breakpoints, UI fixtures and the WebKitGTK harness are unchanged. The search and engine changes introduce no identified dependency failure for the planned Settings probe.

No gates or platform probes ran in this read-only review. Approval concerns plan compatibility with the drift, not Windows or macOS runtime verification.

VERDICT: APPROVED
```

**lens-tauri-security-r6:**

```text
NOT APPLICABLE: The plan’s files and O0–O5 obligations concern renderer breakpoint scaling and UI verification under font-slider and viewport input. They introduce no credential, filesystem-authority, signed-download, or backend-data security flow for this lens to assess.

VERDICT: APPROVED
```

**lens-tests-r6:**

```text
No drift invalidates O5. Backend search-cache and engine-supervision changes leave the mocked grid fixture, Playwright selectors and real-webview harness intact. Planned orientation, pane-position and computed-style assertions still distinguish the fix from its isolated reverts.

Limitation: this reviews proposed proof only. Tests and revert probes were not run (confidence: 100).

VERDICT: APPROVED
```

Arbitration: no findings, no dispositions added, no changed premise reopens I1–I9. The five
NOT APPLICABLE exits (chess-semantics, engine-protocol, ipc-contract, pgn-index, tauri-security) were checked against the plan. Platform-semantics and
persisted-state assessed relevant indirect dependencies and approved. None claims runtime
proof. No source, browser, server, build-lock, ledger or release mutation occurred.

The drift changes backend search-index identity, engine termination and Rust guard tooling.
`git diff` restricted to the metadata's planned paths is empty. Root inspection also confirms
that the theme factory, App font-scale memo, both fixed JS queries, Settings CSS and e2e
fixtures remain as traced. The approved r5 plan body and the r6 launch body are identical.
The plan therefore stands at NEW-BASE, with every implementation and verification obligation
preserved. No new autonomous decision, new filing, withdrawn mechanism or split.

Six completed rounds. Cumulative adoptions: `r1=4 r2=2 r3=3 r4=1 r5=0 r6=0`.
Per-round elapsed: 289, 285, 144, 183, 280, 180 seconds. Total measured review wall: 1361 seconds.
R6 elapsed includes launch and polling until the final report was inspected. No known quota,
dependency or release wait. Active review time distinct from ordinary polling is unknown.
Unique issues remain 9 opened, 9 resolved, 0 open. No downstream implementation or final-diff
rework has occurred in this planner lane. The original out-of-area Locate filing is retained.

Plan authorship and arbitration shared one context in the original plan run. This refresh
context owns its arbitration. Detection ran on Codex, the same model family as the planned
code executor. No model-family independence is claimed. This is plan compatibility evidence,
not implemented layout or runtime evidence. Stop before Preflight under PLAN-REFRESH.


## Evidence

### Manifest

[
  {
    "artefact": "lens-chess-semantics-r1.jsonl",
    "findings": [],
    "lens": "chess-semantics",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-chess-semantics-r1.prompt",
    "report": "lens-chess-semantics-r1.txt",
    "round": 1,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-correctness-r1.jsonl",
    "findings": [],
    "lens": "correctness",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-correctness-r1.prompt",
    "report": "lens-correctness-r1.txt",
    "round": 1,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-engine-protocol-r1.jsonl",
    "findings": [],
    "lens": "engine-protocol",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-engine-protocol-r1.prompt",
    "report": "lens-engine-protocol-r1.txt",
    "round": 1,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-error-handling-r1.jsonl",
    "findings": [
      {
        "kind": "should-fix",
        "text": "tasks/plans/2026-10-08-font-scaled-breakpoints.md:119 — O2 leaves subscription-failure semantics unspecified. Mantine catches media-query setup failures silently, returning false initially or retaining the previous result after a query change. O3 would then apply wide or stale Settings styles without any diagnostic. State whether this fallback is intentional and how failure should surface. (confidence: 94)"
      }
    ],
    "lens": "error-handling",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-error-handling-r1.prompt",
    "report": "lens-error-handling-r1.txt",
    "round": 1,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-error-handling-r2.jsonl",
    "findings": [
      {
        "kind": "should-fix",
        "text": "I4 NOT CLOSED — O2 specifies a fallback that Mantine does not guarantee."
      },
      {
        "kind": "should-fix",
        "text": "tasks/plans/.plan-2026-10-08-font-scaled-breakpoints.md-r2.body.md:128 — Mantine’s catch does not reset `matches` to `false`. If a live font-scale change causes `matchMedia` to throw, the hook retains its previous boolean. If listener attachment fails, it retains the newly sampled boolean but stops tracking viewport changes. Settings’ orientation/CSS and Files’ fullscreen state can therefore remain compact or become stale, without diagnostics. The cited Mantine source establishes these outcomes directly. Specify whether retaining that silent degradation is intentional, or require the stated wide-layout fallback (confidence: 99)."
      }
    ],
    "lens": "error-handling",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-error-handling-r2.prompt",
    "report": "lens-error-handling-r2.txt",
    "round": 2,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-error-handling-r3.jsonl",
    "findings": [],
    "lens": "error-handling",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-error-handling-r3.prompt",
    "report": "lens-error-handling-r3.txt",
    "round": 3,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-ipc-contract-r1.jsonl",
    "findings": [],
    "lens": "ipc-contract",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-ipc-contract-r1.prompt",
    "report": "lens-ipc-contract-r1.txt",
    "round": 1,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-minimalism-r1.jsonl",
    "findings": [
      {
        "kind": "should-fix",
        "text": "tasks/plans/2026-10-08-font-scaled-breakpoints.md:133 — O4 adds two renderer-wide source restrictions without identifying a mandate obligation that O1–O3 and O5 cannot satisfy. Its blanket `useMediaQuery` import ban also covers unrelated features such as `prefers-reduced-motion`. The shared push-review policy’s “Proof selection before custom source verification” requires an uncovered obligation and an explanation of why behavioral checks cannot prove it, even when extending an existing checker. The smallest sufficient plan retains the shared scaling function, two-caller hook, Settings marker and behavioral proofs, while removing O4 and all changes to the two boundary-checker files. This preserves mandate coverage and removes an entire tooling obligation (confidence: 95)."
      }
    ],
    "lens": "minimalism",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-minimalism-r1.prompt",
    "report": "lens-minimalism-r1.txt",
    "round": 1,
    "terminal": "completed",
    "verdict": "REVISE"
  },
  {
    "artefact": "lens-minimalism-r2.jsonl",
    "findings": [],
    "lens": "minimalism",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-minimalism-r2.prompt",
    "report": "lens-minimalism-r2.txt",
    "round": 2,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-persisted-state-r1.jsonl",
    "findings": [],
    "lens": "persisted-state",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-persisted-state-r1.prompt",
    "report": "lens-persisted-state-r1.txt",
    "round": 1,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-pgn-index-r1.jsonl",
    "findings": [],
    "lens": "pgn-index",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-pgn-index-r1.prompt",
    "report": "lens-pgn-index-r1.txt",
    "round": 1,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-plan-r1.jsonl",
    "findings": [
      {
        "kind": "blocker",
        "text": "tasks/plans/2026-10-08-font-scaled-breakpoints.md:144 — O5 does not prove that changing the font scale updates the mounted App’s theme. The proposed App test checks only initial arguments (`src/App.test.tsx:560`), and the e2e cases seed each scale before startup. A theme cached at the initial scale could pass these proofs while grids remain unchanged after a slider adjustment. This integration matters because the current theme memo excludes font size (`src/App.tsx:214`). Require a mounted-app scale change that verifies the grid switches without reloading. (confidence: 97)"
      },
      {
        "kind": "blocker",
        "text": "tasks/plans/2026-10-08-font-scaled-breakpoints.md:169 — The promised WebKitGTK proof cannot run as written. `pnpm verify:app` invokes `scripts/verify-app.mjs` (`package.json:78`), whose only parsed option is `--screenshot` (`scripts/verify-app.mjs:433`). It contains no font-scale, Settings orientation, or window-resizing check and starts the compositor with default dimensions (`scripts/verify-app.mjs:1064`, `scripts/app-driver.mjs:168`). Neither phase includes changes to that verifier. Specify an executable real-app probe or include the necessary verifier extension so this command can actually reject incorrect breakpoint behavior. (confidence: 100)"
      }
    ],
    "lens": "plan",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-plan-r1.prompt",
    "report": "lens-plan-r1.txt",
    "round": 1,
    "terminal": "completed",
    "verdict": "REVISE"
  },
  {
    "artefact": "lens-plan-r2.jsonl",
    "findings": [
      {
        "kind": "should-fix",
        "text": "tasks/plans/.plan-2026-10-08-font-scaled-breakpoints.md-r2.body.md:128 — I4 NOT CLOSED. Mantine does not always report initial `false` after setup failure. Its catch leaves state unchanged after a query change, and listener registration happens after `setMatches(mediaQuery.matches)`. Evidence: `/home/felixb/Projekte/chessfable/node_modules/@mantine/hooks/esm/use-media-query/use-media-query.mjs:4,25`. State the actual retained-result behavior and whether that degradation is intentional (confidence: 100)."
      },
      {
        "kind": "blocker",
        "text": "tasks/plans/.plan-2026-10-08-font-scaled-breakpoints.md-r2.body.md:257 — Phase 1 omits `src/components/files/FilesPage.test.tsx`. Its atom mock exposes no `fontSizeAtom` (`:25,51`), its Jotai mock exposes only `useAtom` (`:45`), and it renders the real FilesPage (`:313`). O2 introduces an atom-reading hook into that render path, so the required Vitest proof cannot pass with these mocks unchanged. Add this test file and its mock updates to the phase’s write set (confidence: 99)."
      },
      {
        "kind": "should-fix",
        "text": "tasks/plans/2026-10-08-font-scaled-breakpoints.md:287 — The supplied `Full record:` lookup path is empty, despite the required history field in `/home/felixb/.claude/references/review-lens-contract.md:137`. The complete record was accessible through the full-plan path named in DELTA. Include that path explicitly in subsequent review packets (confidence: 100)."
      }
    ],
    "lens": "plan",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-plan-r2.prompt",
    "report": "lens-plan-r2.txt",
    "round": 2,
    "terminal": "completed",
    "verdict": "REVISE"
  },
  {
    "artefact": "lens-plan-r3.jsonl",
    "findings": [
      {
        "kind": "blocker",
        "text": "tasks/plans/.plan-2026-10-08-font-scaled-breakpoints.md-r3.body.md:262 — Phase 1 requires O3, but the r3 delta deletes that obligation entirely. Its contract required replacing the fixed CSS query while preserving every compact rule and covering both Tabs and search results. Those consumers remain at `src/components/settings/SettingsPage.module.css:69–104` and `src/components/settings/SettingsPage.tsx:731,784`. Restore O3 so the mandate’s shared JS/CSS condition remains an explicit obligation (confidence: 100)."
      },
      {
        "kind": "blocker",
        "text": "tasks/plans/.plan-2026-10-08-font-scaled-breakpoints.md-r3.body.md:254 — Phase 1 omits another affected consumer, `src/components/home/StartupStorageFailure.test.tsx`. O1 adds the required font-scale argument to StartupStorageFailure’s theme call, but this test asserts the exact old argument object at `src/components/home/StartupStorageFailure.test.tsx:130–133`. That assertion will fail, and the narrow Vitest command at plan:265 excludes the home directory. Add this file, update its expectation, and include it in the proof (confidence: 100)."
      }
    ],
    "lens": "plan",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-plan-r3.prompt",
    "report": "lens-plan-r3.txt",
    "round": 3,
    "terminal": "completed",
    "verdict": "REVISE"
  },
  {
    "artefact": "lens-plan-r4.jsonl",
    "findings": [
      {
        "kind": "blocker",
        "text": "tasks/plans/.plan-2026-10-08-font-scaled-breakpoints.md-r4.body.md:166 — I9 NOT CLOSED. Below-copy geometry does not prove compact CSS applies. `SettingsLayout.tsx:19` uses a Group whose default is wrapping (`/home/felixb/Projekte/chessfable/node_modules/@mantine/core/esm/components/Group/Group.mjs:27`). The existing copy basis, control minimum and gap (`SettingsPage.module.css:35`, `SettingsPage.module.css:40`, `SettingsLayout.tsx:21`) total 32rem, or 1024px at 200%. They already force wrapping inside a 1000px viewport without the compact rules. Consequently, a marker incorrectly restricted to Tabs can still pass the new search-results geometry comparison. Require an assertion that distinguishes compact CSS from ordinary wrapping in both branches, such as computed column direction or full-width controls (confidence: 96)."
      }
    ],
    "lens": "plan",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-plan-r4.prompt",
    "report": "lens-plan-r4.txt",
    "round": 4,
    "terminal": "completed",
    "verdict": "REVISE"
  },
  {
    "artefact": "lens-plan-r5.jsonl",
    "findings": [],
    "lens": "plan",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-plan-r5.prompt",
    "report": "lens-plan-r5.txt",
    "round": 5,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-platform-semantics-r1.jsonl",
    "findings": [],
    "lens": "platform-semantics",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-platform-semantics-r1.prompt",
    "report": "lens-platform-semantics-r1.txt",
    "round": 1,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-tauri-security-r1.jsonl",
    "findings": [],
    "lens": "tauri-security",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-tauri-security-r1.prompt",
    "report": "lens-tauri-security-r1.txt",
    "round": 1,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-tests-r1.jsonl",
    "findings": [
      {
        "kind": "should-fix",
        "text": "tasks/plans/2026-10-08-font-scaled-breakpoints.md:147 — No proposed assertion exercises App’s theme update after changing font scale without remounting. Omitting `fontSize` from the theme memo dependencies would pass the factory tests, initial App argument assertion, isolated hook test and startup-seeded e2e cases. Add a live scale-change test that asserts the grid changes columns. (confidence: 98)"
      },
      {
        "kind": "should-fix",
        "text": "tasks/plans/2026-10-08-font-scaled-breakpoints.md:169 — The named `pnpm verify:app` command runs `scripts/verify-app.mjs`, which neither seeds 200% font scale nor asserts Settings’ orientation. No phase adds that check or names a runnable custom probe. The claimed WebKitGTK proof would therefore miss fixed breakpoints. Specify the probe and its failing-on-revert orientation assertion. (confidence: 99)"
      }
    ],
    "lens": "tests",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-tests-r1.prompt",
    "report": "lens-tests-r1.txt",
    "round": 1,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-tests-r2.jsonl",
    "findings": [],
    "lens": "tests",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-tests-r2.prompt",
    "report": "lens-tests-r2.txt",
    "round": 2,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-tests-r3.jsonl",
    "findings": [
      {
        "kind": "blocker",
        "text": "tasks/plans/.plan-2026-10-08-font-scaled-breakpoints.md-r3.body.md:155 — R3 deletes O3, while the remaining Settings proof asserts tab orientation, marker presence and clipping, without asserting compact CSS reflow or exercising search results. Restricting the compact styles to the Tabs subtree would leave search-result rows unscaled and pass the named proofs, which never render that branch. Restore the CSS obligation and name a browser assertion that checks compact row geometry in search results at 1000px/200%, with the 100% comparison. (confidence: 96)"
      }
    ],
    "lens": "tests",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-tests-r3.prompt",
    "report": "lens-tests-r3.txt",
    "round": 3,
    "terminal": "completed",
    "verdict": "REVISE"
  },
  {
    "artefact": "lens-tests-r4.jsonl",
    "findings": [
      {
        "kind": "blocker",
        "text": "tasks/plans/.plan-2026-10-08-font-scaled-breakpoints.md-r4.body.md:166 — I9 NOT CLOSED. “Control below copy” does not distinguish compact CSS from existing flex wrapping. `SettingRow` uses Mantine Group’s default `wrap: \"wrap\"`. The unchanged CSS gives copy an 18rem basis and controls a 12rem minimum, with a 2rem gap. At 200%, these require 1024px before page padding, so they already wrap at a 1000px viewport without the compact rules. At 100%, they can sit side by side. Reverting only the compact `.item` and `.settingControl` rules could therefore pass both proposed geometry assertions, including search results. Require an assertion distinguishing the compact layout, such as computed column direction and full-width controls in both branches, and independently revert those CSS rules to prove failure. The shared-scale revert checks orientation and grids but does not isolate this CSS regression. (confidence: 98)"
      }
    ],
    "lens": "tests",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-tests-r4.prompt",
    "report": "lens-tests-r4.txt",
    "round": 4,
    "terminal": "completed",
    "verdict": "REVISE"
  },
  {
    "artefact": "lens-tests-r5.jsonl",
    "findings": [],
    "lens": "tests",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-tests-r5.prompt",
    "report": "lens-tests-r5.txt",
    "round": 5,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-chess-semantics-r6.jsonl",
    "findings": [],
    "lens": "chess-semantics",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-chess-semantics-r6.prompt",
    "report": "lens-chess-semantics-r6.txt",
    "round": 6,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-correctness-r6.jsonl",
    "findings": [],
    "lens": "correctness",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-correctness-r6.prompt",
    "report": "lens-correctness-r6.txt",
    "round": 6,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-engine-protocol-r6.jsonl",
    "findings": [],
    "lens": "engine-protocol",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-engine-protocol-r6.prompt",
    "report": "lens-engine-protocol-r6.txt",
    "round": 6,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-error-handling-r6.jsonl",
    "findings": [],
    "lens": "error-handling",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-error-handling-r6.prompt",
    "report": "lens-error-handling-r6.txt",
    "round": 6,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-ipc-contract-r6.jsonl",
    "findings": [],
    "lens": "ipc-contract",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-ipc-contract-r6.prompt",
    "report": "lens-ipc-contract-r6.txt",
    "round": 6,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-minimalism-r6.jsonl",
    "findings": [],
    "lens": "minimalism",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-minimalism-r6.prompt",
    "report": "lens-minimalism-r6.txt",
    "round": 6,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-persisted-state-r6.jsonl",
    "findings": [],
    "lens": "persisted-state",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-persisted-state-r6.prompt",
    "report": "lens-persisted-state-r6.txt",
    "round": 6,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-pgn-index-r6.jsonl",
    "findings": [],
    "lens": "pgn-index",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-pgn-index-r6.prompt",
    "report": "lens-pgn-index-r6.txt",
    "round": 6,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-plan-r6.jsonl",
    "findings": [],
    "lens": "plan",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-plan-r6.prompt",
    "report": "lens-plan-r6.txt",
    "round": 6,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-platform-semantics-r6.jsonl",
    "findings": [],
    "lens": "platform-semantics",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-platform-semantics-r6.prompt",
    "report": "lens-platform-semantics-r6.txt",
    "round": 6,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-tauri-security-r6.jsonl",
    "findings": [],
    "lens": "tauri-security",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-tauri-security-r6.prompt",
    "report": "lens-tauri-security-r6.txt",
    "round": 6,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-tests-r6.jsonl",
    "findings": [],
    "lens": "tests",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-tests-r6.prompt",
    "report": "lens-tests-r6.txt",
    "round": 6,
    "terminal": "completed",
    "verdict": "APPROVED"
  }
]

### Issues

[
  {
    "claim": "No proof that a font-scale change updates the mounted App's theme and hook; every proposed proof seeds the scale before startup, and the App theme memo omits the font scale.",
    "closed_round": 2,
    "correction": "r2: O5 e2e adds a live change without reload: 100 % to 200 % through the Settings font-size slider (onChangeEnd); Settings tablist turns horizontal and, after in-app navigation, the grid panes are stacked.",
    "dependencies": [],
    "disposition": "Fix",
    "id": "I1",
    "witnesses": [
      {
        "index": 1,
        "lens": "plan",
        "round": 1
      },
      {
        "index": 1,
        "lens": "tests",
        "round": 1
      }
    ]
  },
  {
    "claim": "The promised WebKitGTK proof via pnpm verify:app cannot run as written: scripts/verify-app.mjs parses only --screenshot and checks no layout.",
    "closed_round": 2,
    "correction": "r2: O5's real-webview item is a one-off scratch probe (never committed) on scripts/app-driver.mjs exports: font-size 200 then 100, innerWidth in [801, 1599], tablist aria-orientation horizontal/vertical; fails on revert.",
    "dependencies": [],
    "disposition": "Fix",
    "id": "I2",
    "witnesses": [
      {
        "index": 2,
        "lens": "plan",
        "round": 1
      },
      {
        "index": 2,
        "lens": "tests",
        "round": 1
      }
    ]
  },
  {
    "claim": "O4's ui:boundary:check source rules serve no MANDATE obligation the behavioural proofs cannot prove (push-review-policy 'Proof selection before custom source verification'); the useMediaQuery import ban is overbroad.",
    "closed_round": 2,
    "correction": "r2: O4 withdrawn, D4 removed, scripts/check-ui-boundaries.mjs and its test dropped from Phase 1's files and proof.",
    "dependencies": [],
    "disposition": "Fix",
    "id": "I3",
    "witnesses": [
      {
        "index": 1,
        "lens": "minimalism",
        "round": 1
      }
    ]
  },
  {
    "claim": "O2 does not state the hook's subscription-failure semantics; residual in r2: the stated semantics were wrong (Mantine keeps the previous result after a query change and keeps an untracked sampled value when listener attachment fails).",
    "closed_round": 3,
    "correction": "r2: O2 'Failure semantics' paragraph added. r3: rewritten to Mantine's real behaviour (false before the effect; state left as it was on a matchMedia throw — false on mount, previous result after a query change; sampled value kept untracked on listener-attach failure), deliberately kept and undiagnosed as today's behaviour.",
    "dependencies": [],
    "disposition": "Fix",
    "id": "I4",
    "witnesses": [
      {
        "index": 1,
        "lens": "error-handling",
        "round": 1
      },
      {
        "index": 1,
        "lens": "plan",
        "round": 2
      },
      {
        "index": 1,
        "lens": "error-handling",
        "round": 2
      },
      {
        "index": 2,
        "lens": "error-handling",
        "round": 2
      }
    ]
  },
  {
    "claim": "Phase 1's write set omits src/components/files/FilesPage.test.tsx, whose jotai mock exposes only useAtom and whose @/state/atoms mock has no fontSizeAtom, so the vitest proof cannot pass once FilesPage calls the hook.",
    "closed_round": 3,
    "correction": "r3: Phase 1 file list names FilesPage.test.tsx with the obligation that its jotai and atoms mocks expose what O2's hook reads.",
    "dependencies": [],
    "disposition": "Fix",
    "id": "I5",
    "witnesses": [
      {
        "index": 2,
        "lens": "plan",
        "round": 2
      }
    ]
  },
  {
    "claim": "The r2 review packet's full-record lookup path was empty.",
    "closed_round": 3,
    "correction": "r3: packets carry the full-record path explicitly (the r2 sed used '#' as delimiter and cut '## Reviews in <path>'); review-packet correction, no plan change.",
    "dependencies": [],
    "disposition": "Fix",
    "id": "I6",
    "witnesses": [
      {
        "index": 3,
        "lens": "plan",
        "round": 2
      }
    ]
  },
  {
    "claim": "The r3 revision deleted O3 (Settings CSS driven by the same boolean) entirely; correction-introduced by the I4 rewrite (lineage I4).",
    "closed_round": 4,
    "correction": "r4: O3 restored byte-identical to r1 (empty diff of the O3 section against plan-r1.md).",
    "dependencies": [
      "I4"
    ],
    "disposition": "Fix",
    "id": "I7",
    "witnesses": [
      {
        "index": 1,
        "lens": "plan",
        "round": 3
      },
      {
        "index": 1,
        "lens": "tests",
        "round": 3
      }
    ]
  },
  {
    "claim": "Phase 1 omits src/components/home/StartupStorageFailure.test.tsx, which asserts the exact old createAppTheme argument; the vitest proof excluded src/components/home.",
    "closed_round": 4,
    "correction": "r4: Phase 1 file list adds the file; proof 1's vitest command includes it; all four createAppTheme test callers are listed.",
    "dependencies": [],
    "disposition": "Fix",
    "id": "I8",
    "witnesses": [
      {
        "index": 2,
        "lens": "plan",
        "round": 3
      }
    ]
  },
  {
    "claim": "No proof exercises O3's compact CSS or the search-results branch; residual in r4: 'control below copy' geometry cannot distinguish compact CSS from the row's ordinary flex wrap (18rem + 12rem + 2rem = 1024px at 200 %).",
    "closed_round": 5,
    "correction": "r4: O5 e2e asserts compact rows in a tab panel and in search results at 1000px/200 % against 100 %. r5: the oracle is the row's computed flex-direction (column/row) and the control wrapper's full width; Phase 2 proof 2 adds isolated revert checks (marker moved onto the Tabs only; compact .item/.settingControl rules removed).",
    "dependencies": [
      "I7"
    ],
    "disposition": "Fix",
    "id": "I9",
    "witnesses": [
      {
        "index": 1,
        "lens": "tests",
        "round": 3
      },
      {
        "index": 1,
        "lens": "plan",
        "round": 4
      },
      {
        "index": 1,
        "lens": "tests",
        "round": 4
      }
    ]
  }
]

### lens-chess-semantics-r1.txt

NOT APPLICABLE: The listed files and obligations O0–O5 concern font-scaled layout breakpoints and UI verification. They do not change in-memory chess trees, positions, paths, move legality, or round-trip metadata.
VERDICT: APPROVED
### lens-chess-semantics-r6.txt

NOT APPLICABLE: O0–O5 change font-scaled breakpoints, responsive layout, and UI verification. They do not change in-memory chess trees, position identity, move paths, or chess-rule semantics.

VERDICT: APPROVED
### lens-correctness-r1.txt

No correctness defects found in O0–O5. At 1000px/200%, Settings’ threshold becomes 1600px and the grid’s `sm` threshold becomes 1536px, producing horizontal tabs and stacked panes. At 100%, both retain their existing layout.

Limitation: implementation and browser behavior remain unverified in this plan-only review (confidence: 100).

VERDICT: APPROVED
### lens-correctness-r6.txt

No correctness drift invalidates O0–O3 or O5 between `a990c06a66ca856dd59ba452b9105b0289e6c99e` and `53a2a911994d023a8cd3cd1dc735045cfbaf47a9`.

`SearchIndexIdentity`, cache invalidation, and `EngineActor` termination changes leave the renderer contracts, mocked grid proof, and WebKitGTK probe interface intact.

Limitation: static dependency review only. Runtime verification was prohibited (confidence: 95).

VERDICT: APPROVED
### lens-engine-protocol-r1.txt

NOT APPLICABLE: O0–O5 and the listed files concern scaled responsive layouts and UI verification. They do not change engine supervision, UCI protocol state, process identity, or asynchronous engine result routing.
VERDICT: APPROVED
### lens-engine-protocol-r6.txt

NOT APPLICABLE: O0–O5 concern renderer font scaling, responsive layouts, and UI verification. They change no engine identity, process ownership, UCI sequencing, or asynchronous result routing. Backend engine drift does not invalidate these obligations.

VERDICT: APPROVED
### lens-error-handling-r1.txt

[should-fix] tasks/plans/2026-10-08-font-scaled-breakpoints.md:119 — O2 leaves subscription-failure semantics unspecified. Mantine catches media-query setup failures silently, returning false initially or retaining the previous result after a query change. O3 would then apply wide or stale Settings styles without any diagnostic. State whether this fallback is intentional and how failure should surface. (confidence: 94)

VERDICT: APPROVED
### lens-error-handling-r2.txt

[should-fix] I4 NOT CLOSED — O2 specifies a fallback that Mantine does not guarantee.

[should-fix] tasks/plans/.plan-2026-10-08-font-scaled-breakpoints.md-r2.body.md:128 — Mantine’s catch does not reset `matches` to `false`. If a live font-scale change causes `matchMedia` to throw, the hook retains its previous boolean. If listener attachment fails, it retains the newly sampled boolean but stops tracking viewport changes. Settings’ orientation/CSS and Files’ fullscreen state can therefore remain compact or become stale, without diagnostics. The cited Mantine source establishes these outcomes directly. Specify whether retaining that silent degradation is intentional, or require the stated wide-layout fallback (confidence: 99).

VERDICT: APPROVED
### lens-error-handling-r3.txt

I4 CLOSED — O2 now matches Mantine’s source: `matchMedia` failure retains false on mount or the previous result after a query change. Failed listener attachment retains the sampled value without resize tracking. The plan explicitly accepts this undiagnosed degradation (confidence: 99).

VERDICT: APPROVED
### lens-error-handling-r6.txt

No error-handling drift between BASE `a990c06a` and NEW-BASE `53a2a911` invalidates O0–O5. Renderer dependencies and the WebDriver harness are unchanged. Backend search-cache and engine-termination changes do not alter O2’s accepted fallback or O5’s layout probes.

VERDICT: APPROVED
### lens-ipc-contract-r1.txt

NOT APPLICABLE: The listed files and obligations O0–O5 cover renderer layout, media queries, and UI verification. They introduce or change no Rust↔renderer commands, events, payloads, subscriptions, or capability scopes.
VERDICT: APPROVED
### lens-ipc-contract-r6.txt

NOT APPLICABLE: O0–O5 concern renderer breakpoint scaling, layout state, and UI verification. The planned files and obligations introduce no Rust↔renderer events, commands, payloads, subscriptions, or capability changes.

VERDICT: APPROVED
### lens-minimalism-r1.txt

[should-fix] tasks/plans/2026-10-08-font-scaled-breakpoints.md:133 — O4 adds two renderer-wide source restrictions without identifying a mandate obligation that O1–O3 and O5 cannot satisfy. Its blanket `useMediaQuery` import ban also covers unrelated features such as `prefers-reduced-motion`. The shared push-review policy’s “Proof selection before custom source verification” requires an uncovered obligation and an explanation of why behavioral checks cannot prove it, even when extending an existing checker. The smallest sufficient plan retains the shared scaling function, two-caller hook, Settings marker and behavioral proofs, while removing O4 and all changes to the two boundary-checker files. This preserves mandate coverage and removes an entire tooling obligation (confidence: 95).

VERDICT: REVISE
### lens-minimalism-r2.txt

I3 CLOSED — r2 withdraws O4, removes D4, and drops both checker files from Phase 1. The remaining shared hook serves two existing callers. No new bloat or duplication findings in the revised obligations.

VERDICT: APPROVED
### lens-minimalism-r6.txt

No drift invalidates O0–O3 or O5. BASE `a990c06a` → NEW-BASE `53a2a911` leaves the renderer, e2e fixtures, and app-driver harness unchanged. The backend and Rust gate changes introduce no duplicate breakpoint mechanism or additional abstraction required by this plan.

VERDICT: APPROVED
### lens-persisted-state-r1.txt

NOT APPLICABLE: O0–O5 change responsive layout calculations and verification. They consume the existing font-size atom without changing storage encoding, keys, hydration, scope, or tab lifecycle.

VERDICT: APPROVED
### lens-persisted-state-r6.txt

No persisted-state drift findings in `a990c06a..53a2a911`. The `font-size` writer and reader still agree on JSON encoding. Renderer storage, hydration, tab lifecycle and verification harnesses are unchanged. No drift invalidates O1, O2 or O5 within this lens.

Static review only. No writes or gates run.

VERDICT: APPROVED
### lens-pgn-index-r1.txt

NOT APPLICABLE: The listed files and obligations O0–O5 concern font-scaled responsive layouts and UI verification. They do not change PGN scanning, byte offsets, move encoding, database storage or search.
VERDICT: APPROVED
### lens-pgn-index-r6.txt

NOT APPLICABLE: The plan’s files and O0–O5 obligations concern renderer font scaling, responsive layouts, and UI verification. They do not scan, index, encode, store, or search PGN bytes. Backend drift alone does not bring those changes within this plan’s scope.

VERDICT: APPROVED
### lens-plan-r1.txt

[blocker] tasks/plans/2026-10-08-font-scaled-breakpoints.md:144 — O5 does not prove that changing the font scale updates the mounted App’s theme. The proposed App test checks only initial arguments (`src/App.test.tsx:560`), and the e2e cases seed each scale before startup. A theme cached at the initial scale could pass these proofs while grids remain unchanged after a slider adjustment. This integration matters because the current theme memo excludes font size (`src/App.tsx:214`). Require a mounted-app scale change that verifies the grid switches without reloading. (confidence: 97)

[blocker] tasks/plans/2026-10-08-font-scaled-breakpoints.md:169 — The promised WebKitGTK proof cannot run as written. `pnpm verify:app` invokes `scripts/verify-app.mjs` (`package.json:78`), whose only parsed option is `--screenshot` (`scripts/verify-app.mjs:433`). It contains no font-scale, Settings orientation, or window-resizing check and starts the compositor with default dimensions (`scripts/verify-app.mjs:1064`, `scripts/app-driver.mjs:168`). Neither phase includes changes to that verifier. Specify an executable real-app probe or include the necessary verifier extension so this command can actually reject incorrect breakpoint behavior. (confidence: 100)

VERDICT: REVISE
### lens-plan-r2.txt

I1 CLOSED — r2 O5:166 adds a slider-driven change without reload and checks Settings plus the grid. This exercises the missing dependency in `src/App.tsx:214` (confidence: 98).

I2 CLOSED — r2 O5:179 replaces the ineffective command with a scratch probe using the existing exports at `scripts/app-driver.mjs:168,250,291,304`, with discriminating viewport and orientation assertions (confidence: 95).

I3 CLOSED — r2 O4:141 withdraws the source restrictions, and Phase 1:257 removes the checker changes (confidence: 100).

[should-fix] tasks/plans/.plan-2026-10-08-font-scaled-breakpoints.md-r2.body.md:128 — I4 NOT CLOSED. Mantine does not always report initial `false` after setup failure. Its catch leaves state unchanged after a query change, and listener registration happens after `setMatches(mediaQuery.matches)`. Evidence: `/home/felixb/Projekte/chessfable/node_modules/@mantine/hooks/esm/use-media-query/use-media-query.mjs:4,25`. State the actual retained-result behavior and whether that degradation is intentional (confidence: 100).

[blocker] tasks/plans/.plan-2026-10-08-font-scaled-breakpoints.md-r2.body.md:257 — Phase 1 omits `src/components/files/FilesPage.test.tsx`. Its atom mock exposes no `fontSizeAtom` (`:25,51`), its Jotai mock exposes only `useAtom` (`:45`), and it renders the real FilesPage (`:313`). O2 introduces an atom-reading hook into that render path, so the required Vitest proof cannot pass with these mocks unchanged. Add this test file and its mock updates to the phase’s write set (confidence: 99).

[should-fix] tasks/plans/2026-10-08-font-scaled-breakpoints.md:287 — The supplied `Full record:` lookup path is empty, despite the required history field in `/home/felixb/.claude/references/review-lens-contract.md:137`. The complete record was accessible through the full-plan path named in DELTA. Include that path explicitly in subsequent review packets (confidence: 100).

VERDICT: REVISE
### lens-plan-r3.txt

I4 CLOSED — r3:125–136 correctly states Mantine’s retained-result behavior and intentionally preserves it. Confirmed in `/home/felixb/Projekte/chessfable/node_modules/@mantine/hooks/esm/use-media-query/use-media-query.mjs:22–34` (confidence: 100).

I5 CLOSED — r3:257–258 adds `FilesPage.test.tsx` and its mock updates, addressing the incomplete mocks at `src/components/files/FilesPage.test.tsx:25,45–51` (confidence: 100).

I6 CLOSED — this packet supplies the full-record path, whose Reviews section exists at `tasks/plans/2026-10-08-font-scaled-breakpoints.md:286` (confidence: 100).

[blocker] tasks/plans/.plan-2026-10-08-font-scaled-breakpoints.md-r3.body.md:262 — Phase 1 requires O3, but the r3 delta deletes that obligation entirely. Its contract required replacing the fixed CSS query while preserving every compact rule and covering both Tabs and search results. Those consumers remain at `src/components/settings/SettingsPage.module.css:69–104` and `src/components/settings/SettingsPage.tsx:731,784`. Restore O3 so the mandate’s shared JS/CSS condition remains an explicit obligation (confidence: 100).

[blocker] tasks/plans/.plan-2026-10-08-font-scaled-breakpoints.md-r3.body.md:254 — Phase 1 omits another affected consumer, `src/components/home/StartupStorageFailure.test.tsx`. O1 adds the required font-scale argument to StartupStorageFailure’s theme call, but this test asserts the exact old argument object at `src/components/home/StartupStorageFailure.test.tsx:130–133`. That assertion will fail, and the narrow Vitest command at plan:265 excludes the home directory. Add this file, update its expectation, and include it in the proof (confidence: 100).

VERDICT: REVISE
### lens-plan-r4.txt

I7 CLOSED — r4:138 restores O3, including preservation of every compact rule and coverage of both branches. Confirmed against `src/components/settings/SettingsPage.module.css:69` and `SettingsPage.tsx:761` (confidence: 100).

I8 CLOSED — r4:267 includes `StartupStorageFailure.test.tsx`, and r4:279 includes it in the proof command. This covers the exact-argument assertion at `src/components/home/StartupStorageFailure.test.tsx:130` (confidence: 100).

[blocker] tasks/plans/.plan-2026-10-08-font-scaled-breakpoints.md-r4.body.md:166 — I9 NOT CLOSED. Below-copy geometry does not prove compact CSS applies. `SettingsLayout.tsx:19` uses a Group whose default is wrapping (`/home/felixb/Projekte/chessfable/node_modules/@mantine/core/esm/components/Group/Group.mjs:27`). The existing copy basis, control minimum and gap (`SettingsPage.module.css:35`, `SettingsPage.module.css:40`, `SettingsLayout.tsx:21`) total 32rem, or 1024px at 200%. They already force wrapping inside a 1000px viewport without the compact rules. Consequently, a marker incorrectly restricted to Tabs can still pass the new search-results geometry comparison. Require an assertion that distinguishes compact CSS from ordinary wrapping in both branches, such as computed column direction or full-width controls (confidence: 96).

Limitation: browser geometry was not executed in this read-only review. The finding rests on the current CSS and Mantine source (confidence: 100).

VERDICT: REVISE
### lens-plan-r5.txt

I9 CLOSED — r5 O5 (`tasks/plans/.plan-2026-10-08-font-scaled-breakpoints.md-r5.body.md:166`) requires computed column direction and full-width controls in both branches. These distinguish compact CSS (`src/components/settings/SettingsPage.module.css:95`) from ordinary wrapping (`src/components/settings/SettingsLayout.tsx:19`). Phase 2:297 independently tests marker placement and removal of the compact rules, covering the search branch outside Tabs (`src/components/settings/SettingsPage.tsx:784`). No new defects found in the delta or affected obligations (confidence: 99).

Limitation: browser assertions and revert checks were reviewed against source, not executed in this read-only plan review (confidence: 100).

VERDICT: APPROVED
### lens-plan-r6.txt

No drift between BASE `a990c06a66ca856dd59ba452b9105b0289e6c99e` and NEW-BASE `53a2a911994d023a8cd3cd1dc735045cfbaf47a9` invalidates O0–O3 or O5. The backend search, engine supervision and Rust checker changes leave renderer contracts, mocked e2e wiring and the real-app harness intact. No changed premise reopens I1–I9.

Limitation: gates, browser assertions and the WebKitGTK probe were inspected against source, not executed in this read-only review (confidence: 100).

VERDICT: APPROVED
### lens-platform-semantics-r1.txt

NOT APPLICABLE: O0–O5 change renderer breakpoints and UI verification only. No OS-specific paths, handles, FFI, filesystem behavior or platform-gated helpers are involved.

VERDICT: APPROVED
### lens-platform-semantics-r6.txt

No platform drift finding from `a990c06a` to `53a2a911` invalidates O0–O3 or O5. Renderer breakpoints, UI fixtures and the WebKitGTK harness are unchanged. The search and engine changes introduce no identified dependency failure for the planned Settings probe.

No gates or platform probes ran in this read-only review. Approval concerns plan compatibility with the drift, not Windows or macOS runtime verification.

VERDICT: APPROVED
### lens-tauri-security-r1.txt

NOT APPLICABLE: The listed files and obligations O0–O5 concern renderer layout scaling and UI verification. They introduce no credential/session flow, native filesystem mutation, signed-download verification, or backend data exposure.

VERDICT: APPROVED
### lens-tauri-security-r6.txt

NOT APPLICABLE: The plan’s files and O0–O5 obligations concern renderer breakpoint scaling and UI verification under font-slider and viewport input. They introduce no credential, filesystem-authority, signed-download, or backend-data security flow for this lens to assess.

VERDICT: APPROVED
### lens-tests-r1.txt

[should-fix] tasks/plans/2026-10-08-font-scaled-breakpoints.md:147 — No proposed assertion exercises App’s theme update after changing font scale without remounting. Omitting `fontSize` from the theme memo dependencies would pass the factory tests, initial App argument assertion, isolated hook test and startup-seeded e2e cases. Add a live scale-change test that asserts the grid changes columns. (confidence: 98)

[should-fix] tasks/plans/2026-10-08-font-scaled-breakpoints.md:169 — The named `pnpm verify:app` command runs `scripts/verify-app.mjs`, which neither seeds 200% font scale nor asserts Settings’ orientation. No phase adds that check or names a runnable custom probe. The claimed WebKitGTK proof would therefore miss fixed breakpoints. Specify the probe and its failing-on-revert orientation assertion. (confidence: 99)

VERDICT: APPROVED
### lens-tests-r2.txt

I1 CLOSED — O5’s slider-driven, no-reload test would fail on the grid-stacking assertion if App’s theme memo omitted the font-scale dependency.
I2 CLOSED — O5 now uses the exported WebDriver harness with a discriminating viewport range. Reverting the scaled Settings query would fail the 200% horizontal-orientation assertion.
VERDICT: APPROVED
### lens-tests-r3.txt

[blocker] tasks/plans/.plan-2026-10-08-font-scaled-breakpoints.md-r3.body.md:155 — R3 deletes O3, while the remaining Settings proof asserts tab orientation, marker presence and clipping, without asserting compact CSS reflow or exercising search results. Restricting the compact styles to the Tabs subtree would leave search-result rows unscaled and pass the named proofs, which never render that branch. Restore the CSS obligation and name a browser assertion that checks compact row geometry in search results at 1000px/200%, with the 100% comparison. (confidence: 96)

VERDICT: REVISE
### lens-tests-r4.txt

I7 CLOSED — O3 again requires the shared compact condition on the outer Settings root, covering Tabs and search results.

[blocker] tasks/plans/.plan-2026-10-08-font-scaled-breakpoints.md-r4.body.md:166 — I9 NOT CLOSED. “Control below copy” does not distinguish compact CSS from existing flex wrapping. `SettingRow` uses Mantine Group’s default `wrap: "wrap"`. The unchanged CSS gives copy an 18rem basis and controls a 12rem minimum, with a 2rem gap. At 200%, these require 1024px before page padding, so they already wrap at a 1000px viewport without the compact rules. At 100%, they can sit side by side. Reverting only the compact `.item` and `.settingControl` rules could therefore pass both proposed geometry assertions, including search results. Require an assertion distinguishing the compact layout, such as computed column direction and full-width controls in both branches, and independently revert those CSS rules to prove failure. The shared-scale revert checks orientation and grids but does not isolate this CSS regression. (confidence: 98)

VERDICT: REVISE
### lens-tests-r5.txt

I9 CLOSED — O5 now asserts computed `flex-direction: column` and full control-wrapper width in both Settings branches. Ordinary wrapping cannot satisfy the direction assertion. Phase 2 independently reverts marker placement and compact CSS, requiring the search-results assertion and both branches’ assertions to fail respectively.

VERDICT: APPROVED
### lens-tests-r6.txt

No drift invalidates O5. Backend search-cache and engine-supervision changes leave the mocked grid fixture, Playwright selectors and real-webview harness intact. Planned orientation, pane-position and computed-style assertions still distinguish the fix from its isolated reverts.

Limitation: this reviews proposed proof only. Tests and revert probes were not run (confidence: 100).

VERDICT: APPROVED
### plan-r1.md

# Plan: responsive breakpoints follow the app font scale (f-20260927-08)

## Goal

Every width-dependent layout switch in the renderer flips at the same width *in scaled root-em*
at every app font scale, so the layout at window width W and font scale s is the layout the app
shows at W/s and 100 %. At 100 % nothing changes, by construction.

## MANDATE

Verbatim from `tasks/findings.md`, f-20260927-08:

> * **Where:** `src/components/settings/SettingsPage.tsx:126` (`useMediaQuery("(max-width: 50rem)")`), `src/components/settings/SettingsPage.module.css:60` (`@media (max-width: 50rem)`), and the Mantine `SimpleGrid cols` breakpoints at `src/components/files/FilesPage.tsx:217`, `src/components/databases/DatabasesPage.tsx:185,254`, `src/components/engines/EnginesPage.tsx:133`, `src/components/tabs/NewTabHome.tsx:241`, `src/components/engines/AddEngine.tsx:90,115`, `src/components/databases/AddDatabase.tsx:156`.
> * **Defect:** `App.tsx:209` scales the root font (`document.documentElement.style.fontSize = fontSize%`), but `rem`/`em` inside a media query resolve against the initial 16px, never the scaled root. So every breakpoint means the same pixel width at every app font scale: at 200% a 1000px window is only 31 root-em wide, yet Settings stays in its two-column layout (threshold 800px) and the grids stay multi-column, into widths the scaled content cannot fit.
> * **Evidence:** root cause 2 of `f-20260829-02` (its 2026-08-31 investigation). That run's 320px matrix never exercises it, because at 320px every breakpoint is already in its narrowest state; the f-20260829-02 plan review (2026-09-27, issue I3, lenses review-plan and review-root-cause) ruled a scale-aware breakpoint outside that finding's mandate because it changes behaviour only at other widths.
> * **Fix:** make the compact/column switch follow the effective width in scaled root-em — e.g. derive the query from `fontSizeAtom` (Mantine `useMediaQuery` re-subscribes when its query string changes, measured in `node_modules/@mantine/hooks/esm/.../use-media-query.mjs`), CSS container queries, or content-driven wrapping (`flex-basis` in rem) — and drive the CSS side from the same source.
> * **Open question:** one mechanism for all sites (atom-derived pixel query vs. container queries vs. rem flex-basis wrapping), and whether Mantine's theme breakpoints should be rewritten globally or per site.
> * **Proof:** an e2e project at e.g. 1000px / 200% font scale whose Settings and a SimpleGrid page pass `assertNothingClipped(page.locator("body"), { scrollable: "reachable" })` and switch to their compact layout.
> * **Related:** f-20260829-02 (root cause 2).

## Threat model and non-goals

Accidental input only: the user's own font-scale choice (slider 50–200 %, step 10) and window
size. No adversary. Environments that count: the Tauri webviews (WebKitGTK on Linux, WKWebView
on macOS, WebView2 on Windows) and the pinned Playwright Chromium the e2e suite runs in. A corrupt
persisted `font-size` outside the slider range is a separate, filed defect (see Risks), not a
case this plan must make sensible.

## Traced premises

Frozen at BASE `a990c06a`. Line numbers here are evidence, never instructions.

* P1 — `src/App.tsx:210-212` applies `document.documentElement.style.fontSize = \`${fontSize}%\``
  from `fontSizeAtom`; `src/App.tsx:214-217` builds the theme with
  `createAppTheme({ primaryColor, spellCheck })` inside `useMemo`.
* P2 — `src/styles/theme.ts:22-30` `createAppTheme` is documented as the "Sole application theme
  factory; settings-derived values are injected here", and sets no `breakpoints`.
  `src/components/home/StartupStorageFailure.tsx:9-12` is its only other production caller (built
  at module scope with defaults; the App, and therefore the root font scale, is not mounted there).
  Test callers: `src/App.test.tsx:563` (asserts the exact argument object),
  `src/components/settings/ColorControl.test.tsx:43`, `src/components/settings/ThemeButton.test.tsx:29`.
* P3 — `src/state/atoms.ts:271-275` `fontSizeAtom` persists `"font-size"`; default 100;
  `src/state/utils.ts:88` validates only "finite number". `FontSizeSlider.tsx:19-21` offers 50–200.
* P4 — Mantine 8.3.14 (`pnpm-lock.yaml:25`): default breakpoints xs 36em, sm 48em, md 62em,
  lg 75em, xl 88em (`@mantine/core/esm/core/MantineProvider/default-theme.mjs:70`). Responsive
  style props resolve a key to `(min-width: ${theme.breakpoints[key]})`
  (`core/Box/style-props/parse-style-props/parse-style-props.mjs:68`); SimpleGrid in its default
  `type="media"` builds its queries from the same theme values
  (`components/SimpleGrid/SimpleGridVariables.mjs:35,57`). `useMediaQuery` passes its string to
  `window.matchMedia` (`@mantine/hooks/esm/use-media-query/use-media-query.mjs:27`).
* P5 — Media-query `em`/`rem` resolve against the initial font size, not the root element's
  computed size (CSS Media Queries; the finding's evidence, measured in the f-20260829-02
  investigation). The root is set as a *percentage of that same initial size* (P1), so
  `(N × s/100)em` in a media query equals N scaled root-em for any UA default font size.
* P6 — Inventory of width switches (probe-1-r1):
  * JS media queries: `SettingsPage.tsx:127` `(max-width: 50rem)` → Tabs `orientation` at `:794`;
    `FilesPage.tsx:47` `COMPACT_DIALOG_QUERY = "(max-width: 30em)"`, used at `:67` → `AppModal
    fullScreen` at `:428`.
  * CSS: `SettingsPage.module.css:69` `@media (max-width: 50rem)` — styles `.settingsContent`,
    `.card`, `.settingsTabs`, `[role=tablist]`, `[role=tab]`, `.item`, `.settingControl`.
    `.card`/`.item` are also rendered by the search-results branch outside the Tabs
    (`SettingsPage.tsx:710,731`) and by `SettingRow` (`SettingsLayout.tsx`, used only by
    SettingsPage). The page root is the `Stack` at `SettingsPage.tsx:761`.
  * Theme-key switches (fixed by the theme alone): SimpleGrid `cols` at `AddDatabase.tsx:169`,
    `DatabasesPage.tsx:216,299`, `AddEngine.tsx:88,113`, `EnginesPage.tsx:135`,
    `UpgradeEngineModal.tsx:151`, `FilesPage.tsx:260`, `NewTabHome.tsx:241`; responsive style
    props at `DatabasesPage.tsx:217,227,281,390,410`, `FileCard.tsx:98`, `FilesPage.tsx:234,236,261,355`.
  * No `visibleFrom`/`hiddenFrom`, `Grid` breakpoint objects, `useMatches`, `matchMedia` or
    `window.innerWidth` in `src`; no other `@media`/`@container` in renderer CSS.
  * Already scale-aware, out of scope: `FileCard.tsx:22-51` compares the card width with 26 ×
    the computed root font size. `__root.tsx:273` AppShell `breakpoint: 0` (numeric px; no switch).
* P7 — e2e (probe-2-r1): `e2e/fixtures.ts:356` `fontScaleByProject` seeds
  `localStorage["font-size"]` per project (`:614`) before startup. Projects at 200 %:
  `database-files` 800×720, `accounts-puzzles-engines` 1440×900, `settings-responsive` /
  `async-errors` / `security-consent` 320×720. All others are 100 %. The finding's proof names
  `{ scrollable: "reachable" }`; the real API is `assertNothingClipped(locator, { mode:
  "reachable" })`, wrapped as `assertPageNotClipped(page)` (`e2e/fixtures.ts:72,265`).
  Snapshot path template is `{arg}-{projectName}` (`playwright.config.ts:32`); a project with
  only behavioural assertions needs no baseline. Re-recording runs only in the container
  (`pnpm test:e2e:update`) under the rule in `.claude/skills/verify-ui/SKILL.md` (`d-20260919-13`).
* P8 — `scripts/check-ui-boundaries.mjs` scans every tracked `src/**/*.{ts,tsx,css}` (tests
  excluded) line by line for one-door violations (direct `ActionIcon`/`Modal` imports, unsafe
  focus resets); `pnpm ui:boundary:check` is part of `gates:contract:check`, with its own test
  file `scripts/check-ui-boundaries-tests.mjs`.

## Approach

The defining property (O0) is zoom equivalence; everything else is the one mechanism that
delivers it and the guard that keeps it delivered.

### O0 — Definition of correct

Quoting the MANDATE: "make the compact/column switch follow the effective width in scaled
root-em". A switch defined at N em of width flips when the viewport is N **scaled** root-em wide,
i.e. at N × s/100 initial-em. At s = 100 every query string is byte-identical to today's, so every
100 % layout and every 100 % e2e snapshot is unchanged. This is the browser-zoom semantics
`d-20260831-16` already chose for the font scale ("scaling the whole UI is what browser zoom does").

### O1 — One scale function, applied to the theme breakpoints

"whether Mantine's theme breakpoints should be rewritten globally or per site": globally.
`createAppTheme` takes the app font scale as a required input and returns Mantine's default
breakpoint set, each value multiplied by s/100 and expressed in `em` (P5 makes `em` exact for any
UA default; a pixel value would assume 16px). One exported pure function performs the scaling and
is the only place the multiplication exists; both O1 and O2 call it. Values are deterministic,
finite em strings without floating-point noise (e.g. 110 % of 48em is `52.8em`).

* `App.tsx` passes `fontSizeAtom`'s value — the same value it writes to the root (P1) — and the
  theme memo depends on it.
* `StartupStorageFailure` passes 100 (named constant beside its existing defaults), because the
  App, and so the root scale, is never mounted there (P2).
* Consequence: every SimpleGrid `cols` object and every responsive style prop in P6's theme-key
  list follows the scale with **no per-site edit**, as will any future one.

### O2 — One hook for width queries that are not theme keys

The two JS queries in P6 (Settings 50rem, Files 30em) go through one renderer hook that takes a
max-width in em, scales it with O1's function and the current `fontSizeAtom` value, and returns
Mantine `useMediaQuery`'s boolean for the resulting query. A font-scale change re-evaluates the
query (Mantine re-subscribes when its query string changes, per the MANDATE's measurement).
`SettingsPage` and `FilesPage` call it with their existing thresholds (50 and 30); the
`COMPACT_DIALOG_QUERY` comment that documents the old fixed-pixel behaviour is replaced to state
the scaled behaviour.

### O3 — Settings CSS driven by the same boolean

"and drive the CSS side from the same source": the `@media (max-width: 50rem)` block in
`SettingsPage.module.css` is removed. Its rules apply instead under a compact marker that the
Settings page root (the outermost element containing both the Tabs branch and the search-results
branch, P6) carries exactly when O2's hook reports compact — the same boolean that sets the Tabs
`orientation`. No rule of the block is lost or changed; only its condition.

### O4 — Guard against a fixed-width switch reappearing

"every breakpoint means the same pixel width at every app font scale" is a property of the whole
renderer, so `pnpm ui:boundary:check` gains two rules in the existing one-door style (P8):
(a) a `useMediaQuery` import from `@mantine/hooks` anywhere except O2's hook module, and (b) an
`@media` rule with a width feature (`width`, `min-width`, `max-width`) in a renderer CSS file.
Non-width media features (`prefers-*`, `hover`, …) stay allowed. Both rules get positive and
negative cases in `scripts/check-ui-boundaries-tests.mjs`.

### O5 — Verification

* Unit (vitest): O1 — at 100 the breakpoints equal Mantine's defaults exactly; at 200 and 50 every
  value is the default × 2 / × 0.5 in em. O2 — the hook's query string at 100, 200 and 50 for 50em
  and 30em, and a font-scale change switches its result without remount (matchMedia mocked as the
  existing tests do). `App.test.tsx` asserts the new `createAppTheme` argument including the font
  scale it mocks (120 at `App.test.tsx:185`); the two theme-consuming tests pass 100.
* e2e (the MANDATE's proof): a new behaviour-only Playwright project at **1000×720, 200 %**
  (registered in `playwright.config.ts` and `fontScaleByProject`) with no screenshot assertion.
  It proves, on Settings and on one SimpleGrid page (the Databases list/details grid, or the Files
  tree/entry grid if the Databases mock cannot render both panes):
  * at 200 %: Settings' tablist orientation is horizontal and the compact marker is present; the
    grid's two panes are stacked (second pane starts below the first); `assertPageNotClipped(page)`
    holds on both pages;
  * at 100 % at the same 1000px (font scale overridden per test before startup): Settings' tablist
    is vertical and the grid's panes sit side by side — proving the switch is scale-driven and the
    100 % layout unchanged;
  * at 50 % at 700px: Settings' tablist is vertical (an unscaled 800px threshold would make it
    horizontal) — the other direction of the same defect.
* Existing snapshots: by O0, no snapshot of a 100 % project and none of a 320px project can move
  (at 320px every switch is already in its narrowest state, before and after). Snapshots of the two
  wider 200 % projects (`database-files`, `accounts-puzzles-engines`) whose captured surface holds a
  P6 grid or style prop **are expected to move** to their stacked/narrow form. They are re-recorded
  under the verify-ui rule: run `pnpm test:e2e:container` first, inspect every `*-diff.png`, accept
  only differences that are the predicted column/compact switch, re-record with
  `pnpm test:e2e:update`, and stop if any snapshot outside those two projects moves. Every moved
  snapshot is named in the commit message.
* Real webview (step 7, verify-ui): `pnpm verify:app` drives the release binary in WebKitGTK at a
  ~1000px window with `font-size` 200 and confirms Settings shows horizontal tabs — measuring P5 in
  the webview Felix actually runs, not only in Chromium.

## Decisions and trade-offs

* **Mechanism: scaled theme breakpoints + one scaled hook (chosen)** — the MANDATE's open question.
  Contested alternatives are under `## Decided autonomously` (D1).
* **Global, not per site** (D2).
* **Zoom equivalence as the definition** (D3), which is what makes "nothing changes at 100 %" a
  structural guarantee instead of a test hope.
* **A boundary rule rather than a convention** (D4).

## Decided autonomously

Run is `full auto`; each entry is recorded in `tasks/decisions.md` by the adopting session.

* **D1 — Which single mechanism makes every width switch follow the app font scale?**
  * Chosen: scale Mantine's theme breakpoints in `createAppTheme` by the font scale (em), plus one
    hook that scales the two non-theme JS queries with the same function; Settings' CSS keyed on
    that hook's boolean.
  * Rejected: CSS container queries — they answer a different question (the component's box, not
    the window), so every threshold also moves at 100 % (Settings' content box is narrower than the
    viewport by the nav rail), SimpleGrid's `type="container"` takes literal width keys and a
    wrapper per grid instead of theme keys (P4), and Settings' Tabs `orientation` is a React prop
    no CSS query can set. Rejected: content-driven wrapping (`auto-fill`/`flex-basis` in rem) —
    rewrites every grid and changes every 100 % layout, and cannot express the Tabs orientation.
    Rejected: an atom-derived pixel query — assumes a 16px UA default; a scaled `em` value is exact
    for any default (P5).
  * Because: one source of truth for theme keys, JS and CSS; zero per-site edits for the nine grids
    and eleven responsive props; byte-identical queries at 100 %.
* **D2 — Rewrite the theme breakpoints globally or per site?** Chosen: globally, in the sole theme
  factory. Rejected: per-site scaled objects — nine grid sites and eleven style-prop sites carrying
  a copy of the same arithmetic (rule 11), and every future grid silently unscaled again.
* **D3 — What does "correct" mean for a width switch under the font scale?** Chosen: zoom
  equivalence (O0). Rejected: tuning each threshold per scale by eye — no oracle, and contradicts
  `d-20260831-16`'s zoom framing.
* **D4 — How is the fix kept?** Chosen: two `ui:boundary:check` rules (O4). Rejected: a comment or
  a rule file only — the `COMPACT_DIALOG_QUERY` comment at `FilesPage.tsx:46` already documented
  the fixed-pixel behaviour and did not stop it being written.
* **D5 — Which scale does `StartupStorageFailure` use?** Chosen: 100, because it renders without
  the App and the root font is unscaled there. Rejected: reading the persisted scale — that screen
  exists because storage failed.

## Risks / open questions

* The first render of a `useMediaQuery` consumer reports `false` until its effect runs (Mantine's
  `getInitialValueInEffect` default); unchanged from today, not introduced here.
* Changing the font scale now rebuilds the theme object, re-rendering the provider tree once per
  slider release (`onChangeEnd`). Acceptable: it is a settings action, and the root font change
  already reflows the whole app.
* A corrupt persisted `font-size` (≤ 0 or far outside 50–200) is not range-checked today; the
  breakpoints scale by the same value the root uses, so this plan adds no mismatch for any value
  CSS accepts. Filed separately while locating: inbox entry
  `20261008-091923-1457949-1791443963092296318-6.md` ("The persisted app font scale is accepted at
  any finite value…", area `frontend-state`, entry `inline`).
* Committed snapshots of `database-files` and `accounts-puzzles-engines` move (O5). The prediction
  is the gate: a moved snapshot outside them is a regression to fix, never to re-record.

## Not part of this task

* f-20260927-09 (title-bar menu at 320px / 200 %) — separate finding, different files.
* `FileCard`'s preview switch — already scale-aware (P6).
* Layout of grids inside modals relative to the modal's own width — viewport-relative today and
  after; not the MANDATE's defect.
* Range validation of the persisted font scale — filed (Risks).

## Phases

Two phases, in dependency order (phase 2's assertions need phase 1's behaviour). Neither touches
auth, persistence, concurrency or an IPC/API contract; no file matches a Sensitive-Path glob.

### Phase 1 — Scaled breakpoints, hook, Settings CSS, boundary rule, moved snapshots

* Files: `src/styles/theme.ts`, `src/App.tsx`, `src/components/home/StartupStorageFailure.tsx`,
  one new hook module under `src/hooks/` (plus its test), `src/components/settings/SettingsPage.tsx`,
  `src/components/settings/SettingsPage.module.css`, `src/components/files/FilesPage.tsx`,
  `scripts/check-ui-boundaries.mjs`, `scripts/check-ui-boundaries-tests.mjs`, unit tests for O1
  (theme) and the updated `src/App.test.tsx`, `ColorControl.test.tsx`, `ThemeButton.test.tsx`;
  the re-recorded PNGs under `e2e/database-files.spec.ts-snapshots/` and
  `e2e/accounts-puzzles-engines.spec.ts-snapshots/` (only those the container run shows moved).
* Obligations: O1, O2, O3, O4, O5 unit and snapshot parts.
* Role: `normal`.
* Proof:
  1. `pnpm vitest run src/styles src/hooks src/App.test.tsx src/components/settings src/components/files`
  2. `pnpm ui:boundary:check && pnpm ui:boundary:report:test`
  3. `pnpm checks:pre-review`
  4. `pnpm test:e2e:container` — before re-recording, its only failures are snapshot mismatches in
     `database-files` / `accounts-puzzles-engines`; the leaf reports each with its diff path and
     stops. The orchestrator inspects every diff; on a resume the leaf runs `pnpm test:e2e:update`,
     then `git status --porcelain e2e/` must list only predicted PNGs, and a second
     `pnpm test:e2e:container` is green.

### Phase 2 — Font-scale breakpoint e2e project

* Files: `playwright.config.ts`, `e2e/fixtures.ts` (`fontScaleByProject` entry), one new spec
  under `e2e/`.
* Obligations: O5 e2e part. No screenshot assertion, so no baseline.
* Role: `normal`.
* Proof:
  1. `pnpm test:e2e:container --project=<new project>` green.
  2. Revert check, run by the orchestrator on a scratch copy of the tree: with O1's scale function
     forced to return the unscaled value, the new project goes red on the 200 % and 50 %
     assertions.
  3. `pnpm checks:pre-review`

### plan-r2.md

# Plan: responsive breakpoints follow the app font scale (f-20260927-08)

## Goal

Every width-dependent layout switch in the renderer flips at the same width *in scaled root-em*
at every app font scale, so the layout at window width W and font scale s is the layout the app
shows at W/s and 100 %. At 100 % nothing changes, by construction.

## MANDATE

Verbatim from `tasks/findings.md`, f-20260927-08:

> * **Where:** `src/components/settings/SettingsPage.tsx:126` (`useMediaQuery("(max-width: 50rem)")`), `src/components/settings/SettingsPage.module.css:60` (`@media (max-width: 50rem)`), and the Mantine `SimpleGrid cols` breakpoints at `src/components/files/FilesPage.tsx:217`, `src/components/databases/DatabasesPage.tsx:185,254`, `src/components/engines/EnginesPage.tsx:133`, `src/components/tabs/NewTabHome.tsx:241`, `src/components/engines/AddEngine.tsx:90,115`, `src/components/databases/AddDatabase.tsx:156`.
> * **Defect:** `App.tsx:209` scales the root font (`document.documentElement.style.fontSize = fontSize%`), but `rem`/`em` inside a media query resolve against the initial 16px, never the scaled root. So every breakpoint means the same pixel width at every app font scale: at 200% a 1000px window is only 31 root-em wide, yet Settings stays in its two-column layout (threshold 800px) and the grids stay multi-column, into widths the scaled content cannot fit.
> * **Evidence:** root cause 2 of `f-20260829-02` (its 2026-08-31 investigation). That run's 320px matrix never exercises it, because at 320px every breakpoint is already in its narrowest state; the f-20260829-02 plan review (2026-09-27, issue I3, lenses review-plan and review-root-cause) ruled a scale-aware breakpoint outside that finding's mandate because it changes behaviour only at other widths.
> * **Fix:** make the compact/column switch follow the effective width in scaled root-em — e.g. derive the query from `fontSizeAtom` (Mantine `useMediaQuery` re-subscribes when its query string changes, measured in `node_modules/@mantine/hooks/esm/.../use-media-query.mjs`), CSS container queries, or content-driven wrapping (`flex-basis` in rem) — and drive the CSS side from the same source.
> * **Open question:** one mechanism for all sites (atom-derived pixel query vs. container queries vs. rem flex-basis wrapping), and whether Mantine's theme breakpoints should be rewritten globally or per site.
> * **Proof:** an e2e project at e.g. 1000px / 200% font scale whose Settings and a SimpleGrid page pass `assertNothingClipped(page.locator("body"), { scrollable: "reachable" })` and switch to their compact layout.
> * **Related:** f-20260829-02 (root cause 2).

## Threat model and non-goals

Accidental input only: the user's own font-scale choice (slider 50–200 %, step 10) and window
size. No adversary. Environments that count: the Tauri webviews (WebKitGTK on Linux, WKWebView
on macOS, WebView2 on Windows) and the pinned Playwright Chromium the e2e suite runs in. A corrupt
persisted `font-size` outside the slider range is a separate, filed defect (see Risks), not a
case this plan must make sensible.

## Traced premises

Frozen at BASE `a990c06a`. Line numbers here are evidence, never instructions.

* P1 — `src/App.tsx:210-212` applies `document.documentElement.style.fontSize = \`${fontSize}%\``
  from `fontSizeAtom`; `src/App.tsx:214-217` builds the theme with
  `createAppTheme({ primaryColor, spellCheck })` inside `useMemo`.
* P2 — `src/styles/theme.ts:22-30` `createAppTheme` is documented as the "Sole application theme
  factory; settings-derived values are injected here", and sets no `breakpoints`.
  `src/components/home/StartupStorageFailure.tsx:9-12` is its only other production caller (built
  at module scope with defaults; the App, and therefore the root font scale, is not mounted there).
  Test callers: `src/App.test.tsx:563` (asserts the exact argument object),
  `src/components/settings/ColorControl.test.tsx:43`, `src/components/settings/ThemeButton.test.tsx:29`.
* P3 — `src/state/atoms.ts:271-275` `fontSizeAtom` persists `"font-size"`; default 100;
  `src/state/utils.ts:88` validates only "finite number". `FontSizeSlider.tsx:19-21` offers 50–200.
* P4 — Mantine 8.3.14 (`pnpm-lock.yaml:25`): default breakpoints xs 36em, sm 48em, md 62em,
  lg 75em, xl 88em (`@mantine/core/esm/core/MantineProvider/default-theme.mjs:70`). Responsive
  style props resolve a key to `(min-width: ${theme.breakpoints[key]})`
  (`core/Box/style-props/parse-style-props/parse-style-props.mjs:68`); SimpleGrid in its default
  `type="media"` builds its queries from the same theme values
  (`components/SimpleGrid/SimpleGridVariables.mjs:35,57`). `useMediaQuery` passes its string to
  `window.matchMedia` (`@mantine/hooks/esm/use-media-query/use-media-query.mjs:27`).
* P5 — Media-query `em`/`rem` resolve against the initial font size, not the root element's
  computed size (CSS Media Queries; the finding's evidence, measured in the f-20260829-02
  investigation). The root is set as a *percentage of that same initial size* (P1), so
  `(N × s/100)em` in a media query equals N scaled root-em for any UA default font size.
* P6 — Inventory of width switches (probe-1-r1):
  * JS media queries: `SettingsPage.tsx:127` `(max-width: 50rem)` → Tabs `orientation` at `:794`;
    `FilesPage.tsx:47` `COMPACT_DIALOG_QUERY = "(max-width: 30em)"`, used at `:67` → `AppModal
    fullScreen` at `:428`.
  * CSS: `SettingsPage.module.css:69` `@media (max-width: 50rem)` — styles `.settingsContent`,
    `.card`, `.settingsTabs`, `[role=tablist]`, `[role=tab]`, `.item`, `.settingControl`.
    `.card`/`.item` are also rendered by the search-results branch outside the Tabs
    (`SettingsPage.tsx:710,731`) and by `SettingRow` (`SettingsLayout.tsx`, used only by
    SettingsPage). The page root is the `Stack` at `SettingsPage.tsx:761`.
  * Theme-key switches (fixed by the theme alone): SimpleGrid `cols` at `AddDatabase.tsx:169`,
    `DatabasesPage.tsx:216,299`, `AddEngine.tsx:88,113`, `EnginesPage.tsx:135`,
    `UpgradeEngineModal.tsx:151`, `FilesPage.tsx:260`, `NewTabHome.tsx:241`; responsive style
    props at `DatabasesPage.tsx:217,227,281,390,410`, `FileCard.tsx:98`, `FilesPage.tsx:234,236,261,355`.
  * No `visibleFrom`/`hiddenFrom`, `Grid` breakpoint objects, `useMatches`, `matchMedia` or
    `window.innerWidth` in `src`; no other `@media`/`@container` in renderer CSS.
  * Already scale-aware, out of scope: `FileCard.tsx:22-51` compares the card width with 26 ×
    the computed root font size. `__root.tsx:273` AppShell `breakpoint: 0` (numeric px; no switch).
* P7 — e2e (probe-2-r1): `e2e/fixtures.ts:356` `fontScaleByProject` seeds
  `localStorage["font-size"]` per project (`:614`) before startup. Projects at 200 %:
  `database-files` 800×720, `accounts-puzzles-engines` 1440×900, `settings-responsive` /
  `async-errors` / `security-consent` 320×720. All others are 100 %. The finding's proof names
  `{ scrollable: "reachable" }`; the real API is `assertNothingClipped(locator, { mode:
  "reachable" })`, wrapped as `assertPageNotClipped(page)` (`e2e/fixtures.ts:72,265`).
  Snapshot path template is `{arg}-{projectName}` (`playwright.config.ts:32`); a project with
  only behavioural assertions needs no baseline. Re-recording runs only in the container
  (`pnpm test:e2e:update`) under the rule in `.claude/skills/verify-ui/SKILL.md` (`d-20260919-13`).
* P8 — `scripts/check-ui-boundaries.mjs` scans every tracked `src/**/*.{ts,tsx,css}` (tests
  excluded) line by line for one-door violations (direct `ActionIcon`/`Modal` imports, unsafe
  focus resets); `pnpm ui:boundary:check` is part of `gates:contract:check`, with its own test
  file `scripts/check-ui-boundaries-tests.mjs`.

## Approach

The defining property (O0) is zoom equivalence; everything else is the one mechanism that
delivers it and the proof that it is delivered.

### O0 — Definition of correct

Quoting the MANDATE: "make the compact/column switch follow the effective width in scaled
root-em". A switch defined at N em of width flips when the viewport is N **scaled** root-em wide,
i.e. at N × s/100 initial-em. At s = 100 every query string is byte-identical to today's, so every
100 % layout and every 100 % e2e snapshot is unchanged. This is the browser-zoom semantics
`d-20260831-16` already chose for the font scale ("scaling the whole UI is what browser zoom does").

### O1 — One scale function, applied to the theme breakpoints

"whether Mantine's theme breakpoints should be rewritten globally or per site": globally.
`createAppTheme` takes the app font scale as a required input and returns Mantine's default
breakpoint set, each value multiplied by s/100 and expressed in `em` (P5 makes `em` exact for any
UA default; a pixel value would assume 16px). One exported pure function performs the scaling and
is the only place the multiplication exists; both O1 and O2 call it. Values are deterministic,
finite em strings without floating-point noise (e.g. 110 % of 48em is `52.8em`).

* `App.tsx` passes `fontSizeAtom`'s value — the same value it writes to the root (P1) — and the
  theme memo depends on it.
* `StartupStorageFailure` passes 100 (named constant beside its existing defaults), because the
  App, and so the root scale, is never mounted there (P2).
* Consequence: every SimpleGrid `cols` object and every responsive style prop in P6's theme-key
  list follows the scale with **no per-site edit**, as will any future one.

### O2 — One hook for width queries that are not theme keys

The two JS queries in P6 (Settings 50rem, Files 30em) go through one renderer hook that takes a
max-width in em, scales it with O1's function and the current `fontSizeAtom` value, and returns
Mantine `useMediaQuery`'s boolean for the resulting query. A font-scale change re-evaluates the
query (Mantine re-subscribes when its query string changes, per the MANDATE's measurement).
`SettingsPage` and `FilesPage` call it with their existing thresholds (50 and 30); the
`COMPACT_DIALOG_QUERY` comment that documents the old fixed-pixel behaviour is replaced to state
the scaled behaviour.

Failure semantics: the hook adds no failure surface. It always passes a well-formed
`(max-width: <finite>em)` query (O1's function returns finite em values for the atom's validated
finite input), so the only failure is Mantine's own: where `window.matchMedia` is missing or
throws, Mantine's `useMediaQuery` catches it and keeps reporting its initial `false` (wide layout,
no fullscreen dialog) — `@mantine/hooks/esm/use-media-query/use-media-query.mjs:19-34`. That is
today's behaviour at both call sites, deliberately kept: a wide layout is the existing degraded
state, every supported webview implements `matchMedia`, and no diagnostic is added.

### O3 — Settings CSS driven by the same boolean

"and drive the CSS side from the same source": the `@media (max-width: 50rem)` block in
`SettingsPage.module.css` is removed. Its rules apply instead under a compact marker that the
Settings page root (the outermost element containing both the Tabs branch and the search-results
branch, P6) carries exactly when O2's hook reports compact — the same boolean that sets the Tabs
`orientation`. No rule of the block is lost or changed; only its condition.

### O4 — (withdrawn in r2)

A `ui:boundary:check` source rule was proposed in r1 and withdrawn under issue I3: it proves no
MANDATE obligation that O5's behavioural proofs cannot, and `push-review-policy.md` "Proof
selection before custom source verification" forbids extending a source checker without one.

### O5 — Verification

* Unit (vitest): O1 — at 100 the breakpoints equal Mantine's defaults exactly; at 200 and 50 every
  value is the default × 2 / × 0.5 in em. O2 — the hook's query string at 100, 200 and 50 for 50em
  and 30em, and a font-scale change switches its result without remount (matchMedia mocked as the
  existing tests do). `App.test.tsx` asserts the new `createAppTheme` argument including the font
  scale it mocks (120 at `App.test.tsx:185`); the two theme-consuming tests pass 100.
* e2e (the MANDATE's proof): a new behaviour-only Playwright project at **1000×720, 200 %**
  (registered in `playwright.config.ts` and `fontScaleByProject`) with no screenshot assertion.
  It proves, on Settings and on one SimpleGrid page (the Databases list/details grid, or the Files
  tree/entry grid if the Databases mock cannot render both panes):
  * at 200 %: Settings' tablist orientation is horizontal and the compact marker is present; the
    grid's two panes are stacked (second pane starts below the first); `assertPageNotClipped(page)`
    holds on both pages;
  * at 100 % at the same 1000px (font scale overridden per test before startup): Settings' tablist
    is vertical and the grid's panes sit side by side — proving the switch is scale-driven and the
    100 % layout unchanged;
  * at 50 % at 700px: Settings' tablist is vertical (an unscaled 800px threshold would make it
    horizontal) — the other direction of the same defect;
  * live change, no reload: starting at 100 % at 1000px, the font scale is set to 200 % through
    the Settings font-size slider (its real `onChangeEnd` path), after which Settings' tablist is
    horizontal and, navigating in-app (no reload) to the grid page, its panes are stacked —
    proving the mounted App rebuilds its theme and the hook re-evaluates when the atom changes,
    not only at startup.
* Existing snapshots: by O0, no snapshot of a 100 % project and none of a 320px project can move
  (at 320px every switch is already in its narrowest state, before and after). Snapshots of the two
  wider 200 % projects (`database-files`, `accounts-puzzles-engines`) whose captured surface holds a
  P6 grid or style prop **are expected to move** to their stacked/narrow form. They are re-recorded
  under the verify-ui rule: run `pnpm test:e2e:container` first, inspect every `*-diff.png`, accept
  only differences that are the predicted column/compact switch, re-record with
  `pnpm test:e2e:update`, and stop if any snapshot outside those two projects moves. Every moved
  snapshot is named in the commit message.
* Real webview (step 7, verify-ui): `pnpm verify:app` cannot do this as it stands — its only
  option is `--screenshot` (`scripts/verify-app.mjs:433`) and it checks no layout. The verify-ui
  leaf instead runs a **one-off scratch probe** (written under the run's `RUN_TMP`, never
  committed — observation, not a new tool) on the exported harness of `scripts/app-driver.mjs`
  (`startCompositor`, `startDriver`, `Session` with `call` / `/execute/sync`), as recorded practice
  for real-app flows. Against the release binary in WebKitGTK it sets `localStorage["font-size"]`
  to 200, reloads, opens Settings, reads `window.innerWidth` and the tablist's `aria-orientation`,
  then repeats at 100. Pass requires: innerWidth in [801, 1599] (so the outcome discriminates the
  unscaled 800px threshold from the scaled 1600px one), orientation `horizontal` at 200 and
  `vertical` at 100. With unscaled breakpoints the 200 % reading would be `vertical`, so the probe
  fails on revert.

## Decisions and trade-offs

* **Mechanism: scaled theme breakpoints + one scaled hook (chosen)** — the MANDATE's open question.
  Contested alternatives are under `## Decided autonomously` (D1).
* **Global, not per site** (D2).
* **Zoom equivalence as the definition** (D3), which is what makes "nothing changes at 100 %" a
  structural guarantee instead of a test hope.

## Decided autonomously

Run is `full auto`; each entry is recorded in `tasks/decisions.md` by the adopting session.

* **D1 — Which single mechanism makes every width switch follow the app font scale?**
  * Chosen: scale Mantine's theme breakpoints in `createAppTheme` by the font scale (em), plus one
    hook that scales the two non-theme JS queries with the same function; Settings' CSS keyed on
    that hook's boolean.
  * Rejected: CSS container queries — they answer a different question (the component's box, not
    the window), so every threshold also moves at 100 % (Settings' content box is narrower than the
    viewport by the nav rail), SimpleGrid's `type="container"` takes literal width keys and a
    wrapper per grid instead of theme keys (P4), and Settings' Tabs `orientation` is a React prop
    no CSS query can set. Rejected: content-driven wrapping (`auto-fill`/`flex-basis` in rem) —
    rewrites every grid and changes every 100 % layout, and cannot express the Tabs orientation.
    Rejected: an atom-derived pixel query — assumes a 16px UA default; a scaled `em` value is exact
    for any default (P5).
  * Because: one source of truth for theme keys, JS and CSS; zero per-site edits for the nine grids
    and eleven responsive props; byte-identical queries at 100 %.
* **D2 — Rewrite the theme breakpoints globally or per site?** Chosen: globally, in the sole theme
  factory. Rejected: per-site scaled objects — nine grid sites and eleven style-prop sites carrying
  a copy of the same arithmetic (rule 11), and every future grid silently unscaled again.
* **D3 — What does "correct" mean for a width switch under the font scale?** Chosen: zoom
  equivalence (O0). Rejected: tuning each threshold per scale by eye — no oracle, and contradicts
  `d-20260831-16`'s zoom framing.
* **D5 — Which scale does `StartupStorageFailure` use?** Chosen: 100, because it renders without
  the App and the root font is unscaled there. Rejected: reading the persisted scale — that screen
  exists because storage failed.

## Risks / open questions

* The first render of a `useMediaQuery` consumer reports `false` until its effect runs (Mantine's
  `getInitialValueInEffect` default); unchanged from today, not introduced here.
* Changing the font scale now rebuilds the theme object, re-rendering the provider tree once per
  slider release (`onChangeEnd`). Acceptable: it is a settings action, and the root font change
  already reflows the whole app.
* A corrupt persisted `font-size` (≤ 0 or far outside 50–200) is not range-checked today; the
  breakpoints scale by the same value the root uses, so this plan adds no mismatch for any value
  CSS accepts. Filed separately while locating: inbox entry
  `20261008-091923-1457949-1791443963092296318-6.md` ("The persisted app font scale is accepted at
  any finite value…", area `frontend-state`, entry `inline`).
* Committed snapshots of `database-files` and `accounts-puzzles-engines` move (O5). The prediction
  is the gate: a moved snapshot outside them is a regression to fix, never to re-record.

## Not part of this task

* f-20260927-09 (title-bar menu at 320px / 200 %) — separate finding, different files.
* `FileCard`'s preview switch — already scale-aware (P6).
* Layout of grids inside modals relative to the modal's own width — viewport-relative today and
  after; not the MANDATE's defect.
* Range validation of the persisted font scale — filed (Risks).

## Phases

Two phases, in dependency order (phase 2's assertions need phase 1's behaviour). Neither touches
auth, persistence, concurrency or an IPC/API contract; no file matches a Sensitive-Path glob.

### Phase 1 — Scaled breakpoints, hook, Settings CSS, moved snapshots

* Files: `src/styles/theme.ts`, `src/App.tsx`, `src/components/home/StartupStorageFailure.tsx`,
  one new hook module under `src/hooks/` (plus its test), `src/components/settings/SettingsPage.tsx`,
  `src/components/settings/SettingsPage.module.css`, `src/components/files/FilesPage.tsx`, unit tests for O1
  (theme) and the updated `src/App.test.tsx`, `ColorControl.test.tsx`, `ThemeButton.test.tsx`;
  the re-recorded PNGs under `e2e/database-files.spec.ts-snapshots/` and
  `e2e/accounts-puzzles-engines.spec.ts-snapshots/` (only those the container run shows moved).
* Obligations: O1, O2, O3, O5 unit and snapshot parts.
* Role: `normal`.
* Proof:
  1. `pnpm vitest run src/styles src/hooks src/App.test.tsx src/components/settings src/components/files`
  2. `pnpm checks:pre-review`
  3. `pnpm test:e2e:container` — before re-recording, its only failures are snapshot mismatches in
     `database-files` / `accounts-puzzles-engines`; the leaf reports each with its diff path and
     stops. The orchestrator inspects every diff; on a resume the leaf runs `pnpm test:e2e:update`,
     then `git status --porcelain e2e/` must list only predicted PNGs, and a second
     `pnpm test:e2e:container` is green.

### Phase 2 — Font-scale breakpoint e2e project

* Files: `playwright.config.ts`, `e2e/fixtures.ts` (`fontScaleByProject` entry), one new spec
  under `e2e/`.
* Obligations: O5 e2e part. No screenshot assertion, so no baseline.
* Role: `normal`.
* Proof:
  1. `pnpm test:e2e:container --project=<new project>` green.
  2. Revert check, run by the orchestrator on a scratch copy of the tree: with O1's scale function
     forced to return the unscaled value, the new project goes red on the 200 % and 50 %
     assertions.
  3. `pnpm checks:pre-review`

## Reviews

### Round 1 — r1 (12 lenses, every plan-capable lens; elapsed 289 s wall; adopted 4)

Lens set: review-plan (`--role review-plan`), and at `--role normal` (no Sensitive-Path glob in
the plan's files): review-minimalism, review-correctness, review-tests, review-error-handling,
review-chess-semantics, review-engine-protocol, review-ipc-contract, review-persisted-state,
review-pgn-index, review-platform-semantics, review-tauri-security. Executor: codex (OpenAI high
tier). Not run: review-code-quality, review-root-cause (`plan-review: false`).

Raw verdicts: plan REVISE · minimalism REVISE · correctness APPROVED · tests APPROVED ·
error-handling APPROVED · chess-semantics APPROVED (NOT APPLICABLE) · engine-protocol APPROVED
(NOT APPLICABLE) · ipc-contract APPROVED (NOT APPLICABLE) · persisted-state APPROVED (NOT
APPLICABLE) · pgn-index APPROVED (NOT APPLICABLE) · platform-semantics APPROVED (NOT APPLICABLE) ·
tauri-security APPROVED (NOT APPLICABLE). NOT APPLICABLE reasons checked by the arbiter: each
names only chess trees, engines, IPC, storage encoding/hydration, PGN, OS/FFI or credential
surfaces; the plan reads `fontSizeAtom` without changing its storage, and touches none of the
others — correct.

Raw findings (verbatim):

**lens-plan-r1:**

```text
[blocker] tasks/plans/2026-10-08-font-scaled-breakpoints.md:144 — O5 does not prove that changing the font scale updates the mounted App’s theme. The proposed App test checks only initial arguments (`src/App.test.tsx:560`), and the e2e cases seed each scale before startup. A theme cached at the initial scale could pass these proofs while grids remain unchanged after a slider adjustment. This integration matters because the current theme memo excludes font size (`src/App.tsx:214`). Require a mounted-app scale change that verifies the grid switches without reloading. (confidence: 97)

[blocker] tasks/plans/2026-10-08-font-scaled-breakpoints.md:169 — The promised WebKitGTK proof cannot run as written. `pnpm verify:app` invokes `scripts/verify-app.mjs` (`package.json:78`), whose only parsed option is `--screenshot` (`scripts/verify-app.mjs:433`). It contains no font-scale, Settings orientation, or window-resizing check and starts the compositor with default dimensions (`scripts/verify-app.mjs:1064`, `scripts/app-driver.mjs:168`). Neither phase includes changes to that verifier. Specify an executable real-app probe or include the necessary verifier extension so this command can actually reject incorrect breakpoint behavior. (confidence: 100)

VERDICT: REVISE```

**lens-minimalism-r1:**

```text
[should-fix] tasks/plans/2026-10-08-font-scaled-breakpoints.md:133 — O4 adds two renderer-wide source restrictions without identifying a mandate obligation that O1–O3 and O5 cannot satisfy. Its blanket `useMediaQuery` import ban also covers unrelated features such as `prefers-reduced-motion`. The shared push-review policy’s “Proof selection before custom source verification” requires an uncovered obligation and an explanation of why behavioral checks cannot prove it, even when extending an existing checker. The smallest sufficient plan retains the shared scaling function, two-caller hook, Settings marker and behavioral proofs, while removing O4 and all changes to the two boundary-checker files. This preserves mandate coverage and removes an entire tooling obligation (confidence: 95).

VERDICT: REVISE```

**lens-correctness-r1:**

```text
No correctness defects found in O0–O5. At 1000px/200%, Settings’ threshold becomes 1600px and the grid’s `sm` threshold becomes 1536px, producing horizontal tabs and stacked panes. At 100%, both retain their existing layout.

Limitation: implementation and browser behavior remain unverified in this plan-only review (confidence: 100).

VERDICT: APPROVED```

**lens-tests-r1:**

```text
[should-fix] tasks/plans/2026-10-08-font-scaled-breakpoints.md:147 — No proposed assertion exercises App’s theme update after changing font scale without remounting. Omitting `fontSize` from the theme memo dependencies would pass the factory tests, initial App argument assertion, isolated hook test and startup-seeded e2e cases. Add a live scale-change test that asserts the grid changes columns. (confidence: 98)

[should-fix] tasks/plans/2026-10-08-font-scaled-breakpoints.md:169 — The named `pnpm verify:app` command runs `scripts/verify-app.mjs`, which neither seeds 200% font scale nor asserts Settings’ orientation. No phase adds that check or names a runnable custom probe. The claimed WebKitGTK proof would therefore miss fixed breakpoints. Specify the probe and its failing-on-revert orientation assertion. (confidence: 99)

VERDICT: APPROVED```

**lens-error-handling-r1:**

```text
[should-fix] tasks/plans/2026-10-08-font-scaled-breakpoints.md:119 — O2 leaves subscription-failure semantics unspecified. Mantine catches media-query setup failures silently, returning false initially or retaining the previous result after a query change. O3 would then apply wide or stale Settings styles without any diagnostic. State whether this fallback is intentional and how failure should surface. (confidence: 94)

VERDICT: APPROVED```

Issues (stable IDs):

| ID | Claim | Witnesses | Evidence (arbiter) | Disposition | Authority | Correction (r2) | Status |
|---|---|---|---|---|---|---|---|
| I1 | No proof that a font-scale change updates the mounted App's theme and hook; every proof seeds the scale before startup. | plan r1 #1 (blocker), tests r1 #1 (should-fix) | Confirmed: `src/App.tsx:214-217` memo deps are `[primaryColor, spellCheck]`; `App.test.tsx:563` asserts only the initial argument. | Fix | MANDATE "make the compact/column switch follow the effective width in scaled root-em" (a switch that ignores a live scale change does not follow it) | O5 e2e adds a live change: 100 % → 200 % through the Settings slider without reload; Settings tablist turns horizontal and, after in-app navigation, the grid panes are stacked. | open → r2 |
| I2 | The promised WebKitGTK proof (`pnpm verify:app`) cannot run as written. | plan r1 #2 (blocker), tests r1 #2 (should-fix) | Confirmed: `scripts/verify-app.mjs:433` parses only `--screenshot`; `scripts/app-driver.mjs:168` `startCompositor({ width, height })` and `Session.call`/`/execute/sync` (`:250-305`) are exported. | Fix | Not a new mechanism (a scratch probe on the existing harness; nothing committed). | O5's real-webview item is a one-off scratch probe on `scripts/app-driver.mjs` exports: font-size 200 then 100, innerWidth in [801, 1599], tablist `aria-orientation` horizontal / vertical; fails on revert. | open → r2 |
| I3 | O4's two `ui:boundary:check` rules serve no MANDATE obligation the behavioural proofs cannot; the `useMediaQuery` ban is overbroad. | minimalism r1 #1 (should-fix) | Confirmed: `~/.claude/references/push-review-policy.md:427-436` "Proof selection before custom source verification" applies equally to extending an existing checker. | Fix (withdraw mechanism) | — (removal) | O4 withdrawn; D4 removed; the two checker files leave Phase 1's file list and proof. | open → r2 |
| I4 | O2 does not state subscription-failure semantics (Mantine silently keeps `false`). | error-handling r1 #1 (should-fix) | Confirmed: `@mantine/hooks/esm/use-media-query/use-media-query.mjs:19-34` catches a `matchMedia` throw and keeps the initial value. | Fix | Not a new mechanism (states existing behaviour). | O2 gains a "Failure semantics" paragraph: always a well-formed finite-em query; on missing/throwing `matchMedia` the hook reports `false` exactly as today; no diagnostic added, deliberately. | open → r2 |

Adopted plan-level corrections r1: 4 (I1–I4). Carried: none. Skipped: none. Deferred: none.
Out-of-area filing during Locate (before r1): inbox entry
`20261008-091923-1457949-1791443963092296318-6.md` (persisted font scale not range-checked;
`frontend-state`, `inline`); not a plan issue.

### plan-r3.md

# Plan: responsive breakpoints follow the app font scale (f-20260927-08)

## Goal

Every width-dependent layout switch in the renderer flips at the same width *in scaled root-em*
at every app font scale, so the layout at window width W and font scale s is the layout the app
shows at W/s and 100 %. At 100 % nothing changes, by construction.

## MANDATE

Verbatim from `tasks/findings.md`, f-20260927-08:

> * **Where:** `src/components/settings/SettingsPage.tsx:126` (`useMediaQuery("(max-width: 50rem)")`), `src/components/settings/SettingsPage.module.css:60` (`@media (max-width: 50rem)`), and the Mantine `SimpleGrid cols` breakpoints at `src/components/files/FilesPage.tsx:217`, `src/components/databases/DatabasesPage.tsx:185,254`, `src/components/engines/EnginesPage.tsx:133`, `src/components/tabs/NewTabHome.tsx:241`, `src/components/engines/AddEngine.tsx:90,115`, `src/components/databases/AddDatabase.tsx:156`.
> * **Defect:** `App.tsx:209` scales the root font (`document.documentElement.style.fontSize = fontSize%`), but `rem`/`em` inside a media query resolve against the initial 16px, never the scaled root. So every breakpoint means the same pixel width at every app font scale: at 200% a 1000px window is only 31 root-em wide, yet Settings stays in its two-column layout (threshold 800px) and the grids stay multi-column, into widths the scaled content cannot fit.
> * **Evidence:** root cause 2 of `f-20260829-02` (its 2026-08-31 investigation). That run's 320px matrix never exercises it, because at 320px every breakpoint is already in its narrowest state; the f-20260829-02 plan review (2026-09-27, issue I3, lenses review-plan and review-root-cause) ruled a scale-aware breakpoint outside that finding's mandate because it changes behaviour only at other widths.
> * **Fix:** make the compact/column switch follow the effective width in scaled root-em — e.g. derive the query from `fontSizeAtom` (Mantine `useMediaQuery` re-subscribes when its query string changes, measured in `node_modules/@mantine/hooks/esm/.../use-media-query.mjs`), CSS container queries, or content-driven wrapping (`flex-basis` in rem) — and drive the CSS side from the same source.
> * **Open question:** one mechanism for all sites (atom-derived pixel query vs. container queries vs. rem flex-basis wrapping), and whether Mantine's theme breakpoints should be rewritten globally or per site.
> * **Proof:** an e2e project at e.g. 1000px / 200% font scale whose Settings and a SimpleGrid page pass `assertNothingClipped(page.locator("body"), { scrollable: "reachable" })` and switch to their compact layout.
> * **Related:** f-20260829-02 (root cause 2).

## Threat model and non-goals

Accidental input only: the user's own font-scale choice (slider 50–200 %, step 10) and window
size. No adversary. Environments that count: the Tauri webviews (WebKitGTK on Linux, WKWebView
on macOS, WebView2 on Windows) and the pinned Playwright Chromium the e2e suite runs in. A corrupt
persisted `font-size` outside the slider range is a separate, filed defect (see Risks), not a
case this plan must make sensible.

## Traced premises

Frozen at BASE `a990c06a`. Line numbers here are evidence, never instructions.

* P1 — `src/App.tsx:210-212` applies `document.documentElement.style.fontSize = \`${fontSize}%\``
  from `fontSizeAtom`; `src/App.tsx:214-217` builds the theme with
  `createAppTheme({ primaryColor, spellCheck })` inside `useMemo`.
* P2 — `src/styles/theme.ts:22-30` `createAppTheme` is documented as the "Sole application theme
  factory; settings-derived values are injected here", and sets no `breakpoints`.
  `src/components/home/StartupStorageFailure.tsx:9-12` is its only other production caller (built
  at module scope with defaults; the App, and therefore the root font scale, is not mounted there).
  Test callers: `src/App.test.tsx:563` (asserts the exact argument object),
  `src/components/settings/ColorControl.test.tsx:43`, `src/components/settings/ThemeButton.test.tsx:29`.
* P3 — `src/state/atoms.ts:271-275` `fontSizeAtom` persists `"font-size"`; default 100;
  `src/state/utils.ts:88` validates only "finite number". `FontSizeSlider.tsx:19-21` offers 50–200.
* P4 — Mantine 8.3.14 (`pnpm-lock.yaml:25`): default breakpoints xs 36em, sm 48em, md 62em,
  lg 75em, xl 88em (`@mantine/core/esm/core/MantineProvider/default-theme.mjs:70`). Responsive
  style props resolve a key to `(min-width: ${theme.breakpoints[key]})`
  (`core/Box/style-props/parse-style-props/parse-style-props.mjs:68`); SimpleGrid in its default
  `type="media"` builds its queries from the same theme values
  (`components/SimpleGrid/SimpleGridVariables.mjs:35,57`). `useMediaQuery` passes its string to
  `window.matchMedia` (`@mantine/hooks/esm/use-media-query/use-media-query.mjs:27`).
* P5 — Media-query `em`/`rem` resolve against the initial font size, not the root element's
  computed size (CSS Media Queries; the finding's evidence, measured in the f-20260829-02
  investigation). The root is set as a *percentage of that same initial size* (P1), so
  `(N × s/100)em` in a media query equals N scaled root-em for any UA default font size.
* P6 — Inventory of width switches (probe-1-r1):
  * JS media queries: `SettingsPage.tsx:127` `(max-width: 50rem)` → Tabs `orientation` at `:794`;
    `FilesPage.tsx:47` `COMPACT_DIALOG_QUERY = "(max-width: 30em)"`, used at `:67` → `AppModal
    fullScreen` at `:428`.
  * CSS: `SettingsPage.module.css:69` `@media (max-width: 50rem)` — styles `.settingsContent`,
    `.card`, `.settingsTabs`, `[role=tablist]`, `[role=tab]`, `.item`, `.settingControl`.
    `.card`/`.item` are also rendered by the search-results branch outside the Tabs
    (`SettingsPage.tsx:710,731`) and by `SettingRow` (`SettingsLayout.tsx`, used only by
    SettingsPage). The page root is the `Stack` at `SettingsPage.tsx:761`.
  * Theme-key switches (fixed by the theme alone): SimpleGrid `cols` at `AddDatabase.tsx:169`,
    `DatabasesPage.tsx:216,299`, `AddEngine.tsx:88,113`, `EnginesPage.tsx:135`,
    `UpgradeEngineModal.tsx:151`, `FilesPage.tsx:260`, `NewTabHome.tsx:241`; responsive style
    props at `DatabasesPage.tsx:217,227,281,390,410`, `FileCard.tsx:98`, `FilesPage.tsx:234,236,261,355`.
  * No `visibleFrom`/`hiddenFrom`, `Grid` breakpoint objects, `useMatches`, `matchMedia` or
    `window.innerWidth` in `src`; no other `@media`/`@container` in renderer CSS.
  * Already scale-aware, out of scope: `FileCard.tsx:22-51` compares the card width with 26 ×
    the computed root font size. `__root.tsx:273` AppShell `breakpoint: 0` (numeric px; no switch).
* P7 — e2e (probe-2-r1): `e2e/fixtures.ts:356` `fontScaleByProject` seeds
  `localStorage["font-size"]` per project (`:614`) before startup. Projects at 200 %:
  `database-files` 800×720, `accounts-puzzles-engines` 1440×900, `settings-responsive` /
  `async-errors` / `security-consent` 320×720. All others are 100 %. The finding's proof names
  `{ scrollable: "reachable" }`; the real API is `assertNothingClipped(locator, { mode:
  "reachable" })`, wrapped as `assertPageNotClipped(page)` (`e2e/fixtures.ts:72,265`).
  Snapshot path template is `{arg}-{projectName}` (`playwright.config.ts:32`); a project with
  only behavioural assertions needs no baseline. Re-recording runs only in the container
  (`pnpm test:e2e:update`) under the rule in `.claude/skills/verify-ui/SKILL.md` (`d-20260919-13`).
* P8 — `scripts/check-ui-boundaries.mjs` scans every tracked `src/**/*.{ts,tsx,css}` (tests
  excluded) line by line for one-door violations (direct `ActionIcon`/`Modal` imports, unsafe
  focus resets); `pnpm ui:boundary:check` is part of `gates:contract:check`, with its own test
  file `scripts/check-ui-boundaries-tests.mjs`.

## Approach

The defining property (O0) is zoom equivalence; everything else is the one mechanism that
delivers it and the proof that it is delivered.

### O0 — Definition of correct

Quoting the MANDATE: "make the compact/column switch follow the effective width in scaled
root-em". A switch defined at N em of width flips when the viewport is N **scaled** root-em wide,
i.e. at N × s/100 initial-em. At s = 100 every query string is byte-identical to today's, so every
100 % layout and every 100 % e2e snapshot is unchanged. This is the browser-zoom semantics
`d-20260831-16` already chose for the font scale ("scaling the whole UI is what browser zoom does").

### O1 — One scale function, applied to the theme breakpoints

"whether Mantine's theme breakpoints should be rewritten globally or per site": globally.
`createAppTheme` takes the app font scale as a required input and returns Mantine's default
breakpoint set, each value multiplied by s/100 and expressed in `em` (P5 makes `em` exact for any
UA default; a pixel value would assume 16px). One exported pure function performs the scaling and
is the only place the multiplication exists; both O1 and O2 call it. Values are deterministic,
finite em strings without floating-point noise (e.g. 110 % of 48em is `52.8em`).

* `App.tsx` passes `fontSizeAtom`'s value — the same value it writes to the root (P1) — and the
  theme memo depends on it.
* `StartupStorageFailure` passes 100 (named constant beside its existing defaults), because the
  App, and so the root scale, is never mounted there (P2).
* Consequence: every SimpleGrid `cols` object and every responsive style prop in P6's theme-key
  list follows the scale with **no per-site edit**, as will any future one.

### O2 — One hook for width queries that are not theme keys

The two JS queries in P6 (Settings 50rem, Files 30em) go through one renderer hook that takes a
max-width in em, scales it with O1's function and the current `fontSizeAtom` value, and returns
Mantine `useMediaQuery`'s boolean for the resulting query. A font-scale change re-evaluates the
query (Mantine re-subscribes when its query string changes, per the MANDATE's measurement).
`SettingsPage` and `FilesPage` call it with their existing thresholds (50 and 30); the
`COMPACT_DIALOG_QUERY` comment that documents the old fixed-pixel behaviour is replaced to state
the scaled behaviour.

Failure semantics: the hook adds no failure surface of its own; it inherits Mantine's
`useMediaQuery` exactly (`@mantine/hooks/esm/use-media-query/use-media-query.mjs:4-11,19-34`):
before its effect runs it reports `false`; if `window.matchMedia` throws, the effect's catch leaves
the state as it was — `false` on mount, or the previous result after a query change (a font-scale
change); if listener attachment fails after a successful `matchMedia`, the freshly sampled value is
kept but no longer tracks resizes. The hook always passes a well-formed `(max-width: <finite>em)`
query (O1's function returns finite em values for the atom's validated finite input), so in a
webview whose `matchMedia` accepted the previous query, the next one of the same shape is not a new
failure cause. This degradation is deliberately kept unchanged and undiagnosed: it is today's
behaviour at both call sites, every supported webview implements `matchMedia` and
`MediaQueryList.addEventListener`, and a separate fallback would be a mechanism with no MANDATE
obligation behind it.

### O4 — (withdrawn in r2)

A `ui:boundary:check` source rule was proposed in r1 and withdrawn under issue I3: it proves no
MANDATE obligation that O5's behavioural proofs cannot, and `push-review-policy.md` "Proof
selection before custom source verification" forbids extending a source checker without one.

### O5 — Verification

* Unit (vitest): O1 — at 100 the breakpoints equal Mantine's defaults exactly; at 200 and 50 every
  value is the default × 2 / × 0.5 in em. O2 — the hook's query string at 100, 200 and 50 for 50em
  and 30em, and a font-scale change switches its result without remount (matchMedia mocked as the
  existing tests do). `App.test.tsx` asserts the new `createAppTheme` argument including the font
  scale it mocks (120 at `App.test.tsx:185`); the two theme-consuming tests pass 100.
* e2e (the MANDATE's proof): a new behaviour-only Playwright project at **1000×720, 200 %**
  (registered in `playwright.config.ts` and `fontScaleByProject`) with no screenshot assertion.
  It proves, on Settings and on one SimpleGrid page (the Databases list/details grid, or the Files
  tree/entry grid if the Databases mock cannot render both panes):
  * at 200 %: Settings' tablist orientation is horizontal and the compact marker is present; the
    grid's two panes are stacked (second pane starts below the first); `assertPageNotClipped(page)`
    holds on both pages;
  * at 100 % at the same 1000px (font scale overridden per test before startup): Settings' tablist
    is vertical and the grid's panes sit side by side — proving the switch is scale-driven and the
    100 % layout unchanged;
  * at 50 % at 700px: Settings' tablist is vertical (an unscaled 800px threshold would make it
    horizontal) — the other direction of the same defect;
  * live change, no reload: starting at 100 % at 1000px, the font scale is set to 200 % through
    the Settings font-size slider (its real `onChangeEnd` path), after which Settings' tablist is
    horizontal and, navigating in-app (no reload) to the grid page, its panes are stacked —
    proving the mounted App rebuilds its theme and the hook re-evaluates when the atom changes,
    not only at startup.
* Existing snapshots: by O0, no snapshot of a 100 % project and none of a 320px project can move
  (at 320px every switch is already in its narrowest state, before and after). Snapshots of the two
  wider 200 % projects (`database-files`, `accounts-puzzles-engines`) whose captured surface holds a
  P6 grid or style prop **are expected to move** to their stacked/narrow form. They are re-recorded
  under the verify-ui rule: run `pnpm test:e2e:container` first, inspect every `*-diff.png`, accept
  only differences that are the predicted column/compact switch, re-record with
  `pnpm test:e2e:update`, and stop if any snapshot outside those two projects moves. Every moved
  snapshot is named in the commit message.
* Real webview (step 7, verify-ui): `pnpm verify:app` cannot do this as it stands — its only
  option is `--screenshot` (`scripts/verify-app.mjs:433`) and it checks no layout. The verify-ui
  leaf instead runs a **one-off scratch probe** (written under the run's `RUN_TMP`, never
  committed — observation, not a new tool) on the exported harness of `scripts/app-driver.mjs`
  (`startCompositor`, `startDriver`, `Session` with `call` / `/execute/sync`), as recorded practice
  for real-app flows. Against the release binary in WebKitGTK it sets `localStorage["font-size"]`
  to 200, reloads, opens Settings, reads `window.innerWidth` and the tablist's `aria-orientation`,
  then repeats at 100. Pass requires: innerWidth in [801, 1599] (so the outcome discriminates the
  unscaled 800px threshold from the scaled 1600px one), orientation `horizontal` at 200 and
  `vertical` at 100. With unscaled breakpoints the 200 % reading would be `vertical`, so the probe
  fails on revert.

## Decisions and trade-offs

* **Mechanism: scaled theme breakpoints + one scaled hook (chosen)** — the MANDATE's open question.
  Contested alternatives are under `## Decided autonomously` (D1).
* **Global, not per site** (D2).
* **Zoom equivalence as the definition** (D3), which is what makes "nothing changes at 100 %" a
  structural guarantee instead of a test hope.

## Decided autonomously

Run is `full auto`; each entry is recorded in `tasks/decisions.md` by the adopting session.

* **D1 — Which single mechanism makes every width switch follow the app font scale?**
  * Chosen: scale Mantine's theme breakpoints in `createAppTheme` by the font scale (em), plus one
    hook that scales the two non-theme JS queries with the same function; Settings' CSS keyed on
    that hook's boolean.
  * Rejected: CSS container queries — they answer a different question (the component's box, not
    the window), so every threshold also moves at 100 % (Settings' content box is narrower than the
    viewport by the nav rail), SimpleGrid's `type="container"` takes literal width keys and a
    wrapper per grid instead of theme keys (P4), and Settings' Tabs `orientation` is a React prop
    no CSS query can set. Rejected: content-driven wrapping (`auto-fill`/`flex-basis` in rem) —
    rewrites every grid and changes every 100 % layout, and cannot express the Tabs orientation.
    Rejected: an atom-derived pixel query — assumes a 16px UA default; a scaled `em` value is exact
    for any default (P5).
  * Because: one source of truth for theme keys, JS and CSS; zero per-site edits for the nine grids
    and eleven responsive props; byte-identical queries at 100 %.
* **D2 — Rewrite the theme breakpoints globally or per site?** Chosen: globally, in the sole theme
  factory. Rejected: per-site scaled objects — nine grid sites and eleven style-prop sites carrying
  a copy of the same arithmetic (rule 11), and every future grid silently unscaled again.
* **D3 — What does "correct" mean for a width switch under the font scale?** Chosen: zoom
  equivalence (O0). Rejected: tuning each threshold per scale by eye — no oracle, and contradicts
  `d-20260831-16`'s zoom framing.
* **D5 — Which scale does `StartupStorageFailure` use?** Chosen: 100, because it renders without
  the App and the root font is unscaled there. Rejected: reading the persisted scale — that screen
  exists because storage failed.

## Risks / open questions

* The first render of a `useMediaQuery` consumer reports `false` until its effect runs (Mantine's
  `getInitialValueInEffect` default); unchanged from today, not introduced here.
* Changing the font scale now rebuilds the theme object, re-rendering the provider tree once per
  slider release (`onChangeEnd`). Acceptable: it is a settings action, and the root font change
  already reflows the whole app.
* A corrupt persisted `font-size` (≤ 0 or far outside 50–200) is not range-checked today; the
  breakpoints scale by the same value the root uses, so this plan adds no mismatch for any value
  CSS accepts. Filed separately while locating: inbox entry
  `20261008-091923-1457949-1791443963092296318-6.md` ("The persisted app font scale is accepted at
  any finite value…", area `frontend-state`, entry `inline`).
* Committed snapshots of `database-files` and `accounts-puzzles-engines` move (O5). The prediction
  is the gate: a moved snapshot outside them is a regression to fix, never to re-record.

## Not part of this task

* f-20260927-09 (title-bar menu at 320px / 200 %) — separate finding, different files.
* `FileCard`'s preview switch — already scale-aware (P6).
* Layout of grids inside modals relative to the modal's own width — viewport-relative today and
  after; not the MANDATE's defect.
* Range validation of the persisted font scale — filed (Risks).

## Phases

Two phases, in dependency order (phase 2's assertions need phase 1's behaviour). Neither touches
auth, persistence, concurrency or an IPC/API contract; no file matches a Sensitive-Path glob.

### Phase 1 — Scaled breakpoints, hook, Settings CSS, moved snapshots

* Files: `src/styles/theme.ts`, `src/App.tsx`, `src/components/home/StartupStorageFailure.tsx`,
  one new hook module under `src/hooks/` (plus its test), `src/components/settings/SettingsPage.tsx`,
  `src/components/settings/SettingsPage.module.css`, `src/components/files/FilesPage.tsx`,
  `src/components/files/FilesPage.test.tsx` (its `jotai` and `@/state/atoms` mocks must expose
  whatever O2's hook reads — today they expose only `useAtom` and no `fontSizeAtom`), unit tests for O1
  (theme) and the updated `src/App.test.tsx`, `ColorControl.test.tsx`, `ThemeButton.test.tsx`;
  the re-recorded PNGs under `e2e/database-files.spec.ts-snapshots/` and
  `e2e/accounts-puzzles-engines.spec.ts-snapshots/` (only those the container run shows moved).
* Obligations: O1, O2, O3, O5 unit and snapshot parts.
* Role: `normal`.
* Proof:
  1. `pnpm vitest run src/styles src/hooks src/App.test.tsx src/components/settings src/components/files`
  2. `pnpm checks:pre-review`
  3. `pnpm test:e2e:container` — before re-recording, its only failures are snapshot mismatches in
     `database-files` / `accounts-puzzles-engines`; the leaf reports each with its diff path and
     stops. The orchestrator inspects every diff; on a resume the leaf runs `pnpm test:e2e:update`,
     then `git status --porcelain e2e/` must list only predicted PNGs, and a second
     `pnpm test:e2e:container` is green.

### Phase 2 — Font-scale breakpoint e2e project

* Files: `playwright.config.ts`, `e2e/fixtures.ts` (`fontScaleByProject` entry), one new spec
  under `e2e/`.
* Obligations: O5 e2e part. No screenshot assertion, so no baseline.
* Role: `normal`.
* Proof:
  1. `pnpm test:e2e:container --project=<new project>` green.
  2. Revert check, run by the orchestrator on a scratch copy of the tree: with O1's scale function
     forced to return the unscaled value, the new project goes red on the 200 % and 50 %
     assertions.
  3. `pnpm checks:pre-review`

## Reviews

### Round 1 — r1 (12 lenses, every plan-capable lens; elapsed 289 s wall; adopted 4)

Lens set: review-plan (`--role review-plan`), and at `--role normal` (no Sensitive-Path glob in
the plan's files): review-minimalism, review-correctness, review-tests, review-error-handling,
review-chess-semantics, review-engine-protocol, review-ipc-contract, review-persisted-state,
review-pgn-index, review-platform-semantics, review-tauri-security. Executor: codex (OpenAI high
tier). Not run: review-code-quality, review-root-cause (`plan-review: false`).

Raw verdicts: plan REVISE · minimalism REVISE · correctness APPROVED · tests APPROVED ·
error-handling APPROVED · chess-semantics APPROVED (NOT APPLICABLE) · engine-protocol APPROVED
(NOT APPLICABLE) · ipc-contract APPROVED (NOT APPLICABLE) · persisted-state APPROVED (NOT
APPLICABLE) · pgn-index APPROVED (NOT APPLICABLE) · platform-semantics APPROVED (NOT APPLICABLE) ·
tauri-security APPROVED (NOT APPLICABLE). NOT APPLICABLE reasons checked by the arbiter: each
names only chess trees, engines, IPC, storage encoding/hydration, PGN, OS/FFI or credential
surfaces; the plan reads `fontSizeAtom` without changing its storage, and touches none of the
others — correct.

Raw findings (verbatim):

**lens-plan-r1:**

```text
[blocker] tasks/plans/2026-10-08-font-scaled-breakpoints.md:144 — O5 does not prove that changing the font scale updates the mounted App’s theme. The proposed App test checks only initial arguments (`src/App.test.tsx:560`), and the e2e cases seed each scale before startup. A theme cached at the initial scale could pass these proofs while grids remain unchanged after a slider adjustment. This integration matters because the current theme memo excludes font size (`src/App.tsx:214`). Require a mounted-app scale change that verifies the grid switches without reloading. (confidence: 97)

[blocker] tasks/plans/2026-10-08-font-scaled-breakpoints.md:169 — The promised WebKitGTK proof cannot run as written. `pnpm verify:app` invokes `scripts/verify-app.mjs` (`package.json:78`), whose only parsed option is `--screenshot` (`scripts/verify-app.mjs:433`). It contains no font-scale, Settings orientation, or window-resizing check and starts the compositor with default dimensions (`scripts/verify-app.mjs:1064`, `scripts/app-driver.mjs:168`). Neither phase includes changes to that verifier. Specify an executable real-app probe or include the necessary verifier extension so this command can actually reject incorrect breakpoint behavior. (confidence: 100)

VERDICT: REVISE```

**lens-minimalism-r1:**

```text
[should-fix] tasks/plans/2026-10-08-font-scaled-breakpoints.md:133 — O4 adds two renderer-wide source restrictions without identifying a mandate obligation that O1–O3 and O5 cannot satisfy. Its blanket `useMediaQuery` import ban also covers unrelated features such as `prefers-reduced-motion`. The shared push-review policy’s “Proof selection before custom source verification” requires an uncovered obligation and an explanation of why behavioral checks cannot prove it, even when extending an existing checker. The smallest sufficient plan retains the shared scaling function, two-caller hook, Settings marker and behavioral proofs, while removing O4 and all changes to the two boundary-checker files. This preserves mandate coverage and removes an entire tooling obligation (confidence: 95).

VERDICT: REVISE```

**lens-correctness-r1:**

```text
No correctness defects found in O0–O5. At 1000px/200%, Settings’ threshold becomes 1600px and the grid’s `sm` threshold becomes 1536px, producing horizontal tabs and stacked panes. At 100%, both retain their existing layout.

Limitation: implementation and browser behavior remain unverified in this plan-only review (confidence: 100).

VERDICT: APPROVED```

**lens-tests-r1:**

```text
[should-fix] tasks/plans/2026-10-08-font-scaled-breakpoints.md:147 — No proposed assertion exercises App’s theme update after changing font scale without remounting. Omitting `fontSize` from the theme memo dependencies would pass the factory tests, initial App argument assertion, isolated hook test and startup-seeded e2e cases. Add a live scale-change test that asserts the grid changes columns. (confidence: 98)

[should-fix] tasks/plans/2026-10-08-font-scaled-breakpoints.md:169 — The named `pnpm verify:app` command runs `scripts/verify-app.mjs`, which neither seeds 200% font scale nor asserts Settings’ orientation. No phase adds that check or names a runnable custom probe. The claimed WebKitGTK proof would therefore miss fixed breakpoints. Specify the probe and its failing-on-revert orientation assertion. (confidence: 99)

VERDICT: APPROVED```

**lens-error-handling-r1:**

```text
[should-fix] tasks/plans/2026-10-08-font-scaled-breakpoints.md:119 — O2 leaves subscription-failure semantics unspecified. Mantine catches media-query setup failures silently, returning false initially or retaining the previous result after a query change. O3 would then apply wide or stale Settings styles without any diagnostic. State whether this fallback is intentional and how failure should surface. (confidence: 94)

VERDICT: APPROVED```

Issues (stable IDs):

| ID | Claim | Witnesses | Evidence (arbiter) | Disposition | Authority | Correction (r2) | Status |
|---|---|---|---|---|---|---|---|
| I1 | No proof that a font-scale change updates the mounted App's theme and hook; every proof seeds the scale before startup. | plan r1 #1 (blocker), tests r1 #1 (should-fix) | Confirmed: `src/App.tsx:214-217` memo deps are `[primaryColor, spellCheck]`; `App.test.tsx:563` asserts only the initial argument. | Fix | MANDATE "make the compact/column switch follow the effective width in scaled root-em" (a switch that ignores a live scale change does not follow it) | O5 e2e adds a live change: 100 % → 200 % through the Settings slider without reload; Settings tablist turns horizontal and, after in-app navigation, the grid panes are stacked. | open → r2 |
| I2 | The promised WebKitGTK proof (`pnpm verify:app`) cannot run as written. | plan r1 #2 (blocker), tests r1 #2 (should-fix) | Confirmed: `scripts/verify-app.mjs:433` parses only `--screenshot`; `scripts/app-driver.mjs:168` `startCompositor({ width, height })` and `Session.call`/`/execute/sync` (`:250-305`) are exported. | Fix | Not a new mechanism (a scratch probe on the existing harness; nothing committed). | O5's real-webview item is a one-off scratch probe on `scripts/app-driver.mjs` exports: font-size 200 then 100, innerWidth in [801, 1599], tablist `aria-orientation` horizontal / vertical; fails on revert. | open → r2 |
| I3 | O4's two `ui:boundary:check` rules serve no MANDATE obligation the behavioural proofs cannot; the `useMediaQuery` ban is overbroad. | minimalism r1 #1 (should-fix) | Confirmed: `~/.claude/references/push-review-policy.md:427-436` "Proof selection before custom source verification" applies equally to extending an existing checker. | Fix (withdraw mechanism) | — (removal) | O4 withdrawn; D4 removed; the two checker files leave Phase 1's file list and proof. | open → r2 |
| I4 | O2 does not state subscription-failure semantics (Mantine silently keeps `false`). | error-handling r1 #1 (should-fix) | Confirmed: `@mantine/hooks/esm/use-media-query/use-media-query.mjs:19-34` catches a `matchMedia` throw and keeps the initial value. | Fix | Not a new mechanism (states existing behaviour). | O2 gains a "Failure semantics" paragraph: always a well-formed finite-em query; on missing/throwing `matchMedia` the hook reports `false` exactly as today; no diagnostic added, deliberately. | open → r2 |

Adopted plan-level corrections r1: 4 (I1–I4). Carried: none. Skipped: none. Deferred: none.
Out-of-area filing during Locate (before r1): inbox entry
`20261008-091923-1457949-1791443963092296318-6.md` (persisted font scale not range-checked;
`frontend-state`, `inline`); not a plan issue.

### Round 2 — r2 (closure round: review-plan + witnesses review-minimalism, review-tests, review-error-handling; elapsed 285 s wall; adopted 2)

Raw verdicts: plan REVISE · minimalism APPROVED · tests APPROVED · error-handling APPROVED.

Raw findings (verbatim):

**lens-plan-r2:**

```text
I1 CLOSED — r2 O5:166 adds a slider-driven change without reload and checks Settings plus the grid. This exercises the missing dependency in `src/App.tsx:214` (confidence: 98).

I2 CLOSED — r2 O5:179 replaces the ineffective command with a scratch probe using the existing exports at `scripts/app-driver.mjs:168,250,291,304`, with discriminating viewport and orientation assertions (confidence: 95).

I3 CLOSED — r2 O4:141 withdraws the source restrictions, and Phase 1:257 removes the checker changes (confidence: 100).

[should-fix] tasks/plans/.plan-2026-10-08-font-scaled-breakpoints.md-r2.body.md:128 — I4 NOT CLOSED. Mantine does not always report initial `false` after setup failure. Its catch leaves state unchanged after a query change, and listener registration happens after `setMatches(mediaQuery.matches)`. Evidence: `/home/felixb/Projekte/chessfable/node_modules/@mantine/hooks/esm/use-media-query/use-media-query.mjs:4,25`. State the actual retained-result behavior and whether that degradation is intentional (confidence: 100).

[blocker] tasks/plans/.plan-2026-10-08-font-scaled-breakpoints.md-r2.body.md:257 — Phase 1 omits `src/components/files/FilesPage.test.tsx`. Its atom mock exposes no `fontSizeAtom` (`:25,51`), its Jotai mock exposes only `useAtom` (`:45`), and it renders the real FilesPage (`:313`). O2 introduces an atom-reading hook into that render path, so the required Vitest proof cannot pass with these mocks unchanged. Add this test file and its mock updates to the phase’s write set (confidence: 99).

[should-fix] tasks/plans/2026-10-08-font-scaled-breakpoints.md:287 — The supplied `Full record:` lookup path is empty, despite the required history field in `/home/felixb/.claude/references/review-lens-contract.md:137`. The complete record was accessible through the full-plan path named in DELTA. Include that path explicitly in subsequent review packets (confidence: 100).

VERDICT: REVISE```

**lens-minimalism-r2:**

```text
I3 CLOSED — r2 withdraws O4, removes D4, and drops both checker files from Phase 1. The remaining shared hook serves two existing callers. No new bloat or duplication findings in the revised obligations.

VERDICT: APPROVED```

**lens-tests-r2:**

```text
I1 CLOSED — O5’s slider-driven, no-reload test would fail on the grid-stacking assertion if App’s theme memo omitted the font-scale dependency.
I2 CLOSED — O5 now uses the exported WebDriver harness with a discriminating viewport range. Reverting the scaled Settings query would fail the 200% horizontal-orientation assertion.
VERDICT: APPROVED```

**lens-error-handling-r2:**

```text
[should-fix] I4 NOT CLOSED — O2 specifies a fallback that Mantine does not guarantee.

[should-fix] tasks/plans/.plan-2026-10-08-font-scaled-breakpoints.md-r2.body.md:128 — Mantine’s catch does not reset `matches` to `false`. If a live font-scale change causes `matchMedia` to throw, the hook retains its previous boolean. If listener attachment fails, it retains the newly sampled boolean but stops tracking viewport changes. Settings’ orientation/CSS and Files’ fullscreen state can therefore remain compact or become stale, without diagnostics. The cited Mantine source establishes these outcomes directly. Specify whether retaining that silent degradation is intentional, or require the stated wide-layout fallback (confidence: 99).

VERDICT: APPROVED```

Closures: I1 CLOSED (plan r2, tests r2) · I2 CLOSED (plan r2, tests r2) · I3 CLOSED (plan r2,
minimalism r2). I4 NOT CLOSED (plan r2 #1, error-handling r2 #1/#2) — residual keeps ID I4.

| ID | Claim | Witnesses | Evidence (arbiter) | Disposition | Authority | Correction (r3) | Status |
|---|---|---|---|---|---|---|---|
| I4 (residual) | The r2 failure-semantics text is wrong: Mantine's catch keeps the previous result after a query change, and a failed listener attachment keeps the sampled value untracked; it does not always report `false`. | plan r2 #1 (should-fix), error-handling r2 #1, #2 (should-fix) | Confirmed: `use-media-query.mjs:4-11` (`attachMediaListener`), `:25-33` (`setMatches` before attach; catch returns `undefined` without resetting). | Fix | Not a new mechanism (corrects the statement of inherited behaviour). | O2 "Failure semantics" rewritten to the actual retained-result behaviour, stated as deliberately kept (today's behaviour; a fallback would be a mechanism without MANDATE obligation). | open → r3 |
| I5 | Phase 1's write set omits `src/components/files/FilesPage.test.tsx`, whose `jotai` mock exposes only `useAtom` and whose `@/state/atoms` mock has no `fontSizeAtom`; the Vitest proof cannot pass once FilesPage calls O2's hook. | plan r2 #2 (blocker) | Confirmed: `FilesPage.test.tsx:25` (`stateAtoms` = two atoms), `:45-50` (`jotai` mock = `useAtom` only), `:51`. | Fix | Not a new mechanism (phase write set). | Phase 1 file list names `FilesPage.test.tsx` and the mock obligation. | open → r3 |
| I6 | The r2 packet's `Full record:` lookup path was empty. | plan r2 #3 (should-fix) | Confirmed: the orchestrator's `sed` used `#` as delimiter, so `## Reviews in <path>` was cut (`inputs-r2.txt`). Packet defect, not a plan defect. | Fix (packet) | — | r3 packets carry the full-record path explicitly (built without `sed`). | open → r3 |

Adopted plan-level corrections r2: 2 (I4 residual, I5). I6 is a review-packet correction, not
counted as a plan adoption.

### plan-r4.md

# Plan: responsive breakpoints follow the app font scale (f-20260927-08)

## Goal

Every width-dependent layout switch in the renderer flips at the same width *in scaled root-em*
at every app font scale, so the layout at window width W and font scale s is the layout the app
shows at W/s and 100 %. At 100 % nothing changes, by construction.

## MANDATE

Verbatim from `tasks/findings.md`, f-20260927-08:

> * **Where:** `src/components/settings/SettingsPage.tsx:126` (`useMediaQuery("(max-width: 50rem)")`), `src/components/settings/SettingsPage.module.css:60` (`@media (max-width: 50rem)`), and the Mantine `SimpleGrid cols` breakpoints at `src/components/files/FilesPage.tsx:217`, `src/components/databases/DatabasesPage.tsx:185,254`, `src/components/engines/EnginesPage.tsx:133`, `src/components/tabs/NewTabHome.tsx:241`, `src/components/engines/AddEngine.tsx:90,115`, `src/components/databases/AddDatabase.tsx:156`.
> * **Defect:** `App.tsx:209` scales the root font (`document.documentElement.style.fontSize = fontSize%`), but `rem`/`em` inside a media query resolve against the initial 16px, never the scaled root. So every breakpoint means the same pixel width at every app font scale: at 200% a 1000px window is only 31 root-em wide, yet Settings stays in its two-column layout (threshold 800px) and the grids stay multi-column, into widths the scaled content cannot fit.
> * **Evidence:** root cause 2 of `f-20260829-02` (its 2026-08-31 investigation). That run's 320px matrix never exercises it, because at 320px every breakpoint is already in its narrowest state; the f-20260829-02 plan review (2026-09-27, issue I3, lenses review-plan and review-root-cause) ruled a scale-aware breakpoint outside that finding's mandate because it changes behaviour only at other widths.
> * **Fix:** make the compact/column switch follow the effective width in scaled root-em — e.g. derive the query from `fontSizeAtom` (Mantine `useMediaQuery` re-subscribes when its query string changes, measured in `node_modules/@mantine/hooks/esm/.../use-media-query.mjs`), CSS container queries, or content-driven wrapping (`flex-basis` in rem) — and drive the CSS side from the same source.
> * **Open question:** one mechanism for all sites (atom-derived pixel query vs. container queries vs. rem flex-basis wrapping), and whether Mantine's theme breakpoints should be rewritten globally or per site.
> * **Proof:** an e2e project at e.g. 1000px / 200% font scale whose Settings and a SimpleGrid page pass `assertNothingClipped(page.locator("body"), { scrollable: "reachable" })` and switch to their compact layout.
> * **Related:** f-20260829-02 (root cause 2).

## Threat model and non-goals

Accidental input only: the user's own font-scale choice (slider 50–200 %, step 10) and window
size. No adversary. Environments that count: the Tauri webviews (WebKitGTK on Linux, WKWebView
on macOS, WebView2 on Windows) and the pinned Playwright Chromium the e2e suite runs in. A corrupt
persisted `font-size` outside the slider range is a separate, filed defect (see Risks), not a
case this plan must make sensible.

## Traced premises

Frozen at BASE `a990c06a`. Line numbers here are evidence, never instructions.

* P1 — `src/App.tsx:210-212` applies `document.documentElement.style.fontSize = \`${fontSize}%\``
  from `fontSizeAtom`; `src/App.tsx:214-217` builds the theme with
  `createAppTheme({ primaryColor, spellCheck })` inside `useMemo`.
* P2 — `src/styles/theme.ts:22-30` `createAppTheme` is documented as the "Sole application theme
  factory; settings-derived values are injected here", and sets no `breakpoints`.
  `src/components/home/StartupStorageFailure.tsx:9-12` is its only other production caller (built
  at module scope with defaults; the App, and therefore the root font scale, is not mounted there).
  Test callers: `src/App.test.tsx:563` (asserts the exact argument object),
  `src/components/settings/ColorControl.test.tsx:43`, `src/components/settings/ThemeButton.test.tsx:29`.
* P3 — `src/state/atoms.ts:271-275` `fontSizeAtom` persists `"font-size"`; default 100;
  `src/state/utils.ts:88` validates only "finite number". `FontSizeSlider.tsx:19-21` offers 50–200.
* P4 — Mantine 8.3.14 (`pnpm-lock.yaml:25`): default breakpoints xs 36em, sm 48em, md 62em,
  lg 75em, xl 88em (`@mantine/core/esm/core/MantineProvider/default-theme.mjs:70`). Responsive
  style props resolve a key to `(min-width: ${theme.breakpoints[key]})`
  (`core/Box/style-props/parse-style-props/parse-style-props.mjs:68`); SimpleGrid in its default
  `type="media"` builds its queries from the same theme values
  (`components/SimpleGrid/SimpleGridVariables.mjs:35,57`). `useMediaQuery` passes its string to
  `window.matchMedia` (`@mantine/hooks/esm/use-media-query/use-media-query.mjs:27`).
* P5 — Media-query `em`/`rem` resolve against the initial font size, not the root element's
  computed size (CSS Media Queries; the finding's evidence, measured in the f-20260829-02
  investigation). The root is set as a *percentage of that same initial size* (P1), so
  `(N × s/100)em` in a media query equals N scaled root-em for any UA default font size.
* P6 — Inventory of width switches (probe-1-r1):
  * JS media queries: `SettingsPage.tsx:127` `(max-width: 50rem)` → Tabs `orientation` at `:794`;
    `FilesPage.tsx:47` `COMPACT_DIALOG_QUERY = "(max-width: 30em)"`, used at `:67` → `AppModal
    fullScreen` at `:428`.
  * CSS: `SettingsPage.module.css:69` `@media (max-width: 50rem)` — styles `.settingsContent`,
    `.card`, `.settingsTabs`, `[role=tablist]`, `[role=tab]`, `.item`, `.settingControl`.
    `.card`/`.item` are also rendered by the search-results branch outside the Tabs
    (`SettingsPage.tsx:710,731`) and by `SettingRow` (`SettingsLayout.tsx`, used only by
    SettingsPage). The page root is the `Stack` at `SettingsPage.tsx:761`.
  * Theme-key switches (fixed by the theme alone): SimpleGrid `cols` at `AddDatabase.tsx:169`,
    `DatabasesPage.tsx:216,299`, `AddEngine.tsx:88,113`, `EnginesPage.tsx:135`,
    `UpgradeEngineModal.tsx:151`, `FilesPage.tsx:260`, `NewTabHome.tsx:241`; responsive style
    props at `DatabasesPage.tsx:217,227,281,390,410`, `FileCard.tsx:98`, `FilesPage.tsx:234,236,261,355`.
  * No `visibleFrom`/`hiddenFrom`, `Grid` breakpoint objects, `useMatches`, `matchMedia` or
    `window.innerWidth` in `src`; no other `@media`/`@container` in renderer CSS.
  * Already scale-aware, out of scope: `FileCard.tsx:22-51` compares the card width with 26 ×
    the computed root font size. `__root.tsx:273` AppShell `breakpoint: 0` (numeric px; no switch).
* P7 — e2e (probe-2-r1): `e2e/fixtures.ts:356` `fontScaleByProject` seeds
  `localStorage["font-size"]` per project (`:614`) before startup. Projects at 200 %:
  `database-files` 800×720, `accounts-puzzles-engines` 1440×900, `settings-responsive` /
  `async-errors` / `security-consent` 320×720. All others are 100 %. The finding's proof names
  `{ scrollable: "reachable" }`; the real API is `assertNothingClipped(locator, { mode:
  "reachable" })`, wrapped as `assertPageNotClipped(page)` (`e2e/fixtures.ts:72,265`).
  Snapshot path template is `{arg}-{projectName}` (`playwright.config.ts:32`); a project with
  only behavioural assertions needs no baseline. Re-recording runs only in the container
  (`pnpm test:e2e:update`) under the rule in `.claude/skills/verify-ui/SKILL.md` (`d-20260919-13`).
* P8 — `scripts/check-ui-boundaries.mjs` scans every tracked `src/**/*.{ts,tsx,css}` (tests
  excluded) line by line for one-door violations (direct `ActionIcon`/`Modal` imports, unsafe
  focus resets); `pnpm ui:boundary:check` is part of `gates:contract:check`, with its own test
  file `scripts/check-ui-boundaries-tests.mjs`.

## Approach

The defining property (O0) is zoom equivalence; everything else is the one mechanism that
delivers it and the proof that it is delivered.

### O0 — Definition of correct

Quoting the MANDATE: "make the compact/column switch follow the effective width in scaled
root-em". A switch defined at N em of width flips when the viewport is N **scaled** root-em wide,
i.e. at N × s/100 initial-em. At s = 100 every query string is byte-identical to today's, so every
100 % layout and every 100 % e2e snapshot is unchanged. This is the browser-zoom semantics
`d-20260831-16` already chose for the font scale ("scaling the whole UI is what browser zoom does").

### O1 — One scale function, applied to the theme breakpoints

"whether Mantine's theme breakpoints should be rewritten globally or per site": globally.
`createAppTheme` takes the app font scale as a required input and returns Mantine's default
breakpoint set, each value multiplied by s/100 and expressed in `em` (P5 makes `em` exact for any
UA default; a pixel value would assume 16px). One exported pure function performs the scaling and
is the only place the multiplication exists; both O1 and O2 call it. Values are deterministic,
finite em strings without floating-point noise (e.g. 110 % of 48em is `52.8em`).

* `App.tsx` passes `fontSizeAtom`'s value — the same value it writes to the root (P1) — and the
  theme memo depends on it.
* `StartupStorageFailure` passes 100 (named constant beside its existing defaults), because the
  App, and so the root scale, is never mounted there (P2).
* Consequence: every SimpleGrid `cols` object and every responsive style prop in P6's theme-key
  list follows the scale with **no per-site edit**, as will any future one.

### O2 — One hook for width queries that are not theme keys

The two JS queries in P6 (Settings 50rem, Files 30em) go through one renderer hook that takes a
max-width in em, scales it with O1's function and the current `fontSizeAtom` value, and returns
Mantine `useMediaQuery`'s boolean for the resulting query. A font-scale change re-evaluates the
query (Mantine re-subscribes when its query string changes, per the MANDATE's measurement).
`SettingsPage` and `FilesPage` call it with their existing thresholds (50 and 30); the
`COMPACT_DIALOG_QUERY` comment that documents the old fixed-pixel behaviour is replaced to state
the scaled behaviour.

Failure semantics: the hook adds no failure surface of its own; it inherits Mantine's
`useMediaQuery` exactly (`@mantine/hooks/esm/use-media-query/use-media-query.mjs:4-11,19-34`):
before its effect runs it reports `false`; if `window.matchMedia` throws, the effect's catch leaves
the state as it was — `false` on mount, or the previous result after a query change (a font-scale
change); if listener attachment fails after a successful `matchMedia`, the freshly sampled value is
kept but no longer tracks resizes. The hook always passes a well-formed `(max-width: <finite>em)`
query (O1's function returns finite em values for the atom's validated finite input), so in a
webview whose `matchMedia` accepted the previous query, the next one of the same shape is not a new
failure cause. This degradation is deliberately kept unchanged and undiagnosed: it is today's
behaviour at both call sites, every supported webview implements `matchMedia` and
`MediaQueryList.addEventListener`, and a separate fallback would be a mechanism with no MANDATE
obligation behind it.

### O3 — Settings CSS driven by the same boolean

"and drive the CSS side from the same source": the `@media (max-width: 50rem)` block in
`SettingsPage.module.css` is removed. Its rules apply instead under a compact marker that the
Settings page root (the outermost element containing both the Tabs branch and the search-results
branch, P6) carries exactly when O2's hook reports compact — the same boolean that sets the Tabs
`orientation`. No rule of the block is lost or changed; only its condition.

### O4 — (withdrawn in r2)

A `ui:boundary:check` source rule was proposed in r1 and withdrawn under issue I3: it proves no
MANDATE obligation that O5's behavioural proofs cannot, and `push-review-policy.md` "Proof
selection before custom source verification" forbids extending a source checker without one.

### O5 — Verification

* Unit (vitest): O1 — at 100 the breakpoints equal Mantine's defaults exactly; at 200 and 50 every
  value is the default × 2 / × 0.5 in em. O2 — the hook's query string at 100, 200 and 50 for 50em
  and 30em, and a font-scale change switches its result without remount (matchMedia mocked as the
  existing tests do). `App.test.tsx` asserts the new `createAppTheme` argument including the font
  scale it mocks (120 at `App.test.tsx:185`); the two theme-consuming tests pass 100.
* e2e (the MANDATE's proof): a new behaviour-only Playwright project at **1000×720, 200 %**
  (registered in `playwright.config.ts` and `fontScaleByProject`) with no screenshot assertion.
  It proves, on Settings and on one SimpleGrid page (the Databases list/details grid, or the Files
  tree/entry grid if the Databases mock cannot render both panes):
  * at 200 %: Settings' tablist orientation is horizontal and the compact marker is present; the
    grid's two panes are stacked (second pane starts below the first); `assertPageNotClipped(page)`
    holds on both pages;
  * O3's compact CSS, on both branches that render setting rows: at 200 % a setting row's control
    sits below its copy (the compact column layout) both in an open tab panel and in the
    search-results list (a search query typed into Settings' search field); at 100 % (next bullet)
    the same rows have control and copy side by side;
  * at 100 % at the same 1000px (font scale overridden per test before startup): Settings' tablist
    is vertical and the grid's panes sit side by side — proving the switch is scale-driven and the
    100 % layout unchanged;
  * at 50 % at 700px: Settings' tablist is vertical (an unscaled 800px threshold would make it
    horizontal) — the other direction of the same defect;
  * live change, no reload: starting at 100 % at 1000px, the font scale is set to 200 % through
    the Settings font-size slider (its real `onChangeEnd` path), after which Settings' tablist is
    horizontal and, navigating in-app (no reload) to the grid page, its panes are stacked —
    proving the mounted App rebuilds its theme and the hook re-evaluates when the atom changes,
    not only at startup.
* Existing snapshots: by O0, no snapshot of a 100 % project and none of a 320px project can move
  (at 320px every switch is already in its narrowest state, before and after). Snapshots of the two
  wider 200 % projects (`database-files`, `accounts-puzzles-engines`) whose captured surface holds a
  P6 grid or style prop **are expected to move** to their stacked/narrow form. They are re-recorded
  under the verify-ui rule: run `pnpm test:e2e:container` first, inspect every `*-diff.png`, accept
  only differences that are the predicted column/compact switch, re-record with
  `pnpm test:e2e:update`, and stop if any snapshot outside those two projects moves. Every moved
  snapshot is named in the commit message.
* Real webview (step 7, verify-ui): `pnpm verify:app` cannot do this as it stands — its only
  option is `--screenshot` (`scripts/verify-app.mjs:433`) and it checks no layout. The verify-ui
  leaf instead runs a **one-off scratch probe** (written under the run's `RUN_TMP`, never
  committed — observation, not a new tool) on the exported harness of `scripts/app-driver.mjs`
  (`startCompositor`, `startDriver`, `Session` with `call` / `/execute/sync`), as recorded practice
  for real-app flows. Against the release binary in WebKitGTK it sets `localStorage["font-size"]`
  to 200, reloads, opens Settings, reads `window.innerWidth` and the tablist's `aria-orientation`,
  then repeats at 100. Pass requires: innerWidth in [801, 1599] (so the outcome discriminates the
  unscaled 800px threshold from the scaled 1600px one), orientation `horizontal` at 200 and
  `vertical` at 100. With unscaled breakpoints the 200 % reading would be `vertical`, so the probe
  fails on revert.

## Decisions and trade-offs

* **Mechanism: scaled theme breakpoints + one scaled hook (chosen)** — the MANDATE's open question.
  Contested alternatives are under `## Decided autonomously` (D1).
* **Global, not per site** (D2).
* **Zoom equivalence as the definition** (D3), which is what makes "nothing changes at 100 %" a
  structural guarantee instead of a test hope.

## Decided autonomously

Run is `full auto`; each entry is recorded in `tasks/decisions.md` by the adopting session.

* **D1 — Which single mechanism makes every width switch follow the app font scale?**
  * Chosen: scale Mantine's theme breakpoints in `createAppTheme` by the font scale (em), plus one
    hook that scales the two non-theme JS queries with the same function; Settings' CSS keyed on
    that hook's boolean.
  * Rejected: CSS container queries — they answer a different question (the component's box, not
    the window), so every threshold also moves at 100 % (Settings' content box is narrower than the
    viewport by the nav rail), SimpleGrid's `type="container"` takes literal width keys and a
    wrapper per grid instead of theme keys (P4), and Settings' Tabs `orientation` is a React prop
    no CSS query can set. Rejected: content-driven wrapping (`auto-fill`/`flex-basis` in rem) —
    rewrites every grid and changes every 100 % layout, and cannot express the Tabs orientation.
    Rejected: an atom-derived pixel query — assumes a 16px UA default; a scaled `em` value is exact
    for any default (P5).
  * Because: one source of truth for theme keys, JS and CSS; zero per-site edits for the nine grids
    and eleven responsive props; byte-identical queries at 100 %.
* **D2 — Rewrite the theme breakpoints globally or per site?** Chosen: globally, in the sole theme
  factory. Rejected: per-site scaled objects — nine grid sites and eleven style-prop sites carrying
  a copy of the same arithmetic (rule 11), and every future grid silently unscaled again.
* **D3 — What does "correct" mean for a width switch under the font scale?** Chosen: zoom
  equivalence (O0). Rejected: tuning each threshold per scale by eye — no oracle, and contradicts
  `d-20260831-16`'s zoom framing.
* **D5 — Which scale does `StartupStorageFailure` use?** Chosen: 100, because it renders without
  the App and the root font is unscaled there. Rejected: reading the persisted scale — that screen
  exists because storage failed.

## Risks / open questions

* The first render of a `useMediaQuery` consumer reports `false` until its effect runs (Mantine's
  `getInitialValueInEffect` default); unchanged from today, not introduced here.
* Changing the font scale now rebuilds the theme object, re-rendering the provider tree once per
  slider release (`onChangeEnd`). Acceptable: it is a settings action, and the root font change
  already reflows the whole app.
* A corrupt persisted `font-size` (≤ 0 or far outside 50–200) is not range-checked today; the
  breakpoints scale by the same value the root uses, so this plan adds no mismatch for any value
  CSS accepts. Filed separately while locating: inbox entry
  `20261008-091923-1457949-1791443963092296318-6.md` ("The persisted app font scale is accepted at
  any finite value…", area `frontend-state`, entry `inline`).
* Committed snapshots of `database-files` and `accounts-puzzles-engines` move (O5). The prediction
  is the gate: a moved snapshot outside them is a regression to fix, never to re-record.

## Not part of this task

* f-20260927-09 (title-bar menu at 320px / 200 %) — separate finding, different files.
* `FileCard`'s preview switch — already scale-aware (P6).
* Layout of grids inside modals relative to the modal's own width — viewport-relative today and
  after; not the MANDATE's defect.
* Range validation of the persisted font scale — filed (Risks).

## Phases

Two phases, in dependency order (phase 2's assertions need phase 1's behaviour). Neither touches
auth, persistence, concurrency or an IPC/API contract; no file matches a Sensitive-Path glob.

### Phase 1 — Scaled breakpoints, hook, Settings CSS, moved snapshots

* Files: `src/styles/theme.ts`, `src/App.tsx`, `src/components/home/StartupStorageFailure.tsx`,
  `src/components/home/StartupStorageFailure.test.tsx` (asserts the exact old `createAppTheme`
  argument object),
  one new hook module under `src/hooks/` (plus its test), `src/components/settings/SettingsPage.tsx`,
  `src/components/settings/SettingsPage.module.css`, `src/components/files/FilesPage.tsx`,
  `src/components/files/FilesPage.test.tsx` (its `jotai` and `@/state/atoms` mocks must expose
  whatever O2's hook reads — today they expose only `useAtom` and no `fontSizeAtom`), unit tests for O1
  (theme) and the updated `src/App.test.tsx`, `ColorControl.test.tsx`, `ThemeButton.test.tsx`;
  the re-recorded PNGs under `e2e/database-files.spec.ts-snapshots/` and
  `e2e/accounts-puzzles-engines.spec.ts-snapshots/` (only those the container run shows moved).
* Obligations: O1, O2, O3, O5 unit and snapshot parts.
* Role: `normal`.
* Proof:
  1. `pnpm vitest run src/styles src/hooks src/App.test.tsx src/components/settings src/components/files src/components/home/StartupStorageFailure.test.tsx`
  2. `pnpm checks:pre-review`
  3. `pnpm test:e2e:container` — before re-recording, its only failures are snapshot mismatches in
     `database-files` / `accounts-puzzles-engines`; the leaf reports each with its diff path and
     stops. The orchestrator inspects every diff; on a resume the leaf runs `pnpm test:e2e:update`,
     then `git status --porcelain e2e/` must list only predicted PNGs, and a second
     `pnpm test:e2e:container` is green.

### Phase 2 — Font-scale breakpoint e2e project

* Files: `playwright.config.ts`, `e2e/fixtures.ts` (`fontScaleByProject` entry), one new spec
  under `e2e/`.
* Obligations: O5 e2e part. No screenshot assertion, so no baseline.
* Role: `normal`.
* Proof:
  1. `pnpm test:e2e:container --project=<new project>` green.
  2. Revert check, run by the orchestrator on a scratch copy of the tree: with O1's scale function
     forced to return the unscaled value, the new project goes red on the 200 % and 50 %
     assertions.
  3. `pnpm checks:pre-review`

## Reviews

### Round 1 — r1 (12 lenses, every plan-capable lens; elapsed 289 s wall; adopted 4)

Lens set: review-plan (`--role review-plan`), and at `--role normal` (no Sensitive-Path glob in
the plan's files): review-minimalism, review-correctness, review-tests, review-error-handling,
review-chess-semantics, review-engine-protocol, review-ipc-contract, review-persisted-state,
review-pgn-index, review-platform-semantics, review-tauri-security. Executor: codex (OpenAI high
tier). Not run: review-code-quality, review-root-cause (`plan-review: false`).

Raw verdicts: plan REVISE · minimalism REVISE · correctness APPROVED · tests APPROVED ·
error-handling APPROVED · chess-semantics APPROVED (NOT APPLICABLE) · engine-protocol APPROVED
(NOT APPLICABLE) · ipc-contract APPROVED (NOT APPLICABLE) · persisted-state APPROVED (NOT
APPLICABLE) · pgn-index APPROVED (NOT APPLICABLE) · platform-semantics APPROVED (NOT APPLICABLE) ·
tauri-security APPROVED (NOT APPLICABLE). NOT APPLICABLE reasons checked by the arbiter: each
names only chess trees, engines, IPC, storage encoding/hydration, PGN, OS/FFI or credential
surfaces; the plan reads `fontSizeAtom` without changing its storage, and touches none of the
others — correct.

Raw findings (verbatim):

**lens-plan-r1:**

```text
[blocker] tasks/plans/2026-10-08-font-scaled-breakpoints.md:144 — O5 does not prove that changing the font scale updates the mounted App’s theme. The proposed App test checks only initial arguments (`src/App.test.tsx:560`), and the e2e cases seed each scale before startup. A theme cached at the initial scale could pass these proofs while grids remain unchanged after a slider adjustment. This integration matters because the current theme memo excludes font size (`src/App.tsx:214`). Require a mounted-app scale change that verifies the grid switches without reloading. (confidence: 97)

[blocker] tasks/plans/2026-10-08-font-scaled-breakpoints.md:169 — The promised WebKitGTK proof cannot run as written. `pnpm verify:app` invokes `scripts/verify-app.mjs` (`package.json:78`), whose only parsed option is `--screenshot` (`scripts/verify-app.mjs:433`). It contains no font-scale, Settings orientation, or window-resizing check and starts the compositor with default dimensions (`scripts/verify-app.mjs:1064`, `scripts/app-driver.mjs:168`). Neither phase includes changes to that verifier. Specify an executable real-app probe or include the necessary verifier extension so this command can actually reject incorrect breakpoint behavior. (confidence: 100)

VERDICT: REVISE```

**lens-minimalism-r1:**

```text
[should-fix] tasks/plans/2026-10-08-font-scaled-breakpoints.md:133 — O4 adds two renderer-wide source restrictions without identifying a mandate obligation that O1–O3 and O5 cannot satisfy. Its blanket `useMediaQuery` import ban also covers unrelated features such as `prefers-reduced-motion`. The shared push-review policy’s “Proof selection before custom source verification” requires an uncovered obligation and an explanation of why behavioral checks cannot prove it, even when extending an existing checker. The smallest sufficient plan retains the shared scaling function, two-caller hook, Settings marker and behavioral proofs, while removing O4 and all changes to the two boundary-checker files. This preserves mandate coverage and removes an entire tooling obligation (confidence: 95).

VERDICT: REVISE```

**lens-correctness-r1:**

```text
No correctness defects found in O0–O5. At 1000px/200%, Settings’ threshold becomes 1600px and the grid’s `sm` threshold becomes 1536px, producing horizontal tabs and stacked panes. At 100%, both retain their existing layout.

Limitation: implementation and browser behavior remain unverified in this plan-only review (confidence: 100).

VERDICT: APPROVED```

**lens-tests-r1:**

```text
[should-fix] tasks/plans/2026-10-08-font-scaled-breakpoints.md:147 — No proposed assertion exercises App’s theme update after changing font scale without remounting. Omitting `fontSize` from the theme memo dependencies would pass the factory tests, initial App argument assertion, isolated hook test and startup-seeded e2e cases. Add a live scale-change test that asserts the grid changes columns. (confidence: 98)

[should-fix] tasks/plans/2026-10-08-font-scaled-breakpoints.md:169 — The named `pnpm verify:app` command runs `scripts/verify-app.mjs`, which neither seeds 200% font scale nor asserts Settings’ orientation. No phase adds that check or names a runnable custom probe. The claimed WebKitGTK proof would therefore miss fixed breakpoints. Specify the probe and its failing-on-revert orientation assertion. (confidence: 99)

VERDICT: APPROVED```

**lens-error-handling-r1:**

```text
[should-fix] tasks/plans/2026-10-08-font-scaled-breakpoints.md:119 — O2 leaves subscription-failure semantics unspecified. Mantine catches media-query setup failures silently, returning false initially or retaining the previous result after a query change. O3 would then apply wide or stale Settings styles without any diagnostic. State whether this fallback is intentional and how failure should surface. (confidence: 94)

VERDICT: APPROVED```

Issues (stable IDs):

| ID | Claim | Witnesses | Evidence (arbiter) | Disposition | Authority | Correction (r2) | Status |
|---|---|---|---|---|---|---|---|
| I1 | No proof that a font-scale change updates the mounted App's theme and hook; every proof seeds the scale before startup. | plan r1 #1 (blocker), tests r1 #1 (should-fix) | Confirmed: `src/App.tsx:214-217` memo deps are `[primaryColor, spellCheck]`; `App.test.tsx:563` asserts only the initial argument. | Fix | MANDATE "make the compact/column switch follow the effective width in scaled root-em" (a switch that ignores a live scale change does not follow it) | O5 e2e adds a live change: 100 % → 200 % through the Settings slider without reload; Settings tablist turns horizontal and, after in-app navigation, the grid panes are stacked. | open → r2 |
| I2 | The promised WebKitGTK proof (`pnpm verify:app`) cannot run as written. | plan r1 #2 (blocker), tests r1 #2 (should-fix) | Confirmed: `scripts/verify-app.mjs:433` parses only `--screenshot`; `scripts/app-driver.mjs:168` `startCompositor({ width, height })` and `Session.call`/`/execute/sync` (`:250-305`) are exported. | Fix | Not a new mechanism (a scratch probe on the existing harness; nothing committed). | O5's real-webview item is a one-off scratch probe on `scripts/app-driver.mjs` exports: font-size 200 then 100, innerWidth in [801, 1599], tablist `aria-orientation` horizontal / vertical; fails on revert. | open → r2 |
| I3 | O4's two `ui:boundary:check` rules serve no MANDATE obligation the behavioural proofs cannot; the `useMediaQuery` ban is overbroad. | minimalism r1 #1 (should-fix) | Confirmed: `~/.claude/references/push-review-policy.md:427-436` "Proof selection before custom source verification" applies equally to extending an existing checker. | Fix (withdraw mechanism) | — (removal) | O4 withdrawn; D4 removed; the two checker files leave Phase 1's file list and proof. | open → r2 |
| I4 | O2 does not state subscription-failure semantics (Mantine silently keeps `false`). | error-handling r1 #1 (should-fix) | Confirmed: `@mantine/hooks/esm/use-media-query/use-media-query.mjs:19-34` catches a `matchMedia` throw and keeps the initial value. | Fix | Not a new mechanism (states existing behaviour). | O2 gains a "Failure semantics" paragraph: always a well-formed finite-em query; on missing/throwing `matchMedia` the hook reports `false` exactly as today; no diagnostic added, deliberately. | open → r2 |

Adopted plan-level corrections r1: 4 (I1–I4). Carried: none. Skipped: none. Deferred: none.
Out-of-area filing during Locate (before r1): inbox entry
`20261008-091923-1457949-1791443963092296318-6.md` (persisted font scale not range-checked;
`frontend-state`, `inline`); not a plan issue.

### Round 2 — r2 (closure round: review-plan + witnesses review-minimalism, review-tests, review-error-handling; elapsed 285 s wall; adopted 2)

Raw verdicts: plan REVISE · minimalism APPROVED · tests APPROVED · error-handling APPROVED.

Raw findings (verbatim):

**lens-plan-r2:**

```text
I1 CLOSED — r2 O5:166 adds a slider-driven change without reload and checks Settings plus the grid. This exercises the missing dependency in `src/App.tsx:214` (confidence: 98).

I2 CLOSED — r2 O5:179 replaces the ineffective command with a scratch probe using the existing exports at `scripts/app-driver.mjs:168,250,291,304`, with discriminating viewport and orientation assertions (confidence: 95).

I3 CLOSED — r2 O4:141 withdraws the source restrictions, and Phase 1:257 removes the checker changes (confidence: 100).

[should-fix] tasks/plans/.plan-2026-10-08-font-scaled-breakpoints.md-r2.body.md:128 — I4 NOT CLOSED. Mantine does not always report initial `false` after setup failure. Its catch leaves state unchanged after a query change, and listener registration happens after `setMatches(mediaQuery.matches)`. Evidence: `/home/felixb/Projekte/chessfable/node_modules/@mantine/hooks/esm/use-media-query/use-media-query.mjs:4,25`. State the actual retained-result behavior and whether that degradation is intentional (confidence: 100).

[blocker] tasks/plans/.plan-2026-10-08-font-scaled-breakpoints.md-r2.body.md:257 — Phase 1 omits `src/components/files/FilesPage.test.tsx`. Its atom mock exposes no `fontSizeAtom` (`:25,51`), its Jotai mock exposes only `useAtom` (`:45`), and it renders the real FilesPage (`:313`). O2 introduces an atom-reading hook into that render path, so the required Vitest proof cannot pass with these mocks unchanged. Add this test file and its mock updates to the phase’s write set (confidence: 99).

[should-fix] tasks/plans/2026-10-08-font-scaled-breakpoints.md:287 — The supplied `Full record:` lookup path is empty, despite the required history field in `/home/felixb/.claude/references/review-lens-contract.md:137`. The complete record was accessible through the full-plan path named in DELTA. Include that path explicitly in subsequent review packets (confidence: 100).

VERDICT: REVISE```

**lens-minimalism-r2:**

```text
I3 CLOSED — r2 withdraws O4, removes D4, and drops both checker files from Phase 1. The remaining shared hook serves two existing callers. No new bloat or duplication findings in the revised obligations.

VERDICT: APPROVED```

**lens-tests-r2:**

```text
I1 CLOSED — O5’s slider-driven, no-reload test would fail on the grid-stacking assertion if App’s theme memo omitted the font-scale dependency.
I2 CLOSED — O5 now uses the exported WebDriver harness with a discriminating viewport range. Reverting the scaled Settings query would fail the 200% horizontal-orientation assertion.
VERDICT: APPROVED```

**lens-error-handling-r2:**

```text
[should-fix] I4 NOT CLOSED — O2 specifies a fallback that Mantine does not guarantee.

[should-fix] tasks/plans/.plan-2026-10-08-font-scaled-breakpoints.md-r2.body.md:128 — Mantine’s catch does not reset `matches` to `false`. If a live font-scale change causes `matchMedia` to throw, the hook retains its previous boolean. If listener attachment fails, it retains the newly sampled boolean but stops tracking viewport changes. Settings’ orientation/CSS and Files’ fullscreen state can therefore remain compact or become stale, without diagnostics. The cited Mantine source establishes these outcomes directly. Specify whether retaining that silent degradation is intentional, or require the stated wide-layout fallback (confidence: 99).

VERDICT: APPROVED```

Closures: I1 CLOSED (plan r2, tests r2) · I2 CLOSED (plan r2, tests r2) · I3 CLOSED (plan r2,
minimalism r2). I4 NOT CLOSED (plan r2 #1, error-handling r2 #1/#2) — residual keeps ID I4.

| ID | Claim | Witnesses | Evidence (arbiter) | Disposition | Authority | Correction (r3) | Status |
|---|---|---|---|---|---|---|---|
| I4 (residual) | The r2 failure-semantics text is wrong: Mantine's catch keeps the previous result after a query change, and a failed listener attachment keeps the sampled value untracked; it does not always report `false`. | plan r2 #1 (should-fix), error-handling r2 #1, #2 (should-fix) | Confirmed: `use-media-query.mjs:4-11` (`attachMediaListener`), `:25-33` (`setMatches` before attach; catch returns `undefined` without resetting). | Fix | Not a new mechanism (corrects the statement of inherited behaviour). | O2 "Failure semantics" rewritten to the actual retained-result behaviour, stated as deliberately kept (today's behaviour; a fallback would be a mechanism without MANDATE obligation). | open → r3 |
| I5 | Phase 1's write set omits `src/components/files/FilesPage.test.tsx`, whose `jotai` mock exposes only `useAtom` and whose `@/state/atoms` mock has no `fontSizeAtom`; the Vitest proof cannot pass once FilesPage calls O2's hook. | plan r2 #2 (blocker) | Confirmed: `FilesPage.test.tsx:25` (`stateAtoms` = two atoms), `:45-50` (`jotai` mock = `useAtom` only), `:51`. | Fix | Not a new mechanism (phase write set). | Phase 1 file list names `FilesPage.test.tsx` and the mock obligation. | open → r3 |
| I6 | The r2 packet's `Full record:` lookup path was empty. | plan r2 #3 (should-fix) | Confirmed: the orchestrator's `sed` used `#` as delimiter, so `## Reviews in <path>` was cut (`inputs-r2.txt`). Packet defect, not a plan defect. | Fix (packet) | — | r3 packets carry the full-record path explicitly (built without `sed`). | open → r3 |

Adopted plan-level corrections r2: 2 (I4 residual, I5). I6 is a review-packet correction, not
counted as a plan adoption.

### Round 3 — r3 (closure round: review-plan + review-error-handling (I4) + review-tests (affected by I5's test-file change); elapsed 144 s wall; adopted 3)

Raw verdicts: plan REVISE · tests REVISE · error-handling APPROVED.

Raw findings (verbatim):

**lens-plan-r3:**

```text
I4 CLOSED — r3:125–136 correctly states Mantine’s retained-result behavior and intentionally preserves it. Confirmed in `/home/felixb/Projekte/chessfable/node_modules/@mantine/hooks/esm/use-media-query/use-media-query.mjs:22–34` (confidence: 100).

I5 CLOSED — r3:257–258 adds `FilesPage.test.tsx` and its mock updates, addressing the incomplete mocks at `src/components/files/FilesPage.test.tsx:25,45–51` (confidence: 100).

I6 CLOSED — this packet supplies the full-record path, whose Reviews section exists at `tasks/plans/2026-10-08-font-scaled-breakpoints.md:286` (confidence: 100).

[blocker] tasks/plans/.plan-2026-10-08-font-scaled-breakpoints.md-r3.body.md:262 — Phase 1 requires O3, but the r3 delta deletes that obligation entirely. Its contract required replacing the fixed CSS query while preserving every compact rule and covering both Tabs and search results. Those consumers remain at `src/components/settings/SettingsPage.module.css:69–104` and `src/components/settings/SettingsPage.tsx:731,784`. Restore O3 so the mandate’s shared JS/CSS condition remains an explicit obligation (confidence: 100).

[blocker] tasks/plans/.plan-2026-10-08-font-scaled-breakpoints.md-r3.body.md:254 — Phase 1 omits another affected consumer, `src/components/home/StartupStorageFailure.test.tsx`. O1 adds the required font-scale argument to StartupStorageFailure’s theme call, but this test asserts the exact old argument object at `src/components/home/StartupStorageFailure.test.tsx:130–133`. That assertion will fail, and the narrow Vitest command at plan:265 excludes the home directory. Add this file, update its expectation, and include it in the proof (confidence: 100).

VERDICT: REVISE```

**lens-tests-r3:**

```text
[blocker] tasks/plans/.plan-2026-10-08-font-scaled-breakpoints.md-r3.body.md:155 — R3 deletes O3, while the remaining Settings proof asserts tab orientation, marker presence and clipping, without asserting compact CSS reflow or exercising search results. Restricting the compact styles to the Tabs subtree would leave search-result rows unscaled and pass the named proofs, which never render that branch. Restore the CSS obligation and name a browser assertion that checks compact row geometry in search results at 1000px/200%, with the 100% comparison. (confidence: 96)

VERDICT: REVISE```

**lens-error-handling-r3:**

```text
I4 CLOSED — O2 now matches Mantine’s source: `matchMedia` failure retains false on mount or the previous result after a query change. Failed listener attachment retains the sampled value without resize tracking. The plan explicitly accepts this undiagnosed degradation (confidence: 99).

VERDICT: APPROVED```

Closures: I4 CLOSED (plan r3, error-handling r3) · I5 CLOSED (plan r3) · I6 CLOSED (plan r3).

| ID | Claim | Witnesses | Evidence (arbiter) | Disposition | Authority | Correction (r4) | Status |
|---|---|---|---|---|---|---|---|
| I7 (lineage: I4) | The r3 revision deleted O3 (Settings CSS driven by the same boolean) entirely. Correction-introduced: the I4 rewrite replaced the text from O2's failure paragraph up to the O4 heading, and O3 sat in between. | plan r3 #1 (blocker), tests r3 #1 (blocker, first half) | Confirmed: `plan-r3.md` has no `### O3`; the r3 delta lists no O3 heading. | Fix | Restores r1 content (MANDATE "drive the CSS side from the same source"). | O3 restored byte-identical to r1 (checked with `diff` of the O3 section against `plan-r1.md`). | open → r4 |
| I8 | Phase 1 omits `src/components/home/StartupStorageFailure.test.tsx`, which asserts the exact old `createAppTheme` argument; the vitest proof excludes `src/components/home`. | plan r3 #2 (blocker) | Confirmed: `StartupStorageFailure.test.tsx:130-133` (`toHaveBeenCalledExactlyOnceWith({ primaryColor: "blue", spellCheck: false })`). All four test callers of `createAppTheme` now listed (grep: App.test, ThemeButton.test, ColorControl.test, StartupStorageFailure.test). | Fix | Not a new mechanism (phase write set and proof). | Phase 1 file list adds the file; proof 1 adds it to the vitest command. | open → r4 |
| I9 | No proof exercises O3's compact CSS, and none renders the search-results branch; a marker placed on the Tabs subtree only would pass. | tests r3 #1 (blocker, second half) | Confirmed: O5 asserted orientation, marker presence and clipping only; `SettingsPage.tsx:693-731` renders search results outside the Tabs. | Fix | MANDATE "drive the CSS side from the same source" (O3) — verification of an existing obligation, no new mechanism. | O5 e2e adds: at 1000px/200 % a setting row's control sits below its copy in an open tab panel and in the search-results list; at 1000px/100 % the same rows are side by side. | open → r4 |

Adopted plan-level corrections r3: 3 (I7, I8, I9).

### plan-r5.md

# Plan: responsive breakpoints follow the app font scale (f-20260927-08)

## Goal

Every width-dependent layout switch in the renderer flips at the same width *in scaled root-em*
at every app font scale, so the layout at window width W and font scale s is the layout the app
shows at W/s and 100 %. At 100 % nothing changes, by construction.

## MANDATE

Verbatim from `tasks/findings.md`, f-20260927-08:

> * **Where:** `src/components/settings/SettingsPage.tsx:126` (`useMediaQuery("(max-width: 50rem)")`), `src/components/settings/SettingsPage.module.css:60` (`@media (max-width: 50rem)`), and the Mantine `SimpleGrid cols` breakpoints at `src/components/files/FilesPage.tsx:217`, `src/components/databases/DatabasesPage.tsx:185,254`, `src/components/engines/EnginesPage.tsx:133`, `src/components/tabs/NewTabHome.tsx:241`, `src/components/engines/AddEngine.tsx:90,115`, `src/components/databases/AddDatabase.tsx:156`.
> * **Defect:** `App.tsx:209` scales the root font (`document.documentElement.style.fontSize = fontSize%`), but `rem`/`em` inside a media query resolve against the initial 16px, never the scaled root. So every breakpoint means the same pixel width at every app font scale: at 200% a 1000px window is only 31 root-em wide, yet Settings stays in its two-column layout (threshold 800px) and the grids stay multi-column, into widths the scaled content cannot fit.
> * **Evidence:** root cause 2 of `f-20260829-02` (its 2026-08-31 investigation). That run's 320px matrix never exercises it, because at 320px every breakpoint is already in its narrowest state; the f-20260829-02 plan review (2026-09-27, issue I3, lenses review-plan and review-root-cause) ruled a scale-aware breakpoint outside that finding's mandate because it changes behaviour only at other widths.
> * **Fix:** make the compact/column switch follow the effective width in scaled root-em — e.g. derive the query from `fontSizeAtom` (Mantine `useMediaQuery` re-subscribes when its query string changes, measured in `node_modules/@mantine/hooks/esm/.../use-media-query.mjs`), CSS container queries, or content-driven wrapping (`flex-basis` in rem) — and drive the CSS side from the same source.
> * **Open question:** one mechanism for all sites (atom-derived pixel query vs. container queries vs. rem flex-basis wrapping), and whether Mantine's theme breakpoints should be rewritten globally or per site.
> * **Proof:** an e2e project at e.g. 1000px / 200% font scale whose Settings and a SimpleGrid page pass `assertNothingClipped(page.locator("body"), { scrollable: "reachable" })` and switch to their compact layout.
> * **Related:** f-20260829-02 (root cause 2).

## Threat model and non-goals

Accidental input only: the user's own font-scale choice (slider 50–200 %, step 10) and window
size. No adversary. Environments that count: the Tauri webviews (WebKitGTK on Linux, WKWebView
on macOS, WebView2 on Windows) and the pinned Playwright Chromium the e2e suite runs in. A corrupt
persisted `font-size` outside the slider range is a separate, filed defect (see Risks), not a
case this plan must make sensible.

## Traced premises

Frozen at BASE `a990c06a`. Line numbers here are evidence, never instructions.

* P1 — `src/App.tsx:210-212` applies `document.documentElement.style.fontSize = \`${fontSize}%\``
  from `fontSizeAtom`; `src/App.tsx:214-217` builds the theme with
  `createAppTheme({ primaryColor, spellCheck })` inside `useMemo`.
* P2 — `src/styles/theme.ts:22-30` `createAppTheme` is documented as the "Sole application theme
  factory; settings-derived values are injected here", and sets no `breakpoints`.
  `src/components/home/StartupStorageFailure.tsx:9-12` is its only other production caller (built
  at module scope with defaults; the App, and therefore the root font scale, is not mounted there).
  Test callers: `src/App.test.tsx:563` (asserts the exact argument object),
  `src/components/settings/ColorControl.test.tsx:43`, `src/components/settings/ThemeButton.test.tsx:29`.
* P3 — `src/state/atoms.ts:271-275` `fontSizeAtom` persists `"font-size"`; default 100;
  `src/state/utils.ts:88` validates only "finite number". `FontSizeSlider.tsx:19-21` offers 50–200.
* P4 — Mantine 8.3.14 (`pnpm-lock.yaml:25`): default breakpoints xs 36em, sm 48em, md 62em,
  lg 75em, xl 88em (`@mantine/core/esm/core/MantineProvider/default-theme.mjs:70`). Responsive
  style props resolve a key to `(min-width: ${theme.breakpoints[key]})`
  (`core/Box/style-props/parse-style-props/parse-style-props.mjs:68`); SimpleGrid in its default
  `type="media"` builds its queries from the same theme values
  (`components/SimpleGrid/SimpleGridVariables.mjs:35,57`). `useMediaQuery` passes its string to
  `window.matchMedia` (`@mantine/hooks/esm/use-media-query/use-media-query.mjs:27`).
* P5 — Media-query `em`/`rem` resolve against the initial font size, not the root element's
  computed size (CSS Media Queries; the finding's evidence, measured in the f-20260829-02
  investigation). The root is set as a *percentage of that same initial size* (P1), so
  `(N × s/100)em` in a media query equals N scaled root-em for any UA default font size.
* P6 — Inventory of width switches (probe-1-r1):
  * JS media queries: `SettingsPage.tsx:127` `(max-width: 50rem)` → Tabs `orientation` at `:794`;
    `FilesPage.tsx:47` `COMPACT_DIALOG_QUERY = "(max-width: 30em)"`, used at `:67` → `AppModal
    fullScreen` at `:428`.
  * CSS: `SettingsPage.module.css:69` `@media (max-width: 50rem)` — styles `.settingsContent`,
    `.card`, `.settingsTabs`, `[role=tablist]`, `[role=tab]`, `.item`, `.settingControl`.
    `.card`/`.item` are also rendered by the search-results branch outside the Tabs
    (`SettingsPage.tsx:710,731`) and by `SettingRow` (`SettingsLayout.tsx`, used only by
    SettingsPage). The page root is the `Stack` at `SettingsPage.tsx:761`.
  * Theme-key switches (fixed by the theme alone): SimpleGrid `cols` at `AddDatabase.tsx:169`,
    `DatabasesPage.tsx:216,299`, `AddEngine.tsx:88,113`, `EnginesPage.tsx:135`,
    `UpgradeEngineModal.tsx:151`, `FilesPage.tsx:260`, `NewTabHome.tsx:241`; responsive style
    props at `DatabasesPage.tsx:217,227,281,390,410`, `FileCard.tsx:98`, `FilesPage.tsx:234,236,261,355`.
  * No `visibleFrom`/`hiddenFrom`, `Grid` breakpoint objects, `useMatches`, `matchMedia` or
    `window.innerWidth` in `src`; no other `@media`/`@container` in renderer CSS.
  * Already scale-aware, out of scope: `FileCard.tsx:22-51` compares the card width with 26 ×
    the computed root font size. `__root.tsx:273` AppShell `breakpoint: 0` (numeric px; no switch).
* P7 — e2e (probe-2-r1): `e2e/fixtures.ts:356` `fontScaleByProject` seeds
  `localStorage["font-size"]` per project (`:614`) before startup. Projects at 200 %:
  `database-files` 800×720, `accounts-puzzles-engines` 1440×900, `settings-responsive` /
  `async-errors` / `security-consent` 320×720. All others are 100 %. The finding's proof names
  `{ scrollable: "reachable" }`; the real API is `assertNothingClipped(locator, { mode:
  "reachable" })`, wrapped as `assertPageNotClipped(page)` (`e2e/fixtures.ts:72,265`).
  Snapshot path template is `{arg}-{projectName}` (`playwright.config.ts:32`); a project with
  only behavioural assertions needs no baseline. Re-recording runs only in the container
  (`pnpm test:e2e:update`) under the rule in `.claude/skills/verify-ui/SKILL.md` (`d-20260919-13`).
* P8 — `scripts/check-ui-boundaries.mjs` scans every tracked `src/**/*.{ts,tsx,css}` (tests
  excluded) line by line for one-door violations (direct `ActionIcon`/`Modal` imports, unsafe
  focus resets); `pnpm ui:boundary:check` is part of `gates:contract:check`, with its own test
  file `scripts/check-ui-boundaries-tests.mjs`.

## Approach

The defining property (O0) is zoom equivalence; everything else is the one mechanism that
delivers it and the proof that it is delivered.

### O0 — Definition of correct

Quoting the MANDATE: "make the compact/column switch follow the effective width in scaled
root-em". A switch defined at N em of width flips when the viewport is N **scaled** root-em wide,
i.e. at N × s/100 initial-em. At s = 100 every query string is byte-identical to today's, so every
100 % layout and every 100 % e2e snapshot is unchanged. This is the browser-zoom semantics
`d-20260831-16` already chose for the font scale ("scaling the whole UI is what browser zoom does").

### O1 — One scale function, applied to the theme breakpoints

"whether Mantine's theme breakpoints should be rewritten globally or per site": globally.
`createAppTheme` takes the app font scale as a required input and returns Mantine's default
breakpoint set, each value multiplied by s/100 and expressed in `em` (P5 makes `em` exact for any
UA default; a pixel value would assume 16px). One exported pure function performs the scaling and
is the only place the multiplication exists; both O1 and O2 call it. Values are deterministic,
finite em strings without floating-point noise (e.g. 110 % of 48em is `52.8em`).

* `App.tsx` passes `fontSizeAtom`'s value — the same value it writes to the root (P1) — and the
  theme memo depends on it.
* `StartupStorageFailure` passes 100 (named constant beside its existing defaults), because the
  App, and so the root scale, is never mounted there (P2).
* Consequence: every SimpleGrid `cols` object and every responsive style prop in P6's theme-key
  list follows the scale with **no per-site edit**, as will any future one.

### O2 — One hook for width queries that are not theme keys

The two JS queries in P6 (Settings 50rem, Files 30em) go through one renderer hook that takes a
max-width in em, scales it with O1's function and the current `fontSizeAtom` value, and returns
Mantine `useMediaQuery`'s boolean for the resulting query. A font-scale change re-evaluates the
query (Mantine re-subscribes when its query string changes, per the MANDATE's measurement).
`SettingsPage` and `FilesPage` call it with their existing thresholds (50 and 30); the
`COMPACT_DIALOG_QUERY` comment that documents the old fixed-pixel behaviour is replaced to state
the scaled behaviour.

Failure semantics: the hook adds no failure surface of its own; it inherits Mantine's
`useMediaQuery` exactly (`@mantine/hooks/esm/use-media-query/use-media-query.mjs:4-11,19-34`):
before its effect runs it reports `false`; if `window.matchMedia` throws, the effect's catch leaves
the state as it was — `false` on mount, or the previous result after a query change (a font-scale
change); if listener attachment fails after a successful `matchMedia`, the freshly sampled value is
kept but no longer tracks resizes. The hook always passes a well-formed `(max-width: <finite>em)`
query (O1's function returns finite em values for the atom's validated finite input), so in a
webview whose `matchMedia` accepted the previous query, the next one of the same shape is not a new
failure cause. This degradation is deliberately kept unchanged and undiagnosed: it is today's
behaviour at both call sites, every supported webview implements `matchMedia` and
`MediaQueryList.addEventListener`, and a separate fallback would be a mechanism with no MANDATE
obligation behind it.

### O3 — Settings CSS driven by the same boolean

"and drive the CSS side from the same source": the `@media (max-width: 50rem)` block in
`SettingsPage.module.css` is removed. Its rules apply instead under a compact marker that the
Settings page root (the outermost element containing both the Tabs branch and the search-results
branch, P6) carries exactly when O2's hook reports compact — the same boolean that sets the Tabs
`orientation`. No rule of the block is lost or changed; only its condition.

### O4 — (withdrawn in r2)

A `ui:boundary:check` source rule was proposed in r1 and withdrawn under issue I3: it proves no
MANDATE obligation that O5's behavioural proofs cannot, and `push-review-policy.md` "Proof
selection before custom source verification" forbids extending a source checker without one.

### O5 — Verification

* Unit (vitest): O1 — at 100 the breakpoints equal Mantine's defaults exactly; at 200 and 50 every
  value is the default × 2 / × 0.5 in em. O2 — the hook's query string at 100, 200 and 50 for 50em
  and 30em, and a font-scale change switches its result without remount (matchMedia mocked as the
  existing tests do). `App.test.tsx` asserts the new `createAppTheme` argument including the font
  scale it mocks (120 at `App.test.tsx:185`); the two theme-consuming tests pass 100.
* e2e (the MANDATE's proof): a new behaviour-only Playwright project at **1000×720, 200 %**
  (registered in `playwright.config.ts` and `fontScaleByProject`) with no screenshot assertion.
  It proves, on Settings and on one SimpleGrid page (the Databases list/details grid, or the Files
  tree/entry grid if the Databases mock cannot render both panes):
  * at 200 %: Settings' tablist orientation is horizontal and the compact marker is present; the
    grid's two panes are stacked (second pane starts below the first); `assertPageNotClipped(page)`
    holds on both pages;
  * O3's compact CSS, on both branches that render setting rows — an open tab panel and the
    search-results list (a search query typed into Settings' search field): at 200 % a setting
    row's **computed** `flex-direction` is `column` and its control wrapper's width equals the row's
    content width; at 100 % (next bullet) the same rows compute `flex-direction: row`. Geometry
    alone is not the oracle: the row is a wrapping Mantine `Group` whose copy basis (18rem), control
    minimum (12rem) and gap already wrap it at 1000px / 200 % without the compact rules;
  * at 100 % at the same 1000px (font scale overridden per test before startup): Settings' tablist
    is vertical and the grid's panes sit side by side — proving the switch is scale-driven and the
    100 % layout unchanged;
  * at 50 % at 700px: Settings' tablist is vertical (an unscaled 800px threshold would make it
    horizontal) — the other direction of the same defect;
  * live change, no reload: starting at 100 % at 1000px, the font scale is set to 200 % through
    the Settings font-size slider (its real `onChangeEnd` path), after which Settings' tablist is
    horizontal and, navigating in-app (no reload) to the grid page, its panes are stacked —
    proving the mounted App rebuilds its theme and the hook re-evaluates when the atom changes,
    not only at startup.
* Existing snapshots: by O0, no snapshot of a 100 % project and none of a 320px project can move
  (at 320px every switch is already in its narrowest state, before and after). Snapshots of the two
  wider 200 % projects (`database-files`, `accounts-puzzles-engines`) whose captured surface holds a
  P6 grid or style prop **are expected to move** to their stacked/narrow form. They are re-recorded
  under the verify-ui rule: run `pnpm test:e2e:container` first, inspect every `*-diff.png`, accept
  only differences that are the predicted column/compact switch, re-record with
  `pnpm test:e2e:update`, and stop if any snapshot outside those two projects moves. Every moved
  snapshot is named in the commit message.
* Real webview (step 7, verify-ui): `pnpm verify:app` cannot do this as it stands — its only
  option is `--screenshot` (`scripts/verify-app.mjs:433`) and it checks no layout. The verify-ui
  leaf instead runs a **one-off scratch probe** (written under the run's `RUN_TMP`, never
  committed — observation, not a new tool) on the exported harness of `scripts/app-driver.mjs`
  (`startCompositor`, `startDriver`, `Session` with `call` / `/execute/sync`), as recorded practice
  for real-app flows. Against the release binary in WebKitGTK it sets `localStorage["font-size"]`
  to 200, reloads, opens Settings, reads `window.innerWidth` and the tablist's `aria-orientation`,
  then repeats at 100. Pass requires: innerWidth in [801, 1599] (so the outcome discriminates the
  unscaled 800px threshold from the scaled 1600px one), orientation `horizontal` at 200 and
  `vertical` at 100. With unscaled breakpoints the 200 % reading would be `vertical`, so the probe
  fails on revert.

## Decisions and trade-offs

* **Mechanism: scaled theme breakpoints + one scaled hook (chosen)** — the MANDATE's open question.
  Contested alternatives are under `## Decided autonomously` (D1).
* **Global, not per site** (D2).
* **Zoom equivalence as the definition** (D3), which is what makes "nothing changes at 100 %" a
  structural guarantee instead of a test hope.

## Decided autonomously

Run is `full auto`; each entry is recorded in `tasks/decisions.md` by the adopting session.

* **D1 — Which single mechanism makes every width switch follow the app font scale?**
  * Chosen: scale Mantine's theme breakpoints in `createAppTheme` by the font scale (em), plus one
    hook that scales the two non-theme JS queries with the same function; Settings' CSS keyed on
    that hook's boolean.
  * Rejected: CSS container queries — they answer a different question (the component's box, not
    the window), so every threshold also moves at 100 % (Settings' content box is narrower than the
    viewport by the nav rail), SimpleGrid's `type="container"` takes literal width keys and a
    wrapper per grid instead of theme keys (P4), and Settings' Tabs `orientation` is a React prop
    no CSS query can set. Rejected: content-driven wrapping (`auto-fill`/`flex-basis` in rem) —
    rewrites every grid and changes every 100 % layout, and cannot express the Tabs orientation.
    Rejected: an atom-derived pixel query — assumes a 16px UA default; a scaled `em` value is exact
    for any default (P5).
  * Because: one source of truth for theme keys, JS and CSS; zero per-site edits for the nine grids
    and eleven responsive props; byte-identical queries at 100 %.
* **D2 — Rewrite the theme breakpoints globally or per site?** Chosen: globally, in the sole theme
  factory. Rejected: per-site scaled objects — nine grid sites and eleven style-prop sites carrying
  a copy of the same arithmetic (rule 11), and every future grid silently unscaled again.
* **D3 — What does "correct" mean for a width switch under the font scale?** Chosen: zoom
  equivalence (O0). Rejected: tuning each threshold per scale by eye — no oracle, and contradicts
  `d-20260831-16`'s zoom framing.
* **D5 — Which scale does `StartupStorageFailure` use?** Chosen: 100, because it renders without
  the App and the root font is unscaled there. Rejected: reading the persisted scale — that screen
  exists because storage failed.

## Risks / open questions

* The first render of a `useMediaQuery` consumer reports `false` until its effect runs (Mantine's
  `getInitialValueInEffect` default); unchanged from today, not introduced here.
* Changing the font scale now rebuilds the theme object, re-rendering the provider tree once per
  slider release (`onChangeEnd`). Acceptable: it is a settings action, and the root font change
  already reflows the whole app.
* A corrupt persisted `font-size` (≤ 0 or far outside 50–200) is not range-checked today; the
  breakpoints scale by the same value the root uses, so this plan adds no mismatch for any value
  CSS accepts. Filed separately while locating: inbox entry
  `20261008-091923-1457949-1791443963092296318-6.md` ("The persisted app font scale is accepted at
  any finite value…", area `frontend-state`, entry `inline`).
* Committed snapshots of `database-files` and `accounts-puzzles-engines` move (O5). The prediction
  is the gate: a moved snapshot outside them is a regression to fix, never to re-record.

## Not part of this task

* f-20260927-09 (title-bar menu at 320px / 200 %) — separate finding, different files.
* `FileCard`'s preview switch — already scale-aware (P6).
* Layout of grids inside modals relative to the modal's own width — viewport-relative today and
  after; not the MANDATE's defect.
* Range validation of the persisted font scale — filed (Risks).

## Phases

Two phases, in dependency order (phase 2's assertions need phase 1's behaviour). Neither touches
auth, persistence, concurrency or an IPC/API contract; no file matches a Sensitive-Path glob.

### Phase 1 — Scaled breakpoints, hook, Settings CSS, moved snapshots

* Files: `src/styles/theme.ts`, `src/App.tsx`, `src/components/home/StartupStorageFailure.tsx`,
  `src/components/home/StartupStorageFailure.test.tsx` (asserts the exact old `createAppTheme`
  argument object),
  one new hook module under `src/hooks/` (plus its test), `src/components/settings/SettingsPage.tsx`,
  `src/components/settings/SettingsPage.module.css`, `src/components/files/FilesPage.tsx`,
  `src/components/files/FilesPage.test.tsx` (its `jotai` and `@/state/atoms` mocks must expose
  whatever O2's hook reads — today they expose only `useAtom` and no `fontSizeAtom`), unit tests for O1
  (theme) and the updated `src/App.test.tsx`, `ColorControl.test.tsx`, `ThemeButton.test.tsx`;
  the re-recorded PNGs under `e2e/database-files.spec.ts-snapshots/` and
  `e2e/accounts-puzzles-engines.spec.ts-snapshots/` (only those the container run shows moved).
* Obligations: O1, O2, O3, O5 unit and snapshot parts.
* Role: `normal`.
* Proof:
  1. `pnpm vitest run src/styles src/hooks src/App.test.tsx src/components/settings src/components/files src/components/home/StartupStorageFailure.test.tsx`
  2. `pnpm checks:pre-review`
  3. `pnpm test:e2e:container` — before re-recording, its only failures are snapshot mismatches in
     `database-files` / `accounts-puzzles-engines`; the leaf reports each with its diff path and
     stops. The orchestrator inspects every diff; on a resume the leaf runs `pnpm test:e2e:update`,
     then `git status --porcelain e2e/` must list only predicted PNGs, and a second
     `pnpm test:e2e:container` is green.

### Phase 2 — Font-scale breakpoint e2e project

* Files: `playwright.config.ts`, `e2e/fixtures.ts` (`fontScaleByProject` entry), one new spec
  under `e2e/`.
* Obligations: O5 e2e part. No screenshot assertion, so no baseline.
* Role: `normal`.
* Proof:
  1. `pnpm test:e2e:container --project=<new project>` green.
  2. Revert checks, run by the orchestrator on a scratch copy of the tree, each on its own:
     (a) with O1's scale function forced to return the unscaled value, the new project goes red on
     the 200 % and 50 % assertions; (b) with only O3's compact marker moved from the Settings page
     root onto the Tabs element, the new project goes red on the search-results computed-style
     assertion; (c) with only the compact `.item` / `.settingControl` rules removed, it goes red on
     the computed-style assertions in both branches.
  3. `pnpm checks:pre-review`

## Reviews

### Round 1 — r1 (12 lenses, every plan-capable lens; elapsed 289 s wall; adopted 4)

Lens set: review-plan (`--role review-plan`), and at `--role normal` (no Sensitive-Path glob in
the plan's files): review-minimalism, review-correctness, review-tests, review-error-handling,
review-chess-semantics, review-engine-protocol, review-ipc-contract, review-persisted-state,
review-pgn-index, review-platform-semantics, review-tauri-security. Executor: codex (OpenAI high
tier). Not run: review-code-quality, review-root-cause (`plan-review: false`).

Raw verdicts: plan REVISE · minimalism REVISE · correctness APPROVED · tests APPROVED ·
error-handling APPROVED · chess-semantics APPROVED (NOT APPLICABLE) · engine-protocol APPROVED
(NOT APPLICABLE) · ipc-contract APPROVED (NOT APPLICABLE) · persisted-state APPROVED (NOT
APPLICABLE) · pgn-index APPROVED (NOT APPLICABLE) · platform-semantics APPROVED (NOT APPLICABLE) ·
tauri-security APPROVED (NOT APPLICABLE). NOT APPLICABLE reasons checked by the arbiter: each
names only chess trees, engines, IPC, storage encoding/hydration, PGN, OS/FFI or credential
surfaces; the plan reads `fontSizeAtom` without changing its storage, and touches none of the
others — correct.

Raw findings (verbatim):

**lens-plan-r1:**

```text
[blocker] tasks/plans/2026-10-08-font-scaled-breakpoints.md:144 — O5 does not prove that changing the font scale updates the mounted App’s theme. The proposed App test checks only initial arguments (`src/App.test.tsx:560`), and the e2e cases seed each scale before startup. A theme cached at the initial scale could pass these proofs while grids remain unchanged after a slider adjustment. This integration matters because the current theme memo excludes font size (`src/App.tsx:214`). Require a mounted-app scale change that verifies the grid switches without reloading. (confidence: 97)

[blocker] tasks/plans/2026-10-08-font-scaled-breakpoints.md:169 — The promised WebKitGTK proof cannot run as written. `pnpm verify:app` invokes `scripts/verify-app.mjs` (`package.json:78`), whose only parsed option is `--screenshot` (`scripts/verify-app.mjs:433`). It contains no font-scale, Settings orientation, or window-resizing check and starts the compositor with default dimensions (`scripts/verify-app.mjs:1064`, `scripts/app-driver.mjs:168`). Neither phase includes changes to that verifier. Specify an executable real-app probe or include the necessary verifier extension so this command can actually reject incorrect breakpoint behavior. (confidence: 100)

VERDICT: REVISE```

**lens-minimalism-r1:**

```text
[should-fix] tasks/plans/2026-10-08-font-scaled-breakpoints.md:133 — O4 adds two renderer-wide source restrictions without identifying a mandate obligation that O1–O3 and O5 cannot satisfy. Its blanket `useMediaQuery` import ban also covers unrelated features such as `prefers-reduced-motion`. The shared push-review policy’s “Proof selection before custom source verification” requires an uncovered obligation and an explanation of why behavioral checks cannot prove it, even when extending an existing checker. The smallest sufficient plan retains the shared scaling function, two-caller hook, Settings marker and behavioral proofs, while removing O4 and all changes to the two boundary-checker files. This preserves mandate coverage and removes an entire tooling obligation (confidence: 95).

VERDICT: REVISE```

**lens-correctness-r1:**

```text
No correctness defects found in O0–O5. At 1000px/200%, Settings’ threshold becomes 1600px and the grid’s `sm` threshold becomes 1536px, producing horizontal tabs and stacked panes. At 100%, both retain their existing layout.

Limitation: implementation and browser behavior remain unverified in this plan-only review (confidence: 100).

VERDICT: APPROVED```

**lens-tests-r1:**

```text
[should-fix] tasks/plans/2026-10-08-font-scaled-breakpoints.md:147 — No proposed assertion exercises App’s theme update after changing font scale without remounting. Omitting `fontSize` from the theme memo dependencies would pass the factory tests, initial App argument assertion, isolated hook test and startup-seeded e2e cases. Add a live scale-change test that asserts the grid changes columns. (confidence: 98)

[should-fix] tasks/plans/2026-10-08-font-scaled-breakpoints.md:169 — The named `pnpm verify:app` command runs `scripts/verify-app.mjs`, which neither seeds 200% font scale nor asserts Settings’ orientation. No phase adds that check or names a runnable custom probe. The claimed WebKitGTK proof would therefore miss fixed breakpoints. Specify the probe and its failing-on-revert orientation assertion. (confidence: 99)

VERDICT: APPROVED```

**lens-error-handling-r1:**

```text
[should-fix] tasks/plans/2026-10-08-font-scaled-breakpoints.md:119 — O2 leaves subscription-failure semantics unspecified. Mantine catches media-query setup failures silently, returning false initially or retaining the previous result after a query change. O3 would then apply wide or stale Settings styles without any diagnostic. State whether this fallback is intentional and how failure should surface. (confidence: 94)

VERDICT: APPROVED```

Issues (stable IDs):

| ID | Claim | Witnesses | Evidence (arbiter) | Disposition | Authority | Correction (r2) | Status |
|---|---|---|---|---|---|---|---|
| I1 | No proof that a font-scale change updates the mounted App's theme and hook; every proof seeds the scale before startup. | plan r1 #1 (blocker), tests r1 #1 (should-fix) | Confirmed: `src/App.tsx:214-217` memo deps are `[primaryColor, spellCheck]`; `App.test.tsx:563` asserts only the initial argument. | Fix | MANDATE "make the compact/column switch follow the effective width in scaled root-em" (a switch that ignores a live scale change does not follow it) | O5 e2e adds a live change: 100 % → 200 % through the Settings slider without reload; Settings tablist turns horizontal and, after in-app navigation, the grid panes are stacked. | open → r2 |
| I2 | The promised WebKitGTK proof (`pnpm verify:app`) cannot run as written. | plan r1 #2 (blocker), tests r1 #2 (should-fix) | Confirmed: `scripts/verify-app.mjs:433` parses only `--screenshot`; `scripts/app-driver.mjs:168` `startCompositor({ width, height })` and `Session.call`/`/execute/sync` (`:250-305`) are exported. | Fix | Not a new mechanism (a scratch probe on the existing harness; nothing committed). | O5's real-webview item is a one-off scratch probe on `scripts/app-driver.mjs` exports: font-size 200 then 100, innerWidth in [801, 1599], tablist `aria-orientation` horizontal / vertical; fails on revert. | open → r2 |
| I3 | O4's two `ui:boundary:check` rules serve no MANDATE obligation the behavioural proofs cannot; the `useMediaQuery` ban is overbroad. | minimalism r1 #1 (should-fix) | Confirmed: `~/.claude/references/push-review-policy.md:427-436` "Proof selection before custom source verification" applies equally to extending an existing checker. | Fix (withdraw mechanism) | — (removal) | O4 withdrawn; D4 removed; the two checker files leave Phase 1's file list and proof. | open → r2 |
| I4 | O2 does not state subscription-failure semantics (Mantine silently keeps `false`). | error-handling r1 #1 (should-fix) | Confirmed: `@mantine/hooks/esm/use-media-query/use-media-query.mjs:19-34` catches a `matchMedia` throw and keeps the initial value. | Fix | Not a new mechanism (states existing behaviour). | O2 gains a "Failure semantics" paragraph: always a well-formed finite-em query; on missing/throwing `matchMedia` the hook reports `false` exactly as today; no diagnostic added, deliberately. | open → r2 |

Adopted plan-level corrections r1: 4 (I1–I4). Carried: none. Skipped: none. Deferred: none.
Out-of-area filing during Locate (before r1): inbox entry
`20261008-091923-1457949-1791443963092296318-6.md` (persisted font scale not range-checked;
`frontend-state`, `inline`); not a plan issue.

### Round 2 — r2 (closure round: review-plan + witnesses review-minimalism, review-tests, review-error-handling; elapsed 285 s wall; adopted 2)

Raw verdicts: plan REVISE · minimalism APPROVED · tests APPROVED · error-handling APPROVED.

Raw findings (verbatim):

**lens-plan-r2:**

```text
I1 CLOSED — r2 O5:166 adds a slider-driven change without reload and checks Settings plus the grid. This exercises the missing dependency in `src/App.tsx:214` (confidence: 98).

I2 CLOSED — r2 O5:179 replaces the ineffective command with a scratch probe using the existing exports at `scripts/app-driver.mjs:168,250,291,304`, with discriminating viewport and orientation assertions (confidence: 95).

I3 CLOSED — r2 O4:141 withdraws the source restrictions, and Phase 1:257 removes the checker changes (confidence: 100).

[should-fix] tasks/plans/.plan-2026-10-08-font-scaled-breakpoints.md-r2.body.md:128 — I4 NOT CLOSED. Mantine does not always report initial `false` after setup failure. Its catch leaves state unchanged after a query change, and listener registration happens after `setMatches(mediaQuery.matches)`. Evidence: `/home/felixb/Projekte/chessfable/node_modules/@mantine/hooks/esm/use-media-query/use-media-query.mjs:4,25`. State the actual retained-result behavior and whether that degradation is intentional (confidence: 100).

[blocker] tasks/plans/.plan-2026-10-08-font-scaled-breakpoints.md-r2.body.md:257 — Phase 1 omits `src/components/files/FilesPage.test.tsx`. Its atom mock exposes no `fontSizeAtom` (`:25,51`), its Jotai mock exposes only `useAtom` (`:45`), and it renders the real FilesPage (`:313`). O2 introduces an atom-reading hook into that render path, so the required Vitest proof cannot pass with these mocks unchanged. Add this test file and its mock updates to the phase’s write set (confidence: 99).

[should-fix] tasks/plans/2026-10-08-font-scaled-breakpoints.md:287 — The supplied `Full record:` lookup path is empty, despite the required history field in `/home/felixb/.claude/references/review-lens-contract.md:137`. The complete record was accessible through the full-plan path named in DELTA. Include that path explicitly in subsequent review packets (confidence: 100).

VERDICT: REVISE```

**lens-minimalism-r2:**

```text
I3 CLOSED — r2 withdraws O4, removes D4, and drops both checker files from Phase 1. The remaining shared hook serves two existing callers. No new bloat or duplication findings in the revised obligations.

VERDICT: APPROVED```

**lens-tests-r2:**

```text
I1 CLOSED — O5’s slider-driven, no-reload test would fail on the grid-stacking assertion if App’s theme memo omitted the font-scale dependency.
I2 CLOSED — O5 now uses the exported WebDriver harness with a discriminating viewport range. Reverting the scaled Settings query would fail the 200% horizontal-orientation assertion.
VERDICT: APPROVED```

**lens-error-handling-r2:**

```text
[should-fix] I4 NOT CLOSED — O2 specifies a fallback that Mantine does not guarantee.

[should-fix] tasks/plans/.plan-2026-10-08-font-scaled-breakpoints.md-r2.body.md:128 — Mantine’s catch does not reset `matches` to `false`. If a live font-scale change causes `matchMedia` to throw, the hook retains its previous boolean. If listener attachment fails, it retains the newly sampled boolean but stops tracking viewport changes. Settings’ orientation/CSS and Files’ fullscreen state can therefore remain compact or become stale, without diagnostics. The cited Mantine source establishes these outcomes directly. Specify whether retaining that silent degradation is intentional, or require the stated wide-layout fallback (confidence: 99).

VERDICT: APPROVED```

Closures: I1 CLOSED (plan r2, tests r2) · I2 CLOSED (plan r2, tests r2) · I3 CLOSED (plan r2,
minimalism r2). I4 NOT CLOSED (plan r2 #1, error-handling r2 #1/#2) — residual keeps ID I4.

| ID | Claim | Witnesses | Evidence (arbiter) | Disposition | Authority | Correction (r3) | Status |
|---|---|---|---|---|---|---|---|
| I4 (residual) | The r2 failure-semantics text is wrong: Mantine's catch keeps the previous result after a query change, and a failed listener attachment keeps the sampled value untracked; it does not always report `false`. | plan r2 #1 (should-fix), error-handling r2 #1, #2 (should-fix) | Confirmed: `use-media-query.mjs:4-11` (`attachMediaListener`), `:25-33` (`setMatches` before attach; catch returns `undefined` without resetting). | Fix | Not a new mechanism (corrects the statement of inherited behaviour). | O2 "Failure semantics" rewritten to the actual retained-result behaviour, stated as deliberately kept (today's behaviour; a fallback would be a mechanism without MANDATE obligation). | open → r3 |
| I5 | Phase 1's write set omits `src/components/files/FilesPage.test.tsx`, whose `jotai` mock exposes only `useAtom` and whose `@/state/atoms` mock has no `fontSizeAtom`; the Vitest proof cannot pass once FilesPage calls O2's hook. | plan r2 #2 (blocker) | Confirmed: `FilesPage.test.tsx:25` (`stateAtoms` = two atoms), `:45-50` (`jotai` mock = `useAtom` only), `:51`. | Fix | Not a new mechanism (phase write set). | Phase 1 file list names `FilesPage.test.tsx` and the mock obligation. | open → r3 |
| I6 | The r2 packet's `Full record:` lookup path was empty. | plan r2 #3 (should-fix) | Confirmed: the orchestrator's `sed` used `#` as delimiter, so `## Reviews in <path>` was cut (`inputs-r2.txt`). Packet defect, not a plan defect. | Fix (packet) | — | r3 packets carry the full-record path explicitly (built without `sed`). | open → r3 |

Adopted plan-level corrections r2: 2 (I4 residual, I5). I6 is a review-packet correction, not
counted as a plan adoption.

### Round 3 — r3 (closure round: review-plan + review-error-handling (I4) + review-tests (affected by I5's test-file change); elapsed 144 s wall; adopted 3)

Raw verdicts: plan REVISE · tests REVISE · error-handling APPROVED.

Raw findings (verbatim):

**lens-plan-r3:**

```text
I4 CLOSED — r3:125–136 correctly states Mantine’s retained-result behavior and intentionally preserves it. Confirmed in `/home/felixb/Projekte/chessfable/node_modules/@mantine/hooks/esm/use-media-query/use-media-query.mjs:22–34` (confidence: 100).

I5 CLOSED — r3:257–258 adds `FilesPage.test.tsx` and its mock updates, addressing the incomplete mocks at `src/components/files/FilesPage.test.tsx:25,45–51` (confidence: 100).

I6 CLOSED — this packet supplies the full-record path, whose Reviews section exists at `tasks/plans/2026-10-08-font-scaled-breakpoints.md:286` (confidence: 100).

[blocker] tasks/plans/.plan-2026-10-08-font-scaled-breakpoints.md-r3.body.md:262 — Phase 1 requires O3, but the r3 delta deletes that obligation entirely. Its contract required replacing the fixed CSS query while preserving every compact rule and covering both Tabs and search results. Those consumers remain at `src/components/settings/SettingsPage.module.css:69–104` and `src/components/settings/SettingsPage.tsx:731,784`. Restore O3 so the mandate’s shared JS/CSS condition remains an explicit obligation (confidence: 100).

[blocker] tasks/plans/.plan-2026-10-08-font-scaled-breakpoints.md-r3.body.md:254 — Phase 1 omits another affected consumer, `src/components/home/StartupStorageFailure.test.tsx`. O1 adds the required font-scale argument to StartupStorageFailure’s theme call, but this test asserts the exact old argument object at `src/components/home/StartupStorageFailure.test.tsx:130–133`. That assertion will fail, and the narrow Vitest command at plan:265 excludes the home directory. Add this file, update its expectation, and include it in the proof (confidence: 100).

VERDICT: REVISE```

**lens-tests-r3:**

```text
[blocker] tasks/plans/.plan-2026-10-08-font-scaled-breakpoints.md-r3.body.md:155 — R3 deletes O3, while the remaining Settings proof asserts tab orientation, marker presence and clipping, without asserting compact CSS reflow or exercising search results. Restricting the compact styles to the Tabs subtree would leave search-result rows unscaled and pass the named proofs, which never render that branch. Restore the CSS obligation and name a browser assertion that checks compact row geometry in search results at 1000px/200%, with the 100% comparison. (confidence: 96)

VERDICT: REVISE```

**lens-error-handling-r3:**

```text
I4 CLOSED — O2 now matches Mantine’s source: `matchMedia` failure retains false on mount or the previous result after a query change. Failed listener attachment retains the sampled value without resize tracking. The plan explicitly accepts this undiagnosed degradation (confidence: 99).

VERDICT: APPROVED```

Closures: I4 CLOSED (plan r3, error-handling r3) · I5 CLOSED (plan r3) · I6 CLOSED (plan r3).

| ID | Claim | Witnesses | Evidence (arbiter) | Disposition | Authority | Correction (r4) | Status |
|---|---|---|---|---|---|---|---|
| I7 (lineage: I4) | The r3 revision deleted O3 (Settings CSS driven by the same boolean) entirely. Correction-introduced: the I4 rewrite replaced the text from O2's failure paragraph up to the O4 heading, and O3 sat in between. | plan r3 #1 (blocker), tests r3 #1 (blocker, first half) | Confirmed: `plan-r3.md` has no `### O3`; the r3 delta lists no O3 heading. | Fix | Restores r1 content (MANDATE "drive the CSS side from the same source"). | O3 restored byte-identical to r1 (checked with `diff` of the O3 section against `plan-r1.md`). | open → r4 |
| I8 | Phase 1 omits `src/components/home/StartupStorageFailure.test.tsx`, which asserts the exact old `createAppTheme` argument; the vitest proof excludes `src/components/home`. | plan r3 #2 (blocker) | Confirmed: `StartupStorageFailure.test.tsx:130-133` (`toHaveBeenCalledExactlyOnceWith({ primaryColor: "blue", spellCheck: false })`). All four test callers of `createAppTheme` now listed (grep: App.test, ThemeButton.test, ColorControl.test, StartupStorageFailure.test). | Fix | Not a new mechanism (phase write set and proof). | Phase 1 file list adds the file; proof 1 adds it to the vitest command. | open → r4 |
| I9 | No proof exercises O3's compact CSS, and none renders the search-results branch; a marker placed on the Tabs subtree only would pass. | tests r3 #1 (blocker, second half) | Confirmed: O5 asserted orientation, marker presence and clipping only; `SettingsPage.tsx:693-731` renders search results outside the Tabs. | Fix | MANDATE "drive the CSS side from the same source" (O3) — verification of an existing obligation, no new mechanism. | O5 e2e adds: at 1000px/200 % a setting row's control sits below its copy in an open tab panel and in the search-results list; at 1000px/100 % the same rows are side by side. | open → r4 |

Adopted plan-level corrections r3: 3 (I7, I8, I9).

### Round 4 — r4 (closure round: review-plan + review-tests; elapsed 183 s wall; adopted 1)

Raw verdicts: plan REVISE · tests REVISE.

Raw findings (verbatim):

**lens-plan-r4:**

```text
I7 CLOSED — r4:138 restores O3, including preservation of every compact rule and coverage of both branches. Confirmed against `src/components/settings/SettingsPage.module.css:69` and `SettingsPage.tsx:761` (confidence: 100).

I8 CLOSED — r4:267 includes `StartupStorageFailure.test.tsx`, and r4:279 includes it in the proof command. This covers the exact-argument assertion at `src/components/home/StartupStorageFailure.test.tsx:130` (confidence: 100).

[blocker] tasks/plans/.plan-2026-10-08-font-scaled-breakpoints.md-r4.body.md:166 — I9 NOT CLOSED. Below-copy geometry does not prove compact CSS applies. `SettingsLayout.tsx:19` uses a Group whose default is wrapping (`/home/felixb/Projekte/chessfable/node_modules/@mantine/core/esm/components/Group/Group.mjs:27`). The existing copy basis, control minimum and gap (`SettingsPage.module.css:35`, `SettingsPage.module.css:40`, `SettingsLayout.tsx:21`) total 32rem, or 1024px at 200%. They already force wrapping inside a 1000px viewport without the compact rules. Consequently, a marker incorrectly restricted to Tabs can still pass the new search-results geometry comparison. Require an assertion that distinguishes compact CSS from ordinary wrapping in both branches, such as computed column direction or full-width controls (confidence: 96).

Limitation: browser geometry was not executed in this read-only review. The finding rests on the current CSS and Mantine source (confidence: 100).

VERDICT: REVISE```

**lens-tests-r4:**

```text
I7 CLOSED — O3 again requires the shared compact condition on the outer Settings root, covering Tabs and search results.

[blocker] tasks/plans/.plan-2026-10-08-font-scaled-breakpoints.md-r4.body.md:166 — I9 NOT CLOSED. “Control below copy” does not distinguish compact CSS from existing flex wrapping. `SettingRow` uses Mantine Group’s default `wrap: "wrap"`. The unchanged CSS gives copy an 18rem basis and controls a 12rem minimum, with a 2rem gap. At 200%, these require 1024px before page padding, so they already wrap at a 1000px viewport without the compact rules. At 100%, they can sit side by side. Reverting only the compact `.item` and `.settingControl` rules could therefore pass both proposed geometry assertions, including search results. Require an assertion distinguishing the compact layout, such as computed column direction and full-width controls in both branches, and independently revert those CSS rules to prove failure. The shared-scale revert checks orientation and grids but does not isolate this CSS regression. (confidence: 98)

VERDICT: REVISE```

Closures: I7 CLOSED (plan r4, tests r4) · I8 CLOSED (plan r4). I9 NOT CLOSED (plan r4 #1, tests r4
#1) — residual keeps ID I9 (first failed closure of this lineage).

| ID | Claim | Witnesses | Evidence (arbiter) | Disposition | Authority | Correction (r5) | Status |
|---|---|---|---|---|---|---|---|
| I9 (residual) | "Control below copy" does not distinguish O3's compact CSS from the row's ordinary flex wrap: copy basis 18rem + control minimum 12rem + gap 2rem = 32rem = 1024px at 200 %, so the row already wraps at 1000px without the compact rules; the shared-scale revert check does not isolate a CSS regression. | plan r4 #1 (blocker), tests r4 #1 (blocker) | Confirmed: `SettingsLayout.tsx:19-23` (`Group gap="xl"`, Mantine default `wrap`), `SettingsPage.module.css:35-43` (`flex: 1 1 18rem`, `min-width: min(100%, 12rem)`). | Fix | MANDATE "drive the CSS side from the same source" (O3) — verification only, no new mechanism. | O5: the oracle is the row's computed `flex-direction` (`column` at 200 %, `row` at 100 %) and the control wrapper's width equal to the row's content width, in a tab panel and in search results. Phase 2 proof 2 gains two isolated revert checks: (b) marker moved to the Tabs element → search-results assertion red; (c) compact `.item`/`.settingControl` rules removed → both branches red. | open → r5 |

Adopted plan-level corrections r4: 1 (I9 residual).

### plan-r6.md

# Plan: responsive breakpoints follow the app font scale (f-20260927-08)

## Goal

Every width-dependent layout switch in the renderer flips at the same width *in scaled root-em*
at every app font scale, so the layout at window width W and font scale s is the layout the app
shows at W/s and 100 %. At 100 % nothing changes, by construction.

## MANDATE

Verbatim from `tasks/findings.md`, f-20260927-08:

> * **Where:** `src/components/settings/SettingsPage.tsx:126` (`useMediaQuery("(max-width: 50rem)")`), `src/components/settings/SettingsPage.module.css:60` (`@media (max-width: 50rem)`), and the Mantine `SimpleGrid cols` breakpoints at `src/components/files/FilesPage.tsx:217`, `src/components/databases/DatabasesPage.tsx:185,254`, `src/components/engines/EnginesPage.tsx:133`, `src/components/tabs/NewTabHome.tsx:241`, `src/components/engines/AddEngine.tsx:90,115`, `src/components/databases/AddDatabase.tsx:156`.
> * **Defect:** `App.tsx:209` scales the root font (`document.documentElement.style.fontSize = fontSize%`), but `rem`/`em` inside a media query resolve against the initial 16px, never the scaled root. So every breakpoint means the same pixel width at every app font scale: at 200% a 1000px window is only 31 root-em wide, yet Settings stays in its two-column layout (threshold 800px) and the grids stay multi-column, into widths the scaled content cannot fit.
> * **Evidence:** root cause 2 of `f-20260829-02` (its 2026-08-31 investigation). That run's 320px matrix never exercises it, because at 320px every breakpoint is already in its narrowest state; the f-20260829-02 plan review (2026-09-27, issue I3, lenses review-plan and review-root-cause) ruled a scale-aware breakpoint outside that finding's mandate because it changes behaviour only at other widths.
> * **Fix:** make the compact/column switch follow the effective width in scaled root-em — e.g. derive the query from `fontSizeAtom` (Mantine `useMediaQuery` re-subscribes when its query string changes, measured in `node_modules/@mantine/hooks/esm/.../use-media-query.mjs`), CSS container queries, or content-driven wrapping (`flex-basis` in rem) — and drive the CSS side from the same source.
> * **Open question:** one mechanism for all sites (atom-derived pixel query vs. container queries vs. rem flex-basis wrapping), and whether Mantine's theme breakpoints should be rewritten globally or per site.
> * **Proof:** an e2e project at e.g. 1000px / 200% font scale whose Settings and a SimpleGrid page pass `assertNothingClipped(page.locator("body"), { scrollable: "reachable" })` and switch to their compact layout.
> * **Related:** f-20260829-02 (root cause 2).

## Threat model and non-goals

Accidental input only: the user's own font-scale choice (slider 50–200 %, step 10) and window
size. No adversary. Environments that count: the Tauri webviews (WebKitGTK on Linux, WKWebView
on macOS, WebView2 on Windows) and the pinned Playwright Chromium the e2e suite runs in. A corrupt
persisted `font-size` outside the slider range is a separate, filed defect (see Risks), not a
case this plan must make sensible.

## Traced premises

Frozen at BASE `a990c06a`. Line numbers here are evidence, never instructions.

* P1 — `src/App.tsx:210-212` applies `document.documentElement.style.fontSize = \`${fontSize}%\``
  from `fontSizeAtom`; `src/App.tsx:214-217` builds the theme with
  `createAppTheme({ primaryColor, spellCheck })` inside `useMemo`.
* P2 — `src/styles/theme.ts:22-30` `createAppTheme` is documented as the "Sole application theme
  factory; settings-derived values are injected here", and sets no `breakpoints`.
  `src/components/home/StartupStorageFailure.tsx:9-12` is its only other production caller (built
  at module scope with defaults; the App, and therefore the root font scale, is not mounted there).
  Test callers: `src/App.test.tsx:563` (asserts the exact argument object),
  `src/components/settings/ColorControl.test.tsx:43`, `src/components/settings/ThemeButton.test.tsx:29`.
* P3 — `src/state/atoms.ts:271-275` `fontSizeAtom` persists `"font-size"`; default 100;
  `src/state/utils.ts:88` validates only "finite number". `FontSizeSlider.tsx:19-21` offers 50–200.
* P4 — Mantine 8.3.14 (`pnpm-lock.yaml:25`): default breakpoints xs 36em, sm 48em, md 62em,
  lg 75em, xl 88em (`@mantine/core/esm/core/MantineProvider/default-theme.mjs:70`). Responsive
  style props resolve a key to `(min-width: ${theme.breakpoints[key]})`
  (`core/Box/style-props/parse-style-props/parse-style-props.mjs:68`); SimpleGrid in its default
  `type="media"` builds its queries from the same theme values
  (`components/SimpleGrid/SimpleGridVariables.mjs:35,57`). `useMediaQuery` passes its string to
  `window.matchMedia` (`@mantine/hooks/esm/use-media-query/use-media-query.mjs:27`).
* P5 — Media-query `em`/`rem` resolve against the initial font size, not the root element's
  computed size (CSS Media Queries; the finding's evidence, measured in the f-20260829-02
  investigation). The root is set as a *percentage of that same initial size* (P1), so
  `(N × s/100)em` in a media query equals N scaled root-em for any UA default font size.
* P6 — Inventory of width switches (probe-1-r1):
  * JS media queries: `SettingsPage.tsx:127` `(max-width: 50rem)` → Tabs `orientation` at `:794`;
    `FilesPage.tsx:47` `COMPACT_DIALOG_QUERY = "(max-width: 30em)"`, used at `:67` → `AppModal
    fullScreen` at `:428`.
  * CSS: `SettingsPage.module.css:69` `@media (max-width: 50rem)` — styles `.settingsContent`,
    `.card`, `.settingsTabs`, `[role=tablist]`, `[role=tab]`, `.item`, `.settingControl`.
    `.card`/`.item` are also rendered by the search-results branch outside the Tabs
    (`SettingsPage.tsx:710,731`) and by `SettingRow` (`SettingsLayout.tsx`, used only by
    SettingsPage). The page root is the `Stack` at `SettingsPage.tsx:761`.
  * Theme-key switches (fixed by the theme alone): SimpleGrid `cols` at `AddDatabase.tsx:169`,
    `DatabasesPage.tsx:216,299`, `AddEngine.tsx:88,113`, `EnginesPage.tsx:135`,
    `UpgradeEngineModal.tsx:151`, `FilesPage.tsx:260`, `NewTabHome.tsx:241`; responsive style
    props at `DatabasesPage.tsx:217,227,281,390,410`, `FileCard.tsx:98`, `FilesPage.tsx:234,236,261,355`.
  * No `visibleFrom`/`hiddenFrom`, `Grid` breakpoint objects, `useMatches`, `matchMedia` or
    `window.innerWidth` in `src`; no other `@media`/`@container` in renderer CSS.
  * Already scale-aware, out of scope: `FileCard.tsx:22-51` compares the card width with 26 ×
    the computed root font size. `__root.tsx:273` AppShell `breakpoint: 0` (numeric px; no switch).
* P7 — e2e (probe-2-r1): `e2e/fixtures.ts:356` `fontScaleByProject` seeds
  `localStorage["font-size"]` per project (`:614`) before startup. Projects at 200 %:
  `database-files` 800×720, `accounts-puzzles-engines` 1440×900, `settings-responsive` /
  `async-errors` / `security-consent` 320×720. All others are 100 %. The finding's proof names
  `{ scrollable: "reachable" }`; the real API is `assertNothingClipped(locator, { mode:
  "reachable" })`, wrapped as `assertPageNotClipped(page)` (`e2e/fixtures.ts:72,265`).
  Snapshot path template is `{arg}-{projectName}` (`playwright.config.ts:32`); a project with
  only behavioural assertions needs no baseline. Re-recording runs only in the container
  (`pnpm test:e2e:update`) under the rule in `.claude/skills/verify-ui/SKILL.md` (`d-20260919-13`).
* P8 — `scripts/check-ui-boundaries.mjs` scans every tracked `src/**/*.{ts,tsx,css}` (tests
  excluded) line by line for one-door violations (direct `ActionIcon`/`Modal` imports, unsafe
  focus resets); `pnpm ui:boundary:check` is part of `gates:contract:check`, with its own test
  file `scripts/check-ui-boundaries-tests.mjs`.

## Approach

The defining property (O0) is zoom equivalence; everything else is the one mechanism that
delivers it and the proof that it is delivered.

### O0 — Definition of correct

Quoting the MANDATE: "make the compact/column switch follow the effective width in scaled
root-em". A switch defined at N em of width flips when the viewport is N **scaled** root-em wide,
i.e. at N × s/100 initial-em. At s = 100 every query string is byte-identical to today's, so every
100 % layout and every 100 % e2e snapshot is unchanged. This is the browser-zoom semantics
`d-20260831-16` already chose for the font scale ("scaling the whole UI is what browser zoom does").

### O1 — One scale function, applied to the theme breakpoints

"whether Mantine's theme breakpoints should be rewritten globally or per site": globally.
`createAppTheme` takes the app font scale as a required input and returns Mantine's default
breakpoint set, each value multiplied by s/100 and expressed in `em` (P5 makes `em` exact for any
UA default; a pixel value would assume 16px). One exported pure function performs the scaling and
is the only place the multiplication exists; both O1 and O2 call it. Values are deterministic,
finite em strings without floating-point noise (e.g. 110 % of 48em is `52.8em`).

* `App.tsx` passes `fontSizeAtom`'s value — the same value it writes to the root (P1) — and the
  theme memo depends on it.
* `StartupStorageFailure` passes 100 (named constant beside its existing defaults), because the
  App, and so the root scale, is never mounted there (P2).
* Consequence: every SimpleGrid `cols` object and every responsive style prop in P6's theme-key
  list follows the scale with **no per-site edit**, as will any future one.

### O2 — One hook for width queries that are not theme keys

The two JS queries in P6 (Settings 50rem, Files 30em) go through one renderer hook that takes a
max-width in em, scales it with O1's function and the current `fontSizeAtom` value, and returns
Mantine `useMediaQuery`'s boolean for the resulting query. A font-scale change re-evaluates the
query (Mantine re-subscribes when its query string changes, per the MANDATE's measurement).
`SettingsPage` and `FilesPage` call it with their existing thresholds (50 and 30); the
`COMPACT_DIALOG_QUERY` comment that documents the old fixed-pixel behaviour is replaced to state
the scaled behaviour.

Failure semantics: the hook adds no failure surface of its own; it inherits Mantine's
`useMediaQuery` exactly (`@mantine/hooks/esm/use-media-query/use-media-query.mjs:4-11,19-34`):
before its effect runs it reports `false`; if `window.matchMedia` throws, the effect's catch leaves
the state as it was — `false` on mount, or the previous result after a query change (a font-scale
change); if listener attachment fails after a successful `matchMedia`, the freshly sampled value is
kept but no longer tracks resizes. The hook always passes a well-formed `(max-width: <finite>em)`
query (O1's function returns finite em values for the atom's validated finite input), so in a
webview whose `matchMedia` accepted the previous query, the next one of the same shape is not a new
failure cause. This degradation is deliberately kept unchanged and undiagnosed: it is today's
behaviour at both call sites, every supported webview implements `matchMedia` and
`MediaQueryList.addEventListener`, and a separate fallback would be a mechanism with no MANDATE
obligation behind it.

### O3 — Settings CSS driven by the same boolean

"and drive the CSS side from the same source": the `@media (max-width: 50rem)` block in
`SettingsPage.module.css` is removed. Its rules apply instead under a compact marker that the
Settings page root (the outermost element containing both the Tabs branch and the search-results
branch, P6) carries exactly when O2's hook reports compact — the same boolean that sets the Tabs
`orientation`. No rule of the block is lost or changed; only its condition.

### O4 — (withdrawn in r2)

A `ui:boundary:check` source rule was proposed in r1 and withdrawn under issue I3: it proves no
MANDATE obligation that O5's behavioural proofs cannot, and `push-review-policy.md` "Proof
selection before custom source verification" forbids extending a source checker without one.

### O5 — Verification

* Unit (vitest): O1 — at 100 the breakpoints equal Mantine's defaults exactly; at 200 and 50 every
  value is the default × 2 / × 0.5 in em. O2 — the hook's query string at 100, 200 and 50 for 50em
  and 30em, and a font-scale change switches its result without remount (matchMedia mocked as the
  existing tests do). `App.test.tsx` asserts the new `createAppTheme` argument including the font
  scale it mocks (120 at `App.test.tsx:185`); the two theme-consuming tests pass 100.
* e2e (the MANDATE's proof): a new behaviour-only Playwright project at **1000×720, 200 %**
  (registered in `playwright.config.ts` and `fontScaleByProject`) with no screenshot assertion.
  It proves, on Settings and on one SimpleGrid page (the Databases list/details grid, or the Files
  tree/entry grid if the Databases mock cannot render both panes):
  * at 200 %: Settings' tablist orientation is horizontal and the compact marker is present; the
    grid's two panes are stacked (second pane starts below the first); `assertPageNotClipped(page)`
    holds on both pages;
  * O3's compact CSS, on both branches that render setting rows — an open tab panel and the
    search-results list (a search query typed into Settings' search field): at 200 % a setting
    row's **computed** `flex-direction` is `column` and its control wrapper's width equals the row's
    content width; at 100 % (next bullet) the same rows compute `flex-direction: row`. Geometry
    alone is not the oracle: the row is a wrapping Mantine `Group` whose copy basis (18rem), control
    minimum (12rem) and gap already wrap it at 1000px / 200 % without the compact rules;
  * at 100 % at the same 1000px (font scale overridden per test before startup): Settings' tablist
    is vertical and the grid's panes sit side by side — proving the switch is scale-driven and the
    100 % layout unchanged;
  * at 50 % at 700px: Settings' tablist is vertical (an unscaled 800px threshold would make it
    horizontal) — the other direction of the same defect;
  * live change, no reload: starting at 100 % at 1000px, the font scale is set to 200 % through
    the Settings font-size slider (its real `onChangeEnd` path), after which Settings' tablist is
    horizontal and, navigating in-app (no reload) to the grid page, its panes are stacked —
    proving the mounted App rebuilds its theme and the hook re-evaluates when the atom changes,
    not only at startup.
* Existing snapshots: by O0, no snapshot of a 100 % project and none of a 320px project can move
  (at 320px every switch is already in its narrowest state, before and after). Snapshots of the two
  wider 200 % projects (`database-files`, `accounts-puzzles-engines`) whose captured surface holds a
  P6 grid or style prop **are expected to move** to their stacked/narrow form. They are re-recorded
  under the verify-ui rule: run `pnpm test:e2e:container` first, inspect every `*-diff.png`, accept
  only differences that are the predicted column/compact switch, re-record with
  `pnpm test:e2e:update`, and stop if any snapshot outside those two projects moves. Every moved
  snapshot is named in the commit message.
* Real webview (step 7, verify-ui): `pnpm verify:app` cannot do this as it stands — its only
  option is `--screenshot` (`scripts/verify-app.mjs:433`) and it checks no layout. The verify-ui
  leaf instead runs a **one-off scratch probe** (written under the run's `RUN_TMP`, never
  committed — observation, not a new tool) on the exported harness of `scripts/app-driver.mjs`
  (`startCompositor`, `startDriver`, `Session` with `call` / `/execute/sync`), as recorded practice
  for real-app flows. Against the release binary in WebKitGTK it sets `localStorage["font-size"]`
  to 200, reloads, opens Settings, reads `window.innerWidth` and the tablist's `aria-orientation`,
  then repeats at 100. Pass requires: innerWidth in [801, 1599] (so the outcome discriminates the
  unscaled 800px threshold from the scaled 1600px one), orientation `horizontal` at 200 and
  `vertical` at 100. With unscaled breakpoints the 200 % reading would be `vertical`, so the probe
  fails on revert.

## Decisions and trade-offs

* **Mechanism: scaled theme breakpoints + one scaled hook (chosen)** — the MANDATE's open question.
  Contested alternatives are under `## Decided autonomously` (D1).
* **Global, not per site** (D2).
* **Zoom equivalence as the definition** (D3), which is what makes "nothing changes at 100 %" a
  structural guarantee instead of a test hope.

## Decided autonomously

Run is `full auto`; each entry is recorded in `tasks/decisions.md` by the adopting session.

* **D1 — Which single mechanism makes every width switch follow the app font scale?**
  * Chosen: scale Mantine's theme breakpoints in `createAppTheme` by the font scale (em), plus one
    hook that scales the two non-theme JS queries with the same function; Settings' CSS keyed on
    that hook's boolean.
  * Rejected: CSS container queries — they answer a different question (the component's box, not
    the window), so every threshold also moves at 100 % (Settings' content box is narrower than the
    viewport by the nav rail), SimpleGrid's `type="container"` takes literal width keys and a
    wrapper per grid instead of theme keys (P4), and Settings' Tabs `orientation` is a React prop
    no CSS query can set. Rejected: content-driven wrapping (`auto-fill`/`flex-basis` in rem) —
    rewrites every grid and changes every 100 % layout, and cannot express the Tabs orientation.
    Rejected: an atom-derived pixel query — assumes a 16px UA default; a scaled `em` value is exact
    for any default (P5).
  * Because: one source of truth for theme keys, JS and CSS; zero per-site edits for the nine grids
    and eleven responsive props; byte-identical queries at 100 %.
* **D2 — Rewrite the theme breakpoints globally or per site?** Chosen: globally, in the sole theme
  factory. Rejected: per-site scaled objects — nine grid sites and eleven style-prop sites carrying
  a copy of the same arithmetic (rule 11), and every future grid silently unscaled again.
* **D3 — What does "correct" mean for a width switch under the font scale?** Chosen: zoom
  equivalence (O0). Rejected: tuning each threshold per scale by eye — no oracle, and contradicts
  `d-20260831-16`'s zoom framing.
* **D5 — Which scale does `StartupStorageFailure` use?** Chosen: 100, because it renders without
  the App and the root font is unscaled there. Rejected: reading the persisted scale — that screen
  exists because storage failed.

## Risks / open questions

* The first render of a `useMediaQuery` consumer reports `false` until its effect runs (Mantine's
  `getInitialValueInEffect` default); unchanged from today, not introduced here.
* Changing the font scale now rebuilds the theme object, re-rendering the provider tree once per
  slider release (`onChangeEnd`). Acceptable: it is a settings action, and the root font change
  already reflows the whole app.
* A corrupt persisted `font-size` (≤ 0 or far outside 50–200) is not range-checked today; the
  breakpoints scale by the same value the root uses, so this plan adds no mismatch for any value
  CSS accepts. Filed separately while locating: inbox entry
  `20261008-091923-1457949-1791443963092296318-6.md` ("The persisted app font scale is accepted at
  any finite value…", area `frontend-state`, entry `inline`).
* Committed snapshots of `database-files` and `accounts-puzzles-engines` move (O5). The prediction
  is the gate: a moved snapshot outside them is a regression to fix, never to re-record.

## Not part of this task

* f-20260927-09 (title-bar menu at 320px / 200 %) — separate finding, different files.
* `FileCard`'s preview switch — already scale-aware (P6).
* Layout of grids inside modals relative to the modal's own width — viewport-relative today and
  after; not the MANDATE's defect.
* Range validation of the persisted font scale — filed (Risks).

## Phases

Two phases, in dependency order (phase 2's assertions need phase 1's behaviour). Neither touches
auth, persistence, concurrency or an IPC/API contract; no file matches a Sensitive-Path glob.

### Phase 1 — Scaled breakpoints, hook, Settings CSS, moved snapshots

* Files: `src/styles/theme.ts`, `src/App.tsx`, `src/components/home/StartupStorageFailure.tsx`,
  `src/components/home/StartupStorageFailure.test.tsx` (asserts the exact old `createAppTheme`
  argument object),
  one new hook module under `src/hooks/` (plus its test), `src/components/settings/SettingsPage.tsx`,
  `src/components/settings/SettingsPage.module.css`, `src/components/files/FilesPage.tsx`,
  `src/components/files/FilesPage.test.tsx` (its `jotai` and `@/state/atoms` mocks must expose
  whatever O2's hook reads — today they expose only `useAtom` and no `fontSizeAtom`), unit tests for O1
  (theme) and the updated `src/App.test.tsx`, `ColorControl.test.tsx`, `ThemeButton.test.tsx`;
  the re-recorded PNGs under `e2e/database-files.spec.ts-snapshots/` and
  `e2e/accounts-puzzles-engines.spec.ts-snapshots/` (only those the container run shows moved).
* Obligations: O1, O2, O3, O5 unit and snapshot parts.
* Role: `normal`.
* Proof:
  1. `pnpm vitest run src/styles src/hooks src/App.test.tsx src/components/settings src/components/files src/components/home/StartupStorageFailure.test.tsx`
  2. `pnpm checks:pre-review`
  3. `pnpm test:e2e:container` — before re-recording, its only failures are snapshot mismatches in
     `database-files` / `accounts-puzzles-engines`; the leaf reports each with its diff path and
     stops. The orchestrator inspects every diff; on a resume the leaf runs `pnpm test:e2e:update`,
     then `git status --porcelain e2e/` must list only predicted PNGs, and a second
     `pnpm test:e2e:container` is green.

### Phase 2 — Font-scale breakpoint e2e project

* Files: `playwright.config.ts`, `e2e/fixtures.ts` (`fontScaleByProject` entry), one new spec
  under `e2e/`.
* Obligations: O5 e2e part. No screenshot assertion, so no baseline.
* Role: `normal`.
* Proof:
  1. `pnpm test:e2e:container --project=<new project>` green.
  2. Revert checks, run by the orchestrator on a scratch copy of the tree, each on its own:
     (a) with O1's scale function forced to return the unscaled value, the new project goes red on
     the 200 % and 50 % assertions; (b) with only O3's compact marker moved from the Settings page
     root onto the Tabs element, the new project goes red on the search-results computed-style
     assertion; (c) with only the compact `.item` / `.settingControl` rules removed, it goes red on
     the computed-style assertions in both branches.
  3. `pnpm checks:pre-review`

## Reviews

### Round 1 — r1 (12 lenses, every plan-capable lens; elapsed 289 s wall; adopted 4)

Lens set: review-plan (`--role review-plan`), and at `--role normal` (no Sensitive-Path glob in
the plan's files): review-minimalism, review-correctness, review-tests, review-error-handling,
review-chess-semantics, review-engine-protocol, review-ipc-contract, review-persisted-state,
review-pgn-index, review-platform-semantics, review-tauri-security. Executor: codex (OpenAI high
tier). Not run: review-code-quality, review-root-cause (`plan-review: false`).

Raw verdicts: plan REVISE · minimalism REVISE · correctness APPROVED · tests APPROVED ·
error-handling APPROVED · chess-semantics APPROVED (NOT APPLICABLE) · engine-protocol APPROVED
(NOT APPLICABLE) · ipc-contract APPROVED (NOT APPLICABLE) · persisted-state APPROVED (NOT
APPLICABLE) · pgn-index APPROVED (NOT APPLICABLE) · platform-semantics APPROVED (NOT APPLICABLE) ·
tauri-security APPROVED (NOT APPLICABLE). NOT APPLICABLE reasons checked by the arbiter: each
names only chess trees, engines, IPC, storage encoding/hydration, PGN, OS/FFI or credential
surfaces; the plan reads `fontSizeAtom` without changing its storage, and touches none of the
others — correct.

Raw findings (verbatim):

**lens-plan-r1:**

```text
[blocker] tasks/plans/2026-10-08-font-scaled-breakpoints.md:144 — O5 does not prove that changing the font scale updates the mounted App’s theme. The proposed App test checks only initial arguments (`src/App.test.tsx:560`), and the e2e cases seed each scale before startup. A theme cached at the initial scale could pass these proofs while grids remain unchanged after a slider adjustment. This integration matters because the current theme memo excludes font size (`src/App.tsx:214`). Require a mounted-app scale change that verifies the grid switches without reloading. (confidence: 97)

[blocker] tasks/plans/2026-10-08-font-scaled-breakpoints.md:169 — The promised WebKitGTK proof cannot run as written. `pnpm verify:app` invokes `scripts/verify-app.mjs` (`package.json:78`), whose only parsed option is `--screenshot` (`scripts/verify-app.mjs:433`). It contains no font-scale, Settings orientation, or window-resizing check and starts the compositor with default dimensions (`scripts/verify-app.mjs:1064`, `scripts/app-driver.mjs:168`). Neither phase includes changes to that verifier. Specify an executable real-app probe or include the necessary verifier extension so this command can actually reject incorrect breakpoint behavior. (confidence: 100)

VERDICT: REVISE```

**lens-minimalism-r1:**

```text
[should-fix] tasks/plans/2026-10-08-font-scaled-breakpoints.md:133 — O4 adds two renderer-wide source restrictions without identifying a mandate obligation that O1–O3 and O5 cannot satisfy. Its blanket `useMediaQuery` import ban also covers unrelated features such as `prefers-reduced-motion`. The shared push-review policy’s “Proof selection before custom source verification” requires an uncovered obligation and an explanation of why behavioral checks cannot prove it, even when extending an existing checker. The smallest sufficient plan retains the shared scaling function, two-caller hook, Settings marker and behavioral proofs, while removing O4 and all changes to the two boundary-checker files. This preserves mandate coverage and removes an entire tooling obligation (confidence: 95).

VERDICT: REVISE```

**lens-correctness-r1:**

```text
No correctness defects found in O0–O5. At 1000px/200%, Settings’ threshold becomes 1600px and the grid’s `sm` threshold becomes 1536px, producing horizontal tabs and stacked panes. At 100%, both retain their existing layout.

Limitation: implementation and browser behavior remain unverified in this plan-only review (confidence: 100).

VERDICT: APPROVED```

**lens-tests-r1:**

```text
[should-fix] tasks/plans/2026-10-08-font-scaled-breakpoints.md:147 — No proposed assertion exercises App’s theme update after changing font scale without remounting. Omitting `fontSize` from the theme memo dependencies would pass the factory tests, initial App argument assertion, isolated hook test and startup-seeded e2e cases. Add a live scale-change test that asserts the grid changes columns. (confidence: 98)

[should-fix] tasks/plans/2026-10-08-font-scaled-breakpoints.md:169 — The named `pnpm verify:app` command runs `scripts/verify-app.mjs`, which neither seeds 200% font scale nor asserts Settings’ orientation. No phase adds that check or names a runnable custom probe. The claimed WebKitGTK proof would therefore miss fixed breakpoints. Specify the probe and its failing-on-revert orientation assertion. (confidence: 99)

VERDICT: APPROVED```

**lens-error-handling-r1:**

```text
[should-fix] tasks/plans/2026-10-08-font-scaled-breakpoints.md:119 — O2 leaves subscription-failure semantics unspecified. Mantine catches media-query setup failures silently, returning false initially or retaining the previous result after a query change. O3 would then apply wide or stale Settings styles without any diagnostic. State whether this fallback is intentional and how failure should surface. (confidence: 94)

VERDICT: APPROVED```

Issues (stable IDs):

| ID | Claim | Witnesses | Evidence (arbiter) | Disposition | Authority | Correction (r2) | Status |
|---|---|---|---|---|---|---|---|
| I1 | No proof that a font-scale change updates the mounted App's theme and hook; every proof seeds the scale before startup. | plan r1 #1 (blocker), tests r1 #1 (should-fix) | Confirmed: `src/App.tsx:214-217` memo deps are `[primaryColor, spellCheck]`; `App.test.tsx:563` asserts only the initial argument. | Fix | MANDATE "make the compact/column switch follow the effective width in scaled root-em" (a switch that ignores a live scale change does not follow it) | O5 e2e adds a live change: 100 % → 200 % through the Settings slider without reload; Settings tablist turns horizontal and, after in-app navigation, the grid panes are stacked. | open → r2 |
| I2 | The promised WebKitGTK proof (`pnpm verify:app`) cannot run as written. | plan r1 #2 (blocker), tests r1 #2 (should-fix) | Confirmed: `scripts/verify-app.mjs:433` parses only `--screenshot`; `scripts/app-driver.mjs:168` `startCompositor({ width, height })` and `Session.call`/`/execute/sync` (`:250-305`) are exported. | Fix | Not a new mechanism (a scratch probe on the existing harness; nothing committed). | O5's real-webview item is a one-off scratch probe on `scripts/app-driver.mjs` exports: font-size 200 then 100, innerWidth in [801, 1599], tablist `aria-orientation` horizontal / vertical; fails on revert. | open → r2 |
| I3 | O4's two `ui:boundary:check` rules serve no MANDATE obligation the behavioural proofs cannot; the `useMediaQuery` ban is overbroad. | minimalism r1 #1 (should-fix) | Confirmed: `~/.claude/references/push-review-policy.md:427-436` "Proof selection before custom source verification" applies equally to extending an existing checker. | Fix (withdraw mechanism) | — (removal) | O4 withdrawn; D4 removed; the two checker files leave Phase 1's file list and proof. | open → r2 |
| I4 | O2 does not state subscription-failure semantics (Mantine silently keeps `false`). | error-handling r1 #1 (should-fix) | Confirmed: `@mantine/hooks/esm/use-media-query/use-media-query.mjs:19-34` catches a `matchMedia` throw and keeps the initial value. | Fix | Not a new mechanism (states existing behaviour). | O2 gains a "Failure semantics" paragraph: always a well-formed finite-em query; on missing/throwing `matchMedia` the hook reports `false` exactly as today; no diagnostic added, deliberately. | open → r2 |

Adopted plan-level corrections r1: 4 (I1–I4). Carried: none. Skipped: none. Deferred: none.
Out-of-area filing during Locate (before r1): inbox entry
`20261008-091923-1457949-1791443963092296318-6.md` (persisted font scale not range-checked;
`frontend-state`, `inline`); not a plan issue.

### Round 2 — r2 (closure round: review-plan + witnesses review-minimalism, review-tests, review-error-handling; elapsed 285 s wall; adopted 2)

Raw verdicts: plan REVISE · minimalism APPROVED · tests APPROVED · error-handling APPROVED.

Raw findings (verbatim):

**lens-plan-r2:**

```text
I1 CLOSED — r2 O5:166 adds a slider-driven change without reload and checks Settings plus the grid. This exercises the missing dependency in `src/App.tsx:214` (confidence: 98).

I2 CLOSED — r2 O5:179 replaces the ineffective command with a scratch probe using the existing exports at `scripts/app-driver.mjs:168,250,291,304`, with discriminating viewport and orientation assertions (confidence: 95).

I3 CLOSED — r2 O4:141 withdraws the source restrictions, and Phase 1:257 removes the checker changes (confidence: 100).

[should-fix] tasks/plans/.plan-2026-10-08-font-scaled-breakpoints.md-r2.body.md:128 — I4 NOT CLOSED. Mantine does not always report initial `false` after setup failure. Its catch leaves state unchanged after a query change, and listener registration happens after `setMatches(mediaQuery.matches)`. Evidence: `/home/felixb/Projekte/chessfable/node_modules/@mantine/hooks/esm/use-media-query/use-media-query.mjs:4,25`. State the actual retained-result behavior and whether that degradation is intentional (confidence: 100).

[blocker] tasks/plans/.plan-2026-10-08-font-scaled-breakpoints.md-r2.body.md:257 — Phase 1 omits `src/components/files/FilesPage.test.tsx`. Its atom mock exposes no `fontSizeAtom` (`:25,51`), its Jotai mock exposes only `useAtom` (`:45`), and it renders the real FilesPage (`:313`). O2 introduces an atom-reading hook into that render path, so the required Vitest proof cannot pass with these mocks unchanged. Add this test file and its mock updates to the phase’s write set (confidence: 99).

[should-fix] tasks/plans/2026-10-08-font-scaled-breakpoints.md:287 — The supplied `Full record:` lookup path is empty, despite the required history field in `/home/felixb/.claude/references/review-lens-contract.md:137`. The complete record was accessible through the full-plan path named in DELTA. Include that path explicitly in subsequent review packets (confidence: 100).

VERDICT: REVISE```

**lens-minimalism-r2:**

```text
I3 CLOSED — r2 withdraws O4, removes D4, and drops both checker files from Phase 1. The remaining shared hook serves two existing callers. No new bloat or duplication findings in the revised obligations.

VERDICT: APPROVED```

**lens-tests-r2:**

```text
I1 CLOSED — O5’s slider-driven, no-reload test would fail on the grid-stacking assertion if App’s theme memo omitted the font-scale dependency.
I2 CLOSED — O5 now uses the exported WebDriver harness with a discriminating viewport range. Reverting the scaled Settings query would fail the 200% horizontal-orientation assertion.
VERDICT: APPROVED```

**lens-error-handling-r2:**

```text
[should-fix] I4 NOT CLOSED — O2 specifies a fallback that Mantine does not guarantee.

[should-fix] tasks/plans/.plan-2026-10-08-font-scaled-breakpoints.md-r2.body.md:128 — Mantine’s catch does not reset `matches` to `false`. If a live font-scale change causes `matchMedia` to throw, the hook retains its previous boolean. If listener attachment fails, it retains the newly sampled boolean but stops tracking viewport changes. Settings’ orientation/CSS and Files’ fullscreen state can therefore remain compact or become stale, without diagnostics. The cited Mantine source establishes these outcomes directly. Specify whether retaining that silent degradation is intentional, or require the stated wide-layout fallback (confidence: 99).

VERDICT: APPROVED```

Closures: I1 CLOSED (plan r2, tests r2) · I2 CLOSED (plan r2, tests r2) · I3 CLOSED (plan r2,
minimalism r2). I4 NOT CLOSED (plan r2 #1, error-handling r2 #1/#2) — residual keeps ID I4.

| ID | Claim | Witnesses | Evidence (arbiter) | Disposition | Authority | Correction (r3) | Status |
|---|---|---|---|---|---|---|---|
| I4 (residual) | The r2 failure-semantics text is wrong: Mantine's catch keeps the previous result after a query change, and a failed listener attachment keeps the sampled value untracked; it does not always report `false`. | plan r2 #1 (should-fix), error-handling r2 #1, #2 (should-fix) | Confirmed: `use-media-query.mjs:4-11` (`attachMediaListener`), `:25-33` (`setMatches` before attach; catch returns `undefined` without resetting). | Fix | Not a new mechanism (corrects the statement of inherited behaviour). | O2 "Failure semantics" rewritten to the actual retained-result behaviour, stated as deliberately kept (today's behaviour; a fallback would be a mechanism without MANDATE obligation). | open → r3 |
| I5 | Phase 1's write set omits `src/components/files/FilesPage.test.tsx`, whose `jotai` mock exposes only `useAtom` and whose `@/state/atoms` mock has no `fontSizeAtom`; the Vitest proof cannot pass once FilesPage calls O2's hook. | plan r2 #2 (blocker) | Confirmed: `FilesPage.test.tsx:25` (`stateAtoms` = two atoms), `:45-50` (`jotai` mock = `useAtom` only), `:51`. | Fix | Not a new mechanism (phase write set). | Phase 1 file list names `FilesPage.test.tsx` and the mock obligation. | open → r3 |
| I6 | The r2 packet's `Full record:` lookup path was empty. | plan r2 #3 (should-fix) | Confirmed: the orchestrator's `sed` used `#` as delimiter, so `## Reviews in <path>` was cut (`inputs-r2.txt`). Packet defect, not a plan defect. | Fix (packet) | — | r3 packets carry the full-record path explicitly (built without `sed`). | open → r3 |

Adopted plan-level corrections r2: 2 (I4 residual, I5). I6 is a review-packet correction, not
counted as a plan adoption.

### Round 3 — r3 (closure round: review-plan + review-error-handling (I4) + review-tests (affected by I5's test-file change); elapsed 144 s wall; adopted 3)

Raw verdicts: plan REVISE · tests REVISE · error-handling APPROVED.

Raw findings (verbatim):

**lens-plan-r3:**

```text
I4 CLOSED — r3:125–136 correctly states Mantine’s retained-result behavior and intentionally preserves it. Confirmed in `/home/felixb/Projekte/chessfable/node_modules/@mantine/hooks/esm/use-media-query/use-media-query.mjs:22–34` (confidence: 100).

I5 CLOSED — r3:257–258 adds `FilesPage.test.tsx` and its mock updates, addressing the incomplete mocks at `src/components/files/FilesPage.test.tsx:25,45–51` (confidence: 100).

I6 CLOSED — this packet supplies the full-record path, whose Reviews section exists at `tasks/plans/2026-10-08-font-scaled-breakpoints.md:286` (confidence: 100).

[blocker] tasks/plans/.plan-2026-10-08-font-scaled-breakpoints.md-r3.body.md:262 — Phase 1 requires O3, but the r3 delta deletes that obligation entirely. Its contract required replacing the fixed CSS query while preserving every compact rule and covering both Tabs and search results. Those consumers remain at `src/components/settings/SettingsPage.module.css:69–104` and `src/components/settings/SettingsPage.tsx:731,784`. Restore O3 so the mandate’s shared JS/CSS condition remains an explicit obligation (confidence: 100).

[blocker] tasks/plans/.plan-2026-10-08-font-scaled-breakpoints.md-r3.body.md:254 — Phase 1 omits another affected consumer, `src/components/home/StartupStorageFailure.test.tsx`. O1 adds the required font-scale argument to StartupStorageFailure’s theme call, but this test asserts the exact old argument object at `src/components/home/StartupStorageFailure.test.tsx:130–133`. That assertion will fail, and the narrow Vitest command at plan:265 excludes the home directory. Add this file, update its expectation, and include it in the proof (confidence: 100).

VERDICT: REVISE```

**lens-tests-r3:**

```text
[blocker] tasks/plans/.plan-2026-10-08-font-scaled-breakpoints.md-r3.body.md:155 — R3 deletes O3, while the remaining Settings proof asserts tab orientation, marker presence and clipping, without asserting compact CSS reflow or exercising search results. Restricting the compact styles to the Tabs subtree would leave search-result rows unscaled and pass the named proofs, which never render that branch. Restore the CSS obligation and name a browser assertion that checks compact row geometry in search results at 1000px/200%, with the 100% comparison. (confidence: 96)

VERDICT: REVISE```

**lens-error-handling-r3:**

```text
I4 CLOSED — O2 now matches Mantine’s source: `matchMedia` failure retains false on mount or the previous result after a query change. Failed listener attachment retains the sampled value without resize tracking. The plan explicitly accepts this undiagnosed degradation (confidence: 99).

VERDICT: APPROVED```

Closures: I4 CLOSED (plan r3, error-handling r3) · I5 CLOSED (plan r3) · I6 CLOSED (plan r3).

| ID | Claim | Witnesses | Evidence (arbiter) | Disposition | Authority | Correction (r4) | Status |
|---|---|---|---|---|---|---|---|
| I7 (lineage: I4) | The r3 revision deleted O3 (Settings CSS driven by the same boolean) entirely. Correction-introduced: the I4 rewrite replaced the text from O2's failure paragraph up to the O4 heading, and O3 sat in between. | plan r3 #1 (blocker), tests r3 #1 (blocker, first half) | Confirmed: `plan-r3.md` has no `### O3`; the r3 delta lists no O3 heading. | Fix | Restores r1 content (MANDATE "drive the CSS side from the same source"). | O3 restored byte-identical to r1 (checked with `diff` of the O3 section against `plan-r1.md`). | open → r4 |
| I8 | Phase 1 omits `src/components/home/StartupStorageFailure.test.tsx`, which asserts the exact old `createAppTheme` argument; the vitest proof excludes `src/components/home`. | plan r3 #2 (blocker) | Confirmed: `StartupStorageFailure.test.tsx:130-133` (`toHaveBeenCalledExactlyOnceWith({ primaryColor: "blue", spellCheck: false })`). All four test callers of `createAppTheme` now listed (grep: App.test, ThemeButton.test, ColorControl.test, StartupStorageFailure.test). | Fix | Not a new mechanism (phase write set and proof). | Phase 1 file list adds the file; proof 1 adds it to the vitest command. | open → r4 |
| I9 | No proof exercises O3's compact CSS, and none renders the search-results branch; a marker placed on the Tabs subtree only would pass. | tests r3 #1 (blocker, second half) | Confirmed: O5 asserted orientation, marker presence and clipping only; `SettingsPage.tsx:693-731` renders search results outside the Tabs. | Fix | MANDATE "drive the CSS side from the same source" (O3) — verification of an existing obligation, no new mechanism. | O5 e2e adds: at 1000px/200 % a setting row's control sits below its copy in an open tab panel and in the search-results list; at 1000px/100 % the same rows are side by side. | open → r4 |

Adopted plan-level corrections r3: 3 (I7, I8, I9).

### Round 4 — r4 (closure round: review-plan + review-tests; elapsed 183 s wall; adopted 1)

Raw verdicts: plan REVISE · tests REVISE.

Raw findings (verbatim):

**lens-plan-r4:**

```text
I7 CLOSED — r4:138 restores O3, including preservation of every compact rule and coverage of both branches. Confirmed against `src/components/settings/SettingsPage.module.css:69` and `SettingsPage.tsx:761` (confidence: 100).

I8 CLOSED — r4:267 includes `StartupStorageFailure.test.tsx`, and r4:279 includes it in the proof command. This covers the exact-argument assertion at `src/components/home/StartupStorageFailure.test.tsx:130` (confidence: 100).

[blocker] tasks/plans/.plan-2026-10-08-font-scaled-breakpoints.md-r4.body.md:166 — I9 NOT CLOSED. Below-copy geometry does not prove compact CSS applies. `SettingsLayout.tsx:19` uses a Group whose default is wrapping (`/home/felixb/Projekte/chessfable/node_modules/@mantine/core/esm/components/Group/Group.mjs:27`). The existing copy basis, control minimum and gap (`SettingsPage.module.css:35`, `SettingsPage.module.css:40`, `SettingsLayout.tsx:21`) total 32rem, or 1024px at 200%. They already force wrapping inside a 1000px viewport without the compact rules. Consequently, a marker incorrectly restricted to Tabs can still pass the new search-results geometry comparison. Require an assertion that distinguishes compact CSS from ordinary wrapping in both branches, such as computed column direction or full-width controls (confidence: 96).

Limitation: browser geometry was not executed in this read-only review. The finding rests on the current CSS and Mantine source (confidence: 100).

VERDICT: REVISE```

**lens-tests-r4:**

```text
I7 CLOSED — O3 again requires the shared compact condition on the outer Settings root, covering Tabs and search results.

[blocker] tasks/plans/.plan-2026-10-08-font-scaled-breakpoints.md-r4.body.md:166 — I9 NOT CLOSED. “Control below copy” does not distinguish compact CSS from existing flex wrapping. `SettingRow` uses Mantine Group’s default `wrap: "wrap"`. The unchanged CSS gives copy an 18rem basis and controls a 12rem minimum, with a 2rem gap. At 200%, these require 1024px before page padding, so they already wrap at a 1000px viewport without the compact rules. At 100%, they can sit side by side. Reverting only the compact `.item` and `.settingControl` rules could therefore pass both proposed geometry assertions, including search results. Require an assertion distinguishing the compact layout, such as computed column direction and full-width controls in both branches, and independently revert those CSS rules to prove failure. The shared-scale revert checks orientation and grids but does not isolate this CSS regression. (confidence: 98)

VERDICT: REVISE```

Closures: I7 CLOSED (plan r4, tests r4) · I8 CLOSED (plan r4). I9 NOT CLOSED (plan r4 #1, tests r4
#1) — residual keeps ID I9 (first failed closure of this lineage).

| ID | Claim | Witnesses | Evidence (arbiter) | Disposition | Authority | Correction (r5) | Status |
|---|---|---|---|---|---|---|---|
| I9 (residual) | "Control below copy" does not distinguish O3's compact CSS from the row's ordinary flex wrap: copy basis 18rem + control minimum 12rem + gap 2rem = 32rem = 1024px at 200 %, so the row already wraps at 1000px without the compact rules; the shared-scale revert check does not isolate a CSS regression. | plan r4 #1 (blocker), tests r4 #1 (blocker) | Confirmed: `SettingsLayout.tsx:19-23` (`Group gap="xl"`, Mantine default `wrap`), `SettingsPage.module.css:35-43` (`flex: 1 1 18rem`, `min-width: min(100%, 12rem)`). | Fix | MANDATE "drive the CSS side from the same source" (O3) — verification only, no new mechanism. | O5: the oracle is the row's computed `flex-direction` (`column` at 200 %, `row` at 100 %) and the control wrapper's width equal to the row's content width, in a tab panel and in search results. Phase 2 proof 2 gains two isolated revert checks: (b) marker moved to the Tabs element → search-results assertion red; (c) compact `.item`/`.settingControl` rules removed → both branches red. | open → r5 |

Adopted plan-level corrections r4: 1 (I9 residual).

### Round 5 — r5 (closure round: review-plan + review-tests; elapsed 280 s wall; adopted 0)

Raw verdicts: plan APPROVED · tests APPROVED.

Raw findings (verbatim):

**lens-plan-r5:**

```text
I9 CLOSED — r5 O5 (`tasks/plans/.plan-2026-10-08-font-scaled-breakpoints.md-r5.body.md:166`) requires computed column direction and full-width controls in both branches. These distinguish compact CSS (`src/components/settings/SettingsPage.module.css:95`) from ordinary wrapping (`src/components/settings/SettingsLayout.tsx:19`). Phase 2:297 independently tests marker placement and removal of the compact rules, covering the search branch outside Tabs (`src/components/settings/SettingsPage.tsx:784`). No new defects found in the delta or affected obligations (confidence: 99).

Limitation: browser assertions and revert checks were reviewed against source, not executed in this read-only plan review (confidence: 100).

VERDICT: APPROVED```

**lens-tests-r5:**

```text
I9 CLOSED — O5 now asserts computed `flex-direction: column` and full control-wrapper width in both Settings branches. Ordinary wrapping cannot satisfy the direction assertion. Phase 2 independently reverts marker placement and compact CSS, requiring the search-results assertion and both branches’ assertions to fail respectively.

VERDICT: APPROVED```

Closures: I9 CLOSED (plan r5, tests r5).

### Summary

Five completed rounds; `plan_adopted_per_round` r1=4 r2=2 r3=3 r4=1 r5=0. Per-round wall elapsed
289 s, 285 s, 144 s, 183 s, 280 s (lens wall time, polling included; no quota, dependency or
release waits). Unique issues opened 9 (I1–I9), resolved 9, open 0; skipped 0, deferred 0,
carried 0. Withdrawn mechanism: O4 (`ui:boundary:check` source rules; issue I3). Correction-introduced
defect: I7 (lineage I4, the r3 revision of O2 deleted O3; restored in r4 byte-identical to r1).
I6 was a review-packet defect, not counted as a plan adoption. No rewrite, no split, no
non-convergence trigger (adoptions r3–r5 = 4 against r1–r2 = 6). Same-model disclosure: every lens
ran on Codex (OpenAI high tier); this planner session wrote the plan and arbitrated every
disposition. Out-of-area filing during Locate: inbox entry
`20261008-091923-1457949-1791443963092296318-6.md` (persisted font scale not range-checked).
