import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const INITIAL_DEAD_CODE_ALLOWLIST = Object.freeze([
  // Owner: f-20260830-25. This allowlist may only shrink.
  "src-tauri/src/infra/path_authority.rs",
]);

export const DEAD_CODE_ALLOWLIST = new Set(INITIAL_DEAD_CODE_ALLOWLIST);

const INJECTION_NAME = /(?:FaultPoint|Injector|_with_injector)/i;
const PUBLIC_ITEM =
  /^\s*pub(?:\s*\(\s*(?:crate|super)\s*\))?\s+(?:(?:async|const|unsafe|extern(?:\s+"[^"]+")?)\s+)*(?:fn|struct|enum|trait|type|mod|static|const)\s+([A-Za-z_][A-Za-z0-9_]*)/;
const USE_START = /^\s*(?:pub(?:\s*\(\s*(?:crate|super)\s*\))?\s+)?use\b/;
const ITEM_START =
  /^\s*(?:(?:pub(?:\s*\(\s*(?:crate|super)\s*\))?\s+)?(?:async\s+|const\s+|unsafe\s+|extern(?:\s+"[^"]+"\s+)?)*)(?:fn|struct|enum|trait|type|mod|static|const|impl)\b/;

function isTestCfgAttribute(line) {
  const match = line.match(/^\s*#!?\[\s*cfg\s*\((.*)\)\s*\]/);
  if (!match || /\bnot\s*\(\s*test\s*\)/.test(match[1])) return false;
  const condition = match[1].trim();
  return condition === "test" || (/^all\s*\(/.test(condition) && /\btest\b/.test(condition));
}

function sourceEntries(sources) {
  if (sources instanceof Map)
    return [...sources.entries()].map(([path, contents]) => ({ path, contents }));
  return sources;
}

function isFileLevelDeadCodeAllowance(line) {
  return /^\s*#!\s*\[\s*allow\s*\(\s*dead_code\s*\)\s*\]/.test(line);
}

export function checkDeadCodeSurface(sources, allowlist = DEAD_CODE_ALLOWLIST) {
  const entries = sourceEntries(sources);
  const pathsWithAllowance = new Set(
    entries
      .filter(({ contents }) => maskRustLines(contents).some(isFileLevelDeadCodeAllowance))
      .map(({ path }) => path),
  );
  const allowedPaths = new Set(allowlist);
  const violations = [];

  for (const path of allowedPaths) {
    if (!INITIAL_DEAD_CODE_ALLOWLIST.includes(path)) {
      violations.push(`R1: allowlist entry ${path} is not part of the shrink-only baseline`);
    }
    if (!pathsWithAllowance.has(path)) {
      violations.push(`R1: allowlist entry ${path} no longer carries #![allow(dead_code)]`);
    }
  }

  for (const path of pathsWithAllowance) {
    if (!allowedPaths.has(path)) {
      violations.push(`R1: ${path} carries file-level #![allow(dead_code)] but is not allowlisted`);
    }
  }

  return violations;
}

function maskRustLines(source) {
  const lines = source.split("\n");
  const state = { blockCommentDepth: 0, rawStringEnd: null, string: null };

  return lines.map((line) => {
    let masked = "";
    let index = 0;

    const blank = (count) => {
      masked += " ".repeat(count);
    };

    while (index < line.length) {
      if (state.rawStringEnd) {
        const end = line.indexOf(state.rawStringEnd, index);
        if (end === -1) {
          blank(line.length - index);
          index = line.length;
          continue;
        }
        blank(end - index + state.rawStringEnd.length);
        index = end + state.rawStringEnd.length;
        state.rawStringEnd = null;
        continue;
      }

      if (state.string) {
        const quote = state.string;
        let escaped = false;
        let end = -1;
        for (let cursor = index; cursor < line.length; cursor += 1) {
          const character = line[cursor];
          if (!escaped && character === quote) {
            end = cursor;
            break;
          }
          escaped = !escaped && character === "\\";
          if (character !== "\\") escaped = false;
        }
        if (end === -1) {
          blank(line.length - index);
          index = line.length;
          continue;
        }
        blank(end - index + 1);
        index = end + 1;
        state.string = null;
        continue;
      }

      if (state.blockCommentDepth > 0) {
        if (line.startsWith("/*", index)) {
          state.blockCommentDepth += 1;
          blank(2);
          index += 2;
        } else if (line.startsWith("*/", index)) {
          state.blockCommentDepth -= 1;
          blank(2);
          index += 2;
        } else {
          blank(1);
          index += 1;
        }
        continue;
      }

      if (line.startsWith("//", index)) {
        blank(line.length - index);
        break;
      }
      if (line.startsWith("/*", index)) {
        state.blockCommentDepth = 1;
        blank(2);
        index += 2;
        continue;
      }

      const rawStart = line.slice(index).match(/^r(#+)"/);
      if (rawStart) {
        const delimiter = rawStart[1];
        state.rawStringEnd = `"${delimiter}`;
        blank(rawStart[0].length);
        index += rawStart[0].length;
        continue;
      }

      if (line[index] === '"') {
        state.string = line[index];
        blank(1);
        index += 1;
        continue;
      }
      if (line[index] === "'") {
        const charLiteral = line.slice(index).match(/^'(?:\\.|[^'\\])'/);
        if (charLiteral) {
          blank(charLiteral[0].length);
          index += charLiteral[0].length;
          continue;
        }
      }

      masked += line[index];
      index += 1;
    }

    return masked;
  });
}

function braceDelta(code) {
  let opens = 0;
  let closes = 0;
  for (const character of code) {
    if (character === "{") opens += 1;
    if (character === "}") closes += 1;
  }
  return { opens, closes };
}

function firstOpeningBraceOffset(code) {
  return code.indexOf("{");
}

function testRegionAtDepth(regionStarts, braceDepth) {
  return regionStarts.some((startDepth) => braceDepth >= startDepth);
}

export function checkFaultInjectionSurface(path, source) {
  const lines = maskRustLines(source);
  const violations = [];
  const testRegionStarts = [];
  let braceDepth = 0;
  let crateCfgTest = false;
  let pendingCfgTest = false;
  let pendingUse = false;
  let useStatement = null;

  for (let index = 0; index < lines.length; index += 1) {
    const code = lines[index];
    while (testRegionStarts.length && braceDepth < testRegionStarts.at(-1)) {
      testRegionStarts.pop();
    }

    const crateCfg = /^\s*#!/.test(code) && isTestCfgAttribute(code);
    const itemCfg = /^\s*#(?!\s*!)/.test(code) && isTestCfgAttribute(code);
    if (crateCfg) crateCfgTest = true;
    if (itemCfg) pendingCfgTest = true;

    const gatedAtLine =
      crateCfgTest || testRegionAtDepth(testRegionStarts, braceDepth) || pendingCfgTest;
    const publicItem = PUBLIC_ITEM.exec(code);
    if (publicItem && INJECTION_NAME.test(publicItem[1]) && !gatedAtLine) {
      violations.push(
        `${path}:${index + 1}: R2: public fault-injection item ${publicItem[1]} must be inside #[cfg(test)]`,
      );
    }

    const startsUse = USE_START.test(code);
    if (startsUse) {
      useStatement = { gated: gatedAtLine, text: code };
      pendingUse = pendingCfgTest;
    } else if (useStatement) {
      useStatement.text += `\n${code}`;
    }

    if (useStatement && INJECTION_NAME.test(useStatement.text) && !useStatement.gated) {
      violations.push(
        `${path}:${index + 1}: R2: use importing a fault-injection name must be inside #[cfg(test)]`,
      );
      useStatement.gated = true;
    }

    const { opens, closes } = braceDelta(code);
    const startsItem = ITEM_START.test(code) || startsUse;
    const isUseComplete = pendingUse && code.includes(";");
    if (pendingCfgTest && !crateCfg && !itemCfg) {
      if (startsUse) {
        pendingUse = true;
      } else if (startsItem && opens > 0) {
        const openingOffset = firstOpeningBraceOffset(code);
        const depthAtOpening =
          braceDepth +
          1 +
          [...code.slice(0, openingOffset)].filter((character) => character === "{").length;
        testRegionStarts.push(depthAtOpening);
        pendingCfgTest = false;
      } else if (startsItem && code.includes(";")) {
        pendingCfgTest = false;
      }
    }
    if (isUseComplete) {
      pendingCfgTest = false;
      pendingUse = false;
    }

    braceDepth += opens - closes;
    while (testRegionStarts.length && braceDepth < testRegionStarts.at(-1)) {
      testRegionStarts.pop();
    }
    if (useStatement && code.includes(";")) useStatement = null;
  }

  return [...new Set(violations)];
}

export function checkRustReleaseSurface(sources, allowlist = DEAD_CODE_ALLOWLIST) {
  const entries = sourceEntries(sources);
  return [
    ...checkDeadCodeSurface(entries, allowlist),
    ...entries.flatMap(({ path, contents }) => checkFaultInjectionSurface(path, contents)),
  ];
}

export function listTrackedRustSources(workspaceRoot, runGit = spawnSync) {
  const result = runGit("git", ["ls-files", "--", "src-tauri/src"], {
    cwd: workspaceRoot,
    encoding: "utf8",
  });
  if (result.error || result.status !== 0) {
    const detail =
      result.error?.message || result.stderr?.trim() || `exit status ${result.status ?? "unknown"}`;
    throw new Error(`Cannot enumerate tracked Rust sources: git ls-files failed (${detail})`);
  }
  return String(result.stdout ?? "")
    .split("\n")
    .map((path) => path.trim())
    .filter((path) => path.startsWith("src-tauri/src/") && path.endsWith(".rs"));
}

export function runReleaseSurfaceCheck({
  workspaceRoot = process.cwd(),
  listFiles = listTrackedRustSources,
  readFile = (path) => readFileSync(path, "utf8"),
} = {}) {
  const paths = listFiles(workspaceRoot);
  const sources = new Map();
  for (const path of paths) {
    const absolutePath = resolve(workspaceRoot, path);
    try {
      sources.set(path, readFile(absolutePath));
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      throw new Error(`Cannot read tracked Rust source ${path}: ${detail}`);
    }
  }

  const violations = checkRustReleaseSurface(sources);
  if (violations.length)
    throw new Error(`Rust release-surface violations:\n${violations.join("\n")}`);
  return paths;
}

const scriptPath = fileURLToPath(import.meta.url);
if (process.argv[1] && resolve(process.argv[1]) === resolve(scriptPath)) {
  try {
    runReleaseSurfaceCheck();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
