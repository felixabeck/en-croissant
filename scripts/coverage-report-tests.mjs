import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve, sep } from "node:path";
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
import {
  excluded,
  excludePatterns,
  globToRegExp,
  matches,
  normalisePath,
} from "./coverage-scope.mjs";
import {
  coverageTools,
  exportLcovOrDiagnose,
  formatExportCrashMessage,
  isCoverageExecutable,
  llvmCovExportArgs,
  probeCrashingSources,
} from "./rust-branch-coverage.mjs";
import { RUST_COVERAGE_TOOLCHAIN } from "./toolchain-versions.mjs";

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

async function fixture({ source = "export const example = 1;\n", files = {} } = {}) {
  const root = await mkdtemp(join(tmpdir(), "coverage-report-"));
  const fixtureFiles = { "src/utils/example.ts": source, ...files };
  for (const [path, contents] of Object.entries(fixtureFiles)) {
    const filePath = join(root, path);
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, contents);
  }
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

function withStatementFree(paths) {
  return {
    ...config,
    sources: [
      {
        ...config.sources[0],
        statementFree: paths.map((path) => ({ path, reason: "Fixture declaration." })),
      },
    ],
  };
}

function lcovRecord(file, { lines = 0, functions = 0, branches = 0 } = {}) {
  const records = [`TN:`, `SF:${file}`];
  for (let index = 1; index <= functions; index += 1) {
    records.push(`FN:${index},function${index}`, `FNDA:1,function${index}`);
  }
  for (let index = 1; index <= lines; index += 1) records.push(`DA:${index},1`);
  for (let index = 1; index <= branches; index += 1) records.push(`BRDA:${index},0,${index - 1},1`);
  records.push("end_of_record", "");
  return records.join("\n");
}

function blankLcov(file) {
  return lcovRecord(file);
}

function cliConfig(statementFree = []) {
  return {
    version: 1,
    sources: [
      {
        id: "frontend",
        root: "src",
        include: ["src/**/*.ts"],
        exclude: [],
        ...(statementFree.length > 0 ? { statementFree } : {}),
      },
    ],
    areas: [
      {
        id: "utilities",
        source: "frontend",
        minimumCoverage: { lines: 0, functions: 0, branches: 0 },
        paths: ["src/utils/**"],
      },
    ],
  };
}

async function runCoverageCli(root, { config, lcov, writeBaseline = false }) {
  await writeFile(join(root, "config.json"), JSON.stringify(config));
  await writeFile(join(root, "lcov.info"), lcov);
  if (!writeBaseline) await writeFile(join(root, "baseline.json"), JSON.stringify({ version: 1 }));
  return spawnSync(
    process.execPath,
    [
      join(process.cwd(), "scripts", "coverage-report.mjs"),
      "--config",
      "config.json",
      "--baseline",
      writeBaseline ? "scratch-baseline.json" : "baseline.json",
      "--lcov",
      "lcov.info",
      ...(writeBaseline ? ["--write-baseline"] : []),
    ],
    { cwd: root, encoding: "utf8" },
  );
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
    configPath: "coverage-areas.json",
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

test("rejects a blank measurement for an undeclared production file", async () => {
  const blankFile = "src/utils/blank.ts";
  const { root } = await fixture({ files: { [blankFile]: "export type Blank = string;\n" } });
  await assert.rejects(
    () =>
      buildCoverageReport({
        config,
        configPath: "coverage-areas.json",
        lcov: `${lcov}${blankLcov(blankFile)}`,
        root,
      }),
    (error) => {
      assert.equal(
        error.message,
        "Coverage measurement is blank for production files: src/utils/blank.ts. " +
          "A file present in the LCOV with no line, function or branch records has left the denominator without changing any percentage. " +
          "If the file genuinely has no statements, declare it under statementFree in coverage-areas.json; otherwise something removed it from the measurement (see docs/coverage.md).",
      );
      return true;
    },
  );
});

test("names two blank undeclared production files in stable order", async () => {
  const blankFiles = ["src/utils/blank-b.ts", "src/utils/blank-a.ts"];
  const { root } = await fixture({
    files: Object.fromEntries(blankFiles.map((file) => [file, "export type Blank = string;\n"])),
  });
  await assert.rejects(
    () =>
      buildCoverageReport({
        config,
        configPath: "coverage-areas.json",
        lcov: `${lcov}${blankLcov(blankFiles[0])}${blankLcov(blankFiles[1])}`,
        root,
      }),
    /Coverage measurement is blank for production files: src\/utils\/blank-a\.ts, src\/utils\/blank-b\.ts\./,
  );
});

test("accepts a declared blank without changing area metrics", async () => {
  const blankFile = "src/utils/blank.ts";
  const { root } = await fixture({ files: { [blankFile]: "export type Blank = string;\n" } });
  // O2 residual limitation: a declared file that gains statements and is raw-imported stays blank and is not caught.
  const report = await buildCoverageReport({
    config: withStatementFree([blankFile]),
    configPath: "coverage-areas.json",
    lcov: `${lcov}${blankLcov(blankFile)}`,
    root,
  });
  assert.deepEqual(report, {
    utilities: {
      lines: { covered: 1, total: 2 },
      functions: { covered: 1, total: 1 },
      branches: { covered: 1, total: 2 },
    },
  });
});

test("rejects two declared paths absent from the measured production set", async () => {
  const declaredPaths = ["src/utils/dead-b.ts", "src/utils/dead-a.ts"];
  const { root } = await fixture();
  await assert.rejects(
    () =>
      buildCoverageReport({
        config: withStatementFree(declaredPaths),
        configPath: "coverage-areas.json",
        lcov,
        root,
      }),
    /Coverage statementFree declarations are outside the measured production set: src\/utils\/dead-a\.ts, src\/utils\/dead-b\.ts\. Remove each dead declaration or restore the file to the measured production set\./,
  );
});

test("rejects declared paths that are no longer blank", async () => {
  const declaredPaths = ["src/utils/declared-b.ts", "src/utils/declared-a.ts"];
  const { root } = await fixture({
    files: Object.fromEntries(
      declaredPaths.map((file) => [file, "export const declared = true;\n"]),
    ),
  });
  const declaredLcov = declaredPaths.map((file) =>
    lcovRecord(file, { lines: 1, functions: 1, branches: 1 }),
  );
  await assert.rejects(
    () =>
      buildCoverageReport({
        config: withStatementFree(declaredPaths),
        configPath: "coverage-areas.json",
        lcov: `${lcov}${declaredLcov.join("")}`,
        root,
      }),
    /Coverage statementFree declarations are no longer blank: src\/utils\/declared-a\.ts, src\/utils\/declared-b\.ts\. Remove each declaration so the file contributes its coverage records\./,
  );

  const partialZeroCases = [
    ["lines", { lines: 0, functions: 1, branches: 1 }],
    ["functions", { lines: 1, functions: 0, branches: 1 }],
    ["branches", { lines: 1, functions: 1, branches: 0 }],
  ];
  for (const [metric, totals] of partialZeroCases) {
    const file = `src/utils/declared-partial-${metric}.ts`;
    const partialFixture = await fixture({ files: { [file]: "export const declared = true;\n" } });
    await assert.rejects(
      () =>
        buildCoverageReport({
          config: withStatementFree([file]),
          configPath: "coverage-areas.json",
          lcov: `${lcov}${lcovRecord(file, totals)}`,
          root: partialFixture.root,
        }),
      new RegExp(
        `Coverage statementFree declarations are no longer blank: ${file.replaceAll("/", "\\/")}\\.`,
      ),
    );
  }
});

test("matches statementFree declarations literally rather than as globs", async () => {
  const { root } = await fixture();
  await assert.rejects(
    () =>
      buildCoverageReport({
        config: withStatementFree(["src/**"]),
        configPath: "coverage-areas.json",
        lcov,
        root,
      }),
    /Coverage statementFree declarations are outside the measured production set: src\/\*\*\./,
  );
});

test("accepts each partial-zero permutation for an undeclared production file", async () => {
  const partialZeroCases = [
    ["lines", { lines: 0, functions: 1, branches: 1 }],
    ["functions", { lines: 1, functions: 0, branches: 1 }],
    ["branches", { lines: 1, functions: 1, branches: 0 }],
  ];
  for (const [metric, totals] of partialZeroCases) {
    const file = `src/utils/partial-${metric}.ts`;
    const partialFixture = await fixture({ files: { [file]: "export const partial = true;\n" } });
    const report = await buildCoverageReport({
      config,
      configPath: "coverage-areas.json",
      lcov: `${lcov}${lcovRecord(file, totals)}`,
      root: partialFixture.root,
    });
    assert.deepEqual(report.utilities, {
      lines: { covered: 1 + (totals.lines > 0 ? 1 : 0), total: 2 + totals.lines },
      functions: { covered: 1 + (totals.functions > 0 ? 1 : 0), total: 1 + totals.functions },
      branches: { covered: 1 + (totals.branches > 0 ? 1 : 0), total: 2 + totals.branches },
    });
  }
});

test("rejects a blank measurement for a backend-shaped configuration", async () => {
  const backendConfig = {
    version: 1,
    sources: [
      {
        id: "backend",
        root: "src-tauri/src",
        include: ["src-tauri/src/**/*.rs"],
        exclude: [],
      },
    ],
    areas: [{ id: "backend-area", source: "backend", paths: ["src-tauri/src/**"] }],
  };
  const blankFile = "src-tauri/src/blank.rs";
  const { root } = await fixture({ files: { [blankFile]: "pub type Blank = ();\n" } });
  await assert.rejects(
    () =>
      buildCoverageReport({
        config: backendConfig,
        configPath: "backend-coverage-areas.json",
        lcov: blankLcov(blankFile),
        root,
      }),
    /Coverage measurement is blank for production files: src-tauri\/src\/blank\.rs\./,
  );
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
  // The second narrowing route the signature pins: the same measured file is
  // instead permitted to contribute nothing. Both must reject, or declaring a
  // file would be a narrowing that no guard sees.
  const declared = {
    ...config,
    sources: [
      {
        ...config.sources[0],
        statementFree: [
          { path: "src/untested-thing.ts", reason: "The fixture changed its declaration." },
        ],
      },
    ],
  };
  const baseline = {
    version: 1,
    scope: scopeSignature(config),
    areas: { utilities: { ...metrics(), lines: { covered: 50, total: 100 } } },
  };
  const namesEveryPinnedComponent = (error) => {
    assert.match(error.message, /source ids and roots/);
    assert.match(error.message, /include globs/);
    assert.match(error.message, /exclude globs/);
    assert.match(error.message, /statementFree/);
    assert.match(error.message, /area ids, sources, and paths/);
    assert.match(error.message, /scope subtree by hand/);
    assert.doesNotMatch(error.message, /coverage:baseline:|--write-baseline/);
    return true;
  };
  // Numbers alone would pass: covered is unchanged and the ratio rose.
  assert.doesNotThrow(() => assertBaseline({ utilities: metrics() }, baseline, config));
  assert.throws(
    () => assertBaseline({ utilities: metrics() }, baseline, widened),
    namesEveryPinnedComponent,
  );
  assert.throws(
    () => assertBaseline({ utilities: metrics() }, baseline, declared),
    namesEveryPinnedComponent,
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

test("reports each statementFree validation condition through the CLI", async () => {
  const blankFile = "src/utils/blank.ts";
  const blankFixture = await fixture({ files: { [blankFile]: "export type Blank = string;\n" } });
  const deadFixture = await fixture();
  const nonBlankFixture = await fixture();
  const cases = [
    {
      root: blankFixture.root,
      config: cliConfig(),
      lcov: `${lcov}${blankLcov(blankFile)}`,
      message: /Coverage measurement is blank for production files: src\/utils\/blank\.ts\./,
    },
    {
      root: deadFixture.root,
      config: cliConfig([{ path: "src/utils/dead.ts", reason: "Fixture declaration." }]),
      lcov,
      message:
        /Coverage statementFree declarations are outside the measured production set: src\/utils\/dead\.ts\./,
    },
    {
      root: nonBlankFixture.root,
      config: cliConfig([{ path: "src/utils/example.ts", reason: "Fixture declaration." }]),
      lcov,
      message: /Coverage statementFree declarations are no longer blank: src\/utils\/example\.ts\./,
    },
  ];
  for (const { root, config, lcov: fixtureLcov, message } of cases) {
    const result = await runCoverageCli(root, { config, lcov: fixtureLcov });
    assert.notEqual(result.status, 0, result.stdout);
    assert.match(result.stderr, message);
  }
});

test("rejects an undeclared blank before the CLI writes a baseline", async () => {
  const blankFile = "src/utils/blank.ts";
  const { root } = await fixture({ files: { [blankFile]: "export type Blank = string;\n" } });
  const result = await runCoverageCli(root, {
    config: cliConfig(),
    lcov: `${lcov}${blankLcov(blankFile)}`,
    writeBaseline: true,
  });
  assert.notEqual(result.status, 0, result.stdout);
  assert.match(
    result.stderr,
    /Coverage measurement is blank for production files: src\/utils\/blank\.ts\./,
  );
  await assert.rejects(
    () => readFile(join(root, "scratch-baseline.json")),
    (error) => error.code === "ENOENT",
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
    () =>
      buildCoverageReport({ config, configPath: "coverage-areas.json", lcov, root: unmapped.root }),
    /Unmapped production file/,
  );
  const missing = await fixture();
  await assert.rejects(
    () =>
      buildCoverageReport({
        config,
        configPath: "coverage-areas.json",
        lcov: "",
        root: missing.root,
      }),
    /Coverage data missing/,
  );
});

test("writes a baseline with exact integer totals", async () => {
  const { root } = await fixture();
  const areas = await buildCoverageReport({
    config,
    configPath: "coverage-areas.json",
    lcov,
    root,
  });
  const path = join(root, "baseline.json");
  await writeBaseline({ areas, path });
  const baseline = JSON.parse(await readFile(path, "utf8"));
  assert.deepEqual(baseline.areas.utilities.lines, { covered: 1, total: 2 });
  assert.doesNotThrow(() => assertBaseline(areas, baseline));
});

test("scopeSignature normalises exclude through excludePatterns", () => {
  const source = {
    id: "backend",
    root: "src-tauri/src",
    include: ["src-tauri/src/**/*.rs"],
    exclude: ["src-tauri/src/db/schema.rs", { pattern: "src-tauri/src/**/mod.rs" }],
  };
  const signature = scopeSignature({
    sources: [source],
    areas: [{ id: "infra", source: "backend", paths: ["src-tauri/src/infra/**"] }],
  });
  assert.deepEqual(signature.sources[0].exclude, [
    "src-tauri/src/**/mod.rs",
    "src-tauri/src/db/schema.rs",
  ]);
});

test("scopeSignature omits absent statementFree and sorts declared paths without reasons", () => {
  const withoutStatementFree = JSON.stringify(scopeSignature(config));
  assert.doesNotMatch(withoutStatementFree, /statementFree/);
  const statementFreeConfig = withStatementFree(["src/utils/z.ts", "src/utils/a.ts"]);
  const signature = scopeSignature(statementFreeConfig);
  assert.deepEqual(signature.sources[0].statementFree, ["src/utils/a.ts", "src/utils/z.ts"]);
  assert.doesNotMatch(JSON.stringify(signature), /Fixture declaration/);
});

test("coverage tools follow the pinned compiler host, including Windows tool suffixes", () => {
  for (const host of [
    "x86_64-unknown-linux-gnu",
    "aarch64-unknown-linux-gnu",
    "aarch64-apple-darwin",
    "x86_64-pc-windows-msvc",
  ]) {
    const sysroot = resolve("toolchain with spaces");
    const calls = [];
    const tools = coverageTools((command, args) => {
      calls.push([command, ...args]);
      return args.at(-1) === "sysroot"
        ? `${sysroot}\n`
        : `rustc 1.89.0-nightly\r\nhost: ${host}\r\nrelease: 1.89.0-nightly\r\n`;
    });
    const suffix = host.includes("-windows-") ? ".exe" : "";
    assert.deepEqual(tools, {
      llvmProfdata: resolve(sysroot, "lib/rustlib", host, "bin", `llvm-profdata${suffix}`),
      llvmCov: resolve(sysroot, "lib/rustlib", host, "bin", `llvm-cov${suffix}`),
    });
    assert.deepEqual(calls, [
      ["rustup", "run", RUST_COVERAGE_TOOLCHAIN, "rustc", "--print", "sysroot"],
      ["rustup", "run", RUST_COVERAGE_TOOLCHAIN, "rustc", "-vV"],
    ]);
  }
});

test("coverage tools refuse invalid metadata and propagate command errors", () => {
  for (const version of [
    "rustc 1.89.0",
    "host: ",
    "host: ../../other",
    "host: aarch64-apple-darwin extra",
  ]) {
    assert.throws(
      () => coverageTools((_command, args) => (args.at(-1) === "sysroot" ? "/rust" : version)),
      /Cannot determine sysroot and host/,
    );
  }
  assert.throws(() => coverageTools(() => ""), /Cannot determine sysroot and host/);
  assert.throws(
    () =>
      coverageTools((_command, args) =>
        args.at(-1) === "sysroot" ? "\n" : "host: x86_64-unknown-linux-gnu\n",
      ),
    /Cannot determine sysroot and host/,
  );
  const failure = new Error("pinned toolchain missing");
  assert.throws(
    () =>
      coverageTools(() => {
        throw failure;
      }),
    (error) => error === failure,
  );
});

test("coverage executable selection respects native naming and file types", () => {
  const file = { isFile: () => true, mode: 0o644 };
  assert.equal(isCoverageExecutable("chessfable-deadbeef.exe", file, "win32"), true);
  assert.equal(isCoverageExecutable("chessfable-deadbeef", file, "linux"), false);
  assert.equal(
    isCoverageExecutable("chessfable-deadbeef", { ...file, mode: 0o755 }, "linux"),
    true,
  );
  for (const name of [
    "chessfable-deadbeef.d",
    "chessfable-deadbeef.pdb",
    "chessfable-deadbeef.exe",
  ]) {
    assert.equal(isCoverageExecutable(name, { ...file, mode: 0o755 }, "linux"), false);
  }
  assert.equal(
    isCoverageExecutable("chessfable-deadbeef.exe", { ...file, isFile: () => false }, "win32"),
    false,
  );
});

test("bulk llvm-cov export and the crash probe share one argument builder", () => {
  const profilePath = "/tmp/src-tauri.profdata";
  const executable = "/tmp/chessfable-deadbeef";
  const sources = ["/repo/src-tauri/src/chess.rs", "/repo/src-tauri/src/game.rs"];
  const bulk = llvmCovExportArgs(profilePath, executable, sources);
  const probe = llvmCovExportArgs(profilePath, executable, [sources[0]]);
  assert.deepEqual(bulk.slice(0, 5), [
    "export",
    "-format=lcov",
    `-instr-profile=${profilePath}`,
    executable,
    "-sources",
  ]);
  assert.deepEqual(bulk.slice(0, 5), probe.slice(0, 5));
  assert.deepEqual(bulk.slice(5), sources);
  assert.deepEqual(probe.slice(5), [sources[0]]);
});

test("bulk export diagnoses crashes with the shared argv", () => {
  const profilePath = "/tmp/src-tauri.profdata";
  const executable = "/tmp/chessfable-deadbeef";
  const sources = ["src-tauri/src/chess.rs", "src-tauri/src/db/schema.rs"];
  const calls = [];
  const attempt = (_command, argumentsList) => {
    calls.push(argumentsList);
    const exportedSources = argumentsList.slice(argumentsList.indexOf("-sources") + 1);
    if (exportedSources.includes("src-tauri/src/db/schema.rs")) {
      return { signal: "SIGSEGV", status: null };
    }
    return { signal: null, status: 0, stdout: "SF:ok\n" };
  };
  assert.throws(
    () => exportLcovOrDiagnose(attempt, "llvm-cov", profilePath, executable, sources),
    /src-tauri\/src\/db\/schema\.rs/,
  );
  assert.deepEqual(calls[0], llvmCovExportArgs(profilePath, executable, sources));
});

test("signal diagnostic names the crashing source without a retracted cause", () => {
  const attempt = (_command, argumentsList) => {
    const source = argumentsList.at(-1);
    return source === "src-tauri/src/db/schema.rs"
      ? { signal: "SIGSEGV", status: null }
      : { signal: null, status: 0 };
  };
  const sources = ["src-tauri/src/chess.rs", "src-tauri/src/db/schema.rs"];
  const offenders = probeCrashingSources(
    attempt,
    "llvm-cov",
    "/tmp/src-tauri.profdata",
    "/tmp/chessfable-deadbeef",
    sources,
  );
  assert.deepEqual(offenders, ["src-tauri/src/db/schema.rs"]);
  const message = formatExportCrashMessage(offenders, (source) => source);
  assert.match(message, /src-tauri\/src\/db\/schema\.rs/);
  assert.match(message, /llvm\/llvm-project#119558/);
  assert.doesNotMatch(message, /no coverage records/);
});

test("matches exclude entries as globs, not as exact paths", () => {
  // Both coverage-report.mjs and rust-branch-coverage.mjs honour these as globs
  // through coverage-scope.mjs. A literal-path comparison would silently exclude
  // nothing, and the file would reach llvm-cov -sources.
  const source = { exclude: [{ pattern: "src-tauri/src/**/mod.rs" }] };
  assert.equal(excluded("src-tauri/src/infra/mod.rs", source), true);
  assert.equal(excluded("src-tauri/src/db/mod.rs", source), true);
  assert.equal(excluded("src-tauri/src/chess.rs", source), false);
});

test("accepts exclude entries written as bare strings or as objects", () => {
  assert.deepEqual(excludePatterns({ exclude: ["a/b.rs", { pattern: "c/**" }] }), [
    "a/b.rs",
    "c/**",
  ]);
  assert.equal(excluded("c/d/e.rs", { exclude: ["a/b.rs", { pattern: "c/**" }] }), true);
});

test("anchors globs and keeps a single star inside one path segment", () => {
  assert.equal(globToRegExp("src/*.ts").test("src/a.ts"), true);
  assert.equal(globToRegExp("src/*.ts").test("src/nested/a.ts"), false);
  assert.equal(globToRegExp("src/**/a.ts").test("src/a.ts"), true);
  assert.equal(matches("src/a.ts", ["nope/**", "src/*.ts"]), true);
  assert.equal(matches("src/a.ts", []), false);
});

test("normalises paths to repo-relative POSIX form for matching", () => {
  const root = sep === "/" ? "/tmp/repo" : "C:\\repo";
  assert.equal(normalisePath(join(root, "src", "a.ts"), root), "src/a.ts");
  assert.equal(normalisePath("src/a.ts", root), "src/a.ts");
});
