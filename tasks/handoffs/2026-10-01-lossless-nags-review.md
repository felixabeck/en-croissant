# Lossless NAGs — plan and diff review record

Scope: `f-20261001-12` (the renderer's game tree kept only 26 glyphs, so ChessBase's `$8` (□) and
`$11` (=) rendered as an empty grey badge and were deleted on the next save). Plan (ignored run
artifact): `tasks/plans/2026-10-01-lossless-nags.md`, with its lens prompts, raw reports, plan
snapshots and deltas in the ignored `tasks/plans/2026-10-01-lossless-nags-reviews/`. This file is the
tracked history. The plan, its snapshots and every run scratch directory may disappear: the plan's
`## Carried to diff review` and `## Reviews` sections are copied below verbatim, and Appendix A
reproduces every raw plan-review lens report and both delta outputs verbatim.

## Lineage and run facts

* Planned and plan-reviewed on 2026-10-01 in an interactive session (Felix: "fix this one right
  now … do a careful plan review with codecs. And when the plan is finally approved, then you give
  me a handover prompt to do the implementation later in a new terminal"). Implemented on
  2026-10-03 from that handover prompt through the `build` skill starting at Preflight, `full auto`,
  executor Codex. No rewrite and no split. Tier `build`.
* Orchestrator: Claude Code (Anthropic). Executor: Codex. Plan-review lenses ran on the OpenAI high
  tier (`review-plan`) and the OpenAI low tier (the rest); the implementation and repair leaves ran
  on the OpenAI high tier (`sensitive`) and the low tier (`mechanical`); every diff lens ran on the
  OpenAI low tier. Writer and diff reviewers are therefore model-separated inside one family, not
  family-separated. Disclosure: the 2026-10-01 interactive orchestrator (which agent is not
  recorded) wrote the plan and arbitrated its review; the 2026-10-03 Claude Code orchestrator wrote
  the phase and repair briefs and arbitrated the diff review, so the arbitration was not
  independent of the briefs it judged.
* `plan_adopted_per_round`: r1=8 r2=5 r3=0 (from the plan's record below). Unique plan issues N1–N19:
  N1–N13 closed or arbiter-closed at plan level; N12 residual and N14–N19 carried as CR-1..CR-6 and
  closed by the cumulative diff review (round 1, every lens). Per-round plan-review wall times were
  not recorded on 2026-10-01 and stay unknown.
* Decisions recorded from the plan: `d-20261003-15` (raw NAG codes as tree identity),
  `d-20261003-16` (canonical `$7`/`$10`, alias-aware toggles), `d-20261003-17` (codes without a
  glyph kept, not drawn), `d-20261003-18` (ascending order, multiplicity kept, one suffix glyph),
  `d-20261003-19` (coercion migration without a storage version bump).
* Commits: implementation `a6348c79` (phase 1, one write leaf, thread
  `01a100f3-b9fb-7970-81df-4d4f096f54ae`, no proof-fix round); decisions `b07d7d47`; diff-review
  repairs `2f4dc8c4` (resume of the same thread), `3de938da` and `db20b0ec` (two mechanical leaves);
  ledger writes `c50eedea`, `2b26d80d`, `d35bc5ec`.

## Successors

* `f-20261003-03` (filed 2026-10-03, `Entry: lens`): a move carrying `$1 $2` displays "!?", which is
  indistinguishable from the single `$5` glyph. Found while inspecting the verify:app screenshot.
  It is the display layer of this change and predates it; it inherits no open issue from this
  record. Load this file only for the NAG model it builds on (`d-20261003-15`..`-19`).
* `f-20260914-20` (open, pre-existing): annotated on 2026-10-03 with the chess-semantics lens's
  further consequence (late threefold-repetition detection). Not inherited from this record.

## Known limits

* A tab opened before this fix holds only what the old 26-glyph parser kept: `""` where `$8`/`$11`
  (or any other unmapped NAG) were, and the canonical code where an alias was (`$23` came in as ⨀
  and migrates to `$22`, `$33` to `$32`). Migration cannot restore either. Only a tab whose source
  carried an unmapped or alias NAG actually lost data; a tab with canonical glyphs only migrates
  losslessly. A migrated tab does not show which case it is, though, so the safe rule is that every
  tab opened before the fix is closed and reopened from its file before it is saved.
* A move with two move-quality NAGs shows them concatenated (see `f-20261003-03`); the saved PGN is
  correct.

## Plan review (2026-10-01) — copied verbatim from the plan

The two sections below are the plan's `## Carried to diff review` and `## Reviews`, unchanged.
`RUN_TMP/…` paths in them name the planning session's ephemeral scratch directory; those raw
reports are reproduced verbatim in Appendix A. In this file the copied headings sit one level
deeper than in the plan.

### Carried to diff review

Test-assertion and proof-command corrections inside unchanged obligations (build §4 `Fix — carried
to CR-n`). Every phase brief and every diff-review lens packet carries this list verbatim; the
cumulative diff review closes each item.

* **CR-1 (B):** a rendered `EvalChart` assertion: a node `[220]` shows no glyph in its label and the
  neutral colour; a node `[220, 1]` shows `!` in its label and the `!` colour; no numeric NAG code
  ever appears in a label. (review-plan r3 blocker, tests r3)
* **CR-2 (D):** alias toggles and navigation: node `[11]` — the `=` button is active and clicking it
  yields `[]`; `goToAnnotation` with □ finds a node carrying only `$8`, and with `=` a node carrying
  only `$11`. (review-plan r3 blocker, tests r3)
* **CR-3 (A, C):** test 1 calls the real signature: `getPGN(parsed.root, { headers: null, glyphs:
  true, comments: true, variations: true, extraMarkups: true })` (`src/utils/chess.ts:233-252`).
  (review-plan r3 blocker)
* **CR-4 (proof):** the real-window proof command is `pnpm verify:app --screenshot <path>` (the
  harness writes an image only with that flag); the implementer opens the image and reports what it
  shows. (tests r3)
* **CR-5 (E):** migration fixture with a repeated legacy glyph: `["□", "□"]` loads as `[7, 7]`.
  (tests r3 late observation)
* **CR-6 (N12 residual):** test 6's visibility check also requires computed `opacity` > 0 on the
  hint and its ancestors up to the board. (tests r3, N12 NOT CLOSED should-fix)

### Reviews

#### Round 1 (r1) — 10 Codex lenses, `--role review-plan` for review-plan, `sensitive` for the rest

Raw reports: `RUN_TMP/lens-*-r1.txt` (scratchpad `build-nags/`). Verdicts: plan REVISE,
minimalism REVISE, correctness REVISE, tests REVISE, root-cause REVISE, code-quality APPROVED,
error-handling REVISE, persisted-state REVISE, chess-semantics REVISE, pgn-index REVISE.

| ID | Claim | Witnesses (lens#n) | Evidence checked | Disposition | Correction (r2) |
|---|---|---|---|---|---|
| N1 | Sorting + deduplicating loses repeated NAGs (`$8 $8`), violating M2 | chess-semantics#1, correctness#1, pgn-index#2, plan#1 | `src/utils/chess.ts:451` appends every token; `src-tauri/src/lexer.rs:90-95` emits each NAG | Fix | A: duplicates kept, no sort/dedupe at parse; analysis appends only when absent; writer writes duplicates; C; test 1 `[8,8]` |
| N2 | Adjacent suffix glyphs `!`+`?` are re-read as `$5` | pgn-index#1, root-cause#1 | `src/utils/chess.ts:80-82` appends basic glyphs without separator; `pgn-reader-0.26.0/src/reader.rs:343-353` reads `!?` as NAG 5 | Fix | C: only the first written code may be a suffix glyph; test 1 `d4! $2` |
| N3 | Migration silently drops non-enum legacy strings, turning a gated unreadable tab into a rewritten readable one | error-handling#1, persisted-state#1 | `tabStorage.ts:30-57` enum rejects `"bogus"` → `parseTree` null (`:274-276`) → unreadable path | Fix | E: convert only when every element is an old-enum value; otherwise leave node → required `nags` fails → existing unreadable path; test 4 |
| N4 | Display projection duplicated across Board/GameNotation/EvalChart | minimalism#1 | plan B r1 text | Fix | B: one `nagGlyphs` projection, all consumers use it |
| N5 | CompleteMoveCell/AnalysisRow/ReportPanel need not change | minimalism#2 | `MoveCell.tsx:24-26,69` reads `annotations[0]`/`join`; `getGameStats` returns glyph-keyed counts | Fix | B/D + phase file list: pass projection through existing prop; those files expected unchanged |
| N6 | No boundary coverage for `$0`/`$255` | tests#1 | plan r1 test list | Fix (verification) | test 1 `$0`,`$255`; test 4 `[0,255]` accepted, `256`/`1.5` rejected |
| N7 | Named real-window proof exercises no NAG and no save | tests#2, plan#2 | `scripts/verify-app.mjs:299-307` seed has no NAG; `:2127-2184` asserts notation only | Fix (verification, rule 25) | test 6: new verify:app scenario seeding its own NAG PGN, badge assertions, Ctrl+S save, on-disk assertions; harness added to file list |
| N8 | Known limit understates alias loss in pre-fix tabs (`$23`→`$22`) | root-cause#2 | `annotation.ts:57-68` maps `$23`→⨀, `$33`→↑↑ etc.; ⨀ canonical 22 | Fix (text) | E known limit names alias collapse; every pre-fix tab must be reopened |

Adopted plan-level: r1=8 (N1-N8). Authority: N1/N2 M2; N3 M4 + persisted-state rule (no new mechanism — uses the existing gated path); N4/N5 rule 11 / minimalism; N6/N7 necessary verification; N8 M4.

#### Round 2 (r2) — closure round: review-plan + 8 witness lenses

Raw reports: `RUN_TMP/lens-*-r2.txt`. Verdicts: plan APPROVED (N1-N8 CLOSED), chess-semantics
APPROVED, correctness APPROVED, minimalism APPROVED, persisted-state APPROVED, pgn-index APPROVED,
root-cause APPROVED, error-handling APPROVED (+1 should-fix), tests REVISE.

| ID | Claim | Witnesses | Evidence checked | Disposition | Correction (r3) |
|---|---|---|---|---|---|
| N1-N6, N8 | — | — | CLOSED by every witness and review-plan | Closed r2 | — |
| N7 (residual) | Test 6 seeds the NAGs it checks, so an ignored save still passes | tests#r2-1 (NOT CLOSED); review-plan CLOSED | true: the seed already holds the asserted strings | Fix | test 6: set `?!` on an un-annotated 3.Nc3 and require `Nc3?!` on disk as the write signal |
| N9 | Mixed `[220, 1]` only asserted on the projection, not a rendered consumer | tests#r2-2 | plan r2 test 2 | Fix (verification) | test 2: Board hint and move cell for `[220, 1]` |
| N10 | Alias pair `[7, 8]` untested; toggle removal of both aliases untested | tests#r2-3 | plan r2 tests 2-3 | Fix (verification) | test 2 `[7,8]`, `[10,11]`; test 3 `[7,8,220]` → `[220]` |
| N11 | `getGameStats` "as before" has no fixture; no existing test | tests#r2-4 | grep: no `getGameStats` test in repo | Fix (verification) | test 5 fixture with expected counts |
| N12 | Real-window check reads the SVG title, not visible pixels; e2e has no NAG case | tests#r2-5 | `scripts/verify-app.mjs` supports `--screenshot`; e2e runs on mocked IPC | Fix (partial) | test 6 asserts visibility (box, display, glyph path) + screenshot viewed per rule 25. A new container e2e snapshot is not added: it would need a new mocked-IPC NAG fixture and pixel baseline for a property the real-window check now asserts; recorded here, re-raise only with new evidence |
| N13 | Failed write-back of a migrated tree is unspecified | error-handling#r2-1 (APPROVED) | `tabStorage.ts:396-404` logs failed `setItem`, returns migrated tree | Fix (text, arbiter record) | E states the existing behaviour: migrated tree used, old value kept, migration retried next read; no semantics change |

Adopted plan-level: r2=5 (N7 residual, N9-N12; N13 arbiter-closed text).

#### Round 3 (r3) — closure round: review-plan + tests

Raw reports: `RUN_TMP/lens-plan-r3.txt`, `RUN_TMP/lens-tests-r3.txt`. Verdicts: review-plan REVISE
(N7, N9-N12 CLOSED; 3 blockers + 1 should-fix, all test-level), tests APPROVED (N7, N9-N11 CLOSED,
N12 NOT CLOSED should-fix, 3 should-fix, 1 late observation).

| ID | Claim | Witnesses | Evidence checked | Disposition |
|---|---|---|---|---|
| N7, N9, N10, N11 | — | review-plan, tests | CLOSED by both | Closed r3 |
| N12 (residual) | visibility check misses `opacity: 0` | tests#r3-1 | true for the r3 assertion list | Fix — carried to CR-6 (assertion inside unchanged obligation) |
| N14 | EvalChart label/colour/point not asserted through a rendered consumer | review-plan#r3-delta-1 (blocker), tests#r3-3 | `EvalChart.tsx:106,115-116` reads node annotations directly | Fix — carried to CR-1 (test assertion; B unchanged) |
| N15 | No `Authority` entries for adopted r2 verification additions | review-plan#r3-delta-2 | r2 table | Fix (arbiter record): authority — N7/N9-N12 are necessary verification of M1 (display), M2 (save) and M4 (toggles); rule 25 requires the real-window proof |
| N16 | `getPGN({glyphs: true})` does not match the real signature | review-plan#r3-other-1 (blocker) | `src/utils/chess.ts:233-252` takes `(tree, {headers, glyphs, comments, variations, extraMarkups})` | Fix — carried to CR-3 (test invocation) |
| N17 | Alias `=` toggle and alias `goToAnnotation` untested | review-plan#r3-other-2 (blocker), tests#r3-4 | `tree.ts:291-315` exact inclusion today; `:561-571` removal branch | Fix — carried to CR-2 (test assertion; D unchanged) |
| N18 | Proof command lacks `--screenshot` | tests#r3-2 | `scripts/verify-app.mjs` writes an image only with the flag | Fix — carried to CR-4 |
| N19 | Migration fixture lacks a repeated legacy glyph | tests#r3-late-1 | old schema accepts duplicates (`tabStorage.ts:152`) | Fix — carried to CR-5 |

Adopted plan-level: r3=0 (all carried or arbiter-closed). Plan-level adoptions r1=8 r2=5 r3=0; no
non-convergence trigger. **Plan review closed at r3**: every plan-level issue (N1-N13) CLOSED or
arbiter-closed; N12 residual and N14-N19 carried to the cumulative diff review as CR-1..CR-6.
No issue deferred or skipped.

## Implementation and diff review (2026-10-03)

Preflight: `findings.py drain-status` "no drain running"; f-20261001-12 open and unclaimed; tree
clean at `f85d53a5`; none of the plan's traced files changed since the plan's base `78766420`;
`codex-cli 0.160.0`; `tauri-driver`, `WebKitWebDriver`, `kwin_wayland` present; no queue marker.

Phase 1 (one write leaf, role `sensitive`) → `a6348c79`. Orchestrator proof on that tree:
`pnpm exec tsgo --noEmit` exit 0; `pnpm vitest run src/utils src/state src/components` 131 files /
1,610 tests passed; `pnpm checks:pre-review` exit 0 (frontend mutation over the changed files 100 %,
406.8 s). The leaf's first pre-review run had found two mutation survivors in the migration guard and
added the fixture that kills them.

Diff lenses ran on the selected executor at `--role sensitive` (the range touches `src/state/**`).
Selected by description: `review-correctness`, `review-root-cause` (always), `review-tests`,
`review-minimalism`, `review-code-quality`, `review-error-handling`, `review-chess-semantics`,
`review-persisted-state`, plus `review-pgn-index` (the PGN writer/reader symmetry it witnessed in
plan review). Not selected: engine-protocol, ipc-contract, tauri-security, platform-semantics (no
triggering path). Record paths (`tasks/findings.md`, `tasks/decisions.md`, this file) were excluded
from the code lenses and go to one records lens.

### Diff round 1 (DIFF `f85d53a5..b07d7d47`, REVIEWED_THROUGH `b07d7d47`)

Verdicts: correctness APPROVED, root-cause APPROVED, tests APPROVED, persisted-state APPROVED,
pgn-index APPROVED, error-handling REVISE, minimalism REVISE, code-quality REVISE, chess-semantics
REVISE. CR-1..CR-6 CLOSED by every lens that reported them (CR-4's run and screenshot followed, see
below). Every raw diff-lens report is reproduced verbatim in Appendix B.

| ID | Finding | Witnesses | Evidence checked | Verdict |
|---|---|---|---|---|
| D1 | `tabStorage.ts:219` migration ran when `nags` was present but not an array, overwriting a corrupt value into a readable tree | error-handling (blocker, 95) | read the guard `!Array.isArray(node.nags) && …` | Fix → own-key guard + tests for `"x"`/`null` |
| D2 | The new verify:app NAG checks lacked staged-failure evidence for assertions that stay green on the pre-fix binary | correctness, error-handling, persisted-state, pgn-index, root-cause, tests, minimalism, code-quality, chess-semantics (91–99) | measured: the pre-fix run left row/open/navigation/visibility/Annotate/save green | Fix → setup steps became preconditions; 9 assertions; each staged (below) |
| D3 | Test 1 mocks the lexer; real NAG tokens unproven | tests (91) | `lexer.rs` had one NAG test (single `$1`) | Fix → `lexer::tests::test_lex_pgn_sync_lossless_nags` |
| D4 | Pointer double-click sequence duplicated | minimalism (99) | rule 11 | Fix → `doubleClickAt` |
| D5 | Writer repeats `nagGlyphs`' sort | minimalism (87) | rule 11 | Fix → `sortedNags` |
| D6 | Inline `1..6` suffix rule unnamed | code-quality (blocker, 96) | `isBasicAnnotation` already names the class | Fix |
| D7 | Literal `146` for novelty | code-quality (98), minimalism (nit) | `ANNOTATION_INFO.N.nag` exists | Fix |
| D8 | `0..255` bound duplicated parser/schema | code-quality (91), minimalism (nit) | — | Fix → `MAX_NAG`, `isNagCode` |
| D9 | `migrateLegacyNodeComments` name no longer fits | code-quality (92) | — | Fix → `migrateLegacyNode` |
| D10 | `reachedBoard` names the wrapper | code-quality (nit, 88) | — | Fix |
| D11 | 25-code fixture repeated | minimalism (nit, 95) | — | Fix |
| D12 | `chessops.ts:61` keeps castling rights for a king off its back rank; threefold repetition then detected one cycle late | chess-semantics (blocker, 94) | read `normalizeEditedFen`; same defect as open `f-20260914-20` | Defer → annotated `f-20260914-20` (`c50eedea`), outside this run's area |

`diff_adopted_per_round` r1 = 11 (D1–D11).

Repairs: D1, D3–D11 by a resume of the phase thread (role `sensitive`) → `2f4dc8c4`; its
pre-review attempt refused with exit 125 ("agents.slice MemoryHigh is unavailable", nothing
started), the orchestrator's own run was green. D2 staging and record rows → `3de938da`
(mechanical leaf inserted the orchestrator's measured rows).

verify:app staging (push-review-policy §2; breaks only in the release binary the harness reads):
* Run A — pre-fix release binary (built 2026-10-03 from master before this change), harness of
  `2f4dc8c4`: "7 check(s) failed", exit 1. Failing: hint glyph path, hint title, `$220` hint
  absence, and the four preserves-* checks; the old save wrote `1. e4 e5 2. d4!? d5 3. Nc3?! *`.
  (Two earlier attempts aborted before the NAG scenario: once "seed processes survived close", once
  a practice-stage timeout at load average ~29; neither is evidence either way.)
* Run B (superseded) — both breaks in one build: "6 check(s) failed", exit 1.
* Run B1 — only `opacity: 0` on the AnnotationHint glyph box: exactly the visibility assertion,
  "1 check(s) failed", exit 1.
* Run B2 — only a no-op SAVE_FILE handler: the save assertion plus four "not attempted"
  dependants, "5 check(s) failed", exit 1.
* Both staged sources restored with `git checkout --` of exactly those two files on an otherwise
  clean tree and rebuilt clean. Final run on the clean build of `2f4dc8c4`:
  `pnpm verify:app --screenshot` → "all checks passed", exit 0.

### Diff round 2 (DIFF `b07d7d47..3de938da`, REVIEWED_THROUGH `3de938da`)

All nine lenses re-ran (each witnessed D2; D1/D3–D11 witnesses among them). Verdicts: all APPROVED.
D1, D3–D11 CLOSED by every witness. D2 CLOSED by eight; root-cause: `[should-fix] D2 NOT CLOSED`
— the visibility and save breaks were staged together, against "one change at a time".
New: R2-1 (code-quality, 91) `SUPPORTED_NAGS` holds only canonical glyph codes → rename.

| ID | Verdict |
|---|---|
| D2 residual | Fix → re-staged as B1 and B2 (above), record rewritten → `db20b0ec` |
| R2-1 | Fix → `CANONICAL_GLYPH_NAGS` → `db20b0ec` |

`diff_adopted_per_round` r2 = 2 (D2 residual, R2-1). Repairs by a mechanical leaf.

### Diff round 3 (DIFF `3de938da..db20b0ec`, REVIEWED_THROUGH `db20b0ec`)

Lenses: correctness, root-cause, tests, code-quality (adopted in r2), persisted-state (delta touches
`src/state/**`). Verdicts: correctness APPROVED, tests APPROVED, code-quality APPROVED,
persisted-state REVISE, root-cause REVISE. D2 residual and R2-1 CLOSED by every witness.

| ID | Finding | Witnesses | Evidence checked | Verdict |
|---|---|---|---|---|
| R3-1 | `tabStorage.ts:221` legacy parse lacks the old schema's `.max(1_024)`, so a 1,025-glyph legacy node with `""` entries migrates into a readable tree the old schema kept gated | persisted-state (blocker, 93), root-cause (blocker, 100) | old schema `annotations: z.array(annotationSchema).max(1_024)`; legacy parse uncapped | Fix → one named cap for both, boundary tests |
| R3-2 | No rendered Board case for `$11` → `=` hint | tests (late, 92) | projection-only assertion | Fix → Board table row `[11]` |
| R3-3 | Adjacent duplicate NAGs could be lost across the native→renderer boundary | tests (late, 94) | `lexPgn` returns one `Result<Token[]>` IPC response (`src/bindings/generated.ts:662` ← `src-tauri/src/lexer.rs:196`): a JSON array with no dedup path; the Rust token vector and the renderer's consumption are each pinned | Skip (speculative: no mechanism) |
| R3-4 | Record says "three runs, one change each" though run A is the baseline | code-quality (96) | — | Fix (wording) |

`diff_adopted_per_round` r3 = 3 (R3-1, R3-2, R3-4).

### Diff round 4 (DIFF `db20b0ec..fb69f852`, REVIEWED_THROUGH `fb69f852`)

Repairs for round 3 by one write leaf (role `sensitive`) plus a mechanical resume for formatting and
one re-wrap → `fb69f852`. Lenses: correctness, root-cause, tests, code-quality, persisted-state. All
APPROVED; R3-1, R3-2, R3-4 CLOSED by every witness; R3-3's Skip premise confirmed unchanged by all
five. No new finding. `diff_adopted_per_round` r4 = 0. Diff review closed at r4.

Totals: `diff_adopted_per_round` r1=11 r2=2 r3=3 r4=0. Unique diff issues D1–D12, R2-1, R3-1..R3-4:
15 fixed, 1 deferred to an existing finding (D12 → `f-20260914-20`), 1 skipped (R3-3). One
correction-introduced residual (D2 → staged two breaks in one run, closed in r3). R3-1 is a defect
in the phase-1 migration that rounds 1 and 2 did not report, not one introduced by a repair.
Pre-review (`pnpm checks:pre-review`) ran green after the phase and after every repair batch.

### Real-window proof (CR-4, plan test 6)

`pnpm build` of `fb69f852`, then `pnpm verify:app --screenshot <png>`: "all checks passed", exit 0;
all nine NAG assertions ok. The screenshot shows the seeded NAG game at 1.e4 in the real window: a
grey badge carrying □ at the top-right corner of e4 (□ has no configured colour, so the badge is the
neutral grey; before the fix it was a grey dot with no symbol), the notation
`1. e4□ e5= 2. d4!? d5 3. ♘c3` with e4 selected, and the white pawn caught mid-animation on e3.
The `d4!?` rendering of `$1 $2` is filed as `f-20261003-03`.

### Timing and the records review

Per-round wall times of the four diff rounds are unknown: the orchestrator's scratch directory,
which held the lens streams and logs, was deleted by a reboot Felix made after diff round 4, and
no timings were recorded before that. The reboot was a pause of roughly half an hour between the
real-window proof and the records review; it is not review time. Diff round 1 and the closure
rounds each completed within one polling window of about 10–25 minutes, which is the only timing
evidence left.

Records lens (one Codex leaf, `--role mechanical`, over `tasks/decisions.md`, `tasks/findings.md`
and this file, 2026-10-03, verdict REVISE). It verified the copied plan sections, Appendix A and
both delta outputs against their sources. Findings and verdicts:

| Finding | Verdict |
|---|---|
| f-20261001-12's `Open question` bullet still reads as open after the close | Fix → annotation naming the answering decisions |
| "Every tab must be reopened" overstates the loss (canonical-only tabs migrate losslessly) | Fix → the Known limits bullet above names the actual loss and why the rule stays |
| d-20261003-19 states the first migration guard ("no `nags` array"), not the repaired own-key guard, and lacks the length cap | Fix → `d-20261003-20` records both refinements; d-20261003-19 superseded by it |
| f-20261003-03 does not link this handoff | Fix → annotation with the link and the load instruction |
| The diff rounds give no timing | Fix → this section |
| `d-20261003-17` says `nagGlyphs` returns codes; it returns glyphs | Skip (wording only; the sentence names the display projection, and superseding a decision for wording churns the ledger) |

### Remote red after the first push, and diff round 5

The first push (`f85d53a5..ceafc21f`) reddened remote CI: Test run 37127507309, job `test`
(111215719788), step "Run targeted frontend mutation tests", package workspace-storage at 97.85 %,
"Final mutation score 97.85 under breaking threshold 100". 23 StringLiteral mutants of the legacy
`annotationSchema` enum (`src/state/store/tabStorage.ts:32-59`, for example `"!!"` → `""`) survived:
since the persisted schema moved to `nags`, no test fed most legacy glyphs through the migration.
The five Windows/macOS/platform jobs were green. Locally, the same 23 mutants had been reported as
`Timeout`, which Stryker counts as detected, so every local mutation run (pre-review after each
repair and the final `gates:push`) had passed at 100 %. That gate defect is filed as
`f-20261003-04`; it is not inherited from this record.

Repair `1ac74391` (one write leaf, role `sensitive`): a test migrates a node carrying every value
of the old 26-member enum (literal list) and expects each canonical code in order. With `"!!"` → `""`
staged in the enum the test failed (unreadable instead of available) and passed once restored.
`pnpm mutation:frontend -- --files src/state/store/tabStorage.ts`: exit 0, all 30 enum-line
mutants Killed, none Timeout or Survived. Pre-review green.

Diff round 5 (DIFF `ceafc21f..1ac74391`): correctness, tests, persisted-state — all APPROVED,
REMOTE-RED CLOSED by each, no new finding. `diff_adopted_per_round` r5 = 1 (the remote red).

## Appendix A — raw plan-review lens reports and delta outputs (2026-10-01)

#### `lens-chess-semantics-r1`

```text
[blocker] tasks/plans/2026-10-01-lossless-nags.md:92 — Sorting and deduplicating loses repeated NAGs. For `1. e4 $8 $8 e5`, the current parser appends both tokens to e4’s node (`src/utils/chess.ts:451-454`), but the plan stores `[8]` and writes one `$8`, violating M2. The round-trip test should cover duplicate multiplicity (confidence: 96)

VERDICT: REVISE
```

#### `lens-code-quality-r1`

```text
VERDICT: APPROVED
```

#### `lens-correctness-r1`

```text
[blocker] tasks/plans/2026-10-01-lossless-nags.md:96 — For `1. e4 $220 $220`, deduplicating stores only `[220]`, so the writer emits one `$220` and loses an occurrence. That contradicts the goal that every NAG survives unchanged and M2’s “no NAG is lost.” (confidence: 95)

VERDICT: REVISE
```

#### `lens-error-handling-r1`

```text
[blocker] tasks/plans/2026-10-01-lossless-nags.md:136 — Dropping an unrecognized legacy annotation (the migration test uses `"bogus"`) turns invalid persisted data into a successful load. The old schema rejects that value; the read path then preserves the raw bytes, marks the tab unreadable, and offers recovery. This migration would instead mark it available and rewrite the stored tree without the value, hiding the failure and removing the recovery option. (confidence: 99)

VERDICT: REVISE
```

#### `lens-minimalism-r1`

```text
[should-fix] tasks/plans/2026-10-01-lossless-nags.md:104 — B centralizes code-to-glyph lookup, but leaves Board, GameNotation, and EvalChart to derive the same ordered list of visible glyphs and select its primary glyph. Specify one shared projection for those callers so filtering, ordering, and primary selection cannot be duplicated (confidence: 87).

[should-fix] tasks/plans/2026-10-01-lossless-nags.md:185 — `CompleteMoveCell`, `AnalysisRow`, and `ReportPanel` need not change: `GameNotation` can pass glyphs through the existing `Annotation[]` prop, `AnalysisRow` still passes `[]`, and `getGameStats` can keep its existing glyph-keyed result. Remove these three files from the touch list (confidence: 93).

VERDICT: REVISE
```

#### `lens-persisted-state-r1`

```text
[blocker] tasks/plans/2026-10-01-lossless-nags.md:136 — Dropping a nonempty unrecognized legacy string makes a tree that the current annotation schema rejects readable; `readTree` then rewrites its raw session-storage bytes. A tab with one accidental `"bogus"` annotation would lose that value instead of remaining gated for recovery. Drop the valid legacy `""` sentinel, but reject other unknown entries and preserve the unreadable tree. (confidence: 96)

VERDICT: REVISE
```

#### `lens-pgn-index-r1`

```text
[blocker] tasks/plans/2026-10-01-lossless-nags.md:115 — The planned writer joins basic NAG glyphs without separators. For `1. e4 $1 $2`, it writes `!?`, which the PGN lexer reads as the single NAG `$5`; reparsing changes `[1, 2]` to `[5]`, violating M2. (confidence: 99)

[should-fix] tasks/plans/2026-10-01-lossless-nags.md:92 — The plan deduplicates NAG codes, so `1. e4 $220 $220` saves with only one `$220`. That loses a NAG despite M2’s “no NAG is lost” requirement. (confidence: 95)

VERDICT: REVISE
```

#### `lens-plan-r1`

```text
[blocker] tasks/plans/2026-10-01-lossless-nags.md:92 — A and E discard repeated identical NAGs, violating M2’s “no NAG is lost on save.” The lexer emits each NAG and the parser appends each token (`src-tauri/src/lexer.rs:90,94`; `src/utils/chess.ts:451`), so `1. e4 $8 $8` would lose one occurrence. The round-trip fixture has no duplicate to catch this (`tasks/plans/2026-10-01-lossless-nags.md:194`). (confidence: 95)

[blocker] tasks/plans/2026-10-01-lossless-nags.md:210 — The proposed live-window proof cannot check the `$8` badge or saving the named PGN: `verify:app` seeds a game without NAGs (`scripts/verify-app.mjs:299,307`) and its Files check asserts notation only (`scripts/verify-app.mjs:2127,2184`). The plan’s file list omits that harness (`tasks/plans/2026-10-01-lossless-nags.md:183`), so the specified proof can pass without exercising those flows. (confidence: 93)

VERDICT: REVISE
```

#### `lens-root-cause-r1`

```text
[blocker] tasks/plans/2026-10-01-lossless-nags.md:115 — The raw-code model fixes parser collapse, but the writer still emits NAGs 1–6 as suffix glyphs. Codes `$1 $2` on one move become `!?`, which pgn-reader consumes as a single NAG 5, losing both original codes on round trip. The acceptance fixture never puts two suffix NAGs on one move. Require an unambiguous encoding and test that case. (confidence: 99)

[should-fix] tasks/plans/2026-10-01-lossless-nags.md:142 — Old tabs also lose alias identity: the current parser maps `$23` to `⨀`, and migration maps that glyph to canonical `$22` (similarly `$33` to `$32`). The stated limitation covers only empty `$8`/`$11` entries; note that affected tabs must also be reopened from their original files. (confidence: 98)

History check: no prior fix of this NAG-loss defect is being undone.

VERDICT: REVISE
```

#### `lens-tests-r1`

```text
[blocker] tasks/plans/2026-10-01-lossless-nags.md:193 — The round-trip fixture stops at `$220`, while the migration test rejects `[300]`. Both still pass if the parser or schema regresses to reject valid `$255` (or drops `$0`), despite the plan’s stated `0..=255` input range. Add boundary assertions for `$0` and `$255`, including persistence acceptance at 255. (confidence: 98)

[blocker] tasks/plans/2026-10-01-lossless-nags.md:210 — The real-window proof names `pnpm verify:app`, but its current fixtures contain no NAGs or annotation assertions; the existing frontend e2e fixtures do not exercise them either. Those commands can pass if the app still renders `$8` blank or its save flow drops NAGs. Name a runnable browser or app scenario that opens a NAG-bearing PGN, asserts the displayed symbol, and checks the saved copy’s round trip. (confidence: 97)

VERDICT: REVISE
```

#### `lens-chess-semantics-r2`

```text
N1 CLOSED — A/C and test 1 preserve duplicate NAGs, write both codes, and check the round-trip multiset.
N2 CLOSED — C and test 1 allow only the first code to use a suffix; subsequent codes use separated `$n` notation.
N3 CLOSED — E and test 4 migrate only valid legacy annotations; invalid values retain the existing unreadable-tab path.
N4 CLOSED — B defines one `nagGlyphs` projection for all display consumers.
N5 CLOSED — B passes that projection through existing props and keeps the named consumers unchanged.
N6 CLOSED — Tests 1 and 4 cover `$0`/`$255` acceptance and reject `$256` and non-integers.
N7 CLOSED — Test 6 checks NAG display and saved-file contents in the real window.
N8 CLOSED — E names alias collapse in old tabs and requires reopening them from their files.

VERDICT: APPROVED
```

#### `lens-correctness-r2`

```text
N1 CLOSED — A preserves duplicate codes in token order, C writes duplicates, and test 1 covers `[8,8]`.
N2 CLOSED — C allows a suffix glyph only for the first code and tests `$1 $2` as `d4! $2`.
N3 CLOSED — E leaves legacy nodes with any invalid element unconverted so required-`nags` validation rejects the tree; test 4 covers the unreadable path.
N4 CLOSED — B defines one `nagGlyphs` projection for display consumers.
N5 CLOSED — B passes that projection through GameNotation’s existing prop and names the consumers expected to remain unchanged.
N6 CLOSED — Tests cover `$0` and `$255`, accept `[0,255]`, and reject `256` and `1.5`.
N7 CLOSED — Test 6 seeds its own PGN, checks board hints, saves in the real window, and reads the saved file.
N8 CLOSED — E names the legacy alias collapse and requires pre-fix tabs to be reopened from their files before saving.

VERDICT: APPROVED
```

#### `lens-error-handling-r2`

```text
N3 CLOSED — E converts only values accepted by the old schema; invalid values fail validation and retain the raw bytes for recovery.

[should-fix] tasks/plans/.plan-2026-10-01-lossless-nags-r2.body.md:145 — E does not specify what happens if persisting a valid migration fails. In `tabStorage.ts:396-404`, `readTree` logs a failed write but still returns the migrated tree as available; the existing test confirms there is no notification. The old value remains recoverable and migration can be retried on a later read, but the plan should state that fail-open behavior and its retry contract (confidence: 90)

VERDICT: APPROVED
```

#### `lens-minimalism-r2`

```text
N1 CLOSED — A preserves duplicates in parse order; C writes them all, and test 1 checks `[8,8]` survives the round trip.
N2 CLOSED — C permits a suffix glyph only for the first code; test 1 expects `d4! $2`, never `d4!?`.
N3 CLOSED — E migrates only values accepted by the old enum; test 4 checks invalid legacy data remains on the unreadable path.
N4 CLOSED — B specifies one shared `nagGlyphs` projection for display consumers.
N5 CLOSED — B routes `GameNotation` through the existing annotation prop and leaves `MoveCell`, `CompleteMoveCell`, and `AnalysisRow` unchanged; D keeps `ReportPanel` unchanged.
N6 CLOSED — Tests 1 and 4 cover codes 0 and 255, plus rejection of 256 and 1.5.
N7 CLOSED — Test 6 adds real-window coverage for NAG display and save, alongside the existing Files checks.
N8 CLOSED — E names alias loss such as `$23` becoming `$22` and requires pre-fix tabs to be reopened from file.

VERDICT: APPROVED
```

#### `lens-persisted-state-r2`

```text
N3 CLOSED — E converts only legacy values accepted by the old schema; test 4 checks that invalid values keep the tab unreadable with its raw bytes retained.

VERDICT: APPROVED
```

#### `lens-pgn-index-r2`

```text
N1 CLOSED — A preserves parsed NAG multiplicity, C writes duplicates, and test 1 round-trips `[8, 8]`.

N2 CLOSED — C uses at most one suffix and writes later codes numerically with separators; test 1 asserts `d4! $2`, avoiding the adjacent `!?` parse as `$5`.

VERDICT: APPROVED
```

#### `lens-plan-r2`

```text
N1 CLOSED — r2 preserves duplicates in storage and output and tests `[8,8]`; the Rust lexer emits each NAG and the renderer appends each token (`tasks/plans/.plan-2026-10-01-lossless-nags-r2.body.md:94-100,122-127,212-217`; `src-tauri/src/lexer.rs:90-95`; `src/utils/chess.ts:450-454`).

N2 CLOSED — r2 writes only the first code as a suffix and tests `d4! $2`; pgn-reader consumes adjacent `!?` as one NAG (`tasks/plans/.plan-2026-10-01-lossless-nags-r2.body.md:123-127,213-217`; `pgn-reader-0.26.0/src/reader.rs:343-352`).

N3 CLOSED — migration converts only old-schema values and leaves invalid nodes for the unreadable path; the current schema rejects invalid annotations and storage retains undecodable bytes (`tasks/plans/.plan-2026-10-01-lossless-nags-r2.body.md:146-155,224-228`; `src/state/store/tabStorage.ts:30-57,274-278,387-403`).

N4 CLOSED — r2 specifies one display projection for all consumers and covers known, duplicate, and unknown codes (`tasks/plans/.plan-2026-10-01-lossless-nags-r2.body.md:108-118,218-220`; `src/components/boards/Board.tsx:308-315`; `src/components/common/GameNotation.tsx:303-318`; `src/components/common/EvalChart.tsx:106-116`).

N5 CLOSED — r2 keeps the existing display prop for `MoveCell`, `CompleteMoveCell`, and `AnalysisRow`, and leaves `ReportPanel` unchanged (`tasks/plans/.plan-2026-10-01-lossless-nags-r2.body.md:115-118,203-207`; `src/components/common/MoveCell.tsx:10-26`).

N6 CLOSED — r2 tests `$0` and `$255`, rejects out-of-range and non-integer values, and accepts the valid boundaries; pgn-reader represents NAGs as `u8` (`tasks/plans/.plan-2026-10-01-lossless-nags-r2.body.md:213-228`; `pgn-reader-0.26.0/src/reader.rs:335-340`; `pgn-reader-0.26.0/src/types.rs:84-86`).

N7 CLOSED — r2 adds a real-window NAG display and save scenario; the existing harness only seeds an unannotated PGN and checks notation (`tasks/plans/.plan-2026-10-01-lossless-nags-r2.body.md:231-243`; `scripts/verify-app.mjs:299-307,2177-2190`).

N8 CLOSED — r2 names alias-code loss in old tabs and directs reopening them; the current catalogue maps `$23` to glyph `⨀` with canonical code 22 and `$33` to `↑↑` with canonical code 32 (`tasks/plans/.plan-2026-10-01-lossless-nags-r2.body.md:156-160`; `src/utils/annotation.ts:57-60,175-176`).

VERDICT: APPROVED
```

#### `lens-root-cause-r2`

```text
N2 CLOSED — C emits `[1, 2]` as `! $2`; pgn-reader 0.26 reads adjacent `!?` as NAG 5, and test 1 checks the separated round trip.

N8 CLOSED — E names legacy alias collapse (`$23`→`$22`, `$33`→`$32`, and so on) and says pre-fix tabs must be reopened before saving; the current mapping confirms the aliases.

VERDICT: APPROVED
```

#### `lens-tests-r2`

```text
N6 CLOSED — Test 1 covers `$0` and `$255` through round-trip; Test 4 accepts `[0, 255]` and rejects `[256]` and `[1.5]`.

[blocker] N7 NOT CLOSED — Test 6 seeds the NAG strings it later checks. If `SAVE_FILE` is ignored or no write occurs, the original file still passes those checks. The supplied acceptance summary also says “five tests” while r2 lists six, leaving Test 6’s acceptance unclear. Assert that a separate non-NAG edit reached disk, or provide another observable write signal.

[blocker] tasks/plans/.plan-2026-10-01-lossless-nags-r2.body.md:219 — The mixed `[220, 1]` case is asserted only on `nagGlyphs`; Board and move-cell assertions use single-code cases. A consumer that projects only the first code can still suppress `!` when `$220` precedes `$1`, while the listed assertions pass. Assert the mixed case through the rendered consumer.

[should-fix] tasks/plans/.plan-2026-10-01-lossless-nags-r2.body.md:219 — `[8, 8]` tests duplicate codes, not distinct aliases such as `[7, 8]`. A projection that collapses only identical codes can pass while rendering duplicate `□` glyphs for aliases. Test an alias pair; the toggle cases likewise do not verify removing both aliases together.

[should-fix] tasks/plans/.plan-2026-10-01-lossless-nags-r2.body.md:230 — “`getGameStats` counts as before” specifies no fixture or expected counts, and the repository has no existing `getGameStats` test. A result that drops counts or duplicate basic NAGs has no defined assertion to fail.

[should-fix] tasks/plans/.plan-2026-10-01-lossless-nags-r2.body.md:241 — The real-window assertion checks the SVG `<title>`, not the rendered glyph pixels. The existing e2e suite has no annotation/NAG case, so `pnpm test:e2e:container` does not reach this visual change; a blank or hidden SVG path could pass. Add an e2e assertion for the rendered badge.

VERDICT: REVISE
```

#### `lens-plan-r3`

```text
N7 CLOSED — R3 test 6 adds `?!` to previously unannotated `3.Nc3` and requires `Nc3?!` on disk (`.plan-2026-10-01-lossless-nags-r3.body.md:243-246`). The `SAVE_FILE` hotkey reaches `userSaveFile` (`src/components/boards/BoardAnalysis.tsx:91-100,294-296`), so an ignored save fails the assertion.

N9 CLOSED — Test 2 now requires the `[220,1]` hint and move-cell output (`.plan-2026-10-01-lossless-nags-r3.body.md:223-225`); those are wired through `Board` and `GameNotation` (`src/components/boards/Board.tsx:472-483`, `src/components/common/GameNotation.tsx:303-318`).

N10 CLOSED — Tests now cover both alias pairs in the projection and removal of `$7` and `$8` while preserving `$220` (`.plan-2026-10-01-lossless-nags-r3.body.md:222,226-228`); the existing toggle replaces glyph groups (`src/state/store/tree.ts:561-571`).

N11 CLOSED — Test 5 specifies expected white and black counts, including duplicates and an unknown code (`.plan-2026-10-01-lossless-nags-r3.body.md:234-237`); the stats consumer counts basic annotations per node (`src/utils/chess.ts:604-652`).

N12 CLOSED — Test 6 now requires visible bounds, visible styles, a glyph path, and a screenshot of the `$8` position (`.plan-2026-10-01-lossless-nags-r3.body.md:241-247`). The hint renders its title and glyph in SVG (`src/components/boards/AnnotationHint.tsx:45-53`), and the real-window harness supports screenshots (`scripts/verify-app.mjs:279-280,2206-2208`).

**R3 delta findings**

[blocker] `.plan-2026-10-01-lossless-nags-r3.body.md:223-225` — The revised display test still renders only `Board` and the move cell, although B also requires the `EvalChart` label, color, and point to use the projection (`:112-118`). `EvalChart` builds these separately from node annotations (`src/components/common/EvalChart.tsx:106,115-116`). A compiled implementation that projects correctly for the board and notation but mishandles chart labels or color can pass the listed tests. Add a rendered chart assertion for an unknown and a mixed NAG case. (confidence: 94)

[should-fix] `tasks/plans/2026-10-01-lossless-nags.md:285-289` — The adopted N7 and N9–N12 corrections add real-window save, alias, rendered-consumer, stats, and pixel checks, but their review rows contain no `Authority` entry tying those additions to M1–M4 (`.plan-2026-10-01-lossless-nags-r3.body.md:37-39`). The real save path is present in `src/components/boards/BoardAnalysis.tsx:91-100,294-296`; record the mandate authority for the adopted additions. (confidence: 87)

**Other blockers**

[blocker] `.plan-2026-10-01-lossless-nags-r3.body.md:218` — The round-trip criterion calls `getPGN({glyphs: true})`, but the actual function requires `getPGN(tree, options)` with `headers`, `glyphs`, `comments`, `variations`, and `extraMarkups` (`src/utils/chess.ts:233-252`). The call as written cannot run the round trip; specify the parsed root and required options. (confidence: 96)

[blocker] `.plan-2026-10-01-lossless-nags-r3.body.md:131-138,226-228` — D’s alias behavior is not fully tested: the cases remove the □ aliases, but never click `=` when `$11` is active or call `goToAnnotation` on an alias. A canonical-code-only check would pass the listed tests yet fail those behaviors; the current navigation consumer uses exact inclusion (`src/state/store/tree.ts:291-315`) and the toggle has a distinct active-removal branch (`:561-571`). Add alias cases for both. (confidence: 92)

VERDICT: REVISE
```

#### `lens-tests-r3`

```text
N7 CLOSED — Test 6 adds `?!` to an initially unannotated `3.Nc3` and requires `Nc3?!` on disk, so an ignored save fails.

N9 CLOSED — Test 2 asserts the rendered Board hint and GameNotation text for `[220, 1]`; a mixed unknown-before-known display regression fails.

N10 CLOSED — Tests 2 and 3 cover `[7, 8]` rendering as one `□` and toggling both codes away while preserving `220`.

N11 CLOSED — Test 5 specifies the `getGameStats` fixture and expected white and black counts, including duplicate `!` counts.

[should-fix] N12 NOT CLOSED — The container pixel suite still has no NAG case. The WebDriver checks could pass if the SVG path exists but is invisible, such as with `opacity: 0`, so the glyph pixels lack a regression assertion. (confidence: 91)

[should-fix] tasks/plans/.plan-2026-10-01-lossless-nags-r3.body.md:246 — The delta requires screenshot review, but the proof command at line 251 invokes bare `pnpm verify:app`. The script writes a screenshot only when given `--screenshot <path>`, so the listed command produces no image to inspect. (confidence: 99)

[should-fix] tasks/plans/.plan-2026-10-01-lossless-nags-r3.body.md:223 — B changes EvalChart’s annotation label and point projection, but the rendered assertions cover only Board and GameNotation. EvalChart could still show numeric NAG codes or select the wrong glyph while all listed tests pass. (confidence: 93)

[should-fix] tasks/plans/.plan-2026-10-01-lossless-nags-r3.body.md:226 — D changes `goToAnnotation` to match aliases, but none of the listed tests navigates to a node carrying `$8` or `$11`. Reverting that lookup to canonical-code-only would pass the toggle and stats cases, leaving alias navigation broken. (confidence: 91)

LATE OBSERVATIONS

[should-fix] tasks/plans/.plan-2026-10-01-lossless-nags-r3.body.md:229 — The migration fixture has no repeated legacy glyph. The old parser preserves duplicate annotations and the stored array schema accepts them, so migration could deduplicate `["□", "□"]` and lose multiplicity while passing test 4. (confidence: 90)

VERDICT: APPROVED
```

#### `plan-review-delta.py` stdout, round 2

```text
ROUND: 2
DELTA: /home/felixb/Projekte/chessfable/tasks/plans/.plan-delta-2026-10-01-lossless-nags-r2.diff
REVISED:
## Goal
## Approach > ### A. NAG numbers are the stored identity
## Approach > ### B. One display catalogue maps codes to glyphs
## Approach > ### C. The writer emits every code
## Approach > ### D. Annotate-panel toggles work on glyph classes
## Approach > ### E. Persisted tabs migrate in place
## Decisions and trade-offs
## Risks / open questions
## Phases > ### Phase 1 — codes as identity, catalogue, writer, toggles, migration, display (one phase)
SETTLED:
# Plan: Lossless move annotations (NAGs) in the renderer's game tree
## MANDATE
## Threat model and non-goals
## Traced premises
## Approach
## Not part of this task
## Phases
```

#### `plan-review-delta.py` stdout, round 3

```text
ROUND: 3
DELTA: /home/felixb/Projekte/chessfable/tasks/plans/.plan-delta-2026-10-01-lossless-nags-r3.diff
REVISED:
## Approach > ### E. Persisted tabs migrate in place
## Phases > ### Phase 1 — codes as identity, catalogue, writer, toggles, migration, display (one phase)
SETTLED:
# Plan: Lossless move annotations (NAGs) in the renderer's game tree
## Goal
## MANDATE
## Threat model and non-goals
## Traced premises
## Approach
## Approach > ### A. NAG numbers are the stored identity
## Approach > ### B. One display catalogue maps codes to glyphs
## Approach > ### C. The writer emits every code
## Approach > ### D. Annotate-panel toggles work on glyph classes
## Decisions and trade-offs
## Risks / open questions
## Not part of this task
## Phases
```
## Appendix B — raw diff-review lens reports (2026-10-03)

#### `lens-chess-semantics-r1` (diff round 1)

```text
[blocker] src/utils/chessops.ts:61 — Editing the standard start so White’s king is on e2 while the rooks remain preserves white castling rights: the king exists, so normalization leaves them in the root FEN, though `Chess.fromSetup` drops them because the king is off the back rank. After `Nf3 Nf6 Ng1 Ng8` twice, `getBoardState` sees the root’s stale rights as different from the returned position, so threefold repetition is recognized one cycle late. (confidence: 94)

[should-fix] scripts/verify-app.mjs:2225 — CR-4: `--screenshot` can capture the selected 1.e4 position before navigation continues, so the harness can produce the planned image. But staging against the pre-fix NAG binary leaves the seeded-row, open-game, and move-navigation checks green; that run cannot provide §2 evidence for all 15 new checks. Stage the remaining assertions or record them as argued. (confidence: 98)

CR-1 CLOSED — `NagDisplay.test.tsx` asserts rendered EvalChart labels and colours for `[220]` and `[220, 1]`, with no numeric code in either label.

CR-2 CLOSED — Tests cover the active `$11` toggle and `goToAnnotation` navigation for nodes carrying only `$8` or `$11`.

CR-3 CLOSED — The round-trip test calls `getPGN(parsed.root, { headers: null, glyphs: true, comments: true, variations: true, extraMarkups: true })`.

CR-5 CLOSED — The migration fixture asserts `["□", "□"]` becomes `[7, 7]`.

CR-6 CLOSED — The real-window visibility check requires positive computed opacity on the hint and its ancestors through the board wrapper.

VERDICT: REVISE
```

#### `lens-code-quality-r1` (diff round 1)

```text
[blocker] src/utils/chess.ts:79 — The inline `1..6` range decides which NAGs become SAN suffix glyphs. This protocol rule has no name; the same module already uses `isBasicAnnotation` at line 645 to name the basic glyph class. Give the suffix-code rule a named predicate or constant. (confidence: 96)

[blocker] src/state/store/tree.ts:1004 — Novelty handling repeats `146` in its check and append, though the canonical N code is already named as `ANNOTATION_INFO.N.nag` in [annotation.ts](/home/felixb/Projekte/chessfable/src/utils/annotation.ts:191), and nearby analysis code derives codes from that table. (confidence: 98)

[blocker] src/utils/chess.ts:449 — The accepted NAG range `0..255` is hardcoded here and repeats `255` in [tabStorage.ts](/home/felixb/Projekte/chessfable/src/state/store/tabStorage.ts:153). That file names other bounds such as `MAX_TREE_NODES` and `MAX_TREE_DEPTH`, but leaves the NAG limit unnamed. (confidence: 91)

[should-fix] src/state/store/tabStorage.ts:216 — `migrateLegacyNodeComments` now also converts legacy annotation arrays to NAGs. Its name suggests it handles comments only, though `migrateTreeForStorage` relies on it for both migrations. Rename it to describe the node migration. (confidence: 92)

[should-fix] scripts/verify-app.mjs:20 — Staging only against the pre-fix release binary will leave several of the 15 new checks green: the seeded row, opening and move navigation, visible-box/opacity check, `?!` toggle, and saved edit still work with the old NAG handling. That run cannot provide a failure row for every assertion; stage additional input breaks or record genuinely unstageable assertions as argued. (confidence: 95)

[nit] scripts/verify-app.mjs:2294 — `reachedBoard` becomes true when the loop reaches `wrapper` (`board.parentElement`), not the `role="grid"` element named `board`. Rename it to make the CR-6 traversal endpoint clear. (confidence: 88)

CR-1 CLOSED — [NagDisplay.test.tsx](/home/felixb/Projekte/chessfable/src/components/common/NagDisplay.test.tsx:137) checks the exact `[220]` and `[220, 1]` labels and neutral/`!` colours.

CR-2 CLOSED — [NagDisplay.test.tsx](/home/felixb/Projekte/chessfable/src/components/common/NagDisplay.test.tsx:154) covers active alias toggles; [tree.test.ts](/home/felixb/Projekte/chessfable/src/state/store/tree.test.ts:115) covers navigation to `$8` and `$11`.

CR-3 CLOSED — [chess.test.ts](/home/felixb/Projekte/chessfable/src/utils/tests/chess.test.ts:59) calls `getPGN` with the specified full options signature, matching its declaration in [chess.ts](/home/felixb/Projekte/chessfable/src/utils/chess.ts:230).

CR-4 CLOSED — `pnpm verify:app --screenshot <path>` reaches the script’s `--screenshot` argument; the capture runs after selecting 1.e4 and before navigating to d5 ([verify-app.mjs](/home/felixb/Projekte/chessfable/scripts/verify-app.mjs:2334)).

CR-5 CLOSED — [tabStorage.test.ts](/home/felixb/Projekte/chessfable/src/state/store/tabStorage.test.ts:95) migrates repeated legacy `□` glyphs to `[7, 7]`.

CR-6 CLOSED — The visibility probe requires positive computed opacity for the hint and its ancestor chain through the common board wrapper ([verify-app.mjs](/home/felixb/Projekte/chessfable/scripts/verify-app.mjs:2297)).

VERDICT: REVISE
```

#### `lens-correctness-r1` (diff round 1)

```text
[should-fix] scripts/verify-app.mjs:2325 — CR-4: the screenshot branch correctly captures after selecting 1.e4, before navigating to d5. But staging only against the pre-fix binary is insufficient: with the seeded `$8` PGN, the old code still renders a visible empty hint, so the visibility assertion passes; the row, navigation, toggle, and `Nc3?!` save checks also remain green. Add staged cases for assertions that pass unchanged, recording each assertion’s failure message and exit status as required by push-review-policy §2. (confidence: 98)

CR-1 CLOSED — EvalChart consumes projected glyphs; rendered tests check the unknown-only neutral label and the known-glyph label and colour.

CR-2 CLOSED — Toggle tests cover `$8` and `$11` aliases; navigation tests find nodes carrying either alias.

CR-3 CLOSED — The round-trip test calls `getPGN` with the specified full options object.

CR-5 CLOSED — The migration fixture verifies repeated `["□", "□"]` loads as `[7, 7]`.

CR-6 CLOSED — The visibility probe checks positive opacity and display/visibility through the board wrapper’s ancestors.

VERDICT: APPROVED
```

#### `lens-error-handling-r1` (diff round 1)

```text
[blocker] src/state/store/tabStorage.ts:219 — A node with a non-array `nags` value and valid legacy `annotations` is treated as old data. The migration overwrites the corrupt value, so `parseTree` accepts it and `readTree` can rewrite the original bytes as available instead of retaining them behind the recovery gate. (confidence: 95)

[should-fix] scripts/verify-app.mjs:2211 — A run against the pre-fix release binary alone will leave some new assertions green: the Files row, navigation, annotation, and save controls still work, and failures in the hint checks do not gate later steps. Those assertions would lack their own failure-message and exit-status evidence. (confidence: 92)

CR-1 CLOSED — `NagDisplay.test.tsx` checks EvalChart labels, colours, and absence of numeric codes for `[220]` and `[220, 1]`.

CR-2 CLOSED — Tests cover alias toggles for `$11` and alias navigation for `$8` and `$11`.

CR-3 CLOSED — `chess.test.ts` calls `getPGN` with the specified full options object.

CR-4 CLOSED — The screenshot is written only with `--screenshot`, after the `1.e4` navigation succeeds and before navigation to `2...d5`. The fresh release run and image inspection remain pending as specified.

CR-5 CLOSED — The migration fixture checks repeated legacy `□` values become `[7, 7]`.

CR-6 CLOSED — The visibility probe checks positive opacity on the hint and its ancestors through the board.

VERDICT: REVISE
```

#### `lens-minimalism-r1` (diff round 1)

```text
a6348c79

[should-fix] scripts/verify-app.mjs:2229 — The NAG scenario repeats the Files double-click action sequence at lines 2154–2177. Extract a shared `doubleClickAt(session, x, y)` helper and use it at both sites (confidence: 99)

[should-fix] src/utils/chess.ts:78 — The writer repeats the ascending NAG sort in `nagGlyphs` at `src/utils/annotation.ts:82–83`. Share the raw-code ordering helper so display and PGN output use the same order rule (confidence: 87)

[nit] src/utils/chess.ts:449 — The parser’s 0–255 bounds duplicate the persisted schema’s bounds in `src/state/store/tabStorage.ts:153`. Shared min/max values would keep parsing and persisted-state validation aligned (confidence: 88)

[nit] src/state/store/tree.ts:1004 — The novelty code `146` duplicates `ANNOTATION_INFO.N.nag`; use the catalogue value so the mapping has one source (confidence: 92)

[nit] src/state/store/tabStorage.test.ts:218 — This 25-code fixture is repeated at line 315. Share the list so the schema fixtures cannot drift (confidence: 95)

[should-fix] scripts/verify-app.mjs:2225 — CR-4: the screenshot argument is wired, and capture occurs after selecting 1.e4 and before navigating to 2...d5. A single run against the pre-fix binary will still pass the seeded-row, navigation, toggle, and ordinary-save checks; the old empty badge also has a visible box. Stage those remaining assertions with permitted input breaks, or name genuinely unstageable assertions as argued, before citing the verifier’s green result (confidence: 93)

New-file counterfactual — `NagDisplay.test.tsx` combines the four rendered consumers and toggle cases under one shared render harness. I found no smaller same-coverage version; splitting it among existing suites would repeat setup.

CR-1 CLOSED — EvalChart cases assert the `[220]` neutral label and `[220, 1]` `!` label and colour; numeric codes are also checked.

CR-2 CLOSED — Tests cover `$11` toggle activation/removal and navigation to `$8` and `$11`.

CR-3 CLOSED — The round-trip test calls `getPGN` with the specified full options signature.

CR-5 CLOSED — Migration fixture verifies repeated `["□", "□"]` becomes `[7, 7]`.

CR-6 CLOSED — The visibility probe checks positive computed opacity on the hint and its ancestors through the board.

VERDICT: REVISE
```

#### `lens-persisted-state-r1` (diff round 1)

```text
[should-fix] scripts/verify-app.mjs:28 — One run against the pre-fix binary cannot stage all 15 NAG assertions: Files navigation, the `?!` edit and save, and `$1/$2` preservation can still pass. Record a unique failure message and exit status for each assertion, or mark genuinely unstageable cases as argued, before citing the verifier’s green result (confidence: 96)

CR-1 CLOSED — `NagDisplay.test.tsx:137-151` checks the rendered EvalChart label and colour for `[220]` and `[220, 1]`, and rejects numeric NAG text.

CR-2 CLOSED — `NagDisplay.test.tsx:154-170` covers the active `$11` toggle; `tree.test.ts:115-125` covers navigation to `$8` and `$11`.

CR-3 CLOSED — `chess.test.ts:59-65` calls `getPGN` with the specified real signature.

CR-4 CLOSED — `verify-app.mjs:2334-2337` writes the screenshot after selecting 1.e4 and before navigating to d5, when `--screenshot <path>` is supplied.

CR-5 CLOSED — `tabStorage.test.ts:88-117` verifies repeated legacy `□` glyphs migrate to `[7, 7]` and are written back.

CR-6 CLOSED — `verify-app.mjs:2303-2309` checks positive opacity through the board wrapper and its ancestors.

VERDICT: APPROVED
```

#### `lens-pgn-index-r1` (diff round 1)

```text
[should-fix] scripts/verify-app.mjs:2210 — The planned run against the pre-fix binary will leave several NAG assertions untested: with the seeded `1. e4 $8 ... 3. Nc3 *` file, the row, opening and navigation checks, hint-visibility check, `?!` toggle, and saved `Nc3?!` check still pass. Stage those assertions with breaks that make each assertion itself fail, and record its unique failure message and exit status. (confidence: 99)

CR-1 CLOSED — The EvalChart test checks both labels and colors for `[220]` and `[220, 1]`.

CR-2 CLOSED — Tests cover the `$11` toggle and navigation to nodes carrying only `$8` or `$11`.

CR-3 CLOSED — The round-trip test calls `getPGN` with the specified signature; file and database saves use that serializer.

CR-4 CLOSED — `pnpm verify:app --screenshot <path>` writes the screenshot after selecting 1.e4 and before navigating to 2...d5. The planned pre-fix run does not stage every assertion; see finding.

CR-5 CLOSED — The migration fixture checks `["□", "□"]` becomes `[7, 7]`.

CR-6 CLOSED — The visibility probe requires positive opacity on the hint and its ancestors through the board wrapper.

VERDICT: APPROVED
```

#### `lens-root-cause-r1` (diff round 1)

```text
The diff fixes the loss mechanism: parsing stores raw NAG codes in the tree, and saving writes those codes back. The line history shows no earlier fix of this NAG-loss defect that the diff reintroduces.

[should-fix] scripts/verify-app.mjs:2325 — CR-6: The planned staging against the pre-fix binary will not exercise the opacity assertion. That version still renders the empty `$8` hint as a visible grey badge with a nonzero box and positive opacity, so this check passes despite the bug. (confidence: 99)

CR-1 CLOSED — `NagDisplay.test.tsx` asserts EvalChart labels, neutral and `!` colors, and no numeric NAG output.

CR-2 CLOSED — Tree-store tests cover alias toggles and navigation for `$8` and `$11`.

CR-3 CLOSED — The round-trip test calls `getPGN` with the specified full options object.

CR-4 CLOSED — The harness writes a screenshot only when `--screenshot` is supplied, after selecting 1.e4 and before navigating to d5. The scheduled fresh-release run and image inspection are still pending.

CR-5 CLOSED — The migration fixture asserts repeated `["□", "□"]` loads as `[7, 7]`.

VERDICT: APPROVED
```

#### `lens-tests-r1` (diff round 1)

```text
[should-fix] src/utils/tests/chess.test.ts:38 — The round-trip test invents `Token.Nag` values with a mocked `lexPgn`. A real-lexer regression that drops repeated NAGs or mishandles `$0`/`$255` would leave this test green; the real-window fixture covers those codes only singly or not at all. The planned real-token-path round trip is therefore unproven (confidence: 91).

[should-fix] scripts/verify-app.mjs:2325 — Staging against the pre-fix binary will not make the positive visibility check fail: the old code still renders `$8` as a visible grey badge with an empty glyph. The path and title checks catch that NAG regression, but this visibility assertion—and the scenario checks that still pass on the old app—will lack their own staged failure evidence (confidence: 95).

CR-1 CLOSED — `NagDisplay.test.tsx:137-150` checks EvalChart labels and colours for `[220]` and `[220, 1]`, including the absence of numeric codes.

CR-2 CLOSED — `NagDisplay.test.tsx:154-170` checks the `$11` toggle; `tree.test.ts:115-125` checks navigation for `$8` and `$11`.

CR-3 CLOSED — `chess.test.ts:59-65` calls `getPGN` with the specified options.

CR-4 CLOSED — `verify-app.mjs:2311-2336` writes the screenshot only after selecting 1.e4, when `--screenshot <path>` is supplied.

CR-5 CLOSED — `tabStorage.test.ts:95-117` checks repeated `["□", "□"]` migrates to `[7, 7]`.

CR-6 CLOSED — `verify-app.mjs:2294-2308` checks positive opacity through the hint’s ancestors and requires reaching the board wrapper.

VERDICT: APPROVED
```

#### `lens-chess-semantics-r2` (diff round 2)

```text
D2 CLOSED — All nine NAG assertions have staged-failure evidence: run A reports seven failures against the pre-fix binary; run B reports six with the opacity and save-handler breaks. Setup failures are reported on each dependent assertion.

VERDICT: APPROVED
```

#### `lens-code-quality-r2` (diff round 2)

```text
D1 CLOSED — `migrateLegacyNode` checks for an own `nags` key; tests cover `"x"` and `null` while preserving the raw bytes.

D2 CLOSED — `verify-app.mjs` records failures for all nine NAG assertions across runs A and B, with each run exiting 1.

D3 CLOSED — `lexer::tests::test_lex_pgn_sync_lossless_nags` pins the token vector; the Vitest mock names that test.

D4 CLOSED — `doubleClickAt` is used by both the Files and NAG scenarios.

D5 CLOSED — `sortedNags` is shared by `nagGlyphs` and the PGN writer.

D6 CLOSED — suffix selection checks `isBasicAnnotation(glyph)`.

D7 CLOSED — novelty uses `ANNOTATION_INFO.N.nag`.

D8 CLOSED — `MAX_NAG` and `isNagCode` are shared by the schema and parser.

D9 CLOSED — `migrateLegacyNode` and its comment describe both legacy field migrations.

D10 CLOSED — the probe names the boundary `reachedBoardWrapper`.

D11 CLOSED — `SUPPORTED_NAGS` replaces the repeated fixture in both locations.

[should-fix] `src/state/store/tabStorage.test.ts:17` — `SUPPORTED_NAGS` contains only canonical glyph codes; the schema accepts 0–255, including aliases such as 8 and 11. Rename it to identify the narrower fixture (for example, `CANONICAL_GLYPH_NAGS`). (confidence: 91)

Full-range readability blockers: none.

VERDICT: APPROVED
```

#### `lens-correctness-r2` (diff round 2)

```text
D1 CLOSED — migration now leaves any node with its own `nags` key untouched; tests cover `"x"` and `null` retaining unreadable status and raw bytes.

D2 CLOSED — all nine dependent assertions are staged in the verifier record: run A fails seven on the pre-fix binary; run B fails visibility and save assertions under separate breaks.

D3 CLOSED — the Rust lexer test pins the exact token vector; the Vitest mock names that test.

D4 CLOSED — Files and NAG scenarios use `doubleClickAt` with the same pointer sequence.

D5 CLOSED — `sortedNags` is shared by the glyph projection and PGN writer.

D6 CLOSED — suffix output now depends on `isBasicAnnotation` for the first sorted code.

D7 CLOSED — novelty uses `ANNOTATION_INFO.N.nag` instead of literal `146`.

D8 CLOSED — `MAX_NAG` and `isNagCode` centralize the `0..=255` bound for schema and parser.

D9 CLOSED — the migration walker and its documentation use `migrateLegacyNode`.

D10 CLOSED — the verifier names the reached element `reachedBoardWrapper`.

D11 CLOSED — both fixtures use the shared `SUPPORTED_NAGS` constant.

VERDICT: APPROVED
```

#### `lens-error-handling-r2` (diff round 2)

```text
D1 CLOSED — `migrateLegacyNode` migrates only when the node has no own `nags` key; tests confirm corrupt `"x"` and `null` values stay unreadable and their raw bytes remain unchanged ([tabStorage.ts](/home/felixb/Projekte/chessfable/src/state/store/tabStorage.ts:220), [tabStorage.test.ts](/home/felixb/Projekte/chessfable/src/state/store/tabStorage.test.ts:174)).

D2 CLOSED — The verifier records all nine NAG assertions and staged failures with distinct messages and nonzero exits; dependent assertions report setup failures ([verify-app.mjs](/home/felixb/Projekte/chessfable/scripts/verify-app.mjs:152), [verify-app.mjs](/home/felixb/Projekte/chessfable/scripts/verify-app.mjs:2249)).

D3 CLOSED — The Rust lexer test pins the exact token vector for duplicate, alias, boundary, and attached NAGs ([lexer.rs](/home/felixb/Projekte/chessfable/src-tauri/src/lexer.rs:313)).

D4 CLOSED — `doubleClickAt` is shared by the Files and NAG scenarios ([verify-app.mjs](/home/felixb/Projekte/chessfable/scripts/verify-app.mjs:792)).

D5 CLOSED — `sortedNags` is shared by the glyph projection and PGN writer ([annotation.ts](/home/felixb/Projekte/chessfable/src/utils/annotation.ts:83), [chess.ts](/home/felixb/Projekte/chessfable/src/utils/chess.ts:78)).

D6 CLOSED — The writer uses `isBasicAnnotation` on the first code’s glyph to decide whether to write a suffix ([chess.ts](/home/felixb/Projekte/chessfable/src/utils/chess.ts:80)).

D7 CLOSED — Novelty uses `ANNOTATION_INFO.N.nag` ([tree.ts](/home/felixb/Projekte/chessfable/src/state/store/tree.ts:1004)).

D8 CLOSED — `MAX_NAG` and `isNagCode` centralize the bound used by storage validation and parsing ([annotation.ts](/home/felixb/Projekte/chessfable/src/utils/annotation.ts:77), [tabStorage.ts](/home/felixb/Projekte/chessfable/src/state/store/tabStorage.ts:153), [chess.ts](/home/felixb/Projekte/chessfable/src/utils/chess.ts:450)).

D9 CLOSED — The migration helper and its documentation are renamed to `migrateLegacyNode` ([tabStorage.ts](/home/felixb/Projekte/chessfable/src/state/store/tabStorage.ts:217)).

D10 CLOSED — The verifier uses `reachedBoardWrapper` ([verify-app.mjs](/home/felixb/Projekte/chessfable/scripts/verify-app.mjs:2326)).

D11 CLOSED — Both fixtures use the shared `SUPPORTED_NAGS` constant ([tabStorage.test.ts](/home/felixb/Projekte/chessfable/src/state/store/tabStorage.test.ts:17)).

LATE OBSERVATIONS

VERDICT: APPROVED
```

#### `lens-minimalism-r2` (diff round 2)

```text
D1 CLOSED — `migrateLegacyNode` checks for an own `nags` key; tests for `"x"` and `null` confirm corrupt values stay unreadable and raw bytes remain.
D2 CLOSED — the harness records nine NAG assertions with distinct failure messages; the pre-fix and staged-break runs both exited 1.
D3 CLOSED — the Rust lexer test pins the NAG token vector; the Vitest mock names that test.
D4 CLOSED — `doubleClickAt` serves both the Files and NAG scenarios.
D5 CLOSED — `sortedNags` is shared by display projection and PGN writing.
D6 CLOSED — suffix writing uses `isBasicAnnotation(nagGlyph(code))`.
D7 CLOSED — novelty uses `ANNOTATION_INFO.N.nag`.
D8 CLOSED — `MAX_NAG` and `isNagCode` centralize the bound used by parsing and schema validation.
D9 CLOSED — the migration helper is renamed `migrateLegacyNode`.
D10 CLOSED — the wrapper boundary is named `reachedBoardWrapper`.
D11 CLOSED — `SUPPORTED_NAGS` is shared by both repeated fixtures.

VERDICT: APPROVED
```

#### `lens-persisted-state-r2` (diff round 2)

```text
D1 CLOSED — `migrateLegacyNode` converts legacy annotations only when the node has no own `nags`; tests verify corrupt `nags` values stay unreadable and their raw bytes remain intact.

D2 CLOSED — `verify-app.mjs` distinguishes setup failures from assertions; its staged-failure record gives individual messages and nonzero exits for the broken assertions.

D3 CLOSED — the Rust lexer test pins the real token vector, including repeated and boundary NAGs.

D4 CLOSED — `doubleClickAt` is shared by the Files and NAG scenarios.

D5 CLOSED — `sortedNags` is shared by the writer and glyph projection.

D6 CLOSED — the writer uses a suffix only for the first sorted code when its glyph is a basic annotation.

D7 CLOSED — novelty uses `ANNOTATION_INFO.N.nag`.

D8 CLOSED — `MAX_NAG` and `isNagCode` are used by the parser and persisted schema.

D9 CLOSED — the migration walk is named `migrateLegacyNode` and its comment describes both migrations.

D10 CLOSED — the hint probe tracks whether it reached the board wrapper with `reachedBoardWrapper`.

D11 CLOSED — the shared `SUPPORTED_NAGS` fixture replaces both duplicated lists.

VERDICT: APPROVED
```

#### `lens-pgn-index-r2` (diff round 2)

```text
D1 CLOSED — `tabStorage.ts` migrates legacy annotations only when the node has no own `nags`; tests preserve corrupt raw values for `"x"` and `null`.

D2 CLOSED — `verify-app.mjs` propagates setup failures to dependent assertions; its recorded pre-fix and staged no-op save runs fail as expected.

D3 CLOSED — `lexer.rs` pins the real token vector for duplicate NAGs, attached suffixes, `$8`/`$11`, and `$0`/`$255`.

D4 CLOSED — `doubleClickAt` is shared by the Files and NAG scenarios.

D5 CLOSED — `sortedNags` is shared by `nagGlyphs` and the PGN writer.

D6 CLOSED — the writer uses a suffix only for the first code when its glyph is a basic annotation.

D7 CLOSED — analysis novelty uses `ANNOTATION_INFO.N.nag`.

D8 CLOSED — `MAX_NAG` and `isNagCode` centralize the parser and schema bounds.

D9 CLOSED — the migration is named `migrateLegacyNode`, and the combined migration walk remains in place.

D10 CLOSED — the visibility check tracks whether it reached the board wrapper.

D11 CLOSED — `SUPPORTED_NAGS` is reused by the tab-storage fixtures.

VERDICT: APPROVED
```

#### `lens-root-cause-r2` (diff round 2)

```text
D1 CLOSED — `migrateLegacyNode` skips migration when the node owns `nags`; tests for `"x"` and `null` confirm the bytes remain and the tree stays unreadable.

[should-fix] D2 NOT CLOSED — `scripts/verify-app.mjs` records the opacity break and no-op save break in the same staged run. The named review policy requires one change at a time, so those failures lack isolated staged evidence.

D3 CLOSED — The Rust lexer test pins tokens for duplicate `$8`, `$11`, attached suffixes, `$220`, `$0`, and `$255`.

D4 CLOSED — `doubleClickAt` is shared by the Files and NAG scenarios.

D5 CLOSED — `sortedNags` is shared by the writer and glyph projection.

D6 CLOSED — Only the first code whose glyph is a basic annotation uses a suffix.

D7 CLOSED — Novelty uses `ANNOTATION_INFO.N.nag`.

D8 CLOSED — `MAX_NAG` and `isNagCode` centralize the parser and storage bounds.

D9 CLOSED — The migration helper and its documentation now cover legacy node fields.

D10 CLOSED — The board-wrapper reach check is named `reachedBoardWrapper`.

D11 CLOSED — `SUPPORTED_NAGS` is reused by both schema fixtures.

VERDICT: APPROVED
```

#### `lens-tests-r2` (diff round 2)

```text
D1 CLOSED — `tabStorage.test.ts:174–184` covers both corrupt own `nags` values (`"x"` and `null`), requiring unreadable status and unchanged raw bytes.

D2 CLOSED — `verify-app.mjs:151–187` records distinct failures for all nine NAG assertions. Run A reports seven failures on the pre-fix binary; Run B reports six after staged opacity and no-op save breaks, with exit 1 in both runs.

D3 CLOSED — `lexer::tests::test_lex_pgn_sync_lossless_nags` asserts the real lexer’s full token vector, including duplicate, alias, unknown, boundary, and suffix NAGs; the Vitest mock names that test.

D4 CLOSED — `doubleClickAt` now serves both Files and NAG scenarios; the real-window checks exercise both routes.

D5 CLOSED — `sortedNags` is shared by glyph projection and PGN writing; tests cover glyph ordering and sorted serialization.

D6 CLOSED — the writer uses the named basic-annotation rule; the round-trip test asserts `d4! $2`, and the Rust lexer test verifies the separated tokens.

D7 CLOSED — novelty uses `ANNOTATION_INFO.N.nag`; this replaces the same `146` value without changing behavior.

D8 CLOSED — `MAX_NAG` and `isNagCode` are shared by parser and schema; tests cover malformed values and the accepted `0`/`255` boundaries.

D9 CLOSED — the migration helper and recursive call sites use `migrateLegacyNode`.

D10 CLOSED — the visibility probe tracks `reachedBoardWrapper` and checks opacity through the board ancestors.

D11 CLOSED — `SUPPORTED_NAGS` replaces both repeated fixtures in `tabStorage.test.ts`.

VERDICT: APPROVED
```

#### `lens-code-quality-r3` (diff round 3)

```text
D2 CLOSED — B1 and B2 document separate single-change breaks, with their respective failure output and exit status.

R2-1 CLOSED — `SUPPORTED_NAGS` is renamed `CANONICAL_GLYPH_NAGS`, and both fixtures use the clearer name.

[should-fix] scripts/verify-app.mjs:153 — “Three runs, one change each” includes Run A, which is described as a pre-fix baseline, not a single-change staged break. Clarify that A is the baseline and B1/B2 are the isolated breaks (confidence: 96).

Blockers anywhere in the full range: none found.

LATE OBSERVATIONS

None.

VERDICT: APPROVED
```

#### `lens-correctness-r3` (diff round 3)

```text
D2 residual CLOSED — evidence: `scripts/verify-app.mjs:152-188` records B1 and B2 as separate one-change runs; the supplied results show each run’s specific failures and exit status.
R2-1 CLOSED — evidence: `src/state/store/tabStorage.test.ts:17,233,327` names the fixture `CANONICAL_GLYPH_NAGS` and uses it in both references.

### LATE OBSERVATIONS

No correctness defects introduced by this round’s diff; no blocker found in the full range.

VERDICT: APPROVED
```

#### `lens-persisted-state-r3` (diff round 3)

```text
D2 residual CLOSED — `scripts/verify-app.mjs` records B1 and B2 separately; the supplied evidence shows each isolated break failed its own check, followed by a clean rebuild.

R2-1 CLOSED — the fixture is renamed `CANONICAL_GLYPH_NAGS` in the test and both uses.

No persistence defects were introduced by the round-three diff.

[blocker] src/state/store/tabStorage.ts:221 — The legacy array check omits the old schema’s `.max(1_024)` bound. A stored legacy node with 1,025 allowed glyphs, including one `""`, passes migration; dropping `""` leaves 1,024 NAGs, so `readTree` accepts and rewrites bytes that the old schema would have kept unreadable for recovery (confidence: 93).

### LATE OBSERVATIONS

None.

VERDICT: REVISE
```

#### `lens-root-cause-r3` (diff round 3)

```text
D2 residual CLOSED — evidence: [verify-app.mjs](/home/felixb/Projekte/chessfable/scripts/verify-app.mjs:152) records separate B1 opacity and B2 save breaks; the supplied results show one staged change per run, a targeted failure message, and exit 1 for each.

R2-1 CLOSED — evidence: [tabStorage.test.ts](/home/felixb/Projekte/chessfable/src/state/store/tabStorage.test.ts:17) now names the fixture `CANONICAL_GLYPH_NAGS`; the supplied run reports 106 tests passed.

Round 3 DIFF defects: none.

[blocker] src/state/store/tabStorage.ts:221 — The migration reopens the unreadable-tab bypass the old schema’s `.max(1_024)` prevented. Its unbounded `z.array(annotationSchema)` accepts 1,025 valid legacy glyphs; if they are all `""`, the migration filters them to `nags: []`, which passes the new schema. `readTree` then marks the corrupt tab available and rewrites its stored bytes instead of preserving them for recovery. (confidence: 100)

LATE OBSERVATIONS

The full-range change fixes the NAG loss mechanism for readable trees: parsing stores raw codes, display derives glyphs from them, and saving writes the codes back. The supplied pre-fix failures and clean post-fix verification support that conclusion.

VERDICT: REVISE
```

#### `lens-tests-r3` (diff round 3)

```text
D2 residual CLOSED — B1 records the opacity-only break failing the hint visibility assertion; B2 records the SAVE_FILE-only break failing the save assertion and its four dependants, each with exit 1.

R2-1 CLOSED — the fixture is now named `CANONICAL_GLYPH_NAGS`, matching the canonical codes it contains.

Round-three diff defects: None.

Full-range blockers: None.

LATE OBSERVATIONS

[should-fix] src/components/common/NagDisplay.test.tsx:112 — No Board assertion renders `$11` through `AnnotationHint`; the projection test checks that `$11` maps to `"="`, but a blank `glyphToSvg["="]` could leave every current test green. The real-app check verifies `$11` survives save without navigating to its board hint. (confidence: 92)

[should-fix] src/utils/tests/chess.test.ts:38 — The round-trip test mocks `lexPgn` and constructs NAG tokens itself. Rust’s lexer test checks duplicate tokens separately, while the real-app fixture has no duplicate NAGs; losing adjacent duplicates across the native-to-renderer boundary could therefore pass both. (confidence: 94)

VERDICT: APPROVED
```

#### `lens-code-quality-r4` (diff round 4)

```text
R3-1 CLOSED — `MAX_NODE_NAGS` bounds both arrays; tests cover 1,025 unreadable entries with raw bytes retained and the 1,024-entry migration boundary.

R3-2 CLOSED — Board rendering tests now include NAG 11 displaying `=`.

R3-3 CLOSED — The lexer emits each NAG as a token in its returned `Vec<Token>`, and the renderer appends each occurrence; the premise is unchanged.

R3-4 CLOSED — The staged-failure note now identifies A as the pre-fix baseline and B1/B2 as single-change runs.

LATE OBSERVATIONS

No round-four readability or local-consistency defects found; no blocker-level defect found in the full range.

VERDICT: APPROVED
```

#### `lens-correctness-r4` (diff round 4)

```text
R3-1 CLOSED — `MAX_NODE_NAGS = 1_024` caps both persisted NAGs and legacy annotation parsing; tests cover rejection at 1,025 and migration at 1,024.

R3-2 CLOSED — Board rendering tests now cover `$11` → `=`.

R3-3 CLOSED — The prior IPC evidence still holds: this diff adds no lexer or IPC deduplication path.

R3-4 CLOSED — The staging record now identifies run A as the pre-fix baseline and B1/B2 as single-change runs.

Current-round correctness defects: none found.

Full-range blockers: none found.

### LATE OBSERVATIONS

None.

VERDICT: APPROVED
```

#### `lens-persisted-state-r4` (diff round 4)

```text
R3-1 CLOSED — `tabStorage.ts:25,154,222-228` caps both stored NAGs and legacy annotations at 1,024, matching the old schema. Tests cover refusal at 1,025 with raw bytes retained and migration at 1,024 to `[1]`.

R3-2 CLOSED — `NagDisplay.test.tsx:112-116` covers `$11` rendering as `=`.

R3-3 CLOSED — `lexer.rs:90-95,196-202,313-344` preserves adjacent NAG tokens in the returned vector; the generated binding returns `Token[]`, and `chess.test.ts:34-67` pins `[8, 8]` through parsing and save output.

R3-4 CLOSED — `verify-app.mjs:152-161` now identifies A as the pre-fix baseline and B1/B2 as single-change runs.

Round-4 diff: no persistence defect found.

Full range: no blocker found.

### LATE OBSERVATIONS

None.

VERDICT: APPROVED
```

#### `lens-root-cause-r4` (diff round 4)

```text
R3-1 CLOSED — `MAX_NODE_NAGS` now caps both the persisted schema and legacy parse. The 1,025-entry case stays unreadable with raw bytes retained; supplied evidence shows it fails before the cap and passes after, with the 1,024 boundary accepted.

R3-2 CLOSED — `NagDisplay.test.tsx` now checks that `$11` renders the `=` Board hint.

R3-3 CLOSED — The lexer appends each NAG token to the returned token array, and its test covers adjacent duplicate `$8` tokens; no deduplication path appeared across IPC.

R3-4 CLOSED — The verification record now identifies A as the pre-fix baseline and B1/B2 as single-change runs.

No defects introduced by round-4 diff.

No blockers found in the full range.

### LATE OBSERVATIONS

The full-range change addresses the loss mechanism for newly parsed PGNs: the old parser converted NAGs to glyphs and mapped unknown codes to `""`; the new parser stores numeric codes and the writer emits them. The plan’s documented limit remains for tabs persisted before the fix: their `""` sentinels and alias glyphs cannot recover the original codes. Those games must be reopened from their source before saving.

VERDICT: APPROVED
```

#### `lens-tests-r4` (diff round 4)

```text
R3-1 CLOSED — the 1,025 and 1,024 legacy-array tests assert refusal with raw bytes preserved and successful migration with write-back.
R3-2 CLOSED — `NagDisplay.test.tsx` now renders `$11` and asserts the `=` hint title and glyph path.
R3-3 CLOSED — the Rust lexer test pins adjacent duplicate NAG tokens; the changed range adds no transformation between the `Vec<Token>` IPC response and the renderer.
R3-4 CLOSED — the staging record now identifies A as the pre-fix baseline and B1/B2 as single-change runs.

Diff defects: None.

Full-range blockers: None.

### LATE OBSERVATIONS

The Vitest selector includes the changed renderer and storage tests; the backend test gate runs Rust tests with `cargo test --all-targets`. The real-window scenario is reachable with `pnpm verify:app --screenshot <path>`.

VERDICT: APPROVED
```
