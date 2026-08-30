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
// Prerequisites, both one-off:
//   sudo apt install webkit2gtk-driver     (must match the installed libwebkit2gtk version)
//   cargo install tauri-driver --locked

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

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Everything started here is killed by process *group*: tauri-driver spawns WebKitWebDriver, which
 * spawns the app, which spawns two WebKit service processes. Killing only the parent would leave
 * the tail of that chain behind — which is, with some irony, the exact defect class this harness
 * exists to check for.
 */
const started = [];
let profileDirectory;

function launch(command, args, options = {}) {
  const child = spawn(command, args, {
    detached: true,
    stdio: ["ignore", "pipe", "pipe"],
    ...options,
  });
  started.push(child);
  return child;
}

function collect(child, sink) {
  child.stdout?.on("data", (chunk) => sink.push(String(chunk)));
  child.stderr?.on("data", (chunk) => sink.push(String(chunk)));
}

export async function waitFor(label, probe, { timeoutMs = 45_000, everyMs = 200 } = {}) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const value = await probe();
    if (value) return value;
    if (Date.now() > deadline) throw new Error(`timed out waiting for ${label}`);
    await sleep(everyMs);
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
  const output = [];
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
      .join("")
      .match(/Accepting client connections on sockets: QList\("([^"]+)"\)/);
    return match?.[1];
  });
  return { socket, output };
}

/**
 * The app inherits this environment, so `HOME` decides which profile it reads and writes. It gets a
 * throwaway one by default: `tauri-plugin-window-state` persists geometry on exit, and a headless
 * 1400x900 run must not resize the window Felix actually uses.
 */
export async function startDriver({ waylandDisplay, isolateProfile = true }) {
  const output = [];
  const env = { ...process.env, WAYLAND_DISPLAY: waylandDisplay };
  if (isolateProfile) {
    profileDirectory = await mkdtemp(join(tmpdir(), "en-croissant-verify-"));
    env.HOME = profileDirectory;
  }
  const driver = launch(
    "tauri-driver",
    ["--port", String(DRIVER_PORT), "--native-port", String(NATIVE_PORT)],
    { env },
  );
  collect(driver, output);
  await waitFor("tauri-driver to accept connections", async () => {
    try {
      await fetch(`http://127.0.0.1:${DRIVER_PORT}/status`);
      return true;
    } catch {
      return false;
    }
  });
  return { output, profileDirectory };
}

/** Minimal WebDriver client. The wire protocol is JSON over HTTP, so this needs no dependency. */
export class Session {
  constructor(id) {
    this.base = `http://127.0.0.1:${DRIVER_PORT}/session/${id}`;
  }

  static async open(application = APP_BINARY, tauriOptions = {}) {
    const response = await fetch(`http://127.0.0.1:${DRIVER_PORT}/session`, {
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
    const response = await fetch(this.base + path, {
      method,
      headers: payload ? { "content-type": "application/json" } : undefined,
      body: payload ? JSON.stringify(payload) : undefined,
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(`${method} ${path} -> ${JSON.stringify(body)}`);
    return body.value;
  }

  title() {
    return this.call("GET", "/title");
  }

  source() {
    return this.call("GET", "/source");
  }

  /** Runs in the page, so `window.__TAURI_INTERNALS__` and the real IPC bridge are reachable. */
  execute(script, args = []) {
    return this.call("POST", "/execute/sync", { script, args });
  }

  async find(selector) {
    const element = await this.call("POST", "/element", {
      using: "css selector",
      value: selector,
    });
    return Object.values(element)[0];
  }

  click(elementId) {
    return this.call("POST", `/element/${elementId}/click`, {});
  }

  text(elementId) {
    return this.call("GET", `/element/${elementId}/text`);
  }

  /** Base64 PNG of the page — not of the window, so GTK chrome is not in it. */
  screenshot() {
    return this.call("GET", "/screenshot");
  }

  quit() {
    return fetch(this.base, { method: "DELETE" }).catch(() => {});
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
      .map((line) => line.trim());
  } catch {
    return [];
  }
}

export async function shutdown() {
  for (const child of started.reverse()) {
    try {
      process.kill(-child.pid, "SIGTERM");
    } catch {
      /* already gone */
    }
  }
  started.length = 0;
  if (profileDirectory) {
    await rm(profileDirectory, { recursive: true, force: true }).catch(() => {});
    profileDirectory = undefined;
  }
}
