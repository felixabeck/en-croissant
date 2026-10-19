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

/**
 * Use real Git as the stderr oracle for a non-repository fixture. Discovery
 * diagnostics differ when Git reaches a filesystem boundary, so checker tests
 * must preserve that diagnostic without hardcoding its environment's wording.
 */
export function gitDiscoveryStderr(root) {
  const result = spawnSync(
    "git",
    ["ls-files", "--others", "--exclude-standard", "-z", "--", "src"],
    { cwd: root, encoding: "utf8" },
  );
  assert.ifError(result.error);
  assert.equal(result.status, 128, result.stderr);
  assert.equal(result.stdout, "");
  assert.notEqual(result.stderr.trim(), "");
  return result.stderr.trim();
}
