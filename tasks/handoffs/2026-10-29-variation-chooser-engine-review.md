# Review record — variation chooser stays open during engine search (2026-10-29)

## Mandate

The move-selector dropdown that opens when several variations are available appears and then disappears within a fraction of a second, only while the engine is working. Fix that bug.

## Diff

`src/state/store/variationChooser.ts`, `src/state/store/variationChooser.test.ts`, `src/components/common/MoveControls.test.tsx`.

`subscribeVariationChooser` used to close on every new `root` reference. `setScore`, which EvalListener calls for each accepted engine line, replaces `root` through immer. The chooser now closes for a root change only when the live continuation is missing or its ordered rows differ by SAN, half-move, or move. Position, headers, and practice-path changes still close it.

## Round 1

| Lens | Verdict |
| --- | --- |
| review-correctness | REVISE |
| review-root-cause | APPROVED |
| review-tests | APPROVED |
| review-chess-semantics | APPROVED |
| review-persisted-state | APPROVED |

### CR-1 — transposed ancestor continuations

* **Claim:** After `1.Nf3 Nf6 2.Ng1 Ng8`, with `d4` also at the root, a score write on the leaf copies `root.children`. Comparing that array by reference closes the chooser even though the moves are still `d4` and `Nf3`.
* **Witness:** review-correctness, round 1, finding 1. `[blocker] src/state/store/variationChooser.ts:49` (confidence 98).
* **Probe:** Before the comparison change, that position left `choice` null, `sameArray` false, and both SAN lists `["d4", "Nf3"]`.
* **Disposition:** Fix. Rows are compared by SAN, half-move, and move fields. The existing choice and selected index stay when they match.
* **Closure:** review-correctness round 2, `VERDICT: APPROVED`. The regression is `keeps the choice when a score write copies a transposed ancestor's continuations`.

### CR-2 — failing-before log

* **Claim:** review-root-cause asked for a recorded failing run of the original subscription.
* **Witness:** review-root-cause, round 1. `[should-fix] src/state/store/variationChooser.test.ts:52` (confidence 100). Verdict remained APPROVED.
* **Disposition:** Skip. The first proof against the new subscription failed `replacing the root closes the list without moving the cursor` in `MoveControls.test.tsx`. The transposition probe above is the failing-before observation for CR-1. Neither belongs in the repository as a log.

## Proof

`pnpm exec vitest run src/state/store/variationChooser.test.ts src/components/common/MoveControls.test.tsx` — 2 files, 27 tests passed, after the move-sequence comparison. `pnpm checks:pre-review` passed, including format, lint, frontend coverage mapping, changed-file mutation (1025.7s), and bundle.
