# f-20261001-08 execution evidence

Latest source checkpoint: verified R4 repairs are committed in `099bfa21`, `db6ac190` and `4ee4ff12`. Independent root proof passed 517 tests across eleven suites, 46 separate parser tests, scoped checks, full pre-review and contract. Workspace-storage and tree/path mutation scores remain 100%. Actual bundle total is 1,619,967 against unchanged 1,620,000. Full raw R4 and focused mechanism history is in `2026-10-10-game-opening-round4.md`. Source closure, pixels, real app, all fourteen native failure/restoration stages, final gates and push remain pending. Earlier phase states below are historical checkpoints.

## Current state at phase completion

Implementation commit: `e72f8008`. Pixel verification, full native verification, all 13 new standalone assertion staging cases, cumulative review, final gates, push and install remain pending at this checkpoint. The finding is still open. Later sections record their outcomes.

The consumed plan and its complete inherited review history are preserved at `tasks/handoffs/2026-10-10-f-20261001-08-review.md`. The adopted plan's authorship and arbitration shared one context. Detection in this run uses fresh Codex contexts from the same model family as the code. Implementation used registry role normal, `gpt-6.1-sol/high`. The coverage registration supplement used mechanical, `gpt-6-luna/max`. Root owns arbitration, verification, commits and push.

## Phase proof

Root inspected the complete source diff and the integration paths. `pnpm i18n:extract` passed. The exact ten-file focused test command from the adopted plan passed 161 tests. It includes common activation, DatabasesPage, GameTable, GameCard, FileCard, GameSelector, InfoPanel, DirectoryTree, files and tabs tests.

The initial executor proof found five new test failures. Schema-valid normalized records corrected four storage admission refusals, and waiting for the observable portal corrected the dirty-dialog assertion. All 161 tests then passed. The executor's pre-review command was refused before starting with `agents.slice MemoryHigh is unavailable`, exit 125. Root independently read the actual slice limit and ran the exact command through the canonical detached gate runner.

Root pre-review initially failed because `src/components/common/gameOpen.tsx` had no coverage-area registration. Its formatting, types, bundle and mutation lanes passed. A bounded mechanical worker added one literal path to the `databases-files` area and its recorded baseline scope. Root parsed the committed and working baseline and proved that version, numeric area metrics, source definitions and other area scopes were unchanged. Every minimum coverage floor was also unchanged. This follows the existing scope-only registration procedure in `scripts/coverage-report.mjs` and commit `8c942059`.

Root's rerun of `pnpm checks:pre-review` and `pnpm gates:contract:check` passed, exit 0. Canonical completion record: `/home/felixb/.claude/drain-state/chessfable-0a459a4f.d/gates-e838b3a7-7402-4e53-a614-eb2da79f3765/gate-root-phase-proof-2.dpK2w6/completion.record`. Focused test evidence and the initial failed pre-review remain in the preceding attempt's log under `gate-root-phase-proof.o5PYrN`. Gates measured the candidate source bytes before the phase commit.

## Retained tests with deliberately reverted wiring

The executor used a disposable Git-sourced snapshot under `/tmp/build-game-opening-3b67c3b9/source-proof`, retaining all 37 phase source/test files byte-identically. Source provenance was `668991ded51df0a6ef0f8f2977f29748e16d3c21`. Root inspected the red and restored output. No missing-module or import failure counted as proof.

| Source-only reversal | Observed failure |
| --- | --- |
| DatabasesPage restored from Git HEAD | Expected one visible Open database button, received zero |
| GameTable row wiring reverted with a Git-derived hunk | Expected one parse call during repeated gestures, received two |
| FileCard restored from Git HEAD | Expected one fresh read of explicit index 1, received zero |
| InfoPanel restored from Git HEAD | Expected one guarded activation load, received zero |
| Shared selector activation removed | Both real-selector gesture tests failed waiting for dirty confirmation |

The first four cases ran together, exit 1 with four failures. Byte-identical restoration produced four passes, exit 0. The two shared-selector cases ran together, exit 1 with two failures. Restoration produced two passes, exit 0. The commands retained the relevant new tests and filtered by their complete behavioral names. Red and green logs are `reversal-a-red.log`, `reversal-a-green.log`, `reversal-b-red.log` and `reversal-b-green.log` in that scratch directory. The original checkout's 1,073 non-environment file hashes, index, HEAD and status were unchanged by this proof pass.

The static AST import inventory included 447 source/test modules and 1,729 local edges, including type imports and literal dynamic imports. GameCard's only production rendering consumer is GameTable. GameSelector's rendering consumers are FileCard and InfoPanel. FileInfo imports its row type only. Root traced these consumers, and the final affected frontend gates also run the broader suite.

## Separate defects

The adopted plan's pre-existing database-view write-refusal and database deletion rejection limits remain assigned to `f-20261010-01` and `f-20261010-02`. Their ledger annotations link the preserved plan review history.

The executor also found the existing InfoPanel discard-page authorization defect. Root confirmed that forced replacement skips the initial dirty check but the later guard rejects the still-dirty tree, while ConfirmChangesModal's compatibility discard callback does not clear or carry discard authorization. Root filed a complete lens-tier entry through `findings.py file`. The drain owns the ledger, so the intake command returned `tasks/findings-inbox/20261010-020003-3905709-1791590403268066877-6.md`. No final ID is invented before the drain merges it. This defect predates the opening controls and remains outside their frozen scope.

## Cumulative review round 1

Range: `5a5dc7e6acf2a8d0a53dbba59c2bdc4117baee77..6d0c000745db3b8d4668cc16dd81aa58fa236f5f`. This includes both inherited drain commits, `4373d64f` and `981db8fc`, as required by push-review-policy section 2. Root fetched and rebased before calculating the range. The worktree was clean at review launch.

All eight launcher leaves completed: correctness, root-cause, tests, code-quality, minimalism, error-handling, persisted-state and records. Seven code lenses used normal. Records used mechanical. All detections used the code's model family in fresh contexts. The adopted plan's authorship and plan arbitration shared one context, and this root arbitrates the cumulative review.

| Issue | Witness and severity | Origin | Root disposition | Closure |
| --- | --- | --- | --- | --- |
| D1 | correctness, blocker 99 | e72f8008 | Fix the verifier's Back lookup, because the production Back control is icon-only with an aria label | Pending |
| D2 | tests, should-fix 98 | e72f8008 | Fix native admission proof to require exactly one new active tab, so an old matching tab cannot satisfy shortcut assertions | Pending |
| D3 | tests, should-fix 99 | e72f8008 | Add the selected database-game preview control to the 320px / 200% journey | Pending |
| D4 | code-quality, should-fix 100 | e72f8008 | Update the current native-check inventory, preserving historical staging counts | Pending |
| D5 | minimalism, should-fix 94 | e72f8008 | Consolidate the labelled and double-click database-opening handlers | Pending |

No Defer or Skip was adopted from this round. No new inherited-commit defect was found. Root-cause, error-handling, persisted-state and records reported no findings. Runtime pixels, native pointer behavior and standalone assertion staging remain pending. The tests and code-quality lenses returned APPROVED with should-fix findings, and root still adopted those findings for repair. Reports are retained as `lens-<name>-r1.txt` under `/tmp/build-game-opening-3b67c3b9`.

Round 1 elapsed wall time was 302 seconds, from stage epochs 1791592007 to 1791592309. Known non-overlapping external waits: none. Active review wall time: unknown. Five unique issues were opened and adopted for Fix. There were no withdrawals, Defer or Skip dispositions, correction-introduced issues, or new inherited-commit defects. `REVIEWED_THROUGH=6d0c000745db3b8d4668cc16dd81aa58fa236f5f`.

### Round 1 raw witness reports

#### correctness

```text
[blocker] scripts/verify-app.mjs:1623 — After GO3 opens the database, GO4’s `overview()` follows the sidebar back to that active database and calls `button("Back")`. This helper matches `textContent`, but DatabaseView’s Back control is icon-only with `aria-label="Back"`. The lookup times out, preventing GO4–GO7 from exercising their intended interactions. Origin: e72f8008. (confidence: 99)

Limitation: source review only. Real WebKitGTK behavior and staged failures remain unexecuted (confidence: 100). Detection used the author’s model family.

VERDICT: REVISE
```

#### root-cause

```text
No root-cause or prior-fix regression findings.

`e72f8008` addresses the mechanism directly: visible labelled controls replace hidden actions, both game lists share activation semantics, explicit targets avoid stale selection, and reserved preview space prevents loading from moving rows. Fresh reads and admission-gated navigation preserve the earlier fixes. Inspected reversal logs show relevant tests failing with wiring removed and passing after restoration.

The inherited `981db8fc` change reports unreadable claim intent instead of misclassifying it as a refused batch.

Limitation: real WebKitGTK pointer behavior, container pixels and standalone assertion staging remain pending. Source and component evidence do not complete O3 (confidence: 100).

Detection used the code’s model family in a separate session. Plan authorship and arbitration shared one context.

VERDICT: APPROVED
```
#### tests

```text
[should-fix] scripts/verify-app.mjs:1542 — `assertOpened` never checks that the gesture admits a new tab. GO6 follows GO5 with the same database target, and GO11/GO12 follow GO10 with the same file target. A regressed shortcut that only navigates to `/` would pass using the previously active matching tab and notation. Compare workspace IDs before and after each gesture and require exactly one new active tab. Origin: e72f8008. (confidence: 98)

[should-fix] e2e/font-scaled-breakpoints.spec.ts:34 — The 320px/200% journey leaves the database overview without opening its game table. It checks the database-card opener and FileCard button, but never GameCard’s new labelled action inside the database preview. Clipping or hiding that control only at narrow widths would pass every added assertion. Add the selected database-game preview to this responsive journey. Origin: e72f8008. (confidence: 99)

Limitation: runtime UI verification and standalone failure staging remain pending. This review does not establish either as completed proof. (confidence: 100)

VERDICT: APPROVED
```

#### code-quality

```text
[should-fix] scripts/verify-app.mjs:70 — The current-check inventory still says “eighty-eight” and omits game opening, although e72f8008 adds GO1–GO13 to the full journey. Update this inventory while preserving the historical staging counts above it. (confidence: 100)

Detection used the code author’s model family. Plan authorship and arbitration also shared one context.

VERDICT: APPROVED
```

#### minimalism

```text
[should-fix] src/components/databases/DatabasesPage.tsx:367 — e72f8008 adds a second database-opening handler duplicating `databaseRouteTarget` navigation and `setActiveDatabase` at lines 316–320, already in opposite order. Extract one local `openDatabase(item)` and route both gestures through it. This preserves O1 while removing duplicated ownership of routing and active-database synchronization (confidence: 94)

VERDICT: REVISE
```

#### error-handling

```text
No new error-handling defects found. Rejections notify, cancellations stay silent, admission refusal prevents navigation, and verifier failures produce a nonzero exit.

Limitation: runtime UI proof and assertion staging remain pending with the root (confidence: 100). No changed premise found for the deferred failure paths.

VERDICT: APPROVED
```

#### persisted-state

```text
No new persistence or tab-lifecycle defects found. Opening paths retain matching tree/workspace encodings, durable admission, captured source identity, and existing unload flushing. Deferred database-view write refusal remains unchanged.

Read-only review. Runtime UI proof remains root-owned and pending. Detection ran on the authoring model family. Plan authorship and arbitration shared one context.

VERDICT: APPROVED
```

#### records

```text
No findings. Source claims, phase-proof logs, and historical status transitions agree with the records.

Unverifiable: exact historical review timings and tool availability at planning time.

VERDICT: APPROVED
```

## Round 1 repair checkpoint

Three file-disjoint write leaves repaired D1 through D5. Verifier and database-handler repairs used normal, `gpt-6.1-sol/high`. The exact responsive-test addition used mechanical, `gpt-6-luna/max`. One database test-harness failure was corrected in a resume by identifying the translated error card through its rendered filename. No production mechanism changed in that resume.

Root inspected all four source/test paths. Syntax, scoped formatting, scoped lint and the 36-test DatabasesPage suite passed. The database worker reversed only the production patch through Git while retaining the new tests. The double-click synchronization-order assertion failed with `expected [ undefined ] to deeply equal [ { type: 'success', …(7) } ]`, exit 1. Byte-exact restoration passed all 36 tests, exit 0. The responsive project listed 12 tests without running a browser.

Root's repaired-tree `pnpm checks:pre-review` and `pnpm gates:contract:check` passed, exit 0. Pre-review mutation elapsed was 291.7 seconds. Completion record: `/home/felixb/.claude/drain-state/chessfable-0a459a4f.d/gates-e838b3a7-7402-4e53-a614-eb2da79f3765/gate-root-repair-proof.hbmedl/completion.record`. This proves repaired candidate bytes before committing, not runtime pixels or native gestures. D1 through D5 remain pending fresh closure review at this checkpoint.

## Cumulative review round 2

Committed delta: `6d0c000745db3b8d4668cc16dd81aa58fa236f5f..de099357adfa9515308b4ac75dd3f87e7a3ff0fe`, with the full upstream range as context. Five code lenses ran normal and records ran mechanical. All six completed. Elapsed wall time was 162 seconds, from epochs 1791593088 to 1791593250. Known non-overlapping external waits: none. Active review wall time: unknown.

D1 through D5 CLOSED with independent source witnesses. Back now uses its existing aria label. All six opening gestures snapshot workspace immediately before activation and require exactly one new active tab. The responsive journey includes the selected database-game preview. The current inventory includes GO1–GO13 without changing historical counts. Both database gestures use one helper synchronizing before navigation.

D6 is a new should-fix coverage gap, tests witness confidence 99, originating `e72f8008`. The unmount test's error assertion did not prove its claimed absence of pending-state publication. Root adopted Fix after opening the test and production hook. This is newly observed original-code coverage, not a defect introduced by the D1–D5 correction. One unique issue was opened and adopted in round 2. No Defer, Skip, withdrawal or reopened mechanism. D6 remains pending repair and closure. `REVIEWED_THROUGH=de099357adfa9515308b4ac75dd3f87e7a3ff0fe`.

Plan authorship and arbitration shared one context. Detection ran in fresh contexts on the same model family as the code. Runtime proof remains pending.

### Round 2 raw witness reports

#### correctness

```text
D1 CLOSED — `scripts/verify-app.mjs:1634` locates the icon-only Back button by `aria-label`, matching DatabaseView.

D2 CLOSED — `assertOpened` requires exactly one new active tab ID. All six gestures pass a pre-activation snapshot, including placeholder replacement.

D3 CLOSED — the responsive journey now selects a database game and checks its enabled, reachable Open game control at 320px/200%.

D4 CLOSED — the inventory lists 101 checks and preserves historical staging counts.

D5 CLOSED — both database-opening gestures call `openDatabase`, which synchronizes the database before navigation. Tests assert that order.

No new correctness defects found.

Limitation: pixel verification, native runtime behavior and standalone failure staging remain pending root-owned proof (confidence: 100). Detection used the code author’s model family. Plan authorship and arbitration shared one context.

VERDICT: APPROVED
```

#### tests

```text
D1 CLOSED — `scripts/verify-app.mjs:1634` locates the icon-only Back button by its aria-label.

D2 CLOSED — `assertOpened` requires exactly one new tab whose ID equals the active tab. Navigation-only shortcuts now fail.

D3 CLOSED — the responsive journey selects a database game and asserts its preview opener is visible, enabled and unclipped at 320px/200%.

D4 CLOSED — the inventory lists 101 checks, including GO1–GO13, while retaining historical counts.

D5 CLOSED — both database gestures use `openDatabase`. `DatabasesPage.test.tsx:222` fails if navigation precedes synchronization.

[should-fix] src/components/common/gameOpen.test.tsx:120 — Newly observed coverage gap, originating in e72f8008: the unmount test only asserts that `onError` remains uncalled. Removing the `mounted.current` guard and calling `setPending(false)` after unmount still passes. It does not prove its claimed suppression of pending-state publication. (confidence: 99)

Limitation: container pixels, real WebKitGTK execution and standalone failure staging remain root-owned and pending. Source closure does not establish runtime completion. (confidence: 100)

Detection used the author’s model family. Plan authorship and arbitration shared one context.

VERDICT: APPROVED
```

#### code-quality

```text
D1 CLOSED — `scripts/verify-app.mjs:1634` finds Back by its aria-label.
D2 CLOSED — `scripts/verify-app.mjs:1553` compares prior tab IDs and requires exactly one newly admitted active tab.
D3 CLOSED — `e2e/font-scaled-breakpoints.spec.ts:34` adds the selected database-game preview and clipping assertion.
D4 CLOSED — `scripts/verify-app.mjs:70` lists 101 checks and includes GO1–GO13, preserving historical counts.
D5 CLOSED — `DatabasesPage.tsx:184` synchronizes before navigation. Both gestures call this handler.

No new readability or local-consistency findings.

Limitation: closure above establishes source corrections only. Pixel verification, native runtime verification and failure staging remain pending (confidence: 100).

Detection used the author’s model family. Plan authorship and arbitration shared one context.

VERDICT: APPROVED
```

#### minimalism

```text
D1 CLOSED — `scripts/verify-app.mjs:1634` locates Back by its existing `aria-label`.
D2 CLOSED — `assertOpened` requires exactly one new active tab, using snapshots captured before all six gestures.
D3 CLOSED — the responsive journey now selects a database game and checks its opener at 320px/200%.
D4 CLOSED — the inventory lists 101 checks and preserves historical staging counts.
D5 CLOSED — `DatabasesPage.tsx:184` centralizes synchronization before navigation for both opening gestures. Originating duplication: e72f8008, repaired by 367f8cdb.

No new bloat or duplication findings. The repair adds no files. Its shared handler, admission check and responsive case directly address the adopted obligations.

Limitation: pixel verification, native runtime proof and failure staging remain pending (confidence: 100). Detection used the author’s model family. Plan authorship and arbitration shared one context.

VERDICT: APPROVED
```

#### persisted-state

```text
No new persisted-state or tab-lifecycle defects found. Tab creation retains the shared compressed writer/reader, durable admission, UUID keys and unload flushing. Deferred database-view write refusal remains unchanged.

D1 CLOSED — Back lookup uses `aria-label`.
D2 CLOSED — Each gesture checks exactly one newly admitted active tab.
D3 CLOSED — Responsive journey includes the selected database-game opener.
D4 CLOSED — Inventory states 101 checks and preserves history.
D5 CLOSED — Both database gestures use `openDatabase`, synchronizing before navigation.

Closures establish source changes only. Pixel verification, native runtime proof and failure staging remain pending. Review used the author’s model family.

VERDICT: APPROVED
```

#### records

```text
No findings. Retained reports, repair diffs, proof logs, and checkpoint statuses agree with the handoff and named contracts.

Unverifiable: historical fetch/rebase, review-launch cleanliness, and exact review timing. Model-family and shared-context limitations are disclosed.

VERDICT: APPROVED
```

## D6 proof checkpoint

The normal write leaf changed only `src/components/common/gameOpen.test.tsx`. Its scoped React wrapper forwards to the actual state setter and preserves setter identity through a WeakMap. The original two gesture tests remain byte-identical and observation is disabled for them. The unmount test now observes initial publication, disabled-button behavior, admitted-promise settlement and absence of further publication or error after unmount.

Root inspected the complete test diff and red/restored logs. The disposable source came from HEAD `de099357adfa9515308b4ac75dd3f87e7a3ff0fe`, production blob `109411cb4dd55504ca5770805e1df06715ebae0b`. Only `if (mounted.current) setPending(false)` was faulted into `setPending(false)`. The identical retained test exited 1 with `expected [ [ true ], [ false ] ] to deeply equal [ [ true ] ]`. Byte-exact restoration passed the same test, exit 0. Both runs used real React lifecycle and successful imports. All 621 protected source, index and HEAD hashes were unchanged. The root-owned concurrent handoff edit was preserved.

Root's three-test command, formatting and lint passed. Pre-review and contract checks remain pending at this checkpoint. Fault and restored logs are `/tmp/build-game-opening-3b67c3b9/unmount-proof/faulted.log` and `restored.log`. Production SHA-256, unchanged between main and restoration: `7993c6b8e63758c1324f49c21cd752bac7f343a3e96b86a8cebdecdc707da703`. Retained test SHA-256: `1f746c7285392b9d6d8dfdd356c7640f509a899f3e3b42f5aca934e69a4c3fa4`.

The D6 repaired-tree pre-review and contract checks subsequently passed, exit 0. Mutation elapsed was 329.1 seconds. The pre-review launch also waited for another project's shared heavy-gate lock, an external dependency wait whose exact duration is unknown. Completion: `/home/felixb/.claude/drain-state/chessfable-0a459a4f.d/gates-e838b3a7-7402-4e53-a614-eb2da79f3765/gate-root-unmount-proof.SSuYfF/completion.record`. The test repair is committed as `2de09d25`, with source closure still pending at this checkpoint.

## Same-area companion D7

Root corrected the earlier disposition of the InfoPanel discard loop. Its being outside the frozen affordance phase did not establish a valid Defer under push-review-policy section 4. The files were already loaded and its repair did not require a separate open design question. D7 therefore receives a separate atomic Fix in this run. The original intake was merged into durable ledger entry `f-20261010-06` by `d8e5c62c`. The consumed inbox file no longer exists. This correction concerns root arbitration, not a decision attributed to Felix. The original P2 and P3 separate design problems remain deferred to their named findings.

Decision `d-20261010-05`, committed as `7935bbae`, chooses ephemeral owner-bound confirmation and the existing immutable root/header snapshot mechanism. It rejects clearing dirty before reading or introducing another persisted counter. Its reversal path is the private page-request and confirmation callbacks with race tests retained.

Two normal write leaves worked on disjoint paths. The InfoPanel leaf captures tab, store, file key, page, generation and controller. It uses the modal's existing explicit-owner interface. Discard captures root and headers while leaving dirty data untouched until replacement commits. Latest Jotai ownership, generation and immutable references prevent stale callbacks and newer edits from being overwritten. Every new page request supersedes earlier work before entering confirmation. Save remains unforced and cancel retains the data.

Root inspected the complete source and test diffs. The 64-test InfoPanel, modal and selector suite passed. Tests include actual-selector discard, cancel, header/move/comment edits during a held read, workspace refusal, owner switches before and during the read, unmounted save continuation, and request supersession. Restoring only original InfoPanel source in a disposable Git-sourced copy while retaining the new tests failed the actual-selector discard-switch case after loading, because the old unsaved root remained. Restoring the repair byte-exact returned all 64 tests to green. Logs: `/tmp/chessfable-d7-proof-nnegctv7/d7-deliberate-red.log` and `d7-restored-green.log`. The worker's integrity evidence covers unchanged main HEAD, index and 1,074 captured paths during that isolated proof.

The script leaf adds GO14: `GO14 confirmed discard replaces the owning current game without admitting a tab`. It edits the actual PGN textarea through WebDriver, updates through the visible control, reads actual dirty publication, sends native Enter to the first InfoPanel row and accepts the real modal through pointer input. Its intended observation is exact first-game content and file index, a clean tree, unchanged active/admitted IDs and no remaining dialog. Runtime proof and failure staging are pending. Root independently proved all thirteen original assertion bodies, all six fresh-tab checks and all subsequent verifier code remain byte-identical. Current inventory is 102 checks plus the existing conditional check, with 14 game-opening assertions. Historical staging counts stay unchanged.

Root's four-file focused suite passed 67 tests. Syntax, scoped format and lint passed. Companion pre-review found a total bundle budget overrun, reporting 1582.1 KiB against 1582.0 KiB. Numeric budgets and baselines are unchanged. Root will repair duplicated confirmation continuation before committing the companion. Full companion pre-review, contract, source closure and runtime proof remain pending at this checkpoint.

The normal InfoPanel writer subsequently consolidated the shared discard/save continuation and removed redundant synchronous checks. Root traced the actual Jotai writer and `currentTabAtom` membership selection before accepting those removals. Owner, generation, controller and immutable root/header guards remain. The 64 tests passed unchanged. A fresh measured bundle reports 539,654 entry bytes, 515,382 largest-lazy bytes and 1,619,996 total bytes against the unchanged 1,620,000-byte limit. Evidence: `/tmp/chessfable-d7-consolidation-6jvs6q7a/bundle-report-complete.json`.

The complete repaired-tree command then passed the 67 focused tests, syntax, scoped format/lint, pre-review and contract gates, exit 0. Completion: `/home/felixb/.claude/drain-state/chessfable-0a459a4f.d/gates-e838b3a7-7402-4e53-a614-eb2da79f3765/gate-root-discard-proof-2.cZR7mf/completion.record`. This is dirty-source phase proof, not a clean final-HEAD gate. The official inbox merge allocated D7 as `f-20261010-06` and committed its entry as `d8e5c62c`. Its original intake disposition is historical. Root's current disposition is Fix in this run. Source closure, pixels, native proof and failure staging remain pending.

Plan authorship and arbitration shared one context. Source implementation used separate write leaves. Detection used fresh Codex readers on the same model family as the code.
## Cumulative review round 3

Committed delta: `de099357adfa9515308b4ac75dd3f87e7a3ff0fe..69677131258a39c4ab9ff07f0c4aece8b39256df`. Seven code lenses and one records lens completed. All confirmed D6 and D7 source closure, with native and pixel proof still pending. Tests opened D8, an ordinary stale rejection coverage gap originating in `db8a07c5`, retained through `8ed6e3ad`. Persisted-state opened D9, replacement index durability preceding tree durability, originating `2a6f66df` and newly reachable through accepted discard. Root adopts D8 Fix and traces D9 before disposition. Records opened R1, a consumed inbox-path preservation claim. Root corrected it to the allocated ledger entry and merge commit.

Plan authorship and arbitration shared one context. Detection used fresh Codex readers on the same model family as the code.

Round 3 elapsed wall time was 324 seconds, epochs 1791596400 to 1791596724. Known non-overlapping external waits: none. Active review wall time: unknown. Three unique issues were adopted, D8, D9 and the records reference correction. D9 is a newly observed ordering hazard made reachable by the D7 correction, not a reopened dirty-authorization mechanism. Root adopts Fix, allocated as `f-20261010-07` by the official inbox merge. Its source design is undergoing separate plan review before implementation.

`REVIEWED_THROUGH=69677131258a39c4ab9ff07f0c4aece8b39256df` for round 3. This records completed review coverage while adopted D8/D9 repairs remained obligations at that checkpoint. The supplemental D9 plan subsequently closed after two rounds, 271 and 152 seconds, with two unique adopted plan issues. Full raw design and review history is committed in `tasks/handoffs/2026-10-10-durable-page-replacement.md`. Decision `d-20261010-06` chooses the stable logical owner with a staged physical tree generation. Its reversal path is the schema, resolver and page-replacement facade with durability tests retained. The source phase was active with no implementation proof yet at that historical checkpoint. Source commit `cb09c965` and the independent root proof now supersede that state, with full evidence in `tasks/handoffs/2026-10-10-durable-page-replacement-execution.md`. A fresh `pnpm ci:remote:check` returned 0 for the then-current upstream's newest completed Test jobs. Final pushed-SHA verification remains pending.

The D8 normal writer added an ordinary-rejection case with an active-owner control through actual discard confirmation. Root inspected the complete diff and red/restored logs. The stale case rejects before React's owner cleanup aborts its signal and preserves both exact trees and origins. Removing only the loadPage catch ownership guard in a disposable Git-sourced copy makes the retained test fail on the unwanted `Ordinary page read failed` notification, exit 1. Byte-exact restoration returns the identical test to green, exit 0. Source is HEAD `69677131258a39c4ab9ff07f0c4aece8b39256df`, blob `7a585a1936c544d98b0494c0a6aa03effeb31ba5`. Production SHA-256: `593cfc74a00152fef29bc3b3a868ee039cb74297bc5a9a519eb72457aec768f7`. Retained test SHA-256: `477e71ef9f343817084de5f0bba17ec2fa3df75e20021f626278817cb3af6d0e`. Main source/index/HEAD and foreign record work remained unchanged during isolated proof.

Root's full 43-test InfoPanel suite, scoped format/lint, pre-review and contract gates passed, exit 0. Completion: `/home/felixb/.claude/drain-state/chessfable-0a459a4f.d/gates-e838b3a7-7402-4e53-a614-eb2da79f3765/gate-root-stale-proof.G9pMKy/completion.record`. Evidence: `/tmp/build-game-opening-3b67c3b9/stale-rejection-proof/evidence.md`. D8 source closure remains pending. D9's design probe recommends a stable logical tab ID plus a physical tree reference, preserving tab settings and resource identity. The probe is not an approval or implementation proof.

### correctness

```text
D6 CLOSED — the strengthened test observes the actual React setter. Removing the unmount guard produces the specific unexpected `[false]` publication failure. Restored source passes.

D7 CLOSED — owner/generation checks and immutable root/header snapshots authorize only the accepted discard. New edits, owner switches, supersession, unmount and workspace refusal preserve the tree. The retained actual-selector test fails against original InfoPanel source and passes after restoration.

No correctness defects found in the reviewed delta or inherited findings.py sync.

Limitation: pixels, real WebKitGTK behavior and GO14 runtime failure staging remain pending (confidence: 100). Detection used the author’s model family. Plan authorship and arbitration shared one context.

VERDICT: APPROVED
```

### root-cause

```text
D6 CLOSED — `gameOpen.test.tsx:132–165` observes calls to the real React state setter across unmount. Removing the mounted guard produces the specific unexpected `[false]` publication failure. Restoring it passes with identical tests.

D7 CLOSED — `InfoPanel.tsx:391–435` removes the discard loop’s cause: acceptance previously bypassed only the initial dirty check, while the post-read check rejected that same dirty tree. Replacement now requires owner-bound authorization and unchanged root/header snapshots. Tests cover newer edits, ownership changes, supersession, unmount, save/cancel and workspace refusal. Restoring pre-repair source reproduces the failed replacement. Restored source passes all 64 tests. The original conflicting guard originated in `490831c77`.

D1–D5 remain CLOSED. No symptom patch or reintroduced prior defect found.

Limitation: container pixels, real WebKitGTK execution and standalone assertion failure staging remain pending, including GO14. Source/test closure does not establish runtime completion. (confidence: 100)

Detection used the author’s model family. Plan authorship and arbitration shared one context.

VERDICT: APPROVED
```

### tests

```text
D1–D5 remain CLOSED.

D6 CLOSED — `gameOpen.test.tsx:165` observes the real React dispatcher. Removing the mounted guard produces `[[true], [false]]`, failing the assertion. Restored source passes.

D7 CLOSED — `InfoPanel.test.tsx:476` asserts replacement after actual selector activation and modal discard. Restoring original production source fails there, retaining the unsaved tree. Tests also assert edit retention, owner changes, cancel, save continuation, supersession and workspace refusal.

[should-fix] src/components/panels/info/InfoPanel.test.tsx:546 — Owner-switch tests only resolve stale reads. The unmount test rejects with cancellation, which remains silent independently of ownership. Removing the catch-path ownership guard at `InfoPanel.tsx:443` would therefore pass while an ordinary stale rejection incorrectly reports an error after switching owners. Add a deferred non-cancellation rejection and assert unchanged trees/origins and no notification. The gap predates this repair in db8a07c5, and the guard was rewritten in 8ed6e3ad. (confidence: 99)

Limitation: container pixels, native GO14 execution and standalone failure staging remain pending. The inherited 981db8fc warning change has no local behavioral regression anchor identified. (confidence: 100)

Detection used the author’s model family. Plan authorship and arbitration shared context.

VERDICT: APPROVED
```

### code-quality

```text
D6 CLOSED — `gameOpen.test.tsx:165` observes the actual React setter. Removing the unmount guard produces the extra `[false]` publication and fails. Restoring it passes.

D7 CLOSED at source level — InfoPanel captures the confirmation owner and discard snapshot. Tests cover newer edits, cancellation, save continuation, owner changes, unmount and workspace refusal. Original-source restoration fails the discard replacement assertion. Repaired source passes.

No readability or local-consistency defects found. The current verifier inventory correctly lists 102 checks and preserves historical receipts.

Limitation: pixels, native runtime proof and GO14 failure staging remain pending (confidence: 100).

Detection used the code author’s model family. Plan authorship and arbitration shared one context.

VERDICT: APPROVED
```

### minimalism

```text
D6 CLOSED — `gameOpen.test.tsx:165` observes the real state setter. Removing the unmount guard produces the extra `[false]` publication and fails the unchanged test. Restoration passes.

D7 CLOSED — `InfoPanel.tsx:367–450` binds confirmation to the owner and immutable root/header snapshots, reusing the existing modal. Tests cover discard, cancel, save, edits, ownership changes, supersession, unmount and workspace refusal. Restoring original production source fails the discard-replacement test. Restoration passes 64 tests.

No new bloat or duplication findings. No files added. The local helpers share required continuations and test setup. GO14 reuses existing verifier helpers. The inherited `981db8fc` findings-script change and SHA stamp introduce no unnecessary abstraction.

Limitation: pixel verification, native execution and GO14 failure staging remain pending (confidence: 100). Detection used the author’s model family. Plan authorship and arbitration shared one context.

VERDICT: APPROVED
```

### error-handling

```text
D6 CLOSED — `gameOpen.test.tsx:131-165` observes actual React setter calls. Removing the mounted guard produces `[true], [false]` and exit 1. Restored source passes.

D7 CLOSED — `InfoPanel.tsx:365-453` binds discard to its owner and root/header snapshot, retains edits on refusal, and surfaces read failures through notifications. Restoring original source fails the discard replacement test. Repaired source passes all 64 focused tests.

No error-handling findings. Inherited `981db8fc` now reports unreadable claim intent explicitly.

Limitation: pixels, native runtime and GO14 failure staging remain pending (confidence: 100). Review used the code’s model family. Plan authorship and arbitration shared one context.

VERDICT: APPROVED
```

### persisted-state

```text
D6 CLOSED — The strengthened test observes the real React state dispatcher. Removing the unmount guard produces the extra `[false]` publication and fails. Byte-exact restoration passes.

D7 CLOSED — `InfoPanel.tsx:393-435` binds discard to the captured owner and immutable root/header snapshot, preserves newer edits, and stops replacement when workspace persistence refuses. Retained actual-selector tests fail against the original source and pass after restoration. Native GO14 proof remains pending.

[blocker] src/components/panels/info/InfoPanel.tsx:423 — Replacement durably saves the new `gameNumber` before persisting its tree. `setState` only queues the tree through `tabStorage.write`, whose later flush can refuse independently. With several tabs near the shared quota, replacing a small dirty game with a substantially larger game can save the new index while retaining the old tree bytes. Reload then hydrates the old dirty game under the new origin and presents a freshness conflict, resurrecting the discarded game. The refusal test uses `createTreeStore(undefined, ...)`, so it never exercises tree persistence. Pre-existing ordering from `2a6f66df`, retained and newly reachable through successful dirty discard in `8ed6e3ad`. Replacement needs a coordinated durability/refusal contract. (confidence: 97)

Detection ran on the same model family as the code. This was read-only source review.

VERDICT: REVISE
```

### records

```text
[should-fix] tasks/handoffs/2026-10-10-game-opening-execution.md:280 — Claims the original intake “remains preserved at” the named inbox path, but that file no longer exists after the recorded merge. Replace this stale preservation claim with the durable ledger entry `f-20261010-06` and commit `d8e5c62c`. (confidence: 100)

Unverifiable: exact historical review timing, launch cleanliness, and context/model provenance. Retained source, test logs, hashes, bundle measurements and completion records support the other checked claims.

VERDICT: REVISE
```

