# Drain push recovery, 2026-10-23

## Ownership and delivery boundary

Felix requested autonomous Codex recovery until the drain push lands. The original drain stopped at startup bundle 555155 gzip bytes against 555000. A schema replacement worsened it to 555195 and was reverted. The branch retained two unpushed records commits and 37 uncommitted engine-phase paths. Kit parity, destination identity and current remote CI were verified and were not the original blocker.

This recovery owns that interrupted engine phase and its required repairs, proof and delivery. The reviewed plan expressly makes Phase 1 independently green and committable. Account Phase 2 is not implemented by this recovery, and f-20261005-05 remains open. No broader finding closure is claimed.

Plan authorship and arbitration shared one context. Detection ran on the same OpenAI model family as the code. Sensitive writes resolve to Codex gpt-6.1-sol/high, diff lenses to gpt-6.1-sol/medium. Fresh launcher sessions provide context separation, with no model-family separation. Root owns integration, gates, commits and push.

## Inherited plan history

The full original plan-review history, raw rounds 1 and 2, is preserved in 2026-10-23-f-20261005-05-plan-review.md beside this file. Round 1 adopted two issues, I1 successive upgrade ordering and I2 exact retirement replay. Round 2 closed both. Round 3 refreshed the unchanged obligations from published base 879f1b47 to 53730fc2. All twelve refresh lenses approved or correctly stopped as not applicable. No obligation was invalidated, and no new finding was adopted. Plan adoptions are r1=2 r2=0 r3=0. Measured round wall times were 381.095, 205.999 and 94.846 seconds. Supported active model wall is unknown. Raw round-3 reports follow below.

## Engine phase and bundle repair

Commit 111d212d contains the interrupted phase plus demand-loading of signed catalog document and signature assets. Signature verification and strict persisted-owner validation remain intact. No budget or floor was lowered. The inherited coverage metadata adds the extracted engineInstall.ts source to the existing area without changing numeric baselines or floors.

The phase production build measured entry 552845, largest lazy 480023, total 1639477 gzip bytes against 555000, 550000 and 1640000. Exact related Vitest passed 148 files and 3827 tests. Six native reload_completion tests passed. Pre-review passed all selected lanes, including GNU Windows clippy and both mutation packages at 100 percent. Storage killed 1233 mutants. Tree-path killed 169 and timed out seven, with no surviving or uncovered mutants.

Root independently reran the related renderer tests and six native tests, with canonical phase-root-proof completion 0 at launch b97dc019 plus the identical owned source. Removing only the production owner-envelope hydration hunk, keeping tests unchanged, failed three replacement-document upgrade cases at exit 1. Exact source restoration passed all four boundary cases at exit 0. An earlier offset-bearing extraction was excluded from proof. Evidence is indexed by /tmp/reload-phase1-proof/handoff.md and hydration.patch, replay-reverted.log/.exit and restored.log/.exit.

A release build at clean 111d212d passed. It is preparatory browser evidence, not final gates. Browser, real running-download reload, integrated repair proof, final gates, push, hosted confirmation and installation remain pending at this checkpoint.

## Integrated repair checkpoint

Source repair c7032f5a captures the terminal response before emission and reuses Error.renderer_payload for retained failures. Cancellation and safe HTTP/engine guidance survive unchanged. The completion owner reports and weak-marks the same error before acknowledgement. Storage reports and returns its own marked object, preserving ordinary-save and hydration reporting without duplicate completion/component notifications. A dependent AddPuzzle fixture preserves actual error-helper exports. The real-app verifier shares the canonical pure owner-envelope decoder, with both EP storage assertions and messages unchanged.

Root independently passed 168 renderer files with 4121 tests, ten native reload_completion tests and the exact retirement race in integrated-final.euMPiQ. That aggregate attempt was stopped at exit 143 after Windows clippy rejected two explicit Arc dereferences in archive fixtures. Both expressions were corrected without changing assertions or production behavior, and standalone Windows clippy passed. The separate earlier integrated-repair.YhQQwn attempt also remains 143, after test type/lint failures that were subsequently repaired. Neither interrupted aggregate is green evidence.

Canonical pre-review-retry.l7D0X0 completed 0 on the final repair tree. All selected lanes passed, including the Windows target, types, lint, formatting, both coverage mappings and bundle. Mutation took 1001.9 seconds and both selected packages passed. Current bundle measures entry 552932, largest lazy 479993 and total 1639516 gzip bytes, with all original ceilings unchanged. This supersedes the earlier phase-only sizes for the repaired candidate.

Six renderer Git-hunk controls failed at exit 1 and restored green at exit 0, with unchanged tests and exact no-offset restoration. They cover report-before-acknowledgement, duplicate notifications, persistence reporting ownership, payload preservation, missing-record failure and the subscription gap. Evidence prefixes are renderer-observation-order-* under /tmp/chessfable-drain-recovery-20261023. The event-first component measured two notifications before and one after. Three native controls failed at exit 101 and restored green at 0, covering acknowledgement-before-command-response, otherwise collectible capability retention and catalog retention. Their exact restoration and patches are indexed in native-counterfactual-evidence.json.

The retirement fixture defect was filed immediately as f-20261023-01 and is now closed with its 101-before, 0-after witness. It queues retirement before replacement admission while retaining the registration barrier and every original refusal/termination/admission assertion. Broader f-20261005-05 stays open for account Phase 2. Root integration observations also repaired the verifier's old array-only consumer, test type/lint failures and duplicate/error-observation ownership within C2/E1. These are disclosed dependencies, not additional lens adoptions or original plan credit.

Real running-download proof, closure review, final browser verification, clean final gates, push, hosted confirmation and installation remain pending at this checkpoint. The expanded scratch runtime probe was never executed and is not evidence. A compact five-assertion probe uses the existing real driver to cover only the missing running-event boundary. Upgrade/repeat correctness remains with the actual renderer/native suites and their source-hunk controls. Setup/cleanup diagnostic staging gaps will be named with runtime results.

Plan authorship and arbitration shared one context. Detection ran on the same model family as the code. Root owns final verification and delivery.

## Round 1 arbitration

Reviewed through 111d212d against c4da644f. All thirteen required sessions completed. Raw reports are preserved below. Fifteen prefixed findings were adopted as Fix. No Skip or Defer was used.

- C1 cancellation becomes a save failure. Fix through the existing safe failure payload and cancellation contract.
- C2 an acknowledged failed result becomes false success for another caller. Fix by preserving the supplied terminal failure when its mailbox record is absent.
- I1 completion event acknowledgement can remove the result before command response construction. Fix by capturing the terminal response before emission.
- E1 retained failures discard safe HTTP and engine failure information and report an engine-list save problem. Fix by sharing normal IPC safe payload construction with retained errors.
- T1 real running engine reload and completion-event proof is absent. Fix with actual WebKitGTK and signed native work using the existing driver, plus behavior assertions that fail when the production completion path is removed. Mocked browser evidence is not native proof.
- T2 fresh handles and catalog_protected make the retention assertion non-discriminating. Fix with otherwise collectible native resources and production-guard reversal proof.
- T3 the subscription-gap test emits only after initialization. Fix by completing during subscription setup and proving ordering reversal fails.
- M1 pending termination observation is duplicated. Extract the shared observation while preserving capture and retry policy.
- M2 optional archive progress retains behavior with no production caller. Require the production workflow lease and adapt native tests.
- Q1 name the retained configuration budget.
- Q2 name the renderer receipt bound and document its native relationship.
- Q3 remove the newly introduced unexplained helper suppressions through concrete domain inputs, preserving ownership visibility.
- L1 close already-repaired f-20261022-08. Root reran both witnesses successfully and closed it through the ledger writer in e5ec74f7.
- L2 supersede the removed-profile and outstanding-rerun assumption in f-20261022-07. Annotated in c7f9534e while retaining the intermittent failure and open status.
- L3 add explicit Proof commands for both merged entries. The f-20261022-07 unchanged failure/replay pair is not presented as a source-fix regression.

Native, renderer and engine-process source repairs have disjoint owners. A separate worker prepares scratch real-app choreography only. Root performs the actual browser verification. The three source packages run focused proofs, then root regenerates bindings and runs one integrated pre-review check before closure review. Root never commits another worker's unrelated files.


## Inherited plan refresh round 3: lens-chess-semantics-r3

```text
NOT APPLICABLE: The plan and overlapping drift concern download ownership and recovery, with no in-memory chess tree, position identity, move path, or rule changes.

Inspected `src-tauri/src/fs.rs` changes in `archive_staging_authority_four_stalled_streams_leave_gateway_available` and `production_download_core_matrix_keeps_success_and_error_tails_after_caller_drop`. The timeout and `OperationRegistry::wait_for_drain` changes do not affect chess semantics. O1–O4 and phase proofs: no obligation invalidated within this lens.

VERDICT: APPROVED
```

## Inherited plan refresh round 3: lens-correctness-r3

```text
No correctness findings.

Inspected `src-tauri/src/fs.rs`:
- `archive_staging_authority_four_stalled_streams_leave_gateway_available` preserves correct-byte completion before stream release.
- `production_download_core_matrix_keeps_success_and_error_tails_after_caller_drop` uses `OperationRegistry::wait_for_drain`, which observes lease release after workflow cleanup. Success/failure and disk assertions remain intact.

No obligation invalidated. O1’s drain contract and O4’s receiver-drop proof remain consistent. O2/O3 production paths are unchanged.

Limitation: static review only, no tests executed. Confidence: 95. No files changed.

VERDICT: APPROVED
```

## Inherited plan refresh round 3: lens-engine-protocol-r3

```text
NOT APPLICABLE: Compared O1–O4 and the planned files with the drift. Inspected `src-tauri/src/fs.rs` symbols `archive_staging_authority_four_stalled_streams_leave_gateway_available` and `production_download_core_matrix_keeps_success_and_error_tails_after_caller_drop`. Their test synchronization changes affect no engine process, UCI ordering or asynchronous engine-result routing. No obligation invalidated, including O1’s accepted-tail ownership and O4’s receiver-drop proof. O2 and O3 production paths are unchanged.

VERDICT: APPROVED
```

## Inherited plan refresh round 3: lens-error-handling-r3

```text
No error-handling defects found.

Inspected changes in `src-tauri/src/fs.rs`:

- `archive_staging_authority_four_stalled_streams_leave_gateway_available` still rejects timeout, gateway errors and incorrect bytes before stream release. Cleanup precedes assertion.
- `production_download_core_matrix_keeps_success_and_error_tails_after_caller_drop` propagates worker/registry errors, rejects drain timeout and retains terminal-state and disk assertions.

Traced `OperationRegistry::wait_for_drain` and native completion ownership. No obligation invalidated. O1 and O4 remain valid, and O2/O3 production paths are unchanged.

Read-only review. No tests run or files changed.

VERDICT: APPROVED
```

## Inherited plan refresh round 3: lens-ipc-contract-r3

```text
NOT APPLICABLE: The plan-overlapping drift changes only test synchronization in `src-tauri/src/fs.rs`: the gateway `probe` timeout and caller-drop test’s `OperationRegistry::wait_for_drain` call. Neither changes an IPC event, payload, command, listener lifetime or capability.

No obligation invalidated: O1’s accepted-tail ownership and O4’s receiver-drop proof remain intact. O2 and O3 production paths are unchanged.

VERDICT: APPROVED
```

## Inherited plan refresh round 3: lens-minimalism-r3

```text
No bloat or duplication findings.

Inspected `src-tauri/src/fs.rs` changes to `archive_staging_authority_four_stalled_streams_leave_gateway_available` and `production_download_core_matrix_keeps_success_and_error_tails_after_caller_drop`, plus existing `OperationRegistry::wait_for_drain` in `src-tauri/src/infra/operations.rs`. The drift reuses native drain notification without adding files or abstractions. Ordering, terminal-state and disk assertions remain.

No obligation invalidated. O1’s accepted-tail drain and O4’s receiver-drop proof remain required. O2, O3 and phase proofs are unaffected.

Read-only review. No tests run or files changed. Review and code authorship share the OpenAI model family.

VERDICT: APPROVED
```

## Inherited plan refresh round 3: lens-persisted-state-r3

```text
NOT APPLICABLE: Plan-overlapping drift in `src-tauri/src/fs.rs` changes only test calls to `BLOCKING_GATEWAY.spawn` and `OperationRegistry::wait_for_drain`. No renderer storage encoding, keys, hydration, atom families or tab lifecycle changed. O1–O4 and phase proofs: no obligation invalidated within this lens.

VERDICT: APPROVED
```

## Inherited plan refresh round 3: lens-pgn-index-r3

```text
NOT APPLICABLE: The plan includes account PGN imports, but this drift changes only test synchronization within the overlapping scope.

Inspected `src-tauri/src/fs.rs` symbols `archive_staging_authority_four_stalled_streams_leave_gateway_available` and `production_download_core_matrix_keeps_success_and_error_tails_after_caller_drop`. Neither changes PGN scanning, indexing, encoding, storage or search. No obligation invalidated, including O1’s accepted-tail drain and O4’s receiver-drop proof. O2 and O3 remain unchanged.

VERDICT: APPROVED
```

## Inherited plan refresh round 3: lens-plan-r3

```text
No findings. No obligation invalidated.

Inspected both changed symbols in `src-tauri/src/fs.rs`:

- `archive_staging_authority_four_stalled_streams_leave_gateway_available` at line 6045 retains the correct-byte assertion before stream release at line 6104.
- `production_download_core_matrix_keeps_success_and_error_tails_after_caller_drop` at line 9296 retains caller abort, both terminal outcomes and disk assertions at line 9372. Its new wait uses `OperationRegistry::wait_for_drain` at `src-tauri/src/infra/operations.rs:774`. Lease release still follows workflow completion at line 979.

O1’s ownership premise, O4’s receiver-drop proof and phase proofs remain valid. O2/O3 production paths are unchanged. No changed premise reopens I1 or I2. Confidence: 97.

Limitation: source review only, no runtime tests or fault staging performed. No files changed. Review used the same OpenAI model family as the recorded plan reviews.

VERDICT: APPROVED
```

## Inherited plan refresh round 3: lens-platform-semantics-r3

```text
No platform-semantics findings. No obligation invalidated.

Inspected the changed symbols in `src-tauri/src/fs.rs`:

- `archive_staging_authority_four_stalled_streams_leave_gateway_available:6091` retains correct-byte completion before stream release.
- `production_download_core_matrix_keeps_success_and_error_tails_after_caller_drop:9361` uses `OperationRegistry::wait_for_drain` on a blocking worker. Its mutex/condition-variable synchronization has no platform-specific branches, and terminal-state and disk assertions remain.

O1’s accepted-tail ownership and O4’s receiver-drop proof remain valid. O2 and O3 are unaffected. No phase proof is invalidated.

Read-only review. No tests, `pnpm rust:windows:check`, or non-Linux Unix source probe ran here. Windows/macOS runtime proof remains required from `rust-windows-test` and `rust-macos-test`, with compilation and linting covered by the `rust-platform` matrix. Approval concerns the plan refresh, not completed runtime verification.

VERDICT: APPROVED
```

## Inherited plan refresh round 3: lens-tauri-security-r3

```text
NOT APPLICABLE: Plan-overlapping drift changes only test synchronization in `src-tauri/src/fs.rs`, in `archive_staging_authority_four_stalled_streams_leave_gateway_available` and `production_download_core_matrix_keeps_success_and_error_tails_after_caller_drop`. No credential, filesystem-authority, artifact-verification or renderer-data boundary changes.

O1’s drain obligation and O4’s receiver-drop proof remain intact. O2 and O3 production paths are unchanged. Within this lens, no obligation invalidated.

VERDICT: APPROVED
```

## Inherited plan refresh round 3: lens-tests-r3

```text
Inspected `src-tauri/src/fs.rs` symbols `archive_staging_authority_four_stalled_streams_leave_gateway_available` and `production_download_core_matrix_keeps_success_and_error_tails_after_caller_drop`, plus `OperationRegistry::wait_for_drain`.

No obligation invalidated. O1/O4 retain concrete failure assertions: correct probe bytes must arrive before stream release, and caller-drop completion must produce the expected terminal state and disk outcome. Removing native ownership would fail those terminal assertions even if drain returned successfully. Both tests remain reachable through the unfiltered native gate. O2/O3 are unaffected.

Read-only inspection only. No tests rerun or files changed.

VERDICT: APPROVED
```

## Recovery cumulative diff round 1: lens-chess-semantics-r1

```text
NOT APPLICABLE: The cumulative diff changes engine installation, upgrade completion, owner persistence and process retirement. It changes no in-memory chess tree, position identity, move path, parity, variation selection or tree metadata handling.

VERDICT: APPROVED
```

## Recovery cumulative diff round 1: lens-code-quality-r1

```text
[blocker] src-tauri/src/fs.rs:1824 — The new `256 * 1024` configuration limit controls whether installation succeeds but has no named constant. Neighboring limits use names such as `MAX_ARCHIVE_PATH_BYTES`. Name this retained-configuration budget so its purpose is visible without tracing the workflow. (confidence: 99)

[blocker] src/state/engineOwnerStorage.ts:28 — The bare `128` controls receipt validation and persistence refusal. Its relationship to native `MAX_ACCEPTED_OPERATIONS` in `src-tauri/src/infra/operations.rs:25` is undocumented. Give the renderer limit a name and explain that relationship. (confidence: 98)

[blocker] src-tauri/src/fs.rs:1744 — The new workflow core suppresses `clippy::too_many_arguments` without documenting a library-boundary reason. Another unexplained suppression appears at `src-tauri/src/infra/operations.rs:766`. These are internal helpers whose argument structure remains under project control. (confidence: 99)

Review was read-only. Detection and implementation share the OpenAI model family, with no family separation.

VERDICT: REVISE
```

## Recovery cumulative diff round 1: lens-correctness-r1

```text
[blocker] src/state/engineCompletions.ts:88 — A successfully cancelled transfer produces a retained failure with category `"cancellation"`, but this branch replaces its message with `Engines.SaveError`. Both `errorUnlessCancelled` and `cancelDownloadJob` recognize cancellation by the exact message `"Cancellation"`. Consequently, a successful Cancel is reported as a save failure and the cancellation promise rejects instead of returning its cancellation outcome. Preserve the existing cancellation contract when reconstructing retained failures. (confidence: 99)

[blocker] src/state/engineCompletions.ts:74 — An absent native record is treated as successful application even when the supplied completion failed. For example, the completion event can process and acknowledge a network failure before the original install command’s already-captured response reaches its caller. When that caller subsequently invokes `applyEngineCompletion`, this branch resolves successfully. `AddEngine` then sets `installedThisSession` despite no engine being registered. Acknowledged failure must retain its failure result for concurrent callers. (confidence: 91)

Limitation: source-only review. Native scheduling and browser behavior were not executed, so runtime confirmation of the second interleaving remains outstanding. Review and implementation share the OpenAI model family.

VERDICT: REVISE
```

## Recovery cumulative diff round 1: lens-engine-protocol-r1

```text
No in-scope defects found in retirement replay, process ownership, UCI sequencing or result routing.

Read-only source review. No files changed or runtime checks run. Reviewer and implementation share the OpenAI model family, with no family separation.

VERDICT: APPROVED
```

## Recovery cumulative diff round 1: lens-error-handling-r1

```text
[should-fix] src/state/engineCompletions.ts:88 — Every retained native failure without a root label becomes “The engine list could not be saved.” A network failure or UCI timeout therefore reports a storage problem before any owner write occurs. `CompletionFailure` also drops the existing safe HTTP rejection details and engine failure snapshot, preventing the notification surface from presenting their guidance. Preserve the safe typed failure payload through completion retention and replay (confidence: 99).

Limitations: Read-only source review, no runtime probes or gates executed. Author and reviewer share the OpenAI model family, and plan authorship and arbitration share the root context.

VERDICT: APPROVED
```

## Recovery cumulative diff round 1: lens-ipc-contract-r1

```text
[should-fix] src-tauri/src/fs.rs:1679 — Rust emits `CompletionChanged` before constructing the install command response. The renderer listener in `src/state/engineCompletions.ts:208` can apply and acknowledge that completion, removing the record this lookup needs. If acknowledgement wins, `installEngineWorkflow` rejects with “completion is unavailable” after installation succeeded, so Add/Upgrade displays a false failure. Return a captured terminal snapshot instead of rereading the removable mailbox entry. (confidence: 92)

Review was read-only and used the implementation’s model family. No gates were run.

VERDICT: APPROVED
```

## Recovery cumulative diff round 1: lens-minimalism-r1

```text
[should-fix] src-tauri/src/engine/process.rs:2886 — `resume_binary_retirement` adds a second copy of the pending-termination observation in `drain_matching` at line 3032. Both await `PendingTermination`, attach the same actor key/generation and collect `ActorShutdownFailure`. Extract that observation into one shared unit while retaining the distinct capture, retry and drain policies. This removes roughly 10–15 duplicated lines without changing retirement semantics. (confidence: 95)

[should-fix] src-tauri/src/fs.rs:1497 — The optional progress contract has no production caller exercising `None`. The sole production caller supplies `Some(progress)`, while the new 30-line test wrapper preserves the removed archive command’s standalone progress behavior. Require a progress lease, remove the fallback and standalone-success branches, and adapt archive tests to the current workflow contract. Approximately 45–55 lines of compatibility scaffolding are removable. (confidence: 91)

Added-file minimum-diff counterfactuals:

- `infra/completions.rs`: retain the concrete request, result and retained application types.
- `infra/reload_completion_tests.rs`: retain the mailbox, receiver-loss and retirement boundary tests.
- `state/catalogEngineCompletion.ts`: retain the shared Add/Upgrade adapter and pending-state hook.
- `state/engineCompletions.ts`: retain the single replay/application coordinator.
- `state/engineCompletions.test.ts`: retain the owner-boundary and replacement-document cases.
- `utils/engineInstall.ts`: retain the native request construction used by the catalog adapter.

No additional substantive deletion is established for those six files. Findings concern implementation commit `111d212d`. Review was read-only, with no gates run or files changed. Detection shares the implementation’s model family.

VERDICT: REVISE
```

## Recovery cumulative diff round 1: lens-persisted-state-r1

```text
No in-scope defects found. Traced envelope encoding, legacy hydration, receipt retention/pruning and replay guards across all three owner keys.

Read-only source review. No files changed or gates run. Reviewer and implementation share the same model family.

VERDICT: APPROVED
```

## Recovery cumulative diff round 1: lens-platform-semantics-r1

```text
No concrete platform-semantics defects found in `c4da644f..111d212d`. Reviewed native completion ownership, registration, retirement, connected platform branches and test helpers. No files changed or gates run.

Evidence limits:

- Supplied logs show `pnpm rust:windows:check` passed. This proves compilation and linting only.
- No non-Linux Unix source-probe result was supplied.
- Runtime proof remains with CI’s `rust-windows-test` and `rust-macos-test`. `rust-platform` covers target compilation.
- The actual install-to-UCI regression is Unix-only, so it provides no Windows workflow runtime coverage.

Review used the same model family as implementation and arbitration, without family separation.

VERDICT: APPROVED
```

## Recovery cumulative diff round 1: lens-records-r1

```text
[should-fix] tasks/findings.md:17975 — f-20261022-08 remains open although commit `31f9132a` repaired both test witnesses before this range. Existing entries at lines 14606 and 16351 record the repair and regression proof. Close this finding with that evidence and supersede its release-blocking claim. (confidence: 100)

[should-fix] tasks/findings.md:17969 — The next step assumes a retained profile and outstanding rerun. The harness deleted the profile, and canonical `gate-real-app-retry.AdWjYi` completed successfully. The handoff records all 145 real-app assertions passing unchanged. Preserve the timeout observation but update the investigation state. (confidence: 100)

[should-fix] tasks/findings.md:17963 — Both newly merged findings lack the `**Proof:**` command required by the supplied findings-ledger contract’s minimum body. Historical failure logs do not specify the required before/after verification command. (confidence: 99)

VERDICT: REVISE
```

## Recovery cumulative diff round 1: lens-root-cause-r1

```text
No root-cause or prior-fix regression findings.

The original failure was a native download surviving its renderer continuation. This diff retains native outcomes, commits owner values with atomic replay receipts, excludes overlapping upgrades by UUID, and retains original retirement generations. Both Add and Upgrade use that mechanism. History checks found no reintroduction of the durable-save publication or typed-retirement defects.

Examined fix-revert evidence shows three replacement-document cases failing with hydration recovery removed, then all four passing after restoration.

Named limitation (confidence: 100): actual WebKitGTK engine-workflow reload proof remains pending. The inspected native tests and mocked browser fixtures do not establish that complete product boundary.

Review shares the implementation’s model family. No files changed or gates run.

VERDICT: APPROVED
```

## Recovery cumulative diff round 1: lens-tauri-security-r1

```text
No in-scope security defects found in the cumulative range. Reviewed signed-download enforcement, extraction/publication containment, completion payloads and retirement errors.

Limitations: static review only. Credential/session persistence is unchanged, and no refresh flow was introduced. No files changed or gates run.

Detection shares the implementation’s OpenAI model family. Plan authorship and arbitration share the root context.

VERDICT: APPROVED
```

## Recovery cumulative diff round 1: lens-tests-r1

```text
[blocker] scripts/verify-app.mjs:5034 — The required real-app engine reload anchor is absent. This checks reservation cleanup and workspace tabs only. Browser recovery uses canned native completions, while native tests poll the mailbox. Breaking actual `CompletionChanged` delivery could strand a running install after reload while these assertions remain green. The handoff explicitly acknowledges this missing proof. (confidence: 100)

[should-fix] src-tauri/src/fs.rs:9900 — Archive existence does not prove completion-resource retention. This fixture creates fresh handles, which startup pruning already preserves, and publication sets `catalog_protected`, which independently prevents collection. Removing the new completion retention guards would leave this assertion green. Exercise otherwise collectible resources and assert their usability before acknowledgement and cleanup afterward. (confidence: 97)

[should-fix] src/state/engineCompletions.test.ts:346 — “Snapshots after subscribing” never exercises the subscription gap. Completion occurs only after initialization returns. Moving the initial snapshot before listener registration would still pass, despite potentially losing a completion between those steps. Inject completion during subscription setup and assert eventual application and acknowledgement. (confidence: 98)

Same-family review. Plan authorship and arbitration share the root context.

VERDICT: REVISE
```

