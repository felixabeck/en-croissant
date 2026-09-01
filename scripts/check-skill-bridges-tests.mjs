import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { BRIDGE_LINE_CAP, checkSkillBridges } from "./check-skill-bridges.mjs";

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

function gitInit(root) {
  const result = spawnSync("git", ["init", "--quiet"], { cwd: root, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
}

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "skill-bridges-"));
  gitInit(root);
  for (const name of ["push", "verify-ui"]) {
    await write(root, skillPath(".claude", name), canonical(name));
    await write(root, skillPath(".agents", name), bridge(name));
  }
  await write(root, "README.md", "Gate details live in the canonical skill.\n");
  return root;
}

test("accepts paired canonical skills and capped Codex bridges", async () => {
  const root = await fixture();
  assert.deepEqual(await checkSkillBridges(root), []);
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

test("rejects a bridge that only mentions the canonical path in a negation", async () => {
  const root = await fixture();
  const pointer = [".claude", "skills", "push", "SKILL.md"].join("/");
  await write(
    root,
    skillPath(".agents", "push"),
    `---\nname: push\n---\n\nDo not read \`${pointer}\`.\nThen copy these divergent instructions.\n`,
  );
  assert.match((await checkSkillBridges(root)).join("\n"), /does not point at/u);
});

test("keeps bridges below the line cap", async () => {
  const root = await fixture();
  const oversized = Array.from({ length: BRIDGE_LINE_CAP + 1 }, () => "line").join("\n");
  await write(root, skillPath(".agents", "push"), `${bridge("push")}${oversized}\n`);
  assert.match((await checkSkillBridges(root)).join("\n"), /bridge cap/u);
});

test("rejects a canonical skill that delegates back to its bridge", async () => {
  const root = await fixture();
  const pointer = [".agents", "skills", "push", "SKILL.md"].join("/");
  await write(
    root,
    skillPath(".claude", "push"),
    `Read \`${pointer}\` and execute that canonical workflow.\n`,
  );
  assert.match((await checkSkillBridges(root)).join("\n"), /delegates its canonical contract/u);
});

test("rejects repository consumers that name a bridge as the gate source", async () => {
  const root = await fixture();
  const pointer = [".agents", "skills", "push", "SKILL.md"].join("/");
  await write(root, "CLAUDE.md", `\`${pointer}\` is the single source for which gate runs.\n`);
  assert.match((await checkSkillBridges(root)).join("\n"), /names bridge .* as a gate source/u);
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
