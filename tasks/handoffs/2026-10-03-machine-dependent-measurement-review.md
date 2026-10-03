# Plan review handoff: stale Rust coverage profiles

Finding: f-20261002-09. Area: gate-scripts. Root: machine-dependent-measurement. Entry: build.

The successor that adopts this plan loads this file before review. It owns P-1 through P-10 and CR-1. The plan is `tasks/plans/2026-10-02-stale-profraw.md`. Phase files: `scripts/rust-branch-coverage.mjs`, `scripts/coverage-report-tests.mjs`.

Nine review rounds. Adopted findings: r1=4 r2=2 r3=2 r4=1 r5=1 r6=2 r7=1 r8=0 r9=0. P-5 is carried as CR-1. No Skip and no Defer. Every plan-level Fix is closed. Round 9 was the drift review after the base moved from c20f8fe285c22fe238888d0d06572867e554f2b4 to 60a9abe025818676336d26329f6b20dd43d74781. The plan stands. f-20261002-09 stays the only assigned id.

## Reviews

Append-only. Raw reports stay in the lens artefacts. This section is the lookup record.

Round 1 wall time is the leaf span recorded in `plan-meta.json`. 12 plan-capable lenses. Adopted P-1, P-2, P-3, P-4. Carried CR-1. No skips.

Round 2 closure: plan, tests, error-handling, minimalism, correctness. P-2, P-3, P-4 closed by their witnesses. P-1 not closed. Adopted the P-1 tightening and P-6.

Round 3 closure: plan, tests, error-handling, correctness. P-1 closed by plan and tests. P-6 not closed by tests. Adopted the planted-profile assertion and this record (P-7).

Round 4 closure: plan, tests, error-handling. P-6 closed by tests, plan, and error-handling. P-7 closed by plan. Adopted P-8: the planted file is removed on a `finally` path when the spawn or an assertion fails.

Round 5 closure: plan, tests, error-handling. P-8 closed by all three. Adopted P-9: each new removal and walk row records a rejected promise, and every other staged call records its message and status.

Round 6 closure: plan, tests, error-handling. P-9 not closed by error-handling. Adopted the synchronous-throw status, and adopted P-10: `ENOENT` means the coverage root is missing, not a descendant. The tests late observation, that a missing root still reaches Cargo, is the success half of P-10.

Round 7 closure: plan, tests, error-handling. P-9 closed by all three. P-10 not closed: the proof said a descendant the walk cannot read, which can be `EACCES`. Adopted a descendant `readdir` `ENOENT` through `runBranchCoverage` on both pre-Cargo walks. An `EACCES` fixture does not satisfy that proof.

Round 8 closure: plan, tests, error-handling. P-10 closed by all three. No new adoption.

Round 9 drift review: chess-semantics, correctness, engine-protocol, error-handling, ipc-contract, minimalism, persisted-state, pgn-index, plan, platform-semantics, tauri-security, tests. Leaf span 1112 s. Base moved from c20f8fe285c22fe238888d0d06572867e554f2b4 to 60a9abe025818676336d26329f6b20dd43d74781. The plan body was unchanged from round 8. All twelve lenses approved. No drifted path or symbol invalidated a plan obligation. No new adoption. No out-of-scope defect was filed.

### P-1

* Claim: a direct call to the refusal helper stays green if `main` or the orchestration omits the clear and the refusal, and the coverage gate does not catch that omission.
* Witnesses: plan r1 finding 1 (blocker), tests r1 finding 1 (blocker), plan r2 finding 1 (blocker, NOT CLOSED), tests r2 finding 1 (blocker, NOT CLOSED).
* Disposition: Fix. Closed in round 3.
* Correction: the survivor proof calls only `runBranchCoverage`. `listProfiles` returns no profiles on the clear's walk and one path on the next walk. Removing the refusal walk makes the fake runner reach Cargo and the test fails.
* Evidence: `package.json` `coverage:backend:check` reads `lcov.info` only. Round 3 plan and tests both reported `P-1 CLOSED` on that sentence.
* Authority: MANDATE "before the run" and "fail if any survive". The proof has to go red when that production order is removed.
* Obligation: Refuse if any raw profile survives.

### P-2

* Claim: the approach prescribed helper signatures, `unlink`, and fixture steps that are executor choices.
* Witnesses: plan r1 finding 2 (should-fix).
* Disposition: Fix. Closed in round 2.
* Correction: the approach states behavior. The phase names `clearStaleRawProfiles`, `assertNoStaleRawProfiles`, `runBranchCoverage`, and `unlink`.
* Evidence: plan round 2 reported `P-2 CLOSED`.
* Obligation: Clear before the instrumented run.

### P-3

* Claim: a removal or walk error introduced by the clear is a new stageable path, not an inherited row.
* Witnesses: error-handling r1 finding 1 (should-fix), tests r1 finding 2 (should-fix, the new-path half).
* Disposition: Fix. Closed in round 2.
* Correction: scratch-directory rows for the removal failure and for a non-`ENOENT` walk failure, each with its own filesystem message.
* Evidence: error-handling and tests round 2 reported `P-3 CLOSED`.
* Authority: MANDATE cites push-review-policy §2. A path this change adds is stageable on a scratch directory.
* Obligation: Staged-failure matrix for this evidence script.

### P-4

* Claim: marking pre-existing throws inherited, without staging or an allowed argument, does not satisfy §2 for a script this change edits.
* Witnesses: tests r1 finding 2 (should-fix, the inherited-path half).
* Disposition: Fix. Closed in round 2.
* Correction: stage every remaining failure path through the exports. Argue only spawns that reach the clear or Cargo.
* Evidence: tests round 2 reported `P-4 CLOSED`. `push-review-policy.md` §2 fifth condition: the run that changes an evidence artefact builds the matrix in this run.
* Authority: the MANDATE's citation of push-review-policy §2, and that section's words "same area, build the matrix in this run".
* Obligation: Staged-failure matrix for this evidence script.

### P-5

* Claim: a symlink fixture can throw `EPERM` on Windows, and the proof command is not a Windows CI job.
* Witnesses: platform-semantics r1 finding 1 (should-fix).
* Disposition: Fix. `closed_round` carried, id CR-1.
* Correction: see `## Carried to diff review`. The Ubuntu contract gate is the runtime that runs this test. No new CI job.
* Evidence: `.github/workflows/test.yml` job `test` runs `pnpm gates:contract:check` on `ubuntu-latest`. The Windows and macOS jobs do not run `coverage-report-tests.mjs`.

### P-6

* Claim: the entrypoint's process exit can be staged for the tool-resolution failure without deleting profiles, because that failure happens before the clear.
* Witnesses: error-handling r2 finding 1 (should-fix). tests r3 finding 1 (should-fix, NOT CLOSED): a missing profile directory does not prove the clear did not run.
* Disposition: Fix. Closed in round 4.
* Correction: plant one `.profraw`, assert the path set is unchanged, delete only that file.
* Evidence: current `main` calls `coverageTools` before any profile walk (`scripts/rust-branch-coverage.mjs` line 122, profile walk at line 139). Round 4 plan, tests, and error-handling reported `P-6 CLOSED`.
* Authority: push-review-policy §2, record the exit status of a stageable path. The planted file is restored by the test.
* Obligation: Staged-failure matrix for this evidence script.

### P-7

* Claim: the plan file had no `## Reviews` record for lenses to look up.
* Witnesses: plan r3 finding 1 (blocker).
* Disposition: Fix. Closed in round 4.
* Correction: this section.
* Evidence: round 4 plan reported `P-7 CLOSED` on this heading.
* Obligation: the review record, not a product obligation.

### P-8

* Claim: if the planted-profile spawn or its assertion fails first, the delete does not run and the planted `.profraw` stays in the real coverage target.
* Witnesses: error-handling r4 finding 1 (should-fix).
* Disposition: Fix. Closed in round 5.
* Correction: a `finally` path deletes only the planted file, including when the spawn or an assertion fails.
* Evidence: `coverageTarget` is `scripts/rust-branch-coverage.mjs` line 13. Round 5 plan, tests, and error-handling reported `P-8 CLOSED`.
* Lineage: P-6.
* Obligation: Staged-failure matrix for this evidence script.

### P-9

* Claim: the new removal and walk rows name the filesystem message and do not name the status of that staged call.
* Witnesses: error-handling r5 finding 1 (should-fix). error-handling r6 finding 1 (should-fix, NOT CLOSED).
* Disposition: Fix. Closed in round 7.
* Correction: removal and walk rows record a rejected promise, because those calls go through async `runBranchCoverage`. `coverageTools` and `exportLcovOrDiagnose` throw synchronously, and the test records that throw. A process row records the exit status the header names.
* Evidence: `push-review-policy.md` §2 requires the message and the status. `scripts/coverage-report-tests.mjs` lines 3094 and 3165 use `assert.throws` on those two helpers. Round 6 error-handling reported `P-9 NOT CLOSED`.
* Lineage: P-3.
* Authority: the MANDATE cites push-review-policy §2, and that section requires both halves.
* Obligation: Staged-failure matrix for this evidence script.

### P-10

* Claim: treating every `ENOENT` from the recursive walk as an absent coverage root swallows a missing descendant and can still merge a sibling stale profile.
* Witnesses: error-handling r6 finding 2 (blocker). tests r6 finding 1 (should-fix, the missing-root half). plan r7 finding 1 (blocker, NOT CLOSED). tests r7 findings 1 and 2 (blocker, NOT CLOSED). error-handling r7 findings 1 and 2 (blocker, NOT CLOSED).
* Disposition: Fix. Closed in round 8.
* Correction: `ENOENT` is success only when the coverage root itself is missing. The failure proof is a nested directory whose `readdir` fails with `ENOENT`, through `runBranchCoverage`, on the clear walk and on the refusal walk, and Cargo does not start. An `EACCES` fixture does not satisfy that proof. A missing root still reaches `cargo llvm-cov`.
* Evidence: `scripts/files-below.mjs` line 5 calls `readdir` at every directory depth. A nested `ENOENT` rejects the whole walk, so the plan cannot read that rejection as an empty root.
* Authority: MANDATE "fail if any survive" and "before the run". A swallowed descendant error starts Cargo and the later merge can include a profile the walk did not finish listing.
* Obligation: Clear before the instrumented run.


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
        "text": "tasks/plans/.plan-2026-10-02-stale-profraw-r1.body.md:94 — The new `unlink` can reject with a filesystem error and stop `main` before Cargo, but it is not an inherited throw site. Omitting it from the matrix leaves a new, stageable failure path unaccounted for under push-review-policy §2. (confidence: 87)"
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
    "artefact": "lens-error-handling-r2.jsonl",
    "findings": [
      {
        "kind": "should-fix",
        "text": "tasks/plans/.plan-2026-10-02-stale-profraw-r2.body.md:88 — The process-exit sink can be staged without touching live profiles: the current entrypoint resolves tools before cleanup, so a scratch `PATH` shim that fails `rustup` can exercise and record its stderr and exit status. The plan instead infers exit 1 and argues this sink, leaving that evidence unverified against push-review-policy §2 (confidence: 91)."
      }
    ],
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
    "artefact": "lens-error-handling-r4.jsonl",
    "findings": [
      {
        "kind": "should-fix",
        "text": "tasks/plans/2026-10-02-stale-profraw.md:88 — Cleanup is specified after the spawn assertions. If the spawn or an assertion fails first, the planted `.profraw` remains in the real coverage target. Require cleanup in a `finally` path that deletes only that file (confidence: 89)"
      }
    ],
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
    "artefact": "lens-error-handling-r5.jsonl",
    "findings": [
      {
        "kind": "should-fix",
        "text": "tasks/plans/2026-10-02-stale-profraw.md:86 — The new removal and walk failure rows specify messages but not each staged call’s observed outcome or status. `push-review-policy.md` §2 requires both the distinguishing message and status for every staged assertion. (confidence: 87)"
      }
    ],
    "lens": "error-handling",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-error-handling-r5.prompt",
    "report": "lens-error-handling-r5.txt",
    "round": 5,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-error-handling-r6.jsonl",
    "findings": [
      {
        "kind": "should-fix",
        "text": "P-9 NOT CLOSED — Line 87 describes every thrown path as a rejected promise, but the named helpers `coverageTools` and `exportLcovOrDiagnose` throw synchronously when called directly. Existing tests use `assert.throws` for these calls ([coverage-report-tests.mjs](/home/felixb/.claude/drain-plans/chessfable-0a459a4f/slot-0/wt/scripts/coverage-report-tests.mjs:3094), [coverage-report-tests.mjs](/home/felixb/.claude/drain-plans/chessfable-0a459a4f/slot-0/wt/scripts/coverage-report-tests.mjs:3165)); the matrix needs to record that status or constrain those rows to an async caller."
      },
      {
        "kind": "blocker",
        "text": "tasks/plans/2026-10-02-stale-profraw.md:75 — Treating any `ENOENT` from the recursive walk as an absent coverage root can swallow a missing descendant. `filesBelow` calls `readdir` at every directory depth ([files-below.mjs](/home/felixb/.claude/drain-plans/chessfable-0a459a4f/slot-0/wt/scripts/files-below.mjs:5)). If a nested directory disappears during the survivor walk while a stale profile remains in a sibling, the walk rejects and this handling returns success; Cargo then starts, and the later merge can include that surviving stale profile (confidence: 89)."
      }
    ],
    "lens": "error-handling",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-error-handling-r6.prompt",
    "report": "lens-error-handling-r6.txt",
    "round": 6,
    "terminal": "completed",
    "verdict": "REVISE"
  },
  {
    "artefact": "lens-error-handling-r7.jsonl",
    "findings": [
      {
        "kind": "blocker",
        "text": "P-10 NOT CLOSED — the missing-root case is specified, but the descendant failure proof does not require `ENOENT`."
      },
      {
        "kind": "blocker",
        "text": "tasks/plans/2026-10-02-stale-profraw.md:68 — “A descendant the walk cannot read” could stage `EACCES` and still pass if nested `ENOENT` were swallowed. Require a descendant `ENOENT` case that rejects and does not start Cargo; `filesBelow` can raise `ENOENT` at every depth (`scripts/files-below.mjs:5`). (confidence: 95)"
      }
    ],
    "lens": "error-handling",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-error-handling-r7.prompt",
    "report": "lens-error-handling-r7.txt",
    "round": 7,
    "terminal": "completed",
    "verdict": "REVISE"
  },
  {
    "artefact": "lens-error-handling-r8.jsonl",
    "findings": [],
    "lens": "error-handling",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-error-handling-r8.prompt",
    "report": "lens-error-handling-r8.txt",
    "round": 8,
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
        "text": "tasks/plans/.plan-2026-10-02-stale-profraw-r1.body.md:84 — The proof never exercises cleanup and refusal through production orchestration. Direct helper tests remain green if `main` omits both calls; the coverage gate checks report metrics (`package.json:51`), which already pass on clean profiles (`tasks/findings.md:12460`). The existing Cargo-to-merge path at `scripts/rust-branch-coverage.mjs:123` and `:139` could therefore remain unchanged without failing either proof command. Require behavioral proof that stale profiles disappear before Cargo starts and that survivor refusal prevents Cargo from starting. (confidence: 98)"
      },
      {
        "kind": "should-fix",
        "text": "tasks/plans/.plan-2026-10-02-stale-profraw-r1.body.md:59 — Exact helper signatures, the prescribed `unlink` implementation, and fixture recipes over-specify the obligations. These are executor choices around the private `main` (`scripts/rust-branch-coverage.mjs:121`), rather than existing consumer contracts (`scripts/coverage-report-tests.mjs:33`). Move them to the phase brief; retain required behavior, failure semantics, ordering, and verification level in the plan. (confidence: 92)"
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
    "findings": [
      {
        "kind": "blocker",
        "text": "P-1 NOT CLOSED — tasks/plans/2026-10-02-stale-profraw.md:77 permits testing the refusal helper directly. Removing the refusal call from `runBranchCoverage` leaves that test, the successful-clear test, and the `main` wiring assertion green. The production merger at scripts/rust-branch-coverage.mjs:139 accepts every returned profile. Require an orchestration-level survivor case that rejects before Cargo and fails when the refusal call is removed. (confidence: 95)"
      }
    ],
    "lens": "plan",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-plan-r2.prompt",
    "report": "lens-plan-r2.txt",
    "round": 2,
    "terminal": "completed",
    "verdict": "REVISE"
  },
  {
    "artefact": "lens-plan-r3.jsonl",
    "findings": [
      {
        "kind": "blocker",
        "text": "tasks/plans/2026-10-02-stale-profraw.md:178 — the supplied full-history file ends here without `## Reviews`. Required cumulative dispositions, witnesses, and Authority entries are unavailable; the prompt’s summary cannot replace that record (`/home/felixb/.claude/references/review-lens-contract.md:138`). Supply the actual cumulative record before approval (confidence: 100)."
      }
    ],
    "lens": "plan",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-plan-r3.prompt",
    "report": "lens-plan-r3.txt",
    "round": 3,
    "terminal": "completed",
    "verdict": "REVISE"
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
    "artefact": "lens-plan-r5.jsonl",
    "findings": [],
    "lens": "plan",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-plan-r5.prompt",
    "report": "lens-plan-r5.txt",
    "round": 5,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-plan-r6.jsonl",
    "findings": [],
    "lens": "plan",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-plan-r6.prompt",
    "report": "lens-plan-r6.txt",
    "round": 6,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-plan-r7.jsonl",
    "findings": [
      {
        "kind": "blocker",
        "text": "P-10 NOT CLOSED — tasks/plans/2026-10-02-stale-profraw.md:68 and :85 permit an unreadable-directory fixture as sufficient proof. That exercises `EACCES`, as recorded in scripts/coverage-report.mjs:53, rather than the descendant `ENOENT` from recursive `readdir` in scripts/files-below.mjs:5 and :9. Blanket swallowing of `ENOENT` could therefore survive the prescribed tests despite the corrected behavior at plan lines 62 and 74. Require verification that descendant `ENOENT` rejects through `runBranchCoverage` before Cargo on both pre-Cargo walks; retain the missing-root success proof. (confidence: 92)"
      }
    ],
    "lens": "plan",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-plan-r7.prompt",
    "report": "lens-plan-r7.txt",
    "round": 7,
    "terminal": "completed",
    "verdict": "REVISE"
  },
  {
    "artefact": "lens-plan-r8.jsonl",
    "findings": [],
    "lens": "plan",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-plan-r8.prompt",
    "report": "lens-plan-r8.txt",
    "round": 8,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-platform-semantics-r1.jsonl",
    "findings": [
      {
        "kind": "should-fix",
        "text": "tasks/plans/.plan-2026-10-02-stale-profraw-r1.body.md:69 — The symlink fixture can fail with `EPERM` on Windows without symbolic-link privileges, and the proposed proof does not run this Node test on Windows or macOS. The existing `rust-windows-test`, `rust-macos-test`, and `rust-platform` jobs run Rust checks; backend coverage runs in the Ubuntu `test` job. Specify a Windows-capable fixture and a runtime route for the affected platforms. [Node.js issue #47783](https://github.com/nodejs/node/issues/47783) (confidence: 92)"
      }
    ],
    "lens": "platform-semantics",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-platform-semantics-r1.prompt",
    "report": "lens-platform-semantics-r1.txt",
    "round": 1,
    "terminal": "completed",
    "verdict": "REVISE"
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
        "kind": "blocker",
        "text": "tasks/plans/.plan-2026-10-02-stale-profraw-r1.body.md:84 — The refusal test calls the exported helper directly, so removing its call from `main` still leaves that test green. The backend gate exercises only the ordinary run after cleanup; with a clean target it can also pass without the guard, leaving stale-profile merging unprotected. No planned assertion goes red on that integration revert. (confidence: 96)"
      },
      {
        "kind": "should-fix",
        "text": "tasks/plans/.plan-2026-10-02-stale-profraw-r1.body.md:93 — The plan leaves inherited throw paths unstaged and gives no reason they are unstageable. Push-review-policy §2 requires every failure path in a changed evidence artifact to be staged or explicitly argued; line 94 also excludes the new `unlink` and `readdir` failure paths. The proposed matrix therefore would not prove those failures behave as recorded. (confidence: 94)"
      }
    ],
    "lens": "tests",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-tests-r1.prompt",
    "report": "lens-tests-r1.txt",
    "round": 1,
    "terminal": "completed",
    "verdict": "REVISE"
  },
  {
    "artefact": "lens-tests-r2.jsonl",
    "findings": [
      {
        "kind": "blocker",
        "text": "P-1 NOT CLOSED — tasks/plans/.plan-2026-10-02-stale-profraw-r2.body.md:77 allows testing the refusal helper directly. If `runBranchCoverage` stops calling that helper, the direct test still passes; the clean-path orchestration test still sees no profiles before Cargo; and the source assertion still sees `main` call the orchestration. Require the refusal and “no Cargo” assertions to exercise the orchestration path. (confidence: 96)"
      }
    ],
    "lens": "tests",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-tests-r2.prompt",
    "report": "lens-tests-r2.txt",
    "round": 2,
    "terminal": "completed",
    "verdict": "REVISE"
  },
  {
    "artefact": "lens-tests-r3.jsonl",
    "findings": [
      {
        "kind": "should-fix",
        "text": "P-6 NOT CLOSED — [tasks/plans/2026-10-02-stale-profraw.md:88] The scratch-PATH spawn checks the tool-resolution message and exit 1, but no guaranteed profile fixture or before/after assertion proves profiles survive. With the traced target absent, moving the clear before tool resolution could still produce the same message and status. (confidence: 88)"
      }
    ],
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
  },
  {
    "artefact": "lens-tests-r5.jsonl",
    "findings": [],
    "lens": "tests",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-tests-r5.prompt",
    "report": "lens-tests-r5.txt",
    "round": 5,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-tests-r6.jsonl",
    "findings": [
      {
        "kind": "should-fix",
        "text": "tasks/plans/2026-10-02-stale-profraw.md:77 — No planned assertion exercises the refusal walk when `coverageTarget` is absent. The missing-directory check covers clearing, while the survivor test forces successful listings. The staged entrypoint test creates `coverageTarget` if needed and deletes only its planted file, so the following gate sees an existing directory. A regression that rejects `ENOENT` during the refusal walk would pass these proofs but fail on a fresh first run. Add an absent-directory orchestration assertion that confirms Cargo proceeds. (confidence: 91)"
      }
    ],
    "lens": "tests",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-tests-r6.prompt",
    "report": "lens-tests-r6.txt",
    "round": 6,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-tests-r7.jsonl",
    "findings": [
      {
        "kind": "blocker",
        "text": "P-10 NOT CLOSED — the plan names descendant `ENOENT` as a failure but its test criterion only says a descendant “the walk cannot read” (`:68`), which could exercise `EACCES` instead. A regression that swallows descendant `ENOENT` could still pass."
      },
      {
        "kind": "blocker",
        "text": "tasks/plans/.plan-2026-10-02-stale-profraw-r7.body.md:68 — No assertion is specified for the corrected descendant-`ENOENT` case. Stage that error specifically and assert it propagates without starting Cargo; otherwise a root-only `ENOENT` check that mistakenly treats descendant `ENOENT` as success can go unnoticed (confidence: 94)"
      }
    ],
    "lens": "tests",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-tests-r7.prompt",
    "report": "lens-tests-r7.txt",
    "round": 7,
    "terminal": "completed",
    "verdict": "REVISE"
  },
  {
    "artefact": "lens-tests-r8.jsonl",
    "findings": [],
    "lens": "tests",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-tests-r8.prompt",
    "report": "lens-tests-r8.txt",
    "round": 8,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-chess-semantics-r9.jsonl",
    "findings": [],
    "lens": "chess-semantics",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-chess-semantics-r9.prompt",
    "report": "lens-chess-semantics-r9.txt",
    "round": 9,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-correctness-r9.jsonl",
    "findings": [],
    "lens": "correctness",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-correctness-r9.prompt",
    "report": "lens-correctness-r9.txt",
    "round": 9,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-engine-protocol-r9.jsonl",
    "findings": [],
    "lens": "engine-protocol",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-engine-protocol-r9.prompt",
    "report": "lens-engine-protocol-r9.txt",
    "round": 9,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-error-handling-r9.jsonl",
    "findings": [],
    "lens": "error-handling",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-error-handling-r9.prompt",
    "report": "lens-error-handling-r9.txt",
    "round": 9,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-ipc-contract-r9.jsonl",
    "findings": [],
    "lens": "ipc-contract",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-ipc-contract-r9.prompt",
    "report": "lens-ipc-contract-r9.txt",
    "round": 9,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-minimalism-r9.jsonl",
    "findings": [],
    "lens": "minimalism",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-minimalism-r9.prompt",
    "report": "lens-minimalism-r9.txt",
    "round": 9,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-persisted-state-r9.jsonl",
    "findings": [],
    "lens": "persisted-state",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-persisted-state-r9.prompt",
    "report": "lens-persisted-state-r9.txt",
    "round": 9,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-pgn-index-r9.jsonl",
    "findings": [],
    "lens": "pgn-index",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-pgn-index-r9.prompt",
    "report": "lens-pgn-index-r9.txt",
    "round": 9,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-plan-r9.jsonl",
    "findings": [],
    "lens": "plan",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-plan-r9.prompt",
    "report": "lens-plan-r9.txt",
    "round": 9,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-platform-semantics-r9.jsonl",
    "findings": [],
    "lens": "platform-semantics",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-platform-semantics-r9.prompt",
    "report": "lens-platform-semantics-r9.txt",
    "round": 9,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-tauri-security-r9.jsonl",
    "findings": [],
    "lens": "tauri-security",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-tauri-security-r9.prompt",
    "report": "lens-tauri-security-r9.txt",
    "round": 9,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-tests-r9.jsonl",
    "findings": [],
    "lens": "tests",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-tests-r9.prompt",
    "report": "lens-tests-r9.txt",
    "round": 9,
    "terminal": "completed",
    "verdict": "APPROVED"
  }
]

### Issues

[
  {
    "claim": "A direct call to the refusal helper stays green if main or the orchestration omits the clear and the refusal, and the coverage gate does not catch that omission.",
    "closed_round": 3,
    "correction": "The survivor proof calls only runBranchCoverage. listProfiles returns no profiles on the clear's walk and one path on the next walk. Removing the refusal walk makes the fake runner reach Cargo and the test fails.",
    "dependencies": [],
    "disposition": "Fix",
    "id": "P-1",
    "witnesses": [
      {
        "index": 1,
        "lens": "plan",
        "round": 1
      },
      {
        "index": 1,
        "lens": "tests",
        "round": 1
      },
      {
        "index": 1,
        "lens": "plan",
        "round": 2
      },
      {
        "index": 1,
        "lens": "tests",
        "round": 2
      }
    ]
  },
  {
    "claim": "The approach prescribed helper signatures, unlink, and fixture steps that are executor choices.",
    "closed_round": 2,
    "correction": "The approach states behavior. The phase names clearStaleRawProfiles, assertNoStaleRawProfiles, runBranchCoverage, and unlink.",
    "dependencies": [],
    "disposition": "Fix",
    "id": "P-2",
    "witnesses": [
      {
        "index": 2,
        "lens": "plan",
        "round": 1
      }
    ]
  },
  {
    "claim": "A removal or walk error introduced by the clear is a new stageable path, not an inherited row.",
    "closed_round": 2,
    "correction": "Scratch-directory rows for the removal failure and for a non-ENOENT walk failure, each with its own filesystem message.",
    "dependencies": [],
    "disposition": "Fix",
    "id": "P-3",
    "witnesses": [
      {
        "index": 1,
        "lens": "error-handling",
        "round": 1
      },
      {
        "index": 2,
        "lens": "tests",
        "round": 1
      }
    ]
  },
  {
    "claim": "Marking pre-existing throws inherited, without staging or an allowed argument, does not satisfy section 2 for a script this change edits.",
    "closed_round": 2,
    "correction": "Stage every remaining failure path through the exports. Argue only spawns that reach the clear or Cargo.",
    "dependencies": [],
    "disposition": "Fix",
    "id": "P-4",
    "witnesses": [
      {
        "index": 2,
        "lens": "tests",
        "round": 1
      }
    ]
  },
  {
    "carried": "CR-1",
    "claim": "A symlink fixture can throw EPERM on Windows, and the proof command is not a Windows CI job.",
    "closed_round": "carried",
    "correction": "On EPERM, skip only the non-follow assertion. The nested-profile and sibling-file assertions still run. Do not add a Windows or macOS CI job.",
    "dependencies": [],
    "disposition": "Fix",
    "id": "P-5",
    "witnesses": [
      {
        "index": 1,
        "lens": "platform-semantics",
        "round": 1
      }
    ]
  },
  {
    "claim": "The entrypoint's process exit can be staged for the tool-resolution failure without deleting profiles, because that failure happens before the clear.",
    "closed_round": 4,
    "correction": "Plant one .profraw, assert the path set is unchanged, and delete only that file.",
    "dependencies": [],
    "disposition": "Fix",
    "id": "P-6",
    "witnesses": [
      {
        "index": 1,
        "lens": "error-handling",
        "round": 2
      },
      {
        "index": 1,
        "lens": "tests",
        "round": 3
      }
    ]
  },
  {
    "claim": "The plan file had no Reviews record for lenses to look up.",
    "closed_round": 4,
    "correction": "The plan file contains a Reviews section with the cumulative dispositions.",
    "dependencies": [],
    "disposition": "Fix",
    "id": "P-7",
    "witnesses": [
      {
        "index": 1,
        "lens": "plan",
        "round": 3
      }
    ]
  },
  {
    "claim": "If the planted-profile spawn or its assertion fails first, the delete does not run and the planted .profraw stays in the real coverage target.",
    "closed_round": 5,
    "correction": "A finally path deletes only the planted file, including when the spawn or an assertion fails.",
    "dependencies": [],
    "disposition": "Fix",
    "id": "P-8",
    "witnesses": [
      {
        "index": 1,
        "lens": "error-handling",
        "round": 4
      }
    ]
  },
  {
    "claim": "The new removal and walk rows name the filesystem message and do not name the status of that staged call.",
    "closed_round": 7,
    "correction": "Removal and walk rows through async runBranchCoverage record a rejected promise. coverageTools and exportLcovOrDiagnose throw synchronously, and the test records that throw. A process row records the exit status the header names.",
    "dependencies": [],
    "disposition": "Fix",
    "id": "P-9",
    "witnesses": [
      {
        "index": 1,
        "lens": "error-handling",
        "round": 5
      },
      {
        "index": 1,
        "lens": "error-handling",
        "round": 6
      }
    ]
  },
  {
    "claim": "Treating every ENOENT from the recursive walk as an absent coverage root swallows a missing descendant and can still merge a sibling stale profile.",
    "closed_round": 8,
    "correction": "ENOENT is success only when the coverage root itself is missing. The failure proof is a nested directory whose readdir fails with ENOENT, through runBranchCoverage, on the clear walk and the refusal walk, and Cargo does not start. An EACCES fixture does not satisfy that proof. A missing root still reaches cargo llvm-cov.",
    "dependencies": [],
    "disposition": "Fix",
    "id": "P-10",
    "witnesses": [
      {
        "index": 2,
        "lens": "error-handling",
        "round": 6
      },
      {
        "index": 1,
        "lens": "tests",
        "round": 6
      },
      {
        "index": 1,
        "lens": "plan",
        "round": 7
      },
      {
        "index": 1,
        "lens": "tests",
        "round": 7
      },
      {
        "index": 2,
        "lens": "tests",
        "round": 7
      },
      {
        "index": 1,
        "lens": "error-handling",
        "round": 7
      },
      {
        "index": 2,
        "lens": "error-handling",
        "round": 7
      }
    ]
  }
]

### lens-chess-semantics-r1.txt

NOT APPLICABLE: The plan changes Rust coverage scripts and tests; it does not touch in-memory chess trees, positions, or move paths.
VERDICT: APPROVED
### lens-chess-semantics-r9.txt

NOT APPLICABLE: The plan covers Rust branch-coverage scripts and `.profraw` handling, not in-memory chess trees, positions, or move paths.

VERDICT: APPROVED
### lens-correctness-r1.txt

VERDICT: APPROVED
### lens-correctness-r2.txt

P-1 CLOSED — The orchestration test and `main` wiring assertion are specified [in the plan](</home/felixb/.claude/drain-plans/chessfable-0a459a4f/slot-0/wt/tasks/plans/2026-10-02-stale-profraw.md:77>).

P-2 CLOSED — The phase now names the exports, orchestration contract, and `unlink` behavior [in the plan](</home/felixb/.claude/drain-plans/chessfable-0a459a4f/slot-0/wt/tasks/plans/2026-10-02-stale-profraw.md:134>).

P-3 CLOSED — Removal and non-`ENOENT` walk failures each get staged scratch-directory rows [in the plan](</home/felixb/.claude/drain-plans/chessfable-0a459a4f/slot-0/wt/tasks/plans/2026-10-02-stale-profraw.md:86>).

P-4 CLOSED — The matrix stages every other failure path and argues only the live-tree entrypoint spawn [in the plan](</home/felixb/.claude/drain-plans/chessfable-0a459a4f/slot-0/wt/tasks/plans/2026-10-02-stale-profraw.md:87>), consistent with push-review-policy §2.

VERDICT: APPROVED
### lens-correctness-r3.txt

P-1 CLOSED — [tasks/plans/2026-10-02-stale-profraw.md:77] requires the survivor proof to call only `runBranchCoverage`, with `listProfiles` returning no profiles and then the stale path; omitting the refusal walk makes the fake runner reach Cargo, failing the proof.

P-6 CLOSED — [tasks/plans/2026-10-02-stale-profraw.md:88,138] stages the entrypoint with a PATH missing `rustup` and keeps tool resolution before deletion. The traced entrypoint invokes `coverageTools` before Cargo ([rust-branch-coverage.mjs:121]), so the staged failure occurs before clearing and records its message and exit status.

VERDICT: APPROVED
### lens-correctness-r9.txt

NO OPEN ISSUES

VERDICT: APPROVED
### lens-engine-protocol-r1.txt

NOT APPLICABLE: The plan and listed files concern Rust coverage profile cleanup and gate testing; they contain no UCI engine process, protocol state, or result-routing obligations.
VERDICT: APPROVED
### lens-engine-protocol-r9.txt

NOT APPLICABLE: The plan and drift concern Rust branch coverage and database deletion provenance; no engine process or UCI protocol paths are in scope.
VERDICT: APPROVED
### lens-error-handling-r1.txt

[should-fix] tasks/plans/.plan-2026-10-02-stale-profraw-r1.body.md:94 — The new `unlink` can reject with a filesystem error and stop `main` before Cargo, but it is not an inherited throw site. Omitting it from the matrix leaves a new, stageable failure path unaccounted for under push-review-policy §2. (confidence: 87)

VERDICT: APPROVED
### lens-error-handling-r2.txt

P-3 CLOSED — The clear’s removal errors and non-`ENOENT` walk errors have separate staged rows and propagate unchanged (plan lines 86–87).

[should-fix] tasks/plans/.plan-2026-10-02-stale-profraw-r2.body.md:88 — The process-exit sink can be staged without touching live profiles: the current entrypoint resolves tools before cleanup, so a scratch `PATH` shim that fails `rustup` can exercise and record its stderr and exit status. The plan instead infers exit 1 and argues this sink, leaving that evidence unverified against push-review-policy §2 (confidence: 91).

VERDICT: APPROVED
### lens-error-handling-r3.txt

P-1 CLOSED — The survivor proof calls only `runBranchCoverage`; its `listProfiles` sequence makes the test fail if the refusal walk is removed.

P-6 CLOSED — The phase resolves tools before clearing profiles, and the matrix requires an entrypoint spawn with `rustup` unavailable on a scratch `PATH`, recording exit 1 before cleanup or Cargo.

VERDICT: APPROVED
### lens-error-handling-r4.txt

P-6 CLOSED — The revised matrix plants a profile, checks that the path set is unchanged after exit 1, and deletes only the planted file. The source confirms tool resolution runs before the profile walk.

P-7 CLOSED — The full candidate plan contains `## Reviews` and the P-7 record.

[should-fix] tasks/plans/2026-10-02-stale-profraw.md:88 — Cleanup is specified after the spawn assertions. If the spawn or an assertion fails first, the planted `.profraw` remains in the real coverage target. Require cleanup in a `finally` path that deletes only that file (confidence: 89)

VERDICT: APPROVED
### lens-error-handling-r5.txt

P-8 CLOSED — line 88 says the `finally` path deletes only the planted profile even if the spawn or an assertion fails.

[should-fix] tasks/plans/2026-10-02-stale-profraw.md:86 — The new removal and walk failure rows specify messages but not each staged call’s observed outcome or status. `push-review-policy.md` §2 requires both the distinguishing message and status for every staged assertion. (confidence: 87)

VERDICT: APPROVED
### lens-error-handling-r6.txt

[should-fix] P-9 NOT CLOSED — Line 87 describes every thrown path as a rejected promise, but the named helpers `coverageTools` and `exportLcovOrDiagnose` throw synchronously when called directly. Existing tests use `assert.throws` for these calls ([coverage-report-tests.mjs](/home/felixb/.claude/drain-plans/chessfable-0a459a4f/slot-0/wt/scripts/coverage-report-tests.mjs:3094), [coverage-report-tests.mjs](/home/felixb/.claude/drain-plans/chessfable-0a459a4f/slot-0/wt/scripts/coverage-report-tests.mjs:3165)); the matrix needs to record that status or constrain those rows to an async caller.

[blocker] tasks/plans/2026-10-02-stale-profraw.md:75 — Treating any `ENOENT` from the recursive walk as an absent coverage root can swallow a missing descendant. `filesBelow` calls `readdir` at every directory depth ([files-below.mjs](/home/felixb/.claude/drain-plans/chessfable-0a459a4f/slot-0/wt/scripts/files-below.mjs:5)). If a nested directory disappears during the survivor walk while a stale profile remains in a sibling, the walk rejects and this handling returns success; Cargo then starts, and the later merge can include that surviving stale profile (confidence: 89).

VERDICT: REVISE
### lens-error-handling-r7.txt

P-9 CLOSED — r7 distinguishes synchronous helper throws from `runBranchCoverage` promise rejections, matching the existing `assert.throws` tests at `scripts/coverage-report-tests.mjs:3094` and `:3165`.

[blocker] P-10 NOT CLOSED — the missing-root case is specified, but the descendant failure proof does not require `ENOENT`.

[blocker] tasks/plans/2026-10-02-stale-profraw.md:68 — “A descendant the walk cannot read” could stage `EACCES` and still pass if nested `ENOENT` were swallowed. Require a descendant `ENOENT` case that rejects and does not start Cargo; `filesBelow` can raise `ENOENT` at every depth (`scripts/files-below.mjs:5`). (confidence: 95)

VERDICT: REVISE
### lens-error-handling-r8.txt

P-10 CLOSED — the revised proof requires a nested `readdir` `ENOENT` through `runBranchCoverage` on both pre-Cargo walks, with Cargo not started; it distinguishes root-only `ENOENT` and excludes an `EACCES` fixture. This matches the recursive walk in `scripts/files-below.mjs:5`.

VERDICT: APPROVED
### lens-error-handling-r9.txt

NO OPEN ISSUES
VERDICT: APPROVED
### lens-ipc-contract-r1.txt

NOT APPLICABLE: The plan changes only coverage scripts and explicitly has no API contract; no Rust↔renderer IPC contract can be affected.

VERDICT: APPROVED
### lens-ipc-contract-r9.txt

NOT APPLICABLE: The plan concerns Rust coverage-profile cleanup; the drift changes database-deletion helpers and records, with no renderer IPC contract touched.

VERDICT: APPROVED
### lens-minimalism-r1.txt

VERDICT: APPROVED
### lens-minimalism-r2.txt

P-1 CLOSED — `main` calls the orchestration, and a source assertion guards that wiring while fake-runner tests exercise its ordering (plan lines 67, 77).

P-2 CLOSED — The approach states behavior; helper names and `unlink` are confined to the implementation phase (lines 59–65, 136–140).

P-3 CLOSED — The new removal and walk failures have separate scratch-directory matrix rows (line 86).

P-4 CLOSED — The matrix stages the remaining failure paths and argues only the live-target entrypoint spawn, consistent with policy §2 (lines 87–88).

VERDICT: APPROVED
### lens-minimalism-r9.txt

NO OPEN ISSUES

No plan-delta defects. The drifted database, path-authority, lexer, and record changes do not invalidate a stale-profile obligation.

VERDICT: APPROVED
### lens-persisted-state-r1.txt

NOT APPLICABLE: The plan concerns Rust coverage profile cleanup and gate tests; its files and obligations do not involve persisted renderer state or tab lifecycle.
VERDICT: APPROVED
### lens-persisted-state-r9.txt

NOT APPLICABLE: The plan concerns Rust branch coverage scripts, and the drifted paths concern database and coverage records; none can affect persisted renderer state or tab lifecycle.
VERDICT: APPROVED
### lens-pgn-index-r1.txt

NOT APPLICABLE: The plan covers Rust coverage profile cleanup and gate tests; PGN scanning, indexing, encoding, and search defects cannot occur in its files or obligations.
VERDICT: APPROVED
### lens-pgn-index-r9.txt

NO OPEN ISSUES  
(2) None: no drifted path or symbol invalidates the stale-profile cleanup, refusal, matrix, or proof obligations.  
(3) None: the base move makes no blocker in the unchanged plan true.  
VERDICT: APPROVED
### lens-plan-r1.txt

[blocker] tasks/plans/.plan-2026-10-02-stale-profraw-r1.body.md:84 — The proof never exercises cleanup and refusal through production orchestration. Direct helper tests remain green if `main` omits both calls; the coverage gate checks report metrics (`package.json:51`), which already pass on clean profiles (`tasks/findings.md:12460`). The existing Cargo-to-merge path at `scripts/rust-branch-coverage.mjs:123` and `:139` could therefore remain unchanged without failing either proof command. Require behavioral proof that stale profiles disappear before Cargo starts and that survivor refusal prevents Cargo from starting. (confidence: 98)

[should-fix] tasks/plans/.plan-2026-10-02-stale-profraw-r1.body.md:59 — Exact helper signatures, the prescribed `unlink` implementation, and fixture recipes over-specify the obligations. These are executor choices around the private `main` (`scripts/rust-branch-coverage.mjs:121`), rather than existing consumer contracts (`scripts/coverage-report-tests.mjs:33`). Move them to the phase brief; retain required behavior, failure semantics, ordering, and verification level in the plan. (confidence: 92)

VERDICT: REVISE
### lens-plan-r2.txt

[blocker] P-1 NOT CLOSED — tasks/plans/2026-10-02-stale-profraw.md:77 permits testing the refusal helper directly. Removing the refusal call from `runBranchCoverage` leaves that test, the successful-clear test, and the `main` wiring assertion green. The production merger at scripts/rust-branch-coverage.mjs:139 accepts every returned profile. Require an orchestration-level survivor case that rejects before Cargo and fails when the refusal call is removed. (confidence: 95)

P-2 CLOSED — tasks/plans/2026-10-02-stale-profraw.md:59 states behavior; helper signatures and `unlink` moved into the phase brief at :136–140.

P-3 CLOSED — tasks/plans/2026-10-02-stale-profraw.md:86 requires separate staged removal and walk failures, including the filesystem rejection boundary at scripts/files-below.mjs:5.

P-4 CLOSED — tasks/plans/2026-10-02-stale-profraw.md:87 requires source-derived staging of all remaining failures, replacing inherited exemptions; :88 explicitly argues the live entrypoint bound to production paths at scripts/rust-branch-coverage.mjs:13.

VERDICT: REVISE
### lens-plan-r3.txt

P-1 CLOSED — plan-r3:77 requires the survivor test to call only `runBranchCoverage`, inject successive walk results, and fail if the refusal walk is removed; :138 supplies the required `listProfiles` option.

P-6 CLOSED — plan-r3:88 stages the pre-clear entrypoint failure. The source resolves tools first (`scripts/rust-branch-coverage.mjs:122`), invokes `rustup` (:48), and propagates spawn errors (:34), allowing the proposed scratch-PATH case.

[blocker] tasks/plans/2026-10-02-stale-profraw.md:178 — the supplied full-history file ends here without `## Reviews`. Required cumulative dispositions, witnesses, and Authority entries are unavailable; the prompt’s summary cannot replace that record (`/home/felixb/.claude/references/review-lens-contract.md:138`). Supply the actual cumulative record before approval (confidence: 100).

VERDICT: REVISE
### lens-plan-r4.txt

P-6 CLOSED — plan-r4, tasks/plans/2026-10-02-stale-profraw.md:88 requires a planted profile, an unchanged before/after profile-path set, and cleanup of only that file. scripts/rust-branch-coverage.mjs:122 resolves tools first; :48 invokes rustup and :34 propagates its spawn error before the profile walk at :139.

P-7 CLOSED — tasks/plans/2026-10-02-stale-profraw.md:180 contains `## Reviews`, with cumulative dispositions and explicit P-6/P-7 entries at :237 and :247.

VERDICT: APPROVED
### lens-plan-r5.txt

P-8 CLOSED — plan-r5, tasks/plans/2026-10-02-stale-profraw.md:88 and :165, requires `finally` cleanup of only the planted `.profraw`, including spawn and assertion failures. The live target is confirmed at scripts/rust-branch-coverage.mjs:13; tool resolution precedes Cargo at :122.

VERDICT: APPROVED
### lens-plan-r6.txt

P-9 CLOSED — plan-r6, tasks/plans/2026-10-02-stale-profraw.md:86 explicitly records each removal/walk call’s filesystem message and rejected-promise status; :87 requires message and status from every other staged call. CLI exit claims remain separate, consistent with scripts/coverage-report.mjs:26 and the entrypoint boundary in scripts/rust-branch-coverage.mjs:194.

VERDICT: APPROVED
### lens-plan-r7.txt

P-9 CLOSED — plan-r7, tasks/plans/2026-10-02-stale-profraw.md:86 distinguishes synchronous throws, async rejections, and process exits, matching scripts/rust-branch-coverage.mjs:46 and :96 and the assertions in scripts/coverage-report-tests.mjs:3094 and :3165.

[blocker] P-10 NOT CLOSED — tasks/plans/2026-10-02-stale-profraw.md:68 and :85 permit an unreadable-directory fixture as sufficient proof. That exercises `EACCES`, as recorded in scripts/coverage-report.mjs:53, rather than the descendant `ENOENT` from recursive `readdir` in scripts/files-below.mjs:5 and :9. Blanket swallowing of `ENOENT` could therefore survive the prescribed tests despite the corrected behavior at plan lines 62 and 74. Require verification that descendant `ENOENT` rejects through `runBranchCoverage` before Cargo on both pre-Cargo walks; retain the missing-root success proof. (confidence: 92)

VERDICT: REVISE
### lens-plan-r8.txt

P-10 CLOSED — candidate plan-r8, tasks/plans/2026-10-02-stale-profraw.md:68, requires nested-directory `readdir` `ENOENT` through `runBranchCoverage` on both pre-Cargo walks, rejection without starting Cargo, and missing-root success reaching Cargo. Line 85 explicitly separates this proof from `EACCES`. scripts/files-below.mjs:5 and :9 confirm recursive `readdir` failures propagate, matching the corrected obligation. (confidence: 98)

VERDICT: APPROVED
### lens-plan-r9.txt

NO OPEN ISSUES

VERDICT: APPROVED
### lens-platform-semantics-r1.txt

[should-fix] tasks/plans/.plan-2026-10-02-stale-profraw-r1.body.md:69 — The symlink fixture can fail with `EPERM` on Windows without symbolic-link privileges, and the proposed proof does not run this Node test on Windows or macOS. The existing `rust-windows-test`, `rust-macos-test`, and `rust-platform` jobs run Rust checks; backend coverage runs in the Ubuntu `test` job. Specify a Windows-capable fixture and a runtime route for the affected platforms. [Node.js issue #47783](https://github.com/nodejs/node/issues/47783) (confidence: 92)

VERDICT: REVISE
### lens-platform-semantics-r9.txt

NO OPEN ISSUES

No plan-delta hunks; no drifted path or symbol invalidates the stale-profile obligations.

Platform proof: `tasks/build-ledger.md:19` records passing `rust-windows-test`, `rust-macos-test`, and all three `rust-platform` targets. `tasks/handoffs/2026-10-02-f-20260912-09-review.md:5490` records `pnpm rust:windows:check` passing. No FreeBSD source probe is recorded for this drift; it changes no `target_os` branch.

No blocker made true by drift.

VERDICT: APPROVED
### lens-tauri-security-r1.txt

NOT APPLICABLE: The plan changes Rust coverage scripts that clear `.profraw` files and reject survivors. It does not touch native credentials, filesystem authority, signed downloads, or backend-only data flows.

VERDICT: APPROVED
### lens-tauri-security-r9.txt

NO OPEN ISSUES
VERDICT: APPROVED
### lens-tests-r1.txt

[blocker] tasks/plans/.plan-2026-10-02-stale-profraw-r1.body.md:84 — The refusal test calls the exported helper directly, so removing its call from `main` still leaves that test green. The backend gate exercises only the ordinary run after cleanup; with a clean target it can also pass without the guard, leaving stale-profile merging unprotected. No planned assertion goes red on that integration revert. (confidence: 96)

[should-fix] tasks/plans/.plan-2026-10-02-stale-profraw-r1.body.md:93 — The plan leaves inherited throw paths unstaged and gives no reason they are unstageable. Push-review-policy §2 requires every failure path in a changed evidence artifact to be staged or explicitly argued; line 94 also excludes the new `unlink` and `readdir` failure paths. The proposed matrix therefore would not prove those failures behave as recorded. (confidence: 94)

VERDICT: REVISE
### lens-tests-r2.txt

[blocker] P-1 NOT CLOSED — tasks/plans/.plan-2026-10-02-stale-profraw-r2.body.md:77 allows testing the refusal helper directly. If `runBranchCoverage` stops calling that helper, the direct test still passes; the clean-path orchestration test still sees no profiles before Cargo; and the source assertion still sees `main` call the orchestration. Require the refusal and “no Cargo” assertions to exercise the orchestration path. (confidence: 96)

P-3 CLOSED — The new removal and walk failures get separate scratch-directory rows at tasks/plans/.plan-2026-10-02-stale-profraw-r2.body.md:86.

P-4 CLOSED — The plan stages the remaining failure paths through exports and argues only the live entrypoint spawn at tasks/plans/.plan-2026-10-02-stale-profraw-r2.body.md:87–88.

VERDICT: REVISE
### lens-tests-r3.txt

P-1 CLOSED — [tasks/plans/2026-10-02-stale-profraw.md:77] The `runBranchCoverage` test expects the survivor error and no Cargo call; removing the refusal walk would fail those assertions.

[should-fix] P-6 NOT CLOSED — [tasks/plans/2026-10-02-stale-profraw.md:88] The scratch-PATH spawn checks the tool-resolution message and exit 1, but no guaranteed profile fixture or before/after assertion proves profiles survive. With the traced target absent, moving the clear before tool resolution could still produce the same message and status. (confidence: 88)

VERDICT: APPROVED
### lens-tests-r4.txt

P-6 CLOSED — [plan line 88] plants a `.profraw` before the entrypoint spawn and compares the full path set afterward. Since tool resolution precedes the profile walk, moving the clear before tool resolution removes the planted path and fails the assertion.
P-7 CLOSED — The full candidate plan includes `## Reviews` and the P-7 record at [plan line 180](/home/felixb/.claude/drain-plans/chessfable-0a459a4f/slot-0/wt/tasks/plans/2026-10-02-stale-profraw.md:180).

VERDICT: APPROVED
### lens-tests-r5.txt

P-8 CLOSED — the candidate requires a `finally` path to delete only the planted profile, including when the spawn or an assertion fails.

VERDICT: APPROVED
### lens-tests-r6.txt

P-9 CLOSED — The new removal and walk rows record a rejected promise, and each other staged call records its distinguishing message and same-call status.

LATE OBSERVATIONS

[should-fix] tasks/plans/2026-10-02-stale-profraw.md:77 — No planned assertion exercises the refusal walk when `coverageTarget` is absent. The missing-directory check covers clearing, while the survivor test forces successful listings. The staged entrypoint test creates `coverageTarget` if needed and deletes only its planted file, so the following gate sees an existing directory. A regression that rejects `ENOENT` during the refusal walk would pass these proofs but fail on a fresh first run. Add an absent-directory orchestration assertion that confirms Cargo proceeds. (confidence: 91)

VERDICT: APPROVED
### lens-tests-r7.txt

P-9 CLOSED — r7 distinguishes synchronous throws, rejected promises, and process exits; the existing helper tests assert synchronous throws at `scripts/coverage-report-tests.mjs:3094` and `:3165`.

[blocker] P-10 NOT CLOSED — the plan names descendant `ENOENT` as a failure but its test criterion only says a descendant “the walk cannot read” (`:68`), which could exercise `EACCES` instead. A regression that swallows descendant `ENOENT` could still pass.

[blocker] tasks/plans/.plan-2026-10-02-stale-profraw-r7.body.md:68 — No assertion is specified for the corrected descendant-`ENOENT` case. Stage that error specifically and assert it propagates without starting Cargo; otherwise a root-only `ENOENT` check that mistakenly treats descendant `ENOENT` as success can go unnoticed (confidence: 94)

VERDICT: REVISE
### lens-tests-r8.txt

P-10 CLOSED — r8 requires a nested `readdir` `ENOENT` to reject through `runBranchCoverage` on both walks without starting Cargo, excludes `EACCES` as proof, and preserves the missing-root path to `cargo llvm-cov`.

VERDICT: APPROVED
### lens-tests-r9.txt

NO OPEN ISSUES
VERDICT: APPROVED
### probe-1-r1.txt

- `package.json:50`, `.github/workflows/test.yml:210,223`, and `scripts/rust-branch-coverage.mjs:127,131,134,139-141` show the pinned 0.8.7 invocation tests only `chessfable`, passes `--no-report`, then merges every `.profraw` found under `src-tauri/target/llvm-cov-target`.
- `cargo-llvm-cov-0.8.7.crate::src/cargo.rs:69-90,98-99` and `src/main.rs:217,240,245-246` show the default profile path is `src-tauri/target/llvm-cov-target/src-tauri-%p-%m.profraw` in this repository; `%p` makes filenames process-specific and `%m` identifies the instrumented binary.
- `src-tauri/src/db/test_support.rs:25-31` and `src-tauri/src/practice.rs:5549-5574` show tests can spawn the same test executable, producing multiple files with the harness’s binary ID; a cold build can also produce a build-script ID because the 0.8.7 wrapper instruments package targets (`cargo-llvm-cov-0.8.7.crate::src/wrapper.rs:63-84,154-162`).
- `cargo-llvm-cov-0.8.7.crate::src/cli.rs:1589-1590` and `src/clean.rs:52-57,149-157` show `--no-report` disables automatic cleanup; `cargo llvm-cov clean --profraw-only` exists, and its help describes it as “Remove only profraw files.”
- `scripts/files-below.mjs:5,9-10` shows `filesBelow` recurses only into directory entries and returns only file entries, so it ignores symlinks.

Observed state: the profile directory was absent (`PROFILE_DIRECTORY_ABSENT`), so there were no profiles or binary IDs to inspect with `llvm-profdata show`; the binary checked with `--version` was `/home/felixb/.rustup/toolchains/nightly-2025-06-01-x86_64-unknown-linux-gnu/lib/rustlib/x86_64-unknown-linux-gnu/bin/llvm-profdata` (LLVM 20.1.5). `cargo llvm-cov --version` returned 0.8.7; `cargo install --list` could not read `.crates.toml` in the read-only environment.

PROFILES_PER_RUN: The count varies by instrumented process, not test case; a cold run can emit harness and build-script profiles under `src-tauri/target/llvm-cov-target/` (`cargo-llvm-cov-0.8.7.crate::src/main.rs:217,240,245-246`; `src-tauri/build.rs:1-3`).

CLEAN_BEHAVIOR: 0.8.7 provides `cargo llvm-cov clean --profraw-only`, but this invocation’s `--no-report` implicitly enables `--no-clean`, leaving old profiles in place (`cargo-llvm-cov-0.8.7.crate::src/cli.rs:1589-1590`; `src/clean.rs:52-57`).

BINARY_ID: A single-ID filter is not needed to distinguish sequential invocations and could discard a fresh build-script profile; it would still retain stale profiles when the test binary ID is unchanged (`cargo-llvm-cov-0.8.7.crate::src/wrapper.rs:63-84,154-162`; `scripts/rust-branch-coverage.mjs:131,134`).

DELETE_BEFORE: Yes, recursively deleting all profiles and confirming the directory is empty is sufficient for sequential runs across multiple IDs; it misses a concurrent writer that creates a profile after the check (`scripts/rust-branch-coverage.mjs:13,139-141`).

SYMLINKS: `filesBelow` does not follow symlinks, so using it for deletion would miss profiles inside symlinked directories and `.profraw` symlinks (`scripts/files-below.mjs:5,9-10`).
### probe-2-r1.txt

### Findings

- `scripts/rust-branch-coverage.mjs:194-195` calls `main()` only when `isEntrypoint` matches; `scripts/entrypoint.mjs:14-18` defines that guard, so importing the module exercises exports without running Cargo.
- `scripts/coverage-report-tests.mjs:33-40` is the only test file importing the Rust coverage module; its injected-runner tests are at `:3055-3109` and `:3151-3190`.
- `scripts/coverage-report.mjs:1-29` has its own 93-path staged-failure matrix and explains that tests reach exported functions directly; it is not a matrix for `rust-branch-coverage.mjs`.
- `scripts/check-bindings.mjs:1-4` shows the small header style: dated staged failures with observed messages and exit statuses.

### FAILURE_PATHS

1. `scripts/rust-branch-coverage.mjs:32-34,48-49,123-137,141` — A spawn error from either `rustup` query, Cargo, or `llvm-profdata merge` is rethrown after stderr is written — tested? no (none).
2. `scripts/rust-branch-coverage.mjs:32,35-40,48-49,123-137,141` — A signal death from those same commands throws a message naming the command and signal — tested? no (none).
3. `scripts/rust-branch-coverage.mjs:32,41,48-49,123-137,141` — A nonzero status from those commands throws `"<command> exited with status <n>"` — tested? no (none).
4. `scripts/rust-branch-coverage.mjs:51-52` — Missing sysroot or unparseable Rust host metadata throws “Cannot determine sysroot and host…” — tested? yes (`scripts/coverage-report-tests.mjs:3082-3101`).
5. `scripts/rust-branch-coverage.mjs:139` — Failure to read the profile target or a directory below it rejects through `filesBelow` — tested? no (none; scan implementation: `scripts/files-below.mjs:4-13`).
6. `scripts/rust-branch-coverage.mjs:140` — An empty profile scan throws “Rust coverage produced no raw profiles” — tested? no (none).
7. `scripts/rust-branch-coverage.mjs:144-147` — Failure to read the dependencies directory or stat a candidate executable rejects `main()` — tested? no (none).
8. `scripts/rust-branch-coverage.mjs:151-152` — No matching Rust coverage test executable throws “Rust coverage test executable was not found” — tested? no (none).
9. `scripts/rust-branch-coverage.mjs:168` — Failure to read the coverage config rejects `main()` — tested? no (none).
10. `scripts/rust-branch-coverage.mjs:168` — Invalid JSON in the coverage config raises `SyntaxError` — tested? no (none).
11. `scripts/rust-branch-coverage.mjs:174` — A malformed config shape can raise `TypeError` while accessing `sources` or applying exclusions — tested? no (none; exclusion access: `scripts/coverage-scope.mjs:38-43`).
12. `scripts/rust-branch-coverage.mjs:170` — Failure to scan the Rust source tree rejects `main()` — tested? no (none; scan implementation: `scripts/files-below.mjs:4-13`).
13. `scripts/rust-branch-coverage.mjs:177` — An empty post-exclusion source list throws “Rust coverage found no sources to export” — tested? no (none).
14. `scripts/rust-branch-coverage.mjs:104-108` — If bulk `llvm-cov` is signaled and a per-source probe also signals, it throws the diagnostic naming the crashing sources — tested? yes (`scripts/coverage-report-tests.mjs:3151-3168`).
15. `scripts/rust-branch-coverage.mjs:111-113` — A failed bulk `llvm-cov` spawn with `exported.error` rethrows that error — tested? no (none).
16. `scripts/rust-branch-coverage.mjs:111,114-116` — A nonzero bulk `llvm-cov` status throws “died with status … while exporting LCOV” — tested? no (none).
17. `scripts/rust-branch-coverage.mjs:105-115` — If bulk `llvm-cov` is signaled but no per-source probe identifies an offender, it throws the generic signal diagnostic — tested? no (none; signal detection itself is tested at `scripts/coverage-report-tests.mjs:3171-3190`).
18. `scripts/rust-branch-coverage.mjs:185-186` — An export with no `SF:` records throws “Rust branch coverage export was empty” — tested? no (none).
19. `scripts/rust-branch-coverage.mjs:187` — Failure to write `backend-coverage/lcov.info` rejects `main()` — tested? no (none).
20. `scripts/rust-branch-coverage.mjs:189-190` — An export with no `BRDA:` records throws “Rust coverage export contains no branch data” after writing the LCOV file — tested? no (none).
21. `scripts/rust-branch-coverage.mjs:195` — Any uncaught `main()` throw or rejection reaches Node through the top-level `await` and makes the CLI fail; the imported-function tests do not exercise that CLI exit — tested? no (none).

### MATRIX_TODAY

No: `rust-branch-coverage.mjs` has no header matrix, so none of its paths has a staged-failure matrix row. The separate `coverage-report.mjs` matrix is documented at `scripts/coverage-report.mjs:1-29`.

### TEST_COMMAND

`pnpm coverage:report:test` (`package.json:54`, which runs `node --test scripts/coverage-report-tests.mjs`).

### SEAM

`coverage-report-tests.mjs` uses temporary directories and files (`:60-68`) and directly calls exported functions; Rust coverage tests inject command runners into `coverageTools` and `exportLcovOrDiagnose` (`:3055-3109`, `:3151-3190`). A stale-profile refusal can follow that pattern: expose a small check that accepts a profile directory or profile list, create a temporary directory containing a `.profraw`, and assert the refusal directly without invoking Cargo. The current `main()` uses fixed project paths, so testing that check as an export avoids running the full pipeline.

### INHERITED_GAP

The existing explicit throw sites without any staged matrix row are `scripts/rust-branch-coverage.mjs:34,38-41,52,108,113-115,140,152,177,186,190`; only the metadata refusal (`:52`, tested at `scripts/coverage-report-tests.mjs:3082-3101`) and the per-source crash diagnostic (`:108`, tested at `:3151-3168`) have direct unit assertions. The remaining explicit throws and propagated filesystem/config failures can be named as inherited gaps.
### probe-3-r1.txt

- [scripts/rust-branch-coverage.mjs:123](/home/felixb/.claude/drain-plans/chessfable-0a459a4f/slot-0/wt/scripts/rust-branch-coverage.mjs:123) — `pnpm test:coverage:backend` invokes `cargo +nightly llvm-cov`; afterward the script merges **every** `.profraw` under `llvm-cov-target`, with no cleanup first ([line 139](/home/felixb/.claude/drain-plans/chessfable-0a459a4f/slot-0/wt/scripts/rust-branch-coverage.mjs:139)).
- [scripts/ensure-output-directory.mjs:6](/home/felixb/.claude/drain-plans/chessfable-0a459a4f/slot-0/wt/scripts/ensure-output-directory.mjs:6) — The coverage wrapper only creates `backend-coverage/`; it does not clear existing files.
- [.github/workflows/test.yml:142](/home/felixb/.claude/drain-plans/chessfable-0a459a4f/slot-0/wt/.github/workflows/test.yml:142) — CI’s Rust cache targets `src-tauri/target`, the parent of `llvm-cov-target`, but the [action documentation](https://github.com/Swatinem/rust-cache/blob/master/README.md) says it persists dependency artifacts and prunes other artifacts, so the workflow alone does not establish that `.profraw` survives caching.
- [scripts/run-push-gates.mjs:98](/home/felixb/.claude/drain-plans/chessfable-0a459a4f/slot-0/wt/scripts/run-push-gates.mjs:98) — The scheduler runs `rust-test` and `rust-coverage` as concurrent lanes; [d-20260930-01](/home/felixb/.claude/drain-plans/chessfable-0a459a4f/slot-0/wt/tasks/decisions.md:4651) records their target directories as separate, and the coverage script locates `llvm-cov-target` at its own path ([line 13](/home/felixb/.claude/drain-plans/chessfable-0a459a4f/slot-0/wt/scripts/rust-branch-coverage.mjs:13)).
- [package.json:51](/home/felixb/.claude/drain-plans/chessfable-0a459a4f/slot-0/wt/package.json:51) — `coverage:backend:check` reads `backend-coverage/lcov.info`, `coverage:baseline:backend` also reads it ([line 53](/home/felixb/.claude/drain-plans/chessfable-0a459a4f/slot-0/wt/package.json:53)), and `llvm-cov export` reads `src-tauri.profdata` ([rust-branch-coverage.mjs:182](/home/felixb/.claude/drain-plans/chessfable-0a459a4f/slot-0/wt/scripts/rust-branch-coverage.mjs:182)); CI uploads the whole output directory ([test.yml:228](/home/felixb/.claude/drain-plans/chessfable-0a459a4f/slot-0/wt/.github/workflows/test.yml:228)).
- [scripts/gate-receipt.mjs:234](/home/felixb/.claude/drain-plans/chessfable-0a459a4f/slot-0/wt/scripts/gate-receipt.mjs:234) — A receipt matches the clean tree, command, platform, toolchain, and age, while both generated paths are ignored ([.gitignore:20](/home/felixb/.claude/drain-plans/chessfable-0a459a4f/slot-0/wt/.gitignore:20), [src-tauri/.gitignore:3](/home/felixb/.claude/drain-plans/chessfable-0a459a4f/slot-0/wt/src-tauri/.gitignore:3)), so profile changes do not invalidate it.
- [scripts/coverage-report.mjs:638](/home/felixb/.claude/drain-plans/chessfable-0a459a4f/slot-0/wt/scripts/coverage-report.mjs:638) — `scopeSignature` derives measurement scope from config; deleting profiles leaves that scope unchanged but changes the hit counts used by the ratchet ([docs/coverage.md:23](/home/felixb/.claude/drain-plans/chessfable-0a459a4f/slot-0/wt/docs/coverage.md:23), [d-20260922-08](/home/felixb/.claude/drain-plans/chessfable-0a459a4f/slot-0/wt/tasks/decisions.md:3899), [d-20260928-01](/home/felixb/.claude/drain-plans/chessfable-0a459a4f/slot-0/wt/tasks/decisions.md:4539), [d-20260902-02](/home/felixb/.claude/drain-plans/chessfable-0a459a4f/slot-0/wt/tasks/decisions.md:1391)).

WRITERS: The command writing into `llvm-cov-target` is `cargo +nightly llvm-cov ... --no-report`, invoked by `pnpm test:coverage:backend`; the repo search found no other command using `--target-dir` or naming that directory.

READERS: `llvm-profdata merge` reads the discovered `.profraw` files and writes `backend-coverage/src-tauri.profdata`; `llvm-cov export` reads that profdata; `pnpm coverage:backend:check` and `pnpm coverage:baseline:backend` read `lcov.info`; CI uploads `backend-coverage/`.

RACE: Deleting stale profiles before a coverage run does not race with the standard `rust-test` lane: they run concurrently, but d-20260930-01 and the code assign coverage its separate `llvm-cov-target`; the repository has no Cargo `config.toml` target-dir override.

RECEIPT: Yes, a green receipt can skip the script while ignored `.profraw` files remain; that matters because the current script merges all of them, so the cached green is not proof of a fresh profile set or fresh ratchet measurement.

SCOPE_NARROWING: Deleting profiles does not narrow config or change `scopeSignature`; it changes which hits are counted, and can change the ratchet result.

DO_NOT_TOUCH: Leave `backend-coverage-baselines.json` and the `minimumCoverage` values in `backend-coverage-areas.json` unchanged; profile cleanup changes measurement hits, not coverage scope or the ratchet’s established thresholds.
### plan-r1.md

# Plan: Clear stale Rust coverage profiles before the instrumented run

Finding: f-20261002-09. Area: gate-scripts. Root: machine-dependent-measurement. Entry stays `build` after revalidation: the open question is which profiles count as this run, and the script is read as evidence, so the new refusal is part of the change. The planner does not annotate the ledger. The adopting session records the decision under `## Decided autonomously`.

Plan path: `tasks/plans/2026-10-02-stale-profraw.md`.

## Goal

`pnpm test:coverage:backend` merges only `.profraw` files produced by the run that just finished. Profiles left under `src-tauri/target/llvm-cov-target` by an earlier run are removed before `cargo llvm-cov` starts. If any regular-file `.profraw` the merger would see is still there after that removal, the script throws and does not start Cargo. The new refusal has one staged-failure matrix row. Baselines, floors, receipt invalidation, and the CI cache key stay as they are.

## MANDATE

Verbatim from `tasks/findings.md`, f-20261002-09. Fixed across every round.

* **ID:** f-20261002-09 · **Status:** open · **Area:** gate-scripts · **Root:** machine-dependent-measurement · **Entry:** build · **Blocked:** none
* **Where:** `scripts/rust-branch-coverage.mjs` (`coverageTarget = src-tauri/target/llvm-cov-target`; after `cargo +nightly llvm-cov … --no-report` it merges `filesBelow(coverageTarget, path.endsWith(".profraw"))` with `llvm-profdata merge -sparse`), used by `pnpm test:coverage:backend` and the receipt-backed `backend-coverage` gate.
* **Defect:** nothing removes profiles from earlier runs. On atlas on 2026-10-02 the directory held 1 517 `.profraw` files with binary signatures dating back to 2026-08-29. Every unchanged function (same name and structural hash) accumulates counts from all of them, so code that the current tests no longer execute stays "covered". Measured: on tree `04f43c1b` the local `pnpm coverage:backend:check` passed while CI (fresh checkout) failed `filesystem-native-boundaries functions regressed: 359/673, baseline 340/634`; the 8 records covered locally but not on CI were all one instance chain that the current test never runs. After deleting every `.profraw` below `llvm-cov-target` and rerunning, the local result reproduced CI exactly (359/673, red).
* **Why it matters:** the backend ratchet's local green — the push gate — can be inflated by history and disagree with CI, which is the next reader's first suspicion of "machine dependence" (`CLAUDE.md`, `f-20260829-01`) when it is in fact stale input. A push can pass every local gate and turn CI red.
* **Open question:** clear `.profraw` files under `coverageTarget` before the run (and fail if any survive), or merge only the profiles whose binary signature matches the binary just built; plus the staged-failure matrix row for the new refusal (push-review-policy §2, the script is read as evidence).
* **Found by:** Stockfish 19 upgrade build, CI red after push, 2026-10-02 (orchestrator measurement above).

## Threat model and non-goals

Frozen with the MANDATE.

Accidental input is the real case: a developer or a previous local gate leaves `.profraw` files under `coverageTarget`, including files in subdirectories and files whose `%m` binary id still matches the current test binary. The script must not treat those counts as this run. CI's fresh checkout is the environment that already fails closed; this change makes the local gate fail the same way.

A second coverage process that creates a `.profraw` after the emptiness check is a named known limit under Risks. It is the same hazard the pre-change merger already has, and `d-20260930-01` already runs `rust-test` on a different target directory. This plan adds no lock.

Adversarial input (a process that replaces profiles between the check and the merge, or a symlink farm) is out of scope. The clear uses the same directory walk the merger already uses.

Non-goals: changing what the compiler emits, which sources are exported, the numeric baselines, the area floors, receipt invalidation, the GitHub Actions cache key, or the type-erasure already landed for f-20261002-10.

## Traced premises

Locate citations. Obligations below do not repeat line numbers.

* `scripts/rust-branch-coverage.mjs` sets `coverageTarget` to `src-tauri/target/llvm-cov-target` and, in `main`, runs `cargo +<toolchain> llvm-cov --manifest-path <src-tauri/Cargo.toml> --bin chessfable --locked --branch --no-report` before any profile walk. It then merges every path `filesBelow(coverageTarget, path.endsWith(".profraw"))` returns. An empty list throws `Rust coverage produced no raw profiles`. `main` is not exported. The module runs `main` only when `isEntrypoint` matches, so a test can import the module without starting Cargo.
* `scripts/files-below.mjs` recurses only when `entry.isDirectory()` and returns a path only when `entry.isFile()` and the predicate matches. Symlinks are neither, so they are not followed and a symlink whose name ends in `.profraw` is not returned.
* Probe 1 on this worktree: `coverageTarget` was absent (`PROFILE_DIRECTORY_ABSENT`). `filesBelow` on a missing directory rejects with the `readdir` error. A first run must not fail because the directory does not exist yet.
* Orchestrator measurement, cargo-llvm-cov tag v0.8.7, fetched 2026-10-02 from `https://raw.githubusercontent.com/taiki-e/cargo-llvm-cov/v0.8.7/src/cli.rs` line 1590: `clean.no_clean |= report.no_report | no_run`. The comment at lines 1589-1590 states that `--no-report` and `--no-run` imply `--no-clean`. `src/clean.rs` `clean_profraw_files` globs `target_dir/*.profraw` only (not recursive) and `clean_partial` returns immediately when `no_clean` is set, before that glob. `src/main.rs` `set_env` sets `LLVM_PROFILE_FILE` to `target_dir.join("{workspace}-%p-%m.profraw")` for a non-nextest run (`%p` pid, `%m` binary id). Local `cargo llvm-cov --version` is 0.8.7 (probe 1). `cargo llvm-cov clean --help` documents `--profraw-only`. The probe's local crate path `cargo-llvm-cov-0.8.7` was not on disk; these citations are the tag, not that path.
* `package.json` script `test:coverage:backend` is `node scripts/ensure-output-directory.mjs backend-coverage && node scripts/rust-branch-coverage.mjs`. `coverage:backend:check` reads `backend-coverage/lcov.info`. `ensure-output-directory.mjs` creates `backend-coverage/` and does not clear `llvm-cov-target`.
* `scripts/gate-receipt.mjs` records `backend-coverage` as `pnpm test:coverage:backend && pnpm coverage:backend:check`. A green receipt can skip the script while ignored `.profraw` files remain. Those files affect only a run that executes the script.
* `scripts/run-push-gates.mjs` selects the `rust-coverage` lane (`pnpm gate:ensure backend-coverage`) from the `--rust` flag, not from changed paths. `hasCoverageInputsChanged` keys off `src-tauri/src`, `backend-coverage-areas.json`, and `backend-coverage-baselines.json`. A scripts-only diff does not select the lane. `pnpm gates:push` without `--rust` does not run it.
* `.github/workflows/test.yml` restores `src-tauri -> target` with Swatinem/rust-cache and then runs `pnpm test:coverage:backend` and `pnpm coverage:backend:check`. Whether that cache restores `.profraw` files was not proven. Delete-before still removes them if it does. The cache key is not this change.
* `scripts/coverage-report.mjs` carries the staged-failure matrix pattern: the header enumerates paths, and `scripts/coverage-report-tests.mjs` calls exported functions directly. The header states that an exported-function call is a real caller. `pnpm coverage:report:test` runs `node --test scripts/coverage-report-tests.mjs`. That file is the only importer of `rust-branch-coverage.mjs` (probe 2).
* Probe 2: `rust-branch-coverage.mjs` has no header matrix. Explicit throw sites without a staged row are at the `run` helper, the metadata refusal, the export crash and export-status throws, the empty-profile throw, the missing-executable throw, the empty-source throw, the empty-export throw, and the no-branch-data throw. Only the metadata refusal and the per-source crash diagnostic have direct unit assertions today. Inherited throws are not evidence for this change.
* `d-20260922-08`: `scopeSignature` guards what is measured. Deleting profiles changes hit counts, not the signature.
* `d-20260928-01`: test-only exclusion stays in the gate. The exporter's LCOV stays raw compiler output. `d-20260902-02` is superseded on that point.
* `d-20260930-01`: `rust-test` and `rust-coverage` stay concurrent and use different target directories (`llvm-cov-target` versus the default). No Cargo `config.toml` target-dir override was found.
* Push skill Skip catalog: do not rebaseline coverage to clear a ratchet. f-20261002-10 is already handled by type-erasing the validator. f-20260829-01 was a missing recursive-delete test, and its closing note says that root does not survive for the backend half. This finding is stale input under the same root name, not that defect.

## Approach

### Clear before the instrumented run

Quotes the MANDATE: "clear `.profraw` files under `coverageTarget` before the run".

`scripts/rust-branch-coverage.mjs` exports `clearStaleRawProfiles(directory)`. `main` awaits it on the existing `coverageTarget` constant before the existing `cargo llvm-cov` invocation. There is no production environment variable and no injected walker. Tests pass a temporary directory.

Behavior:

* The walk is `filesBelow(directory, path => path.endsWith(".profraw"))`. The same walk the merger uses, so a nested regular file is removed and a symlink is not followed.
* `ENOENT` from that walk means the directory is absent. The function returns. A first run must succeed.
* Any other walk error propagates unchanged.
* Each returned path is removed with `unlink`. The first `unlink` error propagates unchanged. Nothing is swallowed. Non-`.profraw` files and the directory itself stay, so incremental build artefacts under `llvm-cov-target` stay.
* This function does not start Cargo and does not call `cargo llvm-cov clean`.

Verification level: a unit test on a temporary directory. Plant a nested `.profraw`, a non-`.profraw` sibling, and a symlink to a directory that itself contains a `.profraw`. After the call, the nested profile is gone, the sibling remains, and the profile inside the symlink target remains. A missing directory resolves.

### Refuse if any raw profile survives

Quotes the MANDATE: "and fail if any survive".

`scripts/rust-branch-coverage.mjs` exports `assertNoStaleRawProfiles(directory)`. `main` awaits it immediately after `clearStaleRawProfiles` and before `cargo llvm-cov`. If it throws, Cargo does not start.

Behavior:

* Same walk as the clear. `ENOENT` returns.
* Any other walk error propagates unchanged.
* A non-empty result throws `new Error("Rust coverage left stale raw profiles: " + paths)`. `paths` is the returned absolute paths sorted lexicographically and joined with `", "`. The message is distinct from `Rust coverage produced no raw profiles`.
* The function does not delete and does not start Cargo.

Verification level: call the export on a temporary directory that still contains a `.profraw`, without calling the clear. The rejection message starts with `Rust coverage left stale raw profiles:` and contains that path. Do not spawn `rust-branch-coverage.mjs` and do not run Cargo. The CLI status when `main` reaches this throw is the same uncaught-rejection exit 1 as every other `main` failure. The matrix row stages the export, not a process spawn.

### Staged-failure row for the new refusal

Quotes the MANDATE: "plus the staged-failure matrix row for the new refusal (push-review-policy §2, the script is read as evidence)".

Add a header matrix on `scripts/rust-branch-coverage.mjs` in the style of `scripts/coverage-report.mjs`: one row per current failure path, the distinguishing message, and whether this change staged it.

* The new row is `assertNoStaleRawProfiles`, message `Rust coverage left stale raw profiles:`, staged by the direct call in `scripts/coverage-report-tests.mjs`. Say that `main` calls the clear and then this assert before `cargo llvm-cov`, and that the CLI exit is the shared uncaught rejection.
* Every pre-existing throw stays listed and marked inherited, not staged by this change. Probe 2's explicit sites are the starting enumeration; the executor re-reads the file and adds a path the probe missed, still marked inherited. Staging those paths is not this mandate. `review-plan` and `review-minimalism` own that scope check.
* An `unlink` or `readdir` error that propagates is an inherited filesystem failure. It is not a second new refusal and it does not get its own staged row.

### Proof the adopting session runs

The phase proof is two commands, in this order:

1. `pnpm coverage:report:test`
2. `pnpm gate:ensure backend-coverage`

Command 2 is required even though a scripts-only diff does not select `rust-coverage` and `pnpm gates:push` without `--rust` skips it. The planner does not start either command. The adopting session also runs `pnpm checks:pre-review` before cumulative diff review, because the push skill's pre-review block formats and lints these `.mjs` files. That block does not replace command 2.

No browser check. The change is not a rendered surface.

## Decisions and trade-offs

Chosen mechanism: clear, then refuse. Rejected: merge only profiles whose `%m` matches the binary just built. A cold run can emit a build-script profile with a different `%m` in the same invocation (cargo-llvm-cov 0.8.7 `set_env`), and a stale file whose `%m` still matches the current test binary is exactly the inflation the finding measured. A filter would drop the fresh extra profile and keep the stale one.

Rejected: `cargo llvm-cov clean --profraw-only` as the only clear. Its glob is `target_dir/*.profraw`. The merger is recursive. Nested profiles would survive and be merged.

Rejected: dropping `--no-report` so cargo-llvm-cov's automatic clean runs. That path also runs `clean_partial`, which cargo-cleans the measured crates, and it generates cargo-llvm-cov's own report. This repository exports LCOV itself because `--branch` segfaults (llvm/llvm-project#119558), which the script already handles. `--no-report` stays.

Rejected: a new lock around the coverage target. `d-20260930-01` already separates `rust-test` onto another target directory. A second writer of `llvm-cov-target` after the assert is the known limit below, not a new mechanism.

## Risks / open questions

Known limit, named here, not a new lock: a second process that writes a `.profraw` under `coverageTarget` after `assertNoStaleRawProfiles` returns can still be merged. The pre-change script has the same window, with no preceding clear. No Cargo target-dir override puts `rust-test` on `llvm-cov-target`.

No open product question. The mechanism is the technical choice recorded under `## Decided autonomously`.

## Not part of this task

* `backend-coverage-baselines.json`, `minimumCoverage` in `backend-coverage-areas.json`, and any re-record of `scopeSignature`.
* Receipt invalidation in `scripts/gate-receipt.mjs`. A skipped run does not merge stale profiles.
* The GitHub Actions rust-cache key and `scripts/run-push-gates.mjs` lane selection.
* Restaging the inherited throws in `rust-branch-coverage.mjs`.
* f-20261002-10 (handled) and f-20261002-08.
* `docs/coverage.md`, unless a sentence there claims the profile directory is already cleared. It does not, as read in locate.
* A lock, a watcher, or a production environment variable for the profile directory.

## Phases

One phase. Area: gate-scripts. No auth, persistence, concurrency control, or API contract. Executor: Codex write, role `normal` (these paths are not in the push skill's sensitive globs).

Files: `scripts/rust-branch-coverage.mjs`, `scripts/coverage-report-tests.mjs`. Read `scripts/files-below.mjs` and `scripts/coverage-report.mjs`. Do not edit them.

Implements Clear before the instrumented run, Refuse if any raw profile survives, and Staged-failure row for the new refusal.

PROOF:

```bash
pnpm coverage:report:test
pnpm gate:ensure backend-coverage
```

The planner does not run these. The adopting session runs both, and runs `pnpm checks:pre-review` before cumulative diff review.

## Decided autonomously

Questioning is skipped because the launch says `full auto`. The adopting session records each entry with `./scripts/findings.py record-decision`. The planner does not.

### Which profiles count as this run?

* **Question:** Clear `.profraw` files under `coverageTarget` before the run and fail if any survive, or merge only the profiles whose binary signature matches the binary just built?
* **Chosen:** Clear every regular-file `.profraw` that `filesBelow(coverageTarget)` would return, then throw `Rust coverage left stale raw profiles:` if any remain, before `cargo llvm-cov`. A missing directory is success. Symlinks are not followed.
* **Rejected:** A `%m` filter. `cargo llvm-cov clean --profraw-only` as the only clear. Dropping `--no-report`.
* **Reason:** cargo-llvm-cov 0.8.7 sets `no_clean` when `--no-report` is passed, and its own profraw clean is a non-recursive glob while this script merges recursively. A binary-id filter drops a fresh build-script profile from the same invocation and keeps a stale file whose `%m` still matches the current test binary. Reversal path: replace the clear with a filter that keeps every profile written by this invocation, including a different `%m`, and still drops a stale file with the current `%m`.

### What does the new refusal's matrix row cover?

* **Question:** Stage only the new survivor refusal, or restage every existing throw in `rust-branch-coverage.mjs`?
* **Chosen:** One new staged row for `assertNoStaleRawProfiles`. Inherited throws are enumerated in the header and marked not staged by this change.
* **Rejected:** A staging project for the pre-existing throws.
* **Reason:** The finding's words are "the staged-failure matrix row for the new refusal". Inherited gaps stay visible and are not this mandate. Reversal path: a later finding that names those throws.

### Does the adopting session run the coverage gate when path selection would skip it?

* **Question:** Is `pnpm coverage:report:test` enough proof, given `gates:push` will not select `backend-coverage` from a scripts-only diff?
* **Chosen:** The phase proof is `pnpm coverage:report:test` and then `pnpm gate:ensure backend-coverage`.
* **Rejected:** Relying on path selection or on `pnpm gates:push` without `--rust`.
* **Reason:** The artefact is the gate. The unit test does not execute `main` or Cargo. Reversal path: teach lane selection to notice this script, which is a different change and is not this mandate.

## Carried to diff review

None at plan write. The adopting session's cumulative diff review closes any `CR-*` added during plan review.

### plan-r2.md

# Plan: Clear stale Rust coverage profiles before the instrumented run

Finding: f-20261002-09. Area: gate-scripts. Root: machine-dependent-measurement. Entry stays `build` after revalidation: the open question is which profiles count as this run, and the script is read as evidence, so the new refusal is part of the change. The planner does not annotate the ledger. The adopting session records the decision under `## Decided autonomously`.

Plan path: `tasks/plans/2026-10-02-stale-profraw.md`.

## Goal

`pnpm test:coverage:backend` merges only `.profraw` files produced by the run that just finished. Profiles left under `src-tauri/target/llvm-cov-target` by an earlier run are removed before `cargo llvm-cov` starts. If any regular-file `.profraw` the merger would see is still there after that removal, the script throws and does not start Cargo. The new refusal has one staged-failure matrix row. Baselines, floors, receipt invalidation, and the CI cache key stay as they are.

## MANDATE

Verbatim from `tasks/findings.md`, f-20261002-09. Fixed across every round.

* **ID:** f-20261002-09 · **Status:** open · **Area:** gate-scripts · **Root:** machine-dependent-measurement · **Entry:** build · **Blocked:** none
* **Where:** `scripts/rust-branch-coverage.mjs` (`coverageTarget = src-tauri/target/llvm-cov-target`; after `cargo +nightly llvm-cov … --no-report` it merges `filesBelow(coverageTarget, path.endsWith(".profraw"))` with `llvm-profdata merge -sparse`), used by `pnpm test:coverage:backend` and the receipt-backed `backend-coverage` gate.
* **Defect:** nothing removes profiles from earlier runs. On atlas on 2026-10-02 the directory held 1 517 `.profraw` files with binary signatures dating back to 2026-08-29. Every unchanged function (same name and structural hash) accumulates counts from all of them, so code that the current tests no longer execute stays "covered". Measured: on tree `04f43c1b` the local `pnpm coverage:backend:check` passed while CI (fresh checkout) failed `filesystem-native-boundaries functions regressed: 359/673, baseline 340/634`; the 8 records covered locally but not on CI were all one instance chain that the current test never runs. After deleting every `.profraw` below `llvm-cov-target` and rerunning, the local result reproduced CI exactly (359/673, red).
* **Why it matters:** the backend ratchet's local green — the push gate — can be inflated by history and disagree with CI, which is the next reader's first suspicion of "machine dependence" (`CLAUDE.md`, `f-20260829-01`) when it is in fact stale input. A push can pass every local gate and turn CI red.
* **Open question:** clear `.profraw` files under `coverageTarget` before the run (and fail if any survive), or merge only the profiles whose binary signature matches the binary just built; plus the staged-failure matrix row for the new refusal (push-review-policy §2, the script is read as evidence).
* **Found by:** Stockfish 19 upgrade build, CI red after push, 2026-10-02 (orchestrator measurement above).

## Threat model and non-goals

Frozen with the MANDATE.

Accidental input is the real case: a developer or a previous local gate leaves `.profraw` files under `coverageTarget`, including files in subdirectories and files whose `%m` binary id still matches the current test binary. The script must not treat those counts as this run. CI's fresh checkout is the environment that already fails closed; this change makes the local gate fail the same way.

A second coverage process that creates a `.profraw` after the emptiness check is a named known limit under Risks. It is the same hazard the pre-change merger already has, and `d-20260930-01` already runs `rust-test` on a different target directory. This plan adds no lock.

Adversarial input (a process that replaces profiles between the check and the merge, or a symlink farm) is out of scope. The clear uses the same directory walk the merger already uses.

Non-goals: changing what the compiler emits, which sources are exported, the numeric baselines, the area floors, receipt invalidation, the GitHub Actions cache key, or the type-erasure already landed for f-20261002-10.

## Traced premises

Locate citations. Obligations below do not repeat line numbers.

* `scripts/rust-branch-coverage.mjs` sets `coverageTarget` to `src-tauri/target/llvm-cov-target` and, in `main`, runs `cargo +<toolchain> llvm-cov --manifest-path <src-tauri/Cargo.toml> --bin chessfable --locked --branch --no-report` before any profile walk. It then merges every path `filesBelow(coverageTarget, path.endsWith(".profraw"))` returns. An empty list throws `Rust coverage produced no raw profiles`. `main` is not exported. The module runs `main` only when `isEntrypoint` matches, so a test can import the module without starting Cargo.
* `scripts/files-below.mjs` recurses only when `entry.isDirectory()` and returns a path only when `entry.isFile()` and the predicate matches. Symlinks are neither, so they are not followed and a symlink whose name ends in `.profraw` is not returned.
* Probe 1 on this worktree: `coverageTarget` was absent (`PROFILE_DIRECTORY_ABSENT`). `filesBelow` on a missing directory rejects with the `readdir` error. A first run must not fail because the directory does not exist yet.
* Orchestrator measurement, cargo-llvm-cov tag v0.8.7, fetched 2026-10-02 from `https://raw.githubusercontent.com/taiki-e/cargo-llvm-cov/v0.8.7/src/cli.rs` line 1590: `clean.no_clean |= report.no_report | no_run`. The comment at lines 1589-1590 states that `--no-report` and `--no-run` imply `--no-clean`. `src/clean.rs` `clean_profraw_files` globs `target_dir/*.profraw` only (not recursive) and `clean_partial` returns immediately when `no_clean` is set, before that glob. `src/main.rs` `set_env` sets `LLVM_PROFILE_FILE` to `target_dir.join("{workspace}-%p-%m.profraw")` for a non-nextest run (`%p` pid, `%m` binary id). Local `cargo llvm-cov --version` is 0.8.7 (probe 1). `cargo llvm-cov clean --help` documents `--profraw-only`. The probe's local crate path `cargo-llvm-cov-0.8.7` was not on disk; these citations are the tag, not that path.
* `package.json` script `test:coverage:backend` is `node scripts/ensure-output-directory.mjs backend-coverage && node scripts/rust-branch-coverage.mjs`. `coverage:backend:check` reads `backend-coverage/lcov.info`. `ensure-output-directory.mjs` creates `backend-coverage/` and does not clear `llvm-cov-target`.
* `scripts/gate-receipt.mjs` records `backend-coverage` as `pnpm test:coverage:backend && pnpm coverage:backend:check`. A green receipt can skip the script while ignored `.profraw` files remain. Those files affect only a run that executes the script.
* `scripts/run-push-gates.mjs` selects the `rust-coverage` lane (`pnpm gate:ensure backend-coverage`) from the `--rust` flag, not from changed paths. `hasCoverageInputsChanged` keys off `src-tauri/src`, `backend-coverage-areas.json`, and `backend-coverage-baselines.json`. A scripts-only diff does not select the lane. `pnpm gates:push` without `--rust` does not run it.
* `.github/workflows/test.yml` restores `src-tauri -> target` with Swatinem/rust-cache and then runs `pnpm test:coverage:backend` and `pnpm coverage:backend:check`. Whether that cache restores `.profraw` files was not proven. Delete-before still removes them if it does. The cache key is not this change.
* `scripts/coverage-report.mjs` carries the staged-failure matrix pattern: the header enumerates paths, and `scripts/coverage-report-tests.mjs` calls exported functions directly. The header states that an exported-function call is a real caller. `pnpm coverage:report:test` runs `node --test scripts/coverage-report-tests.mjs`. That file is the only importer of `rust-branch-coverage.mjs` (probe 2).
* Probe 2: `rust-branch-coverage.mjs` has no header matrix. Explicit throw sites without a staged row are at the `run` helper, the metadata refusal, the export crash and export-status throws, the empty-profile throw, the missing-executable throw, the empty-source throw, the empty-export throw, and the no-branch-data throw. Only the metadata refusal and the per-source crash diagnostic have direct unit assertions today. Inherited throws are not evidence for this change.
* `d-20260922-08`: `scopeSignature` guards what is measured. Deleting profiles changes hit counts, not the signature.
* `d-20260928-01`: test-only exclusion stays in the gate. The exporter's LCOV stays raw compiler output. `d-20260902-02` is superseded on that point.
* `d-20260930-01`: `rust-test` and `rust-coverage` stay concurrent and use different target directories (`llvm-cov-target` versus the default). No Cargo `config.toml` target-dir override was found.
* Push skill Skip catalog: do not rebaseline coverage to clear a ratchet. f-20261002-10 is already handled by type-erasing the validator. f-20260829-01 was a missing recursive-delete test, and its closing note says that root does not survive for the backend half. This finding is stale input under the same root name, not that defect.

## Approach

### Clear before the instrumented run

Quotes the MANDATE: "clear `.profraw` files under `coverageTarget` before the run".

Before `cargo llvm-cov`, remove every regular-file `.profraw` the merger would see.

* The walk is the same `filesBelow` walk the merger uses, so a nested regular file is removed and a symlink is not followed.
* `ENOENT` from that walk means the directory is absent. Clearing returns. A first run must succeed.
* Any other walk error propagates unchanged. It does not start Cargo.
* Each returned path is removed. The first removal error propagates unchanged, with the filesystem error's own message. Nothing is swallowed. Non-`.profraw` files and the directory itself stay, so incremental build artefacts under `llvm-cov-target` stay.
* This step does not call `cargo llvm-cov clean`.

The production path is one exported orchestration function that `main` calls and that tests call with scratch directories and a fake command runner. `main` passes no arguments; the defaults are today's paths and today's runners. There is no production environment variable. The phase names the exports. Private branch structure inside the function stays with the executor.

Verification level: a temporary directory. Plant a nested `.profraw`, a non-`.profraw` sibling, and, where creating a symlink succeeds, a symlink to a directory that contains a `.profraw`. After the clear, the nested profile is gone, the sibling remains, and the profile behind the symlink remains. A missing directory resolves. `CR-1` covers the platform where creating the symlink is refused.

### Refuse if any raw profile survives

Quotes the MANDATE: "and fail if any survive".

Immediately after the clear, and before `cargo llvm-cov`, walk again. A non-empty result throws `new Error("Rust coverage left stale raw profiles: " + paths)`. `paths` is the absolute paths sorted lexicographically and joined with `", "`. The message is distinct from `Rust coverage produced no raw profiles`. `ENOENT` on this walk returns. Any other walk error propagates. The throw does not delete and does not start Cargo.

Verification level: call the orchestration, or the refusal check the phase exports, on a temporary directory that still contains a `.profraw`. The fake command runner records every command. The rejection message starts with `Rust coverage left stale raw profiles:` and contains that path, and the runner was not asked to run `cargo`. A second test plants profiles, lets the clear remove them, and asserts the runner's `cargo` `llvm-cov` invocation happens only after the directory has no `.profraw`. A test reads `scripts/rust-branch-coverage.mjs` and fails if `main` does not call the orchestration export, so deleting that call from `main` goes red without a Cargo run.

### Staged-failure matrix for this evidence script

Quotes the MANDATE: "plus the staged-failure matrix row for the new refusal (push-review-policy §2, the script is read as evidence)".

`push-review-policy.md` §2, the section the finding names, says the run that changes an evidence artefact owns its matrix, and an inherited gap in the same area is built in this run rather than left as a licence. This change edits `scripts/rust-branch-coverage.mjs`, and `pnpm coverage:backend:check` reads that run's result as evidence. The header matrix follows `scripts/coverage-report.mjs`: every failure path, the distinguishing message, and staged or argued.

* One row is the survivor refusal, message `Rust coverage left stale raw profiles:`, staged by the scratch-directory call above. The recorded status for that staged call is a rejected promise. The header states that `main`'s CLI exit, when this throw escapes the top-level `await`, is Node's exit 1.
* Removal and walk failures that this change adds (the clear's removal error, and a walk error other than the handled `ENOENT`) are staged on a scratch directory. A mode that makes removal fail, and a directory that cannot be read, are enough. Their messages are the filesystem errors Node raises. They get their own rows because those messages are not the survivor message.
* Every other failure path in the file after the edit is staged too, through the exported orchestration and the helpers it already exports (`coverageTools`, `exportLcovOrDiagnose`), using scratch directories and a fake runner. Probe 2's list is the starting enumeration, not the matrix: the executor re-reads the edited file and accounts for each path. Paths that already have a direct assertion are staged rows, not gaps.
* The process-exit sink of spawning `node scripts/rust-branch-coverage.mjs` is argued, not staged. The entrypoint binds the real `coverageTarget` and would delete live profiles or start Cargo. That is harm that outlives a unit run, and the script has no scratch-path input. The header says so, in the same way `coverage-report.mjs` records its shared CLI sink. The source assertion on `main` is the check that the entrypoint reaches the orchestration. It is a test about the wiring, not a staged row of the artefact reading its own source.

### Proof the adopting session runs

The phase proof is two commands, in this order:

1. `pnpm coverage:report:test`
2. `pnpm gate:ensure backend-coverage`

Command 2 is required even though a scripts-only diff does not select `rust-coverage` and `pnpm gates:push` without `--rust` skips it. The planner does not start either command. The adopting session also runs `pnpm checks:pre-review` before cumulative diff review, because the push skill's pre-review block formats and lints these `.mjs` files. That block does not replace command 2.

No browser check. The change is not a rendered surface.

## Decisions and trade-offs

Chosen mechanism: clear, then refuse. Rejected: merge only profiles whose `%m` matches the binary just built. A cold run can emit a build-script profile with a different `%m` in the same invocation (cargo-llvm-cov 0.8.7 `set_env`), and a stale file whose `%m` still matches the current test binary is exactly the inflation the finding measured. A filter would drop the fresh extra profile and keep the stale one.

Rejected: `cargo llvm-cov clean --profraw-only` as the only clear. Its glob is `target_dir/*.profraw`. The merger is recursive. Nested profiles would survive and be merged.

Rejected: dropping `--no-report` so cargo-llvm-cov's automatic clean runs. That path also runs `clean_partial`, which cargo-cleans the measured crates, and it generates cargo-llvm-cov's own report. This repository exports LCOV itself because `--branch` segfaults (llvm/llvm-project#119558), which the script already handles. `--no-report` stays.

Rejected: a new lock around the coverage target. `d-20260930-01` already separates `rust-test` onto another target directory. A second writer of `llvm-cov-target` after the assert is the known limit below, not a new mechanism.

## Risks / open questions

Known limit, named here, not a new lock: a second process that writes a `.profraw` under `coverageTarget` after the survivor check returns can still be merged. The pre-change script has the same window, with no preceding clear. No Cargo target-dir override puts `rust-test` on `llvm-cov-target`.

No open product question. The mechanism is the technical choice recorded under `## Decided autonomously`.

## Not part of this task

* `backend-coverage-baselines.json`, `minimumCoverage` in `backend-coverage-areas.json`, and any re-record of `scopeSignature`.
* Receipt invalidation in `scripts/gate-receipt.mjs`. A skipped run does not merge stale profiles.
* The GitHub Actions rust-cache key and `scripts/run-push-gates.mjs` lane selection.
* f-20261002-10 (handled) and f-20261002-08.
* `docs/coverage.md`, unless a sentence there claims the profile directory is already cleared. It does not, as read in locate.
* A lock, a watcher, or a production environment variable for the profile directory.

## Phases

One phase. Area: gate-scripts. No auth, persistence, concurrency control, or API contract. Executor: Codex write, role `normal` (these paths are not in the push skill's sensitive globs).

Files: `scripts/rust-branch-coverage.mjs`, `scripts/coverage-report-tests.mjs`. Read `scripts/files-below.mjs` and `scripts/coverage-report.mjs`. Do not edit them.

Implements Clear before the instrumented run, Refuse if any raw profile survives, and Staged-failure matrix for this evidence script.

Spelling this phase uses, so the tests and the header name one thing:

* `clearStaleRawProfiles(directory)` removes the regular-file profiles.
* `assertNoStaleRawProfiles(directory)` throws the survivor message.
* `runBranchCoverage(options)` performs the clear, the assert, then the existing Cargo, merge, and export steps. Omitted options are today's paths and the current `run` / `attempt` runners. `main` is the no-argument call.

Removal is `unlink` of each path the walk returned. Do not follow symlinks. Do not add an environment variable.

PROOF:

```bash
pnpm coverage:report:test
pnpm gate:ensure backend-coverage
```

The planner does not run these. The adopting session runs both, and runs `pnpm checks:pre-review` before cumulative diff review.

## Decided autonomously

Questioning is skipped because the launch says `full auto`. The adopting session records each entry with `./scripts/findings.py record-decision`. The planner does not.

### Which profiles count as this run?

* **Question:** Clear `.profraw` files under `coverageTarget` before the run and fail if any survive, or merge only the profiles whose binary signature matches the binary just built?
* **Chosen:** Clear every regular-file `.profraw` that `filesBelow(coverageTarget)` would return, then throw `Rust coverage left stale raw profiles:` if any remain, before `cargo llvm-cov`. A missing directory is success. Symlinks are not followed.
* **Rejected:** A `%m` filter. `cargo llvm-cov clean --profraw-only` as the only clear. Dropping `--no-report`.
* **Reason:** cargo-llvm-cov 0.8.7 sets `no_clean` when `--no-report` is passed, and its own profraw clean is a non-recursive glob while this script merges recursively. A binary-id filter drops a fresh build-script profile from the same invocation and keeps a stale file whose `%m` still matches the current test binary. Reversal path: replace the clear with a filter that keeps every profile written by this invocation, including a different `%m`, and still drops a stale file with the current `%m`.

### What does the matrix cover?

* **Question:** Stage only the new survivor refusal, or every failure path of `rust-branch-coverage.mjs`?
* **Chosen:** The whole matrix. The survivor refusal, the new removal and walk failures, and every other path in the edited file are staged through the exports against scratch inputs. Spawning the entrypoint is argued because it binds the live coverage tree.
* **Rejected:** Listing pre-existing throws as inherited and not staging them. Round 1's first draft chose that, and it does not survive `push-review-policy.md` §2's rule that the run which changes an evidence artefact builds the matrix in this run. The finding cites that section.
* **Reason:** `pnpm coverage:backend:check` reads this script's result as evidence. A header that names unstaged paths does not make those paths evidence. Reversal path: a later decision that the gate stops treating this script's exit as evidence.

### Does the adopting session run the coverage gate when path selection would skip it?

* **Question:** Is `pnpm coverage:report:test` enough proof, given `gates:push` will not select `backend-coverage` from a scripts-only diff?
* **Chosen:** The phase proof is `pnpm coverage:report:test` and then `pnpm gate:ensure backend-coverage`.
* **Rejected:** Relying on path selection or on `pnpm gates:push` without `--rust`.
* **Reason:** The artefact is the gate. The unit test does not execute `main` or Cargo. Reversal path: teach lane selection to notice this script, which is a different change and is not this mandate.

## Carried to diff review

* CR-1 — Symlink fixture on a platform that refuses `symlink` with `EPERM`. The non-follow assertion runs where creating a symlink in a temporary directory succeeds. On `EPERM`, skip only that assertion; the nested-profile and sibling-file assertions still run. Do not add a Windows or macOS CI job. The contract gate that runs `pnpm coverage:report:test` is the Ubuntu `test` job (`.github/workflows/test.yml`).

### plan-r3.md

# Plan: Clear stale Rust coverage profiles before the instrumented run

Finding: f-20261002-09. Area: gate-scripts. Root: machine-dependent-measurement. Entry stays `build` after revalidation: the open question is which profiles count as this run, and the script is read as evidence, so the new refusal is part of the change. The planner does not annotate the ledger. The adopting session records the decision under `## Decided autonomously`.

Plan path: `tasks/plans/2026-10-02-stale-profraw.md`.

## Goal

`pnpm test:coverage:backend` merges only `.profraw` files produced by the run that just finished. Profiles left under `src-tauri/target/llvm-cov-target` by an earlier run are removed before `cargo llvm-cov` starts. If any regular-file `.profraw` the merger would see is still there after that removal, the script throws and does not start Cargo. The new refusal has one staged-failure matrix row. Baselines, floors, receipt invalidation, and the CI cache key stay as they are.

## MANDATE

Verbatim from `tasks/findings.md`, f-20261002-09. Fixed across every round.

* **ID:** f-20261002-09 · **Status:** open · **Area:** gate-scripts · **Root:** machine-dependent-measurement · **Entry:** build · **Blocked:** none
* **Where:** `scripts/rust-branch-coverage.mjs` (`coverageTarget = src-tauri/target/llvm-cov-target`; after `cargo +nightly llvm-cov … --no-report` it merges `filesBelow(coverageTarget, path.endsWith(".profraw"))` with `llvm-profdata merge -sparse`), used by `pnpm test:coverage:backend` and the receipt-backed `backend-coverage` gate.
* **Defect:** nothing removes profiles from earlier runs. On atlas on 2026-10-02 the directory held 1 517 `.profraw` files with binary signatures dating back to 2026-08-29. Every unchanged function (same name and structural hash) accumulates counts from all of them, so code that the current tests no longer execute stays "covered". Measured: on tree `04f43c1b` the local `pnpm coverage:backend:check` passed while CI (fresh checkout) failed `filesystem-native-boundaries functions regressed: 359/673, baseline 340/634`; the 8 records covered locally but not on CI were all one instance chain that the current test never runs. After deleting every `.profraw` below `llvm-cov-target` and rerunning, the local result reproduced CI exactly (359/673, red).
* **Why it matters:** the backend ratchet's local green — the push gate — can be inflated by history and disagree with CI, which is the next reader's first suspicion of "machine dependence" (`CLAUDE.md`, `f-20260829-01`) when it is in fact stale input. A push can pass every local gate and turn CI red.
* **Open question:** clear `.profraw` files under `coverageTarget` before the run (and fail if any survive), or merge only the profiles whose binary signature matches the binary just built; plus the staged-failure matrix row for the new refusal (push-review-policy §2, the script is read as evidence).
* **Found by:** Stockfish 19 upgrade build, CI red after push, 2026-10-02 (orchestrator measurement above).

## Threat model and non-goals

Frozen with the MANDATE.

Accidental input is the real case: a developer or a previous local gate leaves `.profraw` files under `coverageTarget`, including files in subdirectories and files whose `%m` binary id still matches the current test binary. The script must not treat those counts as this run. CI's fresh checkout is the environment that already fails closed; this change makes the local gate fail the same way.

A second coverage process that creates a `.profraw` after the emptiness check is a named known limit under Risks. It is the same hazard the pre-change merger already has, and `d-20260930-01` already runs `rust-test` on a different target directory. This plan adds no lock.

Adversarial input (a process that replaces profiles between the check and the merge, or a symlink farm) is out of scope. The clear uses the same directory walk the merger already uses.

Non-goals: changing what the compiler emits, which sources are exported, the numeric baselines, the area floors, receipt invalidation, the GitHub Actions cache key, or the type-erasure already landed for f-20261002-10.

## Traced premises

Locate citations. Obligations below do not repeat line numbers.

* `scripts/rust-branch-coverage.mjs` sets `coverageTarget` to `src-tauri/target/llvm-cov-target` and, in `main`, runs `cargo +<toolchain> llvm-cov --manifest-path <src-tauri/Cargo.toml> --bin chessfable --locked --branch --no-report` before any profile walk. It then merges every path `filesBelow(coverageTarget, path.endsWith(".profraw"))` returns. An empty list throws `Rust coverage produced no raw profiles`. `main` is not exported. The module runs `main` only when `isEntrypoint` matches, so a test can import the module without starting Cargo.
* `scripts/files-below.mjs` recurses only when `entry.isDirectory()` and returns a path only when `entry.isFile()` and the predicate matches. Symlinks are neither, so they are not followed and a symlink whose name ends in `.profraw` is not returned.
* Probe 1 on this worktree: `coverageTarget` was absent (`PROFILE_DIRECTORY_ABSENT`). `filesBelow` on a missing directory rejects with the `readdir` error. A first run must not fail because the directory does not exist yet.
* Orchestrator measurement, cargo-llvm-cov tag v0.8.7, fetched 2026-10-02 from `https://raw.githubusercontent.com/taiki-e/cargo-llvm-cov/v0.8.7/src/cli.rs` line 1590: `clean.no_clean |= report.no_report | no_run`. The comment at lines 1589-1590 states that `--no-report` and `--no-run` imply `--no-clean`. `src/clean.rs` `clean_profraw_files` globs `target_dir/*.profraw` only (not recursive) and `clean_partial` returns immediately when `no_clean` is set, before that glob. `src/main.rs` `set_env` sets `LLVM_PROFILE_FILE` to `target_dir.join("{workspace}-%p-%m.profraw")` for a non-nextest run (`%p` pid, `%m` binary id). Local `cargo llvm-cov --version` is 0.8.7 (probe 1). `cargo llvm-cov clean --help` documents `--profraw-only`. The probe's local crate path `cargo-llvm-cov-0.8.7` was not on disk; these citations are the tag, not that path.
* `package.json` script `test:coverage:backend` is `node scripts/ensure-output-directory.mjs backend-coverage && node scripts/rust-branch-coverage.mjs`. `coverage:backend:check` reads `backend-coverage/lcov.info`. `ensure-output-directory.mjs` creates `backend-coverage/` and does not clear `llvm-cov-target`.
* `scripts/gate-receipt.mjs` records `backend-coverage` as `pnpm test:coverage:backend && pnpm coverage:backend:check`. A green receipt can skip the script while ignored `.profraw` files remain. Those files affect only a run that executes the script.
* `scripts/run-push-gates.mjs` selects the `rust-coverage` lane (`pnpm gate:ensure backend-coverage`) from the `--rust` flag, not from changed paths. `hasCoverageInputsChanged` keys off `src-tauri/src`, `backend-coverage-areas.json`, and `backend-coverage-baselines.json`. A scripts-only diff does not select the lane. `pnpm gates:push` without `--rust` does not run it.
* `.github/workflows/test.yml` restores `src-tauri -> target` with Swatinem/rust-cache and then runs `pnpm test:coverage:backend` and `pnpm coverage:backend:check`. Whether that cache restores `.profraw` files was not proven. Delete-before still removes them if it does. The cache key is not this change.
* `scripts/coverage-report.mjs` carries the staged-failure matrix pattern: the header enumerates paths, and `scripts/coverage-report-tests.mjs` calls exported functions directly. The header states that an exported-function call is a real caller. `pnpm coverage:report:test` runs `node --test scripts/coverage-report-tests.mjs`. That file is the only importer of `rust-branch-coverage.mjs` (probe 2).
* Probe 2: `rust-branch-coverage.mjs` has no header matrix. Explicit throw sites without a staged row are at the `run` helper, the metadata refusal, the export crash and export-status throws, the empty-profile throw, the missing-executable throw, the empty-source throw, the empty-export throw, and the no-branch-data throw. Only the metadata refusal and the per-source crash diagnostic have direct unit assertions today. Inherited throws are not evidence for this change.
* `d-20260922-08`: `scopeSignature` guards what is measured. Deleting profiles changes hit counts, not the signature.
* `d-20260928-01`: test-only exclusion stays in the gate. The exporter's LCOV stays raw compiler output. `d-20260902-02` is superseded on that point.
* `d-20260930-01`: `rust-test` and `rust-coverage` stay concurrent and use different target directories (`llvm-cov-target` versus the default). No Cargo `config.toml` target-dir override was found.
* Push skill Skip catalog: do not rebaseline coverage to clear a ratchet. f-20261002-10 is already handled by type-erasing the validator. f-20260829-01 was a missing recursive-delete test, and its closing note says that root does not survive for the backend half. This finding is stale input under the same root name, not that defect.

## Approach

### Clear before the instrumented run

Quotes the MANDATE: "clear `.profraw` files under `coverageTarget` before the run".

Before `cargo llvm-cov`, remove every regular-file `.profraw` the merger would see.

* The walk is the same `filesBelow` walk the merger uses, so a nested regular file is removed and a symlink is not followed.
* `ENOENT` from that walk means the directory is absent. Clearing returns. A first run must succeed.
* Any other walk error propagates unchanged. It does not start Cargo.
* Each returned path is removed. The first removal error propagates unchanged, with the filesystem error's own message. Nothing is swallowed. Non-`.profraw` files and the directory itself stay, so incremental build artefacts under `llvm-cov-target` stay.
* This step does not call `cargo llvm-cov clean`.

The production path is one exported orchestration function that `main` calls and that tests call with scratch directories and a fake command runner. `main` passes no arguments; the defaults are today's paths and today's runners. There is no production environment variable. The phase names the exports. Private branch structure inside the function stays with the executor.

Verification level: a temporary directory. Plant a nested `.profraw`, a non-`.profraw` sibling, and, where creating a symlink succeeds, a symlink to a directory that contains a `.profraw`. After the clear, the nested profile is gone, the sibling remains, and the profile behind the symlink remains. A missing directory resolves. `CR-1` covers the platform where creating the symlink is refused.

### Refuse if any raw profile survives

Quotes the MANDATE: "and fail if any survive".

Immediately after the clear, and before `cargo llvm-cov`, walk again. A non-empty result throws `new Error("Rust coverage left stale raw profiles: " + paths)`. `paths` is the absolute paths sorted lexicographically and joined with `", "`. The message is distinct from `Rust coverage produced no raw profiles`. `ENOENT` on this walk returns. Any other walk error propagates. The throw does not delete and does not start Cargo.

Verification level: the survivor proof calls only `runBranchCoverage`. Its `listProfiles` option, which defaults to the `filesBelow` walk, returns no profiles on the clear's walk and one absolute path on the next walk. The call rejects with a message that starts with `Rust coverage left stale raw profiles:` and contains that path, and the fake runner is not asked to run `cargo`. Removing the refusal walk from `runBranchCoverage` turns this test red. A direct call to the refusal export may stage that function's own row; it does not satisfy this proof. A second test plants profiles, uses the default walk so the clear removes them, and asserts the runner's `cargo` `llvm-cov` invocation happens only after the directory has no `.profraw`. A test reads `scripts/rust-branch-coverage.mjs` and fails if `main` does not call `runBranchCoverage`.

### Staged-failure matrix for this evidence script

Quotes the MANDATE: "plus the staged-failure matrix row for the new refusal (push-review-policy §2, the script is read as evidence)".

`push-review-policy.md` §2, the section the finding names, says the run that changes an evidence artefact owns its matrix, and an inherited gap in the same area is built in this run rather than left as a licence. This change edits `scripts/rust-branch-coverage.mjs`, and `pnpm coverage:backend:check` reads that run's result as evidence. The header matrix follows `scripts/coverage-report.mjs`: every failure path, the distinguishing message, and staged or argued.

* One row is the survivor refusal, message `Rust coverage left stale raw profiles:`, staged by the scratch-directory call above. The recorded status for that staged call is a rejected promise. The header states that `main`'s CLI exit, when this throw escapes the top-level `await`, is Node's exit 1.
* Removal and walk failures that this change adds (the clear's removal error, and a walk error other than the handled `ENOENT`) are staged on a scratch directory. A mode that makes removal fail, and a directory that cannot be read, are enough. Their messages are the filesystem errors Node raises. They get their own rows because those messages are not the survivor message.
* Every other failure path in the file after the edit is staged too, through the exported orchestration and the helpers it already exports (`coverageTools`, `exportLcovOrDiagnose`), using scratch directories and a fake runner. Probe 2's list is the starting enumeration, not the matrix: the executor re-reads the edited file and accounts for each path. Paths that already have a direct assertion are staged rows, not gaps.
* Tool resolution stays before any profile deletion. One staged spawn of the entrypoint uses a scratch `PATH` on which `rustup` cannot run. It records the tool-resolution message and exit status 1, and it does not delete profiles or start Cargo. A spawn that would reach the clear or Cargo is not staged: the entrypoint binds the real `coverageTarget`, and that run would delete live profiles or start Cargo. The header argues those spawns for that reason. The survivor refusal's process exit is the same uncaught rejection, described from the orchestration test, not from a second spawn.

### Proof the adopting session runs

The phase proof is two commands, in this order:

1. `pnpm coverage:report:test`
2. `pnpm gate:ensure backend-coverage`

Command 2 is required even though a scripts-only diff does not select `rust-coverage` and `pnpm gates:push` without `--rust` skips it. The planner does not start either command. The adopting session also runs `pnpm checks:pre-review` before cumulative diff review, because the push skill's pre-review block formats and lints these `.mjs` files. That block does not replace command 2.

No browser check. The change is not a rendered surface.

## Decisions and trade-offs

Chosen mechanism: clear, then refuse. Rejected: merge only profiles whose `%m` matches the binary just built. A cold run can emit a build-script profile with a different `%m` in the same invocation (cargo-llvm-cov 0.8.7 `set_env`), and a stale file whose `%m` still matches the current test binary is exactly the inflation the finding measured. A filter would drop the fresh extra profile and keep the stale one.

Rejected: `cargo llvm-cov clean --profraw-only` as the only clear. Its glob is `target_dir/*.profraw`. The merger is recursive. Nested profiles would survive and be merged.

Rejected: dropping `--no-report` so cargo-llvm-cov's automatic clean runs. That path also runs `clean_partial`, which cargo-cleans the measured crates, and it generates cargo-llvm-cov's own report. This repository exports LCOV itself because `--branch` segfaults (llvm/llvm-project#119558), which the script already handles. `--no-report` stays.

Rejected: a new lock around the coverage target. `d-20260930-01` already separates `rust-test` onto another target directory. A second writer of `llvm-cov-target` after the assert is the known limit below, not a new mechanism.

## Risks / open questions

Known limit, named here, not a new lock: a second process that writes a `.profraw` under `coverageTarget` after the survivor check returns can still be merged. The pre-change script has the same window, with no preceding clear. No Cargo target-dir override puts `rust-test` on `llvm-cov-target`.

No open product question. The mechanism is the technical choice recorded under `## Decided autonomously`.

## Not part of this task

* `backend-coverage-baselines.json`, `minimumCoverage` in `backend-coverage-areas.json`, and any re-record of `scopeSignature`.
* Receipt invalidation in `scripts/gate-receipt.mjs`. A skipped run does not merge stale profiles.
* The GitHub Actions rust-cache key and `scripts/run-push-gates.mjs` lane selection.
* f-20261002-10 (handled) and f-20261002-08.
* `docs/coverage.md`, unless a sentence there claims the profile directory is already cleared. It does not, as read in locate.
* A lock, a watcher, or a production environment variable for the profile directory.

## Phases

One phase. Area: gate-scripts. No auth, persistence, concurrency control, or API contract. Executor: Codex write, role `normal` (these paths are not in the push skill's sensitive globs).

Files: `scripts/rust-branch-coverage.mjs`, `scripts/coverage-report-tests.mjs`. Read `scripts/files-below.mjs` and `scripts/coverage-report.mjs`. Do not edit them.

Implements Clear before the instrumented run, Refuse if any raw profile survives, and Staged-failure matrix for this evidence script.

Spelling this phase uses, so the tests and the header name one thing:

* `clearStaleRawProfiles(directory)` removes the regular-file profiles.
* `assertNoStaleRawProfiles(directory)` throws the survivor message.
* `runBranchCoverage(options)` resolves the coverage tools, then performs the clear, the assert, then the existing Cargo, merge, and export steps. Omitted options are today's paths, the current `run` / `attempt` runners, and the `filesBelow` walk (`listProfiles`). `main` is the no-argument call.

Removal is `unlink` of each path the walk returned. Do not follow symlinks. Do not add an environment variable.

PROOF:

```bash
pnpm coverage:report:test
pnpm gate:ensure backend-coverage
```

The planner does not run these. The adopting session runs both, and runs `pnpm checks:pre-review` before cumulative diff review.

## Decided autonomously

Questioning is skipped because the launch says `full auto`. The adopting session records each entry with `./scripts/findings.py record-decision`. The planner does not.

### Which profiles count as this run?

* **Question:** Clear `.profraw` files under `coverageTarget` before the run and fail if any survive, or merge only the profiles whose binary signature matches the binary just built?
* **Chosen:** Clear every regular-file `.profraw` that `filesBelow(coverageTarget)` would return, then throw `Rust coverage left stale raw profiles:` if any remain, before `cargo llvm-cov`. A missing directory is success. Symlinks are not followed.
* **Rejected:** A `%m` filter. `cargo llvm-cov clean --profraw-only` as the only clear. Dropping `--no-report`.
* **Reason:** cargo-llvm-cov 0.8.7 sets `no_clean` when `--no-report` is passed, and its own profraw clean is a non-recursive glob while this script merges recursively. A binary-id filter drops a fresh build-script profile from the same invocation and keeps a stale file whose `%m` still matches the current test binary. Reversal path: replace the clear with a filter that keeps every profile written by this invocation, including a different `%m`, and still drops a stale file with the current `%m`.

### What does the matrix cover?

* **Question:** Stage only the new survivor refusal, or every failure path of `rust-branch-coverage.mjs`?
* **Chosen:** The whole matrix. The survivor refusal, the new removal and walk failures, and every other path in the edited file are staged through the exports against scratch inputs. Spawning the entrypoint is argued because it binds the live coverage tree.
* **Rejected:** Listing pre-existing throws as inherited and not staging them. Round 1's first draft chose that, and it does not survive `push-review-policy.md` §2's rule that the run which changes an evidence artefact builds the matrix in this run. The finding cites that section.
* **Reason:** `pnpm coverage:backend:check` reads this script's result as evidence. A header that names unstaged paths does not make those paths evidence. Reversal path: a later decision that the gate stops treating this script's exit as evidence.

### Does the adopting session run the coverage gate when path selection would skip it?

* **Question:** Is `pnpm coverage:report:test` enough proof, given `gates:push` will not select `backend-coverage` from a scripts-only diff?
* **Chosen:** The phase proof is `pnpm coverage:report:test` and then `pnpm gate:ensure backend-coverage`.
* **Rejected:** Relying on path selection or on `pnpm gates:push` without `--rust`.
* **Reason:** The artefact is the gate. The unit test does not execute `main` or Cargo. Reversal path: teach lane selection to notice this script, which is a different change and is not this mandate.

## Carried to diff review

* CR-1 — Symlink fixture on a platform that refuses `symlink` with `EPERM`. The non-follow assertion runs where creating a symlink in a temporary directory succeeds. On `EPERM`, skip only that assertion; the nested-profile and sibling-file assertions still run. Do not add a Windows or macOS CI job. The contract gate that runs `pnpm coverage:report:test` is the Ubuntu `test` job (`.github/workflows/test.yml`).

### plan-r4.md

# Plan: Clear stale Rust coverage profiles before the instrumented run

Finding: f-20261002-09. Area: gate-scripts. Root: machine-dependent-measurement. Entry stays `build` after revalidation: the open question is which profiles count as this run, and the script is read as evidence, so the new refusal is part of the change. The planner does not annotate the ledger. The adopting session records the decision under `## Decided autonomously`.

Plan path: `tasks/plans/2026-10-02-stale-profraw.md`.

## Goal

`pnpm test:coverage:backend` merges only `.profraw` files produced by the run that just finished. Profiles left under `src-tauri/target/llvm-cov-target` by an earlier run are removed before `cargo llvm-cov` starts. If any regular-file `.profraw` the merger would see is still there after that removal, the script throws and does not start Cargo. The script's failure paths, including the new refusal, are staged in this run. Baselines, floors, receipt invalidation, and the CI cache key stay as they are.

## MANDATE

Verbatim from `tasks/findings.md`, f-20261002-09. Fixed across every round.

* **ID:** f-20261002-09 · **Status:** open · **Area:** gate-scripts · **Root:** machine-dependent-measurement · **Entry:** build · **Blocked:** none
* **Where:** `scripts/rust-branch-coverage.mjs` (`coverageTarget = src-tauri/target/llvm-cov-target`; after `cargo +nightly llvm-cov … --no-report` it merges `filesBelow(coverageTarget, path.endsWith(".profraw"))` with `llvm-profdata merge -sparse`), used by `pnpm test:coverage:backend` and the receipt-backed `backend-coverage` gate.
* **Defect:** nothing removes profiles from earlier runs. On atlas on 2026-10-02 the directory held 1 517 `.profraw` files with binary signatures dating back to 2026-08-29. Every unchanged function (same name and structural hash) accumulates counts from all of them, so code that the current tests no longer execute stays "covered". Measured: on tree `04f43c1b` the local `pnpm coverage:backend:check` passed while CI (fresh checkout) failed `filesystem-native-boundaries functions regressed: 359/673, baseline 340/634`; the 8 records covered locally but not on CI were all one instance chain that the current test never runs. After deleting every `.profraw` below `llvm-cov-target` and rerunning, the local result reproduced CI exactly (359/673, red).
* **Why it matters:** the backend ratchet's local green — the push gate — can be inflated by history and disagree with CI, which is the next reader's first suspicion of "machine dependence" (`CLAUDE.md`, `f-20260829-01`) when it is in fact stale input. A push can pass every local gate and turn CI red.
* **Open question:** clear `.profraw` files under `coverageTarget` before the run (and fail if any survive), or merge only the profiles whose binary signature matches the binary just built; plus the staged-failure matrix row for the new refusal (push-review-policy §2, the script is read as evidence).
* **Found by:** Stockfish 19 upgrade build, CI red after push, 2026-10-02 (orchestrator measurement above).

## Threat model and non-goals

Frozen with the MANDATE.

Accidental input is the real case: a developer or a previous local gate leaves `.profraw` files under `coverageTarget`, including files in subdirectories and files whose `%m` binary id still matches the current test binary. The script must not treat those counts as this run. CI's fresh checkout is the environment that already fails closed; this change makes the local gate fail the same way.

A second coverage process that creates a `.profraw` after the emptiness check is a named known limit under Risks. It is the same hazard the pre-change merger already has, and `d-20260930-01` already runs `rust-test` on a different target directory. This plan adds no lock.

Adversarial input (a process that replaces profiles between the check and the merge, or a symlink farm) is out of scope. The clear uses the same directory walk the merger already uses.

Non-goals: changing what the compiler emits, which sources are exported, the numeric baselines, the area floors, receipt invalidation, the GitHub Actions cache key, or the type-erasure already landed for f-20261002-10.

## Traced premises

Locate citations. Obligations below do not repeat line numbers.

* `scripts/rust-branch-coverage.mjs` sets `coverageTarget` to `src-tauri/target/llvm-cov-target` and, in `main`, runs `cargo +<toolchain> llvm-cov --manifest-path <src-tauri/Cargo.toml> --bin chessfable --locked --branch --no-report` before any profile walk. It then merges every path `filesBelow(coverageTarget, path.endsWith(".profraw"))` returns. An empty list throws `Rust coverage produced no raw profiles`. `main` is not exported. The module runs `main` only when `isEntrypoint` matches, so a test can import the module without starting Cargo.
* `scripts/files-below.mjs` recurses only when `entry.isDirectory()` and returns a path only when `entry.isFile()` and the predicate matches. Symlinks are neither, so they are not followed and a symlink whose name ends in `.profraw` is not returned.
* Probe 1 on this worktree: `coverageTarget` was absent (`PROFILE_DIRECTORY_ABSENT`). `filesBelow` on a missing directory rejects with the `readdir` error. A first run must not fail because the directory does not exist yet.
* Orchestrator measurement, cargo-llvm-cov tag v0.8.7, fetched 2026-10-02 from `https://raw.githubusercontent.com/taiki-e/cargo-llvm-cov/v0.8.7/src/cli.rs` line 1590: `clean.no_clean |= report.no_report | no_run`. The comment at lines 1589-1590 states that `--no-report` and `--no-run` imply `--no-clean`. `src/clean.rs` `clean_profraw_files` globs `target_dir/*.profraw` only (not recursive) and `clean_partial` returns immediately when `no_clean` is set, before that glob. `src/main.rs` `set_env` sets `LLVM_PROFILE_FILE` to `target_dir.join("{workspace}-%p-%m.profraw")` for a non-nextest run (`%p` pid, `%m` binary id). Local `cargo llvm-cov --version` is 0.8.7 (probe 1). `cargo llvm-cov clean --help` documents `--profraw-only`. The probe's local crate path `cargo-llvm-cov-0.8.7` was not on disk; these citations are the tag, not that path.
* `package.json` script `test:coverage:backend` is `node scripts/ensure-output-directory.mjs backend-coverage && node scripts/rust-branch-coverage.mjs`. `coverage:backend:check` reads `backend-coverage/lcov.info`. `ensure-output-directory.mjs` creates `backend-coverage/` and does not clear `llvm-cov-target`.
* `scripts/gate-receipt.mjs` records `backend-coverage` as `pnpm test:coverage:backend && pnpm coverage:backend:check`. A green receipt can skip the script while ignored `.profraw` files remain. Those files affect only a run that executes the script.
* `scripts/run-push-gates.mjs` selects the `rust-coverage` lane (`pnpm gate:ensure backend-coverage`) from the `--rust` flag, not from changed paths. `hasCoverageInputsChanged` keys off `src-tauri/src`, `backend-coverage-areas.json`, and `backend-coverage-baselines.json`. A scripts-only diff does not select the lane. `pnpm gates:push` without `--rust` does not run it.
* `.github/workflows/test.yml` restores `src-tauri -> target` with Swatinem/rust-cache and then runs `pnpm test:coverage:backend` and `pnpm coverage:backend:check`. Whether that cache restores `.profraw` files was not proven. Delete-before still removes them if it does. The cache key is not this change.
* `scripts/coverage-report.mjs` carries the staged-failure matrix pattern: the header enumerates paths, and `scripts/coverage-report-tests.mjs` calls exported functions directly. The header states that an exported-function call is a real caller. `pnpm coverage:report:test` runs `node --test scripts/coverage-report-tests.mjs`. That file is the only importer of `rust-branch-coverage.mjs` (probe 2).
* Probe 2: `rust-branch-coverage.mjs` has no header matrix. Explicit throw sites without a staged row are at the `run` helper, the metadata refusal, the export crash and export-status throws, the empty-profile throw, the missing-executable throw, the empty-source throw, the empty-export throw, and the no-branch-data throw. Only the metadata refusal and the per-source crash diagnostic have direct unit assertions today. Inherited throws are not evidence for this change.
* `d-20260922-08`: `scopeSignature` guards what is measured. Deleting profiles changes hit counts, not the signature.
* `d-20260928-01`: test-only exclusion stays in the gate. The exporter's LCOV stays raw compiler output. `d-20260902-02` is superseded on that point.
* `d-20260930-01`: `rust-test` and `rust-coverage` stay concurrent and use different target directories (`llvm-cov-target` versus the default). No Cargo `config.toml` target-dir override was found.
* Push skill Skip catalog: do not rebaseline coverage to clear a ratchet. f-20261002-10 is already handled by type-erasing the validator. f-20260829-01 was a missing recursive-delete test, and its closing note says that root does not survive for the backend half. This finding is stale input under the same root name, not that defect.

## Approach

### Clear before the instrumented run

Quotes the MANDATE: "clear `.profraw` files under `coverageTarget` before the run".

Before `cargo llvm-cov`, remove every regular-file `.profraw` the merger would see.

* The walk is the same `filesBelow` walk the merger uses, so a nested regular file is removed and a symlink is not followed.
* `ENOENT` from that walk means the directory is absent. Clearing returns. A first run must succeed.
* Any other walk error propagates unchanged. It does not start Cargo.
* Each returned path is removed. The first removal error propagates unchanged, with the filesystem error's own message. Nothing is swallowed. Non-`.profraw` files and the directory itself stay, so incremental build artefacts under `llvm-cov-target` stay.
* This step does not call `cargo llvm-cov clean`.

The production path is one exported orchestration function that `main` calls and that tests call with scratch directories and a fake command runner. `main` passes no arguments; the defaults are today's paths and today's runners. There is no production environment variable. The phase names the exports. Private branch structure inside the function stays with the executor.

Verification level: a temporary directory. Plant a nested `.profraw`, a non-`.profraw` sibling, and, where creating a symlink succeeds, a symlink to a directory that contains a `.profraw`. After the clear, the nested profile is gone, the sibling remains, and the profile behind the symlink remains. A missing directory resolves. `CR-1` covers the platform where creating the symlink is refused.

### Refuse if any raw profile survives

Quotes the MANDATE: "and fail if any survive".

Immediately after the clear, and before `cargo llvm-cov`, walk again. A non-empty result throws `new Error("Rust coverage left stale raw profiles: " + paths)`. `paths` is the absolute paths sorted lexicographically and joined with `", "`. The message is distinct from `Rust coverage produced no raw profiles`. `ENOENT` on this walk returns. Any other walk error propagates. The throw does not delete and does not start Cargo.

Verification level: the survivor proof calls only `runBranchCoverage`. Its `listProfiles` option, which defaults to the `filesBelow` walk, returns no profiles on the clear's walk and one absolute path on the next walk. The call rejects with a message that starts with `Rust coverage left stale raw profiles:` and contains that path, and the fake runner is not asked to run `cargo`. Removing the refusal walk from `runBranchCoverage` turns this test red. A direct call to the refusal export may stage that function's own row; it does not satisfy this proof. A second test plants profiles, uses the default walk so the clear removes them, and asserts the runner's `cargo` `llvm-cov` invocation happens only after the directory has no `.profraw`. A test reads `scripts/rust-branch-coverage.mjs` and fails if `main` does not call `runBranchCoverage`.

### Staged-failure matrix for this evidence script

Quotes the MANDATE: "plus the staged-failure matrix row for the new refusal (push-review-policy §2, the script is read as evidence)".

`push-review-policy.md` §2, the section the finding names, says the run that changes an evidence artefact owns its matrix, and an inherited gap in the same area is built in this run rather than left as a licence. This change edits `scripts/rust-branch-coverage.mjs`, and `pnpm coverage:backend:check` reads that run's result as evidence. The header matrix follows `scripts/coverage-report.mjs`: every failure path, the distinguishing message, and staged or argued.

* One row is the survivor refusal, message `Rust coverage left stale raw profiles:`, staged by the scratch-directory call above. The recorded status for that staged call is a rejected promise. The header states that `main`'s CLI exit, when this throw escapes the top-level `await`, is Node's exit 1.
* Removal and walk failures that this change adds (the clear's removal error, and a walk error other than the handled `ENOENT`) are staged on a scratch directory. A mode that makes removal fail, and a directory that cannot be read, are enough. Their messages are the filesystem errors Node raises. They get their own rows because those messages are not the survivor message.
* Every other failure path in the file after the edit is staged too, through the exported orchestration and the helpers it already exports (`coverageTools`, `exportLcovOrDiagnose`), using scratch directories and a fake runner. Probe 2's list is the starting enumeration, not the matrix: the executor re-reads the edited file and accounts for each path. Paths that already have a direct assertion are staged rows, not gaps.
* Tool resolution stays before any profile deletion. One staged spawn of the entrypoint uses a scratch `PATH` on which `rustup` cannot run. Before the spawn, the test plants one `.profraw` under `coverageTarget` (creating that directory if it is absent) and records the set of `.profraw` paths. The spawn records the tool-resolution message and exit status 1. The set of `.profraw` paths is unchanged, which fails if the clear ran. The test then deletes only the file it planted. A spawn that would reach the clear or Cargo is not staged: past tool resolution the entrypoint binds the real `coverageTarget` and would delete live profiles or start Cargo. The header argues those spawns for that reason. The survivor refusal's process exit is the same uncaught rejection, described from the orchestration test, not from a second spawn.

### Proof the adopting session runs

The phase proof is two commands, in this order:

1. `pnpm coverage:report:test`
2. `pnpm gate:ensure backend-coverage`

Command 2 is required even though a scripts-only diff does not select `rust-coverage` and `pnpm gates:push` without `--rust` skips it. The planner does not start either command. The adopting session also runs `pnpm checks:pre-review` before cumulative diff review, because the push skill's pre-review block formats and lints these `.mjs` files. That block does not replace command 2.

No browser check. The change is not a rendered surface.

## Decisions and trade-offs

Chosen mechanism: clear, then refuse. Rejected: merge only profiles whose `%m` matches the binary just built. A cold run can emit a build-script profile with a different `%m` in the same invocation (cargo-llvm-cov 0.8.7 `set_env`), and a stale file whose `%m` still matches the current test binary is exactly the inflation the finding measured. A filter would drop the fresh extra profile and keep the stale one.

Rejected: `cargo llvm-cov clean --profraw-only` as the only clear. Its glob is `target_dir/*.profraw`. The merger is recursive. Nested profiles would survive and be merged.

Rejected: dropping `--no-report` so cargo-llvm-cov's automatic clean runs. That path also runs `clean_partial`, which cargo-cleans the measured crates, and it generates cargo-llvm-cov's own report. This repository exports LCOV itself because `--branch` segfaults (llvm/llvm-project#119558), which the script already handles. `--no-report` stays.

Rejected: a new lock around the coverage target. `d-20260930-01` already separates `rust-test` onto another target directory. A second writer of `llvm-cov-target` after the assert is the known limit below, not a new mechanism.

## Risks / open questions

Known limit, named here, not a new lock: a second process that writes a `.profraw` under `coverageTarget` after the survivor check returns can still be merged. The pre-change script has the same window, with no preceding clear. No Cargo target-dir override puts `rust-test` on `llvm-cov-target`.

No open product question. The mechanism is the technical choice recorded under `## Decided autonomously`.

## Not part of this task

* `backend-coverage-baselines.json`, `minimumCoverage` in `backend-coverage-areas.json`, and any re-record of `scopeSignature`.
* Receipt invalidation in `scripts/gate-receipt.mjs`. A skipped run does not merge stale profiles.
* The GitHub Actions rust-cache key and `scripts/run-push-gates.mjs` lane selection.
* f-20261002-10 (handled) and f-20261002-08.
* `docs/coverage.md`, unless a sentence there claims the profile directory is already cleared. It does not, as read in locate.
* A lock, a watcher, or a production environment variable for the profile directory.

## Phases

One phase. Area: gate-scripts. No auth, persistence, concurrency control, or API contract. Executor: Codex write, role `normal` (these paths are not in the push skill's sensitive globs).

Files: `scripts/rust-branch-coverage.mjs`, `scripts/coverage-report-tests.mjs`. Read `scripts/files-below.mjs` and `scripts/coverage-report.mjs`. Do not edit them.

Implements Clear before the instrumented run, Refuse if any raw profile survives, and Staged-failure matrix for this evidence script.

Spelling this phase uses, so the tests and the header name one thing:

* `clearStaleRawProfiles(directory)` removes the regular-file profiles.
* `assertNoStaleRawProfiles(directory)` throws the survivor message.
* `runBranchCoverage(options)` resolves the coverage tools, then performs the clear, the assert, then the existing Cargo, merge, and export steps. Omitted options are today's paths, the current `run` / `attempt` runners, and the `filesBelow` walk (`listProfiles`). `main` is the no-argument call.

Removal is `unlink` of each path the walk returned. Do not follow symlinks. Do not add an environment variable.

PROOF:

```bash
pnpm coverage:report:test
pnpm gate:ensure backend-coverage
```

The planner does not run these. The adopting session runs both, and runs `pnpm checks:pre-review` before cumulative diff review.

## Decided autonomously

Questioning is skipped because the launch says `full auto`. The adopting session records each entry with `./scripts/findings.py record-decision`. The planner does not.

### Which profiles count as this run?

* **Question:** Clear `.profraw` files under `coverageTarget` before the run and fail if any survive, or merge only the profiles whose binary signature matches the binary just built?
* **Chosen:** Clear every regular-file `.profraw` that `filesBelow(coverageTarget)` would return, then throw `Rust coverage left stale raw profiles:` if any remain, before `cargo llvm-cov`. A missing directory is success. Symlinks are not followed.
* **Rejected:** A `%m` filter. `cargo llvm-cov clean --profraw-only` as the only clear. Dropping `--no-report`.
* **Reason:** cargo-llvm-cov 0.8.7 sets `no_clean` when `--no-report` is passed, and its own profraw clean is a non-recursive glob while this script merges recursively. A binary-id filter drops a fresh build-script profile from the same invocation and keeps a stale file whose `%m` still matches the current test binary. Reversal path: replace the clear with a filter that keeps every profile written by this invocation, including a different `%m`, and still drops a stale file with the current `%m`.

### What does the matrix cover?

* **Question:** Stage only the new survivor refusal, or every failure path of `rust-branch-coverage.mjs`?
* **Chosen:** The whole matrix. The survivor refusal, the new removal and walk failures, and every other path in the edited file are staged through the exports against scratch inputs. One pre-clear entrypoint spawn, the `rustup` failure, is staged after planting one `.profraw` and asserting that path set is unchanged. A spawn that reaches the clear or Cargo stays argued because it binds the live coverage tree.
* **Rejected:** Listing pre-existing throws as inherited and not staging them. Round 1's first draft chose that, and it does not survive `push-review-policy.md` §2's rule that the run which changes an evidence artefact builds the matrix in this run. The finding cites that section.
* **Reason:** `pnpm coverage:backend:check` reads this script's result as evidence. A header that names unstaged paths does not make those paths evidence. Reversal path: a later decision that the gate stops treating this script's exit as evidence.

### Does the adopting session run the coverage gate when path selection would skip it?

* **Question:** Is `pnpm coverage:report:test` enough proof, given `gates:push` will not select `backend-coverage` from a scripts-only diff?
* **Chosen:** The phase proof is `pnpm coverage:report:test` and then `pnpm gate:ensure backend-coverage`.
* **Rejected:** Relying on path selection or on `pnpm gates:push` without `--rust`.
* **Reason:** The artefact is the gate. The unit test does not execute `main` or Cargo. Reversal path: teach lane selection to notice this script, which is a different change and is not this mandate.

## Carried to diff review

* CR-1 — Symlink fixture on a platform that refuses `symlink` with `EPERM`. The non-follow assertion runs where creating a symlink in a temporary directory succeeds. On `EPERM`, skip only that assertion; the nested-profile and sibling-file assertions still run. Do not add a Windows or macOS CI job. The contract gate that runs `pnpm coverage:report:test` is the Ubuntu `test` job (`.github/workflows/test.yml`).

## Reviews

Append-only. Raw reports stay in the lens artefacts. This section is the lookup record.

Round 1 wall time is the leaf span recorded in `plan-meta.json`. 12 plan-capable lenses. Adopted P-1, P-2, P-3, P-4. Carried CR-1. No skips.

Round 2 closure: plan, tests, error-handling, minimalism, correctness. P-2, P-3, P-4 closed by their witnesses. P-1 not closed. Adopted the P-1 tightening and P-6.

Round 3 closure: plan, tests, error-handling, correctness. P-1 closed by plan and tests. P-6 not closed by tests. Adopted the planted-profile assertion and this record (P-7).

### P-1

* Claim: a direct call to the refusal helper stays green if `main` or the orchestration omits the clear and the refusal, and the coverage gate does not catch that omission.
* Witnesses: plan r1 finding 1 (blocker), tests r1 finding 1 (blocker), plan r2 finding 1 (blocker, NOT CLOSED), tests r2 finding 1 (blocker, NOT CLOSED).
* Disposition: Fix. Closed in round 3.
* Correction: the survivor proof calls only `runBranchCoverage`. `listProfiles` returns no profiles on the clear's walk and one path on the next walk. Removing the refusal walk makes the fake runner reach Cargo and the test fails.
* Evidence: `package.json` `coverage:backend:check` reads `lcov.info` only. Round 3 plan and tests both reported `P-1 CLOSED` on that sentence.
* Authority: MANDATE "before the run" and "fail if any survive". The proof has to go red when that production order is removed.
* Obligation: Refuse if any raw profile survives.

### P-2

* Claim: the approach prescribed helper signatures, `unlink`, and fixture steps that are executor choices.
* Witnesses: plan r1 finding 2 (should-fix).
* Disposition: Fix. Closed in round 2.
* Correction: the approach states behavior. The phase names `clearStaleRawProfiles`, `assertNoStaleRawProfiles`, `runBranchCoverage`, and `unlink`.
* Evidence: plan round 2 reported `P-2 CLOSED`.
* Obligation: Clear before the instrumented run.

### P-3

* Claim: a removal or walk error introduced by the clear is a new stageable path, not an inherited row.
* Witnesses: error-handling r1 finding 1 (should-fix), tests r1 finding 2 (should-fix, the new-path half).
* Disposition: Fix. Closed in round 2.
* Correction: scratch-directory rows for the removal failure and for a non-`ENOENT` walk failure, each with its own filesystem message.
* Evidence: error-handling and tests round 2 reported `P-3 CLOSED`.
* Authority: MANDATE cites push-review-policy §2. A path this change adds is stageable on a scratch directory.
* Obligation: Staged-failure matrix for this evidence script.

### P-4

* Claim: marking pre-existing throws inherited, without staging or an allowed argument, does not satisfy §2 for a script this change edits.
* Witnesses: tests r1 finding 2 (should-fix, the inherited-path half).
* Disposition: Fix. Closed in round 2.
* Correction: stage every remaining failure path through the exports. Argue only spawns that reach the clear or Cargo.
* Evidence: tests round 2 reported `P-4 CLOSED`. `push-review-policy.md` §2 fifth condition: the run that changes an evidence artefact builds the matrix in this run.
* Authority: the MANDATE's citation of push-review-policy §2, and that section's words "same area, build the matrix in this run".
* Obligation: Staged-failure matrix for this evidence script.

### P-5

* Claim: a symlink fixture can throw `EPERM` on Windows, and the proof command is not a Windows CI job.
* Witnesses: platform-semantics r1 finding 1 (should-fix).
* Disposition: Fix. `closed_round` carried, id CR-1.
* Correction: see `## Carried to diff review`. The Ubuntu contract gate is the runtime that runs this test. No new CI job.
* Evidence: `.github/workflows/test.yml` job `test` runs `pnpm gates:contract:check` on `ubuntu-latest`. The Windows and macOS jobs do not run `coverage-report-tests.mjs`.

### P-6

* Claim: the entrypoint's process exit can be staged for the tool-resolution failure without deleting profiles, because that failure happens before the clear.
* Witnesses: error-handling r2 finding 1 (should-fix). tests r3 finding 1 (should-fix, NOT CLOSED): a missing profile directory does not prove the clear did not run.
* Disposition: Fix. Open until the round that reviews the planted-file assertion.
* Correction: plant one `.profraw`, assert the path set is unchanged, delete only that file.
* Evidence: current `main` calls `coverageTools` before any profile walk (`scripts/rust-branch-coverage.mjs`). The round-3 text did not require a before/after set.
* Authority: push-review-policy §2, record the exit status of a stageable path. The planted file is restored by the test.
* Obligation: Staged-failure matrix for this evidence script.

### P-7

* Claim: the plan file had no `## Reviews` record for lenses to look up.
* Witnesses: plan r3 finding 1 (blocker).
* Disposition: Fix. Open until review-plan sees this section.
* Correction: this section.
* Obligation: the review record, not a product obligation.

### plan-r5.md

# Plan: Clear stale Rust coverage profiles before the instrumented run

Finding: f-20261002-09. Area: gate-scripts. Root: machine-dependent-measurement. Entry stays `build` after revalidation: the open question is which profiles count as this run, and the script is read as evidence, so the new refusal is part of the change. The planner does not annotate the ledger. The adopting session records the decision under `## Decided autonomously`.

Plan path: `tasks/plans/2026-10-02-stale-profraw.md`.

## Goal

`pnpm test:coverage:backend` merges only `.profraw` files produced by the run that just finished. Profiles left under `src-tauri/target/llvm-cov-target` by an earlier run are removed before `cargo llvm-cov` starts. If any regular-file `.profraw` the merger would see is still there after that removal, the script throws and does not start Cargo. The script's failure paths, including the new refusal, are staged in this run. Baselines, floors, receipt invalidation, and the CI cache key stay as they are.

## MANDATE

Verbatim from `tasks/findings.md`, f-20261002-09. Fixed across every round.

* **ID:** f-20261002-09 · **Status:** open · **Area:** gate-scripts · **Root:** machine-dependent-measurement · **Entry:** build · **Blocked:** none
* **Where:** `scripts/rust-branch-coverage.mjs` (`coverageTarget = src-tauri/target/llvm-cov-target`; after `cargo +nightly llvm-cov … --no-report` it merges `filesBelow(coverageTarget, path.endsWith(".profraw"))` with `llvm-profdata merge -sparse`), used by `pnpm test:coverage:backend` and the receipt-backed `backend-coverage` gate.
* **Defect:** nothing removes profiles from earlier runs. On atlas on 2026-10-02 the directory held 1 517 `.profraw` files with binary signatures dating back to 2026-08-29. Every unchanged function (same name and structural hash) accumulates counts from all of them, so code that the current tests no longer execute stays "covered". Measured: on tree `04f43c1b` the local `pnpm coverage:backend:check` passed while CI (fresh checkout) failed `filesystem-native-boundaries functions regressed: 359/673, baseline 340/634`; the 8 records covered locally but not on CI were all one instance chain that the current test never runs. After deleting every `.profraw` below `llvm-cov-target` and rerunning, the local result reproduced CI exactly (359/673, red).
* **Why it matters:** the backend ratchet's local green — the push gate — can be inflated by history and disagree with CI, which is the next reader's first suspicion of "machine dependence" (`CLAUDE.md`, `f-20260829-01`) when it is in fact stale input. A push can pass every local gate and turn CI red.
* **Open question:** clear `.profraw` files under `coverageTarget` before the run (and fail if any survive), or merge only the profiles whose binary signature matches the binary just built; plus the staged-failure matrix row for the new refusal (push-review-policy §2, the script is read as evidence).
* **Found by:** Stockfish 19 upgrade build, CI red after push, 2026-10-02 (orchestrator measurement above).

## Threat model and non-goals

Frozen with the MANDATE.

Accidental input is the real case: a developer or a previous local gate leaves `.profraw` files under `coverageTarget`, including files in subdirectories and files whose `%m` binary id still matches the current test binary. The script must not treat those counts as this run. CI's fresh checkout is the environment that already fails closed; this change makes the local gate fail the same way.

A second coverage process that creates a `.profraw` after the emptiness check is a named known limit under Risks. It is the same hazard the pre-change merger already has, and `d-20260930-01` already runs `rust-test` on a different target directory. This plan adds no lock.

Adversarial input (a process that replaces profiles between the check and the merge, or a symlink farm) is out of scope. The clear uses the same directory walk the merger already uses.

Non-goals: changing what the compiler emits, which sources are exported, the numeric baselines, the area floors, receipt invalidation, the GitHub Actions cache key, or the type-erasure already landed for f-20261002-10.

## Traced premises

Locate citations. Obligations below do not repeat line numbers.

* `scripts/rust-branch-coverage.mjs` sets `coverageTarget` to `src-tauri/target/llvm-cov-target` and, in `main`, runs `cargo +<toolchain> llvm-cov --manifest-path <src-tauri/Cargo.toml> --bin chessfable --locked --branch --no-report` before any profile walk. It then merges every path `filesBelow(coverageTarget, path.endsWith(".profraw"))` returns. An empty list throws `Rust coverage produced no raw profiles`. `main` is not exported. The module runs `main` only when `isEntrypoint` matches, so a test can import the module without starting Cargo.
* `scripts/files-below.mjs` recurses only when `entry.isDirectory()` and returns a path only when `entry.isFile()` and the predicate matches. Symlinks are neither, so they are not followed and a symlink whose name ends in `.profraw` is not returned.
* Probe 1 on this worktree: `coverageTarget` was absent (`PROFILE_DIRECTORY_ABSENT`). `filesBelow` on a missing directory rejects with the `readdir` error. A first run must not fail because the directory does not exist yet.
* Orchestrator measurement, cargo-llvm-cov tag v0.8.7, fetched 2026-10-02 from `https://raw.githubusercontent.com/taiki-e/cargo-llvm-cov/v0.8.7/src/cli.rs` line 1590: `clean.no_clean |= report.no_report | no_run`. The comment at lines 1589-1590 states that `--no-report` and `--no-run` imply `--no-clean`. `src/clean.rs` `clean_profraw_files` globs `target_dir/*.profraw` only (not recursive) and `clean_partial` returns immediately when `no_clean` is set, before that glob. `src/main.rs` `set_env` sets `LLVM_PROFILE_FILE` to `target_dir.join("{workspace}-%p-%m.profraw")` for a non-nextest run (`%p` pid, `%m` binary id). Local `cargo llvm-cov --version` is 0.8.7 (probe 1). `cargo llvm-cov clean --help` documents `--profraw-only`. The probe's local crate path `cargo-llvm-cov-0.8.7` was not on disk; these citations are the tag, not that path.
* `package.json` script `test:coverage:backend` is `node scripts/ensure-output-directory.mjs backend-coverage && node scripts/rust-branch-coverage.mjs`. `coverage:backend:check` reads `backend-coverage/lcov.info`. `ensure-output-directory.mjs` creates `backend-coverage/` and does not clear `llvm-cov-target`.
* `scripts/gate-receipt.mjs` records `backend-coverage` as `pnpm test:coverage:backend && pnpm coverage:backend:check`. A green receipt can skip the script while ignored `.profraw` files remain. Those files affect only a run that executes the script.
* `scripts/run-push-gates.mjs` selects the `rust-coverage` lane (`pnpm gate:ensure backend-coverage`) from the `--rust` flag, not from changed paths. `hasCoverageInputsChanged` keys off `src-tauri/src`, `backend-coverage-areas.json`, and `backend-coverage-baselines.json`. A scripts-only diff does not select the lane. `pnpm gates:push` without `--rust` does not run it.
* `.github/workflows/test.yml` restores `src-tauri -> target` with Swatinem/rust-cache and then runs `pnpm test:coverage:backend` and `pnpm coverage:backend:check`. Whether that cache restores `.profraw` files was not proven. Delete-before still removes them if it does. The cache key is not this change.
* `scripts/coverage-report.mjs` carries the staged-failure matrix pattern: the header enumerates paths, and `scripts/coverage-report-tests.mjs` calls exported functions directly. The header states that an exported-function call is a real caller. `pnpm coverage:report:test` runs `node --test scripts/coverage-report-tests.mjs`. That file is the only importer of `rust-branch-coverage.mjs` (probe 2).
* Probe 2: `rust-branch-coverage.mjs` has no header matrix. Explicit throw sites without a staged row are at the `run` helper, the metadata refusal, the export crash and export-status throws, the empty-profile throw, the missing-executable throw, the empty-source throw, the empty-export throw, and the no-branch-data throw. Only the metadata refusal and the per-source crash diagnostic have direct unit assertions today. Inherited throws are not evidence for this change.
* `d-20260922-08`: `scopeSignature` guards what is measured. Deleting profiles changes hit counts, not the signature.
* `d-20260928-01`: test-only exclusion stays in the gate. The exporter's LCOV stays raw compiler output. `d-20260902-02` is superseded on that point.
* `d-20260930-01`: `rust-test` and `rust-coverage` stay concurrent and use different target directories (`llvm-cov-target` versus the default). No Cargo `config.toml` target-dir override was found.
* Push skill Skip catalog: do not rebaseline coverage to clear a ratchet. f-20261002-10 is already handled by type-erasing the validator. f-20260829-01 was a missing recursive-delete test, and its closing note says that root does not survive for the backend half. This finding is stale input under the same root name, not that defect.

## Approach

### Clear before the instrumented run

Quotes the MANDATE: "clear `.profraw` files under `coverageTarget` before the run".

Before `cargo llvm-cov`, remove every regular-file `.profraw` the merger would see.

* The walk is the same `filesBelow` walk the merger uses, so a nested regular file is removed and a symlink is not followed.
* `ENOENT` from that walk means the directory is absent. Clearing returns. A first run must succeed.
* Any other walk error propagates unchanged. It does not start Cargo.
* Each returned path is removed. The first removal error propagates unchanged, with the filesystem error's own message. Nothing is swallowed. Non-`.profraw` files and the directory itself stay, so incremental build artefacts under `llvm-cov-target` stay.
* This step does not call `cargo llvm-cov clean`.

The production path is one exported orchestration function that `main` calls and that tests call with scratch directories and a fake command runner. `main` passes no arguments; the defaults are today's paths and today's runners. There is no production environment variable. The phase names the exports. Private branch structure inside the function stays with the executor.

Verification level: a temporary directory. Plant a nested `.profraw`, a non-`.profraw` sibling, and, where creating a symlink succeeds, a symlink to a directory that contains a `.profraw`. After the clear, the nested profile is gone, the sibling remains, and the profile behind the symlink remains. A missing directory resolves. `CR-1` covers the platform where creating the symlink is refused.

### Refuse if any raw profile survives

Quotes the MANDATE: "and fail if any survive".

Immediately after the clear, and before `cargo llvm-cov`, walk again. A non-empty result throws `new Error("Rust coverage left stale raw profiles: " + paths)`. `paths` is the absolute paths sorted lexicographically and joined with `", "`. The message is distinct from `Rust coverage produced no raw profiles`. `ENOENT` on this walk returns. Any other walk error propagates. The throw does not delete and does not start Cargo.

Verification level: the survivor proof calls only `runBranchCoverage`. Its `listProfiles` option, which defaults to the `filesBelow` walk, returns no profiles on the clear's walk and one absolute path on the next walk. The call rejects with a message that starts with `Rust coverage left stale raw profiles:` and contains that path, and the fake runner is not asked to run `cargo`. Removing the refusal walk from `runBranchCoverage` turns this test red. A direct call to the refusal export may stage that function's own row; it does not satisfy this proof. A second test plants profiles, uses the default walk so the clear removes them, and asserts the runner's `cargo` `llvm-cov` invocation happens only after the directory has no `.profraw`. A test reads `scripts/rust-branch-coverage.mjs` and fails if `main` does not call `runBranchCoverage`.

### Staged-failure matrix for this evidence script

Quotes the MANDATE: "plus the staged-failure matrix row for the new refusal (push-review-policy §2, the script is read as evidence)".

`push-review-policy.md` §2, the section the finding names, says the run that changes an evidence artefact owns its matrix, and an inherited gap in the same area is built in this run rather than left as a licence. This change edits `scripts/rust-branch-coverage.mjs`, and `pnpm coverage:backend:check` reads that run's result as evidence. The header matrix follows `scripts/coverage-report.mjs`: every failure path, the distinguishing message, and staged or argued.

* One row is the survivor refusal, message `Rust coverage left stale raw profiles:`, staged by the scratch-directory call above. The recorded status for that staged call is a rejected promise. The header states that `main`'s CLI exit, when this throw escapes the top-level `await`, is Node's exit 1.
* Removal and walk failures that this change adds (the clear's removal error, and a walk error other than the handled `ENOENT`) are staged on a scratch directory. A mode that makes removal fail, and a directory that cannot be read, are enough. Their messages are the filesystem errors Node raises. They get their own rows because those messages are not the survivor message.
* Every other failure path in the file after the edit is staged too, through the exported orchestration and the helpers it already exports (`coverageTools`, `exportLcovOrDiagnose`), using scratch directories and a fake runner. Probe 2's list is the starting enumeration, not the matrix: the executor re-reads the edited file and accounts for each path. Paths that already have a direct assertion are staged rows, not gaps.
* Tool resolution stays before any profile deletion. One staged spawn of the entrypoint uses a scratch `PATH` on which `rustup` cannot run. Before the spawn, the test plants one `.profraw` under `coverageTarget` (creating that directory if it is absent) and records the set of `.profraw` paths. The spawn records the tool-resolution message and exit status 1. The set of `.profraw` paths is unchanged, which fails if the clear ran. A `finally` path deletes only the file it planted, including when the spawn or an assertion fails, so a failed test does not leave that profile in `coverageTarget`. A spawn that would reach the clear or Cargo is not staged: past tool resolution the entrypoint binds the real `coverageTarget` and would delete live profiles or start Cargo. The header argues those spawns for that reason. The survivor refusal's process exit is the same uncaught rejection, described from the orchestration test, not from a second spawn.

### Proof the adopting session runs

The phase proof is two commands, in this order:

1. `pnpm coverage:report:test`
2. `pnpm gate:ensure backend-coverage`

Command 2 is required even though a scripts-only diff does not select `rust-coverage` and `pnpm gates:push` without `--rust` skips it. The planner does not start either command. The adopting session also runs `pnpm checks:pre-review` before cumulative diff review, because the push skill's pre-review block formats and lints these `.mjs` files. That block does not replace command 2.

No browser check. The change is not a rendered surface.

## Decisions and trade-offs

Chosen mechanism: clear, then refuse. Rejected: merge only profiles whose `%m` matches the binary just built. A cold run can emit a build-script profile with a different `%m` in the same invocation (cargo-llvm-cov 0.8.7 `set_env`), and a stale file whose `%m` still matches the current test binary is exactly the inflation the finding measured. A filter would drop the fresh extra profile and keep the stale one.

Rejected: `cargo llvm-cov clean --profraw-only` as the only clear. Its glob is `target_dir/*.profraw`. The merger is recursive. Nested profiles would survive and be merged.

Rejected: dropping `--no-report` so cargo-llvm-cov's automatic clean runs. That path also runs `clean_partial`, which cargo-cleans the measured crates, and it generates cargo-llvm-cov's own report. This repository exports LCOV itself because `--branch` segfaults (llvm/llvm-project#119558), which the script already handles. `--no-report` stays.

Rejected: a new lock around the coverage target. `d-20260930-01` already separates `rust-test` onto another target directory. A second writer of `llvm-cov-target` after the assert is the known limit below, not a new mechanism.

## Risks / open questions

Known limit, named here, not a new lock: a second process that writes a `.profraw` under `coverageTarget` after the survivor check returns can still be merged. The pre-change script has the same window, with no preceding clear. No Cargo target-dir override puts `rust-test` on `llvm-cov-target`.

No open product question. The mechanism is the technical choice recorded under `## Decided autonomously`.

## Not part of this task

* `backend-coverage-baselines.json`, `minimumCoverage` in `backend-coverage-areas.json`, and any re-record of `scopeSignature`.
* Receipt invalidation in `scripts/gate-receipt.mjs`. A skipped run does not merge stale profiles.
* The GitHub Actions rust-cache key and `scripts/run-push-gates.mjs` lane selection.
* f-20261002-10 (handled) and f-20261002-08.
* `docs/coverage.md`, unless a sentence there claims the profile directory is already cleared. It does not, as read in locate.
* A lock, a watcher, or a production environment variable for the profile directory.

## Phases

One phase. Area: gate-scripts. No auth, persistence, concurrency control, or API contract. Executor: Codex write, role `normal` (these paths are not in the push skill's sensitive globs).

Files: `scripts/rust-branch-coverage.mjs`, `scripts/coverage-report-tests.mjs`. Read `scripts/files-below.mjs` and `scripts/coverage-report.mjs`. Do not edit them.

Implements Clear before the instrumented run, Refuse if any raw profile survives, and Staged-failure matrix for this evidence script.

Spelling this phase uses, so the tests and the header name one thing:

* `clearStaleRawProfiles(directory)` removes the regular-file profiles.
* `assertNoStaleRawProfiles(directory)` throws the survivor message.
* `runBranchCoverage(options)` resolves the coverage tools, then performs the clear, the assert, then the existing Cargo, merge, and export steps. Omitted options are today's paths, the current `run` / `attempt` runners, and the `filesBelow` walk (`listProfiles`). `main` is the no-argument call.

Removal is `unlink` of each path the walk returned. Do not follow symlinks. Do not add an environment variable.

PROOF:

```bash
pnpm coverage:report:test
pnpm gate:ensure backend-coverage
```

The planner does not run these. The adopting session runs both, and runs `pnpm checks:pre-review` before cumulative diff review.

## Decided autonomously

Questioning is skipped because the launch says `full auto`. The adopting session records each entry with `./scripts/findings.py record-decision`. The planner does not.

### Which profiles count as this run?

* **Question:** Clear `.profraw` files under `coverageTarget` before the run and fail if any survive, or merge only the profiles whose binary signature matches the binary just built?
* **Chosen:** Clear every regular-file `.profraw` that `filesBelow(coverageTarget)` would return, then throw `Rust coverage left stale raw profiles:` if any remain, before `cargo llvm-cov`. A missing directory is success. Symlinks are not followed.
* **Rejected:** A `%m` filter. `cargo llvm-cov clean --profraw-only` as the only clear. Dropping `--no-report`.
* **Reason:** cargo-llvm-cov 0.8.7 sets `no_clean` when `--no-report` is passed, and its own profraw clean is a non-recursive glob while this script merges recursively. A binary-id filter drops a fresh build-script profile from the same invocation and keeps a stale file whose `%m` still matches the current test binary. Reversal path: replace the clear with a filter that keeps every profile written by this invocation, including a different `%m`, and still drops a stale file with the current `%m`.

### What does the matrix cover?

* **Question:** Stage only the new survivor refusal, or every failure path of `rust-branch-coverage.mjs`?
* **Chosen:** The whole matrix. The survivor refusal, the new removal and walk failures, and every other path in the edited file are staged through the exports against scratch inputs. One pre-clear entrypoint spawn, the `rustup` failure, is staged after planting one `.profraw` and asserting that path set is unchanged. A `finally` path deletes only that planted file, including when the spawn or an assertion fails. A spawn that reaches the clear or Cargo stays argued because it binds the live coverage tree.
* **Rejected:** Listing pre-existing throws as inherited and not staging them. Round 1's first draft chose that, and it does not survive `push-review-policy.md` §2's rule that the run which changes an evidence artefact builds the matrix in this run. The finding cites that section.
* **Reason:** `pnpm coverage:backend:check` reads this script's result as evidence. A header that names unstaged paths does not make those paths evidence. Reversal path: a later decision that the gate stops treating this script's exit as evidence.

### Does the adopting session run the coverage gate when path selection would skip it?

* **Question:** Is `pnpm coverage:report:test` enough proof, given `gates:push` will not select `backend-coverage` from a scripts-only diff?
* **Chosen:** The phase proof is `pnpm coverage:report:test` and then `pnpm gate:ensure backend-coverage`.
* **Rejected:** Relying on path selection or on `pnpm gates:push` without `--rust`.
* **Reason:** The artefact is the gate. The unit test does not execute `main` or Cargo. Reversal path: teach lane selection to notice this script, which is a different change and is not this mandate.

## Carried to diff review

* CR-1 — Symlink fixture on a platform that refuses `symlink` with `EPERM`. The non-follow assertion runs where creating a symlink in a temporary directory succeeds. On `EPERM`, skip only that assertion; the nested-profile and sibling-file assertions still run. Do not add a Windows or macOS CI job. The contract gate that runs `pnpm coverage:report:test` is the Ubuntu `test` job (`.github/workflows/test.yml`).

## Reviews

Append-only. Raw reports stay in the lens artefacts. This section is the lookup record.

Round 1 wall time is the leaf span recorded in `plan-meta.json`. 12 plan-capable lenses. Adopted P-1, P-2, P-3, P-4. Carried CR-1. No skips.

Round 2 closure: plan, tests, error-handling, minimalism, correctness. P-2, P-3, P-4 closed by their witnesses. P-1 not closed. Adopted the P-1 tightening and P-6.

Round 3 closure: plan, tests, error-handling, correctness. P-1 closed by plan and tests. P-6 not closed by tests. Adopted the planted-profile assertion and this record (P-7).

Round 4 closure: plan, tests, error-handling. P-6 closed by tests, plan, and error-handling. P-7 closed by plan. Adopted P-8: the planted file is removed on a `finally` path when the spawn or an assertion fails.

### P-1

* Claim: a direct call to the refusal helper stays green if `main` or the orchestration omits the clear and the refusal, and the coverage gate does not catch that omission.
* Witnesses: plan r1 finding 1 (blocker), tests r1 finding 1 (blocker), plan r2 finding 1 (blocker, NOT CLOSED), tests r2 finding 1 (blocker, NOT CLOSED).
* Disposition: Fix. Closed in round 3.
* Correction: the survivor proof calls only `runBranchCoverage`. `listProfiles` returns no profiles on the clear's walk and one path on the next walk. Removing the refusal walk makes the fake runner reach Cargo and the test fails.
* Evidence: `package.json` `coverage:backend:check` reads `lcov.info` only. Round 3 plan and tests both reported `P-1 CLOSED` on that sentence.
* Authority: MANDATE "before the run" and "fail if any survive". The proof has to go red when that production order is removed.
* Obligation: Refuse if any raw profile survives.

### P-2

* Claim: the approach prescribed helper signatures, `unlink`, and fixture steps that are executor choices.
* Witnesses: plan r1 finding 2 (should-fix).
* Disposition: Fix. Closed in round 2.
* Correction: the approach states behavior. The phase names `clearStaleRawProfiles`, `assertNoStaleRawProfiles`, `runBranchCoverage`, and `unlink`.
* Evidence: plan round 2 reported `P-2 CLOSED`.
* Obligation: Clear before the instrumented run.

### P-3

* Claim: a removal or walk error introduced by the clear is a new stageable path, not an inherited row.
* Witnesses: error-handling r1 finding 1 (should-fix), tests r1 finding 2 (should-fix, the new-path half).
* Disposition: Fix. Closed in round 2.
* Correction: scratch-directory rows for the removal failure and for a non-`ENOENT` walk failure, each with its own filesystem message.
* Evidence: error-handling and tests round 2 reported `P-3 CLOSED`.
* Authority: MANDATE cites push-review-policy §2. A path this change adds is stageable on a scratch directory.
* Obligation: Staged-failure matrix for this evidence script.

### P-4

* Claim: marking pre-existing throws inherited, without staging or an allowed argument, does not satisfy §2 for a script this change edits.
* Witnesses: tests r1 finding 2 (should-fix, the inherited-path half).
* Disposition: Fix. Closed in round 2.
* Correction: stage every remaining failure path through the exports. Argue only spawns that reach the clear or Cargo.
* Evidence: tests round 2 reported `P-4 CLOSED`. `push-review-policy.md` §2 fifth condition: the run that changes an evidence artefact builds the matrix in this run.
* Authority: the MANDATE's citation of push-review-policy §2, and that section's words "same area, build the matrix in this run".
* Obligation: Staged-failure matrix for this evidence script.

### P-5

* Claim: a symlink fixture can throw `EPERM` on Windows, and the proof command is not a Windows CI job.
* Witnesses: platform-semantics r1 finding 1 (should-fix).
* Disposition: Fix. `closed_round` carried, id CR-1.
* Correction: see `## Carried to diff review`. The Ubuntu contract gate is the runtime that runs this test. No new CI job.
* Evidence: `.github/workflows/test.yml` job `test` runs `pnpm gates:contract:check` on `ubuntu-latest`. The Windows and macOS jobs do not run `coverage-report-tests.mjs`.

### P-6

* Claim: the entrypoint's process exit can be staged for the tool-resolution failure without deleting profiles, because that failure happens before the clear.
* Witnesses: error-handling r2 finding 1 (should-fix). tests r3 finding 1 (should-fix, NOT CLOSED): a missing profile directory does not prove the clear did not run.
* Disposition: Fix. Closed in round 4.
* Correction: plant one `.profraw`, assert the path set is unchanged, delete only that file.
* Evidence: current `main` calls `coverageTools` before any profile walk (`scripts/rust-branch-coverage.mjs` line 122, profile walk at line 139). Round 4 plan, tests, and error-handling reported `P-6 CLOSED`.
* Authority: push-review-policy §2, record the exit status of a stageable path. The planted file is restored by the test.
* Obligation: Staged-failure matrix for this evidence script.

### P-7

* Claim: the plan file had no `## Reviews` record for lenses to look up.
* Witnesses: plan r3 finding 1 (blocker).
* Disposition: Fix. Closed in round 4.
* Correction: this section.
* Evidence: round 4 plan reported `P-7 CLOSED` on this heading.
* Obligation: the review record, not a product obligation.

### P-8

* Claim: if the planted-profile spawn or its assertion fails first, the delete does not run and the planted `.profraw` stays in the real coverage target.
* Witnesses: error-handling r4 finding 1 (should-fix).
* Disposition: Fix. Open until the round that reviews the `finally` cleanup.
* Correction: a `finally` path deletes only the planted file, including when the spawn or an assertion fails.
* Evidence: the round-4 matrix bullet deleted the file only after the assertions. `coverageTarget` is the real `src-tauri/target/llvm-cov-target`.
* Lineage: P-6.
* Obligation: Staged-failure matrix for this evidence script.

### plan-r6.md

# Plan: Clear stale Rust coverage profiles before the instrumented run

Finding: f-20261002-09. Area: gate-scripts. Root: machine-dependent-measurement. Entry stays `build` after revalidation: the open question is which profiles count as this run, and the script is read as evidence, so the new refusal is part of the change. The planner does not annotate the ledger. The adopting session records the decision under `## Decided autonomously`.

Plan path: `tasks/plans/2026-10-02-stale-profraw.md`.

## Goal

`pnpm test:coverage:backend` merges only `.profraw` files produced by the run that just finished. Profiles left under `src-tauri/target/llvm-cov-target` by an earlier run are removed before `cargo llvm-cov` starts. If any regular-file `.profraw` the merger would see is still there after that removal, the script throws and does not start Cargo. The script's failure paths, including the new refusal, are staged in this run. Baselines, floors, receipt invalidation, and the CI cache key stay as they are.

## MANDATE

Verbatim from `tasks/findings.md`, f-20261002-09. Fixed across every round.

* **ID:** f-20261002-09 · **Status:** open · **Area:** gate-scripts · **Root:** machine-dependent-measurement · **Entry:** build · **Blocked:** none
* **Where:** `scripts/rust-branch-coverage.mjs` (`coverageTarget = src-tauri/target/llvm-cov-target`; after `cargo +nightly llvm-cov … --no-report` it merges `filesBelow(coverageTarget, path.endsWith(".profraw"))` with `llvm-profdata merge -sparse`), used by `pnpm test:coverage:backend` and the receipt-backed `backend-coverage` gate.
* **Defect:** nothing removes profiles from earlier runs. On atlas on 2026-10-02 the directory held 1 517 `.profraw` files with binary signatures dating back to 2026-08-29. Every unchanged function (same name and structural hash) accumulates counts from all of them, so code that the current tests no longer execute stays "covered". Measured: on tree `04f43c1b` the local `pnpm coverage:backend:check` passed while CI (fresh checkout) failed `filesystem-native-boundaries functions regressed: 359/673, baseline 340/634`; the 8 records covered locally but not on CI were all one instance chain that the current test never runs. After deleting every `.profraw` below `llvm-cov-target` and rerunning, the local result reproduced CI exactly (359/673, red).
* **Why it matters:** the backend ratchet's local green — the push gate — can be inflated by history and disagree with CI, which is the next reader's first suspicion of "machine dependence" (`CLAUDE.md`, `f-20260829-01`) when it is in fact stale input. A push can pass every local gate and turn CI red.
* **Open question:** clear `.profraw` files under `coverageTarget` before the run (and fail if any survive), or merge only the profiles whose binary signature matches the binary just built; plus the staged-failure matrix row for the new refusal (push-review-policy §2, the script is read as evidence).
* **Found by:** Stockfish 19 upgrade build, CI red after push, 2026-10-02 (orchestrator measurement above).

## Threat model and non-goals

Frozen with the MANDATE.

Accidental input is the real case: a developer or a previous local gate leaves `.profraw` files under `coverageTarget`, including files in subdirectories and files whose `%m` binary id still matches the current test binary. The script must not treat those counts as this run. CI's fresh checkout is the environment that already fails closed; this change makes the local gate fail the same way.

A second coverage process that creates a `.profraw` after the emptiness check is a named known limit under Risks. It is the same hazard the pre-change merger already has, and `d-20260930-01` already runs `rust-test` on a different target directory. This plan adds no lock.

Adversarial input (a process that replaces profiles between the check and the merge, or a symlink farm) is out of scope. The clear uses the same directory walk the merger already uses.

Non-goals: changing what the compiler emits, which sources are exported, the numeric baselines, the area floors, receipt invalidation, the GitHub Actions cache key, or the type-erasure already landed for f-20261002-10.

## Traced premises

Locate citations. Obligations below do not repeat line numbers.

* `scripts/rust-branch-coverage.mjs` sets `coverageTarget` to `src-tauri/target/llvm-cov-target` and, in `main`, runs `cargo +<toolchain> llvm-cov --manifest-path <src-tauri/Cargo.toml> --bin chessfable --locked --branch --no-report` before any profile walk. It then merges every path `filesBelow(coverageTarget, path.endsWith(".profraw"))` returns. An empty list throws `Rust coverage produced no raw profiles`. `main` is not exported. The module runs `main` only when `isEntrypoint` matches, so a test can import the module without starting Cargo.
* `scripts/files-below.mjs` recurses only when `entry.isDirectory()` and returns a path only when `entry.isFile()` and the predicate matches. Symlinks are neither, so they are not followed and a symlink whose name ends in `.profraw` is not returned.
* Probe 1 on this worktree: `coverageTarget` was absent (`PROFILE_DIRECTORY_ABSENT`). `filesBelow` on a missing directory rejects with the `readdir` error. A first run must not fail because the directory does not exist yet.
* Orchestrator measurement, cargo-llvm-cov tag v0.8.7, fetched 2026-10-02 from `https://raw.githubusercontent.com/taiki-e/cargo-llvm-cov/v0.8.7/src/cli.rs` line 1590: `clean.no_clean |= report.no_report | no_run`. The comment at lines 1589-1590 states that `--no-report` and `--no-run` imply `--no-clean`. `src/clean.rs` `clean_profraw_files` globs `target_dir/*.profraw` only (not recursive) and `clean_partial` returns immediately when `no_clean` is set, before that glob. `src/main.rs` `set_env` sets `LLVM_PROFILE_FILE` to `target_dir.join("{workspace}-%p-%m.profraw")` for a non-nextest run (`%p` pid, `%m` binary id). Local `cargo llvm-cov --version` is 0.8.7 (probe 1). `cargo llvm-cov clean --help` documents `--profraw-only`. The probe's local crate path `cargo-llvm-cov-0.8.7` was not on disk; these citations are the tag, not that path.
* `package.json` script `test:coverage:backend` is `node scripts/ensure-output-directory.mjs backend-coverage && node scripts/rust-branch-coverage.mjs`. `coverage:backend:check` reads `backend-coverage/lcov.info`. `ensure-output-directory.mjs` creates `backend-coverage/` and does not clear `llvm-cov-target`.
* `scripts/gate-receipt.mjs` records `backend-coverage` as `pnpm test:coverage:backend && pnpm coverage:backend:check`. A green receipt can skip the script while ignored `.profraw` files remain. Those files affect only a run that executes the script.
* `scripts/run-push-gates.mjs` selects the `rust-coverage` lane (`pnpm gate:ensure backend-coverage`) from the `--rust` flag, not from changed paths. `hasCoverageInputsChanged` keys off `src-tauri/src`, `backend-coverage-areas.json`, and `backend-coverage-baselines.json`. A scripts-only diff does not select the lane. `pnpm gates:push` without `--rust` does not run it.
* `.github/workflows/test.yml` restores `src-tauri -> target` with Swatinem/rust-cache and then runs `pnpm test:coverage:backend` and `pnpm coverage:backend:check`. Whether that cache restores `.profraw` files was not proven. Delete-before still removes them if it does. The cache key is not this change.
* `scripts/coverage-report.mjs` carries the staged-failure matrix pattern: the header enumerates paths, and `scripts/coverage-report-tests.mjs` calls exported functions directly. The header states that an exported-function call is a real caller. `pnpm coverage:report:test` runs `node --test scripts/coverage-report-tests.mjs`. That file is the only importer of `rust-branch-coverage.mjs` (probe 2).
* Probe 2: `rust-branch-coverage.mjs` has no header matrix. Explicit throw sites without a staged row are at the `run` helper, the metadata refusal, the export crash and export-status throws, the empty-profile throw, the missing-executable throw, the empty-source throw, the empty-export throw, and the no-branch-data throw. Only the metadata refusal and the per-source crash diagnostic have direct unit assertions today. Inherited throws are not evidence for this change.
* `d-20260922-08`: `scopeSignature` guards what is measured. Deleting profiles changes hit counts, not the signature.
* `d-20260928-01`: test-only exclusion stays in the gate. The exporter's LCOV stays raw compiler output. `d-20260902-02` is superseded on that point.
* `d-20260930-01`: `rust-test` and `rust-coverage` stay concurrent and use different target directories (`llvm-cov-target` versus the default). No Cargo `config.toml` target-dir override was found.
* Push skill Skip catalog: do not rebaseline coverage to clear a ratchet. f-20261002-10 is already handled by type-erasing the validator. f-20260829-01 was a missing recursive-delete test, and its closing note says that root does not survive for the backend half. This finding is stale input under the same root name, not that defect.

## Approach

### Clear before the instrumented run

Quotes the MANDATE: "clear `.profraw` files under `coverageTarget` before the run".

Before `cargo llvm-cov`, remove every regular-file `.profraw` the merger would see.

* The walk is the same `filesBelow` walk the merger uses, so a nested regular file is removed and a symlink is not followed.
* `ENOENT` from that walk means the directory is absent. Clearing returns. A first run must succeed.
* Any other walk error propagates unchanged. It does not start Cargo.
* Each returned path is removed. The first removal error propagates unchanged, with the filesystem error's own message. Nothing is swallowed. Non-`.profraw` files and the directory itself stay, so incremental build artefacts under `llvm-cov-target` stay.
* This step does not call `cargo llvm-cov clean`.

The production path is one exported orchestration function that `main` calls and that tests call with scratch directories and a fake command runner. `main` passes no arguments; the defaults are today's paths and today's runners. There is no production environment variable. The phase names the exports. Private branch structure inside the function stays with the executor.

Verification level: a temporary directory. Plant a nested `.profraw`, a non-`.profraw` sibling, and, where creating a symlink succeeds, a symlink to a directory that contains a `.profraw`. After the clear, the nested profile is gone, the sibling remains, and the profile behind the symlink remains. A missing directory resolves. `CR-1` covers the platform where creating the symlink is refused.

### Refuse if any raw profile survives

Quotes the MANDATE: "and fail if any survive".

Immediately after the clear, and before `cargo llvm-cov`, walk again. A non-empty result throws `new Error("Rust coverage left stale raw profiles: " + paths)`. `paths` is the absolute paths sorted lexicographically and joined with `", "`. The message is distinct from `Rust coverage produced no raw profiles`. `ENOENT` on this walk returns. Any other walk error propagates. The throw does not delete and does not start Cargo.

Verification level: the survivor proof calls only `runBranchCoverage`. Its `listProfiles` option, which defaults to the `filesBelow` walk, returns no profiles on the clear's walk and one absolute path on the next walk. The call rejects with a message that starts with `Rust coverage left stale raw profiles:` and contains that path, and the fake runner is not asked to run `cargo`. Removing the refusal walk from `runBranchCoverage` turns this test red. A direct call to the refusal export may stage that function's own row; it does not satisfy this proof. A second test plants profiles, uses the default walk so the clear removes them, and asserts the runner's `cargo` `llvm-cov` invocation happens only after the directory has no `.profraw`. A test reads `scripts/rust-branch-coverage.mjs` and fails if `main` does not call `runBranchCoverage`.

### Staged-failure matrix for this evidence script

Quotes the MANDATE: "plus the staged-failure matrix row for the new refusal (push-review-policy §2, the script is read as evidence)".

`push-review-policy.md` §2, the section the finding names, says the run that changes an evidence artefact owns its matrix, and an inherited gap in the same area is built in this run rather than left as a licence. This change edits `scripts/rust-branch-coverage.mjs`, and `pnpm coverage:backend:check` reads that run's result as evidence. The header matrix follows `scripts/coverage-report.mjs`: every failure path, the distinguishing message, the status of that same run, and whether the row is staged or argued.

* One row is the survivor refusal, message `Rust coverage left stale raw profiles:`, staged by the scratch-directory call above. The recorded status for that staged call is a rejected promise. The header states that `main`'s CLI exit, when this throw escapes the top-level `await`, is Node's exit 1.
* Removal and walk failures that this change adds (the clear's removal error, and a walk error other than the handled `ENOENT`) are staged on a scratch directory. A mode that makes removal fail, and a directory that cannot be read, are enough. Their messages are the filesystem errors Node raises. The recorded status for each staged call is a rejected promise. The header states that the CLI exit, when that rejection escapes the top-level `await`, is Node's exit 1, described from that rejection and not from a second spawn. They get their own rows because those messages are not the survivor message.
* Every other failure path in the file after the edit is staged too, through the exported orchestration and the helpers it already exports (`coverageTools`, `exportLcovOrDiagnose`), using scratch directories and a fake runner. Each staged call records the message that distinguishes that path and the status of that same call: a rejected promise when the path throws, or the exit status the header names when the path is a process. Probe 2's list is the starting enumeration, not the matrix: the executor re-reads the edited file and accounts for each path. Paths that already have a direct assertion are staged rows, not gaps.
* Tool resolution stays before any profile deletion. One staged spawn of the entrypoint uses a scratch `PATH` on which `rustup` cannot run. Before the spawn, the test plants one `.profraw` under `coverageTarget` (creating that directory if it is absent) and records the set of `.profraw` paths. The spawn records the tool-resolution message and exit status 1. The set of `.profraw` paths is unchanged, which fails if the clear ran. A `finally` path deletes only the file it planted, including when the spawn or an assertion fails, so a failed test does not leave that profile in `coverageTarget`. A spawn that would reach the clear or Cargo is not staged: past tool resolution the entrypoint binds the real `coverageTarget` and would delete live profiles or start Cargo. The header argues those spawns for that reason. The survivor refusal's process exit is the same uncaught rejection, described from the orchestration test, not from a second spawn.

### Proof the adopting session runs

The phase proof is two commands, in this order:

1. `pnpm coverage:report:test`
2. `pnpm gate:ensure backend-coverage`

Command 2 is required even though a scripts-only diff does not select `rust-coverage` and `pnpm gates:push` without `--rust` skips it. The planner does not start either command. The adopting session also runs `pnpm checks:pre-review` before cumulative diff review, because the push skill's pre-review block formats and lints these `.mjs` files. That block does not replace command 2.

No browser check. The change is not a rendered surface.

## Decisions and trade-offs

Chosen mechanism: clear, then refuse. Rejected: merge only profiles whose `%m` matches the binary just built. A cold run can emit a build-script profile with a different `%m` in the same invocation (cargo-llvm-cov 0.8.7 `set_env`), and a stale file whose `%m` still matches the current test binary is exactly the inflation the finding measured. A filter would drop the fresh extra profile and keep the stale one.

Rejected: `cargo llvm-cov clean --profraw-only` as the only clear. Its glob is `target_dir/*.profraw`. The merger is recursive. Nested profiles would survive and be merged.

Rejected: dropping `--no-report` so cargo-llvm-cov's automatic clean runs. That path also runs `clean_partial`, which cargo-cleans the measured crates, and it generates cargo-llvm-cov's own report. This repository exports LCOV itself because `--branch` segfaults (llvm/llvm-project#119558), which the script already handles. `--no-report` stays.

Rejected: a new lock around the coverage target. `d-20260930-01` already separates `rust-test` onto another target directory. A second writer of `llvm-cov-target` after the assert is the known limit below, not a new mechanism.

## Risks / open questions

Known limit, named here, not a new lock: a second process that writes a `.profraw` under `coverageTarget` after the survivor check returns can still be merged. The pre-change script has the same window, with no preceding clear. No Cargo target-dir override puts `rust-test` on `llvm-cov-target`.

No open product question. The mechanism is the technical choice recorded under `## Decided autonomously`.

## Not part of this task

* `backend-coverage-baselines.json`, `minimumCoverage` in `backend-coverage-areas.json`, and any re-record of `scopeSignature`.
* Receipt invalidation in `scripts/gate-receipt.mjs`. A skipped run does not merge stale profiles.
* The GitHub Actions rust-cache key and `scripts/run-push-gates.mjs` lane selection.
* f-20261002-10 (handled) and f-20261002-08.
* `docs/coverage.md`, unless a sentence there claims the profile directory is already cleared. It does not, as read in locate.
* A lock, a watcher, or a production environment variable for the profile directory.

## Phases

One phase. Area: gate-scripts. No auth, persistence, concurrency control, or API contract. Executor: Codex write, role `normal` (these paths are not in the push skill's sensitive globs).

Files: `scripts/rust-branch-coverage.mjs`, `scripts/coverage-report-tests.mjs`. Read `scripts/files-below.mjs` and `scripts/coverage-report.mjs`. Do not edit them.

Implements Clear before the instrumented run, Refuse if any raw profile survives, and Staged-failure matrix for this evidence script.

Spelling this phase uses, so the tests and the header name one thing:

* `clearStaleRawProfiles(directory)` removes the regular-file profiles.
* `assertNoStaleRawProfiles(directory)` throws the survivor message.
* `runBranchCoverage(options)` resolves the coverage tools, then performs the clear, the assert, then the existing Cargo, merge, and export steps. Omitted options are today's paths, the current `run` / `attempt` runners, and the `filesBelow` walk (`listProfiles`). `main` is the no-argument call.

Removal is `unlink` of each path the walk returned. Do not follow symlinks. Do not add an environment variable.

PROOF:

```bash
pnpm coverage:report:test
pnpm gate:ensure backend-coverage
```

The planner does not run these. The adopting session runs both, and runs `pnpm checks:pre-review` before cumulative diff review.

## Decided autonomously

Questioning is skipped because the launch says `full auto`. The adopting session records each entry with `./scripts/findings.py record-decision`. The planner does not.

### Which profiles count as this run?

* **Question:** Clear `.profraw` files under `coverageTarget` before the run and fail if any survive, or merge only the profiles whose binary signature matches the binary just built?
* **Chosen:** Clear every regular-file `.profraw` that `filesBelow(coverageTarget)` would return, then throw `Rust coverage left stale raw profiles:` if any remain, before `cargo llvm-cov`. A missing directory is success. Symlinks are not followed.
* **Rejected:** A `%m` filter. `cargo llvm-cov clean --profraw-only` as the only clear. Dropping `--no-report`.
* **Reason:** cargo-llvm-cov 0.8.7 sets `no_clean` when `--no-report` is passed, and its own profraw clean is a non-recursive glob while this script merges recursively. A binary-id filter drops a fresh build-script profile from the same invocation and keeps a stale file whose `%m` still matches the current test binary. Reversal path: replace the clear with a filter that keeps every profile written by this invocation, including a different `%m`, and still drops a stale file with the current `%m`.

### What does the matrix cover?

* **Question:** Stage only the new survivor refusal, or every failure path of `rust-branch-coverage.mjs`?
* **Chosen:** The whole matrix. The survivor refusal, the new removal and walk failures, and every other path in the edited file are staged through the exports against scratch inputs. One pre-clear entrypoint spawn, the `rustup` failure, is staged after planting one `.profraw` and asserting that path set is unchanged. A `finally` path deletes only that planted file, including when the spawn or an assertion fails. A spawn that reaches the clear or Cargo stays argued because it binds the live coverage tree.
* **Rejected:** Listing pre-existing throws as inherited and not staging them. Round 1's first draft chose that, and it does not survive `push-review-policy.md` §2's rule that the run which changes an evidence artefact builds the matrix in this run. The finding cites that section.
* **Reason:** `pnpm coverage:backend:check` reads this script's result as evidence. A header that names unstaged paths does not make those paths evidence. Reversal path: a later decision that the gate stops treating this script's exit as evidence.

### Does the adopting session run the coverage gate when path selection would skip it?

* **Question:** Is `pnpm coverage:report:test` enough proof, given `gates:push` will not select `backend-coverage` from a scripts-only diff?
* **Chosen:** The phase proof is `pnpm coverage:report:test` and then `pnpm gate:ensure backend-coverage`.
* **Rejected:** Relying on path selection or on `pnpm gates:push` without `--rust`.
* **Reason:** The artefact is the gate. The unit test does not execute `main` or Cargo. Reversal path: teach lane selection to notice this script, which is a different change and is not this mandate.

## Carried to diff review

* CR-1 — Symlink fixture on a platform that refuses `symlink` with `EPERM`. The non-follow assertion runs where creating a symlink in a temporary directory succeeds. On `EPERM`, skip only that assertion; the nested-profile and sibling-file assertions still run. Do not add a Windows or macOS CI job. The contract gate that runs `pnpm coverage:report:test` is the Ubuntu `test` job (`.github/workflows/test.yml`).

## Reviews

Append-only. Raw reports stay in the lens artefacts. This section is the lookup record.

Round 1 wall time is the leaf span recorded in `plan-meta.json`. 12 plan-capable lenses. Adopted P-1, P-2, P-3, P-4. Carried CR-1. No skips.

Round 2 closure: plan, tests, error-handling, minimalism, correctness. P-2, P-3, P-4 closed by their witnesses. P-1 not closed. Adopted the P-1 tightening and P-6.

Round 3 closure: plan, tests, error-handling, correctness. P-1 closed by plan and tests. P-6 not closed by tests. Adopted the planted-profile assertion and this record (P-7).

Round 4 closure: plan, tests, error-handling. P-6 closed by tests, plan, and error-handling. P-7 closed by plan. Adopted P-8: the planted file is removed on a `finally` path when the spawn or an assertion fails.

Round 5 closure: plan, tests, error-handling. P-8 closed by all three. Adopted P-9: each new removal and walk row records a rejected promise, and every other staged call records its message and status.

### P-1

* Claim: a direct call to the refusal helper stays green if `main` or the orchestration omits the clear and the refusal, and the coverage gate does not catch that omission.
* Witnesses: plan r1 finding 1 (blocker), tests r1 finding 1 (blocker), plan r2 finding 1 (blocker, NOT CLOSED), tests r2 finding 1 (blocker, NOT CLOSED).
* Disposition: Fix. Closed in round 3.
* Correction: the survivor proof calls only `runBranchCoverage`. `listProfiles` returns no profiles on the clear's walk and one path on the next walk. Removing the refusal walk makes the fake runner reach Cargo and the test fails.
* Evidence: `package.json` `coverage:backend:check` reads `lcov.info` only. Round 3 plan and tests both reported `P-1 CLOSED` on that sentence.
* Authority: MANDATE "before the run" and "fail if any survive". The proof has to go red when that production order is removed.
* Obligation: Refuse if any raw profile survives.

### P-2

* Claim: the approach prescribed helper signatures, `unlink`, and fixture steps that are executor choices.
* Witnesses: plan r1 finding 2 (should-fix).
* Disposition: Fix. Closed in round 2.
* Correction: the approach states behavior. The phase names `clearStaleRawProfiles`, `assertNoStaleRawProfiles`, `runBranchCoverage`, and `unlink`.
* Evidence: plan round 2 reported `P-2 CLOSED`.
* Obligation: Clear before the instrumented run.

### P-3

* Claim: a removal or walk error introduced by the clear is a new stageable path, not an inherited row.
* Witnesses: error-handling r1 finding 1 (should-fix), tests r1 finding 2 (should-fix, the new-path half).
* Disposition: Fix. Closed in round 2.
* Correction: scratch-directory rows for the removal failure and for a non-`ENOENT` walk failure, each with its own filesystem message.
* Evidence: error-handling and tests round 2 reported `P-3 CLOSED`.
* Authority: MANDATE cites push-review-policy §2. A path this change adds is stageable on a scratch directory.
* Obligation: Staged-failure matrix for this evidence script.

### P-4

* Claim: marking pre-existing throws inherited, without staging or an allowed argument, does not satisfy §2 for a script this change edits.
* Witnesses: tests r1 finding 2 (should-fix, the inherited-path half).
* Disposition: Fix. Closed in round 2.
* Correction: stage every remaining failure path through the exports. Argue only spawns that reach the clear or Cargo.
* Evidence: tests round 2 reported `P-4 CLOSED`. `push-review-policy.md` §2 fifth condition: the run that changes an evidence artefact builds the matrix in this run.
* Authority: the MANDATE's citation of push-review-policy §2, and that section's words "same area, build the matrix in this run".
* Obligation: Staged-failure matrix for this evidence script.

### P-5

* Claim: a symlink fixture can throw `EPERM` on Windows, and the proof command is not a Windows CI job.
* Witnesses: platform-semantics r1 finding 1 (should-fix).
* Disposition: Fix. `closed_round` carried, id CR-1.
* Correction: see `## Carried to diff review`. The Ubuntu contract gate is the runtime that runs this test. No new CI job.
* Evidence: `.github/workflows/test.yml` job `test` runs `pnpm gates:contract:check` on `ubuntu-latest`. The Windows and macOS jobs do not run `coverage-report-tests.mjs`.

### P-6

* Claim: the entrypoint's process exit can be staged for the tool-resolution failure without deleting profiles, because that failure happens before the clear.
* Witnesses: error-handling r2 finding 1 (should-fix). tests r3 finding 1 (should-fix, NOT CLOSED): a missing profile directory does not prove the clear did not run.
* Disposition: Fix. Closed in round 4.
* Correction: plant one `.profraw`, assert the path set is unchanged, delete only that file.
* Evidence: current `main` calls `coverageTools` before any profile walk (`scripts/rust-branch-coverage.mjs` line 122, profile walk at line 139). Round 4 plan, tests, and error-handling reported `P-6 CLOSED`.
* Authority: push-review-policy §2, record the exit status of a stageable path. The planted file is restored by the test.
* Obligation: Staged-failure matrix for this evidence script.

### P-7

* Claim: the plan file had no `## Reviews` record for lenses to look up.
* Witnesses: plan r3 finding 1 (blocker).
* Disposition: Fix. Closed in round 4.
* Correction: this section.
* Evidence: round 4 plan reported `P-7 CLOSED` on this heading.
* Obligation: the review record, not a product obligation.

### P-8

* Claim: if the planted-profile spawn or its assertion fails first, the delete does not run and the planted `.profraw` stays in the real coverage target.
* Witnesses: error-handling r4 finding 1 (should-fix).
* Disposition: Fix. Closed in round 5.
* Correction: a `finally` path deletes only the planted file, including when the spawn or an assertion fails.
* Evidence: `coverageTarget` is `scripts/rust-branch-coverage.mjs` line 13. Round 5 plan, tests, and error-handling reported `P-8 CLOSED`.
* Lineage: P-6.
* Obligation: Staged-failure matrix for this evidence script.

### P-9

* Claim: the new removal and walk rows name the filesystem message and do not name the status of that staged call.
* Witnesses: error-handling r5 finding 1 (should-fix).
* Disposition: Fix. Open until the round that reviews the recorded status.
* Correction: each of those calls records a rejected promise, and the header names CLI exit 1 when that rejection escapes `main`. Every other staged call records its distinguishing message and the status of that same call.
* Evidence: `push-review-policy.md` §2 requires the message and the status. The survivor row and the `rustup` row already named a status; the removal rows did not.
* Lineage: P-3.
* Authority: the MANDATE cites push-review-policy §2, and that section requires both halves.
* Obligation: Staged-failure matrix for this evidence script.

### plan-r7.md

# Plan: Clear stale Rust coverage profiles before the instrumented run

Finding: f-20261002-09. Area: gate-scripts. Root: machine-dependent-measurement. Entry stays `build` after revalidation: the open question is which profiles count as this run, and the script is read as evidence, so the new refusal is part of the change. The planner does not annotate the ledger. The adopting session records the decision under `## Decided autonomously`.

Plan path: `tasks/plans/2026-10-02-stale-profraw.md`.

## Goal

`pnpm test:coverage:backend` merges only `.profraw` files produced by the run that just finished. Profiles left under `src-tauri/target/llvm-cov-target` by an earlier run are removed before `cargo llvm-cov` starts. If any regular-file `.profraw` the merger would see is still there after that removal, the script throws and does not start Cargo. The script's failure paths, including the new refusal, are staged in this run. Baselines, floors, receipt invalidation, and the CI cache key stay as they are.

## MANDATE

Verbatim from `tasks/findings.md`, f-20261002-09. Fixed across every round.

* **ID:** f-20261002-09 · **Status:** open · **Area:** gate-scripts · **Root:** machine-dependent-measurement · **Entry:** build · **Blocked:** none
* **Where:** `scripts/rust-branch-coverage.mjs` (`coverageTarget = src-tauri/target/llvm-cov-target`; after `cargo +nightly llvm-cov … --no-report` it merges `filesBelow(coverageTarget, path.endsWith(".profraw"))` with `llvm-profdata merge -sparse`), used by `pnpm test:coverage:backend` and the receipt-backed `backend-coverage` gate.
* **Defect:** nothing removes profiles from earlier runs. On atlas on 2026-10-02 the directory held 1 517 `.profraw` files with binary signatures dating back to 2026-08-29. Every unchanged function (same name and structural hash) accumulates counts from all of them, so code that the current tests no longer execute stays "covered". Measured: on tree `04f43c1b` the local `pnpm coverage:backend:check` passed while CI (fresh checkout) failed `filesystem-native-boundaries functions regressed: 359/673, baseline 340/634`; the 8 records covered locally but not on CI were all one instance chain that the current test never runs. After deleting every `.profraw` below `llvm-cov-target` and rerunning, the local result reproduced CI exactly (359/673, red).
* **Why it matters:** the backend ratchet's local green — the push gate — can be inflated by history and disagree with CI, which is the next reader's first suspicion of "machine dependence" (`CLAUDE.md`, `f-20260829-01`) when it is in fact stale input. A push can pass every local gate and turn CI red.
* **Open question:** clear `.profraw` files under `coverageTarget` before the run (and fail if any survive), or merge only the profiles whose binary signature matches the binary just built; plus the staged-failure matrix row for the new refusal (push-review-policy §2, the script is read as evidence).
* **Found by:** Stockfish 19 upgrade build, CI red after push, 2026-10-02 (orchestrator measurement above).

## Threat model and non-goals

Frozen with the MANDATE.

Accidental input is the real case: a developer or a previous local gate leaves `.profraw` files under `coverageTarget`, including files in subdirectories and files whose `%m` binary id still matches the current test binary. The script must not treat those counts as this run. CI's fresh checkout is the environment that already fails closed; this change makes the local gate fail the same way.

A second coverage process that creates a `.profraw` after the emptiness check is a named known limit under Risks. It is the same hazard the pre-change merger already has, and `d-20260930-01` already runs `rust-test` on a different target directory. This plan adds no lock.

Adversarial input (a process that replaces profiles between the check and the merge, or a symlink farm) is out of scope. The clear uses the same directory walk the merger already uses.

Non-goals: changing what the compiler emits, which sources are exported, the numeric baselines, the area floors, receipt invalidation, the GitHub Actions cache key, or the type-erasure already landed for f-20261002-10.

## Traced premises

Locate citations. Obligations below do not repeat line numbers.

* `scripts/rust-branch-coverage.mjs` sets `coverageTarget` to `src-tauri/target/llvm-cov-target` and, in `main`, runs `cargo +<toolchain> llvm-cov --manifest-path <src-tauri/Cargo.toml> --bin chessfable --locked --branch --no-report` before any profile walk. It then merges every path `filesBelow(coverageTarget, path.endsWith(".profraw"))` returns. An empty list throws `Rust coverage produced no raw profiles`. `main` is not exported. The module runs `main` only when `isEntrypoint` matches, so a test can import the module without starting Cargo.
* `scripts/files-below.mjs` recurses only when `entry.isDirectory()` and returns a path only when `entry.isFile()` and the predicate matches. Symlinks are neither, so they are not followed and a symlink whose name ends in `.profraw` is not returned.
* Probe 1 on this worktree: `coverageTarget` was absent (`PROFILE_DIRECTORY_ABSENT`). `filesBelow` on a missing directory rejects with the `readdir` error. A first run must not fail because the directory does not exist yet.
* Orchestrator measurement, cargo-llvm-cov tag v0.8.7, fetched 2026-10-02 from `https://raw.githubusercontent.com/taiki-e/cargo-llvm-cov/v0.8.7/src/cli.rs` line 1590: `clean.no_clean |= report.no_report | no_run`. The comment at lines 1589-1590 states that `--no-report` and `--no-run` imply `--no-clean`. `src/clean.rs` `clean_profraw_files` globs `target_dir/*.profraw` only (not recursive) and `clean_partial` returns immediately when `no_clean` is set, before that glob. `src/main.rs` `set_env` sets `LLVM_PROFILE_FILE` to `target_dir.join("{workspace}-%p-%m.profraw")` for a non-nextest run (`%p` pid, `%m` binary id). Local `cargo llvm-cov --version` is 0.8.7 (probe 1). `cargo llvm-cov clean --help` documents `--profraw-only`. The probe's local crate path `cargo-llvm-cov-0.8.7` was not on disk; these citations are the tag, not that path.
* `package.json` script `test:coverage:backend` is `node scripts/ensure-output-directory.mjs backend-coverage && node scripts/rust-branch-coverage.mjs`. `coverage:backend:check` reads `backend-coverage/lcov.info`. `ensure-output-directory.mjs` creates `backend-coverage/` and does not clear `llvm-cov-target`.
* `scripts/gate-receipt.mjs` records `backend-coverage` as `pnpm test:coverage:backend && pnpm coverage:backend:check`. A green receipt can skip the script while ignored `.profraw` files remain. Those files affect only a run that executes the script.
* `scripts/run-push-gates.mjs` selects the `rust-coverage` lane (`pnpm gate:ensure backend-coverage`) from the `--rust` flag, not from changed paths. `hasCoverageInputsChanged` keys off `src-tauri/src`, `backend-coverage-areas.json`, and `backend-coverage-baselines.json`. A scripts-only diff does not select the lane. `pnpm gates:push` without `--rust` does not run it.
* `.github/workflows/test.yml` restores `src-tauri -> target` with Swatinem/rust-cache and then runs `pnpm test:coverage:backend` and `pnpm coverage:backend:check`. Whether that cache restores `.profraw` files was not proven. Delete-before still removes them if it does. The cache key is not this change.
* `scripts/coverage-report.mjs` carries the staged-failure matrix pattern: the header enumerates paths, and `scripts/coverage-report-tests.mjs` calls exported functions directly. The header states that an exported-function call is a real caller. `pnpm coverage:report:test` runs `node --test scripts/coverage-report-tests.mjs`. That file is the only importer of `rust-branch-coverage.mjs` (probe 2).
* Probe 2: `rust-branch-coverage.mjs` has no header matrix. Explicit throw sites without a staged row are at the `run` helper, the metadata refusal, the export crash and export-status throws, the empty-profile throw, the missing-executable throw, the empty-source throw, the empty-export throw, and the no-branch-data throw. Only the metadata refusal and the per-source crash diagnostic have direct unit assertions today. Inherited throws are not evidence for this change.
* `d-20260922-08`: `scopeSignature` guards what is measured. Deleting profiles changes hit counts, not the signature.
* `d-20260928-01`: test-only exclusion stays in the gate. The exporter's LCOV stays raw compiler output. `d-20260902-02` is superseded on that point.
* `d-20260930-01`: `rust-test` and `rust-coverage` stay concurrent and use different target directories (`llvm-cov-target` versus the default). No Cargo `config.toml` target-dir override was found.
* Push skill Skip catalog: do not rebaseline coverage to clear a ratchet. f-20261002-10 is already handled by type-erasing the validator. f-20260829-01 was a missing recursive-delete test, and its closing note says that root does not survive for the backend half. This finding is stale input under the same root name, not that defect.

## Approach

### Clear before the instrumented run

Quotes the MANDATE: "clear `.profraw` files under `coverageTarget` before the run".

Before `cargo llvm-cov`, remove every regular-file `.profraw` the merger would see.

* The walk is the same `filesBelow` walk the merger uses, so a nested regular file is removed and a symlink is not followed.
* `ENOENT` is an absent coverage root only. When the coverage root itself is missing, clearing returns, so a first run succeeds. When a descendant raises `ENOENT`, or the walk fails any other way, the error propagates unchanged and does not start Cargo. `filesBelow` calls `readdir` at every directory depth, so a nested failure rejects the whole walk.
* Each returned path is removed. The first removal error propagates unchanged, with the filesystem error's own message. Nothing is swallowed. Non-`.profraw` files and the directory itself stay, so incremental build artefacts under `llvm-cov-target` stay.
* This step does not call `cargo llvm-cov clean`.

The production path is one exported orchestration function that `main` calls and that tests call with scratch directories and a fake command runner. `main` passes no arguments; the defaults are today's paths and today's runners. There is no production environment variable. The phase names the exports. Private branch structure inside the function stays with the executor.

Verification level: a temporary directory. Plant a nested `.profraw`, a non-`.profraw` sibling, and, where creating a symlink succeeds, a symlink to a directory that contains a `.profraw`. After the clear, the nested profile is gone, the sibling remains, and the profile behind the symlink remains. A missing coverage root resolves, and the orchestration still reaches `cargo llvm-cov`. A root that exists, with a descendant the walk cannot read, rejects and does not start Cargo. `CR-1` covers the platform where creating the symlink is refused.

### Refuse if any raw profile survives

Quotes the MANDATE: "and fail if any survive".

Immediately after the clear, and before `cargo llvm-cov`, walk again. A non-empty result throws `new Error("Rust coverage left stale raw profiles: " + paths)`. `paths` is the absolute paths sorted lexicographically and joined with `", "`. The message is distinct from `Rust coverage produced no raw profiles`. `ENOENT` on this walk uses the same rule as the clear: it returns only when the coverage root itself is missing. Any other walk error propagates. The throw does not delete and does not start Cargo.

Verification level: the survivor proof calls only `runBranchCoverage`. Its `listProfiles` option, which defaults to the `filesBelow` walk, returns no profiles on the clear's walk and one absolute path on the next walk. The call rejects with a message that starts with `Rust coverage left stale raw profiles:` and contains that path, and the fake runner is not asked to run `cargo`. Removing the refusal walk from `runBranchCoverage` turns this test red. A direct call to the refusal export may stage that function's own row; it does not satisfy this proof. A second test plants profiles, uses the default walk so the clear removes them, and asserts the runner's `cargo` `llvm-cov` invocation happens only after the directory has no `.profraw`. A test reads `scripts/rust-branch-coverage.mjs` and fails if `main` does not call `runBranchCoverage`.

### Staged-failure matrix for this evidence script

Quotes the MANDATE: "plus the staged-failure matrix row for the new refusal (push-review-policy §2, the script is read as evidence)".

`push-review-policy.md` §2, the section the finding names, says the run that changes an evidence artefact owns its matrix, and an inherited gap in the same area is built in this run rather than left as a licence. This change edits `scripts/rust-branch-coverage.mjs`, and `pnpm coverage:backend:check` reads that run's result as evidence. The header matrix follows `scripts/coverage-report.mjs`: every failure path, the distinguishing message, the status of that same run, and whether the row is staged or argued.

* One row is the survivor refusal, message `Rust coverage left stale raw profiles:`, staged by the scratch-directory call above. The recorded status for that staged call is a rejected promise. The header states that `main`'s CLI exit, when this throw escapes the top-level `await`, is Node's exit 1.
* Removal and walk failures that this change adds (the clear's removal error, and a walk error other than the coverage root's own `ENOENT`) are staged on a scratch directory. A mode that makes removal fail, and a directory that cannot be read, are enough. Their messages are the filesystem errors Node raises. The recorded status for each staged call is a rejected promise. The header states that the CLI exit, when that rejection escapes the top-level `await`, is Node's exit 1, described from that rejection and not from a second spawn. They get their own rows because those messages are not the survivor message.
* Every other failure path in the file after the edit is staged too, through the exported orchestration and the helpers it already exports (`coverageTools`, `exportLcovOrDiagnose`), using scratch directories and a fake runner. Each staged call records the message that distinguishes that path and the status of that same call. `coverageTools` and `exportLcovOrDiagnose` throw synchronously, and the test records that throw, as the existing assertions for those helpers already do. `runBranchCoverage` is async, so a throw from it is a rejected promise. A process row records the exit status the header names. Probe 2's list is the starting enumeration, not the matrix: the executor re-reads the edited file and accounts for each path. Paths that already have a direct assertion are staged rows, not gaps.
* Tool resolution stays before any profile deletion. One staged spawn of the entrypoint uses a scratch `PATH` on which `rustup` cannot run. Before the spawn, the test plants one `.profraw` under `coverageTarget` (creating that directory if it is absent) and records the set of `.profraw` paths. The spawn records the tool-resolution message and exit status 1. The set of `.profraw` paths is unchanged, which fails if the clear ran. A `finally` path deletes only the file it planted, including when the spawn or an assertion fails, so a failed test does not leave that profile in `coverageTarget`. A spawn that would reach the clear or Cargo is not staged: past tool resolution the entrypoint binds the real `coverageTarget` and would delete live profiles or start Cargo. The header argues those spawns for that reason. The survivor refusal's process exit is the same uncaught rejection, described from the orchestration test, not from a second spawn.

### Proof the adopting session runs

The phase proof is two commands, in this order:

1. `pnpm coverage:report:test`
2. `pnpm gate:ensure backend-coverage`

Command 2 is required even though a scripts-only diff does not select `rust-coverage` and `pnpm gates:push` without `--rust` skips it. The planner does not start either command. The adopting session also runs `pnpm checks:pre-review` before cumulative diff review, because the push skill's pre-review block formats and lints these `.mjs` files. That block does not replace command 2.

No browser check. The change is not a rendered surface.

## Decisions and trade-offs

Chosen mechanism: clear, then refuse. Rejected: merge only profiles whose `%m` matches the binary just built. A cold run can emit a build-script profile with a different `%m` in the same invocation (cargo-llvm-cov 0.8.7 `set_env`), and a stale file whose `%m` still matches the current test binary is exactly the inflation the finding measured. A filter would drop the fresh extra profile and keep the stale one.

Rejected: `cargo llvm-cov clean --profraw-only` as the only clear. Its glob is `target_dir/*.profraw`. The merger is recursive. Nested profiles would survive and be merged.

Rejected: dropping `--no-report` so cargo-llvm-cov's automatic clean runs. That path also runs `clean_partial`, which cargo-cleans the measured crates, and it generates cargo-llvm-cov's own report. This repository exports LCOV itself because `--branch` segfaults (llvm/llvm-project#119558), which the script already handles. `--no-report` stays.

Rejected: a new lock around the coverage target. `d-20260930-01` already separates `rust-test` onto another target directory. A second writer of `llvm-cov-target` after the assert is the known limit below, not a new mechanism.

## Risks / open questions

Known limit, named here, not a new lock: a second process that writes a `.profraw` under `coverageTarget` after the survivor check returns can still be merged. The pre-change script has the same window, with no preceding clear. No Cargo target-dir override puts `rust-test` on `llvm-cov-target`.

No open product question. The mechanism is the technical choice recorded under `## Decided autonomously`.

## Not part of this task

* `backend-coverage-baselines.json`, `minimumCoverage` in `backend-coverage-areas.json`, and any re-record of `scopeSignature`.
* Receipt invalidation in `scripts/gate-receipt.mjs`. A skipped run does not merge stale profiles.
* The GitHub Actions rust-cache key and `scripts/run-push-gates.mjs` lane selection.
* f-20261002-10 (handled) and f-20261002-08.
* `docs/coverage.md`, unless a sentence there claims the profile directory is already cleared. It does not, as read in locate.
* A lock, a watcher, or a production environment variable for the profile directory.

## Phases

One phase. Area: gate-scripts. No auth, persistence, concurrency control, or API contract. Executor: Codex write, role `normal` (these paths are not in the push skill's sensitive globs).

Files: `scripts/rust-branch-coverage.mjs`, `scripts/coverage-report-tests.mjs`. Read `scripts/files-below.mjs` and `scripts/coverage-report.mjs`. Do not edit them.

Implements Clear before the instrumented run, Refuse if any raw profile survives, and Staged-failure matrix for this evidence script.

Spelling this phase uses, so the tests and the header name one thing:

* `clearStaleRawProfiles(directory)` removes the regular-file profiles.
* `assertNoStaleRawProfiles(directory)` throws the survivor message.
* `runBranchCoverage(options)` resolves the coverage tools, then performs the clear, the assert, then the existing Cargo, merge, and export steps. Omitted options are today's paths, the current `run` / `attempt` runners, and the `filesBelow` walk (`listProfiles`). `main` is the no-argument call.

Removal is `unlink` of each path the walk returned. Do not follow symlinks. Do not add an environment variable.

PROOF:

```bash
pnpm coverage:report:test
pnpm gate:ensure backend-coverage
```

The planner does not run these. The adopting session runs both, and runs `pnpm checks:pre-review` before cumulative diff review.

## Decided autonomously

Questioning is skipped because the launch says `full auto`. The adopting session records each entry with `./scripts/findings.py record-decision`. The planner does not.

### Which profiles count as this run?

* **Question:** Clear `.profraw` files under `coverageTarget` before the run and fail if any survive, or merge only the profiles whose binary signature matches the binary just built?
* **Chosen:** Clear every regular-file `.profraw` that `filesBelow(coverageTarget)` would return, then throw `Rust coverage left stale raw profiles:` if any remain, before `cargo llvm-cov`. A missing directory is success. Symlinks are not followed.
* **Rejected:** A `%m` filter. `cargo llvm-cov clean --profraw-only` as the only clear. Dropping `--no-report`.
* **Reason:** cargo-llvm-cov 0.8.7 sets `no_clean` when `--no-report` is passed, and its own profraw clean is a non-recursive glob while this script merges recursively. A binary-id filter drops a fresh build-script profile from the same invocation and keeps a stale file whose `%m` still matches the current test binary. Reversal path: replace the clear with a filter that keeps every profile written by this invocation, including a different `%m`, and still drops a stale file with the current `%m`.

### What does the matrix cover?

* **Question:** Stage only the new survivor refusal, or every failure path of `rust-branch-coverage.mjs`?
* **Chosen:** The whole matrix. The survivor refusal, the new removal and walk failures, and every other path in the edited file are staged through the exports against scratch inputs. One pre-clear entrypoint spawn, the `rustup` failure, is staged after planting one `.profraw` and asserting that path set is unchanged. A `finally` path deletes only that planted file, including when the spawn or an assertion fails. A spawn that reaches the clear or Cargo stays argued because it binds the live coverage tree.
* **Rejected:** Listing pre-existing throws as inherited and not staging them. Round 1's first draft chose that, and it does not survive `push-review-policy.md` §2's rule that the run which changes an evidence artefact builds the matrix in this run. The finding cites that section.
* **Reason:** `pnpm coverage:backend:check` reads this script's result as evidence. A header that names unstaged paths does not make those paths evidence. Reversal path: a later decision that the gate stops treating this script's exit as evidence.

### Does the adopting session run the coverage gate when path selection would skip it?

* **Question:** Is `pnpm coverage:report:test` enough proof, given `gates:push` will not select `backend-coverage` from a scripts-only diff?
* **Chosen:** The phase proof is `pnpm coverage:report:test` and then `pnpm gate:ensure backend-coverage`.
* **Rejected:** Relying on path selection or on `pnpm gates:push` without `--rust`.
* **Reason:** The artefact is the gate. The unit test does not execute `main` or Cargo. Reversal path: teach lane selection to notice this script, which is a different change and is not this mandate.

## Carried to diff review

* CR-1 — Symlink fixture on a platform that refuses `symlink` with `EPERM`. The non-follow assertion runs where creating a symlink in a temporary directory succeeds. On `EPERM`, skip only that assertion; the nested-profile and sibling-file assertions still run. Do not add a Windows or macOS CI job. The contract gate that runs `pnpm coverage:report:test` is the Ubuntu `test` job (`.github/workflows/test.yml`).

## Reviews

Append-only. Raw reports stay in the lens artefacts. This section is the lookup record.

Round 1 wall time is the leaf span recorded in `plan-meta.json`. 12 plan-capable lenses. Adopted P-1, P-2, P-3, P-4. Carried CR-1. No skips.

Round 2 closure: plan, tests, error-handling, minimalism, correctness. P-2, P-3, P-4 closed by their witnesses. P-1 not closed. Adopted the P-1 tightening and P-6.

Round 3 closure: plan, tests, error-handling, correctness. P-1 closed by plan and tests. P-6 not closed by tests. Adopted the planted-profile assertion and this record (P-7).

Round 4 closure: plan, tests, error-handling. P-6 closed by tests, plan, and error-handling. P-7 closed by plan. Adopted P-8: the planted file is removed on a `finally` path when the spawn or an assertion fails.

Round 5 closure: plan, tests, error-handling. P-8 closed by all three. Adopted P-9: each new removal and walk row records a rejected promise, and every other staged call records its message and status.

Round 6 closure: plan, tests, error-handling. P-9 not closed by error-handling. Adopted the synchronous-throw status, and adopted P-10: `ENOENT` means the coverage root is missing, not a descendant. The tests late observation, that a missing root still reaches Cargo, is the success half of P-10.

### P-1

* Claim: a direct call to the refusal helper stays green if `main` or the orchestration omits the clear and the refusal, and the coverage gate does not catch that omission.
* Witnesses: plan r1 finding 1 (blocker), tests r1 finding 1 (blocker), plan r2 finding 1 (blocker, NOT CLOSED), tests r2 finding 1 (blocker, NOT CLOSED).
* Disposition: Fix. Closed in round 3.
* Correction: the survivor proof calls only `runBranchCoverage`. `listProfiles` returns no profiles on the clear's walk and one path on the next walk. Removing the refusal walk makes the fake runner reach Cargo and the test fails.
* Evidence: `package.json` `coverage:backend:check` reads `lcov.info` only. Round 3 plan and tests both reported `P-1 CLOSED` on that sentence.
* Authority: MANDATE "before the run" and "fail if any survive". The proof has to go red when that production order is removed.
* Obligation: Refuse if any raw profile survives.

### P-2

* Claim: the approach prescribed helper signatures, `unlink`, and fixture steps that are executor choices.
* Witnesses: plan r1 finding 2 (should-fix).
* Disposition: Fix. Closed in round 2.
* Correction: the approach states behavior. The phase names `clearStaleRawProfiles`, `assertNoStaleRawProfiles`, `runBranchCoverage`, and `unlink`.
* Evidence: plan round 2 reported `P-2 CLOSED`.
* Obligation: Clear before the instrumented run.

### P-3

* Claim: a removal or walk error introduced by the clear is a new stageable path, not an inherited row.
* Witnesses: error-handling r1 finding 1 (should-fix), tests r1 finding 2 (should-fix, the new-path half).
* Disposition: Fix. Closed in round 2.
* Correction: scratch-directory rows for the removal failure and for a non-`ENOENT` walk failure, each with its own filesystem message.
* Evidence: error-handling and tests round 2 reported `P-3 CLOSED`.
* Authority: MANDATE cites push-review-policy §2. A path this change adds is stageable on a scratch directory.
* Obligation: Staged-failure matrix for this evidence script.

### P-4

* Claim: marking pre-existing throws inherited, without staging or an allowed argument, does not satisfy §2 for a script this change edits.
* Witnesses: tests r1 finding 2 (should-fix, the inherited-path half).
* Disposition: Fix. Closed in round 2.
* Correction: stage every remaining failure path through the exports. Argue only spawns that reach the clear or Cargo.
* Evidence: tests round 2 reported `P-4 CLOSED`. `push-review-policy.md` §2 fifth condition: the run that changes an evidence artefact builds the matrix in this run.
* Authority: the MANDATE's citation of push-review-policy §2, and that section's words "same area, build the matrix in this run".
* Obligation: Staged-failure matrix for this evidence script.

### P-5

* Claim: a symlink fixture can throw `EPERM` on Windows, and the proof command is not a Windows CI job.
* Witnesses: platform-semantics r1 finding 1 (should-fix).
* Disposition: Fix. `closed_round` carried, id CR-1.
* Correction: see `## Carried to diff review`. The Ubuntu contract gate is the runtime that runs this test. No new CI job.
* Evidence: `.github/workflows/test.yml` job `test` runs `pnpm gates:contract:check` on `ubuntu-latest`. The Windows and macOS jobs do not run `coverage-report-tests.mjs`.

### P-6

* Claim: the entrypoint's process exit can be staged for the tool-resolution failure without deleting profiles, because that failure happens before the clear.
* Witnesses: error-handling r2 finding 1 (should-fix). tests r3 finding 1 (should-fix, NOT CLOSED): a missing profile directory does not prove the clear did not run.
* Disposition: Fix. Closed in round 4.
* Correction: plant one `.profraw`, assert the path set is unchanged, delete only that file.
* Evidence: current `main` calls `coverageTools` before any profile walk (`scripts/rust-branch-coverage.mjs` line 122, profile walk at line 139). Round 4 plan, tests, and error-handling reported `P-6 CLOSED`.
* Authority: push-review-policy §2, record the exit status of a stageable path. The planted file is restored by the test.
* Obligation: Staged-failure matrix for this evidence script.

### P-7

* Claim: the plan file had no `## Reviews` record for lenses to look up.
* Witnesses: plan r3 finding 1 (blocker).
* Disposition: Fix. Closed in round 4.
* Correction: this section.
* Evidence: round 4 plan reported `P-7 CLOSED` on this heading.
* Obligation: the review record, not a product obligation.

### P-8

* Claim: if the planted-profile spawn or its assertion fails first, the delete does not run and the planted `.profraw` stays in the real coverage target.
* Witnesses: error-handling r4 finding 1 (should-fix).
* Disposition: Fix. Closed in round 5.
* Correction: a `finally` path deletes only the planted file, including when the spawn or an assertion fails.
* Evidence: `coverageTarget` is `scripts/rust-branch-coverage.mjs` line 13. Round 5 plan, tests, and error-handling reported `P-8 CLOSED`.
* Lineage: P-6.
* Obligation: Staged-failure matrix for this evidence script.

### P-9

* Claim: the new removal and walk rows name the filesystem message and do not name the status of that staged call.
* Witnesses: error-handling r5 finding 1 (should-fix). error-handling r6 finding 1 (should-fix, NOT CLOSED).
* Disposition: Fix. Open until the round that reviews the synchronous-throw status.
* Correction: removal and walk rows record a rejected promise, because those calls go through async `runBranchCoverage`. `coverageTools` and `exportLcovOrDiagnose` throw synchronously, and the test records that throw. A process row records the exit status the header names.
* Evidence: `push-review-policy.md` §2 requires the message and the status. `scripts/coverage-report-tests.mjs` lines 3094 and 3165 use `assert.throws` on those two helpers. Round 6 error-handling reported `P-9 NOT CLOSED`.
* Lineage: P-3.
* Authority: the MANDATE cites push-review-policy §2, and that section requires both halves.
* Obligation: Staged-failure matrix for this evidence script.

### P-10

* Claim: treating every `ENOENT` from the recursive walk as an absent coverage root swallows a missing descendant and can still merge a sibling stale profile.
* Witnesses: error-handling r6 finding 2 (blocker). tests r6 finding 1 (should-fix, the missing-root half, filed under late observations).
* Disposition: Fix. Open until the round that reviews the root-only `ENOENT` rule.
* Correction: `ENOENT` is success only when the coverage root itself is missing. A descendant `ENOENT` propagates and does not start Cargo. A missing root still reaches `cargo llvm-cov`.
* Evidence: `scripts/files-below.mjs` line 5 calls `readdir` at every directory depth. A nested `ENOENT` rejects the whole walk, so the plan cannot read that rejection as an empty root.
* Authority: MANDATE "fail if any survive" and "before the run". A swallowed descendant error starts Cargo and the later merge can include a profile the walk did not finish listing.
* Obligation: Clear before the instrumented run.

### plan-r8.md

# Plan: Clear stale Rust coverage profiles before the instrumented run

Finding: f-20261002-09. Area: gate-scripts. Root: machine-dependent-measurement. Entry stays `build` after revalidation: the open question is which profiles count as this run, and the script is read as evidence, so the new refusal is part of the change. The planner does not annotate the ledger. The adopting session records the decision under `## Decided autonomously`.

Plan path: `tasks/plans/2026-10-02-stale-profraw.md`.

## Goal

`pnpm test:coverage:backend` merges only `.profraw` files produced by the run that just finished. Profiles left under `src-tauri/target/llvm-cov-target` by an earlier run are removed before `cargo llvm-cov` starts. If any regular-file `.profraw` the merger would see is still there after that removal, the script throws and does not start Cargo. The script's failure paths, including the new refusal, are staged in this run. Baselines, floors, receipt invalidation, and the CI cache key stay as they are.

## MANDATE

Verbatim from `tasks/findings.md`, f-20261002-09. Fixed across every round.

* **ID:** f-20261002-09 · **Status:** open · **Area:** gate-scripts · **Root:** machine-dependent-measurement · **Entry:** build · **Blocked:** none
* **Where:** `scripts/rust-branch-coverage.mjs` (`coverageTarget = src-tauri/target/llvm-cov-target`; after `cargo +nightly llvm-cov … --no-report` it merges `filesBelow(coverageTarget, path.endsWith(".profraw"))` with `llvm-profdata merge -sparse`), used by `pnpm test:coverage:backend` and the receipt-backed `backend-coverage` gate.
* **Defect:** nothing removes profiles from earlier runs. On atlas on 2026-10-02 the directory held 1 517 `.profraw` files with binary signatures dating back to 2026-08-29. Every unchanged function (same name and structural hash) accumulates counts from all of them, so code that the current tests no longer execute stays "covered". Measured: on tree `04f43c1b` the local `pnpm coverage:backend:check` passed while CI (fresh checkout) failed `filesystem-native-boundaries functions regressed: 359/673, baseline 340/634`; the 8 records covered locally but not on CI were all one instance chain that the current test never runs. After deleting every `.profraw` below `llvm-cov-target` and rerunning, the local result reproduced CI exactly (359/673, red).
* **Why it matters:** the backend ratchet's local green — the push gate — can be inflated by history and disagree with CI, which is the next reader's first suspicion of "machine dependence" (`CLAUDE.md`, `f-20260829-01`) when it is in fact stale input. A push can pass every local gate and turn CI red.
* **Open question:** clear `.profraw` files under `coverageTarget` before the run (and fail if any survive), or merge only the profiles whose binary signature matches the binary just built; plus the staged-failure matrix row for the new refusal (push-review-policy §2, the script is read as evidence).
* **Found by:** Stockfish 19 upgrade build, CI red after push, 2026-10-02 (orchestrator measurement above).

## Threat model and non-goals

Frozen with the MANDATE.

Accidental input is the real case: a developer or a previous local gate leaves `.profraw` files under `coverageTarget`, including files in subdirectories and files whose `%m` binary id still matches the current test binary. The script must not treat those counts as this run. CI's fresh checkout is the environment that already fails closed; this change makes the local gate fail the same way.

A second coverage process that creates a `.profraw` after the emptiness check is a named known limit under Risks. It is the same hazard the pre-change merger already has, and `d-20260930-01` already runs `rust-test` on a different target directory. This plan adds no lock.

Adversarial input (a process that replaces profiles between the check and the merge, or a symlink farm) is out of scope. The clear uses the same directory walk the merger already uses.

Non-goals: changing what the compiler emits, which sources are exported, the numeric baselines, the area floors, receipt invalidation, the GitHub Actions cache key, or the type-erasure already landed for f-20261002-10.

## Traced premises

Locate citations. Obligations below do not repeat line numbers.

* `scripts/rust-branch-coverage.mjs` sets `coverageTarget` to `src-tauri/target/llvm-cov-target` and, in `main`, runs `cargo +<toolchain> llvm-cov --manifest-path <src-tauri/Cargo.toml> --bin chessfable --locked --branch --no-report` before any profile walk. It then merges every path `filesBelow(coverageTarget, path.endsWith(".profraw"))` returns. An empty list throws `Rust coverage produced no raw profiles`. `main` is not exported. The module runs `main` only when `isEntrypoint` matches, so a test can import the module without starting Cargo.
* `scripts/files-below.mjs` recurses only when `entry.isDirectory()` and returns a path only when `entry.isFile()` and the predicate matches. Symlinks are neither, so they are not followed and a symlink whose name ends in `.profraw` is not returned.
* Probe 1 on this worktree: `coverageTarget` was absent (`PROFILE_DIRECTORY_ABSENT`). `filesBelow` on a missing directory rejects with the `readdir` error. A first run must not fail because the directory does not exist yet.
* Orchestrator measurement, cargo-llvm-cov tag v0.8.7, fetched 2026-10-02 from `https://raw.githubusercontent.com/taiki-e/cargo-llvm-cov/v0.8.7/src/cli.rs` line 1590: `clean.no_clean |= report.no_report | no_run`. The comment at lines 1589-1590 states that `--no-report` and `--no-run` imply `--no-clean`. `src/clean.rs` `clean_profraw_files` globs `target_dir/*.profraw` only (not recursive) and `clean_partial` returns immediately when `no_clean` is set, before that glob. `src/main.rs` `set_env` sets `LLVM_PROFILE_FILE` to `target_dir.join("{workspace}-%p-%m.profraw")` for a non-nextest run (`%p` pid, `%m` binary id). Local `cargo llvm-cov --version` is 0.8.7 (probe 1). `cargo llvm-cov clean --help` documents `--profraw-only`. The probe's local crate path `cargo-llvm-cov-0.8.7` was not on disk; these citations are the tag, not that path.
* `package.json` script `test:coverage:backend` is `node scripts/ensure-output-directory.mjs backend-coverage && node scripts/rust-branch-coverage.mjs`. `coverage:backend:check` reads `backend-coverage/lcov.info`. `ensure-output-directory.mjs` creates `backend-coverage/` and does not clear `llvm-cov-target`.
* `scripts/gate-receipt.mjs` records `backend-coverage` as `pnpm test:coverage:backend && pnpm coverage:backend:check`. A green receipt can skip the script while ignored `.profraw` files remain. Those files affect only a run that executes the script.
* `scripts/run-push-gates.mjs` selects the `rust-coverage` lane (`pnpm gate:ensure backend-coverage`) from the `--rust` flag, not from changed paths. `hasCoverageInputsChanged` keys off `src-tauri/src`, `backend-coverage-areas.json`, and `backend-coverage-baselines.json`. A scripts-only diff does not select the lane. `pnpm gates:push` without `--rust` does not run it.
* `.github/workflows/test.yml` restores `src-tauri -> target` with Swatinem/rust-cache and then runs `pnpm test:coverage:backend` and `pnpm coverage:backend:check`. Whether that cache restores `.profraw` files was not proven. Delete-before still removes them if it does. The cache key is not this change.
* `scripts/coverage-report.mjs` carries the staged-failure matrix pattern: the header enumerates paths, and `scripts/coverage-report-tests.mjs` calls exported functions directly. The header states that an exported-function call is a real caller. `pnpm coverage:report:test` runs `node --test scripts/coverage-report-tests.mjs`. That file is the only importer of `rust-branch-coverage.mjs` (probe 2).
* Probe 2: `rust-branch-coverage.mjs` has no header matrix. Explicit throw sites without a staged row are at the `run` helper, the metadata refusal, the export crash and export-status throws, the empty-profile throw, the missing-executable throw, the empty-source throw, the empty-export throw, and the no-branch-data throw. Only the metadata refusal and the per-source crash diagnostic have direct unit assertions today. Inherited throws are not evidence for this change.
* `d-20260922-08`: `scopeSignature` guards what is measured. Deleting profiles changes hit counts, not the signature.
* `d-20260928-01`: test-only exclusion stays in the gate. The exporter's LCOV stays raw compiler output. `d-20260902-02` is superseded on that point.
* `d-20260930-01`: `rust-test` and `rust-coverage` stay concurrent and use different target directories (`llvm-cov-target` versus the default). No Cargo `config.toml` target-dir override was found.
* Push skill Skip catalog: do not rebaseline coverage to clear a ratchet. f-20261002-10 is already handled by type-erasing the validator. f-20260829-01 was a missing recursive-delete test, and its closing note says that root does not survive for the backend half. This finding is stale input under the same root name, not that defect.

## Approach

### Clear before the instrumented run

Quotes the MANDATE: "clear `.profraw` files under `coverageTarget` before the run".

Before `cargo llvm-cov`, remove every regular-file `.profraw` the merger would see.

* The walk is the same `filesBelow` walk the merger uses, so a nested regular file is removed and a symlink is not followed.
* `ENOENT` is an absent coverage root only. When the coverage root itself is missing, clearing returns, so a first run succeeds. When a descendant raises `ENOENT`, or the walk fails any other way, the error propagates unchanged and does not start Cargo. `filesBelow` calls `readdir` at every directory depth, so a nested failure rejects the whole walk.
* Each returned path is removed. The first removal error propagates unchanged, with the filesystem error's own message. Nothing is swallowed. Non-`.profraw` files and the directory itself stay, so incremental build artefacts under `llvm-cov-target` stay.
* This step does not call `cargo llvm-cov clean`.

The production path is one exported orchestration function that `main` calls and that tests call with scratch directories and a fake command runner. `main` passes no arguments; the defaults are today's paths and today's runners. There is no production environment variable. The phase names the exports. Private branch structure inside the function stays with the executor.

Verification level: a temporary directory. Plant a nested `.profraw`, a non-`.profraw` sibling, and, where creating a symlink succeeds, a symlink to a directory that contains a `.profraw`. After the clear, the nested profile is gone, the sibling remains, and the profile behind the symlink remains. A missing coverage root resolves, and the orchestration still reaches `cargo llvm-cov`. A root that exists, with a nested directory whose `readdir` fails with `ENOENT`, rejects through `runBranchCoverage` on the clear walk and on the refusal walk, and does not start Cargo. A fixture whose error is `EACCES` does not satisfy that proof. `CR-1` covers the platform where creating the symlink is refused.

### Refuse if any raw profile survives

Quotes the MANDATE: "and fail if any survive".

Immediately after the clear, and before `cargo llvm-cov`, walk again. A non-empty result throws `new Error("Rust coverage left stale raw profiles: " + paths)`. `paths` is the absolute paths sorted lexicographically and joined with `", "`. The message is distinct from `Rust coverage produced no raw profiles`. `ENOENT` on this walk uses the same rule as the clear: it returns only when the coverage root itself is missing. Any other walk error propagates. The throw does not delete and does not start Cargo.

Verification level: the survivor proof calls only `runBranchCoverage`. Its `listProfiles` option, which defaults to the `filesBelow` walk, returns no profiles on the clear's walk and one absolute path on the next walk. The call rejects with a message that starts with `Rust coverage left stale raw profiles:` and contains that path, and the fake runner is not asked to run `cargo`. Removing the refusal walk from `runBranchCoverage` turns this test red. A direct call to the refusal export may stage that function's own row; it does not satisfy this proof. A second test plants profiles, uses the default walk so the clear removes them, and asserts the runner's `cargo` `llvm-cov` invocation happens only after the directory has no `.profraw`. A test reads `scripts/rust-branch-coverage.mjs` and fails if `main` does not call `runBranchCoverage`.

### Staged-failure matrix for this evidence script

Quotes the MANDATE: "plus the staged-failure matrix row for the new refusal (push-review-policy §2, the script is read as evidence)".

`push-review-policy.md` §2, the section the finding names, says the run that changes an evidence artefact owns its matrix, and an inherited gap in the same area is built in this run rather than left as a licence. This change edits `scripts/rust-branch-coverage.mjs`, and `pnpm coverage:backend:check` reads that run's result as evidence. The header matrix follows `scripts/coverage-report.mjs`: every failure path, the distinguishing message, the status of that same run, and whether the row is staged or argued.

* One row is the survivor refusal, message `Rust coverage left stale raw profiles:`, staged by the scratch-directory call above. The recorded status for that staged call is a rejected promise. The header states that `main`'s CLI exit, when this throw escapes the top-level `await`, is Node's exit 1.
* Removal and walk failures that this change adds (the clear's removal error, and a walk error other than the coverage root's own `ENOENT`) are staged on a scratch directory. A mode that makes removal fail, and a directory that cannot be read, are enough for those filesystem errors. The descendant `ENOENT` proof is the separate case in the clear's verification, not this unreadable-directory row. Their messages are the filesystem errors Node raises. The recorded status for each staged call is a rejected promise. The header states that the CLI exit, when that rejection escapes the top-level `await`, is Node's exit 1, described from that rejection and not from a second spawn. They get their own rows because those messages are not the survivor message.
* Every other failure path in the file after the edit is staged too, through the exported orchestration and the helpers it already exports (`coverageTools`, `exportLcovOrDiagnose`), using scratch directories and a fake runner. Each staged call records the message that distinguishes that path and the status of that same call. `coverageTools` and `exportLcovOrDiagnose` throw synchronously, and the test records that throw, as the existing assertions for those helpers already do. `runBranchCoverage` is async, so a throw from it is a rejected promise. A process row records the exit status the header names. Probe 2's list is the starting enumeration, not the matrix: the executor re-reads the edited file and accounts for each path. Paths that already have a direct assertion are staged rows, not gaps.
* Tool resolution stays before any profile deletion. One staged spawn of the entrypoint uses a scratch `PATH` on which `rustup` cannot run. Before the spawn, the test plants one `.profraw` under `coverageTarget` (creating that directory if it is absent) and records the set of `.profraw` paths. The spawn records the tool-resolution message and exit status 1. The set of `.profraw` paths is unchanged, which fails if the clear ran. A `finally` path deletes only the file it planted, including when the spawn or an assertion fails, so a failed test does not leave that profile in `coverageTarget`. A spawn that would reach the clear or Cargo is not staged: past tool resolution the entrypoint binds the real `coverageTarget` and would delete live profiles or start Cargo. The header argues those spawns for that reason. The survivor refusal's process exit is the same uncaught rejection, described from the orchestration test, not from a second spawn.

### Proof the adopting session runs

The phase proof is two commands, in this order:

1. `pnpm coverage:report:test`
2. `pnpm gate:ensure backend-coverage`

Command 2 is required even though a scripts-only diff does not select `rust-coverage` and `pnpm gates:push` without `--rust` skips it. The planner does not start either command. The adopting session also runs `pnpm checks:pre-review` before cumulative diff review, because the push skill's pre-review block formats and lints these `.mjs` files. That block does not replace command 2.

No browser check. The change is not a rendered surface.

## Decisions and trade-offs

Chosen mechanism: clear, then refuse. Rejected: merge only profiles whose `%m` matches the binary just built. A cold run can emit a build-script profile with a different `%m` in the same invocation (cargo-llvm-cov 0.8.7 `set_env`), and a stale file whose `%m` still matches the current test binary is exactly the inflation the finding measured. A filter would drop the fresh extra profile and keep the stale one.

Rejected: `cargo llvm-cov clean --profraw-only` as the only clear. Its glob is `target_dir/*.profraw`. The merger is recursive. Nested profiles would survive and be merged.

Rejected: dropping `--no-report` so cargo-llvm-cov's automatic clean runs. That path also runs `clean_partial`, which cargo-cleans the measured crates, and it generates cargo-llvm-cov's own report. This repository exports LCOV itself because `--branch` segfaults (llvm/llvm-project#119558), which the script already handles. `--no-report` stays.

Rejected: a new lock around the coverage target. `d-20260930-01` already separates `rust-test` onto another target directory. A second writer of `llvm-cov-target` after the assert is the known limit below, not a new mechanism.

## Risks / open questions

Known limit, named here, not a new lock: a second process that writes a `.profraw` under `coverageTarget` after the survivor check returns can still be merged. The pre-change script has the same window, with no preceding clear. No Cargo target-dir override puts `rust-test` on `llvm-cov-target`.

No open product question. The mechanism is the technical choice recorded under `## Decided autonomously`.

## Not part of this task

* `backend-coverage-baselines.json`, `minimumCoverage` in `backend-coverage-areas.json`, and any re-record of `scopeSignature`.
* Receipt invalidation in `scripts/gate-receipt.mjs`. A skipped run does not merge stale profiles.
* The GitHub Actions rust-cache key and `scripts/run-push-gates.mjs` lane selection.
* f-20261002-10 (handled) and f-20261002-08.
* `docs/coverage.md`, unless a sentence there claims the profile directory is already cleared. It does not, as read in locate.
* A lock, a watcher, or a production environment variable for the profile directory.

## Phases

One phase. Area: gate-scripts. No auth, persistence, concurrency control, or API contract. Executor: Codex write, role `normal` (these paths are not in the push skill's sensitive globs).

Files: `scripts/rust-branch-coverage.mjs`, `scripts/coverage-report-tests.mjs`. Read `scripts/files-below.mjs` and `scripts/coverage-report.mjs`. Do not edit them.

Implements Clear before the instrumented run, Refuse if any raw profile survives, and Staged-failure matrix for this evidence script.

Spelling this phase uses, so the tests and the header name one thing:

* `clearStaleRawProfiles(directory)` removes the regular-file profiles.
* `assertNoStaleRawProfiles(directory)` throws the survivor message.
* `runBranchCoverage(options)` resolves the coverage tools, then performs the clear, the assert, then the existing Cargo, merge, and export steps. Omitted options are today's paths, the current `run` / `attempt` runners, and the `filesBelow` walk (`listProfiles`). `main` is the no-argument call.

Removal is `unlink` of each path the walk returned. Do not follow symlinks. Do not add an environment variable.

PROOF:

```bash
pnpm coverage:report:test
pnpm gate:ensure backend-coverage
```

The planner does not run these. The adopting session runs both, and runs `pnpm checks:pre-review` before cumulative diff review.

## Decided autonomously

Questioning is skipped because the launch says `full auto`. The adopting session records each entry with `./scripts/findings.py record-decision`. The planner does not.

### Which profiles count as this run?

* **Question:** Clear `.profraw` files under `coverageTarget` before the run and fail if any survive, or merge only the profiles whose binary signature matches the binary just built?
* **Chosen:** Clear every regular-file `.profraw` that `filesBelow(coverageTarget)` would return, then throw `Rust coverage left stale raw profiles:` if any remain, before `cargo llvm-cov`. A missing directory is success. Symlinks are not followed.
* **Rejected:** A `%m` filter. `cargo llvm-cov clean --profraw-only` as the only clear. Dropping `--no-report`.
* **Reason:** cargo-llvm-cov 0.8.7 sets `no_clean` when `--no-report` is passed, and its own profraw clean is a non-recursive glob while this script merges recursively. A binary-id filter drops a fresh build-script profile from the same invocation and keeps a stale file whose `%m` still matches the current test binary. Reversal path: replace the clear with a filter that keeps every profile written by this invocation, including a different `%m`, and still drops a stale file with the current `%m`.

### What does the matrix cover?

* **Question:** Stage only the new survivor refusal, or every failure path of `rust-branch-coverage.mjs`?
* **Chosen:** The whole matrix. The survivor refusal, the new removal and walk failures, and every other path in the edited file are staged through the exports against scratch inputs. One pre-clear entrypoint spawn, the `rustup` failure, is staged after planting one `.profraw` and asserting that path set is unchanged. A `finally` path deletes only that planted file, including when the spawn or an assertion fails. A spawn that reaches the clear or Cargo stays argued because it binds the live coverage tree.
* **Rejected:** Listing pre-existing throws as inherited and not staging them. Round 1's first draft chose that, and it does not survive `push-review-policy.md` §2's rule that the run which changes an evidence artefact builds the matrix in this run. The finding cites that section.
* **Reason:** `pnpm coverage:backend:check` reads this script's result as evidence. A header that names unstaged paths does not make those paths evidence. Reversal path: a later decision that the gate stops treating this script's exit as evidence.

### Does the adopting session run the coverage gate when path selection would skip it?

* **Question:** Is `pnpm coverage:report:test` enough proof, given `gates:push` will not select `backend-coverage` from a scripts-only diff?
* **Chosen:** The phase proof is `pnpm coverage:report:test` and then `pnpm gate:ensure backend-coverage`.
* **Rejected:** Relying on path selection or on `pnpm gates:push` without `--rust`.
* **Reason:** The artefact is the gate. The unit test does not execute `main` or Cargo. Reversal path: teach lane selection to notice this script, which is a different change and is not this mandate.

## Carried to diff review

* CR-1 — Symlink fixture on a platform that refuses `symlink` with `EPERM`. The non-follow assertion runs where creating a symlink in a temporary directory succeeds. On `EPERM`, skip only that assertion; the nested-profile and sibling-file assertions still run. Do not add a Windows or macOS CI job. The contract gate that runs `pnpm coverage:report:test` is the Ubuntu `test` job (`.github/workflows/test.yml`).

## Reviews

Append-only. Raw reports stay in the lens artefacts. This section is the lookup record.

Round 1 wall time is the leaf span recorded in `plan-meta.json`. 12 plan-capable lenses. Adopted P-1, P-2, P-3, P-4. Carried CR-1. No skips.

Round 2 closure: plan, tests, error-handling, minimalism, correctness. P-2, P-3, P-4 closed by their witnesses. P-1 not closed. Adopted the P-1 tightening and P-6.

Round 3 closure: plan, tests, error-handling, correctness. P-1 closed by plan and tests. P-6 not closed by tests. Adopted the planted-profile assertion and this record (P-7).

Round 4 closure: plan, tests, error-handling. P-6 closed by tests, plan, and error-handling. P-7 closed by plan. Adopted P-8: the planted file is removed on a `finally` path when the spawn or an assertion fails.

Round 5 closure: plan, tests, error-handling. P-8 closed by all three. Adopted P-9: each new removal and walk row records a rejected promise, and every other staged call records its message and status.

Round 6 closure: plan, tests, error-handling. P-9 not closed by error-handling. Adopted the synchronous-throw status, and adopted P-10: `ENOENT` means the coverage root is missing, not a descendant. The tests late observation, that a missing root still reaches Cargo, is the success half of P-10.

Round 7 closure: plan, tests, error-handling. P-9 closed by all three. P-10 not closed: the proof said a descendant the walk cannot read, which can be `EACCES`. Adopted a descendant `readdir` `ENOENT` through `runBranchCoverage` on both pre-Cargo walks. An `EACCES` fixture does not satisfy that proof.

### P-1

* Claim: a direct call to the refusal helper stays green if `main` or the orchestration omits the clear and the refusal, and the coverage gate does not catch that omission.
* Witnesses: plan r1 finding 1 (blocker), tests r1 finding 1 (blocker), plan r2 finding 1 (blocker, NOT CLOSED), tests r2 finding 1 (blocker, NOT CLOSED).
* Disposition: Fix. Closed in round 3.
* Correction: the survivor proof calls only `runBranchCoverage`. `listProfiles` returns no profiles on the clear's walk and one path on the next walk. Removing the refusal walk makes the fake runner reach Cargo and the test fails.
* Evidence: `package.json` `coverage:backend:check` reads `lcov.info` only. Round 3 plan and tests both reported `P-1 CLOSED` on that sentence.
* Authority: MANDATE "before the run" and "fail if any survive". The proof has to go red when that production order is removed.
* Obligation: Refuse if any raw profile survives.

### P-2

* Claim: the approach prescribed helper signatures, `unlink`, and fixture steps that are executor choices.
* Witnesses: plan r1 finding 2 (should-fix).
* Disposition: Fix. Closed in round 2.
* Correction: the approach states behavior. The phase names `clearStaleRawProfiles`, `assertNoStaleRawProfiles`, `runBranchCoverage`, and `unlink`.
* Evidence: plan round 2 reported `P-2 CLOSED`.
* Obligation: Clear before the instrumented run.

### P-3

* Claim: a removal or walk error introduced by the clear is a new stageable path, not an inherited row.
* Witnesses: error-handling r1 finding 1 (should-fix), tests r1 finding 2 (should-fix, the new-path half).
* Disposition: Fix. Closed in round 2.
* Correction: scratch-directory rows for the removal failure and for a non-`ENOENT` walk failure, each with its own filesystem message.
* Evidence: error-handling and tests round 2 reported `P-3 CLOSED`.
* Authority: MANDATE cites push-review-policy §2. A path this change adds is stageable on a scratch directory.
* Obligation: Staged-failure matrix for this evidence script.

### P-4

* Claim: marking pre-existing throws inherited, without staging or an allowed argument, does not satisfy §2 for a script this change edits.
* Witnesses: tests r1 finding 2 (should-fix, the inherited-path half).
* Disposition: Fix. Closed in round 2.
* Correction: stage every remaining failure path through the exports. Argue only spawns that reach the clear or Cargo.
* Evidence: tests round 2 reported `P-4 CLOSED`. `push-review-policy.md` §2 fifth condition: the run that changes an evidence artefact builds the matrix in this run.
* Authority: the MANDATE's citation of push-review-policy §2, and that section's words "same area, build the matrix in this run".
* Obligation: Staged-failure matrix for this evidence script.

### P-5

* Claim: a symlink fixture can throw `EPERM` on Windows, and the proof command is not a Windows CI job.
* Witnesses: platform-semantics r1 finding 1 (should-fix).
* Disposition: Fix. `closed_round` carried, id CR-1.
* Correction: see `## Carried to diff review`. The Ubuntu contract gate is the runtime that runs this test. No new CI job.
* Evidence: `.github/workflows/test.yml` job `test` runs `pnpm gates:contract:check` on `ubuntu-latest`. The Windows and macOS jobs do not run `coverage-report-tests.mjs`.

### P-6

* Claim: the entrypoint's process exit can be staged for the tool-resolution failure without deleting profiles, because that failure happens before the clear.
* Witnesses: error-handling r2 finding 1 (should-fix). tests r3 finding 1 (should-fix, NOT CLOSED): a missing profile directory does not prove the clear did not run.
* Disposition: Fix. Closed in round 4.
* Correction: plant one `.profraw`, assert the path set is unchanged, delete only that file.
* Evidence: current `main` calls `coverageTools` before any profile walk (`scripts/rust-branch-coverage.mjs` line 122, profile walk at line 139). Round 4 plan, tests, and error-handling reported `P-6 CLOSED`.
* Authority: push-review-policy §2, record the exit status of a stageable path. The planted file is restored by the test.
* Obligation: Staged-failure matrix for this evidence script.

### P-7

* Claim: the plan file had no `## Reviews` record for lenses to look up.
* Witnesses: plan r3 finding 1 (blocker).
* Disposition: Fix. Closed in round 4.
* Correction: this section.
* Evidence: round 4 plan reported `P-7 CLOSED` on this heading.
* Obligation: the review record, not a product obligation.

### P-8

* Claim: if the planted-profile spawn or its assertion fails first, the delete does not run and the planted `.profraw` stays in the real coverage target.
* Witnesses: error-handling r4 finding 1 (should-fix).
* Disposition: Fix. Closed in round 5.
* Correction: a `finally` path deletes only the planted file, including when the spawn or an assertion fails.
* Evidence: `coverageTarget` is `scripts/rust-branch-coverage.mjs` line 13. Round 5 plan, tests, and error-handling reported `P-8 CLOSED`.
* Lineage: P-6.
* Obligation: Staged-failure matrix for this evidence script.

### P-9

* Claim: the new removal and walk rows name the filesystem message and do not name the status of that staged call.
* Witnesses: error-handling r5 finding 1 (should-fix). error-handling r6 finding 1 (should-fix, NOT CLOSED).
* Disposition: Fix. Open until the round that reviews the synchronous-throw status.
* Correction: removal and walk rows record a rejected promise, because those calls go through async `runBranchCoverage`. `coverageTools` and `exportLcovOrDiagnose` throw synchronously, and the test records that throw. A process row records the exit status the header names.
* Evidence: `push-review-policy.md` §2 requires the message and the status. `scripts/coverage-report-tests.mjs` lines 3094 and 3165 use `assert.throws` on those two helpers. Round 6 error-handling reported `P-9 NOT CLOSED`.
* Lineage: P-3.
* Authority: the MANDATE cites push-review-policy §2, and that section requires both halves.
* Obligation: Staged-failure matrix for this evidence script.

### P-10

* Claim: treating every `ENOENT` from the recursive walk as an absent coverage root swallows a missing descendant and can still merge a sibling stale profile.
* Witnesses: error-handling r6 finding 2 (blocker). tests r6 finding 1 (should-fix, the missing-root half). plan r7 finding 1 (blocker, NOT CLOSED). tests r7 findings 1 and 2 (blocker, NOT CLOSED). error-handling r7 findings 1 and 2 (blocker, NOT CLOSED).
* Disposition: Fix. Open until the round that reviews the descendant `ENOENT` fixture.
* Correction: `ENOENT` is success only when the coverage root itself is missing. The failure proof is a nested directory whose `readdir` fails with `ENOENT`, through `runBranchCoverage`, on the clear walk and on the refusal walk, and Cargo does not start. An `EACCES` fixture does not satisfy that proof. A missing root still reaches `cargo llvm-cov`.
* Evidence: `scripts/files-below.mjs` line 5 calls `readdir` at every directory depth. A nested `ENOENT` rejects the whole walk, so the plan cannot read that rejection as an empty root.
* Authority: MANDATE "fail if any survive" and "before the run". A swallowed descendant error starts Cargo and the later merge can include a profile the walk did not finish listing.
* Obligation: Clear before the instrumented run.

### plan-r9.md

# Plan: Clear stale Rust coverage profiles before the instrumented run

Finding: f-20261002-09. Area: gate-scripts. Root: machine-dependent-measurement. Entry stays `build` after revalidation: the open question is which profiles count as this run, and the script is read as evidence, so the new refusal is part of the change. The planner does not annotate the ledger. The adopting session records the decision under `## Decided autonomously`.

Plan path: `tasks/plans/2026-10-02-stale-profraw.md`.

## Goal

`pnpm test:coverage:backend` merges only `.profraw` files produced by the run that just finished. Profiles left under `src-tauri/target/llvm-cov-target` by an earlier run are removed before `cargo llvm-cov` starts. If any regular-file `.profraw` the merger would see is still there after that removal, the script throws and does not start Cargo. The script's failure paths, including the new refusal, are staged in this run. Baselines, floors, receipt invalidation, and the CI cache key stay as they are.

## MANDATE

Verbatim from `tasks/findings.md`, f-20261002-09. Fixed across every round.

* **ID:** f-20261002-09 · **Status:** open · **Area:** gate-scripts · **Root:** machine-dependent-measurement · **Entry:** build · **Blocked:** none
* **Where:** `scripts/rust-branch-coverage.mjs` (`coverageTarget = src-tauri/target/llvm-cov-target`; after `cargo +nightly llvm-cov … --no-report` it merges `filesBelow(coverageTarget, path.endsWith(".profraw"))` with `llvm-profdata merge -sparse`), used by `pnpm test:coverage:backend` and the receipt-backed `backend-coverage` gate.
* **Defect:** nothing removes profiles from earlier runs. On atlas on 2026-10-02 the directory held 1 517 `.profraw` files with binary signatures dating back to 2026-08-29. Every unchanged function (same name and structural hash) accumulates counts from all of them, so code that the current tests no longer execute stays "covered". Measured: on tree `04f43c1b` the local `pnpm coverage:backend:check` passed while CI (fresh checkout) failed `filesystem-native-boundaries functions regressed: 359/673, baseline 340/634`; the 8 records covered locally but not on CI were all one instance chain that the current test never runs. After deleting every `.profraw` below `llvm-cov-target` and rerunning, the local result reproduced CI exactly (359/673, red).
* **Why it matters:** the backend ratchet's local green — the push gate — can be inflated by history and disagree with CI, which is the next reader's first suspicion of "machine dependence" (`CLAUDE.md`, `f-20260829-01`) when it is in fact stale input. A push can pass every local gate and turn CI red.
* **Open question:** clear `.profraw` files under `coverageTarget` before the run (and fail if any survive), or merge only the profiles whose binary signature matches the binary just built; plus the staged-failure matrix row for the new refusal (push-review-policy §2, the script is read as evidence).
* **Found by:** Stockfish 19 upgrade build, CI red after push, 2026-10-02 (orchestrator measurement above).

## Threat model and non-goals

Frozen with the MANDATE.

Accidental input is the real case: a developer or a previous local gate leaves `.profraw` files under `coverageTarget`, including files in subdirectories and files whose `%m` binary id still matches the current test binary. The script must not treat those counts as this run. CI's fresh checkout is the environment that already fails closed; this change makes the local gate fail the same way.

A second coverage process that creates a `.profraw` after the emptiness check is a named known limit under Risks. It is the same hazard the pre-change merger already has, and `d-20260930-01` already runs `rust-test` on a different target directory. This plan adds no lock.

Adversarial input (a process that replaces profiles between the check and the merge, or a symlink farm) is out of scope. The clear uses the same directory walk the merger already uses.

Non-goals: changing what the compiler emits, which sources are exported, the numeric baselines, the area floors, receipt invalidation, the GitHub Actions cache key, or the type-erasure already landed for f-20261002-10.

## Traced premises

Locate citations. Obligations below do not repeat line numbers.

* `scripts/rust-branch-coverage.mjs` sets `coverageTarget` to `src-tauri/target/llvm-cov-target` and, in `main`, runs `cargo +<toolchain> llvm-cov --manifest-path <src-tauri/Cargo.toml> --bin chessfable --locked --branch --no-report` before any profile walk. It then merges every path `filesBelow(coverageTarget, path.endsWith(".profraw"))` returns. An empty list throws `Rust coverage produced no raw profiles`. `main` is not exported. The module runs `main` only when `isEntrypoint` matches, so a test can import the module without starting Cargo.
* `scripts/files-below.mjs` recurses only when `entry.isDirectory()` and returns a path only when `entry.isFile()` and the predicate matches. Symlinks are neither, so they are not followed and a symlink whose name ends in `.profraw` is not returned.
* Probe 1 on this worktree: `coverageTarget` was absent (`PROFILE_DIRECTORY_ABSENT`). `filesBelow` on a missing directory rejects with the `readdir` error. A first run must not fail because the directory does not exist yet.
* Orchestrator measurement, cargo-llvm-cov tag v0.8.7, fetched 2026-10-02 from `https://raw.githubusercontent.com/taiki-e/cargo-llvm-cov/v0.8.7/src/cli.rs` line 1590: `clean.no_clean |= report.no_report | no_run`. The comment at lines 1589-1590 states that `--no-report` and `--no-run` imply `--no-clean`. `src/clean.rs` `clean_profraw_files` globs `target_dir/*.profraw` only (not recursive) and `clean_partial` returns immediately when `no_clean` is set, before that glob. `src/main.rs` `set_env` sets `LLVM_PROFILE_FILE` to `target_dir.join("{workspace}-%p-%m.profraw")` for a non-nextest run (`%p` pid, `%m` binary id). Local `cargo llvm-cov --version` is 0.8.7 (probe 1). `cargo llvm-cov clean --help` documents `--profraw-only`. The probe's local crate path `cargo-llvm-cov-0.8.7` was not on disk; these citations are the tag, not that path.
* `package.json` script `test:coverage:backend` is `node scripts/ensure-output-directory.mjs backend-coverage && node scripts/rust-branch-coverage.mjs`. `coverage:backend:check` reads `backend-coverage/lcov.info`. `ensure-output-directory.mjs` creates `backend-coverage/` and does not clear `llvm-cov-target`.
* `scripts/gate-receipt.mjs` records `backend-coverage` as `pnpm test:coverage:backend && pnpm coverage:backend:check`. A green receipt can skip the script while ignored `.profraw` files remain. Those files affect only a run that executes the script.
* `scripts/run-push-gates.mjs` selects the `rust-coverage` lane (`pnpm gate:ensure backend-coverage`) from the `--rust` flag, not from changed paths. `hasCoverageInputsChanged` keys off `src-tauri/src`, `backend-coverage-areas.json`, and `backend-coverage-baselines.json`. A scripts-only diff does not select the lane. `pnpm gates:push` without `--rust` does not run it.
* `.github/workflows/test.yml` restores `src-tauri -> target` with Swatinem/rust-cache and then runs `pnpm test:coverage:backend` and `pnpm coverage:backend:check`. Whether that cache restores `.profraw` files was not proven. Delete-before still removes them if it does. The cache key is not this change.
* `scripts/coverage-report.mjs` carries the staged-failure matrix pattern: the header enumerates paths, and `scripts/coverage-report-tests.mjs` calls exported functions directly. The header states that an exported-function call is a real caller. `pnpm coverage:report:test` runs `node --test scripts/coverage-report-tests.mjs`. That file is the only importer of `rust-branch-coverage.mjs` (probe 2).
* Probe 2: `rust-branch-coverage.mjs` has no header matrix. Explicit throw sites without a staged row are at the `run` helper, the metadata refusal, the export crash and export-status throws, the empty-profile throw, the missing-executable throw, the empty-source throw, the empty-export throw, and the no-branch-data throw. Only the metadata refusal and the per-source crash diagnostic have direct unit assertions today. Inherited throws are not evidence for this change.
* `d-20260922-08`: `scopeSignature` guards what is measured. Deleting profiles changes hit counts, not the signature.
* `d-20260928-01`: test-only exclusion stays in the gate. The exporter's LCOV stays raw compiler output. `d-20260902-02` is superseded on that point.
* `d-20260930-01`: `rust-test` and `rust-coverage` stay concurrent and use different target directories (`llvm-cov-target` versus the default). No Cargo `config.toml` target-dir override was found.
* Push skill Skip catalog: do not rebaseline coverage to clear a ratchet. f-20261002-10 is already handled by type-erasing the validator. f-20260829-01 was a missing recursive-delete test, and its closing note says that root does not survive for the backend half. This finding is stale input under the same root name, not that defect.

## Approach

### Clear before the instrumented run

Quotes the MANDATE: "clear `.profraw` files under `coverageTarget` before the run".

Before `cargo llvm-cov`, remove every regular-file `.profraw` the merger would see.

* The walk is the same `filesBelow` walk the merger uses, so a nested regular file is removed and a symlink is not followed.
* `ENOENT` is an absent coverage root only. When the coverage root itself is missing, clearing returns, so a first run succeeds. When a descendant raises `ENOENT`, or the walk fails any other way, the error propagates unchanged and does not start Cargo. `filesBelow` calls `readdir` at every directory depth, so a nested failure rejects the whole walk.
* Each returned path is removed. The first removal error propagates unchanged, with the filesystem error's own message. Nothing is swallowed. Non-`.profraw` files and the directory itself stay, so incremental build artefacts under `llvm-cov-target` stay.
* This step does not call `cargo llvm-cov clean`.

The production path is one exported orchestration function that `main` calls and that tests call with scratch directories and a fake command runner. `main` passes no arguments; the defaults are today's paths and today's runners. There is no production environment variable. The phase names the exports. Private branch structure inside the function stays with the executor.

Verification level: a temporary directory. Plant a nested `.profraw`, a non-`.profraw` sibling, and, where creating a symlink succeeds, a symlink to a directory that contains a `.profraw`. After the clear, the nested profile is gone, the sibling remains, and the profile behind the symlink remains. A missing coverage root resolves, and the orchestration still reaches `cargo llvm-cov`. A root that exists, with a nested directory whose `readdir` fails with `ENOENT`, rejects through `runBranchCoverage` on the clear walk and on the refusal walk, and does not start Cargo. A fixture whose error is `EACCES` does not satisfy that proof. `CR-1` covers the platform where creating the symlink is refused.

### Refuse if any raw profile survives

Quotes the MANDATE: "and fail if any survive".

Immediately after the clear, and before `cargo llvm-cov`, walk again. A non-empty result throws `new Error("Rust coverage left stale raw profiles: " + paths)`. `paths` is the absolute paths sorted lexicographically and joined with `", "`. The message is distinct from `Rust coverage produced no raw profiles`. `ENOENT` on this walk uses the same rule as the clear: it returns only when the coverage root itself is missing. Any other walk error propagates. The throw does not delete and does not start Cargo.

Verification level: the survivor proof calls only `runBranchCoverage`. Its `listProfiles` option, which defaults to the `filesBelow` walk, returns no profiles on the clear's walk and one absolute path on the next walk. The call rejects with a message that starts with `Rust coverage left stale raw profiles:` and contains that path, and the fake runner is not asked to run `cargo`. Removing the refusal walk from `runBranchCoverage` turns this test red. A direct call to the refusal export may stage that function's own row; it does not satisfy this proof. A second test plants profiles, uses the default walk so the clear removes them, and asserts the runner's `cargo` `llvm-cov` invocation happens only after the directory has no `.profraw`. A test reads `scripts/rust-branch-coverage.mjs` and fails if `main` does not call `runBranchCoverage`.

### Staged-failure matrix for this evidence script

Quotes the MANDATE: "plus the staged-failure matrix row for the new refusal (push-review-policy §2, the script is read as evidence)".

`push-review-policy.md` §2, the section the finding names, says the run that changes an evidence artefact owns its matrix, and an inherited gap in the same area is built in this run rather than left as a licence. This change edits `scripts/rust-branch-coverage.mjs`, and `pnpm coverage:backend:check` reads that run's result as evidence. The header matrix follows `scripts/coverage-report.mjs`: every failure path, the distinguishing message, the status of that same run, and whether the row is staged or argued.

* One row is the survivor refusal, message `Rust coverage left stale raw profiles:`, staged by the scratch-directory call above. The recorded status for that staged call is a rejected promise. The header states that `main`'s CLI exit, when this throw escapes the top-level `await`, is Node's exit 1.
* Removal and walk failures that this change adds (the clear's removal error, and a walk error other than the coverage root's own `ENOENT`) are staged on a scratch directory. A mode that makes removal fail, and a directory that cannot be read, are enough for those filesystem errors. The descendant `ENOENT` proof is the separate case in the clear's verification, not this unreadable-directory row. Their messages are the filesystem errors Node raises. The recorded status for each staged call is a rejected promise. The header states that the CLI exit, when that rejection escapes the top-level `await`, is Node's exit 1, described from that rejection and not from a second spawn. They get their own rows because those messages are not the survivor message.
* Every other failure path in the file after the edit is staged too, through the exported orchestration and the helpers it already exports (`coverageTools`, `exportLcovOrDiagnose`), using scratch directories and a fake runner. Each staged call records the message that distinguishes that path and the status of that same call. `coverageTools` and `exportLcovOrDiagnose` throw synchronously, and the test records that throw, as the existing assertions for those helpers already do. `runBranchCoverage` is async, so a throw from it is a rejected promise. A process row records the exit status the header names. Probe 2's list is the starting enumeration, not the matrix: the executor re-reads the edited file and accounts for each path. Paths that already have a direct assertion are staged rows, not gaps.
* Tool resolution stays before any profile deletion. One staged spawn of the entrypoint uses a scratch `PATH` on which `rustup` cannot run. Before the spawn, the test plants one `.profraw` under `coverageTarget` (creating that directory if it is absent) and records the set of `.profraw` paths. The spawn records the tool-resolution message and exit status 1. The set of `.profraw` paths is unchanged, which fails if the clear ran. A `finally` path deletes only the file it planted, including when the spawn or an assertion fails, so a failed test does not leave that profile in `coverageTarget`. A spawn that would reach the clear or Cargo is not staged: past tool resolution the entrypoint binds the real `coverageTarget` and would delete live profiles or start Cargo. The header argues those spawns for that reason. The survivor refusal's process exit is the same uncaught rejection, described from the orchestration test, not from a second spawn.

### Proof the adopting session runs

The phase proof is two commands, in this order:

1. `pnpm coverage:report:test`
2. `pnpm gate:ensure backend-coverage`

Command 2 is required even though a scripts-only diff does not select `rust-coverage` and `pnpm gates:push` without `--rust` skips it. The planner does not start either command. The adopting session also runs `pnpm checks:pre-review` before cumulative diff review, because the push skill's pre-review block formats and lints these `.mjs` files. That block does not replace command 2.

No browser check. The change is not a rendered surface.

## Decisions and trade-offs

Chosen mechanism: clear, then refuse. Rejected: merge only profiles whose `%m` matches the binary just built. A cold run can emit a build-script profile with a different `%m` in the same invocation (cargo-llvm-cov 0.8.7 `set_env`), and a stale file whose `%m` still matches the current test binary is exactly the inflation the finding measured. A filter would drop the fresh extra profile and keep the stale one.

Rejected: `cargo llvm-cov clean --profraw-only` as the only clear. Its glob is `target_dir/*.profraw`. The merger is recursive. Nested profiles would survive and be merged.

Rejected: dropping `--no-report` so cargo-llvm-cov's automatic clean runs. That path also runs `clean_partial`, which cargo-cleans the measured crates, and it generates cargo-llvm-cov's own report. This repository exports LCOV itself because `--branch` segfaults (llvm/llvm-project#119558), which the script already handles. `--no-report` stays.

Rejected: a new lock around the coverage target. `d-20260930-01` already separates `rust-test` onto another target directory. A second writer of `llvm-cov-target` after the assert is the known limit below, not a new mechanism.

## Risks / open questions

Known limit, named here, not a new lock: a second process that writes a `.profraw` under `coverageTarget` after the survivor check returns can still be merged. The pre-change script has the same window, with no preceding clear. No Cargo target-dir override puts `rust-test` on `llvm-cov-target`.

No open product question. The mechanism is the technical choice recorded under `## Decided autonomously`.

## Not part of this task

* `backend-coverage-baselines.json`, `minimumCoverage` in `backend-coverage-areas.json`, and any re-record of `scopeSignature`.
* Receipt invalidation in `scripts/gate-receipt.mjs`. A skipped run does not merge stale profiles.
* The GitHub Actions rust-cache key and `scripts/run-push-gates.mjs` lane selection.
* f-20261002-10 (handled) and f-20261002-08.
* `docs/coverage.md`, unless a sentence there claims the profile directory is already cleared. It does not, as read in locate.
* A lock, a watcher, or a production environment variable for the profile directory.

## Phases

One phase. Area: gate-scripts. No auth, persistence, concurrency control, or API contract. Executor: Codex write, role `normal` (these paths are not in the push skill's sensitive globs).

Files: `scripts/rust-branch-coverage.mjs`, `scripts/coverage-report-tests.mjs`. Read `scripts/files-below.mjs` and `scripts/coverage-report.mjs`. Do not edit them.

Implements Clear before the instrumented run, Refuse if any raw profile survives, and Staged-failure matrix for this evidence script.

Spelling this phase uses, so the tests and the header name one thing:

* `clearStaleRawProfiles(directory)` removes the regular-file profiles.
* `assertNoStaleRawProfiles(directory)` throws the survivor message.
* `runBranchCoverage(options)` resolves the coverage tools, then performs the clear, the assert, then the existing Cargo, merge, and export steps. Omitted options are today's paths, the current `run` / `attempt` runners, and the `filesBelow` walk (`listProfiles`). `main` is the no-argument call.

Removal is `unlink` of each path the walk returned. Do not follow symlinks. Do not add an environment variable.

PROOF:

```bash
pnpm coverage:report:test
pnpm gate:ensure backend-coverage
```

The planner does not run these. The adopting session runs both, and runs `pnpm checks:pre-review` before cumulative diff review.

## Decided autonomously

Questioning is skipped because the launch says `full auto`. The adopting session records each entry with `./scripts/findings.py record-decision`. The planner does not.

### Which profiles count as this run?

* **Question:** Clear `.profraw` files under `coverageTarget` before the run and fail if any survive, or merge only the profiles whose binary signature matches the binary just built?
* **Chosen:** Clear every regular-file `.profraw` that `filesBelow(coverageTarget)` would return, then throw `Rust coverage left stale raw profiles:` if any remain, before `cargo llvm-cov`. A missing directory is success. Symlinks are not followed.
* **Rejected:** A `%m` filter. `cargo llvm-cov clean --profraw-only` as the only clear. Dropping `--no-report`.
* **Reason:** cargo-llvm-cov 0.8.7 sets `no_clean` when `--no-report` is passed, and its own profraw clean is a non-recursive glob while this script merges recursively. A binary-id filter drops a fresh build-script profile from the same invocation and keeps a stale file whose `%m` still matches the current test binary. Reversal path: replace the clear with a filter that keeps every profile written by this invocation, including a different `%m`, and still drops a stale file with the current `%m`.

### What does the matrix cover?

* **Question:** Stage only the new survivor refusal, or every failure path of `rust-branch-coverage.mjs`?
* **Chosen:** The whole matrix. The survivor refusal, the new removal and walk failures, and every other path in the edited file are staged through the exports against scratch inputs. One pre-clear entrypoint spawn, the `rustup` failure, is staged after planting one `.profraw` and asserting that path set is unchanged. A `finally` path deletes only that planted file, including when the spawn or an assertion fails. A spawn that reaches the clear or Cargo stays argued because it binds the live coverage tree.
* **Rejected:** Listing pre-existing throws as inherited and not staging them. Round 1's first draft chose that, and it does not survive `push-review-policy.md` §2's rule that the run which changes an evidence artefact builds the matrix in this run. The finding cites that section.
* **Reason:** `pnpm coverage:backend:check` reads this script's result as evidence. A header that names unstaged paths does not make those paths evidence. Reversal path: a later decision that the gate stops treating this script's exit as evidence.

### Does the adopting session run the coverage gate when path selection would skip it?

* **Question:** Is `pnpm coverage:report:test` enough proof, given `gates:push` will not select `backend-coverage` from a scripts-only diff?
* **Chosen:** The phase proof is `pnpm coverage:report:test` and then `pnpm gate:ensure backend-coverage`.
* **Rejected:** Relying on path selection or on `pnpm gates:push` without `--rust`.
* **Reason:** The artefact is the gate. The unit test does not execute `main` or Cargo. Reversal path: teach lane selection to notice this script, which is a different change and is not this mandate.

## Carried to diff review

* CR-1 — Symlink fixture on a platform that refuses `symlink` with `EPERM`. The non-follow assertion runs where creating a symlink in a temporary directory succeeds. On `EPERM`, skip only that assertion; the nested-profile and sibling-file assertions still run. Do not add a Windows or macOS CI job. The contract gate that runs `pnpm coverage:report:test` is the Ubuntu `test` job (`.github/workflows/test.yml`).

## Reviews

Append-only. Raw reports stay in the lens artefacts. This section is the lookup record.

Round 1 wall time is the leaf span recorded in `plan-meta.json`. 12 plan-capable lenses. Adopted P-1, P-2, P-3, P-4. Carried CR-1. No skips.

Round 2 closure: plan, tests, error-handling, minimalism, correctness. P-2, P-3, P-4 closed by their witnesses. P-1 not closed. Adopted the P-1 tightening and P-6.

Round 3 closure: plan, tests, error-handling, correctness. P-1 closed by plan and tests. P-6 not closed by tests. Adopted the planted-profile assertion and this record (P-7).

Round 4 closure: plan, tests, error-handling. P-6 closed by tests, plan, and error-handling. P-7 closed by plan. Adopted P-8: the planted file is removed on a `finally` path when the spawn or an assertion fails.

Round 5 closure: plan, tests, error-handling. P-8 closed by all three. Adopted P-9: each new removal and walk row records a rejected promise, and every other staged call records its message and status.

Round 6 closure: plan, tests, error-handling. P-9 not closed by error-handling. Adopted the synchronous-throw status, and adopted P-10: `ENOENT` means the coverage root is missing, not a descendant. The tests late observation, that a missing root still reaches Cargo, is the success half of P-10.

Round 7 closure: plan, tests, error-handling. P-9 closed by all three. P-10 not closed: the proof said a descendant the walk cannot read, which can be `EACCES`. Adopted a descendant `readdir` `ENOENT` through `runBranchCoverage` on both pre-Cargo walks. An `EACCES` fixture does not satisfy that proof.

Round 8 closure: plan, tests, error-handling. P-10 closed by all three. No new adoption.

### P-1

* Claim: a direct call to the refusal helper stays green if `main` or the orchestration omits the clear and the refusal, and the coverage gate does not catch that omission.
* Witnesses: plan r1 finding 1 (blocker), tests r1 finding 1 (blocker), plan r2 finding 1 (blocker, NOT CLOSED), tests r2 finding 1 (blocker, NOT CLOSED).
* Disposition: Fix. Closed in round 3.
* Correction: the survivor proof calls only `runBranchCoverage`. `listProfiles` returns no profiles on the clear's walk and one path on the next walk. Removing the refusal walk makes the fake runner reach Cargo and the test fails.
* Evidence: `package.json` `coverage:backend:check` reads `lcov.info` only. Round 3 plan and tests both reported `P-1 CLOSED` on that sentence.
* Authority: MANDATE "before the run" and "fail if any survive". The proof has to go red when that production order is removed.
* Obligation: Refuse if any raw profile survives.

### P-2

* Claim: the approach prescribed helper signatures, `unlink`, and fixture steps that are executor choices.
* Witnesses: plan r1 finding 2 (should-fix).
* Disposition: Fix. Closed in round 2.
* Correction: the approach states behavior. The phase names `clearStaleRawProfiles`, `assertNoStaleRawProfiles`, `runBranchCoverage`, and `unlink`.
* Evidence: plan round 2 reported `P-2 CLOSED`.
* Obligation: Clear before the instrumented run.

### P-3

* Claim: a removal or walk error introduced by the clear is a new stageable path, not an inherited row.
* Witnesses: error-handling r1 finding 1 (should-fix), tests r1 finding 2 (should-fix, the new-path half).
* Disposition: Fix. Closed in round 2.
* Correction: scratch-directory rows for the removal failure and for a non-`ENOENT` walk failure, each with its own filesystem message.
* Evidence: error-handling and tests round 2 reported `P-3 CLOSED`.
* Authority: MANDATE cites push-review-policy §2. A path this change adds is stageable on a scratch directory.
* Obligation: Staged-failure matrix for this evidence script.

### P-4

* Claim: marking pre-existing throws inherited, without staging or an allowed argument, does not satisfy §2 for a script this change edits.
* Witnesses: tests r1 finding 2 (should-fix, the inherited-path half).
* Disposition: Fix. Closed in round 2.
* Correction: stage every remaining failure path through the exports. Argue only spawns that reach the clear or Cargo.
* Evidence: tests round 2 reported `P-4 CLOSED`. `push-review-policy.md` §2 fifth condition: the run that changes an evidence artefact builds the matrix in this run.
* Authority: the MANDATE's citation of push-review-policy §2, and that section's words "same area, build the matrix in this run".
* Obligation: Staged-failure matrix for this evidence script.

### P-5

* Claim: a symlink fixture can throw `EPERM` on Windows, and the proof command is not a Windows CI job.
* Witnesses: platform-semantics r1 finding 1 (should-fix).
* Disposition: Fix. `closed_round` carried, id CR-1.
* Correction: see `## Carried to diff review`. The Ubuntu contract gate is the runtime that runs this test. No new CI job.
* Evidence: `.github/workflows/test.yml` job `test` runs `pnpm gates:contract:check` on `ubuntu-latest`. The Windows and macOS jobs do not run `coverage-report-tests.mjs`.

### P-6

* Claim: the entrypoint's process exit can be staged for the tool-resolution failure without deleting profiles, because that failure happens before the clear.
* Witnesses: error-handling r2 finding 1 (should-fix). tests r3 finding 1 (should-fix, NOT CLOSED): a missing profile directory does not prove the clear did not run.
* Disposition: Fix. Closed in round 4.
* Correction: plant one `.profraw`, assert the path set is unchanged, delete only that file.
* Evidence: current `main` calls `coverageTools` before any profile walk (`scripts/rust-branch-coverage.mjs` line 122, profile walk at line 139). Round 4 plan, tests, and error-handling reported `P-6 CLOSED`.
* Authority: push-review-policy §2, record the exit status of a stageable path. The planted file is restored by the test.
* Obligation: Staged-failure matrix for this evidence script.

### P-7

* Claim: the plan file had no `## Reviews` record for lenses to look up.
* Witnesses: plan r3 finding 1 (blocker).
* Disposition: Fix. Closed in round 4.
* Correction: this section.
* Evidence: round 4 plan reported `P-7 CLOSED` on this heading.
* Obligation: the review record, not a product obligation.

### P-8

* Claim: if the planted-profile spawn or its assertion fails first, the delete does not run and the planted `.profraw` stays in the real coverage target.
* Witnesses: error-handling r4 finding 1 (should-fix).
* Disposition: Fix. Closed in round 5.
* Correction: a `finally` path deletes only the planted file, including when the spawn or an assertion fails.
* Evidence: `coverageTarget` is `scripts/rust-branch-coverage.mjs` line 13. Round 5 plan, tests, and error-handling reported `P-8 CLOSED`.
* Lineage: P-6.
* Obligation: Staged-failure matrix for this evidence script.

### P-9

* Claim: the new removal and walk rows name the filesystem message and do not name the status of that staged call.
* Witnesses: error-handling r5 finding 1 (should-fix). error-handling r6 finding 1 (should-fix, NOT CLOSED).
* Disposition: Fix. Closed in round 7.
* Correction: removal and walk rows record a rejected promise, because those calls go through async `runBranchCoverage`. `coverageTools` and `exportLcovOrDiagnose` throw synchronously, and the test records that throw. A process row records the exit status the header names.
* Evidence: `push-review-policy.md` §2 requires the message and the status. `scripts/coverage-report-tests.mjs` lines 3094 and 3165 use `assert.throws` on those two helpers. Round 6 error-handling reported `P-9 NOT CLOSED`.
* Lineage: P-3.
* Authority: the MANDATE cites push-review-policy §2, and that section requires both halves.
* Obligation: Staged-failure matrix for this evidence script.

### P-10

* Claim: treating every `ENOENT` from the recursive walk as an absent coverage root swallows a missing descendant and can still merge a sibling stale profile.
* Witnesses: error-handling r6 finding 2 (blocker). tests r6 finding 1 (should-fix, the missing-root half). plan r7 finding 1 (blocker, NOT CLOSED). tests r7 findings 1 and 2 (blocker, NOT CLOSED). error-handling r7 findings 1 and 2 (blocker, NOT CLOSED).
* Disposition: Fix. Closed in round 8.
* Correction: `ENOENT` is success only when the coverage root itself is missing. The failure proof is a nested directory whose `readdir` fails with `ENOENT`, through `runBranchCoverage`, on the clear walk and on the refusal walk, and Cargo does not start. An `EACCES` fixture does not satisfy that proof. A missing root still reaches `cargo llvm-cov`.
* Evidence: `scripts/files-below.mjs` line 5 calls `readdir` at every directory depth. A nested `ENOENT` rejects the whole walk, so the plan cannot read that rejection as an empty root.
* Authority: MANDATE "fail if any survive" and "before the run". A swallowed descendant error starts Cargo and the later merge can include a profile the walk did not finish listing.
* Obligation: Clear before the instrumented run.

## Diff review (adopting session e1db7603-3919-4fe0-898a-de9d5f32da44)

Reviewed range at round 1: `60a9abe025818676336d26329f6b20dd43d74781..44462fbedf1804d1c3080a566a2a24101935645f` (decision commit `3729f323` and implementation `44462fbe`). Code lenses saw the script diff only. The records lens saw `tasks/decisions.md` only. Detection was Codex low, the same family as the Codex high writer. The orchestrator arbitrated.

CR-1 CLOSED by correctness, root-cause, code-quality, error-handling, minimalism, tests, and platform-semantics. On `EPERM`, only the symlink assertion is skipped.

Round 1 verdicts:

- review-correctness APPROVED. No findings.
- review-root-cause APPROVED. No findings.
- review-code-quality APPROVED. No findings.
- review-error-handling APPROVED. No findings.
- review-minimalism REVISE. Two should-fix findings, both Skip.
- review-tests REVISE. One should-fix, Fix.
- review-platform-semantics REVISE. One should-fix, Skip. CR-1 closed.
- records REVISE. One should-fix, Fix.

Dispositions:

- minimalism `listRawProfiles` duplicates `rawProfilesBelow` (confidence 93). Skip. The test helper is the independent filesystem oracle. Routing it through the private production selector would hide a wrong predicate.
- minimalism six path overrides on `runBranchCoverage` (confidence 88). Skip. The defaults already derive from `projectRoot`. The overrides are the scratch seams that stage one missing path at a time, which is the phase contract. Collapsing them is not required by the mandate.
- platform-semantics Windows `chmod` does not prove `EACCES` (confidence 96). Skip. CR-1 and `.github/workflows/test.yml` confine `pnpm coverage:report:test` to the Ubuntu `test` job. The Windows CI jobs run `cargo test` only. The carried item forbids adding a Windows or macOS CI job for this fixture.
- tests symlink entries (confidence 98). Fix. `lstatSync(...).isSymbolicLink()` on `linked` and `linked.profraw` inside the `symlinkCreated` branch. Commit `f392679e`.
- records d-20261003-03 reason said the unit test does not execute `main` (confidence 100). Fix. That clause is false: the entrypoint spawn calls `main` and stops when `rustup` cannot be spawned. Choice unchanged. Superseded by d-20261003-04. Not an answer reversal.

REVIEWED_THROUGH after the repair: `f392679ed1a0e2fa2e4f44c1cc44335bed7bddc1`.

Closure round (`44462fbe..f392679e`), lenses correctness, tests, and records:

- correctness: symlink-assertion CLOSED. CR-1 CLOSED. VERDICT: APPROVED.
- tests: symlink-assertion CLOSED. CR-1 CLOSED. VERDICT: APPROVED.
- records: decision-reason CLOSED. d-20261003-03 superseded, d-20261003-04 keeps the choice. VERDICT: APPROVED.

diff_adopted_per_round: r1=2 r2=0.

No browser verification. The change is not a rendered surface.

No successor finding. This record is the plan-review history plus the diff-review closure for f-20261002-09.
