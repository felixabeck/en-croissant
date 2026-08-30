// Drives the REAL Tauri window, off-screen, with the real Rust backend.
//
//   kwin_wayland --virtual        an off-screen compositor, so nothing reaches the desktop
//     └─ tauri-driver             proxies WebDriver to WebKitWebDriver
//        └─ WebKitWebDriver       launches and controls the app
//           └─ en-croissant       the real binary, real IPC, real WebKitGTK
//
// This is the complement to `pnpm test:e2e:container`, not a replacement for it. The container
// suite pins renderer *pixels* in Chromium against a mocked IPC surface; this pins *behaviour* in
// the actual product. Neither answers the other's question.
//
// What it cannot reach: native GTK chrome. The menu bar, file dialogs and window decorations are
// drawn by GTK, not by the page, and WebDriver only sees the page. `issue_engine_binary` in
// particular always opens a native picker, so no engine can be registered from here — a check that
// needs a live engine child is still Felix's.
//
// Prerequisites, all three one-off:
//   sudo apt install webkit2gtk-driver     (must match the installed libwebkit2gtk version)
//   cargo install tauri-driver --locked
//   sudo apt install kwin-wayland

import { spawn, execFileSync } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));

export const APP_BINARY = join(projectRoot, "src-tauri", "target", "release", "en-croissant");

const DRIVER_PORT = 4444;
const NATIVE_PORT = 4445;
const FETCH_TIMEOUT_MS = 5_000;
const OUTPUT_LIMIT = 64 * 1024;
const TERM_TIMEOUT_MS = 5_000;
const KILL_TIMEOUT_MS = 2_000;

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Everything started here is killed by process *group*: tauri-driver spawns WebKitWebDriver, which
 * spawns the app, which spawns two WebKit service processes. Killing only the parent would leave
 * the tail of that chain behind — which is, with some irony, the exact defect class this harness
 * exists to check for.
 */
const started = [];
let profileDirectory;
let shutdownPromise;

function launch(command, args, options = {}) {
  const child = spawn(command, args, {
    detached: true,
    stdio: ["ignore", "pipe", "pipe"],
    ...options,
  });
  started.push(child);
  return child;
}

function outputBuffer() {
  let value = "";
  return {
    push(chunk) {
      value = (value + String(chunk)).slice(-OUTPUT_LIMIT);
    },
    text() {
      return value;
    },
  };
}

function collect(child, sink) {
  child.stdout?.on("data", (chunk) => sink.push(String(chunk)));
  child.stderr?.on("data", (chunk) => sink.push(String(chunk)));
}

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export async function waitFor(label, probe, { timeoutMs = 45_000, everyMs = 200 } = {}) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const remainingMs = deadline - Date.now();
    if (remainingMs <= 0) throw new Error(`timed out waiting for ${label}`);

    let timer;
    const value = await Promise.race([
      Promise.resolve().then(() => probe()),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`timed out waiting for ${label}`)), remainingMs);
      }),
    ]).finally(() => clearTimeout(timer));
    if (value) return value;

    const delayMs = Math.min(everyMs, deadline - Date.now());
    if (delayMs <= 0) throw new Error(`timed out waiting for ${label}`);
    await sleep(delayMs);
  }
}

export function requirePrerequisites() {
  const missing = [];
  if (!existsSync("/usr/bin/WebKitWebDriver")) {
    missing.push("WebKitWebDriver — install with: sudo apt install webkit2gtk-driver");
  }
  try {
    execFileSync("sh", ["-c", "command -v tauri-driver"], { stdio: "ignore" });
  } catch {
    missing.push("tauri-driver — install with: cargo install tauri-driver --locked");
  }
  try {
    execFileSync("sh", ["-c", "command -v kwin_wayland"], { stdio: "ignore" });
  } catch {
    missing.push("kwin_wayland — install with: sudo apt install kwin-wayland");
  }
  if (!existsSync(APP_BINARY)) {
    missing.push(`${APP_BINARY} — build it with: pnpm build`);
  }
  if (missing.length > 0) {
    throw new Error(`missing prerequisites:\n  - ${missing.join("\n  - ")}`);
  }
}

/** An off-screen Wayland compositor. The window never appears on, or takes focus from, the desktop. */
export async function startCompositor({ width = 1400, height = 900 } = {}) {
  const output = outputBuffer();
  const kwin = launch("kwin_wayland", [
    "--virtual",
    "--width",
    String(width),
    "--height",
    String(height),
  ]);
  collect(kwin, output);
  const socket = await waitFor("the nested compositor socket", () => {
    const match = output
      .text()
      .match(/Accepting client connections on sockets: QList\("([^"]+)"\)/);
    return match?.[1];
  });
  return { socket, output: output.text() };
}

/**
 * The app inherits this environment, so `HOME` decides which profile it reads and writes. It gets a
 * throwaway one: `tauri-plugin-window-state` persists geometry on exit, and a headless 1400x900 run
 * must not resize the window Felix actually uses. XDG overrides are removed so they cannot bypass it.
 */
export async function startDriver({ waylandDisplay }) {
  const output = outputBuffer();
  const env = {
    ...process.env,
    WAYLAND_DISPLAY: waylandDisplay,
    LANG: "en_US.UTF-8",
    LC_ALL: "en_US.UTF-8",
  };

  try {
    const response = await fetchWithTimeout(`http://127.0.0.1:${DRIVER_PORT}/status`);
    if (response.body) await response.body.cancel().catch(() => {});
    throw new Error(`refusing to start tauri-driver: port ${DRIVER_PORT} is already answering`);
  } catch (error) {
    if (error.message.includes(`port ${DRIVER_PORT} is already answering`)) throw error;
  }

  profileDirectory = await mkdtemp(join(tmpdir(), "en-croissant-verify-"));
  env.HOME = profileDirectory;
  for (const name of ["XDG_DATA_HOME", "XDG_CONFIG_HOME", "XDG_CACHE_HOME", "XDG_STATE_HOME"]) {
    delete env[name];
  }
  const driver = launch(
    "tauri-driver",
    ["--port", String(DRIVER_PORT), "--native-port", String(NATIVE_PORT)],
    { env },
  );
  collect(driver, output);
  await waitFor(`tauri-driver to accept connections on port ${DRIVER_PORT}`, async () => {
    if (driver.exitCode !== null || driver.signalCode !== null) {
      throw new Error(
        `tauri-driver exited before port ${DRIVER_PORT} became ready ` +
          `(exit code ${driver.exitCode ?? "none"}, signal ${driver.signalCode ?? "none"})`,
      );
    }
    try {
      const response = await fetchWithTimeout(`http://127.0.0.1:${DRIVER_PORT}/status`);
      if (response.body) await response.body.cancel().catch(() => {});
      return true;
    } catch {
      return false;
    }
  });
  return { output: output.text(), profileDirectory };
}

/** Minimal WebDriver client. The wire protocol is JSON over HTTP, so this needs no dependency. */
export class Session {
  constructor(id) {
    this.base = `http://127.0.0.1:${DRIVER_PORT}/session/${id}`;
  }

  static async open(application = APP_BINARY, tauriOptions = {}) {
    const response = await fetchWithTimeout(`http://127.0.0.1:${DRIVER_PORT}/session`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        capabilities: { alwaysMatch: { "tauri:options": { application, ...tauriOptions } } },
      }),
    });
    const body = await response.json();
    if (!response.ok) throw new Error(`session failed: ${JSON.stringify(body)}`);
    return new Session(body.value.sessionId);
  }

  async call(method, path, payload) {
    const response = await fetchWithTimeout(this.base + path, {
      method,
      headers: payload ? { "content-type": "application/json" } : undefined,
      body: payload ? JSON.stringify(payload) : undefined,
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(`${method} ${path} -> ${JSON.stringify(body)}`);
    return body.value;
  }

  /** Runs in the page, so `window.__TAURI_INTERNALS__` and the real IPC bridge are reachable. */
  execute(script, args = []) {
    return this.call("POST", "/execute/sync", { script, args });
  }

  /** Base64 PNG of the page — not of the window, so GTK chrome is not in it. */
  screenshot() {
    return this.call("GET", "/screenshot");
  }

  quit() {
    return fetchWithTimeout(this.base, { method: "DELETE" }).catch(() => {});
  }
}

/** Processes belonging to the app, by full command line. Used to prove nothing outlives a close. */
export function appProcesses() {
  try {
    return execFileSync("ps", ["-eo", "pid,ppid,cmd"])
      .toString()
      .split("\n")
      .filter((line) => /release\/en-croissant|WebKitWebProcess|WebKitNetworkProcess/.test(line))
      .filter((line) => !/\bgrep\b/.test(line))
      .map((line) => {
        const [pid, ppid, ...command] = line.trim().split(/\s+/);
        return { pid: Number(pid), ppid: Number(ppid), cmd: command.join(" ") };
      })
      .filter(({ pid, ppid }) => Number.isInteger(pid) && Number.isInteger(ppid));
  } catch {
    return [];
  }
}

export function processExists(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code === "EPERM";
  }
}

function processGroupExists(pid) {
  try {
    process.kill(-pid, 0);
    return true;
  } catch (error) {
    return error.code !== "ESRCH";
  }
}

function signalProcessGroup(pid, signal) {
  try {
    process.kill(-pid, signal);
    return true;
  } catch (error) {
    if (error.code !== "ESRCH") {
      console.error(`cleanup: could not send ${signal} to process group ${pid}: ${error.message}`);
    }
    return false;
  }
}

async function groupGone(pid, timeoutMs) {
  try {
    await waitFor(`process group ${pid} to exit`, () => !processGroupExists(pid), {
      timeoutMs,
      everyMs: 100,
    });
    return true;
  } catch {
    return false;
  }
}

async function cleanUp() {
  const children = started.splice(0).reverse();
  const groupPids = children.map((child) => child.pid).filter((pid) => Number.isInteger(pid));

  for (const pid of groupPids) signalProcessGroup(pid, "SIGTERM");

  const termResults = await Promise.all(
    groupPids.map(async (pid) => ({ pid, gone: await groupGone(pid, TERM_TIMEOUT_MS) })),
  );
  const termSurvivors = termResults.filter(({ gone }) => !gone).map(({ pid }) => pid);

  for (const pid of termSurvivors) {
    console.error(`cleanup: process group ${pid} survived SIGTERM; escalating to SIGKILL`);
    signalProcessGroup(pid, "SIGKILL");
  }

  await Promise.all(termSurvivors.map((pid) => groupGone(pid, KILL_TIMEOUT_MS)));

  const survivors = groupPids.filter(processGroupExists);
  if (survivors.length > 0) {
    console.error(`cleanup: process groups still alive after SIGKILL: ${survivors.join(", ")}`);
  }

  for (const child of children) {
    child.stdout?.destroy();
    child.stderr?.destroy();
  }

  const profileToRemove = profileDirectory;
  profileDirectory = undefined;
  if (profileToRemove) {
    await rm(profileToRemove, { recursive: true, force: true }).catch(() => {});
  }
}

export function shutdown() {
  if (!shutdownPromise) shutdownPromise = cleanUp();
  return shutdownPromise;
}
