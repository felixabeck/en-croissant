import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { chmod, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { mutationPackages } from "./frontend-mutation-packages.mjs";
import {
  isAlive,
  runMutationRunner,
  startMutationRunner,
  waitFor,
  writeShim,
} from "./mutation-runner-test-harness.mjs";
import { currentIdentity, identityForPid } from "./process-identity.mjs";

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const runner = join(projectRoot, "scripts", "run-frontend-mutation.mjs");
const fence = "mutants.out/frontend/.mutation-in-progress";

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "frontend-mutation-runner-"));
  const state = join(root, "shim-state");
  await mkdir(state);
  const packageDirectory = join(root, "node_modules", "@stryker-mutator", "core");
  await mkdir(join(packageDirectory, "bin"), { recursive: true });
  await writeFile(
    join(packageDirectory, "package.json"),
    `${JSON.stringify({
      name: "@stryker-mutator/core",
      type: "module",
      exports: { "./package.json": "./package.json" },
    })}\n`,
  );
  await writeShim(
    join(packageDirectory, "bin", "stryker.js"),
    [
      "#!/usr/bin/env node",
      'import { appendFileSync, existsSync, writeFileSync } from "node:fs";',
      'import { join } from "node:path";',
      "const state = process.env.SHIM_STATE;",
      'writeFileSync(join(state, "booting"), "");',
      'if (process.env.SHIM_MODE === "startup-delay") {',
      "  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 5_000);",
      "}",
      'appendFileSync(join(state, "packages"), `${process.env.STRYKER_PACKAGE}\\n`);',
      'writeFileSync(join(state, "pid"), `${process.pid}\\n`);',
      'writeFileSync(join(state, "started"), "");',
      "function recordTermination() {",
      '  if (existsSync("mutants.out/frontend/.mutation-in-progress")) {',
      '    writeFileSync(join(state, "terminated-with-fence"), "");',
      "  }",
      '  writeFileSync(join(state, "terminated"), "");',
      "  process.exit(0);",
      "}",
      'if (process.env.SHIM_MODE === "block") {',
      '  process.on("SIGTERM", recordTermination);',
      '  process.on("SIGINT", recordTermination);',
      "  const timer = setInterval(() => {",
      '    if (existsSync(join(state, "release"))) {',
      "      clearInterval(timer);",
      "      process.exit(0);",
      "    }",
      "  }, 20);",
      '} else if (process.env.SHIM_MODE === "ignore-term") {',
      '  process.on("SIGTERM", () => {});',
      '  process.on("SIGINT", () => {});',
      "  setInterval(() => {}, 1_000);",
      '} else if (process.env.SHIM_MODE === "record") {',
      "  process.exit(0);",
      "} else if (process.env.STRYKER_PACKAGE === process.env.FAIL_PACKAGE) {",
      "  process.exit(7);",
      "}",
      "",
    ].join("\n"),
  );
  return { root, state };
}

function environment({ state, mode = "normal", failPackage }) {
  return {
    ...process.env,
    SHIM_MODE: mode,
    SHIM_STATE: state,
    ...(failPackage ? { FAIL_PACKAGE: failPackage } : {}),
  };
}

const run = (root, env, args = []) => runMutationRunner(runner, root, env, args);
const start = (root, env) => startMutationRunner(runner, root, env);

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

async function seedFence(root, owner) {
  const path = join(root, fence);
  await mkdir(path, { recursive: true });
  if (owner !== undefined) {
    await writeFile(join(path, "owner.json"), `${JSON.stringify(owner)}\n`);
  }
}

function deadOwner(overrides = {}) {
  return {
    runner: { pid: 2_000_000_000, startTime: "1" },
    child: { pid: 2_000_000_001, startTime: "1" },
    ...overrides,
  };
}

test("--list-packages prints the shared package map without creating a fence", async () => {
  const { root, state } = await fixture();
  const result = run(root, environment({ state }), ["--list-packages"]);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), Object.keys(mutationPackages));
  assert.equal(existsSync(join(root, fence)), false);
});

test("a normal run spawns once per package and removes its fence", async () => {
  const { root, state } = await fixture();
  const result = run(root, environment({ state }));
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(
    (await readFile(join(state, "packages"), "utf8")).trim().split("\n"),
    Object.keys(mutationPackages),
  );
  assert.equal(existsSync(join(root, fence)), false);
});

test("the runner stops at the first non-zero package and removes its fence", async () => {
  const { root, state } = await fixture();
  const packageNames = Object.keys(mutationPackages);
  const result = run(root, environment({ state, failPackage: packageNames[1] }));
  assert.equal(result.status, 7, result.stderr);
  assert.deepEqual(
    (await readFile(join(state, "packages"), "utf8")).trim().split("\n"),
    packageNames.slice(0, 2),
  );
  assert.equal(existsSync(join(root, fence)), false);
});

test("a missing Stryker CLI is reported clearly and removes the fence", async () => {
  const { root, state } = await fixture();
  await rm(join(root, "node_modules", "@stryker-mutator", "core", "bin", "stryker.js"));
  const result = run(root, environment({ state }));
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Cannot resolve the Stryker CLI.*stryker\.js does not exist/su);
  assert.equal(existsSync(join(root, fence)), false);
});

test("a concurrent runner refuses a live owner without touching its sandbox", async () => {
  const { root, state } = await fixture();
  const env = environment({ state, mode: "block" });
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
  assert.match(second.stderr, /Frontend mutation fence exists: mutants\.out\/frontend/u);
  assert.equal(await readFile(join(root, ".stryker-tmp", "live"), "utf8"), "keep\n");
  await writeFile(join(state, "release"), "");
  assert.equal((await first.done).code, 0);
});

test("a dead fence owner is taken over without leaving stale directories", async () => {
  const { root, state } = await fixture();
  await seedFence(root, deadOwner());
  const result = run(root, environment({ state }));
  assert.equal(result.status, 0, result.stderr);
  const siblings = await readdir(join(root, "mutants.out", "frontend"));
  assert.equal(
    siblings.some((name) => name.startsWith(".mutation-in-progress.stale-")),
    false,
  );
});

test("a live reused pid with the wrong start time is taken over", async () => {
  const { root, state } = await fixture();
  const live = currentIdentity();
  await seedFence(root, deadOwner({ runner: { ...live, startTime: `${live.startTime}-wrong` } }));
  const result = run(root, environment({ state }));
  assert.equal(result.status, 0, result.stderr);
});

test("only one concurrent runner can take over the same stale fence", async () => {
  const { root, state } = await fixture();
  await seedFence(root, deadOwner());
  const env = environment({ state, mode: "block" });
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
  const { root, state } = await fixture();
  await seedFence(root);
  const result = run(root, environment({ state }));
  assert.equal(result.status, 1);
  assert.match(result.stderr, /owner record missing or malformed/u);
  assert.equal(existsSync(join(root, fence)), true);
});

test("a malformed owner record is treated as live and refused", async () => {
  const { root, state } = await fixture();
  await seedFence(root);
  await writeFile(join(root, fence, "owner.json"), "not json\n");
  const result = run(root, environment({ state }));
  assert.equal(result.status, 1);
  assert.match(result.stderr, /owner record missing or malformed/u);
});

test("an unreadable owner record surfaces its cause and is refused", async (t) => {
  if (process.getuid?.() === 0) {
    t.skip("root bypasses the file permission this test relies on");
    return;
  }
  const { root, state } = await fixture();
  await seedFence(root, deadOwner());
  const ownerPath = join(root, fence, "owner.json");
  await chmod(ownerPath, 0o000);
  const result = run(root, environment({ state }));
  await chmod(ownerPath, 0o600);
  assert.equal(result.status, 1);
  assert.match(
    result.stderr,
    /Cannot determine whether the fence owner is alive:.*(?:EACCES|permission denied)/su,
  );
});

test("a dead runner with no recorded child is refused, not taken over", async () => {
  const { root, state } = await fixture();
  await seedFence(root, deadOwner({ child: null }));
  const result = run(root, environment({ state }));
  assert.equal(result.status, 1);
  assert.match(result.stderr, /1\. Confirm no stryker process is running/u);
  assert.equal(existsSync(join(root, fence)), true);
});

test("a live recorded child keeps a dead runner's fence live", async () => {
  const { root, state } = await fixture();
  const sleeper = spawn("/bin/sleep", ["30"]);
  const childIdentity = identityForPid(sleeper.pid);
  assert.ok(childIdentity);
  await seedFence(root, deadOwner({ child: childIdentity }));
  const refused = run(root, environment({ state }));
  assert.equal(refused.status, 1);
  sleeper.kill("SIGTERM");
  await new Promise((resolve) => sleeper.once("close", resolve));
  const takeover = run(root, environment({ state }));
  assert.equal(takeover.status, 0, takeover.stderr);
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  test(`${signal} terminates and reaps Stryker before removing the fence`, async () => {
    const { root, state } = await fixture();
    const running = start(root, environment({ state, mode: "block" }));
    await waitFor(join(state, "started"));
    const childPid = Number(await readFile(join(state, "pid"), "utf8"));
    running.child.kill(signal);
    const result = await running.done;
    assert.equal(result.code, signal === "SIGINT" ? 130 : 143, result.stderr);
    assert.equal(existsSync(join(state, "terminated")), true);
    assert.equal(existsSync(join(state, "terminated-with-fence")), true);
    assert.equal(isAlive(childPid), false, `Stryker pid ${childPid} still exists`);
    assert.equal(existsSync(join(root, fence)), false);
  });
}

test("a signal delivered while the Stryker shim is starting is forwarded", async () => {
  const { root, state } = await fixture();
  const running = start(root, environment({ state, mode: "startup-delay" }));
  await waitFor(join(state, "booting"));
  assert.equal(existsSync(join(state, "started")), false);
  running.child.kill("SIGINT");
  const result = await running.done;
  assert.equal(result.code, 130, result.stderr);
  assert.equal(existsSync(join(root, fence)), false);
});

test("a Stryker process that ignores SIGTERM is SIGKILLed before fence removal", async () => {
  const { root, state } = await fixture();
  const running = start(root, environment({ state, mode: "ignore-term" }));
  await waitFor(join(state, "started"));
  const childPid = Number(await readFile(join(state, "pid"), "utf8"));
  running.child.kill("SIGTERM");
  const result = await running.done;
  assert.equal(result.code, 143, result.stderr);
  assert.equal(isAlive(childPid), false, `Stryker pid ${childPid} still exists`);
  assert.equal(existsSync(join(root, fence)), false);
});

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
