# Plan-review record — f-20260922-08, f-20260922-10 (insert rebase, rehydration path check), on top of f-20260922-04

Durable record of a plan review that is **approved and not yet implemented at the time of writing**.
`tasks/plans/` is gitignored, so this file is the surviving copy of the plan and its complete review
history; everything below the rule is `tasks/plans/2026-09-22-tree-path-insert-and-rehydrate.md`
verbatim at closure.

## Why this record exists

Seven rounds in one interactive session (`a95e5516-d50e-4b9f-b071-0edb2ab49537`), orchestrated by
Claude Code with `codex` as the executor for every lens, on 2026-09-22 between 22:35 and 23:58.
Felix asked for the plan review to run while another session (`a4bd0dbf…`, `f-20260906-23`) held the
build lock and was implementing, and for implementation to wait until that session had pushed.
The plan **includes** the already-approved plan for `f-20260922-04` (O1-O3, Phases 1-3), whose
own record is `tasks/handoffs/2026-09-22-practice-path-rebasing-review.md` — load both.

## Inherited issue IDs

This review's IDs are I1-I24 (all closed). The O1-O3 plan's IDs I1-I62 live in its own handoff and are
a separate namespace. The dispositions a successor must not relitigate without new evidence:

* **I4 / D11** — O5 corrects the stored path rather than deriving an effective value; a kept stale
  path resurrects onto an unrelated node when the tree grows.
* **I18** — a persisted root/`headers.fen` mismatch cannot cross the upgrade: `sessionStorage` does not
  survive the relaunch.
* **I23** — no store-API sequence leaves `position` through a shifted child during a prepend.

## Findings filed out of this review

`f-20260922-13` (I12, I13) and `f-20260922-14` (I16's `void warn` half).

---

# Plan: close the `tree-path-rebasing` cluster — implement the approved O1-O3, add the insert rebase and the rehydration check

Plan path: `tasks/plans/2026-09-22-tree-path-insert-and-rehydrate.md`.

## Goal

Close all three open members of `Root: tree-path-rebasing`:

* `f-20260922-04` (with its duplicates `f-20260914-26`, `f-20260914-27`) — **already planned and
  approved** by nine lenses over ten rounds. That plan is frozen and is carried here unchanged as
  obligations O1-O3 and Phases 1-3; its only surviving copy is
  `tasks/handoffs/2026-09-22-practice-path-rebasing-review.md` (sections `## Approach` through
  `## Phases`), with the working copy at `tasks/plans/2026-09-22-practice-path-rebasing.md`. It is
  **not** re-reviewed here, except where O4 or O5 depends on it.
* `f-20260922-08` — `makeMove` under `mainline: true` prepends a child with `unshift`, renumbering every
  existing sibling at that depth, and rebases no tracked path. New obligation **O4**.
* `f-20260922-10` — rehydration validates the *shape* of persisted paths but never that they resolve
  in the restored root; `getNodeAtPath` then silently truncates. New obligation **O5**.

After this change, across every sibling-renumbering mutation of the tree store (delete, promote,
prepend), a tracked `number[]` path (`position`, `headers.start`, `practicePath`) whose node survives
still addresses that node, and one whose node was deleted is clamped or cleared exactly as O1 prescribes
(never left addressing a sibling). A cursor that a mutation deliberately *moves*, such as `makeMove`
with `changePosition`, is outside this sentence. No persisted path that fails to resolve in its own
restored root reaches a store.

**MANDATE (fixed for every review round):** *every tracked path survives every sibling-renumbering
mutation of the tree store (delete, promote, prepend), and a persisted path that no longer resolves in
the tree it is restored with is repaired at the storage boundary rather than trusted.* The first half
is `.claude/rules/chess-tree-semantics.md`'s single rule ("a `number[]` path is re-derived after any
mutation that can insert, delete, promote or reorder nodes"); the second is
`.claude/rules/persisted-state.md`'s "hydration of corrupt or absent data".

## Measurements

| # | Sequence | Observed | Source |
| --- | --- | --- | --- |
| M11 | root with one child `e4`, `headers.start = [0]`; `makeMove({ payload: parseUci("d2d4"), mainline: true, changePosition: false })` from the root | children `d4,e4`; `headers.start` still `[0]`, now addressing **`d4`** | `f-20260922-08`, reproduced against the real store 2026-09-22 |
| M12 | `getNodeAtPath(root, path)` with an index past `children.length` | returns the deepest node reached, no error | `src/utils/treeReducer.ts:191-200`, read |
| M13 | `parseStartHeader(start, root)` (`src/utils/chess.ts:482-492`) | already walks a path against a root and returns `[]` on the first index that does not resolve — the PGN-import precedent for an unresolvable start | read |
| M14 | every production reader of persisted tree storage | all go through `parseTree` (`tabStorage.ts:196-201`) via `read` → `decodeLegacyOrCompressed`, `seed`, or `validatedClone`; the only bypass is `read`'s in-session `pending` map, which holds values this session's own store or a `validatedClone` wrote | grep of `tabStorage.(read\|seed\|clone\|cloneDurable)` and `decodeLegacyOrCompressed`, 2026-09-22 |
| M15 | `read` rewrites storage whenever `raw !== serializeStorageValue(decoded)` | a repaired value is therefore written back once, without new code | `tabStorage.ts:276-282`, read |
| M16 | `makeMove`'s `unshift` branch, `changePosition` true | pushes `0` onto `state.position` **only if `state.position === position`** (reference identity on the draft); otherwise assigns `[...position, children.length - 1]` — the *last* index, which after an `unshift` is the wrong node | `tree.ts:746-755`, read |
| M17 | `mainline: true` callers | `BoardGame.syncTreeWithMoves` (`BoardGame.tsx:437-439`) and `Puzzles.tsx:844-846` call the store's `makeMove` action directly; `PuzzleBoard.tsx:98-100` calls `makeMoves`. Both store actions call the module-level `makeMove` with `last: false`; only `appendMove` passes `last: true`, and it never passes `mainline` | grep, 2026-09-22; corrected in r2 (I3) |
| M18 | mutation packages | `src/state/store/tabStorage.ts` is in `workspace-storage`, `src/utils/treeReducer.ts` in `tree-path` (`scripts/frontend-mutation-packages.mjs:6-7`); `tree.ts` and `chess.ts` are in none | read |

## Approach

### O1-O3 — inherited, frozen

Exactly as written in the handoff's `## Approach`. One consequence O4 relies on: O1 introduces **one
rebasing step per mutation** that routes all three tracked paths, with a per-path fallback, and widens
the mutation functions' state parameter from `TreeState` to a type carrying `practicePath`.

### O4 — a mainline prepend rebases every tracked path

`makeMove`'s `if (mainline) moveNode.children.unshift(newMoveNode)` shifts every existing child of
`moveNode` up by one. Required behaviour, in the branch that actually inserts (not when the move
already exists as a child, which mutates nothing):

* Every tracked path — `state.position`, `state.headers.start` when set, `state.practicePath` when not
  `null` — that runs **through** a child of `moveNode` (i.e. has the parent path as a proper prefix)
  has its index at depth `parentPath.length` increased by one. Paths that do not pass through
  `moveNode`'s children, including `moveNode`'s own path and its ancestors, are unchanged.
* The shift rule is its own rule — an insertion only ever *adds* a sibling, so it has no fallback and
  no clamp. It goes through the **same per-mutation rebasing step O1 introduces**, as its third
  mutation, not through a new copy of the three-path assignment. The finding's note that
  `rebasePathAfterPromotion` is "not the right helper" stands: expressing a prepend as "push, then
  promote the last index" is arithmetically equivalent but names the wrong operation, and the
  reader of a later bug would have to re-derive that equivalence.
* `null` stays `null`, `undefined` stays `undefined`; no path is invented.
* **Ordering and identity constraint (M16).** The rebase runs in the inserting branch *after* the
  `unshift` and *before* the `changePosition` block, and the step must not replace `state.position`
  with a new array when the rule leaves it unchanged. Today's code decides between `push(0)` and
  `[...position, children.length - 1]` by reference identity; a rebase that reassigned an unchanged
  cursor would send a mainline move with `changePosition` to the **last** child instead of the new
  first one. Under M17, `state.position` *is* the parent path whenever `mainline` is set, so the rule
  never changes it — but the obligation is stated as "unchanged ⇒ same reference", because that is
  what the following block depends on.
* **Consequence for `position`, and for its tests (r6, I23).** Because every inserting call inserts
  under the node the cursor is on (`last: false` resolves the parent from `state.position`, M17), no
  sequence through the store's API can leave `position` running *through* a shifted child: the cursor
  is always the parent itself, which the rule leaves alone. `position` is still routed through the
  shared step — that is O1's single mechanism, and it keeps the three paths from drifting apart if a
  future caller inserts elsewhere — but its prepend obligation is observable only as "unchanged, same
  reference", which the `changePosition` rows pin. A "`position` through a shifted child" row cannot
  be constructed without calling the unexported module function directly, and is not added.
* `makeMoves` calls `makeMove` once per move; each call rebases for its own insertion, so a sequence
  that prepends at successive depths composes without special handling.

Ownership: the module-level `makeMove` function. Its state parameter widens to the same type O1
introduces for `deleteMove`/`promoteVariation`. The store actions `makeMove`, `makeMoves` and
`appendMove` gain no code of their own.

Failure semantics: none — pure index arithmetic on paths already known to resolve.

Dependency: **on O1** (the shared step and the widened type). Phase 4 therefore runs after Phase 2.

### O5 — a persisted path that does not resolve in its restored root is repaired at the storage boundary

`parseTree` (`tabStorage.ts:196-201`) is the single validator every persisted tree passes before it
reaches a store (M14). After the Zod parse succeeds, it checks each tracked path against the parsed
`root` and repairs it:

| Path | Repair when it does not fully resolve | Why this and not another |
| --- | --- | --- |
| `position` | the longest prefix that resolves | the cursor has a natural clamp, and it is what `getNodeAtPath` already displays — only now the stored value says so |
| `headers.start` | removed (`undefined`), never clamped | M13: PGN import already treats an unresolvable start as "no start" (`[]`); `deleteMove` clears it the same way. A clamped start would silently move the repertoire start to an ancestor the user never chose, and `buildTranspositionMaps` would widen to that subtree |
| `practicePath` | the longest prefix that resolves; `null` stays `null` | it guards the drill (O2). A clamped path is **narrower**: `goToNext` advances only while the cursor is a proper prefix of it, so a shorter path can only stop the drill earlier. Clearing it to `null` would **widen** the guard to unrestricted navigation and reveal the answer — the one outcome `f-20260922-10` names as unacceptable. This is D1's reasoning (clamp to a surviving ancestor) applied to the boundary |

A path that resolves in full is returned unchanged. The repair adds no logging (r2, I1: no MANDATE
obligation needs it, and seven lenses flagged it as added scope). It deliberately does **not** fail the
tab: the tree itself is valid, and a stale path — however consequential, for `headers.start` it narrows
`boardStateMap` and can later resolve onto an unrelated move — is repairable in place, whereas
discarding the whole game would turn a repairable inconsistency into data loss, the behaviour
`f-20260922-11` already reports as a defect for the depth bound.

**The repair is a correction of the stored value, not a derived effective value (D11).** The path and
the tree it indexes live in the same stored record, so there is no external context that could come
back and make the stale value right again — but there *is* a way for it to become wrong in a worse
way: a stale `headers.start = [0,5]` kept in storage starts resolving again the moment the user adds a
sixth reply under `[0]`, and then silently addresses that unrelated move. That is the exact failure
`.claude/rules/chess-tree-semantics.md` forbids. Correcting the stored value is what closes it.

**One path walker, not two.** `parseStartHeader` in `src/utils/chess.ts` already walks an untrusted
path against a root. Extract the walk into one exported helper in `src/utils/treeReducer.ts` (beside
`getNodeAtPath`) that answers *how many leading indices of this path resolve in this root*, accepting
untrusted element values (non-integer, negative, out of range all stop the walk). Route both
`parseStartHeader` and O5 through it; `parseStartHeader`'s observable behaviour (all-or-nothing, `[]`
on failure, the `> 512` length bound) is unchanged — it accepts the path only when the resolved length
equals the input length, and never returns the resolved prefix. `getNodeAtPath` is left alone — it is the hot
navigation reader and its truncating contract is relied on elsewhere.

Consequences that need no new code, and are asserted rather than built:

* `read` writes the repaired value back once (M15), so the stale value does not survive the next load.
* `seed`, `clone` and `cloneDurable` repair too, because they call `parseTree`; `validatedClone`
  round-trips through `decodeLegacyOrCompressed`.
* `onRehydrateStorage` rebuilds `boardStateMap` from the already-repaired `headers.start`, so the
  transposition map is no longer narrowed to a stale subtree.

Ownership: `parseTree` and the new helper. No change to `pathSchema`, `persistedTreeSchema`,
`TREE_STORAGE_VERSION`, `migrateTreeForStorage`, `onRehydrateStorage`, or `read`'s delete-on-failure
behaviour (that is `f-20260922-11`'s).

Dependency: none on O1-O4. File-disjoint from them except for tests.

## Decisions and trade-offs

* **D6 — O5 validates in `parseTree`, not in `onRehydrateStorage`.** Both would cover store
  rehydration (M14). `parseTree` is the storage boundary shared by `read`, `seed` and both clones, and
  only there does the repair get written back to storage (M15); `onRehydrateStorage` would repair the
  in-memory copy on every load and leave the stored value stale forever. Against it: `tabStorage.ts`
  sits in the `workspace-storage` mutation package (M18), so every new branch must be killed by a test
  — that is a test obligation (Phase 5), not a reason to move the code.
* **D7 — per-field repair semantics** as in O5's table. Rejected: one uniform rule. "Clamp all three"
  would move a repertoire start silently; "clear all three" would widen the drill guard; "reject the
  tab" discards a valid game over a stale index.
* **D8 — O4 extends O1's step rather than calling `rebasePathAfterPromotion(target, parent,
  oldLength)`.** Equivalent arithmetic, wrong name; see O4.
* **D9 — the prepend helper takes no inserted-index parameter.** The only insertion that shifts
  siblings inserts at index 0; `push` shifts nothing. A parameter for an index no caller passes is the
  speculative extension point `review-minimalism` exists to catch.
* **D10 — `f-20260922-10` is not closed as "latent once -08 ships".** After O1-O4 no known mutation
  writes a stale path, but the persisted-state rule is about the *boundary*, and the finding's own
  observation stands: rehydration is the one place a path and a tree meet with no mutation in
  between and no check. Unknown future mutations, and any tree a legacy envelope carries, are what the
  boundary check is for.
* **D11 — O5 corrects the stored path; it does not keep it and derive an effective value.** Raised by
  `review-persisted-state` (r1, I4) from `.claude/rules/persisted-state.md`'s "correct it with a
  derived effective value rather than a destructive reset". Rejected with the reasoning under O5: that
  rule's precedent (`35b0884f`, a puzzle theme) names an *external* context that can return; here the
  context is the same record, and a kept stale path can resurrect onto an unrelated node when the tree
  grows. Deriving at read would also have to be repeated in every reader of `headers.start` (six
  production sites, grep 2026-09-22).

## Risks / open questions

* **Mutation gate (M18).** New branches in `treeReducer.ts` and `tabStorage.ts` are mutated by
  `frontend-mutation`. Phase 5's tests are written row-per-branch for that reason; a surviving mutant
  is a missing test, fixed in this run.
* **Coverage ratchets.** `src/state/**` and `src/utils/**` areas; every new branch is driven by a test,
  so movement is upward. Never rewrite a baseline.
* **Performance.** The walk is O(depth) per path, three paths per parse, depth ≤ 512 — negligible next
  to the recursive Zod parse `parseTree` already does.

## Not part of this task

* `f-20260922-09` (tab-close ordering), `f-20260922-11` (writer/reader bound asymmetry, including
  `read`'s delete-on-failure), `f-20260922-12` (`[FEN ""]`), `f-20260922-13` and `f-20260922-14`
  (filed out of this review), and everything O1-O3's plan lists under its own
  `## Not part of this task` **except `f-20260922-08` and `f-20260922-10`**, which that plan excluded
  and this plan takes as O4 and O5.
* Any change to `getNodeAtPath`'s truncating contract, to `pathSchema`, or to the storage version.
* Any UI change. Nothing rendered changes; no snapshot may move.

## Phases

`src/state/**` is a Sensitive-Path glob in `.claude/skills/push/SKILL.md`; every phase touching it runs
at `--role sensitive`. Phases 1-3 are **verbatim** the handoff's `## Phases` (Phase 1 — root
installation (O3); Phase 2 — `practicePath` rebasing on the sibling mutations (O1); Phase 3 — the drill
boundary in `goToNext` (O2)), with their tests and proof commands exactly as written there. Order:
1, 2, 3, 4, 5 — Phase 4 depends on Phase 2; Phase 5 is independent and last only by choice.

### Phase 4 — the mainline prepend (O4)

* Production hunks: the module-level `makeMove` in `src/state/store/tree.ts`, and the O1 rebasing step
  it joins.
* Test file: `src/state/store/tree.test.ts`.
* Tests — nested fixture as in Phase 2 (root children `[0]`, `[1]`, each with at least **four**
  children, each grandchild with a child — the nested-delete rows below address `[0,3,0]`, which a
  three-child fixture would not contain, r3 I7; and `[0,0]` itself with at least **three** children,
  each with a child, for row 7, r5 I21), insertion under `[0]` by setting `position = [0]` and calling the
  store's `makeMove({ payload, mainline: true, changePosition: false })` with a move not yet among
  `[0]`'s children:

  | # | tracked path | Expected after the prepend | What it catches |
  | --- | --- | --- | --- |
  | 0 | **root prepend, M11 exactly:** `position = []`, `headers.start = [0]` and `practicePath = [1,0]` on the fixture; prepend a new move at the root | `headers.start` `[1]`, `practicePath` `[2,0]`, both on the same nodes (`toBe`); `position` still `[]` | the reported sequence, and a helper that mishandles an **empty** parent path (depth 0) — every other row inserts below `[0]` (r4, I15) |
  | 1 | `headers.start = [0,0,0]` | `[0,1,0]`, same node (`toBe`) | M11 at depth 1, at the lowest sibling index — a `>` instead of `>=` |
  | 2 | `practicePath = [0,2,0]` | `[0,3,0]`, same node | the practice half, and a shift applied to index 0 only |
  | 3 | `headers.start = [1,1,0]` | unchanged, same node | a missing parent-prefix check: index 1 of the path would shift if the check were dropped |
  | 4 | `practicePath = [0]` (the parent itself) | unchanged | an ancestor of the insertion must never move — contract anchor |
  | 5 | `practicePath = null`, `headers.start` absent | still `null` / absent | no path is invented |
  | 6 | `headers.start = [0,0,0]`, move **already** a child of `[0]` | unchanged | the rebase must sit in the inserting branch only |
  | 7 | insertion under `[0,0]` (`position = [0,0]`), `practicePath = [0,0,2,0]` | `[0,0,3,0]`, same node | a rule that works only at depth 0 or 1 (r5, I21) |
  | 8 | **non-mainline** insertion under `[0]` (`mainline` omitted, so `push`), `headers.start = [0,0,0]`, `practicePath = [0,2,0]` | both unchanged, same nodes | a rebase applied after `push`, which renumbers nothing (r5, I22) |

  Plus three `changePosition` rows, anchoring M16:
  * `position = [0]`, `makeMove({ …, mainline: true })` (default `changePosition`) — `position` ends
    `[0,0]`, and the node there is the **new** move (by `san`). A rebase that reassigned an unchanged
    cursor would end at `[0, n]`, the last child.
  * the same **at the root**: `position = []`, `headers.start = [0]`, `makeMove({ …, mainline: true })`
    — `position` ends `[0]` on the new move (by `san`), `headers.start` ends `[1]` on its old node
    (`toBe`). This is the `BoardGame`/`Puzzles` production shape (M17), and an empty parent path is the
    case a helper is most likely to special-case (r5, I20).
  * `makeMoves({ payload: [a, b], mainline: true })` from `[0]`, where `a` is new under `[0]` and `b`
    is new under `a`, with `headers.start = [0,0,0]` beforehand — `headers.start` ends `[0,1,0]` on
    the same node (shifted once, by the first insertion only), and `position` ends `[0,0,0]` on `b`.
  Plus, because O4 joins the shared rebasing step that O1 introduced and that step now carries
  `position` and `headers.start` as well (r2, I5): `deleteMove([0,2])` with `position = [0,3,0]` and,
  separately, `headers.start = [0,3,0]` — each ends `[0,2,0]` on the same node (`toBe`). Today's nested
  delete coverage exercises only `practicePath`; these two rows pin the other two paths through the
  step Phase 4 extends.
* PROOF COMMAND: `pnpm vitest run src/state/store/tree.test.ts src/utils/tests/store.test.ts`

### Phase 5 — the rehydration check (O5)

* Production hunks: the new walker in `src/utils/treeReducer.ts`; `parseStartHeader` in
  `src/utils/chess.ts` routed through it; `parseTree` in `src/state/store/tabStorage.ts`.
* Test files: `src/utils/tests/treeReducer.test.ts`, `src/utils/tests/chess.test.ts`,
  `src/state/store/tabStorage.test.ts`, `src/state/store/tree.hydration.test.ts`.
* Tests:
  * **walker**, one row per stop condition: full resolution; stop at an index equal to
    `children.length` (the `>=` boundary) and at one past it; stop at a negative index; stop at a
    non-integer (`1.5`) and a non-number (`"0"`); empty path → 0; a stop in the **middle** so that a
    walker returning a boolean or only checking the last index fails.
  * **`parseStartHeader`** — the existing test at `src/utils/tests/chess.test.ts:43-50` stays green
    unmodified, and gains the rows it lacks (r2, I2): with a root whose only child is childless,
    `parseStartHeader([0, 0], root)` is `[]` (an index valid at depth 1 followed by one that is not —
    an implementation returning the walker's resolved prefix yields `[0]`), and
    `parseStartHeader([0, 1.5], root)` is `[]` (an untrusted value in the middle). Two further rows
    (r5, I19): a **valid nested** path — on a root with a child that itself has two children,
    `parseStartHeader([0, 1], root)` is `[0, 1]`, so a refactor that rejects every multi-element path
    fails; and the **512 bound on a tree deep enough to matter** — on a single-line chain of 513 plies,
    `parseStartHeader(Array(512).fill(0), root)` returns all 512 indices and `Array(513).fill(0)` returns
    `[]`. The existing `Array(513)` row runs on a one-child tree, where the walk already fails at the
    second index, so it passes with the bound deleted.
  * **`parseTree` / `tabStorage.read`**, fixture root `e4 → e5` plus sibling `d4`:
    * `position = [0,0,5]` → `[0,0]`; `position = [2]` → `[]`.
    * `headers.start = [0,5]` → key absent; `headers.start = [0,0]` → unchanged.
    * `practicePath = [1,3]` → `[1]`; `practicePath = null` → `null`; absent → absent.
    * all three valid → the parsed value is deep-equal to the input **and** `read` does not rewrite the
      key (assert `sessionStorage.setItem` not called — the existing "current envelopes do not rewrite"
      shape), so the repair never fires on a healthy tree.
    * a repaired value is written back: after `read`, the raw stored value decodes to the repaired
      paths (M15).
    * `seed`, `clone` and `cloneDurable` of a tree with a stale `headers.start` each produce the
      repaired value at the target (for `clone`, read back through `tabStorage.read` of the target,
      which returns the pending copy — r2, I6).
  * **`tree.hydration.test.ts`**: a stored tree with a stale `headers.start` and a stale `position`
    rehydrates into a store whose `headers.start` is `undefined`, whose `position` is the clamped
    prefix, and whose `boardStateMap` contains the positions of the **whole** tree (a map built from
    the stale start would miss the sibling `d4`).
* PROOF COMMAND: `pnpm vitest run src/utils src/state/store`

### Final gates (after the last commit, clean tree)

As in the handoff's `### Final gates`, unchanged — `git diff --check`, `pnpm gates:contract:check`,
`env -u KIT_ROOT pnpm findings:kit:check`, `pnpm gate:ensure frontend-coverage`,
`pnpm gate:ensure frontend-mutation` (now covering Phase 5's branches in both mutated packages),
`pnpm gate:ensure frontend-build`, `pnpm bundle:check`, `pnpm gate:ensure e2e-container` with no
snapshot re-recorded. `./scripts/findings.py check` at closure.

## Reviews

### Round 1 — revision r1, 2026-09-22, executor codex, 9 lenses

Raw verdicts: review-plan REVISE · review-chess-semantics REVISE · review-persisted-state REVISE ·
review-tests REVISE · review-code-quality APPROVED · review-correctness APPROVED ·
review-error-handling APPROVED · review-minimalism APPROVED · review-root-cause APPROVED.

| ID | Claim | Witnesses (confidence) | Disposition | Evidence / correction |
| --- | --- | --- | --- | --- |
| I1 | O5's per-field `warn` and its warning-count tests are not required by MANDATE; also (error-handling) a fire-and-forget `warn` can reject unhandled and names no tab | plan (96), chess-semantics (99), persisted-state (98), tests (97), code-quality (97), correctness (98), minimalism (95), root-cause (97), error-handling (96, 91) | Fix — removed | Adoption gate: no MANDATE obligation fails without it. Removal also dissolves both error-handling findings. r2 O5 says "adds no logging" |
| I2 | `parseStartHeader` all-or-nothing is unpinned: a refactor returning the walker's resolved prefix (`[0]` for `[0,0]`) passes every planned row; plan also claimed treeReducer tests that do not exist | chess-semantics (98, blocker), tests (98, blocker), plan (98, blocker) | Fix | Existing test is `src/utils/tests/chess.test.ts:43-50` (read: no middle-invalid row). r2 adds `[0,0]` and `[0,1.5]` rows and states the "never return the prefix" contract in O5 |
| I3 | Wrong references: M17 said all `mainline` callers use `makeMoves` (BoardGame/Puzzles call `makeMove`); `parseTree` at 189-194 (is 196-201); `src/utils/treeReducer.test.ts` (is `src/utils/tests/treeReducer.test.ts`) | code-quality (100, 99, 100), plan (99) | Fix | Verified by grep 2026-09-22; M17, M14, M15, O5 and Phase 5 file list corrected. M17's conclusion (every mainline call is `last: false`) is unchanged — both store actions pass `last: false` |
| I4 | O5 destructively rewrites `headers.start`/`practicePath` and persists it; persisted-state rule prefers a derived effective value | persisted-state (95, blocker) | Skip — rejected with evidence | D11: the rule's precedent is an external context that can return; here path and tree are one record, and a kept stale `[0,5]` resolves again onto an unrelated node once a sixth reply is added under `[0]` — the chess-tree-semantics failure itself. Deriving at read would repeat in six `headers.start` readers |
| I5 | Nested delete coverage pins only `practicePath`; `position`/`headers.start` nested delete through the shared step is unpinned | tests (94) | Fix | Necessary verification for the step O4 extends. r2 adds two rows to Phase 4, without editing the frozen Phase 2 |
| I6 | Phase 5 asserts `clone` repair but tests only `seed`/`cloneDurable` | tests (87) | Fix | r2 adds a `clone` row read back through `tabStorage.read` |

Raw reports, verbatim:

#### lens-chess-semantics (r1)

```
[blocker] tasks/plans/2026-09-22-tree-path-insert-and-rehydrate.md:106 — The new prefix-length walker can change `parseStartHeader` from all-or-nothing to prefix acceptance, but Phase 5 keeps existing tests unchanged and lacks a middle-invalid route test. With root FEN `rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1` containing only `1. e4`, `parseStartHeader([0, 0], root)` must return `[]`; returning `start.slice(0, resolvedLength)` incorrectly yields `[0]` and narrows repertoire coverage to e4. (confidence: 98)

[nit] tasks/plans/2026-09-22-tree-path-insert-and-rehydrate.md:100 — The mandate requires stale persisted paths to be repaired before trust, but the plan additionally mandates a `warn` per repaired field with exact length details. For the `e4 → e5` plus `d4` fixture and stale `headers.start = [0,5]`, removing the path satisfies the mandate; logging is an extra side effect and acceptance criterion that should be optional or justified separately. (confidence: 99)

VERDICT: REVISE
```

#### lens-code-quality (r1)

```
[should-fix] tasks/plans/2026-09-22-tree-path-insert-and-rehydrate.md:41 — M17 incorrectly says all `mainline: true` callers use `makeMoves`; `BoardGame.tsx:437` and `Puzzles.tsx:844` call `makeMove` directly, while only `PuzzleBoard.tsx:98` uses `makeMoves` (confidence: 100)

[should-fix] tasks/plans/2026-09-22-tree-path-insert-and-rehydrate.md:90 — the cited `tabStorage.ts:189-194` range does not contain `parseTree`; the function is currently at lines 196-201, so this reference sends the next reader to the wrong code (confidence: 99)

[should-fix] tasks/plans/2026-09-22-tree-path-insert-and-rehydrate.md:210 — Phase 5 names nonexistent `src/utils/treeReducer.test.ts`; the existing sibling is `src/utils/tests/treeReducer.test.ts`, making the test ownership unnecessarily ambiguous (confidence: 100)

[should-fix] tasks/plans/2026-09-22-tree-path-insert-and-rehydrate.md:100 — O5 adds a per-field native warning contract and exact warning-count tests, although the fixed mandate requires repair only; remove this extra acceptance or explicitly justify the scope expansion (confidence: 97)

VERDICT: APPROVED
```

#### lens-correctness (r1)

```
[nit] tasks/plans/2026-09-22-tree-path-insert-and-rehydrate.md:100 — Requiring native `warn` calls and exact warning assertions is not required by the mandate; it adds observable behavior beyond repairing persisted paths. (confidence: 98)

VERDICT: APPROVED
```

#### lens-error-handling (r1)

```
[should-fix] tasks/plans/2026-09-22-tree-path-insert-and-rehydrate.md:100 — O5 adds fire-and-forget `warn` calls, but `@tauri-apps/plugin-log` returns a Promise that can reject when Tauri logging fails; the plan provides no catch, creating unhandled rejections during hydration. Tests mock `warn` as synchronous, so they miss this path (confidence: 96)

[should-fix] tasks/plans/2026-09-22-tree-path-insert-and-rehydrate.md:100 — Repair warnings include only field and path lengths, while `parseTree` receives no tab identifier. Failures across multiple tabs become indistinguishable in logs, and seed/clone repairs cannot identify their source (confidence: 91)

VERDICT: APPROVED
```

#### lens-minimalism (r1)

```
[nit] tasks/plans/2026-09-22-tree-path-insert-and-rehydrate.md:100 — per-field native `warn` logging and exact warning assertions are not required by the mandate; remove them and retain the repair/writeback tests (confidence: 95)

VERDICT: APPROVED
```

#### lens-persisted-state (r1)

```
[blocker] tasks/plans/2026-09-22-tree-path-insert-and-rehydrate.md:94 — O5 destructively deletes `headers.start` or rewrites `practicePath` to a prefix, then persists that change. A stale `[0,5]` start is lost and `boardStateMap` widens to the whole tree on reload, violating the rule to preserve stored intent and derive an effective value. (confidence: 95)

[nit] tasks/plans/2026-09-22-tree-path-insert-and-rehydrate.md:100 — Per-field native `warn` calls and exact warning-count tests expand the mandate beyond repairing paths at the storage boundary; remove or separately justify this added side effect. (confidence: 98)

VERDICT: REVISE
```

#### lens-plan (r1)

```
[blocker] tasks/plans/2026-09-22-tree-path-insert-and-rehydrate.md:210 — `src/utils/treeReducer.test.ts` does not exist; the actual test is `src/utils/tests/treeReducer.test.ts:1`, which is also omitted from the supplied file list (confidence: 99)

[blocker] tasks/plans/2026-09-22-tree-path-insert-and-rehydrate.md:217 — claims existing `parseStartHeader` tests remain green, but `src/utils/tests/treeReducer.test.ts:1-188` contains none. Walker tests cannot catch breaking its all-or-nothing and `>512` behavior in `src/utils/chess.ts:482-492` (confidence: 98)

[should-fix] tasks/plans/2026-09-22-tree-path-insert-and-rehydrate.md:100-104 — requiring one native `warn` per repaired field expands the fixed mandate; the persisted-state rule requires revalidation/correction (`.claude/rules/persisted-state.md:64-71`), not logging, and this side effect would also affect `seed`/clone paths (`src/state/store/tabStorage.ts:291-312`) (confidence: 96)

VERDICT: REVISE
```

#### lens-root-cause (r1)

```
[nit] tasks/plans/2026-09-22-tree-path-insert-and-rehydrate.md:100 — per-field `warn` logging and its acceptance tests are extra observable behavior not required by the mandate or root-cause repair; retain only if diagnostics are explicitly desired (confidence: 97)

VERDICT: APPROVED
```

#### lens-tests (r1)

```
[blocker] src/utils/tests/chess.test.ts:42 — `parseStartHeader` has no valid-prefix/invalid-middle assertion. A refactor returning the walker’s resolved prefix (`[0]` for input `[0,0]`) would pass all planned walker tests and current invalid-at-root cases while violating its all-or-nothing contract (confidence: 98)

[should-fix] src/state/store/tree.test.ts:27 — Nested delete coverage exercises only `practicePath`; `position` and `headers.start` are tested nested only for promotion. A delete-specific rebasing bug for either tracked path at `[0,3,0] → [0,2,0]` would pass the planned tests and root-level cases (confidence: 94)

[should-fix] src/state/store/tabStorage.test.ts:415 — Phase 5 claims `clone` repairs stale paths but adds tests only for `seed` and `cloneDurable`; the existing clone test checks only report metadata. Raw-copying a stale source into the pending clone could therefore slip through (confidence: 87)

[should-fix] tasks/plans/2026-09-22-tree-path-insert-and-rehydrate.md:100 — Exact per-field `warn` behavior is tested although it is not required by the fixed mandate; this adds observable diagnostic scope rather than proving path repair (confidence: 97)

VERDICT: REVISE
```


### Round 2 — revision r2, 2026-09-22, executor codex, 9 lenses

Raw verdicts: review-chess-semantics REVISE · review-error-handling REVISE · review-root-cause REVISE ·
review-code-quality APPROVED · review-correctness APPROVED · review-minimalism APPROVED ·
review-persisted-state APPROVED · review-plan APPROVED · review-tests APPROVED.

Closure of r1 corrections against r2: I1, I2, I3, I6 closed by all nine lenses. I5 closed by eight,
**not closed** by root-cause (its row is invalid on the stated fixture — see I7, which reopens I5's
evidence). I4 stays rejected; no lens brought new evidence.

| ID | Claim | Witnesses (confidence) | Disposition | Evidence / correction |
| --- | --- | --- | --- | --- |
| I7 | Phase 4's fixture has three children per node, but I5's rows address `[0,3,0]`, which would not exist — `getNodeAtPath` truncates and the row proves nothing | root-cause (100, blocker), code-quality (100) | Fix — correction-introduced by I5 (r2) | r3 fixture requires four children, matching Phase 2's. I5 closes with I7 |
| I8 | "cursor" / "cosmetic inconsistency" understates a stale `headers.start`, which the plan itself says narrows `boardStateMap` and can resolve onto an unrelated move | code-quality (92) | Fix | r3 O5 wording |
| I9 | D11 listed before D10 | code-quality (99, nit) | Fix | r3 reorders |
| I10 | Goal's "no mutation … leaves a tracked path addressing a different node" exceeds MANDATE and contradicts `makeMove` deliberately moving `position` | plan (98) | Fix | r3 Goal qualified to sibling-renumbering mutations |
| I11 | `appendMove`'s threefold check walks `state.position`, not the mainline it appended to | chess-semantics (95, blocker) | Skip — already filed | Same defect as open `f-20260914-28` (grep 2026-09-22); outside MANDATE (not a path-rebasing defect) and already listed under the inherited `## Not part of this task` |
| I12 | `makeMoves` returns from the producer after earlier moves mutated the draft, so an invalid move half-applies a sequence silently | error-handling (96, blocker) | Defer — filed `f-20260922-13` | Read `tree.ts:332-356`: `if (!m) return;` inside `produce` commits the draft. Outside MANDATE (no path is renumbered or restored stale); not required by O4, whose rebase runs per inserting call and is correct for whatever prefix was applied |
| I13 | "View solution" passes `parseUci(...)!` to `makeMove`; a malformed stored move throws and leaves `isPlayingSolution` stuck | error-handling (96) | Defer — filed `f-20260922-13` (same entry as I12) | Read `Puzzles.tsx:831-850`. Different area (puzzles UI), outside MANDATE |

Raw reports, verbatim:

#### lens-chess-semantics (r2)

```
[blocker] src/state/store/tree.ts:769 — `appendMove` mutates the mainline endpoint (`position` at line 697) but `isThreeFoldRepetition` walks `state.position`. With root → `Nf3 Nf6 Ng1 Ng8 Nf3 Nf6 Ng1`, a side variation selected at `[1]`, and `appendMove(f6g8)`, the resulting position is the third root position, but repetition counts only the side line and leaves the result `"*"` (confidence: 95)

Correction check against r2: I1 closed; I2 closed; I3 closed; I4 remains rejected with D11 evidence; I5 closed; I6 closed. O4/O5’s added criteria are necessary to preserve the mandated path and cache invariants.

VERDICT: REVISE
```

#### lens-code-quality (r2)

```
[should-fix] tasks/plans/2026-09-22-tree-path-insert-and-rehydrate.md:196 — Phase 4 requires only three children, but its nested-delete rows use `[0,3,0]` before deleting `[0,2]`; four children are required, as Phase 2 states. (confidence: 100)

[should-fix] tasks/plans/2026-09-22-tree-path-insert-and-rehydrate.md:100-104 — Calling stale tracked state a “cursor” and “cosmetic inconsistency” understates `headers.start`, which the plan itself says can narrow `boardStateMap` and later resolve onto an unrelated move. (confidence: 92)

[nit] tasks/plans/2026-09-22-tree-path-insert-and-rehydrate.md:152-159 — Decision IDs are ordered D11 before D10, breaking the surrounding sequential convention. (confidence: 99)

Correction check: I1 closed — warning requirements removed. I2 closed — middle-invalid `parseStartHeader` cases added. I3 closed — caller, line, and test-path references corrected. I5 closed — nested delete rows for `position` and `headers.start` added. I6 closed — `clone` repair coverage added.

VERDICT: APPROVED
```

#### lens-correctness (r2)

```
I1 closed — r2 removes the non-mandated warning behavior and tests.

I2 closed — all-or-nothing `parseStartHeader` behavior now has middle-invalid cases.

I3 closed — caller and line references are corrected.

I5 closed — nested delete coverage now includes `position` and `headers.start`.

I6 closed — clone repair coverage is explicitly added.

I4 remains rejected; r2 provides no new contrary evidence. No correctness defects found.

VERDICT: APPROVED
```

#### lens-error-handling (r2)

```
I1 closed — r2 removes warning logging.  
I2 closed — adds all-or-nothing middle-invalid tests.  
I3 closed — references and caller trace corrected.  
I5 closed — nested delete coverage added for `position` and `headers.start`.  
I6 closed — clone repair readback added.  
I4 remains rejected; no new evidence overturns D11.

[blocker] src/state/store/tree.ts:340 — Invalid `makeMoves` input returns from the Immer producer after earlier moves have already mutated the tree, with no error result. `PuzzleBoard` then resets normally, so a malformed mainline sequence appears successful but is only partially applied; Phase 4 tests only valid payloads (confidence: 96)

[should-fix] src/components/puzzles/Puzzles.tsx:845 — `parseUci(...)!` can pass `undefined` to `makeMove`; chessops then throws, and the async solution handler has no `catch`/`finally`, leaving `isPlayingSolution` stuck `true` with no actionable user error (confidence: 96)

VERDICT: REVISE
```

#### lens-minimalism (r2)

```
No minimalism findings at confidence ≥80. O4’s shared rebasing step and O5’s shared path walker each have multiple required callers; remaining tests cover distinct mutation/storage paths rather than speculative scope.

Correction check against r2:

- I1: closed — warning logging and tests removed.
- I2: closed — all-or-nothing and middle-invalid cases added.
- I3: closed — caller, line, and test-path references corrected.
- I4: unchanged/rejected — D11 retains its evidence; no new minimalism evidence challenges it.
- I5: closed — nested delete coverage added for `position` and `headers.start`.
- I6: closed — `clone` repair is now explicitly tested.

VERDICT: APPROVED
```

#### lens-persisted-state (r2)

```
No persisted-state defects found in candidate r2.

Correction closure:

- I1 — closed: warning scope and tests removed.
- I2 — closed: all-or-nothing `parseStartHeader` cases added.
- I3 — closed: storage references and caller/test paths corrected.
- I5 — closed: nested delete coverage now includes `position` and `headers.start`.
- I6 — closed: `clone` repair is explicitly tested.
- I4 — not re-raised; no new evidence against D11.

VERDICT: APPROVED
```

#### lens-plan (r2)

```
[should-fix] tasks/plans/2026-09-22-tree-path-insert-and-rehydrate.md:20-22 — the blanket claim that no tree-store mutation leaves a tracked path addressing a different node exceeds the mandate and contradicts the plan’s own `makeMove` expectation that `position` advances to the new node (plan:210-216; `src/state/store/tree.ts:723-756`). Qualify it to sibling-renumbering mutations (confidence: 98)

Correction closures: I1 closed; I2 closed; I3 closed; I5 closed; I6 closed. No changed premise reopens I4.

VERDICT: APPROVED
```

#### lens-root-cause (r2)

```
Correction check: I1 closed; I2 closed; I3 closed; I5 not closed; I6 closed. I4 remains rejected with no new contrary evidence. No prior fix is reintroduced.

[blocker] tasks/plans/2026-09-22-tree-path-insert-and-rehydrate.md:196 — I5’s new delete rows use `[0,3,0]`, but the fixture specifies only three children, so that path is invalid before deletion. `getNodeAtPath` truncates it to `[0]`; deleting `[0,2]` cannot demonstrate that the original sibling survives at `[0,2,0]`, and the `toBe` assertion may fail even with a correct rebase. The shared delete rebasing cause therefore remains unverified (confidence: 100)

VERDICT: REVISE
```

#### lens-tests (r2)

```
Correction check against r2:

- I1 closed — non-mandated warning behavior removed.
- I2 closed — invalid-middle `parseStartHeader` cases now catch prefix acceptance.
- I3 closed — references and test paths corrected.
- I5 closed — nested delete assertions cover `position` and `headers.start`.
- I6 closed — `clone` repair is explicitly tested through its pending target.

The Phase 4/5 anchors would fail on reverting the prepend rebasing, storage repair, all-or-nothing parsing, nested delete, or clone changes. No verification finding.

VERDICT: APPROVED
```


### Round 3 — revision r3, 2026-09-22, executor codex, 6 lenses

Raw verdicts: review-code-quality REVISE · review-plan REVISE · review-tests REVISE ·
review-chess-semantics APPROVED · review-error-handling APPROVED · review-root-cause APPROVED.

Closure against r3: I5+I7, I8, I9 closed by all six. I10 closed by five, **not closed** by code-quality
(reopened as I14). I11 Skip and I12+I13 Defer upheld by all six.

| ID | Claim | Witnesses (confidence) | Disposition | Evidence / correction |
| --- | --- | --- | --- | --- |
| I14 | Goal still claims every delete/promote/prepend leaves each path on the same node, contradicting O1's clamp of a path inside a deleted subtree | code-quality (99, blocker) | Fix — correction-introduced by I10 (r3) | r4 Goal: a surviving node is still addressed; a deleted one is clamped or cleared per O1 |
| I15 | Phase 4 never prepends at the root — M11's exact sequence — so an implementation mishandling an empty parent path passes every row | plan (98, blocker), tests (99, blocker) | Fix | r4 adds row 0: root prepend with `headers.start = [0]` → `[1]`, `practicePath = [1,0]` → `[2,0]`, `position` `[]` unchanged |
| I16 | O5 makes repaired envelopes take `read`'s rewrite branch, whose `setItem` failure is only `void warn(...)` — an unhandled rejection if logging fails, and the stale value stays durable | error-handling (94) | Skip for the plan; the `void warn` half filed as `f-20260922-14` | The MANDATE half holds on failure: `read` returns the repaired value, so the store never trusts the stale path, and every later `read` repairs again. The unhandled `void warn` is pre-existing at `tabStorage.ts:280` and `:336` (grep: the only two of five `void warn` sites in `src/` without `.catch`); O5 adds no log call |
| I17 | No passing-after execution in a plan-only review | root-cause (98) | Skip | Inherent to plan review; the Phase 4/5 proof commands are the passing-after evidence and run at implementation |

Raw reports, verbatim:

#### lens-chess-semantics (r3)

```
No chess-semantics findings.

Correction check against r3:

- I5+I7: closed — four-child fixture and nested delete rows now exist.
- I8: closed — stale `headers.start` consequences are explicit.
- I9: closed — D10 precedes D11.
- I10: closed — goal is limited to sibling-renumbering mutations.
- I11: skip upheld — duplicate of `f-20260914-28`, with no new evidence.
- I12+I13: defer upheld — filed as `f-20260922-13`, outside this mandate.

No additional scope expansion found beyond necessary rebasing, storage repair, and regression coverage. No files changed or proof commands run.

VERDICT: APPROVED
```

#### lens-code-quality (r3)

```
[blocker] tasks/plans/2026-09-22-tree-path-insert-and-rehydrate.md:20 — The revised goal still claims every delete/promote/prepend leaves each tracked path addressing the same node, but frozen O1 explicitly clamps a path inside a deleted subtree to its parent (`[0,2,0]` → `[0]`). The `makeMove` caveat does not cover this delete exception, so the headline contract contradicts its own required behavior (confidence: 99)

Correction closure: I5+I7 closed; I8 closed; I9 closed; I10 not closed for the reason above; I11 skip disposition confirmed; I12+I13 defer disposition confirmed.

VERDICT: REVISE
```

#### lens-error-handling (r3)

```
[should-fix] src/state/store/tabStorage.ts:280 — O5 makes repaired persisted envelopes enter `read`’s rewrite branch. If `sessionStorage.setItem` fails, `read` still returns the repaired state as successful hydration, leaves the stale value durable, and calls `void warn(...)`; Tauri’s `warn` returns a rejecting Promise, so logging failure becomes an unhandled rejection with no user-facing persistence error. Phase 5 tests only successful writeback (confidence: 94)

Correction check:

- I5+I7: closed — Phase 4 now has four children, so `[0,3,0]` is valid.
- I8: closed — stale `headers.start` is described as consequential.
- I9: closed — D10 precedes D11.
- I10: closed — the goal is limited to sibling-renumbering mutations.
- I11: closed for this review — duplicate of `f-20260914-28`, with no new evidence.
- I12+I13: not closed as product defects; correctly deferred to filed `f-20260922-13`, with no new evidence and outside the mandate.

VERDICT: APPROVED
```

#### lens-plan (r3)

```
Correction closure against r3:

- I5+I7 — closed: fixture now has four children and `[0,3,0]` is valid.
- I8 — closed: stale starts are no longer described as cosmetic.
- I9 — closed: D10 precedes D11.
- I10 — closed: goal is limited to sibling-renumbering mutations.
- I11 — not closed, correctly deferred: duplicate of open `f-20260914-28`, outside mandate.
- I12+I13 — not closed, correctly deferred: filed as `f-20260922-13`, outside mandate.

[blocker] tasks/plans/2026-09-22-tree-path-insert-and-rehydrate.md:37,199-203 — Phase 4 only tests insertion under `[0]`, never the root prepend from M11. An implementation that skips rebasing for an empty parent path passes every listed test but fails the production root call, where `BoardGame` uses `parentPath = []` and `makeMove` executes `unshift` (src/components/boards/BoardGame.tsx:419-440; src/state/store/tree.ts:698-742) (confidence: 98)

VERDICT: REVISE
```

#### lens-root-cause (r3)

```
Correction check against r3:

- I5+I7 — closed: Phase 4 now requires four children, making `[0,3,0]` valid.
- I8 — closed: stale `headers.start` consequences are accurately described.
- I9 — closed: D10 precedes D11.
- I10 — closed: scope is limited to sibling renumbering.
- I11 — not closed; skip confirmed as a separate, already-filed `appendMove` defect.
- I12+I13 — not closed; defer confirmed under `f-20260922-13`, outside this mandate.

O4 reaches the actual `unshift` cause and preserves the prior delete/promote fix through the shared rebasing step. O5 validates at `parseTree`, including writeback, rather than masking the symptom in readers. No prior fix is reintroduced.

[should-fix] tasks/plans/2026-09-22-tree-path-insert-and-rehydrate.md:194 — M11/M12 provide failing-before evidence, but no passing-after execution is supplied in this plan-only review; Phase 4/5 proof remains an acceptance obligation. (confidence: 98)

VERDICT: APPROVED
```

#### lens-tests (r3)

```
Correction check against r3:

- I5+I7: closed — four-child fixture makes `[0,3,0]` valid; nested delete rows now assert `position` and `headers.start`.
- I8: closed — stale `headers.start` impact is accurately described.
- I9: closed — D10 precedes D11.
- I10: closed — goal is limited to sibling-renumbering mutations.
- I11: skip confirmed — duplicate of `f-20260914-28`, outside mandate.
- I12+I13: defer confirmed — both remain tracked by `f-20260922-13`; r3 does not claim to fix them.

[blocker] tasks/plans/2026-09-22-tree-path-insert-and-rehydrate.md:199 — Every Phase 4 prepend case inserts below `[0]`; none prepends at the root with an existing `headers.start = [0]`, which is the exact `f-20260922-08` regression. A helper that skips root-parent rebasing or computes the root depth incorrectly would pass all planned tests, and no existing test exercises `mainline` (confidence: 99)

VERDICT: REVISE
```


### Round 4 — revision r4, 2026-09-22, executor codex, 6 lenses

Raw verdicts: review-chess-semantics REVISE · review-plan REVISE · review-tests REVISE ·
review-code-quality APPROVED · review-error-handling APPROVED · review-root-cause APPROVED.

Closure against r4: I14 and I15 closed by all six; I16 and I17 dispositions upheld by all six.

| ID | Claim | Witnesses (confidence) | Disposition | Evidence / correction |
| --- | --- | --- | --- | --- |
| I18 | O5 accepts a persisted root/`headers.fen` mismatch; a tree persisted by pre-fix `setFen` reloads and the next header edit discards the custom position | chess-semantics (93, blocker) | Skip — rejected with evidence | Not a path, so outside MANDATE; and the stated route does not exist. The backing store is `sessionStorage` (`tabStorage.ts`), cleared when the window closes, and installing the O3 fix requires relaunching the application — the upgrade-boundary argument the approved O1-O3 plan already makes for `practicePath` in its `## Scope` (handoff, "Rehydration does not check …" bullet), and the measurement recorded in `f-20260922-10` ("an upgrade cannot carry a pre-fix stale path across"). Within one run of the fixed application, O3 makes every root installation write a coherent `headers.fen`, so nothing incoherent is persisted to be restored. The one remaining route to an incoherent `headers.fen` is `[FEN ""]` import, filed as `f-20260922-12` |
| I19 | `parseStartHeader` rows do not pin (a) that a valid nested path is accepted, (b) the `> 512` bound — the existing `Array(513)` row fails at index 2 of a one-child tree whether or not the bound exists | plan (97, 98 — blockers) | Fix | Read `src/utils/tests/chess.test.ts:43-50`. r5 adds a valid `[0,1]` row and a 512/513 pair on a 513-ply chain |
| I20 | The root prepend row disables `changePosition`; a helper that reassigns `position` only for an empty parent would send the root production flow to the last child | root-cause (95) | Fix | r5 adds a root prepend with default `changePosition`, asserting `position` `[0]` on the new move and `headers.start` `[1]` |
| I21 | No insertion below a parent deeper than `[0]` | tests (96, blocker) | Fix | r5 row 7: insertion under `[0,0]`, `[0,0,2,0]` → `[0,0,3,0]`; fixture extended |
| I22 | No non-mainline insertion with tracked paths — a rebase applied after `push` would pass | tests (94) | Fix | r5 row 8 |

Raw reports, verbatim:

#### lens-chess-semantics (r4)

```
[blocker] tasks/plans/2026-09-22-tree-path-insert-and-rehydrate.md:91-136 — O5 repairs paths but accepts a persisted root/header mismatch. A pre-fix `setFen("8/8/8/4k3/8/8/8/4K3 w - - 0 1")` can persist that root with `headers.fen = INITIAL_FEN`; after reload, an unrelated header edit rebuilds the root from `INITIAL_FEN` and discards the custom position and moves. Add a storage-boundary coherence check or explicitly cover this migration. (confidence: 93)

Issue closure: I14 closed; I15 closed by Phase 4 row 0; I16 correctly skipped for this plan, with its `void warn` half filed as `f-20260922-14`; I17 correctly skipped because this is plan-only review.

VERDICT: REVISE
```

#### lens-code-quality (r4)

```
No readability/local-consistency findings at confidence ≥80.

I14 — closed: r4 distinguishes surviving nodes from deleted-node clamp/clear behavior.

I15 — closed: Phase 4 row 0 now covers the exact root prepend.

I16 — not closed: correctly skipped; the pre-existing `void warn` issue is filed separately.

I17 — not closed: passing-after evidence remains an implementation acceptance step.

VERDICT: APPROVED
```

#### lens-error-handling (r4)

```
No new error-handling findings at confidence ≥80.

Correction closure against r4:

- I14 — closed: goal now distinguishes surviving nodes from deleted-path clamping.
- I15 — closed: Phase 4 adds the exact root-prepend M11 case.
- I16 — closed as plan-review skip: r4 adds no logging or new failure path; residual `void warn` defect remains separately filed as f-20260922-14.
- I17 — closed as non-applicable: passing-after execution belongs to implementation verification.

VERDICT: APPROVED
```

#### lens-plan (r4)

```
[blocker] tasks/plans/2026-09-22-tree-path-insert-and-rehydrate.md:241-245 — Phase 5 tests only invalid multi-level `parseStartHeader` paths. A refactor that rejects every path longer than one element passes them, despite current code supporting arbitrary valid depth at `src/utils/chess.ts:486-491`. Add a valid nested-path assertion (confidence: 97)

[blocker] tasks/plans/2026-09-22-tree-path-insert-and-rehydrate.md:241-245 — The cited `Array(513).fill(0)` test does not prove the `>512` bound: its one-child fixture fails at the second index (`src/utils/tests/chess.test.ts:43-49`), independently of the guard at `src/utils/chess.ts:483`. Removing the bound would pass all planned tests (confidence: 98)

Correction closure against r4:

- I14 — closed: the goal now distinguishes surviving nodes from deleted-node clamp/clear behavior.
- I15 — closed: Phase 4 row 0 exercises root prepend with `position = []`.
- I16 — closed as a plan issue: no new warning path is added; the existing `void warn` defect remains filed as `f-20260922-14`.
- I17 — closed as an inherent plan-review limitation; required passing-after commands remain specified.

VERDICT: REVISE
```

#### lens-root-cause (r4)

```
[should-fix] tasks/plans/2026-09-22-tree-path-insert-and-rehydrate.md:208,216-222 — The root prepend row disables `changePosition`, while the identity-sensitive test only uses nested parent `[0]`. A helper that reassigns `position` specifically for empty parent `[]` would make the following `makeMove` block select the last child instead of the newly prepended first child; the root `BoardGame`/`Puzzles` flows would regress while all planned rows pass. Add a root prepend with default `changePosition` and assert `position === [0]` addresses the new node (confidence: 95)

O4 reaches the `unshift` cause, and O5 repairs paths at `parseTree` before store hydration rather than masking truncation in readers. No reintroduction of `b82021ec`’s delete/promote fix was found.

Correction checks: I14 closed; I15 closed by the root-parent row; I16 skip upheld because the warning failure is pre-existing and O5 returns repaired state; I17 remains a plan-review limitation—no passing-after execution is present, but the existing skip disposition stands and the Phase 4/5 commands remain acceptance obligations.

VERDICT: APPROVED
```

#### lens-tests (r4)

```
I14 — closed: r4 qualifies surviving nodes versus deleted-node clamping.

I15 — closed: Phase 4 now includes the exact root-prepend M11 row.

I16 — closed for this plan: prior skip remains valid; the logging failure is separately filed as f-20260922-14.

I17 — closed as plan-only: passing-after execution belongs to implementation.

[blocker] tasks/plans/2026-09-22-tree-path-insert-and-rehydrate.md:200-222 — Phase 4 never inserts below a parent deeper than `[0]`. A depth-0/1-only rebase implementation passes every listed test; the `makeMoves` second insertion under `[0,0]` no longer has a tracked path beneath that parent after the first rebase. Add a `[0,0]` insertion with a target such as `[0,0,2,0]` → `[0,0,3,0]` and identity assertion (confidence: 96)

[should-fix] tasks/plans/2026-09-22-tree-path-insert-and-rehydrate.md:200-214 — No test inserts a non-mainline variation with tracked paths. A regression applying the new rebase after `children.push` would pass all planned tests and existing store tests, although push does not renumber siblings. Add an omitted-`mainline` case asserting `headers.start` and `practicePath` remain unchanged (confidence: 94)

VERDICT: REVISE
```


### Round 5 — revision r5, 2026-09-22, executor codex, 4 lenses

Raw verdicts: review-tests REVISE · review-chess-semantics APPROVED · review-plan APPROVED ·
review-root-cause APPROVED.

Closure against r5: I18 (Skip), I19, I20, I21, I22 closed by all four.

| ID | Claim | Witnesses (confidence) | Disposition | Evidence / correction |
| --- | --- | --- | --- | --- |
| I23 | Phase 4 never tests `position` running through a shifted child during a prepend; an implementation leaving `position` unrebased passes | tests (99, blocker) | Skip the row — unreachable; clarify O4 | Traced `tree.ts:300-356, 677-700`: both store actions call the module `makeMove` with `last: false`, which takes the insertion parent from `state.position`, so the cursor is always the parent and never a proper extension of it. The state is not constructible through the store API (the module function is unexported). r6 states this under O4; the observable obligation — unchanged, same reference — is pinned by the three `changePosition` rows |

Raw reports, verbatim:

#### lens-chess-semantics (r5)

```
Correction check against r5:

- I18 closed — still outside the path mandate; sessionStorage does not survive the required relaunch.
- I19 closed — valid nested and effective 512/513-depth cases added.
- I20 closed — root prepend now covers default `changePosition`.
- I21 closed — depth-2 insertion coverage added.
- I22 closed — non-mainline insertion coverage added.

No new chess-semantic findings.

VERDICT: APPROVED
```

#### lens-plan (r5)

```
Correction closure against r5:

- I18: closed; skip remains valid—session storage is not an upgrade-boundary path (`tabStorage.ts:265`), and the issue is outside the mandate.
- I19: closed; valid nested and real 512/513-depth cases added (`PLAN.md:253-258`).
- I20: closed; root prepend with default `changePosition` now tests identity-sensitive behavior (`PLAN.md:223-226`; `tree.ts:726-754`).
- I21: closed; depth-2 insertion coverage added (`PLAN.md:216`; `tree.ts:741-744`).
- I22: closed; non-mainline `push` coverage added (`PLAN.md:217`; `tree.ts:741-744`).

No plan defects found at confidence ≥80.

VERDICT: APPROVED
```

#### lens-root-cause (r5)

```
Correction check against r5:

- I18 — closed as correctly out of scope: root/header FEN mismatch is not a tracked path; no new evidence reopens it.
- I19 — closed: valid nested path and effective 512/513-depth tests added.
- I20 — closed: root prepend now tests default `changePosition`.
- I21 — closed: depth-2 insertion coverage added.
- I22 — closed: non-mainline insertion verifies no false rebase.

O4 reaches the actual `unshift` cause and preserves `b82021ec`’s delete/promote rebasing through the shared step. O5 repairs paths at `parseTree`, before hydration/seed/clone trust, while preserving `parseStartHeader`’s all-or-nothing and depth-bound semantics. No prior fix is reintroduced.

No new root-cause finding at confidence ≥80. The passing-after execution remains an implementation obligation; prior plan-only disposition I17 is unchanged and not re-raised.

VERDICT: APPROVED
```

#### lens-tests (r5)

```
I18 — closed (correctly skipped): not a tracked path; sessionStorage does not survive the required relaunch.

I19 — closed: r5 adds valid nested and meaningful 512/513-depth assertions.

I20 — closed: root prepend now tests default cursor movement.

I21 — closed: depth-2 insertion is covered.

I22 — closed: non-mainline `push` is covered.

[blocker] tasks/plans/2026-09-22-tree-path-insert-and-rehydrate.md:207-234 — Phase 4 never tests `position` through a shifted child during prepend. It tests `position` only as an unchanged parent/root cursor or deliberate cursor movement; the added delete rows cover a different mutation. An implementation that rebases `headers.start` and `practicePath` but leaves `position` stale after `mainline: true` passes all listed assertions. (confidence: 99)

VERDICT: REVISE
```


### Round 6 — revision r6, 2026-09-22, executor codex, 2 lenses

Raw verdicts: review-plan APPROVED · review-tests APPROVED. I23 closed by both (Skip of the row upheld;
O4 clarification verified against `tree.ts:300-356, 677-755`).

Raw reports, verbatim:

#### lens-plan (r6)

```
I23 closure: closed. Every public mainline insertion uses `last: false`, so its parent is always `state.position`; `appendMove` is the only `last: true` path and never prepends. The change-position rows cover the observable identity constraint.

No plan defects found.

VERDICT: APPROVED
```

#### lens-tests (r6)

```
I23: closed — `tree.ts:300-356,677-755` shows every inserting store action uses `last: false`, deriving the insertion parent from `state.position`; `appendMove` never passes `mainline`. Thus `position` cannot be a shifted descendant through the public API. The change-position rows still catch replacing an unchanged cursor reference.

No verification findings.

VERDICT: APPROVED
```


### Round 7 — coverage round at r6, 2026-09-22, executor codex, 5 lenses

The five lenses that had not seen r5/r6 (correctness, minimalism, persisted-state last at r2;
code-quality, error-handling last at r4), given the r2 → r6 delta. Raw verdicts: all five APPROVED.
Every correction I7-I23 confirmed closed or its Skip/Defer upheld by all five.

| ID | Claim | Witnesses (confidence) | Disposition | Evidence / correction |
| --- | --- | --- | --- | --- |
| I24 | `## Not part of this task` excludes "everything O1-O3's plan lists", which includes `f-20260922-08` and `f-20260922-10` — contradicting O4/O5 | code-quality (100) | Fix — reference-only, no further lens | r7 names the two exceptions and the two findings filed in this review. Scope sentence only: no obligation, behaviour, test or proof changes, so semantics are unchanged and the lens that raised it had already APPROVED the revision |

Raw reports, verbatim:

#### lens-code-quality (r7 coverage)

```
[should-fix] tasks/plans/2026-09-22-tree-path-insert-and-rehydrate.md:189-191 — the blanket exclusion of everything listed in O1–O3’s `Not part` section also excludes `f-20260922-08` and `f-20260922-10`, contradicting the plan’s explicit O4/O5 scope and Phases 4–5 (confidence: 100)

The r3–r6 corrections introduced no additional readability defect.

Correction check against r7:

- I7 — closed: four-child fixture makes `[0,3,0]` valid.
- I8 — closed: stale `headers.start` consequences are explicit.
- I9 — closed: D10 precedes D11.
- I10 — closed: goal is limited to sibling-renumbering mutations.
- I11 — not closed as a product defect; correctly skipped as an out-of-scope duplicate.
- I12 — not closed; correctly deferred to `f-20260922-13`.
- I13 — not closed; correctly deferred to `f-20260922-13`.
- I14 — closed: surviving versus deleted-node behavior is distinguished.
- I15 — closed: root prepend is covered.
- I16 — not closed as a product defect; correctly skipped, with the pre-existing logging issue filed separately.
- I17 — not closed; passing-after evidence remains an implementation obligation.
- I18 — closed as correctly out of scope.
- I19 — closed: valid nested and meaningful 512/513-depth tests added.
- I20 — closed: root prepend tests default cursor movement.
- I21 — closed: depth-2 insertion is covered.
- I22 — closed: non-mainline insertion is covered.
- I23 — closed: the O4 explanation establishes the shifted-child case is unreachable through the public API.

VERDICT: APPROVED
```

#### lens-correctness (r7 coverage)

```
Correction closure against r7:

- I7 — closed: Phase 4 now requires four children.
- I8 — closed: stale `headers.start` consequences are explicit.
- I9 — closed: D10 precedes D11.
- I10 — closed: the goal qualifies surviving versus deleted paths.
- I11 — not closed; correctly skipped as an existing, out-of-scope duplicate.
- I12 — not closed; correctly deferred to `f-20260922-13`.
- I13 — not closed; correctly deferred to `f-20260922-13`.
- I14 — closed: deleted-path clamping is qualified.
- I15 — closed: root prepend is covered.
- I16 — not closed; correctly skipped as the pre-existing `f-20260922-14` issue.
- I17 — not closed as execution evidence; correctly deferred to implementation verification.
- I18 — closed as correctly out of mandate.
- I19 — closed: nested validity and the effective 512/513 bound are covered.
- I20 — closed: root prepend with default cursor movement is covered.
- I21 — closed: depth-two insertion is covered.
- I22 — closed: non-mainline insertion is covered.
- I23 — closed: public mainline insertion always uses the cursor as parent.

No correctness defect was introduced by the r3–r6 corrections at confidence ≥80.

VERDICT: APPROVED
```

#### lens-error-handling (r7 coverage)

```
No error-handling defect at confidence ≥80. r7 adds no new catch, retry, network, logging, or asynchronous failure path. Existing I12/I13 and I16 remain correctly deferred/filed outside this mandate; no new evidence reopens them.

Correction closure against r7:

- I7–I10: closed; corrections remain intact.
- I11: not closed; correctly skipped as existing `f-20260914-28`.
- I12–I13: not closed; correctly deferred to `f-20260922-13`.
- I14–I15: closed.
- I16: not closed as a codebase defect; correctly tracked separately as `f-20260922-14`.
- I17: not closed as execution evidence; passing-after proof belongs to implementation.
- I18–I22: closed.
- I23: closed; r7 does not reopen the unreachable case.

Final revision r7 introduces no failure-path regression.

VERDICT: APPROVED
```

#### lens-minimalism (r7 coverage)

```
No blocker/should-fix/nit findings at confidence ≥80. The shared rebasing step has three callers, the path walker has two, and r7 introduces no unnecessary abstraction or duplicate logic.

Correction closure against r7:

- I7 closed — four-child fixture supports `[0,3,0]`.
- I8 closed — stale `headers.start` consequences are explicit.
- I9 closed — D10 precedes D11.
- I10 closed — goal is limited to sibling-renumbering mutations.
- I11 not closed — correctly out of scope; duplicate of `f-20260914-28`.
- I12 not closed — deferred to `f-20260922-13`, outside mandate.
- I13 not closed — deferred to `f-20260922-13`, outside mandate.
- I14 closed — surviving versus deleted-path behavior is distinguished.
- I15 closed — root prepend row added.
- I16 not closed — pre-existing logging defect; r7 adds no logging.
- I17 not closed — passing-after execution belongs to implementation.
- I18 not closed — correctly outside the tracked-path mandate.
- I19 closed — valid nested and 512/513-depth cases added.
- I20 closed — root prepend with default cursor movement added.
- I21 closed — deeper insertion coverage added.
- I22 closed — non-mainline insertion coverage added.
- I23 not closed — skip upheld; shifted-descendant position is unreachable through the public API.

VERDICT: APPROVED
```

#### lens-persisted-state (r7 coverage)

```
No persisted-state findings at confidence ≥80. Writers/readers agree through `serializeStorageValue`; O5 repairs paths before hydration, including seed/clone paths. No r3–r6 correction introduced a persistence defect or scope expansion.

Closure against r7:

- I7–I10: closed.
- I11–I13: not closed; correctly skipped/deferred as already-filed, out-of-mandate defects.
- I14–I15: closed.
- I16–I18: not closed; correctly skipped as pre-existing/out-of-mandate, with no new evidence.
- I19–I22: closed.
- I23: closed; unreachable through the public store API, with identity coverage retained.

Known `f-20260922-09` tab-close orphaning was rechecked; no new evidence, so it is not re-raised.

VERDICT: APPROVED
```


## Review closure

**All nine lenses APPROVED the final revision**: review-plan and review-tests at r6; review-chess-semantics
and review-root-cause at r5, with no O4/O5 semantics changed after r5 except the I23 clarification that
review-plan and review-tests closed at r6; correctness, minimalism, persisted-state, code-quality and
error-handling at r6 in the coverage round. The only later edit is I24, reference-only. No issue is open.

Metrics. Seven completed rounds, all on 2026-09-22, no pauses: first lens 22:35, last report 23:58 —
about 1 h 23 min wall, all active review (artefact mtimes). No rewrite, no split. Lens invocations:
9+9+6+6+4+2+5 = 41. `plan_adopted_per_round`: r1=5 r2=4 r3=2 r4=4 r5=0 r6=0 r7=1. Unique issues 24;
adopted 16 (I1-I3, I5-I10, I14, I15, I19-I22, I24); rejected with evidence 5 (I4, I11, I17, I18, I23 —
I23 with a clarifying O4 bullet); deferred and filed 3 issues into 2 findings (I12 + I13 →
`f-20260922-13`; I16's pre-existing `void warn` half → `f-20260922-14`). Correction-introduced defects:
I7 (from I5), I14 (from I10). Open at closure: 0.
