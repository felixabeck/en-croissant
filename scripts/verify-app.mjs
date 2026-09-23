// Behavioural check against the real application window. See `scripts/app-driver.mjs` for the
// stack it builds and for what it deliberately cannot reach.
//
//   pnpm verify:app                 run the checks
//   pnpm verify:app --screenshot X  also write a PNG of the page to X
//
// It asserts forty-seven independently reported checks that no other gate in this repository can:
//   group | assertions
//   startup | 5: production authority, user-file safety, owned-image cleanup, real IPC bridge,
//             document title
//   practice durable storage | 14: seeded positions, paged reviews, migration, owner retention,
//                                legacy-key preservation, renderer ratings, real sync, exact counts
//   download destinations | 3: persisted destination, fresh-id refusal, database-root refusal
//   image/CSP | 4: retained-engine-portrait-render, retained-engine-data-url,
//                  retained-engine-WebKitGTK-decode, detached-blob-CSP-rejection
//   native services | 3: path capability refusal, live sound port, bundled sound bytes
//   attachments | 4: prepare, retire, live-session bytes/intent, titlebar cleanup
//   native reads | 5: mint, cancel, cancelled-ticket refusal, retained ticket, destroyed-window log
//   Files | 3: seeded-row-render, double-click-route, opened-game-notation
//   titlebar/process | 3: rendered controls, process-before-close, process-after-close
//   shutdown | 3: start, bounded completion, sound signal
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
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { createHash, randomUUID } from "node:crypto";
import { join } from "node:path";
import { Chess, makeSquare } from "chessops";
import { makeFen, parseFen } from "chessops/fen";
import { makeSan } from "chessops/san";
import { createEmptyCard } from "ts-fsrs";
import {
  APP_BINARY,
  Session,
  appProcesses,
  driverDiagnostics,
  processExists,
  requirePrerequisites,
  shutdown,
  startCompositor,
  startDriver,
  waitFor,
} from "./app-driver.mjs";

const screenshotIndex = process.argv.indexOf("--screenshot");
const screenshotPath = screenshotIndex === -1 ? undefined : process.argv[screenshotIndex + 1];
const BASE_DIRECTORY_APP_DATA = 14; // @tauri-apps/api BaseDirectory.AppData
const IPC_PROBE_TIMEOUT_MS = 5_000;
const CSP_PROBE_TIMEOUT_MS = 4_000;
const FILES_PROBE_TIMEOUT_MS = 20_000;
const PRACTICE_RENDERER_TIMEOUT_MS = 600_000;
const PRACTICE_REVIEW_PAGE_LIMIT = 500; // Mirrors PRACTICE_READ_MAX_ENTRIES in practice.rs.
const PRACTICE_MOVE_CLICK_DELAY_MS = 40;
// Gap between the two clicks of the double-click. It must stay inside the platform double-click
// interval, or WebKitGTK delivers two single clicks and the scenario proves nothing.
const DOUBLE_CLICK_GAP_MS = 60;
const filesWorkspaceId = "verify-files-workspace";
const filesRowName = "verify-sample";
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
            "return document.body.innerText.includes('verify:practice') && Boolean(document.querySelector('button[aria-label=\"Open\"]'))",
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
          `const button = document.querySelector('button[aria-label="Open"]');
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

async function closeRestoredAnalysisTab(session) {
  const closeButton = await waitFor("the restored analysis tab close control", () =>
    session
      .execute(
        "const button = [...document.querySelectorAll('button[aria-label=\"Close tab\"]')].reverse().find((candidate) => {\n" +
          "  const box = candidate.getBoundingClientRect();\n" +
          "  return box.width > 0 && box.height > 0;\n" +
          "});\n" +
          "if (!button) return false;\n" +
          "const box = button.getBoundingClientRect();\n" +
          "return { x: Math.round(box.left + box.width / 2), y: Math.round(box.top + box.height / 2) };",
      )
      .catch(() => false),
  );
  await clickAt(session, closeButton.x, closeButton.y, "close-restored-analysis-tab");
  const closeOutcome = await waitFor("the restored practice tab to close or request discard", () =>
    session
      .execute(
        `const tab = [...document.querySelectorAll('[role="tab"]')].find((candidate) => candidate.textContent?.includes("verify:practice"));
         if (!tab) return { kind: "closed" };
         const dialog = [...document.querySelectorAll('[role="dialog"]')].find((candidate) => candidate.textContent?.includes("Unsaved changes"));
         const discard = dialog && [...dialog.querySelectorAll("button")].find((candidate) => candidate.textContent?.includes("Close without saving"));
         if (!discard) return false;
         const box = discard.getBoundingClientRect();
         return { kind: "discard", x: Math.round(box.left + box.width / 2), y: Math.round(box.top + box.height / 2) };`,
      )
      .catch(() => false),
  );
  if (closeOutcome.kind === "discard") {
    await clickAt(session, closeOutcome.x, closeOutcome.y, "discard-restored-practice-tab");
    await waitFor("the restored practice tab discard to complete", () =>
      session
        .execute(
          `return ![...document.querySelectorAll('[role="tab"]')].some((candidate) => candidate.textContent?.includes("verify:practice"));`,
        )
        .catch(() => false),
    );
  }
  await waitFor("the restored analysis board and practice panel to close", () =>
    session
      .execute(
        `return document.querySelectorAll('cg-board').length === 0 &&
          ![...document.querySelectorAll('[role="tab"]')].some((candidate) => candidate.textContent?.includes("verify:practice")) &&
          !document.body.innerText.includes("Start Practice");`,
      )
      .catch(() => false),
  );
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

try {
  requirePrerequisites();

  const { socket } = await startCompositor();
  const { profileDirectory } = await startDriver({ waylandDisplay: socket });
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
  await seedSession.execute(
    `localStorage.setItem("engines", arguments[0]);
     localStorage.setItem("file-workspace", arguments[1]);
     localStorage.setItem("file-workspace-display-name", arguments[2]);
     localStorage.setItem("download-destination-capability", arguments[3]);
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
  await writeFile(largePracticePath, practicePgn(initialPracticeTree));
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
    // The renderer's startup pass (tab restoration, practice migration) must settle before a step
    // closes or opens tabs; the probe above proves only that the native reconciliation ran.
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
  // Closing the restored tab isolates this sync proof from f-20260923-01: its restored tree remains
  // persisted after the PGN changes on disk.
  await closeRestoredAnalysisTab(session);
  await writeFile(largePracticePath, extendedLargePracticePgn);
  await openFilesEntry(session, largePracticeName, PRACTICE_RENDERER_TIMEOUT_MS);
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
    const gesture = await session
      .call("POST", "/actions", {
        actions: [
          {
            type: "pointer",
            id: "mouse",
            parameters: { pointerType: "mouse" },
            actions: [
              {
                type: "pointerMove",
                duration: 0,
                x: filesRow.coordinates.x,
                y: filesRow.coordinates.y,
                origin: "viewport",
              },
              { type: "pointerDown", button: 0 },
              { type: "pointerUp", button: 0 },
              { type: "pause", duration: DOUBLE_CLICK_GAP_MS },
              { type: "pointerDown", button: 0 },
              { type: "pointerUp", button: 0 },
            ],
          },
        ],
      })
      .then(
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

  if (screenshotPath) {
    await writeFile(screenshotPath, Buffer.from(await session.screenshot(), "base64"));
    console.log(`  ..  page screenshot written to ${screenshotPath}`);
  }

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
