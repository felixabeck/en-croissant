// Behavioural check against the real application window. See `scripts/app-driver.mjs` for the
// stack it builds and for what it deliberately cannot reach.
//
//   pnpm verify:app                 run the checks
//   pnpm verify:app --screenshot X  also write a PNG of the page to X
//
// It asserts thirty independently reported checks that no other gate in this repository can:
//   group | assertions
//   startup | production authority, user-file safety, owned-image cleanup, real IPC bridge,
//            document title
//   image/CSP | retained-engine-portrait-render, retained-engine-data-url,
//              retained-engine-WebKitGTK-decode, detached-blob-CSP-rejection
//   native services | path capability refusal, live sound port and bundled sound bytes
//   attachments | prepare, retire, live-session bytes/intent, titlebar cleanup
//   native reads | mint, cancel, cancelled-ticket refusal, retained ticket, destroyed-window log
//   Files | seeded-row-render, double-click-route, opened-game-notation
//   titlebar/process | rendered controls, process-before-close, process-after-close
//   shutdown | start, bounded completion, sound signal
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

import { existsSync } from "node:fs";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
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
     return true`,
    [
      JSON.stringify([
        ownerEngine("retained", retainedImageId),
        ownerEngine("retire-on-shutdown", retiredImageId),
      ]),
      JSON.stringify({ id: { id: filesWorkspaceId }, kind: "fileWorkspace" }),
      JSON.stringify("Files fixture"),
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
  const orphanFile = join(fixtureDirectory, "orphan-opening-book.bin");
  const imageDirectory = join(
    profileDirectory,
    ".local/share/com.chessriddle.encroissant/engine-images",
  );
  const retainedImage = join(imageDirectory, retainedImageId);
  const retiredImage = join(imageDirectory, retiredImageId);
  const orphanImage = join(imageDirectory, orphanImageId);
  const filesWorkspace = join(fixtureDirectory, "files-workspace");
  await mkdir(ownedRoot, { recursive: true });
  await mkdir(filesWorkspace, { recursive: true });
  await writeFile(join(filesWorkspace, `${filesRowName}.pgn`), filesGamePgn);
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
      ],
      active_database_root: { id: "verify-owned-root" },
      active_puzzle_root: null,
      active_engine_root: null,
      pending_artifacts: [],
      provisional_attachments: [],
      image_cleanup: [],
    }),
  );
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
  const filesRow = await waitFor(
    "the Files row",
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
          [filesRowName],
        )
        .catch(() => false);
    },
    { timeoutMs: FILES_PROBE_TIMEOUT_MS },
  ).catch((error) => ({ error: error.message }));
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
                x: filesRow.x,
                y: filesRow.y,
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
