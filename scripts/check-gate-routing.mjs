import { readFile, stat } from "node:fs/promises";
import { resolve, sep } from "node:path";
import { globToRegExp, matches } from "./coverage-scope.mjs";
import { GATES } from "./gate-receipt.mjs";
import { listWorkingTreeFiles } from "./working-tree-files.mjs";

const PUSH_SKILL = ".claude/skills/push/SKILL.md";
const PACKAGE_JSON = "package.json";
const TEST_WORKFLOW = ".github/workflows/test.yml";
const VITE_CONFIG = "vite.config.ts";
const CONTRACT_GATE = "gates:contract:check";
const PATH_SCOPED_CI_SCRIPTS = Object.freeze({
  "test:coverage": "### TypeScript/React frontend",
  "coverage:frontend:check": "### TypeScript/React frontend",
  "build-vite": "### TypeScript/React frontend",
  "bindings:check": "### Cross-layer contracts",
  "bundle:check": "### TypeScript/React frontend",
  "test:e2e:container": "### TypeScript/React frontend",
  "mutation:frontend": "### TypeScript/React frontend",
  "test:coverage:backend": "### Rust/Tauri backend",
  "coverage:backend:check": "### Rust/Tauri backend",
});

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

export function pnpmReferences(command) {
  const matches = [
    ...command.matchAll(/(?:^|[;&|]\s*|\s)pnpm((?:\s+-{1,2}[\w-]+)*)(?:\s+run)?\s+([\w:@.-]+)/gu),
  ];
  return matches
    .map((match) => match[2])
    .filter((name) => !PNPM_SUBCOMMANDS.has(name) && !name.startsWith("-"));
}

function unquoteYamlScalar(value) {
  if (value.length >= 2 && value.startsWith('"') && value.endsWith('"')) {
    return value.slice(1, -1).replace(/\\(["\\])/gu, "$1");
  }
  if (value.length >= 2 && value.startsWith("'") && value.endsWith("'")) {
    return value.slice(1, -1).replaceAll("''", "'");
  }
  return value;
}

export function workflowSteps(workflow) {
  const steps = [];
  const lines = workflow.split(/\r?\n/u);
  for (let index = 0; index < lines.length; index += 1) {
    const item = /^(\s*)-\s+(.*)$/u.exec(lines[index]);
    if (!item) continue;
    const indentation = item[1].length;
    const block = [{ line: item[2], index }];
    let end = index + 1;
    while (end < lines.length) {
      const next = lines[end];
      if (next.trim() && next.match(/^\s*/u)[0].length <= indentation) break;
      block.push({ line: next.slice(indentation + 2), index: end });
      end += 1;
    }

    const name = block.find(({ line }) => /^name:\s*/u.test(line))?.line.replace(/^name:\s*/u, "");
    const runEntry = block.find(({ line }) => /^run:\s*/u.test(line));
    if (!runEntry) continue;
    const runValue = runEntry.line.replace(/^run:\s*/u, "");
    let run = unquoteYamlScalar(runValue);
    const scalar = /^([|>])(?:[0-9][-+]?|[-+]?[0-9]?)$/u.exec(runValue);
    if (scalar) {
      const runLineIndentation = lines[runEntry.index].match(/^\s*/u)[0].length;
      const commandLines = [];
      for (let lineIndex = runEntry.index + 1; lineIndex < end; lineIndex += 1) {
        const line = lines[lineIndex];
        if (line.trim() && line.match(/^\s*/u)[0].length <= runLineIndentation) break;
        commandLines.push(line.trim());
      }
      run = commandLines.join(scalar[1] === "|" ? "\n" : " ").trim();
    }
    const continueOnError = block
      .find(({ line }) => /^continue-on-error:\s*/u.test(line))
      ?.line.replace(/^continue-on-error:\s*/u, "")
      .trim();
    steps.push({
      name: name ?? "",
      run,
      hasIf: block.some(({ line }) => /^if:\s*/u.test(line)),
      continueOnError: continueOnError === "true",
    });
  }
  return steps;
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

function receiptReferences(command) {
  return [
    ...command.matchAll(
      /(?:^|[;&|]\s*|\s)pnpm(?:\s+-{1,2}[\w-]+)*(?:\s+run)?\s+(gate:(?:ensure|run|check))\s+([\w.-]+)/gu,
    ),
  ].map((match) => ({ script: match[1], gate: match[2] }));
}

function routeCommands(commands, scripts, findings) {
  const routed = new Set();
  const pending = [];
  const enqueue = (command, source) => {
    pending.push(...pnpmReferences(command).map((name) => ({ name, source })));
    for (const { gate } of receiptReferences(command)) {
      if (!(gate in GATES)) {
        findings.push(
          `unknown receipt gate ${gate} in ${source}; register it in scripts/gate-receipt.mjs GATES or use a registered gate`,
        );
        continue;
      }
      pending.push(...pnpmReferences(GATES[gate]).map((name) => ({ name, source })));
    }
  };
  for (const { command, source } of commands) enqueue(command, source);

  while (pending.length > 0) {
    const { name, source } = pending.shift();
    if (!(name in scripts)) {
      findings.push(`${source} invokes missing package script ${name}`);
      continue;
    }
    if (routed.has(name)) continue;
    routed.add(name);
    enqueue(scripts[name], `package script ${name}`);
  }
  return routed;
}

function validateGateCommands(pushSkill, scripts, repoRoot) {
  const findings = [];
  const bashBlocks = fencedBlocks(pushSkill).filter((block) =>
    ["bash", "sh", "shell"].includes(block.language),
  );
  const directGateCommands = [];
  const routedCommands = [];

  for (const block of bashBlocks) {
    for (const rawLine of block.contents.split(/\r?\n/u)) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;
      directGateCommands.push(line);
      const pnpmScripts = pnpmReferences(line);
      if (pnpmScripts.length > 0) {
        routedCommands.push({ command: line, source: `${PUSH_SKILL}: ${line}` });
        continue;
      }
      const cargo = /^cargo\s+(\w+)/u.exec(line);
      if (cargo && ALLOWED_CARGO_COMMANDS.has(cargo[1])) continue;
      const words = shellWords(line);
      if (SCRIPT_RUNNERS.has(words[0]) && words[1]) {
        const target = resolve(repoRoot, words[1]);
        const scriptsDirectory = resolve(repoRoot, "scripts");
        if (target !== scriptsDirectory && !target.startsWith(`${scriptsDirectory}${sep}`)) {
          findings.push(`gate command escapes scripts/: ${line}; use a path inside scripts/`);
        }
        continue;
      }
      findings.push(`unresolved gate command in ${PUSH_SKILL}: ${line}`);
    }
  }

  const routed = routeCommands(routedCommands, scripts, findings);
  return { directGateCommands, findings, routed };
}

// Returns the §2 text before the first path-scoped subsection. When the
// "Unconditional contract gate" subsection comes first, it is included.
function contractGateHome(pushSkill) {
  const sectionStart = pushSkill.search(/^## 2\./mu);
  if (sectionStart < 0) return "";
  const section = pushSkill.slice(sectionStart);
  const nextSection = section.slice(1).search(/^## /mu);
  const bounded = nextSection < 0 ? section : section.slice(0, nextSection + 1);
  const firstSubsection = bounded.search(/^### /mu);
  if (firstSubsection < 0) return bounded;
  const subsection = bounded.slice(firstSubsection);
  if (!subsection.startsWith("### Unconditional contract gate")) {
    return bounded.slice(0, firstSubsection);
  }
  const nextSubsection = subsection.slice(1).search(/^### /mu);
  return nextSubsection < 0 ? bounded : bounded.slice(0, firstSubsection + nextSubsection + 1);
}

function skillSubsection(pushSkill, heading) {
  const start = pushSkill.indexOf(heading);
  if (start < 0) return "";
  const afterHeading = pushSkill.slice(start + heading.length);
  const nextHeading = afterHeading.search(/^#{2,3} /mu);
  return nextHeading < 0
    ? pushSkill.slice(start)
    : pushSkill.slice(start, start + heading.length + nextHeading);
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

function commandSegments(command) {
  return command
    .split(/&&|\|\||[;|\n]/u)
    .map((segment) => segment.trim())
    .filter(Boolean);
}

function invokesPnpmOrScript(command, repoRoot) {
  if (pnpmReferences(command).length > 0) return true;
  const scriptsDirectory = resolve(repoRoot, "scripts");
  return commandSegments(command).some((segment) => {
    const words = shellWords(segment);
    if (words.length === 0) return false;
    const executable = words[0].replace(/^\.\//u, "");
    if (executable.startsWith("scripts/")) return true;
    if (!SCRIPT_RUNNERS.has(executable) || !words[1]) return false;
    const target = resolve(repoRoot, words[1]);
    return target === scriptsDirectory || target.startsWith(`${scriptsDirectory}${sep}`);
  });
}

function invokesScript(command, path) {
  for (const segment of commandSegments(command)) {
    const words = shellWords(segment);
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

  if (!(CONTRACT_GATE in scripts)) {
    findings.push(`package.json is missing ${CONTRACT_GATE}; add the shared contract chain`);
  }

  const skillContractReferences = directGateCommands.flatMap((command) =>
    pnpmReferences(command).filter((name) => name === CONTRACT_GATE),
  );
  const preambleContractReferences = fencedBlocks(contractGateHome(pushSkill))
    .filter((block) => ["bash", "sh", "shell"].includes(block.language))
    .flatMap((block) => pnpmReferences(block.contents))
    .filter((name) => name === CONTRACT_GATE);
  if (skillContractReferences.length !== 1 || preambleContractReferences.length !== 1) {
    findings.push(
      `${CONTRACT_GATE} must be fenced exactly once in the ${PUSH_SKILL} §2 preamble; add or move its sole fence there`,
    );
  }

  const steps = workflowSteps(workflow);
  const workflowContractSteps = steps.filter((step) =>
    pnpmReferences(step.run).includes(CONTRACT_GATE),
  );
  if (workflowContractSteps.length !== 1) {
    findings.push(
      `${TEST_WORKFLOW} must run ${CONTRACT_GATE} exactly once; replace duplicate tooling steps with one contract-gate step`,
    );
  } else if (workflowContractSteps[0].hasIf) {
    findings.push(
      `${TEST_WORKFLOW} must run ${CONTRACT_GATE} in a step without if:; remove the step condition`,
    );
  } else if (workflowContractSteps[0].run.trim() !== `pnpm ${CONTRACT_GATE}`) {
    findings.push(`${TEST_WORKFLOW} contract-gate step must be exactly pnpm ${CONTRACT_GATE}`);
  }

  const workflowCommands = steps.map((step) => step.run);
  const workflowFindings = [];
  const workflowRouted = routeCommands(
    workflowCommands.map((command) => ({ command, source: TEST_WORKFLOW })),
    scripts,
    workflowFindings,
  );
  findings.push(...workflowFindings);

  const contractFindings = [];
  const contractRouted =
    CONTRACT_GATE in scripts
      ? routeCommands(
          [{ command: `pnpm ${CONTRACT_GATE}`, source: `package script ${CONTRACT_GATE}` }],
          scripts,
          contractFindings,
        )
      : new Set();
  findings.push(...contractFindings);
  contractRouted.delete(CONTRACT_GATE);

  const directWorkflowScripts = new Set(steps.flatMap((step) => pnpmReferences(step.run)));
  directWorkflowScripts.delete(CONTRACT_GATE);
  const subsectionRoutes = new Map();
  for (const heading of new Set(Object.values(PATH_SCOPED_CI_SCRIPTS))) {
    const subsection = skillSubsection(pushSkill, heading);
    const commands = fencedBlocks(subsection)
      .filter((block) => ["bash", "sh", "shell"].includes(block.language))
      .flatMap((block) =>
        block.contents
          .split(/\r?\n/u)
          .map((line) => line.trim())
          .filter(Boolean)
          .map((command) => ({ command, source: `${PUSH_SKILL} ${heading}` })),
      );
    subsectionRoutes.set(heading, routeCommands(commands, scripts, findings));
  }
  for (const name of [...directWorkflowScripts].sort()) {
    if (name === CONTRACT_GATE || contractRouted.has(name)) continue;
    const heading = PATH_SCOPED_CI_SCRIPTS[name];
    if (heading && subsectionRoutes.get(heading)?.has(name)) continue;
    findings.push(
      `workflow-routed package script ${name} is neither reachable from ${CONTRACT_GATE} nor declared in PATH_SCOPED_CI_SCRIPTS and fenced in its named ${PUSH_SKILL} subsection; add it to the contract gate or add both the map entry and subsection fence`,
    );
  }
  for (const [name, heading] of Object.entries(PATH_SCOPED_CI_SCRIPTS)) {
    if (!directWorkflowScripts.has(name)) {
      findings.push(
        `PATH_SCOPED_CI_SCRIPTS key ${name} is absent from ${TEST_WORKFLOW}; remove the stale map entry or restore the workflow step`,
      );
    } else if (!subsectionRoutes.get(heading)?.has(name)) {
      findings.push(
        `PATH_SCOPED_CI_SCRIPTS key ${name} must be fenced in ${heading}; move or add its route in that subsection`,
      );
    }
  }

  const fencedLines = new Set(directGateCommands);
  const routedPackageSegments = new Set(
    [...routed].flatMap((name) => commandSegments(scripts[name] ?? "")),
  );
  for (const command of directGateCommands) {
    for (const { gate } of receiptReferences(command)) {
      if (gate in GATES) {
        for (const segment of commandSegments(GATES[gate])) routedPackageSegments.add(segment);
      }
    }
  }
  for (const step of steps) {
    if (step.continueOnError && invokesPnpmOrScript(step.run, repoRoot)) {
      findings.push(
        `${TEST_WORKFLOW} workflow step ignores the gate's exit status: ${step.name || step.run}`,
      );
    }
    if (invokesPnpmOrScript(step.run, repoRoot) && /\|\||[;|]/u.test(step.run)) {
      findings.push(
        `${TEST_WORKFLOW} workflow step neutralises or chains gate exit codes: ${step.name || step.run}`,
      );
    }
    for (const segment of commandSegments(step.run)) {
      if (!invokesPnpmOrScript(segment, repoRoot)) continue;
      if (fencedLines.has(segment) || routedPackageSegments.has(segment)) continue;
      findings.push(
        `workflow command must exactly match a fenced line or routed package-script segment: ${segment}`,
      );
    }
  }

  for (const command of directGateCommands) {
    for (const name of pnpmReferences(command)) {
      if (contractRouted.has(name)) {
        findings.push(
          `contract-gate member ${name} is also invoked directly by ${PUSH_SKILL}; keep it only in ${CONTRACT_GATE}`,
        );
      }
    }
  }
  for (const step of steps) {
    for (const name of pnpmReferences(step.run)) {
      if (contractRouted.has(name)) {
        findings.push(
          `contract-gate member ${name} is also invoked directly by ${TEST_WORKFLOW}; keep it only in ${CONTRACT_GATE}`,
        );
      }
    }
  }

  const allRouted = new Set([...routed, ...workflowRouted]);

  for (const name of Object.keys(scripts).sort()) {
    if (/:(?:check|test)$/u.test(name) && !allRouted.has(name)) {
      findings.push(
        `package script ${name} is not routed through ${PUSH_SKILL} or ${TEST_WORKFLOW}`,
      );
    }
  }

  const includes = testIncludes(viteConfig);
  const isRouted = (path) =>
    directGateCommands.some((command) => invokesScript(command, path)) ||
    Object.entries(scripts).some(
      ([name, command]) => allRouted.has(name) && invokesScript(command, path),
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
