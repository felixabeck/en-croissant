#!/usr/bin/env node
// Runs the Playwright suite inside the pinned Playwright image, so the screenshot
// assertions do not depend on which machine runs them.
//
// Why this exists: on 2026-08-29 all eight screenshot specs failed on `tuxedo-atlas`
// with 47-680 differing pixels, every one of them along glyph edges only - every box,
// icon and control aligned to the pixel. That is text rasterization, not layout: the
// snapshots had been recorded elsewhere. Re-recording natively only moves the failure to
// the next machine, and a pixel tolerance wide enough to absorb the noise also absorbs a
// genuinely changed label. One canonical environment removes the machine from the
// measurement instead of widening the gate (`tasks/decisions.md`, d-20260829-01). The
// committed snapshots need no rewrite: all eight specs pass unchanged in this image.
//
// The image tag is derived from the installed @playwright/test version rather than
// written down twice, because a container one minor behind the library is exactly the
// silent drift this script exists to prevent.

import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const { version } = require("@playwright/test/package.json");
const image = `mcr.microsoft.com/playwright:v${version}-noble`;

const docker = spawnSync("docker", ["version", "--format", "{{.Server.Version}}"], {
  encoding: "utf8",
});
if (docker.status !== 0) {
  process.stderr.write(
    "docker is required for the containerized e2e run and is not available.\n" +
      "The native `pnpm test:e2e` compares against snapshots recorded in the container,\n" +
      "so it fails on font rasterization alone on most machines. Install docker, or run\n" +
      "the suite in CI.\n",
  );
  process.exit(1);
}

// Root-owned dist/, artifacts/ and snapshot files in the host tree are worse than a
// failed run, so the container always runs as the invoking user. That user has no entry
// in the image's /etc/passwd, hence an explicit writable HOME.
const uid = process.getuid();
const gid = process.getgid();

const result = spawnSync(
  "docker",
  [
    "run",
    "--rm",
    "--init",
    // Chromium exhausts the default 64 MB /dev/shm and crashes mid-suite.
    "--ipc=host",
    "--user",
    `${uid}:${gid}`,
    "--volume",
    `${projectRoot}:/work`,
    "--workdir",
    "/work",
    "--env",
    "HOME=/tmp",
    "--env",
    "CI=1",
    image,
    "node_modules/.bin/playwright",
    "test",
    ...process.argv.slice(2),
  ],
  { stdio: "inherit" },
);

if (result.error) throw result.error;
process.exit(result.status ?? 1);
