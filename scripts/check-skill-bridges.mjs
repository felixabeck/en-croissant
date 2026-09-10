import { readFile, stat } from "node:fs/promises";
import { resolve } from "node:path";
import { isEntrypoint } from "./entrypoint.mjs";
import { listWorkingTreeFiles } from "./working-tree-files.mjs";

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

/**
 * Skill names below `<side>/skills`, or `undefined` when that directory is
 * absent.
 *
 * Enumeration goes through the shared working-tree walker, so a skill that is
 * untracked or shipped as a symlink is still discovered (`f-20260901-16`). A
 * `readdir` walk missed both: `Dirent.isDirectory()` reflects `lstat`, so a
 * symlinked skill directory was silently excluded from the pairing and
 * line-cap checks. Git lists such a link as one entry rather than descending
 * into it, which is why a single path segment is a candidate name here and the
 * `SKILL.md` probe below decides whether it really is a skill.
 */
async function directorySkillNames(repoRoot, skillsRoot) {
  const absoluteRoot = resolve(repoRoot, skillsRoot);
  try {
    await stat(absoluteRoot);
  } catch (error) {
    if (error?.code === "ENOENT") return undefined;
    throw error;
  }
  const candidates = new Set();
  for (const path of listWorkingTreeFiles({ workspaceRoot: repoRoot, pathspec: skillsRoot })) {
    const segments = path.slice(skillsRoot.length + 1).split("/");
    if (segments.length === 1 || (segments.length === 2 && segments[1] === "SKILL.md"))
      candidates.add(segments[0]);
  }
  const names = [];
  for (const name of [...candidates].sort()) {
    try {
      await readFile(resolve(absoluteRoot, name, "SKILL.md"), "utf8");
      names.push(name);
    } catch (error) {
      // A loose file beside the skill directories is not a skill: reading
      // through it reports ENOTDIR rather than ENOENT.
      if (error?.code !== "ENOENT" && error?.code !== "ENOTDIR") throw error;
    }
  }
  return names;
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

function pathOccurs(line, canonicalPath) {
  return new RegExp(`(^|[^A-Za-z0-9._-])${escapeRegex(canonicalPath)}(?![A-Za-z0-9._-])`, "u").test(
    line,
  );
}

function pointsAtCanonical(text, canonicalPath) {
  for (const line of text.split(/\r?\n/u)) {
    if (!pathOccurs(line, canonicalPath)) continue;
    if (/\bnot\b|\bdo not\b|\bdon't\b|\bnever\b/iu.test(line)) continue;
    if (/\b(?:read|follow)\b/iu.test(line)) return true;
  }
  return false;
}

function isGateSourceClaim(line, path) {
  return (
    line.includes(path) &&
    /\bgates?\b/iu.test(line) &&
    /single source|source of truth|canonical|commands in|gate mapping|runs for/iu.test(line)
  );
}

function listRepositoryFiles(repoRoot) {
  return listWorkingTreeFiles({ workspaceRoot: repoRoot, pathspec: "." }).filter((relativePath) => {
    if (relativePath.split("/").some((part) => IGNORED_DIRECTORIES.has(part))) return false;
    // Frozen plans are historical records and may quote the stale claim that motivated a change.
    return relativePath !== "tasks/plans" && !relativePath.startsWith("tasks/plans/");
  });
}

async function findGateSourceClaims(repoRoot, pairedSkills, relativePaths) {
  const findings = [];
  for (const relativePath of relativePaths) {
    const path = resolve(repoRoot, relativePath);
    let contents;
    try {
      contents = await readFile(path);
    } catch (error) {
      // A symlinked directory is listed by git as a single entry; it carries no
      // text to scan, and the skills below it are enumerated separately.
      if (error?.code === "ENOENT" || error?.code === "EISDIR") continue;
      findings.push(`${relativePath} could not be read: ${error.message}`);
      continue;
    }
    if (contents.includes(0)) continue;
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

export async function checkSkillBridges(repoRoot, { listFiles = listRepositoryFiles } = {}) {
  const findings = [];
  const [agentNames, claudeNames] = await Promise.all([
    directorySkillNames(repoRoot, ".agents/skills"),
    directorySkillNames(repoRoot, ".claude/skills"),
  ]);
  if (!agentNames) findings.push(".agents/skills directory is missing");
  if (!claudeNames) findings.push(".claude/skills directory is missing");
  if (!agentNames || !claudeNames) return findings;

  const agentSet = new Set(agentNames);
  const claudeSet = new Set(claudeNames);

  const allNames = [...new Set([...agentNames, ...claudeNames])].sort();
  const pairedSkills = [];
  for (const skillName of allNames) {
    const hasAgent = agentSet.has(skillName);
    const hasClaude = claudeSet.has(skillName);
    if (!hasAgent) {
      findings.push(`${canonicalPath(skillName)} has no Codex bridge`);
      continue;
    }
    if (!hasClaude) {
      findings.push(`${bridgePath(skillName)} has no canonical Claude skill`);
      continue;
    }
    pairedSkills.push(skillName);

    const [agentText, claudeText] = await Promise.all([
      readFile(resolve(repoRoot, bridgePath(skillName)), "utf8"),
      readFile(resolve(repoRoot, canonicalPath(skillName)), "utf8"),
    ]);
    const pointer = canonicalPath(skillName);
    if (!pointsAtCanonical(agentText, pointer)) {
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

  findings.push(...(await findGateSourceClaims(repoRoot, pairedSkills, listFiles(repoRoot))));
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

if (isEntrypoint(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
