import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { chmod, mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { availableParallelism } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  ONE_WAVE_BYTES,
  P2_MUTATION_SHARE,
  P2_VITEST_SHARE,
  PRE_REVIEW_GATE_SCHEDULE,
  PUSH_GATE_SCHEDULE,
  discoverPreReviewChangedPaths,
  mutationFilesForChanges,
  runPushGates,
  selectPreReviewLanes,
} from "./run-push-gates.mjs";
import { VITEST_MINIMUM_BUDGET_BYTES, workerCount } from "./gate-parallelism.mjs";
import { E2E_CONTAINER_MEMORY_BYTES } from "./run-e2e-container.mjs";
import { startNodeCli } from "./mutation-runner-test-harness.mjs";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const runnerPath = join(repositoryRoot, "scripts/run-push-gates.mjs");
const GIB = 1024 ** 3;
// A broken process test must fail promptly instead of holding the contract gate indefinitely.
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
    budgetBytes,
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
  return startNodeCli(t, runnerPath, harness.root, harness.env, {
    args,
    afterChildExit: async () => {
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
    },
  });
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

function git(root, args, { allowFailure = false } = {}) {
  const result = spawnSync("git", args, { cwd: root, encoding: "utf8" });
  if (!allowFailure) assert.equal(result.status, 0, result.stderr);
  return result;
}

async function initializeUpstream(root, { upstream = true } = {}) {
  git(root, ["init", "--quiet"]);
  git(root, ["config", "user.name", "Gate fixture"]);
  git(root, ["config", "user.email", "gate-fixture@example.invalid"]);
  await writeFile(join(root, "README.md"), "base\n");
  git(root, ["add", "README.md"]);
  git(root, ["commit", "--quiet", "-m", "base"]);
  if (!upstream) return;
  const remote = join(root, ".git", "upstream.git");
  git(root, ["init", "--bare", "--quiet", remote]);
  git(root, ["remote", "add", "origin", remote]);
  git(root, ["push", "--quiet", "--set-upstream", "origin", "HEAD"]);
}

test("pre-review changed-path selection covers every lane and excludes unrelated changes", async (t) => {
  const root = await temporarySchedulerRoot(t);
  await mkdir(join(root, "src/state"), { recursive: true });
  await mkdir(join(root, "src-tauri/src"), { recursive: true });
  await writeFile(join(root, "src/state/workspace.ts"), "export const workspace = 1;\n");
  await writeFile(join(root, "src-tauri/src/lib.rs"), "pub fn fixture() {}\n");
  await writeFile(join(root, "coverage-areas.json"), "{}\n");
  await writeFile(join(root, "backend-coverage-baselines.json"), "{}\n");
  const paths = ["src/state/workspace.ts", "src-tauri/src/lib.rs", "package.json"];
  const lanes = selectPreReviewLanes(paths, { root });
  assert.deepEqual(
    lanes.map(({ name }) => name),
    [
      "format-lint",
      "coverage-mapping-frontend",
      "coverage-mapping-backend",
      "frontend-mutation-changed-files",
      "windows-clippy",
      "bundle",
    ],
  );
  const formatCommands = lanes.find(({ name }) => name === "format-lint").commands;
  assert.deepEqual(
    formatCommands.map(({ display }) => display),
    [
      "pnpm exec oxfmt --check src/state/workspace.ts",
      "pnpm exec oxlint --deny-warnings src/state/workspace.ts",
      "pnpm exec tsgo --noEmit",
      "cargo fmt --manifest-path src-tauri/Cargo.toml -- --check",
    ],
  );
  assert.deepEqual(selectPreReviewLanes(["README.md"], { root }), []);
  const tauriConfigLanes = selectPreReviewLanes(["src-tauri/tauri.conf.json"], { root });
  assert.ok(tauriConfigLanes.some(({ name }) => name === "windows-clippy"));
  assert.ok(!tauriConfigLanes.some(({ name }) => name === "format-lint"));
  assert.deepEqual(
    selectPreReviewLanes(["coverage-areas.json"], { root }).map(({ name }) => name),
    ["format-lint", "coverage-mapping-frontend"],
  );
  assert.deepEqual(
    selectPreReviewLanes(["backend-coverage-baselines.json"], { root }).map(({ name }) => name),
    ["format-lint", "coverage-mapping-backend"],
  );
});

test("untracked-only production input selects its pre-review lanes (CR-6)", async (t) => {
  const root = await temporarySchedulerRoot(t);
  await initializeUpstream(root);
  const sourcePath = "src/state/workspace.ts";
  await mkdir(dirname(join(root, sourcePath)), { recursive: true });
  await writeFile(join(root, sourcePath), "export const workspace = 1;\n");

  const changedPaths = discoverPreReviewChangedPaths({ cwd: root });
  assert.deepEqual(changedPaths, [sourcePath]);
  assert.ok(
    selectPreReviewLanes(changedPaths, { root }).some(({ name }) => name === "format-lint"),
  );
  assert.ok(
    selectPreReviewLanes(changedPaths, { root }).some(
      ({ name }) => name === "coverage-mapping-frontend",
    ),
  );
});

test("pre-review refuses a missing upstream and every failing git call", async (t) => {
  const root = await temporarySchedulerRoot(t);
  await initializeUpstream(root, { upstream: false });
  assert.throws(
    () => discoverPreReviewChangedPaths({ cwd: root }),
    /Cannot determine pre-review changed paths: git merge-base HEAD @\{u\} failed/u,
  );

  const failingRunGit = (executable, args) => {
    if (args[0] === "merge-base") return { status: 0, stdout: "base-commit\n" };
    return { status: 128, stdout: "", stderr: "injected diff failure" };
  };
  assert.throws(
    () =>
      discoverPreReviewChangedPaths({ cwd: root, runGit: failingRunGit, listUntracked: () => [] }),
    /git diff --name-only -z base-commit -- failed \(injected diff failure\)/u,
  );
});

test("a changed Vitest file adds its exercised production file to the mutation list (CR-5)", async (t) => {
  const root = await temporarySchedulerRoot(t);
  const sourcePath = "src/state/workspace.ts";
  const testPath = "src/state/workspace.test.ts";
  await mkdir(dirname(join(root, sourcePath)), { recursive: true });
  await writeFile(join(root, sourcePath), "export const workspace = 1;\n");
  await writeFile(join(root, testPath), 'import { workspace } from "@/state/workspace";\n');

  const files = mutationFilesForChanges([testPath], { root });
  assert.deepEqual(files, [sourcePath]);
  const mutationLane = selectPreReviewLanes([testPath], { root }).find(
    ({ name }) => name === "frontend-mutation-changed-files",
  );
  assert.ok(mutationLane.commands[0].args.includes(sourcePath));
});

test("Rust-only pre-review waits for the frontend build before Windows clippy", async (t) => {
  const cwd = await temporarySchedulerRoot(t);
  const events = [];
  const result = await runPushGates(["--pre-review"], {
    cwd,
    env: { ...process.env, GATE_MEMORY_BYTES: String(7 * GIB) },
    discoverChangedPaths: () => ["src-tauri/src/lib.rs"],
    spawnProcess: makeMockSpawner({ events }),
  });
  assert.equal(result.exitCode, 0);
  const commands = events.filter(({ type }) => type === "start").map(({ command }) => command);
  assert.deepEqual(commands, [
    "pnpm gate:run frontend-build",
    "cargo fmt --manifest-path src-tauri/Cargo.toml -- --check",
    "pnpm coverage:mapping:backend",
    "pnpm rust:windows:check",
  ]);
  assert.ok(
    PRE_REVIEW_GATE_SCHEDULE.p1[0].command === commands[0] &&
      commands.indexOf("pnpm gate:run frontend-build") <
        commands.indexOf("pnpm rust:windows:check"),
  );
});

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
    "invalid GATE_MEMORY_BYTES after P1 prevents every P2 lane, including contract, from starting",
    async (subtest) => {
      const harness = await makeHarness(subtest);
      harness.env.GATE_MEMORY_BYTES = "abc";
      const result = await runCli(subtest, harness, ["--frontend"]);
      assert.equal(result.code, 1, `${result.stdout}\n${result.stderr}`);
      assert.match(result.stderr, /GATE_MEMORY_BYTES/u);
      assert.deepEqual(
        commandSet(await readEvents(harness)),
        ["pnpm mutation:guard:check", "pnpm gate:run frontend-build"].sort(),
      );
    },
  );

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
      `${signal} during concurrent contract, Rust-test and frontend-coverage lanes leaves every held process group gone`,
      async (subtest) => {
        const harness = await makeHarness(subtest, {
          budgetBytes: ONE_WAVE_BYTES + GIB,
          commands: {
            "pnpm gates:contract:check": { hold: true },
            "pnpm gate:ensure backend-test": { hold: true },
            "pnpm gate:ensure frontend-coverage": { hold: true },
          },
        });
        const running = startCli(subtest, harness, ["--rust", "--frontend", "--bindings"]);
        const heldCommands = [
          "pnpm gates:contract:check",
          "pnpm gate:ensure backend-test",
          "pnpm gate:ensure frontend-coverage",
        ];
        const held = await Promise.all(
          heldCommands.map((command) =>
            waitForEvent(harness, (event) => event.type === "start" && event.command === command),
          ),
        );
        running.child.kill(signal);
        const result = await running.done;
        assert.equal(
          result.code,
          signal === "SIGINT" ? 130 : 143,
          `${result.stdout}\n${result.stderr}`,
        );
        for (const event of held) {
          assert.equal(
            groupExists(event.pid),
            false,
            `${event.command} process group ${event.pid} must be gone`,
          );
        }
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
      assert.equal(
        coverage.env.GATE_MEMORY_BYTES,
        String(ONE_WAVE_BYTES * 2 - E2E_CONTAINER_MEMORY_BYTES),
      );
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

test("gate log write failures preserve command results and fail successful commands", async (t) => {
  for (const [commandCode, expectedCode] of [
    [17, 17],
    [0, 1],
  ]) {
    await t.test(
      `child exit ${commandCode} reports the log failure with exit ${expectedCode}`,
      async (subtest) => {
        const cwd = await temporarySchedulerRoot(subtest);
        const spawnProcess = () => {
          const child = new EventEmitter();
          child.stdout = new PassThrough();
          child.stderr = new PassThrough();
          child.pid = undefined;
          child.exitCode = null;
          child.signalCode = null;
          setImmediate(() => {
            child.stdout.write("child output\n");
            child.stdout.end();
            child.stderr.end();
            setImmediate(() => {
              child.exitCode = commandCode;
              child.emit("close", commandCode, null);
            });
          });
          return child;
        };
        const result = await runPushGates([], {
          cwd,
          env: { ...process.env },
          spawnProcess,
          writeCapturedOutput() {
            throw new Error("injected log EIO");
          },
        });
        const guard = result.results.find((task) => task.name === "mutation-guard");
        assert.equal(result.exitCode, expectedCode);
        assert.equal(guard.code, expectedCode);
        assert.equal(guard.logError.message, "injected log EIO");
        if (commandCode === 0) {
          assert.match(guard.error.message, /cannot write gate log: injected log EIO/u);
        } else {
          assert.equal(guard.error, undefined);
        }
      },
    );
  }
});

test("signal cleanup failure stops waiting on the child and reports nested termination errors", async (t) => {
  for (const [signal, expectedCode] of [
    ["SIGINT", 130],
    ["SIGTERM", 143],
  ]) {
    await t.test(
      `${signal} returns its signal code and names the child and cause`,
      async (subtest) => {
        const cwd = await temporarySchedulerRoot(subtest);
        const fakePid = 987_654_321;
        const originalKill = process.kill;
        const originalStderrWrite = process.stderr.write;
        let stderr = "";
        let child;
        process.kill = function (pid, childSignal) {
          if (pid === -fakePid && childSignal !== 0) {
            const error = new Error("injected EPERM");
            error.code = "EPERM";
            throw error;
          }
          return Reflect.apply(originalKill, process, [pid, childSignal]);
        };
        process.stderr.write = function (chunk) {
          stderr += Buffer.isBuffer(chunk) ? chunk.toString("utf8") : String(chunk);
          return true;
        };
        try {
          const running = runPushGates([], {
            cwd,
            env: { ...process.env },
            spawnProcess() {
              child = new EventEmitter();
              child.stdout = new PassThrough();
              child.stderr = new PassThrough();
              child.pid = fakePid;
              child.exitCode = null;
              child.signalCode = null;
              child.unref = () => {};
              setImmediate(() => process.emit(signal, signal));
              return child;
            },
          });
          let timeout;
          const outcome = await Promise.race([
            running.then((result) => ({ result })),
            new Promise((resolve) => {
              timeout = setTimeout(() => resolve({ timedOut: true }), 1_000);
            }),
          ]);
          clearTimeout(timeout);
          if (outcome.timedOut) {
            child.exitCode = 0;
            child.stdout.end();
            child.stderr.end();
            child.emit("close", 0, null);
            await running;
            assert.fail("the scheduler waited for a child after termination failed");
          }
          assert.equal(outcome.result.exitCode, expectedCode);
        } finally {
          process.kill = originalKill;
          process.stderr.write = originalStderrWrite;
        }
        assert.match(stderr, /P0 step mutation-guard \(pnpm mutation:guard:check\)/u);
        assert.match(stderr, /injected EPERM/u);
      },
    );
  }
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
        const budgetAfterContainer = budgetBytes - E2E_CONTAINER_MEMORY_BYTES;
        const coverageMemory = Math.floor(
          budgetAfterContainer * (cargoLanesRun || concurrent ? P2_VITEST_SHARE : 1),
        );
        const minimumWorkerFloor =
          budgetAfterContainer >= VITEST_MINIMUM_BUDGET_BYTES ? VITEST_MINIMUM_BUDGET_BYTES : 0;
        const reservedCoverageMemory = Math.max(coverageMemory, minimumWorkerFloor);
        const mutationMemory = Math.floor(
          (budgetBytes - (concurrent ? E2E_CONTAINER_MEMORY_BYTES : 0)) *
            (concurrent ? P2_MUTATION_SHARE : 1),
        );
        assert.equal(coverage.env.GATE_MEMORY_BYTES, String(reservedCoverageMemory));
        assert.equal(mutation.env.GATE_MEMORY_BYTES, String(mutationMemory));
        if (concurrent) {
          assert.ok(
            reservedCoverageMemory + mutationMemory <= budgetBytes - E2E_CONTAINER_MEMORY_BYTES,
          );
        }
        assert.equal(coverage.env.GATE_CPU_SHARE, concurrent ? "0.5" : "1");
        assert.equal(mutation.env.GATE_CPU_SHARE, concurrent ? "0.5" : "1");
      }
    },
  );
});
