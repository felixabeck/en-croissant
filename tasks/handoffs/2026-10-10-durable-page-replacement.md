# D9 companion plan and design evidence

This tracked handoff preserves the supplemental f-20261010-07 plan, its complete raw review history and design probe. The original affordance plan remains independent. Plan authorship and arbitration shared one context. Detection ran on the same model family as the code. Implementation and runtime proof are pending at this checkpoint.

Plan round 1 elapsed 271 seconds, epochs 1791597253 to 1791597524. Round 2 elapsed 152 seconds, epochs 1791597609 to 1791597761. Known non-overlapping external waits: none. Active review wall time: unknown. Two unique issues were adopted and closed, no withdrawal, Defer or Skip. Seven lenses ran in round 1 and four in round 2. The role-routing correction is recorded in the plan and does not claim model or family separation.

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

On acknowledged commitment, synchronously retarget the existing persisted store to the candidate key and install the candidate tree, publishing consistent workspace ownership without an asynchronous gap. Use the existing Zustand persistence-name mechanism. Record removal intent for the old physical key in the same workspace commit. Reclaim the old generation only after commitment. Cleanup refusal is an applied success with retained removal intent, never an admission refusal. Pending old edits cannot shadow or later overwrite the candidate. Future edits use the candidate key.

### O3: Real durability proof and verifier compatibility

The mandate's "never exercises tree persistence" requires real-ID persisted-store tests. Cover independent tree and workspace refusal with retry, successful discard and cold reload, queued old edits, subsequent edits, owner/configuration/store identity, candidate-only rollback and cleanup refusal/replay. Cover duplication, close, unavailable/corrupt referenced tree recovery, legacy fallback, ownership collision and ID repair. Preserve D7 races and D8 ordinary stale rejection coverage. Add distinct logical/physical-key append refusal proof that the native append is never invoked when its marker flush refuses the physical key. Add an application commit that throws after the workspace write, proving both tree generations remain and cold reload follows the durable candidate. Deleting the candidate on that exception must fail the retained test.

Use disposable Git-sourced reversal tests with identical new tests to expose the original index/tree ordering, missing physical-key hydration and premature cleanup. Record specific failure assertions and restored green, with main source/index/HEAD integrity evidence. Browser and native verification remain root-owned after cumulative source closure.

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

Source files: `src/state/workspaceTypes.ts`, `src/state/workspace.ts`, `src/state/atoms.ts`, `src/state/store/tabStorage.ts`, `src/state/store/tree.ts`, `src/utils/tabs.ts`, `src/components/common/TreeStateContext.tsx`, `src/components/tabs/BoardsPage.tsx`, `src/components/tabs/TreeRecoveryGate.tsx`, `src/components/tabs/FileFreshnessGate.tsx`, `src/components/panels/info/InfoPanel.tsx`, `scripts/verify-app.mjs`. Existing paired tests and lifecycle fixtures for these modules belong to the same phase. Coverage mapping may register new source only, preserving all numeric ratchets. No other source ownership is granted.

Exact phase proof: `pnpm test src/state/workspace.test.ts src/state/atoms.lifecycle.test.ts src/state/store/tabStorage.test.ts src/state/store/tree.test.ts src/state/store/tree.hydration.test.ts src/utils/tabs.test.ts src/components/tabs/BoardsPage.test.tsx src/components/tabs/TreeRecoveryGate.test.tsx src/components/tabs/FileFreshnessGate.test.tsx src/components/panels/info/InfoPanel.test.tsx` followed by `node --check scripts/verify-app.mjs`, scoped oxfmt/oxlint, `pnpm checks:pre-review` and `pnpm gates:contract:check`. Root runs container projects database-files, files-preview, tree-recovery and the remaining original affected projects after source closure, then ordinary `pnpm build` and `pnpm verify:app`. Root completes all fourteen standalone failure stages, full affected push gates, push/required CI/install and HEAD equality.

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

## Raw design probe

```text
Recommend **a stable logical tab ID with an optional durable tree-key reference in the workspace entry**. Reuse fresh-key staging and the existing pending-removal contract. Keep `replaceNewTab`’s current New Tab contract.

This preserves GO14, configuration and resource identity without an exhaustive settings-copy operation. No journal or general transaction framework is needed.

| Design | Source-grounded consequences |
|---|---|
| Fresh tab ID plus handoff | The staging protocol is proven, but analysis options, engine settings and panel selections belong to tab-keyed atom families. `reclaimTabLocalState` removes them. React panels also use `tab.value` as their key. Preserving configuration requires copying an explicit, maintained list before publication. Native engine ownership needs a separate handoff because replacement cleanup does not perform the engine shutdown used by actual tab close. |
| Stable tab ID plus tree reference | Separates the durable game generation from configuration and native resource identity. Requires updating every tree-storage ownership consumer, but leaves tab atoms, panel mounts and engine identity intact. |
| Existing in-place mechanisms | Neither `seed`, `cloneDurable` nor `flush` coordinates metadata ownership with tree replacement. `readTree` prioritizes pending edits, so seeding the existing key can also be shadowed and later overwritten. No simpler safe mechanism was found. |

Grounding: [tab atoms and disposal](/home/felixb/Projekte/chessfable/src/state/atoms.ts:668), [fresh-ID replacement](/home/felixb/Projekte/chessfable/src/utils/tabs.ts:157), [actual close lifecycle](/home/felixb/Projekte/chessfable/src/components/tabs/BoardsPage.tsx:99), [panel identity](/home/felixb/Projekte/chessfable/src/components/tabs/BoardsPage.tsx:398), [pending-first reads](/home/felixb/Projekte/chessfable/src/state/store/tabStorage.ts:394).

**Public contract**

Add `treeKey?: UUID` to `Tab`, with one shared `getTabTreeKey(tab)` returning `treeKey ?? value`. Legacy entries therefore retain their current storage ownership without copying trees on upgrade.

Expose one owner-bound file-game replacement operation, returning:

- `committed`, with the effective candidate tree key
- `superseded`, with no owner mutation
- `refused`, identifying tree or workspace persistence
- `indeterminate`, retaining both generations and requiring reconciliation before further owner mutations

Its preconditions include workspace membership, non-closing owner, expected logical ID, file origin and page, effective old tree key, cached store identity, and D7’s immutable root/header snapshot. Preserve the existing page-generation and cancellation checks.

Do not make the repository silently interpret every UUID as either a tab ID or a tree key. Keep physical storage APIs explicit. Resolve references at their callers, including duplication, close, recovery and startup ownership.

**Failure order**

1. Validate the requesting owner and authorized snapshot.
2. Allocate an unused candidate UUID. Seed only that key through the existing bounded serializer. Verify the durable candidate without using a pending-first read as evidence.
3. Revalidate the owner immediately before committing.
4. Commit one workspace envelope containing the new `gameNumber`, candidate `treeKey`, unchanged logical ID, unchanged active tab, and removal intent for the previous effective tree key.
5. After durable commitment is established, switch the **existing cached store** to the candidate persistence name and install the candidate tree. Publish the acknowledged workspace and complete runtime reconciliation synchronously, without yielding.
6. Reclaim only the previous tree generation. Preserve logical-tab atoms, cached-store identity, report-owner identity and native engine ownership.

Zustand already supports changing the persistence name through `persist.setOptions`. Its installed middleware reads `options.name` for subsequent writes. That is the existing mechanism that makes the stable-ID design relatively small. The store currently persists under the logical ID at [tree-store creation](/home/felixb/Projekte/chessfable/src/state/store/tree.ts:670).

Before step 4, replacement must not flush, remove, overwrite or retarget the old durable tree, pending entry or live store. A definite workspace refusal may clean up only the candidate. Candidate cleanup failure uses the existing failed-admission mechanism.

After step 4, cleanup failure cannot turn replacement into refusal. The committed envelope owns the candidate and records old-key removal intent. Reload and subsequent reconciliation retry cleanup under the existing bound. Extend ownership calculations from logical tab IDs to **effective tree keys**, otherwise startup sweeping would delete the new candidate. Current ownership calculations use `tab.value` in [workspace sweeping](/home/felixb/Projekte/chessfable/src/state/workspace.ts:145) and [workspace commits](/home/felixb/Projekte/chessfable/src/state/atoms.ts:81).

**Thrown and post-write outcomes**

This needs an explicit repair, not just reuse of today’s boolean setter.

`saveWorkspace` catches any `setItem` exception and returns `null`. A write-then-throw storage implementation would therefore look like definite refusal, allowing candidate deletion despite durable ownership. The admission helper conservatively preserves candidates when its commit callback throws, but that does not cover an exception swallowed inside `saveWorkspace`. See [saveWorkspace](/home/felixb/Projekte/chessfable/src/state/workspace.ts:221) and [admission exception handling](/home/felixb/Projekte/chessfable/src/utils/tabs.ts:94).

Retain the exact previous and candidate serialized envelopes. On a thrown workspace write:

- Candidate readback establishes commitment. Complete runtime reconciliation and report any subsequent error as an applied outcome.
- Previous-envelope readback establishes refusal. Preserve the owner and clean up only the candidate.
- Refused or unexpected readback establishes uncertainty. Preserve both generations, perform no ownership cleanup, and block further owner edits or replacement until reconciliation succeeds.

A throw during runtime publication must likewise preserve the candidate and old state. Retry must first reconcile durable ownership, rather than starting another replacement from stale live metadata. A cold reload follows the durable workspace reference.

**Bounded implementation files**

The source change should stay within:

- `src/state/workspaceTypes.ts`: reference schema and shared effective-key helper
- `src/state/workspace.ts`: effective ownership, repair, sweeping, uniqueness validation and durability reconciliation
- `src/state/atoms.ts`: physical-key removal accounting and coordinated replacement publication
- `src/state/store/tabStorage.ts`: verified candidate staging and candidate-only cleanup
- `src/state/store/tree.ts`: initial physical key, preserved-store retargeting, recovery and runtime completion
- `src/utils/tabs.ts`: shared staging and public replacement facade
- `src/components/common/TreeStateContext.tsx`: initial physical-key plumbing
- `src/components/tabs/BoardsPage.tsx`: close, duplication, recovery and provider plumbing
- `src/components/tabs/TreeRecoveryGate.tsx`: effective-key status, raw recovery and uncertainty gating
- `src/components/panels/info/InfoPanel.tsx`: route `loadPage` through the facade

Duplication must clear the inherited `treeKey` after cloning into its new key. Its current `{ ...tab }` copy would otherwise create shared durable ownership. Workspace ID repair must also clone from the effective source key and avoid retaining a reference to a different repaired owner’s tree.

**Necessary source-reversal tests**

Use real persisted stores, extending the existing lifecycle fixtures and InfoPanel’s actual discard journey.

1. Independent candidate-tree and workspace refusal. Assert old live state, pending entry, durable bytes, origin, focus and configuration remain intact. Retry succeeds.
2. Successful discard and reload. Assert identical logical IDs, count, slot, focus, atom identities, configured settings and cached-store identity. Reload restores the candidate under its matching origin.
3. Pending old edits cannot shadow or later overwrite the candidate. Subsequent edits persist exclusively to the new key.
4. Write-then-throw for both seed and workspace, commit throws before and after landing, and failed readback. Assert definitive or indeterminate outcomes and safe reconciliation.
5. Old-key cleanup refusal, later commits and reload. Assert removal intent survives and eventually removes the old key without touching the candidate.
6. Duplicate, close, corrupt/unavailable referenced-tree recovery, legacy fallback and ID repair. Assert no shared ownership or candidate sweeping.
7. Existing D7 races remain protected. New edits, tab/store switches and closing owners cannot authorize replacement.
8. Late engine and report results cannot modify the replacement improperly. Preserve settings and exercise the existing generation and operation guards.

Each test must fail when its corresponding ordering, reference resolution, uncertainty retention or cleanup protection is reverted. The current InfoPanel refusal fixture uses `createTreeStore(undefined, ...)`, so it cannot prove D9’s durability boundary. See [fixture](/home/felixb/Projekte/chessfable/src/components/panels/info/InfoPanel.test.tsx:260). Existing lifecycle tests already supply useful before/after-commit exception cases at [replacement tests](/home/felixb/Projekte/chessfable/src/state/atoms.lifecycle.test.ts:312).

Resource grounding: [EvalListener](/home/felixb/Projekte/chessfable/src/components/boards/EvalListener.tsx:231) checks tab membership, request fingerprints and native generations. [ReportModal](/home/felixb/Projekte/chessfable/src/components/panels/analysis/ReportModal.tsx:178) checks owner epoch and operation/root identity. Keeping the logical ID avoids introducing a new resource handoff.

The tradeoff is extra temporary quota usage while both generations exist. Refusal preserves the dirty owner. The only potential visible addition is a temporary recovery block when commitment cannot be determined. Root should arbitrate that presentation.

This extends the durability principle of d-20260927-10 without changing its New Tab decision, and preserves d-20261010-05’s discard authorization. All three named rules and the relevant source, decisions and handled closure were inspected. No writes or proof commands were performed. This is design evidence, not implementation verification or an approval lens.
```
