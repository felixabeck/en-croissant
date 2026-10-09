# Compact title-bar menu implementation and review

This full-auto interactive Codex run adopts f-20260927-09's reviewed plan. The consumed bundle's adoption gate returned `clear` at BASE e09c186690767e13643288df38505c82126d5bd5. The original plan and complete plan-review history are preserved separately in the dated adopted-review handoff. This file records implementation, proof, cumulative review and coordination closure. Final gates, push, required remote CI and installation are recorded after they occur in the build ledger.

Plan authorship and arbitration shared one original context. This root adopted that plan, wrote bounded implementation and repair briefs, and arbitrates their results. Detection runs on Codex, the same model family as the code, in fresh sessions. The persistent normal writer resolves to gpt-6.1-sol/high. Normal and sensitive write roles resolve identically, so the two proof resumes retain the same execution ceiling.

## Adopted obligations and decisions

One cohesive phase implements the compact affordance and responsive focus ownership, shared actions and accessible nested navigation, and the existing journeys with screenshot evidence. No inherited obligation remains open. Decisions d-20261009-05 through -07 record the existing scaled 48em hook, one IconAction with File/View/Help Mantine groups and shared action rendering, and agent visual acceptance in the pinned container. Their reversal paths preserve the responsive and action contracts and require new evidence or Felix changing the acceptance owner.

The inherited completed plan rounds are r1/r2/r3, elapsed 248.110983 / 228.671983 / 211.124734 seconds. Adopted count encoding is r1=1 r2=0 r3=0, exactly as published metadata. Two unique issues were closed: P1 required actual no-controls browser geometry instead of jsdom, P2 corrected reviewer rule delivery. P2 was a nit-only delivery correction, not a second counted substantive adoption. No separate review waits were identified in inherited metadata, and active wall time is unknown. Full raw reports remain in the adopted history.

## Implementation and proof repairs

The writer owns TopBar.tsx, TopBar.module.css, the new real-Mantine TopBar.menu.test.tsx, async-errors.spec.ts, settings-responsive.spec.ts and predicted screenshots. Root owns records, inspection, proof reruns, staging, commits and push. No parallel source writers were used. The new menu uses existing translations, components and design tokens, with no new dependency, setting, observer or service. Native menu construction, callbacks, decorations, host-window subscription, storage formats and IPC remain unchanged.

D1 Fix: root inspected the initial compact root and no-controls captures and saw the Anwendungsmenü tooltip covering Datei. The leaf independently corrected the compact root layer through Mantine's popover layer plus one. Root required an open-root screenshot anchor because closed-menu snapshots and clipping assertions did not guard visual occlusion. Removing only that layer prop made the new assertion fail with 14,704 differing pixels. Exact source restoration made the focused test pass. Production SHA256 before and after restoration is 63904c7a1ab00cfa3a43bc8770239b10a9676574e035fb0d840dd42c2c8fc984. New baseline SHA256 is 73594fb2985168d05c0f9e97afefefcf763c439092f7a5ff5fc7fedd7c8811b1. The full D1 proof was RED, with 57 browser cases passing and the updated Settings About journey failing. It is not represented as green.

D2 Fix: the Settings journey pressed About immediately after entering Help, racing Mantine 8.3.14's scheduled first-item focus. It now awaits Documentation focus, uses End to navigate, asserts About focus and presses Enter through the page keyboard. Five repeated journeys passed, including the real focus-boundary expectations in every trace. D2 is a correction-introduced test defect in the phase's Settings consumer update. Production source and all 30 snapshots stayed byte-identical during this repair. D2's unit/browser/contract proof passed 56/58/contract, but its final pre-review command exited 125 before any lane started because the leaf could not connect to the user bus and read agents.slice MemoryHigh. This is a launcher refusal, not green pre-review. Root confirmed the same limit was available outside the leaf and independently reruns the complete exact proof block through the canonical detached managed route.

The original initial phase's complete proof passed 56 unit and 58 browser tests, contract and pre-review. The first mutation check passed its registered workspace-storage and tree-path packages at 100%. That score is not a mutation score for TopBar. The git-backed central regression stashed only TopBar.tsx and TopBar.module.css, left new tests in place, verified pre-fix source matched HEAD, and failed the compact-affordance assertion. Restoring and dropping that exact stash passed all four compact journeys and verified source hashes. The two proof repairs strengthen evidence and timing synchronization, with no requirement or architecture change.

## Baseline and image inspection

Before production source edits the pinned renderer measured de-DE at 1280px/100% through the existing Settings slider. Header x/y/width/height is 0/0/1280/36. Logo is 12/8/20/20. Datei is 42/7/45.875/22, Ansicht 87.875/7/57.96875/22, Hilfe 145.84375/7/41.609375/22. Controls are 1145/0/45/36, 1190/0/45/36 and 1235/0/45/36. These exact values are regression assertions. The temporary probe was removed. Baseline geometry, screenshot, complete output and exit status remain under the run's wide-baseline directory.

The initial full pinned suite had 86 passes and 14 stale-snapshot failures before recording. Root inspected all 14 diffs, comparison crops and all 14 full updated frames. Intended visible changes are in the custom header. Raw comparisons disclose isolated one-level RGB quantization outside the header in two pre-update images, and one such pixel in the retained async-errors baseline, under existing Playwright comparison rules. No tolerance, clipping assertion, budget or floor changed. Only 14 predicted existing basenames moved. Five predicted existing snapshots stayed identical. The font-scaled-breakpoints project has no existing committed snapshot basename. D1 adds one open-popup snapshot. Every update ran in the pinned container through the project wrapper.

Existing moved snapshots:

- account-download-durability-uncertain-accounts-puzzles-engines.png
- accounts-puzzles-engines-accounts-puzzles-engines.png
- home-summary-failed-statistics-accounts-puzzles-engines.png
- home-summary-partial-statistics-accounts-puzzles-engines.png
- async-errors-async-errors.png
- async-errors-personal-database-async-errors.png
- confirmation-error-async-errors.png
- files-file-selected-async-errors.png
- purge-durability-uncertain-async-errors.png
- purge-partial-removal-async-errors.png
- database-files-database-files.png
- database-unfinished-import-database-files.png
- security-consent-security-consent.png
- settings-responsive-settings-responsive.png

New snapshot: compact-menu-root-async-errors.png. Acceptance captures also include compact-menu-root, compact-menu-Datei, compact-menu-Ansicht, compact-menu-Hilfe, compact-menu-no-controls and title-bar-wide-100. Root inspected the baseline, all group captures, actual no-controls surface and the tooltip withdrawal diff/actual/expected. These prove the mocked renderer, not native GTK chrome or native drag. The plan's native-lifecycle/IPC trigger for verify:app is not met.

## Final source review and visual verification

This section supersedes the initial revision's pending cumulative-review and browser state. Final delivery gates, push, CI and installation are still pending here and will be recorded after observation in the build ledger.

Root's exact independent repair proof passed five TopBar unit tests, the contract gate and all selected managed pre-review lanes. Mutation took 312.9 seconds. The completion receipt is /home/felixb/.claude/drain-state/chessfable-0a459a4f.d/gates-1cf4a61d-44b1-43a6-a13d-64de5c14e146/gate-root-repair-proof.FTiWNe/completion.record, exit 0. Mechanical writer fix-1 used gpt-6-luna/max, handle 01a11ea7-46fe-74f1-bc58-691ffab29aeb. Its own proof also passed, with mutation 353.4 seconds. Root inspected the entire diff before committing e99492f1050517b5d76795a6ad435949a81bd47e. Timings, assertions and CSS declarations are unchanged.

Cumulative review r2 covers ff4ed679..e99492f1 with full merge-base context. Correctness, tests and code-quality each approved and closed CQ-1, CQ-2 and CQ-3. Elapsed packet-to-observed-terminal wall is 140 seconds. Three reports completed, zero adoptions, no fallback. Active wall is unknown, with no identified quota, dependency or release waits. Total diff rounds r1/r2 are 230/140 seconds, diff_adopted_per_round r1=3 r2=0. Three unique new lens issues are closed. REC-1 remains durably deferred to existing f-20261009-01. No Skip, new correction-introduced source defect, withdrawn change, split or open title-bar obligation remains. D1 and D2 are the separate two implementation-proof repairs, not additional lens adoptions.

The original phase artifact spans approximately 1626 seconds, D1 resume 371 seconds and D2 resume 253 seconds. These are artifact-time measurements, not active work estimates. Fix-1's artifact span is measured separately in the build ledger. The inherited plan's three completed rounds remain distinct from these two diff rounds and retain r1=1 r2=0 r3=0. No durations of parallel reviewers are summed.

Root invoked the project verify-ui bridge and canonical contract. pnpm test:e2e:container passed all 100 scenarios in 50.2 seconds. Browser receipt is /home/felixb/.claude/drain-state/chessfable-0a459a4f.d/gates-1cf4a61d-44b1-43a6-a13d-64de5c14e146/gate-browser-verification.fhmBVe/completion.record, exit 0 on e99492f1. Retained complete output and results are compact-titlebar/verify-ui-results beneath the scratch root. Root freshly inspected all six compact/group/no-controls/wide acceptance images and confirmed fit and no tooltip occlusion. No additional snapshots changed. Native GTK chrome and drag remain outside this renderer proof, with no new native behavior in the assignment.

The adopted dated review handoff preserves every raw plan report. Raw diff reports and dispositions follow below. The final records closure report will be preserved verbatim in the post-push run ledger, avoiding a self-referential stream of review-history commits.

## Runtime evidence paths

Run root: /tmp/build-aa086ec3-e330-43b6-843b-8d52f9f401f9. This path is reused by the enclosing drain across clusters. Only files from this finding's timestamps or the fresh compact-titlebar directory are authority here. Earlier same-named review artifacts outside compact-titlebar belong to prior findings and were excluded.

Initial leaf report: phase-report.md and compact-titlebar/phase-1-initial-report.txt. Initial proof logs: proof-01-vitest.log through proof-04-pre-review.log. Central source revert: regression-red.log, regression-green.log, regression-driver.log and matching result directories. Pre-update images: full-suite-before-update-results. D1: compact-titlebar/repair-report.md, anchor-red.log/anchor-green.log and matching result directories. D2: compact-titlebar/d2/report.md, repeats.log, focus-boundary-results.log, proof logs and matching result directories. Protected source and snapshot hashes accompany each repair.

Root exact proof attempt: /home/felixb/.claude/drain-state/chessfable-0a459a4f.d/gates-1cf4a61d-44b1-43a6-a13d-64de5c14e146/gate-root-phase-proof.jjEdP7. Its completion.record is exit 0. Root independently passed all 56 unit and 58 browser cases, the contract gate and the managed pre-review lanes. The selected mutation lane took 319.5 seconds. Source commit is ff4ed679cd5e7cfbb8ef2af17af87658676abbaf. Cumulative source and records reviews, arbitration, their elapsed metrics and raw reports are appended after completion. Final gates, push, CI and installation remain pending at this initial review revision.

## Cumulative review r1 arbitration

Reviewed through ff4ed679cd5e7cfbb8ef2af17af87658676abbaf from merge base 88cec5b16ded0ae2df73d79db94c53d9edf53742. Exact packet-to-observed-terminal wall is 230 seconds. The first stage detail's 260-second value was an estimate and is superseded by this measurement. Active time is unknown. No quota, dependency or release wait was identified. Eight leaves completed, with no fallback.

CQ-1 Fix, confidence 94, source ff4ed679. The new 150ms pointer grace is an interaction policy and lacks a name and rationale. Preserve the value, name it, and explain below-parent travel.

CQ-2 Fix, confidence 95, source ff4ed679. The new 175ms unit-test settling wait lacks its meaning. The installed Mantine 8.3.14 MenuSub implementation schedules entering and returning focus after 16ms. The helper also accommodates the existing 150ms close grace. Preserve delay and assertions, name and explain it.

CQ-3 Fix, confidence 98, source ff4ed679. The old CSS explanation was left stale by the compact branch. Qualify scrolling as wide-branch behavior without changing CSS.

REC-1 Defer, confidence 100, pre-existing record below e09c1866. The stale findings preamble is already durably tracked by the carried e09c1866 merge as f-20261009-01. That entry precisely names the false no-Python-suite and conditional-gate claims. No duplicate is filed and no extra maintenance package is pulled into this title-bar task.

Correctness, root-cause, minimalism, tests and error-handling found no defects. Platform semantics is not applicable, with no OS mechanism changed. There were no carried CR obligations. Three unique new issues adopted, one existing defect deferred, zero skips. All fixes are bounded naming or comment edits. No requirement or architecture revision. The selected fix leaf uses the mechanical rung.

Plan authorship and original arbitration shared one context. This root arbitrates the cumulative review. Detection ran on the same Codex model family as the code, with fresh session separation.

### Raw r1 correctness

```text
No correctness defects found in the responsive switch, focus ownership, shared actions, or submenu navigation. Inspected proof records show 56 unit and 58 browser cases passed, including the tooltip-overlap regression.

Limitation: this read-only review did not independently exercise WebKitGTK behavior (confidence: 100).

VERDICT: APPROVED
```

### Raw r1 root-cause

```text
No findings. The compact form removes the width competition that hid the menus. Source-withdrawal logs confirm the regression fails before and passes after. The tooltip-layer withdrawal also fails the new screenshot assertion.

History inspection found no reintroduced defect. Prior one-row layout, control sizing, app-theme selection and action handling fixes remain intact.

VERDICT: APPROVED
```

### Raw r1 code-quality

```text
[blocker] src/components/TopBar.tsx:62 — `closeDelay={150}` introduces an unnamed timing policy governing pointer travel from a group into its submenu. Name the hover grace period and explain why it is needed for the below-parent placement. Named interaction delays already exist in `src/components/panels/practice/PracticePanel.tsx:83`. (confidence: 94)

[should-fix] src/components/TopBar.menu.test.tsx:87 — The keyboard helper waits an unexplained `175ms` after every key. The reader cannot distinguish a submenu-close wait from Mantine’s scheduled focus transfer. Name the intended settling interval and document the library behavior it accommodates. (confidence: 95)

[nit] src/components/TopBar.module.css:67 — The comment says the menu strip scrolls once window controls reach their minimum width. Narrow layouts now replace that strip with the compact menu, so the explanation describes the previous layout. Qualify it as wide-branch behavior or update it. (confidence: 98)

Detection ran on the same model family that wrote the code, with fresh-session separation.

VERDICT: REVISE
```

### Raw r1 minimalism

```text
No bloat or duplication findings. `MenuOptions` serves both layouts. `CompactMenuGroup` owns concrete navigation behavior. New helpers reuse existing scale, icon and fixture infrastructure.

Minimum-diff counterfactual: retain the new 154-line component test for rendering/action parity and the open-menu snapshot for the demonstrated tooltip overlap. Deleting either loses required coverage. No substantial removable layer identified.

Review was read-only and used the same model family as the author. No tests rerun.

VERDICT: APPROVED
```

### Raw r1 tests

```text
No findings within this lens.

The central source revert fails `e2e/async-errors.spec.ts:55` because the compact affordance disappears. Removing only the menu layer prop fails the screenshot assertion at line 117, with 14,704 differing pixels showing tooltip occlusion. Both retained restoration runs pass.

Assertions cover mouse and keyboard actions, focus transfer and preservation, wide baseline geometry, and no-controls layout. Normal unit and container e2e selectors include these tests. The independent phase proof records exit 0.

Limitation: these tests establish mocked Chromium renderer behavior, not native actions or WebKitGTK behavior (confidence: 100). This review shares the code author’s model family.

VERDICT: APPROVED
```

### Raw r1 error-handling

```text
No error-handling defects found. Menu actions retain the notification boundary and original failure message. Decoration-installation failure preserves the previous decoration state and exposes the error.

Limitation: supplied runtime proof exercises decoration failure, but not rejected actions through compact submenus. That path was traced through the shared callback handlers and existing rejection tests (confidence: 100).

VERDICT: APPROVED
```

### Raw r1 platform-semantics

```text
NOT APPLICABLE: The diff changes React menu rendering, CSS, frontend tests, snapshots and records. It introduces no OS-specific path, handle, filesystem, ABI, Rust `cfg` or native-platform mechanism within this lens’s scope.

VERDICT: APPROVED
```

### Raw r1 records

```text
[should-fix] tasks/findings.md:20 — The standing preamble falsely says there is no Python test suite and limits the check to task changes or filing. `scripts/findings-atomic-write-tests.py` defines three tests, and `package.json:20` includes both tests and ledger validation in the unconditional contract gate. Already tracked as f-20261009-01, this pre-existing claim remains incorrect. (confidence: 100)

No additional findings. Decision receipt hashes, snapshot counts, regression evidence and root proof results match the handoff.

VERDICT: REVISE
```

### Raw r2 correctness

```text
CQ-1 CLOSED — named constant preserves the 150ms close delay and explains pointer travel.
CQ-2 CLOSED — named constant preserves the 175ms wait and documents Mantine’s 16ms focus transfer.
CQ-3 CLOSED — comment distinguishes wide scrolling from compact rendering. CSS declarations are unchanged.

No correctness defects found in the repair or its enclosing code. Root repair proof records exit 0.

Limitation: WebKitGTK behavior was not independently exercised (confidence: 100). Review used the code author’s model family.

VERDICT: APPROVED
```

### Raw r2 tests

```text
CQ-1 CLOSED — The named 150ms constant preserves the hover delay and explains pointer travel.
CQ-2 CLOSED — The named 175ms constant preserves the settling wait and documents both timings.
CQ-3 CLOSED — The CSS comment now distinguishes wide scrolling from compact replacement.

No findings within this lens. The central source revert fails the compact-affordance assertion at `e2e/async-errors.spec.ts:55`. Removing the menu layer fails the screenshot assertion at line 117 with 14,704 differing pixels. The retained image shows tooltip occlusion. Both restoration runs pass.

Assertions guard action dispatch, keyboard navigation, focus ownership, wide geometry and no-controls layout. Normal unit and container selectors include them. The independent repair proof records exit 0.

Limitation: evidence establishes mocked Chromium behavior, not native actions or WebKitGTK behavior (confidence: 100). Review used the code author’s model family in a fresh session.

VERDICT: APPROVED
```

### Raw r2 code-quality

```text
CQ-1 CLOSED — `TopBar.tsx:24` names the unchanged 150ms hover-close delay and explains below-parent pointer travel.

CQ-2 CLOSED — `TopBar.menu.test.tsx:30` names the unchanged 175ms settling delay and documents both the close grace and Mantine’s verified 16ms focus scheduling.

CQ-3 CLOSED — `TopBar.module.css:67` qualifies scrolling as wide-layout behavior and explains compact replacement.

No new readability or local-consistency findings. Repair proof records exit 0. Detection used the same model family as the author, with fresh-session separation.

VERDICT: APPROVED
```
