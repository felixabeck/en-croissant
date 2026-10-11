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

export function runMutationRunnerWithNodeArgs(runner, root, env, nodeArgs = [], args = []) {
  return spawnSync(process.execPath, [...nodeArgs, runner, ...args], {
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
export function startNodeCli(
  t,
  script,
  root,
  env,
  {
    stdio = ["ignore", "pipe", "pipe"],
    args = [],
    nodeArgs = [],
    afterChildExit = undefined,
    containmentScript = undefined,
    terminalPath = undefined,
  } = {},
) {
  // Backend crash fixtures need an outer subreaper too: a killed owner cannot reap
  // its escaped descendants. This test-owned boundary cleans them on every exit.
  const command = containmentScript ? "python3" : process.execPath;
  const commandArgs = containmentScript
    ? [containmentScript, terminalPath, "--", process.execPath, ...nodeArgs, script, ...args]
    : [...nodeArgs, script, ...args];
  const child = spawn(command, commandArgs, {
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
    if (child.exitCode === null && child.signalCode === null) {
      // SIGTERM first: the runner forwards it and reaps its own supervised child groups.
      child.kill("SIGTERM");
      const settled = await Promise.race([
        done.then(() => true),
        new Promise((resolve) =>
          setTimeout(() => resolve(false), containmentScript ? 10_000 : 5_000).unref(),
        ),
      ]);
      if (!settled) {
        try {
          process.kill(-child.pid, "SIGKILL");
        } catch {
          // The group is already gone; nothing to reap.
        }
        await done;
      }
    }
    await afterChildExit?.({ child, done });
  });
  return { child, done };
}

export function startMutationRunner(t, runner, root, env, options = {}) {
  return startNodeCli(t, runner, root, env, options);
}

export async function waitUntil(predicate, message, timeoutMs = 5_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const result = await predicate();
    if (result) return result;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  assert.fail(message);
}

export async function waitFor(path, timeoutMs = 5_000) {
  await waitUntil(() => existsSync(path), `Timed out waiting for ${path}`, timeoutMs);
}

export function isAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}
