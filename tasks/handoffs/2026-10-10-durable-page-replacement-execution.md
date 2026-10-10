# Durable page replacement execution evidence

This is the D9 companion to the f-20261001-08 drain run. Plan and raw plan-review history are in `2026-10-10-durable-page-replacement.md`. Root owns arbitration and commits. Plan authorship and arbitration shared one context. Detection used the same model family as the code.

Current checkpoint: source commit `cb09c965` passed the independent root phase proof, followed by verified R4 source repairs in `099bfa21`, `db6ac190` and `4ee4ff12`. The historical attempt states below are preserved as failure history. D9-P3 is allocated `f-20261010-08` by official intake `0816fe66`. R4 found a duplication consumer hole, then focused mechanism review found required-reference retarget and workspace-repair obligations. Their complete raw history, two proof-fix rounds and current root gate receipt are in `2026-10-10-game-opening-round4.md`. Fresh cumulative source closure and every browser/native proof remain pending.

Review measurement: local durability plan r1 wall 271 seconds, r2 wall 152 seconds, r3 wall 297 seconds. Known non-overlapping external review waits are none identified, active review wall is unknown. Two unique lens issues D9-P1 and D9-P2 were adopted in r1 and closed in r2. Root's correction-introduced D9-P3 came from the first source candidate and was closed at plan level in r3, then proved in both source proof-fix rounds. The unchanged bundle obligation required two proof-fix rounds after the initial red candidate. No withdrawal or new persistence mechanism occurred. The original companion design extends the primary run rather than attributing its additional review rounds to inherited history.

## First source attempt, not accepted

Sensitive write, gpt-6.1-sol/high, persistent handle `01a1238d-ed2d-7e52-b324-f6f2b5c0deeb`. Implementation stage 1791597866 through 1791601451, 3,585 seconds elapsed. Active time and external waits are not measured. The source remains unstaged on parent `3e8f8ba0b35def69417fbc7dcc0262e5d38911bd`. No source commit was made on the red gate.

Root read the completed report only after the canonical poll reported completed=1/1. Root inspected the complete production changes and paired test diffs, then independently checked all 21 final source/test SHA-256 values against the manifest. HEAD and index were unchanged, and the cached diff was empty. Root has not yet run the required independent phase proof because the candidate still needs repair. No browser or native verification has occurred.

The final exact ten-suite logs show 477 passing tests in both main and the Git-sourced scratch checkout. Pre-review build, format/lint, coverage mapping and affected mutation checks passed. The workspace mutation package killed all 1,067 mutants at the unchanged 100% floor. Contract exit was 0. Pre-review exit was 1 solely on bundle. Final measured entry 540,069, largest lazy 515,348 and total 1,620,353 gzip bytes exceeded the unchanged 1,620,000 total limit by 353 bytes. Earlier red bundle/mutation attempts remain in the scratch directory and are not reclassified as green. The worker also disclosed an initial attached stale pre-review attempt stopped with exit 143, followed by detached completed gates.

Root read all three final fault patches, specific assertion failures and restored exit records. The candidate-only seed removal failed on absent durable Replacement game content. Disabling missing-reference hydration failed on absent rather than unavailable status. Deleting the candidate on an application commit exception failed on missing candidate bytes. Each imported successfully, exited 1 on its semantic assertion and passed after exact restoration. These are source proof, not native assertion staging.

Scratch evidence: `/tmp/build-game-opening-3b67c3b9/durable-replacement-proof/proof-summary.json`, `final-provenance.json`, `integrity-final.json`, final red/restored logs and patches. Final implementation patch SHA-256 `8ff1f805cc3260bd02fea0a5fc6a02d27235550666b197d74ab0f9e4df00b772`. Index SHA-256 `9596d4f4011f7d38f4619d9379c07f67c99fb01bc52ef0841c477dc2e9609af5`.

The verifier diff adapts only GO14's tree reader to the observed current owner's treeKey with fallback. All thirteen original assertion bodies are byte-identical. GO14's message and success predicates stay unchanged, while its reader changes. The worker's unqualified wording about every assertion being byte-identical must be read with that explicit reader exception.

### Completed worker report, verbatim

````text
**Blocked by the bundle budget.** The persistence implementation remains unstaged. Final pre-review exits **1 solely because the bundle is 353 bytes over its unchanged limit**. No tool startup blocker occurred.

Changed all twelve planned source paths and nine paired test files. Exact paths, Git provenance and per-file hashes are in the [manifest](/tmp/build-game-opening-3b67c3b9/durable-replacement-proof/final-provenance.json).

Final proof:

- Exact assigned `pnpm test …` command: **0**, 477 tests passed in both main and Git-sourced scratch.
- `node --check scripts/verify-app.mjs`, scoped oxfmt/oxlint and typecheck: **0**.
- `pnpm gates:contract:check`: **0**.
- `pnpm checks:pre-review`: **1**. Build, formatting, lint, coverage mapping and mutation passed.
- Bundle: entry **540,069**, largest lazy **515,348** (`src/routes/index.lazy.tsx`), total **1,620,353 gzip bytes** against **1,620,000**.

[Command exits and logs](/tmp/build-game-opening-3b67c3b9/durable-replacement-proof/proof-summary.json).

All required scratch faults imported successfully, failed their semantic assertions and passed after exact restoration:

| Fault | Failure | Red → restored |
|---|---|---|
| Deferred durability | Missing persisted replacement content | 1 → 0 |
| Missing-reference hydration | `absent` instead of `unavailable` | 1 → 0 |
| Premature candidate cleanup | Candidate durable bytes deleted | 1 → 0 |

[Fault patches, source/test hashes and integrity evidence](/tmp/build-game-opening-3b67c3b9/durable-replacement-proof/integrity-final.json).

HEAD remains `3e8f8ba0b35def69417fbc7dcc0262e5d38911bd`. Index SHA-256 remains `9596d4f4011f7d38f4619d9379c07f67c99fb01bc52ef0841c477dc2e9609af5`. Cached diff is empty. Foreign root notes are preserved. The verifier differs only in GO14’s physical-tree reader. Every assertion remains byte-identical.

Deviations: the bundle remains red, and the first stale pre-review attempt ran attached and was stopped with exit 143. Subsequent long gates were detached and completed. No scope, budget or baseline expansion occurred. No unexpected mandatory consumers were found.

Plan authorship and arbitration shared one context. Detection ran on the code’s model family.
````

## Root-confirmed metadata correction

Root traced the completed replacement helper, sameFileGameOrigin and FileInfo.reload. The helper takes the replacement gameOrigin from its captured owner, while the prior updater used the current previous origin. A count refresh during a page read passes all ownership guards and is overwritten by the capture. Root published the complete f-PENDING entry through the official helper at `tasks/findings-inbox/20261010-045000-2731978-1791600600779307681-6.md`. This is an intake location, not a claim that a consumed spool file will remain there. Related f-20261010-07 owns durability, while this has a distinct captured-metadata cause. It remains Fix-now in this source phase. No product decision is needed.

## Read-only consolidation probe

Sensitive read-only, gpt-6.1-sol/medium. Canonical poll completed=1/1. No source changes, builds or gates. The requested source diff hash was stable across two readings, `e0492389ae141ee90edafdcf1ae83d3cddc87919946c11283cf0c25b2587d14b`. The probe recommends one shared typed file-backed-tab guard and matching predicate, with the existing BoardAnalysis append caller as one narrow additional source path. Root read the complete BoardAnalysis and relevant tests before adopting the extension for plan review. No gzip saving is claimed before build proof.

The repeated evidence is FileFreshnessGate.isFileOrigin, InfoPanel.isFileBackedTab and five BoardAnalysis membership/type/origin checks. The shared predicate must retain all caller-specific physical-key, cache, closing, snapshot, generation and cancellation safeguards. Keep saveToFile.sameOrigin's stricter kind equality and InfoPanel's file-only count comparison. Existing Add Game cancellation, origin-change, stale-count, null-stamp and uncertain-write behavior remains binding.

Exact probe report: `/tmp/build-game-opening-3b67c3b9/bundle-consolidation-probe.txt`. Scoped plan revision and review follow before the source writer resumes. The bundle failure remains an execution failure requiring repair, rather than an external permission blocker.

### Completed probe report, verbatim

````text
Inspected HEAD `3e8f8ba0b35def69417fbc7dcc0262e5d38911bd`. SHA-256 of the requested source-path `git diff HEAD` was unchanged across two readings:

`e0492389ae141ee90edafdcf1ae83d3cddc87919946c11283cf0c25b2587d14b`

Recommend consolidating **file-backed tab admission and origin matching** in [tabs.ts](/home/felixb/Projekte/chessfable/src/utils/tabs.ts:351), with a narrow extension to `BoardAnalysis.tsx`.

- **Repeated source evidence:** `FileFreshnessGate.isFileOrigin` and `InfoPanel.isFileBackedTab` independently narrow the same two origin kinds. `BoardAnalysis.appendGame` repeats membership, file-kind narrowing, and `sameFileGameOrigin` checks at initial admission, before the native write, before count refresh, inside the count update, and after write completion. `sameFileGameOrigin` already checks both origin kinds itself.
- **Concrete extraction:** Export a shared `FileBackedTab` type, `isFileBackedTab` predicate, and a typed `matchesFileGameTab(current, capturedOrigin)` predicate. The latter returns false for missing membership and delegates file/page equality to `sameFileGameOrigin`. Route the repeated guards through these functions. Keep `InfoPanel.belongsToFile` as a file-only comparison because count updates intentionally span pages.
- **Preserved invariants:** Keep physical-key equality, cached-store identity, closing intent, root/header snapshots, request generations, cancellation, and synchronous final validation in their current callers. Preserve `saveToFile.sameOrigin`’s stricter origin-kind equality. The extraction must not change durable staging, refusal cleanup, exception preservation, or append-marker flushing.
- **Scope extension:** Only [BoardAnalysis.tsx](/home/felixb/Projekte/chessfable/src/components/boards/BoardAnalysis.tsx:120) and its paired test. It is an existing consumer of the changed save/origin mechanism, renders `InfoPanel`, and owns that panel’s Add Game callback. Its five repeated guards provide a concrete second use beyond the current phase files.
- **Test obligations:** Retain Add Game cancellation, captured-origin change, stale-count retry, null-stamp, and uncertain-write tests. Exercise missing membership, changed file/page, and acceptance of refreshed metadata for the same origin. Retain the phase’s physical-generation supersession, snapshot/ownership, post-write exception, cleanup replay, and physical-key append refusal proofs.

This is the strongest relevant remaining consolidation I found. The supplied measurement is **353 gzip bytes over budget**, but I cannot establish that this extraction clears it without the writer’s build proof. The checker sums individually gzipped emitted JS/CSS assets, so moving code between chunks alone does not reduce the total.

All six named rules, coverage requirements, budget checker, plan through Carried, requested source paths, and relevant consumers/tests were inspected. No files changed and no builds, gates, mutation tests, or UI verification ran. Detection used the code author’s model family.
````

## Scoped plan amendment and completed local round 3

The original two local durability plan rounds remain preserved in the prior handoff. This amendment adds the current-metadata requirement, its actual modal regression, and only the existing BoardAnalysis predicate consumer and paired test. Root detected D9-P3. Four fresh lenses adopted no new findings and closed its design obligation. Bundle compliance remained an execution obligation. Local durability adoption sequence is 2, 0, 0. The primary adoption sequence remains 1, 0, 0. These are distinct explicitly mapped cohorts, not invented inherited rounds. Plan authorship and arbitration shared one context. Detection ran on the code model family.

### Reviewed amendment body, verbatim

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

## Reviews

Round 1 ran seven selected plan-capable lenses. D9-P1 is the omitted FileFreshnessGate physical-key flush consumer, witnessed by plan, correctness and persisted-state. Fix in O1/O3 and the phase scope because a physical-key schema change otherwise bypasses existing append retry protection. Authority: MANDATE's coordinated durability/refusal contract. D9-P2 is the missing thrown-post-commit durability proof, witnessed by tests. Fix in O3 because it verifies O2's already-proposed exception semantics. No new mechanism. Other lenses reported no findings. No Defer or Skip. A launch routing error used normal instead of sensitive for six lenses. Both roles resolve to the same Codex read model and effort under the registry wildcard, but round 2 will use the required sensitive role. Plan authorship and arbitration shared one context. Detection used the same model family as code.

### Round 1 plan

```text
[blocker] /tmp/build-game-opening-3b67c3b9/d9-plan-r1.md:69 — O1’s physical-key contract leaves `FileFreshnessGate` outside the permitted source scope. Its append guard checks `failedTabs.includes(tabId)` at `src/components/tabs/FileFreshnessGate.tsx:318`, while `src/state/store/tabStorage.ts:794` returns failed physical storage keys. After replacement, a refused write of `appendAttempted` would bypass the guard and allow native append without its durable retry protection. Include this consumer and its paired test in scope and proof. The existing test at `src/components/tabs/FileFreshnessGate.test.tsx:521` returns the logical ID, masking the mismatch. Require distinct logical/physical keys and assert that failed persistence prevents native append. (confidence: 99)

Detection used the code author’s model family. Plan authorship and arbitration shared one context.

VERDICT: REVISE
```

### Round 1 minimalism

```text
No bloat or duplication defects found in the proposed obligations. The optional physical tree key supports durable replacement while preserving logical tab identity. Its lifecycle adaptations and persisted-store tests are necessary consequences of that schema change. The plan reuses existing staging, validation and removal contracts and adds no source files.

Limitation: no D9 implementation exists, so helper-level duplication remains for cumulative diff review (confidence: 100).

Detection used the code’s model family. Plan authorship and arbitration shared one context.

VERDICT: APPROVED
```

### Round 1 correctness

```text
[blocker] src/components/tabs/FileFreshnessGate.tsx:318 — O1/O2 make persistence use physical key P while preserving logical tab ID L. If the append-preparation flush refuses P, `flush()` returns `[P]`, but `failedTabs.includes(tabId)` checks L and incorrectly proceeds with the native append. The `appendAttempted` marker is then undurable, allowing another append after reload if the native outcome is uncertain. The phase’s exclusive source list omits this consumer. Include it and resolve the effective physical key before checking flush failures. (confidence: 98)

Limitation: No D9 implementation exists. Store retargeting, collision repair and publication ordering remain unverified implementation obligations. (confidence: 100)

Detection uses the author’s model family. Plan authorship and arbitration also share a context.

VERDICT: REVISE
```

### Round 1 error-handling

```text
No error-handling defects found in O1–O3.

Limitation: D9 has no implementation yet. This approves the planned failure contract, not runtime behavior (confidence: 95).

Detection used the author’s model family. Plan authorship and arbitration shared one context.

VERDICT: APPROVED
```

### Round 1 tests

```text
[should-fix] /tmp/build-game-opening-3b67c3b9/d9-plan-r1.md:45 — O2 requires preserving both generations when application commit throws, but O3 names no proof for that outcome. Add a persisted replacement test that throws after the workspace write, then asserts both generations remain and cold reload restores the referenced candidate. Deleting the candidate in the exception handler could otherwise pass the listed success and definite-refusal tests. (confidence: 90)

VERDICT: APPROVED
```

### Round 1 chess-semantics

```text
No chess-domain findings in O1–O3. The proposed replacement installs the candidate tree and its paths together, resets practice state, and preserves metadata through existing validation.

This is plan approval only. Detection used the same model family as the authoring context.

VERDICT: APPROVED
```

### Round 1 persisted-state

```text
[blocker] /tmp/build-game-opening-3b67c3b9/d9-plan-r1.md:69 — The frozen file list excludes `FileFreshnessGate.tsx`, whose append guard at line 318 compares `tabStorage.flush()` failures against the logical `tabId`. After replacement introduces a different physical `treeKey`, a quota refusal returns that physical key and bypasses the guard. “Save as new game” then proceeds without durably recording `appendAttempted`, allowing another append after reload if the first append’s outcome was uncertain. Include this consumer and its paired refusal test, resolving the effective physical key explicitly. (confidence: 99)

VERDICT: REVISE
```

### Round 2 closure

Four witness lenses completed. D9-P1 and D9-P2 are CLOSED, no new issues, Defer or Skip. The phase launch role was corrected mechanically to sensitive under the project path mapping after obligation closure. The registry resolves normal and sensitive write roles to the identical Codex model and effort. This changes routing metadata only, not an obligation, mechanism, source scope or acceptance case. Primary affordance plan history remains intact. D9 plan review is distinct from its later cumulative source review.

#### plan

```text
D9-P1 CLOSED — d9-r2 `tasks/plans/.plan-durable-page-replacement-r2.body.md:33,45,69,71` requires effective-key comparison, distinct logical/physical-key refusal proof, and includes FileFreshnessGate source and tests. This addresses the mismatch at `src/components/tabs/FileFreshnessGate.tsx:318` against physical failures returned at `src/state/store/tabStorage.ts:795`. (confidence: 99)

D9-P2 CLOSED — d9-r2 `tasks/plans/.plan-durable-page-replacement-r2.body.md:45` explicitly requires thrown-after-write preservation of both generations, cold reload following the candidate, and failure if exception cleanup deletes it. The existing application-commit injection at `src/state/atoms.lifecycle.test.ts:312,347` provides a feasible proof route. Closure concerns the plan, implementation remains unverified. Detection uses the code’s model family, plan authorship and arbitration shared one context. (confidence: 98)

VERDICT: APPROVED
```

#### correctness

```text
D9-P1 CLOSED — O1 now requires the effective physical-key flush guard. O3 requires distinct-key refusal proof, and Phases includes FileFreshnessGate source and tests.
D9-P2 CLOSED — O3 now requires a post-workspace-write exception test preserving both generations and proving cold reload restores the candidate, matching O2.
VERDICT: APPROVED
```

#### tests

```text
D9-P1 CLOSED — O1/O3 require distinct logical and physical keys, with native append never invoked when the physical-key flush refuses. Reverting the guard to logical-ID comparison would fail that assertion. Source scope and the phase test command now include FileFreshnessGate.

D9-P2 CLOSED — O3 requires a real persisted commit that throws after the workspace write, assertions retaining both generations, and cold reload restoring the referenced candidate. Deleting the candidate in the exception handler would fail those assertions. This closes the plan obligation, with implementation proof still pending.

VERDICT: APPROVED
```

#### persisted-state

```text
D9-P1 CLOSED — O1 resolves FileFreshnessGate’s flush failures against the effective physical key. O3 requires distinct logical/physical-key refusal proof preventing native append. Phases includes the consumer, paired test and exact proof command.

D9-P2 CLOSED — O3 requires an application exception after the workspace write, preservation of both tree generations and cold reload of the referenced candidate. Candidate deletion must fail the retained test.

VERDICT: APPROVED
```
````

### Exact amendment delta, verbatim

````text
--- /tmp/build-game-opening-3b67c3b9/d9-plan-r2.md
+++ /home/felixb/Projekte/chessfable/tasks/plans/2026-10-10-durable-page-replacement.md
@@ -38,6 +38,8 @@
 
 Seed only the fresh candidate using the existing bounded validator and serializer. Definite tree or workspace refusal preserves all old live, pending and durable data, origins, settings and focus. Clean up only the unowned candidate through the existing failed-admission protocol. A thrown application commit does not license candidate deletion. Preserve both generations and surface the existing error, with reload following the acknowledged durable reference.
 
+At final commit, retain the current committed file metadata while changing only the requested game index and physical reference. A count refresh during the page read does not invalidate ownership and must not be overwritten from the captured origin.
+
 On acknowledged commitment, synchronously retarget the existing persisted store to the candidate key and install the candidate tree, publishing consistent workspace ownership without an asynchronous gap. Use the existing Zustand persistence-name mechanism. Record removal intent for the old physical key in the same workspace commit. Reclaim the old generation only after commitment. Cleanup refusal is an applied success with retained removal intent, never an admission refusal. Pending old edits cannot shadow or later overwrite the candidate. Future edits use the candidate key.
 
 ### O3: Real durability proof and verifier compatibility
@@ -45,6 +47,8 @@
 The mandate's "never exercises tree persistence" requires real-ID persisted-store tests. Cover independent tree and workspace refusal with retry, successful discard and cold reload, queued old edits, subsequent edits, owner/configuration/store identity, candidate-only rollback and cleanup refusal/replay. Cover duplication, close, unavailable/corrupt referenced tree recovery, legacy fallback, ownership collision and ID repair. Preserve D7 races and D8 ordinary stale rejection coverage. Add distinct logical/physical-key append refusal proof that the native append is never invoked when its marker flush refuses the physical key. Add an application commit that throws after the workspace write, proving both tree generations remain and cold reload follows the durable candidate. Deleting the candidate on that exception must fail the retained test.
 
 Use disposable Git-sourced reversal tests with identical new tests to expose the original index/tree ordering, missing physical-key hydration and premature cleanup. Record specific failure assertions and restored green, with main source/index/HEAD integrity evidence. Browser and native verification remain root-owned after cumulative source closure.
+
+Prove that a committed metadata/count refresh during the actual pending page-read and discard flow survives replacement. A captured-origin overlay fault must fail the retained test specifically on lost metadata. Shared file-backed owner predicates preserve cancellation, membership and file/page matching, and keep physical generation checks explicit. Retain BoardAnalysis Add Game refusal, cancellation, stale-count, null-stamp and uncertain-write behavior when routing its repeated guards through the shared predicates.
 
 The unchanged native GO14 tree reader currently assumes the logical ID is the tree key. Resolve its observed workspace treeKey with legacy fallback. This is adapting a reader to the new persisted schema, not altering its expected success. Its same-ID, same-count, exact-content and origin assertions stay binding. Add no extra standalone assertion. Retain all thirteen original assertions byte-identical.
 
@@ -64,11 +68,11 @@
 
 ## Phases
 
-One coherent persistence phase, normal write rung through the shared launcher. Persistence, asynchronous ownership and renderer-local contracts change. No Rust, IPC schema or capability changes.
+One coherent persistence phase, sensitive write role through the shared launcher as required by the source-state path mapping. The normal and sensitive Codex write roles currently resolve to the same model and effort. Persistence, asynchronous ownership and renderer-local contracts change. No Rust, IPC schema or capability changes.
 
-Source files: `src/state/workspaceTypes.ts`, `src/state/workspace.ts`, `src/state/atoms.ts`, `src/state/store/tabStorage.ts`, `src/state/store/tree.ts`, `src/utils/tabs.ts`, `src/components/common/TreeStateContext.tsx`, `src/components/tabs/BoardsPage.tsx`, `src/components/tabs/TreeRecoveryGate.tsx`, `src/components/tabs/FileFreshnessGate.tsx`, `src/components/panels/info/InfoPanel.tsx`, `scripts/verify-app.mjs`. Existing paired tests and lifecycle fixtures for these modules belong to the same phase. Coverage mapping may register new source only, preserving all numeric ratchets. No other source ownership is granted.
+Source files: `src/state/workspaceTypes.ts`, `src/state/workspace.ts`, `src/state/atoms.ts`, `src/state/store/tabStorage.ts`, `src/state/store/tree.ts`, `src/utils/tabs.ts`, `src/components/common/TreeStateContext.tsx`, `src/components/tabs/BoardsPage.tsx`, `src/components/tabs/TreeRecoveryGate.tsx`, `src/components/tabs/FileFreshnessGate.tsx`, `src/components/panels/info/InfoPanel.tsx`, `src/components/boards/BoardAnalysis.tsx`, `scripts/verify-app.mjs`. Existing paired tests and lifecycle fixtures for these modules belong to the same phase. The BoardAnalysis extension is limited to routing its repeated file-owner predicates through the shared typed helper, retaining its existing guards and behavior. Consolidate FileFreshnessGate and InfoPanel's matching type guards through the same helper. Physical generation, closing, cached-store, snapshot and request checks remain binding at their respective callers. Coverage mapping may register new source only, preserving all numeric ratchets. No other source ownership is granted.
 
-Exact phase proof: `pnpm test src/state/workspace.test.ts src/state/atoms.lifecycle.test.ts src/state/store/tabStorage.test.ts src/state/store/tree.test.ts src/state/store/tree.hydration.test.ts src/utils/tabs.test.ts src/components/tabs/BoardsPage.test.tsx src/components/tabs/TreeRecoveryGate.test.tsx src/components/tabs/FileFreshnessGate.test.tsx src/components/panels/info/InfoPanel.test.tsx` followed by `node --check scripts/verify-app.mjs`, scoped oxfmt/oxlint, `pnpm checks:pre-review` and `pnpm gates:contract:check`. Root runs container projects database-files, files-preview, tree-recovery and the remaining original affected projects after source closure, then ordinary `pnpm build` and `pnpm verify:app`. Root completes all fourteen standalone failure stages, full affected push gates, push/required CI/install and HEAD equality.
+Exact phase proof: `pnpm test src/state/workspace.test.ts src/state/atoms.lifecycle.test.ts src/state/store/tabStorage.test.ts src/state/store/tree.test.ts src/state/store/tree.hydration.test.ts src/utils/tabs.test.ts src/components/tabs/BoardsPage.test.tsx src/components/tabs/TreeRecoveryGate.test.tsx src/components/tabs/FileFreshnessGate.test.tsx src/components/panels/info/InfoPanel.test.tsx src/components/boards/BoardAnalysis.test.tsx` followed by `node --check scripts/verify-app.mjs`, scoped oxfmt/oxlint, `pnpm checks:pre-review` and `pnpm gates:contract:check`. Root runs container projects database-files, files-preview, tree-recovery and the remaining original affected projects after source closure, then ordinary `pnpm build` and `pnpm verify:app`. Root completes all fourteen standalone failure stages, full affected push gates, push/required CI/install and HEAD equality.
 
 ## Carried to diff review
````

### Completed local round 3 plan report, verbatim

````text
D9-P3 CLOSED against candidate r3 — `tasks/plans/.plan-durable-page-replacement-r3.body.md:41` requires preserving current committed metadata. Line 51 requires a pending-read discard test and a captured-origin fault that fails specifically on metadata loss. This addresses the count update at `src/components/panels/info/FileInfo.tsx:54` without weakening replacement ownership checks. (confidence: 98)

No new plan defects found. The shared predicates fit the existing guards in `BoardAnalysis.tsx:121`, `FileFreshnessGate.tsx:145` and `InfoPanel.tsx:225`. The amendment preserves caller-specific safeguards and includes BoardAnalysis’s paired tests in the proof command.

Limitation — G-BUNDLE remains an execution gate failure. The extraction is source-grounded, but neither the supplied probe nor this read-only review establishes that it saves the required 353 gzip bytes. Approval does not establish repaired implementation or green gates. (confidence: 100)

No files changed or tests, builds or gates run. Detection used the code author’s model family. Plan authorship and arbitration shared one context.

VERDICT: APPROVED
````

### Completed local round 3 correctness report, verbatim

````text
D9-P3 CLOSED at plan level — candidate r3:41 requires preserving current committed metadata. Line 51 requires an actual pending-read discard test and a captured-origin fault that fails specifically on metadata loss. Existing ownership and snapshot guards remain binding. (confidence: 99)

No new correctness defects found in the revised obligations or dependency edges. The shared predicates can preserve file/page matching while leaving InfoPanel’s file-only count updates and physical-generation checks explicit.

G-BUNDLE remains an execution gate failure. The extraction’s gzip saving is unmeasured, and the existing limit remains binding.

Limitation: implementation repair, runtime proof and bundle closure are not verified by this plan review. (confidence: 100)

Detection used the code author’s model family. Plan authorship and arbitration shared one context.

VERDICT: APPROVED
````

### Completed local round 3 tests report, verbatim

````text
D9-P3 CLOSED at plan level — O2 preserves current committed metadata. O3 requires an actual pending-read discard test and a captured-origin fault that fails specifically on lost metadata. This addresses the synchronous lifecycle test’s missing integration proof.

No new verification findings in the scoped amendment. BoardAnalysis’s paired test is included in the exact proof command and normal Vitest selection.

G-BUNDLE remains an execution gate. The plan retains the fixed limit and requires fresh build proof. No saving or implementation repair is established by this review.

Detection used the code author’s model family. Plan authorship and arbitration shared one context.

VERDICT: APPROVED
````

### Completed local round 3 minimalism report, verbatim

````text
D9-P3 CLOSED at plan level — O2 preserves current committed metadata. O3 requires the actual pending-read discard test and a captured-origin fault that fails specifically on metadata loss (confidence: 98).

G-BUNDLE remains an execution gate failure. The amendment authorizes a bounded consolidation of existing repeated predicates and preserves the fixed limit. No gzip saving has been measured.

No new bloat or duplication findings. InfoPanel and FileFreshnessGate duplicate file-backed narrowing, while BoardAnalysis repeats membership and file/page matching five times. The proposed helper has concrete callers and retains caller-specific safeguards.

Minimum sufficient amendment: preserve the current origin in the commit updater, consolidate predicates in existing `tabs.ts`, route the three consumers through them, and extend existing tests. No new source file, configuration or recovery mechanism is needed.

Detection ran on the code’s model family. Plan authorship and arbitration shared one context. This approves the plan amendment, not implementation repair or gate success.

VERDICT: APPROVED
````

### Completed proof-fix round 1 report, verbatim

````text
The resumed source candidate is verified by the required tests and contract checks, but the phase is blocked by an explicit canonical launcher refusal. Both `pnpm gate:run frontend-build` and `pnpm checks:pre-review` exited 125 before starting because `agents.slice MemoryHigh` is unavailable. No launcher bypass was attempted. A fresh bundle measurement and final mutation evidence remain pending for root's valid interactive scope. No current-candidate bundle pass is claimed.

This round extracts `FileBackedTab`, `isFileBackedTab` and `matchesFileGameTab` in `src/utils/tabs.ts`. FileFreshnessGate, InfoPanel and the five BoardAnalysis ownership predicates use them. The strict kind contract in `saveToFile.sameOrigin` and InfoPanel's file-only count matcher remain intact. Current committed file metadata is preserved by the replacement overlay `{ ...tab.gameOrigin, gameNumber: page }`. A real persisted-owner test now holds the page read pending after actual GameSelector activation and ConfirmChangesModal discard, commits a newer count and unrelated metadata, then proves successful replacement preserves them in both live and persisted workspace state. Six BoardAnalysis cases verify owner removal, non-file origin and page changes before native append and during its pending response.

All 23 modified phase paths remain unstaged:

- `scripts/verify-app.mjs`
- `src/components/boards/BoardAnalysis.tsx`
- `src/components/boards/BoardAnalysis.test.tsx`
- `src/components/common/TreeStateContext.tsx`
- `src/components/panels/info/InfoPanel.tsx`
- `src/components/panels/info/InfoPanel.test.tsx`
- `src/components/tabs/BoardsPage.tsx`
- `src/components/tabs/BoardsPage.test.tsx`
- `src/components/tabs/FileFreshnessGate.tsx`
- `src/components/tabs/FileFreshnessGate.test.tsx`
- `src/components/tabs/TreeRecoveryGate.tsx`
- `src/components/tabs/TreeRecoveryGate.test.tsx`
- `src/state/atoms.ts`
- `src/state/atoms.lifecycle.test.ts`
- `src/state/store/tabStorage.ts`
- `src/state/store/tabStorage.test.ts`
- `src/state/store/tree.ts`
- `src/state/store/tree.hydration.test.ts`
- `src/state/workspace.ts`
- `src/state/workspace.test.ts`
- `src/state/workspaceTypes.ts`
- `src/utils/tabs.ts`
- `src/utils/tabs.test.ts`

Final commands and exits on the unchanged candidate:

```text
pnpm test src/state/workspace.test.ts src/state/atoms.lifecycle.test.ts src/state/store/tabStorage.test.ts src/state/store/tree.test.ts src/state/store/tree.hydration.test.ts src/utils/tabs.test.ts src/components/tabs/BoardsPage.test.tsx src/components/tabs/TreeRecoveryGate.test.tsx src/components/tabs/FileFreshnessGate.test.tsx src/components/panels/info/InfoPanel.test.tsx src/components/boards/BoardAnalysis.test.tsx
exit 0, 11 suites, 494 tests. round1-eleven-final.log
Same command in the Git-sourced scratch checkout: exit 0, 494 tests. round1-scratch-eleven-final.log

pnpm test src/state/workspace.test.ts src/state/atoms.lifecycle.test.ts src/state/store/tabStorage.test.ts src/state/store/tree.test.ts src/state/store/tree.hydration.test.ts src/utils/tabs.test.ts src/components/tabs/BoardsPage.test.tsx src/components/tabs/TreeRecoveryGate.test.tsx src/components/tabs/FileFreshnessGate.test.tsx src/components/panels/info/InfoPanel.test.tsx
exit 0, 10 suites, 478 tests. round1-ten-final.log

node --check scripts/verify-app.mjs
exit 0. round1-syntax-final.log
pnpm exec oxfmt --check <all 23 paths above>
exit 0. round1-format-final.log
pnpm exec oxlint --deny-warnings <all 23 paths above>
exit 0. round1-lint-final.log
pnpm exec tsgo --noEmit
exit 0. round1-types-final.log
git diff --check -- <all 23 paths above>
exit 0. round1-diff-final.log
pnpm gates:contract:check
exit 0. round1-contract-repaired.log
pnpm gate:run frontend-build
exit 125. round1-build-final.log
pnpm checks:pre-review
exit 125. round1-pre-review-final.log
```

The last measured bundle belongs to the earlier candidate, before this consolidation. Its exact gzip metrics were entry 540,069 bytes, largestLazy 515,348 bytes (`src/routes/index.lazy.tsx`) and total 1,620,353 bytes. The total limit remains 1,620,000 bytes. That measurement exceeded it by 353 bytes. The current candidate has no fresh measurement because the canonical build did not start. The probe and reviews measured no saving. Final mutation floors are also unverified for the current candidate because pre-review did not start. Earlier mutation evidence is preserved and is not represented as final evidence.

Four separate retained-test faults were injected into the Git-sourced launch-HEAD checkout with the repaired API intact. Each red run imported successfully and failed its own semantic assertion with exit 1. Each exact restoration passed with exit 0, using byte-identical tests:

- `round1-ordering-fault.patch` removes only the replacement candidate seed. The lifecycle assertion fails on missing immediate durable candidate content. Restored run passes both matching lifecycle cases.
- `round1-missing-reference-fault.patch` removes only required-existing-reference hydration by selecting `storageFor(false)`. The missing-reference assertion fails on `absent` instead of `unavailable`. Restored run passes.
- `round1-cleanup-fault.patch` deletes the candidate on an application exception before rethrowing. The post-write assertion fails because the committed candidate is missing. Restored run passes.
- `round1-metadata-fault.patch` restores only `{ ...owner.gameOrigin, gameNumber: page }`. The actual selector/modal assertion loses count 8 to 5, lastModified 2 to 1, the refreshed name and tag. Restored run passes.

Every case has separate `round1-<case>-red.log`, `-red.exit`, `-red.sha256`, `-restored.log`, `-restored.exit`, `-restored.sha256`, `-restore.log` and `-fault.patch` artifacts. No red evidence was overwritten with a green run. Earlier attempts, prior fault patches, provenance and logs remain intact.

`round1-provenance.json` records all launch Git blobs, launch source SHA-256 hashes and the final 23 source/test SHA-256 hashes. `round1-integrity.json` verifies main, repaired snapshots and restored scratch are byte-identical, verifies HEAD/index/cached diff and foreign records, and records all four fault/restoration hashes. The verifier's whole-file comparison against launch HEAD proves that only GO14's effective physical-key reader changed. All original assertion bodies and subsequent verifier assertions remain byte-identical.

Integrity values:

```text
HEAD 3e8f8ba0b35def69417fbc7dcc0262e5d38911bd
index SHA256 9596d4f4011f7d38f4619d9379c07f67c99fb01bc52ef0841c477dc2e9609af5
cached diff SHA256 e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
Git archive SHA256 6c72969b2990cc070f489960e9c01b87b75eaa051eb362926b76fac1562cb5bc
implementation patch SHA256 3c1fac7299c63c80a85f3e7e1ddfab10d975ac060c92ab0a40b0ee33429ca5bf
round1-provenance.json SHA256 bec53615f95ce823c3b1040f651cb07290a25de17447dec3b2c88130df30227f
round1-integrity.json SHA256 28ddd9402dd990faf178ddda28ec6d06a9f8be33d8243af6c8d199ab830bc7d3
```

No source scope deviation or new out-of-scope consumer was found in this resumed round. Root's two handoff files, metadata findings-inbox entry and amended plan retain their resumed-launch hashes. No project record, decision, budget, baseline or verifier assertion was edited. No native/browser driver or agent was launched. Initial new-test type errors and an empty-workspace test-fixture failure were repaired before final proof, with their separate first-attempt logs preserved. The prior phase's bundle failures and attached-gate exit 143 remain in the earlier evidence and foreign execution handoff.

Root owns final runtime proof, review, records, commits and push. Plan authorship and arbitration shared one context. Detection ran on the same model family as the code.
````

### Completed proof-fix round 2 report, verbatim

````text
The measured candidate is within the unchanged bundle limit. Root's canonical checkpoint 01 build exited 0 and measured gzip entry 540,109 bytes, largestLazy 514,864 bytes (`src/routes/index.lazy.tsx`) and total 1,619,922 bytes. The total limit remains 1,620,000 bytes, leaving 78 bytes. This consolidation saves 364 bytes from root's round 1 measurement of 1,620,286. `pnpm bundle:check` also exited 0 against that fresh root build. Main source and tests still match the accepted checkpoint exactly.

This round changes only `src/components/tabs/FileFreshnessGate.tsx`. Conflict and unavailable recovery already share one rendering branch. The former `FileResolutionPanel` had become a single-consumer component that duplicated the owning gate's state, action and translated-label projection through props. Its rendering is now part of that same shared branch in the owning gate. Every message, CSS class, reload/append/close visibility condition, disabled condition and action callback is preserved. Admission, physical-key marker refusal, current metadata, store/native ownership, cancellation, request generation, snapshots, pending cleanup and post-write exception semantics are untouched. No new abstraction or persistence mechanism was introduced. Tests remain byte-identical to the accepted round 1 tests.

The accepted root artifacts are `round2-checkpoint-01.json` and `round2-measurement-01.json` in this proof directory. Root's response confirms build exit 0, the exact metrics, the production patch hash and unchanged source/test hashes before and after building. Root's actual gate log is `/home/felixb/.claude/drain-state/chessfable-0a459a4f.d/gates-e838b3a7-7402-4e53-a614-eb2da79f3765/gate-root-durable-measure-01.AxwmZX/log`. Its completion record is the sibling `completion.record`, containing `0 root-durable-measure-01 3e8f8ba0b35def69417fbc7dcc0262e5d38911bd`. The build transcript is `/home/felixb/Projekte/chessfable/artifacts/gates/20261010T033902928Z-3203408/receipt-frontend-build.log`. The response still marks the full root proof pending.

All 23 modified phase paths remain unstaged:

- `scripts/verify-app.mjs`
- `src/components/boards/BoardAnalysis.tsx`
- `src/components/boards/BoardAnalysis.test.tsx`
- `src/components/common/TreeStateContext.tsx`
- `src/components/panels/info/InfoPanel.tsx`
- `src/components/panels/info/InfoPanel.test.tsx`
- `src/components/tabs/BoardsPage.tsx`
- `src/components/tabs/BoardsPage.test.tsx`
- `src/components/tabs/FileFreshnessGate.tsx`
- `src/components/tabs/FileFreshnessGate.test.tsx`
- `src/components/tabs/TreeRecoveryGate.tsx`
- `src/components/tabs/TreeRecoveryGate.test.tsx`
- `src/state/atoms.ts`
- `src/state/atoms.lifecycle.test.ts`
- `src/state/store/tabStorage.ts`
- `src/state/store/tabStorage.test.ts`
- `src/state/store/tree.ts`
- `src/state/store/tree.hydration.test.ts`
- `src/state/workspace.ts`
- `src/state/workspace.test.ts`
- `src/state/workspaceTypes.ts`
- `src/utils/tabs.ts`
- `src/utils/tabs.test.ts`

Final proof on the unchanged accepted candidate:

```text
pnpm test src/state/workspace.test.ts src/state/atoms.lifecycle.test.ts src/state/store/tabStorage.test.ts src/state/store/tree.test.ts src/state/store/tree.hydration.test.ts src/utils/tabs.test.ts src/components/tabs/BoardsPage.test.tsx src/components/tabs/TreeRecoveryGate.test.tsx src/components/tabs/FileFreshnessGate.test.tsx src/components/panels/info/InfoPanel.test.tsx src/components/boards/BoardAnalysis.test.tsx
exit 0, 11 suites, 494 tests. round2-eleven-final.log
Same exact command in the restored Git-sourced checkout: exit 0, 494 tests. round2-scratch-eleven-final.log

node --check scripts/verify-app.mjs
exit 0. round2-syntax-final.log
pnpm exec oxfmt --check <all 23 paths above>
exit 0. round2-format-final.log
pnpm exec oxlint --deny-warnings <all 23 paths above>
exit 0. round2-lint-final.log
pnpm exec tsgo --noEmit
exit 0. round2-types-final.log
git diff --check -- <all 23 paths above>
exit 0. round2-diff-final.log
pnpm gates:contract:check
exit 0. round2-contract-final.log
pnpm bundle:check
exit 0. round2-bundle-final.log
pnpm checks:pre-review
exit 125 before startup. round2-pre-review-final.log
```

Pre-review's explicit launcher refusal states that `agents.slice MemoryHigh` is unavailable, so the gate cap cannot be derived and the gate did not start. It was not bypassed. Root owns the exact full pre-review from its working interactive scope before source commit. Current-candidate mutation, independent final source review and runtime proof are not claimed. No additional leaf build was launched. The existing root build wrapper supplied the measurement while all source/test files were frozen.

All four accepted semantic failures/restorations were rerun against the rebuilt Git-sourced final candidate with unchanged tests and the repaired API intact. Each red run imported successfully and failed its specific semantic assertion with exit 1. Each exact restoration passed with exit 0:

- `round2-ordering-fault.patch` removes only the replacement candidate seed. The lifecycle assertion fails on missing immediately durable replacement content. Restoring the seed passes both matching lifecycle cases.
- `round2-missing-reference-fault.patch` removes only required-existing-reference hydration through `storageFor(false)`. The assertion fails on `absent` instead of `unavailable`. Restoration passes.
- `round2-cleanup-fault.patch` deletes the staged candidate on a post-write application exception before rethrowing. The assertion fails because the committed candidate is gone. Restoration passes.
- `round2-metadata-fault.patch` restores only the captured-origin overlay. The actual selector/modal assertion loses count 8 to 5, timestamp 2 to 1, the refreshed filename and tag. Restoring the current-origin overlay passes.

Each case has distinct `round2-<case>-red.log`, `-red.exit`, `-red.sha256`, `-restored.log`, `-restored.exit`, `-restored.sha256`, `-restore.log` and `-fault.patch` files. The source/test hash records prove identical tests across each red/restored pair and exact restored source bytes. Git reverse-application logs confirm clean restoration. All prior attempt logs, failures, snapshots, patches and provenance remain preserved.

`round2-provenance.json` records all 23 final per-file source/test SHA-256 hashes, launch Git blobs and source hashes, the accepted checkpoint/measurement hashes and root metrics. `round2-integrity.json` verifies main, scratch and repaired snapshots are byte-identical, verifies the exact production patch still matches root's measured checkpoint, and records all four fault/restoration hashes. It also verifies that HEAD/index/cached diff and the foreign records are unchanged. Its whole-file comparison against launch HEAD proves that the verifier differs only in GO14's effective physical-key reader. All thirteen original assertion bodies and subsequent verifier assertions remain byte-identical.

Final integrity values:

```text
HEAD 3e8f8ba0b35def69417fbc7dcc0262e5d38911bd
index SHA256 9596d4f4011f7d38f4619d9379c07f67c99fb01bc52ef0841c477dc2e9609af5
cached diff SHA256 e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
Git archive SHA256 6c72969b2990cc070f489960e9c01b87b75eaa051eb362926b76fac1562cb5bc
production patch SHA256 f358e5d1fcd8b1db5fa19f3b38266e02dcd605c13a8a55e69fefe1b5033724d9
candidate patch SHA256 76fc47dc801cb8ff2bf0983d410b92f893cfd8bf95c7afdb2f327a48b60f17e2
checkpoint SHA256 dd8f0c703bd446259976851e2dcd07a8ab51a9f3df31fcfbeb7f05cda7cc68ec
measurement SHA256 3590d66400365937c952aeeecaed87b7882ff1f7d5f2813d74974bc45ef3ae5e
round2-provenance.json SHA256 9aed240d76440148171630573e6a27f473cda137adc40e3dbd72c2910787906d
round2-integrity.json SHA256 067d57f9e9f4796ec4d13617ddadea6ee44a92ec345aa848bed89297115d47be
```

No scope or design extension, numeric ratchet change, diagnostic shortening, minifier trick, asset relocation, feature removal or unrelated move refactor was used. No new out-of-scope consumer was found. Root's two handoffs, amended plan and metadata findings-inbox entry retain their round 2 launch hashes. No project records were written. There were no local proof failures requiring a source/test repair after the accepted measurement. There is no unrestored fault in scratch. Native/browser verification, final independent source review, full root pre-review, mutation gates, commits and push remain root-owned and unclaimed.

Plan authorship and arbitration shared one context. Detection runs on the same model family as the code.
````

## Root independent final phase proof

Root read the entire final 23-path source and test diff, then independently ran the exact eleven suites, verifier syntax, scoped formatting and lint, complete pre-review and contract checks. The final root proof log and completion receipt are identified below. The initial round 1 root measurement was 1,620,286 total gzip bytes and failed the unchanged limit. The round 2 frozen source measured 1,619,922 bytes, with entry 540,109 and largest lazy 514,864. Its checkpoint hashes, HEAD and index stayed unchanged across the canonical build. No numeric baseline was lowered. The final pre-review remains the authoritative final affected mutation and budget evidence. Source proof does not establish pixels or native runtime behavior.

Root completion record: `/home/felixb/.claude/drain-state/chessfable-0a459a4f.d/gates-e838b3a7-7402-4e53-a614-eb2da79f3765/gate-root-durable-proof.yFBcz8/completion.record`.

```text
0 root-durable-proof 3e8f8ba0b35def69417fbc7dcc0262e5d38911bd
```

Root log: `/tmp/build-game-opening-3b67c3b9/root-durable-proof.log`. The exact eleven suites passed 494 tests. Syntax, scoped oxfmt and oxlint, complete pre-review and contract checks exited 0. Pre-review selected 66 changed paths, with format/lint, frontend coverage mapping, bundle and all affected mutation packages green. Workspace-storage and tree/path both reported 100.00 against unchanged threshold 100. Source/test hashes, index and HEAD stayed fixed through completion. This is an independent phase proof on the owned dirty candidate, not the later clean-HEAD push gate.

Source commit: `cb09c965`, 23 owned source/test paths only. The current source is committed. This supersedes the historical unstaged and unaccepted states in the prior attempt sections. Source closure, pinned pixels, real-app healthy verification and all fourteen native assertion failure/restoration pairs still remain pending. No browser/native proof is claimed here.

Plan authorship and arbitration shared one context. Detection ran on the same model family as the code.
