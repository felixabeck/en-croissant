import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { chmod, mkdir, mkdtemp, readFile, readdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { mutationPackages } from "./frontend-mutation-packages.mjs";
import { currentIdentity, identityForPid } from "./process-identity.mjs";

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const runner = join(projectRoot, "scripts", "run-frontend-mutation.mjs");
const fence = "mutants.out/frontend/.mutation-in-progress";

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "frontend-mutation-runner-"));
  const bin = join(root, "bin");
  const state = join(root, "shim-state");
  await mkdir(bin);
  await mkdir(state);
  await writeFile(
    join(bin, "pnpm"),
    `#!/bin/sh
echo "$STRYKER_PACKAGE" >> "$SHIM_STATE/packages"
echo $$ > "$SHIM_STATE/pid"
: > "$SHIM_STATE/started"
case "$SHIM_MODE" in
  block)
    trap 'if [ -d mutants.out/frontend/.mutation-in-progress ]; then : > "$SHIM_STATE/terminated-with-fence"; fi; : > "$SHIM_STATE/terminated"; exit 0' TERM INT
    while [ ! -e "$SHIM_STATE/release" ]; do /bin/sleep 0.05; done
    ;;
esac
if [ "$STRYKER_PACKAGE" = "$FAIL_PACKAGE" ]; then exit 7; fi
`,
  );
  await chmod(join(bin, "pnpm"), 0o755);
  return { root, bin, state };
}

function environment({ bin, state, mode = "normal", failPackage, path }) {
  return {
    ...process.env,
    PATH: path ?? `${bin}:${process.env.PATH}`,
    SHIM_MODE: mode,
    SHIM_STATE: state,
    ...(failPackage ? { FAIL_PACKAGE: failPackage } : {}),
  };
}

function run(root, env, args = []) {
  return spawnSync(process.execPath, [runner, ...args], { cwd: root, env, encoding: "utf8" });
}

function start(root, env) {
  const child = spawn(process.execPath, [runner], {
    cwd: root,
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (chunk) => {
    stdout += chunk;
  });
  child.stderr.on("data", (chunk) => {
    stderr += chunk;
  });
  const done = new Promise((resolve) => {
    child.once("close", (code, signal) => resolve({ code, signal, stdout, stderr }));
  });
  return { child, done };
}

async function waitFor(path, timeoutMs = 5_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (existsSync(path)) return;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  assert.fail(`Timed out waiting for ${path}`);
}

async function waitForRecordedChild(root, timeoutMs = 5_000) {
  const path = join(root, fence, "owner.json");
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const owner = JSON.parse(await readFile(path, "utf8"));
      if (owner.child) return owner;
    } catch {
      // The owner update is published atomically; retry until its child is present.
    }
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  assert.fail(`Timed out waiting for a child identity in ${path}`);
}

function isAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function seedFence(root, owner) {
  const path = join(root, fence);
  await mkdir(path, { recursive: true });
  if (owner !== undefined) {
    await writeFile(join(path, "owner.json"), `${JSON.stringify(owner)}\n`);
  }
}

function deadOwner(overrides = {}) {
  return { runner: { pid: 2_000_000_000, startTime: "1" }, child: null, ...overrides };
}

test("--list-packages prints the shared package map without creating a fence", async () => {
  const { root, bin, state } = await fixture();
  const result = run(root, environment({ bin, state }), ["--list-packages"]);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), Object.keys(mutationPackages));
  assert.equal(existsSync(join(root, fence)), false);
});

test("a normal run spawns once per package and removes its fence", async () => {
  const { root, bin, state } = await fixture();
  const result = run(root, environment({ bin, state }));
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(
    (await readFile(join(state, "packages"), "utf8")).trim().split("\n"),
    Object.keys(mutationPackages),
  );
  assert.equal(existsSync(join(root, fence)), false);
});

test("the runner stops at the first non-zero package and removes its fence", async () => {
  const { root, bin, state } = await fixture();
  const packageNames = Object.keys(mutationPackages);
  const result = run(root, environment({ bin, state, failPackage: packageNames[1] }));
  assert.equal(result.status, 7, result.stderr);
  assert.deepEqual(
    (await readFile(join(state, "packages"), "utf8")).trim().split("\n"),
    packageNames.slice(0, 2),
  );
  assert.equal(existsSync(join(root, fence)), false);
});

test("a pnpm spawn error removes the fence", async () => {
  const { root, bin, state } = await fixture();
  const result = run(root, environment({ bin, state, path: join(root, "missing-bin") }));
  assert.equal(result.status, 1);
  assert.match(result.stderr, /spawn pnpm ENOENT/u);
  assert.equal(existsSync(join(root, fence)), false);
});

test("a concurrent runner refuses a live owner without touching its sandbox", async () => {
  const { root, bin, state } = await fixture();
  const env = environment({ bin, state, mode: "block" });
  const first = start(root, env);
  await waitFor(join(state, "started"));
  const childPid = Number(await readFile(join(state, "pid"), "utf8"));
  const owner = await waitForRecordedChild(root);
  assert.equal(owner.runner.pid, first.child.pid);
  assert.equal(owner.child.pid, childPid);
  assert.equal(typeof owner.child.startTime, "string");
  await mkdir(join(root, ".stryker-tmp"));
  await writeFile(join(root, ".stryker-tmp", "live"), "keep\n");
  const second = run(root, env);
  assert.equal(second.status, 1);
  assert.match(second.stderr, /Frontend mutation fence is live: mutants\.out\/frontend/u);
  assert.equal(await readFile(join(root, ".stryker-tmp", "live"), "utf8"), "keep\n");
  await writeFile(join(state, "release"), "");
  assert.equal((await first.done).code, 0);
});

test("a dead fence owner is taken over without leaving stale directories", async () => {
  const { root, bin, state } = await fixture();
  await seedFence(root, deadOwner());
  const result = run(root, environment({ bin, state }));
  assert.equal(result.status, 0, result.stderr);
  const siblings = await readdir(join(root, "mutants.out", "frontend"));
  assert.equal(
    siblings.some((name) => name.startsWith(".mutation-in-progress.stale-")),
    false,
  );
});

test("a live reused pid with the wrong start time is taken over", async () => {
  const { root, bin, state } = await fixture();
  const live = currentIdentity();
  await seedFence(root, deadOwner({ runner: { ...live, startTime: `${live.startTime}-wrong` } }));
  const result = run(root, environment({ bin, state }));
  assert.equal(result.status, 0, result.stderr);
});

test("only one concurrent runner can take over the same stale fence", async () => {
  const { root, bin, state } = await fixture();
  await seedFence(root, deadOwner());
  const env = environment({ bin, state, mode: "block" });
  const first = start(root, env);
  const second = start(root, env);
  await waitFor(join(state, "started"));
  const loser = await Promise.race([
    first.done.then((result) => ({ running: second, result })),
    second.done.then((result) => ({ running: first, result })),
  ]);
  assert.equal(loser.result.code, 1, loser.result.stderr);
  await writeFile(join(state, "release"), "");
  assert.equal((await loser.running.done).code, 0);
});

test("a missing owner record is treated as live and refused", async () => {
  const { root, bin, state } = await fixture();
  await seedFence(root);
  const result = run(root, environment({ bin, state }));
  assert.equal(result.status, 1);
  assert.match(result.stderr, /owner record missing or malformed/u);
  assert.equal(existsSync(join(root, fence)), true);
});

test("a malformed owner record is treated as live and refused", async () => {
  const { root, bin, state } = await fixture();
  await seedFence(root);
  await writeFile(join(root, fence, "owner.json"), "not json\n");
  const result = run(root, environment({ bin, state }));
  assert.equal(result.status, 1);
  assert.match(result.stderr, /owner record missing or malformed/u);
});

test("a live recorded child keeps a dead runner's fence live", async () => {
  const { root, bin, state } = await fixture();
  const sleeper = spawn("/bin/sleep", ["30"]);
  const childIdentity = identityForPid(sleeper.pid);
  assert.ok(childIdentity);
  await seedFence(root, deadOwner({ child: childIdentity }));
  const refused = run(root, environment({ bin, state }));
  assert.equal(refused.status, 1);
  sleeper.kill("SIGTERM");
  await new Promise((resolve) => sleeper.once("close", resolve));
  const takeover = run(root, environment({ bin, state }));
  assert.equal(takeover.status, 0, takeover.stderr);
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  test(`${signal} terminates and reaps pnpm before removing the fence`, async () => {
    const { root, bin, state } = await fixture();
    const running = start(root, environment({ bin, state, mode: "block" }));
    await waitFor(join(state, "started"));
    const childPid = Number(await readFile(join(state, "pid"), "utf8"));
    running.child.kill(signal);
    const result = await running.done;
    assert.equal(result.code, signal === "SIGINT" ? 130 : 143, result.stderr);
    assert.equal(existsSync(join(state, "terminated")), true);
    assert.equal(existsSync(join(state, "terminated-with-fence")), true);
    assert.equal(isAlive(childPid), false, `pnpm pid ${childPid} still exists`);
    assert.equal(existsSync(join(root, fence)), false);
  });
}

test("stryker config resolves every package through the shared map", async () => {
  const previous = process.env.STRYKER_PACKAGE;
  try {
    for (const [name, mutate] of Object.entries(mutationPackages)) {
      process.env.STRYKER_PACKAGE = name;
      const config = await import(`../stryker.config.mjs?package=${name}`);
      assert.deepEqual(config.default.mutate, mutate);
    }
  } finally {
    if (previous === undefined) delete process.env.STRYKER_PACKAGE;
    else process.env.STRYKER_PACKAGE = previous;
  }
});
