import { readFileSync as defaultReadFileSync, statSync as defaultStatSync } from "node:fs";
import { availableParallelism as defaultAvailableParallelism } from "node:os";
import { dirname, join, resolve, sep } from "node:path";

const CGROUP_ROOT = "/sys/fs/cgroup";
const PROCESS_CGROUP_FILE = "/proc/self/cgroup";

// In a session scope (plain vitest), reserve 1 GiB for the agent sharing the cgroup
// (0.32 GB RSS measured 2026-09-29) plus headroom. Inside the agent-gate scope, it covers
// the scheduler, per-lane pnpm and gate-receipt parents, and the launcher's Node processes,
// which no worker count sizes (d-20261002-02).
export const UNSIZED_PROCESS_RESERVE_BYTES = 1024 * 1024 * 1024;

// Per-runner peak RSS measured 0.80–1.13 GiB; tree-path at concurrency 4 used 4.98 GiB above
// idle (1.16 GiB per runner), workspace-storage used 7.04 GiB at 8 and 3.60 GiB at 4, and
// game-practice used 5.44 GiB at 8. Runners grow during a run; maxTestRunnerReuse 40 still used
// 6.53 GiB at 8. The earlier 0.40–0.49 GB readings came from runners OOM-killed while 12–23 of
// them ran at once, before they had grown, so they undercounted.
export const STRYKER_RUNNER_BYTES = Math.round(1.2 * 1024 ** 3);

// The Stryker parent measured 0.34–0.39 GiB RSS plus a 0.11 GiB helper process during the
// 2026-09-30 dry run; 640 MiB covers both with headroom.
export const STRYKER_PARENT_BYTES = 640 * 1024 * 1024;

// On 2026-09-30 in the 8 GiB agent scope, `vitest run --coverage.enabled` used 1.88 GiB above
// idle at 4 workers, 3.23 GiB at 12, and 4.58 GiB at 20: about 173 MiB per worker. 256 MiB keeps
// headroom above that measured slope.
export const VITEST_WORKER_BYTES = 256 * 1024 * 1024;

// The same 2026-09-30 Vitest measurements imply about 1.20 GiB of base memory; 1.5 GiB keeps
// headroom above that measured base.
export const VITEST_BASE_BYTES = 1536 * 1024 * 1024;
export const VITEST_MINIMUM_BUDGET_BYTES = VITEST_BASE_BYTES + VITEST_WORKER_BYTES;

// A detected chain failure uses the measured-safe 8 GiB agent-scope configuration from
// d-20260930-03: after the 1 GiB agent reserve, Vitest gets 22 workers and Stryker gets five.
export const CONSERVATIVE_CGROUP_LIMIT_BYTES = 8 * 1024 ** 3;
export const CONSERVATIVE_VITEST_WORKERS = 22;
export const CONSERVATIVE_STRYKER_RUNNERS = 5;

function detectionError(path, detail, cause = undefined) {
  const error = new Error(
    `Cannot determine the gate memory limit from ${path}: ${detail}. ` +
      "Set GATE_MEMORY_BYTES to a positive decimal integer to override cgroup detection.",
  );
  if (cause !== undefined) error.cause = cause;
  return error;
}

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

function directoryChain(cgroupDirectory) {
  const chain = [];
  for (let directory = cgroupDirectory; ; directory = dirname(directory)) {
    chain.push(directory);
    if (directory === CGROUP_ROOT) return chain;
  }
}

function cgroupDirectoryFrom(contents) {
  if (typeof contents !== "string") {
    throw detectionError(PROCESS_CGROUP_FILE, "the file did not contain text");
  }
  const line = contents.split(/\r?\n/u).find((candidate) => candidate.startsWith("0::"));
  const cgroupPath = line?.slice(3);
  if (!cgroupPath?.startsWith("/")) {
    throw detectionError(PROCESS_CGROUP_FILE, "no valid cgroup-v2 0:: path was found");
  }

  const directory = resolve(CGROUP_ROOT, `.${cgroupPath}`);
  if (directory !== CGROUP_ROOT && !directory.startsWith(`${CGROUP_ROOT}${sep}`)) {
    throw detectionError(
      PROCESS_CGROUP_FILE,
      `cgroup path ${JSON.stringify(cgroupPath)} escaped the cgroup mount`,
    );
  }
  return directory;
}

function parseMemoryLimit(contents, path, filename) {
  if (typeof contents !== "string") {
    throw detectionError(path, `${filename} did not contain text`);
  }
  const value = contents.trim();
  if (value === "max") return undefined;
  if (!/^\d+$/u.test(value)) {
    throw detectionError(path, `unparsable ${filename} value ${JSON.stringify(value)}`);
  }
  const limit = BigInt(value);
  if (limit > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw detectionError(path, `${filename} exceeds the safe integer byte range`);
  }
  return limit;
}

/**
 * Return the smallest finite memory.high or memory.max from the process cgroup through the
 * mount root. Dependencies are supplied in the options object for deterministic tests.
 */
export function memoryLimitBytes({
  readFileSync = defaultReadFileSync,
  statSync = defaultStatSync,
  platform = process.platform,
} = {}) {
  if (platform !== "linux") {
    throw detectionError(
      PROCESS_CGROUP_FILE,
      `cgroup-v2 memory limits are unavailable on ${platform}`,
    );
  }

  let cgroupContents;
  try {
    cgroupContents = readFileSync(PROCESS_CGROUP_FILE, "utf8");
  } catch (error) {
    throw detectionError(PROCESS_CGROUP_FILE, `could not be read: ${errorMessage(error)}`, error);
  }
  const processCgroupDirectory = cgroupDirectoryFrom(cgroupContents);
  let minimum;

  for (const directory of directoryChain(processCgroupDirectory)) {
    let directoryStats;
    try {
      directoryStats = statSync(directory);
    } catch (error) {
      throw detectionError(
        directory,
        `cgroup directory could not be checked: ${errorMessage(error)}`,
        error,
      );
    }
    if (!directoryStats?.isDirectory?.()) {
      throw detectionError(directory, "cgroup path is not a directory");
    }

    for (const filename of ["memory.high", "memory.max"]) {
      const memoryPath = join(directory, filename);
      let contents;
      try {
        contents = readFileSync(memoryPath, "utf8");
      } catch (error) {
        if (error?.code === "ENOENT" && directory === CGROUP_ROOT) continue;
        throw detectionError(memoryPath, `could not be read: ${errorMessage(error)}`, error);
      }

      const limit = parseMemoryLimit(contents, memoryPath, filename);
      if (limit !== undefined && (minimum === undefined || limit < minimum)) minimum = limit;
    }
  }

  if (minimum === undefined) {
    throw detectionError(
      CGROUP_ROOT,
      "no finite memory.high or memory.max limit exists in the cgroup chain",
    );
  }
  return Number(minimum);
}

/** Parse a named environment variable as a positive safe integer byte count. */
export function positiveByteCountFromEnv(name, env = process.env) {
  const value = env?.[name];
  if (typeof value !== "string" || !/^\d+$/u.test(value)) {
    throw new Error(
      `${name} must be a positive decimal integer in bytes (received ${JSON.stringify(value)}).`,
    );
  }
  const bytes = Number(value);
  if (!Number.isSafeInteger(bytes) || bytes <= 0) {
    throw new Error(
      `${name} must be a positive decimal integer in bytes (received ${JSON.stringify(value)}).`,
    );
  }
  return bytes;
}

function configuredMemoryBudget(env) {
  if (env?.GATE_MEMORY_BYTES === undefined) return undefined;
  return positiveByteCountFromEnv("GATE_MEMORY_BYTES", env);
}

/** Return the available gate budget, honoring the override and using the recorded fallback. */
export function gateBudgetBytes({
  env = process.env,
  stderr = process.stderr,
  ...memoryOptions
} = {}) {
  const override = configuredMemoryBudget(env);
  if (override !== undefined) return override;
  try {
    return memoryLimitBytes(memoryOptions) - UNSIZED_PROCESS_RESERVE_BYTES;
  } catch (error) {
    const reason = errorMessage(error).replaceAll(/[\r\n]+/gu, " ");
    stderr.write(
      `Gate memory detection failed (${reason}); using the conservative 8 GiB agent-scope configuration.\n`,
    );
    return CONSERVATIVE_CGROUP_LIMIT_BYTES - UNSIZED_PROCESS_RESERVE_BYTES;
  }
}

function configuredCpuShare(env) {
  const value = env?.GATE_CPU_SHARE;
  if (value === undefined) return 1;
  if (typeof value !== "string" || !/^(?:\d+(?:\.\d*)?|\.\d+)$/u.test(value)) {
    throw new Error(
      `GATE_CPU_SHARE must be a decimal in (0, 1] (received ${JSON.stringify(value)}).`,
    );
  }
  const share = Number(value);
  if (!Number.isFinite(share) || share <= 0 || share > 1) {
    throw new Error(
      `GATE_CPU_SHARE must be a decimal in (0, 1] (received ${JSON.stringify(value)}).`,
    );
  }
  return share;
}

function validateByteCount(name, value, { allowZero = false } = {}) {
  const minimum = allowZero ? 0 : 1;
  if (!Number.isSafeInteger(value) || value < minimum) {
    throw new Error(
      `${name} must be a ${allowZero ? "non-negative" : "positive"} safe integer byte count.`,
    );
  }
}

/** Choose a worker count bounded by both the gate memory budget and the CPU share. */
export function workerCount({
  perWorkerBytes,
  baseBytes = 0,
  budgetBytes,
  env = process.env,
  availableParallelism = defaultAvailableParallelism,
  ...memoryOptions
} = {}) {
  validateByteCount("perWorkerBytes", perWorkerBytes);
  validateByteCount("baseBytes", baseBytes, { allowZero: true });
  const budget =
    budgetBytes === undefined ? gateBudgetBytes({ env, ...memoryOptions }) : budgetBytes;
  validateByteCount("budgetBytes", budget, { allowZero: true });

  const minimumBudget = baseBytes + perWorkerBytes;
  if (!Number.isSafeInteger(minimumBudget)) {
    throw new Error("baseBytes + perWorkerBytes must be a safe integer byte count.");
  }
  if (budget < minimumBudget) {
    throw new Error(
      `Gate memory budget ${budget} bytes is below the minimum ${minimumBudget} bytes ` +
        `(baseBytes ${baseBytes} + perWorkerBytes ${perWorkerBytes}).`,
    );
  }

  const cpuCount = availableParallelism();
  if (!Number.isSafeInteger(cpuCount) || cpuCount < 1) {
    throw new Error(`os.availableParallelism() returned an invalid CPU count ${String(cpuCount)}.`);
  }
  const share = configuredCpuShare(env);
  const cpuCap = Math.max(1, Math.floor(cpuCount * share));
  const memoryCap = Math.floor((budget - baseBytes) / perWorkerBytes);
  return Math.max(1, Math.min(cpuCap, memoryCap));
}

/** Select package slots that maximize total Stryker runners without oversubscribing CPU or memory. */
export function strykerSlots({
  budgetBytes,
  packageCount = 3,
  env = process.env,
  availableParallelism = defaultAvailableParallelism,
} = {}) {
  validateByteCount("packageCount", packageCount);
  const minimumBudget = STRYKER_PARENT_BYTES + STRYKER_RUNNER_BYTES;
  if (!Number.isSafeInteger(budgetBytes)) {
    throw new Error(`Gate memory budget ${String(budgetBytes)} bytes must be a safe integer.`);
  }
  if (budgetBytes < minimumBudget) {
    throw new Error(
      `Gate memory budget ${budgetBytes} bytes is below the minimum ${minimumBudget} bytes ` +
        `(STRYKER_PARENT_BYTES ${STRYKER_PARENT_BYTES} + STRYKER_RUNNER_BYTES ${STRYKER_RUNNER_BYTES}).`,
    );
  }
  const cpuCount = availableParallelism();
  if (!Number.isSafeInteger(cpuCount) || cpuCount < 1) {
    throw new Error(`os.availableParallelism() returned an invalid CPU count ${String(cpuCount)}.`);
  }
  const share = configuredCpuShare(env);
  const maximumSlots = Math.min(packageCount, Math.max(1, Math.floor(cpuCount * share)));
  let bestSlots = 0;
  let bestRunnerCount = 0;

  for (let slots = 1; slots <= maximumSlots; slots += 1) {
    const perSlotBudget = Math.floor(budgetBytes / slots);
    if (perSlotBudget < minimumBudget) continue;
    const runnerShare = share / slots;
    const runnersPerSlot = workerCount({
      perWorkerBytes: STRYKER_RUNNER_BYTES,
      baseBytes: STRYKER_PARENT_BYTES,
      budgetBytes: perSlotBudget,
      env: { ...env, GATE_CPU_SHARE: String(runnerShare) },
      availableParallelism,
    });
    const totalRunners = slots * runnersPerSlot;
    if (totalRunners > bestRunnerCount || (totalRunners === bestRunnerCount && slots > bestSlots)) {
      bestSlots = slots;
      bestRunnerCount = totalRunners;
    }
  }

  if (bestSlots === 0) {
    throw new Error(
      `Gate memory budget ${budgetBytes} bytes is below the minimum ${minimumBudget} bytes ` +
        `(STRYKER_PARENT_BYTES ${STRYKER_PARENT_BYTES} + STRYKER_RUNNER_BYTES ${STRYKER_RUNNER_BYTES}).`,
    );
  }
  return { slots: bestSlots, cpuShare: share / bestSlots };
}

/** Size Vitest workers only while Vitest evaluates the config; production builds leave it unset. */
export function vitestMaxWorkers({ env = process.env, ...injectables } = {}) {
  if (env?.VITEST !== "true") return undefined;
  if (env?.STRYKER_MEMORY_BYTES !== undefined) return 1;

  return workerCount({
    perWorkerBytes: VITEST_WORKER_BYTES,
    baseBytes: VITEST_BASE_BYTES,
    env,
    ...injectables,
  });
}
