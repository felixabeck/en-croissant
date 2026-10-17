import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, symlink, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test, { after } from "node:test";
import { checkSkillBridges } from "./check-skill-bridges.mjs";
import { gitInit } from "./test-git-init.mjs";
import { testTempRoots } from "./test-temp-root.mjs";

const temporaryRoot = testTempRoots(after);

const checkerPath = fileURLToPath(new URL("./check-skill-bridges.mjs", import.meta.url));

function skillPath(side, name) {
  return [side, "skills", name, "SKILL.md"].join("/");
}

async function write(root, relativePath, contents) {
  const path = join(root, relativePath);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, contents);
}

function canonical(name) {
  return `---\nname: ${name}\n---\n\n# ${name}\n\nCanonical contract.\n`;
}

function bridge(name) {
  const pointer = [".claude", "skills", name, "SKILL.md"].join("/");
  return `---\nname: ${name}\n---\n\n# ${name} (Codex bridge)\n\nRead \`${pointer}\` first.\n`;
}

async function fixture() {
  const root = await temporaryRoot("skill-bridges-");
  gitInit(root);
  for (const name of ["push", "verify-ui"]) {
    await write(root, skillPath(".claude", name), canonical(name));
    await write(root, skillPath(".agents", name), bridge(name));
  }
  await write(root, "README.md", "Gate details live in the canonical skill.\n");
  return root;
}

test("accepts paired canonical skills and Codex bridges", async () => {
  const root = await fixture();
  assert.deepEqual(await checkSkillBridges(root), []);
});

test("discovers a skill shipped as a symlinked directory", async () => {
  const root = await fixture();
  // Git lists such a link as one entry instead of descending into it, and a
  // readdir walk skipped it entirely because Dirent.isDirectory() reflects
  // lstat. Either way the skill used to be invisible to the pairing check.
  await write(root, join("shared", "run", "SKILL.md"), canonical("run"));
  await write(root, skillPath(".agents", "run"), bridge("run"));
  await mkdir(join(root, ".claude", "skills"), { recursive: true });
  await symlink(join(root, "shared", "run"), join(root, ".claude", "skills", "run"));

  assert.deepEqual(await checkSkillBridges(root), []);

  await write(root, skillPath(".agents", "run"), canonical("run"));
  assert.match((await checkSkillBridges(root)).join("\n"), /does not point at/u);
});

test("requires every skill to have a counterpart", async () => {
  const root = await fixture();
  await write(root, skillPath(".claude", "git"), canonical("git"));
  assert.match((await checkSkillBridges(root)).join("\n"), /git\/SKILL\.md has no Codex bridge/u);
});

test("requires a bridge to name its canonical skill", async () => {
  const root = await fixture();
  await write(root, skillPath(".agents", "push"), canonical("push"));
  assert.match((await checkSkillBridges(root)).join("\n"), /does not point at/u);
});

test("does not treat a suffixed path as a canonical pointer", async () => {
  const root = await fixture();
  const pointer = [".claude", "skills", "push", "SKILL.md"].join("/");
  await write(
    root,
    skillPath(".agents", "push"),
    `---\nname: push\n---\n\nRead \`${pointer}.bak\` first.\n`,
  );
  assert.match((await checkSkillBridges(root)).join("\n"), /does not point at/u);
});

test("CLI exits zero when green and one when a canonical pointer is absent", async () => {
  const root = await fixture();
  const green = spawnSync(process.execPath, [checkerPath, "--repo-root", root], {
    encoding: "utf8",
  });
  assert.equal(green.status, 0);
  assert.equal(green.stdout, "Skill bridge check: OK\n");

  await write(root, skillPath(".agents", "push"), canonical("push"));
  const red = spawnSync(process.execPath, [checkerPath, "--repo-root", root], {
    encoding: "utf8",
  });
  assert.equal(red.status, 1);
  assert.match(red.stderr, /does not point at/u);
});

test("accepts long bridges and canonical pointers without prescribed wording", async () => {
  const root = await fixture();
  await write(
    root,
    skillPath(".agents", "push"),
    "Contract: `.claude/skills/push/SKILL.md`\n" + "Runtime detail.\n".repeat(40),
  );
  await write(root, "CLAUDE.md", "A historical gate source claim is harmless prose.\n");
  assert.deepEqual(await checkSkillBridges(root), []);
});

test("rejects a bridge pointing to a different canonical skill", async () => {
  const root = await fixture();
  await write(root, skillPath(".agents", "push"), bridge("verify-ui"));
  assert.match((await checkSkillBridges(root)).join("\n"), /does not point at/u);
});

test("requires a canonical counterpart for every Codex bridge", async () => {
  const root = await fixture();
  await write(root, skillPath(".agents", "git"), bridge("git"));
  assert.match(
    (await checkSkillBridges(root)).join("\n"),
    /git\/SKILL\.md has no canonical Claude skill/u,
  );
});
