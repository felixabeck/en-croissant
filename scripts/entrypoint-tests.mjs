import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { isEntrypoint } from "./entrypoint.mjs";

const helperPath = resolve(dirname(fileURLToPath(import.meta.url)), "entrypoint.mjs");

test("isEntrypoint matches the started script on a path with a space", () => {
  const script = resolve("probe dir", "gate.mjs");
  const url = pathToFileURL(script).href;
  assert.match(url, /probe%20dir/);
  assert.equal(isEntrypoint(url, ["node", script]), true);
  assert.equal(isEntrypoint(url, ["node", "probe dir/gate.mjs"]), true);
});

test("isEntrypoint refuses another module and a missing argv[1]", () => {
  const script = resolve("probe dir", "gate.mjs");
  const url = pathToFileURL(script).href;
  assert.equal(isEntrypoint(url, ["node", resolve("probe dir", "other.mjs")]), false);
  assert.equal(
    isEntrypoint(pathToFileURL(resolve("probe dir", "lib.mjs")).href, ["node", script]),
    false,
  );
  assert.equal(isEntrypoint(url, ["node"]), false);
  assert.equal(isEntrypoint(url, []), false);
});

test("a real Node process on a path with a space runs its guarded main", async () => {
  const root = await mkdtemp(join(tmpdir(), "entrypoint probe-"));
  const script = join(root, "gate.mjs");
  await writeFile(
    script,
    [
      `import { isEntrypoint } from ${JSON.stringify(pathToFileURL(helperPath).href)};`,
      'console.log(isEntrypoint(import.meta.url) ? "ran" : "skipped");',
      "",
    ].join("\n"),
  );
  assert.match(root, / /);
  const direct = spawnSync(process.execPath, [script], { encoding: "utf8" });
  assert.equal(direct.status, 0, direct.stderr);
  assert.equal(direct.stdout.trim(), "ran");
  const relative = spawnSync(process.execPath, ["gate.mjs"], { cwd: root, encoding: "utf8" });
  assert.equal(relative.status, 0, relative.stderr);
  assert.equal(relative.stdout.trim(), "ran");
});
