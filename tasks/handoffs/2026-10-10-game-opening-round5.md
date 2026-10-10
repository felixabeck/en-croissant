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
