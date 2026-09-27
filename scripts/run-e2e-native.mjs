// Runs the Playwright suite on the host, for `pnpm test:e2e`. The screenshot assertions are
// only valid inside the pinned image (`scripts/run-e2e-container.mjs`, d-20260829-01); this
// launcher exists so the native path forwards its options through the same argument contract
// instead of handing pnpm's retained `--` straight to Playwright (`f-20260910-07`).

import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { playwrightArguments } from "./run-e2e-container.mjs";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
// The CLI module through this Node, not the `node_modules/.bin` shim: on Windows that shim is
// a `.cmd` file that spawnSync cannot start without a shell.
const cli = createRequire(import.meta.url).resolve("@playwright/test/cli");

const result = spawnSync(
  process.execPath,
  [cli, "test", ...playwrightArguments(process.argv.slice(2))],
  { cwd: projectRoot, stdio: "inherit" },
);

if (result.error) throw result.error;
process.exit(result.status ?? 1);
