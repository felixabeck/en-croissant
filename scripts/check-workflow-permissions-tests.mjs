import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  checkWorkflowPermissions,
  checkWorkflowText,
  workflowPaths,
} from "./check-workflow-permissions.mjs";

const checkerPath = fileURLToPath(new URL("./check-workflow-permissions.mjs", import.meta.url));
const CHECKOUT_SHA = "11d5960a326750d5838078e36cf38b85af677262";
const SIX_SPACE_PROBE = `name: probe
on: [push]
permissions:
  contents: read
jobs:
  sneaky:
      runs-on: ubuntu-latest
      permissions:
        contents: write
      steps:
        - uses: evil/unpinned@main
`;

function workflow({ permissions = "permissions:\n  contents: read", action = undefined } = {}) {
  const uses = action ? `\n    steps:\n      - uses: ${action}` : "";
  return `name: Test\non: push\n${permissions}\njobs:\n  test:\n    runs-on: ubuntu-latest${uses}\n`;
}

function release(action = `actions/checkout@${CHECKOUT_SHA}`) {
  return workflow({
    permissions: "permissions:\n  contents: read",
    action,
  }).replace(
    "  test:\n    runs-on: ubuntu-latest",
    "  release:\n    permissions:\n      contents: write\n    runs-on: ubuntu-latest",
  );
}

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "workflow-permissions-"));
  const directory = join(root, ".github", "workflows");
  await mkdir(directory, { recursive: true });
  await writeFile(join(directory, "test.yml"), workflow());
  await writeFile(join(directory, "release.yml"), release());
  return root;
}

test("accepts explicit read defaults and allowlisted SHA-pinned actions in the release job", () => {
  assert.deepEqual(checkWorkflowText(release(), "release.yml"), []);
});

test("requires explicit top-level permissions", () => {
  const findings = checkWorkflowText(workflow({ permissions: "" }), "test.yml");
  assert.match(findings.join("\n"), /top-level permissions must be explicit/u);
});

test("forbids id-token write at workflow and job level", () => {
  const topLevel = workflow({ permissions: "permissions:\n  id-token: write" });
  assert.match(checkWorkflowText(topLevel, "test.yml").join("\n"), /workflow.*id-token/u);

  const jobLevel = workflow().replace(
    "    runs-on:",
    "    permissions:\n      id-token: write\n    runs-on:",
  );
  assert.match(checkWorkflowText(jobLevel, "test.yml").join("\n"), /job test.*id-token/u);
});

test("confines effective contents write to release.yml", () => {
  const findings = checkWorkflowText(
    workflow({ permissions: "permissions:\n  contents: write" }),
    "test.yml",
  );
  assert.match(findings.join("\n"), /not allowlisted/u);
});

test("rejects mutable and unallowlisted actions in a write-capable job", () => {
  assert.match(
    checkWorkflowText(release("tauri-apps/tauri-action@v0"), "release.yml").join("\n"),
    /40-character commit SHA/u,
  );
  assert.match(
    checkWorkflowText(release(`example/unknown@${CHECKOUT_SHA}`), "release.yml").join("\n"),
    /allowlisted action/u,
  );
});

test("rejects the six-space job-indentation workflow for both the write grant and unpinned action", () => {
  const findings = checkWorkflowText(SIX_SPACE_PROBE, "probe.yml").join("\n");
  assert.match(findings, /job sneaky has non-allowlisted contents: write/u);
  assert.match(findings, /evil\/unpinned@main/u);
});

test("two-space, four-space and six-space indentations produce the same verdict", () => {
  function indentedWorkflow(width) {
    const indent = " ".repeat(width);
    return `name: probe
on: [push]
permissions:
${indent}contents: read
jobs:
${indent}sneaky:
${indent}${indent}runs-on: ubuntu-latest
${indent}${indent}permissions:
${indent}${indent}${indent}contents: write
${indent}${indent}steps:
${indent}${indent}${indent}- uses: evil/unpinned@main
`;
  }

  const verdicts = [2, 4, 6].map((width) =>
    checkWorkflowText(indentedWorkflow(width), "probe.yml"),
  );
  assert.deepEqual(verdicts[1], verdicts[0]);
  assert.deepEqual(verdicts[2], verdicts[0]);
});

test("tab-indented or otherwise unparseable input fails loudly rather than passing", () => {
  assert.throws(
    () => checkWorkflowText(workflow().replace("  test:", "\ttest:"), "tabs.yml"),
    /cannot parse workflow YAML confidently: tabs are not allowed/u,
  );
  assert.throws(
    () => checkWorkflowText(`${workflow()}   stray-indentation: true\n`, "broken.yml"),
    /cannot parse workflow YAML confidently: inconsistent indentation/u,
  );
});

test("missing actionlint fails by default and passes only with the explicit flag", () => {
  const options = { encoding: "utf8", env: { ...process.env, PATH: "" } };
  const required = spawnSync(process.execPath, [checkerPath, "--actionlint"], options);
  assert.equal(required.status, 1);
  assert.match(required.stderr, /actionlint: FAIL.*unavailable/u);

  const optedOut = spawnSync(
    process.execPath,
    [checkerPath, "--actionlint", "--allow-missing-actionlint"],
    options,
  );
  assert.equal(optedOut.status, 0);
  assert.match(optedOut.stderr, /actionlint: SKIP.*unavailable/u);
});

test("does not require SHA pins in read-only jobs", () => {
  assert.deepEqual(checkWorkflowText(workflow({ action: "actions/checkout@v4" }), "test.yml"), []);
});

test("discovers both yml and yaml workflow files", async () => {
  const root = await fixture();
  await writeFile(join(root, ".github", "workflows", "extra.yaml"), workflow());
  assert.deepEqual(
    (await workflowPaths(root)).map((path) => path.slice(path.lastIndexOf("/") + 1)),
    ["extra.yaml", "release.yml", "test.yml"],
  );
});

test("repository check and CLI fail when any discovered workflow regresses", async () => {
  const root = await fixture();
  assert.deepEqual(await checkWorkflowPermissions(root), []);

  await writeFile(join(root, ".github", "workflows", "test.yml"), workflow({ permissions: "" }));
  assert.match((await checkWorkflowPermissions(root)).join("\n"), /top-level permissions/u);

  const result = spawnSync(process.execPath, [checkerPath], { cwd: root, encoding: "utf8" });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Workflow permissions check: FAIL/u);
});
