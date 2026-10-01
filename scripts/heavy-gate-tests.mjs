import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { delimiter, join } from "node:path";
import test from "node:test";

const projectRoot = process.cwd();
const wrapperPath = join(projectRoot, "scripts/heavy-gate.sh");
const WAIT_TIMEOUT_MS = 5_000;
const OUTSIDE_CGROUP = "/user.slice/user-1000.slice/user@1000.service/app.slice/test.scope";

const FAKE_SYSTEMD_RUN = String.raw`#!/usr/bin/env bash
set -u
printf '%s\0' "$@" >> "$FAKE_SYSTEMD_ARGS"
printf '\0' >> "$FAKE_SYSTEMD_ARGS"

if [[ "$HEAVY_GATE_TEST_SYSTEMD_MODE" == refused ]]; then
  printf 'injected systemd-run refusal\n' >&2
  exit 42
fi

scope_name=""
for argument in "$@"; do
  if [[ "$argument" == --unit=* ]]; then
    scope_name=$(cut -d= -f2- <<< "$argument")
    break
  fi
done
if [[ "$HEAVY_GATE_TEST_SYSTEMD_MODE" != unconfirmed ]]; then
  printf '0::/user.slice/user-1000.slice/user@1000.service/agents.slice/%s\n' \
    "$scope_name" > "$HEAVY_GATE_TEST_CGROUP_FILE"
fi

if [[ "$HEAVY_GATE_TEST_SYSTEMD_MODE" == unconfirmed ]]; then exit 0; fi

while (($# > 0)) && [[ "$1" != -- ]]; do shift; done
if (($# == 0)); then
  printf 'fake systemd-run did not receive --\n' >&2
  exit 43
fi
shift
exec "$@"
`;

function shellQuote(value) {
  return `'${value.replaceAll("'", "'\\''")}'`;
}

async function makeHarness(t, { callerCgroup = OUTSIDE_CGROUP, systemdMode = "confirm" } = {}) {
  const root = await mkdtemp(join("/tmp", "heavy-gate-"));
  const home = join(root, "home");
  const bin = join(root, "bin");
  await mkdir(home);
  await mkdir(bin);
  const systemdRun = join(bin, "systemd-run-fake");
  const systemdArgs = join(root, "systemd-args.bin");
  const cgroupFile = join(root, "cgroup");
  const heavyMarker = join(root, "heavy-ran");
  await writeFile(systemdRun, FAKE_SYSTEMD_RUN);
  await chmod(systemdRun, 0o755);
  await writeFile(systemdArgs, "");
  await writeFile(cgroupFile, `0::${callerCgroup}\n`);
  t.after(() => rm(root, { recursive: true, force: true }));
  return {
    root,
    home,
    bin,
    systemdRun,
    systemdArgs,
    cgroupFile,
    heavyMarker,
    env: {
      ...process.env,
      HOME: home,
      HEAVY_GATE_TEST_FLOCK: "/usr/bin/flock",
      HEAVY_GATE_TEST_SYSTEMD_RUN: systemdRun,
      HEAVY_GATE_TEST_CGROUP_FILE: cgroupFile,
      HEAVY_GATE_TEST_SYSTEMD_MODE: systemdMode,
      FAKE_SYSTEMD_ARGS: systemdArgs,
      FAKE_HEAVY_MARKER: heavyMarker,
      PATH: `${bin}${delimiter}${process.env.PATH}`,
    },
  };
}

function runWrapper(harness, args = ["bash", "-c", 'printf "ran\\n" > "$FAKE_HEAVY_MARKER"']) {
  return spawnSync("bash", [wrapperPath, ...args], {
    cwd: projectRoot,
    env: harness.env,
    encoding: "utf8",
  });
}

function wrapperChild(harness, args) {
  const child = spawn("bash", [wrapperPath, ...args], {
    cwd: projectRoot,
    env: harness.env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (chunk) => (stdout += chunk.toString("utf8")));
  child.stderr.on("data", (chunk) => (stderr += chunk.toString("utf8")));
  const done = new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("close", (code, signal) => resolve({ code, signal, stdout, stderr }));
  });
  return { child, done };
}

async function waitForFile(path) {
  const deadline = Date.now() + WAIT_TIMEOUT_MS;
  while (Date.now() < deadline) {
    try {
      await readFile(path);
      return;
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  assert.fail(`Timed out waiting for ${path}`);
}

async function systemdInvocations(harness) {
  const contents = await readFile(harness.systemdArgs, "utf8");
  return contents
    .split("\0\0")
    .filter(Boolean)
    .map((entry) => entry.split("\0"));
}

function lockDirectory(harness) {
  return join(harness.home, ".cache", "agent-kit");
}

function lockedProcess(harness, ready, release) {
  const lock = join(lockDirectory(harness), "heavy-gate.lock");
  const script = [
    `exec 9>${shellQuote(lock)}`,
    "flock -n 9",
    `touch ${shellQuote(ready)}`,
    `while [[ ! -e ${shellQuote(release)} ]]; do sleep 0.01; done`,
  ].join("; ");
  return spawn("bash", ["-c", script], { cwd: projectRoot, env: harness.env });
}

test("the canonical wrapper lock is acquired and the confirmed heavy command is scoped", async (t) => {
  const harness = await makeHarness(t);
  const result = runWrapper(harness);
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.match(result.stdout, /Heavy-gate lock acquired: repo=chessfable pid=\d+ start=/u);
  assert.match(result.stdout, /Heavy gate scope confirmed: chessfable-gate-\d+\.scope/u);
  assert.match(await readFile(harness.heavyMarker, "utf8"), /ran/u);
  const [invocation] = await systemdInvocations(harness);
  assert.ok(invocation.includes("--user"));
  assert.ok(invocation.includes("--scope"));
  assert.ok(invocation.includes("--quiet"));
  assert.ok(invocation.includes("--slice=agents.slice"));
  assert.ok(invocation.some((argument) => /^--unit=chessfable-gate-\d+\.scope$/u.test(argument)));
  assert.ok(invocation.includes("--"));
  const holder = await readFile(join(lockDirectory(harness), "heavy-gate.holder"), "utf8");
  assert.match(holder, /^repo=chessfable pid=\d+ start=.+\n$/u);
  assert.ok(result.stdout.includes(holder.trim()));
});

test("a caller outside agents.slice still creates the agents.slice scope without bypassing it", async (t) => {
  const harness = await makeHarness(t, { callerCgroup: OUTSIDE_CGROUP });
  const result = runWrapper(harness);
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.match(result.stdout, /Heavy gate scope confirmed:/u);
  const [invocation] = await systemdInvocations(harness);
  assert.ok(invocation.includes("--slice=agents.slice"));
  assert.ok(!invocation.some((argument) => argument.startsWith("BindsTo=")));
  assert.ok(await readFile(harness.heavyMarker, "utf8"));
});

test("a caller in an agents.slice scope binds the new scope to its caller", async (t) => {
  const harness = await makeHarness(t, {
    callerCgroup: "/user.slice/user-1000.slice/user@1000.service/agents.slice/session.scope",
  });
  const result = runWrapper(harness);
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  const [invocation] = await systemdInvocations(harness);
  assert.ok(invocation.includes("-p"));
  assert.ok(invocation.includes("BindsTo=session.scope"));
});

test("a non-creatable lock directory refuses before creating the scope", async (t) => {
  const harness = await makeHarness(t);
  await writeFile(join(harness.home, ".cache"), "not a directory");
  const result = runWrapper(harness);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Cannot create heavy-gate lock directory:/u);
  assert.deepEqual(await systemdInvocations(harness), []);
});

test("an unopenable lock file refuses before creating the scope", async (t) => {
  const harness = await makeHarness(t);
  await mkdir(lockDirectory(harness), { recursive: true });
  await mkdir(join(lockDirectory(harness), "heavy-gate.lock"));
  const result = runWrapper(harness);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Cannot open heavy-gate lock file:/u);
  assert.deepEqual(await systemdInvocations(harness), []);
});

test("failed lock acquisition refuses before creating the scope", async (t) => {
  const harness = await makeHarness(t);
  const fakeFlock = join(harness.bin, "flock-fail");
  await writeFile(fakeFlock, "#!/usr/bin/env bash\nexit 1\n");
  await chmod(fakeFlock, 0o755);
  harness.env.HEAVY_GATE_TEST_FLOCK = fakeFlock;
  const result = runWrapper(harness);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Cannot acquire heavy-gate lock:/u);
  assert.deepEqual(await systemdInvocations(harness), []);
});

test("a held lock prints its holder, waits, and then acquires", async (t) => {
  const harness = await makeHarness(t);
  await mkdir(lockDirectory(harness), { recursive: true });
  const holderFile = join(lockDirectory(harness), "heavy-gate.holder");
  await writeFile(holderFile, "repo=another-repo pid=321 start=2026-09-30T12:00:00+00:00\n");
  const ready = join(harness.root, "holder-ready");
  const release = join(harness.root, "holder-release");
  const holder = lockedProcess(harness, ready, release);
  t.after(() => {
    holder.kill("SIGKILL");
  });
  await waitForFile(ready);

  const running = wrapperChild(harness, ["bash", "-c", 'printf "ran\\n" > "$FAKE_HEAVY_MARKER"']);
  await new Promise((resolve) => setTimeout(resolve, 100));
  assert.match(await readFile(holderFile, "utf8"), /repo=another-repo/u);
  assert.deepEqual(
    await systemdInvocations(harness),
    [],
    "the waiter must not start before acquisition",
  );
  await writeFile(release, "release\n");
  await new Promise((resolve, reject) => {
    holder.once("error", reject);
    holder.once("exit", resolve);
  });
  const result = await running.done;
  assert.equal(result.code, 0, `${result.stdout}\n${result.stderr}`);
  assert.match(result.stderr, /Waiting for heavy-gate lock held by: repo=another-repo pid=321/u);
  assert.match(result.stdout, /Heavy-gate lock acquired: repo=chessfable/u);
  assert.ok(await readFile(harness.heavyMarker, "utf8"));
});

test("an unwritable holder file refuses without starting the heavy command", async (t) => {
  const harness = await makeHarness(t);
  await mkdir(lockDirectory(harness), { recursive: true });
  await mkdir(join(lockDirectory(harness), "heavy-gate.holder"));
  const result = runWrapper(harness);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Cannot write heavy-gate holder file:/u);
  assert.deepEqual(await systemdInvocations(harness), []);
});

test("systemd scope refusal names the failure and runs no heavy command", async (t) => {
  const harness = await makeHarness(t, { systemdMode: "refused" });
  const result = runWrapper(harness);
  assert.equal(result.status, 42);
  assert.match(result.stderr, /injected systemd-run refusal/u);
  assert.match(result.stderr, /Heavy gate scope creation or confirmation failed/u);
  assert.deepEqual(await readFile(harness.heavyMarker).catch(() => ""), "");
});

test("a scope that cannot be confirmed refuses before execing the heavy command", async (t) => {
  const harness = await makeHarness(t, { systemdMode: "unconfirmed" });
  const result = runWrapper(harness);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Heavy gate scope creation or confirmation failed/u);
  assert.deepEqual(await readFile(harness.heavyMarker).catch(() => ""), "");
});

test("fd 9 keeps the lock held after the gate exits until its inherited child exits (CR-4)", async (t) => {
  const harness = await makeHarness(t);
  const childDone = join(harness.root, "child-done");
  const first = wrapperChild(harness, [
    "bash",
    "-c",
    `nohup bash -c 'sleep 0.7; touch ${shellQuote(childDone)}' >/dev/null 2>&1 & echo $! > ${shellQuote(join(harness.root, "child-pid"))}; exit 0`,
  ]);
  await waitForFile(join(harness.root, "child-pid"));
  const firstResult = await first.done;
  assert.equal(firstResult.code, 0, `${firstResult.stdout}\n${firstResult.stderr}`);
  assert.equal(await readFile(childDone).catch(() => undefined), undefined);

  const secondMarker = join(harness.root, "second-ran");
  const second = wrapperChild(harness, [
    "bash",
    "-c",
    `printf "second\\n" > ${shellQuote(secondMarker)}`,
  ]);
  await new Promise((resolve) => setTimeout(resolve, 150));
  assert.equal(await readFile(secondMarker).catch(() => undefined), undefined);
  assert.equal((await systemdInvocations(harness)).length, 1);

  await waitForFile(childDone);
  const secondResult = await second.done;
  assert.equal(secondResult.code, 0, `${secondResult.stdout}\n${secondResult.stderr}`);
  assert.ok(await readFile(secondMarker, "utf8"));
  assert.equal((await systemdInvocations(harness)).length, 2);
});
