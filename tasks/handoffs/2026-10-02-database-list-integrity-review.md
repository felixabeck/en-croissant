# Review record: database list integrity (2026-10-02)

Plan: `tasks/plans/2026-10-02-database-list-integrity.md` (git-ignored). This file is the durable review history. Orchestrator: Grok. Executor: Codex (`gpt-6.1-sol`, high for the write leaf, low for read-only lenses). Detection is same-family model separation, not family separation. The plan review was already closed; this run did not reopen it.

Code reviewed through `065dc21d5e580e1e71b1091258fde5fb8388144b`. The earlier closure stopped at `d3c738b071b1a4b42217c2b38ead48bdf20ed87e`. The commits through that point are `b3f0bcbc` (decisions), `7b0145d2` (implementation), `1485577b` (stamp recheck and Home cache), and `d3c738b0` (leaf warning and Windows probe fixture). The gate repair is `065dc21d`.

## Plan review

P1 through P13 are closed. The plan's Reviews section is the source; the dispositions are copied here.

P1. Proof used `--lib` on a binary crate. Fix: `cargo test --bin chessfable`.
P2. An older scan can overwrite a newer stamp. Fix: publish only when the file identity is still the identity the scan started with.
P3. Enough scans can take every blocking-gateway permit. Fix: at most one content scan holds a permit.
P4. "Open twice" can pass on the in-memory schema cache. Fix: the proof rebuilds the repository.
P5. A failure during the in-flight list fetch is answered with that fetch's shared promise. Fix: both `databases` and Home `personalDatabases` start a follow-up read after their own generation settles. Home keeps its success filter.
P6. The listener mounts beside `useConversionProgress` in `src/App.tsx`.
P7. The event is failure-only. A passed scan emits nothing.
P8. A failed stamp write keeps the in-process corruption verdict and retries the write without another scan.
P9. Cancellation, lock, and I/O write no stamp.
P10. The new tests are not unix-gated. `pnpm rust:windows:check` is compile-only. `rust-windows-test` and `rust-macos-test` are the runtime proof.
P11. A failed scan emits exactly one event in the Rust proof.
P12. Shutdown and delete are each tested, and each stops the pragma without a stamp.
P13. A failed stamp write is asserted: the next metadata read returns the corruption error, retries the write, and does not scan.

Round 3 of the plan review approved. `review-ipc-contract` needed one same-route capacity retry, and that retry approved. `review-pgn-index` and `review-tauri-security` approved in round 1 with no findings.

## Diff review

### Round over `7b0145d2` (closure of the first implementation)

Nine lenses. Adopted and repaired in `1485577b`:

- The scan worker re-reads the stamp after the identity check and before opening SQLite. A matching stamp returns without content pragmas, a rewrite, or an event.
- The stamp encodes modified time as signed seconds and unsigned nanoseconds. `DatabaseIdentity`'s public serde is unchanged. An unreadable stamp stays a missing stamp.
- An unmounted Home key calls public `mutate` before `cache.delete`, and deletes only when the signal is live and no subscriber is mounted. The regression uses `dedupingInterval: 60000`.
- A failed identity probe after a failed stamp write keeps the pending verdict, using the existing `after_probe_current` hook.
- A rolled-back create leaves no `.integrity` sibling.
- The duplicated PGN grant and convert setup is one test helper.
- Passed-stamp warnings name the database file.

Skipped: `operations.accept` returning `ResourceLimit` does not reschedule itself; no wall-clock list-wait test; Home's success filter stays; the decisions header stays; `database.ts` stays; no emit-failure log.

### Round over `1485577b`

Six of seven lenses approved. `review-platform-semantics` returned REVISE. `review-tests` and `review-minimalism` returned REVISE on should-fix items; `review-error-handling` approved with R7 not closed. Adopted and repaired in `d3c738b0`:

- W1. The failed-probe fixture drops its direct SQLite connection before renaming the database. It is not unix-gated and adds no production hook.
- W2. A resolved publication failure warns with `target.leaf()`. `LogCaptureScope` asserts that leaf. An unresolved `mutate_target` failure says the handle could not be resolved.
- W3. Remounting Home, or aborting the listener, while the unmounted revalidation is blocked keeps the cache key. A live unmounted listener still deletes it.
- W4. `UNIX_EPOCH` minus exactly 86400 seconds encodes seconds `-86400` and nanoseconds `0`.
- W5. Both stamp-failure tests share `assert_pending_integrity_retry`.

### Closure over `d3c738b0`

`review-correctness`, `review-tests`, `review-minimalism`, `review-error-handling`, `review-platform-semantics`, and `review-persisted-state` all returned `VERDICT: APPROVED`. W1 through W5 were closed by every lens that judged them.

One should-fix was skipped. `review-tests`, confidence 99: no test drives the unresolved `mutate_target` warning, so changing that sentence would stay green. The arm was read. It logs the opaque handle and says the database could not be resolved. It does not invent a filename. The resolved leaf, which is the value a caller can get wrong, is pinned. Forcing an authority-resolution failure is a separate fault injection and does not change the list, the stamp, or the card.

The closure of `d3c738b0` recorded `REVIEWED_THROUGH=d3c738b071b1a4b42217c2b38ead48bdf20ed87e`. The current pointer is at the end of the gate-repair closure.

### Gate repair closure over `065dc21d`

Final gates on `9d6ec868` exited 1. `rust-test` and `rust-coverage` failed `search_index_generation_uses_fd_relative_atomic_writer`: the pin splits on the exact text `#[derive(Serialize, Type)]`, and `7b0145d2` had changed `DatabaseInfo` to `#[derive(Debug, Serialize, Type)]`, so the slice ran through the rest of the file and saw later `resolve_database(` calls. `DatabaseMetadata` derived `Debug` only because its `info` field did. Nothing logs that struct. `065dc21d` restores `#[derive(Serialize, Type)]` on `DatabaseInfo` and drops the unused `Debug` derive on `DatabaseMetadata`. The pin delimiter is unchanged, and `generate_search_index_locked` is unchanged.

`frontend-coverage` failed `tauri-ipc-platform` lines `351/366` against baseline `337/351`. The new uncovered record was `tauriSubscriptions.databaseContentFailure` in `src/platform/tauri.ts`. The same commit covers that subscription from `src/platform/tauri.test.ts`. Baselines and floors were not edited. Full frontend coverage has not been re-measured since that test landed; the ratio arithmetic says `352/366` clears the line ratchet and `91/98` clears the function ratchet.

The contract lane failed because `scripts/findings.py` does not match the released kit (`f44495a1`). `git diff origin/master -- scripts/findings.py` is empty on the product commits. That drift is outside this review.

Pre-review-6 exited 0 on the repair tree before the commit (`gate-pre-review-6`, recorded HEAD `9d6ec868` because the repair was still unstaged). Orchestrator proof on that tree: `db::tests::search_index_generation_uses_fd_relative_atomic_writer` passed, and vitest `src/platform/tauri.test.ts` passed 28 tests.

`review-correctness`, `review-tests`, `review-root-cause`, and `review-minimalism` each returned `VERDICT: APPROVED` on `9d6ec868..065dc21d`. No findings. The skipped unresolved `mutate_target` warning test from the previous closure stays skipped.

`REVIEWED_THROUGH=065dc21d5e580e1e71b1091258fde5fb8388144b`

## Proof before this record

Orchestrator, on the `d3c738b0` tree: `content_validation` 20 passed, `s4_database_commands_offload_through_named_blocking_functions` 1 passed, vitest `useDatabaseContentValidation.test.tsx` and `App.test.tsx` 31 passed. Pre-review exit 0 (`gate-pre-review-5`), including Windows clippy and frontend mutation of the changed files. `pnpm test:e2e:container` (62 passed) and `pnpm verify:app` (`all checks passed`) ran on the parent of `7b0145d2`. The later commits do not change a rendered surface those gates cover. The corrupt-file card is covered by the Rust and vitest proofs.
