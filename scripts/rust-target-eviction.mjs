#!/usr/bin/env node

// Bounds cargo build directories across every checkout of this repository.
// A unit is a directory that directly contains `.cargo-lock` (Cargo 1.98.0 also
// writes `.cargo-build-lock` and `.cargo-artifact-lock` in the same directory;
// an added lock file name is a known limit). Size is allocated 512-byte blocks
// from lstat, each inode counted once, matching `du`.
import { spawnSync } from "node:child_process";
import { lstatSync, readdirSync, readlinkSync, realpathSync, rmSync, unlinkSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { isEntrypoint } from "./entrypoint.mjs";
import { fencePath, mutationCacheRelativePath } from "./run-backend-mutation.mjs";

const GIB = 1024n ** 3n;
// A freshly built warm checkout measured about 25 GiB (26 GB) on 2026-10-31
// (drain and side-lane-codex-20261027). The finding measured 123 GB of
// accumulation in the main checkout. 40 GiB sits above a warm root and below
// that accumulation.
export const OWN_CHECKOUT_CAP_BYTES = 40n * GIB;
// Newest mtime among the unit directory and its deps/.fingerprint/build/
// incremental children. 7 days is the finding's idle window for a checkout
// nobody compiles in.
export const IDLE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
// `st_blocks` is in 512-byte units; this is the measure `du` reports.
const ALLOCATED_BLOCK_BYTES = 512n;
export const CARGO_LOCK_FILE = ".cargo-lock";
export const CARGO_LOCK_FILES = Object.freeze([
  ".cargo-lock",
  ".cargo-build-lock",
  ".cargo-artifact-lock",
]);
export const UNIT_MTIME_CHILDREN = Object.freeze(["deps", ".fingerprint", "build", "incremental"]);
export const TARGET_ROOT_RELATIVE_PATHS = Object.freeze([
  "src-tauri/target",
  mutationCacheRelativePath,
]);
export const MAX_UNIT_DEPTH = 3;
export const FLOCK_HELD_EXIT_CODE = 75;
// The remover never exits 75, so a flock -n -E 75 wrapper cannot misread a
// partial removal as "lock held".
export const REMOVER_FAILURE_EXIT_CODE = 2;
const DELETED_EXE_SUFFIX = " (deleted)";
const thisScript = fileURLToPath(import.meta.url);

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

function errorCode(error) {
  return error && typeof error === "object" ? error.code : undefined;
}

function lstatOrAbsent(path, lstat) {
  try {
    return lstat(path, { bigint: true });
  } catch (error) {
    if (errorCode(error) === "ENOENT") return undefined;
    throw error;
  }
}

function canonicalOrSpelled(path, realpath) {
  try {
    return realpath(path);
  } catch {
    return path;
  }
}

function pathSegments(path) {
  return path.split(sep).filter(Boolean);
}

function isStrictlyInside(inner, outer) {
  const innerParts = pathSegments(inner);
  const outerParts = pathSegments(outer);
  if (innerParts.length <= outerParts.length) return false;
  return outerParts.every((part, index) => innerParts[index] === part);
}

function isSameOrInside(inner, outer) {
  return inner === outer || isStrictlyInside(inner, outer);
}

function normalizeExeTarget(exePath) {
  return exePath.endsWith(DELETED_EXE_SUFFIX)
    ? exePath.slice(0, -DELETED_EXE_SUFFIX.length)
    : exePath;
}

export function allocatedBytes(
  root,
  { lstat = lstatSync, readdir = readdirSync, skip = () => false } = {},
) {
  const seen = new Set();
  let total = 0n;
  const visit = (path) => {
    if (skip(path)) return;
    const stat = lstat(path, { bigint: true });
    const key = `${stat.dev}:${stat.ino}`;
    if (!seen.has(key)) {
      seen.add(key);
      total += stat.blocks * ALLOCATED_BLOCK_BYTES;
    }
    if (stat.isSymbolicLink() || !stat.isDirectory()) return;
    for (const name of readdir(path)) visit(join(path, name));
  };
  visit(root);
  return total;
}

function skipEvictableContent(evictableUnits) {
  return (path) => {
    for (const unit of evictableUnits) {
      if (path === unit.path) return false;
      if (!isStrictlyInside(path, unit.path)) continue;
      return !CARGO_LOCK_FILES.includes(relative(unit.path, path));
    }
    return false;
  };
}

function presentLockPaths(unitPath, lstat) {
  const present = [];
  for (const name of CARGO_LOCK_FILES) {
    const path = join(unitPath, name);
    const stat = lstatOrAbsent(path, lstat);
    if (!stat) continue;
    if (stat.isSymbolicLink()) {
      return { symlink: path };
    }
    present.push(path);
  }
  return { present };
}

export function checkLockFile(lockPath, { flockBinary = "flock", spawn = spawnSync } = {}) {
  const result = spawn(flockBinary, ["-n", "-E", String(FLOCK_HELD_EXIT_CODE), lockPath, "true"], {
    encoding: "utf8",
  });
  if (result.error) {
    const missing = errorCode(result.error) === "ENOENT";
    return {
      undetermined: missing
        ? `missing flock binary ${flockBinary}`
        : `flock ${lockPath}: ${errorMessage(result.error)}`,
    };
  }
  if (result.status === 0) return { held: false };
  if (result.status === FLOCK_HELD_EXIT_CODE) return { held: true };
  return { undetermined: `flock ${lockPath} exit ${result.status}` };
}

function checkLocks(lockPaths, options) {
  for (const lockPath of lockPaths) {
    const status = checkLockFile(lockPath, options);
    if (status.undetermined) return status;
    if (status.held) return { held: true };
  }
  return { held: false };
}

function newestCargoWriteMs(unitPath, { lstat = lstatSync } = {}) {
  const times = [];
  const add = (path, absentOk) => {
    try {
      times.push(Number(lstat(path, { bigint: true }).mtimeMs));
    } catch (error) {
      if (absentOk && errorCode(error) === "ENOENT") return;
      throw error;
    }
  };
  add(unitPath, false);
  for (const child of UNIT_MTIME_CHILDREN) add(join(unitPath, child), true);
  return Math.max(...times);
}

function fenceState(checkoutPath, { lstat = lstatSync, fenceRelative = fencePath } = {}) {
  const path = join(checkoutPath, fenceRelative);
  try {
    lstat(path, { bigint: true });
    return { present: true, path };
  } catch (error) {
    if (errorCode(error) === "ENOENT") return { present: false, path };
    return { undetermined: `fence ${path}: ${errorMessage(error)}`, path };
  }
}

function isMutationCacheUnit(unitCanonical, cacheCanonical) {
  return isSameOrInside(unitCanonical, cacheCanonical);
}

export function scanSameUserExecutables({
  procRoot = "/proc",
  uid = process.getuid?.(),
  readdirProc,
  lstatProc,
  readlinkExe,
  readdir = readdirSync,
  lstat = lstatSync,
  readlink = readlinkSync,
} = {}) {
  if (uid === undefined) {
    return { undetermined: "process uid is unavailable" };
  }
  const listProc = readdirProc ?? readdir;
  const statProc = lstatProc ?? lstat;
  const readExe = readlinkExe ?? readlink;
  let names;
  try {
    names = listProc(procRoot);
  } catch (error) {
    return { undetermined: `cannot list ${procRoot}: ${errorMessage(error)}` };
  }
  const executables = [];
  const owner = BigInt(uid);
  for (const name of names) {
    if (!/^\d+$/u.test(name)) continue;
    const procPath = join(procRoot, name);
    let stat;
    try {
      stat = statProc(procPath, { bigint: true });
    } catch (error) {
      const code = errorCode(error);
      if (code === "ENOENT" || code === "ESRCH") continue;
      return { undetermined: `cannot stat ${procPath}: ${errorMessage(error)}` };
    }
    if (stat.uid !== owner) continue;
    const exePath = join(procPath, "exe");
    let exe;
    try {
      exe = readExe(exePath);
    } catch (error) {
      const code = errorCode(error);
      if (code === "ENOENT" || code === "ESRCH" || code === "EACCES") continue;
      return { undetermined: `cannot read ${exePath}: ${errorMessage(error)}` };
    }
    executables.push(exe);
  }
  return { executables };
}

function executableInUse(unitCanonical, options) {
  const scan = scanSameUserExecutables(options);
  if (scan.undetermined) return scan;
  const realpath = options.realpath ?? realpathSync;
  for (const exe of scan.executables) {
    const spelled = normalizeExeTarget(exe);
    const canonical = canonicalOrSpelled(spelled, realpath);
    if (isStrictlyInside(canonical, unitCanonical)) return { inUse: true };
  }
  return { inUse: false };
}

function findUnits(rootPath, { lstat = lstatSync, readdir = readdirSync } = {}) {
  const units = [];
  const symlinkUnits = [];
  const walk = (dir, depth) => {
    if (depth > MAX_UNIT_DEPTH) return;
    const entries = readdir(dir, { withFileTypes: true });
    const lock = lstatOrAbsent(join(dir, CARGO_LOCK_FILE), lstat);
    if (lock) {
      units.push(dir);
      return;
    }
    for (const entry of entries) {
      const path = join(dir, entry.name);
      if (entry.isSymbolicLink()) {
        symlinkUnits.push(path);
        continue;
      }
      if (!entry.isDirectory()) continue;
      walk(path, depth + 1);
    }
  };
  walk(rootPath, 1);
  return { units, symlinkUnits };
}

function listCheckouts(cwd, { spawn = spawnSync, git = "git" } = {}) {
  const result = spawn(git, ["worktree", "list", "--porcelain"], { cwd, encoding: "utf8" });
  if (result.error || result.status !== 0) {
    const detail = result.error
      ? errorMessage(result.error)
      : result.stderr?.trim() || `exit ${result.status ?? "unknown"}`;
    return { error: `git worktree list --porcelain failed (${detail})`, checkouts: [cwd] };
  }
  const blocks = String(result.stdout ?? "").split("\n\n");
  const checkouts = [];
  for (const block of blocks) {
    const lines = block.split("\n").filter(Boolean);
    if (lines.length === 0) continue;
    const worktree = lines.find((line) => line.startsWith("worktree "))?.slice("worktree ".length);
    if (!worktree) continue;
    const prunable = lines.some((line) => line.startsWith("prunable "));
    checkouts.push({ path: worktree, prunable });
  }
  if (checkouts.length === 0) checkouts.push({ path: cwd, prunable: false });
  return { checkouts };
}

function removeEntry(path, { lstat = lstatSync, unlink = unlinkSync, rm = rmSync } = {}) {
  const stat = lstat(path, { bigint: true });
  if (stat.isSymbolicLink() || stat.isFile()) {
    unlink(path);
    return;
  }
  if (stat.isDirectory()) {
    rm(path, { recursive: true, force: false });
    return;
  }
  unlink(path);
}

export function removeUnitContents(unitPath, io = {}) {
  const lstat = io.lstat ?? lstatSync;
  const readdir = io.readdir ?? readdirSync;
  const duringRemoval = io.duringRemoval;
  const lockPaths =
    presentLockPaths(unitPath, lstat).present ??
    CARGO_LOCK_FILES.map((name) => join(unitPath, name));
  duringRemoval?.(unitPath, lockPaths);

  const fingerprint = join(unitPath, ".fingerprint");
  if (lstatOrAbsent(fingerprint, lstat)) {
    try {
      removeEntry(fingerprint, io);
    } catch (error) {
      return {
        ok: false,
        partial: false,
        error: `cannot remove .fingerprint: ${errorMessage(error)}`,
      };
    }
  }

  const failures = [];
  for (const name of readdir(unitPath)) {
    if (CARGO_LOCK_FILES.includes(name)) continue;
    const path = join(unitPath, name);
    try {
      removeEntry(path, io);
    } catch (error) {
      failures.push(`${name}: ${errorMessage(error)}`);
    }
  }
  if (failures.length > 0) {
    return { ok: false, partial: true, error: failures.join("; ") };
  }
  return { ok: true, partial: false };
}

export function recheckUnitAfterLock(unitPath, job, io = {}) {
  const lstat = io.lstat ?? lstatSync;
  const realpath = io.realpath ?? realpathSync;
  const unitCanonical = canonicalOrSpelled(unitPath, realpath);

  const exe = executableInUse(unitCanonical, { ...job, ...io, realpath });
  if (exe.undetermined) return { proceed: false, kind: "undetermined", detail: exe.undetermined };
  if (exe.inUse) return { proceed: false, kind: "expected", reason: "in use (executable)" };

  if (job.cacheCanonical && isMutationCacheUnit(unitCanonical, job.cacheCanonical)) {
    const fence = fenceState(job.checkoutPath, { lstat, fenceRelative: job.fenceRelative });
    if (fence.undetermined) {
      return { proceed: false, kind: "undetermined", detail: fence.undetermined };
    }
    if (fence.present) return { proceed: false, kind: "expected", reason: "mutation fence" };
  }

  if (!job.ownCheckout) {
    let newest;
    try {
      newest = newestCargoWriteMs(unitPath, { lstat });
    } catch (error) {
      return {
        proceed: false,
        kind: "undetermined",
        detail: `idle mtime ${unitPath}: ${errorMessage(error)}`,
      };
    }
    if (job.nowMs - newest < job.idleMaxAgeMs) {
      return { proceed: false, kind: "expected", reason: "not idle" };
    }
  }
  return { proceed: true };
}

function parseWorkerJson(stdout) {
  const lines = String(stdout ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    try {
      return JSON.parse(lines[index]);
    } catch {
      // Keep scanning; during-removal hooks may print other lines.
    }
  }
  return undefined;
}

function nestFlockArgs(lockPaths, inner, flockBinary) {
  const args = [];
  for (const [index, lockPath] of lockPaths.entries()) {
    if (index > 0) args.push(flockBinary);
    args.push("-n", "-E", String(FLOCK_HELD_EXIT_CODE), lockPath);
  }
  args.push(...inner);
  return args;
}

function defaultRunUnderLocks(lockPaths, innerArgv, { flockBinary, spawn, env }) {
  if (lockPaths.length === 0) {
    return spawn(innerArgv[0], innerArgv.slice(1), { encoding: "utf8", env });
  }
  const args = nestFlockArgs(lockPaths, innerArgv, flockBinary);
  return spawn(flockBinary, args, { encoding: "utf8", env });
}

function observeUnit(unitPath, context) {
  const { lstat, realpath } = context;
  const spelledStat = lstatOrAbsent(unitPath, lstat);
  if (!spelledStat) {
    return { path: unitPath, skip: true, kind: "expected", reason: "missing" };
  }
  if (spelledStat.isSymbolicLink()) {
    return { path: unitPath, skip: true, kind: "expected", reason: "symlink" };
  }
  const unitCanonical = canonicalOrSpelled(unitPath, realpath);
  let size;
  try {
    size = context.allocatedBytes(unitPath);
  } catch (error) {
    return {
      path: unitPath,
      canonical: unitCanonical,
      skip: true,
      kind: "undetermined",
      detail: `size walk ${unitPath}: ${errorMessage(error)}`,
    };
  }

  const locks = presentLockPaths(unitPath, lstat);
  if (locks.symlink) {
    return {
      path: unitPath,
      canonical: unitCanonical,
      size,
      skip: true,
      kind: "expected",
      reason: "symlink",
    };
  }
  if (!locks.present.includes(join(unitPath, CARGO_LOCK_FILE))) {
    return {
      path: unitPath,
      canonical: unitCanonical,
      size,
      skip: true,
      kind: "undetermined",
      detail: `unit ${unitPath} has no ${CARGO_LOCK_FILE}`,
    };
  }

  if (context.cacheCanonical && isMutationCacheUnit(unitCanonical, context.cacheCanonical)) {
    const fence = fenceState(context.checkoutPath, context);
    if (fence.undetermined) {
      return {
        path: unitPath,
        canonical: unitCanonical,
        size,
        skip: true,
        kind: "undetermined",
        detail: fence.undetermined,
      };
    }
    if (fence.present) {
      return {
        path: unitPath,
        canonical: unitCanonical,
        size,
        skip: true,
        kind: "expected",
        reason: "mutation fence",
      };
    }
  }

  const lockStatus = context.checkLocks(locks.present, context);
  if (lockStatus.undetermined) {
    return {
      path: unitPath,
      canonical: unitCanonical,
      size,
      skip: true,
      kind: "undetermined",
      detail: lockStatus.undetermined,
    };
  }
  if (lockStatus.held) {
    return {
      path: unitPath,
      canonical: unitCanonical,
      size,
      skip: true,
      kind: "expected",
      reason: "in use (lock held)",
    };
  }

  const exe = executableInUse(unitCanonical, context);
  if (exe.undetermined) {
    return {
      path: unitPath,
      canonical: unitCanonical,
      size,
      skip: true,
      kind: "undetermined",
      detail: exe.undetermined,
    };
  }
  if (exe.inUse) {
    return {
      path: unitPath,
      canonical: unitCanonical,
      size,
      skip: true,
      kind: "expected",
      reason: "in use (executable)",
    };
  }

  if (!context.ownCheckout) {
    let newest;
    try {
      newest = newestCargoWriteMs(unitPath, { lstat });
    } catch (error) {
      return {
        path: unitPath,
        canonical: unitCanonical,
        size,
        skip: true,
        kind: "undetermined",
        detail: `idle mtime ${unitPath}: ${errorMessage(error)}`,
      };
    }
    if (context.nowMs - newest < context.idleMaxAgeMs) {
      return {
        path: unitPath,
        canonical: unitCanonical,
        size,
        skip: true,
        kind: "expected",
        reason: "not idle",
      };
    }
  }

  return {
    path: unitPath,
    canonical: unitCanonical,
    size,
    lockPaths: locks.present,
    skip: false,
  };
}

function emitUnitOutcome(emit, observation) {
  if (observation.kind === "undetermined") {
    emit(`skipped ${observation.path} undetermined: ${observation.detail}`);
    return;
  }
  emit(`skipped ${observation.path} reason=${observation.reason}`);
}

function interpretWorkerResult(result, unitPath) {
  const parsed = parseWorkerJson(result.stdout);
  if (parsed) {
    if (parsed.proceed === false) {
      return parsed.kind === "undetermined"
        ? { kind: "undetermined", detail: parsed.detail, path: unitPath }
        : { kind: "expected", reason: parsed.reason, path: unitPath };
    }
    if (parsed.removal?.ok) {
      return { kind: "evicted", path: unitPath, freed: parsed.freed };
    }
    const prefix = parsed.removal?.partial ? "partial removal" : "removal failed";
    return {
      kind: "failed",
      path: unitPath,
      detail: `${prefix}: ${parsed.removal?.error ?? "unknown remover failure"}`,
    };
  }
  if (result.error) {
    const missing = errorCode(result.error) === "ENOENT";
    return {
      kind: "undetermined",
      path: unitPath,
      detail: missing
        ? `missing flock binary ${result.error.path ?? ""}`.trim()
        : `remover spawn: ${errorMessage(result.error)}`,
    };
  }
  if (result.status === FLOCK_HELD_EXIT_CODE) {
    return { kind: "expected", reason: "in use (lock held)", path: unitPath };
  }
  if (result.status === 0) {
    return {
      kind: "undetermined",
      path: unitPath,
      detail: `remover produced no result for ${unitPath}`,
    };
  }
  return {
    kind: "failed",
    path: unitPath,
    detail: `remover exit ${result.status}: ${String(result.stderr ?? "").trim()}`,
  };
}

async function evictObservedUnit(observation, context) {
  const unitPath = observation.path;
  await context.beforeLock?.(unitPath);
  const locks = presentLockPaths(unitPath, context.lstat);
  if (locks.symlink) {
    return { kind: "expected", reason: "symlink", path: unitPath };
  }
  if (!locks.present?.length) {
    return {
      kind: "undetermined",
      detail: `unit ${unitPath} lost its lock files before removal`,
      path: unitPath,
    };
  }
  const sizeBefore = context.allocatedBytes(unitPath);
  const job = {
    unitPath,
    checkoutPath: context.checkoutPath,
    cacheCanonical: context.cacheCanonical,
    fenceRelative: context.fenceRelative,
    ownCheckout: context.ownCheckout,
    idleMaxAgeMs: context.idleMaxAgeMs,
    nowMs: context.nowMs,
    procRoot: context.procRoot,
    uid: context.uid,
    afterLockModule: context.afterLockModule,
    duringRemovalModule: context.duringRemovalModule,
    lockPaths: locks.present,
  };
  const env = {
    ...context.env,
    RUST_TARGET_EVICTION_JOB: JSON.stringify(job),
  };
  const innerArgv = [context.execPath, thisScript, "--remove-unit"];
  const result = context.runUnderLocks(locks.present, innerArgv, {
    flockBinary: context.flockBinary,
    spawn: context.spawn,
    env,
  });
  const interpreted = interpretWorkerResult(result, unitPath);
  if (interpreted.kind === "evicted") {
    let sizeAfter = 0n;
    try {
      sizeAfter = context.allocatedBytes(unitPath);
    } catch {
      sizeAfter = 0n;
    }
    interpreted.freed = sizeBefore - sizeAfter;
  }
  return interpreted;
}

function sortLargestFirst(units) {
  return [...units].sort((left, right) => {
    if (left.size === right.size) return left.path.localeCompare(right.path);
    return left.size > right.size ? -1 : 1;
  });
}

async function processRoot(root, context, emit) {
  let failedMeasurement = false;
  let exitDirty = false;
  const mark = (observation) => {
    if (observation.kind === "undetermined" || observation.kind === "failed") exitDirty = true;
    if (observation.kind === "evicted") {
      emit(`evicted ${observation.path} freed=${observation.freed}`);
      return;
    }
    if (observation.kind === "failed") {
      emit(`failed ${observation.path}: ${observation.detail}`);
      return;
    }
    emitUnitOutcome(emit, observation);
  };

  let discovered;
  try {
    discovered = findUnits(root.path, context);
  } catch (error) {
    emit(`skipped ${root.path} undetermined: cannot list units: ${errorMessage(error)}`);
    return true;
  }

  const observations = [];
  for (const path of discovered.symlinkUnits) {
    observations.push({ path, skip: true, kind: "expected", reason: "symlink" });
  }
  for (const unitPath of discovered.units) {
    try {
      observations.push(observeUnit(unitPath, context));
    } catch (error) {
      observations.push({
        path: unitPath,
        skip: true,
        kind: "undetermined",
        detail: errorMessage(error),
      });
    }
  }

  const skipped = observations.filter((item) => item.skip);
  const evictable = observations.filter((item) => !item.skip);
  for (const item of skipped) mark(item);

  if (context.ownCheckout) {
    let total;
    try {
      total = context.allocatedBytes(root.path);
    } catch (error) {
      emit(`undetermined ${root.path}: cannot measure total: ${errorMessage(error)}`);
      return true;
    }
    if (total <= context.ownCapBytes) {
      for (const item of evictable) {
        mark({ ...item, skip: true, kind: "expected", reason: "under the cap" });
      }
    } else {
      let remainder;
      try {
        remainder = context.allocatedBytes(root.path, {
          skip: skipEvictableContent(evictable),
        });
      } catch (error) {
        emit(`undetermined ${root.path}: cannot measure remainder: ${errorMessage(error)}`);
        return true;
      }
      if (remainder > context.ownCapBytes) {
        for (const item of evictable) {
          mark({ ...item, skip: true, kind: "expected", reason: "unreachable cap" });
        }
      } else {
        for (const item of sortLargestFirst(evictable)) {
          let current;
          try {
            current = context.allocatedBytes(root.path);
          } catch (error) {
            emit(`undetermined ${root.path}: cannot measure total: ${errorMessage(error)}`);
            failedMeasurement = true;
            exitDirty = true;
            break;
          }
          if (current <= context.ownCapBytes) {
            mark({ ...item, skip: true, kind: "expected", reason: "under the cap" });
            continue;
          }
          const outcome = await evictObservedUnit(item, context);
          mark(outcome);
        }
      }
    }
  } else {
    for (const item of evictable) {
      const outcome = await evictObservedUnit(item, context);
      mark(outcome);
    }
  }

  if (failedMeasurement) return exitDirty;
  try {
    const after = context.measureRootAfterEviction(root.path);
    if (context.ownCheckout && after > context.ownCapBytes) {
      emit(`unreachable cap ${root.path} total=${after} cap=${context.ownCapBytes}`);
      exitDirty = true;
    }
    emit(`total ${root.path} bytes=${after}`);
  } catch (error) {
    emit(`undetermined ${root.path}: cannot measure total: ${errorMessage(error)}`);
    exitDirty = true;
  }
  return exitDirty;
}

export async function evictRustTargets({
  cwd = process.cwd(),
  ownCapBytes = OWN_CHECKOUT_CAP_BYTES,
  idleMaxAgeMs = IDLE_MAX_AGE_MS,
  nowMs = Date.now(),
  git = "git",
  flockBinary = "flock",
  procRoot = "/proc",
  uid = process.getuid?.(),
  spawn = spawnSync,
  lstat = lstatSync,
  readdir = readdirSync,
  realpath = realpathSync,
  readlink = readlinkSync,
  readdirProc,
  lstatProc,
  readlinkExe,
  execPath = process.execPath,
  env = process.env,
  log = (line) => console.log(line),
  beforeLock,
  afterLockModule,
  duringRemovalModule,
  runUnderLocks = defaultRunUnderLocks,
  checkLocks: checkLocksFn = checkLocks,
  allocatedBytes: allocatedBytesFn = (path, extra) =>
    allocatedBytes(path, { lstat, readdir, ...extra }),
  measureRootAfterEviction,
  listCheckouts: listCheckoutsFn = listCheckouts,
} = {}) {
  const lines = [];
  const emit = (line) => {
    lines.push(line);
    log(line);
  };
  let exitCode = 0;
  try {
    const listing = listCheckoutsFn(cwd, { spawn, git });
    if (listing.error) {
      emit(`worktree listing failed: ${listing.error}`);
      exitCode = 1;
    }
    const ownCanonical = canonicalOrSpelled(cwd, realpath);
    const seenCheckouts = new Set();
    for (const checkout of listing.checkouts) {
      const spelled = checkout.path;
      const missing = !lstatOrAbsent(spelled, lstat);
      if (missing || checkout.prunable) continue;
      let checkoutCanonical;
      try {
        checkoutCanonical = canonicalOrSpelled(spelled, realpath);
      } catch (error) {
        emit(`error ${spelled}: ${errorMessage(error)}`);
        exitCode = 1;
        continue;
      }
      if (seenCheckouts.has(checkoutCanonical)) continue;
      seenCheckouts.add(checkoutCanonical);
      const ownCheckout = checkoutCanonical === ownCanonical;
      let cacheCanonical;
      const cacheSpelled = join(checkoutCanonical, mutationCacheRelativePath);
      const cacheStat = lstatOrAbsent(cacheSpelled, lstat);
      if (cacheStat && !cacheStat.isSymbolicLink()) {
        cacheCanonical = canonicalOrSpelled(cacheSpelled, realpath);
      }
      for (const relativeRoot of TARGET_ROOT_RELATIVE_PATHS) {
        const spelledRoot = join(checkoutCanonical, relativeRoot);
        const rootStat = lstatOrAbsent(spelledRoot, lstat);
        if (!rootStat) continue;
        if (rootStat.isSymbolicLink()) {
          emit(`skipped ${spelledRoot} reason=symlink`);
          continue;
        }
        const rootPath = canonicalOrSpelled(spelledRoot, realpath);
        const context = {
          checkoutPath: checkoutCanonical,
          cacheCanonical,
          fenceRelative: fencePath,
          ownCheckout,
          ownCapBytes,
          idleMaxAgeMs,
          nowMs,
          flockBinary,
          procRoot,
          uid,
          spawn,
          lstat,
          readdir,
          realpath,
          readlink,
          readdirProc,
          lstatProc,
          readlinkExe,
          execPath,
          env,
          beforeLock,
          afterLockModule,
          duringRemovalModule,
          runUnderLocks,
          checkLocks: checkLocksFn,
          allocatedBytes: allocatedBytesFn,
          measureRootAfterEviction: measureRootAfterEviction ?? allocatedBytesFn,
        };
        const dirty = await processRoot({ path: rootPath }, context, emit);
        if (dirty) exitCode = 1;
      }
    }
  } catch (error) {
    const location = error.location ?? error.root ?? cwd;
    emit(`error ${location}: ${errorMessage(error)}`);
    exitCode = 1;
  }
  return { exitCode, lines };
}

export async function runRemoveUnitWorker(env = process.env) {
  const job = JSON.parse(env.RUST_TARGET_EVICTION_JOB);
  if (job.afterLockModule) {
    const hook = await import(pathToFileURL(job.afterLockModule).href);
    await hook.afterLock?.(job.unitPath, job);
  }
  const recheck = recheckUnitAfterLock(job.unitPath, job);
  if (!recheck.proceed) {
    console.log(JSON.stringify(recheck));
    return 0;
  }
  if (job.duringRemovalModule) {
    const hook = await import(pathToFileURL(job.duringRemovalModule).href);
    await hook.duringRemoval?.(job.unitPath, job.lockPaths, job);
  }
  const removal = removeUnitContents(job.unitPath);
  console.log(JSON.stringify({ proceed: true, removal }));
  return removal.ok ? 0 : REMOVER_FAILURE_EXIT_CODE;
}

async function main(argv = process.argv.slice(2)) {
  if (argv[0] === "--remove-unit") {
    // Exit the worker process so a re-check pin (or any other open handle)
    // cannot keep the nested flock held after the remover has decided.
    process.exit(await runRemoveUnitWorker());
  }
  const result = await evictRustTargets({ cwd: process.cwd() });
  return result.exitCode;
}

if (isEntrypoint(import.meta.url)) {
  try {
    process.exitCode = await main();
  } catch (error) {
    process.stderr.write(`rust-target-eviction failed: ${errorMessage(error)}\n`);
    process.exitCode = 1;
  }
}
