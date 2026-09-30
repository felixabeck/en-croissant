// @vitest-environment node
import { describe, expect, test, vi } from "vitest";
import {
  VITEST_BASE_BYTES,
  VITEST_WORKER_BYTES,
  vitestMaxWorkers,
  workerCount,
} from "./gate-parallelism.mjs";

const TWO_GIB = 2 * 1024 ** 3;

async function withEnvironment(updates, run) {
  const keys = Object.keys(updates);
  const previous = new Map(keys.map((key) => [key, process.env[key]]));
  try {
    for (const [key, value] of Object.entries(updates)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    vi.resetModules();
    return await run();
  } finally {
    for (const [key, value] of previous) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    vi.resetModules();
  }
}

describe("Vitest worker budget wiring", () => {
  test("vite.config.ts derives maxWorkers from the fixed gate memory budget", async () => {
    await withEnvironment(
      {
        GATE_MEMORY_BYTES: String(TWO_GIB),
        STRYKER_MEMORY_BYTES: undefined,
        VITEST: "true",
      },
      async () => {
        const { default: config } = await import("../vite.config.ts");
        expect(config.test.maxWorkers).toBe(
          workerCount({
            perWorkerBytes: VITEST_WORKER_BYTES,
            baseBytes: VITEST_BASE_BYTES,
            budgetBytes: TWO_GIB,
            env: process.env,
          }),
        );
      },
    );
  });

  test("vite.config.ts uses one worker under Stryker without a gate budget", async () => {
    await withEnvironment(
      {
        GATE_MEMORY_BYTES: undefined,
        STRYKER_MEMORY_BYTES: "256",
        VITEST: "true",
      },
      async () => {
        const { default: config } = await import("../vite.config.ts");
        expect(config.test.maxWorkers).toBe(1);
      },
    );
  });

  test("the Stryker path does not read injected unreadable cgroup files", () => {
    let reads = 0;
    expect(
      vitestMaxWorkers({
        env: { VITEST: "true", STRYKER_MEMORY_BYTES: "256" },
        readFileSync() {
          reads += 1;
          throw new Error("cgroup is unreadable");
        },
        statSync() {
          reads += 1;
          throw new Error("cgroup is unreadable");
        },
      }),
    ).toBe(1);
    expect(reads).toBe(0);
  });
});
