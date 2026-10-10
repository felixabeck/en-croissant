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
