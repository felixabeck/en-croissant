import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";

export const CODEX_ONLY = new Set();
export const CLAUDE_ONLY = new Set();
export const BRIDGE_LINE_CAP = 30;

const IGNORED_DIRECTORIES = new Set([
  ".git",
  ".gate-receipts",
  "backend-coverage",
  "coverage",
  "dist",
  "mutants.out",
  "node_modules",
  "target",
]);

function bridgePath(skillName) {
  return [".agents", "skills", skillName, "SKILL.md"].join("/");
}

function canonicalPath(skillName) {
  return [".claude", "skills", skillName, "SKILL.md"].join("/");
}

async function directorySkillNames(root) {
  try {
    const entries = await readdir(root, { withFileTypes: true });
    const names = [];
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      try {
        await readFile(resolve(root, entry.name, "SKILL.md"), "utf8");
        names.push(entry.name);
      } catch (error) {
        if (error?.code !== "ENOENT") throw error;
      }
    }
    return names;
  } catch (error) {
    if (error?.code === "ENOENT") return undefined;
    throw error;
  }
}

function lineCount(text) {
  const lines = text.split(/\r?\n/u);
  return lines.at(-1) === "" ? lines.length - 1 : lines.length;
}

function escapeRegex(value) {
  return value.replace(/[.*+?^$()|[\]{}\\]/gu, "\\$&");
}

function reverseBridgeInstruction(text, skillName) {
  const path = escapeRegex(bridgePath(skillName));
  return new RegExp(
    `(?:read|follow)[^\\n]*${path}[^\\n]*(?:first|canonical)|` +
      `${path}[^\\n]*(?:canonical workflow|source of truth)`,
    "iu",
  ).test(text);
}

function isGateSourceClaim(line, path) {
  return (
    line.includes(path) &&
    /\bgates?\b/iu.test(line) &&
    /single source|source of truth|canonical|commands in|gate mapping|runs for/iu.test(line)
  );
}

async function repositoryFiles(root, current = root) {
  const files = [];
  const entries = await readdir(current, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory() && IGNORED_DIRECTORIES.has(entry.name)) continue;
    const path = resolve(current, entry.name);
    const relativePath = path.slice(root.length + 1);
    // Frozen plans are historical records and may quote the stale claim that motivated a change.
    if (entry.isDirectory() && relativePath === "tasks/plans") continue;
    if (entry.isDirectory()) files.push(...(await repositoryFiles(root, path)));
    else if (entry.isFile()) files.push(path);
  }
  return files;
}

async function findGateSourceClaims(repoRoot, pairedSkills) {
  const findings = [];
  for (const path of await repositoryFiles(repoRoot)) {
    let contents;
    try {
      contents = await readFile(path);
    } catch (error) {
      findings.push(`${path.slice(repoRoot.length + 1)} could not be read: ${error.message}`);
      continue;
    }
    if (contents.includes(0)) continue;
    const relativePath = path.slice(repoRoot.length + 1);
    for (const [index, line] of contents.toString("utf8").split(/\r?\n/u).entries()) {
      for (const skillName of pairedSkills) {
        const pathMarker = bridgePath(skillName);
        if (isGateSourceClaim(line, pathMarker)) {
          findings.push(`${relativePath}:${index + 1} names bridge ${pathMarker} as a gate source`);
        }
      }
    }
  }
  return findings;
}

export async function checkSkillBridges(
  repoRoot,
  { codexOnly = CODEX_ONLY, claudeOnly = CLAUDE_ONLY } = {},
) {
  const findings = [];
  const agentsRoot = resolve(repoRoot, ".agents", "skills");
  const claudeRoot = resolve(repoRoot, ".claude", "skills");
  const [agentNames, claudeNames] = await Promise.all([
    directorySkillNames(agentsRoot),
    directorySkillNames(claudeRoot),
  ]);
  if (!agentNames) findings.push(".agents/skills directory is missing");
  if (!claudeNames) findings.push(".claude/skills directory is missing");
  if (!agentNames || !claudeNames) return findings;

  const agentSet = new Set(agentNames);
  const claudeSet = new Set(claudeNames);
  for (const skillName of codexOnly) {
    if (!agentSet.has(skillName)) {
      findings.push(`Codex-only allowlist entry ${skillName} has no .agents skill`);
    } else if (claudeSet.has(skillName)) {
      findings.push(`Codex-only allowlist entry ${skillName} has a canonical counterpart`);
    }
  }
  for (const skillName of claudeOnly) {
    if (!claudeSet.has(skillName)) {
      findings.push(`Claude-only allowlist entry ${skillName} has no .claude skill`);
    } else if (agentSet.has(skillName)) {
      findings.push(`Claude-only allowlist entry ${skillName} has a Codex bridge`);
    }
  }

  const allNames = [...new Set([...agentNames, ...claudeNames])].sort();
  const pairedSkills = [];
  for (const skillName of allNames) {
    const hasAgent = agentSet.has(skillName);
    const hasClaude = claudeSet.has(skillName);
    if (!hasAgent && !claudeOnly.has(skillName)) {
      findings.push(`${canonicalPath(skillName)} has no Codex bridge`);
      continue;
    }
    if (!hasClaude && !codexOnly.has(skillName)) {
      findings.push(`${bridgePath(skillName)} has no canonical Claude skill`);
      continue;
    }
    if (!hasAgent || !hasClaude) continue;
    pairedSkills.push(skillName);

    const [agentText, claudeText] = await Promise.all([
      readFile(resolve(agentsRoot, skillName, "SKILL.md"), "utf8"),
      readFile(resolve(claudeRoot, skillName, "SKILL.md"), "utf8"),
    ]);
    const pointer = canonicalPath(skillName);
    if (!agentText.includes(pointer)) {
      findings.push(`${bridgePath(skillName)} does not point at ${pointer}`);
    }
    const lines = lineCount(agentText);
    if (lines > BRIDGE_LINE_CAP) {
      findings.push(
        `${bridgePath(skillName)} has ${lines} lines; bridge cap is ${BRIDGE_LINE_CAP}`,
      );
    }
    if (reverseBridgeInstruction(claudeText, skillName)) {
      findings.push(
        `${canonicalPath(skillName)} delegates its canonical contract back to ${bridgePath(skillName)}`,
      );
    }
  }

  findings.push(...(await findGateSourceClaims(repoRoot, pairedSkills)));
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
  const findings = await checkSkillBridges(resolve(process.cwd(), options.repoRoot));
  if (findings.length > 0) {
    console.error("Skill bridge check: FAIL");
    for (const finding of findings) console.error(`  * ${finding}`);
    process.exitCode = 1;
    return;
  }
  console.log("Skill bridge check: OK");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
