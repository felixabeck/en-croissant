import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { globToRegExp } from "./coverage-scope.mjs";
import { workflowJobs, workflowSteps } from "./check-gate-routing.mjs";
import { isEntrypoint } from "./entrypoint.mjs";
import { listWorkingTreeFiles } from "./working-tree-files.mjs";

const TEST_FILE_GLOBS = ["scripts/*-tests.mjs", "scripts/*.test.mjs"];
const REQUIRED_RUST_COMPONENTS = ["rustfmt", "clippy", "llvm-tools"];
const COMPLETE_NUMERIC_RUST_VERSION = /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/u;
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

async function contractFile(repoRoot, path, findings, contents) {
  const absolute = resolve(repoRoot, path);
  if (contents.has(absolute)) return contents.get(absolute);
  try {
    const text = await readFile(absolute, "utf8");
    contents.set(absolute, text);
    return text;
  } catch (error) {
    if (error?.code === "ENOENT") {
      findings.push(`${path}: required Rust toolchain contract file is missing`);
      return undefined;
    }
    throw error;
  }
}

function requiredWorkflowJob(jobs, path, jobName, findings) {
  const job = jobs.find((candidate) => candidate.name === jobName);
  if (job === undefined) findings.push(`${path}: required Rust job ${jobName} is missing`);
  return job;
}

function isFailureTolerant(value) {
  return value !== undefined && value !== "false";
}

function declaresRustupToolchain(workflow) {
  if (/^[^#\n]*["']?RUSTUP_TOOLCHAIN["']?\s*:/mu.test(workflow)) return true;
  return workflowSteps(workflow).some((step) =>
    /(?:^|\n|[;&|])\s*(?:(?:export|env)\s+)?RUSTUP_TOOLCHAIN\s*=/u.test(step.run),
  );
}

export async function checkRustToolchainContract(repoRoot, { contents = new Map() } = {}) {
  const findings = [];
  const toolchain = await contractFile(repoRoot, "rust-toolchain.toml", findings, contents);
  if (toolchain !== undefined) {
    const channel = /^channel\s*=\s*["']([^"']+)["']\s*$/mu.exec(toolchain)?.[1];
    if (channel === undefined || !COMPLETE_NUMERIC_RUST_VERSION.test(channel)) {
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

  const setup = await contractFile(repoRoot, "scripts/setup-rust.sh", findings, contents);
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

  const workflows = new Map();
  for (const [path] of RUST_WORKFLOW_JOBS) {
    const workflow = await contractFile(repoRoot, path, findings, contents);
    if (workflow !== undefined) workflows.set(path, { jobs: workflowJobs(workflow), workflow });
  }

  for (const [path, jobName] of RUST_WORKFLOW_JOBS) {
    const parsed = workflows.get(path);
    if (parsed === undefined) continue;
    const { jobs, workflow } = parsed;
    if (declaresRustupToolchain(workflow)) {
      findings.push(
        `${path}: must not declare RUSTUP_TOOLCHAIN in repository workflow configuration`,
      );
    }
    const job = requiredWorkflowJob(jobs, path, jobName, findings);
    if (job === undefined) continue;
    const setupSteps = workflowSteps(job.body).filter(
      (step) => step.run === "bash scripts/setup-rust.sh",
    );
    if (
      setupSteps.length !== 1 ||
      setupSteps[0].shell !== "bash" ||
      setupSteps[0].hasIf ||
      isFailureTolerant(setupSteps[0].continueOnError)
    ) {
      findings.push(
        `${path}: job ${jobName} must contain exactly one unconditional, failure-propagating bash scripts/setup-rust.sh step with shell bash`,
      );
    }
    if (/dtolnay\/rust-toolchain@/u.test(job.body)) {
      findings.push(`${path}: job ${jobName} must not use dtolnay/rust-toolchain`);
    }
  }

  const release = workflows.get(".github/workflows/release.yml");
  if (release !== undefined) {
    const releaseJob = release.jobs.find((job) => job.name === "release");
    const targetSteps =
      releaseJob === undefined
        ? []
        : workflowSteps(releaseJob.body).filter(
            (step) => step.run === "rustup target add aarch64-apple-darwin x86_64-apple-darwin",
          );
    if (
      releaseJob !== undefined &&
      (targetSteps.length !== 1 ||
        targetSteps[0].shell !== "bash" ||
        targetSteps[0].ifValue !== "runner.os == 'macOS'" ||
        isFailureTolerant(targetSteps[0].continueOnError))
    ) {
      findings.push(
        ".github/workflows/release.yml: release must add both existing macOS targets in exactly one macOS-only, failure-propagating step with shell bash",
      );
    }
  }

  const pushSkill = await contractFile(
    repoRoot,
    ".claude/skills/push/SKILL.md",
    findings,
    contents,
  );
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
  { contents = new Map(), listFiles = defaultListFiles } = {},
) {
  const root = resolve(repoRoot);
  const files = listFiles(root).map((relative) => ({
    absolute: resolve(root, relative),
    relative,
  }));
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
  const contents = options.contents ?? new Map();
  const findings = await checkRustToolchainContract(repoRoot, { contents });
  for (const family of await discoverToolVersions(repoRoot, families, { ...options, contents })) {
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
