# Directory listing bound — plan and diff review record

Scope: `f-20260913-06` (user-chosen directory listings had no stated bound, and a failed
listing could keep fresh persistent ids). Plan (ignored run artifact):
`tasks/plans/2026-10-03-directory-listing-bound.md`. This file is the tracked history. The
plan, its snapshots, and the lens reports under `/tmp/build-b52c3a69-4f9f-48f1-820e-e09578b059d0`
may disappear.

## Lineage and run facts

* Picked by `/next-finding --pin f-20260913-06 full auto` on 2026-10-03. No rewrite and no
  split. Tier stayed `build`.
* Orchestrator: Grok. Executor: Codex. Plan authorship and arbitration shared this Grok
  context. Detection ran in separate Codex processes. Same model family, not family
  separation. Disclosure: this context wrote the plan and arbitrated triage.
* `plan_adopted_per_round`: r1=7 r2=4 r3=1 r4=0 r5=0. R3-01 is the only round-3 adoption.
  CR-1 does not count. Unique plan issues: R1-01 through R1-08, R2-01, R3-01, and carried
  CR-1. All closed or skipped. No open plan-level issue.
* Implementation commit `67cb4124`. Repair commit `713879f0`. Finding close `235ef399`. Two phase proof-fix rounds on
  thread `01a1006e-90f3-7c91-b098-b454ac28e4af` (Windows GNU `save` cfg, then
  `register_database_child` cfg). The orchestrator re-ran the host filters, `cargo fmt
  --check`, and `pnpm rust:windows:check` before the phase commit (`PROOF_GREEN`: 25 and 60
  tests).
* `diff_adopted_per_round`: r1=4 r2=0. Code reviewed through `713879f0`.

## Successors

No successor inherits an open issue from this record. `f-20260913-05` already owns Files and
Databases page copy for a listing error (`d-20261003-12`). It must not treat this file as a
new UI mandate. Load this file only to see why that copy stayed out of scope.

## Known limits

* A crash between the snapshot commit and process exit leaves the registry matching the
  snapshot. That is the residue class `d-20260914-02` already accepts.
* A game-count failure or a cancellation after `collect_tree_entries` returns does not undo
  the snapshot.
* `DurabilityUncertain` on the snapshot commit is adopted and must not be retried. A hard
  `save_entries_with_baseline` error does not adopt.
* A crash during canonicalization after a passing preflight leaves that rewrite and does not
  retire.
* A puzzle same-path identity change returns today's `Conflict` and does not retire the old id.
* Practice shard directory reads and the engine-launch sweep stay unbounded, including through
  the Windows wrapper. Only `CapabilityDirectory::entries` passes `Some(MAX_DIRECTORY_LISTING_ENTRIES)`.
* Database and puzzle listings hold the authority mutex across the walk. Workspace listing
  releases it. Holding the lock makes a concurrent registration during those walks impossible,
  which is stricter than the retirement predicate. The minimalism lens did not treat the hold
  as a defect. Releasing it would restructure callers outside this phase.
* The file-wide FreeBSD cfg flip is `d-20261003-14` and is not a gate. The probe exited 101.

## Diff review

Cumulative range `0d6a9a12..67cb4124`, then closure over `67cb4124..713879f0`.
Round-1 lenses: correctness, root-cause, tests, platform-semantics, tauri-security APPROVED.
code-quality and error-handling APPROVED with should-fix findings. minimalism and records
REVISE. `review-ipc-contract` was not launched: no command, event, binding, or capability
change. CR-1 closed on every round-1 report
(`directory_listing_bound_resource_limit_serializes_command_category`).

| ID | Claim | Disposition | Evidence |
| --- | --- | --- | --- |
| CQ-1 | Private `register` implied a commit | Fix, closed r2 | Renamed to `prepare_staged` (`file_workspace.rs`). Hook names unchanged. correctness, tests, code-quality, minimalism: CLOSED. |
| CQ-2 | `PreparedListingEntry` named listings only | Fix, closed r2 | Renamed to `PreparedEntry`. No old name remains under `src-tauri/src`. |
| CQ-3 | `ReuseFault.kind` was a `u8` | Fix, closed r2 | `ReuseFaultKind` with the same three modes and assertions. |
| MIN-1 | Puzzle and database listings repeated snapshot, walk, and commit | Fix, closed r2 | Both call `reconcile_db3_listing`. Public names unchanged. No new cancellation check. Mutex still held. |
| EH-1 | Pages still say the collection could not be loaded | Skip | `f-20260913-05` and `d-20261003-12`. No renderer copy in this diff. |
| REC-1 | Open finding prose still said listings were unbounded | Fix by close, not by rewriting the body | `./scripts/findings.py close` after this code closure. The historical defect text stays. |
| T-r2 | The renamed source pin does not mention `refuse_unobserved`, and no test replaces a child after enumeration | Skip | The pin change is the function name only. `puzzle_listing_refuses_a_db3_replaced_after_enumeration` and `database_listing_refuses_a_db3_replaced_after_enumeration` (`mod.rs`, `assert_db3_listing_refuses_replacement`) swap the file in `set_capability_directory_post_entries_hook` and assert `Conflict` plus an unchanged persistent snapshot. Removing `refuse_unobserved` turns those tests red. The requested test already exists. |

Closure round (`lens-correctness-r2`, `lens-tests-r2`, `lens-code-quality-r2`, `lens-minimalism-r2`): CQ-1, CQ-2, CQ-3, and MIN-1 CLOSED on all four. correctness, code-quality, and minimalism APPROVED. tests REVISE on T-r2, skipped with the evidence above. No second repair.

## Plan review history

The following section is the plan's `## Reviews` record, copied so this file stands alone.

## Reviews

Round 1 wall is the leaf window that produced the reports below. `review-minimalism` returned `VERDICT: APPROVED` and no findings. `review-ipc-contract` returned `VERDICT: APPROVED` and no findings. Adopted this round: R1-01, R1-02, R1-03, R1-04, R1-05, R1-06, R1-07. Skipped: R1-08. Open after the revision: the seven Fix rows, pending the closure round.

### Round 1 raw verdicts

review-plan REVISE:

```
[blocker] tasks/plans/2026-10-03-directory-listing-bound.md:66 — Registration success is not workspace-listing success. `src-tauri/src/file_workspace.rs:595` subsequently resolves handles, counts games, and checks cancellation; those steps can return errors at `:603`, `:605`, and `:609`. Reconciling immediately after registration therefore drops stale handles during a failed listing, contradicting line 74. Require reconciliation after the full listing succeeds and proof covering a game-count failure or cancellation. (confidence: 100)

[blocker] tasks/plans/2026-10-03-directory-listing-bound.md:72 — The promised reconciliation-failure semantics contradict the chosen commit path. `src-tauri/src/infra/path_authority/mod.rs:8066` enables adoption on uncertain durability, and `:8130` adopts the candidate containing deletions before `require_durable` returns an error at `:2274`. A failed reconciliation can therefore drop stale IDs. Resolve this committed-but-uncertain case explicitly and verify it with fault injection. (confidence: 100)

[blocker] tasks/plans/2026-10-03-directory-listing-bound.md:68 — Reconciliation can revoke handles registered after its snapshot. Workspace enumeration and registration release the authority lock between steps (`src-tauri/src/file_workspace.rs:494`, `:456`); creation registers a new handle at `:892`, using a mutation lock that listings never acquire. An older listing can then delete that live handle because it did not observe it. Specify ordering or protection against later registrations, with a concurrent creation/listing proof. (confidence: 95)

[should-fix] tasks/plans/2026-10-03-directory-listing-bound.md:74 — Success-only reconciliation does not prevent permanent saturation as claimed. At 4096 IDs, replacing or renaming one listed child requires a fresh ID (`src-tauri/src/infra/path_authority/mod.rs:7255`, `:7281`), so the preflight at plan line 64 refuses before reconciliation can release its predecessor; admission rejects that growth at code line `:8216`. State this retained limitation or correct the mechanism and verify recovery at the cap. (confidence: 100)

[should-fix] tasks/plans/2026-10-03-directory-listing-bound.md:54 — The private `Option` argument shape and per-case test prescriptions at line 120 belong in the phase brief. The existing enumerator signature (`src-tauri/src/infra/fs.rs:2989`) and its source pin (`src-tauri/src/infra/platform_support.rs:1094`) are executor details. Keep the stable obligations—bounded listings, unlimited removal, and failure semantics—in the plan. (confidence: 100)

VERDICT: REVISE
```

review-correctness REVISE:

```
[blocker] tasks/plans/2026-10-03-directory-listing-bound.md:66 — Reconciliation is triggered after registration, but `list_file_workspace_core` can still fail afterward while resolving/counting PGNs or checking cancellation (`file_workspace.rs:595-609`). A listing can therefore return `Err` after dropping stale IDs, contrary to the acceptance that failed listings preserve them. Reconcile only after the full listing succeeds. (confidence: 97)

[blocker] tasks/plans/2026-10-03-directory-listing-bound.md:72 — On a reconciliation commit with uncertain parent sync, `commit_candidate` adopts the candidate before `require_durable` returns an error. The listing can return `Err` while the candidate has already removed stale IDs, contradicting the failed-listing contract and the claim that the plan does not treat them as released. (confidence: 97)

[should-fix] tasks/plans/2026-10-03-directory-listing-bound.md:54 — The new `enumerate_directory` limit policy omits its `sync_windows_tree` caller (`infra/fs.rs:3465`). If that call receives the listing limit, syncing an install tree with 4,097 entries will fail with `ResourceLimit`, expanding the bound into the sync path the plan leaves out of scope. Specify that sync passes no listing limit. (confidence: 87)

VERDICT: REVISE
```

review-error-handling APPROVED:

```
[should-fix] tasks/plans/2026-10-03-directory-listing-bound.md:88 — If failed or cancelled listings fill the registry with stale child IDs, a later snapshot needing even one new ID fails preflight. Because reconciliation runs only after success (:74), retrying that unchanged snapshot fails before it can release stale IDs; the listing has no recovery path through this flow. The at-cap pure-relist case does not cover this changed-tree state (confidence: 94)

VERDICT: APPROVED
```

review-tauri-security REVISE:

```
[blocker] tasks/plans/2026-10-03-directory-listing-bound.md:64 — After failed listings fill the registry to 4096 with stale child IDs, a changed snapshot containing even one new identity fails preflight at 4097. Reconciliation only runs after registrations succeed (lines 66–74), so it can never release those stale IDs; the same listing keeps returning `ResourceLimit`, leaving current files unlistable. (confidence: 97)

VERDICT: REVISE
```

review-tests REVISE:

```
[blocker] tasks/plans/2026-10-03-directory-listing-bound.md:136 — The filtered proof succeeds if it selects zero tests; nothing verifies that any `directory_listing_bound` tests ran. If they are absent or misnamed, the 4097-entry failure and no-partial-snapshot revert can pass the listed proof. The plan’s naming requirement at line 141 does not check selection. (confidence: 99)

VERDICT: REVISE
```

review-platform-semantics REVISE:

```
[should-fix] tasks/plans/2026-10-03-directory-listing-bound.md:133 — The proposed proof runs only host tests and formatting; it omits the non-Linux Unix source probe, `pnpm rust:windows:check`, and target CI evidence (`rust-platform` compile/clippy matrix plus `rust-macos-test` and `rust-windows-test` runtime jobs). A Linux run cannot establish the macOS or Windows branches compile and behave correctly (confidence: 99)

[should-fix] tasks/plans/2026-10-03-directory-listing-bound.md:54 — Windows `sync_windows_tree` also calls `enumerate_directory` at `src-tauri/src/infra/fs.rs:3465`, but the plan specifies limits only for listings and removal. If sync receives `Some(4096)`, installing a directory with 4,097 children gains an out-of-scope failure; specify that sync passes no limit (confidence: 97)

VERDICT: REVISE
```

review-minimalism: `VERDICT: APPROVED`
review-ipc-contract: `No in-scope IPC contract defects found. The plan keeps commands, events, capabilities, and bindings unchanged. Existing Error::ResourceLimit serializes as ErrorPayload with category resource-limit, which the renderer already maps.` `VERDICT: APPROVED`

### Issue table

| ID | Claim | Witnesses | Evidence | Disposition | Correction | Authority | Closure |
|---|---|---|---|---|---|---|---|
| R1-01 | Reconciliation after registration drops ids while `list_file_workspace_core` can still return Err on game count or cancellation | review-plan blocker 1; review-correctness blocker 1 | `file_workspace.rs:595-609` resolves and counts after `collect_tree_entries` returns. Game count takes a `ResolvedPath` from the handle (`pgn.rs:903-915`) | Fix | One snapshot commit inside `collect_tree_entries` after pass 1 and the reuse loop, before return. Game-count failure and later cancellation return Err and leave the registry matching that snapshot. They do not roll it back. Failures before the commit write no fresh id and retire nothing. The lens sentence "only after the command returns Ok" is not the correction: that order cannot admit a replacement when `mod.rs:8216` would refuse growth, and counting games needs the handles | Annotation: repeated failed listings add fresh identities until `MAX_AUTHORITY_IDS`; game-count failure is a named churn source. Delaying the release past `Ok` fails that sentence | closed, round 2: review-plan and review-correctness |
| R1-02 | Uncertain durability adopts the candidate before `require_durable` errors, so a failed commit can still drop ids | review-plan blocker 2; review-correctness blocker 2 | `commit_state_with_baseline` passes `adopt_uncertain` true (`mod.rs:8066`). Adoption is `mod.rs:8130`. `require_durable` returns `CommittedDurabilityUncertain` at `:2273-2274`. Comment `:2262-2263` says callers must not retry. A hard error is the `?` at `:8128`, before adoption | Fix | State both outcomes. `DurabilityUncertain` adopts the snapshot candidate and is not retried. A hard write error leaves the previous registry. Proof injects both | Same commit path the plan already chose; the old sentence was false against it | closed, round 2: review-plan and review-correctness |
| R1-03 | Retirement can drop an id registered after the snapshot because the listing releases the authority lock | review-plan blocker 3 | `authority()` (`file_workspace.rs:95-100`) is statement-scoped. The walk at `:498` runs after that guard drops. `create_workspace_file` (`:705-719`) takes `workspace_mutation`; `list_file_workspace` (`:616`) does not. Registration of the created file is `:892` | Fix | Record retirement candidates before the walk. The snapshot commit removes only an id from that set whose stored path, identity, and purpose are unchanged and which this listing did not reuse. The commit clones `persistent` under the lock at commit time. No new lock | The retirement the annotation requires would otherwise delete a live handle. Predicate on the existing candidate, not a new protocol | closed, round 2: review-plan |
| R1-04 | At the cap, preflight refuses a new identity before retirement can free its predecessor, so a changed tree never recovers | review-plan should-fix; review-error-handling should-fix; review-tauri-security blocker | `persist_workspace_child` mints `PathRef::fresh()` at `:7281` when the lookup at `:7255` misses. Growth past the cap fails at `:8216-8221` | Fix | Same snapshot candidate as R1-01 for a lookup that misses and mints: workspace identity miss and database find miss. A puzzle same-path identity change returns the existing `Conflict` at `mod.rs:5357` and the snapshot commit does not run, so the previous id stays. No new identity-replacement path. Round-2 witnesses: review-plan blocker; review-error-handling and review-tauri-security closed the net comparison and did not dispute this limit | Annotation sentence that a changing tree fills `MAX_AUTHORITY_IDS`. The puzzle sentence is the existing registrar, verified at `mod.rs:6222` and `:5357-5360` | closed, round 3: review-plan and review-tauri-security |
| R1-05 | `sync_windows_tree` also calls `enumerate_directory`; a listing limit there bounds install sync | review-correctness should-fix; review-platform-semantics should-fix 2 | `fs.rs:3465` is `sync_windows_tree`. `fs.rs:3371` is `remove_windows_tree_at`. The round-1 premise had labelled both as removal | Fix | Both callers pass no limit. The listing reader passes the limit. Source pins cover both call sites | Not-in-scope already excludes bounding `sync_tree` and removal. Naming the caller stops the new argument from expanding into them | closed, round 2: review-plan, review-correctness, review-platform-semantics |
| R1-06 | The filtered proof exits 0 when it runs zero tests, and `--lib` is not a target | review-tests blocker | Measured: `cargo metadata` targets are `bin` and `custom-build`. `cargo test --bin chessfable directory_listing_bound_no_such_test_zz` printed `running 0 tests` and exited 0 | Fix | `set -euo pipefail`, and both `directory_listing_bound` and `infra::platform_support` go through the passed-count check before later commands. Measured: pipefail alone printed `STILL` and exited 0; `set -euo pipefail` stopped and exited 1 | Verification of the MANDATE bound. A green zero-match run, or a later command masking a failed count, would not show the cap | closed, round 3: review-plan and review-tests |
| R1-07 | Host tests do not compile Windows or prove macOS runtime | review-platform-semantics should-fix 1 | Push skill §2: `pnpm rust:windows:check` is the local GNU clippy. §4 waits on `rust-windows-test`, `rust-macos-test`, `rust-platform`. `read_directory_entries_at` is `cfg(unix)` and the host tests run it. `mod.rs:43` compile-errors other unix OSes | Fix | Host tests of the `cfg(unix)` cap, `pnpm rust:windows:check`, and the three CI jobs. The file-wide freebsd flip is measured red on HEAD `b13f3b52` (exit 101: missing worktree `dist`, macOS `StatFs`/`MNT_UNION` at `infra/fs.rs:1251,1263,1268`, linux-only engine methods dropped while unflipped callers remain) and is not a phase gate. Do not rewrite those branches. A new linux cfg line, if the phase adds one, is flipped alone in a worktree with the worktree manifest, the guard kept, and checkout `dist` symlinked. Focused judgment `lens-plan-focus-r1` APPROVED this | Platform evidence for the Windows enumerator and the shared unix reader. Clause 8 names the flip; the measurement shows that flip cannot pass on these files without rewriting pre-existing branches | closed, round 4: review-plan and review-platform-semantics (error-handling also closed it) |
| R1-08 | The `Option` limit argument is executor detail and should leave the plan | review-plan should-fix | The argument is what keeps `remove_windows_tree_at` and `sync_windows_tree` unbounded (R1-05). The pins quote the signature | Skip | No change. Removing the argument from the plan would hide the obligation those pins enforce | — | closed, Skip |
| R2-01 | A cap refusal can persist canonical-operation rewrites that the plan says the refusal does not write | review-error-handling should-fix 1 (round 2) | Plan text put per-entry canonicalization commits (`mod.rs:5371-5378`, `:6337-6344`, `:7268-7275`) on the reuse path and also said the preflight refusal writes nothing, without ordering the refusal first | Fix | The `mod.rs:8216` comparison runs before any per-entry canonicalization commit. A refusal writes nothing. A canonicalization commit after a passing preflight still returns before the snapshot commit on failure and retires nothing | The annotation's "writes nothing" on a refused listing. Ordering the existing commit, not a new protocol | closed, round 3: review-plan and review-error-handling |
| R3-01 | An unconditional cap on `read_directory_entries_at` makes macOS startup fail after it has created entries the next launch cannot sweep | review-error-handling should-fix (round 3 late observation); review-plan blocker (round 4) | Confirmed: lock at `mod.rs:3042-3056`, instance dir at `:3069`, sweep `?` at `:3072` via `read_directory_entries_at` at `:2936`. Startup maps the error at `main.rs:2488-2491` and fails the build. Round-4 residual confirmed: `AuthorizedDir::entries` calls `read_directory_entries_at` at `mod.rs:1144`; windows body at `fs.rs:194` calls `read_directory_entries`; that calls `enumerate_directory` at `fs.rs:3050` with no limit argument | Fix | Both `cfg` bodies of `read_directory_entries_at` take `Option<usize>`. Windows `read_directory_entries` forwards that `Option` and does not write `Some` itself. The windows body forwards it. Only `CapabilityDirectory::entries` passes `Some`. The sweep and `AuthorizedDir::entries` pass `None`, and that `None` survives the wrapper. No sweep cleanup protocol. Host test: unix reader with `None` returns 4097 names; `Some(4096)` returns `ResourceLimit`. Windows proof is the `source_for("infra/fs.rs")` pin plus `pnpm rust:windows:check` | The finding names user-chosen listings through `collect_tree_entries` and `map_db3_children_cancellable`. The same optional limit already keeps Windows removal and sync unbounded (R1-05). An unconditional cap, including one hidden inside the windows wrapper, would cap practice reads and would make the startup path non-recoverable | closed, round 5: review-plan and review-platform-semantics |
| CR-1 | Listing tests can pass while the IPC category mapping regresses | review-tests should-fix (round 3 late observation) | `error.rs:341` maps `ResourceLimit` to `ErrorCategory::ResourceLimit`. The plan's behavioural tests assert the variant only | Fix — carried to CR-1 | A phase test builds `Error::ResourceLimit` and asserts the serialized command category is `resource-limit`. `error.rs` may gain that case. No renderer copy | Unchanged obligation: the existing category is what the renderer already maps | carried |

### Round 2 raw verdicts

Adopted this round: R1-04 (qualify puzzle `Conflict`), R1-06 (fail-fast proof), R1-07 (freebsd source probe), R2-01 (preflight before canonicalization). Closed without a further correction: R1-01, R1-02, R1-03, R1-05. Open after this revision: R1-04, R1-06, R1-07, R2-01.

review-plan REVISE:

```
R1-01 CLOSED — R2 plan:70,131 commits the snapshot before game counting and tests subsequent failure/cancellation; `src-tauri/src/file_workspace.rs:603,605,609` confirms those later failure paths.

R1-02 CLOSED — R2 plan:75,132 distinguishes hard failure from adopted uncertainty and requires fault injection; `src-tauri/src/infra/path_authority/mod.rs:8128,8130,2274` supports that distinction.

R1-03 CLOSED — R2 plan:66,133 limits retirement to unchanged pre-walk records and preserves later inserts in the commit-time clone; `src-tauri/src/file_workspace.rs:494,498,892` confirms the concurrent-registration window.

[blocker] R1-04 NOT CLOSED — tasks/plans/.plan-2026-10-03-directory-listing-bound-r2.body.md:64 promises replacement admission for workspace, database and puzzle listings using their existing lookup. Contrary evidence: puzzle registration calls the generic registrar at `src-tauri/src/infra/path_authority/mod.rs:6222`, whose lookup matches the stored path before rejecting a changed identity at `:5357`. Replacing an already-listed puzzle file under the same filename therefore produces `Conflict`, rather than a fresh candidate identity; plan:71,73 prevents retirement after that failure. Qualify the replacement promise or specify listing-scoped handling and proof for this case. (confidence: 95)

R1-05 CLOSED — R2 plan:54,135 explicitly leaves both Windows removal and sync unlimited; their enumerator calls exist at `src-tauri/src/infra/fs.rs:3371,3465`.

[blocker] R1-06 NOT CLOSED — tasks/plans/.plan-2026-10-03-directory-listing-bound-r2.body.md:140 enables only `pipefail`; the failing zero-match guard at :143 has no explicit exit propagation before subsequent commands at :144–146. The block therefore lacks a guaranteed failing overall result when no tests match. Require fail-fast execution or explicit status propagation, and evidence for the complete block; plan:149 records only the isolated Cargo zero-match probe. Whole-block execution remains unverified under this assignment’s reading-only rail. (confidence: 95)

R1-07 CLOSED — R2 plan:146,149 adds the Windows gate and names runtime CI evidence; `scripts/rust-windows-check.mjs:35` compiles all Windows targets, and `.github/workflows/test.yml:15,54,82` defines the named jobs.

VERDICT: REVISE
```

review-correctness APPROVED:

```
R1-01 CLOSED — the snapshot commit precedes game counting; later count errors or cancellation return `Err` with the committed snapshot retained.
R1-02 CLOSED — uncertain durability adopts the candidate and is not retried; a hard write error does not adopt it.
R1-05 CLOSED — `remove_windows_tree_at` and `sync_windows_tree` pass no listing limit; the listing reader passes one.

VERDICT: APPROVED
```

review-error-handling APPROVED:

```
R1-04 CLOSED — the net `unique_ids` comparison allows a one-for-one replacement at the cap and rejects growth.

[should-fix] tasks/plans/.plan-2026-10-03-directory-listing-bound-r2.body.md:62 — The plan allows per-entry commits for canonical-operation rewrites but does not place the cap preflight before them. If a later cap refusal returns `ResourceLimit`, those rewrites may already be persisted, despite the plan saying the refusal writes nothing (confidence: 89).

VERDICT: APPROVED
```

review-tauri-security APPROVED:

```
R1-04 CLOSED — The net-candidate comparison admits a one-for-one replacement at the cap and refuses growth past it (plan lines 64, 129).

VERDICT: APPROVED
```

review-tests REVISE:

```
[blocker] R1-06 NOT CLOSED — the test-count check can fail, but the proof continues to later commands that can leave the block successful.

[blocker] tasks/plans/.plan-2026-10-03-directory-listing-bound-r2.body.md:143 — If a regression makes the matched tests fail, the Python check returns nonzero, but the later test, formatting, and Windows-check commands still run; their success can mask that failure. The `infra::platform_support` filter at line 144 also has no positive-count check, so it can pass with zero matches. (confidence: 98)

VERDICT: REVISE
```

review-platform-semantics REVISE:

```
R1-05 CLOSED — The r2 plan specifies that both Windows callers pass no listing limit, and the phase acceptance checks that behavior.

[should-fix] R1-07 NOT CLOSED — The Windows compile check and CI jobs were added, but the plan still omits the required non-Linux Unix source probe.

[should-fix] tasks/plans/2026-10-03-directory-listing-bound.md:149 — The proposed phase proof does not include the non-Linux Unix source probe for the changed shared reader. Linux host tests exercise the Linux configuration; the compile error for unsupported Unix targets does not establish this probe’s result. The named `rust-macos-test` remains the runtime proof. (confidence: 95)

VERDICT: REVISE
```

### Round 3 raw verdicts

Adopted this round: R3-01 (optional listing limit; sweep and `AuthorizedDir::entries` pass `None`). Carried, not adopted: CR-1. Closed without a further correction: R1-04, R1-06, R2-01. R1-07 failed closure a second time (checkout manifest, and the flip rewrites the `mod.rs:43` guard). The probe paragraph is left as the rejected text. Escalation: disposable guard-exempt probe, then a focused `review-plan` judgment. Not a wording patch.

review-plan REVISE:

```
R1-04 CLOSED — r3 plan:66,133 limits replacement admission to workspace/database and preserves puzzle `Conflict`; confirmed by `src-tauri/src/infra/path_authority/mod.rs:5357,6222,6349,7281`.

R1-06 CLOSED — r3 plan:144–153 enables fail-fast execution and checks positive test counts for both filters; plan:158 records the measured shell result.

[blocker] R1-07 NOT CLOSED — tasks/plans/.plan-2026-10-03-directory-listing-bound-r3.body.md:162 directs the throwaway-worktree probe to the original checkout’s absolute manifest. It therefore compiles the original sources, including the source pins embedded at `src-tauri/src/infra/platform_support.rs:1886`, and cannot detect defects in the flipped worktree. Use that worktree’s manifest. (confidence: 99)

R2-01 CLOSED — r3 plan:64,68,133 explicitly places admission before canonicalization commits and requires a refusal to persist no rewrite; those existing writes are confirmed at `src-tauri/src/infra/path_authority/mod.rs:5377,6344,7275`.

[blocker] tasks/plans/.plan-2026-10-03-directory-listing-bound-r3.body.md:162 — Even after correcting the manifest, blanket replacement of Linux cfg expressions changes the supported-platform guard at `src-tauri/src/infra/path_authority/mod.rs:43`, activating its `compile_error!` at :44 on the Linux host. The prescribed probe cannot pass. Specify a focused substitution that preserves the platform guard and accounts for existing platform-specific dependencies. (confidence: 99)

VERDICT: REVISE
```

review-tests APPROVED:

```
R1-06 CLOSED — `tasks/plans/2026-10-03-directory-listing-bound.md:144`, `:150`, and `:153` make the proof fail fast and check both filters for a positive passed count; the measured shell probe at `:158` confirms failure stops later commands.

LATE OBSERVATIONS

[should-fix] `src-tauri/src/error.rs:341` — The listing tests assert the `Error::ResourceLimit` variant, but none asserts that it serializes to IPC category `resource-limit`. The existing frontend test uses a hand-built payload, and the Rust serializer cases omit this variant. If its category mapping regresses, the planned listing tests and proof commands still pass while the renderer receives a different category. (confidence: 87)

VERDICT: APPROVED
```

review-platform-semantics REVISE:

```
[should-fix] R1-07 NOT CLOSED — The Windows compile check and CI jobs are named, but the FreeBSD probe as written trips the unsupported-Unix compile guard before reaching the non-Linux branch.

[should-fix] tasks/plans/.plan-2026-10-03-directory-listing-bound-r3.body.md:162 — The probe flips `target_os = "linux"` in `path_authority/mod.rs`, making its guard at line 43 true on the Linux host; `cargo check` hits `compile_error!` instead of checking the Unix reader. Preserve that guard or explicitly exempt it from the scratch flip. (confidence: 99)

VERDICT: REVISE
```

review-error-handling APPROVED:

```
R2-01 CLOSED — r3:64 puts the net comparison before per-entry writes and says a refusal writes nothing; r3:68 defines what a later canonicalization failure leaves behind.

LATE OBSERVATIONS

[should-fix] tasks/plans/.plan-2026-10-03-directory-listing-bound-r3.body.md:107 — The specified cap can leave macOS unable to start: `initialize_engine_launch_root` creates its lock file and instance directory before the sweep (`mod.rs:3032`), then propagates a `ResourceLimit`; setup propagates that error out of `Builder::build` (`main.rs:2487`). The failed attempt leaves both entries behind, so later launches add entries and cannot recover by sweeping. Define cleanup or recovery for this path (confidence: 94)

VERDICT: APPROVED
```

review-tauri-security APPROVED:

```
R1-04 CLOSED — r3 states that a puzzle same-path identity change returns `Conflict`, writes no fresh ID, and does not retire the prior ID (plan lines 66, 133).

VERDICT: APPROVED
```

### Focused judgment (R1-07, second closure failure)

Contested invariant: clause 8's file-wide `target_os = "linux"` to `target_os = "freebsd"` flip is the non-Linux Unix compile proof. Previous answers: round 2 omitted it; round 3 wrote a checkout-manifest flip that also rewrites the `mod.rs:43` guard. New evidence: guard-exempt flip of `infra/fs.rs` and `path_authority/mod.rs` on HEAD `b13f3b52`, worktree manifest, exit 101 (missing `dist`, macOS libc/`StatFs` symbols, linux-only engine methods dropped). Judgment from `lens-plan-focus-r1`, pasted as returned:

```
R1-07 JUDGMENT — Adopt the candidate; it is the simplest mechanism that satisfies clause 8 and the supplied acceptance. Replace the rejected probe paragraph at `tasks/plans/2026-10-03-directory-listing-bound.md:164` with the recorded orchestrator measurement: on HEAD `b13f3b52`, the guard-preserving flip in `/tmp/cf-freebsd-probe-12e7ce13` exited 101 under `cargo check --manifest-path /tmp/cf-freebsd-probe-12e7ce13/src-tauri/Cargo.toml --bin chessfable --tests --offline`. Besides missing `dist`, it exposed pre-existing macOS ABI dependencies (`infra/fs.rs:1251`, `:1263`, `:1268`) and removed Linux engine methods still required by callers (`path_authority/mod.rs:1446`, `:1766`, `:1802`; `engine/process.rs:2321`, `:2338`). Supplying `dist` cannot resolve those source errors; the file-wide flip cannot pass without rewriting pre-existing branches. Record that result as a probe limitation, exclude it from phase gates, and preserve those branches and the guard at `mod.rs:43`. Require host behavioral tests, a source pin proving the optional cap remains inside the shared `cfg(unix)` reader (`infra/fs.rs:135`) and applies only for `Some`, and passing `pnpm rust:windows:check`. Name `rust-macos-test` and `rust-windows-test` as runtime proof and `rust-platform` as target compile/clippy proof; their jobs exist at `.github/workflows/test.yml:54`, `:82`, and `:15`. If the phase introduces Linux-specific cfg branches, probe only those new branches in a disposable worktree, preserve the guard, use the worktree manifest, and provide its `dist` symlink. No such branch is planned today. This approves the candidate obligation; implementation and platform execution remain to be verified.

VERDICT: APPROVED
```

The obligation is written into the phase proof. Closure of that text, and of R3-01, is the next numbered round.

### Round 4 raw verdicts

Adopted this round: none. R3-01's round-4 residual is a continuation of that ID, not a new adoption. Closed: R1-07. Open after this revision: R3-01 (windows forward). Error-handling is not relaunched: its sweep and `None` story is unchanged.

review-plan REVISE:

```
R1-07 CLOSED — r4 plan:140,157,162,164 adopts the focused judgment: shared Unix cap tests and source pin, Windows compile check, named runtime CI jobs, and the recorded-red flip as a limitation. The jobs exist at `.github/workflows/test.yml:15,54,82`; the cited platform dependencies remain in `src-tauri/src/infra/fs.rs:1251,1263,1268`.

[blocker] R3-01 NOT CLOSED — tasks/plans/.plan-2026-10-03-directory-listing-bound-r4.body.md:54 still instructs `read_directory_entries` to pass `Some(MAX_DIRECTORY_LISTING_ENTRIES)`. On Windows, `AuthorizedDir::entries` reaches that same wrapper through `read_directory_entries_at` (`src-tauri/src/infra/path_authority/mod.rs:1144`; `src-tauri/src/infra/fs.rs:194,3050`). Passing `None` at the outer caller therefore cannot preserve unbounded practice reads if the wrapper supplies `Some`. Require forwarding the caller’s option through the Windows wrapper, and proof that `None` successfully lists 4097 entries; the caller-only pins at plan:140 would miss this regression. (confidence: 95)

VERDICT: REVISE
```

review-platform-semantics APPROVED:

```
R1-07 CLOSED — r4 records the measured FreeBSD flip failure as a limitation, retains host tests and `pnpm rust:windows:check`, names the CI jobs, and scopes any future flip to new Linux-specific branches ([plan](/home/felixb/Projekte/chessfable/tasks/plans/.plan-2026-10-03-directory-listing-bound-r4.body.md:162), [probe](/home/felixb/Projekte/chessfable/tasks/plans/.plan-2026-10-03-directory-listing-bound-r4.body.md:164)).

R3-01 CLOSED — The plan caps user listings through `CapabilityDirectory::entries` while leaving the macOS sweep and `AuthorizedDir::entries` unbounded ([approach](/home/felixb/Projekte/chessfable/tasks/plans/.plan-2026-10-03-directory-listing-bound-r4.body.md:54), [acceptance](/home/felixb/Projekte/chessfable/tasks/plans/.plan-2026-10-03-directory-listing-bound-r4.body.md:140)).

VERDICT: APPROVED
```

review-error-handling APPROVED:

```
R1-07 CLOSED — The delta records the red file-wide probe and retains the host tests, Unix source pin, Windows check, and CI evidence. The `resource-limit` IPC category assertion keeps listing failures observable (plan:140–165).

R3-01 CLOSED — User listings pass the cap; `sweep_engine_launch_root` and `AuthorizedDir::entries` pass no limit, so the startup failure path remains uncapped (plan:54,107,140).

VERDICT: APPROVED
```

Disposition. R1-07 is closed. All three lenses closed it against the judged probe paragraph. Do not reopen it. The freebsd paragraph stays the recorded-red limitation.

R3-01 stays open. Review-plan's blocker matches the source: `AuthorizedDir::entries` calls `read_directory_entries_at` at `mod.rs:1144`; the windows body calls `win::read_directory_entries` at `fs.rs:194`; that function calls `enumerate_directory(dir, cancellation)` at `fs.rs:3050` with no limit. A `Some` written inside `read_directory_entries` would cap every windows caller of `read_directory_entries_at`, including practice. Platform's and error-handling's `CLOSED` lines judge the pre-correction sentence. They are preserved and are not closure of the forward. The correction keeps the ID: `read_directory_entries` forwards the `Option`; only `CapabilityDirectory::entries` passes `Some`; a host test lists 4097 names when the unix reader is given `None` and returns `ResourceLimit` for `Some(4096)`; the windows pin shows the wrapper forwarding and containing no `Some(MAX_DIRECTORY_LISTING_ENTRIES)`. This is the first failed closure of that residual. It is not escalated. The next round re-reviews `review-plan` and `review-platform-semantics`. Error-handling's sweep story is unchanged, so that lens is not relaunched.

### Round 5 raw verdicts

Adopted this round: none. Closed: R3-01. No open plan-level issue remains. CR-1 stays carried.

review-plan APPROVED:

```
R3-01 CLOSED — Final candidate r5, tasks/plans/.plan-2026-10-03-directory-listing-bound-r5.body.md:54, specifies forwarding the caller’s `Option` through both Windows wrappers, matching the chain at src-tauri/src/infra/path_authority/mod.rs:1144 and src-tauri/src/infra/fs.rs:194,3050. Plan:127,140 requires the 4097-name Unix `None` test, Windows forwarding pins, and Windows compile check. Removal, sync, sweep, and practice reads remain unbounded. This closes the plan correction; implementation proof remains pending.

VERDICT: APPROVED
```

review-platform-semantics APPROVED:

```
R3-01 CLOSED — the revised plan ([line 54](/home/felixb/Projekte/chessfable/tasks/plans/.plan-2026-10-03-directory-listing-bound-r5.body.md:54)) forwards the Windows `Option` through both wrappers; lines 107 and 140 preserve and pin `None` for `AuthorizedDir` and the sweep. It specifies `pnpm rust:windows:check` as compile-only and names the Windows and macOS test jobs for runtime proof (lines 140 and 162). No phase-specific non-Linux Unix source probe is planned; the prior file-wide FreeBSD flip is recorded as red (line 164).

VERDICT: APPROVED
```

Disposition. R3-01 is closed. Both required witnesses closed the forward. The recorded-red freebsd paragraph was not in this delta and stays closed under R1-07. Plan review ends.
