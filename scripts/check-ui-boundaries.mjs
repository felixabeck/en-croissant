import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const untrackedResult = spawnSync(
  "git",
  ["ls-files", "--others", "--exclude-standard", "--", "src"],
  {
    encoding: "utf8",
  },
);
const trackedResult = spawnSync("git", ["ls-files", "--", "src"], { encoding: "utf8" });
if (untrackedResult.status !== 0 || trackedResult.status !== 0) {
  process.exit(untrackedResult.status ?? trackedResult.status ?? 1);
}

const violations = [];
const actionIconImport = /import\s*\{[^}]*\bActionIcon\b[^}]*\}\s*from\s*["']@mantine\/core["']/;
const modalImport = /import\s*\{[^}]*\bModal\b[^}]*\}\s*from\s*["']@mantine\/core["']/;
const unsafeFocusReset = /\b(all\s*:\s*unset|outline\s*:\s*(?:none|0(?:px)?))\b/;

function inspectAddedLine(file, line) {
  if (
    actionIconImport.test(line) &&
    file !== "src/components/common/IconAction.tsx" &&
    file !== "src/styles/theme.ts"
  ) {
    violations.push(`${file}: direct ActionIcon import; use IconAction instead`);
  }
  if (unsafeFocusReset.test(line)) {
    violations.push(`${file}: unsafe focus reset; preserve or restore :focus-visible`);
  }
  if (modalImport.test(line) && file !== "src/components/common/AppModal.tsx") {
    violations.push(`${file}: direct Modal import; use AppModal instead`);
  }
}

const sourceFiles = new Set(
  [...trackedResult.stdout.split("\n"), ...untrackedResult.stdout.split("\n")].filter(Boolean),
);

// Whole tree, not the diff. These two rules used to inspect only lines added in
// `git diff -- src` plus untracked files, which made them silently vacuous wherever the
// checkout is clean — every CI run, since CI checks out and never edits. The rules are
// invariants ("no direct ActionIcon import anywhere", "no unsafe focus reset anywhere"),
// not properties of a diff, so scanning the tree is both correct and strictly stronger:
// `readFileSync` reads the working tree, so uncommitted edits are still covered.
for (const file of sourceFiles) {
  if (!/\.(tsx?|css)$/.test(file)) continue;
  if (/\.test\.[jt]sx?$/.test(file)) continue;
  for (const line of readFileSync(file, "utf8").split("\n")) {
    inspectAddedLine(file, line);
  }
}

for (const file of sourceFiles) {
  if (!file.endsWith(".css")) continue;
  for (const line of readFileSync(file, "utf8").split("\n")) {
    if (unsafeFocusReset.test(line)) {
      violations.push(
        `${file}: unsafe focus reset; use explicit reset properties and :focus-visible`,
      );
    }
  }
}

const unique = [...new Set(violations)];
violations.length = 0;
violations.push(...unique);

if (violations.length) {
  console.error("UI boundary violations:\n" + violations.join("\n"));
  process.exit(1);
}
