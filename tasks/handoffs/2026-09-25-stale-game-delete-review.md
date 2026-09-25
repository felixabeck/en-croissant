# Stale PGN deletion plan review record

This record preserves the final plan and the complete raw Gemini plan-review reports for `f-20260924-05`. The working plan under `tasks/plans/` is ignored by Git. Plan authorship and arbitration shared one Codex context; detection ran on Gemini, a different model family from the Codex implementation. A second-round `review-plan` attempt failed with provider `RESOURCE_EXHAUSTED`; it provided no valid verdict. The normal-route Gemini retry (`r2b`) completed and is the verdict for that lens in round 2.

Issue register and dispositions: P1 migrated all `read_games` callers and mocks; P2 made typed stale refusal close confirmation; P3 made missing rows and scan-to-commit changes typed `StaleGame`; P4 guarded rollback and count refresh; P5 strengthened actual loader and confirmation proof; P8 froze the row snapshot during an open confirmation; P9 migrated `FileInfo`'s row-map prop. All seven were adopted as `Fix` and closed by the final round. P6 (additional scan-to-commit acceptance test) and P7 (extra native item and expectation types) were `Skip` because they added no requirement coverage or duplicated existing contracts. No issue remains open; no successor entry inherits an obligation.

The round 1 candidate is `plan-r1.md`, round 2 is `plan-r2.md`, and the final candidate is the plan below. Raw reports follow with their original verdicts and witnesses. Temporary snapshot paths in the reports are provenance, not durable dependencies.

Review accounting: three completed rounds; wall elapsed was approximately r1 8m32s, r2 18m37s, r3 3m47s. Round 2 includes a 9m51s provider-quota failed attempt and a 7m48s valid Gemini retry; the failed attempt's draft verdict is excluded. Active review wall time is unknown because parallel lens time is not additive. Nine unique issues opened; seven adopted and closed; two skipped; zero unresolved. Adopted lens findings per completed round: r1=5 r2=2 r3=0. P8 and P9 were correction-review coverage gaps, not new code defects. No split, successor, or withdrawn change.

## Final plan and working review history

# Plan: Reject deletion from a stale PGN game list

## Goal

Close `f-20260924-05`: confirming deletion of a displayed game must never delete a different game after the PGN changed. A refused deletion must leave the file intact and tell the user to refresh the list.

## Approach

### Row identity and native commit

Return each `read_games` page item as the existing `StampedGame` with its PGN text, exact game stamp, and file revision from the same native scan/read snapshot. Preserve bounded page reads and cancellation. Make `delete_game` require the selected row's stamp and revision as explicit IPC arguments. Under the existing per-file edit lock, rescan the current file and reject if the revision or selected range's stamp differs. For deletion, a missing row or a scan-to-commit snapshot change is also `StaleGame`; no such refusal changes the file. A revision check covers equal-text duplicate games that moved under a structural file edit.

Keep one native representation for game stamps and reuse the write path's comparison machinery where appropriate. Regenerate Specta bindings; update every consumer of `read_games` to use the page item's PGN text. Migrate the Files preview and import, their mocks, the platform facade test, and `e2e/fixtures.ts` with the command shape. Update `FileInfo.tsx`'s `setGames` prop contract to accept the same row state as `InfoPanel.tsx`. Include the existing platform-support command-signature assertion in the migration.

### Renderer confirmation and recovery

Carry the row's stamp and revision alongside its displayed name, including in the Files preview selector's row state. Freeze the row snapshot when confirmation opens; an unloaded row has no delete action. On a typed stale refusal, roll back the optimistic count first, invalidate the cached list, show a localized message explaining that no game was removed and the list changed, and return successfully to the existing `ConfirmModal` so it closes. Then refresh the count against the still-current tab/file identity; a failed refresh retains the rollback count and reports its error, without making the old row deletable or silently retrying deletion. Other failures retain their existing modal error behavior. Reuse an existing count-refresh owner pattern or extract the common guarded count-update operation where the second approximately similar implementation appears. A stale result cannot resurrect a closed or switched tab.

### Proof

Native tests cover an external insertion before the selected index, same-text duplicate movement, editing the selected game, an unchanged success, and a missing row. Renderer tests exercise the actual selector page-load callback through its mocked hook, assert the snapshot arguments at confirmation, change the row while that confirmation is open and prove the original snapshot is still submitted, cover stale notification and list/count recovery, and verify an unloaded row's disabled delete action. A confirmation integration test asserts that a typed stale refusal closes while ordinary errors remain retryable. Test all `read_games` consumers, generated bindings, and the updated E2E mock payload. `pnpm verify:app` is a real-app smoke check for the changed IPC boundary, not an acceptance assertion for stale deletion; its existing stale-file timing failure is reported separately.

## Decisions and trade-offs

Use the existing game stamp plus a file revision for delete. Stamp alone cannot distinguish equal-text duplicates after a file edit; revision also means an unrelated edit can require a fresh confirmation, which is safer than removing an unintended row. Do not introduce a separate `game_stamps` command: it would require a second read that could disagree with the text the user saw.

## Risks / open questions

The current `verify:app` stale-file scenario has a separate open timing failure (`f-20260924-06`); a failure there is reported accurately rather than treated as proof for this change.

## Not part of this task

The separate verifier and Windows-gate findings `f-20260924-06` and `f-20260924-07`; unrelated PGN paging and import limits.

## Phases

1. **PGN list/delete contract and renderer recovery** — coupled Rust command, generated binding, all renderer consumers and mocks, localized feedback, and focused native/renderer tests. Sensitive API and file mutation path; executor `gemini` routes write work to Codex and read-only review to Gemini. Proof: `cargo test --manifest-path src-tauri/Cargo.toml pgn::tests --locked`, `pnpm exec vitest run src/components/panels/info/GameSelector.test.tsx src/components/panels/info/InfoPanel.test.tsx src/components/files/FileCard.test.tsx src/components/tabs/ImportModal.test.tsx src/platform/tauri.test.ts`, `pnpm bindings:check`, `pnpm lint:ci`, and `pnpm test:e2e:container`. Run `pnpm verify:app` for real IPC smoke evidence; the known `f-20260924-06` timeout is a separately tracked limit, not stale-deletion proof.

## Reviews

Round 1: six Gemini lenses completed. `review-plan`, `review-tests`, and `review-error-handling` returned REVISE; the other three returned APPROVED with actionable notes. Raw reports: `/tmp/chessfable-f-20260924-05/lens-review-*-r1.txt`. Candidate revision r1 is retained at `/tmp/chessfable-f-20260924-05/plan-r1.md`.

* P1 (Fix, open): migrate every `read_games` consumer and mock, including `e2e/fixtures.ts`, `src/platform/tauri.test.ts`, and FileCard row state. Witnesses: review-plan blocker/should-fix, review-ipc-contract nit, review-tests blocker. Corrected in r2 Row identity; closure check pending.
* P2 (Fix, open): stale deletion must close `ConfirmModal` while ordinary errors remain retryable. Witnesses: review-plan should-fix, review-tests blocker, review-error-handling blocker, review-ipc-contract should-fix. Corrected in r2 Renderer confirmation; closure check pending.
* P3 (Fix, open): missing row and scan-to-commit changes must reach the renderer as typed `StaleGame`; delete IPC must carry revision. Witnesses: review-error-handling blocker, review-ipc-contract should-fix. Corrected in r2 Row identity; closure check pending.
* P4 (Fix, open): a failed count refresh must retain the pre-delete count; a stale response must not resurrect a tab. Witnesses: review-error-handling should-fix, review-minimalism should-fix. Corrected in r2 Renderer confirmation; closure check pending.
* P5 (Fix, open): exercise actual page-loading and confirmation paths, with snapshot arguments and a meaningful verifier claim. Witnesses: review-tests blocker/should-fix, review-error-handling should-fix. Corrected in r2 Proof; closure check pending.
* P6 (Skip): the scan-to-commit race test exercises an existing invariant and is not needed to prove this stale-list mandate; removed from acceptance. Witness: review-tests nit.
* P7 (Skip): an additional native item type and a one-variant delete expectation enum would duplicate existing contracts; the plan uses `StampedGame` and explicit arguments. Witness: review-minimalism nits.

Round 2: the mandatory Gemini `review-plan` attempt ended with provider `RESOURCE_EXHAUSTED`, so its drafted verdict is not counted as coverage. A normal-route Gemini retry completed; all five required correction lenses closed P1–P5 and returned APPROVED. Raw reports are `/tmp/chessfable-f-20260924-05/lens-review-*-r2.txt`, with the valid plan report at `lens-review-plan-r2b.txt`. Candidate revision r2 is retained at `/tmp/chessfable-f-20260924-05/plan-r2.md`.

* P8 (Fix, open): snapshot-argument tests must change a row during an open confirmation, or a dynamic lookup of the replacement row can pass. Witness: review-tests r2 should-fix, confidence 85. Corrected in r3 Proof; closure check pending.
* P9 (Fix, open): `FileInfo.tsx` receives `InfoPanel`'s `setGames` and must accept the structured row map. Witness: review-plan r2b should-fix, confidence 85. Corrected in r3 Row identity; closure check pending.

Round 3: `review-plan` and `review-tests` completed on Gemini, both APPROVED. Both explicitly closed P8 and P9 against r3 and found no new issue. Raw reports: `/tmp/chessfable-f-20260924-05/lens-review-plan-r3.txt` and `/tmp/chessfable-f-20260924-05/lens-review-tests-r3.txt`. All P1-P5 and P8-P9 are closed on the final revision. This paragraph records verdicts only; no behavior or proof obligation changed after review.

## Raw lens reports

### Round 1: review-error-handling

### Scope and Acceptance Review

Judged against MANDATE (`f-20260924-05`): the plan's Proof section contains only native and renderer test coverage necessary to verify stale row refusal, snapshot propagation, refusal notification, list/count recovery, and regression checks for all migrated `read_games` consumers. Nothing in the Proof section expands scope beyond MANDATE.

---

### Findings

[blocker] src/components/common/ConfirmModal.tsx:49 — `onConfirm` rejection is caught by `ConfirmModal`, which bypasses `onClose()` and surfaces `Common.ConfirmationError.unexpected` ("The action could not be completed. Please try again."), leaving the modal open and prompting the user to retry deletion on stale data rather than closing and notifying the user as required by the plan (confidence: 94)

[blocker] src-tauri/src/pgn.rs:1224 — missing rows return `Error::InvalidInput` and commit-window races return `Error::Conflict` (`src-tauri/src/pgn.rs:1081`) instead of `Error::StaleGame`, causing the frontend to misclassify them as ordinary failures, restore a stale count via optimistic rollback, and retain a desynchronized cache without refreshing (confidence: 91)

[should-fix] src/components/panels/info/InfoPanel.tsx:285 — stale refusal recovery calls `countPgnGames` without rolling back the optimistic decrement (`predictedCount = originalCount - 1`) if the count refresh fails (e.g. file unreadable or deleted), permanently desynchronizing `numGames` in `tabsAtom` (confidence: 88)

[should-fix] src/platform/errors.ts:38 — `ErrorCategory::StaleGame` is mapped to generic `validation` and lacks a localized i18next key explaining that no game was removed and the list changed; standard surfacing exposes the raw English backend string `"The game changed on disk"` while modal surfacing degrades to generic `"Please try again"` (confidence: 86)

[should-fix] src/components/panels/info/GameSelector.tsx:174 — delete action button remains clickable for unloaded virtual rows (`game` is `undefined`), but the plan does not define whether the action fails closed in the UI or how confirmation without stamp/revision is rejected and communicated to the caller (confidence: 82)

VERDICT: REVISE

### Round 1: review-ipc-contract

[should-fix] src-tauri/src/pgn.rs:1224 ↔ src/components/panels/info/InfoPanel.tsx:285 — IPC Error Category contract for stale deletion: missing row (`n >= games.len()`) and revision mismatch must serialize as `Error::StaleGame` (`backendCategory: "stale-game"`). Currently in `delete_game_core`, an out-of-bounds index produces `Error::InvalidInput`, and `commit_pgn_mutation` produces `Error::Conflict` for revision changes. If `delete_game` uses those variants on rescan, the IPC payload carries `backendCategory: "invalid-input"` or `"conflict"` instead of `"stale-game"`. At runtime, the renderer would fail to recognize a file truncation or structural edit as a stale refusal, bypassing the recovery flow (closing the confirmation modal, invalidating the cached list, and refreshing the count) and leaving the modal open with a generic error ("The action could not be completed. Please try again") (confidence: 92)

[should-fix] src-tauri/src/pgn.rs:1178 ↔ src/components/panels/info/InfoPanel.tsx:285 — IPC command parameter contract for `delete_game`: the plan notes to "reuse the write path's comparison machinery where appropriate", but `WriteExpectation` (`src-tauri/src/pgn.rs:88`) only carries `stamp` without `revision`. Reusing `WriteExpectation` across IPC for `delete_game` would fail to transmit the file revision the user saw. The IPC signature for `delete_game` must explicitly take `revision` (either as separate arguments `file, n, stamp, revision` or via a dedicated expectation struct `DeleteExpectation { stamp: String, revision: String }`) (confidence: 88)

[nit] e2e/fixtures.ts:92 ↔ src/components/files/FileCard.tsx:52 — IPC test fixture payload drift: `e2e/fixtures.ts` mocks `read_games` returning `[filesWorkspaceFixture.pgnGame]` (an array of strings). When `read_games` changes its IPC return shape to return page items containing `{ pgn, stamp, revision }`, this mock must be updated in sync; otherwise Playwright container tests running against mocked scenarios will receive strings, evaluate `item.pgn` as `undefined`, and fail at runtime (confidence: 85)

### Scope check against MANDATE
All items in the plan are required by MANDATE `f-20260924-05` to provide row identity, reject deletions on modified files, and migrate existing `read_games` callers. No scope expansion was introduced.

VERDICT: APPROVED

### Round 1: review-minimalism

[should-fix] src/components/boards/BoardAnalysis.tsx:165 — `refreshFileCount` is implemented inline to query `countPgnGames` and update tab game count while guarding against tab closure and origin switch. The plan requires `InfoPanel.tsx` to refresh game count with tab-resurrection guards on stale delete refusal; extract this into a shared unit in `src/utils/tabs.ts` rather than adding a second near-identical copy (confidence: 88)

[nit] src-tauri/src/pgn.rs:79 — `StampedGame` already represents a row snapshot with `{ pgn, stamp, revision, present }`; `read_games` should return `Vec<StampedGame>` directly rather than introducing a redundant page-item struct that duplicates existing types in Rust and Specta bindings (confidence: 85)

[nit] src-tauri/src/pgn.rs:1178 — `delete_game` only targets existing rows (no `Append` variant); pass `stamp` and `revision` directly rather than introducing a single-variant `DeleteExpectation` enum abstraction without a second caller (confidence: 82)

VERDICT: APPROVED

### Round 1: review-pgn-index

### Lens Assessment: PGN Scanning and Database Indexing

The candidate plan `tasks/plans/2026-09-25-stale-game-delete.md` was reviewed against `MANDATE: f-20260924-05` and repository invariants in [`.claude/rules/pgn-scanning.md`](file:///home/felixb/Projekte/chessfable/.claude/rules/pgn-scanning.md) and [`src-tauri/src/pgn.rs`](file:///tmp/chessfable-f-20260924-05/wt-lens-review-pgn-index-r1/src-tauri/src/pgn.rs).

#### 1. Disk & Reader Invariants
- **Game Boundaries & Delimiters**: The plan reuses the existing byte-range scanner [`scan_games_cancelled`](file:///tmp/chessfable-f-20260924-05/wt-lens-review-pgn-index-r1/src-tauri/src/pgn.rs#L532-L605) via [`scan_current`](file:///tmp/chessfable-f-20260924-05/wt-lens-review-pgn-index-r1/src-tauri/src/pgn.rs#L629-L670). Boundary detection remains BOM-, CRLF-, and brace-comment-aware; no duplicate or raw string split is introduced.
- **Offset & Reader Origin**: [`scan_and_read_ranges`](file:///tmp/chessfable-f-20260924-05/wt-lens-review-pgn-index-r1/src-tauri/src/pgn.rs#L739-L774) reads exact ranges (`[range.start..range.end)`) from the snapshot. BOM offset (`start = 3`) and byte boundaries are preserved through both [`read_games`](file:///tmp/chessfable-f-20260924-05/wt-lens-review-pgn-index-r1/src-tauri/src/pgn.rs#L916-L962) and atomic mutation in [`edit_existing`](file:///tmp/chessfable-f-20260924-05/wt-lens-review-pgn-index-r1/src-tauri/src/pgn.rs#L818-L869).
- **Encode/Decode Symmetry & Game Stamps**: The plan enforces reusing the write path's SHA-256 [`game_stamp`](file:///tmp/chessfable-f-20260924-05/wt-lens-review-pgn-index-r1/src-tauri/src/pgn.rs#L776-L778) on raw range bytes. The hash computed on readback and verified during [`commit_pgn_mutation`](file:///tmp/chessfable-f-20260924-05/wt-lens-review-pgn-index-r1/src-tauri/src/pgn.rs#L1062-L1174) matches byte-for-byte across line endings.
- **Cache Coherence**: Mutation under [`edit_lock`](file:///tmp/chessfable-f-20260924-05/wt-lens-review-pgn-index-r1/src-tauri/src/pgn.rs#L355-L367) invalidates the file identity via [`PgnRepository::invalidate`](file:///tmp/chessfable-f-20260924-05/wt-lens-review-pgn-index-r1/src-tauri/src/pgn.rs#L425-L434); atomic replacement installs a new inode and revision, preventing cache drift or silent fallback to game 0.
- **Streaming & Materialization**: Page reads in [`read_games`](file:///tmp/chessfable-f-20260924-05/wt-lens-review-pgn-index-r1/src-tauri/src/pgn.rs#L916) remain bounded by [`checked_range`](file:///tmp/chessfable-f-20260924-05/wt-lens-review-pgn-index-r1/src-tauri/src/pgn.rs#L676-L686) (`MAX_PAGE_LEN = 1_000`); no whole-file materialization is introduced.

#### 2. Mandate & Acceptance Check
- **Evaluation against MANDATE**: The plan's Proof criteria directly match the mandate (`f-20260924-05`). Checking both `stamp` and `revision` under the native edit lock is strictly necessary to prevent silent deletion when same-text duplicate games shift positions due to structural edits.
- **Scope Compliance**: Nothing in the plan expands scope beyond the requirements of `f-20260924-05`. The migration of [`FileCard.tsx`](file:///tmp/chessfable-f-20260924-05/wt-lens-review-pgn-index-r1/src/components/files/FileCard.tsx#L52) and [`ImportModal.tsx`](file:///tmp/chessfable-f-20260924-05/wt-lens-review-pgn-index-r1/src/components/tabs/ImportModal.tsx#L77) is necessary correctness to avoid breaking existing consumers of the updated [`read_games`](file:///tmp/chessfable-f-20260924-05/wt-lens-review-pgn-index-r1/src-tauri/src/pgn.rs#L916) command.

No blockers, should-fix issues, or nits found within this lens.

VERDICT: APPROVED

### Round 1: review-plan

[blocker] tasks/plans/2026-09-25-stale-game-delete.md:13 — plan updates consumers of `read_games` to expect `{ pgn, stamp, revision }` items instead of raw strings, but omits E2E test mock `read_games: { result: [filesWorkspaceFixture.pgnGame] }` ([e2e/fixtures.ts:92](file:///tmp/chessfable-f-20260924-05/wt-lens-review-plan-r1/e2e/fixtures.ts#L92)), which feeds [e2e/file-freshness.spec.ts:23](file:///tmp/chessfable-f-20260924-05/wt-lens-review-plan-r1/e2e/file-freshness.spec.ts#L23), [e2e/database-files.spec.ts:22](file:///tmp/chessfable-f-20260924-05/wt-lens-review-plan-r1/e2e/database-files.spec.ts#L22), and [e2e/async-errors.spec.ts:142](file:///tmp/chessfable-f-20260924-05/wt-lens-review-plan-r1/e2e/async-errors.spec.ts#L142); when [FileCard.tsx:56](file:///tmp/chessfable-f-20260924-05/wt-lens-review-plan-r1/src/components/files/FileCard.tsx#L56) is updated to read `data[0].pgn`, it will evaluate to `undefined` on the raw strings returned by `e2e/fixtures.ts`, causing `pnpm test:e2e:container` (tasks/plans/2026-09-25-stale-game-delete.md:37) to fail
(confidence: 95)

[blocker] tasks/plans/2026-09-25-stale-game-delete.md:13 — plan changes `read_games` return type from `Vec<String>` to structured stamped items and regenerates bindings, but unaddressed consumer [src/platform/tauri.test.ts:148](file:///tmp/chessfable-f-20260924-05/wt-lens-review-plan-r1/src/platform/tauri.test.ts#L148) mocks `commands.readGames` returning `{ status: "ok", data: ['[Event "A"]'] }`; `tsgo --noEmit` run by `pnpm lint:ci` (tasks/plans/2026-09-25-stale-game-delete.md:37) checks all files in `src/` per [tsconfig.json:22](file:///tmp/chessfable-f-20260924-05/wt-lens-review-plan-r1/tsconfig.json#L22) and will reject `string[]` against the new `StampedGame[]` binding signature
(confidence: 90)

[should-fix] tasks/plans/2026-09-25-stale-game-delete.md:17 — plan requires closing the confirmation dialog on stale refusal, but [ConfirmModal.tsx:47-50](file:///tmp/chessfable-f-20260924-05/wt-lens-review-plan-r1/src/components/common/ConfirmModal.tsx#L47-L50) catches any thrown error and suppresses `onClose()` to show an inline retry state; if `deleteGame` rethrows a stale refusal like an ordinary failure, the modal will remain open with an active confirmation button instead of closing
(confidence: 85)

[should-fix] tasks/plans/2026-09-25-stale-game-delete.md:17 — plan requires `GameSelector` to carry the row's stamp and revision alongside its name, but [FileCard.tsx:39](file:///tmp/chessfable-f-20260924-05/wt-lens-review-plan-r1/src/components/files/FileCard.tsx#L39) maintains `games: Map<number, string>` and passes it to `<GameSelector />` ([FileCard.tsx:99](file:///tmp/chessfable-f-20260924-05/wt-lens-review-plan-r1/src/components/files/FileCard.tsx#L99)); `FileCard`'s state type must be updated to the new row structure along with `GameSelector` to satisfy TypeScript checks during `pnpm lint:ci`
(confidence: 85)

[nit] tasks/plans/2026-09-25-stale-game-delete.md:37 — plan includes `pnpm verify:app` unconditionally in the Phase 1 proof command, but line 29 notes that `verify:app` currently suffers from open timing failure `f-20260924-06`; running `verify:app` as a hard gate without qualifying the known failure will cause phase verification to fail on environments reproducing `f-20260924-06`
(confidence: 80)

VERDICT: REVISE

### Round 1: review-tests

[blocker] /home/felixb/Projekte/chessfable/tasks/plans/2026-09-25-stale-game-delete.md:21 — MANDATE requires that the game list carry what the user saw, but [GameSelector.tsx](file:///tmp/chessfable-f-20260924-05/wt-lens-review-tests-r1/src/components/panels/info/GameSelector.tsx#L39-L50)'s `loadPage` callback (which queries `read_games` and maps `{ pgn, stamp, revision }` into row state) is completely mocked out in [GameSelector.test.tsx:13](file:///tmp/chessfable-f-20260924-05/wt-lens-review-tests-r1/src/components/panels/info/GameSelector.test.tsx#L13) via `vi.mock("@/hooks/useVirtualPageLoader")` and mocked out in [InfoPanel.test.tsx:70](file:///tmp/chessfable-f-20260924-05/wt-lens-review-tests-r1/src/components/panels/info/InfoPanel.test.tsx#L70) via `vi.mock("./GameSelector")`. A revert dropping `stamp` and `revision` from `loadPage` leaves all proposed Vitest runs green. (confidence: 95)

[blocker] /home/felixb/Projekte/chessfable/tasks/plans/2026-09-25-stale-game-delete.md:17 — MANDATE requires that the user be told of a refusal, and the plan specifies closing the confirmation dialog and preventing retries on a stale refusal; however, [ConfirmModal.tsx:49](file:///tmp/chessfable-f-20260924-05/wt-lens-review-tests-r1/src/components/common/ConfirmModal.tsx#L49) leaves the dialog open and enables retry whenever `onConfirm()` rejects, while [InfoPanel.test.tsx:70](file:///tmp/chessfable-f-20260924-05/wt-lens-review-tests-r1/src/components/panels/info/InfoPanel.test.tsx#L70) mocks out `GameSelector` (and thus `ConfirmModal`) entirely and [GameSelector.test.tsx:130](file:///tmp/chessfable-f-20260924-05/wt-lens-review-tests-r1/src/components/panels/info/GameSelector.test.tsx#L130) explicitly tests that errors keep the dialog open for retry. If [InfoPanel.tsx:304](file:///tmp/chessfable-f-20260924-05/wt-lens-review-tests-r1/src/components/panels/info/InfoPanel.tsx#L304) rethrows a stale refusal, the modal remains open with a retry button in production, yet both unit tests would pass. (confidence: 92)

[should-fix] /tmp/chessfable-f-20260924-05/wt-lens-review-tests-r1/src/components/panels/info/GameSelector.test.tsx:126 — Implementation lock-in on call counts: `GameSelector.test.tsx` asserts only `expect(deleteGame).toHaveBeenCalledTimes(1)` without asserting the snapshot arguments `{ stamp, revision }` passed to `deleteGame`. A regression passing only `index` or an empty object to `deleteGame` satisfies `GameSelector.test.tsx`, while `InfoPanel.test.tsx` tests only its own hardcoded mock arguments. (confidence: 90)

[should-fix] /home/felixb/Projekte/chessfable/tasks/plans/2026-09-25-stale-game-delete.md:21 — Claimed coverage without evidence: the plan cites `pnpm verify:app` to verify "the real Tauri app flow when the verifier can reach it", but inspection of [scripts/verify-app.mjs](file:///tmp/chessfable-f-20260924-05/wt-lens-review-tests-r1/scripts/verify-app.mjs#L19) reveals it has zero checks for deleting games or stale deletion refusals. Citing it as verification for this change is empty theater. (confidence: 94)

[nit] /home/felixb/Projekte/chessfable/tasks/plans/2026-09-25-stale-game-delete.md:21 — Scope boundary: "mutation during the native scan-to-commit window" tests the pre-existing atomic replacement check in `commit_pgn_mutation` ([src-tauri/src/pgn.rs:1081](file:///tmp/chessfable-f-20260924-05/wt-lens-review-tests-r1/src-tauri/src/pgn.rs#L1081)), which was already in place and is not required by MANDATE `f-20260924-05` (which addresses stale lists from an earlier read). (confidence: 85)

VERDICT: REVISE

### Round 2: review-error-handling

### Scope and Acceptance Review

Judged against MANDATE (`f-20260924-05`): the plan's revised Proof section in r2 verifies:
1. Native stale refusal across structural changes (external insertion, duplicate movement, in-place edit, and missing row).
2. Renderer snapshot capture at confirmation, unloaded row handling, and list/count recovery.
3. Explicit confirmation modal closure on typed stale refusal while preserving retryability on ordinary failures.
4. Regression coverage for all migrated `read_games` callers, bindings, and E2E mock fixtures.
5. Accurate scoping of `pnpm verify:app` as a smoke check for the IPC boundary rather than acceptance proof for stale deletion.

Nothing in the revised Proof section expands scope beyond MANDATE.

---

### Correction Check and Prior Issue Dispositions

Prior Round 1 Raw Verdict: **REVISE**

#### Prior Issue P1 (Row identity & consumer migration)
* **Obligation:** Migrate every `read_games` consumer and mock (`FileCard.tsx`, `ImportModal.tsx`, `src/platform/tauri.test.ts`, and `e2e/fixtures.ts`).
* **Delta evaluation:** r2 Row identity and Phases explicitly schedule migrating `FileCard` preview selector row state, `ImportModal` extraction of `.pgn`, `src/platform/tauri.test.ts`, and `e2e/fixtures.ts`.
* **Disposition:** **CLOSED**

#### Prior Issue P2 / Lens Blocker 1 (`src/components/common/ConfirmModal.tsx:49`)
* **Obligation:** Stale deletion must close `ConfirmModal` and notify the user rather than leaving the modal open on a generic retry prompt.
* **Delta evaluation:** r2 specifies that on a typed stale refusal, the renderer rolls back the count, invalidates cached games, notifies the user, and resolves (`return successfully`) to `ConfirmModal`. Because `ConfirmModal.confirm()` invokes `await onConfirm(); onClose();`, resolving triggers `onClose()` and cleanly dismisses the modal. Ordinary errors continue to reject and retain `ConfirmModal`'s existing error surfacing and retry capability. A confirmation integration test is added to acceptance.
* **Disposition:** **CLOSED**

#### Prior Issue P3 / Lens Blocker 2 (`src-tauri/src/pgn.rs:1224`)
* **Obligation:** Missing rows and scan-to-commit changes during deletion must reach the renderer as typed `StaleGame` rather than generic `InvalidInput` or `Conflict`.
* **Delta evaluation:** r2 Row identity explicitly mandates: "For deletion, a missing row or a scan-to-commit snapshot change is also `StaleGame`; no such refusal changes the file." Native proof explicitly adds a missing row test case.
* **Disposition:** **CLOSED**

#### Prior Issue P4 / Lens Should-Fix 1 (`src/components/panels/info/InfoPanel.tsx:285`)
* **Obligation:** Count refresh failure during stale recovery must not permanently desynchronize the tab's game count.
* **Delta evaluation:** r2 specifies rolling back the optimistic decrement to the pre-delete count *first*, before triggering the background count refresh. If count refresh fails, the tab retains the rollback count and reports the refresh error, preventing count desynchronization or unintended deletability.
* **Disposition:** **CLOSED**

#### Prior Lens Should-Fix 2 (`src/platform/errors.ts:38`)
* **Obligation:** Surface a localized, actionable notification rather than raw backend string `"The game changed on disk"` or modal `"Please try again"`.
* **Delta evaluation:** r2 specifies showing a localized message explaining that no game was removed and the list changed upon encountering a typed stale refusal, and includes `src/translation/*.json` in phase migration.
* **Disposition:** **CLOSED**

#### Prior Lens Should-Fix 3 (`src/components/panels/info/GameSelector.tsx:174`)
* **Obligation:** Unloaded virtual rows (`game === undefined`) must fail closed in the UI.
* **Delta evaluation:** r2 specifies: "an unloaded row has no delete action" and includes proof verifying "an unloaded row's disabled delete action."
* **Disposition:** **CLOSED**

#### Prior Issue P5 (Proof coverage)
* **Obligation:** Real selector page-load callback and confirmation argument verification.
* **Delta evaluation:** r2 Proof exercises the page-load callback via the mocked hook, asserts snapshot arguments at confirmation, adds the modal integration test, and scopes `pnpm verify:app`.
* **Disposition:** **CLOSED**

---

### New Findings

No new error-handling defects or swallowed failure paths identified in candidate revision r2.

---

VERDICT: APPROVED

### Round 2: review-ipc-contract

### Closure check for prior issues

* **P1 (Fix, open → Closed):** r2 explicitly specifies migrating every consumer of `read_games` (`GameSelector.tsx`, `FileCard.tsx`, and `ImportModal.tsx`) to use the `StampedGame` item's PGN text, migrating their mocks, updating `src/platform/tauri.test.ts`, and updating the `read_games` mock in `e2e/fixtures.ts` to supply `StampedGame` payloads.
* **P2 (Fix, open → Closed):** r2 specifies that on a typed stale refusal (`backendCategory: "stale-game"`), the handler rolls back optimistic count, invalidates the cached list, shows a localized notification, and returns successfully to `ConfirmModal` so `confirm()` calls `onClose()`. Ordinary errors remain rethrown so `ConfirmModal` keeps its retryable error state.
* **P3 (Fix, open → Closed):** r2 explicitly defines the IPC command contract for `delete_game` to take the selected row's `stamp` and `revision` as explicit IPC arguments (`file`, `n`, `stamp`, `revision`). On the native side, missing rows (`n >= games.len()`) and scan-to-commit snapshot mismatches are both required to return `Error::StaleGame`, guaranteeing serialization across IPC as `ErrorPayload.category == "stale-game"`.
* **P4 (Fix, open → Closed):** r2 specifies that optimistic count rollback occurs before count refresh, failed count refresh retains the rollback count, and refresh results are guarded by tab/file identity so stale IPC responses cannot resurrect a closed or switched tab.
* **P5 (Fix, open → Closed):** r2 includes verification across the updated IPC contract: testing all `read_games` consumers, Specta generated bindings (`pnpm bindings:check`), the updated E2E mock payload (`e2e/fixtures.ts`), and using `pnpm verify:app` as a smoke check for the changed IPC boundary.

### New findings

None. The IPC boundary contract across Rust commands (`read_games`, `delete_game`), Specta type bindings (`StampedGame`), error payload categorization (`Error::StaleGame` ↔ `backendCategory: "stale-game"`), and renderer consumers/mocks is fully specified and consistent.

### Scope check against MANDATE

All planned changes (row identity via `StampedGame`, explicit `stamp` and `revision` arguments for `delete_game`, typed `StaleGame` error signaling, and consumer/mock migrations) are strictly required to fulfill MANDATE `f-20260924-05`. No scope expansion was introduced.

VERDICT: APPROVED

### Round 2: review-minimalism

### Closure of Prior Issues

* **P4 (Prior `should-fix`, `src/components/boards/BoardAnalysis.tsx:165`): CLOSED**
  * *Prior finding:* `refreshFileCount` is implemented inline in `BoardAnalysis.tsx:165` to query `countPgnGames` and update tab count with tab-closure/origin-switch guards. Adding a second inline count refresh in `InfoPanel.tsx` on stale delete refusal would introduce a second near-identical copy.
  * *Correction check:* Plan r2 in "Renderer confirmation and recovery" explicitly specifies: *"Reuse an existing count-refresh owner pattern or extract the common guarded count-update operation where the second approximately similar implementation appears. A stale result cannot resurrect a closed or switched tab."* This satisfies the deduplication invariant without adding speculative abstractions before the second caller is integrated.

* **P7 (Prior `nits`, `src-tauri/src/pgn.rs:79`, `src-tauri/src/pgn.rs:1178`): CLOSED**
  * *Prior findings:* Reusing existing `StampedGame` instead of introducing a redundant page-item struct; passing `stamp` and `revision` directly to `delete_game` instead of introducing a single-variant `DeleteExpectation` enum.
  * *Correction check:* Plan r2 in "Row identity and native commit" explicitly adopts both: *"Return each `read_games` page item as the existing `StampedGame` with its PGN text, exact game stamp, and file revision from the same native scan/read snapshot"* and *"Make `delete_game` require the selected row's stamp and revision as explicit IPC arguments."*

* **P1, P2, P3, P5 (Scope & Minimalism Check against MANDATE): NO DEFECTS**
  * **P1:** Migrating existing consumers and mocks (`FileCard`, `ImportModal`, `e2e/fixtures.ts`, `src/platform/tauri.test.ts`, platform support signature checks) is the minimal necessary update required by the `read_games` IPC return type change. No superfluous files or adapters are added.
  * **P2:** Reuses existing `ConfirmModal` resolution mechanics (returning successfully on handled stale refusal to close the modal while rethrowing unhandled errors to allow retry), avoiding new modal state wrappers.
  * **P3:** Reuses typed `StaleGame` error for missing rows and scan-to-commit mutations without introducing redundant error variants.
  * **P5:** Tests are strictly scoped to mandate verification (native refusal cases, snapshot parameter forwarding, confirm modal dismissal vs retry, unloaded row safety) without speculative test harnesses.

---

### New Findings

No bloat, unnecessary abstraction, speculative configurability, or duplication defects identified in revision r2.

---

VERDICT: APPROVED

### Round 2: review-tests

### Prior Issue Closures (Correction Check: r1 → r2)

* **P1 (Migrate every `read_games` consumer, mocks, and row state): CLOSED**
  * *Evidence:* `Row identity and native commit` now explicitly types `read_games` as `StampedGame`, mandates migration of the Files preview (`FileCard.tsx`), import (`ImportModal.tsx`), and their tests, as well as `src/platform/tauri.test.ts`, `e2e/fixtures.ts`, and the platform-support command signature assertion. Phase 1 proof gates include `FileCard.test.tsx`, `ImportModal.test.tsx`, `tauri.test.ts`, `pnpm bindings:check`, and `pnpm test:e2e:container`. A signature mismatch or unmigrated mock will fail compilation or Vitest/E2E gates.
* **P2 (Stale deletion must close `ConfirmModal` while ordinary errors remain retryable): CLOSED**
  * *Evidence:* `Renderer confirmation and recovery` specifies returning successfully from the `deleteGame` handler on a typed stale refusal so `ConfirmModal` executes `onClose()`, while rethrowing ordinary errors so `ConfirmModal` catches them, displays the error message, and enables retry. `Proof` explicitly requires: "A confirmation integration test asserts that a typed stale refusal closes while ordinary errors remain retryable." Reverting either path directly fails this integration assertion.
* **P3 (Missing row and scan-to-commit changes must reach renderer as typed `StaleGame`; delete IPC carries revision): CLOSED**
  * *Evidence:* `Row identity and native commit` requires explicit `stamp` and `revision` IPC arguments for `delete_game`, and specifies that missing rows and scan-to-commit snapshot mismatches return `StaleGame` without file mutation. `Proof` adds native tests for external insertion before index, same-text duplicate movement, editing the selected game, missing row, and unchanged success. Reverting native checks fails the corresponding test case.
* **P4 (Failed count refresh retains pre-delete count; stale response cannot resurrect tab): CLOSED**
  * *Evidence:* `Renderer confirmation and recovery` specifies optimistic count rollback before attempting the native count refresh. If refresh fails, the rollback count is retained and the error reported without enabling retry or silent re-deletion. Reused tab/file identity guards prevent resurrecting closed or switched tabs. `Proof` covers list and count recovery.
* **P5 (Exercise actual page-loading and confirmation paths, with snapshot arguments and meaningful verifier claim): CLOSED**
  * *Evidence:* `Proof` explicitly requires exercising the actual `loadPage` callback through the mocked `useVirtualPageLoader` hook, verifying that `stamp` and `revision` are mapped from `read_games` into row state. Vitest tests assert snapshot arguments `{ stamp, revision }` at confirmation rather than call counts alone. `pnpm verify:app` is reclassified as real-app smoke evidence for the IPC boundary, removing the unevidenced acceptance claim.

---

### Scope Expansion Check
Judged against MANDATE `f-20260924-05`:
* Native test acceptance criteria in `Proof` strictly cover external insertion, duplicate movement, editing selected game, missing row, and unchanged success. The scan-to-commit race test identified in r1 as existing coverage was removed from acceptance (P6 Skip).
* Migration of `read_games` callers, Specta bindings, and mocks is necessary type/compiler breakage resolution for changing the return shape to `StampedGame`.
* No scope expansion detected.

---

### Findings

[should-fix] /home/felixb/Projekte/chessfable/tasks/plans/2026-09-25-stale-game-delete.md:21 — Missing anchor for snapshot freeze during concurrent row mutation: line 17 specifies to "freeze the row snapshot when confirmation opens", but line 21's proof only specifies "assert the snapshot arguments at confirmation" without asserting that a row update while confirmation is open preserves the initial snapshot. A test asserting snapshot arguments on a static list would pass even if the implementation dynamically reads `games.get(index)` inside `onConfirm`. If the row at `index` updates while confirmation is open, the dynamic lookup would submit the newly arrived game rather than the game the user confirmed. (confidence: 85)

---

VERDICT: APPROVED

### Round 2 valid plan retry: review-plan

### Scope and Acceptance Review

Judged against **MANDATE** (`f-20260924-05`):
* The plan requires native `delete_game` to take the row's `stamp` and `revision` as explicit IPC arguments and verify them under the edit lock against the current rescan snapshot.
* Refusal semantics for out-of-bounds rows (`n >= games.len()`) and scan-to-commit mutations are unified to typed `StaleGame` without file modification.
* The renderer captures a frozen snapshot of the row when confirmation opens, disables delete on unloaded rows, rolls back optimistic state on stale refusal, closes `ConfirmModal`, and shows localized feedback before attempting tab/file-guarded count recovery.
* Consumer and mock migrations across `FileCard.tsx`, `ImportModal.tsx`, `src/platform/tauri.test.ts`, and `e2e/fixtures.ts` are strictly the necessary adjustments required by typing `read_games` as `StampedGame`.
* Acceptance criteria in `Proof` directly verify the mandate requirements without scope expansion.

---

### Prior Issue Closures (Correction Check: r1 → r2)

* **P1 (Migrate every `read_games` consumer, mocks, and row state): CLOSED**
  * *Evidence:* `Row identity and native commit` (lines 11–13) explicitly specifies that `read_games` returns `StampedGame`, and mandates migrating `FileCard.tsx` (row state and preview read), `ImportModal.tsx`, `src/platform/tauri.test.ts`, and `e2e/fixtures.ts`, alongside the platform-support command signature check. Phase 1 proof gates include `FileCard.test.tsx`, `ImportModal.test.tsx`, `src/platform/tauri.test.ts`, `pnpm bindings:check`, and `pnpm test:e2e:container`.
* **P2 (Stale deletion must close `ConfirmModal` while ordinary errors remain retryable): CLOSED**
  * *Evidence:* `Renderer confirmation and recovery` (line 17) explicitly specifies that on a typed stale refusal, the renderer rolls back optimistic count, invalidates the cached list, displays localized notification, and returns successfully to `ConfirmModal`. Because [ConfirmModal.tsx:47-49](file:///tmp/chessfable-f-20260924-05/wt-lens-review-plan-r2b/src/components/common/ConfirmModal.tsx#L47-L49) calls `await onConfirm(); onClose();`, resolving triggers `onClose()` to dismiss the dialog. Ordinary errors continue to reject, keeping `ConfirmModal`'s retry state active. `Proof` (line 21) adds a confirmation integration test verifying this exact distinction.
* **P3 (Missing row and scan-to-commit changes must reach renderer as typed `StaleGame`; delete IPC carries revision): CLOSED**
  * *Evidence:* `Row identity and native commit` (lines 11–13) requires `delete_game` to take the selected row's `stamp` and `revision` as explicit IPC arguments (`file, n, stamp, revision`), and mandates that a missing row (`n >= games.len()`) or a scan-to-commit snapshot change returns `StaleGame`. Native proof includes external insertion before index, duplicate movement, editing the selected game, missing row, and unchanged success.
* **P4 (Failed count refresh retains pre-delete count; stale response cannot resurrect tab): CLOSED**
  * *Evidence:* `Renderer confirmation and recovery` (line 17) mandates rolling back the optimistic count decrement *first*. If native count refresh subsequently fails, the tab retains the rollback count and reports the error without re-enabling delete or retrying. Tab/file identity guards ensure a delayed response cannot resurrect a closed or switched tab.
* **P5 (Exercise actual page-loading and confirmation paths, with snapshot arguments and meaningful verifier claim): CLOSED**
  * *Evidence:* `Proof` (line 21) exercises the actual page-load callback through the mocked [useVirtualPageLoader](file:///tmp/chessfable-f-20260924-05/wt-lens-review-plan-r2b/src/hooks/useVirtualPageLoader.ts#L8) hook, asserts frozen snapshot arguments at confirmation, covers stale notification and list/count recovery, and tests an unloaded row's disabled delete action. `pnpm verify:app` is explicitly scoped as real-app smoke evidence for the IPC boundary rather than an unevidenced acceptance proof for stale deletion.

---

### New Findings

[should-fix] tasks/plans/2026-09-25-stale-game-delete.md:17 — plan updates the row state passed through `games` to carry stamp and revision, but omits [FileInfo.tsx:17](file:///tmp/chessfable-f-20260924-05/wt-lens-review-plan-r2b/src/components/panels/info/FileInfo.tsx#L17) from `FILES` and migration scope; `FileInfo` declares `setGames: React.Dispatch<React.SetStateAction<Map<number, string>>>` and receives `setGames` directly from [InfoPanel.tsx:55](file:///tmp/chessfable-f-20260924-05/wt-lens-review-plan-r2b/src/components/panels/info/InfoPanel.tsx#L55), which will trigger a TypeScript type mismatch error under `pnpm lint:ci` (`tsgo --noEmit`) when `InfoPanel`'s `games` state is updated to the structured row type unless `FileInfo.tsx`'s prop type is updated to accept the new map value type (or made generic / `() => void`)
(confidence: 85)

---

VERDICT: APPROVED

### Round 3: review-plan

### Scope and Acceptance Review

Judged against **MANDATE** (`f-20260924-05`):
* Native `read_games` returns each page item as [StampedGame](file:///tmp/chessfable-f-20260924-05/wt-lens-review-plan-r3/src-tauri/src/pgn.rs#L79) (carrying PGN text, exact game stamp, and file revision from the scan snapshot).
* Native `delete_game` takes the selected row's `stamp` and `revision` as explicit IPC arguments (`file, n, stamp, revision`) and validates them under the per-file edit lock against the current rescan snapshot.
* Refusal semantics for out-of-bounds rows (`n >= games.len()`) and scan-to-commit mutations are unified to typed `StaleGame` (`Error::StaleGame`) without altering the file on disk.
* The renderer captures a frozen snapshot of the row when confirmation opens, disables delete on unloaded rows, rolls back optimistic state on stale refusal, closes [ConfirmModal](file:///tmp/chessfable-f-20260924-05/wt-lens-review-plan-r3/src/components/common/ConfirmModal.tsx#L22), and displays localized feedback before attempting tab/file-guarded count recovery.
* Consumer and mock migrations across [FileInfo.tsx](file:///tmp/chessfable-f-20260924-05/wt-lens-review-plan-r3/src/components/panels/info/FileInfo.tsx), [FileCard.tsx](file:///tmp/chessfable-f-20260924-05/wt-lens-review-plan-r3/src/components/files/FileCard.tsx), [ImportModal.tsx](file:///tmp/chessfable-f-20260924-05/wt-lens-review-plan-r3/src/components/tabs/ImportModal.tsx), [src/platform/tauri.test.ts](file:///tmp/chessfable-f-20260924-05/wt-lens-review-plan-r3/src/platform/tauri.test.ts), and [e2e/fixtures.ts](file:///tmp/chessfable-f-20260924-05/wt-lens-review-plan-r3/e2e/fixtures.ts) are strictly the necessary adjustments required by typing `read_games` as `StampedGame` and updating the row state map.
* Acceptance criteria in `Proof` directly verify the mandate requirements without scope expansion.

---

### Correction Check: r2 → r3

* **P8 (Snapshot-argument test must mutate row while confirmation is open): CLOSED**
  * *Last reviewed snapshot:* `/tmp/chessfable-f-20260924-05/plan-r2.md`
  * *Final candidate revision:* [2026-09-25-stale-game-delete.md](file:///home/felixb/Projekte/chessfable/tasks/plans/2026-09-25-stale-game-delete.md#L21) (`Proof`, lines 21 & 37)
  * *Corrected mechanism & delta:* The r3 delta updates `Proof` to require that renderer tests:
    `assert the snapshot arguments at confirmation, change the row while that confirmation is open and prove the original snapshot is still submitted, cover stale notification and list/count recovery, and verify an unloaded row's disabled delete action.`
  * *Source trace & verification:* In [GameSelector.tsx:148-154](file:///tmp/chessfable-f-20260924-05/wt-lens-review-plan-r3/src/components/panels/info/GameSelector.tsx#L148-L154), [ConfirmModal](file:///tmp/chessfable-f-20260924-05/wt-lens-review-plan-r3/src/components/common/ConfirmModal.tsx#L47) executes `onConfirm` asynchronously on user confirmation. If an implementation lazily looked up row state at confirm time instead of freezing it when the modal opened, mutating the underlying map entry while the dialog is open would cause the replacement data to be submitted. Asserting that mutating the row while confirmation is open still submits the original snapshot to native `deleteGame` directly proves that snapshot capture occurred at confirmation open time and falsifies late-lookup regressions.
* **P9 (Include `FileInfo.tsx` in `FILES` and migrate `setGames` prop contract): CLOSED**
  * *Last reviewed snapshot:* `/tmp/chessfable-f-20260924-05/plan-r2.md`
  * *Final candidate revision:* [2026-09-25-stale-game-delete.md](file:///home/felixb/Projekte/chessfable/tasks/plans/2026-09-25-stale-game-delete.md#L13) (`Row identity and native commit`, line 13)
  * *Corrected mechanism & delta:* The r3 delta updates `Row identity and native commit` to explicitly require:
    `Update FileInfo.tsx's setGames prop contract to accept the same row state as InfoPanel.tsx.`
    Additionally, `FileInfo.tsx` is included in the plan review file list `FILES`.
  * *Source trace & verification:* [FileInfo.tsx:17](file:///tmp/chessfable-f-20260924-05/wt-lens-review-plan-r3/src/components/panels/info/FileInfo.tsx#L17) currently defines `setGames: React.Dispatch<React.SetStateAction<Map<number, string>>>` and is passed `setGames` directly from [InfoPanel.tsx:55](file:///tmp/chessfable-f-20260924-05/wt-lens-review-plan-r3/src/components/panels/info/InfoPanel.tsx#L55). In `FileInfo.tsx:70`, `setGames(new Map())` is invoked on reload. Updating `FileInfo.tsx`'s prop contract to accept `Map<number, RowState>` (or a generic map reset callback) eliminates the TypeScript mismatch under `pnpm lint:ci` (`tsgo --noEmit`) when `InfoPanel.tsx`'s `games` state transitions to the structured row type.

---

VERDICT: APPROVED

### Round 3: review-tests

### Prior Issue Closures (Correction Check: r2 → r3)

* **P8 (Snapshot freeze under concurrent row mutation): CLOSED**
  * *Evidence:* `tasks/plans/2026-09-25-stale-game-delete.md:21` now explicitly mandates: "change the row while that confirmation is open and prove the original snapshot is still submitted." This directly anchors the snapshot freeze required in line 17. If an implementation reverted to dynamic lookup (`games.get(index)`) during `onConfirm`, mutating the row while the confirmation modal is open would cause the dynamic lookup to submit the newly updated snapshot, failing the assertion that the original pre-confirmation snapshot reaches the native boundary.
* **P9 (`FileInfo.tsx` row-map prop contract): CLOSED**
  * *Evidence:* `tasks/plans/2026-09-25-stale-game-delete.md:13` explicitly specifies: "Update `FileInfo.tsx`'s `setGames` prop contract to accept the same row state as `InfoPanel.tsx`." The full codebase type-check via `tsgo --noEmit` (enforced unconditionally in `pnpm lint:ci` and frontend build gates) ensures that passing `setGames` from `InfoPanel.tsx` to `FileInfo.tsx` cannot typecheck if `FileInfo`'s prop contract diverges from the structured row map.

---

### Scope Expansion Check
Judged against MANDATE `f-20260924-05`:
* All verification criteria in `Proof` strictly cover the mandate requirements: carrying what the user saw into the deletion request, native rejection of stale rows across structural/content edits, and user notification/recovery upon refusal.
* Updating `FileInfo.tsx`'s prop contract is a direct dependency of migrating `InfoPanel.tsx`'s row state.
* No scope expansion detected.

---

### Findings

None.

---

VERDICT: APPROVED
