/**
 * Recorded failure evidence for this artefact.
 *
 * `push-review-policy.md:211-219` asks that a verification artefact whose output is read as
 * evidence outside a test run carry, in its own header, the message and exit status each of its
 * assertions was *seen* to produce. This script is such an artefact: `package.json:37,40` and
 * `.github/workflows/test.yml:157,230` cite its exit status for both coverage ratchets and both
 * area-floor gates.
 *
 * The rows below are the paths the blank-measurement work changed (`f-20260920-19`), each run
 * against the real frontend LCOV on 2026-09-22. The four rows with an offender list were run
 * twice, once with one offender and once with two, because a message naming only the first
 * offender passes every single-offender run. Messages are quoted to their distinguishing clause.
 *
 *   row 1  undeclared blank, 1 offender   exit 1  "Coverage measurement is blank for production
 *          staged by raw-importing                 files: src/components/boards/EditingCard.tsx."
 *          one never-imported file
 *   row 1  undeclared blank, 2 offenders  exit 1  "... files: src/components/boards/
 *                                                  AnnotationHint.tsx, src/components/boards/
 *                                                  EditingCard.tsx." -- one message, both paths,
 *                                                  sorted
 *   row 2a dead declaration, absent file  exit 1  "Coverage statementFree declarations are outside
 *          1 offender / 2 offenders               the measured production set:
 *                                                 src/does-not-exist.ts." / "...
 *                                                 src/also-missing.ts, src/does-not-exist.ts."
 *   row 2b dead declaration, existing but  exit 1 "... outside the measured production set:
 *          excluded file                          src/routeTree.gen.ts." / "...
 *          1 offender / 2 offenders               src/routeTree.gen.ts, src/vite-env.d.ts."
 *   row 3  declaration that is a lie       exit 1 "Coverage statementFree declarations are no
 *          1 offender / 2 offenders               longer blank: src/utils/format.ts." / "...
 *                                                 src/utils/chess.ts, src/utils/format.ts."
 *   row 9  scope mismatch, rewritten       exit 1 "Coverage measurement scope changed: source ids
 *          message                                and roots, include globs, exclude globs,
 *                                                 statementFree declarations, or area ids,
 *                                                 sources, and paths no longer match the
 *                                                 baseline. ... Re-record the scope subtree by
 *                                                 hand, leave areas untouched ..." -- and it does
 *                                                 not name `coverage:baseline:*`
 *
 * Nine runs, one record each. Rows 2a, 2b and 3 were staged with a scratch copy of
 * `coverage-areas.json`; row 9 with a scratch copy of the baseline whose recorded scope was one
 * `statementFree` entry stale; row 1 by a throwaway test, deleted afterwards, with the gate
 * measured green before and green again after. Row 2b uses a file that exists on disk and is
 * excluded, because condition 2 is measured-set membership and not filesystem existence.
 *
 * This is not the artefact's complete failure matrix — the remaining paths are `f-20260921-02`.
 * Until that matrix exists, a green run of this script may not be cited as evidence without
 * naming what it does not cover.
 */
import { spawnSync } from "node:child_process";
import { readFile, rename as renameFile, unlink as unlinkFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { excluded, excludePatterns, matches, normalisePath } from "./coverage-scope.mjs";
import { isEntrypoint } from "./entrypoint.mjs";
import { filesBelow } from "./files-below.mjs";

const METRICS = ["lines", "functions", "branches"];

function emptyMetrics() {
  return Object.fromEntries(METRICS.map((metric) => [metric, { covered: 0, total: 0 }]));
}

export function parseLcov(lcov) {
  const reports = new Map();
  let report;

  function addCounter(counters, identity, hits) {
    counters.set(identity, Math.max(counters.get(identity) ?? 0, hits));
  }

  function mergeReport(next) {
    if (!next?.file) return;
    const existing = reports.get(next.file);
    if (!existing) {
      reports.set(next.file, next);
      return;
    }
    for (const metric of ["lines", "functions", "branches"]) {
      for (const [identity, hits] of next[metric]) addCounter(existing[metric], identity, hits);
    }
  }

  for (const rawLine of lcov.replaceAll("\r\n", "\n").split("\n")) {
    if (rawLine === "end_of_record") {
      mergeReport(report);
      report = undefined;
      continue;
    }
    if (!rawLine) continue;
    const separator = rawLine.indexOf(":");
    const key = separator === -1 ? rawLine : rawLine.slice(0, separator);
    const value = separator === -1 ? "" : rawLine.slice(separator + 1);
    if (key === "SF") {
      report = {
        file: value,
        lines: new Map(),
        functions: new Map(),
        branches: new Map(),
        functionIdsByName: new Map(),
        functionDataOccurrences: new Map(),
      };
      continue;
    }
    if (!report) continue;
    if (key === "DA") {
      const [line, hits, checksum = ""] = value.split(",");
      addCounter(report.lines, `${line}:${checksum}`, Number(hits));
    } else if (key === "FN") {
      const [line, name] = value.split(",");
      const functionsWithName = report.functionIdsByName.get(name) ?? [];
      const identity = `${line}:${name}:${functionsWithName.length}`;
      report.functions.set(identity, 0);
      functionsWithName.push(identity);
      report.functionIdsByName.set(name, functionsWithName);
    } else if (key === "FNDA") {
      const [hits, name] = value.split(",");
      const occurrence = report.functionDataOccurrences.get(name) ?? 0;
      const identity =
        report.functionIdsByName.get(name)?.[occurrence] ?? `?:${name}:${occurrence}`;
      report.functionDataOccurrences.set(name, occurrence + 1);
      addCounter(report.functions, identity, Number(hits));
    } else if (key === "BRDA") {
      const [line, block, branch, hits] = value.split(",");
      addCounter(report.branches, `${line}:${block}:${branch}`, hits === "-" ? 0 : Number(hits));
    }
  }
  mergeReport(report);
  return [...reports.values()].map((report) => ({
    file: report.file,
    metrics: {
      lines: {
        covered: [...report.lines.values()].filter((hits) => hits > 0).length,
        total: report.lines.size,
      },
      functions: {
        covered: [...report.functions.values()].filter((hits) => hits > 0).length,
        total: report.functions.size,
      },
      branches: {
        covered: [...report.branches.values()].filter((hits) => hits > 0).length,
        total: report.branches.size,
      },
    },
  }));
}

export function assignArea(path, config) {
  const candidates = config.areas.filter((area) => matches(path, area.paths));
  if (candidates.length !== 1) {
    throw new Error(
      candidates.length === 0
        ? `Unmapped production file: ${path}`
        : `Production file belongs to multiple coverage areas: ${path} (${candidates.map((area) => area.id).join(", ")})`,
    );
  }
  return candidates[0];
}

function addMetrics(total, addition) {
  for (const metric of METRICS) {
    total[metric].covered += addition[metric].covered;
    total[metric].total += addition[metric].total;
  }
}

export async function buildCoverageReport({ config, configPath, lcov, root }) {
  const productionFiles = new Map();
  for (const source of config.sources) {
    const files = (await filesBelow(resolve(root, source.root))).map((path) =>
      normalisePath(path, root),
    );
    for (const file of files) {
      if (matches(file, source.include) && !excluded(file, source))
        productionFiles.set(file, source.id);
    }
  }

  for (const [file, sourceId] of productionFiles) {
    const area = assignArea(file, config);
    if (area.source !== sourceId)
      throw new Error(`Coverage area ${area.id} has the wrong source for ${file}`);
  }

  const report = Object.fromEntries(config.areas.map((area) => [area.id, emptyMetrics()]));
  const coverageFilesByArea = Object.fromEntries(config.areas.map((area) => [area.id, 0]));
  const filesWithCoverage = new Set();
  const coverageMetricsByFile = new Map();
  for (const record of parseLcov(lcov)) {
    const file = normalisePath(record.file, root);
    const sourceId = productionFiles.get(file);
    if (!sourceId) continue;
    const area = assignArea(file, config);
    if (area.source !== sourceId)
      throw new Error(`Coverage area ${area.id} has the wrong source for ${file}`);
    addMetrics(report[area.id], record.metrics);
    coverageFilesByArea[area.id] += 1;
    filesWithCoverage.add(file);
    coverageMetricsByFile.set(file, record.metrics);
  }

  const missingFiles = [...productionFiles.keys()].filter((file) => !filesWithCoverage.has(file));
  if (missingFiles.length)
    throw new Error(`Coverage data missing for production files: ${missingFiles.join(", ")}`);
  const isBlankMeasurement = (metrics) =>
    metrics.lines.total === 0 && metrics.functions.total === 0 && metrics.branches.total === 0;
  const statementFreeDeclarations = config.sources.flatMap((source) =>
    (source.statementFree ?? []).map(({ path }) => ({ path, sourceId: source.id })),
  );
  const declaredStatementFree = new Set(
    statementFreeDeclarations
      .filter(({ path, sourceId }) => productionFiles.get(path) === sourceId)
      .map(({ path }) => path),
  );
  const blankFiles = [...productionFiles.keys()]
    .filter((file) => isBlankMeasurement(coverageMetricsByFile.get(file)))
    .filter((file) => !declaredStatementFree.has(file))
    .sort();
  if (blankFiles.length)
    throw new Error(
      `Coverage measurement is blank for production files: ${blankFiles.join(", ")}. ` +
        "A file present in the LCOV with no line, function or branch records has left the denominator without changing any percentage. " +
        `If the file genuinely has no statements, declare it under statementFree in ${configPath}; otherwise something removed it from the measurement (see docs/coverage.md).`,
    );
  const deadStatementFree = statementFreeDeclarations
    .filter(({ path, sourceId }) => productionFiles.get(path) !== sourceId)
    .map(({ path }) => path)
    .sort();
  if (deadStatementFree.length)
    throw new Error(
      `Coverage statementFree declarations are outside the measured production set: ${deadStatementFree.join(", ")}. ` +
        "Remove each dead declaration or restore the file to the measured production set.",
    );
  const nonBlankStatementFree = statementFreeDeclarations
    .filter(({ path, sourceId }) => productionFiles.get(path) === sourceId)
    .filter(({ path }) => !isBlankMeasurement(coverageMetricsByFile.get(path)))
    .map(({ path }) => path)
    .sort();
  if (nonBlankStatementFree.length)
    throw new Error(
      `Coverage statementFree declarations are no longer blank: ${nonBlankStatementFree.join(", ")}. ` +
        "Remove each declaration so the file contributes its coverage records.",
    );
  for (const area of config.areas) {
    if (coverageFilesByArea[area.id] === 0)
      throw new Error(`Coverage data missing for area: ${area.id}`);
  }
  return report;
}

/**
 * The globs that decide *what gets measured*, plus the measured files permitted
 * to contribute nothing. Numbers alone cannot tell deleting an untested file
 * apart from carving one out of the measured set: both leave `covered` unchanged
 * and shrink `total`. Pinning the scope separates them, so the ratchets below
 * can judge coverage without also having to police the denominator.
 */
export function scopeSignature(config) {
  return {
    sources: config.sources.map((source) => ({
      id: source.id,
      root: source.root,
      include: [...source.include].sort(),
      exclude: [...excludePatterns(source)].sort(),
      statementFree: source.statementFree?.map(({ path }) => path).sort(),
    })),
    areas: config.areas.map((area) => ({
      id: area.id,
      source: area.source,
      paths: [...area.paths].sort(),
    })),
  };
}

export function assertBaseline(report, baseline, config) {
  const allowances = [];
  if (baseline.version !== 1 || !baseline.areas)
    throw new Error("Unsupported coverage baseline format");
  if (config) {
    const actualScope = JSON.stringify(scopeSignature(config));
    if (!baseline.scope) throw new Error("Coverage baseline is missing its recorded scope");
    if (JSON.stringify(baseline.scope) !== actualScope) {
      throw new Error(
        "Coverage measurement scope changed: source ids and roots, include globs, exclude globs, " +
          "statementFree declarations, or area ids, sources, and paths no longer match the " +
          "baseline. Narrowing the measured set hides untested code without changing any " +
          "percentage. Re-record the scope subtree by hand, leave areas untouched, and prove " +
          "the edit is scope-only by comparing the parsed committed baseline with the parsed " +
          "working-tree baseline (see docs/coverage.md).",
      );
    }
  }
  for (const [area, metrics] of Object.entries(report)) {
    const expected = baseline.areas[area];
    if (!expected) throw new Error(`Missing baseline for area: ${area}`);
    for (const metric of METRICS) {
      const actual = metrics[metric];
      const prior = expected[metric];
      if (!prior || !Number.isInteger(prior.covered) || !Number.isInteger(prior.total)) {
        throw new Error(`Missing ${metric} baseline for area: ${area}`);
      }
      // Two independent ratchets, and deliberately no third one on `total`:
      //   - covered may drop only by the measured shrink of `total`;
      //   - the ratio may never drop after the same adjustment, so untested
      //     code cannot be added to win (a growing total with unchanged
      //     covered fails here).
      //
      // Both comparisons run against a baseline shrunk by however many records
      // the measurement lost, because deleting a covered record lowers `covered`
      // and `total` together and would otherwise fail both clauses -- the ratio
      // included, since (c-1)/(t-1) < c/t for every ratio below 1. The name says
      // `shrink` rather than `deleted` on purpose: a smaller denominator is the
      // only thing observable here, and deletion is merely its likely cause, so
      // the allowance is bounded by the shrink and announced for every use
      // instead of being silently applied.
      const totalShrink = Math.max(0, prior.total - actual.total);
      const shrinkAdjusted = {
        covered: Math.max(0, prior.covered - totalShrink),
        total: prior.total - totalShrink,
      };
      const regressedUnadjusted =
        actual.covered < prior.covered ||
        actual.covered * prior.total < prior.covered * actual.total;
      const regressed =
        actual.covered < shrinkAdjusted.covered ||
        actual.covered * shrinkAdjusted.total < shrinkAdjusted.covered * actual.total;
      // Only an adjustment that actually changed the verdict is an allowance.
      // Reporting every shrink would announce "forgiven" for a deletion of
      // untested code, which needs no allowance and was never at risk.
      if (regressedUnadjusted && !regressed) allowances.push({ area, metric, totalShrink });
      if (regressed) {
        throw new Error(
          `${area} ${metric} regressed: ${actual.covered}/${actual.total}, baseline ${prior.covered}/${prior.total}`,
        );
      }
    }
  }
  for (const area of Object.keys(baseline.areas)) {
    if (!report[area]) throw new Error(`Baseline references unknown area: ${area}`);
  }
  return allowances;
}

export function assertAreaFloors(report, config) {
  for (const area of config.areas) {
    const floors = area.minimumCoverage;
    if (!floors) throw new Error(`Missing minimum coverage for area: ${area.id}`);
    const metrics = report[area.id];
    if (!metrics) throw new Error(`Missing coverage report for area: ${area.id}`);
    for (const metric of METRICS) {
      const minimum = floors[metric];
      if (typeof minimum !== "number" || minimum < 0 || minimum > 100) {
        throw new Error(`Invalid ${metric} minimum coverage for area: ${area.id}`);
      }
      const actual = metrics[metric];
      const percentage = actual.total === 0 ? 100 : (actual.covered / actual.total) * 100;
      if (percentage < minimum) {
        throw new Error(
          `${area.id} ${metric} is below minimum coverage: ${percentage.toFixed(2)}% < ${minimum.toFixed(2)}%`,
        );
      }
    }
  }
}

const defaultFileSystem = { rename: renameFile, unlink: unlinkFile, writeFile };

async function cleanupTemporaryFile(unlink, temporaryPath) {
  try {
    await unlink(temporaryPath);
  } catch {
    // Preserve the primary failure. A failed cleanup leaves the temporary file as evidence.
  }
}

export async function writeBaseline({ areas, scope, path }, fileSystem = defaultFileSystem) {
  const temporaryPath = `${path}.tmp.json`;
  try {
    await fileSystem.writeFile(
      temporaryPath,
      `${JSON.stringify({ version: 1, scope, areas }, null, 2)}\n`,
    );
    // `JSON.stringify` cannot reproduce oxfmt's style (it collapses short arrays onto one line),
    // so a freshly written baseline fails `oxfmt --check` and therefore `pnpm lint:ci`. Formatting
    // it here keeps the trap out of the workflow: re-recording a baseline is rare and deliberate,
    // and discovering afterwards that the linter is red for a reason unrelated to your change is
    // exactly the kind of detour nobody remembers the fix for. Measured 2026-08-29, when it
    // reddened CI one commit after an authorized re-record.
    const formatter = resolve("node_modules/.bin/oxfmt");
    const formatted = spawnSync(formatter, [temporaryPath], { encoding: "utf8" });
    if (formatted.status !== 0 || formatted.error) {
      const spawnError = formatted.error;
      const errorDetails = spawnError
        ? `; error.code=${spawnError.code}; error.message=${JSON.stringify(spawnError.message)}`
        : "";
      throw new Error(
        `Failed to format coverage baseline with ${formatter}: status=${formatted.status}; ` +
          `signal=${formatted.signal}; stderr=${JSON.stringify(formatted.stderr ?? "")}${errorDetails}`,
      );
    }
    await fileSystem.rename(temporaryPath, path);
  } catch (error) {
    await cleanupTemporaryFile(fileSystem.unlink, temporaryPath);
    throw error;
  }
}

function parseArguments(argumentsList) {
  const options = { lcov: [] };
  for (let index = 0; index < argumentsList.length; index += 1) {
    const argument = argumentsList[index];
    if (argument === "--write-baseline") options.writeBaseline = true;
    else if (["--config", "--baseline", "--lcov"].includes(argument)) {
      const value = argumentsList[++index];
      if (!value) throw new Error(`Missing value for ${argument}`);
      if (argument === "--lcov") options.lcov.push(value);
      else options[argument.slice(2)] = value;
    } else throw new Error(`Unknown argument: ${argument}`);
  }
  if (!options.config || !options.baseline || options.lcov.length === 0) {
    throw new Error(
      "Usage: coverage-report.mjs --config <file> --baseline <file> --lcov <file> [--lcov <file>] [--write-baseline]",
    );
  }
  return options;
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const root = process.cwd();
  const config = JSON.parse(await readFile(resolve(root, options.config), "utf8"));
  const lcov = (
    await Promise.all(options.lcov.map((file) => readFile(resolve(root, file), "utf8")))
  ).join("\n");
  const areas = await buildCoverageReport({ config, configPath: options.config, lcov, root });
  if (options.writeBaseline) {
    await writeBaseline({
      areas,
      scope: scopeSignature(config),
      path: resolve(root, options.baseline),
    });
    console.log(`Wrote coverage baseline: ${options.baseline}`);
  } else {
    const baseline = JSON.parse(await readFile(resolve(root, options.baseline), "utf8"));
    const allowances = assertBaseline(areas, baseline, config);
    assertAreaFloors(areas, config);
    for (const { area, metric, totalShrink } of allowances) {
      console.log(
        `Coverage baseline allowance: ${area} ${metric}, ${totalShrink} record(s) forgiven due to total shrink`,
      );
    }
    console.log("Coverage ratchet and area floors passed");
  }
}

if (isEntrypoint(import.meta.url)) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
