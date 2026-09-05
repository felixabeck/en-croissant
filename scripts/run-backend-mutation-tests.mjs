import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { chmod, mkdir, mkdtemp, readFile, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { fencedBlocks } from "./check-gate-routing.mjs";
import {
  isAlive,
  runMutationRunner,
  startMutationRunner,
  waitFor,
  writeShim,
} from "./mutation-runner-test-harness.mjs";

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const runner = join(projectRoot, "scripts", "run-backend-mutation.mjs");
const fence = "mutants.out/backend/.mutation-in-progress";
const marker = "/* ~ changed by cargo-mutants ~ */";

function git(root, args) {
  const result = spawnSync("git", args, { cwd: root, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout;
}

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "backend-mutation-runner-"));
  const bin = join(root, "bin");
  const state = join(root, "shim-state");
  await mkdir(join(root, "src-tauri", "src"), { recursive: true });
  await mkdir(bin);
  await mkdir(state);
  await writeFile(join(root, "src-tauri", "Cargo.toml"), '[package]\nname = "fixture"\n');
  await writeFile(join(root, "src-tauri", "src", "sample.rs"), "pub fn sample() {}\n");
  await writeShim(
    join(bin, "cargo"),
    `#!/bin/sh
echo $$ > "$SHIM_STATE/pid"
: > "$SHIM_STATE/started"
if [ -e mutants.out/backend/.mutation-in-progress ]; then
  : > "$SHIM_STATE/fence-present-at-spawn"
fi
case "$SHIM_MODE" in
  block)
    trap ': > "$SHIM_STATE/terminated"; exit 0' TERM INT
    while [ ! -e "$SHIM_STATE/release" ]; do /bin/sleep 0.05; done
    ;;
  ignore-term)
    trap '' TERM INT
    while :; do /bin/sleep 0.05; done
    ;;
  marker)
    printf '\n/* ~ changed by cargo-mutants ~ */\n' >> src-tauri/src/sample.rs
    ;;
  edit)
    printf '\n// unrelated concurrent edit\n' >> src-tauri/src/sample.rs
    ;;
  nonzero)
    exit 7
    ;;
  timeout)
    mkdir -p mutants.out/backend/database-encoding/mutants.out
    : > mutants.out/backend/database-encoding/mutants.out/missed.txt
    exit 3
    ;;
  survivor)
    mkdir -p mutants.out/backend/database-encoding/mutants.out
    echo survivor > mutants.out/backend/database-encoding/mutants.out/missed.txt
    exit 3
    ;;
esac
`,
  );
  git(root, ["init", "-q"]);
  git(root, ["add", "src-tauri"]);
  git(root, [
    "-c",
    "user.name=Runner Test",
    "-c",
    "user.email=runner@example.invalid",
    "commit",
    "-qm",
    "fixture",
  ]);
  return { root, bin, state };
}

function environment({ bin, state, mode = "normal", path = `${bin}:${process.env.PATH}` }) {
  return {
    ...process.env,
    PATH: path,
    SHIM_MODE: mode,
    SHIM_STATE: state,
    BACKEND_MUTATION_PACKAGE: "database-encoding",
  };
}

const run = (root, env, args = []) => runMutationRunner(runner, root, env, args);
const start = (root, env, options = {}) => startMutationRunner(runner, root, env, options);

test("a normal clean run holds the fence for the run and removes it afterwards", async () => {
  const { root, bin, state } = await fixture();
  const running = start(root, environment({ bin, state, mode: "block" }));
  await waitFor(join(state, "started"));
  await readFile(join(state, "fence-present-at-spawn"));
  assert.match(
    await readFile(join(root, fence), "utf8"),
    /^started=.*\npid=\d+\npidStartTime=\d+\n$/,
  );
  await writeFile(join(state, "release"), "");
  const result = await running.done;
  assert.equal(result.code, 0, result.stderr);
  assert.equal(run(root, environment({ bin, state }), ["--check-guard"]).status, 0);
});

test("an uncatchable mid-flight kill leaves the fence and makes the next run refuse", async () => {
  const { root, bin, state } = await fixture();
  const env = environment({ bin, state, mode: "block" });
  const running = start(root, env, { stdio: "ignore" });
  await waitFor(join(state, "started"));
  const cargoPid = Number(await readFile(join(state, "pid"), "utf8"));
  running.child.kill("SIGKILL");
  const killed = await running.done;
  assert.equal(killed.signal, "SIGKILL");
  const retry = run(root, env);
  assert.notEqual(retry.status, 0);
  assert.match(retry.stderr, /Backend mutation fence exists/);
  process.kill(cargoPid, "SIGTERM");
  await waitFor(join(state, "terminated"));
});

test("SIGTERM terminates and reaps cargo before the finaliser clears the fence", async () => {
  const { root, bin, state } = await fixture();
  const running = start(root, environment({ bin, state, mode: "ignore-term" }));
  await waitFor(join(state, "started"));
  const cargoPid = Number(await readFile(join(state, "pid"), "utf8"));
  running.child.kill("SIGTERM");
  const result = await running.done;
  assert.equal(result.code, 143, result.stderr);
  assert.equal(isAlive(cargoPid), false, `cargo pid ${cargoPid} still exists after runner exit`);
  assert.equal(run(root, environment({ bin, state }), ["--check-guard"]).status, 0);
});

test("SIGINT terminates and reaps cargo before the finaliser clears the fence", async () => {
  const { root, bin, state } = await fixture();
  const running = start(root, environment({ bin, state, mode: "ignore-term" }));
  await waitFor(join(state, "started"));
  const cargoPid = Number(await readFile(join(state, "pid"), "utf8"));
  running.child.kill("SIGINT");
  const result = await running.done;
  assert.equal(result.code, 130, result.stderr);
  assert.equal(isAlive(cargoPid), false, `cargo pid ${cargoPid} still exists after runner exit`);
  assert.equal(run(root, environment({ bin, state }), ["--check-guard"]).status, 0);
});

test("cargo exiting non-zero still runs the finaliser", async () => {
  const { root, bin, state } = await fixture();
  const result = run(root, environment({ bin, state, mode: "nonzero" }));
  assert.equal(result.status, 7, result.stderr);
  assert.equal(run(root, environment({ bin, state }), ["--check-guard"]).status, 0);
});

test("exit 3 remains successful only when missed.txt has no survivor", async () => {
  const timeout = await fixture();
  const timeoutResult = run(
    timeout.root,
    environment({ bin: timeout.bin, state: timeout.state, mode: "timeout" }),
  );
  assert.equal(timeoutResult.status, 0, timeoutResult.stderr);

  const survivor = await fixture();
  const survivorResult = run(
    survivor.root,
    environment({ bin: survivor.bin, state: survivor.state, mode: "survivor" }),
  );
  assert.equal(survivorResult.status, 3, survivorResult.stderr);
});

test("cargo failing to spawn runs the finaliser and surfaces the underlying error", async () => {
  const { root, bin, state } = await fixture();
  const isolatedBin = join(root, "git-only-bin");
  await mkdir(isolatedBin);
  await symlink("/usr/bin/git", join(isolatedBin, "git"));
  const result = run(root, environment({ bin, state, path: isolatedBin }));
  assert.equal(result.status, 1);
  assert.match(result.stderr, /spawn cargo ENOENT/);
  assert.equal(run(root, environment({ bin, state }), ["--check-guard"]).status, 0);
});

test("a child-record failure terminates cargo and clears the fence promptly", async () => {
  const { root, bin, state } = await fixture();
  const launcher = join(root, "record-failure.mjs");
  await writeFile(
    launcher,
    `import { existsSync } from "node:fs";
import { runBackendMutation } from ${JSON.stringify(pathToFileURL(runner).href)};
process.exitCode = await runBackendMutation({
  recordChild() {
    const deadline = Date.now() + 2_000;
    while (!existsSync(${JSON.stringify(join(state, "started"))}) && Date.now() < deadline) {
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 10);
    }
    throw new Error("forced record failure");
  },
});
`,
  );
  const startedAt = Date.now();
  const result = runMutationRunner(launcher, root, environment({ bin, state, mode: "block" }));
  assert.equal(result.status, 1);
  assert.match(result.stderr, /forced record failure/u);
  assert.equal(existsSync(join(state, "terminated")), true);
  assert.ok(Date.now() - startedAt < 4_000, "record failure did not terminate cargo promptly");
  assert.equal(run(root, environment({ bin, state }), ["--check-guard"]).status, 0);
});

test("a fence read failure before spawn removes the unowned fence", async (t) => {
  // Root ignores the file permission this arranges, so the read would succeed.
  if (process.getuid?.() === 0) {
    t.skip("root bypasses the file permission this test relies on");
    return;
  }
  const { root, bin, state } = await fixture();
  const env = environment({ bin, state });
  // The directory is created up front with ordinary permissions, so the exclusive
  // create and both fsyncs succeed; only the fence FILE lands write-only, which is
  // what makes reading it back fail. Masking the directory instead would fail before
  // any fence existed and the test would pass against a runner that never cleans up.
  await mkdir(join(root, dirname(fence)), { recursive: true });
  const result = spawnSync("/bin/sh", ["-c", 'umask 477; exec "$NODE" "$RUNNER"'], {
    cwd: root,
    env: { ...env, NODE: process.execPath, RUNNER: runner },
    encoding: "utf8",
  });
  assert.equal(result.status, 1);
  await assert.rejects(() => readFile(join(state, "started")));
  assert.equal(run(root, env, ["--check-guard"]).status, 0);
});

test("a fence setup failure after the exclusive create removes the unowned fence", async (t) => {
  // Root ignores the directory permission this arranges, so the fence would be
  // created successfully and the run would proceed instead of failing.
  if (process.getuid?.() === 0) {
    t.skip("root bypasses the directory permission this test relies on");
    return;
  }
  const { root, bin, state } = await fixture();
  const env = environment({ bin, state });
  const fenceDirectory = join(root, dirname(fence));
  await mkdir(fenceDirectory, { recursive: true });
  // Write and execute but not read: creating the fence inside still succeeds, while
  // the directory fsync that follows it cannot open the directory. That puts the
  // failure *inside* fence setup, after the exclusive create has already happened —
  // a different path from a failure reading the fence back, and the one that would
  // otherwise strand a fence nobody can explain.
  await chmod(fenceDirectory, 0o300);
  const result = run(root, env);
  await chmod(fenceDirectory, 0o755);
  assert.notEqual(result.status, 0);
  await assert.rejects(() => readFile(join(state, "started")));
  assert.equal(run(root, env, ["--check-guard"]).status, 0);
});

test("entry refuses a dirty src-tauri and lists its path", async () => {
  const { root, bin, state } = await fixture();
  await writeFile(join(root, "src-tauri", "src", "sample.rs"), "dirty\n");
  const result = run(root, environment({ bin, state }));
  assert.equal(result.status, 1);
  assert.match(result.stderr, /src-tauri is dirty:[\s\S]*src-tauri\/src\/sample\.rs/);
  assert.doesNotMatch(result.stdout, /Backend mutation package/);
});

test("a pre-existing fence reports liveness and a per-file restore command", async () => {
  const { root, bin, state } = await fixture();
  await mkdir(join(root, dirname(fence)), { recursive: true });
  await writeFile(join(root, fence), `started=2026-08-30T00:00:00.000Z\npid=${process.pid}\n`);
  await writeFile(join(root, "src-tauri", "src", "sample.rs"), `pub fn sample() {}\n${marker}\n`);
  const result = run(root, environment({ bin, state }));
  assert.equal(result.status, 1);
  assert.match(
    result.stderr,
    new RegExp(`Recorded cargo pid: ${process.pid}; currently alive: yes`),
  );
  assert.match(result.stderr, /git checkout -- 'src-tauri\/src\/sample\.rs'/);
  assert.ok(
    result.stderr.indexOf("1. Confirm") < result.stderr.indexOf("2. Restore") &&
      result.stderr.indexOf("2. Restore") < result.stderr.indexOf("3. Remove"),
  );
  assert.doesNotMatch(result.stderr, /git checkout -- src-tauri(?:\s|$)/);
});

test("--check-guard treats a reused live pid with the wrong start time as stale", async () => {
  const { root, bin, state } = await fixture();
  await mkdir(join(root, dirname(fence)), { recursive: true });
  await writeFile(
    join(root, fence),
    `started=2026-08-30T00:00:00.000Z\npid=${process.pid}\npidStartTime=wrong\n`,
  );
  const result = run(root, environment({ bin, state }), ["--check-guard"]);
  assert.equal(result.status, 1);
  assert.match(
    result.stderr,
    new RegExp(`Recorded cargo pid: ${process.pid}; currently alive: no`),
  );
});

test("exclusive fence creation rejects a second concurrent runner", async () => {
  const { root, bin, state } = await fixture();
  const env = environment({ bin, state, mode: "block" });
  const first = start(root, env);
  await waitFor(join(state, "started"));
  const second = run(root, env);
  assert.equal(second.status, 1);
  assert.match(second.stderr, /Backend mutation fence exists/);
  await writeFile(join(state, "release"), "");
  assert.equal((await first.done).code, 0);
});

test("exit verification keeps the fence for a marker but ignores an unrelated edit", async () => {
  const marked = await fixture();
  const markedResult = run(
    marked.root,
    environment({ bin: marked.bin, state: marked.state, mode: "marker" }),
  );
  assert.equal(markedResult.status, 1);
  assert.match(markedResult.stderr, /left cargo-mutants markers/);
  assert.notEqual(run(marked.root, environment(marked), ["--check-guard"]).status, 0);

  const edited = await fixture();
  const editResult = run(
    edited.root,
    environment({ bin: edited.bin, state: edited.state, mode: "edit" }),
  );
  assert.equal(editResult.status, 0, editResult.stderr);
  assert.equal(run(edited.root, environment(edited), ["--check-guard"]).status, 0);
});

test("a failed final marker scan keeps the fence and fails the run", async () => {
  const { root, bin, state } = await fixture();
  const failingBin = join(root, "grep-failing-git-bin");
  await mkdir(failingBin);
  await writeFile(
    join(failingBin, "git"),
    '#!/bin/sh\nif [ "$1" = "grep" ]; then exit 2; fi\nexec /usr/bin/git "$@"\n',
  );
  await chmod(join(failingBin, "git"), 0o755);
  await symlink(join(bin, "cargo"), join(failingBin, "cargo"));
  const result = run(root, environment({ bin, state, path: `${failingBin}:/bin` }));
  assert.equal(result.status, 1);
  assert.match(result.stderr, /finaliser could not verify the tree/);
  assert.notEqual(run(root, environment({ bin, state }), ["--check-guard"]).status, 0);
});

test("a failing git status is a refusal rather than a clean tree", async () => {
  const { root, bin, state } = await fixture();
  const failingBin = join(root, "failing-git-bin");
  await mkdir(failingBin);
  await writeFile(join(failingBin, "git"), "#!/bin/sh\nexit 2\n");
  await chmod(join(failingBin, "git"), 0o755);
  await symlink(join(bin, "cargo"), join(failingBin, "cargo"));
  const result = run(root, environment({ bin, state, path: `${failingBin}:/bin` }));
  assert.equal(result.status, 1);
  assert.match(result.stderr, /git status failed with exit 2/);
  await assert.rejects(() => readFile(join(state, "started")));
});

test("--list-packages preserves the manifest and creates no fence", async () => {
  const { root, bin, state } = await fixture();
  const result = run(root, environment({ bin, state }), ["--list-packages"]);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), [
    "database-encoding",
    "database-search",
    "engine-protocol",
    "download-policy",
    "game-rules",
    "path-authority",
    "lexer",
    "pgn-parser",
  ]);
  assert.equal(run(root, environment({ bin, state }), ["--check-guard"]).status, 0);
});

test("--check-guard passes without a fence and fails with the recovery text when fenced", async () => {
  const { root, bin, state } = await fixture();
  const env = environment({ bin, state });
  assert.equal(run(root, env, ["--check-guard"]).status, 0);
  await mkdir(join(root, dirname(fence)), { recursive: true });
  await writeFile(join(root, fence), "started=2026-08-30T00:00:00.000Z\n");
  const guarded = run(root, env, ["--check-guard"]);
  assert.equal(guarded.status, 1);
  assert.match(guarded.stderr, /1\. Confirm no `cargo mutants` process is running/);
});

test("the push skill keeps the executable mutation guard preflight wired", async () => {
  // The canonical push contract is .claude/skills/push/SKILL.md; .agents holds a Codex
  // bridge that deliberately restates no gate command. Reading the bridge here asserted
  // the guard against a file that is not supposed to carry it.
  const pushSkill = await readFile(
    join(projectRoot, ".claude", "skills", "push", "SKILL.md"),
    "utf8",
  );
  const packageJson = JSON.parse(await readFile(join(projectRoot, "package.json"), "utf8"));
  assert.match(packageJson.scripts["gates:contract:check"], /^pnpm mutation:guard:check\b/u);
  assert.ok(
    fencedBlocks(pushSkill).some((block) =>
      block.contents.split(/\r?\n/u).includes("pnpm gates:contract:check"),
    ),
  );
});
