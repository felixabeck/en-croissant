import assert from "node:assert/strict";
import { chmod, mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

const checker = join(process.cwd(), "scripts", "check-ui-boundaries.mjs");

async function runChecker(listedPath, prepare) {
  const root = await mkdtemp(join(tmpdir(), "ui-boundaries-"));
  const bin = join(root, "bin");
  await mkdir(join(root, "src"), { recursive: true });
  await mkdir(bin);
  await prepare(root);

  const fakeGit = join(bin, "git");
  await writeFile(
    fakeGit,
    `#!/bin/sh
case "$*" in
  *"--others"*) ;;
  *) printf '%s\\n' '${listedPath}' ;;
esac
`,
  );
  await chmod(fakeGit, 0o755);

  return spawnSync(process.execPath, [checker], {
    cwd: root,
    encoding: "utf8",
    env: {
      ...process.env,
      PATH: [bin, process.env.PATH].filter(Boolean).join(delimiter),
    },
  });
}

test("skips a source file removed by an uncommitted deletion", async () => {
  const result = await runChecker("src/missing.ts", async () => {});

  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.error, undefined);
});

test("rethrows a source read failure that is not ENOENT", async () => {
  const result = await runChecker("src/unreadable.ts", async (root) => {
    await mkdir(join(root, "src", "unreadable.ts"));
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /EISDIR/);
});
