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

## Initial implementation checkpoint and root proof

All four initial writers reached canonical end of stream. Root read every complete report and owned diff, inspected all semantic fault patches and failure diagnostics, independently checked source and test manifests, then ran the integrated proof. Plan authorship and arbitration shared one context. Detection ran on the code model family.

The initial candidate is not green and remains uncommitted. Root independently passed573 tests across12 suites and46 parser tests, scoped formatting and lint, TypeScript, verifier syntax and diff checks. Canonical pre-review passed all selected mutation lanes at100 percent but failed the unchanged bundle total limit by65 bytes. The measured entry is540200, largest lazy chunk514899 and total1620065 against1620000. Contract did not run after that failure. Receipt: /home/felixb/.claude/drain-state/chessfable-0a459a4f.d/gates-e838b3a7-7402-4e53-a614-eb2da79f3765/gate-root-r5-repair-proof.ynUbFJ/completion.record, status1 at f93ea300823137b4365cb8f2f9de4d39e2f95074. Root archived the exact red log, receipt and nine-source manifest in /tmp/build-game-opening-3b67c3b9/r5-root-proof-initial-red. No pixels, native app or standalone fourteen-assertion proof has run yet.

Root also independently ran the parser46, checkmate99 and reload102 package commands. These are overlapping confirmations, not additional distinct test counts. Source restoration integrity was checked for save508 production hashes and177 test/support hashes across sixteen fault/restoration manifests, reload331 production and177 test/support hashes across four manifests, and checkmate321 production and187 test/support hashes. Every accepted source fault produced its own semantic failure and exit1, followed by exact restoration exit0. The checkmate worker's earlier zero-selected selector run is rejected as proof and retained as history.

The save writer ran four local fault series and five local bundle measurements before its first handoff. Those are not four root-requested proof-fix rounds. Its one canonical pre-review attempt was intentionally interrupted while queued behind a peer heavy gate, status143. It is neither green nor an unexplained startup refusal. Reload and checkmate ran canonical pre-review and each failed bundle only on their then-current peer graph. Start naming ran one canonical attempt while peer work was incomplete, status2 for peer type/lint/test errors. Bundle was skipped there. Root's later integrated gate supersedes none of those historical receipts and measures the final nine-file candidate itself.

Review stage wall time was478 seconds, epoch1791610440 through1791610918. Active model time is unavailable. No non-overlapping external review wait was identified. This is not a sum of concurrent worker durations.

## Additional root adoption and first proof-fix round

After all four initial write leaves were terminal, root traced the append action in FileFreshnessGate and filed f-20261010-25. This is a root source-inspection adoption, separate from the eight unique round-five lens adoptions. Its rejected and obsolete fulfilled outcomes can publish against a superseded owner. The source repair uses the existing captured action predicate and preserves active-owner durable append uncertainty.

Official intake2b63c98d allocated f-20261010-25. The original filing wrongly called d-20261007-03 a user append decision. It is an agent metadata-editor decision, and no statement by Felix supported that sentence. Official annotation33558ed1 explicitly corrects that provenance and identifies agent decision d-20260924-03 as the binding append uncertainty policy. The original filing is retained as history. A correction attempt through file --replaces against a published inbox entry was refused before mutation because that API only replaces an intake-kept entry. The official annotation is the effective correction. No user decision was reversed.

Root proof-fix round1 resumes the same save writer01a12455-4788-7fe3-a38a-3d94bd0c34b6 on its four files and the same reload writer01a12455-4789-7e11-ae88-f107fd001cc9 on its two files. Both use the sensitive route, gpt-6.1-sol high. Tree and parser changes stay byte-identical. Save consolidates demonstrated duplicate presence checks and normalization, with one measured final bundle candidate. Append guards both late outcome classes and retains actual uncertainty controls. Both repeat their source-only semantic fault/restoration evidence with final tests unchanged. No concurrent whole-worktree heavy gates run during writes. Root runs integrated pre-review, mutation, bundle and contract after both end of stream. Source closure and all later proof remain pending.

Raw reports below preserve their content with trailing whitespace removed for the repository diff guard. The original scratch reports remain byte-identical.

## Raw initial save writer report

````text
R5 save repair is implemented and left unstaged. Source proof passes. The fixed bundle budget remains blocked by 65 gzip bytes. The single canonical pre-review attempt was interrupted while queued behind a foreign heavy-gate lock and exited 143. It did not run its checks. No launcher bypass was used.

Owned changes:

- `/home/felixb/Projekte/chessfable/src/utils/tabs.ts`
- `/home/felixb/Projekte/chessfable/src/utils/tabs.test.ts`
- `/home/felixb/Projekte/chessfable/src/components/boards/BoardAnalysis.tsx`
- `/home/felixb/Projekte/chessfable/src/components/boards/BoardAnalysis.test.tsx`

Mechanism:

- Both fulfilled temp-file source reads validate the captured physical and logical owner before stamp comparison or continuation. Picker settlement validates ownership before cancellation or another read. Destination-read completion also checks ownership before a destination write.
- Database and file saves share `finishWrite`, including captured ownership and serialized-PGN comparison. Database success clears dirty only for current matching content. File completion retains written stamps, revisions and uncertainty handling. Both CAS write sites share the captured PGN and game-number request construction.
- Autosave and user Save share one callback and failure presentation. Current-owner typed failures go through `notifyUnlessCancelled` and `Common.Error`. Autosave cancellation and supersession remain silent. User Save retains its superseded and conflict translations.
- The catch-entry ownership guard remains. Only its redundant inner ownership conditional was removed, with both applied-despite-error updates retained.
- The existing file-backed predicate replaces duplicate kind detection. BoardAnalysis shares its normalized error presenter, chooses one Add Game catch error, and routes parsing failures through the existing outer catch and cleanup. These are real duplication consolidations inside the owned paths. They remove no diagnostics or safety checks.

The new tests retain actual durable replacement at the first source read, post-picker source read, picker and destination read. Replacement preserves logical ID, file and page while changing physical treeKey. Both matching and mismatched source stamps are covered. Assertions retain the new tree, freshness and durable bytes and reject obsolete reads, pickers and writes. Active-owner mismatch and successful matching Save As controls remain.

Database tests assert the exact captured native PGN, retained newer comments or headers, unchanged saved content and superseded physical ownership. Autosave tests drive the production BoardAnalysis callback, actual saveToFile, real tree-store edits and real notification helper. Only the native boundary and notification display are mocked. No replacement helper is mocked into the proof. All five existing late-rejection categories and the active-owner uncertainty controls remain.

Launch HEAD: `f93ea300823137b4365cb8f2f9de4d39e2f95074`.

Launch and final index SHA-256: `18e4758c9b257e8b54644f6ec890f69eb7733a2b968049439d36b534f65a56ed`.

`launch-head.txt`, `launch-index.txt` and `launch-index-sha.txt` record the launch base. `final-integrity.json` verifies unchanged HEAD, unchanged index entries and bytes, intact root records, exact equality of owned worktree files with the frozen and restored candidate, and changes restricted to authorized own and peer paths. Authorized peer work was preserved. No files were staged, committed or pushed.

Exact test command for every baseline, fault and restoration:

```text
pnpm test src/utils/tabs.test.ts src/components/boards/BoardAnalysis.test.tsx src/components/panels/info/InfoPanel.test.tsx src/state/atoms.lifecycle.test.ts
```

Final baseline: exit 0, four suites and 168 tests passed. Every exact restoration has the same four-suite, 168-test result and exit 0. Seventeen regression cases were added across the owned test files. Existing cases remain.

Final semantic fault evidence:

| Fault | Precise production change | Retained semantic assertion | Fault exit and count | Restoration |
| --- | --- | --- | --- | --- |
| first-source | Remove only first fulfilled source ownership guard | Mismatched stamp changes replacement freshness from verified to conflict. Matching stamp starts an obsolete picker | 1, 2 failed and 166 passed | 0, 168 passed |
| post-picker-source | Remove only second fulfilled source ownership guard | Mismatched stamp changes replacement freshness. Matching stamp starts an obsolete destination read | 1, 2 failed and 166 passed | 0, 168 passed |
| picker | Remove only picker-settlement ownership guard | Selected outcome starts an obsolete source read. Cancellation returns cancelled instead of superseded | 1, 2 failed and 166 passed | 0, 168 passed |
| destination | Remove only destination-read ownership guard | Obsolete destination writer is called | 1, 1 failed and 167 passed | 0, 168 passed |
| database-owner | Remove only shared completion ownership guard | Superseded database owner becomes clean. Existing file-owner controls and autosave stamp protection also fail | 1, 4 failed and 164 passed | 0, 168 passed |
| database-dirty | Treat database serialized content as unchanged | Newer comment and header become clean despite captured native PGN | 1, 2 failed and 166 passed | 0, 168 passed |
| autosave-failure | Restrict shared failed-result presentation to user Save | Actual I/O and resource-limit autosave notifications are missing | 1, 2 failed and 166 passed | 0, 168 passed |
| catch-entry | Remove only catch-entry ownership guard | Five stale rejection categories change replacement freshness or state. Stale autosave failure notifies | 1, 6 failed and 162 passed | 0, 168 passed |

Each row has its exact `<fault>.fault.patch`, `<fault>.restore.patch`, apply and restore logs, `<fault>-fault.log`, same-run exit artifact, and restored log and exit artifact. `results.json` and `proof.receipt` record all eight final pairs. The logs contain named FAIL entries and assertion diagnostics, not import or harness failures.

Disposable-copy construction used `git archive HEAD`, tar extraction, `git diff --binary` and `git apply` of the captured candidate patch. Dependencies are linked from the existing node_modules. No main-index mutation is involved. `run-proof.py` applies and restores faults with apply_patch, checks exact production changes against the frozen candidate, and invokes the exact test command sequentially.

`owned.sha256` freezes the four final owned files. `tests.sha256` covers 177 test files and `source.sha256` covers 508 source files. Every fault and restoration retains its own source and test SHA manifest. Assertions, mocks and expectations are unchanged during every fault run. Final owned tests are byte-identical across the initial, second, third and final proof series. The final restored candidate matches the complete source manifest.

Earlier full proof series and failed bundle attempts remain under `initial/`, `second/` and `third/`. Each series independently contains eight assertion-failure/restoration pairs. Final source changes triggered the final full proof series. There are four series of 17 exact test invocations, plus the initial local exact run, for 69 exact-command executions. No prior failure evidence was overwritten. Between the initial and second snapshots, an authorized peer updated FileFreshnessGate.test.tsx. A deliberately broader cross-snapshot test-manifest comparison detected that peer change. Both owned test files remained identical, and each individual fault series kept all of its snapshot tests unchanged.

Final local checks:

```text
pnpm exec oxfmt --check src/utils/tabs.ts src/utils/tabs.test.ts src/components/boards/BoardAnalysis.tsx src/components/boards/BoardAnalysis.test.tsx
pnpm exec oxlint --deny-warnings src/utils/tabs.ts src/utils/tabs.test.ts src/components/boards/BoardAnalysis.tsx src/components/boards/BoardAnalysis.test.tsx
pnpm exec tsgo --noEmit
git diff --check
```

Each exited 0. Full output and exits are in `format.*`, `lint.*`, `tsgo.*` and `diff-check.*`. Scoped formatting writes used `pnpm exec oxfmt` on owned files only. Before the first freeze, typechecking found the nullable optional stamp argument and lint found one conditional expectation. The nullable argument was corrected and the expectation made unconditional before any fault run. The initial type diagnostic was TS2345 at tabs.ts:450, string-or-null-or-undefined was not assignable to string-or-undefined. The initial lint diagnostic was jest/no-conditional-expect at BoardAnalysis.test.tsx:639.

Bundle commands were `pnpm build-vite` followed by `pnpm bundle:check` in separate Git-derived disposable copies. All five builds exited 0. All five bundle checks exited 1. Their full logs, exits and copy patches remain available. Exact totals were obtained using the existing `buildBundleReport` export against each emitted Vite manifest, without changing its code or the budget.

| Candidate | Total gzip bytes | Excess over fixed 1620000 |
| --- | --- | --- |
| Initial repair | 1620059 | 59 |
| Shared error presenter | 1620051 | 51 |
| Predicate and catch consolidation | 1620073 | 73 |
| Outer parsing-error contract | 1620074 | 74 |
| Final shared CAS request | 1620065 | 65 |

The final report is entry 540200, largestLazy 514899 and total 1620065. Entry and largestLazy are below their unchanged 550000 limits. The historical root total 1619967 is not evidence for the edited candidate. Consolidation attempts did not solve the total budget. No baseline, coverage floor, bundle limit, configuration or minifier workaround was changed. Root must resolve the remaining budget blocker before green-gate acceptance.

Canonical command, attempted exactly once after final source and local proof inputs were frozen:

```text
pnpm checks:pre-review
```

Actual exit: 143. The attempt waited behind an existing repository pre-review process, PID 759854, holding the machine heavy-gate lock since 07:52:57. The queued attempt was terminated within this bounded leaf. The foreign holder was not signaled. `canonical-interruption.json` records only the terminated descendants of this proof's canonical-child.sh. This was an interrupted queued attempt, not a successful gate or a spontaneous launcher refusal. No direct-gate fallback or retry ran.

Full canonical output, also retained verbatim in `canonical.log`:

```text

> chessfable@0.15.0 checks:pre-review /home/felixb/Projekte/chessfable
> agent-gate node scripts/run-push-gates.mjs --pre-review

Waiting for heavy-gate lock held by: repo=chessfable pid=759854 start=2026-10-10T07:52:57+02:00
 ELIFECYCLE  Command failed.
```

Deviations and blockers: The destination-read guard and its independent fault strengthen the requested obsolete-write continuation protection. Required savings prompted the documented duplication consolidations, all inside owned paths. The total bundle budget is still red, and canonical pre-review did not execute because of the foreign lock. No broader scope was taken. No skills, agents, records, browser or native verification were used. Root owns independent integrated pre-review, mutation and contract after EOS. Source proof does not claim pixels or native behavior.

Plan authorship and arbitration shared one context. Detection ran on the code model family.
````

## Raw initial reload writer report

````text
# R5 reload rejection ownership repair

Finding: f-20261010-20. Bounded write leaf, source and unit-test verification only.

Plan authorship and arbitration shared one context. Detection runs on the code model family.

## Owned changes

- `src/components/tabs/FileFreshnessGate.tsx`: reload rejection now checks the existing `actionIsCurrent(signal)` before error normalization, freshness changes or panel error publication. This matches fulfillment ownership and retains cancellation behavior.
- `src/components/tabs/FileFreshnessGate.test.tsx`: nine additional cases. Four deferred obsolete rejections cover `missing-resource`, `invalid-input`, `conflict` and ordinary `io`. Four active-owner controls preserve proper reporting. One unmount control verifies signal abortion and silent late rejection.

Production change is one predicate substitution. `runAction` is unchanged. All original test bodies, including the physical-generation fulfillment witness, remain byte-identical.

The obsolete rejection cases use real durable seeding, the real Jotai workspace commit and real cached-store retargeting. Only the physical tree key changes. Whole-tab equality asserts unchanged logical ID, origin, file, page and metadata. Active selection and cached-store identity are also retained. The pending signal remains un-aborted before and after rejection. A cold repository reads the staged tree before publication and the installed tree after flush. Content, comment, source stamp, verified freshness identity and normalized durable bytes survive rejection. Moving freshness to a later conflict reveals the panel and detects an otherwise hidden stale ordinary error. Pending actions become available again.

## Read and scope evidence

Read all six named rule files fully and the full R5 handoff. Read only f-20261010-20 from the findings ledger. Read the full owned component and tests, both other exact-test suites, the production `BoardsPage` caller, `TreeRecoveryGate`, `files.ts`, `errors.ts`, and the relevant durable seeding, Jotai commit, physical-key lookup and retarget execution paths. Traced `InfoPanel` replacement and freshness publication as the production counterpart. No project `CLAUDE.md`, environment files, skills, agents, records edits, browser or native verification were used.

Launch HEAD: `f93ea300823137b4365cb8f2f9de4d39e2f95074`. Launch status was clean. `launch-head.txt`, `launch-index.txt` and `launch-status.txt` preserve the launch baseline. Main HEAD and full staged index remain byte-identical. Authorized peer modifications in the other seven paths remain untouched and unstaged.

## Exact commands

T, the required suite command:

```sh
pnpm test src/components/tabs/FileFreshnessGate.test.tsx src/components/tabs/TreeRecoveryGate.test.tsx src/state/atoms.lifecycle.test.ts
```

F, the retained fulfillment witness:

```sh
pnpm test src/components/tabs/FileFreshnessGate.test.tsx -t 'a pending reload cannot overwrite a replacement with only its physical generation changed'
```

S, scoped checks and complete typechecking:

```sh
pnpm exec oxfmt --check src/components/tabs/FileFreshnessGate.tsx src/components/tabs/FileFreshnessGate.test.tsx
pnpm exec oxlint --deny-warnings src/components/tabs/FileFreshnessGate.tsx src/components/tabs/FileFreshnessGate.test.tsx
pnpm exec tsgo --noEmit
git diff --check
```

Formatting used `pnpm exec oxfmt src/components/tabs/FileFreshnessGate.tsx src/components/tabs/FileFreshnessGate.test.tsx`, exit 0. Manual source, test and proof-script edits used `apply_patch`.

All long verification children use the same detached receipt pattern:

```sh
setsid nohup bash /tmp/build-game-opening-3b67c3b9/r5-reload-proof/run-proof.sh LABEL COMMAND... > /tmp/build-game-opening-3b67c3b9/r5-reload-proof/LABEL.launch.log 2>&1 < /dev/null &
disown
```

`LABEL.command` records the exact argv. `LABEL.log` preserves full stdout and stderr. `LABEL.exit` is written by that same runner immediately after that command settles. Started and finished timestamps accompany each run. Waiting inspects named receipt and log artifacts and never uses `pgrep`.

## Verification and faults

| Run | Command | Location | Exit | Result |
| --- | --- | --- | --- | --- |
| baseline-v5 | T | Disposable candidate | 0 | 3 suites, 102 passes |
| rejection-fault | T | Disposable candidate | 1 | 4 semantic failures, 98 passes |
| rejection-restored | T | Disposable candidate | 0 | 3 suites, 102 passes |
| fulfillment-fault | F | Disposable candidate | 1 | 1 semantic failure, 47 skipped |
| fulfillment-restored | F | Disposable candidate | 0 | 1 pass, 47 skipped |
| frozen-static | S | Main worktree | 0 | Format green, 0 lint warnings or errors, typecheck and diff check green |
| final-exact | T | Main worktree | 0 | 3 suites, 102 passes |
| canonical-pre-review | `pnpm checks:pre-review` | Main worktree | 1 | Build, format/lint, coverage mapping and changed-file mutation passed. Bundle exceeded fixed total limit. |

`rejection-fault.patch` reverts only the reload catch predicate from `actionIsCurrent(signal)` to `!signal.aborted`. The three resource-category witnesses fail their freshness identity assertion at test line 1011. Expected verified replacement revision becomes unavailable with a new epoch and null revision. The `io` witness fails its stale panel assertion at line 1020, observing `obsolete reload io failure` on the later conflict. Every category has its own named `FAIL` in the preserved log. Exit 1 comes from that same run. Active-owner and unmount controls remain green. No assertion, mock or expected result was changed during this or any other fault run.

`fulfillment-fault.patch` removes only `getTabTreeKey(currentTab) === getTabTreeKey(tab)` from `actionIsCurrent`. The retained unchanged fulfillment witness fails its state identity assertion at line 951. The diagnostic explicitly shows event changing from `Replacement generation` to `Obsolete reload` and source stamp changing from c to b. Exit 1 comes from that same run.

Each fault was reversed with `apply_patch`. Complete source manifests matched the frozen candidate before restored tests ran. Each exact restoration passed as shown above.

## Integrity

The disposable candidate was created with `git archive HEAD | tar -x -C /tmp/build-game-opening-3b67c3b9/r5-reload-proof/candidate`, then overlaid with the owned candidate changes. It uses the installed workspace dependencies through a `node_modules` symlink. `final-candidate.patch` records the final owned diff. This is a Git-derived candidate, not a separate mock implementation.

- Production-source manifest: 331 files in `final-source.sha256`.
- Test manifest: 177 files in `final-tests.sha256`.
- Each fault/restoration has separately named source and test SHA-256 manifests.
- All four fault/restoration test manifests equal the frozen final manifest byte-for-byte.
- Each fault changes exactly one production source file, the owned gate.
- Each restoration restores the entire source manifest byte-for-byte.
- Final main source and owned tests equal `final-source.tsx` and `final-test.tsx` byte-for-byte.
- Original test bodies and the retained fulfillment witness match launch HEAD exactly.
- Named handoff and findings records match launch HEAD byte-for-byte.
- `integrity.txt` records all successful integrity assertions.

Frozen owned SHA-256:

```text
fa5ed6a3a3fe1e2d5f72b61498ff7f0227adca08111e11225fc444cebc273f1e  src/components/tabs/FileFreshnessGate.tsx
63776cca6fe6d4d196110451ee93778b5c8b4f2e1e94441a9eac248a926771d6  src/components/tabs/FileFreshnessGate.test.tsx
```

## Preserved setup failures and diagnoses

These are pre-freeze setup iterations, not semantic fault evidence. Their original logs and receipts remain intact.

| Run | Exit | Diagnosis |
| --- | --- | --- |
| baseline | 1, 4 failed and 98 passed | Invoking `replaceFileGame` through the recovery wrapper causes the pending signal to abort during immediate old-key cleanup. It cannot demonstrate the specified un-aborted race in this harness. |
| baseline-v2 | 1, 4 failed and 98 passed | Byte snapshot preceded the retargeted store's pending persistence flush. |
| baseline-v3 | 1, 4 failed and 98 passed | The installed persisted store correctly adds `practicePath: null`, absent from a plain `defaultTree` candidate. |
| baseline-v4 | 1, 4 failed and 98 passed | Cold repository validation canonicalizes serialized field ordering. Snapshot must follow that read. |
| local-static | 1 | Two oxlint warnings reject Vitest's optional second assertion argument. Removed those labels before proof freeze. |
| local-static-v2 | 0 | Scoped format, lint, typecheck and diff checks green. |

The initial absolute `git apply --directory` attempt was rejected as an invalid path. Running `git apply` from the disposable directory succeeded. Subsequent candidate updates copied owned files from the main worktree before final proof freeze.

The final stale-rejection witness follows the existing fulfillment witness's actual durable seed, Jotai commit and retarget mechanism. It deliberately avoids immediate old-key removal that would make cancellation settle this race. No production cleanup, admission, metadata, storage or recovery behavior was changed. The cleanup-triggered transient gate is an observation from test setup, not an independently diagnosed production defect. It is outside this repair and is reported here for root review without any records change.

## Canonical pre-review attempt

Executed `pnpm checks:pre-review` once from the main worktree after final local proof freeze. The full output is preserved in `canonical-pre-review.log` and the same-run exit 1 in `canonical-pre-review.exit`. No launcher bypass was used. The launcher waited for an existing heavy-gate lock and then started normally.

Actual result: exit 1 from the bundle lane. Frontend build passed in 6.9 seconds, format/lint passed in 1.3 seconds, frontend coverage mapping passed in 0.4 seconds, and changed-file mutation passed in 326.5 seconds. The runner selected 71 changed paths, so this is the cumulative worktree gate rather than an isolated measurement of this one-line repair.

Exact bundle measurement from the canonical build is preserved in `canonical-bundle-measurement.json`: entry 540198 bytes, largest lazy 514911 bytes, total 1620073 bytes. The total exceeds the unchanged 1620000 limit by 73 bytes. This is a genuine remaining gate blocker. No bundle budget, coverage floor, safety behavior or diagnostic was reduced. No additional source consolidation was made after proof freeze. A possible consolidation is not claimed to save sufficient bytes without build evidence. Root must resolve the cumulative bundle size within authorized source scope before green integration.

Full per-lane output was copied into `canonical-gate-logs`, and mutation package logs were copied into `canonical-mutation-logs` so later runner pruning or package-log overwrites cannot remove this attempt's evidence. All three mutation packages finished at 100%. Game-practice killed 87 mutants. Workspace-storage killed 1068 mutants. The tree-path package killed 169 mutants and timed out 7, with zero survivors or errors.

## Deviations and remaining root obligations

No production scope expansion, new modules, persistence mechanism, recovery UI, configuration or budget changes. `runAction` remained intact. The bundle total limit stays 1620000. The earlier 1619967 measurement is historical and is not claimed for this candidate. No savings or numeric baseline reductions were introduced.

Root still owns independent integrated pre-review, mutation, contract proof, cumulative review and any required pixel or native verification after all peers terminate. The cumulative bundle gate remains blocked as recorded above. This leaf leaves only the two owned changed files unstaged, plus artifacts in the assigned proof directory.

## Full canonical stdout and stderr

```text

> chessfable@0.15.0 checks:pre-review /home/felixb/Projekte/chessfable
> agent-gate node scripts/run-push-gates.mjs --pre-review

Waiting for heavy-gate lock held by: repo=chessfable pid=750505 start=2026-10-10T07:46:55+02:00
Pre-review changed paths: 71
Pre-review selected lanes: format-lint, coverage-mapping-frontend, frontend-mutation-changed-files, bundle
start frontend-build duration=0.0s command=pnpm gate:run frontend-build
finish frontend-build duration=6.9s exit=0
start format-lint duration=0.0s commands=3
start coverage-mapping-frontend duration=0.0s commands=1
start bundle duration=0.0s commands=1
finish coverage-mapping-frontend duration=0.4s exit=0
finish bundle duration=0.5s exit=1
finish format-lint duration=1.3s exit=0
start frontend-mutation-changed-files duration=0.0s commands=1
finish frontend-mutation-changed-files duration=326.5s exit=0
Pre-review check logs: /home/felixb/Projekte/chessfable/artifacts/gates/20261010T055257247Z-759854
Task                 Status                       Exit   Duration
-------------------- ---------------------------- ------ --------
frontend-build       passed                       0      6.9s
format-lint          passed                       0      1.3s
coverage-mapping-frontend passed                       0      0.4s
coverage-mapping-backend skipped                      -      0.0s
  reason: no relevant changed paths
frontend-mutation-changed-files passed                       0      326.5s
windows-clippy       skipped                      -      0.0s
  reason: no relevant changed paths
bundle               failed                       1      0.5s

bundle log tail (/home/felixb/Projekte/chessfable/artifacts/gates/20261010T055257247Z-759854/bundle.log):
$ pnpm bundle:check

> chessfable@0.15.0 bundle:check /home/felixb/Projekte/chessfable
> node scripts/check-bundle-budget.mjs

total bundle budget exceeded: 1582.1 KiB, limit 1582.0 KiB
 ELIFECYCLE  Command failed with exit code 1.
pre-review check failed: bundle — log: /home/felixb/Projekte/chessfable/artifacts/gates/20261010T055257247Z-759854/bundle.log
 ELIFECYCLE  Command failed with exit code 1.
```

Same-run terminal receipt: `canonical-pre-review.exit` contains `1`.
````

## Raw initial checkmate writer report

````text
# R5 checkmate precedence repair, f-20261010-23

Owned paths are `src/state/store/tree.ts` and `src/state/store/tree.test.ts`. Changes remain unstaged. No agents, skills, records edits, browser verification, native verification, staging, commits or push were performed.

Launch HEAD is `f93ea300823137b4365cb8f2f9de4d39e2f95074`. Launch status was clean and the cached diff was empty. The saved index is `launch-index.bin`. Its SHA-256 is `18e4758c9b257e8b54644f6ec890f69eb7733a2b968049439d36b534f65a56ed`.

## Mechanism and scope

The later repetition/fifty-move draw branch now requires `!pos.isCheckmate()`. The existing checkmate assignment retains the winning result. The fifty-move threshold remains 100. No adjudication policy was introduced.

Eight real-position tests were added. Four mating cases cover White and Black winning at initial halfmove clocks 99 and 0. Three draw cases cover ordinary fifty-move adjudication, stalemate and insufficient material. The final case verifies that `changeHeaders: false` retains the exact headers object and its previously recorded result during checkmate at halfmove 100. Existing repetition and disabled fifty-move-header tests remain intact.

The tests use real chessops positions and the actual `createTreeStore`. They verify setup validity, move legality, SAN mate indication, resulting checkmate or draw properties, resulting halfmove clock, installed tree-node FEN and the game result. There are no new reducer mocks. The reported White witness is `7k/5Q2/6K1/8/8/8/8/8 w - - 99 1`, followed by `Qg7#`.

All six named rule files and the complete R5 handoff were read. Only the named finding was inspected in the ledger. Full owned source and tests, full hydration and treeReducer tests, the real position helper, the treeReducer implementation, chessops end-state methods and production move callers were read. The full project CLAUDE.md and environment files were not read.

## Final frozen proof

The authoritative final proof is under `final/`. Its disposable candidate was extracted from a Git archive of the launch HEAD and overlaid with only the two final owned files. Environment files were excluded. Existing dependencies were linked from the checkout.

The requested path `src/utils/tests/treeReducer.test.ts` exists and is registered by Vitest. No fallback or skipped suite was needed.

Exact full test command:

```text
pnpm test src/state/store/tree.test.ts src/state/store/tree.hydration.test.ts src/utils/tests/treeReducer.test.ts
```

| Run | Exit | Result | Evidence |
| --- | --- | --- | --- |
| Final candidate green | 0 | 3 files, 99 tests passed | `final/green.log`, `final/green.exit` |
| Final source fault | 1 | 1 unique mating assertion failed, 67 tests skipped by deliberate selection | `final/fault.log`, `final/fault.exit` |
| Exact restoration, selected witness | 0 | 1 test passed, 67 skipped | `final/restored-witness.log`, `final/restored-witness.exit` |
| Exact restoration, full command | 0 | 3 files, 99 tests passed | `final/restored.log`, `final/restored.exit` |
| Shared checkout, full command | 0 | 3 files, 99 tests passed | `final/main-tests.log`, `final/main-tests.exit` |

The exact selected fault and restored-witness command is:

```text
pnpm test src/state/store/tree.test.ts -t "^makeMove preserves 'white' checkmate at halfmove clock 99$"
```

Only the production guard line was removed in the disposable candidate. The exact removal and restoration patches are `final/precedence-removal.patch` and `final/precedence-restoration.patch`. The fault run reports:

```text
FAIL src/state/store/tree.test.ts > makeMove preserves 'white' checkmate at halfmove clock 99
AssertionError: expected '1/2-1/2' to be '1-0'
Expected: "1-0"
Received: "1/2-1/2"
Tests 1 failed | 67 skipped (68)
```

The failure is the result assertion at tree.test.ts:212. The legality, checkmate, halfmove-100 and actual installed-node assertions precede it and passed in that same run. The matching same-run exit receipt is 1. Restoration changed only the removed source line and restored every production hash exactly before the witness and full green runs.

The source and test SHA manifests are `final/green-source-sha256.json`, `final/green-test-sha256.json`, their `fault-` counterparts and their `restored-` counterparts. They cover 321 production/assets files and 187 test/support files. Fault state changes exactly one production file, tree.ts. Every test/support file is unchanged. Restoration returns both entire manifests to their original values.

Final owned hashes:

```text
src/state/store/tree.ts
b36532534443a1d44fb4fb49c5638cd782fb801b113c5072c6f86f022d549300
src/state/store/tree.test.ts
7031b80f89e000ab83e2775f95c1326cf4fd438c530edd7cc1e4a0b6c3e1203e
```

`final/integrity.json` proves the shared owned source and test are byte-identical to the final restored candidate. It also proves unchanged HEAD and index, exact preservation of all pre-existing tests, and exactly one production adjudication change. Therefore every persisted storage/retarget/report-owner function is byte-identical to launch source. `MAX_GENERATED_ANALYSIS_VARIATION_PLIES` remains 10. All 147 tracked root records were compared byte-for-byte against launch HEAD and remain intact. Their hashes are in `final/root-records-sha256.json`.

`final/final-status.txt` records only the two owned changes and the authorized peer paths. Peer changes were preserved. `final/final-owned.patch` is the owned review diff.

## Local checks

All commands ran in the shared checkout after the final owned source/test freeze:

| Command | Exit | Evidence |
| --- | --- | --- |
| `pnpm exec oxfmt --check src/state/store/tree.ts src/state/store/tree.test.ts` | 0 | `final/format.log`, `final/format.exit` |
| `pnpm exec oxlint --deny-warnings src/state/store/tree.ts src/state/store/tree.test.ts` | 0, zero warnings/errors | `final/lint.log`, `final/lint.exit` |
| `pnpm exec tsgo --noEmit` | 0 | `final/typecheck.log`, `final/typecheck.exit` |
| `git diff --check` | 0 | `final/diff-check.log`, `final/diff-check.exit` |

Scoped `pnpm exec oxfmt src/state/store/tree.ts src/state/store/tree.test.ts` also exited 0. Long commands were detached using `setsid nohup ... & disown`. Completion was checked through named log and exit artifacts, never process-name polling.

## Preserved diagnoses

Initial proof artifacts at the proof-directory root are retained and are historical. The first anchored witness selector omitted Vitest's quotes around the parameterized winner name, so it selected zero tests and exited 0. This was not accepted as fault proof. `fault.log` and `fault.exit` retain it.

The full verbose diagnostic then ran the exact three-suite selection with `--reporter=verbose`. It exited 1 with 97 passes and two semantic failures, the White and Black halfmove-99 mating results becoming draws. `fault-diagnose.log` retains both. The corrected selected witness then failed uniquely with exit 1, followed by exact source restoration green.

The first scoped lint run exited 1 because the fifty-move test called `expect` conditionally. After source restoration, the draw rows were given explicit expected halfmove clocks and the assertion was made unconditional. No assertion, mock or expectation changed during any source-fault run. The final disposable candidate was recreated and the entire source-fault/restoration sequence was repeated with final byte-identical tests. Initial diagnostics and manifests were not overwritten.

Real unmocked store imports log existing sound-server/Tauri invocation and atomFamily deprecation diagnostics in some selected runs. These are retained in full logs. The required failure is the result assertion, not an import or infrastructure failure.

## Canonical attempt

Exactly one `pnpm checks:pre-review` was launched in the shared checkout after the final local proof freeze, through its canonical `agent-gate` launcher. The launcher accepted the run. There was no bypass.

The canonical receipt and complete stdout/stderr are `final/canonical.exit` and `final/canonical.log`. The launcher-selected changed-path set includes the enclosing branch and authorized peers, so this is broader than the isolated owned proof.

The canonical bundle lane failed. A read-only measurement through the repository's actual `buildBundleReport` recorded entry 540208 bytes, largest lazy 514885 bytes and total 1620059 gzip bytes. The fixed total limit remains 1620000. The current measured total exceeds it by 59 bytes. `final/bundle-measurement.json` retains the exact measurement. The prior root total 1619967 is historical and is not presented as a current gate pass.

The canonical command completed with exit 1. Frontend build, format/lint, coverage mapping and the changed-files frontend mutation lane all passed. Bundle alone failed. Mutation completed in 353.8 seconds. Full gate logs and raw mutation reports were copied into `final/canonical-gate-logs/` and `final/canonical-mutation/`. Exact mutant counts are recorded in `final/canonical-mutation-counts.json`.

Complete canonical stdout/stderr:

```text

> chessfable@0.15.0 checks:pre-review /home/felixb/Projekte/chessfable
> agent-gate node scripts/run-push-gates.mjs --pre-review

Pre-review changed paths: 71
Pre-review selected lanes: format-lint, coverage-mapping-frontend, frontend-mutation-changed-files, bundle
start frontend-build duration=0.0s command=pnpm gate:run frontend-build
finish frontend-build duration=6.3s exit=0
start format-lint duration=0.0s commands=3
start coverage-mapping-frontend duration=0.0s commands=1
start bundle duration=0.0s commands=1
finish coverage-mapping-frontend duration=0.4s exit=0
finish bundle duration=0.5s exit=1
finish format-lint duration=1.3s exit=0
start frontend-mutation-changed-files duration=0.0s commands=1
finish frontend-mutation-changed-files duration=353.8s exit=0
Pre-review check logs: /home/felixb/Projekte/chessfable/artifacts/gates/20261010T054655499Z-750505
Task                 Status                       Exit   Duration
-------------------- ---------------------------- ------ --------
frontend-build       passed                       0      6.3s
format-lint          passed                       0      1.3s
coverage-mapping-frontend passed                       0      0.4s
coverage-mapping-backend skipped                      -      0.0s
  reason: no relevant changed paths
frontend-mutation-changed-files passed                       0      353.8s
windows-clippy       skipped                      -      0.0s
  reason: no relevant changed paths
bundle               failed                       1      0.5s

bundle log tail (/home/felixb/Projekte/chessfable/artifacts/gates/20261010T054655499Z-750505/bundle.log):
$ pnpm bundle:check

> chessfable@0.15.0 bundle:check /home/felixb/Projekte/chessfable
> node scripts/check-bundle-budget.mjs

total bundle budget exceeded: 1582.1 KiB, limit 1582.0 KiB
 ELIFECYCLE  Command failed with exit code 1.
pre-review check failed: bundle — log: /home/felixb/Projekte/chessfable/artifacts/gates/20261010T054655499Z-750505/bundle.log
 ELIFECYCLE  Command failed with exit code 1.
```

EOS integrity was checked again after canonical completion. HEAD and index remain unchanged, both owned files still match the frozen candidate, all 147 root records remain intact, and `git diff --check` exits 0. Evidence is `final/eos-integrity.json`, `final/eos-status.txt` and `final/eos-diff-check.*`.

## Deviations and blockers

The initial ledger context search emitted the adjacent f-20261010-24 entry along with the requested f-20261010-23 entry. It was not used for this repair and no ledger entry was edited.

The scoped repair and requested real-store semantic proof are complete. Canonical bundle validation is a root integration blocker. No budget, coverage floor, backend, schema, persistence mechanism or configuration was changed. No scope expansion was attempted. No pixels or native behavior were verified, as explicitly excluded by this assignment. Root independently owns the integrated full pre-review, mutation and contract after EOS.

Plan authorship and arbitration shared one context. Detection ran on the code model family.
````

## Raw initial start-limit writer report

````text
# R5 Start path limit repair report

**Finding:** `f-20261010-21`

**Owned repository path:** `src/utils/chess.ts`

**Proof directory:** `/tmp/build-game-opening-3b67c3b9/r5-start-limit-proof`

## Change

Added the module constant `MAX_START_PATH_LENGTH = 512` and used it in both `parseStartHeader`
and `parseRawStartHeader`. Both parser paths retain the existing 512 accepted and 513 refused
behavior. No parser, save, comment, test, mock, assertion or expected-result logic changed.

The repository diff is limited to `src/utils/chess.ts`. It has four added lines and two removed
lines because the constant and its blank line were added, then the two repeated literals were
replaced.

## Base and integrity

- Launch HEAD: `f93ea300823137b4365cb8f2f9de4d39e2f95074`.
- Launch index tree: `3630fd7c76bc9237569bdbd04b5dfb8c03462d62`.
- Final HEAD and index tree match those launch values. The index remained unchanged.
- Candidate proof copy: `git archive` from launch HEAD with only candidate `src/utils/chess.ts`
  overlaid. Its `node_modules` points to the repository install.
- Launch `src/utils/chess.ts` SHA-256: `ca2a0c8f6d86191314a1aa7cc2047f4f5e747b9d4093a4f0f0723764830dbc5d`.
- Candidate and working-tree `src/utils/chess.ts` SHA-256:
  `07ea714be999ba44c80b8b451f4df8fef96eb6c4a9a6431a68dfc585bf468906`.
- Launch, candidate and working-tree `src/utils/tests/chess.test.ts` SHA-256:
  `466966fc2735522d8813512248e3f67570745ca621687e2b609862aabd3b854d`.
- Candidate test comparison against the working-tree test exited 0. The same hash matches the
  launch test bytes.
- Final owned source diff: four insertions and two deletions. `git diff --check` exited 0.

The shared worktree also held authorized peer edits in `BoardAnalysis.tsx` and its test,
`FileFreshnessGate.tsx` and its test, `tree.ts` and its test, and `tabs.ts` and its test. They were
left intact. No files were staged.

## Proof commands

All candidate checks ran from the Git-derived disposable copy.

| Command | Exit | Evidence |
| --- | ---: | --- |
| `pnpm test src/utils/tests/chess.test.ts` | 0 | 1 file passed, 46 tests passed |
| `pnpm exec oxfmt --check src/utils/chess.ts` | 0 | 1 file formatted |
| `pnpm exec oxlint --deny-warnings src/utils/chess.ts` | 0 | 0 warnings, 0 errors |
| `pnpm exec tsgo --noEmit` | 0 | No diagnostics |
| `git diff --check` | 0 | No whitespace errors |

Parser test output is preserved in [parser-test.log](/tmp/build-game-opening-3b67c3b9/r5-start-limit-proof/parser-test.log)
with exit receipt [parser-test.exit](/tmp/build-game-opening-3b67c3b9/r5-start-limit-proof/parser-test.exit).
Typecheck output and exit receipt are [tsgo.log](/tmp/build-game-opening-3b67c3b9/r5-start-limit-proof/tsgo.log)
and [tsgo.exit](/tmp/build-game-opening-3b67c3b9/r5-start-limit-proof/tsgo.exit). Source and test hashes
are also recorded in [LOCAL-PROOF-FREEZE.md](/tmp/build-game-opening-3b67c3b9/r5-start-limit-proof/LOCAL-PROOF-FREEZE.md).

## Semantic fault and restoration evidence

No standalone fault or restoration was run. The frozen specification explicitly waives a standalone
fault for this naming-only correction because the unchanged parser tests already cover 512 accepted
and 513 refused. No assertion, mock, expected result or test byte was edited. There is no source
fault to restore.

## Canonical pre-review

Ran the single required command `pnpm checks:pre-review` from the shared project checkout after the
local proof freeze. It exited 2. The complete output is preserved verbatim in
[pre-review.log](/tmp/build-game-opening-3b67c3b9/r5-start-limit-proof/pre-review.log), with exit receipt
[pre-review.exit](/tmp/build-game-opening-3b67c3b9/r5-start-limit-proof/pre-review.exit), and is reproduced
below.

The gate detected 71 changed paths and selected `format-lint`, `coverage-mapping-frontend`,
`frontend-mutation-changed-files` and `bundle`. Coverage mapping passed. Frontend build failed with a
TypeScript error in peer-owned `src/utils/tabs.ts:450`. Format-lint reported four lint warnings in
peer-owned `BoardAnalysis.test.tsx`, `FileFreshnessGate.test.tsx` and `tree.test.ts`. The mutation
dry-run failed its initial test on the peer-owned stale-generation rejection case. Bundle was skipped
because frontend build failed. These peer paths remain for root review and were not changed here.

## Deviations and blockers

No deviation from the owned frozen specification. The owned parser test, scoped format, scoped lint,
typecheck and diff check passed. The canonical pre-review gate remains red for the peer-worktree
diagnostics listed above. Root owns the independent integrated pre-review, mutation and contract
proof after all peers reach EOS.

## Complete canonical pre-review output

```text

> chessfable@0.15.0 checks:pre-review /home/felixb/Projekte/chessfable
> agent-gate node scripts/run-push-gates.mjs --pre-review

Pre-review changed paths: 71
Pre-review selected lanes: format-lint, coverage-mapping-frontend, frontend-mutation-changed-files, bundle
start frontend-build duration=0.0s command=pnpm gate:run frontend-build
finish frontend-build duration=0.9s exit=2
start format-lint duration=0.0s commands=3
start coverage-mapping-frontend duration=0.0s commands=1
finish coverage-mapping-frontend duration=0.3s exit=0
finish format-lint duration=0.9s exit=1
start frontend-mutation-changed-files duration=0.0s commands=1
finish frontend-mutation-changed-files duration=30.0s exit=1
Pre-review check logs: /home/felixb/Projekte/chessfable/artifacts/gates/20261010T054443508Z-730827
Task                 Status                       Exit   Duration
-------------------- ---------------------------- ------ --------
frontend-build       failed                       2      0.9s
format-lint          failed                       1      0.9s
coverage-mapping-frontend passed                       0      0.3s
coverage-mapping-backend skipped                      -      0.0s
  reason: no relevant changed paths
frontend-mutation-changed-files failed                       1      30.0s
windows-clippy       skipped                      -      0.0s
  reason: no relevant changed paths
bundle               skipped                      -      0.0s
  reason: frontend-build failed, so this dist/ consumer was skipped

frontend-build log tail (/home/felixb/Projekte/chessfable/artifacts/gates/20261010T054443508Z-730827/frontend-build.log):
$ pnpm gate:run frontend-build

> chessfable@0.15.0 gate:run /home/felixb/Projekte/chessfable
> agent-gate node scripts/gate-receipt.mjs run frontend-build

gate running: frontend-build
  command: pnpm build-vite

> chessfable@0.15.0 build-vite /home/felixb/Projekte/chessfable
> tsgo --noEmit && vite build

src/utils/tabs.ts(450,50): error TS2345: Argument of type 'string | null | undefined' is not assignable to parameter of type 'string | undefined'.
  Type 'null' is not assignable to type 'string | undefined'.
 ELIFECYCLE  Command failed with exit code 2.
gate: frontend-build
command: pnpm build-vite
tree: fb1068d570b0924d619e39c156efeb4dbe513580
started: 2026-10-10T05:44:44.338Z


> chessfable@0.15.0 build-vite /home/felixb/Projekte/chessfable
> tsgo --noEmit && vite build

src/utils/tabs.ts(450,50): error TS2345: Argument of type 'string | null | undefined' is not assignable to parameter of type 'string | undefined'.
  Type 'null' is not assignable to type 'string | undefined'.
 ELIFECYCLE  Command failed with exit code 2.

exit: 2
duration: 429.3 ms

gate failed: frontend-build (exit 2) — transcript: /home/felixb/Projekte/chessfable/artifacts/gates/20261010T054443508Z-730827/receipt-frontend-build.log
 ELIFECYCLE  Command failed with exit code 2.

format-lint log tail (/home/felixb/Projekte/chessfable/artifacts/gates/20261010T054443508Z-730827/format-lint.log):
$ pnpm exec oxfmt --check coverage-areas.json coverage-baselines.json e2e/async-errors.spec.ts e2e/database-files.spec.ts e2e/file-freshness.spec.ts e2e/files-preview.spec.ts e2e/fixtures.ts e2e/font-scaled-breakpoints.spec.ts scripts/verify-app.mjs src/components/boards/BoardAnalysis.test.tsx src/components/boards/BoardAnalysis.tsx src/components/common/TreeStateContext.tsx src/components/common/gameOpen.test.tsx src/components/common/gameOpen.tsx src/components/databases/DatabasesPage.test.tsx src/components/databases/DatabasesPage.tsx src/components/databases/GameCard.test.tsx src/components/databases/GameCard.tsx src/components/databases/GameTable.test.tsx src/components/databases/GameTable.tsx src/components/files/FileCard.test.tsx src/components/files/FileCard.tsx src/components/panels/info/GameSelector.test.tsx src/components/panels/info/GameSelector.tsx src/components/panels/info/InfoPanel.test.tsx src/components/panels/info/InfoPanel.tsx src/components/tabs/BoardsPage.test.tsx src/components/tabs/BoardsPage.tsx src/components/tabs/FileFreshnessGate.test.tsx src/components/tabs/FileFreshnessGate.tsx src/components/tabs/TreeRecoveryGate.test.tsx src/components/tabs/TreeRecoveryGate.tsx src/state/atoms.lifecycle.test.ts src/state/atoms.ts src/state/store/tabStorage.test.ts src/state/store/tabStorage.ts src/state/store/tree.hydration.test.ts src/state/store/tree.test.ts src/state/store/tree.ts src/state/workspace.test.ts src/state/workspace.ts src/state/workspaceTypes.ts src/translation/be-BY.json src/translation/de-DE.json src/translation/en-GB.json src/translation/en-US.json src/translation/es-ES.json src/translation/fr-FR.json src/translation/it-IT.json src/translation/ko-KR.json src/translation/nb-NO.json src/translation/pl-PL.json src/translation/pt-PT.json src/translation/ru-RU.json src/translation/tr-TR.json src/translation/uk-UA.json src/translation/zh-CN.json src/translation/zh-TW.json src/utils/chess.ts src/utils/tabs.test.ts src/utils/tabs.ts src/utils/tests/chess.test.ts
Checking formatting...

All matched files use the correct format.
Finished in 187ms on 62 files using 24 threads.
$ pnpm exec oxlint --deny-warnings e2e/async-errors.spec.ts e2e/database-files.spec.ts e2e/file-freshness.spec.ts e2e/files-preview.spec.ts e2e/fixtures.ts e2e/font-scaled-breakpoints.spec.ts scripts/verify-app.mjs src/components/boards/BoardAnalysis.test.tsx src/components/boards/BoardAnalysis.tsx src/components/common/TreeStateContext.tsx src/components/common/gameOpen.test.tsx src/components/common/gameOpen.tsx src/components/databases/DatabasesPage.test.tsx src/components/databases/DatabasesPage.tsx src/components/databases/GameCard.test.tsx src/components/databases/GameCard.tsx src/components/databases/GameTable.test.tsx src/components/databases/GameTable.tsx src/components/files/FileCard.test.tsx src/components/files/FileCard.tsx src/components/panels/info/GameSelector.test.tsx src/components/panels/info/GameSelector.tsx src/components/panels/info/InfoPanel.test.tsx src/components/panels/info/InfoPanel.tsx src/components/tabs/BoardsPage.test.tsx src/components/tabs/BoardsPage.tsx src/components/tabs/FileFreshnessGate.test.tsx src/components/tabs/FileFreshnessGate.tsx src/components/tabs/TreeRecoveryGate.test.tsx src/components/tabs/TreeRecoveryGate.tsx src/state/atoms.lifecycle.test.ts src/state/atoms.ts src/state/store/tabStorage.test.ts src/state/store/tabStorage.ts src/state/store/tree.hydration.test.ts src/state/store/tree.test.ts src/state/store/tree.ts src/state/workspace.test.ts src/state/workspace.ts src/state/workspaceTypes.ts src/utils/chess.ts src/utils/tabs.test.ts src/utils/tabs.ts src/utils/tests/chess.test.ts

  ! eslint-plugin-jest(no-conditional-expect): Unexpected conditional expect
     ,-[src/components/boards/BoardAnalysis.test.tsx:639:9]
 638 |       if (category !== "cancellation")
 639 |         expect(mocks.showNotification).toHaveBeenCalledWith({
     :         ^^^^^^
 640 |           color: "red",
     `----
  help: Avoid calling `expect` conditionally

  ! eslint-plugin-jest(valid-expect): Expect takes at most 1 argument
      ,-[src/components/tabs/FileFreshnessGate.test.tsx:1021:5]
 1020 |     expect(treeStore.getState()).toBe(current);
 1021 |     expect(getFileFreshness(tabId), `stale ${category} rejection changed freshness`).toBe(
      :     ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
 1022 |       freshness,
      `----
  help: Remove the extra arguments.

  ! eslint-plugin-jest(valid-expect): Expect takes at most 1 argument
      ,-[src/components/tabs/FileFreshnessGate.test.tsx:1032:5]
 1031 |     expect(host.textContent).toContain("FileFreshness.Changed");
 1032 |     expect(host.textContent, `stale ${category} rejection retained panel error`).not.toContain(
      :     ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
 1033 |       message,
      `----
  help: Remove the extra arguments.

  ! eslint-plugin-jest(no-conditional-expect): Unexpected conditional expect
     ,-[src/state/store/tree.test.ts:233:32]
 232 |     expect(position!.isInsufficientMaterial()).toBe(kind === "insufficient material");
 233 |     if (kind === "fifty-move") expect(position!.halfmoves).toBe(100);
     :                                ^^^^^^
 234 |
     `----
  help: Avoid calling `expect` conditionally

Found 4 warnings and 0 errors.
Finished in 76ms on 44 files with 115 rules using 24 threads.

frontend-mutation-changed-files log tail (/home/felixb/Projekte/chessfable/artifacts/gates/20261010T054443508Z-730827/frontend-mutation-changed-files.log):
$ pnpm mutation:frontend -- --files src/components/boards/gameSession.ts,src/components/panels/practice/session.ts,src/state/store/tabStorage.ts,src/state/workspace.ts,src/utils/pathCapabilities.ts,src/utils/treeReducer.ts

> chessfable@0.15.0 mutation:frontend /home/felixb/Projekte/chessfable
> node scripts/run-frontend-mutation.mjs -- --files src/components/boards/gameSession.ts,src/components/panels/practice/session.ts,src/state/store/tabStorage.ts,src/state/workspace.ts,src/utils/pathCapabilities.ts,src/utils/treeReducer.ts

Frontend mutation package: game-practice
Frontend mutation package: workspace-storage
Frontend mutation package workspace-storage failed with exit 1.
--- artifacts/mutation/frontend/workspace-storage/stryker.log (tail) ---
[32m07:44:59 (734839) INFO ProjectReader[39m Found 2 of 2473 file(s) to be mutated.
[32m07:45:00 (734839) INFO Instrumenter[39m Instrumented 2 source file(s) with 1071 mutant(s)
[32m07:45:00 (734839) INFO ConcurrencyTokenProvider[39m Creating 21 test runner process(es).
[32m07:45:01 (734839) INFO BroadcastReporter[39m Detected that current console does not support the "progress" reporter, downgrading to "progress-append-only" reporter
[32m07:45:01 (734839) INFO DryRunExecutor[39m Starting initial test run (vitest test runner with "perTest" coverage analysis). This may take a while.
[91m07:45:15 (734839) ERROR DryRunExecutor[39m One or more tests failed in the initial test run:
	obsolete physical-generation reload rejection with missing-resource preserves its durable replacement
		expected true to be false // Object.is equality
[91m07:45:15 (734839) ERROR Stryker[39m There were failed tests in the initial test run.
file:///home/felixb/Projekte/chessfable/node_modules/.pnpm/@stryker-mutator+core@9.6.1/node_modules/@stryker-mutator/core/dist/src/process/3-dry-run-executor.js:65
                    throw new ConfigError('There were failed tests in the initial test run.');
                          ^

ConfigError: There were failed tests in the initial test run.
    at DryRunExecutor.validateResultCompleted (file:///home/felixb/Projekte/chessfable/node_modules/.pnpm/@stryker-mutator+core@9.6.1/node_modules/@stryker-mutator/core/dist/src/process/3-dry-run-executor.js:65:27)
    at DryRunExecutor.executeDryRun (file:///home/felixb/Projekte/chessfable/node_modules/.pnpm/@stryker-mutator+core@9.6.1/node_modules/@stryker-mutator/core/dist/src/process/3-dry-run-executor.js:100:14)
    at process.processTicksAndRejections (node:internal/process/task_queues:104:5)
    at async WorkItem.execute (file:///home/felixb/Projekte/chessfable/node_modules/.pnpm/@stryker-mutator+core@9.6.1/node_modules/@stryker-mutator/core/dist/src/concurrent/pool.js:32:28)
    at async file:///home/felixb/Projekte/chessfable/node_modules/.pnpm/@stryker-mutator+core@9.6.1/node_modules/@stryker-mutator/core/dist/src/concurrent/pool.js:69:13 {
  innerError: undefined
}

Node.js v24.21.0
--- end artifacts/mutation/frontend/workspace-storage/stryker.log ---
 ELIFECYCLE  Command failed with exit code 1.
pre-review check failed: frontend-build — log: /home/felixb/Projekte/chessfable/artifacts/gates/20261010T054443508Z-730827/frontend-build.log
pre-review check failed: format-lint — log: /home/felixb/Projekte/chessfable/artifacts/gates/20261010T054443508Z-730827/format-lint.log
pre-review check failed: frontend-mutation-changed-files — log: /home/felixb/Projekte/chessfable/artifacts/gates/20261010T054443508Z-730827/frontend-mutation-changed-files.log
 ELIFECYCLE  Command failed with exit code 2.

```
````

## First root proof-fix round result

Both resumed writers reached canonical end of stream. Save's final168-test suite passes independently at root. Its eight source-only fault1/restoration0 pairs,508 restored production hashes,177 frozen test hashes and four main-owned hashes were independently checked. Append's132 tests and four source-only fault1/restoration0 pairs are retained. Root inspected the complete30-test addition, all four exact source patches and their unique semantic assertion diagnoses, and independently checked331 restored production/assets hashes,177 frozen test hashes and both main-owned hashes. Original gate test bodies and runAction are preserved.

The append report contains one launch-provenance typo: its narrative repeats f93ea300, the earlier reload checkpoint. Actual launch-head.txt, eos-head.txt and integrity.py confirm this resume launched and ended at b2c24301eb1bb19e879357e141a778d1527b2bb5 with unchanged index entries. The raw report is retained below, and this qualification is the effective launch account. Its source/fault proof is derived from the actual recorded launch, not that narrative typo.

Root's integrated preflight receipt /home/felixb/.claude/drain-state/chessfable-0a459a4f.d/gates-e838b3a7-7402-4e53-a614-eb2da79f3765/gate-root-r5-round1-preflight.D3IOEv/completion.record is1 at b2c24301. It independently passed603 tests across12 suites plus46 parser tests, nine-file format/lint, TypeScript, verifier syntax and diff checks. Build passed. Canonical bundle check alone failed, entry540205, largestLazy514894, total1620066,66 over unchanged1620000. Full pre-review and contract were not rerun in this preflight. Earlier actual mutation100 is historical, not current proof. Source is still uncommitted and closure, pixels, native and all14 standalone runtime stages remain pending.

Root adopts the save writer's concrete proposal to extract the repeated temp-file source-validation operation inside existing tabs.ts. This is R5 root proof-fix round2, the last bounded round. The same sensitive high writer resumes its same four paths. The append, tree and parser peers are terminal and byte-protected. Both first and post-picker ownership witnesses stay real. Shared-guard and caller-outcome faults must honestly describe their distinct mechanisms rather than manufacture boundary-specific production branches. One final isolated bundle candidate is measured. Root retains all failed checkpoints and owns integrated full gates after EOS. Plan authorship and arbitration shared one context. Detection ran on the code model family.

## Raw save proof-fix round1 report

````text
# R5 save proof-fix round1

The one permitted consolidation is implemented and left unstaged. Local correctness proof passes. The fixed bundle limit remains blocked by 66 gzip bytes. No second design or second measured build was attempted.

Plan authorship and arbitration shared one context. Detection runs on the code model family. Root owns arbitration, integration and the next full gate.

## Scope and traced mechanism

Owned paths are `src/utils/tabs.ts`, `src/utils/tabs.test.ts`, `src/components/boards/BoardAnalysis.tsx` and `src/components/boards/BoardAnalysis.test.tsx`. This resume changes the two production files and BoardAnalysis tests. The tabs tests remain byte-identical to the frozen starting candidate.

Before editing, read the complete root `root.log` and `completion.record` in `../r5-root-proof-initial-red`. Checked its `source.sha256` against all nine named source/test paths. Every entry matched. The original prompt, six complete project rules, full owned sources/tests and actual save callers were retained from the same writer context. Reopened the changed save and notification paths, the complete BoardAnalysis source/tests, and the real `src/components/files/notifyError.ts` and `src/platform/errors.ts` implementations. No full project CLAUDE.md, skill or environment file was loaded.

The catch follows the existing missing-tab refusal before `try`, so its four later tab-presence conditions cannot reject anything. Removed those conditions and reused the captured `tabId` for conflict and freshness publication. The essential catch-entry `owns()` guard remains first. Applied-despite-error still clears the source stamp and marks freshness unverified. Stale-game, conflict, missing-resource and invalid-input handling retain their state changes and outcomes.

The catch previously normalized the error for classification, then called `failed(error)` again on its failure exits. It now builds one typed failed result, classifies its normalized error and returns that same result. The narrower `Extract<SaveResult, { status: "failed" }>` helper return type makes this reuse type-safe. Normalization, category mapping, redaction and diagnostics remain in the existing normalizer.

BoardAnalysis now passes the unknown error directly to its existing cancellation-aware presenter. That presenter invokes `errorUnlessCancelled`, which already normalizes the input. The redundant normalization in the controller wrapper was removed. Existing append classification still normalizes where it needs the category. Shared `finishWrite`, captured serialized-PGN completion, null stamp/revision uncertainty, both Save As source guards, picker/destination guards and user-save behavior are unchanged.

All BoardAnalysis cases now delegate to the actual notification presenter. Seven existing positive notification assertions additionally require the actual Mantine notification boundary to receive the visible message. Their category, backend category and message expectations remain asserted on the actual passed failure. Negative notification assertions inspect the displayed boundary too. Toolbar Save As waits on the actual notification. Existing production autosave cancellation and stale-owner silence tests remain intact. No prior test case was removed or weakened.

The complete old-to-new owned diff is `round1-owned.diff`. The Git-derived snapshot delta is `candidate.patch`. `starting/` retains all four launch files.

## Exact local commands and results

Executed in the shared checkout, with full output retained in the named logs.

| Command | Exit | Evidence |
| --- | ---: | --- |
| `pnpm exec oxfmt src/utils/tabs.ts src/utils/tabs.test.ts src/components/boards/BoardAnalysis.tsx src/components/boards/BoardAnalysis.test.tsx` | 0 | Formatted four owned files before freeze |
| `pnpm test src/utils/tabs.test.ts src/components/boards/BoardAnalysis.test.tsx src/components/panels/info/InfoPanel.test.tsx src/state/atoms.lifecycle.test.ts` | 0 | `local-test.log`, 4 suites and 168 tests |
| `pnpm exec oxfmt --check src/utils/tabs.ts src/utils/tabs.test.ts src/components/boards/BoardAnalysis.tsx src/components/boards/BoardAnalysis.test.tsx` | 0 | `format.log` |
| `pnpm exec oxlint --deny-warnings src/utils/tabs.ts src/utils/tabs.test.ts src/components/boards/BoardAnalysis.tsx src/components/boards/BoardAnalysis.test.tsx` | 0 | `lint.log` |
| `pnpm exec tsgo --noEmit` | 0 | `types.log` |
| `git diff --check` | 0 | `diff-check.log` |

Each command has its own `.exit` file. `local-child.sh` preserves the exact execution sequence. Long children were launched with `setsid nohup bash <named-child.sh> > <named-launch.log> 2>&1 < /dev/null & disown`. Completion was checked through named receipt and exit artifacts. No process-name polling was used.

## Git-derived frozen proof

Launch HEAD is `b2c24301eb1bb19e879357e141a778d1527b2bb5`. Launch index SHA-256 is `b3899241b0c783ad0850bad79d2b474f6ddd43447d4cdcd4d87feadb842b25e8`. Both are unchanged at completion.

Created `head.tar` using `git archive HEAD`, captured `git diff --binary` into `candidate.patch`, extracted into `candidate/` and `bundle-candidate/`, and applied the exact delta with `git apply`. Both disposable copies link the existing dependencies without changing them. Final owned files were checked byte-for-byte against the shared checkout before proof. The two copies and shared owned paths also match at completion.

`source.sha256` covers 508 production files. `tests.sha256` covers 177 test files, including the retained peer tests. Each fault and each restoration has complete independent source and test SHA manifests. All test manifests match the frozen candidate. Every restoration matches all 508 production files exactly. Assertions, mocks and expected results were never edited during a fault run.

`run-proof.py` executes the exact four-suite command above for its baseline, each of eight faults and each exact restoration. `proof-child.exit` is 0 and `proof.receipt` confirms completion. This resume ran the exact test command 18 times total, one shared-checkout run and 17 isolated proof runs. Baseline and all eight restorations passed 4 suites and 168 tests each.

## Eight semantic faults and restorations

Every fault changes only production source from the frozen candidate. Each has its exact `<name>.fault.patch` and `<name>.restore.patch`, application logs, complete fault/restored test logs, same-run exit files and full source/test manifests. `results.json` records exits. `semantic-diagnoses.json` retains every named semantic FAIL and assertion diagnosis.

| Fault | Precise source change | Retained semantic assertion exposed | Failed tests | Fault exit | Exact restoration exit |
| --- | --- | --- | ---: | ---: | ---: |
| first-source | Remove only the first fulfilled source-read ownership guard | Actual durable replacement retains verified freshness with a differing stamp and invokes no obsolete picker with a matching stamp | 2 | 1 | 0 |
| post-picker-source | Remove only the second fulfilled source-read ownership guard | Actual durable replacement retains verified freshness with a differing stamp and invokes no obsolete destination read with a matching stamp | 2 | 1 | 0 |
| picker | Remove only the ownership guard following picker settlement | Replacement forbids another source read after selection and returns superseded after cancellation | 2 | 1 | 0 |
| destination | Remove only the ownership guard following destination read | Replacement invokes no obsolete destination write | 1 | 1 | 0 |
| database-owner | Remove only shared completion ownership protection | Database owner replacement keeps the newer tree dirty. Existing file owner and autosave stamp controls also fail | 4 | 1 | 0 |
| database-dirty | Treat database completion as unchanged regardless of serialized content | Actual newer comments and headers remain dirty after captured native PGN succeeds | 2 | 1 | 0 |
| autosave-failure | Restrict typed failure presentation to user saves | Actual current-owner I/O and resource-limit autosaves display a notification | 2 | 1 | 0 |
| catch-entry | Remove only the catch-entry ownership guard | Five late stale rejection categories preserve replacement freshness/tree, and obsolete autosave remains silent | 6 | 1 | 0 |

The database faults are distinct ownership and content faults. Each restoration passes all 168 tests with exit 0. All 21 failed test observations across the eight faults are preserved. The fault harness was adapted only for this new directory and the new catch failure variable. No historical evidence was overwritten.

## One isolated bundle measurement

The build runs only inside `bundle-candidate/`. Shared checkout `dist` is untouched. Source and tests were frozen before the build and remain hash-identical afterward. `bundle-child.sh` contains the exact commands and measurement implementation.

| Command | Exit | Evidence |
| --- | ---: | --- |
| `pnpm build-vite` | 0 | `build-vite.log`, `build-vite.exit` |
| `pnpm bundle:check` | 1 | `bundle-check.log`, `bundle-check.exit` |
| `node --input-type=module` importing the actual `buildBundleReport` from `./scripts/check-bundle-budget.mjs` and reading `dist/.vite/manifest.json` | 0 | `bundle-measurement.json`, `bundle-measurement.log`, `bundle-measurement.exit` |

| Metric | Root starting measurement | This frozen measurement |
| --- | ---: | ---: |
| entry | 540200 | 540205 |
| largestLazy | 514899 | 514894 |
| total | 1620065 | 1620066 |

The largest lazy route is `src/routes/index.lazy.tsx`. The fixed total limit remains 1620000. Full canonical bundle output reports `total bundle budget exceeded: 1582.1 KiB, limit 1582.0 KiB` and exits 1. Compressed output did not improve despite removing demonstrated duplicate work. This is the only measured consolidation candidate in this resume.

## Canonical full-gate truth

No new whole-worktree heavy gate was run in this narrowed resume. Root owns the actual integrated rerun after both writers terminate.

The original writer's sole `pnpm checks:pre-review` attempt ended at 143 because its queued child was intentionally interrupted. It was neither startup refusal nor green. The unchanged full output and interruption diagnosis remain in `../r5-save-proof/canonical.log` and its canonical interruption artifacts.

Root subsequently ran the actual integrated canonical pre-review. The complete `../r5-root-proof-initial-red/root.log` and `completion.record` were read before this edit. Root recorded 573 tests across 12 suites and 46 parser tests passing, scoped checks/types passing, selected mutation lanes at 100, and the canonical bundle failure at 1620065. Contract did not run after that failure. Those results are historical once this candidate changes and are not claimed as a current integrated green result. No gate launcher or threshold was bypassed.

## Integrity and blockers

`final-integrity.json` confirms unchanged launch HEAD, full index listing and index bytes, unchanged protected `tree.ts`, `tree.test.ts` and `chess.ts`, exact shared/fault-copy/bundle-copy owned files, exact source restoration and frozen tests. `prior-proof-integrity.json` covers all 9993 regular historical proof files outside linked dependencies. Every byte remains unchanged, including all four prior proof series and all five historical build measurements. Protected peer hashes remain the root starting hashes. The paired reload worker's paths were not edited or overwritten. Its later work belongs to root integration.

The unresolved blocker is the 66-byte bundle excess. Correctness checks pass, but this package does not satisfy the fixed budget. No new module, configuration, schema, persistence behavior, diagnostics removal, guard deletion, minifier workaround, shortened data or threshold change was introduced.

The concrete additional shared-domain scope available for root arbitration is the repeated temp-file source validation in `saveToFile`: both phases set the current-file-operation flag, await the same source read, validate captured ownership before publishing a stamp conflict, compare the captured stamp, and clear the operation flag. Extracting that entire semantic operation within `tabs.ts` could consolidate real duplication while preserving both fulfillment witnesses and rejection context. Its compressed savings are unproven and it was not attempted in this round. Adequate savings cannot honestly be promised from the measured result.

No source-scope deviation occurred. Three owned paths changed in this resume, the fourth remained intact. Changes are unstaged. EOS for this bounded round is correctness verified and bundle blocked, awaiting root arbitration.
````

## Raw append proof-fix round1 report

````text
# R5 append outcome repair, f-20261010-25

The append rejection and fulfilled-outcome ownership gaps are repaired. The final candidate passes 132 tests across the exact three requested suites. All four independent production-source faults fail semantic assertions with same-run exit 1, followed by exact source restoration and 132 passing tests with exit 0. Changes remain unstaged.

## Owned paths and mechanism

- `src/components/tabs/FileFreshnessGate.tsx`
- `src/components/tabs/FileFreshnessGate.test.tsx`

Append rejection now checks the captured action with `actionIsCurrent(signal)` before normalization, marker changes, storage flushes, freshness publication, panel publication or failure propagation. Aborted and replaced actions return false. Genuine current-owner failures retain the existing normalized `throwOnFailure` behavior.

Append fulfillment now returns false for obsolete ownership before examining stamp/revision uncertainty. Current-owner unknown stamp or revision retains the existing durable append marker, uncertainty diagnostic and persistent retry prohibition. Successful current-owner append still updates the file origin, saves the stamp and verifies freshness.

`isUnavailableFileError` consolidates the identical invalid-input, missing-resource and conflict classification used by reconcile, reload and append. All three sites call the same named predicate. Reconcile retains its invalid-input-specific removed-game message. This removes actual semantic duplication within the existing file. No bundle savings are claimed without a new integrated measurement.

The original reload rejection guard and physical-generation comparison remain present. `runAction` remains byte-identical to the retained checkpoint. No additional action lifecycle mechanism was necessary.

## Read scope and binding policy

Read the original `fix-r5-reload.prompt`, all six named project rules, the complete retained `r5-reload-proof/REPORT.md`, the sibling append finding and its correction, the complete official f-20261010-25 entry including its provenance correction, and exact decisions d-20260924-01, d-20260924-02 and d-20260924-03. Read the owned full source and tests and traced actual callers, the registered-save callback and the native write boundary before editing. The root initial log, completion record and frozen source manifest were inspected.

The corrected provenance is binding. The initially cited d-20261007-03 is an agent decision about Files metadata, not a Felix product decision about append. Existing d-20260924-03 governs persistent append uncertainty. No recorded decision or finding was rewritten.

The starting owned source/test match the root frozen manifest and the retained reload checkpoint. Launch HEAD is `f93ea300823137b4365cb8f2f9de4d39e2f95074`. Launch and EOS HEAD and complete index entry dumps match byte-for-byte.

## Retained and added regressions

All 48 prior gate tests remain byte-identical. No existing test body, assertion, mock or expected result was changed or strengthened. Only two imports and 30 new tests were added, producing 78 gate tests and 132 tests across the three requested suites.

Nine physical-generation witnesses drive the actual append callback and defer `tauri.writeGame` through the real `writeFileGame` wrapper. They cover stamped success, unknown stamp, unknown revision, both unknown, stale-game, missing-resource, invalid-input, conflict and ordinary I/O rejection.

Each witness performs real durable tree seeding, a real workspace atom commit and real cached-store retargeting. Logical ID, file, game number, active page and cached store stay fixed. Only the physical tree key changes. A pass-through observation of the real AbortSignal getter proves that the action signal remains un-aborted before and after settlement. The constructor and signal behavior are not replaced.

Assertions preserve replacement event and comment, source stamp, append marker, store identity, verified freshness identity, tab metadata, durable replacement tree bytes and durable workspace bytes. The stale-game witness gives the replacement a true append marker to catch incorrect clearing. The later conflict panel reveals hidden stale error or uncertainty messages. Other obsolete fulfilled outcomes must produce zero uncertainty messages. A replacement with its own uncertainty marker retains exactly its own message and disabled append action.

Additional controls cover:

- Two obsolete registered-save rejections returning false without propagation or replacement damage.
- All nine late outcomes after unmount, with a genuinely aborted action signal, false registered-save result, unchanged durable bytes, unchanged store/freshness and an empty host.
- Five active-owner registered failures preserving proper stale-count, resource and ordinary-error behavior and propagating normalized failure.
- All three uncertain stamp/revision combinations surviving a cold store restart with persistent retry prohibition. Both the button and registered callback start no second native write.
- A real second append after active-owner stale-count rejection, ending in saved stamp, correct file count and verified freshness.
- Physical marker flush refusal reaching the registered caller, retaining its persistence diagnostic and preventing native append.

## Exact commands and results

`T` is the unchanged requested command:

```bash
pnpm test src/components/tabs/FileFreshnessGate.test.tsx src/components/tabs/TreeRecoveryGate.test.tsx src/state/atoms.lifecycle.test.ts
```

`F` retains the original fulfillment witness selection against the unchanged final test file:

```bash
pnpm test src/components/tabs/FileFreshnessGate.test.tsx -t 'a pending reload cannot overwrite a replacement with only its physical generation changed'
```

| Receipt label | Command | Location | Exit | Result |
| --- | --- | --- | --- | --- |
| local-first | T | Main | 1 | Setup diagnosis, 29 failed, 103 passed, 9 unhandled errors |
| local-second | T | Main | 0 | 132 passed, 3 suites |
| local-final | T | Main final owned files | 0 | 132 passed, 3 suites |
| local-static | Scoped checks below | Main | 0 | Format, lint, types and diff check passed |
| candidate-green | T | Disposable frozen candidate | 0 | 132 passed, 3 suites |
| reload-rejection-fault | T | Disposable | 1 | 4 semantic failures, 128 passed |
| reload-rejection-restored | T | Exact restored candidate | 0 | 132 passed, 3 suites |
| reload-fulfillment-fault | F | Disposable | 1 | 1 semantic failure, 77 skipped |
| reload-fulfillment-restored | T | Exact restored candidate | 0 | 132 passed, 3 suites |
| append-rejection-fault | T | Disposable | 1 | 12 semantic failures, 120 passed |
| append-rejection-restored | T | Exact restored candidate | 0 | 132 passed, 3 suites |
| append-fulfillment-fault | T | Disposable | 1 | 4 semantic failures, 128 passed |
| append-fulfillment-restored | T | Exact restored candidate | 0 | 132 passed, 3 suites |
| frozen-static | Scoped checks below | Disposable restored candidate | 0 | Format, lint, types and exact-file diff checks passed |
| final-diff-check | `git diff --check` | Main | 0 | Passed |
| independent-integrity | `python3 /tmp/build-game-opening-3b67c3b9/r5-append-round1/integrity.py` | Proof and main | 0 | All four fault pairs and integrity assertions passed |

Scoped main checks, all exit 0:

```bash
pnpm exec oxfmt --check src/components/tabs/FileFreshnessGate.tsx src/components/tabs/FileFreshnessGate.test.tsx
pnpm exec oxlint --deny-warnings src/components/tabs/FileFreshnessGate.tsx src/components/tabs/FileFreshnessGate.test.tsx
pnpm exec tsgo --noEmit
git diff --check
```

Formatting was applied only to the two owned paths. Lint reported zero warnings and zero errors. `frozen-static.sh` repeats format, lint and types in the disposable final candidate and checks both owned files against their frozen copies with `git diff --no-index --check`.

Long children used `setsid nohup bash .../run-proof.sh LABEL COMMAND ... & disown`, with stdin from `/dev/null` and named launch logs. Completion was read from named `.exit` and `.log` artifacts. No process-name polling was used. Each receipt retains exact escaped command, start/end timestamps, full stdout/stderr and same-run exit status.

## Four semantic fault/restoration pairs

1. `reload-rejection-fault.patch` changes only the reload rejection predicate to cancellation-only. Three resource-category witnesses fail freshness identity because verified replacement freshness becomes unavailable. The ordinary I/O witness fails the later-panel assertion on `obsolete reload io failure`. Each category has its own unique named FAIL. Restored full source/test manifests match the frozen candidate, then T passes 132 tests.
2. `reload-fulfillment-fault.patch` removes only the physical tree-key comparison from `actionIsCurrent`. The retained original fulfillment witness fails store identity. Its diagnostic shows `Replacement generation` becoming `Obsolete reload` and the replacement c stamp becoming the obsolete b stamp. Restored full manifests match, then T passes 132 tests.
3. `append-rejection-fault.patch` removes only the new append catch ownership check. The five physical-generation rejection witnesses fail on a cleared replacement marker, changed verified freshness or retained ordinary I/O message. Two obsolete registered-save witnesses and five unmount witnesses fail because stale failures propagate instead of returning false. All active-owner controls remain green. Restored full manifests match, then T passes 132 tests.
4. `append-fulfillment-fault.patch` restores only the obsolete-owner/unknown-result combined branch. All four physical-generation fulfilled outcomes fail the later-panel assertion, which detects one obsolete uncertainty diagnostic where zero is required. Rejection and active-owner controls remain green. Restored full manifests match, then T passes 132 tests.

Faults were independent, starting from the same final candidate. Every manual source fault and restoration used `apply_patch`. No test, mock, expected result, assertion or test configuration was changed during fault execution. All fault logs contain semantic `AssertionError` failures and no unhandled-error infrastructure failure.

## Integrity and reproducibility

The disposable candidate was derived from launch HEAD using `git archive`, excluding environment-file paths from extraction, then overlaid with the frozen worktree `candidate.patch`. Git apply validation passed. Its installed dependencies are a symlink to the existing checkout dependencies. No staging or disposable commit was used.

`final-source.sha256` covers 331 production/assets files. `final-tests.sha256` covers 177 test files. Every fault and restoration has separate full source and test SHA manifests. `integrity.py` independently reconstructs each exact expected faulty source from the frozen source, checks its SHA against the fault manifest and checks its unified patch against the retained exact patch. Only the owned production gate may differ. All eight test manifests equal the final manifest. All four restored source manifests equal the final source manifest.

The checker also verifies unique named semantic FAIL lines, same-run fault exit 1, restoration exit 0, final candidate bytes, main-owned byte identity, prior test-body identity, unchanged `runAction`, protected records/rules, retained old proof artifacts, immutable sibling source paths and launch HEAD/index integrity. Its complete successful output is in `integrity.txt`.

Final owned hashes:

```text
9b551935d590afbbaa83787cb7e2f6a9b1cebb68f242d9f3e77996a62937023e  src/components/tabs/FileFreshnessGate.tsx
2a2337473d06a2aacf14afd05d4ecb5b7dd630131df3f6a5a9551bb4696e2025  src/components/tabs/FileFreshnessGate.test.tsx
```

`owned-resume-source.patch` and `owned-resume-tests.patch` isolate this resume against the retained reload checkpoint. `candidate.patch` includes the peer snapshot as frozen for disposable proof. Peer changes in the shared main worktree were preserved. Main HEAD and index were left unchanged. Old `r5-reload-proof` artifacts were not overwritten.

## Diagnoses, deviations and integrated gate status

The preserved `local-first` failure came from a constructor capture spy that produced controllers with no readable signal under the test runner. It was a setup failure, not semantic fault evidence. Replacing it with a pass-through spy of the real native signal getter resolved the diagnosis. `local-second` and the final frozen proof are green. No production lifecycle change was made in response.

An initial candidate-creation shell call was rejected before execution because its requested working directory did not exist yet. No command or filesystem mutation ran. Creation was then performed from the existing repository, followed by sequential apply validation and overlay in the created candidate directory.

There is no deviation from the requested source scope or append policy and no blocker to this leaf repair. No new module, journal, persistence mechanism, schema/backend/version change, UI, configuration or numeric budget/floor change was introduced.

No new full heavy gate was launched during this resume, as explicitly instructed while the paired writer works. Root owns the next canonical integrated pre-review, selected mutation lanes, bundle measurement and contract run after both writers reach EOS.

The retained historical leaf `pnpm checks:pre-review` attempt exited 1 and measured total 1620073 against fixed limit 1620000. Its complete original output remains in `../r5-reload-proof/canonical-pre-review.log`. Root subsequently ran the initial integrated candidate. Its complete output is in `../r5-root-proof-initial-red/root.log`, with exit 1 in `completion.record`. That run passed 573 tests across 12 suites, 46 parser tests, scoped checks/types and selected mutation lanes at 100%. Bundle alone failed at the root-reported measurement 1620065 against 1620000. Contract did not run after that failure.

Those are historical candidates. This resumed candidate has no new integrated bundle measurement or canonical gate result. No launcher was bypassed. Root must establish the current integrated gate and contract result after EOS.
````


## Root proof-fix round2, final stopped red budget premise

The last bounded R5 save resume completed correctness and nine unique source-only fault/restoration pairs. Root independently inspected all patches and semantic diagnoses, checked508 exact restored production hashes,177 frozen test hashes, four owned source/test hashes and nine distinct fault1/restoration0 pairs. Earlier artifacts were preserved. The integrated root preflight completed exit1 at39b5b189, receipt gate-root-r5-round2-preflight.sRL2ys. It passed603 tests12 suites plus46 parser tests, scoped static/types/syntax/diff and build, then failed bundle at entry540221/lazy514891/total1620076 against unchanged1620000. Full canonical pre-review and contract were not repeated after that known red prerequisite. Root resolution is red, source remains uncommitted.

Two bounded correctness-preserving save consolidations did not establish compressed savings. R5 stops on that failed premise, not on a third iteration. The separately reviewed shared-domain source contract and f26 correction follow in 2026-10-10-game-opening-tab-actions.md. The new phase has not yet implemented or established budget acceptance.

Root found the BoardAnalysis physical-owner gap, filed f26 immediately and officially merged it at39b5b189. The first explicit inbox option expanded an unset variable and published an owned duplicate in the repository root. Root republished through the default spool, verified identical bytes, officially merged, then moved the owned misplaced duplicate reversibly into scratch. No foreign file or ledger was overwritten. Original filing and correction are preserved.

Plan authorship and arbitration shared one context. Detection ran on the code model family.

Raw final R5 save resume report, unchanged apart from trailing whitespace in this quoted copy:

````text
# R5 save proof-fix round2

The frozen shared source-validation extraction is implemented and left unstaged. Correctness proof passes. The single measured candidate remains over the fixed bundle budget by 76 gzip bytes. This is the last bounded round and ends at EOS without another design attempt.

Plan authorship and arbitration shared one context. Detection runs on the code model family. Root owns the integrated preflight, canonical pre-review, selected mutations, contract, source closure and commit.

## Read evidence and launch integrity

Read the complete `../r5-save-round1/REPORT.md`, the actual root round1 preflight log and completion record, and `../root-r5-round1-bundle.json` before editing. The preflight artifacts are in `/home/felixb/.claude/drain-state/chessfable-0a459a4f.d/gates-e838b3a7-7402-4e53-a614-eb2da79f3765/gate-root-r5-round1-preflight.D3IOEv/`. Its `completion.record` reports exit 1 at `b2c24301eb1bb19e879357e141a778d1527b2bb5`. Its full log passed 603 tests across 12 suites, 46 parser tests, scoped format/lint, types, syntax and diff checks, then built successfully and failed the bundle check at total 1620066. Full pre-review and contract were not rerun in that preflight.

The original prompt, six fully read project rules, full owned sources/tests and actual save callers remain in this same writer context. Reopened the current complete save operation and actual source-read boundary test bodies before this extraction. No skills, agents, full project CLAUDE.md, browser/native verification or environment files were loaded.

Actual launch HEAD is `8eb7a6252a6e051f54d283c810e32920dd56d827`. Actual launch index SHA-256 is `eb7c3e4aba07087272685b54918696f0d6cd956e63f5600705d8f30d89d1681d`. Recorded `launch-head.txt`, the complete `launch-index.txt`, `launch-status.txt` and `launch-protected.sha256` before editing. HEAD and index remain unchanged. Root's official intervening record commits are preserved.

## Owned delta and helper mechanism

Owned paths remain `src/utils/tabs.ts`, `src/utils/tabs.test.ts`, `src/components/boards/BoardAnalysis.tsx` and `src/components/boards/BoardAnalysis.test.tsx`. Only `tabs.ts` changed in this round. Both test files and BoardAnalysis production source are byte-identical to launch. All existing test bodies and the actual visible-notification boundary proof remain unchanged.

Added one local `validateSource` helper inside the existing `saveToFile` implementation. It accepts the captured file-backed origin, sets `currentFileOperation`, awaits the actual source read at that origin's handle and game index, checks captured logical/physical ownership before any stamp comparison or freshness publication, returns superseded if obsolete, returns the existing `sourceChanged(tabId)` conflict result for a differing stamp, and clears `currentFileOperation` only on valid completion. Valid completion returns undefined. Rejection propagates into the existing outer catch with its operation context intact.

Both existing temp-file phases await this whole operation and immediately return its nonempty outcome. The first caller keeps its source-null refusal before the helper and returns before launching the picker. The second remains after picker ownership/cancellation checks and returns before destination read/write. No boundary-specific proof condition was added. The two fulfilled-read ownership checks are now one real shared guard.

The ordinary file and database branches still return through their existing paths before either helper call. New tabs skip both temp-file branches. Those paths acquire no extra awaited validation gap. Existing picker and destination ownership checks, current-origin versus destination write flags, typed rejection handling, freshness, null stamp/revision uncertainty, serialized-content completion, unknown-write behavior and save metadata remain intact.

`round2-owned.diff` records the complete old-to-new delta. `starting/` retains all four launch files. `candidate.patch` records the exact Git-derived snapshot delta.

## Exact local checks

Executed in the shared checkout. Full output and same-run exit files are retained.

| Command | Exit | Evidence |
| --- | ---: | --- |
| `pnpm exec oxfmt src/utils/tabs.ts src/utils/tabs.test.ts src/components/boards/BoardAnalysis.tsx src/components/boards/BoardAnalysis.test.tsx` | 0 | Four owned paths formatted before freeze |
| `pnpm test src/utils/tabs.test.ts src/components/boards/BoardAnalysis.test.tsx src/components/panels/info/InfoPanel.test.tsx src/state/atoms.lifecycle.test.ts` | 0 | `local-test.log`, 4 suites and 168 tests |
| `pnpm exec oxfmt --check src/utils/tabs.ts src/utils/tabs.test.ts src/components/boards/BoardAnalysis.tsx src/components/boards/BoardAnalysis.test.tsx` | 0 | `format.log` |
| `pnpm exec oxlint --deny-warnings src/utils/tabs.ts src/utils/tabs.test.ts src/components/boards/BoardAnalysis.tsx src/components/boards/BoardAnalysis.test.tsx` | 0 | `lint.log` |
| `pnpm exec tsgo --noEmit` | 0 | `types.log` |
| `git diff --check` | 0 | `diff-check.log` |

`local-child.sh` preserves the exact sequence. Each log has a matching `.exit` file and `local.receipt` records completion.

## Frozen Git-derived proof and nine unique pairs

Created `head.tar` with `git archive HEAD` and `candidate.patch` with `git diff --binary`. Extracted into `candidate/` and `bundle-candidate/`, then applied the exact delta with `git apply`. Both copies link existing dependencies. Frozen owned bytes match the main checkout and both copies exactly at completion.

`source.sha256` covers all 508 retained production files. `tests.sha256` covers all 177 retained test files, including the terminal append peer's final tests. Every fault and restoration retains independent complete source and test manifests. Tests, assertions, mocks and expectations remain byte-identical throughout all fault runs. All 508 source files match the candidate after every exact restoration.

The honest final count is nine unique source-only fault/restoration pairs. The former two physical source guards became one shared ownership fault. Each caller's actual early return is then faulted separately. No identical patch is counted twice. All nine forward patch hashes are distinct, each original patch context occurs exactly once, and each applied source matches precisely its expected replacement.

`run-proof.py` executes the exact four-suite command above for one baseline, nine faults and nine exact restorations. `proof-child.exit` is 0 and `proof.receipt` confirms completion. The command ran 20 times in this round, one local run and 19 isolated proof runs. Baseline and every restoration passed all 168 tests across 4 suites with exit 0.

Every accepted fault produced its own named semantic FAIL and assertion diagnosis in the same run that exited 1. Full diagnoses are in `semantic-diagnoses.json`. Exact `<name>.fault.patch`, `<name>.restore.patch`, apply/restore logs, complete test logs, same-run exits and source/test manifests are retained.

| Fault | Actual production fault | Retained semantic assertion exposed | Failed tests | Fault exit | Exact restoration exit |
| --- | --- | --- | ---: | ---: | ---: |
| shared-source-owner | Remove the helper's actual post-read ownership guard | All four actual durable replacement witnesses fail. Differing stamps corrupt verified freshness at both boundaries. Matching stamps launch an obsolete picker or destination read | 4 | 1 | 0 |
| first-source-outcome | Remove only the first caller's handling of the awaited helper result | Both replacement witnesses launch an obsolete picker. The active first-source mismatch also loses its conflict outcome | 3 | 1 | 0 |
| post-picker-source-outcome | Remove only the second caller's handling of the awaited helper result | Both replacement witnesses launch an obsolete destination read. The active post-picker mismatch also loses its conflict outcome | 3 | 1 | 0 |
| picker | Remove only ownership validation after picker settlement | Selection launches another obsolete source read. Cancellation returns cancelled instead of superseded | 2 | 1 | 0 |
| destination | Remove only ownership validation after destination read | The obsolete destination write is invoked | 1 | 1 | 0 |
| database-owner | Remove only the shared completion ownership guard | Database replacement incorrectly clears dirty. Existing file-owner and autosave stamp controls also fail | 4 | 1 | 0 |
| database-dirty | Treat database completion as unchanged despite serialized-content edits | Actual newer database comments and headers incorrectly lose dirty after captured native PGN succeeds | 2 | 1 | 0 |
| autosave-failure | Restrict typed failure presentation to user saves | Actual I/O and resource-limit autosaves lose their visible notification | 2 | 1 | 0 |
| catch-entry | Remove only the essential catch-entry ownership guard | Five late stale rejection categories corrupt replacement freshness/tree, and stale autosave loses silence | 6 | 1 | 0 |

All 27 failed test observations are preserved, followed by nine exact restoration runs with exit 0. Both source boundaries still start the actual mocked native read, commit an actual durable replacement retaining logical identity and origin while changing physical tree ownership, and then settle that held read. No replacement helper or assertion was mocked or changed for these faults.

## One isolated bundle candidate

The one build ran only inside `bundle-candidate/`. Shared checkout `dist` was not written. Source and test manifests remained identical before and after the build. `bundle-child.sh` contains the exact build/check/measurement commands and `bundle.receipt` records completion.

| Command | Exit | Full evidence |
| --- | ---: | --- |
| `pnpm build-vite` | 0 | `build-vite.log`, `build-vite.exit` |
| `pnpm bundle:check` | 1 | `bundle-check.log`, `bundle-check.exit` |
| `node --input-type=module` importing the actual `buildBundleReport` from `./scripts/check-bundle-budget.mjs` and reading `dist/.vite/manifest.json` | 0 | `bundle-measurement.json`, `bundle-measurement.log`, `bundle-measurement.exit` |

| Metric | Root round1 integrated measurement | This frozen candidate |
| --- | ---: | ---: |
| entry | 540205 | 540221 |
| largestLazy | 514894 | 514891 |
| total | 1620066 | 1620076 |

The largest lazy route remains `src/routes/index.lazy.tsx`. The total limit remains 1620000. Actual canonical bundle output reports `total bundle budget exceeded: 1582.1 KiB, limit 1582.0 KiB`, with same-run exit 1. This candidate exceeds the limit by 76 bytes, 10 more than the integrated starting measurement. No second measured candidate or compression experiment was attempted.

## Preserved evidence and current gate limits

`final-integrity.json` verifies unchanged HEAD, complete index listing and index bytes, exact protected append/tree/chess files, main/fault-copy/bundle-copy owned equality, frozen test hashes, all source restorations, nine distinct fault patches and all four shared-guard boundary failures.

Both terminal append peer paths, both completed tree paths and `chess.ts` retain their exact launch hashes in `launch-protected.sha256`. The 9993 regular files in `../r5-save-proof` and all 2472 regular files in `../r5-save-round1` retain every byte, excluding linked dependencies. Their complete launch integrity manifests are retained in this directory and checked at completion. Earlier fault series, rejected-write witnesses, durable replacements, metadata, Add Game behavior and historical build measurements were not overwritten.

No whole-worktree heavy gate was launched in this narrowed resume. No current integrated full-gate claim follows from the isolated bundle run. The root preflight's 603 plus 46 passing tests and its bundle failure are historical starting evidence. Earlier canonical mutation 100 is historical. Full canonical pre-review and contract still belong to root after EOS. The original queued writer pre-review attempt remains an intentional interruption at exit 143, not startup refusal or green.

## Blocker and EOS

The correctness-preserving extraction is complete. The bundle requirement is unresolved. The missing premise is that this adopted consolidation provides enough compressed savings to recover the starting 66-byte excess. The actual one-candidate result disproves that premise and leaves a 76-byte excess. No further savings mechanism is authorized in this last bounded round. Root needs a separately arbitrated, evidence-backed mechanism before that budget can be claimed green.

No scope deviation occurred. Only the existing `tabs.ts` implementation changed, with no new module, schema, configuration, persistence design, diagnostics change, loading trick, minifier workaround, data shortening, baseline reduction or removed safety guard. All requested local correctness proof completed. Changes remain unstaged. EOS with bundle blocked.
````
