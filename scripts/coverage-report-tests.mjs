import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative, sep } from "node:path";
import test from "node:test";
import {
  assertAreaFloors,
  assertBaseline,
  assignArea,
  buildCoverageReport,
  parseLcov,
  scopeSignature,
  writeBaseline,
} from "./coverage-report.mjs";

const config = {
  version: 1,
  sources: [
    {
      id: "frontend",
      root: "src",
      include: ["src/**/*.ts"],
      exclude: [{ pattern: "src/**/tests/**" }],
    },
  ],
  areas: [{ id: "utilities", source: "frontend", paths: ["src/utils/**"] }],
};
const lcov = `TN:\nSF:src/utils/example.ts\nFN:1,example\nFNDA:1,example\nDA:1,1\nDA:2,0\nBRDA:1,0,0,1\nBRDA:1,0,1,0\nend_of_record\n`;
const duplicateFunctionLcov = `TN:\nSF:src/utils/example.ts\nFN:1,handler\nFN:10,handler\nFNDA:1,handler\nFNDA:0,handler\nDA:1,1\nDA:10,0\nend_of_record\n`;

async function fixture({ source = "export const example = 1;\n" } = {}) {
  const root = await mkdtemp(join(tmpdir(), "coverage-report-"));
  await mkdir(join(root, "src", "utils"), { recursive: true });
  await writeFile(join(root, "src", "utils", "example.ts"), source);
  return { root };
}

function metrics(metric, covered, total) {
  return {
    lines: { covered: 2, total: 2 },
    functions: { covered: 1, total: 1 },
    branches: { covered: 1, total: 2 },
    [metric]: { covered, total },
  };
}

test("parses LCOV line, function, and branch totals", () => {
  assert.deepEqual(parseLcov(lcov), [
    {
      file: "src/utils/example.ts",
      metrics: {
        lines: { covered: 1, total: 2 },
        functions: { covered: 1, total: 1 },
        branches: { covered: 1, total: 2 },
      },
    },
  ]);
});

test("merges repeated source inputs by exact counter identity", () => {
  assert.deepEqual(parseLcov(`${lcov}${lcov}`), parseLcov(lcov));
});

test("matches same-named function data by declaration occurrence", () => {
  assert.deepEqual(parseLcov(duplicateFunctionLcov)[0].metrics.functions, {
    covered: 1,
    total: 2,
  });
});

test("assigns mapped files and rejects unmapped files", () => {
  assert.equal(assignArea("src/utils/example.ts", config).id, "utilities");
  assert.equal(assignArea("src/utils/chess/example.ts", config).id, "utilities");
  assert.throws(() => assignArea("src/other.ts", config), /Unmapped production file/);
});

test("preserves zero coverage as totals rather than dropping it", async () => {
  const { root } = await fixture();
  const report = await buildCoverageReport({
    config,
    lcov: lcov
      .replace("FNDA:1", "FNDA:0")
      .replace("DA:1,1", "DA:1,0")
      .replace("BRDA:1,0,0,1", "BRDA:1,0,0,0"),
    root,
  });
  assert.deepEqual(report.utilities, {
    lines: { covered: 0, total: 2 },
    functions: { covered: 0, total: 1 },
    branches: { covered: 0, total: 2 },
  });
});

test("rejects coverage regressions", () => {
  const report = {
    utilities: {
      lines: { covered: 1, total: 2 },
      functions: { covered: 1, total: 1 },
      branches: { covered: 1, total: 2 },
    },
  };
  const baseline = {
    version: 1,
    areas: {
      utilities: {
        lines: { covered: 2, total: 2 },
        functions: { covered: 1, total: 1 },
        branches: { covered: 1, total: 2 },
      },
    },
  };
  assert.throws(() => assertBaseline(report, baseline), /utilities lines regressed/);
});

test("rejects untested code added on top of an unchanged covered count", () => {
  assert.throws(
    () =>
      assertBaseline(
        { utilities: metrics("lines", 15, 659) },
        { version: 1, areas: { utilities: metrics("lines", 15, 653) } },
      ),
    /utilities lines regressed/,
  );
});

test("rejects narrowing the measured scope, which shrinks the total without deleting code", () => {
  const metrics = () => ({
    lines: { covered: 50, total: 90 },
    functions: { covered: 1, total: 1 },
    branches: { covered: 1, total: 2 },
  });
  const widened = {
    ...config,
    sources: [
      {
        ...config.sources[0],
        exclude: [...config.sources[0].exclude, "src/untested-thing.ts"],
      },
    ],
  };
  const baseline = {
    version: 1,
    scope: scopeSignature(config),
    areas: { utilities: { ...metrics(), lines: { covered: 50, total: 100 } } },
  };
  // Numbers alone would pass: covered is unchanged and the ratio rose.
  assert.doesNotThrow(() => assertBaseline({ utilities: metrics() }, baseline, config));
  assert.throws(
    () => assertBaseline({ utilities: metrics() }, baseline, widened),
    /measurement scope changed/,
  );
});

test("accepts a shrinking total when coverage rises", () => {
  // Covered rises and the ratio rises; only the denominator shrank, which is
  // observable here and must not count as a regression.
  assert.doesNotThrow(() =>
    assertBaseline(
      { utilities: metrics("branches", 77, 1048) },
      { version: 1, areas: { utilities: metrics("branches", 12, 1051) } },
    ),
  );
});

test("bounds the covered-count allowance by the total shrink and returns it", () => {
  assert.deepEqual(
    assertBaseline(
      { utilities: metrics("branches", 180, 5676) },
      { version: 1, areas: { utilities: metrics("branches", 181, 5677) } },
    ),
    [{ area: "utilities", metric: "branches", totalShrink: 1 }],
  );
  assert.throws(
    () =>
      assertBaseline(
        { utilities: metrics("branches", 179, 5676) },
        { version: 1, areas: { utilities: metrics("branches", 181, 5677) } },
      ),
    /utilities branches regressed/,
  );
});

test("reports no allowance for a shrink that never needed one", () => {
  // A shrinking total with rising coverage raises the ratio, so the
  // unadjusted rule already passes. Announcing an allowance here would claim
  // records were forgiven that were never at risk.
  assert.deepEqual(
    assertBaseline(
      { utilities: metrics("branches", 77, 1048) },
      { version: 1, areas: { utilities: metrics("branches", 12, 1051) } },
    ),
    [],
  );
});

test("keeps the current ratchets when the total does not shrink", () => {
  const baseline = { version: 1, areas: { utilities: metrics("lines", 15, 653) } };
  assert.throws(
    () => assertBaseline({ utilities: metrics("lines", 15, 659) }, baseline),
    /utilities lines regressed/,
  );
  assert.deepEqual(assertBaseline({ utilities: metrics("lines", 16, 653) }, baseline), []);
  assert.throws(
    () => assertBaseline({ utilities: metrics("lines", 14, 653) }, baseline),
    /utilities lines regressed/,
  );
  assert.throws(
    () => assertBaseline({ utilities: metrics("lines", 16, 700) }, baseline),
    /utilities lines regressed/,
  );
});

test("announces baseline allowances through the CLI", async () => {
  const { root } = await fixture();
  const sourcePath = relative(process.cwd(), join(root, "src")).split(sep).join("/");
  const config = {
    version: 1,
    sources: [
      {
        id: "frontend",
        root: join(root, "src"),
        include: [`${sourcePath}/**/*.ts`],
        exclude: [],
      },
    ],
    areas: [
      {
        id: "utilities",
        source: "frontend",
        minimumCoverage: { lines: 0, functions: 0, branches: 0 },
        paths: [`${sourcePath}/utils/**`],
      },
    ],
  };
  const baseline = {
    version: 1,
    scope: scopeSignature(config),
    areas: {
      utilities: {
        lines: { covered: 2, total: 2 },
        functions: { covered: 2, total: 2 },
        branches: { covered: 2, total: 2 },
      },
    },
  };
  const configPath = join(root, "config.json");
  const baselinePath = join(root, "baseline.json");
  const lcovPath = join(root, "lcov.info");
  await writeFile(configPath, JSON.stringify(config));
  await writeFile(baselinePath, JSON.stringify(baseline));
  await writeFile(
    lcovPath,
    `TN:\nSF:${join(root, "src", "utils", "example.ts")}\nFN:1,example\nFNDA:1,example\nDA:1,1\nBRDA:1,0,0,1\nend_of_record\n`,
  );

  const result = spawnSync(
    process.execPath,
    [
      join(process.cwd(), "scripts", "coverage-report.mjs"),
      "--config",
      configPath,
      "--baseline",
      baselinePath,
      "--lcov",
      lcovPath,
    ],
    { encoding: "utf8" },
  );
  assert.equal(result.status, 0, result.stderr);
  assert.match(
    result.stdout,
    /Coverage baseline allowance: utilities lines, 1 record\(s\) forgiven due to total shrink/,
  );
});

test("enforces configured percentage floors for every area metric", () => {
  const report = {
    utilities: {
      lines: { covered: 2, total: 4 },
      functions: { covered: 1, total: 2 },
      branches: { covered: 3, total: 4 },
    },
  };
  const configured = {
    ...config,
    areas: [
      {
        ...config.areas[0],
        minimumCoverage: { lines: 50, functions: 50, branches: 75 },
      },
    ],
  };
  assert.doesNotThrow(() => assertAreaFloors(report, configured));
  configured.areas[0].minimumCoverage.branches = 76;
  assert.throws(
    () => assertAreaFloors(report, configured),
    /utilities branches is below minimum coverage: 75\.00% < 76\.00%/,
  );
});

test("rejects unmapped production files and missing coverage input", async () => {
  const unmapped = await fixture();
  await writeFile(join(unmapped.root, "src", "other.ts"), "export const other = 1;\n");
  await assert.rejects(
    () => buildCoverageReport({ config, lcov, root: unmapped.root }),
    /Unmapped production file/,
  );
  const missing = await fixture();
  await assert.rejects(
    () => buildCoverageReport({ config, lcov: "", root: missing.root }),
    /Coverage data missing/,
  );
});

test("writes a baseline with exact integer totals", async () => {
  const { root } = await fixture();
  const areas = await buildCoverageReport({ config, lcov, root });
  const path = join(root, "baseline.json");
  await writeBaseline({ areas, path });
  const baseline = JSON.parse(await readFile(path, "utf8"));
  assert.deepEqual(baseline.areas.utilities.lines, { covered: 1, total: 2 });
  assert.doesNotThrow(() => assertBaseline(areas, baseline));
});
