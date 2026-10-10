# f-20261001-08 execution evidence

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
