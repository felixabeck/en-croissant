# Path registry and engine attachment ownership — review record

Status: implementation and final-review repairs committed; all eleven final lenses triaged. Final exact-tree gates, real-app verification and push are pending.

Mandate: next-finding full-auto run for f-20260830-35 and f-20260901-13 (`unbounded-path-registry`), including necessary player-owner schema correction f-20260906-14. Original upstream base: `9330ef47`.

Plan authorship and arbitration shared the root Codex context. Detection ran on the same Codex model family as the code, in separate sessions; this is not model-family-independent review. Lenses were assigned read-only through native Codex subagents, not a claimed kernel sandbox.

The next-finding skill selected the root-cause cluster. Build supplied reviewed planning, phased implementation and delivery; execute-large-plan supplied subsystem ownership and checkpoint discipline. The push/verify-ui contracts govern final checks and real-app evidence.

# Round 1 arbitration

Plan authorship and arbitration shared the root context. Detection used the same Codex model family planned for implementation; independence is session-level.

## First six reports

- correctness REVISE: blocker confidence 99, plan:35. Adopt native monotone retain before renderer persistence, retirement only after successful storage. Prevent re-adoption crash deleting kept image or losing resource authority.
- plan REVISE: blocker 98 same crash ordering (adopt, duplicate); blocker 99 plan:59 missing AddEngine.test.tsx (adopt); blocker 97 plan:78 generic verify:app does not exercise lifecycle (adopt real fixture/harness scope).
- root-cause REVISE: blocker 96 plan:59 excludes EditEngine.tsx captured object-identity submit sibling (adopt component and test scope); blocker 93 plan:31 restart cleanup before re-adoption (adopt, same crash ordering).
- tauri-security REVISE: blocker 97 plan:33 teardown/restart cleanup lacks persistence fence (adopt same prepare-before-write ordering, fail-closed cleanup).
- tests REVISE: blocker 99 plan:78 real shutdown fixture missing (adopt); blocker 98 plan:31 tolerant zod fallback/filter treated valid (adopt strict non-lossy hydration eligibility and explicit failure cases); should-fix 97 plan:73 bound test must count reader bytes max ceiling+1 (adopt); should-fix 96 plan:29 validation needs disk/memory before-after assertions (adopt); should-fix 94 plan:35 preserve resolving quota report d-20260901-16 (adopt).
- minimalism REVISE: should-fix 94 plan:33 remove session retirement map (skip). Existing native descriptors protect already-open operations only; unsynced tabEngineSettingsFamily and playersFamily retain PathRefs for future commands. Revocation would change functioning existing consumers. Session retention is the bounded shared runtime owner, avoiding invasive per-component ownership tracking. should-fix 91 plan:21 remove generic non-root dedup (adopt). Root purpose reuse plus attachment retirement solve selected mandate without changing every promotion; existing narrow exact file reuse stays.

## Remaining five reports

- code-quality APPROVED: should-fix 94 ambiguous legacy fourth state (adopt explicit owned alias/startup ID set); should-fix 91 ambiguous bound record classes (adopt explicit unique-ID union accounting).
- error-handling APPROVED: should-fix 96 deletion success then registry failure leaves ENOENT loop (adopt idempotent absence and substituted-leaf outcomes); should-fix 91 preserve native typed failure category rather than generic quota wrapping (adopt).
- ipc-contract APPROVED: no findings.
- persisted-state REVISE: blocker 97 tolerant hydration repair becomes destructive ownership snapshot (adopt explicit coordinator raw trust provenance; duplicate of tests issue).
- engine-protocol REVISE: blocker 99 persisted game-player settings are additional durable owners (adopt both keys into serialized retention union). Root verified atoms:460-469, OpponentForm:20, playerConfig:21. Found human-default schema loses engine-player fields; immediately filed f-20260906-14. The domain schema is necessary for this owner integration, not an unrelated design expansion.

Nineteen findings adopted counting independent duplicate reports; one skipped with evidence; no deferred report. All eleven reports arrived before the plan revision. Round 2 reruns plan and all ten revision-driving lens classes (ipc-contract alone did not drive a revision). No source implementation yet; only findings ledger has the new identified schema defect.

# Round 2 arbitration

Plan authorship and arbitration share root context; reviewers and planned implementation use the same Codex family in separate sessions.

- persisted-state REVISE: blocker 96 plan:33, raw JSON player settings are unbounded domain records. Adopt shared compressed writes plus legacy JSON reads for both player keys, not a blanket preference-store conversion; same reported non-throwing receipt contract already applies. This removes divergent codecs in the new shared coordinator.
- tests APPROVED: should-fix 91 plan:29 explicit oversized action ResourceLimit/no mutation test (adopt); should-fix 90 plan:31 delayed startup vs newly issued provisional test (adopt); should-fix 94 plan:41 cleanup failure must not skip engine/game/sound teardown and aggregate failure (adopt).
- tauri-security APPROVED: no findings; round-1 persistence fence resolved.

- plan REVISE: blocker 98 plan:87, no unconditional production startup trigger and direct-IPC harness cannot prove it. Adopt App.tsx/useAppStartup integration plus App.test.tsx. Extend isolated real-app fixture to prove startup reconciliation/cleanup without direct reconciliation for that assertion, separately from command/shutdown proof.
- error-handling APPROVED: no findings; idempotent cleanup, typed errors and correlated receipts resolved its prior issues.

- correctness APPROVED: no findings.
- minimalism APPROVED: no findings; shared coordinator/draft helper/harness serve identified multiple consumers.
- engine-protocol REVISE: blocker 96 plan:43 immutable JSON target ID (adopt); should-fix 93 saved game selection after permanent engine retirement (Defer f-20260906-15). Source and d-20260901-17 confirm a separate pre-existing selection reconciliation contract. Preserving attachment authority is not a promise to make a deleted engine executable ID runnable.
- code-quality APPROVED: should-fix 91 explicit abandoned payload (adopt optional retained snapshot in reconcile with abandon-only mode); should-fix 90 native registry snapshot terminology (adopt); should-fix 95 replace A in engine-list only, not all global owners (adopt).
- root-cause REVISE: blocker 98 a hard cap alone leaves other persistent grants ownerless (adopt startup owner reclamation across production purposes); blocker 96 persistent-file operation-vector equality repeats root identity mechanism (adopt closed semantic EntryPurpose for roots/files). Two bounded Luna/xhigh source probes mapped native and renderer owners; main verified critical paths. Existing database deletion already prunes (the original report is partly historical); puzzle deletion does not, and its exact missing prune is annotated on f-20260830-35.

Round complete before revision. Eleven adopted findings, one Defer, no Skip. New broad owner mapping changes startup/native semantics, so round 3 runs six revision-driving lenses (plan, root-cause, tests, persisted-state, engine-protocol, code-quality) plus correctness and tauri-security over that new boundary. IPC/minimalism/error-handling retain prior approvals for their unchanged contracts, and return in the cumulative-diff pass.

# Round 3 arbitration

Plan authorship/arbitration share root context. Detection and implementation use the same Codex family in separate sessions.

- persisted-state REVISE: blocker 100 collector omits download-destination-capability. Adopt that durable key and DownloadDestination-family trust/read-failure coverage. Main verified atoms:142 and AccountCard:205.
- root-cause REVISE: blocker 99 same missing download destination owner (adopt independent duplicate).
- plan REVISE: blocker 99 same owner omission (adopt independent duplicate); should-fix 100 wrong typed-error decision reference (adopt d-20260904-05).
- code-quality REVISE: blocker 100 wrong d-20260904-13 citation (adopt d-20260904-05; root classifies this as a reference defect, not a new architecture choice); should-fix 91 ambiguous successful commit for startup family (adopt precise successful native registry-sweep commit marks family completed; failed commits leave retry eligibility).
- engine-protocol APPROVED: no findings.

The source mapping probe missed the persisted download destination; the lens source trace corrected it before implementation. Main read both decision entries: d-20260904-05 is the typed ErrorPayload wire contract; -13 is only cluster slicing. Correct the citation, never edit either recorded decision.

- tests REVISE: blockers 96 positive legacy purpose backfill (adopt); 98 measured single-ID refresh (adopt); 95 missing legacy lifecycle state maps to owned (adopt); 94 owned/provisional abandon guard (adopt invariant, specify owned is an unchanged successful no-op rather than unnecessary rejection); should-fix 93 failed startup commit retry (adopt pre-replacement unchanged test plus truthful post-replacement uncertainty case).
- correctness REVISE: blocker 99 download-destination owner (adopt duplicate); blocker 97 absent engines key makes first-save quota orphans permanent (adopt confirmed absence as empty ownership, distinct from raw read/decode/repair failure, still union player owners).
- tauri-security REVISE: blocker 99 missing download-destination owner (adopt duplicate).

All eight reports arrived before revision. Fourteen findings adopted, no Defer or Skip. Five independent missing-owner reports are counted individually. Round 4 scopes to plan, root-cause, persisted-state, code-quality, tests, correctness and tauri-security; engine-protocol keeps its approval.

# Round 4 arbitration

Plan authorship/arbitration share root context; detection and planned implementation share Codex family in separate sessions.

- plan APPROVED: no findings.
- root-cause APPROVED: no findings; true reclamation, owner coverage, absence distinction, commit ordering, semantic migration and all exit paths satisfy mandate.
- correctness APPROVED: no findings.
- tauri-security APPROVED: no findings.
- code-quality APPROVED: no findings; citation and commit wording corrected.
- tests APPROVED: should-fix 94 observable simultaneous/remounted shared startup and reconciliation-failure splash closure (Fix, adopted explicit App tests).
- persisted-state REVISE: blocker 96 unknown saved download ID reused after registry loss (Defer f-20260906-16). This fails identically before the planned GC because no registry mapping exists. The mandate preserves known ownership; recovery/re-selection of already-lost native authority is a separate design across AccountCard/native validity, not permission to broaden this change. Source verified and complete finding filed immediately. Unknown retained IDs stay harmless no-ops for registry reclamation.

Counts: one adopted finding, one Defer, no Skip. Seven reports received before revision. Round 5 only plan/tests because that adopted test assertion changes acceptance. All other applicable lens concerns are approved or explicitly deferred with evidence; no unresolved adopted blocker.

# Round 5 convergence

Plan and tests lenses APPROVED with no findings. The explicit simultaneous/remount shared-startup and failure-report/splash-teardown acceptance assertions resolved round 4. Earlier unchanged scoped approvals carried forward. Adopted findings by round: 19, 11, 14, 1, 0 (independent duplicate reports counted separately).

# Implementation integration

Phase 1: `4494070f`, Codex Sol/medium worker, root-reviewed and verified. One formal same-worker continuation corrected Clippy and actual ReadPgn-only download purpose/reuse semantics. Exact root proofs: 131 path-authority tests, 17 puzzle tests, 11 focused renderer tests, 253 related frontend tests, TypeScript; narrow fmt/check/Clippy/contract/bindings/script-syntax/diff checks passed.

Phase 2: committed as `739db8db`. Renderer ran on Sol/medium; following explicit file relinquishment, native attachment admission/cleanup ran on Luna/xhigh. The user explicitly authorized Luna Extra High for additional models. Root owned arbitration, bindings integration, gates and Git; no silent executor fallback occurred.

Renderer first handoff passed 63 focused and 257 related tests plus TypeScript. Root integration required formal continuation1 for outstanding draft failure/queued-write cases, adoption-before-close ordering, the explicit shared-player owner roundtrip, complete seed-process teardown, and the newly identified edit producer loss f-20260906-18. Green test commands were not treated as satisfying absent acceptance cases.

Native first handoff passed 141 path-authority, 16 engine-image and 10 shutdown tests plus formatting/Clippy. Root's complete native diff read required formal continuation1: sealing must cover issuance/reissue, and a prepare retry after durability uncertainty must establish a real durable fence rather than return unchanged success. The continuation also fills explicit validation, legacy-state and cleanup-bound acceptance evidence.

Renderer continuation1: root independently reran 74 focused tests and 268 related tests, TypeScript, node syntax and diff checks. The contract gate first caught three lifecycle lint warnings; the same worker repaired them without suppressions, and root repeated the exact frontend proofs plus the complete contract gate successfully. Root made two small integration edits: remove an unused type import and scope verify-app log assertions to bytes written by the asserted session, excluding seed-session teardown evidence.

Native continuation1: root independently passed 150 path-authority, 16 engine-image and 10 shutdown tests plus fmt/check/Clippy, bindings export/check, TypeScript and diff checks. Root read the full continuation delta; pending-durability retries now force a durable snapshot, and image/resource issuance consults shutdown sealing before registry mutation or dialog consumption. Evidence: `root-native-proof.log` and its exit-0 sentinel in the run scratch directory.

# Final cumulative review — selection record

Recomputed path triggers selected eleven lenses: correctness, root-cause, code-quality, tests, error-handling, minimalism, tauri-security, IPC-contract, persisted-state, engine-protocol, PGN-index. PGN-index is additive for the changed puzzle database path. Their completed triage follows below.

Routing amendment: Felix explicitly authorized Luna lenses and sessions in this conversation for latency/token efficiency, following his earlier Luna Extra High instruction. The upcoming final lenses use fresh Luna/xhigh contexts under that user override. Existing running workers are not restarted solely to switch models.

The effective pushed range also includes foreign Codex commits `6bb9e542` (canonical findings sync) and `da22cf9d` (push gate wording), both inspected by root. Findings are attributed by origin below; neither commit is excluded from review.

# Adjacent findings

- Fix: f-20260906-13 canonical breadcrumb diagnostics, committed as `59a109db`. Guarded-sync from committed agent-kit `4eb4ff6`; root parity, atomic-write tests and actual consumer missing-helper/canonical-helper failure probes pass. The ledger carries the evidence.
- Fix: f-20260906-17 EditEngine literal validation errors, committed separately as `5e8912e7`. Shared validation uses existing locale keys; a distinct object with the same immutable ID keeps its own name. Root passed 25 focused and 27 related tests, TypeScript and the complete contract gate. The same commit makes a deleted-target edit return an unsuccessful correlated receipt, so EngineForm cannot falsely adopt an attachment absent from every owner record.
- Fix: f-20260906-18 ordinary EngineForm metadata edits erase existing scalar/resource options, corrected in `739db8db`. Ordinary submissions preserve existing settings; current binary detection alone applies required defaults. Root verified actual-form scalar/resource submission and stale detection regressions.
- Defer: f-20260906-15 permanently retired engine game selection, separate design under d-20260901-17. Handoff: `tasks/handoffs/2026-09-06-retired-game-selection.md`.
- Defer: f-20260906-16 already-missing saved download capability recovery. Handoff: `tasks/handoffs/2026-09-06-download-destination-recovery.md`.

# Final cumulative review — complete triage

# Final cumulative review triage

Range: 9330ef47..5b51fa6a. Root plan authorship and arbitration share context. Detection is same Codex family, separate sessions. Native tool hit its thread limit after four fresh lenses; remaining lenses use the canonical detached read-only Codex launcher at normal=Luna/xhigh under the explicit user rung override. No executor switch.

## IPC-contract — APPROVED

No findings. Detached report and terminal marker verified.

## Tests — REVISE

- Fix (test improvement, not evidence that all absence handling is untested): blocker99 engineOwnerStorage.test.ts:73 quota-failed first add→fresh-startup reclaim sequence. pathOwners.test.ts already proves engines absence plus a valid player retains engines-family trust; that rebuts the lens blanket mutation claim, but the complete sequence deserves the explicit acceptance anchor. Annotated f-20260901-13.
- Fix: should-fix99 EnginesPage.test.tsx:12 real resource file/directory picker wiring, append/replacement and cleanup lacks page-level coverage. Annotated f-20260901-13.
- Skip (false positive / canonical producer ownership): should-fix98 scripts/findings.py:302 missing breadcrumb tests. Canonical agent-kit tests/test_findings.py:1121-1317 covers missing helpers, error cause, oversized stderr, OS failure, actual canonical helper failure and durable ledger mutation. Root read these tests and ran python3 -m pytest -q tests/test_findings.py -k breadcrumb -rs:14 passed,1 skipped,77 deselected. Skip is only chmod-unwritable test under root; missing-helper/canonical-helper probes also independently passed against actual ChessFable consumer. Required byte parity gate binds consumer to tested producer; copying the producer test suite into each consumer is not needed.

## Tauri-security — REVISE

- Defer (existing separate design f-20260905-10): blocker99 path_authority.rs:1209 app-data ancestor symlink during default-root bootstrap. Root reread f10 and d-20260905-02/-07; replacing AppDataDir pathname bootstrap with a descriptor-backed producer is the separately recorded design, not settled by attachment GC. Preserve record/decision; provide handoff.
- Fix: blocker96 path_authority.rs:3556 selected database-root swap before create_new and pathname cleanup. Root confirmed full function and filed f-20260906-19. Selected-root consumer can use existing checked-root descriptor/identity semantics; adjacent correction gets its own commit.

## Correctness — REVISE

- Fix: blocker99 path_authority.rs:3696 startup fixed4096 input bound blocks full legacy owner snapshots; independently duplicates root finding already annotated on f-20260830-35.
- Fix: blocker99 path_authority.rs:3812 attachment fixed4096 input bound blocks shrinking legacy owner saves; same shared request-bound/admission fix.
- Defer (existing non-Linux support design f-20260830-06): should-fix99 path_authority.rs:5703 Windows directory resources resolve without file/target. Root verified Windows tail and the existing unsupported-target compile/SDK evidence and pending product-support decision. Extend that porting assignment rather than adding unverified Windows-only behavior inside this Linux registry run; keep existing park unchanged and provide handoff.

## Root-cause — REVISE

- Fix: blocker94 main.rs:1133 active image copy can outlive seal/cleanup. Track its complete blocking lifetime and drain outside the authority mutex within the shutdown budget. Annotated f13.
- Fix: should-fix88 path_authority.rs:3750 startup prune retry falsely treats an unchanged adopted candidate as durable. Share truthful pending durability retry, annotated f35.

## Minimalism — REVISE

- Fix: should-fix98 pathOwners.ts:226 duplicate three-owner raw reads and attachment walkers. One capture derives both snapshots; shared typed walk.
- Fix: should-fix95 atoms.ts:180 unused enginesStorage adapter and createEngineOwnerStringStorage. Remove; migrate live regression value to coordinator tests.
- Fix: should-fix91 path_authority.rs:3980 duplicated admission accounting/serialization. Shared current/candidate calculation preserving old lifecycle metadata baseline.
- Fix: nit96 engineAttachments.ts:11 one-caller abandon wrapper duplicates empty check. Remove.
- Fix: nit91 main.rs:1454 test-only shutdown_backend wrapper. Test production generic function directly.

## Code-quality — REVISE

- Fix: blocker97 path_authority.rs:35 MAX_PERSISTENT_IDS misleading union-budget name. Rename accurately; severity is maintainability rather than actual release failure alone.
- Fix: blocker99 path_authority.rs:3696 unnamed trusted-family input32 limit. Name it.
- Fix: should-fix93 path_authority.rs:925 None versus Some([]) semantics. Document.
- Fix: should-fix96 path_authority.rs:1597 provisional comment excludes current issuance. Correct.
- Skip (false-positive assertion claim): should-fix99 verify-app.mjs:420 check(true) follows closeApplicationThroughTitlebar, whose :67 throws if the captured application process is absent BEFORE closing. This is a success report after an enforced prerequisite, not an untested condition. No additional equivalent assertion needed.
- Fix: nit97 engineFormValidation.ts:1 indent consistent with engine-component siblings; no broad reformat.

## PGN/index — REVISE

- Defer: blocker100 db/mod.rs:614 per-file import transactions, origin cbdf2a09. Existing f-20260831-07 plus companion import/invalidation design, annotated. This is a separate import atomicity/outcome design, not attachment work.
- Skip (false positive): should-fix98 db/mod.rs:489 trailing variation resets mainline final position. Root read san/begin_variation/end_variation: san advances the root frame to e4, variation pushes a SEPARATE child starting pre-e4, end pops the child then copies the still-post-e4 root frame. The reported root-reset does not occur.
- Defer: should-fix96 db/search.rs:478 uncancellable worker, origins a22bbdf4/a5f81f5d. Existing f-20260904-05 operation token/generation owner design, annotated.

## Engine-protocol — REVISE

- Defer: blocker98 EvalListener.tsx:153-166 live event lacks settings/request generation, origins3afed0317/ba42a3905. Existing f-20260903-01/f-20260831-09 event identity design, annotated.
- Skip (settled shutdown contract, no new failure evidence): blocker97 main.rs:1512/1886 unconditional process exit after budget. f-20260830-51 explicitly requires unconditional exit outside timeout to avoid a windowless hang and records concurrent teardown/seal/drain repair; d-20260901-18 bounds post-kill reap with a stated D-state residual. The lens restates the chosen bounded-failure tail without evidence defeating those protections. Keep reported timeout as failure; do not claim guaranteed reap after timeout.
- Defer: should-fix95 EnginesSelect.tsx:17-25 retired selection remains. Existing f-20260906-15/d-20260901-17 handoff covers the same selection design.
- Fix: should-fix98 engineOwnerStorage.ts:216-221 valid defaultable legacy engines disappear due to strict hydration equality. Separate raw deletion trust from safe legacy display/migration with durable stable identity. Annotated f13.

## Error-handling — REVISE

- Fix: blocker98 puzzle.rs:511 landed deletion plus registry failure leaves UI stale. Typed applied-despite-error and UI convergence, annotated f35.
- Skip (overstated permanent-orphan claim; required acceptance test is Fix): blocker97 engineOwnerStorage.ts:112 Prepare+storage failure conservatively retains native owned attachment for session; abandonment must not revoke possibly owned IDs. Loaded candidate plus trusted empty next startup is explicitly designed reclamation. Add complete failed-first-add/restart proof (tests lens) rather than unsafe rollback/revoke after uncertainty.
- Fix: should-fix93 engineOwnerStorage.ts:114 generic storage wrapper discards useful quota cause at notification. Preserve safe normalized cause locally.
- Fix: should-fix94 main.rs:1522 timeout log omits attachments. Include actual fourth teardown.

## Persisted-state — REVISE

The final detached report completed after a long active source/decision trace, with no executor failure. All11 reports are now complete; source unfrozen for disjoint repairs.

- Skip (false positive against the published base): blocker98 atoms.ts:194 claims this diff changes engines/engines.json to engines. Root git show9330ef47:src/state/atoms.ts:194 proves the prior reader and writer already use localStorage engines. Do not invent a filesystem legacy-path migration from that incorrect comparison.
- Fix: blocker99 OpponentForm.tsx:35 target branches retain fields from prior type, so strict owner saves reject. Exact branch construction and two-direction durable tests; annotated f-20260906-14.
- Fix: blocker98 ReportModal.tsx:16 unvalidated report-settings lacks goMode. Existing f-20260901-09; loaded preference producer/consumer repair, no report operation lifecycle expansion.
- Fix: blocker97 state/utils.ts:35 corrupt-value repair writes unguarded, and initial reads unguarded. New f-20260906-20, preference failure handling package.
- Fix: blocker98 BoardsPage.tsx:88 close path bypasses transition. Root verified b829b562 historical close protection, current close/select/cycle lack it while other handlers retain it. New f-20260906-21; consistent transition boundary plus real suspension test.
- Defer (separate durable workspace lifecycle design): blocker96 atoms.ts:110 close deletes tree before workspace envelope durability. New f-20260906-22; pair with creation counterpart f-20260901-05. The adapter swallows failure, so merely reordering lines does not establish commit acknowledgment. Define lifecycle receipt and rollback first in its own build.
- Defer (separate practice capacity/retention design): blocker95 atoms.ts:731 unbounded practice positions/history raw JSON. New f-20260906-23. Preserve user repertoire and learning history; no arbitrary truncation cap disguised as an implementation correction.
- Defer (same workspace lifecycle design above): should-fix99 tabs.ts:64 seed-before-envelope. Existing f-20260901-05; revalidate to build with the newly confirmed close-side failure and shared receipt/rollback question.
- Defer (separate expansion-cache retention policy): should-fix91 atoms.ts:115 unbounded raw expanded-directory IDs. New f-20260906-24; disposable UI cache retention differs from user practice history and tab trees. Generic error repair is not a capacity solution.
- Fix: should-fix94 Puzzles.tsx:114 destructive persisted selection clearing. New f-20260906-25; derived current-list-valid selection, A-B-A restoration, stale loading guard, explicit deletion still clears its own stored choice.

Root's subsequent visual trace also found missing EngineForm filename-error propagation through actual FileInput. Fix under f17; add actual container-rendered error screenshot and no-issuance assertion.

# Final repair verification

- `3de47fe2` and `c0016006`: preference/report hydration, translated safe storage causes, identity-only engine migration, single-pass startup collection, exact opponent branch transitions and real resource-picker regressions. Root retained 137 focused tests and 317 related tests, TypeScript and full lint:ci green. Two failed lint attempts were resolved before commit: locale-key canonical order, and unused internal schema-message strings rejected by the JSX language guard.
- `806005f1`: root read the complete native repair, including shared pre-mutation admission, registry durability retry and blocking issuance leases. Root exact proof passed 154 authority, 16 engine-image, 11 shutdown, 15 blocking-offload and 17 puzzle tests; fmt/check/clippy, regenerated bindings/check, TypeScript and diff check passed. Root added the explicit still-pending assertion after async issuer cancellation. Specta variant documentation generated trailing whitespace; the same contract moved to enum-level documentation and was regenerated, not hand-edited.
- `c0f4b341`: puzzle selection/deletion lifecycle. Root reviewed the full production/test diff; 13 direct and 22 related renderer tests plus 17 native puzzle tests passed. A concurrent different database request survives settlement of an earlier deletion. Saved selection survives workspace A/B/A and unavailable listings.
- `88c1b7bb`: tab transitions share one active-tab handler; close awaits native teardown and preserves the tab on failure. Root read both complete files and passed 7 direct React Suspense tests, 14 related tests, scoped lint/format/diff checks and TypeScript. This does not claim durable workspace-close acknowledgment; that remains f-20260906-22.
- Actual Add Engine / Local form: root added a container Playwright check for both visible name/path errors and zero native issuance calls. The first run failed only because the new screenshot baseline did not exist; root inspected the container-produced image, then the unchanged-baseline rerun passed (1 test). No existing screenshot baseline was changed. Full-suite and real-app verification follow after final source integration.
- Decisions `d-20260906-12` and `d-20260906-13` record identity-only legacy owner migration with raw-value conflict protection, and truthful ordinary-preference failure handling. They extend existing contracts; no Felix-attributed decision was reversed.
- Full coverage preview passed 101 files / 764 tests, then correctly rejected two new utilities outside the closed area mapping. Decision `d-20260906-14` places the engine draft with engine consumers and the persisted player schema with state. The source/test/import-only move and exact coverage rerun are an integration fix; no floor, baseline, include/exclude or gate is relaxed. The database-create race f-20260906-19 remains the final isolated native correction before full gates.

Review provenance remains unchanged: plan authorship and arbitration shared the root context;
detection ran in separate sessions on the same Codex model family as the code. Final lenses are
complete and are not rerun as a second fan-out; root reviews each repair and its exact proof.

## Final integration at 2026-09-06 19:24 UTC

- `086deaf1` moves the engine draft/test and persisted opponent schema to their domain owners, with byte-identical implementation and import-only consumer edits. Full frontend coverage passed 101 files / 764 tests and the unchanged area floors and ratchets. The full container screenshot suite passed all nine tests, including the new actual local-engine validation screenshot; no existing baseline changed.
- `6422009f` closes f-20260906-19 with retained-descriptor exclusive database creation, sealed identity registration and identified cleanup. Root read all production and test changes, then reran 159 path-authority tests, 55 filesystem tests (one existing ignored), fmt, all-target check, Clippy and diff check successfully. Substituted roots/leaves remain untouched and uncertain registry commits preserve the created file. Decision d-20260906-15 records the boundary and reversal path.
- Final lens counts are 42 reported findings: 26 Fix, 6 Skip and 10 Defer (duplicate reports count separately). Every Fix is implemented and narrowly verified. Additional root integration fixes cover actual filename-error propagation and domain coverage placement. The ten distinct deferred areas have permanent handoffs and remain outside this run's separate design mandate.
- Source implementation is frozen. Full exact-tree gates and actual-product acceptance are still required; the earlier coverage and screenshot proofs are previews, not final clean-tree receipts.
