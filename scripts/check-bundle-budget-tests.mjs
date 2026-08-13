import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { gzipSync } from "node:zlib";
import { assertBundleBudget, buildBundleReport } from "./check-bundle-budget.mjs";

const manifest = {
  "index.html": {
    file: "assets/entry.js",
    isEntry: true,
    imports: ["shared"],
    dynamicImports: ["src/routes/workspace.lazy.tsx", "src/translation/de-DE.json"],
    css: ["assets/entry.css"],
  },
  shared: { file: "assets/shared.js" },
  "src/routes/workspace.lazy.tsx": {
    file: "assets/workspace.js",
    imports: ["shared", "feature"],
    css: ["assets/workspace.css"],
  },
  feature: { file: "assets/feature.js" },
  "src/translation/de-DE.json": { file: "assets/de-DE.js" },
};

const payloads = {
  "assets/entry.js": "entry".repeat(100),
  "assets/shared.js": "shared".repeat(100),
  "assets/entry.css": "entry-style".repeat(100),
  "assets/workspace.js": "workspace".repeat(150),
  "assets/feature.js": "feature".repeat(200),
  "assets/workspace.css": "workspace-style".repeat(120),
  "assets/de-DE.js": "locale".repeat(80),
};

async function fixture() {
  const outputDirectory = await mkdtemp(join(tmpdir(), "bundle-budget-"));
  await mkdir(join(outputDirectory, "assets"));
  await Promise.all(
    Object.entries(payloads).map(([file, contents]) =>
      writeFile(join(outputDirectory, file), contents),
    ),
  );
  return outputDirectory;
}

function gzipBytes(files) {
  return files.reduce((total, file) => total + gzipSync(payloads[file]).byteLength, 0);
}

test("measures the entry closure, incremental lazy route, and unique total assets", async () => {
  const outputDirectory = await fixture();
  const report = await buildBundleReport({ manifest, outputDirectory });

  assert.equal(
    report.entry,
    gzipBytes(["assets/entry.js", "assets/shared.js", "assets/entry.css"]),
  );
  assert.equal(
    report.largestLazy,
    gzipBytes(["assets/workspace.js", "assets/feature.js", "assets/workspace.css"]),
  );
  assert.equal(report.largestLazyId, "src/routes/workspace.lazy.tsx");
  assert.equal(report.total, gzipBytes(Object.keys(payloads)));
});

test("rejects bundle regressions with the affected metric", () => {
  const report = { entry: 10, largestLazy: 20, total: 30 };
  const budget = {
    version: 1,
    unit: "gzipBytes",
    limits: { entry: 10, largestLazy: 19, total: 30 },
  };
  assert.throws(() => assertBundleBudget(report, budget), /largestLazy bundle budget exceeded/);
});

test("rejects manifest asset traversal before reading outside the build directory", async () => {
  const outputDirectory = await fixture();
  await assert.rejects(
    () =>
      buildBundleReport({
        manifest: {
          "index.html": { file: "../outside.js", isEntry: true },
        },
        outputDirectory,
      }),
    /escapes output directory/,
  );
});
