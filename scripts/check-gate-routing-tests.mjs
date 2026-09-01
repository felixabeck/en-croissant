import assert from "node:assert/strict";
import { chmod, mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { checkGateRouting } from "./check-gate-routing.mjs";
import { gitInit } from "./test-git-init.mjs";

async function write(root, relativePath, contents) {
  const path = join(root, relativePath);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, contents);
}

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "gate-routing-"));
  gitInit(root);
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

const paths = ["scripts/check-example.mjs"];

test("accepts routed tests, nested scripts, allowed tools, and live sensitive globs", async () => {
  const root = await fixture();
  assert.deepEqual(await checkGateRouting(root, { paths }), []);
});

test("rejects an unrouted node:test file", async () => {
  const root = await fixture();
  await write(root, "scripts/orphan-tests.mjs", "\n");
  assert.match((await checkGateRouting(root, { paths })).join("\n"), /orphan-tests/u);
});

test("recognises every repository test shape and executable checkers regardless of name", async () => {
  const root = await fixture();
  for (const path of [
    "scripts/python-tests.py",
    "scripts/python_test.py",
    "scripts/shell-tests.sh",
  ]) {
    await write(root, path, "\n");
  }
  await write(root, "scripts/validate-example.mjs", "#!/usr/bin/env node\n");
  await chmod(join(root, "scripts/validate-example.mjs"), 0o755);

  const problems = (await checkGateRouting(root, { paths })).join("\n");
  assert.match(problems, /python-tests\.py/u);
  assert.match(problems, /python_test\.py/u);
  assert.match(problems, /shell-tests\.sh/u);
  assert.match(problems, /checker file scripts\/validate-example\.mjs/u);
});

test("rejects a checker without a package script", async () => {
  const root = await fixture();
  await write(root, "scripts/check-orphan.mjs", "\n");
  assert.match((await checkGateRouting(root, { paths })).join("\n"), /checker file/u);
});

test("requires a checker path to be an actual command invocation", async () => {
  const root = await fixture();
  const packagePath = join(root, "package.json");
  const packageJson = JSON.parse(await readFile(packagePath, "utf8"));
  packageJson.scripts["all:check"] = "echo scripts/check-example.mjs && pnpm nested:check";
  await writeFile(packagePath, JSON.stringify(packageJson));

  assert.match(
    (await checkGateRouting(root, { paths })).join("\n"),
    /checker file scripts\/check-example\.mjs/u,
  );

  packageJson.scripts["all:check"] = "scripts/check-example.mjs && pnpm nested:check";
  await writeFile(packagePath, JSON.stringify(packageJson));
  assert.deepEqual(await checkGateRouting(root, { paths }), []);
});

test("rejects a missing package script named by a fenced gate command", async () => {
  const root = await fixture();
  const path = join(root, ".claude/skills/push/SKILL.md");
  await writeFile(
    path,
    `${await readFile(path, "utf8")}\n\`\`\`bash\npnpm does:not:exist\n\`\`\`\n`,
  );
  assert.match((await checkGateRouting(root, { paths })).join("\n"), /does:not:exist/u);
});

test("rejects a missing package script reached through a nested pnpm command", async () => {
  const root = await fixture();
  const packagePath = join(root, "package.json");
  const packageJson = JSON.parse(await readFile(packagePath, "utf8"));
  packageJson.scripts["nested:check"] = "pnpm missing:nested";
  await writeFile(packagePath, JSON.stringify(packageJson));
  assert.match((await checkGateRouting(root, { paths })).join("\n"), /missing:nested/u);
});

test("rejects a check or test package script absent from push and CI routing", async () => {
  const root = await fixture();
  const packagePath = join(root, "package.json");
  const packageJson = JSON.parse(await readFile(packagePath, "utf8"));
  packageJson.scripts["orphan:check"] = "node scripts/orphan.mjs";
  await writeFile(packagePath, JSON.stringify(packageJson));
  assert.match((await checkGateRouting(root, { paths })).join("\n"), /orphan:check/u);
});

test("accepts a .test.mjs file included by Vitest", async () => {
  const root = await fixture();
  await write(root, "scripts/unit.test.mjs", "\n");
  assert.deepEqual(await checkGateRouting(root, { paths }), []);
});

test("rejects a sensitive-path glob with no tracked match", async () => {
  const root = await fixture();
  assert.match((await checkGateRouting(root, { paths: [] })).join("\n"), /matches no file/u);
});

test("sensitive-path globs see untracked files through the shared walker", async () => {
  const root = await fixture();
  const skillPath = join(root, ".claude/skills/push/SKILL.md");
  const skill = await readFile(skillPath, "utf8");
  await writeFile(skillPath, skill.replace("scripts/**", "untracked-only/**"));
  await write(root, "untracked-only/secret.rs", "\n");
  assert.doesNotMatch((await checkGateRouting(root)).join("\n"), /untracked-only/u);
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
  const problems = (await checkGateRouting(root, { paths })).join("\n");
  assert.doesNotMatch(problems, /\bdlx\b/u);
  assert.doesNotMatch(problems, /"-s"|\s-s\b/u);
});

test("the review path-glob collector validates every path block, not just one", async () => {
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
  assert.deepEqual(await checkGateRouting(root, { paths }), []);

  const withDeadGlob = (await readFile(skillPath, "utf8")).replace(
    "```text\nscripts/**\n```\n\n## 4. Finish",
    "```text\nnever/matches/**\n```\n\n## 4. Finish",
  );
  await writeFile(skillPath, withDeadGlob);
  assert.match((await checkGateRouting(root, { paths })).join("\n"), /never\/matches/u);
});

test("uses the shared coverage glob semantics for review path matching", async () => {
  const root = await fixture();
  const skillPath = join(root, ".claude/skills/push/SKILL.md");
  const skill = await readFile(skillPath, "utf8");
  await writeFile(skillPath, skill.replace("scripts/**", "**/check-*.mjs"));

  assert.deepEqual(await checkGateRouting(root, { paths }), []);
});
