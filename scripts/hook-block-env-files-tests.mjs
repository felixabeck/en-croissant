import { after, test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, realpathSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const hookPath = join(repositoryRoot, ".claude/hooks/block-env-files.sh");
const parserlessBin = mkdtempSync(join(tmpdir(), "hook-block-env-files-"));

for (const command of ["cat", "grep"]) {
  const resolved = spawnSync("/bin/sh", ["-c", `command -v ${command}`], {
    encoding: "utf8",
  }).stdout.trim();
  symlinkSync(realpathSync(resolved), join(parserlessBin, command));
}

after(() => rmSync(parserlessBin, { recursive: true, force: true }));

function runHook(toolName, toolInput, { parserUnavailable = false } = {}) {
  const result = spawnSync(hookPath, {
    cwd: repositoryRoot,
    encoding: "utf8",
    env: parserUnavailable ? { ...process.env, PATH: parserlessBin } : process.env,
    input: JSON.stringify({ tool_name: toolName, tool_input: toolInput }),
  });

  assert.equal(result.signal, null, result.stderr);
  return result.status;
}

test("Read of .env -> refused", () => {
  assert.equal(runHook("Read", { file_path: ".env" }), 2);
});

test("Read of nested backend/.env.production -> refused", () => {
  assert.equal(runHook("Read", { file_path: "backend/.env.production" }), 2);
});

test("Read of .env.example -> ALLOWED", () => {
  assert.equal(runHook("Read", { file_path: ".env.example" }), 0);
  assert.equal(runHook("Read", { file_path: ".env.example" }, { parserUnavailable: true }), 0);
});

test("Read of .env.production.example -> ALLOWED", () => {
  assert.equal(runHook("Read", { file_path: ".env.production.example" }), 0);
  assert.equal(
    runHook("Read", { file_path: ".env.production.example" }, { parserUnavailable: true }),
    0,
  );
});

test("Read of an ordinary source file -> allowed", () => {
  assert.equal(runHook("Read", { file_path: "src/App.tsx" }), 0);
});

test("Bash `cat .env` -> refused", () => {
  assert.equal(runHook("Bash", { command: "cat .env" }), 2);
});

test("Bash `cp .env /tmp/example-copy` -> refused", () => {
  assert.equal(runHook("Bash", { command: "cp .env /tmp/example-copy" }), 2);
});

test("parser unavailable AND payload mentions a secret -> refused", () => {
  const secretPayloads = [
    ["Read", { file_path: ".env" }],
    ["Grep", { path: "backend/.env.production" }],
    ["Agent", { prompt: "Inspect backend/.env.production" }],
    ["Bash", { command: "cp .env /tmp/example-copy" }],
  ];

  for (const [toolName, toolInput] of secretPayloads) {
    assert.equal(runHook(toolName, toolInput, { parserUnavailable: true }), 2);
  }
});

test("parser unavailable AND payload is innocuous -> allowed", () => {
  assert.equal(runHook("Read", { file_path: "src/App.tsx" }, { parserUnavailable: true }), 0);
});
