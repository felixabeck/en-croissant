# PGN long-comment import fix — reviewed plan, plan review and diff review record (2026-10-01)

Tracked copy of the git-ignored run plan `tasks/plans/2026-10-01-pgn-long-comment-import.md` at its
final revision (plan-r4 plus the post-review sentence correction from diff round d2), including the
complete `## Reviews` history, `## Carried to diff review`, and the cumulative diff-review rounds
d1-d6 below. The raw lens reports under `/tmp/build-pgnlong/` may disappear; this file alone
suffices to recover the history.

- **State:** implemented, diff review converged (d6), final gates and push follow in the same run.
- **Commits:** a586742a fix(pgn), c6558535 fix(import), 4f54eb64 fix(databases), a7388d8e fix(db),
  c63358e6 fix(databases), 4f261703 fix(db), 3ed8304f fix(databases), 1765f90a fix(db),
  5eb677f4 fix(db), f27e2db4 test(db).
- **Findings filed by this run (deferred, not owned by a successor of this plan):**
  `f-20261001-18` (persisted reference handle, P13), `f-20261001-19` (no import cancel control),
  `f-20261001-21` (same-database progress-id collision), `f-20261001-22` (no Windows test for
  database deletion), `f-20261001-23` (shared single-slot conversion state).
- **Orchestrator:** Claude Code (Opus 5.5), session 617a946f-3e8d-4441-8d2a-e181261c6392. The same
  context wrote the plan and arbitrated every triage. Plan rounds r1-r2 ran on Codex lenses, r3-r4
  on Gemini/agy (Felix's instruction); all write leaves and diff rounds d1-d6 ran on Codex (Felix
  retired Gemini during the run). Detection therefore ran on the Codex family, which also wrote the
  code — no foreign-family detection for the diff rounds.

---

# Plan: PGN import fails on one long comment and the failed database vanishes

## Goal

The Mega Database 2025 PGN imports completely. An import that still fails on unreadable PGN
tells the user the file and game. Every failure inside the per-file loop writes the file,
physical game number and full cause to the local log: opening, decompressor setup, reading,
parsing and inserting. A failure after the loop (indexes, counts, commit) is logged with its full
cause, but no file applies to it. A failed import never leaves an invisible half-database behind.

## MANDATE

Felix, 2026-10-01 (screenshot of the Databases page showing only OMCORR202609 and Meine Partien):
"I imported or converted the two databases. The first one worked but the mega database was also
uploading but now I can't see it anymore. Before I saw a small line above the database telling me
that it is in process and converting but now I don't see it anymore. What happened there? Do I
just have to restart the app or what happened to the bigger database?"

Diagnosis presented in the same session, accepted as the scope of the fix: (1) one 26,158-byte
comment aborts the import inside pgn-reader; (2) the failure is reported and logged only as
"I/O failure"; (3) the empty database file the import created stays on disk and is silently
dropped from the list; (4) the same parser limit affects opening and saving such a game.
Felix: "Review this plan with Codex and only pause when everything is approved. Then pause
before implementation."

## Threat model and non-goals

Accidental input only: real PGN exports (ChessBase, Lichess, Chess.com, TWIC), possibly
very large, with long annotations, from a user-selected local file. Not an adversary crafting
input to exhaust memory beyond the per-token bound below. Linux, macOS and Windows all count.
Non-goals: partial-commit imports, per-file commits, a new partial-outcome IPC contract
(`d-20260910-08` stays), a cancel control for a running import (filed separately).

## Traced premises

- Measured: `Mega Database 2025.pgn` has 11,443,964 games. Exactly one comment is longer than
  8,000 bytes: 26,158 bytes at byte 4,862,883,564, game #4,744,345 (scan script over the full file).
- Measured probe against `pgn-reader = "=0.26.0"`: comments of 8,000 B and 9,000 B → `Ok(2 games)`;
  26,158 B → `Err(Kind(InvalidData))`.
- `pgn-reader-0.26.0/src/reader.rs:17` `MIN_BUFFER_SIZE = 8192`; `:487-488` buffer capacity
  `MIN_BUFFER_SIZE * 2`; `:608-620` `fill_buffer_and_peek` fills only to 8192 available bytes;
  `:131-140` and `:165-169` header branches, `:242-251` comment branch: terminator not found in
  the buffer → `consume_all`, skip, `return Err(invalid_data())`. `:506-519` `new_cursor` is the
  same 16 KiB buffer (no escape via in-memory input). Upstream 0.27 (GitHub, not in the registry)
  is reported to hard-cap comments at 4096 B; this is unverified and the plan does not depend on it.
- `circular-0.3.0/src/lib.rs:98` `pub fn grow(&mut self, new_size: usize) -> bool`; `:214` `shift`.
- Timing matches: database file created 11:59:05.089, `convert_pgn: I/O failure` logged
  10:03:01 UTC (12:03:01 local) = 236 s; OMCORR (2,356,539 games) was imported in 97 s at
  ~24 k games/s, so game ~4.74 M is reached at ~200–236 s.
- `src-tauri/src/db/mod.rs:816-884` one `db.transaction` around schema, all files, inserts,
  indexes and counts; `:855-860` `read_game(...).map_err(|e| map_read_error(e, cancellation))?`.
- `src-tauri/src/cancellable_read.rs:40-46` `map_read_error`: everything except a cancelled
  `Interrupted` becomes `Error::Io`.
- `src-tauri/src/error.rs:131-132` `Io` displays "I/O failure"; `:483-496` the renderer payload is
  the fixed Display; `:226-227` `InvalidInput(String)`; `:270-287` `Error::diagnostic()` walks the
  source chain for local logs.
- `src-tauri/src/infra/operations.rs:792` logs `{error}` (Display only).
- Other pgn-reader drivers: `src-tauri/src/lexer.rs:163-178` (`lex_pgn`, opening a game from a
  `.pgn` file), `src-tauri/src/db/mod.rs:3312-3317` (`write_db_game_blocking`),
  `src-tauri/src/game.rs:2407-2420` (opening-book PGN).
- `src-tauri/src/db/mod.rs:591-594` `Importer::comment` stores the full text;
  `src-tauri/src/db/encoding.rs:69-75` chunks comments at `u16::MAX`, so storage has no length issue.
- `src-tauri/src/pgn.rs:100-102` the app's own limits: `MAX_LINE_LEN` 1 MiB, `MAX_PGN_BYTES` 10 MiB per game.
- Renderer: `src/components/databases/AddDatabase.tsx:49-74` `convertLocalDatabase` creates
  `<uuid>.db3` via `createWorkspaceDatabase` and then calls `convertPgn`; no cleanup on
  rejection. `:94-116` `convertDB` clears the conversion state in `finally`; the form shows a
  "Common.Error" notification with the error Display.
- `src/utils/db.ts:224-238` `getDatabases` → `collectSequential` (`src/utils/collectSequential.ts:21-31`)
  logs and drops failed items; pinned by `src/utils/db.test.ts:123-146`.
- `src/bindings/index.ts:25-31` `DatabaseInfo` already has `{ type: "error"; file; filename; error; indexed }`;
  `src/components/databases/DatabasesPage.tsx:266-298` already renders it as an error card;
  nothing produces it today.
- `src-tauri/src/db/migrations.rs:129-136` "Database has not been initialized yet" = zero
  non-internal tables; `:106-124` an empty file is the documented retry state.
- `src/components/home/AccountCard.tsx:64-84` account sync reuses a fixed `<title>_<type>.db3`.
- `src/components/common/AccountCards.tsx:220` and `:281` match the account database by
  `filename` without narrowing on `type`.
- `src/components/databases/DatabasesPage.tsx:300-306` renders a reference-database `Rating`
  for every item, error items included.
- `src/components/databases/databaseRoute.ts:20-23` already filters to `type === "success"`.
- `src/components/databases/AddDatabase.tsx:112` refreshes the list only after success.
- `src-tauri/src/db/allocation_probe.rs` is a test-only per-thread Rust heap peak probe
  (`measure`), already used by the search-index tests (`db/mod.rs:4336-4354`).
- Felix's machine: `~/.local/share/com.chessriddle.encroissant/db/de795657-abdb-461c-b17f-167fc4571883.db3`
  is 4,096 bytes, created 11:59:05, the orphan of the failed import.

## Approach

### A. Parser accepts long comments and tag lines (root cause)

MANDATE: "what happened to the bigger database" — diagnosis (1) and (4).

- Vendor `pgn-reader 0.26.0` into `src-tauri/vendor/pgn-reader/` and route the crate through
  `[patch.crates-io]` in `src-tauri/Cargo.toml`. The licence is GPL-3.0+, compatible with the
  project's GPL-3.0-only. The vendored tree is byte-identical to the registry copy except for the
  patch below and a `CHESSFABLE.md` naming the upstream version, the patch, and the reason.
- Required behaviour: when a `{comment}`, a tag line, or a tag value has no terminator inside the
  buffered window, the reader grows its buffer (doubling, after `shift`) and reads more input,
  then searches again. It keeps the existing `InvalidData` path only when EOF is reached or a
  single token would exceed a fixed cap of 10 MiB. The cap equals the app's per-game bound
  `MAX_PGN_BYTES`, because no game with a larger token is accepted elsewhere either. Memory per
  reader is bounded by the cap. The buffer stays grown for the rest of that reader's lifetime.
  Readers are short-lived (one per import, one per lex call).
- Every pgn-reader driver (`convert_pgn`, `write_db_game`, `lex_pgn`, the opening-book reader)
  gets the fix through the same crate, with no per-call-site change.
- **Storage keeps a long comment intact (amendment r4).** Once the parser accepts comments above
  the 16 KiB window, the database encoding becomes reachable for comments above 65,535 bytes.
  Today `encode_comment` (`db/encoding.rs:69-75`) splits such a comment into independent
  65,535-byte chunks. The single decoder that materialises comments (`db/encoding.rs:322-341`)
  turns each chunk into its own comment and decodes each chunk's bytes as UTF-8 separately. A
  >64 KiB comment would therefore export as several `{…}` comments, and a multi-byte character
  split at a chunk boundary would turn into replacement characters. Required behaviour:
  - A chunk of exactly 65,535 bytes means "continued in the immediately following comment
    chunk".
  - A comment whose byte length is an exact non-zero multiple of 65,535 ends with one
    zero-length comment chunk.
  - The decoder concatenates the raw bytes of a continued run before UTF-8 decoding. It emits one
    comment node and swallows the terminating zero-length chunk only when that chunk follows a
    full chunk.
  - The skip-only readers (`MainlineMoveBytesIter`, `try_iter_mainline_move_bytes`) keep skipping
    each chunk unchanged.
  - Stored data from before this change is unaffected, by construction: no parser before this
    change could produce a comment of 16 KiB or more, so no stored chunk has length 65,535.
  - NAG encoding is unchanged; NAG tokens are short.
  - The decoder's bounded-allocation comment and cancellation checks stay. A decoded comment is
    bounded by the in-memory moves blob it is copied from (diff review d1: a decoder cap equal to the parser cap rejected lossy-expanded invalid-UTF-8 comments, so it was removed).
  - Verification: each of the following round-trips import → export as the same comment sequence,
    byte-exact:
    - a 1 MiB comment of multi-byte characters (e.g. `ä` repeated, so chunk boundaries split
      characters);
    - exactly 65,535-byte and 131,070-byte comments;
    - a 65,535-byte comment followed directly by a second comment (no move between);
    - a genuine empty comment `{}` that follows a short comment.

    Encoder/decoder unit tests in `db/encoding.rs` pin the chunk layout. The 1 MiB case replaces
    the earlier "comments of 1 MiB" fixture's byte-exact claim.
- Verification level: app-crate tests drive the real reader through the blocking cores of the
  public commands, one per affected driver:
  - `convert_pgn`: an import whose middle game carries comments of 8 KiB, 16 KiB, 26,158 B and
    1 MiB imports every game. The stored comment round-trips byte-exact through export.
  - `write_db_game_blocking` (the save path): it replaces a game with a 26,158 B-comment game, and
    reading it back returns the full comment.
  - `lex_pgn`: it returns the full comment token.
  - A 20 KiB tag value parses.
  - An unterminated comment longer than the cap still fails, and the parse holds bounded memory.
    Peak Rust heap is measured with the existing test-only `db::allocation_probe::measure` and
    asserted below cap plus a fixed margin, on a fixture several times larger than the cap.
    The existing error path legitimately keeps reading to the next `}` or EOF in constant
    memory, so the bound is on memory, not on bytes read.

### B. A failed import says what failed and the log says why

MANDATE: diagnosis (2), "What happened there?".

- `convert_pgn_blocking` classifies every `read_game` error in this fixed order:
  1. **Cancellation first**, with exactly today's `map_read_error` semantics: `Interrupted` while
     the token is cancelled → `Error::Cancellation`.
  2. **Source error**: the `io::Error` came from the file or the decompressor. A thin `Read`
     adapter around the decompressed source records that. It stays `Error::Io`.
  3. **Parser error**: everything else. It becomes `Error::InvalidInput("<source display name>:
     game <n> could not be read (unterminated comment or tag)")`.

  `<n>` is the **physical game ordinal within that file**, 1-based. It counts every game
  `read_game` started, including games the Importer skipped (`None`) and filtered games. It is
  **not** the existing `imported_games` counter, which counts inserted games across all files.
  The adapter also counts bytes read.
- Per-file failure context: any error that leaves the per-file loop body is logged once at that
  boundary with the source display name, the physical game ordinal (0 when the failure happens
  before the first game, e.g. file resolution or `zstd::Decoder::new`), the byte offset, and
  `Error::diagnostic()`. This covers open, decompressor setup, read, parse and insert. The
  returned error is unchanged by this logging; only the parser case is converted, as above.
- For a source error, the renderer message stays the fixed "I/O failure" (no raw io text on the
  wire). The renderer message carries no native path and no raw io text (the renderer-safety rule
  in `review-tauri-security` item 7). The precedent is the export path, which already names a game
  id in `InvalidInput`.
- The transaction semantics of `d-20260910-08` are unchanged. After A, a remaining parser error
  means genuinely corrupt input (an unclosed `{` over 10 MiB), and failing the whole import with
  a precise message is the recorded policy.
- `run_native_operation` logs `error.diagnostic()` instead of Display, for every native
  operation. The local log then shows the io kind and source chain. The renderer payload is
  unchanged.
- Verification level: Rust tests.
  - An unterminated-comment fixture fails with `InvalidInput`, naming the file display name and
    game number. Its serialized renderer payload (`ErrorPayload` `message` and `category`) is
    asserted, so the IPC wire shape is proven at the command boundary.
  - The game number is physical: a fixture whose games 1 and 2 are skipped by the Importer (an
    illegal SAN) and whose game 3 has an unterminated over-cap comment reports `game 3`.
  - A second file in a two-file import reports its own display name and ordinal.
  - A source reader that fails mid-file still yields `Io`, and the log line carries file, game,
    offset and cause.
  - A decompressor-setup failure (corrupt `.zst` header) is logged with file name and game 0.
  - The existing mid-game cancellation regression test still yields `Error::Cancellation`.
  - The operations log assertion shows the source chain.

### C. A failed import never vanishes

MANDATE: diagnosis (3), "now I can't see it anymore".

- `convertLocalDatabase`: when `convertPgn` rejects, for any reason including cancellation, it
  deletes the database file that this call created, through the existing database-delete command,
  and then rethrows the original error. If the delete fails, that failure is logged and the
  original error is still the one rethrown and shown.
- `convertDB` (`AddDatabase.tsx`) refreshes the database list after every conversion attempt, on
  success and on failure, not only on success. If cleanup failed, the leftover file therefore
  shows up immediately as an error card.
- On the failure path the refresh is best-effort:
  - A rejected refresh is logged.
  - It never replaces the original import error.
  - It never prevents the conversion state from being cleared, which still happens in `finally`
    whatever the refresh does.
- On the success path the existing behaviour is kept: a refresh failure is surfaced as it is
  today.
- `getDatabases`: a database whose metadata read fails is returned as the existing
  `{ type: "error" }` `DatabaseInfo` (file, filename, a renderer-safe message) instead of being
  dropped. A cancellation still propagates. The "not initialized yet" case gets the i18n text
  "Import did not finish — delete it and import again". The existing error card and its Delete
  action show it.
- Consumer contract: any consumer that **opens, selects or syncs** a database considers only
  `type === "success"` entries. The `file`/`filename` fields exist on both variants, so the union
  does not force this; each site is named:
  - `src/components/common/AccountCards.tsx` (both filename matches): an error entry is treated
    as no database (`null`). `ensureAccountDatabaseHandle` then finds the registered fixed-name
    file through `listWorkspaceDatabases` and reuses it, so account sync keeps its documented
    retry behaviour. That retry behaviour is otherwise unchanged.
  - `src/components/databases/DatabasesPage.tsx`: error cards get no reference-database toggle.
  - Already narrowing, kept: `databaseRoute.ts` `resolveDatabaseRoute`, `home/Databases.tsx`,
    `panels/info/InfoPanel.tsx`, and the selection dropdown in `panels/database/DatabasePanel.tsx`.
  - Known limit, not changed here: `DatabasePanel` passes the persisted `referenceDbAtom` handle
    to local search without checking the current list (`DatabasePanel.tsx:161-165`). A reference
    database that later becomes unreadable is still queried. This hazard is identical today: the
    entry is dropped from the list, and the handle stays persisted. This plan neither creates nor
    worsens it; P5 stops error cards from being starred. It is filed as a finding (rule 4b) and
    named in the completion report.
- Deleting a zero-table database file works through `delete_database_blocking`.
- Verification level:
  - `AddDatabase.test.tsx`:
    - `convertPgn` rejects → the created database is deleted, the list is refreshed, and the
      notification shows the backend message.
    - `convertPgn` rejects and the delete also rejects → the original error is still the one
      shown, the cleanup failure is logged, and the list is refreshed.
    - `convertPgn` rejects and the refresh also rejects → the original error is still the one
      shown, the refresh failure is logged, and the conversion state is cleared.
  - `db.test.ts`: the failing item is returned as an error entry, and its siblings are kept.
  - `AccountCards` test: an error entry with the account's filename yields `database={null}`.
  - `DatabasesPage` test: an error card renders no reference toggle.
  - Rust test: `delete_database_blocking` removes a valid-header, zero-table database together
    with its `-wal`/`-shm` files.
  - `pnpm test:e2e:container`: a snapshot of the error card.

### D. Felix's machine

- After C ships, the orphan file `de795657-…db3` and its `-wal`/`-shm` files are removed, after
  re-checking that it has zero tables.
- `$push` on master runs `scripts/install-local.sh`.
- Felix re-imports `Referenzdatenbanken/Mega Database 2025.pgn` through the native file picker.

## Decisions and trade-offs

- **Vendor and patch pgn-reader rather than upgrade, pre-filter or replace it.** Upgrading does not
  help: 0.27 is reported stricter. A pre-filtering `Read` adapter that splits or truncates long
  comments loses data or changes the comment structure. Replacing the parser is out of
  proportion to a buffer-growth fix. The cost is owning a fork of one crate: a future upgrade must
  re-apply the patch, which `CHESSFABLE.md` names.
- **The import stays all-or-nothing (`d-20260910-08`).** Fixing the parser removes the trigger.
  Skipping unreadable games would need the reviewed partial-outcome contract that the decision's
  reversal clause demands, and nothing in the MANDATE requires it.
- **Cleanup lives in the renderer flow that created the file**, not in `convert_pgn`. The backend
  cannot tell a fresh uuid file from an account database that is meant to be retried.
- **Show broken databases instead of dropping them.** This uses the existing error variant and card
  rather than a new mechanism. It also covers orphans left by a crash or a kill, where no cleanup
  code runs.

## Risks / open questions

- The cargo gates (clippy, llvm-cov scope, cargo-mutants) might pick up the vendored path
  crate. Phase 1 checks each gate's scope and excludes the vendored crate explicitly if one does.
  It never lints or ratchets third-party code.
- The 10 MiB per-token cap: a reader holding a 10 MiB buffer is acceptable, given the import
  already holds a much larger SQLite page cache.
- The error card's Delete path on a zero-table file goes through `delete_database_blocking`,
  which has an `is_sqlite_notadb` fallback. Obligation C's Rust delete test proves it works on a
  valid-header, zero-table SQLite file. If that test is red, fixing it belongs to C.

## Not part of this task

- A cancel control for a running local import: there is none (`DatabasesPage.tsx:222-244`; the
  command has no ticket). This is filed as a finding.
- Converting `Shankland_Calculation.cbv` and `CorHIST1800-1986def.cbv`, which is Felix's call.
- Validating a persisted reference-database handle against the current list (P13). This hazard
  exists today unchanged and is filed as a finding.

## Phases

1. **Parser and comment storage (A).** Files: `src-tauri/vendor/pgn-reader/**`,
   `src-tauri/Cargo.toml`, `src-tauri/Cargo.lock`, `src-tauri/src/db/encoding.rs` (comment chunk
   encode/decode), tests in `src-tauri/src/db/mod.rs` and `src-tauri/src/lexer.rs`, and gate-scope
   config where needed (`scripts/check-rust-release-surface.mjs` must admit exactly the one
   `[patch.crates-io]` path entry). Persistence: the stored comment chunk layout gains a continuation rule (backward compatible by construction, see A); untrusted-input parsing.
   Role: sensitive. Proof: `cargo test --manifest-path src-tauri/Cargo.toml long_comment` and
   `long_tag`, then `pnpm checks:pre-review`.
2. **Error reporting (B).** Files: `src-tauri/src/db/mod.rs`, `src-tauri/src/cancellable_read.rs`,
   `src-tauri/src/infra/operations.rs`. This touches the IPC error contract (message text only;
   category `InvalidInput` already exists). Role: sensitive. Proof: targeted `cargo test` for
   the new convert, cancellation and operations tests, then `pnpm checks:pre-review`.
   **Strictly after Phase 1 is committed.** Both phases edit `src-tauri/src/db/mod.rs`, and
   Phase 2 uses Phase 1's over-cap fixture.
3. **Renderer and delete path (C).** Files: `src/components/databases/AddDatabase.tsx`,
   `src/components/databases/DatabasesPage.tsx`, `src/components/common/AccountCards.tsx`,
   `src/utils/db.ts`, `src/translation/*`, their tests, an e2e snapshot, and the Rust delete test in
   `src-tauri/src/db/mod.rs`. Because of that shared Rust file, it runs after Phase 2. Proof:
   `pnpm vitest related` on the touched files, the targeted `cargo test` for the delete test, then
   `pnpm checks:pre-review` and `pnpm test:e2e:container`.
4. **Final.** `pnpm gates:push -- --rust --frontend --bindings` (`Cargo.toml`/`Cargo.lock` change →
   all three blocks per the push skill), then the lenses on the cumulative diff, then `$push`, then D.

## Carried to diff review

- CR-1 (P17): A parses a **terminated** comment whose closing `}` lies beyond the 10 MiB cap → error (the cap applies to terminated tokens too).
- CR-2 (P18): B's source-error test uses an `io::ErrorKind::InvalidData` source error, so a kind-based misclassification fails the test.
- CR-3 (P19): C's AccountCards test covers both the Lichess (`AccountCards.tsx:220`) and the Chess.com (`:281`) match.
- CR-4 (P20): `databaseRoute` test adds an error entry with the route key → `not_found`.
- CR-5 (P23): A's buffer growth never allocates beyond the cap: grow to `min(2 × capacity, cap + 1)` instead of the next power of two (phase-1 leaf measured a 16 MiB allocation for a 10 MiB cap); tighten the allocation-probe margin accordingly.

## Reviews

### Round 1 (r1, 10 Codex lenses, role sensitive; review-plan role review-plan)

Raw verdicts: code-quality APPROVED, ipc-contract APPROVED, pgn-index APPROVED, tauri-security
APPROVED, minimalism APPROVED (1 nit), tests APPROVED (4 should-fix), correctness REVISE,
error-handling REVISE, root-cause REVISE, plan REVISE. Raw reports: `/tmp/build-pgnlong/lens-*.txt`.

| ID | Witnesses | Claim | Verified | Disposition | Authority | Status |
|---|---|---|---|---|---|---|
| P1 | correctness (blocker 94) | error entries from `getDatabases` reach account sync via filename match and break its retry | `AccountCards.tsx:220,281` match by filename, no narrowing | Fix — C consumer contract: AccountCards treats error entry as null | MANDATE "never leaves an invisible half-database" (C) without breaking existing account sync | open, closure r2 |
| P2 | error-handling (blocker 97), plan (blocker 96) | delete failure hidden; list not refreshed on failure, so no error card | `AddDatabase.tsx:112` refreshes only on success | Fix — C: refresh in every outcome; original error rethrown; cleanup failure logged | MANDATE "now I can't see it anymore" | open, closure r2 |
| P3 | error-handling (should-fix 92) | source/decompressor failures do not identify the input | plan B text | Fix — B: log line names file, game, offset, cause; renderer keeps fixed Io text | MANDATE "What happened there?" | open, closure r2 |
| P4 | plan (blocker 94) | save path (`write_db_game_blocking`) not proven | `db/mod.rs:3312-3317` separate parse | Fix — A verification adds save-path test | MANDATE diagnosis (4) | open, closure r2 |
| P5 | plan (blocker 91) | error entries can be starred as reference database | `DatabasesPage.tsx:300-306` Rating on every item | Fix — C: no reference toggle on error cards + test | C consumer contract | open, closure r2 |
| P6 | plan (should-fix 98) | phases 1 and 2 overlap on `db/mod.rs` | plan text | Fix — phases strictly sequential, stated | build §3 phase rule | open, closure r2 |
| P7 | root-cause (blocker 88) | source/parser classification can misclassify cancellation | `cancellable_read.rs:40-46` | Fix — B: cancellation classified first; existing mid-game cancellation test kept | async-resource-invariants (cancellation) | open, closure r2 |
| P8 | minimalism (nit 84) | long tag support exceeds the measured comment case | `reader.rs:131-140,165-169` same buffer-window mechanism | Skip — same root cause and same `fill_more` mechanism in the same vendored file; leaving two identical branches broken keeps a known defect in code this plan takes ownership of (rule 4) | — | closed (arbiter) |
| P9 | tests (should-fix 96) | over-cap test cannot tell the cap from read-to-EOF | the error path reads to `}`/EOF by design | Fix — A: memory bound asserted with `allocation_probe::measure` | threat model (bounded per-token memory) | open, closure r2 |
| P10 | tests (should-fix 91) | real IPC error payload path unproven | renderer tests mock Tauri | Fix (narrowed) — B: assert serialized `ErrorPayload` at the command boundary; `verify:app` cannot select a file without the native picker | B | open, closure r2 |
| P11 | tests (should-fix 96) | zero-table Delete unproven | plan risk text | Fix — C: Rust delete test incl. `-wal`/`-shm` | C | open, closure r2 |
| P12 | tests (should-fix 94) | delete-rejection path untested | plan C | Fix — C: AddDatabase test for delete rejection | C | open, closure r2 |

### Round 2 (r2, closure: plan, correctness, error-handling, root-cause, tests — Codex)

Raw verdicts: plan REVISE, correctness REVISE, error-handling APPROVED (3 should-fix), root-cause
APPROVED, tests APPROVED (4 should-fix + 1 late). Raw reports: `/tmp/build-pgnlong/lens-r2-*.txt`.
Closed in r2: P1 (correctness, plan), P2 (error-handling, plan), P4, P5, P6, P9, P10, P11, P12
(plan; tests for P9-P12), P7 (root-cause, plan). P3: plan CLOSED, error-handling NOT CLOSED →
residual, kept open.

| ID | Witnesses | Claim | Verified | Disposition | Authority | Status |
|---|---|---|---|---|---|---|
| P3 (residual) | error-handling (should-fix 94) | open/`zstd::Decoder::new` errors before the read path lack file context | `db/mod.rs:833-852` errors via `?` before `read_game` | Fix — B: per-file boundary log covers open, decoder setup, read, parse, insert; test for decoder setup | MANDATE "What happened there?" | open, closure r3 |
| P13 | correctness (blocker 91), plan (blocker 99) | persisted `referenceDbAtom` handle of an error database is still searched | `DatabasePanel.tsx:161-165` copies `referenceDatabase` into `localOptions.path`; `atoms.ts:457-460` localStorage | Plan text corrected (DatabasePanel no longer claimed as narrowing); mechanism **not** added: identical hazard today (entry dropped, handle persisted), so per build §4 adoption gate it is a named known limit + filed finding | adoption gate: "not worse than today" | open, closure r3 (text) |
| P14 | plan (blocker 96) | game number undefined; inserted-games counter would misreport after skips | `db/mod.rs:857-873` counts inserted only; `:600-607` skip → None | Fix — B: physical per-file ordinal; skipped-games and second-file tests | MANDATE "names the file and game" (Goal) | open, closure r3 |
| P15 | error-handling (should-fix 96), plan (should-fix 94) | refresh failure semantics undefined; could mask import error or skip state cleanup | `db.ts:227-233` can reject; `AddDatabase.tsx:113-115` finally | Fix — C: best-effort refresh on failure path, logged, never masks, state cleared; test | MANDATE "now I can't see it anymore" | open, closure r3 |
| P16 | error-handling (should-fix 92) | Goal promises file/game for every failure, incl. post-loop index/count | plan Goal vs B | Fix — Goal narrowed to per-file loop; post-loop failures logged with cause, no file | Goal consistency | open, closure r3 |
| P17 | tests (should-fix 90) | over-cap terminated token unproven | — | Fix — carried to CR-1 | — | carried |
| P18 | tests (should-fix 90) | source-error test kind unspecified | — | Fix — carried to CR-2 | — | carried |
| P19 | tests (should-fix 88) | Chess.com match untested | `AccountCards.tsx:281` | Fix — carried to CR-3 | — | carried |
| P20 | tests (should-fix 91) | databaseRoute error-entry filter untested | `databaseRoute.ts:20-23` | Fix — carried to CR-4 | — | carried |
| P21 | tests (late, should-fix 93) | final gate omits `--bindings` for Cargo changes | push SKILL.md:228 | Fix — Phase 4 command; reference-only, arbiter-closed (semantics of proof unchanged otherwise) | push skill | closed (arbiter) |

### Round 3 (r3, closure: plan, correctness, error-handling — Gemini/agy per Felix's instruction)

Raw verdicts: plan APPROVED, correctness APPROVED, error-handling APPROVED. Raw reports:
`/tmp/build-pgnlong/lens-r3-*.txt`. Closed: P3 (error-handling, plan), P13 (correctness, plan —
disposition accepted), P14 (plan), P15 (error-handling, plan), P16 (error-handling, plan).
Open plan-level issues: none. Carried: CR-1..CR-4. Adoptions per round: r1=11, r2=5, r3=0.

### Implementation finding → amendment r4 (during Phase 1)

| ID | Witnesses | Claim | Verified | Disposition | Authority | Status |
|---|---|---|---|---|---|---|
| P22 | orchestrator, from the phase-1 leaf's deviation note | once comments > 16 KiB parse, comments > 65,535 B are stored as independent chunks: exported as several comments, multi-byte chars split at chunk boundaries become U+FFFD | `db/encoding.rs:69-75` byte `chunks(u16::MAX)`; `:322-341` one `Comment` node + `from_utf8_lossy` per chunk; only materialising decoder (other COMMENT_MARKER sites `:124`, `:169` skip) | Fix — A amended: continuation rule (full chunk continues; exact multiple ends with zero-length chunk), decoder concatenates bytes before UTF-8; tests | MANDATE diagnosis (1)/(4) + Goal "imports completely": a long comment must survive import | open, closure r4 |
| P23 | phase-1 leaf report | doubling growth allocates 16 MiB for a 10 MiB cap | leaf allocation measurement 16,778,408 B | Fix — carried to CR-5 (growth arithmetic only, obligation unchanged) | — | carried |
| P24 | phase-1 leaf report | header cap counts tag name + value together; a value of exactly 10 MiB plus its name is rejected | leaf report | Skip — the plan's cap is per token/tag line ("a tag line, or a tag value"); bounding the whole line is the conservative reading and no real tag approaches 10 MiB | — | closed (arbiter) |

### Round 4 (r4, closure of P22: plan, pgn-index, correctness, tests — Gemini/agy)

Raw verdicts: plan APPROVED, pgn-index APPROVED, correctness APPROVED, tests APPROVED. Raw
reports: `/tmp/build-pgnlong/lens-*-r4.txt`. Closed: P22 (all four). Open plan-level issues: none.
Adoptions per round: r1=11, r2=5, r3=0, r4=1.

## Diff review (cumulative, Codex, `--role sensitive`; range 5ff9a217..HEAD)

Adopted per round: `diff_adopted_per_round` d1=12 d2=6 d3=1 d4=1 d5=1 d6=0. All five carried
items CR-1..CR-5 were reported CLOSED by every d1 lens.

| ID | Round / witness | Claim | Verified | Disposition | Closed |
|---|---|---|---|---|---|
| D1 | d1 correctness (blocker) | `-wal`/`-shm` unlinked before the primary identity check | `unlink_database_files` order | Fix a7388d8e: probe before, unlink after primary by captured identity; post-primary failure → partial removal | d2 |
| D2 | d1 error-handling (blocker) | delete + refresh both fail → no card | AddDatabase flow | Skip: list unloadable means page LoadError on next load; cleanup failure logged; cancel only at shutdown | d2 (accepted) |
| D3 | d1 error-handling | card discards category | db.ts | Fix c63358e6 + 3ed8304f: fixed texts per case incl. permission / not-found | d3 |
| D4 | d1 error-handling | metadata log lacks filename | db.ts | Fix c63358e6 | d2 |
| D5 | d1 ipc-contract (blocker) | progress id derived from handle alone collides | pre-existing | Defer f-20261001-21 | — |
| D6 | d1 pgn-index (blocker) | invalid-UTF-8 comment expands past decoder 10 MiB cap | encoding.rs | Fix a7388d8e: decoder cap removed (bounded by moves blob) + 4 MiB 0xFF round-trip | d2 |
| D7 | d1 tauri-security (blocker) | raw SQLite diagnostic shown on the error card | error.rs:389 | Fix c63358e6 (card) + 4f261703 (payload) | d3 |
| D8 | d1 minimalism | duplicated bounded search in vendored reader | reader.rs | Fix a7388d8e | d2 |
| D9 | d1 minimalism | duplicated AccountCards lookup; duplicate cap constant | — | Fix c63358e6 / a7388d8e | d2 |
| D10 | d1 code-quality | unnamed sentinel message | db.ts | Fix c63358e6 (`DATABASE_NOT_INITIALIZED`) | d2 |
| D11 | d1 code-quality | `byte_offset` is a decompressed offset | — | Fix a7388d8e (`decompressed_offset`) | d2 |
| D12 | d1 platform-semantics | no Windows test for database deletion | module `#[cfg(all(test, unix))]` | Defer f-20261001-22 | — |
| D13 | d1 tests | header cap exhaustion untested | — | Fix a7388d8e | d2 |
| D14 | d1 tests | exact-cap decode untested | — | moot after D6 | d2 |
| E1 | d2 code-quality | plan sentence stale (decoder bound) | plan file | Fix in plan (this record) | arbiter |
| E2 | d2 error-handling | post-primary sidecar failure not logged | db/mod.rs | Fix 4f261703 | d3 |
| E3 | d2 records | f-20261001-19 overstates page blocking | DatabasesPage.tsx | Fix: annotation 96fbd54a | d3 (residual Skip, see E7) |
| E4 | d2 tests | unfinished-import test mocks with its own constant | db.test.ts | Fix 3ed8304f | d3 |
| E5 | d2 tests (nit) | "partial removal" log branch untested | db/mod.rs | Fix 4f261703 | d3 |
| E6 | d2 platform-semantics | Windows coverage (re-raise of D12) | — | kept Deferred f-20261001-22 | — |
| E7 | d3 records | annotated finding still holds the superseded sentence | findings.md | Skip: ledger is append-only; `findings.py annotate` is the sanctioned correction and names the sentence it corrects | — |
| E8 | d3 records | "Add games" overwrites the single shared conversion state | atoms.ts:488-500, DatabasesPage.tsx | Defer f-20261001-23 | — |
| E9 | d3 error-handling | registry cleanup warning uses Display | db/mod.rs | Fix 1765f90a | d4 |
| E10 | d3 tauri-security (blocker) | `diagnostic()` logs reqwest URLs with query credentials | error.rs:146 `Reqwest` has no `#[source]`; `diagnostic()` walks only `source()` | Skip — premise false (adopted first without verification, then reverted; the fix-5 changes to error.rs/fs.rs/operations.rs were discarded uncommitted) | d4 (lens accepted) |
| E11 | d4 tauri-security (blocker) | snapshot opener interpolates raw Diesel error | repository.rs:475 | Fix 5eb677f4 (shared `map_sqlite_establish`) | d5 |
| E12 | d5 correctness (blocker) | legacy 65,535-byte chunk + adjacent comment would merge | plan r4 premise | Skip: no pre-run write path could store a ≥16 KiB comment | d6 (lens accepted) |
| E13 | d5 tests (blocker) | snapshot opener failure untested | — | Fix f27e2db4 (`SNAPSHOT_OPEN_HOOK`; revert probe exits 101) | d6 |

Lineage note: E11→E13 is a defect in the previous repair's own verification (first reopening of
that mechanism); no second reopening occurred, so no §4a escalation was needed.
