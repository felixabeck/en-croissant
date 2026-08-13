import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join, relative } from "node:path";

const root = fileURLToPath(new URL("../src", import.meta.url));
const workspaceRoot = fileURLToPath(new URL("..", import.meta.url));
const facade = "platform/tauri.ts";
const nativeFacade = "platform/native.ts";
const generatedImport = /from\s*["'][^"']*bindings\/generated["']/;
const directNativeImport = /from\s*["']@tauri-apps\/(?:api|plugin-)[^"']*["']/;
const bindingsValueImport = /import\s+(?!type\b)([\s\S]*?)\s+from\s*["'][^"']*bindings["']/g;
const directListener =
  /(?:import\s*\{[^}]*\blisten\b[^}]*\}\s*from\s*["']@tauri-apps\/api\/event["']|tauriEvents\.|\.listen\s*\()/;

async function files(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  return (
    await Promise.all(
      entries.map((entry) => {
        const path = join(directory, entry.name);
        return entry.isDirectory() ? files(path) : [path];
      }),
    )
  ).flat();
}

function importsRuntimeBinding(source) {
  return [...source.matchAll(bindingsValueImport)].some((match) => {
    const clause = match[1];
    return /\b(commands|events)\b/.test(clause) && !/\btype\s+(commands|events)\b/.test(clause);
  });
}

const violations = [];
for (const file of await files(root)) {
  if (!/\.[jt]sx?$/.test(file)) continue;
  const source = await readFile(file, "utf8");
  const name = relative(root, file);
  if (name === "bindings/generated.ts") continue;
  if (name === facade || name === nativeFacade) continue;
  if (
    generatedImport.test(source) ||
    directNativeImport.test(source) ||
    importsRuntimeBinding(source) ||
    (name !== facade && directListener.test(source))
  ) {
    violations.push(name);
  }
}

if (violations.length) {
  throw new Error(
    `Tauri commands, events, plugins, and listeners may only cross platform facades: ${violations.join(", ")}`,
  );
}

const capability = JSON.parse(
  await readFile(join(workspaceRoot, "src-tauri/capabilities/main.json"), "utf8"),
);
const securityConfig = JSON.parse(
  await readFile(join(workspaceRoot, "src-tauri/tauri.conf.json"), "utf8"),
);
const broadPermission = /(?:^|:)(?:default|write-all)$/;
const broadPermissions = capability.permissions.filter(
  (permission) => typeof permission === "string" && broadPermission.test(permission),
);
if (broadPermissions.length) {
  throw new Error(`Tauri capability must use exact permissions: ${broadPermissions.join(", ")}`);
}
const rendererFileAuthority = capability.permissions.filter((permission) => {
  const identifier = typeof permission === "string" ? permission : permission.identifier;
  return (
    typeof identifier === "string" &&
    (identifier.startsWith("fs:") ||
      identifier === "opener:allow-open-path" ||
      identifier === "opener:allow-open-url")
  );
});
if (rendererFileAuthority.length) {
  throw new Error(
    `Renderer filesystem/opener authority is forbidden; use narrow native commands: ${rendererFileAuthority
      .map((permission) => (typeof permission === "string" ? permission : permission.identifier))
      .join(", ")}`,
  );
}
const csp = securityConfig.app.security.csp;
if (typeof csp !== "string" || /https?:\/\/\*/.test(csp)) {
  throw new Error("Tauri CSP must enumerate exact remote origins");
}
