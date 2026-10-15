# Local PGN cancellation Phase 1 handoff

Working tree: `/home/felixb/Projekte/chessfable.worktrees/drain`
HEAD: `4c72b111bd97fc496cdbdf285ceaad4df3def8ba`

Implementation of frozen O1–O5 is present. Changes are unstaged. No agents, browser, snapshots, release build, staging, commit, push or deployment ran. No tasks, plans, rules, capability scopes, dependencies, coverage floors or bundle budgets changed.

## Changed paths

- `src-tauri/src/infra/operations.rs` adds Conversion reservations and an explicit accepted kind. Downloads and conversions share prepared claim, cancellation and release. Download admission, progress and commit policies remain download-specific. Conversion workers retain accepted lifetime across owner destruction, reload and request abandonment, with application shutdown cancellation.
- `src-tauri/src/db/mod.rs` adds optional conversion tickets, prepare/cancel/release command adapters and token wiring. It narrowly shares PGN grant fixtures with portable tests. Two test-only checkpoints surround the existing revision/commit boundary. No production commit barrier was added.
- `src-tauri/src/db/conversion_cancellation_tests.rs` is a new portable test module through the production core. It covers reserved cancellation, existing content/revision rollback, same-target queued isolation and retry, committed success, abandonment/shutdown, and a genuinely empty new target whose rolled-back schema is deleted only after worker settlement.
- `src-tauri/src/main.rs` registers the new Specta commands.
- `src/platform/tauri.ts` and `src/platform/tauri.test.ts` add the shared prepared conversion lifecycle and contract tests. Conversion cancellation remains separate from AbortSignal settlement, so native success stays authoritative.
- `src/bindings/generated.ts` was changed exclusively by `pnpm bindings:generate`.
- `src/state/atoms.ts` and new `src/state/atoms.conversion.test.ts` add opt-in local ticket ownership, cancellation before preparation/dispatch, pending-request deduplication, request failure/retry, stale-action guards and owner retirement. A transient refresh-failure atom retains library retry across navigation.
- `src/components/databases/AddDatabase.tsx` and `AddDatabase.test.tsx` pass local tickets, check cancellation after target creation, delete only the new target after cancellation/failure, and preserve the primary result through cleanup and refresh.
- `src/components/databases/databaseMutation.ts` and `databaseMutation.test.ts` share conversion refresh settlement and pass the operation object/ticket through Add games.
- `src/components/databases/useDatabaseLibrary.tsx` adds localized accessible per-row Cancel controls, per-entry pending state and failed-reload recovery.
- `src/components/databases/ConcurrentConversion.test.tsx` covers exact click-to-ticket forwarding, double clicks, same-target siblings, navigation, request retry, transaction success, visible deletion/refresh failures and recovery of unfinished targets through Delete.
- `src/components/home/AccountCard.tsx` and `AccountCard.picker.test.tsx` explicitly pass null for the new ticket argument. Account conversion retains its existing behavior and has no cancellation control.
- `e2e/database-files.spec.ts`, `e2e/font-scaled-breakpoints.spec.ts` and `e2e/fixtures.ts` add ticket mocks, active/pending row assertions, concurrent navigation and 320px/200% long-name snapshots.
- `scripts/verify-app.mjs` extends the existing disposable capability journey with CC0–CC5 below. Its contract function is importable without launching an application, and it reads only the owned disposable database through built-in Node SQLite after settlement.
- `scripts/app-driver-tests.mjs` exercises the six harness assertions with distinguishable injected outcomes and preserves the existing driver tests.

`pnpm i18n:extract` exited 0 with no translation diff. Common.Cancel and Databases.LoadRetry are reused. No source scope expansion was needed.

## Final phase proof

Heavy runs used agent-gate. Each status was captured separately. Full output is in `/tmp/cancel-import-final-<name>.log`, with the observed exit in the matching `.status` file.

| Exact command | Exit | Output |
| --- | --- | --- |
| `pnpm exec vitest related src/platform/tauri.ts src/state/atoms.ts src/components/databases/AddDatabase.tsx src/components/databases/useDatabaseLibrary.tsx src/components/databases/databaseMutation.ts src/components/home/AccountCard.tsx --run` | 0 | 132 files, 2651 tests passed. `final-vitest.log` |
| `cargo test --manifest-path src-tauri/Cargo.toml --locked infra::operations::tests::` | 0 | 29 passed. `final-operations.log` |
| `cargo test --manifest-path src-tauri/Cargo.toml --locked convert_pgn_` | 0 | 16 passed. `final-convert.log` |
| `cargo test --manifest-path src-tauri/Cargo.toml --locked conversion_cancellation_tests::` | 0 | 6 passed. `final-cancellation.log` |
| `pnpm bindings:check` | 0 | Exporter regenerated an identical binding. `final-bindings.log` |
| `pnpm ipc:consumers:check` | 0 | Consumer check passed. `final-ipc.log` |
| `pnpm checks:pre-review` | 0 | Format/lint/types, coverage mapping, Windows clippy, bundle and both selected mutation packages passed. `final-pre-review.log` |

Additional proof: `node --test scripts/app-driver-tests.mjs` exited 0, 13 tests passed. Type checking, oxfmt and oxlint passed. `git diff --check` passed and `git diff --cached --stat` was empty.

Pre-review logs are under `artifacts/gates/20261015T044722060Z-1703401`. Mutation results were 100% for workspace-storage, with 1074 killed and no survivors, and 100% for tree-path, with 170 killed, 6 timed out and no survivors. A staging-recipe comment correction made while the mutation lane used its private sandbox was separately checked with oxfmt, oxlint and all 13 harness tests, each exit 0. No executable behavior changed after the pre-review source checks.

The initial `agent-gate pnpm build-vite` bootstrap attempt exited 2 on stale generated IPC types and the incomplete test callback signature. This was not completed-phase proof. The instructed `agent-gate pnpm exec vite build` exited 0, then `agent-gate pnpm bindings:generate` exited 0. Generated bindings were never hand-edited.

## Source-only fix-revert witnesses

Native patch: `/tmp/cancel-import-native-source.patch`, cut from the current Git diff. Only the core's claim-or-accept source hunk disappeared. The optional signature, command adapters, test module, fixtures and all tests remained.

```bash
git apply -R --verbose /tmp/cancel-import-native-source.patch
cargo test --manifest-path src-tauri/Cargo.toml --locked conversion_cancellation_tests::convert_pgn_reserved_ticket_cancellation_never_imports
git apply --verbose /tmp/cancel-import-native-source.patch
cargo test --manifest-path src-tauri/Cargo.toml --locked conversion_cancellation_tests::convert_pgn_reserved_ticket_cancellation_never_imports
```

Observed red exit 101 with the assertion expecting typed Cancellation failing. Restored green exit 0, one test passed. Logs: `/tmp/cancel-import-native-red.log`, `native-green.log`, `native-reverse.log`, `native-restore.log`. `/tmp/cancel-import-native-only-hunk.diff` records the before/after Git diff comparison. The restored Git diff compared byte-identically to its before copy, and regression test hashes matched during the proof.

Renderer patch: `/tmp/cancel-import-renderer-handler.patch`, derived from the current Git diff while retaining the surrounding new button. Only its onClick line disappeared.

```bash
git apply -R --verbose /tmp/cancel-import-renderer-handler.patch
pnpm exec vitest run src/components/databases/ConcurrentConversion.test.tsx -t 'row Cancel forwards its exact conversion ticket'
git apply --verbose /tmp/cancel-import-renderer-handler.patch
pnpm exec vitest run src/components/databases/ConcurrentConversion.test.tsx -t 'row Cancel forwards its exact conversion ticket'
```

Observed red exit 1 with the button still rendered and the exact-ticket assertion reporting zero cancel calls. Restored green exit 0, one test passed. Logs: `/tmp/cancel-import-renderer-handler-red.log`, `renderer-handler-green.log`, `renderer-handler-reverse.log`, `renderer-handler-restore.log`. The restored Git diff compared byte-identically to its before copy, and regression test hashes matched. Both native and renderer reverse/restore applications were clean with no offsets. A separate whole-button red/restore-green witness also exists under `/tmp/cancel-import-renderer-*`.

## Signature consumer inventory

- New local import: AddDatabase → runDatabaseConversion(local) → withConversionTicket → convertLocalDatabase → convertPgn with its exact prepared ticket.
- Add games: useDatabaseLibrary → runAddGamesToDatabase → runDatabaseConversion(local) → convertPgn with its captured destination and exact ticket.
- Account conversion: AccountCard → runDatabaseConversion without local opt-in → convertPgn with null ticket.
- Native callers: the exported command forwards the invoking webview label. Existing Unix command-matrix and parser-error core callers now pass null ticket and main owner. New portable tests call the production core with prepared tickets.
- Facade tests mock the generated commands. AddDatabase and ConcurrentConversion tests mock the prepared helper. AccountCard.picker signature expectations include null. databaseMutation tests forward the operation object. Other related account consumers passed unchanged.
- Existing raw game-opening verify-app conversion remains an optional-ticket unticketed call. The new native cancellation journey supplies explicit tickets or null. E2E fixtures mint unique conversion tickets and assert click forwarding.

## Real-app assertion staging still required

All CC0–CC5 native staging is UNVERIFIED and UNSTAGED. The documented failure exit is 1. No actual failure exit statuses from a browser/native-app run have been observed for these assertions. The 13 harness unit tests are not that evidence. The script header explicitly preserves this limitation.

Use an isolated scratch checkout containing the complete working-tree feature, including the new files. Build and run its own release binary through its own verify:app script. Never replace the installed binary, edit production state, change verifier logic, or alter assertion fixtures. Do not edit a running application's SQLite database or registry. The dedicated PGNs are disposable external inputs, and their absolute profile paths are printed during setup. Faulty producer builds are disposable inputs to the unchanged verifier, following the existing harness staging convention.

| Assertion | What it checks | Disposable real-input staging recipe |
| --- | --- | --- |
| CC0 | Native seed has exactly one game and revision 1 | Before this journey imports it, replace only the logged verify-conversion-seed.pgn with a valid two-game PGN. Save/restore its exact bytes. |
| CC1 | Reserved cancellation returns typed Cancellation | Run a scratch producer with only the native claim-or-accept hunk reversed, using the native proof patch above. |
| CC2 | Native progress dispatches a same-target sibling and both running/queued tickets cancel | The same unticketed scratch producer commits instead of honoring the tickets. Preserve a valid dedicated source PGN. Each assertion must print its own distinguishable FAIL even when one producer breaks several assertions. |
| CC3 | Cancellation preserves existing Games content and DataRevision | In a separate scratch producer, replace only convert_pgn_command_core's token passed to the worker with an independent uncancelled token. Use a manageable valid source PGN if needed so the broken producer settles within the probe budget. Observe an actual snapshot mismatch, not only a setup refusal. |
| CC4 | A fresh ticket imports successfully after cancellation and reaches two games/revision 2 | Use a scratch producer that refuses ticketed conversion after claim. The unticketed seed still succeeds and the retry itself rejects. CC4 must execute and fail directly, independently of other assertion failures. |
| CC5 | Completed tickets are retired | In a scratch producer, retain the conversion lease instead of dropping it at workflow completion, limited to the convert_pgn label. The post-settlement cancel returns true. Let the existing driver clean up the disposable process group after the failing run. |

For every row, record its exact FAIL message and observed exit 1 from that run. Restore the smallest input or producer hunk, verify restoration, then record a clean exit 0. Update the verifier header with those observed receipts before relying on this new journey. Input/binary staging recipes above have not been executed by the leaf.

## Root browser and platform work

New screenshot assertions are `conversion-active.png`, `conversion-cancel-pending.png`, `conversion-cancel-320-200.png` and `conversion-cancel-pending-320-200.png`. Inspect counters, source wrapping, spinner, accessible Cancel and disabled/pending state before container-only updates. No screenshot was generated or updated here.

Root still owns browser execution, screenshot inspection/update, release build, real verify:app runs and assertion staging. The portable tests ran on Linux. Pre-review's Windows compilation/lint is not Windows runtime proof. Existing rust-windows-test and rust-macos-test runtime CI on the pushed SHA remain required. No other out-of-scope product defect was observed.
