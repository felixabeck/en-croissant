import { readFileSync as defaultReadFileSync, statSync as defaultStatSync } from "node:fs";
import {
  availableParallelism as defaultAvailableParallelism,
  totalmem as defaultTotalmem,
} from "node:os";
import { dirname, join, resolve, sep } from "node:path";

const CGROUP_ROOT = "/sys/fs/cgroup";
const PROCESS_CGROUP_FILE = "/proc/self/cgroup";

// The agent process measured 0.32 GB RSS in its 8 GiB scope on 2026-09-30; reserve 1 GiB for
// that process plus headroom for a lens leaf or shell.
export const AGENT_RESERVE_BYTES = 1024 * 1024 * 1024;

// OOM-killed Stryker runners measured 0.40–0.49 GB anonymous memory, with the Stryker parent on
// top. The 640 MiB estimate will be re-measured before S3 uses it.
export const STRYKER_RUNNER_BYTES = 640 * 1024 * 1024;

// On 2026-09-30 in the 8 GiB agent scope, `vitest run --coverage.enabled` used 1.88 GiB above
// idle at 4 workers, 3.23 GiB at 12, and 4.58 GiB at 20: about 173 MiB per worker. 256 MiB keeps
// headroom above that measured slope.
export const VITEST_WORKER_BYTES = 256 * 1024 * 1024;

// The same 2026-09-30 Vitest measurements imply about 1.20 GiB of base memory; 1.5 GiB keeps
// headroom above that measured base.
export const VITEST_BASE_BYTES = 1536 * 1024 * 1024;

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

function parseMemoryMax(contents, path) {
  if (typeof contents !== "string") {
    throw detectionError(path, "memory.max did not contain text");
  }
  const value = contents.trim();
  if (value === "max") return undefined;
  if (!/^\d+$/u.test(value)) {
    throw detectionError(path, `unparsable memory.max value ${JSON.stringify(value)}`);
  }
  return BigInt(value);
}

function physicalMemoryLimit(totalmem, path) {
  const value = totalmem();
  if (!Number.isSafeInteger(value) || value < 0) {
    throw detectionError(path, `os.totalmem() returned an invalid byte count ${String(value)}`);
  }
  return BigInt(value);
}

/**
 * Return the smallest cgroup-v2 memory.max from the process cgroup through the mount root,
 * bounded by physical memory. Non-Linux systems have no cgroup-v2 lookup and use total memory.
 * Dependencies are supplied in the options object for deterministic tests.
 */
export function memoryLimitBytes({
  readFileSync = defaultReadFileSync,
  statSync = defaultStatSync,
  totalmem = defaultTotalmem,
  platform = process.platform,
} = {}) {
  if (platform !== "linux") return totalmem();

  let cgroupContents;
  try {
    cgroupContents = readFileSync(PROCESS_CGROUP_FILE, "utf8");
  } catch (error) {
    throw detectionError(PROCESS_CGROUP_FILE, `could not be read: ${errorMessage(error)}`, error);
  }
  const processCgroupDirectory = cgroupDirectoryFrom(cgroupContents);
  const physicalLimit = physicalMemoryLimit(totalmem, PROCESS_CGROUP_FILE);
  let minimum = physicalLimit;

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

    const memoryMaxPath = join(directory, "memory.max");
    let contents;
    try {
      contents = readFileSync(memoryMaxPath, "utf8");
    } catch (error) {
      if (error?.code === "ENOENT") continue;
      throw detectionError(memoryMaxPath, `could not be read: ${errorMessage(error)}`, error);
    }

    const limit = parseMemoryMax(contents, memoryMaxPath);
    if (limit !== undefined && limit < minimum) minimum = limit;
  }

  return Number(minimum);
}

function configuredMemoryBudget(env) {
  const value = env?.GATE_MEMORY_BYTES;
  if (value === undefined) return undefined;
  if (typeof value !== "string" || !/^\d+$/u.test(value)) {
    throw new Error(
      `GATE_MEMORY_BYTES must be a positive decimal integer in bytes (received ${JSON.stringify(value)}).`,
    );
  }
  const bytes = Number(value);
  if (!Number.isSafeInteger(bytes) || bytes <= 0) {
    throw new Error(
      `GATE_MEMORY_BYTES must be a positive decimal integer in bytes (received ${JSON.stringify(value)}).`,
    );
  }
  return bytes;
}

/** Return the available gate budget, honoring the explicit override without reading cgroups. */
export function gateBudgetBytes({ env = process.env, ...memoryOptions } = {}) {
  const override = configuredMemoryBudget(env);
  if (override !== undefined) return override;
  return memoryLimitBytes(memoryOptions) - AGENT_RESERVE_BYTES;
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
