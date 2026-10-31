# Review record: piece size setting (build run, 2026-10-31)

Plan: `tasks/plans/2026-10-31-piece-size-setting.md` (ignored working copy; its MANDATE, Approach
and plan-review history are reproduced below). Executor: Grok leaves for every lens and the
implementation; orchestrator Claude Code (Opus 5.5). Decision: d-20261031-05.

## MANDATE
Felix, 2026-10-31: "Is there an option to change the size of the pieces? Because they look way
too big now, I would like them to be a bit smaller. Do you think the best choice is to make a
setting which changes the size of pieces for all piece sets or just to make the Merida piece set
smaller?" Agreed proposal: a general "Piece size" setting (about 70–100%) next to the piece-set
picker, for all sets, saved like the other board options, image shrinks inside the unchanged
square, default 100%, one value for all sets. Felix: "Yes, build this. FullAutoExecutorGrog."

## Plan review

### Round 1 (Grok leaves; plan-r1.md)
Verdicts: review-plan REVISE, review-minimalism REVISE, review-persisted-state APPROVED,
review-correctness APPROVED, review-tests REVISE, review-code-quality APPROVED.

- PS-1 [blocker] O3 slider has no failing proof (witnesses: plan r1#1, tests r1#2). Verified:
  no SettingsPage/FontSizeSlider test; seeded e2e never opens Appearance. MANDATE obligation:
  "a general Piece size setting … next to the piece-set picker". Disposition: Fix — O4 e2e drives
  the real slider, component test for the shared slider. Closure: r2.
- PS-2 [blocker] New e2e spec would not run: exclusive `testMatch` projects
  (`playwright.config.ts:33,114-118`, verified). Witness: tests r1#1. Fix — register project.
  Closure: r2.
- PS-3 [should-fix] Hardcoded English percent marks (plan r1#2; verified
  `VolumeSlider.tsx:19-24`). Fix — Intl percent marks. Closure: r2.
- PS-4 [should-fix] Second slider copy (minimalism r1#1). Universal rule 11. Fix — extract one
  percentage-preference slider used by font size and piece size. Closure: r2.
- PS-5 [should-fix] Hydration not pinned (tests r1#3; precedent `src/state/fontScale.test.ts:20`).
  Fix — real-atom hydration tests. Closure: r2.
- PS-6 [should-fix] `cover` at 100% not asserted (tests r1#4). Fix — e2e asserts computed
  `background-size: cover` at default and 70%. Closure: r2.
- PS-7 [should-fix] size/scale naming split (code-quality r1#1, r1#2). Fix — `pieceSizeAtom`,
  key `piece-size`, `--piece-size`. Closure: r2.

### Round 2 (Grok leaves; plan-r2.md)
Verdicts: review-plan REVISE, review-minimalism APPROVED, review-tests REVISE,
review-code-quality APPROVED. PS-1..PS-7 CLOSED by all four witnesses.

- PS-8 [blocker] 70% e2e cannot detect an image still painted square-sized (default
  `background-origin: padding-box` / `background-clip: border-box`) (witnesses: plan r2#1,
  tests r2#1). MANDATE: "changes the size of the piece image inside each square". Fix — assert
  computed origin/clip `content-box` plus a painted-pixel check. Closure: r3.
- PS-9 [should-fix] Slider mark test passes on hardcoded English labels (tests r2#2; precedent
  `VolumeSlider.test.tsx:69-78`). Fix — fr-FR inequality assertion. Closure: r3.
- PS-10 [should-fix] O2 prose still says "scale" (code-quality r2#1). Fix — wording.
  code-quality r2#2, r2#3 [nit]: closed by arbiter (wording edited, contract-neutral).

### Round 3 (Grok leaves; plan-r3.md)
Verdicts: review-plan APPROVED, review-tests APPROVED, review-code-quality APPROVED.
PS-8, PS-9, PS-10 CLOSED (all witnesses). code-quality r3#1 [nit] ("scale" wording in O2):
closed by arbiter, wording edited, contract unchanged.
Adoptions: r1=7 r2=3 r3=0. Plan review complete.

## Implementation
Phase 1 (Grok write leaf, role normal): one e2e defect found by the orchestrator's container run
(seeding `piece-set` aborted the default `staunty.css` request, which the page fixture rejects);
fixed on the same thread by selecting Merida through the real combobox. Mutation check by the
orchestrator: removing `background-origin`/`background-clip: content-box` turns the journey and
the Merida painted-bbox e2e tests red.

## Cumulative diff review
Round cr1 (Grok leaves): correctness, root-cause, tests, persisted-state APPROVED without
findings; code-quality APPROVED with 3 should-fix + 2 nit; minimalism APPROVED with 1 should-fix
+ 1 nit. All adopted as Fix (marks out of the schema module, named paint-detection and 70% inset
in e2e, unused layout fields dropped, font marks from constants, FontSizeSlider pass-through
deleted, duplicated slider sequence replaced by the helper), commit "refactor(settings): render
both percentage sliders directly".
Round cr2 closure over the repair delta (code-quality, minimalism, correctness): every finding
CLOSED, APPROVED. One new nit (journey test repeats the helper's aria-valuenow assertion):
Skip, harmless redundancy.

## Verification
- Phase proof: vitest (39 files, 1070 tests) and `pnpm lint:ci` green.
- `pnpm checks:pre-review` green after the phase and after the repair batch.
- `pnpm test:e2e:container --project=piece-size --project=font-scaled-breakpoints`: 16 passed.
- Visual acceptance (agent, full auto): Settings → Appearance shows "Piece Size" under "Piece
  Set", marks 70 % / 85 % / 100 %; Merida at 70 % renders centred, smaller pieces in unchanged
  squares (e2e screenshots).
- Not run: `pnpm verify:app` on WebKitGTK (the CSS is standard background-origin/clip; no native
  surface involved).

Metrics: plan rounds r1=7 r2=3 r3=0 adoptions; 10 unique plan issues (PS-1..PS-10), all Fix,
all closed; diff review 7 adopted findings, 1 skipped nit; implementation fix rounds 1 (e2e) + 1
(review batch).
