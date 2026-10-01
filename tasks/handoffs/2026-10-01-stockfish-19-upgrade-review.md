# Stockfish 19 upgrade — reviewed plan and plan-review record (2026-10-01)

Tracked copy of the git-ignored run plan `tasks/plans/2026-10-01-stockfish-19-upgrade.md` at its
closed revision plan-r4, including the complete `## Reviews` history (four Codex lens rounds) and
`## Carried to diff review`. The ignored plan and the raw lens reports under the session
scratchpad may disappear; this file alone suffices to resume implementation.

- **State:** plan review CLOSED. Implementation has NOT started; Felix stopped the run before
  implementation by request.
- **Findings filed by this run:**
  - to be fixed by the plan (O2): `f-20261001-06` (catalog install never persisted) and
    `f-20261001-16` (`.tar.gz` never untarred);
  - deferred: `f-20261001-03`, `-04`, `-05`, `-07`, `-14`, `-15`, `-17`.
- **Orchestrator:** Claude Code (Opus 5.5), session 278a67fd-5c88-4885-829b-ade31a186422.
  Lenses ran on the Codex executor (`leaf-launch.sh read-only`).

---

# Plan: Upgrade the user's engine from Stockfish 18 to Stockfish 19

## Goal

Felix runs Stockfish 19 in ChessFable in place of his Stockfish 18 entry, keeping that entry's
settings. ChessFable must never send a position that Stockfish 19's new strict validation
answers with `info string CRITICAL ERROR` followed by process exit. The same upgrade must be
repeatable for any later catalog version.

## MANDATE

Felix, 2026-10-01 (verbatim): "Currently my only engine is Stockfish 18. I want to upgrade to
Stockfish 19, the newest version. Plan this carefully, review the plan with codex and pause when
the plan is ready." Follow-up: "Plan this carefully and review it with Codex. Only do the plan
review and then give me a handover prompt and stop before the implementation."

Scope amendment, Felix's answer to the upgrade-path question (AskUserQuestion, 2026-10-01):
**"In-app upgrade action"**, meaning a new 'Upgrade from catalog' action in an engine's settings.
Felix picks Stockfish 19. The app downloads and verifies the signed build and swaps it into the
existing entry, keeping that entry's settings, search mode, image and position in the list. Two
clicks for him now, and the same flow for SF20 later.

## Threat model and non-goals

- **Input is accidental, not adversarial.** Sources: PGN `[FEN]` tags, the game-header editor,
  the board editor, user-typed engine options, the bundled signed catalog. The catalog is the
  trust root and is already verified by minisign plus a per-entry signature. No new adversary is
  introduced.
- **Environments:** Linux (Felix's machine, AMD Zen 5), plus the macOS and Windows builds the
  catalog already serves. The upgrade action must work on all three; the Linux real-app run is
  the acceptance environment.
- **Non-goals:**
  - Engines other than Stockfish do not get a protocol audit. The FEN canonicalisation applies to
    every engine because there is one choke point.
  - No automatic update notification or background update check.
  - No change to the catalog contents. SF19 entries already ship in `src/catalogs/engines.json`
    (commit `c8fd767d`).

## Traced premises

Locate evidence (three read-only research leaves plus orchestrator source reads, 2026-10-01):

1. **Felix's stored engine.**
   - Origin: lz-string `engines` key, read from a copy of
     `~/.local/share/com.chessriddle.encroissant/localstorage/tauri_localhost_0.localstorage`.
   - Value: `{"type":"local","id":"26b262cb-…","name":"Stockfish 18","version":"18","handle":{"id":{"id":"ba059fcc-…"},"kind":"engine"},"filename":"Stockfish 18","imageHandle":{…"101907e6-…"},"elo":3650,"loaded":true,"settings":[Threads=20, Hash=8192, MultiPV=4, UCI_ShowWDL=true],"go":{"t":"Infinite"}}`.
   - The entry has no `downloadLink`.
   - Handle `ba059fcc` is a `persistentFile` for `/home/felixb/.local/bin/stockfish-sf18-avx512icl`
     (`~/.config/com.chessriddle.encroissant/path-authority.json`).
   - No `game-player*-settings`, `report-settings` or `detached-engine` keys are stored.
2. **Stockfish 19 release.**
   - Tag `sf_19`, published 2026-09-05.
   - Only universal binaries are shipped.
   - The Linux asset sha256 `9defc0d4…611f`, size 81388977, equals the catalog entry.
   - Archive path: `stockfish/stockfish-linux-x86-64-universal`.
   - Highest required glibc is 2.35; the host has 2.39.
   - The `compiler` command reports `x86-64-avx512icl` on this CPU.
   - Single-thread bench: +9 to +19 % nps over the SF18 avx512icl binary.
   - The universal build therefore loses nothing against Felix's hand-picked binary.
3. **SF19 strict validation** (sf_19 source; 50 measured probes against both binaries; scratchpad
   `sf19/probe18.txt` and `probe19.txt`).
   - On a rejected input, `uci.cpp:697-702` prints
     `info string CRITICAL ERROR: Command \`…\` failed. Reason: …` and calls `std::exit(1)`.
   - It is triggered from `position` (`uci.cpp:523-527`) and from `go`-parameter parsing
     (`uci.cpp:231-232`).
   - Rejected classes:
     - king count not one per side;
     - side not to move in check;
     - pawns on rank 1 or 8;
     - more than 8 pawns, or more promoted pieces than missing pawns, or more than 32 pieces
       (`position.cpp:260-289`);
     - malformed FEN text: bad piece character, rank overflow, board-only FEN, side character
       other than `w`/`b`, junk castling field, more than 4 castling letters, en-passant square
       on the wrong rank (`position.cpp:222-414`);
     - halfmove counter outside 0..32767, fullmove counter outside 0..100000
       (`position.cpp:425-429`);
     - any illegal or malformed move after `moves` (`engine.cpp:203-208`);
     - non-numeric `go` arguments.
   - Unchanged or harmless:
     - an unknown `setoption` name prints `No such option` and the engine keeps running;
     - out-of-range spin values are now ignored silently (`ucioption.cpp:137-158`), where SF18
       aborted on them.
   - Option diff:
     - `EvalFileSmall` is removed;
     - the `EvalFile` default changes;
     - the other 18 options are identical, including Threads 1..1024, Hash 1..33554432,
       MultiPV 1..256 and UCI_ShowWDL.
4. **ChessFable sends.**
   - Every engine `position` line goes through `EngineProcess::set_position`
     (`src-tauri/src/engine/process.rs:2436-2445`), which is used for analysis (`chess.rs:199`)
     and games (`game.rs:3239`).
   - It validates the move list through `normalize_uci_moves_for_fen` (`engine/uci.rs:30-50`).
     That function parses with shakmaty, accepts too much material (`uci.rs:11,36`), and checks
     legality and re-encodes castling for the detected `CastlingMode`.
   - It sends the **original FEN text** (`process.rs:2440`).
   - shakmaty's `TOO_MUCH_MATERIAL` (`shakmaty-0.27.1/src/position.rs:3041-3058`) is a strict
     superset of SF19's material checks. It also separates light-squared and dark-squared
     bishops.
   - `UCI_Chess960` is always derived from the FEN by the backend, and a user-set value is never
     sent (`chess.rs:118-137,172`, `game.rs:1259-1266`).
   - `go` values are capped at 86,400,000 (`engine/types.rs:263-337`), which parses in SF19.
   - FEN text that reaches the engine unchanged comes from:
     - PGN `[FEN]` tags (`src/utils/chess.ts:501` → `treeReducer.ts:89-92`);
     - the game-header editor (`src/state/store/tree.ts:591-593`);
     - play-vs-engine (`BoardGame.tsx:597` → `game.rs:3239`);
     - the report (`ReportModal.tsx:170` → `chess.rs:1247`).
   - The report path is already strict on material (`chess.rs:982`).
   - `GameController::new` parses with the tolerant `parse_fen_to_position` (`game.rs:292`).
5. **Catalog install is never persisted** (defect, measured).
   - `installDefaultEngine` returns `{...engine, …}` (`src/utils/engines.ts:331-346`), which
     includes the catalog-only keys `path`, `sha256`, `signature`, `os`, `bmi2`, `image` and
     `imageUrl`.
   - `inspectEngineOwnerValue` rejects any record where `!equal(value, parsed.data)`
     (`src/state/engineOwnerStorage.ts:101`). Zod strips the unknown keys, so the comparison
     fails and `enqueueEngineOwnerSave` returns `saved:false` with "refusing to persist an
     invalid engine owner record" (`:173-178`).
   - `AddEngine.tsx:229` ignores the receipt and still shows "Installed".
   - Probe, quoted: the install-shaped record yields `null`. The same record without those keys
     yields `{"capabilityIds":["h"],"attachmentIds":[]}`.
   - Later `engines` saves in that session are refused too while the invalid entry stays in the list;
     removing that engine on the Engines page filters it out, after which the remaining valid list can
     be saved again.
6. **Engine supervisor.**
   - `retire_engine` tombstones an engine id and reaps its actors (`process.rs:1567-1597`).
   - `retire_executables` tombstones a PathRef everywhere (`process.rs:1601-…`), and only
     `file_workspace.rs:1352` uses it.
   - Admission refuses a retired id or executable (`process.rs:1098-1112`). A new admission for
     the same key cancels the previous one (`process.rs:1170-1176`).
   - The Duplicate action copies an entry including its `handle` (`EnginesPage.tsx:649-657`), so
     two entries can share one executable.
   - The settings panel is `EngineSettings` in `EnginesPage.tsx:275-697`. It offers Reset,
     Duplicate, Remove and Edit JSON, and no binary replacement.
   - `EditEngine.tsx` has no production importer.
7. **Catalog install mechanics.**
   - `useDefaultEngines(os, opened)` filters the catalog by OS and BMI2 (`engines.ts:298-310`).
   - Install steps: `getEngineWorkspace` → `engineArchiveDestination` → `downloadEngineArchive`
     (sha256 plus signature) → `registerInstalledEngine` → `getEngineConfig` (`engines.ts:314-347`).
   - `getEngineConfig` returns `{ name, options }` (`src/bindings/generated.ts:1152`).
   - An unowned handle is pruned at the next startup (`path_authority/mod.rs:6584-6605`), and the
     referenced file is not deleted.

## Approach

### O1 — Engine-bound positions conform to strict UCI engines

MANDATE words: "upgrade to Stockfish 19". SF19 kills itself on inputs ChessFable sends today
(premise 3 × 4).

- **Required behaviour.** The single choke point `EngineProcess::set_position` sends a FEN that
  ChessFable serialises from the strictly validated root position. It never forwards the received
  FEN text.
  - Strict validation means shakmaty validation **without** `ignore_too_much_material`.
  - Halfmove and fullmove counters are clamped into the range SF19 accepts. Two named constants
    carry that range, with a comment citing `position.cpp:425-429`. The implementer re-reads that
    source to pin the exact bounds and ply semantics; plan text is not the measurement.
  - Moves keep today's normalisation, encoded for the castling mode of the canonical position.
  - The castling-mode detection used for moves and for `UCI_Chess960` stays consistent with the
    serialised castling field.
- **The canonical FEN is wire-only** (R2-01). The request FEN stays the identity of the search.
  `BestMovesPayload.fen` is `process.options.fen` (`chess.rs:512`), and the renderer matches it
  against its own `searchingFen` (`EvalListener.tsx:250-258`). The stored options and every
  payload therefore keep the FEN the renderer sent, and only the line written to the engine
  carries the canonical form.
- **Strict preflight before any engine write** (R1-02). Analysis configuration
  (`chess.rs:112-137`) runs the same strict canonicalisation **before** it writes
  `UCI_Chess960` or any `setoption`. One canonicaliser serves both call sites: the configure path
  and `set_position`. On a rejected position the engine therefore receives no line at all, and
  the configured option state is unchanged.
- **Failure semantics.** A root position shakmaty rejects strictly, too much material included,
  fails with a typed error before anything is written to the engine. The error is mapped at the
  facade like today's invalid-FEN error.
  - Analysis: the existing error toast, with no engine death.
  - A game with at least one engine player refuses to *start* from such a position, through the
    same typed error raised at game creation. It no longer fails mid-game with an engine
    "Abandonment".
  - The game-start refusal reaches the user as its own localised message saying the position
    cannot be played against an engine (R1-14). It is never the generic
    `Board.Opponent.Error.Start` (`src/components/boards/gameCommandError.ts:77-93`).
  - A human-vs-human game keeps today's tolerant parse.
- **Ownership.**
  - `src-tauri/src/engine/uci.rs` (canonicaliser);
  - `process.rs` (choke point);
  - `chess.rs` (configure preflight);
  - `game.rs` (game-start check);
  - `src/components/boards/gameCommandError.ts` plus a translation key (game-start message).
- **Verification level.**
  - Rust unit tests on the canonicaliser, one per SF19 rejection class the canonicaliser now
    covers:
    - board-only FEN;
    - `_` separators, if shakmaty accepts them;
    - out-of-range counters;
    - Shredder castling in standard mode;
    - en passant without a capturer;
    - each too-much-material class, counted **per side** (R1-13): 9 white pawns; white with 8
      pawns plus a third knight (promoted-piece surplus); more than 16 pieces for one side. The
      standard start position, 32 pieces in total, must be accepted;
    - a Chess960 FEN round trip.
  - Recording-actor tests on `set_position`: the exact written line, and nothing written on
    rejection.
  - A recording test on the analysis configure path: a rejected FEN with a changed position
    writes **zero** lines, neither `UCI_Chess960` nor any `setoption` (R1-02).
  - `game.rs` tests (R1-11, R2-02):
    - An engine game from a FEN with real excess material is refused at creation. Fixture: white
      has 8 pawns plus three queens, `4k3/8/8/8/8/8/PPPPPPPP/QQQ1K3 w - - 0 1`.
    - A human-vs-human game from the same FEN still starts.
    - Ten knights and no pawns is legal material and is not a valid refusal fixture.
  - A payload-identity test: a FEN whose canonical form differs (an out-of-range counter) still
    produces `BestMovesPayload.fen` equal to the request FEN (R2-01).
  - A vitest that maps the typed game-start refusal to its localised message.
  - A container e2e case: starting an engine game from the excess-material position shows the
    localised refusal on the board, not the generic start error (R2-03).
  - **Required phase proof, real engine** (R1-01): pipe every canonicalised corpus line, followed
    by `go depth 1`, into the sha256-verified sf_19 Linux binary. Every line must produce a
    `bestmove`, exit 0, and no `CRITICAL ERROR`. The command and its quoted output go into the
    P1 commit message and the run's handoff. A P1 that has not run this probe is not done. It is
    not a CI gate, because CI has no SF19 binary.

### O2 — Catalog installs persist a schema-exact engine record

MANDATE words: "The app downloads and verifies the signed build". The upgrade reuses this
install path, and premise 5 shows its record is refused by owner storage.

- **Required behaviour.** The catalog install pipeline is extracted into one shared function:
  download, verify, register, read config. It returns `{ handle, config, filename }`. Both
  callers, new install (`installDefaultEngine`) and upgrade (O3), use it.
- **A `.tar.gz` catalog asset is extracted as a tar tree** (R2-04, `f-20261001-16`).
  - Today a gzip payload is only decompressed into one file (`src-tauri/src/fs.rs:589-640`,
    `extract_gz_cancellable` at `:1681-1710`). Every Linux and macOS Stockfish asset is
    `.tar.gz`, so its nested executable never exists and registration cannot succeed.
  - A gzip stream whose decompressed head is a ustar archive is extracted through the existing
    tar extractor, with the same per-entry, expanded-size and ratio limits.
  - A plain single-file `.gz` keeps today's path.
- **Version-unique install location** (R1-06). Today the archive is extracted under its archive
  file name. A later catalog version with the same asset name, for example SF20's
  `stockfish-linux-x86-64-universal.tar.gz`, would displace the installed tree (`infra/fs.rs`
  install replaces the target). It would then fail registration with `Conflict`, because the
  same relative path now has a new file identity (`path_authority/mod.rs:5331-5334`).
  - The shared install therefore extracts every catalog entry into a directory unique to that
    entry's verified artefact: the archive name plus the entry's **full** signed sha256, never a
    prefix, so two distinct artefacts do not collide in
    practice (a full SHA-256 collision is computationally infeasible) (R2-05).
  - If that directory already exists, an earlier install of the same verified artefact is
    **adopted**: its executable is registered, or looked up by `register_installed_engine`'s
    get-or-create, and it is never re-extracted over a tree a running engine may be using
    (R2-05). This covers two entries upgraded to the same version and a catalog install of a
    version already installed. Plain `install_dir` replacement would displace the tree, which
    fails on Windows while the binary runs, and would reach the identity `Conflict`.
  - It registers the executable under that directory.
  - An installed version is never displaced by a newer one.
  - The exact directory spelling, and keeping it inside the backend's component checks, is the
    executor's.
- **Shared record builders** (R1-05). One builder produces the required-settings defaults from an
  engine config. Every site that builds those defaults today goes through it, and so does the
  upgrade:
  - `installDefaultEngine` (`engines.ts:338-345`);
  - `EngineForm` (`EngineForm.tsx:64-70`);
  - Settings Reset (`EnginesPage.tsx:634-641`);
  - the `EngineSettings` effect that fills missing required defaults (`EnginesPage.tsx:332-345`,
    R2-06);
  - the O3 upgrade.
- The new-install record is built from `localEngineSchema` fields only. It must satisfy
  `inspectEngineOwnerValue`, which means it is equal to its own parse.
- **Install and upgrade publish only after a successful save** (R1-03, revised in round 2 as
  R2-07).
  - Today `enginesAtom` publishes `next` before the owner save resolves
    (`src/state/atoms.ts:244-260`).
  - Install (O2) and upgrade (O3) go through a publish-after-save path inside the same
    serialised `enginesAtom` sequence:
    - the new list is written durably first;
    - the in-memory value changes only when the receipt says `saved:true`;
    - there is exactly one durable write per action.
  - Consequences:
    - "Installed" cannot appear for an engine that was never saved, not even transiently.
    - A refused save leaves memory and storage both on the old list.
    - No other caller changes. The round-1 idea of restoring the atom for every caller is
      withdrawn: Remove retires the id before its save (`d-20260901-17`), and Duplicate selects
      the new index immediately (`EnginesPage.tsx:649-662`), so a restore would leave a
      tombstoned or missing entry.
  - The general optimistic-publish divergence for edits, Remove and Duplicate exists equally
    before this plan, and refused saves already raise a notification (`reportPersistError` →
    `notifyListenerError`). It is filed as `f-20261001-17`.
- `AddEngine` awaits the save receipt. On `saved:false` it shows an error and does not mark the
  card installed.
- **Failure semantics.**
  - A refused save leaves both the stored list and the in-memory list unchanged. The new handle
    stays unowned and is pruned at the next startup. The user sees an error, never "Installed".
  - A registration failure or a `getEngineConfig` failure after a successful download shows an
    error and saves no record (R1-15). A handle registered before the failure is unowned and
    pruned at the next startup by the existing mechanism (`path_authority/mod.rs:6584-6605`).
    The download card returns to its action label, as in `d-20260901-24`.
- **Ownership.**
  - `src/utils/engines.ts`, `src/components/engines/AddEngine.tsx`,
    `src/components/engines/EngineForm.tsx`;
  - `src/components/engines/EnginesPage.tsx` (Reset and the defaults-fill effect only);
  - `src/state/atoms.ts` (the `enginesAtom` publish-after-save path);
  - `src-tauri/src/fs.rs` (tar-in-gzip extraction; destination adoption);
  - the backend archive-destination naming only if the unique directory cannot be chosen from the
    renderer's `directory_name`.
- **Verification level.**
  - A vitest that runs the **real** `installDefaultEngine` with mocked `tauri` against the
    **real** `inspectEngineOwnerValue`. It must fail on today's code.
  - An `AddEngine` test that the card stays not-installed and an error is shown when the receipt
    says `saved:false`.
  - An `AddEngine` test that a `getEngineConfig` rejection after registration shows an error and
    adds nothing.
  - An `AddEngine` test that a `registerInstalledEngine` rejection shows an error and adds
    nothing (R2-08).
  - A real-atom test for the publish-after-save path:
    - while the save is pending, the store still holds the old list;
    - after `saved:false`, it holds the old list;
    - after `saved:true`, it holds the new list.
  - Rust tests on the install location:
    - two catalog entries with the same archive name but different sha256 resolve to different
      directories;
    - an existing directory for the same sha256 is adopted without re-extraction.
  - A Rust test that runs a gzip-of-tar fixture through the download-install core and then
    registers the nested executable path. It is red on today's code (R2-04).
  - A Rust test that a single-file `.gz` still installs as one file.
  - Rust rejection tests for tar-in-gzip, each red if the check is omitted (R3-05):
    - a gzip-of-tar whose decompressed size exceeds the compression-ratio limit;
    - a gzip-of-tar that exceeds the expanded-size limit.
    The existing tar extractor checks entry count, per-entry size and expanded size
    (`fs.rs:1593-1634`), but only the zip and single-file gzip paths check the ratio
    (`fs.rs:1551-1555,1703-1706`). So the ratio check for tar-in-gzip is new code and needs its
    own red-first proof.

### O3 — "Upgrade from catalog" swaps a new binary into an existing engine entry

MANDATE words: the scope amendment above.

- **UI.** The `EngineSettings` panel (`EnginesPage.tsx`) of a **local** engine gets an
  "Upgrade from catalog" action. It opens a modal listing the catalog engines for this OS and
  BMI2 capability, reusing `useDefaultEngines` and the existing card visuals where they fit. A
  catalog entry whose `downloadLink` equals the engine's current one is shown as current, not
  installable. Choosing an entry runs the O2 shared install with progress, through the existing
  download job, cancellable like today.
- **The modal fails closed** (R1-16). When `useDefaultEngines` returns an error, the modal offers
  no install action. Its message is truthful about the cause (R3-03): catalog signature
  verification failure, CPU-capability query failure, or another error. It never reuses
  AddEngine's "Failed to fetch the engine's info from the server" for a local IPC failure.
- **Entry transformation.** `upgradeEngineFromCatalog(engine, catalogEntry, installed)` is a pure
  function with its own tests.
  - **Kept:** `id`, list position, `imageHandle`, `go`, `enabled`/`loaded`, and every stored
    setting whose name the new binary advertises in `config.options`, with its stored value.
  - **Dropped:** settings not advertised by the new binary, for example `EvalFileSmall`.
  - **Added:** any `requiredEngineSettings` the entry lacks, with the new binary's defaults.
  - **Replaced:**
    - `handle`;
    - `filename` (the last component of the catalog path, the same rule as a new install);
    - `name`, set to the new binary's UCI `id name` (`config.name`);
    - `version` and `elo` from the catalog entry;
    - `downloadLink` and `downloadSize` from the catalog entry.
  - The result must pass `inspectEngineOwnerValue`.
- **Persistence order.**
  1. Persist the transformed list through `enginesAtom` and await the receipt.
  2. Only on `saved:true`, retire the old binary for this engine id (below).
  3. On `saved:false`, show an error, keep the old entry untouched and do not retire anything.
     The publish-after-save path (O2, R2-07) never published the new list, so the old handle
     remains the live one. The new handle stays unowned and is pruned at startup.
  4. After `saved:true`, every persisted engine-player snapshot (`game-player1-settings`,
     `game-player2-settings`, `src/state/opponentSettings.ts:30`) whose embedded engine has the
     same id is rewritten through its owner storage (R1-08). The embedded engine copy gets the
     same replaced fields as the entry, and the go mode is kept. The snapshot's own
     `engineSettings` go through the same settings transformation as the entry (R2-09, lineage
     R1-08). `toPlayerConfig` prefers that array (`src/components/boards/playerConfig.ts:59`), so
     the transformation must be applied: overrides the new binary still advertises are kept,
     unadvertised options such as `EvalFileSmall` are dropped, and missing required defaults are
     added.
     - Each save's receipt is checked.
     - A refused snapshot save is reported as an error. It does not undo the upgrade: a game
       start reads the engine list at submit time, and the stale snapshot only delays pruning of
       the old handle.
     - Without this step, a stale snapshot would keep the old handle durably owned and never
       pruned.
- **Old-binary retirement.** This needs a new supervisor operation plus one Specta command,
  `retire_engine_binary(engine, handle)`.
  - It tombstones the **(engine id, old executable)** pair, using a bounded set like
    `RetiredEngineIds`.
  - It cancels matching admissions and terminates matching actors, using the same
    registration/coordination barrier as `retire_engine` and `retire_executables`.
  - The id and the executable stay usable apart from each other. This matters because a
    Duplicate may still own the same executable, and the upgraded entry keeps its id.
  - `retire_engine`, `retire_executables` and the new pair operation then share one private
    "retire matching" routine. This is the third copy of the barrier-plus-terminate-loop, so it
    is extracted now (global rule 11).
  - It is registered in the command list, the binding is regenerated
    (`pnpm bindings:generate`), the facade gets a `src/platform/tauri.ts` entry, and O3's UI is
    the production consumer, which `ipc:consumers:check` requires.
- **What happens to running analyses.** A tab analysing with the old binary loses that actor
  through the pair retirement. Its next request uses the new handle from the updated atom and is
  admitted under the new pair. A stale render that still holds the old handle is refused
  admission as retired, never silently served by SF18.
- **A game in progress is not disturbed** (R1-07).
  - Game actors are keyed `game:{id}:{session}:{side}` with the engine id (`game.rs:1390`).
    Retiring them would disconnect the engine, and `game.rs:2969-2984` would award an
    "Abandonment".
  - The pair retirement therefore terminates only non-game actors: analysis, report and config
    probe.
  - The pair tombstone does not refuse an admission that a game already in progress makes for
    its own key. A running game keeps the binary it started with until it ends; new games use the
    new binary.
  - How the supervisor tells game ownership apart (key kind versus key prefix) is the executor's,
    provided it is not a renderer-supplied flag.
- **Failure semantics.**
  - Download or verify failure: error notification, entry unchanged.
  - Retirement failure after a successful save: error notification, and the entry stays
    upgraded. Named limit, not a rollback (R1-17): `terminate_exact` removes an actor from the
    registry even when its termination returns an error (`process.rs:1457-1460`). A process
    whose termination failed is therefore outside the registry. The same holds for
    `retire_engine` and `retire_executables` today; this plan adds no new reaper for it. Filed as
    `f-20261001-14` (R2-11).
  - Cancel during download: entry unchanged.
  - Cancel when the cancel request itself fails (R3-04): the modal records the user's cancel
    intent before sending the request. A download that later completes after a cancel intent is
    never applied. The entry is not changed and nothing is retired. Any registered artefact stays
    unowned and is pruned at startup. The cancel-request error is shown as today.
  - Interrupted between the engine-list save and the snapshot rewrites (R3-01), for example the
    app exits there. This is a named limit with a bounded consequence; no new recovery mechanism
    is added:
    - A game start resolves the engine from the current list by id at submit time
      (`BoardGame.tsx:567-569`), so it runs the new binary.
    - The stale snapshot's `engineSettings` may still be preferred by `toPlayerConfig`. An option
      SF19 no longer has is then answered with `No such option` and the engine keeps running
      (probe `setoption name EvalFileSmall value x` against sf_19, scratchpad
      `sf19/probe19.txt`).
    - The old handle stays owned by the snapshot, and so is not pruned, until that player's
      settings are saved again or the next upgrade rewrites it.
- **Ownership.**
  - `src-tauri/src/engine/process.rs`, `src-tauri/src/chess.rs` (command),
    `src-tauri/src/main.rs` (registry);
  - `src/bindings/generated.ts` (generated);
  - `src/platform/tauri.ts`;
  - `src/utils/engines.ts`;
  - `src/components/engines/EnginesPage.tsx` plus a new modal component under
    `src/components/engines/`;
  - `src/translation/*` for new keys (`pnpm i18n:extract`, `i18n:check`).
- **Verification level.**
  - Rust: supervisor tests for the pair tombstone (same id with a new executable is admitted, the
    same executable under another id is admitted, the old pair is refused, matching actors are
    terminated, the bound is honoured).
  - Rust: a race test where an old-pair admission is in flight when retirement runs. Afterwards
    no old-pair analysis actor is running and none can be published (R1-09).
  - Rust: a game actor of the old pair survives the retirement and keeps answering.
  - Rust: a command test.
  - Vitest: the pure transformation over Felix's real entry shape (Threads 20, Hash 8192,
    MultiPV 4, UCI_ShowWDL, go Infinite, image kept; an `EvalFileSmall` setting dropped).
  - Vitest: modal flow tests for:
    - success;
    - refused save: no retire call, and the atom still holds the old handle;
    - download failure;
    - `getEngineConfig` failure;
    - retirement failure after save: error shown, entry stays upgraded;
    - catalog error state: no install action;
    - current-version marking;
    - rewriting a same-id game-player snapshot, including filtering its `engineSettings`;
    - cancelling during the download: the old entry remains, nothing is saved, no retire call
      (R2-10);
    - a cancel request that fails, after which the download completes: nothing is applied
      (R3-04);
    - a catalog error state that distinguishes signature and capability-query failures (R3-03).
  - A **new** container e2e snapshot of the settings panel with the upgrade action and of the
    open upgrade modal, against mocked IPC (R1-12). No existing snapshot covers either: the
    current ones show the empty engine list and Add Engine validation. It is recorded only
    inside the pinned container, per `d-20260829-01`.
  - `pnpm verify:app` behaviour run in the real Tauri window. That run cannot reach the catalog
    install because it downloads 81 MB from GitHub. Its scope is therefore set at implementation
    preflight: either it exercises the modal against the real backend up to the download, or it
    is recorded as unavailable evidence.
  - Final acceptance is Felix's real upgrade (Phase 4).

## Decisions and trade-offs

- **D1 — Use the catalog universal build, not a hand-placed `~/.local/bin` binary.** It is
  measured to dispatch to avx512icl and is faster (premise 2). It is signed and verified, and it
  makes future upgrades one click. Felix's SF18 file in `~/.local/bin` is left untouched.
- **D2 — Canonicalise the FEN at the engine choke point** rather than validating at every
  renderer source. One place covers analysis, games and every future source. Rejected: patching
  `chess.ts`/`tree.ts` FEN intake, which leaves the next source open.
- **D3 — Clamp out-of-range move counters rather than reject.** They do not change the position
  or the 50-move status beyond 100 plies, and rejecting would make an imported PGN unanalysable
  for a cosmetic field.
- **D4 — Reject too-much-material positions for engines** with a typed error instead of passing
  them through. SF19 cannot analyse them at all, so the only alternative is an engine crash. The
  behaviour change is visible only in a board-editor position that is already illegal.
- **D5 — The upgrade overwrites `name`, `version` and `elo`.** They describe the binary, not the
  user's preferences. It keeps `settings`, `go`, `image`, `id` and position, which are the user's.
  Felix's typed ELO 3650 becomes the catalog's 3635. Strongest case against: a user who renamed an
  entry loses the custom name. Accepted: the name shown must match the binary, and Rename stays
  available.
- **D6 — Pair-scoped retirement, not `retire_engine` and not `retire_executables`.** The id must
  survive, because it keeps the entry, the per-tab state and the report fallback. The executable
  may still be owned by a Duplicate.
- **D8 — Publish-after-save only for install and upgrade** (round 2). A general `enginesAtom`
  restore would collide with Remove's retire-first order (`d-20260901-17`) and Duplicate's
  immediate selection. Changing those is a separate design question, filed as `f-20261001-17`.
- **D9 — Adopt an existing install directory of the same verified artefact rather than
  re-extracting it** (round 2). Replacement fails on Windows while the binary runs, and on any
  platform it changes the registered file's identity, which makes `register_installed_engine`
  return `Conflict`.
- **D7 — Carry advertised resource options too** (for example `SyzygyPath`). Known limit: a custom
  `EvalFile` network built for the old architecture would not load in SF19. SF19 then prints its
  own `ERROR … terminated` (pre-existing behaviour, as in SF18). Felix has none.

## Risks / open questions

- shakmaty's handling of `_` separators and Crazyhouse/Three-check suffixes in a standard `Chess`
  parse must be measured in the O1 tests, not assumed. The canonicaliser makes their survival
  irrelevant either way.
- The `verify:app` reach for O3 is decided at implementation preflight (O3 verification).
- `f-20261001-15` (archive staging reopens the destination parent by pathname) is a pre-existing
  race reachable only by a local actor. It is outside this plan's accidental-input threat model,
  and the plan neither widens nor relies on it (R2-13).
- An app-owned install directory of a superseded catalog version stays on disk after an upgrade
  once its handle is pruned. P2 checks whether existing startup pruning removes unowned
  app-owned install directories. If it does not, P2 files a finding (bounded-retention class)
  rather than adding a reaper here. Felix's SF18 is outside the app tree and is not affected.
- The drain that owned the checkout during planning ended at 2026-10-01 ~12:40. Implementation
  rechecks `./scripts/findings.py drain-status` and the build lock at preflight.

## Not part of this task

These are filed as findings through `findings.py file` during this run, not fixed here. Their
ids: `f-20261001-07` (termination), `f-20261001-03` (`swapMove`), `f-20261001-04`
(`EditEngine`), `f-20261001-05` (portraits), `f-20261001-14` (failed-terminate drop),
`f-20261001-15` (staging pathname), `f-20261001-17` (optimistic publish for other callers).
`f-20261001-06` (catalog persistence) and `f-20261001-16` (tar.gz extraction) are to be fixed by O2
(planned; implementation has not started).

- Engine termination is not surfaced. The analysis panel spins forever, the `CRITICAL ERROR`
  reason is lost because the Logs panel's supervisor entry is removed, and a game blames the
  engine with "Abandonment" (`process.rs:486,2574`, `chess.rs:633-641`, `BestMoves.tsx:248-305`,
  `game.rs:2969-2984`). The hazard is the same for any engine crash today. After O1, no
  ChessFable input is known to trigger SF19's termination.
- Threat mode's `swapMove` keeps an en-passant square and can put the side not to move in check
  (`src/utils/chessops.ts:36-45`), which gives an error toast rather than a threat line.
- `EditEngine.tsx` has no production importer: dead code that also carries a picker-based binary
  swap.
- Catalog portraits (`imageUrl`) are not persisted for catalog-installed engines, so an installed
  catalog engine shows the CPU icon.

Also out of scope: deleting `~/.local/bin/stockfish-sf18-avx512icl` or `~/.local/bin/stockfish`
(both are SF18, the latter used outside ChessFable); tuxedo-config's earlyoom README mention of
`stockfish-sf18-`.

## Phases

Each phase ends green under `pnpm checks:pre-review` and is committed on its own. Order: P1 and P2
are file-disjoint and independent, so their order is free. P3 depends on P2's shared install
function and record builder. P4 is operational after the push and the local install.

### P1 — O1 strict-engine position conformance

- **Files:** `src-tauri/src/engine/uci.rs`, `src-tauri/src/engine/process.rs`,
  `src-tauri/src/chess.rs` (configure preflight), `src-tauri/src/game.rs`,
  `src/components/boards/gameCommandError.ts`, translations.
- **Touches:** the engine protocol and the game-start error mapping. No persistence change and no
  new command. Whether the error type that crosses the facade changes is the executor's, but
  bindings are regenerated and checked if it does.
- **Tier:** sensitive (engine/**, game.rs).
- **Proof:** `cargo test --manifest-path src-tauri/Cargo.toml engine::uci` plus the touched
  `process`/`game`/`chess` test modules, the gameCommandError vitest, the new container e2e case
  (`pnpm test:e2e:container`), then `pnpm checks:pre-review`.
- **Required real-engine proof** (O1, R1-01): the canonicalised corpus fed into the
  sha256-verified sf_19 binary. Every line ends in a `bestmove` with exit 0. The command and its
  quoted output are recorded in the commit and the handoff.

### P2 — O2 schema-exact catalog install record

- **Files:**
  - `src/utils/engines.ts`, `src/components/engines/AddEngine.tsx`,
    `src/components/engines/EngineForm.tsx`;
  - `src/components/engines/EnginesPage.tsx` (Reset and the defaults-fill effect only);
  - `src/state/atoms.ts` (the `enginesAtom` publish-after-save path);
  - `src-tauri/src/fs.rs` (tar-in-gzip, destination adoption);
  - and their tests.
- **Touches:** persistence (owner storage contract, publish-after-save), archive extraction and
  install location (sensitive: `fs.rs`). No new command.
- **Tier:** sensitive (components/engines/**).
- **Proof:** `pnpm vitest run src/utils/engines src/components/engines src/state`, the targeted
  `fs` cargo tests (tar-in-gzip, single-file gz, destination adoption), then
  `pnpm checks:pre-review`.
- **Real-artefact proof:** install the real SF19 Linux catalog entry through the shared install
  once, in a scratch profile or through `pnpm verify:app` if it can reach the network. The nested
  executable must be registered and answer `uci`. The run is recorded in the commit and the
  handoff.

### P3 — O3 upgrade-from-catalog action

- **Files:**
  - backend `process.rs`, `chess.rs`, `main.rs`;
  - generated bindings;
  - `src/platform/tauri.ts`;
  - `src/utils/engines.ts`;
  - `EnginesPage.tsx`, the new modal, and translations.
- **Touches:** the API contract (new command), concurrency (supervisor barrier) and persistence.
- **Tier:** sensitive.
- **Proof:**
  - `pnpm bindings:generate && pnpm bindings:check`;
  - targeted cargo tests for the supervisor and the command;
  - `pnpm vitest run src/utils/engines src/components/engines`;
  - `pnpm i18n:check`, `pnpm ipc:consumers:check`, `pnpm tauri:boundary:check`,
    `pnpm ui:boundary:check`;
  - then `pnpm checks:pre-review`.
- **UI verification:** per `.claude/skills/verify-ui/SKILL.md`. The new container e2e snapshot
  goes through `pnpm test:e2e:container`. The `verify:app` reach is decided at preflight (O3).

### Platform proof for every Rust-touching phase (R2-12)

- Local before commit:
  - `pnpm rust:windows:check` (GNU target type-check and lint);
  - for every touched `cfg(target_os = …)` branch that Linux does not compile, the recorded
    non-Linux source probe (R3-02, `tasks/build-ledger.md:119`): in a scratch copy, flip that
    file's `target_os = "linux"` gates to `"freebsd"`, then compile and run the affected tests on
    this machine, and record the command and result;
  - Linux tests.
- After push, `$push` waits on `rust-windows-test`, `rust-macos-test` and the `rust-platform`
  matrix of the `Test` workflow (push skill §2) and gates on each job's conclusion. Linux-only
  evidence never stands in for those platforms.

### P4 — Felix's upgrade (operational, after `$push` and `scripts/install-local.sh`)

1. Felix: Engines → Stockfish 18 → "Upgrade from catalog" → Stockfish 19 → confirm.
2. Agent checks:
   - the stored entry, decoded from a localstorage copy: same id, settings kept, name
     "Stockfish 19", version "19";
   - `path-authority.json`: the new handle points at the version-unique install directory;
   - after an analysis start, the running engine is the universal binary.
     - Process identification (R1-04 residual): on Linux an engine is launched through
       `/proc/self/fd/<n>` (`path_authority/mod.rs:1760-1765`), so its command line cannot name
       the binary and `pgrep -af` is not evidence.
     - Instead, take the app's child processes (`pgrep -P <chessfable pid>`) and resolve each
       one's `readlink /proc/<pid>/exe`.
     - The executable must be the installed universal binary, and no child may resolve to
       `stockfish-sf18-avx512icl`.
     - Before relying on it, the implementer measures once that `/proc/<pid>/exe` names the real
       file for an fd-launched engine.
     - The Logs panel's `id name Stockfish 19` line is supporting evidence.
3. Felix restarts ChessFable once, then the agent checks (R1-04):
   - the same engine id is present with the new handle, decoded from a fresh localstorage copy;
   - the card shows Stockfish 19;
   - an analysis start runs the universal binary, using the same `/proc/<pid>/exe` method;
   - the old handle `ba059fcc` is pruned from `path-authority.json`;
   - `~/.local/bin/stockfish-sf18-avx512icl` still exists.


## Carried to diff review

- **CR-1** (error-handling, nit 84, round 4). When a download completes after a recorded cancel
  intent and is discarded (R3-04), its terminal progress record is cleared. The install action
  must return to idle, not a retained 100 % indicator. The cancel-failure test asserts the idle
  state. Touches: the O3 modal and the `runDownloadJob` caller.
- **CR-2** (plan, round 3 note on R1-04). P4's process identification first measures that
  `/proc/<pid>/exe` names the real file for an fd-launched engine, and records the measurement.

## Reviews

### Round 1 — plan-r1, 11 Codex lenses (executor codex, leaf-launch read-only; `review-plan` role review-plan, all others role sensitive)

Raw reports: `$RUN_TMP/lens-*.txt`, where `RUN_TMP` is
`/tmp/claude-1000/-home-felixb-Projekte-chessfable/278a67fd-5c88-4885-829b-ade31a186422/scratchpad/run`.

Verdicts:

| Verdict | Lenses |
|---|---|
| REVISE | plan, minimalism, correctness, engine-protocol, persisted-state, tests, chess-semantics |
| APPROVED, with five should-fix items | error-handling |
| APPROVED, no findings | ipc-contract, platform-semantics, tauri-security |

Every issue's code claim was verified by the orchestrator against source before adoption.

| ID | Witnesses (rank, confidence) | Claim | Verification | Disposition | Authority |
|---|---|---|---|---|---|
| R1-01 | plan (blocker 96) | SF19 real-engine probe was "not a gate" | probe19.txt shows exit 1 on reject | Fix: required P1 proof | MANDATE "upgrade to Stockfish 19" |
| R1-02 | plan (blocker 97) | configure path writes `UCI_Chess960`/options before `set_position` validates | `chess.rs:112-137` parse is tolerant and precedes the writes | Fix: strict preflight before any write, plus a caller-path test | O1 |
| R1-03 | plan (blocker 97), correctness (blocker 99), persisted-state (blocker 98), error-handling (should-fix 94) | `enginesAtom` publishes before the save receipt | `atoms.ts:244-260` sets the stored atom first; the receipt is async | Fix: restore on `saved:false` in `enginesAtom` | O2/O3 failure semantics |
| R1-04 | plan (blocker 94), tests (should-fix 92) | P4 lacks a post-restart hydrate and run check | P4 text | Fix: post-restart checks | MANDATE acceptance |
| R1-05 | minimalism (should-fix 95) | required-settings defaults are copied at 3 sites, and the upgrade would add a 4th | `engines.ts:340`, `EngineForm.tsx:66`, `EnginesPage.tsx:636` | Fix: one builder, every site routed through it | global rule 11 |
| R1-06 | correctness (blocker 88) | a later version with the same asset name displaces the tree and conflicts at registration | `infra/fs.rs` install replaces the target; `path_authority/mod.rs:5331-5334` returns Conflict on an identity change | Fix: version-unique install directory | MANDATE "the same for SF20 later" |
| R1-07 | engine-protocol (blocker 97) | pair retirement kills a running game's engine, which becomes an Abandonment | `game.rs:1390` key carries the engine id; `game.rs:2969-2984` | Fix: game actors are exempt and keep their binary until the game ends | MANDATE "swaps it into the existing entry" |
| R1-08 | persisted-state (should-fix 91) | game-player snapshots keep the old handle durably owned | `opponentSettings.ts:30` embeds an engine; `engineOwnerStorage.ts:14-18` | Fix: rewrite same-id snapshots | O3 identity-preserving swap |
| R1-09 | tests (blocker 98) | no race test between retirement and an in-flight admission | plan text | Fix: race test | O3 verification |
| R1-10 | tests (should-fix 92) | no post-restart presence assertion | duplicate of R1-04 | merged into R1-04 | — |
| R1-11 | tests (should-fix 95) | human-vs-human tolerant parse is untested | plan text | Fix: test | O1 |
| R1-12 | tests (should-fix 97) | no e2e snapshot for the new visible flow | existing snapshots cover only the empty list and Add validation | Fix: new container snapshot | CLAUDE.md "Verifying UI changes" |
| R1-13 | chess-semantics (blocker 95) | "more than 16 pieces" is ambiguous and would reject the start position as a total | wording | Fix: per-side wording; the start position must be accepted | O1 |
| R1-14 | error-handling (should-fix 95) | the game-start refusal maps to the generic "Unable to start" | `gameCommandError.ts:77-93` | Fix: its own localised message | O1 failure semantics |
| R1-15 | error-handling (should-fix 91) | outcome of a `getEngineConfig` or registration failure is undefined | `engines.ts:331-346` | Fix: defined outcome plus test | O2 failure semantics |
| R1-16 | error-handling (should-fix 90) | the modal has no catalog error state | `AddEngine` has one | Fix: fail closed plus test | O3 |
| R1-17 | error-handling (should-fix 93) | "stale actors die at tab close" is false | `process.rs:1457-1460` removes the actor even on a terminate error | Fix: corrected named limit plus test | O3 failure semantics |

`plan_adopted_per_round`: r1=16 (17 IDs, R1-10 merged into R1-04). No rejections.

### Round 2 — plan-r2, 11 closure lenses (same routing)

Raw reports: `$RUN_TMP/lens-*.txt`; round-1 reports moved to `$RUN_TMP/r1/`.

| Verdict | Lenses |
|---|---|
| APPROVED | ipc-contract, error-handling, tests, chess-semantics |
| REVISE | plan, correctness, engine-protocol, minimalism, persisted-state, platform-semantics, tauri-security |

Closures:

| Issue | Status | Closed by |
|---|---|---|
| R1-01, R1-02 | CLOSED | plan |
| R1-03 | CLOSED by persisted-state and plan. NOT CLOSED by correctness (transient "Installed" while the save is pending) and error-handling (other callers ignore `saved:false`) | → R2-07 |
| R1-04 | NOT CLOSED (plan: `pgrep` cannot identify an fd-launched binary) | → corrected in P4 |
| R1-05 | CLOSED | minimalism |
| R1-06 | NOT CLOSED (correctness: prefix collision) | → R2-05 |
| R1-07 | CLOSED | engine-protocol |
| R1-08 | CLOSED by persisted-state, residual in snapshot `engineSettings` | → R2-09 |
| R1-09, R1-11, R1-12 | CLOSED | tests |
| R1-13 | CLOSED | chess |
| R1-14, R1-15, R1-16, R1-17 | CLOSED | error-handling |

New issues:

| ID | Witness (rank, confidence) | Claim | Verification | Disposition | Authority |
|---|---|---|---|---|---|
| R2-01 | engine-protocol (should-fix 88) | canonical FEN in the payload breaks result identity | `chess.rs:512` `fen: process.options.fen`; `EvalListener.tsx:255` compares to `searchingFen` | Fix: wire-only canonical FEN, plus a test | O1 |
| R2-02 | chess-semantics (should-fix 93) | a 10-knight FEN is legal material and cannot serve as the refusal fixture | shakmaty `is_standard_material` (`position.rs:3041-3058`): 8 promotions allowed | Fix: 8 pawns + 3 queens fixture | O1 |
| R2-03 | tests (should-fix 92) | no e2e case for the visible game-start refusal | plan text | Fix: container e2e case | O1 |
| R2-04 | plan (blocker 99) | `.tar.gz` is gunzipped into one file, never untarred | `fs.rs:589-640, 1681-1710` read by the orchestrator | Fix: tar-in-gzip extraction plus a red-first test; filed `f-20261001-16` | MANDATE "downloads and verifies the signed build" |
| R2-05 | correctness (blocker 94), platform-semantics (should-fix 91) | a sha prefix can collide; the same artefact installed twice displaces a running tree | `infra/fs.rs` replace; `mod.rs:5331` | Fix: full sha256, adopt an existing directory (D9) | MANDATE "same for SF20 later" |
| R2-06 | minimalism (should-fix 94) | the `EnginesPage.tsx:337` defaults-fill effect is a 5th copy | grep `requiredEngineSettings` | Fix: route it through the builder | rule 11 |
| R2-07 | correctness (blocker 99), plan (blockers 98, 98: Remove retire-first, Duplicate selection crash), error-handling (residual) | a general atom restore conflicts with Remove/Duplicate; a transient "Installed" remains | `EnginesPage.tsx:649-683`; `process.rs:1567-1579`; `reportPersistError` = `notifyListenerError` (`persistError.ts:1`) | Fix: publish-after-save for install and upgrade only (D8); general divergence filed `f-20261001-17` (pre-existing, already notified) | O2/O3 |
| R2-08 | tests (should-fix 94) | no registration-failure caller test | plan text | Fix | O2 |
| R2-09 | persisted-state (should-fix 96), lineage R1-08 | snapshot `engineSettings` replays old options | `playerConfig.ts:59` | Fix: same settings transformation | O3 |
| R2-10 | tests (should-fix 95) | no upgrade-cancellation test | plan text | Fix | O3 |
| R2-11 | engine-protocol (blocker 92) | a failed terminate drops the actor, with no reaper | `process.rs:1457-1460`; the same for existing retirements | Skip for this plan: a pre-existing hazard, equal before the change; named limit; filed `f-20261001-14` | build §4 "not worse than today" |
| R2-12 | platform-semantics (should-fix 94) | phase proofs omit the Windows and macOS runtime jobs | push skill §2 lists them as post-push gates | Fix: explicit platform-proof section | CLAUDE.md gates |
| R2-13 | tauri-security (blocker 90) | archive staging reopens the destination parent by pathname | `fs.rs:1319-1329` | Skip for this plan: pre-existing, needs a local adversary outside the frozen threat model; filed `f-20261001-15` | threat model |
| R2-14 | plan (should-fix 92) | acceptance criterion 4 ("every old-binary actor") contradicts the game exemption | ACCEPTANCE text in the lens packet | Fix: acceptance wording narrowed to non-game actors in the round-3 packet | MANDATE amendment |

`plan_adopted_per_round`: r1=16, r2=12 (R2-01..R2-10, R2-12, R2-14; R2-11 and R2-13 skipped with evidence and filed).

### Round 3 — plan-r3, 10 closure lenses (ipc-contract omitted: unaffected and APPROVED in round 2)

| Verdict | Lenses |
|---|---|
| APPROVED | correctness, error-handling (with two should-fix items), tests, tauri-security, minimalism, chess-semantics |
| REVISE | plan, engine-protocol, persisted-state, platform-semantics |

Closures:

- **Closed by every witness:** R1-03, R1-04, R1-06, R1-08, R2-01, R2-02, R2-03, R2-04, R2-05,
  R2-06, R2-07, R2-08, R2-09, R2-10, R2-12, R2-14.
- **R1-04:** closed by plan, which notes that the `/proc/<pid>/exe` measurement is a P4
  precondition.
- **R2-11, Skip:** plan, platform-semantics, minimalism and error-handling say the Skip reason
  holds. engine-protocol says NOT CLOSED, but cites no new premise, only the same
  `process.rs:1457-1460` behaviour the Skip names. **Arbiter: the Skip stands.**
  - The hazard is identical for `retire_engine`, `retire_executables` and `kill_engine` before
    this plan.
  - It is named and filed as `f-20261001-14`.
  - Acceptance criterion 4 is read as "terminated, or the termination failure is reported". The
    report is O3's retirement-failure error.
- **R2-13, Skip:** platform-semantics, tauri-security, minimalism and error-handling say it holds.

New issues:

| ID | Witness (rank, confidence) | Claim | Verification | Disposition | Authority |
|---|---|---|---|---|---|
| R3-01 | persisted-state (blocker 96) | an exit between the list save and the snapshot rewrite leaves a stale snapshot | `BoardGame.tsx:567-569` resolves the engine by id from the list at submit; the sf_19 probe shows `setoption name EvalFileSmall` → `No such option`, process alive | Rejected as plan-level blocker with evidence: the consequence is bounded (handle not pruned until the next player-settings save; a harmless option line). Recorded as a named limit in O3 failure semantics. No new recovery mechanism, because a hazard with this bounded effect does not justify one (build §4) | — |
| R3-02 | platform-semantics (should-fix 91) | the macOS cfg probe is unspecified | `tasks/build-ledger.md:119` records the freebsd flip | Fix: spelled out in the platform-proof section | R2-12 |
| R3-03 | error-handling (should-fix 88) | the modal reuses AddEngine's "server" message for a local BMI2 IPC failure | `useDefaultEngines` queries BMI2 before loading the catalog (`engines.ts:298-310`) | Fix: truthful per-cause message, plus a test | O3 |
| R3-04 | error-handling (should-fix 94) | a failed cancel request lets a later-completing download apply the upgrade | shared `cancelDownloadJob` leaves the job running on a request error (lens) | Fix: cancel intent recorded before the request; a completion after intent is never applied; plus a test | O3 failure semantics |
| R3-05 | plan (blocker 97) | the tar-in-gzip ratio check has no red-first proof | `fs.rs:1551-1555,1593-1634,1703-1706` | Fix: over-ratio and over-expanded rejection tests | O2 |

`plan_adopted_per_round`: r1=16, r2=12, r3=4 (R3-02..R3-05; R3-01 rejected with evidence).

### Round 4 — plan-r4, 4 closure lenses (plan, persisted-state, platform-semantics, error-handling)

All four lenses returned APPROVED.

| Issue | Closed by |
|---|---|
| R3-01 | persisted-state and plan (the rejection evidence holds) |
| R3-02 | platform-semantics and plan |
| R3-03, R3-04 | error-handling and plan |
| R3-05 | plan |

New: error-handling nit 84 (discarded-download progress cleanup) → `Fix — carried to CR-1`.

`plan_adopted_per_round`: r1=16, r2=12, r3=4, r4=0 (one carried nit).

**Plan review CLOSED at plan-r4**, 2026-10-01:

- Every plan-level issue is closed by its witnesses or by the arbiter with evidence: R2-11 (Skip,
  4 concurring lenses), R2-13 (Skip), R3-01 (rejected with evidence, confirmed by 2 lenses).
- Unique issues: 36 opened (17 in round 1, 14 in round 2, 5 in round 3); 1 merged (R1-10); 2
  skipped and filed (`f-20261001-14`, `f-20261001-15`); 1 rejected as a named limit (R3-01); 0
  open.
- Carried items: CR-1, CR-2.
- No rewrite and no split.
- The non-convergence trigger did not fire: adoptions fell 16 → 12 → 4 → 0.
