import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { chmod, mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { availableParallelism } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { ONE_WAVE_BYTES, PUSH_GATE_SCHEDULE, runPushGates } from "./run-push-gates.mjs";
import { workerCount } from "./gate-parallelism.mjs";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const runnerPath = join(repositoryRoot, "scripts/run-push-gates.mjs");
const GIB = 1024 ** 3;
// A broken process test must fail promptly instead of holding the contract gate indefinitely.
const CHILD_CLEANUP_TIMEOUT_MS = 5_000;
// Fake CLI events are polled with a finite deadline so missing progress cannot hang node:test.
const EVENT_WAIT_TIMEOUT_MS = 10_000;
// A missing marker exposes a scheduler concurrency regression within a bounded test run.
const BARRIER_TIMEOUT_MS = 10_000;

const FAKE_COMMAND = String.raw`
import { appendFileSync, mkdirSync, readdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";

const executablePath = process.argv[2];
const executable = basename(executablePath);
const args = process.argv.slice(3);
const command = [executable, ...args].join(" ");
const state = process.env.FAKE_STATE;
const config = JSON.parse(readFileSync(process.env.FAKE_CONFIG, "utf8"));
const behavior = config.commands?.[command] ?? {};
const at = () => process.hrtime.bigint().toString();
const eventPath = join(state, "events.jsonl");
const output = "fake-output:" + executable + ":" + args.join("|");
const record = (entry) => appendFileSync(
  eventPath,
  JSON.stringify({ ...entry, command, executable, args, at: at(), pid: process.pid }) + "\n",
);

record({ type: "start", output });
process.stdout.write(output + "\n");

if (behavior.removeExecutable) {
  try { unlinkSync(join(process.env.FAKE_BIN, behavior.removeExecutable)); } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}

function finish(code = 0) {
  if (finished) return;
  finished = true;
  record({ type: "finish", code, output });
  process.exit(code);
}

let finished = false;
process.on("SIGTERM", () => finish(behavior.signalExitCode ?? 0));
process.on("SIGINT", () => finish(behavior.signalExitCode ?? 0));

if (behavior.signalRunner) process.kill(process.ppid, behavior.signalRunner);
if (behavior.killSelf) {
  setImmediate(() => process.kill(process.pid, behavior.killSelf));
} else if (behavior.barrierLane) {
  const markerDirectory = process.env.FAKE_BARRIER_DIR;
  const expected = process.env.FAKE_BARRIER_LANES.split(",");
  mkdirSync(markerDirectory, { recursive: true });
  writeFileSync(join(markerDirectory, behavior.barrierLane), String(process.pid));
  const deadline = Date.now() + ${BARRIER_TIMEOUT_MS};
  const poll = () => {
    const markers = new Set(readdirSync(markerDirectory));
    if (expected.every((lane) => markers.has(lane))) finish(behavior.exitCode ?? 0);
    else if (Date.now() >= deadline) finish(92);
    else setTimeout(poll, 10);
  };
  poll();
} else if (behavior.hold) {
  setInterval(() => {}, 1_000);
} else if (behavior.delayMs) {
  setTimeout(() => finish(behavior.exitCode ?? 0), behavior.delayMs);
} else {
  setImmediate(() => finish(behavior.exitCode ?? 0));
}
`;

function shellQuote(value) {
  return `'${value.replaceAll("'", "'\\''")}'`;
}

function scheduledFakeCommands(blocks) {
  const selected = new Set(blocks);
  const commands = ["pnpm mutation:guard:check"];
  if (selected.has("rust") || selected.has("bindings")) commands.push("bash scripts/setup-rust.sh");
  if (selected.size > 0) commands.push("pnpm gate:run frontend-build");
  if (selected.has("bindings")) commands.push("pnpm bindings:check");
  if (selected.has("rust")) {
    commands.push(
      "cargo fmt --manifest-path src-tauri/Cargo.toml -- --check",
      "cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets --locked -- -D warnings",
      "pnpm rust:windows:check",
      "pnpm gate:ensure backend-test",
      "pnpm gate:ensure backend-coverage",
    );
  }
  commands.push("pnpm gates:contract:check", "pnpm findings:kit:check");
  if (selected.has("frontend")) {
    commands.push(
      "pnpm gate:ensure frontend-coverage",
      "pnpm bundle:check",
      "pnpm gate:ensure e2e-container",
      "pnpm gate:ensure frontend-mutation",
    );
  }
  return commands;
}

async function makeHarness(
  t,
  { commands = {}, omittedExecutables = [], budgetBytes = 7 * GIB, barrierLanes = [] } = {},
) {
  const root = await mkdtemp(join("/tmp", "push-gates-cli-"));
  const bin = join(root, "bin");
  const state = join(root, "state");
  const configPath = join(root, "fake-config.json");
  await mkdir(bin);
  await mkdir(state);
  await writeFile(configPath, JSON.stringify({ commands }));
  const helperPath = join(root, "fake-command.mjs");
  await writeFile(helperPath, FAKE_COMMAND);
  await symlink("/usr/bin/env", join(bin, "env"));

  for (const executable of ["pnpm", "cargo", "bash"]) {
    if (omittedExecutables.includes(executable)) continue;
    const shimPath = join(bin, executable);
    await writeFile(
      shimPath,
      `#!/bin/sh\nexec ${shellQuote(process.execPath)} ${shellQuote(helperPath)} "$0" "$@"\n`,
    );
    await chmod(shimPath, 0o755);
  }
  t.after(async () => rm(root, { recursive: true, force: true }));
  return {
    root,
    bin,
    state,
    configPath,
    env: {
      ...process.env,
      PATH: bin,
      FAKE_BIN: bin,
      FAKE_STATE: state,
      FAKE_CONFIG: configPath,
      FAKE_BARRIER_DIR: join(state, "barrier"),
      FAKE_BARRIER_LANES: barrierLanes.join(","),
      GATE_MEMORY_BYTES: String(budgetBytes),
    },
  };
}

async function readEvents(harness) {
  try {
    const source = await readFile(join(harness.state, "events.jsonl"), "utf8");
    return source
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line));
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
}

async function waitForEvent(harness, predicate, timeoutMs = EVENT_WAIT_TIMEOUT_MS) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const event = (await readEvents(harness)).find(predicate);
    if (event) return event;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  assert.fail(`Timed out waiting for a fake gate event after ${timeoutMs} ms`);
}

function groupExists(pid) {
  try {
    process.kill(-pid, 0);
    return true;
  } catch (error) {
    if (error.code === "ESRCH") return false;
    return true;
  }
}

function signalGroup(pid, signal) {
  try {
    process.kill(-pid, signal);
  } catch (error) {
    if (error.code !== "ESRCH") throw error;
  }
}

function startCli(t, harness, args = []) {
  const child = spawn(process.execPath, [runnerPath, ...args], {
    cwd: harness.root,
    env: harness.env,
    detached: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (chunk) => (stdout += chunk));
  child.stderr.on("data", (chunk) => (stderr += chunk));
  const done = new Promise((resolve) => {
    child.once("close", (code, signal) => resolve({ code, signal, stdout, stderr }));
  });
  t.after(async () => {
    if (child.exitCode === null && child.signalCode === null) {
      child.kill("SIGTERM");
      let cleanupTimer;
      const finished = await Promise.race([
        done.then(() => true),
        new Promise((resolve) => {
          cleanupTimer = setTimeout(() => resolve(false), CHILD_CLEANUP_TIMEOUT_MS);
          cleanupTimer.unref();
        }),
      ]);
      clearTimeout(cleanupTimer);
      if (!finished) {
        try {
          process.kill(-child.pid, "SIGKILL");
        } catch (error) {
          if (error.code !== "ESRCH") throw error;
        }
        await done;
      }
    }
    const events = await readEvents(harness);
    const started = events.filter((event) => event.type === "start");
    const finishedPids = new Set(
      events.filter((event) => event.type === "finish").map((event) => event.pid),
    );
    for (const event of started) {
      if (finishedPids.has(event.pid) || !groupExists(event.pid)) continue;
      signalGroup(event.pid, "SIGTERM");
      signalGroup(event.pid, "SIGKILL");
    }
  });
  return { child, done };
}

async function runCli(t, harness, args = []) {
  return startCli(t, harness, args).done;
}

function commandSet(events) {
  return events
    .filter((event) => event.type === "start")
    .map((event) => event.command)
    .sort();
}

function at(event) {
  return BigInt(event.at);
}

function sortedEvents(events, predicate) {
  return events.filter(predicate).sort((left, right) => (at(left) < at(right) ? -1 : 1));
}

function cliCommandStart(events, command) {
  return events.find((event) => event.type === "start" && event.command === command);
}

function cliCommandFinish(events, command) {
  return events.find((event) => event.type === "finish" && event.command === command);
}

function laneForCommand(command) {
  return new Map([
    ["pnpm gates:contract:check", "contract"],
    ["cargo fmt --manifest-path src-tauri/Cargo.toml -- --check", "rust-lint"],
    ["pnpm gate:ensure backend-test", "rust-test"],
    ["pnpm gate:ensure backend-coverage", "rust-coverage"],
    ["pnpm gate:ensure frontend-coverage", "frontend-coverage"],
    ["pnpm bundle:check", "bundle"],
    ["pnpm gate:ensure frontend-mutation", "frontend-mutation"],
  ]).get(command);
}

function makeMockSpawner({ exits = {}, events = [] } = {}) {
  return (executable, args, options) => {
    assert.equal(options.shell, undefined, "scheduled commands must spawn without a shell");
    const command = [executable, ...args].join(" ");
    events.push({ type: "start", command, env: options.env, options });
    const child = new EventEmitter();
    child.stdout = new PassThrough();
    child.stderr = new PassThrough();
    child.pid = undefined;
    child.exitCode = null;
    child.signalCode = null;
    child.kill = () => false;
    setImmediate(() => {
      const code = exits[command] ?? 0;
      child.exitCode = code;
      child.stdout.end();
      child.stderr.end();
      events.push({ type: "finish", command, code });
      child.emit("close", code, null);
    });
    return child;
  };
}

async function temporarySchedulerRoot(t) {
  const root = await mkdtemp(join("/tmp", "push-gates-scheduler-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  return root;
}

test("CLI selection matrix, leading delimiter, and phase ordering (PG-60, PG-64, PG-66, PG-78, PG-88, PG-104)", async (t) => {
  const cases = [
    { name: "no flags", flags: [], expected: scheduledFakeCommands([]) },
    { name: "rust", flags: ["--rust"], expected: scheduledFakeCommands(["rust"]) },
    { name: "frontend", flags: ["--frontend"], expected: scheduledFakeCommands(["frontend"]) },
    { name: "bindings", flags: ["--bindings"], expected: scheduledFakeCommands(["bindings"]) },
    {
      name: "rust plus frontend",
      flags: ["--rust", "--frontend"],
      expected: scheduledFakeCommands(["rust", "frontend"]),
    },
    {
      name: "rust plus bindings",
      flags: ["--rust", "--bindings"],
      expected: scheduledFakeCommands(["rust", "bindings"]),
    },
    {
      name: "frontend plus bindings",
      flags: ["--frontend", "--bindings"],
      expected: scheduledFakeCommands(["frontend", "bindings"]),
    },
    {
      name: "all blocks",
      flags: ["--rust", "--frontend", "--bindings"],
      expected: scheduledFakeCommands(["rust", "frontend", "bindings"]),
    },
  ];
  for (const entry of cases) {
    await t.test(entry.name, async (subtest) => {
      const harness = await makeHarness(subtest);
      const result = await runCli(subtest, harness, entry.flags);
      assert.equal(result.code, 0, `${result.stdout}\n${result.stderr}`);
      assert.deepEqual(commandSet(await readEvents(harness)), [...entry.expected].sort());

      const events = await readEvents(harness);
      const guardFinish = cliCommandFinish(events, "pnpm mutation:guard:check");
      if (entry.flags.includes("--rust")) {
        const clippy = events.find(
          (event) => event.type === "start" && event.command.startsWith("cargo clippy "),
        );
        assert.deepEqual(clippy.args, [
          "clippy",
          "--manifest-path",
          "src-tauri/Cargo.toml",
          "--all-targets",
          "--locked",
          "--",
          "-D",
          "warnings",
        ]);
      }
      const laneStart = sortedEvents(
        events,
        (event) => event.type === "start" && laneForCommand(event.command),
      )[0];
      const p1Commands =
        entry.flags.length > 0
          ? [
              "pnpm gate:run frontend-build",
              ...(entry.flags.includes("--bindings") ? ["pnpm bindings:check"] : []),
            ]
          : [];
      if (entry.flags.includes("--rust") || entry.flags.includes("--bindings")) {
        const setupStart = cliCommandStart(events, "bash scripts/setup-rust.sh");
        const setupFinish = cliCommandFinish(events, "bash scripts/setup-rust.sh");
        const buildStart = cliCommandStart(events, "pnpm gate:run frontend-build");
        assert.ok(at(guardFinish) < at(setupStart));
        assert.ok(at(setupFinish) < at(buildStart));
      } else if (entry.flags.includes("--frontend")) {
        assert.ok(at(guardFinish) < at(cliCommandStart(events, "pnpm gate:run frontend-build")));
      }
      if (entry.flags.includes("--bindings")) {
        assert.ok(
          at(cliCommandFinish(events, "pnpm gate:run frontend-build")) <
            at(cliCommandStart(events, "pnpm bindings:check")),
        );
      }
      if (laneStart && p1Commands.length) {
        for (const command of p1Commands) {
          const finished = cliCommandFinish(events, command);
          assert.ok(finished, `${command} should finish before P2 starts`);
          assert.ok(at(finished) < at(laneStart), `${command} overlapped the first P2 lane`);
        }
      } else if (laneStart) {
        assert.ok(at(guardFinish) < at(laneStart), "P0 guard must finish before the contract lane");
      }
    });
  }

  await t.test("leading pnpm delimiter", async (subtest) => {
    const harness = await makeHarness(subtest);
    const result = await runCli(subtest, harness, ["--", "--rust"]);
    assert.equal(result.code, 0, `${result.stdout}\n${result.stderr}`);
    assert.deepEqual(commandSet(await readEvents(harness)), scheduledFakeCommands(["rust"]).sort());
  });

  await t.test(
    "bindings-only and rust-only rebuild dist despite an existing directory",
    async (subtest) => {
      for (const flags of [["--bindings"], ["--rust"]]) {
        const harness = await makeHarness(subtest);
        await mkdir(join(harness.root, "dist"));
        await writeFile(join(harness.root, "dist", "old-marker"), "from another tree");
        const result = await runCli(subtest, harness, flags);
        assert.equal(result.code, 0, `${result.stdout}\n${result.stderr}`);
        const events = await readEvents(harness);
        const buildFinish = cliCommandFinish(events, "pnpm gate:run frontend-build");
        assert.ok(buildFinish, "the P1 frontend build must run");
        const consumer =
          flags[0] === "--bindings"
            ? "pnpm bindings:check"
            : "cargo fmt --manifest-path src-tauri/Cargo.toml -- --check";
        assert.ok(at(buildFinish) < at(cliCommandStart(events, consumer)));
      }
    },
  );
});

test("contract-only invocation, unknown flags, and P0 guard failure/spawn failure (PG-81, PG-82, PG-83, PG-89)", async (t) => {
  await t.test("no flags runs only the mutation guard and contract lane", async (subtest) => {
    const harness = await makeHarness(subtest);
    const result = await runCli(subtest, harness);
    assert.equal(result.code, 0, `${result.stdout}\n${result.stderr}`);
    assert.deepEqual(commandSet(await readEvents(harness)), scheduledFakeCommands([]).sort());
  });

  await t.test("unknown flag exits 2 before spawning anything", async (subtest) => {
    const harness = await makeHarness(subtest);
    const result = await runCli(subtest, harness, ["--unexpected"]);
    assert.equal(result.code, 2);
    assert.match(result.stderr, /Unknown argument .*--unexpected/u);
    assert.deepEqual(await readEvents(harness), []);
  });

  await t.test(
    "failed mutation guard stops all later commands with its exit code",
    async (subtest) => {
      const harness = await makeHarness(subtest, {
        commands: { "pnpm mutation:guard:check": { exitCode: 7 } },
      });
      const result = await runCli(subtest, harness, ["--rust", "--frontend", "--bindings"]);
      assert.equal(result.code, 7, `${result.stdout}\n${result.stderr}`);
      assert.deepEqual(commandSet(await readEvents(harness)), ["pnpm mutation:guard:check"]);
    },
  );

  await t.test(
    "missing mutation-guard executable exits 127 and starts nothing else",
    async (subtest) => {
      const harness = await makeHarness(subtest, { omittedExecutables: ["pnpm"] });
      const result = await runCli(subtest, harness, ["--rust", "--frontend", "--bindings"]);
      assert.equal(result.code, 127, `${result.stdout}\n${result.stderr}`);
      assert.match(result.stdout, /spawn pnpm ENOENT/u);
      assert.deepEqual(await readEvents(harness), []);
    },
  );
});

test("P1 failures skip only their consumers and preserve independent lanes (PG-63, PG-75, PG-76, PG-80, PG-91)", async (t) => {
  await t.test(
    "frontend-build failure skips its dist consumers while independent lanes run",
    async (subtest) => {
      const harness = await makeHarness(subtest, {
        commands: { "pnpm gate:run frontend-build": { exitCode: 9 } },
      });
      const result = await runCli(subtest, harness, ["--rust", "--frontend", "--bindings"]);
      assert.equal(result.code, 9, `${result.stdout}\n${result.stderr}`);
      const commands = commandSet(await readEvents(harness));
      for (const command of [
        "pnpm bindings:check",
        "cargo fmt --manifest-path src-tauri/Cargo.toml -- --check",
        "pnpm gate:ensure backend-test",
        "pnpm gate:ensure backend-coverage",
        "pnpm bundle:check",
      ])
        assert.ok(!commands.includes(command), `${command} consumes the failed dist build`);
      for (const command of [
        "pnpm gates:contract:check",
        "pnpm gate:ensure frontend-coverage",
        "pnpm gate:ensure frontend-mutation",
        "pnpm gate:ensure e2e-container",
      ])
        assert.ok(commands.includes(command), `${command} is independent of P1 dist`);
    },
  );

  await t.test("bindings-check failure does not skip another lane", async (subtest) => {
    const harness = await makeHarness(subtest, {
      commands: { "pnpm bindings:check": { exitCode: 5 } },
    });
    const result = await runCli(subtest, harness, ["--rust", "--frontend", "--bindings"]);
    assert.equal(result.code, 5, `${result.stdout}\n${result.stderr}`);
    const commands = commandSet(await readEvents(harness));
    for (const command of [
      "pnpm gates:contract:check",
      "cargo fmt --manifest-path src-tauri/Cargo.toml -- --check",
      "pnpm gate:ensure backend-test",
      "pnpm gate:ensure backend-coverage",
      "pnpm gate:ensure frontend-coverage",
      "pnpm bundle:check",
      "pnpm gate:ensure e2e-container",
      "pnpm gate:ensure frontend-mutation",
    ]) {
      assert.ok(
        commands.includes(command),
        `${command} must not be skipped after bindings:check fails`,
      );
    }
    assert.deepEqual(
      commands.filter((command) => command === "pnpm bindings:check"),
      ["pnpm bindings:check"],
    );
  });

  await t.test(
    "setup-rust failure skips bindings and Rust lanes but keeps frontend lanes",
    async (subtest) => {
      const harness = await makeHarness(subtest, {
        commands: { "bash scripts/setup-rust.sh": { exitCode: 6 } },
      });
      const result = await runCli(subtest, harness, ["--rust", "--frontend", "--bindings"]);
      assert.equal(result.code, 6, `${result.stdout}\n${result.stderr}`);
      const commands = commandSet(await readEvents(harness));
      for (const command of [
        "pnpm bindings:check",
        "cargo fmt --manifest-path src-tauri/Cargo.toml -- --check",
        "pnpm gate:ensure backend-test",
        "pnpm gate:ensure backend-coverage",
      ])
        assert.ok(!commands.includes(command), `${command} requires setup-rust`);
      for (const command of [
        "pnpm gates:contract:check",
        "pnpm gate:ensure frontend-coverage",
        "pnpm bundle:check",
        "pnpm gate:ensure e2e-container",
        "pnpm gate:ensure frontend-mutation",
      ])
        assert.ok(commands.includes(command), `${command} must remain independent`);
    },
  );

  await t.test(
    "missing frontend-build executable reports 127 and skips consumers",
    async (subtest) => {
      const harness = await makeHarness(subtest, {
        commands: { "pnpm mutation:guard:check": { removeExecutable: "pnpm" } },
      });
      const result = await runCli(subtest, harness, ["--frontend"]);
      assert.equal(result.code, 127, `${result.stdout}\n${result.stderr}`);
      assert.match(result.stdout, /spawn pnpm ENOENT/u);
      assert.match(result.stdout, /bundle\s+skipped/u);
      const events = await readEvents(harness);
      assert.ok(!commandSet(events).includes("pnpm bundle:check"));
      assert.ok(!cliCommandFinish(events, "pnpm gate:run frontend-build"));
    },
  );

  await t.test(
    "missing setup-rust executable skips Rust consumers but runs contract and frontend",
    async (subtest) => {
      const harness = await makeHarness(subtest, { omittedExecutables: ["bash"] });
      const result = await runCli(subtest, harness, ["--rust", "--frontend", "--bindings"]);
      assert.equal(result.code, 127, `${result.stdout}\n${result.stderr}`);
      assert.match(result.stdout, /spawn bash ENOENT/u);
      const commands = commandSet(await readEvents(harness));
      for (const command of [
        "pnpm bindings:check",
        "cargo fmt --manifest-path src-tauri/Cargo.toml -- --check",
      ]) {
        assert.ok(!commands.includes(command));
      }
      for (const command of [
        "pnpm gates:contract:check",
        "pnpm gate:ensure frontend-coverage",
        "pnpm gate:ensure e2e-container",
      ]) {
        assert.ok(commands.includes(command));
      }
    },
  );
});

test("spawn failures, signals and SIGKILL codes propagate from P0, P1 and lanes (PG-55, PG-65, PG-68, PG-77, PG-80)", async (t) => {
  await t.test("missing lane executable fails its lane with 127", async (subtest) => {
    const harness = await makeHarness(subtest, {
      commands: { "pnpm gate:run frontend-build": { removeExecutable: "cargo" } },
    });
    const result = await runCli(subtest, harness, ["--rust"]);
    assert.notEqual(result.code, 0);
    assert.equal(result.code, 127);
    assert.match(result.stdout, /spawn cargo ENOENT/u);
  });

  for (const [name, args, command] of [
    ["setup-rust P0", ["--rust"], "bash scripts/setup-rust.sh"],
    ["frontend-build P1", ["--frontend"], "pnpm gate:run frontend-build"],
    ["rust-lint lane", ["--rust"], "cargo fmt --manifest-path src-tauri/Cargo.toml -- --check"],
  ]) {
    await t.test(`${name} SIGKILL maps to 137`, async (subtest) => {
      const harness = await makeHarness(subtest, {
        commands: { [command]: { killSelf: "SIGKILL" } },
      });
      const result = await runCli(subtest, harness, args);
      assert.equal(result.code, 137, `${result.stdout}\n${result.stderr}`);
      assert.match(result.stdout, /exit=137|\s137\s/u);
    });
  }

  for (const [signal, expectedCode, args, command] of [
    ["SIGTERM", 143, ["--rust"], "bash scripts/setup-rust.sh"],
    ["SIGTERM", 143, ["--frontend"], "pnpm gate:run frontend-build"],
  ]) {
    await t.test(
      `${signal} during ${command} latches and starts no later command`,
      async (subtest) => {
        const harness = await makeHarness(subtest, { commands: { [command]: { hold: true } } });
        const running = startCli(subtest, harness, args);
        const started = await waitForEvent(
          harness,
          (event) => event.type === "start" && event.command === command,
        );
        running.child.kill(signal);
        const result = await running.done;
        assert.equal(result.code, expectedCode, `${result.stdout}\n${result.stderr}`);
        const commands = commandSet(await readEvents(harness));
        assert.deepEqual(
          commands,
          (args[0] === "--rust"
            ? ["pnpm mutation:guard:check", command]
            : ["pnpm mutation:guard:check", command]
          ).sort(),
        );
        assert.equal(
          groupExists(started.pid),
          false,
          "the signalled fake process group must be gone",
        );
      },
    );
  }

  for (const [signal, expectedCode] of [
    ["SIGINT", 130],
    ["SIGTERM", 143],
  ]) {
    await t.test(
      `${signal} sent by a P1 fake that exits 0 prevents every later step`,
      async (subtest) => {
        const command = "pnpm gate:run frontend-build";
        const harness = await makeHarness(subtest, {
          commands: { [command]: { signalRunner: signal, signalExitCode: 0 } },
        });
        const result = await runCli(subtest, harness, ["--frontend"]);
        assert.equal(result.code, expectedCode, `${result.stdout}\n${result.stderr}`);
        const events = await readEvents(harness);
        assert.deepEqual(commandSet(events), ["pnpm mutation:guard:check", command].sort());
        assert.equal(cliCommandFinish(events, command).code, 0);
      },
    );
  }

  for (const signal of ["SIGTERM", "SIGINT"]) {
    await t.test(
      `${signal} during a running lane leaves no child process group alive`,
      async (subtest) => {
        const harness = await makeHarness(subtest, {
          commands: { "pnpm gate:ensure frontend-coverage": { hold: true } },
        });
        const running = startCli(subtest, harness, ["--frontend"]);
        const started = await waitForEvent(
          harness,
          (event) =>
            event.type === "start" && event.command === "pnpm gate:ensure frontend-coverage",
        );
        running.child.kill(signal);
        const result = await running.done;
        assert.equal(
          result.code,
          signal === "SIGINT" ? 130 : 143,
          `${result.stdout}\n${result.stderr}`,
        );
        assert.equal(groupExists(started.pid), false);
      },
    );
  }
});

test("lane command order, exit precedence, logs, e2e ordering and all-lane completion (PG-55, PG-56, PG-69, PG-70, PG-72, PG-74)", async (t) => {
  await t.test(
    "rust-lint stops at its first failing command and preserves its code",
    async (subtest) => {
      const first = "cargo fmt --manifest-path src-tauri/Cargo.toml -- --check";
      const harness = await makeHarness(subtest, { commands: { [first]: { exitCode: 11 } } });
      const result = await runCli(subtest, harness, ["--rust"]);
      assert.equal(result.code, 11, `${result.stdout}\n${result.stderr}`);
      const commands = commandSet(await readEvents(harness));
      assert.ok(commands.includes(first));
      assert.ok(
        !commands.includes(
          "cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets --locked -- -D warnings",
        ),
      );
      assert.ok(!commands.includes("pnpm rust:windows:check"));
    },
  );

  await t.test(
    "e2e starts only after bundle finishes, and never overlaps cargo lanes",
    async (subtest) => {
      const harness = await makeHarness(subtest, {
        budgetBytes: ONE_WAVE_BYTES + GIB,
        commands: {
          "cargo fmt --manifest-path src-tauri/Cargo.toml -- --check": { delayMs: 120 },
          "cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets --locked -- -D warnings":
            { delayMs: 120 },
          "pnpm rust:windows:check": { delayMs: 120 },
          "pnpm gate:ensure backend-test": { delayMs: 120 },
          "pnpm gate:ensure backend-coverage": { delayMs: 120 },
          "pnpm bundle:check": { delayMs: 120 },
          "pnpm gate:ensure e2e-container": { delayMs: 10 },
        },
      });
      const result = await runCli(subtest, harness, ["--rust", "--frontend"]);
      assert.equal(result.code, 0, `${result.stdout}\n${result.stderr}`);
      const events = await readEvents(harness);
      const e2eStart = cliCommandStart(events, "pnpm gate:ensure e2e-container");
      const bundleFinish = cliCommandFinish(events, "pnpm bundle:check");
      assert.ok(at(bundleFinish) < at(e2eStart));
      const rustLaneLast = [
        "pnpm rust:windows:check",
        "pnpm gate:ensure backend-test",
        "pnpm gate:ensure backend-coverage",
      ].map((command) => cliCommandFinish(events, command));
      assert.ok(rustLaneLast.every(Boolean));
      assert.ok(rustLaneLast.every((finish) => at(finish) < at(e2eStart)));
    },
  );

  await t.test(
    "every other lane completes and after-P2 lanes start after bundle fails",
    async (subtest) => {
      const harness = await makeHarness(subtest, {
        commands: { "pnpm bundle:check": { exitCode: 8, delayMs: 50 } },
      });
      const result = await runCli(subtest, harness, ["--rust", "--frontend"]);
      assert.equal(result.code, 8, `${result.stdout}\n${result.stderr}`);
      const events = await readEvents(harness);
      for (const command of [
        "pnpm gates:contract:check",
        "pnpm gate:ensure backend-test",
        "pnpm gate:ensure backend-coverage",
        "pnpm gate:ensure frontend-coverage",
        "pnpm bundle:check",
        "pnpm gate:ensure e2e-container",
        "pnpm gate:ensure frontend-mutation",
      ])
        assert.ok(cliCommandFinish(events, command), `${command} did not complete`);
      assert.ok(
        at(cliCommandFinish(events, "pnpm bundle:check")) <
          at(cliCommandStart(events, "pnpm gate:ensure e2e-container")),
      );
      assert.ok(
        at(cliCommandFinish(events, "pnpm bundle:check")) <
          at(cliCommandStart(events, "pnpm gate:ensure frontend-mutation")),
      );
    },
  );

  await t.test("a failed cargo lane still lets e2e and frontend mutation run", async (subtest) => {
    const cargoCommand = "cargo fmt --manifest-path src-tauri/Cargo.toml -- --check";
    const harness = await makeHarness(subtest, {
      commands: { [cargoCommand]: { exitCode: 12 } },
    });
    const result = await runCli(subtest, harness, ["--rust", "--frontend"]);
    assert.equal(result.code, 12, `${result.stdout}\n${result.stderr}`);
    const events = await readEvents(harness);
    assert.equal(cliCommandFinish(events, cargoCommand).code, 12);
    for (const command of [
      "pnpm gate:ensure e2e-container",
      "pnpm gate:ensure frontend-mutation",
    ]) {
      assert.ok(
        cliCommandStart(events, command),
        `${command} must still start after the cargo failure`,
      );
      assert.ok(
        cliCommandFinish(events, command),
        `${command} must still complete after the cargo failure`,
      );
    }
  });

  await t.test("P0/P1 failures take exit precedence over lane failures", async (subtest) => {
    const harness = await makeHarness(subtest, {
      commands: {
        "bash scripts/setup-rust.sh": { exitCode: 4 },
        "pnpm gates:contract:check": { exitCode: 7 },
      },
    });
    const result = await runCli(subtest, harness, ["--rust"]);
    assert.equal(result.code, 4, `${result.stdout}\n${result.stderr}`);
  });

  await t.test(
    "P1 failure takes exit precedence and the first failed lane follows table order",
    async (subtest) => {
      const buildCommand = "pnpm gate:run frontend-build";
      const contractCommand = "pnpm gates:contract:check";
      const cargoCommand = "cargo fmt --manifest-path src-tauri/Cargo.toml -- --check";
      const harness = await makeHarness(subtest, {
        commands: {
          [buildCommand]: { exitCode: 4 },
          [contractCommand]: { exitCode: 7 },
          [cargoCommand]: { exitCode: 11 },
        },
      });
      const result = await runCli(subtest, harness, ["--rust", "--frontend"]);
      assert.equal(result.code, 4, `${result.stdout}\n${result.stderr}`);
      const events = await readEvents(harness);
      assert.equal(cliCommandFinish(events, contractCommand).code, 7);
      assert.equal(
        cliCommandFinish(events, cargoCommand),
        undefined,
        "failed P1 skips cargo consumers",
      );

      const laneHarness = await makeHarness(subtest, {
        commands: {
          [contractCommand]: { exitCode: 7 },
          [cargoCommand]: { exitCode: 11 },
        },
      });
      const laneResult = await runCli(subtest, laneHarness, ["--rust"]);
      assert.equal(laneResult.code, 7, `${laneResult.stdout}\n${laneResult.stderr}`);
      const laneEvents = await readEvents(laneHarness);
      assert.equal(cliCommandFinish(laneEvents, contractCommand).code, 7);
      assert.equal(cliCommandFinish(laneEvents, cargoCommand).code, 11);
    },
  );

  await t.test(
    "logs contain command output, summary statuses, and failed-lane tails",
    async (subtest) => {
      const harness = await makeHarness(subtest, {
        commands: { "pnpm bundle:check": { exitCode: 13 } },
      });
      const result = await runCli(subtest, harness, ["--rust", "--frontend", "--bindings"]);
      assert.equal(result.code, 13);
      const directories = await readdir(join(harness.root, "artifacts", "gates"));
      assert.equal(directories.length, 1);
      const bundleLog = await readFile(
        join(harness.root, "artifacts", "gates", directories[0], "bundle.log"),
        "utf8",
      );
      assert.match(bundleLog, /fake-output:pnpm:bundle:check/u);
      for (const lane of [
        "contract",
        "rust-lint",
        "rust-test",
        "rust-coverage",
        "frontend-coverage",
        "bundle",
        "e2e",
        "frontend-mutation",
      ]) {
        assert.match(result.stdout, new RegExp(`${lane}\\s+(?:passed|failed|skipped)`, "u"));
      }
      const logForCommand = new Map([
        ["pnpm mutation:guard:check", "mutation-guard"],
        ["bash scripts/setup-rust.sh", "setup-rust"],
        ["pnpm gate:run frontend-build", "frontend-build"],
        ["pnpm bindings:check", "bindings-check"],
        ["pnpm gates:contract:check", "contract"],
        ["pnpm findings:kit:check", "contract"],
        ["cargo fmt --manifest-path src-tauri/Cargo.toml -- --check", "rust-lint"],
        [
          "cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets --locked -- -D warnings",
          "rust-lint",
        ],
        ["pnpm rust:windows:check", "rust-lint"],
        ["pnpm gate:ensure backend-test", "rust-test"],
        ["pnpm gate:ensure backend-coverage", "rust-coverage"],
        ["pnpm gate:ensure frontend-coverage", "frontend-coverage"],
        ["pnpm bundle:check", "bundle"],
        ["pnpm gate:ensure e2e-container", "e2e"],
        ["pnpm gate:ensure frontend-mutation", "frontend-mutation"],
      ]);
      for (const event of (await readEvents(harness)).filter((entry) => entry.type === "start")) {
        const taskName = logForCommand.get(event.command);
        assert.ok(taskName, `missing log mapping for ${event.command}`);
        const output = `fake-output:${event.executable}:${event.args.join("|")}`;
        const laneLog = await readFile(
          join(harness.root, "artifacts", "gates", directories[0], `${taskName}.log`),
          "utf8",
        );
        assert.ok(laneLog.includes(output), `${taskName}.log is missing ${output}`);
      }
      assert.match(result.stdout, /bundle log tail/u);
      assert.match(result.stdout, /fake-output:pnpm:bundle:check/u);
    },
  );
});

test("P2 memory/CPU placement, concurrency anchor and cgroup-read guards (PG-47, PG-50, PG-58, PG-59, PG-85, PG-118)", async (t) => {
  await t.test("all eligible all-blocks P2 lanes rendezvous concurrently", async (subtest) => {
    const barrierLanes = [
      "contract",
      "rust-lint",
      "rust-test",
      "rust-coverage",
      "frontend-coverage",
      "bundle",
    ];
    if (availableParallelism() >= 2) barrierLanes.push("frontend-mutation");
    const commands = {};
    for (const lane of barrierLanes) {
      const command = {
        contract: "pnpm gates:contract:check",
        "rust-lint": "cargo fmt --manifest-path src-tauri/Cargo.toml -- --check",
        "rust-test": "pnpm gate:ensure backend-test",
        "rust-coverage": "pnpm gate:ensure backend-coverage",
        "frontend-coverage": "pnpm gate:ensure frontend-coverage",
        bundle: "pnpm bundle:check",
        "frontend-mutation": "pnpm gate:ensure frontend-mutation",
      }[lane];
      commands[command] = { barrierLane: lane };
    }
    const harness = await makeHarness(subtest, {
      budgetBytes: ONE_WAVE_BYTES + 5 * GIB,
      barrierLanes,
      commands,
    });
    const result = await runCli(subtest, harness, ["--rust", "--frontend", "--bindings"]);
    assert.equal(result.code, 0, `${result.stdout}\n${result.stderr}`);
    const markers = await readdir(join(harness.state, "barrier"));
    assert.deepEqual(markers.sort(), barrierLanes.sort());
  });

  await t.test("mutation runs after P2 below ONE_WAVE_BYTES", async (subtest) => {
    const harness = await makeHarness(subtest, { budgetBytes: ONE_WAVE_BYTES - 1 });
    const result = await runCli(subtest, harness, ["--frontend"]);
    assert.equal(result.code, 0, `${result.stdout}\n${result.stderr}`);
    const events = await readEvents(harness);
    const mutationStart = cliCommandStart(events, "pnpm gate:ensure frontend-mutation");
    for (const command of [
      "pnpm gates:contract:check",
      "pnpm gate:ensure frontend-coverage",
      "pnpm bundle:check",
      "pnpm gate:ensure e2e-container",
    ]) {
      assert.ok(
        at(cliCommandFinish(events, command)) < at(mutationStart),
        `${command} must finish before mutation`,
      );
    }
  });

  await t.test(
    "scheduler CPU seam keeps mutation after P2 at one CPU despite a large budget",
    async (subtest) => {
      const cwd = await temporarySchedulerRoot(subtest);
      const events = [];
      const spawnProcess = makeMockSpawner({ events });
      const result = await runPushGates(["--frontend"], {
        cwd,
        env: { ...process.env, GATE_MEMORY_BYTES: String(ONE_WAVE_BYTES * 2) },
        getGateBudgetBytes: () => ONE_WAVE_BYTES * 2,
        availableParallelism: () => 1,
        spawnProcess,
      });
      assert.equal(result.exitCode, 0);
      const mutationIndex = events.findIndex(
        (event) => event.type === "start" && event.command === "pnpm gate:ensure frontend-mutation",
      );
      const lastP2Finish = Math.max(
        ...events.map((event, index) =>
          event.type === "finish" &&
          [
            "pnpm gates:contract:check",
            "pnpm gate:ensure frontend-coverage",
            "pnpm bundle:check",
            "pnpm gate:ensure e2e-container",
          ].includes(event.command)
            ? index
            : -1,
        ),
      );
      assert.ok(mutationIndex > lastP2Finish);
      const mutation = events.find(
        (event) => event.type === "start" && event.command === "pnpm gate:ensure frontend-mutation",
      );
      const coverage = events.find(
        (event) => event.type === "start" && event.command === "pnpm gate:ensure frontend-coverage",
      );
      assert.equal(mutation.env.GATE_MEMORY_BYTES, String(ONE_WAVE_BYTES * 2));
      assert.equal(mutation.env.GATE_CPU_SHARE, "1");
      assert.equal(coverage.env.GATE_MEMORY_BYTES, String(ONE_WAVE_BYTES * 2));
      assert.equal(coverage.env.GATE_CPU_SHARE, "1");
    },
  );

  await t.test(
    "1, 2 and 24 CPU schedules pass the intended shares to self-sizing lanes",
    async (subtest) => {
      for (const cpuCount of [1, 2, 24]) {
        const cwd = await temporarySchedulerRoot(subtest);
        const events = [];
        const budget = ONE_WAVE_BYTES * 2;
        const result = await runPushGates(["--frontend"], {
          cwd,
          env: { ...process.env, GATE_MEMORY_BYTES: String(budget) },
          getGateBudgetBytes: () => budget,
          availableParallelism: () => cpuCount,
          spawnProcess: makeMockSpawner({ events }),
        });
        assert.equal(result.exitCode, 0, `CPU count ${cpuCount}`);
        const coverage = events.find(
          (event) =>
            event.type === "start" && event.command === "pnpm gate:ensure frontend-coverage",
        );
        const mutation = events.find(
          (event) =>
            event.type === "start" && event.command === "pnpm gate:ensure frontend-mutation",
        );
        if (cpuCount === 1) {
          const e2eFinish = events.find(
            (event) =>
              event.type === "finish" && event.command === "pnpm gate:ensure e2e-container",
          );
          const mutationStart = events.find(
            (event) =>
              event.type === "start" && event.command === "pnpm gate:ensure frontend-mutation",
          );
          assert.ok(events.indexOf(e2eFinish) < events.indexOf(mutationStart));
          assert.equal(mutation.env.GATE_CPU_SHARE, "1");
          assert.equal(coverage.env.GATE_CPU_SHARE, "1");
        } else {
          assert.equal(mutation.env.GATE_CPU_SHARE, "0.5");
          assert.equal(coverage.env.GATE_CPU_SHARE, "0.5");
          const coverageWorkers = workerCount({
            perWorkerBytes: 1,
            budgetBytes: budget,
            env: { GATE_CPU_SHARE: coverage.env.GATE_CPU_SHARE },
            availableParallelism: () => cpuCount,
          });
          const mutationWorkers = workerCount({
            perWorkerBytes: 1,
            budgetBytes: budget,
            env: { GATE_CPU_SHARE: mutation.env.GATE_CPU_SHARE },
            availableParallelism: () => cpuCount,
          });
          assert.ok(coverageWorkers + mutationWorkers <= cpuCount);
        }
      }
    },
  );

  await t.test(
    "gate budget and CPU detection are not read for contract, Rust, or bindings-only runs",
    async (subtest) => {
      for (const flags of [[], ["--rust"], ["--bindings"]]) {
        const cwd = await temporarySchedulerRoot(subtest);
        let budgetReads = 0;
        let cpuReads = 0;
        const result = await runPushGates(flags, {
          cwd,
          env: { ...process.env },
          getGateBudgetBytes() {
            budgetReads += 1;
            throw new Error("injected unreadable cgroup");
          },
          availableParallelism() {
            cpuReads += 1;
            throw new Error("must not read CPUs without self-sizing lanes");
          },
          spawnProcess: makeMockSpawner(),
        });
        assert.equal(result.exitCode, 0);
        assert.equal(budgetReads, 0);
        assert.equal(cpuReads, 0);
      }
    },
  );
});

test("scheduler-level beforeStep cancellation and injected spawn failures (PG-51, PG-55, PG-58)", async (t) => {
  for (const [signal, expectedCode] of [
    ["SIGINT", 130],
    ["SIGTERM", 143],
  ]) {
    await t.test(
      `beforeStep ${signal} after guard completion prevents setup-rust spawn`,
      async (subtest) => {
        const cwd = await temporarySchedulerRoot(subtest);
        const events = [];
        const beforeStepNames = [];
        const result = await runPushGates(["--rust"], {
          cwd,
          env: { ...process.env },
          spawnProcess: makeMockSpawner({ events }),
          async beforeStep({ name }) {
            beforeStepNames.push(name);
            if (name === "setup-rust") process.emit(signal, signal);
          },
        });
        assert.equal(result.exitCode, expectedCode, JSON.stringify(result));
        assert.deepEqual(beforeStepNames, ["mutation-guard", "setup-rust"]);
        assert.deepEqual(
          events.filter((event) => event.type === "start").map((event) => event.command),
          ["pnpm mutation:guard:check"],
        );
      },
    );
  }

  await t.test("injected spawn ENOENT is reported as 127 with no shell", async (subtest) => {
    const cwd = await temporarySchedulerRoot(subtest);
    const events = [];
    const spawnProcess = (executable, args, options) => {
      assert.equal(options.shell, undefined);
      const command = [executable, ...args].join(" ");
      events.push({ type: "start", command });
      if (command === "pnpm gate:run frontend-build") {
        const error = new Error("injected ENOENT");
        error.code = "ENOENT";
        throw error;
      }
      return makeMockSpawner({ events })(executable, args, options);
    };
    const result = await runPushGates(["--frontend"], {
      cwd,
      env: { ...process.env, GATE_MEMORY_BYTES: String(7 * GIB) },
      getGateBudgetBytes: () => 7 * GIB,
      availableParallelism: () => 2,
      spawnProcess,
    });
    assert.equal(result.exitCode, 127);
    assert.ok(result.results.some((task) => task.name === "frontend-build" && task.code === 127));
    assert.ok(result.results.some((task) => task.name === "bundle" && task.status === "skipped"));
  });
});

test("frontend self-sizing lane environment and P1 schedule anchor (PG-17, PG-58)", async (t) => {
  assert.equal(PUSH_GATE_SCHEDULE.p1[0].command, "pnpm gate:run frontend-build");
  await t.test(
    "coverage and mutation receive memory and CPU shares in both placements",
    async (subtest) => {
      for (const [budgetBytes, cpuCount, concurrent, cargo] of [
        [7 * GIB, 24, false, true],
        [ONE_WAVE_BYTES + GIB, 24, true, true],
        [ONE_WAVE_BYTES + GIB, 1, false, true],
        [ONE_WAVE_BYTES + GIB, 24, true, false],
      ]) {
        const cwd = await temporarySchedulerRoot(subtest);
        const events = [];
        const flags = cargo ? ["--rust", "--frontend"] : ["--frontend"];
        const result = await runPushGates(flags, {
          cwd,
          env: { ...process.env, GATE_MEMORY_BYTES: String(budgetBytes) },
          getGateBudgetBytes: () => budgetBytes,
          availableParallelism: () => cpuCount,
          spawnProcess: makeMockSpawner({ events }),
        });
        assert.equal(result.exitCode, 0);
        const coverage = events.find(
          (event) =>
            event.type === "start" && event.command === "pnpm gate:ensure frontend-coverage",
        );
        const mutation = events.find(
          (event) =>
            event.type === "start" && event.command === "pnpm gate:ensure frontend-mutation",
        );
        const cargoLanesRun =
          cargo && events.some((event) => event.command === "pnpm gate:ensure backend-test");
        const expectedCoverageMemory = Math.floor(budgetBytes * (cargoLanesRun ? 0.5 : 1));
        assert.equal(coverage.env.GATE_MEMORY_BYTES, String(expectedCoverageMemory));
        assert.equal(coverage.env.GATE_CPU_SHARE, concurrent ? "0.5" : "1");
        assert.equal(
          mutation.env.GATE_MEMORY_BYTES,
          String(Math.floor(budgetBytes * (concurrent ? 0.35 : 1))),
        );
        assert.equal(mutation.env.GATE_CPU_SHARE, concurrent ? "0.5" : "1");
      }
    },
  );
});
