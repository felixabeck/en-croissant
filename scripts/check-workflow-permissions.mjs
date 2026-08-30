import { spawnSync } from "node:child_process";
import { readdir, readFile } from "node:fs/promises";
import { basename, resolve } from "node:path";

export const CONTENTS_WRITE_WORKFLOWS = new Set(["release.yml"]);
export const WRITE_JOB_ALLOWED_ACTIONS = new Set([
  "actions/checkout",
  "actions/setup-node",
  "dtolnay/rust-toolchain",
  "pnpm/action-setup",
  "swatinem/rust-cache",
  "tauri-apps/tauri-action",
]);

const ACTIONLINT_PACKAGE = "github-actionlint@1.7.12";
const FULL_COMMIT_SHA = /^[0-9a-f]{40}$/iu;
const PERMISSION_VALUES = new Set(["read", "write", "none"]);

function indentation(line) {
  return /^\s*/u.exec(line)[0].length;
}

function content(line) {
  return line.trim().replace(/\s+#.*$/u, "");
}

function mappingEntry(line) {
  return /^([^:#]+):(?:\s*(.*))?$/u.exec(content(line));
}

function parsePermissions(lines, index, path, scope) {
  const entry = mappingEntry(lines[index]);
  const inline = entry?.[2] ?? "";
  if (inline) {
    if (inline === "read-all" || inline === "write-all") return inline;
    throw new Error(`${path}: ${scope}: unsupported permissions value ${inline}`);
  }

  const baseIndent = indentation(lines[index]);
  const permissions = {};
  for (let cursor = index + 1; cursor < lines.length; cursor += 1) {
    if (!content(lines[cursor])) continue;
    const currentIndent = indentation(lines[cursor]);
    if (currentIndent <= baseIndent) break;
    const permission = mappingEntry(lines[cursor]);
    if (!permission || !permission[2]) {
      throw new Error(`${path}: ${scope}: permissions must be a flat mapping`);
    }
    const name = permission[1].trim();
    const value = permission[2].trim();
    if (!PERMISSION_VALUES.has(value)) {
      throw new Error(`${path}: ${scope}: permission ${name} must be read, write, or none`);
    }
    permissions[name] = value;
  }
  return permissions;
}

function permissionValue(permissions, name) {
  if (permissions === "write-all") return "write";
  if (permissions === "read-all") return "read";
  return permissions[name] ?? "none";
}

function topLevelKeyIndex(lines, key) {
  return lines.findIndex(
    (line) => indentation(line) === 0 && mappingEntry(line)?.[1].trim() === key,
  );
}

function jobBlocks(lines, path) {
  const jobsIndex = topLevelKeyIndex(lines, "jobs");
  if (jobsIndex < 0) throw new Error(`${path}: jobs must be a mapping`);

  const blocks = [];
  let current;
  for (let index = jobsIndex + 1; index < lines.length; index += 1) {
    if (!content(lines[index])) continue;
    const indent = indentation(lines[index]);
    if (indent === 0) break;
    if (indent === 2) {
      const entry = mappingEntry(lines[index]);
      if (!entry || entry[2]) throw new Error(`${path}: every job must be a mapping`);
      current = { label: entry[1].trim(), start: index, end: lines.length };
      if (blocks.length > 0) blocks.at(-1).end = index;
      blocks.push(current);
    }
  }
  if (blocks.length === 0) throw new Error(`${path}: jobs must not be empty`);
  return blocks;
}

function jobPermissions(lines, block, path) {
  for (let index = block.start + 1; index < block.end; index += 1) {
    if (
      indentation(lines[index]) === 4 &&
      mappingEntry(lines[index])?.[1].trim() === "permissions"
    ) {
      return parsePermissions(lines, index, path, `job ${block.label}`);
    }
  }
  return undefined;
}

function jobActions(lines, block) {
  const actions = [];
  for (let index = block.start + 1; index < block.end; index += 1) {
    const match = /^\s*(?:-\s*)?uses:\s*(\S.*)$/u.exec(lines[index]);
    if (match) actions.push(content(match[1]));
  }
  return actions;
}

function allowedWriteAction(reference) {
  const separator = reference.lastIndexOf("@");
  if (separator < 0) return false;
  const name = reference.slice(0, separator);
  const revision = reference.slice(separator + 1);
  return WRITE_JOB_ALLOWED_ACTIONS.has(name) && FULL_COMMIT_SHA.test(revision);
}

export function checkWorkflowText(text, path) {
  const lines = text.split(/\r?\n/u);
  const findings = [];
  const permissionsIndex = topLevelKeyIndex(lines, "permissions");
  let workflowPermissions = {};
  if (permissionsIndex < 0) {
    findings.push(`${path}: top-level permissions must be explicit`);
  } else {
    workflowPermissions = parsePermissions(lines, permissionsIndex, path, "workflow");
    if (permissionValue(workflowPermissions, "id-token") === "write") {
      findings.push(`${path}: workflow permissions must not grant id-token: write`);
    }
    if (
      permissionValue(workflowPermissions, "contents") === "write" &&
      !CONTENTS_WRITE_WORKFLOWS.has(basename(path))
    ) {
      findings.push(`${path}: workflow contents: write is not allowlisted`);
    }
  }

  for (const block of jobBlocks(lines, path)) {
    const explicitJobPermissions = jobPermissions(lines, block, path);
    if (explicitJobPermissions && permissionValue(explicitJobPermissions, "id-token") === "write") {
      findings.push(`${path}: job ${block.label} must not grant id-token: write`);
    }
    const effectivePermissions = explicitJobPermissions ?? workflowPermissions;
    if (permissionValue(effectivePermissions, "contents") !== "write") continue;

    if (!CONTENTS_WRITE_WORKFLOWS.has(basename(path))) {
      findings.push(`${path}: job ${block.label} has non-allowlisted contents: write`);
    }
    for (const reference of jobActions(lines, block)) {
      if (!allowedWriteAction(reference)) {
        findings.push(
          `${path}: job ${block.label}: Action ${JSON.stringify(reference)} is not an allowlisted action pinned to a 40-character commit SHA`,
        );
      }
    }
  }
  return findings;
}

export async function workflowPaths(repoRoot) {
  const directory = resolve(repoRoot, ".github", "workflows");
  const entries = await readdir(directory, { withFileTypes: true });
  return entries
    .filter(
      (entry) => entry.isFile() && (entry.name.endsWith(".yml") || entry.name.endsWith(".yaml")),
    )
    .map((entry) => resolve(directory, entry.name))
    .sort();
}

export async function checkWorkflowPermissions(repoRoot) {
  const findings = [];
  for (const path of await workflowPaths(repoRoot)) {
    findings.push(...checkWorkflowText(await readFile(path, "utf8"), path));
  }
  return findings.sort();
}

function actionlint(argumentsList) {
  const probe = spawnSync("pnpm", ["dlx", ACTIONLINT_PACKAGE, "--version"], {
    encoding: "utf8",
  });
  if (probe.error || probe.status !== 0) {
    const reason =
      probe.error?.message ?? ((probe.stderr || probe.stdout).trim() || "fetch failed");
    console.warn(`actionlint: SKIP (${ACTIONLINT_PACKAGE} unavailable: ${reason})`);
    return 0;
  }

  const result = spawnSync("pnpm", ["dlx", ACTIONLINT_PACKAGE, ...argumentsList], {
    encoding: "utf8",
  });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.error) {
    console.error(`actionlint: FAIL (${result.error.message})`);
    return 1;
  }
  if (result.status !== 0) return result.status ?? 1;
  console.log(`actionlint: OK (${ACTIONLINT_PACKAGE})`);
  return 0;
}

async function main() {
  const argumentsList = process.argv.slice(2);
  if (argumentsList[0] === "--actionlint") return actionlint(argumentsList.slice(1));
  if (argumentsList.length > 0) throw new Error(`Unknown argument: ${argumentsList[0]}`);

  const findings = await checkWorkflowPermissions(process.cwd());
  if (findings.length > 0) {
    console.error("Workflow permissions check: FAIL");
    for (const finding of findings) console.error(`  * ${finding}`);
    return 1;
  }
  console.log("Workflow permissions check: OK");
  return 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main()
    .then((status) => {
      process.exitCode = status;
    })
    .catch((error) => {
      console.error(error instanceof Error ? error.message : error);
      process.exitCode = 2;
    });
}
