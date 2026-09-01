import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { checkToolVersionParity, discoverToolVersions } from "./check-tool-version-parity.mjs";

const checkerPath = fileURLToPath(new URL("./check-tool-version-parity.mjs", import.meta.url));

async function put(root, path, contents) {
  const absolute = join(root, path);
  await mkdir(join(absolute, ".."), { recursive: true });
  await writeFile(absolute, contents);
}

function gitInit(root) {
  const result = spawnSync("git", ["init", "--quiet"], { cwd: root, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
}

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "tool-version-parity-"));
  gitInit(root);
  const nightly = "nightly-" + "2025-06-01";
  await put(root, "scripts/rust-coverage.mjs", `const toolchain = "${nightly}";\n`);
  await put(
    root,
    ".github/workflows/test.yml",
    `run: cargo install cargo-llvm-cov --version 0.8.7 --locked\nrun: rustup toolchain install ${nightly}\n`,
  );
  await put(
    root,
    ".github/workflows/mutation.yml",
    "run: cargo install cargo-mutants --version 27.1.0 --locked\n",
  );
  await put(
    root,
    ".claude/skills/push/SKILL.md",
    `Use the pinned \`${nightly}\` toolchain and \`cargo-llvm-cov\` 0.8.7.\n`,
  );
  await put(root, "rust-toolchain.toml", `# Install ${nightly} for coverage.\n`);
  return root;
}

test("accepts matching declarations and discovers every matching site", async () => {
  const root = await fixture();
  assert.deepEqual(await checkToolVersionParity(root), []);

  const families = await discoverToolVersions(root);
  assert.equal(families.find((family) => family.name === "nightly toolchain").sites.length, 4);
  assert.equal(families.find((family) => family.name === "cargo-llvm-cov").sites.length, 2);
  assert.equal(families.find((family) => family.name === "cargo-mutants").sites.length, 1);
});

test("reports both cargo-llvm-cov sites and values when the authority differs", async () => {
  const root = await fixture();
  await put(
    root,
    ".github/workflows/test.yml",
    "run: cargo install cargo-llvm-cov --version 0.8.8 --locked\nrun: rustup toolchain install nightly-2025-06-01\n",
  );
  const findings = (await checkToolVersionParity(root)).join("\n");
  assert.match(findings, /cargo-llvm-cov mismatch/u);
  assert.match(findings, /.github\/workflows\/test.yml:1 declares "0.8.8"/u);
  assert.match(findings, /.claude\/skills\/push\/SKILL.md:1 declares "0.8.7"/u);
});

test("reports the executable nightly authority and every mismatching restatement", async () => {
  const root = await fixture();
  await put(root, "scripts/rust-coverage.mjs", 'const toolchain = "nightly-2025-06-02";\n');
  const findings = (await checkToolVersionParity(root)).join("\n");
  assert.match(findings, /nightly toolchain mismatch/u);
  assert.match(findings, /authority scripts\/rust-coverage.mjs:1 declares "nightly-2025-06-02"/u);
  assert.match(findings, /.github\/workflows\/test.yml:2 declares "nightly-2025-06-01"/u);
});

test("discovers a newly added matching declaration without a path registry", async () => {
  const root = await fixture();
  await put(
    root,
    ".github/workflows/extra.yaml",
    "run: rustup toolchain install nightly-2025-07-01\n",
  );
  const findings = (await checkToolVersionParity(root)).join("\n");
  assert.match(findings, /.github\/workflows\/extra.yaml:1 declares "nightly-2025-07-01"/u);
});

test("requires the single-site cargo-mutants authority to remain discoverable", async () => {
  const root = await fixture();
  await put(root, ".github/workflows/mutation.yml", "run: pnpm mutation:backend\n");
  const findings = (await checkToolVersionParity(root)).join("\n");
  assert.match(findings, /cargo-mutants: expected at least 1 declaration site/u);
  assert.match(findings, /cargo-mutants: expected exactly one authority; found 0/u);
});

test("CLI exits non-zero when a discovered declaration disagrees", async () => {
  const root = await fixture();
  await put(
    root,
    ".github/workflows/test.yml",
    "run: cargo install cargo-llvm-cov --version 0.8.8 --locked\nrun: rustup toolchain install nightly-2025-06-01\n",
  );
  const result = spawnSync(process.execPath, [checkerPath], { cwd: root, encoding: "utf8" });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Tool version parity check: FAIL/u);
  assert.match(result.stderr, /.github\/workflows\/test.yml/u);
  assert.match(result.stderr, /.claude\/skills\/push\/SKILL.md/u);
});

test("keeps the nightly authority when the constant moves to a shared module", async () => {
  // The authority pattern once bound to the identifier `toolchain`. Extracting the pin
  // into scripts/toolchain-versions.mjs as RUST_COVERAGE_TOOLCHAIN made the authority
  // vanish - "expected exactly one authority; found 0" - so the family silently lost the
  // only executable declaration it ranks the others against.
  const root = await fixture();
  await put(root, "scripts/rust-coverage.mjs", 'import { PIN } from "./toolchain-versions.mjs";\n');
  await put(
    root,
    "scripts/toolchain-versions.mjs",
    'export const RUST_COVERAGE_TOOLCHAIN = "nightly-2025-06-01";\n',
  );
  assert.deepEqual(await checkToolVersionParity(root), []);

  await put(
    root,
    "scripts/toolchain-versions.mjs",
    'export const RUST_COVERAGE_TOOLCHAIN = "nightly-2025-06-02";\n',
  );
  const findings = (await checkToolVersionParity(root)).join("\n");
  assert.match(
    findings,
    /authority scripts\/toolchain-versions.mjs:1 declares "nightly-2025-06-02"/u,
  );
});
