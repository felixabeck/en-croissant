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


### Final records closure and gate attempt 1


### GL1 independent proof before correction closure

Root verified exactly two redundant borrow removals in the Linux-only tests::InheritedDirectoryChild::prepare_image helper. The production prefix remains byte-identical with SHA25659f406e302250bc2678c4a382ed9f7c21e87bb6f675aa9b3ebb5dbd677eb9b22. Root independently passed all-target Linux clippy with warnings denied, all74catalog tests, formatting and global diff checks. Canonical gate-final-lint-proof.MU80zJ completed0. New source matches final-lint-final-hashes.json exactly. This repairs a standard compiler lint observed at101 in the original gate, with no runtime behavior change or new test. Earlier native-app118checks describe unchanged production behavior, not the later test-source hash. Full final gates will rerun after committed closure.

The worker's audit notes one indentation preparation slip corrected before checks and an overly strict whole-status assertion that noticed root's own handoff edit. Its scoped source audit passed and root records were preserved. Those are not behavioral failures or evidence of foreign source contamination. Plan authorship and arbitration shared one context. Detection ran on the same model family as code in separate Codex sessions, without family separation.

#### GL1 worker report

````text
Changed only the two test borrows in [catalog_install.rs](/home/felixb/Projekte/chessfable.worktrees/drain/src-tauri/src/infra/path_authority/catalog_install.rs:1633), left unstaged:

```diff
-            fs::set_permissions(&script, fs::Permissions::from_mode(0o700)).unwrap();
+            fs::set_permissions(script, fs::Permissions::from_mode(0o700)).unwrap();
-                .register_engine_file(&script, "Resource child")
+                .register_engine_file(script, "Resource child")
```

All requested checks exited **0**:

- Clippy with warnings denied
- Catalog tests: **74 passed**
- Formatting check
- Diff check

[Commands and statuses](/tmp/build-de5be974-c551-48bb-b87c-30caf1642a05/final-lint-commands.log), [clippy log](/tmp/build-de5be974-c551-48bb-b87c-30caf1642a05/final-lint-clippy.log), [catalog log](/tmp/build-de5be974-c551-48bb-b87c-30caf1642a05/final-lint-catalog.log).

Byte comparison confirms exactly the requested changes and an unchanged production prefix. Full before/after SHA256 values are in the [hash manifest](/tmp/build-de5be974-c551-48bb-b87c-30caf1642a05/final-lint-final-hashes.json). Runtime semantics are unchanged.

An initial indentation slip was corrected before checks. The final audit also detected a foreign handoff file becoming dirty. It was untouched. Both observations are recorded in the [audit](/tmp/build-de5be974-c551-48bb-b87c-30caf1642a05/final-lint-final-audit.json). No stage or commit.
````

R8 at8ccb04a4 was inconclusive because the caller prohibited all process execution while requiring shell file reads. The report established no factual defect and adopted count is0. It is preserved without pretending provider failure, quota failure, code revision or approval. Root corrected only assignment permissions and ran distinct same-revision R9 evidence closure using the original CR17 delta. R9 APPROVED, CR17CLOSED, zero new findings. No source changed. Counts remain17unique corrections and gapless diff_adopted_per_round r1=6 r2=1 r3=3 r4=2 r5=6 r6=0 r7=1 r8=0 r9=0. Original inherited plan counts remain r1=3 r2=0 r3=0 r4=0.

The first full push gate ran on clean reviewed8ccb04a4 with all Rust/frontend/bindings flags. Guard0.2s, setup0, frontend build6.3s, bindings28.0s, contract92.8s, backend tests83.5s, backend coverage140.0s, frontend coverage60.4s, bundle0.4s and container e2e40.5s passed. Backend coverage ratchet and floors passed. Linux clippy failed101 at two redundant test-helper borrows, catalog_install.rs:1633 and1636. This is GL1, a gated lint repair, not a new adopted lens finding or a runtime mechanism change.

Root gracefully cancelled only the owned scheduler117182 after other proof lanes passed, so the remaining frontend mutation workspace-storage package ended143 from SIGTERM. It is not a green mutation result or an independent mutation defect. Canonical gate-push-gate.F85q0n completion143 is retained, with scope agent-gate-117182-1792122994492799.scope verified inactive/dead before any edit. No gate child or tracked-file rewriter remained. The actual failure transcript is artifacts/gates/20261016T035634554Z-117182/rust-lint.log. An earlier poll used an incorrect nonexistent attempt path and provided no gate evidence, the actual F85q0n attempt was then polled canonically. No gate or receipt was invented from that monitoring error.

Root delegated exactly the two test-only borrow removals to the same sensitive writer. Root still owns independent proof, pre-review, committed correction closure and a fresh complete final gate run. Native app proof from17d7574d remains evidence for unchanged production behavior, its118checks are not claimed as a build of later test-only bytes. Delivery remains pending at this repair checkpoint. Plan authorship and arbitration shared one context. Detection ran on the same model family as the code in separate Codex sessions, without family separation.

#### lens-records-r8.txt

````text
CR17 NOT CLOSED — verification blocked. File access is available only through shell process execution, which this assignment prohibits. No file-reading resources are exposed.

The corrected sentence, chronology, named contracts, saved R6/R7 reports and native-app log remain unverified. No factual defect established, and no files changed.

VERDICT: REVISE
````

#### lens-records-r9.txt

````text
CR17 CLOSED — `tasks/handoffs/2026-10-16-catalog-engine-retention-review.md:2578` explicitly identifies app verification as pending at the historical R6 checkpoint and points to the completed later proof. The saved app log contains 118 successful checks and `all checks passed`. R6/R7 reports remain byte-preserved, and only the handoff changed since source snapshot `17d7574d`.

No new factual defects found. Historical pending statements remain valid history. Final gates, hosted runtime, push and installation remain pending.

Limitations: canonical gate completion was not independently verified. Historical coverage was selective. Review shares the author’s model family in a separate session. No files changed or checks rerun.

VERDICT: APPROVED
````

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

## Windows runtime correction and confirmed capability joiners

The full three-flag local push gate completed0 at1a4305ed. This source was pushed normally to master. Exact source Test run38851003688 passed macOS runtime and all three platform compile/lint jobs. Windows runtime job116811964157 failed20tests with1441passed and7ignored. The native Windows cwd launch test passed. Generic Linux test remained running at this update. Installation and exit-ledger delivery have not occurred, so this is an intermediate source delivery record, not a completed drain.

The Windows failure is traced into13raw fixture-root spelling cases,2nested resource terminal-kind failures,2moved-root fixture spelling cases,1normalized malformed-path case and2missing absent-target InstallRename injection cases. Strict canonical identity and spelling are preserved. The exact handled finding f-20260914-12 was reopened through the locked writer because its original mandate explicitly includes nested directories. Archive/executable historical closure remains history. No new duplicate finding was filed. WK1 focused review adopted WK-I1 three missing platform source assertion consumers and WK-I2 missing explicit history. WK2 includes them and closes both. Decision d-20261016-13 records the typed native kind in the single NT primitive, with FileOrDirectory limited to final EngineResourceRead under directory authority. Native runtime acceptance remains pending.

The reopened pick selected candidate joiners f-20260917-05 and f-20260920-01. Their source fixes both edit resolved.rs, so Ranking6 confirms them. The former is revalidated lens→build for the unresolved shared carrier contract, without downgrading any escalation. A separate capability plan is reviewed inside the active build. This does not rewrite the frozen adopted f021 plan, its one original phase, or inherited r1–r4 metrics. The original skipped f-20261001-05 remains open, its renderer file was not edited.

J1 plan review ran12lenses and adopted JI1, identity-bound outer staging cleanup ownership, witnessed by plan and tauri-security, and JI2, absent-only actual catalog publication, witnessed by plan. JI3 code-quality wording about source parent versus source directory is contract-neutral and closed by arbiter, retained for diff review. Semantic adoption is3witnesses across2uniqueissues, plus1wording witness. Other lenses approved or validly reported class-specific NOT APPLICABLE. No Skip or Defer.

J2 preserves newly appearing destinations at the actual commit boundary, closing JI2. Its proposed creation-time outer staging owner was refuted by plan, correctness, root-cause and error-handling: normal extraction exchanges the initial outer directory for a separately owned extracted tree. The unchanged outer identity cannot span that commit. JI1 is NOT CLOSED, and contrary source evidence supersedes the other J2 lenses' intended-contract closures without erasing their reports. Root stopped patching after the second failed JI1 mechanism and requested fresh review-plan judgment on returning the existing extractor-owned tree directly, deleting the unnecessary intermediate publication. That judgment and a final plan correction remain pending at this record. J2 opens no new issue ID and is not counted as a newly adopted finding. No implementation of the capability plan has started.

WF1 partially repaired fixtures and the actual Windows test-only fault hook. The initial requested canonical accessor was private, so the writer correctly removed unbuildable fixture edits and reported partial completion. Root then authorized one shared test-only canonical AppOwnedRoot constructor using existing AppDataDir acquisition, preserving the raw constructor and private production accessor. WK2 implementation and complete fixture proof are still running at this record. No platform runtime success is inferred from Linux or GNU compilation.

Plan authorship and arbitration shared one root context. Detection ran on the same model family as code in separate Codex sessions, without family separation. No provider/quota fallback occurred. Raw reports and plan snapshots below are JSON strings, preserving decoded bytes exactly, including original verdicts and proof limitations. R10 raw reports preserve all11APPROVED and GL1closure at1a4305ed, they do not review later Windows source bytes.

```json
{
  "joiner-plan-plan-r1.txt": "[blocker] /tmp/build-de5be974-c551-48bb-b87c-30caf1642a05/joiner-plan-r1.md:47 — O2 omits the actual staging cleanup owner. `src-tauri/src/fs.rs:1446` retains a `TempDir` and passes only `staging.path()` into publication. Its destructor recursively removes that pathname (`tempfile-3.26.0/src/dir/mod.rs:498`). Replace the staging directory after inventory validation: the proposed installer correctly refuses its changed identity, then the caller deletes the replacement during cleanup. Updating the held-parent facade cannot prevent this while that caller remains unchanged. Include its ownership transition in the plan and verify preservation after cleanup completes. (confidence: 99)\n\n[blocker] /tmp/build-de5be974-c551-48bb-b87c-30caf1642a05/joiner-plan-r1.md:46 — O2 builds on an installer behavior that violates the legacy-directory preservation promised at line 56. Catalog publication checks destination absence at `src-tauri/src/infra/path_authority/catalog_install.rs:655`, but the shared driver independently accepts an existing directory at `src-tauri/src/infra/fs.rs:861`. A directory created between those observations becomes the replacement target, gets exchanged at `infra/fs.rs:2226`, and is recursively deleted at `infra/fs.rs:928`. Source identity pinning does not close this window. Specify preservation of a destination appearing during publication and require behavioral proof for that interval. (confidence: 97)\n\nSource-only review. No files changed or runtime checks run. Reviewer and author share a model family.\n\nVERDICT: REVISE",
  "joiner-plan-correctness-r1.txt": "No correctness defects found in J1’s O1/O2 contracts (confidence: 89).\n\nTraced puzzle carrier production through cache probing, snapshot loading and deletion exclusion. Traced catalog inventory identity through the proposed held-parent installer and existing commit-aware cleanup. The stated contracts handle parent substitution and source replacement without weakening ordinary database validation.\n\nLimitation: implementation does not exist yet. Policy selection, descriptor transfer and native Windows/macOS behavior require implementation review and the assigned runtime proof (confidence in this limitation: 100).\n\nRead the named rules, decision entries, plan, probe and relevant source/tests. No writes or tests performed. Concurrent fixture changes were left untouched. Review used the same model family as authorship, without family separation.\n\nVERDICT: APPROVED",
  "joiner-plan-root-cause-r1.txt": "No root-cause blocker found in J1. O1 removes both puzzle pathname re-walks. O2 preserves the catalog-validated parent and staging identity through installation. The plan explicitly preserves prior fixes for ordinary database containment, POSIX locks and commit-aware cleanup.\n\nLIMITATION — Evidence is source-only. No implementation or failing-before/passing-after results exist yet. Approval covers the proposed mechanism, pending the planned regression and platform proof (confidence: 100).\n\nReview used the same model family as authorship. No files changed or tests run.\n\nVERDICT: APPROVED",
  "joiner-plan-tests-r1.txt": "The planned O1 rename-success and O2 post-inventory substitution tests would catch reverts of their respective fixes. Runtime evidence remains pending implementation.\n\nVERDICT: APPROVED",
  "joiner-plan-error-handling-r1.txt": "No error-handling defects found in J1. O1 preserves typed conflict, I/O and cancellation propagation. O2 preserves precommit refusal, rollback and committed-durability uncertainty through the shared installer.\n\nLimitation: source-only plan review cannot establish implementation or Windows runtime behavior (confidence: 100). No files changed or tests run. Reviewer and author share a model family.\n\nVERDICT: APPROVED",
  "joiner-plan-minimalism-r1.txt": "No bloat or duplication findings in J1. The smallest sufficient change matches O1/O2: distinguish puzzle carrier validation, move cache-key construction into its blocking closure, and share held-parent installation between catalog publication and `OwnedStagingDir`. No added files are proposed.\n\nLimitation: implementation size and duplication remain for diff review. This review used source inspection only, with no writes or tests. Reviewer and author share a model family.\n\nVERDICT: APPROVED",
  "joiner-plan-code-quality-r1.txt": "[should-fix] /tmp/build-de5be974-c551-48bb-b87c-30caf1642a05/joiner-plan-r1.md:46 — “source and retained destination parent are the same object” ambiguously compares the staging directory with its parent. Say “verified staging parent and retained destination parent” to match the existing installer’s `source_parent` versus `parent` comparison and distinguish parent identity from staging identity. (confidence: 96)\n\nVERDICT: APPROVED",
  "joiner-plan-engine-protocol-r1.txt": "NOT APPLICABLE: O1 changes puzzle database carriers in `mod.rs`, `resolved.rs`, and `puzzle.rs`. O2 changes descriptor-relative archive publication in `catalog_install.rs`, `resolved.rs`, and `infra/fs.rs`. Neither obligation changes engine process supervision, UCI sequencing, runtime engine keys, or asynchronous analysis-result routing.\n\nRead-only source review only. No changes or tests. Reviewer and author share the same model family.\n\nVERDICT: APPROVED",
  "joiner-plan-ipc-contract-r1.txt": "NOT APPLICABLE: Plan O1/O2 change private retained filesystem carriers and catalog installation in `path_authority/{mod,resolved,catalog_install}.rs`, `infra/fs.rs`, and `puzzle.rs`. Neither obligation changes IPC commands, payloads, events, subscriptions, generated bindings, or Tauri permission scopes.\n\nVERDICT: APPROVED",
  "joiner-plan-tauri-security-r1.txt": "[blocker] src-tauri/src/fs.rs:1452 — O2 secures installation but leaves the captured `TempDir` owning pathname-based recursive cleanup. On Unix, replacing the validated parent after inventory with a directory containing the same staging leaf makes `TempDir::drop` delete that replacement subtree outside the authorized root, even when descriptor-relative installation succeeds. The locked tempfile 3.26.0 implementation calls `remove_dir_all(self.path())`. Require identity-bound cleanup ownership through publication, disarming pathname cleanup, and a substitution regression covering success and failure. The shared installation facade alone cannot secure this separate owner. (confidence: 95)\n\nSource-only plan review. No files changed or tests run. Credential/session flows are unchanged by this slice. Review used the same model family as authorship, with no family independence claimed.\n\nVERDICT: REVISE",
  "joiner-plan-platform-semantics-r1.txt": "No platform-semantics findings against J1’s O1/O2 contract. The retained-boundary mechanism and Windows rename-refusal coverage are consistent with the inspected platform branches.\n\nProof remains pending. No tests, compilers or gates ran during this read-only review. Neither `pnpm rust:windows:check` nor the non-Linux Unix source probe has evidence for this unimplemented slice. Runtime acceptance requires exact-SHA `rust-windows-test`, `rust-macos-test` and relevant `rust-platform` jobs.\n\nInspected the plan, source probe, named rules and decisions, and all five supplied source files with connected tests. No files changed. Existing modifications in `infra/fs.rs` and `catalog_install.rs` were preserved.\n\nReview and implementation share a model family in separate sessions. No family independence is claimed.\n\nVERDICT: APPROVED",
  "joiner-plan-pgn-index-r1.txt": "NOT APPLICABLE: Plan O1/O2 changes retained filesystem authority for puzzle database access and catalog installation in path_authority, infra/fs.rs, catalog_install.rs and puzzle.rs. It changes no PGN scanning, byte offsets, move encoding, database storage format, search predicates or import boundaries.\n\nVERDICT: APPROVED",
  "joiner-plan-plan-r2.txt": "[blocker] JI1 NOT CLOSED — tasks/plans/.plan-retained-capability-joiners-r2.body.md:47 requires the immediately adopted outer staging identity to survive download, but normal extraction replaces that directory. `src-tauri/src/fs.rs:1407` creates the outer staging target, `fs.rs:679` passes its leaf to extraction, and `fs.rs:1790` installs a separately owned inner tree onto it. The Unix installer exchanges directory identities at `src-tauri/src/infra/fs.rs:2226` and removes the displaced original at `infra/fs.rs:928`. Consequently, the proposed outer owner retains the emptied predecessor’s identity while catalog inventory observes the extracted replacement at `src-tauri/src/infra/path_authority/catalog_install.rs:689`. Enforcing J2’s identity equality rejects an ordinary successful download. Define the ownership handoff across this existing inner commit and require download-through-publication proof, including failure cleanup. This contrary source trace changes J2’s premise that one unchanged staging identity spans extraction. (confidence: 99)\n\nJI2 CLOSED — J2’s absent-only commit contract at tasks/plans/.plan-retained-capability-joiners-r2.body.md:48 addresses the earlier race while preserving generic replacement. Existing platform commits already support no-replace publication when no original target is admitted, at `src-tauri/src/infra/fs.rs:2229` and `infra/fs.rs:3774`. The explicit destination policy supplies the missing distinction.\n\nLimitation: source-only review of J2. No writes, tests, compilers or runtime verification performed. Review and authorship share a model family. (confidence: 100)\n\nVERDICT: REVISE",
  "joiner-plan-tauri-security-r2.txt": "JI1 CLOSED — J2 O2 at tasks/plans/.plan-retained-capability-joiners-r2.body.md:47 requires immediate outer staging adoption, disarmed pathname cleanup, and the same identity-bound owner through publication and cleanup. Line 62 requires substitution preservation through success and failure destructors.\n\nJI2 CLOSED — J2 O2 at tasks/plans/.plan-retained-capability-joiners-r2.body.md:48 requires absent-only publication at the retained-parent commit boundary, preserving newly appearing destinations while ordinary installers retain replacement behavior.\n\nNo additional security defects found in the revised obligations. Source-only plan review, with no writes or tests. Implementation and runtime proof remain outstanding. Reviewer and author share the same model family.\n\nVERDICT: APPROVED",
  "joiner-plan-correctness-r2.txt": "[blocker] JI1 NOT CLOSED — tasks/plans/.plan-retained-capability-joiners-r2.body.md:47 — A normal ZIP download replaces the initially adopted `.archive` directory: `extract_zip_cancellable` creates a different `.zip` identity, then `install_extracted_tree` installs it over `.archive` (`src-tauri/src/fs.rs:1599,1649,1789`). TAR follows the same path. Retaining the initial owner and requiring inventory/publication to use its exact identity therefore rejects legitimate downloads. Line 52 explicitly preserves this inner extraction behavior. Specify an identity-bound ownership handoff from extraction to publication, including committed durability uncertainty and destructor cleanup. (confidence: 99)\n\nJI2 CLOSED — J2 line 48 explicitly requires absent-only publication at the retained-parent commit boundary, preserving a newly appearing destination with a typed conflict while retaining ordinary installer replacement behavior.\n\nLimitation: source-only plan review. Implementation and native runtime behavior remain unverified (confidence: 100). No writes or tests performed. Reviewer and author share a model family.\n\nVERDICT: REVISE",
  "joiner-plan-root-cause-r2.txt": "[blocker] JI1 NOT CLOSED — tasks/plans/.plan-retained-capability-joiners-r2.body.md:47 — Immediate adoption pins the empty outer `.archive` directory, but normal extraction replaces that directory with the separately owned `.zip` or `.tar` tree. `src-tauri/src/fs.rs:679–715` invokes extraction, whose `install_extracted_tree` consumes the inner owner through `install_owned_staging_dir`. That installer disarms the inner owner after replacing and removing the original outer directory. Consequently, the retained outer owner has the wrong identity for catalog inventory, publication and failure cleanup. Keeping its original identity refuses normal publication or leaves extracted data unowned. Reacquiring the later pathname would violate J2’s explicit prohibition and restore the substitution gap. Specify an identity-bound ownership handoff from the extraction producer, or preserve the originally adopted object throughout extraction. The current “inner extraction is unchanged” obligation does not resolve this dependency. (confidence: 99)\n\nJI2 CLOSED — J2 explicitly requires absent-only publication at the actual retained-parent commit boundary, with a typed conflict preserving a newly appearing destination. Ordinary installer replacement remains explicit, preserving the prior behavior documented in d-20260918-10.\n\nLIMITATION — Source and history establish the ownership mismatch. No implementation or failing-before/passing-after evidence exists for J2, and no tests were run. Historical commit `00b1617cb` confirms the existing inner-owner lifecycle. No files changed. (confidence: 100)\n\nVERDICT: REVISE",
  "joiner-plan-tests-r2.txt": "J2’s proposed proofs would catch reverts: puzzle reads must succeed after parent rename, substituted trees must survive actual outer-owner destruction, and a destination appearing before commit must remain intact.\n\nThis approves the planned proof. Tests and runtime evidence remain pending implementation. Review used the same model family as the author.\n\nVERDICT: APPROVED",
  "joiner-plan-error-handling-r2.txt": "[blocker] JI1 NOT CLOSED — tasks/plans/.plan-retained-capability-joiners-r2.body.md:47 retains ownership of an identity that normal extraction replaces. `download_file_core_control_with_integrity` installs the inner tree onto `.archive` through `install_extracted_tree`. If extraction then returns committed-durability uncertainty, or cancellation prevents final publication, the proposed outer owner’s destructor checks the original identity, logs a cleanup conflict, and leaves the extracted tree without catalog provenance. Specify identity-bound ownership transfer across this legitimate replacement, including committed-error exits. Retaining the creation-time identity cannot provide the promised failure cleanup. (confidence: 97)\n\nJI2 CLOSED — J2 line 48 requires absent-only publication at the actual retained-parent commit boundary, preserving a concurrently appearing destination and returning a typed conflict.\n\nLimitation: source-only plan review. No implementation or native runtime verification performed.\n\nVERDICT: REVISE",
  "joiner-plan-minimalism-r2.txt": "No bloat or duplication defects found in J2. The outer staging ownership transfer reuses `OwnedStagingDir`. The shared installer has two required consumers with distinct destination policies. Removing either addition would lose required containment or preservation coverage. No new files are proposed.\n\nLimitation: implementation size and actual duplication require diff review (confidence: 100). Source inspection only, no writes or tests. Author and reviewer share a model family.\n\nVERDICT: APPROVED",
  "joiner-plan-platform-semantics-r2.txt": "JI1 CLOSED — J2 O2 requires immediate adoption of the actual outer staging owner, disarms pathname cleanup after adoption, and preserves substituted trees through success and failure destructors.\n\nJI2 CLOSED — J2 O2 requires absent-only publication at the retained-parent commit boundary while preserving replacement behavior for ordinary installers.\n\nNo platform-semantics findings against J2. These are plan-contract closures, with implementation proof pending.\n\nNeither `pnpm rust:windows:check` nor the non-Linux Unix source probe ran for this slice. Runtime proof requires exact-SHA `rust-windows-test`, `rust-macos-test` and relevant `rust-platform` jobs.\n\nInspected the supplied plan, delta, history, rules, decisions and connected source/tests. No files changed or tests run. Review shares the author’s model family in a separate session.\n\nVERDICT: APPROVED",
  "windows-terminal-kind-review.txt": "[blocker] windows-terminal-kind-candidate.md:7 — The typed request and delegated wrapper break three unaddressed consumers in `src-tauri/src/infra/platform_support/tests.rs`. Line 971 requires `directory:false`, line 1335 requires direct primitive delegation and sharing construction inside `open_windows_child`, and line 1641 requires the boolean kind expression. WK1 replaces all three shapes but excludes this test file from FILES. Include it and adapt the existing assertions while retaining their sharing, containment and synchronous-I/O guarantees. (confidence: 100)\n\n[should-fix] windows-terminal-kind-candidate.md:1 — The packet lacks explicit cumulative review history and current open issue IDs. “Fresh mechanism review” identifies WK1 but does not supply those required inputs. Provide the history and IDs, or explicitly declare them empty. The frozen plan’s earlier Reviews cannot establish the active build’s issue state. (confidence: 100)\n\nThe proposed restrictions fit the traced resolver: mixed kind only for a final `EngineResourceRead` beneath `root_is_dir`, definite directory intermediates and archive destinations, and non-directory file roots retaining identity validation (`resolved.rs:1067`, `resolved.rs:1130`). No cwd mechanism change is needed.\n\nRead-only review completed. No files changed or tests run. Native Windows acceptance remains unverified. Detection shares the code’s model family in a separate session, with shared plan-author arbitration context.\n\nVERDICT: REVISE",
  "windows-terminal-kind-review-r2.txt": "WK-I1 CLOSED — WK2:13 includes all three affected source assertions at `src-tauri/src/infra/platform_support/tests.rs:971`, `:1335`, and `:1641`, requires adaptation without weakening their guarantees, and retains native acceptance at WK2:15.\n\nWK-I2 CLOSED — WK2:19 records both prior findings, Fix dispositions, the raw report, inherited review status, and current issue IDs.\n\nNo new plan defects found. WK2:9 restricts mixed kind to final `EngineResourceRead` beneath `root_is_dir`, preserves definite directory traversal/archive destinations, and retains non-directory file roots plus expected identity validation, matching `resolved.rs:1018`, `:1067`, and `:1130`.\n\nLimitation — WK2’s native runtime result remains unverified. The supplied CI log proves the earlier failures, not corrective success (confidence: 100). No writes, tests, compilers, gates, or live queries ran. Detection shares the code’s model family in a separate session.\n\nVERDICT: APPROVED",
  "probe-windows-ci-clusters.txt": "The twenty failures map to five cause clusters: **13 fixture-spelling failures, 2 production terminal-kind failures, 2 moved-root fixture failures, 1 malformed-case construction failure, and 2 missing fault-hook failures.**\n\nThe supplied Windows log reports **1441 passed, 20 failed, 7 ignored**. The native cwd test passed. Windows runtime acceptance remains open and the installer remains withheld. No files changed, and no tests, compilers, gates, application processes or live queries ran.\n\n| Cluster | Exact failed-test membership | Cause and distinction | Bounded fix sites |\n|---|---|---|---|\n| Download root spelling — **13** | `fs::tests::` **download_activation_failure_records_target_durability_uncertainty**, **download_post_verification_stale_or_replaced_lease_preserves_published_artifact**, **download_verification_failure_primary_error_survives_stale_or_cleared_lease**, **download_verification_failure_records_failed_progress_and_quarantines_intent**, **production_download_core_matrix_keeps_success_and_error_tails_after_caller_drop**, **reservation_cleanup_unavailability_keeps_the_reservation_and_exact_warning**, **runtime_callers_pin_download_target_replacement_durability_override**, **staged_artifact_activation_failure_records_target_durability_uncertainty**, **staged_artifact_cancels_at_real_install_precommit_without_publication**, **staged_artifact_keeps_postrename_result_and_activation_after_late_cancellation**. `chesscom::tests::` **cleared_terminal_progress_cannot_replace_committed_success**, **dropped_callers_retain_success_and_publication_error_terminal_tails**, **publication_ignores_expired_staging_deadline_and_late_cancellation** | Fixtures issue raw TempDir spellings through test-only `AppOwnedRoot::new`. Reservation re-proves a canonical binding and rejects the spelling difference. Later injection waits are consequently never reached. **Fixture-only on this traced path.** | The two fixture builders at [fs.rs:5200](/home/felixb/Projekte/chessfable.worktrees/drain/src-tauri/src/fs.rs:5200) and [chesscom.rs:556](/home/felixb/Projekte/chessfable.worktrees/drain/src-tauri/src/chesscom.rs:556). Preserve the raw constructor and strict consumer. |\n| Terminal directory kind — **2** | `infra::path_authority::catalog_install::tests::` **catalog_install_context1_directory_read_uses_actual_terminal_scope**, **catalog_install_phase3_terminal_component_identity_does_not_protect_sibling** | A final child for `EngineResourceRead` is opened with `FILE_NON_DIRECTORY_FILE`, although the resolver accepts a terminal directory and its consumer records recursive use. **Production producer/consumer mismatch.** | [resolved.rs:1079](/home/felixb/Projekte/chessfable.worktrees/drain/src-tauri/src/infra/path_authority/resolved.rs:1079), plus the typed request boundary in [mod.rs:3819](/home/felixb/Projekte/chessfable.worktrees/drain/src-tauri/src/infra/path_authority/mod.rs:3819). Architecture judgment remains required before implementation. |\n| Moved-root spelling — **2** | Same catalog test module: **catalog_install_cr6_unavailable_prepublication_resource_marks_new_tree**, **catalog_install_phase3_retained_binding_survives_path_replacement** | Fixtures supply a raw moved path alongside `Some(VerifiedIdentity)`. That registration door preserves the supplied proven spelling. Subsequent workspace acquisition finds a canonical-spelling difference. **Fixture contract violation.** | The direct moved-root registration at [catalog_install.rs:1297](/home/felixb/Projekte/chessfable.worktrees/drain/src-tauri/src/infra/path_authority/catalog_install.rs:1297) and shared `phase3_select_root` at [catalog_install.rs:1332](/home/felixb/Projekte/chessfable.worktrees/drain/src-tauri/src/infra/path_authority/catalog_install.rs:1332). |\n| Malformed registry cases — **1** | Same module: **catalog_install_phase4_registry_rejects_malformed_and_oversized_use_evidence** | The traversal fixture uses `join(\"../elsewhere\")` on a canonical Windows verbatim path. Rust removes the traversal before encoding. The hard-coded Unix case separately tests foreign-platform rejection on Windows. **The source demonstrates invalid test construction, not a load-validation defect.** | Case construction and diagnostics at [catalog_install.rs:2488](/home/felixb/Projekte/chessfable.worktrees/drain/src-tauri/src/infra/path_authority/catalog_install.rs:2488). No evidenced need to change production validation. |\n| Absent-target install injection — **2** | Same module: **catalog_install_publication_rename_and_sync_faults_keep_provenance**, **catalog_install_repeated_aborted_missing_target_publications_bound_protection** | Windows’ absent-target commit branch performs its real rename and returns without invoking `InstallRename`. The shared `ParentSync` hook exists. The first test fails in its first, `InstallRename`, iteration before exercising `ParentSync`. **Missing test hook, not missing production publication wiring.** | Windows absent-target branch at [infra/fs.rs:3767](/home/felixb/Projekte/chessfable.worktrees/drain/src-tauri/src/infra/fs.rs:3767). |\n\nThe traced producer/consumer details support those boundaries:\n\n1. **Download fixture issuance**\n\n   `AppOwnedRoot::new` is `#[cfg(test)]` and stores its argument unchanged. `PathAuthority::open` likewise stores that spelling for supplied app roots. It does not pass those roots through legacy rebinding.\n\n   Both failing fixture builders construct `dir.path().join(\"downloads\")`. On Windows that can retain TempDir’s short-name spelling. `reserve_download_artifact` then calls `acquire_stored_target`, whose underlying acquisition canonicalizes the parent, proves the object through `open_verified_parent`, and requires **both identity and spelling equality**. The observed conflict occurs before creating the pending reservation. See [mod.rs:2517](/home/felixb/Projekte/chessfable.worktrees/drain/src-tauri/src/infra/path_authority/mod.rs:2517), [mod.rs:4140](/home/felixb/Projekte/chessfable.worktrees/drain/src-tauri/src/infra/path_authority/mod.rs:4140), and [mod.rs:8154](/home/felixb/Projekte/chessfable.worktrees/drain/src-tauri/src/infra/path_authority/mod.rs:8154).\n\n   The actual consumers are `download_to_destination_inner → reserve_download_artifact` and `download_chess_com_games_core → install_staged_pgn_artifact → reserve_download_artifact`. Publication, activation and their later hooks follow reservation.\n\n   **An existing central canonical issuer is available:** `AppDataDir::for_test`, backed by the production acquisition implementation. Both fixture builders can derive their disposable download directory from its canonical `as_path()` before constructing the test root. There is no complete shared download-root fixture builder in the inspected modules. `portable_tests::authority` opens an empty authority, while `get_or_create_app_owned_test_root` handles the three typed default workspaces.\n\n   This keeps changes at fixture issuance. Do not canonicalize every `AppOwnedRoot::new` argument, since deliberately malformed or unavailable roots must remain constructible. Production dialog acquisition/promotion already stores the canonical acquired binding.\n\n2. **Terminal directories and the NT primitive**\n\n   The exact chain is:\n\n   `PathAuthority::resolve → resolve_windows → open_windows_child → nt_create_windows_child → NtCreateFile`.\n\n   The primitive translates `directory: false` into `FILE_NON_DIRECTORY_FILE`. In `resolve_windows`, a final child gets `false` unless it is a `DownloadArchive` destination. Thus the two directory resources fail before the metadata branch that accepts directories and before `protect_catalog_contexts` captures their terminal identity.\n\n   The bounded semantic change is a **typed three-way open kind**: directory, non-directory, or file-or-directory. Only the mixed terminal case omits both NT kind constraints. Existing definite-kind callers retain their constraints. The retained handle’s metadata then validates the allowed result, without a pathname probe or retrying a different syscall.\n\n   Preserve the single `NtCreateFile` site, `RootDirectory`, single-leaf and Unicode-length checks, `OBJ_DONT_REPARSE`, `FILE_OPEN_REPARSE_POINT`, post-open reparse rejection, synchronous I/O, identity checks, parent access and existing share policies. The private temporary producer must remain explicitly non-directory with `FILE_SHARE_PRIVATE_TEMP`.\n\n   **Contract question for the requested architecture judgment:** how should the typed mixed-kind request pass through the traversal wrapper while keeping sharing policy centralized? Directory support itself is already required. The exact handled entry [f-20260914-12](/home/felixb/Projekte/chessfable.worktrees/drain/tasks/findings.md:9264) explicitly includes nested directory resources. No cwd mechanism needs reopening.\n\n3. **Moved-root proof boundary**\n\n   `registration_target(Some(expected))` checks identity and preserves the supplied path. `engine_root_path → workspace_root → acquire_stored_target` later requires canonical equality. See [mod.rs:5721](/home/felixb/Projekte/chessfable.worktrees/drain/src-tauri/src/infra/path_authority/mod.rs:5721) and [mod.rs:7964](/home/felixb/Projekte/chessfable.worktrees/drain/src-tauri/src/infra/path_authority/mod.rs:7964).\n\n   Canonicalize the **existing moved directory at the fixture boundary before obtaining its identity token**, then pass that spelling and identity together through the unchanged registration door. The existing `canonical_binding` plus acquisition proof is the relevant route. Keep historical-use keys and alias/history assertions intact. Do not replace `Some(expected)` with `None` merely to make registration normalize the input.\n\n4. **Truthful malformed native cases**\n\n   `Fixture::new` obtains `f.root` from authority acquisition, so Windows uses its canonical verbatim spelling. Rust 1.98’s installed source explicitly normalizes `.` and `..` when joining onto a verbatim prefix. Therefore the current second case encodes approximately `\\\\?\\C:\\…\\<temp>\\elsewhere`, not a traversal-bearing path. This is source evidence, not a Windows execution claim.\n\n   `NativePath` encodes Windows paths as `utf16: Vec<u16>`. Construct the traversal corruption by appending literal UTF-16 `\\..\\elsewhere` units to the encoded path, bypassing `PathBuf::join`. Label it and assert that the corruption still contains a `ParentDir` before testing load rejection.\n\n   Keep all rejection categories, with explicit labels:\n\n   - Relative native path and raw native traversal\n   - Zero identity\n   - Invalid session UUID and empty sessions\n   - Invalid native encoding/path content\n   - Foreign-platform encoding\n   - Duplicate binding\n   - Excess session count, record count and encoded bytes\n\n   On Unix, invalid base64 exercises decoding. On Windows, malformed native path content such as a NUL-bearing component exercises native validation. Lone UTF-16 surrogates should not be mislabeled as necessarily invalid Windows encoding. The existing Unix variant on Windows correctly produces `InvalidInput(\"registry path belongs to another platform\")`, which already matches the expected error class. See [mod.rs:3497](/home/felixb/Projekte/chessfable.worktrees/drain/src-tauri/src/infra/path_authority/mod.rs:3497) and [catalog_install.rs:20](/home/felixb/Projekte/chessfable.worktrees/drain/src-tauri/src/infra/path_authority/catalog_install.rs:20).\n\n   The generic log assertion does not identify the failing case. Source strongly identifies the normalized traversal case, but per-case native execution must confirm that attribution.\n\n5. **Publication hooks and real phases**\n\n   The actual path is:\n\n   `publish_catalog_install → resolved.atomic_install_download_dir → atomic_install_dir → install_dir_driver → install_dir_at_driver → WindowsDirInstallAdapter::commit`.\n\n   Provenance is committed before installation. The shared driver invokes `SyncEntry`, `PreCommit`, and post-commit `ParentSync`. Windows invokes `BackupRename`, `InstallRename` and `RollbackRename` on the existing-target backup path, but skips `InstallRename` on the absent-target path. Unix invokes `InstallRename` before its actual rename for either target state.\n\n   Add the existing `InstallRename` injector immediately before Windows’ real absent-target `rename_child`. Retain the existing shared `ParentSync` hook immediately before `parent.sync_all()`. No record-state simulation or alternate publication path is warranted. See [infra/fs.rs:795](/home/felixb/Projekte/chessfable.worktrees/drain/src-tauri/src/infra/fs.rs:795), [infra/fs.rs:905](/home/felixb/Projekte/chessfable.worktrees/drain/src-tauri/src/infra/fs.rs:905), and [infra/fs.rs:3746](/home/felixb/Projekte/chessfable.worktrees/drain/src-tauri/src/infra/fs.rs:3746).\n\nSettled invariants remain strict canonical identity/spelling, descriptor registration, durable originating-session evidence, actual terminal identity and recursion, conservative uncertainty, prepublication provenance, and the single NT-open primitive. O1–O4 and the ordinary substitution/crash threat model remain frozen.\n\nNative Windows CI must establish all twenty tests passing, including the previously unreachable publication/activation tails, nested directory terminal identity and sibling isolation, preserved moved-root history, separately labeled malformed cases, and real pre-rename versus post-rename fault outcomes. GNU compilation cannot establish those results. The existing cwd success remains accepted.\n\nInspected only the supplied evidence, named rules, specified decision entries, frozen plan, exact handled finding, scoped source/fixtures, and directly called Rust path implementation. Working tree remained clean. This is locate evidence, not final review. Plan authorship and arbitration share one context. Detection uses the same model family as the code in separate sessions, without family separation.",
  "probe-windows-joiners.txt": "Both candidates still require changes in `resolved.rs`, confirming direct file overlap with the stated Windows CI repair anchor. Their current failure modes differ from the ledger descriptions.\n\n**f-20260917-05 remains partially valid.**\n\n- [`puzzle_database_target`](/home/felixb/Projekte/chessfable.worktrees/drain/src-tauri/src/infra/path_authority/resolved.rs:513) clones the retained parent and leaf, then calls `canonical_binding`. That helper still canonicalizes the parent **pathname** at [`mod.rs:2103`](/home/felixb/Projekte/chessfable.worktrees/drain/src-tauri/src/infra/path_authority/mod.rs:2103).\n- Puzzle reads therefore still fail after a parent rename. Merely removing that canonicalization is insufficient. `cache_key → identity_from_probe → probe_schema → DatabaseFileTarget::probe_current` subsequently reopens the parent by pathname and rejects the missing or substituted parent.\n- The claimed deletion failure is already repaired for a straightforward rename. [`delete_puzzle_database_blocking`](/home/felixb/Projekte/chessfable.worktrees/drain/src-tauri/src/puzzle.rs:643) catches a missing binding and invokes retained-parent deletion. The existing `command_flow_unlinks_via_retained_parent_when_the_parent_path_is_renamed` regression explicitly covers that behavior at [`puzzle.rs:1293`](/home/felixb/Projekte/chessfable.worktrees/drain/src-tauri/src/puzzle.rs:1293).\n- SQLite does not require the original puzzle pathname. Puzzle loading copies the identity-checked retained file into a private snapshot before establishing SQLite. Ordinary database connections use `bound_sqlite`, whose binding key contains inode identity, retained-parent identity and leaf.\n\nOptimal: give puzzle carriers explicit retained-parent semantics, with their pathname serving only as a diagnostic/cache locator → I recommend that approach. Mint the carrier without another pathname lookup and probe its retained parent/leaf without reopening the file, preserving the Unix POSIX-lock constraint. Keep ordinary database carriers’ existing pathname-revalidation behavior.\n\nThe open architecture question is how `DatabaseFileTarget` expresses these two validation contracts. Silently changing `probe_current` for every database would exceed this finding. An explicit internal carrier policy or equivalent capability distinction needs arbitration before freezing implementation.\n\nExpected production edits for that solution:\n\n- `src-tauri/src/infra/path_authority/resolved.rs`\n- `src-tauri/src/infra/path_authority/mod.rs`\n- `src-tauri/src/puzzle.rs`\n\n`puzzle.rs` should also move cache-key carrier construction into its existing blocking closure. It currently performs the documented blocking construction before entering `BLOCKING_GATEWAY`.\n\nNecessary regressions belong beside the existing carrier and puzzle tests: minting after parent rename, cache-key creation and puzzle loading after rename, replacement-leaf refusal, substitute-parent isolation, and deletion through the repository exclusion path after rename. Preserve existing ordinary-database parent-swap and pooled-lock regressions.\n\n**f-20260920-01 remains valid, with a narrower race than the original description.**\n\n[`publish_catalog_install`](/home/felixb/Projekte/chessfable.worktrees/drain/src-tauri/src/infra/path_authority/catalog_install.rs:649) now opens the registered root with identity verification, opens staging relative to that root, records its inventory and checks staging identity again. A parent substitution **before these checks** is refused.\n\nHowever, its final call still reaches [`atomic_install_download_dir`](/home/felixb/Projekte/chessfable.worktrees/drain/src-tauri/src/infra/path_authority/resolved.rs:175), which discards those retained boundaries and invokes pathname-based `atomic_install_dir`. [`install_dir_driver`](/home/felixb/Projekte/chessfable.worktrees/drain/src-tauri/src/infra/fs.rs:795) opens both parents anew. A substitution after the catalog checks but before those opens can make both opens and the final pathname revalidation agree on the substitute directory. The installer receives no expected staging identity from catalog validation.\n\nOptimal: carry the verified source-parent handle, staging leaf and staging identity into installation under the resolved destination’s retained parent → I recommend that approach. Compare the two retained parent identities and dispatch through the existing shared `install_dir_at_driver`.\n\nThe reusable machinery already exists:\n\n- Unix and Windows `install_dir_at` accept a held parent and expected source identity.\n- `OwnedStagingDir` and `install_owned_staging_dir` already use that machinery, including commit-aware cleanup and uncertain-durability handling.\n- Their existing tests cover parent substitution and the Windows behavior that refuses parent rename while handles are held.\n\nThe minimal production edit set is:\n\n- `src-tauri/src/infra/path_authority/resolved.rs`\n- `src-tauri/src/infra/path_authority/catalog_install.rs`\n- `src-tauri/src/infra/fs.rs`\n\nExpose a narrow shared held-parent installation facade and route both capability installation and `install_owned_staging_dir` through it. The current `fs.rs` caller need not change for this design. Catalog validation already holds the necessary source capability.\n\nNecessary tests must inject substitution **after catalog validation and before installation**, verify no substitute staging tree is published, reject a changed source identity, and preserve catalog provenance, rollback and committed-durability behavior. Include Unix race witnesses and Windows refusal coverage. A swap only before catalog validation would miss the remaining defect.\n\nApplicable decisions are `d-20260912-04`, preserving parent-only canonicalization wherever canonicalization is required, `d-20260918-18` and its clarification `d-20261016-07`, preserving strict ordinary use-time spelling checks without exemptions, and `d-20261005-05`, superseding `d-20261005-04`. The latter governs inner archive extraction. Its parent pin does not close this separate final catalog-publication race.\n\nFor Ranking6, both actual fix shapes edit `resolved.rs`. The earlier f021 exclusion does not establish an exemption for this reopened anchor. This confirms candidate overlap, without claiming review of an unavailable Windows repair diff.\n\nRead-only investigation completed. Working tree was clean. No writes, tests, agents or live queries occurred. Evidence is source inspection only. Plan authorship and arbitration share root context, and detection is the same model family as code in a separate session. No family independence is claimed.",
  "repair-windows-fixtures.txt": "WF1 is **partially complete and blocked**. The prescribed fixture fix fails with E0624 because [`AppDataDir::as_path`](/home/felixb/Projekte/chessfable.worktrees/drain/src-tauri/src/infra/path_authority/mod.rs:2815) is private. Root must expose that existing accessor or authorize the boundary change. The two unbuildable fixture edits were removed exactly.\n\nRemaining unstaged changes:\n\n- `catalog_install.rs` tests canonicalize moved-root spelling before identity capture and preserve verified registration. Malformed cases now retain raw traversal, assert `ParentDir`, and label every rejection category.\n- `infra/fs.rs` adds only the `#[cfg(test)]` Windows absent-target `InstallRename` hook.\n\nFinal Linux checks all exited **0**:\n\n- Catalog: **74 passed**\n- Filesystem: **214 passed, 1 ignored**\n- Chesscom: **10 passed**\n- Formatting and diff checks passed\n\n[Commands/statuses](/tmp/build-de5be974-c551-48bb-b87c-30caf1642a05/wf1-commands.log), [scoped diff](/tmp/build-de5be974-c551-48bb-b87c-30caf1642a05/wf1-scoped.diff), [hash audit](/tmp/build-de5be974-c551-48bb-b87c-30caf1642a05/wf1-after-hashes.json).\n\nProduction prefix bytes remain unchanged. Removing the new test-only hook reconstructs `infra/fs.rs` exactly. `fs.rs`, `chesscom.rs`, `mod.rs` and `resolved.rs` are byte-identical to entry.\n\nInitial compile failures and corrected formatting differences are retained in `wf1-attempt1-*` and `wf1-initial-fmt.*`. No behavioral red is claimed. Native Windows acceptance remains open, including the 13 blocked download/chesscom fixture cases. No staging or commit.",
  "lens-correctness-r10.txt": "GL1 CLOSED — The actual diff removes exactly two redundant borrows at `catalog_install.rs:1633/1636`. Both calls receive the same `&Path`. The enclosing helper and all consumers preserve their behavior. Inspected logs show clippy success and 74 catalog tests passing (confidence: 99).\n\nNo correctness defects found. No changed premise affects earlier closures or dependent lifetime cases.\n\nLimitations: read-only inspection, no tests rerun. Windows/macOS runtime and final-gate completion remain unverified here. Review used the code author’s model family in a separate session. Plan authorship and arbitration shared one context.\n\nVERDICT: APPROVED",
  "lens-root-cause-r10.txt": "GL1 CLOSED — `catalog_install.rs:1633,1636` removes the exact redundant borrows reported by clippy. Recorded clippy passes afterward, with 74 catalog tests passing. The enclosing helper, consumers and line history show no changed behavior or reintroduced defect. Earlier closures remain unaffected. No new findings.\n\nReview used a separate Codex session in the same model family as the author.\n\nVERDICT: APPROVED",
  "lens-tests-r10.txt": "GL1 CLOSED — The diff removes exactly two redundant borrows. The saved first-gate transcript rejects both expressions with Clippy diagnostics. The Rust gate runs that exact all-target command with `-D warnings`, so reverting GL1 restores the lint failure. Corrected Clippy passed, and all 74 catalog tests passed. Helper consumers and behavioral assertions remain unchanged.\n\nNo impacted earlier closure or new verification gap found. Windows/macOS runtime and final-gate completion remain pending. Review used the code author’s model family in a separate session.\n\nVERDICT: APPROVED",
  "lens-error-handling-r10.txt": "NOT APPLICABLE — The actual diff contains only two redundant-borrow removals in test helper `prepare_image`. Neither changes failure handling or error surfacing. GL1 CLOSED for this lens. No earlier error-handling closure is affected.\n\nVERDICT: APPROVED",
  "lens-minimalism-r10.txt": "GL1 CLOSED — The committed diff removes exactly the two gate-rejected borrows at `catalog_install.rs:1633` and `:1636`. The enclosing helper and consumers retain their signatures, assertions and behavior. Saved clippy output completes successfully, and the catalog log reports 74 passing tests.\n\nNo bloat or duplication defects found. This is the smallest sufficient correction, with no added files or abstractions. Earlier closures have no changed premise.\n\nReview was read-only in a separate Codex session using the code author’s model family. Plan authorship and arbitration shared one context.\n\nVERDICT: APPROVED",
  "lens-code-quality-r10.txt": "GL1 CLOSED — `catalog_install.rs:1633,1636` removes exactly the two redundant borrows identified by clippy. The helper already accepts `script: &Path`. Its callers, assertions and production code are unchanged. Inspected logs show clippy success and 74 catalog tests passing.\n\nNo readability or local-consistency defects found. No changed premise affects earlier closures or dependent cases.\n\nReview shares the code author’s model family in a separate session. No checks rerun or files changed.\n\nVERDICT: APPROVED",
  "lens-engine-protocol-r10.txt": "NOT APPLICABLE: The actual correction changes only two redundant argument borrows in a Linux test helper. Inspection of the enclosing helper and consumers confirms no engine supervision, UCI ordering or result-routing behavior changes.\n\nGL1 CLOSED: Both exact borrow removals are present. Earlier closures and dependent cases are unaffected. No files changed or tests run.\n\nVERDICT: APPROVED",
  "lens-ipc-contract-r10.txt": "NOT APPLICABLE — GL1 CLOSED for this lens. The committed diff matches the supplied correction diff exactly: two redundant argument borrows removed inside a test helper. No IPC command, event, payload, listener, binding or capability changes. Earlier IPC closures are unaffected.\n\nVERDICT: APPROVED",
  "lens-tauri-security-r10.txt": "NOT APPLICABLE: The committed diff and correction diff contain only two redundant-borrow removals inside `#[cfg(test)]` helper `InheritedDirectoryChild::prepare_image`. Neither changes a production security boundary.\n\nGL1 CLOSED for this lens. No impacted security closures or new defects identified. No tests or processes run.\n\nVERDICT: APPROVED",
  "lens-platform-semantics-r10.txt": "GL1 CLOSED — `src-tauri/src/infra/path_authority/catalog_install.rs:1633` and `:1636` remove exactly the two gate-rejected borrows. `script` remains `&Path`. The enclosing helper and every caller are Linux-gated, so macOS and Windows compilation paths are unchanged. No production code, assertions or runtime behavior changed.\n\nSaved logs confirm all-target Linux clippy passed and all 74 catalog tests passed. No earlier closure or dependent case is invalidated. No new platform defect found.\n\nLimits: no checks ran during this read-only review. Supplied pre-review evidence reports `pnpm rust:windows:check` passing GNU compilation/clippy only. No non-Linux Unix source-probe result was supplied. Windows/macOS runtime proof remains pending in `rust-windows-test` and `rust-macos-test`. `rust-platform` supplies compile/lint evidence only. Full final-gate success remains pending.\n\nReview used the code’s model family without family separation. No files changed.\n\nVERDICT: APPROVED",
  "lens-records-r10.txt": "No findings. GL1 hashes, saved lint failure and repair logs, R8/R9 history, preserved R6–R9 reports and 118 app checks agree with the records.\n\nLimitations: canonical root gate completions, exact timings and scope-stop chronology were not independently verified. Earlier historical evidence was inspected selectively. No files changed or checks rerun. Review shares the author’s model family.\n\nVERDICT: APPROVED"
}
```

Follow-up plan snapshots and stopped mechanism, preserved as decoded JSON strings:

```json
{
  "windows-terminal-kind-candidate.md": "# Windows CI terminal-kind correction, candidate WK1\n\nMandate is frozen O1–O4 in tasks/plans/2026-10-16-catalog-engine-retention.md. Native Windows CI run38851003688 failed exactly two nested EngineResourceRead directory tests because resolve_windows final leaf supplies directory=false to the sole NT primitive. f-20260914-12 explicitly promises nested directory resources and is reopened. Its archive and executable historical closures remain history. No new product decision or cwd mechanism.\n\nOptimal: express the native open kind accurately in the existing shared NT primitive → I recommend a typed Directory, NonDirectory, FileOrDirectory request.\n\nPreserve open_windows_child current boolean signature for all definite-kind callers and existing traversal sharing. Delegate that wrapper to one internal kind-aware traversal helper, with sharing policy constructed once in that helper, then the same nt_create_windows_child. WindowsChildRequest carries typed kind. Private-temp caller explicitly NonDirectory and unchanged private share mask. Sole NtCreateFile site selects DIRECTORY, NON_DIRECTORY, or neither. No repeated native syscall, pathname kind probe or capability widening.\n\nOnly final EngineResourceRead under an original directory authority root may request FileOrDirectory. Intermediate components remain Directory. DownloadArchive final remains Directory. A file-root authority final remains NonDirectory and must preserve expected_root identity. Current metadata validation rejects reparse/special objects and retains the actual directory/file handle, parent boundary and target. Normal file-root identity check must never be bypassed through a directory substitution. Final directory shape is permitted only where resource operation accepts it. Preserve existing metadata and kind restrictions for every other operation.\n\nKeep RootDirectory, single_leaf and checked Unicode lengths, OBJ_DONT_REPARSE, OPEN_REPARSE_POINT, synchronous mode, post-open reparse rejection, exact identity/canonical spelling, deletion-share policy, retained parent, durable catalog evidence and use scoping unchanged.\n\nVerification: existing exact two failed nested-directory tests must pass native Windows. Add direct negative coverage for file-root replacement with directory, nested reparse refusal if existing runtime coverage lacks that case, and preserve file-resource reads. Existing native cwd launch test already passed. Local Linux tests and GNU all-target checks prove no regression/compilation only, not Windows runtime. Required Windows runtime acceptance still mandatory. Fixture corrections separately use existing canonical test issuance, raw invalid native path construction and real absent-target InstallRename hook. No limits lowered, cases removed or error expectations weakened.\n\nGoverning decisions d-20260918-08..11, d-20261004-34, d-20261016-01..12 remain inputs. Reversal: revert typed kind and narrow resource-terminal dispatch together if another native primitive proves required, never reopen a file authority as a directory. No new tooling or registry.\n",
  "windows-terminal-kind-candidate-r2.md": "# Windows CI terminal-kind correction, candidate WK2\n\nMandate is frozen O1–O4 in tasks/plans/2026-10-16-catalog-engine-retention.md and exact reopened f-20260914-12 entry in tasks/findings.md. Native Windows CI run38851003688 failed exactly two nested EngineResourceRead directory tests because resolve_windows final leaf supplies directory=false to the sole NT primitive. No new product decision or cwd mechanism.\n\n## Native object kind\n\nOptimal: express native object kind through the single existing NT primitive → I recommend a typed Directory, NonDirectory, FileOrDirectory request. Preserve open_windows_child boolean signature for every definite-kind caller, delegated through one kind-aware traversal wrapper that constructs the existing share policy once. WindowsChildRequest has typed kind. Private temporary creation passes NonDirectory with unchanged private-temp mask. The only NtCreateFile selects the required kind constraint, with neither kind flag for FileOrDirectory. There is no pathname kind probe, repeated syscall or new capability type.\n\nOnly a final EngineResourceRead component under an original directory authority may use FileOrDirectory. Intermediates and archive destinations remain Directory. File-root authorities remain NonDirectory with expected root identity validation, including directory substitution refusal. All current post-open metadata, reparse/special-file, root identity, retained parent/target, exact spelling, durable use scoping and sharing restrictions remain. The existing successful cwd mechanism is unchanged.\n\n## Consumers and verification\n\nFiles: src-tauri/src/infra/path_authority/mod.rs, resolved.rs, src-tauri/src/infra/fs.rs, src-tauri/src/infra/platform_support/tests.rs. The three existing source assertions cover private temporary kind, traversal sharing/delegation, and synchronous options. Adapt each to the typed request and shared wrapper while retaining every containment, sharing, synchronization and sole-native-site guarantee. Use source-derived staged failures for changed assertions, preserve distinct failure messages and statuses. These assertions complement required native Windows runtime, never replace it.\n\nExisting two failed nested directory resource tests must pass Windows, normal file resources keep passing, and direct file-root replacement by directory plus nested reparse refusal must be covered by existing or new real native tests. Local Linux tests and GNU checks establish regression/compilation only. Native Windows remains required before installation. Frozen inventory/session/canonical limits and threat model unchanged.\n\n## Review history\n\nWK1 focused fresh-context review reported WK-I1 missing three platform source-assertion consumers and WK-I2 missing explicit history/open issue inputs. Both are Fix. WK2 includes those consumers and this history. Raw WK1 report is RUN/windows-terminal-kind-review.txt, where RUN=/tmp/build-de5be974-c551-48bb-b87c-30caf1642a05. Current open IDs WK-I1, WK-I2 require closure. This private mechanism correction does not replace the original inherited plan r1–r4 or cumulative code review r1–r10. R1–R10 have no remaining open adopted code finding. Native CI red is current contrary evidence requiring WK repair.\n\n## Decisions\n\nInputs d-20260918-08..11, d-20261004-34, d-20261016-01..12 unchanged. Reversal: revert typed request and narrow resource dispatch together if a measured native limitation requires a different primitive. No new registry, framework, gate or tooling.\n",
  "joiner-plan-r1.md": "# Plan: Retained capability boundaries for puzzle reads and catalog installation\n\n## Goal\nFinish the confirmed co-located capability findings before completing the current drain delivery.\n\n## MANDATE\n### A resolved puzzle capability is unusable after its parent directory is renamed, although it retains the parent handle\n\n* **ID:** f-20260917-05 · **Status:** open · **Area:** native-fs · **Root:** - · **Entry:** build · **Blocked:** none\n* **Where:** `ResolvedPath::puzzle_database_target` (`src-tauri/src/infra/path_authority/resolved.rs:475-500`), whose last step is `canonical_binding(self.target()…)` (`infra/path_authority/mod.rs:1602`); the caller is `puzzle_binding` (`src-tauri/src/puzzle.rs:109`), reached from `cache_key`, the `get_puzzle` loading closure, and `delete_puzzle_database_resolved` (`puzzle.rs:661`).\n* **Defect:** the resolved capability already holds the retained parent descriptor and the leaf name, which is what every later operation actually uses. Minting the carrier nevertheless ends with `canonical_binding`, which calls `fs::canonicalize` on the **parent pathname**. If that parent is renamed after capability resolution, the canonicalization fails with `NotFound` and `puzzle_binding` aborts — before `delete_puzzle_database` gets the chance to use the retained handle, which is still perfectly valid and still names the authorized object. The pathname is needed only for the SQLite URI, the cache key and logging; the deletion path needs none of them.\n* **Why it matters:** the retained descriptor exists precisely so that a pathname change cannot invalidate an authorization. Here a pathname change invalidates it anyway, and the operation that suffers most is deletion, where the user has already confirmed an intent and gets an error naming a path they may have renamed themselves minutes earlier.\n* **Related:** `f-20260914-09` (the Windows port of this function; the defect is identical on unix and is neither introduced nor worsened there, which is why that slice filed it rather than fixing it); `d-20260912-04` recorded that `canonical_binding` canonicalizes only the parent, and this is the consequence of that parent still being resolved by name at mint time.\n* **Found by:** `review-correctness` (99) in round 2 of the `f-20260914-09` plan review, 2026-09-17, on Codex; source-verified by the orchestrator at the lines above, including that the unix arm has the same shape.\n* **Entry revalidation, 2026-10-16:** lens → build. The current read path still loses a resolved parent on rename through puzzle_database_target then DatabaseFileTarget::probe_current. Deletion already has a retained-parent fallback, so its historical failure description is narrowed rather than repeated. The proper correction changes the internal carrier's validation contract for resolved puzzle capabilities while ordinary database carriers retain strict pathname validation and pooled POSIX-lock safety. That is an unsettled shared contract, requiring a reviewed plan within the active full-auto build. It is a confirmed direct-file joiner of reopened f-20260914-12 because both fixes edit resolved.rs, under findings-ledger-contract Ranking6. The original f-20261002-04 frozen plan and metrics remain unchanged.\n* **Open question:** how does DatabaseFileTarget explicitly distinguish a resolved puzzle's retained-parent validation from an ordinary database's strict pathname validation without pathname fallback, leaf reopening or weakening ordinary database containment?\n<!-- ledger-meta {\"command\":\"set-header\",\"effect_lines\":2,\"effect_sha256\":\"bf0a7a0e3b0aba8ff5e7e34a98ed0d0d746847ea1eb801d5d29eb326a263b9b0\",\"header_sha256\":\"5f0ab80aeb88311ffd757d1d94b381d4253039c789d2828dba49581191a5c077\",\"header_status\":\"open\",\"input_sha256\":\"ac8a71de6661392093e7ff1519e76131d024f7b70d8ca0ad89fe82ebf1f3d82c\",\"kind\":\"mutation-receipt\",\"operation\":\"e0ecd67d02f330ce7920b3a022d8375314100b33ba34e093dcb6891dcf495b7c\",\"options\":{\"headers\":{\"Entry\":\"build\"},\"section\":null},\"request_id_sha256\":null,\"results\":[\"f-20260917-05\"],\"target\":\"f-20260917-05\",\"v\":1} -->\n\n### `atomic_install_download_dir` reopens its staging and target directories by path, so the engine-archive install has the same identity-only containment gap as its siblings\n\n* **ID:** f-20260920-01 · **Status:** open · **Area:** native-fs · **Root:** - · **Entry:** lens · **Blocked:** none\n* **Where:** `src-tauri/src/infra/path_authority/resolved.rs` `atomic_install_download_dir` (~:149) and the `private_tempdir_in` / install sequence it drives; consumer `publish_engine_archive_tree` (`src-tauri/src/fs.rs`).\n* **Defect (reported by a lens, confirm before fixing):** the resolved directory identity is dropped and both the temporary directory and the target are reopened by pathname. If the validated engine parent is replaced by another real directory between validation and installation, both reopen under the substitute, the same-parent check still passes, and a signed archive is installed outside the authorised root. Same containment class as `f-20260918-02` (`reserve_download_artifact`, `activate_download_artifact`, `workspace_entry_path`), which does not name this door.\n* **Why it matters:** an engine binary installed outside the workspace the user authorised, from a path the authority believed it had validated.\n* **Fix shape:** the same repair `f-20260917-13` applied to its two doors — `acquire_target` plus an `acquired.path == stored.path` check — carried into the directory-install path; a test that swaps the parent between validation and install must fail the install.\n* **Related:** `f-20260918-02` (same class, sibling doors; Root `-`, so the relation is named here).\n* **Found by:** review-tauri-security (Codex) over the `f-20260906-07` cumulative diff, 2026-09-20; outside that mandate, filed by Claude Code.\n* **Why rejected:** Reopen-by-path matters only against a same-user local attacker who already owns the user's files; never observed. Not worth fixing under universal rule 4d (only a defect with a cost is a finding; setup cleanup 2026-10-13).\n<!-- ledger-meta {\"command\":\"annotate\",\"effect_lines\":1,\"effect_sha256\":\"303c8cd742d84bed7c24fb4b3c683506a1129b118ddb2d3afdb717fb5a608484\",\"input_sha256\":\"c204fa18c39dccc61a0346dd996068927f4e426c85eefdf4cf8f94ec86610b73\",\"kind\":\"mutation-receipt\",\"operation\":\"3f96066915421a719574cc7af39d11c678f8072dda85147655c7e69da3662ffa\",\"options\":{\"section\":null},\"request_id_sha256\":null,\"results\":[\"f-20260920-01\"],\"target\":\"f-20260920-01\",\"v\":1} -->\n\n* **Reopened (records lens, 2026-10-13):** the 2026-10-13 rule-4d rejection and its correction above are void. This is product security hardening in a shipped desktop app, not agent machinery: the precondition is write access to a containing directory, which a shared-directory writer has, and `validate_target` checks type and identity without ownership. Rule 4d's own-box clause covers agent, hook, gate and drain machinery only. The finding stays open as it was before the triage.\n<!-- ledger-meta {\"command\":\"annotate\",\"effect_lines\":1,\"effect_sha256\":\"4c2175d5168731852eecb3f9b7ae392674c79c2bc8bdae9035ba41f55e8a9144\",\"input_sha256\":\"b2709c0e5979b7be13f55b09f5bc22158cf7c455b7ec6d5ae50ec378a8e49dc4\",\"kind\":\"mutation-receipt\",\"operation\":\"905ba259eb1d921ef219d921001600090ed09ab23717fb2f5d00308c33c276bd\",\"options\":{\"section\":null},\"request_id_sha256\":null,\"results\":[\"f-20260920-01\"],\"target\":\"f-20260920-01\",\"v\":1} -->\n\n## Threat model and non-goals\nOrdinary user or concurrent rename/replacement of parents or leaf objects after resolution or validation. Preserve no-follow containment, expected identity, existing repository exclusion, POSIX-lock safety, durability and bounded catalog provenance. No malicious continuous-unlink attacker, new public capability, schema migration, resource timer, framework or UI/product change. Ordinary database path validation must stay strict.\n\n## Traced premises\nCurrent source at18098b7b plus findings-only tier record. resolved.rs puzzle_database_target clones held parent and leaf then canonicalizes the old path. DatabaseFileTarget::probe_current reopens the pathname parent. Puzzle SQLite reads use private snapshots from held files. Puzzle cache_key constructs its blocking carrier before its blocking closure. Catalog publication verifies registered root and staging and inventories it, then resolved.atomic_install_download_dir drops both boundaries into pathname atomic_install_dir. Shared install_dir_at_driver and platform install_dir_at already accept held parent and expected source identity. Source trace is RUN/probe-windows-joiners.txt. Existing deletion fallback already covers straightforward rename, so the historical deletion claim is narrowed.\n\n## Approach\n### O1 — Keep a resolved puzzle's retained boundary\nA resolved puzzle read or delete mints its repository carrier from its already-held parent, leaf and file identity without reopening the pathname. That carrier probes the retained boundary without opening and closing the leaf, preserving pooled Unix POSIX locks. Replacing the leaf fails closed. Renaming or replacing the original parent spelling does not redirect the read. Path is a diagnostic/cache locator, never fresh authority. Ordinary database carriers retain existing strict pathname and parent revalidation. Express the internal distinction explicitly with a private validation policy chosen only by the sealed carrier producers. No general exemption from stored-authority canonical acquisition or rebinding rules.\nAll blocking carrier construction and probing for cache_key runs inside its existing cancellation-aware blocking closure. Snapshot reads, cache invalidation, exclusion and cancellation preserve existing contracts.\n\n### O2 — Install through the exact catalog-validated boundary\nFinal catalog publication carries the verified staging parent, staging leaf and exact inventoried identity into installation. The destination capability verifies that source and retained destination parent are the same object, and installs the validated leaf onto its own retained destination leaf through the shared descriptor-relative driver. A substituted pathname never becomes the install authority. Replaced source identity refuses. Existing provenance persistence, precommit failure, rollback and committed durability uncertainty retain their semantics.\nUse one narrow shared held-parent installation facade for both this path and existing OwnedStagingDir installation, retaining commit-aware cleanup. No new pathname-based helper, duplicate platform installer or weakening of current same-parent and no-follow checks.\n\n## Decisions and trade-offs\nOptimal: distinguish already-resolved puzzle capability validation explicitly and carry catalog-validated staging descriptors through final publication → I recommend this approach. Existing strict ordinary acquisition decisions d-20260918-18 and d-20261016-07 remain. d-20260912-04 still governs sites that require canonical_binding, but already-resolved puzzle targets do not acquire a second authority. d-20261005-05 governs inner extraction, which is not changed. New material policy is recorded through findings.py after plan approval with reversal path. Keep one original adopted f021 phase and its historical review metrics unchanged. This is a separate follow-up capability slice required by Ranking6, not a rewrite of O1–O4.\n\n## Risks / open questions\nThe main design judgment is the sealed distinction between ordinary strict-path and puzzle retained-parent probes. Review it before implementation. Native Windows runtime remains mandatory. Existing Windows held handles may refuse rename, so tests must assert the actual refusal rather than claim a Unix rename occurred. Added owned-source identity must remain tied to the inventory and parent that validated it.\n\n## Not part of this task\nNo ordinary database policy change, deletion redesign, SQLite connection framework, catalog ownership expansion, custom source verifier addition, tooling changes or renderer changes. Frozen f021 cleanup rules and legacy-directory preservation stay.\n\n## Phases\nOne cohesive capability phase, because producers and shared carrier/installer consumers share mod.rs/resolved.rs/infra/fs.rs/catalog_install.rs. Also puzzle.rs for blocking cache-key integration and direct runtime regressions. Sensitive Codex gpt-6.1-sol/high writer, one persistent context, no overlapping write leaves. Root traces/arbitrates/records/commits, separate Codex read-only lenses review, no family separation.\nPROOF: cargo test --manifest-path src-tauri/Cargo.toml --locked infra::path_authority::tests -- --nocapture, cargo test --manifest-path src-tauri/Cargo.toml --locked catalog_install -- --nocapture, cargo test --manifest-path src-tauri/Cargo.toml --locked puzzle::tests -- --nocapture, cargo test --manifest-path src-tauri/Cargo.toml --locked infra::fs::tests -- --nocapture, cargo test --manifest-path src-tauri/Cargo.toml --locked db:: -- --nocapture, cargo fmt --manifest-path src-tauri/Cargo.toml -- --check, git diff --check. Behavioral tests cover puzzle carrier/cache/load after parent rename, substitute-parent isolation, replacement leaf refusal, and catalog substitution after inventory validation plus replaced staging. Unix source-only fix-revert red/green retains tests, no false Windows runtime claim. Existing ordinary parent-swap and pooled-lock tests stay green. Root pre-review, cumulative diff lenses, complete Rust final gates and exact-SHA Windows/macOS/platform CI precede installation. Original full three-flag gates already passed, new source is Rust-only and selected gates follow published corrective range.\n\n## Reviews\nRevision J1, no previous review, no open issue IDs yet. Read-only source probe is locate evidence, not approval. Plan authorship and arbitration share root context. Detection runs on same model family as code in separate sessions.\n",
  "joiner-plan-r2.md": "# Plan: Retained capability boundaries for puzzle reads and catalog installation\n\n## Goal\nFinish the confirmed co-located capability findings before completing the current drain delivery.\n\n## MANDATE\n### A resolved puzzle capability is unusable after its parent directory is renamed, although it retains the parent handle\n\n* **ID:** f-20260917-05 · **Status:** open · **Area:** native-fs · **Root:** - · **Entry:** build · **Blocked:** none\n* **Where:** `ResolvedPath::puzzle_database_target` (`src-tauri/src/infra/path_authority/resolved.rs:475-500`), whose last step is `canonical_binding(self.target()…)` (`infra/path_authority/mod.rs:1602`); the caller is `puzzle_binding` (`src-tauri/src/puzzle.rs:109`), reached from `cache_key`, the `get_puzzle` loading closure, and `delete_puzzle_database_resolved` (`puzzle.rs:661`).\n* **Defect:** the resolved capability already holds the retained parent descriptor and the leaf name, which is what every later operation actually uses. Minting the carrier nevertheless ends with `canonical_binding`, which calls `fs::canonicalize` on the **parent pathname**. If that parent is renamed after capability resolution, the canonicalization fails with `NotFound` and `puzzle_binding` aborts — before `delete_puzzle_database` gets the chance to use the retained handle, which is still perfectly valid and still names the authorized object. The pathname is needed only for the SQLite URI, the cache key and logging; the deletion path needs none of them.\n* **Why it matters:** the retained descriptor exists precisely so that a pathname change cannot invalidate an authorization. Here a pathname change invalidates it anyway, and the operation that suffers most is deletion, where the user has already confirmed an intent and gets an error naming a path they may have renamed themselves minutes earlier.\n* **Related:** `f-20260914-09` (the Windows port of this function; the defect is identical on unix and is neither introduced nor worsened there, which is why that slice filed it rather than fixing it); `d-20260912-04` recorded that `canonical_binding` canonicalizes only the parent, and this is the consequence of that parent still being resolved by name at mint time.\n* **Found by:** `review-correctness` (99) in round 2 of the `f-20260914-09` plan review, 2026-09-17, on Codex; source-verified by the orchestrator at the lines above, including that the unix arm has the same shape.\n* **Entry revalidation, 2026-10-16:** lens → build. The current read path still loses a resolved parent on rename through puzzle_database_target then DatabaseFileTarget::probe_current. Deletion already has a retained-parent fallback, so its historical failure description is narrowed rather than repeated. The proper correction changes the internal carrier's validation contract for resolved puzzle capabilities while ordinary database carriers retain strict pathname validation and pooled POSIX-lock safety. That is an unsettled shared contract, requiring a reviewed plan within the active full-auto build. It is a confirmed direct-file joiner of reopened f-20260914-12 because both fixes edit resolved.rs, under findings-ledger-contract Ranking6. The original f-20261002-04 frozen plan and metrics remain unchanged.\n* **Open question:** how does DatabaseFileTarget explicitly distinguish a resolved puzzle's retained-parent validation from an ordinary database's strict pathname validation without pathname fallback, leaf reopening or weakening ordinary database containment?\n<!-- ledger-meta {\"command\":\"set-header\",\"effect_lines\":2,\"effect_sha256\":\"bf0a7a0e3b0aba8ff5e7e34a98ed0d0d746847ea1eb801d5d29eb326a263b9b0\",\"header_sha256\":\"5f0ab80aeb88311ffd757d1d94b381d4253039c789d2828dba49581191a5c077\",\"header_status\":\"open\",\"input_sha256\":\"ac8a71de6661392093e7ff1519e76131d024f7b70d8ca0ad89fe82ebf1f3d82c\",\"kind\":\"mutation-receipt\",\"operation\":\"e0ecd67d02f330ce7920b3a022d8375314100b33ba34e093dcb6891dcf495b7c\",\"options\":{\"headers\":{\"Entry\":\"build\"},\"section\":null},\"request_id_sha256\":null,\"results\":[\"f-20260917-05\"],\"target\":\"f-20260917-05\",\"v\":1} -->\n\n### `atomic_install_download_dir` reopens its staging and target directories by path, so the engine-archive install has the same identity-only containment gap as its siblings\n\n* **ID:** f-20260920-01 · **Status:** open · **Area:** native-fs · **Root:** - · **Entry:** lens · **Blocked:** none\n* **Where:** `src-tauri/src/infra/path_authority/resolved.rs` `atomic_install_download_dir` (~:149) and the `private_tempdir_in` / install sequence it drives; consumer `publish_engine_archive_tree` (`src-tauri/src/fs.rs`).\n* **Defect (reported by a lens, confirm before fixing):** the resolved directory identity is dropped and both the temporary directory and the target are reopened by pathname. If the validated engine parent is replaced by another real directory between validation and installation, both reopen under the substitute, the same-parent check still passes, and a signed archive is installed outside the authorised root. Same containment class as `f-20260918-02` (`reserve_download_artifact`, `activate_download_artifact`, `workspace_entry_path`), which does not name this door.\n* **Why it matters:** an engine binary installed outside the workspace the user authorised, from a path the authority believed it had validated.\n* **Fix shape:** the same repair `f-20260917-13` applied to its two doors — `acquire_target` plus an `acquired.path == stored.path` check — carried into the directory-install path; a test that swaps the parent between validation and install must fail the install.\n* **Related:** `f-20260918-02` (same class, sibling doors; Root `-`, so the relation is named here).\n* **Found by:** review-tauri-security (Codex) over the `f-20260906-07` cumulative diff, 2026-09-20; outside that mandate, filed by Claude Code.\n* **Why rejected:** Reopen-by-path matters only against a same-user local attacker who already owns the user's files; never observed. Not worth fixing under universal rule 4d (only a defect with a cost is a finding; setup cleanup 2026-10-13).\n<!-- ledger-meta {\"command\":\"annotate\",\"effect_lines\":1,\"effect_sha256\":\"303c8cd742d84bed7c24fb4b3c683506a1129b118ddb2d3afdb717fb5a608484\",\"input_sha256\":\"c204fa18c39dccc61a0346dd996068927f4e426c85eefdf4cf8f94ec86610b73\",\"kind\":\"mutation-receipt\",\"operation\":\"3f96066915421a719574cc7af39d11c678f8072dda85147655c7e69da3662ffa\",\"options\":{\"section\":null},\"request_id_sha256\":null,\"results\":[\"f-20260920-01\"],\"target\":\"f-20260920-01\",\"v\":1} -->\n\n* **Reopened (records lens, 2026-10-13):** the 2026-10-13 rule-4d rejection and its correction above are void. This is product security hardening in a shipped desktop app, not agent machinery: the precondition is write access to a containing directory, which a shared-directory writer has, and `validate_target` checks type and identity without ownership. Rule 4d's own-box clause covers agent, hook, gate and drain machinery only. The finding stays open as it was before the triage.\n<!-- ledger-meta {\"command\":\"annotate\",\"effect_lines\":1,\"effect_sha256\":\"4c2175d5168731852eecb3f9b7ae392674c79c2bc8bdae9035ba41f55e8a9144\",\"input_sha256\":\"b2709c0e5979b7be13f55b09f5bc22158cf7c455b7ec6d5ae50ec378a8e49dc4\",\"kind\":\"mutation-receipt\",\"operation\":\"905ba259eb1d921ef219d921001600090ed09ab23717fb2f5d00308c33c276bd\",\"options\":{\"section\":null},\"request_id_sha256\":null,\"results\":[\"f-20260920-01\"],\"target\":\"f-20260920-01\",\"v\":1} -->\n\n## Threat model and non-goals\nOrdinary user or concurrent rename/replacement of parents or leaf objects after resolution or validation. Preserve no-follow containment, expected identity, existing repository exclusion, POSIX-lock safety, durability and bounded catalog provenance. No malicious continuous-unlink attacker, new public capability, schema migration, resource timer, framework or UI/product change. Ordinary database path validation must stay strict.\n\n## Traced premises\nCurrent source at18098b7b plus findings-only tier record. resolved.rs puzzle_database_target clones held parent and leaf then canonicalizes the old path. DatabaseFileTarget::probe_current reopens the pathname parent. Puzzle SQLite reads use private snapshots from held files. Puzzle cache_key constructs its blocking carrier before its blocking closure. Catalog publication verifies registered root and staging and inventories it, then resolved.atomic_install_download_dir drops both boundaries into pathname atomic_install_dir. Shared install_dir_at_driver and platform install_dir_at already accept held parent and expected source identity. Source trace is RUN/probe-windows-joiners.txt. Existing deletion fallback already covers straightforward rename, so the historical deletion claim is narrowed.\n\n## Approach\n### O1 — Keep a resolved puzzle's retained boundary\nA resolved puzzle read or delete mints its repository carrier from its already-held parent, leaf and file identity without reopening the pathname. That carrier probes the retained boundary without opening and closing the leaf, preserving pooled Unix POSIX locks. Replacing the leaf fails closed. Renaming or replacing the original parent spelling does not redirect the read. Path is a diagnostic/cache locator, never fresh authority. Ordinary database carriers retain existing strict pathname and parent revalidation. Express the internal distinction explicitly with a private validation policy chosen only by the sealed carrier producers. No general exemption from stored-authority canonical acquisition or rebinding rules.\nAll blocking carrier construction and probing for cache_key runs inside its existing cancellation-aware blocking closure. Snapshot reads, cache invalidation, exclusion and cancellation preserve existing contracts.\n\n### O2 — Install through the exact catalog-validated boundary\nFinal catalog publication carries the verified staging parent, staging leaf and exact inventoried identity into installation. The destination capability verifies that the verified staging parent and retained destination parent are the same object, and installs the validated leaf onto its own retained destination leaf through the shared descriptor-relative driver. A substituted pathname never becomes the install authority. Replaced source identity refuses. Existing provenance persistence, precommit failure, rollback and committed durability uncertainty retain their semantics.\nThe outer native archive staging directory transfers immediately after creation from TempDir to the existing identity-bound OwnedStagingDir owner, with pathname destructor disarmed only after successful adoption. That owner is retained through download, validation, final publication and cleanup. Catalog inventory and commit refer to the same owned identity. Success disarms only the committed original source, failure cleanup removes only the original owned source, and parent or staging replacement is preserved. Avoid retaining a second pathname cleanup owner or making an owner from an arbitrary later staging path.\nCatalog publication is absent-only at the actual retained-parent commit boundary. A destination that appears after the earlier absence check is preserved with a typed conflict, never adopted, replaced or recursively removed. The generic installer retains its existing replacement behavior for other callers.\nUse one narrow shared held-parent installation facade for both this path and existing OwnedStagingDir installation, retaining commit-aware cleanup and an explicit internal destination policy. No new pathname-based helper, duplicate platform installer or weakening of current same-parent and no-follow checks.\n\n## Decisions and trade-offs\nOptimal: distinguish already-resolved puzzle capability validation explicitly and carry catalog-validated staging descriptors through final publication → I recommend this approach. Existing strict ordinary acquisition decisions d-20260918-18 and d-20261016-07 remain. d-20260912-04 still governs sites that require canonical_binding, but already-resolved puzzle targets do not acquire a second authority. d-20261005-05 governs inner extraction, which is not changed. New material policy is recorded through findings.py after plan approval with reversal path. Keep one original adopted f021 phase and its historical review metrics unchanged. This is a separate follow-up capability slice required by Ranking6, not a rewrite of O1–O4.\n\n## Risks / open questions\nThe main design judgment is the sealed distinction between ordinary strict-path and puzzle retained-parent probes. Review it before implementation. Native Windows runtime remains mandatory. Existing Windows held handles may refuse rename, so tests must assert the actual refusal rather than claim a Unix rename occurred. Added owned-source identity must remain tied to the inventory and parent that validated it.\n\n## Not part of this task\nNo ordinary database policy change, deletion redesign, SQLite connection framework, catalog ownership expansion, custom source verifier addition, tooling changes or renderer changes. Frozen f021 cleanup rules and legacy-directory preservation stay.\n\n## Phases\nOne cohesive capability phase, because producers and shared carrier/installer consumers share mod.rs/resolved.rs/infra/fs.rs/catalog_install.rs. Also puzzle.rs for blocking cache-key integration and direct runtime regressions, plus src-tauri/src/fs.rs for the outer staging ownership transfer and actual publication caller. This is one cohesive source phase, with existing fixture repair committed separately first. Sensitive Codex gpt-6.1-sol/high writer, one persistent context, no overlapping write leaves. Root traces/arbitrates/records/commits, separate Codex read-only lenses review, no family separation.\nPROOF: cargo test --manifest-path src-tauri/Cargo.toml --locked infra::path_authority::tests -- --nocapture, cargo test --manifest-path src-tauri/Cargo.toml --locked catalog_install -- --nocapture, cargo test --manifest-path src-tauri/Cargo.toml --locked puzzle::tests -- --nocapture, cargo test --manifest-path src-tauri/Cargo.toml --locked infra::fs::tests -- --nocapture, cargo test --manifest-path src-tauri/Cargo.toml --locked db:: -- --nocapture, cargo fmt --manifest-path src-tauri/Cargo.toml -- --check, git diff --check. Behavioral tests cover puzzle carrier/cache/load after parent rename, substitute-parent isolation, replacement leaf refusal, and catalog substitution after inventory validation plus replaced staging. For the actual outer staging owner, verify success and failure through destructor completion preserve a substituted parent/staging tree, and preserve a destination that appears between initial absence check and commit. Keep ordinary inner archive replacement tests green. Unix source-only fix-revert red/green retains tests, no false Windows runtime claim. Existing ordinary parent-swap and pooled-lock tests stay green. Root pre-review, cumulative diff lenses, complete Rust final gates and exact-SHA Windows/macOS/platform CI precede installation. Original full three-flag gates already passed, new source is Rust-only and selected gates follow published corrective range.\n\n## Reviews\nRevision J2. J1 ran12 lenses. Plan and tauri-security adopted JI1, the missing identity-bound outer staging cleanup ownership. Plan adopted JI2, absent-only destination publication to preserve a newly appearing legacy tree. Code-quality adopted JI3, wording to compare staging parent with destination parent. JI1/JI2 are contract-level Fix and require closure, JI3 is a contract-neutral clarification closed by arbiter and retained for diff review. J1 adopted3 semantic witnesses across2 unique issues, plus1 wording witness. All other lenses approved or gave valid class-specific NOT APPLICABLE. No skips, defers or carried semantic issue. Raw reports RUN/joiner-plan-*-r1.txt, preserved losslessly into tracked handoff before implementation closure. Current open IDs JI1, JI2. Authority for both additions is verbatim f-20260920-01's substitution containment and the original frozen f021 O3 ordinary edit/legacy preservation, with concrete current source trace: the final TempDir pathname destructor and generic target replacement described by reviewers. No threat-model expansion or product change. J2 adds source caller ownership and commit policy, not extra machinery. Read-only source probe is locate evidence, not approval. Plan authorship and arbitration share root context. Detection runs on same model family as code in separate sessions.\n",
  "joiner-ownership-mechanism-note.md": "# Fresh ownership judgment after failed JI1 closure\n\nThe invariant is exact identity-bound cleanup and publication for the tree catalog inventory actually validated. No TempDir pathname destructor may delete a substitute. Strict ordinary database behavior and O1 puzzle policy are settled and independent. JI2 absent-only actual catalog commit is CLOSED at J2 by all relevant witnesses, its implementation and proof still pending.\n\nJ1 only fixed the installer and missed TempDir cleanup. J2 proposed adopting the outer .archive at creation, retaining one identity through extraction, and leaving inner replacement unchanged. J2 plan/correctness/root-cause/error-handling show this cannot work: download_file_core_control_with_integrity calls extract_zip/tar/gz, which prepares a separate owned tree then installs it over .archive, exchanges identities and deletes the predecessor. J2 therefore pins the wrong outer identity. Native success and committed-durability/cancellation exits would lose the real owner or reject normal downloads. JI1 remains OPEN. Other J2 closures of JI1 are superseded by this concrete contrary source trace, not silently counted as closure. This is the second failed JI1 mechanism attempt, so root stopped patching and requests fresh review-plan judgment.\n\nOptimal candidate: remove the redundant outer directory replacement from the real catalog-download route. Separate shared archive preparation from installation. The network/hash/sniff/extraction path prepares and returns the existing OwnedStagingDir that extraction already creates as a sibling under the intended engine parent. The actual engine caller takes that exact owner directly into catalog validation and absent-only final publication. There is no outer .archive TempDir directory cleanup owner and no ownership reconstruction from a later pathname. Extraction wrappers used by existing standalone/test routes consume the same preparation and existing installer to preserve their ordinary replace behavior. Keep a single domain implementation for download, extraction and installation, route all callers through it, no duplicate algorithm or new ownership registry. Private naming/shape belongs to executor, behavior boundary is required.\n\nThe production core currently has one catalog caller and test adapters. Trace all actual callers at fs.rs core definitions and network operation wrappers before judgment. Keep network, signed integrity, progress, cancellation, deadline and commit semantics. Existing inner extraction d-20261005-05 behavior stays for consumers that actually need it. Removing an unnecessary intermediate install on the only production catalog route does not authorize new plain-file support or pathname helper. Final source/destination same-parent identity and no-follow checks remain. The prepared owned identity, parent and source leaf become catalog inventory input and final install input. Cleanup on preparation failure uses its own existing owner, no later re-adopt.\n\nAlternative considered: transfer owner identity across inner commit with structured committed-error ownership and new install-return state. This adds identity transition machinery solely to preserve an unnecessary intermediate move. Prefer deleting that move if source tracing confirms no required consumer observes it. Another alternative is preserve outer identity while extracting into it, which risks duplicating extraction/atomicity behavior. Recommend the smallest correct mechanism against actual callers, explicitly account for expected committed-durability exits and final cleanup before requesting J3 correction review.\n\nRequired proof: normal ZIP/TAR/gz download all the way through actual catalog publication, cancellation/preparation failure, final post-inventory parent/source substitution success+failure through destruction, destination appears at commit, source-only red/green for relevant Linux runtime guards, native Windows refusal/runtime acceptance, ordinary extraction replace tests preserved. No new tool or source verifier.\n\nAuthority: exact f-20260920-01 substitution containment plus frozen f021 O3 preserving ordinary user edits/legacy directories. The ordinary substitution threat is unchanged. No product/API/UI decision. Plan J1/J2, all raw reports, failed mechanisms and eventual judgment remain separate follow-up history and never overwrite inherited f021 plan r1–r4 or code r1–r10.\n"
}
```

### Windows source repair b9019fd4 and JI1 fresh mechanism judgment

WF1/WK2 source is committed atb9019fd4 after root independent proof receipt gate-windows-repair-proof.RTVb8R completion0. Root repeated74catalog,284authority,214filesystem plus1inheritedignore,10chesscom and71platform source tests, formatting/diff and complete pre-review, including WindowsGNUall-targetclippy. The writer's three source-assertion red101 outcomes restored exactly and final platform tests passed. Linux source assertions and GNU checks do not prove native Windows runtime. No joiner or cwd production change is in this source commit. The prior record's still-running WF1/WK2 wording is historical and superseded here.

The fresh ownership judgment approves deleting the redundant catalog-route outer .archive install and transferring the existing extractor-prepared OwnedStagingDir directly. Cancellation/deadline awaits producer completion and disposes of a successful returned owner, actual commit flag governs disarming on success and committed durability uncertainty, standalone adapters share preparation and preserve ordinary replacement. JI1 remains open pending final J3 correction review. This is a private fresh-context mechanism judgment after two failed closures, not an additional inherited f021 plan round. No family separation, plan authorship and arbitration share root context.

```json
{
  "repair-windows-native-open.txt": "WF1 completion and approved WK2 are implemented, unstaged. No joiner or cwd mechanism changes.\n\nChanged paths are recorded in the [scoped diff](/tmp/build-de5be974-c551-48bb-b87c-30caf1642a05/wk2-scoped.diff):\n\n- `path_authority/mod.rs`: test-only canonical root constructor, typed Windows kind request and two Windows-native tests.\n- `path_authority/resolved.rs`: mixed kind only for final directory-root `EngineResourceRead`.\n- `infra/fs.rs`: private-temp request remains `NonDirectory`, prior WF1 injector preserved.\n- `fs.rs` and `chesscom.rs`: fixtures use the canonical constructor and returned root path.\n- `platform_support/tests.rs`: three existing assertions adapted.\n- `catalog_install.rs`: prior WF1 changes preserved byte-identically.\n\nAll final checks exited **0**:\n\n| Check | Result |\n|---|---:|\n| Catalog | 74 passed |\n| Path authority | 284 passed |\n| Filesystem | 214 passed, 1 ignored |\n| Chesscom | 10 passed |\n| Platform support | 71 passed |\n| Format, diff, Windows GNU all-target clippy | Passed |\n\n[Exact commands/statuses](/tmp/build-de5be974-c551-48bb-b87c-30caf1642a05/wk2-commands.log).\n\nReversing seven Git-derived source-only hunks produced three compiled assertion failures, each exit **101**:\n\n- “private temporary must delegate with its create, access, descriptor and share request”\n- “definite traversal kinds must delegate to the shared kind-aware share policy”\n- “NT child primitive must pass synchronous CreateOptions to NtCreateFile”\n\nAll seven source/test hashes were restored exactly, with no offsets or fuzz accepted. Final platform tests then passed. [Audit and failure-log references](/tmp/build-de5be974-c551-48bb-b87c-30caf1642a05/wk2-final-audit.json), [final hashes](/tmp/build-de5be974-c551-48bb-b87c-30caf1642a05/wk2-final-hashes.json).\n\nInitial formatting and Windows-test accessor failures were corrected and retained. GNU compilation and Linux source assertions do **not** prove Windows runtime success. Native Windows acceptance remains required. No stage or commit.",
  "wk2-final-audit.json": "{\n  \"completion\": \"WF1 complete and approved WK2 implemented, native Windows runtime pending\",\n  \"changed_paths\": [\n    \"src-tauri/src/infra/path_authority/mod.rs\",\n    \"src-tauri/src/infra/path_authority/resolved.rs\",\n    \"src-tauri/src/infra/fs.rs\",\n    \"src-tauri/src/infra/platform_support/tests.rs\",\n    \"src-tauri/src/fs.rs\",\n    \"src-tauri/src/chesscom.rs\",\n    \"src-tauri/src/infra/path_authority/catalog_install.rs\"\n  ],\n  \"final_checks\": {\n    \"catalog\": {\n      \"status\": 0,\n      \"log\": \"wk2-catalog.log\",\n      \"results\": [\n        \"test result: ok. 74 passed; 0 failed; 0 ignored; 0 measured; 2325 filtered out; finished in 5.36s\"\n      ]\n    },\n    \"authority\": {\n      \"status\": 0,\n      \"log\": \"wk2-authority.log\",\n      \"results\": [\n        \"test result: ok. 284 passed; 0 failed; 0 ignored; 0 measured; 2115 filtered out; finished in 2.76s\"\n      ]\n    },\n    \"fs\": {\n      \"status\": 0,\n      \"log\": \"wk2-fs.log\",\n      \"results\": [\n        \"test result: ok. 214 passed; 0 failed; 1 ignored; 0 measured; 2184 filtered out; finished in 2.23s\"\n      ]\n    },\n    \"chesscom\": {\n      \"status\": 0,\n      \"log\": \"wk2-chesscom.log\",\n      \"results\": [\n        \"test result: ok. 10 passed; 0 failed; 0 ignored; 0 measured; 2389 filtered out; finished in 0.96s\"\n      ]\n    },\n    \"platform\": {\n      \"status\": 0,\n      \"log\": \"wk2-platform.log\",\n      \"results\": [\n        \"test result: ok. 71 passed; 0 failed; 0 ignored; 0 measured; 2328 filtered out; finished in 2.60s\"\n      ]\n    },\n    \"fmt\": {\n      \"status\": 0,\n      \"log\": \"wk2-fmt.log\",\n      \"results\": []\n    },\n    \"diff-check\": {\n      \"status\": 0,\n      \"log\": \"wk2-diff-check.log\",\n      \"results\": []\n    },\n    \"windows-gnu\": {\n      \"status\": 0,\n      \"log\": \"wk2-windows-gnu.log\",\n      \"results\": []\n    }\n  },\n  \"source_only_red\": {\n    \"windows_temporary_creation_descriptor_and_share_mask_are_restrictive\": {\n      \"status\": 101,\n      \"message\": \"private temporary must delegate with its create, access, descriptor and share request\",\n      \"log\": \"wk2-source-red-windows_temporary_creation_descriptor_and_share_mask_are_restrictive.log\",\n      \"compiled_assertion_failure\": true\n    },\n    \"windows_traversal_child_preserves_its_share_mask\": {\n      \"status\": 101,\n      \"message\": \"definite traversal kinds must delegate to the shared kind-aware share policy\",\n      \"log\": \"wk2-source-red-windows_traversal_child_preserves_its_share_mask.log\",\n      \"compiled_assertion_failure\": true\n    },\n    \"windows_nt_create_sites_open_synchronous_file_objects\": {\n      \"status\": 101,\n      \"message\": \"NT child primitive must pass synchronous CreateOptions to NtCreateFile\",\n      \"log\": \"wk2-source-red-windows_nt_create_sites_open_synchronous_file_objects.log\",\n      \"compiled_assertion_failure\": true\n    }\n  },\n  \"restoration\": {\n    \"all_seven_source_test_hashes_equal_pre_reversal\": true,\n    \"native_patch_hunks\": 7,\n    \"exact_old_and_new_line_coordinates_verified\": true,\n    \"git_reverse_and_restore_checks_exit\": 0,\n    \"offset_or_fuzz\": false,\n    \"tests_and_WF1_fixture_constructor_and_hook_retained\": true\n  },\n  \"trace\": {\n    \"WF1\": \"AppOwnedRoot::canonical_for_test is cfg(test), acquires through AppDataDir::for_test, calls unchanged raw Self::new. Both download fixtures take AppOwnedRoot.path. Prior moved-root, malformed-case and InstallRename hook changes retained unchanged.\",\n    \"WK2\": \"Boolean open_windows_child maps definite kinds into open_windows_child_with_kind. That helper builds sharing once and delegates WindowsChildRequest to the sole NtCreateFile. Private temp requests NonDirectory. resolve_windows selects FileOrDirectory only for final EngineResourceRead under root_is_dir. Existing definite traversal, no-follow, parent/identity and postopen validation remain.\",\n    \"native_tests\": \"Added cfg(windows) production authority tests for real file-root directory replacement refusal, normal nested file/directory reads and final/intermediate nested junction refusal. Existing two catalog nested-directory cases preserved.\"\n  },\n  \"invariance\": [\n    \"fs.rs, chesscom.rs and catalog_install.rs production prefixes unchanged\",\n    \"AppDataDir::as_path remains private\",\n    \"canonical equality unchanged\",\n    \"catalog_install.rs byte-identical to WF1 entry\",\n    \"no joiner or cwd mechanism changes\"\n  ],\n  \"failures_retained\": [\n    \"Initial rejected apply_patch used one nonexistent src/infra/fs.rs path, no writes from rejected patch\",\n    \"Initial formatting check exit 1, repaired only newly edited test layout\",\n    \"First Windows GNU wrapper exit 101 E0599 from new test using macOS-only lease accessor, corrected to Windows production UCI value and rerun green\"\n  ],\n  \"limits\": \"Linux source-assertion reds and GNU all-target clippy are not native Windows runtime proof. No Windows execution, crash, browser or app claim. Existing Windows CI red retained. Native Windows must run the two existing catalog cases, added tests and fault outcomes. Joiner plan untouched.\",\n  \"git_status\": \" M src-tauri/src/chesscom.rs\\n M src-tauri/src/fs.rs\\n M src-tauri/src/infra/fs.rs\\n M src-tauri/src/infra/path_authority/catalog_install.rs\\n M src-tauri/src/infra/path_authority/mod.rs\\n M src-tauri/src/infra/path_authority/resolved.rs\\n M src-tauri/src/infra/platform_support/tests.rs\\n\",\n  \"staged_paths\": []\n}\n",
  "joiner-ownership-judgment.txt": "Optimal: remove the intermediate catalog-route installation and transfer the prepared `OwnedStagingDir` directly → I recommend this mechanism. No contrary production requirement found (confidence: 96).\n\nThe source supports this separation:\n\n- `download_engine_archive_core` is the sole production caller at `src-tauri/src/fs.rs:1417`. The other core adapters are test-only at `fs.rs:332` and `fs.rs:361`.\n- ZIP and TAR already construct identity-bound owners at `fs.rs:1600` and `fs.rs:1661`. Gzip delegates to TAR at `fs.rs:1886`.\n- The intermediate identity change occurs only when preparation calls `install_extracted_tree` at `fs.rs:1649` and `fs.rs:1714`. Returning the existing owner removes that transition and the outer `.archive` pathname destructor.\n\nKeep these outcome contracts explicit in J3:\n\n- Preparation errors and cancellation clean the original owned tree. Deadline handling must await producer completion and dispose of any returned owner, including the discarded successful result at `fs.rs:52`.\n- Catalog inventory and installation consume the same retained parent, source leaf and identity. Current pathname inputs at `catalog_install.rs:651` and `resolved.rs:177` must carry that boundary.\n- Precommit failure leaves identity-bound cleanup armed. Final committed success **and committed durability uncertainty** disarm it using the actual commit flag, preserving `infra/fs.rs:902` and `infra/fs.rs:5540`.\n- Standalone extraction adapters share preparation and retain ordinary replacement behavior. Their existing replacement and committed-error tests remain applicable at `infra/fs.rs:10067` and `infra/fs.rs:10116`.\n\nDependent proof must exercise ZIP/TAR/tar.gz through the actual catalog caller, preparation failure, deadline/cancellation through completed cleanup, post-inventory substitutions on success and failure, final durability uncertainty, and JI2’s destination race. Include `fs::tests` alongside catalog and installer suites. Update existing source assertions to follow the shared preparation boundary while preserving their invariants.\n\nJI1 remains open pending review of the final J3 candidate. This approves the proposed mechanism, not J2’s failed ownership contract.\n\nLimitation: source-only judgment, with implementation and native runtime proof pending (confidence: 100). No writes or tests performed. Reviewer and authorship share a model family.\n\nVERDICT: APPROVED",
  "joiner-plan-r3.md": "# Plan: Retained capability boundaries for puzzle reads and catalog installation\n\n## Goal\nFinish the confirmed co-located capability findings before completing the current drain delivery.\n\n## MANDATE\n### A resolved puzzle capability is unusable after its parent directory is renamed, although it retains the parent handle\n\n* **ID:** f-20260917-05 · **Status:** open · **Area:** native-fs · **Root:** - · **Entry:** build · **Blocked:** none\n* **Where:** `ResolvedPath::puzzle_database_target` (`src-tauri/src/infra/path_authority/resolved.rs:475-500`), whose last step is `canonical_binding(self.target()…)` (`infra/path_authority/mod.rs:1602`); the caller is `puzzle_binding` (`src-tauri/src/puzzle.rs:109`), reached from `cache_key`, the `get_puzzle` loading closure, and `delete_puzzle_database_resolved` (`puzzle.rs:661`).\n* **Defect:** the resolved capability already holds the retained parent descriptor and the leaf name, which is what every later operation actually uses. Minting the carrier nevertheless ends with `canonical_binding`, which calls `fs::canonicalize` on the **parent pathname**. If that parent is renamed after capability resolution, the canonicalization fails with `NotFound` and `puzzle_binding` aborts — before `delete_puzzle_database` gets the chance to use the retained handle, which is still perfectly valid and still names the authorized object. The pathname is needed only for the SQLite URI, the cache key and logging; the deletion path needs none of them.\n* **Why it matters:** the retained descriptor exists precisely so that a pathname change cannot invalidate an authorization. Here a pathname change invalidates it anyway, and the operation that suffers most is deletion, where the user has already confirmed an intent and gets an error naming a path they may have renamed themselves minutes earlier.\n* **Related:** `f-20260914-09` (the Windows port of this function; the defect is identical on unix and is neither introduced nor worsened there, which is why that slice filed it rather than fixing it); `d-20260912-04` recorded that `canonical_binding` canonicalizes only the parent, and this is the consequence of that parent still being resolved by name at mint time.\n* **Found by:** `review-correctness` (99) in round 2 of the `f-20260914-09` plan review, 2026-09-17, on Codex; source-verified by the orchestrator at the lines above, including that the unix arm has the same shape.\n* **Entry revalidation, 2026-10-16:** lens → build. The current read path still loses a resolved parent on rename through puzzle_database_target then DatabaseFileTarget::probe_current. Deletion already has a retained-parent fallback, so its historical failure description is narrowed rather than repeated. The proper correction changes the internal carrier's validation contract for resolved puzzle capabilities while ordinary database carriers retain strict pathname validation and pooled POSIX-lock safety. That is an unsettled shared contract, requiring a reviewed plan within the active full-auto build. It is a confirmed direct-file joiner of reopened f-20260914-12 because both fixes edit resolved.rs, under findings-ledger-contract Ranking6. The original f-20261002-04 frozen plan and metrics remain unchanged.\n* **Open question:** how does DatabaseFileTarget explicitly distinguish a resolved puzzle's retained-parent validation from an ordinary database's strict pathname validation without pathname fallback, leaf reopening or weakening ordinary database containment?\n<!-- ledger-meta {\"command\":\"set-header\",\"effect_lines\":2,\"effect_sha256\":\"bf0a7a0e3b0aba8ff5e7e34a98ed0d0d746847ea1eb801d5d29eb326a263b9b0\",\"header_sha256\":\"5f0ab80aeb88311ffd757d1d94b381d4253039c789d2828dba49581191a5c077\",\"header_status\":\"open\",\"input_sha256\":\"ac8a71de6661392093e7ff1519e76131d024f7b70d8ca0ad89fe82ebf1f3d82c\",\"kind\":\"mutation-receipt\",\"operation\":\"e0ecd67d02f330ce7920b3a022d8375314100b33ba34e093dcb6891dcf495b7c\",\"options\":{\"headers\":{\"Entry\":\"build\"},\"section\":null},\"request_id_sha256\":null,\"results\":[\"f-20260917-05\"],\"target\":\"f-20260917-05\",\"v\":1} -->\n\n### `atomic_install_download_dir` reopens its staging and target directories by path, so the engine-archive install has the same identity-only containment gap as its siblings\n\n* **ID:** f-20260920-01 · **Status:** open · **Area:** native-fs · **Root:** - · **Entry:** lens · **Blocked:** none\n* **Where:** `src-tauri/src/infra/path_authority/resolved.rs` `atomic_install_download_dir` (~:149) and the `private_tempdir_in` / install sequence it drives; consumer `publish_engine_archive_tree` (`src-tauri/src/fs.rs`).\n* **Defect (reported by a lens, confirm before fixing):** the resolved directory identity is dropped and both the temporary directory and the target are reopened by pathname. If the validated engine parent is replaced by another real directory between validation and installation, both reopen under the substitute, the same-parent check still passes, and a signed archive is installed outside the authorised root. Same containment class as `f-20260918-02` (`reserve_download_artifact`, `activate_download_artifact`, `workspace_entry_path`), which does not name this door.\n* **Why it matters:** an engine binary installed outside the workspace the user authorised, from a path the authority believed it had validated.\n* **Fix shape:** the same repair `f-20260917-13` applied to its two doors — `acquire_target` plus an `acquired.path == stored.path` check — carried into the directory-install path; a test that swaps the parent between validation and install must fail the install.\n* **Related:** `f-20260918-02` (same class, sibling doors; Root `-`, so the relation is named here).\n* **Found by:** review-tauri-security (Codex) over the `f-20260906-07` cumulative diff, 2026-09-20; outside that mandate, filed by Claude Code.\n* **Why rejected:** Reopen-by-path matters only against a same-user local attacker who already owns the user's files; never observed. Not worth fixing under universal rule 4d (only a defect with a cost is a finding; setup cleanup 2026-10-13).\n<!-- ledger-meta {\"command\":\"annotate\",\"effect_lines\":1,\"effect_sha256\":\"303c8cd742d84bed7c24fb4b3c683506a1129b118ddb2d3afdb717fb5a608484\",\"input_sha256\":\"c204fa18c39dccc61a0346dd996068927f4e426c85eefdf4cf8f94ec86610b73\",\"kind\":\"mutation-receipt\",\"operation\":\"3f96066915421a719574cc7af39d11c678f8072dda85147655c7e69da3662ffa\",\"options\":{\"section\":null},\"request_id_sha256\":null,\"results\":[\"f-20260920-01\"],\"target\":\"f-20260920-01\",\"v\":1} -->\n\n* **Reopened (records lens, 2026-10-13):** the 2026-10-13 rule-4d rejection and its correction above are void. This is product security hardening in a shipped desktop app, not agent machinery: the precondition is write access to a containing directory, which a shared-directory writer has, and `validate_target` checks type and identity without ownership. Rule 4d's own-box clause covers agent, hook, gate and drain machinery only. The finding stays open as it was before the triage.\n<!-- ledger-meta {\"command\":\"annotate\",\"effect_lines\":1,\"effect_sha256\":\"4c2175d5168731852eecb3f9b7ae392674c79c2bc8bdae9035ba41f55e8a9144\",\"input_sha256\":\"b2709c0e5979b7be13f55b09f5bc22158cf7c455b7ec6d5ae50ec378a8e49dc4\",\"kind\":\"mutation-receipt\",\"operation\":\"905ba259eb1d921ef219d921001600090ed09ab23717fb2f5d00308c33c276bd\",\"options\":{\"section\":null},\"request_id_sha256\":null,\"results\":[\"f-20260920-01\"],\"target\":\"f-20260920-01\",\"v\":1} -->\n\n## Threat model and non-goals\nOrdinary user or concurrent rename/replacement of parents or leaf objects after resolution or validation. Preserve no-follow containment, expected identity, existing repository exclusion, POSIX-lock safety, durability and bounded catalog provenance. No malicious continuous-unlink attacker, new public capability, schema migration, resource timer, framework or UI/product change. Ordinary database path validation must stay strict.\n\n## Traced premises\nCurrent source at18098b7b plus findings-only tier record. resolved.rs puzzle_database_target clones held parent and leaf then canonicalizes the old path. DatabaseFileTarget::probe_current reopens the pathname parent. Puzzle SQLite reads use private snapshots from held files. Puzzle cache_key constructs its blocking carrier before its blocking closure. Catalog publication verifies registered root and staging and inventories it, then resolved.atomic_install_download_dir drops both boundaries into pathname atomic_install_dir. Shared install_dir_at_driver and platform install_dir_at already accept held parent and expected source identity. Source trace is RUN/probe-windows-joiners.txt. Existing deletion fallback already covers straightforward rename, so the historical deletion claim is narrowed.\n\n## Approach\n### O1 — Keep a resolved puzzle's retained boundary\nA resolved puzzle read or delete mints its repository carrier from its already-held parent, leaf and file identity without reopening the pathname. That carrier probes the retained boundary without opening and closing the leaf, preserving pooled Unix POSIX locks. Replacing the leaf fails closed. Renaming or replacing the original parent spelling does not redirect the read. Path is a diagnostic/cache locator, never fresh authority. Ordinary database carriers retain existing strict pathname and parent revalidation. Express the internal distinction explicitly with a private validation policy chosen only by the sealed carrier producers. No general exemption from stored-authority canonical acquisition or rebinding rules.\nAll blocking carrier construction and probing for cache_key runs inside its existing cancellation-aware blocking closure. Snapshot reads, cache invalidation, exclusion and cancellation preserve existing contracts.\n\n### O2 — Install through the exact catalog-validated boundary\nFinal catalog publication carries the verified staging parent, staging leaf and exact inventoried identity into installation. The destination capability verifies that the verified staging parent and retained destination parent are the same object, and installs the validated leaf onto its own retained destination leaf through the shared descriptor-relative driver. A substituted pathname never becomes the install authority. Replaced source identity refuses. Existing provenance persistence, precommit failure, rollback and committed durability uncertainty retain their semantics.\nThe real catalog-download route takes the existing extractor-created OwnedStagingDir directly from shared archive preparation into catalog validation and final publication. Remove the redundant intermediate install onto an outer .archive directory and remove that outer TempDir pathname cleanup owner. ZIP, TAR and tar-in-gzip share their existing extraction implementation with standalone adapters. Consumers that actually require intermediate installation use the same prepared owner and ordinary installer, preserving their existing replacement semantics. No later ownership reconstruction from a pathname or duplicated extraction/download algorithm.\nPreparation errors and cancellation clean their original owned tree. Deadline handling awaits producer completion and disposes of a returned successful owner before reporting cancellation or timeout. Precommit publication failure keeps identity-bound cleanup armed. Committed publication success and committed durability uncertainty disarm it from the actual commit flag. Catalog inventory and final installation use the same retained parent, source leaf and identity, with no intermediate identity transition.\nCatalog publication is absent-only at the actual retained-parent commit boundary. A destination that appears after the earlier absence check is preserved with a typed conflict, never adopted, replaced or recursively removed. The generic installer retains its existing replacement behavior for other callers.\nUse one narrow shared held-parent installation facade for both this path and existing OwnedStagingDir installation, retaining commit-aware cleanup and an explicit internal destination policy. No new pathname-based helper, duplicate platform installer or weakening of current same-parent and no-follow checks.\n\n## Decisions and trade-offs\nOptimal: distinguish already-resolved puzzle capability validation explicitly and carry catalog-validated staging descriptors through final publication → I recommend this approach. Existing strict ordinary acquisition decisions d-20260918-18 and d-20261016-07 remain. d-20260912-04 still governs sites that require canonical_binding, but already-resolved puzzle targets do not acquire a second authority. d-20261005-05 governs inner extraction, which is not changed. New material policy is recorded through findings.py after plan approval with reversal path. Keep one original adopted f021 phase and its historical review metrics unchanged. This is a separate follow-up capability slice required by Ranking6, not a rewrite of O1–O4.\n\n## Risks / open questions\nThe sealed distinction between ordinary strict-path and puzzle retained-parent probes is explicit in O1. The fresh ownership judgment approves removing the intermediate catalog-route install rather than tracking a redundant identity transition, with final J3 review required before implementation. Native Windows runtime remains mandatory. Existing Windows held handles may refuse rename, so tests must assert the actual refusal rather than claim a Unix rename occurred. Added owned-source identity must remain tied to the inventory and parent that validated it.\n\n## Not part of this task\nNo ordinary database policy change, deletion redesign, SQLite connection framework, catalog ownership expansion, custom source verifier addition, tooling changes or renderer changes. Frozen f021 cleanup rules and legacy-directory preservation stay.\n\n## Phases\nOne cohesive capability phase, because producers and shared carrier/installer consumers share mod.rs/resolved.rs/infra/fs.rs/catalog_install.rs. Also puzzle.rs for blocking cache-key integration and direct runtime regressions, plus src-tauri/src/fs.rs for shared archive preparation, deletion of the redundant outer stage, and actual publication caller. This is one cohesive source phase, with existing fixture repair committed separately first. Sensitive Codex gpt-6.1-sol/high writer, one persistent context, no overlapping write leaves. Root traces/arbitrates/records/commits, separate Codex read-only lenses review, no family separation.\nPROOF: cargo test --manifest-path src-tauri/Cargo.toml --locked infra::path_authority::tests -- --nocapture, cargo test --manifest-path src-tauri/Cargo.toml --locked catalog_install -- --nocapture, cargo test --manifest-path src-tauri/Cargo.toml --locked puzzle::tests -- --nocapture, cargo test --manifest-path src-tauri/Cargo.toml --locked infra::fs::tests -- --nocapture, cargo test --manifest-path src-tauri/Cargo.toml --locked db:: -- --nocapture, cargo fmt --manifest-path src-tauri/Cargo.toml -- --check, git diff --check. Behavioral tests cover puzzle carrier/cache/load after parent rename, substitute-parent isolation, replacement leaf refusal, and catalog substitution after inventory validation plus replaced staging. Exercise ZIP, TAR and tar.gz download through the actual catalog caller, preparation error, deadline/cancellation through completed cleanup, post-inventory parent/source substitution on success and failure through destructor completion, final committed durability uncertainty, and a destination that appears between initial absence check and commit. Keep ordinary inner archive replacement tests green. Unix source-only fix-revert red/green retains tests, no false Windows runtime claim. Existing ordinary parent-swap and pooled-lock tests stay green. Root pre-review, cumulative diff lenses, complete Rust final gates and exact-SHA Windows/macOS/platform CI precede installation. Original full three-flag gates already passed, new source is Rust-only and selected gates follow published corrective range.\n\n## Reviews\nRevision J3. J1 ran12 lenses. Plan and tauri-security adopted JI1, the missing identity-bound outer staging cleanup ownership. Plan adopted JI2, absent-only destination publication to preserve a newly appearing legacy tree. Code-quality adopted JI3, wording to compare staging parent with destination parent. JI1/JI2 are contract-level Fix and require closure, JI3 is a contract-neutral clarification closed by arbiter and retained for diff review. J1 adopted3 semantic witnesses across2 unique issues, plus1 wording witness. All other lenses approved or gave valid class-specific NOT APPLICABLE. No skips, defers or carried semantic issue. Raw reports RUN/joiner-plan-*-r1.txt, preserved losslessly into tracked handoff before implementation closure. At J1 both semantic IDs were open. J2 closes JI2. Current open ID JI1. Authority for both additions is verbatim f-20260920-01's substitution containment and the original frozen f021 O3 ordinary edit/legacy preservation, with concrete current source trace: the final TempDir pathname destructor and generic target replacement described by reviewers. No threat-model expansion or product change. J2 added source caller ownership and commit policy. Its creation-time outer owner mechanism failed closure: plan, correctness, root-cause and error-handling show inner extraction replaces that directory. JI1 is NOT CLOSED. Other J2 intended-contract closures are superseded by this concrete contrary trace and remain raw history. Root stopped after this second failed mechanism and requested focused fresh-context review-plan judgment, preserved in RUN/joiner-ownership-judgment.txt. That judgment approves the simplest correct mechanism: delete the catalog-route intermediate install and return the existing extractor-owned tree, with explicit preparation/cancellation/deadline and committed-error outcome contracts. J3 implements that mechanism as the plan correction. Authority remains exact f0920 substitution containment and frozen f021 O3 user/legacy preservation, no threat expansion or new product scope. JI1 requires explicit final-J3 closure. JI2 remains closed, with dependencies rechecked. No new unique issue in J2, no count reset and no split to evade closure. Read-only source probe is locate evidence, not approval. Plan authorship and arbitration share root context. Detection runs on same model family as code in separate sessions.\n"
}
```

### Final J3 plan closure before capability implementation

All8selected J3 lenses APPROVED. JI1 is explicitly CLOSED against final direct prepared-owner transfer, JI2 remains CLOSED, JI3 wording closed by arbiter. No new adopted issue or skipped/deferred defect. Separate joiner plan semantic witness counts are j1=3 j2=0 j3=0 across2uniqueissues, plus1contract-neutral wording witness. J2 NOT CLOSED reports and the fresh ownership judgment remain preserved above, never relabeled as inherited f021 plan rounds. Decisions d-20261016-14 and d-20261016-15 record the final technical contracts and reversal paths. Root plan authorship and arbitration share context, detection remains same model family in separate Codex sessions. Implementation, source reversals and native platform runtime proof follow.

```json
{
  "joiner-plan-plan-r3.txt": "JI1 CLOSED — Final J3 explicitly removes the outer `.archive` owner and intermediate installation, carrying the extractor-created owner through inventory and final publication (`tasks/plans/.plan-retained-capability-joiners-r3.body.md:47–48`). This resolves J2’s identity transition: ZIP/TAR already create the owner at `src-tauri/src/fs.rs:1600` and `:1661`, then replace the outer tree at `:1649` and `:1714`. The existing installer supports commit-aware disarming, including durability uncertainty (`src-tauri/src/infra/fs.rs:5540`). Confidence: 96.\n\nJI2 remains closed. J3 preserves absent-only publication and ordinary replacement semantics. Both platform adapters already support no-replace commits (`src-tauri/src/infra/fs.rs:2229`, `:3779`).\n\nNo new plan defects found in the delta or affected dependencies.\n\nLimitation: source-only review. Implementation, regression results and native runtime proof remain pending (confidence: 100). No files changed or tests run. Reviewer and author share a model family.\n\nVERDICT: APPROVED",
  "joiner-plan-tauri-security-r3.txt": "JI1 CLOSED — Final J3 removes the outer `.archive` TempDir and intermediate replacement. The extractor-created `OwnedStagingDir` carries its retained parent, leaf and identity through inventory and final publication. This addresses the pathname cleanup defect at `src-tauri/src/fs.rs:1452` and the identity transition at `fs.rs:1649` and `fs.rs:1714`. J3 explicitly requires completed timeout cleanup, armed precommit cleanup and commit-aware disarming, including durability uncertainty (confidence: 96).\n\nNo new security-boundary defects found in the delta or affected obligations. JI2’s absent-only commit requirement remains intact.\n\nLimitation: this approves the J3 plan contract. Implementation and runtime proof remain pending. Credential/session flows are unchanged. Source-only review, no files changed or tests run. Reviewer and authorship share a model family.\n\nVERDICT: APPROVED",
  "joiner-plan-correctness-r3.txt": "JI1 CLOSED — J3 O2 returns the extractor-created `OwnedStagingDir` directly into catalog inventory and final publication, removing the intermediate replacement that invalidated J2’s owner. Precommit cleanup stays armed, while committed success and durability uncertainty disarm cleanup using the actual commit flag. Deadline handling explicitly disposes of a returned successful owner. (confidence: 98)\n\nJI2 CLOSED — J3 preserves absent-only publication at the retained-parent commit boundary. Removing intermediate installation introduces no dependency requiring destination replacement. (confidence: 97)\n\nNo additional correctness defects found in the J3 delta or affected obligations.\n\nLimitation: source-only plan review. Implementation and native Windows/macOS behavior remain unverified. No writes or tests performed. Reviewer and author share a model family. (confidence: 100)\n\nVERDICT: APPROVED",
  "joiner-plan-root-cause-r3.txt": "JI1 CLOSED — J3 O2 removes the mechanism that defeated J2: extraction no longer replaces an already-adopted outer `.archive` identity. The extractor-created `OwnedStagingDir` carries the same parent, leaf and identity through inventory, final publication and cleanup. Explicit deadline disposal and actual-commit disarming cover cancellation and committed durability uncertainty (confidence: 97).\n\nNo new root-cause blocker or prior-fix reintroduction found. J3 preserves sibling staging, standalone replacement behavior, shared cancellation checks, no-follow containment and POSIX-lock-safe probing. JI2’s absent-only final commit remains explicit.\n\nLimitation — this approves the planned mechanism, not a completed fix. No J3 implementation or failing-before/passing-after runtime evidence exists yet. Required regression and native platform proof remain pending (confidence: 100). Review used read-only source, tests and git history. No writes or tests performed. Author and reviewer share a model family.\n\nVERDICT: APPROVED",
  "joiner-plan-tests-r3.txt": "No findings in J3’s proposed proof. Parent-rename read success, post-inventory substitution isolation, and substitute preservation after cleanup would detect reverts of O1/O2. Actual-caller archive and committed-durability cases cover the revised ownership boundary.\n\nLimitation: implementation and runtime assertions remain pending (confidence: 100). Review shares the author’s model family.\n\nVERDICT: APPROVED",
  "joiner-plan-error-handling-r3.txt": "JI1 CLOSED — Final J3 lines 47–48 remove the identity-changing intermediate install and carry the extractor’s existing owner through inventory and publication. Cancellation/deadline cleanup, precommit cleanup, and disarming after committed success or durability uncertainty are explicit.\n\nJI2 CLOSED — Line 49 preserves absent-only publication with a typed conflict. J3 introduces no conflicting dependency.\n\nNo new error-handling defects found.\n\nLimitation: source-only plan review, implementation and native runtime proof remain pending (confidence: 100). No writes or tests performed. Reviewer and author share a model family.\n\nVERDICT: APPROVED",
  "joiner-plan-minimalism-r3.txt": "No bloat or duplication findings in final J3. The smallest sufficient change is the proposed shared preparation path returning the existing `OwnedStagingDir`, deleting the outer staging directory and intermediate install. Both catalog publication and standalone adapters justify reuse. No new files are proposed.\n\nLimitation: implementation size and duplication require diff review (confidence: 100). Source inspection only, no writes or tests. Reviewer and author share a model family.\n\nVERDICT: APPROVED",
  "joiner-plan-platform-semantics-r3.txt": "No platform-semantics findings against final J3’s revised O2 or affected dependencies. Returning the extractor-created `OwnedStagingDir` removes the intermediate identity transition while preserving the shared platform installer and commit-aware cleanup contract.\n\nProof limitation: implementation remains pending. No tests, compilers or gates ran. Neither `pnpm rust:windows:check` nor the non-Linux Unix source probe is established for this slice. Runtime acceptance still requires exact-SHA `rust-windows-test`, `rust-macos-test` and relevant `rust-platform` jobs. Windows substitution tests must establish actual rename refusal where held handles prevent the Unix scenario.\n\nInspected the plan, delta, supplied evidence, rules, decisions and connected source/tests. No files changed. Review and authorship share a model family in separate sessions.\n\nVERDICT: APPROVED"
}
```


## Post-push correction continuation at09d703ac

This section supersedes pending J3 implementation statements for the recorded local revision only. The separate retained-capability joiner plan J3 was implemented, then integrated through the same persistent sensitive Codex writer. Shared carrier assembly, one bounded staging deadline helper, distinct test-only InstallerEntry fault phase and native Windows5/32 refusal checks preserve the approved JI1/JI2 mechanisms. The outer archive install remains deleted, the extractor-owned staging object reaches final absent-only publication directly. JI3 wording is closed. Original inherited plan counts stay r1=3 r2=0 r3=0 r4=0. Separate joiner plan counts remain j1=3 semantic witnesses across2unique issues, j2=0 j3=0, plus one wording witness. No Skip or Defer.

The final integration writer reports284 authority,79 catalog,217 filesystem with1existing ignore,38 puzzle,581 database parent tests plus isolated children,71 platform, Linux and WindowsGNU all-target clippy, fmt and diff all0. Two final source-only Git reversals, puzzle canonical construction and missing Absent guard, each compile and fail a behavioral assertion with101, unchanged tests, exact restoration and green0. Coupled API reversal remains a compile-only limitation with7missing API/type errors, never behavioral red. Earlier offset attempts are preserved as superseded preparations. No final custom source-assertion staging is claimed.

Root independently repeated affected Rust groups and Linux lint/fmt/diff successfully in gate-joiner-proof.A8UMzj at149c82b4. Its checks:pre-review waited behind other projects' heavy slots. Root then found WR1/WR2 contrary Windows resource-lifetime evidence, canceled only its own queued scheduler, and polled wrapper143. That canceled pre-review is red and supplies no commit/review permission. No owned child remained when ledger mutation resumed. A fresh complete pre-review is required after WR correction.

Windows source evidence: EngineResourceLease documents no-delete, but final EngineResourceRead permits FILE_SHARE_DELETE, drops its parent and supplies a pathname. Windows spawn has no child-side resource handle transfer. Backend failure can close seals while the child remains alive. This invalidates O2's exact-object disjointness premise for independent replacement-root/pre-provenance resource use. Same-root publication carries predecessor users and is not itself the missing-marker witness. Native failure was not reproduced on Linux. Primary f-20261002-04 was reopened at09d703ac before further source edits. Fresh review-plan judgment WRJ1 explicitly leaves WR1 and WR2 NOT CLOSED and adopts WR3 wrong symbol correction. The production boundary is EngineRuntime::spawn_owned. A candidate direct DuplicateHandle transfer plus full retained directory chain is under WRJ2 review, not yet approved or implemented in this section.

Source push1a4305ed still has Windows CI20failures,1441passed7ignored in run38851003688. All required macOS/runtime and three platform jobs succeeded. The generic Linux test job116811963897 later succeeded. Local b9019fd4 repairs all20evidenced Windows clusters, native confirmation remains pending. No installer has run and no daily application update is claimed. f0914/f0917/f0920 stay open until delivery acceptance.

Plan authorship and arbitration shared one context. Detection used the same model family as code in separate Codex sessions, without family separation.

Raw completed J3 integration reports, audits, final reversal patches and fresh WRJ1 judgment are preserved losslessly as decoded JSON strings. Their hashes describe their own snapshots before any later Windows resource correction.

```json
{
  "phase-retained-capability-joiners.txt": "J3 is implemented in six files, left unstaged:\n\n- `path_authority/mod.rs` and `resolved.rs`: sealed retained-parent policy for puzzle carriers, ordinary database validation stays strict.\n- `puzzle.rs`: carrier construction and cache probing run inside the cancellable blocking closure.\n- `fs.rs`: shared archive preparation transfers the extractor’s original owner directly into catalog publication. Timeout awaits completed worker cleanup.\n- `infra/fs.rs`: one held-parent installer preserves source identity, enforces absent-only catalog commit, and disarms cleanup from the actual commit flag.\n- `catalog_install.rs`: inventory and publication consume that same owner and binding.\n\n[Exact diff](/tmp/build-de5be974-c551-48bb-b87c-30caf1642a05/joiner-scoped.diff).\n\nAll final commands exited **0**:\n\n| Suite | Result |\n|---|---:|\n| Path authority | 284 passed |\n| Catalog | 79 passed |\n| Filesystem | 217 passed, 1 ignored |\n| Puzzle | 38 passed |\n| Database | 581 passed |\n| Platform support | 71 passed |\n\nFormatting, diff validation, Linux clippy and Windows GNU all-target clippy also passed. [Commands/statuses](/tmp/build-de5be974-c551-48bb-b87c-30caf1642a05/joiner-commands.log).\n\nGit-derived source-only reversals produced two compiled behavioral reds, each exit **101**:\n\n- Puzzle constructor: `NotFound` at “mint from the retained parent after rename.”\n- Absent-only guard: “an appearing destination must be refused.”\n\nFinal patches accepted no offsets or fuzz. Tests remained intact, all source/test hashes restored exactly, and both cases passed in the final suites. [Hash manifest](/tmp/build-de5be974-c551-48bb-b87c-30caf1642a05/joiner-final-hashes.json).\n\nThe complete API reversal could not execute the adapted source assertions because retained tests require the new ownership APIs. Its seven compilation errors are recorded as a limitation, **not behavioral red**. Initial fixture, lint and offset-bearing audit attempts are preserved separately in the [full audit](/tmp/build-de5be974-c551-48bb-b87c-30caf1642a05/joiner-final-audit.json).\n\nNative Windows/macOS runtime acceptance remains pending. No records, staging or commit writes.",
  "repair-joiner-integration.txt": "Completed Q1–Q4 in five permitted files. `puzzle.rs` remains byte-identical to the entry snapshot.\n\n- `resolved.rs` uses shared `assemble`, then selects retained-parent validation. `mod.rs` probe documentation now describes both policies.\n- `fs.rs` shares one deadline implementation. Timeout drops the admission future and publication permit before awaiting worker completion.\n- `infra/fs.rs` adds test-only `InstallerEntry`. Actual `SyncEntry` hooks remain unchanged.\n- Catalog rename tests accept only Windows native errors 5 or 32 as refusal. Successful renames exercise substitution preservation. Linux rename branches passed.\n\nAll final commands exited **0**:\n\n| Group | Passed | Ignored |\n|---|---:|---:|\n| Authority | 284 | 0 |\n| Catalog | 79 | 0 |\n| Filesystem | 217 | 1 |\n| Puzzle | 38 | 0 |\n| Database | 581 | 0 |\n| Platform | 71 | 0 |\n\nFormatting, diff checks and Linux plus Windows GNU all-target clippy passed.\n\nBoth Git-derived source reversals produced compiled behavioral failures, exit **101**, at the intended puzzle and destination-preservation assertions. Both restored tests passed. Test bytes stayed unchanged, source hashes restored exactly, and Git reported no offsets or fuzz.\n\nEvidence:\n\n- [Exact entry-to-final correction diff](/tmp/build-de5be974-c551-48bb-b87c-30caf1642a05/joiner-integration-corrections.diff)\n- [Audit with statuses, logs and proof hashes](/tmp/build-de5be974-c551-48bb-b87c-30caf1642a05/joiner-integration-audit.json)\n- [Final source and test hashes](/tmp/build-de5be974-c551-48bb-b87c-30caf1642a05/joiner-integration-final-restored-hashes.json)\n- [Exact final commands](/tmp/build-de5be974-c551-48bb-b87c-30caf1642a05/joiner-integration-final-commands.log)\n\nNo unexpected failures or scope deviations. Windows GNU verifies compilation and lint, not native runtime. Windows/macOS runtime remains pending. The prior API-coupled proof limitation remains unchanged, with no final source-assertion staging claimed. Original evidence is preserved. Changes remain unstaged, with no commit or records edits.",
  "joiner-final-audit.json": "{\n  \"status\": \"implemented, final local proof green, unstaged\",\n  \"changed_paths\": [\n    \"src-tauri/src/infra/path_authority/mod.rs\",\n    \"src-tauri/src/infra/path_authority/resolved.rs\",\n    \"src-tauri/src/infra/path_authority/catalog_install.rs\",\n    \"src-tauri/src/infra/fs.rs\",\n    \"src-tauri/src/fs.rs\",\n    \"src-tauri/src/puzzle.rs\"\n  ],\n  \"unchanged_consumer\": \"src-tauri/src/infra/platform_support/tests.rs\",\n  \"checks\": {\n    \"authority\": {\n      \"status\": 0,\n      \"log\": \"joiner-authority.log\",\n      \"test_results\": [\n        \"test result: ok. 284 passed; 0 failed; 0 ignored; 0 measured; 2124 filtered out; finished in 2.31s\"\n      ]\n    },\n    \"catalog\": {\n      \"status\": 0,\n      \"log\": \"joiner-catalog.log\",\n      \"test_results\": [\n        \"test result: ok. 79 passed; 0 failed; 0 ignored; 0 measured; 2329 filtered out; finished in 3.05s\"\n      ]\n    },\n    \"fs\": {\n      \"status\": 0,\n      \"log\": \"joiner-fs.log\",\n      \"test_results\": [\n        \"test result: ok. 217 passed; 0 failed; 1 ignored; 0 measured; 2190 filtered out; finished in 1.59s\"\n      ]\n    },\n    \"puzzle\": {\n      \"status\": 0,\n      \"log\": \"joiner-puzzle.log\",\n      \"test_results\": [\n        \"test result: ok. 38 passed; 0 failed; 0 ignored; 0 measured; 2370 filtered out; finished in 0.61s\"\n      ]\n    },\n    \"db\": {\n      \"status\": 0,\n      \"log\": \"joiner-db.log\",\n      \"test_results\": [\n        \"test result: ok. 1 passed; 0 failed; 0 ignored; 0 measured; 2407 filtered out; finished in 0.00s\",\n        \"test result: ok. 1 passed; 0 failed; 0 ignored; 0 measured; 2407 filtered out; finished in 0.00s\",\n        \"test result: ok. 1 passed; 0 failed; 0 ignored; 0 measured; 2407 filtered out; finished in 0.00s\",\n        \"test result: ok. 1 passed; 0 failed; 0 ignored; 0 measured; 2407 filtered out; finished in 0.00s\",\n        \"test result: ok. 1 passed; 0 failed; 0 ignored; 0 measured; 2407 filtered out; finished in 0.00s\",\n        \"test result: ok. 1 passed; 0 failed; 0 ignored; 0 measured; 2407 filtered out; finished in 0.23s\",\n        \"test result: ok. 1 passed; 0 failed; 0 ignored; 0 measured; 2407 filtered out; finished in 0.12s\",\n        \"test result: ok. 1 passed; 0 failed; 0 ignored; 0 measured; 2407 filtered out; finished in 0.10s\",\n        \"test result: ok. 1 passed; 0 failed; 0 ignored; 0 measured; 2407 filtered out; finished in 2.26s\",\n        \"test result: ok. 1 passed; 0 failed; 0 ignored; 0 measured; 2407 filtered out; finished in 0.13s\",\n        \"test result: ok. 1 passed; 0 failed; 0 ignored; 0 measured; 2407 filtered out; finished in 0.11s\",\n        \"test result: ok. 1 passed; 0 failed; 0 ignored; 0 measured; 2407 filtered out; finished in 4.25s\",\n        \"test result: ok. 1 passed; 0 failed; 0 ignored; 0 measured; 2407 filtered out; finished in 0.01s\",\n        \"test result: ok. 1 passed; 0 failed; 0 ignored; 0 measured; 2407 filtered out; finished in 0.06s\",\n        \"test result: ok. 1 passed; 0 failed; 0 ignored; 0 measured; 2407 filtered out; finished in 0.06s\",\n        \"test result: ok. 1 passed; 0 failed; 0 ignored; 0 measured; 2407 filtered out; finished in 1.27s\",\n        \"test result: ok. 581 passed; 0 failed; 0 ignored; 0 measured; 1827 filtered out; finished in 37.35s\"\n      ]\n    },\n    \"platform\": {\n      \"status\": 0,\n      \"log\": \"joiner-platform.log\",\n      \"test_results\": [\n        \"test result: ok. 71 passed; 0 failed; 0 ignored; 0 measured; 2337 filtered out; finished in 2.77s\"\n      ]\n    },\n    \"fmt\": {\n      \"status\": 0,\n      \"log\": \"joiner-fmt.log\",\n      \"test_results\": []\n    },\n    \"diff-check\": {\n      \"status\": 0,\n      \"log\": \"joiner-diff-check.log\",\n      \"test_results\": []\n    },\n    \"windows-gnu\": {\n      \"status\": 0,\n      \"log\": \"joiner-windows-gnu.log\",\n      \"test_results\": []\n    },\n    \"linux-clippy\": {\n      \"status\": 0,\n      \"log\": \"joiner-linux-clippy.log\",\n      \"test_results\": []\n    }\n  },\n  \"fix_revert\": {\n    \"coupled-api\": {\n      \"status\": 101,\n      \"kind\": \"compile limitation, not behavioral red\",\n      \"errors\": [\n        \"error[E0599]: no method named `binding` found for struct `infra::fs::OwnedStagingDir` in the current scope\",\n        \"error[E0433]: cannot find type `DirectoryInstallPolicy` in this scope\",\n        \"error[E0425]: cannot find function `install_staging_dir_at` in this scope\",\n        \"error[E0308]: mismatched types\",\n        \"error[E0308]: mismatched types\",\n        \"error[E0308]: mismatched types\",\n        \"error[E0308]: mismatched types\"\n      ],\n      \"source_assertion_executed\": false,\n      \"log\": \"joiner-proof-coupled-api.log\",\n      \"git_patch\": \"joiner-proof-coupled-api.patch\",\n      \"test_hashes_preserved\": true,\n      \"all_seven_source_test_hashes_restored_exactly\": true,\n      \"no_offsets_or_fuzz\": true\n    },\n    \"puzzle\": {\n      \"status\": 101,\n      \"kind\": \"compiled behavioral assertion red\",\n      \"message\": \"mint from the retained parent after rename: Io(Os { code: 2, kind: NotFound, message: \\\"No such file or directory\\\" })\",\n      \"final_green_suite\": \"puzzle\",\n      \"log\": \"joiner-proof-puzzle-red.log\",\n      \"git_patch\": \"joiner-proof-puzzle.patch\",\n      \"test_hashes_preserved\": true,\n      \"all_seven_source_test_hashes_restored_exactly\": true,\n      \"no_offsets_or_fuzz\": true\n    },\n    \"absent\": {\n      \"status\": 101,\n      \"kind\": \"compiled behavioral assertion red\",\n      \"message\": \"an appearing destination must be refused\",\n      \"final_green_suite\": \"catalog\",\n      \"log\": \"joiner-proof-absent-red.log\",\n      \"git_patch\": \"joiner-proof-absent.patch\",\n      \"test_hashes_preserved\": true,\n      \"all_seven_source_test_hashes_restored_exactly\": true,\n      \"no_offsets_or_fuzz\": true\n    }\n  },\n  \"trace\": {\n    \"puzzle\": \"Private DatabaseTargetValidation selects Pathname for ordinary assemble/database/test producers. Only resolved puzzle production chooses RetainedParent, with actual retained parent/leaf/opened terminal identity and captured diagnostic locator. probe_current uses the existing no-open Unix stat route. cache_key construction and probe run inside its cancellable BLOCKING_GATEWAY closure.\",\n    \"preparation\": \"prepare_archive_download shares network/hash/sniff/extraction and returns only unit. ZIP and TAR transfer creation-time OwnedStagingDir, gzip delegates TAR. Consumer runs on the same blocking worker. Actual catalog route has no outer .archive TempDir or intermediate install. Standalone test adapters consume the same owner through ordinary replacement. The unused pathname installer chain is cfg(test).\",\n    \"deadline\": \"Worker sends unit readiness while retaining owner, then waits for unit publication permit. Readiness ends the preparation deadline before commit_gate admission. Timeout cancels, closes the permit and awaits actual producer completion. Owner cleanup remains on the blocking worker, including abandonment and producer errors. No deadline races the publication/durability tail.\",\n    \"publication\": \"Catalog inventory uses owner.directory after original parent/leaf/identity checks against exact registered root. Existing atomic provenance and session lifecycle remain. ResolvedPath passes retained destination parent/leaf plus the same owner to the shared install_staging_dir_at. Parent identities are compared. Existing one platform/shared driver receives expected source identity and Absent policy. Standalone replacement uses Replace. Actual commit flag disarms cleanup on success and committed durability uncertainty.\",\n    \"witnesses\": \"Actual core ZIP/TAR/tar.gz success, invalid ZIP completed cleanup, cancellation and actual core deadline with held extraction/native-operation drain. Parent/source substitutions run at existing SyncEntry seam after inventory final check and before first installer source observation. Success/failure destruction preserves substituted parent data. Source replacement refuses or measures actual Windows rename refusal. Appearing user destination is preserved with Conflict. Absent-install uncertainty disarms cleanup. Puzzle mint/cache/load supports bare and substituted parent renames, and probes reject missing/replaced/directory/symlink leaves. Repository deletion exclusion observes existing wait, cancels and joins, then retries deletion. Existing database parent-swap and POSIX-lock tests remain green.\"\n  },\n  \"limits\": [\n    \"Coupled API source-only removal cannot execute the three adapted source verifiers with new tests retained. Seven missing API/type compilation errors are retained, not counted as behavioral red. Final adapted assertions pass. Isolated puzzle and absent-policy guards have compiled behavioral red/green proof.\",\n    \"Linux runtime plus GNU all-target clippy are not Windows/macOS runtime proof. Hosted exact-SHA runtime CI remains root work. No browser, crash or full-app verification claim.\"\n  ],\n  \"initial_attempts\": [\n    \"joiner-initial-compile.log: 73 catalog passes and one adoption-fixture failure. Direct publication now asserts Conflict and preserves provenance/data. Command existing-target success remains unchanged.\",\n    \"joiner-focused-attempt1.log: seven passes and one fixture failure from SQLite ordinary-capability exclusion. Fixture now drops ordinary file lease before SQLite while retaining sealed carrier.\",\n    \"Initial syntax/format/rejected-context attempts repaired before final proof. First lint failures retained under joiner-checks-attempt1-*. Unused adapter chain/import became cfg(test). The existing shared driver gained one argument and has a local too_many_arguments allowance, no gate/budget change.\",\n    \"Partial-patch audit originally rejected offset diagnostics -8/-13. Corrected derivation uses exact partial baselines retaining all other changes. Earlier snapshots/attempts remain under joiner-prior-*, joiner-api-validation-* and joiner-pre-entry-*, including offset attempts. Their hashes are historical, not final.\",\n    \"An earlier final-audit assertion expected the entry-time root-owned handoff to remain dirty. It is now clean. Leaf never wrote it. Corrected audit accepts either root-owned handoff state and confirms only six source paths changed.\"\n  ],\n  \"performance\": {\n    \"initial_puzzle_suite_observed_seconds\": 60.41,\n    \"final_puzzle_suite_seconds\": 0.61,\n    \"reason\": \"Existing deletion_is_waiting plus cancellation/scoped join replaces fixture wait for the normal repository retirement timeout. No production timeout/limit changed.\"\n  },\n  \"git_status\": \" M src-tauri/src/fs.rs\\n M src-tauri/src/infra/fs.rs\\n M src-tauri/src/infra/path_authority/catalog_install.rs\\n M src-tauri/src/infra/path_authority/mod.rs\\n M src-tauri/src/infra/path_authority/resolved.rs\\n M src-tauri/src/puzzle.rs\\n\",\n  \"staged_paths\": [],\n  \"deviations\": \"No implementation scope or behavioral-contract deviation. Explicit allowed proof limitation for API-coupled source assertions. No records, ledger, stage or commit writes.\"\n}\n",
  "joiner-integration-audit.json": "{\n  \"changed_relative_to_entry\": [\n    \"src-tauri/src/infra/path_authority/mod.rs\",\n    \"src-tauri/src/infra/path_authority/resolved.rs\",\n    \"src-tauri/src/infra/path_authority/catalog_install.rs\",\n    \"src-tauri/src/infra/fs.rs\",\n    \"src-tauri/src/fs.rs\"\n  ],\n  \"unchanged_puzzle_bytes\": true,\n  \"unchanged_catalog_production_prefix\": true,\n  \"initial_focused\": {\n    \"exit\": 0,\n    \"passed\": 9\n  },\n  \"final\": {\n    \"authority\": {\n      \"exit\": 0,\n      \"summary\": \"ok. 284 passed; 0 failed; 0 ignored; 0 measured; 2124 filtered out; finished in 2.71s\",\n      \"log\": \"/tmp/build-de5be974-c551-48bb-b87c-30caf1642a05/joiner-integration-final-authority.log\"\n    },\n    \"catalog\": {\n      \"exit\": 0,\n      \"summary\": \"ok. 79 passed; 0 failed; 0 ignored; 0 measured; 2329 filtered out; finished in 3.87s\",\n      \"log\": \"/tmp/build-de5be974-c551-48bb-b87c-30caf1642a05/joiner-integration-final-catalog.log\"\n    },\n    \"fs\": {\n      \"exit\": 0,\n      \"summary\": \"ok. 217 passed; 0 failed; 1 ignored; 0 measured; 2190 filtered out; finished in 1.65s\",\n      \"log\": \"/tmp/build-de5be974-c551-48bb-b87c-30caf1642a05/joiner-integration-final-fs.log\"\n    },\n    \"puzzle\": {\n      \"exit\": 0,\n      \"summary\": \"ok. 38 passed; 0 failed; 0 ignored; 0 measured; 2370 filtered out; finished in 0.63s\",\n      \"log\": \"/tmp/build-de5be974-c551-48bb-b87c-30caf1642a05/joiner-integration-final-puzzle.log\"\n    },\n    \"db\": {\n      \"exit\": 0,\n      \"summary\": \"ok. 581 passed; 0 failed; 0 ignored; 0 measured; 1827 filtered out; finished in 27.79s\",\n      \"log\": \"/tmp/build-de5be974-c551-48bb-b87c-30caf1642a05/joiner-integration-final-db.log\"\n    },\n    \"platform\": {\n      \"exit\": 0,\n      \"summary\": \"ok. 71 passed; 0 failed; 0 ignored; 0 measured; 2337 filtered out; finished in 2.62s\",\n      \"log\": \"/tmp/build-de5be974-c551-48bb-b87c-30caf1642a05/joiner-integration-final-platform.log\"\n    },\n    \"fmt\": {\n      \"exit\": 0,\n      \"summary\": \"passed\",\n      \"log\": \"/tmp/build-de5be974-c551-48bb-b87c-30caf1642a05/joiner-integration-final-fmt.log\"\n    },\n    \"diff\": {\n      \"exit\": 0,\n      \"summary\": \"passed\",\n      \"log\": \"/tmp/build-de5be974-c551-48bb-b87c-30caf1642a05/joiner-integration-final-diff.log\"\n    },\n    \"linux-clippy\": {\n      \"exit\": 0,\n      \"summary\": \"passed\",\n      \"log\": \"/tmp/build-de5be974-c551-48bb-b87c-30caf1642a05/joiner-integration-final-linux-clippy.log\"\n    },\n    \"windows-clippy\": {\n      \"exit\": 0,\n      \"summary\": \"passed\",\n      \"log\": \"/tmp/build-de5be974-c551-48bb-b87c-30caf1642a05/joiner-integration-final-windows-clippy.log\"\n    }\n  },\n  \"proofs\": {\n    \"puzzle\": {\n      \"statuses\": {\n        \"check\": 0,\n        \"reverse\": 0,\n        \"red\": 101,\n        \"restore\": 0,\n        \"green\": 0\n      },\n      \"test_bytes_unchanged\": true,\n      \"source_exactly_restored\": true,\n      \"offsets_or_fuzz\": false,\n      \"patch_sha256\": \"0b5a64cdceb353e2a405f7eb202ab397d4527f3e4eefbe40ef52ac27374d3cd5\"\n    },\n    \"absent\": {\n      \"statuses\": {\n        \"check\": 0,\n        \"reverse\": 0,\n        \"red\": 101,\n        \"restore\": 0,\n        \"green\": 0\n      },\n      \"test_bytes_unchanged\": true,\n      \"source_exactly_restored\": true,\n      \"offsets_or_fuzz\": false,\n      \"patch_sha256\": \"b6ffb71beb276b6d82eb49485ad04b53d3145a7464bfb1abbc1d0681ffdebd4f\"\n    }\n  },\n  \"source_sha256\": {\n    \"src-tauri/src/infra/path_authority/mod.rs\": \"a8ca20918c30ee358322b5c03bc1305947bb7ef835d43b3ba218030e8ce5e53c\",\n    \"src-tauri/src/infra/path_authority/resolved.rs\": \"d6afeb4dc49831bd77cd039c1aa722532e8d345ffb041329c736e0c07b95d2a0\",\n    \"src-tauri/src/infra/path_authority/catalog_install.rs\": \"882717b41eb153855233f8e92ecc0747d925bc9ee9fb10ec02b7052733bb106e\",\n    \"src-tauri/src/infra/fs.rs\": \"d89389b74f20574a0cb06d14f9c2158152c0cfa0cdcda64520aae9eccaeb862e\",\n    \"src-tauri/src/fs.rs\": \"5036fa6e46b56e7691af7fe5979e6b6a7a61e81f045837eceddc2e96bfb2fa9d\",\n    \"src-tauri/src/puzzle.rs\": \"90c202bc1c7c8ee052afb11be52de3424b129c80fa50a75ed1fa4a02aa65e55f\"\n  },\n  \"test_suffix_sha256\": {\n    \"src-tauri/src/infra/path_authority/mod.rs\": \"ea5a96cd0cf4cf95de1300aca58a33786260ea58b70e4d8b284104b0192c2f07\",\n    \"src-tauri/src/infra/path_authority/resolved.rs\": \"58e36ecc506f3219f50cd9635c52b4cd52fa0dcb74479c55641e114478b0498d\",\n    \"src-tauri/src/infra/path_authority/catalog_install.rs\": \"a88a79abdce97bce49cdc4e5901b1f7d2a5e63676f605f8cddd865320b676af9\",\n    \"src-tauri/src/infra/fs.rs\": \"3d84ca9db818fd5a73a7b82675f5567ab4806ffbc14f4f58c7894aef142bdbec\",\n    \"src-tauri/src/fs.rs\": \"8e94fc2fa0ba372a5540d6137cead2ae6b9c71825541f62c2a4baaeb02ece549\",\n    \"src-tauri/src/puzzle.rs\": \"1f87612b1e3b88c4389c584e196a68b5317970e0ca6e9b9145760e9e02209fdb\"\n  },\n  \"correction_diff_sha256\": \"b87492b8ffddeae2f15f6881d898b096fcbc628828b036fc0b096b7795011397\",\n  \"unexpected_failures\": [],\n  \"limitations\": [\n    \"Windows GNU all-target clippy is compilation and lint proof, not native Windows runtime\",\n    \"macOS runtime not run in this revision\",\n    \"Prior API-coupled removal compile limitation retained without rerun\",\n    \"No final source-text assertion staged-failure claim\"\n  ],\n  \"scope\": \"Five integration source edits within six permitted files, puzzle.rs byte-identical to entry. Unstaged, no commit or records writes.\",\n  \"initial_outputs\": {\n    \"focused\": \"joiner-integration-initial.log\",\n    \"fmt\": \"joiner-integration-initial-fmt.log\",\n    \"unexpected_failures\": []\n  }\n}\n",
  "joiner-integration-final-restored-hashes.json": "{\n  \"source\": {\n    \"src-tauri/src/infra/path_authority/mod.rs\": \"a8ca20918c30ee358322b5c03bc1305947bb7ef835d43b3ba218030e8ce5e53c\",\n    \"src-tauri/src/infra/path_authority/resolved.rs\": \"d6afeb4dc49831bd77cd039c1aa722532e8d345ffb041329c736e0c07b95d2a0\",\n    \"src-tauri/src/infra/path_authority/catalog_install.rs\": \"882717b41eb153855233f8e92ecc0747d925bc9ee9fb10ec02b7052733bb106e\",\n    \"src-tauri/src/infra/fs.rs\": \"d89389b74f20574a0cb06d14f9c2158152c0cfa0cdcda64520aae9eccaeb862e\",\n    \"src-tauri/src/fs.rs\": \"5036fa6e46b56e7691af7fe5979e6b6a7a61e81f045837eceddc2e96bfb2fa9d\",\n    \"src-tauri/src/puzzle.rs\": \"90c202bc1c7c8ee052afb11be52de3424b129c80fa50a75ed1fa4a02aa65e55f\"\n  },\n  \"tests\": {\n    \"src-tauri/src/infra/path_authority/mod.rs\": \"ea5a96cd0cf4cf95de1300aca58a33786260ea58b70e4d8b284104b0192c2f07\",\n    \"src-tauri/src/infra/path_authority/resolved.rs\": \"58e36ecc506f3219f50cd9635c52b4cd52fa0dcb74479c55641e114478b0498d\",\n    \"src-tauri/src/infra/path_authority/catalog_install.rs\": \"a88a79abdce97bce49cdc4e5901b1f7d2a5e63676f605f8cddd865320b676af9\",\n    \"src-tauri/src/infra/fs.rs\": \"3d84ca9db818fd5a73a7b82675f5567ab4806ffbc14f4f58c7894aef142bdbec\",\n    \"src-tauri/src/fs.rs\": \"8e94fc2fa0ba372a5540d6137cead2ae6b9c71825541f62c2a4baaeb02ece549\",\n    \"src-tauri/src/puzzle.rs\": \"1f87612b1e3b88c4389c584e196a68b5317970e0ca6e9b9145760e9e02209fdb\"\n  },\n  \"tests_unchanged\": true,\n  \"source_exactly_restored\": true\n}\n",
  "joiner-integration-corrections.diff": "diff --git a/src-tauri/src/infra/path_authority/mod.rs b/src-tauri/src/infra/path_authority/mod.rs\nindex 6ccbe19c..faa5e0f1 100644\n--- a/src-tauri/src/infra/path_authority/mod.rs\n+++ b/src-tauri/src/infra/path_authority/mod.rs\n@@ -1025,10 +1025,11 @@ impl DatabaseFileTarget {\n         &self.path\n     }\n \n-    /// Probes the regular file authorized by this carrier after rechecking its retained parent\n-    /// and inode. Unix must not open the leaf: closing any descriptor for an inode can release\n-    /// this process's POSIX locks held by a pooled SQLite connection (`f-20260929-11`). The\n-    /// pathname walk stays beside the carrier so repository callers cannot substitute a path.\n+    /// Probes the regular file and its identity. Ordinary carriers revalidate the pathname and\n+    /// parent binding, while puzzle carriers probe the retained parent and leaf after a rename.\n+    /// Unix must not open the leaf: closing any descriptor for an inode can release this process's\n+    /// POSIX locks held by a pooled SQLite connection (`f-20260929-11`). Validation stays beside\n+    /// the carrier so repository callers cannot substitute a path.\n     pub(crate) fn probe_current(&self) -> Result<RegularFileMetadata, Error> {\n         const CONFLICT: &str = \"database changed after capability resolution\";\n \ndiff --git a/src-tauri/src/infra/path_authority/resolved.rs b/src-tauri/src/infra/path_authority/resolved.rs\nindex 48ceb071..b3b04cec 100644\n--- a/src-tauri/src/infra/path_authority/resolved.rs\n+++ b/src-tauri/src/infra/path_authority/resolved.rs\n@@ -542,13 +542,9 @@ impl ResolvedPath {\n             .target()\n             .ok_or_else(|| Error::Conflict(\"puzzle database target is unavailable\".into()))?\n             .to_path_buf();\n-        Ok(DatabaseFileTarget {\n-            parent,\n-            leaf,\n-            identity,\n-            path,\n-            validation: super::DatabaseTargetValidation::RetainedParent,\n-        })\n+        let mut target = DatabaseFileTarget::assemble(parent, leaf, identity, path);\n+        target.validation = super::DatabaseTargetValidation::RetainedParent;\n+        Ok(target)\n     }\n \n     /// Duplicate the already-authorized descriptor for SQLite. The caller owns\ndiff --git a/src-tauri/src/infra/path_authority/catalog_install.rs b/src-tauri/src/infra/path_authority/catalog_install.rs\nindex 2768f3c2..7fb4de72 100644\n--- a/src-tauri/src/infra/path_authority/catalog_install.rs\n+++ b/src-tauri/src/infra/path_authority/catalog_install.rs\n@@ -1036,7 +1036,7 @@ mod tests {\n     struct InstallEntryAction(std::cell::RefCell<Option<InstallEntryCallback>>);\n     impl AtomicDirInjector for InstallEntryAction {\n         fn inject(&self, point: AtomicDirFaultPoint) -> std::io::Result<()> {\n-            if point == AtomicDirFaultPoint::SyncEntry {\n+            if point == AtomicDirFaultPoint::InstallerEntry {\n                 if let Some(action) = self.0.borrow_mut().take() {\n                     return action();\n                 }\n@@ -1063,31 +1063,43 @@ mod tests {\n         for fail in [false, true] {\n             let mut f = Fixture::new();\n             let mut stage = f.stage();\n-            #[cfg(unix)]\n             let stage_leaf = stage.path().file_name().unwrap().to_os_string();\n             let moved = f.temp.path().join(\"moved-root\");\n             let root = f.root.clone();\n             let moved_at_hook = moved.clone();\n+            let renamed = Arc::new(std::sync::atomic::AtomicBool::new(false));\n+            let renamed_at_hook = renamed.clone();\n             let _reset = DirFaultReset;\n             set_test_atomic_dir_injector(Some(Box::new(InstallEntryAction(\n                 std::cell::RefCell::new(Some(Box::new(move || {\n-                    #[cfg(unix)]\n-                    {\n-                        fs::rename(&root, &moved_at_hook).unwrap();\n-                        fs::create_dir(&root).unwrap();\n-                        fs::create_dir(root.join(&stage_leaf)).unwrap();\n-                        fs::write(\n-                            root.join(&stage_leaf).join(\"foreign\"),\n-                            b\"preserve substitute\",\n-                        )\n-                        .unwrap();\n-                    }\n-                    #[cfg(windows)]\n-                    {\n-                        assert!(\n-                            fs::rename(&root, &moved_at_hook).is_err(),\n-                            \"retained parent must refuse the Windows rename\"\n-                        );\n+                    match fs::rename(&root, &moved_at_hook) {\n+                        Ok(()) => {\n+                            renamed_at_hook.store(true, Ordering::SeqCst);\n+                            fs::create_dir(&root).unwrap();\n+                            fs::create_dir(root.join(&stage_leaf)).unwrap();\n+                            fs::write(\n+                                root.join(&stage_leaf).join(\"foreign\"),\n+                                b\"preserve substitute\",\n+                            )\n+                            .unwrap();\n+                        }\n+                        Err(error) => {\n+                            #[cfg(unix)]\n+                            panic!(\"Unix parent rename must succeed: {error}\");\n+                            #[cfg(windows)]\n+                            {\n+                                assert!(matches!(error.raw_os_error(), Some(5 | 32)), \"{error}\");\n+                                assert!(!moved_at_hook.exists());\n+                                assert_eq!(\n+                                    fs::read(root.join(&stage_leaf).join(\"engine\")).unwrap(),\n+                                    b\"managed engine\"\n+                                );\n+                                assert_eq!(\n+                                    fs::read(root.join(&stage_leaf).join(\"data/network\")).unwrap(),\n+                                    b\"managed network\"\n+                                );\n+                            }\n+                        }\n                     }\n                     if fail {\n                         Err(std::io::Error::other(\"post-inventory refusal\"))\n@@ -1101,19 +1113,29 @@ mod tests {\n             let stage_path = stage.path().to_path_buf();\n             drop(stage);\n             #[cfg(unix)]\n-            {\n+            assert!(renamed.load(Ordering::SeqCst));\n+            let installed_root = if renamed.load(Ordering::SeqCst) {\n                 assert_eq!(\n                     fs::read(stage_path.join(\"foreign\")).unwrap(),\n                     b\"preserve substitute\"\n                 );\n-                assert_eq!(moved.join(\"installed/data/network\").exists(), !fail);\n                 assert!(!moved.join(stage_path.file_name().unwrap()).exists());\n-            }\n-            #[cfg(windows)]\n-            {\n+                &moved\n+            } else {\n                 assert!(!moved.exists());\n-                assert_eq!(f.root.join(\"installed/data/network\").exists(), !fail);\n                 assert!(!stage_path.exists());\n+                &f.root\n+            };\n+            assert_eq!(installed_root.join(\"installed\").exists(), !fail);\n+            if !fail {\n+                assert_eq!(\n+                    fs::read(installed_root.join(\"installed/engine\")).unwrap(),\n+                    b\"managed engine\"\n+                );\n+                assert_eq!(\n+                    fs::read(installed_root.join(\"installed/data/network\")).unwrap(),\n+                    b\"managed network\"\n+                );\n             }\n         }\n     }\n@@ -1167,7 +1189,18 @@ mod tests {\n                         #[cfg(unix)]\n                         panic!(\"Unix source rename must succeed: {error}\");\n                         #[cfg(windows)]\n-                        assert_eq!(error.kind(), std::io::ErrorKind::PermissionDenied);\n+                        {\n+                            assert!(matches!(error.raw_os_error(), Some(5 | 32)), \"{error}\");\n+                            assert!(!moved_at_hook.exists());\n+                            assert_eq!(\n+                                fs::read(source_at_hook.join(\"engine\")).unwrap(),\n+                                b\"managed engine\"\n+                            );\n+                            assert_eq!(\n+                                fs::read(source_at_hook.join(\"data/network\")).unwrap(),\n+                                b\"managed network\"\n+                            );\n+                        }\n                     }\n                 }\n                 Ok(())\n@@ -1175,17 +1208,29 @@ mod tests {\n         )))));\n         let result = f.publish_stage(\"installed\", &mut stage);\n         drop(stage);\n+        #[cfg(unix)]\n+        assert!(renamed.load(Ordering::SeqCst));\n         if renamed.load(Ordering::SeqCst) {\n             assert!(matches!(result, Err(Error::Conflict(_))));\n             assert!(!f.root.join(\"installed\").exists());\n             assert_eq!(fs::read(source.join(\"foreign\")).unwrap(), b\"foreign source\");\n             assert_eq!(fs::read(moved.join(\"engine\")).unwrap(), b\"managed engine\");\n+            assert_eq!(\n+                fs::read(moved.join(\"data/network\")).unwrap(),\n+                b\"managed network\"\n+            );\n         } else {\n             assert!(result.is_ok());\n+            assert!(!source.exists());\n+            assert!(!moved.exists());\n             assert_eq!(\n                 fs::read(f.root.join(\"installed/engine\")).unwrap(),\n                 b\"managed engine\"\n             );\n+            assert_eq!(\n+                fs::read(f.root.join(\"installed/data/network\")).unwrap(),\n+                b\"managed network\"\n+            );\n         }\n     }\n \ndiff --git a/src-tauri/src/infra/fs.rs b/src-tauri/src/infra/fs.rs\nindex 09c05881..59eefe42 100644\n--- a/src-tauri/src/infra/fs.rs\n+++ b/src-tauri/src/infra/fs.rs\n@@ -5270,6 +5270,7 @@ where\n #[cfg(test)]\n #[derive(Debug, Clone, Copy, PartialEq, Eq)]\n pub(crate) enum AtomicDirFaultPoint {\n+    InstallerEntry,\n     SyncEntry,\n     PreCommit,\n     /// Unix: immediately before the single `EXCHANGE` (no backup is taken). Windows: after the\n@@ -5580,7 +5581,7 @@ pub(crate) fn install_staging_dir_at(\n     policy: DirectoryInstallPolicy,\n ) -> Result<(), Error> {\n     #[cfg(test)]\n-    inject_atomic_dir(AtomicDirFaultPoint::SyncEntry)?;\n+    inject_atomic_dir(AtomicDirFaultPoint::InstallerEntry)?;\n     if source.parent_identity()? != opened_identity(destination_parent)? {\n         return Err(Error::InvalidInput(\n             \"directory staging source must be in the target's real parent directory\".into(),\ndiff --git a/src-tauri/src/fs.rs b/src-tauri/src/fs.rs\nindex 39c5326d..b87f91a4 100644\n--- a/src-tauri/src/fs.rs\n+++ b/src-tauri/src/fs.rs\n@@ -43,16 +43,44 @@ async fn await_staging_deadline<T>(\n     cancellation: &CancellationToken,\n     timeout_message: &'static str,\n     producer: impl Future<Output = Result<T, Error>>,\n+) -> Result<T, Error> {\n+    await_staging_deadline_with_admission(\n+        deadline,\n+        cancellation,\n+        timeout_message,\n+        producer,\n+        std::future::pending(),\n+    )\n+    .await\n+}\n+\n+async fn await_staging_deadline_with_admission<T>(\n+    deadline: Duration,\n+    cancellation: &CancellationToken,\n+    timeout_message: &'static str,\n+    producer: impl Future<Output = Result<T, Error>>,\n+    admission: impl Future<Output = ()>,\n ) -> Result<T, Error> {\n     tokio::pin!(producer);\n-    tokio::select! {\n-        biased;\n-        result = &mut producer => result,\n-        _ = tokio::time::sleep(deadline) => {\n-            cancellation.cancel();\n-            let _ = producer.await;\n-            Err(Error::EngineTimeout(timeout_message.into()))\n+    let timed_out = {\n+        // Drop the admission future, including any publication permit it owns, before\n+        // awaiting an expired producer that may be blocked waiting for that permit.\n+        let admission = admission;\n+        tokio::pin!(admission);\n+        tokio::select! {\n+            biased;\n+            result = &mut producer => return result,\n+            _ = &mut admission => false,\n+            _ = tokio::time::sleep(deadline) => true,\n         }\n+    };\n+    if timed_out {\n+        cancellation.cancel();\n+        let _ = producer.await;\n+        Err(Error::EngineTimeout(timeout_message.into()))\n+    } else {\n+        // No deadline competes with the admitted publication/durability tail.\n+        producer.await\n     }\n }\n \n@@ -1434,7 +1462,7 @@ async fn download_engine_archive_core<R: tauri::Runtime>(\n             })?\n             .to_path_buf();\n         let progress_lease = begin_progress(&state.progress_state, &app, id.clone())?;\n-        let (prepared_tx, mut prepared_rx) = tokio::sync::oneshot::channel();\n+        let (prepared_tx, prepared_rx) = tokio::sync::oneshot::channel();\n         let (publish_tx, publish_rx) = tokio::sync::oneshot::channel();\n         let publication_authority = state.pgn_path_authority.clone();\n         let producer = prepare_archive_download(\n@@ -1473,26 +1501,21 @@ async fn download_engine_archive_core<R: tauri::Runtime>(\n                 )\n             },\n         );\n-        tokio::pin!(producer);\n-        let install_result = tokio::select! {\n-            biased;\n-            result = &mut producer => result,\n-            prepared = &mut prepared_rx => {\n-                if prepared.is_ok() {\n-                    let _ = publish_tx.send(());\n-                } else {\n-                    drop(publish_tx);\n-                }\n-                // No deadline competes with the admitted publication/durability tail.\n-                producer.await\n-            }\n-            _ = tokio::time::sleep(DOWNLOAD_DEADLINE) => {\n-                cancellation.cancel();\n+        let admission = async move {\n+            if prepared_rx.await.is_ok() {\n+                let _ = publish_tx.send(());\n+            } else {\n                 drop(publish_tx);\n-                let _ = producer.await;\n-                Err(Error::EngineTimeout(\"engine archive download deadline exceeded\".into()))\n             }\n         };\n+        let install_result = await_staging_deadline_with_admission(\n+            DOWNLOAD_DEADLINE,\n+            &cancellation,\n+            \"engine archive download deadline exceeded\",\n+            producer,\n+            admission,\n+        )\n+        .await;\n         if let Err(error) = install_result {\n             report_download_error(&state, &app, &progress_lease, &job_id, &error);\n             return Err(error);\n",
  "joiner-integration-proof-puzzle.patch": "diff --git a/src-tauri/src/infra/path_authority/resolved.rs b/src-tauri/src/infra/path_authority/resolved.rs\nindex 130f5f2f..b3b04cec 100644\n--- a/src-tauri/src/infra/path_authority/resolved.rs\n+++ b/src-tauri/src/infra/path_authority/resolved.rs\n@@ -15,7 +15,6 @@ use std::{\n };\n use tokio_util::sync::CancellationToken;\n \n-use super::canonical_binding;\n use super::{is_write_operation, opened_file_identity, DatabaseFileTarget, PathOperation};\n \n #[cfg(windows)]\n@@ -539,11 +538,13 @@ impl ResolvedPath {\n             opened_file_identity(self.file.as_ref().ok_or_else(|| {\n                 Error::InvalidInput(\"puzzle capability names a directory\".into())\n             })?)?;\n-        let path = canonical_binding(\n-            self.target()\n-                .ok_or_else(|| Error::Conflict(\"puzzle database target is unavailable\".into()))?,\n-        )?;\n-        Ok(DatabaseFileTarget::assemble(parent, leaf, identity, path))\n+        let path = self\n+            .target()\n+            .ok_or_else(|| Error::Conflict(\"puzzle database target is unavailable\".into()))?\n+            .to_path_buf();\n+        let mut target = DatabaseFileTarget::assemble(parent, leaf, identity, path);\n+        target.validation = super::DatabaseTargetValidation::RetainedParent;\n+        Ok(target)\n     }\n \n     /// Duplicate the already-authorized descriptor for SQLite. The caller owns\n",
  "joiner-integration-proof-absent.patch": "diff --git a/src-tauri/src/infra/fs.rs b/src-tauri/src/infra/fs.rs\nindex fc17ffce..59eefe42 100644\n--- a/src-tauri/src/infra/fs.rs\n+++ b/src-tauri/src/infra/fs.rs\n@@ -872,6 +872,11 @@ fn install_dir_at_driver<A: DirInstallAdapter>(\n     let source_dir = adapter.open_source_directory(parent, source_name)?;\n     adapter.flush_tree(&source_dir)?;\n     let original = match adapter.target_stat(parent, target_name)? {\n+        Some(_) if matches!(policy, DirectoryInstallPolicy::Absent) => {\n+            return Err(Error::Conflict(\n+                \"directory target was created concurrently\".into(),\n+            ));\n+        }\n         Some(entry) if adapter.is_directory(&entry) => Some(entry),\n         Some(_) => {\n             return Err(Error::InvalidInput(\n",
  "windows-resource-handoff-mechanism.md": "# Focused judgment: actual Windows resource-file handoff and crash lifetime\n\n## Required invariant and scope\nThe unchanged adopted f021 O2 requires durable evidence to protect the objects actually used by a child, including a surviving child after backend failure. Object-only nodes may be proved disjoint from a new complete inventory only when actual handoff remains bound to that object. Explicit directory resources remain recursive, cwd nodes remain object-only. No new runtime collector, registry, journal or product policy. Same ordinary completed replacement/crash threat, no malicious continuous-unlink race.\n\n## Contrary source evidence\nEngineResourceLease Windows _file claims a no-delete handle, but resolve_windows final EngineResourceRead uses allows_delete_sharing_for_operation, whose only no-delete cases are EngineExecute and EngineConfigure. Thus resource file NtCreateFile includes FILE_SHARE_DELETE. engine_resource takes the file and target, dropping its retained parent. Windows uci_value is the pathname, while verify_current is a no-op outside macOS. Microsoft's documented sharing contract says delete sharing enables delete/rename and remains in force only while the handle stays open. No native Windows replacement result is yet measured.\n\nThere is a second lifetime boundary a flag-only correction must address. SpawnedChildIo::spawn_owned inherits resource FDs on Linux, while its Windows Command path has no explicit validated-resource handle transfer. Backend-held resource handles close on backend death, but a native child may survive. After that death an old resource pathname could route to a newly published independent managed tree. reaches uses the recorded old terminal identity, and when that known object is absent from a new complete inventory it returns Disjoint even if the pathname now names another object. filesystem_reaches intentionally treats a mismatched current identity as Uncertain before the object-only disjoint shortcut. This may invalidate O2's exact-object premise for Windows path-based resources after backend failure.\n\nConcrete case to judge: engine executable/cwd in catalog A, file resource in B, prepare/use bound old B/file. Backend fails, child survives and may lazily reopen resource string. B is moved/replaced with a newly published tree at the same authorized location. New tree has no direct trusted owner and no projected user because old file ID is not in its inventory. Startup collection must not remove a tree that surviving child can actually read through that pathname. Distinguish evidence from assumptions, validate exact source reachability and lifecycle rather than accepting this as a verdict.\n\n## Prior lineage and decisions\nOriginal adopted plan r1–r4 remains frozen and closed. Cumulative code r1–r10 closed through1a4305ed. Prior actual-handoff issue CR12 first corrected cwd context recording, then reopened when native spawn still used a mutable path, with focused cwd judgment and d-20261016-12 child-side fchdir/Windows sealed parent. This is new contrary consumer evidence in the same O2 actual-binding lineage, so root stopped before a local flag patch and asks fresh review-plan judgment. J3 separate follow-up plan is approved and locally implemented, root integration done, but uncommitted. JI1/JI2 are closed plan mechanisms, no change requested to them. Root pre-review was queued behind other projects and canceled143, its Rust groups and both lint targets passed. No own gate remains active, no code edit follows this note yet. f021 is reopened, old source closure preserved as history. f0914/f0917/f0920 remain open pending native delivery.\n\nInputs d-20260918-08..11, d-20261004-34, d-20261016-01..15. D11/D12 intended actual child object binding, not an exemption for a mutable Windows resource string. Existing resource lease lifetime and no-delete comment are input, no invented product decision.\n\n## Options requiring source-grounded judgment\nOptimal: retain actual resource object/path binding through the complete child lifetime using existing native capabilities → I recommend the smallest mechanism that proves both live-backend and surviving-child cases. Narrow final EngineResourceRead sharing to deny delete is necessary for the intended live lease, but do not approve it alone without resolving the crash boundary.\n\nFirst trace whether the existing Windows spawn path or OwnedFile resource handling already inherits/retains a sealing handle beyond backend death. If not, inspect installed Rust1.98 and locked Tokio APIs for per-spawn validated handle inheritance without a new spawner/global lock or broad inheritable-handle leak. Existing EngineExecutable Linux inherited_fds and ChildOwnership are the domain seams. Consider an existing standard/Tokio attribute-list facility before custom FFI. Do not assume API availability or how stdio handle lists merge.\n\nA conservative reachability adjustment is an alternative only if it covers all actual path routing after backend death without globally pinning unrelated installs or silently redefining file nodes as recursive directories. No new persisted scope or migration merely to preserve a broken pathname premise unless genuinely required. Explain why the alternative is sufficient or cannot be bounded under the frozen threat model. Do not broaden threat/product scope or reopen settled choices on opinion.\n\n## Dependent verification\nHost-independent policy case against actual shared predicate, Git-derived source-only red/green for a bounded guard, native Windows authority-issued file-resource lease normal read and rename/replacement refusal while live, actual native child consuming the authorized value, and a real lifetime witness after backend-side handles are gone while child remains alive. Use existing child/process test infrastructure, exact physical reap before assertion propagation, no global process kills or new installed program. Distinguish parent-close simulation from a real backend crash, do not overclaim. Windows runtime CI required, GNU compilation is not runtime. Existing cwd, resources, shutdown, catalog session and cross-platform tests remain intact. No source/custom-verifier-only substitute for physical child proof.\n\n## Judgment requested\nGive the simplest correct mechanism and actual existing APIs/consumers, identify any impossible requirement or remaining open technical contract, and dependent proof boundaries before root writes a corrected bounded implementation plan. This is a fresh mechanism judgment, not an inherited-plan round or code-diff approval. Plan authorship and arbitration share root context, detection same model family as code in separate session.\n",
  "windows-resource-handoff-judgment.txt": "[blocker] windows-resource-handoff-mechanism.md:19 — **WR1 NOT CLOSED.** Denying final `EngineResourceRead` delete sharing fixes the evidenced flag mismatch, but the correction must also establish pathname binding. `resolved.rs:1102` currently permits delete sharing, `mod.rs:6614` retains only the file and pathname, and `mod.rs:1716` supplies that pathname to the child. Specify which validated directory seals survive alongside the leaf, with native leaf, parent and ancestor replacement proof. A final-file flag alone does not establish that complete contract. (confidence: 96)\n\n[blocker] windows-resource-handoff-mechanism.md:21 — **WR2 NOT CLOSED.** No child-side resource retention currently crosses backend death. The NT open omits `OBJ_INHERIT` at `mod.rs:4062`, and Windows spawn performs no explicit transfer at `process.rs:3804`. `ChildOwnership` retains the executable and resources only inside the backend at `process.rs:782`. Meanwhile, `catalog_install.rs:271` deliberately excludes a known old object absent from a replacement inventory. The correction therefore needs a concrete transfer boundary and failure semantics before any resource value reaches the child. (confidence: 99)\n\n[should-fix] windows-resource-handoff-mechanism.md:9 — `SpawnedChildIo::spawn_owned` does not exist. The production boundary is `EngineRuntime::spawn_owned` at `src-tauri/src/engine/process.rs:3755`, reached through `EngineActor::spawn_owned` at `:4506`. Correct the named integration point. (confidence: 100)\n\nOptimal: retain validated no-delete resource seals and duplicate them directly into the exact spawned child before resource configuration → I recommend this mechanism for the bounded correction.\n\nThe required APIs already exist:\n\n- Locked Tokio 1.50 exposes [`Child::raw_handle`](</home/felixb/.cargo/registry/src/index.crates.io-1949cf8c6b5b557f/tokio-1.50.0/src/process/mod.rs:1232>).\n- The existing windows-sys dependency exposes [`DuplicateHandle`](</home/felixb/.cargo/registry/src/index.crates.io-1949cf8c6b5b557f/windows-sys-0.61.2/src/Windows/Win32/Foundation/mod.rs:3>). Duplicate the validated seals into that process with non-inheritable child handles. This avoids parent-global inheritance changes, attribute-list merging and a replacement spawner.\n- Rust 1.98’s [`spawn_with_attributes`](</home/felixb/.rustup/toolchains/1.98.0-x86_64-unknown-linux-gnu/lib/rustlib/src/rust/library/std/src/os/windows/process.rs:335>) is unstable. Tokio’s matching [`spawn_with`](</home/felixb/.cargo/registry/src/index.crates.io-1949cf8c6b5b557f/tokio-1.50.0/src/process/mod.rs:931>) requires `tokio_unstable`.\n\nInstall the child and executable in the existing cleanup owner before the first fallible transfer. Partial transfer must refuse configuration and follow existing physical cleanup, retaining failed cleanup ownership. `process.rs:3835` and `:2977` provide those integration boundaries. Child-local seals must remain until child exit, while backend leases retain their existing confirmed-reap lifetime.\n\nThe concrete replacement witness also needs one qualification. Publication carries predecessor users forward when root identity and destination match at `catalog_install.rs:708`. To exercise the claimed missing-marker case, use an independent replacement root or pre-provenance resource use. Same-root republication alone does not prove WR2.\n\nA reachability-only adjustment cannot satisfy the supplied exact-object invariant because it still permits the resource string to select a replacement object.\n\nRequired proof remains native Windows behavior: authorized reads, leaf and directory replacement refusal, continued lazy reads after **all backend seals close**, and seal release after physical child exit. Transfer-failure proof must show no resource value was sent. A parent-close simulation must be identified separately from an actual backend-crash witness.\n\nLimitation: this review establishes source wiring and API availability only. Native transfer and pathname-sealing behavior remain unverified. No commands beyond source/git reads ran, and no files changed. Detection used the same model family as the code, without family separation.\n\nVERDICT: REVISE",
  "windows-resource-direct-transfer-option.md": "# Root source-grounded alternative for WRJ1 follow-up\n\nInstalled Rust1.98 raw process attribute APIs are unstable, and locked Tokio1.50 spawn_with is cfg(tokio_unstable). Do not add nightly or replace the launcher solely for extra inherited resource handles.\n\nA potentially simpler existing-native mechanism is DuplicateHandle directly into the newly created child's process handle. This avoids global inheritable flags and attribute-list/stdin handling. It must happen before any authorized resource pathname is sent to the child. Current spawn_owned builds Command with stdio/cwd only, no resource args or environment values, and initial UCI configuration follows spawn. EngineActor's resource set comes from executable.resource_leases at spawn, runtime set_option carries strings rather than new lease objects. Trace/confirm every actual send before accepting this sequencing premise.\n\nNarrow final EngineResourceRead to no-delete in the existing shared policy, then copy all validated file/directory lease handles into the exact child process with DuplicateHandle SAME_ACCESS and non-inheritable remote handles. The child owns those remote handles until exit, preserving sealing when backend-side handles close. Never wrap or CloseHandle a returned remote numeric handle in the parent process. Existing parent lease retention and catalog use evidence stay.\n\nOwnership on failure matters: capture a duplication Result without early-returning, register child control/executable in existing ChildOwner, then propagate failure through existing confirmed-reap cleanup. Or register first and run duplication while the existing owner guards the handle. No failed transfer may drop validated handles or return while an unowned child remains alive. Child process handle must have PROCESS_DUP_HANDLE rights, verify CreateProcess returned access and Tokio raw_handle API. Partial transfer before any resource command can terminate through existing owner, no rollback framework or cache needed because prepared resource list is fixed per child and bounded by existing contracts.\n\nNative proof can use existing interactive cmd.exe runtime helper. Move the resource lease into executable's prepared set, spawn real EngineRuntime, then drop only backend-side executable/resource validation ownership under the existing test-visible owner to simulate handle loss. Preserve live control so child stays alive. Attempt leaf/parent/ancestor replacement while only the child's copies seal resources, send the actual uci_value through cmd's type command, verify original bytes, then physically terminate/reap before assertions escape. Report this as backend-handle-loss simulation, not a full process crash. After confirmed reap the same rename must succeed, proving no parent-side hidden seal remains. Resources live in a separate tree from executable/cwd so those other no-delete handles cannot mask a missing resource transfer. Existing native helper establishes actual CreateProcess/cleanup, no new installed test program.\n\nThis is an unreviewed root alternative, not an implementation instruction or claim approval. It may close both WR1/WR2 with one operation-policy membership correction and one child-ownership transfer seam. A fresh reviewer must refute actual sequencing, failure ownership and native proof before code. No new registry, global spawn lock, launcher or persisted scope. Original O2 and threat unchanged.\n"
}
```


## WRJ2 approved and Windows resource correction locally proven

WRJ2 explicitly CLOSED WR1 full resource chain, WR2 child-local lifetime and failure ownership, WR3 actual EngineRuntime::spawn_owned symbol, VERDICT APPROVED. Root adopts closure with no new issue, Skip or Defer. d-20261016-16 records the technical decision and reversal. These are focused mechanism judgments in existing O2, not new inherited-plan or cumulative-diff rounds.

The same persistent sensitive writer implements the approved contract. Windows resource leases retain the no-delete terminal and full shared no-follow absolute directory chain. The sealing pass compares the final identity to the authorized object before exposing a value. Spawn duplicates all resource seals into that exact child with unchanged access and no inheritance before any protocol service. Transfer failure is captured, actual child/executable enters ChildOwner, then the error propagates through existing confirmed-reap handling. Remote handle numbers are never owned or closed locally. File object-only versus explicit directory recursive catalog scope stays unchanged.

Local final proof is0 for285 authority,79 catalog,217 filesystem with1existing ignore,38 puzzle,581 database parent tests plus isolated children,71 platform,230 process,39 shutdown, fmt, diff and Linux/WindowsGNU all-target clippy. One Git-derived source-only guard reversal produced executed assertion red101 with unchanged tests, exact restoration and green0, no offsets/fuzz. Root verified every final source hash against the audit before adding this record. Native Windows handle-loss, terminal-identity and partial-transfer tests compile locally and remain pending actual CI. Parent-close simulation is explicitly not a full backend crash. No native macOS runtime run in this correction. Existing J3 behavioral red evidence remains prior-snapshot proof, not rerun under WR.

Initial Windows fixture compile101 had two test-only type errors, repaired before final green. The worker accidentally reused the first fmt diagnostic paths during a later successful check, so the complete first fmt diagnostic is unavailable. Its original excerpt and formatting patch remain, and no fmt/compile failure is behavioral evidence. No external source assertion changed in this correction. Only four permitted paths changed from J3 entry, other J3 paths and handoff byte-identical at writer completion. Root inspected transfer ordering, shared chain verification and actual native proof ownership before pre-review. No source commit, current source final gates, native acceptance or installation is yet claimed by this section.

Plan authorship and arbitration shared one context. Detection used the same model family as code in separate Codex sessions, without family separation.

Raw WRJ2 candidate, generated delta, explicit closure report and completed implementation proof are preserved losslessly:

```json
{
  "windows-resource-handoff-candidate.md": "# Windows resource handoff correction\n\n## O2 — Keep resource paths bound through the exact child's lifetime\nRequired behavior: retain the authority-validated terminal resource object and every directory component from the Windows absolute root to that object, opened no-follow without delete sharing. Both file and explicit directory resources use this same sealed resolution contract. A file resource remains an object-only catalog node, a directory resource remains recursive. Ordinary resource reads are preserved. Do not change registry scope, schema, retention, limits or product policy.\n\nOwnership: a resource lease owns the leaf and validated directory chain. Reuse the existing Windows directory walk/NT open facade rather than creating a second pathname parser or NT implementation. Intermediate handles must survive the walk. If a separate sealing pass is necessary, compare its final object to the already authorized identity before exposing the value. Windows final EngineResourceRead denies delete sharing through the existing common operation policy. Generic unrelated resolutions preserve existing sharing behavior.\n\nIntegration: EngineRuntime::spawn_owned is the real spawn boundary. Resource paths are not command arguments or environment additions. EngineActor receives a fixed lease set from EngineExecutable at spawn, UCI configuration and resource values are sent later. DuplicateHandle SAME_ACCESS transfers all validated resource leaf and directory seals into the exact new child's raw process handle before any protocol/resource send. Remote handles are non-inheritable and owned by that child until exit, never wrapped or closed as local handles by the backend. No nightly, tokio_unstable, replacement spawner, process-global inheritable flag, spawn lock, cache or new runtime registry.\n\nFailure semantics: install child control and executable into the existing cleanup owner before propagating the first fallible transfer result. Partial transfer refuses runtime/configuration and follows existing confirmed-reap cleanup, retaining failed cleanup ownership. Transfer code must not await under the state lock or early-return with an unowned live child. No resource value is sent on failed transfer. Backend-held leases keep their existing confirmed-reap lifetime, child-local copies independently survive backend-side handle loss. No guarantee for an engine deliberately closing arbitrary unknown handles or adversarial continuous replacement.\n\nVerification level: exercise the actual shared sharing predicate on every platform and source-derived Git-only reversal yielding an executed assertion failure with tests unchanged, exact restore and green. Native Windows proof must resolve authority-issued file and directory resources, place resource tree separately from engine/cwd, launch through EngineRuntime::spawn_owned, drop every backend-side resource/executable seal while preserving child control, then attempt leaf/parent/ancestor rename and read original bytes through the actual authorized resource value with the living child. Confirm expected native access/sharing refusal only, physically reap before propagating assertions, then prove the same rename succeeds. This is backend-handle-loss simulation, not a full backend crash. Transfer-failure proof injects failure at the existing domain seam, checks no protocol/resource send, and confirms physical reap before assertions. Tests must not retain hidden Arc clones that mask missing transfer. Windows native CI is mandatory, GNU cross-target clippy is type/lint proof only. Existing authority, catalog, process, shutdown, fs, puzzle, database and platform cases stay green.\n\n## Scope and dependency boundaries\nFiles: src-tauri/src/infra/path_authority/mod.rs, resolved.rs, src-tauri/src/engine/process.rs, existing platform source assertions only if their real consumer contract changes. Existing six J3 files remain owned and unchanged except necessary integration. One obsolete Windows MAX_REMOVE_TREE_DEPTH allow/comment in infra/fs.rs can be deleted because catalog_install production now consumes that bound, verified by target clippy. No other source/config/tooling/record changes by writer.\nMandate: frozen original plan tasks/plans/2026-10-16-catalog-engine-retention.md O2 and threat model, exact f-20261002-04 with source-based reopen, no new threat or acceptance scope. J3 plan mechanisms remain approved, this corrects the O2 actual binding prerequisite. Originating f0914 is a dependency. Same-root republication carries predecessor users, so WR2 marker scenario is an independent replacement root or pre-provenance resource use, not a same-root republication claim.\n\n## Reviews\nWRJ1 fresh review at previous windows-resource-handoff-mechanism.md: WR1 NOT CLOSED, WR2 NOT CLOSED, plus wrong SpawnedChildIo symbol. Root adopts all three. WRJ2 candidate names correct EngineRuntime boundary, full directory seals, direct child transfer, owned failure and dependent native proof. Authority unchanged O2, d11/d12 actual binding. No Skip or Defer. This mechanism note is not an inherited plan round and does not modify r1–r4 metrics. Last reviewed snapshot is windows-resource-handoff-mechanism.md, new candidate is this file. Source trace/API findings in windows-resource-handoff-judgment.txt and direct-transfer-option.md are inputs for refutation. No code edited for this correction yet.\nPlan authorship and arbitration share root context. Detection uses the same model family as code in separate Codex sessions, no family separation.\n",
  "wrj2-delta": "--- /tmp/build-de5be974-c551-48bb-b87c-30caf1642a05/windows-resource-handoff-mechanism.md\n+++ /tmp/build-de5be974-c551-48bb-b87c-30caf1642a05/windows-resource-handoff-candidate.md\n@@ -1,29 +1,17 @@\n-# Focused judgment: actual Windows resource-file handoff and crash lifetime\n+# Windows resource handoff correction\n \n-## Required invariant and scope\n-The unchanged adopted f021 O2 requires durable evidence to protect the objects actually used by a child, including a surviving child after backend failure. Object-only nodes may be proved disjoint from a new complete inventory only when actual handoff remains bound to that object. Explicit directory resources remain recursive, cwd nodes remain object-only. No new runtime collector, registry, journal or product policy. Same ordinary completed replacement/crash threat, no malicious continuous-unlink race.\n+## O2 — Keep resource paths bound through the exact child's lifetime\n+Required behavior: retain the authority-validated terminal resource object and every directory component from the Windows absolute root to that object, opened no-follow without delete sharing. Both file and explicit directory resources use this same sealed resolution contract. A file resource remains an object-only catalog node, a directory resource remains recursive. Ordinary resource reads are preserved. Do not change registry scope, schema, retention, limits or product policy.\n \n-## Contrary source evidence\n-EngineResourceLease Windows _file claims a no-delete handle, but resolve_windows final EngineResourceRead uses allows_delete_sharing_for_operation, whose only no-delete cases are EngineExecute and EngineConfigure. Thus resource file NtCreateFile includes FILE_SHARE_DELETE. engine_resource takes the file and target, dropping its retained parent. Windows uci_value is the pathname, while verify_current is a no-op outside macOS. Microsoft's documented sharing contract says delete sharing enables delete/rename and remains in force only while the handle stays open. No native Windows replacement result is yet measured.\n+Ownership: a resource lease owns the leaf and validated directory chain. Reuse the existing Windows directory walk/NT open facade rather than creating a second pathname parser or NT implementation. Intermediate handles must survive the walk. If a separate sealing pass is necessary, compare its final object to the already authorized identity before exposing the value. Windows final EngineResourceRead denies delete sharing through the existing common operation policy. Generic unrelated resolutions preserve existing sharing behavior.\n \n-There is a second lifetime boundary a flag-only correction must address. SpawnedChildIo::spawn_owned inherits resource FDs on Linux, while its Windows Command path has no explicit validated-resource handle transfer. Backend-held resource handles close on backend death, but a native child may survive. After that death an old resource pathname could route to a newly published independent managed tree. reaches uses the recorded old terminal identity, and when that known object is absent from a new complete inventory it returns Disjoint even if the pathname now names another object. filesystem_reaches intentionally treats a mismatched current identity as Uncertain before the object-only disjoint shortcut. This may invalidate O2's exact-object premise for Windows path-based resources after backend failure.\n+Integration: EngineRuntime::spawn_owned is the real spawn boundary. Resource paths are not command arguments or environment additions. EngineActor receives a fixed lease set from EngineExecutable at spawn, UCI configuration and resource values are sent later. DuplicateHandle SAME_ACCESS transfers all validated resource leaf and directory seals into the exact new child's raw process handle before any protocol/resource send. Remote handles are non-inheritable and owned by that child until exit, never wrapped or closed as local handles by the backend. No nightly, tokio_unstable, replacement spawner, process-global inheritable flag, spawn lock, cache or new runtime registry.\n \n-Concrete case to judge: engine executable/cwd in catalog A, file resource in B, prepare/use bound old B/file. Backend fails, child survives and may lazily reopen resource string. B is moved/replaced with a newly published tree at the same authorized location. New tree has no direct trusted owner and no projected user because old file ID is not in its inventory. Startup collection must not remove a tree that surviving child can actually read through that pathname. Distinguish evidence from assumptions, validate exact source reachability and lifecycle rather than accepting this as a verdict.\n+Failure semantics: install child control and executable into the existing cleanup owner before propagating the first fallible transfer result. Partial transfer refuses runtime/configuration and follows existing confirmed-reap cleanup, retaining failed cleanup ownership. Transfer code must not await under the state lock or early-return with an unowned live child. No resource value is sent on failed transfer. Backend-held leases keep their existing confirmed-reap lifetime, child-local copies independently survive backend-side handle loss. No guarantee for an engine deliberately closing arbitrary unknown handles or adversarial continuous replacement.\n \n-## Prior lineage and decisions\n-Original adopted plan r1–r4 remains frozen and closed. Cumulative code r1–r10 closed through1a4305ed. Prior actual-handoff issue CR12 first corrected cwd context recording, then reopened when native spawn still used a mutable path, with focused cwd judgment and d-20261016-12 child-side fchdir/Windows sealed parent. This is new contrary consumer evidence in the same O2 actual-binding lineage, so root stopped before a local flag patch and asks fresh review-plan judgment. J3 separate follow-up plan is approved and locally implemented, root integration done, but uncommitted. JI1/JI2 are closed plan mechanisms, no change requested to them. Root pre-review was queued behind other projects and canceled143, its Rust groups and both lint targets passed. No own gate remains active, no code edit follows this note yet. f021 is reopened, old source closure preserved as history. f0914/f0917/f0920 remain open pending native delivery.\n+Verification level: exercise the actual shared sharing predicate on every platform and source-derived Git-only reversal yielding an executed assertion failure with tests unchanged, exact restore and green. Native Windows proof must resolve authority-issued file and directory resources, place resource tree separately from engine/cwd, launch through EngineRuntime::spawn_owned, drop every backend-side resource/executable seal while preserving child control, then attempt leaf/parent/ancestor rename and read original bytes through the actual authorized resource value with the living child. Confirm expected native access/sharing refusal only, physically reap before propagating assertions, then prove the same rename succeeds. This is backend-handle-loss simulation, not a full backend crash. Transfer-failure proof injects failure at the existing domain seam, checks no protocol/resource send, and confirms physical reap before assertions. Tests must not retain hidden Arc clones that mask missing transfer. Windows native CI is mandatory, GNU cross-target clippy is type/lint proof only. Existing authority, catalog, process, shutdown, fs, puzzle, database and platform cases stay green.\n \n-Inputs d-20260918-08..11, d-20261004-34, d-20261016-01..15. D11/D12 intended actual child object binding, not an exemption for a mutable Windows resource string. Existing resource lease lifetime and no-delete comment are input, no invented product decision.\n+## Scope and dependency boundaries\n+Files: src-tauri/src/infra/path_authority/mod.rs, resolved.rs, src-tauri/src/engine/process.rs, existing platform source assertions only if their real consumer contract changes. Existing six J3 files remain owned and unchanged except necessary integration. One obsolete Windows MAX_REMOVE_TREE_DEPTH allow/comment in infra/fs.rs can be deleted because catalog_install production now consumes that bound, verified by target clippy. No other source/config/tooling/record changes by writer.\n+Mandate: frozen original plan tasks/plans/2026-10-16-catalog-engine-retention.md O2 and threat model, exact f-20261002-04 with source-based reopen, no new threat or acceptance scope. J3 plan mechanisms remain approved, this corrects the O2 actual binding prerequisite. Originating f0914 is a dependency. Same-root republication carries predecessor users, so WR2 marker scenario is an independent replacement root or pre-provenance resource use, not a same-root republication claim.\n \n-## Options requiring source-grounded judgment\n-Optimal: retain actual resource object/path binding through the complete child lifetime using existing native capabilities → I recommend the smallest mechanism that proves both live-backend and surviving-child cases. Narrow final EngineResourceRead sharing to deny delete is necessary for the intended live lease, but do not approve it alone without resolving the crash boundary.\n-\n-First trace whether the existing Windows spawn path or OwnedFile resource handling already inherits/retains a sealing handle beyond backend death. If not, inspect installed Rust1.98 and locked Tokio APIs for per-spawn validated handle inheritance without a new spawner/global lock or broad inheritable-handle leak. Existing EngineExecutable Linux inherited_fds and ChildOwnership are the domain seams. Consider an existing standard/Tokio attribute-list facility before custom FFI. Do not assume API availability or how stdio handle lists merge.\n-\n-A conservative reachability adjustment is an alternative only if it covers all actual path routing after backend death without globally pinning unrelated installs or silently redefining file nodes as recursive directories. No new persisted scope or migration merely to preserve a broken pathname premise unless genuinely required. Explain why the alternative is sufficient or cannot be bounded under the frozen threat model. Do not broaden threat/product scope or reopen settled choices on opinion.\n-\n-## Dependent verification\n-Host-independent policy case against actual shared predicate, Git-derived source-only red/green for a bounded guard, native Windows authority-issued file-resource lease normal read and rename/replacement refusal while live, actual native child consuming the authorized value, and a real lifetime witness after backend-side handles are gone while child remains alive. Use existing child/process test infrastructure, exact physical reap before assertion propagation, no global process kills or new installed program. Distinguish parent-close simulation from a real backend crash, do not overclaim. Windows runtime CI required, GNU compilation is not runtime. Existing cwd, resources, shutdown, catalog session and cross-platform tests remain intact. No source/custom-verifier-only substitute for physical child proof.\n-\n-## Judgment requested\n-Give the simplest correct mechanism and actual existing APIs/consumers, identify any impossible requirement or remaining open technical contract, and dependent proof boundaries before root writes a corrected bounded implementation plan. This is a fresh mechanism judgment, not an inherited-plan round or code-diff approval. Plan authorship and arbitration share root context, detection same model family as code in separate session.\n",
  "windows-resource-handoff-closure.txt": "WR1 CLOSED — WRJ2 `windows-resource-handoff-candidate.md:4` and `:6` require the complete no-follow, no-delete directory chain plus terminal object. This addresses the discarded intermediate handles at `src-tauri/src/infra/path_authority/resolved.rs:86` and `:1161`, and the leaf-only lease at `src-tauri/src/infra/path_authority/mod.rs:6614`. Native replacement and release proof is required at candidate `:12`. (confidence: 96)\n\nWR2 CLOSED — Candidate `:8` and `:10` specify direct child transfer before protocol sends, ownership before error propagation, and retained cleanup on failure. The fixed resource set exists at `src-tauri/src/engine/process.rs:4516`, protocol initialization follows spawn at `:3667`, and existing cleanup supports registration at `:3835`, physical reap at `:3130`, and unresolved-owner retention at `:3158`. Candidate `:12` requires closing all backend seals to expose missing child transfer. (confidence: 96)\n\nWR3 CLOSED — Candidate `:8` correctly names `EngineRuntime::spawn_owned`, defined at `src-tauri/src/engine/process.rs:3755` and called through `EngineActor::spawn_owned` at `:4518`. (confidence: 100)\n\nLimitation: these are plan-level closures. Native Windows transfer, rename refusal and release remain unobserved and mandatory before delivery. Source/git/dependency reads only, no files changed. Review used the same model family in a separate session. (confidence: 100)\n\nVERDICT: APPROVED",
  "repair-windows-resource-handoff.txt": "Implemented within four files: `path_authority/mod.rs`, `resolved.rs`, `engine/process.rs` and the authorized comment/attribute deletion in `infra/fs.rs`.\n\nResource leases now retain the validated leaf and complete no-follow/no-delete directory chain. The separate sealing walk verifies the original terminal identity. File node-only and directory recursive semantics remain unchanged.\n\nWindows spawn duplicates every resource seal into the exact child using non-inheritable `DUPLICATE_SAME_ACCESS` handles. Transfer errors propagate only after child control and executable enter `ChildOwner`, before runtime/protocol service. Remote handles are never locally owned or closed.\n\nAll final commands exited **0**:\n\n| Group | Passed | Ignored |\n|---|---:|---:|\n| Authority | 285 | 0 |\n| Catalog | 79 | 0 |\n| Filesystem | 217 | 1 |\n| Puzzle | 38 | 0 |\n| Database | 581 | 0 |\n| Platform | 71 | 0 |\n| Process | 230 | 0 |\n| Shutdown | 39 | 0 |\n\nFormatting, diff checks and Linux/Windows GNU all-target clippy passed.\n\nThe Git-derived production guard reversal produced the intended executed assertion failure, **101**. Forward restoration and green test exited **0**, without offsets or fuzz. Source hashes restored exactly and test bytes remained unchanged.\n\nEvidence:\n\n- [Exact correction diff](/tmp/build-de5be974-c551-48bb-b87c-30caf1642a05/windows-resource-corrections.diff)\n- [Audit, counts, logs and limitations](/tmp/build-de5be974-c551-48bb-b87c-30caf1642a05/windows-resource-audit.json)\n- [Final source/test hashes](/tmp/build-de5be974-c551-48bb-b87c-30caf1642a05/windows-resource-final-restored-hashes.json)\n- [Exact final commands](/tmp/build-de5be974-c551-48bb-b87c-30caf1642a05/windows-resource-final-commands.log)\n\nWindows handle-loss, identity-mismatch and partial-transfer tests compile but require native CI execution. Handle-loss simulation is not a backend crash. No macOS runtime proof is claimed.\n\nTwo initial Windows fixture compile errors were repaired and retained in logs. One initial formatting diagnostic was accidentally overwritten by a later successful check, documented in the audit.\n\nOther J3 files, platform assertions and root handoff are byte-identical to entry. Prior evidence is preserved. Changes remain unstaged, with no commit or records edits.",
  "windows-resource-audit.json": "{\n  \"changed_from_initial_snapshot\": [\n    \"src-tauri/src/infra/path_authority/mod.rs\",\n    \"src-tauri/src/infra/path_authority/resolved.rs\",\n    \"src-tauri/src/engine/process.rs\",\n    \"src-tauri/src/infra/fs.rs\"\n  ],\n  \"unchanged_owned_and_foreign_paths\": [\n    \"src-tauri/src/fs.rs\",\n    \"src-tauri/src/puzzle.rs\",\n    \"src-tauri/src/infra/path_authority/catalog_install.rs\",\n    \"src-tauri/src/infra/platform_support/tests.rs\",\n    \"tasks/handoffs/2026-10-16-catalog-engine-retention-review.md\"\n  ],\n  \"implementation_trace\": {\n    \"capture\": \"mod.rs engine_resource first obtains the validated terminal binding through resolve, preserving existing durable node/recursive use before handoff. resolved.rs windows_resource_directory_seals walks the absolute target with the shared parser/NT facade, keeps every ancestor no-follow/no-delete and compares the terminal identity with the prior opened descriptor. The duplicate verification terminal closes only after comparison, while the original leaf remains no-delete under the common operation policy.\",\n    \"ownership\": \"Both file and directory EngineResourceLease arms retain the original terminal OwnedFile and the same directory-seal vector. Ordinary operation sharing policy remains unchanged. Registry, schema, admission, recursion and cleanup authority are unchanged.\",\n    \"spawn\": \"EngineActor::spawn_owned captures the fixed resource lease list from EngineExecutable. EngineRuntime::spawn_owned supplies only image/cwd/stdio to Command, spawns, then uses stable Child::raw_handle and DuplicateHandle SAME_ACCESS with inherit=false for each leaf and directory seal. Remote numeric handles are child-owned and never locally closed or wrapped.\",\n    \"failure_and_sends\": \"The transfer Result is captured without early propagation. Actual child control and executable enter existing ChildOwner before resource_transfer?. Only then can runtime IO, actor protocol service and init_uci/setoption/send_with_deadline proceed. Partial failure follows existing confirmed-reap cleanup and unresolved-owner retention without awaiting under the state lock.\",\n    \"native_proof\": \"Windows tests use authority-issued file and explicit directory resources outside image/cwd ancestry, copied COMSPEC and real EngineRuntime::spawn_owned. Backend executable/resource seals are dropped with no remaining lease Arc clones. Rename attempts accept only native 5/32 refusal with original bytes intact. The live child reads each actual uci_value. Catch-unwind captures assertion failures, then shared native helper confirms reap before propagation and identical renames must succeed. Partial failure after one successful duplication asserts child ownership, one real transfer, zero protocol sends and physical reap before assertions. These tests were compiled but not run on Linux.\",\n    \"infra_fs\": \"Only obsolete MAX_REMOVE_TREE_DEPTH Windows re-export comment and cfg_attr unused_imports removed.\"\n  },\n  \"final_checks\": {\n    \"authority\": {\n      \"status\": 0,\n      \"summary\": \"ok. 285 passed; 0 failed; 0 ignored; 0 measured; 2124 filtered out; finished in 3.27s\",\n      \"log\": \"/tmp/build-de5be974-c551-48bb-b87c-30caf1642a05/windows-resource-final-authority.log\"\n    },\n    \"catalog\": {\n      \"status\": 0,\n      \"summary\": \"ok. 79 passed; 0 failed; 0 ignored; 0 measured; 2330 filtered out; finished in 4.96s\",\n      \"log\": \"/tmp/build-de5be974-c551-48bb-b87c-30caf1642a05/windows-resource-final-catalog.log\"\n    },\n    \"fs\": {\n      \"status\": 0,\n      \"summary\": \"ok. 217 passed; 0 failed; 1 ignored; 0 measured; 2191 filtered out; finished in 2.21s\",\n      \"log\": \"/tmp/build-de5be974-c551-48bb-b87c-30caf1642a05/windows-resource-final-fs.log\"\n    },\n    \"puzzle\": {\n      \"status\": 0,\n      \"summary\": \"ok. 38 passed; 0 failed; 0 ignored; 0 measured; 2371 filtered out; finished in 0.79s\",\n      \"log\": \"/tmp/build-de5be974-c551-48bb-b87c-30caf1642a05/windows-resource-final-puzzle.log\"\n    },\n    \"db\": {\n      \"status\": 0,\n      \"summary\": \"ok. 581 passed; 0 failed; 0 ignored; 0 measured; 1828 filtered out; finished in 30.47s\",\n      \"log\": \"/tmp/build-de5be974-c551-48bb-b87c-30caf1642a05/windows-resource-final-db.log\"\n    },\n    \"platform\": {\n      \"status\": 0,\n      \"summary\": \"ok. 71 passed; 0 failed; 0 ignored; 0 measured; 2338 filtered out; finished in 3.04s\",\n      \"log\": \"/tmp/build-de5be974-c551-48bb-b87c-30caf1642a05/windows-resource-final-platform.log\"\n    },\n    \"process\": {\n      \"status\": 0,\n      \"summary\": \"ok. 230 passed; 0 failed; 0 ignored; 0 measured; 2179 filtered out; finished in 4.04s\",\n      \"log\": \"/tmp/build-de5be974-c551-48bb-b87c-30caf1642a05/windows-resource-final-process.log\"\n    },\n    \"shutdown\": {\n      \"status\": 0,\n      \"summary\": \"ok. 39 passed; 0 failed; 0 ignored; 0 measured; 2370 filtered out; finished in 4.01s\",\n      \"log\": \"/tmp/build-de5be974-c551-48bb-b87c-30caf1642a05/windows-resource-final-shutdown.log\"\n    },\n    \"fmt\": {\n      \"status\": 0,\n      \"summary\": \"passed\",\n      \"log\": \"/tmp/build-de5be974-c551-48bb-b87c-30caf1642a05/windows-resource-final-fmt.log\"\n    },\n    \"diff\": {\n      \"status\": 0,\n      \"summary\": \"passed\",\n      \"log\": \"/tmp/build-de5be974-c551-48bb-b87c-30caf1642a05/windows-resource-final-diff.log\"\n    },\n    \"linux-clippy\": {\n      \"status\": 0,\n      \"summary\": \"passed\",\n      \"log\": \"/tmp/build-de5be974-c551-48bb-b87c-30caf1642a05/windows-resource-final-linux-clippy.log\"\n    },\n    \"windows-clippy\": {\n      \"status\": 0,\n      \"summary\": \"passed\",\n      \"log\": \"/tmp/build-de5be974-c551-48bb-b87c-30caf1642a05/windows-resource-final-windows-clippy.log\"\n    }\n  },\n  \"proof\": {\n    \"statuses\": {\n      \"check\": 0,\n      \"reverse\": 0,\n      \"red\": 101,\n      \"restore\": 0,\n      \"green\": 0\n    },\n    \"executed_assertion\": \"an authorized engine resource leaf must deny delete sharing\",\n    \"git_patch\": \"/tmp/build-de5be974-c551-48bb-b87c-30caf1642a05/windows-resource-proof-policy.patch\",\n    \"no_offsets_or_fuzz\": true,\n    \"test_bytes_unchanged\": true,\n    \"exact_source_restoration\": true,\n    \"patch_sha256\": \"09ac41a06d62be34c6fa5dbee6927a19a213d7e93ab1bff03ed759e2b890ba6f\"\n  },\n  \"initial_results\": {\n    \"red_before_source\": {\n      \"status\": 101,\n      \"log\": \"windows-resource-initial-red.log\"\n    },\n    \"windows_gnu_fixture_compile_failure\": {\n      \"status\": 101,\n      \"errors\": [\n        \"E0433 unqualified Duration in new Windows-only identity fixture\",\n        \"E0382 kind used after promotion consumed it in new Windows-only resource fixture\"\n      ],\n      \"log\": \"windows-resource-initial-windows-clippy.log\",\n      \"repaired_status\": 0,\n      \"repaired_log\": \"windows-resource-repaired-windows-clippy.log\",\n      \"behavioral_red\": false\n    },\n    \"formatting_diagnostic_note\": \"The first formatting check reported formatting differences. Its windows-resource-initial-fmt.log and .exit paths were inadvertently reused by the later initial check script, which passed. The original complete formatting diagnostic is unavailable. The actual formatting apply_patch is retained as windows-resource-format.patch and the session tool output retains the initial diagnostic excerpt. No formatting or compile failure is counted as behavioral red proof.\"\n  },\n  \"source_sha256\": {\n    \"src-tauri/src/infra/path_authority/mod.rs\": \"400f1c4bddde7a2d7588e8815a1e9171e9c8cdcf4de182f65e03057cc53970b9\",\n    \"src-tauri/src/infra/path_authority/resolved.rs\": \"1f7b878861fbf9ee5f67498907909a99741ecc0989f7e4ef011dbe682debd89c\",\n    \"src-tauri/src/engine/process.rs\": \"25c8d1fac8f2828ba0d54f855897ab6c4f155afceaca2328a1075d9710d5e1da\",\n    \"src-tauri/src/infra/fs.rs\": \"7dc67fb5584eec3d8106aefc895f4871ee52c1db7661f2a886c2954d1cf33bd1\",\n    \"src-tauri/src/fs.rs\": \"5036fa6e46b56e7691af7fe5979e6b6a7a61e81f045837eceddc2e96bfb2fa9d\",\n    \"src-tauri/src/puzzle.rs\": \"90c202bc1c7c8ee052afb11be52de3424b129c80fa50a75ed1fa4a02aa65e55f\",\n    \"src-tauri/src/infra/path_authority/catalog_install.rs\": \"882717b41eb153855233f8e92ecc0747d925bc9ee9fb10ec02b7052733bb106e\",\n    \"src-tauri/src/infra/platform_support/tests.rs\": \"65c5a5408950e931b95df839727630d9253681c10e7f8d912b2fa022872d9831\",\n    \"tasks/handoffs/2026-10-16-catalog-engine-retention-review.md\": \"9e38bbb1447076b838fd65928fee5d2914e2d1e581c66ab1d96a35cd6a410a06\"\n  },\n  \"test_suffix_sha256\": {\n    \"src-tauri/src/infra/path_authority/mod.rs\": \"e717557b7629ecd3b14bef3c3c260042280f78086bedecbb311dc944d3ca93d4\",\n    \"src-tauri/src/infra/path_authority/resolved.rs\": \"e9a99112a0fe94213781b7059263cb1d671c443488e8d23d81732a60f6abc3f2\",\n    \"src-tauri/src/engine/process.rs\": \"4a2ab7347cc030c9f4487de3f70b5ca3f85e46a219346b4795ea87e022bef866\",\n    \"src-tauri/src/infra/fs.rs\": \"3d84ca9db818fd5a73a7b82675f5567ab4806ffbc14f4f58c7894aef142bdbec\",\n    \"src-tauri/src/fs.rs\": \"8e94fc2fa0ba372a5540d6137cead2ae6b9c71825541f62c2a4baaeb02ece549\",\n    \"src-tauri/src/puzzle.rs\": \"1f87612b1e3b88c4389c584e196a68b5317970e0ca6e9b9145760e9e02209fdb\",\n    \"src-tauri/src/infra/path_authority/catalog_install.rs\": \"a88a79abdce97bce49cdc4e5901b1f7d2a5e63676f605f8cddd865320b676af9\",\n    \"src-tauri/src/infra/platform_support/tests.rs\": \"65c5a5408950e931b95df839727630d9253681c10e7f8d912b2fa022872d9831\",\n    \"tasks/handoffs/2026-10-16-catalog-engine-retention-review.md\": \"9e38bbb1447076b838fd65928fee5d2914e2d1e581c66ab1d96a35cd6a410a06\"\n  },\n  \"correction_diff_sha256\": \"8ce1ef5718118c669780c7432f198e13fbe0559ab24949075b44cc8f9fa962e2\",\n  \"limitations\": [\n    \"Native Windows tests are CI-only on this Linux host and remain mandatory before delivery\",\n    \"GNU all-target clippy is type/lint proof, not Windows runtime\",\n    \"Backend handle-loss simulation is not an actual backend crash\",\n    \"No macOS runtime run in this revision\",\n    \"No external source assertion changed, so no changed-assertion staged failure is claimed\",\n    \"Prior J3 two behavioral reds and API-coupled compile limitation remain prior-snapshot evidence and were not rerun\"\n  ],\n  \"scope\": \"Changes are unstaged, no staging, commit, records or other source writes. Initial foreign handoff and unchanged J3 files verified byte-identical.\"\n}\n",
  "windows-resource-final-restored-hashes.json": "{\n  \"source\": {\n    \"src-tauri/src/infra/path_authority/mod.rs\": \"400f1c4bddde7a2d7588e8815a1e9171e9c8cdcf4de182f65e03057cc53970b9\",\n    \"src-tauri/src/infra/path_authority/resolved.rs\": \"1f7b878861fbf9ee5f67498907909a99741ecc0989f7e4ef011dbe682debd89c\",\n    \"src-tauri/src/engine/process.rs\": \"25c8d1fac8f2828ba0d54f855897ab6c4f155afceaca2328a1075d9710d5e1da\",\n    \"src-tauri/src/infra/fs.rs\": \"7dc67fb5584eec3d8106aefc895f4871ee52c1db7661f2a886c2954d1cf33bd1\",\n    \"src-tauri/src/fs.rs\": \"5036fa6e46b56e7691af7fe5979e6b6a7a61e81f045837eceddc2e96bfb2fa9d\",\n    \"src-tauri/src/puzzle.rs\": \"90c202bc1c7c8ee052afb11be52de3424b129c80fa50a75ed1fa4a02aa65e55f\",\n    \"src-tauri/src/infra/path_authority/catalog_install.rs\": \"882717b41eb153855233f8e92ecc0747d925bc9ee9fb10ec02b7052733bb106e\",\n    \"src-tauri/src/infra/platform_support/tests.rs\": \"65c5a5408950e931b95df839727630d9253681c10e7f8d912b2fa022872d9831\",\n    \"tasks/handoffs/2026-10-16-catalog-engine-retention-review.md\": \"9e38bbb1447076b838fd65928fee5d2914e2d1e581c66ab1d96a35cd6a410a06\"\n  },\n  \"tests\": {\n    \"src-tauri/src/infra/path_authority/mod.rs\": \"e717557b7629ecd3b14bef3c3c260042280f78086bedecbb311dc944d3ca93d4\",\n    \"src-tauri/src/infra/path_authority/resolved.rs\": \"e9a99112a0fe94213781b7059263cb1d671c443488e8d23d81732a60f6abc3f2\",\n    \"src-tauri/src/engine/process.rs\": \"4a2ab7347cc030c9f4487de3f70b5ca3f85e46a219346b4795ea87e022bef866\",\n    \"src-tauri/src/infra/fs.rs\": \"3d84ca9db818fd5a73a7b82675f5567ab4806ffbc14f4f58c7894aef142bdbec\",\n    \"src-tauri/src/fs.rs\": \"8e94fc2fa0ba372a5540d6137cead2ae6b9c71825541f62c2a4baaeb02ece549\",\n    \"src-tauri/src/puzzle.rs\": \"1f87612b1e3b88c4389c584e196a68b5317970e0ca6e9b9145760e9e02209fdb\",\n    \"src-tauri/src/infra/path_authority/catalog_install.rs\": \"a88a79abdce97bce49cdc4e5901b1f7d2a5e63676f605f8cddd865320b676af9\",\n    \"src-tauri/src/infra/platform_support/tests.rs\": \"65c5a5408950e931b95df839727630d9253681c10e7f8d912b2fa022872d9831\",\n    \"tasks/handoffs/2026-10-16-catalog-engine-retention-review.md\": \"9e38bbb1447076b838fd65928fee5d2914e2d1e581c66ab1d96a35cd6a410a06\"\n  },\n  \"test_bytes_unchanged\": true,\n  \"source_exactly_restored\": true\n}\n",
  "windows-resource-corrections.diff": "diff --git a/src-tauri/src/infra/path_authority/mod.rs b/src-tauri/src/infra/path_authority/mod.rs\nindex faa5e0f1..2d2a7506 100644\n--- a/src-tauri/src/infra/path_authority/mod.rs\n+++ b/src-tauri/src/infra/path_authority/mod.rs\n@@ -1635,10 +1635,10 @@ impl EngineResourceHandle {\n     }\n }\n \n-/// Backend-only lease for a resource passed to an engine. Unix retains the\n-/// opened descriptor for the complete process lifetime; Windows retains the\n-/// opened no-delete handle alongside its path. In both cases, replacement\n-/// cannot redirect an engine's lazy access after UCI configuration.\n+/// Lease for an authority-bound resource passed to an engine. Unix retains the opened\n+/// descriptor. Windows retains the no-delete leaf and complete absolute directory chain,\n+/// then duplicates those seals into the exact child before protocol service begins.\n+/// Backend leases remain held until confirmed reap, while child copies survive backend loss.\n #[derive(Debug)]\n pub(crate) struct EngineResourceLease {\n     #[cfg(unix)]\n@@ -1653,6 +1653,8 @@ pub(crate) struct EngineResourceLease {\n     /// Holds the no-delete handle until the lease is dropped.\n     _file: OwnedFile,\n     #[cfg(windows)]\n+    _directories: Vec<fs::File>,\n+    #[cfg(windows)]\n     target: PathBuf,\n }\n \n@@ -1666,6 +1668,16 @@ fn descriptor_path(file: &impl std::os::fd::AsFd) -> Result<PathBuf, Error> {\n }\n \n impl EngineResourceLease {\n+    #[cfg(windows)]\n+    pub(crate) fn windows_seal_handles(\n+        &self,\n+    ) -> impl Iterator<Item = std::os::windows::io::RawHandle> + '_ {\n+        use std::os::windows::io::AsRawHandle;\n+\n+        std::iter::once(self._file.as_raw_handle())\n+            .chain(self._directories.iter().map(AsRawHandle::as_raw_handle))\n+    }\n+\n     #[cfg(unix)]\n     fn from_file(\n         file: OwnedFile,\n@@ -4107,7 +4119,9 @@ pub(crate) fn allows_delete_sharing_for_operation(\n     !is_final_leaf\n         || !matches!(\n             operation,\n-            PathOperation::EngineExecute | PathOperation::EngineConfigure\n+            PathOperation::EngineExecute\n+                | PathOperation::EngineConfigure\n+                | PathOperation::EngineResourceRead\n         )\n }\n #[cfg(windows)]\n@@ -6598,6 +6612,8 @@ impl PathAuthority {\n         observe_engine_resolution(\"resource\");\n         let mut resolved =\n             self.resolve(resource.path_ref(), PathOperation::EngineResourceRead, &[])?;\n+        #[cfg(windows)]\n+        let directories = resolved.windows_resource_directory_seals()?;\n         match resource.kind {\n             EngineResourceHandleKind::File => {\n                 #[cfg(unix)]\n@@ -6613,6 +6629,7 @@ impl PathAuthority {\n                 #[cfg(windows)]\n                 Ok(EngineResourceLease {\n                     _file,\n+                    _directories: directories,\n                     target: resolved.take_target().ok_or_else(|| {\n                         Error::Conflict(\"engine resource target is unavailable\".into())\n                     })?,\n@@ -6633,6 +6650,7 @@ impl PathAuthority {\n                     // arm above. The handle is retained for the lease lifetime; the path is\n                     // only the UCI/CreateProcess string.\n                     Ok(EngineResourceLease {\n+                        _directories: directories,\n                         _file: OwnedFile::directory(resolved.take_directory().ok_or_else(\n                             || Error::InvalidInput(\"engine resource must be a directory\".into()),\n                         )?)?,\n@@ -21015,6 +21033,22 @@ mod tests {\n         );\n     }\n \n+    #[test]\n+    fn windows_resource_leaf_sealing_uses_the_shared_operation_policy() {\n+        assert!(\n+            !allows_delete_sharing_for_operation(PathOperation::EngineResourceRead, true),\n+            \"an authorized engine resource leaf must deny delete sharing\"\n+        );\n+        assert!(allows_delete_sharing_for_operation(\n+            PathOperation::EngineResourceRead,\n+            false\n+        ));\n+        assert!(allows_delete_sharing_for_operation(\n+            PathOperation::OpeningBookRead,\n+            true\n+        ));\n+    }\n+\n     #[test]\n     fn windows_launch_sealing_covers_execute_and_configure_engine_operations() {\n         assert!(!allows_delete_sharing_for_operation(\ndiff --git a/src-tauri/src/infra/path_authority/resolved.rs b/src-tauri/src/infra/path_authority/resolved.rs\nindex b3b04cec..817e4af0 100644\n--- a/src-tauri/src/infra/path_authority/resolved.rs\n+++ b/src-tauri/src/infra/path_authority/resolved.rs\n@@ -70,6 +70,18 @@ fn windows_path_parts(path: &Path) -> Result<(PathBuf, Vec<OsString>), Error> {\n \n #[cfg(windows)]\n fn open_windows_directory_walk(path: &Path, writable: bool) -> Result<fs::File, Error> {\n+    open_windows_path_chain(path, writable, true, true)?\n+        .pop()\n+        .ok_or_else(|| Error::Conflict(\"Windows directory binding is unavailable\".into()))\n+}\n+\n+#[cfg(windows)]\n+fn open_windows_path_chain(\n+    path: &Path,\n+    writable: bool,\n+    allow_delete_share: bool,\n+    terminal_directory: bool,\n+) -> Result<Vec<fs::File>, Error> {\n     use std::ptr::null;\n     use windows_sys::{\n         Wdk::Storage::FileSystem::FILE_OPEN,\n@@ -80,12 +92,25 @@ fn open_windows_directory_walk(path: &Path, writable: bool) -> Result<fs::File,\n     };\n \n     let (base, names) = windows_path_parts(path)?;\n-    let mut handle = super::open_windows_nofollow(&base, writable)?;\n+    let handle = super::open_windows_nofollow(&base, writable)?;\n+    let mut chain = vec![handle];\n     let access = SYNCHRONIZE | GENERIC_READ | if writable { GENERIC_WRITE } else { 0 };\n-    for name in names {\n-        handle = super::open_windows_child(&handle, &name, FILE_OPEN, access, null(), true, true)?;\n+    for (index, name) in names.iter().enumerate() {\n+        let parent = chain\n+            .last()\n+            .ok_or_else(|| Error::Conflict(\"Windows parent binding is unavailable\".into()))?;\n+        let handle = super::open_windows_child(\n+            parent,\n+            name,\n+            FILE_OPEN,\n+            access,\n+            null(),\n+            index + 1 != names.len() || terminal_directory,\n+            allow_delete_share,\n+        )?;\n+        chain.push(handle);\n     }\n-    Ok(handle)\n+    Ok(chain)\n }\n \n /// Result of a successful resolution. It retains the exact opened file when\n@@ -105,6 +130,44 @@ pub struct ResolvedPath {\n }\n \n impl ResolvedPath {\n+    /// Seal the complete absolute resource pathname against ancestor replacement. A second\n+    /// walk is evidence only when its terminal identity matches the already-authorized object.\n+    #[cfg(windows)]\n+    pub(super) fn windows_resource_directory_seals(&self) -> Result<Vec<fs::File>, Error> {\n+        if self.operation != PathOperation::EngineResourceRead {\n+            return Err(Error::InvalidInput(\n+                \"resolved capability is not an engine resource\".into(),\n+            ));\n+        }\n+        let target = self\n+            .target()\n+            .filter(|path| path.is_absolute())\n+            .ok_or_else(|| {\n+                Error::Conflict(\"absolute engine resource target is unavailable\".into())\n+            })?;\n+        let (expected, directory) = if let Some(file) = self.file() {\n+            (opened_file_identity(file)?, false)\n+        } else {\n+            let directory = self\n+                .directory()\n+                .ok_or_else(|| Error::Conflict(\"engine resource binding is unavailable\".into()))?;\n+            (opened_file_identity(directory)?, true)\n+        };\n+        let mut chain = open_windows_path_chain(target, false, false, directory)?;\n+        let terminal = chain\n+            .last()\n+            .ok_or_else(|| Error::Conflict(\"engine resource binding is unavailable\".into()))?;\n+        if opened_file_identity(terminal)? != expected {\n+            return Err(Error::Conflict(\n+                \"engine resource changed after authorization\".into(),\n+            ));\n+        }\n+        // The resolution already retains the same no-delete leaf. Keep every ancestor from\n+        // the absolute root, without retaining a redundant second terminal handle.\n+        chain.pop();\n+        Ok(chain)\n+    }\n+\n     pub(super) fn is_regular_file(&self) -> bool {\n         #[cfg(unix)]\n         if self.regular_file_identity.is_some() {\n@@ -1229,6 +1292,58 @@ mod tests {\n mod windows_tests {\n     use super::*;\n \n+    #[test]\n+    fn windows_resource_sealing_refuses_a_different_terminal_identity() {\n+        use crate::infra::path_authority::{EngineResourceHandleKind, PathAuthority, PathClass};\n+\n+        for kind in [\n+            EngineResourceHandleKind::File,\n+            EngineResourceHandleKind::Directory,\n+        ] {\n+            let temp = tempfile::tempdir().unwrap();\n+            let original = temp.path().join(\"original\");\n+            let replacement = temp.path().join(\"replacement\");\n+            if kind == EngineResourceHandleKind::Directory {\n+                fs::create_dir(&original).unwrap();\n+                fs::create_dir(&replacement).unwrap();\n+            } else {\n+                fs::write(&original, b\"original\").unwrap();\n+                fs::write(&replacement, b\"replacement\").unwrap();\n+            }\n+            let mut authority =\n+                PathAuthority::open(temp.path().join(\"registry.json\"), vec![]).unwrap();\n+            let grant = authority\n+                .grant_dialog(\n+                    &original,\n+                    \"resource\",\n+                    PathClass::SingleDialogGrant,\n+                    PathOperation::EngineResourceRead,\n+                    std::time::Duration::from_secs(30),\n+                    1,\n+                )\n+                .unwrap();\n+            let resource = authority\n+                .promote_engine_resource(&grant, kind, \"resource\")\n+                .unwrap();\n+            let mut resolved = authority\n+                .resolve(resource.path_ref(), PathOperation::EngineResourceRead, &[])\n+                .unwrap();\n+            let seals = resolved.windows_resource_directory_seals().unwrap();\n+            assert!(\n+                !seals.is_empty(),\n+                \"the absolute ancestor chain must remain held\"\n+            );\n+            drop(seals);\n+            // Redirect only the separate pass's locator. Its otherwise valid new object must\n+            // never replace the identity captured by the original authority resolution.\n+            resolved.target = Some(fs::canonicalize(&replacement).unwrap());\n+            assert!(matches!(\n+                resolved.windows_resource_directory_seals(),\n+                Err(Error::Conflict(_))\n+            ));\n+        }\n+    }\n+\n     #[test]\n     fn mark_engine_executable_windows_is_a_checked_noop() {\n         let file = tempfile::tempfile().unwrap();\ndiff --git a/src-tauri/src/engine/process.rs b/src-tauri/src/engine/process.rs\nindex b792dc75..76903058 100644\n--- a/src-tauri/src/engine/process.rs\n+++ b/src-tauri/src/engine/process.rs\n@@ -52,6 +52,59 @@ use super::{\n #[cfg(target_os = \"windows\")]\n pub const CREATE_NO_WINDOW: u32 = 0x08000000;\n \n+#[cfg(windows)]\n+fn transfer_windows_resource_seals(\n+    executable: &EngineExecutable,\n+    child: &Child,\n+) -> Result<(), Error> {\n+    use std::ptr::null_mut;\n+    use windows_sys::Win32::{\n+        Foundation::{DuplicateHandle, DUPLICATE_SAME_ACCESS},\n+        System::Threading::GetCurrentProcess,\n+    };\n+\n+    #[cfg(test)]\n+    let failure = take_spawn_io_failure();\n+    let target = child.raw_handle().ok_or(Error::EngineDisconnected)?;\n+    for (index, source) in executable\n+        .resource_leases()\n+        .iter()\n+        .flat_map(|resource| resource.windows_seal_handles())\n+        .enumerate()\n+    {\n+        #[cfg(not(test))]\n+        let _ = index;\n+        #[cfg(test)]\n+        if failure == Some(SpawnIoFailure::ResourceTransferAfter(index)) {\n+            return Err(std::io::Error::other(\"injected resource seal transfer failure\").into());\n+        }\n+        let mut remote = null_mut();\n+        // Duplicate into this exact child with unchanged access and no inheritance. The\n+        // returned number belongs to the child, so it must never be closed or owned locally.\n+        let duplicated = unsafe {\n+            DuplicateHandle(\n+                GetCurrentProcess(),\n+                source,\n+                target,\n+                &mut remote,\n+                0,\n+                0,\n+                DUPLICATE_SAME_ACCESS,\n+            )\n+        };\n+        if duplicated == 0 {\n+            return Err(std::io::Error::last_os_error().into());\n+        }\n+        #[cfg(test)]\n+        SPAWN_RESOURCE_TRANSFER_OBSERVED.with(|slot| {\n+            if let Some((transferred, sent)) = slot.get() {\n+                slot.set(Some((transferred + 1, sent)));\n+            }\n+        });\n+    }\n+    Ok(())\n+}\n+\n const MAX_LOG_LINES: usize = 2_000;\n const MAX_LOG_BYTES: usize = 512 * 1024;\n const MAX_RESOURCE_REDACTIONS: usize = 256;\n@@ -3804,6 +3857,10 @@ impl EngineRuntime {\n         let mut child = timeout(deadlines.spawn, async { command.spawn() })\n             .await\n             .map_err(|_| Error::EngineTimeout(\"spawning engine\".into()))??;\n+        // Capture failure without returning: every successfully spawned child must enter its\n+        // cleanup owner before a partial transfer can refuse runtime/protocol construction.\n+        #[cfg(windows)]\n+        let resource_transfer = transfer_windows_resource_seals(&executable, &child);\n         #[cfg(all(test, unix))]\n         observe_spawned_child(&child, &command_target_for_observer);\n         #[cfg(all(test, unix))]\n@@ -3845,6 +3902,8 @@ impl EngineRuntime {\n             }));\n             state.executable = Some(executable);\n         }\n+        #[cfg(windows)]\n+        resource_transfer?;\n         if missing_stdin {\n             return Err(Error::NoStdin);\n         }\n@@ -4096,6 +4155,12 @@ impl EngineRuntime {\n         deadline: Instant,\n         interrupt: Option<&CancellationToken>,\n     ) -> Result<(), Error> {\n+        #[cfg(all(test, windows))]\n+        SPAWN_RESOURCE_TRANSFER_OBSERVED.with(|slot| {\n+            if let Some((transferred, sent)) = slot.get() {\n+                slot.set(Some((transferred, sent + 1)));\n+            }\n+        });\n         validate_uci_text(\"UCI command\", command)?;\n         self.logs.push(EngineLog::Gui(\n             self.resource_redactions.redact(format!(\"{command}\\n\")),\n@@ -4963,19 +5028,29 @@ static ENGINE_LAUNCH_RESOLUTION_HOOKS: crate::infra::test_hooks::KeyedTestHooks<\n static ENGINE_LAUNCH_POST_PIN_HOOKS: crate::infra::test_hooks::KeyedTestHooks<EngineKey> =\n     crate::infra::test_hooks::KeyedTestHooks::new();\n \n-#[cfg(all(test, unix))]\n+#[cfg(test)]\n #[derive(Clone, Copy, Debug, PartialEq, Eq)]\n enum SpawnIoFailure {\n+    #[cfg(unix)]\n     NoStdin,\n+    #[cfg(unix)]\n     NoStdout,\n+    #[cfg(windows)]\n+    ResourceTransferAfter(usize),\n }\n \n-#[cfg(all(test, unix))]\n+#[cfg(test)]\n std::thread_local! {\n     static SPAWN_IO_FAILURE: std::cell::RefCell<Option<SpawnIoFailure>> =\n         const { std::cell::RefCell::new(None) };\n }\n \n+#[cfg(all(test, windows))]\n+std::thread_local! {\n+    static SPAWN_RESOURCE_TRANSFER_OBSERVED: std::cell::Cell<Option<(usize, usize)>> =\n+        const { std::cell::Cell::new(None) };\n+}\n+\n #[cfg(all(test, unix))]\n type SpawnChildObserver = Box<dyn FnOnce(Option<u32>) + Send>;\n \n@@ -4989,12 +5064,12 @@ static SPAWN_CHILD_OBSERVERS: std::sync::OnceLock<\n     std::sync::Mutex<HashMap<std::path::PathBuf, SpawnChildObserver>>,\n > = std::sync::OnceLock::new();\n \n-#[cfg(all(test, unix))]\n+#[cfg(test)]\n fn set_spawn_io_failure(failure: Option<SpawnIoFailure>) {\n     SPAWN_IO_FAILURE.with(|slot| *slot.borrow_mut() = failure);\n }\n \n-#[cfg(all(test, unix))]\n+#[cfg(test)]\n fn take_spawn_io_failure() -> Option<SpawnIoFailure> {\n     SPAWN_IO_FAILURE.with(|slot| slot.borrow_mut().take())\n }\n@@ -6927,13 +7002,13 @@ mod tests {\n     }\n \n     #[cfg(any(windows, target_os = \"macos\"))]\n-    async fn assert_native_cwd_probe(executable: EngineExecutable, command: &str) {\n+    async fn spawn_native_probe(executable: EngineExecutable) -> (EngineRuntime, Arc<ChildOwner>) {\n         let deadlines = EngineDeadlines {\n             quit: Duration::from_millis(20),\n             ..EngineDeadlines::default()\n         };\n         let cleanup = Arc::new(ChildOwner::default());\n-        let mut runtime = match EngineRuntime::spawn_owned(\n+        let runtime = match EngineRuntime::spawn_owned(\n             executable,\n             deadlines.clone(),\n             cleanup.clone(),\n@@ -6947,11 +7022,32 @@ mod tests {\n                     .await;\n                 assert!(\n                     reaped.is_ok(),\n-                    \"failed native cwd launch must be reaped: {reaped:?}\"\n+                    \"failed native launch must be reaped: {reaped:?}\"\n                 );\n-                panic!(\"native cwd launch failed: {error:?}\");\n+                panic!(\"native launch failed: {error:?}\");\n             }\n         };\n+        (runtime, cleanup)\n+    }\n+\n+    #[cfg(any(windows, target_os = \"macos\"))]\n+    async fn reap_native_probe(runtime: &mut EngineRuntime, cleanup: &ChildOwner) {\n+        let reaped = runtime.terminate().await;\n+        let fallback = cleanup\n+            .terminate(Duration::ZERO, runtime.deadlines.kill_reap, false)\n+            .await;\n+        assert!(reaped.is_ok(), \"native probe must be reaped: {reaped:?}\");\n+        assert!(\n+            fallback.is_ok(),\n+            \"native probe fallback must confirm reap: {fallback:?}\"\n+        );\n+        assert!(!cleanup.unresolved());\n+        eprintln!(\"native probe physically reaped before propagating outcome\");\n+    }\n+\n+    #[cfg(any(windows, target_os = \"macos\"))]\n+    async fn assert_native_cwd_probe(executable: EngineExecutable, command: &str) {\n+        let (mut runtime, cleanup) = spawn_native_probe(executable).await;\n         let outcome = timeout(Duration::from_secs(5), async {\n             runtime.send(command, None).await?;\n             loop {\n@@ -6966,20 +7062,200 @@ mod tests {\n             }\n         })\n         .await;\n-        let reaped = runtime.terminate().await;\n-        let fallback = cleanup\n-            .terminate(Duration::ZERO, deadlines.kill_reap, false)\n+        reap_native_probe(&mut runtime, &cleanup).await;\n+        assert_eq!(outcome.unwrap().unwrap(), \"cwd-original\");\n+    }\n+\n+    #[cfg(windows)]\n+    struct WindowsResourceProbe {\n+        _temp: tempfile::TempDir,\n+        executable: EngineExecutable,\n+        resources: Vec<(String, std::path::PathBuf, &'static str)>,\n+        rename_paths: Vec<std::path::PathBuf>,\n+    }\n+\n+    #[cfg(windows)]\n+    fn windows_resource_probe() -> WindowsResourceProbe {\n+        use crate::infra::path_authority::{EngineResourceHandleKind, PathClass};\n+\n+        let temp = tempfile::tempdir().unwrap();\n+        let cwd = temp.path().join(\"engine-cwd\");\n+        std::fs::create_dir(&cwd).unwrap();\n+        let image = cwd.join(\"engine.exe\");\n+        std::fs::copy(std::env::var_os(\"COMSPEC\").unwrap(), &image).unwrap();\n+        let ancestor = temp.path().join(\"resource-ancestor\");\n+        let parent = ancestor.join(\"resource-parent\");\n+        let directory = parent.join(\"tables\");\n+        std::fs::create_dir_all(&directory).unwrap();\n+        let file = parent.join(\"book.bin\");\n+        std::fs::write(&file, b\"resource-file-original\\n\").unwrap();\n+        std::fs::write(directory.join(\"data\"), b\"resource-directory-original\\n\").unwrap();\n+        let mut authority = PathAuthority::open(temp.path().join(\"registry.json\"), vec![]).unwrap();\n+        let engine = authority\n+            .register_engine_file(&image, \"Resource seal probe\")\n+            .unwrap();\n+        let mut leases = Vec::new();\n+        let mut resources = Vec::new();\n+        for (path, kind, content) in [\n+            (\n+                &file,\n+                EngineResourceHandleKind::File,\n+                \"resource-file-original\",\n+            ),\n+            (\n+                &directory,\n+                EngineResourceHandleKind::Directory,\n+                \"resource-directory-original\",\n+            ),\n+        ] {\n+            let grant = authority\n+                .grant_dialog(\n+                    path,\n+                    \"resource\",\n+                    PathClass::SingleDialogGrant,\n+                    PathOperation::EngineResourceRead,\n+                    Duration::from_secs(30),\n+                    1,\n+                )\n+                .unwrap();\n+            let read_path = if kind == EngineResourceHandleKind::Directory {\n+                path.join(\"data\")\n+            } else {\n+                path.to_path_buf()\n+            };\n+            let handle = authority\n+                .promote_engine_resource(&grant, kind, \"resource\")\n+                .unwrap();\n+            let lease = authority.engine_resource(&handle).unwrap();\n+            let value = lease.uci_value().unwrap();\n+            resources.push((value, read_path, content));\n+            leases.push(Arc::new(lease));\n+        }\n+        let executable = authority\n+            .engine_executable(&engine, PathOperation::EngineExecute)\n+            .unwrap()\n+            .with_resource_leases(leases);\n+        WindowsResourceProbe {\n+            _temp: temp,\n+            executable,\n+            resources,\n+            rename_paths: vec![file, directory, parent, ancestor],\n+        }\n+    }\n+\n+    #[cfg(windows)]\n+    fn assert_resource_renames_released(paths: &[std::path::PathBuf]) {\n+        for path in paths {\n+            let moved = path.with_extension(\"moved\");\n+            std::fs::rename(path, &moved)\n+                .expect(\"physical reap must release child-only resource seals\");\n+            std::fs::rename(&moved, path).unwrap();\n+        }\n+    }\n+\n+    #[cfg(windows)]\n+    #[tokio::test]\n+    async fn windows_resource_child_seals_survive_all_backend_seal_loss_until_reap() {\n+        let WindowsResourceProbe {\n+            _temp,\n+            executable,\n+            resources,\n+            rename_paths,\n+        } = windows_resource_probe();\n+        let (mut runtime, cleanup) = spawn_native_probe(executable).await;\n+        let outcome = std::panic::AssertUnwindSafe(async {\n+            // No EngineActor or local Arc retains resources here. This removes the sole\n+            // backend executable/resource owner while leaving child control available.\n+            let backend_seals = cleanup.state.lock().unwrap().executable.take().unwrap();\n+            drop(backend_seals);\n+            for path in &rename_paths {\n+                let moved = path.with_extension(\"moved\");\n+                let error = std::fs::rename(path, &moved)\n+                    .expect_err(\"child-only seals must refuse resource/parent/ancestor rename\");\n+                assert!(matches!(error.raw_os_error(), Some(5 | 32)), \"{error}\");\n+                assert!(!moved.exists());\n+                for (_, read_path, content) in &resources {\n+                    assert_eq!(std::fs::read_to_string(read_path).unwrap().trim(), *content);\n+                }\n+            }\n+            for (value, _, content) in &resources {\n+                let resource_path = if *content == \"resource-directory-original\" {\n+                    format!(\"{value}\\\\data\")\n+                } else {\n+                    value.clone()\n+                };\n+                timeout(Duration::from_secs(5), async {\n+                    runtime\n+                        .send(&format!(\"type \\\"{resource_path}\\\"\"), None)\n+                        .await?;\n+                    loop {\n+                        let line = runtime\n+                            .read_line()\n+                            .await?\n+                            .ok_or(Error::EngineDisconnected)?;\n+                        if line.trim() == *content {\n+                            return Ok::<_, Error>(());\n+                        }\n+                    }\n+                })\n+                .await\n+                .unwrap()\n+                .unwrap();\n+            }\n+        })\n+        .catch_unwind()\n+        .await;\n+        reap_native_probe(&mut runtime, &cleanup).await;\n+        if let Err(panic) = outcome {\n+            std::panic::resume_unwind(panic);\n+        }\n+        assert_resource_renames_released(&rename_paths);\n+    }\n+\n+    #[cfg(windows)]\n+    #[tokio::test]\n+    async fn windows_resource_partial_transfer_failure_precedes_protocol_and_is_reaped() {\n+        let WindowsResourceProbe {\n+            _temp,\n+            executable,\n+            rename_paths,\n+            ..\n+        } = windows_resource_probe();\n+        let cleanup = Arc::new(ChildOwner::default());\n+        SPAWN_RESOURCE_TRANSFER_OBSERVED.with(|slot| slot.set(Some((0, 0))));\n+        set_spawn_io_failure(Some(SpawnIoFailure::ResourceTransferAfter(1)));\n+        let result =\n+            EngineRuntime::spawn_owned(executable, EngineDeadlines::default(), cleanup.clone())\n+                .await;\n+        let owned = cleanup.unresolved();\n+        let observed = SPAWN_RESOURCE_TRANSFER_OBSERVED.with(|slot| slot.take());\n+        set_spawn_io_failure(None);\n+        let error = match result {\n+            Ok(mut runtime) => {\n+                reap_native_probe(&mut runtime, &cleanup).await;\n+                None\n+            }\n+            Err(error) => Some(error),\n+        };\n+        let reaped = cleanup\n+            .terminate(Duration::ZERO, EngineDeadlines::default().kill_reap, false)\n             .await;\n         assert!(\n             reaped.is_ok(),\n-            \"native cwd probe must be reaped: {reaped:?}\"\n+            \"partial transfer child must be physically reaped: {reaped:?}\"\n+        );\n+        assert!(!cleanup.unresolved());\n+        eprintln!(\"partial transfer child physically reaped before propagating outcome\");\n+        assert!(owned, \"transfer failure must retain actual child ownership\");\n+        assert_eq!(\n+            observed,\n+            Some((1, 0)),\n+            \"one actual transfer and no protocol/resource sends\"\n         );\n         assert!(\n-            fallback.is_ok(),\n-            \"native cwd probe fallback must confirm reap: {fallback:?}\"\n+            matches!(error, Some(Error::Io(error)) if error.to_string() == \"injected resource seal transfer failure\")\n         );\n-        eprintln!(\"native cwd probe physically reaped before propagating outcome\");\n-        assert_eq!(outcome.unwrap().unwrap(), \"cwd-original\");\n+        assert_resource_renames_released(&rename_paths);\n     }\n \n     #[cfg(windows)]\ndiff --git a/src-tauri/src/infra/fs.rs b/src-tauri/src/infra/fs.rs\nindex 59eefe42..db4f873a 100644\n--- a/src-tauri/src/infra/fs.rs\n+++ b/src-tauri/src/infra/fs.rs\n@@ -4372,14 +4372,7 @@ pub(crate) use unix::{\n pub(crate) use unix::{\n     raw_libc_stat_identity, raw_mode_from, raw_stat_identity, MAX_REMOVE_TREE_DEPTH,\n };\n-// Not stale, and deliberately not a blanket allow: on Windows every *production* consumer of the\n-// depth bound lives inside `mod win` itself, because `fs.rs`'s `MAX_ARCHIVE_PATH_COMPONENTS` is\n-// still `#[cfg(unix)]` (archive extraction is not ported). The re-export keeps one crate-level\n-// spelling of the bound on both targets, and the test build — where\n-// `recursive_delete_refuses_more_than_the_maximum_depth` reads it — is left unsuppressed, so it\n-// still goes red if that last consumer disappears.\n #[cfg(windows)]\n-#[cfg_attr(not(test), allow(unused_imports))]\n pub(crate) use win::MAX_REMOVE_TREE_DEPTH;\n \n pub fn atomic_replace_with_precommit<F, P>(\n",
  "windows-resource-proof-policy.patch": "diff --git a/src-tauri/src/infra/path_authority/mod.rs b/src-tauri/src/infra/path_authority/mod.rs\nindex 296374c8..2d2a7506 100644\n--- a/src-tauri/src/infra/path_authority/mod.rs\n+++ b/src-tauri/src/infra/path_authority/mod.rs\n@@ -4119,7 +4119,9 @@ pub(crate) fn allows_delete_sharing_for_operation(\n     !is_final_leaf\n         || !matches!(\n             operation,\n-            PathOperation::EngineExecute | PathOperation::EngineConfigure\n+            PathOperation::EngineExecute\n+                | PathOperation::EngineConfigure\n+                | PathOperation::EngineResourceRead\n         )\n }\n #[cfg(windows)]\n",
  "windows-resource-final-commands.log": "cargo test --manifest-path src-tauri/Cargo.toml --locked infra::path_authority::tests -- --nocapture \ncargo test --manifest-path src-tauri/Cargo.toml --locked catalog_install -- --nocapture \ncargo test --manifest-path src-tauri/Cargo.toml --locked fs::tests -- --nocapture \ncargo test --manifest-path src-tauri/Cargo.toml --locked puzzle::tests -- --nocapture \ncargo test --manifest-path src-tauri/Cargo.toml --locked db:: -- --nocapture \ncargo test --manifest-path src-tauri/Cargo.toml --locked infra::platform_support::tests -- --nocapture \ncargo test --manifest-path src-tauri/Cargo.toml --locked engine::process::tests -- --nocapture \ncargo test --manifest-path src-tauri/Cargo.toml --locked shutdown_ -- --nocapture \ncargo fmt --manifest-path src-tauri/Cargo.toml -- --check \ngit diff --check \ncargo clippy --manifest-path src-tauri/Cargo.toml --all-targets --locked -- -D warnings \npnpm rust:windows:check \n"
}
```


## Root proof before corrective source commit

Root gate-joiner-proof.fgVOrW at67d30f9766e75f4a7d3f613825c2b19af07dab9d with the exact unstaged final source completed0, canonical poll0 and joiner-proof green resolution recorded. This supersedes canceled A8UMzj143 as the valid pre-review proof. All affected Rust groups, Linux all-target clippy, fmt/diff and pnpm checks:pre-review passed, including WindowsGNU all-target clippy in pre-review. Root broad shutdown selector ran42tests, the writer's narrower selector ran39, both0. Pre-review waited for other projects' shared heavy slots, with no interference. Source remains unchanged from the final WR audit. Four findings f021/f0914/f0917/f0920 stay open pending actual native acceptance, canonical joinerf0918 remains handled, portraitf-20261001-05 remains open because its renderer edit does not overlap the native anchor. Next is committed cumulative corrective R11 over published1a..HEAD, original3e..HEAD available as context. Full current-source gates, required native CI, installation and exit run record remain pending. Plan authorship and arbitration shared one context, detection uses the same model family as code in separate Codex sessions.


## Cumulative corrective code review R11

Reviewed through0dc736b1015413347bf58a40b7973fe8d4970caa, corrective published range1a4305ed..0dc736b1 with full original3e..0dc context. All12exact round leaves completed and reports read. Correctness, root-cause, tests, error-handling, engine-protocol, ipc-contract, platform-semantics, pgn-index and records APPROVED. Minimalism, code-quality and tauri-security REVISE. Tests APPROVED includes a retained should-fix, verdict does not discard it. Root adopts4witnesses/4unique issues, all Fix, no Skip/Defer. Separate J3/WR judgments and original inherited counts remain unchanged.

- CR18, tests98, fs.rs:4588: current deadline case blocks before prepared send, so cancellation exits before publication wait. It cannot catch missing admission-drop-before-worker-await, nor prove an admitted publication tail outlives preparation deadline. Fix behavioral regressions through actual shared production helper and relevant publication path, with source-only red and confirmed worker cleanup.
- CR19, minimalism94, fs.rs:764: prepared-tree hook, cancel and parent identity checks duplicate install_extracted_tree. Fix one canonical validator routed from both real entry points, preserve standalone replace semantics and hook ordering.
- CR20, code-quality98, infra/fs.rs:848: new too_many_arguments suppression lacks a library boundary. Fix grouping coherent native install inputs without a general framework or weakening driver invariants.
- CR21, tauri-security94, infra/fs.rs:3801: final Windows commit reopens source_name after last identity check without comparing that exact rename handle. Fix exact accepted source identity at native commit before any target backup. New contrary consumer evidence in the JI1/J3 source ownership lineage, so root stops a local patch and requests fresh focused review-plan mechanism judgment WSC1. Native reproduction not yet claimed. Existing f-20260920-01 annotated immediately through the locked writer.

Root source trace confirms the reopen and handle-based NtSetInformationFile commit, and confirms CR18–20 observations. The new native source commit judgment is pending, no correction source edit yet. Required Windows runtime and current-source app/fullgates/push/install remain pending. Four findings stay open, canonical joiner remains handled, portrait remains open. Plan authorship and arbitration shared one context. Detection used the same model family as code in separate Codex sessions, without family separation.

Raw R11 reports, exact original output, preserved losslessly:

```json
{
  "lens-correctness-r11.txt": "No correctness defects found in the corrective range after tracing the changed functions and consumers.\n\nLimitations: source-only review. Native Windows transfer, replacement refusal and handle release remain unverified. No tests ran or files changed. Reviewer and author share a model family. (confidence: 100)\n\nVERDICT: APPROVED",
  "lens-root-cause-r11.txt": "No root-cause blocker or prior-fix reintroduction found (confidence: 92).\n\nThe diff removes both puzzle pathname revalidation steps, carries the extractor’s staging owner through inventory, publication and cleanup, enforces absent-only catalog publication, and transfers the complete Windows resource seals into the child before protocol initialization. Ordinary database validation and Unix lock-safe probing remain intact.\n\nLIMITATION — `src-tauri/src/engine/process.rs:56`: native Windows transfer, child-only lifetime, nested-resource and release behavior remain unverified. Supplied GNU compilation and policy red/green evidence do not establish runtime success (confidence: 100).\n\nLIMITATION — Direct staging ownership has passing behavioral coverage, but its source reversal produced compilation errors rather than a behavioral failure. Puzzle rename and appearing-destination mechanisms have executed red/green evidence (confidence: 100).\n\nRead-only review. No files changed or tests run.\n\nVERDICT: APPROVED",
  "lens-tests-r11.txt": "[should-fix] src-tauri/src/fs.rs:4588 — The deadline test blocks before `prepared_tx.send`. After release, cancellation exits preparation before the worker reaches `publish_rx.blocking_recv`. It therefore cannot catch removal of the admission-drop-before-producer-await behavior at lines 65–79. Keeping the admission sender alive during that await would still pass this test while leaving the publication-permit deadlock unguarded. The admitted publication tail exceeding the preparation deadline also has no assertion. (confidence: 98)\n\nLimitation: Windows behavioral assertions are reachable through `rust-windows-test`, but their current-source native execution remains pending. GNU checks establish compilation only. (confidence: 100)\n\nVERDICT: APPROVED",
  "lens-error-handling-r11.txt": "No error-handling defects found at confidence ≥80. Traced publication failures, cancellation, durability uncertainty, puzzle probing and partial resource-transfer cleanup through their callers.\n\nLimitation: native Windows transfer and cleanup behavior remain unverified locally (confidence: 100). GNU checks establish compilation only.\n\nRead-only review. No files changed or tests run. Reviewer and code authors share the Codex model family.\n\nVERDICT: APPROVED",
  "lens-minimalism-r11.txt": "[should-fix] src-tauri/src/fs.rs:764 — `prepare_archive_download` duplicates the hook, cancellation check and staging-parent identity validation in `install_extracted_tree` at line 1866. The standalone download adapter traverses both copies. Extract one shared prepared-tree validation function and route both entry points through it, preserving standalone replacement behavior without maintaining parallel guards. (confidence: 94)\n\nRead-only source review. No files changed or tests run. Reviewer and author share a model family. Native Windows runtime proof remains pending.\n\nVERDICT: REVISE",
  "lens-code-quality-r11.txt": "[blocker] src-tauri/src/infra/fs.rs:848 — The diff adds `#[allow(clippy::too_many_arguments)]` to the internal installation driver as its parameter list grows. No comment documents a third-party or library boundary requiring this suppression. Group the related installation inputs rather than silencing the readability signal. (confidence: 98)\n\nVERDICT: REVISE",
  "lens-engine-protocol-r11.txt": "No confirmed engine supervision, UCI protocol, or result-routing defects found.\n\nRead-only source and saved-evidence review. Native Windows handle transfer, replacement refusal, and release remain unverified pending required CI. No files changed or tests run. Review used the same model family in a separate session.\n\nVERDICT: APPROVED",
  "lens-ipc-contract-r11.txt": "No IPC-contract defects found. Affected Rust commands, generated invoke keys and renderer callers agree. Download progress remains Specta-registered, correlated by id and generation, and percentage-based, with listener cleanup. No new commands, events, binding edits or capability scopes appear.\n\nRead-only source review only. Native Windows runtime acceptance remains pending. Reviewer and code author share a model family in separate sessions.\n\nVERDICT: APPROVED",
  "lens-tauri-security-r11.txt": "[blocker] src-tauri/src/infra/fs.rs:3801 — Windows publication reopens `source_name` without checking the new handle against the inventoried staging identity. A writer with rename access to the engine workspace can replace that leaf after the driver’s final identity check at line 891 and before this open. The retained staging handles permit delete sharing. `rename_child` then publishes the replacement directory, whose contents never passed archive verification or inventory. This requires one completed substitution, not continuous modification. The new held-parent caller therefore does not preserve J3’s exact-source identity through commit. (confidence: 94)\n\nLimitation: source-only review, no files changed or checks run. Native Windows runtime acceptance remains pending. Credential/session flows are unchanged, and no refresh-token flow is introduced.\n\nVERDICT: REVISE",
  "lens-platform-semantics-r11.txt": "No platform-semantics findings identified (confidence: 90). Reviewed all nine supplied source paths and connected platform consumers/tests.\n\nSupplied evidence confirms `pnpm rust:windows:check` passed GNU compilation/clippy. It establishes no Windows runtime behavior. No non-Linux Unix source-probe result is established for this corrective range.\n\nCurrent-source native acceptance remains pending in `rust-windows-test` and `rust-macos-test`. The `rust-platform` matrix supplies compilation/lint evidence only. Backend handle-loss simulation does not establish actual crash behavior.\n\nRead-only review. No files changed or checks executed. Reviewer and implementation share a model family in separate sessions.\n\nVERDICT: APPROVED",
  "lens-pgn-index-r11.txt": "No in-scope defects found. Traced puzzle carrier validation, cache identity and descriptor-backed SQLite reads. Ordinary database pathname validation remains intact. No files changed or tests run. Native Windows runtime behavior remains unverified locally.\n\nVERDICT: APPROVED",
  "lens-records-r11.txt": "No findings. Source hashes, saved test counts, 73 embedded evidence files, preserved history and pending acceptance statements agree.\n\nLimitations: corrective native Windows/macOS behavior remains unverified. Hosted job statuses beyond the saved Windows log were not independently confirmed. No files changed or tests run. Review used the code author’s model family in a separate session.\n\nVERDICT: APPROVED"
}
```
