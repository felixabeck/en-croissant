import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import {
  AGENT_RESERVE_BYTES,
  gateBudgetBytes,
  memoryLimitBytes,
  STRYKER_PARENT_BYTES,
  STRYKER_RUNNER_BYTES,
  strykerSlots,
  VITEST_BASE_BYTES,
  vitestMaxWorkers,
  VITEST_WORKER_BYTES,
  workerCount,
} from "./gate-parallelism.mjs";

const GIB = 1024 ** 3;
const MIB = 1024 ** 2;
const CGROUP_ROOT = "/sys/fs/cgroup";
const PROCESS_CGROUP_FILE = "/proc/self/cgroup";
const CGROUP_PATH = "/tenant/agent";
const CGROUP_DIRECTORY = resolve(CGROUP_ROOT, `.${CGROUP_PATH}`);
const CGROUP_PARENT = dirname(CGROUP_DIRECTORY);

function fakeFsError(code, path) {
  return Object.assign(new Error(`${code}: ${path}`), { code });
}

function ancestors(directory) {
  const result = [];
  for (let current = directory; ; current = dirname(current)) {
    result.push(current);
    if (current === CGROUP_ROOT) return result;
  }
}

function linuxFixture({
  includeProc = true,
  procContents = `0::${CGROUP_PATH}\n`,
  directories = ancestors(CGROUP_DIRECTORY),
  memory = {},
  fileContents = {},
  readFailures = {},
  totalmemBytes = 32 * GIB,
} = {}) {
  const directorySet = new Set(directories);
  const files = new Map(Object.entries(fileContents));
  const failures = new Map(Object.entries(readFailures));
  if (includeProc) files.set(PROCESS_CGROUP_FILE, procContents);
  for (const [directory, contents] of Object.entries(memory)) {
    files.set(join(directory, "memory.max"), `${contents}\n`);
  }

  return {
    readFileSync(path) {
      if (failures.has(path)) throw failures.get(path);
      if (files.has(path)) return files.get(path);
      throw fakeFsError("ENOENT", path);
    },
    statSync(path) {
      if (!directorySet.has(path)) throw fakeFsError("ENOENT", path);
      return { isDirectory: () => true };
    },
    totalmem: () => totalmemBytes,
    platform: "linux",
  };
}

function detectionErrorAt(path) {
  return (error) =>
    error instanceof Error &&
    error.message.includes(path) &&
    error.message.includes("GATE_MEMORY_BYTES");
}

test("memoryLimitBytes selects the minimum memory.max along the process cgroup path", () => {
  const fixture = linuxFixture({
    memory: {
      [CGROUP_DIRECTORY]: `${6 * GIB}`,
      [CGROUP_PARENT]: `${5 * GIB}`,
      [CGROUP_ROOT]: `${12 * GIB}`,
    },
  });
  assert.equal(memoryLimitBytes(fixture), 5 * GIB);
});

test("memoryLimitBytes treats max as unlimited", () => {
  const fixture = linuxFixture({
    totalmemBytes: 8 * GIB,
    memory: {
      [CGROUP_DIRECTORY]: "max",
      [CGROUP_PARENT]: "max",
      [CGROUP_ROOT]: "max",
    },
  });
  assert.equal(memoryLimitBytes(fixture), 8 * GIB);
});

test("memoryLimitBytes bounds a finite cgroup limit by os.totalmem()", () => {
  const fixture = linuxFixture({
    totalmemBytes: 8 * GIB,
    memory: { [CGROUP_DIRECTORY]: `${12 * GIB}` },
  });
  assert.equal(memoryLimitBytes(fixture), 8 * GIB);
});

test("memoryLimitBytes skips ENOENT memory.max files while retaining a lower existing limit", () => {
  const fixture = linuxFixture({
    memory: { [CGROUP_DIRECTORY]: `${4 * GIB}` },
  });
  assert.equal(memoryLimitBytes(fixture), 4 * GIB);
});

test("memoryLimitBytes reports EACCES on memory.max with its path and override guidance", () => {
  const path = join(CGROUP_DIRECTORY, "memory.max");
  const fixture = linuxFixture({
    readFailures: { [path]: fakeFsError("EACCES", path) },
  });
  assert.throws(() => memoryLimitBytes(fixture), detectionErrorAt(path));
});

test("memoryLimitBytes rejects an unparsable memory.max value with its path", () => {
  const path = join(CGROUP_DIRECTORY, "memory.max");
  const fixture = linuxFixture({ memory: { [CGROUP_DIRECTORY]: "not-a-number" } });
  assert.throws(() => memoryLimitBytes(fixture), detectionErrorAt(path));
});

test("memoryLimitBytes reports a missing /proc/self/cgroup with override guidance", () => {
  const fixture = linuxFixture({ includeProc: false });
  assert.throws(() => memoryLimitBytes(fixture), detectionErrorAt(PROCESS_CGROUP_FILE));
});

test("memoryLimitBytes rejects a missing own cgroup directory when every directory is ENOENT", () => {
  const fixture = linuxFixture({ directories: [] });
  assert.throws(() => memoryLimitBytes(fixture), detectionErrorAt(CGROUP_DIRECTORY));
});

test("memoryLimitBytes rejects a missing own cgroup directory even when an ancestor has a finite limit", () => {
  const fixture = linuxFixture({
    directories: [CGROUP_PARENT, CGROUP_ROOT],
    memory: { [CGROUP_PARENT]: `${4 * GIB}` },
  });
  assert.throws(() => memoryLimitBytes(fixture), detectionErrorAt(CGROUP_DIRECTORY));
});

test("memoryLimitBytes rejects cgroup-v1 content without a 0:: line", () => {
  const fixture = linuxFixture({ procContents: "5:memory:/tenant/agent\n" });
  assert.throws(() => memoryLimitBytes(fixture), detectionErrorAt(PROCESS_CGROUP_FILE));
});

test("memoryLimitBytes uses os.totalmem() without cgroup reads on non-Linux platforms", () => {
  let reads = 0;
  const totalmemBytes = 12 * GIB;
  assert.equal(
    memoryLimitBytes({
      platform: "darwin",
      totalmem: () => totalmemBytes,
      readFileSync() {
        reads += 1;
        throw new Error("must not read cgroup files");
      },
      statSync() {
        reads += 1;
        throw new Error("must not stat cgroup directories");
      },
    }),
    totalmemBytes,
  );
  assert.equal(reads, 0);
});

test("gateBudgetBytes uses a valid GATE_MEMORY_BYTES override ahead of cgroup detection", () => {
  const fixture = linuxFixture({ memory: { [CGROUP_DIRECTORY]: "100" } });
  assert.equal(gateBudgetBytes({ ...fixture, env: { GATE_MEMORY_BYTES: "123456" } }), 123456);
});

for (const value of ["abc", "0", "-1", "1.5", ""]) {
  test(`gateBudgetBytes rejects GATE_MEMORY_BYTES=${JSON.stringify(value)}`, () => {
    assert.throws(
      () => gateBudgetBytes({ env: { GATE_MEMORY_BYTES: value } }),
      (error) => error instanceof Error && error.message.includes("GATE_MEMORY_BYTES"),
    );
  });
}

test("gateBudgetBytes does not read an unreadable cgroup when GATE_MEMORY_BYTES is set", () => {
  let reads = 0;
  assert.equal(
    gateBudgetBytes({
      env: { GATE_MEMORY_BYTES: "987654" },
      platform: "linux",
      readFileSync() {
        reads += 1;
        throw fakeFsError("EACCES", "cgroup file");
      },
      statSync() {
        reads += 1;
        throw fakeFsError("EACCES", "cgroup directory");
      },
      totalmem() {
        reads += 1;
        throw new Error("must not read total memory");
      },
    }),
    987654,
  );
  assert.equal(reads, 0);
});

test("gateBudgetBytes subtracts AGENT_RESERVE_BYTES exactly from the injected cgroup limit", () => {
  const fixture = linuxFixture({ memory: { [CGROUP_DIRECTORY]: `${7 * GIB}` } });
  assert.equal(gateBudgetBytes({ ...fixture, env: {} }), 7 * GIB - AGENT_RESERVE_BYTES);
});

test("workerCount rejects a budget below baseBytes plus one worker and names both byte counts", () => {
  assert.throws(
    () => workerCount({ perWorkerBytes: 40, baseBytes: 60, budgetBytes: 99 }),
    (error) =>
      error instanceof Error &&
      error.message.includes("99 bytes") &&
      error.message.includes("100 bytes"),
  );
});

test("workerCount returns 24 for the 24 CPU, 8 GiB Vitest budget fixture", () => {
  assert.equal(
    workerCount({
      perWorkerBytes: VITEST_WORKER_BYTES,
      baseBytes: VITEST_BASE_BYTES,
      budgetBytes: 8 * GIB,
      availableParallelism: () => 24,
      env: {},
    }),
    24,
  );
});

test("workerCount subtracts the base budget and returns 3 for 2 GiB workers", () => {
  assert.equal(
    workerCount({
      perWorkerBytes: 2 * GIB,
      baseBytes: VITEST_BASE_BYTES,
      budgetBytes: 8 * GIB,
      availableParallelism: () => 24,
      env: {},
    }),
    3,
  );
});

test("workerCount applies String(1 / 3) as an 8 worker cap on 24 CPUs", () => {
  assert.equal(
    workerCount({
      perWorkerBytes: MIB,
      budgetBytes: 100 * GIB,
      availableParallelism: () => 24,
      env: { GATE_CPU_SHARE: String(1 / 3) },
    }),
    8,
  );
});

for (const value of ["0", "1.5", "x", ""]) {
  test(`workerCount rejects GATE_CPU_SHARE=${JSON.stringify(value)}`, () => {
    assert.throws(
      () =>
        workerCount({
          perWorkerBytes: MIB,
          budgetBytes: 100 * GIB,
          availableParallelism: () => 24,
          env: { GATE_CPU_SHARE: value },
        }),
      (error) => error instanceof Error && error.message.includes("GATE_CPU_SHARE"),
    );
  });
}

test("workerCount stays between 1 and availableParallelism, including a single available CPU", () => {
  for (const cpuCount of [1, 2, 24]) {
    const count = workerCount({
      perWorkerBytes: MIB,
      budgetBytes: 100 * GIB,
      availableParallelism: () => cpuCount,
      env: {},
    });
    assert.ok(count >= 1);
    assert.ok(count <= cpuCount);
  }
});

test("the exported per-tool byte constants retain their measured budget values", () => {
  assert.equal(STRYKER_RUNNER_BYTES, Math.round(1.2 * GIB));
  assert.equal(STRYKER_PARENT_BYTES, 640 * MIB);
  assert.equal(VITEST_WORKER_BYTES, 256 * MIB);
  assert.equal(VITEST_BASE_BYTES, 1.5 * GIB);
});

test("strykerSlots admits three 24-CPU packages with eight runners each from a large budget", () => {
  const budgetBytes = 90 * GIB;
  const plan = strykerSlots({ budgetBytes, availableParallelism: () => 24, env: {} });
  assert.equal(plan.slots, 3);
  const runnersPerPackage = workerCount({
    perWorkerBytes: STRYKER_RUNNER_BYTES,
    baseBytes: STRYKER_PARENT_BYTES,
    budgetBytes: Math.floor(budgetBytes / plan.slots),
    availableParallelism: () => 24,
    env: { GATE_CPU_SHARE: String(plan.cpuShare) },
  });
  assert.equal(runnersPerPackage, 8);
});

test("strykerSlots gives a single-CPU package the full budget", () => {
  const budgetBytes = 90 * GIB;
  const plan = strykerSlots({ budgetBytes, availableParallelism: () => 1, env: {} });
  assert.equal(plan.slots, 1);
  assert.equal(Math.floor(budgetBytes / plan.slots), budgetBytes);
  assert.equal(plan.cpuShare, 1);
});

test("strykerSlots charges each package parent in the three-CPU discriminating budget", () => {
  const budgetBytes = 2 * STRYKER_RUNNER_BYTES + STRYKER_PARENT_BYTES;
  const plan = strykerSlots({ budgetBytes, availableParallelism: () => 3, env: {} });
  assert.equal(plan.slots, 1);
  assert.equal(Math.floor(budgetBytes / plan.slots), budgetBytes);
});

test("strykerSlots chooses five runners in one slot for the 7 GiB regression anchor", () => {
  const budgetBytes = 7 * GIB;
  const plan = strykerSlots({ budgetBytes, availableParallelism: () => 24, env: {} });
  assert.equal(plan.slots, 1);
  assert.equal(
    workerCount({
      perWorkerBytes: STRYKER_RUNNER_BYTES,
      baseBytes: STRYKER_PARENT_BYTES,
      budgetBytes: Math.floor(budgetBytes / plan.slots),
      availableParallelism: () => 24,
      env: { GATE_CPU_SHARE: String(plan.cpuShare) },
    }),
    5,
  );
});

test("strykerSlots rejects a budget below one parent plus one runner with both byte counts", () => {
  const minimumBudget = STRYKER_PARENT_BYTES + STRYKER_RUNNER_BYTES;
  for (const budgetBytes of [minimumBudget - 1, minimumBudget - minimumBudget]) {
    assert.throws(
      () => strykerSlots({ budgetBytes, availableParallelism: () => 24, env: {} }),
      (error) =>
        error instanceof Error &&
        error.message.includes(String(budgetBytes)) &&
        error.message.includes(String(minimumBudget)),
    );
  }
});

test("strykerSlots keeps the aggregate runner count within 24, 2, and 1 available CPUs", () => {
  const budgetBytes = 90 * GIB;
  for (const cpuCount of [24, 2, 1]) {
    const plan = strykerSlots({ budgetBytes, availableParallelism: () => cpuCount, env: {} });
    const runnersPerPackage = workerCount({
      perWorkerBytes: STRYKER_RUNNER_BYTES,
      baseBytes: STRYKER_PARENT_BYTES,
      budgetBytes: Math.floor(budgetBytes / plan.slots),
      availableParallelism: () => cpuCount,
      env: { GATE_CPU_SHARE: String(plan.cpuShare) },
    });
    assert.ok(plan.slots * runnersPerPackage <= cpuCount);
  }
});

test("vitestMaxWorkers leaves the production config unset without reading cgroup files", () => {
  let reads = 0;
  assert.equal(
    vitestMaxWorkers({
      env: {},
      readFileSync() {
        reads += 1;
        throw new Error("must not read cgroup files");
      },
      statSync() {
        reads += 1;
        throw new Error("must not stat cgroup directories");
      },
    }),
    undefined,
  );
  assert.equal(reads, 0);
});

test("vitestMaxWorkers returns one under Stryker without reading its budget or cgroup", () => {
  let reads = 0;
  assert.equal(
    vitestMaxWorkers({
      env: { VITEST: "true", STRYKER_MEMORY_BYTES: "256", GATE_MEMORY_BYTES: "" },
      readFileSync() {
        reads += 1;
        throw new Error("must not read cgroup files");
      },
      statSync() {
        reads += 1;
        throw new Error("must not stat cgroup directories");
      },
    }),
    1,
  );
  assert.equal(reads, 0);
});

test("Vite production config leaves test.maxWorkers undefined without VITEST", () => {
  const script = `
    import { loadConfigFromFile } from "vite";
    const loaded = await loadConfigFromFile(
      { command: "build", mode: "production" },
      "vite.config.ts",
      process.cwd(),
    );
    console.log(JSON.stringify(loaded.config.test.maxWorkers === undefined));
  `;
  const env = { ...process.env };
  delete env.GATE_MEMORY_BYTES;
  delete env.STRYKER_MEMORY_BYTES;
  delete env.VITEST;

  const result = spawnSync(process.execPath, ["--input-type=module", "-e", script], {
    cwd: process.cwd(),
    encoding: "utf8",
    env,
  });

  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.error, undefined);
  assert.equal(result.stdout.trim().split(/\r?\n/u).at(-1), "true");
});
