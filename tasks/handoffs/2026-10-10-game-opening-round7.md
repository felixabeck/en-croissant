# Game-opening cumulative review R7

All nine lenses reached EOS on source range03a798891f0ec9d383bd55a79e0352b0714bfd4e..b3babee7a9c300fe2d89052bde0d25b5f4370842, enclosing published5a5dc7e6..b3babee7. Their raw reports follow unchanged. Root preserves contrary APPROVED reports without turning them into full exception closure. No native/pixel/push claim is made.

Plan authorship and arbitration shared one context. Detection ran on the same model family as code.

## Arbitration

- R7-POST, Fix, existing f-20261010-29. Correctness94 and error-handling95 witnessed two manifestations of the same post-admission ownership boundary. A subscriber error after live publication leaves the own successor appending. Retargeting that installs then throws leaves old live origin with the candidate persistence adapter, allowing later Gate reconciliation to overwrite the durably admitted blank pair. Origin a51b08a3. Root opened atoms publication order, retargetTreeStore and Gate reconciliation. Immediate cold/refusal and count-repair suppression proofs remain valid within their class, but complete C1/C3 and f26 terminality are NOT CLOSED. The first retarget exception tests held native reads and did not prove continued reconciliation. The fresh read-only probe assesses the minimal shared mechanism before the second bounded correction. No new finding or third compression phase is invented.
- R7-LEGAL, Fix, new f-20261010-31. Chess-semantics99 identifies syntactically valid illegal UCI admission in the loaded reducer and keyboard parser. Inherited origin93b366695. Root traced MoveInput, parseKeyboardMove, parseSanOrUci and makeMove. Existing f-20260922-13 concerns separate batch atomicity and puzzle terminality, read completely and retained as a pre-change limit. No puzzle redesign is absorbed.
- R7-CQ, Fix within f27. Code-quality88 asks that the refusal-without-error result explain the existing global persistence diagnostic. Adopt the smallest explanatory comment, not a new general result framework. Existing count behavior and source proofs remain closed.
- R7-REC, Fix within f27. Records100 finds its Current proof status still calls repaired count refusal unrepaired. Official superseding annotation now identifies a51b08a3, root667+46 proof and explicit R7 count closures, while retaining open final/runtime status.

Four distinct adopted issues, with the two post-admission manifestations unified under their existing finding. Three source Fix and one records Fix. No new Defer or Skip. The old separate database-view/deletion findings and ledger preamble f-20261009-01 remain their named pre-change limits. R6-COUNT, DIRTY, DEAD and PRECOUNT are source-closed. Original source classes remain closed within their scope. R6-DURABLE and f26 complete exception/terminality remain blocked by R7-POST.

The source has been committed. Root's actual gate-r6-source-pre-review.RrVKAV completed0 on the dirty source candidate subsequently committed.667 integrated and46 parser tests, static, actual build/bundle/mutation and contract were green. Current total1623167 is below1630000. These facts do not close the newly discovered continuations. The original exhausted two source compression rounds remain failed and unchanged.

## Raw R7 correctness report

[blocker] src/utils/tabs.ts:260 — A successful append followed by a `tabsAtom` subscriber throwing during Jotai’s callback flush leaves the accepted successor permanently `appending`. Workspace storage, live metadata and the retargeted tree already contain the new physical generation, but `completionOwner` is updated only after `replaceFileGame` returns. The catch therefore compares against the old generation, incorrectly treats its own successor as obsolete, and skips terminal freshness publication. Finally releases the lease, while polling continues to defer outcomes for `appending`. C3 requires surviving accepted owners to settle. Origin: `a51b08a3`. (confidence: 94)

- R6-COUNT CLOSED — both callers honor durable refusal, preserve typed failures and retain obsolete-owner silence. Composed notification tests cover both refusal outcomes.
- R6-DURABLE NOT CLOSED — immediate cold pairing and definite refusals are corrected, but the blocker leaves post-publication completion unresolved. Existing exception tests throw during retargeting, before live workspace publication.
- R6-DIRTY CLOSED — Result comparison marks terminal replay dirty. Six retained fault failures reach the dirty assertion, with restored exit 0 and unchanged/disabled controls.
- R6-DEAD CLOSED — the third argument and branch are removed. All five production callers match the new signature.
- R6-PRECOUNT CLOSED — the redundant initial guard is removed and post-await ownership remains.
- f-20261010-26 NOT CLOSED for complete terminal behavior — admission, inactive completion and foreign-owner suppression remain intact, but the accepted-successor exception above remains unresolved.

Retained Save, recovery, metadata-overlay and physical-key contracts show no other regression from this delta.

Limitations: read-only source review, no tests rerun. Inspected root evidence records 667 integrated tests plus 46 parser tests and completion exit 0. Pixels, native behavior and fourteen runtime fault stages remain pending. Detection used the code’s model family.

VERDICT: REVISE

## Source probe and proposed revision2 mechanism

The source probe reached EOS. Its findings are source traces, not executed runtime proof or plan approval. Root adopts a shared prepared admission-to-live finalization boundary in existing atoms/tree lifecycle and exact operation-local acknowledgement. This keeps the d06 staged generation and avoids duplicated Gate repairs. Revision2 retains the same mandate and cap policy. The independent legality phase must finish before formal revision2 judgments freeze actual source.

### Raw probe

The smallest proper correction is **one admission-to-live finalization boundary shared by `replaceFileGame` and `retargetTreeStore`**, plus an operation-local acknowledgement of the exact admitted successor. It should own `tree.ts`. Fixing only Add Game’s catch would leave the shared replacement mechanism capable of poisoning the durable tree/page pair.

Confidence: **95% on the traced failures, 90% on the recommended boundary**, pending implementation and behavioral proof.

Source evidence:

- `src/utils/tabs.ts:462–494` seeds a fresh physical tree, then commits its key, page and count through `tabsAtom`.
- `src/state/atoms.ts:104–108` saves the canonical workspace durably, invokes `onSaved`, then publishes live workspace state. A retarget exception skips live publication.
- `src/state/store/tree.ts:121–127` switches persistence options before calling the mutable public `setState` action. Thus a throw before installation can leave the old live tree targeting the candidate key. A throw after installation can leave the candidate tree paired with old live page metadata.
- `src/state/store/tree.ts:262–264` implements that action through Zustand’s persistence-wrapped setter.
- Installed **Zustand 5.0.11**, `node_modules/zustand/esm/vanilla.mjs:4–9`, assigns state before notifying listeners. A throwing listener interrupts the remaining notifications. `esm/middleware.mjs:363–371` persists only after that setter returns, so a listener throw skips the middleware write. `:439–446` confirms `setOptions` changes options and storage without installing or hydrating state.
- Installed **Jotai 2.18.1**, `node_modules/jotai/esm/vanilla/internals.mjs:593–605`, flushes callbacks in `store.set`’s `finally`. `:111–148` catches callback errors, continues draining callbacks, then throws `AggregateError`. Publication has already happened. The exception does not mean refusal.
- `src/utils/tabs.ts:250–260` acknowledges the successor only after `replaceFileGame` returns. A Jotai subscriber exception prevents that assignment. `owns()` then rejects the operation’s own published successor, suppressing error handling and terminal freshness.
- `src/state/fileFreshness.ts:405–409` defers polling outcomes while freshness remains `appending`. Releasing the admission lease alone cannot repair that state.

The later corruption path is concrete. After an installed-tree retarget exception, live metadata still selects the old page. Add Game publishes `unverified` and releases its lease. `FileFreshnessGate.tsx:136–146` reconciles that old page. With a clean candidate tree and a differing stamp, `:171–183` parses and installs the old page into the retargeted store. `tabStorage.ts:488–492` queues that tree under the candidate physical key, and `:783–791` flushes it. Durable metadata still names the appended page.

The current witnesses do not close this continuation. `BoardAnalysis.test.tsx:1276–1306` verifies immediate cold preservation and explicitly expects old live origin metadata. Its default `readGame` remains pending at `:277–285`, so the destructive reconciliation never completes.

The recommended contract correction:

1. **Prepare installation before durable admission.** In `tree.ts`, capture the original nonpersisting Zustand setter when creating the store, before `persist` wraps it. Keep this capability with the existing cached store. Prepare the candidate patch and persistence options before committing workspace storage.
2. **Install admitted trees through that shared capability.** `retargetTreeStore` must use the captured raw setter, merging candidate state while retaining store actions and clearing `practicePath`. It must not depend on the mutable `store.getState().setState` action or rewrite the already-seeded candidate through persistence middleware. This removes the existing before-install action exception path. Raw-set subscriber exceptions occur after installation.
3. **Complete live ownership before observer errors escape.** Once storage acknowledges the canonical workspace, internally publish that workspace and acknowledge its exact successor before tree subscriber notification and Jotai’s eventual callback flush. Any remaining fallible pre-install hook must have mandatory finalization through the same prepared installer. Do not merely put metadata publication in `finally` while leaving installation optional.
4. **Give Add Game the exact admitted successor before `store.set` returns.** Use a narrow callback or local receipt from the shared boundary, carrying the canonical admitted tab. Its catch can then settle the surviving successor as `unverified`, report the application error and release the lease. Match that exact fresh key, logical tab, file/page and cached store. Never adopt whichever successor happens to be current.
5. **Preserve failure distinctions.** Returned tree/workspace refusal permits candidate rollback. An exception after acknowledgement preserves the admitted candidate and remains an error. Keep count repair suppressed once replacement begins (`tabs.ts:237–239,262–265`). Do not turn subscriber exceptions into ordinary successful completion.

Publish internal workspace state before raw tree notifications so those observers see the admitted ownership. Avoid an unconditional late `finally` publication that could overwrite a foreign successor created by a reentrant subscriber. The exact-successor check must suppress that operation’s subsequent freshness and notification changes.

This boundary preserves d06 staging and durable admission, d07’s independent lease and completion authority, and d08’s **550000/550000/1630000** caps. It needs no journal, schema change, registry or service.

Minimal owned production paths are:

- `src/state/store/tree.ts` — shared prepared, nonpersisting installation and retarget lifecycle.
- `src/state/atoms.ts` — acknowledged workspace publication and finalization ordering.
- `src/utils/tabs.ts` — canonical successor acknowledgement and Add Game terminal handling.

`FileFreshnessGate.tsx` should not acquire duplicate retarget repair logic. Its existing ownership checks become useful once live ownership is coherent. Add continuation coverage in `BoardAnalysis.test.tsx`, subscriber coverage in `tree.hydration.test.ts`, and shared replacement coverage for InfoPanel. InfoPanel’s production consumer is `InfoPanel.tsx:415–436`. Preserve its request cancellation and notification policy. Ordinary Save (`tabs.ts:657–675,725–754`) and recovery append (`FileFreshnessGate.tsx:283–345`) retain their separate policies.

The strongest discriminating tests are:

- **Completed reconciliation after retarget failure.** Begin with durable dirty old bytes and pending clean Save bytes. Complete append admission, inject the failure, then actually resolve reconciliation with distinct old-page and appended-page PGNs. Assert the requested page, live ownership, persistence target, flushed candidate bytes and a fresh cold read. Verify the old pending entry remains isolated until normal cleanup.
- **A real Jotai subscriber throw.** Register `workspace.sub(tabsAtom, listener)` and throw once when it observes the exact candidate. Confirm actual `AggregateError` propagation, coherent live/durable ownership, terminal freshness, released lease and completed reconciliation.
- **A real Zustand subscriber throw.** Throw from `treeStore.subscribe` upon candidate installation. Verify installation precedes the throw, the candidate seed survives, and subsequent edits persist only to its physical key.
- **Reentrant foreign successor.** Have a subscriber replace or close the owner before throwing. Verify finalization does not restore the previous candidate and Add Game does not publish freshness or notifications onto that foreign owner.
- Retain refusal, inactive completion, provider independence, remount single-flight, metadata-overlay, Save and recovery controls.

For the **production fault witness**, use the actual composed board/Gate with installed Jotai and Zustand. Throw once from the workspace subscriber on candidate publication, allow the native reconciliation read to finish, then flush and reload. Record terminal freshness, lease release, selected page and candidate contents. Removing successor acknowledgement should reproduce permanent `appending`. Removing shared installation/publication finalization should expose the wrong-page continuation. These are proposed witnesses, **not executed proof**.

I read all named rules, only d06–d09, and both complete R7 reports. No files or caches were written and no tests or runtime probes ran. HEAD moved from `b3babee7…` to `d798cfaf…` during inspection, but the intervening diff contains only `tasks/findings.md`. All inspected source paths are unchanged and the worktree remains clean.

Plan authorship and arbitration shared one context. Detection ran on the same model family as the code. Root retains final design arbitration.

### Complete proposed focused correction revision2

# R6 Add Game durability and count-publication correction, revision2

## Goal

Correct newly detected inherited R6 defects f-20261010-27 and f-20261010-29 in the existing Add Game operation. Preserve the original opening mandate, all prior closure obligations and d06/d07/d08 contracts. This is a cumulative-review repair package with concrete new source defects. It is not a third compression repair, a restarted primary finding or a new product decision.

## Required obligations

### C1 Durable blank-game admission

An accepted native append installs its blank tree through the existing fresh physical-generation replacement transaction. The blank tree must be durable before one durable workspace publication admits its effective physical reference, page, count and existing success origin kind. Keep current unrelated tab/file metadata. Live and immediate cold reads resolve the accepted blank tree and appended page without a preparatory flush. Retain logical tab identity, cached store identity, native-game/report/settings ownership and previous staged/refused/post-commit exception contracts. A tree or workspace refusal preserves the previous matched pair, readable content and pending bytes. Prepare every fallible tree-installation input before durable admission. Once admission is acknowledged, the shared workspace and cached-tree boundary must finalize matching live ownership before observer errors can escape. Installation must preserve the validated candidate without rewriting it through the ordinary persistence queue or depending on a fallible mutable public tree action. An exception after admission preserves the matching durable candidate and is never a definite refusal. Subsequent Gate reconciliation and edits must target that same admitted page and key, never the previous page through a new adapter. Count repair cannot overwrite acknowledged ownership. No second transaction framework, journal or schema is introduced.

### C2 Truthful count publication

The private count-refresh helper belongs only to Add Game. A successful native count plus refused durable tab update is a failure, never the refreshed-success branch. Retain the existing global persistence diagnostic and avoid telling the user that the count was refreshed or inventing an unknown-error notification. Ordinary count refresh, typed native count failure and obsolete-owner silence remain correct in both uncertain-fulfillment and rejected-write callers. Remove only the redundant synchronous pre-count ownership check identified by R6 minimalism. Keep post-count authority checks.

### C3 Completion authority and caller policies

Keep workspace-owned completion, gate-owned presentation and the independent cached-store/captured-generation lease. Use the actual provider-local workspace for the shared durable transaction. Surviving inactive completion remains allowed. The operation receives acknowledgement of the exact canonical admitted successor before any installed-tree or workspace subscriber error can escape. It can complete or settle that surviving successor without mistaking it for a foreign replacement. Observer failure remains an error with terminal freshness and lease release, not ordinary success. Live workspace ownership must be established before immediate installed-tree notifications. There is no late unconditional workspace publication that can overwrite a reentrant foreign successor. Normal completion retains correct source stamp/revision. Removed or foreign replacement owners receive no writes or notifications. An old operation cannot release a newer lease. Remount and competing Save admission, later Save diagnostics, physical replacement/removal, uncertainty and current-owner refusal remain terminal. Recovery append retains its distinct captured payload, cancellation, persistent unknown-write marker and error propagation. Ordinary Save, InfoPanel discard and physical replacement/reload callers retain their current stricter or distinct policies.

### C4 Discriminating evidence and release

Use actual composed BoardAnalysis/FileFreshnessGate, Jotai workspace, cached tree and storage. Immediate independent cold reads after success must resolve the new blank tree/page/count without flushing. Seed the original durable dirty content and a pending clean Save to expose the old publication split. Denying subsequent tree writes must not make an accepted pair refer to old content. Deny candidate tree persistence and workspace admission separately and retain the original pair, bytes, lease release and truthful terminal outcome. Observe stale-game count publication refusal and unknown-append count refusal through the actual notification boundary, with success and typed failure controls. Use actual installed Jotai and Zustand subscriber exceptions. Resolve the subsequent reconciliation reads with distinct old-page and admitted-page content, then flush and independently cold-read the admitted generation. Do not leave reads pending and infer later preservation from an immediate snapshot. Prove exact-successor terminality and silence after a reentrant foreign replacement/removal. Strengthen the earlier mutable-public-action exception fixtures only where the corrected prepared installation boundary makes that injection obsolete, retaining their outward guarantees and every other test body.

Every essential new guarantee needs a Git-derived production-only semantic fault, unchanged final tests, direct failing assertion and exit1, followed by exact source restoration and full selected exit0. Retain all old tests and all34 historical fault categories, adapting only where the changed production boundary requires it. Re-run the final relevant fault matrix against the final candidate and report unique final patches/categories honestly. Do not count redundant guard removals or array-identity failures as semantic proof. Root independently runs integrated tests, actual build/bundle, canonical pre-review and contract. Fresh cumulative R7 closes R6 issues and retained obligations. Pixels, real app, all14 standalone native fault/restoration stages and clean reviewed-HEAD final gates precede ordinary push. No acceptance is inferred from this plan review.

## FILES

One cohesive shared admission correction owns exactly src/utils/tabs.ts, src/state/atoms.ts, src/state/store/tree.ts, src/components/boards/BoardAnalysis.test.tsx, src/state/store/tree.hydration.test.ts, src/state/atoms.lifecycle.test.ts, src/utils/tabs.test.ts and src/components/panels/info/InfoPanel.test.tsx. Existing Gate, BoardAnalysis and InfoPanel production, BoardsPage, workspace codec, tabStorage, native/verifier/configuration remain read-only. The actual domain installation belongs in the existing tree lifecycle, avoiding duplicated retarget logic in Gate or utility. The independent new R7 legality package touches only move admission and the shared input parser, with lifecycle interfaces unchanged. It must reach EOS before this plan judgment freezes actual source.

## Decisions and trade-offs

d-20261010-06 already settles fresh physical-tree staging before workspace reference/page admission. Reuse that boundary for Add Game's native result instead of retaining its old queued tree install. d-20261010-07's workspace lease and presentation guarantees remain binding under d-20261010-08's partial budget correction. Extend the existing domain transaction only as needed to publish native page/count and preserve original kind/current metadata. The installed Jotai/Zustand trace requires one prepared admission-to-live finalization boundary, owned by existing atoms and tree lifecycle, plus exact operation-local successor acknowledgement. This strengthens the implementation of the original matched-pair contract. It does not reverse d06/d07/d08/d09 or introduce a storage design. Private setter capture and callback signatures belong to the phase brief. The precise helper signature and branch structure belong in the phase brief, not this contract. Avoid a new configurable operation factory or registry. Coverage and caps remain unchanged at550000/550000/1630000. This correction does not reverse the d08 cap decision or a Felix product decision.

## Source evidence and correction check

R6 reviewed cec23bdf..03a79889, enclosing5a5dc7e6..03a79889. All nine R6 lenses reached EOS. Error-handling reported updateTab refusal discarded at tabs.ts197. Persistence reported page admission before queued blank-tree persistence at234, masked by Board test's preparatory flush. Root traced both reports in actual source. Root corrected its initial f27 filing's mistaken recovery-append scope through official annotation. f29 is a newly found inherited consumer of the earlier D9 pairing contract, originating99ebb3759, not a newly introduced source regression or a reopened cap failure. R6 lifetime/admission witnesses remain source-closed within their class, while complete refusal/durability remains blocked by these new defects. Root adopts the minimalism redundant pre-count check as part of f27. No native/pixel proof has run.

## Reviews

Focused correction revision2, same existing mechanism and bound. Revision1 and three canonical plan judgments are preserved in the round6 handoff. All approved plan-level C1-C4 while explicitly naming unprobed post-admission exception behavior. First source correction a51b08a3 passed40 unique faults and root667+46/pre-review/contract, but R7 correctness and error-handling identified concrete continuations not covered by held-read fixtures. Complete source R6-DURABLE/f26 remains NOT CLOSED. Revision2 corrects C1/C3/C4 and expands the shared lifecycle boundary, leaving C2, cap policy, product mandate and all independent caller policies settled. No second full primary plan cohort or third compression repair occurs. This is the second bounded correction of this source package. Current open issue R7-POST, with both subscriber-terminality and later-reconciliation manifestations. R7-CQ is an explanatory-comment Fix in the phase brief. R7-REC's old count proof claim is officially superseded. New inherited R7-LEGAL is a disjoint exact legality correction.

CORRECTION CHECK: Last actually reviewed source b3babee7. Final revision2 candidate is frozen after the disjoint legality writer EOS, and the packet names its actual HEAD and source delta. Root opened actual atoms publication order, retargeting and Gate reconciliation. Complete R7 reports and dispositions are in tasks/handoffs/2026-10-10-game-opening-round7.md. Fresh source probe /tmp/build-game-opening-3b67c3b9/probe-post-admission-r1.txt traced installed Jotai2.18.1 callback-flush AggregateError after publication and Zustand5.0.11 state assignment before listeners/persistence after setter return. The current exception tests hold readGame, so later reconciliation was not covered. The complete raw probe is preserved in the round7 handoff. This source trace is evidence, not an executed runtime probe. The packet includes the generated round2 DELTA/REVISED/SETTLED block and prior revision1 snapshot. Fresh canonical judgments must close the revised shared mechanism against these actual source dependencies before implementation.

Plan authorship and arbitration shared one context. Detection runs on the same model family as the code.

## Raw R7 root-cause report

No root-cause blocker or prior-fix reintroduction found. Closures below are source-level only.

- **R6-COUNT / f-20261010-27 CLOSED** — `src/utils/tabs.ts:200–209` propagates durable count-publication refusal. Both callers distinguish refusal from native failure. Retained faults expose the false “count refreshed” notification and invented “Unexpected error”, with exit 1 and restored exit 0.
- **R6-DURABLE / f-20261010-29 CLOSED** — `src/utils/tabs.ts:240` routes accepted Add Game through durable candidate seeding before joint reference/page/count admission. Immediate cold-read tests require no flush. Separate tree/workspace refusals preserve old content and pending Save bytes. Post-admission exception tests preserve admitted ownership without destructive count repair. The reverted completion reproduces the old-tree/new-page mismatch.
- **R6-DIRTY / f-20261010-30 CLOSED** — `src/state/store/tree.ts:752–774` marks actual Result changes dirty before either child branch. Six unchanged-test fault cases reach the correct Result but fail on `dirty === false`. Exact restoration passes 155 tests. Unchanged Result, disabled adjudication and clock-100 checkmate priority remain protected.
- **R6-DEAD / f-20261010-28 CLOSED** — `src/utils/chess.ts:152–174` removes the unused argument and unreachable branch. The sole former `true` caller supplies a leaf path. Other callers retain their behavior.
- **R6-PRECOUNT CLOSED** — the redundant synchronous guard is removed. The essential post-await ownership guard remains at `src/utils/tabs.ts:199`.

**Retained integration obligations remain CLOSED at source level:** provider-local ownership, inactive completion, independent admission, successor completion and identity-checked release remain intact. Save and recovery retain their distinct cancellation, uncertainty and error-propagation policies. The count-owner fault exposes actual count corruption from 3 to 99, and the newer-Save fault exposes revision loss. The shared transaction preserves current metadata, logical/cached-store identity and existing InfoPanel replacement behavior.

Touched-line history preserves the earlier physical-generation, repetition and checkmate fixes. Repairs originate in `a51b08a3` and `2968b322`. No sibling instance of the corrected Add Game count helper survives.

**Limitation (confidence: 100):** no tests were executed during this read-only review. Inspected evidence includes direct production faults, restoration results and the root receipt recording 667 integrated tests plus 46 parser tests. Cold hydration and immediate exception preservation do not establish later native reconciliation. Pixels, actual WebKitGTK behavior and all fourteen standalone runtime fault/restoration stages remain **NOT CLOSED**. Historical failed compression receipts remain failures.

Detection used the code author’s model family. Plan authorship and arbitration shared one context.

VERDICT: APPROVED

## Raw R7 tests report

No new verification findings.

- R6-COUNT CLOSED — `BoardAnalysis.test.tsx:1345` asserts actual notification messages for both refused count-publication callers. Faults produce the false retry-success message and invented unknown error. Success, typed failure and obsolete-owner controls remain.
- R6-DURABLE CLOSED — `BoardAnalysis.test.tsx:1176` reads the blank tree through an independent repository before flushing. Reverting completion restores the old dirty content and fails this assertion. Separate tree/workspace refusals preserve previous bytes and pending Save state. At `:1291`, post-admission count repair corrupts the durable page and fails. Accepted-successor completion also has a discriminating freshness assertion. Repair: `a51b08a3`.
- R6-DIRTY CLOSED — `tree.test.ts:359` asserts dirty state after replaying each existing terminal child. The Git-derived revert preserves the correct Result but fails all six dirty assertions with exit 1. Unchanged Result, disabled adjudication and ordinary navigation stay clean. Repair: `2968b322`.
- R6-DEAD CLOSED — caller tracing confirms the removed third argument only operated on a mainline leaf. This is nonbehavioral removal, with no claimed behavioral fault proof.
- R6-PRECOUNT CLOSED — only the redundant synchronous guard is removed. The retained post-await guard’s fault changes replacement `numGames` from 3 to 99.

Retained Save, recovery-append, lease and D9 transaction proofs remain CLOSED within the changed integration. Inspected faults expose lost Save revision, obsolete registered errors and leaked recovery messages. Lifecycle assertions retain cached-store, settings, native-game and report ownership.

The suites match Vitest’s include pattern and the frontend coverage gate. The actual root receipt records exit 0 for 667 integrated tests, 46 parser tests, pre-review and contract checks.

Limitation (confidence: 100): approval is source-level. Cold repository reads do not prove native restart or later reconciliation. Pixels, real WebKitGTK behavior and fourteen standalone fault/restoration stages remain pending. No tests or writes were performed here.

Detection used the code author’s model family. Plan authorship and arbitration shared one context.

VERDICT: APPROVED

## Raw R7 code-quality report

[should-fix] src/utils/tabs.ts:270 — Storage refusal is encoded as `ok: false` without an `error`, and property absence silently suppresses notification. The reason is undocumented here: persistence already reports the refusal. Name that outcome or add an explanatory comment, consistent with the explicit `committed`/`refused` results nearby. Origin: `a51b08a3`. (confidence: 88)

R6-DEAD CLOSED — `chess.ts:160` removes the unused argument and unreachable branch. All five production callers use two arguments.

R4-ID, R4-LIMIT and f-20261010-21 remain CLOSED — physical `treeKey` naming and named bounds of 10 and 512 remain intact.

Limitation (confidence: 100): correctness and persistence closures belong to other lenses. No tests ran or files changed. Native/pixel proof remains pending. Detection used the code author’s model family. Plan authorship and arbitration shared one context.

VERDICT: APPROVED

## Raw R7 minimalism report

No bloat or duplication findings above the confidence threshold.

- R6-PRECOUNT CLOSED — `tabs.ts:195` removes the redundant pre-count guard and retains post-await ownership validation.
- R6-DEAD CLOSED — `chess.ts:160` removes the unused parameter and unreachable branch. All production callers use two arguments.
- R6-COUNT CLOSED at source level — `tabs.ts:209` preserves durable refusal. Both notification-boundary cases at `BoardAnalysis.test.tsx:1313` distinguish refusal from success and typed failure.
- R6-DURABLE CLOSED at source level — `tabs.ts:240` reuses `replaceFileGame`, shared with InfoPanel. Immediate cold reads, separate admission refusals and post-admission exceptions have semantic fault witnesses.
- R6-DIRTY CLOSED at source level — `tree.ts:772` marks actual Result changes dirty. Parameterized replay tests retain unchanged, disabled and ordinary-navigation controls.

The smallest sufficient diff follows the implemented boundary: reuse the existing transaction, pass the provider workspace, add concrete count/origin handling and delete dead code. No files were added. The three new test helpers have multiple callers, and the tests cover distinct outcomes.

Retained Save and recovery policies remain separate and unchanged. The independent admission lease and shared ownership checks remain justified by remount, competing-Save and replacement consumers.

Limitation (confidence: 100): no tests rerun here. Inspected fault diagnostics show content, metadata and notification failures, beyond array identity. The root log records 667 integrated tests plus 46 parser tests, and its completion receipt is exit 0. Pixels, native behavior and fourteen runtime fault stages remain pending. Detection used the code’s model family. Plan authorship and arbitration shared one context.

VERDICT: APPROVED

## Raw R7 error-handling report

[blocker] src/utils/tabs.ts:260 — Post-admission exceptions mishandle the operation’s own successor. If retargeting installs the blank tree and then throws, durable workspace metadata names the appended page, but live metadata still names the old page (`atoms.ts:109–111`). The catch sets `unverified` and releases admission. Gate reconciliation then reads the old page (`FileFreshnessGate.tsx:146`) and installs it into the already-retargeted candidate key (`:183`). A subsequent flush pairs the appended page with the previous game. If a Jotai subscriber instead throws after live publication, `owns()` rejects the acknowledged successor before `completionOwner` is updated, silently swallowing the error and leaving freshness permanently `appending`. Installed Jotai explicitly throws subscriber errors after publication. Origin: `a51b08a3`. (confidence: 95)

R6-COUNT CLOSED at source level — both callers honor count-publication refusal. `BoardAnalysis.test.tsx:1313` observes actual storage and uncertainty notifications. The retained refusal fault adds the forbidden refreshed-count message, exits 1, and restores to exit 0.

R6-PRECOUNT CLOSED — the synchronous pre-count check is removed. The post-await ownership barrier remains at `tabs.ts:197`.

R6-DURABLE NOT CLOSED against the complete exception contract — normal completion, immediate cold pairing and definite tree/workspace refusal are corrected. Post-admission preservation fails through the continuation above. The exception witnesses at `BoardAnalysis.test.tsx:1276` stop before reconciliation settles because `readGame` remains pending at `:277`.

f-20261010-26 NOT CLOSED against the complete failure/terminality contract. Its independent admission, remount, inactive completion and foreign-owner suppression remain source-closed within their prior classes.

f-20261010-25 CLOSED at source level — recovery append retains separate cancellation, persistent uncertainty and typed propagation. Its retained rejection/fulfillment faults expose actual caller-error and panel corruption. Save and reload error guards remain intact. No changed premise reopens the deferred database-view or deletion findings.

Evidence inspected includes the production call chain, final tests, fault patches/diagnoses, root proof log and completion receipt: `0 r6-source-pre-review 452b3ff409f5ac730f81a9087d7c1a1744ba50ea`.

Limitation (confidence: 100): read-only source review, no reproducer or tests executed here. Pixels, native behavior and fourteen runtime fault stages remain pending. Detection used the code’s model family. Plan authorship and arbitration shared one context.

VERDICT: REVISE

## Raw R7 persisted-state report

No new persistence findings.

- **R6-DURABLE / f-20261010-29 CLOSED at source level** — `tabs.ts:242` stages the blank tree before jointly admitting its physical key, page and count. `BoardAnalysis.test.tsx:1163` checks immediate cold reads without flushing. Separate refusal and post-admission exception cases preserve old bytes and pending Save state. Inspected faults expose old-content reload and destructive page repair.
- **R6-COUNT / f-20261010-27 CLOSED at source level** — `tabs.ts:209` preserves durable update refusal. Both outcome callers distinguish storage refusal from native failure. `BoardAnalysis.test.tsx:1314` verifies unchanged count/storage and truthful notifications.
- **R6-PRECOUNT CLOSED** — the redundant synchronous guard is removed. The post-await ownership guard remains.
- **R6-DIRTY CLOSED within this lens** — `tree.ts:772` marks changed Result content dirty before existing-child navigation. Replay tests retain unchanged and disabled-adjudication controls.
- **D9/D9-P3, R4-BOARD/DUP/ID, f16/f17 remain CLOSED** — effective-key hydration, duplication, required references, metadata preservation and cleanup intent remain intact.
- **R4-SAVE/GEN, f18/f19/f20/f25/f26 remain CLOSED within their persistence and ownership classes** — retained guards preserve replacement content, dirty edits, recovery markers and obsolete-owner silence.

Inspected root evidence records 667 integrated tests, 46 parser tests, successful pre-review and contract checks, and completion status 0.

Limitations: no tests ran in this read-only review. Cold-storage tests do not establish native restart behavior or later reconciliation after an injected post-admission exception. Pixels, WebKitGTK acceptance and fourteen standalone runtime fault stages remain pending. R6-DEAD is outside this lens. Detection used the code’s model family. Plan authorship and arbitration shared one context.

VERDICT: APPROVED

## Raw R7 chess-semantics report

[blocker] src/state/store/tree.ts:746 — SAN generation does not validate legality. With move text input enabled, enter `e2e5` from the standard starting position. `parseKeyboardMove` accepts the syntactically valid UCI through `parseSanOrUci`, and `MoveInput` passes it to this reducer. Chessops generates `e5`, so the `san === "--"` guard passes and `pos.play` records an illegal three-square pawn move. Check `pos.isLegal(move)` before admitting it. Pre-existing origin: `93b366695`. (confidence: 99)

R6-DIRTY / f-20261010-30 CLOSED — `tree.ts:752–774` marks actual Result changes dirty before existing-child navigation. The retained six fault cases fail specifically on dirty state with exit 1, then all 155 selected tests pass after restoration. Unchanged and disabled-adjudication controls remain clean.

R6-DEAD / f-20261010-28 CLOSED — `chess.ts:151–175` removes only the unused parameter and unreachable branch. The sole former `true` caller supplies a mainline leaf.

f-20261010-23 CLOSED — checkmate retains priority over halfmove-100 draws for both colours.

R4-PGN, f-20261010-21 and R4-LIMIT remain CLOSED — comment/header/annotation round trips, validated 512-element Start paths and the ten-ply analysis bound remain intact.

Limitations: source review only. No tests were executed or files changed here. Inspected fault logs and root receipt establish source evidence, not pixels or native behavior. Non-chess closure obligations belong to the other lenses. Detection used the code’s model family. Plan authorship and arbitration shared one context.

VERDICT: REVISE

## Raw R7 records report

[should-fix] tasks/findings.md:14839 — f-20261010-27’s “Current proof status” still says the count-refusal branch is unrepaired and requires a fresh repair. Commit a51b08a3 now honors refusal, and the round6 handoff:197–201 records completed repair and green source proof. Append an explicit superseding checkpoint while retaining pending R7/runtime closure. (confidence: 100)

Unverifiable: historical conversation and model provenance. No live services queried.

VERDICT: REVISE
