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
