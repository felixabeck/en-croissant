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

import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { constants as osConstants } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { isEntrypoint } from "./entrypoint.mjs";
import { superviseChild } from "./child-supervisor.mjs";
import { playwrightImage } from "./playwright-image.mjs";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DOCKER_TERMINATION_TIMEOUT_MS = 2_000;

// The container peaked at 2.3 GiB on 2026-09-30 (gate-performance measurements); 4 GiB
// gives about 1.7x headroom and is reserved from overlapping gate lanes.
export const E2E_CONTAINER_MEMORY = "4g";
export const E2E_CONTAINER_MEMORY_BYTES = 4 * 1024 ** 3;

/**
 * The arguments handed to `playwright test` for this script's own argv tail.
 *
 * pnpm keeps a `--` its caller writes: `pnpm test:e2e:update -- --project=x` reaches this
 * script as `["--update-snapshots", "--", "--project=x"]` (pnpm 10.34.5, measured
 * 2026-09-27). Playwright reads everything after `--` as test-file filters, so the
 * `--project` and `--grep` that should have narrowed the run matched no file argument and the
 * whole suite ran — a "scoped" snapshot update that could rewrite unrelated snapshots
 * (`f-20260910-07`). The first `--` is that pnpm artefact, never a Playwright separator, so it
 * is dropped; with or without it, the options reach Playwright as options.
 */
export function playwrightArguments(forwarded) {
  const separator = forwarded.indexOf("--");
  if (separator === -1) return [...forwarded];
  return [...forwarded.slice(0, separator), ...forwarded.slice(separator + 1)];
}

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

function exitCodeForSignal(signal) {
  return 128 + (osConstants.signals[signal] ?? 0);
}

function startDockerCommand(args, { spawnProcess = spawn, forwardOutput = false } = {}) {
  const child = spawnProcess("docker", args, {
    cwd: projectRoot,
    stdio: ["ignore", "pipe", "pipe"],
    detached: true,
  });
  let stdout = "";
  let stderr = "";
  child.stdout?.on("data", (chunk) => {
    stdout += chunk.toString("utf8");
    if (forwardOutput) process.stdout.write(chunk);
  });
  child.stderr?.on("data", (chunk) => {
    stderr += chunk.toString("utf8");
    if (forwardOutput) process.stderr.write(chunk);
  });

  const supervisor = superviseChild(child, {
    terminationTimeoutMs: DOCKER_TERMINATION_TIMEOUT_MS,
    killProcessGroup: true,
  });
  const done = supervisor.done.then(({ code, signal, error }) => ({
    code: code ?? (signal ? exitCodeForSignal(signal) : 1),
    signal,
    error,
    stdout,
    stderr,
  }));
  return { done, supervisor };
}

function installLauncherCancellation(abortSignal) {
  let requested;
  let resolveRequested;
  const requestedPromise = new Promise((resolve) => {
    resolveRequested = resolve;
  });
  const supervisors = new Set();
  const request = (reason) => {
    if (requested !== undefined) return;
    requested = reason;
    resolveRequested(reason);
    for (const supervisor of supervisors) supervisor.terminate().catch(() => {});
  };
  const onSigint = () => request("SIGINT");
  const onSigterm = () => request("SIGTERM");
  const onAbort = () => request("abort");

  process.on("SIGINT", onSigint);
  process.on("SIGTERM", onSigterm);
  if (abortSignal?.aborted) onAbort();
  else abortSignal?.addEventListener("abort", onAbort, { once: true });

  return {
    get requested() {
      return requested;
    },
    requestedPromise,
    attach(supervisor) {
      supervisors.add(supervisor);
      if (requested !== undefined) supervisor.terminate().catch(() => {});
    },
    uninstall() {
      process.off("SIGINT", onSigint);
      process.off("SIGTERM", onSigterm);
      abortSignal?.removeEventListener("abort", onAbort);
    },
  };
}

function dockerError(result) {
  return result.error
    ? `docker ${result.error.message}`
    : `docker exited ${result.code}${result.stderr.trim() ? `: ${result.stderr.trim()}` : ""}`;
}

async function cleanupContainer(containerName, options) {
  try {
    const result = await startDockerCommand(["rm", "-f", containerName], options).done;
    if (result.code === 0) return undefined;
    if (/no such container/iu.test(`${result.stdout}\n${result.stderr}`)) return undefined;

    const detail = result.error ? errorMessage(result.error) : dockerError(result);
    return new Error(
      `Failed to stop and remove e2e container ${containerName}: ${detail}; a retry is not known to be clean.`,
    );
  } catch (error) {
    return new Error(
      `Failed to stop and remove e2e container ${containerName}: ${errorMessage(error)}; a retry is not known to be clean.`,
    );
  }
}

function reportCleanupFailure(error) {
  process.stderr.write(`${error.message}\n`);
}

/** Run one bounded e2e container and clean it after every failed or interrupted run. */
export async function runE2eContainer(
  forwarded = process.argv.slice(2),
  { spawnProcess = spawn, abortSignal = undefined } = {},
) {
  const cancellation = installLauncherCancellation(abortSignal);
  const spawnOptions = { spawnProcess };
  let exitCode = 0;
  let containerName;
  try {
    const support = await startDockerCommand(["info", "--format", "{{.MemoryLimit}}"], spawnOptions)
      .done;
    if (support.error || support.code !== 0) {
      process.stderr.write(
        "docker is required for the containerized e2e run and is not available.\n" +
          "The native `pnpm test:e2e` compares against snapshots recorded in the container,\n" +
          "so it fails on font rasterization alone on most machines. Install docker, or run\n" +
          `the suite in CI.\nDocker probe error: ${dockerError(support)}\n`,
      );
      return { exitCode: 1, containerName };
    }
    if (support.stdout.trim() !== "true") {
      process.stderr.write(
        `Docker does not support memory-limited containers: docker info --format '{{.MemoryLimit}}' returned ${JSON.stringify(support.stdout.trim())}; refusing to start e2e.\n`,
      );
      return { exitCode: 1, containerName };
    }
    if (cancellation.requested !== undefined) {
      return {
        exitCode:
          cancellation.requested === "SIGINT" || cancellation.requested === "SIGTERM"
            ? exitCodeForSignal(cancellation.requested)
            : 1,
        containerName,
      };
    }

    // Scope, stated honestly: this pins the RENDERING environment, which is what the snapshots
    // depend on. It does not make the run portable across host platforms — `node_modules` is
    // mounted from the host, so its native packages (esbuild, @swc/core, @parcel/watcher) must be
    // the ones Linux x64 needs. On a macOS or Windows host, install dependencies inside the
    // container instead of mounting a host tree built for another platform.
    if (typeof process.getuid !== "function" || typeof process.getgid !== "function") {
      process.stderr.write(
        "The containerized e2e run needs a POSIX host: it maps the container process to the\n" +
          "invoking uid/gid so nothing lands root-owned in the working tree, and process.getuid\n" +
          "is unavailable here (Windows). Run it under WSL, or in CI.\n",
      );
      return { exitCode: 1, containerName };
    }

    // Root-owned dist/, artifacts/ and snapshot files in the host tree are worse than a failed
    // run, so the container always runs as the invoking user. That user has no entry in the
    // image's /etc/passwd, hence an explicit writable HOME.
    const uid = process.getuid();
    const gid = process.getgid();
    containerName = `chessfable-e2e-${process.pid}-${randomUUID()}`;
    const run = startDockerCommand(
      [
        "run",
        "--rm",
        "--memory",
        E2E_CONTAINER_MEMORY,
        "--name",
        containerName,
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
        playwrightImage(),
        "node_modules/.bin/playwright",
        "test",
        ...playwrightArguments(forwarded),
      ],
      { ...spawnOptions, forwardOutput: true },
    );
    cancellation.attach(run.supervisor);

    const outcome = await Promise.race([
      run.done.then((result) => ({ result })),
      cancellation.requestedPromise.then((reason) => ({ reason })),
    ]);
    let result;
    if ("reason" in outcome) {
      await run.supervisor.terminate();
      result = await run.done;
      exitCode =
        outcome.reason === "SIGINT" || outcome.reason === "SIGTERM"
          ? exitCodeForSignal(outcome.reason)
          : 1;
    } else {
      result = outcome.result;
      if (result.error || result.code !== 0) exitCode = result.code || 1;
    }

    if (exitCode !== 0) {
      const cleanupError = await cleanupContainer(containerName, spawnOptions);
      if (cleanupError) {
        reportCleanupFailure(cleanupError);
        exitCode = 1;
      } else if (result.error) {
        process.stderr.write(`E2E container runner failed: ${errorMessage(result.error)}\n`);
      }
    }
    return { exitCode, containerName };
  } catch (error) {
    if (containerName) {
      const cleanupError = await cleanupContainer(containerName, spawnOptions);
      if (cleanupError) {
        reportCleanupFailure(cleanupError);
        exitCode = 1;
      } else {
        process.stderr.write(`E2E container launcher failed: ${errorMessage(error)}\n`);
        exitCode = 1;
      }
      return { exitCode, containerName };
    }
    process.stderr.write(`E2E container launcher failed: ${errorMessage(error)}\n`);
    return { exitCode: 1, containerName };
  } finally {
    cancellation.uninstall();
  }
}

async function main() {
  const result = await runE2eContainer(process.argv.slice(2));
  process.exitCode = result.exitCode;
}

if (isEntrypoint(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(`${errorMessage(error)}\n`);
    process.exitCode = 1;
  });
}
