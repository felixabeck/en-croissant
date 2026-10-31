# Wood texture build — review history

Build run 2026-10-31 (Claude Code orchestrator, Claude executor leaves on a separate worktree, full auto). Decision: d-20261031-03. This file is the durable copy of the reviewed plan with its complete plan-review record, followed by the cumulative diff review and its closure round.

Executor separation: orchestrator Claude (anthropic.high), every leaf and lens Claude (anthropic.low) — same family, model-level separation only; plan author and arbiter are the orchestrator.

### Plan: Wood texture overlay for the board (imported from ChessRiddle)

### Goal
ChessFable offers the same wood-grain board texture ChessRiddle shows: a persisted on/off
"Wood texture" appearance setting, on by default, that blends ChessRiddle's `wood4.jpg` grain
(as ChessRiddle shows it: the same top-left slice in every square) over the board with
`soft-light`.

### MANDATE
Felix (verbatim): "In Chess Riddle it's possible to show a background, a wood structure background
for the board. Can we import the same thing into Chess Fable? If so, do this full auto executor
Claude on a separate work tree."

### Threat model and non-goals
No adversarial input. The only stored value is a boolean preference in `localStorage`; absent,
corrupt or non-boolean stored values must fall back to the default (existing
`createPreferenceStorage` contract). No IPC, no Rust, no capability change. One new static asset,
`public/board/wood4-square.png`, derived losslessly from the already-shipped
`public/board/wood4.jpg` (byte-identical to ChessRiddle's).

### Traced premises
- ChessRiddle: `chess-tactics-app/frontend/web/src/components/chess/hooks/useBoardTheme.ts` —
  `showWoodTexture` (default `true`, `lib/constants/settings.ts:175`) sets on every square
  `backgroundImage: url(/images/board/wood4.jpg)`, `backgroundSize: 800%`,
  `backgroundBlendMode: soft-light` over the square colour; toggle `settings.woodTexture` in
  `components/settings/BoardSettings.tsx:253-258`. A CSS wood-grain gradient is applied to its
  board *border*.
- ChessFable board: `src/chessground/Chessground.tsx:188-199` sets the CSS custom property
  `--board-image: url('/board/<boardImage>')` on the board wrapper; the sole consumer is
  `src/styles/chessgroundColorsOverride.css:1-5`
  (`cg-board { background-image: var(--board-image, url("/board/gray.svg")) }`), with
  `background-size: cover` from `src/styles/chessgroundBaseOverride.css:15-27`. Chessground has
  no per-square elements for plain squares — the whole board is one background.
- `boardImageAtom` (`src/state/atoms.ts:553-557`) is `atomWithStorage("board-image",
  "chessriddle.svg", createPreferenceStorage("chessriddle.svg"))`; `chessriddle.svg` uses
  ChessRiddle's colours `#e8ceab`/`#bc7944`.
- Appearance settings are entries in `src/components/settings/SettingsPage.tsx` (piece-set
  ~443, board-image ~451); boolean preferences render with `SettingsSwitch`
  (`src/components/settings/SettingsSwitch.tsx`, e.g. `SettingsPage.tsx:172`).
- `public/board/wood4.jpg` is 1024×1024 JPEG, 137 KB, `cmp`-identical to ChessRiddle's.
- Every Chessground board (analysis, game, puzzle, previews) renders through
  `src/chessground/Chessground.tsx`.

### Approach

### O1 — Persisted preference
New `boardWoodTextureAtom` in `src/state/atoms.ts` beside `boardImageAtom`:
`atomWithStorage<boolean>("board-wood-texture", true, createPreferenceStorage(true))`. Global
scope (like `board-image`), default `true` matching ChessRiddle. Writer: the settings switch;
reader: Chessground. Absent/corrupt value → `true` through the existing Zod storage.

### O2 — Rendering
ChessRiddle's look (traced by the orchestrator in `useBoardTheme.ts`: every square gets
`backgroundSize: 800%` and no `backgroundPosition`) shows the **same top-left 1/8 × 1/8 crop
of `wood4.jpg`** in every square, soft-light blended into the square colour. Chessground has no
per-square elements, so the faithful equivalent is a square-sized tile: a committed asset
`public/board/wood4-square.png`, the lossless top-left 128×128 crop of the 1024×1024
`wood4.jpg` (generated once with ImageMagick `magick wood4.jpg -crop 128x128+0+0 +repage`),
tiled at one square.
`Chessground.tsx` reads the atom and sets a second custom property `--board-texture` on the
wrapper: `url('/board/wood4-square.png')` when on, `none` when off.
`chessgroundColorsOverride.css` `cg-board` becomes a two-layer background: texture on top,
board image below, `background-size: 12.5% 12.5%, cover`,
`background-blend-mode: soft-light, normal`. Off → `none` layer; the board image layer keeps
`cover`, so off renders as today (proved in O4). The fallback of `--board-image` (`gray.svg`)
is kept; `--board-texture` falls back to `none`.

### O3 — Setting UI
New appearance entry `id: "board-wood-texture"` directly after `board-image` in
`SettingsPage.tsx`, rendered with `SettingsSwitch atom={boardWoodTextureAtom}`, title
`Settings.Appearance.WoodTexture` ("Wood texture"), description
`Settings.Appearance.WoodTexture.Desc` ("Blend a wood grain into the board"), keywords
`wood, texture, grain, board`. Keys added through `pnpm i18n:extract`; `docs/localization.md`
requires a non-empty translated value in every shipped catalogue (`pnpm i18n:check`), so every
`src/translation/*.json` gets a real translation (German: "Holzstruktur" / "Legt eine
Holzmaserung über das Brett").

### O5 — Chessground re-render applies shapes against stale bounds (found in Phase 2)
Observed: with any stored preference that differs from its atom default and hydrates on mount
(`board-wood-texture=false`, or `board-image="gray.svg"` on unchanged code), opening a game
whose PGN carries `%cal` arrows logs `<line> attribute x1: Expected length, "NaN"` and fails
`board-keyboard.spec.ts:509` (container probe: 1 failed / 21 passed, both seeds; unseeded
22/22). Mechanism: the mount-time hydration re-render runs the props effect
(`Chessground.tsx` `api.set(configForBounds(...))`) while Chessground's memoised
`state.dom.bounds` still holds the 0×0 box measured at creation; the ResizeObserver handler
clears that cache, the props effect does not. Fix: the props effect clears
`api.state.dom.bounds` before `api.set` whenever the element is visible, as the ResizeObserver
handler does. Probe with exactly this change and the `board-image` seed: 22/22 passed. This is
a pre-existing defect the feature puts on an everyday path (every user who turns the texture
off), so it is fixed here (MANDATE delivery).

### O6 — Settings switch track labels fail contrast (found in Phase 2)
Observed: the new row is the first `SettingsSwitch` on the Appearance tab, which the e2e axe
scan covers. ON label: white on gold `#c9a44e`, 2.35:1 (dark, engine-gap); OFF label `#868e96`
on `#dbdbdb`, 2.39:1 (light, settings-responsive); WCAG AA needs 4.5:1. `DESIGN.md` defines
`primary-foreground` as the "contrasting text" on primary gold (token table; the Switch row says
"Gold checked state"), and `TelemetrySwitch` already sets these label colours inline; `src/styles/Switch.module.css` never sets the track
label colour. Fix in `Switch.module.css`: checked track label uses `var(--cf-primary-foreground)`,
unchecked uses `var(--cf-foreground)`. Applies to every labelled switch (shared theme class).

### O4 — Verification
- Atom unit (`src/state/atoms.test.ts`): share the existing board-preference harness
  (`atoms.test.ts:535-555`: fresh module, `store.sub`, read after subscribe) instead of copying
  it, and add `board-wood-texture` cases. Valid rows (absent → `true`, no write; stored JSON
  `false` → `false`, bytes unchanged, no write) keep the existing no-write assertion. Corrupt
  rows, seeded with raw `localStorage.setItem` (non-JSON bytes, the JSON string `"false"`,
  `1`) → value `true` and the key repaired to `true` (the adapter's repair write,
  `src/state/utils.ts:107-117`); the no-write assertion does not apply to them.
- Chessground unit (`src/chessground/Chessground.test.tsx`): stored `false` → `--board-texture`
  is `none` (this case proves the atom is read); default → the `wood4-square.png` URL. Storage
  is reset between cases so the result does not depend on test order.
- Asset: the repo has no image-decoding dependency (none is added), so the check lives in the
  new e2e spec: Chromium draws `wood4-square.png` and the top-left 128×128 region of
  `wood4.jpg` onto canvases; the tile's natural size is 128×128 and every channel differs by at
  most 2 (JPEG decoder rounding between ImageMagick and Chromium).
- Settings wiring and real CSS — new `e2e/board-wood-texture.spec.ts` (Chromium computes the
  real stylesheet, jsdom does not), no screenshot of its own: on a board, `cg-board`'s computed
  `background-image` has the `wood4-square.png` layer first and the board image second,
  `background-size` is `12.5% 12.5%, cover`, `background-blend-mode` is `soft-light, normal`
  (retrying assertions — `toHaveCSS`/`expect.poll` — because the atom hydrates on mount);
  toggle the "Wood texture" switch in Settings → Appearance; `localStorage["board-wood-texture"]`
  is `false`; after a reload of the board page itself (fixture's
  `preserveStorageForReload`, consumed by that one load) the board's texture layer is `none`
  and the board-image layer's size is still `cover`. The spec runs only if registered:
  `playwright.config.ts` allowlists specs per project (`testMatch`), so Phase 2 adds a
  `board-wood-texture` project (Chromium, explicit viewport and colour scheme like its
  neighbours), and the final run's output must list that project.
- O5 regression: the new spec seeds `board-wood-texture=false` the way the reproduction did
  (`page.addInitScript` writing the key, then `page.goto`, as `board-keyboard.spec.ts:496-497`
  does), opens a game whose PGN carries `%cal`/`%csl` drawings, asserts the arrows are drawn
  with finite coordinates, and relies on the fixture's browser-failure check (NaN console
  errors fail the test). The executor shows it red with the O5 change temporarily reverted
  in `src/chessground/Chessground.tsx` and green with it; `git diff` of that file must be empty
  after restoring.
- O6 contrast: the new spec runs the fixture's axe check on Settings → Appearance with the
  switch on and again with it off (after the toggle transition settles); with the existing
  engine-gap (dark, ON) and settings-responsive (light) scans this covers both schemes. A
  tooltip-contrast axe failure in any final run is a real defect, not a flake.
- Off-state identity (a proof that can go red): before any snapshot is re-recorded and before
  the new spec exists, run `pnpm test:e2e:container` once with the fixture's storage seeding
  temporarily writing `board-wood-texture=false` after its `localStorage.clear()`. Pass
  criterion: every board-bearing snapshot matches the **unchanged** committed baseline; the
  only permitted failures are the Settings → Appearance snapshots of set (b) below, each with
  its diff confined to the new "Wood texture" row (switch shown off) and the shift below it,
  and any set-(c) snapshot may fail only with its diff confined to a switch track label; the
  board region of every board-bearing snapshot stays identical;
  any other failure is a regression: stop. Revert the seed, confirm `git diff e2e/fixtures.ts`
  is empty, and report the run's result.
- Default-on snapshot move: then run `pnpm test:e2e:container` without the seed. Predicted
  moved set, stated before re-recording: (a) every snapshot that shows a board — diff confined
  to the board area; (b) the committed Settings → Appearance baselines
  `engine-gap/settings-appearance-dark` and `settings-responsive/settings-responsive`
  (`font-scaled-breakpoints` settings shots use the `capture` fixture and have no baseline) —
  diff is the new "Wood texture" row and the layout shift below it; (c) every other snapshot
  that shows a labelled switch — diff confined to the switch's track label colour (O6). Any
  other moved snapshot, or a diff outside
  these areas, is a regression: stop. At least one board snapshot must differ visibly (proves
  the texture renders). Re-record with `pnpm test:e2e:update`, name every moved snapshot in the
  commit and the report.

### Decisions and trade-offs
Decided autonomously (full auto):
1. Default on — ChessRiddle's default is `true` and Felix asked for "the same thing";
   rejected default off. Reversal: change the atom default to `false`.
2. Square-tiled crop asset (`wood4-square.png`) reproducing ChessRiddle's per-square slice
   exactly. Rejected: whole-board `cover` layer (a continuous grain, visibly different from
   ChessRiddle's repeated-per-square grain, so not "the same thing"); injecting 64 square
   elements into Chessground. Reversal: point `--board-texture` at `wood4.jpg` and change the
   texture layer's `background-size` from `12.5% 12.5%` to `cover`.
3. Applied over every board image, not only `chessriddle.svg` — ChessRiddle applies it to every
   colour theme; the user can switch it off. Rejected: hard-coding to one image.
4. No border grain — ChessFable's board has no border/frame for it to decorate.

### Risks / open questions
- Snapshot churn across e2e specs (expected, handled by O4's prediction rule).
- `soft-light` over already-textured image boards (e.g. `wood.jpg`) looks busier; acceptable,
  toggle exists.

### Not part of this task
Board border/frame, custom board colours, new board images, ChessRiddle changes.

### Phases
### Phase 1 — asset, preference, rendering, settings UI, i18n, unit tests (normal, Claude)
Files: `public/board/wood4-square.png` (new), `src/state/atoms.ts`, `src/state/atoms.test.ts`,
`src/chessground/Chessground.tsx`, `src/chessground/Chessground.test.tsx`,
`src/styles/chessgroundColorsOverride.css`, `src/components/settings/SettingsPage.tsx`,
`src/translation/*.json`.
PROOF COMMAND: `pnpm exec tsgo --noEmit && pnpm exec vitest run src/state/atoms.test.ts src/chessground/Chessground.test.tsx && pnpm i18n:check && pnpm checks:pre-review`

### Phase 1b — O5 and O6 production fixes (normal, Claude)
Files: `src/chessground/Chessground.tsx`, `src/chessground/Chessground.test.tsx`,
`src/styles/Switch.module.css`.
Chessground unit: a re-render after mount clears the native bounds cache before `set` (mocked
native API).
PROOF COMMAND: `pnpm exec tsgo --noEmit && pnpm exec vitest run src/chessground/Chessground.test.tsx && pnpm checks:pre-review && pnpm test:e2e:container --project=engine-gap --project=board-keyboard`
(the engine-gap dark Appearance axe scan failed on the ON label before O6; its only allowed
failure afterwards is the predicted Appearance snapshot diff — the axe failure must be gone.
board-keyboard must be 22/22.)

### Phase 2 — e2e spec, off-state identity run, snapshot re-record (normal, Claude)
Files: `e2e/board-wood-texture.spec.ts` (new, no screenshot), `playwright.config.ts` (new
project), moved `e2e/**-snapshots/*.png`,
temporary uncommitted seed in `e2e/fixtures.ts` (reverted before the phase ends).
Order: off-state identity run → revert seed (`git diff e2e/fixtures.ts` empty) → write the new
spec → default-on run → diff inspection against the
predicted set → `pnpm test:e2e:update` → final run.
PROOF COMMAND: `pnpm test:e2e:container` (final, green), plus the off-state run's output.

### Reviews

### Round 1 (Claude executor leaves, read-only)
Verdicts: review-plan REVISE · review-correctness REVISE · review-tests REVISE ·
review-minimalism APPROVED · review-persisted-state APPROVED · review-code-quality APPROVED (no
diff; nothing judged) · review-root-cause APPROVED · review-error-handling APPROVED.

- **PR-1** — O4 moved-snapshot prediction covers only boards; the new Appearance row moves
  settings snapshots (`settings-appearance-dark`, `settings-responsive`), so the re-record rule
  would stop or be breached. Witnesses: plan #1, correctness #1, tests #2. Obligation: MANDATE
  delivery under d-20260919-13. **Fix** — O4 predicted set split into board and Settings
  snapshots with allowed diff areas. Status: open, closure r2.
- **PR-2** — "off is pixel-identical" has no proof that can go red (jsdom does not evaluate the
  layered CSS; all snapshots re-recorded with default on). Witnesses: plan #2, tests #1.
  **Fix** — O4 off-state identity run against unchanged snapshots before any re-record. Status:
  open, closure r2.
- **PR-3** — settings switch wiring has no named test. Witnesses: plan #3, tests #3; contrary
  minimalism #1 (drop it, 20 sibling switches untested). **Fix** — new
  `e2e/board-wood-texture.spec.ts` toggles the real switch and observes the computed board
  background; also anchors the real CSS layering (tests nit). Minimalism #1 rejected: the
  switch is this preference's only writer and the same spec is needed anyway for the CSS proof,
  so it adds no separate harness. Status: open, closure r2.
- **PR-4** — atom fallback test lacks corrupt cases and must read after subscribe; avoid
  copying the sibling test. Witnesses: tests #4, minimalism nit #2. **Fix** — O4 parametrised
  test with explicit cases. Status: open, closure r2.
- **PR-5** — Decision 2 equivalence claim unverified (lenses could not read the reference).
  Witnesses: plan #4 (conf 45), correctness/root-cause limitations. Orchestrator traced the
  reference: no `backgroundPosition`, so every square shows the same top-left crop; whole-board
  `cover` is NOT equivalent. **Fix** — O2 square-tiled lossless crop asset; Decision 2
  rewritten. Status: open, closure r2.
- **PR-6** — `background-size: cover` needs no CSS change (minimalism nit #3). Superseded by
  PR-5 (explicit two-value size list now required in `chessgroundColorsOverride.css` only).
  **Skip** — premise changed.
- **PR-7** — Board "Take snapshot" (`BoardControls.tsx:85-89`, dom-to-image) as unnamed
  consumer (plan nit, conf 30; root-cause limitation). **Fix — carried to CR-1.**
- **PR-8** — first-frame flash for stored `false` without `getOnInit` (persisted-state,
  correctness, root-cause, all below threshold). **Skip** — identical to existing
  `boardImageAtom` behaviour, cosmetic, below threshold.

### Carried to diff review
- **CR-1** — Confirm the board "Take snapshot" export (`BoardControls.tsx` dom-to-image of
  `.cg-wrap`) still renders the board with the layered background (texture on and off), or
  record the limitation.

### Round 2 (closure: review-plan, correctness, tests, minimalism)
Verdicts: review-plan APPROVED · review-correctness REVISE · review-tests REVISE ·
review-minimalism APPROVED.
- PR-1 CLOSED (plan, correctness, tests, minimalism). PR-3 CLOSED (plan, correctness, tests,
  minimalism). PR-4 CLOSED with caveat (all four). PR-5 CLOSED on design (plan, correctness,
  minimalism); tests: NOT CLOSED on verification → PR-11.
- **PR-2** NOT CLOSED (correctness blocker, tests D-1 blocker): the identity run cannot pass
  unchanged — the new row appears in the Appearance snapshots whatever the toggle, and the new
  spec would be red under the seed. **Fix** — pass criterion scoped: board-bearing snapshots
  unchanged, only set-(b) Appearance snapshots may fail with the diff confined to the new row;
  identity run before the spec is written; `git diff e2e/fixtures.ts` empty after revert.
  Closure r3.
- **PR-9** — corrupt rows trigger the adapter's repair write, so the existing no-write
  assertion cannot be shared; JSON-string `"false"` seed. Witnesses: plan D1, correctness
  (2), tests PR-4 note. Verified `src/state/utils.ts:107-117`. **Fix** — O4 atom bullet split
  valid/corrupt assertions. Closure r3.
- **PR-10** — Goal/Threat-model text stale after PR-5; reversal note incomplete. Witnesses:
  correctness nit, plan D2 nit. **Fix** (text, arbiter-closed: semantics unchanged).
- **PR-11** — the CSS geometry (`12.5% 12.5%, cover`, blend list) and the crop asset are not
  asserted; off-state `cover` unguarded after the one-off run. Witness: tests D-2. **Fix** — e2e
  computed `background-size`/`background-blend-mode` assertions in both states; asset pixel
  check in Chromium (no decoding dependency in the repo). Closure r3.
- **PR-12** — settings toggle test observes in-memory state only. Witness: tests D-3. **Fix** —
  assert `localStorage["board-wood-texture"]` and reload before the off assertions. Closure r3.
- **PR-13** — the spec's own committed screenshot duplicates the re-recorded board snapshots.
  Witness: minimalism (2). **Fix** — screenshot dropped; computed-style assertions carry it.
  Closure r3.
- Chessground unit storage isolation (tests late nit): arbiter-closed nit, added to O4 text.
- Tile sub-pixel drift (plan limitation conf 35, correctness late nit conf 40): **Skip** — below
  threshold; ChessRiddle's per-square backgrounds have the same rounding; visual diff review
  in Phase 2 inspects it.
- `texture` keyword shared with board-image entry (plan late nit, 50): **Skip** — harmless.

### Round 3 (closure: review-plan, correctness, tests, minimalism)
Verdicts: review-plan APPROVED · review-correctness APPROVED · review-tests REVISE ·
review-minimalism APPROVED.
- PR-2, PR-9, PR-13 CLOSED (all witnesses). PR-11, PR-12 CLOSED by plan and correctness;
  tests: NOT CLOSED → PR-14.
- **PR-14** — `playwright.config.ts` allowlists specs per project; the new spec would never run,
  so PR-11/PR-12 assertions would not exist for the gate. Witness: tests (2) blocker, verified
  `playwright.config.ts:33-114` (16 `testMatch` entries). **Fix** — Phase 2 adds a
  `board-wood-texture` project; final run must list it. Closure r4.
- **PR-15** — post-reload assertions can race mount-time hydration; reload must happen on the
  board page because the preserve flag is consumed by one load. Witnesses: plan late (55),
  correctness late (40). **Fix** (arbiter-closed, test-detail within the unchanged obligation):
  retrying assertions, reload of the board page.
- **PR-16** — `font-scaled-breakpoints` has no committed settings baseline. Witnesses: plan late
  nit, tests late nit. **Fix** (arbiter-closed text): set (b) names the two real baselines.
- Skip: ≤2 tolerance unverified (plan 35, tests 35, correctness ~70 holds) — the Chromium check
  itself is the proof and goes red if wrong. `getOnInit` first-frame flash re-raised (plan late
  55) — no new evidence beyond PR-8; same as `boardImageAtom`. Three corrupt rows vs one
  (minimalism ~60) — below threshold. Live re-render after toggle (tests 35) — below threshold.

### Round 4 (closure: review-plan, tests)
Verdicts: review-plan APPROVED · review-tests APPROVED. PR-14 CLOSED (both). Late nits
(mechanical `--list` check, 40; in-app navigation to Settings, 40) below threshold — Skip; the
executor brief states in-app navigation.

Totals: 4 rounds; adopted per round r1=5 r2=6 r3=1 r4=0; 16 issue IDs (PR-1…PR-16), 12 Fix
(2 arbiter-closed text/test-detail, 1 carried CR-1), 4 Skip; no Defer.

### Phase 2 stop → plan amendment (round 5)
Phase 2 (Claude leaf) stopped correctly at the off-state identity run: 3 failures. Orchestrator
probes (container, `--project` runs): board-keyboard NaN reproduces with a stored
`board-image="gray.svg"` on unchanged code (1 failed / 21 passed) and passes with the bounds
clear (22/22) → **PR-17 / O5**. engine-gap: seeded (off) fails only on the predicted Appearance
snapshot (1024 px, twice); unseeded (on) fails axe on the new switch's ON label 2.35:1 → the
leaf's tooltip-contrast failure was a flake, and the switch label contrast is **PR-18 / O6**
(also the leaf's settings-responsive OFF-label 2.39:1). New obligations added; Phase 1b inserted.

### Round 5 (amendment: review-plan, correctness, tests, root-cause, minimalism)
Verdicts: all APPROVED. PR-17 CLOSED (all five). PR-18 CLOSED (all five).
Arbiter-closed precision corrections within the unchanged obligations (adopted, nit/should-fix
below 80): O6 proof made red-capable in Phase 1b (engine-gap axe scan, plan D1); O5 seeding
path = addInitScript + goto (plan D2); DESIGN.md citation corrected (plan D3, correctness);
both colour schemes named (plan D4); off-state set-(c) clause tightened and Chessground
temporary revert made explicit with clean check (tests ×2, correctness); O5 regression asserts
arrows drawn (tests); axe after transition settles (tests); tooltip-contrast recurrence is a
real defect (root-cause). Skip: unconditional `clear()` (minimalism, 50) — executor may drop the
guard if the tests stay green.
Adopted per round now: r1=5 r2=6 r3=1 r4=0 r5=2.

### Phase 2 second stop → arbiter decision (PR-19, PR-13 reopened)
Phase 2 (resumed leaf) passed the off-state identity run (only `settings-appearance-dark` moved,
confined to the new row; `settings-responsive` does not reach the row at 320×720), proved O5
red (NaN, 1/4 failed with the fix reverted) and green (4/4), and the O6 axe scans. It stopped at
step 4: no board snapshot moved, because the grain changes board pixels by ≤ 24/255 (62,409
pixels in `variation-chooser`, all inside the board box), below Playwright's default per-pixel
`threshold: 0.2`. Orchestrator inspected both crops: the grain is clearly visible.
- **PR-19** — the obligation "at least one board snapshot must visibly differ (proves the texture
  renders)" cannot be met by the existing baselines; committed board baselines stay texture-less
  while passing. **Fix** (changed premise reopens **PR-13**): the new spec gets one board
  screenshot of the texture-on board with a per-call threshold strict enough that the texture-off
  board fails against it (shown red by the executor), so a pixel proof of the texture exists.
  Not adopted: a project-wide threshold change (changes every snapshot's tolerance, outside
  MANDATE); re-recording unmoved baselines (verify-ui: re-record only moved snapshots). Carried
  to diff review as CR-2.

### Carried to diff review (addendum)
- **CR-2** — Confirm the new spec's strict board screenshot fails against the texture-off board
  (red evidence in the Phase 2 report) and is stable across reruns in the container.

## Cumulative diff review (code lenses: correctness, root-cause, tests, code-quality, minimalism, persisted-state, error-handling; records lens on tasks/decisions.md)

Verdicts: all code lenses APPROVED; records REVISE. Prompt deviation disclosed: the code lenses'
DIFF instruction did not exclude tasks/decisions.md; none raised a record finding, and the
record path was reviewed by the separate records lens.

| ID | Finding (witnesses) | Disposition |
| --- | --- | --- |
| F1 | TelemetrySwitch inline trackLabel colours duplicate the new theme-wide Switch rule (code-quality 85, minimalism 80) | Fix — removed |
| F2 | 12.5% tile size unexplained in CSS (code-quality 82) | Fix — comment |
| F3 | Chessground guard comment lacks the why (code-quality nit) | Fix |
| F4 | No committed pixel anchor for "off renders as before" (tests 78) | Fix — strict texture-off screenshot |
| F5 | Threshold comment: wrong "project-wide", inconsistent numbers (tests nit, code-quality nit) | Fix |
| F6 | Redundant assertion; helper shadowing (code-quality, minimalism nits) | Fix |
| F7 / CR-1 | Take Snapshot export with the layered background unverified (tests 82; correctness, root-cause, error-handling limitations) | Fix — export test via recorded save_board_snapshot bytes; on/off exports differ in 85 % of pixels |
| F8 | engine-gap Appearance axe scan raced the sidebar Settings tooltip fade-out (observed three times; mechanism confirmed: tooltip _r_20_, ~190 ms) | Fix — wait for no tooltip; engine-gap --repeat-each=8 120/120 |
| R1 | Decision reversal path incomplete (records 70) | Fix — ledger commits rebuilt, d-20261031-03 re-recorded |
| R2 | Superseded-by on d-20261029-23 broader than justified (records 55) | Fix — trailer dropped; entry states a partial reversal |
| S1 | wood4-square URL as a named constant (code-quality nit) | Skip — follows the file's inline `/board/` habit |
| S2 | 128 literals inside page.evaluate (code-quality nit) | Skip — the in-page closure cannot see module constants |
| CR-2 | Strict on-screenshot red-capable and stable | CLOSED — 75,026 px at 0.05 against texture-off; 3 consecutive green runs |

Closure round over the repair delta: correctness, root-cause, tests, code-quality, minimalism
APPROVED (F1–F8, CR-1 CLOSED); records APPROVED (R1, R2 CLOSED).

## Verification

- Container e2e: 303 passed (5 → 7 new board-wood-texture tests). Moved snapshot:
  settings-appearance-dark-engine-gap.png (new row). New: board-wood-texture-on/off. No board
  baseline moved under Playwright's default threshold (grain ≤ 22/255 per channel).
- Off-state identity run (texture seeded off, Phase 2): every board baseline matched; only the
  predicted Appearance snapshot moved.
- O5 red/green: new spec 1/4 red with the bounds fix reverted, green with it; board-keyboard 1
  failed/21 passed on unchanged code with a stored non-default board image, 22/22 with the fix.
- pnpm verify:app on the WebKitGTK release binary: all checks passed; board screenshots show the grain.
