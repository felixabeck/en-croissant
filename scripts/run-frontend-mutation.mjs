import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { installSignalForwarding, superviseChild } from "./child-supervisor.mjs";
import { fsyncDirectory } from "./fsync-directory.mjs";
import { mutationPackages } from "./frontend-mutation-packages.mjs";
import {
  currentIdentity,
  identityForPid,
  identityIsLive,
  isCompleteIdentity,
} from "./process-identity.mjs";

const fencePath = "mutants.out/frontend/.mutation-in-progress";
const ownerPath = join(fencePath, "owner.json");
const terminationTimeoutMs = 2_000;

if (process.argv.includes("--list-packages")) {
  console.log(JSON.stringify(Object.keys(mutationPackages)));
  process.exit(0);
}

function readOwner() {
  try {
    const owner = JSON.parse(readFileSync(ownerPath, "utf8"));
    if (!owner || typeof owner !== "object" || !isCompleteIdentity(owner.runner)) return undefined;
    if (owner.child !== null && !isCompleteIdentity(owner.child)) return undefined;
    return owner;
  } catch (error) {
    if (error?.code !== "ENOENT" && !(error instanceof SyntaxError)) throw error;
    return undefined;
  }
}

function refuseFence(owner, reason = undefined) {
  const detail = owner
    ? ` (runner pid ${owner.runner.pid})`
    : " (owner record missing or malformed)";
  console.error(`Frontend mutation fence exists: ${fencePath}${detail}`);
  if (reason) console.error(`Cannot determine whether the fence owner is alive: ${reason}`);
  console.error("Recovery procedure:");
  console.error("1. Confirm no stryker process is running, and terminate it if one is.");
  console.error(`2. Remove ${fencePath} once nothing is running.`);
}

function publishFence(runnerIdentity) {
  const parent = dirname(fencePath);
  mkdirSync(parent, { recursive: true });
  const pending = mkdtempSync(`${fencePath}.pending-`);
  let published = false;
  try {
    writeFileSync(
      join(pending, "owner.json"),
      `${JSON.stringify({ runner: runnerIdentity, child: null }, null, 2)}\n`,
      { encoding: "utf8", flag: "wx", mode: 0o600 },
    );
    fsyncDirectory(pending);
    renameSync(pending, fencePath);
    published = true;
    fsyncDirectory(parent);
  } catch (error) {
    rmSync(published ? fencePath : pending, { recursive: true, force: true });
    throw error;
  }
}

function acquireFence(runnerIdentity) {
  while (true) {
    if (!existsSync(fencePath)) {
      try {
        publishFence(runnerIdentity);
        return true;
      } catch (error) {
        if (error?.code !== "EEXIST" && error?.code !== "ENOTEMPTY") throw error;
        continue;
      }
    }

    let owner;
    try {
      owner = readOwner();
    } catch (error) {
      refuseFence(undefined, error instanceof Error ? error.message : String(error));
      return false;
    }
    if (!owner) {
      refuseFence(owner);
      return false;
    }
    try {
      if (identityIsLive(owner.runner) || owner.child === null || identityIsLive(owner.child)) {
        refuseFence(owner);
        return false;
      }
    } catch (error) {
      refuseFence(owner, error instanceof Error ? error.message : String(error));
      return false;
    }

    const stalePath = `${fencePath}.stale-${randomUUID()}`;
    try {
      renameSync(fencePath, stalePath);
    } catch (error) {
      if (error?.code === "ENOENT") continue;
      throw error;
    }
    rmSync(stalePath, { recursive: true });
  }
}

function writeOwner(runnerIdentity, childIdentity) {
  const temporaryPath = join(fencePath, `.owner.json.tmp-${process.pid}`);
  writeFileSync(
    temporaryPath,
    `${JSON.stringify({ runner: runnerIdentity, child: childIdentity }, null, 2)}\n`,
    { encoding: "utf8", flag: "wx", mode: 0o600 },
  );
  renameSync(temporaryPath, ownerPath);
  fsyncDirectory(fencePath);
}

function resolveStrykerEntry(cwd) {
  let packagePath;
  try {
    packagePath = createRequire(join(cwd, "package.json")).resolve(
      "@stryker-mutator/core/package.json",
    );
  } catch (error) {
    throw new Error(`Cannot resolve the Stryker CLI from ${cwd}: ${error.message}`, {
      cause: error,
    });
  }
  const entry = join(dirname(packagePath), "bin", "stryker.js");
  if (!existsSync(entry)) {
    throw new Error(`Cannot resolve the Stryker CLI from ${cwd}: ${entry} does not exist`);
  }
  return entry;
}

async function main() {
  const runnerIdentity = currentIdentity();
  if (!acquireFence(runnerIdentity)) return 1;

  let supervisor;
  const signalForwarding = installSignalForwarding(() => supervisor);
  let exitCode = 0;
  try {
    // Stryker cannot clean a sandbox after SIGKILL. Only the fence owner may purge
    // the shared directory, so a concurrent run can never remove a live sandbox.
    rmSync(".stryker-tmp", { recursive: true, force: true });

    for (const mutationPackage of Object.keys(mutationPackages)) {
      if (signalForwarding.requestedSignal) break;
      console.log(`\nFrontend mutation package: ${mutationPackage}`);
      writeOwner(runnerIdentity, null);
      const child = spawn(process.execPath, [resolveStrykerEntry(process.cwd()), "run"], {
        detached: true,
        env: { ...process.env, STRYKER_PACKAGE: mutationPackage },
        stdio: "inherit",
      });
      supervisor = superviseChild(child, { terminationTimeoutMs, killProcessGroup: true });
      signalForwarding.attach(supervisor);
      const childIdentity = child.pid === undefined ? undefined : identityForPid(child.pid);
      writeOwner(runnerIdentity, childIdentity ?? null);
      const result = await supervisor.done;
      supervisor = undefined;
      if (signalForwarding.requestedSignal) break;
      if (result.error) throw result.error;
      if (result.code !== 0) {
        exitCode = result.code ?? 1;
        break;
      }
    }
  } catch (error) {
    console.error(error);
    exitCode = 1;
  } finally {
    if (supervisor) await supervisor.terminate();
    await signalForwarding.termination;
    rmSync(fencePath, { recursive: true });
    fsyncDirectory(dirname(fencePath));
    signalForwarding.uninstall();
  }

  if (signalForwarding.requestedSignal) {
    return signalForwarding.requestedSignal === "SIGINT" ? 130 : 143;
  }
  return exitCode;
}

try {
  process.exitCode = await main();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}
