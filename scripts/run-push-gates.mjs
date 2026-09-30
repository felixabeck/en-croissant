#!/usr/bin/env node

import { spawn } from "node:child_process";
import { closeSync, mkdirSync, openSync, readFileSync, writeSync } from "node:fs";
import {
  availableParallelism as defaultAvailableParallelism,
  constants as osConstants,
} from "node:os";
import { join } from "node:path";
import { performance } from "node:perf_hooks";
import { isEntrypoint } from "./entrypoint.mjs";
import { gateBudgetBytes, VITEST_MINIMUM_BUDGET_BYTES } from "./gate-parallelism.mjs";
import { installMultiChildSignalForwarding, superviseChild } from "./child-supervisor.mjs";
import { E2E_CONTAINER_MEMORY_BYTES } from "./run-e2e-container.mjs";

const GIB = 1024 ** 3;

// While cargo lanes or mutation run with P2, frontend coverage gets half the budget; with only
// non-self-sizing lanes it gets all of it. The remaining share covers cargo/contract peaks
// (2026-09-29: clippy 1.5, backend-test 1.8, backend-coverage 2.0, contract 0.5 GB) or mutation.
export const P2_VITEST_SHARE = 0.5;

// Mutation's P2 slice; 0.5 + 0.35 leaves 0.15 for the measured cargo/contract/receipt peak.
export const P2_MUTATION_SHARE = 0.35;

// 0.15 × 40 GiB covers the 6.06 GB four-receipt-gate peak (2026-09-29), and 0.35 × 40 GiB
// covers the Stryker parent plus eight measured 1.2 GiB runners. Below this budget, including
// the 7 GiB agent budget, mutation follows P2 with the whole budget.
export const ONE_WAVE_BYTES = 40 * GIB;

// Two self-sizing lanes split the available CPU evenly; one CPU cannot run both without
// oversubscribing its worker floors, so mutation follows P2 below this count.
const MIN_CONCURRENT_SELF_SIZING_CPUS = 2;
// Two seconds lets gates handle SIGTERM cleanly before their process group is escalated.
const CHILD_TERMINATION_TIMEOUT_MS = 2_000;
// Failed command output is bounded so one noisy gate cannot flood the summary.
const LOG_TAIL_BYTES = 8 * 1024;

export const PUSH_GATE_SCHEDULE = Object.freeze({
  p0: Object.freeze([
    Object.freeze({ name: "mutation-guard", command: "pnpm mutation:guard:check", always: true }),
    Object.freeze({
      name: "setup-rust",
      command: "bash scripts/setup-rust.sh",
      blocks: Object.freeze(["rust", "bindings"]),
    }),
  ]),
  p1: Object.freeze([
    Object.freeze({
      name: "frontend-build",
      command: "pnpm gate:run frontend-build",
      blocks: Object.freeze(["rust", "frontend", "bindings"]),
    }),
    Object.freeze({
      name: "bindings-check",
      command: "pnpm bindings:check",
      blocks: Object.freeze(["bindings"]),
    }),
  ]),
  lanes: Object.freeze([
    Object.freeze({
      name: "contract",
      commands: Object.freeze([
        "pnpm gates:contract:check",
        "env -u KIT_ROOT pnpm findings:kit:check",
      ]),
      always: true,
    }),
    Object.freeze({
      name: "rust-lint",
      commands: Object.freeze([
        "cargo fmt --manifest-path src-tauri/Cargo.toml -- --check",
        "cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets --locked -- -D warnings",
        "pnpm rust:windows:check",
      ]),
      blocks: Object.freeze(["rust"]),
      requires: Object.freeze(["setup-rust", "frontend-build"]),
    }),
    Object.freeze({
      name: "rust-test",
      commands: Object.freeze(["pnpm gate:ensure backend-test"]),
      blocks: Object.freeze(["rust"]),
      requires: Object.freeze(["setup-rust", "frontend-build"]),
    }),
    Object.freeze({
      name: "rust-coverage",
      commands: Object.freeze(["pnpm gate:ensure backend-coverage"]),
      blocks: Object.freeze(["rust"]),
      requires: Object.freeze(["setup-rust", "frontend-build"]),
    }),
    Object.freeze({
      name: "frontend-coverage",
      commands: Object.freeze(["pnpm gate:ensure frontend-coverage"]),
      blocks: Object.freeze(["frontend"]),
      selfSizing: "vitest",
    }),
    Object.freeze({
      name: "bundle",
      commands: Object.freeze(["pnpm bundle:check"]),
      blocks: Object.freeze(["frontend"]),
      requires: Object.freeze(["frontend-build"]),
    }),
    Object.freeze({
      name: "e2e",
      commands: Object.freeze(["pnpm gate:ensure e2e-container"]),
      blocks: Object.freeze(["frontend"]),
      after: Object.freeze(["rust-lint", "rust-test", "rust-coverage", "bundle"]),
    }),
    Object.freeze({
      name: "frontend-mutation",
      commands: Object.freeze(["pnpm gate:ensure frontend-mutation"]),
      blocks: Object.freeze(["frontend"]),
      selfSizing: "mutation",
    }),
  ]),
});

const BLOCK_FLAGS = Object.freeze({
  "--rust": "rust",
  "--frontend": "frontend",
  "--bindings": "bindings",
});

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

function nestedErrorMessage(error, depth = 0) {
  const lines = [`${"  ".repeat(depth)}${errorMessage(error)}`];
  const nested = error instanceof AggregateError ? [...error.errors] : [];
  if (error?.cause !== undefined) nested.push(error.cause);
  for (const cause of nested) lines.push(nestedErrorMessage(cause, depth + 1));
  return lines.join("\n");
}

export function parsePushGateArguments(argumentsList) {
  const args = [...argumentsList];
  if (args[0] === "--") args.shift();
  const blocks = new Set();
  for (const argument of args) {
    const block = BLOCK_FLAGS[argument];
    if (!block) {
      return {
        error: `Unknown argument ${JSON.stringify(argument)}. Usage: pnpm gates:push -- [--rust] [--frontend] [--bindings]`,
      };
    }
    blocks.add(block);
  }
  return { blocks };
}

export function pushGateScheduleCommands(schedule = PUSH_GATE_SCHEDULE) {
  return [
    ...schedule.p0.map(({ command }) => command),
    ...schedule.p1.map(({ command }) => command),
    ...schedule.lanes.flatMap(({ commands }) => commands),
  ];
}

function selectedByBlocks(entry, blocks) {
  if (entry.always) return true;
  return entry.blocks?.some((block) => blocks.has(block)) ?? false;
}

function signalExitCode(signal) {
  return 128 + (osConstants.signals[signal] ?? 0);
}

function formatDuration(durationMs) {
  return `${(durationMs / 1000).toFixed(1)}s`;
}

function makeLogDirectory(cwd) {
  const base = join(cwd, "artifacts", "gates");
  mkdirSync(base, { recursive: true });
  const timestamp = `${new Date().toISOString().replaceAll(/[-:.]/gu, "")}-${process.pid}`;
  const directory = join(base, timestamp);
  mkdirSync(directory, { recursive: false });
  return directory;
}

function logPathFor(logDirectory, name) {
  return join(logDirectory, `${name}.log`);
}

function appendLog(fd, value) {
  writeSync(fd, Buffer.isBuffer(value) ? value : String(value));
}

function commandArgv(command) {
  const [executable, ...args] = command.split(" ");
  return { executable, args };
}

function createTaskResult(logDirectory, name, kind, fields = {}) {
  return {
    name,
    kind,
    status: "pending",
    code: undefined,
    durationMs: 0,
    logPath: logPathFor(logDirectory, name),
    ...fields,
  };
}

function writeTaskHeader(task, command, append = task.kind === "lane-step") {
  const fd = openSync(task.logPath, append ? "a" : "w");
  if (command) appendLog(fd, `$ ${command}\n`);
  return fd;
}

async function runCommand(
  command,
  task,
  { cwd, env, spawnProcess, signalForwarding, writeCapturedOutput = appendLog },
) {
  const { executable, args } = commandArgv(command);
  const fd = writeTaskHeader(task, command);
  let logError;
  let child;
  try {
    child = spawnProcess(executable, args, {
      cwd,
      env,
      stdio: ["ignore", "pipe", "pipe"],
      detached: true,
    });
  } catch (error) {
    const message = `spawn ${executable} failed: ${errorMessage(error)}\n`;
    try {
      appendLog(fd, message);
    } catch (writeError) {
      logError = writeError;
    }
    closeSync(fd);
    return { code: 127, error, logError };
  }

  const capture = (chunk) => {
    try {
      writeCapturedOutput(fd, chunk);
    } catch (error) {
      logError ??= error;
    }
  };
  child.stdout?.on("data", capture);
  child.stderr?.on("data", capture);
  const supervisor = superviseChild(child, {
    terminationTimeoutMs: CHILD_TERMINATION_TIMEOUT_MS,
    killProcessGroup: true,
  });
  const childLabel =
    task.kind === "lane-step"
      ? `lane ${task.name} step ${command}`
      : `${task.phase} step ${task.name} (${command})`;
  signalForwarding.attach(supervisor, childLabel);

  let completion;
  try {
    completion = await Promise.race([
      supervisor.done.then((result) => ({ type: "completed", result })),
      signalForwarding.signalRequested.then(() => ({ type: "interrupted" })),
    ]);
  } finally {
    closeSync(fd);
  }

  if (completion.type === "interrupted") {
    return { signal: signalForwarding.requestedSignal, logError };
  }
  const { result } = completion;
  let commandResult;
  if (result.error) commandResult = { code: 127, error: result.error };
  else if (result.code !== null) commandResult = { code: result.code, signal: result.signal };
  else commandResult = { code: signalExitCode(result.signal), signal: result.signal };

  if (logError && commandResult.code === 0) {
    return {
      ...commandResult,
      code: 1,
      error: new Error(`cannot write gate log: ${errorMessage(logError)}`),
      logError,
    };
  }
  return { ...commandResult, logError };
}

function skipTask(task, reason) {
  task.status = "skipped";
  task.reason = reason;
  task.code = undefined;
  const fd = writeTaskHeader(task);
  try {
    appendLog(fd, `Skipped: ${reason}\n`);
  } finally {
    closeSync(fd);
  }
}

function logProgress(task, phase, message) {
  const duration =
    task.startedAt === undefined ? "" : ` duration=${formatDuration(task.durationMs)}`;
  const code = task.code === undefined ? "" : ` exit=${task.code}`;
  process.stdout.write(`${phase} ${task.name}${duration}${code} ${message}\n`);
}

async function runStep(task, command, context) {
  if (context.signalForwarding.requestedSignal) {
    skipTask(task, `cancelled by ${context.signalForwarding.requestedSignal}`);
    return task;
  }
  try {
    await context.beforeStep?.({
      phase: task.phase,
      name: task.name,
      command,
      index: task.commandIndex ?? 0,
    });
  } catch (error) {
    task.status = "failed";
    task.code = 1;
    task.error = error;
    const fd = writeTaskHeader(task, command);
    try {
      appendLog(fd, `beforeStep failed: ${errorMessage(error)}\n`);
    } finally {
      closeSync(fd);
    }
    logProgress(task, "finish", `error=${errorMessage(error)}`);
    return task;
  }
  if (context.signalForwarding.requestedSignal) {
    skipTask(task, `cancelled by ${context.signalForwarding.requestedSignal}`);
    return task;
  }

  task.startedAt = performance.now();
  logProgress(task, "start", `command=${command}`);
  let result;
  try {
    result = await runCommand(command, task, context);
  } catch (error) {
    result = { code: 1, error };
  }
  task.durationMs = performance.now() - task.startedAt;
  task.error = result.error;
  task.logError = result.logError;
  task.signal = result.signal;
  if (context.signalForwarding.requestedSignal) {
    task.code = signalExitCode(context.signalForwarding.requestedSignal);
    task.status = "interrupted";
  } else {
    task.code = result.code;
    task.status = result.code === 0 ? "passed" : "failed";
  }
  logProgress(task, "finish", result.error ? `error=${errorMessage(result.error)}` : "");
  return task;
}

async function runLane(lane, env, context, results) {
  const task = createTaskResult(context.logDirectory, lane.name, "lane", {
    phase: "P2",
  });
  results.set(lane.name, task);
  if (context.signalForwarding.requestedSignal) {
    skipTask(task, `cancelled by ${context.signalForwarding.requestedSignal}`);
    return task;
  }

  task.startedAt = performance.now();
  logProgress(task, "start", `commands=${lane.commands.length}`);
  let result = { code: 0 };
  for (const [index, command] of lane.commands.entries()) {
    if (context.signalForwarding.requestedSignal) {
      result = { code: signalExitCode(context.signalForwarding.requestedSignal) };
      break;
    }
    const step = createTaskResult(context.logDirectory, lane.name, "lane-step", {
      phase: "P2",
      commandIndex: index,
    });
    try {
      await context.beforeStep?.({
        phase: "P2",
        name: lane.name,
        command,
        index,
      });
      if (context.signalForwarding.requestedSignal) {
        result = { code: signalExitCode(context.signalForwarding.requestedSignal) };
        break;
      }
      result = await runCommand(command, step, { ...context, env });
    } catch (error) {
      result = { code: 1, error };
    }
    if (context.signalForwarding.requestedSignal) {
      result = { code: signalExitCode(context.signalForwarding.requestedSignal) };
      break;
    }
    if (result.code !== 0) {
      task.error = result.error;
      task.logError = result.logError;
      task.failedCommand = command;
      break;
    }
  }
  task.durationMs = performance.now() - task.startedAt;
  task.code = result.code;
  task.status = context.signalForwarding.requestedSignal
    ? "interrupted"
    : result.code === 0
      ? "passed"
      : "failed";
  task.error ??= result.error;
  logProgress(task, "finish", result.error ? `error=${errorMessage(result.error)}` : "");
  return task;
}

function makeLaneEnvironment(
  env,
  laneName,
  budgetBytes,
  concurrentMutation,
  cargoLanesPresent,
  e2eSelected,
) {
  if (laneName === "frontend-coverage") {
    const memoryShare = cargoLanesPresent || concurrentMutation ? P2_VITEST_SHARE : 1;
    const cpuShare = concurrentMutation ? P2_CPU_SHARE : 1;
    const budgetAfterContainer = budgetBytes - (e2eSelected ? E2E_CONTAINER_MEMORY_BYTES : 0);
    const sharedBudget = Math.floor(budgetAfterContainer * memoryShare);
    const laneBudget =
      e2eSelected && budgetAfterContainer >= VITEST_MINIMUM_BUDGET_BYTES
        ? Math.max(sharedBudget, VITEST_MINIMUM_BUDGET_BYTES)
        : sharedBudget;
    return {
      ...env,
      GATE_MEMORY_BYTES: String(laneBudget),
      GATE_CPU_SHARE: String(cpuShare),
    };
  }
  if (laneName === "frontend-mutation") {
    const memoryShare = concurrentMutation ? P2_MUTATION_SHARE : 1;
    const cpuShare = concurrentMutation ? P2_CPU_SHARE : 1;
    const reserveContainer = e2eSelected && concurrentMutation;
    return {
      ...env,
      GATE_MEMORY_BYTES: String(
        Math.floor(
          (budgetBytes - (reserveContainer ? E2E_CONTAINER_MEMORY_BYTES : 0)) * memoryShare,
        ),
      ),
      GATE_CPU_SHARE: String(cpuShare),
    };
  }
  return env;
}

// The self-sizing Vitest and mutation lanes split CPU evenly when they share P2.
const P2_CPU_SHARE = 0.5;

function printSummary(results, logDirectory) {
  process.stdout.write(`Push gate logs: ${logDirectory}\n`);
  process.stdout.write("Task                 Status       Exit   Duration\n");
  process.stdout.write("-------------------- ------------ ------ --------\n");
  for (const task of results) {
    process.stdout.write(
      `${task.name.padEnd(20)} ${task.status.padEnd(12)} ${String(task.code ?? "-").padEnd(6)} ${formatDuration(task.durationMs)}\n`,
    );
    if (task.reason) process.stdout.write(`  reason: ${task.reason}\n`);
  }
  for (const task of results) {
    if (task.status !== "failed" && task.status !== "interrupted") continue;
    process.stdout.write(`\n${task.name} log tail (${task.logPath}):\n`);
    try {
      const contents = readFileSync(task.logPath);
      const tail = contents
        .subarray(Math.max(0, contents.length - LOG_TAIL_BYTES))
        .toString("utf8");
      process.stdout.write(tail || "(empty log)\n");
      if (!tail.endsWith("\n")) process.stdout.write("\n");
    } catch (error) {
      process.stdout.write(`Unable to read log tail: ${errorMessage(error)}\n`);
    }
    if (task.error) process.stdout.write(`Spawn or runner error: ${errorMessage(task.error)}\n`);
    if (task.logError) {
      process.stdout.write(`Gate log write failed: ${errorMessage(task.logError)}\n`);
    }
  }
}

function firstFailure(tasks) {
  return tasks.find((task) => task.status === "failed" || task.status === "interrupted");
}

/** Run the selected push-gate schedule. Spawn, CPU count, and budget are injectable for scheduler tests. */
export async function runPushGates(
  argumentsList = [],
  {
    spawnProcess = spawn,
    cwd = process.cwd(),
    env = process.env,
    availableParallelism = defaultAvailableParallelism,
    getGateBudgetBytes = () => gateBudgetBytes({ env }),
    beforeStep = undefined,
    writeCapturedOutput = appendLog,
  } = {},
) {
  const parsed = parsePushGateArguments(argumentsList);
  if (parsed.error) {
    process.stderr.write(`${parsed.error}\n`);
    return { exitCode: 2, results: [], logDirectory: undefined };
  }
  const { blocks } = parsed;
  const logDirectory = makeLogDirectory(cwd);
  const signalForwarding = installMultiChildSignalForwarding({ label: "push gate" });
  const resultsByName = new Map();
  const stepResults = [];
  let budgetBytes;
  let cpuCount;
  let exitCode = 0;
  let cleanupFailed = false;
  let fatalError;
  const context = {
    cwd,
    env,
    spawnProcess,
    signalForwarding,
    beforeStep,
    logDirectory,
    writeCapturedOutput,
  };
  const runSerialStep = async (entry, phase) => {
    const task = createTaskResult(logDirectory, entry.name, "step", { phase });
    stepResults.push(task);
    const finished = await runStep(task, entry.command, context);
    if (!resultsByName.has(entry.name)) resultsByName.set(entry.name, finished);
    return finished;
  };

  try {
    const guard = await runSerialStep(PUSH_GATE_SCHEDULE.p0[0], "P0");
    if (guard.status !== "passed") {
      exitCode = signalForwarding.requestedSignal
        ? signalExitCode(signalForwarding.requestedSignal)
        : guard.code;
      for (const lane of PUSH_GATE_SCHEDULE.lanes) {
        if (!selectedByBlocks(lane, blocks)) continue;
        const skipped = createTaskResult(logDirectory, lane.name, "lane", { phase: "P2" });
        skipTask(skipped, "P0 mutation guard failed before any lane started");
        resultsByName.set(lane.name, skipped);
      }
    } else {
      let setupRust;
      if (selectedByBlocks(PUSH_GATE_SCHEDULE.p0[1], blocks)) {
        setupRust = await runSerialStep(PUSH_GATE_SCHEDULE.p0[1], "P0");
      }

      const frontendBuildEntry = PUSH_GATE_SCHEDULE.p1[0];
      let frontendBuild;
      if (selectedByBlocks(frontendBuildEntry, blocks)) {
        frontendBuild = await runSerialStep(frontendBuildEntry, "P1");
      }

      const bindingsEntry = PUSH_GATE_SCHEDULE.p1[1];
      if (selectedByBlocks(bindingsEntry, blocks)) {
        if (setupRust?.status !== "passed") {
          const skipped = createTaskResult(logDirectory, bindingsEntry.name, "step", {
            phase: "P1",
          });
          skipTask(skipped, "setup-rust failed, so bindings:check was skipped");
          stepResults.push(skipped);
        } else if (frontendBuild?.status !== "passed") {
          const skipped = createTaskResult(logDirectory, bindingsEntry.name, "step", {
            phase: "P1",
          });
          skipTask(skipped, "frontend-build failed, so bindings:check was skipped");
          stepResults.push(skipped);
        } else {
          await runSerialStep(bindingsEntry, "P1");
        }
      }

      const buildReady = !frontendBuild || frontendBuild.status === "passed";
      const setupReady = !setupRust || setupRust.status === "passed";
      const rustLanesPresent = blocks.has("rust") && setupReady && buildReady;
      const lanes = PUSH_GATE_SCHEDULE.lanes.filter((lane) => selectedByBlocks(lane, blocks));
      const runnableLanes = [];
      for (const lane of lanes) {
        if (lane.requires?.includes("setup-rust") && !setupReady) {
          const skipped = createTaskResult(logDirectory, lane.name, "lane", { phase: "P2" });
          skipTask(skipped, "setup-rust failed, so this Rust consumer was skipped");
          resultsByName.set(lane.name, skipped);
          continue;
        }
        if (lane.requires?.includes("frontend-build") && !buildReady) {
          const skipped = createTaskResult(logDirectory, lane.name, "lane", { phase: "P2" });
          skipTask(skipped, "frontend-build failed, so this dist/ consumer was skipped");
          resultsByName.set(lane.name, skipped);
          continue;
        }
        runnableLanes.push(lane);
      }

      if (blocks.has("frontend")) {
        budgetBytes = getGateBudgetBytes();
        cpuCount = availableParallelism();
      }
      const concurrentMutation =
        blocks.has("frontend") &&
        budgetBytes >= ONE_WAVE_BYTES &&
        cpuCount >= MIN_CONCURRENT_SELF_SIZING_CPUS;
      const laneByName = new Map(runnableLanes.map((lane) => [lane.name, lane]));
      const e2eSelected = laneByName.has("e2e");
      const baseLanes = runnableLanes.filter(
        (lane) => lane.name !== "e2e" && lane.name !== "frontend-mutation",
      );
      const p2Promises = new Map();
      for (const lane of baseLanes) {
        const laneEnv = lane.selfSizing
          ? makeLaneEnvironment(
              env,
              lane.name,
              budgetBytes,
              concurrentMutation,
              rustLanesPresent,
              e2eSelected,
            )
          : env;
        p2Promises.set(lane.name, runLane(lane, laneEnv, context, resultsByName));
      }

      const e2eLane = laneByName.get("e2e");
      let e2ePromise;
      if (e2eLane) {
        const dependencies = e2eLane.after.map((name) => p2Promises.get(name)).filter(Boolean);
        e2ePromise = Promise.all(dependencies).then(() =>
          runLane(e2eLane, env, context, resultsByName),
        );
      }

      const mutationLane = laneByName.get("frontend-mutation");
      let mutationPromise;
      if (mutationLane) {
        if (concurrentMutation) {
          const laneEnv = makeLaneEnvironment(
            env,
            mutationLane.name,
            budgetBytes,
            concurrentMutation,
            rustLanesPresent,
            e2eSelected,
          );
          mutationPromise = runLane(mutationLane, laneEnv, context, resultsByName);
          p2Promises.set(mutationLane.name, mutationPromise);
        } else {
          const dependencies = [
            ...baseLanes.map((lane) => p2Promises.get(lane.name)).filter(Boolean),
            ...(e2ePromise ? [e2ePromise] : []),
          ];
          mutationPromise = Promise.all(dependencies).then(() => {
            const laneEnv = makeLaneEnvironment(
              env,
              mutationLane.name,
              budgetBytes,
              false,
              rustLanesPresent,
              e2eSelected,
            );
            return runLane(mutationLane, laneEnv, context, resultsByName);
          });
        }
      }

      await Promise.all([
        ...p2Promises.values(),
        ...(e2ePromise ? [e2ePromise] : []),
        ...(mutationPromise && !concurrentMutation ? [mutationPromise] : []),
      ]);

      const failedStep = firstFailure(stepResults);
      if (failedStep) exitCode = failedStep.code;
      else {
        for (const lane of PUSH_GATE_SCHEDULE.lanes) {
          const result = resultsByName.get(lane.name);
          if (result && (result.status === "failed" || result.status === "interrupted")) {
            exitCode = result.code;
            break;
          }
        }
      }
    }
  } catch (error) {
    fatalError = error;
    process.stderr.write(`Push gate scheduler failed: ${errorMessage(error)}\n`);
    exitCode = 1;
    try {
      await signalForwarding.terminateAll();
    } catch (cleanupError) {
      cleanupFailed = true;
      process.stderr.write(
        `Push gate child cleanup failed:\n${nestedErrorMessage(cleanupError)}\n`,
      );
    }
  } finally {
    try {
      await signalForwarding.termination;
    } catch (error) {
      cleanupFailed = true;
      process.stderr.write(`Push gate child cleanup failed:\n${nestedErrorMessage(error)}\n`);
    }
    signalForwarding.uninstall();
  }

  if (signalForwarding.requestedSignal) {
    exitCode = signalExitCode(signalForwarding.requestedSignal);
  } else if (cleanupFailed) {
    exitCode = exitCode || 1;
  }
  const results = [...stepResults];
  for (const lane of PUSH_GATE_SCHEDULE.lanes) {
    const task = resultsByName.get(lane.name);
    if (task && task.kind === "lane") results.push(task);
  }
  if (fatalError) {
    const fatalTask = createTaskResult(logDirectory, "scheduler", "step", { phase: "runner" });
    fatalTask.status = "failed";
    fatalTask.code = 1;
    fatalTask.error = fatalError;
    const fd = writeTaskHeader(fatalTask);
    try {
      appendLog(fd, `Scheduler error: ${errorMessage(fatalError)}\n`);
    } finally {
      closeSync(fd);
    }
    results.push(fatalTask);
  }
  printSummary(results, logDirectory);
  return { exitCode, results, logDirectory, signal: signalForwarding.requestedSignal };
}

async function main() {
  const result = await runPushGates(process.argv.slice(2), { cwd: process.cwd() });
  return result.exitCode;
}

if (isEntrypoint(import.meta.url)) {
  try {
    process.exitCode = await main();
  } catch (error) {
    process.stderr.write(`Push gate runner failed: ${errorMessage(error)}\n`);
    process.exitCode = 1;
  }
}
