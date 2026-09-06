// Behavioural check against the real application window. See `scripts/app-driver.mjs` for the
// stack it builds and for what it deliberately cannot reach.
//
//   pnpm verify:app                 run the checks
//   pnpm verify:app --screenshot X  also write a PNG of the page to X
//
// It asserts attachment cleanup plus eight things that no other gate in this repository can:
//   1. the real binary starts, renders and answers script under WebKitGTK,
//   2. production startup reclaims unowned authority but preserves owned authority,
//   3. startup authority reconciliation deletes no user files,
//   4. the renderer cannot resolve a native base directory,
//   5. the bounded sound-resource command names the bundled file,
//   6. the bounded sound-resource command refuses an outside collection,
//   7. closing it through its own control runs the shutdown sequence to completion,
//   8. nothing — app or WebKit service process — outlives that close.

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
const closeControlProbe = `
  const labelled = document.querySelector('button[aria-label="Close window"]');
  const controls = document.querySelector('[class*="windowControls"]');
  const fallback = controls ? controls.querySelector('button:last-of-type') : null;
  return labelled ? "label" : fallback ? "fallback" : false;
`;
const closeControlAction = `
  const labelled = document.querySelector('button[aria-label="Close window"]');
  const controls = document.querySelector('[class*="windowControls"]');
  const fallback = controls ? controls.querySelector('button:last-of-type') : null;
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
  const application = running.find(({ cmd }) => /release\/en-croissant/.test(cmd));
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
        error => { window[${JSON.stringify(globalName)}] = { rejected: String(error) }; },
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

process.on("exit", () => void shutdown());
let signalShutdown;
const handleSignal = () => {
  if (signalShutdown) return;
  signalShutdown = shutdown()
    .catch((error) => console.error(`cleanup failed: ${error.message}`))
    .finally(() => process.exit(1));
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
  await seedSession.execute(`localStorage.setItem("engines", arguments[0]); return true`, [
    JSON.stringify([
      ownerEngine("retained", retainedImageId),
      ownerEngine("retire-on-shutdown", retiredImageId),
    ]),
  ]);
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
  await mkdir(ownedRoot, { recursive: true });
  await mkdir(imageDirectory, { recursive: true });
  await writeFile(orphanFile, "do not delete registry fixture bytes");
  await writeFile(retainedImage, "retained managed image bytes");
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

  const soundPathResult = await invokeAndWait(
    session,
    "sound_resource_path to settle",
    "__verifyAppSoundPath",
    `window.__TAURI_INTERNALS__.invoke("sound_resource_path", {
      collection: "standard",
      kind: "Move",
    })`,
    "path",
  );
  check(
    typeof soundPathResult.path === "string" &&
      soundPathResult.path.endsWith("/sound/standard/Move.mp3") &&
      existsSync(soundPathResult.path),
    "sound_resource_path names the bundled file",
    soundPathResult.rejected ?? soundPathResult.error ?? soundPathResult.path,
  );

  const invalidSoundPathResult = await invokeAndWait(
    session,
    "sound_resource_path to refuse an outside collection",
    "__verifyAppInvalidSoundPath",
    `window.__TAURI_INTERNALS__.invoke("sound_resource_path", { collection: "../x", kind: "Move" })`,
  );
  check(
    typeof invalidSoundPathResult.rejected === "string",
    "sound_resource_path refuses a collection outside the bundled set",
    invalidSoundPathResult.value ?? invalidSoundPathResult.error,
  );

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
  await shutdown();
}

if (failures.length > 0) {
  console.error(`\n${failures.length} check(s) failed`);
  process.exitCode = 1;
} else if (process.exitCode !== 1) {
  console.log("\nall checks passed");
}
