# Shared tab actions source contract and review history

The six-path phase below is separately arbitrated after the failed R5 budget premise and loaded f-20261010-26 defect. All six P3 witnesses approve with all four plan issues CLOSED. Implementation, current integrated gates and runtime proof remain pending. Plan authorship and arbitration shared one context. Detection ran on the code model family.

Complete canonical plan and raw review history follow. P1 artifact qualification remains explicit. No Felix decision is fabricated or reversed.

# Plan: shared tab actions and stable Add Game ownership

## Goal

Close the loaded Add Game physical-owner defect f-20261010-26 with the simplest shared tab-action mechanism. Preserve all previously adopted source corrections and actually pass the unchanged bundle budget before source closure and runtime proof. This supplements the existing game-opening plan in the same locked run. It is a distinct source contract after a failed compression premise, not a third R5 proof-fix iteration.

## MANDATE

### Opening a database, a database game or a game inside a PGN file has no visible affordance — only double-clicks and unlabelled icons

* **ID:** f-20261001-08 · **Status:** open · **Area:** frontend-ui · **Root:** - · **Entry:** build · **Blocked:** none
* **Where:** `src/components/databases/DatabasesPage.tsx` (~274: a database card opens only on `onDoubleClick`; a single click selects it and shows the details panel whose `Databases.Settings.Explore` button is the only labelled route), `src/components/databases/GameTable.tsx` (~221: a game opens in an analysis tab only on `onRowDoubleClick`; ~310: a single click only fills the preview), `src/components/databases/GameCard.tsx` (~41: the icon-only "Analyze game" action), `src/components/files/FileCard.tsx` (~94: the icon-only `Common.Open` magnifier is the only way to open the selected game), `src/components/panels/info/GameSelector.tsx` (~179: a row has `onClick` → `setPage` only, no double-click).
* **Defect:** Felix (2026-10-01) could not find how to open his games in either place. On the Databases page a single click on "Meine Partien" appears to do nothing useful; in the Files page he double-clicked a game in the file card's game list, which only selects it, and the open action is a bare magnifier icon with a tooltip. The two lists that show games also disagree: a database game row opens on double-click, a PGN game row does not. The double-click on a file *row in the tree* works (`f-20260905-14`); this is about the database card, the game rows and the icon-only open actions.
* **Fix shape:** one consistent open interaction for every "list of games" (database table and file game list): a visible labelled "Open"/"Analyse" button in the preview, and the same double-click/Enter behaviour on rows of both lists; a database card should open on a single click or show an obvious Open control. Route both game lists through one shared open-game affordance rather than two hand-wired copies (rule 11). Prove the pointer behaviour on the real WebKitGTK window with `pnpm verify:app` (the f-20260905-14 lesson: layout shifts between the clicks of a double-click).
* **Open question:** which single open interaction (labelled button, single click, double-click/Enter) every game list and the database card share, and where the shared open-game affordance lives so the database table and the file game list stop being wired separately.
* **Why `build`:** interaction design across two pages and three components with a shared affordance to extract; needs a plan.
* **Related:** `f-20260905-14` (handled: tree double-click and the restored file card), the Files/Databases library question filed in the same session, the database preview layout finding filed in the same session.
* **Found by:** Felix exploring his imported games and repertoires, session e3bd1021-4d34-443f-96c0-a1af650f0984, 2026-10-01 (screenshots in the session).


## Threat model and non-goals

The original accepted accidental-input and native-operation threat model remains fixed. File operations may settle after navigation, physical-only durable replacement, closure or gate teardown. The stable gate can withhold its board child during its own operation. Existing persistence refusal and unknown-write contracts remain binding. No evasive adversary, new user flow, service, watcher, generic async framework, persistence protocol, schema, backend, capability, generated binding, version, loading trick, diagnostic deletion or numeric baseline change is introduced. One narrow transient Add Game admission lease in an existing module is permitted by the contrary evidence documented in revision3. It is not a generic request registry or persistent state.

The loaded same-area correction f-20261010-26 is an explicit source obligation under push-review-policy4. Its entry is agent-authored evidence, not a statement or product decision by Felix. This phase does not reopen the separate deferred database-view persistence or database-deletion design problems f-20261010-01 and f-20261010-02.

## Traced premises

- BoardAnalysis appendGame checks file/page at start and after parse, but not physical generation. Its native success, unknown result, count refresh and catch can publish against a replacement. Full trace is in f-20261010-26.
- BoardAnalysis.tsx79 and FileFreshnessGate.tsx85 duplicate provider-local getTab/updateTab wiring. updateTabById in tabs.ts71 returns the durable workspace result and may refuse.
- saveToFile in tabs.ts412 combines captured physical ownership with its stricter origin-kind contract. Gate actionIsCurrent combines physical file/page ownership with cancellation, action identity and cached store. These policies overlap but are not identical.
- BoardsPage.tsx468 nests BoardAnalysis inside FileFreshnessGate. BoardAnalysis sets freshness appending before native append, and FileFreshnessGate.tsx343 withholds its children while appending. A board mount guard rejects the operation's own successful completion.
- FileBackedGate survives child withholding, but BoardsPage274 unmounts it on navigation. The cached tree survives normal tab switching at tree708. Thus gate lifetime governs view publication, while captured workspace ownership governs accepted Add Game completion.
- The existing freshness entry survives mount lifetime but is shared status, not exclusive operation ownership. P2 traced an already-running ordinary Save publishing verified at tabs455 while Add Game parsing remains pending. Therefore freshness cannot be the admission authority. The cached-store lifetime supplies the genuine owner key for one narrow transient Add Game lease, independent of status publication. useNativeRequestOwner is not reused because it is SWR-cache/subscriber cancellation with different lifetime and retirement policy.
- Two bounded local save consolidations passed their exact tests and source-only faults but failed fixed bundle. Root round1 preflight603 plus46 tests0 measured1620066. Root round2 preflight603 plus46 tests0 measured1620076. Source remains uncommitted. Actual canonical mutation100 on an earlier candidate is historical. Current full pre-review/contract and runtime stages remain pending.

## Approach

### O1 Shared live tab access

Both analysis board and freshness gate use one shared provider-local hook for stable live lookup and durable tab update callbacks, in the existing tab utility module. It wraps the current updateTabById contract and introduces no ownership policy, asynchronous framework or global-store fallback. Workspace refusal remains observable and foreign provider state is not read.

### O2 Captured logical and physical ownership

The existing save, gate and Add Game paths share the logical ID and effective physical tree-reference comparison at its genuine common boundary. File actions compose the existing file handle/page contract. Save retains its stricter origin-kind contract. Cancellation, gate identity, reconcile epoch, cached-store identity, snapshot/discard checks, closing and cleanup safeguards stay with their callers. The change must preserve legacy effective-key fallback and current unrelated metadata.

### O3 Stable Add Game operation owner

FileBackedGate carries a narrowly scoped domain callback through a context in an existing phase module. The board retains the button, dirty confirmation, save continuation and user-facing presentation contract. Accepted Add Game has workspace-owned completion and gate-owned presentation. Its continuation does not inherit recovery action teardown cancellation. No generic registry, new module or BoardsPage change is needed.

Admission acquires one narrow transient Add Game lease synchronously before parsing, keyed by the actual cached store and captured owner generation in an existing phase module. It remains independent of mutable freshness and mount-local refs, and blocks a second operation for the same surviving owner until settlement. Release is identity checked so an obsolete continuation cannot release a newer owner lease. Different provider/store instances do not block each other. Closing or replacing the captured owner does not grant its continuation publication authority. No persistent schema or generic request registry is added. Freshness remains presentation and diagnosis, with its existing producers retained. A remounted gate reflects the still-owned pending operation despite an overlapping Save publishing status. Every surviving owner reaches an appropriate terminal outcome, including parse failure, uncertainty and durable refusal. Release does not restore stale captured freshness over a physical replacement or discard a newer Save stamp/diagnostic.

The operation survives its own board unmount and navigation while the captured logical tab, effective physical generation, file/page and cached store remain owned. Global count, origin, tree and freshness completion may publish for that surviving inactive tab. Removed or replaced owners receive no continuation writes or publication. Gate teardown suppresses obsolete React state and notifications, independently of workspace completion. Every async boundary validates its relevant captured authority. Current-owner count refresh, stale-count diagnostic/retry behavior, typed notifications, successful blank-game installation and unknown-write diagnosis stay correct. Recovery Save As New Game retains its distinct captured-PGN payload, cancellation, persistent unknown-write retry prohibition and error propagation. The two append flows are not treated as identical transactions.

### O4 Demonstrated source and delivery proof

Verify actual BoardAnalysis composed inside the real FileFreshnessGate with real provider-local workspace and cached tree state. A held successful Add Game must withhold the board, settle and restore the correct board/tree. Switch away during a held write, settle while the original gate is absent, then return and observe the completed blank game and terminal freshness. Also switch away during held parsing and return before settlement. A second activation must start no second parse or append. Also start an ordinary Save on the clean verified owner, hold its native result, accept Add Game and hold parsing, navigate away, settle that Save successfully, then return before parsing settles and activate again. No second parse or append is admitted, the pending operation is represented correctly, and Save stamp/result semantics are preserved. Cover competing Save failure/status publication with retained diagnostics as well. An obsolete release must not clear a newer-generation lease. Independent provider/store owners must remain independent. The surviving inactive owner's parse failure, write uncertainty and durable refusal must settle without a permanent loading state, with obsolete view state and notifications suppressed.

Held parse, write and count outcomes followed by real durable physical-only replacement or actual tab removal must preserve replacement bytes, content, origin, freshness and metadata and remain silent. Ordinary current-owner controls preserve completion, count refresh, refusal, uncertainty and notifications. Retain all existing save, recovery-append, discard, durability and source-boundary regression bodies or strengthen their outward observations without deleting coverage.

Every essential new authority/completion guarantee has a Git-derived production-only fault exposing its own semantic assertion failure and same-run exit1, with final tests unchanged. Exact source restoration passes the full selected command. Retain all prior historical source fault categories with truthful adaptation where shared guards replace duplicated guards. No repeated patch is counted as distinct proof.

Root runs scoped static checks, TypeScript, independent integrated selected tests, the actual canonical pre-review including selected mutation and fixed bundle, and contract proof on the frozen candidate. Bundle acceptance is measured entry/lazy/total against550000/550000/1620000, not a savings estimate. Fresh cumulative source review follows. Pixels, real app, all14 standalone assertion failures/restorations, clean reviewed-HEAD final push gates, ordinary push and pushed-SHA required CI remain separate pending stages.

## Decisions and trade-offs

Reuse actual duplicated tab access. A narrow cached-store/owner admission lease is required because P2 proved that unrelated Save completion can overwrite freshness during accepted work. Separate surviving workspace completion from view lifetime. Reject a board mount guard because loading unmounts that child. Reject gate teardown cancellation for Add Game global completion because navigation retains the tab and cached tree. Reject mount-local admission because remount during held parsing loses it. Reject freshness-only admission because Save is an independent existing producer. Reject adapting the unrelated SWR subscriber registry because its teardown cancellation contradicts workspace completion. Reject further isolated compressed-size guesses on the old phase, threshold changes, minifier games, a generic transaction framework and a new service. The earlier no-transient-registry constraint was an agent-authored implementation premise, not a Felix requirement. The source-backed narrow admission lease exception corrects that premise. Compressed savings are unproven until an actual build passes. Existing d-20260924-01/02/03 and d-20261010-06 remain binding. No Felix decision is reversed.

## Risks / open questions

The domain callback must not create a circular import or reset gate lifetime when children are withheld. Shared primitives must preserve caller-specific semantics. Source-only faults must still distinguish real stale authority from aborted-action false greens. The existing tests' standalone board harness is insufficient for the stable-lifetime guarantee and must use the actual composed production boundary. Bundle acceptance remains an actual proof prerequisite.

## Not part of this task

No independent database-view or deletion redesign, native GTK verification, new product wording, new configuration, recovery UI, persistence journal, generic cancellation system or production module. The narrow transient Add Game lease is the explicitly adopted exception to the earlier no-registry implementation premise. InfoPanel and BoardsPage are enclosing read-only contracts. The completed parser and checkmate paths are byte-protected peers. Native and screenshot code is not rewritten by this phase.

## Phases

One cohesive source phase owns only src/utils/tabs.ts, src/utils/tabs.test.ts, src/components/boards/BoardAnalysis.tsx, src/components/boards/BoardAnalysis.test.tsx, src/components/tabs/FileFreshnessGate.tsx and src/components/tabs/FileFreshnessGate.test.tsx. Shared primitives and both consumers land together and are independently committable only after the current integrated budget and required gates pass. Root writes records and arbitrates. One fresh normal writer, gpt-6.1-sol high, writes the six non-sensitive-glob source paths. Review-plan uses its high role, the other phase plan lenses use normal medium. Final cumulative review remains sensitive because the enclosing repaired range includes src/state paths.

Exact phase command:

```text
pnpm test src/utils/tabs.test.ts src/components/boards/BoardAnalysis.test.tsx src/components/tabs/FileFreshnessGate.test.tsx src/components/tabs/TreeRecoveryGate.test.tsx src/components/panels/info/InfoPanel.test.tsx src/state/atoms.lifecycle.test.ts
```

Scoped oxfmt/oxlint, tsgo --noEmit, diff check, Git-derived source-only fault/restoration evidence and a canonical isolated bundle measurement follow. Root owns integrated pre-review, selected mutation and contract after EOS. No stage commits or main index mutation by the writer. Preserve all other work and every prior proof artifact.

## Carried to diff review

None yet. Current plan-level correction J-TAB1 needs explicit closure against O3/O4. J-TAB2 input completeness needs explicit closure against this final path/revision/acceptance/history packet. Fresh full-plan findings will receive stable IDs in this record.

## Reviews

Focused fresh mechanism J1 returned REVISE. It is a judgment, not a complete plan-review cohort or proof of savings. Plan authorship and arbitration shared one context. Detection ran on the code model family.

| ID | Witness | Disposition | Evidence and correction | Authority | Closure |
| --- | --- | --- | --- | --- | --- |
| J-TAB1 | focused review-plan J1 blocker | Fix | Root confirmed BoardsPage468 and gate appending withholding. O3 uses stable gate actor and O4 verifies the composed boundary | Existing f26 captured-owner correction and original loading/safe-opening mandate. A guard that rejects its own completion cannot satisfy the existing flow | Open until reviewer checks revision1 |
| J-TAB2 | focused review-plan J1 should-fix | Fix | This canonical plan path, revision1, O1-O4 acceptance and explicit history/current IDs supply full-review inputs. The initial focused packet had no final plan path and did not stand in for a cohort | Mandatory review contract | Open until reviewer checks revision1 |

Raw focused verdict, unchanged:

````text
[blocker] /tmp/build-game-opening-3b67c3b9/lens-tab-actions-mechanism-j1.prompt:165 — Add Game cannot use `BoardAnalysis`’s mount lifetime as its completion authority while preserving current withholding behavior. Production nests the board inside the freshness gate at `src/components/tabs/BoardsPage.tsx:468`. Add Game publishes `appending` before awaiting the write at `src/components/boards/BoardAnalysis.tsx:183`, and the gate then replaces its children with the loading panel at `src/components/tabs/FileFreshnessGate.tsx:343`. The proposed mount guard would reject the operation’s own successful completion, leaving freshness at `appending`. The current board harness omits the gate at `src/components/boards/BoardAnalysis.test.tsx:229`, so its positive controls would miss this regression. Correct both the lifetime contract and the composed verification boundary. (confidence: 99)

[should-fix] /tmp/build-game-opening-3b67c3b9/lens-tab-actions-mechanism-j1.prompt:167 — This mechanism packet supplies the source checkpoint, scope and historical evidence, but no final plan path/revision, complete proposed acceptance set or explicit current plan-review issue inventory. Supply those inputs for the requested full plan review. This judgment cannot substitute for that review or reconstruct its candidate from historical handoffs. (confidence: 100)

The failed premise is **that correctness-preserving consolidation necessarily produces sufficient compressed savings**. The measurements increased from 1620065 to 1620066, then 1620076. The last report explicitly records the disproved premise at `/tmp/build-game-opening-3b67c3b9/r5-save-round2/REPORT.md:96`. None establishes savings for this mechanism.

The lookup/update extraction is justified. `BoardAnalysis.tsx:79` and `FileFreshnessGate.tsx:85` duplicate the same live Jotai lookup and `updateTabById` wiring. A stable hook in the existing tabs utility should wrap that primitive, preserving its durable boolean result at `src/utils/tabs.ts:71`. It should add no ownership policy or asynchronous framework.

The owner comparison also has real consumers: save at `src/utils/tabs.ts:412`, gate actions at `FileFreshnessGate.tsx:103`, and durable replacement at `tabs.ts:235`. Share logical ID and effective physical-key equality, then compose existing file/page matching. Preserve save’s stricter origin-kind comparison at `tabs.ts:376`. Keep cancellation, gate identity, reconcile epoch, cached-store, closing and snapshot checks with their respective callers.

**Choose the stable `FileBackedGate` as Add Game’s operation owner.** Its existing controller cleanup and action runner at `FileFreshnessGate.tsx:119` and `:201` survive child withholding. BoardAnalysis retains the button and dirty confirmation, then invokes a narrowly scoped gate-owned callback. A domain-specific React context in an existing phase module can carry that callback within the six-file boundary, without changing BoardsPage or introducing a registry. This has an identified integration need. Recovery append and Add Game must retain their different payload, uncertainty and presentation contracts.

Freeze these obligations for full plan review:

- **O1 — Shared tab access:** Both components use stable, provider-local callbacks for live lookup and durable update. Existing callers retain their contracts.
- **O2 — Captured ownership:** File operations compare logical identity, effective physical generation and file/page ownership. Caller-specific safeguards remain binding.
- **O3 — Add Game lifetime:** The operation survives its own `appending` child unmount. Gate teardown and ownership replacement suppress obsolete continuation, count updates, tree/origin/freshness publication and notifications. Current-owner confirmation, refresh, typed errors, unknown outcomes and origin refusal remain unchanged.
- **O4 — Demonstrated proof:** Verify actual BoardAnalysis inside the real FileFreshnessGate. A held append must withhold the board, settle successfully and restore it. Held parse, write and count outcomes followed by durable physical-only replacement must preserve the replacement and remain silent. Retain active-owner controls and the existing recovery-append uncertainty proofs.

The concrete local proof boundary is:

```text
pnpm test src/utils/tabs.test.ts src/components/boards/BoardAnalysis.test.tsx src/components/tabs/FileFreshnessGate.test.tsx src/components/tabs/TreeRecoveryGate.test.tsx src/components/panels/info/InfoPanel.test.tsx src/state/atoms.lifecycle.test.ts
```

Require isolated source-only faults to expose physical-owner, teardown and current-owner completion failures with unchanged final tests, followed by exact restoration passing. Root must then run scoped static checks, canonical pre-review and contract checks against the frozen integrated candidate. Bundle acceptance remains an actual build/check result against unchanged 550000/550000/1620000 limits.

No files changed or tests ran. f-20261010-26 remains unimplemented. Savings, cumulative source closure, pixels, native behavior and all fourteen failure stages remain unverified. Plan authorship and arbitration shared one context. Detection ran on the code model family.

VERDICT: REVISE
````


Revision2 correction and complete history. P1 reviewed the unchanged canonical revision1 record. The named body and root snapshots were absent during P1 because the root script exited before creating them. Root created matching copies after P1 EOS. They are actual copies of the record P1 inspected, not artifacts claimed to have existed earlier. No P1 verdict is complete candidate approval. Revision2 snapshots and the script-produced delta are created before P2.

| ID | Witness | Disposition | Evidence and correction | Authority | Closure |
| --- | --- | --- | --- | --- | --- |
| TAP1 | P1 plan and correctness blocker | Fix | O3 separates workspace completion from gate view lifetime. O4 proves settlement while inactive and navigation return, including failures and refusal | Existing accepted Add Game completion and f26 physical ownership, no new product behavior | Open pending explicit P2 closure |
| TAP2 | focused J2 blocker | Fix | O3 claims existing per-tab appending state before parsing. O4 proves remount during held parsing admits no second operation | Retained single-flight contract, existing state rather than a new registry | Open pending explicit P2 closure |
| J-TAB1 | J1 and P1 | Fix | O3 preserves completion across child withholding and navigation. J2 closes the withholding mechanism, implementation pending | Existing loading behavior | Open pending final revision2 closure |
| J-TAB2 | J1, all P1 and J2 | Fix | Snapshot creation omission preserved above. Final revision2 path, real frozen body and script-produced round2 delta are supplied before P2 | Required review inputs | Open pending final revision2 closure |

Plan authorship and arbitration shared one context. Detection ran on the code model family.

Raw P1 plan verdict, unchanged:

````text
[should-fix] tasks/plans/2026-10-10-tab-action-ownership.md:95 — **J-TAB2 NOT CLOSED.** Both supplied frozen snapshots are absent: `tasks/plans/.plan-tab-action-ownership-r1.body.md` and `/tmp/build-game-opening-3b67c3b9/plan-tab-actions-r1.md`. Reads returned “No such file or directory”. The canonical record and previous J1 packet are available, but cannot establish the exact final candidate. (confidence: 100)

**J-TAB1 NOT CLOSED against frozen revision1.** The available canonical O3/O4 text addresses the original self-unmount defect. `FileFreshnessGate.tsx:343` withholds children while its enclosing actor survives, and its controller belongs to that actor at `:119`. However, the missing snapshot prevents final-candidate closure.

[blocker] tasks/plans/2026-10-10-tab-action-ownership.md:50 — **New defect: teardown suppression leaves a surviving tab permanently `appending`.** Start Add Game, switch tabs during the held write, let it settle, then return. `BoardsPage.tsx:274` uses `keepMounted={false}`, so switching tears down the gate. Its cleanup at `FileFreshnessGate.tsx:119` only aborts the controller. Freshness survives ordinary provider unmount because cached-store `dispose` is a no-op at `src/state/store/tree.ts:708`. O3 suppresses late freshness publication, leaving no specified terminal transition. On remount, `FileFreshnessGate.tsx:126` reconciles only `unverified`, while `:343` displays the appending loader. The poll cannot rescue it because `src/state/fileFreshness.ts:407` defers every outcome while appending. O4 at plan line 54 requires teardown silence but no remount recovery. Require a terminal/recovery contract for the surviving tab and composed switch-away/settle/return proof that fails when recovery is removed. This is separate from J-TAB1’s own-child withholding defect. (confidence: 97)

No files changed or tests run. Source/runtime closure and compressed savings remain unverified.

VERDICT: REVISE
````

Raw P1 correctness verdict, unchanged:

````text
J-TAB1 CLOSED — O3/O4 in the available canonical plan replace board-mount ownership with gate ownership and require composed completion proof. The gate survives its own child withholding.

[blocker] tasks/plans/2026-10-10-tab-action-ownership.md:50 — New teardown case leaves `appending` without a terminal transition. Start Add Game, hold the native write, switch tabs, settle the write, then return. `BoardsPage.tsx:274` unmounts inactive gates. Existing gate cleanup only aborts (`FileFreshnessGate.tsx:121`), while O3 suppresses late freshness publication. The remounted gate therefore displays “Adding game” indefinitely. Polling cannot recover it because `fileFreshness.ts:407` defers every outcome while appending. Define an ownership-safe terminal transition or remount recovery, preserving replacement freshness, and include this navigation-return case in the composed proof. This is distinct from J-TAB1’s child-withholding case. (confidence: 96)

[should-fix] tasks/plans/2026-10-10-tab-action-ownership.md:95 — J-TAB2 NOT CLOSED. Both designated revision1 snapshots are absent: `tasks/plans/.plan-tab-action-ownership-r1.body.md` and `/tmp/build-game-opening-3b67c3b9/plan-tab-actions-r1.md`. The canonical record supplies O1–O4 and history, but its identity against the frozen review body cannot be verified. Findings above concern that available record. (confidence: 100)

Read-only inspection only. No tests or runtime proof ran.

VERDICT: REVISE
````

Raw P1 tests verdict, unchanged:

````text
J-TAB1 CLOSED at plan level — `tasks/plans/2026-10-10-tab-action-ownership.md:54` requires actual BoardAnalysis inside the real gate, board withholding during a held append, and restored board/tree after success. Rejecting completion on child unmount would fail that restoration assertion. Line 56 additionally requires a production-only fault producing a semantic assertion failure with unchanged tests. The existing standalone harness does not prove this, and the plan explicitly replaces that proof boundary.

[should-fix] tasks/plans/.plan-tab-action-ownership-r1.body.md:1 — J-TAB2 NOT CLOSED. Both the exact body snapshot and `/tmp/build-game-opening-3b67c3b9/plan-tab-actions-r1.md` are absent. The full record supplies O1–O4, history and issue inventory, but its identity with the frozen revision cannot be checked. This limits approval to the inspected record’s proposed verification contract. (confidence: 100)

The selected test command reaches the planned suites through the configured Vitest include pattern. No tests ran. Source faults, bundle acceptance, pixels and native behavior remain pending.

VERDICT: APPROVED
````

Raw P1 minimalism verdict, unchanged:

````text
No bloat or duplication findings in the available plan record.

O1 has two existing callers at `BoardAnalysis.tsx:79` and `FileFreshnessGate.tsx:85`. O2 shares identity comparison while preserving distinct caller policies. O3’s narrow context supplies the required callback across child withholding. The smallest sufficient implementation uses the existing modules and gate runner, as proposed. No added production file needs justification.

J-TAB1 CLOSED at plan level — O3 assigns ownership to the stable gate, and O4 explicitly requires composed withholding, successful settlement and board restoration. The production nesting at `BoardsPage.tsx:468` supports this correction. Implementation proof remains pending.

J-TAB2 NOT CLOSED — both exact revision1 snapshots are absent: `tasks/plans/.plan-tab-action-ownership-r1.body.md` and `/tmp/build-game-opening-3b67c3b9/plan-tab-actions-r1.md`. The full record supplies acceptance and history, but its identity with the frozen candidate cannot be verified (limitation confidence: 100).

Approval covers minimalism in the available full record. No files changed or tests run. Bundle savings and runtime closure remain unverified.

VERDICT: APPROVED
````

Raw P1 error-handling verdict, unchanged:

````text
J-TAB1 CLOSED at plan level — O3 assigns completion to the stable gate. O4 requires composed withholding, settlement and board restoration, directly catching the former deadlock.

[should-fix] tasks/plans/2026-10-10-tab-action-ownership.md:95 — J-TAB2 NOT CLOSED: both named frozen snapshots are absent. The full record supplies O1–O4 and review history, and HEAD matches the supplied revision, but exact revision1 body identity cannot be verified. This limits candidate-specific closure. (confidence: 100)

No additional error-handling plan defects found. Implementation, failure/restoration proof and runtime behavior remain unverified. No files changed or tests run. Detection ran on the code model family.

VERDICT: APPROVED
````

Raw P1 persisted-state verdict, unchanged:

````text
J-TAB1 CLOSED at plan level — O3 assigns Add Game to the gate lifetime that survives child withholding. O4 requires actual board/gate composition and successful restoration, addressing the deadlock missed by the standalone harness.

[should-fix] tasks/plans/2026-10-10-tab-action-ownership.md:95 — J-TAB2 NOT CLOSED: both named revision1 snapshots are absent. The full record supplies O1–O4 and history, but its equality to the frozen review candidate cannot be checked. (confidence: 100)

No persistence blocker found in the available plan. Traced workspace and tree writers/readers share compressed serialization, effective physical keys, handled refusal and unload flushing. O1–O4 preserve those contracts.

Read-only review. No files changed or tests run. Approval covers the available plan record, not implementation or runtime proof. Detection ran on the code model family.

VERDICT: APPROVED
````

Raw focused J2 verdict, unchanged:

````text
J-TAB1 CLOSED at mechanism level for candidateJ2 — the gate can carry the callback across child withholding without making child mount lifetime the completion authority. Production composition confirms this at `src/components/tabs/BoardsPage.tsx:468` and `src/components/tabs/FileFreshnessGate.tsx:343`.

TAP1 CLOSED at mechanism level for the reported held-write/navigation-return case — candidateJ2 separates workspace completion from view publication. The captured store survives navigation (`src/state/store/tree.ts:708`), and existing success completion uses tab membership and file/page ownership (`src/components/boards/BoardAnalysis.tsx:198`). Implementation proof remains pending.

[should-fix] /tmp/build-game-opening-3b67c3b9/tab-actions-mechanism-j2-candidate.md:3 — **J-TAB2 NOT CLOSED for full-review readiness.** Both revision1 snapshots now exist. The full snapshot matches the canonical record, and its pre-review body matches the body snapshot. However, this correction packet contains no required script-produced `ROUND/DELTA/REVISED/SETTLED` block. The canonical `## Reviews` at `tasks/plans/2026-10-10-tab-action-ownership.md:88` establishes prior review. Present artifacts resolve the missing-file defect, but do not retroactively complete P1 or establish a complete closure packet. (confidence: 100)

[blocker] /tmp/build-game-opening-3b67c3b9/tab-actions-mechanism-j2-candidate.md:9 — **The revised lifetime leaves admission protection across remounts unaddressed.** Hold parsing, switch away, return before parsing settles, then press Add Game again. The existing flow awaits parsing at `src/components/boards/BoardAnalysis.tsx:150` and publishes `appending` only at `:183`. Navigation unmounts the gate (`src/components/tabs/BoardsPage.tsx:274`), whose pending flag is mount-local (`src/components/tabs/FileFreshnessGate.tsx:79`). A remounted gate therefore exposes the verified board with a fresh pending flag while the accepted first operation survives. Membership and generation comparisons cannot distinguish two operations for the same owner. The proposed navigation proof holds the native write, after withholding has already begun, and would miss this failure of the retained single-flight contract at `tasks/plans/2026-10-10-tab-action-ownership.md:50`. Require admission protection from acceptance through settlement across remounts and a composed regression proving a second activation starts no second operation. (confidence: 96)

The simplest correct boundary is **workspace-owned Add Game completion with gate-owned presentation**. J1’s previous answer correctly rejected board-mount authority, but incorrectly extended gate teardown cancellation to global completion. The contrary evidence is that navigation destroys the gate while retaining its workspace tab and cached store. The gate controller and runner remain appropriate for recovery actions and view publication. Add Game’s parse and global completion must not inherit their teardown cancellation.

Cancellation followed only by ordinary reconciliation does not preserve existing success behavior. Reconciliation reads the old origin index (`FileFreshnessGate.tsx:136`), whereas successful Add Game moves the origin to the appended index and installs the blank tree (`BoardAnalysis.tsx:200`). Preserve that completion through the existing asynchronous continuation.

Freeze these corrections for the next full review:

- **O3 — Stable Add Game operation owner:** Accepted Add Game work remains single-flight across child withholding and navigation remounts until settlement. Global continuation and origin/tree/count/freshness publication depend on captured logical, physical, file/page and cached-store ownership, independently of active selection or view lifetime. Removed or replaced owners receive no late publication. Gate teardown suppresses old React state and notifications. Every surviving owner reaches an appropriate non-appending outcome, including failure, uncertainty and durable refusal. Preserve recovery append’s separate cancellation and persistent uncertainty policy.
- **O4 — Demonstrated source and delivery proof:** Verify actual board/gate composition with real workspace and cached tree state. Prove withholding and completion, settlement while inactive followed by return, and return before held parsing settles with no second admission. Prove surviving-owner failure/uncertainty outcomes, replacement/removal suppression and obsolete-view silence. Each essential guarantee needs its own production-only fault producing a semantic assertion failure with unchanged final tests, followed by exact restoration and the selected command passing. Retain the remaining delivery obligations.

No files changed or tests ran. This is focused mechanism judgment, not runtime proof or full-plan approval. Detection ran on the code model family.

VERDICT: REVISE
````


Revision3: all six P2 reports inspected after EOS. J-TAB1, J-TAB2 and TAP1 explicitly CLOSED at plan level. TAP2 is NOT CLOSED by plan and correctness due to overlapping ordinary Save clearing freshness. Tests and the other lenses approved the narrower revision2 case, which does not negate contrary evidence. Fix remains adopted under retained single-flight and existing Save semantics. O3/O4 use a narrow transient cached-store/captured-owner admission lease and add the exact composed competing-Save witness. No other scope or promise changes. The prior no-registry wording was root implementation judgment and is corrected with this new evidence. Final implementation and budget remain unproved.

| ID | Witness | Disposition | Evidence and correction | Authority | Closure |
| --- | --- | --- | --- | --- | --- |
| TAP2 | P2 plan and correctness blocker, contrary evidence | Fix | Ordinary Save tabs455 clears shared status during held parsing. O3 independent narrow owner lease, O4 held Save completion plus remount/second activation and preservation of Save semantics | Existing single-flight and Save behavior, specific evidence permits the narrow transient lease exception | Open pending revision3 witnesses |

Plan authorship and arbitration shared one context. Detection ran on the code model family.

Raw P2 plan verdict, unchanged:

````text
J-TAB1 CLOSED — revision2 O3/O4 at `tasks/plans/.plan-tab-action-ownership-r2.body.md:49` and `:57` remove board-mount completion authority and require composed restoration. This addresses child withholding at `src/components/tabs/FileFreshnessGate.tsx:343`.

J-TAB2 CLOSED — both final snapshots exist and match the canonical record/body. The complete history and round2 delta are supplied. The historical qualification at `tasks/plans/2026-10-10-tab-action-ownership.md:138` remains intact. This does not retroactively approve P1.

TAP1 CLOSED — revision2 explicitly preserves inactive workspace completion and requires switch-away, settlement and return proof at `tasks/plans/.plan-tab-action-ownership-r2.body.md:53` and `:57`. This addresses navigation teardown at `src/components/tabs/BoardsPage.tsx:274` while retaining the cached store at `src/state/store/tree.ts:708`.

[blocker] tasks/plans/.plan-tab-action-ownership-r2.body.md:51 — **TAP2 NOT CLOSED: another operation can clear the proposed admission state before Add Game settles.** Start an ordinary Save on a clean file-backed board, accept Add Game and hold its parse, then switch away. Save remains admissible through the unconditional hotkey at `src/components/boards/BoardAnalysis.tsx:272`. Its completion guard checks physical generation and origin at `src/utils/tabs.ts:412`, which remain unchanged during parsing, and its successful completion publishes `verified` at `:455`. `setFileFreshness` accepts that transition at `src/state/fileFreshness.ts:156`. Returning now mounts a fresh gate and board because `FileFreshnessGate.tsx:342` renders verified children. The appending admission claim is gone while the first Add Game survives, allowing a second parse. This is contrary evidence to the revised premise that freshness alone protects admission through settlement. O4’s remount case at plan `:57` does not exercise this competing writer. Require the admission contract to survive overlapping Save completion, with a composed regression that proves no second admission. (confidence: 96)

Read-only source review. No files changed or tests ran. Implementation, bundle and runtime proof remain pending. Plan authorship and arbitration shared one context. Detection ran on the code model family.

VERDICT: REVISE
````

Raw P2 correctness verdict, unchanged:

````text
J-TAB1 CLOSED — Revision2 O3/O4 preserve completion across child withholding and require composed board restoration.

J-TAB2 CLOSED — Both revision2 snapshots exist. The root snapshot matches the canonical record, with the body snapshot as its prefix. Complete history and delta are supplied. P1’s historical qualification remains intact.

TAP1 CLOSED — O3 permits inactive workspace completion independently of gate teardown. O4 requires navigation-return proof and terminal failure, uncertainty and refusal outcomes.

[blocker] tasks/plans/.plan-tab-action-ownership-r2.body.md:51 — TAP2 NOT CLOSED. The proposed admission marker can be cleared by an already-running Save. On a clean, verified file tab, press Save, hold its result, then accept Add Game and hold parsing. Add Game claims `appending`, but Save still owns the unchanged logical tab, physical key and file/page. Its completion unconditionally publishes `verified` at `src/utils/tabs.ts:455`, releasing the marker before Add Game settles. Returning to the tab then exposes a fresh gate and allows a second Add Game admission. O3 requires single-flight through settlement but leaves this existing producer’s interaction unresolved. Define how Save completion preserves the active append claim without losing Save’s stamp and diagnostic semantics. (confidence: 94)

Limitation: plan review only. Implementation, bundle and runtime proof remain pending. No files changed or tests ran. Detection ran on the code model family.

VERDICT: REVISE
````

Raw P2 tests verdict, unchanged:

````text
J-TAB1 CLOSED at plan level — revision2 O4, line 57 requires actual board/gate composition, withholding during append and restored board/tree after settlement. A child-mount completion guard would fail that restoration assertion.

J-TAB2 CLOSED — both revision2 snapshots exist. The root snapshot matches the canonical record, and its body matches the frozen body snapshot. The supplied delta and complete Reviews history preserve the qualification that P1 was not complete candidate approval.

TAP1 CLOSED at plan level — O4, line 57 requires held-write settlement while the gate is absent, followed by return showing the completed blank game and terminal freshness. Gate-teardown cancellation of workspace completion would fail these observations.

TAP2 CLOSED at plan level — O4, line 57 requires return during held parsing and no second parse or append on another activation. Moving admission protection back after parsing would fail that assertion.

The selected command reaches the planned suites through Vitest’s configured include pattern. O4 also requires replacement preservation assertions and individual production-only faults with unchanged tests.

Limitation (confidence: 100): this approves the proposed proof contract. The current standalone board harness does not establish composed lifetime behavior. Implementation, fault/restoration results, bundle acceptance and runtime proof remain pending. No files changed or tests ran. Detection ran on the code model family.

VERDICT: APPROVED
````

Raw P2 minimalism verdict, unchanged:

````text
J-TAB1 CLOSED at plan level — revision2 O3 separates workspace completion from presentation lifetime. O4 requires actual board/gate withholding, settlement and restoration proof.

J-TAB2 CLOSED — both revision2 snapshots exist, the root snapshot matches the canonical record, and the complete history and delta are supplied. P1’s missing-snapshot qualification remains intact.

TAP1 CLOSED at plan level — O3 requires terminal workspace completion after navigation, including failure, uncertainty and durable refusal. O4 covers inactive settlement followed by return.

TAP2 CLOSED at plan level — O3 claims existing per-tab freshness synchronously before parsing. O4 covers held-parse remount and rejects second admission.

No bloat or duplication findings. O1 consolidates two existing tab-access implementations. O2 shares physical identity comparison while retaining caller-specific policies. O3’s narrow context has a concrete presentation-lifetime purpose.

The smallest sufficient implementation uses the existing modules, shared access and ownership primitives, existing freshness admission state, and composed regression tests. No new production file, registry or generic framework is proposed.

Read-only plan review. Implementation, bundle acceptance and runtime proof remain pending. Detection ran on the code model family.

VERDICT: APPROVED
````

Raw P2 error-handling verdict, unchanged:

````text
J-TAB1 CLOSED at plan level — revision2 O3 separates completion from child lifetime. O4 requires composed withholding, settlement and board restoration.

J-TAB2 CLOSED for revision2 review readiness — both snapshots exist, their body matches the canonical record, and the round2 delta and full history are supplied. This does not retroactively complete P1 approval.

TAP1 CLOSED at plan level — O3 requires terminal non-appending outcomes for surviving inactive owners, including failure, uncertainty and durable refusal. O4 requires switch-away/settle/return proof.

TAP2 CLOSED at plan level — O3 claims per-tab admission synchronously before parsing. O4 requires held-parse remount proof with no second parse or append.

No additional error-handling plan defects found. Implementation, budget and runtime proof remain pending. No files changed or tests run. Plan authorship and arbitration shared one context. Detection ran on the code model family.

VERDICT: APPROVED
````

Raw P2 persisted-state verdict, unchanged:

````text
J-TAB1 CLOSED — Revision2 O3 preserves completion across child withholding. O4 requires actual board/gate composition, successful settlement and board restoration.

J-TAB2 CLOSED — Both revision2 snapshots exist and match the canonical body. The complete delta and J1/P1/J2 history are supplied. P1’s missing-snapshot qualification remains intact.

TAP1 CLOSED — O3 separates workspace completion from gate presentation. O4 requires inactive settlement and return, including parse failure, uncertainty and durable refusal, without permanent `appending`.

TAP2 CLOSED — O3 claims existing per-tab freshness synchronously before parsing and checks admission across remounts. O4 requires held-parse navigation/return with no second parse or append.

No persistence blockers found in the revised plan. Traced workspace and tree writers/readers agree on compressed encoding and effective physical keys. Existing refusal, uncertainty-marker and unload-flush contracts remain binding.

Read-only plan approval only. No files changed or tests run. Implementation, budget and runtime proof remain pending. Detection ran on the code model family.

VERDICT: APPROVED
````


Revision3 final arbitration after full P3 EOS. Root fully read all six raw reports. All six APPROVED and explicitly CLOSED TAP2 plus preserved J-TAB1/J-TAB2/TAP1. No new findings or deferrals. All four plan issues are CLOSED at plan level. This authorizes the frozen six-path source phase, not a source, bundle, mutation or runtime green claim. Plan authorship and arbitration shared one context. Detection ran on the code model family.

Raw P3 plan verdict, unchanged:

````text
TAP2 CLOSED at plan level — revision3 O3 at `tasks/plans/.plan-tab-action-ownership-r3.body.md:51` separates admission from mutable freshness, requires generation-aware ownership and identity-checked release. This addresses Save’s independent `verified` publication at `src/utils/tabs.ts:455`. The cached store survives navigation (`src/state/store/tree.ts:708`) and physical retargeting (`:121`). O4 at plan `:57` requires the exact competing-Save sequence, second-admission rejection and preserved Save semantics.

J-TAB1 CLOSED, preserved — O3/O4 at plan `:49` and `:57` preserve completion across board withholding at `src/components/tabs/FileFreshnessGate.tsx:343` and require composed restoration.

J-TAB2 CLOSED, preserved — revision3 body matches the canonical record’s body, and the root snapshot matches the full record. Previous snapshots, cumulative history and round3 delta are present. P1’s historical qualification remains intact.

TAP1 CLOSED, preserved — plan `:53` retains inactive workspace completion independently of navigation teardown at `src/components/tabs/BoardsPage.tsx:274`. O4 requires settlement while absent, return and terminal failure/refusal outcomes.

No new plan defects found.

Limitation (confidence: 100): implementation, fault/restoration results, measured bundle and runtime proof remain pending. No files changed or tests run. Plan authorship and arbitration shared one context. Detection ran on the code model family.

VERDICT: APPROVED
````

Raw P3 correctness verdict, unchanged:

````text
TAP2 CLOSED at plan level — revision3 O3 makes admission independent of freshness and mount lifetime, with synchronous acquisition and identity-checked release. O4 covers the exact overlapping Save-success, held-parse, navigation-return and second-activation case, plus failure diagnostics and independent owners.

J-TAB1 CLOSED, preserved — O3 retains completion across child withholding. O4 requires composed board restoration.

J-TAB2 CLOSED, preserved — revision3 body and root snapshots are present, with matching body text and supplied delta/history. P1’s qualification remains intact.

TAP1 CLOSED, preserved — workspace completion survives navigation independently of view teardown, with terminal outcomes required.

No correctness defect found in the revised plan contract. Limitation (confidence: 100): implementation, bundle and runtime proof remain pending. No files changed or tests ran.

VERDICT: APPROVED
````

Raw P3 tests verdict, unchanged:

````text
TAP2 CLOSED at plan level — revision3 O3 separates admission ownership from mutable freshness. O4 at `tasks/plans/.plan-tab-action-ownership-r3.body.md:57` requires held Save success, held parsing, navigation-return and second activation. Reverting to freshness-only admission would fail the no-second-parse assertion. Save stamp/result, diagnostic, obsolete-release and independent-owner controls are also required.

J-TAB1 CLOSED at plan level — composed board/gate withholding and successful restoration would catch child-unmount rejection of completion.

J-TAB2 CLOSED — revision3 snapshots match the canonical record and body. The complete delta and history preserve P1’s missing-snapshot qualification.

TAP1 CLOSED at plan level — inactive settlement followed by return must show the completed blank game and terminal freshness. Gate-teardown cancellation would fail those observations.

Limitation (confidence: 100): approval covers the proposed proof contract. Current standalone tests do not establish the new composed guarantees. Implementation, fault/restoration evidence, bundle and runtime proof remain pending. No files changed or tests ran. Detection ran on the code model family.

VERDICT: APPROVED
````

Raw P3 minimalism verdict, unchanged:

````text
TAP2 CLOSED at plan level — revision3 O3 makes admission independent of freshness and mount lifetime, with identity-checked release. The source-backed Save publisher at `src/utils/tabs.ts:455` justifies this narrow lease. O4 requires the exact overlapping Save, held-parse, navigation-return and second-activation proof.

J-TAB1 CLOSED preserved — O3 separates workspace completion from presentation lifetime. O4 retains composed withholding and restoration proof.

J-TAB2 CLOSED preserved — frozen revision3 snapshots are present and match the canonical record/body. P1’s historical qualification remains intact.

TAP1 CLOSED preserved — inactive workspace completion and navigation-return proof remain explicit.

No bloat or duplication findings. O1 consolidates two existing callers. O2 shares identity comparison while retaining distinct policies. The smallest sufficient implementation uses existing modules, one domain callback, one transient owner lease and composed regressions. No added production file or generic framework is justified or proposed.

Limitation (confidence: 100): approval covers the plan. Implementation, measured bundle and runtime proof remain pending. No files changed or tests ran. Detection ran on the code model family.

VERDICT: APPROVED
````

Raw P3 error-handling verdict, unchanged:

````text
TAP2 CLOSED at plan level — revision3 O3 makes admission independent of freshness, requires identity-checked release and preserves Save diagnostics. O4 requires the exact overlapping Save/remount/second-activation proof, including failure outcomes.

J-TAB1 CLOSED preserved — completion survives child withholding, with composed restoration proof required.

J-TAB2 CLOSED preserved — revision3 snapshots match the canonical body and record. P1’s historical qualification remains intact.

TAP1 CLOSED preserved — surviving inactive owners receive terminal completion, including parse failure, uncertainty and durable refusal.

No additional error-handling plan defects found. Implementation, bundle and runtime proof remain pending. No files changed or tests run. Detection ran on the code model family.

VERDICT: APPROVED
````

Raw P3 persisted-state verdict, unchanged:

````text
TAP2 CLOSED at plan level — revision3 O3 at `tasks/plans/.plan-tab-action-ownership-r3.body.md:51` makes admission independent of mutable freshness and mount lifetime, using a cached-store/captured-generation lease with identity-checked release. O4 at `:57` requires the exact held-Save-success, held-parse, navigation-return and second-activation regression, plus diagnostic preservation and independent-owner controls. This addresses Save’s competing `verified` publication.

J-TAB1 CLOSED, preserved — O3 separates workspace completion from child lifetime. O4 retains composed withholding, settlement and board restoration proof.

J-TAB2 CLOSED, preserved — revision3 snapshots exist and match the canonical record/body. Complete history and delta are supplied. P1’s missing-snapshot qualification remains intact.

TAP1 CLOSED, preserved — O3 retains inactive-tab completion under captured ownership. O4 requires navigation-return and terminal failure, uncertainty and durable-refusal proof.

No persistence blockers found in revision3. Traced workspace and tree writers/readers agree on compressed encoding and effective physical keys. Persistence refusal, recovery-append uncertainty and unload-flush contracts remain binding. The lease adds no persisted state.

Read-only plan approval only. No files changed or tests run. Implementation, bundle and runtime proof remain pending. Detection ran on the code model family.

VERDICT: APPROVED
````

## Initial source candidate and first bounded repair judgment

Initial candidate remains source-open. Root independently ran 638 tests across 12 suites and 46 parser tests, scoped formatting, linting and types, then actual build and bundle measurement. All passed except the unchanged total bundle budget, actual total 1,623,428 bytes. Receipt: gate-root-tab-actions-initial-preflight.Zffdql, HEAD d067a499cadc2942625196703e0dd26fe4d9a3fd, completion 1, resolution red. Root did not rerun heavy pre-review after this known failed prerequisite. Main dist was intentionally rebuilt by root after the leaf EOS integrity proof, so its initial unchanged-dist claim refers only to the leaf interval.

### Initial leaf report, verbatim

```text
# Shared tab-action ownership source phase

The frozen O1–O4 source implementation and local fault proof are complete. The single final isolated build succeeds, but the canonical bundle gate is red. Total transfer is **1,623,428 gzip bytes**, exceeding the unchanged **1,620,000** limit by **3,428 bytes**. Source closure is blocked. No further source design or build attempt was started after that result.

This is the new revision3 source contract, not a third R5 budget iteration. The approved P3 witnesses and plan-level closures supplied by the root are inputs to this phase. They are not evidence that the current source, integrated gates, bundle or native runtime have closed. Plan authorship and arbitration shared one context. Detection here ran in the Codex code model family. This leaf did not perform independent root review or claim earlier mutation100 as current proof.

## Ownership and actual launch

- Actual launch and EOS HEAD: `d067a499cadc2942625196703e0dd26fe4d9a3fd`.
- Actual index byte SHA-256 at launch and EOS: `ab4d83afb32a571d7a3e8ab1c92f85701b1dbed2894706eb7112370ea12c4531`.
- `launch-index.txt` and `eos-index.txt` are identical. The index was never written by this leaf.
- All six owned paths were already modified at launch. `starting/` retains their exact launch bytes. `phase-owned.patch` is the leaf's launch-to-EOS delta, **1,131 insertions and 185 deletions across those six paths only**. This differs from the cumulative HEAD-to-worktree diff.
- The existing foreign changes in `src/state/store/tree.ts`, `src/state/store/tree.test.ts` and `src/utils/chess.ts` remain byte-identical to launch. Every other tracked path outside the six-path assignment also matches launch.
- The main `dist` manifest, containing 166 files, is unchanged. All 17 earlier scratch directories recorded at launch remain identical, excluding dependency symlinks, `node_modules`, `.git` and prohibited `.env` entries. The manifests are in `launch.json`. Earlier proof reports, logs and patches were not rewritten.
- No skill, agent, tracked record edit, stage, commit, push, deployment, pixel/native verification or external message was performed. Full project `CLAUDE.md` and `.env` files were not read. Manual source edits used `apply_patch`.

Protected launch SHA-256 values:

| Path | SHA-256 |
| --- | --- |
| `src/state/store/tree.ts` | `b36532534443a1d44fb4fb49c5638cd782fb801b113c5072c6f86f022d549300` |
| `src/state/store/tree.test.ts` | `7031b80f89e000ab83e2775f95c1326cf4fd438c530edd7cc1e4a0b6c3e1203e` |
| `src/utils/chess.ts` | `07ea714be999ba44c80b8b451f4df8fef96eb6c4a9a6431a68dfc585bf468906` |

Final owned SHA-256 values, also retained in `frozen-owned.sha256.json`:

| Path | SHA-256 |
| --- | --- |
| `src/utils/tabs.ts` | `042f479cb49ff89606cdc144fc5c848857a6706515ff8f6e71c266c453c13ec8` |
| `src/utils/tabs.test.ts` | `52c3c6ba9bbae33843d91174dd6ad29cfe3551c80e7ddb2eb384900b8e0a787e` |
| `src/components/boards/BoardAnalysis.tsx` | `4c514fcaacc894541c3aabd596f31f53f2cce535f22115e16679d089a7d85d5d` |
| `src/components/boards/BoardAnalysis.test.tsx` | `dba21c1be234084e280df69a02b7e7a34f981b696e4d137db98b50560e5c9a45` |
| `src/components/tabs/FileFreshnessGate.tsx` | `22253cd01c702f6e42e724de7f3ee3be9f015530cfb4e97e1f4e2213607f0b57` |
| `src/components/tabs/FileFreshnessGate.test.tsx` | `5550a5f0fd53480f4ded1ee943aa6cff651f989b40e3eb0698cf37e33c72f45c` |

## Mechanism and six-path delta

**O1:** `useTabActions()` in the existing `tabs.ts` obtains the caller's Jotai provider store and durable tab setter. Its stable callbacks read live tabs and call `updateTabById`. Both genuine consumers, `BoardAnalysis` and `FileBackedGate`, use those callbacks. There is no new production module or global workspace lookup.

**O2:** `sameTabOwner()` in `tabs.ts` compares logical tab identity and effective physical `getTabTreeKey()` identity, including the legacy fallback. Existing file/page matching composes with it in the gate. Save composes its stricter origin policy with it. The existing replacement path also uses the genuine shared comparison while retaining its closing, cache and snapshot checks. File/temp compatibility in the file gate does not weaken Save's stricter origin policy.

**O3:** `AddGameContext` in the existing `FileFreshnessGate.tsx` carries the narrow callback to `BoardAnalysis`. The board keeps its existing button, dirty confirmation, ordinary Save and save continuation. The gate owns Add Game's workspace continuation. There is no circular import or `BoardsPage` edit.

The admitted operation captures the tab and cached tree store. Its owner predicate checks the live provider-local tab, logical and physical generation, file/page, and exact cached-store identity. Admission is a narrow transient `WeakMap<TreeStore, AddGameAdmission>` lease. It is acquired synchronously before parsing and survives child withholding and gate remounts. It does not depend on mutable freshness. An independent store is an independent owner. A newer physical generation may admit its own operation. Release compares the exact lease object, so an obsolete completion cannot clear a newer generation's lease.

`useSyncExternalStore` presents pending Add Game from that lease even if a competing ordinary Save publishes verified freshness. Unsubscription removes view listeners. Empty admissions are removed after the last subscriber leaves, and weak keys retain no retired store. This is the adopted narrow admission exception, not a persisted state or generic action registry.

Workspace authority is independent of the gate view. A surviving inactive owner can settle its native result, origin, blank tree and freshness while its gate is absent. Guards after parse, native write and count suppress removed, physically replaced and cached-store-replaced owners before obsolete publication or continuation writes. Add Game never borrows recovery append's abort controller or `runAction` authority.

View authority independently gates Add Game's own notifications. Add Game's async continuation does not set React state after teardown. Parse failure restores only its exact freshness claim while still owned. A newer Save result, source stamp or diagnostic is preserved. Unknown native outcomes, write/count failures and refused durable origin writes settle to truthful terminal freshness without installing an unowned or undurable blank tree. Successful origin publication preserves the current unrelated tab and file metadata before installing the blank tree and verified result.

Existing recovery Save As New Game payload, persistent `appendAttempted`, uncertainty retry prohibition, actual registered-handler errors and `runAction` cancellation remain intact. `runAction` is independently verified byte-identical to launch. No wording, schema, journal, state module, configuration, budget or verifier was changed.

**O4:** `tabs.test.ts` adds shared ownership, stable provider-local access and durable-refusal witnesses. `FileFreshnessGate.test.tsx` adds effective legacy-key and file/temp gate behavior with an actual unaborted native signal. `BoardAnalysis.test.tsx` adds the real composed harness and asynchronous ownership witnesses described below. Existing standalone Board witnesses obtain the production callback from a real gate through the retained harness. The new composed witnesses render the real Board inside the real gate and real `TreeStateProvider`.

## Reads and integration

Read the entire canonical approved plan and cumulative raw reviews, real revision3 body, full tracked tab-actions handoff history, all six scratch P3 lens reports, all six named project rule files, exact named decisions, and both complete prior R5 round reports. Read all six assigned sources and tests before editing.

Traced the real integration through `BoardsPage`, `TreeStateContext`, `state/fileFreshness.ts`, `state/store/tree.ts`, `tabStorage.ts`, `InfoPanel.tsx`, `files.ts`, `ConfirmChangesModal` and current Save callers. The named `fileWorkspace.ts` does not exist in this checkout. Its relevant integration is implemented by `fileWorkspaceAtom` in `atoms.ts`, `ensureFileWorkspace` in `files.ts`, and `fileWorkspaceKey` in `utils/pathCapabilities.ts`. Those actual paths were read without changing them. No unrelated decision or ledger was rewritten.

## Local proof

The exact selected command used locally, for candidate baseline and for every fault restoration was:

```sh
pnpm test src/utils/tabs.test.ts src/components/boards/BoardAnalysis.test.tsx src/components/tabs/FileFreshnessGate.test.tsx src/components/tabs/TreeRecoveryGate.test.tsx src/components/panels/info/InfoPanel.test.tsx src/state/atoms.lifecycle.test.ts
```

Final local result: **six test files, 290 tests passed, exit 0** in `local-final-green.log` and `.exit`. Candidate baseline is also 290 passed, exit 0. The final sources and final tests were frozen before the accepted fault loop.

Scoped `pnpm exec oxfmt --check` and `pnpm exec oxlint --deny-warnings` over exactly the six owned paths both exit 0. `pnpm exec tsgo --noEmit` and `git diff --check` exit 0. Exact commands and logs are in `run-static.sh`, `format.log`, `lint.log`, `types.log`, `diff-check.log` and their `.exit` files. No heavy canonical pre-review, integrated mutation or contract gate was queued by the leaf.

Retained diagnosis history is honest. `local-first` failed because the test mock lacked `notifyListenerError`. `local-final` first failed because an `act` callback returned and awaited a held Save promise, producing a timeout and cascading failures. `local-complete` then exposed an unflushed retired-store fixture. These harness defects were corrected. `local-second`, `local-frozen` and final `local-final-green` are retained separately. Earlier failed logs were not replaced with green logs.

The new outward witnesses cover:

- Actual withheld Board followed by blank tree, correct origin and verified freshness.
- Held native write, gate absent after switching away, completion while inactive, correct board after returning.
- Held parse, navigate away and return before settlement, second activation refused before any second parse or write.
- Real Board Save hotkey with held native Save, accepted held Add Game parse, navigation away, successful Save completion, return and second activation. The lease continues to withhold the Board and preserves the Save stamp. Companion actual Save controls cover success, conflict, unavailable, unknown-write and typed I/O diagnostics.
- Synchronous duplicate activation, obsolete identity release, newer physical generation admission, and independent actual provider/store owners with two held parses and independent freshness producers.
- Surviving inactive parse failure, unknown stamp/revision, write failure, count failure and durable refusal reach terminal freshness with no permanent loader.
- Actual durable same-ID/file/page physical replacement during successful and rejected parse, write and count preserves replacement storage bytes, tree, origin, metadata and freshness. Actual tab removal and cached-store retirement also suppress obsolete effects and further continuation writes.
- Active controls, active parse-error presentation and retry, current unrelated metadata, stale count retry, and truthful unknown-write behavior.

The existing global persistence reporter still reports a durable workspace refusal. That retained behavior is distinct from Add Game's view notifications. The inactive refusal witness asserts zero obsolete Add Game notifications and exactly the one existing global persistence notification. This report does not claim that global persistence diagnostics are silenced.

`retained-tests.mjs` parsed the launch and frozen test files and compared every previously existing test callback body byte-for-byte. All **96 retained test definitions** are identical: tabs 38, Board 14, gate 44. Added definitions are 3, 14 and 1 respectively, with parameterized definitions expanding to the final test count. `retained-tests.json`, log and exit 0 are retained. The independent evidence check also verifies that existing assertion lines were not removed. No test or assertion was deleted to reduce size.

## Disposable fault proof and integrity

`head.tar` is `git archive` of the actual launch HEAD. `candidate.patch` is the exact binary HEAD-to-worktree delta, including preserved existing work. The disposable candidate was reconstructed from those two artifacts, checked with `git apply --check`, applied, and given only the permitted dependency symlink. Faults were applied only inside that candidate. Main source was never faulted.

Complete frozen manifests cover **519 source/assets/scripts files** and **205 tests**, retained in `source.sha256.json` and `tests.sha256.json`. Each accepted pair retains its unified production-only patch, apply-patch input and log, command JSON, fault source/test manifests, complete test log, same-run exit, semantic diagnosis, exact inverse restoration patch/log, restored manifests and full selected-command log/exit.

There are **34 unique accepted production-only fault/restoration pairs**. Every accepted fault produced a named semantic `FAIL` and `AssertionError`, same-run **exit 1**, with unchanged final tests. Every exact restoration produced the full selected **290-test exit 0**. New focused fault selectors selected real named witnesses. Shared physical authority and retained Save/recovery faults exercised the full command where appropriate. No zero-selected run or unrelated parent failure is accepted as proof.

| Accepted fault | Distinct authority or completion guarantee exposed |
| --- | --- |
| `shared-physical-owner` | Effective physical generation shared by recovery, Save and Add Game |
| `shared-logical-owner` | Logical tab identity |
| `provider-local-lookup` | Live provider-local lookup |
| `shared-durable-refusal` | Durable setter refusal reaches the consumer |
| `synchronous-admission` | Admission precedes parse and blocks duplicate activation |
| `freshness-independent-admission` | Competing Save cannot release pending admission |
| `remount-pending-presentation` | Remounted gate presents the independent pending lease |
| `generation-admission` | New physical generation can admit its own operation |
| `identity-checked-release` | Obsolete completion cannot release that newer lease |
| `independent-store-admission` | Independent provider/store owners do not block one another |
| `inactive-workspace-completion` | Surviving owner completes while its gate is absent |
| `cached-store-owner` | Retired cached store has no completion authority |
| `obsolete-view-notifications` | Old view suppresses its own notification |
| `parse-owner-before-write` | Replacement after parse prevents obsolete native write |
| `write-result-owner` | Replacement during write prevents result publication |
| `count-result-owner` | Replacement during count prevents metadata publication |
| `count-settlement-owner` | Replacement during rejected count prevents freshness/error publication |
| `parse-terminal-state` | Parse failure releases admission and restores terminal presentation |
| `newer-save-freshness` | Parse failure cannot restore stale freshness over newer Save |
| `add-game-origin-durability` | Refused origin commit cannot install blank tree |
| `blank-tree-installation` | Accepted completion installs the actual parsed blank tree |
| `current-file-metadata` | Completion preserves live unrelated file metadata |
| `save-shared-source-owner` | Retained Save source continuation authority |
| `save-first-source-outcome` | Retained fulfilled first-source owner check |
| `save-post-picker-source-outcome` | Retained fulfilled post-picker-source owner check |
| `save-picker-owner` | Retained picker outcome authority |
| `save-destination-owner` | Retained destination outcome authority |
| `save-completion-owner` | Retained database completion owner guard |
| `save-database-dirty` | Retained database content dirty ownership |
| `save-autosave-failure` | Retained current-owner typed autosave failure presentation |
| `save-catch-entry-owner` | Retained late Save catch-entry authority |
| `recovery-reload-rejection` | Retained obsolete reload rejection behavior |
| `recovery-append-rejection` | Retained actual registered append rejection behavior |
| `recovery-append-fulfillment` | Retained obsolete unknown append outcome behavior |

The retained four recovery source-fault categories are adapted truthfully. Their physical fulfilled-reload category is now exercised by the genuinely shared `shared-physical-owner` patch, whose retained log also exposes Save and Add Game physical replacement witnesses. It is counted once. The other three remain distinct. All nine retained Save categories have distinct accepted patches. `generation-admission` and `identity-checked-release` use the same outward scenario but different real mutations and different assertions, admission count versus surviving pending presentation.

One first broad provider-global fault attempt is explicitly **rejected** as accepted proof. It produced the provider semantic failure but also unrelated unhandled held-promise rejections when operations were never admitted. Its artifacts remain intact under `rejected-attempts/provider-global/`, with `run-proof-first.py`, `proof-first.exit`, `fault-pairs-first.json` and the original `proof.log`. The same fault was then run with the real focused provider witness, producing one semantic failed test without unhandled errors, followed by the full 290-test restoration. That accepted rerun is counted once. The rejected attempt is not an extra pair.

`fault-pairs.json` records each accepted patch SHA, faulted source SHA, selected witness, semantic `FAIL` lines and exact exits. Every pair has its own `<name>.semantic.txt`. `proof-resume1.log` records the completed accepted loop. `proof-integrity.json` and `proof.exit` record the final exact restoration.

`verify-evidence.py` independently reconstructed each fault from its retained unified patch, verified unique patch and fault-source hashes, reversed the patch back to the frozen source, checked every test manifest and exact restoration command, and compared final main/candidate/bundle manifests. It also checked retained test assertions, launch-byte `runAction`, HEAD/index, every protected tracked path, prior scratch directory manifests and main `dist`. `evidence-integrity.log` and `.exit` show **exit 0**. All faulted production sources were exactly restored to the intended frozen post-phase source, and every final test stayed unchanged throughout accepted faulting and restoration.

## Single final isolated bundle and blocker

Only after final local and accepted fault proof, `run-bundle.py` reconstructed a separate Git-derived candidate from the same actual HEAD archive and exact binary delta. Source and test manifests matched the frozen candidate before and after building. The main checkout's `dist` was untouched.

| Command or measurement | Result |
| --- | --- |
| `pnpm build-vite` | Exit 0 |
| canonical `pnpm bundle:check` | **Exit 1** |
| actual imported `buildBundleReport` from `scripts/check-bundle-budget.mjs` | Exit 0, measurement retained |
| Entry | 540,396 / 550,000 gzip bytes |
| Largest lazy chunk | 518,065 / 550,000 gzip bytes, `src/routes/index.lazy.tsx` |
| Total | **1,623,428 / 1,620,000 gzip bytes** |
| Total excess | **3,428 gzip bytes** |

Artifacts: `build-vite.log` and `.exit`, `bundle-check.log` and `.exit`, `bundle-measurement.json`, measurement log/exit, `bundle.receipt.json`, and before/after full manifests. `bundle.exit` is 0 because the runner successfully retained the measurement and integrity evidence. It does **not** mean the budget passed. The receipt explicitly records build 0, canonical check 1, measurement 0 and unchanged sources/tests.

The missing premise is the frozen plan's assumed net bundle savings: real shared extraction must offset the emitted cost of the required stable admission subscription and workspace-owned continuation enough to meet the existing total limit. This measured candidate does not satisfy that premise. The artifact proves the net result. It does not establish per-function byte attribution or a savings estimate. There was no threshold change, compression spelling/order manipulation, loading trick, minifier/configuration change or baseline adjustment.

The historical isolated bundles and mutation100 remain historical evidence only. Root-owned current integrated canonical pre-review, mutation, contract, independent review, pixel/native verification and push are pending. Root cannot treat this phase as source-closed or budget-green. The leaf stops at the specified frozen boundary and leaves its six-path delta unstaged for root arbitration. No further design is proposed or implemented here.
```

### Root rejected proof category

```text
# Root proof correction on first tab-action candidate

Root fully read the source phase report after EOS and inspected the actual count operation and its production-only patch. The count-result-owner fault removes the post-count outer ownership guard. The synchronous updateTab callback still checks logical, physical and file/page ownership and returns the previous tab on mismatch. Its recorded failure is only expect(tabs).toBe(replacement.tabs), with equal serialized content. It does not expose publication of the obsolete count or mutation of replacement bytes or content. That observation is an internal array identity change, not accepted outward semantic proof of the count-result guarantee.

Disposition: Fix in this owned source/proof phase. Preserve the initial raw report, patch and diagnosis as rejected evidence for this category. The repaired proof must expose actual obsolete count, workspace bytes, diagnostics or another outward guarantee with final tests unchanged during faulting. An honest composite fault of the real redundant protection is possible. Prefer a source-backed removal of the redundant synchronous inner check if the execution trace proves it unnecessary, then the remaining real post-count guard has an independently meaningful fault. No boundary-specific proof condition, weakened expectation or repeated patch count is allowed.

The other accepted phase witnesses remain subject to root inspection and integrated proof. There is no current34-pair root acceptance claim until this correction closes. Plan authorship and arbitration shared one context. Detection ran on the code model family.
```

### Focused minimalism J3, verbatim

```text
No bloat or duplication findings above the confidence threshold.

The proposed boundary is justified. `FileFreshnessGate.tsx:251` contains domain execution whose completion already depends on captured workspace ownership, independently of React teardown. Moving that operation, its lease and the narrow context into existing `tabs.ts` removes Board’s renderer-module dependency at `BoardAnalysis.tsx:30`. Its single Gate caller has a concrete lifetime and cohesion reason for this boundary.

The smallest sufficient refactor relocates that implementation and leaves a small Gate adapter for translation and view-authorized notifications. Retain the live lease subscription and all ownership checks. No new production file, factory, configurable policy or generic transaction layer is needed. Recovery append should remain separate because its payload, cancellation and persistent uncertainty contracts differ.

`vite.config.ts:37` enables the React compiler preset. A plain domain operation is a legitimate source boundary change, but this inspection establishes neither compressed savings nor per-function byte attribution.

Limitation (confidence: 100): this approves the proposed boundary only. The measured total remains **1,623,428 / 1,620,000**, and the refactored candidate still requires the retained tests, fault evidence and actual bundle check.

Read-only inspection. No files changed or tests run. Detection ran on the author’s model family. Plan authorship and arbitration shared one context.

VERDICT: APPROVED
```

### Focused root-cause J3, verbatim

```text
No root-cause blocker or prior-fix reintroduction found.

The failure chain was mismatched ownership: navigation destroys the gate while the workspace tab survives, and competing Save completion can overwrite freshness before Add Game settles. The independent store/generation lease and workspace continuation address both mechanisms. Inspected faults reproduce lost inactive completion and duplicate admission, with restoration passing 290 tests.

The proposed boundary is appropriate: move Add Game’s domain execution, captured ownership and lease operations into existing `tabs.ts`. Keep subscription, rendering and notification authority in the Gate adapter. Moving the narrow context also removes BoardAnalysis’s renderer-module dependency. Preserve recovery append’s distinct cancellation and uncertainty policy.

Limitation (confidence: 100): `vite.config.ts` enables React Compiler, which supports investigating this component/domain boundary but establishes no compressed savings. The measured candidate remains 3,428 gzip bytes over budget. Approval covers the proposed boundary, not source closure or bundle acceptance.

Read-only review. No files changed or tests run. Detection ran on the code model family, without family separation.

VERDICT: APPROVED
```

Root disposition: Fix the rejected count-result witness and relocate the existing workspace operation and narrow context to tabs.ts, keeping the gate view adapter and lease subscription. Both focused judgments APPROVED this implementation boundary, without approving bundle acceptance. O1-O4 and the final revision3 plan are unchanged. This is proof-fix round1 of the new tab-action phase, with at most one measured final candidate. Initial raw evidence remains intact. No source closure, current mutation acceptance, pixels, native or push claim follows from this record. Plan authorship and arbitration shared one context. Detection ran on the code model family.


## Tab-action source phase, first repair round and final-round boundary

The actual first-round launch and EOS HEAD were `2b843dbb8b9a2041cb7696676353da08c6dfac8f`. Root omitted the promised separate final SHA line from the prompt. The writer independently captured the actual launch HEAD and index, which remained unchanged until EOS. This is a packet omission, not a retroactive approval or an authority change. The next prompt must contain its actual launch SHA before launch.

Root read the full final report, final four-path patch and current production paths. The definitive evidence is `tab-actions-round1/final-proof`, not the superseded first pass. Root inspected all 34 unique final fault patches and meaningful target diagnoses, including physical replacement reload, Save and Add Game. The count fault now publishes 99 instead of 3 and the newer Save fault overwrites `saved` with `original-revision`. All selected 290-test restoration runs pass with unchanged final tests. Existing 96 callback bodies remain unchanged. One additional assertion was strengthened to check revision value before identity. Mechanical evidence reconstruction is separately verified and does not alone establish semantic quality.

Root independently ran 638 tests in 12 suites and 46 parser tests, scoped formatting, lint, type checks, syntax checks, diff checks and a real build. All passed. The canonical bundle check failed. The actual bundle is entry 541018, lazy 517330 and total 1623308 gzip bytes against the unchanged 1620000 limit. The 120-byte reduction is a whole-candidate measurement and is not attributed to a function. Gate `root-tab-actions-round1-preflight.U3RDWV` completed with exit 1 at the actual launch HEAD and has a red resolution. Root intentionally rebuilt main dist after leaf EOS. The leaf's unchanged-dist evidence applies only to its own launch-to-EOS interval.

No current source closure, pixels, native verification, commit of the nine product files or push is established. The two focused J4 judgments below approve only the prospective local consolidation, not bundle sufficiency or cumulative source closure. Root adopts both with Fix. Preserve explicit practice eligibility, literal translations, panel order, InfoPanel Add Game placement, hotkey bindings and special-handler policies. Use Mantine's existing panel style API and one shared centered status shell. Preserve domain operations and all Save, recovery and lease contracts. Do not create a generic framework or change compiler, minifier, loading, budgets or floors.

The next resume is the second and final repair round of this frozen source phase. It uses the sensitive role. Both configured writer rungs currently resolve to gpt-6.1-sol high, so this does not claim a different model or effort. One final isolated candidate build follows local and fault proof. If the bundle remains red, stop this phase under the two-round bound. No third round or renamed successor phase may evade that bound. The project push skill remains root-owned and cannot release known-red source.

Plan authorship and arbitration shared one context. Detection ran on the code model family.

### Raw final round-one writer report

# Tab-action ownership proof-fix round1

The approved lifetime/cohesion relocation and meaningful count proof are implemented. Final local tests, scoped static checks, fault/restoration proof and ownership integrity pass. The round's **single isolated build succeeds**, but canonical `pnpm bundle:check` remains **RED**: **1,623,308 / 1,620,000 gzip bytes**, an excess of **3,308 bytes**. Source closure is blocked. No source change, second design or second build candidate followed that result.

The definitive final proof is under **`final-proof/`**. Top-level candidate, fault logs and manifests are the retained first proof pass, superseded for final-candidate evidence after strengthening one Save witness. They must not be mistaken for the final test freeze or counted as additional unique pairs. This remains one bounded proof-fix round of unchanged O1–O4, not another R5 iteration.

Plan authorship and arbitration shared one context. Detection ran on the Codex code model family. Focused J3 approvals cover the relocation boundary, not bundle acceptance. Root source review, current integrated canonical pre-review/mutation/contract, pixels, native verification, commit and push remain pending. There is no root acceptance claim for either the initial 34 pairs or the current 34 pairs.

## Actual launch, scope and ownership

- Actual Git launch and EOS HEAD: `2b843dbb8b9a2041cb7696676353da08c6dfac8f`.
- Actual index SHA-256 at launch and EOS: `3a2cd68703c41f6819f6d00047d5b9c165c3021d6338afad8f3c2d3e45f4f5ec`.
- `launch-index.txt` and `eos-index.txt` are identical. This leaf never wrote HEAD or index.
- A separate promised launch/freeze packet did not arrive. The launch value was read from Git and snapshotted before source edits. EOS verifies the same actual HEAD and index. No historical SHA was used as launch authority.
- The six owned paths and the three protected peer paths were already dirty at launch. This leaf changed only four of the six owned paths in this round. `src/utils/tabs.test.ts` and `src/components/tabs/FileFreshnessGate.test.tsx` are byte-identical to round launch.
- `final-phase-owned.patch` is the round's exact launch-to-EOS delta: **201 insertions and 174 deletions across four paths**. It is distinct from the cumulative HEAD-to-worktree delta and from the retained first-pass `phase-owned.patch`.
- Every tracked path outside the six-path assignment matches launch, including the three dirty peer paths, records, configuration, budgets, bindings, verifier and driver files.
- The main `dist` was intentionally rebuilt by root after the initial leaf EOS. This round recorded that actual launch `dist`, containing 166 files, and preserved it exactly. It did not compare against the old leaf interval or build into main `dist`.
- All **18** prior scratch-directory manifests match launch: the earlier 17 directories plus `tab-actions-proof`. Dependency symlinks, `node_modules`, `.git` and prohibited `.env` entries are excluded. Earlier reports, raw rejected patches, fault logs, restoration logs and red bundles remain intact.
- No skill, agent, tracked record edit, stage, commit, push, deployment, UI/native verification or external action was performed. `.env` files and full project `CLAUDE.md` were not read. Manual source and scratch script edits used `apply_patch`.

The launch snapshot is `launch.json` with exact owned launch bytes in `starting/`. The copied final-proof launch snapshot retains the same original launch, not a later invented baseline.

Protected peer SHA-256 values at launch and EOS:

| Path | SHA-256 |
| --- | --- |
| `src/state/store/tree.ts` | `b36532534443a1d44fb4fb49c5638cd782fb801b113c5072c6f86f022d549300` |
| `src/state/store/tree.test.ts` | `7031b80f89e000ab83e2775f95c1326cf4fd438c530edd7cc1e4a0b6c3e1203e` |
| `src/utils/chess.ts` | `07ea714be999ba44c80b8b451f4df8fef96eb6c4a9a6431a68dfc585bf468906` |

Final owned hashes are retained in `final-proof/frozen-owned.sha256.json`:

| Path | SHA-256 |
| --- | --- |
| `src/utils/tabs.ts` | `dbc3f069798dc4c31d87eb32f62b8357a8be4d8925b3d88aa124cb6494c3fbfc` |
| `src/utils/tabs.test.ts` | `52c3c6ba9bbae33843d91174dd6ad29cfe3551c80e7ddb2eb384900b8e0a787e` |
| `src/components/boards/BoardAnalysis.tsx` | `4b06d3d77740c2ad9af83ab6d9d5e5c14aa369cdf2fe61f5fa0bc89ab5a7309f` |
| `src/components/boards/BoardAnalysis.test.tsx` | `4f17eb413330d5a6d213fe5c219a36bdc2b31b051fd0cc7f6bcb97943a9d7aea` |
| `src/components/tabs/FileFreshnessGate.tsx` | `3cbe4ea58ab2accd63046bc78cec90f1ee2d1d0d36b6a0c823ed6ffd0d8ca849` |
| `src/components/tabs/FileFreshnessGate.test.tsx` | `5550a5f0fd53480f4ded1ee943aa6cff651f989b40e3eb0698cf37e33c72f45c` |

## Source mechanism and preserved contracts

`tabs.ts` now owns the existing Add Game narrow context, captured ownership predicate, transient cached-store/generation lease operations, and plain asynchronous `appendBlankGame` operation. The operation accepts the existing provider-local live lookup and durable update callbacks, cached tree store, localized messages and a reporting callback. Localized messages are presentation data, not a configurable operation policy. No module, factory, generic transaction layer or persisted state was added.

`FileFreshnessGate` retains the small view adapter. It subscribes with `useSyncExternalStore`, reflects the live lease independently of mutable freshness, translates existing messages, and gates notifications using its existing view ref. The domain operation checks workspace ownership before reporting. Workspace continuation does not depend on the gate mounting or on recovery cancellation. `BoardAnalysis` imports the narrow context from its existing `tabs.ts` dependency, eliminating the renderer-to-Gate context dependency. Its button, dirty confirmation, ordinary Save, save continuation and notification contract are unchanged.

Admission remains synchronous before parsing, store-specific and captured-generation-specific. Identity-checked release cannot clear a newer lease. A surviving inactive workspace owner completes. Removed, physically replaced or retired-store owners publish nothing and start no obsolete continuation write. Competing Save may publish freshness without releasing Add Game admission. Parse failure restores only its own exact claim. Save stamp, revision and diagnostics remain preserved. Unknown native outcomes, count/write failures and origin durability refusal settle truthfully. Successful blank-tree installation preserves current unrelated metadata.

The shared provider-local hook and common logical/effective-physical comparison from O1/O2 are retained. Save still composes its stricter origin contract. File/page, legacy effective-key fallback, cached-store, replacement, discard and durability policies remain intact.

All existing `tabs.ts` implementations from `type StagedAdmissionResult` to EOF are byte-identical to round launch. This covers tab creation/replacement, snapshot/discard admission and the complete Save implementation with its physical-generation, source-null, source reads, picker/destination, database dirty, typed catch, unknown-write, metadata and origin behavior. The entire Gate suffix from `runAction` to EOF is also byte-identical. Recovery reload, Save As New Game payload, persistent `appendAttempted`, uncertainty retry prohibition, registered-handler error propagation and actual native cancellation are retained exactly. No diagnostic, wording, configuration, compiler directive, load split, minifier option or budget was changed.

## Synchronous count trace and repaired witness

The redundant count callback check was removed after tracing the real path:

1. The native count promise resolves, then `appendBlankGame` checks captured ownership.
2. `useTabActions.updateTab` immediately calls `updateTabById`.
3. `updateTabById` calls the provider's `useSetAtom(tabsAtom)` setter. Installed `jotai/react.js` returns `store.set.apply(...)` directly.
4. The `tabsAtom` write handler synchronously reads the current workspace and invokes `update(workspace.tabs)`. `tabs.map` immediately invokes the matching tab callback.
5. `commitWorkspaceAtom` and `saveWorkspace` validate and serialize that result, call synchronous storage, then publish the acknowledged workspace.

There is no await or asynchronous gap between the outer post-count owner check and the callback invocation. The outer check is the real asynchronous publication barrier. The inner callback's duplicate logical/physical/file/page check was redundant. Removing it is an implementation simplification, not a proof-specific branch. The durable setter still exposes refusal.

The real replacement helper now asserts replacement origin content before its existing array-identity assertion. The final `count-result-owner` patch removes only the genuine post-count barrier. Its retained diagnosis is:

```text
FAIL ... composed durable physical-only replacement silences obsolete Add Game count-success
AssertionError: expected ... to deeply equal ...
- "numGames": 3
+ "numGames": 99
```

This is actual obsolete replacement metadata publication through the real provider and durable workspace path. It is not an equal-content array-reference change. Existing workspace-byte, tree-byte, freshness, metadata and notification assertions remain in place. `count-settlement-owner` separately exposes verified replacement freshness being changed to unverified after a rejected obsolete count.

## Reads and historical rejection

Read all six named rule files completely, the full initial REPORT, root count rejection, complete focused minimalism and root-cause J3 reports, entire latest tracked handoff and the real frozen revision3 body. The initial prompt and approved revision3 contract remain binding. Exact named decisions and relevant synchronous workspace/Jotai execution were read. The six sources/tests match their prior EOS before this round, and their previously completed integration reads remain applicable. The configured React compiler in `vite.config.ts` was inspected read-only. Its existence provides no per-function compressed-byte attribution or savings promise.

Root's initial integrated evidence, 638 tests in 12 suites plus 46 parser tests and green static/build checks with red total 1,623,428, remains historical evidence for that candidate. This leaf did not rerun or claim those current integrated gates.

The initial `tab-actions-proof/count-result-owner` patch and identity-only failure are retained exactly and remain **root-rejected**. The original report's claimed acceptance is historical, not a current root acceptance. The earlier rejected broad provider-global attempt also remains intact under the initial proof directory. Neither rejected artifact is counted in this round's final pairs.

During this round's first full fault pass, diagnosis inspection found the newer-Save freshness witness also failed first on object identity. The underlying production fault restores an old revision. An additional revision-value assertion was added before the retained identity/content checks, after every first-pass source had been exactly restored. A fresh final Git-derived candidate was then reconstructed, final tests were frozen, and **all 34 categories were rerun**. No test changed during either candidate's faulting. The first pass and its raw logs/manifests are preserved at the report's parent directory. Its pairs are superseded as final-candidate evidence and are not counted again.

The final newer-Save diagnosis now reports `Expected: "saved"`, `Received: "original-revision"`. It exposes a lost Save revision value. No retained test, assertion, diagnostic or guard was deleted or weakened.

## Final local and fault proof

Exact selected command for final local, disposable baseline and every restoration:

```sh
pnpm test src/utils/tabs.test.ts src/components/boards/BoardAnalysis.test.tsx src/components/tabs/FileFreshnessGate.test.tsx src/components/tabs/TreeRecoveryGate.test.tsx src/components/panels/info/InfoPanel.test.tsx src/state/atoms.lifecycle.test.ts
```

`final-proof/local-final.log` and `.exit`: **six files, 290 tests passed, exit 0**. Scoped six-file `oxfmt --check` and `oxlint --deny-warnings`, `tsgo --noEmit`, and `git diff --check` all exit 0. Exact commands and separate logs/exits are retained in final-proof scripts and artifacts. The initial relocation also passed the same 290 tests and static checks, retained separately. No heavy canonical gate was queued.

All O1–O4 composed real Board/Gate/provider/cached-store witnesses are retained: withholding and blank completion, absent-gate completion, remount during held parse, synchronous duplicate admission, actual ordinary Save hotkey overlap, Save failure/status diagnostics, generation/release, independent owners, inactive terminal outcomes, actual durable physical replacement and removal at parse/write/count, byte and metadata preservation, active controls, obsolete-view silence, count retry and truthful uncertainty. The inherited global persistence refusal notification remains distinct from the silenced obsolete Add Game view notification.

AST comparison in `final-proof/retained-tests.mjs` and `.json` verifies all **96 original callback bodies byte-identical**. Of the **114 callback definitions at round launch**, **113 are byte-identical and one is strengthened only by the added revision assertion**. There are no deleted definitions or added definitions in this round. The replacement-origin assertion strengthens the existing helper without changing those callback bodies.

`final-proof/head.tar` archives the actual launch HEAD. `candidate.patch` is the exact binary HEAD-to-worktree delta, including preserved peer work. Both the disposable fault candidate and the separate bundle candidate were reconstructed from those artifacts with `git apply --check` and `git apply`. Only the permitted dependency symlink was added. Faults were applied only in the disposable candidate with `apply_patch`, never in main source.

Complete manifests cover **519 production/source/assets/scripts files** and **205 test files**. Every final pair retains its production-only patch, apply input/log, exact command JSON with timing and same-run exit, faulted source/test manifests, full test log and semantic diagnosis, exact inverse restoration/log, restored manifests and full selected-command log/exit.

There are **34 unique final production-only pairs**, counted once. All have a named semantic `FAIL`, `AssertionError` and same-run **exit 1**, with unchanged final tests. Every exact restoration passes the **full 290-test command, exit 0**. No empty selector, unrelated parent failure, or equal-content identity-only diagnosis is accepted as final evidence. Integrity checking is not an independent endorsement of semantic quality. The writer inspected the retained diagnoses, and root owns final semantic acceptance.

| Final fault | Meaningful guarantee or witness |
| --- | --- |
| `shared-physical-owner` | Real physical replacement affects shared recovery, Save and Add Game authority |
| `shared-logical-owner` | Logical identity comparison result |
| `provider-local-lookup` | Actual provider-local tab data, not default-store data |
| `shared-durable-refusal` | Refused durable update result remains observable |
| `synchronous-admission` | Two parses become admitted if acquisition is delayed |
| `freshness-independent-admission` | Competing Save causes a second parse if freshness governs admission |
| `remount-pending-presentation` | Verified Save status incorrectly exposes the pending Board |
| `generation-admission` | A newer generation is incorrectly prevented from parsing |
| `identity-checked-release` | Obsolete release exposes a still-pending newer Board |
| `independent-store-admission` | Shared singleton admission breaks independent owner presentation |
| `inactive-workspace-completion` | A surviving inactive owner fails to receive the appended origin |
| `cached-store-owner` | Retired store starts an obsolete native append |
| `obsolete-view-notifications` | An absent Gate emits an obsolete operation notification |
| `parse-owner-before-write` | Physically replaced owner starts an obsolete native append |
| `write-result-owner` | Replacement tree content is overwritten by obsolete blank completion |
| `count-result-owner` | Replacement `numGames` changes from 3 to obsolete 99 |
| `count-settlement-owner` | Replacement verified freshness becomes unverified |
| `parse-terminal-state` | Parse failure leaves appending instead of terminal presentation |
| `newer-save-freshness` | Saved revision becomes the captured original revision |
| `add-game-origin-durability` | Refused durable origin incorrectly installs verified blank completion |
| `blank-tree-installation` | Blank tree and returned stamp fail to install |
| `current-file-metadata` | Live file metadata is replaced by old metadata |
| `save-shared-source-owner` | Retained stale source continuation changes replacement diagnostics |
| `save-first-source-outcome` | Retained first-source outcome permits obsolete continuation |
| `save-post-picker-source-outcome` | Retained second-source outcome permits another source operation |
| `save-picker-owner` | Retained obsolete picker result continues destination work |
| `save-destination-owner` | Retained obsolete destination result starts native write |
| `save-completion-owner` | Retained database owner completion resets newer content dirty state |
| `save-database-dirty` | Retained database save marks newer edited content clean |
| `save-autosave-failure` | Retained current-owner typed autosave failure disappears |
| `save-catch-entry-owner` | Retained obsolete Save rejection changes replacement freshness |
| `recovery-reload-rejection` | Retained obsolete reload rejection marks replacement unavailable |
| `recovery-append-rejection` | Retained registered rejection alters persistent uncertainty state |
| `recovery-append-fulfillment` | Retained obsolete unknown outcome publishes an incorrect recovery panel |

The inactive-completion fault now uses the actual admission's live subscriber count to wrongly tie completion to a mounted view. No view authority was added to production for faulting. Relocated domain faults target `tabs.ts` and select their real Board witnesses. Gate view and recovery faults remain in the Gate. The shared physical guard is counted once even though it covers the prior physical reload category plus Save/Add Game. All nine prior Save categories and the other three recovery categories remain distinct. The final 34 are not added to the first pass's 34 or historical initial pairs.

`final-proof/fault-pairs.json` records exact unique patch hashes, fault-source hashes, selected witnesses, named failure lines and exits. `proof-integrity.json` and `proof.exit` are green. `verify-evidence.py` independently reconstructs each patch, reverses it, verifies full manifests and all full restoration commands, explicitly checks count 3 versus 99 and saved versus original revision diagnoses, and compares main, disposable and bundle copies. It also verifies retained assertions, byte-identical pre-existing tab utility implementations and recovery suffix, HEAD/index, protected peers, prior artifacts and main `dist`. `evidence-integrity.exit` is **0**. This is integrity evidence, with root semantic acceptance still pending.

## One isolated build, measured blocker and EOS

Only after final local and all final fault/restoration proof completed, a separate isolated Git-derived bundle candidate was built once. Main source and final tests remained frozen and source/test manifests match before and after the build.

| Final command or measurement | Actual result |
| --- | --- |
| `pnpm build-vite` | Exit 0 |
| canonical `pnpm bundle:check` | **Exit 1** |
| imported actual `buildBundleReport` from `scripts/check-bundle-budget.mjs` | Exit 0 |
| Entry | **541,018 / 550,000** gzip bytes |
| Largest lazy | **517,330 / 550,000** gzip bytes, `src/routes/index.lazy.tsx` |
| Total | **1,623,308 / 1,620,000** gzip bytes |
| Excess | **3,308** gzip bytes |

The exact build, check and measurement commands, timing, complete logs, same-run exits, actual report, receipt and source/test manifests are in `final-proof/`. `bundle.exit` is 0 because the runner successfully retained all measurement and integrity evidence. It does **not** mean the budget passed. The receipt explicitly records build 0, canonical check 1, measurement 0 and unchanged sources/tests.

The missing premise is that the approved component/domain relocation alone provides enough net emitted-byte reduction while preserving the required operation, lease subscription, context and view adapter. The source now has that plain domain boundary, but the actual unchanged total limit still fails. Configured React Compiler evidence justified inspecting the boundary and never established compressed savings or per-function attribution. This artifact measures only the complete candidate. No estimate, spelling/order manipulation, loading trick, compiler directive, minifier/configuration change or baseline adjustment was used.

The first red bundle and every earlier red artifact remain intact. There was exactly one build in this round, after the final proof freeze. No source or design iteration followed it. The verified owned delta remains unstaged with the protected peer work unchanged. Root must arbitrate the red budget premise before current integrated gates and source closure can be claimed. Pixels, native behavior, commit and push remain separate root-owned stages.

### Raw focused minimalism J4 judgment

No new bloat or duplication defect in the proposed consolidation. These are genuine repetitions with concrete existing consumers.

The smallest sufficient boundaries are:

- `BoardAnalysis.tsx:232` — share heading rendering across the five headings. Centralize panel flex/overflow policy through the existing `Tabs.styles.panel` API, which the installed Mantine `TabsPanel` consumes. Keep heading and panel ordering explicit, including conditional practice and `InfoPanel`’s Add Game callback. No panel wrapper or generic tab framework is needed.
- `BoardAnalysis.tsx:149` — one local annotation dispatch can own the practice-rating guard for all six bindings. Ordinary panel bindings can share tuple-to-handler mapping. Keep the repertoire-only practice handler and report handler explicit because they perform different transitions.
- `FileFreshnessGate.tsx:373` — choose the appending, unverified or overdue content inside one centered Stack. This removes two duplicate layout shells without introducing a status component or changing recovery actions.

Retain the plain workspace operation, independent lease subscription and distinct Save/recovery policies. Their ownership contracts justify their boundaries. No new production file, configurable factory or operation rewrite is warranted. Preserve all 114 callback definitions and 34 meaningful fault categories.

Limitation (confidence: 100): this approves only the proposed implementation boundary. The recorded bundle remains **1,623,308 / 1,620,000 gzip bytes**. No savings sufficient to eliminate the 3,308-byte excess are established.

Read-only inspection. No files changed or tests run. Detection ran on the code model family. Plan authorship and arbitration shared one context.

VERDICT: APPROVED

### Raw focused root-cause J4 judgment

No root-cause blocker or prior-fix reintroduction found.

The original mechanism was mismatched lifetime and authority: navigation removes the gate while its workspace survives, and competing Save can replace freshness during pending Add Game. `tabs.ts:144` preserves workspace completion through captured ownership and an independent generation-aware lease. Inspected final faults expose lost inactive completion, duplicate parsing, obsolete count publication and overwritten Save revision. Their restorations pass.

The three proposed consolidations are legitimate repetitions. The simplest boundary stays local:

- Board tab/panel presentation helpers, retaining explicit practice eligibility, literal translations, existing ordering and InfoPanel’s Add Game slot.
- Shared annotation dispatch with the existing practice-rating guard, plus ordinary panel-selection bindings. Keep special hotkey policies explicit.
- One centered Gate status shell around the existing branch contents.

These changes need no workspace-operation rewrite. Preserve the independent lease subscription, recovery policies and all retained proof obligations.

Limitation (confidence: 100): consolidation does not establish sufficient compressed savings. The measured candidate remains **1,623,308 / 1,620,000 bytes**. Approval covers this prospective implementation boundary only. The final candidate still requires measurement and regression proof.

Read-only review. No files changed or tests run. Detection ran on the code model family. Plan authorship and arbitration shared one context.

VERDICT: APPROVED
