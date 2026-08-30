import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { chmod, mkdir, mkdtemp, readFile, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

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
  await writeFile(
    join(bin, "cargo"),
    `#!/bin/sh
echo $$ > "$SHIM_STATE/pid"
: > "$SHIM_STATE/started"
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
  await chmod(join(bin, "cargo"), 0o755);
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

function run(root, env, args = []) {
  return spawnSync(process.execPath, [runner, ...args], {
    cwd: root,
    env,
    encoding: "utf8",
  });
}

function start(root, env, { stdio = ["ignore", "pipe", "pipe"] } = {}) {
  const child = spawn(process.execPath, [runner], { cwd: root, env, stdio });
  let stdout = "";
  let stderr = "";
  child.stdout?.on("data", (chunk) => {
    stdout += chunk;
  });
  child.stderr?.on("data", (chunk) => {
    stderr += chunk;
  });
  const done = new Promise((resolve) => {
    child.once("close", (code, signal) => resolve({ code, signal, stdout, stderr }));
  });
  return { child, done };
}

async function waitFor(path, timeoutMs = 5_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      await readFile(path);
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
  }
  assert.fail(`Timed out waiting for ${path}`);
}

function isAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

test("a normal clean run holds the fence for the run and removes it afterwards", async () => {
  const { root, bin, state } = await fixture();
  const running = start(root, environment({ bin, state, mode: "block" }));
  await waitFor(join(state, "started"));
  assert.match(await readFile(join(root, fence), "utf8"), /^started=.*\npid=\d+\n$/);
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
  const pushSkill = await readFile(
    join(projectRoot, ".agents", "skills", "push", "SKILL.md"),
    "utf8",
  );
  assert.match(pushSkill, /pnpm mutation:guard:check/);
});
