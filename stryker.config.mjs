import { mutationPackages } from "./scripts/frontend-mutation-packages.mjs";

const mutationPackage = process.env.STRYKER_PACKAGE;
if (!mutationPackages[mutationPackage])
  throw new Error(`Unknown or missing STRYKER_PACKAGE: ${mutationPackage ?? "<missing>"}`);

/** @type {import("@stryker-mutator/api/core").PartialStrykerOptions} */
const config = {
  plugins: ["@stryker-mutator/vitest-runner"],
  mutate: mutationPackages[mutationPackage],
  testRunner: "vitest",
  vitest: {
    configFile: "vite.config.ts",
    related: true,
  },
  coverageAnalysis: "perTest",
  concurrency: 2,
  thresholds: {
    high: 100,
    low: 100,
    break: 100,
  },
  reporters: ["clear-text", "progress", "json", "html"],
  // Stryker keeps the sandbox on a thrown error to allow a post-mortem, and
  // nothing ever collects it (core/dist/src/stryker.js: `if (cleanTempDir !==
  // 'always') removeDuringDisposal = false`). Four such sandboxes from
  // 2026-08-09 were still on disk on 08-13, one of them 39 GB. The reports we
  // actually read land in artifacts/mutation/, so the sandbox is no loss.
  // Note this cannot help when the process is killed outright — dispose() never
  // runs then. run-frontend-mutation.mjs purges the temp dir on start for that.
  cleanTempDir: "always",
  // LOAD-BEARING, do not trim. Stryker only ever ignores node_modules, .git,
  // /reports, *.tsbuildinfo, /stryker.log and .stryker-tmp by itself —
  // src-tauri/target is NOT among them. Without the entry below, every sandbox
  // gets a full copy of the Rust target directory, three per frontend run.
  ignorePatterns: [
    "artifacts/**",
    "backend-coverage/**",
    "coverage/**",
    "dist/**",
    "e2e/**",
    "mutants.out/**",
    "playwright-report/**",
    "src-tauri/target/**",
    "test-results/**",
  ],
  jsonReporter: {
    fileName: `artifacts/mutation/frontend/${mutationPackage}/mutation.json`,
  },
  htmlReporter: {
    fileName: `artifacts/mutation/frontend/${mutationPackage}/index.html`,
  },
  tempDirName: ".stryker-tmp",
};

export default config;
