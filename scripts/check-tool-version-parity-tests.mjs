import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import test from "node:test";
import { checkToolVersionParity, discoverToolVersions } from "./check-tool-version-parity.mjs";
import { gitInit } from "./test-git-init.mjs";

const checkerPath = fileURLToPath(new URL("./check-tool-version-parity.mjs", import.meta.url));
const repositoryRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const rustContractPaths = [
  "rust-toolchain.toml",
  "scripts/setup-rust.sh",
  "scripts/toolchain-versions.mjs",
  ".github/workflows/test.yml",
  ".github/workflows/mutation.yml",
  ".github/workflows/release.yml",
  ".claude/skills/push/SKILL.md",
];

async function put(root, path, contents) {
  const absolute = join(root, path);
  await mkdir(join(absolute, ".."), { recursive: true });
  await writeFile(absolute, contents);
}

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "tool-version-parity-"));
  gitInit(root);
  const nightly = "nightly-" + "2025-06-01";
  await put(root, "scripts/rust-coverage.mjs", `const toolchain = "${nightly}";\n`);
  await put(
    root,
    ".github/workflows/test.yml",
    `jobs:\n  test:\n    steps:\n      - name: Install Rust toolchain\n        shell: bash\n        run: bash scripts/setup-rust.sh\n      - name: Coverage tools\n        run: |\n          cargo install cargo-llvm-cov --version 0.8.7 --locked\n          rustup toolchain install ${nightly}\n`,
  );
  await put(
    root,
    ".github/workflows/mutation.yml",
    "jobs:\n  backend:\n    steps:\n      - name: Install Rust toolchain\n        shell: bash\n        run: bash scripts/setup-rust.sh\n      - name: Install mutation tool\n        run: cargo install cargo-mutants --version 27.1.0 --locked\n",
  );
  await put(
    root,
    ".github/workflows/release.yml",
    "jobs:\n  release:\n    steps:\n      - name: Install Rust toolchain\n        shell: bash\n        run: bash scripts/setup-rust.sh\n      - name: Install macOS Rust targets\n        if: runner.os == 'macOS'\n        shell: bash\n        run: rustup target add aarch64-apple-darwin x86_64-apple-darwin\n",
  );
  await put(
    root,
    ".claude/skills/push/SKILL.md",
    `### Rust/Tauri backend\n\n\`\`\`bash\nbash scripts/setup-rust.sh\n\`\`\`\n\nUse the pinned \`${nightly}\` toolchain and \`cargo-llvm-cov\` 0.8.7.\n`,
  );
  await put(
    root,
    "rust-toolchain.toml",
    `[toolchain]\nchannel = "9.8.7"\ncomponents = ["rustfmt", "clippy", "llvm-tools"]\nprofile = "minimal"\n# Install ${nightly} for coverage.\n`,
  );
  await put(
    root,
    "scripts/setup-rust.sh",
    '#!/usr/bin/env bash\nset -euo pipefail\nif [[ ! -f rust-toolchain.toml ]]; then\n  echo "missing rust-toolchain.toml" >&2\n  exit 1\nfi\nrustup toolchain install --no-self-update\nrustup show active-toolchain\n',
  );
  return root;
}

async function checkedInRustFixture(t) {
  const root = await mkdtemp(join(tmpdir(), "rust-toolchain-contract-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  gitInit(root);
  for (const path of rustContractPaths) {
    await put(root, path, await readFile(join(repositoryRoot, path), "utf8"));
  }
  assert.deepEqual(await checkToolVersionParity(root), []);
  return root;
}

async function mutateCheckedInFile(t, path, mutate) {
  const root = await checkedInRustFixture(t);
  const original = await readFile(join(root, path), "utf8");
  const changed = mutate(original);
  assert.notEqual(changed, original, `mutation did not change ${path}`);
  await put(root, path, changed);
  assert.notDeepEqual(await checkToolVersionParity(root), []);
}

function replaceRustChannel(text, channel) {
  const assignment = /^channel\s*=\s*["'][^"']+["']\s*$/mu;
  assert.match(text, assignment);
  return text.replace(assignment, `channel = "${channel}"`);
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
  assert.match(findings, /.claude\/skills\/push\/SKILL.md:\d+ declares "0.8.7"/u);
});

test("reports the executable nightly authority and every mismatching restatement", async () => {
  const root = await fixture();
  await put(root, "scripts/rust-coverage.mjs", 'const toolchain = "nightly-2025-06-02";\n');
  const findings = (await checkToolVersionParity(root)).join("\n");
  assert.match(findings, /nightly toolchain mismatch/u);
  assert.match(findings, /authority scripts\/rust-coverage.mjs:1 declares "nightly-2025-06-02"/u);
  assert.match(findings, /.github\/workflows\/test.yml:\d+ declares "nightly-2025-06-01"/u);
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

test("a vanished listed file is skipped rather than crashing the checker", async () => {
  const root = await fixture();
  await assert.doesNotReject(() =>
    discoverToolVersions(root, undefined, { listFiles: () => ["missing-file.rs"] }),
  );
});

test("accepts the checked-in Rust toolchain contract", async (t) => {
  await checkedInRustFixture(t);
});

test("rejects a missing Rust toolchain file", async (t) => {
  const root = await checkedInRustFixture(t);
  await rm(join(root, "rust-toolchain.toml"));
  const findings = (await checkToolVersionParity(root)).join("\n");
  assert.match(findings, /rust-toolchain\.toml: required Rust toolchain contract file is missing/u);
});

test("accepts another exact stable Rust version from the toolchain file alone", async (t) => {
  const root = await checkedInRustFixture(t);
  const path = join(root, "rust-toolchain.toml");
  await put(
    root,
    "rust-toolchain.toml",
    replaceRustChannel(await readFile(path, "utf8"), "9.87.6"),
  );
  assert.deepEqual(await checkToolVersionParity(root), []);
});

test("rejects every floating, partial, nightly, or prerelease Rust channel", async (t) => {
  for (const channel of [
    "stable",
    "beta",
    "nightly",
    "1.98",
    "nightly-2025-06-01",
    "1.98.0-beta.1",
  ]) {
    await t.test(channel, (subtest) =>
      mutateCheckedInFile(subtest, "rust-toolchain.toml", (text) =>
        replaceRustChannel(text, channel),
      ),
    );
  }
});

test("rejects removal of every required Rust component", async (t) => {
  for (const component of ["rustfmt", "clippy", "llvm-tools"]) {
    await t.test(component, (subtest) =>
      mutateCheckedInFile(subtest, "rust-toolchain.toml", (text) =>
        text.replace(`"${component}", `, "").replace(`, "${component}"`, ""),
      ),
    );
  }
});

const workflowSetups = [
  {
    path: ".github/workflows/test.yml",
    original:
      "      - name: Install Rust toolchain\n        uses: dtolnay/rust-toolchain@stable\n        with:\n          components: rustfmt, clippy, llvm-tools-preview",
  },
  {
    path: ".github/workflows/mutation.yml",
    original: "      - name: Install Rust toolchain\n        uses: dtolnay/rust-toolchain@stable",
  },
  {
    path: ".github/workflows/release.yml",
    original:
      "      - name: Rust setup\n        uses: dtolnay/rust-toolchain@4360b52568e2003a75bf9bc1d59f33a8e3fc893c # stable\n        with:\n          targets: ${{ matrix.platform == 'macos-latest' && 'aarch64-apple-darwin,x86_64-apple-darwin' || '' }}",
  },
];
const sharedSetupBlock =
  "      - name: Install Rust toolchain\n        shell: bash\n        run: bash scripts/setup-rust.sh";

test("rejects every workflow reverted to its original floating action", async (t) => {
  for (const { path, original } of workflowSetups) {
    await t.test(path, (subtest) =>
      mutateCheckedInFile(subtest, path, (text) => text.replace(sharedSetupBlock, original)),
    );
  }
});

test("rejects deletion and no-op replacement of every workflow setup", async (t) => {
  for (const { path } of workflowSetups) {
    await t.test(`${path} deleted`, (subtest) =>
      mutateCheckedInFile(subtest, path, (text) => text.replace(`${sharedSetupBlock}\n`, "")),
    );
    await t.test(`${path} no-op`, (subtest) =>
      mutateCheckedInFile(subtest, path, (text) =>
        text.replace("        run: bash scripts/setup-rust.sh", "        run: :"),
      ),
    );
  }
});

test("rejects removal of either required setup command", async (t) => {
  for (const command of [
    "rustup toolchain install --no-self-update\n",
    "rustup show active-toolchain\n",
  ]) {
    await t.test(command.trim(), (subtest) =>
      mutateCheckedInFile(subtest, "scripts/setup-rust.sh", (text) => text.replace(command, "")),
    );
  }
});

test("rejects removal of either macOS release target", async (t) => {
  for (const target of ["aarch64-apple-darwin", "x86_64-apple-darwin"]) {
    await t.test(target, (subtest) =>
      mutateCheckedInFile(subtest, ".github/workflows/release.yml", (text) =>
        text.replace(
          "run: rustup target add aarch64-apple-darwin x86_64-apple-darwin",
          `run: rustup target add ${
            target === "aarch64-apple-darwin" ? "x86_64-apple-darwin" : "aarch64-apple-darwin"
          }`,
        ),
      ),
    );
  }
});

test("rejects an unconditional macOS target step", async (t) => {
  await mutateCheckedInFile(t, ".github/workflows/release.yml", (text) =>
    text.replace("        if: runner.os == 'macOS'\n", ""),
  );
});

function isolatedRustupEnvironment(root, rustupHome) {
  const environment = {
    ...process.env,
    RUSTUP_DIST_SERVER: pathToFileURL(join(root, "absent-dist")).href,
    RUSTUP_HOME: rustupHome,
  };
  delete environment.RUSTUP_TOOLCHAIN;
  return environment;
}

test("real setup refuses a missing toolchain file with its diagnostic", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "rust-setup-missing-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await put(
    root,
    "scripts/setup-rust.sh",
    await readFile(join(repositoryRoot, "scripts/setup-rust.sh"), "utf8"),
  );
  const result = spawnSync("bash", ["scripts/setup-rust.sh"], {
    cwd: root,
    encoding: "utf8",
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /rust-toolchain\.toml/u);
});

test("real setup propagates an offline unavailable-toolchain failure", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "rust-setup-offline-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const rustupHome = join(root, "rustup-home");
  await mkdir(rustupHome);
  const setup = await readFile(join(repositoryRoot, "scripts/setup-rust.sh"), "utf8");
  await put(root, "scripts/setup-rust.sh", setup);
  await put(
    root,
    "rust-toolchain.toml",
    '[toolchain]\nchannel = "0.0.0"\ncomponents = ["rustfmt", "clippy", "llvm-tools"]\nprofile = "minimal"\n',
  );
  const result = spawnSync("bash", ["scripts/setup-rust.sh"], {
    cwd: root,
    encoding: "utf8",
    env: isolatedRustupEnvironment(root, rustupHome),
  });
  assert.notEqual(result.status, 0);
});

test("negative control proves plain rustup show would hide the unavailable pin", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "rust-setup-negative-control-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const rustupHome = join(root, "rustup-home");
  await mkdir(rustupHome);
  const setup = await readFile(join(repositoryRoot, "scripts/setup-rust.sh"), "utf8");
  const negativeControl = setup.replace(
    "rustup toolchain install --no-self-update\nrustup show active-toolchain",
    "rustup show",
  );
  assert.notEqual(negativeControl, setup);
  await put(root, "scripts/setup-rust.sh", negativeControl);
  await put(
    root,
    "rust-toolchain.toml",
    '[toolchain]\nchannel = "0.0.0"\ncomponents = ["rustfmt", "clippy", "llvm-tools"]\nprofile = "minimal"\n',
  );
  const result = spawnSync("bash", ["scripts/setup-rust.sh"], {
    cwd: root,
    encoding: "utf8",
    env: isolatedRustupEnvironment(root, rustupHome),
  });
  assert.equal(result.status, 0, result.stderr);
});
