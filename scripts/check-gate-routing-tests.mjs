import assert from "node:assert/strict";
import { chmod, mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  checkGateRouting,
  fencedBlocks,
  pnpmReferences,
  workflowSteps,
} from "./check-gate-routing.mjs";
import { gitInit } from "./test-git-init.mjs";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CONTRACT_CHAIN =
  "pnpm mutation:guard:check && pnpm lint:ci && pnpm tauri:boundary:check && pnpm rust:surface:check && pnpm ui:boundary:check && pnpm skills:check && pnpm skills:bridges:test && pnpm gates:routing:check && pnpm gates:routing:test && pnpm tools:parity:check && pnpm tools:parity:test && pnpm workflows:check && pnpm workflows:permissions:test && pnpm hooks:check && pnpm ui:boundary:report:test && pnpm coverage:report:test && pnpm bundle:report:test && pnpm mutation:runner:test && pnpm gates:receipt:test && pnpm findings:test && python3 scripts/findings.py check";

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
        "gates:contract:check": "pnpm all:check && pnpm example:test",
        "gate:ensure": "node scripts/gate-receipt.mjs ensure",
        "gate:run": "node scripts/gate-receipt.mjs run",
        "gate:check": "node scripts/gate-receipt.mjs check",
        "test:coverage": "true",
        "coverage:frontend:check": "true",
        "build-vite": "true",
        "bindings:check": "true",
        "bundle:check": "true",
        "test:e2e:container": "true",
        "mutation:frontend": "true",
        "test:coverage:backend": "true",
        "coverage:backend:check": "true",
      },
    }),
  );
  await write(
    root,
    ".claude/skills/push/SKILL.md",
    "## 2. Gates\n\n```bash\npnpm gates:contract:check\npnpm gate:check\ncargo fmt -- --check\ncargo check\ncargo clippy\ncargo test\npython3 scripts/tool.py check\n```\n\n### Rust/Tauri backend\n\n```bash\npnpm test:coverage:backend\npnpm coverage:backend:check\n```\n\n### TypeScript/React frontend\n\n```bash\npnpm test:coverage\npnpm coverage:frontend:check\npnpm build-vite\npnpm bundle:check\npnpm test:e2e:container\npnpm mutation:frontend\n```\n\n### Cross-layer contracts\n\n```bash\npnpm bindings:check\n```\n\n## 3. Review\n\n```text\nscripts/**\n```\n\n## 4. Finish\n",
  );
  await write(
    root,
    ".github/workflows/test.yml",
    "steps:\n  - name: Contract\n    run: pnpm gates:contract:check\n  - name: Frontend coverage\n    run: pnpm test:coverage\n  - name: Frontend ratchet\n    run: pnpm coverage:frontend:check\n  - name: Frontend build\n    run: pnpm build-vite\n  - name: Bindings\n    run: pnpm bindings:check\n  - name: Bundle\n    run: pnpm bundle:check\n  - name: Browser\n    run: pnpm test:e2e:container\n  - name: Mutation\n    run: pnpm mutation:frontend\n  - name: Backend coverage\n    run: pnpm test:coverage:backend\n  - name: Backend ratchet\n    run: pnpm coverage:backend:check\n",
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

test("resolves direct script commands for every supported runner", async () => {
  for (const [runner, path] of [
    ["node", "scripts/x.mjs"],
    ["python", "scripts/x.py"],
    ["python3", "scripts/x.py"],
    ["bash", "scripts/x.sh"],
    ["sh", "scripts/x.sh"],
  ]) {
    const root = await fixture();
    const skillPath = join(root, ".claude/skills/push/SKILL.md");
    await writeFile(
      skillPath,
      `${await readFile(skillPath, "utf8")}\n\`\`\`bash\n${runner} ${path}\n\`\`\`\n`,
    );
    await write(root, path, "\n");
    assert.deepEqual(await checkGateRouting(root, { paths }), [], `${runner} did not resolve`);
  }
});

test("reports script-runner paths that escape scripts", async () => {
  for (const command of [
    "bash /tmp/x.sh",
    "python3 /tmp/x.py",
    "bash scripts-evil/x.sh",
    "sh scripts/../package.json",
    "python3 scripts/../package.json",
  ]) {
    const root = await fixture();
    const skillPath = join(root, ".claude/skills/push/SKILL.md");
    await writeFile(
      skillPath,
      `${await readFile(skillPath, "utf8")}\n\`\`\`bash\n${command}\n\`\`\`\n`,
    );
    assert.match(
      (await checkGateRouting(root, { paths })).join("\n"),
      new RegExp(`gate command escapes scripts/: ${command.replaceAll("/", "\\/")}`, "u"),
    );
  }
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

test("rejects a fenced gate command that is none of the accepted forms", async () => {
  // Pins the `unresolved gate command` branch: pnpm <script>, allowed cargo
  // forms, and the five supported script runners are accepted; anything else (including a
  // raw `kit …` line) must fail. Deleting that branch keeps this suite green
  // while `pnpm gates:routing:check` would accept an unroutable fence.
  const root = await fixture();
  const path = join(root, ".claude/skills/push/SKILL.md");
  await writeFile(
    path,
    `${await readFile(path, "utf8")}\n\`\`\`bash\nkit sync --check .\n\`\`\`\n`,
  );
  assert.match(
    (await checkGateRouting(root, { paths })).join("\n"),
    /unresolved gate command in .claude\/skills\/push\/SKILL.md: kit sync --check \./u,
  );
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

test("rejects a workflow-only check script", async () => {
  const root = await fixture();
  const packagePath = join(root, "package.json");
  const packageJson = JSON.parse(await readFile(packagePath, "utf8"));
  packageJson.scripts["workflow-only:check"] = "node scripts/workflow-only.mjs";
  await writeFile(packagePath, JSON.stringify(packageJson));
  const workflowPath = join(root, ".github/workflows/test.yml");
  await writeFile(
    workflowPath,
    `${await readFile(workflowPath, "utf8")}  - name: Workflow only\n    run: pnpm workflow-only:check\n`,
  );
  assert.match(
    (await checkGateRouting(root, { paths })).join("\n"),
    /workflow-routed package script workflow-only:check/u,
  );
});

test("rejects a workflow-only script without a check or test suffix", async () => {
  const root = await fixture();
  const packagePath = join(root, "package.json");
  const packageJson = JSON.parse(await readFile(packagePath, "utf8"));
  packageJson.scripts["example:run"] = "node scripts/example-run.mjs";
  await writeFile(packagePath, JSON.stringify(packageJson));
  const workflowPath = join(root, ".github/workflows/test.yml");
  await writeFile(
    workflowPath,
    `${await readFile(workflowPath, "utf8")}  - name: Workflow only\n    run: pnpm example:run\n`,
  );
  assert.match(
    (await checkGateRouting(root, { paths })).join("\n"),
    /workflow-routed package script example:run/u,
  );
});

test("rejects a workflow-only script reached transitively", async () => {
  const root = await fixture();
  const packagePath = join(root, "package.json");
  const packageJson = JSON.parse(await readFile(packagePath, "utf8"));
  packageJson.scripts["outer:run"] = "pnpm inner:run";
  packageJson.scripts["inner:run"] = "node scripts/inner.mjs";
  await writeFile(packagePath, JSON.stringify(packageJson));
  const workflowPath = join(root, ".github/workflows/test.yml");
  await writeFile(
    workflowPath,
    `${await readFile(workflowPath, "utf8")}  - name: Workflow only\n    run: pnpm outer:run\n`,
  );
  assert.match(
    (await checkGateRouting(root, { paths })).join("\n"),
    /workflow-routed package script outer:run/u,
  );
});

test("rejects a direct workflow script command that has no push-skill route", async () => {
  const root = await fixture();
  const workflowPath = join(root, ".github/workflows/test.yml");
  await writeFile(
    workflowPath,
    `${await readFile(workflowPath, "utf8")}  - name: Direct script\n    run: node scripts/check-example.mjs --strict\n`,
  );
  assert.match(
    (await checkGateRouting(root, { paths })).join("\n"),
    /workflow command must exactly match a fenced line or routed package-script segment/u,
  );
});

test("rejects an unfenced direct workflow script in a quoted run scalar", async () => {
  const root = await fixture();
  const workflowPath = join(root, ".github/workflows/test.yml");
  await writeFile(
    workflowPath,
    `${await readFile(workflowPath, "utf8")}  - name: Quoted direct script\n    run: "node scripts/check-example.mjs --strict"\n`,
  );
  assert.match(
    (await checkGateRouting(root, { paths })).join("\n"),
    /workflow command must exactly match a fenced line or routed package-script segment/u,
  );
});

test("accepts a direct workflow script command fenced verbatim in the push skill", async () => {
  const root = await fixture();
  const command = "node scripts/check-example.mjs --strict";
  const workflowPath = join(root, ".github/workflows/test.yml");
  await writeFile(
    workflowPath,
    `${await readFile(workflowPath, "utf8")}  - name: Direct script\n    run: ${command}\n`,
  );
  const skillPath = join(root, ".claude/skills/push/SKILL.md");
  await writeFile(
    skillPath,
    `${await readFile(skillPath, "utf8")}\n\`\`\`bash\n${command}\n\`\`\`\n`,
  );
  assert.deepEqual(await checkGateRouting(root, { paths }), []);
});

test("accepts a quoted direct workflow script fenced verbatim in the push skill", async () => {
  const root = await fixture();
  const command = "node scripts/check-example.mjs --strict";
  const workflowPath = join(root, ".github/workflows/test.yml");
  await writeFile(
    workflowPath,
    `${await readFile(workflowPath, "utf8")}  - name: Quoted direct script\n    run: "${command}"\n`,
  );
  const skillPath = join(root, ".claude/skills/push/SKILL.md");
  await writeFile(
    skillPath,
    `${await readFile(skillPath, "utf8")}\n\`\`\`bash\n${command}\n\`\`\`\n`,
  );
  assert.deepEqual(await checkGateRouting(root, { paths }), []);
});

test("accepts a direct workflow script command inside a routed package script", async () => {
  const root = await fixture();
  const command = "node scripts/check-example.mjs --strict";
  const workflowPath = join(root, ".github/workflows/test.yml");
  await writeFile(
    workflowPath,
    `${await readFile(workflowPath, "utf8")}  - name: Direct script\n    run: ${command}\n`,
  );
  const packagePath = join(root, "package.json");
  const packageJson = JSON.parse(await readFile(packagePath, "utf8"));
  packageJson.scripts["all:check"] = `${command} && pnpm nested:check`;
  await writeFile(packagePath, JSON.stringify(packageJson));
  assert.deepEqual(await checkGateRouting(root, { paths }), []);
});

test("reports unknown receipt names for every receipt verb", async () => {
  for (const verb of ["ensure", "run", "check"]) {
    const root = await fixture();
    const skillPath = join(root, ".claude/skills/push/SKILL.md");
    await writeFile(
      skillPath,
      `${await readFile(skillPath, "utf8")}\n\`\`\`bash\npnpm gate:${verb} absent-gate\n\`\`\`\n`,
    );
    assert.match(
      (await checkGateRouting(root, { paths })).join("\n"),
      new RegExp(`unknown receipt gate absent-gate.*pnpm gate:${verb} absent-gate`, "u"),
    );
  }
});

test("resolves nested package scripts through every receipt verb", async () => {
  for (const verb of ["ensure", "run", "check"]) {
    const root = await fixture();
    const packagePath = join(root, "package.json");
    const packageJson = JSON.parse(await readFile(packagePath, "utf8"));
    packageJson.scripts["build-vite"] = "pnpm receipt:nested:check";
    packageJson.scripts["receipt:nested:check"] = "node scripts/receipt-nested.mjs";
    await writeFile(packagePath, JSON.stringify(packageJson));
    const skillPath = join(root, ".claude/skills/push/SKILL.md");
    await writeFile(
      skillPath,
      `${await readFile(skillPath, "utf8")}\n\`\`\`bash\npnpm gate:${verb} frontend-build\n\`\`\`\n`,
    );
    assert.deepEqual(await checkGateRouting(root, { paths }), [], `${verb} did not expand`);
  }
});

test("resolves a script reached only through a receipt", async () => {
  const root = await fixture();
  const packagePath = join(root, "package.json");
  const packageJson = JSON.parse(await readFile(packagePath, "utf8"));
  packageJson.scripts["build-vite"] = "pnpm receipt-only:check";
  packageJson.scripts["receipt-only:check"] = "node scripts/receipt-only.mjs";
  await writeFile(packagePath, JSON.stringify(packageJson));
  const skillPath = join(root, ".claude/skills/push/SKILL.md");
  await writeFile(
    skillPath,
    `${await readFile(skillPath, "utf8")}\n\`\`\`bash\npnpm gate:ensure frontend-build\n\`\`\`\n`,
  );
  assert.deepEqual(await checkGateRouting(root, { paths }), []);
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

test("rejects a contract-gate member duplicated directly in the workflow", async () => {
  const root = await fixture();
  const workflowPath = join(root, ".github/workflows/test.yml");
  await writeFile(
    workflowPath,
    `${await readFile(workflowPath, "utf8")}  - name: Duplicate member\n    run: pnpm all:check\n`,
  );
  assert.match(
    (await checkGateRouting(root, { paths })).join("\n"),
    /contract-gate member all:check is also invoked directly by .github\/workflows\/test.yml/u,
  );
});

test("rejects a contract-gate member duplicated directly in the push skill", async () => {
  const root = await fixture();
  const skillPath = join(root, ".claude/skills/push/SKILL.md");
  await writeFile(
    skillPath,
    `${await readFile(skillPath, "utf8")}\n\`\`\`bash\npnpm all:check\n\`\`\`\n`,
  );
  assert.match(
    (await checkGateRouting(root, { paths })).join("\n"),
    /contract-gate member all:check is also invoked directly by .claude\/skills\/push\/SKILL.md/u,
  );
});

test("requires exactly one contract-gate fence", async () => {
  const root = await fixture();
  const skillPath = join(root, ".claude/skills/push/SKILL.md");
  await writeFile(
    skillPath,
    `${await readFile(skillPath, "utf8")}\n\`\`\`bash\npnpm gates:contract:check\n\`\`\`\n`,
  );
  assert.match(
    (await checkGateRouting(root, { paths })).join("\n"),
    /must be fenced exactly once/u,
  );
});

test("requires exactly one workflow step for the contract gate", async () => {
  const root = await fixture();
  const workflowPath = join(root, ".github/workflows/test.yml");
  await writeFile(
    workflowPath,
    `${await readFile(workflowPath, "utf8")}  - name: Contract again\n    run: pnpm gates:contract:check\n`,
  );
  assert.match(
    (await checkGateRouting(root, { paths })).join("\n"),
    /must run gates:contract:check exactly once/u,
  );
});

test("requires the contract gate package script", async () => {
  const root = await fixture();
  const packagePath = join(root, "package.json");
  const packageJson = JSON.parse(await readFile(packagePath, "utf8"));
  delete packageJson.scripts["gates:contract:check"];
  await writeFile(packagePath, JSON.stringify(packageJson));
  assert.match((await checkGateRouting(root, { paths })).join("\n"), /package.json is missing/u);
});

test("requires the contract gate fence", async () => {
  const root = await fixture();
  const skillPath = join(root, ".claude/skills/push/SKILL.md");
  const skill = await readFile(skillPath, "utf8");
  await writeFile(skillPath, skill.replace("pnpm gates:contract:check\n", ""));
  assert.match(
    (await checkGateRouting(root, { paths })).join("\n"),
    /must be fenced exactly once/u,
  );
});

test("requires the contract gate fence in the section 2 preamble", async () => {
  const root = await fixture();
  const skillPath = join(root, ".claude/skills/push/SKILL.md");
  const skill = await readFile(skillPath, "utf8");
  await writeFile(
    skillPath,
    skill.replace(
      "```bash\npnpm gates:contract:check",
      "### Path gate\n\n```bash\npnpm gates:contract:check",
    ),
  );
  assert.match(
    (await checkGateRouting(root, { paths })).join("\n"),
    /must be fenced exactly once.*§2 preamble/u,
  );
});

test("requires the workflow to run the contract gate", async () => {
  const root = await fixture();
  await write(
    root,
    ".github/workflows/test.yml",
    "steps:\n  - name: No command\n    uses: x/y@v1\n",
  );
  assert.match(
    (await checkGateRouting(root, { paths })).join("\n"),
    /must run gates:contract:check exactly once/u,
  );
});

test("requires an unconditional contract-gate workflow step", async () => {
  const root = await fixture();
  const workflowPath = join(root, ".github/workflows/test.yml");
  const workflow = await readFile(workflowPath, "utf8");
  await writeFile(workflowPath, workflow.replace("    run:", "    if: success()\n    run:"));
  assert.match(
    (await checkGateRouting(root, { paths })).join("\n"),
    /must run gates:contract:check in a step without if:/u,
  );
});

test("rejects continue-on-error on the contract-gate workflow step", async () => {
  const root = await fixture();
  const workflowPath = join(root, ".github/workflows/test.yml");
  const workflow = await readFile(workflowPath, "utf8");
  await writeFile(
    workflowPath,
    workflow.replace(
      "    run: pnpm gates:contract:check",
      "    continue-on-error: true\n    run: pnpm gates:contract:check",
    ),
  );
  assert.match(
    (await checkGateRouting(root, { paths })).join("\n"),
    /workflow step ignores the gate's exit status: Contract/u,
  );
});

test("rejects continue-on-error on another routed gate step", async () => {
  const root = await fixture();
  const workflowPath = join(root, ".github/workflows/test.yml");
  const workflow = await readFile(workflowPath, "utf8");
  await writeFile(
    workflowPath,
    workflow.replace(
      "    run: pnpm mutation:frontend",
      "    continue-on-error: true\n    run: pnpm mutation:frontend",
    ),
  );
  assert.match(
    (await checkGateRouting(root, { paths })).join("\n"),
    /workflow step ignores the gate's exit status: Mutation/u,
  );
});

test("requires the contract workflow command to be exact", async () => {
  const root = await fixture();
  const workflowPath = join(root, ".github/workflows/test.yml");
  const workflow = await readFile(workflowPath, "utf8");
  await writeFile(
    workflowPath,
    workflow.replace("run: pnpm gates:contract:check", "run: pnpm gates:contract:check --silent"),
  );
  assert.match((await checkGateRouting(root, { paths })).join("\n"), /must be exactly/u);
});

test("rejects workflow gate exit-code neutralisation and chaining", async () => {
  for (const suffix of [" || true", "; true", " | cat"]) {
    const root = await fixture();
    const workflowPath = join(root, ".github/workflows/test.yml");
    const workflow = await readFile(workflowPath, "utf8");
    await writeFile(
      workflowPath,
      workflow.replace("run: pnpm gates:contract:check", `run: pnpm gates:contract:check${suffix}`),
    );
    assert.match(
      (await checkGateRouting(root, { paths })).join("\n"),
      /workflow step neutralises or chains gate exit codes/u,
    );
  }
});

test("rejects changed arguments on a routed workflow script", async () => {
  const root = await fixture();
  const workflowPath = join(root, ".github/workflows/test.yml");
  const workflow = await readFile(workflowPath, "utf8");
  await writeFile(
    workflowPath,
    workflow.replace("run: pnpm mutation:frontend", "run: pnpm mutation:frontend --list-packages"),
  );
  assert.match(
    (await checkGateRouting(root, { paths })).join("\n"),
    /workflow command must exactly match/u,
  );
});

test("accepts the exact contract workflow command", async () => {
  const root = await fixture();
  assert.doesNotMatch(
    (await checkGateRouting(root, { paths })).join("\n"),
    /contract-gate step must be exactly/u,
  );
});

test("accepts every YAML block scalar spelling and preserves folding semantics", () => {
  for (const marker of ["|", "|-", "|+", "|2", "|2-", "|+2", ">", ">-", ">+"]) {
    const [step] = workflowSteps(
      `steps:\n  - name: Scalar\n    run: ${marker}\n      pnpm alpha\n      pnpm beta\n`,
    );
    assert.equal(
      step.run,
      marker.startsWith("|") ? "pnpm alpha\npnpm beta" : "pnpm alpha pnpm beta",
    );
  }
});

test("unquotes YAML run scalars and their supported escapes", () => {
  const steps = workflowSteps(
    `steps:\n  - name: Double\n    run: "node scripts/check-example.mjs \\"quoted\\" \\\\path"\n  - name: Single\n    run: 'node scripts/check-example.mjs ''quoted'''\n`,
  );
  assert.equal(steps[0].run, 'node scripts/check-example.mjs "quoted" \\path');
  assert.equal(steps[1].run, "node scripts/check-example.mjs 'quoted'");
});

test("reports CI-only scripts hidden in literal and folded block scalars", async () => {
  for (const marker of ["|-", ">-"]) {
    const root = await fixture();
    const packagePath = join(root, "package.json");
    const packageJson = JSON.parse(await readFile(packagePath, "utf8"));
    packageJson.scripts["ci-only:run"] = "node scripts/ci-only.mjs";
    await writeFile(packagePath, JSON.stringify(packageJson));
    const workflowPath = join(root, ".github/workflows/test.yml");
    await writeFile(
      workflowPath,
      `${await readFile(workflowPath, "utf8")}  - name: Hidden\n    run: ${marker}\n      pnpm ci-only:run\n`,
    );
    assert.match(
      (await checkGateRouting(root, { paths })).join("\n"),
      /workflow-routed package script ci-only:run/u,
    );
  }
});

test("reports a CI-only script in an explicitly indented block scalar", async () => {
  const root = await fixture();
  const packagePath = join(root, "package.json");
  const packageJson = JSON.parse(await readFile(packagePath, "utf8"));
  packageJson.scripts["ci-only:run"] = "node scripts/ci-only.mjs";
  await writeFile(packagePath, JSON.stringify(packageJson));
  const workflowPath = join(root, ".github/workflows/test.yml");
  await writeFile(
    workflowPath,
    `${await readFile(workflowPath, "utf8")}  - name: Explicit indentation\n    run: |2-\n      pnpm ci-only:run\n`,
  );
  assert.match(
    (await checkGateRouting(root, { paths })).join("\n"),
    /workflow-routed package script ci-only:run/u,
  );
});

test("reports a path-scoped CI script fenced only under another subsection", async () => {
  const root = await fixture();
  const skillPath = join(root, ".claude/skills/push/SKILL.md");
  const skill = await readFile(skillPath, "utf8");
  await writeFile(
    skillPath,
    skill
      .replace("pnpm mutation:frontend\n", "")
      .replace("pnpm bindings:check\n", "pnpm bindings:check\npnpm mutation:frontend\n"),
  );
  assert.match(
    (await checkGateRouting(root, { paths })).join("\n"),
    /must be fenced in ### TypeScript/u,
  );
});

test("reports a CI script fenced under a path subsection but absent from the explicit map", async () => {
  const root = await fixture();
  const packagePath = join(root, "package.json");
  const packageJson = JSON.parse(await readFile(packagePath, "utf8"));
  packageJson.scripts["path-only:run"] = "true";
  await writeFile(packagePath, JSON.stringify(packageJson));
  const skillPath = join(root, ".claude/skills/push/SKILL.md");
  const skill = await readFile(skillPath, "utf8");
  await writeFile(
    skillPath,
    skill.replace("pnpm mutation:frontend\n", "pnpm mutation:frontend\npnpm path-only:run\n"),
  );
  const workflowPath = join(root, ".github/workflows/test.yml");
  await writeFile(
    workflowPath,
    `${await readFile(workflowPath, "utf8")}  - name: Path only\n    run: pnpm path-only:run\n`,
  );
  assert.match(
    (await checkGateRouting(root, { paths })).join("\n"),
    /workflow-routed package script path-only:run.*neither reachable/u,
  );
});

test("reports a stale path-scoped CI map key absent from the workflow", async () => {
  const root = await fixture();
  const workflowPath = join(root, ".github/workflows/test.yml");
  const workflow = await readFile(workflowPath, "utf8");
  await writeFile(
    workflowPath,
    workflow.replace("  - name: Mutation\n    run: pnpm mutation:frontend\n", ""),
  );
  assert.match(
    (await checkGateRouting(root, { paths })).join("\n"),
    /PATH_SCOPED_CI_SCRIPTS key mutation:frontend is absent/u,
  );
});

test("the live repository pins one shared contract-gate list", async () => {
  const [packageText, workflow, skill] = await Promise.all([
    readFile(join(projectRoot, "package.json"), "utf8"),
    readFile(join(projectRoot, ".github/workflows/test.yml"), "utf8"),
    readFile(join(projectRoot, ".claude/skills/push/SKILL.md"), "utf8"),
  ]);
  const scripts = JSON.parse(packageText).scripts;
  assert.equal(scripts["gates:contract:check"], CONTRACT_CHAIN);

  const steps = workflowSteps(workflow);
  const contractSteps = steps.filter((step) =>
    pnpmReferences(step.run).includes("gates:contract:check"),
  );
  assert.equal(contractSteps.length, 1);
  assert.equal(contractSteps[0].hasIf, false);
  const members = pnpmReferences(CONTRACT_CHAIN);
  assert.deepEqual(
    steps.flatMap((step) => pnpmReferences(step.run)).filter((name) => members.includes(name)),
    [],
  );

  const sectionTwo = skill.slice(skill.indexOf("## 2."), skill.indexOf("## 3."));
  const firstPathSubsection = sectionTwo.indexOf("### Rust/Tauri backend");
  const preamble = sectionTwo.slice(0, firstPathSubsection);
  const bashBlocks = fencedBlocks(skill).filter((block) => block.language === "bash");
  assert.equal(
    bashBlocks
      .flatMap((block) => pnpmReferences(block.contents))
      .filter((name) => name === "gates:contract:check").length,
    1,
  );
  assert.ok(
    fencedBlocks(preamble).some((block) =>
      pnpmReferences(block.contents).includes("gates:contract:check"),
    ),
  );
  assert.deepEqual(
    bashBlocks
      .flatMap((block) => pnpmReferences(block.contents))
      .filter((name) => members.includes(name)),
    [],
  );
  assert.ok(
    !bashBlocks.some((block) =>
      block.contents.split(/\r?\n/u).includes("python3 scripts/findings.py check"),
    ),
  );
});
