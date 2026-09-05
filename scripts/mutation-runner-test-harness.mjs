import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { chmod, writeFile } from "node:fs/promises";

export async function writeShim(path, contents) {
  await writeFile(path, contents);
  await chmod(path, 0o755);
}

export function runMutationRunner(runner, root, env, args = []) {
  return spawnSync(process.execPath, [runner, ...args], {
    cwd: root,
    env,
    encoding: "utf8",
  });
}

/**
 * Start a runner under test. `t` is the node:test context: a failed assertion
 * must not leave the runner and its blocking shim alive, because node --test
 * waits for every child before reporting the file, so one leaked runner hangs
 * the whole suite with no output (measured 2026-09-05: thirty minutes at zero
 * CPU inside the contract gate). The runner starts in its own process group so
 * the teardown can reap the shim and its grandchild along with it.
 */
export function startMutationRunner(
  t,
  runner,
  root,
  env,
  { stdio = ["ignore", "pipe", "pipe"], args = [] } = {},
) {
  const child = spawn(process.execPath, [runner, ...args], {
    cwd: root,
    env,
    stdio,
    detached: true,
  });
  let stdout = "";
  let stderr = "";
  child.stdout?.on("data", (chunk) => {
    stdout += chunk;
  });
  child.stderr?.on("data", (chunk) => {
    stderr += chunk;
  });
  const done = new Promise((resolve) => {
    child.once("close", (code, signal) => resolve({ code, signal, stdout, stderr }));
  });
  t.after(async () => {
    if (child.exitCode !== null || child.signalCode !== null) return;
    // SIGTERM first: the runner forwards it and reaps its own Stryker or cargo
    // child, which lives in a separate process group the runner supervises.
    child.kill("SIGTERM");
    const settled = await Promise.race([
      done.then(() => true),
      new Promise((resolve) => setTimeout(() => resolve(false), 5_000).unref()),
    ]);
    if (settled) return;
    try {
      process.kill(-child.pid, "SIGKILL");
    } catch {
      // The group is already gone; nothing to reap.
    }
    await done;
  });
  return { child, done };
}

export async function waitFor(path, timeoutMs = 5_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (existsSync(path)) return;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  assert.fail(`Timed out waiting for ${path}`);
}

export function isAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}
