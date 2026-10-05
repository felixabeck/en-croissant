# Review record — variation chooser on the board (2026-10-05)

Build run in an interactive Claude Code session (orchestrator: Claude Opus; executor: Codex).
Plan: `tasks/plans/2026-10-05-variation-chooser-on-board.md` (ignored run artefact; its review
history is reproduced below). Commits: `34ab8588` (feature), `cab618f2`, `5c29f9c7` (review
repairs). Same-model disclosure: Codex (OpenAI high tier) wrote the phase and the repairs and also
ran every review lens; this orchestrator wrote the plan and arbitrated every finding.

## MANDATE

Felix, 2026-10-05: "Currently the picker is down below there. But I think it's more sensible to
have it centered. Because when I look, the whole idea of clicking through the moves is to keep your
vision on the board. and then I don't want to distract myself by looking down to this picker and
then up on the board again. So the picker should display somewhere centrally on the screen or in
the middle of the board and not down there in the notation. Because the whole idea is to keep my
vision on the board and just click through the moves." Chosen design (AskUserQuestion): "Arrows +
small card". Plan approved by Felix before implementation.

## Plan review


### Round 1 (r1) — 8 lenses, Codex high tier; raw reports in /tmp/build-e4b79fe4/lens-*-r1.txt
Verdicts: plan REVISE, chess-semantics REVISE, tests APPROVED (2 should-fix), minimalism, correctness,
code-quality, root-cause, persisted-state APPROVED (no findings).

| ID | Witness | Claim | Disposition | Evidence | Status |
|---|---|---|---|---|---|
| A1 | chess-semantics r1 #1 (blocker) | choice survives `setStart`, which changes the transposition scope without changing root/position | Fix — O1 closes on any `nextContinuation` input change (position, root, headers, practicePath) | `src/state/store/tree.ts:558` setStart mutates only `headers.start`; `:209` scope uses `headers.start` | open → r2 |
| A2 | plan r1 #1 (blocker) | card height unbounded; lower rows clipped/unreachable | Fix — O4 bounded width/height, scrolling rows, selected row kept in view | `src/state/store/tree.ts:773` children appended without limit | open → r2 |
| A3 | plan r1 #2 (blocker) | browser proof covers only the analysis board | Fix — O4 one shared positioned frame for all renderers; O5 e2e geometry for main + preview, puzzle via shared frame/container class + jsdom | `e2e/files-preview.spec.ts:16` reaches the preview board with mocked `lex_pgn`; puzzle e2e has no puzzle DB mock (`e2e/fixtures.ts:378`) | open → r2 |
| A4 | plan r1 #3 (should-fix) | two phases overlap on MoveControls | Fix — single cohesive phase | `MoveControls.tsx:48`, `:110` | open → r2 |
| A5 | tests r1 #1 (should-fix) | no provider-isolation assertion | Fix — carried to CR-1 | — | carried |
| A6 | tests r1 #2 (should-fix) | no proof the bright arrow follows ↑/↓ | Fix — carried to CR-2 | — | carried |

### Round 2 (r2) — closure: plan, chess-semantics, tests; raw reports in /tmp/build-e4b79fe4/lens-*-r2.txt
Verdicts: plan REVISE, chess-semantics APPROVED, tests APPROVED (2 should-fix).
A1 CLOSED (chess-semantics r2, plan r2). A2, A3, A4 CLOSED (plan r2).
A3 Authority (plan r2 #3): the shared positioned frame is necessary correctness for MANDATE "A small
card … sits inside the board at its top edge" — the preview wrapper is not positioned
(`src/components/databases/GamePreview.tsx:110`) and the main board's `role="grid"` element cannot
host a listbox; one frame gives all renderers that placement.

| ID | Witness | Claim | Disposition | Status |
|---|---|---|---|---|
| A7 | plan r2 #1 (blocker), tests r2 #1 (should-fix) | O5 lacks proof for the headers/practicePath invalidation | Fix — O5 unit cases for `setStart`/`setPracticePath` (lineage A1) | open → r3 |
| A8 | plan r2 #2 (blocker), tests r2 #2 (should-fix) | O5 lacks an overflowing-list browser case | Fix — O5 e2e overflow case (lineage A2) | open → r3 |
| A9 | plan r2 #3 (should-fix) | A3 frame lacks recorded authority | Fix — Authority recorded above | closed (arbiter: record-only) |

### Round 3 (r3) — closure: plan, tests; raw reports in /tmp/build-e4b79fe4/lens-*-r3.txt
Verdicts: plan APPROVED, tests APPROVED. A7 CLOSED, A8 CLOSED (both lenses).
Totals: 3 rounds; issues opened A1–A9 (9 unique); closed A1–A4, A7–A9; carried A5→CR-1, A6→CR-2; none open.
plan_adopted_per_round: r1=4 r2=2 r3=0 (carried and arbiter-closed items excluded).

Carried to diff review: CR-1 (two-provider isolation test), CR-2 (bright arrow follows ↑/↓).

## Implementation

Phase 1 (one cohesive phase, `--role sensitive`): Codex write leaf; fix round 1 resumed the same
thread to model `subscribe` in the `BoardsPage.test.tsx` tree-store mock (7 tests red without it).
Proof by the orchestrator: vitest `src/components src/state` 115 files / 1502 tests green;
`pnpm checks:pre-review` green; container e2e failed only on the predicted snapshot, which was
inspected (identical board geometry; popover gone; card at the board's top centre; arrows) and
re-recorded with `pnpm test:e2e:update --project=board-keyboard` — the only snapshot moved:
`e2e/board-keyboard.spec.ts-snapshots/variation-chooser-board-keyboard.png`.

## Cumulative diff review (4ca0b84d..34ab8588)

Lenses: correctness, root-cause, tests, code-quality, minimalism, chess-semantics,
persisted-state (Codex high tier). correctness, root-cause and code-quality first failed with a
provider capacity error and were retried once through `leaf-quota-retry.py --capacity` (§1h).
CR-1 CLOSED (all seven lenses; `TreeStateContext.test.tsx`), CR-2 CLOSED (all seven;
`BoardChooser.test.tsx`).

| ID | Witness | Claim | Disposition | Repair | Closure |
|---|---|---|---|---|---|
| T1 | tests d1 (should-fix) | preview e2e's pawn count does not prove 1. d4 was played | Fix | `cab618f2` asserts pawn squares via `cgKey` | CLOSED d2 (all five) |
| M1 | minimalism d1 (should-fix) | duplicated `press` helper in two suites | Fix | `5c29f9c7` → `src/tests/keyboard.ts` | CLOSED d2 (all five) |
| Q1 | code-quality d1 (nit) | comment misstates Chessground rounding | Fix | `cab618f2` | CLOSED d2 (all five) |

Closure round d2 (34ab8588..5c29f9c7): tests, minimalism, code-quality, correctness, root-cause —
all APPROVED, no new findings. Nothing deferred; no successor.
