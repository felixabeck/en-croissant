# Review handoff: f-20261001-07

## Reviews

### Round 1 — completed

Reviewed revision: RUN_TMP/plan-r1.md at BASE ca0ab68689e0f4de8ca0b84df2be29963bcfc66c. The round reviewed O1–O4 and D1–D5. All 12 plan-capable lenses ran through the selected Codex launcher in read-only mode. review-root-cause and review-code-quality are excluded by their plan-review: false frontmatter.

Plan authorship and arbitration shared one context. Detection ran on the same model family as the planned code executor. Fresh launcher contexts provided independent detection, without model-family diversity. No implementation was created in this run.

Wall elapsed from launch preparation to completed poll: 357 seconds. Known non-overlapping quota, dependency, release or other waits: none observed. Ordinary reviewer polling is included in elapsed. Active review wall time is unknown rather than summed from parallel leaves. Total completed rounds: 1. Adopted lens findings: r1=0. Unique issues opened: 0. Resolved: 0. Open: 0. Closed: 0. No witnesses require a disposition or closure round.

All raw verdicts are APPROVED. pgn-index is a finding-free NOT APPLICABLE row. No prefixed blocker, should-fix or nit findings occurred. No corrections, correction-introduced defects, dependencies, withdrawals, inherited issues, rewrite/split lineage or carried obligations arose. O1–O4 remain implementation obligations. Downstream implementation/final-review rework is not yet applicable.

Arbitration: accept the reviewed plan without revision. Runtime availability, snapshot implementation, byte bounds, late-reply guards, helper extraction and cross-platform runtime proof remain for implementation and cumulative diff review. These named limits are neither executed proof nor waived gates. In particular, verify:app cannot register an engine through the native GTK picker, and proves startup/IPC/shutdown only. The reviewed O4 split requires production-child and renderer/container proof for termination.

Read the full raw reports below before adopting. RUN_TMP retains the frozen plan snapshot, each unchanged launch prompt, JSONL terminal evidence, report and stderr. The planner supplies this complete history as reviews-handoff.md. The adopting session must promote it to the tracked review handoff before final gates, record D1–D5, recheck volatile prerequisites, and carry all three phases through implementation review and proof. This session stops before Preflight.

### Raw reports — round 1

#### review-correctness — sensitive

Raw report from lens-correctness-r1.txt, unchanged:

```text
No correctness defects found in the O1–O4 contracts or traced integration boundaries.

Limitation: snapshot capture timing, byte bounds and late-reply rejection require implementation review. No runtime proof was executed (confidence: 90).

VERDICT: APPROVED
```

#### review-error-handling — sensitive

Raw report from lens-error-handling-r1.txt, unchanged:

```text
No error-handling defects found in O1–O4. The plan preserves typed terminal diagnostics through cleanup, ends failed UI states, guards explicit retry, and recovers interrupted game results through retained snapshots.

VERDICT: APPROVED
```

#### review-minimalism — sensitive

Raw report from lens-minimalism-r1.txt, unchanged:

```text
No plan-level bloat or duplication findings above 80 confidence. O1–O4 stay grounded in the mandate and reuse existing delivery, display, logging and verification boundaries.

Limitation: helper necessity and line-level duplication require the implementation diff (confidence: 100).

VERDICT: APPROVED
```

#### review-plan — review-plan

Raw report from lens-plan-r1.txt, unchanged:

```text
No substantiated plan defects found.

Limitation: runtime prerequisites and proposed regression tests remain unverified because this assignment forbids executing gates or builds (confidence: 100).

VERDICT: APPROVED
```

#### review-tests — sensitive

Raw report from lens-tests-r1.txt, unchanged:

```text
The proposed proof levels cover O1–O4 with observable regression anchors: native serialized diagnostics, terminal analysis UI and retry, and interrupted game results/events/snapshots. Test selectors reach the named suites. The plan correctly limits `verify:app` to startup, IPC and shutdown evidence.

VERDICT: APPROVED
```

#### review-chess-semantics — sensitive

Raw report from lens-chess-semantics-r1.txt, unchanged:

```text
No chess-semantics findings. O3 requires interruption to map to `*`, preserves the final position and moves, and prevents overwriting an existing terminal result. O2 retains full search identity and separates historical lines from active analysis.

This is plan approval only. No files changed or tests run.

VERDICT: APPROVED
```

#### review-engine-protocol — sensitive

Raw report from lens-engine-protocol-r1.txt, unchanged:

```text
No defects found in the plan’s UCI lifecycle, cancellation, generation ownership or asynchronous result-routing contract. Review was read-only. No gates or engine processes were run.

VERDICT: APPROVED
```

#### review-ipc-contract — sensitive

Raw report from lens-ipc-contract-r1.txt, unchanged:

```text
No IPC-contract defects found in O1–O4. The plan preserves registered delivery channels, ownership filters and generated bindings, with explicit proof for payload preservation and terminal recovery.

VERDICT: APPROVED
```

#### review-persisted-state — sensitive

Raw report from lens-persisted-state-r1.txt, unchanged:

```text
No findings within this lens. O2 requires ephemeral state scoped by tab and engine id, with disposal on close/removal and no persisted retry settings. O3 stores the existing `*` result, which the current tree schema and compressed storage reader already accept.

Read-only plan review. No files changed or gates run.

VERDICT: APPROVED
```

#### review-pgn-index — sensitive

Raw report from lens-pgn-index-r1.txt, unchanged:

```text
NOT APPLICABLE: P1–P3 cover engine termination, transient analysis diagnostics and game interruption. O3’s PGN `*` result projection concerns in-memory game semantics. No obligation changes PGN byte scanning, disk indexing, move encoding, database storage or search.

VERDICT: APPROVED
```

#### review-platform-semantics — sensitive

Raw report from lens-platform-semantics-r1.txt, unchanged:

```text
No platform-semantics findings in r1. The plan separates EOF from observed exit and process failure from successful reap, with Unix signal handling gated.

`pnpm rust:windows:check` is required through the gate contract but was not run in this read-only review. The non-Linux Unix source probe is neither specified nor run. Windows/macOS runtime proof remains `rust-windows-test` and `rust-macos-test`. The `rust-platform` matrix provides compile and lint proof only.

VERDICT: APPROVED
```

#### review-tauri-security — sensitive

Raw report from lens-tauri-security-r1.txt, unchanged:

```text
No in-scope plan defects found. O1 requires native sanitization, bounded diagnostic payloads, native-only raw causes and serialized-byte proof. O2–O3 consume that same safe snapshot.

Limitation: this approves the plan contract, not an implementation. Credential/session storage, filesystem mutation and signed downloads are absent from P1–P3.

VERDICT: APPROVED
```

### Round 2 — PLAN-REFRESH drift review completed

Old BASE: ca0ab68689e0f4de8ca0b84df2be29963bcfc66c. NEW-BASE: 86305a389c9acbef03af6489a6761f7e0e2ca157. This resumes the published round-1 lineage. The current checkout is already at NEW-BASE, with no uncommitted source or ledger work to commit. Before refresh, the approved plan, metadata and full history were preserved under RUN_TMP/refresh-before-r2.

The exact process-generated source drift is RUN_TMP/drift-ca0ab68689e0f4de8ca0b84df2be29963bcfc66c-86305a389c9acbef03af6489a6761f7e0e2ca157.diff. It changes database/search/progress code, repertoire caching and coordination records. It does not change the plan's primary engine/native-error/game/analysis source scopes or proof configuration. Shared begin_progress still returns the original lease atomically and preserves terminal/drop ownership, now also after initial event-delivery failure. The report caller's boolean novelty contract remains intact.

Plan-body comparison against plan-r1.md emitted UNCHANGED with exit 3. No plan revision or revision-closure round was invented. Round 2 is the explicit mandatory source-drift round, with both SHAs, the actual drift, cumulative history and no open issues in every prompt. The previously filed f-20261009-05 records the generic re-review-packet ambiguity. That separate workflow finding is not reopened or duplicated here.

All 12 requested drift lenses completed through the selected Codex read-only launcher. Every raw verdict is APPROVED. persisted-state and pgn-index are finding-free NOT APPLICABLE rows. No prefixed blocker, should-fix or nit finding occurred, including no out-of-drift finding requiring a Defer. No issue IDs opened or resolved. No Fix, Skip, Defer, corrective mechanism, dependency, withdrawal or carried obligation arose. The approved O1–O4 and autonomous D1–D5 stand unchanged.

Wall elapsed from round start to completed poll and report inspection: 169 seconds. Known non-overlapping quota, dependency, release or other waits: none observed. Ordinary polling while reviewers work is included. Active review wall time is unknown rather than summed from leaf durations. Cumulative completed rounds: 2. Adopted lens findings: r1=0 r2=0. Inherited unique issues: 0. New unique issues: 0. Total unique opened/resolved/open/closed: 0/0/0/0. No rewrite or split. Downstream implementation/final-review rework remains not applicable.

Arbitration: the approved implementation contract remains valid at NEW-BASE. Runtime and final-gate proof has not run in this planner. Source evidence for the shared report boundary is src-tauri/src/progress.rs begin_progress/begin_progress_with_emitter and src-tauri/src/chess.rs:1346. The release prerequisite remains unavailable under f-20261009-04, Blocked: github-actions-available. Its NEW-BASE ledger occurrence records HTTP 422 dispatch refusal and missing current-SHA Windows/macOS/platform conclusions. This is an existing external service prerequisite, not a new source defect or product decision. Adoption must recheck it before dependent implementation/release work under the existing preflight refusal and drain deferral contract. No remote workflow or policy was changed by this refresh.

Plan authorship and arbitration shared one context. Detection ran in fresh launcher contexts on the same model family as the planned code executor. No code was implemented. PLAN-REFRESH stops before Preflight, with no commit, ledger mutation, push, server or browser. The adopter records D1–D5, preserves both review rounds as a tracked handoff, and runs all implementation/proof obligations.

### Raw reports — round 2

#### review-correctness — sensitive

Raw report from lens-correctness-r2.txt, unchanged:

```text
No correctness drift invalidates O1–O4. The shared progress changes preserve report lease identity and terminal handling. Database presence changes preserve the report caller’s boolean contract.

Limitation: this reviews drift compatibility only. Implementation and runtime proof remain unverified (confidence: 100).

VERDICT: APPROVED
```

#### review-error-handling — sensitive

Raw report from lens-error-handling-r2.txt, unchanged:

```text
No error-handling drift invalidation of O1–O4 found. Shared progress changes preserve report ownership and failure propagation. Best-effort delivery failures retain native diagnostics under the supplied decisions.

Read-only review. No files changed or tests run.

VERDICT: APPROVED
```

#### review-minimalism — sensitive

Raw report from lens-minimalism-r2.txt, unchanged:

```text
No bloat or duplication drift invalidates O1–O4. The database, repertoire and shared progress changes neither replace the planned engine-failure contract nor require additional scope.

VERDICT: APPROVED
```

#### review-plan — review-plan

Raw report from lens-plan-r2.txt, unchanged:

```text
No drift invalidation of O1–O4 found. Shared progress and novelty dependencies preserve the planned contracts. P1–P3 source scopes and proof configuration are unchanged.

Limitation: no runtime checks ran. `tasks/findings.md:14338` records unavailable platform CI under f-20261009-04, leaving O4’s cross-platform proof dependent on restored execution (confidence: 100).

VERDICT: APPROVED
```

#### review-tests — sensitive

Raw report from lens-tests-r2.txt, unchanged:

```text
No drift invalidates O1–O4’s approved proof obligations. Test selectors, CI configuration, container fixtures and the Tauri harness are unchanged. The shared progress changes preserve the report integration boundary.

Implementation assertions and red-on-revert evidence remain pending. No tests ran in this read-only review.

VERDICT: APPROVED
```

#### review-chess-semantics — sensitive

Raw report from lens-chess-semantics-r2.txt, unchanged:

```text
No chess-semantics drift invalidation found. The repertoire changes preserve FEN keys and move paths. The drift does not alter O2’s analysis position identity or O3’s final board, moves and interrupted result contract.

Read-only review. No files changed or gates run.

VERDICT: APPROVED
```

#### review-engine-protocol — sensitive

Raw report from lens-engine-protocol-r2.txt, unchanged:

```text
No engine-protocol drift findings. Shared progress changes preserve report ownership and do not invalidate O1–O4’s termination, cancellation or result-routing obligations.

Read-only review. No files changed, gates run or engine processes started.

VERDICT: APPROVED
```

#### review-ipc-contract — sensitive

Raw report from lens-ipc-contract-r2.txt, unchanged:

```text
No IPC-contract drift invalidates O1–O4. Shared progress retains registered delivery, matching payload units and generation filtering. Engine-error and game-result boundaries are unchanged.

Read-only review. No files changed or gates run.

VERDICT: APPROVED
```

#### review-persisted-state — sensitive

Raw report from lens-persisted-state-r2.txt, unchanged:

```text
NOT APPLICABLE: The drift changes native database/progress code and repertoire request ownership, with no changes to renderer storage, atom families, hydration or tab lifecycle that could invalidate O1–O4.

VERDICT: APPROVED
```

#### review-pgn-index — sensitive

Raw report from lens-pgn-index-r2.txt, unchanged:

```text
NOT APPLICABLE: P1–P3 cover engine termination, analysis display and game result projection. O3’s PGN `*` requirement concerns the in-memory result projection. No obligation changes PGN byte scanning, disk indexing, encoding, storage or search within this lens.

VERDICT: APPROVED
```

#### review-platform-semantics — sensitive

Raw report from lens-platform-semantics-r2.txt, unchanged:

```text
No platform-semantics drift invalidates approved obligations O1–O4. No findings.

Read-only review. No files changed or gates run. `pnpm rust:windows:check` and the non-Linux Unix source probe were not run. Windows/macOS runtime proof remains pending through `rust-windows-test` and `rust-macos-test`. The drift records unavailable CI execution. `rust-platform` provides compile/lint proof only.

VERDICT: APPROVED
```

#### review-tauri-security — sensitive

Raw report from lens-tauri-security-r2.txt, unchanged:

```text
No security finding in the drift invalidates O1–O4. Changed progress diagnostics remain native-only.

Limitation: this is plan drift review, not implementation verification. Credential/session storage, filesystem mutation and signed-download contracts are unchanged.

VERDICT: APPROVED
```

### Round 3 — PLAN-REFRESH drift review completed

Old BASE: 86305a389c9acbef03af6489a6761f7e0e2ca157. NEW-BASE: ced73bdf79653dd3546fe34e2625fb63fd6ac3c6. This resumes the published r1–r2 lineage in drain slot 2. The checkout stands at NEW-BASE with a clean porcelain status (only ignored tasks/plans bookkeeping).

The exact process-generated source drift is RUN_TMP/drift-86305a389c9acbef03af6489a6761f7e0e2ca157-ced73bdf79653dd3546fe34e2625fb63fd6ac3c6.diff (239 commits, git diff OLD..NEW verified byte-identical). Most of it is database, path-authority, SQLite-retirement, game-opening and coordination-record work. Inside the plan's file scopes it changes: owner-tab binding of every per-tab atom (159de8ec, c21fce13 for f-20261011-09: src/state/tabScope.tsx useOwnerTabId/useTabAtom; EvalListener, BestMoves, useDisplayedEngineLines, DetachedEval, LogsPanel, ReportPanel and AnalysisPanel now key by the owning tab instead of activeTabAtom; bestMoves/firstEngineWithLines become component-owned factories; disposeTabAtoms changes), a new AggregateError branch in src/platform/errors.ts normalizeError, e2e fixture/spec additions, and two new translation keys. It changes no native engine, error.rs, chess.rs or game.rs source. The plan's Traced premises remain frozen Locate evidence at the original BASE; line drift alone was given to the lenses as not a finding.

Plan-body comparison against plan-r2.md emitted UNCHANGED with exit 3. No plan revision or revision-closure round was invented. Round 3 is the explicit mandatory source-drift round, with both SHAs, the drift file, the 30 new drift decisions (RUN_TMP/drift-decisions-r3.md), the 19 applicable cited decisions (RUN_TMP/applicable-decisions.md, none superseded at NEW-BASE), cumulative history and no open issues in every prompt.

All 12 requested drift lenses completed through the selected Codex read-only launcher (no routed= line, no profile check applicable). Every raw verdict is APPROVED. pgn-index is a finding-free NOT APPLICABLE row. No prefixed blocker, should-fix or nit finding occurred, and no OUT OF DRIFT SCOPE defect was reported, so nothing was spool-filed as Defer. No issue IDs opened or resolved. No Fix, Skip, Defer, corrective mechanism, dependency, withdrawal or carried obligation arose. The approved O1–O4 and autonomous D1–D5 stand unchanged.

Arbitration: the approved implementation contract remains valid at NEW-BASE. O2's per-tab/per-engine ephemeral terminal state now attaches to the owner-tab id that the drift introduced (useOwnerTabId, owner-keyed engine families, disposeTabAtoms) rather than the active tab. That is the same ownership the plan requires and is an implementation detail for P2, not an obligation change. The AggregateError branch normalizes only aggregate rejections and leaves the tagged-error route O1 extends intact.

Wall elapsed from launch to completed poll and report inspection: 206 seconds. Known non-overlapping quota, dependency, release or other waits: none observed. Ordinary polling while reviewers work is included. Active review wall time is unknown rather than summed from leaf durations. Cumulative completed rounds: 3. Adopted lens findings: r1=0 r2=0 r3=0. Inherited unique issues: 0. New unique issues: 0. Total unique opened/resolved/open/closed: 0/0/0/0. No rewrite or split. Downstream implementation/final-review rework remains not applicable.

Volatile prerequisites remain for the adopting session: the release proof prerequisite f-20261009-04 (Blocked: github-actions-available) recorded in r2, Docker/GStreamer availability and released-kit parity. None was rechecked here because PLAN-REFRESH stops before Preflight.

Plan authorship and arbitration shared one context. Detection ran in fresh launcher contexts on the same model family as the planned code executor. No code was implemented. PLAN-REFRESH stops before Preflight, with no commit, ledger mutation, push, server or browser. The adopter records D1–D5, preserves all three review rounds as a tracked handoff, and runs all implementation/proof obligations.

### Raw reports — round 3

#### review-correctness — sensitive

Raw report from lens-correctness-r3.txt, unchanged:

```text
No correctness drift invalidates O1–O4. Owner-scoped analysis readers and writers agree on tab identity. Aggregate-error normalization leaves direct typed command-error handling intact.

Limitation: this is drift compatibility review only. Implementation and runtime proof remain unverified (confidence: 100).

VERDICT: APPROVED
```

#### review-error-handling — sensitive

Raw report from lens-error-handling-r3.txt, unchanged:

```text
No error-handling drift invalidation of O1–O4 found. Tagged failures retain their mapping, aggregate failures remain visible, and owner-scoped analysis/log paths preserve rejection handling.

Read-only review. No files changed or tests run.

VERDICT: APPROVED
```

#### review-minimalism — sensitive

Raw report from lens-minimalism-r3.txt, unchanged:

```text
No bloat or duplication drift invalidates O1–O4. Owner-tab scoping preserves the shared analysis boundary, and AggregateError handling does not replace the planned typed engine-failure contract.

VERDICT: APPROVED
```

#### review-plan — review-plan

Raw report from lens-plan-r3.txt, unchanged:

```text
No drift invalidates O1–O4. Owner-tab atoms, tagged error mapping and e2e fixtures remain compatible with the planned contracts.

Limitation: runtime prerequisites and regression proof remain unverified. No tests, gates or builds ran in this read-only review (confidence: 100).

VERDICT: APPROVED
```

#### review-tests — sensitive

Raw report from lens-tests-r3.txt, unchanged:

```text
No drift invalidates O1–O4’s approved proof obligations. Owner-scoped renderer tests remain reachable, and fixture changes preserve the engine rejection boundary.

Limitation: implementation assertions and red-on-revert evidence remain pending. No tests ran in this read-only review (confidence: 100).

VERDICT: APPROVED
```

#### review-chess-semantics — sensitive

Raw report from lens-chess-semantics-r3.txt, unchanged:

```text
No chess-semantics drift invalidates O1–O4. Analysis retains full FEN and move-sequence identity with owner-tab state. O3’s interrupted-result and final-position contracts remain compatible.

Read-only review. No files changed or tests run.

VERDICT: APPROVED
```

#### review-engine-protocol — sensitive

Raw report from lens-engine-protocol-r3.txt, unchanged:

```text
No engine-protocol drift invalidates O1–O4. Owner-tab routing preserves engine identity, search-generation guards and exact-owner cleanup.

Read-only review. No files changed, tests run or engine processes started.

VERDICT: APPROVED
```

#### review-ipc-contract — sensitive

Raw report from lens-ipc-contract-r3.txt, unchanged:

```text
No IPC-contract drift invalidates O1–O4. Owner-tab changes preserve matching command arguments and event filters. Registered payloads, generated bindings and listener cleanup remain intact.

Read-only review. No files changed or gates run.

VERDICT: APPROVED
```

#### review-persisted-state — sensitive

Raw report from lens-persisted-state-r3.txt, unchanged:

```text
No persistence or tab-lifecycle drift invalidates O1–O4. Owner-tab bindings preserve O2’s ephemeral tab/engine scope and disposal. Tree writes and reads share the compressed codec, and lifecycle flushes remain intact.

Read-only review. No files changed or tests run.

VERDICT: APPROVED
```

#### review-pgn-index — sensitive

Raw report from lens-pgn-index-r3.txt, unchanged:

```text
NOT APPLICABLE: O1–O4 concern engine termination and transient UI/game state. O3 specifies PGN result `*`, but this drift changes neither game-result projection nor PGN scanning, indexing, encoding, storage or search within the plan’s scope.

VERDICT: APPROVED
```

#### review-platform-semantics — sensitive

Raw report from lens-platform-semantics-r3.txt, unchanged:

```text
No platform-semantics drift invalidates O1–O4. Native engine/error/game paths are unchanged. Renderer ownership, AggregateError handling and fixture changes reveal no concrete platform defect.

Read-only review. No files changed or checks run. `pnpm rust:windows:check` and the non-Linux Unix source probe remain unexecuted. Windows/macOS runtime proof requires `rust-windows-test` and `rust-macos-test`. `rust-platform` supplies compile/lint proof only.

VERDICT: APPROVED
```

#### review-tauri-security — sensitive

Raw report from lens-tauri-security-r3.txt, unchanged:

```text
No security drift invalidates O1–O4. The AggregateError branch retains redaction, and tab ownership changes preserve diagnostic routing.

Limitation: this is plan drift review, not implementation proof. Credential storage, filesystem mutation and signed downloads are absent from P1–P3. No files changed or tests run.

VERDICT: APPROVED
```


## Evidence

### Manifest

[
  {
    "artefact": "lens-chess-semantics-r1.jsonl",
    "findings": [],
    "lens": "chess-semantics",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-chess-semantics-r1.prompt",
    "report": "lens-chess-semantics-r1.txt",
    "round": 1,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-correctness-r1.jsonl",
    "findings": [],
    "lens": "correctness",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-correctness-r1.prompt",
    "report": "lens-correctness-r1.txt",
    "round": 1,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-engine-protocol-r1.jsonl",
    "findings": [],
    "lens": "engine-protocol",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-engine-protocol-r1.prompt",
    "report": "lens-engine-protocol-r1.txt",
    "round": 1,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-error-handling-r1.jsonl",
    "findings": [],
    "lens": "error-handling",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-error-handling-r1.prompt",
    "report": "lens-error-handling-r1.txt",
    "round": 1,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-ipc-contract-r1.jsonl",
    "findings": [],
    "lens": "ipc-contract",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-ipc-contract-r1.prompt",
    "report": "lens-ipc-contract-r1.txt",
    "round": 1,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-minimalism-r1.jsonl",
    "findings": [],
    "lens": "minimalism",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-minimalism-r1.prompt",
    "report": "lens-minimalism-r1.txt",
    "round": 1,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-persisted-state-r1.jsonl",
    "findings": [],
    "lens": "persisted-state",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-persisted-state-r1.prompt",
    "report": "lens-persisted-state-r1.txt",
    "round": 1,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-pgn-index-r1.jsonl",
    "findings": [],
    "lens": "pgn-index",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-pgn-index-r1.prompt",
    "report": "lens-pgn-index-r1.txt",
    "round": 1,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-plan-r1.jsonl",
    "findings": [],
    "lens": "plan",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-plan-r1.prompt",
    "report": "lens-plan-r1.txt",
    "round": 1,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-platform-semantics-r1.jsonl",
    "findings": [],
    "lens": "platform-semantics",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-platform-semantics-r1.prompt",
    "report": "lens-platform-semantics-r1.txt",
    "round": 1,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-tauri-security-r1.jsonl",
    "findings": [],
    "lens": "tauri-security",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-tauri-security-r1.prompt",
    "report": "lens-tauri-security-r1.txt",
    "round": 1,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-tests-r1.jsonl",
    "findings": [],
    "lens": "tests",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-tests-r1.prompt",
    "report": "lens-tests-r1.txt",
    "round": 1,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-chess-semantics-r2.jsonl",
    "findings": [],
    "lens": "chess-semantics",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-chess-semantics-r2.prompt",
    "report": "lens-chess-semantics-r2.txt",
    "round": 2,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-correctness-r2.jsonl",
    "findings": [],
    "lens": "correctness",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-correctness-r2.prompt",
    "report": "lens-correctness-r2.txt",
    "round": 2,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-engine-protocol-r2.jsonl",
    "findings": [],
    "lens": "engine-protocol",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-engine-protocol-r2.prompt",
    "report": "lens-engine-protocol-r2.txt",
    "round": 2,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-error-handling-r2.jsonl",
    "findings": [],
    "lens": "error-handling",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-error-handling-r2.prompt",
    "report": "lens-error-handling-r2.txt",
    "round": 2,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-ipc-contract-r2.jsonl",
    "findings": [],
    "lens": "ipc-contract",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-ipc-contract-r2.prompt",
    "report": "lens-ipc-contract-r2.txt",
    "round": 2,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-minimalism-r2.jsonl",
    "findings": [],
    "lens": "minimalism",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-minimalism-r2.prompt",
    "report": "lens-minimalism-r2.txt",
    "round": 2,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-persisted-state-r2.jsonl",
    "findings": [],
    "lens": "persisted-state",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-persisted-state-r2.prompt",
    "report": "lens-persisted-state-r2.txt",
    "round": 2,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-pgn-index-r2.jsonl",
    "findings": [],
    "lens": "pgn-index",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-pgn-index-r2.prompt",
    "report": "lens-pgn-index-r2.txt",
    "round": 2,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-plan-r2.jsonl",
    "findings": [],
    "lens": "plan",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-plan-r2.prompt",
    "report": "lens-plan-r2.txt",
    "round": 2,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-platform-semantics-r2.jsonl",
    "findings": [],
    "lens": "platform-semantics",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-platform-semantics-r2.prompt",
    "report": "lens-platform-semantics-r2.txt",
    "round": 2,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-tauri-security-r2.jsonl",
    "findings": [],
    "lens": "tauri-security",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-tauri-security-r2.prompt",
    "report": "lens-tauri-security-r2.txt",
    "round": 2,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-tests-r2.jsonl",
    "findings": [],
    "lens": "tests",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-tests-r2.prompt",
    "report": "lens-tests-r2.txt",
    "round": 2,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-chess-semantics-r3.jsonl",
    "findings": [],
    "lens": "chess-semantics",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-chess-semantics-r3.prompt",
    "report": "lens-chess-semantics-r3.txt",
    "round": 3,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-correctness-r3.jsonl",
    "findings": [],
    "lens": "correctness",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-correctness-r3.prompt",
    "report": "lens-correctness-r3.txt",
    "round": 3,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-engine-protocol-r3.jsonl",
    "findings": [],
    "lens": "engine-protocol",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-engine-protocol-r3.prompt",
    "report": "lens-engine-protocol-r3.txt",
    "round": 3,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-error-handling-r3.jsonl",
    "findings": [],
    "lens": "error-handling",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-error-handling-r3.prompt",
    "report": "lens-error-handling-r3.txt",
    "round": 3,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-ipc-contract-r3.jsonl",
    "findings": [],
    "lens": "ipc-contract",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-ipc-contract-r3.prompt",
    "report": "lens-ipc-contract-r3.txt",
    "round": 3,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-minimalism-r3.jsonl",
    "findings": [],
    "lens": "minimalism",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-minimalism-r3.prompt",
    "report": "lens-minimalism-r3.txt",
    "round": 3,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-persisted-state-r3.jsonl",
    "findings": [],
    "lens": "persisted-state",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-persisted-state-r3.prompt",
    "report": "lens-persisted-state-r3.txt",
    "round": 3,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-pgn-index-r3.jsonl",
    "findings": [],
    "lens": "pgn-index",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-pgn-index-r3.prompt",
    "report": "lens-pgn-index-r3.txt",
    "round": 3,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-plan-r3.jsonl",
    "findings": [],
    "lens": "plan",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-plan-r3.prompt",
    "report": "lens-plan-r3.txt",
    "round": 3,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-platform-semantics-r3.jsonl",
    "findings": [],
    "lens": "platform-semantics",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-platform-semantics-r3.prompt",
    "report": "lens-platform-semantics-r3.txt",
    "round": 3,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-tauri-security-r3.jsonl",
    "findings": [],
    "lens": "tauri-security",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-tauri-security-r3.prompt",
    "report": "lens-tauri-security-r3.txt",
    "round": 3,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-tests-r3.jsonl",
    "findings": [],
    "lens": "tests",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-tests-r3.prompt",
    "report": "lens-tests-r3.txt",
    "round": 3,
    "terminal": "completed",
    "verdict": "APPROVED"
  }
]

### Issues

[]

### lens-chess-semantics-r1.txt

No chess-semantics findings. O3 requires interruption to map to `*`, preserves the final position and moves, and prevents overwriting an existing terminal result. O2 retains full search identity and separates historical lines from active analysis.

This is plan approval only. No files changed or tests run.

VERDICT: APPROVED
### lens-chess-semantics-r2.txt

No chess-semantics drift invalidation found. The repertoire changes preserve FEN keys and move paths. The drift does not alter O2’s analysis position identity or O3’s final board, moves and interrupted result contract.

Read-only review. No files changed or gates run.

VERDICT: APPROVED
### lens-chess-semantics-r3.txt

No chess-semantics drift invalidates O1–O4. Analysis retains full FEN and move-sequence identity with owner-tab state. O3’s interrupted-result and final-position contracts remain compatible.

Read-only review. No files changed or tests run.

VERDICT: APPROVED
### lens-correctness-r1.txt

No correctness defects found in the O1–O4 contracts or traced integration boundaries.

Limitation: snapshot capture timing, byte bounds and late-reply rejection require implementation review. No runtime proof was executed (confidence: 90).

VERDICT: APPROVED
### lens-correctness-r2.txt

No correctness drift invalidates O1–O4. The shared progress changes preserve report lease identity and terminal handling. Database presence changes preserve the report caller’s boolean contract.

Limitation: this reviews drift compatibility only. Implementation and runtime proof remain unverified (confidence: 100).

VERDICT: APPROVED
### lens-correctness-r3.txt

No correctness drift invalidates O1–O4. Owner-scoped analysis readers and writers agree on tab identity. Aggregate-error normalization leaves direct typed command-error handling intact.

Limitation: this is drift compatibility review only. Implementation and runtime proof remain unverified (confidence: 100).

VERDICT: APPROVED
### lens-engine-protocol-r1.txt

No defects found in the plan’s UCI lifecycle, cancellation, generation ownership or asynchronous result-routing contract. Review was read-only. No gates or engine processes were run.

VERDICT: APPROVED
### lens-engine-protocol-r2.txt

No engine-protocol drift findings. Shared progress changes preserve report ownership and do not invalidate O1–O4’s termination, cancellation or result-routing obligations.

Read-only review. No files changed, gates run or engine processes started.

VERDICT: APPROVED
### lens-engine-protocol-r3.txt

No engine-protocol drift invalidates O1–O4. Owner-tab routing preserves engine identity, search-generation guards and exact-owner cleanup.

Read-only review. No files changed, tests run or engine processes started.

VERDICT: APPROVED
### lens-error-handling-r1.txt

No error-handling defects found in O1–O4. The plan preserves typed terminal diagnostics through cleanup, ends failed UI states, guards explicit retry, and recovers interrupted game results through retained snapshots.

VERDICT: APPROVED
### lens-error-handling-r2.txt

No error-handling drift invalidation of O1–O4 found. Shared progress changes preserve report ownership and failure propagation. Best-effort delivery failures retain native diagnostics under the supplied decisions.

Read-only review. No files changed or tests run.

VERDICT: APPROVED
### lens-error-handling-r3.txt

No error-handling drift invalidation of O1–O4 found. Tagged failures retain their mapping, aggregate failures remain visible, and owner-scoped analysis/log paths preserve rejection handling.

Read-only review. No files changed or tests run.

VERDICT: APPROVED
### lens-ipc-contract-r1.txt

No IPC-contract defects found in O1–O4. The plan preserves registered delivery channels, ownership filters and generated bindings, with explicit proof for payload preservation and terminal recovery.

VERDICT: APPROVED
### lens-ipc-contract-r2.txt

No IPC-contract drift invalidates O1–O4. Shared progress retains registered delivery, matching payload units and generation filtering. Engine-error and game-result boundaries are unchanged.

Read-only review. No files changed or gates run.

VERDICT: APPROVED
### lens-ipc-contract-r3.txt

No IPC-contract drift invalidates O1–O4. Owner-tab changes preserve matching command arguments and event filters. Registered payloads, generated bindings and listener cleanup remain intact.

Read-only review. No files changed or gates run.

VERDICT: APPROVED
### lens-minimalism-r1.txt

No plan-level bloat or duplication findings above 80 confidence. O1–O4 stay grounded in the mandate and reuse existing delivery, display, logging and verification boundaries.

Limitation: helper necessity and line-level duplication require the implementation diff (confidence: 100).

VERDICT: APPROVED
### lens-minimalism-r2.txt

No bloat or duplication drift invalidates O1–O4. The database, repertoire and shared progress changes neither replace the planned engine-failure contract nor require additional scope.

VERDICT: APPROVED
### lens-minimalism-r3.txt

No bloat or duplication drift invalidates O1–O4. Owner-tab scoping preserves the shared analysis boundary, and AggregateError handling does not replace the planned typed engine-failure contract.

VERDICT: APPROVED
### lens-persisted-state-r1.txt

No findings within this lens. O2 requires ephemeral state scoped by tab and engine id, with disposal on close/removal and no persisted retry settings. O3 stores the existing `*` result, which the current tree schema and compressed storage reader already accept.

Read-only plan review. No files changed or gates run.

VERDICT: APPROVED
### lens-persisted-state-r2.txt

NOT APPLICABLE: The drift changes native database/progress code and repertoire request ownership, with no changes to renderer storage, atom families, hydration or tab lifecycle that could invalidate O1–O4.

VERDICT: APPROVED
### lens-persisted-state-r3.txt

No persistence or tab-lifecycle drift invalidates O1–O4. Owner-tab bindings preserve O2’s ephemeral tab/engine scope and disposal. Tree writes and reads share the compressed codec, and lifecycle flushes remain intact.

Read-only review. No files changed or tests run.

VERDICT: APPROVED
### lens-pgn-index-r1.txt

NOT APPLICABLE: P1–P3 cover engine termination, transient analysis diagnostics and game interruption. O3’s PGN `*` result projection concerns in-memory game semantics. No obligation changes PGN byte scanning, disk indexing, move encoding, database storage or search.

VERDICT: APPROVED
### lens-pgn-index-r2.txt

NOT APPLICABLE: P1–P3 cover engine termination, analysis display and game result projection. O3’s PGN `*` requirement concerns the in-memory result projection. No obligation changes PGN byte scanning, disk indexing, encoding, storage or search within this lens.

VERDICT: APPROVED
### lens-pgn-index-r3.txt

NOT APPLICABLE: O1–O4 concern engine termination and transient UI/game state. O3 specifies PGN result `*`, but this drift changes neither game-result projection nor PGN scanning, indexing, encoding, storage or search within the plan’s scope.

VERDICT: APPROVED
### lens-plan-r1.txt

No substantiated plan defects found.

Limitation: runtime prerequisites and proposed regression tests remain unverified because this assignment forbids executing gates or builds (confidence: 100).

VERDICT: APPROVED
### lens-plan-r2.txt

No drift invalidation of O1–O4 found. Shared progress and novelty dependencies preserve the planned contracts. P1–P3 source scopes and proof configuration are unchanged.

Limitation: no runtime checks ran. `tasks/findings.md:14338` records unavailable platform CI under f-20261009-04, leaving O4’s cross-platform proof dependent on restored execution (confidence: 100).

VERDICT: APPROVED
### lens-plan-r3.txt

No drift invalidates O1–O4. Owner-tab atoms, tagged error mapping and e2e fixtures remain compatible with the planned contracts.

Limitation: runtime prerequisites and regression proof remain unverified. No tests, gates or builds ran in this read-only review (confidence: 100).

VERDICT: APPROVED
### lens-platform-semantics-r1.txt

No platform-semantics findings in r1. The plan separates EOF from observed exit and process failure from successful reap, with Unix signal handling gated.

`pnpm rust:windows:check` is required through the gate contract but was not run in this read-only review. The non-Linux Unix source probe is neither specified nor run. Windows/macOS runtime proof remains `rust-windows-test` and `rust-macos-test`. The `rust-platform` matrix provides compile and lint proof only.

VERDICT: APPROVED
### lens-platform-semantics-r2.txt

No platform-semantics drift invalidates approved obligations O1–O4. No findings.

Read-only review. No files changed or gates run. `pnpm rust:windows:check` and the non-Linux Unix source probe were not run. Windows/macOS runtime proof remains pending through `rust-windows-test` and `rust-macos-test`. The drift records unavailable CI execution. `rust-platform` provides compile/lint proof only.

VERDICT: APPROVED
### lens-platform-semantics-r3.txt

No platform-semantics drift invalidates O1–O4. Native engine/error/game paths are unchanged. Renderer ownership, AggregateError handling and fixture changes reveal no concrete platform defect.

Read-only review. No files changed or checks run. `pnpm rust:windows:check` and the non-Linux Unix source probe remain unexecuted. Windows/macOS runtime proof requires `rust-windows-test` and `rust-macos-test`. `rust-platform` supplies compile/lint proof only.

VERDICT: APPROVED
### lens-tauri-security-r1.txt

No in-scope plan defects found. O1 requires native sanitization, bounded diagnostic payloads, native-only raw causes and serialized-byte proof. O2–O3 consume that same safe snapshot.

Limitation: this approves the plan contract, not an implementation. Credential/session storage, filesystem mutation and signed downloads are absent from P1–P3.

VERDICT: APPROVED
### lens-tauri-security-r2.txt

No security finding in the drift invalidates O1–O4. Changed progress diagnostics remain native-only.

Limitation: this is plan drift review, not implementation verification. Credential/session storage, filesystem mutation and signed-download contracts are unchanged.

VERDICT: APPROVED
### lens-tauri-security-r3.txt

No security drift invalidates O1–O4. The AggregateError branch retains redaction, and tab ownership changes preserve diagnostic routing.

Limitation: this is plan drift review, not implementation proof. Credential storage, filesystem mutation and signed downloads are absent from P1–P3. No files changed or tests run.

VERDICT: APPROVED
### lens-tests-r1.txt

The proposed proof levels cover O1–O4 with observable regression anchors: native serialized diagnostics, terminal analysis UI and retry, and interrupted game results/events/snapshots. Test selectors reach the named suites. The plan correctly limits `verify:app` to startup, IPC and shutdown evidence.

VERDICT: APPROVED
### lens-tests-r2.txt

No drift invalidates O1–O4’s approved proof obligations. Test selectors, CI configuration, container fixtures and the Tauri harness are unchanged. The shared progress changes preserve the report integration boundary.

Implementation assertions and red-on-revert evidence remain pending. No tests ran in this read-only review.

VERDICT: APPROVED
### lens-tests-r3.txt

No drift invalidates O1–O4’s approved proof obligations. Owner-scoped renderer tests remain reachable, and fixture changes preserve the engine rejection boundary.

Limitation: implementation assertions and red-on-revert evidence remain pending. No tests ran in this read-only review (confidence: 100).

VERDICT: APPROVED
### plan-r1.md

# Plan: Surface engine termination without false game results

## Goal

Close f-20261001-07 by preserving a useful safe engine termination reason, making analysis visibly terminal and retryable, and ending an affected game without falsely assigning a chess winner. This is PLAN-ONLY at ca0ab68689e0f4de8ca0b84df2be29963bcfc66c. Only planning artifacts are written.

## MANDATE

### Engine termination is not surfaced: analysis spins forever, the engine's last `info string` reason is lost, and a game blames the engine with "Abandonment"

* **ID:** f-20261001-07 · **Status:** open · **Area:** engine-uci · **Root:** - · **Entry:** build · **Blocked:** none
* **Where:** `src-tauri/src/engine/process.rs:486` (exit status discarded), `:2574-2576` (actor log), `src-tauri/src/chess.rs:315,593` (`info string` during a search read as "no moves"), `:633-641` (supervisor entry removed, Logs panel empty), `src/components/panels/analysis/BestMoves.tsx:248-305,369-371` (loading skeleton and progress bar stay), `src/components/boards/EvalListener.tsx:415-418` (generic toast), `src-tauri/src/game.rs:2969-2984` (engine side loses by "Abandonment").
* **Defect:** when an engine process exits mid-session, the renderer gets only the fixed "Engine disconnected" text; the analysis panel stays in its loading state indefinitely, the engine's final line (Stockfish 19 prints `info string CRITICAL ERROR: Command … failed. Reason: …` before `exit(1)`) is unreachable from the Logs panel, and a game charges the loss to the engine even when the GUI sent the bad input.
* **Open question:** what owns the final word of a terminated engine — a typed `EngineTerminated { reason }` error carrying the last `info string`/stderr line through the facade, or a retained bounded post-mortem log the Logs panel can still read after the supervisor entry is removed — and what the analysis panel shows instead of the skeleton (error state with retry), and whether a game should end as an engine failure rather than "Abandonment".
* **Why it matters:** any engine crash (SF18 segfaults on some FENs; SF19 terminates on strict-validation failures) leaves the user with a spinner and no reason. The Stockfish 19 upgrade plan removes every known ChessFable input that triggers SF19 termination, so this is the same hazard as before the upgrade, not a regression of it.
* **Found by:** Claude Code (Opus 5.5) Stockfish 19 upgrade planning run, GUI-side UCI audit leaf, 2026-10-01. Related plan: `tasks/plans/2026-10-01-stockfish-19-upgrade.md` (Not part of this task).

## Threat model and non-goals

Ordinary third-party UCI engines can exit, close stdout, reject a command, emit oversized or non-UTF-8 output, or write arbitrary text to stderr. Diagnostic text is untrusted for retention and rendering. Input may contain resource paths, credentials and markup. Safe transport, text rendering and bounds must hold for these inputs. Deliberately evasive secret encodings are outside this task. Linux is the actual product runtime. Windows and macOS retain compile and runtime-test parity through existing CI. Intentional stop, release, supersession, Kill, retirement, tab close and app shutdown remain separate from unexpected termination.

No new watcher, daemon, lifecycle registry, persisted crash archive, automatic restart policy, capability widening, resource-limit change, UCI input-validation redesign or failed-reap ownership redesign. The existing actor, command error path, transient renderer state and native log sink suffice. f-20261001-14 owns failed-reap registry retention. The other open engine findings are separate queued work.

## Traced premises

Frozen Locate evidence at BASE, with read-only reports in RUN_TMP/probe-1-r1.txt and probe-2-r1.txt:

* `src-tauri/src/engine/process.rs:502`: production child wait discards ExitStatus. `:777`: stderr drains to native logging only. `:3338`: stdout enters resource-redacted bounded logs before UCI parsing. `:4398`: search EOF becomes EngineDisconnected. `:3384`: required-exchange EOF does likewise. `:3401`: intentional interruption also returns EngineDisconnected.
* `src-tauri/src/engine/process.rs:4302`: protocol recovery reaps before replying and folds operation/cleanup errors. `src-tauri/src/error.rs:480`: with_cleanup currently flattens both diagnostics to strings. A new typed failure must survive this fold without exposing raw OS diagnostics.
* `src-tauri/src/chess.rs:927`: non-cancellation search failure releases the exact generation. `:845`: logs consult only the live map. Existing runtime logs have 2000-entry/512 KiB bounds, stderr logging has a 512 KiB lifetime budget.
* `src/components/boards/EvalListener.tsx:225`: current-attempt acceptance already checks owner, tab, FEN, moves, settings/go mode, executable identity and close intent. `:388`: rejection sets no-lines only before any usable lines. `:445`: command rejection is the existing terminal delivery channel.
* `src/components/panels/analysis/useDisplayedEngineLines.ts:64`: no-lines suppresses waiting, so the original infinite-skeleton premise is partly fixed. `src/components/panels/analysis/BestMoves.tsx:218`: progress animation still has no failed-terminal condition.
* `src/state/atoms.ts:862`: analysis lines/progress/no-lines are ephemeral per tab/engine. `:1039`: disposal removes them. `src/components/panels/analysis/AnalysisPanel.tsx:315` and `src/components/common/DetachedEval.tsx:61` share the display hook.
* `src-tauri/src/game.rs:2930`: non-cancelled engine-task errors and join failures award Abandonment. `:867`: the terminal event is attempted once. `:1738`: exact-session state queries recover retained terminal snapshots.
* `src/components/boards/BoardGame.tsx:84`: result projection defaults all non-win variants to a draw. `:480` and `:957`: snapshot and event termination paths share owner/revision rules but separately apply terminal state.
* `src/components/panels/analysis/ReportModal.tsx:190`: rejection guards owner epoch but not current operation identity. Reports consume the same native failure boundary and must not surface a retired operation's diagnostic.
* `src/platform/errors.ts:193`: tagged errors preserve backend category. `:233`: safeFailureContext re-redacts retained text. `src/components/panels/analysis/LogsPanel.tsx:21`: live logs are keyed by tab/engine and notify query failures once.

## Approach

### O1 — One safe terminal snapshot from the native actor

Authority: MANDATE "the engine's last `info string` reason is lost" and "what owns the final word of a terminated engine".

Capture one actor-owned terminal snapshot before its child/runtime/transcript are consumed. Distinguish unexpected EOF/disconnection from observed process exit, protocol failure and intentional interruption. Record a portable optional exit code and a Unix signal only when observed. An unknown exit status stays unknown. EOF alone must not falsely assert the process exited. Keep process failure separate from cleanup/reap success. Do not turn a nonzero exit into a failed reap when the child has actually been reaped.

Keep bounded last stdout `info string` and stderr tails while the runtime exists, including after the stderr native-logging budget is exhausted. Update the tails without blocking Tokio workers or holding a lock across await. The captured snapshot remains accessible to surviving actor clones after the task ends. Use the existing stderr join bounds and teardown deadlines, and do not add polling or change cancellation deadlines. Select the last useful `info string` first, then the last stderr line, then a localized failure-kind/exit-status fallback. This priority avoids inventing ordering between separate pipes.

The IPC snapshot carries safe failure kind, optional observed exit metadata, a safe reason of at most 2048 UTF-8 bytes, and at most 32 terminal diagnostic entries totaling 16 KiB including strings and truncation markers. The native snapshot is one per actor, and the renderer retains one per owned tab/engine. Raw OS error chains remain native-only. Sanitize all engine text before it can enter the IPC snapshot, applying existing lifetime resource-provenance redaction plus credential/path redaction and text-only rendering. Late resource-redaction additions also sanitize previously captured tails. Preserve useful chess notation and ordinary engine failure wording. No raw stderr or diagnostic() value is serialized. Tests inspect native serialized bytes, so renderer redaction alone is insufficient.

Use a typed engine-failure error with optional safe snapshot in the existing tagged ErrorPayload and an exhaustive facade mapping. It reaches interactive searches through their existing promise rejection, and reports/game callers through their existing error paths. Shared and operation-plus-cleanup wrappers preserve the typed snapshot while separately retaining native cleanup diagnostics and renderer-safe labels. Existing deliberate-interruption EngineDisconnected/Cancellation semantics of d-20261008-11 remain unchanged. A cancelled or stale request cannot produce a crash surface, and cleanup failure must never be converted to cancellation or success. Real EOF/error snapshots survive exact-generation cleanup, including readiness/initialization failure. No new broadcast event is needed.

### O2 — Sticky analysis failure, safe Logs view and explicit retry

Authority: MANDATE "analysis panel stays in its loading state indefinitely", "error state with retry", and final reason "unreachable from the Logs panel".

Replace the no-lines-only terminal representation with one ephemeral per-tab/per-engine terminal state covering completed-without-lines and failed-with-safe-snapshot. Associate it with the complete existing attempt fingerprint, searched key/context, executable identity and native search generation. All result and failure acceptance runs through the current-attempt guard. A failed terminal attempt rejects subsequent late line/progress updates. New attempts, retry, owner disposal and context replacement retire the old display state. Tab close and engine unload/removal clear the associated state, without adding persistence or a background owner set.

The shared display hook drives BestMoves, EngineSummary and DetachedEval consistently. Failure always ends waiting, skeletons, progress animation and live speed claims, including failure after partial lines. Valid remembered lines may remain visible as historical evaluation with an explicit failure indicator. They do not appear to be an active search. Existing normal/threat separation, 1000 ms loading delay and 256-position memory remain unchanged for healthy searches. A current failure remains visible until a genuinely new attempt or owner/context disposal.

BestMoves renders localized failure text, its safe reason and a Retry control. Retry changes an ephemeral retry discriminator and reserves a fresh native generation even when FEN/settings match. It reuses the existing serialized stop/prepare transition and never mutates persisted settings or retries automatically. EngineSummary/DetachedEval show the same failed status through the shared hook. Existing engine/type/owner guards keep a local failure from attaching to a remote engine or another tab.

LogsPanel displays the retained safe terminal entries for the selected failed owner, explicitly labelled as terminal diagnostics, even after the supervisor removes the live actor. A successful new attempt clears that terminal selection. Live log fetch errors remain errors under d-20260901-32, never empty success. Use the existing EngineLogsView for diagnostic rendering. No native supervisor archive is needed. ReportModal/ReportPanel retain their separate operation state but consume the same typed safe failure and apply operation/root-fingerprint guards on failures, preventing an older operation from notifying against its successor.

### O3 — Interrupted game, no fabricated chess result

Authority: MANDATE "a game charges the loss to the engine even when the GUI sent the bad input" and "whether a game should end as an engine failure rather than Abandonment".

Introduce an explicit interrupted GameResult variant for a non-cancelled engine-task failure, carrying a safe failure reason/snapshot from O1 where available. Join failure gets a generic safe engine-task-failed reason, never raw JoinError text. An interrupted game has no winner and is not a draw. Its PGN/tree result is `*`. Human resignation, timeout, checkmate, actual draw and existing deliberate abort behavior keep their contracts.

Apply one authoritative terminal transition only while the controller is Playing. Clear engine_thinking, preserve the final board and moves, stop clocks/work, attempt the existing GameOver event once, and retain the same interrupted result and safe reason in exact-session finished snapshots. Timeout/resignation/close/replacement races cannot overwrite an already terminal result. Keep cleanup exact-generation and report its actual outcome, without undertaking f-20261001-14.

BoardGame applies events and recovered finished snapshots through one shared terminal projection with existing game/session/UI-generation/revision guards. Map every GameResult variant exhaustively, with interruption mapping to `*`. Retain an ephemeral localized reason in the completed board UI, preserving completion ownership release and stale-playing-snapshot rejection. Show terminal diagnostics through the existing shared logs view if available, with owner identity retained as display data rather than abortable native ownership. Duplicate event/query delivery produces one visible terminal state and no duplicate notification. A subsequent game clears the old failure.

### O4 — Behavior proof at the real boundaries

Authority: MANDATE requires surfaced termination, not merely a matching type. Rules require actual IPC/runtime and visual evidence.

Native deterministic actor tests cover diagnostic selection, observed/unknown exit metadata, bounds/UTF-8, stdout/stderr redaction, exhausted stderr logging, intentional interruption, failed cleanup and stale exact generations. Add actual controlled child-exit tests through production IO where existing fixture seams permit. Platform-neutral fakes cover portable semantics on every OS. Unix signal cases are cfg-gated and not used as Windows/macOS exit evidence. Game tests drive the production engine-completion/game-loop integration, event and retained snapshot behavior, and terminal races. Do not prove behavior by source-string assertions.

Renderer tests mount the actual listener/display/game owners. Prove failure before/after partial lines, sticky terminal state, matching owner filters, two engines sharing name/path, same-position Retry, late old results/rejections, unloaded owner cleanup, safe Logs view, detached/summary consistency, report replacement and lost GameOver recovery. New regression tests must fail against BASE source with only those tests present, then pass with the fix. Take reverts from Git, isolate intended production hunks, and never transcribe a pre-fix implementation.

Extend existing e2e/engine-gap.spec.ts and its shared fixture to inject typed failures through existing pending command rejection, exercise visible failure/retry/terminal logs and preserve healthy dimmed-line coverage. Add game interruption coverage through the existing game fixture surface. Keep canonical container snapshots. Use the existing off-screen Tauri harness for real startup, IPC and shutdown proof after a release build. Its native GTK picker cannot register an engine, so do not claim that verify:app alone proves live crash propagation. Native production-child tests plus renderer/e2e boundary tests establish that split, following d-20260908-05. No new registration command or diagnostic service is authorized.

## Decisions and trade-offs

Entry revalidation retains build: native failure ownership, safe cross-layer payload, retry semantics and game results remain coupled design questions. The already-shipped no-lines marker resolves only the first-loading symptom. The original entry is not mutated by this planner.

Binding precedent: d-20260904-05/-06/-07 (tagged native categories), d-20260901-30/-32 (one supervisor and truthful logs), d-20260911-01/-07 and d-20260927-09 (provenance redaction, native-only raw diagnostics), d-20261005-13/-14/-15/-16 (warm ownership, search generation, memory and shared display), d-20261008-11/-12/-13/-14 (interruption/reap/graceful release), d-20260908-05/-06 and d-20260909-02 (proof limits and terminal snapshot reconciliation). These are inputs, not reopened questions.

## Decided autonomously

* D1. Question: typed terminal reason or supervisor post-mortem archive? Chosen: actor-owned bounded snapshot in the existing typed error, retained by current renderer ownership for failure/Logs display. Rejected: persistent or supervisor-wide archive and new termination event. Reason: the search promise already owns delivery and a current failure is all the mandate needs. Reversal: replace only the snapshot delivery/retention boundary with a separately justified archive.
* D2. Question: retain raw engine text or provide safe diagnostic excerpts? Chosen: bounded native-sanitized excerpts and observed exit metadata, keeping raw OS causes in native logging. Rejected: raw diagnostic serialization and renderer-only sanitization. Reason: d-20260911-01/-07 and d-20260927-09 govern egress. Reversal: change the native display sanitization contract only with equivalent serialized-byte proof.
* D3. Question: retry automatically, use pause/resume, or expose Retry? Chosen: explicit localized Retry using a fresh reserved generation and transient discriminator. Rejected: automatic retries and persisted setting changes. Reason: mandate names error state with retry, current generation ownership already provides the restart boundary. Reversal: change the control behavior and its owner tests.
* D4. Question: should engine failure award a win, draw, or interrupt the game? Chosen: interrupted terminal result with PGN `*`, preserved moves and safe reason. Rejected: Abandonment loss or fabricated draw. Reason: mandate rejects attributing a GUI-triggered failure to an engine, and existing game reconciliation never fabricates an outcome. This is the full-auto recommendation, not an answer attributed to Felix. Reversal: explicitly revise the failure-result policy and exhaustive projection.
* D5. Question: who accepts the visible behavior and live-engine proof? Chosen: agent-owned unit/integration tests, canonical container screenshots and real off-screen Tauri startup/IPC/shutdown, naming the picker limitation. Rejected: Felix repeating deterministic races, Chrome MCP on Vite, or claiming mocked IPC is live-child evidence. Reason: full auto and d-20260908-05. Reversal: use an existing authorized live-engine registration route if one is later added.

The adopting session records D1–D5 via findings.py before implementation. This planner does not mutate decisions.md.

## Risks / open questions

No unresolved product question remains within this full-auto mandate. Cross-pipe diagnostic arrival has no total ordering, so O1 declares deterministic priority. EOF may occur while a child survives, and teardown remains responsible for the child. Failed-reap retention remains f-20261001-14 rather than being hidden by diagnostic retention. Egress sanitization is security-sensitive and receives the security lens. The implementation must preserve metadata through Error::with_cleanup rather than silently flattening it.

Locate confirmed Codex CLI 0.162.0, clean BASE snapshot, ignored tasks/plans, and WebKitWebDriver, tauri-driver, kwin_wayland and Docker binaries. Docker availability, GStreamer runtime support, released-kit parity and remote CI are not yet verified. Adoption rechecks all volatile prerequisites before source work and release. No gate, build, browser, dev server or generator ran in this planner.

## Not part of this task

Failed-reap retry/registry ownership (f-20261001-14), independent shutdown/admission and existing channel-closed findings, a general log archive/export UI, fixing every historical engine finding, native GTK dialog automation, lowered coverage floors/bundle budgets, or a host-recorded screenshot baseline.

## Phases

Sequential cohesive phases. P1 provides the shared native contract for both consumers. P2 and P3 depend on P1 and run sequentially because the worktree and generated bindings are shared. Every phase includes tests and bindings regeneration where needed, leaves changes unstaged for root inspection, and ends green and independently committable.

1. **P1 — Native terminal contract and facade.** Files: src-tauri/src/engine/process.rs, src-tauri/src/engine/types.rs and exports if required, src-tauri/src/error.rs, src-tauri/src/chess.rs, src/platform/errors.ts and tests, src/bindings/generated.ts via exporter only. Own O1 and its native/facade O4 cases. Touches concurrency, IPC and diagnostic egress, no persistence. Executor role sensitive, registry leaf.codex.write.sensitive. PROOF: `cargo test --manifest-path src-tauri/Cargo.toml --all-targets --locked -- engine::process && cargo test --manifest-path src-tauri/Cargo.toml --all-targets --locked -- chess::tests && cargo test --manifest-path src-tauri/Cargo.toml --all-targets --locked -- error::tests && pnpm exec vitest run src/platform/errors.test.ts src/platform/failureDiagnostic.test.ts && pnpm bindings:check && pnpm checks:pre-review && pnpm gates:contract:check`.
2. **P2 — Analysis terminal display, logs and retry.** Files: src/components/boards/EvalListener.tsx and tests, src/components/panels/analysis/{useDisplayedEngineLines,BestMoves,AnalysisPanel,LogsPanel,ReportModal,ReportPanel} and tests, src/components/common/DetachedEval.tsx and tests, src/state/atoms.ts and its analysis tests, src/utils/engines.ts/controller tests if integration requires it, src/translation/ catalogs, e2e/engine-gap.spec.ts, e2e/fixtures.ts and affected snapshots. Own O2 and its O4 cases. Touches runtime ownership and IPC consumption, existing persistence unchanged. Executor role sensitive, registry leaf.codex.write.sensitive. PROOF: `pnpm exec vitest run src/components/boards/EvalListener.test.tsx src/components/panels/analysis/useDisplayedEngineLines.test.tsx src/components/panels/analysis/BestMoves.test.tsx src/components/panels/analysis/AnalysisPanel.test.tsx src/components/panels/analysis/LogsPanel.test.tsx src/components/panels/analysis/ReportModal.test.tsx src/components/panels/analysis/ReportPanel.test.tsx src/state/atoms.analysis.test.ts src/utils/engines.controller.test.ts && pnpm test:e2e:container --project=engine-gap && pnpm checks:pre-review && pnpm gates:contract:check`. Add any newly created DetachedEval test to the phase proof. Extract i18n with `pnpm i18n:extract` before proof, never concurrently with receipt gates.
3. **P3 — Game interruption and final cross-flow proof.** Files: src-tauri/src/game.rs and tests, src/components/boards/BoardGame.tsx and tests, shared game projection helper only if needed, src/translation/ catalogs, src/bindings/generated.ts via exporter, existing e2e game spec or a focused spec using e2e/fixtures.ts, playwright.config.ts only if registering that spec requires it. Own O3 and game O4 cases. Touches concurrency, game identity and IPC, no new persistence. Executor role sensitive, registry leaf.codex.write.sensitive. PROOF: `cargo test --manifest-path src-tauri/Cargo.toml --all-targets --locked -- game::tests && pnpm exec vitest run src/components/boards/BoardGame.test.tsx src/components/boards/gameCommandError.test.ts src/platform/gameTransport.test.ts && pnpm bindings:check && pnpm test:e2e:container && pnpm checks:pre-review && pnpm gates:contract:check`.

For every phase the static importer graph is the test-scope floor. Add affected importer tests when symbols move. Use pnpm bindings:generate for changed Specta types, never hand-edit generated.ts. Root checks complete diffs, reruns proof and commits only owned paths. Phase tests include red-on-revert evidence where isolatable. All writes, tests and phases use the prescribed executor route, not inline root implementation.

After P3: cumulative diff review, repairs and closure rounds, then verify-ui using `pnpm build && pnpm verify:app`, inspect affected container screenshots, and commit review/decision records before final gates. Run `pnpm gates:push -- --rust --frontend --bindings` on the unchanged clean tree, through the drain headless gate route. Then the project push skill checks kit parity and remote CI, pushes non-force, verifies HEAD = upstream, waits for Windows/macOS/MSVC required jobs, and installs only on master. Finally close f-20261001-07 and release validated records through the authorized workflow. This plan-only session stops before Preflight and does none of those operations.

## Carried to diff review

None at initial revision.

### plan-r2.md

# Plan: Surface engine termination without false game results

## Goal

Close f-20261001-07 by preserving a useful safe engine termination reason, making analysis visibly terminal and retryable, and ending an affected game without falsely assigning a chess winner. This is PLAN-ONLY at ca0ab68689e0f4de8ca0b84df2be29963bcfc66c. Only planning artifacts are written.

## MANDATE

### Engine termination is not surfaced: analysis spins forever, the engine's last `info string` reason is lost, and a game blames the engine with "Abandonment"

* **ID:** f-20261001-07 · **Status:** open · **Area:** engine-uci · **Root:** - · **Entry:** build · **Blocked:** none
* **Where:** `src-tauri/src/engine/process.rs:486` (exit status discarded), `:2574-2576` (actor log), `src-tauri/src/chess.rs:315,593` (`info string` during a search read as "no moves"), `:633-641` (supervisor entry removed, Logs panel empty), `src/components/panels/analysis/BestMoves.tsx:248-305,369-371` (loading skeleton and progress bar stay), `src/components/boards/EvalListener.tsx:415-418` (generic toast), `src-tauri/src/game.rs:2969-2984` (engine side loses by "Abandonment").
* **Defect:** when an engine process exits mid-session, the renderer gets only the fixed "Engine disconnected" text; the analysis panel stays in its loading state indefinitely, the engine's final line (Stockfish 19 prints `info string CRITICAL ERROR: Command … failed. Reason: …` before `exit(1)`) is unreachable from the Logs panel, and a game charges the loss to the engine even when the GUI sent the bad input.
* **Open question:** what owns the final word of a terminated engine — a typed `EngineTerminated { reason }` error carrying the last `info string`/stderr line through the facade, or a retained bounded post-mortem log the Logs panel can still read after the supervisor entry is removed — and what the analysis panel shows instead of the skeleton (error state with retry), and whether a game should end as an engine failure rather than "Abandonment".
* **Why it matters:** any engine crash (SF18 segfaults on some FENs; SF19 terminates on strict-validation failures) leaves the user with a spinner and no reason. The Stockfish 19 upgrade plan removes every known ChessFable input that triggers SF19 termination, so this is the same hazard as before the upgrade, not a regression of it.
* **Found by:** Claude Code (Opus 5.5) Stockfish 19 upgrade planning run, GUI-side UCI audit leaf, 2026-10-01. Related plan: `tasks/plans/2026-10-01-stockfish-19-upgrade.md` (Not part of this task).

## Threat model and non-goals

Ordinary third-party UCI engines can exit, close stdout, reject a command, emit oversized or non-UTF-8 output, or write arbitrary text to stderr. Diagnostic text is untrusted for retention and rendering. Input may contain resource paths, credentials and markup. Safe transport, text rendering and bounds must hold for these inputs. Deliberately evasive secret encodings are outside this task. Linux is the actual product runtime. Windows and macOS retain compile and runtime-test parity through existing CI. Intentional stop, release, supersession, Kill, retirement, tab close and app shutdown remain separate from unexpected termination.

No new watcher, daemon, lifecycle registry, persisted crash archive, automatic restart policy, capability widening, resource-limit change, UCI input-validation redesign or failed-reap ownership redesign. The existing actor, command error path, transient renderer state and native log sink suffice. f-20261001-14 owns failed-reap registry retention. The other open engine findings are separate queued work.

## Traced premises

Frozen Locate evidence at BASE, with read-only reports in RUN_TMP/probe-1-r1.txt and probe-2-r1.txt:

* `src-tauri/src/engine/process.rs:502`: production child wait discards ExitStatus. `:777`: stderr drains to native logging only. `:3338`: stdout enters resource-redacted bounded logs before UCI parsing. `:4398`: search EOF becomes EngineDisconnected. `:3384`: required-exchange EOF does likewise. `:3401`: intentional interruption also returns EngineDisconnected.
* `src-tauri/src/engine/process.rs:4302`: protocol recovery reaps before replying and folds operation/cleanup errors. `src-tauri/src/error.rs:480`: with_cleanup currently flattens both diagnostics to strings. A new typed failure must survive this fold without exposing raw OS diagnostics.
* `src-tauri/src/chess.rs:927`: non-cancellation search failure releases the exact generation. `:845`: logs consult only the live map. Existing runtime logs have 2000-entry/512 KiB bounds, stderr logging has a 512 KiB lifetime budget.
* `src/components/boards/EvalListener.tsx:225`: current-attempt acceptance already checks owner, tab, FEN, moves, settings/go mode, executable identity and close intent. `:388`: rejection sets no-lines only before any usable lines. `:445`: command rejection is the existing terminal delivery channel.
* `src/components/panels/analysis/useDisplayedEngineLines.ts:64`: no-lines suppresses waiting, so the original infinite-skeleton premise is partly fixed. `src/components/panels/analysis/BestMoves.tsx:218`: progress animation still has no failed-terminal condition.
* `src/state/atoms.ts:862`: analysis lines/progress/no-lines are ephemeral per tab/engine. `:1039`: disposal removes them. `src/components/panels/analysis/AnalysisPanel.tsx:315` and `src/components/common/DetachedEval.tsx:61` share the display hook.
* `src-tauri/src/game.rs:2930`: non-cancelled engine-task errors and join failures award Abandonment. `:867`: the terminal event is attempted once. `:1738`: exact-session state queries recover retained terminal snapshots.
* `src/components/boards/BoardGame.tsx:84`: result projection defaults all non-win variants to a draw. `:480` and `:957`: snapshot and event termination paths share owner/revision rules but separately apply terminal state.
* `src/components/panels/analysis/ReportModal.tsx:190`: rejection guards owner epoch but not current operation identity. Reports consume the same native failure boundary and must not surface a retired operation's diagnostic.
* `src/platform/errors.ts:193`: tagged errors preserve backend category. `:233`: safeFailureContext re-redacts retained text. `src/components/panels/analysis/LogsPanel.tsx:21`: live logs are keyed by tab/engine and notify query failures once.

## Approach

### O1 — One safe terminal snapshot from the native actor

Authority: MANDATE "the engine's last `info string` reason is lost" and "what owns the final word of a terminated engine".

Capture one actor-owned terminal snapshot before its child/runtime/transcript are consumed. Distinguish unexpected EOF/disconnection from observed process exit, protocol failure and intentional interruption. Record a portable optional exit code and a Unix signal only when observed. An unknown exit status stays unknown. EOF alone must not falsely assert the process exited. Keep process failure separate from cleanup/reap success. Do not turn a nonzero exit into a failed reap when the child has actually been reaped.

Keep bounded last stdout `info string` and stderr tails while the runtime exists, including after the stderr native-logging budget is exhausted. Update the tails without blocking Tokio workers or holding a lock across await. The captured snapshot remains accessible to surviving actor clones after the task ends. Use the existing stderr join bounds and teardown deadlines, and do not add polling or change cancellation deadlines. Select the last useful `info string` first, then the last stderr line, then a localized failure-kind/exit-status fallback. This priority avoids inventing ordering between separate pipes.

The IPC snapshot carries safe failure kind, optional observed exit metadata, a safe reason of at most 2048 UTF-8 bytes, and at most 32 terminal diagnostic entries totaling 16 KiB including strings and truncation markers. The native snapshot is one per actor, and the renderer retains one per owned tab/engine. Raw OS error chains remain native-only. Sanitize all engine text before it can enter the IPC snapshot, applying existing lifetime resource-provenance redaction plus credential/path redaction and text-only rendering. Late resource-redaction additions also sanitize previously captured tails. Preserve useful chess notation and ordinary engine failure wording. No raw stderr or diagnostic() value is serialized. Tests inspect native serialized bytes, so renderer redaction alone is insufficient.

Use a typed engine-failure error with optional safe snapshot in the existing tagged ErrorPayload and an exhaustive facade mapping. It reaches interactive searches through their existing promise rejection, and reports/game callers through their existing error paths. Shared and operation-plus-cleanup wrappers preserve the typed snapshot while separately retaining native cleanup diagnostics and renderer-safe labels. Existing deliberate-interruption EngineDisconnected/Cancellation semantics of d-20261008-11 remain unchanged. A cancelled or stale request cannot produce a crash surface, and cleanup failure must never be converted to cancellation or success. Real EOF/error snapshots survive exact-generation cleanup, including readiness/initialization failure. No new broadcast event is needed.

### O2 — Sticky analysis failure, safe Logs view and explicit retry

Authority: MANDATE "analysis panel stays in its loading state indefinitely", "error state with retry", and final reason "unreachable from the Logs panel".

Replace the no-lines-only terminal representation with one ephemeral per-tab/per-engine terminal state covering completed-without-lines and failed-with-safe-snapshot. Associate it with the complete existing attempt fingerprint, searched key/context, executable identity and native search generation. All result and failure acceptance runs through the current-attempt guard. A failed terminal attempt rejects subsequent late line/progress updates. New attempts, retry, owner disposal and context replacement retire the old display state. Tab close and engine unload/removal clear the associated state, without adding persistence or a background owner set.

The shared display hook drives BestMoves, EngineSummary and DetachedEval consistently. Failure always ends waiting, skeletons, progress animation and live speed claims, including failure after partial lines. Valid remembered lines may remain visible as historical evaluation with an explicit failure indicator. They do not appear to be an active search. Existing normal/threat separation, 1000 ms loading delay and 256-position memory remain unchanged for healthy searches. A current failure remains visible until a genuinely new attempt or owner/context disposal.

BestMoves renders localized failure text, its safe reason and a Retry control. Retry changes an ephemeral retry discriminator and reserves a fresh native generation even when FEN/settings match. It reuses the existing serialized stop/prepare transition and never mutates persisted settings or retries automatically. EngineSummary/DetachedEval show the same failed status through the shared hook. Existing engine/type/owner guards keep a local failure from attaching to a remote engine or another tab.

LogsPanel displays the retained safe terminal entries for the selected failed owner, explicitly labelled as terminal diagnostics, even after the supervisor removes the live actor. A successful new attempt clears that terminal selection. Live log fetch errors remain errors under d-20260901-32, never empty success. Use the existing EngineLogsView for diagnostic rendering. No native supervisor archive is needed. ReportModal/ReportPanel retain their separate operation state but consume the same typed safe failure and apply operation/root-fingerprint guards on failures, preventing an older operation from notifying against its successor.

### O3 — Interrupted game, no fabricated chess result

Authority: MANDATE "a game charges the loss to the engine even when the GUI sent the bad input" and "whether a game should end as an engine failure rather than Abandonment".

Introduce an explicit interrupted GameResult variant for a non-cancelled engine-task failure, carrying a safe failure reason/snapshot from O1 where available. Join failure gets a generic safe engine-task-failed reason, never raw JoinError text. An interrupted game has no winner and is not a draw. Its PGN/tree result is `*`. Human resignation, timeout, checkmate, actual draw and existing deliberate abort behavior keep their contracts.

Apply one authoritative terminal transition only while the controller is Playing. Clear engine_thinking, preserve the final board and moves, stop clocks/work, attempt the existing GameOver event once, and retain the same interrupted result and safe reason in exact-session finished snapshots. Timeout/resignation/close/replacement races cannot overwrite an already terminal result. Keep cleanup exact-generation and report its actual outcome, without undertaking f-20261001-14.

BoardGame applies events and recovered finished snapshots through one shared terminal projection with existing game/session/UI-generation/revision guards. Map every GameResult variant exhaustively, with interruption mapping to `*`. Retain an ephemeral localized reason in the completed board UI, preserving completion ownership release and stale-playing-snapshot rejection. Show terminal diagnostics through the existing shared logs view if available, with owner identity retained as display data rather than abortable native ownership. Duplicate event/query delivery produces one visible terminal state and no duplicate notification. A subsequent game clears the old failure.

### O4 — Behavior proof at the real boundaries

Authority: MANDATE requires surfaced termination, not merely a matching type. Rules require actual IPC/runtime and visual evidence.

Native deterministic actor tests cover diagnostic selection, observed/unknown exit metadata, bounds/UTF-8, stdout/stderr redaction, exhausted stderr logging, intentional interruption, failed cleanup and stale exact generations. Add actual controlled child-exit tests through production IO where existing fixture seams permit. Platform-neutral fakes cover portable semantics on every OS. Unix signal cases are cfg-gated and not used as Windows/macOS exit evidence. Game tests drive the production engine-completion/game-loop integration, event and retained snapshot behavior, and terminal races. Do not prove behavior by source-string assertions.

Renderer tests mount the actual listener/display/game owners. Prove failure before/after partial lines, sticky terminal state, matching owner filters, two engines sharing name/path, same-position Retry, late old results/rejections, unloaded owner cleanup, safe Logs view, detached/summary consistency, report replacement and lost GameOver recovery. New regression tests must fail against BASE source with only those tests present, then pass with the fix. Take reverts from Git, isolate intended production hunks, and never transcribe a pre-fix implementation.

Extend existing e2e/engine-gap.spec.ts and its shared fixture to inject typed failures through existing pending command rejection, exercise visible failure/retry/terminal logs and preserve healthy dimmed-line coverage. Add game interruption coverage through the existing game fixture surface. Keep canonical container snapshots. Use the existing off-screen Tauri harness for real startup, IPC and shutdown proof after a release build. Its native GTK picker cannot register an engine, so do not claim that verify:app alone proves live crash propagation. Native production-child tests plus renderer/e2e boundary tests establish that split, following d-20260908-05. No new registration command or diagnostic service is authorized.

## Decisions and trade-offs

Entry revalidation retains build: native failure ownership, safe cross-layer payload, retry semantics and game results remain coupled design questions. The already-shipped no-lines marker resolves only the first-loading symptom. The original entry is not mutated by this planner.

Binding precedent: d-20260904-05/-06/-07 (tagged native categories), d-20260901-30/-32 (one supervisor and truthful logs), d-20260911-01/-07 and d-20260927-09 (provenance redaction, native-only raw diagnostics), d-20261005-13/-14/-15/-16 (warm ownership, search generation, memory and shared display), d-20261008-11/-12/-13/-14 (interruption/reap/graceful release), d-20260908-05/-06 and d-20260909-02 (proof limits and terminal snapshot reconciliation). These are inputs, not reopened questions.

## Decided autonomously

* D1. Question: typed terminal reason or supervisor post-mortem archive? Chosen: actor-owned bounded snapshot in the existing typed error, retained by current renderer ownership for failure/Logs display. Rejected: persistent or supervisor-wide archive and new termination event. Reason: the search promise already owns delivery and a current failure is all the mandate needs. Reversal: replace only the snapshot delivery/retention boundary with a separately justified archive.
* D2. Question: retain raw engine text or provide safe diagnostic excerpts? Chosen: bounded native-sanitized excerpts and observed exit metadata, keeping raw OS causes in native logging. Rejected: raw diagnostic serialization and renderer-only sanitization. Reason: d-20260911-01/-07 and d-20260927-09 govern egress. Reversal: change the native display sanitization contract only with equivalent serialized-byte proof.
* D3. Question: retry automatically, use pause/resume, or expose Retry? Chosen: explicit localized Retry using a fresh reserved generation and transient discriminator. Rejected: automatic retries and persisted setting changes. Reason: mandate names error state with retry, current generation ownership already provides the restart boundary. Reversal: change the control behavior and its owner tests.
* D4. Question: should engine failure award a win, draw, or interrupt the game? Chosen: interrupted terminal result with PGN `*`, preserved moves and safe reason. Rejected: Abandonment loss or fabricated draw. Reason: mandate rejects attributing a GUI-triggered failure to an engine, and existing game reconciliation never fabricates an outcome. This is the full-auto recommendation, not an answer attributed to Felix. Reversal: explicitly revise the failure-result policy and exhaustive projection.
* D5. Question: who accepts the visible behavior and live-engine proof? Chosen: agent-owned unit/integration tests, canonical container screenshots and real off-screen Tauri startup/IPC/shutdown, naming the picker limitation. Rejected: Felix repeating deterministic races, Chrome MCP on Vite, or claiming mocked IPC is live-child evidence. Reason: full auto and d-20260908-05. Reversal: use an existing authorized live-engine registration route if one is later added.

The adopting session records D1–D5 via findings.py before implementation. This planner does not mutate decisions.md.

## Risks / open questions

No unresolved product question remains within this full-auto mandate. Cross-pipe diagnostic arrival has no total ordering, so O1 declares deterministic priority. EOF may occur while a child survives, and teardown remains responsible for the child. Failed-reap retention remains f-20261001-14 rather than being hidden by diagnostic retention. Egress sanitization is security-sensitive and receives the security lens. The implementation must preserve metadata through Error::with_cleanup rather than silently flattening it.

Locate confirmed Codex CLI 0.162.0, clean BASE snapshot, ignored tasks/plans, and WebKitWebDriver, tauri-driver, kwin_wayland and Docker binaries. Docker availability, GStreamer runtime support, released-kit parity and remote CI are not yet verified. Adoption rechecks all volatile prerequisites before source work and release. No gate, build, browser, dev server or generator ran in this planner.

## Not part of this task

Failed-reap retry/registry ownership (f-20261001-14), independent shutdown/admission and existing channel-closed findings, a general log archive/export UI, fixing every historical engine finding, native GTK dialog automation, lowered coverage floors/bundle budgets, or a host-recorded screenshot baseline.

## Phases

Sequential cohesive phases. P1 provides the shared native contract for both consumers. P2 and P3 depend on P1 and run sequentially because the worktree and generated bindings are shared. Every phase includes tests and bindings regeneration where needed, leaves changes unstaged for root inspection, and ends green and independently committable.

1. **P1 — Native terminal contract and facade.** Files: src-tauri/src/engine/process.rs, src-tauri/src/engine/types.rs and exports if required, src-tauri/src/error.rs, src-tauri/src/chess.rs, src/platform/errors.ts and tests, src/bindings/generated.ts via exporter only. Own O1 and its native/facade O4 cases. Touches concurrency, IPC and diagnostic egress, no persistence. Executor role sensitive, registry leaf.codex.write.sensitive. PROOF: `cargo test --manifest-path src-tauri/Cargo.toml --all-targets --locked -- engine::process && cargo test --manifest-path src-tauri/Cargo.toml --all-targets --locked -- chess::tests && cargo test --manifest-path src-tauri/Cargo.toml --all-targets --locked -- error::tests && pnpm exec vitest run src/platform/errors.test.ts src/platform/failureDiagnostic.test.ts && pnpm bindings:check && pnpm checks:pre-review && pnpm gates:contract:check`.
2. **P2 — Analysis terminal display, logs and retry.** Files: src/components/boards/EvalListener.tsx and tests, src/components/panels/analysis/{useDisplayedEngineLines,BestMoves,AnalysisPanel,LogsPanel,ReportModal,ReportPanel} and tests, src/components/common/DetachedEval.tsx and tests, src/state/atoms.ts and its analysis tests, src/utils/engines.ts/controller tests if integration requires it, src/translation/ catalogs, e2e/engine-gap.spec.ts, e2e/fixtures.ts and affected snapshots. Own O2 and its O4 cases. Touches runtime ownership and IPC consumption, existing persistence unchanged. Executor role sensitive, registry leaf.codex.write.sensitive. PROOF: `pnpm exec vitest run src/components/boards/EvalListener.test.tsx src/components/panels/analysis/useDisplayedEngineLines.test.tsx src/components/panels/analysis/BestMoves.test.tsx src/components/panels/analysis/AnalysisPanel.test.tsx src/components/panels/analysis/LogsPanel.test.tsx src/components/panels/analysis/ReportModal.test.tsx src/components/panels/analysis/ReportPanel.test.tsx src/state/atoms.analysis.test.ts src/utils/engines.controller.test.ts && pnpm test:e2e:container --project=engine-gap && pnpm checks:pre-review && pnpm gates:contract:check`. Add any newly created DetachedEval test to the phase proof. Extract i18n with `pnpm i18n:extract` before proof, never concurrently with receipt gates.
3. **P3 — Game interruption and final cross-flow proof.** Files: src-tauri/src/game.rs and tests, src/components/boards/BoardGame.tsx and tests, shared game projection helper only if needed, src/translation/ catalogs, src/bindings/generated.ts via exporter, existing e2e game spec or a focused spec using e2e/fixtures.ts, playwright.config.ts only if registering that spec requires it. Own O3 and game O4 cases. Touches concurrency, game identity and IPC, no new persistence. Executor role sensitive, registry leaf.codex.write.sensitive. PROOF: `cargo test --manifest-path src-tauri/Cargo.toml --all-targets --locked -- game::tests && pnpm exec vitest run src/components/boards/BoardGame.test.tsx src/components/boards/gameCommandError.test.ts src/platform/gameTransport.test.ts && pnpm bindings:check && pnpm test:e2e:container && pnpm checks:pre-review && pnpm gates:contract:check`.

For every phase the static importer graph is the test-scope floor. Add affected importer tests when symbols move. Use pnpm bindings:generate for changed Specta types, never hand-edit generated.ts. Root checks complete diffs, reruns proof and commits only owned paths. Phase tests include red-on-revert evidence where isolatable. All writes, tests and phases use the prescribed executor route, not inline root implementation.

After P3: cumulative diff review, repairs and closure rounds, then verify-ui using `pnpm build && pnpm verify:app`, inspect affected container screenshots, and commit review/decision records before final gates. Run `pnpm gates:push -- --rust --frontend --bindings` on the unchanged clean tree, through the drain headless gate route. Then the project push skill checks kit parity and remote CI, pushes non-force, verifies HEAD = upstream, waits for Windows/macOS/MSVC required jobs, and installs only on master. Finally close f-20261001-07 and release validated records through the authorized workflow. This plan-only session stops before Preflight and does none of those operations.

## Carried to diff review

None at initial revision.

## Reviews

### Round 1 — completed

Reviewed revision: RUN_TMP/plan-r1.md at BASE ca0ab68689e0f4de8ca0b84df2be29963bcfc66c. The round reviewed O1–O4 and D1–D5. All 12 plan-capable lenses ran through the selected Codex launcher in read-only mode. review-root-cause and review-code-quality are excluded by their plan-review: false frontmatter.

Plan authorship and arbitration shared one context. Detection ran on the same model family as the planned code executor. Fresh launcher contexts provided independent detection, without model-family diversity. No implementation was created in this run.

Wall elapsed from launch preparation to completed poll: 357 seconds. Known non-overlapping quota, dependency, release or other waits: none observed. Ordinary reviewer polling is included in elapsed. Active review wall time is unknown rather than summed from parallel leaves. Total completed rounds: 1. Adopted lens findings: r1=0. Unique issues opened: 0. Resolved: 0. Open: 0. Closed: 0. No witnesses require a disposition or closure round.

All raw verdicts are APPROVED. pgn-index is a finding-free NOT APPLICABLE row. No prefixed blocker, should-fix or nit findings occurred. No corrections, correction-introduced defects, dependencies, withdrawals, inherited issues, rewrite/split lineage or carried obligations arose. O1–O4 remain implementation obligations. Downstream implementation/final-review rework is not yet applicable.

Arbitration: accept the reviewed plan without revision. Runtime availability, snapshot implementation, byte bounds, late-reply guards, helper extraction and cross-platform runtime proof remain for implementation and cumulative diff review. These named limits are neither executed proof nor waived gates. In particular, verify:app cannot register an engine through the native GTK picker, and proves startup/IPC/shutdown only. The reviewed O4 split requires production-child and renderer/container proof for termination.

Read the full raw reports below before adopting. RUN_TMP retains the frozen plan snapshot, each unchanged launch prompt, JSONL terminal evidence, report and stderr. The planner supplies this complete history as reviews-handoff.md. The adopting session must promote it to the tracked review handoff before final gates, record D1–D5, recheck volatile prerequisites, and carry all three phases through implementation review and proof. This session stops before Preflight.

### Raw reports — round 1

#### review-correctness — sensitive

Raw report from lens-correctness-r1.txt, unchanged:

```text
No correctness defects found in the O1–O4 contracts or traced integration boundaries.

Limitation: snapshot capture timing, byte bounds and late-reply rejection require implementation review. No runtime proof was executed (confidence: 90).

VERDICT: APPROVED
```

#### review-error-handling — sensitive

Raw report from lens-error-handling-r1.txt, unchanged:

```text
No error-handling defects found in O1–O4. The plan preserves typed terminal diagnostics through cleanup, ends failed UI states, guards explicit retry, and recovers interrupted game results through retained snapshots.

VERDICT: APPROVED
```

#### review-minimalism — sensitive

Raw report from lens-minimalism-r1.txt, unchanged:

```text
No plan-level bloat or duplication findings above 80 confidence. O1–O4 stay grounded in the mandate and reuse existing delivery, display, logging and verification boundaries.

Limitation: helper necessity and line-level duplication require the implementation diff (confidence: 100).

VERDICT: APPROVED
```

#### review-plan — review-plan

Raw report from lens-plan-r1.txt, unchanged:

```text
No substantiated plan defects found.

Limitation: runtime prerequisites and proposed regression tests remain unverified because this assignment forbids executing gates or builds (confidence: 100).

VERDICT: APPROVED
```

#### review-tests — sensitive

Raw report from lens-tests-r1.txt, unchanged:

```text
The proposed proof levels cover O1–O4 with observable regression anchors: native serialized diagnostics, terminal analysis UI and retry, and interrupted game results/events/snapshots. Test selectors reach the named suites. The plan correctly limits `verify:app` to startup, IPC and shutdown evidence.

VERDICT: APPROVED
```

#### review-chess-semantics — sensitive

Raw report from lens-chess-semantics-r1.txt, unchanged:

```text
No chess-semantics findings. O3 requires interruption to map to `*`, preserves the final position and moves, and prevents overwriting an existing terminal result. O2 retains full search identity and separates historical lines from active analysis.

This is plan approval only. No files changed or tests run.

VERDICT: APPROVED
```

#### review-engine-protocol — sensitive

Raw report from lens-engine-protocol-r1.txt, unchanged:

```text
No defects found in the plan’s UCI lifecycle, cancellation, generation ownership or asynchronous result-routing contract. Review was read-only. No gates or engine processes were run.

VERDICT: APPROVED
```

#### review-ipc-contract — sensitive

Raw report from lens-ipc-contract-r1.txt, unchanged:

```text
No IPC-contract defects found in O1–O4. The plan preserves registered delivery channels, ownership filters and generated bindings, with explicit proof for payload preservation and terminal recovery.

VERDICT: APPROVED
```

#### review-persisted-state — sensitive

Raw report from lens-persisted-state-r1.txt, unchanged:

```text
No findings within this lens. O2 requires ephemeral state scoped by tab and engine id, with disposal on close/removal and no persisted retry settings. O3 stores the existing `*` result, which the current tree schema and compressed storage reader already accept.

Read-only plan review. No files changed or gates run.

VERDICT: APPROVED
```

#### review-pgn-index — sensitive

Raw report from lens-pgn-index-r1.txt, unchanged:

```text
NOT APPLICABLE: P1–P3 cover engine termination, transient analysis diagnostics and game interruption. O3’s PGN `*` result projection concerns in-memory game semantics. No obligation changes PGN byte scanning, disk indexing, move encoding, database storage or search.

VERDICT: APPROVED
```

#### review-platform-semantics — sensitive

Raw report from lens-platform-semantics-r1.txt, unchanged:

```text
No platform-semantics findings in r1. The plan separates EOF from observed exit and process failure from successful reap, with Unix signal handling gated.

`pnpm rust:windows:check` is required through the gate contract but was not run in this read-only review. The non-Linux Unix source probe is neither specified nor run. Windows/macOS runtime proof remains `rust-windows-test` and `rust-macos-test`. The `rust-platform` matrix provides compile and lint proof only.

VERDICT: APPROVED
```

#### review-tauri-security — sensitive

Raw report from lens-tauri-security-r1.txt, unchanged:

```text
No in-scope plan defects found. O1 requires native sanitization, bounded diagnostic payloads, native-only raw causes and serialized-byte proof. O2–O3 consume that same safe snapshot.

Limitation: this approves the plan contract, not an implementation. Credential/session storage, filesystem mutation and signed downloads are absent from P1–P3.

VERDICT: APPROVED
```


### plan-r3.md

# Plan: Surface engine termination without false game results

## Goal

Close f-20261001-07 by preserving a useful safe engine termination reason, making analysis visibly terminal and retryable, and ending an affected game without falsely assigning a chess winner. This is PLAN-ONLY at ca0ab68689e0f4de8ca0b84df2be29963bcfc66c. Only planning artifacts are written.

## MANDATE

### Engine termination is not surfaced: analysis spins forever, the engine's last `info string` reason is lost, and a game blames the engine with "Abandonment"

* **ID:** f-20261001-07 · **Status:** open · **Area:** engine-uci · **Root:** - · **Entry:** build · **Blocked:** none
* **Where:** `src-tauri/src/engine/process.rs:486` (exit status discarded), `:2574-2576` (actor log), `src-tauri/src/chess.rs:315,593` (`info string` during a search read as "no moves"), `:633-641` (supervisor entry removed, Logs panel empty), `src/components/panels/analysis/BestMoves.tsx:248-305,369-371` (loading skeleton and progress bar stay), `src/components/boards/EvalListener.tsx:415-418` (generic toast), `src-tauri/src/game.rs:2969-2984` (engine side loses by "Abandonment").
* **Defect:** when an engine process exits mid-session, the renderer gets only the fixed "Engine disconnected" text; the analysis panel stays in its loading state indefinitely, the engine's final line (Stockfish 19 prints `info string CRITICAL ERROR: Command … failed. Reason: …` before `exit(1)`) is unreachable from the Logs panel, and a game charges the loss to the engine even when the GUI sent the bad input.
* **Open question:** what owns the final word of a terminated engine — a typed `EngineTerminated { reason }` error carrying the last `info string`/stderr line through the facade, or a retained bounded post-mortem log the Logs panel can still read after the supervisor entry is removed — and what the analysis panel shows instead of the skeleton (error state with retry), and whether a game should end as an engine failure rather than "Abandonment".
* **Why it matters:** any engine crash (SF18 segfaults on some FENs; SF19 terminates on strict-validation failures) leaves the user with a spinner and no reason. The Stockfish 19 upgrade plan removes every known ChessFable input that triggers SF19 termination, so this is the same hazard as before the upgrade, not a regression of it.
* **Found by:** Claude Code (Opus 5.5) Stockfish 19 upgrade planning run, GUI-side UCI audit leaf, 2026-10-01. Related plan: `tasks/plans/2026-10-01-stockfish-19-upgrade.md` (Not part of this task).

## Threat model and non-goals

Ordinary third-party UCI engines can exit, close stdout, reject a command, emit oversized or non-UTF-8 output, or write arbitrary text to stderr. Diagnostic text is untrusted for retention and rendering. Input may contain resource paths, credentials and markup. Safe transport, text rendering and bounds must hold for these inputs. Deliberately evasive secret encodings are outside this task. Linux is the actual product runtime. Windows and macOS retain compile and runtime-test parity through existing CI. Intentional stop, release, supersession, Kill, retirement, tab close and app shutdown remain separate from unexpected termination.

No new watcher, daemon, lifecycle registry, persisted crash archive, automatic restart policy, capability widening, resource-limit change, UCI input-validation redesign or failed-reap ownership redesign. The existing actor, command error path, transient renderer state and native log sink suffice. f-20261001-14 owns failed-reap registry retention. The other open engine findings are separate queued work.

## Traced premises

Frozen Locate evidence at BASE, with read-only reports in RUN_TMP/probe-1-r1.txt and probe-2-r1.txt:

* `src-tauri/src/engine/process.rs:502`: production child wait discards ExitStatus. `:777`: stderr drains to native logging only. `:3338`: stdout enters resource-redacted bounded logs before UCI parsing. `:4398`: search EOF becomes EngineDisconnected. `:3384`: required-exchange EOF does likewise. `:3401`: intentional interruption also returns EngineDisconnected.
* `src-tauri/src/engine/process.rs:4302`: protocol recovery reaps before replying and folds operation/cleanup errors. `src-tauri/src/error.rs:480`: with_cleanup currently flattens both diagnostics to strings. A new typed failure must survive this fold without exposing raw OS diagnostics.
* `src-tauri/src/chess.rs:927`: non-cancellation search failure releases the exact generation. `:845`: logs consult only the live map. Existing runtime logs have 2000-entry/512 KiB bounds, stderr logging has a 512 KiB lifetime budget.
* `src/components/boards/EvalListener.tsx:225`: current-attempt acceptance already checks owner, tab, FEN, moves, settings/go mode, executable identity and close intent. `:388`: rejection sets no-lines only before any usable lines. `:445`: command rejection is the existing terminal delivery channel.
* `src/components/panels/analysis/useDisplayedEngineLines.ts:64`: no-lines suppresses waiting, so the original infinite-skeleton premise is partly fixed. `src/components/panels/analysis/BestMoves.tsx:218`: progress animation still has no failed-terminal condition.
* `src/state/atoms.ts:862`: analysis lines/progress/no-lines are ephemeral per tab/engine. `:1039`: disposal removes them. `src/components/panels/analysis/AnalysisPanel.tsx:315` and `src/components/common/DetachedEval.tsx:61` share the display hook.
* `src-tauri/src/game.rs:2930`: non-cancelled engine-task errors and join failures award Abandonment. `:867`: the terminal event is attempted once. `:1738`: exact-session state queries recover retained terminal snapshots.
* `src/components/boards/BoardGame.tsx:84`: result projection defaults all non-win variants to a draw. `:480` and `:957`: snapshot and event termination paths share owner/revision rules but separately apply terminal state.
* `src/components/panels/analysis/ReportModal.tsx:190`: rejection guards owner epoch but not current operation identity. Reports consume the same native failure boundary and must not surface a retired operation's diagnostic.
* `src/platform/errors.ts:193`: tagged errors preserve backend category. `:233`: safeFailureContext re-redacts retained text. `src/components/panels/analysis/LogsPanel.tsx:21`: live logs are keyed by tab/engine and notify query failures once.

## Approach

### O1 — One safe terminal snapshot from the native actor

Authority: MANDATE "the engine's last `info string` reason is lost" and "what owns the final word of a terminated engine".

Capture one actor-owned terminal snapshot before its child/runtime/transcript are consumed. Distinguish unexpected EOF/disconnection from observed process exit, protocol failure and intentional interruption. Record a portable optional exit code and a Unix signal only when observed. An unknown exit status stays unknown. EOF alone must not falsely assert the process exited. Keep process failure separate from cleanup/reap success. Do not turn a nonzero exit into a failed reap when the child has actually been reaped.

Keep bounded last stdout `info string` and stderr tails while the runtime exists, including after the stderr native-logging budget is exhausted. Update the tails without blocking Tokio workers or holding a lock across await. The captured snapshot remains accessible to surviving actor clones after the task ends. Use the existing stderr join bounds and teardown deadlines, and do not add polling or change cancellation deadlines. Select the last useful `info string` first, then the last stderr line, then a localized failure-kind/exit-status fallback. This priority avoids inventing ordering between separate pipes.

The IPC snapshot carries safe failure kind, optional observed exit metadata, a safe reason of at most 2048 UTF-8 bytes, and at most 32 terminal diagnostic entries totaling 16 KiB including strings and truncation markers. The native snapshot is one per actor, and the renderer retains one per owned tab/engine. Raw OS error chains remain native-only. Sanitize all engine text before it can enter the IPC snapshot, applying existing lifetime resource-provenance redaction plus credential/path redaction and text-only rendering. Late resource-redaction additions also sanitize previously captured tails. Preserve useful chess notation and ordinary engine failure wording. No raw stderr or diagnostic() value is serialized. Tests inspect native serialized bytes, so renderer redaction alone is insufficient.

Use a typed engine-failure error with optional safe snapshot in the existing tagged ErrorPayload and an exhaustive facade mapping. It reaches interactive searches through their existing promise rejection, and reports/game callers through their existing error paths. Shared and operation-plus-cleanup wrappers preserve the typed snapshot while separately retaining native cleanup diagnostics and renderer-safe labels. Existing deliberate-interruption EngineDisconnected/Cancellation semantics of d-20261008-11 remain unchanged. A cancelled or stale request cannot produce a crash surface, and cleanup failure must never be converted to cancellation or success. Real EOF/error snapshots survive exact-generation cleanup, including readiness/initialization failure. No new broadcast event is needed.

### O2 — Sticky analysis failure, safe Logs view and explicit retry

Authority: MANDATE "analysis panel stays in its loading state indefinitely", "error state with retry", and final reason "unreachable from the Logs panel".

Replace the no-lines-only terminal representation with one ephemeral per-tab/per-engine terminal state covering completed-without-lines and failed-with-safe-snapshot. Associate it with the complete existing attempt fingerprint, searched key/context, executable identity and native search generation. All result and failure acceptance runs through the current-attempt guard. A failed terminal attempt rejects subsequent late line/progress updates. New attempts, retry, owner disposal and context replacement retire the old display state. Tab close and engine unload/removal clear the associated state, without adding persistence or a background owner set.

The shared display hook drives BestMoves, EngineSummary and DetachedEval consistently. Failure always ends waiting, skeletons, progress animation and live speed claims, including failure after partial lines. Valid remembered lines may remain visible as historical evaluation with an explicit failure indicator. They do not appear to be an active search. Existing normal/threat separation, 1000 ms loading delay and 256-position memory remain unchanged for healthy searches. A current failure remains visible until a genuinely new attempt or owner/context disposal.

BestMoves renders localized failure text, its safe reason and a Retry control. Retry changes an ephemeral retry discriminator and reserves a fresh native generation even when FEN/settings match. It reuses the existing serialized stop/prepare transition and never mutates persisted settings or retries automatically. EngineSummary/DetachedEval show the same failed status through the shared hook. Existing engine/type/owner guards keep a local failure from attaching to a remote engine or another tab.

LogsPanel displays the retained safe terminal entries for the selected failed owner, explicitly labelled as terminal diagnostics, even after the supervisor removes the live actor. A successful new attempt clears that terminal selection. Live log fetch errors remain errors under d-20260901-32, never empty success. Use the existing EngineLogsView for diagnostic rendering. No native supervisor archive is needed. ReportModal/ReportPanel retain their separate operation state but consume the same typed safe failure and apply operation/root-fingerprint guards on failures, preventing an older operation from notifying against its successor.

### O3 — Interrupted game, no fabricated chess result

Authority: MANDATE "a game charges the loss to the engine even when the GUI sent the bad input" and "whether a game should end as an engine failure rather than Abandonment".

Introduce an explicit interrupted GameResult variant for a non-cancelled engine-task failure, carrying a safe failure reason/snapshot from O1 where available. Join failure gets a generic safe engine-task-failed reason, never raw JoinError text. An interrupted game has no winner and is not a draw. Its PGN/tree result is `*`. Human resignation, timeout, checkmate, actual draw and existing deliberate abort behavior keep their contracts.

Apply one authoritative terminal transition only while the controller is Playing. Clear engine_thinking, preserve the final board and moves, stop clocks/work, attempt the existing GameOver event once, and retain the same interrupted result and safe reason in exact-session finished snapshots. Timeout/resignation/close/replacement races cannot overwrite an already terminal result. Keep cleanup exact-generation and report its actual outcome, without undertaking f-20261001-14.

BoardGame applies events and recovered finished snapshots through one shared terminal projection with existing game/session/UI-generation/revision guards. Map every GameResult variant exhaustively, with interruption mapping to `*`. Retain an ephemeral localized reason in the completed board UI, preserving completion ownership release and stale-playing-snapshot rejection. Show terminal diagnostics through the existing shared logs view if available, with owner identity retained as display data rather than abortable native ownership. Duplicate event/query delivery produces one visible terminal state and no duplicate notification. A subsequent game clears the old failure.

### O4 — Behavior proof at the real boundaries

Authority: MANDATE requires surfaced termination, not merely a matching type. Rules require actual IPC/runtime and visual evidence.

Native deterministic actor tests cover diagnostic selection, observed/unknown exit metadata, bounds/UTF-8, stdout/stderr redaction, exhausted stderr logging, intentional interruption, failed cleanup and stale exact generations. Add actual controlled child-exit tests through production IO where existing fixture seams permit. Platform-neutral fakes cover portable semantics on every OS. Unix signal cases are cfg-gated and not used as Windows/macOS exit evidence. Game tests drive the production engine-completion/game-loop integration, event and retained snapshot behavior, and terminal races. Do not prove behavior by source-string assertions.

Renderer tests mount the actual listener/display/game owners. Prove failure before/after partial lines, sticky terminal state, matching owner filters, two engines sharing name/path, same-position Retry, late old results/rejections, unloaded owner cleanup, safe Logs view, detached/summary consistency, report replacement and lost GameOver recovery. New regression tests must fail against BASE source with only those tests present, then pass with the fix. Take reverts from Git, isolate intended production hunks, and never transcribe a pre-fix implementation.

Extend existing e2e/engine-gap.spec.ts and its shared fixture to inject typed failures through existing pending command rejection, exercise visible failure/retry/terminal logs and preserve healthy dimmed-line coverage. Add game interruption coverage through the existing game fixture surface. Keep canonical container snapshots. Use the existing off-screen Tauri harness for real startup, IPC and shutdown proof after a release build. Its native GTK picker cannot register an engine, so do not claim that verify:app alone proves live crash propagation. Native production-child tests plus renderer/e2e boundary tests establish that split, following d-20260908-05. No new registration command or diagnostic service is authorized.

## Decisions and trade-offs

Entry revalidation retains build: native failure ownership, safe cross-layer payload, retry semantics and game results remain coupled design questions. The already-shipped no-lines marker resolves only the first-loading symptom. The original entry is not mutated by this planner.

Binding precedent: d-20260904-05/-06/-07 (tagged native categories), d-20260901-30/-32 (one supervisor and truthful logs), d-20260911-01/-07 and d-20260927-09 (provenance redaction, native-only raw diagnostics), d-20261005-13/-14/-15/-16 (warm ownership, search generation, memory and shared display), d-20261008-11/-12/-13/-14 (interruption/reap/graceful release), d-20260908-05/-06 and d-20260909-02 (proof limits and terminal snapshot reconciliation). These are inputs, not reopened questions.

## Decided autonomously

* D1. Question: typed terminal reason or supervisor post-mortem archive? Chosen: actor-owned bounded snapshot in the existing typed error, retained by current renderer ownership for failure/Logs display. Rejected: persistent or supervisor-wide archive and new termination event. Reason: the search promise already owns delivery and a current failure is all the mandate needs. Reversal: replace only the snapshot delivery/retention boundary with a separately justified archive.
* D2. Question: retain raw engine text or provide safe diagnostic excerpts? Chosen: bounded native-sanitized excerpts and observed exit metadata, keeping raw OS causes in native logging. Rejected: raw diagnostic serialization and renderer-only sanitization. Reason: d-20260911-01/-07 and d-20260927-09 govern egress. Reversal: change the native display sanitization contract only with equivalent serialized-byte proof.
* D3. Question: retry automatically, use pause/resume, or expose Retry? Chosen: explicit localized Retry using a fresh reserved generation and transient discriminator. Rejected: automatic retries and persisted setting changes. Reason: mandate names error state with retry, current generation ownership already provides the restart boundary. Reversal: change the control behavior and its owner tests.
* D4. Question: should engine failure award a win, draw, or interrupt the game? Chosen: interrupted terminal result with PGN `*`, preserved moves and safe reason. Rejected: Abandonment loss or fabricated draw. Reason: mandate rejects attributing a GUI-triggered failure to an engine, and existing game reconciliation never fabricates an outcome. This is the full-auto recommendation, not an answer attributed to Felix. Reversal: explicitly revise the failure-result policy and exhaustive projection.
* D5. Question: who accepts the visible behavior and live-engine proof? Chosen: agent-owned unit/integration tests, canonical container screenshots and real off-screen Tauri startup/IPC/shutdown, naming the picker limitation. Rejected: Felix repeating deterministic races, Chrome MCP on Vite, or claiming mocked IPC is live-child evidence. Reason: full auto and d-20260908-05. Reversal: use an existing authorized live-engine registration route if one is later added.

The adopting session records D1–D5 via findings.py before implementation. This planner does not mutate decisions.md.

## Risks / open questions

No unresolved product question remains within this full-auto mandate. Cross-pipe diagnostic arrival has no total ordering, so O1 declares deterministic priority. EOF may occur while a child survives, and teardown remains responsible for the child. Failed-reap retention remains f-20261001-14 rather than being hidden by diagnostic retention. Egress sanitization is security-sensitive and receives the security lens. The implementation must preserve metadata through Error::with_cleanup rather than silently flattening it.

Locate confirmed Codex CLI 0.162.0, clean BASE snapshot, ignored tasks/plans, and WebKitWebDriver, tauri-driver, kwin_wayland and Docker binaries. Docker availability, GStreamer runtime support, released-kit parity and remote CI are not yet verified. Adoption rechecks all volatile prerequisites before source work and release. No gate, build, browser, dev server or generator ran in this planner.

## Not part of this task

Failed-reap retry/registry ownership (f-20261001-14), independent shutdown/admission and existing channel-closed findings, a general log archive/export UI, fixing every historical engine finding, native GTK dialog automation, lowered coverage floors/bundle budgets, or a host-recorded screenshot baseline.

## Phases

Sequential cohesive phases. P1 provides the shared native contract for both consumers. P2 and P3 depend on P1 and run sequentially because the worktree and generated bindings are shared. Every phase includes tests and bindings regeneration where needed, leaves changes unstaged for root inspection, and ends green and independently committable.

1. **P1 — Native terminal contract and facade.** Files: src-tauri/src/engine/process.rs, src-tauri/src/engine/types.rs and exports if required, src-tauri/src/error.rs, src-tauri/src/chess.rs, src/platform/errors.ts and tests, src/bindings/generated.ts via exporter only. Own O1 and its native/facade O4 cases. Touches concurrency, IPC and diagnostic egress, no persistence. Executor role sensitive, registry leaf.codex.write.sensitive. PROOF: `cargo test --manifest-path src-tauri/Cargo.toml --all-targets --locked -- engine::process && cargo test --manifest-path src-tauri/Cargo.toml --all-targets --locked -- chess::tests && cargo test --manifest-path src-tauri/Cargo.toml --all-targets --locked -- error::tests && pnpm exec vitest run src/platform/errors.test.ts src/platform/failureDiagnostic.test.ts && pnpm bindings:check && pnpm checks:pre-review && pnpm gates:contract:check`.
2. **P2 — Analysis terminal display, logs and retry.** Files: src/components/boards/EvalListener.tsx and tests, src/components/panels/analysis/{useDisplayedEngineLines,BestMoves,AnalysisPanel,LogsPanel,ReportModal,ReportPanel} and tests, src/components/common/DetachedEval.tsx and tests, src/state/atoms.ts and its analysis tests, src/utils/engines.ts/controller tests if integration requires it, src/translation/ catalogs, e2e/engine-gap.spec.ts, e2e/fixtures.ts and affected snapshots. Own O2 and its O4 cases. Touches runtime ownership and IPC consumption, existing persistence unchanged. Executor role sensitive, registry leaf.codex.write.sensitive. PROOF: `pnpm exec vitest run src/components/boards/EvalListener.test.tsx src/components/panels/analysis/useDisplayedEngineLines.test.tsx src/components/panels/analysis/BestMoves.test.tsx src/components/panels/analysis/AnalysisPanel.test.tsx src/components/panels/analysis/LogsPanel.test.tsx src/components/panels/analysis/ReportModal.test.tsx src/components/panels/analysis/ReportPanel.test.tsx src/state/atoms.analysis.test.ts src/utils/engines.controller.test.ts && pnpm test:e2e:container --project=engine-gap && pnpm checks:pre-review && pnpm gates:contract:check`. Add any newly created DetachedEval test to the phase proof. Extract i18n with `pnpm i18n:extract` before proof, never concurrently with receipt gates.
3. **P3 — Game interruption and final cross-flow proof.** Files: src-tauri/src/game.rs and tests, src/components/boards/BoardGame.tsx and tests, shared game projection helper only if needed, src/translation/ catalogs, src/bindings/generated.ts via exporter, existing e2e game spec or a focused spec using e2e/fixtures.ts, playwright.config.ts only if registering that spec requires it. Own O3 and game O4 cases. Touches concurrency, game identity and IPC, no new persistence. Executor role sensitive, registry leaf.codex.write.sensitive. PROOF: `cargo test --manifest-path src-tauri/Cargo.toml --all-targets --locked -- game::tests && pnpm exec vitest run src/components/boards/BoardGame.test.tsx src/components/boards/gameCommandError.test.ts src/platform/gameTransport.test.ts && pnpm bindings:check && pnpm test:e2e:container && pnpm checks:pre-review && pnpm gates:contract:check`.

For every phase the static importer graph is the test-scope floor. Add affected importer tests when symbols move. Use pnpm bindings:generate for changed Specta types, never hand-edit generated.ts. Root checks complete diffs, reruns proof and commits only owned paths. Phase tests include red-on-revert evidence where isolatable. All writes, tests and phases use the prescribed executor route, not inline root implementation.

After P3: cumulative diff review, repairs and closure rounds, then verify-ui using `pnpm build && pnpm verify:app`, inspect affected container screenshots, and commit review/decision records before final gates. Run `pnpm gates:push -- --rust --frontend --bindings` on the unchanged clean tree, through the drain headless gate route. Then the project push skill checks kit parity and remote CI, pushes non-force, verifies HEAD = upstream, waits for Windows/macOS/MSVC required jobs, and installs only on master. Finally close f-20261001-07 and release validated records through the authorized workflow. This plan-only session stops before Preflight and does none of those operations.

## Carried to diff review

None at initial revision.

## Reviews

### Round 1 — completed

Reviewed revision: RUN_TMP/plan-r1.md at BASE ca0ab68689e0f4de8ca0b84df2be29963bcfc66c. The round reviewed O1–O4 and D1–D5. All 12 plan-capable lenses ran through the selected Codex launcher in read-only mode. review-root-cause and review-code-quality are excluded by their plan-review: false frontmatter.

Plan authorship and arbitration shared one context. Detection ran on the same model family as the planned code executor. Fresh launcher contexts provided independent detection, without model-family diversity. No implementation was created in this run.

Wall elapsed from launch preparation to completed poll: 357 seconds. Known non-overlapping quota, dependency, release or other waits: none observed. Ordinary reviewer polling is included in elapsed. Active review wall time is unknown rather than summed from parallel leaves. Total completed rounds: 1. Adopted lens findings: r1=0. Unique issues opened: 0. Resolved: 0. Open: 0. Closed: 0. No witnesses require a disposition or closure round.

All raw verdicts are APPROVED. pgn-index is a finding-free NOT APPLICABLE row. No prefixed blocker, should-fix or nit findings occurred. No corrections, correction-introduced defects, dependencies, withdrawals, inherited issues, rewrite/split lineage or carried obligations arose. O1–O4 remain implementation obligations. Downstream implementation/final-review rework is not yet applicable.

Arbitration: accept the reviewed plan without revision. Runtime availability, snapshot implementation, byte bounds, late-reply guards, helper extraction and cross-platform runtime proof remain for implementation and cumulative diff review. These named limits are neither executed proof nor waived gates. In particular, verify:app cannot register an engine through the native GTK picker, and proves startup/IPC/shutdown only. The reviewed O4 split requires production-child and renderer/container proof for termination.

Read the full raw reports below before adopting. RUN_TMP retains the frozen plan snapshot, each unchanged launch prompt, JSONL terminal evidence, report and stderr. The planner supplies this complete history as reviews-handoff.md. The adopting session must promote it to the tracked review handoff before final gates, record D1–D5, recheck volatile prerequisites, and carry all three phases through implementation review and proof. This session stops before Preflight.

### Raw reports — round 1

#### review-correctness — sensitive

Raw report from lens-correctness-r1.txt, unchanged:

```text
No correctness defects found in the O1–O4 contracts or traced integration boundaries.

Limitation: snapshot capture timing, byte bounds and late-reply rejection require implementation review. No runtime proof was executed (confidence: 90).

VERDICT: APPROVED
```

#### review-error-handling — sensitive

Raw report from lens-error-handling-r1.txt, unchanged:

```text
No error-handling defects found in O1–O4. The plan preserves typed terminal diagnostics through cleanup, ends failed UI states, guards explicit retry, and recovers interrupted game results through retained snapshots.

VERDICT: APPROVED
```

#### review-minimalism — sensitive

Raw report from lens-minimalism-r1.txt, unchanged:

```text
No plan-level bloat or duplication findings above 80 confidence. O1–O4 stay grounded in the mandate and reuse existing delivery, display, logging and verification boundaries.

Limitation: helper necessity and line-level duplication require the implementation diff (confidence: 100).

VERDICT: APPROVED
```

#### review-plan — review-plan

Raw report from lens-plan-r1.txt, unchanged:

```text
No substantiated plan defects found.

Limitation: runtime prerequisites and proposed regression tests remain unverified because this assignment forbids executing gates or builds (confidence: 100).

VERDICT: APPROVED
```

#### review-tests — sensitive

Raw report from lens-tests-r1.txt, unchanged:

```text
The proposed proof levels cover O1–O4 with observable regression anchors: native serialized diagnostics, terminal analysis UI and retry, and interrupted game results/events/snapshots. Test selectors reach the named suites. The plan correctly limits `verify:app` to startup, IPC and shutdown evidence.

VERDICT: APPROVED
```

#### review-chess-semantics — sensitive

Raw report from lens-chess-semantics-r1.txt, unchanged:

```text
No chess-semantics findings. O3 requires interruption to map to `*`, preserves the final position and moves, and prevents overwriting an existing terminal result. O2 retains full search identity and separates historical lines from active analysis.

This is plan approval only. No files changed or tests run.

VERDICT: APPROVED
```

#### review-engine-protocol — sensitive

Raw report from lens-engine-protocol-r1.txt, unchanged:

```text
No defects found in the plan’s UCI lifecycle, cancellation, generation ownership or asynchronous result-routing contract. Review was read-only. No gates or engine processes were run.

VERDICT: APPROVED
```

#### review-ipc-contract — sensitive

Raw report from lens-ipc-contract-r1.txt, unchanged:

```text
No IPC-contract defects found in O1–O4. The plan preserves registered delivery channels, ownership filters and generated bindings, with explicit proof for payload preservation and terminal recovery.

VERDICT: APPROVED
```

#### review-persisted-state — sensitive

Raw report from lens-persisted-state-r1.txt, unchanged:

```text
No findings within this lens. O2 requires ephemeral state scoped by tab and engine id, with disposal on close/removal and no persisted retry settings. O3 stores the existing `*` result, which the current tree schema and compressed storage reader already accept.

Read-only plan review. No files changed or gates run.

VERDICT: APPROVED
```

#### review-pgn-index — sensitive

Raw report from lens-pgn-index-r1.txt, unchanged:

```text
NOT APPLICABLE: P1–P3 cover engine termination, transient analysis diagnostics and game interruption. O3’s PGN `*` result projection concerns in-memory game semantics. No obligation changes PGN byte scanning, disk indexing, move encoding, database storage or search.

VERDICT: APPROVED
```

#### review-platform-semantics — sensitive

Raw report from lens-platform-semantics-r1.txt, unchanged:

```text
No platform-semantics findings in r1. The plan separates EOF from observed exit and process failure from successful reap, with Unix signal handling gated.

`pnpm rust:windows:check` is required through the gate contract but was not run in this read-only review. The non-Linux Unix source probe is neither specified nor run. Windows/macOS runtime proof remains `rust-windows-test` and `rust-macos-test`. The `rust-platform` matrix provides compile and lint proof only.

VERDICT: APPROVED
```

#### review-tauri-security — sensitive

Raw report from lens-tauri-security-r1.txt, unchanged:

```text
No in-scope plan defects found. O1 requires native sanitization, bounded diagnostic payloads, native-only raw causes and serialized-byte proof. O2–O3 consume that same safe snapshot.

Limitation: this approves the plan contract, not an implementation. Credential/session storage, filesystem mutation and signed downloads are absent from P1–P3.

VERDICT: APPROVED
```

### Round 2 — PLAN-REFRESH drift review completed

Old BASE: ca0ab68689e0f4de8ca0b84df2be29963bcfc66c. NEW-BASE: 86305a389c9acbef03af6489a6761f7e0e2ca157. This resumes the published round-1 lineage. The current checkout is already at NEW-BASE, with no uncommitted source or ledger work to commit. Before refresh, the approved plan, metadata and full history were preserved under RUN_TMP/refresh-before-r2.

The exact process-generated source drift is RUN_TMP/drift-ca0ab68689e0f4de8ca0b84df2be29963bcfc66c-86305a389c9acbef03af6489a6761f7e0e2ca157.diff. It changes database/search/progress code, repertoire caching and coordination records. It does not change the plan's primary engine/native-error/game/analysis source scopes or proof configuration. Shared begin_progress still returns the original lease atomically and preserves terminal/drop ownership, now also after initial event-delivery failure. The report caller's boolean novelty contract remains intact.

Plan-body comparison against plan-r1.md emitted UNCHANGED with exit 3. No plan revision or revision-closure round was invented. Round 2 is the explicit mandatory source-drift round, with both SHAs, the actual drift, cumulative history and no open issues in every prompt. The previously filed f-20261009-05 records the generic re-review-packet ambiguity. That separate workflow finding is not reopened or duplicated here.

All 12 requested drift lenses completed through the selected Codex read-only launcher. Every raw verdict is APPROVED. persisted-state and pgn-index are finding-free NOT APPLICABLE rows. No prefixed blocker, should-fix or nit finding occurred, including no out-of-drift finding requiring a Defer. No issue IDs opened or resolved. No Fix, Skip, Defer, corrective mechanism, dependency, withdrawal or carried obligation arose. The approved O1–O4 and autonomous D1–D5 stand unchanged.

Wall elapsed from round start to completed poll and report inspection: 169 seconds. Known non-overlapping quota, dependency, release or other waits: none observed. Ordinary polling while reviewers work is included. Active review wall time is unknown rather than summed from leaf durations. Cumulative completed rounds: 2. Adopted lens findings: r1=0 r2=0. Inherited unique issues: 0. New unique issues: 0. Total unique opened/resolved/open/closed: 0/0/0/0. No rewrite or split. Downstream implementation/final-review rework remains not applicable.

Arbitration: the approved implementation contract remains valid at NEW-BASE. Runtime and final-gate proof has not run in this planner. Source evidence for the shared report boundary is src-tauri/src/progress.rs begin_progress/begin_progress_with_emitter and src-tauri/src/chess.rs:1346. The release prerequisite remains unavailable under f-20261009-04, Blocked: github-actions-available. Its NEW-BASE ledger occurrence records HTTP 422 dispatch refusal and missing current-SHA Windows/macOS/platform conclusions. This is an existing external service prerequisite, not a new source defect or product decision. Adoption must recheck it before dependent implementation/release work under the existing preflight refusal and drain deferral contract. No remote workflow or policy was changed by this refresh.

Plan authorship and arbitration shared one context. Detection ran in fresh launcher contexts on the same model family as the planned code executor. No code was implemented. PLAN-REFRESH stops before Preflight, with no commit, ledger mutation, push, server or browser. The adopter records D1–D5, preserves both review rounds as a tracked handoff, and runs all implementation/proof obligations.

### Raw reports — round 2

#### review-correctness — sensitive

Raw report from lens-correctness-r2.txt, unchanged:

```text
No correctness drift invalidates O1–O4. The shared progress changes preserve report lease identity and terminal handling. Database presence changes preserve the report caller’s boolean contract.

Limitation: this reviews drift compatibility only. Implementation and runtime proof remain unverified (confidence: 100).

VERDICT: APPROVED
```

#### review-error-handling — sensitive

Raw report from lens-error-handling-r2.txt, unchanged:

```text
No error-handling drift invalidation of O1–O4 found. Shared progress changes preserve report ownership and failure propagation. Best-effort delivery failures retain native diagnostics under the supplied decisions.

Read-only review. No files changed or tests run.

VERDICT: APPROVED
```

#### review-minimalism — sensitive

Raw report from lens-minimalism-r2.txt, unchanged:

```text
No bloat or duplication drift invalidates O1–O4. The database, repertoire and shared progress changes neither replace the planned engine-failure contract nor require additional scope.

VERDICT: APPROVED
```

#### review-plan — review-plan

Raw report from lens-plan-r2.txt, unchanged:

```text
No drift invalidation of O1–O4 found. Shared progress and novelty dependencies preserve the planned contracts. P1–P3 source scopes and proof configuration are unchanged.

Limitation: no runtime checks ran. `tasks/findings.md:14338` records unavailable platform CI under f-20261009-04, leaving O4’s cross-platform proof dependent on restored execution (confidence: 100).

VERDICT: APPROVED
```

#### review-tests — sensitive

Raw report from lens-tests-r2.txt, unchanged:

```text
No drift invalidates O1–O4’s approved proof obligations. Test selectors, CI configuration, container fixtures and the Tauri harness are unchanged. The shared progress changes preserve the report integration boundary.

Implementation assertions and red-on-revert evidence remain pending. No tests ran in this read-only review.

VERDICT: APPROVED
```

#### review-chess-semantics — sensitive

Raw report from lens-chess-semantics-r2.txt, unchanged:

```text
No chess-semantics drift invalidation found. The repertoire changes preserve FEN keys and move paths. The drift does not alter O2’s analysis position identity or O3’s final board, moves and interrupted result contract.

Read-only review. No files changed or gates run.

VERDICT: APPROVED
```

#### review-engine-protocol — sensitive

Raw report from lens-engine-protocol-r2.txt, unchanged:

```text
No engine-protocol drift findings. Shared progress changes preserve report ownership and do not invalidate O1–O4’s termination, cancellation or result-routing obligations.

Read-only review. No files changed, gates run or engine processes started.

VERDICT: APPROVED
```

#### review-ipc-contract — sensitive

Raw report from lens-ipc-contract-r2.txt, unchanged:

```text
No IPC-contract drift invalidates O1–O4. Shared progress retains registered delivery, matching payload units and generation filtering. Engine-error and game-result boundaries are unchanged.

Read-only review. No files changed or gates run.

VERDICT: APPROVED
```

#### review-persisted-state — sensitive

Raw report from lens-persisted-state-r2.txt, unchanged:

```text
NOT APPLICABLE: The drift changes native database/progress code and repertoire request ownership, with no changes to renderer storage, atom families, hydration or tab lifecycle that could invalidate O1–O4.

VERDICT: APPROVED
```

#### review-pgn-index — sensitive

Raw report from lens-pgn-index-r2.txt, unchanged:

```text
NOT APPLICABLE: P1–P3 cover engine termination, analysis display and game result projection. O3’s PGN `*` requirement concerns the in-memory result projection. No obligation changes PGN byte scanning, disk indexing, encoding, storage or search within this lens.

VERDICT: APPROVED
```

#### review-platform-semantics — sensitive

Raw report from lens-platform-semantics-r2.txt, unchanged:

```text
No platform-semantics drift invalidates approved obligations O1–O4. No findings.

Read-only review. No files changed or gates run. `pnpm rust:windows:check` and the non-Linux Unix source probe were not run. Windows/macOS runtime proof remains pending through `rust-windows-test` and `rust-macos-test`. The drift records unavailable CI execution. `rust-platform` provides compile/lint proof only.

VERDICT: APPROVED
```

#### review-tauri-security — sensitive

Raw report from lens-tauri-security-r2.txt, unchanged:

```text
No security finding in the drift invalidates O1–O4. Changed progress diagnostics remain native-only.

Limitation: this is plan drift review, not implementation verification. Credential/session storage, filesystem mutation and signed-download contracts are unchanged.

VERDICT: APPROVED
```

## Adoption, implementation and diff review (adopting drain session 789f2f5a-cecf-48c9-be14-da27602ae6e9, 2026-10-12)

Adopted through `drain_supervisor_plans.py gate` (result `clear`, selection 87fa348c1f4f4e8081c240db9bb557d8) at BASE ced73bdf. The plan was copied to `tasks/plans/2026-10-12-engine-termination-surface.md` (ignored run artefact). D1–D5 were recorded as d-20261012-04 … d-20261012-08 before implementation. The volatile prerequisites named in r2/r3 were rechecked: f-20261009-04 (github-actions-available) is handled since 2026-10-10, Docker 29.9.0, WebKitWebDriver, kwin_wayland and tauri-driver are present, released-kit parity (`findings:kit:check`) passed, Codex CLI 0.162.1.

### Phases

| Phase | Commit | Writer | Review rounds | Proof (orchestrator-run) |
|---|---|---|---|---|
| P1 native terminal snapshot, typed EngineFailure, facade | 22d45745 | Codex write leaf, sensitive | 0 | engine::process 201, chess::tests 79, error::tests 32, full cargo 2181, vitest 3309, bindings:check, pre-review, contract — all exit 0 |
| P2 analysis terminal state, Retry, Logs, reports, e2e | dda58b5a | Codex write leaf, sensitive | 1 (restored the `Window.Restore` key that `pnpm i18n:extract` deleted; no-snapshot failure text; Logs toolbar clipping) | vitest 3343, tsgo, i18n:check, container e2e 110, pre-review, contract — all exit 0 |
| P3 GameResult::Interrupted, BoardGame projection, game Logs | 6d0fd79d | Codex write leaf, sensitive | 1 review (own-cancellation only; game terminal logs) + 2 mechanical (clippy type alias, two hook deps); orchestrator ran rustfmt/oxfmt | full cargo, vitest 3349, tsgo, i18n, bindings, container e2e 112, pre-review, contract — all exit 0 |

Out-of-area finding filed during P2 review: `pnpm i18n:extract` deletes the live `Window.Restore` key because `TopBar.tsx` selects it through a ternary inside one `t()` call (inbox entry, area i18n, entry inline).

### Diff review round 1 — REVIEWED_THROUGH 6d0fd79d

Range ced73bdf..6d0fd79d. Thirteen lenses on the Codex executor (OpenAI high tier, read-only, sensitive role; records lens mechanical role): correctness, root-cause, tests, code-quality, error-handling, minimalism, engine-protocol, ipc-contract, persisted-state, chess-semantics, platform-semantics, tauri-security, records. pgn-index not selected (no PGN scanning/index/storage path in the diff).

| ID | Lens | Claim | Disposition | Closure |
|---|---|---|---|---|
| DR1-01 | engine-protocol (blocker) | `stop_current` reports Ok for a terminated actor, so the supervisor retains and reuses a dead actor and the next search inherits the old snapshot | Fix — confirmed at process.rs stop_or_release/start_interactive_search | e9788213 |
| DR1-02 | root-cause (blocker) + should-fix evidence | final `info string` queued in stdout is lost when the next write fails before it is read | Fix | e9788213 (bounded stdout drain, FakeIo and production-child regressions) |
| DR1-03 | tauri-security (blocker) | compound credential keys (accessToken, apiKey, Authorization) survive the terminal sanitizer | Fix | e9788213 |
| DR1-04 | tauri-security (blocker) | live transcripts (`get_engine_logs`) are not path/credential sanitized | Skip (settled by d-20260911-01: live transcripts redact resource provenance; path-shaped guessing was rejected) | — |
| DR1-05 | error-handling (blocker) | cancelled game-engine task drops stop/reap failures silently | Fix — log natively; game behaviour unchanged | e9788213 (plus the same class at the rejected-registration stop) |
| DR1-06 | error-handling (should-fix) | report/analysis text drops the cleanup-also-failed warning | Fix | 46675665 (Board.Analysis.EngineCleanupFailed) |
| DR1-07 | minimalism (should-fix) | actor loop repeats recover/reply/terminate in five handlers | Fix | e9788213 (complete_exchange) |
| DR1-08 | minimalism (should-fix) | ReportPanel duplicates isCurrentOperation | Fix | 46675665 |
| DR1-09 | minimalism (should-fix) | engine-gap spec duplicates setup | Fix | 46675665 |
| DR1-10 | persisted-state (blocker) | interruption held in component state is lost when the inactive tab unmounts | Fix | 46675665 (per-owner-tab in-memory atom, disposed with the tab) |
| DR1-11 | chess-semantics (blocker) | castling alias e1h1/e1g1 leaves a stale mainline in syncTreeWithMoves (pre-existing) | Fix | 46675665 (normalizeMove comparison) |
| DR1-12 | orchestrator + tests (should-fix) | failed engine colour from children[0] walk; no two-engine odd-move test | Fix | 46675665 (last native fenAfter) |
| DR1-13 | code-quality (blocker rank, pre-existing) | bare 100 ms clock interval in game loop | Fix | e9788213 |
| DR1-14 | tests (should-fix) | chess.rs snapshot test bypasses get_best_moves_core cleanup branch | Fix | e9788213 |
| DR1-15 | records (should-fix) | decisions cite this handoff before it existed | Fix | this file |

Repairs also hit two gates, both fixed before commit: oxfmt layout of the hand-added catalogue key, and the total bundle ceiling (+487 B). The ceiling was raised by 10,000 B under d-20261012-09 with published-base and candidate measurements (44f53272).

### Raw reports — diff round 1

#### review-correctness

Raw report from lens-correctness-r1.txt, unchanged:

```text
No concrete correctness defects found. BoardGame synchronizes backend moves into the mainline before deriving the failed engine’s colour, so the supplied observation does not establish incorrect attribution.

Limitation: OS-specific exit/reap behavior and React scheduling interleavings were inspected statically, not executed in this read-only review (confidence: 100).

VERDICT: APPROVED
```

#### review-root-cause

Raw report from lens-root-cause-r1.txt, unchanged:

```text
[blocker] src-tauri/src/engine/process.rs:4692 — Final stdout diagnostics can still be lost. If an engine prints its fatal `info string` and exits before the next `go` or `isready` write, the write failure triggers recovery before stdout is read. Teardown drains only stderr, then freezes diagnostics already consumed. Analysis and games therefore receive an older reason or generic fallback despite the final reason remaining queued in stdout. The fix leaves diagnostic capture dependent on successful protocol progression. (confidence: 95)

[should-fix] src-tauri/src/engine/process.rs:5188 — Verification limitation: supplied evidence establishes passing-after results but contains no observed failing-before regression run. The production-child test covers a successful initial write followed by EOF, leaving the write-failure/unread-final-output mechanism unpinned. Add that regression and provide its failing-before/passing-after evidence. (confidence: 100)

VERDICT: REVISE
```

#### review-tests

Raw report from lens-tests-r1.txt, unchanged:

```text
[should-fix] src-tauri/src/chess.rs:1726 — The snapshot test calls `Error::with_cleanup` directly instead of exercising `get_best_moves_core`, and cleanup succeeds. Reverting the command’s simultaneous search/cleanup failure branch to string-flattening would leave this test green while losing the terminal snapshot. Exercise that command branch and assert its serialized rejection retains the reason and cleanup category. (confidence: 99)

[should-fix] src/components/boards/BoardGame.test.tsx:615 — Failed-side Logs coverage uses two engines with zero moves. The nonempty-move tests use a single engine, bypassing endpoint-based colour selection. Replacing the endpoint turn with the root turn would pass these assertions while routing diagnostics incorrectly after an odd number of moves. Add a two-engine interruption after a move using the real tree store and assert which colour exposes the terminal logs. (confidence: 99)

VERDICT: APPROVED
```

#### review-code-quality

Raw report from lens-code-quality-r1.txt, unchanged:

```text
[blocker] src-tauri/src/game.rs:2931 — The enclosing game loop uses bare `100` milliseconds to control clock updates and timeout detection. Name this behavior-controlling interval, following the duration-constant convention in sibling `src-tauri/src/progress.rs:19–20`. This is pre-existing code within the reviewed scope (confidence: 98).

VERDICT: REVISE
```

#### review-error-handling

Raw report from lens-error-handling-r1.txt, unchanged:

```text
[blocker] src-tauri/src/game.rs:3294 — Cancelling an engine request during takeback converts every `wait_bestmove_cancellable` error into `Ok(())`, including a failed stop/reap. That function propagates `stop_request` failures, but this caller discards them and the game loop treats completion as successful. The set-position/start-search branches and the new cancellation check at line 2983 also suppress genuine failures. Cleanup errors must survive cancellation, as O1 requires (confidence: 97).

[should-fix] src/components/panels/analysis/useDisplayedEngineLines.ts:52 — `reportEngineFailure` replaces the complete safe error message with the snapshot reason. For an engine failure combined with cleanup failure, the report notification loses “Temporary cleanup also failed” and displays only the engine diagnostic. Preserve the cleanup warning alongside the final reason (confidence: 96).

VERDICT: REVISE
```

#### review-minimalism

Raw report from lens-minimalism-r1.txt, unchanged:

```text
[should-fix] src-tauri/src/engine/process.rs:4488 — P1 repeats the recover/reply/terminate sequence in Init, ConfigureStart and ConfigureNext alongside existing EnsureReady/StartSearch copies. SetOption and SetPosition also duplicate their selective recovery sequence. Extract shared exchange completion with the recovery condition supplied by each handler, preserving O1 while removing approximately 35–45 lines (confidence: 94).

[should-fix] src/components/panels/analysis/ReportPanel.tsx:69 — P2 adds two copies of the operation-id/root-fingerprint guard already implemented by `isCurrentOperation` at line 108. Move that callback before its consumers and reuse it in progress-query and cancellation failures, retaining the query’s separate `active` check. This removes duplicated ownership logic without reducing O2 coverage (confidence: 99).

[should-fix] e2e/engine-gap.spec.ts:260 — P2 copies the healthy-search test’s engine registration, analysis navigation, engine enabling and pending-search lookup from lines 116–148. Extract one setup helper used by both tests, leaving scenario configuration and assertions at their call sites. Approximately 30 duplicated lines disappear while all O4 cases remain (confidence: 97).

Added-file counterfactual: `e2e/game-interruption.spec.ts` supplies distinct O3/O4 event and recovered-snapshot cases. Folding it into another spec would retain the required setup and assertions, so no file-level deletion is supported.

VERDICT: REVISE
```

#### review-engine-protocol

Raw report from lens-engine-protocol-r1.txt, unchanged:

```text
[blocker] src-tauri/src/engine/process.rs:4118 — Successful reap is mistaken for reusable engine health. If search A exits and captures its terminal snapshot before A’s supervisor cleanup runs, navigation to B can stop A successfully and retain its dead actor (`stop_or_release:2253`). B then rebinds that actor to its fresh generation (`start_interactive_search:1988`). Its first command rejects with A’s retained snapshot through `disconnected_error`, which the renderer accepts as B’s current failure. This attributes A’s failure to a position never searched and prevents B from starting a fresh process. (confidence: 94)

Read-only source review. No files changed, tests run, or engine processes started.

VERDICT: REVISE
```

#### review-ipc-contract

Raw report from lens-ipc-contract-r1.txt, unchanged:

```text
No in-scope IPC contract defects found. Traced terminal error serialization through the facade and analysis consumers, plus interrupted game results through registered events and recovered snapshots. Payload shapes, ownership filters and listener cleanup agree.

Read-only review of ced73bdf..6d0fd79d. No files changed or gates run.

VERDICT: APPROVED
```

#### review-persisted-state

Raw report from lens-persisted-state-r1.txt, unchanged:

```text
[blocker] src/components/boards/BoardGame.tsx:249 — Interruption reason and terminal diagnostics are retained only in component-local `useState`. `BoardsPage.tsx:275` unmounts inactive tabs, so switching away after an engine failure and returning permanently loses both. Recovery cannot restore them because terminal projection clears the game/session atoms at line 506, and reconciliation runs only for playing games. The tab retains its final moves and `*` result but loses the explanation and Logs snapshot before another game starts. Retain this bounded display state under the tab owner until reset or close. (confidence: 99)

VERDICT: REVISE
```

#### review-chess-semantics

Raw report from lens-chess-semantics-r1.txt, unchanged:

```text
[blocker] src/components/boards/BoardGame.tsx:427 — Castling aliases can leave the authoritative move in a side variation. From `4k3/8/8/8/8/8/8/4K2R w K - 0 1`, retain mainline `Kf1` and variation `O-O` encoded as `e1h1`. A terminal native move list containing `e1g1` fails the raw UCI comparison. The fallback `makeMove({ mainline: true })` finds the existing `O-O` by SAN but does not promote it. Terminal projection therefore retains `Kf1` as the final mainline and resolves its endpoint instead of the authoritative castled position. (confidence: 98)

VERDICT: REVISE
```

#### review-platform-semantics

Raw report from lens-platform-semantics-r1.txt, unchanged:

```text
No platform-semantics findings in ced73bdf..6d0fd79d.

Read-only review. No checks ran or files changed. `pnpm rust:windows:check` and the non-Linux Unix source probe remain unverified. Windows/macOS runtime proof requires `rust-windows-test` and `rust-macos-test`. The `rust-platform` matrix provides compile/lint proof only.

VERDICT: APPROVED
```

#### review-tauri-security

Raw report from lens-tauri-security-r1.txt, unchanged:

```text
[blocker] src-tauri/src/engine/process.rs:3638 — Live transcripts bypass terminal sanitization. Engine stdout such as `info string Bearer sensitive-value /home/alice/private.bin` enters `runtime.logs` with only registered-resource replacement. `get_engine_logs` and `get_game_engine_logs` return those entries unchanged, exposing the credential and native path to the renderer’s Logs view and export. This pre-existing bypass remains reachable alongside the new sanitized snapshot. (confidence: 99)

[blocker] src-tauri/src/engine/process.rs:350 — The new credential sanitizer misses ordinary camelCase fields. Engine stderr or `info string` containing `{"accessToken":"sensitive-value"}` survives unchanged because `accessToken` matches neither `access_token` nor the boundary-qualified `token`. On termination, the bearer value crosses IPC inside the snapshot’s reason and entries. Renderer redaction also misses this spelling, and game results carry the snapshot directly. This is ordinary JSON naming, not evasive encoding. (confidence: 96)

Limitation: source-only review. Credential/session persistence, filesystem mutation and signed downloads are untouched by this range and were not audited. No files changed or tests run.

VERDICT: REVISE
```

#### review-records

Raw report from lens-records-r1.txt, unchanged:

```text
[should-fix] tasks/decisions.md:7194 — All five decisions cite missing review evidence: `tasks/handoffs/2026-10-12-engine-termination-surface-review.md` exists neither in the worktree nor in HEAD. Repeated at lines 7205, 7216, 7227 and 7238. Preserve the reviewed plan’s history at the cited path before release. (confidence: 100)

The implementation supports the checked claims. Append-only preservation and all five receipt hashes pass. No contradictory older decision found. No files changed.

VERDICT: REVISE
```


### Diff closure round 2 — REVIEWED_THROUGH 6de0db98

Delta 6d0fd79d..6de0db98 (repairs e9788213, 46675665, 44f53272 plus records 1c387afc, 6de0db98). Lenses: correctness, root-cause, tests, code-quality, error-handling, minimalism, engine-protocol, persisted-state, chess-semantics, tauri-security (sensitive) and records (mechanical). All round-1 issues DR1-01 … DR1-15 reported CLOSED by their witnesses; DR1-04 stayed Skip.

| ID | Lens | Claim | Disposition | Closure |
|---|---|---|---|---|
| DR2-N1 | chess-semantics (blocker, pre-existing) | `isThreeFoldRepetition` compares the raw root FEN (illegal en-passant square kept) with chessops-normalized descendants | Defer to the existing open finding f-20261004-22 (same defect, open mechanism question). A repair leaf that patched only the comparison also re-keyed the transposition-map root that `RepertoireInfo.tsx` still queries raw; its edits were discarded and the evidence annotated on f-20261004-22 (8b486270) | — |
| DR2-N2 | error-handling (should-fix) | terminal stdout drain stopped at a non-UTF-8 line | Fix | 04514f9e |
| DR2-N3 | tauri-security (blocker) | escaped value quote bypassed credential redaction | Fix | 04514f9e (reopened as DR3-S1) |
| DR2-N4 | tests (should-fix) | drain ResourceLimit branch untested | Fix | 04514f9e |
| DR2-T1 | orchestrator stress run | real-child broken-pipe test failed 4/20 (fork/exec fd inheritance in the test process makes the write succeed and the failure arrive as EOF) | Fix — accept both arrival orders, keep reason and exit assertions; 30/30 green | 04514f9e |

### Diff closure round 3 — REVIEWED_THROUGH 04514f9e

Delta 6de0db98..04514f9e. Lenses: correctness, tests, error-handling, tauri-security (sensitive), records (mechanical). DR2-N2, DR2-N3, DR2-N4 reported CLOSED.

| ID | Lens | Claim | Disposition |
|---|---|---|---|
| DR3-S1 | tauri-security (blocker), lineage DR1-03 → DR2-N3 | escaped KEY quotes (`{\"accessToken\":\"…\"}`) bypass the scanner; tests lens: multiword escaped values untested | Lineage escalation (§4a.3): mechanism note and focused fresh-context review-plan judgment (lens-plan-mechanism-r3, raw report below). Chosen: one tokenizer sharing quote/escape-depth rules for keys and values, fail closed on uncertain boundaries; rejected de-escaping, regex-only keys, and declaring nested JSON out of scope. Fix to that mechanism |
| DR3-C1 | correctness (blocker) | after an oversized-line ResourceLimit, the drain reads the unconsumed suffix as a new line and can report a fabricated reason | Fix |
| DR3-E1 | error-handling (should-fix) | per-line uncorrelated non-UTF-8 drain logs | Fix — one log with actor identity and count |
| DR3-R1 | records (should-fix) | this handoff lacked rounds 2–3 and the DR2-N1 history cited by the f-20261004-22 annotation | Fix — this section |

### Raw reports — diff rounds 2 and 3

#### review-correctness (r2)

Raw report from lens-correctness-r2.txt, unchanged:

```text
No round-1 IDs originated from this lens. No concrete correctness defects found in the repair diff or inspected full-range dependencies.

Limitation: OS-specific exit/reap behavior and React scheduling interleavings were inspected statically, not executed in this read-only review (confidence: 100).

VERDICT: APPROVED
```

#### review-root-cause (r2)

Raw report from lens-root-cause-r2.txt, unchanged:

```text
DR1-02 CLOSED — `recover_failed_protocol` now drains bounded terminal stdout before publishing the snapshot, preserving the unread final reason after EPIPE. Fake-IO and real-child regressions cover this failure chain, with supplied red-on-revert evidence. Caller and history checks found no sibling omission or reintroduced prior fix (confidence: 97).

VERDICT: APPROVED
```

#### review-tests (r2)

Raw report from lens-tests-r2.txt, unchanged:

```text
DR1-12 CLOSED — The two-engine odd-move test asserts that only Black’s selected Logs show terminal diagnostics despite a divergent real tree.

DR1-14 CLOSED — The test exercises production’s extracted completion helper with failed cleanup. Reverting its typed error fold to string flattening fails the serialized tag, category and snapshot assertions.

[should-fix] src-tauri/src/engine/process.rs:3700 — The new terminal-drain ResourceLimit branch has no regression assertion. Both write-failure fixtures contain only a short fatal line. Replacing discard-and-continue with `break` would pass them while losing a final `info string` queued after oversized stdout. Add that sequence through the bounded reader and assert the retained reason. (confidence: 97)

VERDICT: APPROVED
```

#### review-code-quality (r2)

Raw report from lens-code-quality-r2.txt, unchanged:

```text
DR1-13 CLOSED — `src-tauri/src/game.rs:936` names the 100 ms duration `CLOCK_TICK_INTERVAL`, and `game_loop` uses it at line 2944.

No additional readability or local-consistency defects found above 80 confidence.

VERDICT: APPROVED
```

#### review-error-handling (r2)

Raw report from lens-error-handling-r2.txt, unchanged:

```text
DR1-05 CLOSED — Cancelled task and stale-registration paths log stop/reap failures with game/session identity and native diagnostics. Both regression tests assert captured errors.

DR1-06 CLOSED — Analysis retains `cleanupFailed`, and report normalization preserves `operation-and-cleanup`. Both displays append the localized cleanup warning, covered by regression tests.

[should-fix] src-tauri/src/engine/process.rs:3705 — Terminal stdout draining stops silently on a non-UTF-8 line, although the reader has consumed that complete line. If a broken-pipe failure leaves malformed output followed by a valid final `info string`, that reason never reaches the snapshot or Logs panel. The user receives a generic protocol-failure message or an older reason. Continue draining after this recoverable decoding error within the existing deadline (confidence: 94).

VERDICT: APPROVED
```

#### review-minimalism (r2)

Raw report from lens-minimalism-r2.txt, unchanged:

```text
DR1-07 CLOSED — `complete_exchange` centralizes recovery and reply handling for seven actor command branches, returning the termination decision.
DR1-08 CLOSED — ReportPanel’s query and cancellation failures reuse `isCurrentOperation`.
DR1-09 CLOSED — Both engine-gap test paths use `setupAnalysisEngine`, removing duplicated setup.

No new bloat or duplication defects found above 80 confidence.

VERDICT: APPROVED
```

#### review-engine-protocol (r2)

Raw report from lens-engine-protocol-r2.txt, unchanged:

```text
DR1-01 CLOSED — `process.rs:2021` excludes terminal actors from reuse, and `:2290` routes them through exact-generation reap. Both restart regression cases verify a fresh actor/generation without the predecessor’s snapshot. No additional in-lens defects found.

VERDICT: APPROVED
```

#### review-persisted-state (r2)

Raw report from lens-persisted-state-r2.txt, unchanged:

```text
DR1-10 CLOSED — `BoardGame.tsx:257` reads and writes the owner-tab `gameInterruptionFamily`, preserving the interruption across inactive-tab unmounts. `atoms.ts:1029` removes it on tab disposal. Event and snapshot regression cases in `BoardGame.test.tsx:533` check the reason and terminal Logs after remount. The atom remains ephemeral, with no storage encoding change.

VERDICT: APPROVED
```

#### review-chess-semantics (r2)

Raw report from lens-chess-semantics-r2.txt, unchanged:

```text
DR1-11 CLOSED — `syncTreeWithMoves` normalizes both castling representations against the parent position before matching and promoting the existing variation.

[blocker] src/state/store/tree.ts:844 — Repetition compares the raw root FEN against library-normalized descendant FENs. Starting from `rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1`, play `g8f6 g1f3 f6g8 f3g1` twice. No en-passant capture is possible, so the endpoint is the third occurrence. The root retains `e3`, descendants contain `-`, and the tree counts only two occurrences, leaving its result `*`. This pre-existing defect is in the move insertion code used by synchronization. (confidence: 99)

VERDICT: REVISE
```

#### review-tauri-security (r2)

Raw report from lens-tauri-security-r2.txt, unchanged:

```text
DR1-03 CLOSED — compound-key matching now covers the reported spellings, with serialized-byte regression coverage at src-tauri/src/engine/process.rs:5120.

[blocker] src-tauri/src/engine/process.rs:431 — Escaped opening quotes bypass credential redaction. Engine output `info string {"error":"accessToken=\"lip_secret\""}` makes the unquoted-value scanner redact only the backslash, leaving `lip_secret` intact. The terminal snapshot then exposes that bearer through command-error serialization at src-tauri/src/error.rs:960 and interrupted-game results at src-tauri/src/game.rs:3001. The new regression covers only unescaped quotes. (confidence: 99)

VERDICT: REVISE
```

#### review-records (r2)

Raw report from lens-records-r2.txt, unchanged:

```text
DR1-15 CLOSED — the cited handoff is committed in HEAD and preserves all three plan-review rounds.

No findings. Bundle figures and arithmetic agree with `bundle-budgets.json`, all 16 catalogues contain the described new copy, and the named commits support the handoff’s implementation claims. Existing decisions and historical bundle rationale are preserved.

Unverifiable here: recorded test counts, preflight results and independently reproduced base-build measurements. No files changed.

VERDICT: APPROVED
```

#### review-correctness (r3)

Raw report from lens-correctness-r3.txt, unchanged:

```text
[blocker] src-tauri/src/engine/process.rs:3706 — Recovery can promote an oversized line’s suffix into a fabricated reason. With 8 KiB reader chunks, a single line containing 65,536 `x` bytes followed by `info string fabricated\n` makes the normal read return ResourceLimit and clear `pending_line` without consuming the suffix. Recovery reads that suffix as a new line and reports `fabricated`, although no valid `info string` line exists. The oversized remainder must be discarded before resuming terminal reads. (confidence: 96)

Limitation: no runtime probes ran. Platform-specific pipe scheduling and exit-status branches were reviewed from source only. (confidence: 100)

VERDICT: REVISE
```

#### review-tests (r3)

Raw report from lens-tests-r3.txt, unchanged:

```text
DR2-N4 CLOSED — `terminal_snapshot_final_stdout_after_oversized_line` uses the production bounded reader and asserts the exact final reason and diagnostic entry. Restoring the drain’s stop-on-ResourceLimit behavior fails those assertions.

[should-fix] src-tauri/src/engine/process.rs:5107 — Both escaped-quote fixtures use a single-word secret. Removing the escaped closing-quote search would leave these tests green while leaking `pass phrase` from `password=\"private pass phrase\"`. Add a multiword escaped credential and assert every secret fragment is absent from serialized bytes. (confidence: 99)

VERDICT: APPROVED
```

#### review-error-handling (r3)

Raw report from lens-error-handling-r3.txt, unchanged:

```text
DR2-N2 CLOSED — the reader consumes the invalid UTF-8 line, the terminal drain continues, and `terminal_snapshot_final_stdout_after_non_utf8_line` asserts that the typed failure retains the final reason.

[should-fix] src-tauri/src/engine/process.rs:3712 — Every discarded non-UTF-8 line emits an identical error without engine, tab or generation identity. A buffered sequence produces repeated uncorrelated records. Aggregate the discarded-line count into one diagnostic carrying actor identity. (confidence: 94)

VERDICT: APPROVED
```

#### review-tauri-security (r3)

Raw report from lens-tauri-security-r3.txt, unchanged:

```text
DR2-N3 CLOSED — escaped value quotes are consumed and redacted, with serialized-byte regressions at src-tauri/src/engine/process.rs:5107.

[blocker] src-tauri/src/engine/process.rs:379 — Escaped JSON keys still bypass redaction. Engine output `info string {"error":"{\"accessToken\":\"lip_secret\"}"}` leaves a backslash after `accessToken`, causing credential recognition to return `None`. `lip_secret` survives in snapshot reason/entries and crosses IPC through src-tauri/src/error.rs:960. The fix handles escaped value quotes but misses escaped key quotes. (confidence: 99)

Limitation: read-only source review, no tests run. Credential persistence, filesystem mutation and signed downloads are absent from this delta.

VERDICT: REVISE
```

#### review-records (r3)

Raw report from lens-records-r3.txt, unchanged:

```text
[should-fix] tasks/findings.md:13602 — The cited handoff contains no `DR2-N1` or diff closure round 2. It ends at diff round 1, so it does not substantiate the second witness, repair attempt or deferral history. Preserve that evidence at the cited path. (confidence: 100)

The repetition example is reproducible. Raw-key consumers match the annotation. Append-only preservation and receipt hash pass. No conflicting state found in this entry. No files changed.

VERDICT: REVISE
```

#### review-plan-mechanism (r3)

Raw report from lens-plan-mechanism-r3.txt, unchanged:

```text
Choose **(b), with shared quote/escape handling and conservative value boundaries**. One tokenizer must recognize quoted keys and values using the same rules, track escape depth and backslash parity, and distinguish closing delimiters from literal quotes inside a value. If a value boundary is uncertain, redact the remaining diagnostic text.

At HEAD `04514f9e`, the round-3 escaped-key bypass remains open. [process.rs:368](/home/felixb/Projekte/chessfable/src-tauri/src/engine/process.rs:368) accepts only an unescaped closing key quote, then [process.rs:379](/home/felixb/Projekte/chessfable/src-tauri/src/engine/process.rs:379) requires the separator. This rejects `{\"accessToken\":\"lip_secret\"}`. Both stdout and stderr already reach the shared sanitization boundary at [process.rs:270](/home/felixb/Projekte/chessfable/src-tauri/src/engine/process.rs:270), so the correction belongs there.

Reject the alternatives as written:

- **(a):** Dropping escape backslashes loses the distinction between delimiters and embedded literal quotes. The existing scanner can then stop early and expose the remainder.
- **(c):** The key pattern can detect assignments, but “value until terminator” still needs the same quote and escape semantics. Regex key matching alone does not close this class.
- **(d):** Ordinary JSON nested inside a JSON string is within the frozen threat model. Calling it deliberately evasive would change that model.

“Until the matching quote” is sufficient for **well-formed quoted multiword values**, provided matching respects escape depth. After recognizing an opening quote, a missing closing quote must redact through end of text. Falling back to whitespace exposes later words. The current escaped-value fallback at [process.rs:437](/home/felixb/Projekte/chessfable/src-tauri/src/engine/process.rs:437) has that weakness.

Whitespace is also insufficient for an **unquoted multiword password**. Unless enclosing syntax establishes its end, redact from the recognized assignment through end of text. Do not silently narrow the invariant to single-word credentials.

The invariant is: **Every credential value in ordinary engine stdout `info string` and stderr diagnostics is replaced before retention and serialization of both snapshot `reason` and `entries`, regardless of compound-key spelling, ordinary JSON string escaping, whitespace inside quoted values, or an incomplete quoted value. Ambiguous boundaries fail closed.** This implements O1 at [the plan:49](/home/felixb/Projekte/chessfable/tasks/plans/2026-10-12-engine-termination-surface.md:49) without changing its obligation.

Minimum regression spellings, shown as diagnostic text:

| Case | Input |
|---|---|
| Existing key families | Separate cases for `token`, `accessToken`, `refresh_token`, `clientSecret`, `password`, `passwd`, `dbPasswd`, `apiKey`, `api_key`, `api-key`, `X-Api-Key`, mixed case, `:` and `=` |
| Plain quoted key/value | `{"accessToken":"lip_secret"}` |
| Escaped key/value | `{\"accessToken\":\"lip_secret\"}` |
| Escaped value alone | `accessToken=\"lip_secret\"` |
| Quoted multiword value | `password="private pass phrase"` |
| Escaped multiword value | `password=\"private pass phrase\"` |
| Literal quote inside value | `password="private \"quoted\" pass phrase"` |
| Nested literal quote | `password=\"private \\\"quoted\\\" pass phrase\"` |
| Further ordinary wrapping | Generate the JSON credential object through one and two JSON-string serialization layers |
| Missing closing quote | Both `password="private pass phrase` and `password=\"private pass phrase` |
| Unquoted ambiguity | `password=private pass phrase` |
| Authorization forms | `Authorization: Bearer lip_secret`, `Authorization: Basic lip_secret`, `Bearer lip_secret` |

Parameterize quoted cases over both quote characters. Exercise both diagnostic sources, inspect decoded `reason` and every entry, and inspect native serialized bytes. Assert absence of **each secret fragment**, not merely the complete phrase. Include multiple assignments and non-latest entries. Preserve ordinary failure wording, FEN and chess notation in well-formed cases.

No plan-obligation defect found. This approves the specified mechanism, not closure of the current implementation. Runtime and regression proof were not executed under the read-only review rails (confidence: 100).

VERDICT: APPROVED
```

