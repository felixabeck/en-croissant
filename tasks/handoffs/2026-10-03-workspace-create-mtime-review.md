Finding: f-20260913-02

## Reviews

Round 1 wall time is `plan-meta.json` `review.per_round_seconds`. Twelve plan-capable lenses. `review-code-quality` and `review-root-cause` are `plan-review: false` and were not launched. No quota wait.

Raw verdicts, unchanged:

* chess-semantics APPROVED. `NOT APPLICABLE: The files and mandate concern filesystem modification-time observations; they do not involve an in-memory chess tree, position, or move path.`
* correctness APPROVED. No findings.
* engine-protocol APPROVED. `NOT APPLICABLE: The plan concerns filesystem timestamps and release-surface checks; it does not touch engine processes, UCI state, or asynchronous engine-result routing.`
* error-handling APPROVED. No findings.
* ipc-contract APPROVED. No IPC-contract defects. `lastModified` stays a signed Unix-seconds value.
* minimalism REVISE. One finding, M6.
* persisted-state APPROVED. `NOT APPLICABLE: The plan concerns Rust filesystem modification-time observations and release-surface checks; it has no renderer state, storage keys, or tab lifecycle.`
* pgn-index APPROVED. `NOT APPLICABLE: The plan concerns filesystem metadata for workspace creation; it does not touch PGN scanning, indexing, encoding, or searching.`
* plan REVISE. Two findings, M1 and M2.
* platform-semantics REVISE. Three findings, M5, M1, M4.
* tauri-security APPROVED. No findings.
* tests REVISE. Four findings, M3, M1, M2, M4.

### M1 — Fallback seconds have no witness

* **Claim:** The file witness never injects `PostRenameMetadata`, so the promised fallback seconds can be missing and the proof stays green. The sentence "rename does not change mtime" was not measured.
* **Witnesses:** plan r1 finding 1 (blocker); platform-semantics r1 finding 2 (should-fix); tests r1 finding 2 (should-fix).
* **Evidence:** `infra/fs.rs:902-913` saves `fallback_metadata` before rename. `infra/fs.rs:940-949` returns that identity and ctime on post-rename metadata failure, with `CommittedDurabilityUncertain`. `infra/fs.rs:9021-9047` asserts outcome, identity, and bytes, not seconds. No unix test injects `PostRenameMetadata`.
* **MANDATE:** the open question forbids turning a post-commit metadata failure into an error after the durable commit, and the returned seconds must name the installed inode.
* **Disposition:** Fix. The success path returns the post-rename fstat. The failure path returns the pre-rename fstat of the same descriptor. The plan no longer claims those readings match. Verification adds the fault witness, including a pre-epoch mtime, on Unix and Windows.
* **Authority:** MANDATE open question, third option rejected; fallback is the first option's failure branch already in the traced install.
* **Closure:** round 2.

### M2 — Windows directory seconds are unproved

* **Claim:** The file helper and the Unix race do not exercise the Windows directory observation. A raw FILETIME could pass every stated witness.
* **Witnesses:** plan r1 finding 2 (blocker); tests r1 finding 3 (should-fix).
* **Evidence:** Windows `entry_identity_at` (`infra/fs.rs:3107-3113`) returns only `(u64, u64)` from `opened_file_identity`. `windows_identity_is_read_from_the_retained_handle` (`platform_support.rs:937-951`) checks that call and not the conversion. Enumeration converts with `filetime_to_unix_seconds` (`infra/fs.rs:3049`).
* **MANDATE:** both create paths, on the environments the threat model names, return the installed object's listing seconds.
* **Disposition:** Fix. Directory create uses one observation that returns identity and seconds. A source pin requires `filetime_to_unix_seconds` in that Windows body. A `#[cfg(windows)]` create test compares `last_modified` to the enumerator. `rust-windows-test` runs it.
* **Authority:** MANDATE "both create paths" and the threat-model sentence that Windows counts.
* **Closure:** round 2.

### M3 — The directory race hook is too late to prove one observation

* **Claim:** `WORKSPACE_CREATED_CHILD_PRE_REGISTER_HOOK` runs after `entry_identity_at` has returned. Two lookups before registration can return seconds for a different object while that test passes.
* **Witnesses:** tests r1 finding 1 (blocker).
* **Evidence:** `create_workspace_directory_inner` calls `entry_identity_at` at `file_workspace.rs:966` and then `register_created_entry` at `:967`. The hook is inside registration at `:257-261`.
* **MANDATE:** the seconds and the registered identity name the same installed object. The open question's pathname window is the defect.
* **Disposition:** Fix. Directory create calls one function once and does not also call `entry_identity_at`. A unix hook inside that observation, after the copy and before return, swaps the directory. Identity and seconds must both be the pre-swap object. The pre-register hook stays as the witness that nothing restats after that point. No Windows hook.
* **Authority:** MANDATE defect (a rename returns a different object's mtime) plus the plan's own "one stat" sentence, which the round-1 witness did not enforce.
* **Closure:** round 2.

### M4 — An out-of-range Windows tick word has no defined result

* **Claim:** "Must not panic" does not say what a `u64` tick word outside `i64` becomes, and the pre-epoch witness uses a value that fits.
* **Witnesses:** platform-semantics r1 finding 3 (should-fix); tests r1 finding 4 (should-fix).
* **Evidence:** `filetime_to_unix_seconds` takes `i64` (`infra/fs.rs:2850-2854`). Enumeration stores `header.LastWriteTime` as `i64` (`infra/fs.rs:2938`). The handle metadata path reads `last_write_time()` as `u64` (`infra/fs.rs:3761`). `windows_filetime_ticks_become_unix_seconds` pins `filetime_to_unix_seconds(-1)` (`infra/fs.rs:8659`).
* **MANDATE:** create and a later listing of an untouched file report the same integer. The enumerator already interprets the tick bits as `i64`.
* **Disposition:** Fix. The create path passes those bits to `filetime_to_unix_seconds` as `i64`, including the high bit. It does not saturate or error. The witness covers a fitting pre-epoch value and `u64::MAX`.
* **Authority:** the decided contract that create seconds equal the enumerator's seconds. A saturating converter would be a second conversion.
* **Closure:** round 2.

### M5 — Platform proof jobs were unnamed

* **Claim:** Host tests and the surface gate do not prove Windows or macOS, and the plan omitted `pnpm rust:windows:check` and the FreeBSD probe.
* **Witnesses:** platform-semantics r1 finding 1 (should-fix).
* **Evidence:** Push skill names `pnpm rust:windows:check` at `.claude/skills/push/SKILL.md:108` as the local compile, and `rust-windows-test`, `rust-macos-test`, and `rust-platform` at `:376` as the jobs this machine cannot run. The new reads sit on the existing `cfg(unix)` fstat (`infra/fs.rs:1759-1767`) and `cfg(windows)` metadata (`infra/fs.rs:3758-3766`). `AtomicInstalledFile` and `TempMetadata` literals are in shared or cfg-split adapters already compiled on Linux (`infra/fs.rs:944`, `:957`, `:969`, `:1763`, `:3763`, `:4936`). This change adds no `target_os = "linux"` branch.
* **Disposition:** Fix. PROOF includes `pnpm rust:windows:check`. The plan names the three CI jobs. The FreeBSD probe is not applicable unless an edit adds a `target_os = "linux"` branch; the plan forbids that branch. No new probe harness.
* **Authority:** the lens's platform-proof rule, which is the verification level for the threat model's Unix and Windows environments. Not a new CI mechanism.
* **Closure:** round 2.

### M6 — Baseline pin would duplicate the credentials test

* **Claim:** A second "left the baseline" test copies the `credentials.rs` assertions.
* **Witnesses:** minimalism r1 finding 1 (should-fix).
* **Evidence:** `scripts/check-rust-release-surface-core.test.mjs:395-398` is one test with two expects. The obligation is that `file_workspace.rs` stays off the allowlist and the counts object.
* **Disposition:** Fix, carried to CR-1. One assertion covers both paths. The obligation's contract is unchanged.
* **Closure:** carried, CR-1. Not a plan-level adoption.

Opened 6, resolved this round 1 (M6 carried), open for closure 5 (M1–M5). Adopted this round: 5. Carried: 1. No Skip, Defer, or withdrawal. No correction-introduced issue yet. Round 2 reviews plan, platform-semantics, and tests.

### Round 2

Raw verdicts, unchanged:

* plan REVISE. Closed M1, M2, M3, M4, M5. One new finding, M7.
* platform-semantics REVISE. Closed M1, M3, M4, M5. M2 NOT CLOSED.
* tests REVISE. Closed M1, M2, M4, M5. M3 NOT CLOSED. One new finding, M8.

M1, M4, and M5 are closed by every lens that witnessed them. Their round-1 closure lines stand. M2 and M3 stay open: a lens that did not close them overrides a lens that did. M6 stays carried as CR-1 and was not re-reviewed.

### M2 — Windows directory seconds are unproved (round 2 residual)

* **Claim:** The cited pin at `platform_support.rs:948` checks only `opened_file_identity`. A normal Windows create cannot catch a second time lookup after the identity observation.
* **Witnesses:** platform-semantics r2 finding 1 (should-fix). Lineage: M2. Prior witnesses remain plan r1 finding 2 and tests r1 finding 3.
* **Evidence:** `windows_identity_is_read_from_the_retained_handle` (`platform_support.rs:937-951`) asserts `opened_file_identity` and nothing else. Windows `entry_identity_at` (`infra/fs.rs:3107-3113`) is one `open_expected_child` plus `opened_file_identity`, and it returns no seconds. Confirmed by reading both bodies. This is the first failure of this lineage.
* **MANDATE:** both create paths return the installed object's listing seconds from the same observation as the registered identity.
* **Disposition:** Fix. The seconds pin is a new assertion, not the existing identity loop. The observation body contains `opened_file_identity`, `filetime_to_unix_seconds`, and exactly one `open_expected_child`. The identity loop's `entry_identity_at` signature moves onto that body. `create_workspace_directory_inner` calls the observation once and does not call `entry_identity_at`. No Windows swap hook.
* **Authority:** the same MANDATE obligation as round 1. The correction changes the verification contract of that obligation. It adds no rollback and no second production lookup.
* **Closure:** open. Round 3 checks it. Round 2 cannot close it.

### M3 — The directory race hook is too late to prove one observation (round 2 residual)

* **Claim:** A hook that runs after identity and seconds are copied never injects a swap between two earlier lookups, so both assertions can pass.
* **Witnesses:** tests r2 finding 1 (blocker). Lineage: M3. Prior witness remains tests r1 finding 1.
* **Evidence:** The round-1 correction put the hook after the copy. Unix `entry_identity_at` (`infra/fs.rs:4416`) is one `rfs::statat` followed by `raw_stat_identity`. Confirmed by reading that body. This is the first failure of this lineage.
* **MANDATE:** the seconds and the registered identity name the same installed object.
* **Disposition:** Fix. The hook is the next statement after the observation's single `statat` and before either value is derived. The returned pair is built only from that `stat`. A source pin counts `statat` in that braced body and fails unless the count is one. The pre-register hook stays. No Windows hook.
* **Authority:** the same MANDATE defect as round 1. The failed placement did not enforce one syscall.
* **Closure:** open. Round 3 checks it. Round 2 cannot close it.

### M7 — Deleting `timestamp` leaves the listing-shape test calling it

* **Claim:** Cleanup names only `timestamps_and_durability_outcomes_remain_renderer_safe`. `collect_tree_entries_lists_the_workspace_shape_on_every_platform` also calls `timestamp`, so `cargo test --lib file_workspace` does not compile.
* **Witnesses:** plan r2 finding 1 (blocker).
* **Evidence:** `file_workspace.rs:3327` and `:3348` compare listed `last_modified` to `timestamp(...)`. Confirmed by reading the test. The durability call at `:3192` was already named.
* **MANDATE:** `timestamp` is deleted, and the phase proof includes `cargo test --lib file_workspace`. The listing comparisons are the coverage that deletion must keep.
* **Disposition:** Fix. Both listing assertions stay and compare `last_modified` to the enumerator's whole seconds. They do not call `timestamp` and do not use `duration_since`. A test-only read is not a production pathname reach.
* **Authority:** the plan's own delete-`timestamp` obligation plus a red phase proof. Not a listing-bounds change (`f-20260913-06` stays out).
* **Closure:** open. Round 3 checks it.

### M8 — Pre-epoch coverage stops at the helper

* **Claim:** The pre-epoch assertion is on `atomic_replace_at_identified`. A caller that clamps or rejects a negative `WorkspaceEntry.last_modified` still passes.
* **Witnesses:** tests r2 finding 2 (blocker).
* **Evidence:** The file success witness stops at `modified_seconds`. `create_workspace_directory_inner` assigns `last_modified` at `file_workspace.rs:1000` from `timestamp`, which rejects pre-1970. `collect_tree_entries_lists_a_pre_epoch_entry_with_its_negative_timestamp` (`file_workspace.rs:5095`) lists an existing file and does not call either create path. Confirmed by reading that test's opening.
* **MANDATE:** a pre-1970 time is a negative `i64` on the value the create response returns, not `Error::InvalidInput`.
* **Disposition:** Fix. Both `create_workspace_file` and `create_workspace_directory` return a negative `last_modified` equal to the enumerator's seconds. The helper witness stays and does not replace this one.
* **Authority:** the decided contract that create seconds equal the enumerator's seconds, including a negative value. Not a new numeric formula.
* **Closure:** open. Round 3 checks it.

Opened this round: M7, M8. Re-opened: M2, M3 (first failure each). Closed this round: M1, M4, M5. Adopted this round: 4 (M2, M3, M7, M8). Carried unchanged: M6. No Skip, Defer, or withdrawal. Round 3 reviews plan, platform-semantics, and tests.

### Round 3

Raw verdicts, unchanged:

* plan APPROVED. Closed M2, M3, M7, M8. No bracketed findings.
* platform-semantics REVISE. Closed M2, M3, M7. M8 NOT CLOSED.
* tests REVISE. Closed M7, M8. M2 NOT CLOSED. M3 NOT CLOSED.

M7 is closed by plan, platform-semantics, and tests. M2 and M3 failed closure a second time (tests). Patching the source-count pin stops. A fresh-context review-plan judgment (`probe-1-r3`) recorded the mechanism below. M8 failed closure once (platform) and is corrected, not carried.

Judgment, `probe-1-r3`: the one-observation obligation stays. Identifier counts do not prove it, because a helper hides a second lookup. Diff review traces the observation and its helpers and rejects a second name lookup that supplies either value. That check is CR-2. The unix hook stays and its limit is stated. The directory pre-epoch witness needs a `cfg(test)` hook after `create_dir_at` succeeds and before the observation begins. No Windows swap hook and no rollback.

### M2 — Windows directory seconds are unproved (second failure)

* **Claim:** A pin of `opened_file_identity`, `filetime_to_unix_seconds`, and one direct `open_expected_child` still allows a helper to read seconds from a second handle.
* **Witnesses:** tests r3 finding 1 (blocker). Lineage: M2.
* **Evidence:** The round-3 plan text required that count. Windows `entry_identity_at` (`infra/fs.rs:3107-3113`) is one open today. The tests claim is about a future helper, and no count of a direct call excludes one. Confirmed by reading the observation body and the round-3 wording.
* **MANDATE:** identity and seconds come from one observation.
* **Disposition:** Fix, carried to CR-2. The count pin is withdrawn. The obligation is unchanged. Diff review traces helpers.
* **Authority:** second closure failure, then `probe-1-r3`. Not a new production mechanism.
* **Closure:** carried, CR-2. Not a plan-level adoption.

### M3 — The directory race hook is too late to prove one observation (second failure)

* **Claim:** A count of direct `statat` calls misses a helper that looks up before the pinned call, so the hook swaps too late.
* **Witnesses:** tests r3 finding 2 (blocker). Lineage: M3.
* **Evidence:** Unix `entry_identity_at` (`infra/fs.rs:4416`) is one `statat` today. The same helper-hiding limit as M2. This is the second failure of this lineage.
* **MANDATE:** identity and seconds come from one observation.
* **Disposition:** Fix, carried to CR-2. The `statat` count pin is withdrawn. The hook stays immediately after `statat` and is documented as proof only about lookups after that point.
* **Authority:** second closure failure, then `probe-1-r3`.
* **Closure:** carried, CR-2. Not a plan-level adoption.

### M8 — Pre-epoch coverage stops at the helper (round 3 residual)

* **Claim:** The directory witness sets mtime after `create_dir_at` and before the observation returns, but the planned hooks run after the seconds are captured. The witness cannot execute.
* **Witnesses:** platform-semantics r3 finding 1 (should-fix). Prior witness remains tests r2 finding 2.
* **Evidence:** `create_workspace_directory_inner` calls `create_dir_at` then `entry_identity_at` at `file_workspace.rs:965-966`. The pre-register hook is inside registration (`:257-261`), after that observation. A hook after `statat` reads `st_mtime` that is already captured. Confirmed by reading those lines. First failure of this lineage.
* **MANDATE:** a pre-1970 directory create returns a negative `last_modified`.
* **Disposition:** Fix. A `cfg(test)` hook on the shared create path runs after `create_dir_at` succeeds and before the observation syscall or handle acquisition. The test sets a representable pre-epoch mtime there. The file path still sets mtime inside the write closure.
* **Authority:** the same negative-seconds contract. The previous witness named an interval no existing hook can use. Not a Windows swap hook.
* **Closure:** open. Round 4 checks it.

Closed this round: M7. Carried this round: M2, M3 (CR-2), after the second failure and `probe-1-r3`. Adopted this round: 1 (M8). M6 stays CR-1. No Skip, Defer, or withdrawal. Round 4 reviews plan, platform-semantics, and tests. Open: M8.

### Round 4

Raw verdicts, unchanged:

* plan APPROVED. Closed M8. No bracketed findings.
* platform-semantics APPROVED. Closed M8. No bracketed findings.
* tests REVISE. Closed M8. One new finding, M9.

M8 is closed by plan, platform-semantics, and tests. The directory hook is the witness platform asked for.

### M9 — The file success witness misses a pathname stat after rename

* **Claim:** An ordinary create compares mtime with no swap, so a pathname lookup after rename still passes. The pre-register hook runs after the helper has captured seconds. The fallback witness covers only the failure arm.
* **Witnesses:** tests r4 finding 1 (blocker).
* **Evidence:** `PostRenameMetadata` is injected after `rename` and before `adapter.metadata(&temp)` (`infra/fs.rs:933-934`). `inject_atomic_file` continues when `inject` returns `Ok` (`infra/fs.rs:452-454`). The failure arm at `:940-949` does not run on `Ok`. Registration starts only after the helper returns, so `WORKSPACE_CREATED_CHILD_PRE_REGISTER_HOOK` is later. Confirmed by reading those lines.
* **MANDATE:** a rename in the window between install and the metadata read must not supply another object's seconds. The file success path is that window.
* **Disposition:** Fix. The same inject point swaps the installed name and returns `Ok`. The returned seconds are the pre-swap inode's. No new fault-point variant. The failure arm stays the fallback witness.
* **Authority:** MANDATE defect, file path. The existing injector is the interval. Not a new production lookup.
* **Closure:** open. Round 5 checks it.

Closed this round: M8. Opened this round: M9. Adopted this round: 1 (M9). Carried unchanged: M6, M2, M3. No Skip, Defer, or withdrawal. Round 5 reviews plan, platform-semantics, and tests.

### Round 5

Raw verdicts, unchanged:

* plan APPROVED. Closed M9. No bracketed findings. It noted Windows sharing and named `inspect_temp` as a route.
* platform-semantics REVISE. M9 NOT CLOSED, twice, same defect.
* tests APPROVED. Closed M9. No bracketed findings. It also named a handle-based Windows swap.

M9 stays open. Platform's reading matches the source: a pathname swap cannot be staged on Windows. `inspect_temp` is before the write, so that route is rejected.

### M9 — The file success witness misses a pathname stat after rename (round 5 residual)

* **Claim:** The Windows swap does not say how to replace the installed name while the private temp handle stays open. The existing Windows test says a live pathname swap cannot be staged.
* **Witnesses:** platform-semantics r5 finding 1 (should-fix); platform-semantics r5 finding 2 (should-fix). Prior witness remains tests r4 finding 1.
* **Evidence:** `FILE_SHARE_PRIVATE_TEMP` is `FILE_SHARE_WRITE` (`infra/fs.rs:2165`). The test comment at `infra/fs.rs:9011-9016` says the sharing mask rejects a second opener. `post_rename_identity_comes_from_the_retained_handle` (`platform_support.rs:701-727`) pins `adapter.metadata(&temp)` for that reason and records a measured sharing violation (os error 32). `inspect_temp` is at `infra/fs.rs:787`, before the write. Confirmed by reading those sites. First failure of this lineage.
* **MANDATE:** the file success path must not take seconds from a replaced pathname. On Windows that race cannot be staged in-process without widening the share mask.
* **Disposition:** Fix. Unix keeps the runtime swap at `PostRenameMetadata`. Windows extends the existing retained-handle source pin so `modified_seconds` comes from that `metadata` value, and does not pathname-swap. The failure arm is unchanged. The share mask stays.
* **Authority:** the measured Windows limit already recorded for this window (`f-20260916-12` in that pin's comment). Not a new share mode and not `inspect_temp`.
* **Closure:** open. Round 6 checks it.

Adopted this round: 1 (M9 Windows witness). Open: M9. Carried unchanged: M2, M3, M6. No Skip, Defer, or withdrawal. Round 6 reviews plan, platform-semantics, and tests.

### Round 6

Raw verdicts, unchanged:

* plan APPROVED. `M9 CLOSED — Candidate plan-r6.md:89 preserves the Unix swap at PostRenameMetadata, before the retained-descriptor read (src-tauri/src/infra/fs.rs:933). At plan-r6.md:91, Windows extends the existing source pin to require success seconds from that metadata value and reject pathname reads (src-tauri/src/infra/platform_support.rs:701). This fits the retained-handle adapter (src-tauri/src/infra/fs.rs:3758), preserves FILE_SHARE_PRIVATE_TEMP (:2165), and keeps the fallback witness (plan-r6.md:95). The corrected verification is feasible without a new seam or share-mask change (confidence: 95).` No bracketed findings.
* platform-semantics APPROVED. `M9 CLOSED — Unix keeps the successful PostRenameMetadata swap witness; Windows keeps FILE_SHARE_WRITE and extends the retained-handle source pin to require seconds from the same adapter.metadata(&temp) value. Runtime proof is rust-windows-test for Windows and rust-macos-test for the shared Unix path. pnpm rust:windows:check is included as a compile check but was not run in this read-only plan review; the FreeBSD source probe is not applicable because no target_os = "linux" branch is planned.` No bracketed findings.
* tests APPROVED. `M9 CLOSED — Unix retains the PostRenameMetadata swap witness. On Windows, the extended post_rename_identity_comes_from_the_retained_handle assertion checks that returned seconds come from the retained-handle metadata and rejects a target-path stat; rust-windows-test runs on push and pull request.` No bracketed findings.

### M9 — closure

* **Claim:** unchanged from round 5. The Windows witness is the retained-handle source pin, not a pathname swap.
* **Witnesses:** tests r4 finding 1; platform-semantics r5 finding 1; platform-semantics r5 finding 2. Round 6 plan, platform-semantics, and tests each returned M9 CLOSED and no bracketed finding.
* **Evidence:** the round-6 body keeps the Unix swap at the existing inject point and the Windows extension of `post_rename_identity_comes_from_the_retained_handle`. All three closure lenses accepted that split.
* **Disposition:** Fix, already adopted in round 5. No further correction.
* **Closure:** closed in round 6.

Adopted this round: 0. Open: none. Carried unchanged: M2, M3, M6. No Skip, Defer, or withdrawal. Plan review ends.

### Round 7

Drift round. OLD BASE `60a9abe025818676336d26329f6b20dd43d74781`. NEW BASE `f0cbda6524234e94075fa3fa51f20404bf46ce58`. Drift file `/tmp/drain-plan-chessfable-0a459a4f-slot1/build/drift-60a9abe025818676336d26329f6b20dd43d74781-f0cbda6524234e94075fa3fa51f20404bf46ce58.diff`. `plan-review-delta` from `plan-r6.md` to the published plan was UNCHANGED before this round. Twelve refresh lenses. No quota wait.

Raw verdicts, unchanged:

* chess-semantics APPROVED. `NOT APPLICABLE: The files and mandate concern filesystem modification-time lookup; they do not affect an in-memory chess tree, position, or move path.`
* correctness APPROVED. No bracketed findings.
* engine-protocol APPROVED. `NOT APPLICABLE: The plan concerns filesystem modification-time handling; engine process supervision, UCI protocol state, and engine result routing are outside this lens.`
* error-handling APPROVED. No bracketed findings.
* ipc-contract APPROVED. No bracketed findings.
* minimalism APPROVED. No bracketed findings.
* persisted-state APPROVED. `NOT APPLICABLE: The changed paths and workspace mtime obligation concern native filesystem metadata, not persisted renderer state or tab lifecycle.`
* pgn-index APPROVED. `NOT APPLICABLE: The plan concerns workspace modification-time reads and native filesystem paths; it contains no PGN scanning, indexing, encoding, or search obligation.`
* plan APPROVED. No bracketed findings.
* platform-semantics APPROVED. No bracketed findings.
* tauri-security APPROVED. No bracketed findings.
* tests APPROVED. No bracketed findings.

No bracketed finding. The only plan-path hunk in `src-tauri/src/infra/platform_support.rs` retargets a source pin from `fn child_open_swap(` to `fn conflict_if_replaced(` and adds a separate `child_open_swap` count of `"workspace directory changed concurrently"` == 1. The context line still pins `fn open_expected_child(`. That hunk is the f-20260913-04 path-authority Conflict remap, not this plan's identity or mtime tests. The drift does not mention `windows_identity_is_read_from_the_retained_handle`, `post_rename_identity_comes_from_the_retained_handle`, `entry_identity_at`, `modified_seconds`, `timestamp`, `create_workspace_file`, `create_workspace_directory`, `AtomicInstalledFile`, `filetime_to_unix_seconds`, or the allowlist files. No plan obligation is invalidated. Adopted this round: 0. Open: none. Carried unchanged: M2, M3, M6. No Skip, Defer, or withdrawal. The plan stands.


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
    "findings": [
      {
        "kind": "should-fix",
        "text": "scripts/check-rust-release-surface-core.test.mjs:395 — the plan adds a second “left the filesystem-surface baseline” test with the same assertions as the `credentials.rs` test. Keep one shared assertion over both paths; that removes the duplicate test body while preserving coverage (confidence: 98)"
      }
    ],
    "lens": "minimalism",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-minimalism-r1.prompt",
    "report": "lens-minimalism-r1.txt",
    "round": 1,
    "terminal": "completed",
    "verdict": "REVISE"
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
        "text": "tasks/plans/.plan-2026-10-03-workspace-create-mtime-r1.body.md:79 — The file witness never forces post-rename metadata failure, so it cannot verify the fallback seconds promised at line 51. That is a separate return branch in src-tauri/src/infra/fs.rs:944; its existing fault test at :9021 checks outcome and identity only. Require a faulted helper witness asserting the installed inode’s mtime, including a negative value. (confidence: 98)"
      },
      {
        "kind": "blocker",
        "text": "tasks/plans/.plan-2026-10-03-workspace-create-mtime-r1.body.md:81 — The claimed Windows coverage omits directory mtime: the helper witness exercises files, while both create-path race witnesses are Unix-only. The Windows directory observation is separate at src-tauri/src/infra/fs.rs:3107, and its source pin at src-tauri/src/infra/platform_support.rs:937 checks identity only. Returning raw FILETIME ticks for directories could pass every stated witness. Require proof of Windows directory seconds matching the enumerator. (confidence: 97)"
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
        "text": "`tasks/plans/2026-10-03-workspace-create-mtime.md:67` — Deleting `timestamp` leaves two unaddressed consumers. The plan’s cleanup at `:71` covers only `timestamps_and_durability_outcomes_remain_renderer_safe`, but `collect_tree_entries_lists_the_workspace_shape_on_every_platform` also calls the deleted helper at `src-tauri/src/file_workspace.rs:3327` and `:3348`. As written, the Rust test build fails. Include migration of both listing-mtime assertions while preserving their coverage. (confidence: 100)"
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
    "artefact": "lens-platform-semantics-r1.jsonl",
    "findings": [
      {
        "kind": "should-fix",
        "text": "tasks/plans/.plan-2026-10-03-workspace-create-mtime-r1.body.md:81 — The proposed host tests and surface gate do not prove Windows or macOS behavior. Name the runtime proof jobs (`rust-windows-test`, `rust-macos-test` and the relevant `rust-platform` target), include the FreeBSD source probe for non-Linux Unix, and include `pnpm rust:windows:check` for local Windows compilation. (confidence: 99)"
      },
      {
        "kind": "should-fix",
        "text": "tasks/plans/.plan-2026-10-03-workspace-create-mtime-r1.body.md:79 — The helper witness exercises only successful post-rename metadata; it does not trigger `PostRenameMetadata` failure and verify the required pre-rename fallback on Windows and Unix. That leaves the fallback unproved and line 36’s claim that rename preserves mtime unmeasured. (confidence: 98)"
      },
      {
        "kind": "should-fix",
        "text": "tasks/plans/.plan-2026-10-03-workspace-create-mtime-r1.body.md:79 — The Windows witness uses a pre-epoch tick value that fits `i64`; it does not prove that an out-of-range `LastWriteTime` is handled without panic, as required at line 49. Add an overflow case to the Windows test. (confidence: 96)"
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
    "artefact": "lens-platform-semantics-r2.jsonl",
    "findings": [
      {
        "kind": "should-fix",
        "text": "M2 NOT CLOSED — `tasks/plans/.plan-2026-10-03-workspace-create-mtime-r2.body.md:87` treats `src-tauri/src/infra/platform_support.rs:948` as a seconds source pin, but that assertion checks only `opened_file_identity`. The normal Windows create test cannot catch a separate time lookup that sees a replacement after the identity observation. Pin the conversion and shared observation too. (confidence: 96)"
      }
    ],
    "lens": "platform-semantics",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-platform-semantics-r2.prompt",
    "report": "lens-platform-semantics-r2.txt",
    "round": 2,
    "terminal": "completed",
    "verdict": "REVISE"
  },
  {
    "artefact": "lens-platform-semantics-r3.jsonl",
    "findings": [
      {
        "kind": "should-fix",
        "text": "M8 NOT CLOSED — The directory witness requires setting mtime after creation but before observation (`plan:89`), yet the current path calls `create_dir_at` and then observes immediately (`src-tauri/src/file_workspace.rs:965-966`). The existing pre-registration hook runs after observation (`:258-261`), and the planned Unix hook runs after `statat`; neither can set the timestamp in time. Specify a cross-platform test-only hook for this interval."
      }
    ],
    "lens": "platform-semantics",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-platform-semantics-r3.prompt",
    "report": "lens-platform-semantics-r3.txt",
    "round": 3,
    "terminal": "completed",
    "verdict": "REVISE"
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
    "artefact": "lens-platform-semantics-r5.jsonl",
    "findings": [
      {
        "kind": "should-fix",
        "text": "M9 NOT CLOSED — The Windows swap witness at `tasks/plans/.plan-2026-10-03-workspace-create-mtime-r5.body.md:89` does not specify how to replace the installed name while the private temp handle remains open."
      },
      {
        "kind": "should-fix",
        "text": "tasks/plans/.plan-2026-10-03-workspace-create-mtime-r5.body.md:89 — The callback runs before metadata while `temp` is held (`src-tauri/src/infra/fs.rs:933-934`); Windows opens it with only `FILE_SHARE_WRITE` (`src-tauri/src/infra/fs.rs:2165`), and the existing Windows test says a live pathname swap cannot be staged (`src-tauri/src/infra/fs.rs:9011`). Specify a Windows handle-based swap through an existing test seam, or another feasible Windows witness. The plan names `rust-macos-test` and `rust-windows-test` for runtime proof; `rust-platform` is compile-only. No implementation diff exists, so `pnpm rust:windows:check` has not passed. The FreeBSD probe is not applicable while the phase adds no `target_os = \"linux\"` branch. (confidence: 95)"
      }
    ],
    "lens": "platform-semantics",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-platform-semantics-r5.prompt",
    "report": "lens-platform-semantics-r5.txt",
    "round": 5,
    "terminal": "completed",
    "verdict": "REVISE"
  },
  {
    "artefact": "lens-platform-semantics-r6.jsonl",
    "findings": [],
    "lens": "platform-semantics",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-platform-semantics-r6.prompt",
    "report": "lens-platform-semantics-r6.txt",
    "round": 6,
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
        "text": "tasks/plans/.plan-2026-10-03-workspace-create-mtime-r1.body.md:81 — The directory hook runs inside registration, after `entry_identity_at` has returned (`file_workspace.rs:966`). A separate mtime lookup before registration would still see the original directory in this test; replacing the name between the two observations could return seconds for a different object while the test passes. The “same observation” requirement has no race witness. (confidence: 96)"
      },
      {
        "kind": "should-fix",
        "text": "tasks/plans/.plan-2026-10-03-workspace-create-mtime-r1.body.md:79 — The file witness covers successful post-rename metadata only. It does not assert `modified_seconds` from the required pre-rename fallback when post-rename metadata fails; the existing injected-failure test checks outcome, identity, and content, not seconds. (confidence: 98)"
      },
      {
        "kind": "should-fix",
        "text": "tasks/plans/.plan-2026-10-03-workspace-create-mtime-r1.body.md:81 — The Windows helper witness checks the atomic file helper, while the surface gate checks filesystem reaches. Neither asserts that the Windows directory handle path supplies the created `WorkspaceEntry.last_modified`; the Unix-only race test cannot catch a Windows-specific regression in that path. (confidence: 94)"
      },
      {
        "kind": "should-fix",
        "text": "tasks/plans/.plan-2026-10-03-workspace-create-mtime-r1.body.md:49 — The stated no-panic behavior for a Windows tick count outside `i64` has no assertion. The proposed pre-epoch test uses a representable tick count, so a panic on the out-of-range branch could pass. (confidence: 96)"
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
        "text": "M3 NOT CLOSED — The hook runs after identity and seconds are copied. If separate identity and mtime lookups both happen before it, a swap between them is never injected and both assertions can pass. (confidence: 93)"
      },
      {
        "kind": "blocker",
        "text": "tasks/plans/.plan-2026-10-03-workspace-create-mtime-r2.body.md:79 — The pre-epoch assertion stops at the filesystem helper. The create-path witnesses do not specify a negative mtime on a returned `WorkspaceEntry`, so a caller change that clamps negative seconds or rejects them could pass. Assert negative `last_modified` from both create paths. (confidence: 94)"
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
        "kind": "blocker",
        "text": "M2 NOT CLOSED — The Windows source pin checks for both function names and one direct `open_expected_child`, but does not prove the converted FILETIME comes from the handle used for identity. A helper could read seconds from a second handle before returning; the normal create-versus-enumerator test would still pass. See plan lines 63 and 97."
      },
      {
        "kind": "blocker",
        "text": "M3 NOT CLOSED — Counting direct `statat` calls in the observation body misses a second lookup hidden in a helper called before the pinned `statat`. The hook then swaps only after both lookups, so the test can pass even though a rename between them could make identity and seconds refer to different entries. See plan lines 61 and 95."
      }
    ],
    "lens": "tests",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-tests-r3.prompt",
    "report": "lens-tests-r3.txt",
    "round": 3,
    "terminal": "completed",
    "verdict": "REVISE"
  },
  {
    "artefact": "lens-tests-r4.jsonl",
    "findings": [
      {
        "kind": "blocker",
        "text": "tasks/plans/.plan-2026-10-03-workspace-create-mtime-r4.body.md:87 — The file success test uses an ordinary create and compares its mtime, so replacing the same-descriptor read with a pathname lookup after rename still passes when there is no race. The pre-register race test at line 93 swaps the name only after the helper has captured `modified_seconds`; the fallback test exercises the failure branch. A swap at the existing post-rename, pre-metadata point would make this regression observable. (confidence: 95)"
      }
    ],
    "lens": "tests",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-tests-r4.prompt",
    "report": "lens-tests-r4.txt",
    "round": 4,
    "terminal": "completed",
    "verdict": "REVISE"
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
    "findings": [],
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
    "artefact": "lens-chess-semantics-r7.jsonl",
    "findings": [],
    "lens": "chess-semantics",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-chess-semantics-r7.prompt",
    "report": "lens-chess-semantics-r7.txt",
    "round": 7,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-correctness-r7.jsonl",
    "findings": [],
    "lens": "correctness",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-correctness-r7.prompt",
    "report": "lens-correctness-r7.txt",
    "round": 7,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-engine-protocol-r7.jsonl",
    "findings": [],
    "lens": "engine-protocol",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-engine-protocol-r7.prompt",
    "report": "lens-engine-protocol-r7.txt",
    "round": 7,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-error-handling-r7.jsonl",
    "findings": [],
    "lens": "error-handling",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-error-handling-r7.prompt",
    "report": "lens-error-handling-r7.txt",
    "round": 7,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-ipc-contract-r7.jsonl",
    "findings": [],
    "lens": "ipc-contract",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-ipc-contract-r7.prompt",
    "report": "lens-ipc-contract-r7.txt",
    "round": 7,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-minimalism-r7.jsonl",
    "findings": [],
    "lens": "minimalism",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-minimalism-r7.prompt",
    "report": "lens-minimalism-r7.txt",
    "round": 7,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-persisted-state-r7.jsonl",
    "findings": [],
    "lens": "persisted-state",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-persisted-state-r7.prompt",
    "report": "lens-persisted-state-r7.txt",
    "round": 7,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-pgn-index-r7.jsonl",
    "findings": [],
    "lens": "pgn-index",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-pgn-index-r7.prompt",
    "report": "lens-pgn-index-r7.txt",
    "round": 7,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-plan-r7.jsonl",
    "findings": [],
    "lens": "plan",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-plan-r7.prompt",
    "report": "lens-plan-r7.txt",
    "round": 7,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-platform-semantics-r7.jsonl",
    "findings": [],
    "lens": "platform-semantics",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-platform-semantics-r7.prompt",
    "report": "lens-platform-semantics-r7.txt",
    "round": 7,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-tauri-security-r7.jsonl",
    "findings": [],
    "lens": "tauri-security",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-tauri-security-r7.prompt",
    "report": "lens-tauri-security-r7.txt",
    "round": 7,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-tests-r7.jsonl",
    "findings": [],
    "lens": "tests",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-tests-r7.prompt",
    "report": "lens-tests-r7.txt",
    "round": 7,
    "terminal": "completed",
    "verdict": "APPROVED"
  }
]

### Issues

[
  {
    "claim": "The file witness never injects PostRenameMetadata, so the promised fallback seconds can be missing and the proof stays green.",
    "closed_round": 2,
    "correction": "The success path returns the post-rename fstat. The failure path returns the pre-rename fstat of the same descriptor, including a pre-epoch mtime, on Unix and Windows. The plan does not claim those readings match.",
    "dependencies": [],
    "disposition": "Fix",
    "id": "M1",
    "witnesses": [
      {
        "index": 1,
        "lens": "plan",
        "round": 1
      },
      {
        "index": 2,
        "lens": "platform-semantics",
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
    "carried": "CR-2",
    "claim": "Windows directory seconds are not shown to come from the same retained handle as identity.",
    "closed_round": "carried",
    "correction": "Directory seconds come from the same retained Windows handle as identity, via filetime_to_unix_seconds of that handle's LastWriteTime bits as i64. One observation is proved by CR-2, not by an identifier count.",
    "dependencies": [],
    "disposition": "Fix",
    "id": "M2",
    "witnesses": [
      {
        "index": 2,
        "lens": "plan",
        "round": 1
      },
      {
        "index": 3,
        "lens": "tests",
        "round": 1
      },
      {
        "index": 1,
        "lens": "platform-semantics",
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
    "carried": "CR-2",
    "claim": "The Unix directory witness does not prove identity and seconds come from one stat rather than an earlier helper lookup.",
    "closed_round": "carried",
    "correction": "The unix swap hook is the next statement after statat and only proves a later lookup cannot change the returned pair. Absence of an earlier helper lookup is CR-2, not another source-count pin.",
    "dependencies": [],
    "disposition": "Fix",
    "id": "M3",
    "witnesses": [
      {
        "index": 1,
        "lens": "tests",
        "round": 1
      },
      {
        "index": 1,
        "lens": "tests",
        "round": 2
      },
      {
        "index": 2,
        "lens": "tests",
        "round": 3
      }
    ]
  },
  {
    "claim": "The Windows tick conversion has no witness for a u64 word whose high bit is set.",
    "closed_round": 2,
    "correction": "Interpret the handle's u64 LastWriteTime bits as i64, then filetime_to_unix_seconds. u64::MAX is the same bits as i64 -1. Do not panic, saturate, or error.",
    "dependencies": [],
    "disposition": "Fix",
    "id": "M4",
    "witnesses": [
      {
        "index": 3,
        "lens": "platform-semantics",
        "round": 1
      },
      {
        "index": 4,
        "lens": "tests",
        "round": 1
      }
    ]
  },
  {
    "claim": "The plan's host tests do not name the Windows and macOS runtime proof.",
    "closed_round": 2,
    "correction": "Name rust-macos-test, rust-windows-test, rust-platform, and pnpm rust:windows:check. This phase adds no target_os = linux branch, so the FreeBSD probe is not applicable unless an edit adds one.",
    "dependencies": [],
    "disposition": "Fix",
    "id": "M5",
    "witnesses": [
      {
        "index": 1,
        "lens": "platform-semantics",
        "round": 1
      }
    ]
  },
  {
    "carried": "CR-1",
    "claim": "The allowlist shrink duplicates the credentials.rs baseline test instead of extending it.",
    "closed_round": "carried",
    "correction": "One assertion covers credentials.rs and file_workspace.rs. Putting file_workspace.rs back on the allowlist or the counts object fails that pin.",
    "dependencies": [],
    "disposition": "Fix",
    "id": "M6",
    "witnesses": [
      {
        "index": 1,
        "lens": "minimalism",
        "round": 1
      }
    ]
  },
  {
    "claim": "Deleting timestamp leaves the listing-shape assertions at file_workspace.rs:3327 and :3348 uncompiled.",
    "closed_round": 3,
    "correction": "Both listing comparisons stay and use the enumerator's whole seconds. Do not use duration_since. A test-only metadata read does not count as a production pathname reach.",
    "dependencies": [],
    "disposition": "Fix",
    "id": "M7",
    "witnesses": [
      {
        "index": 1,
        "lens": "plan",
        "round": 2
      }
    ]
  },
  {
    "claim": "The directory pre-epoch witness has no hook between create_dir_at and the observation.",
    "closed_round": 4,
    "correction": "A cfg(test) hook on the shared create path runs after create_dir_at succeeds and before the observation syscall or handle acquisition. The directory test sets a representable pre-epoch mtime and asserts negative last_modified equal to the enumerator's seconds.",
    "dependencies": [],
    "disposition": "Fix",
    "id": "M8",
    "witnesses": [
      {
        "index": 2,
        "lens": "tests",
        "round": 2
      },
      {
        "index": 1,
        "lens": "platform-semantics",
        "round": 3
      }
    ]
  },
  {
    "claim": "An ordinary file create cannot tell a retained-descriptor mtime read from a pathname stat of an unreplaced name.",
    "closed_round": 6,
    "correction": "Unix swaps the installed name at the existing PostRenameMetadata inject point and returns Ok so metadata still runs. Windows does not pathname-swap and does not change FILE_SHARE_PRIVATE_TEMP. It extends post_rename_identity_comes_from_the_retained_handle so success modified_seconds come from adapter.metadata(&temp) and the success arm does not stat the target pathname. inspect_temp is not this seam. The failure arm stays the pre-rename fallback.",
    "dependencies": [],
    "disposition": "Fix",
    "id": "M9",
    "witnesses": [
      {
        "index": 1,
        "lens": "tests",
        "round": 4
      },
      {
        "index": 1,
        "lens": "platform-semantics",
        "round": 5
      },
      {
        "index": 2,
        "lens": "platform-semantics",
        "round": 5
      }
    ]
  }
]

### lens-chess-semantics-r1.txt

NOT APPLICABLE: The files and mandate concern filesystem modification-time observations; they do not involve an in-memory chess tree, position, or move path.

VERDICT: APPROVED
### lens-chess-semantics-r7.txt

NOT APPLICABLE: The files and mandate concern filesystem modification-time lookup; they do not affect an in-memory chess tree, position, or move path.

VERDICT: APPROVED
### lens-correctness-r1.txt

VERDICT: APPROVED
### lens-correctness-r7.txt

VERDICT: APPROVED
### lens-engine-protocol-r1.txt

NOT APPLICABLE: The plan concerns filesystem timestamps and release-surface checks; it does not touch engine processes, UCI state, or asynchronous engine-result routing.
VERDICT: APPROVED
### lens-engine-protocol-r7.txt

NOT APPLICABLE: The plan concerns filesystem modification-time handling; engine process supervision, UCI protocol state, and engine result routing are outside this lens.

VERDICT: APPROVED
### lens-error-handling-r1.txt

No error-handling findings.

VERDICT: APPROVED
### lens-error-handling-r7.txt

VERDICT: APPROVED
### lens-ipc-contract-r1.txt

No IPC-contract defects found. The create commands already pass through `collect_commands!` and generated bindings; `lastModified` remains a signed Unix-seconds value that the renderer converts with `Number(...)`.

VERDICT: APPROVED
### lens-ipc-contract-r7.txt

VERDICT: APPROVED
### lens-minimalism-r1.txt

[should-fix] scripts/check-rust-release-surface-core.test.mjs:395 — the plan adds a second “left the filesystem-surface baseline” test with the same assertions as the `credentials.rs` test. Keep one shared assertion over both paths; that removes the duplicate test body while preserving coverage (confidence: 98)

VERDICT: REVISE
### lens-minimalism-r7.txt

VERDICT: APPROVED
### lens-persisted-state-r1.txt

NOT APPLICABLE: The plan concerns Rust filesystem modification-time observations and release-surface checks; it has no renderer state, storage keys, or tab lifecycle.
VERDICT: APPROVED
### lens-persisted-state-r7.txt

NOT APPLICABLE: The changed paths and workspace mtime obligation concern native filesystem metadata, not persisted renderer state or tab lifecycle.
VERDICT: APPROVED
### lens-pgn-index-r1.txt

NOT APPLICABLE: The plan concerns filesystem metadata for workspace creation; it does not touch PGN scanning, indexing, encoding, or searching.

VERDICT: APPROVED
### lens-pgn-index-r7.txt

NOT APPLICABLE: The plan concerns workspace modification-time reads and native filesystem paths; it contains no PGN scanning, indexing, encoding, or search obligation.

VERDICT: APPROVED
### lens-plan-r1.txt

[blocker] tasks/plans/.plan-2026-10-03-workspace-create-mtime-r1.body.md:79 — The file witness never forces post-rename metadata failure, so it cannot verify the fallback seconds promised at line 51. That is a separate return branch in src-tauri/src/infra/fs.rs:944; its existing fault test at :9021 checks outcome and identity only. Require a faulted helper witness asserting the installed inode’s mtime, including a negative value. (confidence: 98)

[blocker] tasks/plans/.plan-2026-10-03-workspace-create-mtime-r1.body.md:81 — The claimed Windows coverage omits directory mtime: the helper witness exercises files, while both create-path race witnesses are Unix-only. The Windows directory observation is separate at src-tauri/src/infra/fs.rs:3107, and its source pin at src-tauri/src/infra/platform_support.rs:937 checks identity only. Returning raw FILETIME ticks for directories could pass every stated witness. Require proof of Windows directory seconds matching the enumerator. (confidence: 97)

VERDICT: REVISE
### lens-plan-r2.txt

M1 CLOSED — `tasks/plans/2026-10-03-workspace-create-mtime.md:81` requires a faulted `PostRenameMetadata` witness, including pre-epoch seconds from the pre-rename descriptor reading. This matches the fallback branch at `src-tauri/src/infra/fs.rs:944`. The unmeasured rename claim is withdrawn.

M2 CLOSED — `tasks/plans/2026-10-03-workspace-create-mtime.md:59` requires the Windows conversion pin, and `:87` adds a directory-create comparison against enumeration. These cover the current identity-only observation at `src-tauri/src/infra/fs.rs:3107` and the enumerator’s conversion at `:3049`.

M3 CLOSED — `tasks/plans/2026-10-03-workspace-create-mtime.md:85` adds the swap witness inside the observation; `:59` requires one call returning identity and seconds. This covers the window before registration at `src-tauri/src/file_workspace.rs:966`, which the existing hook at `:258` cannot exercise.

M4 CLOSED — `tasks/plans/2026-10-03-workspace-create-mtime.md:49` defines the tick-bit interpretation, and `:89` requires testing the create-path conversion with `u64::MAX`. This connects the unsigned metadata word at `src-tauri/src/infra/fs.rs:3761` to the existing negative-tick behavior at `:8659`.

M5 CLOSED — `tasks/plans/2026-10-03-workspace-create-mtime.md:142` includes the local Windows check; `:93` names existing platform jobs. Their compile and runtime commands exist at `.github/workflows/test.yml:52`, `:80`, and `:102`.

[blocker] `tasks/plans/2026-10-03-workspace-create-mtime.md:67` — Deleting `timestamp` leaves two unaddressed consumers. The plan’s cleanup at `:71` covers only `timestamps_and_durability_outcomes_remain_renderer_safe`, but `collect_tree_entries_lists_the_workspace_shape_on_every_platform` also calls the deleted helper at `src-tauri/src/file_workspace.rs:3327` and `:3348`. As written, the Rust test build fails. Include migration of both listing-mtime assertions while preserving their coverage. (confidence: 100)

VERDICT: REVISE
### lens-plan-r3.txt

M2 CLOSED — r3 plan:63,97 requires a separate seconds/conversion/open-count assertion and preserves the other four identity pins; `src-tauri/src/infra/platform_support.rs:937` currently checks identity only, matching the corrected premise.

M3 CLOSED — r3 plan:61,95 places the hook immediately after the single stat and adds an exact-count pin; `src-tauri/src/infra/fs.rs:4416` provides the existing single-stat foundation.

M7 CLOSED — r3 plan:79 preserves and migrates both listing comparisons at `src-tauri/src/file_workspace.rs:3327` and `:3348`, addressing the remaining test consumers of the deleted helper.

M8 CLOSED — r3 plan:89 requires negative `WorkspaceEntry.last_modified` results from both create paths, covering the assignments at `src-tauri/src/file_workspace.rs:901` and `:1000`; the helper-only witness no longer substitutes for consumer coverage.

VERDICT: APPROVED
### lens-plan-r4.txt

M8 CLOSED — `plan-r4.md:89` places the directory hook after successful creation and before metadata capture (`file_workspace.rs:965-966`; `infra/fs.rs:4416`, `:3112`). Same-thread execution and assertions on negative returned `last_modified` make the witness executable. The file witness remains before fstat. (confidence: 95)

VERDICT: APPROVED
### lens-plan-r5.txt

M9 CLOSED — r5 `tasks/plans/.plan-2026-10-03-workspace-create-mtime-r5.body.md:89` places the swap before successful metadata at `src-tauri/src/infra/fs.rs:933-934`; the fallback remains at `:940-949`. Windows’ restrictive sharing blocks pathname renames, but existing `inspect_temp` (`:787`) and retained-handle `rename_child` (`:2655`) provide a compatible witness route without a new fault point. Limitation: Windows runtime execution was not verified in this read-only review (confidence: 90).

VERDICT: APPROVED
### lens-plan-r6.txt

M9 CLOSED — Candidate `plan-r6.md:89` preserves the Unix swap at `PostRenameMetadata`, before the retained-descriptor read (`src-tauri/src/infra/fs.rs:933`). At `plan-r6.md:91`, Windows extends the existing source pin to require success seconds from that metadata value and reject pathname reads (`src-tauri/src/infra/platform_support.rs:701`). This fits the retained-handle adapter (`src-tauri/src/infra/fs.rs:3758`), preserves `FILE_SHARE_PRIVATE_TEMP` (`:2165`), and keeps the fallback witness (`plan-r6.md:95`). The corrected verification is feasible without a new seam or share-mask change (confidence: 95).

VERDICT: APPROVED
### lens-plan-r7.txt

VERDICT: APPROVED
### lens-platform-semantics-r1.txt

[should-fix] tasks/plans/.plan-2026-10-03-workspace-create-mtime-r1.body.md:81 — The proposed host tests and surface gate do not prove Windows or macOS behavior. Name the runtime proof jobs (`rust-windows-test`, `rust-macos-test` and the relevant `rust-platform` target), include the FreeBSD source probe for non-Linux Unix, and include `pnpm rust:windows:check` for local Windows compilation. (confidence: 99)

[should-fix] tasks/plans/.plan-2026-10-03-workspace-create-mtime-r1.body.md:79 — The helper witness exercises only successful post-rename metadata; it does not trigger `PostRenameMetadata` failure and verify the required pre-rename fallback on Windows and Unix. That leaves the fallback unproved and line 36’s claim that rename preserves mtime unmeasured. (confidence: 98)

[should-fix] tasks/plans/.plan-2026-10-03-workspace-create-mtime-r1.body.md:79 — The Windows witness uses a pre-epoch tick value that fits `i64`; it does not prove that an out-of-range `LastWriteTime` is handled without panic, as required at line 49. Add an overflow case to the Windows test. (confidence: 96)

VERDICT: REVISE
### lens-platform-semantics-r2.txt

M1 CLOSED — `tasks/plans/.plan-2026-10-03-workspace-create-mtime-r2.body.md:81` specifies a `PostRenameMetadata` witness on Unix and Windows, including a pre-epoch mtime, and explicitly avoids claiming the pre- and post-rename readings are equal.

[should-fix] M2 NOT CLOSED — `tasks/plans/.plan-2026-10-03-workspace-create-mtime-r2.body.md:87` treats `src-tauri/src/infra/platform_support.rs:948` as a seconds source pin, but that assertion checks only `opened_file_identity`. The normal Windows create test cannot catch a separate time lookup that sees a replacement after the identity observation. Pin the conversion and shared observation too. (confidence: 96)

M3 CLOSED — `tasks/plans/.plan-2026-10-03-workspace-create-mtime-r2.body.md:85` requires one Unix observation and a swap hook after identity and seconds are copied; `cfg(unix)` includes macOS.

M4 CLOSED — `tasks/plans/.plan-2026-10-03-workspace-create-mtime-r2.body.md:89` specifies the `u64`-to-`i64` bit reinterpretation and tests both a pre-epoch value and `u64::MAX`.

M5 CLOSED — `tasks/plans/.plan-2026-10-03-workspace-create-mtime-r2.body.md:93` names `rust-macos-test` and `rust-windows-test` as runtime proof, `rust-platform` as MSVC compile proof, and includes `pnpm rust:windows:check`. That check was not run during this read-only plan review. No FreeBSD probe is needed because the plan adds no `target_os = "linux"` branch.

DELTA-DEPENDENT DEFECTS: M2 above is the only defect found in the changed obligations.

BLOCKERS ANYWHERE IN THE PLAN: none.

VERDICT: REVISE
### lens-platform-semantics-r3.txt

M2 CLOSED — The Windows observation requires `opened_file_identity`, `filetime_to_unix_seconds`, and one `open_expected_child`; the retained-handle identity pin follows that body (`plan:63,97`).

M3 CLOSED — The Unix hook is immediately after the single `statat`, with a source count that rejects a second call (`plan:61,95`). This covers Linux and macOS through `cfg(unix)`.

M7 CLOSED — Both listing comparisons remain and use the enumerator’s platform-specific whole seconds (`plan:79`).

[should-fix] M8 NOT CLOSED — The directory witness requires setting mtime after creation but before observation (`plan:89`), yet the current path calls `create_dir_at` and then observes immediately (`src-tauri/src/file_workspace.rs:965-966`). The existing pre-registration hook runs after observation (`:258-261`), and the planned Unix hook runs after `statat`; neither can set the timestamp in time. Specify a cross-platform test-only hook for this interval.

Platform proof: the plan proposes Linux unit tests, `pnpm rust:windows:check` (local compile only), and CI jobs `rust-macos-test` and `rust-windows-test` for runtime, plus `rust-platform` for platform compilation. None was run during this plan review. The FreeBSD source probe is not applicable unless a `target_os = "linux"` branch is added, as the plan states.

VERDICT: REVISE
### lens-platform-semantics-r4.txt

M8 CLOSED — the directory test sets mtime after `create_dir_at` and before the observation syscall or handle open (plan `:89`). The plan names `rust-macos-test` and `rust-windows-test` for runtime proof, `rust-platform` and `pnpm rust:windows:check` for Windows compile proof, and correctly marks the FreeBSD probe inapplicable because it adds no `target_os = "linux"` branch (`:97-103`).

VERDICT: APPROVED
### lens-platform-semantics-r5.txt

[should-fix] M9 NOT CLOSED — The Windows swap witness at `tasks/plans/.plan-2026-10-03-workspace-create-mtime-r5.body.md:89` does not specify how to replace the installed name while the private temp handle remains open.

[should-fix] tasks/plans/.plan-2026-10-03-workspace-create-mtime-r5.body.md:89 — The callback runs before metadata while `temp` is held (`src-tauri/src/infra/fs.rs:933-934`); Windows opens it with only `FILE_SHARE_WRITE` (`src-tauri/src/infra/fs.rs:2165`), and the existing Windows test says a live pathname swap cannot be staged (`src-tauri/src/infra/fs.rs:9011`). Specify a Windows handle-based swap through an existing test seam, or another feasible Windows witness. The plan names `rust-macos-test` and `rust-windows-test` for runtime proof; `rust-platform` is compile-only. No implementation diff exists, so `pnpm rust:windows:check` has not passed. The FreeBSD probe is not applicable while the phase adds no `target_os = "linux"` branch. (confidence: 95)

VERDICT: REVISE
### lens-platform-semantics-r6.txt

M9 CLOSED — Unix keeps the successful `PostRenameMetadata` swap witness; Windows keeps `FILE_SHARE_WRITE` and extends the retained-handle source pin to require seconds from the same `adapter.metadata(&temp)` value ([plan](/home/felixb/.claude/drain-plans/chessfable-0a459a4f/slot-0/wt/tasks/plans/.plan-2026-10-03-workspace-create-mtime-r6.body.md:89), [platform_support.rs](/home/felixb/.claude/drain-plans/chessfable-0a459a4f/slot-0/wt/src-tauri/src/infra/platform_support.rs:701)). Runtime proof is `rust-windows-test` for Windows and `rust-macos-test` for the shared Unix path. `pnpm rust:windows:check` is included as a compile check but was not run in this read-only plan review; the FreeBSD source probe is not applicable because no `target_os = "linux"` branch is planned ([plan](/home/felixb/.claude/drain-plans/chessfable-0a459a4f/slot-0/wt/tasks/plans/.plan-2026-10-03-workspace-create-mtime-r6.body.md:107)).

VERDICT: APPROVED
### lens-platform-semantics-r7.txt

VERDICT: APPROVED
### lens-tauri-security-r1.txt

No findings. The plan sources file mtime from the installed descriptor and directory mtime from the same no-follow observation used for identity. Credentials, sessions, signed downloads, and backend diagnostics are not in scope here.

VERDICT: APPROVED
### lens-tauri-security-r7.txt

VERDICT: APPROVED
### lens-tests-r1.txt

[blocker] tasks/plans/.plan-2026-10-03-workspace-create-mtime-r1.body.md:81 — The directory hook runs inside registration, after `entry_identity_at` has returned (`file_workspace.rs:966`). A separate mtime lookup before registration would still see the original directory in this test; replacing the name between the two observations could return seconds for a different object while the test passes. The “same observation” requirement has no race witness. (confidence: 96)

[should-fix] tasks/plans/.plan-2026-10-03-workspace-create-mtime-r1.body.md:79 — The file witness covers successful post-rename metadata only. It does not assert `modified_seconds` from the required pre-rename fallback when post-rename metadata fails; the existing injected-failure test checks outcome, identity, and content, not seconds. (confidence: 98)

[should-fix] tasks/plans/.plan-2026-10-03-workspace-create-mtime-r1.body.md:81 — The Windows helper witness checks the atomic file helper, while the surface gate checks filesystem reaches. Neither asserts that the Windows directory handle path supplies the created `WorkspaceEntry.last_modified`; the Unix-only race test cannot catch a Windows-specific regression in that path. (confidence: 94)

[should-fix] tasks/plans/.plan-2026-10-03-workspace-create-mtime-r1.body.md:49 — The stated no-panic behavior for a Windows tick count outside `i64` has no assertion. The proposed pre-epoch test uses a representable tick count, so a panic on the out-of-range branch could pass. (confidence: 96)

VERDICT: REVISE
### lens-tests-r2.txt

M1 CLOSED — The `PostRenameMetadata` witness asserts the fallback seconds equal the preset pre-epoch value and checks `CommittedDurabilityUncertain` on Unix and Windows.

M2 CLOSED — The Windows create-directory witness compares its returned seconds with enumeration; `rust-windows-test` runs `cargo test --all-targets`, and the source pin checks the handle identity and conversion path.

[blocker] M3 NOT CLOSED — The hook runs after identity and seconds are copied. If separate identity and mtime lookups both happen before it, a swap between them is never injected and both assertions can pass. (confidence: 93)

M4 CLOSED — The tick-word witness checks a fitting pre-epoch value and `u64::MAX` against `filetime_to_unix_seconds` of the same i64 bits, including the no-panic behavior.

M5 CLOSED — PROOF names `pnpm rust:windows:check`; the push/PR workflow runs the named macOS and Windows tests and the Windows MSVC compile.

[blocker] tasks/plans/.plan-2026-10-03-workspace-create-mtime-r2.body.md:79 — The pre-epoch assertion stops at the filesystem helper. The create-path witnesses do not specify a negative mtime on a returned `WorkspaceEntry`, so a caller change that clamps negative seconds or rejects them could pass. Assert negative `last_modified` from both create paths. (confidence: 94)

VERDICT: REVISE
### lens-tests-r3.txt

[blocker] M2 NOT CLOSED — The Windows source pin checks for both function names and one direct `open_expected_child`, but does not prove the converted FILETIME comes from the handle used for identity. A helper could read seconds from a second handle before returning; the normal create-versus-enumerator test would still pass. See plan lines 63 and 97.

[blocker] M3 NOT CLOSED — Counting direct `statat` calls in the observation body misses a second lookup hidden in a helper called before the pinned `statat`. The hook then swaps only after both lookups, so the test can pass even though a rename between them could make identity and seconds refer to different entries. See plan lines 61 and 95.

M7 CLOSED — The plan keeps both listing comparisons and specifies enumerator whole seconds as their expected value (line 79).

M8 CLOSED — The plan requires negative `WorkspaceEntry.last_modified` assertions for both create paths; reverting to the current pre-epoch-rejecting helper would fail them (line 89).

VERDICT: REVISE
### lens-tests-r4.txt

M8 CLOSED — the directory hook now runs before the observation syscall or handle open, and the test compares the returned negative `last_modified` with that directory’s listing seconds; observing before the hook or reverting to pathname `timestamp` would fail.

[blocker] tasks/plans/.plan-2026-10-03-workspace-create-mtime-r4.body.md:87 — The file success test uses an ordinary create and compares its mtime, so replacing the same-descriptor read with a pathname lookup after rename still passes when there is no race. The pre-register race test at line 93 swaps the name only after the helper has captured `modified_seconds`; the fallback test exercises the failure branch. A swap at the existing post-rename, pre-metadata point would make this regression observable. (confidence: 95)

VERDICT: REVISE
### lens-tests-r5.txt

M9 CLOSED — The delta specifies a successful `PostRenameMetadata` injection that swaps the installed name and asserts the returned seconds match the pre-swap inode. Windows can stage that through the existing `inspect_temp(&File)` hook and handle-based rename path, avoiding the second open that caused the documented sharing violation (`infra/fs.rs:472, 787, 2550–2665`).

VERDICT: APPROVED
### lens-tests-r6.txt

M9 CLOSED — Unix retains the `PostRenameMetadata` swap witness. On Windows, the extended `post_rename_identity_comes_from_the_retained_handle` assertion checks that returned seconds come from the retained-handle metadata and rejects a target-path stat; `rust-windows-test` runs on push and pull request.

VERDICT: APPROVED
### lens-tests-r7.txt

VERDICT: APPROVED
### plan-r1.md

# Plan: Workspace create mtime without a pathname reach

## Goal

`create_workspace_file` and `create_workspace_directory` return `WorkspaceEntry.lastModified` as the signed Unix seconds of the object this call installed, taken from the observation that already identified that object. They do not look the new name up again by pathname, and a failure of that observation is not introduced after the entry is registered.

## MANDATE

### Workspace create paths read the new entry's modification time back by pathname

* **ID:** f-20260913-02 · **Status:** open · **Area:** native-fs · **Root:** - · **Entry:** build · **Blocked:** none
* **Where:** `src-tauri/src/file_workspace.rs` — `timestamp` (`:154-159`, `fs::metadata(path)`), called by `create_workspace_file_blocking` (`:683`) and `create_workspace_directory_inner` (`:781`) after the entry was installed through a retained parent descriptor and registered.
* **Defect:** both create paths install the new entry descriptor-relative (`atomic_replace_at_identified`, `create_dir_at`) and register it with the installed identity, then compute `last_modified` by reopening `parent_target.path().join(name)` by pathname. A rename in that window returns the modification time of a different object, and the reach is one of `file_workspace.rs`'s counted R3 sites in `INITIAL_FS_SURFACE_COUNTS`.
* **Open question:** where does the create path take the mtime without a pathname reach and without turning a post-commit race into an error after the entry and its sidecar are already durable and registered — `fstat` of a descriptor retained from the install (the atomic-replace helpers do not return one today), an identity-checked `statat` through the retained parent (which can fail after the durable commit), or reordering the stat before registration?
* **Why it matters:** it is the last production filesystem reach in `file_workspace.rs` once `f-20260905-05` lands; closing it removes the file from the allowlist.
* **Related:** `f-20260905-05` (its plan review split this out as outside that mandate — `timestamp` is metadata, not directory enumeration).
* **Found by:** Claude Code, plan review of `tasks/plans/2026-09-13-workspace-directory-enumeration.md` (`review-minimalism`, `review-root-cause`, `review-tauri-security`), 2026-09-13.

* **Inherited review history (2026-09-13):** load `tasks/handoffs/2026-09-13-workspace-directory-enumeration-review.md` before this finding's plan review. It carries the `f-20260905-05` plan-review record; this finding inherits issue IDs W6, W17 and W24 from it, with their witnesses, dispositions and evidence.

Line numbers in the mandate are the filing's. Locate re-found the same functions at `timestamp` `file_workspace.rs:184-190`, the file call at `:901`, and the directory call at `:1000`.

## Threat model and non-goals

The parent directory is a workspace the user already granted. Another process, or another call that holds no `workspace_mutation` lock, can rename or replace the new leaf after this call's install. That is the adversary the defect names. It is not a cross-user privilege boundary and not a symlink escape of the parent: the parent descriptor is the one the mutation target already holds.

The observation that supplies `lastModified` must name the installed inode, not whatever path string is current at a later lookup. A lookup that fails after `register_created_entry` has returned must not become the command's error: the entry and, for a file, its sidecar are already durable and registered, and today's `timestamp()?` is exactly that post-registration failure (`file_workspace.rs:885-901` and `:967-1000`).

Environments that count are the ones `infra/fs.rs` already splits: Unix (Linux and macOS share the `cfg(unix)` stat path) and Windows.

Non-goals, frozen with this model: directory-identity failure rollback, listing bounds, resolve error categories, root-path wrapper deduplication, renderer copy, and full-precision schema-cache mtimes.

## Traced premises

* `timestamp` is `fs::metadata(path)?.modified()?` and rejects a pre-1970 time with `Error::InvalidInput` (`file_workspace.rs:184-190`). `listed_mtime` documents the opposite renderer contract: `lastModified` is a plain `i64` of Unix seconds, and a negative value is a real date (`file_workspace.rs:172-181`). The enumerator stores `stat.st_mtime` with no nanoseconds (`infra/fs.rs:163-168`). Windows enumeration converts `LastWriteTime` only through `filetime_to_unix_seconds` (`infra/fs.rs:2846-2854`).
* File install already `fstat`s the still-open temporary descriptor after `renameat` and before any pathname lookup, and returns that identity on `AtomicInstalledFile` without returning the descriptor (`infra/fs.rs:4903-4905`, `1759-1767`, `363-367`). A failed post-rename metadata read returns `CommittedDurabilityUncertain` with the pre-rename `fstat` of the same descriptor (`infra/fs.rs:932-949`). Rename does not change that inode's mtime.
* Directory install does not keep a descriptor: Unix `mkdirat` plus `sync_all` (`infra/fs.rs:4436-4443`); Windows opens a handle and drops it (`infra/fs.rs:3090-3104`). The next observation is `entry_identity_at` on the retained parent, before registration (`file_workspace.rs:965-975`). Its Unix body is one `statat(AT_SYMLINK_NOFOLLOW)` (`infra/fs.rs:4409-4424`). Its Windows body opens a handle and reads `opened_file_identity`; `platform_support.rs` test `windows_identity_is_read_from_the_retained_handle` (`:937-951`) requires that call to appear in the `entry_identity_at` body itself.
* `entry_identity_at`'s return type is `(u64, u64)`. Callers outside create include `db/mod.rs`, `db/search_index.rs`, and `path_authority`. Changing that return type is not required.
* Production R3 count for `src-tauri/src/file_workspace.rs` is 1 (`scripts/check-rust-release-surface.mjs:32-34`). An allowlist entry with zero production matches must be removed (`check-rust-release-surface.mjs:501-503`). `d-20260901-03` makes the allowlist shrink-only. `#[cfg(test)]` metadata in `file_workspace.rs` is not a production match.
* `d-20261001-06` requires full-precision `SystemTime` mtime for `probe_regular_file_at` / the schema cache. `WorkspaceEntry.lastModified` is the enumerator's whole seconds, not that probe.
* Inherited W6 is this defect, split out of the enumeration mandate. W17 (create-path guard untested) was moot only because W6 was out of that mandate; the race witness below is that test. W24 (where create-path components come from) stays out of scope: registration still calls `workspace_components` inside `register_created_entry` (`file_workspace.rs:247-256`).

## Approach

### Installed-file seconds come from the post-rename fstat

The file create path answers the open question with the first option. The atomic-replace helper already holds the descriptor and already `fstat`s it after the rename. It does not start returning that descriptor.

`TempMetadata` and `AtomicInstalledFile` gain `modified_seconds: i64`, filled from the same metadata read that fills `identity` and `ctime_nanos`, on both the post-rename read and the pre-rename fallback. Unix uses the same `stat.st_mtime` expression as `DirectoryEntry.modified_seconds`. Windows converts that handle's `LastWriteTime` with `filetime_to_unix_seconds`, the only conversion the enumerator uses. A tick count that does not fit `i64` must not panic; every value that fits uses `filetime_to_unix_seconds` unchanged.

`create_workspace_file_blocking` sets `last_modified` from `installed.modified_seconds`. It does not call `timestamp`, `fs::metadata`, or `Path::metadata`. A post-rename metadata failure stays the helper's existing `CommittedDurabilityUncertain` outcome and still carries the fallback seconds of that same inode. The caller keeps today's behavior of returning that durability error after registration (`file_workspace.rs:903-905`) and does not add a new error for the seconds.

Rejected for the file path: an identity-checked `statat` of the installed name. It can fail, or observe a replacement, after the PGN and sidecar are durable. Rejected: moving today's pathname `timestamp` to before registration. It is still the R3 reach, and a replacement in that window is still the wrong object.

### Directory seconds come from the pre-registration identity observation

`create_dir_at` does not retain a descriptor, so the file-path `fstat` is not available. The directory create path uses one observation through the retained parent, the same observation as `entry_identity_at`, and it happens before `register_created_entry`.

That observation returns the identity `entry_identity_at` returns today and `modified_seconds` from the same stat or the same opened handle. `entry_identity_at` keeps the `(u64, u64)` return and its current errors. Its Windows body continues to contain `opened_file_identity` so `windows_identity_is_read_from_the_retained_handle` stays true. One stat or one handle open produces both values; `entry_identity_at` and the directory create path must not each grow a second lookup that can disagree.

`create_workspace_directory_inner` stores those seconds and does not stat after registration. A failure of the observation stays where `entry_identity_at` fails today: the directory exists, nothing is registered, and this plan adds no rollback. That leak is pre-existing and outside the mandate.

The name can still be replaced between `create_dir_at` and this observation. That window is the one `entry_identity_at` already has. This plan does not widen it and does not add a later pathname lookup after registration, which is the lookup the mandate removes.

### One renderer value, then delete the pathname helper

Both create paths assign that `i64` to `WorkspaceEntry.lastModified`. Subseconds are discarded the way the enumerator discards them. A pre-1970 time is a negative `i64`, not `Error::InvalidInput`. `timestamp` is deleted. No production pathname filesystem reach remains in `file_workspace.rs`.

Remove `src-tauri/src/file_workspace.rs` from `INITIAL_FS_SURFACE_ALLOWLIST` and from `INITIAL_FS_SURFACE_COUNTS`. Do not change `src-tauri/src/fs.rs`'s count. Add the same "left the baseline" pin `credentials.rs` has in `scripts/check-rust-release-surface-core.test.mjs` (`:395-398`) for `file_workspace.rs`.

`timestamps_and_durability_outcomes_remain_renderer_safe` calls `timestamp` (`file_workspace.rs:3188-3192`). Keep its durability assertions. Delete the pathname `timestamp` assertion rather than reintroducing the helper for the test.

No Specta type changes. `lastModified` stays `i64`. No frontend change.

### Verification

Level: unit tests plus the release-surface checker. No browser and no dev server. The value is not a new visible control; it is the seconds the create response already returns.

File witness, in `infra/fs` tests: `atomic_replace_at_identified` on a new leaf returns `modified_seconds` equal to that inode's enumerator's seconds. Set the written file's mtime before the epoch inside the write closure and assert the returned seconds are negative and equal to that `st_mtime` (Unix) or `filetime_to_unix_seconds` (Windows). This is the witness that `duration_since` is gone.

Race witness, Unix, both create paths: arm `WORKSPACE_CREATED_CHILD_PRE_REGISTER_HOOK`, which runs inside `register_created_entry` after install and before the registry write (`file_workspace.rs:257-261`). In the hook, remember the installed object's seconds, rename it aside, and put a different object of the same kind at the same leaf with a different mtime. The returned `last_modified` equals the installed object's seconds, not the replacement's. The hook is `cfg(all(test, unix))`; do not add a Windows hook. Windows is covered by the helper test above and by the surface gate.

Surface witness: `pnpm rust:surface:check` exits 0, and the new baseline pin fails if `file_workspace.rs` is put back on the allowlist.

## Decisions and trade-offs

### Decided autonomously

* **Question:** which of the three options in the open question supplies create-path mtime?
  * **Chosen:** post-rename `fstat` seconds returned on `AtomicInstalledFile` for files; the existing pre-registration parent observation, extended to return the same seconds, for directories.
  * **Rejected:** a `statat` after registration (fails or observes a replacement after the durable commit). Rejected: moving pathname `timestamp` earlier (keeps the R3 site and the wrong-object window).
  * **Reason:** the file helper already `fstat`s the installed inode before the name can be looked up. The directory helper never held a descriptor; its identity stat is the last observation before registration. Recorded at adoption with `findings.py record-decision`, not by this planner.

* **Question:** whole seconds or `RegularFileMetadata`'s `SystemTime`?
  * **Chosen:** the enumerator's signed Unix seconds.
  * **Rejected:** nanosecond `SystemTime` from `d-20261001-06`.
  * **Reason:** that decision governs the schema-cache probe. `WorkspaceEntry.lastModified` is the field `DirectoryEntry.modified_seconds` already fills. A create response and a later listing of an untouched file report the same integer.

* **Question:** one phase or a split between `infra/fs.rs` and `file_workspace.rs`?
  * **Chosen:** one phase. The new field is unused until the create path consumes it, and the allowlist shrink is false until `timestamp` is gone.
  * **Rejected:** shipping the struct field alone.

## Risks / open questions

None that change the mechanism. Known limit, stated rather than solved: a directory name replaced between `create_dir_at` and the identity observation is attributed as today's `entry_identity_at` attributes it. The returned seconds belong to that same observation, so they cannot name a different object than the registered identity.

## Not part of this task

* `f-20260913-03` (root-path wrappers), `f-20260913-04` (resolve `Conflict` category), `f-20260913-05` (listing error copy), `f-20260913-06` (listing bounds and failed-listing registry churn).
* W24's component source. Registration is unchanged.
* Rollback when directory identity observation fails.
* `src-tauri/src/fs.rs` allowlist count.
* Renderer, bindings, and browser verification.

## Phases

### Phase 1 — Create-path seconds and the allowlist shrink

Files: `src-tauri/src/infra/fs.rs`, `src-tauri/src/file_workspace.rs`, `src-tauri/src/infra/platform_support.rs` only if a Windows identity pin must follow a body that still contains `opened_file_identity`, `scripts/check-rust-release-surface.mjs`, `scripts/check-rust-release-surface-core.test.mjs`.

Touches filesystem identity and mtime. No auth, persistence schema, concurrency primitive, or IPC contract change. The `workspace_mutation` lock and registration order stay as they are.

Role: `sensitive` (`src-tauri/src/infra/**`).

PROOF:

```bash
cargo fmt --manifest-path src-tauri/Cargo.toml -- --check
cargo test --manifest-path src-tauri/Cargo.toml --locked --lib infra::fs:: -- --test-threads=8
cargo test --manifest-path src-tauri/Cargo.toml --locked --lib file_workspace:: -- --test-threads=8
cargo test --manifest-path src-tauri/Cargo.toml --locked --lib infra::platform_support:: -- --test-threads=8
pnpm rust:surface:check
pnpm exec vitest run scripts/check-rust-release-surface-core.test.mjs
```

A red proof is a red phase. `pnpm checks:pre-review` is the adopting session's pre-review block, not a substitute for this proof.

## Carried to diff review

None.

## Decided autonomously

See Decisions and trade-offs. The adopting session records the mtime-source decision. This planner does not write `tasks/decisions.md`.

### plan-r2.md

# Plan: Workspace create mtime without a pathname reach

## Goal

`create_workspace_file` and `create_workspace_directory` return `WorkspaceEntry.lastModified` as the signed Unix seconds of the object this call installed, taken from the observation that already identified that object. They do not look the new name up again by pathname, and a failure of that observation is not introduced after the entry is registered.

## MANDATE

### Workspace create paths read the new entry's modification time back by pathname

* **ID:** f-20260913-02 · **Status:** open · **Area:** native-fs · **Root:** - · **Entry:** build · **Blocked:** none
* **Where:** `src-tauri/src/file_workspace.rs` — `timestamp` (`:154-159`, `fs::metadata(path)`), called by `create_workspace_file_blocking` (`:683`) and `create_workspace_directory_inner` (`:781`) after the entry was installed through a retained parent descriptor and registered.
* **Defect:** both create paths install the new entry descriptor-relative (`atomic_replace_at_identified`, `create_dir_at`) and register it with the installed identity, then compute `last_modified` by reopening `parent_target.path().join(name)` by pathname. A rename in that window returns the modification time of a different object, and the reach is one of `file_workspace.rs`'s counted R3 sites in `INITIAL_FS_SURFACE_COUNTS`.
* **Open question:** where does the create path take the mtime without a pathname reach and without turning a post-commit race into an error after the entry and its sidecar are already durable and registered — `fstat` of a descriptor retained from the install (the atomic-replace helpers do not return one today), an identity-checked `statat` through the retained parent (which can fail after the durable commit), or reordering the stat before registration?
* **Why it matters:** it is the last production filesystem reach in `file_workspace.rs` once `f-20260905-05` lands; closing it removes the file from the allowlist.
* **Related:** `f-20260905-05` (its plan review split this out as outside that mandate — `timestamp` is metadata, not directory enumeration).
* **Found by:** Claude Code, plan review of `tasks/plans/2026-09-13-workspace-directory-enumeration.md` (`review-minimalism`, `review-root-cause`, `review-tauri-security`), 2026-09-13.

* **Inherited review history (2026-09-13):** load `tasks/handoffs/2026-09-13-workspace-directory-enumeration-review.md` before this finding's plan review. It carries the `f-20260905-05` plan-review record; this finding inherits issue IDs W6, W17 and W24 from it, with their witnesses, dispositions and evidence.

Line numbers in the mandate are the filing's. Locate re-found the same functions at `timestamp` `file_workspace.rs:184-190`, the file call at `:901`, and the directory call at `:1000`.

## Threat model and non-goals

The parent directory is a workspace the user already granted. Another process, or another call that holds no `workspace_mutation` lock, can rename or replace the new leaf after this call's install. That is the adversary the defect names. It is not a cross-user privilege boundary and not a symlink escape of the parent: the parent descriptor is the one the mutation target already holds.

The observation that supplies `lastModified` must name the installed inode, not whatever path string is current at a later lookup. A lookup that fails after `register_created_entry` has returned must not become the command's error: the entry and, for a file, its sidecar are already durable and registered, and today's `timestamp()?` is exactly that post-registration failure (`file_workspace.rs:885-901` and `:967-1000`).

Environments that count are the ones `infra/fs.rs` already splits: Unix (Linux and macOS share the `cfg(unix)` stat path) and Windows.

Non-goals, frozen with this model: directory-identity failure rollback, listing bounds, resolve error categories, root-path wrapper deduplication, renderer copy, and full-precision schema-cache mtimes.

## Traced premises

* `timestamp` is `fs::metadata(path)?.modified()?` and rejects a pre-1970 time with `Error::InvalidInput` (`file_workspace.rs:184-190`). `listed_mtime` documents the opposite renderer contract: `lastModified` is a plain `i64` of Unix seconds, and a negative value is a real date (`file_workspace.rs:172-181`). The enumerator stores `stat.st_mtime` with no nanoseconds (`infra/fs.rs:163-168`). Windows enumeration converts `LastWriteTime` only through `filetime_to_unix_seconds` (`infra/fs.rs:2846-2854`).
* File install already `fstat`s the still-open temporary descriptor after `renameat` and before any pathname lookup, and returns that identity on `AtomicInstalledFile` without returning the descriptor (`infra/fs.rs:4903-4905`, `1759-1767`, `363-367`). The pre-rename `fstat` is `fallback_metadata` (`infra/fs.rs:902-913`). A failed post-rename metadata read returns `CommittedDurabilityUncertain` with that fallback's identity and ctime (`infra/fs.rs:940-949`). The success path returns the post-rename `fstat`. This plan does not claim those two clock readings are equal. The caller uses the reading the helper actually returned.
* Directory install does not keep a descriptor: Unix `mkdirat` plus `sync_all` (`infra/fs.rs:4436-4443`); Windows opens a handle and drops it (`infra/fs.rs:3090-3104`). The next observation is `entry_identity_at` on the retained parent, before registration (`file_workspace.rs:965-975`). Its Unix body is one `statat(AT_SYMLINK_NOFOLLOW)` (`infra/fs.rs:4409-4424`). Its Windows body opens a handle and reads `opened_file_identity`; `platform_support.rs` test `windows_identity_is_read_from_the_retained_handle` (`:937-951`) requires that call to appear in the `entry_identity_at` body itself.
* `entry_identity_at`'s return type is `(u64, u64)`. Callers outside create include `db/mod.rs`, `db/search_index.rs`, and `path_authority`. Changing that return type is not required.
* Production R3 count for `src-tauri/src/file_workspace.rs` is 1 (`scripts/check-rust-release-surface.mjs:32-34`). An allowlist entry with zero production matches must be removed (`check-rust-release-surface.mjs:501-503`). `d-20260901-03` makes the allowlist shrink-only. `#[cfg(test)]` metadata in `file_workspace.rs` is not a production match.
* `d-20261001-06` requires full-precision `SystemTime` mtime for `probe_regular_file_at` / the schema cache. `WorkspaceEntry.lastModified` is the enumerator's whole seconds, not that probe.
* Inherited W6 is this defect, split out of the enumeration mandate. W17 (create-path guard untested) was moot only because W6 was out of that mandate; the race witness below is that test. W24 (where create-path components come from) stays out of scope: registration still calls `workspace_components` inside `register_created_entry` (`file_workspace.rs:247-256`).

## Approach

### Installed-file seconds come from the post-rename fstat

The file create path answers the open question with the first option. The atomic-replace helper already holds the descriptor and already `fstat`s it after the rename. It does not start returning that descriptor.

`TempMetadata` and `AtomicInstalledFile` gain `modified_seconds: i64`, filled from the same metadata read that fills `identity` and `ctime_nanos`, on both the post-rename read and the pre-rename fallback. Unix uses the same `stat.st_mtime` expression as `DirectoryEntry.modified_seconds`. Windows takes that handle's `LastWriteTime` tick word and interprets those bits as `i64`, which is how enumeration already stores `FILE_ID_BOTH_DIR_INFORMATION.LastWriteTime` (`infra/fs.rs:2938`) before `filetime_to_unix_seconds` (`infra/fs.rs:3049`). `std` reports the same word as `u64` (`infra/fs.rs:3761`). The conversion is `filetime_to_unix_seconds` of that `i64` bit pattern, including a high bit that becomes negative. It does not panic, saturate, or return an error. A value whose bits already fit the enumerator's `i64` uses `filetime_to_unix_seconds` unchanged. `windows_filetime_ticks_become_unix_seconds` already pins `filetime_to_unix_seconds(-1)` (`infra/fs.rs:8657-8659`); the create path's `u64` word `u64::MAX` is those same bits.

`create_workspace_file_blocking` sets `last_modified` from `installed.modified_seconds`. It does not call `timestamp`, `fs::metadata`, or `Path::metadata`. A post-rename metadata failure stays the helper's existing `CommittedDurabilityUncertain` outcome and still carries the fallback seconds of that same inode. The caller keeps today's behavior of returning that durability error after registration (`file_workspace.rs:903-905`) and does not add a new error for the seconds.

Rejected for the file path: an identity-checked `statat` of the installed name. It can fail, or observe a replacement, after the PGN and sidecar are durable. Rejected: moving today's pathname `timestamp` to before registration. It is still the R3 reach, and a replacement in that window is still the wrong object.

### Directory seconds come from the pre-registration identity observation

`create_dir_at` does not retain a descriptor, so the file-path `fstat` is not available. The directory create path uses one observation through the retained parent, the same observation as `entry_identity_at`, and it happens before `register_created_entry`.

Directory create calls one function once and uses both values from that single return. It does not also call `entry_identity_at`. `entry_identity_at` keeps the `(u64, u64)` return and its current errors; it may call the same function and discard the seconds, so its other callers stay unchanged. The function that opens the Windows handle contains `opened_file_identity` in its braced body. If that function is still `entry_identity_at`, `windows_identity_is_read_from_the_retained_handle` (`platform_support.rs:937-951`) stays as it is. If the open moves, that pin's signature list follows the body that still contains the call. The same braced body contains `filetime_to_unix_seconds`, so a raw FILETIME cannot satisfy the pin. One stat or one handle open produces both values.

`create_workspace_directory_inner` stores those seconds and does not stat after registration. A failure of the observation stays where `entry_identity_at` fails today: the directory exists, nothing is registered, and this plan adds no rollback. That leak is pre-existing and outside the mandate.

The name can still be replaced between `create_dir_at` and this observation. That window is the one `entry_identity_at` already has. This plan does not widen it and does not add a later pathname lookup after registration, which is the lookup the mandate removes.

### One renderer value, then delete the pathname helper

Both create paths assign that `i64` to `WorkspaceEntry.lastModified`. Subseconds are discarded the way the enumerator discards them. A pre-1970 time is a negative `i64`, not `Error::InvalidInput`. `timestamp` is deleted. No production pathname filesystem reach remains in `file_workspace.rs`.

Remove `src-tauri/src/file_workspace.rs` from `INITIAL_FS_SURFACE_ALLOWLIST` and from `INITIAL_FS_SURFACE_COUNTS`. Do not change `src-tauri/src/fs.rs`'s count. Extend the existing `credentials.rs` baseline pin (`scripts/check-rust-release-surface-core.test.mjs:395-398`) so one assertion covers both paths. Do not add a second test with the same body.

`timestamps_and_durability_outcomes_remain_renderer_safe` calls `timestamp` (`file_workspace.rs:3188-3192`). Keep its durability assertions. Delete the pathname `timestamp` assertion rather than reintroducing the helper for the test.

No Specta type changes. `lastModified` stays `i64`. No frontend change.

### Verification

Level: unit tests plus the release-surface checker. No browser and no dev server. The value is not a new visible control; it is the seconds the create response already returns.

File success witness, in `infra/fs` tests: `atomic_replace_at_identified` on a new leaf returns `modified_seconds` equal to that inode's enumerator's seconds. Set the written file's mtime before the epoch inside the write closure and assert the returned seconds are negative and equal to that `st_mtime` (Unix) or `filetime_to_unix_seconds` of the same tick bits (Windows). This is the witness that `duration_since` is gone.

File fallback witness, Unix and Windows: inject `AtomicFileFaultPoint::PostRenameMetadata` (the failure branch at `infra/fs.rs:940-949`; the Windows test at `infra/fs.rs:9021` checks outcome and identity only). Set the mtime, including a pre-epoch value, inside the write closure. The returned `modified_seconds` equal that pre-rename reading of the same descriptor, and the outcome stays `CommittedDurabilityUncertain`. This does not prove that rename preserves mtime.

Registration race witness, Unix, both create paths: arm `WORKSPACE_CREATED_CHILD_PRE_REGISTER_HOOK`, which runs inside `register_created_entry` after install and after the directory observation, before the registry write (`file_workspace.rs:257-261`). In the hook, remember the installed object's seconds, rename it aside, and put a different object of the same kind at the same leaf with a different mtime. The returned `last_modified` equals the installed object's seconds, not the replacement's. This catches a pathname stat after that hook. It does not catch two lookups before the hook.

Same-observation witness, Unix, directory only: a `cfg(all(test, unix))` hook inside the single observation, after that stat's identity and seconds are copied and before the function returns. The hook swaps the new directory for another directory with a different mtime. The identity and `last_modified` returned to `create_workspace_directory_inner` both name the pre-swap directory. A second lookup would return the replacement's seconds. Do not add a Windows hook.

Windows directory witness: the source pin above, plus a `#[cfg(windows)]` test that `create_workspace_directory` returns `last_modified` equal to the enumerator's seconds for that directory. `rust-windows-test` is the runtime proof. This machine does not run that test.

Tick-word witness, Windows: a unit test that the create-path conversion of a `u64` tick word equals `filetime_to_unix_seconds` of those bits as `i64`, for a pre-epoch value that fits and for `u64::MAX`, and does not panic. Extend `windows_filetime_ticks_become_unix_seconds` rather than setting an unrepresentable filesystem mtime.

Surface witness: `pnpm rust:surface:check` exits 0, and the shared baseline pin fails if `file_workspace.rs` is put back on the allowlist.

Platform proof, named rather than newly built: `pnpm rust:windows:check` is the local Windows compile. After push, `rust-macos-test` is the runtime proof of the shared `cfg(unix)` path, `rust-windows-test` is the runtime proof of the `cfg(windows)` path, and `rust-platform` is the MSVC compile of that Windows code. The new reads stay on the existing `cfg(unix)` and `cfg(windows)` adapters. This phase adds no `target_os = "linux"` branch, so the FreeBSD source probe is not applicable. If an edit adds one, the adopting session flips `target_os = "linux"` to `target_os = "freebsd"` in the touched files, compiles, and reverts before commit. The phase leaf does not leave that flip in the tree.

## Decisions and trade-offs

### Decided autonomously

* **Question:** which of the three options in the open question supplies create-path mtime?
  * **Chosen:** post-rename `fstat` seconds returned on `AtomicInstalledFile` for files; the existing pre-registration parent observation, extended to return the same seconds, for directories.
  * **Rejected:** a `statat` after registration (fails or observes a replacement after the durable commit). Rejected: moving pathname `timestamp` earlier (keeps the R3 site and the wrong-object window).
  * **Reason:** the file helper already `fstat`s the installed inode before the name can be looked up. The directory helper never held a descriptor; its identity stat is the last observation before registration. Recorded at adoption with `findings.py record-decision`, not by this planner.

* **Question:** whole seconds or `RegularFileMetadata`'s `SystemTime`?
  * **Chosen:** the enumerator's signed Unix seconds.
  * **Rejected:** nanosecond `SystemTime` from `d-20261001-06`.
  * **Reason:** that decision governs the schema-cache probe. `WorkspaceEntry.lastModified` is the field `DirectoryEntry.modified_seconds` already fills. A create response and a later listing of an untouched file report the same integer.

* **Question:** one phase or a split between `infra/fs.rs` and `file_workspace.rs`?
  * **Chosen:** one phase. The new field is unused until the create path consumes it, and the allowlist shrink is false until `timestamp` is gone.
  * **Rejected:** shipping the struct field alone.

## Risks / open questions

None that change the mechanism. Known limit, stated rather than solved: a directory name replaced between `create_dir_at` and the identity observation is attributed as today's `entry_identity_at` attributes it. The returned seconds belong to that same observation, so they cannot name a different object than the registered identity.

## Not part of this task

* `f-20260913-03` (root-path wrappers), `f-20260913-04` (resolve `Conflict` category), `f-20260913-05` (listing error copy), `f-20260913-06` (listing bounds and failed-listing registry churn).
* W24's component source. Registration is unchanged.
* Rollback when directory identity observation fails.
* `src-tauri/src/fs.rs` allowlist count.
* Renderer, bindings, and browser verification.

## Phases

### Phase 1 — Create-path seconds and the allowlist shrink

Files: `src-tauri/src/infra/fs.rs`, `src-tauri/src/file_workspace.rs`, `src-tauri/src/infra/platform_support.rs` only if a Windows identity pin must follow a body that still contains `opened_file_identity`, `scripts/check-rust-release-surface.mjs`, `scripts/check-rust-release-surface-core.test.mjs`.

Touches filesystem identity and mtime. No auth, persistence schema, concurrency primitive, or IPC contract change. The `workspace_mutation` lock and registration order stay as they are.

Role: `sensitive` (`src-tauri/src/infra/**`).

PROOF:

```bash
cargo fmt --manifest-path src-tauri/Cargo.toml -- --check
cargo test --manifest-path src-tauri/Cargo.toml --locked --lib infra::fs:: -- --test-threads=8
cargo test --manifest-path src-tauri/Cargo.toml --locked --lib file_workspace:: -- --test-threads=8
cargo test --manifest-path src-tauri/Cargo.toml --locked --lib infra::platform_support:: -- --test-threads=8
pnpm rust:windows:check
pnpm rust:surface:check
pnpm exec vitest run scripts/check-rust-release-surface-core.test.mjs
```

A red proof is a red phase. `pnpm checks:pre-review` is the adopting session's pre-review block, not a substitute for this proof.

## Carried to diff review

* **CR-1.** The baseline pin is one assertion over `src-tauri/src/credentials.rs` and `src-tauri/src/file_workspace.rs`, not a second copy of the `credentials.rs` test body. The obligation is unchanged: putting `file_workspace.rs` back on the allowlist or the counts object fails the pin.

## Decided autonomously

See Decisions and trade-offs. The adopting session records the mtime-source decision. This planner does not write `tasks/decisions.md`.

## Reviews

Round 1 wall time is `plan-meta.json` `review.per_round_seconds`. Twelve plan-capable lenses. `review-code-quality` and `review-root-cause` are `plan-review: false` and were not launched. No quota wait.

Raw verdicts, unchanged:

* chess-semantics APPROVED. `NOT APPLICABLE: The files and mandate concern filesystem modification-time observations; they do not involve an in-memory chess tree, position, or move path.`
* correctness APPROVED. No findings.
* engine-protocol APPROVED. `NOT APPLICABLE: The plan concerns filesystem timestamps and release-surface checks; it does not touch engine processes, UCI state, or asynchronous engine-result routing.`
* error-handling APPROVED. No findings.
* ipc-contract APPROVED. No IPC-contract defects. `lastModified` stays a signed Unix-seconds value.
* minimalism REVISE. One finding, M6.
* persisted-state APPROVED. `NOT APPLICABLE: The plan concerns Rust filesystem modification-time observations and release-surface checks; it has no renderer state, storage keys, or tab lifecycle.`
* pgn-index APPROVED. `NOT APPLICABLE: The plan concerns filesystem metadata for workspace creation; it does not touch PGN scanning, indexing, encoding, or searching.`
* plan REVISE. Two findings, M1 and M2.
* platform-semantics REVISE. Three findings, M5, M1, M4.
* tauri-security APPROVED. No findings.
* tests REVISE. Four findings, M3, M1, M2, M4.

### M1 — Fallback seconds have no witness

* **Claim:** The file witness never injects `PostRenameMetadata`, so the promised fallback seconds can be missing and the proof stays green. The sentence "rename does not change mtime" was not measured.
* **Witnesses:** plan r1 finding 1 (blocker); platform-semantics r1 finding 2 (should-fix); tests r1 finding 2 (should-fix).
* **Evidence:** `infra/fs.rs:902-913` saves `fallback_metadata` before rename. `infra/fs.rs:940-949` returns that identity and ctime on post-rename metadata failure, with `CommittedDurabilityUncertain`. `infra/fs.rs:9021-9047` asserts outcome, identity, and bytes, not seconds. No unix test injects `PostRenameMetadata`.
* **MANDATE:** the open question forbids turning a post-commit metadata failure into an error after the durable commit, and the returned seconds must name the installed inode.
* **Disposition:** Fix. The success path returns the post-rename fstat. The failure path returns the pre-rename fstat of the same descriptor. The plan no longer claims those readings match. Verification adds the fault witness, including a pre-epoch mtime, on Unix and Windows.
* **Authority:** MANDATE open question, third option rejected; fallback is the first option's failure branch already in the traced install.
* **Closure:** round 2.

### M2 — Windows directory seconds are unproved

* **Claim:** The file helper and the Unix race do not exercise the Windows directory observation. A raw FILETIME could pass every stated witness.
* **Witnesses:** plan r1 finding 2 (blocker); tests r1 finding 3 (should-fix).
* **Evidence:** Windows `entry_identity_at` (`infra/fs.rs:3107-3113`) returns only `(u64, u64)` from `opened_file_identity`. `windows_identity_is_read_from_the_retained_handle` (`platform_support.rs:937-951`) checks that call and not the conversion. Enumeration converts with `filetime_to_unix_seconds` (`infra/fs.rs:3049`).
* **MANDATE:** both create paths, on the environments the threat model names, return the installed object's listing seconds.
* **Disposition:** Fix. Directory create uses one observation that returns identity and seconds. A source pin requires `filetime_to_unix_seconds` in that Windows body. A `#[cfg(windows)]` create test compares `last_modified` to the enumerator. `rust-windows-test` runs it.
* **Authority:** MANDATE "both create paths" and the threat-model sentence that Windows counts.
* **Closure:** round 2.

### M3 — The directory race hook is too late to prove one observation

* **Claim:** `WORKSPACE_CREATED_CHILD_PRE_REGISTER_HOOK` runs after `entry_identity_at` has returned. Two lookups before registration can return seconds for a different object while that test passes.
* **Witnesses:** tests r1 finding 1 (blocker).
* **Evidence:** `create_workspace_directory_inner` calls `entry_identity_at` at `file_workspace.rs:966` and then `register_created_entry` at `:967`. The hook is inside registration at `:257-261`.
* **MANDATE:** the seconds and the registered identity name the same installed object. The open question's pathname window is the defect.
* **Disposition:** Fix. Directory create calls one function once and does not also call `entry_identity_at`. A unix hook inside that observation, after the copy and before return, swaps the directory. Identity and seconds must both be the pre-swap object. The pre-register hook stays as the witness that nothing restats after that point. No Windows hook.
* **Authority:** MANDATE defect (a rename returns a different object's mtime) plus the plan's own "one stat" sentence, which the round-1 witness did not enforce.
* **Closure:** round 2.

### M4 — An out-of-range Windows tick word has no defined result

* **Claim:** "Must not panic" does not say what a `u64` tick word outside `i64` becomes, and the pre-epoch witness uses a value that fits.
* **Witnesses:** platform-semantics r1 finding 3 (should-fix); tests r1 finding 4 (should-fix).
* **Evidence:** `filetime_to_unix_seconds` takes `i64` (`infra/fs.rs:2850-2854`). Enumeration stores `header.LastWriteTime` as `i64` (`infra/fs.rs:2938`). The handle metadata path reads `last_write_time()` as `u64` (`infra/fs.rs:3761`). `windows_filetime_ticks_become_unix_seconds` pins `filetime_to_unix_seconds(-1)` (`infra/fs.rs:8659`).
* **MANDATE:** create and a later listing of an untouched file report the same integer. The enumerator already interprets the tick bits as `i64`.
* **Disposition:** Fix. The create path passes those bits to `filetime_to_unix_seconds` as `i64`, including the high bit. It does not saturate or error. The witness covers a fitting pre-epoch value and `u64::MAX`.
* **Authority:** the decided contract that create seconds equal the enumerator's seconds. A saturating converter would be a second conversion.
* **Closure:** round 2.

### M5 — Platform proof jobs were unnamed

* **Claim:** Host tests and the surface gate do not prove Windows or macOS, and the plan omitted `pnpm rust:windows:check` and the FreeBSD probe.
* **Witnesses:** platform-semantics r1 finding 1 (should-fix).
* **Evidence:** Push skill names `pnpm rust:windows:check` at `.claude/skills/push/SKILL.md:108` as the local compile, and `rust-windows-test`, `rust-macos-test`, and `rust-platform` at `:376` as the jobs this machine cannot run. The new reads sit on the existing `cfg(unix)` fstat (`infra/fs.rs:1759-1767`) and `cfg(windows)` metadata (`infra/fs.rs:3758-3766`). `AtomicInstalledFile` and `TempMetadata` literals are in shared or cfg-split adapters already compiled on Linux (`infra/fs.rs:944`, `:957`, `:969`, `:1763`, `:3763`, `:4936`). This change adds no `target_os = "linux"` branch.
* **Disposition:** Fix. PROOF includes `pnpm rust:windows:check`. The plan names the three CI jobs. The FreeBSD probe is not applicable unless an edit adds a `target_os = "linux"` branch; the plan forbids that branch. No new probe harness.
* **Authority:** the lens's platform-proof rule, which is the verification level for the threat model's Unix and Windows environments. Not a new CI mechanism.
* **Closure:** round 2.

### M6 — Baseline pin would duplicate the credentials test

* **Claim:** A second "left the baseline" test copies the `credentials.rs` assertions.
* **Witnesses:** minimalism r1 finding 1 (should-fix).
* **Evidence:** `scripts/check-rust-release-surface-core.test.mjs:395-398` is one test with two expects. The obligation is that `file_workspace.rs` stays off the allowlist and the counts object.
* **Disposition:** Fix, carried to CR-1. One assertion covers both paths. The obligation's contract is unchanged.
* **Closure:** carried, CR-1. Not a plan-level adoption.

Opened 6, resolved this round 1 (M6 carried), open for closure 5 (M1–M5). Adopted this round: 5. Carried: 1. No Skip, Defer, or withdrawal. No correction-introduced issue yet. Round 2 reviews plan, platform-semantics, and tests.

### plan-r3.md

# Plan: Workspace create mtime without a pathname reach

## Goal

`create_workspace_file` and `create_workspace_directory` return `WorkspaceEntry.lastModified` as the signed Unix seconds of the object this call installed, taken from the observation that already identified that object. They do not look the new name up again by pathname, and a failure of that observation is not introduced after the entry is registered.

## MANDATE

### Workspace create paths read the new entry's modification time back by pathname

* **ID:** f-20260913-02 · **Status:** open · **Area:** native-fs · **Root:** - · **Entry:** build · **Blocked:** none
* **Where:** `src-tauri/src/file_workspace.rs` — `timestamp` (`:154-159`, `fs::metadata(path)`), called by `create_workspace_file_blocking` (`:683`) and `create_workspace_directory_inner` (`:781`) after the entry was installed through a retained parent descriptor and registered.
* **Defect:** both create paths install the new entry descriptor-relative (`atomic_replace_at_identified`, `create_dir_at`) and register it with the installed identity, then compute `last_modified` by reopening `parent_target.path().join(name)` by pathname. A rename in that window returns the modification time of a different object, and the reach is one of `file_workspace.rs`'s counted R3 sites in `INITIAL_FS_SURFACE_COUNTS`.
* **Open question:** where does the create path take the mtime without a pathname reach and without turning a post-commit race into an error after the entry and its sidecar are already durable and registered — `fstat` of a descriptor retained from the install (the atomic-replace helpers do not return one today), an identity-checked `statat` through the retained parent (which can fail after the durable commit), or reordering the stat before registration?
* **Why it matters:** it is the last production filesystem reach in `file_workspace.rs` once `f-20260905-05` lands; closing it removes the file from the allowlist.
* **Related:** `f-20260905-05` (its plan review split this out as outside that mandate — `timestamp` is metadata, not directory enumeration).
* **Found by:** Claude Code, plan review of `tasks/plans/2026-09-13-workspace-directory-enumeration.md` (`review-minimalism`, `review-root-cause`, `review-tauri-security`), 2026-09-13.

* **Inherited review history (2026-09-13):** load `tasks/handoffs/2026-09-13-workspace-directory-enumeration-review.md` before this finding's plan review. It carries the `f-20260905-05` plan-review record; this finding inherits issue IDs W6, W17 and W24 from it, with their witnesses, dispositions and evidence.

Line numbers in the mandate are the filing's. Locate re-found the same functions at `timestamp` `file_workspace.rs:184-190`, the file call at `:901`, and the directory call at `:1000`.

## Threat model and non-goals

The parent directory is a workspace the user already granted. Another process, or another call that holds no `workspace_mutation` lock, can rename or replace the new leaf after this call's install. That is the adversary the defect names. It is not a cross-user privilege boundary and not a symlink escape of the parent: the parent descriptor is the one the mutation target already holds.

The observation that supplies `lastModified` must name the installed inode, not whatever path string is current at a later lookup. A lookup that fails after `register_created_entry` has returned must not become the command's error: the entry and, for a file, its sidecar are already durable and registered, and today's `timestamp()?` is exactly that post-registration failure (`file_workspace.rs:885-901` and `:967-1000`).

Environments that count are the ones `infra/fs.rs` already splits: Unix (Linux and macOS share the `cfg(unix)` stat path) and Windows.

Non-goals, frozen with this model: directory-identity failure rollback, listing bounds, resolve error categories, root-path wrapper deduplication, renderer copy, and full-precision schema-cache mtimes.

## Traced premises

* `timestamp` is `fs::metadata(path)?.modified()?` and rejects a pre-1970 time with `Error::InvalidInput` (`file_workspace.rs:184-190`). `listed_mtime` documents the opposite renderer contract: `lastModified` is a plain `i64` of Unix seconds, and a negative value is a real date (`file_workspace.rs:172-181`). The enumerator stores `stat.st_mtime` with no nanoseconds (`infra/fs.rs:163-168`). Windows enumeration converts `LastWriteTime` only through `filetime_to_unix_seconds` (`infra/fs.rs:2846-2854`).
* File install already `fstat`s the still-open temporary descriptor after `renameat` and before any pathname lookup, and returns that identity on `AtomicInstalledFile` without returning the descriptor (`infra/fs.rs:4903-4905`, `1759-1767`, `363-367`). The pre-rename `fstat` is `fallback_metadata` (`infra/fs.rs:902-913`). A failed post-rename metadata read returns `CommittedDurabilityUncertain` with that fallback's identity and ctime (`infra/fs.rs:940-949`). The success path returns the post-rename `fstat`. This plan does not claim those two clock readings are equal. The caller uses the reading the helper actually returned.
* Directory install does not keep a descriptor: Unix `mkdirat` plus `sync_all` (`infra/fs.rs:4436-4443`); Windows opens a handle and drops it (`infra/fs.rs:3090-3104`). The next observation is `entry_identity_at` on the retained parent, before registration (`file_workspace.rs:965-975`). Its Unix body is one `statat(AT_SYMLINK_NOFOLLOW)` (`infra/fs.rs:4409-4424`). Its Windows body opens a handle and reads `opened_file_identity`; `platform_support.rs` test `windows_identity_is_read_from_the_retained_handle` (`:937-951`) requires that call to appear in the `entry_identity_at` body itself.
* `entry_identity_at`'s return type is `(u64, u64)`. Callers outside create include `db/mod.rs`, `db/search_index.rs`, and `path_authority`. Changing that return type is not required.
* Production R3 count for `src-tauri/src/file_workspace.rs` is 1 (`scripts/check-rust-release-surface.mjs:32-34`). An allowlist entry with zero production matches must be removed (`check-rust-release-surface.mjs:501-503`). `d-20260901-03` makes the allowlist shrink-only. `#[cfg(test)]` metadata in `file_workspace.rs` is not a production match.
* `d-20261001-06` requires full-precision `SystemTime` mtime for `probe_regular_file_at` / the schema cache. `WorkspaceEntry.lastModified` is the enumerator's whole seconds, not that probe.
* Inherited W6 is this defect, split out of the enumeration mandate. W17 (create-path guard untested) was moot only because W6 was out of that mandate; the race witness below is that test. W24 (where create-path components come from) stays out of scope: registration still calls `workspace_components` inside `register_created_entry` (`file_workspace.rs:247-256`).

## Approach

### Installed-file seconds come from the post-rename fstat

The file create path answers the open question with the first option. The atomic-replace helper already holds the descriptor and already `fstat`s it after the rename. It does not start returning that descriptor.

`TempMetadata` and `AtomicInstalledFile` gain `modified_seconds: i64`, filled from the same metadata read that fills `identity` and `ctime_nanos`, on both the post-rename read and the pre-rename fallback. Unix uses the same `stat.st_mtime` expression as `DirectoryEntry.modified_seconds`. Windows takes that handle's `LastWriteTime` tick word and interprets those bits as `i64`, which is how enumeration already stores `FILE_ID_BOTH_DIR_INFORMATION.LastWriteTime` (`infra/fs.rs:2938`) before `filetime_to_unix_seconds` (`infra/fs.rs:3049`). `std` reports the same word as `u64` (`infra/fs.rs:3761`). The conversion is `filetime_to_unix_seconds` of that `i64` bit pattern, including a high bit that becomes negative. It does not panic, saturate, or return an error. A value whose bits already fit the enumerator's `i64` uses `filetime_to_unix_seconds` unchanged. `windows_filetime_ticks_become_unix_seconds` already pins `filetime_to_unix_seconds(-1)` (`infra/fs.rs:8657-8659`); the create path's `u64` word `u64::MAX` is those same bits.

`create_workspace_file_blocking` sets `last_modified` from `installed.modified_seconds`. It does not call `timestamp`, `fs::metadata`, or `Path::metadata`. A post-rename metadata failure stays the helper's existing `CommittedDurabilityUncertain` outcome and still carries the fallback seconds of that same inode. The caller keeps today's behavior of returning that durability error after registration (`file_workspace.rs:903-905`) and does not add a new error for the seconds.

Rejected for the file path: an identity-checked `statat` of the installed name. It can fail, or observe a replacement, after the PGN and sidecar are durable. Rejected: moving today's pathname `timestamp` to before registration. It is still the R3 reach, and a replacement in that window is still the wrong object.

### Directory seconds come from the pre-registration identity observation

`create_dir_at` does not retain a descriptor, so the file-path `fstat` is not available. The directory create path uses one observation through the retained parent, the same observation as `entry_identity_at`, and it happens before `register_created_entry`.

Directory create calls one observation function once and uses both values from that single return. It does not also call `entry_identity_at`. `entry_identity_at` keeps the `(u64, u64)` return and its current errors. It calls the observation and discards the seconds, so its other callers stay unchanged. The observation is the function that performs the lookup. It is not a wrapper around two lookups.

On Unix the observation body keeps today's `entry_identity_at` shape (`infra/fs.rs:4416`): exactly one `rfs::statat`. Identity is `unix::raw_stat_identity` of that `stat`. The seconds are that same `stat.st_mtime`. A `cfg(all(test, unix))` hook runs immediately after that `statat` returns and before either value is derived. The returned pair is built only from that `stat`. A source pin counts `statat` in the observation's braced body and fails unless the count is one. A second lookup cannot sit before the hook, because the hook is the next statement after the only `statat`, and a second `statat` anywhere in that body fails the count.

On Windows the observation body opens the child once with `open_expected_child` (today that open is `win::entry_identity_at`, `infra/fs.rs:3107-3113`) and reads identity with `opened_file_identity` on that handle. The seconds are `filetime_to_unix_seconds` of that same handle's `LastWriteTime` bits interpreted as `i64`, the conversion enumeration already uses (`infra/fs.rs:3049`). A new source assertion, separate from the identity-only loop at `platform_support.rs:937-951`, requires that braced body to contain `opened_file_identity`, `filetime_to_unix_seconds`, and exactly one `open_expected_child`. Because the open moves out of `entry_identity_at` into the observation, `windows_identity_is_read_from_the_retained_handle` moves its `entry_identity_at` signature onto the observation body. The other four signatures in that test stay on `assert_entry_identity`, `open_verified_parent`, `remove_regular_child`, and `remove_windows_tree_at`. A wrapper that only forwards and drops seconds does not contain `opened_file_identity` and does not satisfy the moved signature. `create_workspace_directory_inner` calls the observation once, and its body does not contain `entry_identity_at`. A source pin of `create_workspace_directory_inner` fails if either condition is broken.

One `statat` or one `open_expected_child` produces both values. Do not add a Windows swap hook. The Windows proof that both values come from one open is the source count, not a runtime swap.

`create_workspace_directory_inner` stores those seconds and does not stat after registration. A failure of the observation stays where `entry_identity_at` fails today: the directory exists, nothing is registered, and this plan adds no rollback. That leak is pre-existing and outside the mandate.

The name can still be replaced between `create_dir_at` and this observation. That window is the one `entry_identity_at` already has. This plan does not widen it and does not add a later pathname lookup after registration, which is the lookup the mandate removes.

### One renderer value, then delete the pathname helper

Both create paths assign that `i64` to `WorkspaceEntry.lastModified`. Subseconds are discarded the way the enumerator discards them. A pre-1970 time is a negative `i64`, not `Error::InvalidInput`. `timestamp` is deleted. No production pathname filesystem reach remains in `file_workspace.rs`.

Remove `src-tauri/src/file_workspace.rs` from `INITIAL_FS_SURFACE_ALLOWLIST` and from `INITIAL_FS_SURFACE_COUNTS`. Do not change `src-tauri/src/fs.rs`'s count. Extend the existing `credentials.rs` baseline pin (`scripts/check-rust-release-surface-core.test.mjs:395-398`) so one assertion covers both paths. Do not add a second test with the same body.

`timestamps_and_durability_outcomes_remain_renderer_safe` calls `timestamp` (`file_workspace.rs:3192`). Keep its durability assertions. Delete the pathname `timestamp` assertion rather than reintroducing the helper for the test.

`collect_tree_entries_lists_the_workspace_shape_on_every_platform` also calls `timestamp`, at `file_workspace.rs:3327` and `:3348`. Both assertions compare a listed `last_modified` with that helper. After `timestamp` is deleted, both comparisons stay: each listed `last_modified` equals the enumerator's whole seconds for that object (Unix `st_mtime`, Windows `filetime_to_unix_seconds` of the `LastWriteTime` bits). Do not delete the comparisons. A `#[cfg(test)]` read does not count as a production pathname reach and is not copied into production code. Do not use `duration_since`. `cargo test --lib file_workspace` does not compile while either call remains.

No Specta type changes. `lastModified` stays `i64`. No frontend change.

### Verification

Level: unit tests plus the release-surface checker. No browser and no dev server. The value is not a new visible control; it is the seconds the create response already returns.

File success witness, in `infra/fs` tests: `atomic_replace_at_identified` on a new leaf returns `modified_seconds` equal to that inode's enumerator's seconds. Set the written file's mtime before the epoch inside the write closure and assert the returned seconds are negative and equal to that `st_mtime` (Unix) or `filetime_to_unix_seconds` of the same tick bits (Windows). This is the witness that `duration_since` is gone on the helper. It is not the witness for `WorkspaceEntry.last_modified`.

Create-path negative witness, both create paths: `create_workspace_file` and `create_workspace_directory` each return a `WorkspaceEntry` whose `last_modified` is negative and equal to that object's enumerator seconds. For a file, set the pre-epoch mtime inside the write closure. For a directory, set the directory mtime before the epoch after `create_dir_at` and before the observation returns. Neither result is `Error::InvalidInput`, a clamped zero, or a `duration_since` rejection. `collect_tree_entries_lists_a_pre_epoch_entry_with_its_negative_timestamp` (`file_workspace.rs:5095`) covers listings only and is not this witness.

File fallback witness, Unix and Windows: inject `AtomicFileFaultPoint::PostRenameMetadata` (the failure branch at `infra/fs.rs:940-949`; the Windows test at `infra/fs.rs:9021` checks outcome and identity only). Set the mtime, including a pre-epoch value, inside the write closure. The returned `modified_seconds` equal that pre-rename reading of the same descriptor, and the outcome stays `CommittedDurabilityUncertain`. This does not prove that rename preserves mtime.

Registration race witness, Unix, both create paths: arm `WORKSPACE_CREATED_CHILD_PRE_REGISTER_HOOK`, which runs inside `register_created_entry` after install and after the directory observation, before the registry write (`file_workspace.rs:257-261`). In the hook, remember the installed object's seconds, rename it aside, and put a different object of the same kind at the same leaf with a different mtime. The returned `last_modified` equals the installed object's seconds, not the replacement's. This catches a pathname stat after that hook. It does not catch two lookups before the hook.

Same-observation witness, Unix, directory only: the hook is the next statement after the observation's single `statat` and before identity or seconds are derived. It is not placed after both values have already been copied, and it is not placed in a wrapper that may already have called `statat` twice. The hook swaps the new directory for another directory with a different mtime. The identity and `last_modified` returned to `create_workspace_directory_inner` both name the pre-swap directory. Any lookup after that `statat` sees the replacement, so a second `statat` before the hook would fail this test. The source pin fails a second `statat` in the braced body even when the hook is not armed. Do not add a Windows hook.

Windows directory witness: the new source assertion above, not the existing identity-only check at `platform_support.rs:948`. The observation body contains `opened_file_identity`, `filetime_to_unix_seconds`, and exactly one `open_expected_child`. `create_workspace_directory_inner` calls that observation once and does not call `entry_identity_at`. A `#[cfg(windows)]` test still checks that `create_workspace_directory` returns `last_modified` equal to the enumerator's seconds for that directory. `rust-windows-test` is the runtime proof. This machine does not run that test. The runtime comparison does not replace the source count: a normal create cannot inject a replacement between two lookups, and there is no Windows hook.

Tick-word witness, Windows: a unit test that the create-path conversion of a `u64` tick word equals `filetime_to_unix_seconds` of those bits as `i64`, for a pre-epoch value that fits and for `u64::MAX`, and does not panic. Extend `windows_filetime_ticks_become_unix_seconds` rather than setting an unrepresentable filesystem mtime.

Surface witness: `pnpm rust:surface:check` exits 0, and the shared baseline pin fails if `file_workspace.rs` is put back on the allowlist.

Platform proof, named rather than newly built: `pnpm rust:windows:check` is the local Windows compile. After push, `rust-macos-test` is the runtime proof of the shared `cfg(unix)` path, `rust-windows-test` is the runtime proof of the `cfg(windows)` path, and `rust-platform` is the MSVC compile of that Windows code. The new reads stay on the existing `cfg(unix)` and `cfg(windows)` adapters. This phase adds no `target_os = "linux"` branch, so the FreeBSD source probe is not applicable. If an edit adds one, the adopting session flips `target_os = "linux"` to `target_os = "freebsd"` in the touched files, compiles, and reverts before commit. The phase leaf does not leave that flip in the tree.

## Decisions and trade-offs

### Decided autonomously

* **Question:** which of the three options in the open question supplies create-path mtime?
  * **Chosen:** post-rename `fstat` seconds returned on `AtomicInstalledFile` for files; the existing pre-registration parent observation, extended to return the same seconds, for directories.
  * **Rejected:** a `statat` after registration (fails or observes a replacement after the durable commit). Rejected: moving pathname `timestamp` earlier (keeps the R3 site and the wrong-object window).
  * **Reason:** the file helper already `fstat`s the installed inode before the name can be looked up. The directory helper never held a descriptor; its identity stat is the last observation before registration. Recorded at adoption with `findings.py record-decision`, not by this planner.

* **Question:** whole seconds or `RegularFileMetadata`'s `SystemTime`?
  * **Chosen:** the enumerator's signed Unix seconds.
  * **Rejected:** nanosecond `SystemTime` from `d-20261001-06`.
  * **Reason:** that decision governs the schema-cache probe. `WorkspaceEntry.lastModified` is the field `DirectoryEntry.modified_seconds` already fills. A create response and a later listing of an untouched file report the same integer.

* **Question:** one phase or a split between `infra/fs.rs` and `file_workspace.rs`?
  * **Chosen:** one phase. The new field is unused until the create path consumes it, and the allowlist shrink is false until `timestamp` is gone.
  * **Rejected:** shipping the struct field alone.

## Risks / open questions

None that change the mechanism. Known limit, stated rather than solved: a directory name replaced between `create_dir_at` and the identity observation is attributed as today's `entry_identity_at` attributes it. The returned seconds belong to that same observation, so they cannot name a different object than the registered identity.

## Not part of this task

* `f-20260913-03` (root-path wrappers), `f-20260913-04` (resolve `Conflict` category), `f-20260913-05` (listing error copy), `f-20260913-06` (listing bounds and failed-listing registry churn).
* W24's component source. Registration is unchanged.
* Rollback when directory identity observation fails.
* `src-tauri/src/fs.rs` allowlist count.
* Renderer, bindings, and browser verification.

## Phases

### Phase 1 — Create-path seconds and the allowlist shrink

Files: `src-tauri/src/infra/fs.rs`, `src-tauri/src/file_workspace.rs`, `src-tauri/src/infra/platform_support.rs` (the observation source pins, including the moved `entry_identity_at` signature), `scripts/check-rust-release-surface.mjs`, `scripts/check-rust-release-surface-core.test.mjs`.

Touches filesystem identity and mtime. No auth, persistence schema, concurrency primitive, or IPC contract change. The `workspace_mutation` lock and registration order stay as they are.

Role: `sensitive` (`src-tauri/src/infra/**`).

PROOF:

```bash
cargo fmt --manifest-path src-tauri/Cargo.toml -- --check
cargo test --manifest-path src-tauri/Cargo.toml --locked --lib infra::fs:: -- --test-threads=8
cargo test --manifest-path src-tauri/Cargo.toml --locked --lib file_workspace:: -- --test-threads=8
cargo test --manifest-path src-tauri/Cargo.toml --locked --lib infra::platform_support:: -- --test-threads=8
pnpm rust:windows:check
pnpm rust:surface:check
pnpm exec vitest run scripts/check-rust-release-surface-core.test.mjs
```

A red proof is a red phase. `pnpm checks:pre-review` is the adopting session's pre-review block, not a substitute for this proof.

## Carried to diff review

* **CR-1.** The baseline pin is one assertion over `src-tauri/src/credentials.rs` and `src-tauri/src/file_workspace.rs`, not a second copy of the `credentials.rs` test body. The obligation is unchanged: putting `file_workspace.rs` back on the allowlist or the counts object fails the pin.

## Decided autonomously

See Decisions and trade-offs. The adopting session records the mtime-source decision. This planner does not write `tasks/decisions.md`.

## Reviews

Round 1 wall time is `plan-meta.json` `review.per_round_seconds`. Twelve plan-capable lenses. `review-code-quality` and `review-root-cause` are `plan-review: false` and were not launched. No quota wait.

Raw verdicts, unchanged:

* chess-semantics APPROVED. `NOT APPLICABLE: The files and mandate concern filesystem modification-time observations; they do not involve an in-memory chess tree, position, or move path.`
* correctness APPROVED. No findings.
* engine-protocol APPROVED. `NOT APPLICABLE: The plan concerns filesystem timestamps and release-surface checks; it does not touch engine processes, UCI state, or asynchronous engine-result routing.`
* error-handling APPROVED. No findings.
* ipc-contract APPROVED. No IPC-contract defects. `lastModified` stays a signed Unix-seconds value.
* minimalism REVISE. One finding, M6.
* persisted-state APPROVED. `NOT APPLICABLE: The plan concerns Rust filesystem modification-time observations and release-surface checks; it has no renderer state, storage keys, or tab lifecycle.`
* pgn-index APPROVED. `NOT APPLICABLE: The plan concerns filesystem metadata for workspace creation; it does not touch PGN scanning, indexing, encoding, or searching.`
* plan REVISE. Two findings, M1 and M2.
* platform-semantics REVISE. Three findings, M5, M1, M4.
* tauri-security APPROVED. No findings.
* tests REVISE. Four findings, M3, M1, M2, M4.

### M1 — Fallback seconds have no witness

* **Claim:** The file witness never injects `PostRenameMetadata`, so the promised fallback seconds can be missing and the proof stays green. The sentence "rename does not change mtime" was not measured.
* **Witnesses:** plan r1 finding 1 (blocker); platform-semantics r1 finding 2 (should-fix); tests r1 finding 2 (should-fix).
* **Evidence:** `infra/fs.rs:902-913` saves `fallback_metadata` before rename. `infra/fs.rs:940-949` returns that identity and ctime on post-rename metadata failure, with `CommittedDurabilityUncertain`. `infra/fs.rs:9021-9047` asserts outcome, identity, and bytes, not seconds. No unix test injects `PostRenameMetadata`.
* **MANDATE:** the open question forbids turning a post-commit metadata failure into an error after the durable commit, and the returned seconds must name the installed inode.
* **Disposition:** Fix. The success path returns the post-rename fstat. The failure path returns the pre-rename fstat of the same descriptor. The plan no longer claims those readings match. Verification adds the fault witness, including a pre-epoch mtime, on Unix and Windows.
* **Authority:** MANDATE open question, third option rejected; fallback is the first option's failure branch already in the traced install.
* **Closure:** round 2.

### M2 — Windows directory seconds are unproved

* **Claim:** The file helper and the Unix race do not exercise the Windows directory observation. A raw FILETIME could pass every stated witness.
* **Witnesses:** plan r1 finding 2 (blocker); tests r1 finding 3 (should-fix).
* **Evidence:** Windows `entry_identity_at` (`infra/fs.rs:3107-3113`) returns only `(u64, u64)` from `opened_file_identity`. `windows_identity_is_read_from_the_retained_handle` (`platform_support.rs:937-951`) checks that call and not the conversion. Enumeration converts with `filetime_to_unix_seconds` (`infra/fs.rs:3049`).
* **MANDATE:** both create paths, on the environments the threat model names, return the installed object's listing seconds.
* **Disposition:** Fix. Directory create uses one observation that returns identity and seconds. A source pin requires `filetime_to_unix_seconds` in that Windows body. A `#[cfg(windows)]` create test compares `last_modified` to the enumerator. `rust-windows-test` runs it.
* **Authority:** MANDATE "both create paths" and the threat-model sentence that Windows counts.
* **Closure:** round 2.

### M3 — The directory race hook is too late to prove one observation

* **Claim:** `WORKSPACE_CREATED_CHILD_PRE_REGISTER_HOOK` runs after `entry_identity_at` has returned. Two lookups before registration can return seconds for a different object while that test passes.
* **Witnesses:** tests r1 finding 1 (blocker).
* **Evidence:** `create_workspace_directory_inner` calls `entry_identity_at` at `file_workspace.rs:966` and then `register_created_entry` at `:967`. The hook is inside registration at `:257-261`.
* **MANDATE:** the seconds and the registered identity name the same installed object. The open question's pathname window is the defect.
* **Disposition:** Fix. Directory create calls one function once and does not also call `entry_identity_at`. A unix hook inside that observation, after the copy and before return, swaps the directory. Identity and seconds must both be the pre-swap object. The pre-register hook stays as the witness that nothing restats after that point. No Windows hook.
* **Authority:** MANDATE defect (a rename returns a different object's mtime) plus the plan's own "one stat" sentence, which the round-1 witness did not enforce.
* **Closure:** round 2.

### M4 — An out-of-range Windows tick word has no defined result

* **Claim:** "Must not panic" does not say what a `u64` tick word outside `i64` becomes, and the pre-epoch witness uses a value that fits.
* **Witnesses:** platform-semantics r1 finding 3 (should-fix); tests r1 finding 4 (should-fix).
* **Evidence:** `filetime_to_unix_seconds` takes `i64` (`infra/fs.rs:2850-2854`). Enumeration stores `header.LastWriteTime` as `i64` (`infra/fs.rs:2938`). The handle metadata path reads `last_write_time()` as `u64` (`infra/fs.rs:3761`). `windows_filetime_ticks_become_unix_seconds` pins `filetime_to_unix_seconds(-1)` (`infra/fs.rs:8659`).
* **MANDATE:** create and a later listing of an untouched file report the same integer. The enumerator already interprets the tick bits as `i64`.
* **Disposition:** Fix. The create path passes those bits to `filetime_to_unix_seconds` as `i64`, including the high bit. It does not saturate or error. The witness covers a fitting pre-epoch value and `u64::MAX`.
* **Authority:** the decided contract that create seconds equal the enumerator's seconds. A saturating converter would be a second conversion.
* **Closure:** round 2.

### M5 — Platform proof jobs were unnamed

* **Claim:** Host tests and the surface gate do not prove Windows or macOS, and the plan omitted `pnpm rust:windows:check` and the FreeBSD probe.
* **Witnesses:** platform-semantics r1 finding 1 (should-fix).
* **Evidence:** Push skill names `pnpm rust:windows:check` at `.claude/skills/push/SKILL.md:108` as the local compile, and `rust-windows-test`, `rust-macos-test`, and `rust-platform` at `:376` as the jobs this machine cannot run. The new reads sit on the existing `cfg(unix)` fstat (`infra/fs.rs:1759-1767`) and `cfg(windows)` metadata (`infra/fs.rs:3758-3766`). `AtomicInstalledFile` and `TempMetadata` literals are in shared or cfg-split adapters already compiled on Linux (`infra/fs.rs:944`, `:957`, `:969`, `:1763`, `:3763`, `:4936`). This change adds no `target_os = "linux"` branch.
* **Disposition:** Fix. PROOF includes `pnpm rust:windows:check`. The plan names the three CI jobs. The FreeBSD probe is not applicable unless an edit adds a `target_os = "linux"` branch; the plan forbids that branch. No new probe harness.
* **Authority:** the lens's platform-proof rule, which is the verification level for the threat model's Unix and Windows environments. Not a new CI mechanism.
* **Closure:** round 2.

### M6 — Baseline pin would duplicate the credentials test

* **Claim:** A second "left the baseline" test copies the `credentials.rs` assertions.
* **Witnesses:** minimalism r1 finding 1 (should-fix).
* **Evidence:** `scripts/check-rust-release-surface-core.test.mjs:395-398` is one test with two expects. The obligation is that `file_workspace.rs` stays off the allowlist and the counts object.
* **Disposition:** Fix, carried to CR-1. One assertion covers both paths. The obligation's contract is unchanged.
* **Closure:** carried, CR-1. Not a plan-level adoption.

Opened 6, resolved this round 1 (M6 carried), open for closure 5 (M1–M5). Adopted this round: 5. Carried: 1. No Skip, Defer, or withdrawal. No correction-introduced issue yet. Round 2 reviews plan, platform-semantics, and tests.

### Round 2

Raw verdicts, unchanged:

* plan REVISE. Closed M1, M2, M3, M4, M5. One new finding, M7.
* platform-semantics REVISE. Closed M1, M3, M4, M5. M2 NOT CLOSED.
* tests REVISE. Closed M1, M2, M4, M5. M3 NOT CLOSED. One new finding, M8.

M1, M4, and M5 are closed by every lens that witnessed them. Their round-1 closure lines stand. M2 and M3 stay open: a lens that did not close them overrides a lens that did. M6 stays carried as CR-1 and was not re-reviewed.

### M2 — Windows directory seconds are unproved (round 2 residual)

* **Claim:** The cited pin at `platform_support.rs:948` checks only `opened_file_identity`. A normal Windows create cannot catch a second time lookup after the identity observation.
* **Witnesses:** platform-semantics r2 finding 1 (should-fix). Lineage: M2. Prior witnesses remain plan r1 finding 2 and tests r1 finding 3.
* **Evidence:** `windows_identity_is_read_from_the_retained_handle` (`platform_support.rs:937-951`) asserts `opened_file_identity` and nothing else. Windows `entry_identity_at` (`infra/fs.rs:3107-3113`) is one `open_expected_child` plus `opened_file_identity`, and it returns no seconds. Confirmed by reading both bodies. This is the first failure of this lineage.
* **MANDATE:** both create paths return the installed object's listing seconds from the same observation as the registered identity.
* **Disposition:** Fix. The seconds pin is a new assertion, not the existing identity loop. The observation body contains `opened_file_identity`, `filetime_to_unix_seconds`, and exactly one `open_expected_child`. The identity loop's `entry_identity_at` signature moves onto that body. `create_workspace_directory_inner` calls the observation once and does not call `entry_identity_at`. No Windows swap hook.
* **Authority:** the same MANDATE obligation as round 1. The correction changes the verification contract of that obligation. It adds no rollback and no second production lookup.
* **Closure:** open. Round 3 checks it. Round 2 cannot close it.

### M3 — The directory race hook is too late to prove one observation (round 2 residual)

* **Claim:** A hook that runs after identity and seconds are copied never injects a swap between two earlier lookups, so both assertions can pass.
* **Witnesses:** tests r2 finding 1 (blocker). Lineage: M3. Prior witness remains tests r1 finding 1.
* **Evidence:** The round-1 correction put the hook after the copy. Unix `entry_identity_at` (`infra/fs.rs:4416`) is one `rfs::statat` followed by `raw_stat_identity`. Confirmed by reading that body. This is the first failure of this lineage.
* **MANDATE:** the seconds and the registered identity name the same installed object.
* **Disposition:** Fix. The hook is the next statement after the observation's single `statat` and before either value is derived. The returned pair is built only from that `stat`. A source pin counts `statat` in that braced body and fails unless the count is one. The pre-register hook stays. No Windows hook.
* **Authority:** the same MANDATE defect as round 1. The failed placement did not enforce one syscall.
* **Closure:** open. Round 3 checks it. Round 2 cannot close it.

### M7 — Deleting `timestamp` leaves the listing-shape test calling it

* **Claim:** Cleanup names only `timestamps_and_durability_outcomes_remain_renderer_safe`. `collect_tree_entries_lists_the_workspace_shape_on_every_platform` also calls `timestamp`, so `cargo test --lib file_workspace` does not compile.
* **Witnesses:** plan r2 finding 1 (blocker).
* **Evidence:** `file_workspace.rs:3327` and `:3348` compare listed `last_modified` to `timestamp(...)`. Confirmed by reading the test. The durability call at `:3192` was already named.
* **MANDATE:** `timestamp` is deleted, and the phase proof includes `cargo test --lib file_workspace`. The listing comparisons are the coverage that deletion must keep.
* **Disposition:** Fix. Both listing assertions stay and compare `last_modified` to the enumerator's whole seconds. They do not call `timestamp` and do not use `duration_since`. A test-only read is not a production pathname reach.
* **Authority:** the plan's own delete-`timestamp` obligation plus a red phase proof. Not a listing-bounds change (`f-20260913-06` stays out).
* **Closure:** open. Round 3 checks it.

### M8 — Pre-epoch coverage stops at the helper

* **Claim:** The pre-epoch assertion is on `atomic_replace_at_identified`. A caller that clamps or rejects a negative `WorkspaceEntry.last_modified` still passes.
* **Witnesses:** tests r2 finding 2 (blocker).
* **Evidence:** The file success witness stops at `modified_seconds`. `create_workspace_directory_inner` assigns `last_modified` at `file_workspace.rs:1000` from `timestamp`, which rejects pre-1970. `collect_tree_entries_lists_a_pre_epoch_entry_with_its_negative_timestamp` (`file_workspace.rs:5095`) lists an existing file and does not call either create path. Confirmed by reading that test's opening.
* **MANDATE:** a pre-1970 time is a negative `i64` on the value the create response returns, not `Error::InvalidInput`.
* **Disposition:** Fix. Both `create_workspace_file` and `create_workspace_directory` return a negative `last_modified` equal to the enumerator's seconds. The helper witness stays and does not replace this one.
* **Authority:** the decided contract that create seconds equal the enumerator's seconds, including a negative value. Not a new numeric formula.
* **Closure:** open. Round 3 checks it.

Opened this round: M7, M8. Re-opened: M2, M3 (first failure each). Closed this round: M1, M4, M5. Adopted this round: 4 (M2, M3, M7, M8). Carried unchanged: M6. No Skip, Defer, or withdrawal. Round 3 reviews plan, platform-semantics, and tests.

### plan-r4.md

# Plan: Workspace create mtime without a pathname reach

## Goal

`create_workspace_file` and `create_workspace_directory` return `WorkspaceEntry.lastModified` as the signed Unix seconds of the object this call installed, taken from the observation that already identified that object. They do not look the new name up again by pathname, and a failure of that observation is not introduced after the entry is registered.

## MANDATE

### Workspace create paths read the new entry's modification time back by pathname

* **ID:** f-20260913-02 · **Status:** open · **Area:** native-fs · **Root:** - · **Entry:** build · **Blocked:** none
* **Where:** `src-tauri/src/file_workspace.rs` — `timestamp` (`:154-159`, `fs::metadata(path)`), called by `create_workspace_file_blocking` (`:683`) and `create_workspace_directory_inner` (`:781`) after the entry was installed through a retained parent descriptor and registered.
* **Defect:** both create paths install the new entry descriptor-relative (`atomic_replace_at_identified`, `create_dir_at`) and register it with the installed identity, then compute `last_modified` by reopening `parent_target.path().join(name)` by pathname. A rename in that window returns the modification time of a different object, and the reach is one of `file_workspace.rs`'s counted R3 sites in `INITIAL_FS_SURFACE_COUNTS`.
* **Open question:** where does the create path take the mtime without a pathname reach and without turning a post-commit race into an error after the entry and its sidecar are already durable and registered — `fstat` of a descriptor retained from the install (the atomic-replace helpers do not return one today), an identity-checked `statat` through the retained parent (which can fail after the durable commit), or reordering the stat before registration?
* **Why it matters:** it is the last production filesystem reach in `file_workspace.rs` once `f-20260905-05` lands; closing it removes the file from the allowlist.
* **Related:** `f-20260905-05` (its plan review split this out as outside that mandate — `timestamp` is metadata, not directory enumeration).
* **Found by:** Claude Code, plan review of `tasks/plans/2026-09-13-workspace-directory-enumeration.md` (`review-minimalism`, `review-root-cause`, `review-tauri-security`), 2026-09-13.

* **Inherited review history (2026-09-13):** load `tasks/handoffs/2026-09-13-workspace-directory-enumeration-review.md` before this finding's plan review. It carries the `f-20260905-05` plan-review record; this finding inherits issue IDs W6, W17 and W24 from it, with their witnesses, dispositions and evidence.

Line numbers in the mandate are the filing's. Locate re-found the same functions at `timestamp` `file_workspace.rs:184-190`, the file call at `:901`, and the directory call at `:1000`.

## Threat model and non-goals

The parent directory is a workspace the user already granted. Another process, or another call that holds no `workspace_mutation` lock, can rename or replace the new leaf after this call's install. That is the adversary the defect names. It is not a cross-user privilege boundary and not a symlink escape of the parent: the parent descriptor is the one the mutation target already holds.

The observation that supplies `lastModified` must name the installed inode, not whatever path string is current at a later lookup. A lookup that fails after `register_created_entry` has returned must not become the command's error: the entry and, for a file, its sidecar are already durable and registered, and today's `timestamp()?` is exactly that post-registration failure (`file_workspace.rs:885-901` and `:967-1000`).

Environments that count are the ones `infra/fs.rs` already splits: Unix (Linux and macOS share the `cfg(unix)` stat path) and Windows.

Non-goals, frozen with this model: directory-identity failure rollback, listing bounds, resolve error categories, root-path wrapper deduplication, renderer copy, and full-precision schema-cache mtimes.

## Traced premises

* `timestamp` is `fs::metadata(path)?.modified()?` and rejects a pre-1970 time with `Error::InvalidInput` (`file_workspace.rs:184-190`). `listed_mtime` documents the opposite renderer contract: `lastModified` is a plain `i64` of Unix seconds, and a negative value is a real date (`file_workspace.rs:172-181`). The enumerator stores `stat.st_mtime` with no nanoseconds (`infra/fs.rs:163-168`). Windows enumeration converts `LastWriteTime` only through `filetime_to_unix_seconds` (`infra/fs.rs:2846-2854`).
* File install already `fstat`s the still-open temporary descriptor after `renameat` and before any pathname lookup, and returns that identity on `AtomicInstalledFile` without returning the descriptor (`infra/fs.rs:4903-4905`, `1759-1767`, `363-367`). The pre-rename `fstat` is `fallback_metadata` (`infra/fs.rs:902-913`). A failed post-rename metadata read returns `CommittedDurabilityUncertain` with that fallback's identity and ctime (`infra/fs.rs:940-949`). The success path returns the post-rename `fstat`. This plan does not claim those two clock readings are equal. The caller uses the reading the helper actually returned.
* Directory install does not keep a descriptor: Unix `mkdirat` plus `sync_all` (`infra/fs.rs:4436-4443`); Windows opens a handle and drops it (`infra/fs.rs:3090-3104`). The next observation is `entry_identity_at` on the retained parent, before registration (`file_workspace.rs:965-975`). Its Unix body is one `statat(AT_SYMLINK_NOFOLLOW)` (`infra/fs.rs:4409-4424`). Its Windows body opens a handle and reads `opened_file_identity`; `platform_support.rs` test `windows_identity_is_read_from_the_retained_handle` (`:937-951`) requires that call to appear in the `entry_identity_at` body itself.
* `entry_identity_at`'s return type is `(u64, u64)`. Callers outside create include `db/mod.rs`, `db/search_index.rs`, and `path_authority`. Changing that return type is not required.
* Production R3 count for `src-tauri/src/file_workspace.rs` is 1 (`scripts/check-rust-release-surface.mjs:32-34`). An allowlist entry with zero production matches must be removed (`check-rust-release-surface.mjs:501-503`). `d-20260901-03` makes the allowlist shrink-only. `#[cfg(test)]` metadata in `file_workspace.rs` is not a production match.
* `d-20261001-06` requires full-precision `SystemTime` mtime for `probe_regular_file_at` / the schema cache. `WorkspaceEntry.lastModified` is the enumerator's whole seconds, not that probe.
* Inherited W6 is this defect, split out of the enumeration mandate. W17 (create-path guard untested) was moot only because W6 was out of that mandate; the race witness below is that test. W24 (where create-path components come from) stays out of scope: registration still calls `workspace_components` inside `register_created_entry` (`file_workspace.rs:247-256`).

## Approach

### Installed-file seconds come from the post-rename fstat

The file create path answers the open question with the first option. The atomic-replace helper already holds the descriptor and already `fstat`s it after the rename. It does not start returning that descriptor.

`TempMetadata` and `AtomicInstalledFile` gain `modified_seconds: i64`, filled from the same metadata read that fills `identity` and `ctime_nanos`, on both the post-rename read and the pre-rename fallback. Unix uses the same `stat.st_mtime` expression as `DirectoryEntry.modified_seconds`. Windows takes that handle's `LastWriteTime` tick word and interprets those bits as `i64`, which is how enumeration already stores `FILE_ID_BOTH_DIR_INFORMATION.LastWriteTime` (`infra/fs.rs:2938`) before `filetime_to_unix_seconds` (`infra/fs.rs:3049`). `std` reports the same word as `u64` (`infra/fs.rs:3761`). The conversion is `filetime_to_unix_seconds` of that `i64` bit pattern, including a high bit that becomes negative. It does not panic, saturate, or return an error. A value whose bits already fit the enumerator's `i64` uses `filetime_to_unix_seconds` unchanged. `windows_filetime_ticks_become_unix_seconds` already pins `filetime_to_unix_seconds(-1)` (`infra/fs.rs:8657-8659`); the create path's `u64` word `u64::MAX` is those same bits.

`create_workspace_file_blocking` sets `last_modified` from `installed.modified_seconds`. It does not call `timestamp`, `fs::metadata`, or `Path::metadata`. A post-rename metadata failure stays the helper's existing `CommittedDurabilityUncertain` outcome and still carries the fallback seconds of that same inode. The caller keeps today's behavior of returning that durability error after registration (`file_workspace.rs:903-905`) and does not add a new error for the seconds.

Rejected for the file path: an identity-checked `statat` of the installed name. It can fail, or observe a replacement, after the PGN and sidecar are durable. Rejected: moving today's pathname `timestamp` to before registration. It is still the R3 reach, and a replacement in that window is still the wrong object.

### Directory seconds come from the pre-registration identity observation

`create_dir_at` does not retain a descriptor, so the file-path `fstat` is not available. The directory create path uses one observation through the retained parent, the same observation as `entry_identity_at`, and it happens before `register_created_entry`.

Directory create calls one observation function once and uses both values from that single return. It does not also call `entry_identity_at`. `entry_identity_at` keeps the `(u64, u64)` return and its current errors. It calls the observation and discards the seconds, so its other callers stay unchanged. The observation is the function that performs the lookup. It is not a wrapper around two lookups.

On Unix the observation keeps today's `entry_identity_at` shape (`infra/fs.rs:4416`): one `rfs::statat`. Identity is `unix::raw_stat_identity` of that `stat`. The seconds are that same `stat.st_mtime`. A `cfg(all(test, unix))` hook runs immediately after that `statat` returns and before either value is derived. The returned pair is built only from that `stat`. The hook proves that a lookup after that `statat` cannot change the pair. It does not prove there was no earlier lookup. No source pin that counts the identifier `statat` is added. A count of direct calls misses a helper, which is why round 3's count pin is withdrawn.

On Windows the observation opens the child with `open_expected_child` (today that open is `win::entry_identity_at`, `infra/fs.rs:3107-3113`) and reads identity with `opened_file_identity` on that handle. The seconds are `filetime_to_unix_seconds` of that same handle's `LastWriteTime` bits interpreted as `i64`, the conversion enumeration already uses (`infra/fs.rs:3049`). Because the open moves out of `entry_identity_at` into the observation, `windows_identity_is_read_from_the_retained_handle` moves its `entry_identity_at` signature onto the observation body. The other four signatures in that test stay on `assert_entry_identity`, `open_verified_parent`, `remove_regular_child`, and `remove_windows_tree_at`. That move keeps the existing identity pin on the body that opens the handle. It does not prove where the seconds come from. `create_workspace_directory_inner` calls the observation once and does not call `entry_identity_at`.

No identifier-count pin is the proof of one observation. CR-2 is that proof, and it is carried to diff review. Do not add a Windows swap hook.

`create_workspace_directory_inner` stores those seconds and does not stat after registration. A failure of the observation stays where `entry_identity_at` fails today: the directory exists, nothing is registered, and this plan adds no rollback. That leak is pre-existing and outside the mandate.

The name can still be replaced between `create_dir_at` and this observation. That window is the one `entry_identity_at` already has. This plan does not widen it and does not add a later pathname lookup after registration, which is the lookup the mandate removes.

### One renderer value, then delete the pathname helper

Both create paths assign that `i64` to `WorkspaceEntry.lastModified`. Subseconds are discarded the way the enumerator discards them. A pre-1970 time is a negative `i64`, not `Error::InvalidInput`. `timestamp` is deleted. No production pathname filesystem reach remains in `file_workspace.rs`.

Remove `src-tauri/src/file_workspace.rs` from `INITIAL_FS_SURFACE_ALLOWLIST` and from `INITIAL_FS_SURFACE_COUNTS`. Do not change `src-tauri/src/fs.rs`'s count. Extend the existing `credentials.rs` baseline pin (`scripts/check-rust-release-surface-core.test.mjs:395-398`) so one assertion covers both paths. Do not add a second test with the same body.

`timestamps_and_durability_outcomes_remain_renderer_safe` calls `timestamp` (`file_workspace.rs:3192`). Keep its durability assertions. Delete the pathname `timestamp` assertion rather than reintroducing the helper for the test.

`collect_tree_entries_lists_the_workspace_shape_on_every_platform` also calls `timestamp`, at `file_workspace.rs:3327` and `:3348`. Both assertions compare a listed `last_modified` with that helper. After `timestamp` is deleted, both comparisons stay: each listed `last_modified` equals the enumerator's whole seconds for that object (Unix `st_mtime`, Windows `filetime_to_unix_seconds` of the `LastWriteTime` bits). Do not delete the comparisons. A `#[cfg(test)]` read does not count as a production pathname reach and is not copied into production code. Do not use `duration_since`. `cargo test --lib file_workspace` does not compile while either call remains.

No Specta type changes. `lastModified` stays `i64`. No frontend change.

### Verification

Level: unit tests plus the release-surface checker. No browser and no dev server. The value is not a new visible control; it is the seconds the create response already returns.

File success witness, in `infra/fs` tests: `atomic_replace_at_identified` on a new leaf returns `modified_seconds` equal to that inode's enumerator's seconds. Set the written file's mtime before the epoch inside the write closure and assert the returned seconds are negative and equal to that `st_mtime` (Unix) or `filetime_to_unix_seconds` of the same tick bits (Windows). This is the witness that `duration_since` is gone on the helper. It is not the witness for `WorkspaceEntry.last_modified`.

Create-path negative witness, both create paths: `create_workspace_file` and `create_workspace_directory` each return a `WorkspaceEntry` whose `last_modified` is negative and equal to that object's enumerator seconds. For a file, set the pre-epoch mtime inside the write closure, before the fstat. For a directory, a `cfg(test)` hook runs on the shared create path immediately after `create_dir_at` succeeds and before the observation syscall or handle acquisition begins. The test arms that hook, sets a representable pre-epoch mtime on the new directory, and calls create on that same thread. The returned `last_modified` is negative and equals those listing seconds. The hook is not the post-`statat` swap hook and not the pre-register hook; both of those run after the seconds are already captured. Neither result is `Error::InvalidInput`, a clamped zero, or a `duration_since` rejection. `collect_tree_entries_lists_a_pre_epoch_entry_with_its_negative_timestamp` (`file_workspace.rs:5095`) covers listings only and is not this witness.

File fallback witness, Unix and Windows: inject `AtomicFileFaultPoint::PostRenameMetadata` (the failure branch at `infra/fs.rs:940-949`; the Windows test at `infra/fs.rs:9021` checks outcome and identity only). Set the mtime, including a pre-epoch value, inside the write closure. The returned `modified_seconds` equal that pre-rename reading of the same descriptor, and the outcome stays `CommittedDurabilityUncertain`. This does not prove that rename preserves mtime.

Registration race witness, Unix, both create paths: arm `WORKSPACE_CREATED_CHILD_PRE_REGISTER_HOOK`, which runs inside `register_created_entry` after install and after the directory observation, before the registry write (`file_workspace.rs:257-261`). In the hook, remember the installed object's seconds, rename it aside, and put a different object of the same kind at the same leaf with a different mtime. The returned `last_modified` equals the installed object's seconds, not the replacement's. This catches a pathname stat after that hook. It does not catch two lookups before the hook.

Same-observation witness, Unix, directory only: the hook is the next statement after the observation's `statat` and before identity or seconds are derived. The hook swaps the new directory for another directory with a different mtime. The identity and `last_modified` returned to `create_workspace_directory_inner` both name the pre-swap directory. This proves a lookup after that `statat` cannot change the pair. It does not prove the absence of an earlier lookup hidden in a helper. That check is CR-2, not another source pin. Do not add a Windows hook.

Windows directory witness: `windows_identity_is_read_from_the_retained_handle` follows the body that contains `opened_file_identity`, as above. It stays an identity pin. A `#[cfg(windows)]` test checks that `create_workspace_directory` returns `last_modified` equal to the enumerator's seconds for that directory. `rust-windows-test` is the runtime proof. This machine does not run that test. The proof that the seconds come from that same handle, and that no second name lookup supplies them, is CR-2. There is no Windows swap hook.

Tick-word witness, Windows: a unit test that the create-path conversion of a `u64` tick word equals `filetime_to_unix_seconds` of those bits as `i64`, for a pre-epoch value that fits and for `u64::MAX`, and does not panic. Extend `windows_filetime_ticks_become_unix_seconds` rather than setting an unrepresentable filesystem mtime.

Surface witness: `pnpm rust:surface:check` exits 0, and the shared baseline pin fails if `file_workspace.rs` is put back on the allowlist.

Platform proof, named rather than newly built: `pnpm rust:windows:check` is the local Windows compile. After push, `rust-macos-test` is the runtime proof of the shared `cfg(unix)` path, `rust-windows-test` is the runtime proof of the `cfg(windows)` path, and `rust-platform` is the MSVC compile of that Windows code. The new reads stay on the existing `cfg(unix)` and `cfg(windows)` adapters. This phase adds no `target_os = "linux"` branch, so the FreeBSD source probe is not applicable. If an edit adds one, the adopting session flips `target_os = "linux"` to `target_os = "freebsd"` in the touched files, compiles, and reverts before commit. The phase leaf does not leave that flip in the tree.

## Decisions and trade-offs

### Decided autonomously

* **Question:** which of the three options in the open question supplies create-path mtime?
  * **Chosen:** post-rename `fstat` seconds returned on `AtomicInstalledFile` for files; the existing pre-registration parent observation, extended to return the same seconds, for directories.
  * **Rejected:** a `statat` after registration (fails or observes a replacement after the durable commit). Rejected: moving pathname `timestamp` earlier (keeps the R3 site and the wrong-object window).
  * **Reason:** the file helper already `fstat`s the installed inode before the name can be looked up. The directory helper never held a descriptor; its identity stat is the last observation before registration. Recorded at adoption with `findings.py record-decision`, not by this planner.

* **Question:** whole seconds or `RegularFileMetadata`'s `SystemTime`?
  * **Chosen:** the enumerator's signed Unix seconds.
  * **Rejected:** nanosecond `SystemTime` from `d-20261001-06`.
  * **Reason:** that decision governs the schema-cache probe. `WorkspaceEntry.lastModified` is the field `DirectoryEntry.modified_seconds` already fills. A create response and a later listing of an untouched file report the same integer.

* **Question:** one phase or a split between `infra/fs.rs` and `file_workspace.rs`?
  * **Chosen:** one phase. The new field is unused until the create path consumes it, and the allowlist shrink is false until `timestamp` is gone.
  * **Rejected:** shipping the struct field alone.

## Risks / open questions

None that change the mechanism. Known limit, stated rather than solved: a directory name replaced between `create_dir_at` and the identity observation is attributed as today's `entry_identity_at` attributes it. The returned seconds belong to that same observation, so they cannot name a different object than the registered identity.

## Not part of this task

* `f-20260913-03` (root-path wrappers), `f-20260913-04` (resolve `Conflict` category), `f-20260913-05` (listing error copy), `f-20260913-06` (listing bounds and failed-listing registry churn).
* W24's component source. Registration is unchanged.
* Rollback when directory identity observation fails.
* `src-tauri/src/fs.rs` allowlist count.
* Renderer, bindings, and browser verification.

## Phases

### Phase 1 — Create-path seconds and the allowlist shrink

Files: `src-tauri/src/infra/fs.rs`, `src-tauri/src/file_workspace.rs`, `src-tauri/src/infra/platform_support.rs` (only so `windows_identity_is_read_from_the_retained_handle` follows the body that contains `opened_file_identity`), `scripts/check-rust-release-surface.mjs`, `scripts/check-rust-release-surface-core.test.mjs`.

Touches filesystem identity and mtime. No auth, persistence schema, concurrency primitive, or IPC contract change. The `workspace_mutation` lock and registration order stay as they are.

Role: `sensitive` (`src-tauri/src/infra/**`).

PROOF:

```bash
cargo fmt --manifest-path src-tauri/Cargo.toml -- --check
cargo test --manifest-path src-tauri/Cargo.toml --locked --lib infra::fs:: -- --test-threads=8
cargo test --manifest-path src-tauri/Cargo.toml --locked --lib file_workspace:: -- --test-threads=8
cargo test --manifest-path src-tauri/Cargo.toml --locked --lib infra::platform_support:: -- --test-threads=8
pnpm rust:windows:check
pnpm rust:surface:check
pnpm exec vitest run scripts/check-rust-release-surface-core.test.mjs
```

A red proof is a red phase. `pnpm checks:pre-review` is the adopting session's pre-review block, not a substitute for this proof.

## Carried to diff review

* **CR-1.** The baseline pin is one assertion over `src-tauri/src/credentials.rs` and `src-tauri/src/file_workspace.rs`, not a second copy of the `credentials.rs` test body. The obligation is unchanged: putting `file_workspace.rs` back on the allowlist or the counts object fails the pin.
* **CR-2.** Diff review traces the directory observation and every helper it calls. Both returned values come from the same Unix `stat` result or the same retained Windows handle, and those values are what registration stores and what `WorkspaceEntry.last_modified` returns. A second name lookup that supplies either value fails the review. The unix swap hook only proves that a lookup after `statat` cannot change the returned pair. No Windows swap hook, and no further identifier-count pin.

## Decided autonomously

See Decisions and trade-offs. The adopting session records the mtime-source decision. This planner does not write `tasks/decisions.md`.

## Reviews

Round 1 wall time is `plan-meta.json` `review.per_round_seconds`. Twelve plan-capable lenses. `review-code-quality` and `review-root-cause` are `plan-review: false` and were not launched. No quota wait.

Raw verdicts, unchanged:

* chess-semantics APPROVED. `NOT APPLICABLE: The files and mandate concern filesystem modification-time observations; they do not involve an in-memory chess tree, position, or move path.`
* correctness APPROVED. No findings.
* engine-protocol APPROVED. `NOT APPLICABLE: The plan concerns filesystem timestamps and release-surface checks; it does not touch engine processes, UCI state, or asynchronous engine-result routing.`
* error-handling APPROVED. No findings.
* ipc-contract APPROVED. No IPC-contract defects. `lastModified` stays a signed Unix-seconds value.
* minimalism REVISE. One finding, M6.
* persisted-state APPROVED. `NOT APPLICABLE: The plan concerns Rust filesystem modification-time observations and release-surface checks; it has no renderer state, storage keys, or tab lifecycle.`
* pgn-index APPROVED. `NOT APPLICABLE: The plan concerns filesystem metadata for workspace creation; it does not touch PGN scanning, indexing, encoding, or searching.`
* plan REVISE. Two findings, M1 and M2.
* platform-semantics REVISE. Three findings, M5, M1, M4.
* tauri-security APPROVED. No findings.
* tests REVISE. Four findings, M3, M1, M2, M4.

### M1 — Fallback seconds have no witness

* **Claim:** The file witness never injects `PostRenameMetadata`, so the promised fallback seconds can be missing and the proof stays green. The sentence "rename does not change mtime" was not measured.
* **Witnesses:** plan r1 finding 1 (blocker); platform-semantics r1 finding 2 (should-fix); tests r1 finding 2 (should-fix).
* **Evidence:** `infra/fs.rs:902-913` saves `fallback_metadata` before rename. `infra/fs.rs:940-949` returns that identity and ctime on post-rename metadata failure, with `CommittedDurabilityUncertain`. `infra/fs.rs:9021-9047` asserts outcome, identity, and bytes, not seconds. No unix test injects `PostRenameMetadata`.
* **MANDATE:** the open question forbids turning a post-commit metadata failure into an error after the durable commit, and the returned seconds must name the installed inode.
* **Disposition:** Fix. The success path returns the post-rename fstat. The failure path returns the pre-rename fstat of the same descriptor. The plan no longer claims those readings match. Verification adds the fault witness, including a pre-epoch mtime, on Unix and Windows.
* **Authority:** MANDATE open question, third option rejected; fallback is the first option's failure branch already in the traced install.
* **Closure:** round 2.

### M2 — Windows directory seconds are unproved

* **Claim:** The file helper and the Unix race do not exercise the Windows directory observation. A raw FILETIME could pass every stated witness.
* **Witnesses:** plan r1 finding 2 (blocker); tests r1 finding 3 (should-fix).
* **Evidence:** Windows `entry_identity_at` (`infra/fs.rs:3107-3113`) returns only `(u64, u64)` from `opened_file_identity`. `windows_identity_is_read_from_the_retained_handle` (`platform_support.rs:937-951`) checks that call and not the conversion. Enumeration converts with `filetime_to_unix_seconds` (`infra/fs.rs:3049`).
* **MANDATE:** both create paths, on the environments the threat model names, return the installed object's listing seconds.
* **Disposition:** Fix. Directory create uses one observation that returns identity and seconds. A source pin requires `filetime_to_unix_seconds` in that Windows body. A `#[cfg(windows)]` create test compares `last_modified` to the enumerator. `rust-windows-test` runs it.
* **Authority:** MANDATE "both create paths" and the threat-model sentence that Windows counts.
* **Closure:** round 2.

### M3 — The directory race hook is too late to prove one observation

* **Claim:** `WORKSPACE_CREATED_CHILD_PRE_REGISTER_HOOK` runs after `entry_identity_at` has returned. Two lookups before registration can return seconds for a different object while that test passes.
* **Witnesses:** tests r1 finding 1 (blocker).
* **Evidence:** `create_workspace_directory_inner` calls `entry_identity_at` at `file_workspace.rs:966` and then `register_created_entry` at `:967`. The hook is inside registration at `:257-261`.
* **MANDATE:** the seconds and the registered identity name the same installed object. The open question's pathname window is the defect.
* **Disposition:** Fix. Directory create calls one function once and does not also call `entry_identity_at`. A unix hook inside that observation, after the copy and before return, swaps the directory. Identity and seconds must both be the pre-swap object. The pre-register hook stays as the witness that nothing restats after that point. No Windows hook.
* **Authority:** MANDATE defect (a rename returns a different object's mtime) plus the plan's own "one stat" sentence, which the round-1 witness did not enforce.
* **Closure:** round 2.

### M4 — An out-of-range Windows tick word has no defined result

* **Claim:** "Must not panic" does not say what a `u64` tick word outside `i64` becomes, and the pre-epoch witness uses a value that fits.
* **Witnesses:** platform-semantics r1 finding 3 (should-fix); tests r1 finding 4 (should-fix).
* **Evidence:** `filetime_to_unix_seconds` takes `i64` (`infra/fs.rs:2850-2854`). Enumeration stores `header.LastWriteTime` as `i64` (`infra/fs.rs:2938`). The handle metadata path reads `last_write_time()` as `u64` (`infra/fs.rs:3761`). `windows_filetime_ticks_become_unix_seconds` pins `filetime_to_unix_seconds(-1)` (`infra/fs.rs:8659`).
* **MANDATE:** create and a later listing of an untouched file report the same integer. The enumerator already interprets the tick bits as `i64`.
* **Disposition:** Fix. The create path passes those bits to `filetime_to_unix_seconds` as `i64`, including the high bit. It does not saturate or error. The witness covers a fitting pre-epoch value and `u64::MAX`.
* **Authority:** the decided contract that create seconds equal the enumerator's seconds. A saturating converter would be a second conversion.
* **Closure:** round 2.

### M5 — Platform proof jobs were unnamed

* **Claim:** Host tests and the surface gate do not prove Windows or macOS, and the plan omitted `pnpm rust:windows:check` and the FreeBSD probe.
* **Witnesses:** platform-semantics r1 finding 1 (should-fix).
* **Evidence:** Push skill names `pnpm rust:windows:check` at `.claude/skills/push/SKILL.md:108` as the local compile, and `rust-windows-test`, `rust-macos-test`, and `rust-platform` at `:376` as the jobs this machine cannot run. The new reads sit on the existing `cfg(unix)` fstat (`infra/fs.rs:1759-1767`) and `cfg(windows)` metadata (`infra/fs.rs:3758-3766`). `AtomicInstalledFile` and `TempMetadata` literals are in shared or cfg-split adapters already compiled on Linux (`infra/fs.rs:944`, `:957`, `:969`, `:1763`, `:3763`, `:4936`). This change adds no `target_os = "linux"` branch.
* **Disposition:** Fix. PROOF includes `pnpm rust:windows:check`. The plan names the three CI jobs. The FreeBSD probe is not applicable unless an edit adds a `target_os = "linux"` branch; the plan forbids that branch. No new probe harness.
* **Authority:** the lens's platform-proof rule, which is the verification level for the threat model's Unix and Windows environments. Not a new CI mechanism.
* **Closure:** round 2.

### M6 — Baseline pin would duplicate the credentials test

* **Claim:** A second "left the baseline" test copies the `credentials.rs` assertions.
* **Witnesses:** minimalism r1 finding 1 (should-fix).
* **Evidence:** `scripts/check-rust-release-surface-core.test.mjs:395-398` is one test with two expects. The obligation is that `file_workspace.rs` stays off the allowlist and the counts object.
* **Disposition:** Fix, carried to CR-1. One assertion covers both paths. The obligation's contract is unchanged.
* **Closure:** carried, CR-1. Not a plan-level adoption.

Opened 6, resolved this round 1 (M6 carried), open for closure 5 (M1–M5). Adopted this round: 5. Carried: 1. No Skip, Defer, or withdrawal. No correction-introduced issue yet. Round 2 reviews plan, platform-semantics, and tests.

### Round 2

Raw verdicts, unchanged:

* plan REVISE. Closed M1, M2, M3, M4, M5. One new finding, M7.
* platform-semantics REVISE. Closed M1, M3, M4, M5. M2 NOT CLOSED.
* tests REVISE. Closed M1, M2, M4, M5. M3 NOT CLOSED. One new finding, M8.

M1, M4, and M5 are closed by every lens that witnessed them. Their round-1 closure lines stand. M2 and M3 stay open: a lens that did not close them overrides a lens that did. M6 stays carried as CR-1 and was not re-reviewed.

### M2 — Windows directory seconds are unproved (round 2 residual)

* **Claim:** The cited pin at `platform_support.rs:948` checks only `opened_file_identity`. A normal Windows create cannot catch a second time lookup after the identity observation.
* **Witnesses:** platform-semantics r2 finding 1 (should-fix). Lineage: M2. Prior witnesses remain plan r1 finding 2 and tests r1 finding 3.
* **Evidence:** `windows_identity_is_read_from_the_retained_handle` (`platform_support.rs:937-951`) asserts `opened_file_identity` and nothing else. Windows `entry_identity_at` (`infra/fs.rs:3107-3113`) is one `open_expected_child` plus `opened_file_identity`, and it returns no seconds. Confirmed by reading both bodies. This is the first failure of this lineage.
* **MANDATE:** both create paths return the installed object's listing seconds from the same observation as the registered identity.
* **Disposition:** Fix. The seconds pin is a new assertion, not the existing identity loop. The observation body contains `opened_file_identity`, `filetime_to_unix_seconds`, and exactly one `open_expected_child`. The identity loop's `entry_identity_at` signature moves onto that body. `create_workspace_directory_inner` calls the observation once and does not call `entry_identity_at`. No Windows swap hook.
* **Authority:** the same MANDATE obligation as round 1. The correction changes the verification contract of that obligation. It adds no rollback and no second production lookup.
* **Closure:** open. Round 3 checks it. Round 2 cannot close it.

### M3 — The directory race hook is too late to prove one observation (round 2 residual)

* **Claim:** A hook that runs after identity and seconds are copied never injects a swap between two earlier lookups, so both assertions can pass.
* **Witnesses:** tests r2 finding 1 (blocker). Lineage: M3. Prior witness remains tests r1 finding 1.
* **Evidence:** The round-1 correction put the hook after the copy. Unix `entry_identity_at` (`infra/fs.rs:4416`) is one `rfs::statat` followed by `raw_stat_identity`. Confirmed by reading that body. This is the first failure of this lineage.
* **MANDATE:** the seconds and the registered identity name the same installed object.
* **Disposition:** Fix. The hook is the next statement after the observation's single `statat` and before either value is derived. The returned pair is built only from that `stat`. A source pin counts `statat` in that braced body and fails unless the count is one. The pre-register hook stays. No Windows hook.
* **Authority:** the same MANDATE defect as round 1. The failed placement did not enforce one syscall.
* **Closure:** open. Round 3 checks it. Round 2 cannot close it.

### M7 — Deleting `timestamp` leaves the listing-shape test calling it

* **Claim:** Cleanup names only `timestamps_and_durability_outcomes_remain_renderer_safe`. `collect_tree_entries_lists_the_workspace_shape_on_every_platform` also calls `timestamp`, so `cargo test --lib file_workspace` does not compile.
* **Witnesses:** plan r2 finding 1 (blocker).
* **Evidence:** `file_workspace.rs:3327` and `:3348` compare listed `last_modified` to `timestamp(...)`. Confirmed by reading the test. The durability call at `:3192` was already named.
* **MANDATE:** `timestamp` is deleted, and the phase proof includes `cargo test --lib file_workspace`. The listing comparisons are the coverage that deletion must keep.
* **Disposition:** Fix. Both listing assertions stay and compare `last_modified` to the enumerator's whole seconds. They do not call `timestamp` and do not use `duration_since`. A test-only read is not a production pathname reach.
* **Authority:** the plan's own delete-`timestamp` obligation plus a red phase proof. Not a listing-bounds change (`f-20260913-06` stays out).
* **Closure:** open. Round 3 checks it.

### M8 — Pre-epoch coverage stops at the helper

* **Claim:** The pre-epoch assertion is on `atomic_replace_at_identified`. A caller that clamps or rejects a negative `WorkspaceEntry.last_modified` still passes.
* **Witnesses:** tests r2 finding 2 (blocker).
* **Evidence:** The file success witness stops at `modified_seconds`. `create_workspace_directory_inner` assigns `last_modified` at `file_workspace.rs:1000` from `timestamp`, which rejects pre-1970. `collect_tree_entries_lists_a_pre_epoch_entry_with_its_negative_timestamp` (`file_workspace.rs:5095`) lists an existing file and does not call either create path. Confirmed by reading that test's opening.
* **MANDATE:** a pre-1970 time is a negative `i64` on the value the create response returns, not `Error::InvalidInput`.
* **Disposition:** Fix. Both `create_workspace_file` and `create_workspace_directory` return a negative `last_modified` equal to the enumerator's seconds. The helper witness stays and does not replace this one.
* **Authority:** the decided contract that create seconds equal the enumerator's seconds, including a negative value. Not a new numeric formula.
* **Closure:** open. Round 3 checks it.

Opened this round: M7, M8. Re-opened: M2, M3 (first failure each). Closed this round: M1, M4, M5. Adopted this round: 4 (M2, M3, M7, M8). Carried unchanged: M6. No Skip, Defer, or withdrawal. Round 3 reviews plan, platform-semantics, and tests.

### Round 3

Raw verdicts, unchanged:

* plan APPROVED. Closed M2, M3, M7, M8. No bracketed findings.
* platform-semantics REVISE. Closed M2, M3, M7. M8 NOT CLOSED.
* tests REVISE. Closed M7, M8. M2 NOT CLOSED. M3 NOT CLOSED.

M7 is closed by plan, platform-semantics, and tests. M2 and M3 failed closure a second time (tests). Patching the source-count pin stops. A fresh-context review-plan judgment (`probe-1-r3`) recorded the mechanism below. M8 failed closure once (platform) and is corrected, not carried.

Judgment, `probe-1-r3`: the one-observation obligation stays. Identifier counts do not prove it, because a helper hides a second lookup. Diff review traces the observation and its helpers and rejects a second name lookup that supplies either value. That check is CR-2. The unix hook stays and its limit is stated. The directory pre-epoch witness needs a `cfg(test)` hook after `create_dir_at` succeeds and before the observation begins. No Windows swap hook and no rollback.

### M2 — Windows directory seconds are unproved (second failure)

* **Claim:** A pin of `opened_file_identity`, `filetime_to_unix_seconds`, and one direct `open_expected_child` still allows a helper to read seconds from a second handle.
* **Witnesses:** tests r3 finding 1 (blocker). Lineage: M2.
* **Evidence:** The round-3 plan text required that count. Windows `entry_identity_at` (`infra/fs.rs:3107-3113`) is one open today. The tests claim is about a future helper, and no count of a direct call excludes one. Confirmed by reading the observation body and the round-3 wording.
* **MANDATE:** identity and seconds come from one observation.
* **Disposition:** Fix, carried to CR-2. The count pin is withdrawn. The obligation is unchanged. Diff review traces helpers.
* **Authority:** second closure failure, then `probe-1-r3`. Not a new production mechanism.
* **Closure:** carried, CR-2. Not a plan-level adoption.

### M3 — The directory race hook is too late to prove one observation (second failure)

* **Claim:** A count of direct `statat` calls misses a helper that looks up before the pinned call, so the hook swaps too late.
* **Witnesses:** tests r3 finding 2 (blocker). Lineage: M3.
* **Evidence:** Unix `entry_identity_at` (`infra/fs.rs:4416`) is one `statat` today. The same helper-hiding limit as M2. This is the second failure of this lineage.
* **MANDATE:** identity and seconds come from one observation.
* **Disposition:** Fix, carried to CR-2. The `statat` count pin is withdrawn. The hook stays immediately after `statat` and is documented as proof only about lookups after that point.
* **Authority:** second closure failure, then `probe-1-r3`.
* **Closure:** carried, CR-2. Not a plan-level adoption.

### M8 — Pre-epoch coverage stops at the helper (round 3 residual)

* **Claim:** The directory witness sets mtime after `create_dir_at` and before the observation returns, but the planned hooks run after the seconds are captured. The witness cannot execute.
* **Witnesses:** platform-semantics r3 finding 1 (should-fix). Prior witness remains tests r2 finding 2.
* **Evidence:** `create_workspace_directory_inner` calls `create_dir_at` then `entry_identity_at` at `file_workspace.rs:965-966`. The pre-register hook is inside registration (`:257-261`), after that observation. A hook after `statat` reads `st_mtime` that is already captured. Confirmed by reading those lines. First failure of this lineage.
* **MANDATE:** a pre-1970 directory create returns a negative `last_modified`.
* **Disposition:** Fix. A `cfg(test)` hook on the shared create path runs after `create_dir_at` succeeds and before the observation syscall or handle acquisition. The test sets a representable pre-epoch mtime there. The file path still sets mtime inside the write closure.
* **Authority:** the same negative-seconds contract. The previous witness named an interval no existing hook can use. Not a Windows swap hook.
* **Closure:** open. Round 4 checks it.

Closed this round: M7. Carried this round: M2, M3 (CR-2), after the second failure and `probe-1-r3`. Adopted this round: 1 (M8). M6 stays CR-1. No Skip, Defer, or withdrawal. Round 4 reviews plan, platform-semantics, and tests. Open: M8.

### plan-r5.md

# Plan: Workspace create mtime without a pathname reach

## Goal

`create_workspace_file` and `create_workspace_directory` return `WorkspaceEntry.lastModified` as the signed Unix seconds of the object this call installed, taken from the observation that already identified that object. They do not look the new name up again by pathname, and a failure of that observation is not introduced after the entry is registered.

## MANDATE

### Workspace create paths read the new entry's modification time back by pathname

* **ID:** f-20260913-02 · **Status:** open · **Area:** native-fs · **Root:** - · **Entry:** build · **Blocked:** none
* **Where:** `src-tauri/src/file_workspace.rs` — `timestamp` (`:154-159`, `fs::metadata(path)`), called by `create_workspace_file_blocking` (`:683`) and `create_workspace_directory_inner` (`:781`) after the entry was installed through a retained parent descriptor and registered.
* **Defect:** both create paths install the new entry descriptor-relative (`atomic_replace_at_identified`, `create_dir_at`) and register it with the installed identity, then compute `last_modified` by reopening `parent_target.path().join(name)` by pathname. A rename in that window returns the modification time of a different object, and the reach is one of `file_workspace.rs`'s counted R3 sites in `INITIAL_FS_SURFACE_COUNTS`.
* **Open question:** where does the create path take the mtime without a pathname reach and without turning a post-commit race into an error after the entry and its sidecar are already durable and registered — `fstat` of a descriptor retained from the install (the atomic-replace helpers do not return one today), an identity-checked `statat` through the retained parent (which can fail after the durable commit), or reordering the stat before registration?
* **Why it matters:** it is the last production filesystem reach in `file_workspace.rs` once `f-20260905-05` lands; closing it removes the file from the allowlist.
* **Related:** `f-20260905-05` (its plan review split this out as outside that mandate — `timestamp` is metadata, not directory enumeration).
* **Found by:** Claude Code, plan review of `tasks/plans/2026-09-13-workspace-directory-enumeration.md` (`review-minimalism`, `review-root-cause`, `review-tauri-security`), 2026-09-13.

* **Inherited review history (2026-09-13):** load `tasks/handoffs/2026-09-13-workspace-directory-enumeration-review.md` before this finding's plan review. It carries the `f-20260905-05` plan-review record; this finding inherits issue IDs W6, W17 and W24 from it, with their witnesses, dispositions and evidence.

Line numbers in the mandate are the filing's. Locate re-found the same functions at `timestamp` `file_workspace.rs:184-190`, the file call at `:901`, and the directory call at `:1000`.

## Threat model and non-goals

The parent directory is a workspace the user already granted. Another process, or another call that holds no `workspace_mutation` lock, can rename or replace the new leaf after this call's install. That is the adversary the defect names. It is not a cross-user privilege boundary and not a symlink escape of the parent: the parent descriptor is the one the mutation target already holds.

The observation that supplies `lastModified` must name the installed inode, not whatever path string is current at a later lookup. A lookup that fails after `register_created_entry` has returned must not become the command's error: the entry and, for a file, its sidecar are already durable and registered, and today's `timestamp()?` is exactly that post-registration failure (`file_workspace.rs:885-901` and `:967-1000`).

Environments that count are the ones `infra/fs.rs` already splits: Unix (Linux and macOS share the `cfg(unix)` stat path) and Windows.

Non-goals, frozen with this model: directory-identity failure rollback, listing bounds, resolve error categories, root-path wrapper deduplication, renderer copy, and full-precision schema-cache mtimes.

## Traced premises

* `timestamp` is `fs::metadata(path)?.modified()?` and rejects a pre-1970 time with `Error::InvalidInput` (`file_workspace.rs:184-190`). `listed_mtime` documents the opposite renderer contract: `lastModified` is a plain `i64` of Unix seconds, and a negative value is a real date (`file_workspace.rs:172-181`). The enumerator stores `stat.st_mtime` with no nanoseconds (`infra/fs.rs:163-168`). Windows enumeration converts `LastWriteTime` only through `filetime_to_unix_seconds` (`infra/fs.rs:2846-2854`).
* File install already `fstat`s the still-open temporary descriptor after `renameat` and before any pathname lookup, and returns that identity on `AtomicInstalledFile` without returning the descriptor (`infra/fs.rs:4903-4905`, `1759-1767`, `363-367`). The pre-rename `fstat` is `fallback_metadata` (`infra/fs.rs:902-913`). A failed post-rename metadata read returns `CommittedDurabilityUncertain` with that fallback's identity and ctime (`infra/fs.rs:940-949`). The success path returns the post-rename `fstat`. This plan does not claim those two clock readings are equal. The caller uses the reading the helper actually returned.
* Directory install does not keep a descriptor: Unix `mkdirat` plus `sync_all` (`infra/fs.rs:4436-4443`); Windows opens a handle and drops it (`infra/fs.rs:3090-3104`). The next observation is `entry_identity_at` on the retained parent, before registration (`file_workspace.rs:965-975`). Its Unix body is one `statat(AT_SYMLINK_NOFOLLOW)` (`infra/fs.rs:4409-4424`). Its Windows body opens a handle and reads `opened_file_identity`; `platform_support.rs` test `windows_identity_is_read_from_the_retained_handle` (`:937-951`) requires that call to appear in the `entry_identity_at` body itself.
* `entry_identity_at`'s return type is `(u64, u64)`. Callers outside create include `db/mod.rs`, `db/search_index.rs`, and `path_authority`. Changing that return type is not required.
* Production R3 count for `src-tauri/src/file_workspace.rs` is 1 (`scripts/check-rust-release-surface.mjs:32-34`). An allowlist entry with zero production matches must be removed (`check-rust-release-surface.mjs:501-503`). `d-20260901-03` makes the allowlist shrink-only. `#[cfg(test)]` metadata in `file_workspace.rs` is not a production match.
* `d-20261001-06` requires full-precision `SystemTime` mtime for `probe_regular_file_at` / the schema cache. `WorkspaceEntry.lastModified` is the enumerator's whole seconds, not that probe.
* Inherited W6 is this defect, split out of the enumeration mandate. W17 (create-path guard untested) was moot only because W6 was out of that mandate; the race witness below is that test. W24 (where create-path components come from) stays out of scope: registration still calls `workspace_components` inside `register_created_entry` (`file_workspace.rs:247-256`).

## Approach

### Installed-file seconds come from the post-rename fstat

The file create path answers the open question with the first option. The atomic-replace helper already holds the descriptor and already `fstat`s it after the rename. It does not start returning that descriptor.

`TempMetadata` and `AtomicInstalledFile` gain `modified_seconds: i64`, filled from the same metadata read that fills `identity` and `ctime_nanos`, on both the post-rename read and the pre-rename fallback. Unix uses the same `stat.st_mtime` expression as `DirectoryEntry.modified_seconds`. Windows takes that handle's `LastWriteTime` tick word and interprets those bits as `i64`, which is how enumeration already stores `FILE_ID_BOTH_DIR_INFORMATION.LastWriteTime` (`infra/fs.rs:2938`) before `filetime_to_unix_seconds` (`infra/fs.rs:3049`). `std` reports the same word as `u64` (`infra/fs.rs:3761`). The conversion is `filetime_to_unix_seconds` of that `i64` bit pattern, including a high bit that becomes negative. It does not panic, saturate, or return an error. A value whose bits already fit the enumerator's `i64` uses `filetime_to_unix_seconds` unchanged. `windows_filetime_ticks_become_unix_seconds` already pins `filetime_to_unix_seconds(-1)` (`infra/fs.rs:8657-8659`); the create path's `u64` word `u64::MAX` is those same bits.

`create_workspace_file_blocking` sets `last_modified` from `installed.modified_seconds`. It does not call `timestamp`, `fs::metadata`, or `Path::metadata`. A post-rename metadata failure stays the helper's existing `CommittedDurabilityUncertain` outcome and still carries the fallback seconds of that same inode. The caller keeps today's behavior of returning that durability error after registration (`file_workspace.rs:903-905`) and does not add a new error for the seconds.

Rejected for the file path: an identity-checked `statat` of the installed name. It can fail, or observe a replacement, after the PGN and sidecar are durable. Rejected: moving today's pathname `timestamp` to before registration. It is still the R3 reach, and a replacement in that window is still the wrong object.

### Directory seconds come from the pre-registration identity observation

`create_dir_at` does not retain a descriptor, so the file-path `fstat` is not available. The directory create path uses one observation through the retained parent, the same observation as `entry_identity_at`, and it happens before `register_created_entry`.

Directory create calls one observation function once and uses both values from that single return. It does not also call `entry_identity_at`. `entry_identity_at` keeps the `(u64, u64)` return and its current errors. It calls the observation and discards the seconds, so its other callers stay unchanged. The observation is the function that performs the lookup. It is not a wrapper around two lookups.

On Unix the observation keeps today's `entry_identity_at` shape (`infra/fs.rs:4416`): one `rfs::statat`. Identity is `unix::raw_stat_identity` of that `stat`. The seconds are that same `stat.st_mtime`. A `cfg(all(test, unix))` hook runs immediately after that `statat` returns and before either value is derived. The returned pair is built only from that `stat`. The hook proves that a lookup after that `statat` cannot change the pair. It does not prove there was no earlier lookup. No source pin that counts the identifier `statat` is added. A count of direct calls misses a helper, which is why round 3's count pin is withdrawn.

On Windows the observation opens the child with `open_expected_child` (today that open is `win::entry_identity_at`, `infra/fs.rs:3107-3113`) and reads identity with `opened_file_identity` on that handle. The seconds are `filetime_to_unix_seconds` of that same handle's `LastWriteTime` bits interpreted as `i64`, the conversion enumeration already uses (`infra/fs.rs:3049`). Because the open moves out of `entry_identity_at` into the observation, `windows_identity_is_read_from_the_retained_handle` moves its `entry_identity_at` signature onto the observation body. The other four signatures in that test stay on `assert_entry_identity`, `open_verified_parent`, `remove_regular_child`, and `remove_windows_tree_at`. That move keeps the existing identity pin on the body that opens the handle. It does not prove where the seconds come from. `create_workspace_directory_inner` calls the observation once and does not call `entry_identity_at`.

No identifier-count pin is the proof of one observation. CR-2 is that proof, and it is carried to diff review. Do not add a Windows swap hook.

`create_workspace_directory_inner` stores those seconds and does not stat after registration. A failure of the observation stays where `entry_identity_at` fails today: the directory exists, nothing is registered, and this plan adds no rollback. That leak is pre-existing and outside the mandate.

The name can still be replaced between `create_dir_at` and this observation. That window is the one `entry_identity_at` already has. This plan does not widen it and does not add a later pathname lookup after registration, which is the lookup the mandate removes.

### One renderer value, then delete the pathname helper

Both create paths assign that `i64` to `WorkspaceEntry.lastModified`. Subseconds are discarded the way the enumerator discards them. A pre-1970 time is a negative `i64`, not `Error::InvalidInput`. `timestamp` is deleted. No production pathname filesystem reach remains in `file_workspace.rs`.

Remove `src-tauri/src/file_workspace.rs` from `INITIAL_FS_SURFACE_ALLOWLIST` and from `INITIAL_FS_SURFACE_COUNTS`. Do not change `src-tauri/src/fs.rs`'s count. Extend the existing `credentials.rs` baseline pin (`scripts/check-rust-release-surface-core.test.mjs:395-398`) so one assertion covers both paths. Do not add a second test with the same body.

`timestamps_and_durability_outcomes_remain_renderer_safe` calls `timestamp` (`file_workspace.rs:3192`). Keep its durability assertions. Delete the pathname `timestamp` assertion rather than reintroducing the helper for the test.

`collect_tree_entries_lists_the_workspace_shape_on_every_platform` also calls `timestamp`, at `file_workspace.rs:3327` and `:3348`. Both assertions compare a listed `last_modified` with that helper. After `timestamp` is deleted, both comparisons stay: each listed `last_modified` equals the enumerator's whole seconds for that object (Unix `st_mtime`, Windows `filetime_to_unix_seconds` of the `LastWriteTime` bits). Do not delete the comparisons. A `#[cfg(test)]` read does not count as a production pathname reach and is not copied into production code. Do not use `duration_since`. `cargo test --lib file_workspace` does not compile while either call remains.

No Specta type changes. `lastModified` stays `i64`. No frontend change.

### Verification

Level: unit tests plus the release-surface checker. No browser and no dev server. The value is not a new visible control; it is the seconds the create response already returns.

File success witness, in `infra/fs` tests: `atomic_replace_at_identified` on a new leaf returns `modified_seconds` equal to that inode's enumerator's seconds. Set the written file's mtime before the epoch inside the write closure and assert the returned seconds are negative and equal to that `st_mtime` (Unix) or `filetime_to_unix_seconds` of the same tick bits (Windows). This is the witness that `duration_since` is gone on the helper. It is not the witness for `WorkspaceEntry.last_modified`. An ordinary create with no swap does not prove the read was the open descriptor: a pathname stat of an unreplaced name returns the same seconds.

File post-rename swap witness, Unix and Windows: `inject_atomic_file(AtomicFileFaultPoint::PostRenameMetadata)` already runs after `rename` and before `adapter.metadata(&temp)` (`infra/fs.rs:933-934`). The injector's `inject` returns `Ok(())` to continue (`infra/fs.rs:452-454`). This witness's injector, on that point, swaps the installed name for another file with a different mtime and returns `Ok`, so metadata still runs. The returned `modified_seconds` are the pre-swap inode's enumerator seconds, not the replacement's. A pathname lookup of the installed name would return the replacement. This is not the failure arm, which still returns the pre-rename fallback and `CommittedDurabilityUncertain`. The pre-register hook cannot see this window: the helper has already captured the seconds before registration. Do not add a fault-point variant.

Create-path negative witness, both create paths: `create_workspace_file` and `create_workspace_directory` each return a `WorkspaceEntry` whose `last_modified` is negative and equal to that object's enumerator seconds. For a file, set the pre-epoch mtime inside the write closure, before the fstat. For a directory, a `cfg(test)` hook runs on the shared create path immediately after `create_dir_at` succeeds and before the observation syscall or handle acquisition begins. The test arms that hook, sets a representable pre-epoch mtime on the new directory, and calls create on that same thread. The returned `last_modified` is negative and equals those listing seconds. The hook is not the post-`statat` swap hook and not the pre-register hook; both of those run after the seconds are already captured. Neither result is `Error::InvalidInput`, a clamped zero, or a `duration_since` rejection. `collect_tree_entries_lists_a_pre_epoch_entry_with_its_negative_timestamp` (`file_workspace.rs:5095`) covers listings only and is not this witness.

File fallback witness, Unix and Windows: inject `AtomicFileFaultPoint::PostRenameMetadata` (the failure branch at `infra/fs.rs:940-949`; the Windows test at `infra/fs.rs:9021` checks outcome and identity only). Set the mtime, including a pre-epoch value, inside the write closure. The returned `modified_seconds` equal that pre-rename reading of the same descriptor, and the outcome stays `CommittedDurabilityUncertain`. This does not prove that rename preserves mtime.

Registration race witness, Unix, both create paths: arm `WORKSPACE_CREATED_CHILD_PRE_REGISTER_HOOK`, which runs inside `register_created_entry` after install and after the directory observation, before the registry write (`file_workspace.rs:257-261`). In the hook, remember the installed object's seconds, rename it aside, and put a different object of the same kind at the same leaf with a different mtime. The returned `last_modified` equals the installed object's seconds, not the replacement's. This catches a pathname stat after that hook. It does not catch two lookups before the hook.

Same-observation witness, Unix, directory only: the hook is the next statement after the observation's `statat` and before identity or seconds are derived. The hook swaps the new directory for another directory with a different mtime. The identity and `last_modified` returned to `create_workspace_directory_inner` both name the pre-swap directory. This proves a lookup after that `statat` cannot change the pair. It does not prove the absence of an earlier lookup hidden in a helper. That check is CR-2, not another source pin. Do not add a Windows hook.

Windows directory witness: `windows_identity_is_read_from_the_retained_handle` follows the body that contains `opened_file_identity`, as above. It stays an identity pin. A `#[cfg(windows)]` test checks that `create_workspace_directory` returns `last_modified` equal to the enumerator's seconds for that directory. `rust-windows-test` is the runtime proof. This machine does not run that test. The proof that the seconds come from that same handle, and that no second name lookup supplies them, is CR-2. There is no Windows swap hook.

Tick-word witness, Windows: a unit test that the create-path conversion of a `u64` tick word equals `filetime_to_unix_seconds` of those bits as `i64`, for a pre-epoch value that fits and for `u64::MAX`, and does not panic. Extend `windows_filetime_ticks_become_unix_seconds` rather than setting an unrepresentable filesystem mtime.

Surface witness: `pnpm rust:surface:check` exits 0, and the shared baseline pin fails if `file_workspace.rs` is put back on the allowlist.

Platform proof, named rather than newly built: `pnpm rust:windows:check` is the local Windows compile. After push, `rust-macos-test` is the runtime proof of the shared `cfg(unix)` path, `rust-windows-test` is the runtime proof of the `cfg(windows)` path, and `rust-platform` is the MSVC compile of that Windows code. The new reads stay on the existing `cfg(unix)` and `cfg(windows)` adapters. This phase adds no `target_os = "linux"` branch, so the FreeBSD source probe is not applicable. If an edit adds one, the adopting session flips `target_os = "linux"` to `target_os = "freebsd"` in the touched files, compiles, and reverts before commit. The phase leaf does not leave that flip in the tree.

## Decisions and trade-offs

### Decided autonomously

* **Question:** which of the three options in the open question supplies create-path mtime?
  * **Chosen:** post-rename `fstat` seconds returned on `AtomicInstalledFile` for files; the existing pre-registration parent observation, extended to return the same seconds, for directories.
  * **Rejected:** a `statat` after registration (fails or observes a replacement after the durable commit). Rejected: moving pathname `timestamp` earlier (keeps the R3 site and the wrong-object window).
  * **Reason:** the file helper already `fstat`s the installed inode before the name can be looked up. The directory helper never held a descriptor; its identity stat is the last observation before registration. Recorded at adoption with `findings.py record-decision`, not by this planner.

* **Question:** whole seconds or `RegularFileMetadata`'s `SystemTime`?
  * **Chosen:** the enumerator's signed Unix seconds.
  * **Rejected:** nanosecond `SystemTime` from `d-20261001-06`.
  * **Reason:** that decision governs the schema-cache probe. `WorkspaceEntry.lastModified` is the field `DirectoryEntry.modified_seconds` already fills. A create response and a later listing of an untouched file report the same integer.

* **Question:** one phase or a split between `infra/fs.rs` and `file_workspace.rs`?
  * **Chosen:** one phase. The new field is unused until the create path consumes it, and the allowlist shrink is false until `timestamp` is gone.
  * **Rejected:** shipping the struct field alone.

## Risks / open questions

None that change the mechanism. Known limit, stated rather than solved: a directory name replaced between `create_dir_at` and the identity observation is attributed as today's `entry_identity_at` attributes it. The returned seconds belong to that same observation, so they cannot name a different object than the registered identity.

## Not part of this task

* `f-20260913-03` (root-path wrappers), `f-20260913-04` (resolve `Conflict` category), `f-20260913-05` (listing error copy), `f-20260913-06` (listing bounds and failed-listing registry churn).
* W24's component source. Registration is unchanged.
* Rollback when directory identity observation fails.
* `src-tauri/src/fs.rs` allowlist count.
* Renderer, bindings, and browser verification.

## Phases

### Phase 1 — Create-path seconds and the allowlist shrink

Files: `src-tauri/src/infra/fs.rs`, `src-tauri/src/file_workspace.rs`, `src-tauri/src/infra/platform_support.rs` (only so `windows_identity_is_read_from_the_retained_handle` follows the body that contains `opened_file_identity`), `scripts/check-rust-release-surface.mjs`, `scripts/check-rust-release-surface-core.test.mjs`.

Touches filesystem identity and mtime. No auth, persistence schema, concurrency primitive, or IPC contract change. The `workspace_mutation` lock and registration order stay as they are.

Role: `sensitive` (`src-tauri/src/infra/**`).

PROOF:

```bash
cargo fmt --manifest-path src-tauri/Cargo.toml -- --check
cargo test --manifest-path src-tauri/Cargo.toml --locked --lib infra::fs:: -- --test-threads=8
cargo test --manifest-path src-tauri/Cargo.toml --locked --lib file_workspace:: -- --test-threads=8
cargo test --manifest-path src-tauri/Cargo.toml --locked --lib infra::platform_support:: -- --test-threads=8
pnpm rust:windows:check
pnpm rust:surface:check
pnpm exec vitest run scripts/check-rust-release-surface-core.test.mjs
```

A red proof is a red phase. `pnpm checks:pre-review` is the adopting session's pre-review block, not a substitute for this proof.

## Carried to diff review

* **CR-1.** The baseline pin is one assertion over `src-tauri/src/credentials.rs` and `src-tauri/src/file_workspace.rs`, not a second copy of the `credentials.rs` test body. The obligation is unchanged: putting `file_workspace.rs` back on the allowlist or the counts object fails the pin.
* **CR-2.** Diff review traces the directory observation and every helper it calls. Both returned values come from the same Unix `stat` result or the same retained Windows handle, and those values are what registration stores and what `WorkspaceEntry.last_modified` returns. A second name lookup that supplies either value fails the review. The unix swap hook only proves that a lookup after `statat` cannot change the returned pair. No Windows swap hook, and no further identifier-count pin.

## Decided autonomously

See Decisions and trade-offs. The adopting session records the mtime-source decision. This planner does not write `tasks/decisions.md`.

## Reviews

Round 1 wall time is `plan-meta.json` `review.per_round_seconds`. Twelve plan-capable lenses. `review-code-quality` and `review-root-cause` are `plan-review: false` and were not launched. No quota wait.

Raw verdicts, unchanged:

* chess-semantics APPROVED. `NOT APPLICABLE: The files and mandate concern filesystem modification-time observations; they do not involve an in-memory chess tree, position, or move path.`
* correctness APPROVED. No findings.
* engine-protocol APPROVED. `NOT APPLICABLE: The plan concerns filesystem timestamps and release-surface checks; it does not touch engine processes, UCI state, or asynchronous engine-result routing.`
* error-handling APPROVED. No findings.
* ipc-contract APPROVED. No IPC-contract defects. `lastModified` stays a signed Unix-seconds value.
* minimalism REVISE. One finding, M6.
* persisted-state APPROVED. `NOT APPLICABLE: The plan concerns Rust filesystem modification-time observations and release-surface checks; it has no renderer state, storage keys, or tab lifecycle.`
* pgn-index APPROVED. `NOT APPLICABLE: The plan concerns filesystem metadata for workspace creation; it does not touch PGN scanning, indexing, encoding, or searching.`
* plan REVISE. Two findings, M1 and M2.
* platform-semantics REVISE. Three findings, M5, M1, M4.
* tauri-security APPROVED. No findings.
* tests REVISE. Four findings, M3, M1, M2, M4.

### M1 — Fallback seconds have no witness

* **Claim:** The file witness never injects `PostRenameMetadata`, so the promised fallback seconds can be missing and the proof stays green. The sentence "rename does not change mtime" was not measured.
* **Witnesses:** plan r1 finding 1 (blocker); platform-semantics r1 finding 2 (should-fix); tests r1 finding 2 (should-fix).
* **Evidence:** `infra/fs.rs:902-913` saves `fallback_metadata` before rename. `infra/fs.rs:940-949` returns that identity and ctime on post-rename metadata failure, with `CommittedDurabilityUncertain`. `infra/fs.rs:9021-9047` asserts outcome, identity, and bytes, not seconds. No unix test injects `PostRenameMetadata`.
* **MANDATE:** the open question forbids turning a post-commit metadata failure into an error after the durable commit, and the returned seconds must name the installed inode.
* **Disposition:** Fix. The success path returns the post-rename fstat. The failure path returns the pre-rename fstat of the same descriptor. The plan no longer claims those readings match. Verification adds the fault witness, including a pre-epoch mtime, on Unix and Windows.
* **Authority:** MANDATE open question, third option rejected; fallback is the first option's failure branch already in the traced install.
* **Closure:** round 2.

### M2 — Windows directory seconds are unproved

* **Claim:** The file helper and the Unix race do not exercise the Windows directory observation. A raw FILETIME could pass every stated witness.
* **Witnesses:** plan r1 finding 2 (blocker); tests r1 finding 3 (should-fix).
* **Evidence:** Windows `entry_identity_at` (`infra/fs.rs:3107-3113`) returns only `(u64, u64)` from `opened_file_identity`. `windows_identity_is_read_from_the_retained_handle` (`platform_support.rs:937-951`) checks that call and not the conversion. Enumeration converts with `filetime_to_unix_seconds` (`infra/fs.rs:3049`).
* **MANDATE:** both create paths, on the environments the threat model names, return the installed object's listing seconds.
* **Disposition:** Fix. Directory create uses one observation that returns identity and seconds. A source pin requires `filetime_to_unix_seconds` in that Windows body. A `#[cfg(windows)]` create test compares `last_modified` to the enumerator. `rust-windows-test` runs it.
* **Authority:** MANDATE "both create paths" and the threat-model sentence that Windows counts.
* **Closure:** round 2.

### M3 — The directory race hook is too late to prove one observation

* **Claim:** `WORKSPACE_CREATED_CHILD_PRE_REGISTER_HOOK` runs after `entry_identity_at` has returned. Two lookups before registration can return seconds for a different object while that test passes.
* **Witnesses:** tests r1 finding 1 (blocker).
* **Evidence:** `create_workspace_directory_inner` calls `entry_identity_at` at `file_workspace.rs:966` and then `register_created_entry` at `:967`. The hook is inside registration at `:257-261`.
* **MANDATE:** the seconds and the registered identity name the same installed object. The open question's pathname window is the defect.
* **Disposition:** Fix. Directory create calls one function once and does not also call `entry_identity_at`. A unix hook inside that observation, after the copy and before return, swaps the directory. Identity and seconds must both be the pre-swap object. The pre-register hook stays as the witness that nothing restats after that point. No Windows hook.
* **Authority:** MANDATE defect (a rename returns a different object's mtime) plus the plan's own "one stat" sentence, which the round-1 witness did not enforce.
* **Closure:** round 2.

### M4 — An out-of-range Windows tick word has no defined result

* **Claim:** "Must not panic" does not say what a `u64` tick word outside `i64` becomes, and the pre-epoch witness uses a value that fits.
* **Witnesses:** platform-semantics r1 finding 3 (should-fix); tests r1 finding 4 (should-fix).
* **Evidence:** `filetime_to_unix_seconds` takes `i64` (`infra/fs.rs:2850-2854`). Enumeration stores `header.LastWriteTime` as `i64` (`infra/fs.rs:2938`). The handle metadata path reads `last_write_time()` as `u64` (`infra/fs.rs:3761`). `windows_filetime_ticks_become_unix_seconds` pins `filetime_to_unix_seconds(-1)` (`infra/fs.rs:8659`).
* **MANDATE:** create and a later listing of an untouched file report the same integer. The enumerator already interprets the tick bits as `i64`.
* **Disposition:** Fix. The create path passes those bits to `filetime_to_unix_seconds` as `i64`, including the high bit. It does not saturate or error. The witness covers a fitting pre-epoch value and `u64::MAX`.
* **Authority:** the decided contract that create seconds equal the enumerator's seconds. A saturating converter would be a second conversion.
* **Closure:** round 2.

### M5 — Platform proof jobs were unnamed

* **Claim:** Host tests and the surface gate do not prove Windows or macOS, and the plan omitted `pnpm rust:windows:check` and the FreeBSD probe.
* **Witnesses:** platform-semantics r1 finding 1 (should-fix).
* **Evidence:** Push skill names `pnpm rust:windows:check` at `.claude/skills/push/SKILL.md:108` as the local compile, and `rust-windows-test`, `rust-macos-test`, and `rust-platform` at `:376` as the jobs this machine cannot run. The new reads sit on the existing `cfg(unix)` fstat (`infra/fs.rs:1759-1767`) and `cfg(windows)` metadata (`infra/fs.rs:3758-3766`). `AtomicInstalledFile` and `TempMetadata` literals are in shared or cfg-split adapters already compiled on Linux (`infra/fs.rs:944`, `:957`, `:969`, `:1763`, `:3763`, `:4936`). This change adds no `target_os = "linux"` branch.
* **Disposition:** Fix. PROOF includes `pnpm rust:windows:check`. The plan names the three CI jobs. The FreeBSD probe is not applicable unless an edit adds a `target_os = "linux"` branch; the plan forbids that branch. No new probe harness.
* **Authority:** the lens's platform-proof rule, which is the verification level for the threat model's Unix and Windows environments. Not a new CI mechanism.
* **Closure:** round 2.

### M6 — Baseline pin would duplicate the credentials test

* **Claim:** A second "left the baseline" test copies the `credentials.rs` assertions.
* **Witnesses:** minimalism r1 finding 1 (should-fix).
* **Evidence:** `scripts/check-rust-release-surface-core.test.mjs:395-398` is one test with two expects. The obligation is that `file_workspace.rs` stays off the allowlist and the counts object.
* **Disposition:** Fix, carried to CR-1. One assertion covers both paths. The obligation's contract is unchanged.
* **Closure:** carried, CR-1. Not a plan-level adoption.

Opened 6, resolved this round 1 (M6 carried), open for closure 5 (M1–M5). Adopted this round: 5. Carried: 1. No Skip, Defer, or withdrawal. No correction-introduced issue yet. Round 2 reviews plan, platform-semantics, and tests.

### Round 2

Raw verdicts, unchanged:

* plan REVISE. Closed M1, M2, M3, M4, M5. One new finding, M7.
* platform-semantics REVISE. Closed M1, M3, M4, M5. M2 NOT CLOSED.
* tests REVISE. Closed M1, M2, M4, M5. M3 NOT CLOSED. One new finding, M8.

M1, M4, and M5 are closed by every lens that witnessed them. Their round-1 closure lines stand. M2 and M3 stay open: a lens that did not close them overrides a lens that did. M6 stays carried as CR-1 and was not re-reviewed.

### M2 — Windows directory seconds are unproved (round 2 residual)

* **Claim:** The cited pin at `platform_support.rs:948` checks only `opened_file_identity`. A normal Windows create cannot catch a second time lookup after the identity observation.
* **Witnesses:** platform-semantics r2 finding 1 (should-fix). Lineage: M2. Prior witnesses remain plan r1 finding 2 and tests r1 finding 3.
* **Evidence:** `windows_identity_is_read_from_the_retained_handle` (`platform_support.rs:937-951`) asserts `opened_file_identity` and nothing else. Windows `entry_identity_at` (`infra/fs.rs:3107-3113`) is one `open_expected_child` plus `opened_file_identity`, and it returns no seconds. Confirmed by reading both bodies. This is the first failure of this lineage.
* **MANDATE:** both create paths return the installed object's listing seconds from the same observation as the registered identity.
* **Disposition:** Fix. The seconds pin is a new assertion, not the existing identity loop. The observation body contains `opened_file_identity`, `filetime_to_unix_seconds`, and exactly one `open_expected_child`. The identity loop's `entry_identity_at` signature moves onto that body. `create_workspace_directory_inner` calls the observation once and does not call `entry_identity_at`. No Windows swap hook.
* **Authority:** the same MANDATE obligation as round 1. The correction changes the verification contract of that obligation. It adds no rollback and no second production lookup.
* **Closure:** open. Round 3 checks it. Round 2 cannot close it.

### M3 — The directory race hook is too late to prove one observation (round 2 residual)

* **Claim:** A hook that runs after identity and seconds are copied never injects a swap between two earlier lookups, so both assertions can pass.
* **Witnesses:** tests r2 finding 1 (blocker). Lineage: M3. Prior witness remains tests r1 finding 1.
* **Evidence:** The round-1 correction put the hook after the copy. Unix `entry_identity_at` (`infra/fs.rs:4416`) is one `rfs::statat` followed by `raw_stat_identity`. Confirmed by reading that body. This is the first failure of this lineage.
* **MANDATE:** the seconds and the registered identity name the same installed object.
* **Disposition:** Fix. The hook is the next statement after the observation's single `statat` and before either value is derived. The returned pair is built only from that `stat`. A source pin counts `statat` in that braced body and fails unless the count is one. The pre-register hook stays. No Windows hook.
* **Authority:** the same MANDATE defect as round 1. The failed placement did not enforce one syscall.
* **Closure:** open. Round 3 checks it. Round 2 cannot close it.

### M7 — Deleting `timestamp` leaves the listing-shape test calling it

* **Claim:** Cleanup names only `timestamps_and_durability_outcomes_remain_renderer_safe`. `collect_tree_entries_lists_the_workspace_shape_on_every_platform` also calls `timestamp`, so `cargo test --lib file_workspace` does not compile.
* **Witnesses:** plan r2 finding 1 (blocker).
* **Evidence:** `file_workspace.rs:3327` and `:3348` compare listed `last_modified` to `timestamp(...)`. Confirmed by reading the test. The durability call at `:3192` was already named.
* **MANDATE:** `timestamp` is deleted, and the phase proof includes `cargo test --lib file_workspace`. The listing comparisons are the coverage that deletion must keep.
* **Disposition:** Fix. Both listing assertions stay and compare `last_modified` to the enumerator's whole seconds. They do not call `timestamp` and do not use `duration_since`. A test-only read is not a production pathname reach.
* **Authority:** the plan's own delete-`timestamp` obligation plus a red phase proof. Not a listing-bounds change (`f-20260913-06` stays out).
* **Closure:** open. Round 3 checks it.

### M8 — Pre-epoch coverage stops at the helper

* **Claim:** The pre-epoch assertion is on `atomic_replace_at_identified`. A caller that clamps or rejects a negative `WorkspaceEntry.last_modified` still passes.
* **Witnesses:** tests r2 finding 2 (blocker).
* **Evidence:** The file success witness stops at `modified_seconds`. `create_workspace_directory_inner` assigns `last_modified` at `file_workspace.rs:1000` from `timestamp`, which rejects pre-1970. `collect_tree_entries_lists_a_pre_epoch_entry_with_its_negative_timestamp` (`file_workspace.rs:5095`) lists an existing file and does not call either create path. Confirmed by reading that test's opening.
* **MANDATE:** a pre-1970 time is a negative `i64` on the value the create response returns, not `Error::InvalidInput`.
* **Disposition:** Fix. Both `create_workspace_file` and `create_workspace_directory` return a negative `last_modified` equal to the enumerator's seconds. The helper witness stays and does not replace this one.
* **Authority:** the decided contract that create seconds equal the enumerator's seconds, including a negative value. Not a new numeric formula.
* **Closure:** open. Round 3 checks it.

Opened this round: M7, M8. Re-opened: M2, M3 (first failure each). Closed this round: M1, M4, M5. Adopted this round: 4 (M2, M3, M7, M8). Carried unchanged: M6. No Skip, Defer, or withdrawal. Round 3 reviews plan, platform-semantics, and tests.

### Round 3

Raw verdicts, unchanged:

* plan APPROVED. Closed M2, M3, M7, M8. No bracketed findings.
* platform-semantics REVISE. Closed M2, M3, M7. M8 NOT CLOSED.
* tests REVISE. Closed M7, M8. M2 NOT CLOSED. M3 NOT CLOSED.

M7 is closed by plan, platform-semantics, and tests. M2 and M3 failed closure a second time (tests). Patching the source-count pin stops. A fresh-context review-plan judgment (`probe-1-r3`) recorded the mechanism below. M8 failed closure once (platform) and is corrected, not carried.

Judgment, `probe-1-r3`: the one-observation obligation stays. Identifier counts do not prove it, because a helper hides a second lookup. Diff review traces the observation and its helpers and rejects a second name lookup that supplies either value. That check is CR-2. The unix hook stays and its limit is stated. The directory pre-epoch witness needs a `cfg(test)` hook after `create_dir_at` succeeds and before the observation begins. No Windows swap hook and no rollback.

### M2 — Windows directory seconds are unproved (second failure)

* **Claim:** A pin of `opened_file_identity`, `filetime_to_unix_seconds`, and one direct `open_expected_child` still allows a helper to read seconds from a second handle.
* **Witnesses:** tests r3 finding 1 (blocker). Lineage: M2.
* **Evidence:** The round-3 plan text required that count. Windows `entry_identity_at` (`infra/fs.rs:3107-3113`) is one open today. The tests claim is about a future helper, and no count of a direct call excludes one. Confirmed by reading the observation body and the round-3 wording.
* **MANDATE:** identity and seconds come from one observation.
* **Disposition:** Fix, carried to CR-2. The count pin is withdrawn. The obligation is unchanged. Diff review traces helpers.
* **Authority:** second closure failure, then `probe-1-r3`. Not a new production mechanism.
* **Closure:** carried, CR-2. Not a plan-level adoption.

### M3 — The directory race hook is too late to prove one observation (second failure)

* **Claim:** A count of direct `statat` calls misses a helper that looks up before the pinned call, so the hook swaps too late.
* **Witnesses:** tests r3 finding 2 (blocker). Lineage: M3.
* **Evidence:** Unix `entry_identity_at` (`infra/fs.rs:4416`) is one `statat` today. The same helper-hiding limit as M2. This is the second failure of this lineage.
* **MANDATE:** identity and seconds come from one observation.
* **Disposition:** Fix, carried to CR-2. The `statat` count pin is withdrawn. The hook stays immediately after `statat` and is documented as proof only about lookups after that point.
* **Authority:** second closure failure, then `probe-1-r3`.
* **Closure:** carried, CR-2. Not a plan-level adoption.

### M8 — Pre-epoch coverage stops at the helper (round 3 residual)

* **Claim:** The directory witness sets mtime after `create_dir_at` and before the observation returns, but the planned hooks run after the seconds are captured. The witness cannot execute.
* **Witnesses:** platform-semantics r3 finding 1 (should-fix). Prior witness remains tests r2 finding 2.
* **Evidence:** `create_workspace_directory_inner` calls `create_dir_at` then `entry_identity_at` at `file_workspace.rs:965-966`. The pre-register hook is inside registration (`:257-261`), after that observation. A hook after `statat` reads `st_mtime` that is already captured. Confirmed by reading those lines. First failure of this lineage.
* **MANDATE:** a pre-1970 directory create returns a negative `last_modified`.
* **Disposition:** Fix. A `cfg(test)` hook on the shared create path runs after `create_dir_at` succeeds and before the observation syscall or handle acquisition. The test sets a representable pre-epoch mtime there. The file path still sets mtime inside the write closure.
* **Authority:** the same negative-seconds contract. The previous witness named an interval no existing hook can use. Not a Windows swap hook.
* **Closure:** open. Round 4 checks it.

Closed this round: M7. Carried this round: M2, M3 (CR-2), after the second failure and `probe-1-r3`. Adopted this round: 1 (M8). M6 stays CR-1. No Skip, Defer, or withdrawal. Round 4 reviews plan, platform-semantics, and tests. Open: M8.

### Round 4

Raw verdicts, unchanged:

* plan APPROVED. Closed M8. No bracketed findings.
* platform-semantics APPROVED. Closed M8. No bracketed findings.
* tests REVISE. Closed M8. One new finding, M9.

M8 is closed by plan, platform-semantics, and tests. The directory hook is the witness platform asked for.

### M9 — The file success witness misses a pathname stat after rename

* **Claim:** An ordinary create compares mtime with no swap, so a pathname lookup after rename still passes. The pre-register hook runs after the helper has captured seconds. The fallback witness covers only the failure arm.
* **Witnesses:** tests r4 finding 1 (blocker).
* **Evidence:** `PostRenameMetadata` is injected after `rename` and before `adapter.metadata(&temp)` (`infra/fs.rs:933-934`). `inject_atomic_file` continues when `inject` returns `Ok` (`infra/fs.rs:452-454`). The failure arm at `:940-949` does not run on `Ok`. Registration starts only after the helper returns, so `WORKSPACE_CREATED_CHILD_PRE_REGISTER_HOOK` is later. Confirmed by reading those lines.
* **MANDATE:** a rename in the window between install and the metadata read must not supply another object's seconds. The file success path is that window.
* **Disposition:** Fix. The same inject point swaps the installed name and returns `Ok`. The returned seconds are the pre-swap inode's. No new fault-point variant. The failure arm stays the fallback witness.
* **Authority:** MANDATE defect, file path. The existing injector is the interval. Not a new production lookup.
* **Closure:** open. Round 5 checks it.

Closed this round: M8. Opened this round: M9. Adopted this round: 1 (M9). Carried unchanged: M6, M2, M3. No Skip, Defer, or withdrawal. Round 5 reviews plan, platform-semantics, and tests.

### plan-r6.md

# Plan: Workspace create mtime without a pathname reach

## Goal

`create_workspace_file` and `create_workspace_directory` return `WorkspaceEntry.lastModified` as the signed Unix seconds of the object this call installed, taken from the observation that already identified that object. They do not look the new name up again by pathname, and a failure of that observation is not introduced after the entry is registered.

## MANDATE

### Workspace create paths read the new entry's modification time back by pathname

* **ID:** f-20260913-02 · **Status:** open · **Area:** native-fs · **Root:** - · **Entry:** build · **Blocked:** none
* **Where:** `src-tauri/src/file_workspace.rs` — `timestamp` (`:154-159`, `fs::metadata(path)`), called by `create_workspace_file_blocking` (`:683`) and `create_workspace_directory_inner` (`:781`) after the entry was installed through a retained parent descriptor and registered.
* **Defect:** both create paths install the new entry descriptor-relative (`atomic_replace_at_identified`, `create_dir_at`) and register it with the installed identity, then compute `last_modified` by reopening `parent_target.path().join(name)` by pathname. A rename in that window returns the modification time of a different object, and the reach is one of `file_workspace.rs`'s counted R3 sites in `INITIAL_FS_SURFACE_COUNTS`.
* **Open question:** where does the create path take the mtime without a pathname reach and without turning a post-commit race into an error after the entry and its sidecar are already durable and registered — `fstat` of a descriptor retained from the install (the atomic-replace helpers do not return one today), an identity-checked `statat` through the retained parent (which can fail after the durable commit), or reordering the stat before registration?
* **Why it matters:** it is the last production filesystem reach in `file_workspace.rs` once `f-20260905-05` lands; closing it removes the file from the allowlist.
* **Related:** `f-20260905-05` (its plan review split this out as outside that mandate — `timestamp` is metadata, not directory enumeration).
* **Found by:** Claude Code, plan review of `tasks/plans/2026-09-13-workspace-directory-enumeration.md` (`review-minimalism`, `review-root-cause`, `review-tauri-security`), 2026-09-13.

* **Inherited review history (2026-09-13):** load `tasks/handoffs/2026-09-13-workspace-directory-enumeration-review.md` before this finding's plan review. It carries the `f-20260905-05` plan-review record; this finding inherits issue IDs W6, W17 and W24 from it, with their witnesses, dispositions and evidence.

Line numbers in the mandate are the filing's. Locate re-found the same functions at `timestamp` `file_workspace.rs:184-190`, the file call at `:901`, and the directory call at `:1000`.

## Threat model and non-goals

The parent directory is a workspace the user already granted. Another process, or another call that holds no `workspace_mutation` lock, can rename or replace the new leaf after this call's install. That is the adversary the defect names. It is not a cross-user privilege boundary and not a symlink escape of the parent: the parent descriptor is the one the mutation target already holds.

The observation that supplies `lastModified` must name the installed inode, not whatever path string is current at a later lookup. A lookup that fails after `register_created_entry` has returned must not become the command's error: the entry and, for a file, its sidecar are already durable and registered, and today's `timestamp()?` is exactly that post-registration failure (`file_workspace.rs:885-901` and `:967-1000`).

Environments that count are the ones `infra/fs.rs` already splits: Unix (Linux and macOS share the `cfg(unix)` stat path) and Windows.

Non-goals, frozen with this model: directory-identity failure rollback, listing bounds, resolve error categories, root-path wrapper deduplication, renderer copy, and full-precision schema-cache mtimes.

## Traced premises

* `timestamp` is `fs::metadata(path)?.modified()?` and rejects a pre-1970 time with `Error::InvalidInput` (`file_workspace.rs:184-190`). `listed_mtime` documents the opposite renderer contract: `lastModified` is a plain `i64` of Unix seconds, and a negative value is a real date (`file_workspace.rs:172-181`). The enumerator stores `stat.st_mtime` with no nanoseconds (`infra/fs.rs:163-168`). Windows enumeration converts `LastWriteTime` only through `filetime_to_unix_seconds` (`infra/fs.rs:2846-2854`).
* File install already `fstat`s the still-open temporary descriptor after `renameat` and before any pathname lookup, and returns that identity on `AtomicInstalledFile` without returning the descriptor (`infra/fs.rs:4903-4905`, `1759-1767`, `363-367`). The pre-rename `fstat` is `fallback_metadata` (`infra/fs.rs:902-913`). A failed post-rename metadata read returns `CommittedDurabilityUncertain` with that fallback's identity and ctime (`infra/fs.rs:940-949`). The success path returns the post-rename `fstat`. This plan does not claim those two clock readings are equal. The caller uses the reading the helper actually returned.
* Directory install does not keep a descriptor: Unix `mkdirat` plus `sync_all` (`infra/fs.rs:4436-4443`); Windows opens a handle and drops it (`infra/fs.rs:3090-3104`). The next observation is `entry_identity_at` on the retained parent, before registration (`file_workspace.rs:965-975`). Its Unix body is one `statat(AT_SYMLINK_NOFOLLOW)` (`infra/fs.rs:4409-4424`). Its Windows body opens a handle and reads `opened_file_identity`; `platform_support.rs` test `windows_identity_is_read_from_the_retained_handle` (`:937-951`) requires that call to appear in the `entry_identity_at` body itself.
* `entry_identity_at`'s return type is `(u64, u64)`. Callers outside create include `db/mod.rs`, `db/search_index.rs`, and `path_authority`. Changing that return type is not required.
* Production R3 count for `src-tauri/src/file_workspace.rs` is 1 (`scripts/check-rust-release-surface.mjs:32-34`). An allowlist entry with zero production matches must be removed (`check-rust-release-surface.mjs:501-503`). `d-20260901-03` makes the allowlist shrink-only. `#[cfg(test)]` metadata in `file_workspace.rs` is not a production match.
* `d-20261001-06` requires full-precision `SystemTime` mtime for `probe_regular_file_at` / the schema cache. `WorkspaceEntry.lastModified` is the enumerator's whole seconds, not that probe.
* Inherited W6 is this defect, split out of the enumeration mandate. W17 (create-path guard untested) was moot only because W6 was out of that mandate; the race witness below is that test. W24 (where create-path components come from) stays out of scope: registration still calls `workspace_components` inside `register_created_entry` (`file_workspace.rs:247-256`).

## Approach

### Installed-file seconds come from the post-rename fstat

The file create path answers the open question with the first option. The atomic-replace helper already holds the descriptor and already `fstat`s it after the rename. It does not start returning that descriptor.

`TempMetadata` and `AtomicInstalledFile` gain `modified_seconds: i64`, filled from the same metadata read that fills `identity` and `ctime_nanos`, on both the post-rename read and the pre-rename fallback. Unix uses the same `stat.st_mtime` expression as `DirectoryEntry.modified_seconds`. Windows takes that handle's `LastWriteTime` tick word and interprets those bits as `i64`, which is how enumeration already stores `FILE_ID_BOTH_DIR_INFORMATION.LastWriteTime` (`infra/fs.rs:2938`) before `filetime_to_unix_seconds` (`infra/fs.rs:3049`). `std` reports the same word as `u64` (`infra/fs.rs:3761`). The conversion is `filetime_to_unix_seconds` of that `i64` bit pattern, including a high bit that becomes negative. It does not panic, saturate, or return an error. A value whose bits already fit the enumerator's `i64` uses `filetime_to_unix_seconds` unchanged. `windows_filetime_ticks_become_unix_seconds` already pins `filetime_to_unix_seconds(-1)` (`infra/fs.rs:8657-8659`); the create path's `u64` word `u64::MAX` is those same bits.

`create_workspace_file_blocking` sets `last_modified` from `installed.modified_seconds`. It does not call `timestamp`, `fs::metadata`, or `Path::metadata`. A post-rename metadata failure stays the helper's existing `CommittedDurabilityUncertain` outcome and still carries the fallback seconds of that same inode. The caller keeps today's behavior of returning that durability error after registration (`file_workspace.rs:903-905`) and does not add a new error for the seconds.

Rejected for the file path: an identity-checked `statat` of the installed name. It can fail, or observe a replacement, after the PGN and sidecar are durable. Rejected: moving today's pathname `timestamp` to before registration. It is still the R3 reach, and a replacement in that window is still the wrong object.

### Directory seconds come from the pre-registration identity observation

`create_dir_at` does not retain a descriptor, so the file-path `fstat` is not available. The directory create path uses one observation through the retained parent, the same observation as `entry_identity_at`, and it happens before `register_created_entry`.

Directory create calls one observation function once and uses both values from that single return. It does not also call `entry_identity_at`. `entry_identity_at` keeps the `(u64, u64)` return and its current errors. It calls the observation and discards the seconds, so its other callers stay unchanged. The observation is the function that performs the lookup. It is not a wrapper around two lookups.

On Unix the observation keeps today's `entry_identity_at` shape (`infra/fs.rs:4416`): one `rfs::statat`. Identity is `unix::raw_stat_identity` of that `stat`. The seconds are that same `stat.st_mtime`. A `cfg(all(test, unix))` hook runs immediately after that `statat` returns and before either value is derived. The returned pair is built only from that `stat`. The hook proves that a lookup after that `statat` cannot change the pair. It does not prove there was no earlier lookup. No source pin that counts the identifier `statat` is added. A count of direct calls misses a helper, which is why round 3's count pin is withdrawn.

On Windows the observation opens the child with `open_expected_child` (today that open is `win::entry_identity_at`, `infra/fs.rs:3107-3113`) and reads identity with `opened_file_identity` on that handle. The seconds are `filetime_to_unix_seconds` of that same handle's `LastWriteTime` bits interpreted as `i64`, the conversion enumeration already uses (`infra/fs.rs:3049`). Because the open moves out of `entry_identity_at` into the observation, `windows_identity_is_read_from_the_retained_handle` moves its `entry_identity_at` signature onto the observation body. The other four signatures in that test stay on `assert_entry_identity`, `open_verified_parent`, `remove_regular_child`, and `remove_windows_tree_at`. That move keeps the existing identity pin on the body that opens the handle. It does not prove where the seconds come from. `create_workspace_directory_inner` calls the observation once and does not call `entry_identity_at`.

No identifier-count pin is the proof of one observation. CR-2 is that proof, and it is carried to diff review. Do not add a Windows swap hook.

`create_workspace_directory_inner` stores those seconds and does not stat after registration. A failure of the observation stays where `entry_identity_at` fails today: the directory exists, nothing is registered, and this plan adds no rollback. That leak is pre-existing and outside the mandate.

The name can still be replaced between `create_dir_at` and this observation. That window is the one `entry_identity_at` already has. This plan does not widen it and does not add a later pathname lookup after registration, which is the lookup the mandate removes.

### One renderer value, then delete the pathname helper

Both create paths assign that `i64` to `WorkspaceEntry.lastModified`. Subseconds are discarded the way the enumerator discards them. A pre-1970 time is a negative `i64`, not `Error::InvalidInput`. `timestamp` is deleted. No production pathname filesystem reach remains in `file_workspace.rs`.

Remove `src-tauri/src/file_workspace.rs` from `INITIAL_FS_SURFACE_ALLOWLIST` and from `INITIAL_FS_SURFACE_COUNTS`. Do not change `src-tauri/src/fs.rs`'s count. Extend the existing `credentials.rs` baseline pin (`scripts/check-rust-release-surface-core.test.mjs:395-398`) so one assertion covers both paths. Do not add a second test with the same body.

`timestamps_and_durability_outcomes_remain_renderer_safe` calls `timestamp` (`file_workspace.rs:3192`). Keep its durability assertions. Delete the pathname `timestamp` assertion rather than reintroducing the helper for the test.

`collect_tree_entries_lists_the_workspace_shape_on_every_platform` also calls `timestamp`, at `file_workspace.rs:3327` and `:3348`. Both assertions compare a listed `last_modified` with that helper. After `timestamp` is deleted, both comparisons stay: each listed `last_modified` equals the enumerator's whole seconds for that object (Unix `st_mtime`, Windows `filetime_to_unix_seconds` of the `LastWriteTime` bits). Do not delete the comparisons. A `#[cfg(test)]` read does not count as a production pathname reach and is not copied into production code. Do not use `duration_since`. `cargo test --lib file_workspace` does not compile while either call remains.

No Specta type changes. `lastModified` stays `i64`. No frontend change.

### Verification

Level: unit tests plus the release-surface checker. No browser and no dev server. The value is not a new visible control; it is the seconds the create response already returns.

File success witness, in `infra/fs` tests: `atomic_replace_at_identified` on a new leaf returns `modified_seconds` equal to that inode's enumerator's seconds. Set the written file's mtime before the epoch inside the write closure and assert the returned seconds are negative and equal to that `st_mtime` (Unix) or `filetime_to_unix_seconds` of the same tick bits (Windows). This is the witness that `duration_since` is gone on the helper. It is not the witness for `WorkspaceEntry.last_modified`. An ordinary create with no swap does not prove the read was the open descriptor: a pathname stat of an unreplaced name returns the same seconds.

File post-rename swap witness, Unix: `inject_atomic_file(AtomicFileFaultPoint::PostRenameMetadata)` already runs after `rename` and before `adapter.metadata(&temp)` (`infra/fs.rs:933-934`). The injector's `inject` returns `Ok(())` to continue (`infra/fs.rs:452-454`). This witness's injector, on that point, swaps the installed name for another file with a different mtime and returns `Ok`, so metadata still runs. The returned `modified_seconds` are the pre-swap inode's enumerator seconds, not the replacement's. A pathname lookup of the installed name would return the replacement. This is not the failure arm, which still returns the pre-rename fallback and `CommittedDurabilityUncertain`. The pre-register hook cannot see this window: the helper has already captured the seconds before registration. Do not add a fault-point variant.

Windows does not stage that pathname swap. `FILE_SHARE_PRIVATE_TEMP` is `FILE_SHARE_WRITE` only (`infra/fs.rs:2165`). `windows_post_rename_identity_query_is_performed` records that a live pathname swap cannot be staged while the private temporary is retained (`infra/fs.rs:9011-9016`). Widening that mask so a second opener can stage the race is forbidden: it deletes the property the private temporary exists for (`platform_support.rs:701-707`). `inspect_temp` runs before the write (`infra/fs.rs:787`) and is not a post-rename seam. The Windows seconds witness extends `post_rename_identity_comes_from_the_retained_handle` (`platform_support.rs:701-727`). That test already requires both metadata arms to call `adapter.metadata(&temp)` and rejects `adapter.metadata(&File::open(`. The extension is that `modified_seconds` on the success return is taken from that same `metadata` value, and the success arm does not stat the target pathname for seconds. The Windows failure arm remains the fallback witness.

Create-path negative witness, both create paths: `create_workspace_file` and `create_workspace_directory` each return a `WorkspaceEntry` whose `last_modified` is negative and equal to that object's enumerator seconds. For a file, set the pre-epoch mtime inside the write closure, before the fstat. For a directory, a `cfg(test)` hook runs on the shared create path immediately after `create_dir_at` succeeds and before the observation syscall or handle acquisition begins. The test arms that hook, sets a representable pre-epoch mtime on the new directory, and calls create on that same thread. The returned `last_modified` is negative and equals those listing seconds. The hook is not the post-`statat` swap hook and not the pre-register hook; both of those run after the seconds are already captured. Neither result is `Error::InvalidInput`, a clamped zero, or a `duration_since` rejection. `collect_tree_entries_lists_a_pre_epoch_entry_with_its_negative_timestamp` (`file_workspace.rs:5095`) covers listings only and is not this witness.

File fallback witness, Unix and Windows: inject `AtomicFileFaultPoint::PostRenameMetadata` (the failure branch at `infra/fs.rs:940-949`; the Windows test at `infra/fs.rs:9021` checks outcome and identity only). Set the mtime, including a pre-epoch value, inside the write closure. The returned `modified_seconds` equal that pre-rename reading of the same descriptor, and the outcome stays `CommittedDurabilityUncertain`. This does not prove that rename preserves mtime.

Registration race witness, Unix, both create paths: arm `WORKSPACE_CREATED_CHILD_PRE_REGISTER_HOOK`, which runs inside `register_created_entry` after install and after the directory observation, before the registry write (`file_workspace.rs:257-261`). In the hook, remember the installed object's seconds, rename it aside, and put a different object of the same kind at the same leaf with a different mtime. The returned `last_modified` equals the installed object's seconds, not the replacement's. This catches a pathname stat after that hook. It does not catch two lookups before the hook.

Same-observation witness, Unix, directory only: the hook is the next statement after the observation's `statat` and before identity or seconds are derived. The hook swaps the new directory for another directory with a different mtime. The identity and `last_modified` returned to `create_workspace_directory_inner` both name the pre-swap directory. This proves a lookup after that `statat` cannot change the pair. It does not prove the absence of an earlier lookup hidden in a helper. That check is CR-2, not another source pin. Do not add a Windows hook.

Windows directory witness: `windows_identity_is_read_from_the_retained_handle` follows the body that contains `opened_file_identity`, as above. It stays an identity pin. A `#[cfg(windows)]` test checks that `create_workspace_directory` returns `last_modified` equal to the enumerator's seconds for that directory. `rust-windows-test` is the runtime proof. This machine does not run that test. The proof that the seconds come from that same handle, and that no second name lookup supplies them, is CR-2. There is no Windows swap hook.

Tick-word witness, Windows: a unit test that the create-path conversion of a `u64` tick word equals `filetime_to_unix_seconds` of those bits as `i64`, for a pre-epoch value that fits and for `u64::MAX`, and does not panic. Extend `windows_filetime_ticks_become_unix_seconds` rather than setting an unrepresentable filesystem mtime.

Surface witness: `pnpm rust:surface:check` exits 0, and the shared baseline pin fails if `file_workspace.rs` is put back on the allowlist.

Platform proof, named rather than newly built: `pnpm rust:windows:check` is the local Windows compile. After push, `rust-macos-test` is the runtime proof of the shared `cfg(unix)` path, `rust-windows-test` is the runtime proof of the `cfg(windows)` path, and `rust-platform` is the MSVC compile of that Windows code. The new reads stay on the existing `cfg(unix)` and `cfg(windows)` adapters. This phase adds no `target_os = "linux"` branch, so the FreeBSD source probe is not applicable. If an edit adds one, the adopting session flips `target_os = "linux"` to `target_os = "freebsd"` in the touched files, compiles, and reverts before commit. The phase leaf does not leave that flip in the tree.

## Decisions and trade-offs

### Decided autonomously

* **Question:** which of the three options in the open question supplies create-path mtime?
  * **Chosen:** post-rename `fstat` seconds returned on `AtomicInstalledFile` for files; the existing pre-registration parent observation, extended to return the same seconds, for directories.
  * **Rejected:** a `statat` after registration (fails or observes a replacement after the durable commit). Rejected: moving pathname `timestamp` earlier (keeps the R3 site and the wrong-object window).
  * **Reason:** the file helper already `fstat`s the installed inode before the name can be looked up. The directory helper never held a descriptor; its identity stat is the last observation before registration. Recorded at adoption with `findings.py record-decision`, not by this planner.

* **Question:** whole seconds or `RegularFileMetadata`'s `SystemTime`?
  * **Chosen:** the enumerator's signed Unix seconds.
  * **Rejected:** nanosecond `SystemTime` from `d-20261001-06`.
  * **Reason:** that decision governs the schema-cache probe. `WorkspaceEntry.lastModified` is the field `DirectoryEntry.modified_seconds` already fills. A create response and a later listing of an untouched file report the same integer.

* **Question:** one phase or a split between `infra/fs.rs` and `file_workspace.rs`?
  * **Chosen:** one phase. The new field is unused until the create path consumes it, and the allowlist shrink is false until `timestamp` is gone.
  * **Rejected:** shipping the struct field alone.

## Risks / open questions

None that change the mechanism. Known limit, stated rather than solved: a directory name replaced between `create_dir_at` and the identity observation is attributed as today's `entry_identity_at` attributes it. The returned seconds belong to that same observation, so they cannot name a different object than the registered identity.

## Not part of this task

* `f-20260913-03` (root-path wrappers), `f-20260913-04` (resolve `Conflict` category), `f-20260913-05` (listing error copy), `f-20260913-06` (listing bounds and failed-listing registry churn).
* W24's component source. Registration is unchanged.
* Rollback when directory identity observation fails.
* `src-tauri/src/fs.rs` allowlist count.
* Renderer, bindings, and browser verification.

## Phases

### Phase 1 — Create-path seconds and the allowlist shrink

Files: `src-tauri/src/infra/fs.rs`, `src-tauri/src/file_workspace.rs`, `src-tauri/src/infra/platform_support.rs` (so `windows_identity_is_read_from_the_retained_handle` follows the body that contains `opened_file_identity`, and so the M9 Windows witness extends `post_rename_identity_comes_from_the_retained_handle`), `scripts/check-rust-release-surface.mjs`, `scripts/check-rust-release-surface-core.test.mjs`.

Touches filesystem identity and mtime. No auth, persistence schema, concurrency primitive, or IPC contract change. The `workspace_mutation` lock and registration order stay as they are.

Role: `sensitive` (`src-tauri/src/infra/**`).

PROOF:

```bash
cargo fmt --manifest-path src-tauri/Cargo.toml -- --check
cargo test --manifest-path src-tauri/Cargo.toml --locked --lib infra::fs:: -- --test-threads=8
cargo test --manifest-path src-tauri/Cargo.toml --locked --lib file_workspace:: -- --test-threads=8
cargo test --manifest-path src-tauri/Cargo.toml --locked --lib infra::platform_support:: -- --test-threads=8
pnpm rust:windows:check
pnpm rust:surface:check
pnpm exec vitest run scripts/check-rust-release-surface-core.test.mjs
```

A red proof is a red phase. `pnpm checks:pre-review` is the adopting session's pre-review block, not a substitute for this proof.

## Carried to diff review

* **CR-1.** The baseline pin is one assertion over `src-tauri/src/credentials.rs` and `src-tauri/src/file_workspace.rs`, not a second copy of the `credentials.rs` test body. The obligation is unchanged: putting `file_workspace.rs` back on the allowlist or the counts object fails the pin.
* **CR-2.** Diff review traces the directory observation and every helper it calls. Both returned values come from the same Unix `stat` result or the same retained Windows handle, and those values are what registration stores and what `WorkspaceEntry.last_modified` returns. A second name lookup that supplies either value fails the review. The unix swap hook only proves that a lookup after `statat` cannot change the returned pair. No Windows swap hook, and no further identifier-count pin.

## Decided autonomously

See Decisions and trade-offs. The adopting session records the mtime-source decision. This planner does not write `tasks/decisions.md`.

## Reviews

Round 1 wall time is `plan-meta.json` `review.per_round_seconds`. Twelve plan-capable lenses. `review-code-quality` and `review-root-cause` are `plan-review: false` and were not launched. No quota wait.

Raw verdicts, unchanged:

* chess-semantics APPROVED. `NOT APPLICABLE: The files and mandate concern filesystem modification-time observations; they do not involve an in-memory chess tree, position, or move path.`
* correctness APPROVED. No findings.
* engine-protocol APPROVED. `NOT APPLICABLE: The plan concerns filesystem timestamps and release-surface checks; it does not touch engine processes, UCI state, or asynchronous engine-result routing.`
* error-handling APPROVED. No findings.
* ipc-contract APPROVED. No IPC-contract defects. `lastModified` stays a signed Unix-seconds value.
* minimalism REVISE. One finding, M6.
* persisted-state APPROVED. `NOT APPLICABLE: The plan concerns Rust filesystem modification-time observations and release-surface checks; it has no renderer state, storage keys, or tab lifecycle.`
* pgn-index APPROVED. `NOT APPLICABLE: The plan concerns filesystem metadata for workspace creation; it does not touch PGN scanning, indexing, encoding, or searching.`
* plan REVISE. Two findings, M1 and M2.
* platform-semantics REVISE. Three findings, M5, M1, M4.
* tauri-security APPROVED. No findings.
* tests REVISE. Four findings, M3, M1, M2, M4.

### M1 — Fallback seconds have no witness

* **Claim:** The file witness never injects `PostRenameMetadata`, so the promised fallback seconds can be missing and the proof stays green. The sentence "rename does not change mtime" was not measured.
* **Witnesses:** plan r1 finding 1 (blocker); platform-semantics r1 finding 2 (should-fix); tests r1 finding 2 (should-fix).
* **Evidence:** `infra/fs.rs:902-913` saves `fallback_metadata` before rename. `infra/fs.rs:940-949` returns that identity and ctime on post-rename metadata failure, with `CommittedDurabilityUncertain`. `infra/fs.rs:9021-9047` asserts outcome, identity, and bytes, not seconds. No unix test injects `PostRenameMetadata`.
* **MANDATE:** the open question forbids turning a post-commit metadata failure into an error after the durable commit, and the returned seconds must name the installed inode.
* **Disposition:** Fix. The success path returns the post-rename fstat. The failure path returns the pre-rename fstat of the same descriptor. The plan no longer claims those readings match. Verification adds the fault witness, including a pre-epoch mtime, on Unix and Windows.
* **Authority:** MANDATE open question, third option rejected; fallback is the first option's failure branch already in the traced install.
* **Closure:** round 2.

### M2 — Windows directory seconds are unproved

* **Claim:** The file helper and the Unix race do not exercise the Windows directory observation. A raw FILETIME could pass every stated witness.
* **Witnesses:** plan r1 finding 2 (blocker); tests r1 finding 3 (should-fix).
* **Evidence:** Windows `entry_identity_at` (`infra/fs.rs:3107-3113`) returns only `(u64, u64)` from `opened_file_identity`. `windows_identity_is_read_from_the_retained_handle` (`platform_support.rs:937-951`) checks that call and not the conversion. Enumeration converts with `filetime_to_unix_seconds` (`infra/fs.rs:3049`).
* **MANDATE:** both create paths, on the environments the threat model names, return the installed object's listing seconds.
* **Disposition:** Fix. Directory create uses one observation that returns identity and seconds. A source pin requires `filetime_to_unix_seconds` in that Windows body. A `#[cfg(windows)]` create test compares `last_modified` to the enumerator. `rust-windows-test` runs it.
* **Authority:** MANDATE "both create paths" and the threat-model sentence that Windows counts.
* **Closure:** round 2.

### M3 — The directory race hook is too late to prove one observation

* **Claim:** `WORKSPACE_CREATED_CHILD_PRE_REGISTER_HOOK` runs after `entry_identity_at` has returned. Two lookups before registration can return seconds for a different object while that test passes.
* **Witnesses:** tests r1 finding 1 (blocker).
* **Evidence:** `create_workspace_directory_inner` calls `entry_identity_at` at `file_workspace.rs:966` and then `register_created_entry` at `:967`. The hook is inside registration at `:257-261`.
* **MANDATE:** the seconds and the registered identity name the same installed object. The open question's pathname window is the defect.
* **Disposition:** Fix. Directory create calls one function once and does not also call `entry_identity_at`. A unix hook inside that observation, after the copy and before return, swaps the directory. Identity and seconds must both be the pre-swap object. The pre-register hook stays as the witness that nothing restats after that point. No Windows hook.
* **Authority:** MANDATE defect (a rename returns a different object's mtime) plus the plan's own "one stat" sentence, which the round-1 witness did not enforce.
* **Closure:** round 2.

### M4 — An out-of-range Windows tick word has no defined result

* **Claim:** "Must not panic" does not say what a `u64` tick word outside `i64` becomes, and the pre-epoch witness uses a value that fits.
* **Witnesses:** platform-semantics r1 finding 3 (should-fix); tests r1 finding 4 (should-fix).
* **Evidence:** `filetime_to_unix_seconds` takes `i64` (`infra/fs.rs:2850-2854`). Enumeration stores `header.LastWriteTime` as `i64` (`infra/fs.rs:2938`). The handle metadata path reads `last_write_time()` as `u64` (`infra/fs.rs:3761`). `windows_filetime_ticks_become_unix_seconds` pins `filetime_to_unix_seconds(-1)` (`infra/fs.rs:8659`).
* **MANDATE:** create and a later listing of an untouched file report the same integer. The enumerator already interprets the tick bits as `i64`.
* **Disposition:** Fix. The create path passes those bits to `filetime_to_unix_seconds` as `i64`, including the high bit. It does not saturate or error. The witness covers a fitting pre-epoch value and `u64::MAX`.
* **Authority:** the decided contract that create seconds equal the enumerator's seconds. A saturating converter would be a second conversion.
* **Closure:** round 2.

### M5 — Platform proof jobs were unnamed

* **Claim:** Host tests and the surface gate do not prove Windows or macOS, and the plan omitted `pnpm rust:windows:check` and the FreeBSD probe.
* **Witnesses:** platform-semantics r1 finding 1 (should-fix).
* **Evidence:** Push skill names `pnpm rust:windows:check` at `.claude/skills/push/SKILL.md:108` as the local compile, and `rust-windows-test`, `rust-macos-test`, and `rust-platform` at `:376` as the jobs this machine cannot run. The new reads sit on the existing `cfg(unix)` fstat (`infra/fs.rs:1759-1767`) and `cfg(windows)` metadata (`infra/fs.rs:3758-3766`). `AtomicInstalledFile` and `TempMetadata` literals are in shared or cfg-split adapters already compiled on Linux (`infra/fs.rs:944`, `:957`, `:969`, `:1763`, `:3763`, `:4936`). This change adds no `target_os = "linux"` branch.
* **Disposition:** Fix. PROOF includes `pnpm rust:windows:check`. The plan names the three CI jobs. The FreeBSD probe is not applicable unless an edit adds a `target_os = "linux"` branch; the plan forbids that branch. No new probe harness.
* **Authority:** the lens's platform-proof rule, which is the verification level for the threat model's Unix and Windows environments. Not a new CI mechanism.
* **Closure:** round 2.

### M6 — Baseline pin would duplicate the credentials test

* **Claim:** A second "left the baseline" test copies the `credentials.rs` assertions.
* **Witnesses:** minimalism r1 finding 1 (should-fix).
* **Evidence:** `scripts/check-rust-release-surface-core.test.mjs:395-398` is one test with two expects. The obligation is that `file_workspace.rs` stays off the allowlist and the counts object.
* **Disposition:** Fix, carried to CR-1. One assertion covers both paths. The obligation's contract is unchanged.
* **Closure:** carried, CR-1. Not a plan-level adoption.

Opened 6, resolved this round 1 (M6 carried), open for closure 5 (M1–M5). Adopted this round: 5. Carried: 1. No Skip, Defer, or withdrawal. No correction-introduced issue yet. Round 2 reviews plan, platform-semantics, and tests.

### Round 2

Raw verdicts, unchanged:

* plan REVISE. Closed M1, M2, M3, M4, M5. One new finding, M7.
* platform-semantics REVISE. Closed M1, M3, M4, M5. M2 NOT CLOSED.
* tests REVISE. Closed M1, M2, M4, M5. M3 NOT CLOSED. One new finding, M8.

M1, M4, and M5 are closed by every lens that witnessed them. Their round-1 closure lines stand. M2 and M3 stay open: a lens that did not close them overrides a lens that did. M6 stays carried as CR-1 and was not re-reviewed.

### M2 — Windows directory seconds are unproved (round 2 residual)

* **Claim:** The cited pin at `platform_support.rs:948` checks only `opened_file_identity`. A normal Windows create cannot catch a second time lookup after the identity observation.
* **Witnesses:** platform-semantics r2 finding 1 (should-fix). Lineage: M2. Prior witnesses remain plan r1 finding 2 and tests r1 finding 3.
* **Evidence:** `windows_identity_is_read_from_the_retained_handle` (`platform_support.rs:937-951`) asserts `opened_file_identity` and nothing else. Windows `entry_identity_at` (`infra/fs.rs:3107-3113`) is one `open_expected_child` plus `opened_file_identity`, and it returns no seconds. Confirmed by reading both bodies. This is the first failure of this lineage.
* **MANDATE:** both create paths return the installed object's listing seconds from the same observation as the registered identity.
* **Disposition:** Fix. The seconds pin is a new assertion, not the existing identity loop. The observation body contains `opened_file_identity`, `filetime_to_unix_seconds`, and exactly one `open_expected_child`. The identity loop's `entry_identity_at` signature moves onto that body. `create_workspace_directory_inner` calls the observation once and does not call `entry_identity_at`. No Windows swap hook.
* **Authority:** the same MANDATE obligation as round 1. The correction changes the verification contract of that obligation. It adds no rollback and no second production lookup.
* **Closure:** open. Round 3 checks it. Round 2 cannot close it.

### M3 — The directory race hook is too late to prove one observation (round 2 residual)

* **Claim:** A hook that runs after identity and seconds are copied never injects a swap between two earlier lookups, so both assertions can pass.
* **Witnesses:** tests r2 finding 1 (blocker). Lineage: M3. Prior witness remains tests r1 finding 1.
* **Evidence:** The round-1 correction put the hook after the copy. Unix `entry_identity_at` (`infra/fs.rs:4416`) is one `rfs::statat` followed by `raw_stat_identity`. Confirmed by reading that body. This is the first failure of this lineage.
* **MANDATE:** the seconds and the registered identity name the same installed object.
* **Disposition:** Fix. The hook is the next statement after the observation's single `statat` and before either value is derived. The returned pair is built only from that `stat`. A source pin counts `statat` in that braced body and fails unless the count is one. The pre-register hook stays. No Windows hook.
* **Authority:** the same MANDATE defect as round 1. The failed placement did not enforce one syscall.
* **Closure:** open. Round 3 checks it. Round 2 cannot close it.

### M7 — Deleting `timestamp` leaves the listing-shape test calling it

* **Claim:** Cleanup names only `timestamps_and_durability_outcomes_remain_renderer_safe`. `collect_tree_entries_lists_the_workspace_shape_on_every_platform` also calls `timestamp`, so `cargo test --lib file_workspace` does not compile.
* **Witnesses:** plan r2 finding 1 (blocker).
* **Evidence:** `file_workspace.rs:3327` and `:3348` compare listed `last_modified` to `timestamp(...)`. Confirmed by reading the test. The durability call at `:3192` was already named.
* **MANDATE:** `timestamp` is deleted, and the phase proof includes `cargo test --lib file_workspace`. The listing comparisons are the coverage that deletion must keep.
* **Disposition:** Fix. Both listing assertions stay and compare `last_modified` to the enumerator's whole seconds. They do not call `timestamp` and do not use `duration_since`. A test-only read is not a production pathname reach.
* **Authority:** the plan's own delete-`timestamp` obligation plus a red phase proof. Not a listing-bounds change (`f-20260913-06` stays out).
* **Closure:** open. Round 3 checks it.

### M8 — Pre-epoch coverage stops at the helper

* **Claim:** The pre-epoch assertion is on `atomic_replace_at_identified`. A caller that clamps or rejects a negative `WorkspaceEntry.last_modified` still passes.
* **Witnesses:** tests r2 finding 2 (blocker).
* **Evidence:** The file success witness stops at `modified_seconds`. `create_workspace_directory_inner` assigns `last_modified` at `file_workspace.rs:1000` from `timestamp`, which rejects pre-1970. `collect_tree_entries_lists_a_pre_epoch_entry_with_its_negative_timestamp` (`file_workspace.rs:5095`) lists an existing file and does not call either create path. Confirmed by reading that test's opening.
* **MANDATE:** a pre-1970 time is a negative `i64` on the value the create response returns, not `Error::InvalidInput`.
* **Disposition:** Fix. Both `create_workspace_file` and `create_workspace_directory` return a negative `last_modified` equal to the enumerator's seconds. The helper witness stays and does not replace this one.
* **Authority:** the decided contract that create seconds equal the enumerator's seconds, including a negative value. Not a new numeric formula.
* **Closure:** open. Round 3 checks it.

Opened this round: M7, M8. Re-opened: M2, M3 (first failure each). Closed this round: M1, M4, M5. Adopted this round: 4 (M2, M3, M7, M8). Carried unchanged: M6. No Skip, Defer, or withdrawal. Round 3 reviews plan, platform-semantics, and tests.

### Round 3

Raw verdicts, unchanged:

* plan APPROVED. Closed M2, M3, M7, M8. No bracketed findings.
* platform-semantics REVISE. Closed M2, M3, M7. M8 NOT CLOSED.
* tests REVISE. Closed M7, M8. M2 NOT CLOSED. M3 NOT CLOSED.

M7 is closed by plan, platform-semantics, and tests. M2 and M3 failed closure a second time (tests). Patching the source-count pin stops. A fresh-context review-plan judgment (`probe-1-r3`) recorded the mechanism below. M8 failed closure once (platform) and is corrected, not carried.

Judgment, `probe-1-r3`: the one-observation obligation stays. Identifier counts do not prove it, because a helper hides a second lookup. Diff review traces the observation and its helpers and rejects a second name lookup that supplies either value. That check is CR-2. The unix hook stays and its limit is stated. The directory pre-epoch witness needs a `cfg(test)` hook after `create_dir_at` succeeds and before the observation begins. No Windows swap hook and no rollback.

### M2 — Windows directory seconds are unproved (second failure)

* **Claim:** A pin of `opened_file_identity`, `filetime_to_unix_seconds`, and one direct `open_expected_child` still allows a helper to read seconds from a second handle.
* **Witnesses:** tests r3 finding 1 (blocker). Lineage: M2.
* **Evidence:** The round-3 plan text required that count. Windows `entry_identity_at` (`infra/fs.rs:3107-3113`) is one open today. The tests claim is about a future helper, and no count of a direct call excludes one. Confirmed by reading the observation body and the round-3 wording.
* **MANDATE:** identity and seconds come from one observation.
* **Disposition:** Fix, carried to CR-2. The count pin is withdrawn. The obligation is unchanged. Diff review traces helpers.
* **Authority:** second closure failure, then `probe-1-r3`. Not a new production mechanism.
* **Closure:** carried, CR-2. Not a plan-level adoption.

### M3 — The directory race hook is too late to prove one observation (second failure)

* **Claim:** A count of direct `statat` calls misses a helper that looks up before the pinned call, so the hook swaps too late.
* **Witnesses:** tests r3 finding 2 (blocker). Lineage: M3.
* **Evidence:** Unix `entry_identity_at` (`infra/fs.rs:4416`) is one `statat` today. The same helper-hiding limit as M2. This is the second failure of this lineage.
* **MANDATE:** identity and seconds come from one observation.
* **Disposition:** Fix, carried to CR-2. The `statat` count pin is withdrawn. The hook stays immediately after `statat` and is documented as proof only about lookups after that point.
* **Authority:** second closure failure, then `probe-1-r3`.
* **Closure:** carried, CR-2. Not a plan-level adoption.

### M8 — Pre-epoch coverage stops at the helper (round 3 residual)

* **Claim:** The directory witness sets mtime after `create_dir_at` and before the observation returns, but the planned hooks run after the seconds are captured. The witness cannot execute.
* **Witnesses:** platform-semantics r3 finding 1 (should-fix). Prior witness remains tests r2 finding 2.
* **Evidence:** `create_workspace_directory_inner` calls `create_dir_at` then `entry_identity_at` at `file_workspace.rs:965-966`. The pre-register hook is inside registration (`:257-261`), after that observation. A hook after `statat` reads `st_mtime` that is already captured. Confirmed by reading those lines. First failure of this lineage.
* **MANDATE:** a pre-1970 directory create returns a negative `last_modified`.
* **Disposition:** Fix. A `cfg(test)` hook on the shared create path runs after `create_dir_at` succeeds and before the observation syscall or handle acquisition. The test sets a representable pre-epoch mtime there. The file path still sets mtime inside the write closure.
* **Authority:** the same negative-seconds contract. The previous witness named an interval no existing hook can use. Not a Windows swap hook.
* **Closure:** open. Round 4 checks it.

Closed this round: M7. Carried this round: M2, M3 (CR-2), after the second failure and `probe-1-r3`. Adopted this round: 1 (M8). M6 stays CR-1. No Skip, Defer, or withdrawal. Round 4 reviews plan, platform-semantics, and tests. Open: M8.

### Round 4

Raw verdicts, unchanged:

* plan APPROVED. Closed M8. No bracketed findings.
* platform-semantics APPROVED. Closed M8. No bracketed findings.
* tests REVISE. Closed M8. One new finding, M9.

M8 is closed by plan, platform-semantics, and tests. The directory hook is the witness platform asked for.

### M9 — The file success witness misses a pathname stat after rename

* **Claim:** An ordinary create compares mtime with no swap, so a pathname lookup after rename still passes. The pre-register hook runs after the helper has captured seconds. The fallback witness covers only the failure arm.
* **Witnesses:** tests r4 finding 1 (blocker).
* **Evidence:** `PostRenameMetadata` is injected after `rename` and before `adapter.metadata(&temp)` (`infra/fs.rs:933-934`). `inject_atomic_file` continues when `inject` returns `Ok` (`infra/fs.rs:452-454`). The failure arm at `:940-949` does not run on `Ok`. Registration starts only after the helper returns, so `WORKSPACE_CREATED_CHILD_PRE_REGISTER_HOOK` is later. Confirmed by reading those lines.
* **MANDATE:** a rename in the window between install and the metadata read must not supply another object's seconds. The file success path is that window.
* **Disposition:** Fix. The same inject point swaps the installed name and returns `Ok`. The returned seconds are the pre-swap inode's. No new fault-point variant. The failure arm stays the fallback witness.
* **Authority:** MANDATE defect, file path. The existing injector is the interval. Not a new production lookup.
* **Closure:** open. Round 5 checks it.

Closed this round: M8. Opened this round: M9. Adopted this round: 1 (M9). Carried unchanged: M6, M2, M3. No Skip, Defer, or withdrawal. Round 5 reviews plan, platform-semantics, and tests.

### Round 5

Raw verdicts, unchanged:

* plan APPROVED. Closed M9. No bracketed findings. It noted Windows sharing and named `inspect_temp` as a route.
* platform-semantics REVISE. M9 NOT CLOSED, twice, same defect.
* tests APPROVED. Closed M9. No bracketed findings. It also named a handle-based Windows swap.

M9 stays open. Platform's reading matches the source: a pathname swap cannot be staged on Windows. `inspect_temp` is before the write, so that route is rejected.

### M9 — The file success witness misses a pathname stat after rename (round 5 residual)

* **Claim:** The Windows swap does not say how to replace the installed name while the private temp handle stays open. The existing Windows test says a live pathname swap cannot be staged.
* **Witnesses:** platform-semantics r5 finding 1 (should-fix); platform-semantics r5 finding 2 (should-fix). Prior witness remains tests r4 finding 1.
* **Evidence:** `FILE_SHARE_PRIVATE_TEMP` is `FILE_SHARE_WRITE` (`infra/fs.rs:2165`). The test comment at `infra/fs.rs:9011-9016` says the sharing mask rejects a second opener. `post_rename_identity_comes_from_the_retained_handle` (`platform_support.rs:701-727`) pins `adapter.metadata(&temp)` for that reason and records a measured sharing violation (os error 32). `inspect_temp` is at `infra/fs.rs:787`, before the write. Confirmed by reading those sites. First failure of this lineage.
* **MANDATE:** the file success path must not take seconds from a replaced pathname. On Windows that race cannot be staged in-process without widening the share mask.
* **Disposition:** Fix. Unix keeps the runtime swap at `PostRenameMetadata`. Windows extends the existing retained-handle source pin so `modified_seconds` comes from that `metadata` value, and does not pathname-swap. The failure arm is unchanged. The share mask stays.
* **Authority:** the measured Windows limit already recorded for this window (`f-20260916-12` in that pin's comment). Not a new share mode and not `inspect_temp`.
* **Closure:** open. Round 6 checks it.

Adopted this round: 1 (M9 Windows witness). Open: M9. Carried unchanged: M2, M3, M6. No Skip, Defer, or withdrawal. Round 6 reviews plan, platform-semantics, and tests.

### plan-r7.md

# Plan: Workspace create mtime without a pathname reach

## Goal

`create_workspace_file` and `create_workspace_directory` return `WorkspaceEntry.lastModified` as the signed Unix seconds of the object this call installed, taken from the observation that already identified that object. They do not look the new name up again by pathname, and a failure of that observation is not introduced after the entry is registered.

## MANDATE

### Workspace create paths read the new entry's modification time back by pathname

* **ID:** f-20260913-02 · **Status:** open · **Area:** native-fs · **Root:** - · **Entry:** build · **Blocked:** none
* **Where:** `src-tauri/src/file_workspace.rs` — `timestamp` (`:154-159`, `fs::metadata(path)`), called by `create_workspace_file_blocking` (`:683`) and `create_workspace_directory_inner` (`:781`) after the entry was installed through a retained parent descriptor and registered.
* **Defect:** both create paths install the new entry descriptor-relative (`atomic_replace_at_identified`, `create_dir_at`) and register it with the installed identity, then compute `last_modified` by reopening `parent_target.path().join(name)` by pathname. A rename in that window returns the modification time of a different object, and the reach is one of `file_workspace.rs`'s counted R3 sites in `INITIAL_FS_SURFACE_COUNTS`.
* **Open question:** where does the create path take the mtime without a pathname reach and without turning a post-commit race into an error after the entry and its sidecar are already durable and registered — `fstat` of a descriptor retained from the install (the atomic-replace helpers do not return one today), an identity-checked `statat` through the retained parent (which can fail after the durable commit), or reordering the stat before registration?
* **Why it matters:** it is the last production filesystem reach in `file_workspace.rs` once `f-20260905-05` lands; closing it removes the file from the allowlist.
* **Related:** `f-20260905-05` (its plan review split this out as outside that mandate — `timestamp` is metadata, not directory enumeration).
* **Found by:** Claude Code, plan review of `tasks/plans/2026-09-13-workspace-directory-enumeration.md` (`review-minimalism`, `review-root-cause`, `review-tauri-security`), 2026-09-13.

* **Inherited review history (2026-09-13):** load `tasks/handoffs/2026-09-13-workspace-directory-enumeration-review.md` before this finding's plan review. It carries the `f-20260905-05` plan-review record; this finding inherits issue IDs W6, W17 and W24 from it, with their witnesses, dispositions and evidence.

Line numbers in the mandate are the filing's. Locate re-found the same functions at `timestamp` `file_workspace.rs:184-190`, the file call at `:901`, and the directory call at `:1000`.

## Threat model and non-goals

The parent directory is a workspace the user already granted. Another process, or another call that holds no `workspace_mutation` lock, can rename or replace the new leaf after this call's install. That is the adversary the defect names. It is not a cross-user privilege boundary and not a symlink escape of the parent: the parent descriptor is the one the mutation target already holds.

The observation that supplies `lastModified` must name the installed inode, not whatever path string is current at a later lookup. A lookup that fails after `register_created_entry` has returned must not become the command's error: the entry and, for a file, its sidecar are already durable and registered, and today's `timestamp()?` is exactly that post-registration failure (`file_workspace.rs:885-901` and `:967-1000`).

Environments that count are the ones `infra/fs.rs` already splits: Unix (Linux and macOS share the `cfg(unix)` stat path) and Windows.

Non-goals, frozen with this model: directory-identity failure rollback, listing bounds, resolve error categories, root-path wrapper deduplication, renderer copy, and full-precision schema-cache mtimes.

## Traced premises

* `timestamp` is `fs::metadata(path)?.modified()?` and rejects a pre-1970 time with `Error::InvalidInput` (`file_workspace.rs:184-190`). `listed_mtime` documents the opposite renderer contract: `lastModified` is a plain `i64` of Unix seconds, and a negative value is a real date (`file_workspace.rs:172-181`). The enumerator stores `stat.st_mtime` with no nanoseconds (`infra/fs.rs:163-168`). Windows enumeration converts `LastWriteTime` only through `filetime_to_unix_seconds` (`infra/fs.rs:2846-2854`).
* File install already `fstat`s the still-open temporary descriptor after `renameat` and before any pathname lookup, and returns that identity on `AtomicInstalledFile` without returning the descriptor (`infra/fs.rs:4903-4905`, `1759-1767`, `363-367`). The pre-rename `fstat` is `fallback_metadata` (`infra/fs.rs:902-913`). A failed post-rename metadata read returns `CommittedDurabilityUncertain` with that fallback's identity and ctime (`infra/fs.rs:940-949`). The success path returns the post-rename `fstat`. This plan does not claim those two clock readings are equal. The caller uses the reading the helper actually returned.
* Directory install does not keep a descriptor: Unix `mkdirat` plus `sync_all` (`infra/fs.rs:4436-4443`); Windows opens a handle and drops it (`infra/fs.rs:3090-3104`). The next observation is `entry_identity_at` on the retained parent, before registration (`file_workspace.rs:965-975`). Its Unix body is one `statat(AT_SYMLINK_NOFOLLOW)` (`infra/fs.rs:4409-4424`). Its Windows body opens a handle and reads `opened_file_identity`; `platform_support.rs` test `windows_identity_is_read_from_the_retained_handle` (`:937-951`) requires that call to appear in the `entry_identity_at` body itself.
* `entry_identity_at`'s return type is `(u64, u64)`. Callers outside create include `db/mod.rs`, `db/search_index.rs`, and `path_authority`. Changing that return type is not required.
* Production R3 count for `src-tauri/src/file_workspace.rs` is 1 (`scripts/check-rust-release-surface.mjs:32-34`). An allowlist entry with zero production matches must be removed (`check-rust-release-surface.mjs:501-503`). `d-20260901-03` makes the allowlist shrink-only. `#[cfg(test)]` metadata in `file_workspace.rs` is not a production match.
* `d-20261001-06` requires full-precision `SystemTime` mtime for `probe_regular_file_at` / the schema cache. `WorkspaceEntry.lastModified` is the enumerator's whole seconds, not that probe.
* Inherited W6 is this defect, split out of the enumeration mandate. W17 (create-path guard untested) was moot only because W6 was out of that mandate; the race witness below is that test. W24 (where create-path components come from) stays out of scope: registration still calls `workspace_components` inside `register_created_entry` (`file_workspace.rs:247-256`).

## Approach

### Installed-file seconds come from the post-rename fstat

The file create path answers the open question with the first option. The atomic-replace helper already holds the descriptor and already `fstat`s it after the rename. It does not start returning that descriptor.

`TempMetadata` and `AtomicInstalledFile` gain `modified_seconds: i64`, filled from the same metadata read that fills `identity` and `ctime_nanos`, on both the post-rename read and the pre-rename fallback. Unix uses the same `stat.st_mtime` expression as `DirectoryEntry.modified_seconds`. Windows takes that handle's `LastWriteTime` tick word and interprets those bits as `i64`, which is how enumeration already stores `FILE_ID_BOTH_DIR_INFORMATION.LastWriteTime` (`infra/fs.rs:2938`) before `filetime_to_unix_seconds` (`infra/fs.rs:3049`). `std` reports the same word as `u64` (`infra/fs.rs:3761`). The conversion is `filetime_to_unix_seconds` of that `i64` bit pattern, including a high bit that becomes negative. It does not panic, saturate, or return an error. A value whose bits already fit the enumerator's `i64` uses `filetime_to_unix_seconds` unchanged. `windows_filetime_ticks_become_unix_seconds` already pins `filetime_to_unix_seconds(-1)` (`infra/fs.rs:8657-8659`); the create path's `u64` word `u64::MAX` is those same bits.

`create_workspace_file_blocking` sets `last_modified` from `installed.modified_seconds`. It does not call `timestamp`, `fs::metadata`, or `Path::metadata`. A post-rename metadata failure stays the helper's existing `CommittedDurabilityUncertain` outcome and still carries the fallback seconds of that same inode. The caller keeps today's behavior of returning that durability error after registration (`file_workspace.rs:903-905`) and does not add a new error for the seconds.

Rejected for the file path: an identity-checked `statat` of the installed name. It can fail, or observe a replacement, after the PGN and sidecar are durable. Rejected: moving today's pathname `timestamp` to before registration. It is still the R3 reach, and a replacement in that window is still the wrong object.

### Directory seconds come from the pre-registration identity observation

`create_dir_at` does not retain a descriptor, so the file-path `fstat` is not available. The directory create path uses one observation through the retained parent, the same observation as `entry_identity_at`, and it happens before `register_created_entry`.

Directory create calls one observation function once and uses both values from that single return. It does not also call `entry_identity_at`. `entry_identity_at` keeps the `(u64, u64)` return and its current errors. It calls the observation and discards the seconds, so its other callers stay unchanged. The observation is the function that performs the lookup. It is not a wrapper around two lookups.

On Unix the observation keeps today's `entry_identity_at` shape (`infra/fs.rs:4416`): one `rfs::statat`. Identity is `unix::raw_stat_identity` of that `stat`. The seconds are that same `stat.st_mtime`. A `cfg(all(test, unix))` hook runs immediately after that `statat` returns and before either value is derived. The returned pair is built only from that `stat`. The hook proves that a lookup after that `statat` cannot change the pair. It does not prove there was no earlier lookup. No source pin that counts the identifier `statat` is added. A count of direct calls misses a helper, which is why round 3's count pin is withdrawn.

On Windows the observation opens the child with `open_expected_child` (today that open is `win::entry_identity_at`, `infra/fs.rs:3107-3113`) and reads identity with `opened_file_identity` on that handle. The seconds are `filetime_to_unix_seconds` of that same handle's `LastWriteTime` bits interpreted as `i64`, the conversion enumeration already uses (`infra/fs.rs:3049`). Because the open moves out of `entry_identity_at` into the observation, `windows_identity_is_read_from_the_retained_handle` moves its `entry_identity_at` signature onto the observation body. The other four signatures in that test stay on `assert_entry_identity`, `open_verified_parent`, `remove_regular_child`, and `remove_windows_tree_at`. That move keeps the existing identity pin on the body that opens the handle. It does not prove where the seconds come from. `create_workspace_directory_inner` calls the observation once and does not call `entry_identity_at`.

No identifier-count pin is the proof of one observation. CR-2 is that proof, and it is carried to diff review. Do not add a Windows swap hook.

`create_workspace_directory_inner` stores those seconds and does not stat after registration. A failure of the observation stays where `entry_identity_at` fails today: the directory exists, nothing is registered, and this plan adds no rollback. That leak is pre-existing and outside the mandate.

The name can still be replaced between `create_dir_at` and this observation. That window is the one `entry_identity_at` already has. This plan does not widen it and does not add a later pathname lookup after registration, which is the lookup the mandate removes.

### One renderer value, then delete the pathname helper

Both create paths assign that `i64` to `WorkspaceEntry.lastModified`. Subseconds are discarded the way the enumerator discards them. A pre-1970 time is a negative `i64`, not `Error::InvalidInput`. `timestamp` is deleted. No production pathname filesystem reach remains in `file_workspace.rs`.

Remove `src-tauri/src/file_workspace.rs` from `INITIAL_FS_SURFACE_ALLOWLIST` and from `INITIAL_FS_SURFACE_COUNTS`. Do not change `src-tauri/src/fs.rs`'s count. Extend the existing `credentials.rs` baseline pin (`scripts/check-rust-release-surface-core.test.mjs:395-398`) so one assertion covers both paths. Do not add a second test with the same body.

`timestamps_and_durability_outcomes_remain_renderer_safe` calls `timestamp` (`file_workspace.rs:3192`). Keep its durability assertions. Delete the pathname `timestamp` assertion rather than reintroducing the helper for the test.

`collect_tree_entries_lists_the_workspace_shape_on_every_platform` also calls `timestamp`, at `file_workspace.rs:3327` and `:3348`. Both assertions compare a listed `last_modified` with that helper. After `timestamp` is deleted, both comparisons stay: each listed `last_modified` equals the enumerator's whole seconds for that object (Unix `st_mtime`, Windows `filetime_to_unix_seconds` of the `LastWriteTime` bits). Do not delete the comparisons. A `#[cfg(test)]` read does not count as a production pathname reach and is not copied into production code. Do not use `duration_since`. `cargo test --lib file_workspace` does not compile while either call remains.

No Specta type changes. `lastModified` stays `i64`. No frontend change.

### Verification

Level: unit tests plus the release-surface checker. No browser and no dev server. The value is not a new visible control; it is the seconds the create response already returns.

File success witness, in `infra/fs` tests: `atomic_replace_at_identified` on a new leaf returns `modified_seconds` equal to that inode's enumerator's seconds. Set the written file's mtime before the epoch inside the write closure and assert the returned seconds are negative and equal to that `st_mtime` (Unix) or `filetime_to_unix_seconds` of the same tick bits (Windows). This is the witness that `duration_since` is gone on the helper. It is not the witness for `WorkspaceEntry.last_modified`. An ordinary create with no swap does not prove the read was the open descriptor: a pathname stat of an unreplaced name returns the same seconds.

File post-rename swap witness, Unix: `inject_atomic_file(AtomicFileFaultPoint::PostRenameMetadata)` already runs after `rename` and before `adapter.metadata(&temp)` (`infra/fs.rs:933-934`). The injector's `inject` returns `Ok(())` to continue (`infra/fs.rs:452-454`). This witness's injector, on that point, swaps the installed name for another file with a different mtime and returns `Ok`, so metadata still runs. The returned `modified_seconds` are the pre-swap inode's enumerator seconds, not the replacement's. A pathname lookup of the installed name would return the replacement. This is not the failure arm, which still returns the pre-rename fallback and `CommittedDurabilityUncertain`. The pre-register hook cannot see this window: the helper has already captured the seconds before registration. Do not add a fault-point variant.

Windows does not stage that pathname swap. `FILE_SHARE_PRIVATE_TEMP` is `FILE_SHARE_WRITE` only (`infra/fs.rs:2165`). `windows_post_rename_identity_query_is_performed` records that a live pathname swap cannot be staged while the private temporary is retained (`infra/fs.rs:9011-9016`). Widening that mask so a second opener can stage the race is forbidden: it deletes the property the private temporary exists for (`platform_support.rs:701-707`). `inspect_temp` runs before the write (`infra/fs.rs:787`) and is not a post-rename seam. The Windows seconds witness extends `post_rename_identity_comes_from_the_retained_handle` (`platform_support.rs:701-727`). That test already requires both metadata arms to call `adapter.metadata(&temp)` and rejects `adapter.metadata(&File::open(`. The extension is that `modified_seconds` on the success return is taken from that same `metadata` value, and the success arm does not stat the target pathname for seconds. The Windows failure arm remains the fallback witness.

Create-path negative witness, both create paths: `create_workspace_file` and `create_workspace_directory` each return a `WorkspaceEntry` whose `last_modified` is negative and equal to that object's enumerator seconds. For a file, set the pre-epoch mtime inside the write closure, before the fstat. For a directory, a `cfg(test)` hook runs on the shared create path immediately after `create_dir_at` succeeds and before the observation syscall or handle acquisition begins. The test arms that hook, sets a representable pre-epoch mtime on the new directory, and calls create on that same thread. The returned `last_modified` is negative and equals those listing seconds. The hook is not the post-`statat` swap hook and not the pre-register hook; both of those run after the seconds are already captured. Neither result is `Error::InvalidInput`, a clamped zero, or a `duration_since` rejection. `collect_tree_entries_lists_a_pre_epoch_entry_with_its_negative_timestamp` (`file_workspace.rs:5095`) covers listings only and is not this witness.

File fallback witness, Unix and Windows: inject `AtomicFileFaultPoint::PostRenameMetadata` (the failure branch at `infra/fs.rs:940-949`; the Windows test at `infra/fs.rs:9021` checks outcome and identity only). Set the mtime, including a pre-epoch value, inside the write closure. The returned `modified_seconds` equal that pre-rename reading of the same descriptor, and the outcome stays `CommittedDurabilityUncertain`. This does not prove that rename preserves mtime.

Registration race witness, Unix, both create paths: arm `WORKSPACE_CREATED_CHILD_PRE_REGISTER_HOOK`, which runs inside `register_created_entry` after install and after the directory observation, before the registry write (`file_workspace.rs:257-261`). In the hook, remember the installed object's seconds, rename it aside, and put a different object of the same kind at the same leaf with a different mtime. The returned `last_modified` equals the installed object's seconds, not the replacement's. This catches a pathname stat after that hook. It does not catch two lookups before the hook.

Same-observation witness, Unix, directory only: the hook is the next statement after the observation's `statat` and before identity or seconds are derived. The hook swaps the new directory for another directory with a different mtime. The identity and `last_modified` returned to `create_workspace_directory_inner` both name the pre-swap directory. This proves a lookup after that `statat` cannot change the pair. It does not prove the absence of an earlier lookup hidden in a helper. That check is CR-2, not another source pin. Do not add a Windows hook.

Windows directory witness: `windows_identity_is_read_from_the_retained_handle` follows the body that contains `opened_file_identity`, as above. It stays an identity pin. A `#[cfg(windows)]` test checks that `create_workspace_directory` returns `last_modified` equal to the enumerator's seconds for that directory. `rust-windows-test` is the runtime proof. This machine does not run that test. The proof that the seconds come from that same handle, and that no second name lookup supplies them, is CR-2. There is no Windows swap hook.

Tick-word witness, Windows: a unit test that the create-path conversion of a `u64` tick word equals `filetime_to_unix_seconds` of those bits as `i64`, for a pre-epoch value that fits and for `u64::MAX`, and does not panic. Extend `windows_filetime_ticks_become_unix_seconds` rather than setting an unrepresentable filesystem mtime.

Surface witness: `pnpm rust:surface:check` exits 0, and the shared baseline pin fails if `file_workspace.rs` is put back on the allowlist.

Platform proof, named rather than newly built: `pnpm rust:windows:check` is the local Windows compile. After push, `rust-macos-test` is the runtime proof of the shared `cfg(unix)` path, `rust-windows-test` is the runtime proof of the `cfg(windows)` path, and `rust-platform` is the MSVC compile of that Windows code. The new reads stay on the existing `cfg(unix)` and `cfg(windows)` adapters. This phase adds no `target_os = "linux"` branch, so the FreeBSD source probe is not applicable. If an edit adds one, the adopting session flips `target_os = "linux"` to `target_os = "freebsd"` in the touched files, compiles, and reverts before commit. The phase leaf does not leave that flip in the tree.

## Decisions and trade-offs

### Decided autonomously

* **Question:** which of the three options in the open question supplies create-path mtime?
  * **Chosen:** post-rename `fstat` seconds returned on `AtomicInstalledFile` for files; the existing pre-registration parent observation, extended to return the same seconds, for directories.
  * **Rejected:** a `statat` after registration (fails or observes a replacement after the durable commit). Rejected: moving pathname `timestamp` earlier (keeps the R3 site and the wrong-object window).
  * **Reason:** the file helper already `fstat`s the installed inode before the name can be looked up. The directory helper never held a descriptor; its identity stat is the last observation before registration. Recorded at adoption with `findings.py record-decision`, not by this planner.

* **Question:** whole seconds or `RegularFileMetadata`'s `SystemTime`?
  * **Chosen:** the enumerator's signed Unix seconds.
  * **Rejected:** nanosecond `SystemTime` from `d-20261001-06`.
  * **Reason:** that decision governs the schema-cache probe. `WorkspaceEntry.lastModified` is the field `DirectoryEntry.modified_seconds` already fills. A create response and a later listing of an untouched file report the same integer.

* **Question:** one phase or a split between `infra/fs.rs` and `file_workspace.rs`?
  * **Chosen:** one phase. The new field is unused until the create path consumes it, and the allowlist shrink is false until `timestamp` is gone.
  * **Rejected:** shipping the struct field alone.

## Risks / open questions

None that change the mechanism. Known limit, stated rather than solved: a directory name replaced between `create_dir_at` and the identity observation is attributed as today's `entry_identity_at` attributes it. The returned seconds belong to that same observation, so they cannot name a different object than the registered identity.

## Not part of this task

* `f-20260913-03` (root-path wrappers), `f-20260913-04` (resolve `Conflict` category), `f-20260913-05` (listing error copy), `f-20260913-06` (listing bounds and failed-listing registry churn).
* W24's component source. Registration is unchanged.
* Rollback when directory identity observation fails.
* `src-tauri/src/fs.rs` allowlist count.
* Renderer, bindings, and browser verification.

## Phases

### Phase 1 — Create-path seconds and the allowlist shrink

Files: `src-tauri/src/infra/fs.rs`, `src-tauri/src/file_workspace.rs`, `src-tauri/src/infra/platform_support.rs` (so `windows_identity_is_read_from_the_retained_handle` follows the body that contains `opened_file_identity`, and so the M9 Windows witness extends `post_rename_identity_comes_from_the_retained_handle`), `scripts/check-rust-release-surface.mjs`, `scripts/check-rust-release-surface-core.test.mjs`.

Touches filesystem identity and mtime. No auth, persistence schema, concurrency primitive, or IPC contract change. The `workspace_mutation` lock and registration order stay as they are.

Role: `sensitive` (`src-tauri/src/infra/**`).

PROOF:

```bash
cargo fmt --manifest-path src-tauri/Cargo.toml -- --check
cargo test --manifest-path src-tauri/Cargo.toml --locked --lib infra::fs:: -- --test-threads=8
cargo test --manifest-path src-tauri/Cargo.toml --locked --lib file_workspace:: -- --test-threads=8
cargo test --manifest-path src-tauri/Cargo.toml --locked --lib infra::platform_support:: -- --test-threads=8
pnpm rust:windows:check
pnpm rust:surface:check
pnpm exec vitest run scripts/check-rust-release-surface-core.test.mjs
```

A red proof is a red phase. `pnpm checks:pre-review` is the adopting session's pre-review block, not a substitute for this proof.

## Carried to diff review

* **CR-1.** The baseline pin is one assertion over `src-tauri/src/credentials.rs` and `src-tauri/src/file_workspace.rs`, not a second copy of the `credentials.rs` test body. The obligation is unchanged: putting `file_workspace.rs` back on the allowlist or the counts object fails the pin.
* **CR-2.** Diff review traces the directory observation and every helper it calls. Both returned values come from the same Unix `stat` result or the same retained Windows handle, and those values are what registration stores and what `WorkspaceEntry.last_modified` returns. A second name lookup that supplies either value fails the review. The unix swap hook only proves that a lookup after `statat` cannot change the returned pair. No Windows swap hook, and no further identifier-count pin.

## Decided autonomously

See Decisions and trade-offs. The adopting session records the mtime-source decision. This planner does not write `tasks/decisions.md`.

## Reviews

Round 1 wall time is `plan-meta.json` `review.per_round_seconds`. Twelve plan-capable lenses. `review-code-quality` and `review-root-cause` are `plan-review: false` and were not launched. No quota wait.

Raw verdicts, unchanged:

* chess-semantics APPROVED. `NOT APPLICABLE: The files and mandate concern filesystem modification-time observations; they do not involve an in-memory chess tree, position, or move path.`
* correctness APPROVED. No findings.
* engine-protocol APPROVED. `NOT APPLICABLE: The plan concerns filesystem timestamps and release-surface checks; it does not touch engine processes, UCI state, or asynchronous engine-result routing.`
* error-handling APPROVED. No findings.
* ipc-contract APPROVED. No IPC-contract defects. `lastModified` stays a signed Unix-seconds value.
* minimalism REVISE. One finding, M6.
* persisted-state APPROVED. `NOT APPLICABLE: The plan concerns Rust filesystem modification-time observations and release-surface checks; it has no renderer state, storage keys, or tab lifecycle.`
* pgn-index APPROVED. `NOT APPLICABLE: The plan concerns filesystem metadata for workspace creation; it does not touch PGN scanning, indexing, encoding, or searching.`
* plan REVISE. Two findings, M1 and M2.
* platform-semantics REVISE. Three findings, M5, M1, M4.
* tauri-security APPROVED. No findings.
* tests REVISE. Four findings, M3, M1, M2, M4.

### M1 — Fallback seconds have no witness

* **Claim:** The file witness never injects `PostRenameMetadata`, so the promised fallback seconds can be missing and the proof stays green. The sentence "rename does not change mtime" was not measured.
* **Witnesses:** plan r1 finding 1 (blocker); platform-semantics r1 finding 2 (should-fix); tests r1 finding 2 (should-fix).
* **Evidence:** `infra/fs.rs:902-913` saves `fallback_metadata` before rename. `infra/fs.rs:940-949` returns that identity and ctime on post-rename metadata failure, with `CommittedDurabilityUncertain`. `infra/fs.rs:9021-9047` asserts outcome, identity, and bytes, not seconds. No unix test injects `PostRenameMetadata`.
* **MANDATE:** the open question forbids turning a post-commit metadata failure into an error after the durable commit, and the returned seconds must name the installed inode.
* **Disposition:** Fix. The success path returns the post-rename fstat. The failure path returns the pre-rename fstat of the same descriptor. The plan no longer claims those readings match. Verification adds the fault witness, including a pre-epoch mtime, on Unix and Windows.
* **Authority:** MANDATE open question, third option rejected; fallback is the first option's failure branch already in the traced install.
* **Closure:** round 2.

### M2 — Windows directory seconds are unproved

* **Claim:** The file helper and the Unix race do not exercise the Windows directory observation. A raw FILETIME could pass every stated witness.
* **Witnesses:** plan r1 finding 2 (blocker); tests r1 finding 3 (should-fix).
* **Evidence:** Windows `entry_identity_at` (`infra/fs.rs:3107-3113`) returns only `(u64, u64)` from `opened_file_identity`. `windows_identity_is_read_from_the_retained_handle` (`platform_support.rs:937-951`) checks that call and not the conversion. Enumeration converts with `filetime_to_unix_seconds` (`infra/fs.rs:3049`).
* **MANDATE:** both create paths, on the environments the threat model names, return the installed object's listing seconds.
* **Disposition:** Fix. Directory create uses one observation that returns identity and seconds. A source pin requires `filetime_to_unix_seconds` in that Windows body. A `#[cfg(windows)]` create test compares `last_modified` to the enumerator. `rust-windows-test` runs it.
* **Authority:** MANDATE "both create paths" and the threat-model sentence that Windows counts.
* **Closure:** round 2.

### M3 — The directory race hook is too late to prove one observation

* **Claim:** `WORKSPACE_CREATED_CHILD_PRE_REGISTER_HOOK` runs after `entry_identity_at` has returned. Two lookups before registration can return seconds for a different object while that test passes.
* **Witnesses:** tests r1 finding 1 (blocker).
* **Evidence:** `create_workspace_directory_inner` calls `entry_identity_at` at `file_workspace.rs:966` and then `register_created_entry` at `:967`. The hook is inside registration at `:257-261`.
* **MANDATE:** the seconds and the registered identity name the same installed object. The open question's pathname window is the defect.
* **Disposition:** Fix. Directory create calls one function once and does not also call `entry_identity_at`. A unix hook inside that observation, after the copy and before return, swaps the directory. Identity and seconds must both be the pre-swap object. The pre-register hook stays as the witness that nothing restats after that point. No Windows hook.
* **Authority:** MANDATE defect (a rename returns a different object's mtime) plus the plan's own "one stat" sentence, which the round-1 witness did not enforce.
* **Closure:** round 2.

### M4 — An out-of-range Windows tick word has no defined result

* **Claim:** "Must not panic" does not say what a `u64` tick word outside `i64` becomes, and the pre-epoch witness uses a value that fits.
* **Witnesses:** platform-semantics r1 finding 3 (should-fix); tests r1 finding 4 (should-fix).
* **Evidence:** `filetime_to_unix_seconds` takes `i64` (`infra/fs.rs:2850-2854`). Enumeration stores `header.LastWriteTime` as `i64` (`infra/fs.rs:2938`). The handle metadata path reads `last_write_time()` as `u64` (`infra/fs.rs:3761`). `windows_filetime_ticks_become_unix_seconds` pins `filetime_to_unix_seconds(-1)` (`infra/fs.rs:8659`).
* **MANDATE:** create and a later listing of an untouched file report the same integer. The enumerator already interprets the tick bits as `i64`.
* **Disposition:** Fix. The create path passes those bits to `filetime_to_unix_seconds` as `i64`, including the high bit. It does not saturate or error. The witness covers a fitting pre-epoch value and `u64::MAX`.
* **Authority:** the decided contract that create seconds equal the enumerator's seconds. A saturating converter would be a second conversion.
* **Closure:** round 2.

### M5 — Platform proof jobs were unnamed

* **Claim:** Host tests and the surface gate do not prove Windows or macOS, and the plan omitted `pnpm rust:windows:check` and the FreeBSD probe.
* **Witnesses:** platform-semantics r1 finding 1 (should-fix).
* **Evidence:** Push skill names `pnpm rust:windows:check` at `.claude/skills/push/SKILL.md:108` as the local compile, and `rust-windows-test`, `rust-macos-test`, and `rust-platform` at `:376` as the jobs this machine cannot run. The new reads sit on the existing `cfg(unix)` fstat (`infra/fs.rs:1759-1767`) and `cfg(windows)` metadata (`infra/fs.rs:3758-3766`). `AtomicInstalledFile` and `TempMetadata` literals are in shared or cfg-split adapters already compiled on Linux (`infra/fs.rs:944`, `:957`, `:969`, `:1763`, `:3763`, `:4936`). This change adds no `target_os = "linux"` branch.
* **Disposition:** Fix. PROOF includes `pnpm rust:windows:check`. The plan names the three CI jobs. The FreeBSD probe is not applicable unless an edit adds a `target_os = "linux"` branch; the plan forbids that branch. No new probe harness.
* **Authority:** the lens's platform-proof rule, which is the verification level for the threat model's Unix and Windows environments. Not a new CI mechanism.
* **Closure:** round 2.

### M6 — Baseline pin would duplicate the credentials test

* **Claim:** A second "left the baseline" test copies the `credentials.rs` assertions.
* **Witnesses:** minimalism r1 finding 1 (should-fix).
* **Evidence:** `scripts/check-rust-release-surface-core.test.mjs:395-398` is one test with two expects. The obligation is that `file_workspace.rs` stays off the allowlist and the counts object.
* **Disposition:** Fix, carried to CR-1. One assertion covers both paths. The obligation's contract is unchanged.
* **Closure:** carried, CR-1. Not a plan-level adoption.

Opened 6, resolved this round 1 (M6 carried), open for closure 5 (M1–M5). Adopted this round: 5. Carried: 1. No Skip, Defer, or withdrawal. No correction-introduced issue yet. Round 2 reviews plan, platform-semantics, and tests.

### Round 2

Raw verdicts, unchanged:

* plan REVISE. Closed M1, M2, M3, M4, M5. One new finding, M7.
* platform-semantics REVISE. Closed M1, M3, M4, M5. M2 NOT CLOSED.
* tests REVISE. Closed M1, M2, M4, M5. M3 NOT CLOSED. One new finding, M8.

M1, M4, and M5 are closed by every lens that witnessed them. Their round-1 closure lines stand. M2 and M3 stay open: a lens that did not close them overrides a lens that did. M6 stays carried as CR-1 and was not re-reviewed.

### M2 — Windows directory seconds are unproved (round 2 residual)

* **Claim:** The cited pin at `platform_support.rs:948` checks only `opened_file_identity`. A normal Windows create cannot catch a second time lookup after the identity observation.
* **Witnesses:** platform-semantics r2 finding 1 (should-fix). Lineage: M2. Prior witnesses remain plan r1 finding 2 and tests r1 finding 3.
* **Evidence:** `windows_identity_is_read_from_the_retained_handle` (`platform_support.rs:937-951`) asserts `opened_file_identity` and nothing else. Windows `entry_identity_at` (`infra/fs.rs:3107-3113`) is one `open_expected_child` plus `opened_file_identity`, and it returns no seconds. Confirmed by reading both bodies. This is the first failure of this lineage.
* **MANDATE:** both create paths return the installed object's listing seconds from the same observation as the registered identity.
* **Disposition:** Fix. The seconds pin is a new assertion, not the existing identity loop. The observation body contains `opened_file_identity`, `filetime_to_unix_seconds`, and exactly one `open_expected_child`. The identity loop's `entry_identity_at` signature moves onto that body. `create_workspace_directory_inner` calls the observation once and does not call `entry_identity_at`. No Windows swap hook.
* **Authority:** the same MANDATE obligation as round 1. The correction changes the verification contract of that obligation. It adds no rollback and no second production lookup.
* **Closure:** open. Round 3 checks it. Round 2 cannot close it.

### M3 — The directory race hook is too late to prove one observation (round 2 residual)

* **Claim:** A hook that runs after identity and seconds are copied never injects a swap between two earlier lookups, so both assertions can pass.
* **Witnesses:** tests r2 finding 1 (blocker). Lineage: M3. Prior witness remains tests r1 finding 1.
* **Evidence:** The round-1 correction put the hook after the copy. Unix `entry_identity_at` (`infra/fs.rs:4416`) is one `rfs::statat` followed by `raw_stat_identity`. Confirmed by reading that body. This is the first failure of this lineage.
* **MANDATE:** the seconds and the registered identity name the same installed object.
* **Disposition:** Fix. The hook is the next statement after the observation's single `statat` and before either value is derived. The returned pair is built only from that `stat`. A source pin counts `statat` in that braced body and fails unless the count is one. The pre-register hook stays. No Windows hook.
* **Authority:** the same MANDATE defect as round 1. The failed placement did not enforce one syscall.
* **Closure:** open. Round 3 checks it. Round 2 cannot close it.

### M7 — Deleting `timestamp` leaves the listing-shape test calling it

* **Claim:** Cleanup names only `timestamps_and_durability_outcomes_remain_renderer_safe`. `collect_tree_entries_lists_the_workspace_shape_on_every_platform` also calls `timestamp`, so `cargo test --lib file_workspace` does not compile.
* **Witnesses:** plan r2 finding 1 (blocker).
* **Evidence:** `file_workspace.rs:3327` and `:3348` compare listed `last_modified` to `timestamp(...)`. Confirmed by reading the test. The durability call at `:3192` was already named.
* **MANDATE:** `timestamp` is deleted, and the phase proof includes `cargo test --lib file_workspace`. The listing comparisons are the coverage that deletion must keep.
* **Disposition:** Fix. Both listing assertions stay and compare `last_modified` to the enumerator's whole seconds. They do not call `timestamp` and do not use `duration_since`. A test-only read is not a production pathname reach.
* **Authority:** the plan's own delete-`timestamp` obligation plus a red phase proof. Not a listing-bounds change (`f-20260913-06` stays out).
* **Closure:** open. Round 3 checks it.

### M8 — Pre-epoch coverage stops at the helper

* **Claim:** The pre-epoch assertion is on `atomic_replace_at_identified`. A caller that clamps or rejects a negative `WorkspaceEntry.last_modified` still passes.
* **Witnesses:** tests r2 finding 2 (blocker).
* **Evidence:** The file success witness stops at `modified_seconds`. `create_workspace_directory_inner` assigns `last_modified` at `file_workspace.rs:1000` from `timestamp`, which rejects pre-1970. `collect_tree_entries_lists_a_pre_epoch_entry_with_its_negative_timestamp` (`file_workspace.rs:5095`) lists an existing file and does not call either create path. Confirmed by reading that test's opening.
* **MANDATE:** a pre-1970 time is a negative `i64` on the value the create response returns, not `Error::InvalidInput`.
* **Disposition:** Fix. Both `create_workspace_file` and `create_workspace_directory` return a negative `last_modified` equal to the enumerator's seconds. The helper witness stays and does not replace this one.
* **Authority:** the decided contract that create seconds equal the enumerator's seconds, including a negative value. Not a new numeric formula.
* **Closure:** open. Round 3 checks it.

Opened this round: M7, M8. Re-opened: M2, M3 (first failure each). Closed this round: M1, M4, M5. Adopted this round: 4 (M2, M3, M7, M8). Carried unchanged: M6. No Skip, Defer, or withdrawal. Round 3 reviews plan, platform-semantics, and tests.

### Round 3

Raw verdicts, unchanged:

* plan APPROVED. Closed M2, M3, M7, M8. No bracketed findings.
* platform-semantics REVISE. Closed M2, M3, M7. M8 NOT CLOSED.
* tests REVISE. Closed M7, M8. M2 NOT CLOSED. M3 NOT CLOSED.

M7 is closed by plan, platform-semantics, and tests. M2 and M3 failed closure a second time (tests). Patching the source-count pin stops. A fresh-context review-plan judgment (`probe-1-r3`) recorded the mechanism below. M8 failed closure once (platform) and is corrected, not carried.

Judgment, `probe-1-r3`: the one-observation obligation stays. Identifier counts do not prove it, because a helper hides a second lookup. Diff review traces the observation and its helpers and rejects a second name lookup that supplies either value. That check is CR-2. The unix hook stays and its limit is stated. The directory pre-epoch witness needs a `cfg(test)` hook after `create_dir_at` succeeds and before the observation begins. No Windows swap hook and no rollback.

### M2 — Windows directory seconds are unproved (second failure)

* **Claim:** A pin of `opened_file_identity`, `filetime_to_unix_seconds`, and one direct `open_expected_child` still allows a helper to read seconds from a second handle.
* **Witnesses:** tests r3 finding 1 (blocker). Lineage: M2.
* **Evidence:** The round-3 plan text required that count. Windows `entry_identity_at` (`infra/fs.rs:3107-3113`) is one open today. The tests claim is about a future helper, and no count of a direct call excludes one. Confirmed by reading the observation body and the round-3 wording.
* **MANDATE:** identity and seconds come from one observation.
* **Disposition:** Fix, carried to CR-2. The count pin is withdrawn. The obligation is unchanged. Diff review traces helpers.
* **Authority:** second closure failure, then `probe-1-r3`. Not a new production mechanism.
* **Closure:** carried, CR-2. Not a plan-level adoption.

### M3 — The directory race hook is too late to prove one observation (second failure)

* **Claim:** A count of direct `statat` calls misses a helper that looks up before the pinned call, so the hook swaps too late.
* **Witnesses:** tests r3 finding 2 (blocker). Lineage: M3.
* **Evidence:** Unix `entry_identity_at` (`infra/fs.rs:4416`) is one `statat` today. The same helper-hiding limit as M2. This is the second failure of this lineage.
* **MANDATE:** identity and seconds come from one observation.
* **Disposition:** Fix, carried to CR-2. The `statat` count pin is withdrawn. The hook stays immediately after `statat` and is documented as proof only about lookups after that point.
* **Authority:** second closure failure, then `probe-1-r3`.
* **Closure:** carried, CR-2. Not a plan-level adoption.

### M8 — Pre-epoch coverage stops at the helper (round 3 residual)

* **Claim:** The directory witness sets mtime after `create_dir_at` and before the observation returns, but the planned hooks run after the seconds are captured. The witness cannot execute.
* **Witnesses:** platform-semantics r3 finding 1 (should-fix). Prior witness remains tests r2 finding 2.
* **Evidence:** `create_workspace_directory_inner` calls `create_dir_at` then `entry_identity_at` at `file_workspace.rs:965-966`. The pre-register hook is inside registration (`:257-261`), after that observation. A hook after `statat` reads `st_mtime` that is already captured. Confirmed by reading those lines. First failure of this lineage.
* **MANDATE:** a pre-1970 directory create returns a negative `last_modified`.
* **Disposition:** Fix. A `cfg(test)` hook on the shared create path runs after `create_dir_at` succeeds and before the observation syscall or handle acquisition. The test sets a representable pre-epoch mtime there. The file path still sets mtime inside the write closure.
* **Authority:** the same negative-seconds contract. The previous witness named an interval no existing hook can use. Not a Windows swap hook.
* **Closure:** open. Round 4 checks it.

Closed this round: M7. Carried this round: M2, M3 (CR-2), after the second failure and `probe-1-r3`. Adopted this round: 1 (M8). M6 stays CR-1. No Skip, Defer, or withdrawal. Round 4 reviews plan, platform-semantics, and tests. Open: M8.

### Round 4

Raw verdicts, unchanged:

* plan APPROVED. Closed M8. No bracketed findings.
* platform-semantics APPROVED. Closed M8. No bracketed findings.
* tests REVISE. Closed M8. One new finding, M9.

M8 is closed by plan, platform-semantics, and tests. The directory hook is the witness platform asked for.

### M9 — The file success witness misses a pathname stat after rename

* **Claim:** An ordinary create compares mtime with no swap, so a pathname lookup after rename still passes. The pre-register hook runs after the helper has captured seconds. The fallback witness covers only the failure arm.
* **Witnesses:** tests r4 finding 1 (blocker).
* **Evidence:** `PostRenameMetadata` is injected after `rename` and before `adapter.metadata(&temp)` (`infra/fs.rs:933-934`). `inject_atomic_file` continues when `inject` returns `Ok` (`infra/fs.rs:452-454`). The failure arm at `:940-949` does not run on `Ok`. Registration starts only after the helper returns, so `WORKSPACE_CREATED_CHILD_PRE_REGISTER_HOOK` is later. Confirmed by reading those lines.
* **MANDATE:** a rename in the window between install and the metadata read must not supply another object's seconds. The file success path is that window.
* **Disposition:** Fix. The same inject point swaps the installed name and returns `Ok`. The returned seconds are the pre-swap inode's. No new fault-point variant. The failure arm stays the fallback witness.
* **Authority:** MANDATE defect, file path. The existing injector is the interval. Not a new production lookup.
* **Closure:** open. Round 5 checks it.

Closed this round: M8. Opened this round: M9. Adopted this round: 1 (M9). Carried unchanged: M6, M2, M3. No Skip, Defer, or withdrawal. Round 5 reviews plan, platform-semantics, and tests.

### Round 5

Raw verdicts, unchanged:

* plan APPROVED. Closed M9. No bracketed findings. It noted Windows sharing and named `inspect_temp` as a route.
* platform-semantics REVISE. M9 NOT CLOSED, twice, same defect.
* tests APPROVED. Closed M9. No bracketed findings. It also named a handle-based Windows swap.

M9 stays open. Platform's reading matches the source: a pathname swap cannot be staged on Windows. `inspect_temp` is before the write, so that route is rejected.

### M9 — The file success witness misses a pathname stat after rename (round 5 residual)

* **Claim:** The Windows swap does not say how to replace the installed name while the private temp handle stays open. The existing Windows test says a live pathname swap cannot be staged.
* **Witnesses:** platform-semantics r5 finding 1 (should-fix); platform-semantics r5 finding 2 (should-fix). Prior witness remains tests r4 finding 1.
* **Evidence:** `FILE_SHARE_PRIVATE_TEMP` is `FILE_SHARE_WRITE` (`infra/fs.rs:2165`). The test comment at `infra/fs.rs:9011-9016` says the sharing mask rejects a second opener. `post_rename_identity_comes_from_the_retained_handle` (`platform_support.rs:701-727`) pins `adapter.metadata(&temp)` for that reason and records a measured sharing violation (os error 32). `inspect_temp` is at `infra/fs.rs:787`, before the write. Confirmed by reading those sites. First failure of this lineage.
* **MANDATE:** the file success path must not take seconds from a replaced pathname. On Windows that race cannot be staged in-process without widening the share mask.
* **Disposition:** Fix. Unix keeps the runtime swap at `PostRenameMetadata`. Windows extends the existing retained-handle source pin so `modified_seconds` comes from that `metadata` value, and does not pathname-swap. The failure arm is unchanged. The share mask stays.
* **Authority:** the measured Windows limit already recorded for this window (`f-20260916-12` in that pin's comment). Not a new share mode and not `inspect_temp`.
* **Closure:** open. Round 6 checks it.

Adopted this round: 1 (M9 Windows witness). Open: M9. Carried unchanged: M2, M3, M6. No Skip, Defer, or withdrawal. Round 6 reviews plan, platform-semantics, and tests.

### Round 6

Raw verdicts, unchanged:

* plan APPROVED. `M9 CLOSED — Candidate plan-r6.md:89 preserves the Unix swap at PostRenameMetadata, before the retained-descriptor read (src-tauri/src/infra/fs.rs:933). At plan-r6.md:91, Windows extends the existing source pin to require success seconds from that metadata value and reject pathname reads (src-tauri/src/infra/platform_support.rs:701). This fits the retained-handle adapter (src-tauri/src/infra/fs.rs:3758), preserves FILE_SHARE_PRIVATE_TEMP (:2165), and keeps the fallback witness (plan-r6.md:95). The corrected verification is feasible without a new seam or share-mask change (confidence: 95).` No bracketed findings.
* platform-semantics APPROVED. `M9 CLOSED — Unix keeps the successful PostRenameMetadata swap witness; Windows keeps FILE_SHARE_WRITE and extends the retained-handle source pin to require seconds from the same adapter.metadata(&temp) value. Runtime proof is rust-windows-test for Windows and rust-macos-test for the shared Unix path. pnpm rust:windows:check is included as a compile check but was not run in this read-only plan review; the FreeBSD source probe is not applicable because no target_os = "linux" branch is planned.` No bracketed findings.
* tests APPROVED. `M9 CLOSED — Unix retains the PostRenameMetadata swap witness. On Windows, the extended post_rename_identity_comes_from_the_retained_handle assertion checks that returned seconds come from the retained-handle metadata and rejects a target-path stat; rust-windows-test runs on push and pull request.` No bracketed findings.

### M9 — closure

* **Claim:** unchanged from round 5. The Windows witness is the retained-handle source pin, not a pathname swap.
* **Witnesses:** tests r4 finding 1; platform-semantics r5 finding 1; platform-semantics r5 finding 2. Round 6 plan, platform-semantics, and tests each returned M9 CLOSED and no bracketed finding.
* **Evidence:** the round-6 body keeps the Unix swap at the existing inject point and the Windows extension of `post_rename_identity_comes_from_the_retained_handle`. All three closure lenses accepted that split.
* **Disposition:** Fix, already adopted in round 5. No further correction.
* **Closure:** closed in round 6.

Adopted this round: 0. Open: none. Carried unchanged: M2, M3, M6. No Skip, Defer, or withdrawal. Plan review ends.
