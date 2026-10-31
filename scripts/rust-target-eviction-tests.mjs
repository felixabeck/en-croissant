import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import {
  chmodSync,
  closeSync,
  copyFileSync,
  existsSync,
  ftruncateSync,
  linkSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readFileSync,
  readlinkSync,
  realpathSync,
  rmSync,
  symlinkSync,
  utimesSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, sep } from "node:path";
import test from "node:test";
import { fencePath, mutationCacheRelativePath } from "./run-backend-mutation.mjs";
import {
  CARGO_LOCK_FILES,
  FLOCK_HELD_EXIT_CODE,
  IDLE_MAX_AGE_MS,
  OWN_CHECKOUT_CAP_BYTES,
  REMOVER_FAILURE_EXIT_CODE,
  UNIT_MTIME_CHILDREN,
  allocatedBytes,
  checkLockFile,
  evictRustTargets,
} from "./rust-target-eviction.mjs";

const GIT_IDENTITY = Object.freeze([
  "-c",
  "user.name=ChessFable Fixture",
  "-c",
  "user.email=fixture@chessfable.test",
]);

function linuxFixtureSkip() {
  if (process.platform !== "linux") return "linux-only fixtures";
  if (!existsSync("/proc")) return "/proc is absent";
  const flock = spawnSync("flock", ["-V"], { encoding: "utf8" });
  if (flock.error || (flock.status !== 0 && flock.status !== null)) return "flock is absent";
  const dir = mkdtempSync(join(tmpdir(), "evict-exec-"));
  const probe = join(dir, "probe");
  writeFileSync(probe, "#!/bin/sh\nexit 0\n", { mode: 0o755 });
  const result = spawnSync(probe, { encoding: "utf8" });
  rmSync(dir, { recursive: true, force: true });
  if (result.error || result.status !== 0) return "os.tmpdir() is noexec";
  return undefined;
}

const linuxSkip = linuxFixtureSkip();
const skipAsRoot =
  process.getuid?.() === 0 ? "unremovable-entry fixture is skipped as root (CR-1)" : undefined;

function linuxTest(name, fn) {
  test(name, linuxSkip ? { skip: linuxSkip } : {}, fn);
}

function forceRemoveTree(root) {
  spawnSync("chmod", ["-R", "u+rwx", root], { stdio: "ignore" });
  rmSync(root, { recursive: true, force: true });
}

function git(cwd, args) {
  const result = spawnSync("git", [...GIT_IDENTITY, ...args], { cwd, encoding: "utf8" });
  assert.equal(result.status, 0, `${args.join(" ")}\n${result.stderr}`);
  return result;
}

function waitUntil(predicate, timeoutMs = 3_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate()) return;
    const spin = Date.now() + 10;
    while (Date.now() < spin) {
      // Short spin so flock and /proc/exe probes become visible.
    }
  }
  assert.fail(`timed out after ${timeoutMs} ms`);
}

function stamp(path, mtimeMs) {
  const time = new Date(mtimeMs);
  utimesSync(path, time, time);
}

function stampUnit(unit, mtimeMs) {
  stamp(unit, mtimeMs);
  for (const child of UNIT_MTIME_CHILDREN) {
    const path = join(unit, child);
    if (existsSync(path)) stamp(path, mtimeMs);
  }
}

function writeLocks(unit) {
  for (const name of CARGO_LOCK_FILES) writeFileSync(join(unit, name), "");
}

function makeUnit(targetRoot, relativeUnit, { files, mtimeMs } = {}) {
  const unit = join(targetRoot, relativeUnit);
  mkdirSync(unit, { recursive: true });
  writeLocks(unit);
  for (const [relativePath, contents] of Object.entries(
    files ?? { "deps/artifact": "artifact\n" },
  )) {
    const path = join(unit, relativePath);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, contents);
  }
  if (mtimeMs !== undefined) stampUnit(unit, mtimeMs);
  return unit;
}

function lockInodes(unit) {
  return Object.fromEntries(
    CARGO_LOCK_FILES.map((name) => {
      const stat = lstatSync(join(unit, name), { bigint: true });
      return [name, `${stat.dev}:${stat.ino}`];
    }),
  );
}

function artifactIntact(unit) {
  return existsSync(join(unit, "deps", "artifact"));
}

function twoCheckouts(t) {
  const parent = mkdtempSync(join(tmpdir(), "evict-wt-"));
  t.after(() => forceRemoveTree(parent));
  const main = join(parent, "main");
  const sibling = join(parent, "sibling");
  mkdirSync(main);
  git(main, ["init", "--quiet"]);
  writeFileSync(join(main, "README"), "fixture\n");
  git(main, ["add", "README"]);
  git(main, ["commit", "-q", "-m", "init"]);
  git(main, ["worktree", "add", "--quiet", sibling]);
  mkdirSync(join(main, "src-tauri"), { recursive: true });
  mkdirSync(join(sibling, "src-tauri"), { recursive: true });
  return { parent, main, sibling };
}

async function runEvict(cwd, options = {}) {
  const lines = [];
  const result = await evictRustTargets({
    cwd,
    log: (line) => lines.push(line),
    ...options,
  });
  return { ...result, lines };
}

function holdLock(lockPath, t) {
  const child = spawn("flock", ["-n", "-E", "75", lockPath, "sleep", "60"], { stdio: "ignore" });
  t.after(() => {
    try {
      child.kill("SIGKILL");
    } catch {
      // Already gone.
    }
  });
  child.unref();
  waitUntil(() => spawnSync("flock", ["-n", "-E", "75", lockPath, "true"]).status === 75);
  return child;
}

function startCopiedSleep(unit, t) {
  const exe = join(unit, "deps", "sleeping-bin");
  mkdirSync(join(unit, "deps"), { recursive: true });
  const source = existsSync("/usr/bin/sleep") ? "/usr/bin/sleep" : "/bin/sleep";
  copyFileSync(source, exe);
  chmodSync(exe, 0o755);
  const child = spawn(exe, ["60"], { stdio: "ignore" });
  t.after(() => {
    try {
      child.kill("SIGKILL");
    } catch {
      // Already gone.
    }
  });
  child.unref();
  waitUntil(() => {
    try {
      const target = readlinkSync(`/proc/${child.pid}/exe`);
      return target.includes("sleeping-bin");
    } catch {
      return false;
    }
  });
  return { child, exe };
}

function writeHook(dir, name, source) {
  const path = join(dir, name);
  writeFileSync(path, source);
  return path;
}

function fillAllocated(unit, minimum) {
  const payload = join(unit, "deps", "blob");
  mkdirSync(join(unit, "deps"), { recursive: true });
  let size = 4096;
  while (allocatedBytes(unit) < minimum) {
    writeFileSync(payload, Buffer.alloc(size, 1));
    size *= 2;
    if (size > 32 * 1024 * 1024) break;
  }
  return allocatedBytes(unit);
}

function makeSparse(path, apparentSize) {
  const fd = openSync(path, "w");
  ftruncateSync(fd, apparentSize);
  closeSync(fd);
  const stat = lstatSync(path, { bigint: true });
  assert.ok(
    stat.blocks * 512n < stat.size,
    "sparse fixture allocated bytes must be below apparent size (CR-6)",
  );
  return stat;
}

function injectedError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

test("shipped cap and idle constants keep their measurement basis", () => {
  // Goes red against a stub that ships a different cap or idle window.
  assert.equal(OWN_CHECKOUT_CAP_BYTES, 40n * 1024n ** 3n);
  assert.equal(IDLE_MAX_AGE_MS, 7 * 24 * 60 * 60 * 1000);
  assert.equal(FLOCK_HELD_EXIT_CODE, 75);
  assert.equal(REMOVER_FAILURE_EXIT_CODE, 2);
  assert.notEqual(REMOVER_FAILURE_EXIT_CODE, FLOCK_HELD_EXIT_CODE);
});

test("exported mutation fence and cache constants stay aligned (CR-4)", () => {
  assert.equal(fencePath, "mutants.out/backend/.mutation-in-progress");
  assert.equal(mutationCacheRelativePath, "mutants.out/backend/cargo-target");
});

linuxTest("discovery walks real git worktrees and ignores missing or prunable paths", async (t) => {
  // Goes red against a stub that evicts only the own checkout or throws on a missing listing.
  const { parent, main, sibling } = twoCheckouts(t);
  const now = 1_700_000_000_000;
  const idleMaxAgeMs = 10_000;
  const stale = now - idleMaxAgeMs - 5_000;
  const ownTarget = join(main, "src-tauri", "target");
  const siblingTarget = join(sibling, "src-tauri", "target");
  const ownUnit = makeUnit(ownTarget, "debug", { mtimeMs: stale });
  const siblingUnit = makeUnit(siblingTarget, "debug", { mtimeMs: stale });
  const vanished = join(parent, "vanished");
  git(main, ["worktree", "add", "--quiet", vanished]);
  rmSync(vanished, { recursive: true, force: true });
  const result = await runEvict(main, {
    nowMs: now,
    idleMaxAgeMs,
    ownCapBytes: OWN_CHECKOUT_CAP_BYTES,
  });
  assert.equal(result.exitCode, 0, result.lines.join("\n"));
  assert.ok(artifactIntact(ownUnit), "own checkout is not idle-evicted");
  assert.equal(artifactIntact(siblingUnit), false);
  assert.ok(result.lines.some((line) => line.startsWith(`evicted ${siblingUnit} `)));
});

linuxTest("idle rule keeps a unit when any one mtime signal is fresh", async (t) => {
  // Goes red against a mutant that reads only the unit directory mtime.
  const { main, sibling } = twoCheckouts(t);
  const now = 1_700_000_000_000;
  const idleMaxAgeMs = 10_000;
  const stale = now - idleMaxAgeMs - 5_000;
  const fresh = now - 1_000;
  const justUnder = now - idleMaxAgeMs + 1_000;
  const justOver = now - idleMaxAgeMs - 1_000;
  const signals = ["unit", ...UNIT_MTIME_CHILDREN];
  for (const signal of signals) {
    const target = join(sibling, "src-tauri", "target");
    rmSync(target, { recursive: true, force: true });
    const files = {
      "deps/artifact": "artifact\n",
      ".fingerprint/x": "fp\n",
      "build/x": "build\n",
      "incremental/x": "inc\n",
    };
    const unit = makeUnit(target, "debug", { files, mtimeMs: stale });
    if (signal === "unit") stamp(unit, fresh);
    else stamp(join(unit, signal), fresh);
    const result = await runEvict(main, { nowMs: now, idleMaxAgeMs });
    assert.equal(result.exitCode, 0, `${signal}\n${result.lines.join("\n")}`);
    assert.ok(artifactIntact(unit), `${signal} fresh must keep the unit`);
    assert.ok(result.lines.some((line) => line.includes(`skipped ${unit} reason=not idle`)));
  }

  const justUnderUnit = makeUnit(join(sibling, "src-tauri", "target"), "release", {
    mtimeMs: justUnder,
  });
  const justUnderResult = await runEvict(main, { nowMs: now, idleMaxAgeMs });
  assert.ok(artifactIntact(justUnderUnit));
  assert.ok(justUnderResult.lines.some((line) => line.includes("reason=not idle")));

  const justOverUnit = makeUnit(join(sibling, "src-tauri", "target"), "llvm-cov-target/debug", {
    mtimeMs: justOver,
  });
  const justOverResult = await runEvict(main, { nowMs: now, idleMaxAgeMs });
  assert.equal(artifactIntact(justOverUnit), false);
  assert.ok(justOverResult.lines.some((line) => line.startsWith(`evicted ${justOverUnit} `)));
});

linuxTest("idle rule handles a unit without incremental and without build", async (t) => {
  // Goes red against a stub that treats an absent optional child as undetermined.
  const { main, sibling } = twoCheckouts(t);
  const now = 1_700_000_000_000;
  const idleMaxAgeMs = 10_000;
  const stale = now - idleMaxAgeMs - 5_000;
  const fresh = now - 1_000;
  for (const [missing, files] of [
    ["incremental", { "deps/artifact": "artifact\n", "build/x": "b\n", ".fingerprint/x": "f\n" }],
    ["build", { "deps/artifact": "artifact\n", "incremental/x": "i\n", ".fingerprint/x": "f\n" }],
  ]) {
    const target = join(sibling, "src-tauri", "target");
    rmSync(target, { recursive: true, force: true });
    const staleUnit = makeUnit(target, "debug", { files, mtimeMs: stale });
    const staleResult = await runEvict(main, { nowMs: now, idleMaxAgeMs });
    assert.equal(staleResult.exitCode, 0, missing);
    assert.equal(artifactIntact(staleUnit), false, `${missing} absent still evicts when backdated`);

    rmSync(target, { recursive: true, force: true });
    const freshUnit = makeUnit(target, "debug", { files, mtimeMs: fresh });
    const freshResult = await runEvict(main, { nowMs: now, idleMaxAgeMs });
    assert.equal(freshResult.exitCode, 0, missing);
    assert.ok(artifactIntact(freshUnit), `${missing} absent keeps a fresh unit`);
  }
});

linuxTest(
  "in-use executable keeps a unit under both rules, including prefix and symlink ancestors",
  async (t) => {
    // Goes red against a stub that matches path prefixes as strings or skips the executable test.
    const { parent, main, sibling } = twoCheckouts(t);
    const now = 1_700_000_000_000;
    const idleMaxAgeMs = 10_000;
    const stale = now - idleMaxAgeMs - 5_000;
    const siblingTarget = join(sibling, "src-tauri", "target");
    const unit = makeUnit(siblingTarget, "debug", { mtimeMs: stale });
    startCopiedSleep(unit, t);
    const inUse = await runEvict(main, { nowMs: now, idleMaxAgeMs });
    assert.equal(inUse.exitCode, 0, inUse.lines.join("\n"));
    assert.ok(artifactIntact(unit));
    assert.ok(
      inUse.lines.some((line) => line.includes(`skipped ${unit} reason=in use (executable)`)),
    );

    const outside = join(parent, "outside-bin");
    mkdirSync(outside);
    const outsideExe = join(outside, "sleeping-bin");
    copyFileSync(existsSync("/usr/bin/sleep") ? "/usr/bin/sleep" : "/bin/sleep", outsideExe);
    chmodSync(outsideExe, 0o755);
    const outsideChild = spawn(outsideExe, ["60"], { stdio: "ignore" });
    t.after(() => outsideChild.kill("SIGKILL"));
    outsideChild.unref();
    waitUntil(() => {
      try {
        return readlinkSync(`/proc/${outsideChild.pid}/exe`).includes("sleeping-bin");
      } catch {
        return false;
      }
    });
    const other = makeUnit(siblingTarget, "release", { mtimeMs: stale });
    const outsideResult = await runEvict(main, { nowMs: now, idleMaxAgeMs });
    assert.equal(outsideResult.exitCode, 0, outsideResult.lines.join("\n"));
    assert.equal(artifactIntact(other), false);

    const prefixUnit = makeUnit(siblingTarget, "debug2", { mtimeMs: stale });
    startCopiedSleep(prefixUnit, t);
    const siblingName = makeUnit(siblingTarget, "debug2-extra", { mtimeMs: stale });
    // The running exe lives in debug2; debug2-extra only shares a name prefix.
    const prefixResult = await runEvict(main, { nowMs: now, idleMaxAgeMs });
    assert.ok(artifactIntact(prefixUnit));
    assert.equal(artifactIntact(siblingName), false, prefixResult.lines.join("\n"));

    const linkedParent = join(parent, "link-to-main");
    symlinkSync(main, linkedParent);
    const ownTarget = join(main, "src-tauri", "target");
    const ownUnit = makeUnit(ownTarget, "debug", { mtimeMs: stale });
    startCopiedSleep(ownUnit, t);
    const viaLink = await runEvict(linkedParent, {
      nowMs: now,
      idleMaxAgeMs,
      ownCapBytes: 1n,
    });
    assert.ok(artifactIntact(ownUnit), viaLink.lines.join("\n"));
    assert.ok(viaLink.lines.some((line) => line.includes("in use (executable)")));
  },
);

linuxTest("both lock and executable report the lock reason (CR-4)", async (t) => {
  const { main, sibling } = twoCheckouts(t);
  const now = 1_700_000_000_000;
  const idleMaxAgeMs = 10_000;
  const stale = now - idleMaxAgeMs - 5_000;
  const unit = makeUnit(join(sibling, "src-tauri", "target"), "debug", { mtimeMs: stale });
  holdLock(join(unit, ".cargo-lock"), t);
  startCopiedSleep(unit, t);
  const result = await runEvict(main, { nowMs: now, idleMaxAgeMs });
  assert.ok(artifactIntact(unit));
  assert.ok(
    result.lines.some((line) => line.includes(`skipped ${unit} reason=in use (lock held)`)),
  );
  assert.ok(!result.lines.some((line) => line.includes("in use (executable)")));
});

linuxTest("deleted exe suffix is compared without the suffix (CR-2)", async (t) => {
  const { main, sibling } = twoCheckouts(t);
  const now = 1_700_000_000_000;
  const idleMaxAgeMs = 10_000;
  const stale = now - idleMaxAgeMs - 5_000;
  const unit = makeUnit(join(sibling, "src-tauri", "target"), "debug", { mtimeMs: stale });
  const canonical = realpathSync(unit);
  const result = await runEvict(main, {
    nowMs: now,
    idleMaxAgeMs,
    readdirProc: () => ["424242"],
    lstatProc: (path) => {
      if (path.endsWith(`${sep}424242`)) return { uid: BigInt(process.getuid()) };
      return lstatSync(path, { bigint: true });
    },
    readlinkExe: (path) => {
      if (path.endsWith(`${sep}exe`)) return `${canonical}/deps/artifact (deleted)`;
      return readlinkSync(path);
    },
  });
  assert.ok(artifactIntact(unit));
  assert.ok(result.lines.some((line) => line.includes("in use (executable)")));
});

linuxTest(
  "size cap evicts largest-first, counts hard links once, and leaves non-unit content",
  async (t) => {
    // Goes red against a stub that idle-evicts the own checkout or double-counts hard links.
    const { main, sibling } = twoCheckouts(t);
    const root = join(main, "src-tauri", "target");
    const large = makeUnit(root, "debug");
    const medium = makeUnit(root, "release");
    const small = makeUnit(root, "llvm-cov-target/debug");
    fillAllocated(large, 200_000n);
    fillAllocated(medium, 80_000n);
    fillAllocated(small, 20_000n);
    mkdirSync(join(root, "doc"), { recursive: true });
    writeFileSync(join(root, "doc", "index.html"), "docs\n");
    writeFileSync(join(root, "CACHEDIR.TAG"), "tag\n");
    const shared = join(root, "shared-blob");
    writeFileSync(shared, Buffer.alloc(64_000, 2));
    linkSync(shared, join(root, "shared-blob-link"));
    const total = allocatedBytes(root);
    const cap = total - allocatedBytes(large) + 16_384n;
    const result = await runEvict(main, { ownCapBytes: cap });
    assert.equal(artifactIntact(large), false, result.lines.join("\n"));
    assert.ok(artifactIntact(medium));
    assert.ok(artifactIntact(small));
    assert.ok(existsSync(join(root, "doc", "index.html")));
    assert.ok(existsSync(join(root, "CACHEDIR.TAG")));
    assert.ok(result.lines.some((line) => line.startsWith(`total ${realpathSync(root)} bytes=`)));

    const foreign = makeUnit(join(sibling, "src-tauri", "target"), "debug");
    fillAllocated(foreign, 300_000n);
    stampUnit(foreign, Date.now());
    const foreignResult = await runEvict(main, {
      ownCapBytes: cap,
      nowMs: Date.now(),
      idleMaxAgeMs: 10_000,
    });
    assert.ok(artifactIntact(foreign), "a recent oversize foreign unit is kept");
    assert.ok(
      foreignResult.lines.some((line) => line.includes(`skipped ${foreign} reason=not idle`)),
    );
  },
);

linuxTest("sparse allocated size does not trip the cap (CR-6)", async (t) => {
  const { main } = twoCheckouts(t);
  const root = join(main, "src-tauri", "target");
  const unit = makeUnit(root, "debug");
  makeSparse(join(unit, "deps", "artifact"), 50 * 1024 * 1024);
  const cap = allocatedBytes(root) + 4096n;
  const result = await runEvict(main, { ownCapBytes: cap });
  assert.equal(result.exitCode, 0, result.lines.join("\n"));
  assert.ok(existsSync(join(unit, "deps", "artifact")));
  assert.ok(result.lines.some((line) => line.includes("reason=under the cap")));
});

linuxTest(
  "unreachable cap evicts nothing, including fenced and undetermined units (CR-6)",
  async (t) => {
    const { main } = twoCheckouts(t);
    const root = join(main, "src-tauri", "target");
    const evictable = makeUnit(root, "debug");
    const undetermined = makeUnit(root, "release");
    mkdirSync(join(root, "doc"), { recursive: true });
    writeFileSync(join(root, "doc", "huge"), Buffer.alloc(200_000, 3));
    const cacheRoot = join(main, mutationCacheRelativePath);
    const fenced = makeUnit(cacheRoot, "debug");
    mkdirSync(dirname(join(main, fencePath)), { recursive: true });
    writeFileSync(join(main, fencePath), "fence\n");
    const cap = 4096n;
    const result = await runEvict(main, {
      ownCapBytes: cap,
      checkLocks(lockPaths, options) {
        if (lockPaths.some((path) => path.includes(`${sep}release${sep}`))) {
          return { undetermined: "injected flock 42" };
        }
        for (const lockPath of lockPaths) {
          const status = checkLockFile(lockPath, options);
          if (status.undetermined || status.held) return status;
        }
        return { held: false };
      },
    });
    assert.equal(result.exitCode, 1, result.lines.join("\n"));
    assert.ok(artifactIntact(evictable));
    assert.ok(artifactIntact(undetermined));
    assert.ok(artifactIntact(fenced));
    assert.ok(existsSync(join(root, "doc", "huge")));
    assert.ok(
      result.lines.some((line) => line.startsWith(`unreachable cap ${realpathSync(root)} `)),
    );
    assert.ok(result.lines.some((line) => line.includes(`skipped ${undetermined} undetermined:`)));
    assert.ok(
      result.lines.some((line) => line.includes(`skipped ${fenced} reason=mutation fence`)),
    );
  },
);

linuxTest("an in-use unit alone can keep the root over the cap", async (t) => {
  const { main } = twoCheckouts(t);
  const root = join(main, "src-tauri", "target");
  const pinned = makeUnit(root, "debug");
  fillAllocated(pinned, 100_000n);
  holdLock(join(pinned, ".cargo-lock"), t);
  const extra = makeUnit(root, "release");
  const cap = 4096n;
  const result = await runEvict(main, { ownCapBytes: cap });
  assert.equal(result.exitCode, 1);
  assert.ok(artifactIntact(pinned));
  assert.ok(artifactIntact(extra));
  assert.ok(result.lines.some((line) => line.includes("unreachable cap")));
});

linuxTest("a re-check in-use skip continues with the next-largest unit", async (t) => {
  const { main, parent } = twoCheckouts(t);
  const root = join(main, "src-tauri", "target");
  const largest = makeUnit(root, "debug");
  const next = makeUnit(root, "release");
  fillAllocated(largest, 150_000n);
  fillAllocated(next, 80_000n);
  const cap = 4096n;
  const pidFile = join(parent, "pinned.pid");
  const hook = writeHook(
    parent,
    "after-lock.mjs",
    `import { spawn } from "node:child_process";
import { chmodSync, copyFileSync, existsSync, mkdirSync, readlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
export function afterLock(unitPath) {
  if (unitPath !== process.env.EVICT_TEST_PIN) return;
  const exe = join(unitPath, "deps", "sleeping-bin");
  mkdirSync(join(unitPath, "deps"), { recursive: true });
  const source = existsSync("/usr/bin/sleep") ? "/usr/bin/sleep" : "/bin/sleep";
  copyFileSync(source, exe);
  chmodSync(exe, 0o755);
  const child = spawn(exe, ["60"], { stdio: "ignore" });
  child.unref();
  writeFileSync(process.env.EVICT_TEST_PID, String(child.pid));
  const deadline = Date.now() + 3000;
  while (Date.now() < deadline) {
    try {
      if (readlinkSync("/proc/" + child.pid + "/exe").includes("sleeping-bin")) return;
    } catch {
      // The process is not yet visible in /proc.
    }
  }
  throw new Error("pin process executable is not visible");
}
`,
  );
  t.after(() => {
    try {
      const pid = Number(readFileSync(pidFile, "utf8"));
      if (pid) process.kill(pid, "SIGKILL");
    } catch {
      // The pin process never started or already exited.
    }
  });
  const result = await runEvict(main, {
    ownCapBytes: cap,
    afterLockModule: hook,
    env: { ...process.env, EVICT_TEST_PIN: largest, EVICT_TEST_PID: pidFile },
  });
  assert.equal(result.exitCode, 1, result.lines.join("\n"));
  assert.ok(artifactIntact(largest));
  assert.equal(artifactIntact(next), false);
  assert.ok(result.lines.some((line) => line.includes("unreachable cap")));
});

linuxTest("own checkout is never idle-evicted", async (t) => {
  const { main } = twoCheckouts(t);
  const unit = makeUnit(join(main, "src-tauri", "target"), "debug", {
    mtimeMs: 1_000_000,
  });
  const result = await runEvict(main, { nowMs: Date.now(), idleMaxAgeMs: 10_000 });
  assert.ok(artifactIntact(unit));
  assert.ok(result.lines.some((line) => line.includes("reason=under the cap")));
});

linuxTest("each lock file, fence, in-use, and symlink skip leaves contents intact", async (t) => {
  const { parent, main, sibling } = twoCheckouts(t);
  const now = 1_700_000_000_000;
  const idleMaxAgeMs = 10_000;
  const stale = now - idleMaxAgeMs - 5_000;
  for (const lockName of CARGO_LOCK_FILES) {
    const target = join(sibling, "src-tauri", "target");
    rmSync(target, { recursive: true, force: true });
    const unit = makeUnit(target, "debug", { mtimeMs: stale });
    holdLock(join(unit, lockName), t);
    const result = await runEvict(main, { nowMs: now, idleMaxAgeMs });
    assert.ok(artifactIntact(unit), lockName);
    assert.ok(
      result.lines.some((line) => line.includes(`skipped ${unit} reason=in use (lock held)`)),
      lockName,
    );
  }

  const cache = join(sibling, mutationCacheRelativePath);
  const fenced = makeUnit(cache, "debug", { mtimeMs: stale });
  mkdirSync(dirname(join(sibling, fencePath)), { recursive: true });
  writeFileSync(join(sibling, fencePath), "fence\n");
  const fenceResult = await runEvict(main, { nowMs: now, idleMaxAgeMs });
  assert.ok(artifactIntact(fenced));
  assert.ok(fenceResult.lines.some((line) => line.includes("reason=mutation fence")));

  const external = join(parent, "external-target");
  mkdirSync(external, { recursive: true });
  const hiddenUnit = makeUnit(external, "debug", { mtimeMs: stale });
  mkdirSync(join(sibling, "src-tauri"), { recursive: true });
  rmSync(join(sibling, "src-tauri", "target"), { recursive: true, force: true });
  symlinkSync(external, join(sibling, "src-tauri", "target"));
  const rootResult = await runEvict(main, { nowMs: now, idleMaxAgeMs });
  assert.ok(artifactIntact(hiddenUnit));
  assert.ok(rootResult.lines.some((line) => line.includes("reason=symlink")));

  const siblingTarget = join(sibling, "src-tauri", "target");
  rmSync(siblingTarget, { recursive: true, force: true });
  mkdirSync(siblingTarget, { recursive: true });
  const realUnit = join(parent, "real-unit");
  makeUnit(dirname(realUnit), "real-unit", { mtimeMs: stale });
  symlinkSync(realUnit, join(siblingTarget, "debug"));
  const unitResult = await runEvict(main, { nowMs: now, idleMaxAgeMs });
  assert.ok(existsSync(join(realUnit, "deps", "artifact")));
  assert.ok(unitResult.lines.some((line) => line.includes("reason=symlink")));
});

linuxTest("locks stay held during removal and keep their inodes (CR-2, CR-3)", async (t) => {
  const { parent, main, sibling } = twoCheckouts(t);
  const now = 1_700_000_000_000;
  const idleMaxAgeMs = 10_000;
  const stale = now - idleMaxAgeMs - 5_000;
  const unit = makeUnit(join(sibling, "src-tauri", "target"), "debug", { mtimeMs: stale });
  const before = lockInodes(unit);
  const probe = join(parent, "lock-probe.json");
  const hook = writeHook(
    parent,
    "during-removal.mjs",
    `import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
export function duringRemoval(_unitPath, lockPaths) {
  const results = lockPaths.map((lock) => ({
    lock,
    status: spawnSync("flock", ["-n", "-E", "75", lock, "true"]).status,
  }));
  writeFileSync(process.env.EVICT_LOCK_PROBE, JSON.stringify(results));
}
`,
  );
  const result = await runEvict(main, {
    nowMs: now,
    idleMaxAgeMs,
    duringRemovalModule: hook,
    env: { ...process.env, EVICT_LOCK_PROBE: probe },
  });
  assert.equal(result.exitCode, 0, result.lines.join("\n"));
  assert.equal(artifactIntact(unit), false);
  const probed = JSON.parse(readFileSync(probe, "utf8"));
  assert.equal(probed.length, CARGO_LOCK_FILES.length);
  for (const entry of probed) assert.equal(entry.status, 75);
  assert.deepEqual(lockInodes(unit), before);
});

linuxTest("re-check seams keep a refreshed, in-use, or newly fenced unit (CR-4)", async (t) => {
  const { parent, main, sibling } = twoCheckouts(t);
  const now = 1_700_000_000_000;
  const idleMaxAgeMs = 10_000;
  const stale = now - idleMaxAgeMs - 5_000;
  const target = join(sibling, "src-tauri", "target");
  const unit = makeUnit(target, "debug", { mtimeMs: stale });
  const beforeLock = await runEvict(main, {
    nowMs: now,
    idleMaxAgeMs,
    async beforeLock(unitPath) {
      if (unitPath === unit) stampUnit(unitPath, now);
    },
  });
  assert.ok(artifactIntact(unit), beforeLock.lines.join("\n"));
  assert.ok(beforeLock.lines.some((line) => line.includes("reason=not idle")));

  stampUnit(unit, stale);
  const afterLockHook = writeHook(
    parent,
    "after-lock-refresh.mjs",
    `import { utimesSync } from "node:fs";
export function afterLock(unitPath, job) {
  const time = new Date(job.nowMs);
  utimesSync(unitPath, time, time);
}
`,
  );
  const afterLock = await runEvict(main, {
    nowMs: now,
    idleMaxAgeMs,
    afterLockModule: afterLockHook,
  });
  assert.ok(artifactIntact(unit), afterLock.lines.join("\n"));

  stampUnit(unit, stale);
  const fenceHook = writeHook(
    parent,
    "after-lock-fence.mjs",
    `import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
export function afterLock(_unitPath, job) {
  const path = join(job.checkoutPath, job.fenceRelative);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, "fence\\n");
}
`,
  );
  const cacheUnit = makeUnit(join(sibling, mutationCacheRelativePath), "debug", { mtimeMs: stale });
  const fenced = await runEvict(main, {
    nowMs: now,
    idleMaxAgeMs,
    afterLockModule: fenceHook,
  });
  assert.ok(artifactIntact(cacheUnit), fenced.lines.join("\n"));
});

test(
  "fingerprint-first stop rule leaves remaining entries (CR-1)",
  skipAsRoot || linuxSkip ? { skip: skipAsRoot || linuxSkip } : {},
  async (t) => {
    const { main, sibling } = twoCheckouts(t);
    const now = 1_700_000_000_000;
    const idleMaxAgeMs = 10_000;
    const stale = now - idleMaxAgeMs - 5_000;
    const unit = makeUnit(join(sibling, "src-tauri", "target"), "debug", {
      files: {
        "deps/artifact": "artifact\n",
        ".fingerprint/x": "fp\n",
        "build/x": "build\n",
      },
      mtimeMs: stale,
    });
    chmodSync(join(unit, ".fingerprint"), 0o555);
    t.after(() => {
      try {
        chmodSync(join(unit, ".fingerprint"), 0o755);
      } catch {
        // Restored or already removed.
      }
    });
    const result = await runEvict(main, { nowMs: now, idleMaxAgeMs });
    assert.equal(result.exitCode, 1);
    assert.ok(existsSync(join(unit, ".fingerprint", "x")));
    assert.ok(existsSync(join(unit, "deps", "artifact")));
    assert.ok(existsSync(join(unit, "build", "x")));
    assert.ok(result.lines.some((line) => line.startsWith(`failed ${unit}:`)));
    assert.ok(!result.lines.some((line) => line.includes("contents intact")));
  },
);

test(
  "second-pass unremovable entry leaves fingerprint gone and fails the unit (CR-1)",
  skipAsRoot || linuxSkip ? { skip: skipAsRoot || linuxSkip } : {},
  async (t) => {
    const { main, sibling } = twoCheckouts(t);
    const now = 1_700_000_000_000;
    const idleMaxAgeMs = 10_000;
    const stale = now - idleMaxAgeMs - 5_000;
    const first = makeUnit(join(sibling, "src-tauri", "target"), "debug", {
      files: { "deps/artifact": "artifact\n", ".fingerprint/x": "fp\n" },
      mtimeMs: stale,
    });
    const second = makeUnit(join(sibling, "src-tauri", "target"), "release", { mtimeMs: stale });
    chmodSync(join(first, "deps"), 0o555);
    t.after(() => {
      try {
        chmodSync(join(first, "deps"), 0o755);
      } catch {
        // Restored or already removed.
      }
    });
    const result = await runEvict(main, { nowMs: now, idleMaxAgeMs });
    assert.equal(result.exitCode, 1, result.lines.join("\n"));
    assert.equal(existsSync(join(first, ".fingerprint")), false);
    assert.ok(existsSync(join(first, "deps", "artifact")));
    assert.equal(artifactIntact(second), false);
    assert.ok(result.lines.some((line) => line.startsWith(`failed ${first}:`)));
    assert.ok(result.lines.some((line) => line.startsWith(`evicted ${second} `)));
    assert.ok(result.lines.some((line) => line.includes("partial removal")));
  },
);

linuxTest("an inner symlink is removed as a link and the external tree stays", async (t) => {
  const { parent, main, sibling } = twoCheckouts(t);
  const now = 1_700_000_000_000;
  const idleMaxAgeMs = 10_000;
  const stale = now - idleMaxAgeMs - 5_000;
  const external = join(parent, "external-tree");
  mkdirSync(external);
  writeFileSync(join(external, "keep"), "keep\n");
  const unit = makeUnit(join(sibling, "src-tauri", "target"), "debug", { mtimeMs: stale });
  symlinkSync(external, join(unit, "out-link"));
  stampUnit(unit, stale);
  const result = await runEvict(main, { nowMs: now, idleMaxAgeMs });
  assert.equal(result.exitCode, 0, result.lines.join("\n"));
  assert.equal(existsSync(join(unit, "out-link")), false);
  assert.equal(readFileSync(join(external, "keep"), "utf8"), "keep\n");
});

linuxTest("fail-direction skips keep contents and exit 1", async (t) => {
  const { main, sibling } = twoCheckouts(t);
  const now = 1_700_000_000_000;
  const idleMaxAgeMs = 10_000;
  const stale = now - idleMaxAgeMs - 5_000;
  const resetUnit = () => {
    const target = join(sibling, "src-tauri", "target");
    rmSync(target, { recursive: true, force: true });
    rmSync(join(sibling, "mutants.out"), { recursive: true, force: true });
    return makeUnit(target, "debug", { mtimeMs: stale });
  };

  let unit = resetUnit();
  const flockExit = await runEvict(main, {
    nowMs: now,
    idleMaxAgeMs,
    checkLocks: () => ({ undetermined: "flock exit 42" }),
  });
  assert.equal(flockExit.exitCode, 1);
  assert.ok(artifactIntact(unit));

  unit = resetUnit();
  const sizeWalk = await runEvict(main, {
    nowMs: now,
    idleMaxAgeMs,
    allocatedBytes() {
      throw injectedError("EIO", "injected size walk");
    },
  });
  assert.equal(sizeWalk.exitCode, 1);
  assert.ok(artifactIntact(unit));

  unit = resetUnit();
  const cacheUnit = makeUnit(join(sibling, mutationCacheRelativePath), "debug", { mtimeMs: stale });
  const fenceError = await runEvict(main, {
    nowMs: now,
    idleMaxAgeMs,
    lstat(path, options) {
      if (path.endsWith(fencePath)) throw injectedError("EIO", "injected fence");
      return lstatSync(path, options);
    },
  });
  assert.equal(fenceError.exitCode, 1);
  assert.ok(artifactIntact(cacheUnit));

  unit = resetUnit();
  const procList = await runEvict(main, {
    nowMs: now,
    idleMaxAgeMs,
    procRoot: join(sibling, "missing-proc"),
  });
  assert.equal(procList.exitCode, 1);
  assert.ok(artifactIntact(unit));

  unit = resetUnit();
  const missingFlock = await runEvict(main, {
    nowMs: now,
    idleMaxAgeMs,
    flockBinary: join(sibling, "no-such-flock"),
  });
  assert.equal(missingFlock.exitCode, 1);
  assert.ok(artifactIntact(unit));

  unit = resetUnit();
  const statAccess = await runEvict(main, {
    nowMs: now,
    idleMaxAgeMs,
    readdirProc: () => ["424242"],
    lstatProc: (path, options) => {
      if (path.endsWith(`${sep}424242`)) throw injectedError("EACCES", "injected stat");
      return lstatSync(path, options);
    },
  });
  assert.equal(statAccess.exitCode, 1);
  assert.ok(artifactIntact(unit));

  unit = resetUnit();
  const listing = await runEvict(main, {
    nowMs: now,
    idleMaxAgeMs,
    listCheckouts: (cwd) => ({ error: "injected listing", checkouts: [cwd] }),
  });
  assert.equal(listing.exitCode, 1);
  assert.ok(listing.lines.some((line) => line.startsWith("worktree listing failed:")));
  assert.ok(artifactIntact(unit));
});

linuxTest("ENOENT, ESRCH and exe EACCES still evict an otherwise idle unit", async (t) => {
  const { main, sibling } = twoCheckouts(t);
  const now = 1_700_000_000_000;
  const idleMaxAgeMs = 10_000;
  const stale = now - idleMaxAgeMs - 5_000;
  const cases = [
    ["exe EACCES", "EACCES", "exe"],
    ["exe ENOENT", "ENOENT", "exe"],
    ["exe ESRCH", "ESRCH", "exe"],
    ["stat ENOENT", "ENOENT", "stat"],
    ["stat ESRCH", "ESRCH", "stat"],
  ];
  for (const [label, code, kind] of cases) {
    const target = join(sibling, "src-tauri", "target");
    rmSync(target, { recursive: true, force: true });
    const unit = makeUnit(target, "debug", { mtimeMs: stale });
    const result = await runEvict(main, {
      nowMs: now,
      idleMaxAgeMs,
      readdirProc: () => ["424242"],
      lstatProc: (path, options) => {
        if (kind === "stat" && path.endsWith(`${sep}424242`)) throw injectedError(code, label);
        if (path.endsWith(`${sep}424242`)) return { uid: BigInt(process.getuid()) };
        return lstatSync(path, options);
      },
      readlinkExe: (path) => {
        if (kind === "exe" && path.endsWith(`${sep}exe`)) throw injectedError(code, label);
        return readlinkSync(path);
      },
    });
    assert.equal(result.exitCode, 0, `${label}\n${result.lines.join("\n")}`);
    assert.equal(artifactIntact(unit), false, label);
  }
});

linuxTest("post-loop re-walk failure is undetermined with no total line (CR-5)", async (t) => {
  const { main } = twoCheckouts(t);
  const unit = makeUnit(join(main, "src-tauri", "target"), "debug");
  const result = await runEvict(main, {
    measureRootAfterEviction() {
      throw injectedError("EIO", "injected re-walk");
    },
  });
  assert.equal(result.exitCode, 1);
  assert.ok(artifactIntact(unit));
  assert.ok(
    result.lines.some(
      (line) => line.includes("undetermined") && line.includes("cannot measure total"),
    ),
  );
  assert.ok(!result.lines.some((line) => line.startsWith("total ")));
});

linuxTest("top-level errors exit 1 and name the checkout (CR-5)", async (t) => {
  const { main } = twoCheckouts(t);
  const result = await runEvict(main, {
    listCheckouts() {
      const error = new Error("injected top-level");
      error.location = main;
      throw error;
    },
  });
  assert.equal(result.exitCode, 1);
  assert.ok(result.lines.some((line) => line === `error ${main}: injected top-level`));
});
