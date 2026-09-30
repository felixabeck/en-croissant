# SQLite leaf open without a foreign close (f-20260929-06) — plan and diff review record

Scope: `f-20260929-06` (root `sqlite-pathname-open`) — the bound SQLite unix `open` hook must refuse
a swapped or unverifiable leaf without ever closing a lockable descriptor of an inode this process
may hold POSIX locks on, and without unbounded retention. Plan (ignored run artefact):
`tasks/plans/2026-09-29-sqlite-leaf-open-no-foreign-close.md`. This tracked record preserves the
complete issue and round history so that the plan, its snapshots and the lens reports under `/tmp`
may disappear. Governing decisions (input): `d-20260929-04`, `d-20260929-05`. Decision recorded by
this run: `d-20260930-10`. Predecessor record: `tasks/handoffs/2026-09-29-sqlite-pathname-open-review.md`.

## Lineage and run facts

* Interactive `full auto` build run, two sessions. Plan and plan review: Claude Code session
  `d4edd5c8-b834-46cd-aec7-058afcc03b66`, 2026-09-29 21:52 – 2026-09-30 00:20 CEST. Implementation,
  cumulative review, gates and push: session `68d0cce0-18f9-4c4b-8eb8-cf5d43283c6d`,
  2026-09-30 from 19:29 CEST. Pause between approval and implementation ≈ 19 h (not review time).
* Orchestrator: Claude Code (Opus 5.5). Executor: Codex (`gpt-6-luna`; `review-plan` role for the
  plan lens, `sensitive` for every other lens, the phase and the fix rounds). Plan authorship and
  arbitration shared one context; detection ran in separate Codex processes of a different model
  family.
* Measurements (rule 12b) are in the plan's `## Measurements`: on atlas (kernel 7.0), closing an
  `O_PATH` descriptor leaves the process's POSIX locks intact while closing a plain one releases
  them; `/proc/self/fd/<n>` reopens the verified inode after a name swap; the reopen must not
  carry `O_NOFOLLOW`; `O_PATH` on a FIFO returns without blocking.
* Plan review: 9 completed rounds, no rewrite, no split, no pauses; ≈ 2 h 28 min (21:52–00:20).
  Per-round wall time (plan snapshot to last report): r1 15 min (7 lenses), r2 23 (5), r3 18 (4),
  r4 17 (2), r5 16 (2), r6 17 (2), r7 19 (2), r8 19 (2), r9 15 (2). Waits are not separable from
  active review.
* `plan_adopted_per_round`: r1=4 r2=5 r3=2 r4=2 r5=4 r6=2 r7=2 r8=2 r9=0. Unique plan issues: 28
  (A1–A5, B1–B6, C1–C2, D1–D2, E1–E4, F1–F2, G1–G2, H1–H2), open 0. Defer (filed): A4 →
  `f-20260929-10`, B1 → `f-20260929-11`. Skip: none.
* Drift check before implementation: approved on `cd8d4a7a`, implemented on `adc0afae`;
  `bound_sqlite.rs` and `infra/fs.rs` unchanged, `repository.rs` changed only in drain/retirement
  code with no plan-named symbol touched; O4 anchors moved (reference-only). No lens round.
* Implementation: one phase, one Codex write leaf (≈ 32 min) → `0e2d799b`; one fix round in two
  resumes of the same thread (≈ 18 min; the first stopped on a `cargo fmt --check` diff) →
  `83ec7fd6`. Orchestrator red-on-revert, on both commits: `O_PATH` → `O_RDONLY` reddens O5 (a),
  (c), (d); a name-based reopen reddens (b) (`left: 2, right: 1`).
* The non-Linux unix code is compiled and run only by macOS CI; nothing here measured it.

## Cumulative diff review (`adc0afae..83ec7fd6`)

Eight Codex lenses over `adc0afae..0e2d799b`, all `--role sensitive`: correctness REVISE,
root-cause REVISE, code-quality REVISE, error-handling APPROVED, minimalism REVISE, tests APPROVED,
pgn-index REVISE, tauri-security REVISE. Findings below 80 confidence: none. The orchestrator added
its own findings (O-prefixed) from reading the diff and one probe.

| ID | Claim | Witnesses (confidence) | Disposition |
|---|---|---|---|
| R1 | Non-Linux admission and unclassified witnesses mutate process-global registry state; the in-module mutex serializes only them, so parallel tests get `EMFILE` and the bucket-drain assertion fails while any other binding is live | correctness (98), tests (97), orchestrator | Fix `83ec7fd6`: those witnesses run through `db::test_support::run_isolated`; mutex removed |
| R2 | Repository `open_current` probes (pre/post `get()`, classifier) still open and close the target leaf lockably; the new `EMFILE` and reopen failures reach the classifier probe | root-cause (96) | Defer — existing `f-20260929-11` (plan B1) |
| R3 | Non-Linux path not compiled or run locally | root-cause (100), error-handling, tauri-security (limitations) | Skip(covered by the push gate: the macOS CI job on the pushed SHA is waited for and gates the run) |
| R4 | `MAX_QUARANTINED_DESCRIPTORS_PER_IDENTITY` names an admission threshold that retention may exceed and that also governs the unclassified bucket; test name claims a cap | code-quality (99) | Fix `83ec7fd6`: `QUARANTINE_ADMISSION_LIMIT`, test split and renamed |
| R5 | A `/proc/self/fd` reopen failure maps to `Error::InvalidInput` | error-handling (93) | Defer — existing `f-20260929-10` (plan A4) |
| R6 | The admission test repeats the fill/refuse/over-limit sequence per set type | minimalism (86) | Fix `83ec7fd6`: one shared helper, two isolated tests |
| R7 | Non-Linux: a FIFO swapped in between `fstatat` and a blocking `openat` hangs the read-only open before the identity check (pre-existing; Linux is no longer affected since `O_PATH`) | pgn-index (93), tauri-security (95) | Defer — same design question as `f-20260929-03` (non-regular sidecars, `O_NONBLOCK`); annotated `dd586de7` with the added no-close constraint |
| O1 | `drop(first)` moved after the assertions in `leaf_identity_stat_refuses_a_parked_descriptor_for_another_inode`, so no descriptor is parked any more | orchestrator (probe: restored placement passes) | Fix `83ec7fd6` |
| O2 | Module doc lost the plain-pathname production invariant | orchestrator | Fix `83ec7fd6` |
| O3 | Linux and non-Linux lock-probe helpers duplicate the lock-query construction | orchestrator (rule 11) | Fix `83ec7fd6` |
| O4 | `leaf_open_is_admitted` refused every leaf open forever after a registry poison, unlike every other registry access | orchestrator | Fix `83ec7fd6` |
| O5 | Duplicated `/proc` reopen call across `cfg(test)`/`cfg(not(test))`; redundant nested cfg attributes | orchestrator | Fix `83ec7fd6` |

The fix diff was read in full by the orchestrator; it also corrected a latent defect in the old
unclassified recovery check (it asserted a hook set on an already dropped binding). No second lens
round over the fix diff.

## Successor ownership

No successor inherits an open issue of this run.

* `f-20260929-11` (`build`, root `sqlite-pathname-open`) owns plan issue B1 and review R2.
* `f-20260929-10` (`lens`) owns plan issue A4 and review R5.
* `f-20260929-03` (`build`) owns review R7 (annotation of 2026-09-30).

A successor working any of these should load this record before its own plan review.

## Plan review history (verbatim from the plan's `## Reviews`)

### Reviews

### Round 1 (r1) — 7 Codex lenses (plan `review-plan`, all others `sensitive`), 21:52–22:07

Raw verdicts: plan REVISE, minimalism APPROVED, correctness REVISE, tests REVISE, error-handling
APPROVED (two should-fix), pgn-index APPROVED, tauri-security APPROVED. Reports
`/tmp/build-d4edd5c8/lens-*-r1.txt`.

| ID | Claim | Witnesses (lens#finding, confidence) | Disposition | Correction (r2) |
|---|---|---|---|---|
| A1 | O4 changes the helper's signature but the surviving caller at `repository.rs:3525` still passes a path | correctness#1 (97) | Fix | O4 names that caller and its probe lifetime |
| A2 | No witness proves the `O_PATH` descriptor is closed on the `fstat`-failure and reopen-failure paths; a leak passes lock-only assertions; no reopen-failure seam | plan#1 (95), tests#2 (93) | Fix | O5 (c) adds the descriptor-count assertion; new O5 (d) reopen-failure seam with lock and count assertions |
| A3 | macOS admission witness cannot tell "never opened" from "opened and closed a transient descriptor" | tests#1 (96) | Fix | Admission check precedes the pre-check and `openat`; witness asserts a pending before-leaf-open seam stays pending |
| A4 | A `/proc` reopen failure surfaces as `InvalidInput` through `map_sqlite_establish` | error-handling#1 (89) | Defer | Pre-existing mapping of every non-`NOTADB` establish failure (`error.rs:378-391`); not a MANDATE obligation; filed as `f-20260929-10` (`lens`) |
| A5 | Admission refusal counted as an identity refusal → false `Conflict` and retirement of an idle entry of an unchanged database | error-handling#2 (92) | Fix | Admission refusal returns `EMFILE` without `increment_refusal` (O2) |

Round 1 adopted: 4 (A1, A2, A3, A5). A4 Defer. Open: A1–A3, A5 pending r2 closure.

### Round 2 (r2) — 5 Codex lenses (plan, minimalism, correctness, tests, error-handling), 22:07–22:30

Raw verdicts: plan REVISE, correctness REVISE, tests REVISE, minimalism APPROVED, error-handling
APPROVED. Closure: A1, A2, A3 closed by plan, correctness, tests, error-handling, minimalism; A5
closed for the refusal counter (correctness, plan, error-handling), its repository-level promise
challenged by tests#4 (B6). A4 Defer upheld by all five. Reports `/tmp/build-d4edd5c8/lens-*-r2.txt`.
Note: the r1 minimalism report file is empty apart from its verdict line (`VERDICT: APPROVED`).

| ID | Claim | Witnesses | Disposition | Correction (r3) |
|---|---|---|---|---|
| B1 | The classifier's non-refusal path calls `open_current()`, opening and dropping the target leaf lockably → releases this process's POSIX locks; O1's `fstat`/reopen failures and O2's `EMFILE` take that path | correctness#1 (97) | Defer | Source trace widened it: `open_current` also runs and is dropped before and after every pooled `get()` (`repository.rs:775, 792, 961, 986`), so the mechanism is systemic in normal operation and a separate design question across every `open_current` consumer. Filed `f-20260929-11` (`build`, root `sqlite-pathname-open`); the plan's Risks section states the guarantee is the open hook's |
| B2 | `set_opened_name` failure after the reopen closes the reopened (lockable) descriptor | plan#1 (86) | Fix | O1 step 3 records the name while only the `O_PATH` descriptor exists; the reopen is the last fallible step |
| B3 | Admission witness does not fill the unclassified bucket or open through another binding | tests#1 (91) | Fix | Witness runs with both set types and opens through a different binding |
| B4 | O5 (b) does not count A's descriptors, so an `O_PATH` leak on the success path passes | tests#2 (96) | Fix | O5 (b) asserts A's descriptor count |
| B5 | A helper that releases the lock after answering passes a single assertion | tests#3 (94) | Fix | Every O5 lock witness queries twice |
| B6 | O2's promise about `Conflict`/retirement exceeds the MANDATE and is unwitnessed | tests#4 (96) | Fix | Promise removed; O2 keeps only the new refusal's own failure semantics (`EMFILE`, counter unchanged), which O5 witnesses at the hook |

Round 2 adopted: 5 (B2–B6). B1 Defer (filed `f-20260929-11`). Open: B2–B6 pending r3 closure.

### Round 3 (r3) — 4 Codex lenses (plan, correctness, tests, error-handling), 22:32–22:50

Raw verdicts: plan REVISE, tests REVISE, correctness APPROVED, error-handling APPROVED. Closed:
B3, B4, B5, B6 (all four lenses); B2's code ordering (correctness, error-handling) — its proof
reopened as C1. Defers upheld: A4 (all four), B1 (all four). Reports `/tmp/build-d4edd5c8/lens-*-r3.txt`.

| ID | Claim | Witnesses | Disposition | Correction (r4) |
|---|---|---|---|---|
| C1 (B2) | No witness forces `set_opened_name` to fail, so moving it back after the reopen passes every witness | plan#1 (95), tests#1 (98) | Fix | The step is made infallible (poisoned test log recovered with `into_inner`); with no failure path there is nothing to move back or witness |
| C2 | O5 (c)/(d) through `read_revision` would run the classifier's `open_current` probe on a non-refusal error, releasing A's lock for an unrelated reason | plan limitation (98) | Fix | (c)/(d) open through a pre-acquired binding's URI directly; (a) is an identity refusal (classifier returns before probing) and (b) succeeds, so both keep `read_revision` |

Round 3 adopted: 2 (C1, C2). Open: C1, C2 pending r4 closure.

### Round 4 (r4) — 2 Codex lenses (plan, tests), 22:48–23:05

Raw verdicts: plan REVISE, tests REVISE. Closed: C1, C2 (both lenses). Defers upheld: A4, B1
(both). Reports `/tmp/build-d4edd5c8/lens-*-r4.txt`.

| ID | Claim | Witnesses | Disposition | Correction (r5) |
|---|---|---|---|---|
| D1 | Gating the quarantine field breaks `remove_registration_if_current` (runs from `Registration::drop` on every platform) and leaves `identity_has_live_registration` dead | plan#1 (97) | Fix | O2 gates the drain and the helper with the same cfg; proof names clippy + windows check |
| D2 | No witness for descriptors admitted concurrently at cap − 1; a reintroduced close-at-cap passes the serial admission tests | tests#1 (95) | Fix (alternative mechanism) | Deterministic unit test retains cap + 1 descriptors for one live identity and asserts all stay open; no thread race needed because the property is the retain function's, not the scheduler's |

Round 4 adopted: 2 (D1, D2). Open: D1, D2 pending r5 closure.

### Round 5 (r5) — 2 Codex lenses (plan, tests), 22:59–23:15

Raw verdicts: plan REVISE, tests REVISE. Closed: D1 (both), D2 for the identity set (both; tests
opened its unclassified half as E4). Defers upheld: A4, B1 (both). Reports
`/tmp/build-d4edd5c8/lens-*-r5.txt`.

| ID | Claim | Witnesses | Disposition | Correction (r6) |
|---|---|---|---|---|
| E1 | No non-Linux end-to-end witness of the post-open mismatch branch; the only one is Linux-only and is replaced | plan#1 (98) | Fix | The existing scenario runs under the non-Linux cfg and asserts retention of B's open descriptor |
| E2 | `quarantined_descriptor_fds` loses its `test` cfg → unused in macOS production under `-D warnings` | plan#2 (94) | Fix | Accessor gated `cfg(all(test, unix, not(target_os = "linux")))` |
| E3 | O5 (b) passes if a revert bypasses its seam | tests#1 (97) | Fix | Every seam-driven witness asserts its seam ran / observes the swap |
| E4 (D2) | Unclassified bucket has no cap + 1 witness | tests#2 (89) | Fix | Cap + 1 test covers both set types |

Round 5 adopted: 4 (E1–E4). Open: E1–E4 pending r6 closure.

### Round 6 (r6) — 2 Codex lenses (plan, tests), 23:15–23:32

Raw verdicts: plan APPROVED, tests REVISE. Closed: E1 (plan), E2, E3, E4 (both). Defers upheld:
A4, B1 (both). Reports `/tmp/build-d4edd5c8/lens-*-r6.txt`.

| ID | Claim | Witnesses | Disposition | Correction (r7) |
|---|---|---|---|---|
| F1 (E1, E4) | macOS witness infers lock survival from an open descriptor (a dup-then-close regression passes); raw fd numbers can be reused by parallel tests | tests#1 (94) | Fix | Lock observed from a forked child's `F_GETLK` (async-signal-safe calls only), queried twice; retention checked by `fstat` identity |
| F2 | Admission witness with an unchanged leaf cannot tell admission-before-`fstatat` from after | tests#2 (92) | Fix | Full-set case with the leaf name denoting another inode: `EMFILE`, counter unchanged |

Round 6 adopted: 2 (F1, F2). Open: F1, F2 pending r7 closure.

### Round 7 (r7) — 2 Codex lenses (plan, tests), 23:29–23:48

Raw verdicts: plan REVISE, tests REVISE. Closed: F2 (both); F1 for the post-open mismatch witness
(both). Defers upheld: A4, B1 (both). Reports `/tmp/build-d4edd5c8/lens-*-r7.txt`.

Process defect: the r7 delta artefact `tasks/plans/.plan-delta-r7.diff` was overwritten by a
concurrent session's plan review of `2026-09-29-push-gate-parallelism.md` (same fixed filename), so
the r7 lenses received an unrelated DELTA (plan#2, 100). They reviewed the full plan and the history
packet; r8 carries both this plan's r6→r7 and r7→r8 deltas under run-unique filenames
(`tasks/plans/.plan-delta-f0929-06-r<N>.diff`).

| ID | Claim | Witnesses | Disposition | Correction (r8) |
|---|---|---|---|---|
| G1 (F1) | Unclassified `fstat`-failure and cap + 1 witnesses check retention/identity only; a dup-then-close regression passes | plan#1 (94), tests#1 (95) | Fix | Class rule: every non-Linux retention/refusal witness locks the fixture through a separate descriptor and asserts it with the forked-child probe |
| G2 | r7 DELTA artefact belonged to another plan | plan#2 (100) | Fix (process) | Deltas regenerated under run-unique names; r8 packet carries r6→r7 and r7→r8 |

Round 7 adopted: 2 (G1, G2). Open: G1, G2 pending r8 closure.

### Round 8 (r8) — 2 Codex lenses (plan, tests), 23:49–00:08

Raw verdicts: plan APPROVED, tests REVISE. Closed: G1, G2 (both). Defers upheld: A4, B1 (both).
Reports `/tmp/build-d4edd5c8/lens-*-r8.txt`.

| ID | Claim | Witnesses | Disposition | Correction (r9) |
|---|---|---|---|---|
| H1 | O4 line anchors stale (`:2984` → `:3090`, `:3525` → `:3631` at `HEAD`) | plan nit (99) | Fix (reference-only) | Anchors refreshed; no semantic or proof change, so no lens round for it (rule 12a) |
| H2 | Unclassified-bucket witness does not show the bucket survives the failing binding's drop while another registration (owning the descriptor's inode and a lock) is live | tests#1 (92) | Fix | Witness: A's name swapped to B, `fstat` failure injected, drop A → descriptor retained and B's lock held; drop B → released |

Round 8 adopted: 2 (H1, H2). Open: H2 pending r9 closure.

### Round 9 (r9) — 2 Codex lenses (plan, tests), 00:05–00:20

Raw verdicts: plan APPROVED, tests APPROVED. Closed: H2 (both), H1 (plan). Defers upheld: A4, B1.
Reports `/tmp/build-d4edd5c8/lens-*-r9.txt`.

**Closure (r9):** every issue A1–H2 carries a disposition. Fix: A1–A3, A5, B2–B6, C1, C2, D1, D2,
E1–E4, F1, F2, G1, G2, H1, H2 — each closure-checked in a later round by `review-plan` and the lens
that witnessed it. Defer (filed): A4 → `f-20260929-10` (`lens`), B1 → `f-20260929-11` (`build`,
root `sqlite-pathname-open`). Skip: none. Latest raw verdicts: plan r9 APPROVED, tests r9 APPROVED,
correctness r3 APPROVED, error-handling r3 APPROVED, minimalism r2 APPROVED, pgn-index r1 APPROVED,
tauri-security r1 APPROVED. Completed rounds: 9, no rewrite, no split, no pauses; ≈ 2 h 28 min
(21:52–00:20). `plan_adopted_per_round`: r1=4 r2=5 r3=2 r4=2 r5=4 r6=2 r7=2 r8=2 r9=0. Unique issues:
28 (A1–A5, B1–B6, C1–C2, D1–D2, E1–E4, F1–F2, G1–G2, H1–H2), open 0. Correction-introduced: C1 (B2's
reordering left a test-only failure path), E1/F1/G1 (O2's platform split moved the only end-to-end
mismatch witness off macOS), H2 (the unclassified bucket introduced by O2).

### Drift check before implementation (2026-09-30, resumed session 68d0cce0)

Approved at r9 on `cd8d4a7a`; implementation resumed on `adc0afae` (61 commits later).
`src-tauri/src/db/bound_sqlite.rs` and `src-tauri/src/infra/fs.rs` are byte-unchanged over
`cd8d4a7a..adc0afae`. `repository.rs` changed in `3ed94336`, `e2fe7562`, `58892faf`, `5ca46acd`
(drain gate on retirement; `ConnectionTracker` → `DrainGate`); no `+`/`-` line of that diff names
`read_revision`, `refusal_count`, `LeafSwapGuard`, `test_target`, `open_current`, the classifier,
`assert_sqlite_shared_read_lock_is_held` or the quarantine (only a new test calls
`seed_database`). No obligation invalidated. Anchors only: O4 `repository.rs:3090` → `:3316`,
`:3631` → `:3817` — reference-only (rule 12a: semantics and proof unchanged), no lens round.
