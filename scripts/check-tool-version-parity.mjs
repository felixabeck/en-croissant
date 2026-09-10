import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { globToRegExp } from "./coverage-scope.mjs";
import { workflowSteps } from "./check-gate-routing.mjs";
import { isEntrypoint } from "./entrypoint.mjs";
import { listWorkingTreeFiles } from "./working-tree-files.mjs";

const TEST_FILE_GLOBS = ["scripts/*-tests.mjs", "scripts/*.test.mjs"];
const REQUIRED_RUST_COMPONENTS = ["rustfmt", "clippy", "llvm-tools"];
const EXACT_STABLE_RUST_CHANNEL = /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/u;
const RUST_WORKFLOW_JOBS = [
  [".github/workflows/test.yml", "test"],
  [".github/workflows/mutation.yml", "backend"],
  [".github/workflows/release.yml", "release"],
];

export const PARITY_FAMILIES = [
  {
    name: "nightly toolchain",
    minimumSites: 2,
    declarations: [
      {
        globs: ["scripts/*.mjs"],
        // Any exported or local const holding the pin, so extracting it into a shared
        // module keeps the authority rather than losing it. Binding to one identifier
        // name made the authority vanish the moment the constant moved.
        pattern: /\bconst\s+\w+\s*=\s*["'](nightly-\d{4}-\d{2}-\d{2})["']/gu,
        authority: true,
        exclude: TEST_FILE_GLOBS,
      },
      {
        globs: [".github/workflows/*.yml", ".github/workflows/*.yaml"],
        pattern: /rustup\s+toolchain\s+install\s+(nightly-\d{4}-\d{2}-\d{2})\b/gu,
      },
      {
        globs: [".claude/skills/*/SKILL.md", "*.toml"],
        pattern: /\b(nightly-\d{4}-\d{2}-\d{2})\b/gu,
      },
    ],
  },
  {
    name: "cargo-llvm-cov",
    minimumSites: 2,
    declarations: [
      {
        globs: [".github/workflows/*.yml", ".github/workflows/*.yaml"],
        pattern: /cargo\s+install\s+cargo-llvm-cov\s+--version\s+(\d+\.\d+\.\d+)\b/gu,
        authority: true,
      },
      {
        globs: [".claude/skills/*/SKILL.md"],
        pattern: /cargo-llvm-cov`?\s+(\d+\.\d+\.\d+)\b/gu,
      },
    ],
  },
  {
    name: "cargo-mutants",
    minimumSites: 1,
    declarations: [
      {
        globs: [".github/workflows/*.yml", ".github/workflows/*.yaml"],
        pattern: /cargo\s+install\s+cargo-mutants\s+--version\s+(\d+\.\d+\.\d+)\b/gu,
        authority: true,
      },
    ],
  },
];

function lineNumber(text, offset) {
  return text.slice(0, offset).split("\n").length;
}

function siteLabel(site) {
  return `${site.path}:${site.line}`;
}

function defaultListFiles(repoRoot) {
  return listWorkingTreeFiles({ workspaceRoot: repoRoot, pathspec: "." });
}

async function contractFile(repoRoot, path, findings) {
  try {
    return await readFile(resolve(repoRoot, path), "utf8");
  } catch (error) {
    if (error?.code === "ENOENT") {
      findings.push(`${path}: required Rust toolchain contract file is missing`);
      return undefined;
    }
    throw error;
  }
}

function workflowJob(text, path, jobName, findings) {
  const lines = text.split(/\r?\n/u);
  const start = lines.findIndex((line) => line === `  ${jobName}:`);
  if (start < 0) {
    findings.push(`${path}: required Rust job ${jobName} is missing`);
    return undefined;
  }
  let end = start + 1;
  while (end < lines.length && !/^  [\w.-]+:\s*$/u.test(lines[end])) end += 1;
  return lines.slice(start, end).join("\n");
}

export async function checkRustToolchainContract(repoRoot) {
  const findings = [];
  const toolchain = await contractFile(repoRoot, "rust-toolchain.toml", findings);
  if (toolchain !== undefined) {
    const channel = /^channel\s*=\s*["']([^"']+)["']\s*$/mu.exec(toolchain)?.[1];
    if (channel === undefined || !EXACT_STABLE_RUST_CHANNEL.test(channel)) {
      findings.push(
        `rust-toolchain.toml: channel must be a complete stable numeric major.minor.patch pin; found ${JSON.stringify(channel ?? "missing")}`,
      );
    }
    const componentLine = /^components\s*=\s*\[([^\]]*)\]\s*$/mu.exec(toolchain)?.[1];
    const components = componentLine
      ? [...componentLine.matchAll(/["']([^"']+)["']/gu)].map((match) => match[1])
      : [];
    for (const component of REQUIRED_RUST_COMPONENTS) {
      if (!components.includes(component)) {
        findings.push(`rust-toolchain.toml: required component ${component} is missing`);
      }
    }
    if (!/^profile\s*=\s*["']minimal["']\s*$/mu.test(toolchain)) {
      findings.push('rust-toolchain.toml: profile must be "minimal"');
    }
  }

  const setup = await contractFile(repoRoot, "scripts/setup-rust.sh", findings);
  if (setup !== undefined) {
    if (!setup.startsWith("#!/usr/bin/env bash\nset -euo pipefail\n")) {
      findings.push("scripts/setup-rust.sh: must start with the reviewed strict-bash preamble");
    }
    if (
      !/^if \[\[ ! -f rust-toolchain\.toml \]\]; then\n  echo .*rust-toolchain\.toml.* >&2\n  exit 1\nfi$/mu.test(
        setup,
      )
    ) {
      findings.push(
        "scripts/setup-rust.sh: missing nonzero rust-toolchain.toml guard and stderr diagnostic",
      );
    }
    if (!/^rustup toolchain install --no-self-update$/mu.test(setup)) {
      findings.push(
        "scripts/setup-rust.sh: must install from rust-toolchain.toml with rustup toolchain install --no-self-update and no channel argument",
      );
    }
    if (!/^rustup show active-toolchain$/mu.test(setup)) {
      findings.push("scripts/setup-rust.sh: must report rustup show active-toolchain");
    }
  }

  for (const [path, jobName] of RUST_WORKFLOW_JOBS) {
    const workflow = await contractFile(repoRoot, path, findings);
    if (workflow === undefined) continue;
    const job = workflowJob(workflow, path, jobName, findings);
    if (job === undefined) continue;
    const setupSteps = workflowSteps(job).filter(
      (step) => step.name === "Install Rust toolchain" && step.run === "bash scripts/setup-rust.sh",
    );
    const exactSetupBlock =
      /^      - name: Install Rust toolchain\n        shell: bash\n        run: bash scripts\/setup-rust\.sh(?=\n(?:\s*\n|      - )|$)/gmu;
    if (setupSteps.length !== 1 || [...job.matchAll(exactSetupBlock)].length !== 1) {
      findings.push(
        `${path}: job ${jobName} must contain exactly one explicit bash scripts/setup-rust.sh setup step`,
      );
    }
    if (/dtolnay\/rust-toolchain@/u.test(job)) {
      findings.push(`${path}: job ${jobName} must not use dtolnay/rust-toolchain`);
    }
  }

  const release = await contractFile(repoRoot, ".github/workflows/release.yml", findings);
  if (release !== undefined) {
    const releaseJob = workflowJob(release, ".github/workflows/release.yml", "release", findings);
    const targetBlock =
      /^      - name: Install macOS Rust targets\n        if: runner\.os == 'macOS'\n        shell: bash\n        run: rustup target add aarch64-apple-darwin x86_64-apple-darwin(?=\n(?:\s*\n|      - )|$)/gmu;
    if (releaseJob !== undefined && [...releaseJob.matchAll(targetBlock)].length !== 1) {
      findings.push(
        ".github/workflows/release.yml: release must add both existing macOS targets in the reviewed macOS-only bash step",
      );
    }
  }

  const pushSkill = await contractFile(repoRoot, ".claude/skills/push/SKILL.md", findings);
  if (pushSkill !== undefined) {
    const rustSection = /### Rust\/Tauri backend\n([\s\S]*?)(?=\n### |\n## |$)/u.exec(
      pushSkill,
    )?.[1];
    const setupCommands = rustSection?.match(/^bash scripts\/setup-rust\.sh$/gmu) ?? [];
    if (setupCommands.length !== 1) {
      findings.push(
        ".claude/skills/push/SKILL.md: Rust gate fence must contain bash scripts/setup-rust.sh exactly once",
      );
    }
  }

  return findings.sort();
}

export async function discoverToolVersions(
  repoRoot,
  families = PARITY_FAMILIES,
  { listFiles = defaultListFiles } = {},
) {
  const root = resolve(repoRoot);
  const files = listFiles(root).map((relative) => ({
    absolute: resolve(root, relative),
    relative,
  }));
  const contents = new Map();
  const results = [];

  for (const family of families) {
    const sites = [];
    for (const declaration of family.declarations) {
      const includes = declaration.globs.map(globToRegExp);
      const excludes = (declaration.exclude ?? []).map(globToRegExp);
      for (const file of files) {
        if (!includes.some((matcher) => matcher.test(file.relative))) continue;
        if (excludes.some((matcher) => matcher.test(file.relative))) continue;
        if (!contents.has(file.absolute)) {
          let text;
          try {
            text = await readFile(file.absolute, "utf8");
          } catch (error) {
            if (error?.code === "ENOENT") continue;
            throw error;
          }
          contents.set(file.absolute, text);
        }
        const text = contents.get(file.absolute);
        for (const match of text.matchAll(declaration.pattern)) {
          sites.push({
            path: file.relative,
            line: lineNumber(text, match.index),
            value: match[1],
            authority: declaration.authority === true,
          });
        }
      }
    }
    results.push({ ...family, sites });
  }
  return results;
}

export async function checkToolVersionParity(repoRoot, families = PARITY_FAMILIES, options = {}) {
  const findings = await checkRustToolchainContract(repoRoot);
  for (const family of await discoverToolVersions(repoRoot, families, options)) {
    if (family.sites.length < family.minimumSites) {
      const globs = family.declarations.flatMap((declaration) => declaration.globs).join(", ");
      findings.push(
        `${family.name}: expected at least ${family.minimumSites} declaration site(s) matching ${globs}; found ${family.sites.length}`,
      );
    }

    const authorities = family.sites.filter((site) => site.authority);
    if (authorities.length !== 1) {
      findings.push(
        `${family.name}: expected exactly one authority; found ${authorities.length}${
          authorities.length > 0
            ? ` (${authorities.map((site) => siteLabel(site)).join(", ")})`
            : ""
        }`,
      );
      continue;
    }

    const authority = authorities[0];
    for (const site of family.sites) {
      if (site === authority || site.value === authority.value) continue;
      findings.push(
        `${family.name} mismatch: authority ${siteLabel(authority)} declares ${JSON.stringify(authority.value)}; ${siteLabel(site)} declares ${JSON.stringify(site.value)}`,
      );
    }
  }
  return findings.sort();
}

async function main() {
  const findings = await checkToolVersionParity(process.cwd());
  if (findings.length > 0) {
    console.error("Tool version parity check: FAIL");
    for (const finding of findings) console.error(`  * ${finding}`);
    return 1;
  }
  console.log("Tool version parity check: OK");
  return 0;
}

if (isEntrypoint(import.meta.url)) {
  main()
    .then((status) => {
      process.exitCode = status;
    })
    .catch((error) => {
      console.error(error instanceof Error ? error.message : error);
      process.exitCode = 2;
    });
}
