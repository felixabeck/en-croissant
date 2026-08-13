import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const diffResult = spawnSync("git", ["diff", "--unified=0", "--", "src"], {
  encoding: "utf8",
});
const untrackedResult = spawnSync(
  "git",
  ["ls-files", "--others", "--exclude-standard", "--", "src"],
  {
    encoding: "utf8",
  },
);
const trackedResult = spawnSync("git", ["ls-files", "--", "src"], { encoding: "utf8" });
if (diffResult.status !== 0 || untrackedResult.status !== 0 || trackedResult.status !== 0) {
  process.exit(diffResult.status ?? untrackedResult.status ?? trackedResult.status ?? 1);
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

let diffFile = "";
for (const line of diffResult.stdout.split("\n")) {
  if (line.startsWith("+++ b/")) {
    diffFile = line.slice(6);
    continue;
  }
  if (!line.startsWith("+") || line.startsWith("+++")) continue;
  inspectAddedLine(diffFile, line.slice(1));
}

for (const file of untrackedResult.stdout.split("\n").filter(Boolean)) {
  if (/\.test\.[jt]sx?$/.test(file)) continue;
  for (const line of readFileSync(file, "utf8").split("\n")) {
    inspectAddedLine(file, line);
  }
}

const sourceFiles = new Set([
  ...trackedResult.stdout.split("\n"),
  ...untrackedResult.stdout.split("\n"),
]);
for (const file of sourceFiles) {
  if (
    file.endsWith(".tsx") &&
    !/\.test\.tsx$/.test(file) &&
    file !== "src/components/common/AppModal.tsx"
  ) {
    for (const line of readFileSync(file, "utf8").split("\n")) {
      if (modalImport.test(line)) {
        violations.push(`${file}: direct Modal import; use AppModal instead`);
      }
    }
  }
  if (!file.endsWith(".css")) continue;
  for (const line of readFileSync(file, "utf8").split("\n")) {
    if (unsafeFocusReset.test(line)) {
      violations.push(
        `${file}: unsafe focus reset; use explicit reset properties and :focus-visible`,
      );
    }
  }
}

if (violations.length) {
  console.error("UI boundary violations:\n" + violations.join("\n"));
  process.exit(1);
}
