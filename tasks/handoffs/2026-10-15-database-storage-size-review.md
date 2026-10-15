# Review handoff: f-20261001-20 database storage size

Plan-only run, base a5d422f3d3ef5fbae4833b236abc14418b671345. This record belongs to the pinned singleton finding f-20261001-20, derived impact class unclassified. The explicit pin selected it. No joiners are planned, and no finding or decision header was changed.

## Scope and pickup

The finding still holds at the base. DatabaseInfo has one u64 field, storage_size, exported as bigint but passed unchanged through getDbInfo. The current store serializes complete successful metadata with ordinary JSON. The plan retains build because choosing the byte-count wire and persisted domain representation was not settled by the progress identity decisions.

Final plan: tasks/plans/2026-10-14-database-storage-size.md. One cohesive cross-layer phase settles exact decimal-string native DTO, generated types and fresh metadata, legacy identity-only hydration, shared formatter integration, fixtures and actual native verification. No source implementation, runtime gate, browser run, server, lock, ledger mutation, commit or push occurred. Read-only findings.py check passed with 585 findings, 146 pickable and 2 blocked.

## Frozen mandate and history ownership

The plan's MANDATE is the full original finding text, copied verbatim without the ledger mutation receipt, plus the explicit pin and plan-only restriction. The fixed threat model covers the native u64 domain and normal earlier persisted metadata. No scope amendment or new mechanism was introduced in closure.

This complete handoff and the plan's append-only Reviews preserve every issue, witness, disposition, correction and closure. The supervisor owns publication and will append hash-indexed original evidence once. Raw reports, prompts and immutable snapshots are retained under /tmp/drain-plan-drain-90a2aa88-slot0/build. Do not treat those temporary paths alone as durable review history. An adopter loads the published plan and this record before coding, records plan-local autonomous decisions through the locked writer, then fulfills the implementation and release obligations. No carried issue or unresolved obligation is hidden.

## Round 1

Full plan-capable set, excluding only explicitly diff-only code-quality and root-cause. Twelve successful read-only launcher leaves completed with retained prompt, JSONL, report and stderr. Immutable snapshot plan-r1.md.

Raw verdicts and applicability:

| Lens | Raw verdict | Findings or applicability |
| --- | --- | --- |
| correctness | APPROVED | No findings, implementation and runtime proof remain unverified |
| error-handling | APPROVED | No findings |
| minimalism | APPROVED | No findings |
| plan | REVISE | I2, blocker, confidence 100 |
| tests | APPROVED | I1, should-fix, confidence 97 |
| chess-semantics | APPROVED | NOT APPLICABLE, no tree, position, path or chess semantics change |
| engine-protocol | APPROVED | NOT APPLICABLE, no UCI or engine ownership/result-routing change |
| ipc-contract | APPROVED | No findings, no runtime proof performed |
| persisted-state | APPROVED | No findings |
| pgn-index | APPROVED | NOT APPLICABLE, no scanner, offsets, encoding, index or search change |
| platform-semantics | APPROVED | NOT APPLICABLE, no OS-specific production mechanism change, revisited for I1 |
| tauri-security | APPROVED | NOT APPLICABLE, credentials, authority and signed-download boundaries unchanged |

I1 raw finding 1 from tests r1: Windows runtime coverage is unsupported by the planned db::tests:: anchor. That module is gated by cfg(all(test, unix)) at src-tauri/src/db/mod.rs:4078, so rust-windows-test skips its assertions and cannot catch a Windows-specific return to numeric serialization. Require a platform-neutral anchor or narrow the coverage claim.

Disposition Fix. Root inspected that cfg and the cfg(test) content_validation_tests declaration at db/mod.rs:11934. O1/O4 require truthful native contract proof. R2 puts serializer and producer anchors in the existing platform-neutral module, runs its exact phase command and explicitly limits real webview claims to Linux. No additional production mechanism. Closure required tests, plan and newly affected platform-semantics.

I2 raw finding 1 from plan r1: Phase 1 omits src-tauri/src/db/content_validation_tests.rs, whose line 300 compares metadata.storage_size > 0. Changing the field to String fails compilation, and cfg(test) at db/mod.rs:11934 still compiles it under the proposed Unix-filtered phase command.

Disposition Fix. Root read the assertion and declaration. O1/O2 require all native consumers to agree. R2 owns that file, updates its size assertion and retains existing Unix metadata coverage. No new mechanism or mandate expansion.

Round elapsed 192.307 seconds, adopted 2 findings, opened 2 unique issues, closed 0. No Skip, Defer, withdrawal, retry, quota wait or external prerequisite wait. Concurrent child durations were not summed. Active-only wall time is unknown.

## Round 2

Scoped closure with review-plan, review-tests and newly affected review-platform-semantics. Three successful read-only launcher leaves completed. Immutable snapshot plan-r2.md, body-only plan supplied with generated r2 delta, both original and final candidate identities, full prior history, current I1/I2 and correction evidence.

All three raw verdicts APPROVED. No prefixed new finding, late observation, NOT CLOSED issue or withdrawal.

Review-plan explicitly closed I1 against r2's O1, exact phase proof and Linux-only WebKit limits. It verified cfg(test) module/helpers at db/mod.rs:703 and :11934 and both CI all-target commands at .github/workflows/test.yml:80 and :102. It closed I2 against the owned path and both native size assertion updates. Dependent persistence and actual transport proofs remain required.

Review-tests explicitly closed I1 against the platform-neutral anchors and proof command, and I2 against the owned native consumer plus producer, facade, storage and rehydration assertions, fix-revert proof and runtime assertion staging.

Review-platform-semantics explicitly closed I1 against platform-neutral anchors and both OS CI jobs with Linux-only webview proof. It also confirmed I2's owned file and assertion update. Compilation and runtime verification remain implementation obligations.

Round elapsed 137.253 seconds, adopted 0 new findings, closed I1 and I2, opened 0. No Skip, Defer, carried issue, withdrawal, retry, quota/dependency/release wait or correction-created defect. Active-only wall time is unknown. Cumulative plan_adopted_per_round: r1=2 r2=0. Unique issues: 2 opened, 2 closed, 0 unresolved.

## Decisions and reversal paths

All choices are autonomous plan decisions, not attributed to Felix and not yet recorded in tasks/decisions.md.

- Decimal-string DatabaseInfo native wire and fresh renderer/storage metadata preserve u64 without bigint JSON or a new numerical rejection ceiling. Rejected numeric override, safe-integer rejection and facade bigint. Reversal needs an evidenced bounded native domain with equivalent reviewed serialization/storage proof.
- Reuse formatBytes for decimal strings and correct zero/unit range inside the same formatter. Rejected duplicate caller conversions and a database-specific formatter. Reversal needs an evidenced distinct display contract, updated across its consumers.
- Retain existing identity-only legacy hydration and fresh listing display. Rejected schema migration or dropping valid old selections. Reversal needs a consumer proven to read stale size before native refresh.

Progress decisions d-20261008-23 through d-20261008-26 supply representation and proof precedent and remain unchanged. d-20260919-14 governs generated output writes, d-20261008-04 the existing listing failure contract. Sidebar decisions are unrelated to fixture storage and remain unchanged.

## Provenance and next obligations

Plan authorship and arbitration shared one root context. Detection ran on the same Codex/OpenAI model family intended for the code, using fresh launcher read-only contexts. Plan review resolved gpt-6.1-sol at high effort, other lenses and the locate probe resolved gpt-6.1-sol at medium effort. The proposed sensitive implementation resolves gpt-6.1-sol at high effort. No family separation is claimed and no code was written.

One normal-role locate leaf confirmed producer, consumers, formatBytes, existing hydration and applicable decisions. It ran read-only and reported no runtime proof. All implementation, fix-revert staging, actual WebKit transport/storage checks, container screenshots, final affected Rust/frontend/bindings gates, cumulative diff review, ledger closure, required CI, ordinary upstream push and installation remain with the adopter. Full auto authorizes that later adopting run, but this plan-only contract ends before Preflight.

Co-located f-20260920-12 and f-20261004-07 were deliberately not planned under the planner contract. The adopter checks their current evidence only after its phases. No novel product question, park, new finding, commit or push is reported by this planner.

## Final planner checks

The existing validate_review_metadata and validate_issues routines accepted plan-meta.json. The existing review evidence mirror and validate_review_evidence accepted all 15 completed lens artefacts across rounds 1 and 2, including every raw finding witness and explicit closure. No review was skipped or replaced by a native fallback.

The final existing plan-review-delta check against plan-r2.md returned UNCHANGED, exit 3, its expected no-semantic-delta result. Only append-only review history was added after that snapshot. git diff --check passed. Final tracked and untracked git status was empty, and HEAD remained the supplied base a5d422f3d3ef5fbae4833b236abc14418b671345. Read-only findings.py check passed again. All planner writes are ignored tasks/plans artefacts and run scratch evidence. No runtime implementation proof is claimed.

## Refresh at 45c7dd30 — round 3

PLAN-REFRESH run on 2026-10-15, pinned f-20261001-20, from a5d422f3d3ef5fbae4833b236abc14418b671345 to 45c7dd30c2fa42ae47fb2bde4b7fc66d622e27bc. Earlier sections remain the original plan-only history. Current retained scratch evidence is /tmp/drain-plan-drain-90a2aa88-slot2/build, rehydrated rounds 1–2 plus new immutable plan-r3.md and twelve refresh leaves. No prior report, prompt, snapshot, issue or adoption count was rewritten.

Pickup reconfirmed the u64 field and unchanged identity.length producer at src-tauri/src/db/mod.rs:1276-1285 and :1467-1489, bigint generated type at src/bindings/generated.ts:1222, facade pass-through at src/utils/db.ts:258, plain JSON persistence at src/state/store/database.ts:282-296 and fresh route metadata at src/components/databases/databaseRoute.ts:43. The platform-neutral test file still compares size numerically at :300, already covered by I2. The game-opening verifier moved to :1310 onward and still creates and imports its dedicated database at :1443-1482. Intervening conversion cancellation and verifier additions do not change the size contract. d-20261015-09 through d-20261015-14 remain governing inputs for conversion work, with no reversal proposed. Build tier remains appropriate.

Root added Refresh context and updated only the phase screenshot scratch path. Original MANDATE, frozen threat model, O1–O4 and prior decisions are unchanged. Generated r3 plan delta names those two edited sections. Every refresh prompt carries the canonical lens body, full body-only current plan, prior history, closed I1/I2 state, applicable decisions/rules, both SHAs and process-generated source drift path. All supplied lenses existed in the previous manifest, so no new first-look lens was needed.

Exactly twelve read-only launcher leaves completed, all raw verdicts APPROVED:

| Lens | Raw verdict | Findings or applicability |
| --- | --- | --- |
| chess-semantics | APPROVED | NOT APPLICABLE, no tree, position, path or chess-rule change |
| correctness | APPROVED | No source drift invalidates O1–O4, runtime remains unverified |
| engine-protocol | APPROVED | NOT APPLICABLE, no engine supervision, UCI or result-routing change |
| error-handling | APPROVED | No findings |
| ipc-contract | APPROVED | Producer, persistence and native proof journey remain compatible |
| minimalism | APPROVED | No findings |
| persisted-state | APPROVED | Plain JSON writer/readers and fresh-listing resolution remain compatible |
| pgn-index | APPROVED | NOT APPLICABLE, no scanning, offsets, encoding or search obligation change |
| plan | APPROVED | No changed premise reopens I1 or I2, O1–O4 remain viable |
| platform-semantics | APPROVED | Native CI and Linux-only webview limits retained, no runtime proof performed |
| tauri-security | APPROVED | NOT APPLICABLE, no credential, authority, mutation or signed-download change |
| tests | APPROVED | No findings |

Arbitration accepts the applicability reasons against the fixed scope and republishes the approval. No drift finding, late observation, new issue, Fix, Skip, Defer, carry, withdrawal, correction-created defect, retry, fallback, quota wait or external prerequisite wait. No autonomous design decision changed or new decision was made. Both original issues remain closed at r2, with their original witnesses and corrections intact. Cumulative adoptions r1=2 r2=0 r3=0. Unique issues 2 opened, 2 closed, 0 unresolved. Round 3 elapsed wall time 132.142 seconds, not a sum of parallel child durations. Active-only wall time unknown.

Plan authorship and arbitration shared one root context. Detection ran on the same Codex/OpenAI model family intended for the code, with fresh read-only launcher contexts. The launcher selected review-plan for the plan lens and sensitive for the other eleven because the planned scope includes sensitive native and generated-binding paths. No family separation is claimed.

Implementation, fix-revert/staged assertion proof, browser/native verification, final affected gates, finding closure, commit, upstream push, required CI and install remain adopter obligations. Co-located f-20260920-12 and f-20261004-07 remain excluded by the planner contract. This refresh makes no ledger mutation and stops before Preflight.

## Refresh final checks

The existing validate_review_metadata and validate_issues routines accepted the extended plan-meta.json. The existing mirror and refresh-mode validate_review_evidence accepted all 27 cumulative launcher rows, preserving the 15 inherited rows and validating the twelve r3 rows against the actual assignment epoch, both SHAs and drift file. The root's first local validation used a newly chosen epoch even though the supervisor had already mirrored r3 under its real assignment epoch, which returned no review leaves. The corrected check used the retained assignment epoch and passed without modifying any evidence or rerunning a lens.

The final plan delta against immutable plan-r3.md returned UNCHANGED, exit 3, its expected result after append-only review history. Read-only findings.py check passed with 592 findings, 142 pickable and 2 blocked. git diff --check passed, tracked and untracked status was empty, and HEAD remained NEW-BASE 45c7dd30c2fa42ae47fb2bde4b7fc66d622e27bc. Only ignored tasks/plans artefacts and RUN_TMP were written. No runtime or release proof is claimed. Supervisor publication follows this planner's completion.



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
    "findings": [
      {
        "kind": "blocker",
        "text": "/tmp/drain-plan-drain-90a2aa88-slot0/build/plan-r1.md:96 — Phase 1 omits `src-tauri/src/db/content_validation_tests.rs`, whose line 300 compares `metadata.storage_size > 0`. O1’s change to `String` makes this consumer fail compilation. The module remains compiled under `#[cfg(test)]` at `src-tauri/src/db/mod.rs:11934`, even with the phase’s `db::tests::` filter. Include this file in the owned scope and update its assertion for the decimal-string contract. (confidence: 100)"
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
    "artefact": "lens-tests-r1.jsonl",
    "findings": [
      {
        "kind": "should-fix",
        "text": "/tmp/drain-plan-drain-90a2aa88-slot0/build/plan-r1.md:111 — Windows runtime coverage is unsupported by the planned `db::tests::` anchor. That module is gated by `#[cfg(all(test, unix))]` at `src-tauri/src/db/mod.rs:4078`, so `rust-windows-test` skips its assertions and cannot catch a Windows-specific return to numeric serialization. Place the serializer/producer anchors in a platform-neutral test module and include it in phase proof, or narrow the coverage claim. (confidence: 97)"
      }
    ],
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
    "claim": "Windows runtime coverage is unsupported by the planned db::tests:: anchor because that module is cfg(all(test, unix)).",
    "closed_round": 2,
    "correction": "Require serializer and producer anchors in the existing cfg(test) content_validation_tests module, add its exact phase proof, and limit actual webview transport/storage claims to Linux.",
    "dependencies": [],
    "disposition": "Fix",
    "id": "I1",
    "witnesses": [
      {
        "index": 1,
        "lens": "tests",
        "round": 1
      }
    ]
  },
  {
    "claim": "Phase 1 omits src-tauri/src/db/content_validation_tests.rs, whose metadata.storage_size > 0 assertion fails compilation when storage_size becomes String.",
    "closed_round": 2,
    "correction": "Include content_validation_tests.rs in owned phase scope and update its existing size assertion with the decimal-string native contract.",
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
  }
]

### lens-chess-semantics-r1.txt

NOT APPLICABLE — O1–O4 and Phase 1 concern database byte-count transport, persistence, formatting and verification. They do not change in-memory chess trees, positions, move paths or chess metadata round trips.

VERDICT: APPROVED
### lens-chess-semantics-r3.txt

NOT APPLICABLE: O1–O4 cover database storage-size transport, persistence, formatting and verification. No obligation changes in-memory chess trees, positions, move paths or chess rules. The refresh updates context and the screenshot path only.

VERDICT: APPROVED
### lens-correctness-r1.txt

No correctness defects found in O1–O4’s producer, consumer, display or legacy hydration contracts.

Limitation: plan-only review. No implementation diff or runtime proof exists yet, so implementation correctness remains unverified (confidence: 100).

VERDICT: APPROVED
### lens-correctness-r3.txt

No correctness drift findings. Round 3 preserves the prior approval for O1–O4.

Limitation: this is plan/source review only. Implementation and runtime behavior remain unverified (confidence: 100).

VERDICT: APPROVED
### lens-engine-protocol-r1.txt

NOT APPLICABLE — O1–O4 and Phase 1 paths concern database size serialization, persistence, formatting and verification. They do not change engine supervision, UCI state, process identity or asynchronous engine result routing.

VERDICT: APPROVED
### lens-engine-protocol-r3.txt

NOT APPLICABLE: O1–O4 cover database size serialization, persistence, formatting and transport proof. No planned change affects engine process supervision, UCI state or asynchronous engine result routing.

VERDICT: APPROVED
### lens-error-handling-r1.txt

No error-handling defects found in O1–O4. Native failures retain typed propagation, metadata failures remain visible error records, and verifier failures produce distinguishable diagnostics and a nonzero exit.

VERDICT: APPROVED
### lens-error-handling-r3.txt

VERDICT: APPROVED
### lens-ipc-contract-r1.txt

No IPC contract defects found in plan r1. O1–O4 cover the native decimal-string payload, regenerated binding, renderer consumers and actual transport proof. This is plan approval only. No gates ran or files changed.

VERDICT: APPROVED
### lens-ipc-contract-r3.txt

Round 3: no IPC-contract drift invalidates O1–O4. Rust metadata, renderer persistence and the native game-opening proof route remain compatible with the plan. Prior approval stands. No files changed or runtime proof performed.

VERDICT: APPROVED
### lens-minimalism-r1.txt

No bloat or duplication defects found in the plan. It reuses existing formatting and verification paths without adding abstractions or persistence machinery.

VERDICT: APPROVED
### lens-minimalism-r3.txt

VERDICT: APPROVED
### lens-persisted-state-r1.txt

VERDICT: APPROVED
### lens-persisted-state-r3.txt

Round 3: prior approval stands. No drift invalidates O2 or O4. Database-view writes, hydration, and path-owner reads retain compatible plain JSON encoding. Legacy selections still resolve against fresh listing metadata. No persistence or tab-lifecycle blockers found.

VERDICT: APPROVED
### lens-pgn-index-r1.txt

NOT APPLICABLE — Phase 1 and O1–O4 change database file-size metadata transport, renderer persistence, formatting and proof. They do not change PGN scanning, game offsets, move encoding, database indexing or search predicates.

VERDICT: APPROVED
### lens-pgn-index-r3.txt

NOT APPLICABLE: O1–O4 concern database-size metadata serialization, renderer persistence, formatting and IPC proof. The refresh changes no PGN scanning, game offsets, database encoding or search obligations.

VERDICT: APPROVED
### lens-plan-r1.txt

[blocker] /tmp/drain-plan-drain-90a2aa88-slot0/build/plan-r1.md:96 — Phase 1 omits `src-tauri/src/db/content_validation_tests.rs`, whose line 300 compares `metadata.storage_size > 0`. O1’s change to `String` makes this consumer fail compilation. The module remains compiled under `#[cfg(test)]` at `src-tauri/src/db/mod.rs:11934`, even with the phase’s `db::tests::` filter. Include this file in the owned scope and update its assertion for the decimal-string contract. (confidence: 100)

VERDICT: REVISE
### lens-plan-r2.txt

I1 CLOSED — r2 requires platform-neutral serializer and producer anchors with an explicit proof command and Linux-only WebKit claims (`tasks/plans/.plan-2026-10-14-database-storage-size-r2.body.md:48`, `:104`, `:111`). The module and database helpers use `cfg(test)` (`src-tauri/src/db/mod.rs:703`, `:11934`), and both OS jobs run all targets (`.github/workflows/test.yml:80`, `:102`). Dependent persistence and real transport proof remain required.

I2 CLOSED — r2 owns `src-tauri/src/db/content_validation_tests.rs` and explicitly requires updating both native size assertions (`tasks/plans/.plan-2026-10-14-database-storage-size-r2.body.md:48`, `:96`), covering the incompatible comparison at `src-tauri/src/db/content_validation_tests.rs:300`. No additional blocker found in the delta or dependent obligations.

VERDICT: APPROVED
### lens-plan-r3.txt

No defects found in the r3 delta or relevant source drift. O1–O4 remain viable, and no changed premise reopens I1 or I2.

Limitation: implementation and runtime proofs remain unperformed under this read-only assignment (confidence: 100).

VERDICT: APPROVED
### lens-platform-semantics-r1.txt

NOT APPLICABLE — O1–O4 change decimal-string serialization, JSON persistence, formatting and fixtures. No OS-specific path, handle, ABI, filesystem operation or `cfg` mechanism changes. The plan retains existing metadata and authority paths and names Windows and macOS CI runtime proof.

VERDICT: APPROVED
### lens-platform-semantics-r2.txt

I1 CLOSED — R2 O1 and Phase 1 require serializer and producer anchors in platform-neutral `content_validation_tests` (`src-tauri/src/db/mod.rs:11934`), executed by `rust-macos-test` and `rust-windows-test`. Webview transport and persistence proof is explicitly Linux-only. Compilation and runtime proof remain implementation obligations.

I2 CLOSED — R2 owns `src-tauri/src/db/content_validation_tests.rs` and requires updating its incompatible size assertion at line 300.

VERDICT: APPROVED
### lens-platform-semantics-r3.txt

No platform-semantics drift findings. O1–O4 remain valid at the new base.

Windows compilation and the non-Linux Unix source probe were not run in this read-only plan review. Native runtime proof remains assigned to `rust-windows-test` and `rust-macos-test`. Webview transport proof remains Linux-only.

VERDICT: APPROVED
### lens-tauri-security-r1.txt

NOT APPLICABLE — O1–O4 change database byte-count representation, display formatting and verification fixtures. The plan explicitly leaves authentication, credentials, filesystem authority, mutation and command arguments unchanged. Signed-download catalogs are excluded. Generated binding mechanics belong to review-ipc-contract. No security surface owned by this lens is changed.

VERDICT: APPROVED
### lens-tauri-security-r3.txt

NOT APPLICABLE: O1–O4 change public database-size serialization, persistence, formatting and transport proof. They do not change credentials, filesystem authority or mutation, signed downloads, or backend-only sensitive data. The refresh delta does not invalidate this lens’s prior approval.

VERDICT: APPROVED
### lens-tests-r1.txt

[should-fix] /tmp/drain-plan-drain-90a2aa88-slot0/build/plan-r1.md:111 — Windows runtime coverage is unsupported by the planned `db::tests::` anchor. That module is gated by `#[cfg(all(test, unix))]` at `src-tauri/src/db/mod.rs:4078`, so `rust-windows-test` skips its assertions and cannot catch a Windows-specific return to numeric serialization. Place the serializer/producer anchors in a platform-neutral test module and include it in phase proof, or narrow the coverage claim. (confidence: 97)

VERDICT: APPROVED
### lens-tests-r2.txt

I1 CLOSED — r2 places serializer and producer assertions in the existing `cfg(test)` module, names its proof command and confirms both platform CI jobs run it. Actual webview proof is explicitly limited to Linux.

I2 CLOSED — r2 owns `content_validation_tests.rs` and requires updating its size assertion. Dependent proofs assert exact strings through the producer, facade, sessionStorage and rehydration, with fix-revert and runtime assertion staging required.

VERDICT: APPROVED
### lens-tests-r3.txt

VERDICT: APPROVED
### plan-r1.md

# Plan: Honest, JSON-safe database storage sizes

## Goal

Resolve f-20261001-20 by making DatabaseInfo byte counts agree across native serialization, generated TypeScript, fixtures and persisted database selection. Preserve the native u64 range and the existing database selection behavior.

## MANDATE

### Database storage size is declared `bigint` but crosses IPC as a JSON number

* **ID:** f-20261001-20 · **Status:** open · **Area:** bindings-ipc · **Root:** - · **Entry:** build · **Blocked:** none
* **Where:** `src/bindings/generated.ts:1135` (`DatabaseInfo.storage_size: bigint`), its Rust source field in `src-tauri/src/db/**`, `src/state/store/database.ts:201-204` (the persisted `database-view` store that serializes a `SuccessDatabaseInfo` with `JSON.stringify`), and test fixtures that cast around it (`src/components/Sidebar.test.tsx`, `src/components/databases/ConcurrentConversion.test.tsx`: `storage_size: 1 as unknown as bigint`).
* **Defect:** Specta declares the Rust `u64` storage size as `bigint`, but Tauri serializes it as a JSON number, so every runtime `DatabaseInfo` carries a number while the type says `bigint`. A value that really is a `bigint` (as the declared type invites, e.g. a fixture `1n`) makes the persisted `database-view` store throw `TypeError: Do not know how to serialize a BigInt` on `setDatabase`. The tests of the database Back fix (2026-10-01) had to cast `1 as unknown as bigint` to store a database at all. Same class as `f-20260925-02` (progress generations) for a different field; `src/utils/db.ts` already documents it once for the downloadable catalog ("JSON cannot represent the native bigint storage size").
* **Evidence:** In the Back-fix phase, the write leaf changed the `ConcurrentConversion.test.tsx` fixture from `storage_size: 1n` to a number cast once that suite started calling `activeDatabaseViewStore.getState().setDatabase(...)`. The store persists through `createJSONStorage(() => sessionStorage)`. No runtime defect is observed today because production values are numbers.
* **Open question:** Should the binding declare the wire type honestly (a Specta type override to `number`, with a documented 2^53 bound for byte counts), or should the renderer normalize at the `getDatabases` facade? Decide together with `f-20260925-02` so `u64` fields follow one rule.
* **Scope:** `DatabaseInfo.storage_size` and any other `u64` field of `DatabaseInfo`; no change to the persisted store schema beyond what the type fix requires.
* **Related:** `f-20260925-02` (same `u64` → `bigint` wire mismatch, progress generations); no shared Root assigned until the two are decided together.
* **Proof sought:** A fixture built from the generated type with no cast can be stored in `activeDatabaseViewStore` and round-trips through sessionStorage; `pnpm bindings:check` stays green.
* **Correction (2026-10-01, push review):** the **Where** line overstates one detail: `src/components/Sidebar.test.tsx` casts `storage_size: 0 as unknown as bigint`, and `src/components/databases/ConcurrentConversion.test.tsx` casts `1 as unknown as bigint`. Both are the same `as unknown as bigint` workaround; the finding is otherwise unchanged.

The requested run is `--pin f-20261001-20 full auto`, PLAN-ONLY at base a5d422f3d3ef5fbae4833b236abc14418b671345. Planner output only, no implementation, ledger mutation, lock acquisition, commit, push, server or browser. No co-located joiner is planned.

## Threat model and non-goals

Native file lengths cover unsigned u64, including zero and values above JavaScript's safe integer limit. Renderer storage contains earlier numeric metadata as well as newly written selections. Native producer and generated registry are trusted, persisted metadata is stale display data and identity is revalidated through the existing native listing. No deliberately evasive wire input adversary, new capability, database schema change or global u64 migration is introduced. Progress identities retain their existing decimal-wire and bigint-domain contract.

## Traced premises

Frozen Locate trace at the supplied base:

* `src-tauri/src/db/mod.rs:1208-1217` declares DatabaseInfo with one u64 field, storage_size. `:1399-1418` derives it from the repository's retained file identity length.
* `src/bindings/generated.ts:1198` exports storage_size as bigint. `src/bindings/index.ts:27-33` adds renderer success metadata without changing the field.
* `src/utils/db.ts:258` passes getDbInfo metadata into successful managed records. No byte arithmetic or sorting depends on storage_size.
* `src/state/store/database.ts:183` stores the successful record and `:282-296` uses plain JSON persistence with identity-only validation. `src/components/databases/databaseRoute.ts:43` chooses fresh listing metadata for display when the stored identity matches, without rewriting the old stored object. `src/state/pathOwners.ts:188` independently reads the plain JSON selection to retain its capability handle.
* `src/components/databases/useDatabaseLibrary.tsx:205` displays installed sizes with formatBytes. `src/components/databases/AddDatabase.tsx:311` uses the same formatter for downloadable catalog sizes, which remain numeric. `src/utils/format.ts:6-14` already converts numeric input for display, with an undefined unit for zero or a size above its unit table.
* `src/state/store/database.test.ts:11-23` contains earlier numeric metadata. `src/components/Sidebar.test.tsx:95` and `src/components/databases/ConcurrentConversion.test.tsx:295` contain bigint casts. Other metadata fixtures appear in db utilities, database views, home accounts, library and info panel tests.
* `e2e/fixtures.ts:524-544` explicitly substitutes a number for generated storage_size. The database, account-summary, async-error and font-breakpoint scenarios also mock numeric get_db_info values.
* `scripts/verify-app.mjs:1130-1169` already creates and imports a real disposable database in the game-opening journey. It can inspect get_db_info through the existing native command and then inspect database-view storage after ordinary navigation.
* `src-tauri/src/progress.rs:25-74` implements lossless decimal-string JSON for ProgressGeneration. Decisions d-20261008-23 through d-20261008-26 settle that progress design, not a requirement to put bigint into persisted database metadata.
* `.gitignore:72` already ignores tasks/plans. Required binaries for pnpm, Docker, WebKitWebDriver, tauri-driver and kwin_wayland are present. They have not been started or proven operational during planning.

## Approach

### O1 — Exact native wire contract

Represent DatabaseInfo.storage_size as a canonical unsigned decimal string produced from the repository's u64 file length at DTO construction. Serde and Specta see the same concrete String field. Generated storage_size is string and renderer success records retain it as string. Other DatabaseInfo counters stay i32. No numeric bound, lossy facade conversion, bigint persistence, custom serializer or new generic codec is needed. Regenerate bindings through pnpm bindings:generate and prove byte equality through pnpm bindings:check.

Verification: native DTO serialization preserves the exact string for zero, safe-range limits, a value above 2^53 and u64::MAX. Exercise the real metadata producer on a disposable ordinary database and assert its string matches the actual file length. Tests fail if the field returns to numeric JSON.

### O2 — JSON persistence and fixture agreement

Fresh typed DatabaseInfo and SuccessDatabaseInfo fixtures use decimal strings without bigint casts or field-type substitution. All unit and Playwright get_db_info fixtures follow the real wire shape. Signed download catalogs remain their existing numeric format, since they are separate inputs.

Keep the existing database-view key, plain JSON encoding, query state and hydration contract, including pathOwners' independent identity reader. Earlier numeric metadata continues to supply identity. Fresh listing metadata supplies the displayed record, while an identity-matched stored object may retain its stale numeric size until a new selection is written. Do not migrate or reject an otherwise valid selection because its old size is numeric. No storage middleware refactor belongs here.

Verification: a cast-free generated-type fixture produces a successful managed record through the existing facade, setDatabase writes it, sessionStorage retains the exact byte string and rehydration preserves the selection and exact new metadata. Include a string above 2^53. Retain the existing legacy numeric hydration assertions and prove fresh-listing resolution replaces stale metadata.

### O3 — Shared display integration

The existing formatBytes remains the single size formatter and accepts decimal-string byte counts alongside its numeric and bigint callers. Approximation occurs only when formatting display text, never in stored or transported metadata. Preserve existing nonzero formatted labels and decimals. The shared formatter handles zero and caps its existing unit selection at TB, so valid u64 sizes never render NaN or an undefined unit. This corrects the traced boundary cases needed to display the newly explicit full native domain, without adding labels, locales or a second formatter.

Verification: formatter behavior is identical for equivalent string, numeric and bigint sizes and stays finite with a defined unit across zero and the u64 upper range. Browser snapshots cover Library and database selection, with no layout change intended. Inspect any moved snapshots before considering updates.

### O4 — Actual transport and release proof

Extend only the existing verify-app game-opening journey to assert the real get_db_info storage_size is the exact canonical string of that disposable database's stat length. After opening its explorer, inspect plain database-view JSON and prove the successful selection retains that exact size. Reuse the existing profile, authority-issued handle, navigation and cleanup. This covers the transport and persistence boundary that mocked unit and pixel suites cannot prove. Native serializer tests cover values impractical to realize as physical files.

Every new verifier assertion gets its own staged failure against a disposable input or reverted producer, with distinguishable message and observed nonzero exit status retained in the handoff. No installed data, live service, production test hook, seed environment variable, new CLI option or separate harness is needed. Any unstageable assertion is explicitly argued and disclosed rather than counted as measured.

Implementation requires a real release build, the container pixel suite and pnpm verify:app before release. Planner starts none of them. Final code review and browser verification precede the affected push gates. All three gate blocks are selected because this is a cross-layer contract.

## Decisions and trade-offs

### Decided autonomously

* Question: honest number binding or normalized bigint? Chosen: lossless decimal-string native DTO and JSON-safe string domain metadata. Rejected: a numeric override with silent rounding, imposing a new native safe-integer rejection bound, and facade bigint normalization that recreates the persistence failure. Reason: native file lengths have no existing safe-integer ceiling, and exact decimal transport follows d-20261008-23 without copying progress identity arithmetic into display metadata. Reversal path: a newly evidenced native bounded domain and a reviewed numeric wire contract with equivalent serialization and persistence proof.
* Question: where should string display conversion live? Chosen: existing shared formatBytes, fixing its zero and unit-range boundary behavior within O3. Rejected: duplicate caller conversions or a new database-specific formatter. Reason: both consumers display the same byte domain. Reversal path: an evidenced display contract requiring a different formatter, with all consumers changed together.
* Question: migrate old sessionStorage metadata? Chosen: retain its identity-only hydration and fresh-listing refresh. Rejected: a persisted schema rewrite or clearing a valid old selection. Reason: old display metadata is not authoritative. Reversal path: evidence that a consumer uses stored size before native refresh, addressed at that consumer boundary.

d-20260919-14 governs regeneration without rewriting unchanged generated bytes. d-20261008-04 governs existing partial listing results and errors. Neither is reopened. Sidebar active-state decisions are unrelated to storage fixtures and remain unchanged. Decisions are plan-local until the adopter records them through record-decision.

## Risks / open questions

Entry revalidation retains build: the wire/domain representation and its storage/display integration require a design choice that the progress decision does not itself settle. The reviewed plan settles it technically. No Felix product decision is pending. Legacy numeric metadata remains stale by design, exactness begins with a fresh native listing. Display is rounded as before. Runtime prerequisites must be rechecked by the adopter and missing required proof blocks release. No runtime gate result is claimed by this planner.

## Not part of this task

PuzzleDatabaseInfo.storageSize, signed download catalogs, other u64 DTOs, progress generation code, database storage middleware, query schemas, sidebar behavior, capability scope and unrelated findings. Co-located f-20260920-12 and f-20261004-07 stay out of this plan and are rechecked only after an adopter completes its phases.

## Phases

### Phase 1 — Database size contract and its consumers

One cohesive, independently committable phase because changing the DTO alone would leave generated bindings, persisted fixtures and rendering inconsistent. Selected executor Codex, sensitive write role resolved through leaf.codex.write.sensitive. The root delegates implementation and owns inspection, proof reruns, cumulative review, record commits and release.

Owned production paths: src-tauri/src/db/mod.rs, regenerated src/bindings/generated.ts, src/utils/format.ts and scripts/verify-app.mjs. Owned proof paths: relevant tests in src/state/store/database.test.ts, src/utils/db.test.ts, src/utils/format.test.ts, src/components/Sidebar.test.tsx, src/components/library/LibraryPage.test.tsx, src/components/panels/info/InfoPanel.test.tsx, src/components/common/AccountCards.test.tsx, src/components/home/ and src/components/databases/, plus e2e/fixtures.ts, e2e/database-files.spec.ts, e2e/accounts-puzzles-engines.spec.ts, e2e/async-errors.spec.ts and e2e/font-scaled-breakpoints.spec.ts. Inspect importers and every storage_size fixture before finalizing the brief. src/utils/db.ts and src/state/store/database.ts are read dependencies, production edits are unnecessary unless source evidence refutes O2.

Complete O1–O4 with native serializer/producer tests, cast-free persisted selection regressions, formatter assertions and real wire-shaped mocks. No auth, filesystem authority, concurrency ownership, DB persistence or command arguments change. Retain proof of reverting the production fix while new tests remain, then restore and prove green. Private test names and branching remain the executor's choice.

PROOF COMMANDS, in order after implementing and formatting owned paths:

1. `pnpm build-vite`
2. `pnpm bindings:generate` then `pnpm bindings:check`, sequentially before receipt-backed gates
3. `cargo test --manifest-path src-tauri/Cargo.toml --bin chessfable db::tests:: --locked`
4. `pnpm exec vitest related --run src/utils/format.ts src/utils/db.ts src/state/store/database.ts`, plus any changed test file not reached by those importer roots
5. `pnpm checks:pre-review`, then cumulative diff lenses and their repaired/closed findings
6. `pnpm build`, then `pnpm verify:app --screenshot /tmp/drain-plan-drain-90a2aa88-slot0/build/verify-ui/database-storage-size.png`, with actual IPC/storage assertions and all new assertion staging evidence
7. `pnpm test:e2e:container`, inspecting affected snapshots, then known coordination records on a clean reviewed tree
8. `pnpm gates:push -- --rust --frontend --bindings`, followed by the project push workflow's remote CI and install verification

The adopter reads both verify-ui skill files and runs their desktop proof route. No Chrome/Vite-only evidence and no native snapshot rerecording. Native macOS and Windows runtime assertions are covered by the required post-push rust-macos-test and rust-windows-test jobs, GNU Windows compilation by the existing gates. Green gates cannot replace actual IPC and persistence evidence. Close the finding only through the locked ledger command with honest completed proof and commit references under the adopting workflow.

### plan-r2.md

# Plan: Honest, JSON-safe database storage sizes

## Goal

Resolve f-20261001-20 by making DatabaseInfo byte counts agree across native serialization, generated TypeScript, fixtures and persisted database selection. Preserve the native u64 range and the existing database selection behavior.

## MANDATE

### Database storage size is declared `bigint` but crosses IPC as a JSON number

* **ID:** f-20261001-20 · **Status:** open · **Area:** bindings-ipc · **Root:** - · **Entry:** build · **Blocked:** none
* **Where:** `src/bindings/generated.ts:1135` (`DatabaseInfo.storage_size: bigint`), its Rust source field in `src-tauri/src/db/**`, `src/state/store/database.ts:201-204` (the persisted `database-view` store that serializes a `SuccessDatabaseInfo` with `JSON.stringify`), and test fixtures that cast around it (`src/components/Sidebar.test.tsx`, `src/components/databases/ConcurrentConversion.test.tsx`: `storage_size: 1 as unknown as bigint`).
* **Defect:** Specta declares the Rust `u64` storage size as `bigint`, but Tauri serializes it as a JSON number, so every runtime `DatabaseInfo` carries a number while the type says `bigint`. A value that really is a `bigint` (as the declared type invites, e.g. a fixture `1n`) makes the persisted `database-view` store throw `TypeError: Do not know how to serialize a BigInt` on `setDatabase`. The tests of the database Back fix (2026-10-01) had to cast `1 as unknown as bigint` to store a database at all. Same class as `f-20260925-02` (progress generations) for a different field; `src/utils/db.ts` already documents it once for the downloadable catalog ("JSON cannot represent the native bigint storage size").
* **Evidence:** In the Back-fix phase, the write leaf changed the `ConcurrentConversion.test.tsx` fixture from `storage_size: 1n` to a number cast once that suite started calling `activeDatabaseViewStore.getState().setDatabase(...)`. The store persists through `createJSONStorage(() => sessionStorage)`. No runtime defect is observed today because production values are numbers.
* **Open question:** Should the binding declare the wire type honestly (a Specta type override to `number`, with a documented 2^53 bound for byte counts), or should the renderer normalize at the `getDatabases` facade? Decide together with `f-20260925-02` so `u64` fields follow one rule.
* **Scope:** `DatabaseInfo.storage_size` and any other `u64` field of `DatabaseInfo`; no change to the persisted store schema beyond what the type fix requires.
* **Related:** `f-20260925-02` (same `u64` → `bigint` wire mismatch, progress generations); no shared Root assigned until the two are decided together.
* **Proof sought:** A fixture built from the generated type with no cast can be stored in `activeDatabaseViewStore` and round-trips through sessionStorage; `pnpm bindings:check` stays green.
* **Correction (2026-10-01, push review):** the **Where** line overstates one detail: `src/components/Sidebar.test.tsx` casts `storage_size: 0 as unknown as bigint`, and `src/components/databases/ConcurrentConversion.test.tsx` casts `1 as unknown as bigint`. Both are the same `as unknown as bigint` workaround; the finding is otherwise unchanged.

The requested run is `--pin f-20261001-20 full auto`, PLAN-ONLY at base a5d422f3d3ef5fbae4833b236abc14418b671345. Planner output only, no implementation, ledger mutation, lock acquisition, commit, push, server or browser. No co-located joiner is planned.

## Threat model and non-goals

Native file lengths cover unsigned u64, including zero and values above JavaScript's safe integer limit. Renderer storage contains earlier numeric metadata as well as newly written selections. Native producer and generated registry are trusted, persisted metadata is stale display data and identity is revalidated through the existing native listing. No deliberately evasive wire input adversary, new capability, database schema change or global u64 migration is introduced. Progress identities retain their existing decimal-wire and bigint-domain contract.

## Traced premises

Frozen Locate trace at the supplied base:

* `src-tauri/src/db/mod.rs:1208-1217` declares DatabaseInfo with one u64 field, storage_size. `:1399-1418` derives it from the repository's retained file identity length.
* `src/bindings/generated.ts:1198` exports storage_size as bigint. `src/bindings/index.ts:27-33` adds renderer success metadata without changing the field.
* `src/utils/db.ts:258` passes getDbInfo metadata into successful managed records. No byte arithmetic or sorting depends on storage_size.
* `src/state/store/database.ts:183` stores the successful record and `:282-296` uses plain JSON persistence with identity-only validation. `src/components/databases/databaseRoute.ts:43` chooses fresh listing metadata for display when the stored identity matches, without rewriting the old stored object. `src/state/pathOwners.ts:188` independently reads the plain JSON selection to retain its capability handle.
* `src/components/databases/useDatabaseLibrary.tsx:205` displays installed sizes with formatBytes. `src/components/databases/AddDatabase.tsx:311` uses the same formatter for downloadable catalog sizes, which remain numeric. `src/utils/format.ts:6-14` already converts numeric input for display, with an undefined unit for zero or a size above its unit table.
* `src/state/store/database.test.ts:11-23` contains earlier numeric metadata. `src/components/Sidebar.test.tsx:95` and `src/components/databases/ConcurrentConversion.test.tsx:295` contain bigint casts. Other metadata fixtures appear in db utilities, database views, home accounts, library and info panel tests.
* `e2e/fixtures.ts:524-544` explicitly substitutes a number for generated storage_size. The database, account-summary, async-error and font-breakpoint scenarios also mock numeric get_db_info values.
* `scripts/verify-app.mjs:1130-1169` already creates and imports a real disposable database in the game-opening journey. It can inspect get_db_info through the existing native command and then inspect database-view storage after ordinary navigation.
* `src-tauri/src/progress.rs:25-74` implements lossless decimal-string JSON for ProgressGeneration. Decisions d-20261008-23 through d-20261008-26 settle that progress design, not a requirement to put bigint into persisted database metadata.
* `.gitignore:72` already ignores tasks/plans. Required binaries for pnpm, Docker, WebKitWebDriver, tauri-driver and kwin_wayland are present. They have not been started or proven operational during planning.

## Approach

### O1 — Exact native wire contract

Represent DatabaseInfo.storage_size as a canonical unsigned decimal string produced from the repository's u64 file length at DTO construction. Serde and Specta see the same concrete String field. Generated storage_size is string and renderer success records retain it as string. Other DatabaseInfo counters stay i32. No numeric bound, lossy facade conversion, bigint persistence, custom serializer or new generic codec is needed. Regenerate bindings through pnpm bindings:generate and prove byte equality through pnpm bindings:check.

Verification: native DTO serialization preserves the exact string for zero, safe-range limits, a value above 2^53 and u64::MAX. Put the serialization and real metadata producer anchors in the existing platform-neutral content_validation_tests module, compiled under cfg(test) on Linux, macOS and Windows. Exercise the real metadata producer on a disposable ordinary database and assert its string matches the actual file length. Update existing size assertions in both native test modules for the decimal-string contract. Tests fail if the field returns to numeric JSON.

### O2 — JSON persistence and fixture agreement

Fresh typed DatabaseInfo and SuccessDatabaseInfo fixtures use decimal strings without bigint casts or field-type substitution. All unit and Playwright get_db_info fixtures follow the real wire shape. Signed download catalogs remain their existing numeric format, since they are separate inputs.

Keep the existing database-view key, plain JSON encoding, query state and hydration contract, including pathOwners' independent identity reader. Earlier numeric metadata continues to supply identity. Fresh listing metadata supplies the displayed record, while an identity-matched stored object may retain its stale numeric size until a new selection is written. Do not migrate or reject an otherwise valid selection because its old size is numeric. No storage middleware refactor belongs here.

Verification: a cast-free generated-type fixture produces a successful managed record through the existing facade, setDatabase writes it, sessionStorage retains the exact byte string and rehydration preserves the selection and exact new metadata. Include a string above 2^53. Retain the existing legacy numeric hydration assertions and prove fresh-listing resolution replaces stale metadata.

### O3 — Shared display integration

The existing formatBytes remains the single size formatter and accepts decimal-string byte counts alongside its numeric and bigint callers. Approximation occurs only when formatting display text, never in stored or transported metadata. Preserve existing nonzero formatted labels and decimals. The shared formatter handles zero and caps its existing unit selection at TB, so valid u64 sizes never render NaN or an undefined unit. This corrects the traced boundary cases needed to display the newly explicit full native domain, without adding labels, locales or a second formatter.

Verification: formatter behavior is identical for equivalent string, numeric and bigint sizes and stays finite with a defined unit across zero and the u64 upper range. Browser snapshots cover Library and database selection, with no layout change intended. Inspect any moved snapshots before considering updates.

### O4 — Actual transport and release proof

Extend only the existing verify-app game-opening journey to assert the real get_db_info storage_size is the exact canonical string of that disposable database's stat length. After opening its explorer, inspect plain database-view JSON and prove the successful selection retains that exact size. Reuse the existing profile, authority-issued handle, navigation and cleanup. This covers the transport and persistence boundary that mocked unit and pixel suites cannot prove. Native serializer tests cover values impractical to realize as physical files.

Every new verifier assertion gets its own staged failure against a disposable input or reverted producer, with distinguishable message and observed nonzero exit status retained in the handoff. No installed data, live service, production test hook, seed environment variable, new CLI option or separate harness is needed. Any unstageable assertion is explicitly argued and disclosed rather than counted as measured.

Implementation requires a real release build, the container pixel suite and pnpm verify:app before release. Planner starts none of them. Final code review and browser verification precede the affected push gates. All three gate blocks are selected because this is a cross-layer contract.

## Decisions and trade-offs

### Decided autonomously

* Question: honest number binding or normalized bigint? Chosen: lossless decimal-string native DTO and JSON-safe string domain metadata. Rejected: a numeric override with silent rounding, imposing a new native safe-integer rejection bound, and facade bigint normalization that recreates the persistence failure. Reason: native file lengths have no existing safe-integer ceiling, and exact decimal transport follows d-20261008-23 without copying progress identity arithmetic into display metadata. Reversal path: a newly evidenced native bounded domain and a reviewed numeric wire contract with equivalent serialization and persistence proof.
* Question: where should string display conversion live? Chosen: existing shared formatBytes, fixing its zero and unit-range boundary behavior within O3. Rejected: duplicate caller conversions or a new database-specific formatter. Reason: both consumers display the same byte domain. Reversal path: an evidenced display contract requiring a different formatter, with all consumers changed together.
* Question: migrate old sessionStorage metadata? Chosen: retain its identity-only hydration and fresh-listing refresh. Rejected: a persisted schema rewrite or clearing a valid old selection. Reason: old display metadata is not authoritative. Reversal path: evidence that a consumer uses stored size before native refresh, addressed at that consumer boundary.

d-20260919-14 governs regeneration without rewriting unchanged generated bytes. d-20261008-04 governs existing partial listing results and errors. Neither is reopened. Sidebar active-state decisions are unrelated to storage fixtures and remain unchanged. Decisions are plan-local until the adopter records them through record-decision.

## Risks / open questions

Entry revalidation retains build: the wire/domain representation and its storage/display integration require a design choice that the progress decision does not itself settle. The reviewed plan settles it technically. No Felix product decision is pending. Legacy numeric metadata remains stale by design, exactness begins with a fresh native listing. Display is rounded as before. Runtime prerequisites must be rechecked by the adopter and missing required proof blocks release. No runtime gate result is claimed by this planner.

## Not part of this task

PuzzleDatabaseInfo.storageSize, signed download catalogs, other u64 DTOs, progress generation code, database storage middleware, query schemas, sidebar behavior, capability scope and unrelated findings. Co-located f-20260920-12 and f-20261004-07 stay out of this plan and are rechecked only after an adopter completes its phases.

## Phases

### Phase 1 — Database size contract and its consumers

One cohesive, independently committable phase because changing the DTO alone would leave generated bindings, persisted fixtures and rendering inconsistent. Selected executor Codex, sensitive write role resolved through leaf.codex.write.sensitive. The root delegates implementation and owns inspection, proof reruns, cumulative review, record commits and release.

Owned production paths: src-tauri/src/db/mod.rs, regenerated src/bindings/generated.ts, src/utils/format.ts and scripts/verify-app.mjs. Owned proof paths: src-tauri/src/db/content_validation_tests.rs and the tests within db/mod.rs, plus relevant tests in src/state/store/database.test.ts, src/utils/db.test.ts, src/utils/format.test.ts, src/components/Sidebar.test.tsx, src/components/library/LibraryPage.test.tsx, src/components/panels/info/InfoPanel.test.tsx, src/components/common/AccountCards.test.tsx, src/components/home/ and src/components/databases/, plus e2e/fixtures.ts, e2e/database-files.spec.ts, e2e/accounts-puzzles-engines.spec.ts, e2e/async-errors.spec.ts and e2e/font-scaled-breakpoints.spec.ts. Inspect importers and every storage_size fixture before finalizing the brief. src/utils/db.ts and src/state/store/database.ts are read dependencies, production edits are unnecessary unless source evidence refutes O2.

Complete O1–O4 with native serializer/producer tests, cast-free persisted selection regressions, formatter assertions and real wire-shaped mocks. No auth, filesystem authority, concurrency ownership, DB persistence or command arguments change. Retain proof of reverting the production fix while new tests remain, then restore and prove green. Private test names and branching remain the executor's choice.

PROOF COMMANDS, in order after implementing and formatting owned paths:

1. `pnpm build-vite`
2. `pnpm bindings:generate` then `pnpm bindings:check`, sequentially before receipt-backed gates
3. `cargo test --manifest-path src-tauri/Cargo.toml --bin chessfable db::content_validation_tests:: --locked`, then `cargo test --manifest-path src-tauri/Cargo.toml --bin chessfable db::tests:: --locked`. The first includes the new platform-neutral serialization and producer anchors, the second covers existing Unix metadata regressions and is not Windows runtime evidence.
4. `pnpm exec vitest related --run src/utils/format.ts src/utils/db.ts src/state/store/database.ts`, plus any changed test file not reached by those importer roots
5. `pnpm checks:pre-review`, then cumulative diff lenses and their repaired/closed findings
6. `pnpm build`, then `pnpm verify:app --screenshot /tmp/drain-plan-drain-90a2aa88-slot0/build/verify-ui/database-storage-size.png`, with actual IPC/storage assertions and all new assertion staging evidence
7. `pnpm test:e2e:container`, inspecting affected snapshots, then known coordination records on a clean reviewed tree
8. `pnpm gates:push -- --rust --frontend --bindings`, followed by the project push workflow's remote CI and install verification

The adopter reads both verify-ui skill files and runs their desktop proof route. No Chrome/Vite-only evidence and no native snapshot rerecording. The platform-neutral content_validation_tests anchors run in the required post-push rust-macos-test and rust-windows-test jobs, GNU Windows compilation by the existing gates. The db::tests module is Unix-only and supplies no Windows coverage. Real WebKit transport and renderer storage proof is measured on Linux, no Windows or macOS webview transport claim is made. Green gates cannot replace actual IPC and persistence evidence. Close the finding only through the locked ledger command with honest completed proof and commit references under the adopting workflow.

## Reviews

### Round 1 — snapshot plan-r1.md

Twelve launcher read-only Codex lenses completed. Raw verdicts: review-plan REVISE, review-tests APPROVED with one should-fix, review-correctness APPROVED, review-error-handling APPROVED, review-minimalism APPROVED, review-ipc-contract APPROVED, review-persisted-state APPROVED. review-chess-semantics, review-engine-protocol, review-pgn-index, review-platform-semantics and review-tauri-security returned NOT APPLICABLE with APPROVED, justified by unchanged chess, engine, PGN/index, OS mechanisms and security boundaries. Platform test placement is rechecked in the next round because I1 affects the proof claim.

* I1, should-fix, confidence 97. Claim: the proposed db::tests:: anchor is Unix-only and cannot support the plan's Windows serialization coverage claim. Witness: review-tests r1, raw finding 1. Disposition: Fix. Evidence: src-tauri/src/db/mod.rs:4078 gates tests with cfg(all(test, unix)), while :11934 compiles content_validation_tests under cfg(test). MANDATE obligation: honest native serialization and its required platform proof, O1/O4. Correction: place serializer and producer anchors in the existing platform-neutral content_validation_tests module, include its exact phase proof command and explicitly bound the WebKit transport claim to Linux. Contract correction, closure pending r2 from review-plan, review-tests and the affected review-platform-semantics lens. No new mechanism or scope expansion.
* I2, blocker, confidence 100. Claim: Phase 1 omits src-tauri/src/db/content_validation_tests.rs, whose metadata.storage_size > 0 assertion fails compilation when O1 changes the field to String. Witness: review-plan r1, raw finding 1. Disposition: Fix. Evidence: src-tauri/src/db/content_validation_tests.rs:300 and src-tauri/src/db/mod.rs:11934. MANDATE obligation: every DatabaseInfo consumer agrees with the type fix, O1/O2. Correction: include that test file in owned scope and update its existing size assertion with the new native contract. Contract correction, closure pending r2. No new mechanism or scope expansion.

Round 1 adoption count: 2. No Skip, Defer, carried issue, withdrawal, quota wait or external prerequisite wait. Plan authorship and arbitration shared one context. Detection ran on the same Codex/OpenAI model family intended for the implementation, in fresh read-only launcher contexts. Runtime implementation remains unverified.

### plan-r3.md

# Plan: Honest, JSON-safe database storage sizes

## Goal

Resolve f-20261001-20 by making DatabaseInfo byte counts agree across native serialization, generated TypeScript, fixtures and persisted database selection. Preserve the native u64 range and the existing database selection behavior.

## MANDATE

### Database storage size is declared `bigint` but crosses IPC as a JSON number

* **ID:** f-20261001-20 · **Status:** open · **Area:** bindings-ipc · **Root:** - · **Entry:** build · **Blocked:** none
* **Where:** `src/bindings/generated.ts:1135` (`DatabaseInfo.storage_size: bigint`), its Rust source field in `src-tauri/src/db/**`, `src/state/store/database.ts:201-204` (the persisted `database-view` store that serializes a `SuccessDatabaseInfo` with `JSON.stringify`), and test fixtures that cast around it (`src/components/Sidebar.test.tsx`, `src/components/databases/ConcurrentConversion.test.tsx`: `storage_size: 1 as unknown as bigint`).
* **Defect:** Specta declares the Rust `u64` storage size as `bigint`, but Tauri serializes it as a JSON number, so every runtime `DatabaseInfo` carries a number while the type says `bigint`. A value that really is a `bigint` (as the declared type invites, e.g. a fixture `1n`) makes the persisted `database-view` store throw `TypeError: Do not know how to serialize a BigInt` on `setDatabase`. The tests of the database Back fix (2026-10-01) had to cast `1 as unknown as bigint` to store a database at all. Same class as `f-20260925-02` (progress generations) for a different field; `src/utils/db.ts` already documents it once for the downloadable catalog ("JSON cannot represent the native bigint storage size").
* **Evidence:** In the Back-fix phase, the write leaf changed the `ConcurrentConversion.test.tsx` fixture from `storage_size: 1n` to a number cast once that suite started calling `activeDatabaseViewStore.getState().setDatabase(...)`. The store persists through `createJSONStorage(() => sessionStorage)`. No runtime defect is observed today because production values are numbers.
* **Open question:** Should the binding declare the wire type honestly (a Specta type override to `number`, with a documented 2^53 bound for byte counts), or should the renderer normalize at the `getDatabases` facade? Decide together with `f-20260925-02` so `u64` fields follow one rule.
* **Scope:** `DatabaseInfo.storage_size` and any other `u64` field of `DatabaseInfo`; no change to the persisted store schema beyond what the type fix requires.
* **Related:** `f-20260925-02` (same `u64` → `bigint` wire mismatch, progress generations); no shared Root assigned until the two are decided together.
* **Proof sought:** A fixture built from the generated type with no cast can be stored in `activeDatabaseViewStore` and round-trips through sessionStorage; `pnpm bindings:check` stays green.
* **Correction (2026-10-01, push review):** the **Where** line overstates one detail: `src/components/Sidebar.test.tsx` casts `storage_size: 0 as unknown as bigint`, and `src/components/databases/ConcurrentConversion.test.tsx` casts `1 as unknown as bigint`. Both are the same `as unknown as bigint` workaround; the finding is otherwise unchanged.

The requested run is `--pin f-20261001-20 full auto`, PLAN-ONLY at base a5d422f3d3ef5fbae4833b236abc14418b671345. Planner output only, no implementation, ledger mutation, lock acquisition, commit, push, server or browser. No co-located joiner is planned.

## Threat model and non-goals

Native file lengths cover unsigned u64, including zero and values above JavaScript's safe integer limit. Renderer storage contains earlier numeric metadata as well as newly written selections. Native producer and generated registry are trusted, persisted metadata is stale display data and identity is revalidated through the existing native listing. No deliberately evasive wire input adversary, new capability, database schema change or global u64 migration is introduced. Progress identities retain their existing decimal-wire and bigint-domain contract.

## Traced premises

Frozen Locate trace at the supplied base:

* `src-tauri/src/db/mod.rs:1208-1217` declares DatabaseInfo with one u64 field, storage_size. `:1399-1418` derives it from the repository's retained file identity length.
* `src/bindings/generated.ts:1198` exports storage_size as bigint. `src/bindings/index.ts:27-33` adds renderer success metadata without changing the field.
* `src/utils/db.ts:258` passes getDbInfo metadata into successful managed records. No byte arithmetic or sorting depends on storage_size.
* `src/state/store/database.ts:183` stores the successful record and `:282-296` uses plain JSON persistence with identity-only validation. `src/components/databases/databaseRoute.ts:43` chooses fresh listing metadata for display when the stored identity matches, without rewriting the old stored object. `src/state/pathOwners.ts:188` independently reads the plain JSON selection to retain its capability handle.
* `src/components/databases/useDatabaseLibrary.tsx:205` displays installed sizes with formatBytes. `src/components/databases/AddDatabase.tsx:311` uses the same formatter for downloadable catalog sizes, which remain numeric. `src/utils/format.ts:6-14` already converts numeric input for display, with an undefined unit for zero or a size above its unit table.
* `src/state/store/database.test.ts:11-23` contains earlier numeric metadata. `src/components/Sidebar.test.tsx:95` and `src/components/databases/ConcurrentConversion.test.tsx:295` contain bigint casts. Other metadata fixtures appear in db utilities, database views, home accounts, library and info panel tests.
* `e2e/fixtures.ts:524-544` explicitly substitutes a number for generated storage_size. The database, account-summary, async-error and font-breakpoint scenarios also mock numeric get_db_info values.
* `scripts/verify-app.mjs:1130-1169` already creates and imports a real disposable database in the game-opening journey. It can inspect get_db_info through the existing native command and then inspect database-view storage after ordinary navigation.
* `src-tauri/src/progress.rs:25-74` implements lossless decimal-string JSON for ProgressGeneration. Decisions d-20261008-23 through d-20261008-26 settle that progress design, not a requirement to put bigint into persisted database metadata.
* `.gitignore:72` already ignores tasks/plans. Required binaries for pnpm, Docker, WebKitWebDriver, tauri-driver and kwin_wayland are present. They have not been started or proven operational during planning.

## Refresh context

PLAN-REFRESH from a5d422f3d3ef5fbae4833b236abc14418b671345 to 45c7dd30c2fa42ae47fb2bde4b7fc66d622e27bc. The original MANDATE, threat model, frozen trace and rounds 1–2 remain historical inputs. This run stops before Preflight and writes only ignored plan artefacts and run scratch. No joiners, ledger mutation, lock acquisition, implementation, commit, push, server or browser belongs to this refresh.

Pickup at NEW-BASE still finds DatabaseInfo.storage_size: u64 at src-tauri/src/db/mod.rs:1276-1285 and an unchanged identity.length producer at :1467-1489. Generated DatabaseInfo.storage_size remains bigint at src/bindings/generated.ts:1222. getDatabase still passes metadata through at src/utils/db.ts:258. The unchanged plain JSON database-view persistence remains at src/state/store/database.ts:282-296 and fresh route resolution at src/components/databases/databaseRoute.ts:43. Entry remains build because the exact wire and persisted domain contract still needs the reviewed cross-layer design.

The source drift includes conversion cancellation and its fixtures, engine settings and font-scale repairs, and extensions of scripts/verify-app.mjs. The existing game-opening journey remains at :1310 onward and seeds the same dedicated database at :1443-1482. Extend that journey with O4 without altering the new conversion cancellation journey or its native ticket ownership. d-20261015-09 through d-20261015-14 govern the intervening conversion work and stay unchanged. Existing content_validation_tests.rs:300 still contains the numeric size assertion covered by I2. The platform-neutral module remains compiled under cfg(test).

Refresh round 3 uses exactly the supplied twelve REFRESH-LENSES against the process-generated drift diff in this run's scratch directory. All twelve already appeared in the published rounds, so no first-look addition is required. A drift finding must identify a changed path or symbol and the invalidated O1–O4 obligation. No runtime implementation proof is claimed.

## Approach

### O1 — Exact native wire contract

Represent DatabaseInfo.storage_size as a canonical unsigned decimal string produced from the repository's u64 file length at DTO construction. Serde and Specta see the same concrete String field. Generated storage_size is string and renderer success records retain it as string. Other DatabaseInfo counters stay i32. No numeric bound, lossy facade conversion, bigint persistence, custom serializer or new generic codec is needed. Regenerate bindings through pnpm bindings:generate and prove byte equality through pnpm bindings:check.

Verification: native DTO serialization preserves the exact string for zero, safe-range limits, a value above 2^53 and u64::MAX. Put the serialization and real metadata producer anchors in the existing platform-neutral content_validation_tests module, compiled under cfg(test) on Linux, macOS and Windows. Exercise the real metadata producer on a disposable ordinary database and assert its string matches the actual file length. Update existing size assertions in both native test modules for the decimal-string contract. Tests fail if the field returns to numeric JSON.

### O2 — JSON persistence and fixture agreement

Fresh typed DatabaseInfo and SuccessDatabaseInfo fixtures use decimal strings without bigint casts or field-type substitution. All unit and Playwright get_db_info fixtures follow the real wire shape. Signed download catalogs remain their existing numeric format, since they are separate inputs.

Keep the existing database-view key, plain JSON encoding, query state and hydration contract, including pathOwners' independent identity reader. Earlier numeric metadata continues to supply identity. Fresh listing metadata supplies the displayed record, while an identity-matched stored object may retain its stale numeric size until a new selection is written. Do not migrate or reject an otherwise valid selection because its old size is numeric. No storage middleware refactor belongs here.

Verification: a cast-free generated-type fixture produces a successful managed record through the existing facade, setDatabase writes it, sessionStorage retains the exact byte string and rehydration preserves the selection and exact new metadata. Include a string above 2^53. Retain the existing legacy numeric hydration assertions and prove fresh-listing resolution replaces stale metadata.

### O3 — Shared display integration

The existing formatBytes remains the single size formatter and accepts decimal-string byte counts alongside its numeric and bigint callers. Approximation occurs only when formatting display text, never in stored or transported metadata. Preserve existing nonzero formatted labels and decimals. The shared formatter handles zero and caps its existing unit selection at TB, so valid u64 sizes never render NaN or an undefined unit. This corrects the traced boundary cases needed to display the newly explicit full native domain, without adding labels, locales or a second formatter.

Verification: formatter behavior is identical for equivalent string, numeric and bigint sizes and stays finite with a defined unit across zero and the u64 upper range. Browser snapshots cover Library and database selection, with no layout change intended. Inspect any moved snapshots before considering updates.

### O4 — Actual transport and release proof

Extend only the existing verify-app game-opening journey to assert the real get_db_info storage_size is the exact canonical string of that disposable database's stat length. After opening its explorer, inspect plain database-view JSON and prove the successful selection retains that exact size. Reuse the existing profile, authority-issued handle, navigation and cleanup. This covers the transport and persistence boundary that mocked unit and pixel suites cannot prove. Native serializer tests cover values impractical to realize as physical files.

Every new verifier assertion gets its own staged failure against a disposable input or reverted producer, with distinguishable message and observed nonzero exit status retained in the handoff. No installed data, live service, production test hook, seed environment variable, new CLI option or separate harness is needed. Any unstageable assertion is explicitly argued and disclosed rather than counted as measured.

Implementation requires a real release build, the container pixel suite and pnpm verify:app before release. Planner starts none of them. Final code review and browser verification precede the affected push gates. All three gate blocks are selected because this is a cross-layer contract.

## Decisions and trade-offs

### Decided autonomously

* Question: honest number binding or normalized bigint? Chosen: lossless decimal-string native DTO and JSON-safe string domain metadata. Rejected: a numeric override with silent rounding, imposing a new native safe-integer rejection bound, and facade bigint normalization that recreates the persistence failure. Reason: native file lengths have no existing safe-integer ceiling, and exact decimal transport follows d-20261008-23 without copying progress identity arithmetic into display metadata. Reversal path: a newly evidenced native bounded domain and a reviewed numeric wire contract with equivalent serialization and persistence proof.
* Question: where should string display conversion live? Chosen: existing shared formatBytes, fixing its zero and unit-range boundary behavior within O3. Rejected: duplicate caller conversions or a new database-specific formatter. Reason: both consumers display the same byte domain. Reversal path: an evidenced display contract requiring a different formatter, with all consumers changed together.
* Question: migrate old sessionStorage metadata? Chosen: retain its identity-only hydration and fresh-listing refresh. Rejected: a persisted schema rewrite or clearing a valid old selection. Reason: old display metadata is not authoritative. Reversal path: evidence that a consumer uses stored size before native refresh, addressed at that consumer boundary.

d-20260919-14 governs regeneration without rewriting unchanged generated bytes. d-20261008-04 governs existing partial listing results and errors. Neither is reopened. Sidebar active-state decisions are unrelated to storage fixtures and remain unchanged. Decisions are plan-local until the adopter records them through record-decision.

## Risks / open questions

Entry revalidation retains build: the wire/domain representation and its storage/display integration require a design choice that the progress decision does not itself settle. The reviewed plan settles it technically. No Felix product decision is pending. Legacy numeric metadata remains stale by design, exactness begins with a fresh native listing. Display is rounded as before. Runtime prerequisites must be rechecked by the adopter and missing required proof blocks release. No runtime gate result is claimed by this planner.

## Not part of this task

PuzzleDatabaseInfo.storageSize, signed download catalogs, other u64 DTOs, progress generation code, database storage middleware, query schemas, sidebar behavior, capability scope and unrelated findings. Co-located f-20260920-12 and f-20261004-07 stay out of this plan and are rechecked only after an adopter completes its phases.

## Phases

### Phase 1 — Database size contract and its consumers

One cohesive, independently committable phase because changing the DTO alone would leave generated bindings, persisted fixtures and rendering inconsistent. Selected executor Codex, sensitive write role resolved through leaf.codex.write.sensitive. The root delegates implementation and owns inspection, proof reruns, cumulative review, record commits and release.

Owned production paths: src-tauri/src/db/mod.rs, regenerated src/bindings/generated.ts, src/utils/format.ts and scripts/verify-app.mjs. Owned proof paths: src-tauri/src/db/content_validation_tests.rs and the tests within db/mod.rs, plus relevant tests in src/state/store/database.test.ts, src/utils/db.test.ts, src/utils/format.test.ts, src/components/Sidebar.test.tsx, src/components/library/LibraryPage.test.tsx, src/components/panels/info/InfoPanel.test.tsx, src/components/common/AccountCards.test.tsx, src/components/home/ and src/components/databases/, plus e2e/fixtures.ts, e2e/database-files.spec.ts, e2e/accounts-puzzles-engines.spec.ts, e2e/async-errors.spec.ts and e2e/font-scaled-breakpoints.spec.ts. Inspect importers and every storage_size fixture before finalizing the brief. src/utils/db.ts and src/state/store/database.ts are read dependencies, production edits are unnecessary unless source evidence refutes O2.

Complete O1–O4 with native serializer/producer tests, cast-free persisted selection regressions, formatter assertions and real wire-shaped mocks. No auth, filesystem authority, concurrency ownership, DB persistence or command arguments change. Retain proof of reverting the production fix while new tests remain, then restore and prove green. Private test names and branching remain the executor's choice.

PROOF COMMANDS, in order after implementing and formatting owned paths:

1. `pnpm build-vite`
2. `pnpm bindings:generate` then `pnpm bindings:check`, sequentially before receipt-backed gates
3. `cargo test --manifest-path src-tauri/Cargo.toml --bin chessfable db::content_validation_tests:: --locked`, then `cargo test --manifest-path src-tauri/Cargo.toml --bin chessfable db::tests:: --locked`. The first includes the new platform-neutral serialization and producer anchors, the second covers existing Unix metadata regressions and is not Windows runtime evidence.
4. `pnpm exec vitest related --run src/utils/format.ts src/utils/db.ts src/state/store/database.ts`, plus any changed test file not reached by those importer roots
5. `pnpm checks:pre-review`, then cumulative diff lenses and their repaired/closed findings
6. `pnpm build`, then `pnpm verify:app --screenshot /tmp/drain-plan-drain-90a2aa88-slot2/build/verify-ui/database-storage-size.png`, with actual IPC/storage assertions and all new assertion staging evidence
7. `pnpm test:e2e:container`, inspecting affected snapshots, then known coordination records on a clean reviewed tree
8. `pnpm gates:push -- --rust --frontend --bindings`, followed by the project push workflow's remote CI and install verification

The adopter reads both verify-ui skill files and runs their desktop proof route. No Chrome/Vite-only evidence and no native snapshot rerecording. The platform-neutral content_validation_tests anchors run in the required post-push rust-macos-test and rust-windows-test jobs, GNU Windows compilation by the existing gates. The db::tests module is Unix-only and supplies no Windows coverage. Real WebKit transport and renderer storage proof is measured on Linux, no Windows or macOS webview transport claim is made. Green gates cannot replace actual IPC and persistence evidence. Close the finding only through the locked ledger command with honest completed proof and commit references under the adopting workflow.

## Reviews

### Round 1 — snapshot plan-r1.md

Twelve launcher read-only Codex lenses completed. Raw verdicts: review-plan REVISE, review-tests APPROVED with one should-fix, review-correctness APPROVED, review-error-handling APPROVED, review-minimalism APPROVED, review-ipc-contract APPROVED, review-persisted-state APPROVED. review-chess-semantics, review-engine-protocol, review-pgn-index, review-platform-semantics and review-tauri-security returned NOT APPLICABLE with APPROVED, justified by unchanged chess, engine, PGN/index, OS mechanisms and security boundaries. Platform test placement is rechecked in the next round because I1 affects the proof claim.

* I1, should-fix, confidence 97. Claim: the proposed db::tests:: anchor is Unix-only and cannot support the plan's Windows serialization coverage claim. Witness: review-tests r1, raw finding 1. Disposition: Fix. Evidence: src-tauri/src/db/mod.rs:4078 gates tests with cfg(all(test, unix)), while :11934 compiles content_validation_tests under cfg(test). MANDATE obligation: honest native serialization and its required platform proof, O1/O4. Correction: place serializer and producer anchors in the existing platform-neutral content_validation_tests module, include its exact phase proof command and explicitly bound the WebKit transport claim to Linux. Contract correction, closure pending r2 from review-plan, review-tests and the affected review-platform-semantics lens. No new mechanism or scope expansion.
* I2, blocker, confidence 100. Claim: Phase 1 omits src-tauri/src/db/content_validation_tests.rs, whose metadata.storage_size > 0 assertion fails compilation when O1 changes the field to String. Witness: review-plan r1, raw finding 1. Disposition: Fix. Evidence: src-tauri/src/db/content_validation_tests.rs:300 and src-tauri/src/db/mod.rs:11934. MANDATE obligation: every DatabaseInfo consumer agrees with the type fix, O1/O2. Correction: include that test file in owned scope and update its existing size assertion with the new native contract. Contract correction, closure pending r2. No new mechanism or scope expansion.

Round 1 adoption count: 2. No Skip, Defer, carried issue, withdrawal, quota wait or external prerequisite wait. Plan authorship and arbitration shared one context. Detection ran on the same Codex/OpenAI model family intended for the implementation, in fresh read-only launcher contexts. Runtime implementation remains unverified.

### Round 2 — snapshot plan-r2.md

review-plan, review-tests and the newly affected review-platform-semantics completed the scoped closure. All raw verdicts APPROVED. Each explicitly closed I1 against the existing cfg(test) native module, its exact proof and Linux-only WebKit claim. All three also confirmed I2's owned native consumer and assertion correction. No new finding or late observation. I1 and I2 are closed at revision r2, with no dependencies left unresolved. No Skip, Defer, carried issue, withdrawal or correction-created defect.

Measured round elapsed: r1=192.307 seconds, r2=137.253 seconds. Adoptions r1=2 r2=0, unique issues 2 opened and 2 closed. No known quota or external dependency wait, active-only wall time unknown. Concurrent leaf durations are not summed. Complete cumulative history is in reviews-handoff.md beside this plan. Plan authorship and arbitration shared one context. Detection ran on the same Codex/OpenAI model family intended for implementation, in fresh read-only contexts. Planning approval is complete, source implementation and runtime proof remain unperformed.

## Adopter cumulative diff review R1

Reviewed through a1e3bcdf3dc3569ef9da5912407e94c3835fb24d, complete upstream merge-base range, with separate code and records diffs. Eleven launcher leaves completed. All resolved to gpt-6.1-sol at medium effort, code roles sensitive and records role mechanical. No retry, fallback, capacity wait or missing report. Wall through arbitration 335.6 seconds, measured from the first fresh R1 stream creation. Active-only wall unknown.

Ten raw verdicts APPROVED. The persistence lens returned REVISE with one blocker. D1 is the pre-existing quota-refusal contract at database.ts:283, confidence 98. Root inspected the installed Zustand adapter, setter and openDatabase caller. The same defect and independent all-setters durable-admission design question are already open as f-20261010-01. Disposition Defer to that existing build finding under push-review-policy section4, with its existing source trace, review inheritance and proof obligations retained. The source and failure mechanism are unchanged by this diff, and O2 explicitly preserves the existing storage contract. No catch-only repair, duplicate entry or fabricated APPROVED verdict. The locked annotation links this review to the existing finding. Zero Fix, zero Skip, one Defer, zero unresolved adopted Fix.

The PGN lens correctly returned NOT APPLICABLE because metadata representation changes no scanner, encoding or index mechanism. The platform lens limitation about GNU Windows compilation is resolved by both completed root pre-review logs, including windows-clippy exit0. No non-Linux Unix source probe was performed, and macOS/Windows runtime plus platform-matrix CI remain required. The records lens could not locate the root447-test rerun. Its exact log is gate-numeric-runtime-build.20AQ1D/log in the gate directory named by the execution record, which reports15 passed files and447 passed tests before the intentional source reversal. This is a named evidence limitation, not a finding.

Plan authorship and arbitration shared one context. Detection ran on the same model family and model as the code, with fresh read-only sessions.

### lens-code-quality-r1

```text
No readability or local-consistency findings at confidence ≥80. Review used the same Codex/OpenAI model family as implementation, in a fresh read-only session.

VERDICT: APPROVED
```

### lens-correctness-r1

```text
No correctness defects found.

Limitation: read-only review did not execute runtime verification or final gates (confidence: 100). Review used the same model family as implementation.

VERDICT: APPROVED
```

### lens-error-handling-r1

```text
No error-handling defects found. Native failures remain typed, metadata failures produce visible error records, and DS1/DS2 failures record diagnostics and force exit status 1.

Limitation: runtime proof and final gates were not run in this read-only review (confidence: 100). Review used the implementation’s model family without family separation.

VERDICT: APPROVED
```

### lens-ipc-contract-r1

```text
No IPC-contract defects found. Native serialization, the Specta binding, renderer facade, persistence and display consumers agree on decimal strings.

Read-only review. Corrected runtime proof and final gates remain pending. Detection used the same model family as implementation.

VERDICT: APPROVED
```

### lens-minimalism-r1

```text
VERDICT: APPROVED
```

### lens-persisted-state-r1

```text
[blocker] src/state/store/database.ts:283 — Pre-existing since `93b366695`: `createJSONStorage` calls `sessionStorage.setItem` without handling quota failures. With large game tabs filling session storage, opening another database can throw after updating live state. `useDatabaseLibrary.tsx:162` then aborts before navigation, and reloading restores the previous selection because the write failed. No comprehensible storage error reaches the user. (confidence: 98)

Limitation: source trace only, no runtime quota reproduction. The decimal-string writer and both persistence readers agree.

VERDICT: REVISE
```

### lens-pgn-index-r1

```text
NOT APPLICABLE — The code diff changes database byte-count metadata serialization, formatting and verification. It changes no PGN scanning, game encoding, disk offsets, indexing or search paths.

VERDICT: APPROVED
```

### lens-platform-semantics-r1

```text
No platform-semantics findings.

Limitations: `pnpm rust:windows:check` and the non-Linux Unix source probe are not established by the supplied evidence. Windows/macOS runtime proof remains with `rust-windows-test` and `rust-macos-test`, with compilation coverage from `rust-platform`. Webview transport proof is Linux-only, and the corrected positive run remains pending.

Read-only review. Same OpenAI model family as implementation, with no family separation.

VERDICT: APPROVED
```

### lens-records-r1

```text
No findings. Source claims, decision receipts, inherited review evidence and negative-runtime results agree with the inspected records.

Unverifiable: the independent root rerun of 447 tests claimed at execution handoff line 15. Retained logs confirm the leaf’s 447 and root’s 23/206/1326 results.

VERDICT: APPROVED
```

### lens-root-cause-r1

```text
No root-cause or prior-fix regression findings. The native producer now emits exact decimal strings, aligning serialization, generated types and JSON persistence. Source-reversal evidence confirms the regressions detect the original mechanism. The prior large-database fix retains its full u64 range.

Limitation: corrected positive application runtime proof and release gates remain pending (confidence: 100).

VERDICT: APPROVED
```

### lens-tests-r1

```text
No findings. Native and formatter revert logs show assertion failures. DS1 and DS2 independently detect numeric IPC and persisted values, with exit 1. Gate selectors include the regression tests.

Limitation: corrected runtime proof, final gates and required remote CI remain pending (confidence: 100).

Review used the same Codex/OpenAI model family as implementation, in a fresh context.

VERDICT: APPROVED
```

## Adopter records closure R2

One fresh read-only records leaf reviewed the committed record delta through 918c0f14b886d0f6c44c4333546ae20dd88d72c7. Role mechanical resolved to gpt-6.1-sol at medium effort. Raw verdict APPROVED, no finding, Fix, Defer or Skip. The exact root447 log locator is confirmed. Root screenshot inspection and historical profile absence are named independently unverifiable observations, not findings. Both profile-absence checks were also rerun as separate shell commands with observed exit0. Source is unchanged from cumulative R1, proven by a code-only diff. Appending this raw report and its provenance adds only the verified review record. Plan authorship and arbitration shared one context. Detection ran on the same model family as the code, in a fresh read-only session.

```text
No findings. Inspected records, source claims, raw R1 reports and retained proof logs agree. The 447-test rerun is confirmed at the supplied locator.

Unverifiable: the root’s screenshot inspection and historical profile-absence observations. No files changed.

VERDICT: APPROVED
```
