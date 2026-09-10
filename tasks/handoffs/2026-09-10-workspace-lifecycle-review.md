# Workspace lifecycle review and verification

Scope: f-20260901-05 and f-20260906-22. Implementation commits: 813563b7 and 2a6f66df. Decisions: d-20260910-10 and d-20260910-11; startup migration decision d-20260901-15 remains unchanged.

Plan authorship and arbitration shared one root context. Detection ran in separate Codex contexts on the same model family as implementation; separation was between sessions, not model families. Implementation and review used Sol/medium on the sensitive rung.

## Plan review

Three rounds adopted 14, 6 and 0 lens findings. Overlapping reports were counted separately. Changes combined creation and activation into one save, made home updates immutable, propagated receipts through save-before-close, preserved replacement of the last closed tab, covered cleanup refusal, and included native-menu and page navigation consumers. Existing-ID import replacement was deferred to f-20260910-09 because it requires a different transaction design; its file, Link and FEN forms are recorded there.

## Cumulative review verdicts

All fifteen lens findings were Fix and are implemented. One page-switch defect was reported twice. Root-cause, error-handling and PGN-index lenses reported no findings.

| Lens | Finding | Resolution |
| --- | --- | --- |
| Correctness | InfoPanel replaced the tree before saving the selected game number. | Fix: metadata receipt precedes tree replacement. |
| Correctness | BoardAnalysis reset/wrote a new game despite refused metadata. | Fix: gate both side effects on the receipt. |
| Correctness | BoardControls changed game state inside the metadata updater. | Fix: pure updater, then game state only after success. |
| Correctness | InfoPanel deleted the native game before metadata admission. | Fix: persist the predicted count first; compensate native rejection against the captured owner. |
| Persisted state | Page selection could persist a tree under the old game number. | Fix: same InfoPanel ordering repair above. |
| Tests | Save-before-close mocked away the currentTabAtom receipt. | Fix: real Jotai/storage refusal through current and background modal saves. |
| Tests | Close refusal did not exercise pending edits. | Fix: distinguish pending content from durable content; verify preservation and retry cleanup. |
| Tests | Rendered Duplicate action was untested. | Fix: execute the real completion/creation helpers and assert clone wiring plus refused admission. |
| Minimalism | BoardsPage tests copied runTabCreation. | Fix: partial mock retains the production helper. |
| Minimalism | Workspace refusal setup was repeated within lifecycle tests. | Fix: one local helper with explicit spy restoration. |
| Minimalism | cloneDurable exposed an ignored boolean. | Fix: void operation; assertions inspect stored state. |
| Code quality | createTabFromSeed obscured the always-performed commit. | Fix: rename to commitNewTab. |
| Code quality | admitWorkspaceTabs was unreachable. | Fix: remove it. |
| Code quality | The SyncStorage adapter retained unused write/remove branches. | Fix: direct loadWorkspace and saveWorkspace APIs; migration behavior retained. |
| Code quality | Close documentation promised unconditional cleanup. | Fix: document metadata commit followed by attempted local cleanup. |

Root's remaining-consumer sweep added one Fix: FileInfo now preserves its game cache when refreshed metadata cannot be saved. Deletion refinement reads the latest Jotai state, restores only a matching owner's count, preserves concurrent fields, never resurrects a closed tab, and clears only the originating cache.

## Verification before final gates

- Root `pnpm test`: 128 files, 1114 tests passed; TypeScript, scoped oxfmt and diff checks passed.
- Removing creation rollback produced four targeted failures. Moving tree deletion before metadata persistence failed tree preservation. Removing FileInfo's receipt guard failed cache preservation. All mutations were restored and tests passed.
- `pnpm test:e2e:container`: 14 passed, including refused new-tab/close actions, retry and reload. No committed snapshots changed.
- `pnpm build` and `pnpm verify:app --screenshot /tmp/build-workspace-20260910/app.png`: passed. The real app exercised startup, authority/attachment cleanup, IPC refusal/cancellation and titlebar shutdown, with no surviving app or WebKit processes. This harness does not inject workspace quota failures; those are covered by real-atom and renderer-container tests.
- Inspected screenshots: `/tmp/build-workspace-20260910/workspace-write-refusal.png` and `/tmp/build-workspace-20260910/app.png`. No native GTK acceptance is needed for this change.

This protocol handles synchronous storage refusal and exception compensation. It does not promise crash atomicity across storage keys or native files. Final gate and delivery outcomes belong to the build ledger row, which is written after delivery.
