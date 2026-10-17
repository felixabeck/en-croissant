import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

export function testTempRoots(after) {
  const roots = [];
  // Register at suite scope so existing test teardown can still use the fixtures.
  after(async () => {
    const results = await Promise.allSettled(
      roots.map((root) => rm(root, { recursive: true, force: true })),
    );
    const errors = results
      .filter((result) => result.status === "rejected")
      .map((result) => result.reason);
    if (errors.length) throw new AggregateError(errors, "Failed to remove test temporary roots");
  });
  return async (prefix) => {
    const root = await mkdtemp(join(tmpdir(), prefix));
    roots.push(root);
    return root;
  };
}
