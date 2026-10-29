# ChessRiddle design alignment — review record

Build run 2026-10-29, orchestrator Claude Code, executor Codex (leaves via `leaf-launch.sh`). Plan:
`tasks/plans/2026-10-29-chessriddle-design.md` (ignored; its MANDATE, decisions and full plan-review
history are reproduced below so this file recovers the history on its own). Implementation and
review both ran on the OpenAI model family (same-family review disclosed); arbitration by Claude.

Commits: `3274183b` foundation (tokens, fonts, fixed gold, component styles, board default),
`2c5fcb8c` Lucide icons, `a30f983d` panel structure, `38b72986` review repairs (D-1, D-2, D-3),
`a5d2750f` dark Black-better chip (D-5), `2ef77ff6` re-recorded snapshots, plus the decision and
finding record commits.

Findings filed: `f-20261029-07` (tablebase move ranking, pre-existing), `f-20261029-08` (WDL bar
unnamed progressbars, pre-existing). Decisions: `d-20261029-07`..`-11`, `-16`, `-21`, `-22`.

## MANDATE (verbatim from the plan)


Felix, 2026-10-29 (verbatim, in order):

1. "I'm not sure about the general design. ... currently everything is in the same color and just
   the buttons are only distinguished by small lines. ... I think we should make a bit more of a
   contrast, maybe add different... slightly different colors to show which panels belong together
   and... to emphasize a bit more the buttons and everything."
2. "I like the design of Chess Riddle a lot and I think about adjusting this a bit. Because
   currently, for example, you can choose here every color that you want, but I'm not sure about
   this. Maybe this should just be a fixed color like we have it in Chess Riddle and every element,
   I mean every drop-down, every button, the whole color theme could be exactly as we have it in
   Chess Riddle."
3. Felix accepted both recommendations: align with ChessRiddle (shared tokens and feel, not shared
   code), and remove the accent-colour picker in favour of the fixed ChessRiddle gold. Felix's
   reply: "Alright, let's do it like this. I like it a lot."
4. "And this should also go for, for example, you see the icons in the settings. All this should
   also be aligned. For example, for appearance we use a different icon in Chess Riddle. I know
   that. And yeah, the drop downs, all the toggle buttons, the filter, all the symbols, I think all
   that should be aligned."
5. "Now do this full auto executor codex on a separate work tree."

Accepted scope from the recommendation Felix approved: Light/Dark/Auto stays; board and piece
choices stay selectable; ChessRiddle's board is offered as the default; ChessFable keeps its denser
spacing for notation and engine lines; no shared cross-repo token package; no sync feature.

## Plan review


### Plan Round 1 (plan-r1) — 8 lenses, Codex leaves

Raw verdicts: review-plan REVISE (3 blocker, 1 should-fix); review-tests REVISE (1 blocker, 1
should-fix); review-minimalism APPROVED (1 should-fix, 1 nit); review-correctness APPROVED;
review-error-handling APPROVED; review-persisted-state APPROVED; review-engine-protocol NOT
APPLICABLE / APPROVED; review-chess-semantics NOT APPLICABLE / APPROVED. Raw reports:
`/tmp/build-chessriddle-design/lens-*-r1.txt`.

- **P-1** (review-plan #1, blocker) — O1 palette re-derivation would recolour NAG/engine colours
  that resolve Mantine named palettes (`src/utils/annotation.ts:137`, `MoveCell.tsx:43`,
  `Board.tsx:323`). Verified in source. MANDATE obligation: behaviour unchanged / O5 board colours.
  **Fix**: named palettes stay default; ChessRiddle semantics added as new palettes
  `danger/success/warning/info`; O5 points chrome uses at them. Status: open (closure r2).
- **P-2** (review-plan #2, blocker) — re-recording the existing matrix cannot reach summary strip,
  negative evals or dark analysis (`playwright.config.ts:42`, `e2e/engine-gap.spec.ts:298,311`).
  Verified. MANDATE item 1 (panels/buttons contrast) needs proof. **Fix**: new two-engine
  scenario with +/−/0 scores, light and dark snapshots, plus dark Settings Appearance. Open.
- **P-3** (review-plan #3, blocker; review-tests #1, blocker) — O8's unavailable-selection
  fallback had no proof. **Fix (by removal)**: the fallback was not mandated (no board removed;
  pre-existing arbitrary-string storage is unchanged and unobserved, rule 4d, not filed). O8 now
  changes only the board default; proof = unit test for new default and unchanged stored value. Open.
- **P-4** (review-plan #4, should-fix) — phases overlapped subsystems. **Fix (partial recut)**:
  O8 moved into Phase 1 so `src/state/**` is one phase; analysis components only in Phases 2/3;
  remaining SettingsPage overlap justified in `## Phases` (single dependency swap vs 4,207 B
  budget). Open.
- **P-5** (review-minimalism #1, should-fix) — cburnett piece default outside accepted scope.
  **Fix**: dropped. Open.
- **P-6** (review-minimalism #2, nit) — DESIGN.md duplicated token values. **Fix**: DESIGN.md
  references `theme.ts`. Closed by arbiter (nit, contract-neutral), recheck in diff review.
- **P-7** (review-tests #2, should-fix) — startup key cleanup had no proof. **Fix**: unit test for
  removal and for startup continuing when `removeItem` throws. Open.

Adoptions r1=8.

### Plan Round 2 (plan-r2) — closure: review-plan, review-tests, review-minimalism

Raw verdicts: review-plan REVISE (P-4 NOT CLOSED should-fix, 1 blocker, 1 should-fix);
review-tests APPROVED (P-3, P-7 CLOSED); review-minimalism APPROVED (P-5 CLOSED). The first
review-tests/minimalism r2 launches had an empty Inputs block (sed delimiter error) and were
killed and relaunched under the same names before producing a report.

- P-1, P-2, P-3, P-5, P-7: **CLOSED** (review-plan r2; P-3/P-7 also review-tests r2; P-5 also
  review-minimalism r2).
- **P-4** NOT CLOSED (review-plan r2) → **Skip**. Reason: the build skill orders "real
  dependencies/shared primitives first"; the icon library is a shared primitive every subsystem
  consumes. Per-subsystem icon swaps would ship Tabler and Lucide together across intermediate
  phases against a 4,207 B total bundle headroom (`bundle-budgets.json` stored baseline), risking a
  red intermediate gate, and the remaining file overlap is sequential, not concurrent. `src/state/**`
  is now single-phase. Status: closed (Skip).
- **P-8** (review-plan r2 #2, blocker) — semantic colour consumers outside `src/components/**`
  (`src/state/accountCompletions.ts:65`, `src/utils/chess.com/api.tsx:42`) were unowned after P-1.
  Verified. **Fix**: O5 ownership is all `src/**`; O5 runs in Phase 1 except Phase 3's files. Open.
- **P-9** (review-plan r2 #3, should-fix) — threat model still promised fallback for unavailable
  board/piece names. Focused judgment: the promise was the removed P-3 mechanism; existing
  hydration is unchanged and pre-existing, so the frozen threat model is narrowed, not extended.
  **Fix**: threat model narrowed. Open.

Adoptions r2=2.

### Plan Round 3 (plan-r3) — closure: review-plan

Raw verdict: review-plan APPROVED. P-8 CLOSED, P-9 CLOSED. Adoptions r3=0. Plan review complete:
all issues closed (P-4 Skip, P-6 arbiter). No carried items.

Plan review metrics: rounds r1 (8 lenses), r2 (3), r3 (1); adoptions r1=8 r2=2 r3=0; issues
P-1..P-9 all closed (P-4 Skip, P-6 arbiter nit).

## Implementation

- Phase 1 (sensitive): one fix round (typecheck: a colour substitution hit a chess-side value in
  `TablebaseInfo.tsx`, Mantine typed `vars`). Bundle total exceeded 1,650,000 B by 2,875 B →
  measured raise `d-20261029-16`. A `pathOwners.test.ts` timeout under machine load passed alone
  (26/26, file untouched).
- Phase 2 (sensitive): green first time; surfaced three e2e assertion failures caused by Phase 1
  (dark active-tab contrast 4.11:1, Settings clipping at 320px/200%, hidden radio assertion),
  carried into Phase 3.
- Phase 3 (sensitive): carried items resolved; one fix round for five further non-pixel e2e
  failures introduced by the restyle (notification stack wheel scroll, selected dropdown option
  reachability at three widths, compact title-bar width assertion updated to measured Inter
  widths).

## Diff review

Round d1 (range 9b76350b..a30f983d, 9 code lenses + records lens, Codex):
correctness REVISE (1 blocker: tablebase ranking reversed — pre-existing, outside diff → Defer
`f-20261029-07`); tests REVISE (D-4 blocker: missing baselines for the new two-engine scenario and
dark Appearance → closed by browser verification; D-3 should-fix: WDL coverage → Fix, unit test);
minimalism APPROVED (D-1 nit: redundant GenericCard rule → Fix); records REVISE (R-1 per-asset
claim → Fix via `d-20261029-22` and this file; R-2 missing supersede trailer on `d-20261027-14` →
Fix; R-3 dark-palette exception → Fix via `d-20261029-21`); root-cause, code-quality,
error-handling, persisted-state, engine-protocol, chess-semantics APPROVED. Orchestrator visual
acceptance added D-2 (engine progress bar read as a stray dash → Fix) and later D-5 (dark
Black-better chip indistinguishable from the inset surface → Fix).

Round d2 closure (a30f983d..38b72986): D-1, D-2, D-3, R-2, R-3 CLOSED (minimalism, engine-protocol,
correctness, tests, records); R-1 open until this file exists; D-4 open until baselines recorded.
While adding a WDL e2e view the fix leaf observed the pre-existing axe `aria-progressbar-name`
failure → Defer `f-20261029-08`.

diff_adopted_per_round: d1=7 (D-1, D-3, D-4, R-1, R-2, R-3, plus arbiter D-2), d2=0.

## Browser verification

`pnpm test:e2e:container` before re-recording: 150 passed, 97 pixel-only screenshot mismatches,
2 tests missing 3 new baselines, 0 non-screenshot failures. Every diff was inspected (contact
sheets of expected vs actual). `pnpm test:e2e:update` then rewrote all 114 committed snapshots and
added 3: the 21 beyond the 93 first-failing ones belong to tests that stopped at an earlier
failing screenshot; each was inspected old-vs-new and shows only the restyle. Moved snapshots are
listed in the snapshot commit message (`2ef77ff6`).

D-5 was found on the new dark baseline: the Black-better chip used the eval-bar dark tone, nearly
identical to the inset surface. Repaired in `a5d2750f` (page background tier, 15.15:1 text
contrast). Its pixel change stayed within Playwright's threshold, so the dark baseline was
re-recorded with `--update-snapshots=all` over the whole `engine-gap` project (15/15 passed).
Running only the dark scenario in isolation failed an axe colour-contrast check on a navigation
tooltip still fading in under the resting pointer; inside the project run it passes. This is an
isolation-only timing artefact and was not filed (rule 4d).

## Bundle per-asset measurement (Phase 1, gzip bytes)

Per-asset deltas are dominated by Rollup chunk reassignment, so they are not attributable per
feature. Phase 1 candidate vs base HEAD `131c43c5`:

| Asset | Stored | HEAD | Before repair | After repair | After − stored | After − HEAD |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| `_AreaChart.js` | 105,680 | 105,675 | 103,702 | 105,677 | -3 | 2 |
| `_EnginePortrait.js` | 0 | 3,588 | 3,543 | 3,581 | 3,581 | -7 |
| `_FileInput.css` | 181 | 181 | 177 | 177 | -4 | -4 |
| `_FileInput.js` | 7,417 | 7,461 | 7,444 | 8,979 | 1,562 | 1,518 |
| `_Flex.js` | 0 | 0 | 604 | 0 | 0 | 0 |
| `_GameSelector.css` | 393 | 393 | 401 | 396 | 3 | 3 |
| `_GameSelector.js` | 2,608 | 2,607 | 2,609 | 2,611 | 3 | 4 |
| `_GenericCard.css` | 453 | 453 | 468 | 450 | -3 | -3 |
| `_GenericCard.js` | 719 | 721 | 721 | 719 | 0 | -2 |
| `_IconCheck.js` | 144 | 145 | 146 | 147 | 3 | 2 |
| `_IconCloud.js` | 279 | 281 | 281 | 283 | 4 | 2 |
| `_IconCopy.js` | 240 | 242 | 242 | 243 | 3 | 1 |
| `_IconEdit.js` | 219 | 218 | 222 | 222 | 3 | 4 |
| `_IconFlag.js` | 1,812 | 1,812 | 2,336 | 2,338 | 526 | 526 |
| `_IconFolder.js` | 173 | 175 | 175 | 176 | 3 | 1 |
| `_IconSearch.js` | 171 | 172 | 173 | 175 | 4 | 3 |
| `_IconTrophy.js` | 215 | 214 | 219 | 220 | 5 | 6 |
| `_IconX.js` | 3,436 | 3,436 | 423 | 13,097 | 9,661 | 9,661 |
| `_LinesSlider.js` | 3,061 | 0 | 0 | 0 | -3,061 | 0 |
| `_LinkedCollection.js` | 2,755 | 2,753 | 2,733 | 2,744 | -11 | -9 |
| `_NumberInput.js` | 8,276 | 8,274 | 13,392 | 8,277 | 1 | 3 |
| `_PersonalCard.css` | 87 | 264 | 264 | 264 | 177 | 0 |
| `_PersonalCard.js` | 16,848 | 16,915 | 16,877 | 16,907 | 59 | -8 |
| `_Piece.js` | 10,095 | 10,095 | 7,421 | 9,829 | -266 | -266 |
| `_PlayerSearchInput.css` | 865 | 865 | 865 | 865 | 0 | 0 |
| `_PlayerSearchInput.js` | 39,942 | 39,948 | 40,036 | 40,010 | 68 | 62 |
| `_SegmentedControl.js` | 2,520 | 2,515 | 0 | 2,534 | 14 | 19 |
| `_ThemeIcon.js` | 522 | 522 | 521 | 522 | 0 | 0 |
| `_api.js` | 1,410 | 1,407 | 1,411 | 1,413 | 3 | 6 |
| `_clsx.js` | 13,785 | 13,785 | 13,790 | 13,790 | 5 | 5 |
| `_databaseLoadFailure.css` | 1,089 | 1,089 | 1,080 | 1,066 | -23 | -23 |
| `_databaseLoadFailure.js` | 3,910 | 3,913 | 3,910 | 3,912 | 2 | -1 |
| `_en-US.js` | 15,137 | 15,285 | 15,120 | 15,120 | -17 | -165 |
| `_esm.js` | 6,846 | 6,847 | 6,221 | 7,693 | 847 | 846 |
| `_files.js` | 15,028 | 15,023 | 15,025 | 22,197 | 7,169 | 7,174 |
| `_get-env.js` | 0 | 0 | 0 | 95 | 95 | 95 |
| `_get-step-mark-value.js` | 3,048 | 3,047 | 0 | 3,046 | -2 | -1 |
| `_immutable.js` | 2,799 | 2,800 | 2,097 | 2,813 | 14 | 13 |
| `_react-mosaic.css` | 2,223 | 2,223 | 2,222 | 2,202 | -21 | -21 |
| `_react-mosaic.js` | 61,233 | 61,232 | 61,231 | 61,230 | -3 | -2 |
| `_sound.js` | 271,993 | 272,141 | 279,141 | 255,204 | -16,789 | -16,937 |
| `_useNativePicker.js` | 213 | 213 | 213 | 213 | 0 | 0 |
| `css:assets/_databaseId.css` | 254 | 254 | 237 | 215 | -39 | -39 |
| `css:assets/accounts.css` | 165 | 165 | 163 | 149 | -16 | -16 |
| `css:assets/engines.css` | 574 | 574 | 574 | 574 | 0 | 0 |
| `css:assets/index.css [main]` | 42,922 | 42,941 | 45,568 | 45,568 | 2,646 | 2,627 |
| `css:assets/index.css [route 1]` | 1,720 | 1,720 | 1,740 | 1,701 | -19 | -19 |
| `css:assets/settings.css` | 616 | 616 | 627 | 621 | 5 | 5 |
| `index.html` | 196,169 | 196,442 | 199,878 | 197,714 | 1,545 | 1,272 |
| `node_modules/.pnpm/mantine-flagpack@4.1.1_@mantine+core@8.3.14_@mantine+hooks@8.3.14_react@19.2.4__@types+_be46906bd108e4dce193f2acc45adee4/node_modules/mantine-flagpack/dist/esm/index.mjs` | 229,165 | 229,165 | 229,163 | 229,163 | -2 | -2 |
| `src/catalogs/engines.json.minisig?raw` | 293 | 293 | 293 | 293 | 0 | 0 |
| `src/catalogs/engines.json?raw` | 1,700 | 1,700 | 1,700 | 1,700 | 0 | 0 |
| `src/components/databases/countries.json` | 11,084 | 11,084 | 11,084 | 11,084 | 0 | 0 |
| `src/routes/accounts.lazy.tsx` | 12,738 | 12,504 | 12,493 | 12,503 | -235 | -1 |
| `src/routes/databases/$databaseId.lazy.tsx` | 15,182 | 15,185 | 15,218 | 15,226 | 44 | 41 |
| `src/routes/engines.lazy.tsx` | 12,341 | 12,435 | 12,439 | 12,426 | 85 | -9 |
| `src/routes/index.lazy.tsx` | 212,269 | 212,382 | 212,630 | 212,640 | 371 | 258 |
| `src/routes/library.lazy.tsx` | 21,017 | 21,054 | 21,063 | 21,053 | 36 | -1 |
| `src/routes/settings.lazy.tsx` | 19,071 | 19,074 | 18,392 | 18,416 | -655 | -658 |
| `src/translation/be-BY.json` | 19,827 | 20,028 | 19,805 | 19,805 | -22 | -223 |
| `src/translation/de-DE.json` | 16,961 | 17,145 | 16,974 | 16,974 | 13 | -171 |
| `src/translation/en-GB.json` | 15,096 | 15,242 | 15,079 | 15,079 | -17 | -163 |
| `src/translation/es-ES.json` | 16,859 | 17,020 | 16,834 | 16,834 | -25 | -186 |
| `src/translation/fr-FR.json` | 17,500 | 17,692 | 17,512 | 17,512 | 12 | -180 |
| `src/translation/it-IT.json` | 16,714 | 16,882 | 16,692 | 16,692 | -22 | -190 |
| `src/translation/ko-KR.json` | 17,251 | 17,426 | 17,235 | 17,235 | -16 | -191 |
| `src/translation/nb-NO.json` | 16,232 | 16,376 | 16,209 | 16,209 | -23 | -167 |
| `src/translation/pl-PL.json` | 17,659 | 17,840 | 17,637 | 17,637 | -22 | -203 |
| `src/translation/pt-PT.json` | 16,775 | 16,947 | 16,761 | 16,761 | -14 | -186 |
| `src/translation/ru-RU.json` | 19,787 | 19,991 | 19,777 | 19,777 | -10 | -214 |
| `src/translation/tr-TR.json` | 16,509 | 16,664 | 16,468 | 16,468 | -41 | -196 |
| `src/translation/uk-UA.json` | 19,754 | 19,945 | 19,724 | 19,724 | -30 | -221 |
| `src/translation/zh-CN.json` | 16,633 | 16,799 | 16,596 | 16,596 | -37 | -203 |
| `src/translation/zh-TW.json` | 17,131 | 17,290 | 17,089 | 17,089 | -42 | -201 |

Final whole-design measurement (after all phases and review repairs): see `d-20261029-22` and
`docs/bundle-budgets.md` (550,873 B entry, 495,923 B largest lazy, 1,656,725 B total, before D-5;
final gates re-measure).

## Closure rounds d3 and d4

Round d3 (38b72986..1b42657e): correctness D-5 CLOSED; records R-1 CLOSED (handoff and per-asset
table present, claims verified); tests D-4 CLOSED and a new blocker D-6: D-5's colour change sat
inside the screenshot threshold, so reverting it would pass. Fix `685f461c`: computed-style
assertions (three distinct chip fills in both schemes, negative chip differs from its line, dark
negative chip equals the page background). Discrimination measured: reverting D-5 fails with
expected `rgb(16, 14, 13)`, received `rgb(62, 59, 56)`; restored, engine-gap 15/15.

Round d4 (1b42657e..685f461c): tests D-6 CLOSED, APPROVED.

diff_adopted_per_round: d1=7, d2=0, d3=1, d4=0. All diff findings closed; Defers f-20261029-07,
f-20261029-08. REVIEWED_THROUGH before final gates: 685f461c (plus this record commit).
