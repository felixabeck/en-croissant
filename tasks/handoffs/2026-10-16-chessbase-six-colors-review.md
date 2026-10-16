# Six-color ChessBase drawing review

Task: f-20261016-02. Felix approved six-color drawing support, independent per-entry parsing, original color-code preservation and exact repertoire examples, full auto executor Codex, in a separate worktree.

Original base: 1a4305ed99259c861c266d85284aebbe048634c9.
Worktree: build/chessbase-six-colors-chessbase-six-colors-20261016-153044-fe41d32b-20261016.
Plan: tasks/plans/2026-10-16-chessbase-six-colors.md.
Decision: d-20261016-22. Reversal is a revert of the cohesive source commit, without rewriting user files.

Plan authorship and arbitration shared one context. Detection ran on the same model family as the code in separate Codex sessions. Implementation role sensitive resolves to gpt-6.1-sol/high, diff lenses to the registry read rung. No family separation is claimed.

## Plan arbitration

P1, review-plan r1: saved-tab migration discards newly parsed drawing shapes and immediately rewrites storage. Fix, because the mandate requires end-to-end preservation. Added saved-tab hydration for legacy comments and current opaque commands, idempotency and regression proof. Verified against tabStorage.ts:261 and :453. Closed by review-plan and review-persisted-state r2.

P2, review-tests r1: round-trip tree equality alone does not catch square output changing from csl to equal-endpoint cal. Fix, require a serialized three-character csl assertion. Closed by review-plan and review-tests r2.

P3, review-tests r1: symmetric round trips cannot catch O and C mapping being swapped consistently. Fix, require literal O→orange and C→cyan expectations independent of production mapping. Closed by review-plan and review-tests r2.

Plan adoptions r1=3 r2=0. Three unique issues, all closed before implementation. Correctness and root-cause were added during r1, root-cause was surplus for a plan because its frontmatter is diff-only. No omissions are hidden by that surplus report.

The eight-arrow command is [%cal Bc5b4,Be4d6,Rc7b6,Rd1e2,Oe8g8,Oe4c5,Ob6c5,Ob2b3] after 10.Ne4. The two-arrow command is [%cal Rc7e5,Rd1g4] after 11.Nxe5. Both come from the Sibirisches System game in Felix’s read-only Weiß_Morra Gambit.pgn.

## Separate observations

f-20261016-03 records the pre-existing library preview omission of all saved graphical annotations. It is a separate product surface with an open preview presentation question, deferred to its own build. This task changes main-board drawing import/display and shared palette, without changing preview presentation.

Upstream Windows CI was red before implementation, Test run 38851003688 at 1a4305ed. The existing drain owns f-20261016-01 for that failure. Source work continues, but release remains subject to the remote-CI gate.

## Raw plan reports

### Plan round 1: plan

[blocker] /tmp/build-chessbase-six-colors-chessbase-six-colors-20261016-153044-fe41d32b/plan-r1.md:51 — The changed parser has an unaddressed persistence consumer. `src/state/store/tabStorage.ts:261` calls `splitPgnComment` but discards its shapes. A legacy node containing `[%cal Oe2e4]` currently preserves that command. Under the proposed parser, it becomes a shape and disappears during hydration. `src/state/store/tabStorage.ts:453` immediately writes the loss back to storage. Cover this consumer and add a hydration regression proving newly supported markings survive. (confidence: 99)

Named limitation — The exact repertoire commands asserted at plan-r1.md:22 were not supplied or located in the review packet, so their identity and expected coordinates remain unverified. (confidence: 100)

This review ran on the same model family as the orchestrator, without family separation.

VERDICT: REVISE

### Plan round 1: minimalism

No bloat or duplication defects found in the plan. The shared drawing utility has three concrete consumers: import, export and board rendering. Its smallest sufficient form is the proposed canonical mapping. Focused tests cover mandated parsing and round-trip behavior.

Limitation: implementation is absent, so helper-level duplication and deletable line counts remain for diff review (confidence: 100).

VERDICT: APPROVED

### Plan round 1: tests

[blocker] /tmp/build-chessbase-six-colors-chessbase-six-colors-20261016-153044-fe41d32b/plan-r1.md:36 — Round-trip coverage lacks an assertion on serialized square commands. Reverting square classification to the existing exporter would write `[%csl Ga1]` as `[%cal Ga1a1]`, yet reimport reconstructs the same equal-endpoint shape, so colors, coordinates, kind and multiplicity can all compare equal. Require an assertion that imported squares save as three-character `%csl` entries. (confidence: 98)

[should-fix] /tmp/build-chessbase-six-colors-chessbase-six-colors-20261016-153044-fe41d32b/plan-r1.md:36 — The O/C verification names no independent expected-value assertion. Swapping O→cyan and C→orange consistently across the shared mapping preserves round trips and six distinct rendered colors. Require literal import expectations O→orange and C→cyan, independent of the production mapping. (confidence: 92)

VERDICT: REVISE

### Plan round 1: error-handling

No error-handling findings. The plan explicitly preserves malformed or unknown entries while rendering valid neighbors, making partial parsing intentional and lossless on save. No new network operations or retries are proposed.

Limitation: implementation failure paths require diff review after implementation (confidence: 100).

VERDICT: APPROVED

### Plan round 1: chess-semantics

No chess-semantics findings in plan r1. It explicitly preserves drawing colors, coordinates, square/arrow kind, multiplicity and existing comment metadata through the tree round trip.

Read-only source review only. Implementation remains unverified.

VERDICT: APPROVED

### Plan round 1: correctness

No correctness defects found in the plan’s import, export, palette, or command-preservation contracts.

Limitation: this is plan-only review. The worktree is clean, so the parser branches, O/C mapping, and exact repertoire results remain unverified until implementation (confidence: 100).

VERDICT: APPROVED

### Plan round 1: root-cause

The plan addresses the cause: whole-list rejection by the four-color parser, incomplete board brushes, and square misclassification during export. It also preserves the command-handling behavior fixed in `c449fbb2` and `2dc2d8e4`.

Limitation: no implementation diff or failing-before/passing-after evidence exists yet. This approves the planned approach only, not a verified fix (confidence: 100).

VERDICT: APPROVED

### Plan round 2: plan

P1 CLOSED — r2 `plan-r2.md:36` requires shape retention for legacy comments and current opaque commands, plus idempotent hydration. Lines 54–56 include storage implementation and regression tests, addressing the discarded parser result at `src/state/store/tabStorage.ts:261` and immediate write-back at `:453`. (confidence: 98)

P2 CLOSED — r2 `plan-r2.md:39` explicitly requires serialized three-character `csl` assertions. These catch the incorrect arrow classification at `src/utils/chess.ts:106`, which round-trip equality alone can miss. (confidence: 99)

P3 CLOSED — r2 `plan-r2.md:39` requires literal O→orange and C→cyan expectations independent of the production mapping. This detects a consistently swapped mapping that symmetric import/export tests would accept. The four-color restriction being replaced is at `node_modules/chessops/src/pgn.ts:704`. (confidence: 99)

VERDICT: APPROVED

### Plan round 2: tests

P2 CLOSED — plan-r2.md:39 requires serialized three-character `%csl` assertions. Reverting square classification would emit `%cal` and fail them.

P3 CLOSED — plan-r2.md:39 requires literal O→orange and C→cyan import assertions independent of the production mapping. Swapping the mapping would fail them.

No additional findings in the delta or dependent proof obligations. Approval covers the proposed verification, implementation assertions and red/green results remain for diff review.

VERDICT: APPROVED

### Plan round 2: persisted-state

P1 CLOSED — Round 2 requires hydration to retain shapes from legacy comments and current opaque commands without duplication. It includes tabStorage.ts and reload regression tests while preserving storage validation and encoding.

No additional persistence defects found in the revised plan.

VERDICT: APPROVED



## Implementation and cumulative review

Phase 1 uses gpt-6.1-sol/high through the sensitive Codex write role, thread 01a144ef-9426-7132-be33-ddf7688fa99e. Implementation adds drawings.ts as the shared mapping/parser/serializer, routes pgnComment.ts and chess.ts through it, extends continuationBrushes, and recovers shapes during saved-tab hydration. Tests include BoardChooser, tabStorage, parser round trips, and a six-color browser capture in board-keyboard.

Two bounded integration corrections registered the new production module in coverage-areas.json and the matching coverage-baselines.json scope subtree. The only baseline change is one added scope path. Numeric areas remain identical, parsed SHA-256 7fc9c28620b2c9e0d7880d45640dc07e418b623a7daab0d7e214dfff8caf939f. No baseline writer, metric or floor change.

Root independently ran the five-file focused suite, 259 tests passed. Type checking and frontend coverage mapping passed. Existing notationRows is included because it imports the changed comment contract.

Root independently retained the new parser tests, stashed exactly the five production fix paths with Git, ran the drawing regressions against pre-fix source, restored by stash object and verified all five production hashes. Pre-fix exit 1 with five assertion failures and the two-red-arrow control passing. Restored exit 0 with all six selected regressions passing. This is measured behavior, not only the leaf report.

The first root pre-review built and passed format/lint, frontend coverage mapping and bundle checks. Mutation failed with exit 1, score 99.84, 1231 killed, three timed out and two survived. Both surviving mutations replace the current commands branch guard shapes.length > 0 at tabStorage.ts:270 with true or >= 0. The uncovered difference is trimming leading/trailing opaque command bytes when no supported shape is consumed. A scoped test repair is underway, with the guard preserved and each actual mutation staged temporarily to prove the new assertion.

At the first gate checkpoint, cumulative code review, browser execution and final gates had not run. The earlier leaf queued pre-review was interrupted while waiting for occupied gate slots, exit 143, and is explicitly not a pass.

Repair D1 completed: the existing opaque-command hydration regression now supplies two leading and trailing spaces. Both actual surviving mutations were temporarily applied with unique-context Git patches. Each failed the equality assertion with exit 1 because it trimmed those bytes. Both restorations matched production hash dadbd99879d6ba0168b442f22c3e0c74b2b243da05be7c9ee916f8f520b0a0c1. Final tabStorage tests passed 152, and root repeated the five-file suite with all 259 passing. The leaf's extra foreign-path hash check noticed root's concurrent write to this handoff, an expected owned record update, and the leaf left it untouched. It is not a source-proof failure or a foreign overwrite.

Independent primary-source color confirmation, 2026-10-16: https://pgn.chessbase.com/ loads https://pgn.chessbase.com/all-classes.js. Its ColorType implementation maps C to CYAN and O to ORANGE in fromChar, fromString and toString. Its own arrow and square renderers use cyan hue 180 and orange hue 20. This corroborates d-20261016-22 directly from ChessBase, resolving the general help page's inconsistent sixth-color label without changing the chosen mapping or making a desktop RGB identity claim.

Pre-review r2 failed with three survivors, exactly ids 225/226/228 that had timed out in r1. All concern retainHydratedDrawings's redundant empty-drawing guard, not D1's command-byte guard. No host-load cause is claimed from these two runs.

Repair D2 removed only the redundant drawings.length === 0 helper guard and retained array-type validation. A new regression uses commands [%cal Oe2e4] with a structurally invalid empty-string shapes field. A temporary Git patch removing the remaining array guard made all three semantic checks fail, exit 1: canRehydrate accepted the invalid payload, readTree returned available with a recovered orange arrow, and storage bytes changed. Restoring via git apply -R returned the source to hash c78902cf1e6001daa09c92c163e471e8915735e56a33d2e45672b4b6e4879126. Root independently reran all five focused files, 260 tests passed. Leaf also passed type checking and formatting. There is no reference-identity test for the redundant guard.

Read-only corpus inventory: 11,531 cal/csl entries across the repertoire PGNs, all using the exact six-color coordinate grammar with no surrounding entry whitespace. This is a format inventory, not a native import or full-file round-trip claim.

The third root pre-review waited for shared heavy-gate capacity, then passed with canonical completion record 0 pre-review-r3 a570e94959eb2f559433cacf06325fe15ac209af in /tmp/build-chessbase-six-colors-chessbase-six-colors-20261016-153044-fe41d32b/gate-pre-review-r3.PGPmW9. Build, format/lint, coverage mapping and bundle passed. Workspace-storage mutation passed 100%, 1,233 killed, zero timeouts or survivors. Tree/path passed 100% with seven timeouts and no survivors. No numeric baseline or floor changed.

Source was committed as aac25666 before cumulative review. Current checkpoint: cumulative code review and browser verification are next. The actual reviewed SHA will be recorded after fetching/rebasing and the review round.
