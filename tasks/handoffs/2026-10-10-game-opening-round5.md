# Game-opening cumulative review round 5

Range: a210ba87797002871b705caa41d319094265a6df..cec23bdf159ac906c31c75f0fdc85088c074a53c. Full enclosing range starts at 5a5dc7e6acf2a8d0a53dbba59c2bdc4117baee77. All nine canonical read-only leaves completed, eight code lenses on the sensitive rung and one records lens on the mechanical rung. Plan authorship and arbitration shared one context. Detection ran on the code model family.

All prior adopted source obligations closed with concrete witnesses, including D9 full consumer coverage and f-20261010-16 and f-20261010-17. Overall source closure remains pending because this round adopted seven additional source corrections and one records correction. There are eight unique adoptions, duplicate reports count once. No Defer or Skip.

## Root dispositions

- Fix f-20261010-18, stale fulfilled temp-file Save As preflight. Correctness and root-cause share this finding. Root confirmed both unguarded post-read stamp comparisons and picker settlement in saveToFile. Separate from fixed rejected-save publication.
- Fix f-20261010-19, database save completion clears intervening edits. Root confirmed unconditional save after writeDbGame. Reuse captured ownership and serialized content semantics.
- Fix f-20261010-20, obsolete physical-generation reload rejection. Root confirmed fulfillment uses actionIsCurrent while rejection only checks cancellation. Separate from the already proved fulfillment witness.
- Fix f-20261010-21, name the repeated unchanged512 Start path bound. Root confirmed both uses, existing bound tests remain sufficient.
- Fix f-20261010-22, autosave discards typed failure. Root confirmed saveFile drops the result while userSaveFile already reports failures. Preserve stale and cancellation silence and existing translation conventions.
- Fix f-20261010-23, fifty-move draw overwrites checkmate. Root confirmed the unconditional later draw branch. Preserve existing adjudication except checkmate priority and header-change controls.
- Fix f-20261010-24, remove the redundant synchronous inner owns check. Adopt the minimalism nit because the catch-entry guard protects the same branch with no intervening await.
- Fix records, f-20261010-13 initial pending regression statement is historical. Official annotation f0bcebb8 now explicitly qualifies it and cites completed source proof. The original statement remains unchanged as history.

Official intake1561770f allocated source IDs18 through24. Related entries were queried before filing. All remain open until implementation, source review and required proof stages complete. No product decision changed. Pixel, native and all fourteen standalone assertion failure/restoration stages remain pending.

## Frozen repair packages

A. Save ownership and autosave presentation. One sensitive writer owns src/utils/tabs.ts, src/utils/tabs.test.ts, src/components/boards/BoardAnalysis.tsx and its test. Fix18,19,22,24 using existing result, ownership and notification conventions. Prove actual durable replacement, deferred fulfilled reads at both source boundaries, deferred database write with edits, current-owner controls and autosave presentation. Keep all prior save/discard/durability proofs.

B. Reload rejection ownership. One sensitive writer owns FileFreshnessGate.tsx and its test. Fix20 using the existing actionIsCurrent predicate and actual physical-only replacement, with deferred rejection categories and active-owner controls.

C. Checkmate precedence. One sensitive writer owns tree.ts and tree.test.ts. Fix23 using existing chess position semantics, with the reported legal witness and ordinary draw/header controls. Retain both storage retargeting and the unchanged ten-ply analysis limit.

D. Start path constant. One mechanical writer owns only chess.ts. Fix21 without changing512, behavior or parser tests. Preserve every consecutive-comment repair.

Writers are file-disjoint and run in parallel. Root owns integration, independent full pre-review and mutation/contract proof, atomic commits and fresh source closure. This is a new adopted repair package, not a third R4 proof-fix round. Every new semantic witness needs a Git-derived source-only fault, unchanged final tests, its own actual assertion failure with exit1 and exact restoration green. Root preserves all R4 failure history. Numeric budgets and coverage floors remain fixed.

## Raw correctness verdict

```text
D6 CLOSED — `gameOpen.test.tsx:131` observes actual React setter calls. Late settlement publishes nothing after unmount, and the guard-removed proof detects the unwanted publication.

D7 CLOSED at source level — InfoPanel’s owner-bound confirmation and immutable root/header snapshots preserve cancel, save continuation, newer edits, supersession, unmount and workspace refusal.

D8 CLOSED — the real-discard rejection test changes Jotai ownership before React cleanup. The active-owner control and catch-guard fault distinguish valid reporting from stale publication.

D9-P3 CLOSED — `replaceFileGame` overlays current tab metadata. The actual pending-read selector/modal test preserves refreshed metadata in live and persisted ownership.

D9 CLOSED for the adopted durability and consumer defects — durable staging precedes reference publication. Duplication, recovery, repair and close resolve physical ownership. Lifecycle tests retain the cached store, report owner, native-game ID and engine settings.

R4-SAVE CLOSED — `tabs.ts:518` rejects stale rejection publication. Five pending-save → actual-replacement → rejection cases preserve replacement state and freshness.

R4-BOARD CLOSED — `BoardsPage.test.tsx:851` exercises provider, recovery, retry and close with distinct physical and logical keys.

R4-GEN CLOSED — `FileFreshnessGate.test.tsx:918` changes only the physical generation and proves the obsolete reload cannot install its result.

R4-PGN CLOSED — `chess.ts:409` accumulates consecutive prose without command-only erasure. Parser round-trip cases preserve comments and annotations.

R4-DUP CLOSED — duplication retains existing recovery blockers and passes explicit required-reference intent. Cold, vanished, readable, pending and legacy-absent controls cover the distinct outcomes.

R4-ID CLOSED — `ReplaceFileGameResult` returns `treeKey`, while new-tab replacement retains logical `id`.

R4-LIMIT CLOSED — the named analysis bound remains ten plies.

R4-REC1 CLOSED — the execution handoff qualifies its historical checkpoint and identifies the later committed implementation and root proof.

R4-REC2 CLOSED — f-20261010-06 explicitly records D7 source closure while retaining pending native verification.

f-20261010-16 CLOSED — retargeting updates both persistence name and adapter. Missing/refused rehydration remains gated, and explicit retry retains the cached/report owner.

f-20261010-17 CLOSED — workspace repair carries required-reference intent. Missing-reference refusal preserves original ownership, while ordinary absent legacy repair remains allowed.

[blocker] src/utils/tabs.ts:479 — Start a user save for a supported `temp_file` tab with stamp A, then durably replace its game while the initial source read is pending. If that read subsequently fulfills with stamp B, this branch calls `sourceChanged(tabId)` without rechecking `owns()`. It marks the correctly loaded replacement conflicted and returns `"conflict"` instead of `"superseded"`. Line 489 repeats the same unchecked publication after the picker. The new catch guard cannot protect fulfilled reads. Pre-existing origin: `490831c77`. This is a separate successful-read outcome from the closed R4-SAVE rejection defect. (confidence: 96)

[blocker] src/utils/tabs.ts:458 — Save a database game, then edit its comment or headers while `writeDbGame` is pending. The database receives the earlier captured PGN, but successful completion unconditionally calls `store.save()`, clearing the dirty flag on the newer unsaved edits and returning `"saved"`. The surrounding file-save contract correctly compares current serialized content before clearing dirty. Database completion needs the same preservation of intervening edits. Pre-existing origin: `3afed0317`. (confidence: 99)

Limitation: read-only source review. No tests or runtime verification were executed here. Pixels, native behavior and fourteen standalone failure/restoration stages remain pending (confidence: 100). Detection used the code author’s model family. Plan authorship and arbitration shared one context.

VERDICT: REVISE```

## Raw root-cause verdict

```text
D6 CLOSED — Real React dispatcher observation detects late pending publication. Removing the mounted guard produces the extra `[false]` call, and restoration passes.

D7 CLOSED — Owner-bound confirmation and immutable root/header snapshots authorize discard without clearing dirty state prematurely. Actual selector/modal tests cover save, cancel, edits, supersession, unmount and workspace refusal.

D8 CLOSED — The Jotai-before-React ordinary-rejection witness remains silent. Removing the catch ownership guard produces the unwanted notification.

D9 CLOSED — Durable candidate seeding precedes the combined origin/reference commit. Physical-key consumers now preserve required presence and recovery ownership. Lifecycle tests retain cached-store, settings, native-game and report-owner identities and prove refusal, reload and cleanup.

D9-P3 CLOSED — The current-tab overlay preserves refreshed metadata. The retained selector/discard test fails specifically on metadata loss under the captured-origin fault.

R4-SAVE CLOSED for its adopted rejection mechanism — The catch checks captured ownership before publication. Five actual-replacement rejection cases fail when that guard is removed.

R4-BOARD CLOSED — Production provider, recovery and close integration use distinct physical keys. Four independent wiring faults fail the retained witness.

R4-GEN CLOSED for its adopted fulfillment witness — Physical-only replacement leaves the pending signal un-aborted. Removing generation equality lets the obsolete successful reload overwrite replacement content. The rejection sibling below remains broken.

R4-PGN CLOSED — Consecutive comments accumulate prose instead of overwriting it. The preservation reversal loses earlier prose, including the clock-only witness, and exact restoration passes.

R4-DUP CLOSED — Existing hydration blockers survive duplication. Required intent reaches cold and vanished source reads. Real repository/provider tests prove no blank admission or original-store unlocking.

R4-ID CLOSED — `ReplaceFileGameResult.treeKey` distinguishes physical generation from `ReplaceNewTabResult.id`.

R4-LIMIT CLOSED — The named analysis limit retains value 10 and its existing computation.

R4-REC1 CLOSED — The historical checkpoint now identifies `cb09c965` and independent root proof.

R4-REC2 CLOSED — The D7 annotation distinguishes completed source closure from pending native proof.

R4-RETARGET / f-20261010-16 CLOSED — Retargeting synchronously updates name and adapter. Removing adapter replacement publishes `absent` for missing required data.

J1-WORKSPACE / f-20261010-17 CLOSED — Repair carries required-reference intent and preserves original ownership on refusal. Removing that intent admits blank repaired ownership.

D1–D5 remain CLOSED at source level. Their Back lookup, fresh-admission assertion, responsive preview coverage, current inventory and shared database-opening handler remain intact.

[blocker] src/components/tabs/FileFreshnessGate.tsx:230 — The stale-generation mechanism remains in reload rejection handling. In the physical-only replacement scenario now covered by the new test, the old reload signal remains un-aborted. If that old read rejects with `missing-resource`, `invalid-input` or `conflict`, this catch checks only cancellation and marks the replacement’s logical tab unavailable. Its correctly installed board is then withheld. Fulfillment uses `actionIsCurrent`, but rejection bypasses the same ownership boundary. Apply that predicate before rejection publication and retain a deferred-rejection counterpart to the new fulfillment witness. Origin: `490831c7`, retained by `cb09c965`. This is a newly identified sibling, not a regression introduced by this repair. (confidence: 98)

[blocker] src/utils/tabs.ts:479 — The stale-save mechanism also survives fulfilled temp-file Save As preflight reads here and at line 489. A save captures game A’s stamp, awaits its source read, and game B replaces A under the same logical owner. A fulfilled read returning a different A stamp calls `sourceChanged(tabId)` without checking `owns()`, marking B conflicted. The new catch guard cannot intercept this successful-read branch. Check captured ownership after both awaits before publishing conflict or continuing the obsolete save. Origin: `490831c7`, retained through the current repair. This is a new sibling finding, not a reopening of the fixed rejection branch. (confidence: 96)

No previously fixed defect was identified as reintroduced. The inherited `981db8fc` findings-tool change preserves the unreadable-intent diagnostic rather than treating it as absent intent.

Limitation — Pixels, real WebKitGTK behavior and all fourteen standalone failure/restoration stages remain pending. Supplied source proofs do not establish them. This review was read-only. Detection used the code’s model family, and plan authorship and arbitration shared one context. (confidence: 100)

VERDICT: REVISE```

## Raw tests verdict

```text
D6 CLOSED — `gameOpen.test.tsx:131` observes the real React setter. Removing the unmount guard produces the unwanted late publication.

D7 CLOSED at source level — actual selector/modal tests assert replacement, cancellation, newer-edit preservation, owner switches, save continuation and workspace refusal.

D8 CLOSED — the Jotai-before-React rejection test asserts zero notifications. Removing the catch guard fails that assertion.

D9 CLOSED at source level — persisted-store tests assert candidate durability, matching cold reload, retained ownership, refusal safety and cleanup. The previously unresolved duplication consumer now has recovery and cold-reference coverage.

D9-P3 CLOSED — the pending-read discard test asserts refreshed metadata in live and persisted workspace state. The captured-origin fault loses that metadata.

R4-SAVE CLOSED — `tabs.test.ts:744` performs real durable replacement without changing file/page, then rejects the pending save. Removing the catch guard fails freshness or superseded-result assertions across all five categories.

R4-BOARD CLOSED — `BoardsPage.test.tsx:851` distinguishes physical and logical keys through production provider, recovery and close wiring. Four independent routing faults fail its assertions.

R4-GEN CLOSED — `FileFreshnessGate.test.tsx:918` changes only physical generation. Removing its comparison lets the obsolete reload overwrite replacement content.

R4-PGN CLOSED — parser tests assert preserved prose and annotations through save/reparse. Reverting preservation produces semantic assertion failures.

R4-DUP CLOSED — tests assert retained recovery status, blocked blank writes and no duplicate admission for cold or vanished references. Readable, pending and absent legacy controls remain covered.

R4-ID CLOSED — committed replacement exposes `treeKey`, and persisted lifecycle assertions consume it. New-tab results retain their logical `id` contract.

R4-LIMIT CLOSED — the extracted constant retains the existing value 10 and loop bound. This changes naming without adding behavior.

R4-REC1 CLOSED — the execution checkpoint qualifies historical evidence and identifies subsequent repairs and pending runtime proof.

R4-REC2 CLOSED — the ledger annotation distinguishes D7 source closure from pending native verification.

R4-RETARGET CLOSED — `tree.hydration.test.ts:54` asserts unavailable status and blocked writes after retargeting. Retargeting only the name fails the missing-reference assertion.

J1-WORKSPACE CLOSED — `workspace.test.ts:143` asserts unchanged original ownership and workspace bytes when required tree storage is missing. Removing repair intent fails those assertions.

No new verification findings. Tests are included by Vitest selection, and the root log records the exact eleven suites plus the separate parser suite.

Limitation: pixels, actual WebKitGTK behavior and all fourteen standalone failure/restoration stages remain pending. Source closure establishes none of them (confidence: 100). Review used the code author’s model family. Plan authorship and arbitration shared one context.

VERDICT: APPROVED```

## Raw code-quality verdict

```text
D6 CLOSED — `gameOpen.test.tsx:131` observes the real React setter. Removing the mounted guard produces the recorded extra pending-state publication.

D7 CLOSED at source level — `InfoPanel.tsx:378–446` names the owner-bound request and discard snapshot explicitly. Actual selector/modal tests retain cancel, save, edit, supersession and unmount behavior.

D8 CLOSED — `InfoPanel.test.tsx:683` distinguishes active-owner rejection from Jotai ownership changing before React cleanup. The catch-guard fault produces the unwanted notification.

D9 CLOSED at source level — staged replacement and physical-key consumers now include required-reference duplication and repair. Persisted lifecycle tests cover refusal, reload and cleanup.

D9-P3 CLOSED — `replaceFileGame` overlays current tab metadata. The actual pending-read discard test preserves refreshed metadata and fails under the captured-origin fault.

R4-SAVE CLOSED — `tabs.ts:518` checks captured ownership before rejection publication. Tests exercise actual replacement followed by five late rejection categories.

R4-BOARD CLOSED — the production BoardsPage integration witness distinguishes physical provider/recovery/status keys from logical runtime cleanup.

R4-GEN CLOSED — the pending-reload test changes only the physical generation and retains the cached store and un-aborted signal.

R4-PGN CLOSED — `chess.ts:409` accumulates nonempty prose consistently with starting comments. Parse/save/reparse tests cover consecutive prose and command comments.

R4-DUP CLOSED — duplication retains recovery blockers and passes explicit-reference intent. Cold, vanished, readable, pending and absent-legacy controls are present.

R4-ID CLOSED — `ReplaceFileGameResult.treeKey` identifies physical storage. `ReplaceNewTabResult.id` retains its logical-tab contract.

R4-LIMIT CLOSED — `MAX_GENERATED_ANALYSIS_VARIATION_PLIES` names the unchanged ten-ply policy.

R4-REC1 CLOSED — execution records qualify historical checkpoints and identify the committed source and independent root proof.

R4-REC2 CLOSED — the ledger correction explicitly distinguishes completed D7 source closure from pending native proof.

R4-RETARGET CLOSED — retargeting synchronously changes persistence name and adapter. Missing/refused-read tests retain cached-store and report-owner identity.

J1-WORKSPACE CLOSED — repair carries `requireExisting` and preserves original ownership on refusal. Missing-reference and absent-legacy controls distinguish the policies.

[blocker] src/utils/chess.ts:520 — Bare `512` here and at line 590 controls whether a PGN Start path is accepted or reset to `[]`, without naming the path-length policy. Comparable persistence bounds already use `MAX_TREE_DEPTH` in `src/state/store/tabStorage.ts:23`. Name the parser bound and retain its value. Newly reported pre-existing issue, origin `3afed0317`, separate from R4-LIMIT. (confidence: 96)

Lifecycle witness: `atoms.lifecycle.test.ts:322–328` retains cached-store, tab-atom, engine-settings, native-game and report-owner identities.

Limitation: source review only. Pixels, actual-app behavior and fourteen standalone failure stages remain pending (confidence: 100). Detection used the code author’s model family. Plan authorship and arbitration shared one context.

VERDICT: REVISE```

## Raw minimalism verdict

```text
[nit] src/utils/tabs.ts:526 — The new catch-entry `owns()` guard at line 518 makes this inner ownership check redundant. No asynchronous boundary intervenes. Remove the inner conditional and retain its two statements, saving two lines without changing acceptance coverage. Origin: `4ee4ff12` makes the earlier `cb09c965` guard redundant. (confidence: 96)

D6 CLOSED — `gameOpen.test.tsx` observes the actual React dispatcher. The guard-removed witness records the forbidden late `false` publication.

D7 CLOSED — `InfoPanel.tsx` retains owner-bound confirmation, immutable snapshots and current-request checks. Actual selector/modal tests cover discard, save, cancel, edits, supersession, unmount and workspace refusal.

D8 CLOSED — The ordinary-rejection test changes Jotai ownership before React cleanup, with an active-owner control. The catch-guard fault produces the unwanted notification.

D9 CLOSED at source level — Shared staging precedes workspace publication. Refusal, reload, cleanup and lifecycle tests cover durability and the corrected duplication consumers.

D9-P3 CLOSED — Replacement overlays current metadata. The pending selector/discard test preserves refreshed count and metadata in live and persisted ownership.

R4-SAVE CLOSED — Catch-entry ownership validation suppresses all five stale rejection categories after actual replacement.

R4-BOARD CLOSED — Production BoardsPage/provider/recovery wiring has key-sensitive assertions and four independent routing faults.

R4-GEN CLOSED — The pending reload witness changes only physical generation and proves obsolete completion cannot replace current content or freshness.

R4-PGN CLOSED — Consecutive prose accumulates. Parse/save/reparse tests retain annotations, placement and earlier explanations.

R4-DUP CLOSED — Duplication preserves existing recovery blockers and passes required-reference intent. Cold, vanished, pending, readable and legacy controls exercise distinct contracts.

R4-ID CLOSED — `replaceFileGame` returns `treeKey`. `replaceNewTab` retains `id`, with shared internal staging unchanged.

R4-LIMIT CLOSED — The named analysis bound retains value 10 and its existing behavior.

R4-REC1 CLOSED — The primary execution handoff qualifies the earlier checkpoint as historical and references committed implementation and root proof.

R4-REC2 CLOSED — The D7 annotation explicitly distinguishes completed source closure from pending native verification.

R4-RETARGET CLOSED — Retargeting synchronously updates persistence name and adapter. Missing/refused-read tests preserve cached-store/report identity and explicit recovery.

J1-WORKSPACE CLOSED — Repair carries required-reference intent through the shared repository read. Missing-reference refusal preserves original ownership, while ordinary absent legacy repair remains permitted.

The delta adds no files or speculative extension points. Required-presence behavior lives in one repository read. Existing staging serves multiple admission paths. In the enclosing range, deleting `gameOpen.tsx` would recreate the mandated duplication. Its test, `GameCard.test.tsx` and `GameTable.test.tsx` cover distinct hook, preview and admission boundaries. Apart from the nit above, no smaller deletion preserves the adopted coverage. Inherited `981db8fc` adds only the necessary diagnostic, early return and SHA stamp.

Lifecycle evidence checks unchanged logical tab, cached store, settings, native-game and report-owner identities.

Limitation: pixel/native verification and all fourteen standalone failure stages remain pending and root-owned (confidence: 100). Detection used the code author’s model family. Plan authorship and arbitration shared one context.

VERDICT: APPROVED```

## Raw error-handling verdict

```text
D6 CLOSED — Real React dispatcher observation detects late pending publication, with guard-removal failure and restored green.

D7 CLOSED at source level — Owner-bound confirmation and immutable snapshots preserve cancellation, newer edits, supersession, unmount and workspace refusal.

D8 CLOSED — Actual Jotai-before-React rejection coverage proves stale errors stay silent while active-owner failures surface.

D9 CLOSED at source level — Durable staging precedes workspace publication. Required-reference consumers now preserve recovery ownership.

D9-P3 CLOSED — Current-tab metadata overlay and the actual pending-discard regression preserve refreshed metadata.

R4-SAVE CLOSED — `tabs.ts:518` checks ownership before rejection publication. Five late-rejection cases and the guard-removal witness cover this.

R4-BOARD CLOSED — Key-sensitive BoardsPage tests exercise physical-key provider, recovery and close wiring.

R4-GEN CLOSED — Physical-only replacement coverage rejects the obsolete pending reload.

R4-PGN CLOSED — Consecutive comments survive real parse/save/reparse, with preservation-removal failures.

R4-DUP CLOSED — Required reads refuse missing references and retain existing hydration blockers. Cold, vanished, transient-read, readable, pending and legacy controls distinguish the outcomes.

R4-ID CLOSED — `ReplaceFileGameResult.treeKey` distinguishes physical replacement from new logical-tab admission.

R4-LIMIT CLOSED — The named analysis bound preserves its value of ten.

R4-REC1 CLOSED — The execution handoff qualifies historical checkpoints and identifies final root source proof.

R4-REC2 CLOSED — The D7 annotation distinguishes completed source closure from pending native proof.

R4-RETARGET CLOSED — Retargeting updates both persistence name and adapter. Missing/refused-read tests preserve gating and cached ownership.

J1-WORKSPACE CLOSED — Repair cloning carries required-reference intent. Missing-reference refusal preserves original ownership, while absent legacy repair remains permitted.

[blocker] src/components/boards/BoardAnalysis.tsx:90 — Autosave discards `saveToFile`’s typed failure result. With autosave enabled by default, a current-owner write rejected with an ordinary I/O or resource-limit error reaches `tabs.ts`’s `{ status: "failed", error }` return, but this callback resolves normally without notification or error state. The user sees the dirty game without learning that autosave failed. Backend operation logging captures native failures, but does not surface them to the user. Handle failed results while preserving cancellation and supersession behavior. Pre-existing enclosing defect, originating in `3afed031`’s caught-failure return, retained by `490831c77`. This is separate from the closed stale-rejection finding. (confidence: 97)

Lifecycle witness: persisted replacement tests retain cached-store, report-owner, native-game and engine-setting identities. No changed premise found for deferred P2/P3.

Limitation: source review only. Pixels, actual-app behavior and fourteen standalone failure/restoration stages remain pending (confidence: 100). Detection used the code author’s model family. Plan authorship and arbitration shared one context.

VERDICT: REVISE```

## Raw persisted-state verdict

```text
D6 CLOSED — `gameOpen.test.tsx:131` observes the real React dispatcher. Removing the mounted guard produces the recorded late publication.

D7 CLOSED — `InfoPanel.tsx:361–435` retains owner-bound confirmation and immutable snapshots. Actual selector/modal tests cover cancel, save, edits, supersession, unmount and workspace refusal.

D8 CLOSED — `InfoPanel.test.tsx:683` checks ordinary rejection after Jotai ownership changes before React cleanup, with an active-owner control and catch-guard failure evidence.

D9-P3 CLOSED — `tabs.ts:266` overlays current metadata. The pending-read selector/discard regression verifies live and persisted metadata preservation.

R4-SAVE CLOSED — `tabs.ts:518` guards rejection publication. Five pending-save → durable-replacement → rejection cases preserve the replacement.

R4-BOARD CLOSED — `BoardsPage.test.tsx:851` exercises production provider, recovery and close wiring with distinct logical and physical keys. Four independent wiring faults fail.

R4-GEN CLOSED — `FileFreshnessGate.test.tsx:918` changes only physical generation during pending reload and proves the obsolete result cannot overwrite it.

R4-DUP CLOSED — `cloneDurable` preserves existing hydration blockers. Production duplication carries required-reference intent. Cold, vanished and transient-read witnesses prevent blank admission and original-store unlocking.

R4-RETARGET / f-20261010-16 CLOSED — `tree.ts:123` synchronously updates persistence name and adapter. Missing/refused-read tests retain the gate and prove explicit recovery. The name-only fault fails.

J1-WORKSPACE / f-20261010-17 CLOSED — `workspace.ts:134,346` carries required-reference intent through repair. Missing-reference repair preserves original metadata, while ordinary absent legacy repair remains allowed. The intent-removal fault fails.

R4-ID CLOSED — file replacement returns `treeKey`, while new-tab replacement retains its logical `id` contract.

R4-PGN CLOSED — consecutive nonempty prose accumulates, with parse/save/reparse tests.

R4-LIMIT CLOSED — the existing value remains 10 under the named constant.

R4-REC1 CLOSED — the historical checkpoint is qualified in the tracked handoff.
R4-REC2 CLOSED — `tasks/findings.md:14474` distinguishes D7 source closure from pending native proof.

D9 CLOSED at source level, including its previously unresolved duplication consumer. Writers and readers share the compressed encoding and effective physical key. Lifecycle tests retain cached-store, settings, native-game and report-owner identity, and cover refusal, reload and cleanup replay.

No new persistence defects found. This was read-only source review. Pixels, real-app behavior and fourteen standalone failure stages remain pending. Detection used the code’s model family.

VERDICT: APPROVED```

## Raw chess-semantics verdict

```text
[blocker] src/state/store/tree.ts:763 — Checkmate is overwritten by the 50-move draw check. From `7k/5Q2/6K1/8/8/8/8/8 w - - 99 1`, play `Qg7#`. The reducer correctly sets `1-0`, then the resulting halfmove clock of 100 triggers this branch and replaces it with `1/2-1/2`. Checkmate must take precedence. This is pre-existing enclosing code, with this FEN-clock trigger present since `242d01df`. (confidence: 99)

Source-level closures:

- D6 CLOSED — `gameOpen.test.tsx:131` observes React state publication across unmount.
- D7 CLOSED — owner-bound discard captures root/header references, with actual selector/modal race coverage.
- D8 CLOSED — `InfoPanel.test.tsx:683` tests stale ordinary rejection before React cleanup, alongside an active-owner control.
- D9 CLOSED — staged replacement installs matching tree state and paths. Required-reference protection now covers duplication, hydration and repair. Lifecycle tests retain cached store, settings, native-game and report-owner identities.
- D9-P3 CLOSED — `InfoPanel.test.tsx:518` proves committed metadata survives the pending replacement read.
- R4-SAVE CLOSED — the catch ownership guard suppresses all five tested stale save rejection categories.
- R4-BOARD CLOSED — production provider/recovery/close integration uses the physical generation.
- R4-GEN CLOSED — the pending reload test changes only physical generation and preserves replacement content.
- R4-PGN CLOSED — consecutive prose accumulates without command-only erasure. Parse/save/reparse tests preserve annotations, variation placement, headers and Start.
- R4-DUP CLOSED — duplication preserves recovery blockers and refuses missing explicit references, including cold and vanished sources.
- R4-ID CLOSED — replacement returns `treeKey`, while new-tab admission retains its logical `id`.
- R4-LIMIT CLOSED — the named analysis bound preserves the existing value of 10.
- R4-REC1 CLOSED — historical checkpoints are explicitly qualified.
- R4-REC2 CLOSED — D7 source closure remains distinguished from pending native proof.
- f-20261010-16 CLOSED — retargeting updates both persistence name and required-read adapter.
- f-20261010-17 CLOSED — workspace repair carries explicit-reference intent and preserves ownership on refusal.

Read-only source review. Supplied proof logs were inspected, no tests were run here. Pixels, native behavior and fourteen standalone failure stages remain pending. Detection used the author’s model family.

VERDICT: REVISE```

## Raw records verdict

```text
[should-fix] tasks/findings.md:14578 — “Regression execution remains pending” contradicts the completed source proof at lines 14582–14583. Retained clone-status logs confirm four regression failures under the source fault and four passes after restoration. Append an explicit correction marking the earlier pending statement historical. (confidence: 98)

Unverifiable: historical context/model provenance and upstream CI results. No live services were queried.

VERDICT: REVISE```

