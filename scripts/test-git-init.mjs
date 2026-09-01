import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

export function gitInit(root) {
  const result = spawnSync("git", ["init", "--quiet"], { cwd: root, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
}
