import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { checkGateRouting } from "./check-gate-routing.mjs";

async function write(root, relativePath, contents) {
  const path = join(root, relativePath);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, contents);
}

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "gate-routing-"));
  await write(
    root,
    "package.json",
    JSON.stringify({
      scripts: {
        "all:check": "node scripts/check-example.mjs && pnpm nested:check",
        "nested:check": "node scripts/nested.mjs",
        "example:test": "node --test scripts/example-tests.mjs",
      },
    }),
  );
  await write(
    root,
    ".claude/skills/push/SKILL.md",
    "## 2. Gates\n\n```bash\ncargo fmt -- --check\ncargo check\ncargo clippy\ncargo test\npython3 scripts/tool.py check\npnpm all:check\n```\n\n## 3. Review\n\n```text\nscripts/**\n```\n\n## 4. Finish\n",
  );
  await write(
    root,
    ".github/workflows/test.yml",
    "steps:\n  - name: Test\n    run: pnpm example:test\n",
  );
  await write(root, "vite.config.ts", 'test: { include: ["scripts/**/*.test.mjs"] },\n');
  await write(root, "scripts/check-example.mjs", "\n");
  await write(root, "scripts/example-tests.mjs", "\n");
  await write(root, "scripts/tool.py", "\n");
  return root;
}

const tracked = ["scripts/check-example.mjs"];

test("accepts routed tests, nested scripts, allowed tools, and live sensitive globs", async () => {
  const root = await fixture();
  assert.deepEqual(await checkGateRouting(root, { tracked }), []);
});

test("rejects an unrouted node:test file", async () => {
  const root = await fixture();
  await write(root, "scripts/orphan-tests.mjs", "\n");
  assert.match((await checkGateRouting(root, { tracked })).join("\n"), /orphan-tests/u);
});

test("rejects a checker without a package script", async () => {
  const root = await fixture();
  await write(root, "scripts/check-orphan.mjs", "\n");
  assert.match((await checkGateRouting(root, { tracked })).join("\n"), /checker file/u);
});

test("rejects a missing package script named by a fenced gate command", async () => {
  const root = await fixture();
  const path = join(root, ".claude/skills/push/SKILL.md");
  await writeFile(
    path,
    `${await readFile(path, "utf8")}\n\`\`\`bash\npnpm does:not:exist\n\`\`\`\n`,
  );
  assert.match((await checkGateRouting(root, { tracked })).join("\n"), /does:not:exist/u);
});

test("rejects a missing package script reached through a nested pnpm command", async () => {
  const root = await fixture();
  const packagePath = join(root, "package.json");
  const packageJson = JSON.parse(await readFile(packagePath, "utf8"));
  packageJson.scripts["nested:check"] = "pnpm missing:nested";
  await writeFile(packagePath, JSON.stringify(packageJson));
  assert.match((await checkGateRouting(root, { tracked })).join("\n"), /missing:nested/u);
});

test("rejects a check or test package script absent from push and CI routing", async () => {
  const root = await fixture();
  const packagePath = join(root, "package.json");
  const packageJson = JSON.parse(await readFile(packagePath, "utf8"));
  packageJson.scripts["orphan:check"] = "node scripts/orphan.mjs";
  await writeFile(packagePath, JSON.stringify(packageJson));
  assert.match((await checkGateRouting(root, { tracked })).join("\n"), /orphan:check/u);
});

test("accepts a .test.mjs file included by Vitest", async () => {
  const root = await fixture();
  await write(root, "scripts/unit.test.mjs", "\n");
  assert.deepEqual(await checkGateRouting(root, { tracked }), []);
});

test("rejects a sensitive-path glob with no tracked match", async () => {
  const root = await fixture();
  assert.match((await checkGateRouting(root, { tracked: [] })).join("\n"), /matches no tracked/u);
});

test("treats pnpm subcommands and flags as invocations, not script names", async () => {
  // `pnpm dlx shellcheck@4.1.0 ...` once resolved as a nested script named "dlx",
  // which failed hooks:check for a script that was never referenced. A leading
  // flag misparsed the same way: `pnpm -s all:check` resolved to "-s".
  const root = await fixture();
  const packagePath = join(root, "package.json");
  const packageJson = JSON.parse(await readFile(packagePath, "utf8"));
  packageJson.scripts["all:check"] =
    "node scripts/check-example.mjs && pnpm nested:check && pnpm dlx shellcheck@4.1.0 x.sh && pnpm -s nested:check";
  await writeFile(packagePath, JSON.stringify(packageJson));
  const problems = (await checkGateRouting(root, { tracked })).join("\n");
  assert.doesNotMatch(problems, /\bdlx\b/u);
  assert.doesNotMatch(problems, /"-s"|\s-s\b/u);
});

test("validates every path-glob block in the review section, not just one", async () => {
  // The locator once demanded exactly one text block, which coupled "the sensitive-path
  // registry" to "the only fenced text in section 3". Adding a mandatory-lens path list
  // beside it - entirely legitimate - threw instead of checking it.
  const root = await fixture();
  const skillPath = join(root, ".claude/skills/push/SKILL.md");
  const skill = await readFile(skillPath, "utf8");
  await writeFile(
    skillPath,
    skill.replace(
      "## 4. Finish",
      "A mandatory additive lens covers:\n\n```text\nscripts/**\n```\n\n## 4. Finish",
    ),
  );
  assert.deepEqual(await checkGateRouting(root, { tracked }), []);

  const withDeadGlob = (await readFile(skillPath, "utf8")).replace(
    "```text\nscripts/**\n```\n\n## 4. Finish",
    "```text\nnever/matches/**\n```\n\n## 4. Finish",
  );
  await writeFile(skillPath, withDeadGlob);
  assert.match((await checkGateRouting(root, { tracked })).join("\n"), /never\/matches/u);
});
