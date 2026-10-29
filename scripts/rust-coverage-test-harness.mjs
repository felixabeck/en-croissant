import { copyFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

// One copy manifest for fixtures exercising the production coverage entrypoint. Callers own
// the scratch root and its cleanup. Delete this helper when those fixtures stop sharing it.
export async function copyRustCoverageEntrypoint(scratchRoot) {
  const scripts = join(scratchRoot, "scripts");
  await mkdir(scripts, { recursive: true });
  for (const name of [
    "rust-branch-coverage.mjs",
    "coverage-scope.mjs",
    "entrypoint.mjs",
    "files-below.mjs",
    "rust-host.mjs",
    "toolchain-versions.mjs",
  ]) {
    await copyFile(new URL(name, import.meta.url), join(scripts, name));
  }
  return join(scripts, "rust-branch-coverage.mjs");
}
