import assert from "node:assert/strict";
import { execFileSync, spawn, spawnSync } from "node:child_process";
import {
  access,
  chmod,
  cp,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readlink,
  readdir,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const installerSource = join(projectRoot, "scripts/install-local.sh");

function git(root, ...args) {
  return execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
}

async function fixture(t, { productName = "ChessFable" } = {}) {
  const base = await mkdtemp(join(tmpdir(), "chessfable-install-"));
  const childRuns = [];
  t.after(async () => {
    for (const { child } of childRuns) {
      try {
        process.kill(-child.pid, "SIGKILL");
      } catch (error) {
        if (error.code !== "ESRCH") throw error;
      }
    }
    await Promise.allSettled(childRuns.map(({ result }) => result));
    await rm(base, { recursive: true, force: true });
  });
  const repo = join(base, "repo");
  const remote = join(base, "remote.git");
  const install = join(base, "install with spaces");
  const data = join(base, "data");
  const bin = join(base, "bin");
  await mkdir(join(repo, "scripts"), { recursive: true });
  await mkdir(join(repo, "src-tauri/target/release/sound"), { recursive: true });
  await mkdir(join(repo, "src-tauri/icons"), { recursive: true });
  await mkdir(bin, { recursive: true });
  await cp(installerSource, join(repo, "scripts/install-local.sh"));
  await chmod(join(repo, "scripts/install-local.sh"), 0o755);
  await writeFile(
    join(repo, "src-tauri/tauri.conf.json"),
    JSON.stringify({ mainBinaryName: "chessfable", productName }),
  );
  await writeFile(join(repo, "src-tauri/target/release/chessfable"), "#!/bin/sh\nexit 0\n");
  await chmod(join(repo, "src-tauri/target/release/chessfable"), 0o755);
  await writeFile(join(repo, "src-tauri/target/release/sound/move.mp3"), "sound");
  await writeFile(join(repo, "src-tauri/icons/icon.png"), "icon");
  git(repo, "init", "-b", "master");
  git(repo, "config", "user.name", "Installer Fixture");
  git(repo, "config", "user.email", "fixture@example.invalid");
  git(repo, "add", ".");
  git(repo, "commit", "-m", "fixture");
  execFileSync("git", ["init", "--bare", remote]);
  git(repo, "remote", "add", "origin", remote);
  git(repo, "push", "-u", "origin", "master");
  await writeFile(
    join(bin, "cp"),
    `#!/bin/sh
if [ -n "$INSTALL_CP_SEEN" ]; then /usr/bin/touch "$INSTALL_CP_SEEN"; fi
if [ "$INSTALL_BARRIER" = after-snapshot ]; then
  /usr/bin/touch "${join(base, "barrier-ready")}"
  while [ ! -e "${join(base, "barrier-release")}" ]; do /usr/bin/sleep 0.01; done
fi
if [ "$INSTALL_FAILURE" = copy ]; then echo "forced cp failure" >&2; exit 71; fi
exec /usr/bin/cp "$@"
`,
  );
  await writeFile(
    join(bin, "mv"),
    `#!/bin/sh
src=""; target=""
for arg do src="$target"; target="$arg"; done
marker="${join(base, "current-failed")}" 
if [ "$INSTALL_FAILURE" = promotion-collision ]; then
  case "$src" in
    */.staging-*)
      /usr/bin/mkdir -p "$target"
      echo foreign > "$target/foreign"
      ;;
  esac
fi
case "$INSTALL_FAILURE:$src:$target" in
  current-link:*.current-new-*:*/current)
    if [ ! -e "$marker" ]; then /usr/bin/touch "$marker"; echo "forced current mv failure" >&2; exit 72; fi ;;
  restore-previous:*.current-new-*:*/current)
    if [ ! -e "$marker" ]; then /usr/bin/touch "$marker"; echo "forced current mv failure" >&2; exit 72; fi ;;
  restore-previous:*.previous-new-*:*/previous)
    if [ -e "$marker" ]; then echo "forced previous restoration failure" >&2; exit 73; fi ;;
  desktop:*:*/ChessFable.desktop) echo "forced desktop mv failure" >&2; exit 74 ;;
esac
/usr/bin/mv "$@"
mv_status="$?"
if [ "$mv_status" -ne 0 ]; then exit "$mv_status"; fi
if [ "$INSTALL_FAILURE" = interrupt-after-promotion ] && echo "$src" | /usr/bin/grep -q '/.staging-'; then
  kill -TERM "$PPID"
fi
if [ "$INSTALL_FAILURE" = interrupt-after-current-publication ] && [ "$target" = "${join(install, "current")}" ]; then
  kill -TERM "$PPID"
fi
`,
  );
  await writeFile(
    join(bin, "flock"),
    '#!/bin/sh\nif [ -n "$INSTALL_FLOCK_SEEN" ]; then /usr/bin/touch "$INSTALL_FLOCK_SEEN"; fi\nexec /usr/bin/flock "$@"\n',
  );
  await chmod(join(bin, "cp"), 0o755);
  await chmod(join(bin, "mv"), 0o755);
  await chmod(join(bin, "flock"), 0o755);
  return { base, repo, install, data, bin, productName, childRuns };
}

async function seedPointers(install) {
  const releases = join(install, "releases");
  const a = join(releases, "A");
  const b = join(releases, "B");
  await mkdir(a, { recursive: true });
  await mkdir(b, { recursive: true });
  await symlink(a, join(install, "current"));
  await symlink(b, join(install, "previous"));
  return { a, b };
}

function run({ repo, install, data, bin }, failure) {
  return spawnSync("bash", [join(repo, "scripts/install-local.sh"), "--no-build"], {
    cwd: repo,
    encoding: "utf8",
    env: {
      ...process.env,
      CHESSFABLE_INSTALL_DIR: install,
      XDG_DATA_HOME: data,
      PATH: `${bin}:${process.env.PATH}`,
      INSTALL_FAILURE: failure ?? "",
    },
  });
}

function spawnRun(_t, { repo, install, data, bin, base, childRuns }, options = {}) {
  const child = spawn("bash", [join(repo, "scripts/install-local.sh"), "--no-build"], {
    cwd: repo,
    detached: true,
    env: {
      ...process.env,
      CHESSFABLE_INSTALL_DIR: install,
      XDG_DATA_HOME: data,
      PATH: `${bin}:${process.env.PATH}`,
      INSTALL_FAILURE: options.failure ?? "",
      INSTALL_BARRIER: options.barrier ? "after-snapshot" : "",
      INSTALL_CP_SEEN: options.cpSeen ?? "",
      INSTALL_FLOCK_SEEN: options.flockSeen ?? "",
    },
  });
  let stdout = "";
  let stderr = "";
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk) => {
    stdout += chunk;
  });
  child.stderr.on("data", (chunk) => {
    stderr += chunk;
  });
  const runState = {
    child,
    result: new Promise((resolveResult, rejectResult) => {
      child.on("error", rejectResult);
      child.on("close", (status, signal) => resolveResult({ status, signal, stdout, stderr }));
    }),
    ready: join(base, "barrier-ready"),
    release: join(base, "barrier-release"),
  };
  childRuns.push(runState);
  return runState;
}

async function waitForPath(path) {
  for (let attempt = 0; attempt < 500; attempt += 1) {
    try {
      await access(path);
      return;
    } catch {
      await new Promise((resolveWait) => setTimeout(resolveWait, 10));
    }
  }
  assert.fail(`timed out waiting for ${path}`);
}

async function releaseNames(install) {
  return (await readdir(join(install, "releases"))).sort();
}

async function installerTemps({ install, data, productName }) {
  const rootEntries = await readdir(install);
  const releaseEntries = await readdir(join(install, "releases"));
  const applicationEntries = await readdir(join(data, "applications"));
  return [
    ...rootEntries.filter((name) => /^\.(current|previous)-new-/u.test(name)),
    ...releaseEntries.filter((name) => name.startsWith(".staging-")),
    ...applicationEntries.filter((name) => name.startsWith(`.${productName}.desktop.`)),
  ];
}

async function legacyRelease(install, name, commitCharacter) {
  const release = join(install, "releases", name);
  const short = name.slice(0, 7);
  const commit = commitCharacter.repeat(40);
  await mkdir(join(release, "bin"), { recursive: true });
  await mkdir(join(release, "lib/en-croissant/sound"), { recursive: true });
  await writeFile(join(release, "bin/en-croissant"), "#!/bin/sh\nexit 0\n");
  await chmod(join(release, "bin/en-croissant"), 0o755);
  await writeFile(join(release, "lib/en-croissant/sound/move.mp3"), "sound");
  await writeFile(join(release, "icon.png"), "icon");
  await writeFile(
    join(release, "VERSION"),
    `commit ${commit}\nshort ${short}\nsubject legacy install\ninstalled 2026-09-01T01:01:01+02:00\nprovenance reviewed\n`,
  );
  return release;
}

test("installs the derived binary, resources, compatibility link, desktop entry and pointers", async (t) => {
  const f = await fixture(t);
  const { a } = await seedPointers(f.install);
  const result = run(f);
  assert.equal(result.status, 0, result.stderr);
  const current = await readlink(join(f.install, "current"));
  assert.notEqual(current, a);
  assert.equal(await readlink(join(f.install, "previous")), a);
  assert.equal(await readlink(join(current, "bin/en-croissant")), "chessfable");
  assert.equal((await lstat(join(current, "bin/chessfable"))).isFile(), true);
  assert.equal((await lstat(join(current, "lib/ChessFable/sound/move.mp3"))).isFile(), true);
  const desktop = await readFile(join(f.data, "applications/ChessFable.desktop"), "utf8");
  assert.match(desktop, /Exec=".*install with spaces\/current\/bin\/en-croissant"/u);
  assert.match(desktop, /Icon=.*install\\swith\\sspaces\/current\/icon\.png/u);
  assert.match(desktop, /StartupWMClass=ChessFable/u);
  assert.match(desktop, /^Name=ChessFable$/mu);
  assert.match(
    await readFile(join(current, ".chessfable-managed-release"), "utf8"),
    /^ChessFable local installer release v1\ninvocation \.staging-[A-Za-z0-9]{8}\n$/u,
  );
  assert.equal((await lstat(join(f.install, ".install.lock"))).isFile(), true);
  assert.deepEqual(await releaseNames(f.install), ["A", "B", current.split("/").at(-1)].sort());
  assert.deepEqual(await installerTemps(f), []);
});

test("derives the desktop and resource identity from productName", async (t) => {
  const f = await fixture(t, { productName: "KnightDesk" });
  const result = run(f);
  assert.equal(result.status, 0, result.stderr);
  const current = await readlink(join(f.install, "current"));
  assert.equal((await lstat(join(current, "lib/KnightDesk/sound/move.mp3"))).isFile(), true);
  const desktop = await readFile(join(f.data, "applications/KnightDesk.desktop"), "utf8");
  assert.match(desktop, /^Name=KnightDesk$/mu);
  assert.match(desktop, /^StartupWMClass=KnightDesk$/mu);
  assert.deepEqual(await installerTemps(f), []);
});

test("fresh install publishes current without inventing a previous release", async (t) => {
  const f = await fixture(t);
  const result = run(f);
  assert.equal(result.status, 0, result.stderr);
  assert.equal((await lstat(await readlink(join(f.install, "current")))).isDirectory(), true);
  await assert.rejects(lstat(join(f.install, "previous")), { code: "ENOENT" });
  assert.deepEqual(await installerTemps(f), []);
});

for (const failure of ["copy", "current-link", "interrupt-after-promotion"]) {
  test(`${failure} failure restores both original pointers and removes invocation files`, async (t) => {
    const f = await fixture(t);
    const { a, b } = await seedPointers(f.install);
    const result = run(f, failure);
    assert.notEqual(result.status, 0);
    assert.equal(await readlink(join(f.install, "current")), a);
    assert.equal(await readlink(join(f.install, "previous")), b);
    assert.deepEqual(await releaseNames(f.install), ["A", "B"]);
    if (failure === "current-link") {
      assert.match(result.stderr, /current publication failed; installed state will be restored/u);
    }
    assert.deepEqual(await installerTemps(f), []);
  });
}

test("desktop publication failure reports the committed install and rollback", async (t) => {
  const f = await fixture(t);
  const { a } = await seedPointers(f.install);
  const result = run(f, "desktop");
  assert.notEqual(result.status, 0, result.stderr);
  assert.match(result.stderr, /desktop publication failed after install committed/u);
  assert.match(result.stderr, /rollback=/u);
  assert.equal(await readlink(join(f.install, "previous")), a);
  assert.notEqual(await readlink(join(f.install, "current")), a);
  assert.deepEqual(await installerTemps(f), []);
});

test("interruption after current publication preserves the committed install and rollback", async (t) => {
  const f = await fixture(t);
  const { a, b } = await seedPointers(f.install);
  const result = run(f, "interrupt-after-current-publication");
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /install interrupted after current publication/u);
  assert.match(result.stderr, /rollback=/u);
  const current = await readlink(join(f.install, "current"));
  assert.notEqual(current, a);
  assert.notEqual(current, b);
  assert.equal(await readlink(join(f.install, "previous")), a);
  assert.equal((await lstat(current)).isDirectory(), true);
  assert.deepEqual(await installerTemps(f), []);
});

test("reports a failure to restore the original previous pointer", async (t) => {
  const f = await fixture(t);
  await seedPointers(f.install);
  const result = run(f, "restore-previous");
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /restoration failure: could not restore original previous link/u);
  assert.deepEqual(await installerTemps(f), []);
});

test("does not delete a preexisting target when promotion fails", async (t) => {
  const f = await fixture(t);
  const result = run(f, "promotion-collision");
  assert.notEqual(result.status, 0, result.stderr);
  const releases = await releaseNames(f.install);
  assert.equal(releases.length, 1);
  assert.equal(
    await readFile(join(f.install, "releases", releases[0], "foreign"), "utf8"),
    "foreign\n",
  );
  assert.deepEqual(await installerTemps(f), []);
});

for (const failure of ["current-link", "interrupt-after-promotion"]) {
  test(`serializes a waiting successful install behind an earlier ${failure} failure`, async (t) => {
    const f = await fixture(t);
    const { a, b } = await seedPointers(f.install);
    const first = spawnRun(t, f, { failure, barrier: true });
    await waitForPath(first.ready);

    const secondSeen = join(f.base, "second-copy-seen");
    const secondFlockSeen = join(f.base, "second-flock-seen");
    const second = spawnRun(t, f, { cpSeen: secondSeen, flockSeen: secondFlockSeen });
    await waitForPath(secondFlockSeen);
    await assert.rejects(access(secondSeen), { code: "ENOENT" });
    await writeFile(first.release, "continue");

    const firstResult = await first.result;
    const secondResult = await second.result;
    assert.notEqual(firstResult.status, 0);
    assert.equal(secondResult.status, 0, secondResult.stderr);
    await waitForPath(secondSeen);
    const current = await readlink(join(f.install, "current"));
    assert.notEqual(current, a);
    assert.notEqual(current, b);
    assert.equal(await readlink(join(f.install, "previous")), a);
    assert.deepEqual(await releaseNames(f.install), ["A", "B", current.split("/").at(-1)].sort());
    assert.deepEqual(await installerTemps(f), []);
  });
}

test("retains only current and previous managed releases while preserving foreign siblings", async (t) => {
  const f = await fixture(t);
  await mkdir(join(f.install, "releases", "foreign-data"), { recursive: true });
  for (let installNumber = 0; installNumber < 4; installNumber += 1) {
    const result = run(f);
    assert.equal(result.status, 0, result.stderr);
  }
  const current = await readlink(join(f.install, "current"));
  const previous = await readlink(join(f.install, "previous"));
  assert.deepEqual(
    await releaseNames(f.install),
    ["foreign-data", current.split("/").at(-1), previous.split("/").at(-1)].sort(),
  );
});

test("retires a verified legacy installer release but preserves an unverified sibling", async (t) => {
  const f = await fixture(t);
  await mkdir(join(f.install, "releases"), { recursive: true });
  const currentLegacy = await legacyRelease(f.install, "aaaaaaa-20260901T010101", "a");
  const staleLegacy = await legacyRelease(f.install, "bbbbbbb-20260901T020202", "b");
  const foreign = join(f.install, "releases", "ccccccc-20260901T030303");
  await mkdir(foreign, { recursive: true });
  await writeFile(join(foreign, "VERSION"), "not installer provenance\n");
  await symlink(currentLegacy, join(f.install, "current"));

  const result = run(f);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(await readlink(join(f.install, "previous")), currentLegacy);
  await assert.rejects(lstat(staleLegacy), { code: "ENOENT" });
  assert.equal((await lstat(foreign)).isDirectory(), true);
});

test("refuses dirty, unpushed and missing-upstream repositories", async (t) => {
  const dirty = await fixture(t);
  await writeFile(
    join(dirty.repo, "scripts/install-local.sh"),
    `${await readFile(installerSource, "utf8")}\n`,
  );
  assert.match(run(dirty).stderr, /tracked files are modified/u);

  const unpushed = await fixture(t);
  await writeFile(join(unpushed.repo, "new"), "new");
  git(unpushed.repo, "add", "new");
  git(unpushed.repo, "commit", "-m", "unpushed");
  assert.match(run(unpushed).stderr, /not contained in origin\/master/u);

  const missing = await fixture(t);
  git(missing.repo, "branch", "--unset-upstream");
  assert.match(run(missing).stderr, /has no configured upstream/u);
});

test("refuses to replace foreign current and previous files", async (t) => {
  for (const pointer of ["current", "previous"]) {
    const f = await fixture(t);
    await mkdir(f.install, { recursive: true });
    await writeFile(join(f.install, pointer), "foreign");
    const result = run(f);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, new RegExp(`${pointer} exists and is not a symlink`, "u"));
    assert.equal(await readFile(join(f.install, pointer), "utf8"), "foreign");
  }
});
