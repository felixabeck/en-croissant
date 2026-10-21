# Drain task recovery and CI repair, 2026-10-21

Felix requested full-auto Codex completion of the pending f-20261001-03 task and then a fresh drain with the original options. This report supersedes the earlier blocked checkpoint for source closure. It does not claim final publication or installation before their actual results are appended.

The original source, plan and browser/native proof remain in tasks/handoffs/2026-10-21-f-20261001-03-review.md. Recovery preserves that history. The old supervisor was stopped through its documented controls, its exit merge allocated f-20261021-06 and f-20261021-07, and the root took over under the existing build lock. The saved run is still unfinished, so retirement through the documented hand-takeover route must precede the requested fresh start. Planner material is retained.

## Mechanism and scope

Three attempts of fork Test run 39608148446 failed to acquire all three macOS runners. All had empty runner names and annotations identifying ARM capacity constraints. The final manual retry was the single hosted-only recovery dispatch at 18:58 UTC, using the policy exception for another OS. No further identical ARM retry was issued.

Commit 15b40ffe moves the two existing Apple Clippy target rows and the full macOS Rust suite to supported macos-26-intel. Both aarch64-apple-darwin and x86_64-apple-darwin remain explicitly installed and checked. Native runtime proof becomes Intel macOS, with ARM cross-target Clippy retained. No native ARM runtime proof is claimed. Windows, release packaging, command breadth and failure semantics are unchanged. GitHub's current standard runner reference supports this label: https://docs.github.com/en/actions/reference/runners/github-hosted-runners . Decision d-20261021-19 records the partial host supersession, evidence and reversal path. Canonical trailers preserve the prior command decision and identify the new host decision.

Commit 5d577be0 resolves the configured upstream remote and explicitly selects its GitHub repository for every checker call. It also selects current workflow job names from the newest completed run plus newer unfinished runs, retaining current older red results and refusing missing proof. Retired matrix names cannot retain obsolete cancellations after their reviewed replacements complete. This matches the existing drain supervisor's job-generation rule. No supervisor code, new tool, hook, gate, service or rule was added.

## Local causal proof

The runner/parity worker passed all 148 parity tests, the real parity check, workflow and routing checks, formatting and lint. Its exact production checker patch was reversed with the new Intel fixture retained. The positive fixture failed at exit 1 with all three old ARM-host requirements. Git restoration recovered identical production diff bytes and the full proof passed again. Evidence: /tmp/chessfable-drain-rescue-20261021/ci-intel-counterproof-GN9pOq.

The remote checker passes 39 tests covering upstream identity, HTTPS/SSH forms, conflicting GH_REPO, refusal paths, retired names and unfinished current jobs. Root independently ran the six selected regressions against the actual old Git source and the fixed source, with the same current tests and entrypoint. Old source failed all six at exit 1, fixed source passed all six at exit 0. Provenance and logs are in /tmp/chessfable-drain-rescue-20261021/remote-proof. Live unqualified checker calls now select this fork and report exactly the three cancelled attempt-3 jobs, exit 1. That is correct refusal evidence, not replacement success.

Review finding R1-T1 identified a missing assertion rather than a product defect. Commit daf5be15 adds real Mantine DOM progress assertions 65 to 0 to 65, retaining stored progress 65 in the unavailable state. Removing only the production progress normalization fails with actual 65 versus expected 0 at exit 1. Exact Git restoration recovers production blob 4500cd6ccdc89f2fd3ed8ce61a6ebd402b56c1d2 and the whole 20-test suite passes. No production behavior changed. Evidence: /tmp/chessfable-drain-rescue-20261021/progress-test-proof.

Both canonical recovery pre-review runs passed. Their complete wrappers and mutation reports are archived in /tmp/chessfable-drain-rescue-20261021/pre-review-r1-archive and pre-review-r2-archive. Each workspace-storage result killed 1,233 mutants, and each tree/path result killed 170 and timed out six, with zero survivors and 100% selected package scores. Existing ignored mutants remain reported, three in workspace-storage and 13 in tree/path. Post-repair mutation took 998.8 seconds, frontend build 8.6 seconds, format/lint 1.3 seconds, frontend coverage mapping 0.4 seconds and bundle 0.5 seconds. Backend mapping and Windows clippy were correctly unselected in this pre-review command. The final complete gate set must still include Rust, frontend and bindings because the workflow changed.

Original product proof remains 185 container cases and ordinary unmodified native acceptance on product source through 5b30bf80. Root inspected the retained native screenshot. Recovery changes no application production code, snapshots, baseline, floor, budget, product copy or platform target. Final full gates still repeat the relevant browser suite.

## Review arbitration

R1 reviewed the complete pending push through 5d577be0 with 11 source lenses and one records lens. Root adopted four findings: R1-T1 rendered-progress test coverage, R1-R1 stale inbox checkpoints, R1-R2 stale source/checker status, and R1-R3 missing prior-decision supersession trailers. There were no Skip or Defer verdicts. No production correctness defect was adopted. Source and records were reviewed separately.

R2 reviewed the repair delta with full range context through 404ce9f9. Correctness, root-cause and tests explicitly closed R1-T1. The records witness closed R1-R1, R1-R2 and R1-R3. All four reports approve, with no new findings. Recovery diff_adopted_per_round is r1=4 r2=0, of which one is a source-test issue and three are records issues. Original product review rounds remain separately preserved in the earlier handoff. No adopted Fix remains.

The source defect f-20261001-03, wrong-repository checker f-20261006-02, repaired verifier f-20261021-07 and retired-job checker f-20261021-08 are handled. The hosted capacity finding f-20261021-06 remains open until actual successful replacement proof. These source closures do not predict full gate, publication, pushed-SHA CI or installation results.

Writers used Codex gpt-6.1-sol/high through the shared launcher, sensitive for CI/checker changes and normal for the test repair. Read-only reviews used the canonical Codex read routes at medium effort, with mechanical records roles. No executor switch or fallback occurred. Active review walls were not separately measured and are not inferred from summed parallel leaf times. Plan authorship and arbitration shared one root context. Detection and code share the OpenAI model family in separate sessions, with no family-separated detection claim.

## Remaining release sequence at this snapshot

The current source has passed local proof and independent closure. The next steps are final records review, clean full Rust/frontend/bindings gates, an ordinary fast-forward push using the existing explicit repair exception for the three owned capacity cancellations, successful required jobs on the actual pushed SHA and local installation from that SHA. Then retire the interrupted state, sync the main checkout and start a fresh drain with --executor codex --orchestrator codex --plan-ahead 1 --yes. A successful old or queued job is never substituted for required pushed-SHA proof. No force push, ChessFable release or deployment is authorized or performed by this task.

## R1 raw reports

### correctness

```text
No concrete correctness defects found in the cumulative code diff (confidence: 88/100).

Limitation: static review only. Native execution, hosted Intel macOS jobs and final gates remain unverified here. No files changed.

Plan authorship and arbitration share root context. Code and review share the OpenAI family in separate sessions.

VERDICT: APPROVED
```

### root-cause

```text
No findings. The diff fixes the illegal threat-position producer and propagates unavailability through search retirement, displays and arrows. Verifier settlement and CI identity/generation repairs address their evidenced causes. Examined history shows no prior-fix reintroduction.

Retained causal controls support the source repairs. Limitation: final gates, pushed-SHA native CI and installation remain pending (confidence: 100).

Read-only review. No files changed or tests run. Plan authorship and arbitration share root context. Review and code share the OpenAI family in separate sessions.

VERDICT: APPROVED
```

### tests

```text
[should-fix] src/components/panels/analysis/BestMoves.test.tsx:450 — The test seeds progress at 65 but never asserts the unavailable bar’s value is zero. Reverting `available ? engineProgress : 0` to `engineProgress` would pass these assertions. Browser coverage resets progress through EvalListener, so it also misses this regression. Assert the rendered progress value after unavailability. (confidence: 95)

Central behavior has revert-sensitive assertions. Final gates and pushed-SHA native proof remain pending. No tests were run during this read-only review.

Plan authorship and arbitration share root context. Detection, implementation and review share the OpenAI family in separate sessions.

VERDICT: APPROVED
```

### code-quality

```text
No readability or local-consistency findings met the confidence threshold in the supplied cumulative code diff.

Read-only review. No files changed or tests run.

Plan authorship and arbitration share root context. Detection and code share the OpenAI model family in separate sessions.

VERDICT: APPROVED
```

### minimalism

```text
No bloat or duplication defects found above the 80-confidence threshold.

The shared search representation serves multiple production consumers. The payload helper consolidates three fixture sites. CI changes extend existing mechanisms within the recovery mandate.

For each added file, the minimum sufficient change retains it: the unavailable screenshot covers the empty state, and the recovered screenshot covers restored analysis. Deleting either removes distinct visual coverage.

Read-only review completed. No files changed or tests run. Pending gates, CI and installation remain unverified by this review.

Plan authorship and arbitration share root context. Detection and code share the OpenAI family in separate sessions.

VERDICT: APPROVED
```

### error-handling

```text
No qualifying error-handling defects found in the specified cumulative range. No files changed or tests run.

Plan authorship and arbitration share the root context. Detection and code share the OpenAI family in separate sessions.

VERDICT: APPROVED
```

### chess-semantics

```text
No qualifying chess-domain findings. Traced legal replay, threat validation, en passant expiry, castling, custom-root numbering, cached-line identity and tree-path consumers. No files changed or tests run.

Plan authorship and arbitration share the root context. Detection and code share the OpenAI family in separate sessions.

VERDICT: APPROVED
```

### engine-protocol

```text
No qualifying engine process, UCI state-machine or asynchronous result-routing defects found.

Inspected the changed search derivation, listener, display memory and arrow consumers, plus the native supervisor and shared analysis, report and game flows. Checked unavailable-search retirement, late preparation, exact-generation stops, warm reuse and stale-result rejection.

Static review only. No tests or engine processes run, and no files changed.

Plan authorship and arbitration share root context. Detection and code share the OpenAI family in separate sessions, so family separation was absent.

VERDICT: APPROVED
```

### ipc-contract

```text
No qualifying IPC-contract defects found. Traced analysis commands through the facade, generated bindings and Rust registry, plus event payloads, generation filtering, progress units and subscription cleanup. No files changed or tests run.

Plan authorship and arbitration share root context. Detection and code share the OpenAI family in separate sessions.

VERDICT: APPROVED
```

### persisted-state

```text
No in-scope defects found.

The affected analysis families are transient, keyed by owning tab and stable engine ID, and removed by `disposeTabAtoms`. Cache writers and readers share `analysisSearch`. Unavailable searches preserve threat and engine-enabled preferences. Storage encoding, debounce and unload flushing are unchanged.

Read-only source review. No files changed or tests run.

Plan authorship and arbitration share the root context. Detection and code share the OpenAI family in separate sessions, so family separation was absent.

VERDICT: APPROVED
```

### platform-semantics

```text
No concrete platform-semantics findings in the cumulative range.

Both Apple Clippy targets remain explicit. Native macOS runtime proof moves to Intel. ARM runtime proof is not claimed. Current-SHA proof remains pending in `rust-macos-test`, `rust-windows-test`, and the `rust-platform` matrix.

No tests, Windows compile check, or non-Linux Unix source probe were run during this read-only review. No Rust source changed. No files changed.

Plan authorship and arbitration share root context. Detection and code share the OpenAI family in separate sessions.

VERDICT: APPROVED
```

### records-whole

```text
[should-fix] tasks/build-ledger.md:214 — Still says two inbox entries await supervisor merge. Commit 9e5fa3bc merged them as f-20261021-06/07, and 1b62f13f closed f-20261021-07. The same stale pending state remains at tasks/handoffs/2026-10-21-f-20261001-03-review.md:1305. (confidence: 100)

[should-fix] tasks/findings.md:13095 — The latest takeover note still describes source as byte-identical to R3 and requires GH_REPO to compensate for the checker defect. Commits 15b40ffe and 5d577be0 subsequently changed five source/workflow files and pinned every checker gh call to the upstream repository. Append a superseding recovery status covering these repairs and their pending review/release obligations. The handoff’s final external-wait summary also lacks this update. (confidence: 99)

[should-fix] tasks/decisions.md:4670 — d-20260930-02 retains `Superseded-by: -`, although d-20261021-19 explicitly supersedes its preserved runner mapping. d-20260914-08’s trailer likewise omits the new partial supersession. The supplied ledger contract requires marking prior decisions when reversing them. (confidence: 97)

Live hosted state, supervisor state and exact review timings remain independently unverifiable. No writes or tests performed.

VERDICT: REVISE
```

## R2 raw reports

### correctness

```text
R1-T1 CLOSED — BestMoves.test.tsx:444–461 asserts rendered progress 65→0→65 while stored progress remains 65. Retained regression evidence shows raw-progress rendering fails the zero assertion, then restoration passes all 20 tests (confidence: 99).

No correctness defects found in the closure delta or inspected dependencies.

Limitation: static review and retained evidence only. No tests run or files changed.

Plan authorship and arbitration share root context. Detection, code and review share the OpenAI family in separate sessions.

VERDICT: APPROVED
```

### root-cause

```text
R1-T1 CLOSED — BestMoves.test.tsx:444–461 asserts rendered progress 65 → 0 → 65 while stored progress remains 65. The supplied source-regression log fails at line 458 with actual 65 versus expected 0. Exact restoration passes all 20 tests.

No root-cause gaps or prior-fix reintroductions found. Shared legality validation prevents illegal threat requests, and unavailability reaches predecessor retirement, displays, progress and arrows. The closure adds regression assertions without changing production behavior.

Read-only review. No files changed or tests run. Final gates, current-SHA hosted proof and installation remain pending.

Plan authorship and arbitration share root context. Detection, implementation and review share the OpenAI family in separate sessions.

VERDICT: APPROVED
```

### tests

```text
R1-T1 CLOSED — `src/components/panels/analysis/BestMoves.test.tsx:458` asserts real Mantine progress is `0` while stored progress remains `65`. Surrounding assertions verify `65 → 0 → 65`. The retained regression log shows removing normalization fails this assertion with actual `65`, exit 1. Restoration passes all 20 tests. The normal Vitest coverage selector includes this file. (confidence: 99)

No additional findings in the closure delta or impacted dependencies. Read-only review, no tests run or files changed.

Plan authorship and arbitration share root context. Detection, code and review share the OpenAI family in separate sessions.

VERDICT: APPROVED
```

### records-whole

```text
R1-R1 CLOSED — `tasks/build-ledger.md:3` and the handoff at line 1307 explicitly supersede the pending-inbox checkpoint. Commit `9e5fa3bc` merged both entries, and `1b62f13f` closed f-20261021-07.

R1-R2 CLOSED — `tasks/findings.md:13098` and the handoff at line 1309 supersede the source-identity and GH_REPO statements. The five changed CI/checker files support these corrections. Production code remains unchanged.

R1-R3 CLOSED — `tasks/decisions.md:2982` and line 4670 now reference d-20261021-19. The earlier d-20260930-02 link is preserved.

No findings. The R1-T1 candidate claims match the committed test assertions, saved causal-control results and pre-review completion record. Independent closure remains explicitly pending.

Live hosted and supervisor state remain unverifiable. No writes, tests or live queries performed. Plan authorship and arbitration share root context. Detection and implementation share the OpenAI family in separate sessions.

VERDICT: APPROVED
```

## Final source-closure snapshot

R1 and R2 pending-work statements above are dated review checkpoints. All four adopted issues are now explicitly closed, with no new finding. Source closures are committed through 6ccbbeaa3f9a748d57c571d7bd8dffcfba59a523. Full final gate, publication, exact-pushed-SHA CI and installation are still pending at this snapshot. In raw reports, unchanged production code refers to the application, while the five CI/workflow/checker source changes are explicitly listed above. Plan authorship and arbitration shared one context. Detection ran on the same OpenAI model family as the code in separate sessions.

