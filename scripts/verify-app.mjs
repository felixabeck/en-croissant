// Behavioural check against the real application window. See `scripts/app-driver.mjs` for the
// stack it builds and for what it deliberately cannot reach.
//
//   pnpm verify:app                 run the checks
//   pnpm verify:app --screenshot X  also write a PNG of the page to X
//
// It asserts three things that no other gate in this repository can:
//   1. the real binary starts, renders and answers script under WebKitGTK,
//   2. closing it through its own control runs the shutdown sequence to completion,
//   3. nothing — app or WebKit service process — outlives that close.

import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  APP_BINARY,
  Session,
  appProcesses,
  processExists,
  requirePrerequisites,
  shutdown,
  startCompositor,
  startDriver,
  waitFor,
} from "./app-driver.mjs";

const screenshotIndex = process.argv.indexOf("--screenshot");
const screenshotPath = screenshotIndex === -1 ? undefined : process.argv[screenshotIndex + 1];
const closeControlProbe = `
  const labelled = document.querySelector('button[aria-label="Close window"]');
  const controls = document.querySelector('[class*="windowControls"]');
  const fallback = controls ? controls.querySelector('button:last-of-type') : null;
  return labelled ? "label" : fallback ? "fallback" : false;
`;

const failures = [];
const check = (condition, description, detail) => {
  console.log(`${condition ? "  ok  " : "FAIL  "}${description}`);
  if (!condition) {
    failures.push(description);
    if (detail) console.log(`      ${detail}`);
  }
};

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
  const logFile = join(
    profileDirectory,
    ".local/share/com.chessriddle.encroissant/logs/en-croissant.log",
  );
  const readLog = () => readFile(logFile, "utf8").catch(() => "");

  const session = await Session.open(APP_BINARY);
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

  const running = appProcesses();
  const application = running.find(({ cmd }) => /release\/en-croissant/.test(cmd));
  const webkitServicePids = application
    ? running
        .filter(
          ({ ppid, cmd }) =>
            ppid === application.pid && /WebKitWebProcess|WebKitNetworkProcess/.test(cmd),
        )
        .map(({ pid }) => pid)
    : [];
  const trackedPids = application ? [application.pid, ...webkitServicePids] : [];
  const describeProcesses = (processes) =>
    processes.map(({ pid, ppid, cmd }) => `${pid} ${ppid} ${cmd}`).join("\n      ");
  check(
    application !== undefined,
    "the application process is running before the close",
    describeProcesses(running),
  );

  // The app's own control, so this is the real RunEvent::ExitRequested path rather than a kill.
  await session.execute(
    `
      const labelled = document.querySelector('button[aria-label="Close window"]');
      const controls = document.querySelector('[class*="windowControls"]');
      const fallback = controls ? controls.querySelector('button:last-of-type') : null;
      const close = labelled || fallback;
      if (!close) throw new Error("could not find the close control in the window-controls group");
      setTimeout(() => close.click(), 0);
      return 1;
    `,
  );

  const gone = await waitFor(
    `application pid ${application?.pid ?? "unknown"} and its recorded WebKit service pids to exit`,
    () => trackedPids.every((pid) => !processExists(pid)),
    { timeoutMs: 30_000 },
  ).catch(() => false);
  const survivors = trackedPids.filter(processExists);
  const trackedDescription =
    `application pid ${application?.pid ?? "unknown"} and recorded WebKit service pids ` +
    `[${webkitServicePids.join(", ") || "none"}]`;
  check(
    application !== undefined && gone && survivors.length === 0,
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
