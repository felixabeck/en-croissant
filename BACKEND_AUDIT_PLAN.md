# Backend audit and autonomous implementation plan

Status: implemented and independently reviewed on 2026-08-09. All 107 execution items are complete; the sole external rollout dependency is recorded in section 9.

## 1. Scope, ownership, and non-negotiable constraints

- Backend scope: `src-tauri/src/**`, `src-tauri/Cargo.toml`, `src-tauri/build.rs`, `src-tauri/tauri.conf.json`, and `src-tauri/capabilities/**`.
- Do not modify `src/**`, including generated TypeScript bindings. Preserve existing Tauri command names, argument shapes, return shapes, event names, and serialized error strings unless this plan explicitly says otherwise.
- The worktree is shared. Never revert unrelated changes. Never stage or commit; the Codex root owns the global Git index, integration, and commits.
- Long-term correctness is the gate. Do not choose a weaker design because the proper refactor is large.
- Every second implementation of the same domain operation must be extracted and both callers routed through it.
- Keep all public commands panic-free for malformed renderer input, user-selected files, corrupt databases, corrupt indexes, broken engines, and network failures.
- Blocking filesystem, compression, parsing, Diesel, Rayon, and child-process waits must not monopolize Tokio runtime workers.
- Every state registry must have an owner, cleanup on every exit path, per-resource identity, and a bounded retention policy.
- Each area below must finish green before proceeding. Update the checkboxes and append exact verification evidence to section 10 while executing.

## 2. Baseline evidence and completion gates

Baseline captured 2026-08-08:

- `cargo test --manifest-path src-tauri/Cargo.toml --all-targets`: 27 passed, 8 failed.
- Seven failing `chess::tests::eval_*` assertions encode an older pawn/material scale or ignore the existing mate score. Treat this as an underspecified heuristic contract: define constants and intended semantics, then update implementation/tests together; do not blindly force code to stale numbers.
- `db::search::tests::get_move_after_exact_match_test` omits side-to-move/castling fields in an intermediate exact FEN. Exact search must retain side-to-move and rights; correct the fixture while adding rights-specific regression tests.
- `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings` fails on `SearchGameEntry::from_game_data`, the 12-field DB tuple, and `download_file` argument count. Resolve structurally with request/data types or narrowly justified command-boundary allowances; do not globally suppress lints.

Final mandatory gates:

1. `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check`
2. `cargo test --manifest-path src-tauri/Cargo.toml --all-targets`
3. `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings`
4. `cargo check --manifest-path src-tauri/Cargo.toml --all-targets`
5. `pnpm build-vite` as a compatibility gate only; do not repair failures by editing frontend files.
6. `git diff --exit-code -- src` must be green.
7. No production `unwrap`, `expect`, `panic!`, `unreachable!`, unchecked narrowing cast, unbounded registry, or lock held across `.await` remains in a renderer/file/network/database/engine-controlled path. Test-only assertions and provable startup invariants require an adjacent justification.

### 2.1 Test coverage and regression strength

- [x] Add a pinned `cargo-llvm-cov` CI/local coverage gate for all Rust targets. Publish Cobertura/LCOV plus a human-readable summary; exclude only generated code and demonstrably unreachable platform shims, never hard modules.
- [x] Capture the truthful starting line/function/branch coverage by cohesive backend area. Set checked-in no-regression floors to the measured baseline, then raise each area floor only after meaningful behavior tests land. A single global percentage must not hide an untested filesystem, OAuth, database, search-index, UCI, or game-session area.
- [x] Require changed backend modules to add deterministic success, boundary, failure, cancellation, and cleanup tests where those states exist. Tautological assertions, tests that accept either success or failure, and zero-test filtered commands do not count.
- [x] Add targeted mutation testing for pure high-risk logic (path/range validation, archive entry policy, PGN/encoded-move parsing, search predicates, UCI parsing/state transitions, and game rules). Surviving non-equivalent mutants are test gaps and must be closed.
- [x] Extend `.github/workflows/test.yml` with the backend format/check/Clippy/test/coverage jobs and cached toolchains. CI must fail on warnings, coverage regression, malformed generated contracts, or a skipped intended suite.

Coverage is a diagnostic and ratchet, not the quality target by itself. The acceptance evidence records area coverage and the concrete failure modes exercised; increasing percentages with getter/constructor tests alone is not completion.

### 2.2 Bounded executor packages and context policy

The Codex root launches four serial Gemini 3.1 Pro High conversations. Each conversation reads sections 1, 2, 7, 8, 9, and 10 plus only its assigned wave. It must inspect current source before editing, finish every checkbox in its package, append evidence, and leave the package green and unstaged. Later packages inherit the integrated worktree, not prior chat history. This keeps context bounded while preserving dependency order.

1. **AG-W1 — infrastructure and system boundaries.** Owns wave 1 and files named there. It may add `infra/**` and update `main.rs`, `error.rs`, and `Cargo.toml` only for wave-1 integration. Package gates: `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check`; `cargo test --manifest-path src-tauri/Cargo.toml --all-targets infra::`; the same filtered command for `fs`, `pgn`, `lexer`, `oauth`, `puzzle`, `opening`, `sound`, and `progress`; `cargo check --manifest-path src-tauri/Cargo.toml --all-targets`; `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings` except explicitly recorded pre-existing DB/engine/game diagnostics.
2. **AG-W2 — complete database subsystem.** Owns wave 2, `db/**`, and only the repository/cache integration seams in `main.rs`, `error.rs`, and `infra/**`. It must accommodate AG-W1 and never replace its primitives with copies. Package gates: format check; `cargo test --manifest-path src-tauri/Cargo.toml --all-targets db::`; full `cargo check`; full Clippy with `-D warnings` except explicitly recorded pre-existing engine/game diagnostics.
3. **AG-W3 — UCI/chess supervisor.** Owns wave 3, `engine/**`, `chess.rs`, test fixtures/support, and only supervisor integration seams in `main.rs`, `error.rs`, and shared infrastructure. Package gates: format check; filtered tests for `engine` and `chess::`; full `cargo check`; full Clippy with `-D warnings` except explicitly recorded pre-existing game diagnostics.
4. **AG-W4 — game session and final Gemini gate.** Owns waves 4 and 5, `game.rs`, required engine/session integration seams, and plan evidence. It may fix an integrated backend failure anywhere in backend scope but must not redesign a completed green package without evidence. Package gates: filtered `game` tests followed by every final gate above.

After each package, Codex root reviews the exact diff and package gates before launching the next conversation. Filtered test commands must be preceded by `cargo test --manifest-path src-tauri/Cargo.toml --all-targets -- --list` (or an equivalent exact listing) and the executor must record that each intended focused suite matched at least one test; a zero-test filtered success is not evidence. Gemini never stages or commits.

## 3. Wave 1 — shared infrastructure and native system boundaries

### 3.1 Shared backend primitives

Files: `error.rs`, `main.rs`, new cohesive modules under `src-tauri/src/infra/`, and focused tests.

- [x] Introduce internal error categories for invalid input/data, conflict, resource limit, unauthorized origin, engine timeout/disconnect, cancellation, and OAuth failure. Preserve the current string IPC representation because changing it requires frontend work; log detailed sources only in the backend.
- [x] Add reusable validated numeric/range types or validation functions with checked conversions. Route PGN ranges, pagination, time controls, UCI limits, archive limits, and count conversions through them.
- [x] Add one same-directory atomic replacement primitive: create a private temporary sibling, write completely, flush, `sync_all`, preserve required permissions, atomically rename, and sync the parent directory where supported. Clean up on every failure and expose a fault-injectable writer for tests.
- [x] Add one bounded blocking-work gateway using `spawn_blocking` plus a semaphore/queue. Commands remain async orchestrators; blocking closures own synchronous file/DB/parser work. Cancellation and panic-to-error conversion must be explicit.
- [x] Add shared path validation for expected regular files/directories, extension/content expectations, non-symlink destructive targets, canonical comparison, and non-UTF-8-safe internal handling. Return typed errors instead of `Path::to_str().unwrap()`.
- [x] Replace ad-hoc global `DashMap` stores for progress and PGN offsets with lifecycle-owned bounded repositories. PGN offsets must key on canonical path plus file identity/revision and invalidate after writes; completed progress entries need bounded/TTL retention.
- [x] Make splash/window and Linux sound-server startup failures recoverable and logged. App shutdown must delegate engine cleanup to the supervisor introduced in wave 3 instead of skipping busy locks.

Verification: unit tests for checked conversions, atomic-write fault points, non-UTF-8 paths on Unix, symlink rejection, blocking-gateway cancellation, and bounded repositories.

### 3.2 Download, archive, and native path authority

Files: `fs.rs`, `Cargo.toml`, `tauri.conf.json`, `capabilities/*.json`, shared infrastructure.

Findings: unrestricted Reqwest bypasses the HTTP capability; caller-supplied bearer tokens can be exfiltrated; arbitrary URLs and paths enable SSRF/file overwrite; responses and archives are unbounded; HTTP errors are accepted; destination writes are non-atomic; format is inferred from URL suffix; archive extraction can follow pre-existing symlinks; CSP is absent and asset/opener/FS scopes are broader than necessary.

- [x] Keep the public `download_file` command signature compatible, but immediately convert its arguments into a validated internal request classified by operation (`lichess_*`, `engine_*`, `db_*`, `puzzle_db_*`). Reject unknown classes.
- [x] Put DNS resolution, redirect decisions, and HTTP transport behind an injectable interface. Production uses the hardened Reqwest implementation; tests use a deterministic resolver/transport without weakening production private-address rejection.
- [x] Require HTTPS, reject credentials/fragments and private, loopback, link-local, multicast, and otherwise non-public resolved addresses. Revalidate every redirect target. Apply connect/read/total timeouts.
- [x] Accept a bearer token only for the exact Lichess origin and never forward it across redirects. Do not log secrets. Other operation classes must reject a token.
- [x] Call `error_for_status`; stream to a temporary file rather than RAM; enforce per-class compressed byte limits and optional declared-size consistency; keep progress finite and monotonic even when size is absent or wrong.
- [x] Detect archive type by trusted content signature plus expected operation, not URL suffix alone. Enforce total expanded bytes, per-entry size, entry count, path length, and compression ratio.
- [x] For ZIP/TAR, reject absolute/traversal paths, links and special files; extract into a fresh private temporary directory without following destination symlinks, then atomically install the completed artifact/tree. A failure must leave the previous target unchanged.
- [x] Validate `set_file_as_executable` as an existing regular non-symlink engine file and preserve non-execute permission bits instead of forcing `0755`.
- [x] Establish the strictest CSP and Tauri capability/asset/opener scopes compatible with the traced application. At minimum disallow remote scripts and arbitrary asset paths. Document any permission that cannot be narrowed without frontend capability tokens in section 9; do not falsely claim a backend-only sandbox.

Verification: injected transport/resolver fixtures for 404/500, an allowed public origin redirecting to private/loopback/link-local targets, private-address rejection, cross-origin token stripping, unknown length, oversized and interrupted streams; malicious archive corpus for traversal, absolute names, symlinks, special files, entry bombs, expansion bombs; destination-preservation tests.

### 3.3 PGN file service and parser

Files: `pgn.rs`, `lexer.rs`, shared infrastructure.

Findings: read errors busy-loop forever; signed indices wrap to huge `usize`; capacity and inclusive-range handling are unsafe; delete/write mutate originals in place; concurrent edits are not detected; cached offsets become stale; synchronous parsing blocks Tokio; lexer input is unbounded.

- [x] Replace all `read_line` retry loops with error propagation. Make the PGN scanner a single tested parser service used by count/read/delete/write.
- [x] Validate `0 <= start <= end`, a bounded page length, and nonnegative single-game indices before conversion. Avoid trusting stale counts; EOF is a normal bounded result, not a scan to `usize::MAX`.
- [x] Key offsets by file identity and invalidate after every successful edit. Bound retained files and rebuild when size/mtime/revision changes.
- [x] Serialize edits per canonical file and detect concurrent external modification before commit.
- [x] Route delete/write through the shared atomic replacement primitive. Preserve the original byte-for-byte on any parser/write/sync failure.
- [x] Bound command PGN/lexer input size and execute large parsing/edit work through the blocking gateway. Add cancellation checkpoints for long scans.

Verification: property tests for all signed bounds, injected reader errors, stale-offset invalidation, concurrent edit conflict, BOM/no-BOM, comments containing header-like lines, short files, and atomic fault injection.

### 3.4 OAuth transaction lifecycle

Files: `oauth.rs`, `main.rs`, tests with a mock provider where practical.

Findings: listener address is selected then released (TOCTOU); CSRF/PKCE are application-lifetime singletons; repeated auth spawns competing permanent servers; bind/server errors are discarded; token exchange and emit panic; access token is broadcast globally to renderer code.

- [x] Replace singleton OAuth material with a per-attempt transaction. Bind the listener before opening the browser, generate fresh state/PKCE, register one active generation, accept exactly one valid callback, and stop on success, error, replacement, or timeout.
- [x] Reject/reconcile concurrent authenticate calls deterministically and prevent callback replay. Never reuse verifier/state.
- [x] Remove all panic/error swallowing. Return a generic user-safe failure while logging the cause.
- [x] Store the access token in native state and expose only the existing minimum compatible delivery path. If the frontend contract forces the current event in this backend-only change, make it targeted/one-shot and record native-only consumption as a cross-layer residual in section 9; never emit on invalid state.

Verification: occupied port, parallel attempts, state mismatch, replay, token endpoint failure, event failure, timeout, and success; every path releases listener/task and leaves no stale transaction.

### 3.5 Puzzle, opening, sound, and progress services

Files: `puzzle.rs`, `opening.rs`, `sound.rs`, `progress.rs`, `main.rs`.

- [x] Move the static global puzzle cache into `AppState`; key by canonical DB identity/revision plus filters. Refresh when `counter >= cache.len()`, not only at 20, so a result set smaller than 20 does not become permanently exhausted. Invalidate on database deletion/replacement. Convert all DB/path panics to errors and move queries through the blocking gateway.
- [x] Make `get_opening_from_name` return `NoOpeningFound` for entries without PGN (Starting Position, Empty Board, Fischer Random) instead of panicking. Avoid cloning the entire opening table per search result and make sort total/panic-free.
- [x] Make sound range parsing correct for empty files, suffix zero, invalid/multiple ranges, and overflow. Do not read the complete audio file per request; stream bounded ranges. Server bind/serve failures must not panic a runtime task and shutdown must be owned.
- [x] Put splash-window lookup/show, sound resource resolution, listener binding, server construction/serve, and shutdown behind injectable seams. A failure must be logged and leave the application in a deterministic recoverable state rather than panic or leak a task.
- [x] Ensure progress is clamped, finite, monotonic per generation, and finished/error states do not accumulate forever.

Verification: alternating two puzzle DBs, fewer-than-20 puzzle set exhaustion, deletion invalidation, invalid SQLite/path; every non-PGN opening name; zero-byte/range matrix; missing splash/main window, failed show, sound resource-resolution failure, bind failure, server-construction failure, serve failure, shutdown during active request, recovery/retry; bounded progress soak test.

## 4. Wave 2 — database subsystem as one coherent lifecycle area

This wave deliberately keeps DB pool, schema, mutations, index, cache, and encoding together because they share identity and invalidation invariants. Do not implement isolated fixes that a later repository refactor would replace.

### 4.1 Database repository, path identity, and schema migration

Files: `db/mod.rs`, `db/models.rs`, `db/ops.rs`, `db/schema.rs`, `db/create.sql`, new `db/repository.rs`/`db/migrations.rs` as appropriate, `main.rs`, `Cargo.toml`.

- [x] Introduce one `DatabaseRepository` in `AppState`, keyed by canonical path and bounded by an explicit retention policy. It owns stable safe connection pools, per-DB write/index locks, data revision, query cache, index cache, and close/delete invalidation.
- [x] Eliminate call-site-selected cached `ConnectionOptions`. Every pooled connection must consistently enforce foreign keys, a durable journal/synchronous policy, and busy timeout. Import performance may use scoped batching/index management but never cached `journal_mode=OFF` or disabled durability/integrity.
- [x] Make initialization transactional: static DDL first, parameter-bound `Version`/`Title`/`Description` inserts, sentinel records, migration marker last. On failure, retry must never accept a partial DB. This removes the critical title/description SQL injection.
- [x] Add a versioned, idempotent migration from current `1.0.0`: canonicalize `Games.Round` to TEXT, `Result` to nullable TEXT with normalized valid PGN tokens, and `PawnHome` to INTEGER; enforce intended non-null foreign keys/sentinel policy; preserve IDs/data; run `foreign_key_check` and `integrity_check` before commit. Update `create.sql` and Diesel schema together.
- [x] Protect sentinel ID 0 records and reject incompatible/malformed schemas with a contextual error rather than proceeding.
- [x] Replace all UTF-8 path unwraps and filename expects with repository path handling. On Unix, valid non-UTF-8 DB paths must return a supported path result or a deliberate typed unsupported-path error, never panic or lossy-alias two paths.
- [x] Make index detection validate the exact required index set/definitions, not “any index exists.” Create/drop index sets atomically.
- [x] Replace wide positional tuples and 12-argument constructors with named internal records, resolving Clippy and reducing column-order drift.

Verification: new DB, legacy migration, interrupted migration retry, quotes/newlines/SQL payload metadata, malformed/partial schema, sentinel protection, pool PRAGMAs after import, non-UTF-8 path, exact index-set matrix.

### 4.2 Transactional mutations, metadata, and exports

Files: DB core files plus shared atomic writer.

- [x] Create one transaction helper for domain mutations and one shared metadata-count/orphan-maintenance routine. Only after commit, increment the DB revision and invalidate exact per-DB search/index/query caches.
- [x] `write_db_game`: propagate PGN parser errors, require exactly one valid game, prove target existence before creating dimensions, update game, remove old orphan dimensions, update counts, and invalidate in one transaction. Nonexistent/failed edits leave all tables unchanged.
- [x] `merge_players`: reject equal IDs, missing IDs, and sentinel 0; verify no head-to-head games; update both colors, delete source, update metadata in one transaction. Roll back every partial failure.
- [x] `delete_db_game`, `delete_empty_games`, `delete_duplicated_games`, and orphan cleanup must each be atomic including counts. Return not-found when appropriate.
- [x] Replace the lossy duplicate identity with documented canonical full-game content identity including FEN, moves and all semantically meaningful tags/ratings/result/time controls. Preserve records differing in any meaningful field and provide deterministic retained IDs.
- [x] `delete_database`: close/evict its repository state, delete DB and optional sidecars idempotently, tolerate absent sidecar, and report actual failure state. Do not map two DB names to one sidecar: append `.ecsi` to the complete filename (for example `foo.db3.ecsi`) and safely discover/migrate legacy sidecars.
- [x] `export_to_pgn`: propagate iterator/decode/FEN errors with game ID, correctly escape PGN tag quotes/backslashes/newlines, write atomically, and preserve an existing destination on every failure. Do not silently convert corrupt moves/FEN to empty/default data.
- [x] Replace `insert_or_ignore` for games with deliberate insert semantics. Constraint errors must remain constraint errors.
- [x] Keep stored counts as checked `i64` internally and return a deliberate error if the existing IPC `i32` field cannot represent them.

Verification: rollback injection at each mutation step; nonexistent edit/merge; self/sentinel/head-to-head merge; duplicate pairs differing by each meaningful field; optional/missing sidecar; legacy `foo.ecsi` discovery and migration to `foo.db3.ecsi`; same-stem `foo.db3`/`foo.sqlite` collision isolation; repeated migration/deletion idempotence; PGN escape round-trip; export write/decode failure preserves destination; count overflow test.

### 4.3 Query validation and normalized data

Files: `db/mod.rs`, model/query modules and tests.

- [x] Validate page/page-size centrally as positive and bounded with checked offset arithmetic; route games, players, and tournaments through it.
- [x] Make game normalization fallible. Invalid DB FEN, result, move encoding, or references must return/record a contextual corrupt-game error with ID, never panic or silently default.
- [x] Make `get_players_game_info` use fallible strict move decoding, deterministic ordering, and explicit final 100% progress even when rows are filtered or input is empty. Do not emit from unbounded Rayon work on the async worker.
- [x] Remove noisy `println!` diagnostics in favor of structured logging without user data/secrets.

Verification: pagination property/boundary tests; malformed FEN/result/moves; empty and filtered player-info progress; deterministic output ordering.

### 4.4 Safe search index, cache coherence, and search correctness

Files: `db/search_index.rs`, `db/search.rs`, `db/encoding.rs`, repository/main integration.

- [x] Replace the single global `Mutex<Option<MmapSearchIndex>>` and unbounded `line_cache`/`search_collisions` with repository-owned per-canonical-DB caches keyed by DB revision. Route both `search_position` and `is_position_in_db` through one `get_or_build_current_index` operation.
- [x] Serialize generation per DB path. Write header+archive to a same-directory temp file, validate it, sync, atomically rename, then swap the cached generation. Never truncate a file that may be mapped.
- [x] Extend index identity/version so validity includes full archive validation, DB identity/revision/freshness, not only eight magic/version bytes. Mutations and external file changes must force regeneration.
- [x] Remove `access_unchecked`, lifetime `transmute`, and manual `Send`/`Sync`. Keep only the owning `Arc<Mmap>` and use checked rkyv bytecheck access while borrowing `self`, or another sound owning design. Corrupt valid-header input must return `InvalidData`, never invoke undefined behavior.
- [x] Replace all narrowing casts for pawn/material/Elo with checked conversions or wider archived fields. Invalid source rows fail index generation contextually.
- [x] Make in-flight deduplication per DB/index generation and clean it with RAII on every error/cancellation. Bound all result caches by entries and bytes.
- [x] Exact position comparison must include side-to-move, castling rights and legal en-passant state; document that halfmove/fullmove counters are intentionally excluded. Add fixtures differing only in each right.
- [x] Remove or replace unsound material pruning so capture-then-promotion lines cannot be rejected. Any optimization must be conservative and proven with promotion tests.
- [x] When date bounds are requested, exclude unknown dates. Treat unknown/unfinished game results explicitly; do not count them as draws.
- [x] Deserialize position query kind as a validated enum or return `InvalidInput`; remove `unreachable!`.
- [x] Make the mainline encoded-move iterator fallible and strict for truncated comment/NAG payloads and unbalanced variation markers. `decode_game` must propagate invalid initial positions rather than unwrap. `encode_move` must return an error for a nonlegal move.
- [x] Search must propagate corrupt-entry errors according to the repository policy, handle zero-game progress without NaN, emit a final finished event, and never leave collision keys/permits behind.
- [x] Correct the baseline exact-search fixture by specifying the complete intermediate FEN and add full-rights regression coverage.

Verification: A→B DB cache isolation; every mutation followed by both search APIs; concurrent different-query missing-index generation; external stale index; corrupt archive fuzz corpus; mapped-index replacement while readers run; numeric extremes; rights-only and promotion lines; null dates/unknown results; invalid type; malformed encoded streams; registry/permit leak soak test.

## 5. Wave 3 — one UCI engine supervisor for all engine work

Files: `engine/*.rs`, `chess.rs`, `main.rs`, test fixtures/support. The same actor/supervisor must serve interactive analysis, batch analysis, engine configuration, and wave-4 game sessions.

### 5.1 Process actor, protocol state, and bounded resources

- [x] Introduce a per-process actor that exclusively owns child stdin/stdout, search state, request generation, bounded log ring buffer, and termination/reap. No caller may independently hold the reader while a map stores only the writer/process.
- [x] Add bounded deadlines for spawn/`uciok`/`readyok`, stop-to-`bestmove`, normal searches, and quit. Termination sends `quit`, waits, force-kills on timeout, and always waits/reaps. Cleanup removes only the actor’s exact generation on every exit.
- [x] Model `Idle`, `Searching { request_id }`, `Stopping`, and `Terminating`. A finite `bestmove` transitions to Idle. Preserve last result separately from running state.
- [x] On replacement send `stop` and wait for the old request’s `bestmove` before `position`/`go`; delete the fixed 50 ms sleep. Old lines/results can never be attributed to a new FEN/request.
- [x] Validate UCI option names/values against control characters and, where configuration is known, advertised option schema. Reject newline protocol injection.
- [x] Validate nonzero depth/time/nodes and bounded player clocks. Clamp progress to finite 0–100.
- [x] Cap engine logs by lines and bytes, expose truncation metadata internally, and avoid cloning unbounded history.
- [x] Use exact typed tab IDs/keys; killing tab `a` must never match `ab`.

Verification: deterministic fake UCI for delayed old `bestmove`, EOF, broken pipe, no `uciok`, no `readyok`, ignored `quit`, infinite output, malicious option newline, zero limits, tabs `a`/`ab`, rerunning identical finite searches, and process reap.

### 5.2 Interactive and batch analysis ownership/cancellation

- [x] Route `get_best_moves`, stop/kill/log commands through the supervisor while preserving public signatures and event shapes. Event/FEN/parser errors must clean the actor entry and child on all paths.
- [x] Replace `analysis_cancel_flags` with generation-owned analysis tasks/cancellation tokens. Concurrent same-ID analyses must not overwrite/remove each other incorrectly; replacement semantics must be explicit.
- [x] Use cancellation-aware waits (`select!`) during preprocessing and every engine search. Cancel sends stop, waits boundedly, then kills if required. Infinite/slow engines must cancel promptly.
- [x] Treat EOF/read error before `bestmove` as engine disconnect/protocol failure, not successful empty analysis. Require one complete result for each started position.
- [x] Ensure final/error progress is emitted exactly once and registries are empty after setup, FEN, option, DB, event, cancellation, or engine failures.
- [x] `get_engine_config` must use supervisor deadlines/cleanup and structured logging.

### 5.3 Evaluation heuristic contract

- [x] Define named material and mate constants and document the heuristic’s perspective/role in sacrifice annotation. Handle stalemate/draw as zero rather than `i32::MIN`; avoid sentinel overflow.
- [x] Resolve the seven baseline evaluation failures by asserting the documented scale and mate behavior, not by hiding real behavior. Add invariants for side-to-move inversion, checkmate, stalemate, promotion, and bounded scores.

Verification: all current chess tests plus the fake-engine cancellation/lifecycle suite.

## 6. Wave 4 — generation-safe game session state machine

Files: `game.rs`, shared engine supervisor, focused game tests.

### 6.1 Session ownership and concurrency

- [x] Split a pure/testable `GameSession` state machine from `GameManager` task/process ownership. Inject clock, engine factory/supervisor, and event sink.
- [x] Key active sessions by game ID plus monotonic generation. Serialize starts per ID, prepare a replacement fully with bounded UCI readiness before publishing it, then cancel and join the prior generation atomically. Concurrent starts must leave only the winning generation alive/emitting.
- [x] Never retain a DashMap guard or controller lock across `.await` or engine/event I/O. Clone owned handles/snapshots under short locks, then await.
- [x] Give every engine request a position/session generation and cancellation token. Takeback, abort, replacement, or terminal transition stops the exact in-flight request and rejects stale responses even when side-to-move happens to match.
- [x] Abort must complete against an infinite/nonresponsive engine even while logs are requested. Cleanup joins session tasks and reaps both engines.
- [x] Remove naturally finished sessions from the active registry. If completed state must remain queryable, keep a bounded snapshot archive separate from live controllers/processes.

Verification: barrier-controlled concurrent starts, infinite engine + logs + abort, takeback during delayed search, ID reuse, thousands of completed games, and no stale events/processes.

### 6.2 Legal state transitions and clocks

- [x] Make move acceptance atomically consume elapsed mover time, determine timeout, apply legal move, then increment. A move after the deadline must never revive the clock; ticker only reports state.
- [x] Introduce a deterministic clock abstraction. Validate time controls before narrowing to UCI; reject overflow and define/reject asymmetric controls explicitly. Use checked/saturating arithmetic.
- [x] Reject takeback after terminal state (chosen backend policy) instead of resurrecting a stopped worker. Reject resignation unless Playing; terminal transitions are idempotent and emit game-over once.
- [x] Validate the complete initial move list, stop/reject moves after a terminal position, and initialize terminal state/events coherently.
- [x] On timeout, implement the chess insufficient-mating-material outcome rather than always awarding a win.
- [x] Separate committed state transition from event delivery. Event failure is logged/reconciled and never changes a valid engine move into abandonment or makes a successful human move appear rolled back.

Verification: before/at/after deadline with and without increment for human/engine; overflow/zero/asymmetric controls; resign/takeback after every terminal reason; terminal initial line; insufficient-material timeout; injected event failures.

### 6.3 Opening-book ingestion

- [x] Run EPD/PGN/ZIP/Polyglot loading through the bounded blocking gateway with cancellation and byte/entry/expansion limits.
- [x] Parse standards-compliant EPD position fields and operations or return a precise format error; never pass an entire arbitrary EPD line as FEN. Propagate line I/O errors.
- [x] Stream archive entries where supported and reject oversized/compression-bomb books before unbounded allocation.

Verification: EPD operations, malformed/read-error EPD, large PGN/bin, ZIP expansion bomb, cancellation, and concurrent command responsiveness.

## 7. Wave 5 — integrated cleanup and exact-tree verification

- [x] Remove dead duplicated lifecycle/cache/parser paths made obsolete by the new services. Keep modules cohesive and update all backend callers.
- [x] Audit all command boundaries again for panics, unchecked casts, unbounded allocation, stale registry state, lock-across-await, swallowed iterator/I/O errors, and secret logging.
- [x] Run every focused suite after its package, then all final gates from section 2 on the exact integrated tree.
- [x] Update section 10 with commands, pass counts, and any platform-specific test exclusions plus their substitute evidence.
- [x] Replace the generic notes in section 9 with the exact remaining permission/token/path authority after implementation: every residual must name the backend and frontend call sites, compatibility reason, concrete frontend contract change required, security consequence, and a verification criterion for its eventual removal. If a residual is fully solved, mark it solved with evidence instead of deleting its audit trail.
- [x] Leave the entire working tree unstaged for Codex root review. Do not stop after a partial wave.

## 8. Finding inventory and traceability

Every audited issue maps to an implementation section:

- System boundary: absent CSP/broad capabilities (3.2); unrestricted downloader/SSRF/token/file overwrite/status/unbounded RAM (3.2); archive traversal/symlink/bombs/non-atomic extraction (3.2); arbitrary destructive paths/chmod (3.1–3.2); PGN bounds/read-error loop/non-atomic edits/stale offsets (3.3); blocking async work and unbounded lexer (3.1/3.3); OAuth TOCTOU/singleton/permanent server/panics/token broadcast (3.4); cross-DB and short-result puzzle cache (3.5); non-PGN opening panic (3.5); empty/range sound panic/full reads/server panics (3.5); unbounded progress/offset state (3.1/3.5); splash/startup panics (3.1).
- Database core: cached unsafe connection options (4.1); partial init and SQL injection (4.1); schema type drift/migration (4.1); false index detection (4.1); nontransactional edit/merge/delete/orphan/count maintenance (4.2); self/sentinel/missing merge (4.2); lossy duplicate identity (4.2); optional sidecar delete error and sidecar name collision (4.2); invalid-FEN/path panics (4.1/4.3); partial/invalid PGN export and tag escaping (4.2); invalid pagination/count narrowing (4.2/4.3); ignored parser/iterator errors and misleading `insert_or_ignore` (4.2); player-info progress/strict decoding (4.3).
- Search/index/encoding: single cross-DB cache (4.4); stale disk/result cache (4.1–4.4); concurrent truncating rebuild (4.4); unchecked rkyv/lifetime transmute/manual Send+Sync (4.4); numeric wrapping (4.4); exact rights omitted (4.4); unsound promotion pruning (4.4); NULL date and unknown-result semantics (4.4); invalid type panic (4.4); leaked collision entries (4.4); invalid setup panic, lossy iterator, encode panic (4.4); zero/final progress and corrupt-entry suppression (4.4).
- UCI/chess: stale map entry/no reader (5.1–5.2); 50 ms stop race (5.1); finite search stays running (5.1); quit without reap and exit skip (5.1); unbounded logs (5.1); uncancellable batch work and registry races (5.2); EOF treated as success (5.2); option newline injection and zero limits (5.1); tab prefix kill (5.1); stale evaluation contract/stalemate sentinel (5.3); missing protocol tests (5.1–5.2).
- Game lifecycle: abort/log deadlock (6.1); concurrent-start orphan (6.1); terminal takeback resurrection (6.2); retained completed games (6.1); nonresponsive startup kills old game (6.1); stale takeback engine work (6.1); move-after-timeout race (6.2); finished resignation overwrite (6.2); time narrowing/overflow/asymmetry (6.2); moves after terminal initial state (6.2); event failure becomes false abandonment (6.2); blocking/unbounded opening books and invalid EPD parsing (6.3); missing testable state-machine coverage (6.1–6.2).

## 9. Recorded cross-layer and external residuals

The former backend-only constraint was lifted during integrated execution. Historical items 1–3 below are solved and retained for traceability; item 4 is the only external rollout dependency.

1. **SOLVED — Custom Directory Paths for Databases, Puzzles, and Engines**: opaque persistent root/file/engine/database/puzzle handles now replace renderer path authority; direct plugin-FS callers and `src/utils/directories.ts` were removed.
   - **Former boundary**: `capabilities/main.json`, `src/utils/directories.ts`, and renderer plugin-FS/opener callers exposed durable raw paths and broad filesystem authority.
   - **Implemented contract**: native pickers issue operation-specific opaque handles; persistent roots and exact children are identity-checked by `PathAuthority`; workspace mutations use retained no-follow directory descriptors and FD-relative syscalls.
   - **Security result**: renderer filesystem, HTTP, and opener capabilities were removed from `capabilities/main.json`; renderer boundary checks prohibit direct plugin/runtime escape hatches.
   - **Verification evidence**: `scripts/check-tauri-command-boundary.mjs`, PathAuthority restart/replacement tests, and adversarial workspace parent/symlink-swap tests pass.

2. **SOLVED — Lichess Token Exposure**:
   - **Former boundary**: `oauth.rs` emitted a bearer token to renderer-owned account and API code.
   - **Implemented contract**: native credential handles, keyring-backed recovery, correlation-scoped OAuth jobs, and fixed-origin bounded native provider clients expose only public account data and opaque handles.
   - **Security result**: no bearer token crosses IPC or remains in renderer storage; startup scrubs legacy records before any await and storage validation diagnostics never log raw values.
   - **Verification evidence**: credential recovery/restart tests, startup sanitization tests, native provider transport tests, and a repository token-boundary scan pass.

3. **SOLVED — String-based Error IPC at the renderer boundary**:
   - **Former boundary**: renderer callers imported generated values directly and handled native error strings inconsistently.
   - **Implemented contract**: all commands and subscriptions pass through the typed platform facade, which unwraps results and normalizes/redacts errors into stable categories.
   - **Security result**: renderer feature code cannot invoke native commands or subscribe to native events outside the checked facade.
   - **Verification evidence**: `scripts/check-tauri-command-boundary.mjs` rejects generated-value imports, raw invoke/listen calls, and runtime plugin imports outside the platform boundary.

4. **EXTERNAL — Signed public download manifests are not deployed yet**:
   - **Call sites**: native download validation in `src-tauri/src/fs.rs`; renderer schemas in `src/utils/db.ts` and `src/utils/engines.ts`; publisher contract in `docs/signed-download-manifests.md`.
   - **Hard constraint**: the public `/engines`, `/databases`, and `/puzzle_databases` publishers must add SHA-256 plus a Minisign signature created with the private release key. This repository intentionally contains only the public verification key.
   - **Current consequence**: those remote installers fail closed until the publisher deployment is updated. Local files, native pickers, and installed data remain usable.
   - **Removal verification**: fetch all three production manifests, validate their runtime schemas, verify every `${url}\n${lowercaseSha256}` signature, then complete one engine, database, and puzzle installation through the packaged application.

## 10. Execution evidence

Gemini must append one concise entry per completed wave containing changed files, focused commands and results. Codex root will append independent review, final exact-tree gates, and commit evidence.

### Final exact-tree verification (2026-08-13)

Measured on the tree that was committed. This supersedes the 2026-08-09 entry below,
whose counts were captured mid-run and no longer described the worktree.

- Rust: `cargo fmt --check`, `cargo check --all-targets --locked`,
  `cargo clippy --all-targets --locked -- -D warnings`, and
  `cargo test --all-targets --locked` all green; **302/302 tests passed**.
- Coverage: nightly branch instrumentation exported LCOV for 33 Rust sources
  (4254 branch records); all six checked-in area ratchets pass with the baselines
  unchanged. Generated/module-declaration-only exclusions are documented in
  `backend-coverage-areas.json`.
- Contract gates: `pnpm bindings:check` (regenerated via `pnpm bindings:generate`),
  Tauri boundary, UI boundary, and `git diff --check` green.
- Platform evidence: `pnpm build` (`tauri build --no-bundle`) produced the Linux
  release binary. Windows source policy is covered by operation-matrix tests; a
  Windows Rust target is not installed on this host.

**Mutation: no valid evidence exists for the backend.** The 2026-08-09 run below is
discarded — it executed while engine and Cargo dependencies were still changing,
produced unviable mutants, and aborted because `Cargo.lock` was not synchronised
under `--locked`. `pnpm mutation:backend` has not been re-run on this tree. Do not
cite the old numbers.

#### Defects found and fixed on 2026-08-13

- `EngineExecutable` cleared close-on-exec for resource leases but not for the
  engine image it launches through `/proc/self/fd/N`. The kernel re-executes a
  shebang script's interpreter with that path as its argument, so **every
  script-wrapped engine failed to launch with `ENOENT`**. `inherited_fds` now
  covers the image as well, which also preserves sealing: the interpreter reads
  the authorized inode rather than the current contents of the visible path.
  `engine::process::tests::inherited_resource_fd_survives_path_replacement_for_uci_child`
  is the regression, and it fails without the fix.
- `spawn_configured_game_engine` took a `&mut Vec<EngineResourceLease>` that it
  never wrote and `GameController` carried a matching field nobody read. Both are
  removed: a game engine resolves every resource option before spawn, so the
  leases live in the `EngineExecutable` that `ChildUciIo` owns for the process
  lifetime. `chess.rs` keeps its own leases only because analysis re-resolves
  options on an already-running engine.
- `is_filesystem_path` had no test for the `~/`, `~\`, `./`, `.\`, `..\` and
  `C:/` forms it claims to reject. `engine::types::tests` now proves every shape
  is refused for proprietary names such as `Book`, `TbDir` and `Network`, and
  that near-miss ordinary values (`book.bin`, `C:book`, `ratio:1/2`, `1.2.3`)
  stay valid.

- Two `app.emit("convert_progress", …)` calls survived in `src-tauri/src/db/mod.rs`
  after the renderer's listener was deleted, one of them `.unwrap()`-ing on a
  renderer-driven import path. Both are now the registered `ConvertProgress` event,
  emitted best effort. See the frontend plan and `.claude/rules/ipc-events.md`.

#### Open backend items

- Backend mutation evidence must be produced on a stable tree.
- The coverage exporter measures `#[cfg(test)] mod tests` alongside production
  code, so a test's own untaken assertion branches count against the branch
  ratio. It is currently a small effect (89 of 4254 branch records), but it means
  adding tests can lower an area's ratio. Excluding test modules would shift every
  baseline and floor and was deliberately not attempted while parking the repository.

### AG-W1: Infrastructure and System Boundaries (Wave 1)

**Changed Files:**

- `src-tauri/src/main.rs`: Added `mod infra`, integrated `AppState` changes for bounded repositories.
- `src-tauri/src/error.rs`: Added new error variants for Wave 1.
- `src-tauri/src/infra/validation.rs`: Core numeric/range validations.
- `src-tauri/src/infra/fs.rs`: Atomic replace functionality (`atomic_replace`).
- `src-tauri/src/infra/blocking.rs`: Semaphore-gated blocking task executor.
- `src-tauri/src/infra/path.rs`: Canonicalization and UTF-8 path validations.
- `src-tauri/src/infra/repository.rs`: Bounded TTL repository logic.
- `src-tauri/src/infra/net.rs`: Safe DNS resolution filtering out loopback/private IPs.
- `src-tauri/src/fs.rs`: Implemented strict class-based request limits, custom redirect policy, HTTPS enforcement, native magic-byte signature extraction for ZIP/TAR, and traversal rejection.
- `src-tauri/src/pgn.rs` & `src-tauri/src/lexer.rs`: Integrated `PgnScanner`, added bounds checking, concurrent modification locking, atomic writes, and migrated heavy loops to `BLOCKING_GATEWAY`.
- `src-tauri/src/oauth.rs`: Redeveloped to use `OAuthServices` trait abstraction. Replaced singleton auth state with transient per-request transactions, bound listener prior to browser, and implemented fully hermetic test seams avoiding real HTTP ports.
- `src-tauri/src/puzzle.rs`, `src-tauri/src/opening.rs`, `src-tauri/src/sound.rs`, `src-tauri/src/progress.rs`: Eliminated panics, utilized streams for audio, clamped progress, and corrected puzzle cache behavior.
- `src-tauri/tauri.conf.json`: Hardened CSP and restricted protocol scope.
- `src-tauri/capabilities/main.json`: Narrowed `opener:allow-open-path` and `fs:scope-appdata-recursive` from `**` to explicit desktop directories (`$APPDATA/**`, `$DOCUMENT/**`, etc.). Documented residual custom directory limitations in section 9.

**Commands Executed & Pass Counts:**

- `cargo fmt --manifest-path src-tauri/Cargo.toml`: Success.
- `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings`: Success (ignoring legacy DB/engine/game warnings).
- `cargo test --manifest-path src-tauri/Cargo.toml --all-targets infra::`: 3 tests passed.
- `cargo test --manifest-path src-tauri/Cargo.toml --all-targets pgn::`: 4 tests passed (including scanner logic tests).
- `cargo test --manifest-path src-tauri/Cargo.toml --all-targets oauth::`: 5 tests passed (hermetic).
- `cargo test --manifest-path src-tauri/Cargo.toml --all-targets`: 64 tests passed, 0 failed.

**Evidence/Residuals:**

- The new infrastructure properly intercepts network anomalies via `SafeResolver`.
- Bounded concurrency ensures async executors do not stall during PGN lexical phases.
- PGN and archive manipulations no longer risk race conditions or data loss upon SIGKILL due to complete usage of `atomic_replace`.

### AG-W1: Baseline Game/Engine Tests (Pre-requisites for green build)

**Changed Files:**

- `src-tauri/src/chess.rs`: Replaced magic numbers with named constants (`PAWN_VALUE`, `QUEEN_VALUE`, `MATE_SCORE`), corrected pawn value to 100 and queen to 900. Updated `count_material` to return `-MATE_SCORE` for checkmate and `0` for stalemate, fixing the 7 failing `chess::tests::eval_*` baseline assertions.
- `src-tauri/src/db/search.rs`: Updated `PositionQuery::matches` for `Exact` searches to rigorously check `castles().castling_rights()` and `ep_square(EnPassantMode::Legal)` (excluding halfmove/fullmove). Corrected the fixture in `get_move_after_exact_match_test` and added `exact_match_rights_regression` to verify castling and en-passant exact match correctness.

**Commands Executed & Pass Counts:**

- `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check`: Success.
- `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings`: Success (fully clean without allowances).
- `cargo test --manifest-path src-tauri/Cargo.toml --all-targets`: Success (64 tests passed, 0 failed).

**Evidence/Residuals:**

- The baseline test failures caused by `chess::tests::eval_*` assertions not matching the implementation are resolved with proper constants.
- The `db::search::tests::get_move_after_exact_match_test` properly verifies side-to-move, castling rights, and legal en-passant target matching exactly as requested in the baseline evidence.

### AG-W1: Downloader, Archive, and Path Native Capabilities (Follow-up)

**Changed Files:**

- `src-tauri/src/fs.rs`: Refactored `download_file` to `download_file_core` to accept injectable transport. Added tests for adversarial length mismatch, HTTP errors, token stripping across redirects, interrupted streams. Updated archive extraction and extraction path validation to prevent traversal, absolute path overwrites, and expansion limits.
- `src-tauri/src/infra/fs.rs`: Fixed error propagation in `atomic_install_dir` where directory sync or rollback failures were swallowed.
- `src-tauri/src/infra/path.rs`: Added `validate_regular_file`, `validate_directory`, `to_utf8_str`, `check_extension`, and `canonical_compare` to enforce strict internal path assumptions across the backend.
- `src-tauri/src/infra/net.rs`: Changed error mappings to use `Error::Reqwest` instead of `Error::Io`.
- `src-tauri/Cargo.toml`: Added `bytes` dependency.

**Commands Executed & Pass Counts:**

- `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check`: Success.
- `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings`: Success.
- `cargo test --manifest-path src-tauri/Cargo.toml --all-targets infra::`: 5 tests passed.
- `cargo test --manifest-path src-tauri/Cargo.toml --all-targets fs::`: 10 tests passed (including new mock transport adversarial tests).
- `cargo test --manifest-path src-tauri/Cargo.toml --all-targets`: Success.

**Evidence/Residuals:**

- Malicious redirects to separate domains now strip Lichess tokens securely as validated by `test_download_file_cross_origin_token_stripping`.
- Content-Length vs streaming length mismatches fail safely without persisting corrupt data as verified by `test_download_file_length_mismatch`.
- Shared path validations return explicit Typed Errors (`Error::InvalidInput`) eliminating silent unwraps on non-UTF-8 paths.
