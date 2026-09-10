import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

export function gitInit(root) {
  const result = spawnSync("git", ["init", "--quiet"], { cwd: root, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
}

/**
 * Stage `paths` so `git ls-files` reports them as tracked. Staging is enough —
 * a fixture needs no commit, and no user identity — but it is necessary: a
 * fixture whose files are all untracked exercises only the walker's
 * `--others` query and would stay green if the tracked query broke.
 */
export function gitTrack(root, ...paths) {
  const result = spawnSync("git", ["add", "--", ...paths], { cwd: root, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
}
