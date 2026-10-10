# Game opening cumulative review round 4

Current source checkpoint: the verified R4 repairs are committed in `099bfa21`, `db6ac190` and `4ee4ff12`. Independent root pre-review and contract checks passed on their identical candidate bytes, completion `gate-root-r4-repair-proof-r2.1tnLMt`. The first root mutation failure and two proof-fix rounds remain preserved below. Additional mechanism findings are allocated `f-20261010-16` and `f-20261010-17` by `50d928eb`. Fresh cumulative source closure, pixels, actual app, all fourteen native failure/restoration stages and delivery remain pending. The original review checkpoint and raw verdicts below are historical, not statements that source repair is still unstarted.

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

Round 4 review wall was 529 seconds, epochs 1791604824 through 1791605353, including root arbitration and official intake publication. `REVIEWED_THROUGH=a210ba87797002871b705caa41d319094265a6df`. At that review checkpoint the nine findings remained repair obligations, not closure approval. R4-REC1 marked the old active/no-proof statement historical and pointed to `cb09c965`. R4-REC2 was corrected through the official annotation commit `ad3f0037`. The other seven findings then awaited the bounded source repairs recorded in the current checkpoint above.

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


## Verified repair continuation and preserved raw history

The following are completed checkpoints and verbatim artifacts. Earlier worker reports describe their actual uncommitted states at report time. The current committed source checkpoint at the top supersedes those states. J1 is qualified as a custom mechanism judgment, J2 as the canonical focused check. Neither is represented as a full new multi-lens cohort.

### Root continuation record

Artifact: /tmp/build-game-opening-3b67c3b9/r4-continuation-root-note.md

````text
# Round 4 repair continuation

This is an execution checkpoint, not source closure or native proof. Source parent is 77ba474282f79d2bd1b17efcb64e6637cc83f6f1. Reviewed-through remains a210ba87797002871b705caa41d319094265a6df. Root holds the existing drain lock. All three initial disjoint writers ended before either mechanism judgment.

The initial functional worker's seven-path repair passed 507 tests in the exact eleven suites in main and restored Git scratch. Its eleven independent semantic source faults each exited1 and exact restorations exited0. Root read the complete report and product/test diffs, independently validated 67 artifact/source hashes and all eleven failure/restoration exits. Root preserved all 131 top-level regular proof files byte-exact under r4-initial-ownership-proof. That initial proof does not establish cold-reference correctness.

The initial canonical pre-review actually ran and exited1 on initial formatting/lint and workspace mutation fixture failures. Those local failures were corrected and retained. The original brief's predicted startup125 did not reproduce and was a wrong root premise. No final bundle or full root pre-review pass is claimed on this candidate.

The parser worker changed only chess.ts and its paired test. All 46 tests and scoped formatting/lint/types/diff checks passed. The preservation-only source reversal produced nine semantic failures, including a clock-only comment erasing earlier prose. Exact restoration returned 46 green. Root inspected the full diff, fault, failure/restoration logs and evidence, then validated all 35 artifact hashes independently.

The mechanical worker changed only tree.ts, naming the existing ten-ply bound without changing its value. All 60 tree tests and scoped checks passed. Root preserved its exact isolated patch for a separate atomic commit after combined proof. This worker's short report omitted the requested context/family disclosure, so the root records actual routing here rather than inventing an additional worker response.

Root source inspection found that the initial R4-DUP repair still accepts cold or vanished explicit references. The earlier frozen root brief made the production caller read-only and was too narrow. This remains f-20261010-13's adopted obligation, not a new issue count. Root also found a distinct correction-introduced cached retarget policy hole and filed its complete pending entry immediately. Retargeting changed only persistence name while retaining storageFor(false).

Fresh read-only mechanism judgment J1 confirmed both observations and found workspace repair also drops explicit-reference intent. Root checked that production witness and filed it immediately. J1 returned REVISE. Its custom prompt did not carry the unchanged canonical lens body and Frame. It is preserved as evidence and a fresh mechanism judgment, not represented as a correctly framed formal plan-review cohort.

J2 delivered the unchanged full review-plan body and required Frame with a complete body-only candidate, fixed verbatim mandate, full history, correction evidence, delta, Authority and exact rule/decision units. J2 explicitly CLOSED all three plan-level issues and returned APPROVED with zero new defects. Implementation, root gates, cumulative source closure and all runtime proof remain pending. This focused mechanism check is additional lineage evidence, not a fabricated full multi-lens cohort.

The accepted correction shares required-presence reading in the existing repository, retains original hydration blockers and authoritative pending trees, passes explicit intent from BoardsPage duplication and workspace repair, and synchronously retargets the existing persistence name and adapter. It preserves absent legacy duplication/repair and logical/store/native/report/settings identity. No module, journal, storage backend, version, recovery UI, budget or coverage reduction was authorized.

Root resumed the same sensitive thread 01a12404-ba8a-7ee3-aa42-9248ec17e794 for proof-fix round1 at the registry ceiling gpt-6.1-sol/high. Scope is the original seven functional paths plus BoardsPage.tsx, tree.ts, tree.hydration.test.ts, workspace.ts and workspace.test.ts. The completed parser peer and named ten-ply constant are preserved. New proof goes into r4-ownership-round1 and may not overwrite initial evidence. All eleven earlier source faults plus four independent required-reference faults remain required.

Round1 ended with 517 tests in main and scratch and sixteen semantic fault/restoration pairs. The sixteenth catches a transient cold-preflight absent publication. Source refinement followed its one startup125 refusal, so the refusal is explicitly historical to that earlier frozen candidate. Root read the full final report and new production/test diffs, validated 104 artifact/source hashes, all sixteen semantic exits and 352 retained-test hashes across red/restored manifests and current main. No source, index or HEAD mutation occurred during proof.

Root's independent root-r4-repair-proof gate actually ran on the final round1 candidate. All 517 source tests, separate 46 parser tests, scoped format/lint/types/syntax and bundle passed. Actual transfer bytes were entry 540170, largest lazy 514852 and total 1619967, with unchanged limits 550000, 550000, 1620000. Pre-review failed workspace-storage mutation at 99.91 because one BooleanLiteral survived: clone's default requireExisting=false changed to true. All 1067 other mutants were killed, with no no-coverage or error mutant. Workspace.ts scored 100.00. The existing missing-source control checked target null but did not assert ordinary absent source semantics. Contract did not run after this failure. Completion is 1 root-r4-repair-proof 77ba474282f79d2bd1b17efcb64e6637cc83f6f1. Complete log and mutation report are archived in r4-root-proof-round1-red. No source commit was made on red.

Root resumed the same sensitive thread for proof-fix round2, owning only tabStorage.test.ts. The bounded correction strengthened the existing ordinary absent legacy clone control and retained a default-policy-only failure witness, preserving every production byte. All sixteen preceding fault pairs were rerun with the revised retained test hash, giving seventeen pairs. New proof lives in r4-ownership-round2. This was the second and last proof-fix round for the R4 phase.

Round2 completed with 517 tests in main and scratch and seventeen semantic failure/restoration pairs. Its one canonical pre-review attempt refused startup125 after final test freeze. Root inspected the four-line net test delta and full completed report, independently checked 109 source/artifact hashes, 374 retained-test hashes and all seventeen semantic exits. Product sources and historical evidence remained byte-identical.

The second independent root gate passed the exact eleven suites and separate parser suite, scoped checks/types/syntax, full pre-review and complete contract. Workspace-storage killed all 1068 mutants at 100.00. Tree/path scored 100.00 with 168 killed and eight timed out, with no survivor, no-coverage or error. Pre-review examined 69 changed paths and its mutation lane ended exit0 after 401.2 seconds. Completion is 0 root-r4-repair-proof-r2 77ba474282f79d2bd1b17efcb64e6637cc83f6f1 at gate-root-r4-repair-proof-r2.1tnLMt. Root log is root-r4-repair-proof.log. Bundle bytes remain 540170 entry, 514852 largest lazy and 1619967 total under unchanged limits.

Root verified final source, index and HEAD hashes after gate completion. Two compound commit commands were rejected by the scope hook before taking any action. Separating staging inspection from the advertised guarded index-only commit kept the constant-only patch separate from functional tree changes. Verified atomic source commits are 099bfa21 for the named unchanged bound, db6ac190 for parser preservation and 4ee4ff12 for the twelve-path ownership/recovery repair. All have Felix Beck as author and Codex with the requested drain committer email. Official intake50d928eb allocated retarget f-20261010-16 and workspace repair f-20261010-17. Current source is committed. Fresh cumulative source closure, all pixels/native proofs and delivery remain pending.

Plan authorship and arbitration shared one context. Fresh detection and functional/parser code use the same OpenAI model family. Sensitive and normal write roles used gpt-6.1-sol/high. The mechanical constant worker used gpt-6-luna/max. Both focused mechanism judgments used fresh gpt-6.1-sol/high contexts.
````

### Initial ownership worker report

Artifact: /tmp/build-game-opening-3b67c3b9/r4-initial-ownership-proof/REPORT.md

````text
Completed the five frozen repairs. Changes are unstaged. No skills, agents, records edits, commits, pushes, browser verification or native verification were used.

Changed paths:

- `src/utils/tabs.ts`
- `src/utils/tabs.test.ts`
- `src/state/atoms.lifecycle.test.ts`
- `src/state/store/tabStorage.ts`
- `src/state/store/tabStorage.test.ts`
- `src/components/tabs/BoardsPage.test.tsx`
- `src/components/tabs/FileFreshnessGate.test.tsx`

The save rejection boundary now checks the existing captured `owns()` predicate before publishing any rejection outcome. Existing current-owner, Save-As, null-stamp and uncertain-write tests remain. The added pending-save witness performs actual durable replacement while retaining the logical owner, file/page and cached store, then rejects the old write with each of stale-game, conflict, missing-resource, invalid-input and durability.

Duplication reuses the repository's existing write blocker before reading its source. A failed original hydration or required missing-reference status therefore refuses duplication without publishing availability or absence. Reserved legacy non-tree keys retain their existing blank duplication behavior. The blocker return annotation now names its actual gated variants. No persistence mechanism was added. Real cached-store regressions prove transient refusal, a recovered underlying read, retained status, refused duplication, blocked blank-store writes and unchanged original bytes. Explicit retry hydrates the original before duplication can proceed. A subsequent rejected duplicate admission removes only its target. Existing readable and pending-tree clone controls remain.

`replaceFileGame` now returns `ReplaceFileGameResult` with `{ kind: "committed", treeKey }`. Shared staging still uses its internal id, and `replaceNewTab` retains its logical `id` contract. Only affected lifecycle assertions changed their field. InfoPanel consumes only `kind`, so it needs no change.

The BoardsPage witness mounts production BoardsPage, its actual TreeStateProvider and TreeRecoveryGate. Key-sensitive status mocks distinguish logical `current` from physical `cccccccc-cccc-4ccc-8ccc-cccccccccccc`. It proves provider arguments, recovery subscription, withheld children, blocked close, explicit retry, resumed children and logical runtime cleanup. The FileFreshnessGate pending reload changes only the physical generation, retains file/page and cached store, explicitly proves the signal stays un-aborted, and checks that the obsolete result preserves replacement state and freshness.

Exact full phase command, run in the main checkout and the Git-derived restored scratch copy:

```sh
pnpm test src/state/workspace.test.ts src/state/atoms.lifecycle.test.ts src/state/store/tabStorage.test.ts src/state/store/tree.test.ts src/state/store/tree.hydration.test.ts src/utils/tabs.test.ts src/components/tabs/BoardsPage.test.tsx src/components/tabs/TreeRecoveryGate.test.tsx src/components/tabs/FileFreshnessGate.test.tsx src/components/panels/info/InfoPanel.test.tsx src/components/boards/BoardAnalysis.test.tsx
```

| Run artifact | Exit | Evidence |
| --- | ---: | --- |
| phase.log | 1 | Initial two new lifecycle fixture failures on comparing post-hydration normalized bytes to a fresh serialization |
| phase-final.log | 0 | 11 suites, 507 tests |
| phase-complete.log | 0 | Final tests, 11 suites, 507 tests |
| scratch-green.log | 0 | 11 suites, 507 tests |
| scratch-complete.log | 0 | Final byte-identical tests, 11 suites, 507 tests |

Every exact scoped check:

```sh
pnpm exec oxfmt src/utils/tabs.ts src/utils/tabs.test.ts src/state/atoms.lifecycle.test.ts src/state/store/tabStorage.ts src/state/store/tabStorage.test.ts src/components/tabs/BoardsPage.test.tsx src/components/tabs/FileFreshnessGate.test.tsx
pnpm exec oxfmt --check src/utils/tabs.ts src/utils/tabs.test.ts src/state/atoms.lifecycle.test.ts src/state/store/tabStorage.ts src/state/store/tabStorage.test.ts src/components/tabs/BoardsPage.test.tsx src/components/tabs/FileFreshnessGate.test.tsx
pnpm exec oxlint --deny-warnings src/utils/tabs.ts src/utils/tabs.test.ts src/state/atoms.lifecycle.test.ts src/state/store/tabStorage.ts src/state/store/tabStorage.test.ts src/components/tabs/BoardsPage.test.tsx src/components/tabs/FileFreshnessGate.test.tsx
pnpm exec tsgo --noEmit
git diff --check
pnpm checks:pre-review
```

| Command | Logs and exits |
| --- | --- |
| oxfmt write | format.log 0, format-final.log 0 |
| oxfmt check | format-check.log 0, format-complete.log 0 |
| oxlint | lint.log 1 for three conditional assertions in the new fixture, lint-final.log 0, lint-complete.log 0 |
| tsgo | types.log 0, types-final.log 0, types-complete.log 0 |
| diff check | diff-check.log 0, diff-check-final.log 0, diff-complete.log 0 |
| canonical pre-review, attempted once | pre-review.log 1 |

The initial fixture failures and lint warnings were repaired within scope. Initial red logs were retained separately. The canonical pre-review attempt did **not** reproduce the predicted startup exit 125. In this session `pnpm checks:pre-review` entered the canonical frontend-build and selected lanes, then exited 1 on the initial format-lint and workspace mutation dry-run test failures. Its exact log is preserved. No launcher bypass, separate build invocation, ad hoc measurement or retry occurred. Root's valid final full pre-review and bundle check remain necessary. This leaf makes no final bundle or full-gate claim. The total bundle limit remains 1620000.

All eleven source faults imported successfully, exited 1 on semantic assertions, and passed after exact source restoration with exit 0. Final retained tests were byte-identical throughout. The repaired facade API remained intact in every fault.

| Artifact prefix | Specific fault and retained assertion |
| --- | --- |
| save-owner | Remove only the catch ownership guard. Replacement verified freshness becomes conflict, unverified or unavailable for the four targeted categories. The durability case returns failed rather than superseded, while its pre-existing inner guard retains replacement content. |
| clone-status | Restore only the unconditional clone source read. The transient original publishes available and the missing reference publishes absent instead of retaining unavailable. Both repository refusal assertions also fail. |
| boards-provider | Remove only production provider treeKey. createTreeStore receives undefined physical key at BoardsPage.test.tsx:764. |
| boards-recovery | Remove only production recovery treeKey. Subscription receives the logical key at BoardsPage.test.tsx:765. |
| boards-close-provider | Remove only close-path physical-key argument. Close uses the wrong createTreeStore arguments at BoardsPage.test.tsx:772. |
| boards-close-status | Restore only close-path logical-key status lookup. getStatus receives current instead of the physical key at BoardsPage.test.tsx:773. |
| gate-generation | Remove only actionIsCurrent's physical-key equality. Obsolete reload replaces the candidate state at FileFreshnessGate.test.tsx:951, with the diff showing Obsolete reload replacing Replacement generation. |
| ordering | Remove only candidate seeding in replaceFileGame. Immediate durable candidate event is undefined instead of Replacement game at atoms.lifecycle.test.ts:334. |
| missing-reference | Select storageFor(false) in scratch tree.ts. Missing reference reports absent instead of unavailable at tree.hydration.test.ts:69. |
| cleanup | Delete candidate on the shared staging application exception. Candidate bytes are null at atoms.lifecycle.test.ts:388 after the durable workspace write. |
| metadata | Restore captured-origin overlay. Actual selector/discard integration loses refreshed file metadata at InfoPanel.test.tsx:550. |

Exact fault commands, each run once red and once restored green in `/tmp/chessfable-sensitive-proof/scratch`:

```sh
pnpm test src/utils/tabs.test.ts -t 'pending save then actual durable replacement'
pnpm test src/state/atoms.lifecycle.test.ts src/state/store/tabStorage.test.ts -t 'duplication retains|cloneDurable preserves a required missing-reference|cloneDurable does not retry'
pnpm test src/components/tabs/BoardsPage.test.tsx -t 'BoardsPage routes provider'
pnpm test src/components/tabs/FileFreshnessGate.test.tsx -t 'pending reload cannot overwrite'
pnpm test src/state/atoms.lifecycle.test.ts -t 'durable page replacement preserves logical ownership'
pnpm test src/state/store/tree.hydration.test.ts -t 'referenced missing tree'
pnpm test src/state/atoms.lifecycle.test.ts -t 'post-write application failure retains'
pnpm test src/components/panels/info/InfoPanel.test.tsx -t 'actual selector discard preserves metadata'
```

The BoardsPage command was run separately for each of its four independent faults. Each prefix has its own `-fault.patch`, `-red.log`, `-red.exit`, `-red.sha256`, `-restored.log`, `-restored.exit` and `-restored.sha256`. `integrity.json` records their patch, log and source/test-manifest hashes, plus every full-phase test hash. `all-tests.sha256` records all eleven final test files. `repaired.sha256` records final owned, peer and production dependency hashes. `owned.patch` contains only this leaf's seven-path diff.

Integrity proof `python3 /tmp/chessfable-sensitive-proof/integrity.py` exited 0:

- Clean launch worktree and HEAD `77ba474282f79d2bd1b17efcb64e6637cc83f6f1`.
- HEAD unchanged, launch index listing unchanged and cached diff empty.
- Index listing SHA-256 `2dbc0a6f47326695988853a939ef7de611b14c79c5f5ee76c54c03faeed9b42f`.
- Git launch archive SHA-256 `aaf2c1baee4220355f8d81e0750961e7379558f7087e0c6534d47c1a8ae370ad`.
- All tracked paths outside the seven owned paths and the three authorized peer paths match their launch hashes. Root records remain unchanged.
- Authorized peer writes were observed only in `src/utils/chess.ts`, `src/utils/tests/chess.test.ts` and `src/state/store/tree.ts`. These were copied into scratch as dependencies and preserved in main.
- Main owned files, repaired snapshots, restored scratch source and every final test match byte-for-byte. Production BoardsPage.tsx and FileFreshnessGate.tsx changed only during scratch faults and match launch bytes in main.

No source-scope or design extension was needed. No unrelated defect was found. The launcher premise discrepancy is the only execution deviation. Plan authorship and arbitration shared one context. Detection used the code's model family, as specified by the assignment. Root owns final independent review, records, pixels, native proof, full gates, bundle verification, commit and push.
````

### Parser worker report

Artifact: /tmp/build-game-opening-3b67c3b9/fix-r4-comments.txt

````text
Implemented f-20261010-12, left unstaged.

- [chess.ts](/home/felixb/Projekte/chessfable/src/utils/chess.ts:409) preserves nonempty prose with the existing single-space separator.
- [chess.test.ts](/home/felixb/Projekte/chessfable/src/utils/tests/chess.test.ts:301) proves annotations and multiple prose comments survive parse → save → reparse.

All proof commands exited 0:

```text
pnpm test src/utils/tests/chess.test.ts             # 46 passed
pnpm exec oxfmt --check src/utils/chess.ts src/utils/tests/chess.test.ts
pnpm exec oxlint --deny-warnings src/utils/chess.ts src/utils/tests/chess.test.ts
pnpm exec tsgo --noEmit
git diff --check
```

The Git-derived copy used byte-identical final tests. Reversing only preservation exited 1 with the clock witness failure `expected '' to be 'Keep this explanation'`. Byte-exact source restoration returned 46 passing tests.

Retained [fault patch](/tmp/chessfable-f-20261010-12-wbe5_8hy/fault.patch), [commands, results and integrity evidence](/tmp/chessfable-f-20261010-12-wbe5_8hy/evidence.json), and [SHA manifest](/tmp/chessfable-f-20261010-12-wbe5_8hy/SHA256SUMS). All 35 manifest entries verified. HEAD, index bytes and root records remained unchanged. Peer changes stayed within named paths.

No deviations or missing premises. Source proof only. Plan authorship and arbitration shared one context. Detection used the code model family.
````

### Mechanical constant worker report

Artifact: /tmp/build-game-opening-3b67c3b9/fix-r4-analysis-limit.txt

````text
Changed only [src/state/store/tree.ts](/home/felixb/Projekte/chessfable/src/state/store/tree.ts:925): added `MAX_GENERATED_ANALYSIS_VARIATION_PLIES = 10` and used it in the existing PV length bound. The value and behavior are preserved. The target diff is unstaged, and the index is unchanged.

All requested commands exited 0:

- `pnpm test src/state/store/tree.test.ts` — 60 tests passed
- `pnpm exec oxfmt --check src/state/store/tree.ts`
- `pnpm exec oxlint --deny-warnings src/state/store/tree.ts`
- `pnpm exec tsgo --noEmit`
- `git diff --check -- src/state/store/tree.ts`

Deviation: none. No broader verification was performed.
````

### Focused J1 mechanism judgment

Artifact: /tmp/build-game-opening-3b67c3b9/lens-reference-mechanism-j1.txt

````text
Both root observations are **CONFIRMED**.

- **Cold duplication:** [BoardsPage.tsx:201](/home/felixb/Projekte/chessfable/src/components/tabs/BoardsPage.tsx:201) supplies the physical key without required-reference intent. For a source with no prior status, `writeBlocker` performs an ordinary read. Missing bytes produce `absent`, the blocker permits continuation, and `cloneDurable` returns successfully without seeding a tree. `commitNewTab` can then admit a blank duplicate. The same failure occurs when status was available and the bytes subsequently vanish, with no authoritative pending entry. Existing refusal tests first hydrate the original, so they do not cover this gap. This remains the stated f-20261010-13 obligation.

- **Retarget policy:** [tree.ts:123](/home/felixb/Projekte/chessfable/src/state/store/tree.ts:123) changes only the persistence name. The adapter created at line 691 retains its captured `requireExisting=false`. Installed Zustand replaces its adapter only when `setOptions` receives `storage`. Consequently, later retry can publish `absent` for a missing physical reference, allowing the recovery gate to release.

The proposed shared required-presence read and synchronous name-plus-adapter retarget are sound. Preserve the existing clone blocker, authoritative pending-tree controls and ordinary absent legacy duplication.

One concrete premise is missing from the proposed scope:

[blocker] src/state/workspace.ts:134 — Workspace ID repair also clones explicit physical references, but `cloneTargets` drops required-reference intent. At line 342 it calls ordinary `clone`, which accepts absence. For `{ value: "legacy-logical-owner", treeKey: <missing UUID> }`, repair allocates a new logical ID, deletes `treeKey` at line 140 and publishes a tab with no seeded tree. Subsequent hydration treats it as an editable blank legacy owner. This defeats the adopted ID-repair and required-reference obligations. The paired test at `workspace.test.ts:118` covers only readable physical bytes. (confidence: 99)

**Required revision:** include `workspace.ts` and its paired test in the bounded source correction. Carry explicit-reference intent through repair cloning into the same required-presence implementation. Prove missing-reference repair preserves the original ownership metadata and recovery obligation, while absent legacy repair remains permitted.

The lifecycle witness supports retaining the existing owners: [atoms.ts:104](/home/felixb/Projekte/chessfable/src/state/atoms.ts:104) durably saves the workspace, invokes retargeting synchronously, then publishes committed state. The replacement lifecycle test at `atoms.lifecycle.test.ts:288` checks cached store, settings, native-game and report-owner identity across active and inactive replacement. Adapter replacement fits that sequence without replacing those owners.

This is a **source scope correction**, not a product or persistence-system redesign. Preserve the peer’s named 10-ply limit and budget **1620000**. The additional witnesses, independent faults, eleven-suite proof and final root gates remain pending. I ran no tests or mutations. This is one fresh mechanism judgment on the code model family, not a full new review cohort. Root retains arbitration.

VERDICT: REVISE
````

### Canonical focused J2 mechanism judgment

Artifact: /tmp/build-game-opening-3b67c3b9/lens-reference-mechanism-j2.txt

````text
R4-DUP CLOSED at plan level against J2 — `/tmp/build-game-opening-3b67c3b9/r4-reference-mechanism-j2.body.md:37–39,61` requires explicit caller intent, shared required-presence reads and retained recovery blockers. This addresses `BoardsPage.tsx:201` and `tabStorage.ts:578–581`, including cold duplication and vanished bytes. Readable, pending and absent legacy controls remain binding. (confidence: 98)

R4-RETARGET CLOSED at plan level against J2 — candidate lines 39 and 61 require synchronous name-plus-adapter retargeting and missing/refused-read proof. This addresses `tree.ts:123,691`. Installed Zustand supports replacing both options synchronously, fitting the existing publication boundary at `atoms.ts:104–107`. (confidence: 99)

J1-WORKSPACE CLOSED at plan level against J2 — candidate lines 37–39 and 61 require repair cloning to retain explicit-reference intent and preserve original metadata on refusal. This addresses `workspace.ts:134,140,342`. The existing refusal path at lines 336–345 supports that contract. Independent repair-intent failure proof is required. (confidence: 98)

No new plan defects found.

Limitation — these are design closures. The final implementation, four new fault/restoration witnesses, cumulative source closure, bundle compliance and root gates remain unverified. Native and pixel proof remain pending. (confidence: 100)

Detection used the code author’s model family. Plan authorship and arbitration shared one context.

VERDICT: APPROVED
````

### Accepted J2 body-only correction

Artifact: /tmp/build-game-opening-3b67c3b9/r4-reference-mechanism-j2.body.md

````text
# Plan: Durable current-game page replacement

## Goal

Repair D9 in the f-20261001-08 drain run. A successful dirty discard must survive renderer reload with the replacement content and matching file index, without resetting the visible tab or its settings.

## MANDATE

Replacement durably saves the new `gameNumber` before persisting its tree. `setState` only queues the tree through `tabStorage.write`, whose later flush can refuse independently. With several tabs near the shared quota, replacing a small dirty game with a substantially larger game can save the new index while retaining the old tree bytes. Reload then hydrates the old dirty game under the new origin and presents a freshness conflict, resurrecting the discarded game. The refusal test uses `createTreeStore(undefined, ...)`, so it never exercises tree persistence. Pre-existing ordering from `2a6f66df`, retained and newly reachable through successful dirty discard in `8ed6e3ad`. Replacement needs a coordinated durability/refusal contract.

## Threat model and non-goals

Accidental storage quota/read/removal refusal, stale asynchronous results, corrupt saved envelopes and renderer reload count. Native sessionStorage obeys the synchronous Web Storage API. The WHATWG setItem algorithm rejects inability to store before changing the map: https://html.spec.whatwg.org/multipage/webstorage.html#dom-storage-setitem-dev. Application-level exceptions after a workspace write must preserve staged data and be distinguished from a definite refusal. Arbitrarily instrumented storage that mutates and then throws violates that API and is not a new workspace recovery product requirement. Do not introduce a journal, watcher, timer, service or a new user-visible recovery flow.

The original affordance mandate and its thirteen native assertions remain unchanged. Existing D7 discard authorization, owner-switch, edit, cancellation and save contracts remain binding. Original plan P2 and P3 remain separate ledger-backed design problems.

## Traced premises

* `InfoPanel.tsx:423` commits the new page before `setState` at 435.
* `store/tabStorage.ts:483` queues writes. `flush` at 788 retains failed entries while old bytes remain.
* `store/tree.ts:670` names the persistence store with the logical tab ID. Installed Zustand middleware's `persist.setOptions` changes the name used by subsequent writes synchronously.
* `utils/tabs.ts:157` already stages a fresh tree and commits its New Tab slot before reclaiming the old owner. That decision explicitly rejects existing-key rollback.
* `atoms.ts:668` onward contains per-tab settings and resource identities. Replacing the logical ID would require a settings and engine handoff.
* Workspace sweeping and commit removal accounting currently treat `tab.value` as the physical tree key. Duplication, recovery and provider creation also use that assumption.
* Design probe: `/tmp/build-game-opening-3b67c3b9/d9-design-probe.txt`. This is evidence, not an approval or implementation proof.

## Approach

### O1: One durable ownership reference

The mandate's "coordinated durability/refusal contract" requires staging the replacement under a fresh physical key and atomically referencing it with the new file index in the existing workspace envelope. Add an optional validated UUID `treeKey` to Tab and one shared effective-key function that falls back to `value` for legacy tabs. Tab ID, count, slot, active focus, settings, cached tree-store identity and native resource identity stay stable.

Every owner/read/write/recovery/clone/close/migration/sweep path resolves the physical key explicitly. Do not overload repository UUIDs with implicit aliases. Prevent two tabs from owning one tree key during validation/repair. Legacy tabs hydrate without copying their tree. ID repair clones the effective source and assigns independent physical ownership. Duplication seeds its fresh key and clears an inherited treeKey. Closing reclaims physical tree storage and logical runtime state separately. FileFreshnessGate's append-attempt flush guard must compare returned failed physical keys against the effective tree key, preserving its durable retry protection.

### O1a: Required physical presence and recovery ownership

An explicit physical reference remains required during cold hydration, duplication, workspace ID repair and cached-store rehydration after retarget. Share required-presence reading in the existing repository. An absent required source is unavailable, never a successful blank clone or editable blank owner. Retain existing source recovery blockers until explicit recovery hydrates the original cached store. Authoritative pending trees and readable sources remain cloneable. Ordinary absent legacy owners retain their existing blank semantics.

BoardsPage duplication and workspace repair retain explicit-reference intent at their existing cloning boundary. Refused repair preserves the unrepaired workspace and original ownership metadata. Cached-store retarget updates the existing persistence adapter's read policy synchronously with its name, preserving the logical store, settings and native/report owners. No new journal, registry, module, persistence version or recovery UI.

### O2: Staged replacement and publication

The mandate's "before persisting its tree" defect requires durable candidate seeding before the workspace commit. Bind the operation to current membership, non-closing tab, original file/page/effective key, actual cached store, immutable root/header authorization and D7 request generation. No yield occurs between final ownership validation and commit.

Seed only the fresh candidate using the existing bounded validator and serializer. Definite tree or workspace refusal preserves all old live, pending and durable data, origins, settings and focus. Clean up only the unowned candidate through the existing failed-admission protocol. A thrown application commit does not license candidate deletion. Preserve both generations and surface the existing error, with reload following the acknowledged durable reference.

At final commit, retain the current committed file metadata while changing only the requested game index and physical reference. A count refresh during the page read does not invalidate ownership and must not be overwritten from the captured origin.

On acknowledged commitment, synchronously retarget the existing persisted store to the candidate key and install the candidate tree, publishing consistent workspace ownership without an asynchronous gap. Use the existing Zustand persistence-name mechanism. Record removal intent for the old physical key in the same workspace commit. Reclaim the old generation only after commitment. Cleanup refusal is an applied success with retained removal intent, never an admission refusal. Pending old edits cannot shadow or later overwrite the candidate. Future edits use the candidate key.

### O3: Real durability proof and verifier compatibility

The mandate's "never exercises tree persistence" requires real-ID persisted-store tests. Cover independent tree and workspace refusal with retry, successful discard and cold reload, queued old edits, subsequent edits, owner/configuration/store identity, candidate-only rollback and cleanup refusal/replay. Cover duplication, close, unavailable/corrupt referenced tree recovery, legacy fallback, ownership collision and ID repair. Preserve D7 races and D8 ordinary stale rejection coverage. Add distinct logical/physical-key append refusal proof that the native append is never invoked when its marker flush refuses the physical key. Add an application commit that throws after the workspace write, proving both tree generations remain and cold reload follows the durable candidate. Deleting the candidate on that exception must fail the retained test.

Use disposable Git-sourced reversal tests with identical new tests to expose the original index/tree ordering, missing physical-key hydration and premature cleanup. Record specific failure assertions and restored green, with main source/index/HEAD integrity evidence. Browser and native verification remain root-owned after cumulative source closure.

Prove that a committed metadata/count refresh during the actual pending page-read and discard flow survives replacement. A captured-origin overlay fault must fail the retained test specifically on lost metadata. Shared file-backed owner predicates preserve cancellation, membership and file/page matching, and keep physical generation checks explicit. Retain BoardAnalysis Add Game refusal, cancellation, stale-count, null-stamp and uncertain-write behavior when routing its repeated guards through the shared predicates.

The unchanged native GO14 tree reader currently assumes the logical ID is the tree key. Resolve its observed workspace treeKey with legacy fallback. This is adapting a reader to the new persisted schema, not altering its expected success. Its same-ID, same-count, exact-content and origin assertions stay binding. Add no extra standalone assertion. Retain all thirteen original assertions byte-identical.

The required-reference proof covers never-activated duplication, disappearance after an available read, missing-reference workspace ID repair and cached-store retarget followed by missing or refused reads. Preserve readable and authoritative-pending sources, ordinary absent legacy duplication and repair, explicit retry recovery and original ownership metadata. Retain independent caller-intent, shared promotion, repair-intent and retarget-adapter removal faults with byte-identical tests and exact restored green. Keep the eleven earlier source faults and exact eleven-suite proof. Full root pre-review and contract gates remain required.

## Decisions and trade-offs

Choose stable logical ID plus fresh physical tree generation. Reject fresh logical tab replacement because it resets tab-keyed configuration and needs a native resource handoff. Reject writing the existing tree first and rolling it back after metadata refusal. Extend the proven staging and pending-removal contracts without a general transaction framework. The old and candidate generations temporarily share the quota, and refusal keeps the old game untouched.

This extends the durability principle of d-20260927-10 without reversing its New Tab decision. Preserve d-20261010-05. No decision is attributed to Felix.

## Risks / open questions

The bundle has only four measured bytes of current headroom. Numeric budgets and coverage floors remain unchanged. Source implementation must remove actual duplication within these loaded ownership paths if necessary to meet the existing budget, with reviewed semantics and exact proof. An unexpected caller or mechanism beyond this settled contract is reported before expanding the frozen phase.

## Not part of this task

New recovery UI, generic indeterminate-workspace journal, engine handoff, database-view durability, database deletion, splitter layout and oversized PGN work.

## Phases

One coherent persistence phase, sensitive write role through the shared launcher as required by the source-state path mapping. The normal and sensitive Codex write roles currently resolve to the same model and effort. Persistence, asynchronous ownership and renderer-local contracts change. No Rust, IPC schema or capability changes.

Source files: `src/state/workspaceTypes.ts`, `src/state/workspace.ts`, `src/state/atoms.ts`, `src/state/store/tabStorage.ts`, `src/state/store/tree.ts`, `src/utils/tabs.ts`, `src/components/common/TreeStateContext.tsx`, `src/components/tabs/BoardsPage.tsx`, `src/components/tabs/TreeRecoveryGate.tsx`, `src/components/tabs/FileFreshnessGate.tsx`, `src/components/panels/info/InfoPanel.tsx`, `src/components/boards/BoardAnalysis.tsx`, `scripts/verify-app.mjs`. Existing paired tests and lifecycle fixtures for these modules belong to the same phase. The BoardAnalysis extension is limited to routing its repeated file-owner predicates through the shared typed helper, retaining its existing guards and behavior. Consolidate FileFreshnessGate and InfoPanel's matching type guards through the same helper. Physical generation, closing, cached-store, snapshot and request checks remain binding at their respective callers. Coverage mapping may register new source only, preserving all numeric ratchets. No other source ownership is granted.

Exact phase proof: `pnpm test src/state/workspace.test.ts src/state/atoms.lifecycle.test.ts src/state/store/tabStorage.test.ts src/state/store/tree.test.ts src/state/store/tree.hydration.test.ts src/utils/tabs.test.ts src/components/tabs/BoardsPage.test.tsx src/components/tabs/TreeRecoveryGate.test.tsx src/components/tabs/FileFreshnessGate.test.tsx src/components/panels/info/InfoPanel.test.tsx src/components/boards/BoardAnalysis.test.tsx` followed by `node --check scripts/verify-app.mjs`, scoped oxfmt/oxlint, `pnpm checks:pre-review` and `pnpm gates:contract:check`. Root runs container projects database-files, files-preview, tree-recovery and the remaining original affected projects after source closure, then ordinary `pnpm build` and `pnpm verify:app`. Root completes all fourteen standalone failure stages, full affected push gates, push/required CI/install and HEAD equality.

## Carried to diff review

None initially.
````

### Round1 ownership worker report

Artifact: /tmp/build-game-opening-3b67c3b9/r4-ownership-round1/REPORT.md

````text
Completed the approved J2 reference mechanism within SCOPE12. The candidate remains unstaged. Root owns independent review, records, full gates, bundle measurement, pixels/native proof, commit and push.

Changed cumulative R4 paths:

- `src/utils/tabs.ts`
- `src/utils/tabs.test.ts`
- `src/state/atoms.lifecycle.test.ts`
- `src/state/store/tabStorage.ts`
- `src/state/store/tabStorage.test.ts`
- `src/components/tabs/BoardsPage.tsx`
- `src/components/tabs/BoardsPage.test.tsx`
- `src/components/tabs/FileFreshnessGate.test.tsx`
- `src/state/store/tree.ts`
- `src/state/store/tree.hydration.test.ts`
- `src/state/workspace.ts`
- `src/state/workspace.test.ts`

Nine paths changed since the round1 resume. The earlier save, facade and FileFreshnessGate test changes in the other three paths were retained. `owned.patch` is the cumulative twelve-path diff against HEAD. The tree.ts diff also contains the mechanical peer's preserved named 10-ply limit. No parser peer bytes changed.

The existing repository now handles required physical presence in `readTree(id, requireExisting)`. Hydration adapters, durable duplication and workspace repair use that same read. The source write blocker still refuses a previously failed hydration without rereading it. Its cold preflight also receives required-reference intent, avoiding even a transient absent publication. Readable and authoritative pending sources remain cloneable. Ordinary absent legacy owners retain blank duplication and repair semantics.

BoardsPage carries explicit intent from the original Tab, independently of prior stores or read status. Workspace cloneTargets carries the same intent from original ownership metadata. Missing-reference repair returns the original unrepaired workspace and keeps persisted metadata untouched. Cached-store retarget synchronously changes both the persistence name and the existing Zustand adapter. Cached logical owner and report identity survive missing/refused reads and explicit retry.

The inactive-source BoardsPage witnesses invoke a retained production menu callback after its source becomes inactive, with panel mounting delayed until after attempted duplication. The source has no cached store or prior read in the cold case. These tests use the actual repository, actual cached tree store, production provider and recovery gate. The vanished case first establishes available physical storage, removes its bytes with no authoritative pending tree, then attempts duplication. They prove no blank admission, original metadata/selection, no absence publication, withheld BoardGame, required recovery and blocked blank-store persistence. This is renderer integration proof through dependency test seams, with no browser/native claim.

The original save rejection guard and `ReplaceFileGameResult` committed `treeKey` facade remain intact. `replaceNewTab` retains its logical `id` contract and shared staging remains unchanged. Ownership, staged-before-reference ordering, current metadata, definite refusal, post-write preservation and cleanup proofs were retained.

Exact local check commands:

```sh
pnpm test src/state/workspace.test.ts src/state/atoms.lifecycle.test.ts src/state/store/tabStorage.test.ts src/state/store/tree.test.ts src/state/store/tree.hydration.test.ts src/utils/tabs.test.ts src/components/tabs/BoardsPage.test.tsx src/components/tabs/TreeRecoveryGate.test.tsx src/components/tabs/FileFreshnessGate.test.tsx src/components/panels/info/InfoPanel.test.tsx src/components/boards/BoardAnalysis.test.tsx
pnpm exec oxfmt --check src/utils/tabs.ts src/utils/tabs.test.ts src/state/atoms.lifecycle.test.ts src/state/store/tabStorage.ts src/state/store/tabStorage.test.ts src/components/tabs/BoardsPage.tsx src/components/tabs/BoardsPage.test.tsx src/components/tabs/FileFreshnessGate.test.tsx src/state/store/tree.ts src/state/store/tree.hydration.test.ts src/state/workspace.ts src/state/workspace.test.ts
pnpm exec oxlint --deny-warnings src/utils/tabs.ts src/utils/tabs.test.ts src/state/atoms.lifecycle.test.ts src/state/store/tabStorage.ts src/state/store/tabStorage.test.ts src/components/tabs/BoardsPage.tsx src/components/tabs/BoardsPage.test.tsx src/components/tabs/FileFreshnessGate.test.tsx src/state/store/tree.ts src/state/store/tree.hydration.test.ts src/state/workspace.ts src/state/workspace.test.ts
pnpm exec tsgo --noEmit
node --check scripts/verify-app.mjs
git diff --check
```

The eleven-suite command ran in main and the Git-derived restored scratch copy. Both exited 0 with 11 suites and 517 tests. Scoped oxfmt check, oxlint, tsgo, verifier syntax and diff check each exited 0. The matching scoped write command was `pnpm exec oxfmt src/utils/tabs.ts src/utils/tabs.test.ts src/state/atoms.lifecycle.test.ts src/state/store/tabStorage.ts src/state/store/tabStorage.test.ts src/components/tabs/BoardsPage.tsx src/components/tabs/BoardsPage.test.tsx src/components/tabs/FileFreshnessGate.test.tsx src/state/store/tree.ts src/state/store/tree.hydration.test.ts src/state/workspace.ts src/state/workspace.test.ts`, exiting 0 for each formatting pass. The detached `local-checks.sh` records the commands, individual logs and exits. Final evidence is `eleven-suites.log`, `scratch-eleven-suites.log`, `format-check.log`, `lint.log`, `types.log`, `verifier.log` and `diff-check.log`.

The initial round1 targeted command was:

```sh
pnpm test src/state/workspace.test.ts src/state/store/tree.hydration.test.ts src/state/store/tabStorage.test.ts src/components/tabs/BoardsPage.test.tsx
```

It exited 1 with 256 passed and two failed tests in four suites. The new hydration fixture incorrectly required state-wrapper object identity after Zustand rehydration. Content equality and separate store/report identity checks repaired that fixture. The initial twelve-path lint exited 1 on three conditional assertions. Initial tsgo exited 2 on two narrow mock signatures. These were repaired without deleting tests or reducing guards. `initial-targeted.log` retains the raw test failure. The first local lint/type logs were captured in tool output and reproduced verbatim as `initial-local-lint.log` and `initial-local-types.log` after the runner reused the final log names.

All sixteen independent source faults below imported successfully and failed on the intended assertions with exit 1. Exact source restoration then passed with exit 0. Every final test file remained byte-identical throughout every final fault run.

- `save-owner`: Remove the save catch ownership guard. All five late rejection cases fail. Freshness becomes conflict, unverified or unavailable, or durability returns failed rather than superseded.
- `clone-status`: Remove only the original source write blocker, retaining the new required-read API. Four assertions fail on transient available publication, missing-reference status identity, and the two repository refusal controls.
- `boards-provider`: Remove provider treeKey. Production provider calls createTreeStore with the wrong physical-key argument.
- `boards-recovery`: Remove recovery treeKey. Production recovery subscribes with the logical key.
- `boards-close-provider`: Remove close-path provider physical key. The close lookup calls createTreeStore with the wrong arguments.
- `boards-close-status`: Use the logical key for close status. Key-sensitive status assertions fail.
- `gate-generation`: Remove only actionIsCurrent physical equality. The obsolete reload replaces Replacement generation with Obsolete reload.
- `ordering`: Remove candidate seeding. Both active and inactive replacements observe undefined durable content instead of Replacement game before publication.
- `missing-reference`: Use legacy hydration policy. The missing referenced tree publishes absent instead of unavailable.
- `cleanup`: Rollback the candidate on the post-write application exception. The retained candidate bytes are null.
- `metadata`: Use captured origin metadata. The actual selector/discard flow loses the concurrent metadata refresh.
- `boards-required-intent`: Remove BoardsPage explicit-reference intent. Cold and vanished sources admit a third blank tab instead of preserving the two original tabs.
- `shared-required-read`: Remove shared missing-reference promotion. Both required clone reads return absent instead of unavailable.
- `workspace-repair-intent`: Remove workspace repair intent. Repair changes the original logical owner and drops its physical reference instead of refusing.
- `retarget-adapter-policy`: Retarget only the name. Missing read publishes absent instead of unavailable. The refused-read control still passes.
- `clone-preflight-intent`: Remove required intent from clone preflight only. Cold duplication publishes [absent, unavailable] instead of only [unavailable]. The vanished-source control still passes.

Exact fault commands, each run separately once red and once restored for its named fault in `/tmp/build-game-opening-3b67c3b9/r4-ownership-round1/scratch`:

```sh
# save-owner
pnpm test src/utils/tabs.test.ts -t 'pending save then actual durable replacement'
# clone-status
pnpm test src/state/atoms.lifecycle.test.ts src/state/store/tabStorage.test.ts -t 'duplication retains|cloneDurable preserves a required missing-reference|cloneDurable does not retry'
# boards-provider
pnpm test src/components/tabs/BoardsPage.test.tsx -t 'BoardsPage routes provider'
# boards-recovery
pnpm test src/components/tabs/BoardsPage.test.tsx -t 'BoardsPage routes provider'
# boards-close-provider
pnpm test src/components/tabs/BoardsPage.test.tsx -t 'BoardsPage routes provider'
# boards-close-status
pnpm test src/components/tabs/BoardsPage.test.tsx -t 'BoardsPage routes provider'
# gate-generation
pnpm test src/components/tabs/FileFreshnessGate.test.tsx -t 'pending reload cannot overwrite'
# ordering
pnpm test src/state/atoms.lifecycle.test.ts -t 'durable page replacement preserves logical ownership'
# missing-reference
pnpm test src/state/store/tree.hydration.test.ts -t 'referenced missing tree'
# cleanup
pnpm test src/state/atoms.lifecycle.test.ts -t 'post-write application failure retains'
# metadata
pnpm test src/components/panels/info/InfoPanel.test.tsx -t 'actual selector discard preserves metadata'
# boards-required-intent
pnpm test src/components/tabs/BoardsPage.test.tsx -t 'inactive explicit-reference duplication'
# shared-required-read
pnpm test src/state/store/tabStorage.test.ts -t 'required clone reads refuse'
# workspace-repair-intent
pnpm test src/state/workspace.test.ts -t 'missing explicit-reference ID repair refuses'
# retarget-adapter-policy
pnpm test src/state/store/tree.hydration.test.ts -t 'retargeted legacy cached store requires'
# clone-preflight-intent
pnpm test src/components/tabs/BoardsPage.test.tsx -t 'inactive explicit-reference duplication'
```

Each name has separate `-fault.patch`, `-red.log`, `-red.exit`, `-red.sha256`, `-restored.log`, `-restored.exit` and `-restored.sha256` artifacts. `fault-specs.json` retains exact replacement text and commands. `integrity.json` includes per-fault counts, exact failure assertions, patch/log hashes and source/test-manifest hashes. `all-tests.sha256` covers all eleven test files. The previous fifteen-pair candidate and checks are preserved in `candidate-before-required-preflight`, including its repaired source snapshot and hashes.

The canonical command was attempted exactly once through the project script:

```sh
pnpm checks:pre-review
```

It was launched with `setsid nohup bash /tmp/build-game-opening-3b67c3b9/r4-ownership-round1/canonical-pre-review.sh > /tmp/build-game-opening-3b67c3b9/r4-ownership-round1/canonical-launch.log 2>&1 < /dev/null & disown`. The named `canonical-pre-review.receipt` is complete. Actual exit was 125. Complete output is in `canonical-pre-review.log`. The launcher refused because agents.slice MemoryHigh was unavailable, so the gate never started. No launcher bypass, retry, separate build or ad hoc measurement ran.

Execution deviation: after that refusal, final integrity review found clone preflight still performed an ordinary cold read before the required read. The final in-scope correction passes the existing required flag into that existing predicate. An added publication assertion and sixteenth independent source fault prove the correction. All fifteen required pairs, the full main/scratch eleven-suite proof and scoped checks were rerun against the final candidate. The single canonical attempt belongs to the previous frozen candidate, whose owned patch SHA-256 was `ddd9df7cc07b60bda7d791c28c7ce2a7134ac903f260f43aa89ee818720ca104`. This final candidate therefore has no full pre-review or current bundle measurement. Root must run its valid final gates. Historical 1619922 is not a current measurement. Budget 1620000 and coverage floors remain unchanged.

The original R4 attempt's actual canonical exit 1 and initial fixture/lint failures remain history in `/tmp/chessfable-sensitive-proof` and root's `/tmp/build-game-opening-3b67c3b9/r4-initial-ownership-proof`. Neither directory was overwritten. The original guaranteed-startup125 premise was wrong for that initial attempt. This round's actual refusal was 125.

Integrity command:

```sh
python3 /tmp/build-game-opening-3b67c3b9/r4-ownership-round1/integrity.py
```

It exited 0. Manifest evidence:

- HEAD remains `77ba474282f79d2bd1b17efcb64e6637cc83f6f1`.
- Exact .git/index SHA-256 remains `4187e894341660d62878eb03a7cd482f0794b1306dab1a78e8ac1dff1fbe0cd1`.
- Index listing SHA-256 remains `2dbc0a6f47326695988853a939ef7de611b14c79c5f5ee76c54c03faeed9b42f`. Cached diff is empty.
- Git-derived launch archive SHA-256 is `aaf2c1baee4220355f8d81e0750961e7379558f7087e0c6534d47c1a8ae370ad`.
- The resumed checkout was already dirty from authorized R4 and peer work. Launch status, tracked source hashes and launch diff were recorded without treating that foreign work as corruption.
- All tracked files outside SCOPE12 retain their resumed hashes, including root records and both parser peer files.
- Main final source, repaired snapshots and restored scratch source match byte-for-byte. Production FileFreshnessGate.tsx was faulted only in scratch.
- The named analysis variation limit remains 10.
- Every final test hash matches across every red/restored source manifest.
- `repaired.sha256` and `owned.patch` identify the final candidate, with SHA values included in the final artifact manifest.
- Final owned patch SHA-256 is `d084b403ce21fecf6de1b8bf49cdd255a04ebb6bc383d455c4cc4272ea409ac5`. Final repaired source manifest SHA-256 is `4a6d80106822c54d07237aa6b0f2c3f0109e1444cb85f8c10f172ededb1879a0`.

No source-scope or design expansion was needed. No new unrelated source defect was found. The canonical launcher refusal blocks full gates and current bundle measurement in this leaf. Plan authorship and arbitration shared one context. Detection used the code's model family. No skills, agents, staging, commits, push, root-record edits or UI/native verification occurred.
````

### Round2 ownership worker report

Artifact: /tmp/build-game-opening-3b67c3b9/r4-ownership-round2/REPORT.md

````text
Completed R4 proof-fix round2. Only `src/state/store/tabStorage.test.ts` changed since launch. The correction remains unstaged. No product source, other test, parser peer, mechanical constant or root record changed.

The existing test `scheduled lifecycle events flush once and a missing clone source stays absent` now asserts the result of `clone("missing", "target")` without an explicit policy is `{ kind: "absent" }`. It also asserts the published source status is absent, the target status remains not-read, pending count is zero and no durable target exists. The existing target-read and pagehide/beforeunload lifecycle assertions remain. No test or API default was removed. No semantics, ratchets, thresholds or mutant suppression changed.

The actual root red archive confirmed 1067 killed mutants and one surviving BooleanLiteral at tabStorage.ts:513, `clone` default false to true. There were no other survived, no-coverage or error mutants. Its workspace.ts score was 100.00. Root's actual completion was 1 on that mutation lane. Root's reported bundle measurement was 1619967 under the unchanged limit 1620000. This leaf ran no build or bundle command. Root must rerun its full pre-review and contract. The one source reversal here proves this accepted legacy contract directly, without claiming a completed full mutation gate.

Exact final checks:

```sh
pnpm exec oxfmt src/state/store/tabStorage.test.ts
pnpm test src/state/workspace.test.ts src/state/atoms.lifecycle.test.ts src/state/store/tabStorage.test.ts src/state/store/tree.test.ts src/state/store/tree.hydration.test.ts src/utils/tabs.test.ts src/components/tabs/BoardsPage.test.tsx src/components/tabs/TreeRecoveryGate.test.tsx src/components/tabs/FileFreshnessGate.test.tsx src/components/panels/info/InfoPanel.test.tsx src/components/boards/BoardAnalysis.test.tsx
pnpm exec oxfmt --check src/state/store/tabStorage.test.ts
pnpm exec oxlint --deny-warnings src/state/store/tabStorage.test.ts
pnpm exec tsgo --noEmit
node --check scripts/verify-app.mjs
git diff --check
```

Every command above exited 0. The exact eleven-suite command ran once in main and once in the restored Git-derived scratch copy, both with 11 suites and 517 passed tests. Logs and exits are `format-write`, `eleven-suites`, `scratch-eleven-suites`, `format-check`, `lint`, `types`, `verifier` and `diff-check`. The named `local-checks.receipt` is complete.

All seventeen independent source faults imported successfully, failed on specific semantic assertions with exit 1 and passed after exact source restoration with exit 0. Every final retained test was byte-identical throughout. The earlier sixteen fault patches and targeted commands match round1 exactly, and every earlier specific assertion remains present in the new red logs.

| Fault prefix | Red test counts | Restored test counts | Specific assertion |
| --- | --- | --- | --- |
| save-owner | 5 failed | 40 skipped (45) | 5 passed | 40 skipped (45) | Late save rejection publishes stale freshness or a failed outcome. |
| clone-status | 4 failed | 164 skipped (168) | 4 passed | 164 skipped (168) | Duplication replaces the original failed-hydration status or stops refusing its source. |
| boards-provider | 1 failed | 28 skipped (29) | 1 passed | 28 skipped (29) | Provider receives the wrong physical key. |
| boards-recovery | 1 failed | 28 skipped (29) | 1 passed | 28 skipped (29) | Recovery subscribes to the logical key. |
| boards-close-provider | 1 failed | 28 skipped (29) | 1 passed | 28 skipped (29) | Close creates the store with the wrong physical key. |
| boards-close-status | 1 failed | 28 skipped (29) | 1 passed | 28 skipped (29) | Close checks logical-key status. |
| gate-generation | 1 failed | 38 skipped (39) | 1 passed | 38 skipped (39) | Obsolete reload overwrites the replacement generation. |
| ordering | 2 failed | 43 skipped (45) | 2 passed | 43 skipped (45) | Candidate content is not durable before reference publication. |
| missing-reference | 1 failed | 8 skipped (9) | 1 passed | 8 skipped (9) | Required cold hydration publishes absent. |
| cleanup | 1 failed | 44 skipped (45) | 1 passed | 44 skipped (45) | Post-write exception deletes candidate bytes. |
| metadata | 1 failed | 44 skipped (45) | 1 passed | 44 skipped (45) | Captured origin loses the concurrent metadata refresh. |
| boards-required-intent | 2 failed | 27 skipped (29) | 2 passed | 27 skipped (29) | Cold and vanished physical sources admit a blank duplicate. |
| shared-required-read | 2 failed | 121 skipped (123) | 2 passed | 121 skipped (123) | Required clone reads return absent. |
| workspace-repair-intent | 1 failed | 96 skipped (97) | 1 passed | 96 skipped (97) | Repair changes original ownership instead of refusing. |
| retarget-adapter-policy | 1 failed | 1 passed | 7 skipped (9) | 2 passed | 7 skipped (9) | Retargeted missing reference publishes absent. |
| clone-preflight-intent | 1 failed | 1 passed | 27 skipped (29) | 2 passed | 27 skipped (29) | Cold preflight publishes absent before unavailable. |
| clone-default-legacy | 1 failed | 122 skipped (123) | 1 passed | 122 skipped (123) | Ordinary legacy clone returns unavailable instead of absent. |

The new `clone-default-legacy` fault changes only `clone`'s default requireExisting false to true in Git scratch. It fails at tabStorage.test.ts:1735 with `unavailable` instead of `absent`. Its raw log includes the missing-reference error, proving the wrong required-reference policy reached an ordinary legacy caller. Exact product source restoration passes the same retained test.

Exact targeted commands, each separately run once red and once restored in `/tmp/build-game-opening-3b67c3b9/r4-ownership-round2/scratch`:

```sh
# save-owner
pnpm test src/utils/tabs.test.ts -t 'pending save then actual durable replacement'
# clone-status
pnpm test src/state/atoms.lifecycle.test.ts src/state/store/tabStorage.test.ts -t 'duplication retains|cloneDurable preserves a required missing-reference|cloneDurable does not retry'
# boards-provider
pnpm test src/components/tabs/BoardsPage.test.tsx -t 'BoardsPage routes provider'
# boards-recovery
pnpm test src/components/tabs/BoardsPage.test.tsx -t 'BoardsPage routes provider'
# boards-close-provider
pnpm test src/components/tabs/BoardsPage.test.tsx -t 'BoardsPage routes provider'
# boards-close-status
pnpm test src/components/tabs/BoardsPage.test.tsx -t 'BoardsPage routes provider'
# gate-generation
pnpm test src/components/tabs/FileFreshnessGate.test.tsx -t 'pending reload cannot overwrite'
# ordering
pnpm test src/state/atoms.lifecycle.test.ts -t 'durable page replacement preserves logical ownership'
# missing-reference
pnpm test src/state/store/tree.hydration.test.ts -t 'referenced missing tree'
# cleanup
pnpm test src/state/atoms.lifecycle.test.ts -t 'post-write application failure retains'
# metadata
pnpm test src/components/panels/info/InfoPanel.test.tsx -t 'actual selector discard preserves metadata'
# boards-required-intent
pnpm test src/components/tabs/BoardsPage.test.tsx -t 'inactive explicit-reference duplication'
# shared-required-read
pnpm test src/state/store/tabStorage.test.ts -t 'required clone reads refuse'
# workspace-repair-intent
pnpm test src/state/workspace.test.ts -t 'missing explicit-reference ID repair refuses'
# retarget-adapter-policy
pnpm test src/state/store/tree.hydration.test.ts -t 'retargeted legacy cached store requires'
# clone-preflight-intent
pnpm test src/components/tabs/BoardsPage.test.tsx -t 'inactive explicit-reference duplication'
# clone-default-legacy
pnpm test src/state/store/tabStorage.test.ts -t 'scheduled lifecycle events flush once and a missing clone source stays absent'
```

Each prefix has its own `-fault.patch`, `-red.log`, `-red.exit`, `-red.sha256`, `-restored.log`, `-restored.exit` and `-restored.sha256`. `fault-specs.json` stores exact mutation text and commands. `integrity.json` records all seventeen patch/log/source-test SHA values, counts and exact assertions. `all-tests.sha256` covers all eleven final tests. No round1 hashes are claimed as new execution evidence.

After final test freeze and all local proofs, the canonical command was attempted exactly once:

```sh
pnpm checks:pre-review
```

It was detached through `setsid nohup bash /tmp/build-game-opening-3b67c3b9/r4-ownership-round2/canonical-pre-review.sh > /tmp/build-game-opening-3b67c3b9/r4-ownership-round2/canonical-launch.log 2>&1 < /dev/null & disown`. Its named `canonical-pre-review.receipt` is complete. The actual exit was 125. Complete output in `canonical-pre-review.log` says agents.slice MemoryHigh is unavailable, so the gate cap cannot be derived and the gate did not start. No bypass or retry occurred. This refusal is independent of root's earlier valid interactive run, which ended with completion 1 on the surviving mutant.

Integrity command:

```sh
python3 /tmp/build-game-opening-3b67c3b9/r4-ownership-round2/integrity.py
```

It exited 0 and proves:

- HEAD remains `77ba474282f79d2bd1b17efcb64e6637cc83f6f1`.
- Exact index SHA-256 remains `4187e894341660d62878eb03a7cd482f0794b1306dab1a78e8ac1dff1fbe0cd1`, with unchanged index listing and empty cached diff.
- Only the owned test changed against the complete tracked launch manifest.
- Every product source and every other test matches the round1 final manifest. Both parser peer hashes and the mechanical named 10-ply constant remain unchanged.
- Main source, repaired source snapshot and every restored scratch file match byte-for-byte.
- The changed test's final SHA-256 is `64770bea0c75f4c2045fea6076d197624e85097dff6815f016d0cbc3bee863d6`.
- Exact round2 delta `round2.patch` SHA-256 is `8588002f9f009b0925c111a827f128b035ca2ad14c3c620c05a72476d8a1caf8`.
- Final source/test manifest `repaired.sha256` SHA-256 is `678ded2ff6e944fb1fad7f652628334662a2d459da6f29f29f86a41402b3d298`.
- Every round1 evidence file, including its candidate-before-required-preflight history, retains its launch hash. Root's archived red root.log, mutation.json, stryker.log, completion record and mutation-lane log retain their hashes.
- The earlier sixteen exact fault patches retain their round1 SHA values, with new logs and the final changed test hash in every retained manifest.

`round2.patch` is the four-line net test correction against round1. `owned.patch` is the cumulative owned-test diff against HEAD. `launch-files.sha256`, `round1-evidence-launch.sha256` and `root-red-evidence-launch.sha256` preserve the launch comparison inputs. `artifacts.sha256` inventories this round's top-level proof artifacts.

No source-scope or mechanism deviation was needed. A missing in-memory runner value required recreating the proof runner before its first source fault. That tool-state failure changed no source or proof result. No unrelated defect was found. Full canonical gate execution remains blocked in this leaf by the actual launcher refusal. Root owns the final full pre-review and contract. No skills, agents, staging, commits, push, records edits or UI/native verification occurred. Plan authorship and arbitration shared one context. Detection used the code model family.
````
