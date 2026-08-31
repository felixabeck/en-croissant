import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { listWorkingTreeFiles } from "./working-tree-files.mjs";

// Exact required re-export set for platform/native.ts, not an optional permit
// list. `exported` is the name in the specifier module; `local` is the name
// this file re-exports (`export { exported as local } from`). There is no
// local binding.
export const NATIVE_EXPORT_ALLOWLIST = Object.freeze(
  [
    ["@tauri-apps/api/app", "getTauriVersion", "getTauriVersion"],
    ["@tauri-apps/api/app", "getVersion", "getVersion"],
    ["@tauri-apps/api/core", "convertFileSrc", "convertFileSrc"],
    ["@tauri-apps/api/menu", "Menu", "Menu"],
    ["@tauri-apps/api/menu", "MenuItem", "MenuItem"],
    ["@tauri-apps/api/menu", "PredefinedMenuItem", "PredefinedMenuItem"],
    ["@tauri-apps/api/menu", "Submenu", "Submenu"],
    ["@tauri-apps/api/path", "resolveResource", "resolveResource"],
    ["@tauri-apps/api/webviewWindow", "getCurrentWebviewWindow", "getCurrentWebviewWindow"],
    ["@tauri-apps/api/webviewWindow", "WebviewWindow", "WebviewWindow"],
    ["@tauri-apps/api/window", "getCurrentWindow", "getCurrentWindow"],
    ["@tauri-apps/plugin-cli", "getMatches", "getMatches"],
    ["@tauri-apps/plugin-dialog", "ask", "ask"],
    ["@tauri-apps/plugin-dialog", "message", "message"],
    ["@tauri-apps/plugin-log", "attachConsole", "attachConsole"],
    ["@tauri-apps/plugin-log", "error", "error"],
    ["@tauri-apps/plugin-log", "info", "info"],
    ["@tauri-apps/plugin-log", "warn", "warn"],
    ["@tauri-apps/plugin-os", "arch", "arch"],
    ["@tauri-apps/plugin-os", "platform", "platform"],
    ["@tauri-apps/plugin-os", "Platform", "Platform"],
    ["@tauri-apps/plugin-os", "type", "osType"],
    ["@tauri-apps/plugin-os", "version", "OSVersion"],
    ["@tauri-apps/plugin-process", "exit", "exit"],
  ].map(([specifier, exported, local]) => Object.freeze({ specifier, exported, local })),
);

export const NATIVE_EXPORT_DENYLIST = Object.freeze(
  [
    { specifier: "@tauri-apps/api" },
    { specifier: "@tauri-apps/api/event" },
    { specifier: "@tauri-apps/api/core", exported: "invoke" },
    { specifier: "@tauri-apps/plugin-fs" },
    { specifier: "@tauri-apps/plugin-http" },
    { specifier: "@tauri-apps/plugin-shell" },
    { specifier: "@tauri-apps/plugin-updater" },
  ].map(Object.freeze),
);

const TAURI_SPECIFIER = String.raw`@tauri-apps/(?:api(?:/[^"']*)?|plugin-[^"']*)`;
const FROM_SPECIFIER = new RegExp(String.raw`\bfrom\s*["'](${TAURI_SPECIFIER})["']`, "g");
const SIDE_EFFECT_SPECIFIER = new RegExp(String.raw`\bimport\s*["'](${TAURI_SPECIFIER})["']`, "g");
const CALL_SPECIFIER = new RegExp(
  String.raw`\b(?:import|require|vi\.mock)\s*\(\s*["'](${TAURI_SPECIFIER})["']`,
  "g",
);
const NATIVE_EXPORT = new RegExp(
  String.raw`\bexport\s*\{([\s\S]*?)\}\s*from\s*["'](${TAURI_SPECIFIER})["']`,
  "g",
);
const NATIVE_EXPORT_STAR = new RegExp(
  String.raw`\bexport\s*\*\s*(?:as\s+[A-Za-z_$][\w$]*\s*)?from\s*["'](${TAURI_SPECIFIER})["']`,
  "g",
);
const MODULE_CALL = /\b(?:import|require)\s*\(\s*["']([^"']+)["']/g;
const MODULE_FROM = /\bfrom\s*["']([^"']+)["']/g;
const MODULE_SIDE_EFFECT = /\bimport\s*["']([^"']+)["']/g;
const BINDINGS_IMPORT = /\bimport\s+(?!type\b)\{([\s\S]*?)\}\s*from\s*["']([^"']+)["']/g;

function isGeneratedBindings(specifier) {
  return /(?:^|\/)bindings\/generated(?:\.[^/]+)?$/.test(specifier);
}

function isBindingsBarrel(specifier) {
  return /(?:^|\/)bindings$/.test(specifier);
}

function hasMatchingSpecifier(source, patterns, predicate) {
  return patterns.some((pattern) => {
    pattern.lastIndex = 0;
    return [...source.matchAll(pattern)].some((match) => predicate(match[1]));
  });
}

function parseNativeExports(source) {
  NATIVE_EXPORT.lastIndex = 0;
  return [...source.matchAll(NATIVE_EXPORT)].flatMap((match) =>
    match[1]
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
      .map((item) => {
        if (/^type\s+as\s+/.test(item)) {
          return {
            specifier: match[2],
            exported: "type",
            local: item.replace(/^type\s+as\s+/, ""),
          };
        }
        const declaration = item.replace(/^type\s+/, "");
        const [exported, local = exported] = declaration.split(/\s+as\s+/);
        return { specifier: match[2], exported, local };
      }),
  );
}

function tripleKey({ specifier, exported, local }) {
  return `${specifier}\0${exported}\0${local}`;
}

function describeTriple({ specifier, exported, local }) {
  return `${specifier}:${exported}${local === exported ? "" : ` as ${local}`}`;
}

function inspectNativeSource(source, allowlist, denylist) {
  const violations = [];
  const actual = parseNativeExports(source);
  const actualKeys = new Set(actual.map(tripleKey));
  const allowedKeys = new Set(allowlist.map(tripleKey));

  for (const entry of actual) {
    if (
      denylist.some(
        (denied) =>
          denied.specifier === entry.specifier &&
          (denied.exported === undefined || denied.exported === entry.exported),
      )
    ) {
      violations.push(`native denylist forbids ${describeTriple(entry)}`);
    }
    if (!allowedKeys.has(tripleKey(entry))) {
      violations.push(`native export is not allowlisted: ${describeTriple(entry)}`);
    }
  }
  for (const entry of allowlist) {
    if (!actualKeys.has(tripleKey(entry))) {
      violations.push(`native export is missing: ${describeTriple(entry)}`);
    }
  }

  NATIVE_EXPORT_STAR.lastIndex = 0;
  for (const match of source.matchAll(NATIVE_EXPORT_STAR)) {
    violations.push(`native export star is forbidden: ${match[1]}`);
  }

  const withoutNamedExports = source.replace(NATIVE_EXPORT, "").replace(NATIVE_EXPORT_STAR, "");
  if (
    hasMatchingSpecifier(
      withoutNamedExports,
      [FROM_SPECIFIER, SIDE_EFFECT_SPECIFIER, CALL_SPECIFIER],
      () => true,
    )
  ) {
    violations.push("native facade may only use named Tauri re-exports");
  }
  return violations;
}

function importsRuntimeBindings(source) {
  BINDINGS_IMPORT.lastIndex = 0;
  return [...source.matchAll(BINDINGS_IMPORT)].some((match) => {
    if (!isBindingsBarrel(match[2])) return false;
    return match[1].split(",").some((item) => {
      const declaration = item.trim();
      if (/^type\b/.test(declaration)) return false;
      return /^(?:commands|events)\b/.test(declaration);
    });
  });
}

export function inspectSource(
  path,
  source,
  { allowlist = NATIVE_EXPORT_ALLOWLIST, denylist = NATIVE_EXPORT_DENYLIST } = {},
) {
  if (path === "bindings/generated.ts") return [];
  const violations = [];
  const isTauriFacade = path === "platform/tauri.ts";
  const isNativeFacade = path === "platform/native.ts";

  if (isNativeFacade) {
    violations.push(...inspectNativeSource(source, allowlist, denylist));
  } else if (
    hasMatchingSpecifier(
      source,
      [FROM_SPECIFIER, SIDE_EFFECT_SPECIFIER, CALL_SPECIFIER],
      () => true,
    )
  ) {
    violations.push("direct @tauri-apps module access");
  }

  if (!isTauriFacade) {
    if (
      hasMatchingSpecifier(
        source,
        [MODULE_FROM, MODULE_SIDE_EFFECT, MODULE_CALL],
        isGeneratedBindings,
      )
    ) {
      violations.push("direct bindings/generated module access");
    }
    if (importsRuntimeBindings(source)) {
      violations.push("runtime commands/events import from bindings barrel");
    }
    if (/\.listen\s*\(/.test(source)) violations.push("raw .listen() call");
    if (/\btauriEvents\s*\./.test(source)) violations.push("raw tauriEvents access");
    if (/(?:^|[^\w.])listen\s*\(/m.test(source)) violations.push("raw listen() call");
  }

  return [...new Set(violations)];
}

export function inspectCapability(capabilityJson) {
  const violations = [];
  const permissions = Array.isArray(capabilityJson?.permissions) ? capabilityJson.permissions : [];
  const broadPermission = /(?:^|:)(?:default|write-all)$/;
  const broadPermissions = permissions.filter(
    (permission) => typeof permission === "string" && broadPermission.test(permission),
  );
  if (broadPermissions.length) {
    violations.push(`capability must use exact permissions: ${broadPermissions.join(", ")}`);
  }
  const rendererFileAuthority = permissions.filter((permission) => {
    const identifier = typeof permission === "string" ? permission : permission?.identifier;
    return (
      typeof identifier === "string" &&
      (identifier.startsWith("fs:") ||
        identifier === "opener:allow-open-path" ||
        identifier === "opener:allow-open-url")
    );
  });
  if (rendererFileAuthority.length) {
    violations.push(
      `renderer filesystem/opener authority is forbidden: ${rendererFileAuthority
        .map((permission) => (typeof permission === "string" ? permission : permission.identifier))
        .join(", ")}`,
    );
  }
  return violations;
}

export function inspectCsp(csp) {
  return typeof csp !== "string" || /https?:\/\/\*/.test(csp)
    ? ["CSP must enumerate exact remote origins"]
    : [];
}

function readJsonFile(readFile, path) {
  const source = readFile(path);
  try {
    return JSON.parse(source);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`Cannot parse ${path}: ${detail}`);
  }
}

export function runTauriBoundaryCheck({
  workspaceRoot = process.cwd(),
  listFiles = (root) => listWorkingTreeFiles({ workspaceRoot: root }),
  readFile = (path) => readFileSync(path, "utf8"),
} = {}) {
  const violations = [];
  const paths = listFiles(workspaceRoot);
  let nativeInspected = false;
  for (const listedPath of paths) {
    if (!/^src\/.*\.[jt]sx?$/.test(listedPath)) continue;
    let source;
    try {
      source = readFile(resolve(workspaceRoot, listedPath));
    } catch (error) {
      if (error?.code === "ENOENT") continue;
      throw error;
    }
    const sourcePath = listedPath.replace(/^src\//, "");
    if (sourcePath === "platform/native.ts") nativeInspected = true;
    for (const message of inspectSource(sourcePath, source)) {
      violations.push(`${listedPath}: ${message}`);
    }
  }
  if (!nativeInspected) {
    violations.push("src/platform/native.ts: native facade is missing");
  }

  const capabilityPath = resolve(workspaceRoot, "src-tauri/capabilities/main.json");
  const configPath = resolve(workspaceRoot, "src-tauri/tauri.conf.json");
  const capability = readJsonFile(readFile, capabilityPath);
  const securityConfig = readJsonFile(readFile, configPath);
  violations.push(...inspectCapability(capability));
  violations.push(...inspectCsp(securityConfig?.app?.security?.csp));

  if (violations.length) {
    throw new Error(
      `Tauri commands, events, plugins, and listeners may only cross platform facades:\n${violations.join("\n")}`,
    );
  }
  return paths;
}

const scriptPath = fileURLToPath(import.meta.url);
if (process.argv[1] && resolve(process.argv[1]) === resolve(scriptPath)) {
  try {
    runTauriBoundaryCheck();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
