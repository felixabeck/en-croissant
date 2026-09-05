import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { listWorkingTreeFiles } from "./working-tree-files.mjs";

const INITIAL_DEAD_CODE_ALLOWLIST = Object.freeze([
  // Owner: f-20260830-25. This allowlist may only shrink.
  "src-tauri/src/infra/path_authority.rs",
]);

export const DEAD_CODE_ALLOWLIST = new Set(INITIAL_DEAD_CODE_ALLOWLIST);

// Owner: f-20260830-23. This allowlist may only shrink.
const INITIAL_FS_SURFACE_ALLOWLIST = Object.freeze([
  "src-tauri/src/credentials.rs",
  "src-tauri/src/db/mod.rs",
  "src-tauri/src/db/repository.rs",
  "src-tauri/src/file_workspace.rs",
  "src-tauri/src/fs.rs",
  "src-tauri/src/main.rs",
  "src-tauri/src/puzzle.rs",
  "src-tauri/src/sound.rs",
]);

export const FS_SURFACE_ALLOWLIST = new Set(INITIAL_FS_SURFACE_ALLOWLIST);

// Production R3+R4 match counts, measured by this checker. Shrink-only.
export const INITIAL_FS_SURFACE_COUNTS = Object.freeze({
  "src-tauri/src/credentials.rs": 5,
  "src-tauri/src/db/mod.rs": 1,
  "src-tauri/src/db/repository.rs": 6,
  "src-tauri/src/file_workspace.rs": 5,
  "src-tauri/src/fs.rs": 10,
  "src-tauri/src/main.rs": 5,
  "src-tauri/src/puzzle.rs": 1,
  "src-tauri/src/sound.rs": 1,
});

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

const FS_FN_NAMES = [
  "write",
  "read",
  "read_to_string",
  "read_dir",
  "copy",
  "create_dir",
  "create_dir_all",
  "remove_file",
  "remove_dir",
  "remove_dir_all",
  "rename",
  "hard_link",
  "symlink",
  "canonicalize",
  "metadata",
  "symlink_metadata",
  "set_permissions",
  "read_link",
  "OpenOptions",
  "DirBuilder",
];
const FS_FN = FS_FN_NAMES.map((name) => name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
const FILE_CTOR = "open|create|create_new";
const PATHNAME_FNS = ["atomic_replace", "atomic_replace_with_precommit", "atomic_install_dir"];
const TURBOFISH_CALL = "(?:\\s*::\\s*<[^>]*>)?\\s*\\(";

function emptyImportState() {
  return {
    stdFsAliases: new Set(),
    tokioFsAliases: new Set(),
    infraFsAliases: new Set(),
    importedFileNames: new Set(),
    importedOpenOptionsNames: new Set(),
    importedDirBuilderNames: new Set(),
    importedFsFns: new Set(),
    importedPathnameFns: new Set(),
    globInfraFs: false,
  };
}

function mergeImportState(target, extra) {
  for (const name of extra.stdFsAliases) target.stdFsAliases.add(name);
  for (const name of extra.tokioFsAliases) target.tokioFsAliases.add(name);
  for (const name of extra.infraFsAliases) target.infraFsAliases.add(name);
  for (const name of extra.importedFileNames) target.importedFileNames.add(name);
  for (const name of extra.importedOpenOptionsNames) target.importedOpenOptionsNames.add(name);
  for (const name of extra.importedDirBuilderNames) target.importedDirBuilderNames.add(name);
  for (const name of extra.importedFsFns) target.importedFsFns.add(name);
  for (const name of extra.importedPathnameFns) target.importedPathnameFns.add(name);
  target.globInfraFs = target.globInfraFs || extra.globInfraFs;
}

function braceAwareSplit(text) {
  const parts = [];
  let current = "";
  let depth = 0;
  for (const character of text) {
    if (character === "{") depth += 1;
    if (character === "}") depth -= 1;
    if (character === "," && depth === 0) {
      parts.push(current.trim());
      current = "";
      continue;
    }
    current += character;
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

function applyUseTree(prefix, tree, state) {
  const trimmed = tree.trim();
  if (!trimmed) return;
  const groupStart = trimmed.indexOf("::{");
  if (groupStart !== -1 && !trimmed.slice(0, groupStart).includes("{")) {
    applyUseTree(
      prefix ? `${prefix}::${trimmed.slice(0, groupStart)}` : trimmed.slice(0, groupStart),
      trimmed.slice(groupStart + 2),
      state,
    );
    return;
  }
  if (trimmed.endsWith("::*")) {
    applyUseTree(prefix ? `${prefix}::${trimmed.slice(0, -3)}` : trimmed.slice(0, -3), "*", state);
    return;
  }
  if (trimmed === "*") {
    if (/(?:^|::)(?:std|tokio)::fs$/.test(prefix)) {
      /* glob of std::fs / tokio::fs: treat as importing every function name */
      for (const name of FS_FN_NAMES) state.importedFsFns.add(name);
      state.importedFileNames.add("File");
      state.importedOpenOptionsNames.add("OpenOptions");
      state.importedDirBuilderNames.add("DirBuilder");
    }
    if (/(?:infra|super)::fs$/.test(prefix) || prefix === "fs") state.globInfraFs = true;
    return;
  }
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    for (const inner of braceAwareSplit(trimmed.slice(1, -1))) applyUseTree(prefix, inner, state);
    return;
  }
  const aliased = trimmed.match(/^(.+?)\s+as\s+([A-Za-z_][A-Za-z0-9_]*)$/);
  const raw = (aliased ? aliased[1] : trimmed).trim();
  const local = aliased ? aliased[2] : raw.split("::").at(-1);
  const full = prefix ? `${prefix}::${raw}` : raw;
  if (raw === "self") {
    const bound = aliased ? local : prefix.split("::").at(-1);
    if (/(?:^|::)std::fs$/.test(prefix)) state.stdFsAliases.add(bound);
    if (/(?:^|::)tokio::fs$/.test(prefix)) state.tokioFsAliases.add(bound);
    if (/(?:infra|super)::fs$/.test(prefix)) state.infraFsAliases.add(bound);
    return;
  }
  if (/^(?:std|tokio)::fs$/.test(full) || /^(?:std|tokio)::fs$/.test(raw)) {
    const kind =
      (full.startsWith("tokio") || raw.startsWith("tokio") ? "tokio" : "std") + "FsAliases";
    state[kind].add(local === "fs" || aliased ? local : "fs");
    if (!aliased) state[kind].add("fs");
    return;
  }
  if (
    /^(?:crate::)?infra::fs$/.test(full) ||
    /^(?:crate::)?infra::fs$/.test(raw) ||
    raw === "super::fs"
  ) {
    state.infraFsAliases.add(local);
    return;
  }
  if (/(?:^|::)(?:std|tokio)::fs::File$/.test(full) || raw === "File") {
    state.importedFileNames.add(local);
  }
  if (/(?:^|::)(?:std|tokio)::fs::OpenOptions$/.test(full) || raw === "OpenOptions") {
    state.importedOpenOptionsNames.add(local);
  }
  if (/(?:^|::)(?:std|tokio)::fs::DirBuilder$/.test(full) || raw === "DirBuilder") {
    state.importedDirBuilderNames.add(local);
  }
  if (FS_FN_NAMES.includes(local) || FS_FN_NAMES.includes(raw.split("::").at(-1))) {
    if (/(?:std|tokio)::fs/.test(full) || FS_FN_NAMES.includes(raw)) state.importedFsFns.add(local);
  }
  if (PATHNAME_FNS.includes(raw.split("::").at(-1)) || PATHNAME_FNS.includes(local)) {
    if (/fs::/.test(full) || PATHNAME_FNS.includes(raw)) state.importedPathnameFns.add(local);
  }
}

function parseUseBindings(text) {
  const state = emptyImportState();
  const compact = text.replace(/\s+/g, " ").trim().replace(/;$/, "");
  const match = compact.match(/^(?:pub(?:\s*\(\s*(?:crate|super)\s*\))?\s+)?use\s+(.+)$/);
  if (!match) return state;
  applyUseTree("", match[1], state);
  return state;
}

function walkGatedLines(source, onLine) {
  const lines = maskRustLines(source);
  const testRegionStarts = [];
  let braceDepth = 0;
  let crateCfgTest = false;
  let pendingCfgTest = false;
  let pendingGatedItem = false;
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

    const startsUse =
      USE_START.test(code) || USE_START.test(code.replace(/^\s*(?:#\[[^\]]*\]\s*)+/, ""));
    if (startsUse) {
      useStatement = { gated: gatedAtLine, text: code };
      pendingUse = pendingCfgTest || itemCfg;
    } else if (useStatement) {
      useStatement.text += `\n${code}`;
    }

    const { opens, closes } = braceDelta(code);
    const codeWithoutAttrs = code.replace(/^\s*(?:#\[[^\]]*\]\s*)+/, "");
    const startsItem = ITEM_START.test(code) || ITEM_START.test(codeWithoutAttrs) || startsUse;
    const isUseComplete = Boolean(useStatement && code.includes(";"));
    const trimmed = code.trim();
    const isAttribute = trimmed.startsWith("#");
    const hasCode = trimmed.length > 0 && !isAttribute;

    if ((pendingCfgTest || itemCfg) && !crateCfg) {
      if (startsUse) pendingUse = true;
      else if (startsItem) pendingGatedItem = true;
      else if (hasCode && !pendingGatedItem && !pendingUse && !itemCfg) pendingCfgTest = false;

      if (pendingGatedItem && opens > 0) {
        const openingOffset = firstOpeningBraceOffset(code);
        const depthAtOpening =
          braceDepth +
          1 +
          [...code.slice(0, openingOffset)].filter((character) => character === "{").length;
        testRegionStarts.push(depthAtOpening);
        pendingCfgTest = false;
        pendingGatedItem = false;
      } else if (pendingGatedItem && code.includes(";") && opens === 0) {
        pendingCfgTest = false;
        pendingGatedItem = false;
      }
    }

    onLine({
      index,
      code,
      gated: gatedAtLine,
      useText: isUseComplete ? useStatement.text : null,
      useGated: isUseComplete ? useStatement.gated : false,
    });

    if (isUseComplete) {
      pendingCfgTest = false;
      pendingUse = false;
      useStatement = null;
    }

    braceDepth += opens - closes;
    while (testRegionStarts.length && braceDepth < testRegionStarts.at(-1)) {
      testRegionStarts.pop();
    }
  }
}

export function checkFaultInjectionSurface(path, source) {
  const violations = [];

  walkGatedLines(source, ({ index, code, gated, useText, useGated }) => {
    const publicItem = PUBLIC_ITEM.exec(code);
    if (publicItem && INJECTION_NAME.test(publicItem[1]) && !gated) {
      violations.push(
        `${path}:${index + 1}: R2: public fault-injection item ${publicItem[1]} must be inside #[cfg(test)]`,
      );
    }
    if (useText && INJECTION_NAME.test(useText) && !useGated) {
      violations.push(
        `${path}:${index + 1}: R2: use importing a fault-injection name must be inside #[cfg(test)]`,
      );
    }
  });

  return [...new Set(violations)];
}

function isInfraPath(path) {
  return path.startsWith("src-tauri/src/infra/");
}

function qualifiedFsCall(prefix, code) {
  const escaped = prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const fn = new RegExp(`\\b${escaped}::(?:File::(?:${FILE_CTOR})|(?:${FS_FN}))\\b`);
  return fn.test(code);
}

function pathnameCall(name, code) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\b${escaped}${TURBOFISH_CALL}`).test(code);
}

function collectFilesystemMatches(path, source) {
  if (isInfraPath(path)) return [];
  const matches = [];
  const events = [];
  walkGatedLines(source, (event) => events.push(event));

  const imports = emptyImportState();
  for (const { useText, useGated } of events) {
    if (useText && !useGated) mergeImportState(imports, parseUseBindings(useText));
  }

  for (const { index, code, gated, useText, useGated } of events) {
    if (useText && !useGated) {
      const parsed = parseUseBindings(useText);
      if (
        parsed.importedPathnameFns.size > 0 ||
        parsed.globInfraFs ||
        parsed.infraFsAliases.size > 0
      ) {
        matches.push({ line: index + 1, rule: "R4", kind: "import" });
      }
    }
    if (gated) continue;

    if (qualifiedFsCall("std::fs", code) || qualifiedFsCall("tokio::fs", code)) {
      matches.push({ line: index + 1, rule: "R3", kind: "qualified" });
    }
    for (const alias of imports.stdFsAliases) {
      if (qualifiedFsCall(alias, code))
        matches.push({ line: index + 1, rule: "R3", kind: "alias" });
    }
    for (const alias of imports.tokioFsAliases) {
      if (qualifiedFsCall(alias, code))
        matches.push({ line: index + 1, rule: "R3", kind: "alias" });
    }
    for (const name of imports.importedFileNames) {
      if (new RegExp(`\\b${name}::(?:${FILE_CTOR})\\b`).test(code)) {
        matches.push({ line: index + 1, rule: "R3", kind: "file-ctor" });
      }
    }
    for (const name of imports.importedOpenOptionsNames) {
      if (new RegExp(`\\b${name}::`).test(code)) {
        matches.push({ line: index + 1, rule: "R3", kind: "open-options" });
      }
    }
    for (const name of imports.importedDirBuilderNames) {
      if (new RegExp(`\\b${name}::`).test(code)) {
        matches.push({ line: index + 1, rule: "R3", kind: "dir-builder" });
      }
    }
    for (const name of imports.importedFsFns) {
      if (new RegExp(`\\b${name}\\s*\\(`).test(code)) {
        matches.push({ line: index + 1, rule: "R3", kind: "imported-fn" });
      }
    }

    for (const name of PATHNAME_FNS) {
      if (pathnameCall(name, code)) matches.push({ line: index + 1, rule: "R4", kind: "call" });
    }
    for (const name of imports.importedPathnameFns) {
      if (pathnameCall(name, code))
        matches.push({ line: index + 1, rule: "R4", kind: "imported-call" });
    }
  }

  const unique = [];
  const seen = new Set();
  for (const match of matches) {
    const key = `${match.line}:${match.rule}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(match);
  }
  return unique;
}

export function checkFilesystemSurface(
  sources,
  allowlist = FS_SURFACE_ALLOWLIST,
  counts = INITIAL_FS_SURFACE_COUNTS,
) {
  const entries = sourceEntries(sources);
  const violations = [];
  const allowedPaths = new Set(allowlist);

  for (const path of allowedPaths) {
    if (!INITIAL_FS_SURFACE_ALLOWLIST.includes(path)) {
      violations.push(`R3: allowlist entry ${path} is not part of the shrink-only baseline`);
    }
  }

  for (const { path, contents } of entries) {
    const matches = collectFilesystemMatches(path, contents);
    if (allowedPaths.has(path)) {
      const expected = counts[path] ?? 0;
      if (matches.length === 0) {
        violations.push(
          `R3: allowlist entry ${path} has no production filesystem reaches and must be removed from the allowlist`,
        );
      } else if (matches.length !== expected) {
        violations.push(
          `R3: ${path} has ${matches.length} production filesystem reaches, allowlisted for ${expected}`,
        );
      }
      continue;
    }
    for (const match of matches) {
      violations.push(
        `${path}:${match.line}: ${match.rule}: production filesystem reach (${match.kind}) must be inside infra/, #[cfg(test)], or the shrink-only allowlist`,
      );
    }
  }

  return violations;
}

// An allowlist entry whose file has left the working tree is stale: without this rule the entry
// survives the deletion for ever and every gate stays green.
export function checkAllowlistResidency(paths, allowlist = FS_SURFACE_ALLOWLIST) {
  const present = new Set(paths);
  const violations = [];
  for (const path of allowlist) {
    if (!present.has(path)) {
      violations.push(
        `R3: allowlist entry ${path} is not present in the working tree and must be removed from the allowlist`,
      );
    }
  }
  return violations;
}

export function checkRustReleaseSurface(sources, allowlist = DEAD_CODE_ALLOWLIST) {
  const entries = sourceEntries(sources);
  return [
    ...checkDeadCodeSurface(entries, allowlist),
    ...entries.flatMap(({ path, contents }) => checkFaultInjectionSurface(path, contents)),
    ...checkFilesystemSurface(entries),
  ];
}

export function listRustSources(workspaceRoot, runGit = spawnSync) {
  return listWorkingTreeFiles({
    workspaceRoot,
    pathspec: "src-tauri/src",
    runGit,
  }).filter((path) => path.startsWith("src-tauri/src/") && path.endsWith(".rs"));
}

export const listTrackedRustSources = listRustSources;

export function runReleaseSurfaceCheck({
  workspaceRoot = process.cwd(),
  listFiles = listTrackedRustSources,
  readFile = (path) => readFileSync(path, "utf8"),
  paths = listFiles(workspaceRoot),
} = {}) {
  const sources = new Map();
  for (const path of paths) {
    const absolutePath = resolve(workspaceRoot, path);
    try {
      sources.set(path, readFile(absolutePath));
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      throw new Error(`Cannot read Rust source ${path}: ${detail}`);
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
    const paths = listTrackedRustSources(process.cwd());
    const residency = process.argv.includes("--check-allowlist-residency")
      ? checkAllowlistResidency(paths)
      : [];
    let surfaceFailure = null;
    try {
      runReleaseSurfaceCheck({ paths });
    } catch (error) {
      surfaceFailure = error instanceof Error ? error.message : String(error);
    }
    if (surfaceFailure) console.error(surfaceFailure);
    if (residency.length)
      console.error(`Rust release-surface violations:\n${residency.join("\n")}`);
    if (surfaceFailure || residency.length) process.exitCode = 1;
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
