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
