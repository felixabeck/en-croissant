# Path registry and engine attachment ownership — review record

Status: implementation committed; final cumulative review, full gates and push are not yet complete.

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

# Final cumulative review

Pending. Recomputed path triggers select eleven lenses: correctness, root-cause, code-quality, tests, error-handling, minimalism, tauri-security, IPC-contract, persisted-state, engine-protocol, PGN-index. PGN-index is additive for the changed puzzle database path.

Routing amendment: Felix explicitly authorized Luna lenses and sessions in this conversation for latency/token efficiency, following his earlier Luna Extra High instruction. The upcoming final lenses use fresh Luna/xhigh contexts under that user override. Existing running workers are not restarted solely to switch models.

The effective pushed range also includes foreign Codex commits `6bb9e542` (canonical findings sync) and `da22cf9d` (push gate wording), both inspected by root. Findings will be attributed by origin; neither commit is excluded from review.

# Adjacent findings

- Fix: f-20260906-13 canonical breadcrumb diagnostics, committed as `59a109db`. Guarded-sync from committed agent-kit `4eb4ff6`; root parity, atomic-write tests and actual consumer missing-helper/canonical-helper failure probes pass. The ledger carries the evidence.
- Fix: f-20260906-17 EditEngine literal validation errors, committed separately as `5e8912e7`. Shared validation uses existing locale keys; a distinct object with the same immutable ID keeps its own name. Root passed 25 focused and 27 related tests, TypeScript and the complete contract gate. The same commit makes a deleted-target edit return an unsuccessful correlated receipt, so EngineForm cannot falsely adopt an attachment absent from every owner record.
- Fix: f-20260906-18 ordinary EngineForm metadata edits erase existing scalar/resource options, corrected in `739db8db`. Ordinary submissions preserve existing settings; current binary detection alone applies required defaults. Root verified actual-form scalar/resource submission and stale detection regressions.
- Defer: f-20260906-15 permanently retired engine game selection, separate design under d-20260901-17. Handoff: `tasks/handoffs/2026-09-06-retired-game-selection.md`.
- Defer: f-20260906-16 already-missing saved download capability recovery. Handoff: `tasks/handoffs/2026-09-06-download-destination-recovery.md`.
