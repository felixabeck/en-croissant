# Review handoff: engine arrows

No plan. Inline tier: one behavior, one write leaf. Base `e3aea1f3e2fb911323200e3a24f8517c19afe9ef`. Product commit `a455849b8572b1abb553ab840baebc772f7c3fde`. No finding id. No decision.

Grok orchestrated and arbitrated. Codex wrote the change and ran the read-only lenses. Writer and reviewers are the same OpenAI family. That is disclosed, and it is not a quota fallback.

## Round 1

Reviewed the uncommitted tree. Lenses: `review-correctness`, `review-root-cause`, `review-tests`. Role normal. `src/state/**` was not edited.

Verdicts:

- `review-correctness` APPROVED, no findings
- `review-root-cause` APPROVED, one should-fix
- `review-tests` APPROVED, one should-fix

Adoptions: 1 (T1).

### T1 — preservation order — Fix, closed in round 2

The first preservation test drew the user's arrow after the engine was already enabled. A regression that clears existing node shapes when analysis starts would still pass. Witness: `review-tests` round 1 (should-fix, 98). Correction, in `BoardChooser.test.tsx` from line 165: the engine starts disabled, `onChange` stores the arrow, then the test enables the engine, then disables it. The same `currentNode().shapes` array is asserted across both transitions. `autoShapes` is empty, then blue and paleBlue, then empty. Round 2 did not reopen it.

### R1 — failing-before transcript — Skip

Witness: `review-root-cause` round 1 (should-fix, 100). The lens approved. It asked for a failing-before and passing-after execution transcript. The orchestrator ran the repaired tests and did not capture a stash revert. Source tracing in that report is the cause account: `Board` used to paint cached lines whenever the eval bar was open, and now paints a cached index only when that loaded engine is enabled for the tab. Stored drawings stay on the node.

## Round 2

Closure over `e3aea1f3..a455849b`. Lenses: `review-tests`, `review-correctness`.

Verdicts:

- `review-tests` APPROVED, no finding line
- `review-correctness` APPROVED, no defect. It states T1 is closed by the off, on, off sequence. It did not execute the tests.

Adoptions: 0. T1 CLOSED.

## Proof before this record

`pnpm exec vitest run src/components/boards/BoardChooser.test.tsx src/state/atoms.analysis.test.ts` in the worktree: 19 passed. `pnpm exec tsgo --noEmit` exited 0. `pnpm checks:pre-review` exited 0 on the committed bytes before the commit, artifacts/gates/20261029T054126689Z-2989845. Lanes: frontend-build 9.6s, format-lint 1.1s, coverage-mapping-frontend 0.3s, frontend-mutation-changed-files 906.7s, bundle 0.4s.

`pnpm verify:app` was not run. The change is which autoShapes the board paints. The container suite does not drive an engine, and `pnpm verify:app` cannot register one. No snapshot is expected to move.
