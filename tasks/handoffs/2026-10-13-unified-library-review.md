# Reviewed plan handoff — f-20261001-11

Base: `668991ded51df0a6ef0f8f2977f29748e16d3c21`. Candidate: `2026-10-10-unified-library.md`, revision r2.

Assignment: phase 1 Library composition only. Existing phase-2 storage work remains f-20261004-15. Adopter must read the entire plan and this complete review history before implementation or further review. It records the autonomous technical proposals through the decisions writer, implements O1–O5 through the selected executor, and owns implementation proof, cumulative diff review and the authorized release contract. No plan-level issue remains open.

## Reviews

Plan authorship and arbitration share one Codex context. Detection runs on the same OpenAI model family as the intended code executor, through the configured read-only lens ladder. Locate probes are completed source evidence, with no live app verification in this planner run. Raw verdicts and every issue disposition will be appended below.
### Round 1 — initial complete fan-out
Twelve plan-capable lenses completed. Wall time: 128.66 seconds. Two plan-level corrections adopted. No implementation proof commands ran.

#### Raw report — correctness r1
```text
No correctness findings. O1–O4 consistently handle URL B versus stored database A, equal-name collections with different handles, filtered selection, workspace changes, and selected databases hidden during conversion.

Limitation: this is source-backed plan review. Mixed keyboard traversal, redirect execution, and asynchronous behavior after extraction remain unverified until implementation review and the prescribed proof runs (confidence: 95).

VERDICT: APPROVED
```

#### Raw report — error-handling r1
```text
No error-handling findings in O1–O5. The plan preserves independent source failures, typed recovery, cancellation silence and mutation error handling.

Limitation: implementation and runtime behavior remain unverified in this plan-only review (confidence: 100).

VERDICT: APPROVED
```

#### Raw report — minimalism r1
```text
No bloat or duplication defects found. The plan stays within phase 1 and requires reuse of existing controllers, detail panes, hierarchy behavior and background ownership.

Limitation: concrete helper boundaries and duplicate implementations can only be assessed in the implementation diff (confidence: 100).

VERDICT: APPROVED
```

#### Raw report — plan r1
```text
[blocker] tasks/plans/.plan-2026-10-10-unified-library-r1.body.md:121 — The new `src/components/library/` production files have no coverage-area mapping. `coverage-areas.json:89` maps the existing database/file directories, and `scripts/coverage-report.mjs:561` rejects every unmapped production file. The required gates cannot pass within the listed file scope. Include `coverage-areas.json` and the corresponding scope-only `coverage-baselines.json` update, preserving numeric ratchets, or place the composition within an already mapped directory. (confidence: 100)

[should-fix] tasks/plans/.plan-2026-10-10-unified-library-r1.body.md:43 — The traced premises name `AddGames.tsx`, which does not exist. Add-games wiring lives in `src/components/databases/DatabasesPage.tsx:511`, using `runAddGamesToDatabase` from `src/components/databases/databaseMutation.ts:57` and the shared conversion lifecycle. Correct the owner inventory so extraction preserves the actual operation path. (confidence: 100)

VERDICT: REVISE
```

#### Raw report — tests r1
```text
VERDICT: APPROVED
```

#### Raw report — chess-semantics r1
```text
NOT APPLICABLE — O1–O5 cover library navigation, collection search and selection, source-specific panes, listing lifecycle, and UI verification. The listed files and obligation headings propose no changes to in-memory game trees, position identity, move paths, chess parity, or tree round trips.

VERDICT: APPROVED
```

#### Raw report — engine-protocol r1
```text
NOT APPLICABLE: O1–O5 and the scoped files concern library navigation, collection selection, file/database actions, and conversion ownership. They do not change engine process supervision, UCI protocol handling, or asynchronous engine result routing.

VERDICT: APPROVED
```

#### Raw report — ipc-contract r1
```text
No IPC-contract defects found in the plan. O3/O4 preserve typed capability handles, per-operation conversion IDs, the registered event payload and app-level listener ownership. No native command, binding or permission changes are proposed.

Source review only. Runtime verification remains implementation work.

VERDICT: APPROVED
```

#### Raw report — persisted-state r1
```text
No persistence or tab-lifecycle defects found in the plan. O2 introduces no persisted Library state, O3 preserves existing tab creation, and O1 retains capability-authoritative explorer hydration. Existing storage readers and writers remain paired.

This is source-based plan review only. No files changed or proof commands run.

VERDICT: APPROVED
```

#### Raw report — pgn-index r1
```text
NOT APPLICABLE — O1–O5 cover frontend composition, navigation, selection and UI verification. The named files do not change PGN scanning, byte offsets, move encoding, database storage or indexed search. The plan explicitly preserves those contracts and excludes linked-index work.

VERDICT: APPROVED
```

#### Raw report — platform-semantics r1
```text
No platform-semantics findings. O2/O3 require kind-qualified capability identity, preserve native payloads, and prohibit path/name-based identity. The plan introduces no native handle, filesystem, FFI or `cfg` changes.

Verification limitation: planned container pixels and `pnpm verify:app` do not establish Windows or macOS UI behavior. Native runtime evidence remains CI’s `rust-windows-test` and `rust-macos-test`, with target compilation in `rust-platform`.

No proof commands ran during this read-only plan review. Neither `pnpm rust:windows:check` nor the non-Linux Unix source probe ran. Neither is required by the proposed frontend-only mechanism, provided implementation preserves that boundary.

VERDICT: APPROVED
```

#### Raw report — tauri-security r1
```text
NOT APPLICABLE — O1–O5 and FILES cover frontend Library composition, navigation and verification. The plan preserves existing native commands, capability handles, storage and mutation contracts. It introduces no credential/session flow, native filesystem authority change, signed-download verification change or new backend-data payload.

Limitation: this assesses the plan only. An implementation that changes those boundaries requires this lens again.

VERDICT: APPROVED
```

#### Round 1 issue dispositions
| ID | Witness | Claim | Disposition | Authority and evidence | Correction | Dependencies and closure |
| --- | --- | --- | --- | --- | --- | --- |
| P1 | plan r1 finding 1, blocker | New Library directory is unmapped production code, so gates cannot pass within scope. | Fix | MANDATE requires “a new page that composes both existing panes”. `coverage-areas.json` databases-files paths omit Library and `scripts/coverage-report.mjs` assignArea rejects unmapped files. `docs/coverage.md` permits scope-only maintenance while preserving numeric ratchets. | r2 O5 and Phase 1 add Library to the existing area and its baseline scope mirror, preserve numeric metrics/floors and require the frontend coverage gate. No new runtime mechanism. | No dependencies. Await review-plan closure in r2. |
| P2 | plan r1 finding 2, should-fix | AddGames.tsx is a nonexistent operation owner. | Fix | MANDATE requires “detail pane by item type” and retention of actions. Source is DatabasesPage add-games handler plus databaseMutation runAddGamesToDatabase. The handler captures the selected handle before awaits. | r2 Evidence corrections records the real owner and explicitly overrides the archived mistaken round-1 inventory without rewriting frozen history. O3/O4 behavior remains unchanged. | No dependencies. Await review-plan closure in r2. |
### Round 2 — corrections and closure
Four selected lenses completed. Wall time: 169.13 seconds. No new plan-level issues adopted. Review-plan re-ran both P1/P2 witness checks. Correctness, tests and minimalism checked the added coverage obligation.

#### Raw report — plan r2
```text
P1 CLOSED — r2’s O5 and phase scope explicitly include both coverage files and the frontend coverage gate (`tasks/plans/.plan-2026-10-10-unified-library-r2.body.md:102`, `:135`, `:143`). This addresses the unmapped-file rejection and baseline-scope check in `scripts/coverage-report.mjs:561` and `:751`, while preserving numeric ratchets.

P2 CLOSED — the erratum explicitly supersedes the nonexistent owner (`tasks/plans/.plan-2026-10-10-unified-library-r2.body.md:50`). `DatabasesPage.tsx:511` captures the destination before awaiting, `databaseMutation.ts:57` owns the picker/conversion action, and `src/state/atoms.ts:505` owns per-operation registration and cleanup.

No additional defects found in the delta or its affected dependencies.

Limitation: source review only. Implementation and runtime compliance remain unverified. No proof commands ran (confidence: 100).

VERDICT: APPROVED
```

#### Raw report — tests r2
```text
VERDICT: APPROVED
```

#### Raw report — correctness r2
```text
No correctness findings. The coverage mapping and baseline scope mirror agree with the validator’s contract. Add-games retains its captured destination and existing conversion lifecycle.

Limitation: source review only. Implementation and runtime behavior remain unverified (confidence: 100).

VERDICT: APPROVED
```

#### Raw report — minimalism r2
```text
No bloat or duplication findings. P1 adds only the necessary coverage path and scope mirror, preserving numeric ratchets. P2 directs extraction through the existing add-games handler and shared conversion lifecycle.

The smallest sufficient implementation remains one Library composition, reused source behavior, navigation changes and focused proof. The revised plan requires no additional runtime mechanism.

Limitation: concrete helper boundaries, file count and duplication remain assessable only in the implementation diff (confidence: 100).

VERDICT: APPROVED
```

#### Round 2 closure dispositions
| ID | Disposition | Correction and evidence | Closure | Dependencies |
| --- | --- | --- | --- | --- |
| P1 | Fix | O5 and Phase 1 include coverage-areas mapping, baseline scope-only mirror, parsed numeric equality and frontend coverage gate. review-plan r2 explicitly confirmed unmapped-file and baseline-scope rejection are addressed without weakening ratchets. | Closed r2. No runtime proof claimed. | None. |
| P2 | Fix | Evidence corrections identifies DatabasesPage handler, databaseMutation.runAddGamesToDatabase and atoms.runDatabaseConversion as the actual owner path, overriding the archived false filename as implementation guidance. review-plan r2 confirmed the captured handle and per-operation teardown. | Closed r2. No runtime proof claimed. | None. |

All raw reports remain preserved. All reported findings are assigned and closed. No Skip, Defer, withdrawn mechanism or carried correction. No successor finding owns any part of the assigned MANDATE. f-20261004-15 remains the already separate phase-2 storage design. This planner stops before Preflight. No dependencies were installed, source edited, implementation tests run, decision recorded, finding claimed/closed, commit created or push made.

### Round 3 — PLAN-REFRESH drift round (668991de → b7067eb9)
Refresh session `2115e829-0fc3-4ad8-9505-61812d750bd8`, Claude Code orchestrator (Anthropic family), Codex executor lenses (OpenAI family, launcher read-only ladder). The orchestrator also arbitrates. Old base `668991ded51df0a6ef0f8f2977f29748e16d3c21`, new base `b7067eb96825a361712e0671343257f6f531f2c8`: 277 commits, 233 files changed, 64 of them under the plan's paths. Changes under those paths include the database resizable panes (`GridLayout`, `DatabaseView`, `DatabasesPage`), the shared game-opening controls (`GameCard`, `GamePreview`, `GameTable`, `FileCard`), `databaseLoadFailure.ts`, `src/state/atoms.ts` conversion ownership, both coverage scope files, e2e projects and `scripts/verify-app.mjs`. Plan body byte-identical to the r2 snapshot. No plan revision, so no delta step. Each drift lens got the exact diff `drift-668991ded51df0a6ef0f8f2977f29748e16d3c21-b7067eb96825a361712e0671343257f6f531f2c8.diff`, both SHAs and the exact drift scope rule. Governing decisions were the r2 set plus drift decisions touching planned files: d-20261010-11, d-20261012-01/-02, d-20261012-10/-11/-12/-13 and d-20261012-17. REFRESH-LENSES: all twelve r1 lenses. FIRST-LOOK-LENSES: none. Wall time about 122 seconds, measured from just after the last launch to the poll's `completed=12/12`. Zero plan-level issues adopted.

#### Raw verdicts — r3
| Lens | Raw verdict line | Plan findings | Disposition |
| --- | --- | --- | --- |
| plan | `VERDICT: APPROVED` | none; P1, P2 remain closed | — |
| correctness | `VERDICT: APPROVED` | none | — |
| error-handling | `VERDICT: APPROVED` | none (one `OUT-OF-SCOPE:` observation, below) | — |
| minimalism | `VERDICT: APPROVED` | none | — |
| tests | `VERDICT: APPROVED` | none | — |
| chess-semantics | `VERDICT: APPROVED` | none (one `OUT-OF-SCOPE:` observation, below) | — |
| engine-protocol | `VERDICT: APPROVED` | NOT APPLICABLE: engine lifecycle is excluded; engine drift is fixtures and tests only | — |
| ipc-contract | `VERDICT: APPROVED` | none | — |
| persisted-state | `VERDICT: APPROVED` | none (two `OUT-OF-SCOPE:` observations, below) | — |
| pgn-index | `VERDICT: APPROVED` | NOT APPLICABLE: no PGN scanning, offsets, encoding or index change | — |
| platform-semantics | `VERDICT: APPROVED` | none; non-Linux runtime proof stays with CI `rust-windows-test`/`rust-macos-test` | — |
| tauri-security | `VERDICT: APPROVED` | none | — |

#### Out-of-drift-scope observations — already in the ledger, nothing re-filed
Each was checked against `tasks/findings.md` at NEW BASE. All four existed before this refresh and are open, so a new filing would duplicate a pending entry. None invalidates O1–O5, and none is a plan-level issue. None is owned by this MANDATE.
- chess-semantics: `GamePreview.tsx:60` keys the preview tree by PGN text alone, so two games with equal movetext from different start FENs share a tree. Tracked by f-20261012-09 (open, chess-tree, lens). The lens confirms the mechanism is unchanged since OLD BASE.
- error-handling: `GameCard.tsx:45` delete-game rejections are not surfaced. Tracked by f-20261010-02 (open, frontend-ui, lens).
- persisted-state: `src/state/store/database.ts:203` setters publish to memory before an unhandled quota-failing write. Tracked by f-20261010-01 (open, frontend-state, build).
- persisted-state: `src/state/store/database.ts:203` hydration accepts a malformed stored `database`. Tracked by f-20261001-13 (open, frontend-state, lens).

#### Round 3 closure
The plan stands on NEW BASE `b7067eb96825a361712e0671343257f6f531f2c8` unchanged. Totals: 3 completed rounds (r1 128.66 s, r2 169.13 s, r3 about 122 s). Adopted per round: r1=2, r2=0, r3=0. Unique plan-level issues: 2 opened and 2 resolved (P1, P2). None open, withdrawn, carried, skipped or deferred. No correction-introduced defects. No rewrite or split lineage. The adopter must revalidate the actual adoption base again; the Risks section already requires this. The adopter must also reuse the drift's new shared units (opening controls, `databaseLoadFailure`, resizable-pane layout under d-20261012-10..13/-17) rather than duplicate them. Lenses confirmed O1–O5 already require this through reuse of existing controllers and details. No proof commands ran in this planner session.


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
        "text": "tasks/plans/.plan-2026-10-10-unified-library-r1.body.md:121 — The new `src/components/library/` production files have no coverage-area mapping. `coverage-areas.json:89` maps the existing database/file directories, and `scripts/coverage-report.mjs:561` rejects every unmapped production file. The required gates cannot pass within the listed file scope. Include `coverage-areas.json` and the corresponding scope-only `coverage-baselines.json` update, preserving numeric ratchets, or place the composition within an already mapped directory. (confidence: 100)"
      },
      {
        "kind": "should-fix",
        "text": "tasks/plans/.plan-2026-10-10-unified-library-r1.body.md:43 — The traced premises name `AddGames.tsx`, which does not exist. Add-games wiring lives in `src/components/databases/DatabasesPage.tsx:511`, using `runAddGamesToDatabase` from `src/components/databases/databaseMutation.ts:57` and the shared conversion lifecycle. Correct the owner inventory so extraction preserves the actual operation path. (confidence: 100)"
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
    "claim": "New Library production directory has no coverage-area mapping, so required gates cannot pass within listed scope.",
    "closed_round": 2,
    "correction": "r2 O5/Phase 1 map src/components/library/** into databases-files and mirror the scope path only in coverage-baselines, preserving all numeric ratchets and floors, with parsed equality and frontend-coverage proof.",
    "dependencies": [],
    "disposition": "Fix",
    "id": "P1",
    "witnesses": [
      {
        "index": 1,
        "lens": "plan",
        "round": 1
      }
    ]
  },
  {
    "claim": "Traced operation inventory names nonexistent AddGames.tsx instead of the actual add-games handler.",
    "closed_round": 2,
    "correction": "r2 Evidence corrections explicitly overrides the archived false owner with DatabasesPage handler and databaseMutation.runAddGamesToDatabase through the original shared conversion lifecycle and captured handle.",
    "dependencies": [],
    "disposition": "Fix",
    "id": "P2",
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

(identical text already appears above in this handoff)

### lens-chess-semantics-r3.txt

No chess-semantics drift invalidates O1–O5. The plan stands. Review was source-only, with no proof commands run.

OUT-OF-SCOPE: [blocker] src/components/databases/GamePreview.tsx:60 — Already tracked as f-20261012-09. With both parses cached, switch between games sharing `1. e4 *`, one from the standard start and one from `rnbqkbnr/pppppppp/8/8/8/8/1PPPPPPP/RNBQKBNR w KQkq - 0 1`. The `key={pgn}` stays equal, so TreeStateProvider retains the previous tree and displays the wrong a2-pawn position. This mechanism exists unchanged at OLD BASE and is not a drift invalidation. (confidence: 99)

VERDICT: APPROVED
### lens-correctness-r1.txt

(identical text already appears above in this handoff)

### lens-correctness-r2.txt

(identical text already appears above in this handoff)

### lens-correctness-r3.txt

No correctness drift findings. O1–O5 remain consistent with the changed navigation, opening callbacks, source ownership, and retained explorer layout.

Limitation: source review only. Runtime and pixel behavior were not verified, as required by this assignment (confidence: 90).

VERDICT: APPROVED
### lens-engine-protocol-r1.txt

(identical text already appears above in this handoff)

### lens-engine-protocol-r3.txt

NOT APPLICABLE: O1–O5 cover Library composition, collection ownership, navigation and UI proof. Engine lifecycle is explicitly excluded. The scoped engine-related drift concerns verification fixtures and tests, with no engine supervision, UCI state or result-routing contract invalidated by the plan.

VERDICT: APPROVED
### lens-error-handling-r1.txt

(identical text already appears above in this handoff)

### lens-error-handling-r3.txt

No error-handling drift invalidates O1–O5. The plan stands.

OUT-OF-SCOPE: [should-fix] src/components/databases/GameCard.tsx:45 — Delete game drops native deletion and refresh rejections without a user-visible failure. This predates the drift and is already tracked as f-20261010-02 (confidence: 99).

VERDICT: APPROVED
### lens-ipc-contract-r1.txt

(identical text already appears above in this handoff)

### lens-ipc-contract-r3.txt

No IPC-contract drift findings invalidate O1–O5. The traced commands remain Specta-registered, conversion payloads and operation IDs agree on both sides, and capability scopes are unchanged.

Source review only. No proof commands or mutations performed.

VERDICT: APPROVED
### lens-minimalism-r1.txt

(identical text already appears above in this handoff)

### lens-minimalism-r2.txt

(identical text already appears above in this handoff)

### lens-minimalism-r3.txt

No findings. The reviewed drift does not invalidate O1–O5 through bloat or duplication. Existing shared opening, failure and layout units remain reusable under the plan’s composition approach.

VERDICT: APPROVED
### lens-persisted-state-r1.txt

(identical text already appears above in this handoff)

### lens-persisted-state-r3.txt

No drift change invalidates O1–O5 within this lens. The pane-width preference has matching JSON writer/reader, bounded validation and handled storage failures. File and database opening still use the shared tab-storage admission path. The plan stands.

OUT-OF-SCOPE: [should-fix] src/state/store/database.ts:203 — Already tracked as f-20261010-01. When session storage is full, database-view setters publish memory before the unhandled write fails. Reload restores the previous value. The changed opening control still reaches this independent persistence defect (confidence: 100).

OUT-OF-SCOPE: [should-fix] src/state/store/database.ts:203 — Already tracked as f-20261001-13. Hydration accepts a stored database with `file: {}`. Opening its explorer then reaches an invalid capability-key dereference and crashes instead of recovering (confidence: 98).

Source review only. No proof commands or mutations performed.

VERDICT: APPROVED
### lens-pgn-index-r1.txt

(identical text already appears above in this handoff)

### lens-pgn-index-r3.txt

NOT APPLICABLE: O1–O5 concern frontend navigation, collection listings, detail composition and UI proof. The drift files under FILES concern renderer components and verification fixtures. PGN scanning, byte offsets, move encoding, database storage and indexed queries remain explicitly unchanged at plan line 34. O2 searches collection metadata, not stored positions. No applicable drift invalidation identified.

VERDICT: APPROVED
### lens-plan-r1.txt

(identical text already appears above in this handoff)

### lens-plan-r2.txt

(identical text already appears above in this handoff)

### lens-plan-r3.txt

No drift findings. The changed opening controls, preview ownership, explorer layout, coverage mappings and test projects remain compatible with O1–O5 and the supplied governing decisions. P1 and P2 remain closed.

Limitation: source review only. Implementation behavior, pixels and proof-command outcomes remain unverified. No files changed or proof commands ran (confidence: 100).

VERDICT: APPROVED
### lens-platform-semantics-r1.txt

(identical text already appears above in this handoff)

### lens-platform-semantics-r3.txt

No platform-semantics drift findings invalidate O1–O5. The plan stands.

This was source-only review. Neither the non-Linux Unix source probe nor `pnpm rust:windows:check` was run. Windows and macOS native runtime proof remains with `rust-windows-test` and `rust-macos-test`, with compilation covered by `rust-platform`. Linux `verify:app` does not establish other platforms’ behavior.

VERDICT: APPROVED
### lens-tauri-security-r1.txt

(identical text already appears above in this handoff)

### lens-tauri-security-r3.txt

No findings. The reviewed drift does not invalidate O1–O5 within this lens. Database failure presentation retains safe messages, and file opening retains source-owned capability callbacks.

Limitation: this is a plan drift review, not a comprehensive native security audit. No proof commands were run or files changed.

VERDICT: APPROVED
### lens-tests-r1.txt

(identical text already appears above in this handoff)

### lens-tests-r2.txt

(identical text already appears above in this handoff)

### lens-tests-r3.txt

No drift findings. The planned commands still reach the added opening, recovery and responsive-layout assertions. O5 requires adapting them to the mixed Library page and retaining existing regressions.

Limitation: this is source-level plan review. Implementation proof remains pending.

VERDICT: APPROVED
### plan-r1.md

# Unified Library overview

## Goal

Close f-20261001-11 by implementing its already chosen phase 1: one Library destination and one searchable collection list, with the existing file and database detail experiences. This is a reviewed implementation plan only. No implementation, ledger mutation, commit or push belongs to this planner run.

Base: `668991ded51df0a6ef0f8f2977f29748e16d3c21`.

Tier revalidation: retain `build`. Although the product choice is settled, composing two independently owned listings, a hierarchical file list, heterogeneous detail actions and explorer navigation is an integration design change. It is not one mechanically mirrored edit.

## MANDATE

### Games are split across a Files page and a Databases page by storage format, not by what the games are for

* **ID:** f-20261001-11 · **Status:** open · **Area:** frontend-ui · **Root:** - · **Entry:** build · **Blocked:** none
* **Where:** the sidebar routes to `src/components/files/FilesPage.tsx` (PGN files in the workspace folder, typed game/repertoire/tournament/puzzle/other via `src/components/files/file.ts`) and `src/components/databases/DatabasesPage.tsx` (SQLite `.db3` collections built by `convert_pgn`, `src-tauri/src/db/mod.rs:727`; Lichess/Chess.com account sync always writes a database, `src/components/home/AccountCard.tsx:156`).
* **Observation:** Felix (2026-10-01) asked why his own played games ("Meine Partien", 116 games) live under Databases while his opening files live under Files: "in chess space this is all in one list. This is all the same structure. Whether I use my games or an opening preparation." The split is inherited from En Croissant. Technically it is justified — PGN files are editable documents (variations, comments, repertoire practice), databases are indexed copies for position search, player/tournament views, deduplication and the opening-explorer reference — but the UI exposes the storage format as two top-level places, and a user thinks in purposes ("my games", "my Caro-Kann prep").
* **Open question:** how a single library list composes the database detail pane and the file card, and what happens to the two existing routes, once Felix chooses an option below.
* **Decision:** Should ChessFable show one library of everything that holds games — databases and PGN files in a single list, each with a type badge and the actions that fit it — instead of two separate sidebar pages?
  * **(a) One library view.** One sidebar entry; one searchable list with type badges (Games database / Repertoire / Study / Tournament / Puzzle); selecting an item shows the matching detail pane (database stats + Explore, or the file card); storage stays exactly as it is (PGN files stay files, `.db3` stays SQLite) and "Add" offers both "import as database" and "create file". Costs: a new page that composes both existing panes, one merged search/filter, and the two old routes kept as redirects; every Files/Databases e2e snapshot changes.
  * **(b) Keep two pages, explain them.** Rename to purpose-based labels (e.g. "Studies & repertoires" / "Game collections"), add a one-line description on each page and cross-links. Costs: cheap; the split itself stays, so "my games" vs "my prep" still means knowing which format each was imported as.
  * **(c) Keep as is.** No cost; the confusion Felix hit stays for every user.
  * **Ruled out:** converting everything to one storage format. Turning repertoires into databases loses free-form editing and the repertoire practice mode; turning databases into PGN loses indexed position search and the opening explorer over large collections (Mega Database). The formats are right; only the presentation is in question.
  * **Recommend:** (a), because it matches how chess players organise material (ChessBase shows one database window for games and openings, Lichess one study list) and removes the "where did my games go" question at its source, while keeping both technically correct storage formats. Against it: it is the largest of the three, it diverges further from upstream En Croissant's navigation (harder to compare against upstream history), and the two detail panes have quite different actions, so a merged list must make clear why a database row offers "Explore" and a file row offers "Open/Practice".
  * **Product impact:** changes where a user finds and opens their games and repertoires — one place instead of two sidebar pages — and what the sidebar shows.
  * **Session:** e3bd1021-4d34-443f-96c0-a1af650f0984 — transcript
    `~/.claude/projects/*/e3bd1021-4d34-443f-96c0-a1af650f0984.jsonl`
* **Decision made:** (a) one library view, as phase 1 of 'one library + linked collections': one Library sidebar entry replacing Files and Databases, one searchable list of files and databases with type badges, detail pane by item type, /files and /databases redirect; phase 2 (every collection exists once, the PGN file is the truth, linked search index) is filed as its own finding — Felix: in chess space this is all in one list; users think in purposes, not storage formats. Chosen 2026-10-04 after the recommendation was reviewed and approved by the orchestrator and four Codex lenses (review-plan, review-root-cause, review-minimalism, review-pgn-index) over four rounds.

## Threat model and non-goals

Frozen at round 1. Desktop renderer on supported Linux, Windows and macOS, using the existing native capability boundaries. Ordinary user input, duplicate display names, stale listings, failed or cancelled IPC, missing/replaced roots, individual corrupt database metadata and concurrent imports/account synchronization count. Deliberately evasive filesystem attacks and new native boundary hardening are not introduced by this presentation change.

Storage, native commands, capability registration, indexed database queries and PGN semantics stay as implemented. Phase 2 linked collections, PGN writeback, index regeneration, deduplication between formats, account destination changes and one-time linking/migration are f-20261004-15, outside this mandate. Do not invent database purpose metadata or infer collection identity from titles. Existing unrelated mutation/error defects remain separately owned findings. No new persistence schema, watcher, service or external dependency.

## Traced premises

Frozen at round 1. Two completed read-only locate probes inspected the supplied base. Their reports are `probe-1-r1.txt` and `probe-2-r1.txt` in the supplied RUN_TMP. Source locations below are evidence, not an executor's prescribed helper names.

- `src/components/files/FilesPage.tsx` owns a workspace-keyed SWR listing with native request ownership, workspace picker, file mutations, trash and dialogs. `DirectoryTree.tsx` owns recursive filtering, expansion, keyboard opening and file-only drag/drop. `FileCard.tsx` owns its preview paging/cache and stale-result checks. `file.ts` has exactly game, repertoire, tournament, puzzle and other metadata types.
- `src/components/databases/DatabasesPage.tsx` owns the shared `"databases"` listing, selected handle, conversion visibility, picker/retry, reference selection and the database detail controls. Its GeneralSettings child is currently keyed by filename. `src/utils/db.ts` distinguishes successful and error metadata entries and gives native database handle identity.
- `src/components/databases/databaseRoute.ts` uses the URL capability key as authority. `DatabaseView.tsx` hosts the retained explorer. The overview currently clears the active explorer on entry. `Sidebar.tsx` separates destination from active matching and resumes the active explorer when returning from another page.
- `src/state/atoms.ts`, `src/hooks/useConversionProgress.ts`, `AddDatabase.tsx`, `AddGames.tsx` and `src/components/home/AccountCard.tsx` already own per-operation conversion progress and shared database-cache refresh. They must not acquire a second lifecycle owner in Library. Account matching is exact filename through the existing helper.
- Consumers include Sidebar, databaseRoute fallback, DatabaseView Back/missing links, `NoDatabaseWarning.tsx`, and existing database-opening calls in DatabasesPage and InfoPanel. The generated route tree follows file routes. E2E and the real-app harness contain literal old routes, sidebar names and overview selectors.
- Existing tests cover independent root recovery and metadata failures, native request cancellation, conversion ownership, preview caching, stable double-click rows, route/store disagreement and responsive layouts. `e2e/fixtures.ts` can supply files and databases in the same session, rejects unexpected IPC and clears storage on a full document load. `scripts/verify-app.mjs` covers actual pointer double-click, metadata and root recovery.
- This checkout lacks node_modules and a built release app. Planner evidence is source tracing only. The adopting executor installs dependencies and builds through project wrappers before live proof. No live observation is required to settle this composition plan.

## Approach

### O1 — One overview and retained explorer navigation

Authority: "one Library sidebar entry replacing Files and Databases" and "/files and /databases redirect".

Make `/library` the canonical overview. Both old overview URLs redirect to it without rendering old pages. Keep `/databases/$databaseId` as the explorer route with capability-key authority and existing synchronization/not-found behavior. Library is the single sidebar entry for both `/library` and the database explorer scope, using the existing segment-aware active matching and separate destination contract. When an explorer is active, returning through the sidebar resumes it. Entering the overview intentionally clears that active explorer, so explorer Back and missing-database recovery lead to the overview rather than a resume loop.

Update overview destinations in databaseRoute fallback, DatabaseView Back/missing links and NoDatabaseWarning. Retain the database-opening callers' existing capability navigation and store setup. Regenerate the route tree through the existing route tooling. Tests must exercise old URLs, direct explorer URLs, store A versus URL B, overview Back, and sidebar return from Board with an active explorer. Pixel verification must show exactly one Library entry and correct active state.

### O2 — One collection list, one search/filter and one selection

Authority: "one searchable list of files and databases with type badges".

The overview owns one search, one clearable type filter and one transient discriminated selection. Compose file/folder entries and database entries into one collection list with one keyboard/focus model and one scrolling container. Retain file hierarchy, expansion and ancestor context inside that list. Database rows are top-level peers of file-root children. This is one list, with no separate source tabs or independently filtered list panes. Keep the existing file order/hierarchy and deterministic database order from the listing, with no invented cross-source sort setting.

Use native capability identity plus the item kind for keys, selection and detail lifetime. Never join by path text, filename or title. Relists resolve selection against the full current source listing. Filtering does not itself discard a still-existing selection, as on the current pages. A removed item or a changed owning file workspace clears that source's selection. Changing or filtering the other source does not clear it. No persisted library selection, search or filter is introduced.

Search retains current file-name/folder-name and database filename/title/description/error matching. Type filtering uses the existing PGN metadata categories plus a Games database category. Show localized type badges without writing or reinterpreting stored metadata. Folder context remains navigable, and an unmatched folder must not expose unmatched descendant files. Active conversion targets retain their current exclusion and progress presentation. If a selected database becomes an active conversion target, suppress its actionable detail until eligible again, preserving its handle for a successful relist rather than offering operations on an unavailable target.

Reuse or extract the existing file list behavior into the mixed list rather than duplicating its recursive filtering, row gestures or mutation callbacks. Selection must not insert controls above the list or move rows under a stationary pointer. Preserve file Enter/double-click and visible opening action, database Explore, directory expansion and file-only move/drop. Database rows cannot become file move sources or destinations. Verify same-name file/database collision, filtered retained selection, removed selection, hierarchy filtering, keyboard traversal across kinds and the real pointer gesture.

### O3 — Source-specific detail and creation actions

Authority: "detail pane by item type" and "Add offers both import as database and create file".

Extract the current overview's listing/actions and detail presentation enough to compose Library. Do not mount two complete old pages under a new shell and do not retain duplicate overview controllers. The selected kind supplies its existing typed native payload and source callbacks to the matching detail. Keep FileCard preview behavior and directory actions. Keep database stats, reference selection, edit name/description, indexing, Explore, cleanup, player merge, add games, export and deletion. An error-metadata database remains selectable, explains its existing failure, and permits its existing recovery/delete actions without presenting healthy-only operations.

Key detail lifetime by capability identity, including GeneralSettings, so switching different handles with equal filenames resets the correct form and never routes an action to the previous item. Async actions keep the handle captured by their existing source-owned operation. Retain cancellation silence, existing notifications, applied-despite-error refresh and database selection/reference/active/cache invalidation. Do not replace the existing openFile/tab-creation path or preview cache with a generic opener.

Provide one Add surface with clear source-specific choices: existing create-file and create-folder dialogs, and the existing database import/download dialog. File creation uses the selected file folder's existing destination rules. Selecting a database must never supply a file destination. Existing file folder chooser, Rename, metadata edit, Move, Trash, Undo and purge stay reachable. Metadata edits preserve tags and the native sidecar-only contract. Downloads/imports retain their current operation owner, cleanup and success/failure refresh behavior. Test actions against both selected kinds and wrong-kind destination rejection. A focused unit suite proves callback routing, while mixed e2e proves that the controls remain reachable and visibly distinct.

### O4 — Independent listings, failures and shared background work

Authority: "a new page that composes both existing panes" and "storage stays exactly as it is".

Keep the existing independent source request/cache identities and cancellation ownership. File workspace switch invalidates its own selection and listing. Database-root re-selection keeps its existing supersede-before-refresh semantics. Do not serialize listing one source behind success of the other, create a combined all-or-nothing fetch, or turn source failures into empty-success content. Each source has a named, accessible loading/failure/recovery presentation while healthy sibling entries and their selection/detail remain usable. The unified empty state is shown only when both sources succeeded empty. Filtered no-results and source load failure are distinguishable.

The current shared database cache, global conversion registry and app-level progress listener remain the sole owners for import/download/account operations. Compose existing AddDatabase behavior without transferring registry teardown to page unmount. Preserve successful and failed conversion refresh, cancellation handling and account exact-filename matching. An operation continuing across route changes must retain its existing lifecycle and restore eligible database rows on completion. Verify mixed cached/failing sources, root recovery with a late old result, stale preview after switching kind, ongoing import while searching/navigating, and shared-cache refresh from account synchronization. Reuse existing regressions for the unchanged lifecycle plus focused Library integration cases.

### O5 — Responsive, accessible and localized proof

Authority: a "single list" with "actions that fit it" replaces both existing pages, which must remain usable.

Use the established responsive page layout: list/detail side by side when space permits, stacked with page scrolling at narrow widths, bounded list scrolling, and shrinkable children. The combined toolbar and Add choices wrap without hiding primary actions at 320px or at 200% font scale. List semantics must express folders and mixed collection rows consistently, retain focus visibility and keyboard opening, and label source-specific recovery controls and badges. Reuse existing shared icon/action primitives and i18next. Extract translations with the project command, keeping existing file-type meanings.

Adapt route/selector-dependent unit, e2e and real-app assertions to Library rather than merely relying on redirects to keep old tests passing. The actual new mixed page must be covered. Scope real-app error assertions to their source so simultaneous alerts cannot satisfy the wrong check. Use client-side navigation when proving continuity, since full document loads reset the e2e fixture's storage. Inventory full-page screenshots affected by the single-entry sidebar, review the exact intended baseline manifest, and record snapshots only in the pinned container. Leave unrelated component/dialog baselines unchanged unless actually affected and reviewed.

Pixel proof is the complete container suite plus mixed-library and font/breakpoint cases. Behavioral proof is `pnpm verify:app` against the real off-screen Tauri app, including mixed selection and source-appropriate opening, retained existing double-click, root recovery and metadata paths. Add each new standalone harness assertion with a unique message and verify a deliberate failure exits nonzero before restoring it. Native GTK chrome alone remains outside automation. No browser-only run substitutes for either proof.

## Decisions and trade-offs

The recorded product choice is option (a) in MANDATE. This plan resolves technical composition choices without reopening it. Existing d-20260919-11/-12, d-20261001-08, d-20261003-23/-24, d-20261004-06/-07, d-20261007-02/-03/-04, d-20261008-03/-07 and d-20261010-02/-03/-04 govern preserved gestures, layouts, routes, recovery, conversion ownership, metadata and opening affordances. d-20260831-01 governs mutation error classification. New technical choices below are planner proposals, not records attributed to Felix. The adopting session records them through the decisions writer.

## Risks

- Mixed-source ownership is the main regression risk. O2/O4 require independent requests, handle identity and one selection without a new global resource store.
- Sidebar removal affects screenshots beyond the old overview suites. O5 requires a reviewed baseline inventory and the full container suite.
- Neighboring pending work may change opening affordances or listing/error helpers before adoption. Revalidate against the actual adoption base and governing decisions rather than copying stale source lines.
- Known separately owned design issues include f-20261003-09, f-20261004-09, f-20261005-04, f-20261006-07, f-20261007-04 and f-20261009-03. Their current mutation and root limitations are not claimed fixed here. Do not remove their existing regression coverage. If source inspection proves one blocks this MANDATE, identify the dependency instead of silently pulling in its redesign.

## Not part of this change

No linked-index storage design or migration from f-20261004-15. No new collection-purpose editing, changes to PGN parsing, reference indexing, native permission scopes, persisted atoms, account sync destinations, engine lifecycle, payment or external publication. No rewrite of every unrelated source failure or mutation mechanism.

## Phases

### Phase 1 — Compose and verify Library as one integration change

Executor role: normal, unless adoption's actual changed paths hit a Sensitive-Path glob. No new backend or persisted-state write is planned. This is one cohesive phase because splitting extraction and navigation across overlapping overview files would leave a partially integrated surface and duplicate regression ownership.

Files to change, with creation allowed only inside named directories:

- `src/components/library/` (new composition, mixed list, focused tests)
- `src/components/files/` and `src/components/databases/` (extract existing controllers/details, adapt list integration, tests, route helper)
- `src/components/Sidebar.tsx`, `src/components/Sidebar.test.tsx`
- `src/components/panels/database/NoDatabaseWarning.tsx`, relevant existing InfoPanel tests if route expectations change
- `src/routes/library.tsx` and `src/routes/library.lazy.tsx` (new canonical overview), `src/routes/files.tsx`, `src/routes/files.lazy.tsx`, `src/routes/databases/index.tsx`, `src/routes/databases/index.lazy.tsx`, `src/routeTree.gen.ts`
- `src/translation/`
- `e2e/` (mixed fixtures, route/selector assertions and actually affected container baselines)
- `scripts/verify-app.mjs` (Library navigation/selectors and mixed behavior proof)

Before editing, trace the file-route guards and lazy components, replacing the two overview bodies with redirects and removing orphan lazy bodies as appropriate. Do not hand-edit generated route output. Keep unaffected utilities, global conversion ownership and storage unchanged. Implementation brief carries O1–O5 and any carried corrections verbatim. Reuse existing primitives rather than introduce a universal collection backend.

Phase proof, in order, after dependency installation through project conventions:

```bash
pnpm test src/components/library src/components/files src/components/databases src/components/Sidebar.test.tsx src/components/panels/info/InfoPanel.test.tsx src/components/home src/utils/db.test.ts src/utils/files.test.ts src/hooks/useConversionProgress.test.tsx
pnpm gates:contract:check
pnpm checks:pre-review
pnpm app:driver:test
pnpm test:e2e:container --project=database-files --project=async-errors --project=files-preview --project=font-scaled-breakpoints
pnpm build
pnpm verify:app
```

These commands prove O1–O5 at unit, pixel and real-app levels. Update test project scope if the new Library suite is registered separately, retaining all named old coverage. Run `pnpm i18n:extract` and regenerate routes during implementation, then format through oxfmt. Inspect the final cumulative diff and apply the canonical push gate mapping. For the planned frontend-only change, the once-per-task final gate is `pnpm gates:push -- --frontend`, including the full container suite. Any backend/binding or dependency/config scope expansion needs a new gate mapping and review before execution. Record actual command outcomes and durable proof in the adopter's tracked handoff. Planner commands here are future proof, not completed verification.

## Decided autonomously

1. Question: where does the canonical overview live? Chosen: `/library`, with redirects only for the two old overview URLs and the existing explorer URL retained. Rejected: moving explorer URLs or using a resume query guard. Reason: separate overview and explorer identities preserve capability routing and existing return behavior. Reversal: change the overview route/helper destinations and redirects together, retaining deep-link compatibility.
2. Question: how are the two sources composed? Chosen: source-specific controllers/details and a mixed list with transient kind-qualified selection, shared search/filter and existing hierarchy. Rejected: mounting two pages or a universal resource backend. Reason: one user destination requires one interaction model, while unrelated native ownership stays with each source. Reversal: replace the presentation adapter without changing storage or command contracts.
3. Question: what happens when filtering hides selection? Chosen: retain an existing selection against the full listing, temporarily suppress conversion-ineligible database detail, clear only on authoritative removal or owning workspace change. Rejected: clearing on every search and keeping actionable conversion-hidden detail. Reason: preserve current filtering continuity while preventing operations on a target the existing page makes unavailable. Reversal: change transient selection policy and its focused tests together.
4. Question: what labels and persistence does the new filter use? Chosen: existing file categories plus Games database, with local search/filter/selection. Rejected: adding database purpose metadata, guessing purpose or persisting new state. Reason: the chosen phase changes presentation only. Reversal: separately authorize and design metadata or persisted state under the linked-collection scope.
5. Question: who accepts the visible integration in full auto? Chosen: the executor verifies O1–O5 with pinned-container pixels and the actual off-screen app. Rejected: a manual browser-only pass or routing routine automation through Felix. Reason: the project already supplies reproducible pixel and native behavior evidence. Reversal: amend the project verification contract with evidence.

## Carried to diff review

None at round 1.

## Reviews

Plan authorship and arbitration share one Codex context. Detection runs on the same OpenAI model family as the intended code executor, through the configured read-only lens ladder. Locate probes are completed source evidence, with no live app verification in this planner run. Raw verdicts and every issue disposition will be appended below.

### plan-r2.md

# Unified Library overview

## Goal

Close f-20261001-11 by implementing its already chosen phase 1: one Library destination and one searchable collection list, with the existing file and database detail experiences. This is a reviewed implementation plan only. No implementation, ledger mutation, commit or push belongs to this planner run.

Base: `668991ded51df0a6ef0f8f2977f29748e16d3c21`.

Tier revalidation: retain `build`. Although the product choice is settled, composing two independently owned listings, a hierarchical file list, heterogeneous detail actions and explorer navigation is an integration design change. It is not one mechanically mirrored edit.

## MANDATE

### Games are split across a Files page and a Databases page by storage format, not by what the games are for

* **ID:** f-20261001-11 · **Status:** open · **Area:** frontend-ui · **Root:** - · **Entry:** build · **Blocked:** none
* **Where:** the sidebar routes to `src/components/files/FilesPage.tsx` (PGN files in the workspace folder, typed game/repertoire/tournament/puzzle/other via `src/components/files/file.ts`) and `src/components/databases/DatabasesPage.tsx` (SQLite `.db3` collections built by `convert_pgn`, `src-tauri/src/db/mod.rs:727`; Lichess/Chess.com account sync always writes a database, `src/components/home/AccountCard.tsx:156`).
* **Observation:** Felix (2026-10-01) asked why his own played games ("Meine Partien", 116 games) live under Databases while his opening files live under Files: "in chess space this is all in one list. This is all the same structure. Whether I use my games or an opening preparation." The split is inherited from En Croissant. Technically it is justified — PGN files are editable documents (variations, comments, repertoire practice), databases are indexed copies for position search, player/tournament views, deduplication and the opening-explorer reference — but the UI exposes the storage format as two top-level places, and a user thinks in purposes ("my games", "my Caro-Kann prep").
* **Open question:** how a single library list composes the database detail pane and the file card, and what happens to the two existing routes, once Felix chooses an option below.
* **Decision:** Should ChessFable show one library of everything that holds games — databases and PGN files in a single list, each with a type badge and the actions that fit it — instead of two separate sidebar pages?
  * **(a) One library view.** One sidebar entry; one searchable list with type badges (Games database / Repertoire / Study / Tournament / Puzzle); selecting an item shows the matching detail pane (database stats + Explore, or the file card); storage stays exactly as it is (PGN files stay files, `.db3` stays SQLite) and "Add" offers both "import as database" and "create file". Costs: a new page that composes both existing panes, one merged search/filter, and the two old routes kept as redirects; every Files/Databases e2e snapshot changes.
  * **(b) Keep two pages, explain them.** Rename to purpose-based labels (e.g. "Studies & repertoires" / "Game collections"), add a one-line description on each page and cross-links. Costs: cheap; the split itself stays, so "my games" vs "my prep" still means knowing which format each was imported as.
  * **(c) Keep as is.** No cost; the confusion Felix hit stays for every user.
  * **Ruled out:** converting everything to one storage format. Turning repertoires into databases loses free-form editing and the repertoire practice mode; turning databases into PGN loses indexed position search and the opening explorer over large collections (Mega Database). The formats are right; only the presentation is in question.
  * **Recommend:** (a), because it matches how chess players organise material (ChessBase shows one database window for games and openings, Lichess one study list) and removes the "where did my games go" question at its source, while keeping both technically correct storage formats. Against it: it is the largest of the three, it diverges further from upstream En Croissant's navigation (harder to compare against upstream history), and the two detail panes have quite different actions, so a merged list must make clear why a database row offers "Explore" and a file row offers "Open/Practice".
  * **Product impact:** changes where a user finds and opens their games and repertoires — one place instead of two sidebar pages — and what the sidebar shows.
  * **Session:** e3bd1021-4d34-443f-96c0-a1af650f0984 — transcript
    `~/.claude/projects/*/e3bd1021-4d34-443f-96c0-a1af650f0984.jsonl`
* **Decision made:** (a) one library view, as phase 1 of 'one library + linked collections': one Library sidebar entry replacing Files and Databases, one searchable list of files and databases with type badges, detail pane by item type, /files and /databases redirect; phase 2 (every collection exists once, the PGN file is the truth, linked search index) is filed as its own finding — Felix: in chess space this is all in one list; users think in purposes, not storage formats. Chosen 2026-10-04 after the recommendation was reviewed and approved by the orchestrator and four Codex lenses (review-plan, review-root-cause, review-minimalism, review-pgn-index) over four rounds.

## Threat model and non-goals

Frozen at round 1. Desktop renderer on supported Linux, Windows and macOS, using the existing native capability boundaries. Ordinary user input, duplicate display names, stale listings, failed or cancelled IPC, missing/replaced roots, individual corrupt database metadata and concurrent imports/account synchronization count. Deliberately evasive filesystem attacks and new native boundary hardening are not introduced by this presentation change.

Storage, native commands, capability registration, indexed database queries and PGN semantics stay as implemented. Phase 2 linked collections, PGN writeback, index regeneration, deduplication between formats, account destination changes and one-time linking/migration are f-20261004-15, outside this mandate. Do not invent database purpose metadata or infer collection identity from titles. Existing unrelated mutation/error defects remain separately owned findings. No new persistence schema, watcher, service or external dependency.

## Traced premises

Frozen at round 1. Two completed read-only locate probes inspected the supplied base. Their reports are `probe-1-r1.txt` and `probe-2-r1.txt` in the supplied RUN_TMP. Source locations below are evidence, not an executor's prescribed helper names.

- `src/components/files/FilesPage.tsx` owns a workspace-keyed SWR listing with native request ownership, workspace picker, file mutations, trash and dialogs. `DirectoryTree.tsx` owns recursive filtering, expansion, keyboard opening and file-only drag/drop. `FileCard.tsx` owns its preview paging/cache and stale-result checks. `file.ts` has exactly game, repertoire, tournament, puzzle and other metadata types.
- `src/components/databases/DatabasesPage.tsx` owns the shared `"databases"` listing, selected handle, conversion visibility, picker/retry, reference selection and the database detail controls. Its GeneralSettings child is currently keyed by filename. `src/utils/db.ts` distinguishes successful and error metadata entries and gives native database handle identity.
- `src/components/databases/databaseRoute.ts` uses the URL capability key as authority. `DatabaseView.tsx` hosts the retained explorer. The overview currently clears the active explorer on entry. `Sidebar.tsx` separates destination from active matching and resumes the active explorer when returning from another page.
- `src/state/atoms.ts`, `src/hooks/useConversionProgress.ts`, `AddDatabase.tsx`, `AddGames.tsx` and `src/components/home/AccountCard.tsx` already own per-operation conversion progress and shared database-cache refresh. They must not acquire a second lifecycle owner in Library. Account matching is exact filename through the existing helper.
- Consumers include Sidebar, databaseRoute fallback, DatabaseView Back/missing links, `NoDatabaseWarning.tsx`, and existing database-opening calls in DatabasesPage and InfoPanel. The generated route tree follows file routes. E2E and the real-app harness contain literal old routes, sidebar names and overview selectors.
- Existing tests cover independent root recovery and metadata failures, native request cancellation, conversion ownership, preview caching, stable double-click rows, route/store disagreement and responsive layouts. `e2e/fixtures.ts` can supply files and databases in the same session, rejects unexpected IPC and clears storage on a full document load. `scripts/verify-app.mjs` covers actual pointer double-click, metadata and root recovery.
- This checkout lacks node_modules and a built release app. Planner evidence is source tracing only. The adopting executor installs dependencies and builds through project wrappers before live proof. No live observation is required to settle this composition plan.

## Evidence corrections

P2, round 2: the frozen round-1 inventory incorrectly named `AddGames.tsx`. No such file exists. The actual add-games action is the handler in `src/components/databases/DatabasesPage.tsx`, which captures `selectedDatabase.file` before awaiting and calls `runAddGamesToDatabase` from `src/components/databases/databaseMutation.ts` through the existing `runDatabaseConversion` lifecycle. Use that path as the authoritative extraction inventory. The incorrect round-1 statement remains in the frozen block only as review history, not as an implementation instruction. The source contract and operation ownership are unchanged.

## Approach

### O1 — One overview and retained explorer navigation

Authority: "one Library sidebar entry replacing Files and Databases" and "/files and /databases redirect".

Make `/library` the canonical overview. Both old overview URLs redirect to it without rendering old pages. Keep `/databases/$databaseId` as the explorer route with capability-key authority and existing synchronization/not-found behavior. Library is the single sidebar entry for both `/library` and the database explorer scope, using the existing segment-aware active matching and separate destination contract. When an explorer is active, returning through the sidebar resumes it. Entering the overview intentionally clears that active explorer, so explorer Back and missing-database recovery lead to the overview rather than a resume loop.

Update overview destinations in databaseRoute fallback, DatabaseView Back/missing links and NoDatabaseWarning. Retain the database-opening callers' existing capability navigation and store setup. Regenerate the route tree through the existing route tooling. Tests must exercise old URLs, direct explorer URLs, store A versus URL B, overview Back, and sidebar return from Board with an active explorer. Pixel verification must show exactly one Library entry and correct active state.

### O2 — One collection list, one search/filter and one selection

Authority: "one searchable list of files and databases with type badges".

The overview owns one search, one clearable type filter and one transient discriminated selection. Compose file/folder entries and database entries into one collection list with one keyboard/focus model and one scrolling container. Retain file hierarchy, expansion and ancestor context inside that list. Database rows are top-level peers of file-root children. This is one list, with no separate source tabs or independently filtered list panes. Keep the existing file order/hierarchy and deterministic database order from the listing, with no invented cross-source sort setting.

Use native capability identity plus the item kind for keys, selection and detail lifetime. Never join by path text, filename or title. Relists resolve selection against the full current source listing. Filtering does not itself discard a still-existing selection, as on the current pages. A removed item or a changed owning file workspace clears that source's selection. Changing or filtering the other source does not clear it. No persisted library selection, search or filter is introduced.

Search retains current file-name/folder-name and database filename/title/description/error matching. Type filtering uses the existing PGN metadata categories plus a Games database category. Show localized type badges without writing or reinterpreting stored metadata. Folder context remains navigable, and an unmatched folder must not expose unmatched descendant files. Active conversion targets retain their current exclusion and progress presentation. If a selected database becomes an active conversion target, suppress its actionable detail until eligible again, preserving its handle for a successful relist rather than offering operations on an unavailable target.

Reuse or extract the existing file list behavior into the mixed list rather than duplicating its recursive filtering, row gestures or mutation callbacks. Selection must not insert controls above the list or move rows under a stationary pointer. Preserve file Enter/double-click and visible opening action, database Explore, directory expansion and file-only move/drop. Database rows cannot become file move sources or destinations. Verify same-name file/database collision, filtered retained selection, removed selection, hierarchy filtering, keyboard traversal across kinds and the real pointer gesture.

### O3 — Source-specific detail and creation actions

Authority: "detail pane by item type" and "Add offers both import as database and create file".

Extract the current overview's listing/actions and detail presentation enough to compose Library. Do not mount two complete old pages under a new shell and do not retain duplicate overview controllers. The selected kind supplies its existing typed native payload and source callbacks to the matching detail. Keep FileCard preview behavior and directory actions. Keep database stats, reference selection, edit name/description, indexing, Explore, cleanup, player merge, add games, export and deletion. An error-metadata database remains selectable, explains its existing failure, and permits its existing recovery/delete actions without presenting healthy-only operations.

Key detail lifetime by capability identity, including GeneralSettings, so switching different handles with equal filenames resets the correct form and never routes an action to the previous item. Async actions keep the handle captured by their existing source-owned operation. Retain cancellation silence, existing notifications, applied-despite-error refresh and database selection/reference/active/cache invalidation. Do not replace the existing openFile/tab-creation path or preview cache with a generic opener.

Provide one Add surface with clear source-specific choices: existing create-file and create-folder dialogs, and the existing database import/download dialog. File creation uses the selected file folder's existing destination rules. Selecting a database must never supply a file destination. Existing file folder chooser, Rename, metadata edit, Move, Trash, Undo and purge stay reachable. Metadata edits preserve tags and the native sidecar-only contract. Downloads/imports retain their current operation owner, cleanup and success/failure refresh behavior. Test actions against both selected kinds and wrong-kind destination rejection. A focused unit suite proves callback routing, while mixed e2e proves that the controls remain reachable and visibly distinct.

### O4 — Independent listings, failures and shared background work

Authority: "a new page that composes both existing panes" and "storage stays exactly as it is".

Keep the existing independent source request/cache identities and cancellation ownership. File workspace switch invalidates its own selection and listing. Database-root re-selection keeps its existing supersede-before-refresh semantics. Do not serialize listing one source behind success of the other, create a combined all-or-nothing fetch, or turn source failures into empty-success content. Each source has a named, accessible loading/failure/recovery presentation while healthy sibling entries and their selection/detail remain usable. The unified empty state is shown only when both sources succeeded empty. Filtered no-results and source load failure are distinguishable.

The current shared database cache, global conversion registry and app-level progress listener remain the sole owners for import/download/account operations. Compose existing AddDatabase behavior without transferring registry teardown to page unmount. Preserve successful and failed conversion refresh, cancellation handling and account exact-filename matching. An operation continuing across route changes must retain its existing lifecycle and restore eligible database rows on completion. Verify mixed cached/failing sources, root recovery with a late old result, stale preview after switching kind, ongoing import while searching/navigating, and shared-cache refresh from account synchronization. Reuse existing regressions for the unchanged lifecycle plus focused Library integration cases.

### O5 — Responsive, accessible and localized proof

Authority: a "single list" with "actions that fit it" replaces both existing pages, which must remain usable.

Use the established responsive page layout: list/detail side by side when space permits, stacked with page scrolling at narrow widths, bounded list scrolling, and shrinkable children. The combined toolbar and Add choices wrap without hiding primary actions at 320px or at 200% font scale. List semantics must express folders and mixed collection rows consistently, retain focus visibility and keyboard opening, and label source-specific recovery controls and badges. Reuse existing shared icon/action primitives and i18next. Extract translations with the project command, keeping existing file-type meanings.

Adapt route/selector-dependent unit, e2e and real-app assertions to Library rather than merely relying on redirects to keep old tests passing. The actual new mixed page must be covered. Scope real-app error assertions to their source so simultaneous alerts cannot satisfy the wrong check. Use client-side navigation when proving continuity, since full document loads reset the e2e fixture's storage. Inventory full-page screenshots affected by the single-entry sidebar, review the exact intended baseline manifest, and record snapshots only in the pinned container. Leave unrelated component/dialog baselines unchanged unless actually affected and reviewed.

Pixel proof is the complete container suite plus mixed-library and font/breakpoint cases. Behavioral proof is `pnpm verify:app` against the real off-screen Tauri app, including mixed selection and source-appropriate opening, retained existing double-click, root recovery and metadata paths. Add each new standalone harness assertion with a unique message and verify a deliberate failure exits nonzero before restoring it. Native GTK chrome alone remains outside automation. No browser-only run substitutes for either proof.

The new production directory must remain measured. Add `src/components/library/**` to the existing `databases-files` area's paths in `coverage-areas.json`, and make the matching path-only change in `coverage-baselines.json` under `scope.areas`. Preserve all numeric baseline `areas`, every minimum floor, every existing path and the include/exclude/statement-free declarations. Compare parsed baseline `areas` before and after and require equality. This is the documented scope-mapping maintenance procedure, not a baseline refresh. Run the existing frontend coverage gate against the unchanged numeric ratchet. If it is red, repair meaningful behavioral coverage rather than lower or rewrite it.

## Decisions and trade-offs

The recorded product choice is option (a) in MANDATE. This plan resolves technical composition choices without reopening it. Existing d-20260919-11/-12, d-20261001-08, d-20261003-23/-24, d-20261004-06/-07, d-20261007-02/-03/-04, d-20261008-03/-07 and d-20261010-02/-03/-04 govern preserved gestures, layouts, routes, recovery, conversion ownership, metadata and opening affordances. d-20260831-01 governs mutation error classification. New technical choices below are planner proposals, not records attributed to Felix. The adopting session records them through the decisions writer.

## Risks

- Mixed-source ownership is the main regression risk. O2/O4 require independent requests, handle identity and one selection without a new global resource store.
- Sidebar removal affects screenshots beyond the old overview suites. O5 requires a reviewed baseline inventory and the full container suite.
- Neighboring pending work may change opening affordances or listing/error helpers before adoption. Revalidate against the actual adoption base and governing decisions rather than copying stale source lines.
- Known separately owned design issues include f-20261003-09, f-20261004-09, f-20261005-04, f-20261006-07, f-20261007-04 and f-20261009-03. Their current mutation and root limitations are not claimed fixed here. Do not remove their existing regression coverage. If source inspection proves one blocks this MANDATE, identify the dependency instead of silently pulling in its redesign.

## Not part of this change

No linked-index storage design or migration from f-20261004-15. No new collection-purpose editing, changes to PGN parsing, reference indexing, native permission scopes, persisted atoms, account sync destinations, engine lifecycle, payment or external publication. No rewrite of every unrelated source failure or mutation mechanism.

## Phases

### Phase 1 — Compose and verify Library as one integration change

Executor role: normal, unless adoption's actual changed paths hit a Sensitive-Path glob. No new backend or persisted-state write is planned. This is one cohesive phase because splitting extraction and navigation across overlapping overview files would leave a partially integrated surface and duplicate regression ownership.

Files to change, with creation allowed only inside named directories:

- `src/components/library/` (new composition, mixed list, focused tests)
- `src/components/files/` and `src/components/databases/` (extract existing controllers/details, adapt list integration, tests, route helper)
- `src/components/Sidebar.tsx`, `src/components/Sidebar.test.tsx`
- `src/components/panels/database/NoDatabaseWarning.tsx`, relevant existing InfoPanel tests if route expectations change
- `src/routes/library.tsx` and `src/routes/library.lazy.tsx` (new canonical overview), `src/routes/files.tsx`, `src/routes/files.lazy.tsx`, `src/routes/databases/index.tsx`, `src/routes/databases/index.lazy.tsx`, `src/routeTree.gen.ts`
- `src/translation/`
- `e2e/` (mixed fixtures, route/selector assertions and actually affected container baselines)
- `scripts/verify-app.mjs` (Library navigation/selectors and mixed behavior proof)
- `coverage-areas.json`, `coverage-baselines.json` (Library mapping in the existing area and scope-only baseline mirror)

Before editing, trace the file-route guards and lazy components, replacing the two overview bodies with redirects and removing orphan lazy bodies as appropriate. Do not hand-edit generated route output. Keep unaffected utilities, global conversion ownership and storage unchanged. Implementation brief carries O1–O5 and any carried corrections verbatim. Reuse existing primitives rather than introduce a universal collection backend.

Phase proof, in order, after dependency installation through project conventions:

```bash
pnpm test src/components/library src/components/files src/components/databases src/components/Sidebar.test.tsx src/components/panels/info/InfoPanel.test.tsx src/components/home src/utils/db.test.ts src/utils/files.test.ts src/hooks/useConversionProgress.test.tsx
pnpm gate:ensure frontend-coverage
pnpm gates:contract:check
pnpm checks:pre-review
pnpm app:driver:test
pnpm test:e2e:container --project=database-files --project=async-errors --project=files-preview --project=font-scaled-breakpoints
pnpm build
pnpm verify:app
```

These commands prove O1–O5 at unit, pixel and real-app levels. Update test project scope if the new Library suite is registered separately, retaining all named old coverage. Run `pnpm i18n:extract` and regenerate routes during implementation, then format through oxfmt. Inspect the final cumulative diff and apply the canonical push gate mapping. For the planned frontend-only change, the once-per-task final gate is `pnpm gates:push -- --frontend`, including the full container suite. Any backend/binding or dependency/config scope expansion needs a new gate mapping and review before execution. Record actual command outcomes and durable proof in the adopter's tracked handoff. Planner commands here are future proof, not completed verification.

## Decided autonomously

1. Question: where does the canonical overview live? Chosen: `/library`, with redirects only for the two old overview URLs and the existing explorer URL retained. Rejected: moving explorer URLs or using a resume query guard. Reason: separate overview and explorer identities preserve capability routing and existing return behavior. Reversal: change the overview route/helper destinations and redirects together, retaining deep-link compatibility.
2. Question: how are the two sources composed? Chosen: source-specific controllers/details and a mixed list with transient kind-qualified selection, shared search/filter and existing hierarchy. Rejected: mounting two pages or a universal resource backend. Reason: one user destination requires one interaction model, while unrelated native ownership stays with each source. Reversal: replace the presentation adapter without changing storage or command contracts.
3. Question: what happens when filtering hides selection? Chosen: retain an existing selection against the full listing, temporarily suppress conversion-ineligible database detail, clear only on authoritative removal or owning workspace change. Rejected: clearing on every search and keeping actionable conversion-hidden detail. Reason: preserve current filtering continuity while preventing operations on a target the existing page makes unavailable. Reversal: change transient selection policy and its focused tests together.
4. Question: what labels and persistence does the new filter use? Chosen: existing file categories plus Games database, with local search/filter/selection. Rejected: adding database purpose metadata, guessing purpose or persisting new state. Reason: the chosen phase changes presentation only. Reversal: separately authorize and design metadata or persisted state under the linked-collection scope.
5. Question: who accepts the visible integration in full auto? Chosen: the executor verifies O1–O5 with pinned-container pixels and the actual off-screen app. Rejected: a manual browser-only pass or routing routine automation through Felix. Reason: the project already supplies reproducible pixel and native behavior evidence. Reversal: amend the project verification contract with evidence.

## Carried to diff review

None at round 1.

## Reviews

Plan authorship and arbitration share one Codex context. Detection runs on the same OpenAI model family as the intended code executor, through the configured read-only lens ladder. Locate probes are completed source evidence, with no live app verification in this planner run. Raw verdicts and every issue disposition will be appended below.
### Round 1 — initial complete fan-out
Twelve plan-capable lenses completed. Wall time: 128.66 seconds. Two plan-level corrections adopted. No implementation proof commands ran.

#### Raw report — correctness r1
```text
No correctness findings. O1–O4 consistently handle URL B versus stored database A, equal-name collections with different handles, filtered selection, workspace changes, and selected databases hidden during conversion.

Limitation: this is source-backed plan review. Mixed keyboard traversal, redirect execution, and asynchronous behavior after extraction remain unverified until implementation review and the prescribed proof runs (confidence: 95).

VERDICT: APPROVED
```

#### Raw report — error-handling r1
```text
No error-handling findings in O1–O5. The plan preserves independent source failures, typed recovery, cancellation silence and mutation error handling.

Limitation: implementation and runtime behavior remain unverified in this plan-only review (confidence: 100).

VERDICT: APPROVED
```

#### Raw report — minimalism r1
```text
No bloat or duplication defects found. The plan stays within phase 1 and requires reuse of existing controllers, detail panes, hierarchy behavior and background ownership.

Limitation: concrete helper boundaries and duplicate implementations can only be assessed in the implementation diff (confidence: 100).

VERDICT: APPROVED
```

#### Raw report — plan r1
```text
[blocker] tasks/plans/.plan-2026-10-10-unified-library-r1.body.md:121 — The new `src/components/library/` production files have no coverage-area mapping. `coverage-areas.json:89` maps the existing database/file directories, and `scripts/coverage-report.mjs:561` rejects every unmapped production file. The required gates cannot pass within the listed file scope. Include `coverage-areas.json` and the corresponding scope-only `coverage-baselines.json` update, preserving numeric ratchets, or place the composition within an already mapped directory. (confidence: 100)

[should-fix] tasks/plans/.plan-2026-10-10-unified-library-r1.body.md:43 — The traced premises name `AddGames.tsx`, which does not exist. Add-games wiring lives in `src/components/databases/DatabasesPage.tsx:511`, using `runAddGamesToDatabase` from `src/components/databases/databaseMutation.ts:57` and the shared conversion lifecycle. Correct the owner inventory so extraction preserves the actual operation path. (confidence: 100)

VERDICT: REVISE
```

#### Raw report — tests r1
```text
VERDICT: APPROVED
```

#### Raw report — chess-semantics r1
```text
NOT APPLICABLE — O1–O5 cover library navigation, collection search and selection, source-specific panes, listing lifecycle, and UI verification. The listed files and obligation headings propose no changes to in-memory game trees, position identity, move paths, chess parity, or tree round trips.

VERDICT: APPROVED
```

#### Raw report — engine-protocol r1
```text
NOT APPLICABLE: O1–O5 and the scoped files concern library navigation, collection selection, file/database actions, and conversion ownership. They do not change engine process supervision, UCI protocol handling, or asynchronous engine result routing.

VERDICT: APPROVED
```

#### Raw report — ipc-contract r1
```text
No IPC-contract defects found in the plan. O3/O4 preserve typed capability handles, per-operation conversion IDs, the registered event payload and app-level listener ownership. No native command, binding or permission changes are proposed.

Source review only. Runtime verification remains implementation work.

VERDICT: APPROVED
```

#### Raw report — persisted-state r1
```text
No persistence or tab-lifecycle defects found in the plan. O2 introduces no persisted Library state, O3 preserves existing tab creation, and O1 retains capability-authoritative explorer hydration. Existing storage readers and writers remain paired.

This is source-based plan review only. No files changed or proof commands run.

VERDICT: APPROVED
```

#### Raw report — pgn-index r1
```text
NOT APPLICABLE — O1–O5 cover frontend composition, navigation, selection and UI verification. The named files do not change PGN scanning, byte offsets, move encoding, database storage or indexed search. The plan explicitly preserves those contracts and excludes linked-index work.

VERDICT: APPROVED
```

#### Raw report — platform-semantics r1
```text
No platform-semantics findings. O2/O3 require kind-qualified capability identity, preserve native payloads, and prohibit path/name-based identity. The plan introduces no native handle, filesystem, FFI or `cfg` changes.

Verification limitation: planned container pixels and `pnpm verify:app` do not establish Windows or macOS UI behavior. Native runtime evidence remains CI’s `rust-windows-test` and `rust-macos-test`, with target compilation in `rust-platform`.

No proof commands ran during this read-only plan review. Neither `pnpm rust:windows:check` nor the non-Linux Unix source probe ran. Neither is required by the proposed frontend-only mechanism, provided implementation preserves that boundary.

VERDICT: APPROVED
```

#### Raw report — tauri-security r1
```text
NOT APPLICABLE — O1–O5 and FILES cover frontend Library composition, navigation and verification. The plan preserves existing native commands, capability handles, storage and mutation contracts. It introduces no credential/session flow, native filesystem authority change, signed-download verification change or new backend-data payload.

Limitation: this assesses the plan only. An implementation that changes those boundaries requires this lens again.

VERDICT: APPROVED
```

#### Round 1 issue dispositions
| ID | Witness | Claim | Disposition | Authority and evidence | Correction | Dependencies and closure |
| --- | --- | --- | --- | --- | --- | --- |
| P1 | plan r1 finding 1, blocker | New Library directory is unmapped production code, so gates cannot pass within scope. | Fix | MANDATE requires “a new page that composes both existing panes”. `coverage-areas.json` databases-files paths omit Library and `scripts/coverage-report.mjs` assignArea rejects unmapped files. `docs/coverage.md` permits scope-only maintenance while preserving numeric ratchets. | r2 O5 and Phase 1 add Library to the existing area and its baseline scope mirror, preserve numeric metrics/floors and require the frontend coverage gate. No new runtime mechanism. | No dependencies. Await review-plan closure in r2. |
| P2 | plan r1 finding 2, should-fix | AddGames.tsx is a nonexistent operation owner. | Fix | MANDATE requires “detail pane by item type” and retention of actions. Source is DatabasesPage add-games handler plus databaseMutation runAddGamesToDatabase. The handler captures the selected handle before awaits. | r2 Evidence corrections records the real owner and explicitly overrides the archived mistaken round-1 inventory without rewriting frozen history. O3/O4 behavior remains unchanged. | No dependencies. Await review-plan closure in r2. |

### plan-r3.md

# Unified Library overview

## Goal

Close f-20261001-11 by implementing its already chosen phase 1: one Library destination and one searchable collection list, with the existing file and database detail experiences. This is a reviewed implementation plan only. No implementation, ledger mutation, commit or push belongs to this planner run.

Base: `668991ded51df0a6ef0f8f2977f29748e16d3c21`.

Tier revalidation: retain `build`. Although the product choice is settled, composing two independently owned listings, a hierarchical file list, heterogeneous detail actions and explorer navigation is an integration design change. It is not one mechanically mirrored edit.

## MANDATE

### Games are split across a Files page and a Databases page by storage format, not by what the games are for

* **ID:** f-20261001-11 · **Status:** open · **Area:** frontend-ui · **Root:** - · **Entry:** build · **Blocked:** none
* **Where:** the sidebar routes to `src/components/files/FilesPage.tsx` (PGN files in the workspace folder, typed game/repertoire/tournament/puzzle/other via `src/components/files/file.ts`) and `src/components/databases/DatabasesPage.tsx` (SQLite `.db3` collections built by `convert_pgn`, `src-tauri/src/db/mod.rs:727`; Lichess/Chess.com account sync always writes a database, `src/components/home/AccountCard.tsx:156`).
* **Observation:** Felix (2026-10-01) asked why his own played games ("Meine Partien", 116 games) live under Databases while his opening files live under Files: "in chess space this is all in one list. This is all the same structure. Whether I use my games or an opening preparation." The split is inherited from En Croissant. Technically it is justified — PGN files are editable documents (variations, comments, repertoire practice), databases are indexed copies for position search, player/tournament views, deduplication and the opening-explorer reference — but the UI exposes the storage format as two top-level places, and a user thinks in purposes ("my games", "my Caro-Kann prep").
* **Open question:** how a single library list composes the database detail pane and the file card, and what happens to the two existing routes, once Felix chooses an option below.
* **Decision:** Should ChessFable show one library of everything that holds games — databases and PGN files in a single list, each with a type badge and the actions that fit it — instead of two separate sidebar pages?
  * **(a) One library view.** One sidebar entry; one searchable list with type badges (Games database / Repertoire / Study / Tournament / Puzzle); selecting an item shows the matching detail pane (database stats + Explore, or the file card); storage stays exactly as it is (PGN files stay files, `.db3` stays SQLite) and "Add" offers both "import as database" and "create file". Costs: a new page that composes both existing panes, one merged search/filter, and the two old routes kept as redirects; every Files/Databases e2e snapshot changes.
  * **(b) Keep two pages, explain them.** Rename to purpose-based labels (e.g. "Studies & repertoires" / "Game collections"), add a one-line description on each page and cross-links. Costs: cheap; the split itself stays, so "my games" vs "my prep" still means knowing which format each was imported as.
  * **(c) Keep as is.** No cost; the confusion Felix hit stays for every user.
  * **Ruled out:** converting everything to one storage format. Turning repertoires into databases loses free-form editing and the repertoire practice mode; turning databases into PGN loses indexed position search and the opening explorer over large collections (Mega Database). The formats are right; only the presentation is in question.
  * **Recommend:** (a), because it matches how chess players organise material (ChessBase shows one database window for games and openings, Lichess one study list) and removes the "where did my games go" question at its source, while keeping both technically correct storage formats. Against it: it is the largest of the three, it diverges further from upstream En Croissant's navigation (harder to compare against upstream history), and the two detail panes have quite different actions, so a merged list must make clear why a database row offers "Explore" and a file row offers "Open/Practice".
  * **Product impact:** changes where a user finds and opens their games and repertoires — one place instead of two sidebar pages — and what the sidebar shows.
  * **Session:** e3bd1021-4d34-443f-96c0-a1af650f0984 — transcript
    `~/.claude/projects/*/e3bd1021-4d34-443f-96c0-a1af650f0984.jsonl`
* **Decision made:** (a) one library view, as phase 1 of 'one library + linked collections': one Library sidebar entry replacing Files and Databases, one searchable list of files and databases with type badges, detail pane by item type, /files and /databases redirect; phase 2 (every collection exists once, the PGN file is the truth, linked search index) is filed as its own finding — Felix: in chess space this is all in one list; users think in purposes, not storage formats. Chosen 2026-10-04 after the recommendation was reviewed and approved by the orchestrator and four Codex lenses (review-plan, review-root-cause, review-minimalism, review-pgn-index) over four rounds.

## Threat model and non-goals

Frozen at round 1. Desktop renderer on supported Linux, Windows and macOS, using the existing native capability boundaries. Ordinary user input, duplicate display names, stale listings, failed or cancelled IPC, missing/replaced roots, individual corrupt database metadata and concurrent imports/account synchronization count. Deliberately evasive filesystem attacks and new native boundary hardening are not introduced by this presentation change.

Storage, native commands, capability registration, indexed database queries and PGN semantics stay as implemented. Phase 2 linked collections, PGN writeback, index regeneration, deduplication between formats, account destination changes and one-time linking/migration are f-20261004-15, outside this mandate. Do not invent database purpose metadata or infer collection identity from titles. Existing unrelated mutation/error defects remain separately owned findings. No new persistence schema, watcher, service or external dependency.

## Traced premises

Frozen at round 1. Two completed read-only locate probes inspected the supplied base. Their reports are `probe-1-r1.txt` and `probe-2-r1.txt` in the supplied RUN_TMP. Source locations below are evidence, not an executor's prescribed helper names.

- `src/components/files/FilesPage.tsx` owns a workspace-keyed SWR listing with native request ownership, workspace picker, file mutations, trash and dialogs. `DirectoryTree.tsx` owns recursive filtering, expansion, keyboard opening and file-only drag/drop. `FileCard.tsx` owns its preview paging/cache and stale-result checks. `file.ts` has exactly game, repertoire, tournament, puzzle and other metadata types.
- `src/components/databases/DatabasesPage.tsx` owns the shared `"databases"` listing, selected handle, conversion visibility, picker/retry, reference selection and the database detail controls. Its GeneralSettings child is currently keyed by filename. `src/utils/db.ts` distinguishes successful and error metadata entries and gives native database handle identity.
- `src/components/databases/databaseRoute.ts` uses the URL capability key as authority. `DatabaseView.tsx` hosts the retained explorer. The overview currently clears the active explorer on entry. `Sidebar.tsx` separates destination from active matching and resumes the active explorer when returning from another page.
- `src/state/atoms.ts`, `src/hooks/useConversionProgress.ts`, `AddDatabase.tsx`, `AddGames.tsx` and `src/components/home/AccountCard.tsx` already own per-operation conversion progress and shared database-cache refresh. They must not acquire a second lifecycle owner in Library. Account matching is exact filename through the existing helper.
- Consumers include Sidebar, databaseRoute fallback, DatabaseView Back/missing links, `NoDatabaseWarning.tsx`, and existing database-opening calls in DatabasesPage and InfoPanel. The generated route tree follows file routes. E2E and the real-app harness contain literal old routes, sidebar names and overview selectors.
- Existing tests cover independent root recovery and metadata failures, native request cancellation, conversion ownership, preview caching, stable double-click rows, route/store disagreement and responsive layouts. `e2e/fixtures.ts` can supply files and databases in the same session, rejects unexpected IPC and clears storage on a full document load. `scripts/verify-app.mjs` covers actual pointer double-click, metadata and root recovery.
- This checkout lacks node_modules and a built release app. Planner evidence is source tracing only. The adopting executor installs dependencies and builds through project wrappers before live proof. No live observation is required to settle this composition plan.

## Evidence corrections

P2, round 2: the frozen round-1 inventory incorrectly named `AddGames.tsx`. No such file exists. The actual add-games action is the handler in `src/components/databases/DatabasesPage.tsx`, which captures `selectedDatabase.file` before awaiting and calls `runAddGamesToDatabase` from `src/components/databases/databaseMutation.ts` through the existing `runDatabaseConversion` lifecycle. Use that path as the authoritative extraction inventory. The incorrect round-1 statement remains in the frozen block only as review history, not as an implementation instruction. The source contract and operation ownership are unchanged.

## Approach

### O1 — One overview and retained explorer navigation

Authority: "one Library sidebar entry replacing Files and Databases" and "/files and /databases redirect".

Make `/library` the canonical overview. Both old overview URLs redirect to it without rendering old pages. Keep `/databases/$databaseId` as the explorer route with capability-key authority and existing synchronization/not-found behavior. Library is the single sidebar entry for both `/library` and the database explorer scope, using the existing segment-aware active matching and separate destination contract. When an explorer is active, returning through the sidebar resumes it. Entering the overview intentionally clears that active explorer, so explorer Back and missing-database recovery lead to the overview rather than a resume loop.

Update overview destinations in databaseRoute fallback, DatabaseView Back/missing links and NoDatabaseWarning. Retain the database-opening callers' existing capability navigation and store setup. Regenerate the route tree through the existing route tooling. Tests must exercise old URLs, direct explorer URLs, store A versus URL B, overview Back, and sidebar return from Board with an active explorer. Pixel verification must show exactly one Library entry and correct active state.

### O2 — One collection list, one search/filter and one selection

Authority: "one searchable list of files and databases with type badges".

The overview owns one search, one clearable type filter and one transient discriminated selection. Compose file/folder entries and database entries into one collection list with one keyboard/focus model and one scrolling container. Retain file hierarchy, expansion and ancestor context inside that list. Database rows are top-level peers of file-root children. This is one list, with no separate source tabs or independently filtered list panes. Keep the existing file order/hierarchy and deterministic database order from the listing, with no invented cross-source sort setting.

Use native capability identity plus the item kind for keys, selection and detail lifetime. Never join by path text, filename or title. Relists resolve selection against the full current source listing. Filtering does not itself discard a still-existing selection, as on the current pages. A removed item or a changed owning file workspace clears that source's selection. Changing or filtering the other source does not clear it. No persisted library selection, search or filter is introduced.

Search retains current file-name/folder-name and database filename/title/description/error matching. Type filtering uses the existing PGN metadata categories plus a Games database category. Show localized type badges without writing or reinterpreting stored metadata. Folder context remains navigable, and an unmatched folder must not expose unmatched descendant files. Active conversion targets retain their current exclusion and progress presentation. If a selected database becomes an active conversion target, suppress its actionable detail until eligible again, preserving its handle for a successful relist rather than offering operations on an unavailable target.

Reuse or extract the existing file list behavior into the mixed list rather than duplicating its recursive filtering, row gestures or mutation callbacks. Selection must not insert controls above the list or move rows under a stationary pointer. Preserve file Enter/double-click and visible opening action, database Explore, directory expansion and file-only move/drop. Database rows cannot become file move sources or destinations. Verify same-name file/database collision, filtered retained selection, removed selection, hierarchy filtering, keyboard traversal across kinds and the real pointer gesture.

### O3 — Source-specific detail and creation actions

Authority: "detail pane by item type" and "Add offers both import as database and create file".

Extract the current overview's listing/actions and detail presentation enough to compose Library. Do not mount two complete old pages under a new shell and do not retain duplicate overview controllers. The selected kind supplies its existing typed native payload and source callbacks to the matching detail. Keep FileCard preview behavior and directory actions. Keep database stats, reference selection, edit name/description, indexing, Explore, cleanup, player merge, add games, export and deletion. An error-metadata database remains selectable, explains its existing failure, and permits its existing recovery/delete actions without presenting healthy-only operations.

Key detail lifetime by capability identity, including GeneralSettings, so switching different handles with equal filenames resets the correct form and never routes an action to the previous item. Async actions keep the handle captured by their existing source-owned operation. Retain cancellation silence, existing notifications, applied-despite-error refresh and database selection/reference/active/cache invalidation. Do not replace the existing openFile/tab-creation path or preview cache with a generic opener.

Provide one Add surface with clear source-specific choices: existing create-file and create-folder dialogs, and the existing database import/download dialog. File creation uses the selected file folder's existing destination rules. Selecting a database must never supply a file destination. Existing file folder chooser, Rename, metadata edit, Move, Trash, Undo and purge stay reachable. Metadata edits preserve tags and the native sidecar-only contract. Downloads/imports retain their current operation owner, cleanup and success/failure refresh behavior. Test actions against both selected kinds and wrong-kind destination rejection. A focused unit suite proves callback routing, while mixed e2e proves that the controls remain reachable and visibly distinct.

### O4 — Independent listings, failures and shared background work

Authority: "a new page that composes both existing panes" and "storage stays exactly as it is".

Keep the existing independent source request/cache identities and cancellation ownership. File workspace switch invalidates its own selection and listing. Database-root re-selection keeps its existing supersede-before-refresh semantics. Do not serialize listing one source behind success of the other, create a combined all-or-nothing fetch, or turn source failures into empty-success content. Each source has a named, accessible loading/failure/recovery presentation while healthy sibling entries and their selection/detail remain usable. The unified empty state is shown only when both sources succeeded empty. Filtered no-results and source load failure are distinguishable.

The current shared database cache, global conversion registry and app-level progress listener remain the sole owners for import/download/account operations. Compose existing AddDatabase behavior without transferring registry teardown to page unmount. Preserve successful and failed conversion refresh, cancellation handling and account exact-filename matching. An operation continuing across route changes must retain its existing lifecycle and restore eligible database rows on completion. Verify mixed cached/failing sources, root recovery with a late old result, stale preview after switching kind, ongoing import while searching/navigating, and shared-cache refresh from account synchronization. Reuse existing regressions for the unchanged lifecycle plus focused Library integration cases.

### O5 — Responsive, accessible and localized proof

Authority: a "single list" with "actions that fit it" replaces both existing pages, which must remain usable.

Use the established responsive page layout: list/detail side by side when space permits, stacked with page scrolling at narrow widths, bounded list scrolling, and shrinkable children. The combined toolbar and Add choices wrap without hiding primary actions at 320px or at 200% font scale. List semantics must express folders and mixed collection rows consistently, retain focus visibility and keyboard opening, and label source-specific recovery controls and badges. Reuse existing shared icon/action primitives and i18next. Extract translations with the project command, keeping existing file-type meanings.

Adapt route/selector-dependent unit, e2e and real-app assertions to Library rather than merely relying on redirects to keep old tests passing. The actual new mixed page must be covered. Scope real-app error assertions to their source so simultaneous alerts cannot satisfy the wrong check. Use client-side navigation when proving continuity, since full document loads reset the e2e fixture's storage. Inventory full-page screenshots affected by the single-entry sidebar, review the exact intended baseline manifest, and record snapshots only in the pinned container. Leave unrelated component/dialog baselines unchanged unless actually affected and reviewed.

Pixel proof is the complete container suite plus mixed-library and font/breakpoint cases. Behavioral proof is `pnpm verify:app` against the real off-screen Tauri app, including mixed selection and source-appropriate opening, retained existing double-click, root recovery and metadata paths. Add each new standalone harness assertion with a unique message and verify a deliberate failure exits nonzero before restoring it. Native GTK chrome alone remains outside automation. No browser-only run substitutes for either proof.

The new production directory must remain measured. Add `src/components/library/**` to the existing `databases-files` area's paths in `coverage-areas.json`, and make the matching path-only change in `coverage-baselines.json` under `scope.areas`. Preserve all numeric baseline `areas`, every minimum floor, every existing path and the include/exclude/statement-free declarations. Compare parsed baseline `areas` before and after and require equality. This is the documented scope-mapping maintenance procedure, not a baseline refresh. Run the existing frontend coverage gate against the unchanged numeric ratchet. If it is red, repair meaningful behavioral coverage rather than lower or rewrite it.

## Decisions and trade-offs

The recorded product choice is option (a) in MANDATE. This plan resolves technical composition choices without reopening it. Existing d-20260919-11/-12, d-20261001-08, d-20261003-23/-24, d-20261004-06/-07, d-20261007-02/-03/-04, d-20261008-03/-07 and d-20261010-02/-03/-04 govern preserved gestures, layouts, routes, recovery, conversion ownership, metadata and opening affordances. d-20260831-01 governs mutation error classification. New technical choices below are planner proposals, not records attributed to Felix. The adopting session records them through the decisions writer.

## Risks

- Mixed-source ownership is the main regression risk. O2/O4 require independent requests, handle identity and one selection without a new global resource store.
- Sidebar removal affects screenshots beyond the old overview suites. O5 requires a reviewed baseline inventory and the full container suite.
- Neighboring pending work may change opening affordances or listing/error helpers before adoption. Revalidate against the actual adoption base and governing decisions rather than copying stale source lines.
- Known separately owned design issues include f-20261003-09, f-20261004-09, f-20261005-04, f-20261006-07, f-20261007-04 and f-20261009-03. Their current mutation and root limitations are not claimed fixed here. Do not remove their existing regression coverage. If source inspection proves one blocks this MANDATE, identify the dependency instead of silently pulling in its redesign.

## Not part of this change

No linked-index storage design or migration from f-20261004-15. No new collection-purpose editing, changes to PGN parsing, reference indexing, native permission scopes, persisted atoms, account sync destinations, engine lifecycle, payment or external publication. No rewrite of every unrelated source failure or mutation mechanism.

## Phases

### Phase 1 — Compose and verify Library as one integration change

Executor role: normal, unless adoption's actual changed paths hit a Sensitive-Path glob. No new backend or persisted-state write is planned. This is one cohesive phase because splitting extraction and navigation across overlapping overview files would leave a partially integrated surface and duplicate regression ownership.

Files to change, with creation allowed only inside named directories:

- `src/components/library/` (new composition, mixed list, focused tests)
- `src/components/files/` and `src/components/databases/` (extract existing controllers/details, adapt list integration, tests, route helper)
- `src/components/Sidebar.tsx`, `src/components/Sidebar.test.tsx`
- `src/components/panels/database/NoDatabaseWarning.tsx`, relevant existing InfoPanel tests if route expectations change
- `src/routes/library.tsx` and `src/routes/library.lazy.tsx` (new canonical overview), `src/routes/files.tsx`, `src/routes/files.lazy.tsx`, `src/routes/databases/index.tsx`, `src/routes/databases/index.lazy.tsx`, `src/routeTree.gen.ts`
- `src/translation/`
- `e2e/` (mixed fixtures, route/selector assertions and actually affected container baselines)
- `scripts/verify-app.mjs` (Library navigation/selectors and mixed behavior proof)
- `coverage-areas.json`, `coverage-baselines.json` (Library mapping in the existing area and scope-only baseline mirror)

Before editing, trace the file-route guards and lazy components, replacing the two overview bodies with redirects and removing orphan lazy bodies as appropriate. Do not hand-edit generated route output. Keep unaffected utilities, global conversion ownership and storage unchanged. Implementation brief carries O1–O5 and any carried corrections verbatim. Reuse existing primitives rather than introduce a universal collection backend.

Phase proof, in order, after dependency installation through project conventions:

```bash
pnpm test src/components/library src/components/files src/components/databases src/components/Sidebar.test.tsx src/components/panels/info/InfoPanel.test.tsx src/components/home src/utils/db.test.ts src/utils/files.test.ts src/hooks/useConversionProgress.test.tsx
pnpm gate:ensure frontend-coverage
pnpm gates:contract:check
pnpm checks:pre-review
pnpm app:driver:test
pnpm test:e2e:container --project=database-files --project=async-errors --project=files-preview --project=font-scaled-breakpoints
pnpm build
pnpm verify:app
```

These commands prove O1–O5 at unit, pixel and real-app levels. Update test project scope if the new Library suite is registered separately, retaining all named old coverage. Run `pnpm i18n:extract` and regenerate routes during implementation, then format through oxfmt. Inspect the final cumulative diff and apply the canonical push gate mapping. For the planned frontend-only change, the once-per-task final gate is `pnpm gates:push -- --frontend`, including the full container suite. Any backend/binding or dependency/config scope expansion needs a new gate mapping and review before execution. Record actual command outcomes and durable proof in the adopter's tracked handoff. Planner commands here are future proof, not completed verification.

## Decided autonomously

1. Question: where does the canonical overview live? Chosen: `/library`, with redirects only for the two old overview URLs and the existing explorer URL retained. Rejected: moving explorer URLs or using a resume query guard. Reason: separate overview and explorer identities preserve capability routing and existing return behavior. Reversal: change the overview route/helper destinations and redirects together, retaining deep-link compatibility.
2. Question: how are the two sources composed? Chosen: source-specific controllers/details and a mixed list with transient kind-qualified selection, shared search/filter and existing hierarchy. Rejected: mounting two pages or a universal resource backend. Reason: one user destination requires one interaction model, while unrelated native ownership stays with each source. Reversal: replace the presentation adapter without changing storage or command contracts.
3. Question: what happens when filtering hides selection? Chosen: retain an existing selection against the full listing, temporarily suppress conversion-ineligible database detail, clear only on authoritative removal or owning workspace change. Rejected: clearing on every search and keeping actionable conversion-hidden detail. Reason: preserve current filtering continuity while preventing operations on a target the existing page makes unavailable. Reversal: change transient selection policy and its focused tests together.
4. Question: what labels and persistence does the new filter use? Chosen: existing file categories plus Games database, with local search/filter/selection. Rejected: adding database purpose metadata, guessing purpose or persisting new state. Reason: the chosen phase changes presentation only. Reversal: separately authorize and design metadata or persisted state under the linked-collection scope.
5. Question: who accepts the visible integration in full auto? Chosen: the executor verifies O1–O5 with pinned-container pixels and the actual off-screen app. Rejected: a manual browser-only pass or routing routine automation through Felix. Reason: the project already supplies reproducible pixel and native behavior evidence. Reversal: amend the project verification contract with evidence.

## Carried to diff review

None at round 1.

## Reviews

Plan authorship and arbitration share one Codex context. Detection runs on the same OpenAI model family as the intended code executor, through the configured read-only lens ladder. Locate probes are completed source evidence, with no live app verification in this planner run. Raw verdicts and every issue disposition will be appended below.
### Round 1 — initial complete fan-out
Twelve plan-capable lenses completed. Wall time: 128.66 seconds. Two plan-level corrections adopted. No implementation proof commands ran.

#### Raw report — correctness r1
```text
No correctness findings. O1–O4 consistently handle URL B versus stored database A, equal-name collections with different handles, filtered selection, workspace changes, and selected databases hidden during conversion.

Limitation: this is source-backed plan review. Mixed keyboard traversal, redirect execution, and asynchronous behavior after extraction remain unverified until implementation review and the prescribed proof runs (confidence: 95).

VERDICT: APPROVED
```

#### Raw report — error-handling r1
```text
No error-handling findings in O1–O5. The plan preserves independent source failures, typed recovery, cancellation silence and mutation error handling.

Limitation: implementation and runtime behavior remain unverified in this plan-only review (confidence: 100).

VERDICT: APPROVED
```

#### Raw report — minimalism r1
```text
No bloat or duplication defects found. The plan stays within phase 1 and requires reuse of existing controllers, detail panes, hierarchy behavior and background ownership.

Limitation: concrete helper boundaries and duplicate implementations can only be assessed in the implementation diff (confidence: 100).

VERDICT: APPROVED
```

#### Raw report — plan r1
```text
[blocker] tasks/plans/.plan-2026-10-10-unified-library-r1.body.md:121 — The new `src/components/library/` production files have no coverage-area mapping. `coverage-areas.json:89` maps the existing database/file directories, and `scripts/coverage-report.mjs:561` rejects every unmapped production file. The required gates cannot pass within the listed file scope. Include `coverage-areas.json` and the corresponding scope-only `coverage-baselines.json` update, preserving numeric ratchets, or place the composition within an already mapped directory. (confidence: 100)

[should-fix] tasks/plans/.plan-2026-10-10-unified-library-r1.body.md:43 — The traced premises name `AddGames.tsx`, which does not exist. Add-games wiring lives in `src/components/databases/DatabasesPage.tsx:511`, using `runAddGamesToDatabase` from `src/components/databases/databaseMutation.ts:57` and the shared conversion lifecycle. Correct the owner inventory so extraction preserves the actual operation path. (confidence: 100)

VERDICT: REVISE
```

#### Raw report — tests r1
```text
VERDICT: APPROVED
```

#### Raw report — chess-semantics r1
```text
NOT APPLICABLE — O1–O5 cover library navigation, collection search and selection, source-specific panes, listing lifecycle, and UI verification. The listed files and obligation headings propose no changes to in-memory game trees, position identity, move paths, chess parity, or tree round trips.

VERDICT: APPROVED
```

#### Raw report — engine-protocol r1
```text
NOT APPLICABLE: O1–O5 and the scoped files concern library navigation, collection selection, file/database actions, and conversion ownership. They do not change engine process supervision, UCI protocol handling, or asynchronous engine result routing.

VERDICT: APPROVED
```

#### Raw report — ipc-contract r1
```text
No IPC-contract defects found in the plan. O3/O4 preserve typed capability handles, per-operation conversion IDs, the registered event payload and app-level listener ownership. No native command, binding or permission changes are proposed.

Source review only. Runtime verification remains implementation work.

VERDICT: APPROVED
```

#### Raw report — persisted-state r1
```text
No persistence or tab-lifecycle defects found in the plan. O2 introduces no persisted Library state, O3 preserves existing tab creation, and O1 retains capability-authoritative explorer hydration. Existing storage readers and writers remain paired.

This is source-based plan review only. No files changed or proof commands run.

VERDICT: APPROVED
```

#### Raw report — pgn-index r1
```text
NOT APPLICABLE — O1–O5 cover frontend composition, navigation, selection and UI verification. The named files do not change PGN scanning, byte offsets, move encoding, database storage or indexed search. The plan explicitly preserves those contracts and excludes linked-index work.

VERDICT: APPROVED
```

#### Raw report — platform-semantics r1
```text
No platform-semantics findings. O2/O3 require kind-qualified capability identity, preserve native payloads, and prohibit path/name-based identity. The plan introduces no native handle, filesystem, FFI or `cfg` changes.

Verification limitation: planned container pixels and `pnpm verify:app` do not establish Windows or macOS UI behavior. Native runtime evidence remains CI’s `rust-windows-test` and `rust-macos-test`, with target compilation in `rust-platform`.

No proof commands ran during this read-only plan review. Neither `pnpm rust:windows:check` nor the non-Linux Unix source probe ran. Neither is required by the proposed frontend-only mechanism, provided implementation preserves that boundary.

VERDICT: APPROVED
```

#### Raw report — tauri-security r1
```text
NOT APPLICABLE — O1–O5 and FILES cover frontend Library composition, navigation and verification. The plan preserves existing native commands, capability handles, storage and mutation contracts. It introduces no credential/session flow, native filesystem authority change, signed-download verification change or new backend-data payload.

Limitation: this assesses the plan only. An implementation that changes those boundaries requires this lens again.

VERDICT: APPROVED
```

#### Round 1 issue dispositions
| ID | Witness | Claim | Disposition | Authority and evidence | Correction | Dependencies and closure |
| --- | --- | --- | --- | --- | --- | --- |
| P1 | plan r1 finding 1, blocker | New Library directory is unmapped production code, so gates cannot pass within scope. | Fix | MANDATE requires “a new page that composes both existing panes”. `coverage-areas.json` databases-files paths omit Library and `scripts/coverage-report.mjs` assignArea rejects unmapped files. `docs/coverage.md` permits scope-only maintenance while preserving numeric ratchets. | r2 O5 and Phase 1 add Library to the existing area and its baseline scope mirror, preserve numeric metrics/floors and require the frontend coverage gate. No new runtime mechanism. | No dependencies. Await review-plan closure in r2. |
| P2 | plan r1 finding 2, should-fix | AddGames.tsx is a nonexistent operation owner. | Fix | MANDATE requires “detail pane by item type” and retention of actions. Source is DatabasesPage add-games handler plus databaseMutation runAddGamesToDatabase. The handler captures the selected handle before awaits. | r2 Evidence corrections records the real owner and explicitly overrides the archived mistaken round-1 inventory without rewriting frozen history. O3/O4 behavior remains unchanged. | No dependencies. Await review-plan closure in r2. |
### Round 2 — corrections and closure
Four selected lenses completed. Wall time: 169.13 seconds. No new plan-level issues adopted. Review-plan re-ran both P1/P2 witness checks. Correctness, tests and minimalism checked the added coverage obligation.

#### Raw report — plan r2
```text
P1 CLOSED — r2’s O5 and phase scope explicitly include both coverage files and the frontend coverage gate (`tasks/plans/.plan-2026-10-10-unified-library-r2.body.md:102`, `:135`, `:143`). This addresses the unmapped-file rejection and baseline-scope check in `scripts/coverage-report.mjs:561` and `:751`, while preserving numeric ratchets.

P2 CLOSED — the erratum explicitly supersedes the nonexistent owner (`tasks/plans/.plan-2026-10-10-unified-library-r2.body.md:50`). `DatabasesPage.tsx:511` captures the destination before awaiting, `databaseMutation.ts:57` owns the picker/conversion action, and `src/state/atoms.ts:505` owns per-operation registration and cleanup.

No additional defects found in the delta or its affected dependencies.

Limitation: source review only. Implementation and runtime compliance remain unverified. No proof commands ran (confidence: 100).

VERDICT: APPROVED
```

#### Raw report — tests r2
```text
VERDICT: APPROVED
```

#### Raw report — correctness r2
```text
No correctness findings. The coverage mapping and baseline scope mirror agree with the validator’s contract. Add-games retains its captured destination and existing conversion lifecycle.

Limitation: source review only. Implementation and runtime behavior remain unverified (confidence: 100).

VERDICT: APPROVED
```

#### Raw report — minimalism r2
```text
No bloat or duplication findings. P1 adds only the necessary coverage path and scope mirror, preserving numeric ratchets. P2 directs extraction through the existing add-games handler and shared conversion lifecycle.

The smallest sufficient implementation remains one Library composition, reused source behavior, navigation changes and focused proof. The revised plan requires no additional runtime mechanism.

Limitation: concrete helper boundaries, file count and duplication remain assessable only in the implementation diff (confidence: 100).

VERDICT: APPROVED
```

#### Round 2 closure dispositions
| ID | Disposition | Correction and evidence | Closure | Dependencies |
| --- | --- | --- | --- | --- |
| P1 | Fix | O5 and Phase 1 include coverage-areas mapping, baseline scope-only mirror, parsed numeric equality and frontend coverage gate. review-plan r2 explicitly confirmed unmapped-file and baseline-scope rejection are addressed without weakening ratchets. | Closed r2. No runtime proof claimed. | None. |
| P2 | Fix | Evidence corrections identifies DatabasesPage handler, databaseMutation.runAddGamesToDatabase and atoms.runDatabaseConversion as the actual owner path, overriding the archived false filename as implementation guidance. review-plan r2 confirmed the captured handle and per-operation teardown. | Closed r2. No runtime proof claimed. | None. |

All raw reports remain preserved. All reported findings are assigned and closed. No Skip, Defer, withdrawn mechanism or carried correction. No successor finding owns any part of the assigned MANDATE. f-20261004-15 remains the already separate phase-2 storage design. This planner stops before Preflight. No dependencies were installed, source edited, implementation tests run, decision recorded, finding claimed/closed, commit created or push made.

## Adoption and implementation (session fab6795c-3780-4adc-8356-6d9441cd768f, 2026-10-13)

Adopted by the drain's Claude Code (Opus 5.5) orchestrator through `ADOPT-PLAN` at base `b7067eb9`; `drain_supervisor_plans.py gate` printed `clear`. Plan copied to `tasks/plans/2026-10-13-unified-library.md`. The five `## Decided autonomously` entries were recorded as d-20261013-01..05. Plan-review cells are taken from the consumed `meta.json` (planned ahead): r1 128.66 s, r2 169.13 s, r3 122.0 s; adopted r1=2 r2=0 r3=0; P1 and P2 closed in r2.

Disclosure: the plan was written by a Codex planner session; this Claude context arbitrated triage. All code was written by Codex write leaves (OpenAI high tier). Every diff lens ran on Codex (OpenAI high tier, `leaf.codex.read.*`), the same model family as the code author — no family separation for detection.

### Implementation

* Phase 1 — `e96de980` feat(library): one Codex write leaf (role normal). Leaf proof: build-vite 0, tsgo 0, targeted vitest 604/604, i18n extract stable, frontend-coverage 0, contract check 2 (see filed finding below), pre-review 0, app:driver:test 0, container e2e 7 projects 74/74, `pnpm build && pnpm verify:app` 0 (new LU1/LU2 assertions negatively staged: an extra tree made LU1 fail, removing database detail made LU2 time out). 38 baselines re-recorded in the pinned container. Orchestrator re-ran tsgo 0, vitest 604/604, `git diff --check` 0, parsed `coverage-baselines.json` `areas` equal to HEAD; after the commit `pnpm gates:contract:check` 0 (first attempt failed only because `rustup` was not on this shell's PATH; rerun with `~/.cargo/bin`), `pnpm checks:pre-review` 0 (frontend mutation 446.5 s).
* The leaf's contract-check red came from `scripts/working-tree-files.mjs` listing tracked files deleted in the uncommitted tree; out of area, filed through the inbox (gate-scripts, inline) — pending drain merge at the time of writing.
* Joiner f-20261004-10 — `33e21020` refactor(databases): `useDatabaseList` hook (role sensitive, AccountCard is a sensitive glob). Leaf red check: removing `onErrorRetry` made transient-failure calls 6 instead of 4 and root/cancellation calls 5 instead of 1. Orchestrator re-ran tsgo 0, vitest 468/468; pre-review 0 (mutation 425.7 s).
* Joiners f-20261001-21 and f-20261001-23 were already fixed by `9566f68a` (f-20260914-06), f-20261010-34 by `e95a864d`; closed with evidence (`aaa28ba8`, `ac08bb19`, `21841ccc`), no code change.

### Cumulative diff review — round 1 (range ec8190ef..33e21020)

Lenses: correctness, root-cause, code-quality, minimalism, tests, error-handling, persisted-state (role sensitive) over the code diff excluding ledgers; records lens (role mechanical) over `tasks/findings.md` and `tasks/decisions.md`. Not selected, with reason: ipc-contract, tauri-security, pgn-index, engine-protocol, chess-semantics, platform-semantics — the diff touches no command, event, binding, capability, PGN/db backend, engine, chess-tree or cfg/platform code.

#### Raw report — correctness r1
```text
No correctness defects identified in either commit. Traced same-name selection, filtered hierarchy, conversion eligibility, route/store agreement, and the three-retry bound.

Limitation: static review only. Native timing and rendered behavior were not independently rerun (confidence: 90).

Review ran on the same model family that authored the code.

VERDICT: APPROVED
```

#### Raw report — root-cause r1
```text
No symptom patch or reintroduced prior fix identified. In `33e21020`, duplicated subscriptions inherited SWR’s unlimited retries. All five now use one policy that stops on permanent root failures or cancellation and bounds other failures to three retries. `e96de980` preserves the earlier conversion ownership, metadata editing, request supersession and explorer navigation fixes.

[should-fix] src/hooks/useDatabaseList.test.tsx:63 — Evidence limitation for `33e21020`: regression tests and passing results are supplied, but no observed failing-before/passing-after run demonstrates the old policy’s unlimited retries or retries of permanent failures. The source establishes the mechanism, but the claimed repair lacks that experimental comparison. Record a retained-test comparison against the prior subscription policy. (confidence: 100)

This review ran in the same OpenAI family as the code author, without family separation.

VERDICT: APPROVED
```

#### Raw report — code-quality r1
```text
Originating commit: e96de980.

[should-fix] src/components/databases/useDatabaseLibrary.tsx:179 — The header comment still describes the reference star wrapping beneath the icon. The star now renders outside the card, below it. Update the comment to describe the current layout (confidence: 100).

[nit] src/components/home/Accounts.tsx:36 — The comment assigns workspace recovery to “the database page,” which this change deletes. Name Library’s database source presentation so the next reader can locate it (confidence: 95).

[nit] src/components/library/LibraryPage.test.tsx:231 — `source === "files" ? 0 : 0` implies source-dependent row selection but always selects index zero. Use `rows()[0]` directly (confidence: 100).

VERDICT: APPROVED
```

#### Raw report — minimalism r1
```text
No bloat or duplication findings in e96de980 or 33e21020.

Smallest-diff counterfactuals for the added files:

- `LibraryPage.tsx` provides the required composition. Its test and `LibraryRoutes.test.ts` cover mixed interactions and redirects.
- `useFileWorkspace.tsx` and `useDatabaseLibrary.tsx` replace the deleted page controllers while preserving source ownership.
- `presentation.tsx` shares styling across existing callers.
- `useDatabaseList.ts` consolidates five subscriptions. Its test proves bounded retries.
- `library.tsx` and `library.lazy.tsx` follow the existing route split.
- The new Library PNG covers mixed selection.

Deleting these would remove required behavior, coverage, or shared implementation. No substantial reduction is supported.

VERDICT: APPROVED
```

#### Raw report — tests r1
```text
[should-fix] src/components/files/DirectoryTree.tsx:51 — e96de980 changes folder filtering, but no assertion checks that a name-matching folder disappears when its descendants fail the selected type filter. Existing hierarchy tests retain a matching descendant. Reverting `(!filter && matchesSearch)` to `matchesSearch` would still pass, allowing empty, irrelevant folders through the type filter. Add a folder with no matching descendants and assert its row is absent. (confidence: 98)

VERDICT: APPROVED
```

#### Raw report — error-handling r1
```text
No additional error-handling findings. Existing deferred mutation issues retain their recorded behavior.

Detection ran on the same model family that wrote the code, so this review has no family separation.

VERDICT: APPROVED
```

#### Raw report — persisted-state r1
```text
[blocker] src/components/databases/useDatabaseLibrary.tsx:148 — The retained `database-view` store publishes memory before an unguarded session-storage write. When large open game tabs exhaust the shared quota, `setActiveDatabase` throws before navigation, leaving memory ahead of persisted state. Reload restores the previous value without a handled persistence warning. Pre-existing, already tracked as f-20261010-01, and still reachable through e96de980. (confidence: 100)

[blocker] src/state/store/database.ts:203 — Hydration parses JSON and shallow-merges stored state without schema validation. A JSON-valid record containing the current database handle but `games: null` survives reload. Route resolution accepts the matching handle, then `GameTable` crashes reading `s.games.query` instead of falling back to defaults. Pre-existing hydration defect tracked as f-20261001-13, still reachable through the reviewed explorer. (confidence: 100)

VERDICT: REVISE
```

#### Raw report — records r1
```text
[should-fix] tasks/decisions.md:4839 — Unsuperseded d-20261001-08 requires the literal `/databases` match path and says every destination lies beneath its match path. This contradicts d-20261013-01 and `src/components/Sidebar.tsx:35-38,61`, which use `/library` plus `/databases` matching. Explicitly supersede the outdated route clauses while preserving the shared active-state mechanism. (confidence: 100)

Unverifiable: the successful container run claimed at tasks/findings.md:15066. The source changes, test cases and committed snapshot updates are supported, but no run result was located.

VERDICT: REVISE
```

#### Round 1 dispositions

| ID | Witness | Claim | Disposition | Evidence / correction | Closure |
| --- | --- | --- | --- | --- | --- |
| CQ1 | code-quality r1 #1, should-fix | stale header comment in `useDatabaseLibrary.tsx:179` (star placement) | Fix | comment rewritten, `a8c2bbd9` | closed r2 (code-quality, tests) |
| CQ2 | code-quality r1 #2, nit | `Accounts.tsx:36` comment names the deleted database page | Fix | comment names the Library database source region, `a8c2bbd9` | closed r2 |
| CQ3 | code-quality r1 #3, nit | dead ternary `LibraryPage.test.tsx:231` | Fix | `rows()[0]`, `a8c2bbd9` | closed r2 |
| T1 | tests r1 #1, should-fix | no test pins type-filtered folder hiding (`DirectoryTree.tsx:51`) | Fix | new DirectoryTree test; leaf red run against the old condition `1 failed | 3 passed`, `a8c2bbd9` | closed r2 |
| RC1 | root-cause r1 #1, should-fix | no observed failing-before run for the retry tests | Skip | the leaf's recorded red check (removing `onErrorRetry`: 6≠4 transient, 5≠1 root/cancellation) is that comparison; recorded here | — |
| PS1 | persisted-state r1 #1, blocker | `database-view` store publishes memory before an unguarded session-storage write | Defer (already filed) | pre-existing, open as f-20261010-01; not introduced by this range | — |
| PS2 | persisted-state r1 #2, blocker | `database.ts:203` hydration shallow-merges unvalidated stored state | Defer (already filed) | pre-existing, open as f-20261001-13 | — |
| R1 | records r1 #1, should-fix | d-20261001-08 unsuperseded, contradicts d-20261013-01 | Fix | d-20261013-08 recorded (`a4ba0d6a`), trailer `ce244e98` | closed r2 (records) |
| R-U | records r1, unverifiable | container run claimed in the f-20261010-34 closing note | evidence supplied | `/tmp/library-proof-final/09.log` ends `74 passed (24.9s)`; records r2 verified | closed r2 |

### Closure round 2 (delta 33e21020..a8c2bbd9)

#### Raw report — code-quality r2
```text
CQ1 CLOSED — `useDatabaseLibrary.tsx:179` now describes the icon/title group and type badge wrapping, matching the header JSX.
CQ2 CLOSED — `Accounts.tsx:36` now names the Library database source region, which renders the retry/error state.
CQ3 CLOSED — `LibraryPage.test.tsx:231` now uses `rows()[0]`, removing the redundant ternary.
T1 CLOSED — `DirectoryTree.test.tsx:252` asserts the matching-name folder is absent with a nonmatching descendant and visible with a matching descendant. Supplied revert evidence confirms the absence assertion fails against the old condition.

No new readability or local-consistency defects found in the repair delta.

VERDICT: APPROVED
```

#### Raw report — tests r2
```text
CQ1 CLOSED — header comment now describes icon/title and type-badge wrapping, consistent with the JSX.
CQ2 CLOSED — comment now names the Library database source region.
CQ3 CLOSED — `rows()[0]` preserves the previous selection and its detail-pane assertion.
T1 CLOSED — the new test asserts the wrong-type folder is absent, then verifies folder and child visibility after changing the child’s type. Reverting the filter condition fails the absence assertion, consistent with the supplied red-run evidence. Vitest includes this file and CI runs it through `pnpm test:coverage`.

No new verification gaps found in the repair delta.

VERDICT: APPROVED
```

#### Raw report — records r2
```text
R1 CLOSED — `tasks/decisions.md:4842` now marks d-20261001-08 superseded by d-20261013-08. The new decision matches the routing implementation and sidebar tests at a8c2bbd9.

Container evidence verified — `/tmp/library-proof-final/09.log` includes font-scaled-breakpoints and ends `74 passed (24.9s)`.

No findings. The delta respects the ledger and language contracts.

VERDICT: APPROVED
```

Round 2 result: CQ1, CQ2, CQ3, T1 and R1 closed; records lens verified the R-U container evidence. All three verdicts APPROVED.

### Browser verification and post-review repairs

* Browser-verification stage (d-20261013-05: agent acceptance through pinned-container pixels plus `pnpm verify:app`). `pnpm build && pnpm verify:app` at `a8c2bbd9` exited 0 ("all checks passed"). The orchestrator inspected `library-database-selected`, `database-open-320-200` and `files-preview` baselines and found one regression of this build:
  * **B1** (orchestrator, browser verification): the shared wrapping button style set the root `height: auto`, so a size-lg button's label sat at the top of its box; the Explore button's label was 15 px above centre (it was centred on the old Databases page). Fix `2e09f56d`: root centres its inner span (`inline-flex`, `align-items: center`), style moved to `src/components/common/wrappingButton.ts` (shared with `OpenGameButton`, which would otherwise import from `components/library`), container e2e assertion of the label centre (leaf observed it red at 15 px, green after), one baseline re-recorded in the pinned container. Mapping of the new module into `shared-shell-ui` (scope only): `5c734d8c`.
  * **B2** (container e2e "database view load failure … Retry recovers", red in the B1 leaf's run): `33e21020`'s retry delay (2 s first retry) was faster than SWR's default (≥ 5 s) and broke the e2e pin of no automatic re-list within 2 s — an unrequested timing change, not a pre-existing failure as the leaf first reported. Fix `7b93437f`: mirror SWR's default jittered delay from `config.errorRetryInterval`; keep only the three-retry bound and the permanent/cancelled skip. Leaf: unit suite 470/470, `pnpm test:e2e:container --project=database-files` 18/18; red check (removing `onErrorRetry`) failed 11 tests.
* Orchestrator re-ran tsgo 0 and vitest 876/876 at `7b93437f`; pre-review at `7b93437f` was green except coverage mapping (the new module), fixed in `5c734d8c`.

### Closure round 3 (delta a8c2bbd9..5c734d8c)

#### Raw report — correctness r3
```text
B1 CLOSED — shared inline-flex root centres the inner span. Mantine’s `fullWidth` still supplies `width: 100%`. Library and both OpenGameButton callers remain compatible with the style.

B2 CLOSED — formula matches installed SWR’s default exactly. Counts 1–3 retry, count 4 stops, and root failures/cancellation return before scheduling.

No new correctness defects found. Limitation: rendering was assessed from source and supplied container evidence, without rerunning UI verification (confidence: 90).

VERDICT: APPROVED
```

#### Raw report — root-cause r3
```text
B1 CLOSED — `wrappingButton.ts:4` fixes the cause: Mantine’s percentage-height inner span cannot fill an auto-height root, so the root now centres it with flex alignment. Library and both Open game callers share the repair. `fullWidth` retains Mantine’s `width: 100%`. Supplied container evidence shows the centre assertion failing at 15px before the fix and passing afterward.

B2 CLOSED — `useDatabaseList.ts:22` matches installed SWR’s default jittered exponential delay exactly. The first retry is at least 5s with default configuration, removing the premature 2s re-list. Permanent-root and cancellation exclusions and the three-retry bound remain intact. Parameterized timer tests cover the delay and bound, and supplied container evidence reports 18/18 passing.

No new root-cause defect or reintroduced prior fix found in the delta or inspected callers. Review was read-only. No gates were rerun.

VERDICT: APPROVED
```

#### Raw report — code-quality r3
```text
B1 CLOSED — `wrappingButton.ts` clearly documents the shared style. Library and Open game use it consistently. Explore’s new assertion pins vertical centering within 2px.

B2 CLOSED — the delay expression matches installed SWR’s default `onErrorRetry`. The named three-retry bound and permanent-failure/cancellation exclusions remain explicit.

No new readability or local-consistency defects found. Runtime verification relies on the supplied evidence.

VERDICT: APPROVED
```

#### Raw report — tests r3
```text
B1 CLOSED — `e2e/database-files.spec.ts:107` asserts Explore’s label centre is within 2px of the button centre. The supplied pre-fix observation was 15px, so reverting fails this assertion. Existing snapshots and clipping assertions also cover OpenGameButton in file and database previews at 320px and 200%.

B2 CLOSED — The delay formula matches installed SWR’s default `onErrorRetry`. `src/hooks/useDatabaseList.test.tsx` checks exact retry boundaries at three random values, the three-retry limit, and no retries for root failures or cancellation. Reverting to the 2-second delay fails the no-request-at-2000ms assertion. The e2e test independently checks that boundary and manual Retry recovery.

Both anchors are selected by the configured suites and CI gates. No new verification defect found.

VERDICT: APPROVED
```

Round 3 result: B1 and B2 closed, all four verdicts APPROVED. No open review issue remains.

### Totals

Diff review: 3 completed rounds (r1 eight lenses, r2 three, r3 four). Issues opened: CQ1, CQ2, CQ3, T1, RC1, PS1, PS2, R1, R-U (r1); B1, B2 (orchestrator, post-review). Fixed and closed: CQ1, CQ2, CQ3, T1, R1, R-U, B1, B2. Skipped: RC1 (evidence recorded). Deferred to already-open findings: PS1 → f-20261010-01, PS2 → f-20261001-13. Downstream rework found after review: B1 (visual), B2 (introduced by the f-20261004-10 joiner commit, caught by the container e2e). Open: none.
