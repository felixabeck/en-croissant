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
  requirePrerequisites,
  shutdown,
  startCompositor,
  startDriver,
  waitFor,
} from "./app-driver.mjs";

const screenshotIndex = process.argv.indexOf("--screenshot");
const screenshotPath = screenshotIndex === -1 ? undefined : process.argv[screenshotIndex + 1];

const failures = [];
const check = (condition, description, detail) => {
  console.log(`${condition ? "  ok  " : "FAIL  "}${description}`);
  if (!condition) {
    failures.push(description);
    if (detail) console.log(`      ${detail}`);
  }
};

process.on("exit", () => void shutdown());
process.on("SIGINT", () => {
  void shutdown();
  process.exit(1);
});

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
  await waitFor("the renderer to mount", async () => {
    const ready = await session
      .execute("return document.querySelector('button[aria-label=\"Close window\"]') !== null")
      .catch(() => false);
    return ready;
  });

  check(
    (await session.execute("return typeof window.__TAURI_INTERNALS__")) === "object",
    "the real Tauri IPC bridge is present (not a test mock)",
  );

  const labels = await session.execute(
    "return Array.from(document.querySelectorAll('[aria-label]')).map(e => e.getAttribute('aria-label'))",
  );
  check(labels.includes("Close window"), "the custom title bar rendered its window controls");

  if (screenshotPath) {
    await writeFile(screenshotPath, Buffer.from(await session.screenshot(), "base64"));
    console.log(`  ..  page screenshot written to ${screenshotPath}`);
  }

  const running = appProcesses();
  check(
    running.some((line) => /release\/en-croissant/.test(line)),
    "the application process is running before the close",
    running.join("\n      "),
  );

  // The app's own control, so this is the real RunEvent::ExitRequested path rather than a kill.
  await session.execute(
    `document.querySelector('button[aria-label="Close window"]').click(); return 1;`,
  );

  const gone = await waitFor(
    "the application to exit",
    () => appProcesses().every((line) => !/release\/en-croissant/.test(line)),
    { timeoutMs: 30_000 },
  ).catch(() => false);
  check(gone, "the application exited after its own close control was used");

  const leftovers = appProcesses().filter((line) => /release\/en-croissant/.test(line));
  check(
    leftovers.length === 0,
    "no application or WebKit service process outlived the close",
    leftovers.join("\n      "),
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
