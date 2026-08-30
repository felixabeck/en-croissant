#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import {
  chmodSync,
  copyFileSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { arch, platform, release, tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { playwrightImage } from "./playwright-image.mjs";
import { RUST_COVERAGE_TOOLCHAIN } from "./toolchain-versions.mjs";

export const GATES = Object.freeze({
  "backend-test": "cargo test --manifest-path src-tauri/Cargo.toml --all-targets",
  "backend-coverage": "pnpm test:coverage:backend && pnpm coverage:backend:check",
  "frontend-coverage": "pnpm test:coverage && pnpm coverage:frontend:check",
  "frontend-build": "pnpm build-vite",
  "e2e-container": "pnpm test:e2e:container",
  "tauri-build": "pnpm build",
});

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const RECEIPT_DIRECTORY = ".gate-receipts";
const SCHEMA_VERSION = 1;
const DEFAULT_TTL_MS = 12 * 60 * 60 * 1000;
const EXIT_MISS = 1;
const EXIT_USAGE = 2;
const EXIT_PROOF_NOT_ESTABLISHED = 3;
const GIT_ENVIRONMENT_KEYS = [
  "GIT_INDEX_FILE",
  "GIT_DIR",
  "GIT_WORK_TREE",
  "GIT_OBJECT_DIRECTORY",
  "GIT_ALTERNATE_OBJECT_DIRECTORIES",
  "GIT_COMMON_DIR",
];

const REQUIRED_TOOLS = Object.freeze({
  "backend-test": ["rustc", "cargo"],
  "backend-coverage": ["rustc", "cargo", "nightly", "cargo-llvm-cov", "node", "pnpm"],
  "frontend-coverage": ["node", "pnpm"],
  "frontend-build": ["node", "pnpm"],
  "e2e-container": ["node", "pnpm", "playwright-image"],
  "tauri-build": ["rustc", "cargo", "node", "pnpm"],
});

function gitEnvironment(overrides = {}) {
  const environment = { ...process.env };
  for (const key of GIT_ENVIRONMENT_KEYS) delete environment[key];
  return { ...environment, ...overrides };
}

function capture(command, argumentsList, cwd) {
  const result = spawnSync(command, argumentsList, {
    cwd,
    encoding: "utf8",
    env: gitEnvironment(),
  });
  if (result.error || result.status !== 0) return undefined;
  const output = [result.stdout, result.stderr]
    .filter((part) => part?.trim())
    .map((part) => part.trim())
    .join("\n");
  return output || undefined;
}

function toolchainFingerprint(gate, repoRoot) {
  const probes = {
    rustc: () => capture("rustc", ["--version"], repoRoot),
    cargo: () => capture("cargo", ["--version"], repoRoot),
    nightly: () => {
      const version = capture(
        "rustup",
        ["run", RUST_COVERAGE_TOOLCHAIN, "rustc", "--version"],
        repoRoot,
      );
      return version ? `${RUST_COVERAGE_TOOLCHAIN}\n${version}` : undefined;
    },
    "cargo-llvm-cov": () => capture("cargo", ["llvm-cov", "--version"], repoRoot),
    node: () => capture("node", ["--version"], repoRoot),
    pnpm: () => capture("pnpm", ["--version"], repoRoot),
    "playwright-image": () => {
      try {
        return playwrightImage();
      } catch {
        return undefined;
      }
    },
  };
  const fingerprint = {};
  for (const name of REQUIRED_TOOLS[gate]) {
    const value = probes[name]();
    if (!value) return undefined;
    fingerprint[name] = value;
  }
  return fingerprint;
}

function git(repoRoot, argumentsList, environment = gitEnvironment()) {
  const result = spawnSync("git", ["-C", repoRoot, ...argumentsList], {
    encoding: "utf8",
    env: environment,
  });
  if (result.error || result.status !== 0) return undefined;
  return result.stdout.trim();
}

function treeFingerprint(repoRoot) {
  const temporaryDirectory = mkdtempSync(join(tmpdir(), "gate-receipt-index-"));
  try {
    const indexName = git(repoRoot, ["rev-parse", "--git-path", "index"]);
    if (!indexName) return undefined;
    const indexPath = resolve(repoRoot, indexName);
    const temporaryIndex = join(temporaryDirectory, "index");
    copyFileSync(indexPath, temporaryIndex);
    const environment = gitEnvironment({ GIT_INDEX_FILE: temporaryIndex });
    if (git(repoRoot, ["add", "-A"], environment) === undefined) return undefined;
    return git(repoRoot, ["write-tree"], environment);
  } catch {
    return undefined;
  } finally {
    rmSync(temporaryDirectory, { force: true, recursive: true });
  }
}

function treeState(repoRoot) {
  try {
    const statusBefore = git(repoRoot, ["status", "--porcelain=v1", "--untracked-files=all"]);
    if (statusBefore === undefined) return undefined;
    const tree = treeFingerprint(repoRoot);
    if (!tree) return undefined;
    const statusAfter = git(repoRoot, ["status", "--porcelain=v1", "--untracked-files=all"]);
    if (statusAfter === undefined) return undefined;
    return { clean: statusBefore === "" && statusAfter === "", tree };
  } catch {
    return undefined;
  }
}

function trackedFileMetadata(repoRoot) {
  const result = spawnSync("git", ["-C", repoRoot, "ls-files", "-z"], {
    encoding: "utf8",
    env: gitEnvironment(),
  });
  if (result.error || result.status !== 0) return undefined;
  try {
    const paths = result.stdout.split("\0");
    if (paths.at(-1) === "") paths.pop();
    return JSON.stringify(
      paths.map((path) => {
        try {
          const stats = lstatSync(join(repoRoot, path), { bigint: true });
          return [path, stats.size.toString(), stats.mtimeNs.toString()];
        } catch (error) {
          if (error?.code === "ENOENT") return [path, null, null];
          throw error;
        }
      }),
    );
  } catch {
    return undefined;
  }
}

function receiptPath(repoRoot, gate) {
  return join(repoRoot, RECEIPT_DIRECTORY, `${gate}.json`);
}

function removeReceipt(repoRoot, gate) {
  try {
    unlinkSync(receiptPath(repoRoot, gate));
    return true;
  } catch (error) {
    return error?.code === "ENOENT";
  }
}

function readReceipt(repoRoot, gate) {
  try {
    const payload = JSON.parse(readFileSync(receiptPath(repoRoot, gate), "utf8"));
    return payload && typeof payload === "object" && !Array.isArray(payload) ? payload : undefined;
  } catch {
    return undefined;
  }
}

function writeReceipt(repoRoot, gate, payload) {
  const directory = join(repoRoot, RECEIPT_DIRECTORY);
  const path = receiptPath(repoRoot, gate);
  const temporaryPath = `${path}.tmp-${process.pid}-${Date.now()}`;
  try {
    mkdirSync(directory, { recursive: true, mode: 0o700 });
    writeFileSync(temporaryPath, `${JSON.stringify(payload, null, 2)}\n`, {
      encoding: "utf8",
      mode: 0o600,
      flag: "wx",
    });
    renameSync(temporaryPath, path);
    chmodSync(path, 0o600);
    return true;
  } catch {
    try {
      unlinkSync(temporaryPath);
    } catch {
      // The temporary file may never have been created.
    }
    return false;
  }
}

function receiptStatus({ gate, repoRoot, now, ttlMs, fingerprintToolchain, command }) {
  const state = treeState(repoRoot);
  if (!state) return { hit: false, reason: "tree fingerprint unavailable" };
  if (!state.clean) return { hit: false, reason: "working tree is dirty" };
  const toolchain = fingerprintToolchain(gate, repoRoot);
  if (!toolchain) return { hit: false, reason: "toolchain fingerprint unavailable" };
  const payload = readReceipt(repoRoot, gate);
  if (!payload) return { hit: false, reason: "receipt is absent or unreadable" };
  const createdAt = Date.parse(payload.createdAt);
  const age = now() - createdAt;
  if (
    payload.schemaVersion !== SCHEMA_VERSION ||
    payload.gate !== gate ||
    payload.tree !== state.tree ||
    payload.command !== command ||
    payload.platform !== `${platform()}-${arch()}-${release()}` ||
    JSON.stringify(payload.toolchain) !== JSON.stringify(toolchain) ||
    !Number.isFinite(createdAt) ||
    age < 0 ||
    age > ttlMs
  ) {
    return { hit: false, reason: "receipt does not match the exact current tree" };
  }
  const finalState = treeState(repoRoot);
  if (!finalState?.clean || finalState.tree !== state.tree) {
    return { hit: false, reason: "tree changed while the receipt was checked" };
  }
  return { hit: true, reason: `exact tree verified ${Math.floor(age / 60000)} minutes ago` };
}

function runGate({ gate, repoRoot, now, fingerprintToolchain, command, output }) {
  if (!removeReceipt(repoRoot, gate)) {
    output.error(`gate receipt unavailable: ${gate} — stale receipt could not be removed`);
    return EXIT_USAGE;
  }

  const before = treeState(repoRoot);
  const toolchain = fingerprintToolchain(gate, repoRoot);
  const metadataBefore = trackedFileMetadata(repoRoot);
  output.log(`gate running: ${gate}`);
  output.log(`  command: ${command}`);
  const result = spawnSync(command, {
    cwd: repoRoot,
    env: process.env,
    shell: true,
    stdio: "inherit",
  });
  if (result.error) {
    output.error(`gate could not start: ${result.error.message}`);
    return EXIT_USAGE;
  }
  if (result.status !== 0) {
    const status = result.status ?? (result.signal ? 128 : EXIT_USAGE);
    output.error(`gate failed: ${gate} (exit ${status})`);
    return status;
  }

  output.log(`gate passed: ${gate}`);
  const after = treeState(repoRoot);
  const metadataAfter = trackedFileMetadata(repoRoot);
  // Tree hashes detect persistent content changes; tracked-file size/mtime_ns snapshots also
  // detect a tracked file rewritten and restored when the filesystem records a new mtime.
  // Residual window: a mutation and revert entirely between the two samples, within one mtime
  // granularity tick, can remain undetected.
  if (
    !before ||
    !after ||
    !metadataBefore ||
    !metadataAfter ||
    before.tree !== after.tree ||
    metadataBefore !== metadataAfter
  ) {
    output.error(`gate receipt refused: ${gate} — tree changed during the gate`);
    return EXIT_PROOF_NOT_ESTABLISHED;
  }
  if (!before.clean || !after.clean) {
    output.log(`gate receipt not recorded: ${gate} — working tree is dirty`);
    return 0;
  }
  if (!toolchain) {
    output.log(`gate receipt not recorded: ${gate} — toolchain fingerprint unavailable`);
    return 0;
  }

  const finalState = treeState(repoRoot);
  if (!finalState?.clean || finalState.tree !== before.tree) {
    output.error(`gate receipt refused: ${gate} — tree changed before receipt writing`);
    return EXIT_PROOF_NOT_ESTABLISHED;
  }
  const payload = {
    schemaVersion: SCHEMA_VERSION,
    gate,
    tree: before.tree,
    command,
    platform: `${platform()}-${arch()}-${release()}`,
    toolchain,
    createdAt: new Date(now()).toISOString(),
  };
  if (!writeReceipt(repoRoot, gate, payload)) {
    output.log(`gate passed but receipt could not be written: ${gate}`);
    return 0;
  }
  output.log(`gate receipt recorded: ${gate} (${before.tree.slice(0, 12)})`);
  return 0;
}

export function executeAction({
  action,
  gate,
  repoRoot = projectRoot,
  now = Date.now,
  ttlMs = DEFAULT_TTL_MS,
  fingerprintToolchain = toolchainFingerprint,
  command = GATES[gate],
  output = console,
}) {
  if (!Object.hasOwn(GATES, gate) || !["check", "ensure", "run"].includes(action)) {
    output.error("Usage: gate-receipt.mjs <check|ensure|run> <gate>");
    return EXIT_USAGE;
  }
  if (action !== "run") {
    const status = receiptStatus({
      gate,
      repoRoot,
      now,
      ttlMs,
      fingerprintToolchain,
      command,
    });
    output.log(`gate receipt ${status.hit ? "valid" : "miss"}: ${gate} — ${status.reason}`);
    if (status.hit) return 0;
    if (action === "check") return EXIT_MISS;
  }
  return runGate({ gate, repoRoot, now, fingerprintToolchain, command, output });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exitCode = executeAction({ action: process.argv[2], gate: process.argv[3] });
}
