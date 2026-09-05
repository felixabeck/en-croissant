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

export function startMutationRunner(
  runner,
  root,
  env,
  { stdio = ["ignore", "pipe", "pipe"], args = [] } = {},
) {
  const child = spawn(process.execPath, [runner, ...args], { cwd: root, env, stdio });
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
