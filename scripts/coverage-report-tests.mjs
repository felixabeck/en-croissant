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
import {
  excluded,
  excludePatterns,
  globToRegExp,
  matches,
  normalisePath,
} from "./coverage-scope.mjs";
import {
  exportLcovOrDiagnose,
  formatExportCrashMessage,
  llvmCovExportArgs,
  probeCrashingSources,
} from "./rust-branch-coverage.mjs";

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

test("bulk llvm-cov export and the crash probe share one argument builder", () => {
  const profilePath = "/tmp/src-tauri.profdata";
  const executable = "/tmp/en_croissant-deadbeef";
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
  const executable = "/tmp/en_croissant-deadbeef";
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
    "/tmp/en_croissant-deadbeef",
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
