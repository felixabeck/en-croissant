import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmod, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { delimiter, dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { playwrightArguments } from "./run-e2e-container.mjs";

const scripts = dirname(fileURLToPath(import.meta.url));
const directoryTrash = "--grep=localizes directory-trash";

// pnpm retains a caller's `--` (measured 2026-09-27, pnpm 10.34.5); these are the argv tails
// the package scripts actually receive, not hypothetical inputs (`f-20260910-07`).
test("the separator pnpm retains is dropped so selection reaches Playwright as options", () => {
  assert.deepEqual(
    playwrightArguments(["--update-snapshots", "--", "--project=async-errors", "--grep=trash"]),
    ["--update-snapshots", "--project=async-errors", "--grep=trash"],
  );
  assert.deepEqual(playwrightArguments(["--", "--project=async-errors"]), [
    "--project=async-errors",
  ]);
});

test("a separator-free invocation is forwarded unchanged", () => {
  const forwarded = ["--update-snapshots", "--project=async-errors", "--grep=trash"];
  assert.deepEqual(playwrightArguments(forwarded), forwarded);
  assert.deepEqual(playwrightArguments([]), []);
});

test("only the first separator is pnpm's; a later one is the caller's own", () => {
  assert.deepEqual(playwrightArguments(["--", "--project=a", "--", "spec.ts"]), [
    "--project=a",
    "--",
    "spec.ts",
  ]);
});

// The launchers themselves, not only the helper: a launcher that stopped calling it would
// leave the unit tests above green while the scoped run widened to the whole suite again.
test("the container launcher hands Playwright the selection as options", async () => {
  const bin = await mkdtemp(join(tmpdir(), "fake-docker-"));
  const record = join(bin, "argv.json");
  const docker = join(bin, "docker");
  await writeFile(
    docker,
    [
      "#!/usr/bin/env node",
      'const { writeFileSync } = require("node:fs");',
      'if (process.argv[2] === "run") {',
      `  writeFileSync(${JSON.stringify(record)}, JSON.stringify(process.argv.slice(2)));`,
      "}",
      "",
    ].join("\n"),
  );
  await chmod(docker, 0o755);
  const run = spawnSync(
    process.execPath,
    [
      join(scripts, "run-e2e-container.mjs"),
      "--update-snapshots",
      "--",
      "--project=async-errors",
      directoryTrash,
    ],
    { encoding: "utf8", env: { ...process.env, PATH: `${bin}${delimiter}${process.env.PATH}` } },
  );
  assert.equal(run.status, 0, run.stderr);
  const argv = JSON.parse(await readFile(record, "utf8"));
  assert.deepEqual(argv.slice(argv.indexOf("test")), [
    "test",
    "--update-snapshots",
    "--project=async-errors",
    directoryTrash,
  ]);
});

test("the native launcher selects only the named test through pnpm's separator", () => {
  // `--list` sits before the separator, so a regression lists the whole suite instead of
  // running it.
  const run = spawnSync(
    process.execPath,
    [join(scripts, "run-e2e-native.mjs"), "--list", "--", "--project=async-errors", directoryTrash],
    { cwd: resolve(scripts, ".."), encoding: "utf8" },
  );
  assert.equal(run.status, 0, run.stderr);
  assert.match(
    run.stdout,
    /\[async-errors\] › async-errors\.spec\.ts:\d+:\d+ › async-errors: localizes directory-trash/,
  );
  assert.match(run.stdout, /Total: 1 test in 1 file/);
});
