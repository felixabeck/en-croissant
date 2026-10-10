# SQLite hard-link admission review handoff

Assigned finding: f-20260929-05. Base: `e09c186690767e13643288df38505c82126d5bd5`. Plan-only run, no implementation or runtime tests performed. Plan: `2026-10-09-sqlite-hard-link-admission.md`. Locate probe confirmed all three acquisition consumers and the platform normalization limits.

## Reviews

Round 1 completed all 12 plan-capable lenses through fresh read-only canonical launcher leaves. All raw verdicts are APPROVED. No substantive plan correction was adopted, so no closure round is required. The frozen body is unchanged from `plan-r1.md`.

Measured round wall elapsed: 435.136 seconds, including launch, parallel review, polling, arbitration and successor filing. Active review wall time is unknown. No separately measured quota, dependency, release or other wait is recorded. Parallel leaf durations are not summed. One completed round, `r1=0` adopted findings, one unique issue opened, zero Fix, zero Skip, one Defer. No native mandate obligations remain open. Implementation and final-review rework have not run. No inherited rounds, withdrawals, rewrites or correction-introduced defects.

### I1: Admission conflict UI presentation

Witness: error-handling, round 1, raw finding 1, should-fix, confidence 97. Claim: Per-database load presentation drops the actionable distinction of a typed admission Conflict and advises checking for corruption.

Disposition: Defer. Separate existing frontend error-presentation design. Native admission already returns a safe typed Conflict through all consumers and closes the selected WAL/SHM corruption mandate. The same generic UI predates this change for cross-parent conflicts. Its safe discriminator and localized recovery presentation need their own frontend plan, rather than expanding this native ownership phase. No product answer is needed to implement the selected refusal policy.

Evidence: `src/utils/db.ts:243-268` maps the broad validation category to the generic title. `src/platform/errors.ts:196-224` retains backend category in normalization but drops it in SafeFailureContext. `DatabasesPage.tsx:414-428` adds the unconditional corruption guidance. Existing listing-failure handling f-20260913-05 concerns root listing and does not cover per-database metadata failure. d-20261008-03 and d-20261008-04 retain visible per-item records and do not decide their conflict copy.

Dependencies: none. No correction revision or closure round. Successor owns I1. Published spool receipt: `/home/felixb/Projekte/chessfable/tasks/findings-inbox/20261009-042718-3129188-1791512838135035497-6.md`. The session-free content receipt returned `published`. Exact entry bytes are carried in `plan-meta.json` and the handoff.

The adopting session must persist `reviews-handoff.md` as `tasks/handoffs/2026-10-09-sqlite-hard-link-admission-review.md` before final gates. Once the successor has an allocated ID, annotate it to link that tracked file, inherit I1 and require loading the file before review. Complete this successor link before closing the parent finding. The planner cannot annotate the external ledger or alter published intake files.

Plan authorship and arbitration shared one root context. Detection ran in fresh Codex leaf sessions on the same OpenAI model family as the planned code executor.

### Round 1 raw evidence

The following reports are preserved verbatim. Findings retain their original paths, severity, confidence and verdict. Non-applicable reports count as finding-free completed reviews.

#### lens-correctness-r1

Canonical body: `/home/felixb/.claude/agents/review-correctness.md`. Launcher role: `sensitive`. Snapshot: `plan-r1.md`.

```text
No correctness defects found in the three planned obligations.

Limitation: implementation and platform runtime behavior remain unverified in this plan-only review (confidence: 95).

VERDICT: APPROVED
```

#### lens-error-handling-r1

Canonical body: `/home/felixb/.claude/agents/review-error-handling.md`. Launcher role: `sensitive`. Snapshot: `plan-r1.md`.

```text
[should-fix] tasks/plans/.plan-sqlite-hard-link-admission-r1.body.md:67 — Existing propagation preserves `Conflict` through IPC but loses its actionable message in `src/utils/db.ts:268`. A refused hard-link alias displays “There was an error loading this database” and advice to check for corruption (`DatabasesPage.tsx:425-428`). The consumer obligation needs distinguishable user-facing conflict surfacing so intentional admission refusal is not presented as a broken database (confidence: 97).

VERDICT: APPROVED
```

#### lens-minimalism-r1

Canonical body: `/home/felixb/.claude/agents/review-minimalism.md`. Launcher role: `sensitive`. Snapshot: `plan-r1.md`.

```text
VERDICT: APPROVED
```

#### lens-plan-r1

Canonical body: `/home/felixb/.claude/agents/review-plan.md`. Launcher role: `review-plan`. Snapshot: `plan-r1.md`.

```text
VERDICT: APPROVED
```

#### lens-tests-r1

Canonical body: `/home/felixb/.claude/agents/review-tests.md`. Launcher role: `sensitive`. Snapshot: `plan-r1.md`.

```text
VERDICT: APPROVED
```

#### lens-chess-semantics-r1

Canonical body: `/home/felixb/.claude/drain-plans/chessfable-0a459a4f/slot-0/wt/.claude/agents/review-chess-semantics.md`. Launcher role: `sensitive`. Snapshot: `plan-r1.md`.

```text
NOT APPLICABLE: The three Approach obligations concern SQLite binding admission, owner lifetime, and consumer/platform coverage. The named Rust database files and planned changes do not affect in-memory chess trees, positions, move paths, or chess-domain metadata.

VERDICT: APPROVED
```

#### lens-engine-protocol-r1

Canonical body: `/home/felixb/.claude/drain-plans/chessfable-0a459a4f/slot-0/wt/.claude/agents/review-engine-protocol.md`. Launcher role: `sensitive`. Snapshot: `plan-r1.md`.

```text
NOT APPLICABLE: The named database files and plan obligations concern SQLite inode admission, binding lifetime, and consumer coverage. They do not affect engine process supervision, UCI protocol state, or asynchronous engine-result routing.
VERDICT: APPROVED
```

#### lens-ipc-contract-r1

Canonical body: `/home/felixb/.claude/drain-plans/chessfable-0a459a4f/slot-0/wt/.claude/agents/review-ipc-contract.md`. Launcher role: `sensitive`. Snapshot: `plan-r1.md`.

```text
NOT APPLICABLE: The three obligations govern native SQLite binding admission, ownership and consumer coverage. The assigned files and plan introduce no events, command signatures, renderer subscriptions, generated bindings or capability changes.

VERDICT: APPROVED
```

#### lens-persisted-state-r1

Canonical body: `/home/felixb/.claude/drain-plans/chessfable-0a459a4f/slot-0/wt/.claude/agents/review-persisted-state.md`. Launcher role: `sensitive`. Snapshot: `plan-r1.md`.

```text
NOT APPLICABLE: The three obligations concern backend SQLite binding admission, owner lifetime and consumer coverage. The named Rust files do not involve renderer storage keys, persisted atoms, hydration or tab lifecycle.
VERDICT: APPROVED
```

#### lens-pgn-index-r1

Canonical body: `/home/felixb/.claude/drain-plans/chessfable-0a459a4f/slot-0/wt/.claude/agents/review-pgn-index.md`. Launcher role: `sensitive`. Snapshot: `plan-r1.md`.

```text
NOT APPLICABLE: The files and three Approach obligations concern SQLite hard-link binding admission, owner lifetime and consumer coverage. They do not change PGN byte scanning, offsets, encoding, database indexing or search predicates.

VERDICT: APPROVED
```

#### lens-platform-semantics-r1

Canonical body: `/home/felixb/.claude/drain-plans/chessfable-0a459a4f/slot-0/wt/.claude/agents/review-platform-semantics.md`. Launcher role: `sensitive`. Snapshot: `plan-r1.md`.

```text
No platform-specific defect found in the planned mechanism or proof.

Windows and macOS runtime evidence must come from `rust-windows-test` and `rust-macos-test`. `rust-platform` provides compile/lint evidence. Neither `pnpm rust:windows:check` nor the non-Linux Unix source probe was run during this read-only plan review.

VERDICT: APPROVED
```

#### lens-tauri-security-r1

Canonical body: `/home/felixb/.claude/drain-plans/chessfable-0a459a4f/slot-0/wt/.claude/agents/review-tauri-security.md`. Launcher role: `sensitive`. Snapshot: `plan-r1.md`.

```text
No in-scope security defects found in the three plan obligations. Admission remains behind the authority-bound carrier, preserves per-name filesystem ownership, and requires a safe conflict message before alias VFS creation or SQLite open.

Limitations: plan-only review, no runtime verification. Credentials, sessions and signed downloads are unaffected.

VERDICT: APPROVED
```

### Exact filed successor entry

```markdown
### Per-database admission conflicts are presented as possible database corruption
* **ID:** f-PENDING · **Status:** open · **Area:** frontend-ui · **Root:** - · **Entry:** build · **Blocked:** none
* **Filed from:** 160c03b1-55a8-4a3d-b6f2-32fd285f929f · output /home/felixb/.claude/drain-plans/chessfable-0a459a4f/slot-0/run/attempt-160c03b1-55a8-4a3d-b6f2-32fd285f929f-1.jsonl
* **Where:** `src/utils/db.ts:243-268`, `src/platform/errors.ts:41,196-224`, `src/components/databases/DatabasesPage.tsx:414-428`, `src/translation/en-US.json:396-401`. Confirmed at BASE `e09c186690767e13643288df38505c82126d5bd5`.
* **Defect:** `getDatabase` catches a typed native `Conflict`, normalizes it through `safeFailureContext`, and turns it into the generic database load title. `normalizeError` preserves the backend category, but `safeFailureContext` retains only the broad renderer category and redacted message. The selected failed database panel always adds the instruction to check that the file exists and is not corrupted. A deliberate binding admission refusal therefore loses its actionable distinction and reads as a broken database. This already affects cross-parent binding conflicts and would also affect the concurrent same-parent alias refusal planned for f-20260929-05.
* **Why it matters:** a user cannot distinguish a temporarily owned database alias from corrupt data or understand when retrying can work. Native safe refusal does not need corruption repair.
* **Open question:** which safe typed discriminator and localized recovery presentation should distinguish database admission conflicts from other per-database load failures, without matching backend message literals or exposing raw native errors? Keep ordinary corruption guidance for failures where it is appropriate.
* **Related:** f-20260929-05 supplies the new native admission case. f-20260913-05 is handled and covers collection listing failures with typed root-failure presentation, not this per-database metadata load panel. f-20260830-28 established the normalized error taxonomy and remains handled.
* **Found by:** Codex `review-error-handling`, round 1 of the f-20260929-05 PLAN-ONLY review, 2026-10-09. Root confirmed the renderer execution path. Plan authorship and arbitration shared one context, and detection ran on the same model family as the planned code executor.
```

### Adoption requirements

Copy this complete handoff to the tracked path above before final gates. Preserve the original issue and witness numbers. The successor owns I1 only. The parent plan has no carried Fix obligations. Revalidate the snapshot against the adoption base, record the scoped refinement of d-20260929-05, then implement and prove the single phase. Runtime assertions, the source revert witness, cumulative code review, Rust gates and Windows/macOS CI remain work for the adopting session.

### Round 2: Source-drift refresh

Refreshed BASE `e09c186690767e13643288df38505c82126d5bd5` to NEW-BASE `b2663061a8d20d3f969c851c3ef9ce5d025b4cbb`. All 12 requested lenses ran through read-only canonical launcher leaves at their original roles. All raw verdicts are APPROVED, with zero findings. Five lenses reported that their classes cannot invalidate this plan through the drift. No retries, unavailable reviewers or fallback routing occurred.

The exact process-generated source drift was compared byte-for-byte with actual `git diff BASE..NEW-BASE`. SHA-256: `fd77fc46a82ed0da08af4670e9702353a2d76c30d92600807874c64f23790ee4`. `plan-r2.md` froze the refreshed candidate before review. The script-generated `delta-r2.txt` identified Traced premises, Risks / open questions and Not part of this task as revised. The fixed MANDATE and the three Approach obligations stayed unchanged. The updated source references and predecessor status reflect inspected source and records, not a new mandate or lens adoption.

New decisions d-20261009-08 through d-20261009-10 are preserved as constraints. `BoundDatabase::acquire` still admits distinct same-parent keys. Token-aware removal and both quarantine lifetimes remain compatible with refusing those keys. The new sidecar metadata witness uses distinct primary database identities, so it remains admissible. No admission design change or further correction round is required.

Measured round wall elapsed: 212.059 seconds, including launch, parallel review, polling and arbitration. Active review wall time is unknown. No separately measured quota, dependency, release or other wait. Ordinary reviewer polling is review elapsed. Parallel leaf durations are not summed. Completed lineage: two rounds, `r1=0 r2=0` adopted findings. Round 2 opens zero issues and closes zero implementation defects. Cumulative unique issues: one, dispositioned Defer. Zero Fix, zero Skip, zero unresolved native plan obligations. No withdrawals, splits, correction-introduced defects or implementation/final-review rework.

I1 retains its exact filed entry bytes and witness tuple. Its receipt now reads `merged`, and the successor is f-20261009-03. Do not re-file it. The adopting session must preserve the complete handoff in the tracked path already named above and annotate that successor with the I1 inheritance and load-before-review instruction before closing the parent. This plan remains ready for adoption. Required native runtime proof and the recorded GitHub Actions prerequisite remain with adoption, not with this read-only planner.

Plan authorship and arbitration shared one root context. Detection ran in fresh Codex launcher leaves on the same OpenAI model family as the planned code executor.

### Round 2 raw evidence

All reports below are preserved verbatim, including their named verification limits.

#### lens-correctness-r2

Canonical body: `/home/felixb/.claude/agents/review-correctness.md`. Launcher role: `sensitive`. Snapshot: `plan-r2.md`.

```text
No open correctness issues require closure. No drift defects invalidate the three Approach obligations.

The expanded Unix quarantine preserves binding-key admission and token-aware cleanup. Same-key holders keep the registration alive. Final release removes admission, allowing a surviving alias to obtain its own binding. Pools, revision reads and content validation still acquire before opening SQLite, preserving immediate typed conflict propagation.

Limitation: implementation and runtime behavior remain prospective. Native macOS and Windows proof must come from the required CI jobs. No tests were run or files changed (confidence: 100).

VERDICT: APPROVED
```

#### lens-error-handling-r2

Canonical body: `/home/felixb/.claude/agents/review-error-handling.md`. Launcher role: `sensitive`. Snapshot: `plan-r2.md`.

```text
No in-scope error-handling defects found. The drift preserves typed admission refusal, failed-creation cleanup and token-aware final-owner release. Quarantined descriptors remain separate from binding admission.

Runtime verification remains prospective, including required Windows and macOS CI proof. No tests were run or files changed.

VERDICT: APPROVED
```

#### lens-minimalism-r2

Canonical body: `/home/felixb/.claude/agents/review-minimalism.md`. Launcher role: `sensitive`. Snapshot: `plan-r2.md`.

```text
No in-scope bloat or duplication defects found. The ownership drift reuses the existing registry and cleanup. The plan requires one shared admission predicate for published bindings and reservations, with consumer changes limited to regression tests. No additional abstraction or registry is required.

VERDICT: APPROVED
```

#### lens-plan-r2

Canonical body: `/home/felixb/.claude/agents/review-plan.md`. Launcher role: `review-plan`. Snapshot: `plan-r2.md`.

```text
No open issues require closure. No drift-scope plan defects found in final candidate r2.

The changed Unix quarantine machinery remains compatible with all three obligations. Token-aware cleanup still supports final-owner retry (`bound_sqlite.rs:542`). The new sidecar ownership witness uses distinct primary database identities (`repository.rs:4418`), so refusing concurrent primary aliases does not invalidate it. Consumer acquisition still propagates typed errors before alias pool construction.

Named limitation: runtime behavior and Windows/macOS CI availability were not verified in this read-only review (confidence: 100). No files changed or tests run.

VERDICT: APPROVED
```

#### lens-tests-r2

Canonical body: `/home/felixb/.claude/agents/review-tests.md`. Launcher role: `sensitive`. Snapshot: `plan-r2.md`.

```text
No drift-induced verification defects found. All three obligations retain concrete failure assertions. The quarantine changes do not invalidate alias refusal, final-owner retry or consumer/platform proof.

Limitation: regression tests and the revert witness remain prospective. Native Windows/macOS runtime evidence is required before release completion (confidence: 100).

VERDICT: APPROVED
```

#### lens-chess-semantics-r2

Canonical body: `/home/felixb/.claude/drain-plans/chessfable-0a459a4f/slot-0/wt/.claude/agents/review-chess-semantics.md`. Launcher role: `sensitive`. Snapshot: `plan-r2.md`.

```text
NOT APPLICABLE — The listed native database files and all three Approach obligations concern SQLite alias admission, binding ownership and platform proof. The described drift cannot invalidate an in-memory chess-tree, position-identity or move-path invariant.

VERDICT: APPROVED
```

#### lens-engine-protocol-r2

Canonical body: `/home/felixb/.claude/drain-plans/chessfable-0a459a4f/slot-0/wt/.claude/agents/review-engine-protocol.md`. Launcher role: `sensitive`. Snapshot: `plan-r2.md`.

```text
NOT APPLICABLE — The named files and obligations concern SQLite inode admission, binding lifetime, retry, and consumer/platform proof. They do not intersect with engine process supervision, UCI protocol state, or asynchronous engine result routing. This lens cannot invalidate an obligation through the described drift.

VERDICT: APPROVED
```

#### lens-ipc-contract-r2

Canonical body: `/home/felixb/.claude/drain-plans/chessfable-0a459a4f/slot-0/wt/.claude/agents/review-ipc-contract.md`. Launcher role: `sensitive`. Snapshot: `plan-r2.md`.

```text
NOT APPLICABLE — The assigned files and three Approach obligations concern native SQLite inode admission, binding ownership and retry, and consumer/platform coverage. The described descriptor and sidecar ownership drift does not touch events, command signatures, renderer payloads, subscriptions, or capability scopes, so this IPC lens cannot invalidate those obligations.

VERDICT: APPROVED
```

#### lens-persisted-state-r2

Canonical body: `/home/felixb/.claude/drain-plans/chessfable-0a459a4f/slot-0/wt/.claude/agents/review-persisted-state.md`. Launcher role: `sensitive`. Snapshot: `plan-r2.md`.

```text
NOT APPLICABLE — The named files and three Approach obligations concern native SQLite binding identity, owner lifetime, and consumer/platform coverage. This drift cannot invalidate an obligation through renderer storage keys, hydration, atom families, or tab lifecycle.

VERDICT: APPROVED
```

#### lens-pgn-index-r2

Canonical body: `/home/felixb/.claude/drain-plans/chessfable-0a459a4f/slot-0/wt/.claude/agents/review-pgn-index.md`. Launcher role: `sensitive`. Snapshot: `plan-r2.md`.

```text
NOT APPLICABLE: The named files and three Approach obligations concern SQLite binding admission, owner lifetime and retry, and consumer/platform coverage. The described drift changes descriptor inspection and sidecar ownership, outside this lens’s PGN scanning, offset indexing, encoding, and search scope.

VERDICT: APPROVED
```

#### lens-platform-semantics-r2

Canonical body: `/home/felixb/.claude/drain-plans/chessfable-0a459a4f/slot-0/wt/.claude/agents/review-platform-semantics.md`. Launcher role: `sensitive`. Snapshot: `plan-r2.md`.

```text
No open issues require closure. No platform defect in the r2 delta or source drift invalidates the three Approach obligations. The Unix quarantine changes preserve registration ownership and token-aware cleanup. The plan explicitly preserves them and adapts the macOS lifetime test to same-key holders.

No tests, builds, Windows check or non-Linux source probe ran in this read-only review. Recorded predecessor compile evidence does not verify the prospective admission change. Native runtime proof remains required through `rust-windows-test` and `rust-macos-test`. `rust-platform` provides compile/lint coverage. The refreshed plan retains the CI availability prerequisite.

VERDICT: APPROVED
```

#### lens-tauri-security-r2

Canonical body: `/home/felixb/.claude/drain-plans/chessfable-0a459a4f/slot-0/wt/.claude/agents/review-tauri-security.md`. Launcher role: `sensitive`. Snapshot: `plan-r2.md`.

```text
No security-owned issues await closure. No in-scope defects found that invalidate the three Approach obligations.

The drift preserves retained-parent containment, no-follow opens, descriptor validation and token-aware cleanup. The refreshed plan explicitly preserves quarantine ownership and requires native platform proof.

Limitations: runtime behavior remains prospective. Credentials, sessions and signed downloads are absent from this drift. No files changed or tests run.

VERDICT: APPROVED
```

### Round 3: Source-drift refresh

Refreshed BASE `b2663061a8d20d3f969c851c3ef9ce5d025b4cbb` to NEW-BASE `2b5520363201b8a3a0db6dd9ad707fca8e51651e`. All 12 requested lenses ran through read-only canonical launcher leaves at their original roles (`review-plan` for the plan lens, `sensitive` for every other lens, because `src-tauri/src/db/**` is a Sensitive-Path glob). All raw verdicts are APPROVED with zero findings and no LATE OBSERVATIONS. Seven lenses reported NOT APPLICABLE with reasons that match their classes. No retries, unavailable reviewers or fallback routing occurred.

The process-generated drift was compared byte-for-byte with actual `git diff BASE..NEW-BASE`. SHA-256: `d9b5e89b62cbbc61a3b82362c1c136fe35c5e648cfd64b3e9f1b5d894036e823`. It changes none of the three plan files, `content_validation.rs` or `infra/path_authority`. Its native changes are search, progress, encoding and a source-scan test. Correctness, plan and platform lenses independently confirmed that the search-loader refactor still reaches the unchanged revision-read acquisition path and propagates its errors. The one cited record change is f-20261009-04, now handled after fork workflows were re-enabled.

`plan-r3.md` froze the candidate before review. The script-generated `delta-r3.txt` identified Traced premises and Risks / open questions as revised. Both edits update operational premises only: the new base and drift scope, and the handled CI blocker. The fixed MANDATE, the three Approach obligations, Phases and Release verification are unchanged. No admission design change or correction round is required.

Measured round wall elapsed: 173 seconds, including prompt construction, launch, parallel review, polling and arbitration. Active review wall time is unknown. No separately measured quota, dependency, release or other wait. Parallel leaf durations are not summed. Completed lineage: three rounds, `r1=0 r2=0 r3=0` adopted findings. Round 3 opens zero issues and closes zero. Cumulative unique issues: one, I1, dispositioned Defer and owned by open successor f-20261009-03. Zero Fix, zero Skip, zero unresolved native plan obligations. No withdrawals, splits, correction-introduced defects or implementation/final-review rework.

The adoption requirements recorded above stand unchanged: persist this handoff as `tasks/handoffs/2026-10-09-sqlite-hard-link-admission-review.md` before final gates, and annotate f-20261009-03 with the I1 inheritance and load-before-review instruction before closing the parent. Do not re-file I1. The plan remains ready for adoption. Required native runtime proof remains with adoption.

Plan authorship and arbitration shared one root context. Detection ran in fresh Codex launcher leaves on the same OpenAI model family as the planned code executor.

### Round 3 raw evidence

The following reports are preserved verbatim. Non-applicable reports count as finding-free completed reviews.

#### lens-correctness-r3

Canonical body: `/home/felixb/.claude/agents/review-correctness.md`. Launcher role: `sensitive`. Snapshot: `plan-r3.md`.

```text
No correctness defects found in the r3 delta or source drift affecting the three Approach obligations. Acquisition, registry ownership, revision reads and content-validation admission remain unchanged. The search-loader refactor preserves identity probing through the repository. Proof commands and Rust gate requirements are unchanged.

Limitation: runtime behavior remains prospective. Tests, builds and native CI were not run in this read-only review. Confidence: 95/100.

VERDICT: APPROVED
```

#### lens-error-handling-r3

Canonical body: `/home/felixb/.claude/agents/review-error-handling.md`. Launcher role: `sensitive`. Snapshot: `plan-r3.md`.

```text
No error-handling defects found in the r3 delta or relevant source drift. Binding admission, ownership and content-validation acquisition are unchanged. The revised search identity probe preserves typed error propagation, and the gate-contract change leaves the required Rust proofs intact.

Runtime verification remains prospective. No tests were run.

VERDICT: APPROVED
```

#### lens-minimalism-r3

Canonical body: `/home/felixb/.claude/agents/review-minimalism.md`. Launcher role: `sensitive`. Snapshot: `plan-r3.md`.

```text
NOT APPLICABLE: The refresh adds no planned abstraction, configurability or duplicate implementation. All three Approach obligations remain unchanged. Git confirms no drift in the assigned files, content validation or path authority. Bloat in independent search or progress changes is outside this review’s scope.

VERDICT: APPROVED
```

#### lens-plan-r3

Canonical body: `/home/felixb/.claude/agents/review-plan.md`. Launcher role: `review-plan`. Snapshot: `plan-r3.md`.

```text
No open issues require closure. No drift-scope plan defects found in candidate r3.

The search-loader refactor still propagates errors through the unchanged revision-read acquisition path (`search.rs:214`, `repository.rs:691`). Binding admission, owner lifetime, pool construction and content-validation acquisition remain unchanged. Proof commands remain available, and the gate-contract drift does not affect this Rust-only phase.

Limitation: runtime behavior and live Windows/macOS CI availability were not verified. Those proofs remain required during adoption (confidence: 100). No files changed or tests run.

VERDICT: APPROVED
```

#### lens-tests-r3

Canonical body: `/home/felixb/.claude/agents/review-tests.md`. Launcher role: `sensitive`. Snapshot: `plan-r3.md`.

```text
No drift findings. The three obligations retain concrete failure assertions, including alias refusal on predicate revert, refusal while cached owners survive, successful retry after final release, and exclusion of competing WAL/SHM files.

The test selectors and native CI jobs still reach those boundaries. The source and gate drift does not invalidate the planned proof. Runtime verification remains prospective.

VERDICT: APPROVED
```

#### lens-chess-semantics-r3

Canonical body: `/home/felixb/.claude/drain-plans/chessfable-0a459a4f/slot-2/wt/.claude/agents/review-chess-semantics.md`. Launcher role: `sensitive`. Snapshot: `plan-r3.md`.

```text
NOT APPLICABLE: The plan files concern SQLite binding admission and repository ownership. The three obligations cover inode identity, owner lifetime and retry, and consumer coverage and platform parity. None concerns in-memory chess trees, positions, or move paths, so this lens cannot invalidate an obligation through the drift.

VERDICT: APPROVED
```

#### lens-engine-protocol-r3

Canonical body: `/home/felixb/.claude/drain-plans/chessfable-0a459a4f/slot-2/wt/.claude/agents/review-engine-protocol.md`. Launcher role: `sensitive`. Snapshot: `plan-r3.md`.

```text
NOT APPLICABLE: The named files and three Approach obligations concern SQLite binding identity, owner lifetime, and database consumer coverage. They do not involve engine process supervision, UCI state, or asynchronous engine result routing. This lens cannot invalidate an obligation through the scoped drift.

VERDICT: APPROVED
```

#### lens-ipc-contract-r3

Canonical body: `/home/felixb/.claude/drain-plans/chessfable-0a459a4f/slot-2/wt/.claude/agents/review-ipc-contract.md`. Launcher role: `sensitive`. Snapshot: `plan-r3.md`.

```text
NOT APPLICABLE — The three obligations cover native SQLite binding admission, ownership lifetime and acquisition consumers. The assigned files introduce no IPC signatures, events, capabilities or renderer changes. IPC drift cannot invalidate these obligations. Frontend error presentation remains deferred to f-20261009-03.

VERDICT: APPROVED
```

#### lens-persisted-state-r3

Canonical body: `/home/felixb/.claude/drain-plans/chessfable-0a459a4f/slot-2/wt/.claude/agents/review-persisted-state.md`. Launcher role: `sensitive`. Snapshot: `plan-r3.md`.

```text
NOT APPLICABLE — The three plan files and Approach obligations concern native SQLite inode admission, binding ownership and consumer coverage. This lens covers persisted renderer state and tab lifecycle, which cannot invalidate those obligations through this refresh. Renderer drift alone does not expand the review scope.

VERDICT: APPROVED
```

#### lens-pgn-index-r3

Canonical body: `/home/felixb/.claude/drain-plans/chessfable-0a459a4f/slot-2/wt/.claude/agents/review-pgn-index.md`. Launcher role: `sensitive`. Snapshot: `plan-r3.md`.

```text
NOT APPLICABLE: The three obligations cover SQLite binding admission, owner lifetime, and acquisition across consumers. The plan FILES and obligation headings contain no PGN scanning, byte-offset indexing, encoding, or search contract that this lens can invalidate. Independent search and encoding drift is explicitly outside this refresh’s scope.

VERDICT: APPROVED
```

#### lens-platform-semantics-r3

Canonical body: `/home/felixb/.claude/drain-plans/chessfable-0a459a4f/slot-2/wt/.claude/agents/review-platform-semantics.md`. Launcher role: `sensitive`. Snapshot: `plan-r3.md`.

```text
No findings. The r3 delta and source drift invalidate none of the three Approach obligations.

The binding registry, repository ownership, revision reads and content-validation acquisition remain unchanged. The changed search probe still uses the repository’s bound revision-read path and propagates errors. Proof commands and native gate requirements remain intact.

No tests, builds, Windows compile check or non-Linux Unix source probe ran in this read-only review. Runtime proof remains prospective through `rust-windows-test` and `rust-macos-test`, with target compile/lint coverage through `rust-platform`.

VERDICT: APPROVED
```

#### lens-tauri-security-r3

Canonical body: `/home/felixb/.claude/drain-plans/chessfable-0a459a4f/slot-2/wt/.claude/agents/review-tauri-security.md`. Launcher role: `sensitive`. Snapshot: `plan-r3.md`.

```text
NOT APPLICABLE. The three Approach obligations concern SQLite binding admission, owner lifetime and consumer coverage. They preserve existing filesystem authority and introduce no credential, session, signed-download or backend-data boundary change. This lens cannot invalidate an obligation through the stated refresh.

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
    "findings": [
      {
        "kind": "should-fix",
        "text": "tasks/plans/.plan-sqlite-hard-link-admission-r1.body.md:67 — Existing propagation preserves `Conflict` through IPC but loses its actionable message in `src/utils/db.ts:268`. A refused hard-link alias displays “There was an error loading this database” and advice to check for corruption (`DatabasesPage.tsx:425-428`). The consumer obligation needs distinguishable user-facing conflict surfacing so intentional admission refusal is not presented as a broken database (confidence: 97)."
      }
    ],
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

[
  {
    "claim": "Per-database load presentation drops the actionable distinction of a typed admission Conflict and advises checking for corruption.",
    "dependencies": [],
    "disposition": "Defer",
    "entry": "### Per-database admission conflicts are presented as possible database corruption\n* **ID:** f-PENDING · **Status:** open · **Area:** frontend-ui · **Root:** - · **Entry:** build · **Blocked:** none\n* **Filed from:** 160c03b1-55a8-4a3d-b6f2-32fd285f929f · output /home/felixb/.claude/drain-plans/chessfable-0a459a4f/slot-0/run/attempt-160c03b1-55a8-4a3d-b6f2-32fd285f929f-1.jsonl\n* **Where:** `src/utils/db.ts:243-268`, `src/platform/errors.ts:41,196-224`, `src/components/databases/DatabasesPage.tsx:414-428`, `src/translation/en-US.json:396-401`. Confirmed at BASE `e09c186690767e13643288df38505c82126d5bd5`.\n* **Defect:** `getDatabase` catches a typed native `Conflict`, normalizes it through `safeFailureContext`, and turns it into the generic database load title. `normalizeError` preserves the backend category, but `safeFailureContext` retains only the broad renderer category and redacted message. The selected failed database panel always adds the instruction to check that the file exists and is not corrupted. A deliberate binding admission refusal therefore loses its actionable distinction and reads as a broken database. This already affects cross-parent binding conflicts and would also affect the concurrent same-parent alias refusal planned for f-20260929-05.\n* **Why it matters:** a user cannot distinguish a temporarily owned database alias from corrupt data or understand when retrying can work. Native safe refusal does not need corruption repair.\n* **Open question:** which safe typed discriminator and localized recovery presentation should distinguish database admission conflicts from other per-database load failures, without matching backend message literals or exposing raw native errors? Keep ordinary corruption guidance for failures where it is appropriate.\n* **Related:** f-20260929-05 supplies the new native admission case. f-20260913-05 is handled and covers collection listing failures with typed root-failure presentation, not this per-database metadata load panel. f-20260830-28 established the normalized error taxonomy and remains handled.\n* **Found by:** Codex `review-error-handling`, round 1 of the f-20260929-05 PLAN-ONLY review, 2026-10-09. Root confirmed the renderer execution path. Plan authorship and arbitration shared one context, and detection ran on the same model family as the planned code executor.\n",
    "id": "I1",
    "reason": "Separate existing frontend error-presentation design. Native admission already returns a safe typed Conflict through all consumers and closes the selected WAL/SHM corruption mandate. The same generic UI predates this change for cross-parent conflicts. Its safe discriminator and localized recovery presentation need their own frontend plan, rather than expanding this native ownership phase. No product answer is needed to implement the selected refusal policy.",
    "witnesses": [
      {
        "index": 1,
        "lens": "error-handling",
        "round": 1
      }
    ]
  }
]

### delta-r2.txt

--- /tmp/drain-plan-chessfable-0a459a4f-slot0/build/plan-r1.md
+++ tasks/plans/2026-10-09-sqlite-hard-link-admission.md
@@ -24,21 +24,25 @@

 ## Traced premises

-Base: e09c186690767e13643288df38505c82126d5bd5. Initial worktree is clean. Executor is Codex, CLI 0.161.0. Planner output stays in tasks/plans and /tmp/drain-plan-chessfable-0a459a4f-slot0/build. No implementation checks or release steps run in this lane.
+Original base: e09c186690767e13643288df38505c82126d5bd5. Refreshed base: b2663061a8d20d3f969c851c3ef9ce5d025b4cbb. Both inspected snapshots were clean. Executor is Codex, CLI 0.161.0. Planner output stays in tasks/plans and /tmp/drain-plan-chessfable-0a459a4f-slot0/build. No implementation checks or release steps run in this lane.
+
+The intervening f-20260929-03 implementation hardens bound Unix descriptor opens and sidecar inspection. It adds unclassified sidecar quarantine on every Unix, retaining nonblocking regular descriptors. Acquisition still admits distinct same-parent keys. The three admission obligations remain prospective and must preserve this newer descriptor and quarantine behavior.

 * `src-tauri/src/db/bound_sqlite.rs:72` defines the binding key as leaf identity, parent identity and normalized leaf name.
-* `src-tauri/src/db/bound_sqlite.rs:163` performs acquisition under the process-global registry mutex, checks published registrations and creation reservations, reuses identical keys and reserves before constructing the VFS outside the mutex.
-* `src-tauri/src/db/bound_sqlite.rs:190` currently rejects a same-inode binding only when the parent differs, so distinct leaves in one parent pass.
-* `src-tauri/src/db/bound_sqlite.rs:112` unregisters and removes a registration on last-owner drop. Reservation failure cleanup is at `:514`, publication at `:271`.
-* `src-tauri/src/db/bound_sqlite.rs:464` normalizes Windows names through the existing system up-case mapping.
+* `src-tauri/src/db/bound_sqlite.rs` `BoundDatabase::acquire` performs acquisition under the process-global registry mutex, checks published registrations and creation reservations, reuses identical keys and reserves before constructing the VFS outside the mutex.
+* `BoundDatabase::acquire` currently rejects a same-inode binding only when the parent differs, so distinct leaves in one parent pass.
+* `Registration::drop` unregisters and removes a registration on last-owner drop. `remove_reservation` cleans up failed creation. `remove_registration_if_current` preserves token-aware removal and now governs unclassified descriptors on every Unix, alongside non-Linux per-identity quarantine.
+* `binding_key_leaf` normalizes Windows names through the existing system up-case mapping.
 * `src-tauri/src/db/repository.rs:691` acquires for a revision read, `:981` acquires before pool construction, and `:245` keeps the binding in the manager and each connection. `DatabaseEntry` also owns it.
 * `src-tauri/src/db/content_validation.rs:556` uses the same acquisition door for its query-only content scan, keeping the binding until after the connection closes.
 * `src-tauri/src/infra/path_authority/mod.rs:2073` canonicalizes the parent and preserves the leaf. Leaf spellings which the existing key normalization does not equate conservatively remain distinct keys, including Windows short names and case-insensitive Unix aliases. This plan does not add spelling normalization.
 * `src-tauri/src/db/repository.rs:373` keeps distinct canonical entry keys. The old hard-link test at `:1939` expects two live pools and must change with admission.
-* `src-tauri/src/db/bound_sqlite.rs:2607` currently expects two same-parent tokens. The non-Linux Unix quarantine test at `:2573` also assumes two hard-link bindings and must instead exercise two holders of one admissible binding.
+* `bindings_share_one_name_per_directory_entry_and_refuse_cross_parent_aliases` currently expects two same-parent tokens. The non-Linux Unix `a_descriptor_for_a_bound_inode_is_retained_until_its_last_binding_drops` test also assumes two hard-link bindings and must instead exercise two holders of one admissible binding.
 * SQLite 3.39.2 dependency source `sqlite3/sqlite3.c:36876`, `:40068` and `:58717` confirms the inode-scoped shared-memory node and pathname-scoped WAL filename. No corruption probe has been run in this planner.

 Applicable decisions: d-20260913-02 keeps repository keys separate by canonical binding. d-20260929-04 requires authority-bound VFS ownership. d-20260929-05 already refuses concurrent cross-parent aliases and explicitly files the remaining same-parent problem. d-20260930-10 and d-20261001-06 forbid ordinary open/close identity probes on Unix while SQLite locks can be held.
+
+The refresh also preserves d-20261009-08, d-20261009-09 and d-20261009-10, which govern special-file refusal, nonblocking regular descriptors and unclassified sidecar quarantine. They do not settle same-parent hard-link binding admission.

 ## Approach

@@ -91,9 +95,11 @@

 Process-global test fixtures must keep their backing directories, files and authority carriers alive for their bindings. Do not erase the registry globally or mask the queued inode-reuse finding f-20261002-02. CI is the runtime authority for Windows and macOS. No unresolved product decision is identified.

+At the refreshed base, release records name f-20261009-04 as the GitHub Actions availability blocker. The adopting session must recheck that operational prerequisite and obtain required native CI proof before reporting release complete. This planner makes no live CI availability claim.
+
 ## Not part of this task

-Only f-20260929-05 is selected. All other open findings remain at their recorded tiers, including f-20260929-03, f-20260929-04, f-20260930-01, f-20261001-02 and f-20261002-02. Their distinct sidecar, logging, eviction, cross-capability and fixture designs are not folded into this plan.
+Only f-20260929-05 is selected. Other findings remain with their existing owners, including f-20260929-04, f-20260930-01, f-20261001-02 and f-20261002-02. Their distinct logging, eviction, cross-capability and fixture designs are not folded into this plan. f-20260929-03 is now handled, and its descriptor hardening is preserved.

 ## Phases

@@ -127,3 +133,4 @@
 ## Carried to diff review

 None at initial revision.
+

### delta-r3.txt

ROUND: 3
DELTA: /home/felixb/.claude/drain-plans/chessfable-0a459a4f/slot-2/wt/tasks/plans/.plan-delta-2026-10-09-sqlite-hard-link-admission-r3.diff
REVISED:
## Traced premises
## Risks / open questions
SETTLED:
# Plan: Refuse concurrent SQLite hard-link bindings
## Goal
## MANDATE
## MANDATE > ### Two hard-link names of one database in the same directory share SQLite's `-shm` but get separate `-wal` files
## Threat model and non-goals
## Approach
## Approach > ### Single binding identity per inode
## Approach > ### Owner lifetime and retry
## Approach > ### Consumer coverage and platform parity
## Decisions and trade-offs
## Decided autonomously
## Not part of this task
## Phases
## Phases > ### Phase 1: Binding admission and its consumers
## Release verification for the adopting session
## Carried to diff review

### lens-chess-semantics-r1.txt

NOT APPLICABLE: The three Approach obligations concern SQLite binding admission, owner lifetime, and consumer/platform coverage. The named Rust database files and planned changes do not affect in-memory chess trees, positions, move paths, or chess-domain metadata.

VERDICT: APPROVED
### lens-chess-semantics-r2.txt

NOT APPLICABLE — The listed native database files and all three Approach obligations concern SQLite alias admission, binding ownership and platform proof. The described drift cannot invalidate an in-memory chess-tree, position-identity or move-path invariant.

VERDICT: APPROVED
### lens-chess-semantics-r3.txt

NOT APPLICABLE: The plan files concern SQLite binding admission and repository ownership. The three obligations cover inode identity, owner lifetime and retry, and consumer coverage and platform parity. None concerns in-memory chess trees, positions, or move paths, so this lens cannot invalidate an obligation through the drift.

VERDICT: APPROVED
### lens-correctness-r1.txt

No correctness defects found in the three planned obligations.

Limitation: implementation and platform runtime behavior remain unverified in this plan-only review (confidence: 95).

VERDICT: APPROVED
### lens-correctness-r2.txt

No open correctness issues require closure. No drift defects invalidate the three Approach obligations.

The expanded Unix quarantine preserves binding-key admission and token-aware cleanup. Same-key holders keep the registration alive. Final release removes admission, allowing a surviving alias to obtain its own binding. Pools, revision reads and content validation still acquire before opening SQLite, preserving immediate typed conflict propagation.

Limitation: implementation and runtime behavior remain prospective. Native macOS and Windows proof must come from the required CI jobs. No tests were run or files changed (confidence: 100).

VERDICT: APPROVED
### lens-correctness-r3.txt

No correctness defects found in the r3 delta or source drift affecting the three Approach obligations. Acquisition, registry ownership, revision reads and content-validation admission remain unchanged. The search-loader refactor preserves identity probing through the repository. Proof commands and Rust gate requirements are unchanged.

Limitation: runtime behavior remains prospective. Tests, builds and native CI were not run in this read-only review. Confidence: 95/100.

VERDICT: APPROVED
### lens-engine-protocol-r1.txt

NOT APPLICABLE: The named database files and plan obligations concern SQLite inode admission, binding lifetime, and consumer coverage. They do not affect engine process supervision, UCI protocol state, or asynchronous engine-result routing.
VERDICT: APPROVED
### lens-engine-protocol-r2.txt

NOT APPLICABLE — The named files and obligations concern SQLite inode admission, binding lifetime, retry, and consumer/platform proof. They do not intersect with engine process supervision, UCI protocol state, or asynchronous engine result routing. This lens cannot invalidate an obligation through the described drift.

VERDICT: APPROVED
### lens-engine-protocol-r3.txt

NOT APPLICABLE: The named files and three Approach obligations concern SQLite binding identity, owner lifetime, and database consumer coverage. They do not involve engine process supervision, UCI state, or asynchronous engine result routing. This lens cannot invalidate an obligation through the scoped drift.

VERDICT: APPROVED
### lens-error-handling-r1.txt

[should-fix] tasks/plans/.plan-sqlite-hard-link-admission-r1.body.md:67 — Existing propagation preserves `Conflict` through IPC but loses its actionable message in `src/utils/db.ts:268`. A refused hard-link alias displays “There was an error loading this database” and advice to check for corruption (`DatabasesPage.tsx:425-428`). The consumer obligation needs distinguishable user-facing conflict surfacing so intentional admission refusal is not presented as a broken database (confidence: 97).

VERDICT: APPROVED
### lens-error-handling-r2.txt

No in-scope error-handling defects found. The drift preserves typed admission refusal, failed-creation cleanup and token-aware final-owner release. Quarantined descriptors remain separate from binding admission.

Runtime verification remains prospective, including required Windows and macOS CI proof. No tests were run or files changed.

VERDICT: APPROVED
### lens-error-handling-r3.txt

No error-handling defects found in the r3 delta or relevant source drift. Binding admission, ownership and content-validation acquisition are unchanged. The revised search identity probe preserves typed error propagation, and the gate-contract change leaves the required Rust proofs intact.

Runtime verification remains prospective. No tests were run.

VERDICT: APPROVED
### lens-ipc-contract-r1.txt

NOT APPLICABLE: The three obligations govern native SQLite binding admission, ownership and consumer coverage. The assigned files and plan introduce no events, command signatures, renderer subscriptions, generated bindings or capability changes.

VERDICT: APPROVED
### lens-ipc-contract-r2.txt

NOT APPLICABLE — The assigned files and three Approach obligations concern native SQLite inode admission, binding ownership and retry, and consumer/platform coverage. The described descriptor and sidecar ownership drift does not touch events, command signatures, renderer payloads, subscriptions, or capability scopes, so this IPC lens cannot invalidate those obligations.

VERDICT: APPROVED
### lens-ipc-contract-r3.txt

NOT APPLICABLE — The three obligations cover native SQLite binding admission, ownership lifetime and acquisition consumers. The assigned files introduce no IPC signatures, events, capabilities or renderer changes. IPC drift cannot invalidate these obligations. Frontend error presentation remains deferred to f-20261009-03.

VERDICT: APPROVED
### lens-minimalism-r1.txt

VERDICT: APPROVED
### lens-minimalism-r2.txt

No in-scope bloat or duplication defects found. The ownership drift reuses the existing registry and cleanup. The plan requires one shared admission predicate for published bindings and reservations, with consumer changes limited to regression tests. No additional abstraction or registry is required.

VERDICT: APPROVED
### lens-minimalism-r3.txt

NOT APPLICABLE: The refresh adds no planned abstraction, configurability or duplicate implementation. All three Approach obligations remain unchanged. Git confirms no drift in the assigned files, content validation or path authority. Bloat in independent search or progress changes is outside this review’s scope.

VERDICT: APPROVED
### lens-persisted-state-r1.txt

NOT APPLICABLE: The three obligations concern backend SQLite binding admission, owner lifetime and consumer coverage. The named Rust files do not involve renderer storage keys, persisted atoms, hydration or tab lifecycle.
VERDICT: APPROVED
### lens-persisted-state-r2.txt

NOT APPLICABLE — The named files and three Approach obligations concern native SQLite binding identity, owner lifetime, and consumer/platform coverage. This drift cannot invalidate an obligation through renderer storage keys, hydration, atom families, or tab lifecycle.

VERDICT: APPROVED
### lens-persisted-state-r3.txt

NOT APPLICABLE — The three plan files and Approach obligations concern native SQLite inode admission, binding ownership and consumer coverage. This lens covers persisted renderer state and tab lifecycle, which cannot invalidate those obligations through this refresh. Renderer drift alone does not expand the review scope.

VERDICT: APPROVED
### lens-pgn-index-r1.txt

NOT APPLICABLE: The files and three Approach obligations concern SQLite hard-link binding admission, owner lifetime and consumer coverage. They do not change PGN byte scanning, offsets, encoding, database indexing or search predicates.

VERDICT: APPROVED
### lens-pgn-index-r2.txt

NOT APPLICABLE: The named files and three Approach obligations concern SQLite binding admission, owner lifetime and retry, and consumer/platform coverage. The described drift changes descriptor inspection and sidecar ownership, outside this lens’s PGN scanning, offset indexing, encoding, and search scope.

VERDICT: APPROVED
### lens-pgn-index-r3.txt

NOT APPLICABLE: The three obligations cover SQLite binding admission, owner lifetime, and acquisition across consumers. The plan FILES and obligation headings contain no PGN scanning, byte-offset indexing, encoding, or search contract that this lens can invalidate. Independent search and encoding drift is explicitly outside this refresh’s scope.

VERDICT: APPROVED
### lens-plan-r1.txt

VERDICT: APPROVED
### lens-plan-r2.txt

No open issues require closure. No drift-scope plan defects found in final candidate r2.

The changed Unix quarantine machinery remains compatible with all three obligations. Token-aware cleanup still supports final-owner retry (`bound_sqlite.rs:542`). The new sidecar ownership witness uses distinct primary database identities (`repository.rs:4418`), so refusing concurrent primary aliases does not invalidate it. Consumer acquisition still propagates typed errors before alias pool construction.

Named limitation: runtime behavior and Windows/macOS CI availability were not verified in this read-only review (confidence: 100). No files changed or tests run.

VERDICT: APPROVED
### lens-plan-r3.txt

No open issues require closure. No drift-scope plan defects found in candidate r3.

The search-loader refactor still propagates errors through the unchanged revision-read acquisition path (`search.rs:214`, `repository.rs:691`). Binding admission, owner lifetime, pool construction and content-validation acquisition remain unchanged. Proof commands remain available, and the gate-contract drift does not affect this Rust-only phase.

Limitation: runtime behavior and live Windows/macOS CI availability were not verified. Those proofs remain required during adoption (confidence: 100). No files changed or tests run.

VERDICT: APPROVED
### lens-platform-semantics-r1.txt

No platform-specific defect found in the planned mechanism or proof.

Windows and macOS runtime evidence must come from `rust-windows-test` and `rust-macos-test`. `rust-platform` provides compile/lint evidence. Neither `pnpm rust:windows:check` nor the non-Linux Unix source probe was run during this read-only plan review.

VERDICT: APPROVED
### lens-platform-semantics-r2.txt

No open issues require closure. No platform defect in the r2 delta or source drift invalidates the three Approach obligations. The Unix quarantine changes preserve registration ownership and token-aware cleanup. The plan explicitly preserves them and adapts the macOS lifetime test to same-key holders.

No tests, builds, Windows check or non-Linux source probe ran in this read-only review. Recorded predecessor compile evidence does not verify the prospective admission change. Native runtime proof remains required through `rust-windows-test` and `rust-macos-test`. `rust-platform` provides compile/lint coverage. The refreshed plan retains the CI availability prerequisite.

VERDICT: APPROVED
### lens-platform-semantics-r3.txt

No findings. The r3 delta and source drift invalidate none of the three Approach obligations.

The binding registry, repository ownership, revision reads and content-validation acquisition remain unchanged. The changed search probe still uses the repository’s bound revision-read path and propagates errors. Proof commands and native gate requirements remain intact.

No tests, builds, Windows compile check or non-Linux Unix source probe ran in this read-only review. Runtime proof remains prospective through `rust-windows-test` and `rust-macos-test`, with target compile/lint coverage through `rust-platform`.

VERDICT: APPROVED
### lens-tauri-security-r1.txt

No in-scope security defects found in the three plan obligations. Admission remains behind the authority-bound carrier, preserves per-name filesystem ownership, and requires a safe conflict message before alias VFS creation or SQLite open.

Limitations: plan-only review, no runtime verification. Credentials, sessions and signed downloads are unaffected.

VERDICT: APPROVED
### lens-tauri-security-r2.txt

No security-owned issues await closure. No in-scope defects found that invalidate the three Approach obligations.

The drift preserves retained-parent containment, no-follow opens, descriptor validation and token-aware cleanup. The refreshed plan explicitly preserves quarantine ownership and requires native platform proof.

Limitations: runtime behavior remains prospective. Credentials, sessions and signed downloads are absent from this drift. No files changed or tests run.

VERDICT: APPROVED
### lens-tauri-security-r3.txt

NOT APPLICABLE. The three Approach obligations concern SQLite binding admission, owner lifetime and consumer coverage. They preserve existing filesystem authority and introduce no credential, session, signed-download or backend-data boundary change. This lens cannot invalidate an obligation through the stated refresh.

VERDICT: APPROVED
### lens-tests-r1.txt

VERDICT: APPROVED
### lens-tests-r2.txt

No drift-induced verification defects found. All three obligations retain concrete failure assertions. The quarantine changes do not invalidate alias refusal, final-owner retry or consumer/platform proof.

Limitation: regression tests and the revert witness remain prospective. Native Windows/macOS runtime evidence is required before release completion (confidence: 100).

VERDICT: APPROVED
### lens-tests-r3.txt

No drift findings. The three obligations retain concrete failure assertions, including alias refusal on predicate revert, refusal while cached owners survive, successful retry after final release, and exclusion of competing WAL/SHM files.

The test selectors and native CI jobs still reach those boundaries. The source and gate drift does not invalidate the planned proof. Runtime verification remains prospective.

VERDICT: APPROVED
### plan-r1.md

# Plan: Refuse concurrent SQLite hard-link bindings

## Goal

Close f-20260929-05 by preventing one database inode from being opened through distinct hard-link names concurrently inside ChessFable. Keep ordinary repeated access, canonical parent spellings and existing normalized-key aliases working.

## MANDATE

### Two hard-link names of one database in the same directory share SQLite's `-shm` but get separate `-wal` files

* **ID:** f-20260929-05 · **Status:** open · **Area:** db-search · **Root:** - · **Entry:** build · **Blocked:** none
* **Where:** `src-tauri/src/db/repository.rs` (`hard_link_bindings_have_separate_repository_entries`, `:1795-1815`, pins separate entries for two names of one inode); SQLite 3.39.2 unix VFS per-inode record and `-shm` node keyed by (dev, ino) (`libsqlite3-sys-0.25.2/sqlite3/sqlite3.c:36876-36887, 40068-40112`) while the WAL name is derived from each connection's own path (`:58717-58723`).
* **Defect:** when both names are open in one process, SQLite pairs a single shared-memory wal-index with two different `-wal` files. SQLite documents multiple links to one database file as a corruption hazard. Pre-existing with pathname opens; `f-20260929-01`'s binding keeps both names' sidecars inside the one authorized parent but does not change the pairing.
* **Why it matters:** a user who registers the same database twice through hard-linked names in one folder can corrupt it by opening both.
* **Open question:** refuse a second concurrent name for an inode that already has a live binding in the same directory (a user-visible `Conflict` until the first repository entry is evicted — the entry keeps its binding alive while cached), route both names through one binding (then the binding's leaf name must survive the deletion of either name), or detect hard-linked databases at registration and refuse them?
* **Related:** `f-20260929-01` (plan review round 9 of `tasks/plans/2026-09-29-sqlite-bound-vfs.md`: `review-plan` asked for safe pairing, `review-correctness` showed sharing one binding breaks the surviving alias when the other name is deleted; both left outside that mandate), `f-20260905-03`.
* **Found by:** Codex `review-plan` / `review-correctness` lenses, plan review round 9, 2026-09-29 (drain session `1af0f1fc-ab06-4981-9a3d-47a89d71c541`).

## Threat model and non-goals

Accidental registration of two hard-link names and concurrent app operations are in scope on Linux, macOS and Windows. The boundary is the process-global bound SQLite registry, covering ChessFable's game database pools, revision reads and content-validation connections. This plan prevents simultaneous distinct binding keys for one inode.

This is not a general promise that SQLite databases with hard links are safe. External processes using another name, a residual WAL after a crash, sequential alias switching with orphan sidecars, malicious filesystem changes, cross-capability raw file opens and database recovery are existing separate hazards. No new cross-process lock, registration ban, sidecar migration or recovery protocol is introduced. Existing authority and no-follow checks continue to apply.

## Traced premises

Base: e09c186690767e13643288df38505c82126d5bd5. Initial worktree is clean. Executor is Codex, CLI 0.161.0. Planner output stays in tasks/plans and /tmp/drain-plan-chessfable-0a459a4f-slot0/build. No implementation checks or release steps run in this lane.

* `src-tauri/src/db/bound_sqlite.rs:72` defines the binding key as leaf identity, parent identity and normalized leaf name.
* `src-tauri/src/db/bound_sqlite.rs:163` performs acquisition under the process-global registry mutex, checks published registrations and creation reservations, reuses identical keys and reserves before constructing the VFS outside the mutex.
* `src-tauri/src/db/bound_sqlite.rs:190` currently rejects a same-inode binding only when the parent differs, so distinct leaves in one parent pass.
* `src-tauri/src/db/bound_sqlite.rs:112` unregisters and removes a registration on last-owner drop. Reservation failure cleanup is at `:514`, publication at `:271`.
* `src-tauri/src/db/bound_sqlite.rs:464` normalizes Windows names through the existing system up-case mapping.
* `src-tauri/src/db/repository.rs:691` acquires for a revision read, `:981` acquires before pool construction, and `:245` keeps the binding in the manager and each connection. `DatabaseEntry` also owns it.
* `src-tauri/src/db/content_validation.rs:556` uses the same acquisition door for its query-only content scan, keeping the binding until after the connection closes.
* `src-tauri/src/infra/path_authority/mod.rs:2073` canonicalizes the parent and preserves the leaf. Leaf spellings which the existing key normalization does not equate conservatively remain distinct keys, including Windows short names and case-insensitive Unix aliases. This plan does not add spelling normalization.
* `src-tauri/src/db/repository.rs:373` keeps distinct canonical entry keys. The old hard-link test at `:1939` expects two live pools and must change with admission.
* `src-tauri/src/db/bound_sqlite.rs:2607` currently expects two same-parent tokens. The non-Linux Unix quarantine test at `:2573` also assumes two hard-link bindings and must instead exercise two holders of one admissible binding.
* SQLite 3.39.2 dependency source `sqlite3/sqlite3.c:36876`, `:40068` and `:58717` confirms the inode-scoped shared-memory node and pathname-scoped WAL filename. No corruption probe has been run in this planner.

Applicable decisions: d-20260913-02 keeps repository keys separate by canonical binding. d-20260929-04 requires authority-bound VFS ownership. d-20260929-05 already refuses concurrent cross-parent aliases and explicitly files the remaining same-parent problem. d-20260930-10 and d-20261001-06 forbid ordinary open/close identity probes on Unix while SQLite locks can be held.

## Approach

### Single binding identity per inode

Authority: MANDATE's option to “refuse a second concurrent name for an inode that already has a live binding in the same directory”.

The existing acquisition door admits at most one distinct binding key for a leaf identity across live registrations and in-progress creation reservations. Identical keys reuse the registration or follow the existing same-key creation wait. Distinct leaf identities remain independent. Compare using the existing platform-normalized key, preserving Windows case aliases.

The registry owns admission atomically under its existing mutex. A conflicting different-parent key retains the existing directory-conflict behavior. A conflicting different-leaf key in the same parent returns a typed `Error::Conflict` with a safe message identifying another database name, before VFS creation or SQLite open for that alias. Both published and reserved competitors enforce the same predicate through one shared definition. Do not add ordinary leaf opens, link-count checks, new locks or registries.

Verification level: binding API behavior and synchronized multi-thread acquisition, including a held creation reservation. An alias refusal assertion must go red when the admission predicate is restored from Git to the base behavior while the new tests remain.

### Owner lifetime and retry

Authority: MANDATE's “until the first repository entry is evicted — the entry keeps its binding alive while cached” and the requirement that a surviving alias not depend on a deleted name.

Keep existing binding ownership in registrations, pool managers, entries and connection holders. Refusal lasts while any holder of the first registration survives or its construction reservation exists. Normal cleanup releases admission through the existing token-aware removal. After final release, a surviving alias can acquire its own binding and uses its own authorized leaf, without rewriting another alias's sidecars or borrowing the old name. Failed creation must leave no admission reservation that blocks later access.

Verification level: lifetime assertions at the binding boundary and repository integration. Returning a connection to an idle cached pool must not make the alias admissible. Closing the first entry and releasing all connection/entry owners must permit the alias. Deleting the original leaf after clean release must not prevent opening the surviving alias.

### Consumer coverage and platform parity

Authority: MANDATE's “when both names are open in one process” and “a user who registers the same database twice”.

Keep the one acquisition door shared by pools, revision reads and content validation. Fail closed through their existing typed-error propagation, without waiting for an r2d2 connection timeout or publishing an alias pool. Keep distinct repository keys rather than merging their write locks or caches.

Update affected tests and comments whose claims now contradict admission. Regression coverage proves real SQLite connections through the repository cannot open the competing same-parent alias while the original owner remains. In a WAL-mode fixture, alias refusal leaves the first connection usable and creates no competing alias WAL/SHM files. Include the revision-read consumer and content-validation acquisition coverage at their existing test boundaries.

Verification level: common binding tests run on all three operating systems, Linux repository tests, retained Windows case-folding tests, and the non-Linux Unix quarantine lifetime test. The GNU Windows gate is compile/lint evidence. Windows and macOS runtime claims wait for their existing CI jobs.

## Decisions and trade-offs

Retain build tier. The finding's open admission-policy choice is not settled by d-20260929-05, which intentionally excluded this same-parent case. No ledger header is changed by the planner.

Prefer extending existing fail-closed binding admission. Sharing a name ties the surviving alias to a deletable path and reopens the rejected shared-entry design. Registration-time hard-link rejection is broader than the concurrent corruption case and cannot prevent links created after registration. Changing repository keys alone does not govern revision or scan connections.

The prospective decision refines the same-parent allowance in d-20260929-05 using the separately filed corruption evidence. Its cross-parent refusal and Windows spelling reuse remain. The adopting session must explicitly record this refinement and its prior decision, with supersession limited to that allowance. d-20260913-02's key structure remains valid.

Plan authorship and arbitration share this root context. Detection runs through fresh Codex launcher leaves on the same OpenAI model family as the planned code executor. This is session separation, not model-family separation.

## Decided autonomously

* Question: which same-parent hard-link policy closes f-20260929-05? Chosen: refuse concurrent distinct binding keys for one inode at the shared bound SQLite acquisition door. Rejected: share one name or pool, and registration-time link-count bans. Reason: preserve authorized leaf ownership while stopping the exact WAL/SHM pairing defect at every in-process consumer. Reversal path: restore the same-parent admission allowance, accepting the recorded hazard. The adopting session records the scoped refinement of d-20260929-05 before implementation.
* Question: who verifies and what stays outside this task? Chosen: automated Rust runtime regressions plus existing Windows/macOS CI. Exclude UI, registration redesign, cross-process coordination, crash recovery and independent queued findings. Rejected: ask Felix to create hard links or inspect a corruption experiment. Reason: this is a deterministic native admission contract.

## Risks / open questions

Cached entries keep aliases refused even when no caller is actively querying. This is the deliberate first policy option from the finding. Existing normal release/eviction removes that conflict. No new UI action is proposed.

Process-global test fixtures must keep their backing directories, files and authority carriers alive for their bindings. Do not erase the registry globally or mask the queued inode-reuse finding f-20261002-02. CI is the runtime authority for Windows and macOS. No unresolved product decision is identified.

## Not part of this task

Only f-20260929-05 is selected. All other open findings remain at their recorded tiers, including f-20260929-03, f-20260929-04, f-20260930-01, f-20261001-02 and f-20261002-02. Their distinct sidecar, logging, eviction, cross-capability and fixture designs are not folded into this plan.

## Phases

### Phase 1: Binding admission and its consumers

One cohesive phase, one sensitive write leaf. Resolve model and effort from `leaf.codex.write.sensitive` through the released model registry, never hardcode a model id. Root inspects the whole diff and independently runs proof before its scoped commit.

Files: `src-tauri/src/db/bound_sqlite.rs`, `src-tauri/src/db/repository.rs`, `src-tauri/src/db/content_validation_tests.rs`. Read `content_validation.rs`, existing platform fixtures and the cited decisions. Only test-boundary changes are expected in the content-validation area. This touches native persistence and concurrency, with no command signatures, schema, dependency or renderer changes.

Implement the three Approach obligations together. The phase brief owns precise regression cases and assertion placement, including reserved-key races, same-key reuse, alias refusal with live/cached owners, final-release retry, failed-creation cleanup, surviving-name access, WAL sidecar exclusion and platform tests. Preserve existing quarantine coverage with same-key owner clones. Use existing synchronization hooks and bounded channel waits, no timing-only race tests.

Exact proof command, run sequentially:

```bash
cargo test --manifest-path src-tauri/Cargo.toml --locked db::bound_sqlite::tests
cargo test --manifest-path src-tauri/Cargo.toml --locked db::repository::
cargo test --manifest-path src-tauri/Cargo.toml --locked db::content_validation
pnpm checks:pre-review
```

The write leaf performs and records the Git-anchored source revert witness on the new alias-refusal regression, then restores and reruns green. The root runs the exact proof again. No coverage baseline/floor changes.

## Release verification for the adopting session

Complete cumulative diff review and any repairs before final gates. Include correctness, root-cause, tests, error-handling and platform lenses, plus every newly triggered lens under the canonical push selection. Carry the full plan-review handoff into a tracked task record before final gates.

Final Rust-only gate: `pnpm gates:push -- --rust`, through the mandatory detached headless gate route on the committed clean tree. It includes contract, kit parity, Linux backend tests/coverage and Windows GNU compile/lint. No frontend or bindings block is selected absent a later cross-layer change. Verify required `rust-windows-test`, `rust-macos-test` and `rust-platform` CI jobs on the pushed SHA and ordinary upstream equality. Run the master installer only when the canonical push contract requires it.

No visible UI change or IPC signature change is planned, so no screenshot/browser contract is asserted. If implementation changes lifecycle or IPC beyond the admission seam, return to scoped review and apply the project's verify-ui contract. Close f-20260929-05 through the locked findings command only after verified implementation, then complete release and records under next-finding.

## Carried to diff review

None at initial revision.

### plan-r2.md

# Plan: Refuse concurrent SQLite hard-link bindings

## Goal

Close f-20260929-05 by preventing one database inode from being opened through distinct hard-link names concurrently inside ChessFable. Keep ordinary repeated access, canonical parent spellings and existing normalized-key aliases working.

## MANDATE

### Two hard-link names of one database in the same directory share SQLite's `-shm` but get separate `-wal` files

* **ID:** f-20260929-05 · **Status:** open · **Area:** db-search · **Root:** - · **Entry:** build · **Blocked:** none
* **Where:** `src-tauri/src/db/repository.rs` (`hard_link_bindings_have_separate_repository_entries`, `:1795-1815`, pins separate entries for two names of one inode); SQLite 3.39.2 unix VFS per-inode record and `-shm` node keyed by (dev, ino) (`libsqlite3-sys-0.25.2/sqlite3/sqlite3.c:36876-36887, 40068-40112`) while the WAL name is derived from each connection's own path (`:58717-58723`).
* **Defect:** when both names are open in one process, SQLite pairs a single shared-memory wal-index with two different `-wal` files. SQLite documents multiple links to one database file as a corruption hazard. Pre-existing with pathname opens; `f-20260929-01`'s binding keeps both names' sidecars inside the one authorized parent but does not change the pairing.
* **Why it matters:** a user who registers the same database twice through hard-linked names in one folder can corrupt it by opening both.
* **Open question:** refuse a second concurrent name for an inode that already has a live binding in the same directory (a user-visible `Conflict` until the first repository entry is evicted — the entry keeps its binding alive while cached), route both names through one binding (then the binding's leaf name must survive the deletion of either name), or detect hard-linked databases at registration and refuse them?
* **Related:** `f-20260929-01` (plan review round 9 of `tasks/plans/2026-09-29-sqlite-bound-vfs.md`: `review-plan` asked for safe pairing, `review-correctness` showed sharing one binding breaks the surviving alias when the other name is deleted; both left outside that mandate), `f-20260905-03`.
* **Found by:** Codex `review-plan` / `review-correctness` lenses, plan review round 9, 2026-09-29 (drain session `1af0f1fc-ab06-4981-9a3d-47a89d71c541`).

## Threat model and non-goals

Accidental registration of two hard-link names and concurrent app operations are in scope on Linux, macOS and Windows. The boundary is the process-global bound SQLite registry, covering ChessFable's game database pools, revision reads and content-validation connections. This plan prevents simultaneous distinct binding keys for one inode.

This is not a general promise that SQLite databases with hard links are safe. External processes using another name, a residual WAL after a crash, sequential alias switching with orphan sidecars, malicious filesystem changes, cross-capability raw file opens and database recovery are existing separate hazards. No new cross-process lock, registration ban, sidecar migration or recovery protocol is introduced. Existing authority and no-follow checks continue to apply.

## Traced premises

Original base: e09c186690767e13643288df38505c82126d5bd5. Refreshed base: b2663061a8d20d3f969c851c3ef9ce5d025b4cbb. Both inspected snapshots were clean. Executor is Codex, CLI 0.161.0. Planner output stays in tasks/plans and /tmp/drain-plan-chessfable-0a459a4f-slot0/build. No implementation checks or release steps run in this lane.

The intervening f-20260929-03 implementation hardens bound Unix descriptor opens and sidecar inspection. It adds unclassified sidecar quarantine on every Unix, retaining nonblocking regular descriptors. Acquisition still admits distinct same-parent keys. The three admission obligations remain prospective and must preserve this newer descriptor and quarantine behavior.

* `src-tauri/src/db/bound_sqlite.rs:72` defines the binding key as leaf identity, parent identity and normalized leaf name.
* `src-tauri/src/db/bound_sqlite.rs` `BoundDatabase::acquire` performs acquisition under the process-global registry mutex, checks published registrations and creation reservations, reuses identical keys and reserves before constructing the VFS outside the mutex.
* `BoundDatabase::acquire` currently rejects a same-inode binding only when the parent differs, so distinct leaves in one parent pass.
* `Registration::drop` unregisters and removes a registration on last-owner drop. `remove_reservation` cleans up failed creation. `remove_registration_if_current` preserves token-aware removal and now governs unclassified descriptors on every Unix, alongside non-Linux per-identity quarantine.
* `binding_key_leaf` normalizes Windows names through the existing system up-case mapping.
* `src-tauri/src/db/repository.rs:691` acquires for a revision read, `:981` acquires before pool construction, and `:245` keeps the binding in the manager and each connection. `DatabaseEntry` also owns it.
* `src-tauri/src/db/content_validation.rs:556` uses the same acquisition door for its query-only content scan, keeping the binding until after the connection closes.
* `src-tauri/src/infra/path_authority/mod.rs:2073` canonicalizes the parent and preserves the leaf. Leaf spellings which the existing key normalization does not equate conservatively remain distinct keys, including Windows short names and case-insensitive Unix aliases. This plan does not add spelling normalization.
* `src-tauri/src/db/repository.rs:373` keeps distinct canonical entry keys. The old hard-link test at `:1939` expects two live pools and must change with admission.
* `bindings_share_one_name_per_directory_entry_and_refuse_cross_parent_aliases` currently expects two same-parent tokens. The non-Linux Unix `a_descriptor_for_a_bound_inode_is_retained_until_its_last_binding_drops` test also assumes two hard-link bindings and must instead exercise two holders of one admissible binding.
* SQLite 3.39.2 dependency source `sqlite3/sqlite3.c:36876`, `:40068` and `:58717` confirms the inode-scoped shared-memory node and pathname-scoped WAL filename. No corruption probe has been run in this planner.

Applicable decisions: d-20260913-02 keeps repository keys separate by canonical binding. d-20260929-04 requires authority-bound VFS ownership. d-20260929-05 already refuses concurrent cross-parent aliases and explicitly files the remaining same-parent problem. d-20260930-10 and d-20261001-06 forbid ordinary open/close identity probes on Unix while SQLite locks can be held.

The refresh also preserves d-20261009-08, d-20261009-09 and d-20261009-10, which govern special-file refusal, nonblocking regular descriptors and unclassified sidecar quarantine. They do not settle same-parent hard-link binding admission.

## Approach

### Single binding identity per inode

Authority: MANDATE's option to “refuse a second concurrent name for an inode that already has a live binding in the same directory”.

The existing acquisition door admits at most one distinct binding key for a leaf identity across live registrations and in-progress creation reservations. Identical keys reuse the registration or follow the existing same-key creation wait. Distinct leaf identities remain independent. Compare using the existing platform-normalized key, preserving Windows case aliases.

The registry owns admission atomically under its existing mutex. A conflicting different-parent key retains the existing directory-conflict behavior. A conflicting different-leaf key in the same parent returns a typed `Error::Conflict` with a safe message identifying another database name, before VFS creation or SQLite open for that alias. Both published and reserved competitors enforce the same predicate through one shared definition. Do not add ordinary leaf opens, link-count checks, new locks or registries.

Verification level: binding API behavior and synchronized multi-thread acquisition, including a held creation reservation. An alias refusal assertion must go red when the admission predicate is restored from Git to the base behavior while the new tests remain.

### Owner lifetime and retry

Authority: MANDATE's “until the first repository entry is evicted — the entry keeps its binding alive while cached” and the requirement that a surviving alias not depend on a deleted name.

Keep existing binding ownership in registrations, pool managers, entries and connection holders. Refusal lasts while any holder of the first registration survives or its construction reservation exists. Normal cleanup releases admission through the existing token-aware removal. After final release, a surviving alias can acquire its own binding and uses its own authorized leaf, without rewriting another alias's sidecars or borrowing the old name. Failed creation must leave no admission reservation that blocks later access.

Verification level: lifetime assertions at the binding boundary and repository integration. Returning a connection to an idle cached pool must not make the alias admissible. Closing the first entry and releasing all connection/entry owners must permit the alias. Deleting the original leaf after clean release must not prevent opening the surviving alias.

### Consumer coverage and platform parity

Authority: MANDATE's “when both names are open in one process” and “a user who registers the same database twice”.

Keep the one acquisition door shared by pools, revision reads and content validation. Fail closed through their existing typed-error propagation, without waiting for an r2d2 connection timeout or publishing an alias pool. Keep distinct repository keys rather than merging their write locks or caches.

Update affected tests and comments whose claims now contradict admission. Regression coverage proves real SQLite connections through the repository cannot open the competing same-parent alias while the original owner remains. In a WAL-mode fixture, alias refusal leaves the first connection usable and creates no competing alias WAL/SHM files. Include the revision-read consumer and content-validation acquisition coverage at their existing test boundaries.

Verification level: common binding tests run on all three operating systems, Linux repository tests, retained Windows case-folding tests, and the non-Linux Unix quarantine lifetime test. The GNU Windows gate is compile/lint evidence. Windows and macOS runtime claims wait for their existing CI jobs.

## Decisions and trade-offs

Retain build tier. The finding's open admission-policy choice is not settled by d-20260929-05, which intentionally excluded this same-parent case. No ledger header is changed by the planner.

Prefer extending existing fail-closed binding admission. Sharing a name ties the surviving alias to a deletable path and reopens the rejected shared-entry design. Registration-time hard-link rejection is broader than the concurrent corruption case and cannot prevent links created after registration. Changing repository keys alone does not govern revision or scan connections.

The prospective decision refines the same-parent allowance in d-20260929-05 using the separately filed corruption evidence. Its cross-parent refusal and Windows spelling reuse remain. The adopting session must explicitly record this refinement and its prior decision, with supersession limited to that allowance. d-20260913-02's key structure remains valid.

Plan authorship and arbitration share this root context. Detection runs through fresh Codex launcher leaves on the same OpenAI model family as the planned code executor. This is session separation, not model-family separation.

## Decided autonomously

* Question: which same-parent hard-link policy closes f-20260929-05? Chosen: refuse concurrent distinct binding keys for one inode at the shared bound SQLite acquisition door. Rejected: share one name or pool, and registration-time link-count bans. Reason: preserve authorized leaf ownership while stopping the exact WAL/SHM pairing defect at every in-process consumer. Reversal path: restore the same-parent admission allowance, accepting the recorded hazard. The adopting session records the scoped refinement of d-20260929-05 before implementation.
* Question: who verifies and what stays outside this task? Chosen: automated Rust runtime regressions plus existing Windows/macOS CI. Exclude UI, registration redesign, cross-process coordination, crash recovery and independent queued findings. Rejected: ask Felix to create hard links or inspect a corruption experiment. Reason: this is a deterministic native admission contract.

## Risks / open questions

Cached entries keep aliases refused even when no caller is actively querying. This is the deliberate first policy option from the finding. Existing normal release/eviction removes that conflict. No new UI action is proposed.

Process-global test fixtures must keep their backing directories, files and authority carriers alive for their bindings. Do not erase the registry globally or mask the queued inode-reuse finding f-20261002-02. CI is the runtime authority for Windows and macOS. No unresolved product decision is identified.

At the refreshed base, release records name f-20261009-04 as the GitHub Actions availability blocker. The adopting session must recheck that operational prerequisite and obtain required native CI proof before reporting release complete. This planner makes no live CI availability claim.

## Not part of this task

Only f-20260929-05 is selected. Other findings remain with their existing owners, including f-20260929-04, f-20260930-01, f-20261001-02 and f-20261002-02. Their distinct logging, eviction, cross-capability and fixture designs are not folded into this plan. f-20260929-03 is now handled, and its descriptor hardening is preserved.

## Phases

### Phase 1: Binding admission and its consumers

One cohesive phase, one sensitive write leaf. Resolve model and effort from `leaf.codex.write.sensitive` through the released model registry, never hardcode a model id. Root inspects the whole diff and independently runs proof before its scoped commit.

Files: `src-tauri/src/db/bound_sqlite.rs`, `src-tauri/src/db/repository.rs`, `src-tauri/src/db/content_validation_tests.rs`. Read `content_validation.rs`, existing platform fixtures and the cited decisions. Only test-boundary changes are expected in the content-validation area. This touches native persistence and concurrency, with no command signatures, schema, dependency or renderer changes.

Implement the three Approach obligations together. The phase brief owns precise regression cases and assertion placement, including reserved-key races, same-key reuse, alias refusal with live/cached owners, final-release retry, failed-creation cleanup, surviving-name access, WAL sidecar exclusion and platform tests. Preserve existing quarantine coverage with same-key owner clones. Use existing synchronization hooks and bounded channel waits, no timing-only race tests.

Exact proof command, run sequentially:

```bash
cargo test --manifest-path src-tauri/Cargo.toml --locked db::bound_sqlite::tests
cargo test --manifest-path src-tauri/Cargo.toml --locked db::repository::
cargo test --manifest-path src-tauri/Cargo.toml --locked db::content_validation
pnpm checks:pre-review
```

The write leaf performs and records the Git-anchored source revert witness on the new alias-refusal regression, then restores and reruns green. The root runs the exact proof again. No coverage baseline/floor changes.

## Release verification for the adopting session

Complete cumulative diff review and any repairs before final gates. Include correctness, root-cause, tests, error-handling and platform lenses, plus every newly triggered lens under the canonical push selection. Carry the full plan-review handoff into a tracked task record before final gates.

Final Rust-only gate: `pnpm gates:push -- --rust`, through the mandatory detached headless gate route on the committed clean tree. It includes contract, kit parity, Linux backend tests/coverage and Windows GNU compile/lint. No frontend or bindings block is selected absent a later cross-layer change. Verify required `rust-windows-test`, `rust-macos-test` and `rust-platform` CI jobs on the pushed SHA and ordinary upstream equality. Run the master installer only when the canonical push contract requires it.

No visible UI change or IPC signature change is planned, so no screenshot/browser contract is asserted. If implementation changes lifecycle or IPC beyond the admission seam, return to scoped review and apply the project's verify-ui contract. Close f-20260929-05 through the locked findings command only after verified implementation, then complete release and records under next-finding.

## Carried to diff review

None at initial revision.

## Reviews

Round 1 completed all 12 plan-capable lenses through fresh read-only canonical launcher leaves. All raw verdicts are APPROVED. No substantive plan correction was adopted, so no closure round is required. The frozen body is unchanged from `plan-r1.md`.

Measured round wall elapsed: 435.136 seconds, including launch, parallel review, polling, arbitration and successor filing. Active review wall time is unknown. No separately measured quota, dependency, release or other wait is recorded. Parallel leaf durations are not summed. One completed round, `r1=0` adopted findings, one unique issue opened, zero Fix, zero Skip, one Defer. No native mandate obligations remain open. Implementation and final-review rework have not run. No inherited rounds, withdrawals, rewrites or correction-introduced defects.

### I1: Admission conflict UI presentation

Witness: error-handling, round 1, raw finding 1, should-fix, confidence 97. Claim: Per-database load presentation drops the actionable distinction of a typed admission Conflict and advises checking for corruption.

Disposition: Defer. Separate existing frontend error-presentation design. Native admission already returns a safe typed Conflict through all consumers and closes the selected WAL/SHM corruption mandate. The same generic UI predates this change for cross-parent conflicts. Its safe discriminator and localized recovery presentation need their own frontend plan, rather than expanding this native ownership phase. No product answer is needed to implement the selected refusal policy.

Evidence: `src/utils/db.ts:243-268` maps the broad validation category to the generic title. `src/platform/errors.ts:196-224` retains backend category in normalization but drops it in SafeFailureContext. `DatabasesPage.tsx:414-428` adds the unconditional corruption guidance. Existing listing-failure handling f-20260913-05 concerns root listing and does not cover per-database metadata failure. d-20261008-03 and d-20261008-04 retain visible per-item records and do not decide their conflict copy.

Dependencies: none. No correction revision or closure round. Successor owns I1. Published spool receipt: `/home/felixb/Projekte/chessfable/tasks/findings-inbox/20261009-042718-3129188-1791512838135035497-6.md`. The session-free content receipt returned `published`. Exact entry bytes are carried in `plan-meta.json` and the handoff.

The adopting session must persist `reviews-handoff.md` as `tasks/handoffs/2026-10-09-sqlite-hard-link-admission-review.md` before final gates. Once the successor has an allocated ID, annotate it to link that tracked file, inherit I1 and require loading the file before review. Complete this successor link before closing the parent finding. The planner cannot annotate the external ledger or alter published intake files.

Plan authorship and arbitration shared one root context. Detection ran in fresh Codex leaf sessions on the same OpenAI model family as the planned code executor.

### plan-r3.md

# Plan: Refuse concurrent SQLite hard-link bindings

## Goal

Close f-20260929-05 by preventing one database inode from being opened through distinct hard-link names concurrently inside ChessFable. Keep ordinary repeated access, canonical parent spellings and existing normalized-key aliases working.

## MANDATE

### Two hard-link names of one database in the same directory share SQLite's `-shm` but get separate `-wal` files

* **ID:** f-20260929-05 · **Status:** open · **Area:** db-search · **Root:** - · **Entry:** build · **Blocked:** none
* **Where:** `src-tauri/src/db/repository.rs` (`hard_link_bindings_have_separate_repository_entries`, `:1795-1815`, pins separate entries for two names of one inode); SQLite 3.39.2 unix VFS per-inode record and `-shm` node keyed by (dev, ino) (`libsqlite3-sys-0.25.2/sqlite3/sqlite3.c:36876-36887, 40068-40112`) while the WAL name is derived from each connection's own path (`:58717-58723`).
* **Defect:** when both names are open in one process, SQLite pairs a single shared-memory wal-index with two different `-wal` files. SQLite documents multiple links to one database file as a corruption hazard. Pre-existing with pathname opens; `f-20260929-01`'s binding keeps both names' sidecars inside the one authorized parent but does not change the pairing.
* **Why it matters:** a user who registers the same database twice through hard-linked names in one folder can corrupt it by opening both.
* **Open question:** refuse a second concurrent name for an inode that already has a live binding in the same directory (a user-visible `Conflict` until the first repository entry is evicted — the entry keeps its binding alive while cached), route both names through one binding (then the binding's leaf name must survive the deletion of either name), or detect hard-linked databases at registration and refuse them?
* **Related:** `f-20260929-01` (plan review round 9 of `tasks/plans/2026-09-29-sqlite-bound-vfs.md`: `review-plan` asked for safe pairing, `review-correctness` showed sharing one binding breaks the surviving alias when the other name is deleted; both left outside that mandate), `f-20260905-03`.
* **Found by:** Codex `review-plan` / `review-correctness` lenses, plan review round 9, 2026-09-29 (drain session `1af0f1fc-ab06-4981-9a3d-47a89d71c541`).

## Threat model and non-goals

Accidental registration of two hard-link names and concurrent app operations are in scope on Linux, macOS and Windows. The boundary is the process-global bound SQLite registry, covering ChessFable's game database pools, revision reads and content-validation connections. This plan prevents simultaneous distinct binding keys for one inode.

This is not a general promise that SQLite databases with hard links are safe. External processes using another name, a residual WAL after a crash, sequential alias switching with orphan sidecars, malicious filesystem changes, cross-capability raw file opens and database recovery are existing separate hazards. No new cross-process lock, registration ban, sidecar migration or recovery protocol is introduced. Existing authority and no-follow checks continue to apply.

## Traced premises

Original base: e09c186690767e13643288df38505c82126d5bd5. Refreshed bases: b2663061a8d20d3f969c851c3ef9ce5d025b4cbb, then 2b5520363201b8a3a0db6dd9ad707fca8e51651e. All inspected snapshots were clean. Executor is Codex. Planner output stays in tasks/plans and the lane's RUN_TMP. No implementation checks or release steps run in this lane.

The second refresh drift changes none of the three plan files, `content_validation.rs` or `infra/path_authority`. Its native changes are confined to `db/search.rs`, `db/mod.rs`, `db/encoding.rs`, `db/search_index.rs` and `progress.rs`, none of which reaches the binding acquisition door.

The intervening f-20260929-03 implementation hardens bound Unix descriptor opens and sidecar inspection. It adds unclassified sidecar quarantine on every Unix, retaining nonblocking regular descriptors. Acquisition still admits distinct same-parent keys. The three admission obligations remain prospective and must preserve this newer descriptor and quarantine behavior.

* `src-tauri/src/db/bound_sqlite.rs:72` defines the binding key as leaf identity, parent identity and normalized leaf name.
* `src-tauri/src/db/bound_sqlite.rs` `BoundDatabase::acquire` performs acquisition under the process-global registry mutex, checks published registrations and creation reservations, reuses identical keys and reserves before constructing the VFS outside the mutex.
* `BoundDatabase::acquire` currently rejects a same-inode binding only when the parent differs, so distinct leaves in one parent pass.
* `Registration::drop` unregisters and removes a registration on last-owner drop. `remove_reservation` cleans up failed creation. `remove_registration_if_current` preserves token-aware removal and now governs unclassified descriptors on every Unix, alongside non-Linux per-identity quarantine.
* `binding_key_leaf` normalizes Windows names through the existing system up-case mapping.
* `src-tauri/src/db/repository.rs:691` acquires for a revision read, `:981` acquires before pool construction, and `:245` keeps the binding in the manager and each connection. `DatabaseEntry` also owns it.
* `src-tauri/src/db/content_validation.rs:556` uses the same acquisition door for its query-only content scan, keeping the binding until after the connection closes.
* `src-tauri/src/infra/path_authority/mod.rs:2073` canonicalizes the parent and preserves the leaf. Leaf spellings which the existing key normalization does not equate conservatively remain distinct keys, including Windows short names and case-insensitive Unix aliases. This plan does not add spelling normalization.
* `src-tauri/src/db/repository.rs:373` keeps distinct canonical entry keys. The old hard-link test at `:1939` expects two live pools and must change with admission.
* `bindings_share_one_name_per_directory_entry_and_refuse_cross_parent_aliases` currently expects two same-parent tokens. The non-Linux Unix `a_descriptor_for_a_bound_inode_is_retained_until_its_last_binding_drops` test also assumes two hard-link bindings and must instead exercise two holders of one admissible binding.
* SQLite 3.39.2 dependency source `sqlite3/sqlite3.c:36876`, `:40068` and `:58717` confirms the inode-scoped shared-memory node and pathname-scoped WAL filename. No corruption probe has been run in this planner.

Applicable decisions: d-20260913-02 keeps repository keys separate by canonical binding. d-20260929-04 requires authority-bound VFS ownership. d-20260929-05 already refuses concurrent cross-parent aliases and explicitly files the remaining same-parent problem. d-20260930-10 and d-20261001-06 forbid ordinary open/close identity probes on Unix while SQLite locks can be held.

The refresh also preserves d-20261009-08, d-20261009-09 and d-20261009-10, which govern special-file refusal, nonblocking regular descriptors and unclassified sidecar quarantine. They do not settle same-parent hard-link binding admission.

## Approach

### Single binding identity per inode

Authority: MANDATE's option to “refuse a second concurrent name for an inode that already has a live binding in the same directory”.

The existing acquisition door admits at most one distinct binding key for a leaf identity across live registrations and in-progress creation reservations. Identical keys reuse the registration or follow the existing same-key creation wait. Distinct leaf identities remain independent. Compare using the existing platform-normalized key, preserving Windows case aliases.

The registry owns admission atomically under its existing mutex. A conflicting different-parent key retains the existing directory-conflict behavior. A conflicting different-leaf key in the same parent returns a typed `Error::Conflict` with a safe message identifying another database name, before VFS creation or SQLite open for that alias. Both published and reserved competitors enforce the same predicate through one shared definition. Do not add ordinary leaf opens, link-count checks, new locks or registries.

Verification level: binding API behavior and synchronized multi-thread acquisition, including a held creation reservation. An alias refusal assertion must go red when the admission predicate is restored from Git to the base behavior while the new tests remain.

### Owner lifetime and retry

Authority: MANDATE's “until the first repository entry is evicted — the entry keeps its binding alive while cached” and the requirement that a surviving alias not depend on a deleted name.

Keep existing binding ownership in registrations, pool managers, entries and connection holders. Refusal lasts while any holder of the first registration survives or its construction reservation exists. Normal cleanup releases admission through the existing token-aware removal. After final release, a surviving alias can acquire its own binding and uses its own authorized leaf, without rewriting another alias's sidecars or borrowing the old name. Failed creation must leave no admission reservation that blocks later access.

Verification level: lifetime assertions at the binding boundary and repository integration. Returning a connection to an idle cached pool must not make the alias admissible. Closing the first entry and releasing all connection/entry owners must permit the alias. Deleting the original leaf after clean release must not prevent opening the surviving alias.

### Consumer coverage and platform parity

Authority: MANDATE's “when both names are open in one process” and “a user who registers the same database twice”.

Keep the one acquisition door shared by pools, revision reads and content validation. Fail closed through their existing typed-error propagation, without waiting for an r2d2 connection timeout or publishing an alias pool. Keep distinct repository keys rather than merging their write locks or caches.

Update affected tests and comments whose claims now contradict admission. Regression coverage proves real SQLite connections through the repository cannot open the competing same-parent alias while the original owner remains. In a WAL-mode fixture, alias refusal leaves the first connection usable and creates no competing alias WAL/SHM files. Include the revision-read consumer and content-validation acquisition coverage at their existing test boundaries.

Verification level: common binding tests run on all three operating systems, Linux repository tests, retained Windows case-folding tests, and the non-Linux Unix quarantine lifetime test. The GNU Windows gate is compile/lint evidence. Windows and macOS runtime claims wait for their existing CI jobs.

## Decisions and trade-offs

Retain build tier. The finding's open admission-policy choice is not settled by d-20260929-05, which intentionally excluded this same-parent case. No ledger header is changed by the planner.

Prefer extending existing fail-closed binding admission. Sharing a name ties the surviving alias to a deletable path and reopens the rejected shared-entry design. Registration-time hard-link rejection is broader than the concurrent corruption case and cannot prevent links created after registration. Changing repository keys alone does not govern revision or scan connections.

The prospective decision refines the same-parent allowance in d-20260929-05 using the separately filed corruption evidence. Its cross-parent refusal and Windows spelling reuse remain. The adopting session must explicitly record this refinement and its prior decision, with supersession limited to that allowance. d-20260913-02's key structure remains valid.

Plan authorship and arbitration share this root context. Detection runs through fresh Codex launcher leaves on the same OpenAI model family as the planned code executor. This is session separation, not model-family separation.

## Decided autonomously

* Question: which same-parent hard-link policy closes f-20260929-05? Chosen: refuse concurrent distinct binding keys for one inode at the shared bound SQLite acquisition door. Rejected: share one name or pool, and registration-time link-count bans. Reason: preserve authorized leaf ownership while stopping the exact WAL/SHM pairing defect at every in-process consumer. Reversal path: restore the same-parent admission allowance, accepting the recorded hazard. The adopting session records the scoped refinement of d-20260929-05 before implementation.
* Question: who verifies and what stays outside this task? Chosen: automated Rust runtime regressions plus existing Windows/macOS CI. Exclude UI, registration redesign, cross-process coordination, crash recovery and independent queued findings. Rejected: ask Felix to create hard links or inspect a corruption experiment. Reason: this is a deterministic native admission contract.

## Risks / open questions

Cached entries keep aliases refused even when no caller is actively querying. This is the deliberate first policy option from the finding. Existing normal release/eviction removes that conflict. No new UI action is proposed.

Process-global test fixtures must keep their backing directories, files and authority carriers alive for their bindings. Do not erase the registry globally or mask the queued inode-reuse finding f-20261002-02. CI is the runtime authority for Windows and macOS. No unresolved product decision is identified.

f-20261009-04, the earlier GitHub Actions availability blocker, is handled at 2b552036: fork workflows were re-enabled and Test run 38083147123 concluded success on every required job. The adopting session still rechecks CI availability as a volatile prerequisite and obtains required native CI proof on its pushed SHA before reporting release complete. This planner makes no live CI availability claim.

## Not part of this task

Only f-20260929-05 is selected. Other findings remain with their existing owners, including f-20260929-04, f-20260930-01, f-20261001-02 and f-20261002-02. Their distinct logging, eviction, cross-capability and fixture designs are not folded into this plan. f-20260929-03 is now handled, and its descriptor hardening is preserved.

## Phases

### Phase 1: Binding admission and its consumers

One cohesive phase, one sensitive write leaf. Resolve model and effort from `leaf.codex.write.sensitive` through the released model registry, never hardcode a model id. Root inspects the whole diff and independently runs proof before its scoped commit.

Files: `src-tauri/src/db/bound_sqlite.rs`, `src-tauri/src/db/repository.rs`, `src-tauri/src/db/content_validation_tests.rs`. Read `content_validation.rs`, existing platform fixtures and the cited decisions. Only test-boundary changes are expected in the content-validation area. This touches native persistence and concurrency, with no command signatures, schema, dependency or renderer changes.

Implement the three Approach obligations together. The phase brief owns precise regression cases and assertion placement, including reserved-key races, same-key reuse, alias refusal with live/cached owners, final-release retry, failed-creation cleanup, surviving-name access, WAL sidecar exclusion and platform tests. Preserve existing quarantine coverage with same-key owner clones. Use existing synchronization hooks and bounded channel waits, no timing-only race tests.

Exact proof command, run sequentially:

```bash
cargo test --manifest-path src-tauri/Cargo.toml --locked db::bound_sqlite::tests
cargo test --manifest-path src-tauri/Cargo.toml --locked db::repository::
cargo test --manifest-path src-tauri/Cargo.toml --locked db::content_validation
pnpm checks:pre-review
```

The write leaf performs and records the Git-anchored source revert witness on the new alias-refusal regression, then restores and reruns green. The root runs the exact proof again. No coverage baseline/floor changes.

## Release verification for the adopting session

Complete cumulative diff review and any repairs before final gates. Include correctness, root-cause, tests, error-handling and platform lenses, plus every newly triggered lens under the canonical push selection. Carry the full plan-review handoff into a tracked task record before final gates.

Final Rust-only gate: `pnpm gates:push -- --rust`, through the mandatory detached headless gate route on the committed clean tree. It includes contract, kit parity, Linux backend tests/coverage and Windows GNU compile/lint. No frontend or bindings block is selected absent a later cross-layer change. Verify required `rust-windows-test`, `rust-macos-test` and `rust-platform` CI jobs on the pushed SHA and ordinary upstream equality. Run the master installer only when the canonical push contract requires it.

No visible UI change or IPC signature change is planned, so no screenshot/browser contract is asserted. If implementation changes lifecycle or IPC beyond the admission seam, return to scoped review and apply the project's verify-ui contract. Close f-20260929-05 through the locked findings command only after verified implementation, then complete release and records under next-finding.

## Carried to diff review

None at initial revision.

## Reviews

Round 1 completed all 12 plan-capable lenses through fresh read-only canonical launcher leaves. All raw verdicts are APPROVED. No substantive plan correction was adopted, so no closure round is required. The frozen body is unchanged from `plan-r1.md`.

Measured round wall elapsed: 435.136 seconds, including launch, parallel review, polling, arbitration and successor filing. Active review wall time is unknown. No separately measured quota, dependency, release or other wait is recorded. Parallel leaf durations are not summed. One completed round, `r1=0` adopted findings, one unique issue opened, zero Fix, zero Skip, one Defer. No native mandate obligations remain open. Implementation and final-review rework have not run. No inherited rounds, withdrawals, rewrites or correction-introduced defects.

### I1: Admission conflict UI presentation

Witness: error-handling, round 1, raw finding 1, should-fix, confidence 97. Claim: Per-database load presentation drops the actionable distinction of a typed admission Conflict and advises checking for corruption.

Disposition: Defer. Separate existing frontend error-presentation design. Native admission already returns a safe typed Conflict through all consumers and closes the selected WAL/SHM corruption mandate. The same generic UI predates this change for cross-parent conflicts. Its safe discriminator and localized recovery presentation need their own frontend plan, rather than expanding this native ownership phase. No product answer is needed to implement the selected refusal policy.

Evidence: `src/utils/db.ts:243-268` maps the broad validation category to the generic title. `src/platform/errors.ts:196-224` retains backend category in normalization but drops it in SafeFailureContext. `DatabasesPage.tsx:414-428` adds the unconditional corruption guidance. Existing listing-failure handling f-20260913-05 concerns root listing and does not cover per-database metadata failure. d-20261008-03 and d-20261008-04 retain visible per-item records and do not decide their conflict copy.

Dependencies: none. No correction revision or closure round. Successor owns I1. Published spool receipt: `/home/felixb/Projekte/chessfable/tasks/findings-inbox/20261009-042718-3129188-1791512838135035497-6.md`. The session-free content receipt returned `published`. Exact entry bytes are carried in `plan-meta.json` and the handoff.

The adopting session must persist `reviews-handoff.md` as `tasks/handoffs/2026-10-09-sqlite-hard-link-admission-review.md` before final gates. Once the successor has an allocated ID, annotate it to link that tracked file, inherit I1 and require loading the file before review. Complete this successor link before closing the parent finding. The planner cannot annotate the external ledger or alter published intake files.

Plan authorship and arbitration shared one root context. Detection ran in fresh Codex leaf sessions on the same OpenAI model family as the planned code executor.

### Round 2: Source-drift refresh

Refreshed BASE `e09c186690767e13643288df38505c82126d5bd5` to NEW-BASE `b2663061a8d20d3f969c851c3ef9ce5d025b4cbb`. All 12 requested lenses ran through read-only canonical launcher leaves at their original roles. All raw verdicts are APPROVED, with zero findings. Five lenses reported that their classes cannot invalidate this plan through the drift. No retries, unavailable reviewers or fallback routing occurred.

The exact process-generated source drift was compared byte-for-byte with actual `git diff BASE..NEW-BASE`. SHA-256: `fd77fc46a82ed0da08af4670e9702353a2d76c30d92600807874c64f23790ee4`. `plan-r2.md` froze the refreshed candidate before review. The script-generated `delta-r2.txt` identified Traced premises, Risks / open questions and Not part of this task as revised. The fixed MANDATE and the three Approach obligations stayed unchanged. The updated source references and predecessor status reflect inspected source and records, not a new mandate or lens adoption.

New decisions d-20261009-08 through d-20261009-10 are preserved as constraints. `BoundDatabase::acquire` still admits distinct same-parent keys. Token-aware removal and both quarantine lifetimes remain compatible with refusing those keys. The new sidecar metadata witness uses distinct primary database identities, so it remains admissible. No admission design change or further correction round is required.

Measured round wall elapsed: 212.059 seconds, including launch, parallel review, polling and arbitration. Active review wall time is unknown. No separately measured quota, dependency, release or other wait. Ordinary reviewer polling is review elapsed. Parallel leaf durations are not summed. Completed lineage: two rounds, `r1=0 r2=0` adopted findings. Round 2 opens zero issues and closes zero implementation defects. Cumulative unique issues: one, dispositioned Defer. Zero Fix, zero Skip, zero unresolved native plan obligations. No withdrawals, splits, correction-introduced defects or implementation/final-review rework.

I1 retains its exact filed entry bytes and witness tuple. Its receipt now reads `merged`, and the successor is f-20261009-03. Do not re-file it. The adopting session must preserve the complete handoff in the tracked path already named above and annotate that successor with the I1 inheritance and load-before-review instruction before closing the parent. This plan remains ready for adoption. Required native runtime proof and the recorded GitHub Actions prerequisite remain with adoption, not with this read-only planner.

Plan authorship and arbitration shared one root context. Detection ran in fresh Codex launcher leaves on the same OpenAI model family as the planned code executor.

### delta-r2.txt

--- /tmp/drain-plan-chessfable-0a459a4f-slot0/build/plan-r1.md
+++ tasks/plans/2026-10-09-sqlite-hard-link-admission.md
@@ -24,21 +24,25 @@

 ## Traced premises

-Base: e09c186690767e13643288df38505c82126d5bd5. Initial worktree is clean. Executor is Codex, CLI 0.161.0. Planner output stays in tasks/plans and /tmp/drain-plan-chessfable-0a459a4f-slot0/build. No implementation checks or release steps run in this lane.
+Original base: e09c186690767e13643288df38505c82126d5bd5. Refreshed base: b2663061a8d20d3f969c851c3ef9ce5d025b4cbb. Both inspected snapshots were clean. Executor is Codex, CLI 0.161.0. Planner output stays in tasks/plans and /tmp/drain-plan-chessfable-0a459a4f-slot0/build. No implementation checks or release steps run in this lane.
+
+The intervening f-20260929-03 implementation hardens bound Unix descriptor opens and sidecar inspection. It adds unclassified sidecar quarantine on every Unix, retaining nonblocking regular descriptors. Acquisition still admits distinct same-parent keys. The three admission obligations remain prospective and must preserve this newer descriptor and quarantine behavior.

 * `src-tauri/src/db/bound_sqlite.rs:72` defines the binding key as leaf identity, parent identity and normalized leaf name.
-* `src-tauri/src/db/bound_sqlite.rs:163` performs acquisition under the process-global registry mutex, checks published registrations and creation reservations, reuses identical keys and reserves before constructing the VFS outside the mutex.
-* `src-tauri/src/db/bound_sqlite.rs:190` currently rejects a same-inode binding only when the parent differs, so distinct leaves in one parent pass.
-* `src-tauri/src/db/bound_sqlite.rs:112` unregisters and removes a registration on last-owner drop. Reservation failure cleanup is at `:514`, publication at `:271`.
-* `src-tauri/src/db/bound_sqlite.rs:464` normalizes Windows names through the existing system up-case mapping.
+* `src-tauri/src/db/bound_sqlite.rs` `BoundDatabase::acquire` performs acquisition under the process-global registry mutex, checks published registrations and creation reservations, reuses identical keys and reserves before constructing the VFS outside the mutex.
+* `BoundDatabase::acquire` currently rejects a same-inode binding only when the parent differs, so distinct leaves in one parent pass.
+* `Registration::drop` unregisters and removes a registration on last-owner drop. `remove_reservation` cleans up failed creation. `remove_registration_if_current` preserves token-aware removal and now governs unclassified descriptors on every Unix, alongside non-Linux per-identity quarantine.
+* `binding_key_leaf` normalizes Windows names through the existing system up-case mapping.
 * `src-tauri/src/db/repository.rs:691` acquires for a revision read, `:981` acquires before pool construction, and `:245` keeps the binding in the manager and each connection. `DatabaseEntry` also owns it.
 * `src-tauri/src/db/content_validation.rs:556` uses the same acquisition door for its query-only content scan, keeping the binding until after the connection closes.
 * `src-tauri/src/infra/path_authority/mod.rs:2073` canonicalizes the parent and preserves the leaf. Leaf spellings which the existing key normalization does not equate conservatively remain distinct keys, including Windows short names and case-insensitive Unix aliases. This plan does not add spelling normalization.
 * `src-tauri/src/db/repository.rs:373` keeps distinct canonical entry keys. The old hard-link test at `:1939` expects two live pools and must change with admission.
-* `src-tauri/src/db/bound_sqlite.rs:2607` currently expects two same-parent tokens. The non-Linux Unix quarantine test at `:2573` also assumes two hard-link bindings and must instead exercise two holders of one admissible binding.
+* `bindings_share_one_name_per_directory_entry_and_refuse_cross_parent_aliases` currently expects two same-parent tokens. The non-Linux Unix `a_descriptor_for_a_bound_inode_is_retained_until_its_last_binding_drops` test also assumes two hard-link bindings and must instead exercise two holders of one admissible binding.
 * SQLite 3.39.2 dependency source `sqlite3/sqlite3.c:36876`, `:40068` and `:58717` confirms the inode-scoped shared-memory node and pathname-scoped WAL filename. No corruption probe has been run in this planner.

 Applicable decisions: d-20260913-02 keeps repository keys separate by canonical binding. d-20260929-04 requires authority-bound VFS ownership. d-20260929-05 already refuses concurrent cross-parent aliases and explicitly files the remaining same-parent problem. d-20260930-10 and d-20261001-06 forbid ordinary open/close identity probes on Unix while SQLite locks can be held.
+
+The refresh also preserves d-20261009-08, d-20261009-09 and d-20261009-10, which govern special-file refusal, nonblocking regular descriptors and unclassified sidecar quarantine. They do not settle same-parent hard-link binding admission.

 ## Approach

@@ -91,9 +95,11 @@

 Process-global test fixtures must keep their backing directories, files and authority carriers alive for their bindings. Do not erase the registry globally or mask the queued inode-reuse finding f-20261002-02. CI is the runtime authority for Windows and macOS. No unresolved product decision is identified.

+At the refreshed base, release records name f-20261009-04 as the GitHub Actions availability blocker. The adopting session must recheck that operational prerequisite and obtain required native CI proof before reporting release complete. This planner makes no live CI availability claim.
+
 ## Not part of this task

-Only f-20260929-05 is selected. All other open findings remain at their recorded tiers, including f-20260929-03, f-20260929-04, f-20260930-01, f-20261001-02 and f-20261002-02. Their distinct sidecar, logging, eviction, cross-capability and fixture designs are not folded into this plan.
+Only f-20260929-05 is selected. Other findings remain with their existing owners, including f-20260929-04, f-20260930-01, f-20261001-02 and f-20261002-02. Their distinct logging, eviction, cross-capability and fixture designs are not folded into this plan. f-20260929-03 is now handled, and its descriptor hardening is preserved.

 ## Phases

@@ -127,3 +133,4 @@
 ## Carried to diff review

 None at initial revision.
+

### delta-r3.txt

ROUND: 3
DELTA: /home/felixb/.claude/drain-plans/chessfable-0a459a4f/slot-2/wt/tasks/plans/.plan-delta-2026-10-09-sqlite-hard-link-admission-r3.diff
REVISED:
## Traced premises
## Risks / open questions
SETTLED:
# Plan: Refuse concurrent SQLite hard-link bindings
## Goal
## MANDATE
## MANDATE > ### Two hard-link names of one database in the same directory share SQLite's `-shm` but get separate `-wal` files
## Threat model and non-goals
## Approach
## Approach > ### Single binding identity per inode
## Approach > ### Owner lifetime and retry
## Approach > ### Consumer coverage and platform parity
## Decisions and trade-offs
## Decided autonomously
## Not part of this task
## Phases
## Phases > ### Phase 1: Binding admission and its consumers
## Release verification for the adopting session
## Carried to diff review

## Adoption (2026-10-11)

Adopted by drain session `d7fc28c0-e3c5-4fb5-b34f-fee1b64dec2f` (Claude Code, Opus 5.5 orchestrator, Codex executor) through `ADOPT-PLAN` at BASE `2b5520363201b8a3a0db6dd9ad707fca8e51651e`; the adopt gate printed `clear`. The plan was copied unchanged to `tasks/plans/2026-10-11-sqlite-hard-link-admission.md`. This tracked record is the consumed `reviews-handoff.md` with trailing whitespace stripped (no other byte changed in the preserved history) plus this section.

The plan's `## Decided autonomously` entries were recorded as `d-20261011-01` (the admission policy; supersedes `d-20260929-05` as to its same-directory allowance only, trailer set on `d-20260929-05`) and `d-20261011-02` (verification route and exclusions) before implementation.

Successor `f-20261009-03` owns I1 and is annotated to load this file before review. Plan-review metrics carried into the build ledger as `planned ahead`: rounds r1–r3, per-round wall elapsed 435.136 s, 212.059 s, 173.0 s, `plan_adopted_per_round` `r1=0 r2=0 r3=0`, one unique issue (I1, Defer).
