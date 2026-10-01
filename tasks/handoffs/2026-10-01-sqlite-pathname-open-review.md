# Identity-only authority probes for pooled databases (f-20260929-11) — plan and diff review record

Scope: `f-20260929-11` (root `sqlite-pathname-open`) — the repository's authority probes of a
pooled database (`DatabaseFileTarget::open_current` and its consumers in `db/repository.rs`)
opened and closed the database leaf, releasing this process's process-associated SQLite POSIX
locks on it. Plan (ignored run artefact): `tasks/plans/2026-10-01-identity-only-database-probe.md`.
This tracked record preserves the complete issue and round history so the plan, its snapshots and
the lens reports under `/tmp` may disappear. Governing decisions (input): `d-20260929-04`,
`d-20260930-10`. Decision recorded by this run: `d-20261001-05`. Predecessor records:
`tasks/handoffs/2026-09-29-sqlite-pathname-open-review.md`,
`tasks/handoffs/2026-09-29-sqlite-leaf-open-review.md`.

## Lineage and run facts

* Drain `full auto` build run, one session: Claude Code (Opus 5.5) session
  `91758424-781d-4333-940b-009a6dbfb9d0`, drain run `31ae35fb-c29f-450a-ade9-1dea5cf57c90`,
  2026-10-01 ≈ 08:35–11:20 CEST. Executor: Codex (`gpt-6-luna`; `review-plan` role for the plan
  lens and the focused judgment, `sensitive` for every other lens, the phase and every fix).
  Plan authorship and arbitration shared one context; detection ran in separate Codex processes
  of a different model family; code was written by Codex leaves, so diff-review detection ran on
  the same family that wrote the code (session-level separation only).
* Locate: three Codex read-only probes. `probe-1` found lockable leaf opens of a possibly pooled
  inode outside the repository only through cross-capability aliases (puzzle database, PGN
  import/export file, search-index sidecar); filed as inbox
  `20261001-085423-2254262-1790837663344753656-3` (the drain merges and allocates its id).
* Measurements (rule 12b), atlas, kernel 7.0, uid 1000: mode `000` leaf → `statat` ok,
  `openat(O_RDONLY)` `EACCES`, `faccessat(R_OK, eaccess, nofollow)` denied; `0600` allowed;
  no-follow `faccessat` on a symlink answers for the link. libtest takes several filters after
  `--` (scratch crate: `db::a`, `infra::b` ran, `other::c` filtered). rustix 1.1.4
  `linux_raw` `accessat` (`syscalls.rs:1405-1451`): non-empty flags need `faccessat2`; the
  `ENOSYS` fallback covers only empty flags or exactly `AT_EACCESS` with uid==euid, gid==egid.
* Plan review: 4 completed rounds, no rewrite, no split, no pauses. Per-round wall time
  (snapshot to last report): r1 ≈ 13 min (10 lenses), r2 ≈ 8 (4), r3 ≈ 5 (2), r4 ≈ 11 (1).
  `plan_adopted_per_round`: r1=4 r2=1 r3=0 r4=0. Unique plan issues PR-01..PR-10; open 0.
* Implementation: one phase, one Codex write leaf (≈ 25 min) plus one resume fix round (≈ 10 min)
  → `83118f08`. Orchestrator proof: fmt, clippy `--all-targets -D warnings`, `cargo test -- db::
  infra::` (857 passed), `pnpm rust:windows:check`, `pnpm checks:pre-review`; red-on-revert of
  the lock witness (a `drop(open_regular_at(..))` inserted into the unix probe →
  `database_probe_current_keeps_pooled_sqlite_shared_read_lock_held` FAILED "a fresh descriptor
  must still see the held SQLite read lock"); freebsd cfg source probe on `repository.rs` and
  `bound_sqlite.rs` (clippy green, 859 tests passed; `fs.rs`/`path_authority` cannot be flipped
  because of macOS-only branches).
* Diff review: 3 rounds. d1 9 lenses over `0b45dbcd..83118f08`; d2 closure (6 lenses) over
  `83118f08..78766420`; d3 closure (3 lenses) over `78766420..4c62f32f`.
  `diff_adopted_per_round`: r1=4 r2=2 r3=0. One focused fresh-context `review-plan` judgment
  (§4a.3, the access-check race reopened in a repair's own code): mechanism (a) kept.
  Repairs: `bc44f238`, `78766420`, `4c62f32f`. REVIEWED_THROUGH=4c62f32f.

## Plan review history (verbatim from the plan's `## Reviews`)


### Round 1 — plan-r1, 10 lenses (Codex leaves, gpt-6-luna; executor `codex`), 2026-10-01

Raw reports: `/tmp/build-91758424-781d-4333-940b-009a6dbfb9d0/lens-*.txt` (preserved verbatim in the tracked handoff).
Verdicts: plan REVISE, correctness REVISE, tests REVISE, platform-semantics REVISE; minimalism, root-cause, error-handling, code-quality, tauri-security APPROVED; pgn-index NOT APPLICABLE / APPROVED.

| ID | Claim | Witnesses | Disposition | Evidence | Authority / obligation | Status |
|---|---|---|---|---|---|---|
| PR-01 | `statat` succeeds on an unreadable (mode `000`) leaf where today's `O_RDONLY` open fails `EACCES`; the pinned permission test would break and a failed `get()` would surface the pool's error (r2d2 timeout) instead of `PermissionDenied` | correctness #1 (blocker, 96) | Fix (substantive: failure semantics) — O1 adds a no-follow, effective-id `faccessat(R_OK)` after the kind check; O4 names the pinned test and its red-on-revert | `repository.rs:3911-3944` asserts `PermissionDenied`; probe on atlas: mode 000 → statat ok, openat EACCES, faccessat denied; 0600 allowed | MANDATE open question "keeps the … classification that `open_current` performs today"; O2 failure semantics | open → closure r2 |
| PR-02 | Full-precision mtime is promised but no assertion would catch truncation to seconds | plan #1 (blocker, 96), tests #2 (should-fix, 96) | Fix (verification level) — O4 adds an exact sub-second mtime assertion and a same-second-change assertion, red with truncation | `db/mod.rs:160-174` `SystemTime` equality; `repository.rs:385-392` cache | O1 (MANDATE "compare identity" + schema cache semantics kept) | open → closure r2 |
| PR-03 | `cargo test … -- db:: infra::` does not select the intended suites | tests #1 (blocker, 98) | Skip — false, measured | scratch crate: `cargo test -- db:: infra::` ran `db::a`, `infra::b`, filtered `other::c` | — | closed (evidence) |
| PR-04 | macOS runtime proof missing (freebsd probe runs on Linux) | platform-semantics #1 (should-fix, 98) | Fix — Phase 1 PROOF 7 names `rust-macos-test` on the pushed SHA | push skill §4 waits for these jobs | MANDATE "on macOS use `fstatat`" | open → closure r2 |
| PR-05 | Windows path only compile-checked | platform-semantics #2 (should-fix, 97) | Fix — PROOF 7 names `rust-windows-test` | as PR-04 | O1 Windows bullet | open → closure r2 |
| PR-06 | `entry()` carries probe metadata its caller drops | minimalism #1 (nit, 91) | Skip — the value has a consumer, the test helper `mark_schema_validated` (`repository.rs:637`), which would otherwise need a second probe | `repository.rs:633-638` | — | closed |
| PR-07 | Location correction calls `identity_from_probe` a reader; no reader exists | plan limitation (99) | No change — the plan already states P5 (no reader) and removes the readable method on that basis | `repository.rs:579-580`, `:596` | — | noted |

Round 1 elapsed: ~13 min wall (launch to last report), no waits. Adopted plan-level: 4 (PR-01, PR-02, PR-04, PR-05).

### Round 2 — plan-r2, closure: plan, correctness, tests, platform-semantics, 2026-10-01

Verdicts: plan APPROVED, tests APPROVED, platform-semantics APPROVED, correctness REVISE.
PR-01, PR-02, PR-04, PR-05: CLOSED by all four lenses (plan-level; implementation proofs pending).

| ID | Claim | Witnesses | Disposition | Evidence | Authority / obligation | Status |
|---|---|---|---|---|---|---|
| PR-08 (lineage PR-01, correction-introduced) | Between `statat` and the no-follow `faccessat`, a leaf swapped to a symlink makes the access check answer for the link; the probe then returns the old file's metadata as Ok without binding access and metadata to the same leaf | correctness-r2 #1 (blocker, 93) | Fix (substantive) — O1 stat sandwich: statat → faccessat → statat, second must be regular with the same identity, else Conflict-class; O4 asserts it with a hook between access and second stat (symlink and other-inode swaps), red without the second stat | measured: `faccessat(..., follow_symlinks=False)` on a symlink → allowed (round-1 probe) | Threat model, adversarial entry: "a swap observed by a probe is `Conflict`" | open → closure r3 |

Round 2 elapsed: ~8 min wall. Adopted plan-level: 1 (PR-08).

### Round 3 — plan-r3, closure of PR-08: plan, correctness, 2026-10-01

Verdicts: correctness APPROVED (`PR-08 CLOSED`), plan REVISE.

| ID | Claim | Witnesses | Disposition | Evidence | Authority / obligation | Status |
|---|---|---|---|---|---|---|
| PR-08 residual | A→symlink→A around the `faccessat` (unreadable A restored before the second stat) reports A readable | plan-r3 #1 (blocker, 98: "PR-08 NOT CLOSED") | Skip — outside the frozen threat model; recorded as named known limit R4. Both stats observe the authorized inode, so the probe's identity/kind guarantee holds; the effect is error classification only and every path fails closed (the SQLite open of an unreadable file fails). correctness-r3 judged the same case outside the threat model | plan R4; round-1 probe (faccessat no-follow on a symlink → allowed) | Threat model adversarial entry | closed (Skip) → r4 confirms R4 text |
| PR-09 | The round-3 prompt lacked the contract's `## Re-review` block (ROUND/DELTA/REVISED/SETTLED) | plan-r3 #2 (blocker, 100) | Fix (process) — round 4 carries the verbatim block | `review-lens-contract.md` "Re-review rounds" | lens contract | open → r4 |

Round 3 elapsed: ~5 min wall. Adopted plan-level: 0 (PR-09 is a process correction; PR-08 residual skipped).

### Round 4 — plan-r4, review-plan closure, 2026-10-01

Verdict: plan APPROVED. PR-09 CLOSED (block present). PR-08 residual not re-raised; R4 accepted.

| ID | Claim | Witnesses | Disposition | Evidence | Status |
|---|---|---|---|---|---|
| PR-10 | O5 says a `repository.rs` source scan names `open_current`; the scan at `repository.rs:3133` names `identity_from_probe` | plan-r4 LATE OBSERVATIONS (should-fix, 99) | Fix — reference-only edit to O5; arbiter-closed (semantics and proof unchanged: no scan is dropped, the `identity_from_probe` scan stays as is) | `repository.rs:3130-3135` | closed (arbiter) |

Round 4 elapsed: ~11 min wall. Adopted plan-level: 0.

### Closure summary

Plan review closed after 4 rounds (r1=4 r2=1 r3=0 r4=0 adopted plan-level). Unique issues: 10 opened (PR-01..PR-10), PR-01/02/04/05/08/09 closed by lens, PR-10 closed by arbiter, PR-03/PR-06 skipped with evidence, PR-07 noted, PR-08 residual skipped as named known limit R4. Correction-introduced: PR-08 (parent PR-01, plan-r3). Open plan-level obligations: none.

## Diff review history

| ID | Round | Claim | Witnesses | Disposition | Evidence | Status |
|---|---|---|---|---|---|---|
| D-01 | d1 | `accessat(EACCESS \| SYMLINK_NOFOLLOW)` returns `ENOSYS` on Linux < 5.8 with rustix 1.1.4 `linux_raw`, so every database probe and open fails there | correctness (blocker 97), pgn-index (blocker 98), platform-semantics (should-fix 98) | Fix — `AtFlags::EACCESS` only (`bc44f238`) | rustix `syscalls.rs:1405-1451` read by the orchestrator | CLOSED d2 (correctness, pgn-index, platform-semantics) |
| D-02 | d1 | probe-hook test observers still named `opens` / `after_open` | code-quality (blocker 99) | Fix — renamed (`78766420`) | — | CLOSED d2 (code-quality) |
| D-03 | d1 | R4 race (unreadable A → symlink → A) loses `PermissionDenied`; the classifier then returns the pool error | error-handling (should-fix 86) | Skip — named known limit R4, error class only, fails closed | plan R4 | closed |
| D-04 | d1 | `probe_schema` re-checks the identity `probe_current` already enforces | minimalism (nit 95) | Fix — guard removed (`78766420`) | `path_authority/mod.rs` ~846 | CLOSED d2 (minimalism) |
| D-05 | d1 | PGN/puzzle/sidecar capabilities can still open and close a lockable descriptor of an aliased pooled inode | root-cause (should-fix 86) | Defer — already filed (inbox `20261001-085423-2254262-1790837663344753656-3`) | locate `probe-1` | filed |
| D-06 | d1 | nothing proves the classifier consults its probe with an unchanged refusal count | tests (should-fix 90) | Fix — `bound_open_error_checks_the_probe_when_refusal_count_is_unchanged`, red with `\|\| Ok(())` (`78766420`) | leaf-reported red-on-revert | CLOSED d2 (tests) |
| D-07 (lineage PR-08) | d2 | EACCESS-only follows a transient symlink to an unreadable B, so a readable A gets `PermissionDenied` for one probe | correctness (blocker 89) | Skip — focused fresh-context `review-plan` judgment chose mechanism (a): an unobserved swap during the access check changes only which error a probe reports; `faccessat2`/`AT_EMPTY_PATH` and `O_PATH` routes fail Linux < 5.8 or macOS, mode-bit derivation ignores ACLs; both directions named in `d-20261001-05` | judgment report below | CLOSED d3 (correctness) |
| D-08 | d2 | no test goes red if `SYMLINK_NOFOLLOW` is re-added (no test kernel lacks `faccessat2`) | tests (blocker 92) | Fix — `platform_support` source row pinning the exact call (`4c62f32f`), red with the flag re-added | leaf-reported red-on-revert; orchestrator re-ran green | CLOSED d3 (tests) |
| D-09 | d2 | comment "no flagged faccessat fallback" imprecise | code-quality (nit 86) | Fix — reworded (`4c62f32f`) | — | CLOSED d3 (code-quality) |

Open diff-review findings: none. Carried items: none.

## Successor ownership

* Cross-capability aliases (D-05 / P9): the inbox entry named above, `Entry: build`, carries its
  own open question; it inherits no issue IDs from this record.
* Runtime on macOS and Windows: the `rust-macos-test` and `rust-windows-test` jobs on the pushed
  SHA (plan Phase 1 PROOF 7).

## Raw lens reports (verbatim)

### probe-1

```text
## Findings

- [src-tauri/src/infra/path_authority/mod.rs:6453](/home/felixb/Projekte/chessfable/src-tauri/src/infra/path_authority/mod.rs:6453) constructs normal game database targets through `acquire_target(AcquireShape::File)`. On Unix this checks the leaf with metadata and `statat`, opening only the parent directory ([fs.rs:4243](/home/felixb/Projekte/chessfable/src-tauri/src/infra/fs.rs:4243)); it does not open a lockable leaf descriptor. Windows briefly opens a child handle to verify it, but Windows locks are handle-scoped.

- [src-tauri/src/infra/path_authority/resolved.rs:860](/home/felixb/Projekte/chessfable/src-tauri/src/infra/path_authority/resolved.rs:860) is the generic capability resolver’s ordinary leaf open, retained in `ResolvedPath.file`. Game `DatabaseFile` operations use `database_file_target`, not this resolver; puzzle read/delete capabilities do use it, and PGN import/export file capabilities can reach it through a separate capability.

- Puzzle reads open and retain the database file through resolution ([puzzle.rs:103](/home/felixb/Projekte/chessfable/src-tauri/src/puzzle.rs:103), [resolved.rs:544](/home/felixb/Projekte/chessfable/src-tauri/src/infra/path_authority/resolved.rs:544)). The four snapshot-connection callers are [puzzle.rs:123](/home/felixb/Projekte/chessfable/src-tauri/src/puzzle.rs:123), [puzzle.rs:160](/home/felixb/Projekte/chessfable/src-tauri/src/puzzle.rs:160), [puzzle.rs:188](/home/felixb/Projekte/chessfable/src-tauri/src/puzzle.rs:188), and [puzzle.rs:213](/home/felixb/Projekte/chessfable/src-tauri/src/puzzle.rs:213). These descriptors are lockable; `try_clone()` creates another descriptor, and the passed file remains pinned until the snapshot-backed connection drops ([repository.rs:449](/home/felixb/Projekte/chessfable/src-tauri/src/db/repository.rs:449), [repository.rs:474](/home/felixb/Projekte/chessfable/src-tauri/src/db/repository.rs:474), [repository.rs:482](/home/felixb/Projekte/chessfable/src-tauri/src/db/repository.rs:482)). SQLite uses a private temp snapshot, but a pooled connection on the original inode can still be live if that inode is also authorized as a game database.

- Puzzle deletion also retains the resolver-opened file until its operation finishes ([puzzle.rs:610](/home/felixb/Projekte/chessfable/src-tauri/src/puzzle.rs:610), [resolved.rs:556](/home/felixb/Projekte/chessfable/src-tauri/src/infra/path_authority/resolved.rs:556)). Deletion drains the pool for the same repository key first, but a pool reached through a different hard-link path can remain live when the retained descriptor closes.

- The known `open_current` path remains lockable and hazardous: [repository.rs:572](/home/felixb/Projekte/chessfable/src-tauri/src/db/repository.rs:572) opens the file in `probe_schema`; it drops at function return, and hydrated identity performs four schema probes. `database_identity` / `database_identity_expected` callers include [db/mod.rs:944](/home/felixb/Projekte/chessfable/src-tauri/src/db/mod.rs:944) while a pooled connection is held, [db/mod.rs:1172](/home/felixb/Projekte/chessfable/src-tauri/src/db/mod.rs:1172) while `get_db_info` holds one, and [db/mod.rs:2596](/home/felixb/Projekte/chessfable/src-tauri/src/db/mod.rs:2596) before deletion drains the pool. Search-index loading calls the same probes at [search.rs:217](/home/felixb/Projekte/chessfable/src-tauri/src/db/search.rs:217), [search.rs:241](/home/felixb/Projekte/chessfable/src-tauri/src/db/search.rs:241), and [search.rs:300](/home/felixb/Projekte/chessfable/src-tauri/src/db/search.rs:300); a pooled connection may be idle or concurrently in use. The post-get probe is especially direct: it opens after obtaining a pooled connection and is dropped after that connection’s schema check ([repository.rs:1087](/home/felixb/Projekte/chessfable/src-tauri/src/db/repository.rs:1087)).

- [src-tauri/src/main.rs:187](/home/felixb/Projekte/chessfable/src-tauri/src/main.rs:187) `SearchIndexIdentity::for_database` uses canonicalization, existence checks, and metadata; it does not create a `File` descriptor for the database. `IndexSource::from_database`’s `File::open` is test-only.

- Search-index sidecar reads do open ordinary descriptors: [search.rs:335](/home/felixb/Projekte/chessfable/src-tauri/src/db/search.rs:335) opens the preferred `.ecsi` sidecar, whose mapping can retain the file; [search_index.rs:886](/home/felixb/Projekte/chessfable/src-tauri/src/db/search_index.rs:886) opens a legacy sidecar and clones it for validation. They ordinarily refer to separate index files, but if a sidecar is hard-linked to a pooled database inode, it can be opened and later closed while that pool is live.

- Export’s source database access uses the repository pool, with no extra database-leaf open. However, [db/mod.rs:3123](/home/felixb/Projekte/chessfable/src-tauri/src/db/mod.rs:3123) resolves and snapshots an existing `WritePgn` destination before obtaining the pooled connection; that destination descriptor is lockable and remains held through export. If a separate PGN capability names the same inode as a pooled database, it can close while the repository pool retains connections.

- [db/mod.rs:2669](/home/felixb/Projekte/chessfable/src-tauri/src/db/mod.rs:2669) `unlink_database_files` stats and unlinks the primary database; it does not open a primary-file descriptor. The legacy-sidecar check at [db/mod.rs:2810](/home/felixb/Projekte/chessfable/src-tauri/src/db/mod.rs:2810) does open a sidecar as above. The exact database pool is drained before the unlink callback; an alternate hard-link pool remains a possible overlap.

- The bound SQLite Linux leaf hook opens `O_PATH` and closes only that non-lockable descriptor on refusal or reopen failure; a successful lockable reopen is returned to SQLite ([bound_sqlite.rs:1133](/home/felixb/Projekte/chessfable/src-tauri/src/db/bound_sqlite.rs:1133), [bound_sqlite.rs:1144](/home/felixb/Projekte/chessfable/src-tauri/src/db/bound_sqlite.rs:1144)). Non-Linux Unix retains mismatched or unclassified lockable descriptors until the relevant bindings are gone ([bound_sqlite.rs:1276](/home/felixb/Projekte/chessfable/src-tauri/src/db/bound_sqlite.rs:1276)); Windows handles remain handle-scoped.

- Production database creation opens the newly created leaf in [resolved.rs:995](/home/felixb/Projekte/chessfable/src-tauri/src/infra/path_authority/resolved.rs:995) and closes it after sync and registration. The repository cannot have pooled that newly created inode before the creation call returns.

## Classification

**LOCKABLE OPEN+CLOSE WHILE POOLED POSSIBLE**

- `open_current` repository probes, especially post-get and identity calls listed above.
- Puzzle read/delete retained descriptors and snapshot clones, if the inode is also pooled through a game-database capability.
- Existing PGN export/import capability files and search-index sidecars, if a separate capability or hard link names a pooled database inode.

**SAFE**

- Unix game-database target construction through `AcquireShape::File`; Windows verification handles are handle-scoped.
- `SearchIndexIdentity::for_database`.
- Primary unlink in `unlink_database_files` after draining the matching repository entry.
- Bound SQLite refusal paths on Linux, with the platform-specific behavior described above.
- New database creation before a pool can exist for that inode.

**UNSURE**

- Whether every cross-purpose PGN or sidecar alias is reachable through the app’s native picker flows. The source paths do not enforce a cross-capability inode exclusion.
```

### probe-2

```text
### (a) Platform behavior

- Unix `open_parent_no_follow` calls `unix::open_parent`, which walks the parent from `/` or `.` using descriptor-relative `openat` with `RDONLY | DIRECTORY | NOFOLLOW | CLOEXEC` and rejects traversal components; `open_verified_parent` then uses `statat(..., SYMLINK_NOFOLLOW)` to check the leaf’s identity and kind, opening the leaf only when `directory == true` ([fs.rs](/home/felixb/Projekte/chessfable/src-tauri/src/infra/fs.rs:1511), [fs.rs](/home/felixb/Projekte/chessfable/src-tauri/src/infra/fs.rs:4234)).

- Unix `entry_identity_at` uses the same no-follow `statat` and returns `InvalidInput` for a wrong kind, while `assert_entry_identity` returns `Conflict` for a wrong kind or identity mismatch; both return I/O errors from `statat` and neither opens the leaf ([fs.rs](/home/felixb/Projekte/chessfable/src-tauri/src/infra/fs.rs:4321), [fs.rs](/home/felixb/Projekte/chessfable/src-tauri/src/infra/fs.rs:4353)).

- Windows `open_parent_no_follow` routes to `win::open_writable_parent`, while `open_verified_parent` walks and opens the parent, then calls `open_expected_child` on the leaf—even when `directory == false`—and checks its identity ([fs.rs](/home/felixb/Projekte/chessfable/src-tauri/src/infra/fs.rs:4289), [fs.rs](/home/felixb/Projekte/chessfable/src-tauri/src/infra/fs.rs:3136)).

- Windows `entry_identity_at` and `assert_entry_identity` also open a temporary leaf handle; those opens request `SYNCHRONIZE | GENERIC_READ | READ_CONTROL` and share `FILE_SHARE_READ | FILE_SHARE_WRITE | FILE_SHARE_DELETE`, with reparse points refused ([fs.rs](/home/felixb/Projekte/chessfable/src-tauri/src/infra/fs.rs:3050), [fs.rs](/home/felixb/Projekte/chessfable/src-tauri/src/infra/fs.rs:2117), [path_authority/mod.rs](/home/felixb/Projekte/chessfable/src-tauri/src/infra/path_authority/mod.rs:3524)).

- `raw_stat_identity` is Unix-only and encodes `(st_dev, st_ino)`; Windows `opened_file_identity` instead returns the volume serial and file index from the handle ([fs.rs](/home/felixb/Projekte/chessfable/src-tauri/src/infra/fs.rs:1092), [path_authority/mod.rs](/home/felixb/Projekte/chessfable/src-tauri/src/infra/path_authority/mod.rs:3483)).

- `DatabaseFileTarget::open_current` maps `NotFound`, `Reparse`, and `WrongKind` to `Conflict` and propagates other classified errors; on Unix, its later `open_regular_at` still opens the leaf to return the readable `File` ([path_authority/mod.rs](/home/felixb/Projekte/chessfable/src-tauri/src/infra/path_authority/mod.rs:817), [path_authority/mod.rs](/home/felixb/Projekte/chessfable/src-tauri/src/infra/path_authority/mod.rs:841)).

### (b) Identity encoding

- Yes: Unix `opened_file_identity` returns `(meta.dev(), meta.ino())`, while `raw_stat_identity` returns `identity_from_parts(stat.st_dev, stat.st_ino)`; the device conversion is canonicalized, and a test asserts the stat identity equals `(metadata.dev(), metadata.ino())` ([path_authority/mod.rs](/home/felixb/Projekte/chessfable/src-tauri/src/infra/path_authority/mod.rs:3434), [fs.rs](/home/felixb/Projekte/chessfable/src-tauri/src/infra/fs.rs:1092), [fs.rs](/home/felixb/Projekte/chessfable/src-tauri/src/infra/fs.rs:1247)).

### (c) Length and modified time

- No existing returned primitive provides identity, length, and mtime together: Unix directory enumeration uses `statat` and exports identity plus whole-second `st_mtime`, but `DirectoryEntry` has no length field; Windows enumeration exports identity, kind, and whole-second `LastWriteTime`, while per-leaf identity opens request `GENERIC_READ` ([fs.rs](/home/felixb/Projekte/chessfable/src-tauri/src/infra/fs.rs:111), [fs.rs](/home/felixb/Projekte/chessfable/src-tauri/src/infra/fs.rs:55), [fs.rs](/home/felixb/Projekte/chessfable/src-tauri/src/infra/fs.rs:2877)).

### (d) Schema identity and timestamp precision

- `DatabaseSchemaIdentity` derives `Eq` and `PartialEq`, so equality compares object identity, length, and the exact `SystemTime` from `metadata.modified()`; converting only `stat.st_mtime` seconds cannot reproduce that value when subsecond precision is nonzero, though using the full native seconds-and-nanoseconds timestamp can ([db/mod.rs](/home/felixb/Projekte/chessfable/src-tauri/src/db/mod.rs:159), [db/mod.rs](/home/felixb/Projekte/chessfable/src-tauri/src/db/mod.rs:166), [fs.rs](/home/felixb/Projekte/chessfable/src-tauri/src/infra/fs.rs:122)).

### (e) `OFlags::PATH` and existing `O_PATH`

- The direct dependency is rustix 1.1.4; for this project’s Linux/macOS/Windows targets, `OFlags::PATH` is Linux’s `O_PATH` flag ([Cargo.toml](/home/felixb/Projekte/chessfable/src-tauri/Cargo.toml:81), [Cargo.lock](/home/felixb/Projekte/chessfable/src-tauri/Cargo.lock:4763), [rustix 1.1.4 `OFlags` docs](https://docs.rs/rustix/1.1.4/rustix/fs/struct.OFlags.html)).

- The repository already uses `libc::O_PATH | O_NOFOLLOW | O_CLOEXEC` in `bound_sqlite.rs`’s Linux-gated `open_linux_leaf`; it does not use `rustix::fs::OFlags::PATH` there ([bound_sqlite.rs](/home/felixb/Projekte/chessfable/src-tauri/src/db/bound_sqlite.rs:1121)).
```

### probe-3

```text
## Source shape

- [path_authority/mod.rs:814](/home/felixb/Projekte/chessfable/src-tauri/src/infra/path_authority/mod.rs:814): `DatabaseFileTarget::open_current` returns `Result<fs::File, Error>`, rechecks the retained parent identity, opens the leaf read-only as a regular file, fstats it against the authorized identity, and maps missing, reparse, or wrong-kind probes to `Conflict`.
- [repository.rs:1011](/home/felixb/Projekte/chessfable/src-tauri/src/db/repository.rs:1011): the repository’s `open_current` wrapper calls the target method and dispatches `AfterOpenCurrent` after either an `Ok` or an `Err`.
- [repository.rs:1021](/home/felixb/Projekte/chessfable/src-tauri/src/db/repository.rs:1021): `entry_probe` returns a successful `File`, retries once only after `Conflict`, and retires an idle stale entry if both attempts conflict.
- [repository.rs:95](/home/felixb/Projekte/chessfable/src-tauri/src/db/repository.rs:95): `AcquiredConnection`’s fourth tuple field is `std::fs::File`; [repository.rs:1053](/home/felixb/Projekte/chessfable/src-tauri/src/db/repository.rs:1053) drops the entry and pre-get probe, then returns the post-get probe with the pooled connection.
- [repository.rs:384](/home/felixb/Projekte/chessfable/src-tauri/src/db/repository.rs:384): `connection()` passes the returned post-get `File` to `DatabaseSchemaIdentity::from_file`, while [repository.rs:411](/home/felixb/Projekte/chessfable/src-tauri/src/db/repository.rs:411) shows `initialization_connection()` discarding it.
- [repository.rs:1098](/home/felixb/Projekte/chessfable/src-tauri/src/db/repository.rs:1098): `classify_bound_open_error` short-circuits when the bound VFS refusal count changes, otherwise calls `target.open_current().map(drop)` directly, bypassing the repository wrapper and its hook/count.
- [repository.rs:1190](/home/felixb/Projekte/chessfable/src-tauri/src/db/repository.rs:1190): `classify_bound_open_error_result` classifies only the closure’s `Ok`/`Err` result—`Conflict` becomes the standard identity conflict, other errors pass through, and `Ok` preserves the original error.
- [repository.rs:572](/home/felixb/Projekte/chessfable/src-tauri/src/db/repository.rs:572): `probe_schema` calls `DatabaseSchemaIdentity::from_file` and checks the file’s object identity; [db/mod.rs:167](/home/felixb/Projekte/chessfable/src-tauri/src/db/mod.rs:167) shows `from_file` uses `metadata()`, `opened_file_identity`, length, and modification time.
- [repository.rs:525](/home/felixb/Projekte/chessfable/src-tauri/src/db/repository.rs:525): hydrated `identity_from_probe` takes four schema/revision samples, while `hydrate == false` takes one schema probe.
- [repository.rs:1332](/home/felixb/Projekte/chessfable/src-tauri/src/db/repository.rs:1332): `TestHook::AfterOpenCurrent` is dispatched through a scope-checked counter that saturating-increments before passing the count to the callback at [repository.rs:1528](/home/felixb/Projekte/chessfable/src-tauri/src/db/repository.rs:1528).

## Tests and source scans

- [path_authority/mod.rs:10248](/home/felixb/Projekte/chessfable/src-tauri/src/infra/path_authority/mod.rs:10248): `database_file_target_open_current_authenticates_the_authorized_file` fstats the returned file and compares its identity to the target, then checks the exact `Conflict` message after unlink, so its success assertion depends on the returned `File`.
- [path_authority/mod.rs:10266](/home/felixb/Projekte/chessfable/src-tauri/src/infra/path_authority/mod.rs:10266): `database_file_target_open_current_rejects_directory_and_parent_replacements` checks only `Err(Error::Conflict(...))` for directory, replaced-parent, and hard-link-parent cases.
- [repository.rs:1867](/home/felixb/Projekte/chessfable/src-tauri/src/db/repository.rs:1867): `test_hooks_are_scoped_to_the_database_path` counts actual `AfterOpenCurrent` callbacks for one database and verifies another database does not increment them, without inspecting a returned file.
- [repository.rs:2007](/home/felixb/Projekte/chessfable/src-tauri/src/db/repository.rs:2007): `stale_hook_callback_cannot_overwrite_new_configuration` manually dispatches `AfterOpenCurrent` and tests callback configuration/writeback, not file behavior.
- [repository.rs:2017](/home/felixb/Projekte/chessfable/src-tauri/src/db/repository.rs:2017): `panicking_hook_configuration_does_not_poison_following_configuration` likewise tests hook installation and dispatch, not `open_current`’s result.
- [repository.rs:2103](/home/felixb/Projekte/chessfable/src-tauri/src/db/repository.rs:2103): `unlinked_before_get_is_rejected_by_the_prompt_probe` removes the leaf before the pre-get probe and asserts prompt `Conflict`, without examining a `File`.
- [repository.rs:2143](/home/felixb/Projekte/chessfable/src-tauri/src/db/repository.rs:2143): `swap_after_get_is_rejected_without_retiring_an_outer_lease` asserts post-get `Conflict` and that the old entry remains open, without examining the probe file.
- [repository.rs:2206](/home/felixb/Projekte/chessfable/src-tauri/src/db/repository.rs:2206): `stale_probe_confirms_once_then_retires_an_idle_entry` asserts `Conflict`, exactly two hook callbacks for the confirmation probes, and removal of the stale entry, without inspecting a `File`.
- [repository.rs:2251](/home/felixb/Projekte/chessfable/src-tauri/src/db/repository.rs:2251): `unlinked_before_pool_build_is_a_prompt_conflict_and_clears_building` asserts prompt `Conflict` and cleared build state, not file contents or identity.
- [repository.rs:2771](/home/felixb/Projekte/chessfable/src-tauri/src/db/repository.rs:2771): `identity_sandwich_rejects_object_swap` expects `Conflict` after an `AfterOpenCurrent` hook replaces the leaf; the assertion is error-class-only, while the implementation uses the returned file’s identity through `probe_schema`.
- [repository.rs:2806](/home/felixb/Projekte/chessfable/src-tauri/src/db/repository.rs:2806): `identity_sandwich_rejects_wal_revision_after_r1` expects `Conflict` when the revision changes after sample one, with schema identity obtained through returned files.
- [repository.rs:2826](/home/felixb/Projekte/chessfable/src-tauri/src/db/repository.rs:2826): `identity_sandwich_rejects_wal_revision_after_r2` expects `Conflict` when the revision changes after sample two, again without directly inspecting a file.
- [repository.rs:2846](/home/felixb/Projekte/chessfable/src-tauri/src/db/repository.rs:2846): `identity_sandwich_rejects_object_swap_after_r3` expects `Conflict` after a third-probe hook replaces the leaf, with file identity consumed inside `probe_schema`.
- [repository.rs:2869](/home/felixb/Projekte/chessfable/src-tauri/src/db/repository.rs:2869): `identity_sandwich_rejects_wal_revision_after_r3` expects `Conflict` when the revision changes after sample three, without a direct file assertion.
- [repository.rs:2889](/home/felixb/Projekte/chessfable/src-tauri/src/db/repository.rs:2889): `identity_from_probe_observes_cancellation` checks cancellation and hook/read counts at pre-open, after the first revision read, and after four reads, but never inspects a returned file.
- [repository.rs:2959](/home/felixb/Projekte/chessfable/src-tauri/src/db/repository.rs:2959): `identity_from_probe_cancels_during_read_data_revision` checks cancellation checkpoints and callback count, not the probe file.
- [repository.rs:2980](/home/felixb/Projekte/chessfable/src-tauri/src/db/repository.rs:2980): `identity_from_probe_hydrate_false_rejects_mid_probe_tombstone` checks the exact tombstone `Conflict` after one hook callback, without inspecting the `File`.
- [repository.rs:3006](/home/felixb/Projekte/chessfable/src-tauri/src/db/repository.rs:3006): `identity_from_probe_hydrate_true_rejects_terminal_tombstone` checks `Conflict` after four revision reads, without inspecting a file.
- [repository.rs:3088](/home/felixb/Projekte/chessfable/src-tauri/src/db/repository.rs:3088): `identity_from_probe_tombstone` verifies an existing tombstone returns `Conflict` before any `AfterOpenCurrent` callback, so it does not depend on the returned type.
- [repository.rs:3130](/home/felixb/Projekte/chessfable/src-tauri/src/db/repository.rs:3130): `identity_from_probe_source_has_no_pool` source-scans the function body to forbid `Pool::builder`, `entry(`, and `repository.connection(`, but does not pin its file type or the other repository consumers.
- [repository.rs:3544](/home/felixb/Projekte/chessfable/src-tauri/src/db/repository.rs:3544): `revision_parent_swap_reads_the_existing_wal_from_the_held_parent` directly opens and drops a probe file only to trigger the hook, then asserts revision, sidecar location, and later identity `Conflict`, without reading that file.
- [repository.rs:3487](/home/felixb/Projekte/chessfable/src-tauri/src/db/repository.rs:3487): `pool_parent_swap_keeps_wal_and_shm_in_held_parent_and_unlinks_them_there` asserts initialization returns `Conflict` after the post-get probe and checks sidecar placement, not the probe file.
- [repository.rs:3828](/home/felixb/Projekte/chessfable/src-tauri/src/db/repository.rs:3828): `leaf_a_to_b_to_a_refusal_is_conflict_and_restores_the_authorized_leaf` checks the identity operation’s `Conflict`, refusal hook, and restored revision, while schema probes consume returned-file metadata internally.
- [repository.rs:3869](/home/felixb/Projekte/chessfable/src-tauri/src/db/repository.rs:3869): `pool_refusal_counter_maps_r2d2_failure_to_conflict_and_retires_entry` checks refusal-count classification and entry retirement, with the classifier short-circuiting before its `open_current` closure.
- [repository.rs:3911](/home/felixb/Projekte/chessfable/src-tauri/src/db/repository.rs:3911): `bound_refusal_keeps_an_unchanged_permission_failure_non_conflict` checks that actual and injected permission `Io` errors pass through instead of the original `InvalidInput`, so it depends only on error classes.
- [platform_support.rs:429](/home/felixb/Projekte/chessfable/src-tauri/src/infra/platform_support.rs:429): `probe_error_caller_rows_keep_the_split_explicit` compacts the source body of `open_current` and asserts its `NotFound|Reparse|WrongKind` mapping to `Conflict`.
- [platform_support.rs:1451](/home/felixb/Projekte/chessfable/src-tauri/src/infra/platform_support.rs:1451): `phase_a_parent_access_predicate_and_call_sites_are_explicit` checks the database operation’s readable-parent policy and that `open_current` contains `ParentAccess::Readable`.
- [platform_support.rs:1668](/home/felixb/Projekte/chessfable/src-tauri/src/infra/platform_support.rs:1668): `phase_a_removed_rows_have_one_ungated_definition_without_refusals` checks one ungated `open_current` definition with no platform refusal branches.
- [platform_support.rs:1707](/home/felixb/Projekte/chessfable/src-tauri/src/infra/platform_support.rs:1707): `phase_c_removed_rows_have_one_ungated_definition_without_refusals` applies the same one-definition/no-refusal source check to `identity_from_probe`.
- [scripts/**](/home/felixb/Projekte/chessfable/scripts): no script has a source-grep match for the requested consumer or hook names; `run-backend-mutation.mjs:73` selects the broader path-authority test module rather than scanning these identifiers.
- [bound_sqlite.rs](/home/felixb/Projekte/chessfable/src-tauri/src/db/bound_sqlite.rs): the requested repository consumer and hook names have no matches there, so its witnesses do not pin `open_current`’s return type.

## Lock witnesses

- [repository.rs:3331](/home/felixb/Projekte/chessfable/src-tauri/src/db/repository.rs:3331): Linux `assert_sqlite_shared_read_lock_is_held` uses a persistent probe descriptor with `F_OFD_GETLK` over SQLite’s shared-byte range; the non-Linux Unix variant at [repository.rs:3345](/home/felixb/Projekte/chessfable/src-tauri/src/db/repository.rs:3345) forks a child and checks with `F_GETLK`.
- [repository.rs:3408](/home/felixb/Projekte/chessfable/src-tauri/src/db/repository.rs:3408): `lock_plain_database` returns a persistent file probe plus an unpooled rusqlite read-only connection that executes `BEGIN` and selects `DataRevision` to hold SQLite’s read lock.
- [repository.rs:3374](/home/felixb/Projekte/chessfable/src-tauri/src/db/repository.rs:3374): Linux `open_descriptor_count` counts `/proc/self/fd` descriptors whose `fstat` identity matches the target inode.
- [repository.rs:3146](/home/felixb/Projekte/chessfable/src-tauri/src/db/repository.rs:3146): `bound_sqlite_witnesses` uses these helpers for bound-open swap, `fstat`/reopen failure, quarantine, and descriptor-retention cases, so those tests currently witness the VFS hooks with plain readers rather than the repository’s pooled `get()` probes or classifier.
- [repository.rs:279](/home/felixb/Projekte/chessfable/src-tauri/src/db/repository.rs:279): a new pooled witness can keep `DatabaseConnection` checked out, run `BEGIN` plus a real `SELECT` through its `DerefMut` Diesel connection, and retain a separate `fs::File` probe for `assert_sqlite_shared_read_lock_is_held`.
- [repository.rs:1053](/home/felixb/Projekte/chessfable/src-tauri/src/db/repository.rs:1053): with that pooled read lock held, a second repository `get()` exercises pre-get and post-get probes; then, using a bound entry and refusal count captured before locking, direct `classify_bound_open_error(..., Error::InvalidInput(...))` exercises the classifier’s `target.open_current().map(drop)` path, and the same persistent probe can assert the lock survives both operations.

The named records align with this gap: [decisions.md:4625](/home/felixb/Projekte/chessfable/tasks/decisions.md:4625) and [decisions.md:4745](/home/felixb/Projekte/chessfable/tasks/decisions.md:4745) cover the bound VFS protections and explicitly leave repository probes as a separate issue; [findings.md:11933](/home/felixb/Projekte/chessfable/tasks/findings.md:11933) names those consumers and proposes the pooled-lock witness. No files were changed and no tests were run.
```

### lens-plan

```text
[blocker] [plan:54](/home/felixb/Projekte/chessfable/tasks/plans/2026-10-01-identity-only-database-probe.md:54), [proof list:178](/home/felixb/Projekte/chessfable/tasks/plans/2026-10-01-identity-only-database-probe.md:178) — O1 requires full-precision mtime, but the proof specifies no assertion that would catch nanoseconds being truncated. The planned replacement test checks identity and length ([plan:114](/home/felixb/Projekte/chessfable/tasks/plans/2026-10-01-identity-only-database-probe.md:114)); meanwhile, `DatabaseSchemaIdentity` stores `SystemTime` ([db/mod.rs:160](/home/felixb/Projekte/chessfable/src-tauri/src/db/mod.rs:160)) and the cache skips validation on equality ([repository.rs:385](/home/felixb/Projekte/chessfable/src-tauri/src/db/repository.rs:385)). A conversion that loses subsecond precision could leave a same-second external modification cached while the listed proof passes. (confidence: 96)

Limitation (confidence: 99): The supplied location correction describes `identity_from_probe` as keeping the returned file for reading, but at this revision `probe_schema` uses it for metadata ([repository.rs:579](/home/felixb/Projekte/chessfable/src-tauri/src/db/repository.rs:579)); `read_revision` opens a separate bound SQLite connection ([repository.rs:596](/home/felixb/Projekte/chessfable/src-tauri/src/db/repository.rs:596)). I found no returned-file reader.

VERDICT: REVISE
```

### lens-minimalism

```text
[nit] tasks/plans/2026-10-01-identity-only-database-probe.md:92 — `entry()` carries initial probe metadata that its caller immediately drops (`repository.rs:1059`). Keep the probe’s success or error, but discard its metadata there; only the post-get metadata feeds schema identity (`repository.rs:384–385`). (confidence: 91)

VERDICT: APPROVED
```

### lens-correctness

```text
[blocker] tasks/plans/2026-10-01-identity-only-database-probe.md:57 — With an accessible parent and a regular database set to mode `000`, `statat` succeeds without read permission ([POSIX `fstatat`](https://www.man7.org/linux/man-pages/man3/fstatat.3p.html)), while the current `open_regular_at(O_RDONLY)` returns `PermissionDenied`. The existing `bound_refusal_keeps_an_unchanged_permission_failure_non_conflict` test asserts that error; after the planned probe succeeds, a failed pool `get()` would instead return its pool error. This contradicts O2’s promise to preserve failure semantics and O3’s promise to preserve error classes (confidence: 96).

VERDICT: REVISE
```

### lens-root-cause

```text
No root-cause gap or prior-fix reintroduction found. The plan replaces leaf-opening probes across the listed repository call chain with Unix metadata lookups, and O4 requires a pooled-lock witness with red-on-revert proof. History shows no earlier fix at these probe sites being undone; the rejected leaf-open pattern is avoided.

VERDICT: APPROVED
```

### lens-tests

```text
[blocker] tasks/plans/2026-10-01-identity-only-database-probe.md:181 — The test command puts `db::` and `infra::` after `--`, where Cargo forwards them to the test binary; its usage places the single `[TESTNAME]` filter before `--`. The listed command therefore does not select the intended suites. Replace it with a valid test invocation or the all-targets backend test gate. (confidence: 98)

[should-fix] tasks/plans/2026-10-01-identity-only-database-probe.md:55 — O1 promises seconds-and-nanoseconds mtime, but the planned metadata assertion checks only identity and length (line 115); the lock witness does not check mtime. A whole-second conversion could pass the listed assertions while missing same-second external modifications and leaving the schema cache stale. Add an assertion for subsecond mtime preservation or invalidation. (confidence: 96)

VERDICT: REVISE
```

### lens-error-handling

```text
VERDICT: APPROVED
```

### lens-code-quality

```text
VERDICT: APPROVED
```

### lens-tauri-security

```text
No findings in this lens at HEAD `0b45dbcd`. As specified, the probe stays relative to the verified parent and preserves single-component validation while avoiding a lockable leaf open. Cross-capability aliases remain a separate, stated non-goal. Read-only review; no proof commands run.

VERDICT: APPROVED
```

### lens-platform-semantics

```text
[should-fix] tasks/plans/2026-10-01-identity-only-database-probe.md:186 — macOS: the listed FreeBSD source probe runs on Linux and cannot exercise the `statat` path or lock witness on macOS/APFS. Require `rust-macos-test` to pass as Phase 1 runtime proof; it is named only in the environment description. (confidence: 98)

[should-fix] tasks/plans/2026-10-01-identity-only-database-probe.md:182 — Windows: the phase changes the probe’s returned metadata, but `pnpm rust:windows:check` is compile-only. Require `rust-windows-test` to pass so the changed Windows path also has runtime coverage. (confidence: 97)

VERDICT: REVISE
```

### lens-pgn-index

```text
NOT APPLICABLE: O1–O5 change database identity probes, metadata flow, and a SQLite lock witness. They do not scan, index, encode, store, or search PGN bytes; PGN descriptor aliases are explicitly out of scope.

VERDICT: APPROVED
```

### lens-plan-r2

```text
PR-01 CLOSED — O1 preserves the read-denial result through effective-ID, no-follow `faccessat`; the supplied probe measured mode `000` as `statat` success, `openat` `EACCES`, and `faccessat` denied, while mode `0600` was allowed. O4 requires the existing `PermissionDenied` test to fail if that check is removed (plan:68,134; `src-tauri/src/infra/fs.rs:4482`; `src-tauri/src/db/repository.rs:3911,3936`).

PR-02 CLOSED — O4 requires exact sub-second mtime equality and a same-second change that fails with whole-second truncation. That matches the current `SystemTime` schema identity and `metadata.modified()` source (plan:130–131; `src-tauri/src/db/mod.rs:163,172`).

PR-04 CLOSED — PROOF 7 requires `rust-macos-test` on the pushed SHA. The workflow runs all Rust targets, and the push instructions wait for the job’s conclusion (plan:209; `.github/workflows/test.yml:54,80`; `.claude/skills/push/SKILL.md:371–372`).

PR-05 CLOSED — PROOF 7 requires `rust-windows-test` on the pushed SHA. That workflow job also runs all Rust targets, and the push instructions wait for its conclusion (plan:209; `.github/workflows/test.yml:82,102`; `.claude/skills/push/SKILL.md:371–372`).

No new in-scope defects found in the delta.

VERDICT: APPROVED
```

### lens-correctness-r2

```text
[blocker] [tasks/plans/.plan-2026-10-01-identity-only-database-probe.md-r2.body.md:67](/home/felixb/Projekte/chessfable/tasks/plans/.plan-2026-10-01-identity-only-database-probe.md-r2.body.md:67) — If the authorized regular file is mode `000`, `statat` captures its identity, then a writer replaces the leaf with a symlink before `faccessat`, the measured no-follow access check returns true for the symlink. O1 then returns the old file’s metadata and O2 accepts its authorized identity, although the probe never confirmed that the returned file was readable or that the current leaf was regular. The existing `O_NOFOLLOW` open would classify that replacement as `Conflict`. The access result and returned metadata need to be bound to the same leaf. (confidence: 93)

PR-01 CLOSED — The unchanged-file permission failure is covered by the no-follow effective-ID read check and the existing `PermissionDenied` test; the supplied atlas probe measured mode `000` denied and `0600` allowed. The race above is a separate defect.

PR-02 CLOSED — O4 specifies exact sub-second mtime equality and a same-second change assertion, both intended to fail on whole-second truncation.

PR-04 CLOSED — Phase 1 PROOF requires `rust-macos-test` green on the pushed SHA; the workflow runs `cargo test --all-targets` on macOS.

PR-05 CLOSED — Phase 1 PROOF requires `rust-windows-test` green on the pushed SHA; the workflow runs `cargo test --all-targets` on Windows.

VERDICT: REVISE
```

### lens-tests-r2

```text
PR-01 CLOSED — O1 preserves the unreadable-file error with an effective-ID access check; the existing permission test expects `PermissionDenied`, and PROOF 6 requires it to fail if that check is removed ([plan](</home/felixb/Projekte/chessfable/tasks/plans/.plan-2026-10-01-identity-only-database-probe.md-r2.body.md:63>), [repository.rs](/home/felixb/Projekte/chessfable/src-tauri/src/db/repository.rs:3911)).

PR-02 CLOSED — O4 compares probe mtime with filesystem metadata and requires two probes around a same-second change to differ; PROOF 6 names truncation to whole seconds as a red-on-revert case ([plan](</home/felixb/Projekte/chessfable/tasks/plans/.plan-2026-10-01-identity-only-database-probe.md-r2.body.md:127>)).

PR-04 CLOSED — PROOF 7 names the macOS test job; it runs `cargo test --all-targets`, including the Unix lock witness’s non-Linux variant ([plan](</home/felixb/Projekte/chessfable/tasks/plans/.plan-2026-10-01-identity-only-database-probe.md-r2.body.md:208>), [test.yml](/home/felixb/Projekte/chessfable/.github/workflows/test.yml:54)).

PR-05 CLOSED — PROOF 7 names the Windows test job, which also runs `cargo test --all-targets` ([plan](</home/felixb/Projekte/chessfable/tasks/plans/.plan-2026-10-01-identity-only-database-probe.md-r2.body.md:208>), [test.yml](/home/felixb/Projekte/chessfable/.github/workflows/test.yml:82)).

VERDICT: APPROVED
```

### lens-platform-semantics-r2

```text
No platform-semantics findings. The four review issues are closed at the **plan level**; their implementation proofs have not run.

- **PR-01 CLOSED** — O1 keeps the read-permission check after the no-follow kind check. The recorded Linux probe says: `mode 000 → statat succeeds; openat(O_RDONLY) → EACCES; faccessat(R_OK, eaccess, nofollow) → denied; mode 0600 → allowed.` Apple’s [Darwin header](https://github.com/apple/darwin-xnu/blob/main/bsd/sys/fcntl.h) defines both flags, and the [XNU syscall table](https://github.com/apple-oss-distributions/xnu/blob/main/bsd/kern/syscalls.master) declares `faccessat` with a flags argument. The planned macOS runtime check is `rust-macos-test` ([plan:67](</home/felixb/Projekte/chessfable/tasks/plans/.plan-2026-10-01-identity-only-database-probe.md-r2.body.md:67>), [plan:208](</home/felixb/Projekte/chessfable/tasks/plans/.plan-2026-10-01-identity-only-database-probe.md-r2.body.md:208>)).
- **PR-02 CLOSED** — O4 asserts exact `SystemTime` equality and detects a same-second mtime change; the proof also requires a red-on-revert for whole-second truncation ([plan:127](</home/felixb/Projekte/chessfable/tasks/plans/.plan-2026-10-01-identity-only-database-probe.md-r2.body.md:127>), [plan:204](</home/felixb/Projekte/chessfable/tasks/plans/.plan-2026-10-01-identity-only-database-probe.md-r2.body.md:204>)).
- **PR-04 CLOSED** — PROOF 7 requires `rust-macos-test` to pass on the pushed SHA ([plan:208](</home/felixb/Projekte/chessfable/tasks/plans/.plan-2026-10-01-identity-only-database-probe.md-r2.body.md:208>)).
- **PR-05 CLOSED** — PROOF 7 requires `rust-windows-test` to pass on the pushed SHA ([plan:209](</home/felixb/Projekte/chessfable/tasks/plans/.plan-2026-10-01-identity-only-database-probe.md-r2.body.md:209>)). The Windows path retains handle-based probing; Microsoft documents that a second handle cannot access a range locked through the first until it is unlocked ([LockFileEx](https://learn.microsoft.com/en-us/windows/win32/api/fileapi/nf-fileapi-lockfileex)).

**Proof status:** No implementation diff exists at HEAD. The FreeBSD cfg source probe ([plan:206](</home/felixb/Projekte/chessfable/tasks/plans/.plan-2026-10-01-identity-only-database-probe.md-r2.body.md:206>)), `pnpm rust:windows:check` ([plan:202](</home/felixb/Projekte/chessfable/tasks/plans/.plan-2026-10-01-identity-only-database-probe.md-r2.body.md:202>)), and CI jobs have not run in this review. The Windows check is a GNU-target compile/lint check; it is not runtime proof. The planned macOS and Windows test jobs provide that runtime evidence after push.

VERDICT: APPROVED
```

### lens-plan-r3

```text
[blocker] tasks/plans/.plan-2026-10-01-identity-only-database-probe.md-r3.body.md:74 — PR-08 NOT CLOSED — if authorized inode A is unreadable, a local writer can replace its name with a symlink for the no-follow `faccessat`, then restore A before the second stat. The plan records that the access check allows a symlink (lines 70–71); matching endpoint identities then return A’s metadata without checking A’s read permission (lines 79–81). The current path opens with `O_RDONLY | O_NOFOLLOW` at `src-tauri/src/infra/fs.rs:4475-4498`, and the mode-000 measurement at plan lines 68–70 shows that open is denied. O4’s hook runs after the access check, so its cases do not exercise this access-on-symlink and restore interval (lines 140–142). (confidence: 98)

[blocker] tasks/plans/.plan-2026-10-01-identity-only-database-probe.md-r3.body.md:224 — The round-three assignment omits the required `## Re-review` block with `ROUND/DELTA/REVISED/SETTLED`. The review record confirms round two left PR-08 open (`tasks/plans/2026-10-01-identity-only-database-probe.md:248-255`); the contract requires that block for rounds ≥2 and an explicit closure check for substantive corrections (`/home/felixb/.claude/references/review-lens-contract.md:236-268`). I cannot reconstruct it or claim scoped closure. (confidence: 100)

VERDICT: REVISE
```

### lens-correctness-r3

```text
PR-08 CLOSED — evidence: O1’s second stat detects a persistent symlink or changed inode, and O2 maps those changes to `Conflict` after checking the authorized identity. O4 pins both swap cases between the access check and second stat. The acknowledged A→B→A case restores the authorized inode before that stat and is outside the frozen threat model.

VERDICT: APPROVED
```

### lens-plan-r4

```text
PR-09 CLOSED — the round-4 prompt includes `ROUND`, `DELTA`, `REVISED`, and `SETTLED` plus the required reporting order.

LATE OBSERVATIONS

[should-fix] `/home/felixb/Projekte/chessfable/tasks/plans/.plan-2026-10-01-identity-only-database-probe.md-r4.body.md:152` — O5 says `repository.rs` has source scans naming `open_current`. The cited scan at `src-tauri/src/db/repository.rs:3133` searches for `identity_from_probe`; it does not pin `open_current`. Remove or correct that work item. (confidence: 99)

VERDICT: APPROVED
```

### lens-correctness-d1

```text
[blocker] src-tauri/src/infra/fs.rs:4518 — On Linux 5.4, the default `rustix` 1.1.4 `linux_raw` backend gets `ENOSYS` when `faccessat2` is unavailable and it cannot fall back for the combined `AT_EACCESS | AT_SYMLINK_NOFOLLOW` flags. The probe propagates that error for readable regular files, so database connections and identity checks fail where the previous open succeeded. [Pinned Rustix implementation](https://github.com/bytecodealliance/rustix/blob/v1.1.4/src/backend/linux_raw/fs/syscalls.rs#L1405-L1451), [Rustix 1.1.4 backend documentation](https://docs.rs/crate/rustix/1.1.4) (confidence: 97)

VERDICT: REVISE
```

### lens-root-cause-d1

```text
[should-fix] src-tauri/src/infra/path_authority/resolved.rs:860 — The diff removes leaf opens from database identity probes, but an authorized PGN path can still open and retain a regular file here; `pgn_snapshot` clones that descriptor at lines 472–479. If the PGN is a hard-link alias of a pooled database, closing either descriptor can release SQLite’s process-associated lock while the pooled connection remains live. The supplied persistent `F_OFD_GETLK` probe observed the lock disappear after a second plain descriptor was opened and closed. This is the separately filed P9 alias path, outside O1–O5: the direct `get()` and classifier trigger is fixed, but lock survival across aliased readers is not (confidence: 86).

VERDICT: APPROVED
```

### lens-tests-d1

```text
[should-fix] src-tauri/src/db/repository.rs:3457 — The classifier witness would still pass if `classify_bound_open_error` skipped its probe closure: it expects the original simulated error, and the lock remains held either way. No assertion catches the unchanged-refusal path failing to map a swapped leaf to `Conflict`. (confidence: 90)

VERDICT: APPROVED
```

### lens-error-handling-d1

```text
[should-fix] src-tauri/src/infra/fs.rs:4518 — The accepted R4 race can lose the permission error: on Linux, `AT_SYMLINK_NOFOLLOW` checks the symlink itself ([faccessat(2)](https://man7.org/linux/man-pages/man2/access.2.html)); if unreadable file A is replaced by a symlink for this check and restored before the second stat, the probe can return `Ok`. If that happens in the classifier probe after a pool open fails, `classify_bound_open_error_result` returns the original `Error::R2d2` ([repository.rs](/home/felixb/Projekte/chessfable/src-tauri/src/db/repository.rs:1191)), serialized as category `Database` and message “database failure” ([error.rs](/home/felixb/Projekte/chessfable/src-tauri/src/error.rs:170)), instead of `PermissionDenied`. The operation fails closed, but the actionable cause is lost (confidence: 86).

VERDICT: APPROVED
```

### lens-code-quality-d1

```text
[blocker] src-tauri/src/db/repository.rs:3881 — `after_open` is captured by the `after_probe_current` callback below, and probe-hook counters still use names like `opens` and `observed_opens` (for example, lines 2888 and 2909). They describe the former open event, obscuring which boundary these tests exercise; plan O3 requires probe observer names to reflect that they observe probes. (confidence: 99)

VERDICT: REVISE
```

### lens-minimalism-d1

```text
[nit] src-tauri/src/db/repository.rs:581 — `probe_schema` rechecks the identity already enforced by `DatabaseFileTarget::probe_current` at `path_authority/mod.rs:846`; `DatabaseSchemaIdentity::from_probe` copies that same identity. Remove the four-line guard (confidence: 95)

VERDICT: APPROVED
```

### lens-tauri-security-d1

```text
No qualifying security findings.

Unix database probes use parent-relative no-follow metadata calls and verify the same regular-file identity before returning metadata ([fs.rs](/home/felixb/Projekte/chessfable/src-tauri/src/infra/fs.rs:4505), [path_authority/mod.rs](/home/felixb/Projekte/chessfable/src-tauri/src/infra/path_authority/mod.rs:812)). The repository’s metadata-only callers and classifier use the probe; the witness checks lock survival after pooled access, identity probes, and classification ([repository.rs](/home/felixb/Projekte/chessfable/src-tauri/src/db/repository.rs:3419)).

The plan’s R4 permission-classification residual is explicitly accepted. This diff does not change token/session flows, signed-download verification, or archive and recursive-deletion paths; those classes are not implicated. I did not run tests in this read-only review.

VERDICT: APPROVED
```

### lens-platform-semantics-d1

```text
[should-fix] src-tauri/src/infra/fs.rs:4518 — On Linux kernels before 5.8, this flagged access check returns `ENOSYS` even for readable files. ChessFable uses Rustix 1.1.4 (`src-tauri/Cargo.toml:81`); its Linux backend requires `faccessat2` for these flags and falls back only for no flags or `EACCESS` alone (`rustix-1.1.4/src/backend/linux_raw/fs/syscalls.rs:1418-1437`). The probe propagates that error as `Other`, so database access fails on those kernels. The kernel 7.0 evidence does not cover this case. (confidence: 98)

Proof recorded: the listed local gates passed, including `pnpm rust:windows:check` (compile only). The FreeBSD source probe covered `repository.rs` and `bound_sqlite.rs`, but not the changed `fs.rs` and `path_authority/mod.rs` branches. Runtime proof for macOS and Windows remains the `rust-macos-test` and `rust-windows-test` CI jobs; no results were supplied.

VERDICT: REVISE
```

### lens-pgn-index-d1

```text
[blocker] src-tauri/src/infra/fs.rs:4518 — Probing any regular database file on Linux without `faccessat2` (notably kernels before 5.8) sends both `EACCESS` and `SYMLINK_NOFOLLOW` to Rustix 1.1.4’s `linux_raw` backend. Its fallback accepts only empty flags or exactly `EACCESS`, then returns `ENOSYS` for this combination (`rustix-1.1.4/src/backend/linux_raw/fs/syscalls.rs:1418-1451`); the probe error propagates, breaking database access. (confidence: 98)

VERDICT: REVISE
```

### lens-correctness-d2

```text
D-01 CLOSED — In rustix 1.1.4’s `linux_raw` backend, `AT_EACCESS` alone uses the plain `faccessat` fallback when real and effective IDs match. The repaired call now passes exactly that flag, avoiding `ENOSYS` on older Linux under that condition. Source: `rustix-1.1.4/src/backend/linux_raw/fs/syscalls.rs:1405–1451`.

[blocker] src-tauri/src/infra/fs.rs:4520 — For an unprivileged process, if readable authorized file A is briefly replaced by a symlink to unreadable file B during this access check, then A is restored before the second stat, the `EACCESS`-only call follows the link and returns `EACCES`. The second stat sees A’s original identity, so the probe rejects a readable database with `PermissionDenied`. This is distinct from the accepted R4 case: here A is readable and the transient target is unreadable. Linux documents that access checks follow symlinks unless `AT_SYMLINK_NOFOLLOW` is set. [access(2)](https://man7.org/linux/man-pages/man2/access.2.html) (confidence: 89)

VERDICT: REVISE
```

### lens-pgn-index-d2

```text
D-01 CLOSED — evidence: rustix 1.1.4 falls back to plain `faccessat` for `AT_EACCESS` when real and effective UIDs and GIDs match ([syscalls.rs:1441](/home/felixb/.cargo/registry/src/index.crates.io-1949cf8c6b5b557f/rustix-1.1.4/src/backend/linux_raw/fs/syscalls.rs:1441)). The repair passes only `AT_EACCESS` ([fs.rs:4520](/home/felixb/Projekte/chessfable/src-tauri/src/infra/fs.rs:4520)); the surrounding no-follow `statat` checks remain.

No additional in-scope repair-delta defects found.

VERDICT: APPROVED
```

### lens-platform-semantics-d2

```text
D-01 CLOSED — evidence: [fs.rs:4520](/home/felixb/Projekte/chessfable/src-tauri/src/infra/fs.rs:4520) now passes only `AtFlags::EACCESS`. Rustix 1.1.4’s Linux raw backend falls back to plain `faccessat` after `faccessat2` returns `ENOSYS` when the flags are exactly `AT_EACCESS` and real and effective IDs match ([syscalls.rs:1418](/home/felixb/.cargo/registry/src/index.crates.io-1949cf8c6b5b557f/rustix-1.1.4/src/backend/linux_raw/fs/syscalls.rs:1418)). The surrounding `statat` checks still verify file kind and stable identity ([fs.rs:4512](/home/felixb/Projekte/chessfable/src-tauri/src/infra/fs.rs:4512)). The fallback does not cover differing real and effective IDs.

No repair-delta platform defect found. The added rename test retains parent descriptors, not a leaf handle, so it does not trigger Windows’ leaf-handle rename restriction ([repository.rs:4014](/home/felixb/Projekte/chessfable/src-tauri/src/db/repository.rs:4014), [bound_sqlite.rs:225](/home/felixb/Projekte/chessfable/src-tauri/src/db/bound_sqlite.rs:225)).

The supplied green `pnpm checks:pre-review` at `78766420` includes `pnpm rust:windows:check` for Rust changes; that is compile-only ([run-push-gates.mjs:88](/home/felixb/Projekte/chessfable/scripts/run-push-gates.mjs:88)). No FreeBSD source-probe result for this diff is recorded in the supplied evidence or build ledger. No macOS or Windows runtime result is supplied; those require CI’s `rust-macos-test` and `rust-windows-test` jobs.

VERDICT: APPROVED
```

### lens-tests-d2

```text
D-06 CLOSED — `bound_open_error_checks_the_probe_when_refusal_count_is_unchanged` captures the refusal count, swaps the authorized leaf, and calls the real classifier. Its `Conflict` assertion fails if the classifier’s probe closure is replaced with `|| Ok(())`; restoring the leaf must preserve the original error. The `db::` test is selected by the reported `cargo test -- db:: infra::` command.

[blocker] src-tauri/src/infra/fs.rs:4518 — The pre-5.8 fallback repair has no test that would fail if `SYMLINK_NOFOLLOW` were added back. The reported Linux run used kernel 7.0, where `faccessat2` accepts both flags; CI’s Rust test jobs run on macOS and Windows. Reverting the flag change could therefore leave those tests green while Linux kernels before 5.8 return `ENOSYS` and database probes fail. (confidence: 92)

VERDICT: REVISE
```

### lens-minimalism-d2

```text
D-04 CLOSED — evidence: `DatabaseFileTarget::probe_current` checks the parent and `metadata.identity == self.identity` before returning ([path_authority/mod.rs](/home/felixb/Projekte/chessfable/src-tauri/src/infra/path_authority/mod.rs:840), [path_authority/mod.rs](/home/felixb/Projekte/chessfable/src-tauri/src/infra/path_authority/mod.rs:846)). The repository probe delegates to it, so `probe_schema` now converts already-validated metadata; the removed guard duplicated the same identity check ([repository.rs](/home/felixb/Projekte/chessfable/src-tauri/src/db/repository.rs:1003), [repository.rs](/home/felixb/Projekte/chessfable/src-tauri/src/db/repository.rs:579)).

No bloat or duplication defect found in the repair delta. The added classifier witness covers both changed and restored leaves with an unchanged refusal count.

VERDICT: APPROVED
```

### lens-code-quality-d2

```text
D-02 CLOSED — evidence: probe counters and callbacks use probe terminology throughout [repository.rs](/home/felixb/Projekte/chessfable/src-tauri/src/db/repository.rs:1864); no old open-named observer matches remain.

[nit] src-tauri/src/infra/fs.rs:4518 — “no flagged faccessat fallback” is imprecise: the cited rustix fallback supports `AT_EACCESS` alone, which this call uses. Say that adding `AT_SYMLINK_NOFOLLOW` requires `faccessat2` on Linux before 5.8 (confidence: 86)

VERDICT: APPROVED
```

### lens-plan-judgment

```text
JUDGMENT: (a) — keep the EACCESS-only stat sandwich and name cases 1 and 3 as error-reporting limits under the frozen guarantee.

[fs.rs:4512–4536](/home/felixb/Projekte/chessfable/src-tauri/src/infra/fs.rs:4512) checks identity with no-follow stats around access and returns `Conflict` when the two observed identities differ. The ordinary unreadable-file behavior is pinned at [repository.rs:3948](/home/felixb/Projekte/chessfable/src-tauri/src/db/repository.rs:3948). Case 1 can still defer `PermissionDenied` into a later SQLite or pool error during the race; it remains fail-closed under the stated contract.

Linux’s descriptor-bound `faccessat2` route cannot cover kernels before 5.8: both `faccessat2` and `AT_EMPTY_PATH` date from 5.8. Rustix 1.1.4 documents its pre-5.8 fallback for EACCESS alone, and its source returns `ENOSYS` for other unsupported flag combinations. ([Linux `access(2)`](https://man7.org/linux/man-pages/man2/access.2.html), [rustix 1.1.4 `accessat`](https://docs.rs/rustix/1.1.4/rustix/fs/fn.accessat.html))

An O_PATH plus `/proc/self/fd` fallback is a possible Linux-specific path, but depends on procfs; the repository’s existing bound-open path explicitly fails closed when `/proc` is unavailable ([decision d-20260930-10](/home/felixb/Projekte/chessfable/tasks/decisions.md:4745)). It does not provide a shared macOS solution. There, `fstatat` supplies metadata, not the read-access result; no source-verified, descriptor-free primitive removes both races across the stated platforms.

Retrying only after access failure misses case 1 because that access can succeed. Deriving access from mode bits would lose ACL-aware behavior; Linux documents that its old `fstatat`-based flag emulation did not account for ACLs. ([Linux `access(2)`](https://man7.org/linux/man-pages/man2/access.2.html))

Limitation: no macOS runtime probe was available; the platform conclusion is source-based (confidence: 85%).

VERDICT: APPROVED
```

### lens-correctness-d3

```text
D-07 CLOSED — `probe_regular_file_at` still brackets `accessat(..., AtFlags::EACCESS)` with no-follow identity checks ([fs.rs](/home/felixb/Projekte/chessfable/src-tauri/src/infra/fs.rs:4512)); the supplied evidence shows adding `SYMLINK_NOFOLLOW` fails the pin. No new evidence reopens the accepted error-reporting residual.

No repair-delta correctness defects found.

VERDICT: APPROVED
```

### lens-tests-d3

```text
D-08 CLOSED — The exact `AT_EACCESS` call is asserted in [platform_support.rs](/home/felixb/Projekte/chessfable/src-tauri/src/infra/platform_support.rs:343), and the reported `SYMLINK_NOFOLLOW` mutation made that assertion fail. The Rust all-targets gate runs this test.

No repair-delta verification defects found.

VERDICT: APPROVED
```

### lens-code-quality-d3

```text
D-09 CLOSED — evidence: rustix 1.1.4 documents that pre-5.8 `faccessat` lacks flag support, and its Linux implementation returns `NOSYS` when `faccessat2` is unavailable and `AT_SYMLINK_NOFOLLOW` prevents the `AT_EACCESS` fallback. The replacement comment states that limitation accurately.

VERDICT: APPROVED
```
