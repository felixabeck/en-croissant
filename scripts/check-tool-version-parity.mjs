import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { globToRegExp } from "./coverage-scope.mjs";
import { listWorkingTreeFiles } from "./working-tree-files.mjs";

const TEST_FILE_GLOBS = ["scripts/*-tests.mjs", "scripts/*.test.mjs"];

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

export async function discoverToolVersions(
  repoRoot,
  families = PARITY_FAMILIES,
  { listFiles } = {},
) {
  const root = resolve(repoRoot);
  const files = (
    listFiles ?? (() => listWorkingTreeFiles({ workspaceRoot: root, pathspec: "." }))
  )().map((relative) => ({
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
          contents.set(file.absolute, await readFile(file.absolute, "utf8"));
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
  const findings = [];
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

if (import.meta.url === `file://${process.argv[1]}`) {
  main()
    .then((status) => {
      process.exitCode = status;
    })
    .catch((error) => {
      console.error(error instanceof Error ? error.message : error);
      process.exitCode = 2;
    });
}
