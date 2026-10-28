# Review record: f-20261011-01

Plan: `tasks/plans/2026-10-28-renamed-database-idle-pool.md`.
Base: `6b600397549d5bd324205f0db8592dbe9b450ff6`.
Finding: `f-20261011-01`. Area `db-search`. Singleton cluster. No Skip. No Defer. No carried diff-review items.

The adopter records the plan's Decided autonomously entry with `record-decision` before implementation. This record does not record it.

Wall seconds are the round span from the earliest lens prompt mtime to the latest lens jsonl mtime. Parallel lens time is not summed. r1=646.876 r2=348.330 r3=383.521 r4=173.236 r5=92.840 r6=141.299.
Adoptions are Fix findings per completed round, not unique issues: r1=8 r2=4 r3=1 r4=1 r5=0 r6=0.

## Round 1

Review-plan, correctness, and tests: REVISE. Root-cause: APPROVED, one should-fix. Minimalism, code-quality, error-handling, platform-semantics, and tauri-security: APPROVED, no findings. Chess-semantics, engine-protocol, ipc-contract, persisted-state, and pgn-index: NOT APPLICABLE and APPROVED. Those five do not touch chess trees, UCI, IPC signatures, renderer persistence, or PGN. The plan's negative PGN rule was accepted.

Findings, all Fix:

* P1. Plan finding 1, blocker. Pool drainage did not preserve committed WAL frames after the external rename. Witness: plan r1 index 1.
* P2. Plan finding 2, blocker, and correctness finding 1, blocker. `entry_until` kept its construction `RetirementCapacity` across `close_retired_entry_until`, which reserves another slot. Witnesses: plan r1 index 2, correctness r1 index 1.
* P3. Plan finding 3, blocker, and tests finding 1, blocker. The proof command used unquoted pipes, so the shell split the filters. Witnesses: plan r1 index 3, tests r1 index 1.
* P4. Tests finding 2, should-fix. Reopening and a later WAL write did not prove that retry acquisition waits until retirement returns. Witness: tests r1 index 2.
* P5. Tests finding 3, should-fix. A live-link refusal retires nothing, so it does not prove the one-shot bound after a retirement that still conflicts. Witness: tests r1 index 3.
* P6. Root-cause finding 1, should-fix. The success assertions are the base failure and must not accept the admission conflict. Witness: root-cause r1 index 1.

## Round 2

Closure lenses: plan, correctness, tests, root-cause.

P2 CLOSED, P3 CLOSED, P5 CLOSED, and P6 CLOSED. Those lines are not findings. Root-cause APPROVED.

Findings, all Fix:

* P1 not closed. Plan finding 1, blocker, and correctness finding 1, blocker. An empty pool skipped the checkpoint. The pool can hold zero connections, and a close after the leaf has moved does not copy committed frames into the main inode. Calling that a known limit did not satisfy P1. Witnesses: plan r2 index 1, correctness r2 index 1.
* P7. Plan finding 2, blocker. The checkpoint inside the first `read_revision` changes length or mtime between `identity_from_probe`'s four samples, so `database_identity` rejects this call's own write. Witness: plan r2 index 2.
* P4 not closed. Tests finding 1, blocker. Releasing the `RetirementPublished` hook and the connection ticket together does not prove the drain wait. Plan's P4 CLOSED line in this round is not a finding and does not close it. Witness: tests r2 index 1.

P1's first correction is withdrawn here. The replacement is in the plan's Decided autonomously judgment.

## Round 3

Closure lenses: plan, correctness, tests.

P4 CLOSED and P7 CLOSED. Those lines are not findings. Correctness and tests APPROVED with no findings.

Finding, Fix:

* P1 not closed. Plan finding 1, blocker. A non-empty old wal could be moved when the retained leaf now names another inode, so a replacement sidecar could be attached to the renamed database. `probe_regular_file_at` does not establish wal ownership. Witness: plan r3 index 1.

## Round 4

Closure lenses: plan, correctness, tests.

P1 CLOSED. That line is not a finding. Correctness and tests APPROVED with no findings.

Finding, Fix:

* P8. Plan finding 1, blocker. The replacement-wal regression installs the replacement before selection, so an implementation that uses only that initial probe and skips the fresh probe still passes. The fresh probe has to be proven by a replacement that appears after selection and before sidecar handling. Witness: plan r4 index 1.

## Round 5

Closure lenses: plan, correctness, tests. All APPROVED. P8 CLOSED. No findings. Adoption count 0.

## Round 6

Drift lens: plan. Old base `6b600397549d5bd324205f0db8592dbe9b450ff6`. New base `bb80addae508958011b899ec6e746bc8456ddc3e`. The plan body is unchanged. `plan-review-delta.py` between plan-r5 and plan-r6 printed UNCHANGED.

Plan APPROVED. No findings. No changed symbol invalidates Failure and ownership's `database_admission` payload or any other named obligation. `src-tauri/src/db/repository.rs` and `src-tauri/src/db/bound_sqlite.rs` are absent from the drift. P1–P8 stay closed. No Skip. No Defer. Adoption count 0.

## Issues

* P1. Fix. Closed round 4. Depends on nothing. Idle pooled connection: `wal_checkpoint(TRUNCATE)` through that connection, returned before `retire_replaced`, no sidecar move. Zero connections: move a non-empty `<leaf>-wal`, and a regular `<leaf>-shm`, onto the new leaf before retirement only when a fresh `probe_regular_file_at` of the retained leaf is not-found or non-regular. A different identity, or the cached identity, with a non-empty wal returns the original admission conflict and does not move or retire. Absent or zero-length wal retires without a move. The database leaf is not opened.
* P2. Fix. Closed round 2. Depends on nothing. `entry_until` drops its construction `RetirementCapacity` before the helper and reserves again only after the single retry acquire succeeds. If that later reserve fails, the uninserted pool and binding are dropped. If the helper retires nothing, no second reservation is taken.
* P3. Fix. Closed round 2. Depends on nothing. Each proof command is one `cargo test` invocation with one unique substring filter. No pipeline and no regex union.
* P4. Fix. Closed round 3. Depends on nothing. The new-name open runs on another thread. The test releases `RetirementPublished` while the extra connection ticket remains, waits until the connection gate is waiting, requires the acquire count to stay at the pre-retirement attempt, then drops the ticket and requires success with the gate closed and outstanding 0.
* P5. Fix. Closed round 2. Depends on nothing. A `cfg(test)` helper-invocation counter stays at 1 when a hook-held `BoundDatabase` makes the retry acquire conflict. The live-link refusal remains a separate case.
* P6. Fix. Closed round 2. Depends on nothing. `connection` and `database_identity` success on the new name are the base failure. The tests must not accept the admission conflict.
* P7. Fix. Closed round 3. Depends on P1. When this call's checkpoint or moved-wal recovery writes the main file and the four identity samples disagree, `identity_from_probe` repeats the four-sample loop once. That flag is scoped to the identity read. Disagreement without that write still conflicts. The proof is `database_identity` with pending WAL frames.
* P8. Fix. Closed round 5. Depends on P1. A `cfg(test)` hook runs after stale selection and before the fresh retained-leaf probe. `vanished_rename_refuses_wal_replaced_after_selection` installs the replacement in that window and requires the admission conflict, the cached entry, and unchanged old wal bytes. The pre-installed replacement test stays. Selection-time refusal alone fails the new test.

## Not applicable reasons

* Chess-semantics: database binding admission and filesystem identity only. No in-memory chess tree, position, or move path.
* Engine-protocol: no engine process, UCI state, or result routing.
* IPC-contract: no command, event, binding, subscription, capability, or renderer payload change. Both admission messages stay `database_admission`.
* Persisted-state: no renderer storage, atom, hydration, or tab lifecycle.
* PGN-index: game boundaries, the byte-offset index, move encoding, search predicates, and `CastlingMode` stay unchanged.


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
    "artefact": "lens-code-quality-r1.jsonl",
    "findings": [],
    "lens": "code-quality",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-code-quality-r1.prompt",
    "report": "lens-code-quality-r1.txt",
    "round": 1,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-correctness-r1.jsonl",
    "findings": [
      {
        "kind": "blocker",
        "text": "/tmp/drain-plan-drain-90a2aa88-slot0/build/plan-r1.md:88 — The retirement call retains `entry_until`’s capacity reservation, while `close_retired_entry_until` reserves another slot. With 16 concurrent opens of renamed idle databases, each builder can hold one reservation before entering the helper. All then wait for a seventeenth slot, so progress requires a timeout despite every holder being idle. The plan must release or transfer the construction reservation before retirement and restore it when needed for insertion. (confidence: 96)"
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
    "findings": [
      {
        "kind": "blocker",
        "text": "/tmp/drain-plan-drain-90a2aa88-slot0/build/plan-r2.md:90 — Skipping checkpoint when the pool is empty can admit the renamed database with committed rows missing. Concrete case: commit a row without checkpointing, rename only the main file, then leave it idle until r2d2’s default ten-minute reaper closes the last connection. The locked SQLite version skips checkpoint-on-close for the moved file, leaving committed frames under the old WAL name. The proposed helper then skips checkpoint, retires the entry, and opens the new name against the older main-file contents. Calling this a known limit does not satisfy the required preservation of committed WAL frames. An empty pool must not authorize admission without establishing that those frames were preserved. (confidence: 98)"
      }
    ],
    "lens": "correctness",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-correctness-r2.prompt",
    "report": "lens-correctness-r2.txt",
    "round": 2,
    "terminal": "completed",
    "verdict": "REVISE"
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
    "artefact": "lens-correctness-r5.jsonl",
    "findings": [],
    "lens": "correctness",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-correctness-r5.prompt",
    "report": "lens-correctness-r5.txt",
    "round": 5,
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
        "text": "/tmp/drain-plan-drain-90a2aa88-slot0/build/plan-r1.md:88 — Pool drainage does not preserve committed WAL data after the planned external rename. Pools enable WAL at `src-tauri/src/db/mod.rs:186`, but retirement merely drops the pool at `src-tauri/src/db/repository.rs:1679`. The old binding still stats its vanished leaf at `src-tauri/src/db/bound_sqlite.rs:1590`. Locked SQLite explicitly skips checkpoint-on-close when that file moved (`/home/felixb/.cargo/registry/src/index.crates.io-1949cf8c6b5b557f/libsqlite3-sys-0.25.2/sqlite3/sqlite3.c:57979`). Opening the new leaf uses different sidecar names and can omit committed WAL-only changes or fail schema validation. Require a safe preservation mechanism and verification that pre-rename committed rows and revision survive. A successful post-reopen write is insufficient (confidence: 97)."
      },
      {
        "kind": "blocker",
        "text": "/tmp/drain-plan-drain-90a2aa88-slot0/build/plan-r1.md:63 — The retirement handoff drops predecessor admission but leaves the caller’s retirement-capacity reservation unaddressed. `entry_until` reserves capacity before acquisition at `src-tauri/src/db/repository.rs:1475`, while the prescribed retirement independently reserves again at `src-tauri/src/db/repository.rs:1644`. With 15 unrelated incomplete retirements, the caller reserves the final slot, then waits for another slot while retaining its own. The idle renamed holder consequently times out without draining. Specify release or reuse of the construction reservation and verify this capacity boundary (confidence: 95)."
      },
      {
        "kind": "blocker",
        "text": "/tmp/drain-plan-drain-90a2aa88-slot0/build/plan-r1.md:171 — The proof command contains unquoted shell pipes. Cargo receives only the first test filter, while subsequent Rust test names become shell commands. These names identify tests inside `src-tauri/src/db/repository.rs:4831`, `src-tauri/src/db/repository.rs:4895`, and `src-tauri/src/db/repository.rs:4947`, not runnable commands. Replace this with valid test invocations covering all required regressions (confidence: 100)."
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
        "text": "P1 NOT CLOSED — /tmp/drain-plan-drain-90a2aa88-slot0/build/plan-r2.md:90 explicitly skips checkpointing when the pool is empty. The pool permits zero connections (`src-tauri/src/db/repository.rs:1492`), and r2d2 reaps idle connections (`/home/felixb/.cargo/registry/src/index.crates.io-1949cf8c6b5b557f/r2d2-0.8.10/src/lib.rs:301`). SQLite skips checkpoint-on-close after a move (`/home/felixb/.cargo/registry/src/index.crates.io-1949cf8c6b5b557f/libsqlite3-sys-0.25.2/sqlite3/sqlite3.c:57980`). Rename, wait for reaping, then reopen therefore admits the new name without preserving committed WAL rows. Calling this a known limit does not satisfy P1 (confidence: 99)."
      },
      {
        "kind": "blocker",
        "text": "/tmp/drain-plan-drain-90a2aa88-slot0/build/plan-r2.md:166 — the added checkpoint breaks the promised first-call `database_identity` success when committed WAL frames change the main file’s metadata. `probe_schema_and_revision` captures metadata before invoking `read_revision` (`src-tauri/src/db/repository.rs:1117`). The new checkpoint runs inside that revision read, so subsequent samples observe the checkpointed length or modification time. `identity_from_probe` rejects those differing samples at repository.rs:1098. Account for this internal transition while retaining detection of external changes, and prove success through `database_identity` with pending WAL frames (confidence: 99)."
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
        "text": "P1 NOT CLOSED — /tmp/drain-plan-drain-90a2aa88-slot0/build/plan-r3.md:96 permits moving a non-empty old-name WAL even when the old leaf now names another inode (:83). After a sync replacement of the old database and its sidecars, that WAL can belong to the replacement. `src-tauri/src/infra/fs.rs:5844` checks file metadata, not WAL ownership, and `src-tauri/src/db/bound_sqlite.rs:1507` opens sidecars by name. The regression at plan :181 cannot detect attaching replacement frames to the renamed database. Require refusal when association is unproven and a replacement-sidecar regression. (confidence: 90)"
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
    "findings": [
      {
        "kind": "blocker",
        "text": "/tmp/drain-plan-drain-90a2aa88-slot0/build/plan-r4.md:187 — The replacement-WAL regression installs the replacement before initial holder selection. An implementation that uses only that initial probe and omits the required fresh probe at line 98 would still pass. `probe_regular_file_at` protects only its own stat sequence, with no retained guard after return (src-tauri/src/infra/fs.rs:5851–5877). Add behavioral proof where the retained leaf becomes a replacement after selection but before sidecar handling, asserting the original conflict, retained cache entry, and unchanged WAL location and bytes. Otherwise the verification misses the timing requirement introduced by this correction (confidence: 92)."
      }
    ],
    "lens": "plan",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-plan-r4.prompt",
    "report": "lens-plan-r4.txt",
    "round": 4,
    "terminal": "completed",
    "verdict": "REVISE"
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
    "artefact": "lens-root-cause-r1.jsonl",
    "findings": [
      {
        "kind": "should-fix",
        "text": "/tmp/drain-plan-drain-90a2aa88-slot0/build/plan-r1.md:155 — Verification limitation: the plan targets the cause, the stale cached entry retaining the inode binding, at both repository acquisition paths while preserving admission and drain ordering. However, it does not require failing-before/passing-after evidence for the rename regressions. Require that evidence before claiming the defect fixed. No prior-fix reintroduction identified in the proposed obligations. (confidence: 95)"
      }
    ],
    "lens": "root-cause",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-root-cause-r1.prompt",
    "report": "lens-root-cause-r1.txt",
    "round": 1,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-root-cause-r2.jsonl",
    "findings": [],
    "lens": "root-cause",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-root-cause-r2.prompt",
    "report": "lens-root-cause-r2.txt",
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
        "kind": "blocker",
        "text": "/tmp/drain-plan-drain-90a2aa88-slot0/build/plan-r1.md:171 — The proof command uses unquoted `|`, so Bash constructs pipelines instead of selecting the listed tests. Quoting alone would still give libtest a literal substring, not a regex union. Supply runnable individual filters or a shared module filter covering every required regression. (confidence: 100)"
      },
      {
        "kind": "should-fix",
        "text": "/tmp/drain-plan-drain-90a2aa88-slot0/build/plan-r1.md:157 — Successful reopening and a WAL write do not prove drain-before-release ordering. Existing `retire_replaced` tests exercise that helper directly. Bypassing it in the new recovery path could leave those tests green. Name a synchronized repository-level assertion that prevents new-name establishment until predecessor connections finish closing. (confidence: 94)"
      },
      {
        "kind": "should-fix",
        "text": "/tmp/drain-plan-drain-90a2aa88-slot0/build/plan-r1.md:162 — A live-link refusal retires nothing, so it cannot prove the single-retry limit after successful retirement. Removing the attempt guard could pass every listed case. Name a bounded-completion assertion where retirement succeeds but the retry encounters another admission conflict, and require that conflict to return. (confidence: 96)"
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
        "text": "P4 NOT CLOSED — /tmp/drain-plan-drain-90a2aa88-slot0/build/plan-r2.md:165 — Blocking inside `RetirementPublished` proves the hook blocks the opener. The hook runs before pool disposal and `retirement.wait` at repository.rs:1678. Releasing the hook and ticket together would let a regression that skips the drain wait still pass every stated assertion. Require releasing the hook while retaining the ticket, asserting retry acquisition remains unreached, then separately dropping the ticket and asserting success. (confidence: 94)"
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
  }
]

### Issues

[
  {
    "claim": "An empty pool must not admit the renamed database while committed frames exist only in the vanished leaf's wal, and a non-empty wal whose retained leaf names a database file must not be moved.",
    "closed_round": 4,
    "correction": "An idle pooled connection runs wal_checkpoint(TRUNCATE) and is returned before retire_replaced, with no sidecar move. Zero connections move a non-empty leaf-wal, and a regular leaf-shm, onto the new leaf before retirement only when a fresh probe_regular_file_at of the retained leaf is not-found or non-regular. A different identity, or the cached identity, with a non-empty wal returns the original admission conflict and does not move or retire. An absent or zero-length wal retires without a move. The database leaf is not opened.",
    "dependencies": [],
    "disposition": "Fix",
    "id": "P1",
    "witnesses": [
      {
        "index": 1,
        "lens": "plan",
        "round": 1
      },
      {
        "index": 1,
        "lens": "plan",
        "round": 2
      },
      {
        "index": 1,
        "lens": "correctness",
        "round": 2
      },
      {
        "index": 1,
        "lens": "plan",
        "round": 3
      }
    ]
  },
  {
    "claim": "entry_until must not keep its construction RetirementCapacity across close_retired_entry_until, which takes another reservation.",
    "closed_round": 2,
    "correction": "entry_until drops its construction RetirementCapacity before the helper and reserves again through reserve_retirement_capacity only after the single retry acquire succeeds. A failed later reserve drops the uninserted pool and binding. Retiring nothing takes no second reservation.",
    "dependencies": [],
    "disposition": "Fix",
    "id": "P2",
    "witnesses": [
      {
        "index": 2,
        "lens": "plan",
        "round": 1
      },
      {
        "index": 1,
        "lens": "correctness",
        "round": 1
      }
    ]
  },
  {
    "claim": "The proof command must not use a shell pipeline. libtest matches one substring per invocation.",
    "closed_round": 2,
    "correction": "Each proof command is a separate cargo test invocation with one unique substring filter. There is no pipeline and no regex union.",
    "dependencies": [],
    "disposition": "Fix",
    "id": "P3",
    "witnesses": [
      {
        "index": 3,
        "lens": "plan",
        "round": 1
      },
      {
        "index": 1,
        "lens": "tests",
        "round": 1
      }
    ]
  },
  {
    "claim": "The drain regression must show that retry acquire stays unreached while a connection ticket is still held after RetirementPublished returns.",
    "closed_round": 3,
    "correction": "The new-name open runs on another thread. The test releases RetirementPublished while the extra connection ticket remains, waits until the connection gate is waiting, requires the acquire count to stay at the pre-retirement attempt, then drops the ticket and requires success with the gate closed and outstanding 0.",
    "dependencies": [],
    "disposition": "Fix",
    "id": "P4",
    "witnesses": [
      {
        "index": 2,
        "lens": "tests",
        "round": 1
      },
      {
        "index": 1,
        "lens": "tests",
        "round": 2
      }
    ]
  },
  {
    "claim": "The one-shot bound must be proven after a retirement whose retry acquire still conflicts, not only by a live link that retires nothing.",
    "closed_round": 2,
    "correction": "A cfg(test) helper-invocation counter stays at 1 while a hook-held BoundDatabase on a still-present hard link makes the retry acquire return the admission conflict. The live-link refusal remains a separate case.",
    "dependencies": [],
    "disposition": "Fix",
    "id": "P5",
    "witnesses": [
      {
        "index": 3,
        "lens": "tests",
        "round": 1
      }
    ]
  },
  {
    "claim": "The rename and identity success assertions are the base failure and must not accept the admission conflict.",
    "closed_round": 2,
    "correction": "connection and database_identity on the new name are required to succeed, and that success is the base failure. The tests do not accept the admission conflict.",
    "dependencies": [],
    "disposition": "Fix",
    "id": "P6",
    "witnesses": [
      {
        "index": 1,
        "lens": "root-cause",
        "round": 1
      }
    ]
  },
  {
    "claim": "database_identity's four samples must not reject this call's own checkpoint or moved-wal recovery, and must still reject an external change.",
    "closed_round": 3,
    "correction": "When this call's checkpoint or moved-wal recovery writes the main file and the four samples disagree, identity_from_probe repeats the four-sample loop once. The flag is scoped to that identity read. Disagreement without that write still conflicts. The proof calls database_identity with pending WAL frames and expects the committed revision.",
    "dependencies": [
      "P1"
    ],
    "disposition": "Fix",
    "id": "P7",
    "witnesses": [
      {
        "index": 2,
        "lens": "plan",
        "round": 2
      }
    ]
  },
  {
    "claim": "The fresh retained-leaf probe must be proven by a replacement that appears after stale selection and before that probe.",
    "closed_round": 5,
    "correction": "A cfg(test) hook runs after stale selection and before the fresh probe. vanished_rename_refuses_wal_replaced_after_selection installs the replacement in that window and requires the admission conflict, the cached entry, and unchanged old wal bytes. The pre-installed replacement test remains.",
    "dependencies": [
      "P1"
    ],
    "disposition": "Fix",
    "id": "P8",
    "witnesses": [
      {
        "index": 1,
        "lens": "plan",
        "round": 4
      }
    ]
  }
]

### lens-chess-semantics-r1.txt

NOT APPLICABLE: The plan covers database binding admission, cached connection retirement, and filesystem identity probes. Its obligations do not touch in-memory chess trees, positions, or move paths.

VERDICT: APPROVED
### lens-code-quality-r1.txt

No readability or local-consistency findings in the plan.

Limitation: implementation names, comments and neighboring-code consistency require cumulative diff review (confidence: 100).

VERDICT: APPROVED
### lens-correctness-r1.txt

[blocker] /tmp/drain-plan-drain-90a2aa88-slot0/build/plan-r1.md:88 — The retirement call retains `entry_until`’s capacity reservation, while `close_retired_entry_until` reserves another slot. With 16 concurrent opens of renamed idle databases, each builder can hold one reservation before entering the helper. All then wait for a seventeenth slot, so progress requires a timeout despite every holder being idle. The plan must release or transfer the construction reservation before retirement and restore it when needed for insertion. (confidence: 96)

VERDICT: REVISE
### lens-correctness-r2.txt

P2 CLOSED — The revised obligation drops the construction `RetirementCapacity` before the helper and reserves again only after the single retry acquire succeeds, eliminating the nested-reservation timeout.

[blocker] /tmp/drain-plan-drain-90a2aa88-slot0/build/plan-r2.md:90 — Skipping checkpoint when the pool is empty can admit the renamed database with committed rows missing. Concrete case: commit a row without checkpointing, rename only the main file, then leave it idle until r2d2’s default ten-minute reaper closes the last connection. The locked SQLite version skips checkpoint-on-close for the moved file, leaving committed frames under the old WAL name. The proposed helper then skips checkpoint, retires the entry, and opens the new name against the older main-file contents. Calling this a known limit does not satisfy the required preservation of committed WAL frames. An empty pool must not authorize admission without establishing that those frames were preserved. (confidence: 98)

VERDICT: REVISE
### lens-correctness-r3.txt

P1 CLOSED — Empty pools now preserve non-empty WAL files by moving them before retirement, or refuse admission. Existing pooled connections checkpoint before draining.
P4 CLOSED — The revised proof releases RetirementPublished while retaining the connection ticket, requires retry acquisition to remain unreached, then drops the ticket.
P7 CLOSED — Identity sampling permits one resample after this call’s checkpoint or moved-WAL recovery. Further disagreement, or disagreement without such an operation, remains a conflict.

VERDICT: APPROVED
### lens-correctness-r4.txt

P1 CLOSED — plan-r4.md:96–102 requires a fresh retained-leaf probe before moving a non-empty WAL. A different or cached identity returns the original admission conflict without moving or retiring, and reopens the lease gate. Phase 1 adds the replacement-WAL regression. Unix probe source confirms it does not open the leaf.

VERDICT: APPROVED
### lens-correctness-r5.txt

P8 CLOSED — The hook installs a replacement after stale selection and before the fresh retained-leaf probe. The regression requires the admission conflict, retained cache entry, and unchanged old WAL bytes.

VERDICT: APPROVED
### lens-engine-protocol-r1.txt

NOT APPLICABLE: The plan covers SQLite cache admission and retirement only. Its files and obligations do not affect engine processes, UCI protocol state, or asynchronous engine result routing.
VERDICT: APPROVED
### lens-error-handling-r1.txt

VERDICT: APPROVED
### lens-ipc-contract-r1.txt

NOT APPLICABLE: The plan changes internal database cache retirement and retry behavior only. Its obligations preserve renderer error payloads and introduce no command, event, binding, subscription, capability, or IPC signature changes.

VERDICT: APPROVED
### lens-minimalism-r1.txt

No bloat or duplication findings. The plan stays within the mandate, shares retirement logic between two concrete callers, and reuses existing probing and drain infrastructure. No new source files, settings, registries, or background machinery are proposed.

VERDICT: APPROVED
### lens-persisted-state-r1.txt

NOT APPLICABLE: The plan changes Rust database cache admission and retirement only. Renderer persistence, storage keys, atom families, hydration and tab lifecycle are explicitly outside its scope.
VERDICT: APPROVED
### lens-pgn-index-r1.txt

NOT APPLICABLE: The plan changes idle database binding retirement and admission retries only. PGN scanning, offsets, encoding, storage formats and search predicates are explicitly unchanged.

VERDICT: APPROVED
### lens-plan-r1.txt

[blocker] /tmp/drain-plan-drain-90a2aa88-slot0/build/plan-r1.md:88 — Pool drainage does not preserve committed WAL data after the planned external rename. Pools enable WAL at `src-tauri/src/db/mod.rs:186`, but retirement merely drops the pool at `src-tauri/src/db/repository.rs:1679`. The old binding still stats its vanished leaf at `src-tauri/src/db/bound_sqlite.rs:1590`. Locked SQLite explicitly skips checkpoint-on-close when that file moved (`/home/felixb/.cargo/registry/src/index.crates.io-1949cf8c6b5b557f/libsqlite3-sys-0.25.2/sqlite3/sqlite3.c:57979`). Opening the new leaf uses different sidecar names and can omit committed WAL-only changes or fail schema validation. Require a safe preservation mechanism and verification that pre-rename committed rows and revision survive. A successful post-reopen write is insufficient (confidence: 97).

[blocker] /tmp/drain-plan-drain-90a2aa88-slot0/build/plan-r1.md:63 — The retirement handoff drops predecessor admission but leaves the caller’s retirement-capacity reservation unaddressed. `entry_until` reserves capacity before acquisition at `src-tauri/src/db/repository.rs:1475`, while the prescribed retirement independently reserves again at `src-tauri/src/db/repository.rs:1644`. With 15 unrelated incomplete retirements, the caller reserves the final slot, then waits for another slot while retaining its own. The idle renamed holder consequently times out without draining. Specify release or reuse of the construction reservation and verify this capacity boundary (confidence: 95).

[blocker] /tmp/drain-plan-drain-90a2aa88-slot0/build/plan-r1.md:171 — The proof command contains unquoted shell pipes. Cargo receives only the first test filter, while subsequent Rust test names become shell commands. These names identify tests inside `src-tauri/src/db/repository.rs:4831`, `src-tauri/src/db/repository.rs:4895`, and `src-tauri/src/db/repository.rs:4947`, not runnable commands. Replace this with valid test invocations covering all required regressions (confidence: 100).

Runtime limitation: these conclusions come from source tracing at the stated base revision. No executable probes or tests were run under the read-only review assignment (confidence: 100).

VERDICT: REVISE
### lens-plan-r2.txt

[blocker] P1 NOT CLOSED — /tmp/drain-plan-drain-90a2aa88-slot0/build/plan-r2.md:90 explicitly skips checkpointing when the pool is empty. The pool permits zero connections (`src-tauri/src/db/repository.rs:1492`), and r2d2 reaps idle connections (`/home/felixb/.cargo/registry/src/index.crates.io-1949cf8c6b5b557f/r2d2-0.8.10/src/lib.rs:301`). SQLite skips checkpoint-on-close after a move (`/home/felixb/.cargo/registry/src/index.crates.io-1949cf8c6b5b557f/libsqlite3-sys-0.25.2/sqlite3/sqlite3.c:57980`). Rename, wait for reaping, then reopen therefore admits the new name without preserving committed WAL rows. Calling this a known limit does not satisfy P1 (confidence: 99).

P2 CLOSED — plan-r2.md:65 releases both construction guards before retirement and reserves capacity again only after retry acquisition succeeds. This addresses the separate reservations at repository.rs:1475 and repository.rs:1644.

P3 CLOSED — plan-r2.md:180 provides ten separate invocations with individual substring filters, including the existing tests at repository.rs:4831, repository.rs:4895, repository.rs:4947, and repository.rs:5500.

P4 CLOSED — plan-r2.md:94 requires retirement to return before acquisition retries. Its regression at line 165 requires blockage with an outstanding connection ticket and successful completion after drainage, exercising repository.rs:1685.

P5 CLOSED — plan-r2.md:170 requires an actual retirement followed by a conflicting retry and a helper count of exactly one. The retained binding exercises the admission check in bound_sqlite.rs:263.

P6 CLOSED — plan-r2.md:163 and plan-r2.md:166 explicitly require successful rename and revision reads as the base-failing assertions, replacing the conflict propagated today by repository.rs:1481 and repository.rs:1163.

[blocker] /tmp/drain-plan-drain-90a2aa88-slot0/build/plan-r2.md:166 — the added checkpoint breaks the promised first-call `database_identity` success when committed WAL frames change the main file’s metadata. `probe_schema_and_revision` captures metadata before invoking `read_revision` (`src-tauri/src/db/repository.rs:1117`). The new checkpoint runs inside that revision read, so subsequent samples observe the checkpointed length or modification time. `identity_from_probe` rejects those differing samples at repository.rs:1098. Account for this internal transition while retaining detection of external changes, and prove success through `database_identity` with pending WAL frames (confidence: 99).

VERDICT: REVISE
### lens-plan-r3.txt

[blocker] P1 NOT CLOSED — /tmp/drain-plan-drain-90a2aa88-slot0/build/plan-r3.md:96 permits moving a non-empty old-name WAL even when the old leaf now names another inode (:83). After a sync replacement of the old database and its sidecars, that WAL can belong to the replacement. `src-tauri/src/infra/fs.rs:5844` checks file metadata, not WAL ownership, and `src-tauri/src/db/bound_sqlite.rs:1507` opens sidecars by name. The regression at plan :181 cannot detect attaching replacement frames to the renamed database. Require refusal when association is unproven and a replacement-sidecar regression. (confidence: 90)

P4 CLOSED — Candidate r3:182 releases `RetirementPublished` while retaining the ticket and asserts that retry acquisition remains unreached. This distinguishes the hook at `src-tauri/src/db/repository.rs:1678` from the subsequent drain wait at :1686.

P7 CLOSED — Candidate r3:121 specifies one identity-read-scoped resample, with pending-WAL success and external-change refusal cases at :183. This addresses metadata being sampled before `read_revision` in `src-tauri/src/db/repository.rs:1117`.

VERDICT: REVISE
### lens-plan-r4.txt

P1 CLOSED — plan-r4.md:98 now refuses a non-empty WAL when the fresh retained-leaf probe succeeds with either identity. The error distinctions match src-tauri/src/infra/fs.rs:5851–5875 (confidence: 97).

[blocker] /tmp/drain-plan-drain-90a2aa88-slot0/build/plan-r4.md:187 — The replacement-WAL regression installs the replacement before initial holder selection. An implementation that uses only that initial probe and omits the required fresh probe at line 98 would still pass. `probe_regular_file_at` protects only its own stat sequence, with no retained guard after return (src-tauri/src/infra/fs.rs:5851–5877). Add behavioral proof where the retained leaf becomes a replacement after selection but before sidecar handling, asserting the original conflict, retained cache entry, and unchanged WAL location and bytes. Otherwise the verification misses the timing requirement introduced by this correction (confidence: 92).

VERDICT: REVISE
### lens-plan-r5.txt

P8 CLOSED — plan-r5.md:97, :188 and :208 require replacement after stale selection, refusal with the cache retained, unchanged WAL bytes, and a dedicated proof command. This distinguishes a fresh probe from selection-only logic. The probe supports identity comparison without opening the Unix leaf (src-tauri/src/infra/fs.rs:5850–5878). Static review only, no executable probe run (confidence: 95).

VERDICT: APPROVED
### lens-plan-r6.txt

No drift invalidates `plan-r6.md:138` or another named obligation. Both admission messages retain their payload mapping at `src-tauri/src/error.rs:1064` and renderer handling at `src/components/databases/useDatabaseLibrary.tsx:379`. Repository establishment and retirement code are unchanged. No new evidence reopens P1–P8.

VERDICT: APPROVED
### lens-platform-semantics-r1.txt

No platform-semantics findings. The planned identity comparison and retained-parent probe preserve Windows spelling independence and avoid opening the Unix leaf.

This was read-only plan review. Neither `pnpm rust:windows:check` nor the non-Linux Unix source probe ran. Runtime proof remains with `rust-windows-test` and `rust-macos-test`, with `rust-platform` checking compilation and warnings.

VERDICT: APPROVED
### lens-root-cause-r1.txt

[should-fix] /tmp/drain-plan-drain-90a2aa88-slot0/build/plan-r1.md:155 — Verification limitation: the plan targets the cause, the stale cached entry retaining the inode binding, at both repository acquisition paths while preserving admission and drain ordering. However, it does not require failing-before/passing-after evidence for the rename regressions. Require that evidence before claiming the defect fixed. No prior-fix reintroduction identified in the proposed obligations. (confidence: 95)

VERDICT: APPROVED
### lens-root-cause-r2.txt

P6 CLOSED — Phase 1 now requires successful new-name connection and independent revision-read assertions, explicitly identifies admission refusal as the base failure, and forbids accepting that conflict. This closes the plan obligation. Failing-before/passing-after runtime proof remains pending implementation. The revised mechanism preserves admission and drain-before-release protections (confidence: 98).

VERDICT: APPROVED
### lens-tauri-security-r1.txt

No in-scope security defects found in plan-r1. The proposed probe retains descriptor-relative identity checks, retirement drains before binding release, and propagated filesystem errors use renderer-safe serialization.

Limitation: this is plan review, not implementation verification. Credential, session and signed-download flows are absent from the proposed change. No files changed.

VERDICT: APPROVED
### lens-tests-r1.txt

[blocker] /tmp/drain-plan-drain-90a2aa88-slot0/build/plan-r1.md:171 — The proof command uses unquoted `|`, so Bash constructs pipelines instead of selecting the listed tests. Quoting alone would still give libtest a literal substring, not a regex union. Supply runnable individual filters or a shared module filter covering every required regression. (confidence: 100)

[should-fix] /tmp/drain-plan-drain-90a2aa88-slot0/build/plan-r1.md:157 — Successful reopening and a WAL write do not prove drain-before-release ordering. Existing `retire_replaced` tests exercise that helper directly. Bypassing it in the new recovery path could leave those tests green. Name a synchronized repository-level assertion that prevents new-name establishment until predecessor connections finish closing. (confidence: 94)

[should-fix] /tmp/drain-plan-drain-90a2aa88-slot0/build/plan-r1.md:162 — A live-link refusal retires nothing, so it cannot prove the single-retry limit after successful retirement. Removing the attempt guard could pass every listed case. Name a bounded-completion assertion where retirement succeeds but the retry encounters another admission conflict, and require that conflict to return. (confidence: 96)

VERDICT: REVISE
### lens-tests-r2.txt

P3 CLOSED — plan-r2.md:180–189 specifies ten separate Cargo invocations, each with one substring filter and no pipeline.

[blocker] P4 NOT CLOSED — /tmp/drain-plan-drain-90a2aa88-slot0/build/plan-r2.md:165 — Blocking inside `RetirementPublished` proves the hook blocks the opener. The hook runs before pool disposal and `retirement.wait` at repository.rs:1678. Releasing the hook and ticket together would let a regression that skips the drain wait still pass every stated assertion. Require releasing the hook while retaining the ticket, asserting retry acquisition remains unreached, then separately dropping the ticket and asserting success. (confidence: 94)

P5 CLOSED — plan-r2.md:170 requires a successful retirement followed by a forced retry conflict, with the helper invocation counter asserted at exactly 1.

VERDICT: REVISE
### lens-tests-r3.txt

P1 CLOSED — plan-r3.md:180–181 requires committed-row and revision assertions with both an idle connection and an empty pool. Skipping WAL preservation fails the row read.

P4 CLOSED — plan-r3.md:182 releases `RetirementPublished` while retaining the connection ticket, asserts retry acquisition remains unreached, then drops the ticket and requires success.

P7 CLOSED — plan-r3.md:183 requires identity-only success with pending WAL frames and conflict on an external metadata change without this call’s write. Reverting the resample fails the success assertion.

VERDICT: APPROVED
### lens-tests-r4.txt

P1 CLOSED — `vanished_rename_refuses_unproven_replacement_wal` requires the admission conflict, retained cache entry, unchanged old WAL bytes, and no transfer to the new name. Reverting to the unconditional WAL move would fail these planned assertions. The proof command is explicitly listed. This closes the plan obligation, pending implementation verification.

VERDICT: APPROVED
### lens-tests-r5.txt

P8 CLOSED — `vanished_rename_refuses_wal_replaced_after_selection` installs the replacement after stale selection and before the fresh probe, then asserts admission conflict, cache retention, and unchanged old WAL bytes. Using only the selection-time probe would fail those assertions. A dedicated cargo test command is specified. This closes the planned proof gap, with execution still pending.

VERDICT: APPROVED
### plan-r1.md

# Plan: Retire a vanished idle database cache on a same-inode admission conflict

## Goal

When a database file is renamed or moved outside ChessFable while its old name's repository entry is idle, opening the new name retires that idle entry through the existing drain-then-release path and admits the new name once. A live hard link, a busy lease, and `BoundDatabase::acquire` stay refused exactly as they are today.

## MANDATE

f-20261011-01, verbatim:

* **ID:** f-20261011-01 · **Status:** open · **Area:** db-search · **Root:** - · **Entry:** build · **Blocked:** none
* **Filed from:** d7fc28c0-e3c5-4fb5-b34f-fee1b64dec2f
* **Where:** `src-tauri/src/db/bound_sqlite.rs` (`BoundDatabase::acquire`, same-inode admission added for f-20260929-05: `"database is open through another name"`); `src-tauri/src/db/repository.rs` (`evict_idle_entries`, `:1092`, evicts only while `state.entries.len() > MAX_OPEN_DATABASES`; a cached `DatabaseEntry` owns its binding); the adapted test `replacement_at_the_same_path_never_reuses_an_old_pooled_connection` has to `close_and_invalidate` the setup name before reopening the renamed inode.
* **Defect:** after f-20260929-05, a database file renamed in the same folder outside ChessFable (file manager, sync client) while its old name's repository entry is cached gets `Conflict("database is open through another name")` on every open under the new name. The old entry is never accessed again (its path is gone), so the stale probe never retires it, and LRU eviction only fires above `MAX_OPEN_DATABASES`; the refusal therefore lasts until enough other databases are opened or the app restarts. The refusal itself is correct while the idle pool holds open SQLite connections on the inode (they share its `-shm`), so the defect is the retention, not the admission.
* **Why it matters:** a user who renames a database outside the app sees it fail to open with a generic database error (presentation: f-20261009-03) until restarting ChessFable.
* **Open question:** should a same-inode admission conflict in the repository's build path retire an idle cached entry whose own path no longer resolves to that inode (draining its pool through the existing retire/close path) and retry once, or should the repository re-probe idle entries' paths on a conflict, or is restart-until-evicted acceptable? Interacts with f-20260930-01 (eviction drops entries without draining connections) — any retirement must drain before the binding is released.
* **Related:** f-20260929-05 (introduced the admission; plan risk "Cached entries keep aliases refused" accepted this for live hard links, not for a vanished old name), f-20260930-01, f-20261009-03. Review record: `tasks/handoffs/2026-10-09-sqlite-hard-link-admission-review.md`.
* **Found by:** orchestrator diff review of the f-20260929-05 phase-1 write leaf (Claude Code, drain session d7fc28c0-e3c5-4fb5-b34f-fee1b64dec2f), 2026-10-11, from the fixture adaptation the leaf reported.

## Threat model and non-goals

The adversary is ordinary local filesystem activity while this process holds an idle pooled binding: a same-directory rename, a move to another directory, a second hard link that is still present, or a rename that races a live lease. The process is the only ChessFable instance for this app-data directory. Cross-process coordination, crash recovery, and a user who keeps the old name as a live hard link are outside the repair.

A vanished name must not be able to pin the inode until sixteen other databases evict it or the process restarts. A live second name must not be able to force that retirement. Retirement must not drop SQLite connections before they drain, and it must not close a lockable descriptor of the database inode on Unix.

## Traced premises

Confirmed on `6b600397549d5bd324205f0db8592dbe9b450ff6`. Obligations below do not cite lines.

* `BoundDatabase::acquire` refuses a second binding key for an inode that already has a published registration or a creation reservation. Different parent identity returns `DATABASE_OPEN_THROUGH_ANOTHER_DIRECTORY`; same parent and different leaf returns `DATABASE_OPEN_THROUGH_ANOTHER_NAME`. Identical keys reuse one registration. This door stays unchanged (d-20261011-01).
* The user open is `get_db_info_blocking` → `get_db_or_create` → `DatabaseRepository::connection` → `entry_until`. `entry_until` takes `predecessor_admission` for the new key, then `acquire_bound`. On the admission conflict it returns. Nothing in that path looks for a different cached key that holds the inode.
* `database_identity` hydrates through `read_revision`. `get_db_info_blocking` calls that only after `get_db_or_create` has returned a connection for the same target. `read_revision` itself also takes `predecessor_admission_for` and then `acquire_bound`, and it does not go through `entry_until`. A revision read of a new name while the old idle entry still holds the inode conflicts on its own.
* `classify_bound_failure` / `classify_bound_open_error_result` rewrites the Unix error to `database changed after capability resolution` when the new target's `probe_current` fails. When that probe succeeds, the original conflict is preserved. Windows `acquire_bound` returns `BoundDatabase::acquire`'s error unchanged. Only the two preserved admission messages are a vanished-holder signal.
* Idle means `DatabaseEntry::is_idle`: lease gate outstanding is 0 and the gate is not closed. `eviction_candidate` also requires `Arc::strong_count(entry) == 1`, so the map is the only owner. An `EntryLease` holds an `Arc<DatabaseEntry>`. LRU eviction runs only when `entries.len()` is already at `MAX_OPEN_DATABASES` (16) during insertion. The finding's `evict_idle_entries` name is stale; the capacity check inside `entry_until` is the current LRU.
* `EntryKey::matches_predecessor` is same object identity OR same parent identity (d-20261011-10). `retirement_reserved` treats a live admission whose key matches the retiring key as a reservation. `wait_retirement_change` polls on `build_changed` until the deadline. Holding the new name's predecessor admission across `close_retired_entry_until` therefore waits on that same admission until `retire_wait`. Same-folder rename matches on both identity and parent. A cross-directory move of the same inode still matches on object identity.
* `retire_replaced` closes the lease gate, waits for leases, then `close_retired_entry_until` publishes the retirement, drops the pool outside the repository mutex, and waits for the connection and owner gates. On timeout or cancellation it does not forget an undrained gate (d-20261011-09); `cancel_retirement` reopens the lease gate only when the connection gate is not closed. `DatabaseEntry` drops `bound` after the pool field. The binding stays alive until the last `DatabaseEntry` / `BoundDatabase` clone drops, which is after the pool drop inside `close_retired_entry_until` only if the caller also drops its `Arc`.
* `BuildGuard` clears `building` for the new key on drop. `entry_until` returns `database is being replaced or deleted` when the cached entry's lease gate is already closed.
* `Binding` keeps the retained parent `File` and leaf `OsString`. `BoundDatabase` does not expose them. `probe_regular_file_at` stats with `AT_SYMLINK_NOFOLLOW` on Unix and does not open the leaf (d-20260929-04, d-20260930-10, f-20260929-11). On Windows the same function opens and closes a read handle; byte-range locks are handle-scoped (d-20260930-10). Absence is `Error::Io`. A non-regular file is `Error::InvalidInput` (`target must be a regular file`). A stat identity change across the probe is `Error::Conflict` (`workspace entry changed concurrently`).
* `scan_worker`, `snapshot_database`, and `linked_collections::legacy` call `BoundDatabase::acquire` directly. `scan_worker` already holds `predecessor_admission_for` across establishment and drops it before `validate_content` (d-20261011-13). `get_db_info_blocking` schedules that scan only after the connection exists.
* `replacement_at_the_same_path_never_reuses_an_old_pooled_connection` still `close_and_invalidate`s the setup name before renaming the inode onto the original path. Live same-parent refusal is `hard_link_alias_is_refused_until_cached_entry_and_owners_are_released`, `wal_writer_survives_alias_refusal`, and `revision_read_refuses_same_parent_alias`.
* f-20260930-01's drain gap is already closed by `retire_replaced` / `publish_retirement` (d-20261011-07, d-20261011-09). This plan uses that path. It does not reopen those decisions. d-20261011-15's per-pool thread-pool construction stays untouched.

## Approach

### Preserve admission

`BoundDatabase::acquire` still refuses a second distinct key for one inode, against published registrations and creation reservations, before any VFS or SQLite open. Identical keys, including Windows case variants, still share one registration. This plan does not add a retry inside `acquire`.

### Recognize only a preserved admission conflict

Repository establishment treats an error as a vanished-holder conflict only when it is `Error::Conflict` whose message is exactly `DATABASE_OPEN_THROUGH_ANOTHER_NAME` or `DATABASE_OPEN_THROUGH_ANOTHER_DIRECTORY`. `database changed after capability resolution`, a tombstone conflict, a construction timeout, cancellation, and every other error are unchanged and do not retire anything.

### One shared retirement attempt on both repository establishment sites

`entry_until` and `read_revision` are the only production callers of `acquire_bound`. Both use one private repository helper. The helper is not used from `scan_worker`, `snapshot_database`, or `linked_collections::legacy`.

Each call attempts this helper at most once, tracked by a local flag on that call. A second preserved admission conflict from the same call is returned as that conflict. The helper does not loop.

### Drop the predecessor admission before retirement

The new key's predecessor admission matches the old entry by object identity, and for a same-folder rename also by parent identity. The helper therefore runs only after that admission has been dropped.

In `entry_until` the `BuildGuard` for the new key stays held across the helper, so a second builder of the new key waits on `building` instead of retiring concurrently. The repository state mutex is not held across `retire_replaced` or `close_retired_entry_until`.

If the helper returns an error, that error is the call result. The original conflict is not substituted. `BuildGuard` then clears `building` by its existing drop.

### Select idle cached holders of this inode

Under the repository state mutex, consider entries whose `EntryKey.identity` equals the target inode, whose path is not tombstoned, whose `Arc` strong count is 1, and whose `is_idle` is true. Skip the incoming key if it is already present. At most `MAX_OPEN_DATABASES` entries exist. One inode has one binding, so one match is the expected case; every match that passes the stale-name probe is retired before the single retry.

Do not remove the entry from the map before the existing `close_retired_entry_until` removal. Removing it early would let another `entry_until` for the old key build a second pool on the still-live registration.

### Decide staleness from the retained parent and leaf

While still holding the repository mutex, and before closing the lease gate, ask the entry's `BoundDatabase` whether its retained parent and leaf still name that binding's inode. The new method calls `probe_regular_file_at` and compares the returned identity with the binding's identity. It does not call `open`, `open_regular_at`, or `probe_current` on a pathname.

* Same identity: the leaf is a live name. Leave the entry cached and do not retire it.
* `Error::Io` whose kind is not-found, or `Error::InvalidInput` equal to the existing non-regular-file message: the retained name no longer names the inode. The entry is stale.
* A successful probe of a different identity: the retained name is now a different file. The entry is stale.
* `Error::Conflict` from the probe, and every other I/O error: return that error. Do not retire. Do not replace it with the admission conflict.

Re-check strong count 1 and `is_idle` under the same mutex hold after the probe. If either check fails, do not retire that entry.

### Close the lease gate before leaving the mutex, then drain

For a stale idle match, close its lease gate before releasing the repository mutex, so a concurrent `entry_until` of the old key observes the existing "database is being replaced or deleted" conflict instead of cloning the `Arc` and taking a lease. `DrainGate::close` is idempotent.

Then release the mutex and call the existing `retire_replaced` with the caller's cancellation token. That waits for leases, publishes the retirement, drops the pool outside the mutex, and waits for the connection and owner gates. On timeout or cancellation, `retire_replaced` already keeps an undrained gate and reopens the lease gate only when the connection gate is still open. Return that error.

After `retire_replaced` returns success, drop every `Arc<DatabaseEntry>` the helper holds for that entry before acquiring again. The entry's `bound` is what keeps the registration alive after the pool drop.

A probe that races a restore of the same inode between the stat and `publish_retirement` can drain an idle live alias. That alias can open again after the last binding release, which d-20261011-01 already allows. Do not drop the binding before the drain returns.

### Retry establishment once, behind a fresh admission

If the helper retired at least one entry, the caller takes a fresh predecessor admission and calls `acquire_bound` once more.

* `entry_until` passes the deadline it already uses for `predecessor_admission`. It does not extend that deadline. The fresh admission waits for any still-incomplete matching retirement (d-20261011-08, d-20261011-10, d-20261011-11) and then establishment continues with the same `BuildGuard`.
* `read_revision` calls `predecessor_admission_for` again, which uses its existing `now + retire_wait` window, then retries `acquire_bound` once and continues the existing read-only open. It still does not create a pool.

If the helper retires nothing, the caller returns the original conflict and does not take a second admission.

The bound is one drain wait plus one fresh admission window per call, then either success or the second conflict. It is not a loop.

### What stays refused

* A live hard link whose retained leaf still names the inode stays cached, and the new name stays in conflict.
* An entry with a live lease or any extra `Arc` stays cached. The conflicting open returns the admission conflict. A later open, after the lease and extra `Arc` are gone, is a new call and may retire once.
* A tombstoned path stays on the deletion path.
* Direct `BoundDatabase::acquire` callers do not retire. After this repository path has dropped the stale registration, a later direct acquire of the new name succeeds. An in-flight `scan_worker` that already holds its own `BoundDatabase` keeps the new name refused until that clone drops; the one repository retry then returns the conflict. Archiving a new name that this repository has never opened, while an idle cache still holds the inode, still conflicts. That is not the filed open path. `get_db_info_blocking` reaches the scan only after `get_db_or_create` succeeds, so the user open retires first.

### Failure and ownership

The repository remains the owner of pooled entries and retirement records. Retirement records stay bounded by `MAX_OPEN_DATABASES` through the existing capacity reservation. No new registry, reaper, or retry thread is added. Poisoned repository and registry locks keep their existing typed conflicts. No new `unwrap` or `expect` on a file, database, or renderer-driven path. The helper does not call `BLOCKING_GATEWAY`.

The renderer payload for both admission messages stays `database_admission`. No command, event, binding, or UI string changes.

## Decisions and trade-offs

### Decided autonomously

Question (from the finding's open question): on a same-inode admission conflict in the repository build path, retire an idle cached entry whose retained name no longer names that inode and retry once, re-probe every idle entry on any conflict, or leave the refusal until LRU or restart?

Chosen: retire only idle cached entries of that inode whose retained parent and leaf no longer name it, through `retire_replaced`, then retry the repository establishment once behind a fresh predecessor admission. Both preserved admission messages use this path. `BoundDatabase::acquire` is unchanged.

Rejected: re-probing every idle entry on any conflict regardless of inode; accepting restart-until-evicted; weakening `BoundDatabase::acquire`; opening the old leaf by pathname; dropping the pool without `retire_replaced`; retrying while the new key's predecessor admission is still held; unbounded retry.

Reason: the refusal is correct while the idle pool holds the inode, and f-20260930-01 requires the drain before the binding is released. The predecessor-admission deadlock is avoided by dropping that admission first. Live hard links stay refused, which is the accepted risk in the f-20260929-05 review. Record this with `record-decision` at adoption. Reversal path: stop calling the helper from `entry_until` and `read_revision`, leaving admission and LRU as they are on this base.

Governing decisions that stay closed: d-20261011-01, d-20261011-02, d-20261011-07, d-20261011-08, d-20261011-09, d-20261011-10, d-20261011-11, d-20261011-13, d-20261011-15, d-20260929-04, d-20260930-10.

## Risks / open questions

* Windows may refuse to rename a file that still has the pool's handles. The production helper is not `cfg`-gated. The regression that renames or moves an open database is `#[cfg(unix)]` when Windows cannot perform that rename. Windows and macOS CI remain the runtime authority for the shared code (d-20261011-02). Do not add a Windows-only retirement policy.
* The restore race between the stale stat and `publish_retirement` can drain an idle alias that was restored as the same inode. The other name opens after the drain. That is accepted.
* A direct acquire that bypasses the repository can still observe the conflict until the repository entry is gone. Stated under "What stays refused".
* `read_revision`'s retry uses a second `predecessor_admission_for` window. `entry_until` does not extend its original deadline. Both are one-shot.

## Not part of this task

* Changing `BoundDatabase::acquire`, binding-key identity, or the two conflict strings.
* UI presentation of the conflict (f-20261009-03), generated bindings, and renderer state.
* `scan_worker`, `snapshot_database`, and `linked_collections::legacy`, except that they must keep compiling against an unchanged `BoundDatabase::acquire`.
* PGN boundaries, the byte-offset index, move encoding, and `CastlingMode`.
* Cross-process lock coordination, crash recovery, and other queued database findings.
* d-20261011-15's thread-pool builder.
* Co-located findings. This cluster is the singleton `f-20261011-01`.

## Phases

### Phase 1 — Idle vanished-holder retirement

Role: `sensitive`. One write leaf. Files: `src-tauri/src/db/repository.rs`, `src-tauri/src/db/bound_sqlite.rs`. Read-only context: `src-tauri/src/db/mod.rs`, `src-tauri/src/db/content_validation.rs`, `src-tauri/src/db/linked_collections.rs`, `src-tauri/src/db/linked_collections/legacy.rs`, `src-tauri/src/error.rs`, `src-tauri/src/infra/fs.rs`.

Implement every Approach heading. Add repository regressions:

* Same-folder external rename, old entry idle, no lease held: `connection` on the new name succeeds, the old key is gone, a WAL write through the new name works, and the old leaf is not still cached.
* `read_revision` / `database_identity` on the new name, with no prior `connection` on that name, retires the same idle holder and returns the revision.
* A live same-parent hard link stays in conflict and the cached entry remains. A live cross-directory hard link stays in conflict.
* A cross-directory move of an idle cached file admits the new path once.
* An outstanding lease blocks retirement: the new name conflicts, the old entry remains, and a later open after the lease drops succeeds.
* The live-link refusal returns on the first open and the entry is still cached afterward, which is the one-shot bound for a holder that is not a vanished idle entry.
* `replacement_at_the_same_path_never_reuses_an_old_pooled_connection` stays as written, including its `close_and_invalidate` before the rename.
* Existing `hard_link_alias_is_refused_until_cached_entry_and_owners_are_released`, `wal_writer_survives_alias_refusal`, and `revision_read_refuses_same_parent_alias` stay green.

The new rename, move, and lease tests are `#[cfg(unix)]` if the platform cannot rename an open database. The helper they drive is not `cfg`-gated.

PROOF COMMAND:

```bash
cargo test --manifest-path src-tauri/Cargo.toml --locked --lib -- vanished_renamed_idle_cache_opens_under_the_new_name|revision_read_retires_vanished_idle_cache|hard_link_alias_is_refused_until_cached_entry_and_owners_are_released|wal_writer_survives_alias_refusal|revision_read_refuses_same_parent_alias|replacement_at_the_same_path_never_reuses_an_old_pooled_connection
```

The leaf names the new tests so this filter matches. Adopter, not this plan session: `pnpm checks:pre-review` before diff review, and `pnpm gates:push -- --rust` at release.

Rules for the write leaf, read in full, no further discovery: `.claude/rules/async-resource-invariants.md`, `.claude/rules/pgn-scanning.md`. PGN scanning applies only as a negative: do not change game boundaries, the byte-offset index, move encoding, search predicates, or `CastlingMode`.

### plan-r2.md

# Plan: Retire a vanished idle database cache on a same-inode admission conflict

## Goal

When a database file is renamed or moved outside ChessFable while its old name's repository entry is idle, opening the new name retires that idle entry through the existing drain-then-release path and admits the new name once. A live hard link, a busy lease, and `BoundDatabase::acquire` stay refused exactly as they are today.

## MANDATE

f-20261011-01, verbatim:

* **ID:** f-20261011-01 · **Status:** open · **Area:** db-search · **Root:** - · **Entry:** build · **Blocked:** none
* **Filed from:** d7fc28c0-e3c5-4fb5-b34f-fee1b64dec2f
* **Where:** `src-tauri/src/db/bound_sqlite.rs` (`BoundDatabase::acquire`, same-inode admission added for f-20260929-05: `"database is open through another name"`); `src-tauri/src/db/repository.rs` (`evict_idle_entries`, `:1092`, evicts only while `state.entries.len() > MAX_OPEN_DATABASES`; a cached `DatabaseEntry` owns its binding); the adapted test `replacement_at_the_same_path_never_reuses_an_old_pooled_connection` has to `close_and_invalidate` the setup name before reopening the renamed inode.
* **Defect:** after f-20260929-05, a database file renamed in the same folder outside ChessFable (file manager, sync client) while its old name's repository entry is cached gets `Conflict("database is open through another name")` on every open under the new name. The old entry is never accessed again (its path is gone), so the stale probe never retires it, and LRU eviction only fires above `MAX_OPEN_DATABASES`; the refusal therefore lasts until enough other databases are opened or the app restarts. The refusal itself is correct while the idle pool holds open SQLite connections on the inode (they share its `-shm`), so the defect is the retention, not the admission.
* **Why it matters:** a user who renames a database outside the app sees it fail to open with a generic database error (presentation: f-20261009-03) until restarting ChessFable.
* **Open question:** should a same-inode admission conflict in the repository's build path retire an idle cached entry whose own path no longer resolves to that inode (draining its pool through the existing retire/close path) and retry once, or should the repository re-probe idle entries' paths on a conflict, or is restart-until-evicted acceptable? Interacts with f-20260930-01 (eviction drops entries without draining connections) — any retirement must drain before the binding is released.
* **Related:** f-20260929-05 (introduced the admission; plan risk "Cached entries keep aliases refused" accepted this for live hard links, not for a vanished old name), f-20260930-01, f-20261009-03. Review record: `tasks/handoffs/2026-10-09-sqlite-hard-link-admission-review.md`.
* **Found by:** orchestrator diff review of the f-20260929-05 phase-1 write leaf (Claude Code, drain session d7fc28c0-e3c5-4fb5-b34f-fee1b64dec2f), 2026-10-11, from the fixture adaptation the leaf reported.

## Threat model and non-goals

The adversary is ordinary local filesystem activity while this process holds an idle pooled binding: a same-directory rename, a move to another directory, a second hard link that is still present, or a rename that races a live lease. The process is the only ChessFable instance for this app-data directory. Cross-process coordination, crash recovery, and a user who keeps the old name as a live hard link are outside the repair.

A vanished name must not be able to pin the inode until sixteen other databases evict it or the process restarts. A live second name must not be able to force that retirement. Retirement must not drop SQLite connections before they drain, and it must not close a lockable descriptor of the database inode on Unix.

## Traced premises

Confirmed on `6b600397549d5bd324205f0db8592dbe9b450ff6`. Obligations below do not cite lines.

* `BoundDatabase::acquire` refuses a second binding key for an inode that already has a published registration or a creation reservation. Different parent identity returns `DATABASE_OPEN_THROUGH_ANOTHER_DIRECTORY`; same parent and different leaf returns `DATABASE_OPEN_THROUGH_ANOTHER_NAME`. Identical keys reuse one registration. This door stays unchanged (d-20261011-01).
* The user open is `get_db_info_blocking` → `get_db_or_create` → `DatabaseRepository::connection` → `entry_until`. `entry_until` takes `predecessor_admission` for the new key, then `acquire_bound`. On the admission conflict it returns. Nothing in that path looks for a different cached key that holds the inode.
* `database_identity` hydrates through `read_revision`. `get_db_info_blocking` calls that only after `get_db_or_create` has returned a connection for the same target. `read_revision` itself also takes `predecessor_admission_for` and then `acquire_bound`, and it does not go through `entry_until`. A revision read of a new name while the old idle entry still holds the inode conflicts on its own.
* `classify_bound_failure` / `classify_bound_open_error_result` rewrites the Unix error to `database changed after capability resolution` when the new target's `probe_current` fails. When that probe succeeds, the original conflict is preserved. Windows `acquire_bound` returns `BoundDatabase::acquire`'s error unchanged. Only the two preserved admission messages are a vanished-holder signal.
* Idle means `DatabaseEntry::is_idle`: lease gate outstanding is 0 and the gate is not closed. `eviction_candidate` also requires `Arc::strong_count(entry) == 1`, so the map is the only owner. An `EntryLease` holds an `Arc<DatabaseEntry>`. LRU eviction runs only when `entries.len()` is already at `MAX_OPEN_DATABASES` (16) during insertion. The finding's `evict_idle_entries` name is stale; the capacity check inside `entry_until` is the current LRU.
* `EntryKey::matches_predecessor` is same object identity OR same parent identity (d-20261011-10). `retirement_reserved` treats a live admission whose key matches the retiring key as a reservation. `wait_retirement_change` polls on `build_changed` until the deadline. Holding the new name's predecessor admission across `close_retired_entry_until` therefore waits on that same admission until `retire_wait`. Same-folder rename matches on both identity and parent. A cross-directory move of the same inode still matches on object identity.
* `retire_replaced` closes the lease gate, waits for leases, then `close_retired_entry_until` publishes the retirement, drops the pool outside the repository mutex, and waits for the connection and owner gates. On timeout or cancellation it does not forget an undrained gate (d-20261011-09); `cancel_retirement` reopens the lease gate only when the connection gate is not closed. `DatabaseEntry` drops `bound` after the pool field. The binding stays alive until the last `DatabaseEntry` / `BoundDatabase` clone drops, which is after the pool drop inside `close_retired_entry_until` only if the caller also drops its `Arc`.
* `BuildGuard` clears `building` for the new key on drop. `entry_until` returns `database is being replaced or deleted` when the cached entry's lease gate is already closed.
* `Binding` keeps the retained parent `File` and leaf `OsString`. `BoundDatabase` does not expose them. `probe_regular_file_at` stats with `AT_SYMLINK_NOFOLLOW` on Unix and does not open the leaf (d-20260929-04, d-20260930-10, f-20260929-11). On Windows the same function opens and closes a read handle; byte-range locks are handle-scoped (d-20260930-10). Absence is `Error::Io`. A non-regular file is `Error::InvalidInput` (`target must be a regular file`). A stat identity change across the probe is `Error::Conflict` (`workspace entry changed concurrently`).
* `scan_worker`, `snapshot_database`, and `linked_collections::legacy` call `BoundDatabase::acquire` directly. `scan_worker` already holds `predecessor_admission_for` across establishment and drops it before `validate_content` (d-20261011-13). `get_db_info_blocking` schedules that scan only after the connection exists.
* `replacement_at_the_same_path_never_reuses_an_old_pooled_connection` still `close_and_invalidate`s the setup name before renaming the inode onto the original path. Live same-parent refusal is `hard_link_alias_is_refused_until_cached_entry_and_owners_are_released`, `wal_writer_survives_alias_refusal`, and `revision_read_refuses_same_parent_alias`.
* f-20260930-01's drain gap is already closed by `retire_replaced` / `publish_retirement` (d-20261011-07, d-20261011-09). This plan uses that path. It does not reopen those decisions. d-20261011-15's per-pool thread-pool construction stays untouched.

## Approach

### Preserve admission

`BoundDatabase::acquire` still refuses a second distinct key for one inode, against published registrations and creation reservations, before any VFS or SQLite open. Identical keys, including Windows case variants, still share one registration. This plan does not add a retry inside `acquire`.

### Recognize only a preserved admission conflict

Repository establishment treats an error as a vanished-holder conflict only when it is `Error::Conflict` whose message is exactly `DATABASE_OPEN_THROUGH_ANOTHER_NAME` or `DATABASE_OPEN_THROUGH_ANOTHER_DIRECTORY`. `database changed after capability resolution`, a tombstone conflict, a construction timeout, cancellation, and every other error are unchanged and do not retire anything.

### One shared retirement attempt on both repository establishment sites

`entry_until` and `read_revision` are the only production callers of `acquire_bound`. Both use one private repository helper. The helper is not used from `scan_worker`, `snapshot_database`, or `linked_collections::legacy`.

Each call attempts this helper at most once, tracked by a local flag on that call. A second preserved admission conflict from the same call is returned as that conflict. The helper does not loop.

### Drop the predecessor admission before retirement

The new key's predecessor admission matches the old entry by object identity, and for a same-folder rename also by parent identity. The helper therefore runs only after that admission has been dropped.

In `entry_until` the `BuildGuard` for the new key stays held across the helper, so a second builder of the new key waits on `building` instead of retiring concurrently. The repository state mutex is not held across the checkpoint, `retire_replaced`, or `close_retired_entry_until`.

`entry_until` already holds a `RetirementCapacity` taken before `acquire_bound`. `close_retired_entry_until` takes another. Those two reservations must not be held together: with 15 other incomplete retirements the construction reservation is the 16th slot, and the helper then waits for a 17th until timeout. The same deadlock happens when 16 builders of renamed databases each keep one construction reservation and then each wait for another. `entry_until` drops its construction `RetirementCapacity` before the helper. `read_revision` does not hold one. After the helper retires at least one entry and the single retry `acquire_bound` succeeds, `entry_until` reserves capacity again through the existing `reserve_retirement_capacity` before the existing insert-time eviction. If that later reserve times out or is cancelled, that error is returned and the uninserted pool and binding are dropped. If the helper retires nothing, the original conflict is returned and no second reservation is taken.

If the helper returns an error, that error is the call result. The original conflict is not substituted. `BuildGuard` then clears `building` by its existing drop.

### Select idle cached holders of this inode

Under the repository state mutex, consider entries whose `EntryKey.identity` equals the target inode, whose path is not tombstoned, whose `Arc` strong count is 1, and whose `is_idle` is true. Skip the incoming key if it is already present. At most `MAX_OPEN_DATABASES` entries exist. One inode has one binding, so one match is the expected case; every match that passes the stale-name probe is retired before the single retry.

Do not remove the entry from the map before the existing `close_retired_entry_until` removal. Removing it early would let another `entry_until` for the old key build a second pool on the still-live registration.

### Decide staleness from the retained parent and leaf

While still holding the repository mutex, and before closing the lease gate, ask the entry's `BoundDatabase` whether its retained parent and leaf still name that binding's inode. The new method calls `probe_regular_file_at` and compares the returned identity with the binding's identity. It does not call `open`, `open_regular_at`, or `probe_current` on a pathname.

* Same identity: the leaf is a live name. Leave the entry cached and do not retire it.
* `Error::Io` whose kind is not-found, or `Error::InvalidInput` equal to the existing non-regular-file message: the retained name no longer names the inode. The entry is stale.
* A successful probe of a different identity: the retained name is now a different file. The entry is stale.
* `Error::Conflict` from the probe, and every other I/O error: return that error. Do not retire. Do not replace it with the admission conflict.

Re-check strong count 1 and `is_idle` under the same mutex hold after the probe. If either check fails, do not retire that entry.

### Close the lease gate before leaving the mutex, then drain

For a stale idle match, close its lease gate before releasing the repository mutex, so a concurrent `entry_until` of the old key observes the existing "database is being replaced or deleted" conflict instead of cloning the `Arc` and taking a lease. `DrainGate::close` is idempotent.

Then release the mutex. Before `retire_replaced` drops the pool, checkpoint committed WAL frames into the main database inode through a connection the pool already holds. Pooled connections set `PRAGMA journal_mode = WAL`. The retired leaf name is already gone, so SQLite's checkpoint-on-close will not copy those frames: the bound stat of the vanished leaf fails, and the locked SQLite build skips checkpoint-on-close when the database file has been moved. The new leaf would then open with a different `-wal` name and miss committed rows. The checkpoint is `PRAGMA wal_checkpoint(TRUNCATE)` on a connection taken from that entry's pool. It uses the binding's already open descriptors. It does not open the vanished leaf by pathname and does not open a new pooled connection. If the pool has no connection, skip the checkpoint and continue; a new open would stat the vanished leaf and fail. A pool reaper that already closed the last connection after the rename is a known limit of this helper, not a second recovery path.

If a pooled connection exists and the checkpoint fails, return that error. Do not retire and do not admit the new name. Reopen the lease gate when the connection gate is still open, the same condition as `cancel_retirement`.

Then call the existing `retire_replaced` with the caller's cancellation token. That waits for leases, publishes the retirement, drops the pool outside the mutex, and waits for the connection and owner gates. On timeout or cancellation, `retire_replaced` already keeps an undrained gate and reopens the lease gate only when the connection gate is still open. Return that error. The retry `acquire_bound` runs only after `retire_replaced` returns success, so it does not run while that connection gate is still open.

After `retire_replaced` returns success, drop every `Arc<DatabaseEntry>` the helper holds for that entry before acquiring again. The entry's `bound` is what keeps the registration alive after the pool drop.

A probe that races a restore of the same inode between the stat and `publish_retirement` can drain an idle live alias. That alias can open again after the last binding release, which d-20261011-01 already allows. Do not drop the binding before the drain returns.

### Retry establishment once, behind a fresh admission

If the helper retired at least one entry, the caller takes a fresh predecessor admission and calls `acquire_bound` once more.

* `entry_until` passes the deadline it already uses for `predecessor_admission`. It does not extend that deadline. The fresh admission waits for any still-incomplete matching retirement (d-20261011-08, d-20261011-10, d-20261011-11) and then establishment continues with the same `BuildGuard`.
* `read_revision` calls `predecessor_admission_for` again, which uses its existing `now + retire_wait` window, then retries `acquire_bound` once and continues the existing read-only open. It still does not create a pool.

If the helper retires nothing, the caller returns the original conflict and does not take a second admission.

The bound is one drain wait plus one fresh admission window per call, then either success or the second conflict. It is not a loop.

### What stays refused

* A live hard link whose retained leaf still names the inode stays cached, and the new name stays in conflict.
* An entry with a live lease or any extra `Arc` stays cached. The conflicting open returns the admission conflict. A later open, after the lease and extra `Arc` are gone, is a new call and may retire once.
* A tombstoned path stays on the deletion path.
* Direct `BoundDatabase::acquire` callers do not retire. After this repository path has dropped the stale registration, a later direct acquire of the new name succeeds. An in-flight `scan_worker` that already holds its own `BoundDatabase` keeps the new name refused until that clone drops; the one repository retry then returns the conflict. Archiving a new name that this repository has never opened, while an idle cache still holds the inode, still conflicts. That is not the filed open path. `get_db_info_blocking` reaches the scan only after `get_db_or_create` succeeds, so the user open retires first.

### Failure and ownership

The repository remains the owner of pooled entries and retirement records. Retirement records stay bounded by `MAX_OPEN_DATABASES` through the existing capacity reservation. No new registry, reaper, or retry thread is added. Poisoned repository and registry locks keep their existing typed conflicts. No new `unwrap` or `expect` on a file, database, or renderer-driven path. The helper does not call `BLOCKING_GATEWAY`.

The renderer payload for both admission messages stays `database_admission`. No command, event, binding, or UI string changes.

## Decisions and trade-offs

### Decided autonomously

Question (from the finding's open question): on a same-inode admission conflict in the repository build path, retire an idle cached entry whose retained name no longer names that inode and retry once, re-probe every idle entry on any conflict, or leave the refusal until LRU or restart?

Chosen: retire only idle cached entries of that inode whose retained parent and leaf no longer name it, through `retire_replaced`, then retry the repository establishment once behind a fresh predecessor admission. Both preserved admission messages use this path. `BoundDatabase::acquire` is unchanged.

Rejected: re-probing every idle entry on any conflict regardless of inode; accepting restart-until-evicted; weakening `BoundDatabase::acquire`; opening the old leaf by pathname; dropping the pool without `retire_replaced`; retrying while the new key's predecessor admission is still held; unbounded retry.

Reason: the refusal is correct while the idle pool holds the inode, and f-20260930-01 requires the drain before the binding is released. The predecessor-admission deadlock is avoided by dropping that admission first. Live hard links stay refused, which is the accepted risk in the f-20260929-05 review. Record this with `record-decision` at adoption. Reversal path: stop calling the helper from `entry_until` and `read_revision`, leaving admission and LRU as they are on this base.

Governing decisions that stay closed: d-20261011-01, d-20261011-02, d-20261011-07, d-20261011-08, d-20261011-09, d-20261011-10, d-20261011-11, d-20261011-13, d-20261011-15, d-20260929-04, d-20260930-10.

## Risks / open questions

* Windows may refuse to rename a file that still has the pool's handles. The production helper is not `cfg`-gated. The regression that renames or moves an open database is `#[cfg(unix)]` when Windows cannot perform that rename. Windows and macOS CI remain the runtime authority for the shared code (d-20261011-02). Do not add a Windows-only retirement policy.
* The restore race between the stale stat and `publish_retirement` can drain an idle alias that was restored as the same inode. The other name opens after the drain. That is accepted.
* A direct acquire that bypasses the repository can still observe the conflict until the repository entry is gone. Stated under "What stays refused".
* `read_revision`'s retry uses a second `predecessor_admission_for` window. `entry_until` does not extend its original deadline. Both are one-shot.

## Not part of this task

* Changing `BoundDatabase::acquire`, binding-key identity, or the two conflict strings.
* UI presentation of the conflict (f-20261009-03), generated bindings, and renderer state.
* `scan_worker`, `snapshot_database`, and `linked_collections::legacy`, except that they must keep compiling against an unchanged `BoundDatabase::acquire`.
* PGN boundaries, the byte-offset index, move encoding, and `CastlingMode`.
* Cross-process lock coordination, crash recovery, and other queued database findings.
* d-20261011-15's thread-pool builder.
* Co-located findings. This cluster is the singleton `f-20261011-01`.

## Phases

### Phase 1 — Idle vanished-holder retirement

Role: `sensitive`. One write leaf. Files: `src-tauri/src/db/repository.rs`, `src-tauri/src/db/bound_sqlite.rs`. Read-only context: `src-tauri/src/db/mod.rs`, `src-tauri/src/db/content_validation.rs`, `src-tauri/src/db/linked_collections.rs`, `src-tauri/src/db/linked_collections/legacy.rs`, `src-tauri/src/error.rs`, `src-tauri/src/infra/fs.rs`.

Implement every Approach heading. Add repository regressions:

* Same-folder external rename, old entry idle, no lease held: `connection` on the new name succeeds, the old key is gone, and the old leaf is not still cached. This assertion is the base failure: on this base the new name returns the admission conflict. Do not weaken it to accept that conflict.
* That same regression commits a row through the cached pool, returns the connection to the pool without checkpointing, renames only the main file, and reads the committed row and its revision back from the new name. A write performed after the reopen is not this proof. The old `-wal` must not be required for the read.
* The new name's `acquire_bound` is not reached until `retire_replaced` has returned. The regression blocks in the existing `RetirementPublished` hook while holding one extra connection ticket, so the connection gate stays undrained and the new-name open stays blocked. After release, the open succeeds and the gate is closed with outstanding 0. A path that admits the new name before that drain fails this assertion.
* `read_revision` / `database_identity` on the new name, with no prior `connection` on that name, retires the same idle holder and returns the revision. That success assertion is also the base failure.
* A live same-parent hard link stays in conflict and the cached entry remains. A live cross-directory hard link stays in conflict.
* A cross-directory move of an idle cached file admits the new path once.
* An outstanding lease blocks retirement: the new name conflicts, the old entry remains, and a later open after the lease drops succeeds.
* One-shot bound after a retirement that still conflicts: a `cfg(test)` counter of helper invocations, plus a test hook that holds a separate `BoundDatabase` on a still-present hard link of the same inode across the retry. The helper runs once, the retry returns the admission conflict, and the counter stays 1. Removing the local flag makes the helper run again and fails the counter. The live-link refusal, which retires nothing, stays a separate case and still leaves the cached entry in place.
* Capacity: with 15 incomplete retirements already occupying slots, `entry_until` on the renamed idle database still drains it and admits the new name. Use `with_retire_wait` so a regression that keeps both reservations fails on the capacity timeout instead of the production wait. Follow the existing retirement-capacity fixtures.
* `replacement_at_the_same_path_never_reuses_an_old_pooled_connection` stays as written, including its `close_and_invalidate` before the rename.
* Existing `hard_link_alias_is_refused_until_cached_entry_and_owners_are_released`, `wal_writer_survives_alias_refusal`, and `revision_read_refuses_same_parent_alias` stay green.

The new rename, move, and lease tests are `#[cfg(unix)]` if the platform cannot rename an open database. The helper they drive is not `cfg`-gated.

PROOF COMMAND, one filter per invocation. Each filter is a unique substring of one test name. libtest matches a substring, not a shell pipeline and not a regex union:

```bash
cargo test --manifest-path src-tauri/Cargo.toml --locked --lib -- vanished_renamed_idle_cache_opens_under_the_new_name
cargo test --manifest-path src-tauri/Cargo.toml --locked --lib -- vanished_renamed_idle_cache_keeps_committed_row
cargo test --manifest-path src-tauri/Cargo.toml --locked --lib -- vanished_renamed_idle_cache_waits_for_drain
cargo test --manifest-path src-tauri/Cargo.toml --locked --lib -- revision_read_retires_vanished_idle_cache
cargo test --manifest-path src-tauri/Cargo.toml --locked --lib -- vanished_rename_retry_conflict_runs_helper_once
cargo test --manifest-path src-tauri/Cargo.toml --locked --lib -- vanished_rename_admits_with_fifteen_incomplete_retirements
cargo test --manifest-path src-tauri/Cargo.toml --locked --lib -- hard_link_alias_is_refused_until_cached_entry_and_owners_are_released
cargo test --manifest-path src-tauri/Cargo.toml --locked --lib -- wal_writer_survives_alias_refusal
cargo test --manifest-path src-tauri/Cargo.toml --locked --lib -- revision_read_refuses_same_parent_alias
cargo test --manifest-path src-tauri/Cargo.toml --locked --lib -- replacement_at_the_same_path_never_reuses_an_old_pooled_connection
```

The leaf names the new tests so each filter matches that test. Adopter, not this plan session: `pnpm checks:pre-review` before diff review, and `pnpm gates:push -- --rust` at release.

Rules for the write leaf, read in full, no further discovery: `.claude/rules/async-resource-invariants.md`, `.claude/rules/pgn-scanning.md`. PGN scanning applies only as a negative: do not change game boundaries, the byte-offset index, move encoding, search predicates, or `CastlingMode`.

### plan-r3.md

# Plan: Retire a vanished idle database cache on a same-inode admission conflict

## Goal

When a database file is renamed or moved outside ChessFable while its old name's repository entry is idle, opening the new name retires that idle entry through the existing drain-then-release path and admits the new name once. A live hard link, a busy lease, and `BoundDatabase::acquire` stay refused exactly as they are today.

## MANDATE

f-20261011-01, verbatim:

* **ID:** f-20261011-01 · **Status:** open · **Area:** db-search · **Root:** - · **Entry:** build · **Blocked:** none
* **Filed from:** d7fc28c0-e3c5-4fb5-b34f-fee1b64dec2f
* **Where:** `src-tauri/src/db/bound_sqlite.rs` (`BoundDatabase::acquire`, same-inode admission added for f-20260929-05: `"database is open through another name"`); `src-tauri/src/db/repository.rs` (`evict_idle_entries`, `:1092`, evicts only while `state.entries.len() > MAX_OPEN_DATABASES`; a cached `DatabaseEntry` owns its binding); the adapted test `replacement_at_the_same_path_never_reuses_an_old_pooled_connection` has to `close_and_invalidate` the setup name before reopening the renamed inode.
* **Defect:** after f-20260929-05, a database file renamed in the same folder outside ChessFable (file manager, sync client) while its old name's repository entry is cached gets `Conflict("database is open through another name")` on every open under the new name. The old entry is never accessed again (its path is gone), so the stale probe never retires it, and LRU eviction only fires above `MAX_OPEN_DATABASES`; the refusal therefore lasts until enough other databases are opened or the app restarts. The refusal itself is correct while the idle pool holds open SQLite connections on the inode (they share its `-shm`), so the defect is the retention, not the admission.
* **Why it matters:** a user who renames a database outside the app sees it fail to open with a generic database error (presentation: f-20261009-03) until restarting ChessFable.
* **Open question:** should a same-inode admission conflict in the repository's build path retire an idle cached entry whose own path no longer resolves to that inode (draining its pool through the existing retire/close path) and retry once, or should the repository re-probe idle entries' paths on a conflict, or is restart-until-evicted acceptable? Interacts with f-20260930-01 (eviction drops entries without draining connections) — any retirement must drain before the binding is released.
* **Related:** f-20260929-05 (introduced the admission; plan risk "Cached entries keep aliases refused" accepted this for live hard links, not for a vanished old name), f-20260930-01, f-20261009-03. Review record: `tasks/handoffs/2026-10-09-sqlite-hard-link-admission-review.md`.
* **Found by:** orchestrator diff review of the f-20260929-05 phase-1 write leaf (Claude Code, drain session d7fc28c0-e3c5-4fb5-b34f-fee1b64dec2f), 2026-10-11, from the fixture adaptation the leaf reported.

## Threat model and non-goals

The adversary is ordinary local filesystem activity while this process holds an idle pooled binding: a same-directory rename, a move to another directory, a second hard link that is still present, or a rename that races a live lease. The process is the only ChessFable instance for this app-data directory. Cross-process coordination, crash recovery, and a user who keeps the old name as a live hard link are outside the repair.

A vanished name must not be able to pin the inode until sixteen other databases evict it or the process restarts. A live second name must not be able to force that retirement. Retirement must not drop SQLite connections before they drain, and it must not close a lockable descriptor of the database inode on Unix.

## Traced premises

Confirmed on `6b600397549d5bd324205f0db8592dbe9b450ff6`. Obligations below do not cite lines.

* `BoundDatabase::acquire` refuses a second binding key for an inode that already has a published registration or a creation reservation. Different parent identity returns `DATABASE_OPEN_THROUGH_ANOTHER_DIRECTORY`; same parent and different leaf returns `DATABASE_OPEN_THROUGH_ANOTHER_NAME`. Identical keys reuse one registration. This door stays unchanged (d-20261011-01).
* The user open is `get_db_info_blocking` → `get_db_or_create` → `DatabaseRepository::connection` → `entry_until`. `entry_until` takes `predecessor_admission` for the new key, then `acquire_bound`. On the admission conflict it returns. Nothing in that path looks for a different cached key that holds the inode.
* `database_identity` hydrates through `read_revision`. `get_db_info_blocking` calls that only after `get_db_or_create` has returned a connection for the same target. `read_revision` itself also takes `predecessor_admission_for` and then `acquire_bound`, and it does not go through `entry_until`. A revision read of a new name while the old idle entry still holds the inode conflicts on its own.
* `identity_from_probe`, when hydrating, calls `probe_schema_and_revision` four times and returns `database changed while reading its identity` if the schema samples or the revisions disagree. `probe_schema_and_revision` captures schema metadata before `read_revision`.
* `classify_bound_failure` / `classify_bound_open_error_result` rewrites the Unix error to `database changed after capability resolution` when the new target's `probe_current` fails. When that probe succeeds, the original conflict is preserved. Windows `acquire_bound` returns `BoundDatabase::acquire`'s error unchanged. Only the two preserved admission messages are a vanished-holder signal.
* Idle means `DatabaseEntry::is_idle`: lease gate outstanding is 0 and the gate is not closed. `eviction_candidate` also requires `Arc::strong_count(entry) == 1`, so the map is the only owner. An `EntryLease` holds an `Arc<DatabaseEntry>`. LRU eviction runs only when `entries.len()` is already at `MAX_OPEN_DATABASES` (16) during insertion. The finding's `evict_idle_entries` name is stale; the capacity check inside `entry_until` is the current LRU.
* The pool builder sets `min_idle(Some(0))` and does not set an idle timeout. An idle repository entry can therefore hold a pool with zero connections. `ConnectionOptions::on_acquire` sets `PRAGMA journal_mode = WAL`. SQLite names the sidecars by appending `-wal` and `-shm` to the leaf. The bound stat hook `fstatat`s that leaf; a vanished leaf fails the stat, so a new open through that binding cannot checkpoint.
* `EntryKey::matches_predecessor` is same object identity OR same parent identity (d-20261011-10). `retirement_reserved` treats a live admission whose key matches the retiring key as a reservation. `wait_retirement_change` polls on `build_changed` until the deadline. Holding the new name's predecessor admission across `close_retired_entry_until` therefore waits on that same admission until `retire_wait`. Same-folder rename matches on both identity and parent. A cross-directory move of the same inode still matches on object identity.
* `retire_replaced` closes the lease gate, waits for leases, then `close_retired_entry_until` publishes the retirement, drops the pool outside the repository mutex, and waits for the connection and owner gates. On timeout or cancellation it does not forget an undrained gate (d-20261011-09); `cancel_retirement` reopens the lease gate only when the connection gate is not closed. `DatabaseEntry` drops `bound` after the pool field. The binding stays alive until the last `DatabaseEntry` / `BoundDatabase` clone drops, which is after the pool drop inside `close_retired_entry_until` only if the caller also drops its `Arc`.
* `BuildGuard` clears `building` for the new key on drop. `entry_until` returns `database is being replaced or deleted` when the cached entry's lease gate is already closed.
* `Binding` keeps the retained parent `File` and leaf `OsString`. `BoundDatabase` does not expose them. `probe_regular_file_at` stats with `AT_SYMLINK_NOFOLLOW` on Unix and does not open the leaf (d-20260929-04, d-20260930-10, f-20260929-11). On Windows the same function opens and closes a read handle; byte-range locks are handle-scoped (d-20260930-10). Absence is `Error::Io`. A non-regular file is `Error::InvalidInput` (`target must be a regular file`). A stat identity change across the probe is `Error::Conflict` (`workspace entry changed concurrently`).
* `scan_worker`, `snapshot_database`, and `linked_collections::legacy` call `BoundDatabase::acquire` directly. `scan_worker` already holds `predecessor_admission_for` across establishment and drops it before `validate_content` (d-20261011-13). `get_db_info_blocking` schedules that scan only after the connection exists.
* `replacement_at_the_same_path_never_reuses_an_old_pooled_connection` still `close_and_invalidate`s the setup name before renaming the inode onto the original path. Live same-parent refusal is `hard_link_alias_is_refused_until_cached_entry_and_owners_are_released`, `wal_writer_survives_alias_refusal`, and `revision_read_refuses_same_parent_alias`.
* f-20260930-01's drain gap is already closed by `retire_replaced` / `publish_retirement` (d-20261011-07, d-20261011-09). This plan uses that path. It does not reopen those decisions. d-20261011-15's per-pool thread-pool construction stays untouched.

## Approach

### Preserve admission

`BoundDatabase::acquire` still refuses a second distinct key for one inode, against published registrations and creation reservations, before any VFS or SQLite open. Identical keys, including Windows case variants, still share one registration. This plan does not add a retry inside `acquire`.

### Recognize only a preserved admission conflict

Repository establishment treats an error as a vanished-holder conflict only when it is `Error::Conflict` whose message is exactly `DATABASE_OPEN_THROUGH_ANOTHER_NAME` or `DATABASE_OPEN_THROUGH_ANOTHER_DIRECTORY`. `database changed after capability resolution`, a tombstone conflict, a construction timeout, cancellation, and every other error are unchanged and do not retire anything.

### One shared retirement attempt on both repository establishment sites

`entry_until` and `read_revision` are the only production callers of `acquire_bound`. Both use one private repository helper. The helper is not used from `scan_worker`, `snapshot_database`, or `linked_collections::legacy`.

Each call attempts this helper at most once, tracked by a local flag on that call. A second preserved admission conflict from the same call is returned as that conflict. The helper does not loop.

### Drop the predecessor admission before retirement

The new key's predecessor admission matches the old entry by object identity, and for a same-folder rename also by parent identity. The helper therefore runs only after that admission has been dropped.

In `entry_until` the `BuildGuard` for the new key stays held across the helper, so a second builder of the new key waits on `building` instead of retiring concurrently. The repository state mutex is not held across the checkpoint, `retire_replaced`, or `close_retired_entry_until`.

`entry_until` already holds a `RetirementCapacity` taken before `acquire_bound`. `close_retired_entry_until` takes another. Those two reservations must not be held together: with 15 other incomplete retirements the construction reservation is the 16th slot, and the helper then waits for a 17th until timeout. The same deadlock happens when 16 builders of renamed databases each keep one construction reservation and then each wait for another. `entry_until` drops its construction `RetirementCapacity` before the helper. `read_revision` does not hold one. After the helper retires at least one entry and the single retry `acquire_bound` succeeds, `entry_until` reserves capacity again through the existing `reserve_retirement_capacity` before the existing insert-time eviction. If that later reserve times out or is cancelled, that error is returned and the uninserted pool and binding are dropped. If the helper retires nothing, the original conflict is returned and no second reservation is taken.

If the helper returns an error, that error is the call result. The original conflict is not substituted. `BuildGuard` then clears `building` by its existing drop.

### Select idle cached holders of this inode

Under the repository state mutex, consider entries whose `EntryKey.identity` equals the target inode, whose path is not tombstoned, whose `Arc` strong count is 1, and whose `is_idle` is true. Skip the incoming key if it is already present. At most `MAX_OPEN_DATABASES` entries exist. One inode has one binding, so one match is the expected case; every match that passes the stale-name probe is retired before the single retry.

Do not remove the entry from the map before the existing `close_retired_entry_until` removal. Removing it early would let another `entry_until` for the old key build a second pool on the still-live registration.

### Decide staleness from the retained parent and leaf

While still holding the repository mutex, and before closing the lease gate, ask the entry's `BoundDatabase` whether its retained parent and leaf still name that binding's inode. The new method calls `probe_regular_file_at` and compares the returned identity with the binding's identity. It does not call `open`, `open_regular_at`, or `probe_current` on a pathname.

* Same identity: the leaf is a live name. Leave the entry cached and do not retire it.
* `Error::Io` whose kind is not-found, or `Error::InvalidInput` equal to the existing non-regular-file message: the retained name no longer names the inode. The entry is stale.
* A successful probe of a different identity: the retained name is now a different file. The entry is stale.
* `Error::Conflict` from the probe, and every other I/O error: return that error. Do not retire. Do not replace it with the admission conflict.

Re-check strong count 1 and `is_idle` under the same mutex hold after the probe. If either check fails, do not retire that entry.

### Close the lease gate before leaving the mutex, then drain

For a stale idle match, close its lease gate before releasing the repository mutex, so a concurrent `entry_until` of the old key observes the existing "database is being replaced or deleted" conflict instead of cloning the `Arc` and taking a lease. `DrainGate::close` is idempotent.

Then release the mutex. Committed frames may sit only in the vanished leaf's `-wal`. The new leaf does not open that name. Do not admit the new name while those frames exist only there, and do not open the database leaf to find them.

If the pool reports an idle connection, checkpoint before `retire_replaced` through that already held connection. The checkpoint is `PRAGMA wal_checkpoint(TRUNCATE)`. It uses the binding's already open descriptors. It does not call `open`, `open_regular_at`, or `probe_current` on the database leaf, and it does not create a pooled connection. Return that connection to the pool before `retire_replaced`, so its own connection ticket is not outstanding. Do not move sidecars after this checkpoint succeeds: the frames are in the main inode. If the checkout or the checkpoint fails, return that error. Do not retire, do not move sidecars, and do not admit the new name. Reopen the lease gate when the connection gate is still open, the same condition as `cancel_retirement`.

If the pool reports no connections, do not checkpoint and do not create a connection. Stat the retained parent's `<leaf>-wal` with `probe_regular_file_at`. Not found, or length 0: nothing of this database remains in a wal; retire as below. Any other probe error, including a non-regular file: return that error, do not retire, and do not admit. Length greater than 0: move that wal onto the new leaf before `retire_replaced`, or refuse. Also move `<leaf>-shm` when that probe finds a regular file. The destination names are the new leaf plus `-wal` and `-shm` in the new parent, for a same-directory rename or a cross-directory move. If either destination exists, return that error before moving either file. Move by rename only. Do not copy, and do not open the database leaf. If the wal rename succeeds and the shm rename fails, rename the wal back. If that restore fails, return that error and do not retire. This move is not used after a successful checkpoint. The single retry open is what applies the moved wal to the main inode. This helper does not delete the moved files.

A checkout or probe failure on this path returns that error, does not retire, and does not admit. Reopen the lease gate when the connection gate is still open.

Then call the existing `retire_replaced` with the caller's cancellation token. That waits for leases, publishes the retirement, drops the pool outside the mutex, and waits for the connection and owner gates. On timeout or cancellation, `retire_replaced` already keeps an undrained gate and reopens the lease gate only when the connection gate is still open. Return that error. The retry `acquire_bound` runs only after `retire_replaced` returns success, so it does not run while that connection gate is still open.

After `retire_replaced` returns success, drop every `Arc<DatabaseEntry>` the helper holds for that entry before acquiring again. The entry's `bound` is what keeps the registration alive after the pool drop.

A probe that races a restore of the same inode between the stat and `publish_retirement` can drain an idle live alias. That alias can open again after the last binding release, which d-20261011-01 already allows. Do not drop the binding before the drain returns.

### Retry establishment once, behind a fresh admission

If the helper retired at least one entry, the caller takes a fresh predecessor admission and calls `acquire_bound` once more.

* `entry_until` passes the deadline it already uses for `predecessor_admission`. It does not extend that deadline. The fresh admission waits for any still-incomplete matching retirement (d-20261011-08, d-20261011-10, d-20261011-11) and then establishment continues with the same `BuildGuard`.
* `read_revision` calls `predecessor_admission_for` again, which uses its existing `now + retire_wait` window, then retries `acquire_bound` once and continues the existing read-only open. It still does not create a pool.

If the helper retires nothing, the caller returns the original conflict and does not take a second admission.

The bound is one drain wait plus one fresh admission window per call, then either success or the second conflict. It is not a loop.

### One identity resample after this call writes the main file

A vanished-holder checkpoint, or the retry open that recovers a wal this call moved, writes the main file inside the first `read_revision`. That read is after the schema sample, so the four samples disagree and `identity_from_probe` would reject this call's own write.

When this call did that write and the four samples disagree, `identity_from_probe` runs the four-sample loop once more. The second loop's four samples must agree with each other, and the revision is the committed revision. A further disagreement is still `database changed while reading its identity`. When this call did not write the main file, disagreement is that conflict and there is no second loop. The flag belongs to this identity read, not to the process. The `connection` path checkpoints inside `entry_until` before `database_identity`, so that later identity read does not take the second loop unless a write happens inside that read. An external change with no write by this call still conflicts.

### What stays refused

* A live hard link whose retained leaf still names the inode stays cached, and the new name stays in conflict.
* An entry with a live lease or any extra `Arc` stays cached. The conflicting open returns the admission conflict. A later open, after the lease and extra `Arc` are gone, is a new call and may retire once.
* A tombstoned path stays on the deletion path.
* Direct `BoundDatabase::acquire` callers do not retire. After this repository path has dropped the stale registration, a later direct acquire of the new name succeeds. An in-flight `scan_worker` that already holds its own `BoundDatabase` keeps the new name refused until that clone drops; the one repository retry then returns the conflict. Archiving a new name that this repository has never opened, while an idle cache still holds the inode, still conflicts. That is not the filed open path. `get_db_info_blocking` reaches the scan only after `get_db_or_create` succeeds, so the user open retires first.

### Failure and ownership

The repository remains the owner of pooled entries and retirement records. Retirement records stay bounded by `MAX_OPEN_DATABASES` through the existing capacity reservation. No new registry, reaper, or retry thread is added. Poisoned repository and registry locks keep their existing typed conflicts. No new `unwrap` or `expect` on a file, database, or renderer-driven path. The helper does not call `BLOCKING_GATEWAY`.

The renderer payload for both admission messages stays `database_admission`. No command, event, binding, or UI string changes.

## Decisions and trade-offs

### Decided autonomously

Question (from the finding's open question): on a same-inode admission conflict in the repository build path, retire an idle cached entry whose retained name no longer names that inode and retry once, re-probe every idle entry on any conflict, or leave the refusal until LRU or restart?

Chosen: retire only idle cached entries of that inode whose retained parent and leaf no longer name it, through `retire_replaced`, then retry the repository establishment once behind a fresh predecessor admission. Both preserved admission messages use this path. `BoundDatabase::acquire` is unchanged.

Rejected: re-probing every idle entry on any conflict regardless of inode; accepting restart-until-evicted; weakening `BoundDatabase::acquire`; opening the old leaf by pathname; dropping the pool without `retire_replaced`; retrying while the new key's predecessor admission is still held; unbounded retry; treating an empty pool as nothing to preserve.

The first P1 correction checkpointed only when a pooled connection already existed and called an empty pool a known limit. That correction is withdrawn. Invariant: do not admit the new name while committed frames exist only under the vanished leaf's `-wal`, and do not open the database leaf to find them. Previous answer: skip the checkpoint when the pool is empty. New evidence: the pool builder uses `min_idle(Some(0))` and leaves the idle timeout unset, and the bound stat of a vanished leaf fails, so a later close cannot copy frames into the main inode. Judgment: an idle connection still checkpoints with `wal_checkpoint(TRUNCATE)` and does not move sidecars; zero connections with a non-empty `<leaf>-wal` move that wal, and `<leaf>-shm` when it is a regular file, onto the new leaf before retirement; a zero-length or absent wal retires without a move; any other empty-pool probe error refuses. Rejected for this judgment: leaving the empty pool as a known limit; opening a new pooled connection on the vanished leaf; deleting the wal; copying sidecars; moving sidecars after a successful `TRUNCATE`.

Reason: the refusal is correct while the idle pool holds the inode, and f-20260930-01 requires the drain before the binding is released. The predecessor-admission deadlock is avoided by dropping that admission first. Live hard links stay refused, which is the accepted risk in the f-20260929-05 review. Record this with `record-decision` at adoption. Reversal path: stop calling the helper from `entry_until` and `read_revision`, leaving admission and LRU as they are on this base.

Governing decisions that stay closed: d-20261011-01, d-20261011-02, d-20261011-07, d-20261011-08, d-20261011-09, d-20261011-10, d-20261011-11, d-20261011-13, d-20261011-15, d-20260929-04, d-20260930-10.

## Risks / open questions

* Windows may refuse to rename a file that still has the pool's handles. The production helper is not `cfg`-gated. The regression that renames or moves an open database is `#[cfg(unix)]` when Windows cannot perform that rename. Windows and macOS CI remain the runtime authority for the shared code (d-20261011-02). Do not add a Windows-only retirement policy.
* The restore race between the stale stat and `publish_retirement` can drain an idle alias that was restored as the same inode. The other name opens after the drain. That is accepted.
* If the new leaf's `-wal` or `-shm` already exists, this helper refuses and leaves the idle entry cached. It does not overwrite those files.
* After a successful `TRUNCATE`, the vanished leaf's `-wal` and `-shm` can remain beside the old name. The new name does not read them. They are leftover, not a second copy of the committed rows.
* A direct acquire that bypasses the repository can still observe the conflict until the repository entry is gone. Stated under "What stays refused".
* `read_revision`'s retry uses a second `predecessor_admission_for` window. `entry_until` does not extend its original deadline. Both are one-shot.

## Not part of this task

* Changing `BoundDatabase::acquire`, binding-key identity, or the two conflict strings.
* UI presentation of the conflict (f-20261009-03), generated bindings, and renderer state.
* `scan_worker`, `snapshot_database`, and `linked_collections::legacy`, except that they must keep compiling against an unchanged `BoundDatabase::acquire`.
* PGN boundaries, the byte-offset index, move encoding, and `CastlingMode`.
* Cross-process lock coordination, crash recovery, and other queued database findings.
* d-20261011-15's thread-pool builder.
* Co-located findings. This cluster is the singleton `f-20261011-01`.

## Phases

### Phase 1 — Idle vanished-holder retirement

Role: `sensitive`. One write leaf. Files: `src-tauri/src/db/repository.rs`, `src-tauri/src/db/bound_sqlite.rs`. Read-only context: `src-tauri/src/db/mod.rs`, `src-tauri/src/db/content_validation.rs`, `src-tauri/src/db/linked_collections.rs`, `src-tauri/src/db/linked_collections/legacy.rs`, `src-tauri/src/error.rs`, `src-tauri/src/infra/fs.rs`.

Implement every Approach heading. Add repository regressions:

* Same-folder external rename, old entry idle, no lease held: `connection` on the new name succeeds, the old key is gone, and the old leaf is not still cached. This assertion is the base failure: on this base the new name returns the admission conflict. Do not weaken it to accept that conflict.
* That same regression commits a row through the cached pool, returns the connection to the pool without checkpointing, renames only the main file, and reads the committed row back from the new name. `database_identity` on that new name then returns the committed revision. A write performed after the reopen is not this proof. After the open returns, the row is still readable if the vanished leaf's `-wal` is removed, because the checkpoint wrote the frames into the main inode. This path leaves an idle pooled connection in place so the checkpoint runs. It does not move sidecars.
* Empty pool, same commit and rename: the test closes idle pooled connections before opening the new name, and it does not sleep. `connection` reads the committed row, and `database_identity` returns the committed revision. The vanished leaf's `-wal` is not the source of that read. Closing those connections is the regression's stand-in for the pool reaching zero connections. It does not change the production reaper. A helper that admits the new name without checkpointing and without moving the non-empty wal fails this read.
* The new name's retry `acquire_bound` is not reached until `retire_replaced` has returned. The new-name open runs on another thread. The regression blocks in the existing `RetirementPublished` hook while holding one extra connection ticket. It then releases that hook and keeps the ticket. It waits until the connection gate is observed waiting, or until a retry acquire happens. The acquire count for the new name must still be the one pre-retirement attempt, and the gate must be the thing that is waiting. It then drops the ticket. The open succeeds, the retry acquire has run once, and the gate is closed with outstanding 0. Releasing the hook and the ticket together is not this proof. A path that skips the connection-gate wait fails the middle assertion.
* `database_identity` on the new name, with no prior `connection` on that name and with committed frames still only in the wal, retires the same idle holder and returns the committed revision. That success is the base failure: on this base the new name returns the admission conflict. A checkpoint or wal recovery inside the first `read_revision` must not surface as `database changed while reading its identity`. The four samples of the one allowed resample agree. A metadata change when this call did not write the main file still returns that conflict.
* A live same-parent hard link stays in conflict and the cached entry remains. A live cross-directory hard link stays in conflict.
* A cross-directory move of an idle cached file admits the new path once.
* An outstanding lease blocks retirement: the new name conflicts, the old entry remains, and a later open after the lease drops succeeds.
* One-shot bound after a retirement that still conflicts: a `cfg(test)` counter of helper invocations, plus a test hook that holds a separate `BoundDatabase` on a still-present hard link of the same inode across the retry. The helper runs once, the retry returns the admission conflict, and the counter stays 1. Removing the local flag makes the helper run again and fails the counter. The live-link refusal, which retires nothing, stays a separate case and still leaves the cached entry in place.
* Capacity: with 15 incomplete retirements already occupying slots, `entry_until` on the renamed idle database still drains it and admits the new name. Use `with_retire_wait` so a regression that keeps both reservations fails on the capacity timeout instead of the production wait. Follow the existing retirement-capacity fixtures.
* `replacement_at_the_same_path_never_reuses_an_old_pooled_connection` stays as written, including its `close_and_invalidate` before the rename.
* Existing `hard_link_alias_is_refused_until_cached_entry_and_owners_are_released`, `wal_writer_survives_alias_refusal`, and `revision_read_refuses_same_parent_alias` stay green.

The new rename, move, and lease tests are `#[cfg(unix)]` if the platform cannot rename an open database. The helper they drive is not `cfg`-gated.

PROOF COMMAND, one filter per invocation. Each filter is a unique substring of one test name. libtest matches a substring, not a shell pipeline and not a regex union:

```bash
cargo test --manifest-path src-tauri/Cargo.toml --locked --lib -- vanished_renamed_idle_cache_opens_under_the_new_name
cargo test --manifest-path src-tauri/Cargo.toml --locked --lib -- vanished_renamed_idle_cache_keeps_committed_row
cargo test --manifest-path src-tauri/Cargo.toml --locked --lib -- vanished_renamed_idle_cache_keeps_row_after_idle_close
cargo test --manifest-path src-tauri/Cargo.toml --locked --lib -- vanished_renamed_idle_cache_waits_for_drain
cargo test --manifest-path src-tauri/Cargo.toml --locked --lib -- revision_read_retires_vanished_idle_cache
cargo test --manifest-path src-tauri/Cargo.toml --locked --lib -- vanished_rename_retry_conflict_runs_helper_once
cargo test --manifest-path src-tauri/Cargo.toml --locked --lib -- vanished_rename_admits_with_fifteen_incomplete_retirements
cargo test --manifest-path src-tauri/Cargo.toml --locked --lib -- hard_link_alias_is_refused_until_cached_entry_and_owners_are_released
cargo test --manifest-path src-tauri/Cargo.toml --locked --lib -- wal_writer_survives_alias_refusal
cargo test --manifest-path src-tauri/Cargo.toml --locked --lib -- revision_read_refuses_same_parent_alias
cargo test --manifest-path src-tauri/Cargo.toml --locked --lib -- replacement_at_the_same_path_never_reuses_an_old_pooled_connection
```

The leaf names the new tests so each filter matches that test. Adopter, not this plan session: `pnpm checks:pre-review` before diff review, and `pnpm gates:push -- --rust` at release.

Rules for the write leaf, read in full, no further discovery: `.claude/rules/async-resource-invariants.md`, `.claude/rules/pgn-scanning.md`. PGN scanning applies only as a negative: do not change game boundaries, the byte-offset index, move encoding, search predicates, or `CastlingMode`.

### plan-r4.md

# Plan: Retire a vanished idle database cache on a same-inode admission conflict

## Goal

When a database file is renamed or moved outside ChessFable while its old name's repository entry is idle, opening the new name retires that idle entry through the existing drain-then-release path and admits the new name once. A live hard link, a busy lease, and `BoundDatabase::acquire` stay refused exactly as they are today.

## MANDATE

f-20261011-01, verbatim:

* **ID:** f-20261011-01 · **Status:** open · **Area:** db-search · **Root:** - · **Entry:** build · **Blocked:** none
* **Filed from:** d7fc28c0-e3c5-4fb5-b34f-fee1b64dec2f
* **Where:** `src-tauri/src/db/bound_sqlite.rs` (`BoundDatabase::acquire`, same-inode admission added for f-20260929-05: `"database is open through another name"`); `src-tauri/src/db/repository.rs` (`evict_idle_entries`, `:1092`, evicts only while `state.entries.len() > MAX_OPEN_DATABASES`; a cached `DatabaseEntry` owns its binding); the adapted test `replacement_at_the_same_path_never_reuses_an_old_pooled_connection` has to `close_and_invalidate` the setup name before reopening the renamed inode.
* **Defect:** after f-20260929-05, a database file renamed in the same folder outside ChessFable (file manager, sync client) while its old name's repository entry is cached gets `Conflict("database is open through another name")` on every open under the new name. The old entry is never accessed again (its path is gone), so the stale probe never retires it, and LRU eviction only fires above `MAX_OPEN_DATABASES`; the refusal therefore lasts until enough other databases are opened or the app restarts. The refusal itself is correct while the idle pool holds open SQLite connections on the inode (they share its `-shm`), so the defect is the retention, not the admission.
* **Why it matters:** a user who renames a database outside the app sees it fail to open with a generic database error (presentation: f-20261009-03) until restarting ChessFable.
* **Open question:** should a same-inode admission conflict in the repository's build path retire an idle cached entry whose own path no longer resolves to that inode (draining its pool through the existing retire/close path) and retry once, or should the repository re-probe idle entries' paths on a conflict, or is restart-until-evicted acceptable? Interacts with f-20260930-01 (eviction drops entries without draining connections) — any retirement must drain before the binding is released.
* **Related:** f-20260929-05 (introduced the admission; plan risk "Cached entries keep aliases refused" accepted this for live hard links, not for a vanished old name), f-20260930-01, f-20261009-03. Review record: `tasks/handoffs/2026-10-09-sqlite-hard-link-admission-review.md`.
* **Found by:** orchestrator diff review of the f-20260929-05 phase-1 write leaf (Claude Code, drain session d7fc28c0-e3c5-4fb5-b34f-fee1b64dec2f), 2026-10-11, from the fixture adaptation the leaf reported.

## Threat model and non-goals

The adversary is ordinary local filesystem activity while this process holds an idle pooled binding: a same-directory rename, a move to another directory, a second hard link that is still present, or a rename that races a live lease. The process is the only ChessFable instance for this app-data directory. Cross-process coordination, crash recovery, and a user who keeps the old name as a live hard link are outside the repair.

A vanished name must not be able to pin the inode until sixteen other databases evict it or the process restarts. A live second name must not be able to force that retirement. Retirement must not drop SQLite connections before they drain, and it must not close a lockable descriptor of the database inode on Unix.

## Traced premises

Confirmed on `6b600397549d5bd324205f0db8592dbe9b450ff6`. Obligations below do not cite lines.

* `BoundDatabase::acquire` refuses a second binding key for an inode that already has a published registration or a creation reservation. Different parent identity returns `DATABASE_OPEN_THROUGH_ANOTHER_DIRECTORY`; same parent and different leaf returns `DATABASE_OPEN_THROUGH_ANOTHER_NAME`. Identical keys reuse one registration. This door stays unchanged (d-20261011-01).
* The user open is `get_db_info_blocking` → `get_db_or_create` → `DatabaseRepository::connection` → `entry_until`. `entry_until` takes `predecessor_admission` for the new key, then `acquire_bound`. On the admission conflict it returns. Nothing in that path looks for a different cached key that holds the inode.
* `database_identity` hydrates through `read_revision`. `get_db_info_blocking` calls that only after `get_db_or_create` has returned a connection for the same target. `read_revision` itself also takes `predecessor_admission_for` and then `acquire_bound`, and it does not go through `entry_until`. A revision read of a new name while the old idle entry still holds the inode conflicts on its own.
* `identity_from_probe`, when hydrating, calls `probe_schema_and_revision` four times and returns `database changed while reading its identity` if the schema samples or the revisions disagree. `probe_schema_and_revision` captures schema metadata before `read_revision`.
* `classify_bound_failure` / `classify_bound_open_error_result` rewrites the Unix error to `database changed after capability resolution` when the new target's `probe_current` fails. When that probe succeeds, the original conflict is preserved. Windows `acquire_bound` returns `BoundDatabase::acquire`'s error unchanged. Only the two preserved admission messages are a vanished-holder signal.
* Idle means `DatabaseEntry::is_idle`: lease gate outstanding is 0 and the gate is not closed. `eviction_candidate` also requires `Arc::strong_count(entry) == 1`, so the map is the only owner. An `EntryLease` holds an `Arc<DatabaseEntry>`. LRU eviction runs only when `entries.len()` is already at `MAX_OPEN_DATABASES` (16) during insertion. The finding's `evict_idle_entries` name is stale; the capacity check inside `entry_until` is the current LRU.
* The pool builder sets `min_idle(Some(0))` and does not set an idle timeout. An idle repository entry can therefore hold a pool with zero connections. `ConnectionOptions::on_acquire` sets `PRAGMA journal_mode = WAL`. SQLite names the sidecars by appending `-wal` and `-shm` to the leaf. The bound stat hook `fstatat`s that leaf; a vanished leaf fails the stat, so a new open through that binding cannot checkpoint.
* `EntryKey::matches_predecessor` is same object identity OR same parent identity (d-20261011-10). `retirement_reserved` treats a live admission whose key matches the retiring key as a reservation. `wait_retirement_change` polls on `build_changed` until the deadline. Holding the new name's predecessor admission across `close_retired_entry_until` therefore waits on that same admission until `retire_wait`. Same-folder rename matches on both identity and parent. A cross-directory move of the same inode still matches on object identity.
* `retire_replaced` closes the lease gate, waits for leases, then `close_retired_entry_until` publishes the retirement, drops the pool outside the repository mutex, and waits for the connection and owner gates. On timeout or cancellation it does not forget an undrained gate (d-20261011-09); `cancel_retirement` reopens the lease gate only when the connection gate is not closed. `DatabaseEntry` drops `bound` after the pool field. The binding stays alive until the last `DatabaseEntry` / `BoundDatabase` clone drops, which is after the pool drop inside `close_retired_entry_until` only if the caller also drops its `Arc`.
* `BuildGuard` clears `building` for the new key on drop. `entry_until` returns `database is being replaced or deleted` when the cached entry's lease gate is already closed.
* `Binding` keeps the retained parent `File` and leaf `OsString`. `BoundDatabase` does not expose them. `probe_regular_file_at` stats with `AT_SYMLINK_NOFOLLOW` on Unix and does not open the leaf (d-20260929-04, d-20260930-10, f-20260929-11). On Windows the same function opens and closes a read handle; byte-range locks are handle-scoped (d-20260930-10). Absence is `Error::Io`. A non-regular file is `Error::InvalidInput` (`target must be a regular file`). A stat identity change across the probe is `Error::Conflict` (`workspace entry changed concurrently`).
* `scan_worker`, `snapshot_database`, and `linked_collections::legacy` call `BoundDatabase::acquire` directly. `scan_worker` already holds `predecessor_admission_for` across establishment and drops it before `validate_content` (d-20261011-13). `get_db_info_blocking` schedules that scan only after the connection exists.
* `replacement_at_the_same_path_never_reuses_an_old_pooled_connection` still `close_and_invalidate`s the setup name before renaming the inode onto the original path. Live same-parent refusal is `hard_link_alias_is_refused_until_cached_entry_and_owners_are_released`, `wal_writer_survives_alias_refusal`, and `revision_read_refuses_same_parent_alias`.
* f-20260930-01's drain gap is already closed by `retire_replaced` / `publish_retirement` (d-20261011-07, d-20261011-09). This plan uses that path. It does not reopen those decisions. d-20261011-15's per-pool thread-pool construction stays untouched.

## Approach

### Preserve admission

`BoundDatabase::acquire` still refuses a second distinct key for one inode, against published registrations and creation reservations, before any VFS or SQLite open. Identical keys, including Windows case variants, still share one registration. This plan does not add a retry inside `acquire`.

### Recognize only a preserved admission conflict

Repository establishment treats an error as a vanished-holder conflict only when it is `Error::Conflict` whose message is exactly `DATABASE_OPEN_THROUGH_ANOTHER_NAME` or `DATABASE_OPEN_THROUGH_ANOTHER_DIRECTORY`. `database changed after capability resolution`, a tombstone conflict, a construction timeout, cancellation, and every other error are unchanged and do not retire anything.

### One shared retirement attempt on both repository establishment sites

`entry_until` and `read_revision` are the only production callers of `acquire_bound`. Both use one private repository helper. The helper is not used from `scan_worker`, `snapshot_database`, or `linked_collections::legacy`.

Each call attempts this helper at most once, tracked by a local flag on that call. A second preserved admission conflict from the same call is returned as that conflict. The helper does not loop.

### Drop the predecessor admission before retirement

The new key's predecessor admission matches the old entry by object identity, and for a same-folder rename also by parent identity. The helper therefore runs only after that admission has been dropped.

In `entry_until` the `BuildGuard` for the new key stays held across the helper, so a second builder of the new key waits on `building` instead of retiring concurrently. The repository state mutex is not held across the checkpoint, `retire_replaced`, or `close_retired_entry_until`.

`entry_until` already holds a `RetirementCapacity` taken before `acquire_bound`. `close_retired_entry_until` takes another. Those two reservations must not be held together: with 15 other incomplete retirements the construction reservation is the 16th slot, and the helper then waits for a 17th until timeout. The same deadlock happens when 16 builders of renamed databases each keep one construction reservation and then each wait for another. `entry_until` drops its construction `RetirementCapacity` before the helper. `read_revision` does not hold one. After the helper retires at least one entry and the single retry `acquire_bound` succeeds, `entry_until` reserves capacity again through the existing `reserve_retirement_capacity` before the existing insert-time eviction. If that later reserve times out or is cancelled, that error is returned and the uninserted pool and binding are dropped. If the helper retires nothing, the original conflict is returned and no second reservation is taken.

If the helper returns an error, that error is the call result. The original conflict is not substituted. `BuildGuard` then clears `building` by its existing drop.

### Select idle cached holders of this inode

Under the repository state mutex, consider entries whose `EntryKey.identity` equals the target inode, whose path is not tombstoned, whose `Arc` strong count is 1, and whose `is_idle` is true. Skip the incoming key if it is already present. At most `MAX_OPEN_DATABASES` entries exist. One inode has one binding, so one match is the expected case; every match that passes the stale-name probe is retired before the single retry.

Do not remove the entry from the map before the existing `close_retired_entry_until` removal. Removing it early would let another `entry_until` for the old key build a second pool on the still-live registration.

### Decide staleness from the retained parent and leaf

While still holding the repository mutex, and before closing the lease gate, ask the entry's `BoundDatabase` whether its retained parent and leaf still name that binding's inode. The new method calls `probe_regular_file_at` and compares the returned identity with the binding's identity. It does not call `open`, `open_regular_at`, or `probe_current` on a pathname.

* Same identity: the leaf is a live name. Leave the entry cached and do not retire it.
* `Error::Io` whose kind is not-found, or `Error::InvalidInput` equal to the existing non-regular-file message: the retained name no longer names the inode. The entry is stale.
* A successful probe of a different identity: the retained name is now a different file. The entry is stale.
* `Error::Conflict` from the probe, and every other I/O error: return that error. Do not retire. Do not replace it with the admission conflict.

Re-check strong count 1 and `is_idle` under the same mutex hold after the probe. If either check fails, do not retire that entry.

### Close the lease gate before leaving the mutex, then drain

For a stale idle match, close its lease gate before releasing the repository mutex, so a concurrent `entry_until` of the old key observes the existing "database is being replaced or deleted" conflict instead of cloning the `Arc` and taking a lease. `DrainGate::close` is idempotent.

Then release the mutex. Committed frames may sit only in the vanished leaf's `-wal`. The new leaf does not open that name. Do not admit the new name while those frames exist only there, and do not open the database leaf to find them.

If the pool reports an idle connection, checkpoint before `retire_replaced` through that already held connection. The checkpoint is `PRAGMA wal_checkpoint(TRUNCATE)`. It uses the binding's already open descriptors. It does not call `open`, `open_regular_at`, or `probe_current` on the database leaf, and it does not create a pooled connection. Return that connection to the pool before `retire_replaced`, so its own connection ticket is not outstanding. Do not move sidecars after this checkpoint succeeds: the frames are in the main inode. If the checkout or the checkpoint fails, return that error. Do not retire, do not move sidecars, and do not admit the new name. Reopen the lease gate when the connection gate is still open, the same condition as `cancel_retirement`.

If the pool reports no connections, do not checkpoint and do not create a connection. Stat the retained parent's `<leaf>-wal` with `probe_regular_file_at`. A wal probe error other than not-found, including a non-regular file, returns that error. Do not retire and do not admit. Not found, or length 0: nothing of this database remains in a wal; retire as below without a move.

Length greater than 0 is not enough to move. Immediately before a move, probe the retained leaf again with `probe_regular_file_at`. Do not open it. Move only when that probe is not-found or the existing non-regular-file error: the sidecar name has no current database file, which is the association this helper accepts. A successful probe of a different identity means a replacement file owns the name and the wal's association is unproven. Do not move it. If the wal length is greater than 0, do not retire and do not admit; return the original admission conflict. If that wal is absent or length 0, retire without a move. The same refusal applies when the re-probe finds the cached identity again. A re-probe conflict or any other I/O error returns that error and does not retire.

A permitted move renames that wal onto the new leaf before `retire_replaced`. Also move `<leaf>-shm` when that probe finds a regular file. The destination names are the new leaf plus `-wal` and `-shm` in the new parent, for a same-directory rename or a cross-directory move. If either destination exists, return that error before moving either file. Move by rename only. Do not copy, and do not open the database leaf. If the wal rename succeeds and the shm rename fails, rename the wal back. If that restore fails, return that error and do not retire. This move is not used after a successful checkpoint, and it is not used when an idle connection was checkpointed through its already open descriptors. The single retry open is what applies a moved wal to the main inode. This helper does not delete the moved files.

A checkout, probe, or unproven-wal failure on this path does not retire and does not admit. Reopen the lease gate when the connection gate is still open. The unproven-wal failure returns the original admission conflict. A probe or checkout failure returns that error.

Then call the existing `retire_replaced` with the caller's cancellation token. That waits for leases, publishes the retirement, drops the pool outside the mutex, and waits for the connection and owner gates. On timeout or cancellation, `retire_replaced` already keeps an undrained gate and reopens the lease gate only when the connection gate is still open. Return that error. The retry `acquire_bound` runs only after `retire_replaced` returns success, so it does not run while that connection gate is still open.

After `retire_replaced` returns success, drop every `Arc<DatabaseEntry>` the helper holds for that entry before acquiring again. The entry's `bound` is what keeps the registration alive after the pool drop.

A probe that races a restore of the same inode between the stat and `publish_retirement` can drain an idle live alias. That alias can open again after the last binding release, which d-20261011-01 already allows. Do not drop the binding before the drain returns.

### Retry establishment once, behind a fresh admission

If the helper retired at least one entry, the caller takes a fresh predecessor admission and calls `acquire_bound` once more.

* `entry_until` passes the deadline it already uses for `predecessor_admission`. It does not extend that deadline. The fresh admission waits for any still-incomplete matching retirement (d-20261011-08, d-20261011-10, d-20261011-11) and then establishment continues with the same `BuildGuard`.
* `read_revision` calls `predecessor_admission_for` again, which uses its existing `now + retire_wait` window, then retries `acquire_bound` once and continues the existing read-only open. It still does not create a pool.

If the helper retires nothing, the caller returns the original conflict and does not take a second admission.

The bound is one drain wait plus one fresh admission window per call, then either success or the second conflict. It is not a loop.

### One identity resample after this call writes the main file

A vanished-holder checkpoint, or the retry open that recovers a wal this call moved, writes the main file inside the first `read_revision`. That read is after the schema sample, so the four samples disagree and `identity_from_probe` would reject this call's own write.

When this call did that write and the four samples disagree, `identity_from_probe` runs the four-sample loop once more. The second loop's four samples must agree with each other, and the revision is the committed revision. A further disagreement is still `database changed while reading its identity`. When this call did not write the main file, disagreement is that conflict and there is no second loop. The flag belongs to this identity read, not to the process. The `connection` path checkpoints inside `entry_until` before `database_identity`, so that later identity read does not take the second loop unless a write happens inside that read. An external change with no write by this call still conflicts.

### What stays refused

* A live hard link whose retained leaf still names the inode stays cached, and the new name stays in conflict.
* An entry with a live lease or any extra `Arc` stays cached. The conflicting open returns the admission conflict. A later open, after the lease and extra `Arc` are gone, is a new call and may retire once.
* A tombstoned path stays on the deletion path.
* Direct `BoundDatabase::acquire` callers do not retire. After this repository path has dropped the stale registration, a later direct acquire of the new name succeeds. An in-flight `scan_worker` that already holds its own `BoundDatabase` keeps the new name refused until that clone drops; the one repository retry then returns the conflict. Archiving a new name that this repository has never opened, while an idle cache still holds the inode, still conflicts. That is not the filed open path. `get_db_info_blocking` reaches the scan only after `get_db_or_create` succeeds, so the user open retires first.

### Failure and ownership

The repository remains the owner of pooled entries and retirement records. Retirement records stay bounded by `MAX_OPEN_DATABASES` through the existing capacity reservation. No new registry, reaper, or retry thread is added. Poisoned repository and registry locks keep their existing typed conflicts. No new `unwrap` or `expect` on a file, database, or renderer-driven path. The helper does not call `BLOCKING_GATEWAY`.

The renderer payload for both admission messages stays `database_admission`. No command, event, binding, or UI string changes.

## Decisions and trade-offs

### Decided autonomously

Question (from the finding's open question): on a same-inode admission conflict in the repository build path, retire an idle cached entry whose retained name no longer names that inode and retry once, re-probe every idle entry on any conflict, or leave the refusal until LRU or restart?

Chosen: retire only idle cached entries of that inode whose retained parent and leaf no longer name it, through `retire_replaced`, then retry the repository establishment once behind a fresh predecessor admission. Both preserved admission messages use this path. `BoundDatabase::acquire` is unchanged.

Rejected: re-probing every idle entry on any conflict regardless of inode; accepting restart-until-evicted; weakening `BoundDatabase::acquire`; opening the old leaf by pathname; dropping the pool without `retire_replaced`; retrying while the new key's predecessor admission is still held; unbounded retry; treating an empty pool as nothing to preserve.

The first P1 correction checkpointed only when a pooled connection already existed and called an empty pool a known limit. That correction is withdrawn. Invariant: do not admit the new name while committed frames exist only under the vanished leaf's `-wal`, and do not open the database leaf to find them. Previous answer: skip the checkpoint when the pool is empty. New evidence: the pool builder uses `min_idle(Some(0))` and leaves the idle timeout unset, and the bound stat of a vanished leaf fails, so a later close cannot copy frames into the main inode. Judgment: an idle connection still checkpoints with `wal_checkpoint(TRUNCATE)` and does not move sidecars; zero connections with a non-empty `<leaf>-wal` move that wal, and `<leaf>-shm` when it is a regular file, onto the new leaf before retirement only when a fresh `probe_regular_file_at` of the retained leaf is not-found or non-regular; a zero-length or absent wal retires without a move; a different identity at the retained leaf with a non-empty wal refuses without a move and without retirement; any other empty-pool probe error refuses. Rejected for this judgment: leaving the empty pool as a known limit; opening a new pooled connection on the vanished leaf; deleting the wal; copying sidecars; moving sidecars after a successful `TRUNCATE`; moving a wal whose retained leaf now names another inode.

Reason: the refusal is correct while the idle pool holds the inode, and f-20260930-01 requires the drain before the binding is released. The predecessor-admission deadlock is avoided by dropping that admission first. Live hard links stay refused, which is the accepted risk in the f-20260929-05 review. Record this with `record-decision` at adoption. Reversal path: stop calling the helper from `entry_until` and `read_revision`, leaving admission and LRU as they are on this base.

Governing decisions that stay closed: d-20261011-01, d-20261011-02, d-20261011-07, d-20261011-08, d-20261011-09, d-20261011-10, d-20261011-11, d-20261011-13, d-20261011-15, d-20260929-04, d-20260930-10.

## Risks / open questions

* Windows may refuse to rename a file that still has the pool's handles. The production helper is not `cfg`-gated. The regression that renames or moves an open database is `#[cfg(unix)]` when Windows cannot perform that rename. Windows and macOS CI remain the runtime authority for the shared code (d-20261011-02). Do not add a Windows-only retirement policy.
* The restore race between the stale stat and `publish_retirement` can drain an idle alias that was restored as the same inode. The other name opens after the drain. That is accepted.
* If the new leaf's `-wal` or `-shm` already exists, this helper refuses and leaves the idle entry cached. It does not overwrite those files.
* A non-empty wal beside a retained leaf that now names another inode stays in place, and the new name stays refused. This helper does not open either database to decide wal ownership.
* After a successful `TRUNCATE`, the vanished leaf's `-wal` and `-shm` can remain beside the old name. The new name does not read them. They are leftover, not a second copy of the committed rows.
* A direct acquire that bypasses the repository can still observe the conflict until the repository entry is gone. Stated under "What stays refused".
* `read_revision`'s retry uses a second `predecessor_admission_for` window. `entry_until` does not extend its original deadline. Both are one-shot.

## Not part of this task

* Changing `BoundDatabase::acquire`, binding-key identity, or the two conflict strings.
* UI presentation of the conflict (f-20261009-03), generated bindings, and renderer state.
* `scan_worker`, `snapshot_database`, and `linked_collections::legacy`, except that they must keep compiling against an unchanged `BoundDatabase::acquire`.
* PGN boundaries, the byte-offset index, move encoding, and `CastlingMode`.
* Cross-process lock coordination, crash recovery, and other queued database findings.
* d-20261011-15's thread-pool builder.
* Co-located findings. This cluster is the singleton `f-20261011-01`.

## Phases

### Phase 1 — Idle vanished-holder retirement

Role: `sensitive`. One write leaf. Files: `src-tauri/src/db/repository.rs`, `src-tauri/src/db/bound_sqlite.rs`. Read-only context: `src-tauri/src/db/mod.rs`, `src-tauri/src/db/content_validation.rs`, `src-tauri/src/db/linked_collections.rs`, `src-tauri/src/db/linked_collections/legacy.rs`, `src-tauri/src/error.rs`, `src-tauri/src/infra/fs.rs`.

Implement every Approach heading. Add repository regressions:

* Same-folder external rename, old entry idle, no lease held: `connection` on the new name succeeds, the old key is gone, and the old leaf is not still cached. This assertion is the base failure: on this base the new name returns the admission conflict. Do not weaken it to accept that conflict.
* That same regression commits a row through the cached pool, returns the connection to the pool without checkpointing, renames only the main file, and reads the committed row back from the new name. `database_identity` on that new name then returns the committed revision. A write performed after the reopen is not this proof. After the open returns, the row is still readable if the vanished leaf's `-wal` is removed, because the checkpoint wrote the frames into the main inode. This path leaves an idle pooled connection in place so the checkpoint runs. It does not move sidecars.
* Empty pool, same commit and rename, and no file left at the old path: the test closes idle pooled connections before opening the new name, and it does not sleep. `connection` reads the committed row, and `database_identity` returns the committed revision. The vanished leaf's `-wal` is not the source of that read. Closing those connections is the regression's stand-in for the pool reaching zero connections. It does not change the production reaper. A helper that admits the new name without checkpointing and without moving the non-empty wal fails this read.
* Replacement sidecar: after that same rename, put a different regular file at the old path and a non-empty `-wal` there with distinctive bytes, then close idle pooled connections and open the new name. The open returns the admission conflict. The cached entry remains. Those wal bytes stay at the old sidecar, and the new name does not gain them. A helper that renames the replacement wal onto the new leaf fails this assertion.
* The new name's retry `acquire_bound` is not reached until `retire_replaced` has returned. The new-name open runs on another thread. The regression blocks in the existing `RetirementPublished` hook while holding one extra connection ticket. It then releases that hook and keeps the ticket. It waits until the connection gate is observed waiting, or until a retry acquire happens. The acquire count for the new name must still be the one pre-retirement attempt, and the gate must be the thing that is waiting. It then drops the ticket. The open succeeds, the retry acquire has run once, and the gate is closed with outstanding 0. Releasing the hook and the ticket together is not this proof. A path that skips the connection-gate wait fails the middle assertion.
* `database_identity` on the new name, with no prior `connection` on that name and with committed frames still only in the wal, retires the same idle holder and returns the committed revision. That success is the base failure: on this base the new name returns the admission conflict. A checkpoint or wal recovery inside the first `read_revision` must not surface as `database changed while reading its identity`. The four samples of the one allowed resample agree. A metadata change when this call did not write the main file still returns that conflict.
* A live same-parent hard link stays in conflict and the cached entry remains. A live cross-directory hard link stays in conflict.
* A cross-directory move of an idle cached file admits the new path once.
* An outstanding lease blocks retirement: the new name conflicts, the old entry remains, and a later open after the lease drops succeeds.
* One-shot bound after a retirement that still conflicts: a `cfg(test)` counter of helper invocations, plus a test hook that holds a separate `BoundDatabase` on a still-present hard link of the same inode across the retry. The helper runs once, the retry returns the admission conflict, and the counter stays 1. Removing the local flag makes the helper run again and fails the counter. The live-link refusal, which retires nothing, stays a separate case and still leaves the cached entry in place.
* Capacity: with 15 incomplete retirements already occupying slots, `entry_until` on the renamed idle database still drains it and admits the new name. Use `with_retire_wait` so a regression that keeps both reservations fails on the capacity timeout instead of the production wait. Follow the existing retirement-capacity fixtures.
* `replacement_at_the_same_path_never_reuses_an_old_pooled_connection` stays as written, including its `close_and_invalidate` before the rename.
* Existing `hard_link_alias_is_refused_until_cached_entry_and_owners_are_released`, `wal_writer_survives_alias_refusal`, and `revision_read_refuses_same_parent_alias` stay green.

The new rename, move, and lease tests are `#[cfg(unix)]` if the platform cannot rename an open database. The helper they drive is not `cfg`-gated.

PROOF COMMAND, one filter per invocation. Each filter is a unique substring of one test name. libtest matches a substring, not a shell pipeline and not a regex union:

```bash
cargo test --manifest-path src-tauri/Cargo.toml --locked --lib -- vanished_renamed_idle_cache_opens_under_the_new_name
cargo test --manifest-path src-tauri/Cargo.toml --locked --lib -- vanished_renamed_idle_cache_keeps_committed_row
cargo test --manifest-path src-tauri/Cargo.toml --locked --lib -- vanished_renamed_idle_cache_keeps_row_after_idle_close
cargo test --manifest-path src-tauri/Cargo.toml --locked --lib -- vanished_rename_refuses_unproven_replacement_wal
cargo test --manifest-path src-tauri/Cargo.toml --locked --lib -- vanished_renamed_idle_cache_waits_for_drain
cargo test --manifest-path src-tauri/Cargo.toml --locked --lib -- revision_read_retires_vanished_idle_cache
cargo test --manifest-path src-tauri/Cargo.toml --locked --lib -- vanished_rename_retry_conflict_runs_helper_once
cargo test --manifest-path src-tauri/Cargo.toml --locked --lib -- vanished_rename_admits_with_fifteen_incomplete_retirements
cargo test --manifest-path src-tauri/Cargo.toml --locked --lib -- hard_link_alias_is_refused_until_cached_entry_and_owners_are_released
cargo test --manifest-path src-tauri/Cargo.toml --locked --lib -- wal_writer_survives_alias_refusal
cargo test --manifest-path src-tauri/Cargo.toml --locked --lib -- revision_read_refuses_same_parent_alias
cargo test --manifest-path src-tauri/Cargo.toml --locked --lib -- replacement_at_the_same_path_never_reuses_an_old_pooled_connection
```

The leaf names the new tests so each filter matches that test. Adopter, not this plan session: `pnpm checks:pre-review` before diff review, and `pnpm gates:push -- --rust` at release.

Rules for the write leaf, read in full, no further discovery: `.claude/rules/async-resource-invariants.md`, `.claude/rules/pgn-scanning.md`. PGN scanning applies only as a negative: do not change game boundaries, the byte-offset index, move encoding, search predicates, or `CastlingMode`.

### plan-r5.md

# Plan: Retire a vanished idle database cache on a same-inode admission conflict

## Goal

When a database file is renamed or moved outside ChessFable while its old name's repository entry is idle, opening the new name retires that idle entry through the existing drain-then-release path and admits the new name once. A live hard link, a busy lease, and `BoundDatabase::acquire` stay refused exactly as they are today.

## MANDATE

f-20261011-01, verbatim:

* **ID:** f-20261011-01 · **Status:** open · **Area:** db-search · **Root:** - · **Entry:** build · **Blocked:** none
* **Filed from:** d7fc28c0-e3c5-4fb5-b34f-fee1b64dec2f
* **Where:** `src-tauri/src/db/bound_sqlite.rs` (`BoundDatabase::acquire`, same-inode admission added for f-20260929-05: `"database is open through another name"`); `src-tauri/src/db/repository.rs` (`evict_idle_entries`, `:1092`, evicts only while `state.entries.len() > MAX_OPEN_DATABASES`; a cached `DatabaseEntry` owns its binding); the adapted test `replacement_at_the_same_path_never_reuses_an_old_pooled_connection` has to `close_and_invalidate` the setup name before reopening the renamed inode.
* **Defect:** after f-20260929-05, a database file renamed in the same folder outside ChessFable (file manager, sync client) while its old name's repository entry is cached gets `Conflict("database is open through another name")` on every open under the new name. The old entry is never accessed again (its path is gone), so the stale probe never retires it, and LRU eviction only fires above `MAX_OPEN_DATABASES`; the refusal therefore lasts until enough other databases are opened or the app restarts. The refusal itself is correct while the idle pool holds open SQLite connections on the inode (they share its `-shm`), so the defect is the retention, not the admission.
* **Why it matters:** a user who renames a database outside the app sees it fail to open with a generic database error (presentation: f-20261009-03) until restarting ChessFable.
* **Open question:** should a same-inode admission conflict in the repository's build path retire an idle cached entry whose own path no longer resolves to that inode (draining its pool through the existing retire/close path) and retry once, or should the repository re-probe idle entries' paths on a conflict, or is restart-until-evicted acceptable? Interacts with f-20260930-01 (eviction drops entries without draining connections) — any retirement must drain before the binding is released.
* **Related:** f-20260929-05 (introduced the admission; plan risk "Cached entries keep aliases refused" accepted this for live hard links, not for a vanished old name), f-20260930-01, f-20261009-03. Review record: `tasks/handoffs/2026-10-09-sqlite-hard-link-admission-review.md`.
* **Found by:** orchestrator diff review of the f-20260929-05 phase-1 write leaf (Claude Code, drain session d7fc28c0-e3c5-4fb5-b34f-fee1b64dec2f), 2026-10-11, from the fixture adaptation the leaf reported.

## Threat model and non-goals

The adversary is ordinary local filesystem activity while this process holds an idle pooled binding: a same-directory rename, a move to another directory, a second hard link that is still present, or a rename that races a live lease. The process is the only ChessFable instance for this app-data directory. Cross-process coordination, crash recovery, and a user who keeps the old name as a live hard link are outside the repair.

A vanished name must not be able to pin the inode until sixteen other databases evict it or the process restarts. A live second name must not be able to force that retirement. Retirement must not drop SQLite connections before they drain, and it must not close a lockable descriptor of the database inode on Unix.

## Traced premises

Confirmed on `6b600397549d5bd324205f0db8592dbe9b450ff6`. Obligations below do not cite lines.

* `BoundDatabase::acquire` refuses a second binding key for an inode that already has a published registration or a creation reservation. Different parent identity returns `DATABASE_OPEN_THROUGH_ANOTHER_DIRECTORY`; same parent and different leaf returns `DATABASE_OPEN_THROUGH_ANOTHER_NAME`. Identical keys reuse one registration. This door stays unchanged (d-20261011-01).
* The user open is `get_db_info_blocking` → `get_db_or_create` → `DatabaseRepository::connection` → `entry_until`. `entry_until` takes `predecessor_admission` for the new key, then `acquire_bound`. On the admission conflict it returns. Nothing in that path looks for a different cached key that holds the inode.
* `database_identity` hydrates through `read_revision`. `get_db_info_blocking` calls that only after `get_db_or_create` has returned a connection for the same target. `read_revision` itself also takes `predecessor_admission_for` and then `acquire_bound`, and it does not go through `entry_until`. A revision read of a new name while the old idle entry still holds the inode conflicts on its own.
* `identity_from_probe`, when hydrating, calls `probe_schema_and_revision` four times and returns `database changed while reading its identity` if the schema samples or the revisions disagree. `probe_schema_and_revision` captures schema metadata before `read_revision`.
* `classify_bound_failure` / `classify_bound_open_error_result` rewrites the Unix error to `database changed after capability resolution` when the new target's `probe_current` fails. When that probe succeeds, the original conflict is preserved. Windows `acquire_bound` returns `BoundDatabase::acquire`'s error unchanged. Only the two preserved admission messages are a vanished-holder signal.
* Idle means `DatabaseEntry::is_idle`: lease gate outstanding is 0 and the gate is not closed. `eviction_candidate` also requires `Arc::strong_count(entry) == 1`, so the map is the only owner. An `EntryLease` holds an `Arc<DatabaseEntry>`. LRU eviction runs only when `entries.len()` is already at `MAX_OPEN_DATABASES` (16) during insertion. The finding's `evict_idle_entries` name is stale; the capacity check inside `entry_until` is the current LRU.
* The pool builder sets `min_idle(Some(0))` and does not set an idle timeout. An idle repository entry can therefore hold a pool with zero connections. `ConnectionOptions::on_acquire` sets `PRAGMA journal_mode = WAL`. SQLite names the sidecars by appending `-wal` and `-shm` to the leaf. The bound stat hook `fstatat`s that leaf; a vanished leaf fails the stat, so a new open through that binding cannot checkpoint.
* `EntryKey::matches_predecessor` is same object identity OR same parent identity (d-20261011-10). `retirement_reserved` treats a live admission whose key matches the retiring key as a reservation. `wait_retirement_change` polls on `build_changed` until the deadline. Holding the new name's predecessor admission across `close_retired_entry_until` therefore waits on that same admission until `retire_wait`. Same-folder rename matches on both identity and parent. A cross-directory move of the same inode still matches on object identity.
* `retire_replaced` closes the lease gate, waits for leases, then `close_retired_entry_until` publishes the retirement, drops the pool outside the repository mutex, and waits for the connection and owner gates. On timeout or cancellation it does not forget an undrained gate (d-20261011-09); `cancel_retirement` reopens the lease gate only when the connection gate is not closed. `DatabaseEntry` drops `bound` after the pool field. The binding stays alive until the last `DatabaseEntry` / `BoundDatabase` clone drops, which is after the pool drop inside `close_retired_entry_until` only if the caller also drops its `Arc`.
* `BuildGuard` clears `building` for the new key on drop. `entry_until` returns `database is being replaced or deleted` when the cached entry's lease gate is already closed.
* `Binding` keeps the retained parent `File` and leaf `OsString`. `BoundDatabase` does not expose them. `probe_regular_file_at` stats with `AT_SYMLINK_NOFOLLOW` on Unix and does not open the leaf (d-20260929-04, d-20260930-10, f-20260929-11). On Windows the same function opens and closes a read handle; byte-range locks are handle-scoped (d-20260930-10). Absence is `Error::Io`. A non-regular file is `Error::InvalidInput` (`target must be a regular file`). A stat identity change across the probe is `Error::Conflict` (`workspace entry changed concurrently`).
* `scan_worker`, `snapshot_database`, and `linked_collections::legacy` call `BoundDatabase::acquire` directly. `scan_worker` already holds `predecessor_admission_for` across establishment and drops it before `validate_content` (d-20261011-13). `get_db_info_blocking` schedules that scan only after the connection exists.
* `replacement_at_the_same_path_never_reuses_an_old_pooled_connection` still `close_and_invalidate`s the setup name before renaming the inode onto the original path. Live same-parent refusal is `hard_link_alias_is_refused_until_cached_entry_and_owners_are_released`, `wal_writer_survives_alias_refusal`, and `revision_read_refuses_same_parent_alias`.
* f-20260930-01's drain gap is already closed by `retire_replaced` / `publish_retirement` (d-20261011-07, d-20261011-09). This plan uses that path. It does not reopen those decisions. d-20261011-15's per-pool thread-pool construction stays untouched.

## Approach

### Preserve admission

`BoundDatabase::acquire` still refuses a second distinct key for one inode, against published registrations and creation reservations, before any VFS or SQLite open. Identical keys, including Windows case variants, still share one registration. This plan does not add a retry inside `acquire`.

### Recognize only a preserved admission conflict

Repository establishment treats an error as a vanished-holder conflict only when it is `Error::Conflict` whose message is exactly `DATABASE_OPEN_THROUGH_ANOTHER_NAME` or `DATABASE_OPEN_THROUGH_ANOTHER_DIRECTORY`. `database changed after capability resolution`, a tombstone conflict, a construction timeout, cancellation, and every other error are unchanged and do not retire anything.

### One shared retirement attempt on both repository establishment sites

`entry_until` and `read_revision` are the only production callers of `acquire_bound`. Both use one private repository helper. The helper is not used from `scan_worker`, `snapshot_database`, or `linked_collections::legacy`.

Each call attempts this helper at most once, tracked by a local flag on that call. A second preserved admission conflict from the same call is returned as that conflict. The helper does not loop.

### Drop the predecessor admission before retirement

The new key's predecessor admission matches the old entry by object identity, and for a same-folder rename also by parent identity. The helper therefore runs only after that admission has been dropped.

In `entry_until` the `BuildGuard` for the new key stays held across the helper, so a second builder of the new key waits on `building` instead of retiring concurrently. The repository state mutex is not held across the checkpoint, `retire_replaced`, or `close_retired_entry_until`.

`entry_until` already holds a `RetirementCapacity` taken before `acquire_bound`. `close_retired_entry_until` takes another. Those two reservations must not be held together: with 15 other incomplete retirements the construction reservation is the 16th slot, and the helper then waits for a 17th until timeout. The same deadlock happens when 16 builders of renamed databases each keep one construction reservation and then each wait for another. `entry_until` drops its construction `RetirementCapacity` before the helper. `read_revision` does not hold one. After the helper retires at least one entry and the single retry `acquire_bound` succeeds, `entry_until` reserves capacity again through the existing `reserve_retirement_capacity` before the existing insert-time eviction. If that later reserve times out or is cancelled, that error is returned and the uninserted pool and binding are dropped. If the helper retires nothing, the original conflict is returned and no second reservation is taken.

If the helper returns an error, that error is the call result. The original conflict is not substituted. `BuildGuard` then clears `building` by its existing drop.

### Select idle cached holders of this inode

Under the repository state mutex, consider entries whose `EntryKey.identity` equals the target inode, whose path is not tombstoned, whose `Arc` strong count is 1, and whose `is_idle` is true. Skip the incoming key if it is already present. At most `MAX_OPEN_DATABASES` entries exist. One inode has one binding, so one match is the expected case; every match that passes the stale-name probe is retired before the single retry.

Do not remove the entry from the map before the existing `close_retired_entry_until` removal. Removing it early would let another `entry_until` for the old key build a second pool on the still-live registration.

### Decide staleness from the retained parent and leaf

While still holding the repository mutex, and before closing the lease gate, ask the entry's `BoundDatabase` whether its retained parent and leaf still name that binding's inode. The new method calls `probe_regular_file_at` and compares the returned identity with the binding's identity. It does not call `open`, `open_regular_at`, or `probe_current` on a pathname.

* Same identity: the leaf is a live name. Leave the entry cached and do not retire it.
* `Error::Io` whose kind is not-found, or `Error::InvalidInput` equal to the existing non-regular-file message: the retained name no longer names the inode. The entry is stale.
* A successful probe of a different identity: the retained name is now a different file. The entry is stale.
* `Error::Conflict` from the probe, and every other I/O error: return that error. Do not retire. Do not replace it with the admission conflict.

Re-check strong count 1 and `is_idle` under the same mutex hold after the probe. If either check fails, do not retire that entry.

### Close the lease gate before leaving the mutex, then drain

For a stale idle match, close its lease gate before releasing the repository mutex, so a concurrent `entry_until` of the old key observes the existing "database is being replaced or deleted" conflict instead of cloning the `Arc` and taking a lease. `DrainGate::close` is idempotent.

Then release the mutex. Committed frames may sit only in the vanished leaf's `-wal`. The new leaf does not open that name. Do not admit the new name while those frames exist only there, and do not open the database leaf to find them.

If the pool reports an idle connection, checkpoint before `retire_replaced` through that already held connection. The checkpoint is `PRAGMA wal_checkpoint(TRUNCATE)`. It uses the binding's already open descriptors. It does not call `open`, `open_regular_at`, or `probe_current` on the database leaf, and it does not create a pooled connection. Return that connection to the pool before `retire_replaced`, so its own connection ticket is not outstanding. Do not move sidecars after this checkpoint succeeds: the frames are in the main inode. If the checkout or the checkpoint fails, return that error. Do not retire, do not move sidecars, and do not admit the new name. Reopen the lease gate when the connection gate is still open, the same condition as `cancel_retirement`.

If the pool reports no connections, do not checkpoint and do not create a connection. Stat the retained parent's `<leaf>-wal` with `probe_regular_file_at`. A wal probe error other than not-found, including a non-regular file, returns that error. Do not retire and do not admit. Not found, or length 0: nothing of this database remains in a wal; retire as below without a move.

Length greater than 0 is not enough to move. Immediately before a move, probe the retained leaf again with `probe_regular_file_at`. Do not open it. A `cfg(test)` hook runs after the stale selection and before this fresh probe, so a test can install a replacement in that window. The production path does not wait on it. Move only when that probe is not-found or the existing non-regular-file error: the sidecar name has no current database file, which is the association this helper accepts. A successful probe of a different identity means a replacement file owns the name and the wal's association is unproven. Do not move it. If the wal length is greater than 0, do not retire and do not admit; return the original admission conflict. If that wal is absent or length 0, retire without a move. The same refusal applies when the re-probe finds the cached identity again. A re-probe conflict or any other I/O error returns that error and does not retire.

A permitted move renames that wal onto the new leaf before `retire_replaced`. Also move `<leaf>-shm` when that probe finds a regular file. The destination names are the new leaf plus `-wal` and `-shm` in the new parent, for a same-directory rename or a cross-directory move. If either destination exists, return that error before moving either file. Move by rename only. Do not copy, and do not open the database leaf. If the wal rename succeeds and the shm rename fails, rename the wal back. If that restore fails, return that error and do not retire. This move is not used after a successful checkpoint, and it is not used when an idle connection was checkpointed through its already open descriptors. The single retry open is what applies a moved wal to the main inode. This helper does not delete the moved files.

A checkout, probe, or unproven-wal failure on this path does not retire and does not admit. Reopen the lease gate when the connection gate is still open. The unproven-wal failure returns the original admission conflict. A probe or checkout failure returns that error.

Then call the existing `retire_replaced` with the caller's cancellation token. That waits for leases, publishes the retirement, drops the pool outside the mutex, and waits for the connection and owner gates. On timeout or cancellation, `retire_replaced` already keeps an undrained gate and reopens the lease gate only when the connection gate is still open. Return that error. The retry `acquire_bound` runs only after `retire_replaced` returns success, so it does not run while that connection gate is still open.

After `retire_replaced` returns success, drop every `Arc<DatabaseEntry>` the helper holds for that entry before acquiring again. The entry's `bound` is what keeps the registration alive after the pool drop.

A probe that races a restore of the same inode between the stat and `publish_retirement` can drain an idle live alias. That alias can open again after the last binding release, which d-20261011-01 already allows. Do not drop the binding before the drain returns.

### Retry establishment once, behind a fresh admission

If the helper retired at least one entry, the caller takes a fresh predecessor admission and calls `acquire_bound` once more.

* `entry_until` passes the deadline it already uses for `predecessor_admission`. It does not extend that deadline. The fresh admission waits for any still-incomplete matching retirement (d-20261011-08, d-20261011-10, d-20261011-11) and then establishment continues with the same `BuildGuard`.
* `read_revision` calls `predecessor_admission_for` again, which uses its existing `now + retire_wait` window, then retries `acquire_bound` once and continues the existing read-only open. It still does not create a pool.

If the helper retires nothing, the caller returns the original conflict and does not take a second admission.

The bound is one drain wait plus one fresh admission window per call, then either success or the second conflict. It is not a loop.

### One identity resample after this call writes the main file

A vanished-holder checkpoint, or the retry open that recovers a wal this call moved, writes the main file inside the first `read_revision`. That read is after the schema sample, so the four samples disagree and `identity_from_probe` would reject this call's own write.

When this call did that write and the four samples disagree, `identity_from_probe` runs the four-sample loop once more. The second loop's four samples must agree with each other, and the revision is the committed revision. A further disagreement is still `database changed while reading its identity`. When this call did not write the main file, disagreement is that conflict and there is no second loop. The flag belongs to this identity read, not to the process. The `connection` path checkpoints inside `entry_until` before `database_identity`, so that later identity read does not take the second loop unless a write happens inside that read. An external change with no write by this call still conflicts.

### What stays refused

* A live hard link whose retained leaf still names the inode stays cached, and the new name stays in conflict.
* An entry with a live lease or any extra `Arc` stays cached. The conflicting open returns the admission conflict. A later open, after the lease and extra `Arc` are gone, is a new call and may retire once.
* A tombstoned path stays on the deletion path.
* Direct `BoundDatabase::acquire` callers do not retire. After this repository path has dropped the stale registration, a later direct acquire of the new name succeeds. An in-flight `scan_worker` that already holds its own `BoundDatabase` keeps the new name refused until that clone drops; the one repository retry then returns the conflict. Archiving a new name that this repository has never opened, while an idle cache still holds the inode, still conflicts. That is not the filed open path. `get_db_info_blocking` reaches the scan only after `get_db_or_create` succeeds, so the user open retires first.

### Failure and ownership

The repository remains the owner of pooled entries and retirement records. Retirement records stay bounded by `MAX_OPEN_DATABASES` through the existing capacity reservation. No new registry, reaper, or retry thread is added. Poisoned repository and registry locks keep their existing typed conflicts. No new `unwrap` or `expect` on a file, database, or renderer-driven path. The helper does not call `BLOCKING_GATEWAY`.

The renderer payload for both admission messages stays `database_admission`. No command, event, binding, or UI string changes.

## Decisions and trade-offs

### Decided autonomously

Question (from the finding's open question): on a same-inode admission conflict in the repository build path, retire an idle cached entry whose retained name no longer names that inode and retry once, re-probe every idle entry on any conflict, or leave the refusal until LRU or restart?

Chosen: retire only idle cached entries of that inode whose retained parent and leaf no longer name it, through `retire_replaced`, then retry the repository establishment once behind a fresh predecessor admission. Both preserved admission messages use this path. `BoundDatabase::acquire` is unchanged.

Rejected: re-probing every idle entry on any conflict regardless of inode; accepting restart-until-evicted; weakening `BoundDatabase::acquire`; opening the old leaf by pathname; dropping the pool without `retire_replaced`; retrying while the new key's predecessor admission is still held; unbounded retry; treating an empty pool as nothing to preserve.

The first P1 correction checkpointed only when a pooled connection already existed and called an empty pool a known limit. That correction is withdrawn. Invariant: do not admit the new name while committed frames exist only under the vanished leaf's `-wal`, and do not open the database leaf to find them. Previous answer: skip the checkpoint when the pool is empty. New evidence: the pool builder uses `min_idle(Some(0))` and leaves the idle timeout unset, and the bound stat of a vanished leaf fails, so a later close cannot copy frames into the main inode. Judgment: an idle connection still checkpoints with `wal_checkpoint(TRUNCATE)` and does not move sidecars; zero connections with a non-empty `<leaf>-wal` move that wal, and `<leaf>-shm` when it is a regular file, onto the new leaf before retirement only when a fresh `probe_regular_file_at` of the retained leaf is not-found or non-regular; a zero-length or absent wal retires without a move; a different identity at the retained leaf with a non-empty wal refuses without a move and without retirement; any other empty-pool probe error refuses. Rejected for this judgment: leaving the empty pool as a known limit; opening a new pooled connection on the vanished leaf; deleting the wal; copying sidecars; moving sidecars after a successful `TRUNCATE`; moving a wal whose retained leaf now names another inode.

Reason: the refusal is correct while the idle pool holds the inode, and f-20260930-01 requires the drain before the binding is released. The predecessor-admission deadlock is avoided by dropping that admission first. Live hard links stay refused, which is the accepted risk in the f-20260929-05 review. Record this with `record-decision` at adoption. Reversal path: stop calling the helper from `entry_until` and `read_revision`, leaving admission and LRU as they are on this base.

Governing decisions that stay closed: d-20261011-01, d-20261011-02, d-20261011-07, d-20261011-08, d-20261011-09, d-20261011-10, d-20261011-11, d-20261011-13, d-20261011-15, d-20260929-04, d-20260930-10.

## Risks / open questions

* Windows may refuse to rename a file that still has the pool's handles. The production helper is not `cfg`-gated. The regression that renames or moves an open database is `#[cfg(unix)]` when Windows cannot perform that rename. Windows and macOS CI remain the runtime authority for the shared code (d-20261011-02). Do not add a Windows-only retirement policy.
* The restore race between the stale stat and `publish_retirement` can drain an idle alias that was restored as the same inode. The other name opens after the drain. That is accepted.
* If the new leaf's `-wal` or `-shm` already exists, this helper refuses and leaves the idle entry cached. It does not overwrite those files.
* A non-empty wal beside a retained leaf that now names another inode stays in place, and the new name stays refused. This helper does not open either database to decide wal ownership.
* After a successful `TRUNCATE`, the vanished leaf's `-wal` and `-shm` can remain beside the old name. The new name does not read them. They are leftover, not a second copy of the committed rows.
* A direct acquire that bypasses the repository can still observe the conflict until the repository entry is gone. Stated under "What stays refused".
* `read_revision`'s retry uses a second `predecessor_admission_for` window. `entry_until` does not extend its original deadline. Both are one-shot.

## Not part of this task

* Changing `BoundDatabase::acquire`, binding-key identity, or the two conflict strings.
* UI presentation of the conflict (f-20261009-03), generated bindings, and renderer state.
* `scan_worker`, `snapshot_database`, and `linked_collections::legacy`, except that they must keep compiling against an unchanged `BoundDatabase::acquire`.
* PGN boundaries, the byte-offset index, move encoding, and `CastlingMode`.
* Cross-process lock coordination, crash recovery, and other queued database findings.
* d-20261011-15's thread-pool builder.
* Co-located findings. This cluster is the singleton `f-20261011-01`.

## Phases

### Phase 1 — Idle vanished-holder retirement

Role: `sensitive`. One write leaf. Files: `src-tauri/src/db/repository.rs`, `src-tauri/src/db/bound_sqlite.rs`. Read-only context: `src-tauri/src/db/mod.rs`, `src-tauri/src/db/content_validation.rs`, `src-tauri/src/db/linked_collections.rs`, `src-tauri/src/db/linked_collections/legacy.rs`, `src-tauri/src/error.rs`, `src-tauri/src/infra/fs.rs`.

Implement every Approach heading. Add repository regressions:

* Same-folder external rename, old entry idle, no lease held: `connection` on the new name succeeds, the old key is gone, and the old leaf is not still cached. This assertion is the base failure: on this base the new name returns the admission conflict. Do not weaken it to accept that conflict.
* That same regression commits a row through the cached pool, returns the connection to the pool without checkpointing, renames only the main file, and reads the committed row back from the new name. `database_identity` on that new name then returns the committed revision. A write performed after the reopen is not this proof. After the open returns, the row is still readable if the vanished leaf's `-wal` is removed, because the checkpoint wrote the frames into the main inode. This path leaves an idle pooled connection in place so the checkpoint runs. It does not move sidecars.
* Empty pool, same commit and rename, and no file left at the old path: the test closes idle pooled connections before opening the new name, and it does not sleep. `connection` reads the committed row, and `database_identity` returns the committed revision. The vanished leaf's `-wal` is not the source of that read. Closing those connections is the regression's stand-in for the pool reaching zero connections. It does not change the production reaper. A helper that admits the new name without checkpointing and without moving the non-empty wal fails this read.
* Replacement sidecar: after that same rename, put a different regular file at the old path and a non-empty `-wal` there with distinctive bytes, then close idle pooled connections and open the new name. The open returns the admission conflict. The cached entry remains. Those wal bytes stay at the old sidecar, and the new name does not gain them. A helper that renames the replacement wal onto the new leaf fails this assertion.
* Fresh probe: the old path is absent through stale selection. The `cfg(test)` hook then places a different regular file at the old path and a non-empty `-wal` with distinctive bytes, before the fresh retained-leaf probe. Idle pooled connections are already closed. The open returns the admission conflict, the cached entry remains, and those bytes stay at the old sidecar. Deciding the move from the selection-time probe alone passes the pre-installed replacement test and fails this one.
* The new name's retry `acquire_bound` is not reached until `retire_replaced` has returned. The new-name open runs on another thread. The regression blocks in the existing `RetirementPublished` hook while holding one extra connection ticket. It then releases that hook and keeps the ticket. It waits until the connection gate is observed waiting, or until a retry acquire happens. The acquire count for the new name must still be the one pre-retirement attempt, and the gate must be the thing that is waiting. It then drops the ticket. The open succeeds, the retry acquire has run once, and the gate is closed with outstanding 0. Releasing the hook and the ticket together is not this proof. A path that skips the connection-gate wait fails the middle assertion.
* `database_identity` on the new name, with no prior `connection` on that name and with committed frames still only in the wal, retires the same idle holder and returns the committed revision. That success is the base failure: on this base the new name returns the admission conflict. A checkpoint or wal recovery inside the first `read_revision` must not surface as `database changed while reading its identity`. The four samples of the one allowed resample agree. A metadata change when this call did not write the main file still returns that conflict.
* A live same-parent hard link stays in conflict and the cached entry remains. A live cross-directory hard link stays in conflict.
* A cross-directory move of an idle cached file admits the new path once.
* An outstanding lease blocks retirement: the new name conflicts, the old entry remains, and a later open after the lease drops succeeds.
* One-shot bound after a retirement that still conflicts: a `cfg(test)` counter of helper invocations, plus a test hook that holds a separate `BoundDatabase` on a still-present hard link of the same inode across the retry. The helper runs once, the retry returns the admission conflict, and the counter stays 1. Removing the local flag makes the helper run again and fails the counter. The live-link refusal, which retires nothing, stays a separate case and still leaves the cached entry in place.
* Capacity: with 15 incomplete retirements already occupying slots, `entry_until` on the renamed idle database still drains it and admits the new name. Use `with_retire_wait` so a regression that keeps both reservations fails on the capacity timeout instead of the production wait. Follow the existing retirement-capacity fixtures.
* `replacement_at_the_same_path_never_reuses_an_old_pooled_connection` stays as written, including its `close_and_invalidate` before the rename.
* Existing `hard_link_alias_is_refused_until_cached_entry_and_owners_are_released`, `wal_writer_survives_alias_refusal`, and `revision_read_refuses_same_parent_alias` stay green.

The new rename, move, and lease tests are `#[cfg(unix)]` if the platform cannot rename an open database. The helper they drive is not `cfg`-gated.

PROOF COMMAND, one filter per invocation. Each filter is a unique substring of one test name. libtest matches a substring, not a shell pipeline and not a regex union:

```bash
cargo test --manifest-path src-tauri/Cargo.toml --locked --lib -- vanished_renamed_idle_cache_opens_under_the_new_name
cargo test --manifest-path src-tauri/Cargo.toml --locked --lib -- vanished_renamed_idle_cache_keeps_committed_row
cargo test --manifest-path src-tauri/Cargo.toml --locked --lib -- vanished_renamed_idle_cache_keeps_row_after_idle_close
cargo test --manifest-path src-tauri/Cargo.toml --locked --lib -- vanished_rename_refuses_unproven_replacement_wal
cargo test --manifest-path src-tauri/Cargo.toml --locked --lib -- vanished_rename_refuses_wal_replaced_after_selection
cargo test --manifest-path src-tauri/Cargo.toml --locked --lib -- vanished_renamed_idle_cache_waits_for_drain
cargo test --manifest-path src-tauri/Cargo.toml --locked --lib -- revision_read_retires_vanished_idle_cache
cargo test --manifest-path src-tauri/Cargo.toml --locked --lib -- vanished_rename_retry_conflict_runs_helper_once
cargo test --manifest-path src-tauri/Cargo.toml --locked --lib -- vanished_rename_admits_with_fifteen_incomplete_retirements
cargo test --manifest-path src-tauri/Cargo.toml --locked --lib -- hard_link_alias_is_refused_until_cached_entry_and_owners_are_released
cargo test --manifest-path src-tauri/Cargo.toml --locked --lib -- wal_writer_survives_alias_refusal
cargo test --manifest-path src-tauri/Cargo.toml --locked --lib -- revision_read_refuses_same_parent_alias
cargo test --manifest-path src-tauri/Cargo.toml --locked --lib -- replacement_at_the_same_path_never_reuses_an_old_pooled_connection
```

The leaf names the new tests so each filter matches that test. Adopter, not this plan session: `pnpm checks:pre-review` before diff review, and `pnpm gates:push -- --rust` at release.

Rules for the write leaf, read in full, no further discovery: `.claude/rules/async-resource-invariants.md`, `.claude/rules/pgn-scanning.md`. PGN scanning applies only as a negative: do not change game boundaries, the byte-offset index, move encoding, search predicates, or `CastlingMode`.

### plan-r6.md

# Plan: Retire a vanished idle database cache on a same-inode admission conflict

## Goal

When a database file is renamed or moved outside ChessFable while its old name's repository entry is idle, opening the new name retires that idle entry through the existing drain-then-release path and admits the new name once. A live hard link, a busy lease, and `BoundDatabase::acquire` stay refused exactly as they are today.

## MANDATE

f-20261011-01, verbatim:

* **ID:** f-20261011-01 · **Status:** open · **Area:** db-search · **Root:** - · **Entry:** build · **Blocked:** none
* **Filed from:** d7fc28c0-e3c5-4fb5-b34f-fee1b64dec2f
* **Where:** `src-tauri/src/db/bound_sqlite.rs` (`BoundDatabase::acquire`, same-inode admission added for f-20260929-05: `"database is open through another name"`); `src-tauri/src/db/repository.rs` (`evict_idle_entries`, `:1092`, evicts only while `state.entries.len() > MAX_OPEN_DATABASES`; a cached `DatabaseEntry` owns its binding); the adapted test `replacement_at_the_same_path_never_reuses_an_old_pooled_connection` has to `close_and_invalidate` the setup name before reopening the renamed inode.
* **Defect:** after f-20260929-05, a database file renamed in the same folder outside ChessFable (file manager, sync client) while its old name's repository entry is cached gets `Conflict("database is open through another name")` on every open under the new name. The old entry is never accessed again (its path is gone), so the stale probe never retires it, and LRU eviction only fires above `MAX_OPEN_DATABASES`; the refusal therefore lasts until enough other databases are opened or the app restarts. The refusal itself is correct while the idle pool holds open SQLite connections on the inode (they share its `-shm`), so the defect is the retention, not the admission.
* **Why it matters:** a user who renames a database outside the app sees it fail to open with a generic database error (presentation: f-20261009-03) until restarting ChessFable.
* **Open question:** should a same-inode admission conflict in the repository's build path retire an idle cached entry whose own path no longer resolves to that inode (draining its pool through the existing retire/close path) and retry once, or should the repository re-probe idle entries' paths on a conflict, or is restart-until-evicted acceptable? Interacts with f-20260930-01 (eviction drops entries without draining connections) — any retirement must drain before the binding is released.
* **Related:** f-20260929-05 (introduced the admission; plan risk "Cached entries keep aliases refused" accepted this for live hard links, not for a vanished old name), f-20260930-01, f-20261009-03. Review record: `tasks/handoffs/2026-10-09-sqlite-hard-link-admission-review.md`.
* **Found by:** orchestrator diff review of the f-20260929-05 phase-1 write leaf (Claude Code, drain session d7fc28c0-e3c5-4fb5-b34f-fee1b64dec2f), 2026-10-11, from the fixture adaptation the leaf reported.

## Threat model and non-goals

The adversary is ordinary local filesystem activity while this process holds an idle pooled binding: a same-directory rename, a move to another directory, a second hard link that is still present, or a rename that races a live lease. The process is the only ChessFable instance for this app-data directory. Cross-process coordination, crash recovery, and a user who keeps the old name as a live hard link are outside the repair.

A vanished name must not be able to pin the inode until sixteen other databases evict it or the process restarts. A live second name must not be able to force that retirement. Retirement must not drop SQLite connections before they drain, and it must not close a lockable descriptor of the database inode on Unix.

## Traced premises

Confirmed on `6b600397549d5bd324205f0db8592dbe9b450ff6`. Obligations below do not cite lines.

* `BoundDatabase::acquire` refuses a second binding key for an inode that already has a published registration or a creation reservation. Different parent identity returns `DATABASE_OPEN_THROUGH_ANOTHER_DIRECTORY`; same parent and different leaf returns `DATABASE_OPEN_THROUGH_ANOTHER_NAME`. Identical keys reuse one registration. This door stays unchanged (d-20261011-01).
* The user open is `get_db_info_blocking` → `get_db_or_create` → `DatabaseRepository::connection` → `entry_until`. `entry_until` takes `predecessor_admission` for the new key, then `acquire_bound`. On the admission conflict it returns. Nothing in that path looks for a different cached key that holds the inode.
* `database_identity` hydrates through `read_revision`. `get_db_info_blocking` calls that only after `get_db_or_create` has returned a connection for the same target. `read_revision` itself also takes `predecessor_admission_for` and then `acquire_bound`, and it does not go through `entry_until`. A revision read of a new name while the old idle entry still holds the inode conflicts on its own.
* `identity_from_probe`, when hydrating, calls `probe_schema_and_revision` four times and returns `database changed while reading its identity` if the schema samples or the revisions disagree. `probe_schema_and_revision` captures schema metadata before `read_revision`.
* `classify_bound_failure` / `classify_bound_open_error_result` rewrites the Unix error to `database changed after capability resolution` when the new target's `probe_current` fails. When that probe succeeds, the original conflict is preserved. Windows `acquire_bound` returns `BoundDatabase::acquire`'s error unchanged. Only the two preserved admission messages are a vanished-holder signal.
* Idle means `DatabaseEntry::is_idle`: lease gate outstanding is 0 and the gate is not closed. `eviction_candidate` also requires `Arc::strong_count(entry) == 1`, so the map is the only owner. An `EntryLease` holds an `Arc<DatabaseEntry>`. LRU eviction runs only when `entries.len()` is already at `MAX_OPEN_DATABASES` (16) during insertion. The finding's `evict_idle_entries` name is stale; the capacity check inside `entry_until` is the current LRU.
* The pool builder sets `min_idle(Some(0))` and does not set an idle timeout. An idle repository entry can therefore hold a pool with zero connections. `ConnectionOptions::on_acquire` sets `PRAGMA journal_mode = WAL`. SQLite names the sidecars by appending `-wal` and `-shm` to the leaf. The bound stat hook `fstatat`s that leaf; a vanished leaf fails the stat, so a new open through that binding cannot checkpoint.
* `EntryKey::matches_predecessor` is same object identity OR same parent identity (d-20261011-10). `retirement_reserved` treats a live admission whose key matches the retiring key as a reservation. `wait_retirement_change` polls on `build_changed` until the deadline. Holding the new name's predecessor admission across `close_retired_entry_until` therefore waits on that same admission until `retire_wait`. Same-folder rename matches on both identity and parent. A cross-directory move of the same inode still matches on object identity.
* `retire_replaced` closes the lease gate, waits for leases, then `close_retired_entry_until` publishes the retirement, drops the pool outside the repository mutex, and waits for the connection and owner gates. On timeout or cancellation it does not forget an undrained gate (d-20261011-09); `cancel_retirement` reopens the lease gate only when the connection gate is not closed. `DatabaseEntry` drops `bound` after the pool field. The binding stays alive until the last `DatabaseEntry` / `BoundDatabase` clone drops, which is after the pool drop inside `close_retired_entry_until` only if the caller also drops its `Arc`.
* `BuildGuard` clears `building` for the new key on drop. `entry_until` returns `database is being replaced or deleted` when the cached entry's lease gate is already closed.
* `Binding` keeps the retained parent `File` and leaf `OsString`. `BoundDatabase` does not expose them. `probe_regular_file_at` stats with `AT_SYMLINK_NOFOLLOW` on Unix and does not open the leaf (d-20260929-04, d-20260930-10, f-20260929-11). On Windows the same function opens and closes a read handle; byte-range locks are handle-scoped (d-20260930-10). Absence is `Error::Io`. A non-regular file is `Error::InvalidInput` (`target must be a regular file`). A stat identity change across the probe is `Error::Conflict` (`workspace entry changed concurrently`).
* `scan_worker`, `snapshot_database`, and `linked_collections::legacy` call `BoundDatabase::acquire` directly. `scan_worker` already holds `predecessor_admission_for` across establishment and drops it before `validate_content` (d-20261011-13). `get_db_info_blocking` schedules that scan only after the connection exists.
* `replacement_at_the_same_path_never_reuses_an_old_pooled_connection` still `close_and_invalidate`s the setup name before renaming the inode onto the original path. Live same-parent refusal is `hard_link_alias_is_refused_until_cached_entry_and_owners_are_released`, `wal_writer_survives_alias_refusal`, and `revision_read_refuses_same_parent_alias`.
* f-20260930-01's drain gap is already closed by `retire_replaced` / `publish_retirement` (d-20261011-07, d-20261011-09). This plan uses that path. It does not reopen those decisions. d-20261011-15's per-pool thread-pool construction stays untouched.

## Approach

### Preserve admission

`BoundDatabase::acquire` still refuses a second distinct key for one inode, against published registrations and creation reservations, before any VFS or SQLite open. Identical keys, including Windows case variants, still share one registration. This plan does not add a retry inside `acquire`.

### Recognize only a preserved admission conflict

Repository establishment treats an error as a vanished-holder conflict only when it is `Error::Conflict` whose message is exactly `DATABASE_OPEN_THROUGH_ANOTHER_NAME` or `DATABASE_OPEN_THROUGH_ANOTHER_DIRECTORY`. `database changed after capability resolution`, a tombstone conflict, a construction timeout, cancellation, and every other error are unchanged and do not retire anything.

### One shared retirement attempt on both repository establishment sites

`entry_until` and `read_revision` are the only production callers of `acquire_bound`. Both use one private repository helper. The helper is not used from `scan_worker`, `snapshot_database`, or `linked_collections::legacy`.

Each call attempts this helper at most once, tracked by a local flag on that call. A second preserved admission conflict from the same call is returned as that conflict. The helper does not loop.

### Drop the predecessor admission before retirement

The new key's predecessor admission matches the old entry by object identity, and for a same-folder rename also by parent identity. The helper therefore runs only after that admission has been dropped.

In `entry_until` the `BuildGuard` for the new key stays held across the helper, so a second builder of the new key waits on `building` instead of retiring concurrently. The repository state mutex is not held across the checkpoint, `retire_replaced`, or `close_retired_entry_until`.

`entry_until` already holds a `RetirementCapacity` taken before `acquire_bound`. `close_retired_entry_until` takes another. Those two reservations must not be held together: with 15 other incomplete retirements the construction reservation is the 16th slot, and the helper then waits for a 17th until timeout. The same deadlock happens when 16 builders of renamed databases each keep one construction reservation and then each wait for another. `entry_until` drops its construction `RetirementCapacity` before the helper. `read_revision` does not hold one. After the helper retires at least one entry and the single retry `acquire_bound` succeeds, `entry_until` reserves capacity again through the existing `reserve_retirement_capacity` before the existing insert-time eviction. If that later reserve times out or is cancelled, that error is returned and the uninserted pool and binding are dropped. If the helper retires nothing, the original conflict is returned and no second reservation is taken.

If the helper returns an error, that error is the call result. The original conflict is not substituted. `BuildGuard` then clears `building` by its existing drop.

### Select idle cached holders of this inode

Under the repository state mutex, consider entries whose `EntryKey.identity` equals the target inode, whose path is not tombstoned, whose `Arc` strong count is 1, and whose `is_idle` is true. Skip the incoming key if it is already present. At most `MAX_OPEN_DATABASES` entries exist. One inode has one binding, so one match is the expected case; every match that passes the stale-name probe is retired before the single retry.

Do not remove the entry from the map before the existing `close_retired_entry_until` removal. Removing it early would let another `entry_until` for the old key build a second pool on the still-live registration.

### Decide staleness from the retained parent and leaf

While still holding the repository mutex, and before closing the lease gate, ask the entry's `BoundDatabase` whether its retained parent and leaf still name that binding's inode. The new method calls `probe_regular_file_at` and compares the returned identity with the binding's identity. It does not call `open`, `open_regular_at`, or `probe_current` on a pathname.

* Same identity: the leaf is a live name. Leave the entry cached and do not retire it.
* `Error::Io` whose kind is not-found, or `Error::InvalidInput` equal to the existing non-regular-file message: the retained name no longer names the inode. The entry is stale.
* A successful probe of a different identity: the retained name is now a different file. The entry is stale.
* `Error::Conflict` from the probe, and every other I/O error: return that error. Do not retire. Do not replace it with the admission conflict.

Re-check strong count 1 and `is_idle` under the same mutex hold after the probe. If either check fails, do not retire that entry.

### Close the lease gate before leaving the mutex, then drain

For a stale idle match, close its lease gate before releasing the repository mutex, so a concurrent `entry_until` of the old key observes the existing "database is being replaced or deleted" conflict instead of cloning the `Arc` and taking a lease. `DrainGate::close` is idempotent.

Then release the mutex. Committed frames may sit only in the vanished leaf's `-wal`. The new leaf does not open that name. Do not admit the new name while those frames exist only there, and do not open the database leaf to find them.

If the pool reports an idle connection, checkpoint before `retire_replaced` through that already held connection. The checkpoint is `PRAGMA wal_checkpoint(TRUNCATE)`. It uses the binding's already open descriptors. It does not call `open`, `open_regular_at`, or `probe_current` on the database leaf, and it does not create a pooled connection. Return that connection to the pool before `retire_replaced`, so its own connection ticket is not outstanding. Do not move sidecars after this checkpoint succeeds: the frames are in the main inode. If the checkout or the checkpoint fails, return that error. Do not retire, do not move sidecars, and do not admit the new name. Reopen the lease gate when the connection gate is still open, the same condition as `cancel_retirement`.

If the pool reports no connections, do not checkpoint and do not create a connection. Stat the retained parent's `<leaf>-wal` with `probe_regular_file_at`. A wal probe error other than not-found, including a non-regular file, returns that error. Do not retire and do not admit. Not found, or length 0: nothing of this database remains in a wal; retire as below without a move.

Length greater than 0 is not enough to move. Immediately before a move, probe the retained leaf again with `probe_regular_file_at`. Do not open it. A `cfg(test)` hook runs after the stale selection and before this fresh probe, so a test can install a replacement in that window. The production path does not wait on it. Move only when that probe is not-found or the existing non-regular-file error: the sidecar name has no current database file, which is the association this helper accepts. A successful probe of a different identity means a replacement file owns the name and the wal's association is unproven. Do not move it. If the wal length is greater than 0, do not retire and do not admit; return the original admission conflict. If that wal is absent or length 0, retire without a move. The same refusal applies when the re-probe finds the cached identity again. A re-probe conflict or any other I/O error returns that error and does not retire.

A permitted move renames that wal onto the new leaf before `retire_replaced`. Also move `<leaf>-shm` when that probe finds a regular file. The destination names are the new leaf plus `-wal` and `-shm` in the new parent, for a same-directory rename or a cross-directory move. If either destination exists, return that error before moving either file. Move by rename only. Do not copy, and do not open the database leaf. If the wal rename succeeds and the shm rename fails, rename the wal back. If that restore fails, return that error and do not retire. This move is not used after a successful checkpoint, and it is not used when an idle connection was checkpointed through its already open descriptors. The single retry open is what applies a moved wal to the main inode. This helper does not delete the moved files.

A checkout, probe, or unproven-wal failure on this path does not retire and does not admit. Reopen the lease gate when the connection gate is still open. The unproven-wal failure returns the original admission conflict. A probe or checkout failure returns that error.

Then call the existing `retire_replaced` with the caller's cancellation token. That waits for leases, publishes the retirement, drops the pool outside the mutex, and waits for the connection and owner gates. On timeout or cancellation, `retire_replaced` already keeps an undrained gate and reopens the lease gate only when the connection gate is still open. Return that error. The retry `acquire_bound` runs only after `retire_replaced` returns success, so it does not run while that connection gate is still open.

After `retire_replaced` returns success, drop every `Arc<DatabaseEntry>` the helper holds for that entry before acquiring again. The entry's `bound` is what keeps the registration alive after the pool drop.

A probe that races a restore of the same inode between the stat and `publish_retirement` can drain an idle live alias. That alias can open again after the last binding release, which d-20261011-01 already allows. Do not drop the binding before the drain returns.

### Retry establishment once, behind a fresh admission

If the helper retired at least one entry, the caller takes a fresh predecessor admission and calls `acquire_bound` once more.

* `entry_until` passes the deadline it already uses for `predecessor_admission`. It does not extend that deadline. The fresh admission waits for any still-incomplete matching retirement (d-20261011-08, d-20261011-10, d-20261011-11) and then establishment continues with the same `BuildGuard`.
* `read_revision` calls `predecessor_admission_for` again, which uses its existing `now + retire_wait` window, then retries `acquire_bound` once and continues the existing read-only open. It still does not create a pool.

If the helper retires nothing, the caller returns the original conflict and does not take a second admission.

The bound is one drain wait plus one fresh admission window per call, then either success or the second conflict. It is not a loop.

### One identity resample after this call writes the main file

A vanished-holder checkpoint, or the retry open that recovers a wal this call moved, writes the main file inside the first `read_revision`. That read is after the schema sample, so the four samples disagree and `identity_from_probe` would reject this call's own write.

When this call did that write and the four samples disagree, `identity_from_probe` runs the four-sample loop once more. The second loop's four samples must agree with each other, and the revision is the committed revision. A further disagreement is still `database changed while reading its identity`. When this call did not write the main file, disagreement is that conflict and there is no second loop. The flag belongs to this identity read, not to the process. The `connection` path checkpoints inside `entry_until` before `database_identity`, so that later identity read does not take the second loop unless a write happens inside that read. An external change with no write by this call still conflicts.

### What stays refused

* A live hard link whose retained leaf still names the inode stays cached, and the new name stays in conflict.
* An entry with a live lease or any extra `Arc` stays cached. The conflicting open returns the admission conflict. A later open, after the lease and extra `Arc` are gone, is a new call and may retire once.
* A tombstoned path stays on the deletion path.
* Direct `BoundDatabase::acquire` callers do not retire. After this repository path has dropped the stale registration, a later direct acquire of the new name succeeds. An in-flight `scan_worker` that already holds its own `BoundDatabase` keeps the new name refused until that clone drops; the one repository retry then returns the conflict. Archiving a new name that this repository has never opened, while an idle cache still holds the inode, still conflicts. That is not the filed open path. `get_db_info_blocking` reaches the scan only after `get_db_or_create` succeeds, so the user open retires first.

### Failure and ownership

The repository remains the owner of pooled entries and retirement records. Retirement records stay bounded by `MAX_OPEN_DATABASES` through the existing capacity reservation. No new registry, reaper, or retry thread is added. Poisoned repository and registry locks keep their existing typed conflicts. No new `unwrap` or `expect` on a file, database, or renderer-driven path. The helper does not call `BLOCKING_GATEWAY`.

The renderer payload for both admission messages stays `database_admission`. No command, event, binding, or UI string changes.

## Decisions and trade-offs

### Decided autonomously

Question (from the finding's open question): on a same-inode admission conflict in the repository build path, retire an idle cached entry whose retained name no longer names that inode and retry once, re-probe every idle entry on any conflict, or leave the refusal until LRU or restart?

Chosen: retire only idle cached entries of that inode whose retained parent and leaf no longer name it, through `retire_replaced`, then retry the repository establishment once behind a fresh predecessor admission. Both preserved admission messages use this path. `BoundDatabase::acquire` is unchanged.

Rejected: re-probing every idle entry on any conflict regardless of inode; accepting restart-until-evicted; weakening `BoundDatabase::acquire`; opening the old leaf by pathname; dropping the pool without `retire_replaced`; retrying while the new key's predecessor admission is still held; unbounded retry; treating an empty pool as nothing to preserve.

The first P1 correction checkpointed only when a pooled connection already existed and called an empty pool a known limit. That correction is withdrawn. Invariant: do not admit the new name while committed frames exist only under the vanished leaf's `-wal`, and do not open the database leaf to find them. Previous answer: skip the checkpoint when the pool is empty. New evidence: the pool builder uses `min_idle(Some(0))` and leaves the idle timeout unset, and the bound stat of a vanished leaf fails, so a later close cannot copy frames into the main inode. Judgment: an idle connection still checkpoints with `wal_checkpoint(TRUNCATE)` and does not move sidecars; zero connections with a non-empty `<leaf>-wal` move that wal, and `<leaf>-shm` when it is a regular file, onto the new leaf before retirement only when a fresh `probe_regular_file_at` of the retained leaf is not-found or non-regular; a zero-length or absent wal retires without a move; a different identity at the retained leaf with a non-empty wal refuses without a move and without retirement; any other empty-pool probe error refuses. Rejected for this judgment: leaving the empty pool as a known limit; opening a new pooled connection on the vanished leaf; deleting the wal; copying sidecars; moving sidecars after a successful `TRUNCATE`; moving a wal whose retained leaf now names another inode.

Reason: the refusal is correct while the idle pool holds the inode, and f-20260930-01 requires the drain before the binding is released. The predecessor-admission deadlock is avoided by dropping that admission first. Live hard links stay refused, which is the accepted risk in the f-20260929-05 review. Record this with `record-decision` at adoption. Reversal path: stop calling the helper from `entry_until` and `read_revision`, leaving admission and LRU as they are on this base.

Governing decisions that stay closed: d-20261011-01, d-20261011-02, d-20261011-07, d-20261011-08, d-20261011-09, d-20261011-10, d-20261011-11, d-20261011-13, d-20261011-15, d-20260929-04, d-20260930-10.

## Risks / open questions

* Windows may refuse to rename a file that still has the pool's handles. The production helper is not `cfg`-gated. The regression that renames or moves an open database is `#[cfg(unix)]` when Windows cannot perform that rename. Windows and macOS CI remain the runtime authority for the shared code (d-20261011-02). Do not add a Windows-only retirement policy.
* The restore race between the stale stat and `publish_retirement` can drain an idle alias that was restored as the same inode. The other name opens after the drain. That is accepted.
* If the new leaf's `-wal` or `-shm` already exists, this helper refuses and leaves the idle entry cached. It does not overwrite those files.
* A non-empty wal beside a retained leaf that now names another inode stays in place, and the new name stays refused. This helper does not open either database to decide wal ownership.
* After a successful `TRUNCATE`, the vanished leaf's `-wal` and `-shm` can remain beside the old name. The new name does not read them. They are leftover, not a second copy of the committed rows.
* A direct acquire that bypasses the repository can still observe the conflict until the repository entry is gone. Stated under "What stays refused".
* `read_revision`'s retry uses a second `predecessor_admission_for` window. `entry_until` does not extend its original deadline. Both are one-shot.

## Not part of this task

* Changing `BoundDatabase::acquire`, binding-key identity, or the two conflict strings.
* UI presentation of the conflict (f-20261009-03), generated bindings, and renderer state.
* `scan_worker`, `snapshot_database`, and `linked_collections::legacy`, except that they must keep compiling against an unchanged `BoundDatabase::acquire`.
* PGN boundaries, the byte-offset index, move encoding, and `CastlingMode`.
* Cross-process lock coordination, crash recovery, and other queued database findings.
* d-20261011-15's thread-pool builder.
* Co-located findings. This cluster is the singleton `f-20261011-01`.

## Phases

### Phase 1 — Idle vanished-holder retirement

Role: `sensitive`. One write leaf. Files: `src-tauri/src/db/repository.rs`, `src-tauri/src/db/bound_sqlite.rs`. Read-only context: `src-tauri/src/db/mod.rs`, `src-tauri/src/db/content_validation.rs`, `src-tauri/src/db/linked_collections.rs`, `src-tauri/src/db/linked_collections/legacy.rs`, `src-tauri/src/error.rs`, `src-tauri/src/infra/fs.rs`.

Implement every Approach heading. Add repository regressions:

* Same-folder external rename, old entry idle, no lease held: `connection` on the new name succeeds, the old key is gone, and the old leaf is not still cached. This assertion is the base failure: on this base the new name returns the admission conflict. Do not weaken it to accept that conflict.
* That same regression commits a row through the cached pool, returns the connection to the pool without checkpointing, renames only the main file, and reads the committed row back from the new name. `database_identity` on that new name then returns the committed revision. A write performed after the reopen is not this proof. After the open returns, the row is still readable if the vanished leaf's `-wal` is removed, because the checkpoint wrote the frames into the main inode. This path leaves an idle pooled connection in place so the checkpoint runs. It does not move sidecars.
* Empty pool, same commit and rename, and no file left at the old path: the test closes idle pooled connections before opening the new name, and it does not sleep. `connection` reads the committed row, and `database_identity` returns the committed revision. The vanished leaf's `-wal` is not the source of that read. Closing those connections is the regression's stand-in for the pool reaching zero connections. It does not change the production reaper. A helper that admits the new name without checkpointing and without moving the non-empty wal fails this read.
* Replacement sidecar: after that same rename, put a different regular file at the old path and a non-empty `-wal` there with distinctive bytes, then close idle pooled connections and open the new name. The open returns the admission conflict. The cached entry remains. Those wal bytes stay at the old sidecar, and the new name does not gain them. A helper that renames the replacement wal onto the new leaf fails this assertion.
* Fresh probe: the old path is absent through stale selection. The `cfg(test)` hook then places a different regular file at the old path and a non-empty `-wal` with distinctive bytes, before the fresh retained-leaf probe. Idle pooled connections are already closed. The open returns the admission conflict, the cached entry remains, and those bytes stay at the old sidecar. Deciding the move from the selection-time probe alone passes the pre-installed replacement test and fails this one.
* The new name's retry `acquire_bound` is not reached until `retire_replaced` has returned. The new-name open runs on another thread. The regression blocks in the existing `RetirementPublished` hook while holding one extra connection ticket. It then releases that hook and keeps the ticket. It waits until the connection gate is observed waiting, or until a retry acquire happens. The acquire count for the new name must still be the one pre-retirement attempt, and the gate must be the thing that is waiting. It then drops the ticket. The open succeeds, the retry acquire has run once, and the gate is closed with outstanding 0. Releasing the hook and the ticket together is not this proof. A path that skips the connection-gate wait fails the middle assertion.
* `database_identity` on the new name, with no prior `connection` on that name and with committed frames still only in the wal, retires the same idle holder and returns the committed revision. That success is the base failure: on this base the new name returns the admission conflict. A checkpoint or wal recovery inside the first `read_revision` must not surface as `database changed while reading its identity`. The four samples of the one allowed resample agree. A metadata change when this call did not write the main file still returns that conflict.
* A live same-parent hard link stays in conflict and the cached entry remains. A live cross-directory hard link stays in conflict.
* A cross-directory move of an idle cached file admits the new path once.
* An outstanding lease blocks retirement: the new name conflicts, the old entry remains, and a later open after the lease drops succeeds.
* One-shot bound after a retirement that still conflicts: a `cfg(test)` counter of helper invocations, plus a test hook that holds a separate `BoundDatabase` on a still-present hard link of the same inode across the retry. The helper runs once, the retry returns the admission conflict, and the counter stays 1. Removing the local flag makes the helper run again and fails the counter. The live-link refusal, which retires nothing, stays a separate case and still leaves the cached entry in place.
* Capacity: with 15 incomplete retirements already occupying slots, `entry_until` on the renamed idle database still drains it and admits the new name. Use `with_retire_wait` so a regression that keeps both reservations fails on the capacity timeout instead of the production wait. Follow the existing retirement-capacity fixtures.
* `replacement_at_the_same_path_never_reuses_an_old_pooled_connection` stays as written, including its `close_and_invalidate` before the rename.
* Existing `hard_link_alias_is_refused_until_cached_entry_and_owners_are_released`, `wal_writer_survives_alias_refusal`, and `revision_read_refuses_same_parent_alias` stay green.

The new rename, move, and lease tests are `#[cfg(unix)]` if the platform cannot rename an open database. The helper they drive is not `cfg`-gated.

PROOF COMMAND, one filter per invocation. Each filter is a unique substring of one test name. libtest matches a substring, not a shell pipeline and not a regex union:

```bash
cargo test --manifest-path src-tauri/Cargo.toml --locked --lib -- vanished_renamed_idle_cache_opens_under_the_new_name
cargo test --manifest-path src-tauri/Cargo.toml --locked --lib -- vanished_renamed_idle_cache_keeps_committed_row
cargo test --manifest-path src-tauri/Cargo.toml --locked --lib -- vanished_renamed_idle_cache_keeps_row_after_idle_close
cargo test --manifest-path src-tauri/Cargo.toml --locked --lib -- vanished_rename_refuses_unproven_replacement_wal
cargo test --manifest-path src-tauri/Cargo.toml --locked --lib -- vanished_rename_refuses_wal_replaced_after_selection
cargo test --manifest-path src-tauri/Cargo.toml --locked --lib -- vanished_renamed_idle_cache_waits_for_drain
cargo test --manifest-path src-tauri/Cargo.toml --locked --lib -- revision_read_retires_vanished_idle_cache
cargo test --manifest-path src-tauri/Cargo.toml --locked --lib -- vanished_rename_retry_conflict_runs_helper_once
cargo test --manifest-path src-tauri/Cargo.toml --locked --lib -- vanished_rename_admits_with_fifteen_incomplete_retirements
cargo test --manifest-path src-tauri/Cargo.toml --locked --lib -- hard_link_alias_is_refused_until_cached_entry_and_owners_are_released
cargo test --manifest-path src-tauri/Cargo.toml --locked --lib -- wal_writer_survives_alias_refusal
cargo test --manifest-path src-tauri/Cargo.toml --locked --lib -- revision_read_refuses_same_parent_alias
cargo test --manifest-path src-tauri/Cargo.toml --locked --lib -- replacement_at_the_same_path_never_reuses_an_old_pooled_connection
```

The leaf names the new tests so each filter matches that test. Adopter, not this plan session: `pnpm checks:pre-review` before diff review, and `pnpm gates:push -- --rust` at release.

Rules for the write leaf, read in full, no further discovery: `.claude/rules/async-resource-invariants.md`, `.claude/rules/pgn-scanning.md`. PGN scanning applies only as a negative: do not change game boundaries, the byte-offset index, move encoding, search predicates, or `CastlingMode`.

## Reviews

Full history: `tasks/plans/reviews-handoff.md`. Finding `f-20261011-01`. No Skip or Defer.

Round 1 REVISE. Eight Fix findings: P1 WAL preservation (plan 1), P2 capacity handoff (plan 2, correctness 1), P3 separate proof commands (plan 3, tests 1), P4 drain-before-retry proof (tests 2), P5 one-shot helper (tests 3), P6 base-failing success (root-cause 1). Chess-semantics, engine-protocol, ipc-contract, persisted-state, and pgn-index were NOT APPLICABLE and APPROVED. Minimalism, code-quality, error-handling, platform-semantics, and tauri-security APPROVED with no findings.

Round 2 REVISE. P2, P3, P5, and P6 closed. Four Fix findings: P1 still open (plan 1, correctness 1) because an empty pool skipped the checkpoint; P7 identity resample (plan 2); P4 still open (tests 1) because the hook and ticket were released together. Root-cause APPROVED.

Round 3 REVISE. P4 and P7 closed. One Fix finding: P1 still open (plan 1) because a non-empty wal could be moved when the retained leaf names another inode. Correctness and tests APPROVED.

Round 4 REVISE. P1 closed. One Fix finding: P8 (plan 1), the pre-installed replacement does not prove the fresh probe. Correctness and tests APPROVED.

Round 5 APPROVED. P8 closed. Plan, correctness, and tests reported no findings. Adoption counts: r1=8 r2=4 r3=1 r4=1 r5=0.

Round 6 APPROVED. No findings. Plan adoption counts stay r1=8 r2=4 r3=1 r4=1 r5=0 r6=0. Wall seconds r1=646.876 r2=348.330 r3=383.521 r4=173.236 r5=92.840 r6=141.299.

## Implementation diff review

Base `bb80addae508958011b899ec6e746bc8456ddc3e`. Code reviewed through `aa146951943a4659888f8b306693e88e157fc9e3`, then the repair through `9ffb312dfe5f964a1a2e6794dab003101075959d`.

Same family, disclosed: Grok orchestrated and arbitrated. Codex wrote the implementation and ran every read-only lens. Not a quota fallback.

Proof used `cargo test --manifest-path src-tauri/Cargo.toml --locked --bin chessfable`. The package has no library target, so the plan's `--lib` filters do not run. Each filter was one invocation and matched one test.

### Round 1

Pre-review was green before the round. Lenses: correctness, root-cause, error-handling, tests, code-quality, minimalism, pgn-index, platform-semantics (sensitive) and records (mechanical). Pgn-index was NOT APPLICABLE and APPROVED.

Fix, all repaired in `8a351907` and qualified by `d-20261028-03`:

* Platform finding 1, should-fix, `bound_sqlite.rs` vanished-leaf classification. A Windows directory at the retained name is `Error::Io` with raw `ERROR_DIRECTORY`, not the Unix `InvalidInput` string. `vanished_leaf` now treats that code as vanished, with NotFound and `InvalidInput` "target must be a regular file". No other I/O error is vanished.
* Tests finding 1, should-fix. Zero pooled connections and an absent or zero-length WAL retire without moving that WAL.
* Tests finding 2, should-fix. A failed `<leaf>-shm` rename restores the WAL.
* Error-handling finding 1, should-fix. When that restore also fails, both failures return through `Error::with_cleanup`.
* Minimalism finding 1, should-fix. `recover_vanished_holder_conflict` is the one shared recovery used by `entry_until` and `read_revision_tracking_writes`. Admission and capacity stay at the callers.
* Records finding 1, should-fix. `d-20261028-02` said the database leaf is not opened. `d-20261028-03` supersedes it: the Unix probe does not open the leaf; the Windows probe opens and closes a read handle.

Skip:

* Code-quality blocker, rename `wrote_main`. The plan's contract is that a checkpoint, or the retry open after a moved WAL, writes the main file inside that same `read_revision`. The flag was not renamed.
* Root-cause should-fix, no failing-before run. The lens verdict was APPROVED. The new tests fail if retirement is removed. This was a process note.
* Platform should-fix, add Windows fixtures for every new test. The reviewed plan confines open-database rename tests to `#[cfg(unix)]` and forbids a Windows-only retirement policy. Windows and macOS CI remain the runtime authority for the shared code.

Adoption counts are Fix findings, not unique issues: r1=6.

### Round 2

Closure over `aa146951943a4659888f8b306693e88e157fc9e3..9ffb312dfe5f964a1a2e6794dab003101075959d`, with `bb80adda..HEAD` as context. Pre-review after the repair was green, including windows-clippy. Lenses: correctness, tests, platform-semantics, error-handling, minimalism (sensitive) and records (mechanical).

Each adopted finding was CLOSED. No new defect. Every lens APPROVED. r2=0.

Linux revert proof: returning `Unproven` instead of `Empty` failed `vanished_rename_with_absent_or_empty_wal`; dropping `Error::with_cleanup` failed the double-failure test; skipping the WAL restore failed the restore test. The tree was restored and the four new tests passed. The Windows `ERROR_DIRECTORY` arm was not executed on this host. windows-clippy compiled it.

REVIEWED_THROUGH after this closure: `9ffb312dfe5f964a1a2e6794dab003101075959d`.
