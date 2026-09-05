import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import {
  closeSync,
  existsSync,
  fsyncSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { mutationPackages } from "./frontend-mutation-packages.mjs";
import { currentIdentity, identityForPid, identityIsLive } from "./process-identity.mjs";

const fencePath = "mutants.out/frontend/.mutation-in-progress";
const ownerPath = join(fencePath, "owner.json");
const terminationTimeoutMs = 2_000;

if (process.argv.includes("--list-packages")) {
  console.log(JSON.stringify(Object.keys(mutationPackages)));
  process.exit(0);
}

function fsyncDirectory(path) {
  const fd = openSync(path, "r");
  try {
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
}

function validIdentity(value) {
  return (
    value &&
    Number.isSafeInteger(value.pid) &&
    value.pid > 0 &&
    typeof value.startTime === "string" &&
    value.startTime.length > 0
  );
}

function readOwner() {
  try {
    const owner = JSON.parse(readFileSync(ownerPath, "utf8"));
    if (!owner || typeof owner !== "object" || !validIdentity(owner.runner)) return undefined;
    if (owner.child !== null && !validIdentity(owner.child)) return undefined;
    return owner;
  } catch {
    return undefined;
  }
}

function ownerIsLive(owner) {
  return identityIsLive(owner.runner) || (owner.child !== null && identityIsLive(owner.child));
}

function refuseFence(owner) {
  const detail = owner
    ? ` (runner pid ${owner.runner.pid})`
    : " (owner record missing or malformed)";
  console.error(`Frontend mutation fence is live: ${fencePath}${detail}`);
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

    const owner = readOwner();
    if (!owner || ownerIsLive(owner)) {
      refuseFence(owner);
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

function waitForChild(childProcess) {
  return new Promise((resolve) => {
    let spawnError;
    childProcess.once("error", (error) => {
      spawnError = error;
    });
    childProcess.once("close", (code, signal) => resolve({ code, signal, error: spawnError }));
  });
}

let child;
let childDone;
let requestedSignal;
let escalationTimer;

function scheduleEscalation() {
  if (escalationTimer) return;
  escalationTimer = setTimeout(() => {
    if (child && child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
  }, terminationTimeoutMs);
  escalationTimer.unref();
}

function clearEscalation() {
  if (escalationTimer) clearTimeout(escalationTimer);
  escalationTimer = undefined;
}

const signalHandler = (signal) => {
  if (requestedSignal) return;
  requestedSignal = signal;
  if (child && child.exitCode === null && child.signalCode === null) {
    child.kill("SIGTERM");
    scheduleEscalation();
  }
};

async function terminateAndReapChild() {
  if (!childDone) return;
  if (child && child.exitCode === null && child.signalCode === null) child.kill("SIGTERM");
  scheduleEscalation();
  await childDone;
  clearEscalation();
  child = undefined;
  childDone = undefined;
}

async function main() {
  const runnerIdentity = currentIdentity();
  if (!acquireFence(runnerIdentity)) return 1;

  process.on("SIGINT", signalHandler);
  process.on("SIGTERM", signalHandler);
  let exitCode = 0;
  try {
    // Stryker cannot clean a sandbox after SIGKILL. Only the fence owner may purge
    // the shared directory, so a concurrent run can never remove a live sandbox.
    rmSync(".stryker-tmp", { recursive: true, force: true });

    for (const mutationPackage of Object.keys(mutationPackages)) {
      if (requestedSignal) break;
      console.log(`\nFrontend mutation package: ${mutationPackage}`);
      writeOwner(runnerIdentity, null);
      child = spawn("pnpm", ["exec", "stryker", "run"], {
        env: { ...process.env, STRYKER_PACKAGE: mutationPackage },
        stdio: "inherit",
      });
      childDone = waitForChild(child);
      const childIdentity = child.pid === undefined ? undefined : identityForPid(child.pid);
      writeOwner(runnerIdentity, childIdentity ?? null);
      const result = await childDone;
      clearEscalation();
      child = undefined;
      childDone = undefined;
      if (requestedSignal) break;
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
    await terminateAndReapChild();
    rmSync(fencePath, { recursive: true });
    fsyncDirectory(dirname(fencePath));
    process.off("SIGINT", signalHandler);
    process.off("SIGTERM", signalHandler);
  }

  if (requestedSignal) return requestedSignal === "SIGINT" ? 130 : 143;
  return exitCode;
}

try {
  process.exitCode = await main();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}
