# Plan-review record — f-20260922-04, f-20260914-26, f-20260914-27 (practice-path rebasing)

Durable record of a plan review that is **approved but not yet implemented**. **The plan itself is
not tracked** — `tasks/plans/` is gitignored — so this file is the only surviving copy of both the
plan and its review history, and everything below is lifted from
`tasks/plans/2026-09-22-practice-path-rebasing.md` verbatim.

## Why this record exists

Ten rounds in one interactive session (`3cb46510-afb7-4f72-b645-e17798627ffc`), orchestrated by
Claude Code with `codex` as the executor for every lens, on 2026-09-22 between 13:23 and 16:22.
Felix asked for the plan review only, without implementation, because another session was working
in the same tree. The implementation is therefore a separate run, and this record plus the ledger
annotations are what it inherits. Every raw lens verdict below is preserved exactly as returned.

**The successor must read this file before touching the code.** The plan's `## Reviews` section
carries issue IDs I1-I62 with their witnesses, dispositions and evidence; several of them are
reasons *not* to do an obvious-looking thing, and two of them record claims this review made and
then refuted with its own measurements.

## Inherited issue IDs

All are closed, with the dispositions in `## Reviews` below. The ones that shaped the plan most:

* **I4 / I29** — whether covering `reset`, `setHeaders` and `setState` expands the mandate.
  Dispositioned three times, kept, with the obligation and evidence in `## Scope and the adoption
  gate`. Do not relitigate it during implementation.
* **I17** — this review claimed `setState` had no production caller. That was **wrong**; three
  lenses refuted it at confidence 99 and it is now one of the four covered actions.
* **I42** — this review claimed an empty `headers.fen` was unreachable. That was **wrong** too;
  the route exists and is filed as `f-20260922-12`.
* **I52 / I57** — two successive rounds found a test row that could not fail. The row mechanics in
  Phase 2's table are load-bearing; implement the fixture and the indices exactly as written.

## Findings filed out of this review

`f-20260922-08`, `f-20260922-09`, `f-20260922-10`, `f-20260922-11`, `f-20260922-12` — all measured
or traced before filing, all outside this plan's MANDATE, all with their reasoning in
`## Scope and the adoption gate` and in the round tables.

---

# Plan: rebase and invalidate the practice path, and make root installation leave a coherent state

## Goal

Close `f-20260922-04`, `f-20260914-26` and `f-20260914-27`. Operations in `src/state/store/tree.ts`
leave a `number[]` path addressing a tree that changed under it, and `getNodeAtPath` truncates
silently rather than failing, so the wrong node is addressed with no error anywhere.

After this change: the two sibling mutations rebase `practicePath` as they already rebase the cursor;
`goToNext` never navigates off an active drill path; and every operation in this store that installs
a new root leaves nothing addressing the old one. For the two that build a root from a FEN, that
means all four of `headers.fen`, `headers.start`, `practicePath` and `position` are made consistent
with the installed root; for the two that install a whole state object, the supplied fields stand as
given and only `practicePath` — which belongs to the session, not to the game — is cleared. Derived
state is outside that sentence in every case: the store's own wrapper rebuilds `boardStateMap`
whenever a root is assigned, and it keeps doing so.
One mutation that is not among the actions this plan covers is knowingly left open and named in
Scope.

## Measurements

Every claim below was reproduced against the real store (`createTreeStore`) on 2026-09-22, at
`d95dbcda`, through throwaway vitest files that were deleted afterwards. These are observations, not
readings of the code.

| # | Sequence | Observed |
| --- | --- | --- |
| M1 | root children `[e4→e5, d4→d5]`, `position = [1,0]`, `practicePath = [1,0]`, then `promoteVariation([1])` | `position` → `[0,0]` (correct); `practicePath` stays `[1,0]`, which now addresses **`e5`** — the other line's node |
| M2 | same tree, `practicePath = [1,0]`, then `deleteMove([0])` | `position` → `[0,0]` (correct); `practicePath` stays `[1,0]`; `getNodeAtPath(root, [1,0])` truncates and returns the **root** (`san === null`) |
| M3 | main line `1.e4 e5 2.Nf3 Nc6 3.Bb5`, side line `1.Nf3 Nc6 2.e4 e5` (leaf, transposes), `position = practicePath = [1,0,0,0]`, then `goToNext()` | `position` → `[0,0,0,0,0]`, i.e. **`Bb5`** — the drill's answer, revealed past the boundary |
| M4 | `defaultTree("4k3/8/8/8/8/8/8/4K2R w K - 0 1")`, then `setFen("8/8/8/4k3/8/8/4P3/4K3 w - - 0 1")` | `root.fen` is the new FEN; `headers.fen` is still the **old** one |
| M5 | continue M4 with `setHeaders({...headers, white: "Somebody"})` | `root.fen` is back to the **old** FEN — the custom position and its moves are gone |
| M6 | tree `1.e4 e5`, `headers.start = [0,0]`, then `setFen(<other fen>)` | `root.children.length === 0`, `headers.start` is still `[0,0]`, and `getNodeAtPath` silently returns the new root for it |
| M7 | `setPracticePath([1,0])`, then `reset()` | `practicePath` is still `[1,0]`, into a tree with no children — zustand's `set(() => defaultTree())` shallow-merges and `defaultTree()` has no `practicePath` key |
| M8 | root children `[a→deep-a, b→deep-b]`, then `deleteMove([0,0])` | the **mutated** parent `a` is a new object (`=== aBefore` is `false`), while the untouched `deep-b` is identical (`=== deepBBefore` is `true`) — Immer clones the mutated ancestor chain and structurally shares everything else |
| M9 | `setPracticePath([1,0])`, then `setState(defaultTree())` | `practicePath` is still `[1,0]` — the same shallow merge as M7 |
| M10 | `parseFen(" 8/8/8/4k3/8/8/4P3/4K3 w - - 0 1 ")`, then `setHeaders({...headers, fen: <that padded string>})`, then an unrelated header edit | `parseFen(...).isErr` is **true** — chessops rejects the padding; called directly, `setHeaders` stores the padded string while `defaultTree` trims the root, so `root.fen !== headers.fen` permanently and the next header edit rebuilds the root again |

## Scope and the adoption gate

The MANDATE's obligation is the sentence in `f-20260922-04`: *"the rebasing is incomplete in the one
place that addresses a user's drill, and a stale `number[]` path silently addresses the wrong node
rather than failing."* Its evidence that an incomplete closure fails is the finding's own existence —
`f-20260909-07` (`b82021ec`) closed this class for `position` and `headers.start` and left the drill
path out, which is why these three findings exist. So the test for inclusion is not "is this site
named in a finding" but "can this site still leave a stale `practicePath`".

**In, because they can:** `deleteMove`, `promoteVariation`/`promoteToMainline` (O1), `goToNext`'s use
of the path (O2), and the four operations that install a new root or a new tree — `setFen`,
`setHeaders` in its rebuild branch, `setState` and `reset` (O3). Only `setFen` is named by the three
findings; the rest are adopted because the obligation above is false while they are exempt, and each
is measured (M4-M7, M9) or traced to a named production caller.

**Out, with the evidence:**

* `makeMove` under `mainline: true` renumbers siblings via `unshift` without rebasing `headers.start`
  — measured 2026-09-22, filed as **`f-20260922-08`**. Out because it cannot reach the drill path: no
  flow that sets `practicePath` calls `mainline: true` (`BoardGame.syncTreeWithMoves`, `PuzzleBoard`,
  `Puzzles`), so the obligation above does not fail without it. It is `headers.start` that stays
  exposed there, and that is what keeps `f-20260922-10` live.
* Rehydration does not check that a persisted path resolves in the restored root — filed as
  **`f-20260922-10`**. Out on this reasoning, which is about the *upgrade* boundary and not about
  reloads: the backing store is `sessionStorage` (`tabStorage.ts:265-295`), which is cleared when the
  window closes, and installing this fix requires relaunching the application, so no path written by
  today's code can be restored by the fixed code. Within one run of the fixed application, O1-O3 mean that no
  reachable production flow writes a stale `practicePath`, so a reload — which `sessionStorage` does
  survive — has nothing stale to restore. The one mutation left open, `makeMove` under
  `mainline: true`, cannot reach `practicePath` (traced above); it is `headers.start` that stays
  exposed. The residual exposure is `headers.start` through `f-20260922-08`,
  which is that finding's to close.
* Tab close commits the workspace before deleting the tree key — filed as **`f-20260922-09`**.
  A different mechanism (tab lifecycle), not path rebasing.

## Approach

### O1 — `practicePath` is rebased by every sibling mutation, exactly as the cursor is

`deleteMove` and `promoteVariation` (the module-level functions in `src/state/store/tree.ts`) already
rebase `state.position` and `state.headers.start` through `rebasePathAfterDelete` /
`rebasePathAfterPromotion`. `practicePath` is a third path of the same kind.

**Contract change, and it is required:** both functions are declared `(state: TreeState, …)` and
`TreeState` has no `practicePath` — that field is declared on `TreeStoreState`. At runtime `produce`
already hands them the whole store draft, so the value is there, but the declared parameter type must
be widened for the access to type-check. Widen it to `TreeStoreState` (or to a named type that adds
the one field); do not cast.

Required behaviour:

* After `deleteMove(path)`, `practicePath` addresses the same node it addressed before, or — when its
  own node was inside the deleted subtree — the deleted node's parent, mirroring what the same
  function already does for `state.position` (`rebasePathAfterDelete(...) ?? path.slice(0, -1)`).
* After `promoteVariation(path)`, and therefore after `promoteToMainline(path)`, `practicePath`
  addresses the same node it addressed before.
* A `practicePath` of `null` stays `null`; no operation invents one.

**One mechanism, not three copies.** There are three tracked paths and two mutations, and the per-path
expression differs only in its fallback (`position` → the deleted node's parent, `headers.start` →
`undefined`, `practicePath` → the deleted node's parent). Route all three through a single rebasing
step per mutation, with the fallback supplied per path, rather than writing the same expression six
times. The private shape of that step is the executor's choice.

Failure semantics: there is no error path. A path that cannot survive is clamped to a surviving
ancestor or cleared, never left dangling and never silently reinterpreted.

Ownership: the two module-level mutation functions, not their callers — `promoteToMainline` loops over
`promoteVariation` and must inherit the rebase without code of its own.

### O2 — `goToNext` advances only along an active drill path

`practicePath` is the path of the practice card itself: `PracticePanel.newPractice` computes
`findFen(card.fen, root)`, calls `goToMove(path)` and then `setPracticePath(path)`, so at the card
`position.length === practicePath.length`. Its only *navigation* reader is `goToNext`, where it exists
to stop the user stepping forward into the answer. (It is also persisted; see Scope.)

Two independent holes today, both measured or traced:

1. The guard sits **inside** the `node.children.length > 0` branch, so a childless node falls through
   to the transposition fallback, which returns `[...targetPath, 0]` — a path on a different branch
   entirely, after which no index of `practicePath` means anything. M3 shows it revealing `Bb5`.
2. The guard is **length-only**. `goToMove` lets the cursor leave the drill line at any time (the
   notation cell calls it on click, `CompleteMoveCell.tsx`), and `practicePath[state.position.length]`
   is then applied to whatever branch the cursor is on. With `practicePath = [1,0]` and
   `position = [0]`, `practicePath[1]` is `0`, so `goToNext` produces `[0,0]` — a move on the wrong
   branch presented as the drill's continuation.

Required behaviour, when `practicePath` is not null:

* `goToNext` advances **only** when `position` is a proper prefix of `practicePath`, and then only by
  `practicePath[position.length]`.
* It performs no transposition jump at all.
* In every other case — cursor off the path, or `position.length >= practicePath.length` — it does
  nothing and returns no state change.

When `practicePath` is null, `goToNext` behaves exactly as it does today, transposition fallback
included. `isPrefix` already exists in `src/utils/misc.ts` and is already imported by this module.

The `if (candidates.length === 0)` block currently holds a dead inner `if` whose both arms `return {}`
— the misplaced remnant of guard (1). It goes away with this change.

Ownership: `goToNext` alone. `PracticePanel` and `BoardAnalysis` are not touched; they already set and
clear the path.

Dependency: none on O1 or O3.

### O3 — installing a new root or a new tree leaves nothing addressing the old one

Four actions in this store replace the tree the tracked paths index, and none of them clears those
paths. They are one contract; two of them — the two that build a root from a FEN — additionally share
one implementation.

| Action | How it replaces the tree | What it must leave |
| --- | --- | --- |
| `setFen(fen)` | `state.root = defaultTree(fen).root` | `headers.fen === root.fen`, `headers.start` `undefined`, `practicePath` `null`, `position` `[]` |
| `setHeaders(headers)` | in the branch guarded by `headers.fen && headers.fen !== state.root.fen`, `state.root = defaultTree(headers.fen).root` | the same four, with `headers.fen` **re-read from the installed root** |
| `setState(tree)` | assigns a whole new `TreeState` | `practicePath` `null`; every other stored field comes from `tree` unchanged. Derived state is exempt: the store's `withTranspositionMaps` wrapper (`tree.ts:166-181`) already rebuilds `boardStateMap` whenever `root` is assigned, and that stays |
| `reset()` | assigns `defaultTree()` | `practicePath` `null` |

Why each of the four values:

* **`headers.fen` from the installed root, never from the input.** `setHeaders` decides whether to
  rebuild the root by comparing `headers.fen` with `root.fen`, so that equality is a load-bearing
  invariant, and the only way to guarantee it is to derive one side from the other rather than to
  trust every caller to pre-normalise. `defaultTree` normalises (`fen?.trim() || INITIAL_FEN`), so an
  input that differs from its own normalisation produces a `headers.fen` that can never equal
  `root.fen` again, and `setHeaders` then rebuilds the root on *every* subsequent header edit —
  measured on the real store (M10). **This is a contract requirement, not a reported sequence:**
  chessops `parseFen` rejects surrounding whitespace (measured, M10), so today's validating callers
  (`FenSearch`, `FenInput`, `EditingCard`) cannot produce the padded case. Writing
  `headers.fen = root.fen` costs nothing over `headers.fen = fen` and makes the invariant structural
  instead of caller-dependent. M4/M5 is the same loss with a perfectly normal FEN, and that one is
  reported.
* **`headers.start` cleared to `undefined`.** The tree it indexed no longer exists. That is what
  `deleteMove` already does when the start path falls inside the deleted subtree, and `goToStart` reads
  `state.headers.start || []`, so `undefined` means "the root". For `setState` the supplied `TreeState`
  brings its own `headers`, including its own `start`, which is correct for that game.
* **`practicePath` cleared to `null`.** There is no surviving ancestor to clamp to. `setState` and
  `reset` keep it today only because zustand shallow-merges and neither replacement object carries the
  key (M7, M9).
* **`position`** is already reset by `setFen` and `setHeaders`, and supplied by `setState`.

**One shared unit, for the two that build a root from a FEN.** `setFen` and the `setHeaders` rebuild
branch prescribe the identical four-value cleanup. Implement that root installation once — a private
helper that takes the draft and the newly built root and leaves all four values — and call it from
both, rather than writing a second near-identical copy (universal rule 11 in `~/.claude/CLAUDE.md`: "Extract aggressively — at the 2nd copy, not the 3rd"). `setState` and `reset`
are **not** routed through it: they install a whole state object rather than a root built from a FEN,
and the only value they owe is `practicePath = null`, which they set directly.

Failure semantics: unchanged. `defaultTree` does not reject an unparseable FEN (`rootHalfMoves` falls
back to `0`); this plan adds no validation — `FenInput`, `EditingCard` and `FenSearch` validate before
calling.

**The rebuild guard keeps its truthy test, and the contract is stated for a non-empty FEN.**
`setHeaders` rebuilds only when `headers.fen && headers.fen !== state.root.fen`, so
`setHeaders({...headers, fen: ""})` installs nothing and leaves `headers.fen` empty beside an
unchanged root. Round 5 established that this **is** reachable, refuting an earlier claim in this
plan that it was not: a PGN carrying a literal `[FEN ""]` tag gives `headers.fen === ""`, because
`getPgnHeaders` uses `FEN ?? INITIAL_FEN` and `??` does not fall through for an empty string
(`src/utils/chess.ts:534`, measured), while the root is built from `headers.fen.trim()` and so
becomes `INITIAL_FEN`. `PgnInput` passes that state to `setState`, and every later `GameInfo` header
edit carries the empty FEN through the falsy guard untouched.

That is a **parsing** defect in `src/utils/chess.ts`, not a store one, and it is filed as
**`f-20260922-12`** with the round-5 trace. This plan does not change the guard and does not claim
coherence for an empty FEN: it states the contract for every non-empty one, which is what the four
actions above can guarantee without reaching into the PGN parser. Fixing `f-20260922-12` removes the
only route that produces the empty value.

**What is deliberately not changed:** `setHeaders`'s rebuild-on-mismatch itself. It is what lets a user
paste a FEN into the header editor, and it is the reader that made the missing writes visible. The
branch where the FEN is unchanged keeps today's behaviour exactly — in particular the orientation
toggle in `src/components/boards/Board.tsx:171-176` passes `fen: root.fen` deliberately (the incident
behind `9ba36493`) and must not lose its start path.

Reachability of each action: `setFen` from `FenInput`, `EditingCard`, `Board` and `BoardGame`;
`setHeaders` from `GameInfo`, `FenSearch`, `Board`, `BoardControls` and `BoardGame`; `setState` from
`PgnInput.tsx:103` (pasting a PGN) and `InfoPanel.tsx:235` (switching to another game in the file);
`reset` from `BoardAnalysis.addGame` (`BoardAnalysis.tsx:104`).

## Decisions and trade-offs

* **D1 — a `practicePath` whose node is deleted is clamped to the deleted node's parent, not set to
  `null`.** `null` would be simpler and matches `headers.start` (which becomes `undefined`), but
  `practicePath` is not bookkeeping: after O2 it is the only thing stopping `goToNext` from revealing
  the answer, and the practice session UI is still on screen after the deletion. Clamping leaves
  `position` and `practicePath` at the same depth, so the guard still refuses to advance. It also fixes
  `f-20260914-26`'s own sequence — practice at `[0,0]`, delete `[0,0]` — which under `null` would let
  `goToNext` follow the surviving sibling as the deleted card's continuation, the exact behaviour that
  finding reports.
* **D2 — with an active `practicePath`, the transposition fallback is refused outright, not
  redirected.** Redirecting cannot be expressed: `practicePath` is rooted at the tree root and the
  fallback's target lives on another branch, so no index of `practicePath` survives the jump. After
  O2's prefix requirement, refusing is also the only answer consistent with "advance along the path":
  the jump's result is by construction not a prefix-extension of the path.
* **D3 — `headers.fen` is written from the installed `root.fen` in both writers.** See O3. This is the
  cheapest expression of the invariant `setHeaders` already depends on, not a guard against a reported
  input: M10 measured that `parseFen` rejects padded FENs, so no validating caller reaches the
  divergent case today. The test below pins the contract rather than a user sequence, and says so.
* **D4 — the identity assertions are split by Immer's structural sharing.** M8 measured that the
  mutated ancestor chain is cloned while untouched subtrees keep object identity. A test may use `toBe`
  on the captured node only when that node is **outside** the mutated chain — which covers every
  "unrelated path still addresses the same node" case, the interesting ones. Where the expected target
  is on the mutated chain (the clamp-to-parent case in D1), assert the resolved node's `san` and the
  path value instead, and say in the test why `toBe` is not used.
* **D5 — no browser verification step, and this reverses a round-1 adoption.** Round 1 adopted one
  `pnpm verify:app` pass for the M4/M5 sequence. Round 2 measured that this is not executable as
  described: `scripts/verify-app.mjs` is a fixed list of thirty-three named assertions with no
  info-panel, FEN or header-edit flow, and its own header requires a staged-failure record for every
  assertion before its green is citable — so adding this scenario is a deliberate change to a
  verification artefact with its own design question, not a run of an existing check. The cheap
  alternative, which this plan takes, is the unit tests below driving the exact sequences plus the
  existing `e2e-container` gate, which would catch any unintended rendering change. No component,
  markup or style is touched, so nothing rendered changes and no committed snapshot may move.

## Risks / open questions

* **Coverage ratchets.** `src/state/**` is the `state-persistence` area (floor 70/60/50) and is also
  under the independent baseline ratchet, which rejects a lower covered count *or* a lower ratio. The
  change adds branches to `tree.ts`; each one is driven by a test below, so the expected movement is
  upward. If `frontend-coverage` goes red, that is a finding about this diff — a baseline is never
  rewritten (`docs/coverage.md`).
* **Mutation testing.** `src/state/store/tree.ts` is in none of the three frontend mutation packages
  (`game-practice`, `workspace-storage`, `tree-path` — `scripts/frontend-mutation-packages.mjs`), so
  `frontend-mutation` should be unaffected; `tree-path` covers `src/utils/treeReducer.ts`, untouched.
* **Existing tests go red by design and must be updated, not worked around.**
  `src/utils/tests/store.test.ts:396` (`should handle setFen`) asserts the whole state with
  `toStrictEqual({ ...defaultTree(), … })`, whose `headers.fen` is `INITIAL_FEN`; O3 makes it the new
  FEN. `:174` (`should handle setHeaders`) and `:481` must be re-read for the same reason. Updating an
  expectation that encodes the defect is part of the fix; loosening an assertion to avoid it is not.
* **O2 changes navigation for a state the user can reach deliberately.** After the prefix requirement,
  clicking a move outside the drill line during practice makes the forward arrow do nothing until the
  cursor is back on the path. That is the intended reading of "advance along the drill path" and is
  strictly safer than today's wrong-branch move, but it is a behaviour change beyond the reported
  sequences and is called out here rather than buried.
* **No storage-schema change, but `practicePath` is persisted.** `tabStorage.ts` persists it
  (`practicePath: pathSchema.nullable().optional()`). This plan changes no schema and adds no
  rehydration check; the reasoning and the filed follow-up are in Scope (`f-20260922-10`).

## Not part of this task

* `f-20260922-08` — `makeMove(mainline: true)` and `headers.start`.
* `f-20260922-09` — tab close orphaning a `sessionStorage` tree key.
* `f-20260922-10` — rehydration not validating persisted paths against the restored root.
* `f-20260914-17` — practice-card dedupe versus full-FEN lookup (`opening.ts`, `PracticePanel.tsx`).
* `f-20260914-28` — threefold detection after `appendMove`.
* The logs-modal move numbering reported as C5 in the `f-20260906-23` review (`PracticePanel.tsx`).
* Any change to `PracticePanel`, `BoardAnalysis`, `FenSearch`, `Board`, `PgnInput`, `InfoPanel` or the
  persisted schema, and any change to `setHeaders`'s decision to rebuild.

## Phases

Each phase is independently committable and ends green. They touch disjoint actions of one production
file; the test files overlap, so phases run in sequence, but no phase depends on another's behaviour
and the order below is only a fixed sequence, not a dependency. `src/state/**` is a Sensitive-Path glob
in `.claude/skills/push/SKILL.md`, so every phase runs at `--role sensitive`; none of auth, concurrency
or an API contract is touched, and the persisted schema is unchanged.

### Phase 1 — root installation (O3)

* Production hunks: the `setFen`, `setHeaders`, `setState` and `reset` actions in
  `src/state/store/tree.ts`, plus the shared root-install helper.
* Test files: `src/state/store/tree.test.ts` (new cases), `src/utils/tests/store.test.ts` (updating the
  expectations named under Risks).
* Tests:
  * `setFen` writes `headers.fen` equal to `root.fen`, with an input carrying **surrounding
    whitespace**, so an implementation that copied the raw argument fails (D3). A test on an
    already-normalised FEN cannot distinguish the two. Same comment obligation as the `setHeaders`
    case below: this input pins the contract, it is not a user sequence.
  * `setFen("")` leaves `headers.fen === root.fen === INITIAL_FEN`, **and** clears a `headers.start`
    and a `practicePath` seeded beforehand. Asserting the FEN alone passes a cleanup written inside a
    truthy-FEN branch, which is the shape of the guard defect this plan is already working around
    elsewhere.
  * `setFen` → `setHeaders({...headers, event: "x"})` leaves the board on the new position (M4, M5).
  * `setFen` clears a non-empty `headers.start` (M6) and a non-null `practicePath`.
  * `setHeaders` with a **new** `fen` clears `headers.start` and `practicePath`, canonicalises
    `headers.fen`, **and resets `position` to `[]`** — assert all four, because an implementation
    that cleared only the headers and the practice path would otherwise pass while leaving the cursor
    inside the discarded tree, where `getNodeAtPath` truncates it silently.
  * the same with a whitespace-padded FEN, followed by a move and then an unrelated header edit; the
    follow-up assertion is **structural**, not a FEN-string comparison. Sequencing matters and is
    easy to get wrong: `makeMove` mutates the root, so Immer clones it (M8), and the object the
    installation produced is already gone by the time the move is played. Capture the root and the
    move's child node **after the move**, then assert that the unrelated header edit leaves both
    identical. Comparing FEN values alone passes even when the edit rebuilt the root and discarded
    the move, which is the whole defect; asserting identity with the installation-time root instead
    would reject the correct implementation. The test comment must say that the padded input pins the
    contract and is not reachable through the validating callers (M10), so a later reader does not
    mistake it for a user sequence.
  * `setHeaders` with `fen` **unchanged** keeps `headers.start` and `practicePath` — the orientation
    toggle shape, and the regression anchor for the rebuild branch.
  * `setState(tree)` clears `practicePath` (M9) and keeps the supplied `headers.start`.
  * `reset()` clears `practicePath` (M7).
  * `should handle setFen` at `store.test.ts:396` updated to the new `headers.fen`; `:174` and `:481`
    re-read and updated only where they encode the defect.
* PROOF COMMAND: `pnpm vitest run src/state/store/tree.test.ts src/utils/tests/store.test.ts`

### Phase 2 — `practicePath` rebasing on the sibling mutations (O1)

* Production hunks: `deleteMove`, `promoteVariation` and the shared rebasing step in
  `src/state/store/tree.ts`.
* Test file: `src/state/store/tree.test.ts`.
* Tests, following the identity rule in D4:
  * **one matrix, covering every branch of both rebasing rules, under a nested parent.**
    Both helpers compare against the mutation's parent *depth*, so a root-level fixture passes an
    implementation that only ever inspects index 0 of the path. Build a fixture whose root has two
    children, `[0]` and `[1]`, each with **at least four children of its own**, and give every one of
    those grandchildren at least one child — `[0,2]` needs **two**, for the `promoteToMainline` case
    below. Every mutation below is under `[0]`; the `[1]` branch is shaped the same way so the
    unrelated-branch rows can use an index high enough to matter.

    | # | `practicePath` | Operation | Expected | What it catches |
    | --- | --- | --- | --- | --- |
    | 1 | `[0,1,0]` | `deleteMove([0,2])` | unchanged `[0,1,0]`, same node | a rebase that shifts every sibling rather than only those after the deleted index |
    | 2 | `[0,3,0]` | `deleteMove([0,2])` | `[0,2,0]`, same node | a rebase that never shifts — and, with row 1, a `>=`/`>` confusion |
    | 3 | `[0,2,0]` | `deleteMove([0,2])` | `[0]` — the deleted node's parent (D1) | a path left dangling inside a deleted subtree |
    | 4 | `[0,2,0]` | `promoteVariation([0,2])` | `[0,0,0]`, same node | **M1's case.** The `siblingIndex === promotedIndex` branch: an implementation that shifts only the *other* siblings passes rows 5 and 6 while leaving the drill on a different line |
    | 5 | `[0,1,0]` | `promoteVariation([0,2])` | `[0,2,0]`, same node | the `siblingIndex < promotedIndex` branch |
    | 6 | `[0,3,0]` | `promoteVariation([0,1])` | unchanged `[0,3,0]`, same node | the `siblingIndex > promotedIndex` branch, which must not move |
    | 7 | `[1,3,0]` | `deleteMove([0,2])` | unchanged `[1,3,0]`, same node | `rebasePathAfterDelete`'s `isPrefix(deleted.slice(0,-1), target)` guard. The target's index at `parentDepth` — the deleted node's own sibling slot, here index 1 of the path — must **exceed** the deleted one, or the `target[parentDepth] > deleted[parentDepth]` test answers first: with `[1,0]` that test is `0 > 2`, false, so the row passes even with the prefix check deleted and proves nothing |
    | 8 | `[1,2,0]` | `promoteVariation([0,2])` | unchanged `[1,2,0]`, same node | the `!isPrefix(parent, target)` guard in `rebasePathAfterPromotion`. Two conditions on the target, and row 7's `[1,3,0]` satisfies only the first: it must be **longer** than the promotion's parent path `[0]`, or the earlier `target.length <= parent.length` test answers first; and its index at `parent.length` must be one the shifting rule would actually move — `2`, equal to the promoted index, so that deleting the guard returns `[1,0,0]` instead of the unchanged path. With `3` there, no branch of the shift applies and the row passes a broken implementation |
    | 9 | `[0]` — the mutation's parent itself | `deleteMove([0,2])`, then separately `promoteVariation([0,2])` | unchanged `[0]` in both | a **contract anchor, not a branch anchor**, and it is labelled that way in the test: an ancestor of the mutation must never be clamped or reindexed. No single-guard mutant distinguishes it — with a one-element target, `target.length > parentDepth` is false and `target[parentDepth]` is `undefined`, so removing either `target.length` guard still returns the path unchanged. It stays because A1 states the property and a later refactor could break it in a way no other row would catch |

    "Same node" is `toBe` on a node outside the mutated chain (D4). Rows 3 and 9 do **not** get it. Row 3's
    target starts inside the deleted subtree and its expected *result* is the deleted node's parent,
    which Immer has cloned (M8); row 9's target is that parent throughout, cloned for the same
    reason. Both are therefore asserted by path value, row 3 additionally by the `san` of the node
    the resulting path resolves to. M1 and M2 are rows 4 and 2, not separate tests. No separate
    root-level fixture is needed — the existing cursor and start-header tests in this file already
    cover that shape, and rows 7 and 8 cover the unrelated-branch case more directly.
  * **`promoteToMainline` gets its own assertion, and it must need more than one iteration.** The
    wrapper loops `promoteVariation` while the path still has a non-zero index, so a target with a
    single non-zero index runs the loop exactly once and a one-shot implementation passes. Use a path
    with **two** non-zero indices: give `[0,2]` at least two children, set
    `practicePath = [0,2,1]`, and call `promoteToMainline([0,2,1])`. Assert `practicePath` ends at
    `[0,0,0]` addressing the same node (`toBe`), and assert the expected values of the other two
    tracked paths explicitly rather than "they agree" — with `state.position` and `headers.start` also
    set to `[0,2,1]` beforehand, both must end at `[0,0,0]` on that same node. Stating the values is
    the point: a test that left all three at `[]` would otherwise pass while proving nothing.
  * deleting the practised node clamps `practicePath` to its parent, and `goToNext` then does not
    advance (D1, `f-20260914-26`'s sequence). Asserted by `san` and path value, not `toBe` (D4).
  * a `null` `practicePath` stays `null` across both mutations.
* PROOF COMMAND: `pnpm vitest run src/state/store/tree.test.ts src/utils/tests/store.test.ts`

### Phase 3 — the drill boundary in `goToNext` (O2)

* Production hunks: the `goToNext` action in `src/state/store/tree.ts`.
* Test file: `src/utils/tests/store.test.ts`.
* Tests:
  * the M3 sequence asserts `position` is unchanged. This is the **rewrite** of the existing
    `practice mode: goToNext transposition fallback bypasses guard` (`store.test.ts:985`, added by
    `7ff0646f`), which asserts today's jump and whose own name says it documents a bypass. Keep its
    fixture, invert the assertion, rename it to what is now true.
  * **off-path cursor, shorter than the path**: `practicePath = [1,0]`, `goToMove([0])`,
    `goToNext()` leaves `position` at `[0]`. The node at `[0]` **must have a child** — otherwise a
    reverted length-only implementation also leaves the cursor alone, for the wrong reason, and the
    test proves nothing. This is the anchor for hole (2).
  * **off-path cursor, longer than the path**: `practicePath = [1]`, cursor at `[0,0]` on a childless
    node that transposes into a node with children. `goToNext()` must do nothing. Without this row a
    guard written as `position.length === practicePath.length` passes every other case while a longer
    cursor still falls through into the transposition fallback.
  * **advance along the path, through a non-zero index at more than one depth**: branching at both
    levels and `practicePath = [1,1]`; from `position = []`, `goToNext()` must reach `[1]`, then
    `[1,1]`, and a further `goToNext()` must do nothing. Two non-zero indices are the point — a
    `[0,0]` fixture passes an implementation that ignores the path and takes `children[0]`, and a
    `[1,0]` fixture passes one that consults the path for the first step only and then falls back to
    child `0`. The node at `[1,1]` **must have a child**: today's guard sits inside the
    `children.length > 0` branch, so on a childless endpoint an implementation that fixed only the
    transposition fallback would stop for the wrong reason and the final no-op would prove nothing.
  * the **three** existing transposition tests that run without a `practicePath`
    (`store.test.ts:795`, `:810`, `:847`) stay green, unmodified — the regression anchor for "no
    `practicePath`, no behaviour change".
* PROOF COMMAND: `pnpm vitest run src/state/store/tree.test.ts src/utils/tests/store.test.ts`

### Final gates (after the last commit, clean tree)

From `.claude/skills/push/SKILL.md`. The first three are unconditional — required on every push
regardless of which paths changed — and the rest are that file's `src/**` frontend row. Run them in
this order:

```
git diff --check
pnpm gates:contract:check
env -u KIT_ROOT pnpm findings:kit:check
pnpm gate:ensure frontend-coverage
pnpm gate:ensure frontend-mutation
pnpm gate:ensure frontend-build
pnpm bundle:check
pnpm gate:ensure e2e-container
```

`git diff --check` and `env -u KIT_ROOT pnpm findings:kit:check` are required on **every** push by
`.claude/skills/push/SKILL.md` (sections "Findings ledger" and "Commit, push, and verify"); the
second is local-only and fails if the vendored `scripts/findings.py` has drifted from the released
kit.

No Rust file is touched, so no backend gate is affected. `./scripts/findings.py check` runs because the
ledger is edited at closure. `e2e-container` must pass with **no snapshot re-recorded**; a moved
snapshot is a regression to investigate, since nothing rendered changes.
## Reviews

Append-only. Raw lens verdicts are recorded as returned and never rewritten.

### Round 1 — revision r1, 2026-09-22, executor codex, 9 lenses

Raw verdicts: `review-plan` **REVISE** · `review-minimalism` **REVISE** · `review-correctness`
**REVISE** · `review-root-cause` **REVISE** · `review-tests` **REVISE** · `review-code-quality`
**APPROVED** · `review-error-handling` **REVISE** · `review-chess-semantics` **REVISE** ·
`review-persisted-state` **REVISE**.

Reports: `$RUN_TMP/lens-*.txt`. `review-plan` recorded a limitation: the read-only sandbox refused
Vite's temp-file write, so it ran an equivalent read-only Vitest invocation instead (34 tests green,
including the existing M3 test).

| ID | Claim | Witnesses (confidence) | Disposition | Obligation / evidence |
| --- | --- | --- | --- | --- |
| I1 | The length-only guard does not keep `goToNext` on the practice path; an off-path cursor plus `practicePath[position.length]` walks the wrong branch | chess-semantics 98, plan 98, error-handling 97, correctness 96, root-cause 95, tests 94 | **Fix** | Same mechanism as MANDATE claim (2) — `goToNext` trusting the path's indices without relating them to the cursor. O2 rewritten: advance only while `position` is a proper prefix of `practicePath`. Traced to `goToMove` from `CompleteMoveCell` |
| I2 | `setHeaders` (and `setState`) also replace the root while keeping `practicePath`/`headers.start` | root-cause 96, chess-semantics 96, error-handling 95, plan 95 | **Fix** for `setHeaders`, **Skip** for `setState` | `setHeaders` is reachable with a new FEN through `FenSearch.addFen` — new obligation O5. `setState` has no production caller (measured by grep over `src/**` outside tests); recorded in Scope |
| I3 | Rehydration never checks that a persisted path resolves in the restored root | persisted-state 98, root-cause 96, error-handling 94, chess-semantics 91 | **Defer — filed `f-20260922-10`** | Measured: the store is `sessionStorage`, cleared on window close, so no pre-fix path crosses an upgrade; after O1–O5 no mutation writes a stale `practicePath`. What keeps it live is `f-20260922-08`, not this plan. Reasoning recorded in Scope |
| I4 | O4 (`reset`) is scope expansion not required by MANDATE | correctness 100, tests 99, plan 98, chess-semantics 100 | **Fix — kept, with the gate answered** | Rejecting the claim, with evidence: the MANDATE obligation is that no stale `number[]` path addresses the drill, and its evidence that partial closure fails is `f-20260909-07`, which closed this class for two paths and produced these three findings. `reset` is measured (M7) to violate it. The new Scope section states the obligation, the evidence and the boundary that keeps `makeMove`, `setState` and rehydration out |
| I5 | `toBe` identity is impossible where the target is the mutated parent — Immer clones it | plan 99 | **Fix** | Measured as M8: the mutated ancestor is a new object, untouched subtrees keep identity. D5 splits the assertion rule accordingly |
| I6 | O1's access will not type-check: both helpers take `TreeState`, which has no `practicePath` | plan 99, code-quality 99 | **Fix** | O1 now states the parameter widening to `TreeStoreState` as a required contract change, and forbids a cast |
| I7 | Three tracked paths × two mutations duplicates the same expression six times; extract one helper | minimalism 88 | **Fix** | Universal rule 11. O1 requires one rebasing step per mutation with a per-path fallback; the private shape is the executor's |
| I8 | The plan wrongly excludes browser verification for a change that drives the visible board | plan 92 | **Fix** | The M4/M5 loss is user-visible in the real product, which is what `verify:app` exists for. A bounded browser-verification step was added: one `verify:app` pass over that one sequence |
| I9 | Three transposition tests run without a practice path, not two | plan 100 | **Fix** | Corrected; the three are named with line numbers |
| I10 | `reset()` is called by `addGame`, not `userSaveFile` | code-quality 100 | **Fix** | Corrected in O4 |
| I11 | Wording contradictions: "only consumer" vs persisted, "none of persistence", D2's invariant stated as already true, goal says three operations | code-quality 99/98/97 + nit 97 | **Fix** | Rewritten throughout; the goal and Phase preamble now say what is and is not touched |
| I12 | The `setFen` tests use an already-normalised FEN, so copying the raw argument would pass | tests 96 | **Fix** | Phase 1 now requires a whitespace input and an empty-string case |
| I13 | The `goToNext` tests cover only the equal-length case | tests 94 | **Fix** | Phase 3 gained the off-path anchor and the advance-along-the-path anchor; an always-refuse implementation now fails |
| I14 | M1 promotes the same branch the practice path addresses; an earlier-sibling case would pass a broken rebase | tests 91 | **Fix** | Phase 2 gained `practicePath = [0,0]` while promoting `[2]` |
| I15 | Phase 3 listed `tree.test.ts` although its tests belong in `store.test.ts` | minimalism 96 | **Fix** | Phase file lists corrected |
| I16 | Tab close commits the workspace before deleting the tree key, orphaning it on failure | persisted-state 96 | **Defer — filed `f-20260922-09`** | Confirmed by reading `atoms.ts` and `tabStorage.ts`; a different mechanism (tab lifecycle), outside MANDATE |

Open after round 1: none. Every issue is dispositioned; I1, I2 (`setHeaders` half), I5–I15 are
substantive corrections needing an explicit closure check against r2.

### Round 2 — revision r2, 2026-09-22, executor codex, the same 9 lenses

Raw verdicts: `review-plan` **REVISE** · `review-minimalism` **REVISE** · `review-correctness`
**REVISE** · `review-root-cause` **REVISE** · `review-tests` **REVISE** · `review-code-quality`
**APPROVED** · `review-error-handling` **APPROVED** · `review-chess-semantics` **REVISE** ·
`review-persisted-state` **REVISE**.

Reports: `$RUN_TMP/r2-lens-*.txt`. `review-plan`, `review-error-handling`, `review-tests` and
`review-correctness` each recorded a limitation: the read-only sandbox refuses Vite's temp-file write,
so they traced source and relied on the recorded M1–M8 measurements instead of running Vitest.

Closure results on round 1's adopted corrections, as returned: `review-plan` — I1, I2-setHeaders,
I5, I6, I7, I9–I15 addressed, I4's retention justified. `review-minimalism` — I1, I2-setHeaders, I5,
I6, I7, I8 and I9–I15 closed, I4/O5 justified. `review-chess-semantics` — I1–I15 addressed, I4
justified, D5 correct on Immer. `review-error-handling` — I1 and I2 closed. `review-tests` — I1,
I2-setHeaders, I4, I5, I9, I10, I12, I14, I15 have named anchors, I8 not executable, I13 incomplete.

| ID | Claim | Witnesses (confidence) | Disposition | Obligation / evidence |
| --- | --- | --- | --- | --- |
| I17 | The `setState` exclusion rests on a false "no production caller" claim — `PgnInput.tsx:103` and `InfoPanel.tsx:235` call it, and its shallow merge keeps `practicePath` across a whole new game | plan 99, correctness 99, root-cause 99 | **Fix** | The lenses are right and round 1's grep was wrong: both call sites read the action through `useStore(store, (s) => s.setState)`, which the pattern missed. Measured as M9. `setState` is now one of the four actions in O3, and the Scope section no longer claims it is unreachable |
| I18 | O5 clears the paths but never canonicalises `headers.fen`, so a non-normalised input leaves `root.fen !== headers.fen` permanently | chess-semantics 98, persisted-state 95, code-quality 94 | **Fix**, with the reachability claim corrected | Adopted into O3 for both writers. Measured as M10 — and M10 also **refutes** the route the lenses proposed: chessops `parseFen` rejects surrounding whitespace, so `FenSearch` cannot produce it. D3 now states this as a contract requirement with no reported sequence behind it, and the test carries a comment saying so |
| I19 | The round-1 browser step is not executable: `verify:app` is a fixed list of 33 assertions with no info-panel, FEN or header flow, and needs `pnpm build` first | plan 99, tests 99, code-quality 98 | **Fix — round 1's I8 adoption is reversed** | Confirmed by reading `scripts/verify-app.mjs` and `.claude/skills/verify-ui/SKILL.md`. Adding the scenario would be a deliberate change to a verification artefact whose own header requires a staged-failure record per assertion — its own run, not a step here. D5 records the reversal and the cheap alternative that replaces it |
| I20 | O3 and O5 prescribe the same root-replacement cleanup in two actions without one shared unit | minimalism 94 | **Fix** | Universal rule 11, and I17 makes it four actions rather than two. O3 is now one contract with a table per action and requires a single private root-install helper |
| I21 | `should handle setFen` (`store.test.ts:396`) asserts `...defaultTree()` headers, so it goes red under O3 and the proof command cannot be green | tests 100 | **Fix** | Confirmed by reading the test. Named under Risks together with `:174` and `:481`, with the rule that an expectation encoding the defect is updated and never loosened |
| I22 | The only positive active-path fixture is `[0,0]`, which an implementation that always takes `children[0]` would pass | tests 98 | **Fix** | Phase 3's advance test now uses `practicePath = [1,0]` and requires `[1]` then `[1,0]` |
| I23 | Rehydration still does not validate persisted paths; `sessionStorage` surviving reloads invalidates the deferral | persisted-state 98, root-cause 96 | **Skip — rejected with evidence, wording sharpened** | The deferral was never about reloads. Installing the fix requires relaunching the application, which closes the window and clears `sessionStorage`, so no path written by today's code can be read by the fixed code; and within one run of the fixed application O1–O3 leave no stale `practicePath` for a reload to restore. Scope now says this explicitly so it cannot be read as a claim about reloads. The residual is `headers.start` via `f-20260922-08`, recorded in `f-20260922-10` |
| I24 | Seven wording and precision defects: the goal over-promises against the `setState` exclusion; "disjoint parts of one file" versus the phase file lists; the browser proof names the info panel while M4/M5 is the `setFen` route; O5 "exactly as O3" under-specified; the `setHeaders` guard omits its truthy check on `headers.fen`; `Board.toggleOrientation` is ambiguous across three files; the `f-20260922-08` residue is `headers.start`, not `practicePath` | code-quality 99/99/98/94 + nits 99/97/97 | **Fix** | All seven corrected: the goal now states what is and is not covered, the phases name production hunks separately from test files, the browser step is gone (I19), O3's table gives each action its own row, the guard is quoted as `headers.fen && headers.fen !== state.root.fen`, the orientation toggle is cited as `Board.tsx:171-176`, and the `f-20260922-08` residue is named as `headers.start` |
| I16 | Tab-close cleanup remains non-atomic (re-raised) | persisted-state 96 | **Skip — already filed** | Deferred in round 1 and filed as `f-20260922-09`; nothing new is claimed. It stays in "Not part of this task" |

Open after round 2: none. Substantive corrections needing an explicit closure check against r3:
I17, I18, I19, I20, I21, I22, I24.

### Round 3 — revision r3, 2026-09-22, executor codex, the same 9 lenses

Raw verdicts: `review-plan` **REVISE** · `review-minimalism` **REVISE** · `review-tests` **REVISE** ·
`review-correctness` **APPROVED** · `review-root-cause` **APPROVED** · `review-code-quality`
**APPROVED** · `review-error-handling` **APPROVED** · `review-chess-semantics` **APPROVED** ·
`review-persisted-state` **APPROVED**.

Reports: `$RUN_TMP/r3-lens-*.txt`. Every lens again recorded the same limitation: the read-only
sandbox refuses Vite's temp-file write, so none ran Vitest and all relied on the recorded M1-M10
measurements and on source tracing.

Closure results on rounds 1-2, as returned: all nine lenses reported I17, I18, I20, I21, I22 and I24
addressed, and I19's reversal of I8 justified. `review-code-quality` qualified I20 and I24 as not
fully closed on wording alone (its four should-fixes below). Eight lenses explicitly judged I4's
retained scope justified by M4-M7/M9 and the named production callers; `review-plan`, the
fresh-context architecture judgement rule 12a asks for on a returning dispute, is among them.
`review-chess-semantics`, `review-error-handling`, `review-root-cause`, `review-persisted-state`,
`review-plan` and `review-correctness` each judged I23's upgrade-boundary rejection sound.

| ID | Claim | Witnesses (confidence) | Disposition | Obligation / evidence |
| --- | --- | --- | --- | --- |
| I25 | The correction packet names dependent acceptance case A4, which no longer exists, so the `setHeaders` rebuild branch has no closure criterion | plan 99 | **Fix — in the prompt, not the plan** | A defect in the round-3 review packet: A4 was folded into A8 when `reset` merged into O3, and the CORRECTION CHECK line was not updated. The plan text is unaffected. The round-4 packet names A3, A6 and A8 and states that A4 no longer exists |
| I26 | `setHeaders({...headers, fen: ""})` skips installation through the truthy guard and leaves `headers.fen` inconsistent with the root | plan 96 | **Fix — by narrowing the claim, with the trace** | Traced rather than fixed: `GameInfo` has no FEN field, every other caller spreads an existing `headers`, and both `defaultTree` and `getPgnHeaders` (`chess.ts:534`) write a non-empty FEN — only a PGN with a literal `[FEN ""]` tag produces one, and it arrives through `setState`. O3 now says the guard keeps its truthy test and states the contract for a non-empty FEN, with that trace |
| I27 | The changed-FEN `setHeaders` tests never assert `position === []`, although O3 requires it | plan 94, tests 91 | **Fix** | Phase 1 now asserts all four values for that branch, with the reason: `getNodeAtPath` truncates a stale cursor silently, so an implementation clearing only the headers and the practice path would pass |
| I28 | The final gates omit `git diff --check` and `env -u KIT_ROOT pnpm findings:kit:check`, both required on every push | plan 99, 99 | **Fix** | Confirmed against `.claude/skills/push/SKILL.md` ("Findings ledger", "Commit, push, and verify"). Both added, with a line saying why the kit check exists |
| I29 | O3 expands the mandate; the smallest sufficient plan is O1/O2 plus `setFen`, filing M7/M9/M10 separately | minimalism 88 | **Skip — rejected, third disposition of the I4 dispute** | The claim concedes the defects are real and argues only that reachability is not mandate scope. The MANDATE obligation and its evidence are in `## Scope and the adoption gate`: an incomplete closure of this exact class is what produced these three findings. Rule 12a's remedy for a returning dispute was applied — a focused fresh-context judgement through `review-plan`, which in this same round judged the retention justified, as did seven other lenses. Recorded, not reopened |
| I30 | "A fourth tracked path later is one entry" is speculative extensibility | minimalism 93 | **Fix** | Sentence removed; the shared rebasing step stands on the six current copies alone |
| I31 | Four wording defects: "outside this store's actions" mislabels `makeMove`; "no mutation writes a stale `practicePath` at all" overstates; O3's "one implementation" and "the last of them" are wrong now that only two actions share a helper; "everything else comes from `tree` and is not reinterpreted" contradicts the `boardStateMap` wrapper | code-quality 98, 93, 95, 91 | **Fix** | All four corrected; `setState`'s row now names the `withTranspositionMaps` exemption explicitly (`tree.ts:166-181`) |
| I32 | O1's tests have no sibling-order anchors — no practice path before a deleted sibling or after a promoted one — so an unconditional-shift or `>=` mutant stays green | tests 94 | **Fix** | Phase 2 gained both directions for both mutations, with that reason |
| I33 | The padded-FEN follow-up asserts FEN values only, which passes even when the header edit rebuilt the root and discarded the move | tests 93 | **Fix** | That assertion is now structural: the root object must be the one the installation produced and must still carry the move's child |
| I34 | The advance fixture has a non-zero index only at depth zero, so an implementation that consults the path for the first step and then takes child `0` passes | tests 88 | **Fix** | Phase 3's fixture is now `practicePath = [1,1]` with branching at both levels |

Open after round 3: none. Substantive corrections needing an explicit closure check against r4:
I26, I27, I28, I30, I31, I32, I33, I34. I25 is a packet correction with no plan delta.

### Round 4 — revision r4, 2026-09-22, executor codex, the same 9 lenses

Raw verdicts: `review-plan` **REVISE** · `review-tests` **REVISE** · `review-chess-semantics`
**REVISE** · `review-persisted-state` **REVISE** · `review-minimalism` **APPROVED** ·
`review-correctness` **APPROVED** · `review-root-cause` **APPROVED** · `review-code-quality`
**APPROVED** · `review-error-handling` **APPROVED**.

Reports: `$RUN_TMP/r4-lens-*.txt`. Same standing limitation: no lens ran Vitest under the read-only
rails; all relied on the recorded M1-M10 measurements and on source tracing.

Closure results as returned: I27, I28, I30, I31, I32 and I34 closed by every lens that spoke to them;
I26 closed by seven lenses and left open by `review-plan` alone, on the A6 wording rather than the
plan text; I33 reported unclosed by `review-plan`, `review-tests`, `review-chess-semantics` and
`review-code-quality` for one reason, recorded as I35 below. `review-minimalism` recorded that the
O3 scope dispute is not reopened. `review-root-cause` recorded that `b82021ec` is completed rather
than reintroduced.

| ID | Claim | Witnesses (confidence) | Disposition | Obligation / evidence |
| --- | --- | --- | --- | --- |
| I35 | Round 3's I33 correction is itself wrong: the structural assertion captures the root produced by the installation, but `makeMove` mutates the root and Immer clones it, so a correct implementation would fail it | chess-semantics 98, tests 98, code-quality 95, plan 93 | **Fix** | Consistent with the plan's own M8, which the lenses cited. Phase 1 now says to capture the root and the move's child **after** the move and to assert identity across the unrelated header edit, and says why the other sequencing rejects the correct implementation |
| I36 | Acceptance case A6 still says "a changed `fen`" while r4 narrows the contract to a non-empty one | plan 94 | **Fix — in the packet, not the plan** | A packet defect like I25: the plan text was narrowed in r4 and A6 was not. The round-5 packet states A6 for a changed, **non-empty** FEN and repeats the empty-FEN trace |
| I37 | Phase 2's fixtures are root-level only, so an implementation that inspects only index 0 of the path passes; `practicePath = [0,2]` with `deleteMove([0,1])` would stay stale | tests 95 | **Fix** | Both helpers compare against the mutation's parent depth, so the lens is right that a root-level fixture cannot see a depth defect. The matrix now runs under a nested parent, with the root-level case kept as the degenerate check |
| I38 | Phase 2 repeats two cases the new matrix already covers | minimalism 96 | **Fix** | Folded: one four-case matrix per mutation, with M1 and M2 named as two of its cases rather than listed twice |
| I39 | `write`/`flush` validate nothing while `read` enforces `MAX_TREE_DEPTH`/`MAX_TREE_NODES`, so an over-deep tree is written, then rejected and **deleted** on read, and the tab rehydrates blank | persisted-state 96 | **Defer — filed `f-20260922-11`** | Confirmed by reading the writer, the flush, `decodeLegacyOrCompressed`, `parseTree`, `isBoundedTreeForStorage` and `read`'s `removeItem`. A writer/reader asymmetry in the storage layer, not path rebasing; outside MANDATE |

Open after round 4: none. Substantive corrections needing an explicit closure check against r5:
I35, I37, I38. I36 is a packet correction with no plan delta.

### Round 5 — revision r5, 2026-09-22, executor codex, 5 lenses

Scope: the round-4 delta touched only Phase 1 and Phase 2, so `review-plan` (mandatory) plus the four
lenses whose findings drove those corrections — `review-tests`, `review-chess-semantics`,
`review-code-quality`, `review-minimalism` — were re-run. No newly applicable domain lens: the four
that were APPROVED in round 4 and whose sections are SETTLED (`review-correctness`,
`review-root-cause`, `review-error-handling`, `review-persisted-state`) had no changed obligation.

Raw verdicts: `review-plan` **REVISE** · `review-tests` **REVISE** · `review-chess-semantics`
**REVISE** · `review-minimalism` **APPROVED** · `review-code-quality` **APPROVED**.

Reports: `$RUN_TMP/r5-lens-*.txt`. Same standing limitation on Vitest under read-only rails.

Closure results as returned: I35 and I37 closed by every lens that spoke to them. I38 closed by
`review-minimalism`, `review-tests` and `review-code-quality`; `review-chess-semantics` reported it
**not** closed, for the reason recorded as I40.

| ID | Claim | Witnesses (confidence) | Disposition | Obligation / evidence |
| --- | --- | --- | --- | --- |
| I40 | Folding the cases in round 4 dropped M1's actual case — a `practicePath` *inside* the promoted branch. A rebase that shifts only the other siblings passes every listed row. `M1's shape` was also mislabelled: M1 promotes the branch the path addresses, not a sibling of it | tests 99, code-quality 99, chess-semantics 98 | **Fix** | The lenses are right and round 4's fold was wrong. Phase 2 now carries a six-row table covering all three branches of `rebasePathAfterPromotion` and all three of `rebasePathAfterDelete`, with the expected result and the mutant each row catches, and names M1 and M2 as rows 4 and 2 |
| I41 | "`promoteToMainline` inherits the rebase" is prose, not an assertion; a regression in the wrapper's loop passes every single-step case | tests 94 | **Fix** | Replaced by a concrete deep case: `practicePath = [0,2,0]`, `promoteToMainline([0,2])`, ending at `[0,0,0]` on the same node with `position` and `headers.start` agreeing |
| I42 | The empty-FEN exclusion is **false**: a `[FEN ""]` tag survives `getPgnHeaders` because `??` does not fall through for `""`, the root is built as `INITIAL_FEN`, `PgnInput` hands that to `setState`, and every later `GameInfo` edit carries the empty FEN through the falsy guard | plan 96 | **Fix — the plan's trace was wrong; the defect is filed** | Traced end to end and the `??` behaviour measured (`("" ?? "INITIAL")` is `""`). O3 now records the route instead of denying it. The defect itself is in `src/utils/chess.ts:534`, not in the store, and is filed as **`f-20260922-12`**; fixing it removes the only producer of an empty `headers.fen`. This plan's contract stays stated for a non-empty FEN and the guard is unchanged |
| I43 | A7 requires a no-op when the cursor is *longer* than `practicePath`, but Phase 3 tests only equal and shorter cursors; a `===` guard would pass while a longer cursor falls into the transposition fallback | plan 94 | **Fix** | Phase 3 gained a longer-cursor row on a childless node that transposes, which is exactly the path a `===` guard leaves open |
| I44 | The off-path row does not require the node at `[0]` to have a child, so a reverted length-only implementation also leaves the cursor alone — for the wrong reason | tests 91 | **Fix** | The row now requires a child at `[0]`, with that reason stated |
| I45 | The nested promotion fixture was underspecified — "likewise under `[0]`" — and `threeBranchStore` has only one child there | code-quality 94 | **Fix** | The table gives the fixture shape (node `[0]` with at least four children, each with one child) and the exact path and operation per row |

Open after round 5: none. Substantive corrections needing an explicit closure check against r6:
I40, I41, I42, I43, I44, I45.

### Round 6 — revision r6, 2026-09-22, executor codex, 6 lenses

Scope: `review-plan` plus the four lenses whose round-5 findings drove corrections
(`review-tests`, `review-chess-semantics`, `review-code-quality`, `review-minimalism`), and
`review-correctness` added because O3's changed paragraph and the rewritten Phase-2 matrix are its
class. `review-root-cause`, `review-error-handling` and `review-persisted-state` had no changed
obligation.

Raw verdicts: `review-plan` **REVISE** · `review-chess-semantics` **REVISE** · `review-tests`
**REVISE** · `review-correctness` **APPROVED** · `review-code-quality` **APPROVED** ·
`review-minimalism` **APPROVED**.

Reports: `$RUN_TMP/r6-lens-*.txt`. Same standing limitation on Vitest under read-only rails.

Closure results as returned: I40, I42, I43, I44 and I45 closed by every lens that spoke to them.
I41 reported **not** closed by all six, for one reason, recorded as I46.

| ID | Claim | Witnesses (confidence) | Disposition | Obligation / evidence |
| --- | --- | --- | --- | --- |
| I46 | The round-5 `promoteToMainline` case cannot test the wrapper: `[0,2]` has one non-zero index, so the loop runs once and a one-shot implementation passes. "`position` and `headers.start` agree" also has no expected values — a test leaving all three at `[]` would pass | plan 99, chess-semantics 99, correctness 99, tests 99, code-quality 94 | **Fix** | Both halves adopted. The case is now `practicePath = [0,2,1]` with `promoteToMainline([0,2,1])` on a fixture where `[0,2]` has at least two children, so the loop must run twice; and all three tracked paths are given explicit start and end values (`[0,2,1]` → `[0,0,0]`) rather than "agree" |
| I47 | Every matrix path sits under the mutation's own parent `[0]`, so `rebasePathAfterDelete`'s `isPrefix(deleted.slice(0,-1), target)` and `rebasePathAfterPromotion`'s `!isPrefix(parent, target)` guards are never exercised; a rebase that shifts an unrelated branch passes every row | plan 96, tests 93 | **Fix** | The fixture gains a second root branch `[1]`, and rows 7 and 8 require `practicePath = [1,0]` to be untouched by a delete and by a promotion under `[0]`. The optional root-level fixture is dropped in the same edit (I51) |
| I48 | Phase 3's equal-length endpoint is not required to have a child, so its no-op may come from an empty transposition fallback rather than from the guard | plan 94, tests 88 | **Fix** | The advance row now requires a child at `[1,1]`, with the reason: today's guard sits inside the `children.length > 0` branch, so a childless endpoint stops for the wrong reason |
| I49 | "Universal rule 11" is misnumbered; the extraction rule is rule 3 in the supplied contract | code-quality 97 | **Skip — rejected with evidence, and the citation improved** | The lens's rule files were the project's `CLAUDE.md` and `.claude/rules/*`; `~/.claude/CLAUDE.md`, where universal rule 11 lives, was not among them, so it matched against a different document. The number is right. The citation now quotes the rule's text as well, so a reader without that file can check it |
| I50 | The first three final gates are unconditional, not members of the push skill's `src/**` frontend row | code-quality 98 | **Fix** | Provenance split in the gate block's lead-in |
| I51 | The optional root-level delete fixture is unnecessary beside the complete nested matrix | minimalism 91 | **Fix** | Dropped; rows 7 and 8 cover the unrelated-branch case more directly, and this file's existing cursor and start-header tests already carry the root-level shape |

Open after round 6: none. Substantive corrections needing an explicit closure check against r7:
I46, I47, I48, I50, I51.

### Round 7 — revision r7, 2026-09-22, executor codex, the same 6 lenses

Raw verdicts: `review-plan` **REVISE** · `review-chess-semantics` **REVISE** · `review-tests`
**APPROVED** · `review-correctness` **APPROVED** · `review-code-quality` **APPROVED** ·
`review-minimalism` **APPROVED**.

Reports: `$RUN_TMP/r7-lens-*.txt`. Same standing limitation on Vitest under read-only rails.

Closure results as returned: I48, I50 and I51 closed by every lens that spoke to them. I46 closed by
four lenses and left open by `review-correctness` on the fixture contradiction (I54). I47 closed by
`review-tests`, `review-code-quality` and `review-minimalism`, and reported **not** closed by
`review-plan` and `review-chess-semantics` for the reason recorded as I52 — which is correct and is
the sharpest finding of the round.

| ID | Claim | Witnesses (confidence) | Disposition | Obligation / evidence |
| --- | --- | --- | --- | --- |
| I52 | Row 7 does not exercise the guard it was added for: with target `[1,0]` and `deleteMove([0,2])`, the helper's `target[parentDepth] > deleted[parentDepth]` test is `0 > 2` — false — so the row passes even with the prefix check deleted | plan 99, chess-semantics 99 | **Fix** | Both rows now use `[1,3,0]`: an index at the mutation's depth that **exceeds** the deleted one for row 7, and a target **longer** than the promotion's parent for row 8, since otherwise the `target.length <= parent.length` test answers first. The fixture gives `[1]` the same four-child shape, and the table's "what it catches" column now names both traps |
| I53 | The goal promises all four fields coherent for every new-root operation, but O3 has `setState` preserve the supplied fields and clear only `practicePath` | code-quality 95 | **Fix** | The goal now distinguishes the two that build a root from a FEN from the two that install a whole state object, and says why `practicePath` is the only field the latter owe |
| I54 | The fixture says each `[0]` child has one child, while the `promoteToMainline([0,2,1])` case needs `[0,2]` to have two — taken literally the proof cannot run | code-quality 98, correctness 91 | **Fix** | The fixture now says at least four children on both `[0]` and `[1]`, at least one grandchild each, and names `[0,2]` as needing two |
| I55 | `setFen("")` asserts FEN equality only; a cleanup written inside a truthy-FEN branch would pass while leaving `headers.start` and `practicePath` set | tests 96 | **Fix** | The case now seeds both and asserts they clear |
| I56 | No row covers a `practicePath` equal to or above the mutation's parent, so the `target.length` guards in both helpers are unanchored | tests 92 | **Fix** | Row 9 added: `practicePath = [0]` under both mutations, unchanged. Asserted by path value, because `[0]` is the mutated node and Immer clones it (D4/M8) |

Open after round 7: none. Substantive corrections needing an explicit closure check against r8:
I52, I53, I54, I55, I56.

### Round 8 — revision r8, 2026-09-22, executor codex, 5 lenses

Scope: `review-plan` plus the lenses whose round-7 findings drove corrections — `review-tests`,
`review-chess-semantics`, `review-code-quality`, `review-correctness`. `review-minimalism` had
returned APPROVED with no finding and no changed obligation of its class.

Raw verdicts: `review-plan` **REVISE** · `review-tests` **REVISE** · `review-chess-semantics`
**APPROVED** · `review-correctness` **APPROVED** · `review-code-quality` **APPROVED**.

Reports: `$RUN_TMP/r8-lens-*.txt`. `review-chess-semantics` named the sandbox refusal explicitly
this round (`EROFS` on Vite's temp file); the limitation is the same one every round has carried.

Closure results as returned: I53, I54, I55 closed by every lens that spoke to them; I56 closed by
`review-chess-semantics` and `review-correctness` and qualified by `review-tests` (I58 below); I52
closed by `review-chess-semantics` and `review-correctness` and reported **not** closed by
`review-plan` and `review-tests`, for the reason recorded as I57.

| ID | Claim | Witnesses (confidence) | Disposition | Obligation / evidence |
| --- | --- | --- | --- | --- |
| I57 | Round 7's fix for row 8 is still ineffective: with `[1,3,0]` and `promoteVariation([0,2])` the sibling index is `3`, which no branch of the shifting rule moves, so deleting `!isPrefix(parent, target)` still returns the unchanged path | plan 99, tests 99 | **Fix** | Correct, and it is the second time this row was wrong for a different reason — the two helpers guard in different orders. Row 8 now uses `[1,2,0]`, whose index equals the promoted one, so removing the guard yields `[1,0,0]`. The "what it catches" column now states both conditions and why row 7's target satisfies only one of them |
| I58 | Row 9 cannot distinguish the removal of either `target.length` guard: a one-element target makes the length test false and `target[parentDepth]` `undefined`, so a mutant stays green | tests 96 | **Fix — kept, relabelled honestly** | The lens is right about the mechanics. The row is kept because A1 states the property and a later refactor could break it where no other row looks, but it is no longer presented as a branch anchor: the table says it is a contract anchor, says no single-guard mutant distinguishes it, and requires the test to say so too |
| I59 | Row 3's description mislabels its target: `[0,2,0]` starts inside the deleted subtree; only its clamped result is the mutated parent | code-quality 99 | **Fix** | The identity paragraph now separates the starting target from the expected result for row 3 |
| I60 | The Goal's "supplied fields stand as given" contradicts O3's derived-state exemption for `boardStateMap` | code-quality 96 | **Fix** | The Goal now names derived state as outside that sentence in every case |
| I61 | "At the mutation's depth" is imprecise; the compared index is at `parentDepth`, the deleted node's sibling slot | code-quality 95 | **Fix** | Row 7's wording uses the helper's own term and points at the position in the path |

Open after round 8: none. Substantive corrections needing an explicit closure check against r9:
I57, I58, I59, I60, I61.

### Round 9 — revision r9, 2026-09-22, executor codex, 3 lenses

Scope: `review-plan` plus the two lenses whose round-8 findings drove corrections, `review-tests`
and `review-code-quality`. The round-8 delta touched only the Goal and Phase 2's matrix.

Raw verdicts: `review-plan` **APPROVED** · `review-tests` **APPROVED** · `review-code-quality`
**APPROVED**.

Reports: `$RUN_TMP/r9-lens-*.txt`. All three reported I57-I61 closed. `review-plan` recorded that
`d95dbcda` — the commit the measurements were taken at — is an ancestor of HEAD with no relevant
source change since, so the supplied probes still describe the tree.

| ID | Claim | Witnesses (confidence) | Disposition | Obligation / evidence |
| --- | --- | --- | --- | --- |
| I62 | "One matrix per mutation" does not describe a table that combines both mutations, with row 9 combining both operations | code-quality 97 | **Fix — typographical, no re-review** | One heading phrase, changed to "one matrix, covering every branch of both rebasing rules". No row, expected value, fixture, assertion or proof command changes, so under rule 12a this edit does not require another lens pass; that judgement is recorded here |

### Round 10 — revision r10, 2026-09-22, executor codex, 6 lenses — coverage round

Not a correction round: no issue was open. Every lens had APPROVED at some revision, but six of them
had approved a revision older than the final text, and rule 12a requires coverage of the final
revision rather than a carried-forward approval. Each was given the cumulative delta from the
snapshot it had last approved — r4 for `review-root-cause`, `review-error-handling` and
`review-persisted-state`; r7 for `review-minimalism`; r8 for `review-correctness` and
`review-chess-semantics` — and asked to judge the final text in its own class.

`review-plan`, `review-tests` and `review-code-quality` were not re-run: the only change since their
round-9 APPROVED is I62's heading phrase, recorded above as semantics- and proof-neutral.

Raw verdicts: `review-root-cause` **APPROVED** · `review-error-handling` **APPROVED** ·
`review-persisted-state` **APPROVED** · `review-minimalism` **APPROVED** · `review-correctness`
**APPROVED** · `review-chess-semantics` **APPROVED**. No findings from any of the six.

Reports: `$RUN_TMP/r10-lens-*.txt`.

## Review closure

**Every one of the nine lenses has APPROVED the final revision**: six over r10 in the coverage round,
three over r9 where the only subsequent change is I62's heading phrase. No issue is open, every issue
I1-I62 carries an explicit disposition in the tables above, and every adopted substantive correction
has a recorded closure result from at least one lens against the revision that followed it.

Nothing was deferred to force closure. The seven items dispositioned `Defer` or `Skip` are on disk:
`f-20260922-08` (`makeMove` and `headers.start`), `f-20260922-09` (tab-close orphan),
`f-20260922-10` (rehydration does not validate paths), `f-20260922-11` (storage writer/reader depth
asymmetry), `f-20260922-12` (a `[FEN ""]` tag survives into `headers.fen`), plus the two rejections
recorded with their evidence — I4/I29 (the O3 scope dispute, dispositioned three times including the
fresh-context judgement rule 12a prescribes) and I49 (a rule-number mismatch caused by a rule file
the lens did not have).

Metrics. Ten completed rounds, r1 through r10, all on 2026-09-22, no pauses: first lens launched
13:23, last report 16:22 — **2 h 59 min**, all of it active. No rewrite and no split: the mandate and
the obligation set stayed continuous, and the heading structure changed once, when O3/O4/O5 merged
into one root-installation contract in r3. Lens invocations: 9+9+9+9+5+6+6+5+3+6 = 67.
`plan_adopted_per_round`: r1=15 r2=7 r3=8 r4=4 r5=6 r6=5 r7=5 r8=5 r9=1 r10=0.
Unique issues opened 62, of which withdrawn later 0; resolved by adoption 55; rejected with evidence
2 (I4/I29 counted once, I49); deferred and filed 5 (I3, I16, I39, I42's defect, and I2's `setState`
half, which was later **refuted** and adopted instead — see I17). Two packet-only defects, I25 and
I36, changed no plan text. Open at closure: 0.
