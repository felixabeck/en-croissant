import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const binding = resolve(root, "src/bindings/generated.ts");
const before = readFileSync(binding);
const generated = spawnSync(
  "cargo",
  [
    "run",
    "--manifest-path",
    "src-tauri/Cargo.toml",
    "--bin",
    "en-croissant",
    "--",
    "--export-bindings-only",
  ],
  { cwd: root, stdio: "inherit" },
);

if (generated.error) {
  throw generated.error;
}
if (generated.status !== 0) {
  process.exit(generated.status ?? 1);
}

const after = readFileSync(binding);
if (!before.equals(after)) {
  console.error(
    "Generated Tauri bindings were stale and have been refreshed. Review and include src/bindings/generated.ts, then run this check again.",
  );
  process.exit(1);
}
