import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import {
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

async function fixture(t) {
  const base = await mkdtemp(join(tmpdir(), "chessfable-install-"));
  t.after(() => rm(base, { recursive: true, force: true }));
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
    JSON.stringify({ mainBinaryName: "chessfable", productName: "ChessFable" }),
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
    '#!/bin/sh\nif [ "$INSTALL_FAILURE" = copy ]; then echo "forced cp failure" >&2; exit 71; fi\nexec /usr/bin/cp "$@"\n',
  );
  await writeFile(
    join(bin, "mv"),
    `#!/bin/sh
src=""; target=""
for arg do src="$target"; target="$arg"; done
marker="${join(base, "current-failed")}" 
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
if [ "$INSTALL_FAILURE" = interrupt-after-promotion ] && echo "$src" | /usr/bin/grep -q '/.staging-'; then
  kill -TERM "$PPID"
fi
`,
  );
  await chmod(join(bin, "cp"), 0o755);
  await chmod(join(bin, "mv"), 0o755);
  return { base, repo, install, data, bin };
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

async function releaseNames(install) {
  return (await readdir(join(install, "releases"))).sort();
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
  assert.deepEqual(await releaseNames(f.install), ["A", "B", current.split("/").at(-1)].sort());
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
  });
}

test("desktop publication failure reports the committed install and rollback", async (t) => {
  const f = await fixture(t);
  const { a } = await seedPointers(f.install);
  const result = run(f, "desktop");
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /desktop publication failed after install committed/u);
  assert.match(result.stderr, /rollback=/u);
  assert.equal(await readlink(join(f.install, "previous")), a);
  assert.notEqual(await readlink(join(f.install, "current")), a);
});

test("reports a failure to restore the original previous pointer", async (t) => {
  const f = await fixture(t);
  await seedPointers(f.install);
  const result = run(f, "restore-previous");
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /restoration failure: could not restore original previous link/u);
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
