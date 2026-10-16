# Plan-only review handoff: f-20261002-04

Pinned native-fs singleton, Entry build retained after current-source revalidation. Impact class is unclassified (derived) in the ledger, with observed unbounded disk retention. Selected because Felix explicitly pinned it. No co-located findings are planned.

Base: c3214b952f58ecd114bc8d2c7cfc4a18d07aebc4. Plan: 2026-10-15-catalog-engine-retention.md. One sensitive native lifecycle implementation phase remains pending. No implementation, commits, push, build lock, claim mutation, dev server or browser occurred.

## Review provenance

Plan authorship and arbitration shared one Codex context. Detection ran as separate read-only selected-executor Codex launcher leaves on the same model family as the code, without family separation. Launcher role review-plan was used for review-plan and sensitive for other lenses. Full round 1 used every plan-capable user/project lens, excluding review-code-quality and review-root-cause because both declare plan-review false. Later rounds followed correction witnesses and affected obligations.

## Metrics

Completed rounds: 3. Per-round wall seconds: 314.896, 246.81, 132.38. Plan adoptions: r1=3 r2=0 r3=0. Unique issue total 3, all 3 closed. No Skip, Defer, carried issues, withdrawals, open obligations, rewrite/split lineage or downstream implementation rework. Active wall and known non-overlapping wait totals are unknown. Reviewer polling is not classified as idle and parallel durations are not summed. No correction-created defect was observed. The final gate correction repaired an original proof-selection omission.

## Autonomous decisions and adopter obligations

Decided autonomously for adopter recording, not yet written to the ledger:

- D1: When to collect? Choose a later trusted startup with session retention. Reject immediate upgrade/shutdown collection and a new actor tree-lease registry. Existing d-20260906-09/10 already require durable ownership and conservative session retention. Cost: disk is reclaimed at a later start. Reversal: runtime collection requires a reviewed lifetime protocol proving all old-game and resource consumers.
- D2: What proves ownership? Choose native prepublication provenance plus a managed-content inventory. Reject directory-name guessing, sweeping every workspace child and promoting existing adopted trees. Existing roots can be user selected. Cost: validation reads managed content and legacy leftovers remain. Reversal: historical trees can become collectible only with independently verified provenance, not a path heuristic.
- D3: Where does lifecycle state live? Choose an additive bounded collection in the existing registry. Reject a second JSON journal, storage engine, timer or public cleanup command. It removes the observed unbounded native install retention and reuses current durability/admission. Removal path: remove this collection and its startup/publication hooks together if catalog installs cease, preserving user trees.
- D4: How to treat cleanup errors? Choose native background diagnostics and persisted retry without failing startup, preserving d-20261004-22's background record policy. Reject claiming a failed deletion succeeded or adding new UI notifications. Reversal: a demonstrated user recovery need can justify separately reviewed UI surfacing.
- D5: What proves a previous process finished using a tree? Choose durable per-session use markers cleared only by that session after confirmed successful shutdown. Reject restart as proof of child death and portable PID/name guesses. The MANDATE says never delete while an engine child may still execute, and the frozen threat model includes process interruption. Cost: a crash or unconfirmed shutdown conservatively retains affected trees indefinitely, within admission limits. Reversal: an independently proven cross-process lifetime mechanism can safely release these markers. Do not require Felix to inspect processes or clear records manually.
- D6: Can an install adopt a partially deleted tree? Choose typed refusal until a later eligible startup durably completes cleanup. Reject the existing existence-only adoption for a known cleanup-in-progress tree. The MANDATE's safe deletion and existing D9 require preserving complete live trees, not reviving damaged ones. Cost: reinstall can require restarting after a removal failure. Reversal: a reviewed recovery path may finish the already-started cleanup before fresh publication, without adopting or replacing live files.

Preserve d-20260906-08 descriptor identity registration, d-20260906-09 authority-only semantics for ordinary grants, d-20260906-10/11 prepare/save/reconcile and conservative owner evidence, d-20260918-02 canonical-spelling exemptions, d-20261004-34 the single Windows NT-open primitive, and D9 in the Stockfish handoff. The surfaced decisions about engine-option normalization, PGN saving, download-destination false results, and the old A/B path-hardening slice do not decide catalog-tree ownership and are not reopened.


## Full cumulative arbitration history

Plan authorship and arbitration share one context. Detection uses separate Codex launcher leaves on the same model family as the code, without family separation.

### Round 1

Raw verdicts: chess-semantics APPROVED (NOT APPLICABLE), correctness APPROVED, engine-protocol REVISE, error-handling APPROVED, ipc-contract APPROVED, minimalism APPROVED, persisted-state APPROVED (NOT APPLICABLE), pgn-index APPROVED (NOT APPLICABLE), plan REVISE, platform-semantics APPROVED, tauri-security APPROVED, tests APPROVED. No other prefixed findings. Platform reviewer limitation corrected the description of rust-platform from runtime to compile/lint evidence without changing the proof requirement.

- I1, engine-protocol r1 finding 1, blocker confidence 93: restart can expire protection while a prior child survives failed cleanup. Fix. Evidence: main.rs exit path at 2416 unconditionally exits, process.rs at 3771 says kill-on-drop cannot help, and shutdown_backend_with_attachments at 1809 returns a proof-bearing bool currently discarded. MANDATE no deletion while a child may execute. O2 adds durable session-use markers and successful-shutdown-only clearing, O4 adds interrupted/reopen and marker-write proof. Authority: MANDATE child-lifetime clause and frozen process-interruption threat. Closure pending r2. No dependencies.
- I2, plan r1 finding 1, blocker confidence 92: an ancestor EngineResource directory can own contents inside a catalog install. Fix. Evidence: engine_resource at mod.rs 6397 hands directory contents to an engine. O2 distinguishes explicit recursive resource ownership from workspace selection, O4 adds retention proof. MANDATE safe eligibility. Closure pending r2. No dependencies.
- I3, plan r1 finding 2, blocker confidence 93: existence-only adoption can revive a partly deleted tree. Fix. Evidence: fs.rs 1383 returns success on existence and infra/fs.rs 5061 can fail after deleting children. O3 adds durable cleanup-in-progress state before deletion and typed adoption refusal until complete, O4 adds removal/reinstall/restart proof. MANDATE safe removal while preserving usable installs, D9. Closure pending r2. Depends on O1 ownership serialization, no issue dependency.

Round 1 adopted 3 findings, 3 unique IDs opened, 0 closed, no Skip or Defer, no carried issues. Active wall and non-overlapping waits are unknown. Raw reports, prompts and immutable snapshot are retained under the supplied RUN_TMP for evidence mirroring.

### Round 2

Raw verdicts: correctness APPROVED, engine-protocol APPROVED, error-handling APPROVED, ipc-contract APPROVED, minimalism APPROVED, plan APPROVED, platform-semantics APPROVED, tauri-security APPROVED, tests APPROVED. No prefixed findings or late observations.

- I1 CLOSED by engine-protocol r2 and plan r2 at revision r2. Durable per-session use markers survive failed or interrupted shutdown, and only the originating session's confirmed successful shutdown may clear them. O4 covers reopen, persistence refusal and isolation. Source evidence: main.rs 1869 success boundary and 2416 unconditional exit.
- I2 CLOSED by plan r2 at revision r2. Explicit ancestor directory resources protect recursive contents, with the same relation for retained and session-used resources. Source evidence: mod.rs 6391 directory-resource handoff.
- I3 CLOSED by plan r2 at revision r2. Durable cleanup-in-progress state precedes deletion, both adoption paths refuse incomplete trees, and the proof crosses partial delete, reinstall and restart. Source evidence: fs.rs 1383/1469 and infra/fs.rs 5061.

Round 2 adopted 0 findings, opened 0 IDs and closed all 3 existing IDs. No Skip, Defer, carried issues, withdrawals or unresolved review obligations. Active wall and non-overlapping waits are unknown.

Arbiter correction for r3: the initial release command selected only Rust, but the existing Cross-layer contracts section in `.claude/skills/push/SKILL.md` requires frontend and bindings whenever main.rs changes. Correct the planned command to all three blocks, preserving every required gate. Also clarify O2's session-retention sentence to agree explicitly with its already-reviewed durable-use contract. This changes no deletion eligibility or shutdown behavior from revision r2. Focused plan/tests verification follows, with no new mechanism or MANDATE expansion.

### Round 3

Raw verdicts: plan APPROVED, tests APPROVED. No findings or late observations. The final candidate retains all r2 issue closures and selects the full project-required Rust/frontend/bindings gate set. Round 3 adopted 0 findings and opened 0 IDs. Final totals: 3 unique issues, all Fix and CLOSED at r2, no Skip, Defer, carried, withdrawn or open issues. No rewrite or split. No observed correction-created defect. The r3 gate correction repairs the original r1 proof selection, not a defect created by r2.

Final review timings and provenance are in sibling plan-meta.json and reviews-handoff.md. Active wall and non-overlapping quota/dependency/release waits remain unknown. Planning performed source tracing and read-only ledger validation, not implementation, runtime proof, gates, browser verification or release. Implementation remains pending under the PLAN-ONLY contract.


## Integration and proof limits

Use the reviewed O1–O4 contract. Preserve legacy/adopted and user-modified trees. Persist native ownership before publication, derive eligibility from trusted durable owner evidence, and preserve session and unresolved prior-process use. A partially deleted tree cannot become a successful adopted install. No automatic retrospective ownership inference and no guarantee of reclamation after unconfirmed prior child use.

No new finding was filed and no finding header was changed. f-20261002-04 remains open for implementation. Co-located f-20260918-02 and f-20261001-05 remain outside the planner scope. Existing copied-image orphan findings and path-hardening findings named in the plan remain independent.

The adopter records D1–D6 through the locked decision writer only after the adoption gate clears, then implements P1 via the selected executor's sensitive write leaf. Run named regression and fix-revert proofs, pre-review checks, cumulative diff review, actual-app verification, full Rust/frontend/bindings gates, required non-Linux CI and the project push/install process. This planning run establishes no runtime safety result.

## Evidence retention

Raw verdicts are preserved in the launcher reports identified by each witness, and the immutable plan snapshots, prompts and generated deltas remain in supplied RUN_TMP for the publisher's hash-indexed mirror. The publisher appends raw evidence once. This handoff preserves the full issue history and dispositions without duplicating entire reports or plan snapshots. Load this record and the published evidence before implementation or later review.

## Current refresh handoff

This section extends the preserved original handoff. The current base is 3e0ec3d9fc6ffd1328a55b94d96ca4ed54393011 and completed-round count is four. Earlier base and three-round totals above are historical.

### Round 4 — source-drift refresh, 2026-10-16

Refreshed from BASE c3214b952f58ecd114bc8d2c7cfc4a18d07aebc4 to NEW-BASE 3e0ec3d9fc6ffd1328a55b94d96ca4ed54393011. This is the first drift round after published r3. The complete approved plan body, fixed MANDATE, frozen threat model, obligations, phase and proofs are byte-identical to the r3 body. The full r4 snapshot differs only by the previously appended r3 review record. The process-generated drift file is retained as drift-c3214b952f58ecd114bc8d2c7cfc4a18d07aebc4-3e0ec3d9fc6ffd1328a55b94d96ca4ed54393011.diff in supplied RUN_TMP.

Exact REFRESH-LENSES: chess-semantics, correctness, engine-protocol, error-handling, ipc-contract, minimalism, persisted-state, pgn-index, plan, platform-semantics, tauri-security, tests. All occurred in the prior manifest. No FIRST-LOOK-LENSES were supplied. All twelve ran as separate read-only launcher leaves, with unchanged canonical lens bodies, both base SHAs, the drift path, full current plan, fixed MANDATE, exact governing decisions and inherited issue history. Raw verdicts: all twelve APPROVED. Chess-semantics and pgn-index correctly returned NOT APPLICABLE to catalog lifecycle obligations.

No prefixed findings, late observations or contrary evidence were reported. The arbiter accepts the no-drift conclusion after tracing publication, trusted owner reconciliation, resource retention, descriptor-relative removal and the shutdown success boundary. Git proves these native paths and direct engine-owner consumers have identical bytes across the bases. Changed puzzle session/tree/workspace persistence preserves the tab metadata and engine-owner evidence boundary. Database storage-size serialization and bindings do not alter catalog commands. Gesture actionability and added verifier assertions preserve the planned proof routes. Ledger decisions added by drift govern the other findings and supply no new catalog-ownership policy.

I1, I2 and I3 remain CLOSED at r2. No new issue IDs, Fix, Skip, Defer, carried items, withdrawals, open obligations, correction-created defects, rewrite or split. Round 4 adopted 0 findings. Cumulative plan adoptions: r1=3 r2=0 r3=0 r4=0. Three unique issues total, all closed. Round 4 wall: 152.963 seconds through complete report reading and arbitration. Active wall and non-overlapping wait totals remain unknown. No quota retry or fallback occurred. Parallel leaf durations are not summed.

Original plan authorship and arbitration shared one context. Refresh arbitration used this new Codex context and retained the original design without reversal. Detection ran on the same model family as the code in separate selected-executor Codex sessions. Current resolved roles: review-plan gpt-6.1-sol at high, other lenses gpt-6.1-sol at medium. No model-family separation is claimed.

The pinned finding still holds and retains Entry build. No autonomous decision was added or reversed during refresh. D1–D6 remain for the adopter to record after its gate clears. No co-located joiner was planned. This refresh changes planning artifacts only. Read-only findings validation passed. Implementation, fix-revert proof, runtime/platform checks, gates, browser work, commits, push, CI and installation remain pending under the planner contract.


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
    "artefact": "lens-engine-protocol-r1.jsonl",
    "findings": [
      {
        "kind": "blocker",
        "text": "/tmp/drain-plan-drain-90a2aa88-slot0/build/plan-r1.body.md:53 — Session protection expires before previous-session child cleanup is proven. Concrete sequence: a game retains the old binary after upgrade, child termination fails, and the application exits. `main.rs:2416` exits unconditionally after cleanup, while `process.rs:3771` explicitly states that kill-on-drop cannot protect process exit. On restart, session protection is empty and saved owners reference the upgrade, so O2 permits collecting the old tree while its child may still need adjacent resources. Require conservative protection across interrupted or unconfirmed shutdown until prior child use is ruled out, with a restart regression covering this sequence. Current-process pending-cleanup coverage does not establish that guarantee. (confidence: 93)"
      }
    ],
    "lens": "engine-protocol",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-engine-protocol-r1.prompt",
    "report": "lens-engine-protocol-r1.txt",
    "round": 1,
    "terminal": "completed",
    "verdict": "REVISE"
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
    "findings": [
      {
        "kind": "blocker",
        "text": "/tmp/drain-plan-drain-90a2aa88-slot0/build/plan-r1.body.md:51 — O2 protects entries targeting the tree or its descendants, but misses an explicit directory resource targeting an ancestor. Directory resources expose the directory and its contents to engines (`src-tauri/src/infra/path_authority/mod.rs:6397`, `:1582`). A saved or running engine using that ancestor can therefore lose resources inside a collected installation. Distinguish directory-resource ownership from bare workspace selection, and prove ancestor-resource retention through startup cleanup. (confidence: 92)"
      },
      {
        "kind": "blocker",
        "text": "/tmp/drain-plan-drain-90a2aa88-slot0/build/plan-r1.body.md:61 — O3 permits partially removed trees, but O1/O2 define no safe same-artifact adoption policy for them. The existing installer reports success whenever the destination directory exists (`src-tauri/src/fs.rs:1383`), while recursive removal can fail after deleting children (`src-tauri/src/infra/fs.rs:5061`). Reinstalling that artifact can adopt an incomplete tree. If its executable survives, registration and configuration probing can succeed (`src/utils/engines.ts:372`) and make the damaged installation live, preventing subsequent cleanup. Require recoverable handling of cleanup-in-progress destinations and a partial-removal → reinstall → restart regression. (confidence: 93)"
      }
    ],
    "lens": "plan",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-plan-r1.prompt",
    "report": "lens-plan-r1.txt",
    "round": 1,
    "terminal": "completed",
    "verdict": "REVISE"
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
  },
  {
    "artefact": "lens-chess-semantics-r4.jsonl",
    "findings": [],
    "lens": "chess-semantics",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-chess-semantics-r4.prompt",
    "report": "lens-chess-semantics-r4.txt",
    "round": 4,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-correctness-r4.jsonl",
    "findings": [],
    "lens": "correctness",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-correctness-r4.prompt",
    "report": "lens-correctness-r4.txt",
    "round": 4,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-engine-protocol-r4.jsonl",
    "findings": [],
    "lens": "engine-protocol",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-engine-protocol-r4.prompt",
    "report": "lens-engine-protocol-r4.txt",
    "round": 4,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-error-handling-r4.jsonl",
    "findings": [],
    "lens": "error-handling",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-error-handling-r4.prompt",
    "report": "lens-error-handling-r4.txt",
    "round": 4,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-ipc-contract-r4.jsonl",
    "findings": [],
    "lens": "ipc-contract",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-ipc-contract-r4.prompt",
    "report": "lens-ipc-contract-r4.txt",
    "round": 4,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-minimalism-r4.jsonl",
    "findings": [],
    "lens": "minimalism",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-minimalism-r4.prompt",
    "report": "lens-minimalism-r4.txt",
    "round": 4,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-persisted-state-r4.jsonl",
    "findings": [],
    "lens": "persisted-state",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-persisted-state-r4.prompt",
    "report": "lens-persisted-state-r4.txt",
    "round": 4,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-pgn-index-r4.jsonl",
    "findings": [],
    "lens": "pgn-index",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-pgn-index-r4.prompt",
    "report": "lens-pgn-index-r4.txt",
    "round": 4,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-plan-r4.jsonl",
    "findings": [],
    "lens": "plan",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-plan-r4.prompt",
    "report": "lens-plan-r4.txt",
    "round": 4,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-platform-semantics-r4.jsonl",
    "findings": [],
    "lens": "platform-semantics",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-platform-semantics-r4.prompt",
    "report": "lens-platform-semantics-r4.txt",
    "round": 4,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-tauri-security-r4.jsonl",
    "findings": [],
    "lens": "tauri-security",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-tauri-security-r4.prompt",
    "report": "lens-tauri-security-r4.txt",
    "round": 4,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-tests-r4.jsonl",
    "findings": [],
    "lens": "tests",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-tests-r4.prompt",
    "report": "lens-tests-r4.txt",
    "round": 4,
    "terminal": "completed",
    "verdict": "APPROVED"
  }
]

### Issues

[
  {
    "claim": "Session protection expires before prior child cleanup is proven, so restart can collect a tree still used by a surviving engine child.",
    "closed_round": 2,
    "correction": "O2 durably marks per-session managed tree use before handoff and clears only its own markers after confirmed successful shutdown. Failed or interrupted shutdown preserves prior markers. O4 adds reopen, refusal and session-isolation regressions.",
    "dependencies": [],
    "disposition": "Fix",
    "id": "I1",
    "witnesses": [
      {
        "index": 1,
        "lens": "engine-protocol",
        "round": 1
      }
    ]
  },
  {
    "claim": "An explicit directory resource targeting an ancestor owns catalog-tree contents but was absent from retention eligibility.",
    "closed_round": 2,
    "correction": "O2 protects catalog trees covered by retained or session-used ancestor EngineResource directories, distinguishing them from bare workspace selection. O4 proves retention.",
    "dependencies": [],
    "disposition": "Fix",
    "id": "I2",
    "witnesses": [
      {
        "index": 1,
        "lens": "plan",
        "round": 1
      }
    ]
  },
  {
    "claim": "Existing-target adoption can report an incompletely deleted catalog tree as a complete install.",
    "closed_round": 2,
    "correction": "O3 durably enters cleanup-in-progress before destruction and both adoption paths refuse that destination until a later eligible startup durably completes cleanup. O4 proves partial deletion, failed reinstall, cleanup restart and successful fresh reinstall.",
    "dependencies": [],
    "disposition": "Fix",
    "id": "I3",
    "witnesses": [
      {
        "index": 2,
        "lens": "plan",
        "round": 1
      }
    ]
  }
]

### delta-r2.txt

ROUND: 2
DELTA: /home/felixb/.claude/drain-plans/drain-90a2aa88/slot-0/wt/tasks/plans/.plan-delta-2026-10-15-catalog-engine-retention-r2.diff
REVISED:
## Approach > ### O2 — reachability and session protection
## Approach > ### O3 — conservative deletion and retry
## Approach > ### O4 — proof and delivery
## Decisions and trade-offs
## Risks / open questions
SETTLED:
# Plan: reclaim superseded catalog engine trees
## Goal
## MANDATE
## MANDATE > ### Superseded catalog engine install directories stay on disk forever once their handle is pruned
## Threat model and non-goals
## Traced premises
## Approach
## Approach > ### O1 — native provenance and publication
## Not part of this task
## Phases
## Phases > ### P1 — catalog installation lifecycle

### delta-r3.txt

ROUND: 3
DELTA: /home/felixb/.claude/drain-plans/drain-90a2aa88/slot-0/wt/tasks/plans/.plan-delta-2026-10-15-catalog-engine-retention-r3.diff
REVISED:
## Approach > ### O2 — reachability and session protection
## Phases > ### P1 — catalog installation lifecycle
SETTLED:
# Plan: reclaim superseded catalog engine trees
## Goal
## MANDATE
## MANDATE > ### Superseded catalog engine install directories stay on disk forever once their handle is pruned
## Threat model and non-goals
## Traced premises
## Approach
## Approach > ### O1 — native provenance and publication
## Approach > ### O3 — conservative deletion and retry
## Approach > ### O4 — proof and delivery
## Decisions and trade-offs
## Risks / open questions
## Not part of this task
## Phases

### lens-chess-semantics-r1.txt

NOT APPLICABLE: O1–O4 and the listed files concern catalog engine directory ownership, process protection and filesystem cleanup. The plan does not change in-memory chess trees, positions, move paths or position comparisons.

VERDICT: APPROVED
### lens-chess-semantics-r4.txt

NOT APPLICABLE: The plan’s files and O1–O4 obligations concern catalog-install provenance, filesystem reachability, process-use protection and deletion. They neither mutate nor interpret in-memory chess trees, positions or move paths. Puzzle-tree drift does not invalidate an obligation within this lens.

VERDICT: APPROVED
### lens-correctness-r1.txt

No correctness defects found in the proposed O1–O4 contracts.

Limitation: plan review only. Crash recovery, partial-deletion retries, and platform behavior require implementation evidence and were not executed here (confidence: 100).

VERDICT: APPROVED
### lens-correctness-r2.txt

VERDICT: APPROVED
### lens-correctness-r4.txt

No correctness findings from source drift. O1–O4 remain consistent with the inspected publication, owner-reconciliation and shutdown boundaries.

Limitation: static plan review only. Implementation and runtime behavior remain unverified (confidence: 95).

VERDICT: APPROVED
### lens-engine-protocol-r1.txt

[blocker] /tmp/drain-plan-drain-90a2aa88-slot0/build/plan-r1.body.md:53 — Session protection expires before previous-session child cleanup is proven. Concrete sequence: a game retains the old binary after upgrade, child termination fails, and the application exits. `main.rs:2416` exits unconditionally after cleanup, while `process.rs:3771` explicitly states that kill-on-drop cannot protect process exit. On restart, session protection is empty and saved owners reference the upgrade, so O2 permits collecting the old tree while its child may still need adjacent resources. Require conservative protection across interrupted or unconfirmed shutdown until prior child use is ruled out, with a restart regression covering this sequence. Current-process pending-cleanup coverage does not establish that guarantee. (confidence: 93)

Limitation: read-only plan review. No engine processes or runtime probes were run.

VERDICT: REVISE
### lens-engine-protocol-r2.txt

I1 CLOSED — O2 requires durable session-use markers before executable/resource handoff, cleared only after confirmed successful shutdown. Failed or interrupted shutdown retains protection across restarts, and later sessions cannot clear older markers. O4 requires reopen, failed-persistence and session-isolation regression proof.

VERDICT: APPROVED
### lens-engine-protocol-r4.txt

No in-lens drift findings. Workspace and puzzle changes do not invalidate O2’s engine ownership or shutdown assumptions. I1 remains closed, with no changed premise.

Static review only. No files changed, processes spawned or runtime proof performed.

VERDICT: APPROVED
### lens-error-handling-r1.txt

No error-handling defects found in the proposed O1–O4 contracts.

Limitation: this is plan review. Typed error propagation, diagnostic context and crash-safe retry behavior require implementation and fault-injection proof (confidence: 100).

VERDICT: APPROVED
### lens-error-handling-r2.txt

VERDICT: APPROVED
### lens-error-handling-r4.txt

No drift-induced error-handling defects found. O1–O4 retain explicit refusal, durability uncertainty, partial-removal retry and background-failure semantics. Settled issues remain closed.

Limitation: source review only. Implementation and runtime failure proofs remain pending (confidence: 100).

VERDICT: APPROVED
### lens-ipc-contract-r1.txt

No IPC-contract defects found in plan r1. Existing commands are Specta-registered and match renderer callers. O3 preserves successful owner reconciliation when background cleanup fails.

Limitation: this reviews the proposed contract, not an implementation diff. No files changed or gates run.

VERDICT: APPROVED
### lens-ipc-contract-r2.txt

VERDICT: APPROVED
### lens-ipc-contract-r4.txt

No IPC-contract findings in the source drift. The catalog download and startup-owner contracts remain unchanged and Specta-registered. The database size change agrees across Rust, generated bindings and renderer consumers. No drift invalidates O1–O4.

Read-only source review only. No gates or runtime verification performed, and no files changed.

VERDICT: APPROVED
### lens-minimalism-r1.txt

No mandate-exceeding work or required duplication found.

Limitation: The optional private submodule and helper boundaries remain implementation choices. Their caller counts and smallest-diff alternatives require diff review (confidence: 100).

VERDICT: APPROVED
### lens-minimalism-r2.txt

VERDICT: APPROVED
### lens-minimalism-r4.txt

No drift-induced bloat or duplication findings. Publication, authority, deletion, shutdown and engine-owner consumers remain unchanged. The changed persistence and verification code does not invalidate O1–O4 or justify expanding the mandate.

Added-file counterfactual: no new implementation file is required. The optional private catalog module can be omitted while preserving the same obligations in existing modules.

VERDICT: APPROVED
### lens-persisted-state-r1.txt

NOT APPLICABLE: O1–O4 change native catalog ownership, registry persistence and filesystem cleanup. Renderer storage consumers are read-only, with no changes to storage keys, encodings, atom families, hydration or tab lifecycle.

VERDICT: APPROVED
### lens-persisted-state-r4.txt

No persistence finding invalidates O1–O4. O2’s engine-owner keys, codecs, strict startup collector and save coordinator are unchanged. Workspace drift preserves the tab metadata consumed by `pathOwners.ts` and does not alter engine-owner evidence.

Review was read-only. No runtime proof or broader approval of the puzzle-persistence changes is claimed.

VERDICT: APPROVED
### lens-pgn-index-r1.txt

NOT APPLICABLE: The plan’s files and O1–O4 obligations cover catalog engine installation ownership and cleanup. They introduce no PGN scanning, indexing, encoding, storage or search behavior.

VERDICT: APPROVED
### lens-pgn-index-r4.txt

NOT APPLICABLE: The plan’s files and O1–O4 obligations cover catalog engine provenance, process-use protection and directory reclamation. They do not alter PGN scanning, encoding, offsets or database indexing. Database-related source drift does not invalidate those obligations.

VERDICT: APPROVED
### lens-plan-r1.txt

[blocker] /tmp/drain-plan-drain-90a2aa88-slot0/build/plan-r1.body.md:51 — O2 protects entries targeting the tree or its descendants, but misses an explicit directory resource targeting an ancestor. Directory resources expose the directory and its contents to engines (`src-tauri/src/infra/path_authority/mod.rs:6397`, `:1582`). A saved or running engine using that ancestor can therefore lose resources inside a collected installation. Distinguish directory-resource ownership from bare workspace selection, and prove ancestor-resource retention through startup cleanup. (confidence: 92)

[blocker] /tmp/drain-plan-drain-90a2aa88-slot0/build/plan-r1.body.md:61 — O3 permits partially removed trees, but O1/O2 define no safe same-artifact adoption policy for them. The existing installer reports success whenever the destination directory exists (`src-tauri/src/fs.rs:1383`), while recursive removal can fail after deleting children (`src-tauri/src/infra/fs.rs:5061`). Reinstalling that artifact can adopt an incomplete tree. If its executable survives, registration and configuration probing can succeed (`src/utils/engines.ts:372`) and make the damaged installation live, preventing subsequent cleanup. Require recoverable handling of cleanup-in-progress destinations and a partial-removal → reinstall → restart regression. (confidence: 93)

VERDICT: REVISE
### lens-plan-r2.txt

I1 CLOSED — r2 plan:55 requires durable use markers and clears them only after confirmed shutdown. `src-tauri/src/main.rs:1869` provides the success boundary, while `:2416` confirms why failed shutdown must retain protection.

I2 CLOSED — r2 plan:51 protects ancestor EngineResource directories for retained and session-used resources, matching recursive resource access in `src-tauri/src/infra/path_authority/mod.rs:6391`.

I3 CLOSED — r2 plan:65 durably records cleanup before deletion and refuses both adoption paths at `src-tauri/src/fs.rs:1383` and `:1469`, covering partial removal reported by `src-tauri/src/infra/fs.rs:5061`.

VERDICT: APPROVED
### lens-plan-r3.txt

VERDICT: APPROVED
### lens-plan-r4.txt

No drift-induced plan defects found at NEW-BASE. O1–O4 remain compatible with the traced code and proof routes. No contrary evidence reopens I1–I3.

Limitation: read-only source review establishes no runtime or platform behavior proof (confidence: 100). No files changed.

VERDICT: APPROVED
### lens-platform-semantics-r1.txt

No platform-semantics findings in O1–O4. The proposed identity-bound cleanup, process-session protection and retry contract address the mandate across Linux, macOS and Windows.

Limitation: this is plan review only. Neither `pnpm rust:windows:check` nor the non-Linux Unix source probe was run. Implementation must obtain Windows and macOS runtime evidence from `rust-windows-test` and `rust-macos-test`. The inspected `rust-platform` matrix supplies compilation and lint evidence only.

No files changed.

VERDICT: APPROVED
### lens-platform-semantics-r2.txt

Limitation: this is plan review, not platform proof. Neither `pnpm rust:windows:check` nor the non-Linux Unix source probe was run. O4 correctly requires `rust-windows-test` and `rust-macos-test` for runtime evidence, with `rust-platform` providing compilation/lint evidence. No platform defect identified in the revised obligations.

VERDICT: APPROVED
### lens-platform-semantics-r4.txt

No platform-semantics findings from the source drift. Catalog publication, authority, deletion, process protection and direct owner consumers are unchanged. The changed persistence and verification dependencies do not invalidate O1–O4.

Limitations: no gates or probes ran. `pnpm rust:windows:check` and the non-Linux Unix source probe remain implementation proof. Windows/macOS runtime evidence must come from `rust-windows-test` and `rust-macos-test`. `rust-platform` supplies compilation/lint evidence.

No files changed.

VERDICT: APPROVED
### lens-tauri-security-r1.txt

No in-scope plan defects found. O1–O4 require native provenance before publication, conservative reachability, identity/content-checked deletion and durable retry without claiming adopted trees.

Limitation: this is plan review. Implementation and platform behavior remain unverified. No credential or session flow is introduced.

VERDICT: APPROVED
### lens-tauri-security-r2.txt

VERDICT: APPROVED
### lens-tauri-security-r4.txt

No findings. Source drift does not invalidate O1–O4’s security obligations. Catalog publication, path authority, recursive removal, engine ownership and shutdown sources are unchanged. Changed persistence flows preserve the engine-owner evidence boundary. I1–I3 remain closed.

Limitation: static plan-refresh review only. No implementation, runtime or platform safety proof was performed. No files changed.

VERDICT: APPROVED
### lens-tests-r1.txt

VERDICT: APPROVED
### lens-tests-r2.txt

VERDICT: APPROVED
### lens-tests-r3.txt

VERDICT: APPROVED
### lens-tests-r4.txt

No drift invalidates O1–O4’s proposed regression proofs or test selection. Native lifecycle paths, owner collectors and CI test commands remain unchanged.

Limitation: implementation and fix-revert evidence are still pending. This approves the verification plan, not runtime behavior (confidence: 98).

VERDICT: APPROVED
### plan-r1.md

# Plan: reclaim superseded catalog engine trees

## Goal

Resolve f-20261002-04 by giving native catalog installations durable ownership and conservative startup reclamation. Stop accumulating obsolete installations without interrupting games or deleting user files.

## MANDATE

### Superseded catalog engine install directories stay on disk forever once their handle is pruned

* **ID:** f-20261002-04 · **Status:** open · **Area:** native-fs · **Root:** - · **Entry:** build · **Blocked:** none
* **Where:** `src-tauri/src/infra/path_authority/mod.rs:6594` (startup pruning filters unowned registry entries), `:6623` (commits the pruned registry), `:8096` (the commit body saves registry state and deletes no file or tree); `src/utils/engines.ts` `installCatalogEngine` (each verified artefact installs into its own `<archive>-<full sha256>` directory under the engine workspace, commit `f19e14ac`).
* **Defect:** catalog installs are now version-unique and are never replaced (adoption, `D9`). After an upgrade (Stockfish 18 → 19, later 19 → 20) the old entry's handle becomes unowned and is pruned from the path registry at the next startup, but nothing ever removes the app-owned install directory it pointed at. The same holds for an install whose save was refused, and for an artefact downloaded and then discarded after a cancel intent.
* **Why it matters:** an unbounded retention: every catalog version installed stays on disk (the Stockfish 19 Linux tree alone is about 80 MB extracted plus its NNUE files), invisible in the UI. The async-resource rule requires every registry that holds a resource to have a bounded retention policy.
* **Open question:** which directories are safe to delete and when: only directories under the app-owned engine workspace that no registry entry references after pruning, and never while an engine child (including a running game that keeps its old binary until it ends, plan O3) may still be executing from them. Delete at startup after pruning, or on the next upgrade? Windows refuses to delete a running executable.
* **Measured:** the P2 write leaf of the Stockfish 19 upgrade read the pruning path (lines above) and found no tree deletion; the plan's "Risks / open questions" required this check and a filed finding rather than a reaper in that run.
* **Found by:** Stockfish 19 upgrade build, phase P2, 2026-10-02 (Codex leaf investigation, confirmed by the orchestrator's review of the cited lines' role).
* **Correction (2026-10-02, records lens):** the size claim above was not measured. Measured: the extracted Stockfish 19 Linux release tree (`stockfish/`, including sources, wiki and scripts that ship in the archive) is 101 MB (`du -sh`), from an 81 MB download. The Windows sentence is an expectation from plan `D9` (replacing a tree fails while its binary runs), not a measured deletion attempt.
<!-- ledger-meta {"command":"annotate","effect_lines":1,"effect_sha256":"05628af4227b8ee14232b07fbbec6d86ccfddeffaa682fd0ff666c06ffef25b7","input_sha256":"74277d58130b3b7f54ad99c2ead503168f4844caf629f5e0bf9da736c029116b","kind":"mutation-receipt","operation":"a313756fbed85b5e90d49c0bb99f97f3c2c220f2e2cdffdc02fe88c1ef7536d1","options":{"section":null},"request_id_sha256":null,"results":["f-20261002-04"],"target":"f-20261002-04","v":1} -->

## Threat model and non-goals

Normal installs, upgrades, duplicate engine entries, saved player configurations, canceled/failed saves, process interruption, registry write failures, unavailable roots, ordinary user additions/edits, and filesystem substitution are relevant. Linux, macOS and Windows are supported. Preserve the existing no-follow, identity-bound filesystem boundary and its documented inability to perform inode-conditional unlink on Linux (f-20260830-09). Do not claim safety against a malicious same-user process continuously modifying a tree between validation and unlink. Other independent applications manually executing files from a managed directory are outside the application's ownership protocol. Do not add runtime collection, a timer, a public cleanup command, a new storage engine, or a generic collector framework.

## Traced premises

- `src/utils/engines.ts:355` constructs the full digest directory, invokes download, registers a handle, and probes configuration. A renderer-save failure can therefore occur after publication.
- `src-tauri/src/fs.rs:1351` validates signed metadata, adopts existing directories without replacement, and otherwise publishes extracted staging. `publish_engine_archive_tree` at 1456 serializes publication but records no directory ownership.
- `src-tauri/src/infra/path_authority/mod.rs:6601` registers a verified executable and immediate parent identity, not its enclosing catalog tree. `resolve` at 7782 session-protects successfully used persistent capabilities.
- `src-tauri/src/infra/path_authority/mod.rs:7306` performs authority-only startup reclamation after typed owner evidence. `src/state/pathOwners.ts:270` supplies original storage evidence, and chains attachment reconciliation after that command.
- `src-tauri/src/main.rs:654` executes startup reconciliation through the accepted blocking-operation gateway. This is the existing integration point for collection after durable reconciliation, under the same authority serialization as resolution.
- `src-tauri/src/infra/path_authority/mod.rs:4129` stores bounded atomic JSON lifecycle state. Its existing image cleanup applies to copied UUID image files, not engine archives.
- `src-tauri/src/infra/fs.rs:5031` exposes identity-checked descriptor-relative recursive deletion with partial-removal and durability outcomes. Reuse its Unix and Windows implementations rather than introducing pathname `remove_dir_all`.
- `src-tauri/src/engine/process.rs:778` retains executable and resource leases until confirmed reaping. A pathname working directory and adjacent files can still matter, so an open executable alone is insufficient protection.
- `tasks/handoffs/2026-10-01-stockfish-19-upgrade-review.md`, D9, requires adopting existing artifact directories and never replacing a running tree. Its retention gap is explicitly handed to this finding.

Pickup revalidation: the original defect remains. Current pruning has no archive-tree deletion, and the existing authority sweep test explicitly keeps files. Retain Entry build because persistent provenance, publication failure ordering and startup reachability need a shared contract. Only f-20261002-04 is planned. Co-located f-20260918-02 and f-20261001-05 are excluded by the planner contract.

## Approach

### O1 — native provenance and publication

Maintain a bounded additive catalog-install collection in the existing path registry, separate from executable authority. A record identifies the exact engine root and its native binding, one direct-child destination, the staged/published directory identity, and the managed content inventory. Validate the shape on load and account for records/inventory in the existing registry byte and admission limits. Older registries with no collection load unchanged. Records are not renderer capabilities and cannot broaden path authority.

Only native publication of a newly extracted, verified archive can mint ownership. Capture the staged tree identity and a bounded inventory of its relative entries, kinds, identities and file content digests before publishing. A durable record must exist before the rename makes that exact tree reachable. Failed admission or an unconfirmed durable prepublication write aborts publication. A crash before rename leaves a missing-target record that startup may complete, while a crash after rename retains identity evidence without depending on executable registration or renderer save. Existing-directory adoption keeps D9 and may reuse existing matching provenance, but must never create ownership from the directory name, signature metadata, executable registration or mere containment.

Serialize the existence check, ownership reservation and publication so concurrent identical installs neither replace a registered tree nor overwrite ownership with a losing staging identity. Preserve operation commit-gate cancellation semantics and report committed publication uncertainty truthfully through the existing download error contract. Reuse registry serialization/admission and atomic commit code, do not duplicate it. Any helper shared with existing publication has one canonical implementation. No new IPC parameter or generated binding is expected.

### O2 — reachability and session protection

Collect only at a trusted startup reconciliation after the owner-pruning commit is durable. Engines must be a completed trusted owner family. An untrusted, failed or partial owner snapshot cannot establish absence. A recorded tree remains live if any retained authority entry targets the tree or a descendant, including executable, resource, image and other direct consumers. A selected workspace root that is only the tree's ancestor is not itself an owner of every installation.

Successfully used, registered, adopted or installed trees in the current process stay protected until the next process start. Extend the existing session-protection mechanism to catalog records so the native archive destination/adoption path protects a tree before asynchronous work, and every successful authority resolution inside it protects it before returning an executable/resource. This includes in-flight config probes, analysis/report actors, games that keep an old binary after upgrade, and unresolved child cleanup. Protection never depends on Windows refusing a delete or Unix keeping executable descriptors alive. Keep protection and its admission bounded. Under the authority lock, eligibility evaluation and removal exclude a concurrent resolve/adoption race. Do not add tree leases to each actor or terminate games to free disk.

Preserve reachability evidence until cleanup eligibility is derived. If a root becomes inactive, unavailable or replaced, use the recorded exact binding to re-prove it or retain the record for retry. Do not follow its old pathname into a substitute or forget the cleanup locator when root/executable entries are pruned.

### O3 — conservative deletion and retry

Delete only a recorded, unreachable, non-session-protected tree whose root, directory and complete managed inventory still match. Inventory comparison includes additions, missing/replaced entries and content edits, with bounded traversal, no-follow checks and the existing mount/depth refusals. A modified tree is preserved as user state and relinquished from automatic reclamation, rather than repeatedly treating user changes as an operational failure. Unrecorded legacy and adopted trees are likewise preserved. There is no safe retrospective ownership inference from current data.

Use the existing descriptor-relative recursive removal primitive through a sealed authority-owned directory boundary. Keep complete or partially removed tree records through retryable I/O and registry failures. Partial deletion can remove managed entries, so retries accept already-absent entries attributable to the prior cleanup while still refusing new/replaced/edited contents. A missing whole tree or substituted top-level identity completes the obsolete record without deleting its substitute. A committed parent-sync failure records durability uncertainty without reporting that the tree still exists. Cleanup completion is persisted using the existing registry durability semantics. A crash after deletion but before registry update is idempotent on restart.

Automatic startup cleanup errors are logged natively with their cause and retain retry state, without failing app startup or blocking unrelated owner reconciliation. Do not return success from the helper if an attempted cleanup failed. The caller deliberately handles background maintenance failure separately from the already committed owner reconciliation. Run blocking filesystem/hash work only in the blocking gateway and never recursively acquire that gateway. Do not add notifications or change user-facing copy.

### O4 — proof and delivery

Use production publication and reconciliation paths with disposable fixtures, deterministic synchronization and existing fault injectors. Establish all of these cases:

- Two digest versions and multiple upgrades leave only live managed trees after a later trusted restart. Same-artifact adoption never replaces the existing tree or marks an unrecorded user tree owned.
- Duplicate engines, both saved player owners, explicit resources into an older tree, untrusted/corrupt owner evidence, session-used old executables and pending cleanup all prevent deletion. A running fake UCI game continues after an upgrade and cleanup attempt.
- Published-but-unregistered, save-refused and committed-cancel/discard installs are collected on the next eligible startup. Publication faults at prewrite, rename and postcommit sync boundaries reload truthfully, with no unrecorded published tree.
- User additions, content edits, wrong roots, symlinks/reparse points, tree substitution, mount/depth refusal, missing entries, partial removal, deletion failure and cleanup-state persistence failure neither delete foreign files nor lose retry state.
- Legacy registry load, malformed/oversized ownership records, bounded admission, registry-save uncertainty, reopen and retry are exercised. Repeated successful upgrade/restart cycles release ownership capacity rather than growing it forever.

New regression tests must fail with only the source fix reverted and pass after restoration. Do not weaken coverage or add a source-text verification tool. Linux proves runtime behavior locally. `pnpm rust:windows:check` proves Windows compilation/linting, never Windows runtime. Required Test jobs `rust-windows-test`, `rust-macos-test` and `rust-platform` supply non-Linux evidence before release completion. Use the existing non-Linux Unix compile probe on changed platform-specific source if needed, restore exact bytes, and report its limits.

## Decisions and trade-offs

Decided autonomously for adopter recording, not yet written to the ledger:

- D1: When to collect? Choose a later trusted startup with session retention. Reject immediate upgrade/shutdown collection and a new actor tree-lease registry. Existing d-20260906-09/10 already require durable ownership and conservative session retention. Cost: disk is reclaimed at a later start. Reversal: runtime collection requires a reviewed lifetime protocol proving all old-game and resource consumers.
- D2: What proves ownership? Choose native prepublication provenance plus a managed-content inventory. Reject directory-name guessing, sweeping every workspace child and promoting existing adopted trees. Existing roots can be user selected. Cost: validation reads managed content and legacy leftovers remain. Reversal: historical trees can become collectible only with independently verified provenance, not a path heuristic.
- D3: Where does lifecycle state live? Choose an additive bounded collection in the existing registry. Reject a second JSON journal, storage engine, timer or public cleanup command. It removes the observed unbounded native install retention and reuses current durability/admission. Removal path: remove this collection and its startup/publication hooks together if catalog installs cease, preserving user trees.
- D4: How to treat cleanup errors? Choose native background diagnostics and persisted retry without failing startup, preserving d-20261004-22's background record policy. Reject claiming a failed deletion succeeded or adding new UI notifications. Reversal: a demonstrated user recovery need can justify separately reviewed UI surfacing.

Preserve d-20260906-08 descriptor identity registration, d-20260906-09 authority-only semantics for ordinary grants, d-20260906-10/11 prepare/save/reconcile and conservative owner evidence, d-20260918-02 canonical-spelling exemptions, d-20261004-34 the single Windows NT-open primitive, and D9 in the Stockfish handoff. The surfaced decisions about engine-option normalization, PGN saving, download-destination false results, and the old A/B path-hardening slice do not decide catalog-tree ownership and are not reopened.

## Risks / open questions

No unresolved product question. Legacy trees cannot be safely reclaimed automatically from their name or executable path, so this is an explicit migration limit. No manual action is required from Felix. Disk retention is bounded for managed untouched trees by live/session owners, the next eligible startup and registry admission, not a fixed byte quota. Persistent I/O failures or modified trees prevent guaranteed reclamation. Filesystems without advisory instance locking retain the existing documented multi-process limit. Deliberate cross-profile/manual sharing of managed installation trees requires separate coordination and is outside this initial collector's ownership protocol.

## Not part of this task

No joiner implementation during planning. No recovery of unrelated copied engine-image orphans (f-20261004-12/13), first-run workspace creation (f-20261002-05), real signed-catalog installation harness (f-20261002-08), parent-path hardening (f-20261001-15 or f-20260920-01), new preferences, catalog revisions, updater changes or platform syscall redesign. Existing out-of-scope findings remain open.

## Phases

### P1 — catalog installation lifecycle

One cohesive sequential implementation phase, covering O1–O4 together so provenance and collection cannot ship disconnected. Files: `src-tauri/src/fs.rs`, `src-tauri/src/infra/path_authority/mod.rs`, a private catalog-install submodule there only if it meaningfully owns the domain code, `src-tauri/src/infra/path_authority/resolved.rs`, `src-tauri/src/infra/fs.rs` only for the smallest sealed access to existing removal, `src-tauri/src/main.rs`, and focused tests in those modules. Read-only consumers: `src/utils/engines.ts`, `src/state/pathOwners.ts`, `src/state/engineOwnerStorage.ts`, `src-tauri/src/engine/process.rs`. Native persistent-state, deletion, concurrency and internal API exposure are sensitive. Use selected executor `write --role sensitive`, resolved model/effort from the registry at execution. No parallel writers.

Exact phase proof: `cargo test --manifest-path src-tauri/Cargo.toml --locked catalog_install -- --nocapture`, followed by `cargo test --manifest-path src-tauri/Cargo.toml --locked infra::path_authority::tests -- --nocapture` and `cargo test --manifest-path src-tauri/Cargo.toml --locked fs::tests -- --nocapture`. Name new behavior tests with `catalog_install` so the first command includes production integration tests, and prove fix-revert red/green on targeted regressions. Run `pnpm checks:pre-review` after this phase and every repair batch before cumulative diff review. Include all changed importers and the existing surviving-game tests in proof selection if their helpers change.

Release after implementation: cumulative diff review with correctness/root-cause and all triggered lenses, including mandatory Tauri security, platform, engine protocol, IPC, errors and tests. Run `pnpm build` and `pnpm verify:app` under the project verification contract because native lifecycle changes, retaining screenshots and reporting exactly what the existing driver reaches. No new visible UI is planned. Then commit known decision/review records and run `pnpm gates:push -- --rust` on clean reviewed HEAD. An unexpected IPC/generated-contract change requires both frontend and bindings flags and regenerated bindings. Required remote CI and install follow the project push skill. The planner stops before implementation Preflight, preserving BASE and clean tracked/untracked status.

## Reviews

Pending first review. Plan authorship and arbitration share one context. Detection uses separate Codex launcher leaves on the same model family as the code, without family separation.

### plan-r2.md

# Plan: reclaim superseded catalog engine trees

## Goal

Resolve f-20261002-04 by giving native catalog installations durable ownership and conservative startup reclamation. Stop accumulating obsolete installations without interrupting games or deleting user files.

## MANDATE

### Superseded catalog engine install directories stay on disk forever once their handle is pruned

* **ID:** f-20261002-04 · **Status:** open · **Area:** native-fs · **Root:** - · **Entry:** build · **Blocked:** none
* **Where:** `src-tauri/src/infra/path_authority/mod.rs:6594` (startup pruning filters unowned registry entries), `:6623` (commits the pruned registry), `:8096` (the commit body saves registry state and deletes no file or tree); `src/utils/engines.ts` `installCatalogEngine` (each verified artefact installs into its own `<archive>-<full sha256>` directory under the engine workspace, commit `f19e14ac`).
* **Defect:** catalog installs are now version-unique and are never replaced (adoption, `D9`). After an upgrade (Stockfish 18 → 19, later 19 → 20) the old entry's handle becomes unowned and is pruned from the path registry at the next startup, but nothing ever removes the app-owned install directory it pointed at. The same holds for an install whose save was refused, and for an artefact downloaded and then discarded after a cancel intent.
* **Why it matters:** an unbounded retention: every catalog version installed stays on disk (the Stockfish 19 Linux tree alone is about 80 MB extracted plus its NNUE files), invisible in the UI. The async-resource rule requires every registry that holds a resource to have a bounded retention policy.
* **Open question:** which directories are safe to delete and when: only directories under the app-owned engine workspace that no registry entry references after pruning, and never while an engine child (including a running game that keeps its old binary until it ends, plan O3) may still be executing from them. Delete at startup after pruning, or on the next upgrade? Windows refuses to delete a running executable.
* **Measured:** the P2 write leaf of the Stockfish 19 upgrade read the pruning path (lines above) and found no tree deletion; the plan's "Risks / open questions" required this check and a filed finding rather than a reaper in that run.
* **Found by:** Stockfish 19 upgrade build, phase P2, 2026-10-02 (Codex leaf investigation, confirmed by the orchestrator's review of the cited lines' role).
* **Correction (2026-10-02, records lens):** the size claim above was not measured. Measured: the extracted Stockfish 19 Linux release tree (`stockfish/`, including sources, wiki and scripts that ship in the archive) is 101 MB (`du -sh`), from an 81 MB download. The Windows sentence is an expectation from plan `D9` (replacing a tree fails while its binary runs), not a measured deletion attempt.
<!-- ledger-meta {"command":"annotate","effect_lines":1,"effect_sha256":"05628af4227b8ee14232b07fbbec6d86ccfddeffaa682fd0ff666c06ffef25b7","input_sha256":"74277d58130b3b7f54ad99c2ead503168f4844caf629f5e0bf9da736c029116b","kind":"mutation-receipt","operation":"a313756fbed85b5e90d49c0bb99f97f3c2c220f2e2cdffdc02fe88c1ef7536d1","options":{"section":null},"request_id_sha256":null,"results":["f-20261002-04"],"target":"f-20261002-04","v":1} -->

## Threat model and non-goals

Normal installs, upgrades, duplicate engine entries, saved player configurations, canceled/failed saves, process interruption, registry write failures, unavailable roots, ordinary user additions/edits, and filesystem substitution are relevant. Linux, macOS and Windows are supported. Preserve the existing no-follow, identity-bound filesystem boundary and its documented inability to perform inode-conditional unlink on Linux (f-20260830-09). Do not claim safety against a malicious same-user process continuously modifying a tree between validation and unlink. Other independent applications manually executing files from a managed directory are outside the application's ownership protocol. Do not add runtime collection, a timer, a public cleanup command, a new storage engine, or a generic collector framework.

## Traced premises

- `src/utils/engines.ts:355` constructs the full digest directory, invokes download, registers a handle, and probes configuration. A renderer-save failure can therefore occur after publication.
- `src-tauri/src/fs.rs:1351` validates signed metadata, adopts existing directories without replacement, and otherwise publishes extracted staging. `publish_engine_archive_tree` at 1456 serializes publication but records no directory ownership.
- `src-tauri/src/infra/path_authority/mod.rs:6601` registers a verified executable and immediate parent identity, not its enclosing catalog tree. `resolve` at 7782 session-protects successfully used persistent capabilities.
- `src-tauri/src/infra/path_authority/mod.rs:7306` performs authority-only startup reclamation after typed owner evidence. `src/state/pathOwners.ts:270` supplies original storage evidence, and chains attachment reconciliation after that command.
- `src-tauri/src/main.rs:654` executes startup reconciliation through the accepted blocking-operation gateway. This is the existing integration point for collection after durable reconciliation, under the same authority serialization as resolution.
- `src-tauri/src/infra/path_authority/mod.rs:4129` stores bounded atomic JSON lifecycle state. Its existing image cleanup applies to copied UUID image files, not engine archives.
- `src-tauri/src/infra/fs.rs:5031` exposes identity-checked descriptor-relative recursive deletion with partial-removal and durability outcomes. Reuse its Unix and Windows implementations rather than introducing pathname `remove_dir_all`.
- `src-tauri/src/engine/process.rs:778` retains executable and resource leases until confirmed reaping. A pathname working directory and adjacent files can still matter, so an open executable alone is insufficient protection.
- `tasks/handoffs/2026-10-01-stockfish-19-upgrade-review.md`, D9, requires adopting existing artifact directories and never replacing a running tree. Its retention gap is explicitly handed to this finding.

Pickup revalidation: the original defect remains. Current pruning has no archive-tree deletion, and the existing authority sweep test explicitly keeps files. Retain Entry build because persistent provenance, publication failure ordering and startup reachability need a shared contract. Only f-20261002-04 is planned. Co-located f-20260918-02 and f-20261001-05 are excluded by the planner contract.

## Approach

### O1 — native provenance and publication

Maintain a bounded additive catalog-install collection in the existing path registry, separate from executable authority. A record identifies the exact engine root and its native binding, one direct-child destination, the staged/published directory identity, and the managed content inventory. Validate the shape on load and account for records/inventory in the existing registry byte and admission limits. Older registries with no collection load unchanged. Records are not renderer capabilities and cannot broaden path authority.

Only native publication of a newly extracted, verified archive can mint ownership. Capture the staged tree identity and a bounded inventory of its relative entries, kinds, identities and file content digests before publishing. A durable record must exist before the rename makes that exact tree reachable. Failed admission or an unconfirmed durable prepublication write aborts publication. A crash before rename leaves a missing-target record that startup may complete, while a crash after rename retains identity evidence without depending on executable registration or renderer save. Existing-directory adoption keeps D9 and may reuse existing matching provenance, but must never create ownership from the directory name, signature metadata, executable registration or mere containment.

Serialize the existence check, ownership reservation and publication so concurrent identical installs neither replace a registered tree nor overwrite ownership with a losing staging identity. Preserve operation commit-gate cancellation semantics and report committed publication uncertainty truthfully through the existing download error contract. Reuse registry serialization/admission and atomic commit code, do not duplicate it. Any helper shared with existing publication has one canonical implementation. No new IPC parameter or generated binding is expected.

### O2 — reachability and session protection

Collect only at a trusted startup reconciliation after the owner-pruning commit is durable. Engines must be a completed trusted owner family. An untrusted, failed or partial owner snapshot cannot establish absence. A recorded tree remains live if any retained authority entry targets the tree or a descendant, including executable, resource, image and other direct consumers. An explicit EngineResource directory also owns its recursive contents, so a directory resource targeting an ancestor of a catalog tree protects that tree. This differs from a selected workspace root that is only the tree's ancestor, which is not itself an owner of every installation. Use the same relation for retained and session-used resources.

Successfully used, registered, adopted or installed trees in the current process stay protected until the next process start. Extend the existing session-protection mechanism to catalog records so the native archive destination/adoption path protects a tree before asynchronous work, and every successful authority resolution inside it protects it before returning an executable/resource. This includes in-flight config probes, analysis/report actors, games that keep an old binary after upgrade, and unresolved child cleanup. Protection never depends on Windows refusing a delete or Unix keeping executable descriptors alive. Keep protection and its admission bounded. Under the authority lock, eligibility evaluation and removal exclude a concurrent resolve/adoption race. Do not add tree leases to each actor or terminate games to free disk.

Session expiry alone is not evidence that children exited. Before returning a managed executable or resource that can be passed to a child, durably mark every affected install record with this process session's use. Failure or uncertain durability refuses the handoff. The same rule covers ancestor-directory resources and resources resolved before their tree provenance is published. On orderly shutdown clear only this session's markers, and only after the existing shutdown result proves operation admission sealed, native work drained, and all engines/games reaped. The clear itself must be durable. Do not place it in the concurrent attachments tail, which can finish before engine teardown. A timeout, panic, failed reap, failed clear, or crash leaves the marker. A later session never clears another session's marker merely because it started or exited cleanly. Trees with unresolved prior use remain ineligible, with native diagnostics and bounded retained records, like existing unresolved child owners. No PID guessing, process-name scan or TTL can establish that use has ended.

Preserve reachability evidence until cleanup eligibility is derived. If a root becomes inactive, unavailable or replaced, use the recorded exact binding to re-prove it or retain the record for retry. Do not follow its old pathname into a substitute or forget the cleanup locator when root/executable entries are pruned.

### O3 — conservative deletion and retry

Delete only a recorded, unreachable, non-session-protected tree whose root, directory and complete managed inventory still match. Inventory comparison includes additions, missing/replaced entries and content edits, with bounded traversal, no-follow checks and the existing mount/depth refusals. A modified tree is preserved as user state and relinquished from automatic reclamation, rather than repeatedly treating user changes as an operational failure. Unrecorded legacy and adopted trees are likewise preserved. There is no safe retrospective ownership inference from current data.

Use the existing descriptor-relative recursive removal primitive through a sealed authority-owned directory boundary. Keep complete or partially removed tree records through retryable I/O and registry failures. Partial deletion can remove managed entries, so retries accept already-absent entries attributable to the prior cleanup while still refusing new/replaced/edited contents. A missing whole tree or substituted top-level identity completes the obsolete record without deleting its substitute. A committed parent-sync failure records durability uncertainty without reporting that the tree still exists. Cleanup completion is persisted using the existing registry durability semantics. A crash after deletion but before registry update is idempotent on restart.

Persist a cleanup-in-progress state durably before the first destructive step, retaining the original inventory. Only this state permits absent managed entries on retry. Both early existing-target adoption and the serialized publication adoption path must refuse a recorded cleanup-in-progress destination with a typed Conflict, before returning download success or registering a handle. Keep that state across failures and restarts until cleanup removes the whole old tree and durably completes its record. A later fresh install may then publish normally. Do not cancel the cleanup state or restore ownership merely because a new install attempt asks to adopt the damaged directory. No runtime collector is introduced.

Automatic startup cleanup errors are logged natively with their cause and retain retry state, without failing app startup or blocking unrelated owner reconciliation. Do not return success from the helper if an attempted cleanup failed. The caller deliberately handles background maintenance failure separately from the already committed owner reconciliation. Run blocking filesystem/hash work only in the blocking gateway and never recursively acquire that gateway. Do not add notifications or change user-facing copy.

### O4 — proof and delivery

Use production publication and reconciliation paths with disposable fixtures, deterministic synchronization and existing fault injectors. Establish all of these cases:

- Two digest versions and multiple upgrades leave only live managed trees after a later trusted restart. Same-artifact adoption never replaces the existing tree or marks an unrecorded user tree owned.
- Duplicate engines, both saved player owners, explicit resources into an older tree, ancestor-directory resources, untrusted/corrupt owner evidence, session-used old executables and pending cleanup all prevent deletion. A running fake UCI game continues after an upgrade and cleanup attempt. An unconfirmed shutdown followed by reopen and trusted reconciliation keeps the old tree, including adjacent resources, until prior use is actually proven ended. A successful shutdown durably clears only its own markers, making unused managed trees eligible on the next start. Faults in marker persistence refuse handoff, and later clean sessions cannot erase older unresolved markers.
- Published-but-unregistered, save-refused and committed-cancel/discard installs are collected on the next eligible startup. Publication faults at prewrite, rename and postcommit sync boundaries reload truthfully, with no unrecorded published tree.
- User additions, content edits, wrong roots, symlinks/reparse points, tree substitution, mount/depth refusal, missing entries, partial removal, deletion failure and cleanup-state persistence failure neither delete foreign files nor lose retry state. Partial-removal → same-artifact reinstall refuses adoption, without a success report or new executable registration. After restart completes cleanup, a fresh reinstall succeeds and remains usable on the following restart.
- Legacy registry load, malformed/oversized ownership records, bounded admission, registry-save uncertainty, reopen and retry are exercised. Repeated successful upgrade/restart cycles release ownership capacity rather than growing it forever.

New regression tests must fail with only the source fix reverted and pass after restoration. Do not weaken coverage or add a source-text verification tool. Linux proves runtime behavior locally. `pnpm rust:windows:check` proves Windows compilation/linting, never Windows runtime. Required Test jobs `rust-windows-test` and `rust-macos-test` supply non-Linux runtime evidence, while `rust-platform` supplies compilation/lint evidence, before release completion. Use the existing non-Linux Unix compile probe on changed platform-specific source if needed, restore exact bytes, and report its limits.

## Decisions and trade-offs

Decided autonomously for adopter recording, not yet written to the ledger:

- D1: When to collect? Choose a later trusted startup with session retention. Reject immediate upgrade/shutdown collection and a new actor tree-lease registry. Existing d-20260906-09/10 already require durable ownership and conservative session retention. Cost: disk is reclaimed at a later start. Reversal: runtime collection requires a reviewed lifetime protocol proving all old-game and resource consumers.
- D2: What proves ownership? Choose native prepublication provenance plus a managed-content inventory. Reject directory-name guessing, sweeping every workspace child and promoting existing adopted trees. Existing roots can be user selected. Cost: validation reads managed content and legacy leftovers remain. Reversal: historical trees can become collectible only with independently verified provenance, not a path heuristic.
- D3: Where does lifecycle state live? Choose an additive bounded collection in the existing registry. Reject a second JSON journal, storage engine, timer or public cleanup command. It removes the observed unbounded native install retention and reuses current durability/admission. Removal path: remove this collection and its startup/publication hooks together if catalog installs cease, preserving user trees.
- D4: How to treat cleanup errors? Choose native background diagnostics and persisted retry without failing startup, preserving d-20261004-22's background record policy. Reject claiming a failed deletion succeeded or adding new UI notifications. Reversal: a demonstrated user recovery need can justify separately reviewed UI surfacing.
- D5: What proves a previous process finished using a tree? Choose durable per-session use markers cleared only by that session after confirmed successful shutdown. Reject restart as proof of child death and portable PID/name guesses. The MANDATE says never delete while an engine child may still execute, and the frozen threat model includes process interruption. Cost: a crash or unconfirmed shutdown conservatively retains affected trees indefinitely, within admission limits. Reversal: an independently proven cross-process lifetime mechanism can safely release these markers. Do not require Felix to inspect processes or clear records manually.
- D6: Can an install adopt a partially deleted tree? Choose typed refusal until a later eligible startup durably completes cleanup. Reject the existing existence-only adoption for a known cleanup-in-progress tree. The MANDATE's safe deletion and existing D9 require preserving complete live trees, not reviving damaged ones. Cost: reinstall can require restarting after a removal failure. Reversal: a reviewed recovery path may finish the already-started cleanup before fresh publication, without adopting or replacing live files.

Preserve d-20260906-08 descriptor identity registration, d-20260906-09 authority-only semantics for ordinary grants, d-20260906-10/11 prepare/save/reconcile and conservative owner evidence, d-20260918-02 canonical-spelling exemptions, d-20261004-34 the single Windows NT-open primitive, and D9 in the Stockfish handoff. The surfaced decisions about engine-option normalization, PGN saving, download-destination false results, and the old A/B path-hardening slice do not decide catalog-tree ownership and are not reopened.

## Risks / open questions

No unresolved product question. Legacy trees cannot be safely reclaimed automatically from their name or executable path, so this is an explicit migration limit. No manual action is required from Felix. Disk retention is bounded for managed untouched trees by live/session owners, the next eligible startup and registry admission, not a fixed byte quota. Persistent I/O failures, unresolved use from an interrupted shutdown, or modified trees prevent guaranteed reclamation. Filesystems without advisory instance locking retain the existing documented multi-process limit. Deliberate cross-profile/manual sharing of managed installation trees requires separate coordination and is outside this initial collector's ownership protocol.

## Not part of this task

No joiner implementation during planning. No recovery of unrelated copied engine-image orphans (f-20261004-12/13), first-run workspace creation (f-20261002-05), real signed-catalog installation harness (f-20261002-08), parent-path hardening (f-20261001-15 or f-20260920-01), new preferences, catalog revisions, updater changes or platform syscall redesign. Existing out-of-scope findings remain open.

## Phases

### P1 — catalog installation lifecycle

One cohesive sequential implementation phase, covering O1–O4 together so provenance and collection cannot ship disconnected. Files: `src-tauri/src/fs.rs`, `src-tauri/src/infra/path_authority/mod.rs`, a private catalog-install submodule there only if it meaningfully owns the domain code, `src-tauri/src/infra/path_authority/resolved.rs`, `src-tauri/src/infra/fs.rs` only for the smallest sealed access to existing removal, `src-tauri/src/main.rs`, and focused tests in those modules. Read-only consumers: `src/utils/engines.ts`, `src/state/pathOwners.ts`, `src/state/engineOwnerStorage.ts`, `src-tauri/src/engine/process.rs`. Native persistent-state, deletion, concurrency and internal API exposure are sensitive. Use selected executor `write --role sensitive`, resolved model/effort from the registry at execution. No parallel writers.

Exact phase proof: `cargo test --manifest-path src-tauri/Cargo.toml --locked catalog_install -- --nocapture`, followed by `cargo test --manifest-path src-tauri/Cargo.toml --locked infra::path_authority::tests -- --nocapture` and `cargo test --manifest-path src-tauri/Cargo.toml --locked fs::tests -- --nocapture`. Name new behavior tests with `catalog_install` so the first command includes production integration tests, and prove fix-revert red/green on targeted regressions. Run `pnpm checks:pre-review` after this phase and every repair batch before cumulative diff review. Include all changed importers and the existing surviving-game tests in proof selection if their helpers change.

Release after implementation: cumulative diff review with correctness/root-cause and all triggered lenses, including mandatory Tauri security, platform, engine protocol, IPC, errors and tests. Run `pnpm build` and `pnpm verify:app` under the project verification contract because native lifecycle changes, retaining screenshots and reporting exactly what the existing driver reaches. No new visible UI is planned. Then commit known decision/review records and run `pnpm gates:push -- --rust` on clean reviewed HEAD. An unexpected IPC/generated-contract change requires both frontend and bindings flags and regenerated bindings. Required remote CI and install follow the project push skill. The planner stops before implementation Preflight, preserving BASE and clean tracked/untracked status.

## Reviews

Plan authorship and arbitration share one context. Detection uses separate Codex launcher leaves on the same model family as the code, without family separation.

### Round 1

Raw verdicts: chess-semantics APPROVED (NOT APPLICABLE), correctness APPROVED, engine-protocol REVISE, error-handling APPROVED, ipc-contract APPROVED, minimalism APPROVED, persisted-state APPROVED (NOT APPLICABLE), pgn-index APPROVED (NOT APPLICABLE), plan REVISE, platform-semantics APPROVED, tauri-security APPROVED, tests APPROVED. No other prefixed findings. Platform reviewer limitation corrected the description of rust-platform from runtime to compile/lint evidence without changing the proof requirement.

- I1, engine-protocol r1 finding 1, blocker confidence 93: restart can expire protection while a prior child survives failed cleanup. Fix. Evidence: main.rs exit path at 2416 unconditionally exits, process.rs at 3771 says kill-on-drop cannot help, and shutdown_backend_with_attachments at 1809 returns a proof-bearing bool currently discarded. MANDATE no deletion while a child may execute. O2 adds durable session-use markers and successful-shutdown-only clearing, O4 adds interrupted/reopen and marker-write proof. Authority: MANDATE child-lifetime clause and frozen process-interruption threat. Closure pending r2. No dependencies.
- I2, plan r1 finding 1, blocker confidence 92: an ancestor EngineResource directory can own contents inside a catalog install. Fix. Evidence: engine_resource at mod.rs 6397 hands directory contents to an engine. O2 distinguishes explicit recursive resource ownership from workspace selection, O4 adds retention proof. MANDATE safe eligibility. Closure pending r2. No dependencies.
- I3, plan r1 finding 2, blocker confidence 93: existence-only adoption can revive a partly deleted tree. Fix. Evidence: fs.rs 1383 returns success on existence and infra/fs.rs 5061 can fail after deleting children. O3 adds durable cleanup-in-progress state before deletion and typed adoption refusal until complete, O4 adds removal/reinstall/restart proof. MANDATE safe removal while preserving usable installs, D9. Closure pending r2. Depends on O1 ownership serialization, no issue dependency.

Round 1 adopted 3 findings, 3 unique IDs opened, 0 closed, no Skip or Defer, no carried issues. Active wall and non-overlapping waits are unknown. Raw reports, prompts and immutable snapshot are retained under the supplied RUN_TMP for evidence mirroring.

### plan-r3.md

# Plan: reclaim superseded catalog engine trees

## Goal

Resolve f-20261002-04 by giving native catalog installations durable ownership and conservative startup reclamation. Stop accumulating obsolete installations without interrupting games or deleting user files.

## MANDATE

### Superseded catalog engine install directories stay on disk forever once their handle is pruned

* **ID:** f-20261002-04 · **Status:** open · **Area:** native-fs · **Root:** - · **Entry:** build · **Blocked:** none
* **Where:** `src-tauri/src/infra/path_authority/mod.rs:6594` (startup pruning filters unowned registry entries), `:6623` (commits the pruned registry), `:8096` (the commit body saves registry state and deletes no file or tree); `src/utils/engines.ts` `installCatalogEngine` (each verified artefact installs into its own `<archive>-<full sha256>` directory under the engine workspace, commit `f19e14ac`).
* **Defect:** catalog installs are now version-unique and are never replaced (adoption, `D9`). After an upgrade (Stockfish 18 → 19, later 19 → 20) the old entry's handle becomes unowned and is pruned from the path registry at the next startup, but nothing ever removes the app-owned install directory it pointed at. The same holds for an install whose save was refused, and for an artefact downloaded and then discarded after a cancel intent.
* **Why it matters:** an unbounded retention: every catalog version installed stays on disk (the Stockfish 19 Linux tree alone is about 80 MB extracted plus its NNUE files), invisible in the UI. The async-resource rule requires every registry that holds a resource to have a bounded retention policy.
* **Open question:** which directories are safe to delete and when: only directories under the app-owned engine workspace that no registry entry references after pruning, and never while an engine child (including a running game that keeps its old binary until it ends, plan O3) may still be executing from them. Delete at startup after pruning, or on the next upgrade? Windows refuses to delete a running executable.
* **Measured:** the P2 write leaf of the Stockfish 19 upgrade read the pruning path (lines above) and found no tree deletion; the plan's "Risks / open questions" required this check and a filed finding rather than a reaper in that run.
* **Found by:** Stockfish 19 upgrade build, phase P2, 2026-10-02 (Codex leaf investigation, confirmed by the orchestrator's review of the cited lines' role).
* **Correction (2026-10-02, records lens):** the size claim above was not measured. Measured: the extracted Stockfish 19 Linux release tree (`stockfish/`, including sources, wiki and scripts that ship in the archive) is 101 MB (`du -sh`), from an 81 MB download. The Windows sentence is an expectation from plan `D9` (replacing a tree fails while its binary runs), not a measured deletion attempt.
<!-- ledger-meta {"command":"annotate","effect_lines":1,"effect_sha256":"05628af4227b8ee14232b07fbbec6d86ccfddeffaa682fd0ff666c06ffef25b7","input_sha256":"74277d58130b3b7f54ad99c2ead503168f4844caf629f5e0bf9da736c029116b","kind":"mutation-receipt","operation":"a313756fbed85b5e90d49c0bb99f97f3c2c220f2e2cdffdc02fe88c1ef7536d1","options":{"section":null},"request_id_sha256":null,"results":["f-20261002-04"],"target":"f-20261002-04","v":1} -->

## Threat model and non-goals

Normal installs, upgrades, duplicate engine entries, saved player configurations, canceled/failed saves, process interruption, registry write failures, unavailable roots, ordinary user additions/edits, and filesystem substitution are relevant. Linux, macOS and Windows are supported. Preserve the existing no-follow, identity-bound filesystem boundary and its documented inability to perform inode-conditional unlink on Linux (f-20260830-09). Do not claim safety against a malicious same-user process continuously modifying a tree between validation and unlink. Other independent applications manually executing files from a managed directory are outside the application's ownership protocol. Do not add runtime collection, a timer, a public cleanup command, a new storage engine, or a generic collector framework.

## Traced premises

- `src/utils/engines.ts:355` constructs the full digest directory, invokes download, registers a handle, and probes configuration. A renderer-save failure can therefore occur after publication.
- `src-tauri/src/fs.rs:1351` validates signed metadata, adopts existing directories without replacement, and otherwise publishes extracted staging. `publish_engine_archive_tree` at 1456 serializes publication but records no directory ownership.
- `src-tauri/src/infra/path_authority/mod.rs:6601` registers a verified executable and immediate parent identity, not its enclosing catalog tree. `resolve` at 7782 session-protects successfully used persistent capabilities.
- `src-tauri/src/infra/path_authority/mod.rs:7306` performs authority-only startup reclamation after typed owner evidence. `src/state/pathOwners.ts:270` supplies original storage evidence, and chains attachment reconciliation after that command.
- `src-tauri/src/main.rs:654` executes startup reconciliation through the accepted blocking-operation gateway. This is the existing integration point for collection after durable reconciliation, under the same authority serialization as resolution.
- `src-tauri/src/infra/path_authority/mod.rs:4129` stores bounded atomic JSON lifecycle state. Its existing image cleanup applies to copied UUID image files, not engine archives.
- `src-tauri/src/infra/fs.rs:5031` exposes identity-checked descriptor-relative recursive deletion with partial-removal and durability outcomes. Reuse its Unix and Windows implementations rather than introducing pathname `remove_dir_all`.
- `src-tauri/src/engine/process.rs:778` retains executable and resource leases until confirmed reaping. A pathname working directory and adjacent files can still matter, so an open executable alone is insufficient protection.
- `tasks/handoffs/2026-10-01-stockfish-19-upgrade-review.md`, D9, requires adopting existing artifact directories and never replacing a running tree. Its retention gap is explicitly handed to this finding.

Pickup revalidation: the original defect remains. Current pruning has no archive-tree deletion, and the existing authority sweep test explicitly keeps files. Retain Entry build because persistent provenance, publication failure ordering and startup reachability need a shared contract. Only f-20261002-04 is planned. Co-located f-20260918-02 and f-20261001-05 are excluded by the planner contract.

## Approach

### O1 — native provenance and publication

Maintain a bounded additive catalog-install collection in the existing path registry, separate from executable authority. A record identifies the exact engine root and its native binding, one direct-child destination, the staged/published directory identity, and the managed content inventory. Validate the shape on load and account for records/inventory in the existing registry byte and admission limits. Older registries with no collection load unchanged. Records are not renderer capabilities and cannot broaden path authority.

Only native publication of a newly extracted, verified archive can mint ownership. Capture the staged tree identity and a bounded inventory of its relative entries, kinds, identities and file content digests before publishing. A durable record must exist before the rename makes that exact tree reachable. Failed admission or an unconfirmed durable prepublication write aborts publication. A crash before rename leaves a missing-target record that startup may complete, while a crash after rename retains identity evidence without depending on executable registration or renderer save. Existing-directory adoption keeps D9 and may reuse existing matching provenance, but must never create ownership from the directory name, signature metadata, executable registration or mere containment.

Serialize the existence check, ownership reservation and publication so concurrent identical installs neither replace a registered tree nor overwrite ownership with a losing staging identity. Preserve operation commit-gate cancellation semantics and report committed publication uncertainty truthfully through the existing download error contract. Reuse registry serialization/admission and atomic commit code, do not duplicate it. Any helper shared with existing publication has one canonical implementation. No new IPC parameter or generated binding is expected.

### O2 — reachability and session protection

Collect only at a trusted startup reconciliation after the owner-pruning commit is durable. Engines must be a completed trusted owner family. An untrusted, failed or partial owner snapshot cannot establish absence. A recorded tree remains live if any retained authority entry targets the tree or a descendant, including executable, resource, image and other direct consumers. An explicit EngineResource directory also owns its recursive contents, so a directory resource targeting an ancestor of a catalog tree protects that tree. This differs from a selected workspace root that is only the tree's ancestor, which is not itself an owner of every installation. Use the same relation for retained and session-used resources.

Successfully used, registered, adopted or installed trees remain protected for the rest of the current process. A later startup may end that protection only when the durable use evidence below permits. Extend the existing session-protection mechanism to catalog records so the native archive destination/adoption path protects a tree before asynchronous work, and every successful authority resolution inside it protects it before returning an executable/resource. This includes in-flight config probes, analysis/report actors, games that keep an old binary after upgrade, and unresolved child cleanup. Protection never depends on Windows refusing a delete or Unix keeping executable descriptors alive. Keep protection and its admission bounded. Under the authority lock, eligibility evaluation and removal exclude a concurrent resolve/adoption race. Do not add tree leases to each actor or terminate games to free disk.

Session expiry alone is not evidence that children exited. Before returning a managed executable or resource that can be passed to a child, durably mark every affected install record with this process session's use. Failure or uncertain durability refuses the handoff. The same rule covers ancestor-directory resources and resources resolved before their tree provenance is published. On orderly shutdown clear only this session's markers, and only after the existing shutdown result proves operation admission sealed, native work drained, and all engines/games reaped. The clear itself must be durable. Do not place it in the concurrent attachments tail, which can finish before engine teardown. A timeout, panic, failed reap, failed clear, or crash leaves the marker. A later session never clears another session's marker merely because it started or exited cleanly. Trees with unresolved prior use remain ineligible, with native diagnostics and bounded retained records, like existing unresolved child owners. No PID guessing, process-name scan or TTL can establish that use has ended.

Preserve reachability evidence until cleanup eligibility is derived. If a root becomes inactive, unavailable or replaced, use the recorded exact binding to re-prove it or retain the record for retry. Do not follow its old pathname into a substitute or forget the cleanup locator when root/executable entries are pruned.

### O3 — conservative deletion and retry

Delete only a recorded, unreachable, non-session-protected tree whose root, directory and complete managed inventory still match. Inventory comparison includes additions, missing/replaced entries and content edits, with bounded traversal, no-follow checks and the existing mount/depth refusals. A modified tree is preserved as user state and relinquished from automatic reclamation, rather than repeatedly treating user changes as an operational failure. Unrecorded legacy and adopted trees are likewise preserved. There is no safe retrospective ownership inference from current data.

Use the existing descriptor-relative recursive removal primitive through a sealed authority-owned directory boundary. Keep complete or partially removed tree records through retryable I/O and registry failures. Partial deletion can remove managed entries, so retries accept already-absent entries attributable to the prior cleanup while still refusing new/replaced/edited contents. A missing whole tree or substituted top-level identity completes the obsolete record without deleting its substitute. A committed parent-sync failure records durability uncertainty without reporting that the tree still exists. Cleanup completion is persisted using the existing registry durability semantics. A crash after deletion but before registry update is idempotent on restart.

Persist a cleanup-in-progress state durably before the first destructive step, retaining the original inventory. Only this state permits absent managed entries on retry. Both early existing-target adoption and the serialized publication adoption path must refuse a recorded cleanup-in-progress destination with a typed Conflict, before returning download success or registering a handle. Keep that state across failures and restarts until cleanup removes the whole old tree and durably completes its record. A later fresh install may then publish normally. Do not cancel the cleanup state or restore ownership merely because a new install attempt asks to adopt the damaged directory. No runtime collector is introduced.

Automatic startup cleanup errors are logged natively with their cause and retain retry state, without failing app startup or blocking unrelated owner reconciliation. Do not return success from the helper if an attempted cleanup failed. The caller deliberately handles background maintenance failure separately from the already committed owner reconciliation. Run blocking filesystem/hash work only in the blocking gateway and never recursively acquire that gateway. Do not add notifications or change user-facing copy.

### O4 — proof and delivery

Use production publication and reconciliation paths with disposable fixtures, deterministic synchronization and existing fault injectors. Establish all of these cases:

- Two digest versions and multiple upgrades leave only live managed trees after a later trusted restart. Same-artifact adoption never replaces the existing tree or marks an unrecorded user tree owned.
- Duplicate engines, both saved player owners, explicit resources into an older tree, ancestor-directory resources, untrusted/corrupt owner evidence, session-used old executables and pending cleanup all prevent deletion. A running fake UCI game continues after an upgrade and cleanup attempt. An unconfirmed shutdown followed by reopen and trusted reconciliation keeps the old tree, including adjacent resources, until prior use is actually proven ended. A successful shutdown durably clears only its own markers, making unused managed trees eligible on the next start. Faults in marker persistence refuse handoff, and later clean sessions cannot erase older unresolved markers.
- Published-but-unregistered, save-refused and committed-cancel/discard installs are collected on the next eligible startup. Publication faults at prewrite, rename and postcommit sync boundaries reload truthfully, with no unrecorded published tree.
- User additions, content edits, wrong roots, symlinks/reparse points, tree substitution, mount/depth refusal, missing entries, partial removal, deletion failure and cleanup-state persistence failure neither delete foreign files nor lose retry state. Partial-removal → same-artifact reinstall refuses adoption, without a success report or new executable registration. After restart completes cleanup, a fresh reinstall succeeds and remains usable on the following restart.
- Legacy registry load, malformed/oversized ownership records, bounded admission, registry-save uncertainty, reopen and retry are exercised. Repeated successful upgrade/restart cycles release ownership capacity rather than growing it forever.

New regression tests must fail with only the source fix reverted and pass after restoration. Do not weaken coverage or add a source-text verification tool. Linux proves runtime behavior locally. `pnpm rust:windows:check` proves Windows compilation/linting, never Windows runtime. Required Test jobs `rust-windows-test` and `rust-macos-test` supply non-Linux runtime evidence, while `rust-platform` supplies compilation/lint evidence, before release completion. Use the existing non-Linux Unix compile probe on changed platform-specific source if needed, restore exact bytes, and report its limits.

## Decisions and trade-offs

Decided autonomously for adopter recording, not yet written to the ledger:

- D1: When to collect? Choose a later trusted startup with session retention. Reject immediate upgrade/shutdown collection and a new actor tree-lease registry. Existing d-20260906-09/10 already require durable ownership and conservative session retention. Cost: disk is reclaimed at a later start. Reversal: runtime collection requires a reviewed lifetime protocol proving all old-game and resource consumers.
- D2: What proves ownership? Choose native prepublication provenance plus a managed-content inventory. Reject directory-name guessing, sweeping every workspace child and promoting existing adopted trees. Existing roots can be user selected. Cost: validation reads managed content and legacy leftovers remain. Reversal: historical trees can become collectible only with independently verified provenance, not a path heuristic.
- D3: Where does lifecycle state live? Choose an additive bounded collection in the existing registry. Reject a second JSON journal, storage engine, timer or public cleanup command. It removes the observed unbounded native install retention and reuses current durability/admission. Removal path: remove this collection and its startup/publication hooks together if catalog installs cease, preserving user trees.
- D4: How to treat cleanup errors? Choose native background diagnostics and persisted retry without failing startup, preserving d-20261004-22's background record policy. Reject claiming a failed deletion succeeded or adding new UI notifications. Reversal: a demonstrated user recovery need can justify separately reviewed UI surfacing.
- D5: What proves a previous process finished using a tree? Choose durable per-session use markers cleared only by that session after confirmed successful shutdown. Reject restart as proof of child death and portable PID/name guesses. The MANDATE says never delete while an engine child may still execute, and the frozen threat model includes process interruption. Cost: a crash or unconfirmed shutdown conservatively retains affected trees indefinitely, within admission limits. Reversal: an independently proven cross-process lifetime mechanism can safely release these markers. Do not require Felix to inspect processes or clear records manually.
- D6: Can an install adopt a partially deleted tree? Choose typed refusal until a later eligible startup durably completes cleanup. Reject the existing existence-only adoption for a known cleanup-in-progress tree. The MANDATE's safe deletion and existing D9 require preserving complete live trees, not reviving damaged ones. Cost: reinstall can require restarting after a removal failure. Reversal: a reviewed recovery path may finish the already-started cleanup before fresh publication, without adopting or replacing live files.

Preserve d-20260906-08 descriptor identity registration, d-20260906-09 authority-only semantics for ordinary grants, d-20260906-10/11 prepare/save/reconcile and conservative owner evidence, d-20260918-02 canonical-spelling exemptions, d-20261004-34 the single Windows NT-open primitive, and D9 in the Stockfish handoff. The surfaced decisions about engine-option normalization, PGN saving, download-destination false results, and the old A/B path-hardening slice do not decide catalog-tree ownership and are not reopened.

## Risks / open questions

No unresolved product question. Legacy trees cannot be safely reclaimed automatically from their name or executable path, so this is an explicit migration limit. No manual action is required from Felix. Disk retention is bounded for managed untouched trees by live/session owners, the next eligible startup and registry admission, not a fixed byte quota. Persistent I/O failures, unresolved use from an interrupted shutdown, or modified trees prevent guaranteed reclamation. Filesystems without advisory instance locking retain the existing documented multi-process limit. Deliberate cross-profile/manual sharing of managed installation trees requires separate coordination and is outside this initial collector's ownership protocol.

## Not part of this task

No joiner implementation during planning. No recovery of unrelated copied engine-image orphans (f-20261004-12/13), first-run workspace creation (f-20261002-05), real signed-catalog installation harness (f-20261002-08), parent-path hardening (f-20261001-15 or f-20260920-01), new preferences, catalog revisions, updater changes or platform syscall redesign. Existing out-of-scope findings remain open.

## Phases

### P1 — catalog installation lifecycle

One cohesive sequential implementation phase, covering O1–O4 together so provenance and collection cannot ship disconnected. Files: `src-tauri/src/fs.rs`, `src-tauri/src/infra/path_authority/mod.rs`, a private catalog-install submodule there only if it meaningfully owns the domain code, `src-tauri/src/infra/path_authority/resolved.rs`, `src-tauri/src/infra/fs.rs` only for the smallest sealed access to existing removal, `src-tauri/src/main.rs`, and focused tests in those modules. Read-only consumers: `src/utils/engines.ts`, `src/state/pathOwners.ts`, `src/state/engineOwnerStorage.ts`, `src-tauri/src/engine/process.rs`. Native persistent-state, deletion, concurrency and internal API exposure are sensitive. Use selected executor `write --role sensitive`, resolved model/effort from the registry at execution. No parallel writers.

Exact phase proof: `cargo test --manifest-path src-tauri/Cargo.toml --locked catalog_install -- --nocapture`, followed by `cargo test --manifest-path src-tauri/Cargo.toml --locked infra::path_authority::tests -- --nocapture` and `cargo test --manifest-path src-tauri/Cargo.toml --locked fs::tests -- --nocapture`. Name new behavior tests with `catalog_install` so the first command includes production integration tests, and prove fix-revert red/green on targeted regressions. Run `pnpm checks:pre-review` after this phase and every repair batch before cumulative diff review. Include all changed importers and the existing surviving-game tests in proof selection if their helpers change.

Release after implementation: cumulative diff review with correctness/root-cause and all triggered lenses, including mandatory Tauri security, platform, engine protocol, IPC, errors and tests. Run `pnpm build` and `pnpm verify:app` under the project verification contract because native lifecycle changes, retaining screenshots and reporting exactly what the existing driver reaches. No new visible UI is planned. Then commit known decision/review records and run `pnpm gates:push -- --rust --frontend --bindings` on clean reviewed HEAD. The project push contract requires all three blocks because `src-tauri/src/main.rs` changes, even with unchanged command signatures. Any generated binding change is regenerated, never hand-edited. Required remote CI and install follow the project push skill. The planner stops before implementation Preflight, preserving BASE and clean tracked/untracked status.

## Reviews

Plan authorship and arbitration share one context. Detection uses separate Codex launcher leaves on the same model family as the code, without family separation.

### Round 1

Raw verdicts: chess-semantics APPROVED (NOT APPLICABLE), correctness APPROVED, engine-protocol REVISE, error-handling APPROVED, ipc-contract APPROVED, minimalism APPROVED, persisted-state APPROVED (NOT APPLICABLE), pgn-index APPROVED (NOT APPLICABLE), plan REVISE, platform-semantics APPROVED, tauri-security APPROVED, tests APPROVED. No other prefixed findings. Platform reviewer limitation corrected the description of rust-platform from runtime to compile/lint evidence without changing the proof requirement.

- I1, engine-protocol r1 finding 1, blocker confidence 93: restart can expire protection while a prior child survives failed cleanup. Fix. Evidence: main.rs exit path at 2416 unconditionally exits, process.rs at 3771 says kill-on-drop cannot help, and shutdown_backend_with_attachments at 1809 returns a proof-bearing bool currently discarded. MANDATE no deletion while a child may execute. O2 adds durable session-use markers and successful-shutdown-only clearing, O4 adds interrupted/reopen and marker-write proof. Authority: MANDATE child-lifetime clause and frozen process-interruption threat. Closure pending r2. No dependencies.
- I2, plan r1 finding 1, blocker confidence 92: an ancestor EngineResource directory can own contents inside a catalog install. Fix. Evidence: engine_resource at mod.rs 6397 hands directory contents to an engine. O2 distinguishes explicit recursive resource ownership from workspace selection, O4 adds retention proof. MANDATE safe eligibility. Closure pending r2. No dependencies.
- I3, plan r1 finding 2, blocker confidence 93: existence-only adoption can revive a partly deleted tree. Fix. Evidence: fs.rs 1383 returns success on existence and infra/fs.rs 5061 can fail after deleting children. O3 adds durable cleanup-in-progress state before deletion and typed adoption refusal until complete, O4 adds removal/reinstall/restart proof. MANDATE safe removal while preserving usable installs, D9. Closure pending r2. Depends on O1 ownership serialization, no issue dependency.

Round 1 adopted 3 findings, 3 unique IDs opened, 0 closed, no Skip or Defer, no carried issues. Active wall and non-overlapping waits are unknown. Raw reports, prompts and immutable snapshot are retained under the supplied RUN_TMP for evidence mirroring.

### Round 2

Raw verdicts: correctness APPROVED, engine-protocol APPROVED, error-handling APPROVED, ipc-contract APPROVED, minimalism APPROVED, plan APPROVED, platform-semantics APPROVED, tauri-security APPROVED, tests APPROVED. No prefixed findings or late observations.

- I1 CLOSED by engine-protocol r2 and plan r2 at revision r2. Durable per-session use markers survive failed or interrupted shutdown, and only the originating session's confirmed successful shutdown may clear them. O4 covers reopen, persistence refusal and isolation. Source evidence: main.rs 1869 success boundary and 2416 unconditional exit.
- I2 CLOSED by plan r2 at revision r2. Explicit ancestor directory resources protect recursive contents, with the same relation for retained and session-used resources. Source evidence: mod.rs 6391 directory-resource handoff.
- I3 CLOSED by plan r2 at revision r2. Durable cleanup-in-progress state precedes deletion, both adoption paths refuse incomplete trees, and the proof crosses partial delete, reinstall and restart. Source evidence: fs.rs 1383/1469 and infra/fs.rs 5061.

Round 2 adopted 0 findings, opened 0 IDs and closed all 3 existing IDs. No Skip, Defer, carried issues, withdrawals or unresolved review obligations. Active wall and non-overlapping waits are unknown.

Arbiter correction for r3: the initial release command selected only Rust, but the existing Cross-layer contracts section in `.claude/skills/push/SKILL.md` requires frontend and bindings whenever main.rs changes. Correct the planned command to all three blocks, preserving every required gate. Also clarify O2's session-retention sentence to agree explicitly with its already-reviewed durable-use contract. This changes no deletion eligibility or shutdown behavior from revision r2. Focused plan/tests verification follows, with no new mechanism or MANDATE expansion.

### plan-r4.md

# Plan: reclaim superseded catalog engine trees

## Goal

Resolve f-20261002-04 by giving native catalog installations durable ownership and conservative startup reclamation. Stop accumulating obsolete installations without interrupting games or deleting user files.

## MANDATE

### Superseded catalog engine install directories stay on disk forever once their handle is pruned

* **ID:** f-20261002-04 · **Status:** open · **Area:** native-fs · **Root:** - · **Entry:** build · **Blocked:** none
* **Where:** `src-tauri/src/infra/path_authority/mod.rs:6594` (startup pruning filters unowned registry entries), `:6623` (commits the pruned registry), `:8096` (the commit body saves registry state and deletes no file or tree); `src/utils/engines.ts` `installCatalogEngine` (each verified artefact installs into its own `<archive>-<full sha256>` directory under the engine workspace, commit `f19e14ac`).
* **Defect:** catalog installs are now version-unique and are never replaced (adoption, `D9`). After an upgrade (Stockfish 18 → 19, later 19 → 20) the old entry's handle becomes unowned and is pruned from the path registry at the next startup, but nothing ever removes the app-owned install directory it pointed at. The same holds for an install whose save was refused, and for an artefact downloaded and then discarded after a cancel intent.
* **Why it matters:** an unbounded retention: every catalog version installed stays on disk (the Stockfish 19 Linux tree alone is about 80 MB extracted plus its NNUE files), invisible in the UI. The async-resource rule requires every registry that holds a resource to have a bounded retention policy.
* **Open question:** which directories are safe to delete and when: only directories under the app-owned engine workspace that no registry entry references after pruning, and never while an engine child (including a running game that keeps its old binary until it ends, plan O3) may still be executing from them. Delete at startup after pruning, or on the next upgrade? Windows refuses to delete a running executable.
* **Measured:** the P2 write leaf of the Stockfish 19 upgrade read the pruning path (lines above) and found no tree deletion; the plan's "Risks / open questions" required this check and a filed finding rather than a reaper in that run.
* **Found by:** Stockfish 19 upgrade build, phase P2, 2026-10-02 (Codex leaf investigation, confirmed by the orchestrator's review of the cited lines' role).
* **Correction (2026-10-02, records lens):** the size claim above was not measured. Measured: the extracted Stockfish 19 Linux release tree (`stockfish/`, including sources, wiki and scripts that ship in the archive) is 101 MB (`du -sh`), from an 81 MB download. The Windows sentence is an expectation from plan `D9` (replacing a tree fails while its binary runs), not a measured deletion attempt.
<!-- ledger-meta {"command":"annotate","effect_lines":1,"effect_sha256":"05628af4227b8ee14232b07fbbec6d86ccfddeffaa682fd0ff666c06ffef25b7","input_sha256":"74277d58130b3b7f54ad99c2ead503168f4844caf629f5e0bf9da736c029116b","kind":"mutation-receipt","operation":"a313756fbed85b5e90d49c0bb99f97f3c2c220f2e2cdffdc02fe88c1ef7536d1","options":{"section":null},"request_id_sha256":null,"results":["f-20261002-04"],"target":"f-20261002-04","v":1} -->

## Threat model and non-goals

Normal installs, upgrades, duplicate engine entries, saved player configurations, canceled/failed saves, process interruption, registry write failures, unavailable roots, ordinary user additions/edits, and filesystem substitution are relevant. Linux, macOS and Windows are supported. Preserve the existing no-follow, identity-bound filesystem boundary and its documented inability to perform inode-conditional unlink on Linux (f-20260830-09). Do not claim safety against a malicious same-user process continuously modifying a tree between validation and unlink. Other independent applications manually executing files from a managed directory are outside the application's ownership protocol. Do not add runtime collection, a timer, a public cleanup command, a new storage engine, or a generic collector framework.

## Traced premises

- `src/utils/engines.ts:355` constructs the full digest directory, invokes download, registers a handle, and probes configuration. A renderer-save failure can therefore occur after publication.
- `src-tauri/src/fs.rs:1351` validates signed metadata, adopts existing directories without replacement, and otherwise publishes extracted staging. `publish_engine_archive_tree` at 1456 serializes publication but records no directory ownership.
- `src-tauri/src/infra/path_authority/mod.rs:6601` registers a verified executable and immediate parent identity, not its enclosing catalog tree. `resolve` at 7782 session-protects successfully used persistent capabilities.
- `src-tauri/src/infra/path_authority/mod.rs:7306` performs authority-only startup reclamation after typed owner evidence. `src/state/pathOwners.ts:270` supplies original storage evidence, and chains attachment reconciliation after that command.
- `src-tauri/src/main.rs:654` executes startup reconciliation through the accepted blocking-operation gateway. This is the existing integration point for collection after durable reconciliation, under the same authority serialization as resolution.
- `src-tauri/src/infra/path_authority/mod.rs:4129` stores bounded atomic JSON lifecycle state. Its existing image cleanup applies to copied UUID image files, not engine archives.
- `src-tauri/src/infra/fs.rs:5031` exposes identity-checked descriptor-relative recursive deletion with partial-removal and durability outcomes. Reuse its Unix and Windows implementations rather than introducing pathname `remove_dir_all`.
- `src-tauri/src/engine/process.rs:778` retains executable and resource leases until confirmed reaping. A pathname working directory and adjacent files can still matter, so an open executable alone is insufficient protection.
- `tasks/handoffs/2026-10-01-stockfish-19-upgrade-review.md`, D9, requires adopting existing artifact directories and never replacing a running tree. Its retention gap is explicitly handed to this finding.

Pickup revalidation: the original defect remains. Current pruning has no archive-tree deletion, and the existing authority sweep test explicitly keeps files. Retain Entry build because persistent provenance, publication failure ordering and startup reachability need a shared contract. Only f-20261002-04 is planned. Co-located f-20260918-02 and f-20261001-05 are excluded by the planner contract.

## Approach

### O1 — native provenance and publication

Maintain a bounded additive catalog-install collection in the existing path registry, separate from executable authority. A record identifies the exact engine root and its native binding, one direct-child destination, the staged/published directory identity, and the managed content inventory. Validate the shape on load and account for records/inventory in the existing registry byte and admission limits. Older registries with no collection load unchanged. Records are not renderer capabilities and cannot broaden path authority.

Only native publication of a newly extracted, verified archive can mint ownership. Capture the staged tree identity and a bounded inventory of its relative entries, kinds, identities and file content digests before publishing. A durable record must exist before the rename makes that exact tree reachable. Failed admission or an unconfirmed durable prepublication write aborts publication. A crash before rename leaves a missing-target record that startup may complete, while a crash after rename retains identity evidence without depending on executable registration or renderer save. Existing-directory adoption keeps D9 and may reuse existing matching provenance, but must never create ownership from the directory name, signature metadata, executable registration or mere containment.

Serialize the existence check, ownership reservation and publication so concurrent identical installs neither replace a registered tree nor overwrite ownership with a losing staging identity. Preserve operation commit-gate cancellation semantics and report committed publication uncertainty truthfully through the existing download error contract. Reuse registry serialization/admission and atomic commit code, do not duplicate it. Any helper shared with existing publication has one canonical implementation. No new IPC parameter or generated binding is expected.

### O2 — reachability and session protection

Collect only at a trusted startup reconciliation after the owner-pruning commit is durable. Engines must be a completed trusted owner family. An untrusted, failed or partial owner snapshot cannot establish absence. A recorded tree remains live if any retained authority entry targets the tree or a descendant, including executable, resource, image and other direct consumers. An explicit EngineResource directory also owns its recursive contents, so a directory resource targeting an ancestor of a catalog tree protects that tree. This differs from a selected workspace root that is only the tree's ancestor, which is not itself an owner of every installation. Use the same relation for retained and session-used resources.

Successfully used, registered, adopted or installed trees remain protected for the rest of the current process. A later startup may end that protection only when the durable use evidence below permits. Extend the existing session-protection mechanism to catalog records so the native archive destination/adoption path protects a tree before asynchronous work, and every successful authority resolution inside it protects it before returning an executable/resource. This includes in-flight config probes, analysis/report actors, games that keep an old binary after upgrade, and unresolved child cleanup. Protection never depends on Windows refusing a delete or Unix keeping executable descriptors alive. Keep protection and its admission bounded. Under the authority lock, eligibility evaluation and removal exclude a concurrent resolve/adoption race. Do not add tree leases to each actor or terminate games to free disk.

Session expiry alone is not evidence that children exited. Before returning a managed executable or resource that can be passed to a child, durably mark every affected install record with this process session's use. Failure or uncertain durability refuses the handoff. The same rule covers ancestor-directory resources and resources resolved before their tree provenance is published. On orderly shutdown clear only this session's markers, and only after the existing shutdown result proves operation admission sealed, native work drained, and all engines/games reaped. The clear itself must be durable. Do not place it in the concurrent attachments tail, which can finish before engine teardown. A timeout, panic, failed reap, failed clear, or crash leaves the marker. A later session never clears another session's marker merely because it started or exited cleanly. Trees with unresolved prior use remain ineligible, with native diagnostics and bounded retained records, like existing unresolved child owners. No PID guessing, process-name scan or TTL can establish that use has ended.

Preserve reachability evidence until cleanup eligibility is derived. If a root becomes inactive, unavailable or replaced, use the recorded exact binding to re-prove it or retain the record for retry. Do not follow its old pathname into a substitute or forget the cleanup locator when root/executable entries are pruned.

### O3 — conservative deletion and retry

Delete only a recorded, unreachable, non-session-protected tree whose root, directory and complete managed inventory still match. Inventory comparison includes additions, missing/replaced entries and content edits, with bounded traversal, no-follow checks and the existing mount/depth refusals. A modified tree is preserved as user state and relinquished from automatic reclamation, rather than repeatedly treating user changes as an operational failure. Unrecorded legacy and adopted trees are likewise preserved. There is no safe retrospective ownership inference from current data.

Use the existing descriptor-relative recursive removal primitive through a sealed authority-owned directory boundary. Keep complete or partially removed tree records through retryable I/O and registry failures. Partial deletion can remove managed entries, so retries accept already-absent entries attributable to the prior cleanup while still refusing new/replaced/edited contents. A missing whole tree or substituted top-level identity completes the obsolete record without deleting its substitute. A committed parent-sync failure records durability uncertainty without reporting that the tree still exists. Cleanup completion is persisted using the existing registry durability semantics. A crash after deletion but before registry update is idempotent on restart.

Persist a cleanup-in-progress state durably before the first destructive step, retaining the original inventory. Only this state permits absent managed entries on retry. Both early existing-target adoption and the serialized publication adoption path must refuse a recorded cleanup-in-progress destination with a typed Conflict, before returning download success or registering a handle. Keep that state across failures and restarts until cleanup removes the whole old tree and durably completes its record. A later fresh install may then publish normally. Do not cancel the cleanup state or restore ownership merely because a new install attempt asks to adopt the damaged directory. No runtime collector is introduced.

Automatic startup cleanup errors are logged natively with their cause and retain retry state, without failing app startup or blocking unrelated owner reconciliation. Do not return success from the helper if an attempted cleanup failed. The caller deliberately handles background maintenance failure separately from the already committed owner reconciliation. Run blocking filesystem/hash work only in the blocking gateway and never recursively acquire that gateway. Do not add notifications or change user-facing copy.

### O4 — proof and delivery

Use production publication and reconciliation paths with disposable fixtures, deterministic synchronization and existing fault injectors. Establish all of these cases:

- Two digest versions and multiple upgrades leave only live managed trees after a later trusted restart. Same-artifact adoption never replaces the existing tree or marks an unrecorded user tree owned.
- Duplicate engines, both saved player owners, explicit resources into an older tree, ancestor-directory resources, untrusted/corrupt owner evidence, session-used old executables and pending cleanup all prevent deletion. A running fake UCI game continues after an upgrade and cleanup attempt. An unconfirmed shutdown followed by reopen and trusted reconciliation keeps the old tree, including adjacent resources, until prior use is actually proven ended. A successful shutdown durably clears only its own markers, making unused managed trees eligible on the next start. Faults in marker persistence refuse handoff, and later clean sessions cannot erase older unresolved markers.
- Published-but-unregistered, save-refused and committed-cancel/discard installs are collected on the next eligible startup. Publication faults at prewrite, rename and postcommit sync boundaries reload truthfully, with no unrecorded published tree.
- User additions, content edits, wrong roots, symlinks/reparse points, tree substitution, mount/depth refusal, missing entries, partial removal, deletion failure and cleanup-state persistence failure neither delete foreign files nor lose retry state. Partial-removal → same-artifact reinstall refuses adoption, without a success report or new executable registration. After restart completes cleanup, a fresh reinstall succeeds and remains usable on the following restart.
- Legacy registry load, malformed/oversized ownership records, bounded admission, registry-save uncertainty, reopen and retry are exercised. Repeated successful upgrade/restart cycles release ownership capacity rather than growing it forever.

New regression tests must fail with only the source fix reverted and pass after restoration. Do not weaken coverage or add a source-text verification tool. Linux proves runtime behavior locally. `pnpm rust:windows:check` proves Windows compilation/linting, never Windows runtime. Required Test jobs `rust-windows-test` and `rust-macos-test` supply non-Linux runtime evidence, while `rust-platform` supplies compilation/lint evidence, before release completion. Use the existing non-Linux Unix compile probe on changed platform-specific source if needed, restore exact bytes, and report its limits.

## Decisions and trade-offs

Decided autonomously for adopter recording, not yet written to the ledger:

- D1: When to collect? Choose a later trusted startup with session retention. Reject immediate upgrade/shutdown collection and a new actor tree-lease registry. Existing d-20260906-09/10 already require durable ownership and conservative session retention. Cost: disk is reclaimed at a later start. Reversal: runtime collection requires a reviewed lifetime protocol proving all old-game and resource consumers.
- D2: What proves ownership? Choose native prepublication provenance plus a managed-content inventory. Reject directory-name guessing, sweeping every workspace child and promoting existing adopted trees. Existing roots can be user selected. Cost: validation reads managed content and legacy leftovers remain. Reversal: historical trees can become collectible only with independently verified provenance, not a path heuristic.
- D3: Where does lifecycle state live? Choose an additive bounded collection in the existing registry. Reject a second JSON journal, storage engine, timer or public cleanup command. It removes the observed unbounded native install retention and reuses current durability/admission. Removal path: remove this collection and its startup/publication hooks together if catalog installs cease, preserving user trees.
- D4: How to treat cleanup errors? Choose native background diagnostics and persisted retry without failing startup, preserving d-20261004-22's background record policy. Reject claiming a failed deletion succeeded or adding new UI notifications. Reversal: a demonstrated user recovery need can justify separately reviewed UI surfacing.
- D5: What proves a previous process finished using a tree? Choose durable per-session use markers cleared only by that session after confirmed successful shutdown. Reject restart as proof of child death and portable PID/name guesses. The MANDATE says never delete while an engine child may still execute, and the frozen threat model includes process interruption. Cost: a crash or unconfirmed shutdown conservatively retains affected trees indefinitely, within admission limits. Reversal: an independently proven cross-process lifetime mechanism can safely release these markers. Do not require Felix to inspect processes or clear records manually.
- D6: Can an install adopt a partially deleted tree? Choose typed refusal until a later eligible startup durably completes cleanup. Reject the existing existence-only adoption for a known cleanup-in-progress tree. The MANDATE's safe deletion and existing D9 require preserving complete live trees, not reviving damaged ones. Cost: reinstall can require restarting after a removal failure. Reversal: a reviewed recovery path may finish the already-started cleanup before fresh publication, without adopting or replacing live files.

Preserve d-20260906-08 descriptor identity registration, d-20260906-09 authority-only semantics for ordinary grants, d-20260906-10/11 prepare/save/reconcile and conservative owner evidence, d-20260918-02 canonical-spelling exemptions, d-20261004-34 the single Windows NT-open primitive, and D9 in the Stockfish handoff. The surfaced decisions about engine-option normalization, PGN saving, download-destination false results, and the old A/B path-hardening slice do not decide catalog-tree ownership and are not reopened.

## Risks / open questions

No unresolved product question. Legacy trees cannot be safely reclaimed automatically from their name or executable path, so this is an explicit migration limit. No manual action is required from Felix. Disk retention is bounded for managed untouched trees by live/session owners, the next eligible startup and registry admission, not a fixed byte quota. Persistent I/O failures, unresolved use from an interrupted shutdown, or modified trees prevent guaranteed reclamation. Filesystems without advisory instance locking retain the existing documented multi-process limit. Deliberate cross-profile/manual sharing of managed installation trees requires separate coordination and is outside this initial collector's ownership protocol.

## Not part of this task

No joiner implementation during planning. No recovery of unrelated copied engine-image orphans (f-20261004-12/13), first-run workspace creation (f-20261002-05), real signed-catalog installation harness (f-20261002-08), parent-path hardening (f-20261001-15 or f-20260920-01), new preferences, catalog revisions, updater changes or platform syscall redesign. Existing out-of-scope findings remain open.

## Phases

### P1 — catalog installation lifecycle

One cohesive sequential implementation phase, covering O1–O4 together so provenance and collection cannot ship disconnected. Files: `src-tauri/src/fs.rs`, `src-tauri/src/infra/path_authority/mod.rs`, a private catalog-install submodule there only if it meaningfully owns the domain code, `src-tauri/src/infra/path_authority/resolved.rs`, `src-tauri/src/infra/fs.rs` only for the smallest sealed access to existing removal, `src-tauri/src/main.rs`, and focused tests in those modules. Read-only consumers: `src/utils/engines.ts`, `src/state/pathOwners.ts`, `src/state/engineOwnerStorage.ts`, `src-tauri/src/engine/process.rs`. Native persistent-state, deletion, concurrency and internal API exposure are sensitive. Use selected executor `write --role sensitive`, resolved model/effort from the registry at execution. No parallel writers.

Exact phase proof: `cargo test --manifest-path src-tauri/Cargo.toml --locked catalog_install -- --nocapture`, followed by `cargo test --manifest-path src-tauri/Cargo.toml --locked infra::path_authority::tests -- --nocapture` and `cargo test --manifest-path src-tauri/Cargo.toml --locked fs::tests -- --nocapture`. Name new behavior tests with `catalog_install` so the first command includes production integration tests, and prove fix-revert red/green on targeted regressions. Run `pnpm checks:pre-review` after this phase and every repair batch before cumulative diff review. Include all changed importers and the existing surviving-game tests in proof selection if their helpers change.

Release after implementation: cumulative diff review with correctness/root-cause and all triggered lenses, including mandatory Tauri security, platform, engine protocol, IPC, errors and tests. Run `pnpm build` and `pnpm verify:app` under the project verification contract because native lifecycle changes, retaining screenshots and reporting exactly what the existing driver reaches. No new visible UI is planned. Then commit known decision/review records and run `pnpm gates:push -- --rust --frontend --bindings` on clean reviewed HEAD. The project push contract requires all three blocks because `src-tauri/src/main.rs` changes, even with unchanged command signatures. Any generated binding change is regenerated, never hand-edited. Required remote CI and install follow the project push skill. The planner stops before implementation Preflight, preserving BASE and clean tracked/untracked status.

## Reviews

Plan authorship and arbitration share one context. Detection uses separate Codex launcher leaves on the same model family as the code, without family separation.

### Round 1

Raw verdicts: chess-semantics APPROVED (NOT APPLICABLE), correctness APPROVED, engine-protocol REVISE, error-handling APPROVED, ipc-contract APPROVED, minimalism APPROVED, persisted-state APPROVED (NOT APPLICABLE), pgn-index APPROVED (NOT APPLICABLE), plan REVISE, platform-semantics APPROVED, tauri-security APPROVED, tests APPROVED. No other prefixed findings. Platform reviewer limitation corrected the description of rust-platform from runtime to compile/lint evidence without changing the proof requirement.

- I1, engine-protocol r1 finding 1, blocker confidence 93: restart can expire protection while a prior child survives failed cleanup. Fix. Evidence: main.rs exit path at 2416 unconditionally exits, process.rs at 3771 says kill-on-drop cannot help, and shutdown_backend_with_attachments at 1809 returns a proof-bearing bool currently discarded. MANDATE no deletion while a child may execute. O2 adds durable session-use markers and successful-shutdown-only clearing, O4 adds interrupted/reopen and marker-write proof. Authority: MANDATE child-lifetime clause and frozen process-interruption threat. Closure pending r2. No dependencies.
- I2, plan r1 finding 1, blocker confidence 92: an ancestor EngineResource directory can own contents inside a catalog install. Fix. Evidence: engine_resource at mod.rs 6397 hands directory contents to an engine. O2 distinguishes explicit recursive resource ownership from workspace selection, O4 adds retention proof. MANDATE safe eligibility. Closure pending r2. No dependencies.
- I3, plan r1 finding 2, blocker confidence 93: existence-only adoption can revive a partly deleted tree. Fix. Evidence: fs.rs 1383 returns success on existence and infra/fs.rs 5061 can fail after deleting children. O3 adds durable cleanup-in-progress state before deletion and typed adoption refusal until complete, O4 adds removal/reinstall/restart proof. MANDATE safe removal while preserving usable installs, D9. Closure pending r2. Depends on O1 ownership serialization, no issue dependency.

Round 1 adopted 3 findings, 3 unique IDs opened, 0 closed, no Skip or Defer, no carried issues. Active wall and non-overlapping waits are unknown. Raw reports, prompts and immutable snapshot are retained under the supplied RUN_TMP for evidence mirroring.

### Round 2

Raw verdicts: correctness APPROVED, engine-protocol APPROVED, error-handling APPROVED, ipc-contract APPROVED, minimalism APPROVED, plan APPROVED, platform-semantics APPROVED, tauri-security APPROVED, tests APPROVED. No prefixed findings or late observations.

- I1 CLOSED by engine-protocol r2 and plan r2 at revision r2. Durable per-session use markers survive failed or interrupted shutdown, and only the originating session's confirmed successful shutdown may clear them. O4 covers reopen, persistence refusal and isolation. Source evidence: main.rs 1869 success boundary and 2416 unconditional exit.
- I2 CLOSED by plan r2 at revision r2. Explicit ancestor directory resources protect recursive contents, with the same relation for retained and session-used resources. Source evidence: mod.rs 6391 directory-resource handoff.
- I3 CLOSED by plan r2 at revision r2. Durable cleanup-in-progress state precedes deletion, both adoption paths refuse incomplete trees, and the proof crosses partial delete, reinstall and restart. Source evidence: fs.rs 1383/1469 and infra/fs.rs 5061.

Round 2 adopted 0 findings, opened 0 IDs and closed all 3 existing IDs. No Skip, Defer, carried issues, withdrawals or unresolved review obligations. Active wall and non-overlapping waits are unknown.

Arbiter correction for r3: the initial release command selected only Rust, but the existing Cross-layer contracts section in `.claude/skills/push/SKILL.md` requires frontend and bindings whenever main.rs changes. Correct the planned command to all three blocks, preserving every required gate. Also clarify O2's session-retention sentence to agree explicitly with its already-reviewed durable-use contract. This changes no deletion eligibility or shutdown behavior from revision r2. Focused plan/tests verification follows, with no new mechanism or MANDATE expansion.

### Round 3

Raw verdicts: plan APPROVED, tests APPROVED. No findings or late observations. The final candidate retains all r2 issue closures and selects the full project-required Rust/frontend/bindings gate set. Round 3 adopted 0 findings and opened 0 IDs. Final totals: 3 unique issues, all Fix and CLOSED at r2, no Skip, Defer, carried, withdrawn or open issues. No rewrite or split. No observed correction-created defect. The r3 gate correction repairs the original r1 proof selection, not a defect created by r2.

Final review timings and provenance are in sibling plan-meta.json and reviews-handoff.md. Active wall and non-overlapping quota/dependency/release waits remain unknown. Planning performed source tracing and read-only ledger validation, not implementation, runtime proof, gates, browser verification or release. Implementation remains pending under the PLAN-ONLY contract.

### r2.delta

--- /tmp/drain-plan-drain-90a2aa88-slot0/build/plan-r1.md
+++ /home/felixb/.claude/drain-plans/drain-90a2aa88/slot-0/wt/tasks/plans/2026-10-15-catalog-engine-retention.md
@@ -48,9 +48,11 @@
 
 ### O2 — reachability and session protection
 
-Collect only at a trusted startup reconciliation after the owner-pruning commit is durable. Engines must be a completed trusted owner family. An untrusted, failed or partial owner snapshot cannot establish absence. A recorded tree remains live if any retained authority entry targets the tree or a descendant, including executable, resource, image and other direct consumers. A selected workspace root that is only the tree's ancestor is not itself an owner of every installation.
+Collect only at a trusted startup reconciliation after the owner-pruning commit is durable. Engines must be a completed trusted owner family. An untrusted, failed or partial owner snapshot cannot establish absence. A recorded tree remains live if any retained authority entry targets the tree or a descendant, including executable, resource, image and other direct consumers. An explicit EngineResource directory also owns its recursive contents, so a directory resource targeting an ancestor of a catalog tree protects that tree. This differs from a selected workspace root that is only the tree's ancestor, which is not itself an owner of every installation. Use the same relation for retained and session-used resources.
 
 Successfully used, registered, adopted or installed trees in the current process stay protected until the next process start. Extend the existing session-protection mechanism to catalog records so the native archive destination/adoption path protects a tree before asynchronous work, and every successful authority resolution inside it protects it before returning an executable/resource. This includes in-flight config probes, analysis/report actors, games that keep an old binary after upgrade, and unresolved child cleanup. Protection never depends on Windows refusing a delete or Unix keeping executable descriptors alive. Keep protection and its admission bounded. Under the authority lock, eligibility evaluation and removal exclude a concurrent resolve/adoption race. Do not add tree leases to each actor or terminate games to free disk.
+
+Session expiry alone is not evidence that children exited. Before returning a managed executable or resource that can be passed to a child, durably mark every affected install record with this process session's use. Failure or uncertain durability refuses the handoff. The same rule covers ancestor-directory resources and resources resolved before their tree provenance is published. On orderly shutdown clear only this session's markers, and only after the existing shutdown result proves operation admission sealed, native work drained, and all engines/games reaped. The clear itself must be durable. Do not place it in the concurrent attachments tail, which can finish before engine teardown. A timeout, panic, failed reap, failed clear, or crash leaves the marker. A later session never clears another session's marker merely because it started or exited cleanly. Trees with unresolved prior use remain ineligible, with native diagnostics and bounded retained records, like existing unresolved child owners. No PID guessing, process-name scan or TTL can establish that use has ended.
 
 Preserve reachability evidence until cleanup eligibility is derived. If a root becomes inactive, unavailable or replaced, use the recorded exact binding to re-prove it or retain the record for retry. Do not follow its old pathname into a substitute or forget the cleanup locator when root/executable entries are pruned.
 
@@ -60,6 +62,8 @@
 
 Use the existing descriptor-relative recursive removal primitive through a sealed authority-owned directory boundary. Keep complete or partially removed tree records through retryable I/O and registry failures. Partial deletion can remove managed entries, so retries accept already-absent entries attributable to the prior cleanup while still refusing new/replaced/edited contents. A missing whole tree or substituted top-level identity completes the obsolete record without deleting its substitute. A committed parent-sync failure records durability uncertainty without reporting that the tree still exists. Cleanup completion is persisted using the existing registry durability semantics. A crash after deletion but before registry update is idempotent on restart.
 
+Persist a cleanup-in-progress state durably before the first destructive step, retaining the original inventory. Only this state permits absent managed entries on retry. Both early existing-target adoption and the serialized publication adoption path must refuse a recorded cleanup-in-progress destination with a typed Conflict, before returning download success or registering a handle. Keep that state across failures and restarts until cleanup removes the whole old tree and durably completes its record. A later fresh install may then publish normally. Do not cancel the cleanup state or restore ownership merely because a new install attempt asks to adopt the damaged directory. No runtime collector is introduced.
+
 Automatic startup cleanup errors are logged natively with their cause and retain retry state, without failing app startup or blocking unrelated owner reconciliation. Do not return success from the helper if an attempted cleanup failed. The caller deliberately handles background maintenance failure separately from the already committed owner reconciliation. Run blocking filesystem/hash work only in the blocking gateway and never recursively acquire that gateway. Do not add notifications or change user-facing copy.
 
 ### O4 — proof and delivery
@@ -67,12 +71,12 @@
 Use production publication and reconciliation paths with disposable fixtures, deterministic synchronization and existing fault injectors. Establish all of these cases:
 
 - Two digest versions and multiple upgrades leave only live managed trees after a later trusted restart. Same-artifact adoption never replaces the existing tree or marks an unrecorded user tree owned.
-- Duplicate engines, both saved player owners, explicit resources into an older tree, untrusted/corrupt owner evidence, session-used old executables and pending cleanup all prevent deletion. A running fake UCI game continues after an upgrade and cleanup attempt.
+- Duplicate engines, both saved player owners, explicit resources into an older tree, ancestor-directory resources, untrusted/corrupt owner evidence, session-used old executables and pending cleanup all prevent deletion. A running fake UCI game continues after an upgrade and cleanup attempt. An unconfirmed shutdown followed by reopen and trusted reconciliation keeps the old tree, including adjacent resources, until prior use is actually proven ended. A successful shutdown durably clears only its own markers, making unused managed trees eligible on the next start. Faults in marker persistence refuse handoff, and later clean sessions cannot erase older unresolved markers.
 - Published-but-unregistered, save-refused and committed-cancel/discard installs are collected on the next eligible startup. Publication faults at prewrite, rename and postcommit sync boundaries reload truthfully, with no unrecorded published tree.
-- User additions, content edits, wrong roots, symlinks/reparse points, tree substitution, mount/depth refusal, missing entries, partial removal, deletion failure and cleanup-state persistence failure neither delete foreign files nor lose retry state.
+- User additions, content edits, wrong roots, symlinks/reparse points, tree substitution, mount/depth refusal, missing entries, partial removal, deletion failure and cleanup-state persistence failure neither delete foreign files nor lose retry state. Partial-removal → same-artifact reinstall refuses adoption, without a success report or new executable registration. After restart completes cleanup, a fresh reinstall succeeds and remains usable on the following restart.
 - Legacy registry load, malformed/oversized ownership records, bounded admission, registry-save uncertainty, reopen and retry are exercised. Repeated successful upgrade/restart cycles release ownership capacity rather than growing it forever.
 
-New regression tests must fail with only the source fix reverted and pass after restoration. Do not weaken coverage or add a source-text verification tool. Linux proves runtime behavior locally. `pnpm rust:windows:check` proves Windows compilation/linting, never Windows runtime. Required Test jobs `rust-windows-test`, `rust-macos-test` and `rust-platform` supply non-Linux evidence before release completion. Use the existing non-Linux Unix compile probe on changed platform-specific source if needed, restore exact bytes, and report its limits.
+New regression tests must fail with only the source fix reverted and pass after restoration. Do not weaken coverage or add a source-text verification tool. Linux proves runtime behavior locally. `pnpm rust:windows:check` proves Windows compilation/linting, never Windows runtime. Required Test jobs `rust-windows-test` and `rust-macos-test` supply non-Linux runtime evidence, while `rust-platform` supplies compilation/lint evidence, before release completion. Use the existing non-Linux Unix compile probe on changed platform-specific source if needed, restore exact bytes, and report its limits.
 
 ## Decisions and trade-offs
 
@@ -82,12 +86,14 @@
 - D2: What proves ownership? Choose native prepublication provenance plus a managed-content inventory. Reject directory-name guessing, sweeping every workspace child and promoting existing adopted trees. Existing roots can be user selected. Cost: validation reads managed content and legacy leftovers remain. Reversal: historical trees can become collectible only with independently verified provenance, not a path heuristic.
 - D3: Where does lifecycle state live? Choose an additive bounded collection in the existing registry. Reject a second JSON journal, storage engine, timer or public cleanup command. It removes the observed unbounded native install retention and reuses current durability/admission. Removal path: remove this collection and its startup/publication hooks together if catalog installs cease, preserving user trees.
 - D4: How to treat cleanup errors? Choose native background diagnostics and persisted retry without failing startup, preserving d-20261004-22's background record policy. Reject claiming a failed deletion succeeded or adding new UI notifications. Reversal: a demonstrated user recovery need can justify separately reviewed UI surfacing.
+- D5: What proves a previous process finished using a tree? Choose durable per-session use markers cleared only by that session after confirmed successful shutdown. Reject restart as proof of child death and portable PID/name guesses. The MANDATE says never delete while an engine child may still execute, and the frozen threat model includes process interruption. Cost: a crash or unconfirmed shutdown conservatively retains affected trees indefinitely, within admission limits. Reversal: an independently proven cross-process lifetime mechanism can safely release these markers. Do not require Felix to inspect processes or clear records manually.
+- D6: Can an install adopt a partially deleted tree? Choose typed refusal until a later eligible startup durably completes cleanup. Reject the existing existence-only adoption for a known cleanup-in-progress tree. The MANDATE's safe deletion and existing D9 require preserving complete live trees, not reviving damaged ones. Cost: reinstall can require restarting after a removal failure. Reversal: a reviewed recovery path may finish the already-started cleanup before fresh publication, without adopting or replacing live files.
 
 Preserve d-20260906-08 descriptor identity registration, d-20260906-09 authority-only semantics for ordinary grants, d-20260906-10/11 prepare/save/reconcile and conservative owner evidence, d-20260918-02 canonical-spelling exemptions, d-20261004-34 the single Windows NT-open primitive, and D9 in the Stockfish handoff. The surfaced decisions about engine-option normalization, PGN saving, download-destination false results, and the old A/B path-hardening slice do not decide catalog-tree ownership and are not reopened.
 
 ## Risks / open questions
 
-No unresolved product question. Legacy trees cannot be safely reclaimed automatically from their name or executable path, so this is an explicit migration limit. No manual action is required from Felix. Disk retention is bounded for managed untouched trees by live/session owners, the next eligible startup and registry admission, not a fixed byte quota. Persistent I/O failures or modified trees prevent guaranteed reclamation. Filesystems without advisory instance locking retain the existing documented multi-process limit. Deliberate cross-profile/manual sharing of managed installation trees requires separate coordination and is outside this initial collector's ownership protocol.
+No unresolved product question. Legacy trees cannot be safely reclaimed automatically from their name or executable path, so this is an explicit migration limit. No manual action is required from Felix. Disk retention is bounded for managed untouched trees by live/session owners, the next eligible startup and registry admission, not a fixed byte quota. Persistent I/O failures, unresolved use from an interrupted shutdown, or modified trees prevent guaranteed reclamation. Filesystems without advisory instance locking retain the existing documented multi-process limit. Deliberate cross-profile/manual sharing of managed installation trees requires separate coordination and is outside this initial collector's ownership protocol.
 
 ## Not part of this task
 

### r3.delta

--- /tmp/drain-plan-drain-90a2aa88-slot0/build/plan-r2.md
+++ /home/felixb/.claude/drain-plans/drain-90a2aa88/slot-0/wt/tasks/plans/2026-10-15-catalog-engine-retention.md
@@ -50,7 +50,7 @@
 
 Collect only at a trusted startup reconciliation after the owner-pruning commit is durable. Engines must be a completed trusted owner family. An untrusted, failed or partial owner snapshot cannot establish absence. A recorded tree remains live if any retained authority entry targets the tree or a descendant, including executable, resource, image and other direct consumers. An explicit EngineResource directory also owns its recursive contents, so a directory resource targeting an ancestor of a catalog tree protects that tree. This differs from a selected workspace root that is only the tree's ancestor, which is not itself an owner of every installation. Use the same relation for retained and session-used resources.
 
-Successfully used, registered, adopted or installed trees in the current process stay protected until the next process start. Extend the existing session-protection mechanism to catalog records so the native archive destination/adoption path protects a tree before asynchronous work, and every successful authority resolution inside it protects it before returning an executable/resource. This includes in-flight config probes, analysis/report actors, games that keep an old binary after upgrade, and unresolved child cleanup. Protection never depends on Windows refusing a delete or Unix keeping executable descriptors alive. Keep protection and its admission bounded. Under the authority lock, eligibility evaluation and removal exclude a concurrent resolve/adoption race. Do not add tree leases to each actor or terminate games to free disk.
+Successfully used, registered, adopted or installed trees remain protected for the rest of the current process. A later startup may end that protection only when the durable use evidence below permits. Extend the existing session-protection mechanism to catalog records so the native archive destination/adoption path protects a tree before asynchronous work, and every successful authority resolution inside it protects it before returning an executable/resource. This includes in-flight config probes, analysis/report actors, games that keep an old binary after upgrade, and unresolved child cleanup. Protection never depends on Windows refusing a delete or Unix keeping executable descriptors alive. Keep protection and its admission bounded. Under the authority lock, eligibility evaluation and removal exclude a concurrent resolve/adoption race. Do not add tree leases to each actor or terminate games to free disk.
 
 Session expiry alone is not evidence that children exited. Before returning a managed executable or resource that can be passed to a child, durably mark every affected install record with this process session's use. Failure or uncertain durability refuses the handoff. The same rule covers ancestor-directory resources and resources resolved before their tree provenance is published. On orderly shutdown clear only this session's markers, and only after the existing shutdown result proves operation admission sealed, native work drained, and all engines/games reaped. The clear itself must be durable. Do not place it in the concurrent attachments tail, which can finish before engine teardown. A timeout, panic, failed reap, failed clear, or crash leaves the marker. A later session never clears another session's marker merely because it started or exited cleanly. Trees with unresolved prior use remain ineligible, with native diagnostics and bounded retained records, like existing unresolved child owners. No PID guessing, process-name scan or TTL can establish that use has ended.
 
@@ -107,5 +107,5 @@
 
 Exact phase proof: `cargo test --manifest-path src-tauri/Cargo.toml --locked catalog_install -- --nocapture`, followed by `cargo test --manifest-path src-tauri/Cargo.toml --locked infra::path_authority::tests -- --nocapture` and `cargo test --manifest-path src-tauri/Cargo.toml --locked fs::tests -- --nocapture`. Name new behavior tests with `catalog_install` so the first command includes production integration tests, and prove fix-revert red/green on targeted regressions. Run `pnpm checks:pre-review` after this phase and every repair batch before cumulative diff review. Include all changed importers and the existing surviving-game tests in proof selection if their helpers change.
 
-Release after implementation: cumulative diff review with correctness/root-cause and all triggered lenses, including mandatory Tauri security, platform, engine protocol, IPC, errors and tests. Run `pnpm build` and `pnpm verify:app` under the project verification contract because native lifecycle changes, retaining screenshots and reporting exactly what the existing driver reaches. No new visible UI is planned. Then commit known decision/review records and run `pnpm gates:push -- --rust` on clean reviewed HEAD. An unexpected IPC/generated-contract change requires both frontend and bindings flags and regenerated bindings. Required remote CI and install follow the project push skill. The planner stops before implementation Preflight, preserving BASE and clean tracked/untracked status.
+Release after implementation: cumulative diff review with correctness/root-cause and all triggered lenses, including mandatory Tauri security, platform, engine protocol, IPC, errors and tests. Run `pnpm build` and `pnpm verify:app` under the project verification contract because native lifecycle changes, retaining screenshots and reporting exactly what the existing driver reaches. No new visible UI is planned. Then commit known decision/review records and run `pnpm gates:push -- --rust --frontend --bindings` on clean reviewed HEAD. The project push contract requires all three blocks because `src-tauri/src/main.rs` changes, even with unchanged command signatures. Any generated binding change is regenerated, never hand-edited. Required remote CI and install follow the project push skill. The planner stops before implementation Preflight, preserving BASE and clean tracked/untracked status.
 

## Adopted implementation run — 2026-10-16

The planner sections above are preserved history. This run adopted the publication after the supervisor gate returned clear against BASE 3e0ec3d9fc6ffd1328a55b94d96ca4ed54393011. The reviewed O1–O4 contract and four inherited review rounds remain the design authority. Decisions D1–D6 were recorded through the locked writer as d-20261016-01 through d-20261016-06.

P1 is implemented in 836071a1 by a separate Codex write leaf, gpt-6.1-sol at high effort, with two resumed repair assignments. The root orchestrated, inspected the complete diff, reran the focused proof and owns release. Plan authorship and arbitration shared one context. Current adoption and cumulative arbitration use this root context. Detection and implementation use the same model family in separate sessions, without family separation.

Root focused proof passed 36 catalog tests, 278 path-authority tests, 214 filesystem tests with one existing isolated-mount test ignored, 38 shutdown tests and one retained-cleanup test. Formatting and diff checks passed. Pre-review initially found a Windows dead test helper after its cross-platform caller was removed. The helper now compiles only for its remaining Unix caller, whose actual test passed again, and the complete pre-review scheduler passed including Windows GNU compilation/clippy. Windows and macOS runtime proof remains a required hosted release step.

The authoring pass first stopped on a nonexistent test constructor. Repair also corrected the serialized ownership shape, canonical fixture roots, executable permissions, bounded shutdown ordering, recursive inventory stack allocation, and labelled-error test matching. These were repaired before the P1 commit. A source-only publication-hook reversal compiled and failed behaviorally with zero durable ownership records instead of one. Exact byte restoration applied without hunk offsets and passed, followed by the complete focused proof set. The Linux process fixture is a real UCI child under game-side supervision with registry reopen, not a full GameManager or browser game.

The two co-located candidates were checked against the implemented phase. f-20260918-02 qualifies because both fixes edit path_authority/mod.rs and will be handled next at lens tier. f-20261001-05 remains open and unchanged because the catalog phase only reads src/utils/engines.ts, while the portrait fix would edit that renderer file. Its candidate claim remains with the drain until the boundary.

Cumulative diff review, app verification, final gates, push, hosted platform jobs and installation are pending in this same run. No final release success is claimed here.

### Co-located canonical-spelling fix

f-20260918-02 is implemented in 410173aa and closed through the locked ledger writer. A separate sensitive Codex leaf added six regression tests before production changes. The baseline selector passed three tests and failed five, demonstrating reservation/preparation acceptance and committed publications after ancestor swaps. Workspace lookup already refused at its later parent walk. The implementation shares acquire_stored_target across existing and repaired doors, includes prepare_download_artifact in verified.rs, and re-proves spelling at the final publication checkpoint. The initial assignment omitted the existing prepare submodule and was extended after the root read and traced it. This was an assignment correction, not a new design.

Root reran eight canonical-spelling tests, all 284 path-authority tests, filesystem importer tests, formatting and diff checks. The complete pre-review scheduler passed, including Windows GNU compilation/clippy. No renderer files or user-facing copy changed. f-20261001-05 remains skipped for the file-overlap reason above. Its finding entry is unchanged.

### Cumulative review inputs

Review covers the complete unpublished merge-base range, including all decisions, finding closures and this inherited planning history. Review uses separate selected-executor Codex sessions on the same model family as the code. Plan authorship and arbitration shared one context, and the current root owns integration arbitration. No family separation is claimed.

An unmeasured platform question is supplied for examination: catalog reachability currently uses lexical Path::starts_with, while Windows directory acquisition verifies identity without checking canonical spelling. Check ordinary case-only root/tree renames on case-insensitive filesystems and any effect on retained-resource or session-use protection. No Windows/macOS runtime witness or defect verdict is claimed for that question at this point.

### Cumulative diff review round 1

REVIEWED_THROUGH=9b8691f220bcda7fadfd371698435a64672d56bc. All eleven selected-executor read-only lenses completed. Measured elapsed through arbitration: 609.525 seconds. Six adopted witnesses identify five unique corrections. diff_adopted_per_round: r1=6. No Skip or Defer disposition. Plan authorship and arbitration shared one context. Detection ran on the same model family as the code, in separate Codex sessions.

- CR1 Fix, tests: connect the real production shutdown clear to durable marker removal and next-start collection. Generic callback tests do not prove that hook.
- CR2 Fix, minimalism: route all three SHA256 read loops through one bounded digest core.
- CR3 Fix, code-quality: document the recursive flag and process lifetime of catalog_uses.
- CR4 Fix, tauri-security and platform-semantics duplicate witnesses: supplement lexical ownership reachability with filesystem bindings before collection. The reported Windows case-only rename is source-derived. No Windows runtime witness is claimed. The same protection relation must govern retained owners, session use and prepublication recursive resources. Cleanup identity, no-follow and inventory authority remain unchanged.
- CR5 Fix, records: preserve historical d-20260918-02 prose while recording d-20261016-07, which retains its failure handling and follows d-20260918-18 for strict canonical spelling. The earlier combined decision now points to that clarification.

The root assigned CR1–CR4 to one sensitive write leaf because they share the native lifecycle module. Root handled CR5 only through the locked decisions writer. Closure review and complete release remain pending.

Raw lens reports follow unchanged.

Repair evidence for CR1–CR4 is committed as 1824eb56. The selected sensitive write leaf changed only catalog_install.rs, mod.rs and main.rs. The root inspected the complete diff and independently passed 42 catalog tests, 284 authority tests, 214 filesystem tests with one existing isolated-mount test ignored, and 39 shutdown tests. The sha256 selector matched zero tests, so hashing evidence is the actual staged_hash_core_cancels_between_real_read_chunks and activation tests within the authority suite. Shared hashing preserves the inventory byte cap and checked overflow accounting. Formatting and diff checks passed. Full checks:pre-review passed including Windows GNU compilation/clippy.

Source-only Git-derived reversals retained the new tests and compiled, then failed at the production durable marker assertion and all three Linux alias relation/use assertions. Exact restored source hashes matched, and the complete proof set passed after restoration. Initial fixture-attempt logs are retained but are not counted as regression proof. Windows case-only rename tests use actual filesystem behavior and remain pending hosted execution. Linux alias fixtures supply conservative retention evidence only, never cleanup authority. The bounded production shutdown wrapper owns the real clear callback and is shared by RunEvent and the durable integration test.

Complete repair logs, patches and hash manifests are indexed by /tmp/build-de5be974-c551-48bb-b87c-30caf1642a05/review-fix1-evidence.md. Independent root completion records are gate-review-fix1-proof.VrnPOD and gate-review-fix1-prereview.FKYWJU under this drain's gate directory. CR5 is recorded in e3b7d443 and 99581fe3. All five corrections await reviewer closure, with no unresolved implementation deviation reported. Plan authorship and arbitration shared one context. Detection ran on the same model family as the code.

#### Round 1 correctness

```text
No concrete correctness defects established.

Limitation (confidence: 75/100): case-only root renames remain unresolved. Catalog reachability compares lexical paths, while Windows opens accept case aliases. The source trace does not settle whether collection could miss retained ownership after rebinding. No Windows/macOS runtime witness was available.

Reviewed all seven production files and direct consumers. No files changed or tests run. Review used the code author’s model family.

VERDICT: APPROVED
```

### P4 integration review — CR11 and CR12

P4 initially completed its assigned durable-state work in two source files with 65 catalog, 284 authority, 214 filesystem tests plus one existing ignore, 39 shutdown and one inherited-directory child test green. Formatting and diff checks passed. Source-only serialization reversal reproduced three-session child-data loss. Shared-admission and pre-mutation-baseline reversals each admitted a new binding at 4098 instead of refusing at 4096. Exact restoration and green reruns are indexed in phase4-implementation-evidence.md. These are leaf proofs pending the final root proof and pre-review. No P4 source commit was made because integration review found further in-mandate gaps.

Two focused integration findings are adopted as CR11 Fix and CR12 Fix, separately from the completed cumulative diff-round counts. CR11 is an omitted eligibility consumer, not automatically attributed as created by durability. CR12 is a false-retention consequence of P4 durable use projection through the unchanged ambiguous file/context relation. Both were judged against an immutable source snapshot while P4 wrote, then a concrete correction was approved against a hash-verified completed-P4 snapshot. Twelve unique corrections total. CR1–CR8 remain closed, CR9/10 have initial local proof but await coherent P4 closure, and CR11/12 remain open. No Skip or Defer.

CR11 requires current startup eligibility to consult unresolved durable uses, because completed ancestor substitution can change recursive reachability after publication without changing deletion identities or inventory. CR12 separates object-only use from recursive directory scope and records an executable working-directory object independently. Complete native inventory identities can prove node disjointness without dropping real cwd use. The approved object-only cwd boundary follows exact O2 and does not grant every ambient ancestor recursive ownership. Decision d-20261016-11 records this. The observed 52-second capacity setup is replaced with one validated fixture candidate while preserving the actual API boundary and source-reversal witnesses. No new tool or limit is added.

This is P4 bounded integration repair1 by the same sensitive persistent leaf. The original 65-test report, JSONL, code and hashes remain preserved, and new evidence uses phase4-context1 names. These private mechanism checks are not new rounds in the inherited frozen-plan lineage. Plan authorship and arbitration shared one context. Detection ran on the same model family as code.

#### durable-use-eligibility-questions.md

```text
# Durable-use eligibility questions

P4 is implementing the approved durable bound-use collection. Its source is being edited by another leaf, so this judgment must use committed source 026ba3db through the supplied immutable snapshot, plus the immutable approved candidate mechanism-durable-prepublication-use.md. Do not inspect mutable source files. These are questions for examination, not measured defects or permission to expand the mandate.

Q2: does startup eligibility need to reevaluate every unresolved durable use, in addition to publication projecting matching sessions into per-install users? Consider an app-owned child A with an explicit recursive directory lease for /foo. A's unconfirmed exit leaves its use unresolved. B publishes a managed tree at /bar/root/version while /foo is unrelated, so publication legitimately finds no A membership. After B's clean exit, ordinary completed directory moves put the same root object R, with unchanged managed tree and inventory, under A's directory while restoring R's original pathname: move R aside, replace /bar with the original /foo directory object, move R back as /bar/root. The native recorded root R and tree identities, pathname and inventory remain unchanged. At C startup the old child can now read root/version through its retained directory descriptor. Its authority has retired. Publication-time derived markers did not contain A. The collector in committed code reads only per-install users, retained authority and process protection, not a global use collection. Would the frozen explicit-ancestor/filesystem-substitution contract require reevaluating durable bound uses through the shared relation at eligibility, or does an exact exclusion cover this same-profile native-child scenario? No continuous mutation during validation, independent execution or cross-profile sharing is involved.

Q3: can persisting all historical file uses cause unrelated future catalog trees to stay retained indefinitely? A leases a single NNUE file as a File resource, then exits unconfirmed. Its file pathname is later deleted or replaced, while its real file lease still identifies the original object. B publishes an unrelated new catalog tree whose complete managed inventory contains none of that file identity. The current relation treats the stale pathname as Uncertain. A durable collection could therefore project A into every future record and B cannot clear it. Ask whether complete native inventory plus nonrecursive object semantics can establish disjointness safely, rather than relying on the replacement pathname. Distinguish an explicit file resource from an executable's working-directory context and an explicit recursive directory. If existing metadata cannot distinguish necessary contexts, identify the smallest faithful bound-use representation or additional bound object, without another actor registry. Any negative classification must preserve actual native child use, cleaning refusal and the independent complete-inventory deletion boundary.

Judge these against frozen O2/D5 and the stated migration/independent-execution exclusions, not a desire to add features. If in scope, recommend the simplest shared predicate/consumer correction and exact behavior tests. If prevented or excluded, cite the specific producer or contract. No implementation or runtime proof is requested in this read-only judgment. The physical descriptor-survival premises have production regression witnesses, while these combinations remain source-derived until tested. CR9 and CR10's already approved durability/admission work remains valid. Plan authorship and arbitration shared one context. Detection uses the same model family as code.
```

#### probe-use-eligibility.txt

```text
All source citations below refer to the immutable `source-026ba3db/` snapshot.

[blocker] /tmp/build-de5be974-c551-48bb-b87c-30caf1642a05/mechanism-durable-prepublication-use.md:9 — Q2 exposes an eligibility consumer missing from the correction. Publication-time projection cannot cover relationships formed afterward. The collector checks per-install users, process protection and retained authorities, but never historical uses (`src-tauri/src/infra/path_authority/catalog_install.rs:606,613,617`). Completed ancestor substitution can leave the recorded root identity, pathname, tree and inventory unchanged, so deletion validation at `:645–689` does not reject the case. Linux children inherit directory descriptors (`mod.rs:1940`, `engine/process.rs:3775`), and the existing regression demonstrates access after directory rename and replacement (`engine/process.rs:6899–6918`). No producer prevents the proposed combination. Frozen O2 explicitly covers recursive ancestors and preserves reachability evidence until eligibility (`tasks/plans/2026-10-16-catalog-engine-retention.md:51,55,57`). Same-profile app-owned child use falls outside neither exclusion at `:23,96`. This extends CR10’s mechanism without invalidating its durability correction (confidence: 96).

Optimal: reevaluate unresolved durable bindings at startup eligibility through the shared relation → I recommend this correction. Publication projection remains useful derived evidence, but cannot be the sole consumer. Under authority serialization, any unresolved binding classified Member or Uncertain retains the installation. Only the originating session’s proven shutdown clears that binding.

The proof must publish while A’s directory is demonstrably unrelated, complete B’s successful clear, perform the completed ancestor substitution while restoring the recorded root pathname and identity, then reopen C and run trusted production reconciliation. Assert retention and actual child readability. The candidate’s current test at line 13 publishes beneath A’s directory immediately, so it cannot detect this omission.

[blocker] /tmp/build-de5be974-c551-48bb-b87c-30caf1642a05/mechanism-durable-prepublication-use.md:5 — Q3 exposes a false-retention consequence of persisting every use through the unchanged relation. A missing or replaced historical file pathname becomes Uncertain (`src-tauri/src/infra/path_authority/catalog_install.rs:240–244,257–261`), which protects every unrelated future record despite its inventory containing no such object. The newer session cannot clear A’s projected markers. An explicit File resource hands over one file descriptor (`mod.rs:6432–6442`), not recursive directory ownership. However, the proposed pathname/identity/recursion representation cannot distinguish that file-only use from executable context, because both currently receive `recursive=false` (`mod.rs:7829–7837`). Executables additionally establish their parent as the child’s working directory (`mod.rs:6736`, `engine/process.rs:3766`). Treating both identically either retains unrelated installations indefinitely or weakens executable protection (confidence: 95).

Optimal: represent object-only file use separately from recursive directory context → I recommend that distinction within the existing collection. For an explicit file, absence of its bound identity from the complete native managed inventory can establish disjointness from an unchanged deletion-eligible tree. Preserve actual membership detection, cleaning refusal and the independent complete-inventory deletion check (`catalog_install.rs:670–689`). Executable use must retain its working-directory context separately, using the validated parent binding available at `resolved.rs:147`, rather than applying file-only exclusion to it. Unprovable directory relationships remain Uncertain. Arbitrary filesystem permissions establish no additional ownership.

Proof must cover deleted and replaced file spellings across restart, verify that unrelated installations receive no A marker and remain collectible, and confirm the original leased file remains readable. Positive controls must preserve actual file membership, recursive-directory protection, executable working-directory protection and cleaning refusal.

Limitation: both combined scenarios remain source-derived, not runtime reproductions (confidence: 100). No writes, tests, gates, compilers or live queries ran. CR1–CR8 remain closed. CR9/CR10 implementation closure was not assessed. Review used the code’s model family.

VERDICT: REVISE
```

#### mechanism-use-context-and-eligibility.md

```text
# Use contexts and current eligibility correction

P4 source is complete but remains uncommitted. It passes 65 catalog tests and the requested native suites. Its final source hashes are phase4-source-hashes-final.json and its report is phase-4.txt. Focused immutable-source/candidate judgment identified two further in-mandate integration gaps, CR11 from Q2 and CR12 from Q3. CR9/CR10's durable-state implementation remains valid, but P4 cannot be committed until these consumers and semantics are corrected. CR1–CR8 stay closed.

CR11: under authority serialization, startup eligibility must consult all unresolved durable bound uses through the same reachability relation used by publication and handoff. Per-install user markers are conservative derived evidence, not the only liveness source. Relationships can form after publication through a completed ancestor substitution without changing the recorded root, managed tree identity, pathname or inventory. A matching Member or Uncertain originating-session use retains the tree. Only the original session can clear it after the existing shutdown proof. Do not add a watcher, timer, scan for processes or second journal. Preserve exact-root/no-follow/inventory deletion boundaries and the frozen external-mutation limits.

CR12: distinguish object-only use from explicitly recursive directory use within the existing collection. A false recursion flag means the bound object itself, a true flag includes directory contents. Use the recorded tree identity and complete native inventory identities as membership evidence for an object. Preserve current physical membership detection and cleaning refusal for user-added objects. If a known object-only identity is absent from that complete managed set, a missing or replaced old pathname alone cannot make it own unrelated managed objects. Negative object classification remains coupled to the independent deletion rule that any added or changed tree content prevents collection. Do not infer disjointness of an unprovable recursive directory.

An executable consumes both its image and its working-directory context. Capture the validated working-directory object separately from the retained parent descriptor, in addition to the terminal image identity. Record that directory as an object context that protects an install when the working directory is the tree or a descendant. This does not make a selected or ambient ancestor directory own every child installation. Explicit EngineResource directory reads retain recursive scope, determined from the actual successfully resolved terminal directory and resource-read operation, rather than substituting a root entry's shape for a child. If this object-context boundary conflicts with the frozen contract, identify the exact obligation before implementation. All contexts for one handoff enter the same atomic lifecycle candidate, preserving initial zero-install durability, retry, admission and originating sessions. No new registry or persistent schema category is required if the existing node/recursive representation suffices.

Required CR11 proof isolates the resource relationship from executable placement. A native child leases an explicit directory that is unrelated to the install at publication. Its executable/working directory must not accidentally protect that install. Retire its authority, publish, complete the newer session's successful clear, then perform completed ancestor substitution before the next startup. Keep the root's absolute pathname, object identity, immediate parent identity, tree identity and inventory unchanged, for example move an unchanged intermediate container beneath the leased ancestor while restoring its pathname. Assert no original-session derived marker existed before substitution, then actual child readability and retention after trusted startup eligibility. Always reap on red.

Required CR12 proof retains a real explicit file-resource lease across restart, deletes or replaces its old pathname, and publishes an unrelated managed tree. Assert no original-session marker is projected into that independent install, a newer clean clear cannot erase the old use evidence, the unrelated tree remains collectible, and the original file lease still reads its bytes. Positive controls preserve actual file members, explicit recursive ancestors, cleaning refusal and executable working-directory protection. The latter must not be masked by a separate directory-resource lease. A useful boundary is an actual image started from staging, its image removed before provenance inventory, and publication of the unchanged working-directory object as the managed tree. The child must retain readable relative managed data through reopen, despite its image identity being absent from the inventory.

The CR9 capacity test now measures about 52 seconds in the local focused/full catalog run because it durably writes every setup binding. Remove that observed recurring proof cost using one valid bounded registry candidate for fixture setup, then keep the actual production new-binding ResourceLimit, existing-binding usable-contents assertions and source-only admission/baseline reversal witnesses. Use existing private fixture/commit capabilities, no test framework, new tool or lowered limit. The behavioral bound, not thousands of redundant setup fsyncs, is the proof.

New regressions need compiled source-only red/green, tests intact and exact source restoration, then all native proofs and pre-review before committed-delta closure. This is P4's bounded integration repair under the same frozen O1–O4 contract. Plan authorship and arbitration shared one context. Detection uses the same model family as code.
```

#### probe-use-context-final.txt

```text
Source citations below refer exclusively to the hash-verified `source-phase4/` snapshot.

CR11 mechanism/proof specification CLOSED — `mechanism-use-context-and-eligibility.md:5,11` adds the missing eligibility consumer and isolates it from publication markers and executable placement. The current collector omits durable bindings at `catalog_install.rs:725–742`. The proposed substitution preserves deletion identities while changing recursive reachability, so the regression can detect that omission (confidence: 97).

CR12 mechanism/proof specification CLOSED — candidate `:7,9,13` distinguishes object membership from explicit recursive scope. Complete inventory identities support object disjointness, while physical membership still protects added objects and triggers cleaning refusal. Independent inventory validation remains necessary at `catalog_install.rs:789–808` (confidence: 96).

Object-only working-directory context satisfies exact O2 at `tasks/plans/2026-10-16-catalog-engine-retention.md:51`. Native launch sets the executable’s parent as cwd (`mod.rs:6743`, `engine/process.rs:3766`), and its validated identity is available from the retained parent (`resolved.rs:147`). Recording that directory separately covers the removed-image case. Neither cwd ancestry nor ordinary filesystem permissions establish explicit recursive resource ownership. No additional context mode is required by the supplied contract (confidence: 95).

CR9/CR10 dependent mechanism/proof specifications remain CLOSED — candidate `:9,15,17` preserves atomic multi-context durability, originating sessions, retry and admission. One valid setup candidate retains meaningful production overflow/reuse assertions and admission-baseline reversals. Existing lifecycle support is at `catalog_install.rs:516–605,699–709`. Cleaning refusal must continue to require confirmed membership, preserving `:572` (confidence: 97).

Limitation: this closes the correction design and proof specifications, not implementation or runtime verification. The frozen P4 snapshot predates these corrections. No writes, tests, gates, compilers or live queries ran. Windows/macOS runtime remains unverified here. Review used the code’s model family (confidence: 100).

VERDICT: APPROVED
```

### Continued round 4 arbitration — CR10

This continuation supersedes the initial round-4 adoption count and timing above. Q1 was confirmed by focused mandate/source judgment as an in-mandate CR10 Fix. The repeated CR9 observation in that judgment confirms the already adopted proof obligation and adds no new Fix. Final round-4 adoptions are 2, one capacity witness and one lifetime-boundary witness. diff_adopted_per_round: r1=6 r2=1 r3=3 r4=2. Round-4 elapsed through this completed continuation arbitration is 1595.622 seconds, including the focused judgment. The earlier 328.607-second initial snapshot remains historical evidence. Ten unique corrections total, CR1–CR8 closed, CR9 and CR10 open. No Skip or Defer.

CR10 is the missing durable use boundary before any install exists. General owner reconciliation preserves resource entries, but production attachment reconciliation can retire unowned resources into process-local retired_attachments, excluded from registry serialization. A later publisher therefore cannot recover earlier in-memory-only use. The frozen O2/D5 includes same-profile surviving children, explicit recursive ancestors and prepublication resources. This is not deliberate cross-profile sharing or independent manual execution. A concrete durable correction candidate was APPROVED before implementation, with three-session live-child proof and initial zero-install fault/retry coverage. Decision d-20261016-10 completes d-20261016-09 identity capture without reversing it.

The overlooked lifetime obligation is assigned as P4 to the same persistent sensitive Codex leaf, plus the dependent CR9 capacity proof. Existing bound-use evidence becomes durable and originating-session-owned in the same registry. No second journal, actor registry or ownership grant is introduced. These focused private-mechanism judgments are not additional rounds in the inherited frozen-plan lineage. Plan authorship and arbitration shared one context. Detection ran on the same model family as code.

#### lifetime-boundary-question.md

```text
# Prepublication interruption boundary for examination

Source 026ba3db, code 70688b60. Round 4 closed CR6–CR8 and found one at-capacity proof gap, CR9. This note raises a source-derived question, not a measured defect verdict or authority to expand the frozen mandate.

The frozen O2/D5 contract covers surviving children after an unconfirmed shutdown and resources resolved before provenance publication. Current catalog_uses is an in-memory map, reset by PathAuthority::open. Only CatalogInstall.users is persisted. Before any install exists, resolving an explicit recursive directory resource cannot add a session marker to an install record. EngineRuntime's kill_on_drop cannot help on process death, as process.rs:3771 explains, and Linux pre_exec only preserves descriptors, not a parent-death kill guarantee.

Candidate counterexample: session A hands the engine workspace directory to a real child as an explicit recursive resource while no catalog install is present. A stops unconfirmed before any install provenance exists. Child A can survive, still holding the directory. Session B opens the same registry, whose process-use map is empty, and trusted reconciliation may prune the now-unowned resource authority. B publishes a later catalog install under that directory, then cancels its save. B exits cleanly and clears only its own markers. Session C trusts its owner snapshot and collects the unowned new install. Does this delete underneath the earlier child despite O2, or does a specific frozen threat-model exclusion or actual lifecycle producer prevent this scenario?

Read actual plan wording and actual producers before judging. Do not assume every engine exits on stdin EOF, because D5 explicitly refuses restart as proof that children exited. No source claim that old processes can be safely guessed absent. Directory resources are explicit recursive ownership, distinct from arbitrary filesystem permissions or an incidental executable working directory. This is the same profile, no deliberate cross-profile/manual sharing of a managed install tree.

If this is within the frozen obligation, examine the simplest faithful correction: unresolved prepublication recursive-resource use must have durable bounded evidence before handoff even when there is no install record yet. Keep it in the existing registry, never a second journal or per-actor lease system, retain actual terminal binding and session, clear only the originating session after proven shutdown, and have future publication account for prior unresolved uses. Consider whether existing native authority state can hold that evidence without a second implementation of use ownership, and whether per-install markers can share a single mechanism. Do not write code or silently impose a new scope. Explain the minimum contract change and concrete proof needed, or identify the exact source/decision that makes the counterexample impossible or out of mandate.

CR9 remains an independent accepted test gap, do not lose it. Required future proof for this question, if in scope, would retain a real inherited directory lease across registry reopen BEFORE publication, then publish and perform a later trusted reopen after the newer session clears its own markers, with the original child still alive and reaped safely. No actual process abort is needed to model the durable-state boundary. Plan authorship and arbitration shared one context. Detection uses the same model family as code.
```

#### probe-lifetime-boundary.txt

```text
[blocker] tasks/plans/2026-10-16-catalog-engine-retention.md:55 — Q1 requires correction under existing O2/D5. Before any install exists, `protect_catalog_path` records use only in memory (`src-tauri/src/infra/path_authority/catalog_install.rs:455`). With no affected record, no durable marker is written. Reopen resets that map (`mod.rs:5152`), and publication consults only the new session’s map (`catalog_install.rs:544`). The counterexample is therefore not prevented (confidence: 97).

The precise retirement path is attachment reconciliation. General owner reconciliation preserves EngineResource entries (`mod.rs:2381`), but attachment reconciliation removes unowned resources into process-local `retired_attachments` (`mod.rs:7600`). Registry serialization excludes those retired entries (`mod.rs:8770`). Consequently, B can publish without A’s marker, exit cleanly, and leave C with neither A’s use evidence nor its resource authority. Collection then finds no protection (`catalog_install.rs:606`).

This is within the frozen mandate. Explicit recursive ancestors protect their contents at plan line 51, prepublication resources are expressly covered at line 55, and D5 rejects restart as child-death evidence at line 89. The exclusions at lines 23 and 96 concern independent/manual execution and deliberate cross-profile sharing. They do not exclude this same-profile application-owned child. Production shutdown permits exit after failed cleanup (`main.rs:2490`), and kill-on-drop explicitly provides no process-exit guarantee (`engine/process.rs:3771`).

Optimal: make the existing bound-use collection durable and session-owned → I recommend that mechanism. Preserve terminal identity, pathname, recursion and originating session independently of install existence. Reuse registry validation, byte/admission limits and atomic durability. Publication must account for every unresolved originating session through the shared reachability relation. Per-install markers can remain derived evidence, but marking and clearing must share one lifecycle implementation. Authority retirement must not erase use evidence. This corrects d-20261016-09’s cross-process assumption without expanding O1–O4.

Required proof must cross the missing boundary:

- Keep a real inherited-directory child alive, reopen **before publication**, retire its unowned resource through production attachment reconciliation, then publish.
- Complete B’s successful shutdown clear, reopen as C, reconcile trusted owners, and assert A’s session evidence and the child’s readable contents survive.
- Prove initial handoff refuses write failure or uncertain durability even with zero installs, including retry of the same binding.
- Demonstrate behavioral failure with only the correction reverted. Always reap the child before propagating test failure.

The existing child test publishes before reopening (`catalog_install.rs:1429`, `:1448`), so it cannot detect Q1.

[should-fix] tasks/plans/2026-10-16-catalog-engine-retention.md:77 — CR9 NOT CLOSED. The distinct-binding test asserts two entries and deduplication (`src-tauri/src/infra/path_authority/catalog_install.rs:1228`), but never exercises the overflow guard at line 461. Require actual at-capacity `engine_resource` refusal with `ResourceLimit`, plus successful existing-binding reuse (confidence: 99).

Limitation: the complete three-session counterexample remains source-derived, without runtime reproduction in this read-only check (confidence: 100). No writes, tests, gates or compilers ran. Review used the code’s model family. CR1–CR8 are not reopened.

VERDICT: REVISE
```

#### mechanism-durable-prepublication-use.md

```text
# Durable prepublication use correction

Last reviewed source 026ba3db, implementation 70688b60. Q1 was confirmed by focused mandate/source judgment as CR10 under existing O2/D5, not an extra product requirement. CR1–CR8 remain closed, CR9 admission proof and CR10 are open. The original candidate question and full judgment remain in the run evidence and will be preserved in the handoff. The precise escape is production attachment reconciliation retiring the old unowned EngineResource entry into process-local state that is not serialized.

Make the existing bounded bound-use collection durable and owned by originating session in the existing Registry. Keep pathname, actual terminal identity, recursion and originating session independently of install existence. The executor chooses the smallest private serializable shape, using the existing native path representation, validation, byte limits, admission and atomic commit. Preserve distinct bindings at reused spellings and deduplicate repeated use by the same session. Every binding and session marker is bounded. No second journal, actor registry, PID scan, TTL, public command or deletion authority is introduced.

Before returning any child-use resolution, its new or broadened binding must be durably recorded even with zero catalog install records. Capture terminal identity from the existing held descriptor or validated resolution as P3 does, never reopen the path. A write failure or uncertain durability refuses handoff. Repeating the same binding after such an error must retry durability, not trust an in-memory cached insertion. Already durable reuse can proceed without allocating a new binding. Keep use evidence through authority retirement, owner pruning and process restart. Legacy registries default to no prepublication use evidence, with existing per-install unresolved markers preserved conservatively. Malformed or oversized new evidence is refused rather than interpreted as absence.

Publication projects every matching unresolved originating session through the same historical-binding relation into the install's durable protection. A newer publisher must preserve session A's identity, never relabel A's use as B's. Existing per-install users can remain derived evidence for compatibility, but marking and clearing share one atomic lifecycle implementation so no separate journal or fractured commit appears. The use collection itself never claims ownership of arbitrary files and never permits deletion of a resource tree.

Only the originating session can clear its own durable scope uses and per-install markers, after the existing production shutdown wrapper proves sealed admission, drained work and reaped children. Clear both as one durable registry candidate. Newer session B's successful clear leaves A's unresolved use intact. Failed or uncertain clear retains conservative state and retry semantics. Preserve the deadline/cancellation behavior, confirmed cleaning refusal, unrelated-engine isolation, exact missing reservations, root locators, inventory/no-follow deletion checks and all existing admission ratchets.

CR10 proof uses a real inherited-directory child and three authority sessions. A leases an explicit recursive directory before any catalog provenance exists. Reopen B BEFORE publication, retire A's unowned resource with production attachment reconciliation, publish under that directory and finish B's own successful shutdown clear. Reopen C with trusted owners and assert A's durable session evidence plus the child's readable new contents survive. Always reap the child before propagating red assertions. Test write and parent-sync uncertainty on the initial handoff with zero installs, same-binding retry, failed/uncertain clear, owner retirement, legacy load, malformed evidence and capacity. A source-only reversal must compile and fail this missing-boundary behavior, with tests intact and exact restoration.

CR9 proof pre-registers valid handles, fills actual shared use admission to capacity, requires production engine_resource for a new binding to return ResourceLimit and proves an already durable binding remains reusable. The test asserts the behavioral bound, not reliance on one particular local guard. Do not weaken tests, limits or coverage. Root repeats native proofs and pre-review before committed-delta closure, then app proof, final gates, push, hosted jobs and installation.

This is a focused correction candidate for the existing frozen O1–O4 contract, not an extra inherited-plan round. A new native implementation phase is needed for the overlooked durability boundary. Plan authorship and arbitration shared one context. Detection uses the same model family as the code.
```

#### probe-durable-prepublication-use.txt

```text
CR10 mechanism CLOSED — `mechanism-durable-prepublication-use.md:5–11` addresses the actual escape: use is currently process-local (`catalog_install.rs:455`), reopen resets it (`mod.rs:5152`), and retired attachments are excluded from serialization (`mod.rs:8783`). Durable originating-session bindings, publication projection and atomic own-session clearing satisfy existing O2/D5 (`tasks/plans/2026-10-16-catalog-engine-retention.md:55,89`). Terminal identity capture remains valid at `mod.rs:7841`. No mandate expansion is required (confidence: 97).

CR10 proof specification CLOSED — candidate line 13 crosses the missing boundary with reopen before publication, production attachment retirement, B’s successful shutdown clear and C’s trusted reconciliation while A’s child remains readable. Initial zero-install persistence faults and same-binding retry cover the current no-write and cached-insertion hazards. The existing child test publishes before reopening (`catalog_install.rs:1429,1448`) (confidence: 98).

CR9 proof specification CLOSED — candidate line 15 requires actual shared admission capacity, production `engine_resource` refusal with `ResourceLimit`, and durable-binding reuse. This replaces the insufficient two-entry counting assertions at `catalog_install.rs:1228` with behavioral boundary proof (confidence: 99).

No additional mechanism defects found. Implementation closure remains pending against unchanged source `026ba3db`, including the required compiled source-only reversal. CR1–CR8 remain closed. Read-only review inspected the five supplied source paths, candidate, probe, plan, history and named rules. No writes, tests, gates or compilers ran. Windows/macOS runtime remains unverified. Review used the code’s model family.

VERDICT: APPROVED
```

### Cumulative diff review round 4

REVIEWED_THROUGH=026ba3dbe4f807485cd7d06503ff3a3ae7c2adf8. All eleven read-only lenses completed and every report was read. Elapsed through arbitration: 328.607 seconds. CR6–CR8 explicitly CLOSED. One adopted tests witness opens CR9, the missing at-capacity refusal/reuse assertion. diff_adopted_per_round: r1=6 r2=1 r3=3 r4=1. Nine unique corrections total, eight closed and CR9 open. No Skip or Defer. Plan authorship and arbitration shared one context. Detection ran on the same model family as code.

CR9 Fix: exercise actual ResourceLimit for a new binding at the session-use admission cap and successful reuse of an existing binding. Root also raised Q1 for examination, the interruption-before-first-provenance boundary. Q1 is not a measured defect or an accepted new requirement. A focused fresh-context mandate/source judgment will determine whether existing lifecycle evidence closes it or the frozen O2/D5 contract requires durable prepublication scope-use evidence. No source repair starts before that shared mechanism question is settled.

#### Round 4 correctness

```text
CR6 CLOSED — `catalog_install.rs:447` refuses cleaning access only for confirmed membership. Uncertainty still retains trees and durably marks child use.

CR7 CLOSED — `mod.rs:7841` captures terminal descriptor identity. Distinct historical bindings survive pathname reuse and feed publication protection at `catalog_install.rs:544`. Inspected reversal logs show six behavioral failures, followed by 58 passing catalog tests after restoration.

CR8 CLOSED — `catalog_install.rs:1371` asserts typed Conflict for an existing cleaning tree’s recursive ancestor. Its source reversal fails exactly that assertion.

CR4 remains CLOSED. Cleanup fixture changes correctly retire the stale selected workspace through native ownership APIs before testing collection.

No additional correctness defects found.

Limitation: read-only source and saved-evidence review. Windows/macOS runtime remains unverified (confidence: 100). Review and implementation share the same model family.

VERDICT: APPROVED
```

#### Round 4 root-cause

```text
CR6 CLOSED — uncertainty retains trees and durable use markers without refusing unrelated engines. Confirmed membership still blocks access to cleaning trees.

CR7 CLOSED — resolution captures terminal descriptor identity before handoff. Distinct historical bindings survive pathname reuse and feed both publication marking and retained-owner checks. Source-only reversal produced six behavioral failures, restoration passed all 58 catalog tests.

CR8 CLOSED — the production `engine_resource` regression asserts recursive-ancestor Conflict. Reversing that classification fails precisely this assertion.

Impacted CR1/CR4 fixes remain intact. The fixture changes correctly retire workspace ownership before testing cleanup. No root-cause or prior-fix regression findings.

Limitation: runtime evidence is Linux-only. Windows/macOS runtime remains pending (confidence: 100). Review used the same model family as the code in a separate session.

VERDICT: APPROVED
```

#### Round 4 tests

```text
CR6 CLOSED — unrelated-engine handoff, durable uncertainty markers and confirmed cleaning refusal retain concrete regression assertions.

CR7 CLOSED — historical-binding reversal compiled and failed six tests. Assertions cover durable markers, retained files after reopen and inherited-directory child access. Terminal-identity substitution separately fails the sibling-marker assertion.

CR8 CLOSED — the new production `engine_resource` assertion requires `Conflict` for a recursive ancestor of an existing cleaning tree. Its source-only reversal fails exactly that test.

[should-fix] src-tauri/src/infra/path_authority/catalog_install.rs:1228 — The distinct-binding admission test checks two entries and an internal count, but never reaches capacity. Removing the session-use overflow guard at line 461 would leave these assertions green and permit an additional unrecorded resource handoff beyond the bound. Add an at-capacity `engine_resource` assertion requiring `ResourceLimit`, while confirming an existing binding remains reusable. (confidence: 94)

Tests are reachable through the full backend gate. Hosted Windows/macOS runtime proof remains pending. Review was read-only and shares the code author’s model family.

VERDICT: APPROVED
```

#### Round 4 error-handling

```text
CR6 CLOSED — `catalog_install.rs:446` refuses cleaning access only for confirmed membership. Uncertainty retains protection and durable markers. Marker persistence failures propagate before handoff, preserving unrelated-engine isolation (confidence: 96).

CR7 CLOSED within this lens — `mod.rs:7841` captures terminal descriptor identity. Historical bindings reach publication’s durable marker commit, and write or durability failures refuse publication or handoff. Inspected source-reversal logs show six failures, followed by 58 passing catalog tests after restoration (confidence: 95).

CR8 CLOSED — the recursive-ancestor regression requires production `engine_resource` to return typed `Conflict`. Weakening membership to uncertainty produces exactly that assertion failure in the supplied reversal log (confidence: 98).

No additional error-handling defects found.

Limitation: read-only source and supplied Linux evidence review. No checks executed or files changed. Windows/macOS runtime verification remains pending (confidence: 100). Reviewer and code authors share the Codex model family.

VERDICT: APPROVED
```

#### Round 4 minimalism

```text
CR2 CLOSED — all three hashing callers still use `sha256_read_core`, preserving cancellation, observers and inventory limits.

CR6 CLOSED — cleaning refusal still requires confirmed membership. Uncertainty retains trees and persists session markers through the shared relation.

No new bloat or duplication defects found. Historical bindings extend the existing bounded map, and retained owners, handoffs and publication share one reachability implementation. The correction tests exercise distinct cases.

Minimum-diff counterfactual: no implementation file was added this round. Inlining the cumulative catalog module would relocate required lifecycle code without removing required behavior.

Read-only source review. No files changed or tests run. Reviewer and code author share the Codex model family in separate sessions. Platform runtime proof remains pending.

VERDICT: APPROVED
```

#### Round 4 code-quality

```text
CR3 CLOSED — `mod.rs:4365` documents the session-use map’s lifetime, terminal identity key and recursive flag, matching its consumers (confidence: 99).

CR6 CLOSED within this lens — `catalog_install.rs:123,443` clearly distinguishes confirmed membership from uncertainty. Cleaning refusal uses `Member`, while retention and durable markers use `protects()` consistently (confidence: 97).

No additional readability or local-consistency defects found in the correction and affected consumers.

Read-only review. No files changed or tests run. Reviewer and code author share the Codex model family.

VERDICT: APPROVED
```

#### Round 4 engine-protocol

```text
CR6 CLOSED — `catalog_install.rs:446` refuses cleaning-tree access only for confirmed membership. Uncertainty still retains trees and requires durable session markers without blocking unrelated engines.

CR7 CLOSED — `mod.rs:7838` captures the validated terminal descriptor identity before handoff. `catalog_install.rs:460` retains distinct historical bindings, and `:544` checks them before durable publication. Renaming a leased directory and recreating its old pathname no longer loses protection. Inspected source-reversal logs show six behavioral failures, followed by 58 passing catalog tests after restoration.

CR8 CLOSED — `catalog_install.rs:1371` exercises the actual `engine_resource` recursive-ancestor Conflict path. The supplied classification reversal produces exactly that assertion failure.

No additional confirmed engine supervision, UCI state-machine or result-routing defects found. Shutdown marker clearing remains conditional on successful operation drain and engine/game teardown. The fixture changes retire the selected workspace through native APIs before testing cleanup eligibility.

Read-only source and saved-evidence review. No files changed or tests run. Windows/macOS runtime remains unverified. Reviewer and implementation share the Codex model family, with no family separation. Plan authorship and arbitration shared one context.

VERDICT: APPROVED
```

#### Round 4 ipc-contract

```text
CR6 CLOSED within this lens — `catalog_install.rs:445` refuses cleaning access only for confirmed membership. Uncertainty retains protection and durable session markers.

No IPC-contract defects found. Rust signatures, generated invoke keys and renderer callers agree. Progress remains registered, correlated and percentage-based. No new public command, event, binding edit or capability scope.

Read-only review. No files changed or tests run. Reviewer and code share the same model family in separate sessions. Windows/macOS runtime verification remains pending.

VERDICT: APPROVED
```

#### Round 4 tauri-security

```text
CR6 CLOSED — `catalog_install.rs:446` refuses cleaning only for confirmed membership. Uncertainty retains protection and requires durable session markers before handoff, preserving unrelated-engine isolation.

CR7 CLOSED — `mod.rs:7842` captures terminal descriptor identity. `catalog_install.rs:460` retains distinct historical bindings, and `:544` uses them before publication. Inspected source-reversal logs show six behavioral failures, including missing durable markers and deletion of a retained tree. Restoration passes all 58 catalog tests.

CR8 CLOSED — `catalog_install.rs:1371` asserts typed `Conflict` through actual ancestor-directory `engine_resource` resolution. Replacing confirmed recursive membership with uncertainty produces exactly this failure, with 57 tests passing.

Prior CR4 closure remains intact. Retention uses filesystem identity, while deletion separately requires the recorded root, no-follow tree identity and matching inventory.

No additional in-scope security defects found.

Limitations: read-only review, no files changed or tests executed. Windows/macOS runtime proof remains pending. Credential/session storage is unchanged, and no refresh-token flow is introduced. Review and code share the same model family.

VERDICT: APPROVED
```

#### Round 4 platform-semantics

```text
CR4 CLOSED — filesystem identity and ancestor checks preserve alias reachability across retained owners, session uses and publication.

CR6 CLOSED — cleaning refusal requires confirmed membership. Uncertainty preserves retention and durable markers without refusing unrelated engines.

CR7 CLOSED — terminal identity is captured before handoff at `mod.rs:7838`. Distinct historical bindings survive pathname replacement. Supplied source-only reversal produced six behavioral failures, restoration passed all 58 catalog tests.

CR8 CLOSED — `catalog_install.rs:1371` asserts actual recursive-ancestor `engine_resource` refusal. Supplied classification reversal failed only that assertion.

No additional platform defects established. The workspace-retirement fixture changes preserve historical ownership semantics.

Proof limits: supplied Windows GNU compilation/clippy passed. Windows/macOS runtime remains pending in `rust-windows-test` and `rust-macos-test`. `rust-platform` supplies compile/lint evidence only. No non-Linux Unix source-probe result was supplied.

Read-only review, no files changed or checks run. Reviewer and implementation share the Codex model family.

VERDICT: APPROVED
```

#### Round 4 records

```text
CR5 CLOSED — d-20260918-02 points to d-20261016-07. Historical prose is preserved, and the clarification matches current canonical-spelling behavior.

CR6 CLOSED within this lens — source and saved evidence support uncertainty retention, durable markers and confirmed-membership cleaning refusal. The fixture workspace transitions preserve the original cleanup assertions.

CR7 CLOSED within records scope — historical binding, terminal identity and inherited-child claims match source, reversal logs and restored hashes.

CR8 CLOSED within records scope — the production recursive-ancestor Conflict assertion exists. Its source-only reversal produced exactly one failure with 57 catalog tests passing.

No records findings. All eleven copied round-3 reports match their originals. Root completion records support the stated test counts and pre-review success.

Unverifiable: historical timings without original timing records. Windows/macOS runtime, real-app verification and final gates remain pending as recorded.

Read-only review. No writes, tests, gates or live queries performed. Review and implementation share the same model family.

VERDICT: APPROVED
```

### Focused historical-use judgment and P3 assignment

The root paused another source patch and obtained focused fresh-context review-plan judgment for the repeated relation mechanism. The candidate was APPROVED with explicit warnings about actual terminal descriptor identity and stale pathname replacements. Decision d-20261016-09 records the correction. The overlooked O2 historical-binding obligation is assigned as P3 to the same persistent sensitive write leaf. CR8 joins its proof because it exercises the same relation. These are private implementation obligations under the frozen plan, not a new product requirement or a new inherited-plan review round. Plan authorship and arbitration shared one context. Detection ran on the same model family as the code.

#### mechanism-historical-use.md

```text
# Historical resource binding correction

Source revision 540f3a23, last cumulative review round 3. CR1–CR5 remain closed. CR6 failure isolation works, but its closure depends on a newly evidenced historical-use gap, CR7. Root-cause and engine-protocol supplied duplicate blocker witnesses. CR8 is the tests lens's missing cleaning recursive-ancestor assertion. Frozen O1–O4 and d-20261016-08 remain the behavioral authority.

CR7: resolve successfully leases directory /engines, which a child can access through its inherited descriptor on Linux. The directory moves to /moved and an independent replacement occupies /engines. A later install publishes under /moved. catalog_uses currently stores only /engines plus recursive=true, so prepublication re-resolves the replacement and concludes Disjoint. No durable marker protects the new install, although the original directory lease can reach it. Failed shutdown followed by trusted restart could delete beneath that child. Existing engine_resource_leases_pin_files_and_directories and spawned_engine_reads_a_directory_resource_through_the_authorized_value establish the actual lease model. The reported combined scenario is source-derived until the regression runs.

Proposed simplest correction enriches the existing bounded in-memory catalog_uses entry with the identity bound by successful resource resolution. Capture it from the validated authority entry or held descriptor before handoff, never by reopening a pathname after proof. Retain all distinct bindings when the same pathname is used for successive independent objects in one session, with every binding counted under existing admission. Recursion remains part of that use. No actor leases, second registry, persistence format or process scans. Durable per-install session markers remain the cross-process evidence.

Use the shared relation for retained authority bindings and session uses. When known historical identity exists, it participates in physical membership and disjointness. Match a recursive resource identity against actual target ancestor identities, including the target's verified parent before publication. If its current pathname is missing or resolves to another identity, that replacement cannot establish disjointness of the original use. Preserve uncertainty unless positive actual binding evidence establishes membership or disjointness. Do not convert such uncertainty into cleaning refusal. Preserve CR6's identity-distinct replacements, exact absent cleaning reservation, unrelated engine isolation, marker persistence refusal and all deletion boundaries. No unchecked pathname becomes deletion authority.

Proof must use real directory leases, rename and recreation at the old pathname, then install under the moved directory. Assert marker durability and reopen retention after unconfirmed shutdown while that lease remains usable. Where existing process fixtures permit, carry the real resource into a native child rather than a pathname-only stand-in. Add a repeated use at the same spelling with different identity and prove both historical bindings remain protected and admitted. Exercise persistence failure before handoff. Keep existing alias, unavailable-path, clean shutdown and retry proofs. Linux supplies local descriptor behavior, Windows/macOS retain hosted runtime limits.

CR8 adds a production engine_resource assertion for an explicit recursive ancestor of an existing cleaning tree, requiring typed Conflict. A source-only mutation of the positive recursive-ancestor classification to uncertainty must make that new assertion fail. Both CR7 and CR8 need compiled behavioral red/green with only source reverted, test code intact, exact source restoration and the complete native proof afterward.

This is focused fresh-context judgment under policy 4a for a repeated relation mechanism, before another patch. Judge the simplest faithful bounded-use representation and unsafe inferences against actual callers. It is not a new product requirement or a new frozen-plan lineage. Plan authorship and arbitration shared one context. Detection uses the same model family as the code.
```

#### probe-historical-use.txt

```text
Optimal: retain distinct `(pathname, resolved identity, recursive)` uses in the existing bounded collection → I recommend this mechanism. Count each retained binding toward admission. The candidate at `mechanism-historical-use.md:7–9` addresses the pathname-only gap at `src-tauri/src/infra/path_authority/catalog_install.rs:428,503` without another registry or actor leases.

No concrete defect found in the proposed mechanism. Its proofs at `mechanism-historical-use.md:11–13` cover durable historical-use protection and CR8’s missing recursive-ancestor refusal.

Unsafe inferences to avoid:

- A replacement at the old pathname cannot establish disjointness of the original leased object. The existing lease regression demonstrates that distinction at `src-tauri/src/infra/path_authority/mod.rs:14959`.
- A stored root identity is not necessarily the resolved terminal identity when components are supplied. Capture the terminal binding from the retained descriptor in that case. Resolution supports component traversal at `src-tauri/src/infra/path_authority/resolved.rs:817`.
- Uncertainty must retain and mark use without triggering cleaning refusal. Preserve the confirmed-membership guard at `src-tauri/src/infra/path_authority/catalog_install.rs:412`.

Limitation: this approves the mechanism only. CR6–CR8 remain open pending implementation and behavioral proof against `540f3a23`. No files changed, tests, gates or compilers ran. Windows/macOS runtime remains unverified (confidence: 100). Review and code share the same model family.

VERDICT: APPROVED
```

### P3 implementation and root proof

The same persistent sensitive Codex leaf implemented the approved bound-use mechanism in mod.rs and catalog_install.rs. Root inspected the complete diff. Resolution captures terminal identity from the retained descriptor or validated Unix observed identity before handoff. Existing session-use keys retain pathname plus both identity parts, deduplicate the same binding, preserve recursive reachability and count every distinct binding under existing admission. All child uses are tracked, including file resources before provenance. Retained authority entries and prepublication uses supply their historical identity to the shared three-way relation. No persistent schema, actor lease registry or new public API was added.

Eight new tests include actual Linux directory leases after rename/replacement, repeated bindings and admission, terminal child-component identity, file-resource use before publication, retained historical authority, marker write/sync failure, recursive-ancestor cleaning refusal and a real inherited-resource UCI child. The child reads the managed network through its inherited descriptor before and after trusted registry reopen. It is always reaped before worker failures propagate. This is native EngineActor/EngineSupervisor proof, not a browser game-completion claim.

Red-first compiled with six behavioral failures and two passing controls. An initial stale-capability fixture refusal is retained separately and not counted as regression evidence. The first full implementation run passed 56 tests and failed two locator fixtures. Their native selected-workspace transition now releases the stale historical selection before asserting cleanup, preserving all existing locator, retry, foreign-content and deletion assertions. This follows historical-binding retention rather than weakening it.

Three source-only Git-derived reversals retained all tests and compiled. Historical-use reversal failed six cases, recursive-ancestor weakening failed exactly the new cleaning refusal with 57 other catalog tests green, and substituting root identity for terminal identity failed its component regression. Exact source and complete test-module hashes were restored after each reversal. Complete evidence, variants, patches and logs are in /tmp/build-de5be974-c551-48bb-b87c-30caf1642a05/phase3-evidence.md.

Root independently passed 58 catalog tests, 284 authority tests, 214 filesystem tests with one existing isolated-namespace test ignored, 39 shutdown tests and the existing inherited-directory child test. Formatting and global diff checks passed. Full checks:pre-review passed including Windows GNU compilation/clippy. Canonical root completion records are gate-p3-proof.0dT4ao and gate-p3-prereview.swCoVY. Windows/macOS runtime remains hosted proof. CR6–CR8 await cumulative closure. Plan authorship and arbitration shared one context. Detection ran on the same model family as the code.

### Cumulative diff review round 3

REVIEWED_THROUGH=540f3a23b502e7474dcc9941a8428d473d79076e. All eleven read-only lenses completed and all reports were read. Elapsed through arbitration: 275.002 seconds. Three adopted witnesses identify two new corrections. diff_adopted_per_round: r1=6 r2=1 r3=3. Eight unique corrections total. CR1–CR5 closed. CR6 closure remains open through CR7, plus CR8 open. No Skip or Defer. Plan authorship and arbitration shared one context. Detection ran on the same model family as code.

CR7 Fix, duplicate root-cause and engine-protocol witnesses: historical resource use stores a pathname without the leased object identity. Moving the directory and recreating its pathname can hide use from prepublication marking. This is a newly evidenced original lifetime obligation omission, not automatically attributed as created by the latest correction. CR8 Fix, tests: add actual recursive-ancestor cleaning refusal coverage. CR6 failure isolation itself is supported by the other closure reports, but the whole lifetime relation remains unclosed. A focused mechanism judgment precedes another patch.

#### Round 3 correctness

```text
CR6 CLOSED — uncertainty preserves retention and durable session markers without triggering cleaning refusal. Identity-confirmed moved descendants and exact missing reservations remain refused. Source and supplied red/green evidence support closure (confidence: 96).

No correctness defects found in the correction delta.

Limitation: Windows/macOS runtime remains unverified here (confidence: 100). Review and code share the same model family. No files changed or tests run.

VERDICT: APPROVED
```

#### Round 3 root-cause

```text
CR6 NOT CLOSED — the unrelated-engine refusal is corrected, but prepublication resource protection still loses historical identity.

[blocker] src-tauri/src/infra/path_authority/catalog_install.rs:503 — A previously leased directory is tracked only by pathname in `catalog_uses`. On Linux, lease the engine root as a recursive resource, rename it, recreate an independent directory at its old pathname, then publish an install under the moved root. `filesystem_reaches` resolves the replacement directory and returns `Disjoint` at line 238, so publication omits the session marker. After an interrupted process and trusted restart, collection can delete that installation while the surviving child still accesses the moved directory through its inherited descriptor. The existing `engine_resource_leases_pin_files_and_directories` test establishes that leases survive this rename-and-replacement scenario. The new prepublication regression covers an absent old pathname, leaving this replacement case uncovered. The underlying cause remains pathname-only tracking of prior resource use (confidence: 93).

Inspected reversal logs confirm six behavioral failures and restoration to 50 passing catalog tests. Limitation: this additional combined scenario was source-traced, not executed under the read-only assignment. Windows/macOS runtime proof remains pending. Review shares the code author’s model family.

VERDICT: REVISE
```

#### Round 3 tests

```text
CR6 CLOSED — the unrelated-engine handoff regression has a concrete failing assertion and compiled source-revert evidence.

[should-fix] src-tauri/src/infra/path_authority/catalog_install.rs:958 — Cleaning refusal lacks a recursive-ancestor assertion. This test selects the managed tree itself. Changing the existing-tree recursive-ancestor result from `Member` to `Uncertain` would preserve existing retention/marker assertions while allowing an ancestor resource handoff over a cleaning tree. Add a production `engine_resource` assertion requiring `Conflict` for that case. (confidence: 94)

Review was read-only and same-family. Hosted Windows/macOS runtime proof remains pending.

VERDICT: APPROVED
```

#### Round 3 error-handling

```text
CR6 CLOSED — uncertain reachability preserves retention and durable session markers without triggering cleaning refusal. Marker write failures and uncertain durability propagate before handoff. Confirmed moved descendants and exact missing reservations still return typed Conflict errors. Source tracing and supplied regression logs support closure (confidence: 95).

No additional error-handling defects found.

Limitation: inspected Linux proof only. Windows/macOS runtime verification remains pending (confidence: 100). Review and code share the same model family.

VERDICT: APPROVED
```

#### Round 3 minimalism

```text
CR6 CLOSED — confirmed membership alone triggers cleaning refusal. Uncertainty still preserves retention and durable session markers through the shared relation.

No bloat or duplication defects found. The catalog module owns required lifecycle behavior and reuses existing registry, hashing and removal primitives. Inlining it would move code without removing required work. The correction tests cover distinct failure cases.

Review was read-only. Same model family as the code author, in a separate session. Platform runtime verification remains outside this review.

VERDICT: APPROVED
```

#### Round 3 code-quality

```text
CR6 CLOSED for this lens — `Reachability` clearly separates confirmed membership from uncertainty. Cleanup refusal checks `Member`, while retention and durable-use consumers consistently call `protects()` (`catalog_install.rs:123,414,504,580`). Regression names and comments match their scenarios (confidence: 96).

No readability or local-consistency defects found.

Limitation: source and supplied evidence review only. No runtime checks performed (confidence: 100). Review and code share the same model family.

VERDICT: APPROVED
```

#### Round 3 engine-protocol

```text
CR6 NOT CLOSED — prepublication protection can still lose the identity of a directory already handed to a live engine.

[blocker] src-tauri/src/infra/path_authority/catalog_install.rs:234 — Session uses retain only pathname plus recursion (`:428`). On Linux, start an engine with directory resource `/engines`, rename that directory to `/moved`, recreate an independent `/engines`, then select `/moved` as the engine workspace and publish a catalog tree there. The child still accesses the original directory through its retained descriptor (`mod.rs:1585`, existing process test at `process.rs:6855`). Prepublication lookup at `:503` instead resolves the replacement `/engines`, classifies it Disjoint here, and publishes without the session marker. After interrupted or failed shutdown, trusted restart can delete the unowned tree beneath the surviving child’s resource directory. The new prepublication regression covers a missing original pathname, but misses its replacement by another directory (confidence: 94).

Source-derived finding. No writes or runtime commands performed. Review and implementation share the same model family.

VERDICT: REVISE
```

#### Round 3 ipc-contract

```text
CR6 CLOSED within this lens — cleaning refusal requires confirmed membership. Uncertainty retains protection and durable session markers without refusing unrelated engines.

No IPC-contract defects found. Rust command parameters, generated invoke keys and renderer callers agree. Progress remains registered, correlated and percentage-based. No new public cleanup command, event or capability scope appears.

Read-only review. Supplied regression logs were inspected, not rerun. Windows/macOS runtime verification remains pending. Review used the same model family as the code, in a separate session.

VERDICT: APPROVED
```

#### Round 3 tauri-security

```text
CR6 CLOSED — `src-tauri/src/infra/path_authority/catalog_install.rs:412` refuses cleaning only for confirmed membership. Uncertainty still protects retention and persists session-use markers before handoff. Publication and collection share that relation, while deletion retains separate no-follow identity and inventory checks.

Inspected regression evidence shows source-only reversal failed six cases and restoration passed all 50 catalog tests. No additional in-scope security defects found.

Limitations: read-only review, no tests executed. Windows/macOS runtime proof remains pending. Review and code share the same model family.

VERDICT: APPROVED
```

#### Round 3 platform-semantics

```text
CR6 CLOSED — `catalog_install.rs:413` refuses cleaning-tree access only for confirmed membership. Uncertainty still protects retention and requires durable session markers. Ancestor identity checks recognize moved descendants before consulting unavailable or substituted locators. Supplied source-reversal evidence shows six behavioral failures, followed by 50 passing catalog tests after restoration.

No additional platform defects established.

Proof limits: supplied pre-review evidence reports Windows GNU compilation/clippy passed through `pnpm rust:windows:check`. Windows/macOS runtime remains pending in `rust-windows-test` and `rust-macos-test`. `rust-platform` provides compilation/lint evidence only. No non-Linux Unix source-probe result was supplied.

Read-only review across the seven named source files and connected consumers. No files changed or checks run. Reviewer and implementation share the Codex model family.

VERDICT: APPROVED
```

#### Round 3 records

```text
CR6 CLOSED — source and saved evidence support uncertainty retention, durable markers, identity-based refusal and unrelated-engine isolation.

No records findings.

Unverifiable: historical timings without original timing records. Windows/macOS runtime proof remains pending as recorded. Read-only review, no writes or tests. Reviewer and implementation share the same model family.

VERDICT: APPROVED
```

### Focused CR6 mechanism judgment

Before another source patch, the root requested focused fresh-context review-plan judgment under push-review-policy 4a. The first candidate had two gaps, identity disambiguation of replacement roots/trees and explicit durable-marker proof for uncertainty. The revised candidate closed both gaps and was APPROVED. These are private correction-mechanism checks, not additional rounds in the inherited frozen-plan lineage. CR6 implementation closure remains pending. Decision d-20261016-08 records the distinction between uncertainty retention and confirmed cleaning membership, with rejected alternatives and reversal evidence. No runtime behavior is inferred from these read-only judgments. Plan authorship and arbitration shared one context. Detection ran on the same model family as the code.

#### mechanism-cr6-v1.md

```text
# CR6 mechanism correction

Current revision is 1bb27a0b, with code repair in 1824eb56. The frozen O1–O4 plan remains tasks/plans/2026-10-16-catalog-engine-retention.md. CR1–CR5 were closed by round 2. Its error-handling lens found a correction-created defect in CR4's uncertainty handling.

The shared reaches boolean currently maps any filesystem binding error to true. This correctly retains uncertain trees during collection, but protect_catalog_path also interprets true as positive tree membership and refuses every matched cleaning record. Moving or disconnecting one cleaning root therefore prevents resolution of an independently installed engine elsewhere. The source path is resolve to protect_catalog_path to its cleaning guard. No runtime reproduction is claimed yet.

Proposed correction keeps the shared filesystem binding relation but represents confirmed reachability, confirmed disjointness and uncertainty separately. Collection treats uncertainty as retention. Session protection and durable use markers conservatively include uncertainty, preserving before-handoff durability. Cleaning adoption refusal requires positive membership evidence instead of a failed lookup of some other tree. For direct executable or resource descendants whose provenance locator is no longer reachable, compare the record's already known directory identity with the successfully acquired path's actual ancestor identities to confirm membership. Preserve the recorded root locator, no-follow cleanup and full inventory checks. Do not infer absence from canonicalization failure or use global case folding. No new registry, timer or actor lease.

The private helper arrangement remains an implementation detail. The behavioral boundary is that one unavailable cleaning root cannot prevent unrelated engine resolution, yet actual cleaning-tree adoption remains refused under lexical and filesystem-alias relationships, including a moved tree where its identity can be proven. Uncertain trees remain retained and successful child handoff still requires durable conservative use evidence.

Required proof adds an actual missing or renamed cleaning root alongside an independently installed executable, verifies successful unrelated resolution and preserved cleaning provenance, and verifies actual moved or aliased cleaning descendants remain refused. Existing retained, session, prepublication alias, retry, admission, modified partial-tree and shutdown tests remain green. New regressions must fail behaviorally with only their source fix removed. Windows/macOS runtime remains hosted proof.

This is a focused mechanism judgment required by push-review-policy 4a before another patch. It is not a new product requirement, a new build lineage or a repetition of settled plan review. Recommend the simplest faithful representation against the actual consumers, and identify any missing obligation or unsafe inference before writing resumes. Plan authorship and arbitration shared one context. Detection uses the same model family as the code.
```

#### probe-cr6-mechanism.txt

```text
Optimal: one relation that preserves confirmed membership, disjointness and uncertainty → I recommend that mechanism, with conservative retention/use marking and cleaning refusal based on confirmed membership. Two gaps remain.

[blocker] /tmp/build-de5be974-c551-48bb-b87c-30caf1642a05/mechanism-cr6.md:9 — CR6’s isolation boundary conflicts with treating lexical containment as confirmed membership. Rename a cleaning root, recreate its old pathname as an independent root, then resolve an executable under the same destination spelling. `catalog_install.rs:123` still matches lexically, and `:355` refuses it despite the different root identity. The existing replacement-root case at `src-tauri/src/infra/path_authority/catalog_install.rs:1282` establishes that identical spellings can represent independent installations. Require identity evidence to distinguish this replacement for cleaning refusal while retaining the original provenance. The proposed fallback only addresses unreachable locators, missing this reachable substitute (confidence: 92).

[blocker] /tmp/build-de5be974-c551-48bb-b87c-30caf1642a05/mechanism-cr6.md:11 — The proposed proof does not establish conservative durable use on the new uncertainty branch. Unrelated resolution and preserved provenance can pass even if uncertain records receive no session marker. Existing marker-failure coverage at `src-tauri/src/infra/path_authority/catalog_install.rs:1178` uses a reachable managed tree, while uncertainty coverage at `:1027` only asserts a boolean. Require behavioral proof that uncertain membership persists a durable marker before handoff, refuses handoff on persistence failure, and survives reopen. Otherwise the obligation at candidate line 7 can be broken with the stated tests green (confidence: 96).

Unsafe inference: `filesystem_reaches(...).is_ok_and(true)` would not establish positive membership. `src-tauri/src/infra/path_authority/catalog_install.rs:179` returns `true` conservatively for two missing leaves sharing a parent binding. That outcome must remain uncertainty.

Limitation: source-derived judgment at `1bb27a0b`, without runtime reproduction or Windows/macOS execution (confidence: 100). No writes, tests, gates or compilers ran. Review and code share the same model family.

VERDICT: REVISE
```

#### mechanism-cr6-v2.diff

Exact candidate delta retained at /tmp/build-de5be974-c551-48bb-b87c-30caf1642a05/mechanism-cr6-v2.diff, SHA256 534722ea5612999ee596db183c106d54e61a8ef9de49b0982f7d10c534e81b82. The full before/after candidates are preserved above and below. The patch is referenced rather than embedded because its blank context lines carry a space that the repository diff check rejects.

#### mechanism-cr6.md

```text
# CR6 mechanism correction

Current revision is 1bb27a0b, with code repair in 1824eb56. The frozen O1–O4 plan remains tasks/plans/2026-10-16-catalog-engine-retention.md. CR1–CR5 were closed by round 2. Its error-handling lens found a correction-created defect in CR4's uncertainty handling.

The shared reaches boolean currently maps any filesystem binding error to true. This correctly retains uncertain trees during collection, but protect_catalog_path also interprets true as positive tree membership and refuses every matched cleaning record. Moving or disconnecting one cleaning root therefore prevents resolution of an independently installed engine elsewhere. The source path is resolve to protect_catalog_path to its cleaning guard. No runtime reproduction is claimed yet.

Proposed correction keeps the shared filesystem binding relation but represents confirmed reachability, confirmed disjointness and uncertainty separately. Collection treats uncertainty as retention. Session protection and durable use markers conservatively include uncertainty, preserving before-handoff durability. Cleaning adoption refusal requires positive membership evidence instead of a failed lookup of some other tree. For direct executable or resource descendants whose provenance locator is no longer reachable, compare the record's already known directory identity with the successfully acquired path's actual ancestor identities to confirm membership. Preserve the recorded root locator, no-follow cleanup and full inventory checks. Do not infer absence from canonicalization failure or use global case folding. No new registry, timer or actor lease.

The private helper arrangement remains an implementation detail. The behavioral boundary is that one unavailable cleaning root cannot prevent unrelated engine resolution, yet actual cleaning-tree adoption remains refused under identity-confirmed lexical and filesystem-alias relationships, including a moved tree where its identity can be proven. Lexical containment alone is never confirmed physical membership for the cleaning guard. A replacement root or tree at the identical spelling is an independent binding, distinguished from the recorded root and tree identities. Preserve the predecessor's exact provenance. Where the target is absent, the same verified root identity plus exact recorded destination binding still identifies its pending cleaning reservation and refuses its premature reuse. Different missing leaf spellings under the same parent remain uncertain, never confirmed aliases. Uncertain trees remain retained and successful child handoff still requires durable conservative use evidence.

Required proof adds an actual missing or renamed cleaning root alongside an independently installed executable, verifies successful unrelated resolution and preserved cleaning provenance, and verifies actual moved or aliased cleaning descendants remain refused. Cover an independent replacement root and replacement tree at the old spelling, plus a genuinely missing cleaning target under its original verified root. Explicitly prove that uncertainty durably marks current session use before handoff, survives registry reopen and refuses handoff when marker persistence fails. Two absent different leaves under a shared parent must not become a positive cleaning match. Existing retained, session, prepublication alias, retry, admission, modified partial-tree and shutdown tests remain green. New regressions must fail behaviorally with only their source fix removed. Windows/macOS runtime remains hosted proof.

This is a focused mechanism judgment required by push-review-policy 4a before another patch. It is not a new product requirement, a new build lineage or a repetition of settled plan review. Recommend the simplest faithful representation against the actual consumers, and identify any missing obligation or unsafe inference before writing resumes. Plan authorship and arbitration shared one context. Detection uses the same model family as the code.
```

#### probe-cr6-mechanism-v2.txt

```text
CR6 replacement-binding gap CLOSED in the final candidate — `mechanism-cr6.md:9` requires physical identity to distinguish replacement roots and trees, preserves predecessor provenance, and retains refusal for an absent destination under its verified original root. Existing record identities support this distinction at `src-tauri/src/infra/path_authority/catalog_install.rs:11` (confidence: 95).

CR6 uncertainty-proof gap CLOSED in the final candidate — `mechanism-cr6.md:11` explicitly requires durable marking before handoff, persistence-failure refusal and registry reopen. These exercise the affected marker path at `src-tauri/src/infra/path_authority/catalog_install.rs:369`, beyond the existing reachable-tree test at `:1178` (confidence: 98).

Optimal: one shared relation distinguishing confirmed membership, disjointness and uncertainty → I recommend this mechanism. Conservative retention and use marking include uncertainty. Cleaning refusal requires identity-confirmed membership or the exact missing-destination reservation. Existing cleanup identity and inventory checks remain authoritative at `src-tauri/src/infra/path_authority/catalog_install.rs:542`.

Unsafe inference to avoid: neither lexical overlap nor the existing `filesystem_reaches` returning `Ok(true)` establishes physical membership. Its missing-leaf branch at `src-tauri/src/infra/path_authority/catalog_install.rs:179` treats equal parent identities conservatively. The candidate now explicitly preserves that distinction.

Limitation: this approves the mechanism correction, not implementation closure of CR6. Source remains unchanged at `1bb27a0b`. No writes, tests, gates or compilers ran. Runtime behavior, including Windows/macOS, remains unverified (confidence: 100). Review and code share the same model family.

VERDICT: APPROVED
```

### CR6 implementation proof

The same sensitive Codex write leaf implemented the approved three-way relation only in catalog_install.rs. The root inspected the complete diff. Member requires physical identity or the verified original missing-destination reservation. Disjoint requires resolved evidence. Uncertainty preserves trees and durable session use, while the cleaning guard refuses confirmed membership only. All retained-owner, session-use and prepublication consumers share the relation. Independent replacement bindings remain distinct and the predecessor's exact provenance is preserved. Main.rs and mod.rs stayed byte-identical.

Eight new production-entrypoint tests exercise unavailable cleaning roots with independent engines, conservative markers and registry reopen, marker write/sync failure, replacement roots and trees, moved/aliased cleaning descendants, original missing reservations, distinct absent leaves, retained uncertainty and unavailable prepublication resources. Red-first compiled with five behavioral failures. An additional prepublication regression exposed a missing-path branch in the first implementation and was repaired. The final source-only Git-derived reversal compiled with six intended behavioral failures and two passing controls, all new tests intact. Exact byte restoration matched source and test-module hashes.

Root independently passed 50 catalog, 284 authority, 214 filesystem tests with one existing isolated-namespace test ignored, and 39 shutdown tests, plus formatting and global diff checks. The sha256 selector still matched zero tests, with actual hash cancellation and activation coverage in the authority suite. Complete checks:pre-review passed including Windows GNU compilation/clippy. Canonical root proof records are gate-review-cr6-proof.t17kv8 and gate-review-cr6-prereview.N7Zn4v. Complete leaf evidence is /tmp/build-de5be974-c551-48bb-b87c-30caf1642a05/review-cr6-evidence.md with logs, source-only patch and hash manifests.

The leaf correctly reported a global diff-check failure in the root-owned handoff. Its embedded candidate patch had blank context lines containing one space. Root replaced only that patch excerpt with its exact artifact path and SHA256, preserving both full candidate texts and raw review reports. The global check then passed and the complete root proof followed. This record-formatting repair changes no source behavior.

Local runtime proof remains Linux only. Windows cleaning-state fixtures seed the persisted retry state privately while Unix additionally uses the existing production removal fault injector. Real Windows case-renames and other native platform behavior remain pending hosted jobs. CR6 awaits cumulative reviewer closure. Plan authorship and arbitration shared one context. Detection ran on the same model family as the code.

### Cumulative diff review round 2

REVIEWED_THROUGH=1bb27a0b9ed12bd32ab844cb2f0c0c2c2c05ff2f. All eleven read-only lenses completed and all reports were read. Elapsed through arbitration: 300.633 seconds. CR1–CR5 are CLOSED with explicit originating-lens evidence. One adopted finding opens CR6, a correction-created defect of CR4 at 1824eb56. diff_adopted_per_round: r1=6 r2=1. Six unique corrections total, five closed and one open. No Skip or Defer. Plan authorship and arbitration shared one context. Detection ran on the same model family as the code.

CR6 Fix: an unavailable cleaning root maps uncertainty to positive membership and blocks unrelated engine resolution. Retention uncertainty and confirmed cleaning-tree membership must be distinguished without weakening durable child-use protection or cleanup authority. A focused fresh-context mechanism judgment is requested before another patch. No source-derived Windows behavior is claimed as local runtime proof.

#### Round 2 correctness

```text
CR4 CLOSED — `catalog_install.rs:122–200` supplements lexical reachability with canonical bindings and ancestor object identities. Retained owners, current-session uses and prepublication resources share this relation. Uncertainty retains trees. Exact deletion authority remains unchanged.

No concrete correctness defects found in the correction delta or inspected dependencies. Shutdown ordering, hashing cancellation, inventory limits and overflow accounting remain consistent.

Limitation: Windows/macOS runtime behavior remains unverified here (confidence: 100). No files changed or tests run. Reviewer and code author share the Codex model family.

VERDICT: APPROVED
```

#### Round 2 root-cause

```text
CR1 CLOSED — `main.rs:1935` shares the real shutdown clear with the durable integration test. Source-only reversal leaves the session marker behind. Restoration passes and permits next-start collection.

CR4 CLOSED — `catalog_install.rs:122` supplements lexical reachability with filesystem bindings across all three consumers. This fixes alias-induced ownership misses while preserving deletion authority. Inspected reversals fail all three relation/use regressions, and restoration passes.

No symptom-only fix or reintroduced prior defect found. Hashing retains the earlier cancellation and descriptor checks.

Limitation: Windows/macOS runtime proof remains pending (confidence: 100). Review and code authors share the Codex model family. No files changed or tests run.

VERDICT: APPROVED
```

#### Round 2 tests

```text
CR1 CLOSED — `catalog_install.rs:848` exercises the shared production shutdown helper, reopens the registry, and asserts marker removal plus next-startup collection only after success. Failure and timeout retain both. The source-only reversal log shows the durable-marker assertion failing with exit 101.

No additional findings.

Limitation: Windows/macOS runtime and real-app verification remain pending, as disclosed (confidence: 100). Review was read-only and used the code author’s model family.

VERDICT: APPROVED
```

#### Round 2 error-handling

```text
[should-fix] src-tauri/src/infra/path_authority/catalog_install.rs:127 — After deletion fails and persists `cleaning=true`, disconnecting or moving that catalog root makes reachability resolution fail. `unwrap_or(true)` then marks unrelated paths as affected. Through `resolve` → `protect_catalog_path`, launching an independently installed engine fails with “catalog install cleanup is in progress,” hiding the unavailable-root cause. Retaining uncertain trees must not turn one cleanup failure into refusal of unrelated resources (confidence: 94).

Limitation: source review only, with no runtime reproduction. Windows/macOS failure behavior remains unverified (confidence: 100). Reviewer and code authors share the Codex model family.

VERDICT: APPROVED
```

#### Round 2 minimalism

```text
CR2 CLOSED — `mod.rs:3627` provides one `sha256_read_core`, used by cancellable payload hashing, activation descriptor hashing and catalog inventory hashing. Caller hooks preserve cancellation, observers and cumulative inventory limits (confidence: 98).

No further bloat or duplication findings. The smallest sufficient implementation retains the catalog lifecycle module and replaces its separate hashing loop with the shared core, as corrected. No new file was added by the correction delta.

Review was read-only. No tests or gates were run. Reviewer, authors and orchestrator share the Codex model family, including plan arbitration.

VERDICT: APPROVED
```

#### Round 2 code-quality

```text
CR3 CLOSED — `src-tauri/src/infra/path_authority/mod.rs:4365` now documents the boolean’s recursive reachability meaning and the map’s process-session lifetime, matching insertion and publication consumers (confidence: 99).

No additional readability or local-consistency defects found.

Read-only review. No files changed or tests run. Reviewer and code author share the Codex model family.

VERDICT: APPROVED
```

#### Round 2 engine-protocol

```text
No confirmed engine supervision, UCI state-machine or result-routing defects found in the correction delta and connected launch/shutdown paths.

Marker clearing remains gated on successful teardown. Alias checks conservatively add retention.

Read-only source review. Windows/macOS runtime behavior remains unverified. Reviewer and author share the Codex model family.

VERDICT: APPROVED
```

#### Round 2 ipc-contract

```text
No IPC contract defects found. Affected commands still agree with renderer callers and generated bindings. No new commands, events, binding edits or capability changes.

No prior IPC findings required CR closure. Review was read-only. No files changed or tests run. Reviewer and code author share the same model family.

VERDICT: APPROVED
```

#### Round 2 tauri-security

```text
CR4 CLOSED — `src-tauri/src/infra/path_authority/catalog_install.rs:122` supplements lexical reachability with canonical filesystem bindings and ancestor identity comparisons. Retained owners, session use and prepublication resources share this relation. Uncertainty retains trees. Deletion authority remains independently identity-bound and no-follow.

No additional security defects found.

Limits: Windows/macOS runtime proof remains pending. Credential/session storage is unchanged, with no refresh-token flow introduced. Read-only review, no files changed or tests run. Review shares the implementation’s model family, and plan authorship and arbitration shared one context.

VERDICT: APPROVED
```

#### Round 2 platform-semantics

```text
CR4 CLOSED — `catalog_install.rs:123–194` adds canonical filesystem bindings and ancestor identity comparisons to the shared retention relation. Uncertainty retains trees. Retained owners, session use and prepublication resources all use this relation. Exact deletion authority remains unchanged. Linux alias regressions and Windows case-rename tests cover the correction.

No additional platform defects established.

Proof limits: supplied evidence reports Windows GNU compilation/clippy passed. Windows/macOS runtime remains pending in `rust-windows-test` and `rust-macos-test`. `rust-platform` provides compile/lint evidence only. No non-Linux Unix source-probe result was supplied.

Read-only review. No files changed or checks run. Reviewer and implementation share the Codex model family.

VERDICT: APPROVED
```

#### Round 2 records

```text
CR5 CLOSED — `tasks/decisions.md:3347` now points to d-20261016-07 at line 8147. Historical prose is preserved. The clarification retains failure handling and follows d-20260918-18 for strict spelling, matching the implementation.

No records findings. All eleven copied review reports match their originals. Supplied logs support the correction test counts, behavioral failures, hash restoration and successful reruns.

Unverifiable: historical timing claims without original timing records. Windows/macOS runtime proof remains pending as recorded.

Read-only review, with no tests or writes. Reviewer and implementation share the same model family.

VERDICT: APPROVED
```

#### Round 1 root-cause

```text
No root-cause or prior-fix regression findings. Durable prepublication provenance preserves cleanup ownership after handle pruning. Shared acquisition checks close the identity-only binding gaps while preserving earlier canonical-spelling fixes. Supplied red/green evidence supports both mechanisms.

Limitation: case-only rename reachability remains unverified on Windows/macOS. No runtime witness establishes a defect (confidence: 100).

Review and code authorship share the Codex model family. No files changed or tests run.

VERDICT: APPROVED
```

#### Round 1 tests

```text
[should-fix] src-tauri/src/main.rs:3311 — The successful-shutdown test substitutes a callback returning `Ok(())`, while reclamation tests call `clear_catalog_session_use` directly. Removing the production clear callback at line 2464 would leave these tests green and retain used installations indefinitely after clean exits. No assertion connects production shutdown to durable marker removal and next-startup reclamation. (confidence: 98)

VERDICT: APPROVED
```

#### Round 1 error-handling

```text
No error-handling defects found at confidence ≥80.

Limitation: source review only. Windows/macOS runtime failure behavior remains unverified (confidence: 100).

Reviewer and code authors share the Codex model family.

VERDICT: APPROVED
```

#### Round 1 minimalism

```text
[should-fix] src-tauri/src/infra/path_authority/catalog_install.rs:188 — Catalog publication and cleanup add another streaming SHA-256 loop alongside `sha256_reader_cancellable` and `sha256_open_file` in `mod.rs:3609` and `:3661`. Extract one digest-reading core and route all three through it, preserving inventory byte limits, cancellation and test observers at their callers. The smallest sufficient new module keeps the lifecycle logic but replaces this 15-line hashing implementation with that shared call (confidence: 85).

VERDICT: REVISE
```

#### Round 1 code-quality

```text
[should-fix] src-tauri/src/infra/path_authority/mod.rs:4353 — `catalog_uses: BTreeMap<PathBuf, bool>` leaves the boolean’s meaning undocumented. For an ancestor resource used before publication, it means recursive reachability, requiring readers to trace insertion, publication and `reaches` to understand retention. Document the value as `recursive` and the map’s session lifetime (confidence: 92).

Reviewer and code author share the Codex model family.

VERDICT: APPROVED
```

#### Round 1 engine-protocol

```text
No confirmed defects within this lens. Source review covered catalog protection before engine handoff, shutdown clearing, shared launch paths and asynchronous result guards.

Read-only review only. Windows/macOS path-alias behavior remains unverified. No files changed.

VERDICT: APPROVED
```

#### Round 1 ipc-contract

```text
No IPC contract defects found. Traced affected commands, renderer ownership payloads, progress events, listener cleanup and shutdown handling. No new commands, events, binding edits or capability changes.

Read-only review. No files changed or tests run.

VERDICT: APPROVED
```

#### Round 1 tauri-security

```text
[blocker] src-tauri/src/infra/path_authority/catalog_install.rs:123 — Case-sensitive lexical reachability can authorize deletion of a retained installation on Windows. After a clean shutdown, rename the engine workspace from `Engines` to `engines`, then restart with its engine still saved. Startup rebinding canonicalizes the executable’s parent to the new spelling (`mod.rs:5250`), while catalog provenance retains the old root spelling. `starts_with` misses that retained executable, so collection proceeds. Cleanup still opens the original root identity through Windows case-insensitive lookup (`mod.rs:3886`), validates the unchanged inventory and recursively deletes the retained installation. Ownership matching must account for the filesystem binding before authorizing deletion. (confidence: 92)

Limitation: this is source-backed, without a Windows runtime witness. No tests or files were changed. Credential/session storage is unchanged, and no refresh-token flow is introduced.

VERDICT: REVISE
```

#### Round 1 platform-semantics

```text
[blocker] src-tauri/src/infra/path_authority/catalog_install.rs:123 — On Windows, a case-only workspace rename can cause deletion of a retained resource tree. Install under `C:\engines\old`, rename the workspace to `C:\Engines`, save that directory as an explicit recursive engine resource, then restart retaining the resource. Acquisition preserves the selected leaf spelling (`mod.rs:2092`), so lexical `starts_with` misses its relationship to the recorded tree. Cleanup nevertheless opens the old spelling through Windows’ case-insensitive lookup, verifies the unchanged identity (`infra/fs.rs:3390`), and deletes the tree. The same comparison also misses session-use protection. Reachability needs binding-aware alias handling and a Windows regression. This is source-derived, without a Windows runtime witness. (confidence: 94)

Proof limits: supplied evidence reports Windows GNU compilation/clippy passing through pre-review. I ran no checks. No non-Linux Unix source-probe result was found for this diff. Windows and macOS runtime proof remains pending in `rust-windows-test` and `rust-macos-test`. `rust-platform` supplies compilation/lint evidence only.

No files changed. Review and implementation use the same model family.

VERDICT: REVISE
```

#### Round 1 records

```text
[should-fix] tasks/decisions.md:3344 — d-20260918-02 requires an app-owned-subtree canonical-spelling exemption and remains unsuperseded at line 3347. d-20260918-18 explicitly removes that exemption at lines 3503–3504, matching the current rebinding implementation. Record the supersession while preserving historical prose so later sessions do not treat both policies as binding. This contradiction predates the reviewed range. (confidence: 99)

Unverifiable: recorded test counts, gate outcomes, timings and fix-revert results without their original execution logs. No writes, tests or live queries performed.

VERDICT: REVISE
```


### P4 durable-use implementation, integration repair and root proof


### Cumulative diff review round 5


### Cumulative diff review round 6 closure


### Real application verification before final gates


### Records-only closure round 7

REVIEWED_THROUGH e3e7825738a53b51bb14a45cdf083d686eba63b0. Adopted one Fix witness, CR17, confidence99: R6 source-review checkpoint prose retained present-tense app-pending wording after the successful app section was added. Root labels that sentence as historical and explicitly points to the completed later proof. No source, test, runtime outcome or quoted reviewer report changed. Seventeen unique corrections total, with CR17 records closure pending. No Skip or Defer. Inherited plan counts remain r1=3 r2=0 r3=0 r4=0. Diff witness counts now r1=6 r2=1 r3=3 r4=2 r5=6 r6=0 r7=1.

Plan authorship and arbitration shared one context. Detection ran on the same model family as code in separate Codex sessions, without family separation.

#### Round 7 records

````text
[should-fix] tasks/handoffs/2026-10-16-catalog-engine-retention-review.md:2561 — Lists real-app verification as still pending, contradicting lines 2390–2396 and the saved app log’s 118 successful checks. Remove that pending obligation or explicitly label this sentence as historical R6 status. Preserve quoted reviewer reports unchanged. (confidence: 99)

Limitations: Canonical gate completion was not independently verified here. Historical evidence was inspected selectively. No files changed or checks rerun. Review shares the author’s model family in a separate session.

VERDICT: REVISE
````

Source snapshot 17d7574d, with only this run's handoff records dirty. pnpm build passed, native optimized compilation 49.71 seconds. pnpm verify:app --screenshot /tmp/build-de5be974-c551-48bb-b87c-30caf1642a05/native-app.png passed all 118 reported ok checks. Canonical gate-native-app.LEx6ZW completion status 0. Root independently polled it and inspected the final reloaded-workspace screenshot. The screenshot shows the actual WebKitGTK home surface with both seeded workspace tabs and readable cards. Earlier NAG capture used the same output path and was overwritten, so root claims inspection only of the final reload capture. No committed screenshot baseline changed.

The real Rust/IPC product run verifies startup authority reconciliation, user-file preservation, orphan cleanup, progress leases, practice migration and counts, CSP/path refusal, sound server, attachment retirement, reservation cancellation, file opening/NAG save and metadata interactions, instance exclusion, document reload, real close and bounded shutdown cleanup. It confirms the application pid and recorded WebKit service pids are absent after close, destruction cancels the retained reservation, and retired-image cleanup runs. Native UCI live-child proof is supplied separately by the catalog/process tests. The driver does not register an engine through a native picker or prove a completed GameManager game. Native GTK menus, file pickers and decoration behavior are outside WebDriver coverage, with no changed GTK behavior requiring a manual check.

Existing verifier failure-matrix limits, explicitly ARGUED NOT STAGED in docs/context/RULE-HISTORY.md:1343 onward, remain disclosed. These cover bridge presence, titlebar controls, process-before-close, migration capability retention, untouched legacy key, final inventory/migrated counts and legacy capability after key removal. A green run is not independent staged-failure proof of those assertions. The retained source-derived matrix covers the other assertions, including the separately staged engine-save publication assertions in the current verifier header. No verifier or test framework was added or modified in this run.

This successful app proof supersedes prior real-app-pending statements for this snapshot. Final gates, hosted Windows/macOS/runtime and platform compile/lint, push and installer remain pending. Source reviewer closure is R6 all eleven APPROVED with zero new findings. Plan authorship and arbitration shared one context. Detection ran on the same model family as code in separate Codex sessions, without family separation.

#### Complete real-app execution output

````text
> node scripts/verify-app.mjs --screenshot /tmp/build-de5be974-c551-48bb-b87c-30caf1642a05/native-app.png

  .. opening seed WebDriver session
  .. seed app and WebKit processes are gone; reusing WebDriver after session quit
  .. conversion disposable inputs: /tmp/chessfable-verify-x0BbB9/path-owner-fixture/files-workspace/verify-conversion-cancellation.pgn, /tmp/chessfable-verify-x0BbB9/path-owner-fixture/files-workspace/verify-conversion-seed.pgn
  .. game-opening disposable PGN input: /tmp/chessfable-verify-x0BbB9/path-owner-fixture/files-workspace/verify-game-opening.pgn
  .. opening assertion WebDriver session with the preserved profile
  ok  production startup reclaims unowned authority and preserves native-owned authority
  ok  startup authority reconciliation deletes no user files
  ok  trusted production startup preserves owned images and cleans only the orphan
  ok  the real Tauri IPC bridge is present (not a test mock)
  ok  the real renderer exposes the ChessFable document title
  ok  progress native event listener registers
  ok  progress start lease has exact canonical string generation
  ..  progress start wire: {"id":"verify-progress:72f0d7c3-48ea-4023-ac3b-3f176a65702a","generation":"1"}
  ok  progress running event has exact canonical string generation
  ok  progress state-update string lease reaches native with exact identity
  ok  progress snapshot has exact canonical string generation
  ok  progress terminal state update accepts the string lease
  ok  progress terminal event has exact canonical string generation
  ok  progress malformed lease rejects without changing the snapshot
  ok  progress invalid clear rejects as a native IPC operation
  ok  progress clear return has exact canonical string generation
  ok  progress cleared event has exact canonical string generation
  ok  progress clear removes the native snapshot
  ok  progress native event listener is released
  ok  the native practice read returns all 12,000 seeded positions
  ok  native practice review paging returns every seeded entry and reaches the oldest review
  ok  the legacy practice deck is migrated into the native store through real IPC
  ok  migration retains the legacy deck capability in path-authority.json
  ok  migration leaves the legacy practice localStorage key untouched
  ok  fifty renderer ratings land in the native practice review store
  ok  renderer ratings do not alter the large deck's 12,000 native positions
  ok  the 50 new native reviews record the panel's Good rating
  ok  renderer ratings create no new legacy key and do not grow the existing key
  ok  list_practice_decks retains the legacy capability after its browser key is removed and fresh startup reconciliation
  ok  the stale-file scenario rewrites the PGN in place
  ok  the open file-backed tab reloads or withholds the changed PGN
  ok  the file freshness transition includes a measured native read_game call
  ok  the freshness transition applies within 1000 ms of the measured read
  info  open file freshness: 2257.8 ms after rewrite (limit 2000 ms + read_game 9.0 ms + apply 438.0 ms; verified)
  ok  the open file-backed tab refreshes within one poll interval plus measured read and apply
  ok  the real sync path stores 500 further repertoire positions
  ok  final restart preserves exact native position and review counts for both decks
  ok  final practice inventory contains no additional native deck
  ok  final migrated-deck counts still equal the legacy value's counts
  ok  real IPC preserves the persisted offline download destination
  ok  real IPC rejects a fresh download destination id
  ok  real IPC rejects a database-root id
  ok  the retained engine LocalImage rendered on the Engines page
  ok  the retained engine LocalImage uses an image/png data URL
  ok  the retained engine LocalImage data URL decodes in WebKitGTK
  ok  EP1-card successful Name edit publishes the saved engine card
  ok  EP1-storage successful Name edit persists the decoded engine name
  ok  EP2-error refused engines storage write reports the save error
  ok  EP2-card refused Name edit retains the saved engine card
  ok  EP2-input refused Name draft settles to the saved name
  ok  EP2-storage refused Name edit retains the decoded saved engine name
  ok  the production CSP rejects a detached blob image URL with an img-src violation
  ok  the renderer cannot resolve a base directory (core:path grants are gone)
  ok  the renderer reaches a live loopback sound-server port
  ok  the loopback sound server serves the bundled standard move sound
  ok  real attachment IPC prepares the exact next durable owner set
  ok  real attachment IPC retires the selected managed image
  ok  retirement preserves image bytes for the live session and records cleanup intent
  ok  the custom title bar rendered its window controls
  ok  the native backend mints an opaque read reservation
  ok  the native backend acknowledges reservation cancellation
  ok  a cancelled reservation cannot be claimed by a later native read
  ok  the seeded workspace file row renders on the Files page
  ok  a real double-click on the unselected Files row navigates to /
  ok  a real double-click on the unselected Files row shows its game
  ok  GO1 game-opening fixtures contain two distinct native database and PGN games
  ok  DS1 native database storage_size is the exact decimal string of its file length
  ok  LU1 Library has one sidebar destination and one tree containing both native source kinds
  ok  LU2 Library selection switches from file preview to database Explore and actions
  .. game-opening source screenshot: /tmp/build-de5be974-c551-48bb-b87c-30caf1642a05/native-app.png.database-card.png
  ok  GO2 the database card has a visible sibling Open database control before selection
  ok  GO3 the labelled database control opens its handle route and synchronizes the database
  ok  DS2 database explorer persists the successful selection with its exact decimal storage_size in plain JSON
  ok  GO4 database single-click selects a preview without admitting a tab
  .. game-opening source screenshot: /tmp/build-de5be974-c551-48bb-b87c-30caf1642a05/native-app.png.database-game.png
  ok  GO5 the labelled database game button opens the selected content and origin
  ok  GO6 a fixed-coordinate double-click opens an initially unselected database game
  ok  GO7 row-focused Enter opens the requested database game content and origin
  .. game-opening source screenshot: /tmp/build-de5be974-c551-48bb-b87c-30caf1642a05/native-app.png.file-game.png
  ok  GO8 the Files preview has a visible enabled Open game control
  .. GO9 native geometry: {"originalRect":{"x":0,"y":0,"width":800,"height":647},"resizedRect":{"x":0,"y":0,"width":1300,"height":850}}
  .. GO9 restored native geometry: {"x":0,"y":0,"width":800,"height":647}
  ok  GO9 PGN single-click selects without opening and keeps row coordinates stationary
  ok  GO10 the labelled Files game button opens the selected fresh game and explicit index
  ok  GO11 a fixed-coordinate double-click opens an initially unselected non-first PGN game
  ok  GO12 row-focused Enter opens the requested PGN game content and explicit index
  ok  GO13 an empty PGN exposes no working Open game action
  .. game-opening source screenshot: /tmp/build-de5be974-c551-48bb-b87c-30caf1642a05/native-app.png.info-panel-discard.png
  .. GO14 owner 63abadfe-036e-41ae-8387-e7445cd87bc8, admitted IDs ["17ffaf95-55c5-4b01-bde0-5d33b5c7430c","c68b3c70-ff93-47a4-9397-606924903346","e0132f7a-dd19-44f0-9492-42ec4e8557bc","4ef01d8b-198c-4114-b0fe-62be8ddec2f9","098e5096-0899-43a7-b748-452eb0fd1d8d","a921793f-5f24-4f05-a121-dc6c78787ab0","63abadfe-036e-41ae-8387-e7445cd87bc8"], Event verify:opening-1 -> verify:GO14-unsaved-owner-discard -> verify:opening-0, dirty false -> true -> false, file gameNumber 1 -> 0, confirmation gone
  ok  GO14 confirmed discard replaces the owning current game without admitting a tab
  ok  CC0 conversion fixture seeds exactly one native game
  ok  CC1 prepared conversion cancellation returns typed Cancellation before claim
  ok  CC2 native progress triggers running and same-target queued ticket cancellation
  ok  CC3 cancelled native imports preserve existing content and DataRevision
  ok  CC4 a fresh conversion ticket retries successfully after cancellation
  ok  CC5 settled native conversion tickets are retired
  ok  the $8 board hint is rendered with a glyph path
  ok  the $8 board hint SVG title is □
  ok  the $8 board hint has a visible box and positive opacity through its board ancestors
  ..  NAG game at 1.e4 screenshot written to /tmp/build-de5be974-c551-48bb-b87c-30caf1642a05/native-app.png
  ok  the unknown $220 renders no board annotation hint
  ok  SAVE_FILE writes Nc3?! to the seeded NAG file
  ok  the saved NAG game preserves $8
  ok  the saved NAG game preserves $11
  ok  the saved NAG game preserves d4! $2
  ok  the saved NAG game preserves $220
  ok  the Files metadata edit submits without a dialog error
  ok  the Repertoire filter lists the metadata-edited workspace file
  ok  the metadata-edited workspace sidecar records repertoire on disk
  ok  the Files metadata edit preserves the PGN filename
  ok  a second process on the same app-data directory is refused before initialization
  ok  the refused launch leaves authority and credential registry bytes unchanged
  ok  the primary still answers WebDriver after the refused launch
  ok  a second process sharing only the configuration directory is refused
  ok  a process on a different app-data directory initializes while the primary runs
  ok  a real document reload cancels the previous document's retained reservation
  ok  a real document reload preserves both exact seeded workspace tab identities
  ok  a real document reload selects the second seeded workspace tab
  ..  Reloaded workspace screenshot written to /tmp/build-de5be974-c551-48bb-b87c-30caf1642a05/native-app.png
  ok  a native read reservation is retained until titlebar close
  ok  the application process is running before the close
  ok  application pid 81822 and recorded WebKit service pids [81873, 81906] do not exist after the close
  ok  the real destroyed-window event cancels the exact retained main-webview reservation
  ok  the shutdown sequence started
  ok  the shutdown cleanup ran to completion inside its budget
  ok  the sound server shutdown was signalled
  ok  titlebar shutdown removes retired image bytes and intent while retaining the owner

shutdown log:
  [2026-10-16][03:41:08][chessfable::sound::server][INFO] Sound server prepared on port 45719
  [2026-10-16][03:43:47][chessfable][INFO] Shutdown requested: terminating engines and live games
  [2026-10-16][03:43:47][chessfable][INFO] Sound server shutdown signalled
  [2026-10-16][03:43:47][chessfable][INFO] Shutdown cleanup finished
  [2026-10-16][03:43:47][chessfable::sound::server][INFO] Sound server prepared on port 43159
  [2026-10-16][03:43:48][chessfable][INFO] Shutdown requested: terminating engines and live games
  [2026-10-16][03:43:48][chessfable][INFO] Sound server shutdown signalled
  [2026-10-16][03:43:48][chessfable][INFO] Shutdown cleanup finished
  [2026-10-16][03:43:48][chessfable::sound::server][INFO] Sound server prepared on port 37905
  [2026-10-16][03:43:56][chessfable][INFO] Shutdown requested: terminating engines and live games
  [2026-10-16][03:43:56][chessfable][INFO] Sound server shutdown signalled
  [2026-10-16][03:43:56][chessfable][INFO] Shutdown cleanup finished
  [2026-10-16][03:43:57][chessfable::sound::server][INFO] Sound server prepared on port 44075
  [2026-10-16][03:45:22][chessfable][INFO] Shutdown requested: terminating engines and live games
  [2026-10-16][03:45:22][chessfable][INFO] Sound server shutdown signalled
  [2026-10-16][03:45:22][chessfable][INFO] Shutdown cleanup finished
  ok  default-root-unusable: the Databases alert offers a visible folder chooser
  ok  selected-root-missing: the Databases alert offers a visible folder chooser without recreating db

all checks passed
````

REVIEWED_THROUGH 17d7574d044560378c15e0bd2ede190494819eb5. All eleven required lenses APPROVED, zero new findings and zero adopted witnesses. Elapsed wall 233.664 seconds. CR9 and CR12–16 CLOSED with explicit reviewer evidence. CR10/CR11 and all earlier affected closures remain intact. All sixteen unique corrections are Fix and now source-closed. No Skip or Defer. Complete cumulative witness counts r1=6 r2=1 r3=3 r4=2 r5=6 r6=0. The separate precommit integration check added CR11/CR12 and does not replace inherited plan lineage r1=3 r2=0 r3=0 r4=0.

This closure supersedes earlier implementation/review-pending statements for the same correction IDs. At R6's source-review checkpoint, Windows/macOS runtime, real-app verification, final gates and delivery were pending. The later real-application verification section above records the completed app proof. Windows/macOS runtime, final gates and delivery remain pending at this pre-gate records checkpoint. Records reviewer explicitly limits exhaustive coverage of the complete historical corpus and could not access root gate completions. Root has independently polled their canonical status0 records and supplied the exact paths above. No runtime platform success is inferred from reviewer approval.

Plan authorship and arbitration shared one context. Detection ran on the same model family as the code in separate Codex sessions, without family separation.

#### Round 6 correctness

````text
CR9 CLOSED — Admission still uses the pre-mutation baseline. Canonical fixture keys preserve refusal at 4096 units and usable existing-binding reuse. Both saved reversals fail at 4098.

CR12 CLOSED for source correctness and supplied Linux evidence — Durable cwd identity and actual launch now use the same retained parent object. Child-side `fchdir` survives pathname movement or replacement. `ChildOwnership` retains the descriptor until confirmed reaping. The original replacement witness fails before repair and passes afterward.

CR13 CLOSED — Aggregate names now describe admission units. Counting arithmetic and bounds are unchanged.

CR14 CLOSED — Capacity fixture paths derive from the authority-issued canonical root.

CR15 CLOSED — Image/cwd assertion keys and identities derive from the registered `StoredEntry`.

CR16 CLOSED as a review-input correction — Hash equality is explicitly limited to the pre-clippy snapshot. No code behavior changes.

CR10 and CR11 remain CLOSED — Originating-session uses remain durable, and startup eligibility still reevaluates them. CR1–CR8 show no correctness regression in the affected dependencies.

No new correctness defects found.

Named limitation (confidence: 100): Windows ancestor sealing and macOS native launch remain unverified at runtime. Added tests and compilation do not establish runtime success. This review performed no writes or tests and shares the code author’s model family. Plan authorship and arbitration shared one context.

VERDICT: APPROVED
````

#### Round 6 root-cause

````text
CR9 CLOSED — Admission preserves the premutation baseline. Inspected source-only reversals admit 4,098 units and fail, while restored code refuses overflow and permits existing-binding reuse.

CR10 CLOSED — Durable originating-session evidence remains independent of install records and authority retirement. This repair preserves serialization and session-specific clearing.

CR11 CLOSED — Startup eligibility still reevaluates unresolved uses through the shared reachability relation.

CR12 CLOSED — `mod.rs:6741` retains the same parent object recorded as cwd evidence. `process.rs:3785` applies child-side `fchdir`, and existing child ownership retains the descriptor through confirmed reaping. Inspected Linux logs reproduce replacement-data consumption before repair, then pass afterward. Removing only `fchdir` produces a behavioral failure.

CR13 CLOSED — Aggregate names now describe admission units. Counting, limits and the genuinely unique-ID helper remain unchanged.

CR14 CLOSED — Capacity fixture keys derive from the authority-issued canonical root. Production refusal and usable reuse assertions remain intact.

CR15 CLOSED — Atomic image/cwd assertions derive keys and identities from the validated registered entry, preserving persistence-failure and retry coverage.

CR16 CLOSED — Earlier hash equality is explicitly limited to the pre-clippy proof snapshot. Later evidence identifies its own snapshot.

No new root-cause defect or reintroduced prior fix found.

Named limitation (confidence: 100): Windows/macOS native runtime evidence remains pending, including Windows ancestor-replacement sealing. Linux reopen tests model session transitions without an actual crash. This review inspected source, history and saved evidence without executing tests or changing files. Reviewer and author share the Codex model family.

VERDICT: APPROVED
````

#### Round 6 tests

````text
CR9 CLOSED — Production overflow refusal and usable existing-binding reuse are asserted. Both source reversals fail at 4,098 admission units.

CR10 CLOSED — The three-session child test detects lost prepublication durability through failed child-data reads.

CR11 CLOSED — The ancestor-substitution test detects removal of eligibility’s durable-use lookup through failed child-data reads.

CR12 CLOSED — Replacement-before-spawn now asserts original cwd bytes before and after unrelated-tree collection. Recorded original-code and source-only reversals fail that assertion.

CR13 CLOSED within this lens — Naming changes preserve accounting and its behavioral capacity anchor.

CR14 CLOSED — Capacity setup derives canonical paths from native authority issuance.

CR15 CLOSED — Durable image/cwd assertions derive exact keys and identities from registered bindings, retaining fault and retry checks.

CR16 CLOSED within this lens — Earlier hash equality is explicitly limited to the pre-clippy snapshot.

No new findings. Tests are reachable through targeted selectors and full backend gates.

Named limitation (confidence: 100): Windows/macOS runtime tests are configured but remain unexecuted in supplied evidence. Linux reopen tests do not prove actual crash, completed-game or whole-app behavior. This review ran no checks and shares the implementation’s model family.

VERDICT: APPROVED
````

#### Round 6 error-handling

````text
CR9 CLOSED — `catalog_install.rs:545` preserves the admission baseline. Capacity refusal returns typed `ResourceLimit`, while existing-binding reuse succeeds. Examined both compiled reversal failures and restored green logs.

CR10 CLOSED — durable originating-session evidence survives authority retirement. Failed or uncertain persistence refuses handoff, and successful shutdown clears only its own evidence.

CR11 CLOSED — startup eligibility reevaluates durable uses. Inspection uncertainty preserves retention without granting deletion authority.

CR12 CLOSED within this lens — `mod.rs:6741` fallibly retains the validated parent object. `process.rs:3787` propagates `fchdir` failure through the existing typed error and cleanup chain. Child ownership retains cwd through confirmed reaping. Examined replacement regression and reversal evidence.

CR13 CLOSED — admission-unit names now match their accounting. Error variants, arithmetic and bounds remain unchanged.

CR14 CLOSED at source level — capacity fixture keys derive from the authority-issued canonical root. Windows runtime remains pending.

CR15 CLOSED at source level — image/cwd assertions derive keys and identities from registered bindings. Atomic-write, failure-refusal and retry assertions remain.

CR16 CLOSED — the hash-equality statement explicitly identifies the pre-clippy snapshot and separately discloses later test bytes.

No new error-handling defects found at confidence ≥80. Cleanup failures retain retry state, log the install id and cause, and return an error. Startup deliberately handles that maintenance failure after successful owner reconciliation.

Named limitations (confidence: 100): read-only source and saved-evidence review, with no tests rerun. Windows/macOS runtime, actual crashes and full-app behavior remain unverified. Review and implementation share the Codex model family. Plan authorship and arbitration shared one context. No files changed.

VERDICT: APPROVED
````

#### Round 6 minimalism

````text
CR9/CR14 CLOSED within this lens — capacity setup uses the authority-issued canonical root and existing commit machinery, preserving overflow refusal and usable reuse.

CR12 CLOSED within this lens — the validated cwd descriptor travels through existing `EngineExecutable` and `ChildOwnership`. Unix launch uses child-side `fchdir`. Test helpers reuse the existing child harness.

CR13 CLOSED — admission-unit names replace misleading unique-ID names without changing arithmetic or adding machinery.

CR15 CLOSED — image/cwd expectations derive from registered bindings while preserving the atomic handoff test.

CR16 CLOSED — the historical hash claim explicitly identifies its pre-clippy snapshot.

CR10/CR11 dependency checks remain closed — publication, handoff and startup eligibility share the same retention relation and registry.

No retained bloat or duplication findings. The added `catalog_install.rs` owns one cohesive lifecycle domain. Inlining it would relocate required code without reducing behavior. No substantial deletion preserves O1–O4.

Limitations (confidence: 100): read-only source and supplied-evidence review. Windows/macOS runtime remains unverified. Author and reviewer share the Codex model family, without family separation. No files changed or tests run.

VERDICT: APPROVED
````

#### Round 6 code-quality

````text
CR13 CLOSED — `registry_admission_units` and `RegistryAdmissionSnapshot.admission_units` accurately describe the aggregate accounting. The distinct-ID helper retains its correct name.

CR9/CR14 CLOSED within this lens — capacity setup explicitly derives canonical paths from authority-issued storage and uses the renamed aggregate counter.

CR12 CLOSED within this lens — retained cwd ownership, Unix descriptor-based launch and Windows pathname access are clearly distinguished.

CR15 CLOSED within this lens — expected image/cwd keys and identities come directly from the registered entry.

CR16 CLOSED for wording — the hash-equality sentence explicitly identifies the pre-clippy snapshot.

CR3 remains CLOSED — the recursive boolean and originating-session lifetime are documented. CR10/CR11 dependency checks reveal no readability regression.

No new readability or local-consistency findings.

Limitation (confidence: 100): read-only source review, no checks executed. Windows/macOS runtime behavior remains unverified here. Reviewer and author share the Codex model family.

VERDICT: APPROVED
````

#### Round 6 engine-protocol

````text
CR6–CR8 remain CLOSED — cleaning refusal requires confirmed membership, historical terminal identities survive pathname reuse, and recursive-ancestor refusal remains covered.

CR9 CLOSED — `catalog_install.rs:2540` exercises production refusal at 4,096 units and usable existing-binding reuse. Inspected guard and baseline reversal logs fail at 4,098, followed by restored green.

CR10 remains CLOSED — durable uses preserve originating sessions independently of install records and authority retirement. Successful shutdown clears only its own evidence.

CR11 remains CLOSED — startup eligibility reevaluates unresolved durable bindings through the shared relation at `catalog_install.rs:768`.

CR12 CLOSED — `mod.rs:6741` retains the validated parent descriptor, `process.rs:3786` establishes Unix cwd through `fchdir`, and `ChildOwnership` retains it until confirmed reaping. The inspected red-first witness reads replacement-tree data. Restored code reads original data while allowing the independent tree’s collection.

CR13–CR16 CLOSED within the examined correction scope — admission naming matches accounting, fixtures derive canonical keys from issued bindings, atomic image/cwd assertions use registered identities, and the historical hash claim explicitly names its pre-clippy snapshot.

No additional confirmed engine-supervision, UCI state-machine or asynchronous-result-routing defects found.

Limitations: read-only source and saved-evidence review. No checks or processes run, no files changed. Windows/macOS runtime, actual crash, completed GameManager/browser game and whole-app verification remain unverified. Review and implementation share the Codex model family without family separation.

VERDICT: APPROVED
````

#### Round 6 ipc-contract

````text
CR6 remains CLOSED within this lens — `catalog_install.rs:605` refuses access during cleanup only for confirmed membership. Uncertain relationships retain protection without refusing unrelated engines.

No IPC-contract defects found. Affected Rust signatures, generated invoke keys and renderer callers agree. Progress remains Specta-registered, correlated and percentage-based, with listener cleanup. No new commands, events, renderer parameters, binding edits or capability scopes appear.

CR9–CR16 have no prior IPC witness requiring closure. Their broader native correctness and proof obligations remain with the assigned lenses.

Limitations: read-only source review. No files changed, tests run or platform runtime behavior verified. Reviewer and code share the same model family in separate sessions.

VERDICT: APPROVED
````

#### Round 6 tauri-security

````text
CR9 CLOSED — `catalog_install.rs:544` captures admission before mutation. Canonical capacity fixtures preserve refusal at 4,096 and usable existing-binding reuse. Both inspected reversals admit 4,098 and fail.

CR10 CLOSED — `mod.rs:8819` persists originating-session use independently of install records. Publication preserves those sessions, and successful shutdown clears only its own evidence.

CR11 CLOSED — `catalog_install.rs:778` reevaluates unresolved durable uses before collection. Root, tree and inventory deletion checks remain independent.

CR12 CLOSED — `mod.rs:6741` retains the validated parent descriptor through `EngineExecutable` and child reaping. `engine/process.rs:3785` establishes Unix cwd with `fchdir`. The inspected red-first witness reads replacement data before correction, while restored code reads original data and permits independent-tree collection.

Prior CR4/CR6–CR8 security closures remain intact. CR13–CR16 were inspected as dependencies. The naming, canonical fixture and historical-evidence corrections introduce no security regression.

No new in-scope defects found.

Limitations: read-only source and supplied-proof review, without executing checks or changing files. Runtime evidence is Linux-only. Windows ancestor protection and macOS launch behavior await native execution. No actual crash or whole-app verification is established. No refresh-token flow is introduced. Reviewer and code author share the Codex model family, without family separation. Plan authorship and arbitration shared one context.

VERDICT: APPROVED
````

#### Round 6 platform-semantics

````text
CR9/CR14 CLOSED — `catalog_install.rs:2553` seeds capacity from the authority-issued canonical root. Production overflow refusal and usable existing-binding reuse remain covered.

CR12 CLOSED at source-review level — `mod.rs:6741` retains the validated parent object through child ownership. `process.rs:3786` uses child-side `fchdir` on Unix. Windows retains its no-delete parent handle. Native platform tests cover normal launch and directory substitution.

CR13 CLOSED — aggregate admission names changed without changing accounting or limits.

CR15 CLOSED — `catalog_install.rs:2196` derives expected image/cwd keys and identities from the registered entry.

CR16 CLOSED — the handoff qualifies hash equality as the pre-clippy snapshot and separately identifies later test bytes.

CR10/CR11 remain CLOSED — durable originating-session evidence and startup eligibility lookup remain intact. Prior platform closures remain intact. No new platform defects established.

Limitations: read-only review, no files changed or checks run. Supplied `pnpm rust:windows:check` evidence passes GNU compilation/clippy only. No non-Linux Unix source-probe result was supplied. Windows/macOS runtime proof remains pending in `rust-windows-test` and `rust-macos-test`, including Windows ancestor-rename behavior. `rust-platform` supplies compile/lint evidence. Reviewer and code share the same model family.

VERDICT: APPROVED
````

#### Round 6 records

````text
No findings in the correction and inspected history. CR16 is CLOSED against both exact snapshots. Current hashes and saved test logs agree, and prior quoted reports remain byte-preserved.

Limitations: the complete 4.54 MB record corpus was not exhaustively reviewed. Named root gate completion records were unavailable. Windows/macOS runtime, real-app verification, full gates and delivery remain pending. Review used the code author’s model family in a separate session.

VERDICT: APPROVED
````


### Focused cwd handoff judgment after round 5


### Round 5 native repair implementation and proof


Root independently passed 74 catalog, 284 authority, 214 filesystem with one existing ignore, 39 shutdown and 230 engine-process tests, formatting and diff checks. Canonical gate-r5-proof.fwuzY5 returned 0. The complete pre-review scheduler gate-r5-prereview.dcHQOK returned 0 including Windows GNU clippy. Root verified final source hashes against repair5-final-hashes.json and inspected the complete three-file repair diff. No source changed after those checks. CR9 and CR12–16 now await cumulative reviewer closure.

The same sensitive writer implemented cwd1 and CR13–15. The original adopted phase listed process.rs as read-only. Cumulative review supplied new source evidence that its actual pathname launch consumer violated required O2, so this repair writes that directly connected consumer under d-20261016-12. This is required closure of the frozen lifetime contract, not added product scope. No new registry, actor lease, process-global cwd mutation or capability was introduced. CR16 pre-clippy hash qualification is corrected above. Reviewer closure remains pending.

Root inspected all three source diffs and the full capture-to-spawn path. The source-only cwd mutant removes fchdir and fails at native data consumption, while the initial red-first test separately reproduces the original substituted-path data failure. Windows/macOS runtime remains pending, with actual cfg-gated production-launch tests now added. Plan authorship and arbitration shared one context. Detection ran on the same model family as the code in separate Codex sessions, without family separation.

#### repair-r5.txt

````text
Implemented cwd1 in [mod.rs](/home/felixb/Projekte/chessfable.worktrees/drain/src-tauri/src/infra/path_authority/mod.rs), [process.rs](/home/felixb/Projekte/chessfable.worktrees/drain/src-tauri/src/engine/process.rs) and [catalog_install.rs](/home/felixb/Projekte/chessfable.worktrees/drain/src-tauri/src/infra/path_authority/catalog_install.rs). Changes remain unstaged. Foreign handoff work is preserved.

The validated parent object now travels with `EngineExecutable` through `ChildOwnership` until confirmed reap. Unix uses child-only `fchdir`, without pathname cwd dependency or an extra inherited descriptor. Windows retains the no-delete parent alongside the sealed image. Canonical authorization remains intact.

Admission names now describe units. Capacity and atomic-handoff fixture keys derive from authority-issued canonical bindings.

All final commands returned **0**:

| Check | Result |
|---|---:|
| Catalog | 74 passed |
| Path authority | 284 passed |
| Filesystem | 214 passed, 1 existing ignore |
| Shutdown | 39 passed |
| Engine process | 230 passed |
| Formatting and diff checks | Passed |
| Windows GNU compilation/clippy | Passed |

The initial native witness reproduced replacement-data consumption. Three source-only reversals compiled and failed behaviorally, then passed after exact restoration with tests unchanged. These cover cwd launch binding and both admission protections. Actual children were reaped before failure propagation.

[Complete capture/ownership/spawn trace, logs, patches, hashes and failure evidence](/tmp/build-de5be974-c551-48bb-b87c-30caf1642a05/repair5-evidence.md).

Runtime proof is Linux-only. Native Windows parent/ancestor replacement and macOS movement tests were added but remain pending hosted execution. No mechanism deviation or unresolved source-derived contract question was found.
````

#### repair5-evidence.md

````text
Round5 cohesive native repair evidence

Implemented the approved cwd1 mechanism under d-20261016-12 and the frozen O1–O4 contract. Both supplied mechanism files and all eleven round5 lens reports were read. Only `src-tauri/src/infra/path_authority/mod.rs`, `src-tauri/src/infra/path_authority/catalog_install.rs` and `src-tauri/src/engine/process.rs` changed. `resolved.rs` was inspected and remained unchanged because its existing retained-parent accessor suffices. Main and all other production files were untouched. Root's dirty handoff was preserved. No skills, agents, messages, records, stage, commit, push or release operations were used. There is no mechanism deviation or unresolved contract question from local source inspection.

Capture to ownership to spawn

- The existing resolution boundary still records image and cwd node identities together in one durable candidate before handoff. Actual terminal descriptors determine resource scope. The shared node/recursive predicate, publication, originating-session lifetime and startup eligibility implementation are unchanged by this repair.
- `mod.rs:6741` fallibly clones `resolved.parent()`. This is the same validated held directory object that supplied `resolved.parent_identity()` to durable evidence. It never reopens a pathname to establish cwd identity. Missing parent returns typed Conflict and clone failure returns I/O error before executable handoff.
- `workspace_entry_path` canonical authorization still executes at `mod.rs:6752`. Its validated path supplies the Windows launch/cwd spelling. Canonical spelling and operation bounds are not bypassed.
- `EngineExecutable` at `mod.rs:1886` now owns the retained cwd file alongside its existing image and resource ownership. Unix gets only its raw descriptor through a private native accessor. Windows additionally retains the canonical cwd path. There is no optional pathname fallback for an unavailable Unix cwd object.
- Existing `ChildOwnership` at `process.rs:778` retains the complete EngineExecutable through confirmed physical reaping. Its existing success path releases the executable, cwd and resources together. Failed or canceled cleanup keeps that same owner. No new actor lease or registry was introduced.
- Unix spawn at `process.rs:3775` uses `fchdir` on the retained descriptor in the fork-child pre_exec closure. There is no earlier Unix pathname current_dir dependency and no process-global cwd change or global lock. The closure uses async-signal-safe fchdir and the existing Linux fcntl operations.
- Linux continues clearing CLOEXEC only for its existing image and resource descriptor list. The cwd descriptor remains CLOEXEC and is absent from that list. The existing descriptor regression now verifies both properties. Image execution through procfs and inherited directory resources retain their existing behavior.
- macOS uses the same Unix descriptor cwd binding. Image launch-root materialization, sealed launch targets, resource pinning and materialized-file lifetime remain unchanged. The added macOS runtime test obtains a real authority-issued executable, materializes it through the production pinning path and probes normal, moved-and-missing and replaced cwd names through actual spawn_owned.
- Windows keeps the already validated no-delete parent handle alongside its sealed no-delete image handle and canonical launch path. Path-based CreateProcess/current_dir remains Windows-only. The parent handle is retained through the same ChildOwnership lifetime. No check-then-spawn validation workaround was added.
- The added Windows runtime test obtains the real executable through PathAuthority, attempts direct-parent and containing-directory renames while it is held, then exercises actual spawn_owned and relative native shell data reads. It includes an unchanged positive launch and verifies that confirmed reaping releases the handles so rename succeeds afterward. This directly tests the approved no-delete-parent premise. Local source did not disprove it, but Windows ancestor behavior remains a named runtime obligation until hosted execution.

Fixtures and regressions

The existing inherited-directory child harness now separates image preparation from native spawn. Its one UCI loop, Actor/Supervisor registration and physical reaping are reused. No second UCI or actor cleanup framework was added.

`catalog_install_repair5_replacement_before_spawn_uses_original_cwd` first publishes an independent managed replacement tree, resolves an original image/cwd, moves the original directory aside and puts the managed tree at the old cwd name before starting the real app-owned Actor. No directory-resource lease is supplied. After spawn it restores the exact managed provenance locator and verifies unchanged root, immediate-parent, tree and full inventory identities. The child reads only original relative data. Trusted reopen and native reconciliation collect the independent replacement tree, while the original child still reads its own data.

`catalog_install_repair5_moved_missing_cwd_before_spawn_uses_original_object` removes the original cwd pathname by rename before actual Actor spawn. Launch still succeeds through the held directory object and reads original relative data.

Both Linux tests capture worker assertions and confirm Actor/Supervisor physical reaping before propagating failure. The native Windows/macOS probe helper likewise reaps through the existing ChildOwner before propagating data errors. Rename and pinning assertions before spawn cannot orphan a child.

The existing Unix EngineExecutable test constructor now opens and retains a real cwd object. The entire process selector passed, including intentional spawn and post-spawn I/O failures, kill/reap retry and timeout coverage. The actual inherited-directory child regression is included in that selector. Removed-image cwd, historical resource, three-session, cleaning, alias and canonical spelling cases remain green in the catalog and path-authority selectors.

CR13, CR14 and CR15

- `registry_unique_id_count` is now `registry_admission_units` in every allowed caller and test. `RegistryAdmissionSnapshot.unique_ids` is now `admission_units`. The arithmetic, growth guard, error text and limits are unchanged. The genuinely deduplicating `unique_registry_id_count` helper retains its name and implementation. No other naming cleanup was performed.
- The capacity fixture at `catalog_install.rs:2552` seeds paths from the canonical native root stored by authority issuance. It retains one validated bounded setup candidate, real binding identities, persisted reopen verification, exact 4,096 admission units, production ResourceLimit refusal and usable existing-binding contents. It does not emulate Windows strings or lower a limit.
- The atomic image/cwd handoff test at `catalog_install.rs:2195` derives image and parent keys and identities from the validated registered StoredEntry. Native identity checks, one atomic write, zero-install evidence, write/sync refusal and same-binding retry assertions remain intact. Raw Windows tempdir spelling is no longer used as the expected map key.

Red-first and final source-only proof

`repair5-red-first.log` compiled before the production correction and returned status 101 with one behavioral failure. The pinned original image read `managed network` from the substituted cwd instead of `original cwd data`. The log confirms physical child reaping before propagation of the captured assertion. `repair5-tests-only.diff`, source snapshots and `repair5-tests-only-hashes.json` preserve that state.

Final reversals use Git-derived source-only patches with tests byte-identical. Each patch was reverse-checked and reverse-applied, then forward-checked and applied without offsets. Actual mutant hashes, test-suffix hashes and exact restored manifests were verified across mod, catalog, process, unchanged resolved and unchanged main. `repair5-proof-audit.json` records the audit. `repair5-proof-commands.log` records exact commands.

| Case | Removed behavior | Compiled behavioral red | Exact restored green |
| --- | --- | --- | --- |
| cwd | Only Unix launch fchdir binding | Status 101, native child reads empty relative data rather than original data | Status 0, 1 passed |
| cr9-guard | Renamed aggregate admission growth guard | Status 101, real new binding admitted at 4,098 | Status 0, 1 passed |
| cr9-baseline | Passing the pre-mutation admission baseline | Status 101, same real overflow with shared guard enabled | Status 0, 1 passed |

Removing fchdir leaves launch without an object cwd binding and therefore uses the parent process cwd. That final source-only mutant fails at the intended native data assertion. The separate initial red-first run demonstrates the original pathname-replacement failure specifically. Neither witness is a compile or fixture failure. Both confirm child reaping before test failure propagation.

Artifacts follow `repair5-CASE-source-fix.patch`, `repair5-CASE-red.log`, `repair5-CASE-green.log`, matching `.exit` files, `-reversed-hashes.json` and `-restored-hashes.json`. `repair5-reversal-plan.json` identifies selectors, paths and mutant/test hashes. All restored manifests equal `repair5-hashes-before-reversals.json`, which equals `repair5-final-hashes.json`.

Initial green runs are retained in `repair5-first-green.log` and `repair5-native-first-*.log`. No runtime fixture failure or compile failure was discarded. One generated apply_patch attempt for the mechanical rename was rejected before that rename applied because it used numeric unified hunk headers. It was corrected to apply_patch's expected context format. This preparation error was not regression evidence.

The older phase4/context1 evidence describes those earlier snapshots. Its hashes are not represented as matching this repair's new executable fields, canonical fixture keys, aggregate names or tests. New final hashes are contained only in the repair5 manifests. All earlier evidence was preserved. CR16 records qualification remains root-owned and was not edited here.

Final verification

All test commands below use `cargo test --manifest-path src-tauri/Cargo.toml --locked SELECTOR -- --nocapture`. Exact commands, actual statuses and log names are in `repair5-verification-statuses.json`. Every final command returned status 0.

| Selector/check | Result | Complete log |
| --- | --- | --- |
| catalog_install | 74 passed | repair5-final-catalog_install.log |
| infra::path_authority::tests | 284 passed | repair5-final-infra-path_authority-tests.log |
| fs::tests | 214 passed, 1 existing ignore | repair5-final-fs-tests.log |
| shutdown_ | 39 passed | repair5-final-shutdown_.log |
| engine::process::tests | 230 passed | repair5-final-engine-process-tests.log |
| cargo fmt --manifest-path src-tauri/Cargo.toml -- --check | Passed | repair5-final-fmt.log |
| git diff --check | Passed | repair5-final-diff-check.log |
| pnpm rust:windows:check | GNU compilation/clippy passed | repair5-windows-typecheck.log |

The existing ignored filesystem test requires an isolated user and mount namespace. The process log explicitly includes passing inherited-directory and spawn-I/O-failure cleanup tests. The final capacity fixture created 2,046 real bindings and 4,096 admission units in one durable setup, taking about 460 ms under the final full catalog run. Both admission reversals remain meaningful after canonical seeding and the rename.

`repair5-final-scoped.diff` contains only the three permitted changed sources. `repair5-final-git-status.txt` records those unstaged changes and root's preserved dirty handoff. No other source, manifest, generated, record or tooling changes were made.

Platform limits and remaining root proof

Real runtime proof here is Linux only. It uses actual app-owned Actors, pinned images, native cwd objects, complete managed inventories, authority reopen and trusted reconciliation. No crash, completed browser game or full-app verification is claimed.

The Windows GNU wrapper compiled and linted all-target test code, including native Windows tests and the corrected canonical fixtures. It did not execute Windows tests. Actual parent/ancestor no-delete behavior, normal native Windows cwd launch and Windows fixture assertions remain pending hosted runtime. macOS native movement/materialization tests were added but not compiled or run locally. No macOS runtime success or substitute-cwd safety is claimed from Linux.

Root still owns hosted Windows/macOS runtime, full pre-review, cumulative R6 closure, path-scoped commit and release. These are named platform proof limits, not an alternate mechanism or silent widening of ownership.
````

The changed consumer premise is actual pathname cwd selection after descriptor-derived identity capture. No source changes occurred between cumulative round5 and this focused first judgment. cwd1 was APPROVED with explicit Windows ancestor-sharing and macOS runtime limits. d-20261016-12 records the adopted mechanism. CR12 implementation and proof closure remain pending, not claimed by this private judgment. This does not create a fifth inherited plan round or reopen its fixed mandate. Root delegated the cohesive native repair to the same sensitive writer, including CR13–15. Root fixed CR16 by qualifying the pre-clippy hash snapshot while preserving all raw reports.

Plan authorship and arbitration shared one context. Detection ran on the same model family as the code in separate Codex sessions, without family separation.

#### mechanism-cwd-handoff.md

````text
# CR12 native cwd handoff correction

Private implementation mechanism candidate cwd1 at committed snapshot a88febeb1028854420bbf974f8bbdb4f4056f6e6. Frozen O1–O4 and d-20261016-11 remain unchanged. This is a focused implementation check after cumulative round5, not a new inherited-plan round. No source changes since that review.

Defect and evidence

Correctness and engine-protocol independently identify one gap. mod.rs:7870 records resolved.parent_identity in durable node evidence. engine_executable:6743 then retains a pathname as working_directory, and process.rs:3766 calls current_dir on it during later spawn. A completed parent replacement after resolution can start the pinned Linux image in a different managed tree. Its identity is absent from the recorded image/cwd node set, so the tree can be eligible after interruption even while the child uses relative data. The ordinary-operation threat includes a single completed substitution, without continuous malicious mutation. Source-derived scenario, no runtime reproduction yet. Existing cwd regression starts before moving its directory, so it misses this handoff.

Required shared contract

The working directory used for launch must be the same validated directory object whose identity was durably recorded before handoff. It stays owned by the EngineExecutable through the existing child cleanup owner until confirmed reaping. A stale pathname must never substitute another cwd. Do not broaden cwd to recursive ambient ownership or reintroduce blanket stale-node retention. Keep canonical authorization, image/resource sealing, spawn admission, physical ownership, all failure cleanup and deadlines.

Candidate

Carry the already validated retained parent descriptor from ResolvedPath into EngineExecutable rather than dropping it. Reuse parent() and a fallible clone or a private transfer accessor, never reopen a pathname to establish identity. The same object supplied parent_identity at the durable use boundary.

On Unix, set cwd by fchdir of this retained descriptor in the fork child immediately before exec, using the existing command pre_exec boundary. fchdir and the existing Linux fcntl loop are async-signal-safe. Do not change the parent's process cwd or use a global cwd lock. Unix spawn must not first depend on pathname current_dir, because a moved original directory should remain usable by descriptor. Linux continues inheriting only its existing image/resources descriptors, not a new ambient capability. macOS keeps existing managed image/file-resource materialization and uses the same Unix cwd object binding.

On Windows, retain the validated parent handle that was opened by open_windows_nofollow without FILE_SHARE_DELETE, alongside the existing sealed executable handle and launch pathname. Keep it through CreateProcess and the same owner lifetime. The held no-delete parent prevents its completed replacement while path-based CreateProcess establishes cwd. Verify this against actual Windows runtime tests, including parent and containing-directory rename attempts. If the existing handle sharing cannot seal the pathname binding, the candidate needs a narrowly stronger existing native open boundary before acceptance, not a check-then-spawn pathname race or an invented runtime claim. Do not add a registry or process-global lock.

Private field/accessor shape is executor-owned. Test fixtures must supply a real held cwd boundary without breaking deliberate spawn-failure cases. Existing canonical path authorization is still performed. Do not bypass workspace_entry_path or widen operation/capability scope.

Proof obligations

Add a real Linux child regression that resolves an executable and records its cwd, performs the reported completed replacement before spawn, then starts the actual app-owned Actor. Original cwd data is readable through relative access, replacement data is never consumed. Where useful restore exact managed-tree locator, root/parent/tree/inventory identities before trusted reopen to prove replacement tree remains collectible without affecting original child data. No separate directory-resource lease may mask cwd evidence. Source-only remove only the launch binding correction with all new tests unchanged, compiled behavioral red, exact restore green. Parent reaps the child before propagating every captured failure. Preserve existing removed-image cwd, historical recursive resource and three-session witnesses.

Unix/macOS tests prove original object or explicit safe refusal after movement, never substitute a different cwd. Windows tests attempt parent and ancestor replacement while EngineExecutable is held, assert no successful substituted launch and retain a normal native cwd positive control. Hosted rust-windows-test and rust-macos-test provide actual runtime proof, local Windows GNU compilation alone is insufficient. No claim of runtime approval before those jobs.

Also address independent round5 corrections in the same source package after mechanism approval: CR13 rename only the aggregate snapshot/counter to admission-unit names while keeping the genuinely unique_registry_id_count helper named correctly, preserve arithmetic/bounds. CR14 seed the capacity fixture using actual canonical authority-issued bindings, retain production overflow and usable reuse plus both guard reversals. CR15 derive expected image/cwd keys from validated registered binding rather than raw Windows temp spelling. Root handles CR16 records qualification.

Reversal path

If descriptor cwd is unavailable, return a typed pre-spawn error with cleanup, never silently fall back to a substituted pathname. If future evidence requires path-based semantics, it must include an equivalent object-binding proof and child lifetime preservation.
````

#### probe-cwd-handoff.txt

````text
No concrete plan defect found in cwd1.

CR12 correction-check: the proposed mechanism addresses the producer/consumer mismatch. `ResolvedPath` retains the parent used for durable identity capture (`resolved.rs:149`, `mod.rs:7870`). Carrying that descriptor into `EngineExecutable` and using Unix `fchdir` binds launch to the recorded object. Existing `ChildOwnership` retains the executable until confirmed reaping (`process.rs:778–801`). CR12 implementation closure remains pending.

Named platform limitation (confidence: 100): Windows resolution opens the executable’s parent without delete sharing (`resolved.rs:1035`, `mod.rs:3962`), but source inspection does not establish ancestor-replacement behavior. cwd1:19 and :27 correctly require native Windows rename/substitution tests and a positive launch control before runtime acceptance. macOS runtime behavior likewise remains unverified.

The replacement-before-spawn regression and source-only reversal required by cwd1:25 would exercise the missed handoff. No files changed or tests run. Review used the code author’s model family in a separate session.

VERDICT: APPROVED
````

REVIEWED_THROUGH a88febeb1028854420bbf974f8bbdb4f4056f6e6. All eleven required lenses completed through the selected executor. Six adopted witnesses, four new unique corrections and continued CR12. Rounds so far r1=6 r2=1 r3=3 r4=2 r5=6. The separate precommit integration check added CR11/CR12 without replacing inherited plan rounds. No Skip or Defer. Elapsed wall 334.565 seconds.

CR10 and CR11 CLOSED with explicit reviewer evidence. CR9 remains open only for the Windows fixture correction. CR12 remains open for actual cwd launch binding, witnessed by correctness and engine-protocol as one cause, plus its Windows regression key. Adopt Fix for all six witnesses. CR13 describes admission-unit naming in the shared counter and snapshot. CR14 describes raw Windows keys in the capacity fixture. CR15 describes raw Windows keys in the image/cwd assertion. CR16 qualifies the stale hash-equality statement as the pre-clippy snapshot. Code-quality labels its naming witness blocker, root treats this as a naming correction while preserving raw severity. All other prior closures stand, subject to affected-mechanism review. Sixteen unique corrections total. The actual cwd uses pathname at spawn despite descriptor-derived evidence, so root pauses patches for a fresh focused mechanism judgment.

Plan authorship and arbitration shared one context. Detection ran on the same model family as the code in separate Codex sessions, without family separation.

#### Round 5 correctness

````text
CR9 CLOSED — Admission uses the pre-mutation baseline. The capacity regression checks refusal at 4,096 units and usable reuse of an existing binding (confidence: 98).

CR10 CLOSED — Durable originating-session bindings survive reopen and attachment retirement. Publication preserves those sessions, and shutdown clears only its own evidence (confidence: 97).

CR11 CLOSED — Startup eligibility reevaluates unresolved durable uses through the shared relation. The ancestor-substitution regression exercises this independently of publication markers (confidence: 97).

CR12 NOT CLOSED — Recorded cwd identity can disagree with the directory actually handed to the child.

[blocker] src-tauri/src/infra/path_authority/mod.rs:7870 — The new cwd context records the retained parent’s identity, but `EngineExecutable` retains only its pathname and launch later calls `.current_dir(working_directory)` (`engine/process.rs:3766`). On Linux, resolve `/R/X/engine`, rename directory X away, publish a new managed tree at `/R/X`, then resume launch. The held executable runs with the **new tree** as cwd, while durable evidence identifies the old directory and image. Neither identity belongs to the new inventory, so the new object-only predicate returns Disjoint (`catalog_install.rs:271`). After an interrupted session and trusted restart, collection can delete that unchanged tree while the surviving child uses its relative data. This requires one completed replacement before spawn, not continuous mutation. The captured context and actual launch must agree (confidence: 93).

Limitations: the replacement-before-spawn case is source-derived, not reproduced. Windows/macOS runtime branches were not executed. No tests or writes ran. Review shares the code’s model family.

VERDICT: REVISE
````

#### Round 5 root-cause

````text
CR9 CLOSED — `catalog_install.rs:537` captures admission before mutation and counts bindings plus session markers. Both guard and baseline reversals admit 4,098 units and fail behaviorally. Restored code refuses growth while existing-binding reuse succeeds.

CR10 CLOSED — `mod.rs:8804` persists unresolved uses independently of install records and authority retirement. Publication preserves originating sessions, and shutdown clears only its own evidence atomically. The three-session real-child regression fails without serialization and passes after restoration.

CR11 CLOSED — `catalog_install.rs:768` reevaluates durable uses during cleanup eligibility. The completed ancestor-substitution regression loses child-readable data when this lookup is removed and passes after restoration.

CR12 CLOSED — `catalog_install.rs:242` distinguishes object-only uses from recursive resources. `mod.rs:7863` captures executable image and held-parent cwd identities together before handoff. Stale-node, cwd and terminal-directory reversals fail behaviorally and pass after restoration. Inventory validation still preserves added or modified content.

No new root-cause defect or reintroduced prior fix found. The impacted alias, historical-binding, cleaning-refusal and canonical-spelling protections remain intact.

Named limitation (confidence: 100): runtime evidence is Linux-only. Reopen models session boundaries without an actual crash. Hosted platform runtime and real-app verification remain pending. This read-only review examined saved proof without rerunning tests. Review and implementation share the Codex model family, and plan authorship and arbitration shared one context.

VERDICT: APPROVED
````

#### Round 5 tests

````text
CR9 CLOSED — `catalog_install.rs:2400` asserts production overflow refusal at 4096 and reads bytes through an existing binding. Removing either the growth guard or admission baseline produces behavioral failure at 4098.

CR10 CLOSED — `catalog_install.rs:1731` crosses zero-install handoff, authority retirement, B’s successful shutdown and C’s trusted startup. Removing use serialization makes the real child’s data assertion fail.

CR11 CLOSED — `catalog_install.rs:1827` isolates post-publication reachability while preserving deletion identities and inventory. Removing eligibility’s durable-use lookup makes the child read empty data.

CR12 CLOSED — `catalog_install.rs:1924` asserts unrelated-tree reclamation despite stale file uses. Separate tests cover actual cwd retention, terminal-directory recursion, cleaning refusal and changed-inventory preservation. Saved source reversals fail the corresponding assertions.

No new findings. Tests are reachable through `catalog_install` and the full backend gate.

Limitations: reviewed source and saved logs without executing checks. Runtime witnesses are Linux-only, reopen models sessions without an actual crash, and completed-game, real-app and final release proof remain pending (confidence: 100). Review shares the implementation’s model family. Plan authorship and arbitration shared one context.

VERDICT: APPROVED
````

#### Round 5 error-handling

````text
CR9 CLOSED — `catalog_install.rs:2399` exercises actual capacity refusal with typed `ResourceLimit` and successful existing-binding reuse. Examined reversal logs show overflow at 4,098 when either admission protection is removed.

CR10 CLOSED — `catalog_install.rs:537,593,731` atomically persists originating-session evidence, refuses failed or uncertain handoff, retries uncertainty and clears only the current session. Zero-install fault tests and the three-session child regression cover the missing boundary.

CR11 CLOSED — `catalog_install.rs:768` reevaluates unresolved durable uses during eligibility. Inspection uncertainty conservatively retains trees. The examined reversal loses child-readable data after completed ancestor substitution.

CR12 CLOSED — `catalog_install.rs:260` distinguishes object-only bindings from recursive resources. `mod.rs:7863` captures executable and held-parent cwd contexts in one durable candidate. Tests cover stale-node exclusion, cwd protection, atomic persistence refusal and independent inventory preservation.

No new error-handling defects found. Cleanup failures retain retry state, log the install id and cause, and return an error from the helper. The startup caller intentionally preserves already successful owner reconciliation under d-20261016-04.

Limitations: read-only source and supplied evidence review, with no tests executed here. Runtime evidence is Linux-only and models session transitions by reopening authority. Actual crashes, Windows/macOS runtime and full-app behavior remain unverified by this review (confidence: 100). Review and implementation share the Codex model family. Plan authorship and arbitration shared one context.

VERDICT: APPROVED
````

#### Round 5 minimalism

````text
CR9 CLOSED — The capacity test exercises production refusal at 4096 and usable existing-binding reuse. Setup uses one bounded candidate through existing commit machinery (`catalog_install.rs:2393`). Confidence: 98.

CR10 CLOSED — Durable uses share the existing registry, admission, atomic commit and session-clear paths. The three-session regression crosses prepublication handoff and authority retirement (`catalog_install.rs:1750`). Confidence: 96.

CR11 CLOSED — Startup eligibility consults durable uses through the same `reaches` relation used by publication and handoff (`catalog_install.rs:767`). No parallel collector mechanism was added. Confidence: 97.

CR12 CLOSED — Object membership, recursive resource scope and executable cwd contexts feed that shared relation and one atomic handoff candidate (`catalog_install.rs:246`, `mod.rs:7863`). Confidence: 96.

No retained bloat or duplication findings. The added `catalog_install.rs` owns a cohesive lifecycle domain. Inlining it would relocate the code without reducing required behavior. I found no substantial removable portion preserving O1–O4.

Limitations: read-only source and supplied-evidence review, with no independent test execution or platform runtime verification. Closure statements are limited to this lens. Review used the code author’s model family, without family separation. Confidence: 100.

VERDICT: APPROVED
````

#### Round 5 code-quality

````text
CR9 CLOSED within this lens — shared admission and usable reuse are explicit in `catalog_install.rs:2400`.

CR10 CLOSED within this lens — durable originating-session ownership and atomic clearing are documented and exercised at `catalog_install.rs:537`, `:731` and `:1731`.

CR11 CLOSED within this lens — collection explicitly reevaluates durable uses, with the ancestor-substitution regression at `catalog_install.rs:1827`.

CR12 CLOSED within this lens — object membership, recursive resources and separate image/cwd contexts are distinguishable in the producer and shared relation.

[blocker] src-tauri/src/infra/path_authority/mod.rs:9275 — `registry_unique_id_count` now returns admission units rather than unique IDs. Two bindings from one originating session contribute four units because the session is counted separately for each binding. The `RegistryAdmissionSnapshot.unique_ids` field repeats this misleading description at the growth guard. Rename both to describe admission units, preserving the counting behavior. (confidence: 97)

Limitation — read-only source review, no runtime verification performed. Author and reviewer share the Codex model family, so family separation is absent (confidence: 100).

VERDICT: REVISE
````

#### Round 5 engine-protocol

````text
CR9 CLOSED — `catalog_install.rs:2400` exercises actual shared-capacity refusal through `engine_resource`, then successfully reads an existing durable binding at capacity. Admission uses the premutation baseline at `:546`.

CR10 CLOSED — use evidence persists independently of installs, preserves originating sessions across reopen and authority retirement, and projects those sessions during publication. The three-session child regression at `catalog_install.rs:1731` crosses the required boundary. Shutdown clears only its own evidence after successful teardown.

CR11 CLOSED — collection reevaluates unresolved durable bindings at `catalog_install.rs:768`. The completed-ancestor-substitution regression at `:1831` covers relationships formed after publication without changing the recorded tree or inventory.

CR12 NOT CLOSED — object-only classification and recursive terminal-directory capture are repaired, but the recorded cwd identity need not identify the directory actually handed to the child.

[blocker] src-tauri/src/infra/path_authority/mod.rs:7870 — cwd protection records the resolved parent descriptor’s identity, while `EngineExecutable` retains only its pathname and `engine/process.rs:3766` launches with `.current_dir(working_directory)`. Concrete Linux interleaving: publish an unowned managed tree T, resolve an independent engine in directory A, then move A aside and temporarily move T onto A’s pathname before spawn. The engine executes A’s pinned image but starts inside T. Restore both directories after spawn, then interrupt the application while that child survives. On restart, durable image/cwd evidence identifies A, so T is classified Disjoint and its unchanged inventory permits deletion while the child still uses T for relative data. The cwd regression starts the child before moving its directory and does not cover this handoff mismatch. This violates O2’s live-child protection despite durable evidence being written successfully (confidence: 94).

Limitations: source review only, with no tests or processes run and no files changed. The interleaving above is source-derived, not reproduced. Windows/macOS runtime and completed GameManager/browser-game behavior remain unverified.

VERDICT: REVISE
````

#### Round 5 ipc-contract

````text
CR6 remains CLOSED within this lens — cleaning refusal still requires confirmed membership in `catalog_install.rs:611`. Uncertain relationships retain protection without refusing unrelated engine resolution.

No IPC-contract defects found. Rust command signatures, generated invoke keys and renderer callers agree. Progress remains registered, correlated and percentage-based, with listener cleanup. No new renderer parameters, events, commands or capability scopes were introduced.

CR9–CR12 concern native admission and lifetime semantics. This lens found no contract regression from their corrections and does not independently certify their broader closure.

Limitations: read-only source review, no tests or runtime verification performed. No files changed. Reviewer and code share the same model family in separate sessions.

VERDICT: APPROVED
````

#### Round 5 tauri-security

````text
CR9 CLOSED — `src-tauri/src/infra/path_authority/catalog_install.rs:545` captures admission before mutation. The capacity regression at `:2400` checks real overflow refusal and usable existing-binding reuse. Inspected reversal logs show admission at 4,098 when the baseline is removed, followed by restored green (confidence: 98).

CR10 CLOSED — `src-tauri/src/infra/path_authority/mod.rs:8804` serializes unresolved bound uses independently of install records. Publication preserves originating sessions, and `catalog_install.rs:731` clears only the current session through the successful-shutdown boundary. The three-session reversal loses child-visible data, while restoration passes (confidence: 97).

CR11 CLOSED — `src-tauri/src/infra/path_authority/catalog_install.rs:768` reevaluates durable uses during collection eligibility. The completed ancestor-substitution regression preserves exact cleanup identities and inventory, demonstrating why publication markers alone were insufficient. Inspected reversal and restoration logs confirm the correction (confidence: 97).

CR12 CLOSED — `src-tauri/src/infra/path_authority/catalog_install.rs:257` preserves physical and inventory identity membership while excluding unrelated stale nodes. `mod.rs:7836` derives directory recursion from the terminal descriptor, and `:7863` records executable cwd separately in the same durable candidate. Inspected node and cwd reversals fail behaviorally and pass after restoration (confidence: 96).

Impacted CR4/CR6–CR8 closures remain intact. Cleaning refusal requires confirmed membership, uncertainty retains protection, and deletion independently checks root, tree and complete inventory before descriptor-relative removal.

No new defects found within this lens.

Limitations: read-only source and supplied evidence review, with no tests rerun. Runtime evidence is Linux-only and models sessions through reopen, without an actual crash. Continuous hostile mutation between validation and unlink remains outside the frozen threat model. No refresh-token flow is introduced. Review used the code author’s model family in a separate session, with no family separation. No files changed.

VERDICT: APPROVED
````

#### Round 5 platform-semantics

````text
CR9 NOT CLOSED — the capacity fixture uses raw path keys that differ from Windows resolution keys.

CR10 CLOSED — durable bindings retain originating sessions across reload, publication and own-session clearing. The three-session child witness is Linux-only.

CR11 CLOSED — startup eligibility reevaluates durable uses through the shared relation at `catalog_install.rs:768`. The substitution witness is Linux-only.

CR12 NOT CLOSED — production captures image and cwd atomically, but its cross-platform regression has a Windows path-key mismatch.

[should-fix] src-tauri/src/infra/path_authority/catalog_install.rs:2425 — On Windows, the capacity fixture seeds bindings using raw tempdir paths, while production resource resolution returns canonical, verbatim-prefixed paths. Because the key includes pathname and identity, reuse of `existing` creates another binding at capacity and returns `ResourceLimit`, making the unwrap at line 2450 fail. Seed the fixture from authority-issued canonical bindings. (confidence: 99)

[should-fix] src-tauri/src/infra/path_authority/catalog_install.rs:2102 — On Windows, this lookup reconstructs image and cwd keys from the raw tempdir spelling. Registration canonicalizes their parent, and resolution persists that canonical spelling. Equal identities do not make these tuple keys equal, so the regression panics on a missing map entry. Derive expected keys from the validated registered binding. (confidence: 99)

Limitations: no checks ran during this read-only review. Recorded final pre-review reports Windows GNU compilation/clippy passing, but that cannot detect these runtime failures. No non-Linux Unix source-probe result was supplied. Windows and macOS runtime proof remains pending in `rust-windows-test` and `rust-macos-test`, with `rust-platform` providing compile/lint evidence. Review used the code’s model family without family separation.

VERDICT: REVISE
````

#### Round 5 records

````text
[should-fix] tasks/handoffs/2026-10-16-catalog-engine-retention-review.md:2415 — The statement that final source hashes match the worker restoration manifest is stale after the disclosed clippy cleanup. At a88febeb, catalog_install.rs hashes to `8cc5b680…4807ddb8`, while `phase4-context1-platform-final-hashes.json` records `ef7eca0e…f9e1f8d9`. Qualify this equality as applying to the pre-clippy root-proof snapshot. The retained test counts and seven reversal results check out (confidence: 99).

VERDICT: REVISE
````


P4 final pre-review gate-p4-prereview.oIXa98 returned status 0, including Windows GNU compilation and clippy. The first attempt gate-p4-prereview.gxsSRd returned 101 for redundant_pattern_matching in one new legacy test. The same worker changed only that assertion to is_err, preserving production bytes and test semantics, then passed its targeted test, formatting and diff checks. The earlier source-only reversals used the unchanged equivalent assertion form. The final catalog test-suffix hash is cbd0a0b2c12135f6a48068a3fb16e70eb245f59aa1f3f94e77d43128c4748744, so the earlier whole-test suffix restoration manifest describes the pre-clippy snapshot rather than the committed test bytes. No gate failure is discarded.

#### P4 exact clippy cleanup report

````text
Changed only the assertion in [catalog_install.rs:2337](/home/felixb/Projekte/chessfable.worktrees/drain/src-tauri/src/infra/path_authority/catalog_install.rs:2337):

```diff
-        assert!(matches!(
-            f.authority
-                .engine_executable(&engine, PathOperation::EngineExecute),
-            Err(_)
-        ));
+        assert!(f
+            .authority
+            .engine_executable(&engine, PathOperation::EngineExecute)
+            .is_err());
```

All requested checks returned **0**:

- Formatting check
- Targeted legacy-absence test, 1 passed
- `git diff --check`

Hash verification confirms every other byte is unchanged. Changes remain unstaged. Previous evidence and foreign work were preserved.

Final test-suffix SHA256:
`cbd0a0b2c12135f6a48068a3fb16e70eb245f59aa1f3f94e77d43128c4748744`
````

P4 addresses CR9 and CR10 from cumulative round 4, then CR11 and CR12 from the focused precommit integration check. The latter two are separate private implementation findings, not new rounds in the inherited frozen-plan history. d-20261016-10 and d-20261016-11 record the approved contracts. No Skip or Defer. Cumulative reviewer closure remains pending.

Root inspected both allowed-source diffs and the execution trace. Native contexts enter one durable candidate, startup eligibility reads durable uses, and independent exact-locator inventory checks remain the deletion authority. Root independently passed 72 catalog, 284 authority, 214 filesystem with one existing ignore, 39 shutdown and one inherited-directory child test, plus formatting and global diff checks. Canonical gate-p4-proof.FrFDmF has completion status 0. The allowed-source hashes at that pre-clippy root-proof snapshot match the worker restoration manifest. The equivalent assertion cleanup above changed the later test bytes, with its separate final test-suffix hash recorded explicitly.

Plan authorship and arbitration shared one context. Detection ran on the same model family as the code in separate Codex sessions, without family separation.

#### phase4-before-context.txt

```text
Implemented CR9/CR10 in [catalog_install.rs](/home/felixb/Projekte/chessfable.worktrees/drain/src-tauri/src/infra/path_authority/catalog_install.rs) and [mod.rs](/home/felixb/Projekte/chessfable.worktrees/drain/src-tauri/src/infra/path_authority/mod.rs). Changes remain unstaged. Foreign work was preserved.

Bound uses now persist terminal identity, recursion and originating sessions in the existing Registry before handoff, including zero-install use. Reopen and attachment retirement preserve them. Publication projects all unresolved sessions. One atomic lifecycle handles marking and own-session clearing, with conservative failure handling and admission measured before mutation.

Final verification returned status 0 throughout:

| Selector/check | Result |
|---|---:|
| `catalog_install` | 65 passed |
| `infra::path_authority::tests` | 284 passed |
| `fs::tests` | 214 passed, 1 existing ignore |
| `shutdown_` | 39 passed |
| Inherited-directory child | 1 passed |
| Formatting and diff checks | Passed |

Source-only reversals compiled and failed behaviorally with tests unchanged. Removing serialization reproduced the three-session child-data loss. Removing either admission enforcement or the new pre-mutation baseline admitted a binding at 4,098 units. Exact bytes were restored and all corresponding green reruns passed. Children were reaped before failure propagation.

[Full evidence, implementation trace, commands, logs, patches and hash manifests](/tmp/build-de5be974-c551-48bb-b87c-30caf1642a05/phase4-implementation-evidence.md).

Runtime proof is Linux-only native session-state proof. No actual crash, browser or completed-game claim. Hosted Windows/macOS proof and cumulative closure remain root obligations. No scope deviation.
```

#### phase4-implementation-evidence.md

```text
CR9 and CR10 bounded implementation evidence

Only `src-tauri/src/infra/path_authority/catalog_install.rs` and `src-tauri/src/infra/path_authority/mod.rs` changed in the workspace. Both remain unstaged. The pre-existing handoff change belongs to root and was preserved. No main, resolved, process, renderer, manifest, generated, rule, plan or ledger edits were made. No skills, agents, external messages, stage, commit or push operations were used.

The supplied four rules, frozen O1–O4 plan and final approved durable-prepublication mechanism govern this correction. No contract question remained unresolved. There is no implementation scope deviation. The additional admission-baseline reversal is focused evidence for the required pre-mutation baseline.

Data and lifecycle trace

- `catalog_install.rs:10` retains the single bound-use collection. Its key is native pathname plus terminal identity pair. Each value maps originating session UUID to a boolean. True includes recursive contents. Different identities at one spelling remain separate, repeated same-session use deduplicates, and recursion only broadens.
- `catalog_install.rs:14` gives that collection a private serializable view, using the existing NativePath and Identity shapes. `mod.rs:4181` adds the default-empty field to the existing Registry. This is evidence of unresolved use, not a path capability or deletion authority.
- `catalog_install.rs:20` validates absolute native paths and components, nonzero identity pairs, nonempty valid UUID sessions and unique bindings. Count and byte validation reject oversized use evidence. Each binding and each session marker contributes to shared identifier admission at `catalog_install.rs:500`. Derived install users are also counted. Existing 4,096 identifier, 16 MiB write and 64 MiB legacy read limits remain unchanged, including the existing non-growing legacy allowance.
- The existing successful-resolution capture at `mod.rs:7849` remains unchanged. It obtains the actual terminal identity from the validated held file or directory descriptor, with the retained Unix observed identity fallback. It never reopens a pathname to recover use identity and does not substitute the root entry identity for resolved child components.
- Before resolve returns a child-use value, `protect_catalog_path` at `catalog_install.rs:562` clones and broadens the originating session's evidence and relevant derived markers. `commit_catalog_state` at line 516 captures admission before either live collection changes, validates the candidate and commits both through existing Registry atomic replacement. This applies with zero install records.
- Write failure restores both collections. Uncertain marking retains conservative candidate evidence and the existing pending-durability flag, but returns an error. Same-binding retry sees that flag and must establish durability. An already durable unchanged binding does not consume capacity or require an additional use insertion.
- `mod.rs:5003` validates and reloads all original sessions. Existing production attachment reconciliation around line 7606 retires unowned resources into process-local `retired_attachments`. Registry serialization around line 8779 excludes those retired authority entries but independently serializes the scope uses at line 8791. Owner reconciliation and retirement never remove scope use.
- Publication at `catalog_install.rs:664` projects every matching unresolved originating session through the unchanged shared historical-binding relation into the new install's users. Publisher B does not replace A. Membership and uncertainty conservatively protect. Confirmed membership alone triggers cleaning refusal. Identity-distinct replacements, moved aliases and exact missing reservations retain their earlier semantics.
- `clear_catalog_session_use` at `catalog_install.rs:699` removes only the current UUID from both the scope collection and derived install users in one lifecycle candidate. Failed or uncertain clearing restores conservative in-memory evidence for both collections. Successful clearing durably removes both. The unchanged production shutdown wrapper provides teardown, cancellation and deadline ordering.
- The process-local catalog protection cache remains a subset of bounded install records. No second registry, journal, timer, actor lease, PID scan, new IPC or pathname deletion authority was introduced. Exact root, descriptor, no-follow and inventory cleanup authority remains unchanged.

Behavioral additions

Seven new phase4 tests remain in the source. The prior phase3 inherited-directory child setup and reaping were extracted into one shared Linux fixture at `catalog_install.rs:1502`. The UCI loop and native descriptor handoff are not copied.

- Three authority sessions cross the missing boundary. A hands a real directory lease to a real EngineActor child before any provenance exists. B opens before publication, runs production startup attachment reconciliation, proves the resource left persistent authority and serialized entries, publishes, and completes its real successful shutdown wrapper. C opens with trusted owner reconciliation and proves the new data remains readable through A's inherited descriptor and A's marker survives without B's marker. The parent reaps the child before propagating worker assertion failures.
- Initial zero-install write and parent-sync failures refuse handoff twice, followed by successful same-binding retry, reopen and publication under the original session.
- Nonrecursive use broadens durably to recursive use. Write failure and sync uncertainty refuse broadened handoff. Later narrower use cannot shrink protection or allocate another binding.
- A and B use one binding. Failed and uncertain B clear retain conservative in-memory scope and derived state, while the on-disk candidate keeps the two evidence forms coherent. Successful B clear and later C clear preserve A through pruning and reopen.
- Legacy missing scope evidence defaults empty, preserves unresolved per-install users and does not recreate retired executable authority.
- Production Registry open rejects relative paths, parent traversal, zero identity, invalid session, empty session set, invalid native encoding or platform, duplicate binding, excessive sessions, excessive bindings and oversized encoded evidence.
- Pre-registered valid handles fill real shared admission through successful production resource resolutions. At 4,096 units, a new binding returns ResourceLimit while an already durable binding returns a lease whose native contents are read successfully. Both bindings and their session markers count. The older distinct-reused-path assertion now counts the binding and its session separately.

Red-first and source-only reversal evidence

`phase4-red-first.log` and `.exit` preserve the initial compiled run before the durable source implementation. Status 101 reports one capacity control passed and two behavioral failures. The zero-install handoff wrongly succeeded under an injected persistence fault. The three-session child's second read returned empty contents after C collected the new data. Reaping confirmation preceded propagation of the captured worker failure. `phase4-tests-only.diff`, the two tests-only source snapshots and `phase4-source-hashes-tests-only.json` retain that starting point.

Each later reversal keeps all tests byte-identical. Patches were generated with Git diff against a source-only mutant, then applied with `git apply --reverse --check` and `git apply --reverse`. Exact forward checks and applications restored the source. No offset application occurred. The command logs, actual reversed hashes, mutant manifests, restored manifests and `phase4-proof-hash-audit.json` preserve the sequence.

| Reversal | Source delta removed | Compiled behavioral red | Exact restored green |
| --- | --- | --- | --- |
| CR10 | Registry emits empty scope evidence instead of serializing the bound-use collection | Three-session test status 101, child sees empty contents after C reconciliation, child reaped | One test passed, status 0 |
| CR9 shared guard | Shared identifier growth enforcement disabled temporarily | Capacity test status 101, real new binding admitted at 4,098 | One test passed, status 0 |
| CR9 phase4 baseline | New lifecycle passes no pre-mutation admission baseline, leaving shared guard enabled | Capacity test status 101, real new binding admitted at 4,098 | One test passed, status 0 |

The CR10 artifacts are `phase4-cr10-source-fix.patch`, `phase4-cr10-reversal-commands.log`, `phase4-cr10-reversed-red.log` and `phase4-cr10-restored-green.log`, with matching `.exit` files. The CR9 shared-guard artifacts use the same suffixes under `phase4-cr9-`. The baseline artifacts use `phase4-cr9-baseline-`, with its commands included in `phase4-baseline-and-final-commands.log`. The baseline mutant emitted an unused-variable warning but compiled and failed on the capacity assertion. No compile failure is counted as regression proof.

`phase4-source-hashes-before-reversals.json` and `phase4-source-hashes-final.json` are identical. They include both changed sources and their test suffixes, plus unchanged main, resolved and process source hashes. All three restored manifests match. The final scoped patch is `phase4-final-scoped.diff`.

Final verification

All five test commands use `cargo test --manifest-path src-tauri/Cargo.toml --locked SELECTOR -- --nocapture`. Exact commands, results, statuses and log names are also recorded in `phase4-verification-statuses.json`. Every command below returned status 0.

| Selector or check | Final result | Full log |
| --- | --- | --- |
| catalog_install | 65 passed | phase4-green-catalog_install.log |
| infra::path_authority::tests | 284 passed | phase4-green-infra-path_authority-tests.log |
| fs::tests | 214 passed, 1 ignored | phase4-green-fs-tests.log |
| shutdown_ | 39 passed | phase4-green-shutdown_.log |
| spawned_engine_reads_a_directory_resource_through_the_authorized_value | 1 passed | phase4-green-spawned_engine_reads_a_directory_resource_through_the_authorized_value.log |
| cargo fmt --manifest-path src-tauri/Cargo.toml -- --check | Passed | phase4-green-fmt.log |
| git diff --check | Passed | phase4-green-diff-check.log |

The existing ignored filesystem test requires an isolated user and mount namespace. Initial green runs are retained separately in `phase4-focused.log`, `phase4-catalog-first.log` and `phase4-initial-*.log`. No failed runtime fixture or compile attempt was discarded. An early patch-construction attempt was rejected before applying source changes and was corrected. It was not regression evidence. An earlier progress message misstated the filesystem test count as 106, corrected to 214 passed and one ignored. This report and final status JSON use the actual log counts.

Platform and proof limits

Runtime proof was Linux only, using real filesystem objects, production authority entrypoints, EngineActor and Supervisor, and the actual inherited-directory descriptor behavior. Authority reopen models the durable native session-state boundary without killing the test process. No actual application crash, browser run or completed game is claimed. Existing Windows case-alias tests remain present but did not run on Linux. Hosted Windows and macOS execution, root cumulative review, full pre-review, app verification, release gates and installation remain root obligations.

All phase4 artifacts reside in this run scratch. Earlier phase and review artifacts were not overwritten. `phase4-final-git-status.txt` records only the two permitted source changes plus root's preserved foreign handoff change, all unstaged.
```

#### phase-4.txt

```text
Implemented CR11/CR12 in [mod.rs](/home/felixb/Projekte/chessfable.worktrees/drain/src-tauri/src/infra/path_authority/mod.rs:7836) and [catalog_install.rs](/home/felixb/Projekte/chessfable.worktrees/drain/src-tauri/src/infra/path_authority/catalog_install.rs:242). Changes remain unstaged. Foreign handoff work is preserved.

Executable image and validated cwd identities now enter one atomic handoff candidate. Directory resource recursion follows the actual terminal descriptor. The shared predicate combines physical membership with complete inventory identities, excludes unrelated stale nodes, and preserves recursive uncertainty. Collection now consults unresolved durable uses directly.

All required commands returned status 0:

| Check | Result |
|---|---:|
| `catalog_install` | 72 passed |
| Path authority | 284 passed |
| Filesystem | 214 passed, 1 existing ignore |
| Shutdown | 39 passed |
| Inherited-directory child | 1 passed |
| Formatting and diff checks | Passed |

Seven source-only reversals compiled and failed behaviorally, including eligibility, stale-node retention, cwd capture and refreshed CR9/CR10 witnesses. Tests stayed unchanged during each reversal. Exact restoration and green reruns passed. Children were reaped before failure propagation.

The capacity test fell from **50.93 seconds to 0.18 seconds**, retaining real native bindings and production overflow/reuse assertions.

[Complete trace, logs, preserved failures, patches, hashes and fixture adjustments](/tmp/build-de5be974-c551-48bb-b87c-30caf1642a05/phase4-context1-evidence.md).

No scope deviation. Runtime proof is Linux-only. Hosted platform proof and cumulative closure remain root obligations.
```

#### phase4-context1-evidence.md

```text
P4 root integration repair1 evidence for CR11 and CR12

The approved final use-context and eligibility mechanism was implemented within the frozen O1–O4 contract. Only `src-tauri/src/infra/path_authority/catalog_install.rs` and `src-tauri/src/infra/path_authority/mod.rs` changed. Both remain unstaged. Root's foreign handoff changes were preserved. No helper submodule, persistent category, registry, timer, process scan, actor lease, IPC or deletion authority was added. Main, resolved, process, renderer, tasks, scripts, manifests, gates and generated files were not edited. No skills, agents, messages, ledger, stage, commit or push operations were used. No unresolved contract question or scope deviation remains.

Shared capture, predicate and lifecycle trace

- `mod.rs:7836` derives explicit recursive resource use from EngineResourceRead plus the actual resolved directory descriptor. It no longer substitutes the stored root's purpose or shape for the successfully resolved terminal object.
- Terminal identity still comes from the validated retained file or directory descriptor, with the existing retained Unix observed-file identity fallback. Executable contexts additionally capture `resolved.parent_identity()` at `mod.rs:7870`. That accessor reads the already retained validated parent descriptor. The parent's pathname is only the locator. Identity is never recovered by reopening it.
- Execution and configuration, plus the existing regular-file EngineInstall use boundary, supply image and cwd as separate node contexts. Cwd does not recursively own sibling installations. Explicit directory resources remain recursive. No new context mode or persistent schema category was needed.
- `protect_catalog_path` at `catalog_install.rs:583` delegates to the same `protect_catalog_contexts` implementation at line 593. All contexts are classified before mutation. Confirmed membership in cleaning state refuses with typed Conflict. Affected records are deduplicated, then all bound uses and derived markers enter one candidate.
- The existing `commit_catalog_state` at line 537 captures admission before live-state mutation and atomically commits the scope collection plus install markers. Initial zero-install durability, same-binding retry after uncertainty, monotonic recursion, distinct reused-path identities, original-session ownership, rollback and own-session clear remain shared. One executable handoff test counts one atomic write containing both image and cwd, and verifies write and parent-sync refusal plus retry.
- The shared `reaches` predicate at `catalog_install.rs:242` first preserves actual filesystem membership, including added objects. Recorded tree identity and every complete managed-inventory identity provide positive object membership. A known node absent from that complete managed identity set is Disjoint even if its old spelling vanished or rebound. This does not infer disjointness for unprovable recursive directory use.
- Negative node evidence cannot authorize deletion. Collection still independently opens the exact recorded root and tree, verifies identity and the complete current inventory, and preserves changed or added content. The new hard-link addition test proves that node exclusion can permit eligibility while the independent inventory check preserves the user data and original managed contents.
- Publication at line 696 still projects matching historical uses under their originating sessions. Existing per-install users remain conservative and are never reclassified away. `clear_catalog_session_use` at line 731 still clears only the current session in the same atomic lifecycle.
- Collection at lines 744 and 768 now reevaluates all unresolved durable binding/session uses through the shared relation when determining eligibility. Member or Uncertain retains. This runs under the existing serialized authority boundary and covers relationships formed after publication. Retained native authorities and process protection remain additional conservative consumers.
- Exact missing reservations, replacement-root identity isolation, canonical spelling, supplemental aliases, no-follow cleanup, inventory checks, partial-cleanup retry and typed adoption refusal remain in place. Earlier catalog, shutdown and filesystem regressions pass.

Native regressions

Seven new context1 tests remain, bringing the catalog selector from 65 to 72 tests.

- `catalog_install_context1_eligibility_rechecks_completed_ancestor_substitution` uses the app-owned real inherited-directory child. Its image and cwd are in a separate probe directory. A's explicit resource is unrelated at publication, with no A-derived marker and every A use classified Disjoint then. B retires the resource through production attachment reconciliation and completes the real successful shutdown wrapper. A completed substitution moves an unchanged intermediate container under the leased directory and restores the original absolute root path. The test proves unchanged root identity, immediate-parent identity, tree identity and complete inventory. C opens afterward, trusts startup owners and retains data the child reads through its real inherited descriptor.
- `catalog_install_context1_stale_file_nodes_do_not_own_unrelated_installs` covers both deleted and independently replaced file spellings. A's real explicit File lease stays open across reopen and authority retirement. B publishes an independent tree and clears successfully. C collects that tree, no A marker was projected, A's durable scope survives and the original lease still reads original bytes.
- `catalog_install_context1_removed_image_cwd_keeps_relative_data_without_resource` starts a real image from staging with native cwd and no directory-resource lease. The image is removed before inventory. That same cwd object becomes the managed tree. Reopen and attachment retirement leave relative data readable. The image identity is absent from inventory, while cwd is recorded separately as a node. Removing only cwd capture makes the child lose its relative data.
- `catalog_install_context1_added_file_membership_still_refuses_cleaning` confirms physical membership and typed Conflict for a user-added file absent from managed inventory.
- `catalog_install_context1_image_and_cwd_are_one_durable_handoff` proves one atomic write for both contexts, persisted native identities, zero-install evidence, and write/sync failure refusal with same-binding retries.
- `catalog_install_context1_directory_read_uses_actual_terminal_scope` resolves a directory component through a transient grant without EngineResource root purpose. The selected terminal directory owns nested contents recursively while an unselected sibling remains independent.
- `catalog_install_context1_node_exclusion_still_preserves_changed_inventory` adds a hard link into a published tree, then removes the old node spelling. The node relation is Disjoint, but the independent inventory check preserves both the added bytes and original managed bytes, relinquishing provenance without deleting the changed tree.

The existing inherited-directory probe is shared across old and new tests. Its single UCI loop supports either an explicit resource or actual cwd. The real Actor and Supervisor perform native startup and reaping. Worker failures are captured, and the parent confirms physical reaping before propagating them. A shared Linux-only successful-session helper uses the actual production teardown and catalog-clear wrapper.

Fixture adaptations and retained failures

`phase4-context1-red-first.log` compiled and returned status 101 with one positive control passed and three intended failures. These exposed missing eligibility lookup, stale-node projection and missing cwd evidence. Child reaping was confirmed before captured failures propagated.

`phase4-context1-first-green.log` is retained despite its name. It returned status 101 with 64 passed and five failed. Four failures were old assumptions superseded by the approved node/resource semantics. The fifth was a new clean-session fixture timeout under concurrent load. None is presented as source-reversal proof.

The CR6 unrelated-engine tests now require durable image/cwd scope evidence without falsely projecting those nodes into an unrelated unavailable cleaning tree. The explicit cleanup helper reports its genuine missing-root I/O error and preserves provenance. Retained recursive uncertainty is still tested using an explicit directory resource. The monotonic-broadening test now starts from an actual executable cwd node, then broadens that same directory to recursive resource use. It retains write/sync refusal and retry assertions. These are faithful fixture adjustments to the approved semantics, not removal of failure isolation or recursive protection.

The shared successful-session fixture budget changed from 5 to 20 seconds to accommodate concurrent test work. Production deadline and cancellation code were untouched. Existing bounded timeout and shutdown tests remain green. The shared helper is Linux-gated to match all its callers. After that final test-only portability annotation, every reversal and the full required verification were repeated against the final exact bytes. Earlier preparation and verification artifacts remain available. One apply_patch context attempt failed before applying edits and was corrected. No compile failure is counted as behavioral proof.

Capacity proof and measured cost

The existing CR9 fixture now creates actual native directory bindings and commits one valid bounded candidate through existing registry machinery. It reopens the persisted setup and compares all use evidence and actual shared admission. There are 2,046 real bindings, their session markers and four pre-registered native authority entries, totaling 4,096 units. No bound or count is fabricated or lowered.

Production `engine_resource` must reject a new binding with ResourceLimit while returning an already durable binding whose native contents are read successfully. Both shared-guard removal and pre-mutation-baseline removal still admit a real binding at 4,098 and fail the unchanged assertion.

`phase4-context1-performance.json` links the measured logs. The prior focused capacity test took 50.93 seconds. The final focused capacity green took 0.18 seconds, with 147.48 ms setup. Setup under the final full catalog run took 249.16 ms. The full 72-test catalog selector took 2.93 seconds. The first concurrent repair attempt's 8.50-second fixture setup and timeout remain honestly preserved in its log.

Source-only reversal evidence

The final evidence uses the `phase4-context1-platform-` prefix. `reversal-plan.json` names every selector, changed source, Git-derived patch, mutant source hash and unchanged test-suffix hash. Each patch was reverse-checked and reverse-applied without offsets, then forward-checked and applied for exact restoration. Actual reversed manifests and restored manifests are retained per case. `phase4-context1-proof-audit.json` verifies compiled behavioral failures, unchanged tests, child reaping where applicable and exact restoration across both allowed sources plus unchanged main, resolved and process files.

| Case | Removed source behavior | Behavioral red | Restored green |
| --- | --- | --- | --- |
| eligibility | Durable-use lookup at collection | Child reads empty data after completed substitution | 1 passed |
| node | Object-only exclusion using complete managed identities | Independent managed tree remains retained by a stale file node | 1 passed |
| cwd | Only cwd context capture | Resource-free child loses relative data after reopen | 1 passed |
| cr9-guard | Shared identifier growth guard | Real handoff crosses capacity at 4,098 | 1 passed |
| cr9-baseline | Passing the pre-mutation baseline | Same real overflow while shared guard stays enabled | 1 passed |
| cr10 | Serialization of durable prepublication uses | Three-session child loses data after C reconciliation | 1 passed |
| directory | Actual-terminal directory recursion | Transient-directory resource scope is wrongly nonrecursive | 1 passed |

Every red returned status 101 after successful compilation with one behavioral test failed. Every restored green returned status 0. Temporary cwd and baseline mutants emitted unused-variable warnings, but failures were behavioral assertions. Logs follow `phase4-context1-platform-CASE-red.log` and `-green.log`, with corresponding `.exit`, `-source-fix.patch`, `-reversed-hashes.json` and `-restored-hashes.json` files. `phase4-context1-platform-proof-commands.log` retains all exact commands. The earlier seven-case pass before the final Linux-only test-helper annotation is retained separately under `phase4-context1-CASE-*`.

`phase4-context1-platform-hashes-before-reversals.json` equals `phase4-context1-platform-final-hashes.json`. Final allowed source hashes are mod.rs `906b8f25152ffb030f26b3f54d682ea93c98c536d8b3cc370767e5f1a804f4d8` and catalog_install.rs `ef7eca0e803466dad0629947681680b1ff2f60b960293fd1e1265172f9e1f8d9`. Test suffix hashes and untouched boundary files are included in those manifests.

Final required verification

All test commands use `cargo test --manifest-path src-tauri/Cargo.toml --locked SELECTOR -- --nocapture`. Exact commands, results, statuses and full log names are in `phase4-context1-verification-statuses.json`. All commands returned status 0.

| Selector/check | Result | Full log suffix after phase4-context1-platform-final- |
| --- | --- | --- |
| catalog_install | 72 passed | catalog_install.log |
| infra::path_authority::tests | 284 passed | infra-path_authority-tests.log |
| fs::tests | 214 passed, 1 existing ignore | fs-tests.log |
| shutdown_ | 39 passed | shutdown_.log |
| spawned_engine_reads_a_directory_resource_through_the_authorized_value | 1 passed | spawned_engine_reads_a_directory_resource_through_the_authorized_value.log |
| cargo fmt --manifest-path src-tauri/Cargo.toml -- --check | Passed | fmt.log |
| git diff --check | Passed | diff-check.log |

The ignored filesystem test requires an isolated user and mount namespace. Root's foreign handoff remains preserved in `phase4-context1-final-git-status.txt`. The cumulative allowed-source patch is `phase4-context1-final-scoped.diff`, with the incremental change from the immutable P4 snapshot in `phase4-context1-incremental-from-phase4.diff`. All older phase4 and review artifacts were preserved.

Platform limits

Runtime witnesses were Linux only, with real filesystem identities, real descriptor inheritance, actual native cwd and app-owned EngineActor children. Authority reopen models native durable session boundaries. No actual process crash, browser session or completed game is claimed. Windows/macOS compilation and runtime execution were not performed by this leaf. Existing platform-specific alias tests remain present. Hosted jobs, cumulative review, pre-review, app verification, gates, commit and release remain root obligations.
```
