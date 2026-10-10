// Behavioural check against the real application window. See `scripts/app-driver.mjs` for the
// stack it builds and for what it deliberately cannot reach.
//
//   pnpm verify:app                 run the checks
//   pnpm verify:app --screenshot X  also write a PNG of the page to X
//   pnpm verify:app --progress-contract  run only the progress transport/cancellation scenario
//     --application /absolute/binary    select a disposable measurement binary
//     --expect-progress-generation N    require the first lease's exact decimal digits
//     --expect-clear-rejection          expect the disposable binary's typed clear failure
//
// Progress assertion staging: 2026-10-08, disposable APPLICATION INPUTS.
// Unmodified verifier. Every row below actually emitted its unique failure with exit 1.
// Durable record of full actual messages, commands, hashes and exact mutation patches:
// [Progress runtime proof](../tasks/handoffs/2026-10-08-f-20260925-02-review.md)
// Supplemental logs, exact mutations, commands, input/binary hashes and screenshots:
// /tmp/build-progress-aa086ec3/runtime/proof-report.md and manifest.json
// Original raw verifier SHA-256: c76499e2850dd1e1f99ea6237482aed271625f81db5c4d6ce7fb5534a5f0c457.
// Historical executable-body byte identity covers the matrix documentation step before the
// cumulative-review prerequisite and named timing-constant repairs below.
// Normal transport 13/13, high rejected-clear renderer 17/17, restoration 13/13, all exit 0.
// High clock seed 9007199254740992, first exact string generation 9007199254740993.
// Failure message -> application-input case (all exit 1):
// progress native event listener registers -> denied-events
// progress start lease has exact canonical string generation -> start-number
// progress running event has exact canonical string generation -> event-number
// progress state-update string lease reaches native with exact identity -> update-reject
// progress snapshot has exact canonical string generation -> snapshot-number
// progress terminal state update accepts the string lease -> update-reject
// progress terminal event has exact canonical string generation -> event-number
// progress malformed lease rejects without changing the snapshot -> malformed-accept
// progress invalid clear rejects as a native IPC operation -> null-clear-accept
// progress deliberate clear failure returns a typed native rejection -> rejection-absent-low
// progress clear return has exact canonical string generation -> clear-number
// progress cleared event has exact canonical string generation -> event-number
// progress clear removes the native snapshot -> clear-retain
// progress native event listener is released -> denied-events
// progress high-generation wire event drives the real renderer bar -> low-reject
// progress cancellation presses the production pre-claim job button -> ui-no-cancel
// progress rejected-clear null acknowledgement hides the cancelled generation -> ui-no-null-fence
// progress fenced old native event cannot resurrect the bar -> ui-no-fence
// progress newer retry remains distinct and visible after rejected clear -> ui-retry-gap
// progress newer retry continues updating through the real facade -> ui-no-update
// progress application must name an existing absolute binary path -> option-application
// expected progress generation must be a canonical unsigned u64 decimal string -> option-generation
// disposable progress measurement options require --progress-contract -> option-focused
// timed out waiting for progress renderer startup -> precondition-startup
// timed out waiting for progress database catalog opener -> precondition-opener
// timed out waiting for progress database catalog card -> precondition-catalog
// No argued or unstageable assertions. Disposable source restored byte-for-byte.
//
// The cancellation probe replays the catalog button's production
// onClick handler and presses Cancel synchronously before prepare_download can settle. This
// exercises the production pre-claim cancellation and failed-clear cleanup without a network
// download, while a native lease already drives the real facade, hook and ProgressButton.
//
// Workspace reload assertion staging: completed 2026-10-09 against disposable application inputs.
// The ordinary unchanged full verifier ran against a separately built application-input fault.
// No focused mode or --application routing option was used. Both unique workspace checks emitted
// FAIL, the verifier exited 1, and the other 86 checks passed. The byte-restored source was rebuilt
// and the full verifier exited 0 with 88 reported checks.
//   application-input case       | assertion/message                                                                | result
//   publish a fresh default      | a real document reload preserves both exact seeded workspace tab identities       | FAIL, full verifier exit 1
//   publish a fresh default      | a real document reload selects the second seeded workspace tab                    | FAIL, full verifier exit 1
// Durable record of exact commands, messages, hashes and source patch:
// [Workspace initialization runtime proof](../tasks/handoffs/2026-10-09-workspace-initialization.md)
// Original staging SHA-256: verifier f09d930fb0c721db26f21283a049a2a1671eca99841d20521283bc707f660e4b,
// app-driver 727687d7b7a93b1544ecee582f73c8e903b4a8ae50b68f6f78b6bfb42a0cbd69.
// This is a later comments-only update. Staging used the unchanged verifier and driver above.
//
// It asserts eighty-eight independently reported checks, plus one conditional reload check, that no other gate in this repository can:
//   group | assertions
//   startup | 5: production authority, user-file safety, owned-image cleanup, real IPC bridge,
//             document title
//   single instance | 5: refusal before initialization, unchanged registry bytes,
//                        primary responsiveness, shared-config refusal, different-HOME coexistence
//   practice durable storage | 14: seeded positions, paged reviews, migration, owner retention,
//                                legacy-key preservation, renderer ratings, real sync, exact counts
//   download destinations | 3: persisted destination, fresh-id refusal, database-root refusal
//   image/CSP | 4: retained-engine-portrait-render, retained-engine-data-url,
//                  retained-engine-WebKitGTK-decode, detached-blob-CSP-rejection
//   native services | 3: path capability refusal, live sound port, bundled sound bytes
//   attachments | 4: prepare, retire, live-session bytes/intent, titlebar cleanup
//   native reads | 6: mint, cancel, cancelled-ticket refusal, document-reload sweep, retained ticket,
//                     destroyed-window log
//   workspace reload | 2: exact seeded tab identities, second-tab selection after DOM readiness
//   Files | 7: seeded-row-render, double-click-route, opened-game-notation,
//              metadata-dialog-no-error, metadata-repertoire-filter, metadata-sidecar-type,
//              metadata-filename-preserved
//   Databases | 2: default-root-unusable, selected-root-missing
//   NAGs | 9: hint path/title/visibility, unknown hint absence, saved edit, four preserved NAGs
//   file freshness | 5: in-place rewrite, open-tab reload/withhold, native-read timing,
//                      main-thread apply budget, one-poll-interval freshness budget;
//                      +1 conditional Reload-from-disk check
//   titlebar/process | 3: rendered controls, process-before-close, process-after-close
//   shutdown | 3: start, bounded completion, sound signal
//   progress | 13: listener registration, start lease, running event, state-update identity,
//                  snapshot, terminal update, terminal event, malformed-lease refusal,
//                  invalid-clear refusal, clear return, cleared event, cleared snapshot,
//                  listener release
//
// Staged-failure record for the single-instance checks (2026-10-07).
// Extended on 2026-10-08 for the distinct application-data, configuration and local-data roots.
// B1 bypassed advisory locking, B2 appended one space to the refused launch's path-authority.json,
// and B3 locked an identifier-wide temporary leaf instead of the application-data leaf. Each
// Rust break was built with pnpm build and read by pnpm verify:app. The verifier logic stayed
// unchanged across these runs. After each run, the Rust diff was restored byte-for-byte to the
// intended Phase 2 changes. The B3 temporary lock leaf was removed after its processes exited.
// Every completed run also printed the three known $8 hint FAILs (f-20261005-07). B1 additionally
// printed the Repertoire-filter and metadata-sidecar FAILs. Those checks were left unchanged.
//   break                         | assertion/message                                                                                        | exit
//   B1: bypass advisory locking   | FAIL  a second process on the same app-data directory is refused before initialization                    | 1
//   B1: dependent setup failure   | FAIL  the refused launch leaves authority and credential registry bytes unchanged                        | 1
//   B1: dependent setup failure   | FAIL  the primary still answers WebDriver after the refused launch                                       | 1
//   B2: append one registry byte  | FAIL  the refused launch leaves authority and credential registry bytes unchanged                        | 1
//   B3: identifier-wide lock      | FAIL  a process on a different app-data directory initializes while the primary runs                      | 1
//   B4: stop matching-HOME peers  | FAIL  the primary still answers WebDriver after the refused launch                                       | 1
//   B5: omit configuration root  | FAIL  a second process sharing only the configuration directory is refused                               | 1
// The B1 rows each printed "not attempted: wait for same-directory refusal: timed out waiting
// for another ChessFable process holds the application data directory". Its dependent rows prove
// setup-failure reporting, not registry immutability or primary responsiveness. B2 directly
// exercised the byte comparison. Same-directory refusal stayed ok in both B2 and B3.
// B4 stopped only other processes whose /proc environment HOME exactly matched the refused
// launch's temporary HOME. The primary's five-second WebDriver request failed with
// "not attempted: query the primary WebDriver session after refusal: This operation was aborted".
// Same-directory refusal, unchanged bytes and shared-configuration refusal stayed ok. B4 also
// printed the different-HOME coexistence, document-reload and retained-reservation FAILs because
// they queried the stopped primary. The subsequent window-control wait expired, and harness
// cleanup escalated the stopped WebDriver process group to SIGKILL before exiting with status 1.
// B5 omitted the configuration root from the binary's admission list. The new assertion printed
// "not attempted: wait for shared-configuration refusal: timed out waiting for another ChessFable
// process holds the application data directory". Same-directory refusal, unchanged bytes,
// primary responsiveness and different-HOME coexistence stayed ok. B4 and B5 each used pnpm build
// followed by pnpm verify:app, with verifier logic unchanged between them. Both breaks were
// restored exactly, checked against the intended Rust diff and source hashes, before final proof.
// B1-B3 retain their earlier evidence: bypassing all locks now means injecting Ok(()) for every
// root, with the same refusal wait and message, so B1 needed no restage. B2 still changes the
// shared configuration registry, and B3 replaces the roots with one identifier-wide lock.
// The first B1 attempt aborted before any assertion because the resumed shell lacked the desktop
// environment and the nested compositor socket timed out. It is not assertion evidence. The
// completed runs used the existing desktop session's WAYLAND_DISPLAY, XDG_RUNTIME_DIR and bus.
//
// STAGED-FAILURE RECORD (push-review-policy §2), one row per assertion. The policy's fifth
// condition is that an inherited artefact is a finding, not a licence: until every assertion here
// carries a row, this file's green is not citable as evidence. A break is made in what the
// artefact READS — the built binary, its configuration and its bundled resources — never in this
// file's own logic, and is restored immediately afterwards.
//
// retained-engine-portrait-render, retained-engine-data-url, retained-engine-WebKitGTK-decode,
// and detached-blob-CSP-rejection (2026-09-20). Two breaks, chosen so that each half fails alone:
// that is what proves the CSP control is independent of the positive check, and therefore that a
// green run cannot have come from a widened policy.
//   break                                   | check                        | message printed     | exit
//   production LocalImage reverted to        | retained-engine-portrait-    | FAIL  the retained  | 1
//   URL.createObjectURL, i.e. the pre-fix    |      render                  |   engine LocalImage |
//   state of f-20260906-09; CSP untouched.   |                              |   rendered on the   |
//   All three retained-engine assertions fail,|                              |   Engines page —    |
//   each printing its own line, and detached- |                              |   timed out waiting |
//   blob-CSP-rejection stays green — so the   |                              |   for the retained  |
//   two are not entangled.                   |                              |   engine portrait   |
//                                            |                              |   to render and     |
//                                            |                              |   decode            |
//                                            | retained-engine-data-url     | FAIL  … uses an     | 1
//                                            |                              |   image/png data    |
//                                            |                              |   URL — same detail |
//                                            | retained-engine-WebKitGTK-   | FAIL  … data URL    | 1
//                                            |   decode                     |                  |
//                                            |                              |   decodes in        |
//                                            |                              |   WebKitGTK — same  |
//                                            |                              |   detail            |
//   img-src gains `blob:` in tauri.conf.json,| detached-blob-CSP-rejection  | FAIL  the           | 1
//   production left correct. Exactly one     |      image URL               |   production CSP    |
//   check fails; all three retained-engine   |                              |   rejects a detached|
//   assertions stay green.                   |                              |   blob image URL    |
//                                            |                              |   with an img-src   |
//                                            |                              |   violation —       |
//                                            |                              |   {"timeout":true}  |
//
// Rows for the other assertions (all runs exited 1):
//   break                                   | assertion/message                              | exit
//   active-root retention removed and the   | FAIL  production startup reclaims unowned      | 1
//   disposable owned-root directory removed |   authority and preserves native-owned          |
//                                            |   authority; FAIL  startup authority             |
//                                            |   reconciliation deletes no user files          |
//   startup image reconciliation retired the | FAIL  trusted production startup preserves     | 1
//   retained fixture image                  |   owned images and cleans only the orphan       |
//   path capability was re-added and sound  | FAIL  the renderer cannot resolve a base        | 1
//   port returned 0                         |   directory (core:path grants are gone) —      |
//                                            |   /tmp/chessfable-verify-nKX32P/.local/share/  |
//                                            |   com.chessriddle.encroissant/x                 |
//                                            | FAIL  the renderer reaches a live loopback      |
//                                            |   sound-server port — 0                         |
//                                            | FAIL  the loopback sound server serves the      |
//                                            |   bundled standard move sound — fetch failed    |
//   index.html title changed and            | FAIL  the real renderer exposes the ChessFable  | 1
//   prepare_native_read returned Err         |   document title                               |
//                                            | FAIL  the native backend mints an opaque read   |
//                                            |   reservation — {"category":"invalid-input",   |
//                                            |   "message":"Invalid input: STAGED BREAK",     |
//                                            |   "tag":"backend-error"}                       |
//                                            | FAIL  the native backend acknowledges            |
//                                            |   reservation cancellation                      |
//                                            | FAIL  a cancelled reservation cannot be claimed  |
//                                            |   by a later native read — [object Object],     |
//                                            |   [object Object]                               |
//   non-startup attachment actions returned  | FAIL  real attachment IPC prepares the exact    | 1
//   Err                                     |   next durable owner set — {"category":         |
//                                            |   "message":"Invalid input: STAGED BREAK d",    |
//                                            |   "tag":"backend-error"}                       |
//                                            | FAIL  real attachment IPC retires the selected  |
//                                            |   managed image — {"category":"invalid-input", |
//                                            |   "message":"Invalid input: STAGED BREAK d",    |
//                                            |   "tag":"backend-error"}                       |
//   live-session retirement deleted bytes    | FAIL  retirement preserves image bytes for the  | 1
//   while retaining cleanup intent           |   live session and records cleanup intent       |
//   the stage-4 reservation break            | FAIL  a native read reservation is retained      | 1
//                                            |   until titlebar close — {"category":            |
//                                            |   "message":"Invalid input: STAGED BREAK",      |
//                                            |   "tag":"backend-error"}                       |
//                                            | FAIL  the real destroyed-window event cancels   |
//                                            |   the exact retained main-webview reservation    |
//   the three shutdown log lines were        | FAIL  the shutdown sequence started              | 1
//   renamed                                  | FAIL  the shutdown cleanup ran to completion    |
//                                            |   inside its budget                            |
//                                            | FAIL  the sound server shutdown was signalled    |
//   assertion close retained the app and    | FAIL  application pid 4078384 and recorded      | 1
//   first WebKit service process             |   WebKit service pids [4078409, 4078446] do not |
//                                            |   exist after the close — surviving pids:       |
//                                            |   4078384, 4078409                             |
//   shutdown skipped image cleanup           | FAIL  titlebar shutdown removes retired image    | 1
//                                            |   bytes and intent while retaining the owner    |
//
// Staged-failure record for the document-reload sweep (2026-10-05). The verifier stayed unchanged;
// src/index.tsx omitted only the startup releasePreviousDocumentOperations call, then pnpm build
// and pnpm verify:app ran against that binary. The source was restored byte-exact before the next
// break. This run reported 4 failed checks (the reload assertion and three NAG hint assertions).
//   break                                   | assertion/message                              | exit
//   applicationStartup omits the startup   | FAIL  a real document reload cancels the      | 1
//   reservation sweep                      |   previous document's retained reservation     |
//                                           |   timed out waiting for the reloaded renderer  |
//                                           |   and its previous-document reservation sweep  |
//
// Staged-failure record for post-reload reservation survival (2026-10-05). After render,
// src/index.tsx used a sessionStorage reload marker to schedule another sweep every 50 ms only in
// the reloaded document. pnpm build and pnpm verify:app read that binary with unchanged verifier
// logic. The reload and retained-ticket checks stayed green; the destroyed-window assertion
// printed its own FAIL line. The run reported 4 failed checks (that assertion and three NAG hint
// assertions). The temporary source was restored byte-exact and rebuilt before the final proof.
//   break                                   | assertion/message                              | exit
//   repeated reservation sweeps after      | FAIL  the real destroyed-window event cancels | 1
//   render in the reloaded document        |   the exact retained main-webview reservation  |
//
// Download-destination assertions (2026-09-22). Each staged break fails only its own assertion;
// the fixture or assertion argument was restored immediately after the run.
//   break                                   | assertion/message                              | exit
//   verify-download-destination entry      | FAIL  real IPC preserves the persisted          | 1
//   removed from the fixture                |   offline download destination                 |
//                                            |   false                                        |
//   assertion 2 receives the known id       | FAIL  real IPC rejects a fresh download         | 1
//                                            |   destination id                               |
//                                            |   true                                         |
//   assertion 3 receives the known id       | FAIL  real IPC rejects a database-root id       | 1
//                                            |   true                                         |
//
// Rows above are deliberately not inferred from collateral failures: the same assertion was
// retained only where its own FAIL line was printed. The "retain nothing" break printed the
// existing Files rows (seeded-row-render, double-click-route, and opened-game-notation) (and
// exited 1), because it reclaimed the Files workspace; it did not move the three startup
// assertions above.
//
// Staged-failure record for the Files checks (push-review-policy §2), one row per check. The
// double-click-route and opened-game-notation checks were red on 2026-09-19 against the unfixed release binary, in one run where every other
// check was ok; that run printed "2 check(s) failed" and exited with status 1.
// The seeded-row-render check was staged the same day on the fixed tree by a release build whose Files page rendered
// an empty tree ("3 check(s) failed", status 1); the file was restored and the rebuild ran green.
//   check                                   | message printed                                   | exit
//   seeded-row-render                        | FAIL  the seeded workspace file row renders on    | 1
//                                           |   the Files page — timed out waiting for the      |
//                                           |   Files row; (2) and (3) then print "not          |
//                                           |   attempted: the Files row never rendered"        |
//   double-click-route                        | FAIL  a real double-click on the unselected Files | 1
//                                           |   row navigates to / — timed out waiting for the  |
//                                           |   double-click to navigate to /; path is /files   |
//   opened-game-notation                      | FAIL  a real double-click on the unselected Files | 1
//                                           |   row shows its game — timed out waiting for the  |
//                                           |   opened game's notation; expected 1.e4e52.d4d5   |
//
// Metadata-edit staged failures (2026-10-07). Each break changed only production source read by
// pnpm build, followed by pnpm verify:app. A: write_workspace_file_metadata_blocking returned
// InvalidInput("STAGED metadata write refusal") before writing. B: FilesPage sent unchanged-name
// edits through renameWorkspaceFile with a "-staged-renamed" suffix. Both builds exited 0 and
// both verification runs printed "6 check(s) failed" and exited 1 (three Files and three NAG hint
// checks in each). A kept metadata-filename-preserved green; B kept metadata-dialog-no-error green.
// Both production files were confirmed clean before staging and restored with git checkout after
// their runs. An earlier option-lookup setup failure is excluded: it never reached the native break.
// The new scenario now follows the NAG checks to preserve their original navigation sequence;
// the four assertion bodies used for these measured failures are unchanged.
//   break | check                       | exact message printed                                              | exit
//   A     | metadata-dialog-no-error    | FAIL  the Files metadata edit submits without a dialog error        | 1
//         |                             |       The file operation could not be completed. Please try again.   |
//   B     | metadata-repertoire-filter  | FAIL  the Repertoire filter lists the metadata-edited workspace file | 1
//         |                             |       timed out waiting for verify-metadata-only Files row           |
//   A     | metadata-sidecar-type       | FAIL  the metadata-edited workspace sidecar records repertoire on disk | 1
//         |                             |       ENOENT: no such file or directory, open '/tmp/chessfable-verify-8rOp69/path-owner-fixture/files-workspace/verify-metadata-only.info' |
//   B     | metadata-filename-preserved | FAIL  the Files metadata edit preserves the PGN filename             | 1
//         |                             |       original PGN exists: false; PGN filenames: ["verify-metadata-only-staged-renamed.pgn","verify-nags.pgn","verify-practice-large.pgn","verify-sample.pgn"] |

// Staged-failure record for default-root-unusable (2026-10-03). Both full runs used the same
// harness inside a 4 GiB scope. The correct release printed 62 ok lines and "all checks passed",
// exit 0. Removing only the default-root label and rebuilding left all 61 existing checks green:
// "1 check(s) failed", exit 1. main.rs was restored byte-exact and the release rebuilt afterwards.
//   break                                   | assertion/message                              | exit
//   get_default_database_workspace removes | FAIL  default-root-unusable: the Databases     | 1
//   .map_err(Error::label_root_failure)     |   alert offers a visible folder chooser         |
//   from ensure_app_owned_default_dir      |   observed Databases alert: {"button":null,     |
//                                           |   "message":"Could not load databases. Please  |
//                                           |   try again.","buttonDisplayed":false}          |

// Staged-failure record for selected-root-missing (2026-10-04). Changing only resolve_active_root's
// refusal branch to Ok(None) and rebuilding left all 62 other checks green: "1 check(s) failed",
// exit 1. The verifier was unchanged. mod.rs was restored with git checkout, git status --short
// src-tauri was empty, and the correct release was rebuilt before the final green run.
//   break                                   | assertion/message                              | exit
//   resolve_active_root maps the refusal   | FAIL  selected-root-missing: the Databases     | 1
//   branch to Ok(None), the pre-fix         |   alert offers a visible folder chooser         |
//   behaviour                              |   without recreating db                         |
//                                           |   timed out waiting for the missing selected   |
//                                           |   database root alert; db exists: true          |

// Staged-failure record for the NAG checks (push-review-policy §2), 2026-10-03, one row per
// assertion. Three runs against a release binary the harness reads, with the same harness in all
// three: run A is the pre-fix baseline, and runs B1 and B2 each staged exactly one change. Run A
// used a pre-fix release binary (built 2026-10-03 from master before the lossless-NAG change):
// "7 check(s) failed", exit 1. Run B1 used a release build of 2f4dc8c4 whose only change was
// `opacity: 0` on the AnnotationHint glyph box: "1 check(s) failed", exit 1, so the hint path, hint
// title and $220 assertions are independent of it. Run B2 used a release build of 2f4dc8c4 whose
// only change was a no-op SAVE_FILE handler in BoardAnalysis.tsx: "5 check(s) failed" (the save
// assertion and its four dependants), exit 1. Both staged sources were restored and rebuilt clean
// afterwards.
//   check                                   | run | message printed                                | exit
//   hint-glyph-path                          | A   | FAIL  the $8 board hint is rendered with a    | 1
//                                           |     |   glyph path — observed board hint:           |
//                                           |     |   {"title":"",…}                               |
//   hint-title                               | A   | FAIL  the $8 board hint SVG title is □ —      | 1
//                                           |     |   observed board hint: {"title":"",…}         |
//   hint-visibility                          | B1  | FAIL  the $8 board hint has a visible box and | 1
//                                           |     |   positive opacity through its board          |
//                                           |     |   ancestors — observed board hint:            |
//                                           |     |   {"title":"□",…,"opacity":"0",…}             |
//   unknown-hint-absence                     | A   | FAIL  the unknown $220 renders no board       | 1
//                                           |     |   annotation hint — observed board hint:      |
//                                           |     |   {"title":"",…}                               |
//   saved-edit                               | B2  | FAIL  SAVE_FILE writes Nc3?! to the seeded NAG | 1
//                                           |     |   file — timed out waiting for the NAG file's |
//                                           |     |   saved Nc3?! edit; file changed: false       |
//   preserves-$8                             | A   | FAIL  the saved NAG game preserves $8 —       | 1
//                                           |     |   observed saved movetext: 1. e4 e5 2. d4!?   |
//                                           |     |   d5 3. Nc3?! *                                |
//   preserves-$11                            | A   | FAIL  the saved NAG game preserves $11 — same | 1
//                                           |     |   observed movetext                            |
//   preserves-d4!-$2                         | A   | FAIL  the saved NAG game preserves d4! $2 —   | 1
//                                           |     |   same observed movetext                       |
//   preserves-$220                           | A   | FAIL  the saved NAG game preserves $220 — same | 1
//                                           |     |   observed movetext                            |
// The NAG row lookup, double-click open, the three navigations and the Annotate-panel click are
// setup, not assertions: a setup failure prints FAIL on every dependent assertion above with
// "not attempted: <step>: <error>", as run B2 shows for the four preserves-* checks.

// Board-surface selector repair staging (f-20261005-07), 2026-10-09. The corrected verifier
// stayed byte-identical in all three runs. Each changed only one AnnotationHint renderer input,
// built the real release successfully (exit 0), then ran pnpm verify:app (exit 1, exactly one
// failure and 85 successes). In every run the other two $8 assertions, unknown-$220 absence
// and all NAG-save assertions stayed green. The 2026-10-03 evidence above remains historical.
//   check            | renderer input             | actual unique message printed                                      | exit
//   hint-glyph-path  | square glyph paths removed | FAIL  the $8 board hint is rendered with a glyph path               | 1
//   hint-title       | incorrect square title     | FAIL  the $8 board hint SVG title is □                              | 1
//   hint-visibility  | actual square badge opacity 0 | FAIL  the $8 board hint has a visible box and positive opacity through its board ancestors | 1
// Path run observed rendered=true, path=false, title=□, visible=true. Title run observed
// rendered=true, path=true, title="incorrect square title", visible=true. Opacity run observed
// rendered=true, path=true, title=□, visible=false, badge opacity="0" and all ancestor opacities="1".
// All three observed badge dimensions were 18 by 18.15625. Full observed ancestor JSON, complete
// output, source snapshots and named completion records are retained under:
// /tmp/build-a51461c5-317b-40c0-8297-ab16a2fc6904/phase-2-evidence/
//   path:    gate-phase2-path.3BVzvg/{log,completion.record}, AnnotationHint.path-staged.tsx
//   title:   gate-phase2-title.NDZGFb/{log,completion.record}, AnnotationHint.title-staged.tsx
//   opacity: gate-phase2-opacity.SF8Rs4/{log,completion.record}, AnnotationHint.opacity-staged.tsx
// Before each next stage, apply_patch restored the intended source byte-for-byte. All three
// restoration SHA-256 values were 1304089c32f62fed2f62e7cbb1340496d1ce22f6a08fc4641559c47f059e35b9.
// Evidence: {path,title,opacity}-restored.sha256, corresponding *-restoration-check.log files
// and AnnotationHint.intended.tsx. The corrected verifier's unchanged SHA-256 during staging
// was b90067266716202d90f88c27f66d0faa8199d7bc8f3667cafbda69989108e198 (intended.sha256).

// Staged-failure record for the file-freshness checks (2026-09-25). Each break was restored
// before the next run. The in-place row replaced the file by rename. The read row did not
// install the recorder. The apply row set the ceiling to 0. The withhold row deleted the PGN
// after the in-place write. The conditional Reload check is not on the clean-tree path, so
// this run did not enter it.
//   break                                   | assertion/message                              | exit
//   rename over the open PGN                | FAIL  the stale-file scenario rewrites the PGN | 1
//                                           |   in place — inode changed from 92699786 to    |
//                                           |   92703392                                     |
//   recorder not installed                  | FAIL  the file freshness transition includes a | 1
//                                           |   measured native read_game call — read_game   |
//                                           |   duration: null                               |
//   apply ceiling 0                         | FAIL  the freshness transition applies within  | 1
//                                           |   0 ms of the measured read — apply duration:  |
//                                           |   448.0 ms; read_game duration: 9.0 ms         |
//   PGN removed after the in-place write    | FAIL  the open file-backed tab reloads or      | 1
//                                           |   withholds the changed PGN — freshness state: |
//                                           |   unavailable                                  |

// Staged-failure record for the practice checks (2026-09-23). Each break was made in the
// release artifact, rebuilt, run inside the 4 GiB scope, and restored with a clean rebuild.
// The sync assertion now records a failed wait through the assertion helper so its own FAIL line and the final
// count FAIL line remain independently visible.
//   break                                   | assertion/message                              | exit
//   native positions snapshot drops one    | FAIL  the native practice read returns all     | 1
//   seeded position                        |   12,000 seeded positions                      |
//   review paging omits the oldest entry   | FAIL  native practice review paging returns    | 1
//                                           |   every seeded entry and reaches the oldest    |
//                                           |   review                                        |
//   migration command refuses the legacy   | FAIL  the legacy practice deck is migrated    | 1
//   document                               |   into the native store through real IPC       |
//   renderer rating also writes a          | FAIL  renderer ratings create no new legacy   | 1
//   deck-id-game key                        |   key and do not grow the existing key         |
//   sync command acknowledges without      | FAIL  the real sync path stores 500 further    | 1
//   writing                                |   repertoire positions; FAIL  final restart   |
//                                           |   preserves exact native position and review   |
//                                           |   counts for both decks                         |
//   post-rating review page omits one      | FAIL  fifty renderer ratings land in the      | 1
//   seeded entry at revision 100051         |   native practice review store                 |
//   post-rating deck snapshot omits one    | FAIL  renderer ratings do not alter the       | 1
//   position at revision 100051             |   large deck's 12,000 native positions         |
//   panel maps Good (3) to Hard (2)         | FAIL  the 50 new native reviews record the    | 1
//                                           |   panel's Good rating — ratings: [2, ...]      |
//   loading/read-failed sync reset removed | FAIL  the real sync path stores 500 further    | 1
//                                           |   repertoire positions; FAIL  final restart   |
//                                           |   preserves exact native position and review   |
//                                           |   counts for both decks                         |
//
// The native position/review/migration breaks were grouped once and aborted at the disabled
// practice prerequisite after their own FAIL lines; the renderer-writer break reached its own
// key assertion and then aborted in the extended-sync wait. Those observed aborts are listed
// below rather than inferred as additional assertion evidence.

// ARGUED, NOT STAGED. These assertions have no row because the only available break aborts before
// their check (or requires editing this verifier):
//   assertion                              | reason observed
//   the real Tauri IPC bridge is present   | Removing the bridge from the bundled renderer made
//                                         | the seed run abort at "timed out waiting for seed
//                                         | window controls", before any assertion line.
//   the custom title bar rendered its     | Removing the controls made the same prerequisite
//   window controls                       | wait abort at "timed out waiting for seed window
//                                         | controls". Once that wait succeeds, its probe can
//                                         | return only "label" or "fallback", both accepted
//                                         | by the assertion; making it fail would edit the
//                                         | verifier or abort the prerequisite.
//   the application process is running    | A binary that exited during setup made the run abort
//   before the close                     | at "WebDriver session creation failed: This operation
//                                         | was aborted". The close helper reads appProcesses()
//                                         | and throws if no application exists before it can
//                                         | call this check, so a dead application cannot print
//                                         | this assertion's FAIL line.
//
// Abort-only attempts are not rows: the break described as "unconditional startup attachment error"
// aborted at "timed out waiting for production startup to reconcile the seeded path registry";
// the break described as "managed-image cleanup intent" then aborted at
// "timed out waiting for the managed-image cleanup intent" after its two rows. A first
// process-survival break also aborted at "seed processes survived close: 4062332, 4062375" before
// the assertion session. A first image-cleanup break left all checks green because startup never
// put the retained image through that cleanup path; it was restored and replaced by the staged
// startup-retirement break above. None of these aborts is cited as assertion evidence.
//
// Practice staged-break aborts:
//   assertion                              | reason observed
//   migration capability retention         | The migration refusal left the final retained-owner
//                                         | startup prerequisite unsatisfied before final
//                                         | inventory/count checks; its direct migration FAIL
//                                         | is recorded above.
//   legacy-key untouched                   | No binary-only break can delete a browser key;
//                                         | doing so would edit this verifier's WebDriver
//                                         | fixture or stage the explicitly excluded key
//                                         | deletion behavior.
//   final native inventory and migrated   | The migration refusal aborts final practice
//   counts                                 | retention startup before those checks; the sync
//                                         | break independently reached and failed final
//                                         | exact counts while inventory and migrated counts
//                                         | remained green.
//   legacy capability after key removal   | Dropping this exact id from the native inventory
//                                         | contribution makes the app drop its owner after
//                                         | the browser key is removed, but the kept
//                                         | reopenAssertionSession wait aborts first at
//                                         | "legacy-key removal startup to retain practice
//                                         | capabilities" (exit 1), before the retention
//                                         | assertion can print a FAIL line. Reaching the
//                                         | assertion would require changing that kept
//                                         | verifier wait, so no binary-only independent row
//                                         | is possible.

import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, readdir, rename, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { createHash, randomUUID } from "node:crypto";
import { isAbsolute, join } from "node:path";
import { Chess, makeSquare } from "chessops";
import { makeFen, parseFen } from "chessops/fen";
import { makeSan } from "chessops/san";
import { createEmptyCard } from "ts-fsrs";
import {
  deserializeStorageValue,
  serializeStorageValue,
} from "../src/state/store/debouncedStorage.ts";
import {
  APP_BINARY,
  Session,
  appProcesses,
  driverDiagnostics,
  launch,
  outputBuffer,
  processExists,
  registerTemporaryProfile,
  requirePrerequisites,
  shutdown,
  startCompositor,
  startDriver,
  stopLaunchedChild,
  waitFor,
} from "./app-driver.mjs";

const screenshotIndex = process.argv.indexOf("--screenshot");
const screenshotPath = screenshotIndex === -1 ? undefined : process.argv[screenshotIndex + 1];
const progressContractOnly = process.argv.includes("--progress-contract");
const expectClearRejection = process.argv.includes("--expect-clear-rejection");
const applicationIndex = process.argv.indexOf("--application");
const progressGenerationIndex = process.argv.indexOf("--expect-progress-generation");
const progressApplication =
  applicationIndex === -1 ? APP_BINARY : process.argv[applicationIndex + 1];
const expectedProgressGeneration =
  progressGenerationIndex === -1 ? undefined : process.argv[progressGenerationIndex + 1];
const BASE_DIRECTORY_APP_DATA = 14; // @tauri-apps/api BaseDirectory.AppData
const IPC_PROBE_TIMEOUT_MS = 5_000;
const INSTANCE_PROBE_TIMEOUT_MS = 15_000;
const CSP_PROBE_TIMEOUT_MS = 4_000;
const FILES_PROBE_TIMEOUT_MS = 20_000;
const PRACTICE_RENDERER_TIMEOUT_MS = 600_000;
// Keep aligned with FILE_REVISION_INTERVAL_MS in src/state/fileFreshness.ts.
const FILE_FRESHNESS_POLL_INTERVAL_MS = 2_000;
const FILE_FRESHNESS_APPLY_BUDGET_MS = 1_000;
// How long a practice-step failure waits for a stalled renderer to answer before dumping its state.
const RENDERER_RECOVERY_TIMEOUT_MS = 60_000;
const PRACTICE_REVIEW_PAGE_LIMIT = 500; // Mirrors PRACTICE_READ_MAX_ENTRIES in practice.rs.
const PRACTICE_MOVE_CLICK_DELAY_MS = 40;
// Gap between the two clicks of the double-click. It must stay inside the platform double-click
// interval, or WebKitGTK delivers two single clicks and the scenario proves nothing.
const DOUBLE_CLICK_GAP_MS = 60;
// Allow a queued native frame and React render to settle before observing the stale event.
const PROGRESS_STALE_EVENT_OBSERVATION_DELAY_MS = 100;
const filesWorkspaceId = "verify-files-workspace";
const filesRowName = "verify-sample";
const filesMetadataRowName = "verify-metadata-only";
const openingRowName = "verify-game-opening";
const emptyOpeningRowName = "verify-empty-opening";
const openingDatabaseTitle = "verify opening database";
const openingGames = [
  { white: "Opening First", black: "First Opponent", moves: "1. e4 e5 *", notation: "1.e4e5" },
  { white: "Opening Second", black: "Second Opponent", moves: "1. d4 d5 *", notation: "1.d4d5" },
];
const openingPgn = openingGames
  .map(
    (game, index) =>
      `[Event "verify:opening-${index}"]\n[Date "2026.10.10"]\n[White "${game.white}"]\n[Black "${game.black}"]\n[Result "*"]\n\n${game.moves}\n`,
  )
  .join("\n");
// Pawn moves only, so the notation reads the same with and without figurines.
const filesGamePgn = `[Event "verify:app"]
[Site "?"]
[Date "2026.09.19"]
[Round "1"]
[White "A"]
[Black "B"]
[Result "*"]

1. e4 e5 2. d4 d5 *
`;
const filesGameNotation = "1.e4e52.d4d5";
const nagsRowName = "verify-nags";
const nagsGamePgn = `[Event "verify:nags"]
[Site "?"]
[Date "2026.10.03"]
[Round "1"]
[White "A"]
[Black "B"]
[Result "*"]

1. e4 $8 e5 $11 2. d4 $1 $2 d5 $220 3. Nc3 *
`;
const closeControlLookup = `
  const labelled = document.querySelector('button[aria-label="Close window"]');
  const controls = document.querySelector('[class*="windowControls"]');
  const fallback = controls ? controls.querySelector('button:last-of-type') : null;
`;
const closeControlProbe = `
  ${closeControlLookup}
  return labelled ? "label" : fallback ? "fallback" : false;
`;
const closeControlAction = `
  ${closeControlLookup}
  const close = labelled || fallback;
  if (!close) throw new Error("could not find the close control in the window-controls group");
  setTimeout(() => close.click(), 0);
  return 1;
`;

const failures = [];
const check = (condition, description, detail) => {
  console.log(`${condition ? "  ok  " : "FAIL  "}${description}`);
  if (!condition) {
    failures.push(description);
    if (detail) console.log(`      ${detail}`);
  }
};

const PRACTICE_STORAGE_VERSION = 1;
const PRACTICE_SHARD_SEAL_BYTES = 128 * 1024;
const practiceStateKey = (fen) => fen.split(" ").slice(0, 4).join(" ");
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const practiceDeckHash = (fileId, game) => sha256(`${fileId}\0${game}`);
const practiceMoveUci = (move) =>
  `${makeSquare(move.from)}${makeSquare(move.to)}${move.promotion ?? ""}`;

function practiceLegalMoves(position) {
  const moves = [];
  for (const [from, destinations] of position.allDests()) {
    if (destinations.isEmpty()) continue;
    const piece = position.board.get(from);
    for (const to of destinations) {
      const move = { from, to };
      if (piece?.role === "pawn" && (to >= 56 || to < 8)) move.promotion = "queen";
      moves.push(move);
    }
  }
  return moves;
}

function buildPracticeFixtureTree() {
  let randomState = 0x4f1a2b3c;
  const nextRandom = () => {
    randomState = (Math.imul(randomState, 1664525) + 1013904223) >>> 0;
    return randomState / 4294967296;
  };
  const movesFor = (position, seen) => {
    const moves = practiceLegalMoves(position).filter((move) => !position.board.get(move.to));
    moves.sort(() => nextRandom() - 0.5);
    return moves.filter((move) => {
      const next = position.clone();
      next.play(move);
      return !seen.has(practiceStateKey(makeFen(next.toSetup())));
    });
  };
  const makeNode = (position, move) => {
    const next = position.clone();
    const san = makeSan(next, move);
    next.play(move);
    return { position: next, san, children: [] };
  };
  const setup = parseFen("7k/6rr/8/8/8/8/RR6/K7 w - - 0 1").unwrap();
  const root = { position: Chess.fromSetup(setup).unwrap(), children: [] };
  const seen = new Set([practiceStateKey(makeFen(root.position.toSetup()))]);
  // buildFromTree excludes the root when the repertoire has no explicit start path.
  const target = 12_501;
  const whiteNodes = [root];
  let cards = 0;
  // Breadth-first keeps the RAV tree shallow enough for tab persistence. Each white node has one
  // answer; each black node contributes at most two unseen replies (two is within the plan's
  // four-reply ceiling and keeps the generated tree close to the measured 30k-node fixture).
  for (let index = 0; index < whiteNodes.length && cards < target; index += 1) {
    const whiteNode = whiteNodes[index];
    const answer = movesFor(whiteNode.position, seen)[0];
    if (!answer) continue;
    const blackNode = makeNode(whiteNode.position, answer);
    whiteNode.children = [blackNode];
    const blackKey = practiceStateKey(makeFen(blackNode.position.toSetup()));
    seen.add(blackKey);
    cards += 1;
    const replies = movesFor(blackNode.position, seen).slice(0, 2);
    for (const reply of replies) {
      const child = makeNode(blackNode.position, reply);
      blackNode.children.push(child);
      seen.add(practiceStateKey(makeFen(child.position.toSetup())));
      whiteNodes.push(child);
    }
  }
  if (cards !== target) throw new Error(`could not extend practice fixture to ${target} cards`);
  return root;
}

function clonePracticeFixtureTree(node) {
  const clone = {
    position: node.position.clone(),
    san: node.san,
    children: [],
  };
  const pending = [[node, clone]];
  while (pending.length > 0) {
    const [source, target] = pending.pop();
    for (const child of source.children) {
      const childClone = { position: child.position.clone(), san: child.san, children: [] };
      target.children.push(childClone);
      pending.push([child, childClone]);
    }
  }
  return clone;
}

function collectPracticePositions(root) {
  // Independent oracle: keep expected fixture cards separate from the product's opening.ts logic.
  const seen = new Set();
  const positions = [];
  const visit = (node) => {
    const fen = makeFen(node.position.toSetup());
    const key = practiceStateKey(fen);
    if (
      node !== root &&
      node.children.length > 0 &&
      node.position.turn === "white" &&
      !seen.has(key)
    ) {
      seen.add(key);
      const firstMove = node.children[0];
      positions.push({
        fen,
        answer: firstMove.san,
        uci: practiceMoveUciFromNodes(node, firstMove),
      });
    }
    for (let index = node.children.length - 1; index >= 0; index -= 1) {
      pending.push(node.children[index]);
    }
  };
  const pending = [root];
  while (pending.length > 0) visit(pending.pop());
  return positions;
}

function practiceMoveUciFromNodes(parent, child) {
  const move = practiceLegalMoves(parent.position).find(
    (candidate) => makeSan(parent.position, candidate) === child.san,
  );
  if (!move) throw new Error(`could not resolve fixture move ${child.san}`);
  return practiceMoveUci(move);
}

function prunePracticeFixtureTree(root, count) {
  const orderedCards = [];
  const seen = new Set();
  const pending = [root];
  while (pending.length > 0) {
    const node = pending.pop();
    const fen = makeFen(node.position.toSetup());
    const key = practiceStateKey(fen);
    if (
      node !== root &&
      node.children.length > 0 &&
      node.position.turn === "white" &&
      !seen.has(key)
    ) {
      seen.add(key);
      orderedCards.push(node);
    }
    for (let index = node.children.length - 1; index >= 0; index -= 1) {
      pending.push(node.children[index]);
    }
  }
  const retainedCards = orderedCards.slice(0, count);
  const kept = new Set(retainedCards);
  const keep = new Map();
  const postorder = [{ node: root, visited: false }];
  while (postorder.length > 0) {
    const frame = postorder.pop();
    if (frame.visited) {
      const retain = kept.has(frame.node) || frame.node.children.some((child) => keep.get(child));
      keep.set(frame.node, retain);
      frame.node.children = frame.node.children.filter(
        (child, index) => (kept.has(frame.node) && index === 0) || keep.get(child),
      );
    } else {
      postorder.push({ node: frame.node, visited: true });
      for (const child of frame.node.children) postorder.push({ node: child, visited: false });
    }
  }
  return retainedCards.map((node) => ({
    fen: makeFen(node.position.toSetup()),
    answer: node.children[0].san,
    uci: practiceMoveUciFromNodes(node, node.children[0]),
  }));
}

function practicePgn(root) {
  const emit = (node) => {
    if (node.children.length === 0) return "";
    let result = ` ${node.children[0].san}`;
    for (const alternative of node.children.slice(1)) result += ` (${emitLine(alternative)})`;
    return result + emit(node.children[0]);
  };
  const emitLine = (node) => `${node.san}${emit(node)}`;
  const fen = makeFen(root.position.toSetup());
  return `[Event "verify:practice"]\n[Site "verify:app"]\n[SetUp "1"]\n[FEN "${fen}"]\n[Result "*"]\n\n${emit(root)} *\n`;
}

function emptyPracticeCard() {
  return { ...createEmptyCard(), due: new Date("2026-01-01T00:00:00.000Z").toISOString() };
}

function practicePositionsDocument(positions) {
  return positions.map(({ fen, answer }) => ({ fen, answer, card: emptyPracticeCard() }));
}

async function seedNativePracticeDeck(practiceDirectory, fileId, game, positions, reviewCount) {
  const hash = practiceDeckHash(fileId, game);
  const entries = Array.from({ length: reviewCount }, (_, index) => {
    const entry = { index, kind: "seed" };
    return { id: `seed-review-${String(index).padStart(6, "0")}`, rev: index + 1, entry };
  });
  const shards = [];
  let current = {
    version: PRACTICE_STORAGE_VERSION,
    fileId,
    game,
    generation: 0,
    ordinal: 0,
    entries: [],
  };
  for (const entry of entries) {
    const candidate = { ...current, entries: [...current.entries, entry] };
    if (
      current.entries.length > 0 &&
      Buffer.byteLength(JSON.stringify(candidate)) > PRACTICE_SHARD_SEAL_BYTES
    ) {
      shards.push(current);
      current = { ...current, ordinal: current.ordinal + 1, entries: [entry] };
    } else {
      current = candidate;
    }
  }
  if (current.entries.length > 0) shards.push(current);
  const positionValues = practicePositionsDocument(positions);
  const lastEntry = entries.at(-1);
  const envelope = {
    version: PRACTICE_STORAGE_VERSION,
    fileId,
    game,
    revision: reviewCount,
    generation: 0,
    lastEntryId: lastEntry.id,
    lastEntryDigest: sha256(JSON.stringify(lastEntry.entry)),
    appliedEntries: reviewCount,
    orphanEntries: 0,
    orphanAcknowledgedCount: 0,
    legacySource: "none",
    migratedAt: null,
    migratedEntries: null,
    migratedPositionsDigest: null,
    positions: positionValues,
  };
  await mkdir(practiceDirectory, { recursive: true });
  await writeFile(join(practiceDirectory, `${hash}-positions.json`), JSON.stringify(envelope));
  for (const shard of shards) {
    await writeFile(
      join(practiceDirectory, `${hash}-g0-reviews-${shard.ordinal}.json`),
      JSON.stringify(shard),
    );
  }
  return { positions: positionValues, reviewIds: entries.map(({ id }) => id) };
}

async function closeApplicationThroughTitlebar(session, label) {
  await waitFor(`${label} window controls`, () =>
    session.execute(closeControlProbe).catch(() => false),
  );
  const running = appProcesses();
  const application = running.find(({ cmd }) => cmd.includes(APP_BINARY));
  if (!application) throw new Error(`${label} application process was not running`);
  const webkitServicePids = running
    .filter(
      ({ ppid, cmd }) =>
        ppid === application.pid && /WebKitWebProcess|WebKitNetworkProcess/.test(cmd),
    )
    .map(({ pid }) => pid);
  const trackedPids = [application.pid, ...webkitServicePids];
  await session.execute(closeControlAction);
  const gone = await waitFor(
    `${label} application pid ${application.pid} and recorded WebKit service pids to exit`,
    () => trackedPids.every((pid) => !processExists(pid)),
    { timeoutMs: 30_000 },
  ).catch(() => false);
  return {
    application,
    webkitServicePids,
    running,
    gone,
    survivors: trackedPids.filter(processExists),
  };
}

async function databaseAlert(session, label) {
  const alert = await waitFor(
    label,
    async () => {
      await session.execute(
        `const link = document.querySelector('a[href="/databases"]');
         if (link && location.pathname !== "/databases") link.click();
         return true`,
      );
      return session.execute(
        `const alert = document.querySelector('[role="alert"]');
         if (location.pathname !== "/databases" || !alert) return false;
         return { message: alert.querySelector('p')?.textContent ?? null,
                  button: alert.querySelector('button')?.textContent?.trim() ?? null };`,
      );
    },
    { timeoutMs: FILES_PROBE_TIMEOUT_MS },
  );
  let buttonDisplayed = false;
  if (alert.button === "Choose database folder") {
    const button = await session.call("POST", "/element", {
      using: "css selector",
      value: '[role="alert"] button',
    });
    buttonDisplayed = await session.call(
      "GET",
      `/element/${encodeURIComponent(button["element-6066-11e4-a52e-4f735466cecf"])}/displayed`,
    );
  }
  return { ...alert, buttonDisplayed };
}

async function invokeAndWait(session, label, globalName, invokeExpression, successKey = "value") {
  const starterError = await session
    .execute(`
      window[${JSON.stringify(globalName)}] = null;
      (${invokeExpression}).then(
        value => { window[${JSON.stringify(globalName)}] = { [${JSON.stringify(successKey)}]: String(value) }; },
        error => { window[${JSON.stringify(globalName)}] = { rejected: typeof error === "object" ? JSON.stringify(error) : String(error) }; },
      );
      return true;
    `)
    .then(
      () => null,
      (error) => ({ error: error.message }),
    );
  if (starterError) return starterError;

  return await waitFor(
    label,
    () =>
      session
        .execute(`return window[${JSON.stringify(globalName)}] || false`)
        .catch((error) => ({ error: error.message })),
    { timeoutMs: IPC_PROBE_TIMEOUT_MS },
  ).catch((error) => ({ error: error.message }));
}

async function invokeJsonAndWait(session, label, globalName, invokeExpression) {
  const result = await invokeAndWait(
    session,
    label,
    globalName,
    `(${invokeExpression}).then(value => JSON.stringify(value))`,
    "json",
  );
  if (typeof result.json !== "string") return { result, value: undefined };
  try {
    return { result, value: JSON.parse(result.json) };
  } catch (error) {
    return { result, value: undefined, error: error.message };
  }
}

async function verifyProgressContract(session, { cancellation = false } = {}) {
  const id = `verify-progress:${randomUUID()}`;
  const ipc = (command, args) =>
    `window.__TAURI_INTERNALS__.invoke(${JSON.stringify(command)}, ${JSON.stringify(args)})`;
  const invoke = (command, args) =>
    invokeJsonAndWait(session, command, "__verifyProgressResult", ipc(command, args));
  const canonical = canonicalProgressGeneration;
  const exact = (value, expected) => canonical(value) && value === expected;
  await session.execute(`
    window.__verifyProgressEvents = [];
    window.__verifyProgressHandler = window.__TAURI_INTERNALS__.transformCallback(event => {
      window.__verifyProgressEvents.push(event.payload);
    });
    return true;
  `);
  const registration = await invokeJsonAndWait(
    session,
    "progress listener registration",
    "__verifyProgressRegistration",
    `window.__TAURI_INTERNALS__.invoke("plugin:event|listen", { event: "progress-event", target: { kind: "Any" }, handler: window.__verifyProgressHandler })`,
  );
  check(
    typeof registration.value === "number",
    "progress native event listener registers",
    JSON.stringify(registration),
  );
  const event = async (description, predicate, generation, extra) => {
    const observed = await waitFor(
      description,
      () =>
        session.execute(
          `return window.__verifyProgressEvents.find(payload => payload.id === arguments[0] && (${predicate})) || false`,
          [id],
        ),
      { timeoutMs: IPC_PROBE_TIMEOUT_MS },
    ).catch((error) => ({ error: error.message }));
    check(
      exact(observed.generation, generation) && extra(observed),
      description,
      JSON.stringify(observed),
    );
    return observed;
  };
  try {
    const start = await invoke("start_progress", { id });
    const generation = start.value?.generation;
    check(
      canonical(generation) &&
        start.value.id === id &&
        (expectedProgressGeneration === undefined || generation === expectedProgressGeneration),
      "progress start lease has exact canonical string generation",
      JSON.stringify(start),
    );
    if (!canonical(generation)) return;
    console.log(`  ..  progress start wire: ${JSON.stringify(start.value)}`);
    await event(
      "progress running event has exact canonical string generation",
      'payload.state === "running" && payload.progress === 0',
      generation,
      (payload) => payload.finished === false && payload.cleared === false,
    );
    const running = await invoke("set_progress_state", {
      lease: start.value,
      progress: 35,
      progressState: "running",
    });
    const snapshot = await invoke("get_progress", { id });
    check(
      running.value === null &&
        exact(snapshot.value?.generation, generation) &&
        snapshot.value?.progress === 35 &&
        snapshot.value?.state === "running",
      "progress state-update string lease reaches native with exact identity",
      JSON.stringify({ running, snapshot }),
    );
    check(
      exact(snapshot.value?.generation, generation) &&
        snapshot.value?.id === id &&
        snapshot.value?.finished === false,
      "progress snapshot has exact canonical string generation",
      JSON.stringify(snapshot),
    );
    const terminal = await invoke("set_progress_state", {
      lease: start.value,
      progress: 100,
      progressState: "failed",
    });
    check(
      terminal.value === null,
      "progress terminal state update accepts the string lease",
      JSON.stringify(terminal),
    );
    await event(
      "progress terminal event has exact canonical string generation",
      'payload.state === "failed"',
      generation,
      (payload) =>
        payload.finished === true && payload.progress === 100 && payload.cleared === false,
    );
    const invalid = await invoke("set_progress_state", {
      lease: { id, generation: "01" },
      progress: 50,
      progressState: "running",
    });
    const unchanged = await invoke("get_progress", { id });
    check(
      typeof invalid.result.rejected === "string" &&
        JSON.stringify(unchanged.value) ===
          JSON.stringify({ ...snapshot.value, progress: 100, finished: true, state: "failed" }),
      "progress malformed lease rejects without changing the snapshot",
      JSON.stringify({ invalid, unchanged }),
    );
    const malformedClear = await invoke("clear_progress", { id: null });
    check(
      typeof malformedClear.result.rejected === "string",
      "progress invalid clear rejects as a native IPC operation",
      JSON.stringify(malformedClear),
    );
    const cleared = await invoke("clear_progress", { id });
    if (expectClearRejection) {
      let rejection = null;
      try {
        if (typeof cleared.result.rejected === "string")
          rejection = JSON.parse(cleared.result.rejected);
      } catch {
        // The assertion below identifies a malformed rejection envelope too.
      }
      check(
        rejection?.tag === "backend-error" && rejection.category === "conflict",
        "progress deliberate clear failure returns a typed native rejection",
        JSON.stringify(cleared),
      );
    } else {
      const floor = (BigInt(generation) + 1n).toString();
      check(
        exact(cleared.value, floor),
        "progress clear return has exact canonical string generation",
        JSON.stringify(cleared),
      );
      await event(
        "progress cleared event has exact canonical string generation",
        "payload.cleared === true",
        floor,
        (payload) =>
          payload.finished === true && payload.state === "cancelled" && payload.progress === 0,
      );
      const empty = await invoke("get_progress", { id });
      check(
        empty.value === null,
        "progress clear removes the native snapshot",
        JSON.stringify(empty),
      );
    }
    if (cancellation && expectClearRejection) await verifyProgressCancellation(session, invoke);
  } finally {
    await session.execute(
      `window.__TAURI_EVENT_PLUGIN_INTERNALS__.unregisterListener("progress-event", arguments[0]); return true;`,
      [registration.value],
    );
    const unlisten = await invokeJsonAndWait(
      session,
      "progress listener cleanup",
      "__verifyProgressUnlisten",
      `window.__TAURI_INTERNALS__.invoke("plugin:event|unlisten", { event: "progress-event", eventId: ${JSON.stringify(registration.value)} })`,
    );
    check(
      unlisten.value === null,
      "progress native event listener is released",
      JSON.stringify(unlisten),
    );
    await session.execute(
      `window.__TAURI_INTERNALS__.unregisterCallback(window.__verifyProgressHandler); delete window.__verifyProgressEvents; delete window.__verifyProgressHandler; return true;`,
    );
  }
}

async function verifyProgressCancellation(session, invoke) {
  const catalog = JSON.parse(
    await readFile(new URL("../src/catalogs/databases.json", import.meta.url), "utf8"),
  )[0];
  const id = `db:${catalog.downloadLink}`;
  await session.execute(`document.querySelector('a[href="/databases"]').click(); return true;`);
  await waitFor("progress database catalog opener", () =>
    session.execute(
      `const button = document.querySelector('button[aria-label="Add New"]'); if (!button) return false; button.click(); return true;`,
    ),
  );
  await waitFor("progress database catalog card", () =>
    session.execute(
      `
    const title = [...document.querySelectorAll('[role="dialog"] p')].find(node => node.textContent === arguments[0]);
    const card = title?.closest('.mantine-Paper-root');
    const action = card && [...card.querySelectorAll('button')].find(button => button.textContent.trim() === "Install");
    if (!action || action.disabled) return false;
    window.__verifyProgressCard = card;
    window.__verifyProgressAction = action[Object.keys(action).find(key => key.startsWith('__reactProps$'))]?.onClick;
    return typeof window.__verifyProgressAction === 'function';
  `,
      [catalog.title],
    ),
  );
  const lease = await invoke("start_progress", { id });
  await invoke("set_progress_state", {
    lease: lease.value,
    progress: 35,
    progressState: "running",
  });
  const card = async () =>
    session.execute(`
    const card = window.__verifyProgressCard;
    return { progress: card.querySelector('[role="progressbar"]')?.getAttribute('aria-valuenow') ?? null,
      cancel: !!card.querySelector('button[aria-label="Cancel"]'),
      action: [...card.querySelectorAll('button')].some(button => button.textContent.trim() === 'Install' && !button.disabled) };
  `);
  const visible = await waitFor("progress high-generation running UI", async () => {
    const state = await card();
    return state.progress === "35" && state.cancel ? state : false;
  }).catch((error) => ({ error: error.message }));
  check(
    visible.progress === "35" &&
      canonicalProgressLease(lease.value) &&
      BigInt(lease.value.generation) > 9007199254740991n,
    "progress high-generation wire event drives the real renderer bar",
    JSON.stringify({ lease, visible }),
  );
  const pressed = await session.execute(`
    window.__verifyProgressAction();
    const cancel = window.__verifyProgressCard.querySelector('button[aria-label="Cancel"]');
    if (!cancel) return false;
    cancel.click();
    return true;
  `);
  check(pressed === true, "progress cancellation presses the production pre-claim job button");
  const hidden = await waitFor("progress rejected-clear cancellation fence", async () => {
    const state = await card();
    return state.progress === null && !state.cancel && state.action ? state : false;
  }).catch((error) => ({ error: error.message }));
  check(
    hidden.progress === null && hidden.cancel === false && hidden.action === true,
    "progress rejected-clear null acknowledgement hides the cancelled generation",
    JSON.stringify(hidden),
  );
  await invoke("set_progress_state", {
    lease: lease.value,
    progress: 75,
    progressState: "running",
  });
  await new Promise((resolve) => setTimeout(resolve, PROGRESS_STALE_EVENT_OBSERVATION_DELAY_MS));
  const delayed = await card();
  check(
    delayed.progress === null && !delayed.cancel,
    "progress fenced old native event cannot resurrect the bar",
    JSON.stringify(delayed),
  );
  const retry = await invoke("start_progress", { id });
  await invoke("set_progress_state", {
    lease: retry.value,
    progress: 45,
    progressState: "running",
  });
  const retryVisible = await waitFor("progress retry UI", async () => {
    const state = await card();
    return state.progress === "45" && state.cancel ? state : false;
  }).catch((error) => ({ error: error.message }));
  check(
    canonicalProgressLease(retry.value) &&
      canonicalProgressLease(lease.value) &&
      BigInt(retry.value.generation) === BigInt(lease.value.generation) + 1n &&
      retryVisible.progress === "45" &&
      retryVisible.cancel === true,
    "progress newer retry remains distinct and visible after rejected clear",
    JSON.stringify({ retry, retryVisible }),
  );
  await invoke("set_progress_state", {
    lease: retry.value,
    progress: 65,
    progressState: "running",
  });
  const updating = await waitFor("progress retry update UI", async () => {
    const state = await card();
    return state.progress === "65" ? state : false;
  }).catch((error) => ({ error: error.message }));
  check(
    updating.progress === "65",
    "progress newer retry continues updating through the real facade",
    JSON.stringify(updating),
  );
  if (screenshotPath)
    await writeFile(screenshotPath, Buffer.from(await session.screenshot(), "base64"));
  await session.execute(
    "delete window.__verifyProgressAction; delete window.__verifyProgressCard; return true;",
  );
}

function canonicalProgressLease(lease) {
  return canonicalProgressGeneration(lease?.generation);
}

function canonicalProgressGeneration(value) {
  return (
    typeof value === "string" &&
    /^(0|[1-9][0-9]*)$/.test(value) &&
    value.length <= 20 &&
    BigInt(value) <= 18446744073709551615n
  );
}

async function loadPracticeDeckThroughIpc(session, fileId, game, globalName) {
  return invokeJsonAndWait(
    session,
    `load_practice_deck for ${fileId} to settle`,
    globalName,
    `window.__TAURI_INTERNALS__.invoke("load_practice_deck", ${JSON.stringify({ fileId, game })})`,
  );
}

async function loadAllPracticeReviews(session, fileId, game, globalPrefix) {
  const ids = [];
  const entries = [];
  let cursor = null;
  let page = 0;
  do {
    const loaded = await invokeJsonAndWait(
      session,
      `load_practice_reviews page ${page} for ${fileId} to settle`,
      `${globalPrefix}${page}`,
      `window.__TAURI_INTERNALS__.invoke("load_practice_reviews", ${JSON.stringify({
        fileId,
        game,
        cursor,
        limit: PRACTICE_REVIEW_PAGE_LIMIT,
      })})`,
    );
    if (!loaded.value || !Array.isArray(loaded.value.entries)) {
      return {
        ids,
        entries,
        complete: false,
        error: loaded.result.rejected ?? loaded.error ?? "practice review page was malformed",
      };
    }
    entries.push(...loaded.value.entries);
    ids.push(...loaded.value.entries.map(({ id }) => id));
    cursor = loaded.value.nextCursor;
    page += 1;
  } while (cursor !== null);
  return { ids, entries, complete: true, error: undefined };
}

/** True when the stored cards are exactly the expected fixture cards (FEN → answer), in any order. */
function practiceCardsMatch(actual, expected) {
  if (!Array.isArray(actual) || actual.length !== expected.length) return false;
  const expectedAnswers = new Map(expected.map(({ fen, answer }) => [fen, answer]));
  const seen = new Set();
  return actual.every(({ fen, answer }) => {
    if (seen.has(fen) || expectedAnswers.get(fen) !== answer) return false;
    seen.add(fen);
    return true;
  });
}

function practicePositionsFromSnapshot(snapshot) {
  try {
    const positions = JSON.parse(snapshot?.positionsDocument ?? "null").positions;
    return Array.isArray(positions) ? positions : undefined;
  } catch {
    return undefined;
  }
}

/** One real left click at viewport coordinates through W3C pointer actions. */
async function clickAt(session, x, y, id = "mouse") {
  await session.call("POST", "/actions", {
    actions: [
      {
        type: "pointer",
        id,
        parameters: { pointerType: "mouse" },
        actions: [
          { type: "pointerMove", duration: 0, x, y, origin: "viewport" },
          { type: "pointerDown", button: 0 },
          { type: "pointerUp", button: 0 },
        ],
      },
    ],
  });
}

/** One real double-click, with the two clicks inside the platform double-click interval. */
async function doubleClickAt(session, x, y) {
  await session.call("POST", "/actions", {
    actions: [
      {
        type: "pointer",
        id: "mouse",
        parameters: { pointerType: "mouse" },
        actions: [
          { type: "pointerMove", duration: 0, x, y, origin: "viewport" },
          { type: "pointerDown", button: 0 },
          { type: "pointerUp", button: 0 },
          { type: "pause", duration: DOUBLE_CLICK_GAP_MS },
          { type: "pointerDown", button: 0 },
          { type: "pointerUp", button: 0 },
        ],
      },
    ],
  });
}

async function filesRowCoordinates(session, name, timeoutMs = FILES_PROBE_TIMEOUT_MS) {
  return waitFor(
    `${name} Files row`,
    async () => {
      await session
        .execute(
          `const link = document.querySelector('a[href="/files"]');
           if (link && location.pathname !== "/files") link.click();
           return true`,
        )
        .catch(() => false);
      return session
        .execute(
          `const row = document.querySelector('[role="treeitem"][aria-label=' + JSON.stringify(arguments[0]) + ']');
           if (!row) return false;
           const box = row.getBoundingClientRect();
           return { x: Math.round(box.left + Math.min(60, box.width / 2)), y: Math.round(box.top + box.height / 2) };`,
          [name],
        )
        .catch(() => false);
    },
    { timeoutMs },
  );
}

async function openFilesEntry(session, name, timeoutMs = FILES_PROBE_TIMEOUT_MS) {
  const row = await filesRowCoordinates(session, name, timeoutMs);
  await clickAt(session, row.x, row.y);
  try {
    await waitFor(
      `${name} game preview to load`,
      () =>
        session
          .execute(
            "return document.body.innerText.includes('verify:practice') && [...document.querySelectorAll('button')].some(button => button.textContent.trim() === 'Open game')",
          )
          .catch(() => false),
      { timeoutMs },
    );
  } catch (error) {
    const state = await session
      .execute(
        "return { path: location.pathname, text: document.body.innerText.slice(0, 1000), boards: document.querySelectorAll('cg-board').length }",
      )
      .catch(() => ({ path: "unavailable", text: "unavailable", boards: "unavailable" }));
    throw new Error(`${error.message}; renderer state: ${JSON.stringify(state)}`);
  }
  const openButton = await waitFor(
    `${name} FileCard open control`,
    () =>
      session
        .execute(
          `const button = [...document.querySelectorAll('button')].find(button => button.textContent.trim() === 'Open game');
           if (!button) return false;
           const box = button.getBoundingClientRect();
           return {
             x: Math.round(box.left + box.width / 2),
             y: Math.round(box.top + box.height / 2),
             disabled: button.disabled,
           };`,
        )
        .catch(() => false),
    { timeoutMs },
  );
  await clickAt(session, openButton.x, openButton.y);
  try {
    await waitFor(
      `${name} to open in the real renderer`,
      () =>
        session
          .execute(
            "return location.pathname === '/' && document.body.innerText.includes('Start Practice')",
          )
          .catch(() => false),
      { timeoutMs },
    );
  } catch (error) {
    const state = await session
      .execute("return { path: location.pathname, text: document.body.innerText.slice(0, 1000) }")
      .catch(() => ({ path: "unavailable", text: "unavailable" }));
    throw new Error(`${error.message}; renderer state: ${JSON.stringify(state)}`);
  }
}

// Game-opening staged-failure inventory (push-review-policy §2).
// All rows below are PENDING runtime staging by the adopting root. The unchanged verifier must
// print each exact message with FAIL and exit 1, then pass after the disposable input is restored.
// GO1: replace verify-game-opening.pgn in the disposable profile with a one-game PGN before import.
// GO2: remove DatabasesPage's sibling Open database control in a disposable build.
// GO3: keep that control visible but remove its navigate call in a disposable build.
// GO4: route GameTable single clicks through its opener in a disposable build.
// GO5: disconnect GameCard's OpenGameButton callback in a disposable build.
// GO6: remove GameTable customRowAttributes onDoubleClick in a disposable build.
// GO7: remove GameTable customRowAttributes onKeyDown in a disposable build.
// GO8: remove FileCard's OpenGameButton in a disposable build.
// GO9: remove FileCard's reserved preview Box or replace GameSelector's setPage with a no-op.
// GO10: disconnect FileCard's OpenGameButton callback in a disposable build.
// GO11: remove GameSelector's onDoubleClick handler in a disposable build.
// GO12: remove GameSelector's onKeyDown handler in a disposable build.
// GO13: remove FileCard's empty-file disabled predicate in a disposable build.
// Wiring breaks are confined to production source/binary inputs, never this verifier or its
// assertion definitions. GO1's fixture path is logged and only the harness's profile is edited.
async function verifyGameOpening(session) {
  const assertion = async (message, action) => {
    try {
      await action();
      check(true, message);
      return true;
    } catch (error) {
      check(false, message, error.message);
      return false;
    }
  };
  const wait = (label, script, args = []) =>
    waitFor(label, () => session.execute(script, args), { timeoutMs: FILES_PROBE_TIMEOUT_MS });
  const invoke = async (command, args) => {
    const result = await invokeJsonAndWait(
      session,
      command,
      "__verifyOpeningIPC",
      `window.__TAURI_INTERNALS__.invoke(${JSON.stringify(command)}, ${JSON.stringify(args)})`,
    );
    if (result.value === undefined)
      throw new Error(
        result.result.rejected ??
          result.result.error ??
          result.error ??
          `${command} returned no value`,
      );
    return result.value;
  };
  const coordinates = async (script, args = []) =>
    wait(
      "game-opening pointer target",
      `
    const element = (${script});
    if (!element) return false;
    element.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    const box = element.getBoundingClientRect();
    if (!box.width || !box.height) return false;
    return { x: Math.round(box.left + box.width / 2), y: Math.round(box.top + box.height / 2), disabled: element.disabled, selected: element.getAttribute('aria-selected') };
  `,
      args,
    );
  const button = (text) =>
    coordinates(
      `[...document.querySelectorAll('button')].find(node => node.textContent.trim() === arguments[0])`,
      [text],
    );
  const snapshot = async () => {
    const raw = await session.execute("return sessionStorage.getItem('workspace')");
    const workspace = raw && deserializeStorageValue(raw);
    if (!workspace) throw new Error("game-opening workspace snapshot is unreadable");
    return workspace;
  };
  const assertOpened = async (game, origin) => {
    await wait(
      "game-opening content and destination",
      `return location.pathname === '/' && document.body.innerText.replace(/\\s+/g, '').includes(arguments[0])`,
      [game.notation],
    );
    const workspace = await snapshot();
    const tab = workspace.tabs.find((entry) => entry.value === workspace.activeTab);
    if (
      !tab ||
      tab.name !== `${game.white} - ${game.black}` ||
      JSON.stringify(tab.gameOrigin) !== JSON.stringify(origin)
    ) {
      // File metadata contains extra fields. Identity is the handle and explicit index below.
      const actual = tab?.gameOrigin;
      const matches =
        origin.kind === "file" &&
        actual?.kind === "file" &&
        actual.gameNumber === origin.gameNumber &&
        actual.file.handle.id.id === origin.file.handle.id.id;
      if (!matches || tab.name !== `${game.white} - ${game.black}`)
        throw new Error(`wrong opened target: ${JSON.stringify(tab)}`);
    }
  };
  const saveSource = async (name) => {
    const path = `${screenshotPath ?? join(tmpdir(), `chessfable-game-opening-${process.pid}.png`)}.${name}.png`;
    await writeFile(path, Buffer.from(await session.screenshot(), "base64"));
    console.log(`  .. game-opening source screenshot: ${path}`);
  };
  let database;
  let file;
  let records;
  const seeded = await assertion(
    "GO1 game-opening fixtures contain two distinct native database and PGN games",
    async () => {
      const entries = await invoke("list_file_workspace", {
        workspace: { id: { id: filesWorkspaceId }, kind: "fileWorkspace" },
        ticket: null,
      });
      file = entries.find((entry) => entry.name === openingRowName)?.handle;
      if (!file) throw new Error("dedicated PGN fixture was not listed");
      const count = await invoke("count_pgn_games", { file, ticket: null });
      if (count !== 2) throw new Error(`dedicated PGN fixture has ${count} games`);
      const root = await invoke("get_database_workspace", {});
      database = await invoke("create_workspace_database", {
        root,
        filename: "verify-game-opening.db3",
      });
      await invoke("convert_pgn", {
        progressId: `verify-opening:${randomUUID()}`,
        files: [file],
        database,
        timestamp: null,
        title: openingDatabaseTitle,
        description: "Dedicated game-opening proof",
      });
      const response = await invoke("get_games", {
        file: database,
        query: {
          sides: "WhiteBlack",
          options: { page: 1, pageSize: 25, sort: "id", direction: "asc", skipCount: false },
        },
        ticket: null,
      });
      records = openingGames.map((game) =>
        response.data.find((record) => record.white === game.white && record.black === game.black),
      );
      if (response.count !== 2 || records.some((record) => !record))
        throw new Error(`database fixture mismatch: ${JSON.stringify(response)}`);
    },
  );
  const requireSeed = () => {
    if (!seeded) throw new Error("not attempted: GO1 fixture setup failed");
  };
  const overview = async () => {
    requireSeed();
    await session.execute(
      `const link = [...document.querySelectorAll('nav a')].find(node => node.getAttribute('href')?.startsWith('/databases')); if (!link) throw new Error('database navigation absent'); link.click(); return true;`,
    );
    await wait("database source route", "return location.pathname.startsWith('/databases')");
    if (await session.execute("return location.pathname !== '/databases'")) {
      const back = await button("Back");
      await clickAt(session, back.x, back.y);
    }
    await wait("database overview", "return location.pathname === '/databases'");
  };
  const databaseSurface = async () => {
    await overview();
    const open = await button("Open database");
    await clickAt(session, open.x, open.y);
    await wait("opened database route", "return location.pathname === arguments[0]", [
      `/databases/${database.id.id}`,
    ]);
  };
  const databaseRow = (game) =>
    coordinates(
      `[...document.querySelectorAll('tbody tr')].find(node => node.textContent.includes(arguments[0]))`,
      [game.white],
    );
  const filesSurface = async (name = openingRowName) => {
    requireSeed();
    const row = await filesRowCoordinates(session, name);
    await clickAt(session, row.x, row.y);
    await button("Open game");
  };
  const fileRow = (game) =>
    coordinates(
      `[...document.querySelectorAll('[role="option"]')].find(node => node.textContent.includes(arguments[0]))`,
      [game.white],
    );
  const enter = async (script, args) => {
    await wait(
      "game-opening row focus",
      `const row = (${script}); if (!row) return false; row.focus(); return document.activeElement === row;`,
      args,
    );
    await session.call("POST", "/actions", {
      actions: [
        {
          type: "key",
          id: "opening-keyboard",
          actions: [
            { type: "keyDown", value: "\uE007" },
            { type: "keyUp", value: "\uE007" },
          ],
        },
      ],
    });
  };
  await assertion(
    "GO2 the database card has a visible sibling Open database control before selection",
    async () => {
      await overview();
      await wait(
        "associated database opener",
        `const button = [...document.querySelectorAll('button')].find(node => node.textContent.trim() === 'Open database'); return button && !button.disabled && button.parentElement.textContent.includes(arguments[0]) && !button.parentElement.closest('button') && button.getBoundingClientRect().height > 0;`,
        [openingDatabaseTitle],
      );
      await saveSource("database-card");
    },
  );
  await assertion(
    "GO3 the labelled database control opens its handle route and synchronizes the database",
    async () => {
      await databaseSurface();
      await wait(
        "synchronized database heading",
        "return [...document.querySelectorAll('h1,h2,h3')].some(node => node.textContent === arguments[0])",
        [openingDatabaseTitle],
      );
    },
  );
  await assertion(
    "GO4 database single-click selects a preview without admitting a tab",
    async () => {
      await databaseSurface();
      const before = await snapshot();
      const row = await databaseRow(openingGames[1]);
      await clickAt(session, row.x, row.y);
      await wait(
        "database preview selection",
        "return [...document.querySelectorAll('tbody tr[aria-selected=\"true\"]')].some(node => node.textContent.includes(arguments[0]))",
        [openingGames[1].white],
      );
      if (
        JSON.stringify(await snapshot()) !== JSON.stringify(before) ||
        !(await session.execute("return location.pathname.startsWith('/databases/')"))
      )
        throw new Error("single click opened a tab");
    },
  );
  await assertion(
    "GO5 the labelled database game button opens the selected content and origin",
    async () => {
      await databaseSurface();
      const row = await databaseRow(openingGames[1]);
      await clickAt(session, row.x, row.y);
      const open = await button("Open game");
      if (open.disabled) throw new Error("database game button is disabled");
      await saveSource("database-game");
      await clickAt(session, open.x, open.y);
      await assertOpened(openingGames[1], { kind: "database", database, gameId: records[1].id });
    },
  );
  await assertion(
    "GO6 a fixed-coordinate double-click opens an initially unselected database game",
    async () => {
      await databaseSurface();
      const row = await databaseRow(openingGames[1]);
      if (row.selected !== "false")
        throw new Error("database double-click target was already selected");
      await doubleClickAt(session, row.x, row.y);
      await assertOpened(openingGames[1], { kind: "database", database, gameId: records[1].id });
    },
  );
  await assertion(
    "GO7 row-focused Enter opens the requested database game content and origin",
    async () => {
      await databaseSurface();
      await enter(
        `[...document.querySelectorAll('tbody tr')].find(node => node.textContent.includes(arguments[0]))`,
        [openingGames[0].white],
      );
      await assertOpened(openingGames[0], { kind: "database", database, gameId: records[0].id });
    },
  );
  await assertion("GO8 the Files preview has a visible enabled Open game control", async () => {
    await filesSurface();
    const open = await button("Open game");
    if (open.disabled) throw new Error("Files game button is disabled");
    await fileRow(openingGames[1]);
    await saveSource("file-game");
  });
  await assertion(
    "GO9 PGN single-click selects without opening and keeps row coordinates stationary",
    async () => {
      await filesSurface();
      const before = await snapshot();
      const row = await fileRow(openingGames[1]);
      await clickAt(session, row.x, row.y);
      await wait(
        "PGN preview selection",
        'return [...document.querySelectorAll(\'[role="option"][aria-selected="true"]\')].some(node => node.textContent.includes(arguments[0]))',
        [openingGames[1].white],
      );
      // Wait for the new preview's actual notation, so this covers completion as well as selection.
      await wait(
        "second PGN preview",
        "return document.body.innerText.replace(/\\s+/g, '').includes(arguments[0])",
        [openingGames[1].notation],
      );
      const after = await fileRow(openingGames[1]);
      if (
        JSON.stringify(await snapshot()) !== JSON.stringify(before) ||
        !(await session.execute("return location.pathname === '/files'")) ||
        row.x !== after.x ||
        row.y !== after.y
      )
        throw new Error(`selection moved or opened the list: ${JSON.stringify({ row, after })}`);
    },
  );
  await assertion(
    "GO10 the labelled Files game button opens the selected fresh game and explicit index",
    async () => {
      await filesSurface();
      const row = await fileRow(openingGames[1]);
      await clickAt(session, row.x, row.y);
      const open = await button("Open game");
      await clickAt(session, open.x, open.y);
      await assertOpened(openingGames[1], { kind: "file", file: { handle: file }, gameNumber: 1 });
    },
  );
  await assertion(
    "GO11 a fixed-coordinate double-click opens an initially unselected non-first PGN game",
    async () => {
      await filesSurface();
      const row = await fileRow(openingGames[1]);
      if (row.selected !== "false") throw new Error("PGN double-click target was already selected");
      await doubleClickAt(session, row.x, row.y);
      await assertOpened(openingGames[1], { kind: "file", file: { handle: file }, gameNumber: 1 });
    },
  );
  await assertion(
    "GO12 row-focused Enter opens the requested PGN game content and explicit index",
    async () => {
      await filesSurface();
      await enter(
        `[...document.querySelectorAll('[role="option"]')].find(node => node.textContent.includes(arguments[0]))`,
        [openingGames[1].white],
      );
      await assertOpened(openingGames[1], { kind: "file", file: { handle: file }, gameNumber: 1 });
    },
  );
  await assertion("GO13 an empty PGN exposes no working Open game action", async () => {
    await filesSurface(emptyOpeningRowName);
    const open = await button("Open game");
    if (!open.disabled) throw new Error("empty-file game opener is enabled");
  });
}

let cleanupSettled = false;
process.on("exit", () => {
  if (!cleanupSettled) console.error("cleanup did not finish before process exit");
});
let signalShutdown;
const handleSignal = () => {
  if (signalShutdown) return;
  signalShutdown = shutdown()
    .catch((error) => console.error(`cleanup failed: ${error.message}`))
    .finally(() => {
      cleanupSettled = true;
      process.exit(1);
    });
};
for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"]) process.on(signal, handleSignal);

async function verifyFullApplication(profileDirectory, appEnvironment) {
  const practiceGame = 0;
  const largePracticeId = "verify-practice-large-00000000-0000-4000-8000-000000000001";
  const legacyPracticeId = "verify-practice-legacy-00000000-0000-4000-8000-000000000002";
  const legacyPracticeKey = `deck-${legacyPracticeId}-${practiceGame}`;
  const largePracticeName = "verify-practice-large";
  const extendedPracticeTree = buildPracticeFixtureTree();
  const oraclePracticePositions = collectPracticePositions(extendedPracticeTree);
  const initialPracticeTree = clonePracticeFixtureTree(extendedPracticeTree);
  const initialPracticePositions = prunePracticeFixtureTree(initialPracticeTree, 12_000);
  const extendedPracticePositions = prunePracticeFixtureTree(extendedPracticeTree, 12_500);
  if (
    initialPracticePositions.length !== 12_000 ||
    extendedPracticePositions.length !== 12_500 ||
    JSON.stringify(initialPracticePositions) !==
      JSON.stringify(oraclePracticePositions.slice(0, 12_000)) ||
    JSON.stringify(extendedPracticePositions) !==
      JSON.stringify(oraclePracticePositions.slice(0, 12_500))
  ) {
    throw new Error(
      `practice fixture disagreed with its independent card oracle (${initialPracticePositions.length}/${extendedPracticePositions.length}; expected ${oraclePracticePositions.length})`,
    );
  }
  const legacyPracticePositions = practicePositionsDocument(initialPracticePositions.slice(0, 3));
  const legacyPracticeLogs = legacyPracticePositions.slice(0, 2).map((position, index) => ({
    ...position.card,
    fen: position.fen,
    rating: index + 3,
  }));
  const legacyPracticeDocument = JSON.stringify({
    positions: legacyPracticePositions,
    logs: legacyPracticeLogs,
  });
  // WebKit local storage belongs to the isolated profile, but it can only be initialized through
  // the real application origin. Seed valid durable image owners, close cleanly, and only then
  // install the registry fixture that the asserted startup must reconcile.
  const retainedImageId = "11111111-1111-4111-8111-111111111111";
  const retainedImageBase64 =
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
  const retiredImageId = "22222222-2222-4222-8222-222222222222";
  const orphanImageId = "33333333-3333-4333-8333-333333333333";
  const ownerEngine = (id, imageId) => ({
    type: "local",
    id,
    name: `Fixture ${id}`,
    version: "1",
    handle: { id: { id: `fixture-executable-${id}` }, kind: "engine" },
    filename: "fixture-engine",
    imageHandle: { id: { id: imageId }, kind: "engineImage" },
  });
  console.log("  .. opening seed WebDriver session");
  const seedSession = await Session.open(APP_BINARY);
  await waitFor("the seed renderer to expose Tauri", () =>
    seedSession.execute("return typeof window.__TAURI_INTERNALS__ === 'object'").catch(() => false),
  );
  // `file-workspace` owns the Files workspace entry through startup reconciliation.
  // Disable auto-save in this throwaway profile so the NAG edit proves SAVE_FILE wrote it.
  await seedSession.execute(
    `localStorage.setItem("engines", arguments[0]);
     localStorage.setItem("file-workspace", arguments[1]);
     localStorage.setItem("file-workspace-display-name", arguments[2]);
     localStorage.setItem("download-destination-capability", arguments[3]);
     localStorage.setItem("auto-save", "false");
     localStorage.setItem(arguments[4], arguments[5]);
     return true`,
    [
      JSON.stringify([
        ownerEngine("retained", retainedImageId),
        ownerEngine("retire-on-shutdown", retiredImageId),
      ]),
      JSON.stringify({ id: { id: filesWorkspaceId }, kind: "fileWorkspace" }),
      JSON.stringify("Files fixture"),
      JSON.stringify({ id: "verify-download-destination" }),
      legacyPracticeKey,
      legacyPracticeDocument,
    ],
  );
  const seedClose = await closeApplicationThroughTitlebar(seedSession, "seed");
  if (!seedClose.gone || seedClose.survivors.length > 0) {
    throw new Error(`seed processes survived close: ${seedClose.survivors.join(", ")}`);
  }
  const seedQuit = await seedSession.quit();
  if (!seedQuit.released) {
    console.log(`  .. seed WebDriver session release returned: ${seedQuit.error}`);
  }
  console.log("  .. seed app and WebKit processes are gone; reusing WebDriver after session quit");

  const fixtureDirectory = join(profileDirectory, "path-owner-fixture");
  const ownedRoot = join(fixtureDirectory, "owned-database-root");
  const downloadDestination = join(fixtureDirectory, "download-destination");
  const orphanFile = join(fixtureDirectory, "orphan-opening-book.bin");
  const imageDirectory = join(
    profileDirectory,
    ".local/share/com.chessriddle.encroissant/engine-images",
  );
  const retainedImage = join(imageDirectory, retainedImageId);
  const retiredImage = join(imageDirectory, retiredImageId);
  const orphanImage = join(imageDirectory, orphanImageId);
  const filesWorkspace = join(fixtureDirectory, "files-workspace");
  const practiceDirectory = join(
    profileDirectory,
    ".local/share/com.chessriddle.encroissant/practice",
  );
  const largePracticePath = join(filesWorkspace, `${largePracticeName}.pgn`);
  const largePracticeMetadataPath = join(filesWorkspace, `${largePracticeName}.info`);
  const legacyPracticePath = join(fixtureDirectory, "legacy-practice-repertoire.pgn");
  await mkdir(ownedRoot, { recursive: true });
  await mkdir(downloadDestination, { recursive: true });
  await mkdir(filesWorkspace, { recursive: true });
  await writeFile(join(filesWorkspace, `${filesRowName}.pgn`), filesGamePgn);
  await writeFile(join(filesWorkspace, `${openingRowName}.pgn`), openingPgn);
  console.log(
    `  .. game-opening disposable PGN input: ${join(filesWorkspace, `${openingRowName}.pgn`)}`,
  );
  await writeFile(join(filesWorkspace, `${emptyOpeningRowName}.pgn`), "");
  // Dedicated sidecar-less file: changing its type cannot alter another check's fixture.
  const filesMetadataPgnPath = join(filesWorkspace, `${filesMetadataRowName}.pgn`);
  const filesMetadataInfoPath = join(filesWorkspace, `${filesMetadataRowName}.info`);
  await writeFile(filesMetadataPgnPath, filesGamePgn);
  const nagsGamePath = join(filesWorkspace, `${nagsRowName}.pgn`);
  await writeFile(nagsGamePath, nagsGamePgn);
  const initialLargePracticePgn = practicePgn(initialPracticeTree);
  await writeFile(largePracticePath, initialLargePracticePgn);
  await writeFile(largePracticeMetadataPath, JSON.stringify({ type: "repertoire", tags: [] }));
  await writeFile(
    legacyPracticePath,
    `[Event "legacy practice fixture"]\n[Result "*"]\n\n1. e4 *\n`,
  );
  const seededLargePractice = await seedNativePracticeDeck(
    practiceDirectory,
    largePracticeId,
    practiceGame,
    initialPracticePositions,
    100_001,
  );
  const extendedLargePracticePgn = practicePgn(extendedPracticeTree);
  const rewrittenOnlyMoveSan = extendedPracticePositions
    .slice(initialPracticePositions.length)
    .map(({ answer }) => answer)
    .find(
      (san) => extendedLargePracticePgn.includes(san) && !initialLargePracticePgn.includes(san),
    );
  if (!rewrittenOnlyMoveSan) {
    throw new Error("the rewritten practice PGN has no move absent from its initial PGN");
  }
  const rewrittenOnlyMoveFigurine = rewrittenOnlyMoveSan.replace(
    /^[KQRBN]/,
    (piece) => ({ K: "♔", Q: "♕", R: "♖", B: "♗", N: "♘" })[piece],
  );
  const rewrittenOnlyMoveForms = [...new Set([rewrittenOnlyMoveSan, rewrittenOnlyMoveFigurine])];
  await mkdir(imageDirectory, { recursive: true });
  await writeFile(orphanFile, "do not delete registry fixture bytes");
  const retainedImageBytes = Buffer.from(retainedImageBase64, "base64");
  await writeFile(retainedImage, retainedImageBytes);
  await writeFile(retiredImage, "retired managed image bytes");
  await writeFile(orphanImage, "orphan managed image bytes");
  const registryFile = join(
    profileDirectory,
    ".config/com.chessriddle.encroissant/path-authority.json",
  );
  await mkdir(join(profileDirectory, ".config/com.chessriddle.encroissant"), { recursive: true });
  const storedEntry = async (id, displayName, nativePath, purpose, operations, targetIsDir) => {
    const metadata = await stat(nativePath, { bigint: true });
    return {
      id: { id },
      display_name: displayName,
      class: targetIsDir ? "persistentCustomRoot" : "persistentFile",
      operations,
      path: {
        platform: "unix",
        bytes: Buffer.from(nativePath).toString("base64").replace(/=+$/, ""),
      },
      identity: { a: Number(metadata.dev), b: Number(metadata.ino) },
      target_is_dir: targetIsDir,
      purpose,
    };
  };
  await writeFile(
    registryFile,
    JSON.stringify({
      schema_version: 1,
      entries: [
        await storedEntry(
          "verify-owned-root",
          "Owned fixture root",
          ownedRoot,
          "databaseRoot",
          ["databaseRead", "databaseMutate", "databaseCreate", "databaseExport", "downloadFile"],
          true,
        ),
        await storedEntry(
          "verify-download-destination",
          "Download destination fixture",
          downloadDestination,
          "downloadDestination",
          ["downloadFile"],
          true,
        ),
        await storedEntry(
          "verify-unowned-book",
          "Unowned fixture book",
          orphanFile,
          "openingBook",
          ["openingBookRead"],
          false,
        ),
        await storedEntry(
          retainedImageId,
          "Retained engine image",
          retainedImage,
          "engineImage",
          ["imageRead"],
          false,
        ),
        await storedEntry(
          retiredImageId,
          "Shutdown engine image",
          retiredImage,
          "engineImage",
          ["imageRead"],
          false,
        ),
        await storedEntry(
          orphanImageId,
          "Orphan engine image",
          orphanImage,
          "engineImage",
          ["imageRead"],
          false,
        ),
        await storedEntry(
          filesWorkspaceId,
          "Files fixture",
          filesWorkspace,
          "pgnWorkspace",
          ["readPgn", "writePgn"],
          true,
        ),
        await storedEntry(
          largePracticeId,
          "Large practice fixture",
          largePracticePath,
          "pgnFile",
          ["readPgn", "writePgn"],
          false,
        ),
        await storedEntry(
          legacyPracticeId,
          "Legacy practice fixture",
          legacyPracticePath,
          "pgnReadOnlyFile",
          ["readPgn"],
          false,
        ),
      ],
      active_database_root: { id: "verify-owned-root" },
      active_puzzle_root: null,
      active_engine_root: null,
      pending_artifacts: [],
      provisional_attachments: [],
      image_cleanup: [],
    }),
  );
  await rm(downloadDestination, { recursive: true, force: true });
  const logFile = join(
    profileDirectory,
    ".local/share/com.chessriddle.encroissant/logs/en-croissant.log",
  );
  const assertedLogStart = existsSync(logFile) ? (await stat(logFile)).size : 0;
  const readLog = () =>
    readFile(logFile)
      .then((bytes) => bytes.subarray(assertedLogStart).toString("utf8"))
      .catch(() => "");

  console.log("  .. opening assertion WebDriver session with the preserved profile");
  let session;
  try {
    session = await Session.open(APP_BINARY);
  } catch (error) {
    console.error(`  .. assertion WebDriver session failed: ${error.message}`);
    console.error(`  .. tauri-driver output:\n${driverDiagnostics() || "(empty)"}`);
    const startupLog = await readLog();
    console.error(`  .. preserved-profile application log:\n${startupLog || "(empty)"}`);
    throw error;
  }
  const reconciledRegistry = await waitFor(
    "production startup to reconcile the seeded path registry",
    async () => {
      const registry = JSON.parse(await readFile(registryFile, "utf8"));
      return registry.entries.some(
        ({ id }) => id.id === "verify-unowned-book" || id.id === orphanImageId,
      ) || registry.image_cleanup?.some(({ id }) => id.id === orphanImageId)
        ? false
        : registry;
    },
    { timeoutMs: IPC_PROBE_TIMEOUT_MS },
  );
  check(
    reconciledRegistry.entries.some(({ id }) => id.id === "verify-owned-root") &&
      !reconciledRegistry.entries.some(({ id }) => id.id === "verify-unowned-book"),
    "production startup reclaims unowned authority and preserves native-owned authority",
  );
  check(
    existsSync(ownedRoot) && existsSync(orphanFile),
    "startup authority reconciliation deletes no user files",
  );
  check(
    reconciledRegistry.entries.some(({ id }) => id.id === retainedImageId) &&
      reconciledRegistry.entries.some(({ id }) => id.id === retiredImageId) &&
      !reconciledRegistry.entries.some(({ id }) => id.id === orphanImageId) &&
      existsSync(retainedImage) &&
      existsSync(retiredImage) &&
      !existsSync(orphanImage),
    "trusted production startup preserves owned images and cleans only the orphan",
  );
  const closeControl = await waitFor("the renderer to mount its window controls", async () =>
    session.execute(closeControlProbe).catch(() => false),
  ).catch((error) => {
    throw new Error(
      "could not find the close control: expected the translated label or the last button " +
        `in the window-controls group (${error.message})`,
    );
  });

  check(
    (await session.execute("return typeof window.__TAURI_INTERNALS__")) === "object",
    "the real Tauri IPC bridge is present (not a test mock)",
  );
  check(
    (await session.execute("return document.title")) === "ChessFable",
    "the real renderer exposes the ChessFable document title",
  );
  await verifyProgressContract(session);

  const waitForPracticeOwners = async (label) =>
    waitFor(
      label,
      async () => {
        const registry = JSON.parse(await readFile(registryFile, "utf8"));
        return registry.entries.some(({ id }) => id.id === largePracticeId) &&
          registry.entries.some(({ id }) => id.id === legacyPracticeId)
          ? registry
          : false;
      },
      { timeoutMs: IPC_PROBE_TIMEOUT_MS },
    );
  const armStartupReconciliationProbe = async () => {
    const registry = JSON.parse(await readFile(registryFile, "utf8"));
    const probeId = "verify-unowned-book";
    registry.entries = registry.entries.filter(({ id }) => id.id !== probeId);
    registry.entries.push(
      await storedEntry(
        probeId,
        "Startup reconciliation probe",
        orphanFile,
        "openingBook",
        ["openingBookRead"],
        false,
      ),
    );
    await writeFile(registryFile, JSON.stringify(registry));
  };
  const waitForCurrentStartupReconciliation = async (label) =>
    waitFor(
      label,
      async () => {
        const registry = JSON.parse(await readFile(registryFile, "utf8"));
        return registry.entries.some(({ id }) => id.id === "verify-unowned-book")
          ? false
          : registry;
      },
      { timeoutMs: IPC_PROBE_TIMEOUT_MS },
    );
  const reopenAssertionSession = async (label) => {
    const closed = await closeApplicationThroughTitlebar(session, label);
    if (!closed.gone || closed.survivors.length > 0) {
      throw new Error(`${label} processes survived close: ${closed.survivors.join(", ")}`);
    }
    await session.quit().catch(() => undefined);
    await armStartupReconciliationProbe();
    session = await Session.open(APP_BINARY);
    const reconciledRegistry = await waitForCurrentStartupReconciliation(
      `${label} startup reconciliation to remove the freshly seeded probe`,
    );
    await waitFor(`${label} renderer to expose Tauri`, () =>
      session.execute("return typeof window.__TAURI_INTERNALS__ === 'object'").catch(() => false),
    );
    // The renderer's workspace initialization and practice migration must settle before a step
    // closes or opens tabs; the probe above proves only that native reconciliation ran.
    await waitForPracticeOwners(`${label} startup to retain practice capabilities`);
    return reconciledRegistry;
  };

  const largeDeckSnapshot = await loadPracticeDeckThroughIpc(
    session,
    largePracticeId,
    practiceGame,
    "__verifyAppLargeDeckSnapshot",
  );
  const largePositions = practicePositionsFromSnapshot(largeDeckSnapshot.value);
  check(
    largeDeckSnapshot.result.rejected === undefined &&
      Array.isArray(largePositions) &&
      largePositions.length === initialPracticePositions.length,
    "the native practice read returns all 12,000 seeded positions",
    largeDeckSnapshot.result.rejected ?? largeDeckSnapshot.error,
  );
  const largeReviewPage = await loadAllPracticeReviews(
    session,
    largePracticeId,
    practiceGame,
    "__verifyAppLargeReviews",
  );
  const oldestFirstReviewIds = [...largeReviewPage.ids].reverse();
  check(
    largeReviewPage.complete &&
      oldestFirstReviewIds.length === seededLargePractice.reviewIds.length &&
      oldestFirstReviewIds.every((id, index) => id === seededLargePractice.reviewIds[index]) &&
      largeReviewPage.ids.at(-1) === seededLargePractice.reviewIds[0],
    "native practice review paging returns every seeded entry and reaches the oldest review",
    largeReviewPage.error,
  );

  const migratedDeckSnapshot = await loadPracticeDeckThroughIpc(
    session,
    legacyPracticeId,
    practiceGame,
    "__verifyAppMigratedDeckSnapshot",
  );
  const migratedPositions = practicePositionsFromSnapshot(migratedDeckSnapshot.value);
  const migratedReviews = await loadAllPracticeReviews(
    session,
    legacyPracticeId,
    practiceGame,
    "__verifyAppMigratedReviews",
  );
  check(
    migratedDeckSnapshot.result.rejected === undefined &&
      migratedDeckSnapshot.value?.migrated === true &&
      migratedPositions?.length === legacyPracticePositions.length &&
      migratedReviews.complete &&
      migratedReviews.ids.length === legacyPracticeLogs.length,
    "the legacy practice deck is migrated into the native store through real IPC",
    migratedDeckSnapshot.result.rejected ?? migratedDeckSnapshot.error ?? migratedReviews.error,
  );
  const migratedRegistry = await waitForPracticeOwners("migrated practice capabilities");
  check(
    migratedRegistry.entries.some(({ id }) => id.id === legacyPracticeId),
    "migration retains the legacy deck capability in path-authority.json",
  );
  const legacyValueBeforeWriter = await session.execute(
    "return localStorage.getItem(arguments[0])",
    [legacyPracticeKey],
  );
  check(
    legacyValueBeforeWriter === legacyPracticeDocument,
    "migration leaves the legacy practice localStorage key untouched",
  );

  let ratingIndex = -1;
  let practiceStage = "open the large practice file";
  try {
    await openFilesEntry(session, largePracticeName, PRACTICE_RENDERER_TIMEOUT_MS);
    const firstFiftyPracticePositions = initialPracticePositions.slice(0, 50);
    await waitFor(
      "the large practice deck to hydrate before UI writing",
      () =>
        session
          .execute(
            "return document.body.innerText.includes('Start Practice') && !document.body.innerText.includes('Loading')",
          )
          .catch(() => false),
      { timeoutMs: PRACTICE_RENDERER_TIMEOUT_MS },
    );
    const startPracticeButton = await waitFor(
      "the rendered normal practice button",
      () =>
        session
          .execute(
            `const button = [...document.querySelectorAll('button')].find((candidate) =>
             candidate.textContent?.includes('Start Practice')
           );
           if (!button) return false;
           const box = button.getBoundingClientRect();
           return {
             x: Math.round(box.left + box.width / 2),
             y: Math.round(box.top + box.height / 2),
             disabled: button.disabled,
           };`,
          )
          .catch(() => false),
      { timeoutMs: PRACTICE_RENDERER_TIMEOUT_MS },
    );
    if (startPracticeButton.disabled) {
      const state = await session
        .execute("return { path: location.pathname, text: document.body.innerText.slice(0, 2000) }")
        .catch(() => ({ path: "unavailable", text: "unavailable" }));
      throw new Error(`normal practice remains disabled: ${JSON.stringify(state)}`);
    }
    practiceStage = "start practice";
    await clickAt(session, startPracticeButton.x, startPracticeButton.y, "practice-start");
    try {
      await waitFor(
        "the practice panel to enter its first move",
        () =>
          session
            .execute("return document.body.innerText.includes('Make your move')")
            .catch(() => false),
        { timeoutMs: PRACTICE_RENDERER_TIMEOUT_MS },
      );
    } catch (error) {
      const state = await session
        .execute(
          "return { path: location.pathname, text: document.body.innerText.slice(0, 2000), buttons: [...document.querySelectorAll('button')].map((button) => ({ text: button.textContent, disabled: button.disabled })).slice(-8) }",
        )
        .catch(() => ({ path: "unavailable", text: "unavailable", buttons: [] }));
      throw new Error(`${error.message}; practice state: ${JSON.stringify(state)}`);
    }
    for (const [index, position] of firstFiftyPracticePositions.entries()) {
      ratingIndex = index;
      practiceStage = "rate practice cards";
      const move = position.uci;
      const pointer = await session.execute(
        `const board = document.querySelector('cg-board');
       if (!board) return false;
       const box = board.getBoundingClientRect();
       const square = (name) => ({
         x: Math.round(box.left + (name.charCodeAt(0) - 96.5) * box.width / 8),
         y: Math.round(box.top + (8.5 - Number(name[1])) * box.height / 8),
       });
       return { from: square(arguments[0].slice(0, 2)), to: square(arguments[0].slice(2, 4)) };`,
        [move],
      );
      if (!pointer) throw new Error(`practice board was not available for rating ${index + 1}`);
      await session.call("POST", "/actions", {
        actions: [
          {
            type: "pointer",
            id: `practice-rating-${index}`,
            parameters: { pointerType: "mouse" },
            actions: [
              {
                type: "pointerMove",
                duration: 0,
                x: pointer.from.x,
                y: pointer.from.y,
                origin: "viewport",
              },
              { type: "pointerDown", button: 0 },
              { type: "pointerUp", button: 0 },
              { type: "pause", duration: PRACTICE_MOVE_CLICK_DELAY_MS },
              {
                type: "pointerMove",
                duration: 0,
                x: pointer.to.x,
                y: pointer.to.y,
                origin: "viewport",
              },
              { type: "pointerDown", button: 0 },
              { type: "pointerUp", button: 0 },
            ],
          },
        ],
      });
      const moveResult = await waitFor(`practice move ${index + 1} to resolve`, () =>
        session
          .execute(
            `const text = document.body.innerText;
           if (text.includes("How difficult was this?")) return "correct";
           if (text.includes("The correct move was")) return "incorrect";
           return false;`,
          )
          .catch(() => false),
      ).catch(async (error) => {
        const state = await session
          .execute(
            "return { path: location.pathname, text: document.body.innerText.slice(0, 1800), board: (() => { const e = document.querySelector('cg-board'); if (!e) return null; const r = e.getBoundingClientRect(); return { left: r.left, top: r.top, width: r.width, height: r.height }; })() }",
          )
          .catch(() => ({ path: "unavailable", text: "unavailable", board: null }));
        throw new Error(`${error.message}; move ${move}; practice state: ${JSON.stringify(state)}`);
      });
      if (moveResult === "correct") {
        await session.execute(
          "document.dispatchEvent(new KeyboardEvent('keydown', { key: '3', bubbles: true })); return true",
        );
      }
      await waitFor(`practice rating ${index + 1} to advance`, () =>
        session
          .execute(
            `const text = document.body.innerText;
           return text.includes("Make your move") && !text.includes("The correct move was");`,
          )
          .catch(() => false),
      );
    }
  } catch (error) {
    // A WebDriver request aborts when the renderer does not answer within the driver's fetch
    // timeout; wait for it to answer again so the failure carries what the page was doing.
    const recovered = await waitFor(
      "the renderer to answer again after the practice-step failure",
      () => session.execute("return true").catch(() => false),
      { timeoutMs: RENDERER_RECOVERY_TIMEOUT_MS },
    ).catch(() => false);
    const state = recovered
      ? await session
          .execute(
            `return {
               path: location.pathname,
               gates: [...document.querySelectorAll("[data-file-freshness]")].map((gate) =>
                 gate.getAttribute("data-file-freshness"),
               ),
               text: document.body.innerText.slice(0, 1500),
             };`,
          )
          .catch(() => "unavailable")
      : `renderer did not answer within ${RENDERER_RECOVERY_TIMEOUT_MS / 1000} s`;
    throw new Error(
      `${error.message}; stage: ${practiceStage}${ratingIndex >= 0 ? ` (rating ${ratingIndex + 1})` : ""}; renderer state: ${JSON.stringify(state)}`,
    );
  }
  const writerSnapshot = await loadPracticeDeckThroughIpc(
    session,
    largePracticeId,
    practiceGame,
    "__verifyAppWriterSnapshot",
  );
  const writerPositions = practicePositionsFromSnapshot(writerSnapshot.value);
  const writerReviews = await loadAllPracticeReviews(
    session,
    largePracticeId,
    practiceGame,
    "__verifyAppWriterReviews",
  );
  const deckKeysAfterWriter = await session.execute(
    "return Object.keys(localStorage).filter((key) => key.startsWith('deck-')).sort()",
  );
  const legacyValueAfterWriter = await session.execute(
    "return localStorage.getItem(arguments[0])",
    [legacyPracticeKey],
  );
  const seededReviewIds = new Set(seededLargePractice.reviewIds);
  const writerNewReviews = writerReviews.entries.filter(({ id }) => !seededReviewIds.has(id));
  const writerNewRatings = writerNewReviews.map(({ entry }) => {
    try {
      return JSON.parse(entry).rating;
    } catch {
      return undefined;
    }
  });
  check(
    writerReviews.complete &&
      writerReviews.ids.length === seededLargePractice.reviewIds.length + 50,
    "fifty renderer ratings land in the native practice review store",
    writerReviews.error,
  );
  check(
    writerSnapshot.result.rejected === undefined && writerPositions?.length === 12_000,
    "renderer ratings do not alter the large deck's 12,000 native positions",
    writerSnapshot.result.rejected ?? writerSnapshot.error,
  );
  check(
    writerNewRatings.length === 50 && writerNewRatings.every((rating) => rating === 3),
    "the 50 new native reviews record the panel's Good rating",
    `ratings: ${JSON.stringify(writerNewRatings)}`,
  );
  check(
    deckKeysAfterWriter.length === 1 &&
      deckKeysAfterWriter[0] === legacyPracticeKey &&
      legacyValueAfterWriter === legacyPracticeDocument,
    "renderer ratings create no new legacy key and do not grow the existing key",
    deckKeysAfterWriter.join(", "),
  );

  await session.execute("localStorage.removeItem(arguments[0]); return true", [legacyPracticeKey]);
  const retentionStartupRegistry = await reopenAssertionSession("legacy-key removal");
  check(
    (await session.execute("return localStorage.getItem(arguments[0])", [legacyPracticeKey])) ===
      null && retentionStartupRegistry.entries.some(({ id }) => id.id === legacyPracticeId),
    "list_practice_decks retains the legacy capability after its browser key is removed and fresh startup reconciliation",
  );

  await reopenAssertionSession("large-deck extension");
  await openFilesEntry(session, largePracticeName, PRACTICE_RENDERER_TIMEOUT_MS);
  const readOpenPracticeFreshness = () =>
    session
      .execute(
        `const tab = [...document.querySelectorAll('[role="tab"]')].find((candidate) =>
           candidate.textContent?.includes("verify:practice")
         );
         const panelId = tab?.getAttribute("aria-controls");
         const panel = panelId ? document.getElementById(panelId) : null;
         const gate = panel?.querySelector("[data-file-freshness]");
         if (!gate) return false;
         const [state, countText] = (gate.getAttribute("data-file-freshness") || "").split(":");
         const reloadCount = Number(countText);
         return Number.isInteger(reloadCount) ? { state, reloadCount } : false;`,
      )
      .catch(() => false);
  let openFreshnessBeforeWrite;
  try {
    openFreshnessBeforeWrite = await waitFor(
      "the open file-backed tab to verify before the external PGN write",
      async () => {
        const freshness = await readOpenPracticeFreshness();
        return freshness && freshness.state === "verified" ? freshness : false;
      },
      { timeoutMs: PRACTICE_RENDERER_TIMEOUT_MS },
    );
  } catch (error) {
    const state = await session
      .execute(
        `return {
           path: location.pathname,
           tabs: [...document.querySelectorAll('[role="tab"]')].map((tab) => ({
             text: tab.textContent,
             selected: tab.getAttribute("aria-selected"),
             controls: tab.getAttribute("aria-controls"),
           })),
           gates: [...document.querySelectorAll("[data-file-freshness]")].map((gate) =>
             gate.getAttribute("data-file-freshness"),
           ),
           text: document.body.innerText.slice(0, 1200),
         };`,
      )
      .catch(() => "unavailable");
    throw new Error(`${error.message}; renderer state: ${JSON.stringify(state)}`);
  }
  const measurementReady = await session.execute(
    `const baselineReloadCount = arguments[0];
     const tab = [...document.querySelectorAll('[role="tab"]')].find((candidate) =>
       candidate.textContent?.includes("verify:practice")
     );
     const panelId = tab?.getAttribute("aria-controls");
     const panel = panelId ? document.getElementById(panelId) : null;
     const gate = panel?.querySelector("[data-file-freshness]");
     if (!gate) return false;
     const state = {
       startedAt: performance.now(),
       baselineReloadCount,
       readDurations: [],
       lastReadFinishedAt: null,
       fileId: null,
       terminal: null,
     };
     // The sealed IPC invoke cannot be wrapped, so the platform records this read.
     window.__verifyAppRecordReadGame = (durationMs, fileId) => {
       if (state.terminal) return;
       if (state.fileId == null) state.fileId = fileId ?? null;
       if (fileId !== state.fileId) return;
       state.readDurations.push(durationMs);
       state.lastReadFinishedAt = performance.now();
     };
     const observeFreshness = () => {
       const [freshnessState, countText] = (gate.getAttribute("data-file-freshness") || "").split(":");
       const reloadCount = Number(countText);
       if (
         !state.terminal &&
         (freshnessState === "conflict" ||
           freshnessState === "unavailable" ||
           (freshnessState === "verified" && reloadCount > baselineReloadCount))
       ) {
         state.terminal = {
           state: freshnessState,
           reloadCount,
           observedAt: performance.now(),
           readFinishedAt: state.lastReadFinishedAt,
         };
       }
     };
     state.observer = new MutationObserver(observeFreshness);
     state.observer.observe(gate, { attributes: true, attributeFilter: ["data-file-freshness"] });
     window.__verifyAppFileFreshnessMeasurement = state;
     return { startedAt: state.startedAt };`,
    [openFreshnessBeforeWrite.reloadCount],
  );
  if (!measurementReady) throw new Error("could not arm the open tab freshness measurement");
  const inodeBeforeRewrite = (await stat(largePracticePath)).ino;
  const writeStartedAt = performance.now();
  await writeFile(largePracticePath, extendedLargePracticePgn);
  const rewriteDurationMs = performance.now() - writeStartedAt;
  const inodeAfterRewrite = (await stat(largePracticePath)).ino;
  check(
    inodeAfterRewrite === inodeBeforeRewrite,
    "the stale-file scenario rewrites the PGN in place",
    `inode changed from ${inodeBeforeRewrite} to ${inodeAfterRewrite}`,
  );
  const freshnessTransition = await waitFor(
    "the open tab to reload the external PGN or show its conflict panel",
    () =>
      session
        .execute("return window.__verifyAppFileFreshnessMeasurement?.terminal || false")
        .catch(() => false),
    { timeoutMs: 10_000, everyMs: 50 },
  );
  const freshnessMeasurement = await session.execute(
    `const measurement = window.__verifyAppFileFreshnessMeasurement;
     return {
       readTimeMs: measurement.readDurations.at(-1) ?? null,
       state: measurement.terminal?.state ?? null,
       reloadCount: measurement.terminal?.reloadCount ?? null,
       observedAt: measurement.terminal?.observedAt ?? null,
       readFinishedAt: measurement.terminal?.readFinishedAt ?? null,
     };`,
  );
  await session.execute(
    "const measurement = window.__verifyAppFileFreshnessMeasurement; measurement.observer?.disconnect(); delete window.__verifyAppRecordReadGame; measurement.observer = null; return true;",
  );
  const freshnessElapsedMs =
    freshnessMeasurement.observedAt - measurementReady.startedAt - rewriteDurationMs;
  const measuredReadTimeMs = freshnessMeasurement.readTimeMs;
  const freshnessApplyMs =
    Number.isFinite(freshnessMeasurement.observedAt) &&
    Number.isFinite(freshnessMeasurement.readFinishedAt)
      ? freshnessMeasurement.observedAt - freshnessMeasurement.readFinishedAt
      : Number.NaN;
  const freshnessDeadlineMs =
    Number.isFinite(measuredReadTimeMs) && Number.isFinite(freshnessApplyMs)
      ? FILE_FRESHNESS_POLL_INTERVAL_MS + measuredReadTimeMs + freshnessApplyMs
      : Number.NaN;
  const openTabReloaded =
    freshnessTransition.state === "conflict" ||
    (freshnessTransition.state === "verified" &&
      freshnessTransition.reloadCount > openFreshnessBeforeWrite.reloadCount);
  check(
    openTabReloaded,
    "the open file-backed tab reloads or withholds the changed PGN",
    `freshness state: ${freshnessTransition.state}`,
  );
  check(
    Number.isFinite(measuredReadTimeMs) && measuredReadTimeMs >= 0,
    "the file freshness transition includes a measured native read_game call",
    `read_game duration: ${measuredReadTimeMs}`,
  );
  check(
    Number.isFinite(measuredReadTimeMs) &&
      Number.isFinite(freshnessApplyMs) &&
      freshnessApplyMs >= 0 &&
      freshnessApplyMs <= FILE_FRESHNESS_APPLY_BUDGET_MS,
    `the freshness transition applies within ${FILE_FRESHNESS_APPLY_BUDGET_MS} ms of the measured read`,
    `apply duration: ${Number.isFinite(freshnessApplyMs) ? `${freshnessApplyMs.toFixed(1)} ms` : "unmeasured"}; ` +
      `read_game duration: ${Number.isFinite(measuredReadTimeMs) ? `${measuredReadTimeMs.toFixed(1)} ms` : "unmeasured"}`,
  );
  console.log(
    `  info  open file freshness: ${freshnessElapsedMs.toFixed(1)} ms after rewrite ` +
      `(limit ${FILE_FRESHNESS_POLL_INTERVAL_MS} ms + read_game ${Number.isFinite(measuredReadTimeMs) ? measuredReadTimeMs.toFixed(1) : "unmeasured"} ms + apply ${Number.isFinite(freshnessApplyMs) ? freshnessApplyMs.toFixed(1) : "unmeasured"} ms; ${freshnessTransition.state})`,
  );
  check(
    Number.isFinite(freshnessElapsedMs) && freshnessElapsedMs <= freshnessDeadlineMs,
    "the open file-backed tab refreshes within one poll interval plus measured read and apply",
    `${freshnessElapsedMs.toFixed(1)} ms > ${Number.isFinite(freshnessDeadlineMs) ? `${freshnessDeadlineMs.toFixed(1)} ms` : "unmeasured deadline"}`,
  );
  if (freshnessTransition.state === "conflict") {
    const reloadButton = await waitFor("the open file freshness conflict panel reload button", () =>
      session
        .execute(
          `const button = [...document.querySelectorAll("button")].find((candidate) =>
               candidate.textContent?.trim() === "Reload from disk"
             );
             if (!button) return false;
             const box = button.getBoundingClientRect();
             return { x: Math.round(box.left + box.width / 2), y: Math.round(box.top + box.height / 2) };`,
        )
        .catch(() => false),
    );
    await clickAt(session, reloadButton.x, reloadButton.y, "reload-open-file-tab");
    let reloadWaitError;
    await waitFor(
      "the open file-backed tab to verify after Reload from disk",
      async () => {
        const freshness = await readOpenPracticeFreshness();
        return freshness &&
          freshness.state === "verified" &&
          freshness.reloadCount > freshnessTransition.reloadCount
          ? freshness
          : false;
      },
      { timeoutMs: PRACTICE_RENDERER_TIMEOUT_MS },
    ).catch((error) => {
      reloadWaitError = error.message;
    });
    const reloadedFreshness = await readOpenPracticeFreshness();
    const rewrittenOnlyMoveVisible = await session
      .execute(
        `const pageText = document.body.innerText.replace(/\\s+/g, "");
         return arguments[0].some((move) => pageText.includes(move));`,
        [rewrittenOnlyMoveForms],
      )
      .catch(() => false);
    const reloadCheckPassed =
      reloadedFreshness?.state === "verified" &&
      reloadedFreshness.reloadCount > freshnessTransition.reloadCount &&
      rewrittenOnlyMoveVisible;
    check(
      reloadCheckPassed,
      "Reload from disk verifies the tab and shows a move unique to the rewritten PGN",
      `wait: ${reloadWaitError ?? "verified"}; freshness: ${reloadedFreshness?.state ?? "unavailable"}:${reloadedFreshness?.reloadCount ?? "unavailable"} (expected count > ${freshnessTransition.reloadCount}); ${rewrittenOnlyMoveSan}/${rewrittenOnlyMoveFigurine} visible: ${rewrittenOnlyMoveVisible}`,
    );
  }
  let syncWaitError;
  try {
    await waitFor(
      "the real sync path to add 500 large-deck positions",
      async () => {
        const loaded = await loadPracticeDeckThroughIpc(
          session,
          largePracticeId,
          practiceGame,
          "__verifyAppExtendedDeckSnapshot",
        );
        return practicePositionsFromSnapshot(loaded.value)?.length === 12_500;
      },
      { timeoutMs: PRACTICE_RENDERER_TIMEOUT_MS },
    );
  } catch (error) {
    const state = await session
      .execute(
        "return { path: location.pathname, text: document.body.innerText.slice(0, 2200), sync: [...document.querySelectorAll('[title]')].map((element) => ({ title: element.getAttribute('title'), text: element.textContent })).filter(({ title }) => title?.toLowerCase().includes('sync')) }",
      )
      .catch(() => ({ path: "unavailable", text: "unavailable", sync: [] }));
    syncWaitError = `${error.message}; extended sync state: ${JSON.stringify(state)}`;
  }
  const extendedSnapshot = await loadPracticeDeckThroughIpc(
    session,
    largePracticeId,
    practiceGame,
    "__verifyAppExtendedDeckSnapshotFinal",
  );
  const extendedPositions = practicePositionsFromSnapshot(extendedSnapshot.value);
  check(
    syncWaitError === undefined &&
      extendedSnapshot.result.rejected === undefined &&
      practiceCardsMatch(extendedPositions, extendedPracticePositions),
    "the real sync path stores 500 further repertoire positions",
    syncWaitError ?? extendedSnapshot.result.rejected ?? extendedSnapshot.error,
  );

  await reopenAssertionSession("final practice retention");
  const finalLargeSnapshot = await loadPracticeDeckThroughIpc(
    session,
    largePracticeId,
    practiceGame,
    "__verifyAppFinalLargeSnapshot",
  );
  const finalLegacySnapshot = await loadPracticeDeckThroughIpc(
    session,
    legacyPracticeId,
    practiceGame,
    "__verifyAppFinalLegacySnapshot",
  );
  const finalLargeReviews = await loadAllPracticeReviews(
    session,
    largePracticeId,
    practiceGame,
    "__verifyAppFinalLargeReviews",
  );
  const finalLegacyReviews = await loadAllPracticeReviews(
    session,
    legacyPracticeId,
    practiceGame,
    "__verifyAppFinalLegacyReviews",
  );
  const finalInventory = await invokeJsonAndWait(
    session,
    "list_practice_decks final inventory to settle",
    "__verifyAppFinalPracticeInventory",
    `window.__TAURI_INTERNALS__.invoke("list_practice_decks")`,
  );
  const finalLargePositions = practicePositionsFromSnapshot(finalLargeSnapshot.value);
  const finalLegacyPositionCount = practicePositionsFromSnapshot(finalLegacySnapshot.value)?.length;
  check(
    practiceCardsMatch(finalLargePositions, extendedPracticePositions) &&
      finalLargeReviews.ids.length === seededLargePractice.reviewIds.length + 50 &&
      finalLargeReviews.complete &&
      finalLegacyPositionCount === legacyPracticePositions.length &&
      finalLegacyReviews.complete &&
      finalLegacyReviews.ids.length === legacyPracticeLogs.length,
    "final restart preserves exact native position and review counts for both decks",
    finalLargeSnapshot.result.rejected ?? finalLegacySnapshot.result.rejected,
  );
  check(
    finalInventory.value?.anomalies?.length === 0 &&
      finalInventory.value?.decks?.length === 2 &&
      finalInventory.value.decks.some(
        ({ fileId, game }) => fileId === largePracticeId && game === practiceGame,
      ) &&
      finalInventory.value.decks.some(
        ({ fileId, game }) => fileId === legacyPracticeId && game === practiceGame,
      ),
    "final practice inventory contains no additional native deck",
    finalInventory.result.rejected ?? finalInventory.error,
  );
  check(
    finalLegacyPositionCount === legacyPracticePositions.length &&
      finalLegacyReviews.ids.length === legacyPracticeLogs.length,
    "final migrated-deck counts still equal the legacy value's counts",
  );

  const persistedDownloadDestination = await session.execute(`
    const serialized = localStorage.getItem("download-destination-capability");
    return serialized === null ? null : JSON.parse(serialized);
  `);
  const knownDownloadDestinationResult = await invokeAndWait(
    session,
    "download_destination_is_known for the persisted destination to settle",
    "__verifyAppKnownDownloadDestination",
    `window.__TAURI_INTERNALS__.invoke("download_destination_is_known", {
      destination: ${JSON.stringify(persistedDownloadDestination)},
    })`,
  );
  check(
    knownDownloadDestinationResult.value === "true",
    "real IPC preserves the persisted offline download destination",
    knownDownloadDestinationResult.rejected ??
      knownDownloadDestinationResult.error ??
      knownDownloadDestinationResult.value,
  );

  const freshDownloadDestination = { id: randomUUID() };
  const freshDownloadDestinationResult = await invokeAndWait(
    session,
    "download_destination_is_known for a fresh destination to settle",
    "__verifyAppFreshDownloadDestination",
    `window.__TAURI_INTERNALS__.invoke("download_destination_is_known", {
      destination: ${JSON.stringify(freshDownloadDestination)},
    })`,
  );
  check(
    freshDownloadDestinationResult.value === "false",
    "real IPC rejects a fresh download destination id",
    freshDownloadDestinationResult.rejected ??
      freshDownloadDestinationResult.error ??
      freshDownloadDestinationResult.value,
  );

  const databaseRootDestination = { id: "verify-owned-root" };
  const databaseRootDestinationResult = await invokeAndWait(
    session,
    "download_destination_is_known for the database root to settle",
    "__verifyAppDatabaseRootDestination",
    `window.__TAURI_INTERNALS__.invoke("download_destination_is_known", {
      destination: ${JSON.stringify(databaseRootDestination)},
    })`,
  );
  check(
    databaseRootDestinationResult.value === "false",
    "real IPC rejects a database-root id",
    databaseRootDestinationResult.rejected ??
      databaseRootDestinationResult.error ??
      databaseRootDestinationResult.value,
  );

  const retainedEnginePortrait = await waitFor(
    "the retained engine portrait to render and decode",
    async () => {
      await session
        .execute(
          `const link = document.querySelector('a[href="/engines"]');
         if (link && location.pathname !== "/engines") link.click();
         return true`,
        )
        .catch(() => false);
      return session
        .execute(
          `const image = document.querySelector('img[alt="Fixture retained"]');
         if (!image || image.naturalWidth <= 0) return false;
         return { src: image.getAttribute("src"), naturalWidth: image.naturalWidth };`,
        )
        .catch(() => false);
    },
    { timeoutMs: FILES_PROBE_TIMEOUT_MS },
  ).catch((error) => ({ error: error.message }));
  check(
    !retainedEnginePortrait.error,
    "the retained engine LocalImage rendered on the Engines page",
    retainedEnginePortrait.error,
  );
  check(
    typeof retainedEnginePortrait.src === "string" &&
      retainedEnginePortrait.src.startsWith("data:image/png;base64,"),
    "the retained engine LocalImage uses an image/png data URL",
    retainedEnginePortrait.error ?? retainedEnginePortrait.src,
  );
  check(
    retainedEnginePortrait.naturalWidth > 0,
    "the retained engine LocalImage data URL decodes in WebKitGTK",
    retainedEnginePortrait.error ?? String(retainedEnginePortrait.naturalWidth),
  );

  const blobCspResult = await invokeAndWait(
    session,
    "the detached blob image CSP violation to settle",
    "__verifyAppBlobImageCsp",
    `(() => {
      const bytes = new Uint8Array(${JSON.stringify([...retainedImageBytes])});
      const objectUrl = URL.createObjectURL(new Blob([bytes], { type: "image/png" }));
      return new Promise((resolve) => {
        let settled = false;
        let timeoutId;
        const image = document.createElement("img");
        const listener = (event) => {
          if (
            typeof event.violatedDirective !== "string" ||
            !event.violatedDirective.startsWith("img-src") ||
            event.blockedURI !== "blob"
          ) {
            return;
          }
          finish(
            JSON.stringify({
              violatedDirective: event.violatedDirective,
              blockedURI: event.blockedURI,
            }),
          );
        };
        const cleanup = () => {
          if (timeoutId !== undefined) clearTimeout(timeoutId);
          URL.revokeObjectURL(objectUrl);
          document.removeEventListener("securitypolicyviolation", listener);
        };
        const finish = (value) => {
          if (settled) return;
          settled = true;
          cleanup();
          resolve(value);
        };
        try {
          document.addEventListener("securitypolicyviolation", listener);
          timeoutId = setTimeout(
            () => finish(JSON.stringify({ timeout: true })),
            ${CSP_PROBE_TIMEOUT_MS},
          );
          image.src = objectUrl;
        } catch (error) {
          finish(JSON.stringify({ error: String(error) }));
        }
      });
    })()`,
  );
  let blobCspEvent;
  try {
    blobCspEvent = JSON.parse(blobCspResult.value ?? "null");
  } catch {
    blobCspEvent = undefined;
  }
  check(
    typeof blobCspResult.rejected === "undefined" &&
      typeof blobCspEvent?.violatedDirective === "string" &&
      blobCspEvent.violatedDirective.startsWith("img-src") &&
      blobCspEvent.blockedURI === "blob",
    "the production CSP rejects a detached blob image URL with an img-src violation",
    blobCspResult.rejected ?? blobCspResult.error ?? blobCspResult.value,
  );

  const resolveDirectoryResult = await invokeAndWait(
    session,
    "the core:path resolve-directory refusal",
    "__verifyAppResolveDirectory",
    `window.__TAURI_INTERNALS__.invoke("plugin:path|resolve_directory", {
      directory: ${BASE_DIRECTORY_APP_DATA},
      path: "x",
    })`,
    "resolved",
  );
  check(
    typeof resolveDirectoryResult.rejected === "string" &&
      /not allowed/i.test(resolveDirectoryResult.rejected),
    "the renderer cannot resolve a base directory (core:path grants are gone)",
    resolveDirectoryResult.resolved ?? resolveDirectoryResult.error,
  );

  // A bundled release must publish a live, non-zero sound-server port. `invokeAndWait` stores
  // success as a string under the success key and failure as `rejected`; a missing command, a
  // failed invoke and port 0 therefore all fail this check.
  const soundPortResult = await invokeAndWait(
    session,
    "get_sound_server_port to settle",
    "__verifyAppSoundPort",
    `window.__TAURI_INTERNALS__.invoke("get_sound_server_port")`,
    "port",
  );
  const soundServerPort = Number(soundPortResult.port);
  check(
    typeof soundPortResult.rejected === "undefined" && Number(soundPortResult.port) > 0,
    "the renderer reaches a live loopback sound-server port",
    soundPortResult.rejected ?? soundPortResult.error ?? soundPortResult.port,
  );

  // Node side, not `session.execute`: in-page `fetch` is connect-src, which does not list
  // 127.0.0.1, and the handler sends no CORS headers. Only media-src allows loopback, so this
  // proves the axum server serves the bundled file; the webview plays it through <audio>.
  try {
    const response = await fetch(`http://127.0.0.1:${soundServerPort}/standard/Move.mp3`);
    const body = Buffer.from(await response.arrayBuffer());
    check(
      response.status === 200 && body.length > 0,
      "the loopback sound server serves the bundled standard move sound",
      `status ${response.status}, ${body.length} bytes`,
    );
  } catch (error) {
    check(false, "the loopback sound server serves the bundled standard move sound", error.message);
  }

  const prepareRetireImageResult = await invokeAndWait(
    session,
    "engine attachment prepare to settle",
    "__verifyAppPrepareRetireImage",
    `window.__TAURI_INTERNALS__.invoke("reconcile_engine_attachments", {
      action: {
        action: "prepare",
        retained_ids: [{ id: ${JSON.stringify(retainedImageId)} }],
      },
    })`,
  );
  check(
    prepareRetireImageResult.value === "null",
    "real attachment IPC prepares the exact next durable owner set",
    prepareRetireImageResult.rejected ?? prepareRetireImageResult.error,
  );
  await session.execute(`localStorage.setItem("engines", arguments[0]); return true`, [
    JSON.stringify([ownerEngine("retained", retainedImageId)]),
  ]);
  const retireImageResult = await invokeAndWait(
    session,
    "engine attachment reconciliation to settle",
    "__verifyAppRetireImage",
    `window.__TAURI_INTERNALS__.invoke("reconcile_engine_attachments", {
      action: {
        action: "reconcile",
        retained_ids: [{ id: ${JSON.stringify(retainedImageId)} }],
        abandoned_ids: [{ id: ${JSON.stringify(retiredImageId)} }],
        startup: false,
      },
    })`,
  );
  check(
    retireImageResult.value === "null",
    "real attachment IPC retires the selected managed image",
    retireImageResult.rejected ?? retireImageResult.error,
  );
  const registryWithCleanup = await waitFor("the managed-image cleanup intent", async () => {
    const registry = JSON.parse(await readFile(registryFile, "utf8"));
    return registry.image_cleanup?.some(({ id }) => id.id === retiredImageId) ? registry : false;
  });
  check(
    existsSync(retiredImage) &&
      existsSync(retainedImage) &&
      !registryWithCleanup.entries.some(({ id }) => id.id === retiredImageId),
    "retirement preserves image bytes for the live session and records cleanup intent",
  );

  check(
    closeControl === "label" || closeControl === "fallback",
    "the custom title bar rendered its window controls",
    closeControl === "fallback"
      ? "the translated close label was absent; the last button in the window-controls group will be used"
      : undefined,
  );

  const preparedRead = await invokeAndWait(
    session,
    "native read reservation to settle",
    "__verifyAppPreparedRead",
    `window.__TAURI_INTERNALS__.invoke("prepare_native_read", {})`,
  );
  check(
    typeof preparedRead.value === "string",
    "the native backend mints an opaque read reservation",
    preparedRead.rejected ?? preparedRead.error,
  );
  const preparedTicket = preparedRead.value;
  const cancelRead = await invokeAndWait(
    session,
    "native read cancellation to settle",
    "__verifyAppCancelledRead",
    `window.__TAURI_INTERNALS__.invoke("cancel_native_read", { ticket: ${JSON.stringify(preparedTicket)} })`,
  );
  check(cancelRead.value === "null", "the native backend acknowledges reservation cancellation");
  const refusedStart = await invokeAndWait(
    session,
    "cancelled native read start to settle",
    "__verifyAppRefusedRead",
    `window.__TAURI_INTERNALS__.invoke("lex_pgn", { pgn: "1. e4 *", ticket: ${JSON.stringify(preparedTicket)} })`,
  );
  check(
    typeof refusedStart.rejected === "string" &&
      /native read reservation is unknown or expired/.test(refusedStart.rejected),
    "a cancelled reservation cannot be claimed by a later native read",
    refusedStart.value ?? refusedStart.error,
  );

  // Files double-click. Runs before the retained reservation is minted, so opening the file cannot
  // add a reservation to the destroyed-window log line checked below. Navigation stays in-app:
  // a URL load would replace the main webview document that line is about. Nothing after this
  // depends on the route the double-click leaves behind.
  const filesRowCheck = "the seeded workspace file row renders on the Files page";
  const filesRouteCheck = "a real double-click on the unselected Files row navigates to /";
  const filesNotationCheck = "a real double-click on the unselected Files row shows its game";
  const filesRow = await filesRowCoordinates(session, filesRowName).then(
    (coordinates) => ({ coordinates }),
    (error) => ({ error: error.message }),
  );
  check(!filesRow.error, filesRowCheck, filesRow.error);
  if (filesRow.error) {
    check(false, filesRouteCheck, "not attempted: the Files row never rendered");
    check(false, filesNotationCheck, "not attempted: the Files row never rendered");
  } else {
    const gesture = await doubleClickAt(
      session,
      filesRow.coordinates.x,
      filesRow.coordinates.y,
    ).then(
      () => null,
      (error) => `the pointer double-click gesture was rejected: ${error.message}`,
    );
    const route = gesture
      ? { error: gesture }
      : await waitFor(
          "the double-click to navigate to /",
          () => session.execute("return location.pathname === '/'").catch(() => false),
          { timeoutMs: FILES_PROBE_TIMEOUT_MS },
        ).catch(async (error) => ({
          error: `${error.message}; path is ${await session
            .execute("return location.pathname")
            .catch(() => "unknown")}`,
        }));
    check(route === true, filesRouteCheck, route.error);
    const notation = gesture
      ? { error: "not attempted: the gesture was rejected" }
      : await waitFor(
          "the opened game's notation",
          () =>
            session
              .execute(
                "return document.body.innerText.replace(/\\s+/g, '').includes(arguments[0])",
                [filesGameNotation],
              )
              .catch(() => false),
          { timeoutMs: FILES_PROBE_TIMEOUT_MS },
        ).catch((error) => ({ error: `${error.message}; expected ${filesGameNotation}` }));
    check(notation === true, filesNotationCheck, notation.error);
  }

  await verifyGameOpening(session);

  // Lossless NAGs: setup failures are carried to every dependent assertion.
  const nagSetup = async (step, prerequisite, action) => {
    if (prerequisite.error) return prerequisite;
    try {
      const value = await action();
      if (!value) throw new Error("the setup returned no result");
      return { value };
    } catch (error) {
      return { error: `not attempted: ${step}: ${error.message}` };
    }
  };
  const nagAssertion = async (description, prerequisite, action) => {
    if (prerequisite.error) {
      check(false, description, prerequisite.error);
      return prerequisite;
    }
    try {
      const value = await action();
      check(true, description);
      return { value };
    } catch (error) {
      check(false, description, error.message);
      return { error: `not attempted: ${description}: ${error.message}` };
    }
  };
  const nagRow = await nagSetup("NAG Files row lookup", {}, () =>
    filesRowCoordinates(session, nagsRowName),
  );
  const nagOpened = await nagSetup("NAG game double-click open", nagRow, async () => {
    await doubleClickAt(session, nagRow.value.x, nagRow.value.y);
    return waitFor(
      "the NAG game's notation",
      () =>
        session.execute(`
      return location.pathname === '/' && [...document.querySelectorAll('button[class*="cell"]')]
        .some((button) => /^(?:Nc3|♘c3)$/.test(button.textContent.trim()));
    `),
      { timeoutMs: FILES_PROBE_TIMEOUT_MS },
    );
  });
  const navigateNagMove = async (move) => {
    const coordinates = await session.execute(
      `
      const button = [...document.querySelectorAll('button[class*="cell"]')].find((button) =>
        button.textContent.trim().replace('♘', 'N').replace(/[!?□=⩲]+$/, '') === arguments[0]);
      if (!button) return false;
      const box = button.getBoundingClientRect();
      return { x: Math.round(box.left + box.width / 2), y: Math.round(box.top + box.height / 2) };
    `,
      [move],
    );
    if (!coordinates) throw new Error(`the ${move} notation control was not rendered`);
    await clickAt(session, coordinates.x, coordinates.y);
    return waitFor(
      `the selected ${move} notation control`,
      () =>
        session.execute(
          `
      return [...document.querySelectorAll('button[class*="cell"]')].some((button) =>
        button.textContent.trim().replace('♘', 'N').replace(/[!?□=⩲]+$/, '') === arguments[0] &&
        button.style.getPropertyValue('--light-bg') !== '' &&
        button.style.getPropertyValue('--light-bg') !== 'transparent');
    `,
          [move],
        ),
      { timeoutMs: FILES_PROBE_TIMEOUT_MS },
    );
  };
  const hintProbe = () =>
    session.execute(`
    const board = document.querySelector('[role="grid"]');
    // The hint overlays BoardFrame inside the common board surface.
    const wrapper = board?.closest('[data-board-surface]');
    const hint = wrapper?.querySelector('[data-board-annotation-hint]');
    const svg = hint?.querySelector(':scope > svg');
    if (!hint) return { rendered: false, title: null, path: false, width: 0, height: 0, ancestors: [], visible: false };
    const box = hint.getBoundingClientRect();
    const ancestors = [];
    let reachedBoardWrapper = false;
    let element = hint;
    while (element) {
      const style = getComputedStyle(element);
      ancestors.push({ element: element.tagName, className: element.getAttribute("class"), display: style.display, visibility: style.visibility, opacity: style.opacity });
      if (element === wrapper) reachedBoardWrapper = true;
      element = element.parentElement;
    }
    return {
      rendered: true, title: svg?.querySelector('title')?.textContent ?? null,
      path: Boolean(svg?.querySelector('g path')),
      width: box.width, height: box.height, ancestors,
      visible: reachedBoardWrapper && box.width > 0 && box.height > 0 && ancestors.every((style) =>
        style.display !== 'none' && style.visibility !== 'hidden' && style.visibility !== 'collapse' &&
        Number(style.opacity) > 0),
    };
  `);
  const assertNagHint = async (predicate) => {
    const hint = await hintProbe();
    if (!predicate(hint)) throw new Error(`observed board hint: ${JSON.stringify(hint)}`);
    return hint;
  };
  const nagE4 = await nagSetup("navigation to 1.e4", nagOpened, () => navigateNagMove("e4"));
  await nagAssertion("the $8 board hint is rendered with a glyph path", nagE4, () =>
    assertNagHint((hint) => hint.rendered && hint.path),
  );
  await nagAssertion("the $8 board hint SVG title is □", nagE4, () =>
    assertNagHint((hint) => hint.title === "□"),
  );
  await nagAssertion(
    "the $8 board hint has a visible box and positive opacity through its board ancestors",
    nagE4,
    () => assertNagHint((hint) => hint.visible),
  );
  if (screenshotPath && !nagE4.error) {
    await writeFile(screenshotPath, Buffer.from(await session.screenshot(), "base64"));
    console.log(`  ..  NAG game at 1.e4 screenshot written to ${screenshotPath}`);
  }
  const nagD5 = await nagSetup("navigation to 2...d5", nagOpened, () => navigateNagMove("d5"));
  await nagAssertion("the unknown $220 renders no board annotation hint", nagD5, () =>
    assertNagHint((hint) => !hint.rendered),
  );
  const nagNc3 = await nagSetup("navigation to 3.Nc3", nagOpened, () => navigateNagMove("Nc3"));
  const nagAnnotated = await nagSetup("Annotate panel ?! click", nagNc3, async () => {
    const tab = await session.execute(`
      const tab = [...document.querySelectorAll('[role="tab"]')].find((tab) => tab.textContent.trim() === 'Annotate');
      if (!tab) return false;
      const box = tab.getBoundingClientRect();
      return { x: Math.round(box.left + box.width / 2), y: Math.round(box.top + box.height / 2) };
    `);
    if (!tab) throw new Error("the Annotate tab was not rendered");
    await clickAt(session, tab.x, tab.y);
    const button = await waitFor(
      "the Annotate ?! control",
      () =>
        session.execute(`
      const button = [...document.querySelectorAll('[role="tabpanel"] button')].find((button) => button.textContent.trim() === '?!');
      if (!button) return false;
      const box = button.getBoundingClientRect();
      return box.width > 0 && box.height > 0 && { x: Math.round(box.left + box.width / 2), y: Math.round(box.top + box.height / 2) };
    `),
      { timeoutMs: FILES_PROBE_TIMEOUT_MS },
    );
    await clickAt(session, button.x, button.y);
    return waitFor(
      "Nc3?! in the real notation",
      () =>
        session.execute(`
      return [...document.querySelectorAll('button[class*="cell"]')]
        .some((button) => button.textContent.trim().replace('♘', 'N') === 'Nc3?!');
    `),
      { timeoutMs: FILES_PROBE_TIMEOUT_MS },
    );
  });
  const nagMovetext = (pgn) =>
    pgn
      .split(/\r?\n/)
      .filter((line) => line.trim() && !line.startsWith("["))
      .join(" ");
  const nagSaved = await nagAssertion(
    "SAVE_FILE writes Nc3?! to the seeded NAG file",
    nagAnnotated,
    async () => {
      const before = await readFile(nagsGamePath, "utf8");
      let observed = before;
      let readError;
      try {
        // SAVE_FILE is ctrl+s on Linux (src/state/keybinds.ts).
        await session.call("POST", "/actions", {
          actions: [
            {
              type: "key",
              id: "nag-save",
              actions: [
                { type: "keyDown", value: "\uE009" },
                { type: "keyDown", value: "s" },
                { type: "keyUp", value: "s" },
                { type: "keyUp", value: "\uE009" },
              ],
            },
          ],
        });
        return await waitFor(
          "the NAG file's saved Nc3?! edit",
          async () => {
            try {
              observed = await readFile(nagsGamePath, "utf8");
              readError = undefined;
            } catch (error) {
              readError = error.message;
              return false;
            }
            return observed.includes("Nc3?!") && observed;
          },
          { timeoutMs: FILES_PROBE_TIMEOUT_MS },
        );
      } catch (error) {
        throw new Error(
          `${error.message}; file changed: ${observed !== before}; NAG movetext: ${nagMovetext(observed)}${readError ? `; read error: ${readError}` : ""}`,
        );
      }
    },
  );
  for (const text of ["$8", "$11", "d4! $2", "$220"]) {
    await nagAssertion(`the saved NAG game preserves ${text}`, nagSaved, () => {
      const saved = nagSaved.value;
      if (!saved.includes(text)) throw new Error(`observed saved movetext: ${nagMovetext(saved)}`);
      return true;
    });
  }

  // Metadata-only edit through the real card and modal. Disk assertions depend on submission,
  // not its success: a rejected write must still leave the filename assertion independently green.
  const filesMetadataDialogCheck = "the Files metadata edit submits without a dialog error";
  const filesMetadataFilterCheck = "the Repertoire filter lists the metadata-edited workspace file";
  const filesMetadataSidecarCheck =
    "the metadata-edited workspace sidecar records repertoire on disk";
  const filesMetadataFilenameCheck = "the Files metadata edit preserves the PGN filename";
  const metadataAttempt = async (action) => {
    try {
      return { value: await action() };
    } catch (error) {
      return { error: error.message };
    }
  };
  const clickMetadataControl = async (label, lookup, args = []) => {
    const coordinates = await waitFor(
      label,
      () =>
        session.execute(
          `
        const control = ${lookup};
        if (!control) return false;
        control.scrollIntoView({ block: 'nearest' });
        const box = control.getBoundingClientRect();
        return box.width > 0 && box.height > 0 && !control.disabled && {
          x: Math.round(box.left + box.width / 2), y: Math.round(box.top + box.height / 2)
        };`,
          args,
        ),
      { timeoutMs: FILES_PROBE_TIMEOUT_MS },
    );
    await clickAt(session, coordinates.x, coordinates.y);
  };
  const chooseRepertoire = async (inDialog) => {
    await clickMetadataControl(
      inDialog ? "the edit dialog's File type Select" : "the Files page's File type filter",
      `(() => {
        const label = [...document.querySelectorAll('label')].find(label =>
          Boolean(label.closest('[role="dialog"]')) === arguments[0] &&
          label.textContent.replace(/\\s*\\*$/, '').trim() === 'File type');
        return label && document.getElementById(label.htmlFor);
      })()`,
      [inDialog],
    );
    await clickMetadataControl(
      "the Repertoire option",
      `[...document.querySelectorAll('[role="option"]')].find(option =>
        option.textContent.trim() === 'Repertoire' && option.getBoundingClientRect().height > 0)`,
    );
  };
  let metadataSubmitted = false;
  let originalWorkspacePgnNames;
  const metadataEdit = await metadataAttempt(async () => {
    originalWorkspacePgnNames = (await readdir(filesWorkspace))
      .filter((name) => name.endsWith(".pgn"))
      .sort();
    if (existsSync(filesMetadataInfoPath))
      throw new Error("the metadata fixture already has a sidecar");
    const row = await filesRowCoordinates(session, filesMetadataRowName);
    await clickAt(session, row.x, row.y);
    await clickMetadataControl(
      "the FileCard Edit metadata control",
      `document.querySelector('button[aria-label="Edit metadata"]')`,
    );
    await waitFor(
      "the metadata edit dialog with the unchanged Name",
      () =>
        session.execute(
          `
        const dialog = document.querySelector('[role="dialog"]');
        const label = dialog && [...dialog.querySelectorAll('label')].find(label => label.textContent.trim() === 'Name');
        return label && document.getElementById(label.htmlFor)?.value === arguments[0];`,
          [filesMetadataRowName],
        ),
      { timeoutMs: FILES_PROBE_TIMEOUT_MS },
    );
    await chooseRepertoire(true);
    await clickMetadataControl(
      "the metadata edit Confirm control",
      `[...document.querySelectorAll('[role="dialog"] button')].find(button => button.textContent.trim() === 'Confirm')`,
    );
    metadataSubmitted = true;
    return waitFor(
      "the metadata edit to close or report a dialog error",
      () =>
        session.execute(`
        const dialog = document.querySelector('[role="dialog"]');
        if (!dialog) return { closed: true };
        const invalid = dialog.querySelector('input[aria-invalid="true"]');
        const error = invalid && document.getElementById(invalid.getAttribute('aria-describedby'));
        return invalid && { error: error?.textContent ?? 'the Name input is invalid' };`),
      { timeoutMs: FILES_PROBE_TIMEOUT_MS },
    );
  });
  const metadataSetupError = metadataSubmitted
    ? undefined
    : `not attempted: metadata edit setup: ${metadataEdit.error}`;
  const metadataDialogError = metadataSetupError ?? metadataEdit.error ?? metadataEdit.value?.error;
  check(metadataEdit.value?.closed === true, filesMetadataDialogCheck, metadataDialogError);

  const metadataFilter = metadataDialogError
    ? {
        error: `not attempted: the metadata edit did not close successfully: ${metadataDialogError}`,
      }
    : await metadataAttempt(async () => {
        await chooseRepertoire(false);
        await filesRowCoordinates(session, filesMetadataRowName);
        return session.execute(`
          const label = [...document.querySelectorAll('label')].find(label =>
            !label.closest('[role="dialog"]') && label.textContent.trim() === 'File type');
          return label && document.getElementById(label.htmlFor)?.value === 'Repertoire';`);
      });
  check(metadataFilter.value === true, filesMetadataFilterCheck, metadataFilter.error);

  const metadataSidecar = metadataSetupError
    ? { error: metadataSetupError }
    : await metadataAttempt(async () => {
        const metadata = JSON.parse(await readFile(filesMetadataInfoPath, "utf8"));
        if (metadata.type !== "repertoire")
          throw new Error(`observed sidecar: ${JSON.stringify(metadata)}`);
        return true;
      });
  check(metadataSidecar.value === true, filesMetadataSidecarCheck, metadataSidecar.error);
  const metadataFilename = metadataSetupError
    ? { error: metadataSetupError }
    : await metadataAttempt(async () => {
        const currentPgnNames = (await readdir(filesWorkspace))
          .filter((name) => name.endsWith(".pgn"))
          .sort();
        if (
          !existsSync(filesMetadataPgnPath) ||
          JSON.stringify(currentPgnNames) !== JSON.stringify(originalWorkspacePgnNames)
        ) {
          throw new Error(
            `original PGN exists: ${existsSync(filesMetadataPgnPath)}; PGN filenames: ${JSON.stringify(currentPgnNames)}`,
          );
        }
        return true;
      });
  check(metadataFilename.value === true, filesMetadataFilenameCheck, metadataFilename.error);
  // Close a failed dialog before the later document-reload and shutdown checks.
  await session.call("POST", "/actions", {
    actions: [
      {
        type: "key",
        id: "metadata-dismiss",
        actions: [
          { type: "keyDown", value: "\uE00C" },
          { type: "keyUp", value: "\uE00C" },
          { type: "keyDown", value: "\uE00C" },
          { type: "keyUp", value: "\uE00C" },
        ],
      },
    ],
  });
  await waitFor(
    "the metadata dialog to be dismissed",
    () => session.execute("return !document.querySelector('[role=\"dialog\"]')"),
    { timeoutMs: FILES_PROBE_TIMEOUT_MS },
  );

  // Direct launches inherit precisely the primary's profile and off-screen display environment.
  const launchInstanceProbe = (env) => {
    const child = launch(APP_BINARY, [], { env });
    const stdout = outputBuffer();
    const stderr = outputBuffer();
    let launchError;
    child.on("error", (error) => {
      launchError = error;
    });
    child.stdout.on("data", (chunk) => {
      stdout.push(chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr.push(chunk);
    });
    return {
      child,
      stdout: () => stdout.text(),
      waitForLine: (line) =>
        waitFor(
          line,
          () => {
            if (launchError) throw launchError;
            if (stdout.text().includes(line)) return true;
            if (child.exitCode !== null || child.signalCode !== null) {
              throw new Error(
                `instance probe exited before ${line}: ${stdout.text()}\n${stderr.text()}`,
              );
            }
            return false;
          },
          { timeoutMs: INSTANCE_PROBE_TIMEOUT_MS },
        ),
    };
  };
  const refusalCheck =
    "a second process on the same app-data directory is refused before initialization";
  const unchangedCheck =
    "the refused launch leaves authority and credential registry bytes unchanged";
  const primaryCheck = "the primary still answers WebDriver after the refused launch";
  const reportedInstanceChecks = new Set();
  const instanceCheck = (condition, description, detail) => {
    check(condition, description, detail);
    reportedInstanceChecks.add(description);
  };
  const instanceSetupFailure = (descriptions, step, error) => {
    for (const description of descriptions) {
      if (!reportedInstanceChecks.has(description)) {
        instanceCheck(false, description, `not attempted: ${step}: ${error.message}`);
      }
    }
  };
  const assertInstanceRefusal = async (
    probe,
    { description, stopStep, survivorMessage, setStep },
  ) => {
    await probe.waitForLine("another ChessFable process holds the application data directory");
    setStep(stopStep);
    await stopLaunchedChild(probe.child);
    if (processExists(probe.child.pid)) throw new Error(survivorMessage);
    instanceCheck(
      !probe.stdout().includes("Finished rust initialization"),
      description,
      probe.stdout(),
    );
  };
  let refused;
  let refusalStep = "read the primary registries";
  try {
    const credentialRegistry = join(
      profileDirectory,
      ".local/share/com.chessriddle.encroissant/credentials/lichess-accounts.json",
    );
    const before = await Promise.all([readFile(registryFile), readFile(credentialRegistry)]);
    refusalStep = "wait for same-directory refusal";
    refused = launchInstanceProbe(appEnvironment);
    await assertInstanceRefusal(refused, {
      description: refusalCheck,
      stopStep: "stop the refused process",
      survivorMessage: "the refused process survived cleanup",
      setStep: (step) => {
        refusalStep = step;
      },
    });
    refusalStep = "read the primary registries after refusal";
    const after = await Promise.all([readFile(registryFile), readFile(credentialRegistry)]);
    instanceCheck(
      before.every((bytes, index) => bytes.equals(after[index])),
      unchangedCheck,
    );
    refusalStep = "query the primary WebDriver session after refusal";
    instanceCheck(
      await session.execute("return typeof window.__TAURI_INTERNALS__ === 'object'"),
      primaryCheck,
    );
  } catch (error) {
    instanceSetupFailure([refusalCheck, unchangedCheck, primaryCheck], refusalStep, error);
  } finally {
    if (refused) await stopLaunchedChild(refused.child);
  }

  const sharedConfigCheck = "a second process sharing only the configuration directory is refused";
  let differentData;
  let sharedConfig;
  let sharedConfigStep = "create the different-data root";
  try {
    differentData = await mkdtemp(join(tmpdir(), "chessfable-config-sharing-probe-"));
    registerTemporaryProfile(differentData);
    sharedConfigStep = "wait for shared-configuration refusal";
    sharedConfig = launchInstanceProbe({ ...appEnvironment, XDG_DATA_HOME: differentData });
    await assertInstanceRefusal(sharedConfig, {
      description: sharedConfigCheck,
      stopStep: "stop the shared-configuration process",
      survivorMessage: "the shared-configuration process survived cleanup",
      setStep: (step) => {
        sharedConfigStep = step;
      },
    });
  } catch (error) {
    instanceSetupFailure([sharedConfigCheck], sharedConfigStep, error);
  } finally {
    if (sharedConfig) await stopLaunchedChild(sharedConfig.child);
    if (differentData) await rm(differentData, { recursive: true, force: true });
  }

  const coexistenceCheck =
    "a process on a different app-data directory initializes while the primary runs";
  let differentProfile;
  let independent;
  let coexistenceStep = "create the different-HOME profile";
  try {
    differentProfile = await mkdtemp(join(tmpdir(), "chessfable-instance-probe-"));
    registerTemporaryProfile(differentProfile);
    coexistenceStep = "wait for different-HOME initialization";
    independent = launchInstanceProbe({ ...appEnvironment, HOME: differentProfile });
    await independent.waitForLine("Finished rust initialization");
    coexistenceStep = "query the primary WebDriver session during coexistence";
    instanceCheck(
      await session.execute("return typeof window.__TAURI_INTERNALS__ === 'object'"),
      coexistenceCheck,
    );
  } catch (error) {
    instanceSetupFailure([coexistenceCheck], coexistenceStep, error);
  } finally {
    if (independent) await stopLaunchedChild(independent.child);
    if (differentProfile) await rm(differentProfile, { recursive: true, force: true });
  }

  const reloadCheck = "a real document reload cancels the previous document's retained reservation";
  const workspaceTabsCheck =
    "a real document reload preserves both exact seeded workspace tab identities";
  const workspaceSelectionCheck = "a real document reload selects the second seeded workspace tab";
  const seededWorkspaceTabs = ["verify:workspace:first", "verify:workspace:second"].map((name) => ({
    name,
    value: randomUUID(),
    type: "new",
    gameOrigin: { kind: "none" },
  }));
  const seededWorkspace = {
    version: 1,
    tabs: seededWorkspaceTabs,
    activeTab: seededWorkspaceTabs[1].value,
  };
  let workspaceReloadPrepared = false;
  try {
    const previousDocumentRead = await invokeAndWait(
      session,
      "previous-document native read reservation to settle",
      "__verifyAppPreviousDocumentRead",
      `window.__TAURI_INTERNALS__.invoke("prepare_native_read", {})`,
    );
    if (typeof previousDocumentRead.value !== "string") {
      throw new Error(
        previousDocumentRead.rejected ??
          previousDocumentRead.error ??
          "no reservation ticket returned",
      );
    }
    const previousDocumentTicket = previousDocumentRead.value;
    await waitFor(
      "the board route before seeding the reload workspace",
      () =>
        session
          .execute(
            `const link = document.querySelector('a[href="/"]');
         if (link && location.pathname !== "/") link.click();
         return location.pathname === "/" && !!document.querySelector('[role="tablist"] [role="tab"]');`,
          )
          .catch(() => false),
      { timeoutMs: FILES_PROBE_TIMEOUT_MS },
    );
    await session.execute('sessionStorage.setItem("workspace", arguments[0]); return true;', [
      serializeStorageValue(seededWorkspace),
    ]);
    workspaceReloadPrepared = true;
    await session.call("POST", "/refresh", {});
    await waitFor(
      "the reloaded renderer and its previous-document reservation sweep",
      async () => {
        const ready = await session
          .execute("return typeof window.__TAURI_INTERNALS__ === 'object'")
          .catch(() => false);
        if (!ready) return false;
        const prefix = "reloaded webview main cancelled native reservations:";
        return (await readLog()).split("\n").some((line) => {
          const start = line.indexOf(prefix);
          if (start === -1) return false;
          const ids = line
            .slice(start + prefix.length)
            .trim()
            .split(",");
          return ids.includes(previousDocumentTicket);
        });
      },
      { timeoutMs: FILES_PROBE_TIMEOUT_MS },
    );
    check(true, reloadCheck);
  } catch (error) {
    check(false, reloadCheck, error.message);
  }

  try {
    if (!workspaceReloadPrepared) throw new Error("the workspace reload fixture was not prepared");
    // Native sweep logging precedes render. Wait for a rendered board tablist independently,
    // without waiting for the expected identities that the assertions themselves must verify.
    const renderedWorkspace = await waitFor(
      "the reloaded workspace DOM",
      () =>
        session
          .execute(
            `if (document.readyState !== "complete" || location.pathname !== "/") return false;
         const tablist = document.querySelector('[role="tablist"]');
         const tabs = [...(tablist?.querySelectorAll('[role="tab"]') ?? [])];
         if (tabs.length === 0 || !tabs.some((tab) => tab.getAttribute("aria-selected") === "true")) return false;
         return {
           ids: tabs.map((tab) => tab.getAttribute("aria-controls")?.split("-panel-").at(-1) ?? null),
           selectedIds: tabs.filter((tab) => tab.getAttribute("aria-selected") === "true")
             .map((tab) => tab.getAttribute("aria-controls")?.split("-panel-").at(-1) ?? null),
         };`,
          )
          .catch(() => false),
      { timeoutMs: FILES_PROBE_TIMEOUT_MS },
    );
    check(
      renderedWorkspace.ids.length === 2 &&
        renderedWorkspace.ids.every((id, index) => id === seededWorkspaceTabs[index].value),
      workspaceTabsCheck,
      `rendered tab ids: ${JSON.stringify(renderedWorkspace.ids)}`,
    );
    check(
      renderedWorkspace.selectedIds.length === 1 &&
        renderedWorkspace.selectedIds[0] === seededWorkspace.activeTab,
      workspaceSelectionCheck,
      `selected tab ids: ${JSON.stringify(renderedWorkspace.selectedIds)}`,
    );
    if (screenshotPath) {
      await writeFile(screenshotPath, Buffer.from(await session.screenshot(), "base64"));
      console.log(`  ..  Reloaded workspace screenshot written to ${screenshotPath}`);
    }
  } catch (error) {
    check(false, workspaceTabsCheck, error.message);
    check(false, workspaceSelectionCheck, error.message);
  }

  // The reload log wait above confirms the startup sweep ran before this new-document reservation.
  // Its presence in the destroyed-window log below proves it survived that sweep until close.
  const retainedRead = await invokeAndWait(
    session,
    "retained native read reservation to settle",
    "__verifyAppRetainedRead",
    `window.__TAURI_INTERNALS__.invoke("prepare_native_read", {})`,
  );
  check(
    typeof retainedRead.value === "string",
    "a native read reservation is retained until titlebar close",
    retainedRead.rejected ?? retainedRead.error,
  );
  const retainedTicket = retainedRead.value;

  const describeProcesses = (processes) =>
    processes.map(({ pid, ppid, cmd }) => `${pid} ${ppid} ${cmd}`).join("\n      ");
  // The app's own control exercises the real RunEvent::ExitRequested path rather than a kill.
  const assertedClose = await closeApplicationThroughTitlebar(session, "asserted");
  const { application, webkitServicePids, running, gone, survivors } = assertedClose;
  check(true, "the application process is running before the close", describeProcesses(running));
  const trackedDescription =
    `application pid ${application.pid} and recorded WebKit service pids ` +
    `[${webkitServicePids.join(", ") || "none"}]`;
  check(
    gone && survivors.length === 0,
    `${trackedDescription} do not exist after the close`,
    survivors.length > 0 ? `surviving pids: ${survivors.join(", ")}` : undefined,
  );

  const log = await readLog();
  // This retained ticket belongs to the reloaded document and survived its startup sweep.
  check(
    log.includes(`destroyed webview main cancelled native reads/downloads: ${retainedTicket}`),
    "the real destroyed-window event cancels the exact retained main-webview reservation",
  );
  check(
    log.includes("Shutdown requested: terminating engines and live games"),
    "the shutdown sequence started",
  );
  check(
    log.includes("Shutdown cleanup finished"),
    "the shutdown cleanup ran to completion inside its budget",
    log.includes("Shutdown budget")
      ? "the budget elapsed instead — children may still be running"
      : undefined,
  );
  check(log.includes("Sound server shutdown signalled"), "the sound server shutdown was signalled");

  const shutdownRegistry = JSON.parse(await readFile(registryFile, "utf8"));
  check(
    !existsSync(retiredImage) &&
      existsSync(retainedImage) &&
      !shutdownRegistry.image_cleanup?.some(({ id }) => id.id === retiredImageId) &&
      shutdownRegistry.entries.some(({ id }) => id.id === retainedImageId),
    "titlebar shutdown removes retired image bytes and intent while retaining the owner",
  );

  console.log("\nshutdown log:");
  for (const line of log.split("\n").filter((line) => /Shutdown|Sound server/.test(line))) {
    console.log(`  ${line}`);
  }

  // Reset the throwaway HOME only after all existing checks and their shutdown evidence. This
  // fresh profile has no active custom root or cached list, and the db file predates app startup.
  const databaseRootCheck =
    "default-root-unusable: the Databases alert offers a visible folder chooser";
  try {
    if (!gone || survivors.length > 0) throw new Error("the asserted application survived close");
    const released = await session.quit();
    if (!released.released)
      throw new Error(`could not release the asserted session: ${released.error}`);
    await rm(profileDirectory, { recursive: true, force: true });
    const appDataDirectory = join(profileDirectory, ".local/share/com.chessriddle.encroissant");
    await mkdir(appDataDirectory, { recursive: true });
    await mkdir(join(profileDirectory, ".config/com.chessriddle.encroissant"), { recursive: true });
    await writeFile(join(appDataDirectory, "db"), "default database root is a regular file\n");
    session = await Session.open(APP_BINARY);
    const alert = await databaseAlert(session, "the unusable default database root alert");
    check(
      alert.message === "This database folder cannot be opened. Choose another." &&
        alert.buttonDisplayed === true,
      databaseRootCheck,
      `observed Databases alert: ${JSON.stringify(alert)}`,
    );
  } catch (error) {
    check(false, databaseRootCheck, error.message);
  }

  // Let the real page activate its default in a fresh profile, then remove that selected folder
  // while the app is stopped. Relaunching re-proves the persisted selection without a cached list.
  const selectedRootCheck =
    "selected-root-missing: the Databases alert offers a visible folder chooser without recreating db";
  const selectedDatabaseRoot = join(
    profileDirectory,
    ".local/share/com.chessriddle.encroissant/db",
  );
  try {
    const closed = await closeApplicationThroughTitlebar(session, "default-root-unusable");
    if (!closed.gone || closed.survivors.length > 0)
      throw new Error("the default-root-unusable application survived close");
    const released = await session.quit();
    if (!released.released)
      throw new Error(`could not release the default-root-unusable session: ${released.error}`);
    await rm(profileDirectory, { recursive: true, force: true });
    await mkdir(join(profileDirectory, ".config/com.chessriddle.encroissant"), { recursive: true });
    session = await Session.open(APP_BINARY);
    await waitFor(
      "the Databases page to activate the default database root",
      async () => {
        const onDatabases = await session.execute(
          `const link = document.querySelector('a[href="/databases"]');
           if (link && location.pathname !== "/databases") link.click();
           return location.pathname === "/databases";`,
        );
        if (!onDatabases || !existsSync(selectedDatabaseRoot)) return false;
        const registry = await readFile(registryFile, "utf8").then(JSON.parse);
        const active = registry.entries.find(
          ({ id }) => id.id === registry.active_database_root?.id,
        );
        return (
          active?.purpose === "databaseRoot" &&
          active.target_is_dir &&
          active.path.platform === "unix" &&
          Buffer.from(active.path.bytes, "base64").toString() === selectedDatabaseRoot
        );
      },
      { timeoutMs: FILES_PROBE_TIMEOUT_MS },
    );
    const activatedClose = await closeApplicationThroughTitlebar(
      session,
      "activated database root",
    );
    if (!activatedClose.gone || activatedClose.survivors.length > 0)
      throw new Error("the activated database root application survived close");
    const activatedRelease = await session.quit();
    if (!activatedRelease.released)
      throw new Error(`could not release the activated-root session: ${activatedRelease.error}`);
    await rename(selectedDatabaseRoot, join(selectedDatabaseRoot, "..", "db-moved"));
    session = await Session.open(APP_BINARY);
    const alert = await databaseAlert(session, "the missing selected database root alert");
    const dbExists = existsSync(selectedDatabaseRoot);
    check(
      alert.message === "This database folder is no longer available. Choose another." &&
        alert.buttonDisplayed === true &&
        !dbExists,
      selectedRootCheck,
      `observed Databases alert: ${JSON.stringify({ ...alert, dbExists })}`,
    );
  } catch (error) {
    check(
      false,
      selectedRootCheck,
      `${error.message}; db exists: ${existsSync(selectedDatabaseRoot)}`,
    );
  }
}

try {
  if (!isAbsolute(progressApplication) || !existsSync(progressApplication)) {
    throw new Error("progress application must name an existing absolute binary path");
  }
  if (
    expectedProgressGeneration !== undefined &&
    !canonicalProgressGeneration(expectedProgressGeneration)
  ) {
    throw new Error("expected progress generation must be a canonical unsigned u64 decimal string");
  }
  if (
    !progressContractOnly &&
    (applicationIndex !== -1 || progressGenerationIndex !== -1 || expectClearRejection)
  ) {
    throw new Error("disposable progress measurement options require --progress-contract");
  }
  requirePrerequisites(progressContractOnly ? progressApplication : APP_BINARY);

  const { socket } = await startCompositor();
  const { profileDirectory, appEnvironment } = await startDriver({ waylandDisplay: socket });
  if (progressContractOnly) {
    const progressSession = await Session.open(progressApplication);
    try {
      await waitFor("progress renderer startup", () => progressSession.execute(closeControlProbe));
      await verifyProgressContract(progressSession, { cancellation: true });
      if (screenshotPath && !expectClearRejection) {
        await writeFile(screenshotPath, Buffer.from(await progressSession.screenshot(), "base64"));
      }
    } finally {
      await progressSession.quit();
    }
  } else {
    await verifyFullApplication(profileDirectory, appEnvironment);
  }
} catch (error) {
  console.error(`\nverify:app could not run: ${error.message}`);
  if (error.stack) console.error(error.stack);
  const diagnostics = driverDiagnostics();
  if (diagnostics) console.error(`  .. tauri-driver output:\n${diagnostics}`);
  process.exitCode = 1;
} finally {
  try {
    await shutdown();
  } catch (error) {
    console.error(`\nverify:app cleanup failed: ${error.message}`);
    process.exitCode = 1;
  } finally {
    cleanupSettled = true;
  }
}

if (failures.length > 0) {
  console.error(`\n${failures.length} check(s) failed`);
  process.exitCode = 1;
} else if (process.exitCode !== 1) {
  console.log("\nall checks passed");
}
