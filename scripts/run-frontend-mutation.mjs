import { spawnSync } from "node:child_process";
import { rmSync } from "node:fs";

const packages = ["game-practice", "workspace-storage", "tree-path"];

// `cleanTempDir: "always"` in stryker.config.mjs covers runs that throw, but not
// runs that are killed outright — Stryker's dispose() never runs then, and the
// sandbox stays. Purging on start is the part that survives a SIGKILL: a
// sandbox has no value once its run is over, so at most one run's worth can
// ever be on disk. Four abandoned sandboxes from 2026-08-09 were still there on
// 08-13, together 39 GB.
rmSync(".stryker-tmp", { recursive: true, force: true });

for (const mutationPackage of packages) {
  console.log(`\nFrontend mutation package: ${mutationPackage}`);
  const result = spawnSync("pnpm", ["exec", "stryker", "run"], {
    encoding: "utf8",
    env: { ...process.env, STRYKER_PACKAGE: mutationPackage },
    stdio: "inherit",
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
