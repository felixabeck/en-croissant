# Review handoff: f-20261003-09 workspace cleanup failures

The following sections preserve the inherited planning and refresh history verbatim.
Current execution and cumulative review follow that history.

Load this record before implementing or reviewing the successor diff. Plan:
tasks/plans/2026-10-16-workspace-cleanup-failure.md. Planned ahead, PLAN-ONLY session
f7c28b80-e950-4a95-99a8-225a92fd366f, at BASE
bda9d31380041a5bff1816e51dc2ac019b9c79c0. Primary cluster is the pinned singleton
f-20261003-09, frontend-ui, build tier, impact unclassified as derived by findings.py.
No joiners were planned.

The complete behavioral plan and fixed verbatim MANDATE accompany this handoff.
No implementation, ledger mutation, commit, push, application browser or server occurred.
The original finding remains open for the adopting execution session.

## Provenance and routing

Root Codex authored the plan and arbitrated every disposition in the same context.
Fresh read-only Codex leaves ran detection on gpt-6.1-sol, review-plan at high and
the remaining lenses at medium. Detection ran on the same OpenAI model family as the code.
No model-family separation is claimed. All leaves used leaf-launch.sh and the supplied
DRAIN_CHILDREN_FILE. No fallback, retry, quota wait or failed leaf occurred.

Two read-only Locate probes traced the complete 11-call-site helper inventory. Probe reports
remain in /tmp/drain-plan-drain-90a2aa88-slot1/build. They establish static source behavior,
not application test results. A disposable React/JSDOM probe against the installed SWR 2.4.0
production package measured the bound-mutate workspace-switch defect with exit 0.

## Decisions for the adopter to record

1. Reconcile cleanup failures and preserve the original rejection, never recover a leftover
   as a successful create. Keep backendCategory and the seven UI categories.
2. Add a separate opt-in cleanup reconciliation callback to the recovery helper, leaving
   engine/database recovery and destructive success callbacks unchanged.
3. Use one localized workspace cleanup message across Files, repertoire and import error
   boundaries, including an unmounted import's notification.
4. Share the workspace listing key and reconcile by submission-captured key/cache. Retire
   or drain old listing work locally with the existing request-owner capability.
5. Keep the pinned scope at build because renderer recovery, cache ownership and forms
   still required a design decision. Broader sibling defects and co-located joiners remain open.

Chosen/rejected alternatives, evidence and reversal paths are under the plan's Decisions and
trade-offs. Governing precedent: d-20260904-06, d-20260831-01, d-20260901-06,
d-20260906-03 as refined only for downloads by d-20261004-25, and d-20261006-05.
The backend predecessor's review record is tasks/handoffs/2026-10-06-f-20260914-02-review.md.
Its native issue IDs are historical and do not become open obligations here.

## Completion and remaining execution

Two completed review rounds, 166.5 and 115.1 seconds wall elapsed from prepared launch to
last report. No known quota or external dependency waits. Active wall is not separately
measured. Two unique issues opened and closed. Raw Fix adoptions r1=3 r2=0, counting both
witnesses of I1 as separate reported adoptions. No Skip, Defer, withdrawal, correction-created
finding, carried item or open obligation. No lineage rewrite, split or inherited review counts.

The adopter must implement the one cohesive phase, run its unit/component and real-SWR proofs,
prove fix-revert red/green, inspect container browser screenshots, run the final affected
frontend/contract gates and release through the project's push skill. No proof is waived by
plan approval. No native GTK change is planned. The supersession primitive may be exposed only
for this cleanup boundary, with ordinary sharing and cancellation behavior preserved.

The supervisor retains and publishes the hash-indexed raw leaf reports, prompts, snapshots and
deltas as Evidence. The following append-only record carries every issue, witness, raw verdict,
disposition, source/probe evidence, authority and closure. It deliberately does not duplicate
raw reports or complete snapshots.

## Reviews

### Round 1 — plan-r1, 12 plan-capable lenses

Every user-wide and project plan-capable lens ran through leaf-launch.sh. review-code-quality and review-root-cause declare plan-review false and were excluded. All detected on Codex gpt-6.1-sol, plan at high and the other lenses at medium. Plan authorship and arbitration share this root context, and detection uses the same OpenAI family as the code.

Raw verdicts: correctness REVISE (one blocker), plan REVISE (two blockers). Tests, minimalism, error-handling and platform-semantics APPROVED with no findings. Chess-semantics, engine-protocol, ipc-contract, persisted-state, pgn-index and tauri-security returned NOT APPLICABLE with APPROVED. Their reasons fit the frozen renderer error-disposition scope. Platform reviewed opaque-handle/cache behavior without a native platform claim. Error-handling reported absent dependency source locally as a limitation. The main checkout's matching SWR dependency was available to the arbiter and other lenses.

#### I1 — Bound mutate refreshes the new workspace

- Claim: callbacks captured in A refresh B if the workspace switches before A's cleanup failure settles. O2's bound-mutate instruction contradicts its captured-workspace requirement.
- Witnesses: correctness r1 finding 1, confidence 99, blocker. Plan r1 finding 1, confidence 99, blocker.
- Evidence: SWR 2.4.0 dist/index/index.mjs:518 reads keyRef.current. Real SWR plus React/JSDOM probe at /tmp/drain-plan-drain-90a2aa88-slot1/build/probe-bound-mutate.mjs exited 0 and printed {"callbackCapturedIn":"A","currentWorkspace":"B","refreshed":["B"]}. This uses the installed production package, not a reconstruction. useFileWorkspace.tsx:138 and :177 pass bound mutate today.
- MANDATE: "the file list is not refreshed" and "a leftover entry stays invisible until some later refresh", with the frozen workspace-change threat model.
- Disposition: Fix. O2 now requires explicit key and owning-cache capture for Files actions as well as createFile, and a real-SWR A-to-B regression that cannot pass by mocking mutate.
- Authority: the existing O2 ownership promise was impossible with its specified callback. No new product behavior or independent mechanism is authorized.
- Dependencies: none. Status: open for round 2 closure against the revised O2.

#### I2 — A pre-mutation native listing can satisfy reconciliation

- Claim: O2 promises fresh data while Risks excludes the request-sharing gap. A pending pre-mutation listing is reused and may omit the leftover.
- Witness: plan r1 finding 2, confidence 97, blocker.
- Evidence: useFileWorkspace.tsx:78 calls workspaceOwner.run. useNativeRequestOwner.ts:116 returns a live current.promise without calling the new request. :153 already supplies supersede, which aborts the SWR-facing delivery through supersedeRequest's raced cancellation. This is the same production path identified by f-20261004-09, not an invented new race.
- MANDATE: "the file list is not refreshed" and "a leftover entry stays invisible until some later refresh". Leaving a pre-mutation result eligible does not meet that obligation.
- Disposition: Fix. O2 must retire or drain the captured key's old generation before post-cleanup reconciliation, using the existing ownership capability. Its real-SWR test keeps the old listing pending and resolves it late, proving a fresh leftover listing survives. Scope now permits exposing the existing primitive and protecting its unchanged lifecycle tests. Other consumers remain with f-20261004-09.
- Authority: MANDATE's required listing refresh and frozen asynchronous-operation threat model authorize this local integration. No new registry or global mutation serialization protocol is added.
- Dependencies: I1's captured key. Status: open for round 2 closure.

Root corrections accompanying r2: the notification path is now explicitly listed in owned scopes so O3 can reach an unmounted import. Catalogue proof belongs in the shared message selector test with real i18next, because src/i18n.test.ts mocks it. Neither changes the O3 behavioral contract.

Round 1 totals: 2 unique issues, 3 raw Fix adoptions, 0 Skip, 0 Defer, no withdrawals or carried items. No quota or external dependency wait occurred. Active wall is not separately measured.

Round 1 wall elapsed from prepared launch to last report: 166.5 seconds. The later arbitration and correction interval is not included in that review duration.

### Round 2 — scoped closure, plan-r2

Selection: plan and correctness as I1 witnesses, plan as I2 witness, plus tests, error-handling, minimalism and persisted-state for changed reconciliation ownership, primitive exposure and proof scopes. No full fan-out was repeated. Each packet included the unchanged MANDATE, full body and record, both snapshots, exact generated delta and correction evidence. All six leaves completed through the selected Codex route, with the same role/model/effort pins as round 1.

Raw verdicts: all six APPROVED. Persisted-state again returned NOT APPLICABLE because only transient listing/request state is affected. No new findings or late observations were reported.

- I1 CLOSED by correctness r2 and plan r2. They explicitly confirmed submission-captured key/cache ownership and real-SWR A-to-B verification against final r2 O2.
- I2 CLOSED by plan r2. It confirmed existing cancellation/draining and raced delivery at useNativeRequestOwner.ts:42 and :138 can satisfy the O2 boundary, and the plan covers late-result verification without changing ordinary sharing.

Round 2 wall elapsed from prepared launch to last report: 115.1 seconds. No quota or external dependency wait, active wall not separately measured. 0 Fix adoptions. Final totals: 2 unique issues, both closed, 3 raw adoptions across rounds, 0 Skip, 0 Defer, 0 withdrawals, 0 carried items, 0 open obligations. Counts: r1=3 r2=0. Neither correction created a reported defect.

The reviewed behavioral body is unchanged from plan-r2. Only append-only review results follow it. No implementation or application test result is claimed. The scratch SWR probe is a dependency-behavior measurement, not application verification.

## Refresh handoff — 2026-10-17

This appendix updates the publication base to 13c0870391455518f503044c91c996cd5430fd8e, from bda9d31380041a5bff1816e51dc2ac019b9c79c0. Refresh session d4f56512-03c2-4c68-a4e7-bc250bac6fee preserved the original plan, fixed MANDATE, two-round history, I1/I2 closures, decisions and metrics. Source tracing confirmed the finding still holds and remains build tier. The native cleanup payload and renderer integration paths are unchanged by drift. No behavioral obligation or decision was added or reversed. No co-located joiner was planned.

Load the complete plan and this cumulative record before implementation or diff review. Round 3 raw reports, prompts, snapshot and drift are under /tmp/drain-plan-drain-90a2aa88-slot2/build and are retained for supervisor evidence mirroring. The supervisor owns publication. The adopter must record the already listed autonomous decisions and complete the unchanged execution and proof obligations. The finding remains open, with no source or ledger changes, commit, push, server or browser in this refresh run.

### Round 3 — refresh at 13c08703, plan-r3

PLAN-REFRESH session d4f56512-03c2-4c68-a4e7-bc250bac6fee checked BASE bda9d31380041a5bff1816e51dc2ac019b9c79c0 against NEW-BASE 13c0870391455518f503044c91c996cd5430fd8e. Selection was exactly REFRESH-LENSES: chess-semantics, correctness, engine-protocol, error-handling, ipc-contract, minimalism, persisted-state, pgn-index, plan, platform-semantics, tauri-security and tests. All were present in the published lineage, with no first-look addition. Every packet included both SHAs, the process-generated drift, the generated r2-to-r3 plan delta, full current behavioral body, fixed MANDATE, prior review history and applicable decisions. Source revalidation retained the build tier and pinned singleton. No joiners were planned.

All 12 raw verdicts were APPROVED. Chess-semantics, engine-protocol, ipc-contract, persisted-state, pgn-index, platform-semantics and tauri-security returned NOT APPLICABLE. Their reasons fit unchanged native contracts and a plan confined to renderer error disposition, transient listing reconciliation and localized messages. Correctness, error-handling, minimalism, plan and tests approved without findings. No late observations, reopened IDs or invalidated obligations were reported. O1–O4 and the execution phase remain unchanged. I1 and I2 retain their explicit r2 closures.

Root plan authorship and arbitration shared one context. Detection ran through fresh read-only Codex gpt-6.1-sol leaves, review-plan at high effort and all others at medium, on the same OpenAI model family as the code. No fallback, retry, failed leaf or known quota/dependency wait occurred. Round 3 wall elapsed from prepared launch to final report was 109.4 seconds. Active wall was not separately measured.

Round 3 totals: 0 new issues and 0 Fix adoptions. Cumulative totals: 2 unique issues, both closed, 3 raw Fix adoptions, 0 Skip, 0 Defer, 0 withdrawals, 0 carried items and 0 open obligations. Counts remain gap-free: r1=3 r2=0 r3=0. No correction-created defect, rewrite or split. The original two-round evidence and history are preserved. No implementation or application proof is claimed. The adopter still owns phase proof, fix-revert proof, browser verification, gates, decision recording, closure and release.

Refresh output checks: existing validate_review_metadata and validate_issues accepted the updated metadata. Existing mirror_review_evidence and validate_review_evidence accepted all 30 retained launcher rows across rounds 1–3, including 12 approved r3 rows and the inherited issue witnesses and closures. The scratch validation mirror is under RUN_TMP/validation-evidence. findings.py check exited 0 with 596 findings, 131 pickable and 2 blocked. git diff --check passed, HEAD remained NEW-BASE, and git status --porcelain=v1 --untracked-files=all was empty. These are planning-output checks, not application test or release evidence.



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
    "findings": [
      {
        "kind": "blocker",
        "text": "/tmp/drain-plan-drain-90a2aa88-slot1/build/plan-r1.md:57 — The existing SWR bound `mutate` does not capture the submitting workspace. SWR 2.4.0 implements it using `keyRef.current` (`/home/felixb/Projekte/chessfable/node_modules/swr/dist/index/index.mjs:516–520`). Start a Files mutation in workspace A, switch to B, then receive `operation-and-cleanup`. The prescribed callback refreshes B and leaves A stale, contradicting O2’s captured-workspace contract. Require refresh or invalidation explicitly keyed to the submitting workspace for Files actions too. (confidence: 99)"
      }
    ],
    "lens": "correctness",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-correctness-r1.prompt",
    "report": "lens-correctness-r1.txt",
    "round": 1,
    "terminal": "completed",
    "verdict": "REVISE"
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
        "text": "/tmp/drain-plan-drain-90a2aa88-slot1/build/plan-r1.md:57 — Existing bound `mutate` does not capture the submitting workspace. SWR 2.4.0 reads `keyRef.current` when invoked (`/home/felixb/Projekte/chessfable/node_modules/swr/dist/index/index.mjs:518`), updating that reference on workspace changes at line 563. The callbacks passed at `src/components/files/useFileWorkspace.tsx:140` and `:200` therefore refresh workspace B if A’s mutation rejects after switching to B. This contradicts O2’s captured-workspace contract. Require explicitly captured-key reconciliation for Files actions and a real-SWR workspace-switch regression. (confidence: 99)"
      },
      {
        "kind": "blocker",
        "text": "/tmp/drain-plan-drain-90a2aa88-slot1/build/plan-r1.md:92 — Excluding the listing-freshness gap makes O2’s fresh-data guarantee at line 61 unsatisfiable. The Files fetcher uses `workspaceOwner.run` (`src/components/files/useFileWorkspace.tsx:78`), which returns an existing live promise without starting another listing (`src/hooks/useNativeRequestOwner.ts:116`). If a pre-mutation listing remains pending when cleanup fails, the proposed `mutate()` reconciliation can reuse its old result and leave the leftover invisible. Require a fresh generation at this reconciliation boundary and proof with a pending pre-mutation listing. The existing `supersede` capability provides a local integration option (`src/hooks/useNativeRequestOwner.ts:153`). (confidence: 97)"
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
    "claim": "Bound SWR mutate refreshes the current workspace instead of the submitting workspace after a workspace switch.",
    "closed_round": 2,
    "correction": "O2 requires an explicit submission-captured workspace key and owning cache for Files actions and createFile, with real-SWR workspace-switch verification. Confirmed by a production SWR probe that the original captured bound callback refreshed B after starting in A.",
    "dependencies": [],
    "disposition": "Fix",
    "id": "I1",
    "witnesses": [
      {
        "index": 1,
        "lens": "correctness",
        "round": 1
      },
      {
        "index": 1,
        "lens": "plan",
        "round": 1
      }
    ]
  },
  {
    "claim": "A pre-mutation native listing can be reused by reconciliation and omit the leftover despite O2's fresh-listing guarantee.",
    "closed_round": 2,
    "correction": "O2 requires retiring or draining old native listing generations for the captured key before post-cleanup reconciliation, using existing ownership capability, with real-SWR pending-old-list and late-resolution coverage. Broader request-sharing behavior remains unchanged.",
    "dependencies": [
      "I1"
    ],
    "disposition": "Fix",
    "id": "I2",
    "witnesses": [
      {
        "index": 2,
        "lens": "plan",
        "round": 1
      }
    ]
  }
]

### lens-chess-semantics-r1.txt

NOT APPLICABLE: O1–O4 concern workspace mutation errors, listing reconciliation and localized cleanup messages. The supplied scope does not change in-memory chess trees, positions or move paths.

VERDICT: APPROVED
### lens-chess-semantics-r3.txt

NOT APPLICABLE: The listed files and O1–O4 obligations concern workspace cleanup errors, listing reconciliation, and localized messages. They do not affect in-memory chess trees, positions, or move paths.
VERDICT: APPROVED
### lens-correctness-r1.txt

[blocker] /tmp/drain-plan-drain-90a2aa88-slot1/build/plan-r1.md:57 — The existing SWR bound `mutate` does not capture the submitting workspace. SWR 2.4.0 implements it using `keyRef.current` (`/home/felixb/Projekte/chessfable/node_modules/swr/dist/index/index.mjs:516–520`). Start a Files mutation in workspace A, switch to B, then receive `operation-and-cleanup`. The prescribed callback refreshes B and leaves A stale, contradicting O2’s captured-workspace contract. Require refresh or invalidation explicitly keyed to the submitting workspace for Files actions too. (confidence: 99)

Limitation: static plan review only. No implementation, tests or browser behavior were executed. (confidence: 100)

VERDICT: REVISE
### lens-correctness-r2.txt

I1 CLOSED — O2 requires the submission-captured workspace key and owning cache for both Files actions and createFile, explicitly rejects bound mutate, and requires real-SWR verification that A’s failure reconciles A without refreshing or populating B.

VERDICT: APPROVED
### lens-correctness-r3.txt

VERDICT: APPROVED
### lens-engine-protocol-r1.txt

NOT APPLICABLE: The plan covers workspace mutation errors, listing refreshes, and localized cleanup messages. It changes no engine process supervision, UCI state machine, or asynchronous engine result routing. Engine controller tests only protect unchanged error-helper consumers.

VERDICT: APPROVED
### lens-engine-protocol-r3.txt

NOT APPLICABLE: The listed files and O1–O4 obligations concern workspace mutation recovery, listing reconciliation and localized errors. They do not change engine supervision, UCI state or asynchronous engine result routing.
VERDICT: APPROVED
### lens-error-handling-r1.txt

No error-handling defects found in O1–O4. The plan preserves the original typed failure, separates reconciliation from success recovery, prohibits mutation retries, and requires truthful localized messages.

Limitation: SWR’s bound-mutate behavior across workspace changes could not be verified because installed dependency source is absent. O2’s captured-workspace regression must prove that boundary (confidence: 100).

VERDICT: APPROVED
### lens-error-handling-r2.txt

VERDICT: APPROVED
### lens-error-handling-r3.txt

VERDICT: APPROVED
### lens-ipc-contract-r1.txt

NOT APPLICABLE: O1–O4 change renderer reconciliation and presentation using the existing typed error category. The plan excludes native IPC, error schemas, generated bindings, events, commands and capability changes.

VERDICT: APPROVED
### lens-ipc-contract-r3.txt

NOT APPLICABLE: O1–O4 change renderer error disposition, cache reconciliation and localized presentation. The complete delta adds refresh provenance only. No Rust–renderer event, command signature, payload schema, capability scope or subscription contract changes are planned.

VERDICT: APPROVED
### lens-minimalism-r1.txt

No bloat or duplication defects found. The shared message selector and listing key have concrete consumers. The reconciliation callback preserves the distinct recovery contracts of existing callers.

Limitation: this reviews the plan only. Implementation-level duplication and deletable code require the eventual diff (confidence: 100).

VERDICT: APPROVED
### lens-minimalism-r2.txt

VERDICT: APPROVED
### lens-minimalism-r3.txt

VERDICT: APPROVED
### lens-persisted-state-r1.txt

NOT APPLICABLE: O1–O4 concern mutation error recovery, captured-workspace listing refresh, localized messages and verification. They do not change persisted storage, atom families, hydration or tab lifecycle.

VERDICT: APPROVED
### lens-persisted-state-r2.txt

NOT APPLICABLE: The revised obligations concern transient workspace listing caches and native request reconciliation. They do not change persisted storage, atom families, hydration, or tab lifecycle.

VERDICT: APPROVED
### lens-persisted-state-r3.txt

NOT APPLICABLE: O1–O4 cover error disposition, transient workspace listing reconciliation and localized messages. They change no persisted storage keys, encodings, hydration, atom families or tab lifecycle. Cleanup reconciliation explicitly forbids creating tabs or adding recents.
VERDICT: APPROVED
### lens-pgn-index-r1.txt

NOT APPLICABLE: O1–O4 cover frontend mutation error handling, workspace refresh and localized cleanup messages. They do not change PGN scanning, indexing, encoding, storage or search semantics.

VERDICT: APPROVED
### lens-pgn-index-r3.txt

NOT APPLICABLE: The listed files and O1–O4 obligations concern frontend workspace cleanup reconciliation and localized errors. They do not change PGN scanning, indexing, encoding, storage, or search.
VERDICT: APPROVED
### lens-plan-r1.txt

[blocker] /tmp/drain-plan-drain-90a2aa88-slot1/build/plan-r1.md:57 — Existing bound `mutate` does not capture the submitting workspace. SWR 2.4.0 reads `keyRef.current` when invoked (`/home/felixb/Projekte/chessfable/node_modules/swr/dist/index/index.mjs:518`), updating that reference on workspace changes at line 563. The callbacks passed at `src/components/files/useFileWorkspace.tsx:140` and `:200` therefore refresh workspace B if A’s mutation rejects after switching to B. This contradicts O2’s captured-workspace contract. Require explicitly captured-key reconciliation for Files actions and a real-SWR workspace-switch regression. (confidence: 99)

[blocker] /tmp/drain-plan-drain-90a2aa88-slot1/build/plan-r1.md:92 — Excluding the listing-freshness gap makes O2’s fresh-data guarantee at line 61 unsatisfiable. The Files fetcher uses `workspaceOwner.run` (`src/components/files/useFileWorkspace.tsx:78`), which returns an existing live promise without starting another listing (`src/hooks/useNativeRequestOwner.ts:116`). If a pre-mutation listing remains pending when cleanup fails, the proposed `mutate()` reconciliation can reuse its old result and leave the leftover invisible. Require a fresh generation at this reconciliation boundary and proof with a pending pre-mutation listing. The existing `supersede` capability provides a local integration option (`src/hooks/useNativeRequestOwner.ts:153`). (confidence: 97)

Limitation: static review only, with no runtime reproduction. Dependency inspection used the main checkout’s SWR 2.4.0, matching this candidate’s lockfile. Review shares the planner’s OpenAI model family. No files changed.

VERDICT: REVISE
### lens-plan-r2.txt

I1 CLOSED — Final candidate r2, tasks/plans/.plan-2026-10-16-workspace-cleanup-failure-r2.body.md:57, requires captured key and owning cache instead of bound mutate. SWR’s explicit mutation path uses those identities, while its bound callback reads keyRef.current. Line 63 requires real-SWR workspace-switch coverage. (confidence: 99)

I2 CLOSED — Final candidate r2, tasks/plans/.plan-2026-10-16-workspace-cleanup-failure-r2.body.md:61, requires retiring or draining old listing generations before reconciliation. src/hooks/useNativeRequestOwner.ts:42 provides cancellation and draining, backed by raced delivery at :138. Plan lines 63 and 110 cover late-result verification and permit exposing that primitive without changing ordinary sharing. (confidence: 98)

VERDICT: APPROVED
### lens-plan-r3.txt

VERDICT: APPROVED
### lens-platform-semantics-r1.txt

No platform-semantics findings. O2 shares a cache key based on opaque workspace handles, avoiding Windows path-spelling comparisons. Cleanup reconciliation does not use filename matching or introduce native filesystem, handle, FFI or `cfg` changes.

Static plan review only. Windows compile checks and the non-Linux Unix source probe were not run and are unnecessary for the frozen renderer-only scope. Native runtime behavior remains provable only through `rust-windows-test`, `rust-macos-test` and relevant `rust-platform` targets. Mocked browser tests establish renderer behavior only.

VERDICT: APPROVED
### lens-platform-semantics-r3.txt

NOT APPLICABLE: O1–O4 change renderer error handling, SWR reconciliation and localized presentation. They introduce no OS-specific path, handle, ABI, filesystem or cfg behavior and preserve native IPC.

VERDICT: APPROVED
### lens-tauri-security-r1.txt

NOT APPLICABLE: The supplied files and O1–O4 obligations concern renderer error handling, workspace listing refresh and localized cleanup messages. They introduce no native credential, filesystem authority, signed-download or sensitive backend-data boundary changes.

VERDICT: APPROVED
### lens-tauri-security-r3.txt

NOT APPLICABLE: The listed files and O1–O4 obligations cover renderer reconciliation and localized workspace messages. They do not change credentials, filesystem authority or mutation, artifact verification, or backend data disclosure.
VERDICT: APPROVED
### lens-tests-r1.txt

VERDICT: APPROVED
### lens-tests-r2.txt

VERDICT: APPROVED
### lens-tests-r3.txt

VERDICT: APPROVED
### plan-r1.md

# Plan: Workspace cleanup failures reconcile without reporting success

## Goal

Close f-20261003-09 by reconciling workspace listings after an operation and its rollback both fail, preserving the original failure and explaining that files or folders may remain. PLAN-ONLY at BASE bda9d31380041a5bff1816e51dc2ac019b9c79c0. No implementation, ledger mutation, browser, server, commit or push in this session.

## MANDATE

### A workspace mutation whose rollback also failed is shown as "please try again" and the file list is not refreshed

* **ID:** f-20261003-09 · **Status:** open · **Area:** frontend-ui · **Root:** - · **Entry:** build · **Blocked:** none
* **Filed from:** b1d90b24-0cf0-4e7d-8d87-ab95faeee372
* **Where:** `src/platform/errors.ts:47` (`"operation-and-cleanup": "unexpected"`), `:282-299` (`runAppliedMutationWithRefresh` refreshes only for `applied-despite-error`), `:301-317` (`runWithAppliedRecovery`, same); callers `src/components/files/FilesPage.tsx:152-176` (create file/folder, rename: any other category shows `operationFailed`, "The file operation could not be completed. Please try again."), `src/utils/files.ts:161-205` (`createFile`, used by `CreateRepertoireModal` and `ImportModal`). BASE `1d0fc9ca`.
* **Defect:** the backend reports `Error::OperationAndCleanup` when a workspace create (sidecar failure today; registration and count failures after `f-20260914-02`) or a rename fails *and* its identity-checked rollback could not remove what it had already placed. The renderer maps that category to `unexpected`, invites a retry, and does not refresh the listing, so a leftover entry stays invisible until some later refresh, and a folder retry collides with the leftover name (`create_dir_at` is exclusive).
* **Why it matters:** `.claude/rules/async-resource-invariants.md` (exit paths reported truthfully, not only produced truthfully); the backend half of the same contract is `f-20260914-02` (`d-20260901-06`, `d-20260906-03`).
* **Open question:** should the shared mutation helpers refresh-and-rethrow on `operation-and-cleanup` (as `runDestructiveWithRefresh` does for applied errors), and should the forms show a message that says cleanup failed rather than "please try again" — within the seven `AppErrorCategory` values (`d-20260901-34`, `d-20260904-06`), so through an existing i18n key or a new message key rather than a new category?
* **Related:** `f-20260914-02` (backend create outcomes; its plan `tasks/plans/2026-10-03-workspace-create-post-commit.md` defers this as plan-review issue I3), `f-20260830-28` (handled; error taxonomy), `d-20260901-34`, `d-20260904-06`.
* **Found by:** Codex `review-error-handling` lens, round 1 of the `f-20260914-02` PLAN-ONLY review, drain session b1d90b24-0cf0-4e7d-8d87-ab95faeee372, 2026-10-03; mapping confirmed by reading `src/platform/errors.ts:47` and `:282-317`.

## Threat model and non-goals

Normal desktop use with native filesystem failures, failed identity-checked compensation, unavailable listing, and component/workspace changes during asynchronous work. Native typed errors are authoritative. A cleanup failure does not prove a particular object exists or that its contents are complete. No adversarial new input model, filesystem authority expansion, mutation retry, repair action, backend rollback redesign, or storage migration. Existing failure classes outside the pinned mandate retain their behavior.

## Traced premises

Frozen Locate at BASE, static source inspection, no runtime claim:

- P1: src/platform/errors.ts:55 maps backend operation-and-cleanup to unexpected. normalizeError at :222 retains backendCategory through TauriCommandError.details, constructed in src/platform/tauri.ts:234.
- P2: src/platform/errors.ts:344 runAppliedMutationWithRefresh refreshes and resolves applied errors. :363 runWithAppliedRecovery may return a recovered object. Neither refreshes cleanup failures.
- P3: src/components/files/useFileWorkspace.tsx:75 owns the SWR listing key and request owner. :138 and :177 pass pure mutate callbacks, followed by success-only dialog closure. Their bare catches at :143 and :203 show Files.OperationFailed.
- P4: src/utils/files.ts:177 uses runWithAppliedRecovery to list parent and find a name. :202 preserves a TauriCommandError as the Result error. The recovery listing does not update the Files SWR cache.
- P5: src/components/tabs/CreateRepertoireModal.tsx:57, src/components/tabs/ImportModal.tsx:125 and :176 are createFile error boundaries. ImportModal:237 uses inline text while mounted and notifyUnlessCancelled after unmount.
- P6: src/utils/engines.ts:166 uses recovery to invoke registerInstalledEngine again. AddDatabase.tsx:70 and AccountCard.tsx:86 use database listing recovery. Broadening their recovery predicate would run callbacks beyond workspace reconciliation.
- P7: runDestructiveWithRefresh callbacks in useFileWorkspace.tsx:485, :508, :525, databaseMutation.ts:101 and Puzzles.tsx:792 publish deletion, trash or selection effects. They cannot be treated as pure refresh callbacks for uncertain cleanup.
- P8: src-tauri/src/file_workspace.rs:1083, :1106, :1132 and :1248 return Error::with_cleanup after create rollback fails. src-tauri/src/error.rs:509 preserves the category and :541 carries diagnostic causes only in native state. :514 also assigns engine failures with cleanup the same category.
- P9: src/platform/errors.test.ts:476 and :593 pin applied recovery. FilesPage.test.tsx:556 pins existing applied create closure. src/utils/files.test.ts:153 and the repertoire/import test suites cover create paths without cleanup regressions.
- P10: tasks/handoffs/2026-10-06-f-20260914-02-review.md records the backend create decision and deferred renderer presentation. Read its relevant inherited context before implementation. Its native I1/I2 remain closed and are not this plan's issue IDs.
- P11: e2e/async-errors.spec.ts and e2e/fixtures.ts already supply typed errors, Files commands, listing state and screenshot helpers. playwright.config.ts names async-errors and workspace-tabs projects.
- P12: Locate probes probe-1-r1 and probe-2-r1 confirmed the complete 11-call-site helper inventory and preservation of backendCategory through Result. Reports are retained under /tmp/drain-plan-drain-90a2aa88-slot1/build. No tests, browser or native app were run.

## Approach

### O1 — Distinguish reconciliation from applied recovery

Use the retained backendCategory to identify operation-and-cleanup, including a wrapped TauriCommandError. Keep its AppErrorCategory unexpected and keep the seven-value mapping exhaustive.

runAppliedMutationWithRefresh performs its existing pure refresh on this failure, then rejects with the original cause. A refresh rejection must not replace that cause. Existing success, ordinary failure and applied-despite-error contracts remain intact.

runWithAppliedRecovery gains an explicit, optional reconciliation-only callback for the cleanup case. Only a workspace creator that supplies it receives this behavior. Never invoke its recovered-value callback for cleanup failure, never use a reconciliation return value as success, and always rethrow the original cause even when reconciliation fails. Existing callers without this callback retain their behavior. Share cleanup classification and preservation logic where both helpers implement the same concept.

Do not change runDestructiveWithRefresh or its side-effectful callbacks. A cleanup category alone is insufficient authority to publish deletion, successful engine registration, conversion, selection clearing or undo removal.

Verification level: helper unit tests assert the original rejection survives successful and failed reconciliation, cleanup never becomes a recovered result, and all existing applied/ordinary behavior remains green. Negative coverage protects the engine and database callers from executing recovery on cleanup.

### O2 — Reconcile the workspace that actually failed

Files actions use the existing bound mutate for their captured listing. createFile supplies O1's separate cleanup callback, reconciles the native listing and invalidates the Files listing for the workspace passed into that create. Share the canonical workspace SWR key between its reader and invalidator rather than copying the domain key expression. Reconciliation must not select or open a matching leftover entry, add recents, create a tab, navigate, close the form, or issue the mutation again.

An inactive listing must load fresh on next mount, while an active listing must revalidate. Invalidation and any returned data belong to the captured workspace, never whatever workspace is current after the await. Preserve the Result error and its typed details through createFile. Bound work to one reconciliation attempt, no automatic mutation retry. Reconciliation failure leaves the original cleanup failure available to the form and does not claim that refresh succeeded.

Verification level: utility and component integration tests exercise retained leftovers and refresh failure. Assert that the active Files tree consumes fresh data or the inactive key is invalidated for its next load, the original typed error remains an error, and success continuations are absent. Include a workspace change while reconciliation is pending so results cannot populate the new root.

### O3 — One localized workspace cleanup message

Use one shared workspace error-message selector across useFileWorkspace's action and move catches, CreateRepertoireModal, both ImportModal create branches, and the post-unmount import notification path. Select by typed backend category, without matching backend English text or changing the general notification taxonomy. Keep unrelated errors on their current fallbacks.

For workspace operation-and-cleanup, display this localized meaning: "The file operation failed, and cleanup also failed. Files or folders may remain. Check the collection before trying again." Do not promise refresh success, completed creation, intact data, or that retry is safe. Preserve the form and entered values on the failure. Use a literal i18next key with translations in every shipped catalogue, run pnpm i18n:extract, and avoid an eighth category or raw diagnostic display.

Verification level: component tests assert visible cleanup-specific copy and absence of generic retry copy across Files create file/folder, rename, metadata edit and move, repertoire creation, saved-file import and pasted-PGN import, including notification after unmount. Catalogue tests with fallback disabled prove the key exists and conveys cleanup in all shipped locales after extraction. No unrelated dialog redesign.

### O4 — Prove reconciliation and presentation together

Extend the existing async-errors Playwright journey with a typed cleanup failure and a subsequently changed listing. Assert the leftover is visible, failure remains visible, entered values remain, and no automatic second mutation occurs. Include a failed relist case that still shows cleanup-specific text without promising listing success. Capture the new error state at 320px with 200% font scale in English and German and inspect screenshots for readable, reachable copy and no overflow. Use existing fixtures and container snapshot route.

Keep the established unit and component tests executing the real helpers rather than mocking the behavior under test. Demonstrate red/green by reverting only the implementing fix while retaining the regression tests, through the policy's scoped Git route. The cleanup rejection assertion and visible-message/listing assertion must each fail for their corresponding reverted behavior.

## Decisions and trade-offs

Decided autonomously under full auto, to be recorded by the adopting session before implementation:

- Cleanup failure uses reconciliation-only then original rejection. Rejected treating it as applied-despite-error, since an incomplete leftover is not a successful create. d-20261006-05 keeps compensation and explicitly distinguishes ordinary rollback from committed uncertainty. Reverse only with a reviewed richer operation outcome and evidence that consumers can safely recover the object.
- Keep backendCategory as the discriminator and add a localized workspace message. Rejected an eighth UI category or global normalization message rewrite. d-20260904-06 fixes the two-level taxonomy, superseding d-20260901-34. d-20260831-01 fixes the applied category name.
- Use an explicit cleanup callback in the recovery helper. Rejected invoking the existing recover callback because registerInstalledEngine performs a second command. Rejected globally broadening destructive callbacks because they publish success-side effects. Reversal requires pure, documented callbacks at every affected caller.
- Canonicalize the existing workspace cache key only where O2 needs both a reader and invalidator. No new job registry, retry service, tool, gate or dependency. The new key-sharing code can be removed with these two consumers if their cache integration is replaced.
- This remains build tier: the open question involves failure versus success recovery and cache/form integration across distinct callers. Existing decisions settle taxonomy and backend compensation, but do not settle this renderer reconciliation contract.

Plan authorship and arbitration share the root context. Detection runs in fresh Codex leaves on the same OpenAI model family as the code. No family separation is claimed.

## Risks / open questions

- Listings can fail because a leftover is invalid or unreadable. The original cleanup warning remains truthful and no success is inferred. Per-child listing behavior is the separate f-20261003-08 design.
- f-20261004-09 records that request-owner deduplication can rejoin a pre-mutation listing. This plan uses the existing refresh boundary and does not promise a new mutation/list serialization protocol. Preserve and report this known limit in diff review.
- f-20261005-04 owns other category-specific Files errors and f-20261006-07 owns durability warnings. Their separate open questions remain outside this pinned cleanup correction.
- No novel product decision is required: the finding explicitly requests truthful cleanup copy and reconciliation. The proposed text implements that requirement without a new action or product promise.
- Planning uses only static evidence. Browser pixels and behavioral tests are obligations for the adopter, not proof claimed by this run.

## Not part of this task

Backend rollback, registry authority, error payload/schema changes, generated bindings, destructive success effects, engine recovery, database conversion, generic error-taxonomy redesign, sibling findings or co-located joiners. PLAN-ONLY does not plan f-20261007-03, f-20261011-08 or f-20261013-01.

## Phases

### Phase 1 — Workspace cleanup reconciliation and its user-facing boundaries

One cohesive phase, because helper semantics, cache invalidation and form presentation must land together. The only dependency order within the phase is the shared failure contract before its callers. No independent second implementation phase.

Owned source scopes: src/platform/errors.ts, src/utils/files.ts, src/components/files/useFileWorkspace.tsx, src/components/tabs/CreateRepertoireModal.tsx, src/components/tabs/ImportModal.tsx. Shared workspace error-message and listing-key units may be placed in src/components/files/ or src/utils/ following existing module ownership. Their responsibility is limited to O2/O3.

Owned proof scopes: src/platform/errors.test.ts, src/utils/files.test.ts, src/components/files/FilesPage.test.tsx, corresponding new shared-unit tests if needed, src/components/tabs/CreateRepertoireModal.test.tsx, src/components/tabs/ImportModal.test.tsx, e2e/async-errors.spec.ts and its intended new screenshots. e2e/fixtures.ts may change only if its existing scenario support cannot express the failure and relist. src/translation/*.json and src/i18n.test.ts cover the literal key and every catalogue, using src/tests/catalogues.ts. Regression-only changes to src/utils/engines.controller.test.ts, AddDatabase.test.tsx and AccountCard.test.tsx may protect unchanged O1 consumers.

Executor: one selected Codex write leaf, role sensitive because src/components/tabs/** reaches persisted tab lifecycle and the change controls failure continuations. Resolve model and effort through leaf.codex.write.sensitive, currently gpt-6.1-sol/high. Root owns integration, review arbitration and gates. Leaves never stage or commit.

PROOF COMMAND: `pnpm exec vitest run src/platform/errors.test.ts src/utils/files.test.ts src/components/files/FilesPage.test.tsx src/components/tabs/CreateRepertoireModal.test.tsx src/components/tabs/ImportModal.test.tsx src/i18n.test.ts src/utils/engines.controller.test.ts src/components/databases/AddDatabase.test.tsx src/components/home/AccountCard.test.tsx && pnpm exec vitest related --run src/platform/errors.ts src/utils/files.ts src/components/files/useFileWorkspace.tsx src/components/tabs/CreateRepertoireModal.tsx src/components/tabs/ImportModal.tsx && pnpm checks:pre-review`

Before phase proof, run pnpm i18n:extract, then verify added shared modules through their importer tests. Prove O4's fix-revert red/green before the phase commit. Do not modify coverage floors or baselines.

After implementation and cumulative diff review, browser verification runs `pnpm test:e2e:container --project=async-errors --project=workspace-tabs`. Read all changed screenshot diffs, update only intentional new cleanup captures through `pnpm test:e2e:update`, and inspect the resulting images. No native GTK change is planned. This is a renderer error-disposition change with unchanged native IPC, so mocked typed rejection exercises it. If implementation introduces a native-only behavior claim, require `pnpm build` and `pnpm verify:app` for that claim.

Final affected gates: `pnpm gates:push -- --frontend`, including the unconditional contract lane, frontend coverage/mutation/build/bundle and container e2e. Use .agents/skills/push/SKILL.md and its canonical project skill for release. No Rust or bindings block is required unless implementation scope changes, which returns to review. Adopter records decisions, closes the finding through findings.py after proof, commits the durable review handoff, and follows the normal verified push route. This planner stops before Preflight.

### plan-r2.md

# Plan: Workspace cleanup failures reconcile without reporting success

## Goal

Close f-20261003-09 by reconciling workspace listings after an operation and its rollback both fail, preserving the original failure and explaining that files or folders may remain. PLAN-ONLY at BASE bda9d31380041a5bff1816e51dc2ac019b9c79c0. No implementation, ledger mutation, browser, server, commit or push in this session.

## MANDATE

### A workspace mutation whose rollback also failed is shown as "please try again" and the file list is not refreshed

* **ID:** f-20261003-09 · **Status:** open · **Area:** frontend-ui · **Root:** - · **Entry:** build · **Blocked:** none
* **Filed from:** b1d90b24-0cf0-4e7d-8d87-ab95faeee372
* **Where:** `src/platform/errors.ts:47` (`"operation-and-cleanup": "unexpected"`), `:282-299` (`runAppliedMutationWithRefresh` refreshes only for `applied-despite-error`), `:301-317` (`runWithAppliedRecovery`, same); callers `src/components/files/FilesPage.tsx:152-176` (create file/folder, rename: any other category shows `operationFailed`, "The file operation could not be completed. Please try again."), `src/utils/files.ts:161-205` (`createFile`, used by `CreateRepertoireModal` and `ImportModal`). BASE `1d0fc9ca`.
* **Defect:** the backend reports `Error::OperationAndCleanup` when a workspace create (sidecar failure today; registration and count failures after `f-20260914-02`) or a rename fails *and* its identity-checked rollback could not remove what it had already placed. The renderer maps that category to `unexpected`, invites a retry, and does not refresh the listing, so a leftover entry stays invisible until some later refresh, and a folder retry collides with the leftover name (`create_dir_at` is exclusive).
* **Why it matters:** `.claude/rules/async-resource-invariants.md` (exit paths reported truthfully, not only produced truthfully); the backend half of the same contract is `f-20260914-02` (`d-20260901-06`, `d-20260906-03`).
* **Open question:** should the shared mutation helpers refresh-and-rethrow on `operation-and-cleanup` (as `runDestructiveWithRefresh` does for applied errors), and should the forms show a message that says cleanup failed rather than "please try again" — within the seven `AppErrorCategory` values (`d-20260901-34`, `d-20260904-06`), so through an existing i18n key or a new message key rather than a new category?
* **Related:** `f-20260914-02` (backend create outcomes; its plan `tasks/plans/2026-10-03-workspace-create-post-commit.md` defers this as plan-review issue I3), `f-20260830-28` (handled; error taxonomy), `d-20260901-34`, `d-20260904-06`.
* **Found by:** Codex `review-error-handling` lens, round 1 of the `f-20260914-02` PLAN-ONLY review, drain session b1d90b24-0cf0-4e7d-8d87-ab95faeee372, 2026-10-03; mapping confirmed by reading `src/platform/errors.ts:47` and `:282-317`.

## Threat model and non-goals

Normal desktop use with native filesystem failures, failed identity-checked compensation, unavailable listing, and component/workspace changes during asynchronous work. Native typed errors are authoritative. A cleanup failure does not prove a particular object exists or that its contents are complete. No adversarial new input model, filesystem authority expansion, mutation retry, repair action, backend rollback redesign, or storage migration. Existing failure classes outside the pinned mandate retain their behavior.

## Traced premises

Frozen Locate at BASE, static source inspection, no runtime claim:

- P1: src/platform/errors.ts:55 maps backend operation-and-cleanup to unexpected. normalizeError at :222 retains backendCategory through TauriCommandError.details, constructed in src/platform/tauri.ts:234.
- P2: src/platform/errors.ts:344 runAppliedMutationWithRefresh refreshes and resolves applied errors. :363 runWithAppliedRecovery may return a recovered object. Neither refreshes cleanup failures.
- P3: src/components/files/useFileWorkspace.tsx:75 owns the SWR listing key and request owner. :138 and :177 pass pure mutate callbacks, followed by success-only dialog closure. Their bare catches at :143 and :203 show Files.OperationFailed.
- P4: src/utils/files.ts:177 uses runWithAppliedRecovery to list parent and find a name. :202 preserves a TauriCommandError as the Result error. The recovery listing does not update the Files SWR cache.
- P5: src/components/tabs/CreateRepertoireModal.tsx:57, src/components/tabs/ImportModal.tsx:125 and :176 are createFile error boundaries. ImportModal:237 uses inline text while mounted and notifyUnlessCancelled after unmount.
- P6: src/utils/engines.ts:166 uses recovery to invoke registerInstalledEngine again. AddDatabase.tsx:70 and AccountCard.tsx:86 use database listing recovery. Broadening their recovery predicate would run callbacks beyond workspace reconciliation.
- P7: runDestructiveWithRefresh callbacks in useFileWorkspace.tsx:485, :508, :525, databaseMutation.ts:101 and Puzzles.tsx:792 publish deletion, trash or selection effects. They cannot be treated as pure refresh callbacks for uncertain cleanup.
- P8: src-tauri/src/file_workspace.rs:1083, :1106, :1132 and :1248 return Error::with_cleanup after create rollback fails. src-tauri/src/error.rs:509 preserves the category and :541 carries diagnostic causes only in native state. :514 also assigns engine failures with cleanup the same category.
- P9: src/platform/errors.test.ts:476 and :593 pin applied recovery. FilesPage.test.tsx:556 pins existing applied create closure. src/utils/files.test.ts:153 and the repertoire/import test suites cover create paths without cleanup regressions.
- P10: tasks/handoffs/2026-10-06-f-20260914-02-review.md records the backend create decision and deferred renderer presentation. Read its relevant inherited context before implementation. Its native I1/I2 remain closed and are not this plan's issue IDs.
- P11: e2e/async-errors.spec.ts and e2e/fixtures.ts already supply typed errors, Files commands, listing state and screenshot helpers. playwright.config.ts names async-errors and workspace-tabs projects.
- P12: Locate probes probe-1-r1 and probe-2-r1 confirmed the complete 11-call-site helper inventory and preservation of backendCategory through Result. Reports are retained under /tmp/drain-plan-drain-90a2aa88-slot1/build. No tests, browser or native app were run.

## Approach

### O1 — Distinguish reconciliation from applied recovery

Use the retained backendCategory to identify operation-and-cleanup, including a wrapped TauriCommandError. Keep its AppErrorCategory unexpected and keep the seven-value mapping exhaustive.

runAppliedMutationWithRefresh performs its existing pure refresh on this failure, then rejects with the original cause. A refresh rejection must not replace that cause. Existing success, ordinary failure and applied-despite-error contracts remain intact.

runWithAppliedRecovery gains an explicit, optional reconciliation-only callback for the cleanup case. Only a workspace creator that supplies it receives this behavior. Never invoke its recovered-value callback for cleanup failure, never use a reconciliation return value as success, and always rethrow the original cause even when reconciliation fails. Existing callers without this callback retain their behavior. Share cleanup classification and preservation logic where both helpers implement the same concept.

Do not change runDestructiveWithRefresh or its side-effectful callbacks. A cleanup category alone is insufficient authority to publish deletion, successful engine registration, conversion, selection clearing or undo removal.

Verification level: helper unit tests assert the original rejection survives successful and failed reconciliation, cleanup never becomes a recovered result, and all existing applied/ordinary behavior remains green. Negative coverage protects the engine and database callers from executing recovery on cleanup.

### O2 — Reconcile the workspace that actually failed

Files actions and createFile reconcile using an explicit workspace key captured at submission and the cache that owns that listing. The SWR bound mutate follows the current key and must not serve as the captured-workspace callback. createFile supplies O1's separate cleanup callback, reconciles the native listing and invalidates the Files listing for the workspace passed into that create. Share the canonical workspace SWR key between its reader and invalidator rather than copying the domain key expression. Reconciliation must not select or open a matching leftover entry, add recents, create a tab, navigate, close the form, or issue the mutation again.

An inactive listing must load fresh on next mount, while an active listing must revalidate. Invalidation and any returned data belong to the captured workspace, never whatever workspace is current after the await. Preserve the Result error and its typed details through createFile. Bound work to one reconciliation attempt, no automatic mutation retry. Reconciliation failure leaves the original cleanup failure available to the form and does not claim that refresh succeeded.

Before this post-cleanup reconciliation begins, retire or drain any pre-mutation native listing generation for that captured key so it cannot supply or overwrite the reconciliation result. Reuse the existing native request owner's supersession/drain capabilities, exposing its existing primitive to the shared reconciliation boundary if needed. Do not change ordinary request sharing or add a registry or global mutation serialization protocol. The correction is limited to the workspace cleanup reconciliation this mandate requires.

Verification level: utility and component integration tests exercise retained leftovers and refresh failure. Use real SWR for cache ownership tests, not a mocked mutate. Assert that the active Files tree consumes fresh data or the inactive key is invalidated for its next load, the original typed error remains an error, and success continuations are absent. Include a workspace change while reconciliation is pending so A's failure reconciles A without refreshing or populating B. Include a still-pending pre-mutation listing, cleanup rejection, fresh relist containing the leftover, and late old-list resolution. The old result must neither satisfy reconciliation nor overwrite the fresh result. Native request-owner tests protect unchanged sharing and cancellation behavior if its primitive is exposed.

### O3 — One localized workspace cleanup message

Use one shared workspace error-message selector across useFileWorkspace's action and move catches, CreateRepertoireModal, both ImportModal create branches, and the post-unmount import notification path. Select by typed backend category, without matching backend English text or changing the general notification taxonomy. Keep unrelated errors on their current fallbacks.

For workspace operation-and-cleanup, display this localized meaning: "The file operation failed, and cleanup also failed. Files or folders may remain. Check the collection before trying again." Do not promise refresh success, completed creation, intact data, or that retry is safe. Preserve the form and entered values on the failure. Use a literal i18next key with translations in every shipped catalogue, run pnpm i18n:extract, and avoid an eighth category or raw diagnostic display.

Verification level: component tests assert visible cleanup-specific copy and absence of generic retry copy across Files create file/folder, rename, metadata edit and move, repertoire creation, saved-file import and pasted-PGN import, including notification after unmount. Catalogue tests with fallback disabled prove the key exists and conveys cleanup in all shipped locales after extraction. No unrelated dialog redesign.

### O4 — Prove reconciliation and presentation together

Extend the existing async-errors Playwright journey with a typed cleanup failure and a subsequently changed listing. Assert the leftover is visible, failure remains visible, entered values remain, and no automatic second mutation occurs. Include a failed relist case that still shows cleanup-specific text without promising listing success. Capture the new error state at 320px with 200% font scale in English and German and inspect screenshots for readable, reachable copy and no overflow. Use existing fixtures and container snapshot route.

Keep the established unit and component tests executing the real helpers rather than mocking the behavior under test. Demonstrate red/green by reverting only the implementing fix while retaining the regression tests, through the policy's scoped Git route. The cleanup rejection assertion and visible-message/listing assertion must each fail for their corresponding reverted behavior.

## Decisions and trade-offs

Decided autonomously under full auto, to be recorded by the adopting session before implementation:

- Cleanup failure uses reconciliation-only then original rejection. Rejected treating it as applied-despite-error, since an incomplete leftover is not a successful create. d-20261006-05 keeps compensation and explicitly distinguishes ordinary rollback from committed uncertainty. Reverse only with a reviewed richer operation outcome and evidence that consumers can safely recover the object.
- Keep backendCategory as the discriminator and add a localized workspace message. Rejected an eighth UI category or global normalization message rewrite. d-20260904-06 fixes the two-level taxonomy, superseding d-20260901-34. d-20260831-01 fixes the applied category name.
- Use an explicit cleanup callback in the recovery helper. Rejected invoking the existing recover callback because registerInstalledEngine performs a second command. Rejected globally broadening destructive callbacks because they publish success-side effects. Reversal requires pure, documented callbacks at every affected caller.
- Canonicalize the existing workspace cache key only where O2 needs both a reader and invalidator. No new job registry, retry service, tool, gate or dependency. The new key-sharing code can be removed with these two consumers if their cache integration is replaced.
- Capture the listing key and cache explicitly, and retire or drain pre-mutation listing work at the cleanup reconciliation boundary. Rejected relying on bound mutate or a shared live generation. Review issue I1 has a measured workspace-switch counterexample, and I2 has a direct source trace through useNativeRequestOwner.run. Reversal requires a replacement cache/request API that guarantees both ownership and post-mutation freshness. The broader f-20261004-09 stays open for unrelated consumers.
- This remains build tier: the open question involves failure versus success recovery and cache/form integration across distinct callers. Existing decisions settle taxonomy and backend compensation, but do not settle this renderer reconciliation contract.

Plan authorship and arbitration share the root context. Detection runs in fresh Codex leaves on the same OpenAI model family as the code. No family separation is claimed.

## Risks / open questions

- Listings can fail because a leftover is invalid or unreadable. The original cleanup warning remains truthful and no success is inferred. Per-child listing behavior is the separate f-20261003-08 design.
- f-20261004-09 records that request-owner deduplication can rejoin a pre-mutation listing. O2 closes that gap at this cleanup reconciliation boundary only, using the existing ownership primitive. Other mutation consumers remain the sibling's separate design scope.
- f-20261005-04 owns other category-specific Files errors and f-20261006-07 owns durability warnings. Their separate open questions remain outside this pinned cleanup correction.
- No novel product decision is required: the finding explicitly requests truthful cleanup copy and reconciliation. The proposed text implements that requirement without a new action or product promise.
- Planning uses only static evidence. Browser pixels and behavioral tests are obligations for the adopter, not proof claimed by this run.

## Not part of this task

Backend rollback, registry authority, error payload/schema changes, generated bindings, destructive success effects, engine recovery, database conversion, generic error-taxonomy redesign, sibling findings or co-located joiners. PLAN-ONLY does not plan f-20261007-03, f-20261011-08 or f-20261013-01.

## Phases

### Phase 1 — Workspace cleanup reconciliation and its user-facing boundaries

One cohesive phase, because helper semantics, cache invalidation and form presentation must land together. The only dependency order within the phase is the shared failure contract before its callers. No independent second implementation phase.

Owned source scopes: src/platform/errors.ts, src/utils/files.ts, src/components/files/useFileWorkspace.tsx, src/components/tabs/CreateRepertoireModal.tsx, src/components/tabs/ImportModal.tsx. Shared workspace error-message, listing-key and reconciliation units may be placed in src/components/files/, src/utils/ or src/hooks/ following existing ownership. src/hooks/useNativeRequestOwner.ts may expose its existing supersession primitive for captured-key reconciliation, routing its own use through that same primitive. Its ordinary sharing and lifecycle behavior must not change. src/components/files/notifyError.ts may route its files-domain notification through the shared O3 selector. These responsibilities are limited to O2/O3.

Owned proof scopes: src/platform/errors.test.ts, src/utils/files.test.ts, src/components/files/FilesPage.test.tsx, new shared-unit and real-SWR reconciliation integration tests, src/hooks/useNativeRequestOwner.test.tsx, src/components/files/notifyError.test.ts, src/components/tabs/CreateRepertoireModal.test.tsx, src/components/tabs/ImportModal.test.tsx, e2e/async-errors.spec.ts and its intended new screenshots. e2e/fixtures.ts may change only if its existing scenario support cannot express the failure and relist. src/translation/*.json and the shared message selector's test cover the literal key and every catalogue using src/tests/catalogues.ts with real i18next and fallback disabled. Avoid the mocked i18next in src/i18n.test.ts for that assertion. Regression-only changes to src/utils/engines.controller.test.ts, AddDatabase.test.tsx and AccountCard.test.tsx may protect unchanged O1 consumers.

Executor: one selected Codex write leaf, role sensitive because src/components/tabs/** reaches persisted tab lifecycle and the change controls failure continuations. Resolve model and effort through leaf.codex.write.sensitive, currently gpt-6.1-sol/high. Root owns integration, review arbitration and gates. Leaves never stage or commit.

PROOF COMMAND: `pnpm exec vitest run src/platform/errors.test.ts src/utils/files.test.ts src/components/files/ src/hooks/useNativeRequestOwner.test.tsx src/components/tabs/CreateRepertoireModal.test.tsx src/components/tabs/ImportModal.test.tsx src/utils/engines.controller.test.ts src/components/databases/AddDatabase.test.tsx src/components/home/AccountCard.test.tsx && pnpm exec vitest related --run src/platform/errors.ts src/utils/files.ts src/hooks/useNativeRequestOwner.ts src/components/files/useFileWorkspace.tsx src/components/tabs/CreateRepertoireModal.tsx src/components/tabs/ImportModal.tsx && pnpm checks:pre-review`

Before phase proof, run pnpm i18n:extract, then verify added shared modules through their importer tests. Prove O4's fix-revert red/green before the phase commit. Do not modify coverage floors or baselines.

After implementation and cumulative diff review, browser verification runs `pnpm test:e2e:container --project=async-errors --project=workspace-tabs`. Read all changed screenshot diffs, update only intentional new cleanup captures through `pnpm test:e2e:update`, and inspect the resulting images. No native GTK change is planned. This is a renderer error-disposition change with unchanged native IPC, so mocked typed rejection exercises it. If implementation introduces a native-only behavior claim, require `pnpm build` and `pnpm verify:app` for that claim.

Final affected gates: `pnpm gates:push -- --frontend`, including the unconditional contract lane, frontend coverage/mutation/build/bundle and container e2e. Use .agents/skills/push/SKILL.md and its canonical project skill for release. No Rust or bindings block is required unless implementation scope changes, which returns to review. Adopter records decisions, closes the finding through findings.py after proof, commits the durable review handoff, and follows the normal verified push route. This planner stops before Preflight.

## Reviews

### Round 1 — plan-r1, 12 plan-capable lenses

Every user-wide and project plan-capable lens ran through leaf-launch.sh. review-code-quality and review-root-cause declare plan-review false and were excluded. All detected on Codex gpt-6.1-sol, plan at high and the other lenses at medium. Plan authorship and arbitration share this root context, and detection uses the same OpenAI family as the code.

Raw verdicts: correctness REVISE (one blocker), plan REVISE (two blockers). Tests, minimalism, error-handling and platform-semantics APPROVED with no findings. Chess-semantics, engine-protocol, ipc-contract, persisted-state, pgn-index and tauri-security returned NOT APPLICABLE with APPROVED. Their reasons fit the frozen renderer error-disposition scope. Platform reviewed opaque-handle/cache behavior without a native platform claim. Error-handling reported absent dependency source locally as a limitation. The main checkout's matching SWR dependency was available to the arbiter and other lenses.

#### I1 — Bound mutate refreshes the new workspace

- Claim: callbacks captured in A refresh B if the workspace switches before A's cleanup failure settles. O2's bound-mutate instruction contradicts its captured-workspace requirement.
- Witnesses: correctness r1 finding 1, confidence 99, blocker. Plan r1 finding 1, confidence 99, blocker.
- Evidence: SWR 2.4.0 dist/index/index.mjs:518 reads keyRef.current. Real SWR plus React/JSDOM probe at /tmp/drain-plan-drain-90a2aa88-slot1/build/probe-bound-mutate.mjs exited 0 and printed {"callbackCapturedIn":"A","currentWorkspace":"B","refreshed":["B"]}. This uses the installed production package, not a reconstruction. useFileWorkspace.tsx:138 and :177 pass bound mutate today.
- MANDATE: "the file list is not refreshed" and "a leftover entry stays invisible until some later refresh", with the frozen workspace-change threat model.
- Disposition: Fix. O2 now requires explicit key and owning-cache capture for Files actions as well as createFile, and a real-SWR A-to-B regression that cannot pass by mocking mutate.
- Authority: the existing O2 ownership promise was impossible with its specified callback. No new product behavior or independent mechanism is authorized.
- Dependencies: none. Status: open for round 2 closure against the revised O2.

#### I2 — A pre-mutation native listing can satisfy reconciliation

- Claim: O2 promises fresh data while Risks excludes the request-sharing gap. A pending pre-mutation listing is reused and may omit the leftover.
- Witness: plan r1 finding 2, confidence 97, blocker.
- Evidence: useFileWorkspace.tsx:78 calls workspaceOwner.run. useNativeRequestOwner.ts:116 returns a live current.promise without calling the new request. :153 already supplies supersede, which aborts the SWR-facing delivery through supersedeRequest's raced cancellation. This is the same production path identified by f-20261004-09, not an invented new race.
- MANDATE: "the file list is not refreshed" and "a leftover entry stays invisible until some later refresh". Leaving a pre-mutation result eligible does not meet that obligation.
- Disposition: Fix. O2 must retire or drain the captured key's old generation before post-cleanup reconciliation, using the existing ownership capability. Its real-SWR test keeps the old listing pending and resolves it late, proving a fresh leftover listing survives. Scope now permits exposing the existing primitive and protecting its unchanged lifecycle tests. Other consumers remain with f-20261004-09.
- Authority: MANDATE's required listing refresh and frozen asynchronous-operation threat model authorize this local integration. No new registry or global mutation serialization protocol is added.
- Dependencies: I1's captured key. Status: open for round 2 closure.

Root corrections accompanying r2: the notification path is now explicitly listed in owned scopes so O3 can reach an unmounted import. Catalogue proof belongs in the shared message selector test with real i18next, because src/i18n.test.ts mocks it. Neither changes the O3 behavioral contract.

Round 1 totals: 2 unique issues, 3 raw Fix adoptions, 0 Skip, 0 Defer, no withdrawals or carried items. No quota or external dependency wait occurred. Active wall is not separately measured.

### plan-r3.md

# Plan: Workspace cleanup failures reconcile without reporting success

## Goal

Close f-20261003-09 by reconciling workspace listings after an operation and its rollback both fail, preserving the original failure and explaining that files or folders may remain. Originally planned at BASE bda9d31380041a5bff1816e51dc2ac019b9c79c0. This PLAN-REFRESH reviews that plan at NEW-BASE 13c0870391455518f503044c91c996cd5430fd8e. No implementation, ledger mutation, browser, server, commit or push in this session.

## MANDATE

### A workspace mutation whose rollback also failed is shown as "please try again" and the file list is not refreshed

* **ID:** f-20261003-09 · **Status:** open · **Area:** frontend-ui · **Root:** - · **Entry:** build · **Blocked:** none
* **Filed from:** b1d90b24-0cf0-4e7d-8d87-ab95faeee372
* **Where:** `src/platform/errors.ts:47` (`"operation-and-cleanup": "unexpected"`), `:282-299` (`runAppliedMutationWithRefresh` refreshes only for `applied-despite-error`), `:301-317` (`runWithAppliedRecovery`, same); callers `src/components/files/FilesPage.tsx:152-176` (create file/folder, rename: any other category shows `operationFailed`, "The file operation could not be completed. Please try again."), `src/utils/files.ts:161-205` (`createFile`, used by `CreateRepertoireModal` and `ImportModal`). BASE `1d0fc9ca`.
* **Defect:** the backend reports `Error::OperationAndCleanup` when a workspace create (sidecar failure today; registration and count failures after `f-20260914-02`) or a rename fails *and* its identity-checked rollback could not remove what it had already placed. The renderer maps that category to `unexpected`, invites a retry, and does not refresh the listing, so a leftover entry stays invisible until some later refresh, and a folder retry collides with the leftover name (`create_dir_at` is exclusive).
* **Why it matters:** `.claude/rules/async-resource-invariants.md` (exit paths reported truthfully, not only produced truthfully); the backend half of the same contract is `f-20260914-02` (`d-20260901-06`, `d-20260906-03`).
* **Open question:** should the shared mutation helpers refresh-and-rethrow on `operation-and-cleanup` (as `runDestructiveWithRefresh` does for applied errors), and should the forms show a message that says cleanup failed rather than "please try again" — within the seven `AppErrorCategory` values (`d-20260901-34`, `d-20260904-06`), so through an existing i18n key or a new message key rather than a new category?
* **Related:** `f-20260914-02` (backend create outcomes; its plan `tasks/plans/2026-10-03-workspace-create-post-commit.md` defers this as plan-review issue I3), `f-20260830-28` (handled; error taxonomy), `d-20260901-34`, `d-20260904-06`.
* **Found by:** Codex `review-error-handling` lens, round 1 of the `f-20260914-02` PLAN-ONLY review, drain session b1d90b24-0cf0-4e7d-8d87-ab95faeee372, 2026-10-03; mapping confirmed by reading `src/platform/errors.ts:47` and `:282-317`.

## Threat model and non-goals

Normal desktop use with native filesystem failures, failed identity-checked compensation, unavailable listing, and component/workspace changes during asynchronous work. Native typed errors are authoritative. A cleanup failure does not prove a particular object exists or that its contents are complete. No adversarial new input model, filesystem authority expansion, mutation retry, repair action, backend rollback redesign, or storage migration. Existing failure classes outside the pinned mandate retain their behavior.

## Traced premises

Frozen Locate at BASE, static source inspection, no runtime claim:

- P1: src/platform/errors.ts:55 maps backend operation-and-cleanup to unexpected. normalizeError at :222 retains backendCategory through TauriCommandError.details, constructed in src/platform/tauri.ts:234.
- P2: src/platform/errors.ts:344 runAppliedMutationWithRefresh refreshes and resolves applied errors. :363 runWithAppliedRecovery may return a recovered object. Neither refreshes cleanup failures.
- P3: src/components/files/useFileWorkspace.tsx:75 owns the SWR listing key and request owner. :138 and :177 pass pure mutate callbacks, followed by success-only dialog closure. Their bare catches at :143 and :203 show Files.OperationFailed.
- P4: src/utils/files.ts:177 uses runWithAppliedRecovery to list parent and find a name. :202 preserves a TauriCommandError as the Result error. The recovery listing does not update the Files SWR cache.
- P5: src/components/tabs/CreateRepertoireModal.tsx:57, src/components/tabs/ImportModal.tsx:125 and :176 are createFile error boundaries. ImportModal:237 uses inline text while mounted and notifyUnlessCancelled after unmount.
- P6: src/utils/engines.ts:166 uses recovery to invoke registerInstalledEngine again. AddDatabase.tsx:70 and AccountCard.tsx:86 use database listing recovery. Broadening their recovery predicate would run callbacks beyond workspace reconciliation.
- P7: runDestructiveWithRefresh callbacks in useFileWorkspace.tsx:485, :508, :525, databaseMutation.ts:101 and Puzzles.tsx:792 publish deletion, trash or selection effects. They cannot be treated as pure refresh callbacks for uncertain cleanup.
- P8: src-tauri/src/file_workspace.rs:1083, :1106, :1132 and :1248 return Error::with_cleanup after create rollback fails. src-tauri/src/error.rs:509 preserves the category and :541 carries diagnostic causes only in native state. :514 also assigns engine failures with cleanup the same category.
- P9: src/platform/errors.test.ts:476 and :593 pin applied recovery. FilesPage.test.tsx:556 pins existing applied create closure. src/utils/files.test.ts:153 and the repertoire/import test suites cover create paths without cleanup regressions.
- P10: tasks/handoffs/2026-10-06-f-20260914-02-review.md records the backend create decision and deferred renderer presentation. Read its relevant inherited context before implementation. Its native I1/I2 remain closed and are not this plan's issue IDs.
- P11: e2e/async-errors.spec.ts and e2e/fixtures.ts already supply typed errors, Files commands, listing state and screenshot helpers. playwright.config.ts names async-errors and workspace-tabs projects.
- P12: Locate probes probe-1-r1 and probe-2-r1 confirmed the complete 11-call-site helper inventory and preservation of backendCategory through Result. Reports are retained under /tmp/drain-plan-drain-90a2aa88-slot1/build. No tests, browser or native app were run.

### Refresh pickup — 2026-10-17

The frozen premises above describe the original base. At NEW-BASE 13c0870391455518f503044c91c996cd5430fd8e, source tracing reconfirms the finding and build tier. src/platform/errors.ts:55, :344 and :363 still map cleanup to unexpected and skip reconciliation. useFileWorkspace.tsx:138 and :177 still pass bound mutate, and its catches retain generic retry copy. createFile at src/utils/files.ts:177 still has only applied recovery. The original open renderer design question therefore remains, while d-20260904-06 and d-20261006-05 continue to settle taxonomy and backend compensation.

The process-generated drift is /tmp/drain-plan-drain-90a2aa88-slot2/build/drift-bda9d31380041a5bff1816e51dc2ac019b9c79c0-13c0870391455518f503044c91c996cd5430fd8e.diff. None of the renderer integration paths, request owner, workspace backend, async-errors journey or fixtures changed. src-tauri/src/error.rs adds a native Reqwest source and diagnostic test without changing the operation-and-cleanup payload. Other drift concerns catalog verification and progress presentation, with unrelated decisions and test adjustments. No invalidated O1–O4 obligation was found during pickup. Review round 3 checks exactly the supplied REFRESH-LENSES against this drift. Original round history, dispositions and closed IDs remain preserved. No co-located joiners are planned.

## Approach

### O1 — Distinguish reconciliation from applied recovery

Use the retained backendCategory to identify operation-and-cleanup, including a wrapped TauriCommandError. Keep its AppErrorCategory unexpected and keep the seven-value mapping exhaustive.

runAppliedMutationWithRefresh performs its existing pure refresh on this failure, then rejects with the original cause. A refresh rejection must not replace that cause. Existing success, ordinary failure and applied-despite-error contracts remain intact.

runWithAppliedRecovery gains an explicit, optional reconciliation-only callback for the cleanup case. Only a workspace creator that supplies it receives this behavior. Never invoke its recovered-value callback for cleanup failure, never use a reconciliation return value as success, and always rethrow the original cause even when reconciliation fails. Existing callers without this callback retain their behavior. Share cleanup classification and preservation logic where both helpers implement the same concept.

Do not change runDestructiveWithRefresh or its side-effectful callbacks. A cleanup category alone is insufficient authority to publish deletion, successful engine registration, conversion, selection clearing or undo removal.

Verification level: helper unit tests assert the original rejection survives successful and failed reconciliation, cleanup never becomes a recovered result, and all existing applied/ordinary behavior remains green. Negative coverage protects the engine and database callers from executing recovery on cleanup.

### O2 — Reconcile the workspace that actually failed

Files actions and createFile reconcile using an explicit workspace key captured at submission and the cache that owns that listing. The SWR bound mutate follows the current key and must not serve as the captured-workspace callback. createFile supplies O1's separate cleanup callback, reconciles the native listing and invalidates the Files listing for the workspace passed into that create. Share the canonical workspace SWR key between its reader and invalidator rather than copying the domain key expression. Reconciliation must not select or open a matching leftover entry, add recents, create a tab, navigate, close the form, or issue the mutation again.

An inactive listing must load fresh on next mount, while an active listing must revalidate. Invalidation and any returned data belong to the captured workspace, never whatever workspace is current after the await. Preserve the Result error and its typed details through createFile. Bound work to one reconciliation attempt, no automatic mutation retry. Reconciliation failure leaves the original cleanup failure available to the form and does not claim that refresh succeeded.

Before this post-cleanup reconciliation begins, retire or drain any pre-mutation native listing generation for that captured key so it cannot supply or overwrite the reconciliation result. Reuse the existing native request owner's supersession/drain capabilities, exposing its existing primitive to the shared reconciliation boundary if needed. Do not change ordinary request sharing or add a registry or global mutation serialization protocol. The correction is limited to the workspace cleanup reconciliation this mandate requires.

Verification level: utility and component integration tests exercise retained leftovers and refresh failure. Use real SWR for cache ownership tests, not a mocked mutate. Assert that the active Files tree consumes fresh data or the inactive key is invalidated for its next load, the original typed error remains an error, and success continuations are absent. Include a workspace change while reconciliation is pending so A's failure reconciles A without refreshing or populating B. Include a still-pending pre-mutation listing, cleanup rejection, fresh relist containing the leftover, and late old-list resolution. The old result must neither satisfy reconciliation nor overwrite the fresh result. Native request-owner tests protect unchanged sharing and cancellation behavior if its primitive is exposed.

### O3 — One localized workspace cleanup message

Use one shared workspace error-message selector across useFileWorkspace's action and move catches, CreateRepertoireModal, both ImportModal create branches, and the post-unmount import notification path. Select by typed backend category, without matching backend English text or changing the general notification taxonomy. Keep unrelated errors on their current fallbacks.

For workspace operation-and-cleanup, display this localized meaning: "The file operation failed, and cleanup also failed. Files or folders may remain. Check the collection before trying again." Do not promise refresh success, completed creation, intact data, or that retry is safe. Preserve the form and entered values on the failure. Use a literal i18next key with translations in every shipped catalogue, run pnpm i18n:extract, and avoid an eighth category or raw diagnostic display.

Verification level: component tests assert visible cleanup-specific copy and absence of generic retry copy across Files create file/folder, rename, metadata edit and move, repertoire creation, saved-file import and pasted-PGN import, including notification after unmount. Catalogue tests with fallback disabled prove the key exists and conveys cleanup in all shipped locales after extraction. No unrelated dialog redesign.

### O4 — Prove reconciliation and presentation together

Extend the existing async-errors Playwright journey with a typed cleanup failure and a subsequently changed listing. Assert the leftover is visible, failure remains visible, entered values remain, and no automatic second mutation occurs. Include a failed relist case that still shows cleanup-specific text without promising listing success. Capture the new error state at 320px with 200% font scale in English and German and inspect screenshots for readable, reachable copy and no overflow. Use existing fixtures and container snapshot route.

Keep the established unit and component tests executing the real helpers rather than mocking the behavior under test. Demonstrate red/green by reverting only the implementing fix while retaining the regression tests, through the policy's scoped Git route. The cleanup rejection assertion and visible-message/listing assertion must each fail for their corresponding reverted behavior.

## Decisions and trade-offs

Decided autonomously under full auto, to be recorded by the adopting session before implementation:

- Cleanup failure uses reconciliation-only then original rejection. Rejected treating it as applied-despite-error, since an incomplete leftover is not a successful create. d-20261006-05 keeps compensation and explicitly distinguishes ordinary rollback from committed uncertainty. Reverse only with a reviewed richer operation outcome and evidence that consumers can safely recover the object.
- Keep backendCategory as the discriminator and add a localized workspace message. Rejected an eighth UI category or global normalization message rewrite. d-20260904-06 fixes the two-level taxonomy, superseding d-20260901-34. d-20260831-01 fixes the applied category name.
- Use an explicit cleanup callback in the recovery helper. Rejected invoking the existing recover callback because registerInstalledEngine performs a second command. Rejected globally broadening destructive callbacks because they publish success-side effects. Reversal requires pure, documented callbacks at every affected caller.
- Canonicalize the existing workspace cache key only where O2 needs both a reader and invalidator. No new job registry, retry service, tool, gate or dependency. The new key-sharing code can be removed with these two consumers if their cache integration is replaced.
- Capture the listing key and cache explicitly, and retire or drain pre-mutation listing work at the cleanup reconciliation boundary. Rejected relying on bound mutate or a shared live generation. Review issue I1 has a measured workspace-switch counterexample, and I2 has a direct source trace through useNativeRequestOwner.run. Reversal requires a replacement cache/request API that guarantees both ownership and post-mutation freshness. The broader f-20261004-09 stays open for unrelated consumers.
- This remains build tier: the open question involves failure versus success recovery and cache/form integration across distinct callers. Existing decisions settle taxonomy and backend compensation, but do not settle this renderer reconciliation contract.

Plan authorship and arbitration share the root context. Detection runs in fresh Codex leaves on the same OpenAI model family as the code. No family separation is claimed.

## Risks / open questions

- Listings can fail because a leftover is invalid or unreadable. The original cleanup warning remains truthful and no success is inferred. Per-child listing behavior is the separate f-20261003-08 design.
- f-20261004-09 records that request-owner deduplication can rejoin a pre-mutation listing. O2 closes that gap at this cleanup reconciliation boundary only, using the existing ownership primitive. Other mutation consumers remain the sibling's separate design scope.
- f-20261005-04 owns other category-specific Files errors and f-20261006-07 owns durability warnings. Their separate open questions remain outside this pinned cleanup correction.
- No novel product decision is required: the finding explicitly requests truthful cleanup copy and reconciliation. The proposed text implements that requirement without a new action or product promise.
- Planning uses only static evidence. Browser pixels and behavioral tests are obligations for the adopter, not proof claimed by this run.

## Not part of this task

Backend rollback, registry authority, error payload/schema changes, generated bindings, destructive success effects, engine recovery, database conversion, generic error-taxonomy redesign, sibling findings or co-located joiners. PLAN-ONLY does not plan f-20261007-03, f-20261011-08 or f-20261013-01.

## Phases

### Phase 1 — Workspace cleanup reconciliation and its user-facing boundaries

One cohesive phase, because helper semantics, cache invalidation and form presentation must land together. The only dependency order within the phase is the shared failure contract before its callers. No independent second implementation phase.

Owned source scopes: src/platform/errors.ts, src/utils/files.ts, src/components/files/useFileWorkspace.tsx, src/components/tabs/CreateRepertoireModal.tsx, src/components/tabs/ImportModal.tsx. Shared workspace error-message, listing-key and reconciliation units may be placed in src/components/files/, src/utils/ or src/hooks/ following existing ownership. src/hooks/useNativeRequestOwner.ts may expose its existing supersession primitive for captured-key reconciliation, routing its own use through that same primitive. Its ordinary sharing and lifecycle behavior must not change. src/components/files/notifyError.ts may route its files-domain notification through the shared O3 selector. These responsibilities are limited to O2/O3.

Owned proof scopes: src/platform/errors.test.ts, src/utils/files.test.ts, src/components/files/FilesPage.test.tsx, new shared-unit and real-SWR reconciliation integration tests, src/hooks/useNativeRequestOwner.test.tsx, src/components/files/notifyError.test.ts, src/components/tabs/CreateRepertoireModal.test.tsx, src/components/tabs/ImportModal.test.tsx, e2e/async-errors.spec.ts and its intended new screenshots. e2e/fixtures.ts may change only if its existing scenario support cannot express the failure and relist. src/translation/*.json and the shared message selector's test cover the literal key and every catalogue using src/tests/catalogues.ts with real i18next and fallback disabled. Avoid the mocked i18next in src/i18n.test.ts for that assertion. Regression-only changes to src/utils/engines.controller.test.ts, AddDatabase.test.tsx and AccountCard.test.tsx may protect unchanged O1 consumers.

Executor: one selected Codex write leaf, role sensitive because src/components/tabs/** reaches persisted tab lifecycle and the change controls failure continuations. Resolve model and effort through leaf.codex.write.sensitive, currently gpt-6.1-sol/high. Root owns integration, review arbitration and gates. Leaves never stage or commit.

PROOF COMMAND: `pnpm exec vitest run src/platform/errors.test.ts src/utils/files.test.ts src/components/files/ src/hooks/useNativeRequestOwner.test.tsx src/components/tabs/CreateRepertoireModal.test.tsx src/components/tabs/ImportModal.test.tsx src/utils/engines.controller.test.ts src/components/databases/AddDatabase.test.tsx src/components/home/AccountCard.test.tsx && pnpm exec vitest related --run src/platform/errors.ts src/utils/files.ts src/hooks/useNativeRequestOwner.ts src/components/files/useFileWorkspace.tsx src/components/tabs/CreateRepertoireModal.tsx src/components/tabs/ImportModal.tsx && pnpm checks:pre-review`

Before phase proof, run pnpm i18n:extract, then verify added shared modules through their importer tests. Prove O4's fix-revert red/green before the phase commit. Do not modify coverage floors or baselines.

After implementation and cumulative diff review, browser verification runs `pnpm test:e2e:container --project=async-errors --project=workspace-tabs`. Read all changed screenshot diffs, update only intentional new cleanup captures through `pnpm test:e2e:update`, and inspect the resulting images. No native GTK change is planned. This is a renderer error-disposition change with unchanged native IPC, so mocked typed rejection exercises it. If implementation introduces a native-only behavior claim, require `pnpm build` and `pnpm verify:app` for that claim.

Final affected gates: `pnpm gates:push -- --frontend`, including the unconditional contract lane, frontend coverage/mutation/build/bundle and container e2e. Use .agents/skills/push/SKILL.md and its canonical project skill for release. No Rust or bindings block is required unless implementation scope changes, which returns to review. Adopter records decisions, closes the finding through findings.py after proof, commits the durable review handoff, and follows the normal verified push route. This planner stops before Preflight.

## Reviews

### Round 1 — plan-r1, 12 plan-capable lenses

Every user-wide and project plan-capable lens ran through leaf-launch.sh. review-code-quality and review-root-cause declare plan-review false and were excluded. All detected on Codex gpt-6.1-sol, plan at high and the other lenses at medium. Plan authorship and arbitration share this root context, and detection uses the same OpenAI family as the code.

Raw verdicts: correctness REVISE (one blocker), plan REVISE (two blockers). Tests, minimalism, error-handling and platform-semantics APPROVED with no findings. Chess-semantics, engine-protocol, ipc-contract, persisted-state, pgn-index and tauri-security returned NOT APPLICABLE with APPROVED. Their reasons fit the frozen renderer error-disposition scope. Platform reviewed opaque-handle/cache behavior without a native platform claim. Error-handling reported absent dependency source locally as a limitation. The main checkout's matching SWR dependency was available to the arbiter and other lenses.

#### I1 — Bound mutate refreshes the new workspace

- Claim: callbacks captured in A refresh B if the workspace switches before A's cleanup failure settles. O2's bound-mutate instruction contradicts its captured-workspace requirement.
- Witnesses: correctness r1 finding 1, confidence 99, blocker. Plan r1 finding 1, confidence 99, blocker.
- Evidence: SWR 2.4.0 dist/index/index.mjs:518 reads keyRef.current. Real SWR plus React/JSDOM probe at /tmp/drain-plan-drain-90a2aa88-slot1/build/probe-bound-mutate.mjs exited 0 and printed {"callbackCapturedIn":"A","currentWorkspace":"B","refreshed":["B"]}. This uses the installed production package, not a reconstruction. useFileWorkspace.tsx:138 and :177 pass bound mutate today.
- MANDATE: "the file list is not refreshed" and "a leftover entry stays invisible until some later refresh", with the frozen workspace-change threat model.
- Disposition: Fix. O2 now requires explicit key and owning-cache capture for Files actions as well as createFile, and a real-SWR A-to-B regression that cannot pass by mocking mutate.
- Authority: the existing O2 ownership promise was impossible with its specified callback. No new product behavior or independent mechanism is authorized.
- Dependencies: none. Status: open for round 2 closure against the revised O2.

#### I2 — A pre-mutation native listing can satisfy reconciliation

- Claim: O2 promises fresh data while Risks excludes the request-sharing gap. A pending pre-mutation listing is reused and may omit the leftover.
- Witness: plan r1 finding 2, confidence 97, blocker.
- Evidence: useFileWorkspace.tsx:78 calls workspaceOwner.run. useNativeRequestOwner.ts:116 returns a live current.promise without calling the new request. :153 already supplies supersede, which aborts the SWR-facing delivery through supersedeRequest's raced cancellation. This is the same production path identified by f-20261004-09, not an invented new race.
- MANDATE: "the file list is not refreshed" and "a leftover entry stays invisible until some later refresh". Leaving a pre-mutation result eligible does not meet that obligation.
- Disposition: Fix. O2 must retire or drain the captured key's old generation before post-cleanup reconciliation, using the existing ownership capability. Its real-SWR test keeps the old listing pending and resolves it late, proving a fresh leftover listing survives. Scope now permits exposing the existing primitive and protecting its unchanged lifecycle tests. Other consumers remain with f-20261004-09.
- Authority: MANDATE's required listing refresh and frozen asynchronous-operation threat model authorize this local integration. No new registry or global mutation serialization protocol is added.
- Dependencies: I1's captured key. Status: open for round 2 closure.

Root corrections accompanying r2: the notification path is now explicitly listed in owned scopes so O3 can reach an unmounted import. Catalogue proof belongs in the shared message selector test with real i18next, because src/i18n.test.ts mocks it. Neither changes the O3 behavioral contract.

Round 1 totals: 2 unique issues, 3 raw Fix adoptions, 0 Skip, 0 Defer, no withdrawals or carried items. No quota or external dependency wait occurred. Active wall is not separately measured.

Round 1 wall elapsed from prepared launch to last report: 166.5 seconds. The later arbitration and correction interval is not included in that review duration.

### Round 2 — scoped closure, plan-r2

Selection: plan and correctness as I1 witnesses, plan as I2 witness, plus tests, error-handling, minimalism and persisted-state for changed reconciliation ownership, primitive exposure and proof scopes. No full fan-out was repeated. Each packet included the unchanged MANDATE, full body and record, both snapshots, exact generated delta and correction evidence. All six leaves completed through the selected Codex route, with the same role/model/effort pins as round 1.

Raw verdicts: all six APPROVED. Persisted-state again returned NOT APPLICABLE because only transient listing/request state is affected. No new findings or late observations were reported.

- I1 CLOSED by correctness r2 and plan r2. They explicitly confirmed submission-captured key/cache ownership and real-SWR A-to-B verification against final r2 O2.
- I2 CLOSED by plan r2. It confirmed existing cancellation/draining and raced delivery at useNativeRequestOwner.ts:42 and :138 can satisfy the O2 boundary, and the plan covers late-result verification without changing ordinary sharing.

Round 2 wall elapsed from prepared launch to last report: 115.1 seconds. No quota or external dependency wait, active wall not separately measured. 0 Fix adoptions. Final totals: 2 unique issues, both closed, 3 raw adoptions across rounds, 0 Skip, 0 Defer, 0 withdrawals, 0 carried items, 0 open obligations. Counts: r1=3 r2=0. Neither correction created a reported defect.

The reviewed behavioral body is unchanged from plan-r2. Only append-only review results follow it. No implementation or application test result is claimed. The scratch SWR probe is a dependency-behavior measurement, not application verification.

## Adoption and execution — 2026-10-17

The preceding sections preserve the original planner and refresh history verbatim. Their
planning-only statements describe those earlier sessions. The current adopting execution
uses tasks/plans/2026-10-17-workspace-cleanup.md and passed the supplied adoption gate at
13c0870391455518f503044c91c996cd5430fd8e. Metadata confirms 30 inherited launcher rows,
plan Fix counts r1=3 r2=0 r3=0 and review walls 166.5, 115.1 and 109.4 seconds.

Commit 13d66061 implements the single reviewed source phase through a sensitive Codex
gpt-6.1-sol/high write leaf. Cleanup reconciliation remains separate from applied recovery,
captures the submitting workspace and cache, drains old native deliveries and invalidates
SWR's completed fetch slot through public revalidation. The original typed error survives,
forms remain open and one warning is translated in all 16 shipped catalogues. No backend,
binding, storage schema, capability or general error-taxonomy change belongs to this phase.

The root inspected the production diff and retained-test reversal evidence. A Git-derived
source-only reversal applied without offsets, produced six meaningful failures covering
missing helper reconciliation, missing real-SWR relisting and generic retry copy, and
restored to seven passing selected tests with matching source and test checksums. The
earlier offset-bearing attempt is excluded. A completed pre-mutation SWR-fetch regression
also failed before public invalidation and passed after correction. Evidence remains under
/tmp/workspace-cleanup-proof/. The leaf's preliminary fixture, format and superseded proof
attempts are preserved there and are not claimed as green.

A test-only resume added the exact original I1 ordering: A's mutation stays pending while
the view switches to B, then A rejects. It proves one A relist, unchanged B cache identity,
no retry and cleanup-specific warning. The root independently ran the full phase proof
after that refinement: 414 targeted tests and 3,293 related tests passed, followed by all
selected pre-review lanes. Workspace-storage and tree-path mutation both scored 100%.
The canonical headless completion is 0 phase-1-proof at e3147a21, attempt
/home/felixb/.claude/drain-state/drain-90a2aa88.d/gates-d2947652-9889-4173-ae73-08678f8fc65f/gate-phase-1-proof.Qfk9pV.

The primary finding remains open until the required browser proof. No browser, new
snapshot, cumulative code review or release is claimed by this source-phase record.
Decisions d-20261017-05 through d-20261017-10 record the adopted choices. Plan authorship
and arbitration shared one context. Detection runs on the same OpenAI model family as
the code, in fresh leaf sessions. No model-family separation is claimed.

Confirmed co-located fixes share actual changed source paths: f-20261007-03 shares
src/platform/errors.ts and f-20261011-08 shares src/utils/files.ts. Both remain lens tier
under settled typed-retirement and durable-append precedents. Candidate f-20261013-01 is
skipped because its fix in scripts/working-tree-files.mjs shares no source path actually
changed by this phase. It remains open and unchanged for the drain boundary to release.

The separate required release repair f-20261017-03 owns red Linux Test job 117268930189
in run 38989637851. The actual images differ only in the bottom Library selection text,
not row position. The production trace shows Board's lazy resource completing at
57305.641 after the return click begins at 57154.241. The pending route can therefore
leave the selected Library mounted. The root filed the failure before investigating,
merged its own filing, recorded ownership and chose a real route/render completion wait
under d-20261017-13. Existing f-20261017-01 and d-20261017-01 keep their separate canonical
scroll-position contract. Commit 4fc9520f completes this local repair. A finite 1500 ms
delivery delay of the unchanged production Board module reproduces the 3,857-pixel
failure. The corrected journey waits for the Board route and rendered New Tab before
returning to an unselected Library. Both green runs passed all 37 assertions and the
unchanged snapshots. Reversing only the Board waits through Git fails the retained
unselected-state assertion, then exact no-offset restoration passes. The root inspected
both captures and independently passed the targeted container journey and all selected
pre-review lanes. Evidence is in /tmp/build-cad8d11a-cleanup/ci-repair/ and the canonical
gate-ci-repair-proof.hobnQ9 attempt under the same drain gate directory above. Cumulative
review, the full container suite and hosted confirmation remain release obligations.

Commit c29d1238 completes the co-located engine source fix under d-20261017-11. A typed
native application-id retirement category survives both immediate admission refusal and
retirement cancellation of an unpublished admission. Only start maps it to the existing
missing-local-engine validation code. Ordinary cancellation, other tombstones and cleanup
failures retain their distinctions. The generated binding comes from the exporter.

The initial engine proof had two native assertion failures. One existing cleanup test
still expected generic cancellation after explicit retirement. One new childless mock
incorrectly expected unresolved-child retention. The same sensitive leaf corrected these
expectations from the actual ownership path without changing production cleanup ownership.
Final leaf and independent root proofs both passed 234 process tests, 35 error tests,
115 renderer tests and 3,289 related tests across 158 files, plus bindings and pre-review.
The counted native Git-derived reversal retains the tests and Error variant, fails three
retirement assertions without a compilation failure, then restores the complete source
diff and test hashes exactly without offsets. An earlier offset-bearing attempt is
excluded. The renderer reversal independently fails two assertions and restores green.
Evidence is in /tmp/f-20261007-03-proof/ and gate-engine-joiner-proof.DLPuBF, whose root
completion is zero at 4fc9520f. Plan authorship and arbitration shared one context.
Detection ran on the same OpenAI model family as the code.

Commit 527b85db completes the co-located fresh-board first-save source under d-20261017-12.
Fresh none-origin saves use the existing native export destination and append CAS at its
observed count. Temporary-file Save As retains its earlier target-slot CAS contract.
The existing durable appendAttempted admission is shared with recovery, checks the actual
physical tree key and prevents another append after uncertainty or refused origin admission,
including cold reload. Completion checks the exact admitted successor. Later edits stay
dirty, keep a pending recovery close open and can then be saved through one game CAS before
closing. No schema, capability, translation key or new user action was introduced.

The original first-save leaf advanced source and tests before a classified provider capacity
failure. The prescribed same-route helper launched capacity retry 1 with the same sensitive
gpt-6.1-sol/high pin, preserving partial edits. That successful thread was resumed for both
bounded proof corrections. No writer or model-family fallback occurred. Its initial related
proof exposed two caller tests that still expected fresh game-zero replacement. The first
correction updated them and proved the real Jotai admitted-successor boundary. Its root
pre-review remained red on thirteen conditional-expect lint warnings. The second correction
retained all cases with unconditional assertions and closed the later-dirty-edit recovery
continuation through the actual Gate, modal and provider integration. Intermediate i18n
mock failures and every red proof remain recorded without being labelled pre-existing.

The final leaf and independent root both passed 262 targeted tests, 1,187 related tests in
41 files, type and format checks. The root's final pre-review passed every selected lane,
including zero lint warnings, Windows clippy and all three mutation packages. The earlier
gate-fresh-save-joiner-proof.IEbShc is red and is excluded as completion proof. The final
canonical gate-fresh-save-joiner-proof.Yhb6mo completed zero at c29d1238, with mutation
duration 938.3 seconds. The final report is
/tmp/build-cad8d11a-cleanup/fix-3.capacity-retry-1/fix-3.txt.

The retained-test broad Git reversal failed 25 tests and restored all then-current 260.
Missing extracted-function and mock-response failures are excluded as behavioral proof.
Relevant assertions exposed actual game-zero adoption instead of index eight, missing
concurrent and durable-guard refusal, and clearing later recovery edits. The focused real
Jotai witness failed all four physical/origin replacement cases while both ordinary
adoptions passed. A separate source-only close reversal failed two cases because onSaved
ran with newer dirty edits and recovery wrongly reported complete-save success. Exact
no-offset restoration matched both production files byte-for-byte and passed all three
focused close cases. Evidence remains in /tmp/f-20261011-08-*. Plan authorship and arbitration
shared one context. Detection ran on the same OpenAI model family as the code.

At this source-complete checkpoint, the primary browser matrix and cumulative publish-range
review are pending. All four findings remain open until their remaining evidence is complete.


## Cumulative diff review, round 1 — 527b85db

REVIEWED_THROUGH=527b85db936e1c30cd1aba1b6f2a8a3029c2ccd7. The complete unpublished range
starts at 244cfec527ecba4e2a3ed66ad41ae1b469809cc1 and includes the carried records commit.
All thirteen code lenses and the separate records lens completed through the read-only
launcher. Roles were sensitive for code and mechanical for records, both resolved to
Codex gpt-6.1-sol/medium. Plan authorship and arbitration shared one context. Detection
ran on the same OpenAI model family as the code. No review retry or fallback occurred.

All eight retained findings are Fix, with no Defer or Skip:

- R1-C1, correctness, blocker: active workspace reconciliation must await the actual delayed
  SWR listing before the original mutation failure and pending guard can settle.
- R1-E1, error handling, blocker: first-save origin admission can commit before a subscriber
  throws. Preserve the original failure and finalize the exact acknowledged successor.
- R1-M1, minimalism, should-fix: share the render-scoped refresh dispatch between move and
  submit while preserving the admitted workspace/cache capture.
- R1-Q1, code quality, nit: the ImportModal release barrier is deferred<void>, not never.
- R1-T1, tests, blocker: the two planned cleanup baselines remain a browser-stage obligation.
  Generate them only after the initial canonical run and actual-image inspection. This is
  not permission to rebaseline another snapshot. It remains open until that proof.
- R1-R1, records, should-fix: annotate completed local CI reproduction and its remaining
  release obligations. The findings writer has applied that annotation.
- R1-R2, records, should-fix: add the minimum normative Proof bullet to the carried open
  catalog-clipping finding. The writer has done so without closing or implementing it.
- R1-R3, records, nit: move this execution section after the unchanged inherited history.
  The move preserves that history byte-for-byte, checked by SHA-256.

The root confirmed the two runtime premises against the installed producers. Actual SWR
with an active reader starts its second fetch but resolves supplied-data mutate while that
fetch remains held. Public invalidation with revalidate false followed by no-data mutate
stays pending until the same held fetch resolves. Actual installed Jotai commits atom state
before throwing a subscriber failure. Source and output are retained as
/tmp/build-cad8d11a-cleanup/review-runtime-witness.mjs and .log. These establish the API
ordering, not a substitute for the required real workspace/controller regressions.

Decision d-20261017-14 requires the existing canonical workspace acknowledgement for the
append repair. Source repair ownership is split between workspace reconciliation and
append admission, with disjoint write scopes. Independent root pre-review and committed
closure remain mandatory. The two new baselines are still pending the browser stage.

### Raw round 1 reports

#### review-code-quality

```text
[nit] src/components/tabs/ImportModal.test.tsx:443 — `deferred<never>()` declares that the promise cannot resolve, but line 476 resolves it using `undefined as never`. Use `deferred<void>()` for this release barrier so its type describes its actual role (confidence: 97).

VERDICT: APPROVED
```

#### review-correctness

```text
[blocker] src/components/files/workspaceListing.ts:22 — With an active workspace and a delayed post-mutation listing, reconciliation resolves before that listing settles. SWR 2.4.0’s `mutate(key, undefined, options)` starts revalidation separately and returns the supplied data. Consequently, `reconcileAndRethrow` rejects and the move controller releases its pending guard while reconciliation remains unfinished, violating O1/O2’s reconciliation-before-rejection contract. The supplied immediate-result tests do not establish this pending-listing ordering. (confidence: 96)

VERDICT: REVISE
```

#### review-error-handling

```text
[blocker] src/utils/tabs.ts:757 — A first-save append can commit its new origin through `updateTab`, then throw from a Jotai subscriber. The catch checks ownership against the original `none` origin, so it returns `"superseded"` and discards the exception. The user receives “save again” guidance while stamp installation and append-marker clearing were skipped. Preserve the failure and finish local reconciliation against the exact admitted successor, while still suppressing genuinely foreign owners. (confidence: 96)

VERDICT: REVISE
```

#### review-minimalism

```text
[should-fix] src/components/files/useFileWorkspace.tsx:215 — `submitAction` duplicates `moveEntry`’s workspace/cache capture and identical cleanup-versus-normal refresh dispatch at lines 137–150. Both implement the same reconciliation contract and must stay synchronized. Extract one render-scoped refresh callback and pass it to both mutation calls, preserving captured workspace/cache ownership. This removes roughly eight lines without changing behavior or adding a file (confidence: 94).

VERDICT: REVISE
```

#### review-root-cause

```text
No root-cause or prior-fix regression findings. Source traces, history and supplied failing-before/passing-after evidence support the four fixes.

VERDICT: APPROVED
```

#### review-tests

```text
[blocker] e2e/async-errors.spec.ts:109 — The English and German cleanup screenshot assertions have no corresponding committed baselines under `e2e/async-errors.spec.ts-snapshots/`. The required container run therefore fails on missing snapshots rather than distinguishing correct layout from a visual regression. O4’s visual proof remains incomplete until both baselines are generated, inspected and retained. (confidence: 100)

VERDICT: REVISE
```

#### review-chess-semantics

```text
NOT APPLICABLE: The diff changes workspace reconciliation, engine cancellation identity, and save ownership metadata. It does not change in-memory move trees, positions, move paths, FEN comparisons, or chess serialization semantics.
VERDICT: APPROVED
```

#### review-engine-protocol

```text
No in-scope defects found after tracing the supervisor, UCI state machine, analysis listener, game play, report generation, and shutdown ownership.

Read-only review. No tests or engine processes run. Detection used the same model family as the code.

VERDICT: APPROVED
```

#### review-ipc-contract

```text
No IPC contract defects found in the reviewed range. No files changed or gates run.

VERDICT: APPROVED
```

#### review-persisted-state

```text
No in-scope defects found. Traced append-marker persistence and hydration, physical tree keys, quota refusal, reload guards, and close cleanup. Read-only source review, no tests run.

VERDICT: APPROVED
```

#### review-pgn-index

```text
No reportable defects found in the changed PGN save path or its native counting, append, offset-cache and readback counterparts. Review was read-only. No tests were run.

VERDICT: APPROVED
```

#### review-platform-semantics

```text
No platform-semantics findings.

Native changes preserve existing platform branches. New admission tests use helpers available across Linux, macOS and Windows. First save retains opaque capability identity through destination selection, counting and append.

Proof limits:

- Supplied successful pre-review results cover `pnpm rust:windows:check` through the selected Windows lane. I did not rerun it.
- No non-Linux Unix source-probe result was supplied or performed.
- Windows and macOS runtime behavior still requires `rust-windows-test` and `rust-macos-test`. The `rust-platform` matrix supplies target compilation and clippy proof.

Read-only review completed with no changes. Detection used the same OpenAI model family as implementation.

VERDICT: APPROVED
```

#### review-tauri-security

```text
No findings within this lens. Traced first-save selection through authority registration, identity-checked resolution and atomic PGN replacement. Retirement and combined cleanup errors retain fixed renderer-safe messages.

Credential/session and signed-download flows are unchanged and were not independently audited. Review was static and read-only. No files changed or tests run. Detection used the same OpenAI model family as the implementation.

VERDICT: APPROVED
```

#### review-records

```text
[should-fix] tasks/findings.md:16546 — Local reproduction is still described as future work. Commit `4fc9520f`, the retained proof logs and handoff lines 54–63 establish completed reproduction, reversal and independent green verification. Append the current resolution and remaining release obligations. (confidence: 99)

[should-fix] tasks/findings.md:16519 — f-20261017-02 lacks the `**Proof:**` bullet required by the findings-ledger contract’s minimum body. Add the command and assertions that should fail before correction and pass afterward. (confidence: 100)

[nit] tasks/handoffs/2026-10-17-workspace-cleanup-review.md:3 — Current execution precedes inherited history, contrary to the supplied contract requiring inherited history followed by current execution state. Preserve the inherited text and place the execution update afterward. (confidence: 98)

Unverifiable: current hosted CI status and original planning artifacts under the now-missing `/tmp/drain-plan-drain-90a2aa88-slot*` directories. No live services queried or files changed.

VERDICT: REVISE
```
