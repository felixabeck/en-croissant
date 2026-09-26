# PGN comment commands plan review handoff (Files preview `[%evp]`)

## Mandate
Felix's screenshot of the Files preview for a ChessBase repertoire (`Schw_Caro Kann`) showed the
comment command `[%evp 0,34,61,53,75,…]` rendered as comment prose at the top of the notation.
Felix: „This seems very broken … What's wrong here? Investigate this carefully." Then: „You should do the
work directly here in this terminal. You should plan the fix carefully." Goal: embedded PGN
commands must not render as comment text, and this change must not lose user data on save.

This was an interactive session, not a drain cluster: the defect was visible in Felix's own report,
so it was fixed in the session instead of being filed. Plan (untracked):
`~/.claude/plans/toasty-twirling-valiant.md`. The same session also fixed the Files card layout
(`8b3635c6`, `55265deb`, `ffb1629b`, `2a33d81d`), which had its own push review (5 Codex lenses:
3 APPROVED, one `Fix` repaired in `55265deb`, one minimalism `Skip` because `assertNothingClipped`
measures horizontal overflow and a vertical ancestor check would flag every scrolling area).

Implementation: `c449fbb2`, `8c942059` (coverage mapping), `2dc2d8e4` (push-review repair),
`6324b2f3` (mutation survivor). Delivered by the concurrent drain session's `$push`, which added
`81f88b0e`, `a9c5d25a`, `090f7a91`, `95283c8d` and `9cec4ca0`, and landed at `9cec4ca0`.

## Reviews

All lenses ran on Codex (`gpt-6-luna`, read-only leaves). Raw reports (ephemeral):
`/tmp/claude-1000/-home-felixb-Projekte-chessfable/9a817da7-ed9c-41c0-90fe-51569ba9cd3e/scratchpad/{plan,plan2,plan3,r4,r5}/lens-*.txt`.

Round 1 (r1): review-plan, chess-semantics, persisted-state (sensitive), tests. All four REVISE.

| ID | Claim | Witnesses | Disposition | Correction |
|---|---|---|---|---|
| F1 | `%eval` depth is dropped on save | chess-semantics r1 | Defer (r2), then Fix (r3) | r3: `TreeNode.depth` (previously never written) carries it; `setScore` clears it, the report writer sets the engine depth |
| F2 / P7 | A comment before a variation's first move is lost | chess-semantics r1, review-plan r1 | Defer (r2), then Fix (r3) | r3: `startingComment` on the grafted first node, written in front of its move, shown as a comment row |
| F3 | A 1 024-item command cap against an unbounded parser makes a reloaded tab unreadable | persisted-state r1 | Fix | r2: one string; r3: 10 MiB lexer bound; superseded by W2/P9 |
| F4 | The production save path (`serializeStoreTree`) is not asserted | tests r1 | Fix | r2: `tabs.test.ts` save test |
| F5 | Built-in `%eval`/`%clk`/`%csl`/`%cal` parsing has no concrete assertions | tests r1 | Fix | r2: concrete values asserted |
| P6 | Trees persisted before the change keep commands inside `comment` | review-plan r1 | Skip (tree persistence is `sessionStorage` only) | The drain's push review later adopted it as a fix: `81f88b0e` migrates legacy comments on hydration |
| P8 | Push and install go beyond the mandate | review-plan r1 | Skip | Felix ordered „full auto until your final push" |

Adopted per round: r1=3 (F3, F4, F5). Open after r1: F1, F2 (deferred), F3–F5.

Round 2 (r2): the same four lenses. persisted-state APPROVED; the others REVISE. F4 and F5 closed
(review-plan, tests). F1 and F2/P7 were repeated by three lenses. The deferral had rested on
„pre-existing, not worsened", which universal rule 4b rejects for a same-area finding, so both
became Fix in r3. F3 was re-raised by review-plan: a parsed comment of up to 10 MiB still exceeded
the 100 000-character persisted bound.

Adopted per round: r1=3 r2=3 (F1, F2, F3 re-fix). The two inbox findings filed for F1/F2 in round
1 were withdrawn before the drain merged them.

Round 3 (r3): the same four lenses. review-plan closed F1 and F2/P7. Implementation ran in
parallel, on Felix's instruction „You can already implement right away".

| ID | Claim | Witnesses | Disposition | Correction (c449fbb2) |
|---|---|---|---|---|
| N1 | A variation nested at a variation's first move is dropped with all its moves (only `children[0]` was grafted) | chess-semantics r3 | Fix | Every child of the recursive root is grafted |
| P9 | Joining commands with spaces can outgrow the source and the bound | review-plan r3 | Fix | c449fbb2: source slices concatenated; completed in 2dc2d8e4 (see r4) |
| P10 | PgnInput „Update" with Extra Markups off drops the commands | review-plan r3 | Fix | Commands and `startingComment` are written under `opt.comments`, the path they took as comment text |
| P11 | The re-review packet lacks the `plan-review-delta.py` block and a FILES inventory | review-plan r3 | Fix | Used from r4 on |
| W1 | `flush()` persists without the read gate | persisted-state r3 | Fix | `flush()` refuses a tree `canRehydrate` rejects and reports it |
| W2 | Headers are still capped at 100 000 characters | persisted-state r3 | Fix | One `PGN_TEXT_MAX` (10 MiB) for every persisted tree string |
| T1–T5 | Command-only comment; per-field bounds; mate depth; `setScore` serialized; the e2e fixture has no `[%evp]` | tests r3 | Fix | All added; each guard shown red |

Adopted per round: r1=3 r2=3 r3=11.

Round 4 (r4, on c449fbb2, combined with the push review): review-plan, chess-semantics,
persisted-state and error-handling (sensitive), correctness, root-cause, tests, code-quality,
minimalism. APPROVED: chess-semantics, persisted-state, error-handling, root-cause, correctness
(one should-fix), tests (two should-fix), minimalism (one nit). REVISE: code-quality, review-plan.
review-plan closed N1, P10, P11, W1, W2, T1–T5, F1, F2/P7, F4 and F5, and kept P9 open.

| ID | Claim | Witnesses | Disposition | Correction (2dc2d8e4) |
|---|---|---|---|---|
| P9 (cont.) | Adjacent `[%evp 1][%eval bad]` let the second pass capture a synthetic space: `commands` grows and reorders | review-plan r4 | Fix | One-pass splitter in source order; every kept piece is a disjoint source slice. Two tests are red against the two-pass splitter |
| C1 | `startingComment` is hidden once its move is mid-line (after a promotion) or in table view | correctness r4 | Fix | Rendered in front of its move wherever the move is drawn |
| T6 | A malformed `%eval` next to an opaque command could be reordered on save | tests r4 | Fix | Exact round-trip order asserted |
| T7 | Several comments before a variation's first move are untested | tests r4 | Fix | Test added |
| Q1 | `root` in `innerParsePGN` is really the moving cursor | code-quality r4 | Fix | Renamed `node` |
| Q2 | The e2e insertion index is a magic `4` | code-quality r4 | Fix | Derived from the first SAN token |
| M1 | `joinCommands` has a single caller | minimalism r4 | Fix | Inlined |

Adopted per round: r1=3 r2=3 r3=11 r4=7. Final gates on 2dc2d8e4: frontend coverage green, with the
new file mapped and the baseline's scope subtree re-recorded by hand per `docs/coverage.md`,
proven scope-only. Frontend mutation red: one survivor (the refused-flush message was not
asserted), fixed in `6324b2f3`.

Round 5 (r5, on 2dc2d8e4): review-plan, correctness, tests and code-quality. correctness, tests
and code-quality APPROVED; code-quality raised one nit (the comment „the recursive node" is
ambiguous beside the renamed cursor), fixed with this record. review-plan confirmed P9 closed in
code, and asked that the plan state the single-pass mechanism (done in the plan file) and that
the r4 packet carry the delta block; the packet point is procedural and changes no obligation.

Adopted per round: r1=3 r2=3 r3=11 r4=7 r5=1. Unique issues: 24 opened; 24 closed or
dispositioned (22 Fix, 2 Skip), with P6 later fixed by the drain. Open: none.

## Delivery

A drain cluster session was running in the same checkout during the r5 gates, and its `$push`
took these commits into its `a16919b2..HEAD` range. To avoid two pushes on one working tree, this
session stopped gating and committing and handed delivery to the drain: 7 Codex lenses, 9
findings, 5 repair commits, full frontend gates, a push of 13 commits landing at `9cec4ca0`, and
`install-local.sh` (installed `9cec4ca0`).
