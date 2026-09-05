import { readFile, stat } from "node:fs/promises";
import { resolve } from "node:path";
import { globToRegExp, matches } from "./coverage-scope.mjs";
import { listWorkingTreeFiles } from "./working-tree-files.mjs";

const PUSH_SKILL = ".claude/skills/push/SKILL.md";
const PACKAGE_JSON = "package.json";
const TEST_WORKFLOW = ".github/workflows/test.yml";
const VITE_CONFIG = "vite.config.ts";

const ALLOWED_CARGO_COMMANDS = new Set(["fmt", "check", "clippy", "test"]);
// This closed list mirrors the repository's deliberate test naming conventions:
// node:test uses *-tests.mjs, Vitest uses *.test.mjs, Python uses *-tests.py or
// *_test.py, and shell tests use *-tests.sh. Keeping it closed prevents arbitrary
// script names from being silently treated as tests instead of routed tools.
const TEST_FILE_PATTERNS = [
  "scripts/*-tests.mjs",
  "scripts/*.test.mjs",
  "scripts/*-tests.py",
  "scripts/*_test.py",
  "scripts/*-tests.sh",
];
const SCRIPT_RUNNERS = new Set(["node", "python", "python3", "bash", "sh"]);

export function fencedBlocks(markdown) {
  const blocks = [];
  const pattern = /^```([^\n]*)\n([\s\S]*?)^```\s*$/gmu;
  for (const match of markdown.matchAll(pattern)) {
    blocks.push({ language: match[1].trim(), contents: match[2] });
  }
  return blocks;
}

// pnpm subcommands that take a PACKAGE or a path, not a script name. Without this
// set, `pnpm dlx shellcheck@4.1.0` resolves as a nested script called "dlx" and the
// checker reports a missing script that was never referenced. Leading flags are
// skipped for the same reason: `pnpm -s lint:ci` must resolve to lint:ci, not "-s".
const PNPM_SUBCOMMANDS = new Set([
  "add",
  "audit",
  "bin",
  "config",
  "create",
  "dedupe",
  "deploy",
  "dlx",
  "env",
  "exec",
  "fetch",
  "import",
  "init",
  "install",
  "licenses",
  "link",
  "ls",
  "list",
  "outdated",
  "pack",
  "patch",
  "patch-commit",
  "prune",
  "publish",
  "rebuild",
  "recursive",
  "remove",
  "root",
  "server",
  "setup",
  "store",
  "unlink",
  "update",
  "why",
]);

function pnpmReferences(command) {
  const matches = [
    ...command.matchAll(/(?:^|[;&|]\s*|\s)pnpm((?:\s+-{1,2}[\w-]+)*)(?:\s+run)?\s+([\w:@.-]+)/gu),
  ];
  return matches
    .map((match) => match[2])
    .filter((name) => !PNPM_SUBCOMMANDS.has(name) && !name.startsWith("-"));
}

function workflowRunCommands(workflow) {
  const commands = [];
  const lines = workflow.split(/\r?\n/u);
  for (let index = 0; index < lines.length; index += 1) {
    const match = /^(\s*)run:\s*(.*)$/u.exec(lines[index]);
    if (!match) continue;
    if (match[2] !== "|") {
      commands.push(match[2]);
      continue;
    }
    const indentation = match[1].length;
    const block = [];
    while (index + 1 < lines.length) {
      const next = lines[index + 1];
      if (next.trim() && next.match(/^\s*/u)[0].length <= indentation) break;
      block.push(next.trim());
      index += 1;
    }
    commands.push(block.join("\n"));
  }
  return commands;
}

function testIncludes(viteConfig) {
  const testBlock = /test\s*:\s*\{[\s\S]*?include\s*:\s*\[([\s\S]*?)\]/u.exec(viteConfig);
  if (!testBlock) return [];
  return [...testBlock[1].matchAll(/["']([^"']+)["']/gu)].map((match) => match[1]);
}

function reviewPathGlobPatterns(pushSkill) {
  const sectionStart = pushSkill.search(/^## 3\./mu);
  if (sectionStart < 0) throw new Error(`${PUSH_SKILL} has no "## 3." section`);
  const section = pushSkill.slice(sectionStart);
  const nextHeading = section.slice(1).search(/^## /mu);
  const bounded = nextHeading < 0 ? section : section.slice(0, nextHeading + 1);
  // EVERY text block in the review section is a path-glob list: the sensitive-path
  // registry that sets the review tier, and any mandatory-lens path list beside it.
  // All of them are validated. An earlier version demanded exactly ONE block, which
  // coupled "the glob registry" to "the only fenced text here" and broke the moment a
  // second, entirely legitimate list was added.
  const blocks = fencedBlocks(bounded).filter((block) => block.language === "text");
  if (blocks.length === 0) {
    throw new Error(`${PUSH_SKILL} has no path-glob text block in its "## 3." section`);
  }
  return blocks.flatMap((block) =>
    block.contents
      .split(/\r?\n/u)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#")),
  );
}

function validateGateCommands(pushSkill, scripts, repoRoot) {
  const findings = [];
  const bashBlocks = fencedBlocks(pushSkill).filter((block) =>
    ["bash", "sh", "shell"].includes(block.language),
  );
  const routed = new Set();
  const pending = [];
  const directGateCommands = [];

  for (const block of bashBlocks) {
    for (const rawLine of block.contents.split(/\r?\n/u)) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;
      directGateCommands.push(line);
      const pnpmScripts = pnpmReferences(line);
      if (pnpmScripts.length > 0) {
        pending.push(...pnpmScripts.map((name) => ({ name, source: PUSH_SKILL })));
        continue;
      }
      const cargo = /^cargo\s+(\w+)/u.exec(line);
      if (cargo && ALLOWED_CARGO_COMMANDS.has(cargo[1])) continue;
      const python = /^python3\s+(scripts\/[^\s]+)/u.exec(line);
      if (python) {
        if (!resolve(repoRoot, python[1]).startsWith(resolve(repoRoot, "scripts"))) {
          findings.push(`gate command escapes scripts/: ${line}`);
        }
        continue;
      }
      findings.push(`unresolved gate command in ${PUSH_SKILL}: ${line}`);
    }
  }

  while (pending.length > 0) {
    const { name, source } = pending.shift();
    if (!(name in scripts)) {
      findings.push(`${source} invokes missing package script ${name}`);
      continue;
    }
    if (routed.has(name)) continue;
    routed.add(name);
    for (const nested of pnpmReferences(scripts[name])) {
      pending.push({ name: nested, source: `package script ${name}` });
    }
  }
  return { directGateCommands, findings, routed };
}

async function scriptFiles(repoRoot, listedPaths) {
  const files = [];
  for (const path of listedPaths) {
    if (!path.startsWith("scripts/")) continue;
    const absolute = resolve(repoRoot, path);
    let metadata;
    try {
      metadata = await stat(absolute);
    } catch (error) {
      if (error?.code === "ENOENT") continue;
      throw error;
    }
    if (!metadata.isFile()) continue;
    files.push({ executable: (metadata.mode & 0o111) !== 0, path });
  }
  return files;
}

function shellWords(command) {
  return [...command.matchAll(/"(?:\\.|[^"])*"|'[^']*'|[^\s]+/gu)].map((match) => {
    const word = match[0];
    return /^(["']).*\1$/su.test(word) ? word.slice(1, -1) : word;
  });
}

function invokesScript(command, path) {
  for (const segment of command.split(/&&|\|\||[;|\n]/u)) {
    const words = shellWords(segment.trim());
    if (words.length === 0) continue;
    const executable = words[0].replace(/^\.\//u, "");
    if (executable === path) return true;
    if (SCRIPT_RUNNERS.has(executable) && words.slice(1).includes(path)) return true;
  }
  return false;
}

function defaultListFiles(repoRoot, pathspec = ".") {
  return listWorkingTreeFiles({ workspaceRoot: repoRoot, pathspec });
}

export async function checkGateRouting(
  repoRoot,
  { paths = undefined, listFiles = defaultListFiles } = {},
) {
  const listed = listFiles(repoRoot);
  const [packageText, pushSkill, workflow, viteConfig, files] = await Promise.all([
    readFile(resolve(repoRoot, PACKAGE_JSON), "utf8"),
    readFile(resolve(repoRoot, PUSH_SKILL), "utf8"),
    readFile(resolve(repoRoot, TEST_WORKFLOW), "utf8"),
    readFile(resolve(repoRoot, VITE_CONFIG), "utf8"),
    scriptFiles(repoRoot, listed),
  ]);
  const scripts = JSON.parse(packageText).scripts ?? {};
  const { directGateCommands, findings, routed } = validateGateCommands(
    pushSkill,
    scripts,
    repoRoot,
  );

  const workflowCommands = workflowRunCommands(workflow);
  const pending = workflowCommands.flatMap((command) => pnpmReferences(command));
  while (pending.length > 0) {
    const name = pending.shift();
    if (!(name in scripts) || routed.has(name)) continue;
    routed.add(name);
    pending.push(...pnpmReferences(scripts[name]));
  }

  for (const name of Object.keys(scripts).sort()) {
    if (/:(?:check|test)$/u.test(name) && !routed.has(name)) {
      findings.push(
        `package script ${name} is not routed through ${PUSH_SKILL} or ${TEST_WORKFLOW}`,
      );
    }
  }

  const includes = testIncludes(viteConfig);
  const isRouted = (path) =>
    directGateCommands.some((command) => invokesScript(command, path)) ||
    Object.entries(scripts).some(
      ([name, command]) => routed.has(name) && invokesScript(command, path),
    );
  for (const { path } of files.filter((file) => matches(file.path, TEST_FILE_PATTERNS))) {
    if (!isRouted(path) && !matches(path, includes)) {
      findings.push(
        `test file ${path} is not reachable from a routed package script or Vitest include`,
      );
    }
  }

  for (const { path } of files.filter(
    (file) => file.executable || /^scripts\/check-.*\.mjs$/u.test(file.path),
  )) {
    if (!isRouted(path) && !matches(path, includes)) {
      findings.push(
        `checker file ${path} is not reachable from a routed package script or Vitest include`,
      );
    }
  }

  const repositoryPaths = paths ?? listed;
  for (const pattern of reviewPathGlobPatterns(pushSkill)) {
    const matcher = globToRegExp(pattern);
    if (!repositoryPaths.some((path) => matcher.test(path))) {
      findings.push(`sensitive-path glob ${pattern} matches no file`);
    }
  }

  return findings;
}

function parseArguments(argumentsList) {
  const options = { repoRoot: "." };
  for (let index = 0; index < argumentsList.length; index += 1) {
    const argument = argumentsList[index];
    if (argument === "--repo-root") options.repoRoot = argumentsList[++index];
    else throw new Error(`Unknown argument: ${argument}`);
    if (!options.repoRoot) throw new Error(`Missing value for ${argument}`);
  }
  return options;
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const findings = await checkGateRouting(resolve(process.cwd(), options.repoRoot));
  if (findings.length > 0) {
    console.error("Gate routing check: FAIL");
    for (const finding of findings) console.error(`  * ${finding}`);
    process.exitCode = 1;
    return;
  }
  console.log("Gate routing check: OK");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
