# Game opening cumulative review round 4

Reviewed delta `69677131258a39c4ab9ff07f0c4aece8b39256df..a210ba87797002871b705caa41d319094265a6df`, full effective range context from `5a5dc7e6acf2a8d0a53dbba59c2bdc4117baee77`. All nine canonical read-only leaves completed. Eight code lenses ran sensitive gpt-6.1-sol/medium, records ran mechanical gpt-6.1-sol/medium. Plan authorship and arbitration shared one context. Detection used the code's model family in fresh contexts.

All applicable witnesses closed D6, D7, D8 and D9-P3 at source level. The original D9 split ordering was fixed and proved, but correctness found its full consumer obligation NOT CLOSED because duplication loses the hydration gate. The duplication reports share one source-status publication cause and count once. Nine unique findings are adopted Fix, with no Defer or Skip. Pixel/native proof and all fourteen standalone failure stages remain pending. Source closure is not approved.

| Key | Verdict | Ledger / scope | Origin and obligation |
|---|---|---|---|
| R4-SAVE | Fix | f-20261010-09 | Pre-existing rejection publication, newly relevant physical ownership. Pending save, actual replacement, stale rejection and active-owner control. |
| R4-BOARD | Fix | f-20261010-10 | cb09c965 proof gap. Production physical-key provider, recovery and close wiring. |
| R4-GEN | Fix | f-20261010-11 | cb09c965 proof gap. Pending gate action changes only physical generation. |
| R4-PGN | Fix | f-20261010-12 | Pre-existing consecutive-comment overwrite, unchanged upstream file but direct loaded dependency. Lossless parse/save/reparse. |
| R4-DUP | Fix | f-20261010-13 | Pre-existing unhydrated source-status publication plus cb09c965 missing-reference case. Never unlock a cached default or admit a blank referenced clone. |
| R4-ID | Fix | f-20261010-14 | cb09c965 result hides physical/logical identity distinction. Preserve staging and new-tab contract. |
| R4-LIMIT | Fix | f-20261010-15 | Pre-existing bare analysis bound. Name its policy, retain value 10. |
| R4-REC1 | Fix | primary execution handoff | Historical active/no-proof state must reference cb09c965 and root proof. |
| R4-REC2 | Fix | f-20261010-06 annotation | D7 source closure is complete, native proof remains pending. |

Source findings were published immediately through the official inbox and allocated by `f6e96b6c`. Initial four lens filings warned about an absent literal Proof bullet, despite their Fix and proof obligations. Actual proof annotations follow after verified repairs. No product decision or changed numeric ratchet is authorized.

Mechanism note: raw source reads may publish availability without hydrating the cached logical owner. Physical reference presence is a required recovery invariant, not a new blank legacy tree. The repair must preserve the original gate until explicit hydration succeeds, while retaining legitimate blank legacy duplication. This is the first closure attempt for D9's implementation, with a newly uncovered consumer hole rather than a second reopening of discard authorization. New tests must distinguish logical and physical identity and fail when the relevant production routing is removed. The save rejection repair uses the already captured owner predicate before publication rather than introducing another generation registry.

Review wall and repair elapsed are taken from the canonical stage events. Active review wall remains unknown. No non-overlapping external review wait was identified. Parallel leaf durations are not summed. Raw reports below retain their individual ranks and verdicts, including tests APPROVED despite adopted should-fix coverage gaps. Root arbitration is REVISE until every adopted Fix is proved and freshly reviewed.

Round 4 review wall is 529 seconds, epochs 1791604824 through 1791605353, including root arbitration and official intake publication. `REVIEWED_THROUGH=a210ba87797002871b705caa41d319094265a6df`. The nine findings remain repair obligations, not closure approval. R4-REC1 now marks the old active/no-proof statement historical and points to `cb09c965`. R4-REC2 is corrected through the official annotation commit `ad3f0037`. The other seven findings await bounded source repairs.

## Completed correctness report, verbatim

````text
D6 CLOSED — the real React setter observation detects publication after unmount, and the guard-removed proof fails on that publication.

D7 CLOSED — owner-bound confirmation and root/header snapshots authorize discard while preserving cancellation, newer edits and refused workspace writes.

D8 CLOSED — the ordinary-rejection test switches Jotai ownership before React cleanup. Removing only the catch guard produces the unwanted notification.

D9-P3 CLOSED — the replacement overlays current tab metadata. The actual pending-read discard regression and captured-origin fault demonstrate preservation of refreshed count and metadata.

D9 NOT CLOSED — coordinated page replacement fixes the original durability split, but duplication bypasses missing-reference protection.

[blocker] src/state/store/tabStorage.ts:577 — Duplicate a restored tab with logical ID L and explicit `treeKey` P whose stored tree is missing. Hydration correctly marks P unavailable, but BoardsPage’s changed duplication caller passes P to `cloneDurable`. Its `readTree(P)` changes that status to absent, then this branch returns successfully without seeding anything. `commitNewTab` admits the duplicate and clears its inherited treeKey, so it hydrates a default tree instead of cloning the game. The original recovery gate also accepts the newly published absent status. Required behavior is to retain missing-reference protection and refuse duplication. Newly reachable through `cb09c965`, using the pre-existing absent-success branch from `f856c72f`. (confidence: 98)

Lifecycle witness: replacement retains the cached logical store and tab-keyed settings. Existing EvalListener fingerprint/generation checks and ReportModal operation/root checks remain the result-routing guards.

Limitation: source review only. Pixels, native behavior and standalone failure staging remain pending (confidence: 100). Detection used the code author’s model family. Plan authorship and arbitration shared one context.

VERDICT: REVISE
````

## Completed root-cause report, verbatim

````text
D6 CLOSED — The real React dispatcher observation detects late pending-state publication. Removing the mounted guard produces the specific extra `[false]` setter call, and restoration passes.

D7 CLOSED — `InfoPanel.tsx` binds discard authorization to the request owner and immutable root/header snapshot. Actual selector/modal tests cover cancellation, newer edits, owner switches, unmount and persistence refusal.

D8 CLOSED — The ordinary-rejection test switches Jotai ownership before React cleanup. Removing only the catch ownership guard produces the unwanted notification, while the active-owner control retains normal error reporting.

D9 CLOSED — Candidate seeding precedes the combined workspace origin/reference commit. Physical-key hydration, duplication, recovery, close and removal accounting follow that reference. Persisted lifecycle tests cover refusal, reload, queued edits and post-commit exceptions. The lifecycle witness preserves cached store, settings, native-game and report-owner identities.

D9-P3 CLOSED — Replacement overlays the current tab’s metadata. The retained actual selector/modal test fails on lost count, filename, timestamp and tags when the captured-origin overlay is restored.

[blocker] src/utils/tabs.ts:511 — Generation ownership is checked for save success, but stale rejection branches still publish against the logical tab ID. With autosave enabled, a save for game A can remain pending while confirmed discard replaces it with game B under the same tab. If A’s write then rejects with `stale-game`, `sourceChanged(tab.value)` marks B as conflicted and hides its correctly loaded board. The `conflict`, `missing-resource` and `invalid-input` branches likewise update B’s freshness without checking `owns()`. The repair therefore leaves the same stale-result mechanism intact on rejection. Guard rejection publication with the captured origin and physical generation, and retain a pending-save → actual replacement → rejection regression. This is a new sibling finding, not a reopening of D8. The stale-game branch originates in `490831c7`, and `cb09c965` adds generation protection only to selected outcomes. (confidence: 97)

No previously fixed defect was identified as reintroduced. The inherited `981db8fc` change reports unreadable claim intent instead of misclassifying it as a refused batch.

Limitation — Pixel verification, real WebKitGTK behavior and fourteen standalone assertion failure stages remain pending. Source closure does not establish them. This review was read-only and ran on the code author’s model family. Plan authorship and arbitration shared one context. (confidence: 100)

VERDICT: REVISE
````

## Completed tests report, verbatim

````text
D6 CLOSED — the real React setter observation fails when the unmount guard is removed.
D7 CLOSED — actual selector/modal tests prove owner-bound discard replacement and preservation during edits, cancellation and owner switches.
D8 CLOSED — stale ordinary rejection asserts zero notifications, with an active-owner control and guard-removed failure.
D9 CLOSED — persisted-store assertions catch missing candidate durability, incorrect hydration and premature cleanup.
D9-P3 CLOSED — the pending-read selector/modal test catches captured metadata overwriting committed refreshes.

[should-fix] src/components/tabs/BoardsPage.test.tsx:498 — Origin cb09c965. Recovery fixtures have no distinct physical key, and mocked storage status ignores its argument. Removing BoardsPage’s physical-key provider/recovery wiring would still pass. Direct TreeRecoveryGate tests supply that wiring themselves, leaving the production integration unguarded. (confidence: 97)

[should-fix] src/components/tabs/FileFreshnessGate.test.tsx:881 — Origin cb09c965. No pending-action test changes only the physical generation while preserving logical ID, file/page and cached store. Removing `actionIsCurrent`’s tree-key comparison would still pass, allowing an old reload to overwrite the replacement generation. The physical-key marker-refusal test exercises a different branch. (confidence: 96)

Limitation: pixels, native execution and all fourteen standalone failure stages remain pending. Source closure establishes none of them. (confidence: 100)

VERDICT: APPROVED
````

## Completed code-quality report, verbatim

````text
D1–D5 remain CLOSED. D4’s inventory now correctly records 102 checks plus the conditional check.

D6 CLOSED — the real React setter observation detects late pending publication. Removing the mounted guard produces the recorded failure.

D7 CLOSED at source level — owner-bound confirmation and root/header snapshots preserve cancel, save, supersession and unmount behavior.

D8 CLOSED — the ordinary-rejection test switches Jotai ownership before React cleanup. Removing only the catch guard produces the unwanted notification.

D9 CLOSED at source level — persisted-store tests cover staged replacement, refusal, reload and cleanup. The lifecycle witness retains the cached store, report owner, native game ID and engine settings.

D9-P3 CLOSED — the actual pending-read discard test preserves refreshed metadata. The captured-origin fault demonstrably loses it.

[blocker] src/state/store/tree.ts:1006 — Bare `10` truncates generated analysis variations to ten plies without naming the policy. Give this behavioral limit a named constant, preserving its value. The sibling `tabStorage.ts` names comparable tree bounds. Pre-existing origin: `93b366695`. (confidence: 96)

[should-fix] src/utils/tabs.ts:229 — `replaceFileGame` returns `ReplaceNewTabResult`, although it preserves the logical tab and returns a physical tree key as `id`. The same type’s other consumer returns a new logical tab ID. Use names that distinguish these identities. Origin: `cb09c965`. (confidence: 94)

No readability defect found in inherited `981db8fc` findings-tool changes or its SHA stamp. No files changed or tests executed. Pixels, native behavior and standalone failure staging remain pending. Detection used the author’s model family. Plan authorship and arbitration shared one context.

VERDICT: REVISE
````

## Completed minimalism report, verbatim

````text
D5 CLOSED — `DatabasesPage.tsx:184` owns database synchronization and navigation for both opening gestures.

D6 CLOSED — `gameOpen.test.tsx:131` observes real React setter calls. Removing the unmount guard produces the unwanted `false` publication.

D7 CLOSED at source level — owner-bound confirmation and immutable snapshots remain in `InfoPanel.tsx:361–435`, with actual selector/modal race coverage.

D8 CLOSED — `InfoPanel.test.tsx:684` covers ordinary rejection before React cleanup, with an active-owner control. The catch-guard fault produces the unwanted notification.

D9 CLOSED at source level — replacement reuses staging, commits the physical reference before publication, and preserves logical ownership. Lifecycle tests witness unchanged cached store, report owner, engine settings and native-game identity. Retained faults expose missing durability, hydration and premature cleanup.

D9-P3 CLOSED — `tabs.ts:264` overlays current metadata. The actual pending-read discard test fails on lost count and metadata when the captured-origin overlay is restored.

No new bloat or duplication findings. The delta adds no code files. Shared file predicates have three component consumers, and duplicated layout, save completion and recovery-panel projections were consolidated. In the enclosing range, `gameOpen.tsx` supplies the mandated shared button, row semantics and admission lock. Its test and the new GameCard/GameTable tests cover distinct boundaries. No smaller deletion preserves the adopted coverage.

Inherited `981db8fc` adds one diagnostic and early return, with its SHA stamp updated. No unnecessary layer appears there.

Limitation: pixels, native behavior and fourteen standalone failure stages remain pending and root-owned (confidence: 100). Detection used the code author’s model family. Plan authorship and arbitration shared one context.

VERDICT: APPROVED
````

## Completed error-handling report, verbatim

````text
D6 CLOSED — `gameOpen.tsx` retains the mounted guard. The React dispatcher observation detects late pending publication when that guard is removed, then passes after restoration. (confidence: 98)

D7 CLOSED — `InfoPanel.tsx` binds discard to the original owner and immutable snapshot. Actual selector/modal tests cover refusal, edits, cancellation, supersession and unmount. (confidence: 97)

D8 CLOSED — `InfoPanel.test.tsx:683` proves ordinary rejection stays silent after Jotai ownership changes before React cleanup. The active-owner control and catch-guard fault establish the distinction. (confidence: 99)

D9 CLOSED for the original index/tree split — durable staging precedes workspace admission, exceptions preserve both generations, and persisted-store tests prove cold reload follows the candidate. The duplication defect below is a separate uncovered failure path. (confidence: 97)

D9-P3 CLOSED — `InfoPanel.test.tsx:518` proves pending-read metadata survives in live and persisted ownership. The captured-origin fault fails specifically on lost metadata, then passes after restoration. (confidence: 99)

[blocker] src/components/tabs/BoardsPage.tsx:201 — Duplicating a tab whose explicit `treeKey` is missing treats failed recovery as successful cloning. `cloneDurable` returns normally for absence (`tabStorage.ts:577`), so `commitNewTab` admits and activates a duplicate without a tree or error notification. Its source read also changes the original status from `unavailable` to `absent`, releasing `TreeRecoveryGate` around the default tree. Explicit references must fail closed while preserving legitimate blank legacy-tab duplication. Newly reachable through `cb09c965`. (confidence: 98)

[should-fix] src/utils/tabs.ts:511 — Late save failures bypass the ownership guard added to successful completions. If an autosave for game 2 remains pending while confirmed discard installs game 0, a subsequent `invalid-input` rejection marks the replacement tab unavailable at line 536. A stale-game rejection similarly shows a conflict against the replacement. These handlers should check captured origin and physical generation before publishing failure state. The stale-game branch originates in `490831c77`, retained by `cb09c965`. (confidence: 97)

Lifecycle witness: replacement tests preserve cached-store, report-owner and engine-setting identities. Existing EvalListener request/generation checks and ReportModal root fingerprints remain intact.

Limitation: this is source review, not pixel or native verification. All fourteen standalone failure stages remain root-owned and pending. Detection used the code’s model family. Plan authorship and arbitration shared one context.

VERDICT: REVISE
````

## Completed persisted-state report, verbatim

````text
D6 CLOSED — the React dispatcher observation detects late publication, and the guard-removed proof fails.
D7 CLOSED — owner-bound discard and immutable snapshots preserve newer edits, cancellation and workspace refusal.
D8 CLOSED — the ordinary-rejection test covers Jotai ownership changing before React cleanup, with an active-owner control.
D9 CLOSED for the original index/tree durability split — replacement seeds a fresh generation before committing its reference and index. Persisted-store refusal and reload tests cover this ordering.
D9-P3 CLOSED — the current-tab overlay preserves refreshed metadata. The actual selector/modal test and captured-origin fault prove it.

[blocker] src/state/store/tabStorage.ts:576 — Duplication can unlock an unhydrated original store. If a database analysis tab’s initial storage read fails transiently, its cached store contains the default tree behind the recovery gate. Clicking Duplicate after reads recover calls `readTree`, which publishes `available` without rehydrating that original store. Returning to the original tab exposes the default tree, and BoardAnalysis’s `setPracticePath` effect queues it over the saved game. A refused duplicate admission leaves no copied recovery tab. Likewise, duplicating a missing referenced generation changes its status from `unavailable` to `absent`, bypassing the new required-existing gate. The status-publication mechanism originates in `4e4ce39a`, with the missing-reference case introduced by `cb09c965`. Preserve the hydration gate until explicit recovery succeeds. (confidence: 97)

Source closure does not establish pending pixel or native verification. Detection ran on the code’s model family. Plan authorship and arbitration shared one context.

VERDICT: REVISE
````

## Completed chess-semantics report, verbatim

````text
D6 CLOSED — the real React dispatcher test observes no publication after unmount, and removing the guard produces the recorded failure.

D7 CLOSED — owner-bound discard captures immutable root/header references and preserves newer edits, cancellation and refusal.

D8 CLOSED — the Jotai-before-React rejection test proves silence, with an active-owner control and catch-guard failure evidence.

D9 CLOSED — replacement stages the durable candidate before publishing its reference and installs its root, headers and cursor together. Persisted-store tests cover refusal and reload.

D9-P3 CLOSED — the commit overlays current metadata. The retained selector/modal test fails under the captured-origin fault.

[blocker] src/utils/chess.ts:409 — Consecutive comments overwrite earlier annotations in memory. Opening `1. e4 {Keep this explanation} {[%clk 0:05:00]} e5 *` through `loadFileGame` leaves the e4 node’s comment empty because the clock-only token replaces its prose. Saving then permanently drops the explanation. The lexer emits each comment separately, while serialization writes only the final `node.comment`. This is pre-existing enclosing-path behavior, preserved by `2dc2d8e4`, not introduced by the durability repair. (confidence: 99)

Read-only source review. Pixel/native proof remains pending. Detection used the code author’s model family, and plan authorship and arbitration shared one context.

VERDICT: REVISE
````

## Completed records report, verbatim

````text
[should-fix] tasks/handoffs/2026-10-10-game-opening-execution.md:305 — The latest D9 progress statement says the source phase is active with no implementation proof yet. Commit `cb09c965` and the companion execution handoff at lines 588–590 establish committed source and passing independent phase proof. Mark this checkpoint historical and reference the current checkpoint. (confidence: 100)

[should-fix] tasks/findings.md:14471 — D7’s latest annotation still says source closure is pending. The primary execution handoff at line 299 and its retained round-3 reports confirm D7 source closure. Append a correction distinguishing completed source closure from pending native verification. (confidence: 100)

Unverifiable: historical context/model provenance, exact review timing and the upstream CI result. Checked source hashes, local proof logs, bundle metrics and retained failure/restoration evidence agree.

VERDICT: REVISE
````

