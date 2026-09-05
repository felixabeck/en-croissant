import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, mkdir, readFile, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { fencedBlocks } from "./check-gate-routing.mjs";
import { executeAction, GATES, REQUIRED_TOOLS, TOOL_PROBES } from "./gate-receipt.mjs";

const EXPECTED_GATES = {
  "backend-test": "cargo test --manifest-path src-tauri/Cargo.toml --all-targets",
  "backend-coverage": "pnpm test:coverage:backend && pnpm coverage:backend:check",
  "frontend-coverage": "pnpm test:coverage && pnpm coverage:frontend:check",
  "frontend-mutation": "pnpm mutation:frontend",
  "frontend-build": "pnpm build-vite",
  "e2e-container": "pnpm test:e2e:container",
  "tauri-build": "pnpm build",
};
const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));

function runGit(root, ...argumentsList) {
  const result = spawnSync("git", argumentsList, { cwd: root, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
}

async function fixture() {
  const directory = await mkdtemp(join(tmpdir(), "gate-receipt-test-"));
  const root = join(directory, "repo");
  await mkdir(root);
  runGit(root, "init", "--quiet");
  await writeFile(join(root, ".gitignore"), ".gate-receipts/\n");
  await writeFile(join(root, "tracked.txt"), "initial\n");
  runGit(root, "add", ".gitignore", "tracked.txt");
  runGit(
    root,
    "-c",
    "user.name=Gate Receipt Test",
    "-c",
    "user.email=gate-receipt@example.invalid",
    "commit",
    "--quiet",
    "-m",
    "fixture",
  );
  await utimes(join(root, "tracked.txt"), new Date(0), new Date(0));
  return { directory, root };
}

function fakeToolchain(version = "one") {
  return () => ({ fake: version });
}

function nodeCommand(source) {
  return `${JSON.stringify(process.execPath)} -e ${JSON.stringify(source)}`;
}

function silentOutput() {
  return { error() {}, log() {} };
}

async function record(root, options = {}) {
  return executeAction({
    action: "run",
    gate: "frontend-build",
    repoRoot: root,
    fingerprintToolchain: fakeToolchain(),
    command: nodeCommand("process.exit(0)"),
    output: silentOutput(),
    ...options,
  });
}

test("registry maps all seven gates to their exact command strings", () => {
  assert.deepEqual(GATES, EXPECTED_GATES);
});

test("every gate fingerprints a pinned tool set, and every listed tool has a probe", () => {
  assert.deepEqual(Object.keys(REQUIRED_TOOLS).sort(), Object.keys(GATES).sort());
  assert.deepEqual(REQUIRED_TOOLS, {
    "backend-test": ["rustc", "cargo"],
    "backend-coverage": ["rustc", "cargo", "nightly", "cargo-llvm-cov", "node", "pnpm"],
    "frontend-coverage": ["node", "pnpm"],
    "frontend-mutation": ["node", "pnpm"],
    "frontend-build": ["node", "pnpm"],
    "e2e-container": ["node", "pnpm", "playwright-image"],
    "tauri-build": ["rustc", "cargo", "node", "pnpm"],
  });
  for (const tools of Object.values(REQUIRED_TOOLS)) {
    for (const tool of tools) {
      assert.equal(typeof TOOL_PROBES[tool], "function", `missing probe for ${tool}`);
    }
  }
});

test("the push skill receipt fence names every registered gate", async () => {
  const skill = await readFile(join(projectRoot, ".claude", "skills", "push", "SKILL.md"), "utf8");
  const receiptsSection = skill.slice(
    skill.indexOf("### Exact-tree gate receipts"),
    skill.indexOf("### Cross-layer contracts"),
  );
  const commands = fencedBlocks(receiptsSection)
    .map(({ contents }) => contents)
    .join("\n");
  for (const gate of Object.keys(GATES)) {
    assert.match(commands, new RegExp(`^pnpm gate:ensure ${gate}$`, "mu"));
  }
});

test("the frontend push gate fence includes frontend mutation", async () => {
  const skill = await readFile(join(projectRoot, ".claude", "skills", "push", "SKILL.md"), "utf8");
  const frontendSection = skill.slice(
    skill.indexOf("### TypeScript/React frontend"),
    skill.indexOf("### Exact-tree gate receipts"),
  );
  const commands = fencedBlocks(frontendSection)
    .map(({ contents }) => contents)
    .join("\n");
  assert.match(commands, /^pnpm gate:ensure frontend-mutation$/mu);
});

test("frontend-build records a real node and pnpm fingerprint", async () => {
  const { root } = await fixture();
  assert.equal(
    await executeAction({
      action: "run",
      gate: "frontend-build",
      repoRoot: root,
      command: nodeCommand("process.exit(0)"),
      output: silentOutput(),
    }),
    0,
  );
  const receipt = JSON.parse(
    await readFile(join(root, ".gate-receipts", "frontend-build.json"), "utf8"),
  );
  assert.deepEqual(Object.keys(receipt.toolchain).sort(), ["node", "pnpm"]);
  assert.equal(
    receipt.toolchain.node,
    execFileSync("node", ["--version"], { encoding: "utf8" }).trim(),
  );
  assert.equal(
    receipt.toolchain.pnpm,
    execFileSync("pnpm", ["--version"], { encoding: "utf8" }).trim(),
  );
});

test("a repo git cannot observe refuses the receipt as unobservable, not as a tree change", async () => {
  const root = await mkdtemp(join(tmpdir(), "gate-receipt-nongit-"));
  const messages = [];
  assert.equal(
    await executeAction({
      action: "run",
      gate: "frontend-build",
      repoRoot: root,
      fingerprintToolchain: fakeToolchain(),
      command: nodeCommand("process.exit(0)"),
      output: {
        error(message) {
          messages.push(message);
        },
        log() {},
      },
    }),
    3,
  );
  assert.match(messages.join("\n"), /could not observe the tree/u);
  assert.doesNotMatch(messages.join("\n"), /tree changed during the gate/u);
});

test("1. hit on a clean, unchanged tree", async () => {
  const { directory, root } = await fixture();
  const marker = join(directory, "runs.txt");
  const command = nodeCommand(
    `require("node:fs").appendFileSync(${JSON.stringify(marker)}, "run\\n")`,
  );
  assert.equal(await record(root, { command }), 0);
  assert.equal(
    executeAction({
      action: "ensure",
      gate: "frontend-build",
      repoRoot: root,
      fingerprintToolchain: fakeToolchain(),
      command,
      output: silentOutput(),
    }),
    0,
  );
  assert.equal(await readFile(marker, "utf8"), "run\n");
});

test("2. miss after a tracked file changes", async () => {
  const { root } = await fixture();
  assert.equal(await record(root), 0);
  await writeFile(join(root, "tracked.txt"), "committed change\n");
  runGit(root, "add", "tracked.txt");
  runGit(
    root,
    "-c",
    "user.name=Gate Receipt Test",
    "-c",
    "user.email=gate-receipt@example.invalid",
    "commit",
    "--quiet",
    "-m",
    "change tree",
  );
  assert.equal(
    executeAction({
      action: "check",
      gate: "frontend-build",
      repoRoot: root,
      fingerprintToolchain: fakeToolchain(),
      command: nodeCommand("process.exit(0)"),
      output: silentOutput(),
    }),
    1,
  );
});

test("3. miss on a dirty worktree", async () => {
  const { root } = await fixture();
  assert.equal(await record(root), 0);
  await writeFile(join(root, "untracked.txt"), "dirty\n");
  assert.equal(
    executeAction({
      action: "check",
      gate: "frontend-build",
      repoRoot: root,
      fingerprintToolchain: fakeToolchain(),
      command: nodeCommand("process.exit(0)"),
      output: silentOutput(),
    }),
    1,
  );
});

test("4. miss on a changed toolchain fingerprint", async () => {
  const { root } = await fixture();
  assert.equal(await record(root), 0);
  assert.equal(
    executeAction({
      action: "check",
      gate: "frontend-build",
      repoRoot: root,
      fingerprintToolchain: fakeToolchain("two"),
      command: nodeCommand("process.exit(0)"),
      output: silentOutput(),
    }),
    1,
  );
});

test("5. miss after TTL expiry", async () => {
  const { root } = await fixture();
  const createdAt = Date.parse("2026-08-30T00:00:00Z");
  assert.equal(await record(root, { now: () => createdAt }), 0);
  assert.equal(
    executeAction({
      action: "check",
      gate: "frontend-build",
      repoRoot: root,
      now: () => createdAt + 1001,
      ttlMs: 1000,
      fingerprintToolchain: fakeToolchain(),
      command: nodeCommand("process.exit(0)"),
      output: silentOutput(),
    }),
    1,
  );
});

test("6. miss after the gate failed (no receipt written, gate's exit code propagated)", async () => {
  const { root } = await fixture();
  const status = await record(root, { command: nodeCommand("process.exit(23)") });
  assert.equal(status, 23);
  assert.equal(existsSync(join(root, ".gate-receipts", "frontend-build.json")), false);
});

test("7. a gate that persistently modifies a tracked file leaves no receipt", async () => {
  const { root } = await fixture();
  const command = nodeCommand(
    `require("node:fs").writeFileSync(${JSON.stringify(join(root, "tracked.txt"))}, "mutated\\n")`,
  );
  assert.equal(await record(root, { command }), 3);
  assert.equal(existsSync(join(root, ".gate-receipts", "frontend-build.json")), false);
});

test("8. a gate that modifies a tracked file and restores it before exiting leaves no receipt", async () => {
  const { root } = await fixture();
  const command = nodeCommand(
    `const fs = require("node:fs"); const path = ${JSON.stringify(join(root, "tracked.txt"))}; fs.writeFileSync(path, "mutated\\n"); fs.writeFileSync(path, "initial\\n")`,
  );
  assert.equal(await record(root, { command }), 3);
  assert.equal(existsSync(join(root, ".gate-receipts", "frontend-build.json")), false);
});

test("9. a gate that modifies and restores an ignored file still gets its receipt", async () => {
  const { root } = await fixture();
  const ignoredPath = join(root, "ignored.txt");
  await writeFile(join(root, ".gitignore"), ".gate-receipts/\nignored.txt\n");
  runGit(root, "add", ".gitignore");
  runGit(
    root,
    "-c",
    "user.name=Gate Receipt Test",
    "-c",
    "user.email=gate-receipt@example.invalid",
    "commit",
    "--quiet",
    "-m",
    "ignore test file",
  );
  await writeFile(ignoredPath, "initial\n");
  const command = nodeCommand(
    `const fs = require("node:fs"); const path = ${JSON.stringify(ignoredPath)}; fs.writeFileSync(path, "mutated\\n"); fs.writeFileSync(path, "initial\\n")`,
  );
  assert.equal(await record(root, { command }), 0);
  assert.equal(existsSync(join(root, ".gate-receipts", "frontend-build.json")), true);
});

test("changed commands, changed platforms, malformed receipts, and unavailable tools are misses", async () => {
  const { root } = await fixture();
  const command = nodeCommand("process.exit(0)");
  assert.equal(await record(root, { command }), 0);
  assert.equal(
    executeAction({
      action: "check",
      gate: "frontend-build",
      repoRoot: root,
      fingerprintToolchain: fakeToolchain(),
      command: nodeCommand("process.exit(1)"),
      output: silentOutput(),
    }),
    1,
  );

  const receiptPath = join(root, ".gate-receipts", "frontend-build.json");
  const receipt = JSON.parse(await readFile(receiptPath, "utf8"));
  receipt.platform = "different-platform";
  await writeFile(receiptPath, `${JSON.stringify(receipt)}\n`);
  assert.equal(
    executeAction({
      action: "check",
      gate: "frontend-build",
      repoRoot: root,
      fingerprintToolchain: fakeToolchain(),
      command,
      output: silentOutput(),
    }),
    1,
  );

  assert.equal(
    executeAction({
      action: "check",
      gate: "frontend-build",
      repoRoot: root,
      fingerprintToolchain: () => undefined,
      command,
      output: silentOutput(),
    }),
    1,
  );

  await writeFile(receiptPath, "not json\n");
  assert.equal(
    executeAction({
      action: "check",
      gate: "frontend-build",
      repoRoot: root,
      fingerprintToolchain: fakeToolchain(),
      command: nodeCommand("process.exit(0)"),
      output: silentOutput(),
    }),
    1,
  );
});
