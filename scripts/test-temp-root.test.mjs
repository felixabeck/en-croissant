import { rm, stat } from "node:fs/promises";
import { expect, test } from "vitest";
import { testTempRoots } from "./test-temp-root.mjs";

test("removes every created temporary root when the registered teardown runs", async () => {
  let teardown;
  const temporaryRoot = testTempRoots((hook) => {
    teardown = hook;
  });
  const roots = [];
  try {
    roots.push(await temporaryRoot("test-temp-root-"));
    roots.push(await temporaryRoot("test-temp-root-"));
    for (const root of roots) {
      expect((await stat(root)).isDirectory()).toBe(true);
    }

    await teardown();

    for (const root of roots) {
      await expect(stat(root)).rejects.toMatchObject({ code: "ENOENT" });
    }
  } finally {
    await Promise.all(roots.map((root) => rm(root, { recursive: true, force: true })));
  }
});
