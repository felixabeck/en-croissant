// Historical evidence: docs/context/RULE-HISTORY.md → scripts/coverage-report.mjs.
import { spawnSync } from "node:child_process";
import { readFile, rename as renameFile, unlink as unlinkFile, writeFile } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import { excluded, excludePatterns, matches, normalisePath } from "./coverage-scope.mjs";
import { isEntrypoint } from "./entrypoint.mjs";
import { filesBelow } from "./files-below.mjs";
import { scanRustTestOnly, validateExclusionConfig } from "./rust-test-only.mjs";

const METRICS = ["lines", "functions", "branches"];

// Integer fields are canonical decimals, but function names and DA checksums remain opaque text
// and can contain identity separators. JSON array encoding preserves their field boundaries and
// is injective for arbitrary strings, including colons, NULs, quotes and backslashes.
const identity = (...fields) => JSON.stringify(fields);

function emptyMetrics() {
  return Object.fromEntries(METRICS.map((metric) => [metric, { covered: 0, total: 0 }]));
}

/**
 * `identify` maps an `SF` value to the identity records are merged under, and defaults to the
 * value itself. `buildCoverageReport` passes the repo-relative normaliser, because one file can
 * legitimately appear under two spellings — `llvm-cov` writes absolute paths, `@vitest/coverage-v8`
 * repo-relative ones, and several LCOV files may be joined in one run. Merging them here, by
 * counter identity, is the only place that can do it correctly: past this function the counters are
 * gone and only totals remain, which can be summed but not unioned.
 */
export function parseLcov(lcov, identify = (file) => file, includeLine = () => true) {
  const reports = new Map();
  let report;
  const canonicalDecimal = /^(0|[1-9][0-9]*)$/;
  const positiveDecimal = /^[1-9][0-9]*$/;

  function malformed(reason, rawLine, lineNumber) {
    const record = report ? ` in SF ${JSON.stringify(report.sourceFile)}` : "";
    return new Error(
      `Malformed LCOV at line ${lineNumber}${record}: ${reason}: ${JSON.stringify(rawLine)}`,
    );
  }

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

  for (const [index, rawLine] of lcov.replaceAll("\r\n", "\n").split("\n").entries()) {
    const lineNumber = index + 1;
    if (rawLine === "end_of_record") {
      if (!report) throw malformed("end_of_record without an open record", rawLine, lineNumber);
      mergeReport(report);
      report = undefined;
      continue;
    }
    if (!rawLine) continue;
    const separator = rawLine.indexOf(":");
    const key = separator === -1 ? rawLine : rawLine.slice(0, separator);
    const value = separator === -1 ? "" : rawLine.slice(separator + 1);
    if (key === "SF") {
      if (!value) throw malformed("SF path is empty", rawLine, lineNumber);
      if (report) throw malformed("SF before end_of_record", rawLine, lineNumber);
      report = {
        sourceFile: value,
        file: identify(value),
        lines: new Map(),
        functions: new Map(),
        branches: new Map(),
        functionIdsByName: new Map(),
        functionsByDeclaration: new Map(),
        functionDataOccurrences: new Map(),
      };
      continue;
    }
    if (!["DA", "FN", "FNDA", "BRDA"].includes(key)) continue;
    if (!report) throw malformed("counter without an open record", rawLine, lineNumber);
    const fields = value.split(",");
    if (key === "DA") {
      if (fields.length !== 2 && fields.length !== 3) {
        throw malformed("DA requires 2 or 3 fields", rawLine, lineNumber);
      }
      const [line, hits, checksum = ""] = fields;
      if (!positiveDecimal.test(line)) {
        throw malformed("DA line must be a canonical decimal >= 1", rawLine, lineNumber);
      }
      if (!canonicalDecimal.test(hits)) {
        throw malformed("DA hits must be a canonical decimal", rawLine, lineNumber);
      }
      if (fields.length === 3 && !checksum) {
        throw malformed("DA checksum must be non-empty when present", rawLine, lineNumber);
      }
      if (includeLine(report.file, Number(line))) {
        addCounter(report.lines, identity(line, checksum), Number(hits));
      }
    } else if (key === "FN") {
      if (fields.length !== 2) throw malformed("FN requires 2 fields", rawLine, lineNumber);
      const [line, name] = fields;
      if (!positiveDecimal.test(line)) {
        throw malformed("FN line must be a canonical decimal >= 1", rawLine, lineNumber);
      }
      if (!name) throw malformed("FN name must be non-empty", rawLine, lineNumber);
      // The occurrence index counts same-named declarations *on the same line*, not same-named
      // declarations anywhere in the file. Both spellings disambiguate the only case that needs
      // it -- two functions sharing a name and a line -- but only this one is independent of
      // declaration order, and two records for one file need not list their functions in the same
      // order. Counting per name made `FN:10,f; FN:20,f` and `FN:20,f; FN:10,f` four distinct
      // functions instead of two. `functionIdsByName` keeps declaration order regardless, because
      // that is what pairs an `FNDA` line with its `FN`.
      const functionsWithName = report.functionIdsByName.get(name) ?? [];
      const declarationKey = identity(line, name);
      const sameLine = report.functionsByDeclaration.get(declarationKey) ?? 0;
      const functionIdentity = identity(line, name, sameLine);
      report.functionsByDeclaration.set(declarationKey, sameLine + 1);
      const included = includeLine(report.file, Number(line));
      if (included) report.functions.set(functionIdentity, 0);
      functionsWithName.push({ identity: functionIdentity, included });
      report.functionIdsByName.set(name, functionsWithName);
    } else if (key === "FNDA") {
      if (fields.length !== 2) throw malformed("FNDA requires 2 fields", rawLine, lineNumber);
      const [hits, name] = fields;
      if (!canonicalDecimal.test(hits)) {
        throw malformed("FNDA hits must be a canonical decimal", rawLine, lineNumber);
      }
      if (!name) throw malformed("FNDA name must be non-empty", rawLine, lineNumber);
      const occurrence = report.functionDataOccurrences.get(name) ?? 0;
      const declaration = report.functionIdsByName.get(name)?.[occurrence];
      if (!declaration) throw malformed("FNDA has no earlier matching FN", rawLine, lineNumber);
      report.functionDataOccurrences.set(name, occurrence + 1);
      if (declaration.included) {
        addCounter(report.functions, declaration.identity, Number(hits));
      }
    } else if (key === "BRDA") {
      if (fields.length !== 4) throw malformed("BRDA requires 4 fields", rawLine, lineNumber);
      const [line, block, branch, hits] = fields;
      if (!positiveDecimal.test(line)) {
        throw malformed("BRDA line must be a canonical decimal >= 1", rawLine, lineNumber);
      }
      if (!canonicalDecimal.test(block)) {
        throw malformed("BRDA block must be a canonical decimal", rawLine, lineNumber);
      }
      if (!canonicalDecimal.test(branch)) {
        throw malformed("BRDA branch must be a canonical decimal", rawLine, lineNumber);
      }
      if (hits !== "-" && !canonicalDecimal.test(hits)) {
        throw malformed("BRDA taken must be a canonical decimal or -", rawLine, lineNumber);
      }
      if (includeLine(report.file, Number(line))) {
        addCounter(report.branches, identity(line, block, branch), hits === "-" ? 0 : Number(hits));
      }
    }
  }
  if (report) {
    throw new Error(
      `Malformed LCOV at end of input: open record for SF ${JSON.stringify(report.sourceFile)}`,
    );
  }
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

export async function enumerateProductionFiles({ config, root }) {
  const productionFiles = new Map();
  const scansBySource = new Map();
  for (const source of config.sources) {
    if (source.excludeTestOnlyItems !== undefined) validateExclusionConfig(source);
    let paths;
    try {
      paths = await filesBelow(resolve(root, source.root));
    } catch (error) {
      if (source.excludeTestOnlyItems === undefined) throw error;
      throw new Error(`${source.root}:1: unable to scan Rust source tree: ${error.message}`, {
        cause: error,
      });
    }
    const files = paths.map((path) => normalisePath(path, root));
    const testOnlyScan =
      source.excludeTestOnlyItems === undefined
        ? undefined
        : await scanRustTestOnly({ root, source, files: paths });
    if (testOnlyScan) scansBySource.set(source.id, testOnlyScan);
    for (const file of files) {
      if (
        matches(file, source.include) &&
        !excluded(file, source) &&
        !testOnlyScan?.testOnlyFiles.has(file)
      )
        productionFiles.set(file, source.id);
    }
  }

  const areaByFile = new Map();
  const productionFilesByArea = new Map(config.areas.map((area) => [area.id, 0]));
  for (const [file, sourceId] of productionFiles) {
    const area = assignArea(file, config);
    if (area.source !== sourceId)
      throw new Error(`Coverage area ${area.id} has the wrong source for ${file}`);
    areaByFile.set(file, area);
    productionFilesByArea.set(area.id, productionFilesByArea.get(area.id) + 1);
  }
  return { productionFiles, scansBySource, areaByFile, productionFilesByArea };
}

function statementFreeDeclarationsFor(config) {
  return config.sources.flatMap((source) =>
    (source.statementFree ?? []).map(({ path }) => ({ path, sourceId: source.id })),
  );
}

function assertStatementFreeScope(
  config,
  productionFiles,
  statementFreeDeclarations = statementFreeDeclarationsFor(config),
) {
  const deadStatementFree = statementFreeDeclarations
    .filter(({ path, sourceId }) => productionFiles.get(path) !== sourceId)
    .map(({ path }) => path)
    .sort();
  if (deadStatementFree.length)
    throw new Error(
      `Coverage statementFree declarations are outside the measured production set: ${deadStatementFree.join(", ")}. ` +
        "Remove each dead declaration or restore the file to the measured production set.",
    );
  return statementFreeDeclarations;
}

export async function assertCoverageMapping({ config, root }) {
  const enumeration = await enumerateProductionFiles({ config, root });
  const emptyAreas = [...enumeration.productionFilesByArea]
    .filter(([, count]) => count === 0)
    .map(([area]) => area);
  if (emptyAreas.length) {
    throw new Error(`Coverage areas claim no production files: ${emptyAreas.join(", ")}`);
  }
  assertStatementFreeScope(config, enumeration.productionFiles);
  return enumeration;
}

export async function buildCoverageReport({ config, configPath, lcov, root }) {
  const { productionFiles, scansBySource, areaByFile } = await enumerateProductionFiles({
    config,
    root,
  });

  const report = Object.fromEntries(config.areas.map((area) => [area.id, emptyMetrics()]));
  const coverageFilesByArea = Object.fromEntries(config.areas.map((area) => [area.id, 0]));
  const statementFreeDeclarations = statementFreeDeclarationsFor(config);
  // `parseLcov` is given the normaliser, so every spelling of one file arrives as ONE record with
  // its counters unioned. Doing it here instead would be too late twice over: the area totals
  // below would add the same file's records once each, and the blank check further down would see
  // whichever record happened to come last.
  const coverageMetricsByFile = new Map();
  for (const record of parseLcov(
    lcov,
    (file) => normalisePath(file, root),
    (file, line) =>
      !scansBySource.get(productionFiles.get(file))?.excludedLines.get(file)?.has(line),
  )) {
    const file = record.file;
    const sourceId = productionFiles.get(file);
    if (!sourceId) continue;
    const area = areaByFile.get(file);
    addMetrics(report[area.id], record.metrics);
    coverageFilesByArea[area.id] += 1;
    coverageMetricsByFile.set(file, record.metrics);
  }

  const missingFiles = [...productionFiles.keys()].filter(
    (file) => !coverageMetricsByFile.has(file),
  );
  if (missingFiles.length)
    throw new Error(`Coverage data missing for production files: ${missingFiles.join(", ")}`);
  const isBlankMeasurement = (metrics) =>
    metrics.lines.total === 0 && metrics.functions.total === 0 && metrics.branches.total === 0;
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
  assertStatementFreeScope(config, productionFiles, statementFreeDeclarations);
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
      excludeTestOnlyItems: source.excludeTestOnlyItems ? true : undefined,
    })),
    areas: config.areas.map((area) => ({
      id: area.id,
      source: area.source,
      paths: [...area.paths].sort(),
    })),
  };
}

export function assertScopeMatchesBaseline(config, baseline) {
  if (baseline.version !== 1 || !baseline.areas)
    throw new Error("Unsupported coverage baseline format");
  const actualScope = JSON.stringify(scopeSignature(config));
  if (!baseline.scope) throw new Error("Coverage baseline is missing its recorded scope");
  if (JSON.stringify(baseline.scope) !== actualScope) {
    throw new Error(
      "Coverage measurement scope changed: source ids and roots, include globs, exclude globs, " +
        "statementFree declarations, test-only Rust exclusion, or area ids, sources, and paths no longer match the " +
        "baseline. Narrowing the measured set hides untested code without changing any " +
        "percentage. Re-record the scope subtree by hand, leave areas untouched, and prove " +
        "the edit is scope-only by comparing the parsed committed baseline with the parsed " +
        "working-tree baseline (see docs/coverage.md).",
    );
  }
}

export function assertBaseline(report, baseline, config) {
  const allowances = [];
  if (baseline.version !== 1 || !baseline.areas)
    throw new Error("Unsupported coverage baseline format");
  if (config) assertScopeMatchesBaseline(config, baseline);
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

function percentage({ covered, total }) {
  return total === 0 ? 100 : (covered / total) * 100;
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
      const actualPercentage = percentage(actual);
      if (actualPercentage < minimum) {
        throw new Error(
          `${area.id} ${metric} is below minimum coverage: ${actualPercentage.toFixed(2)}% < ${minimum.toFixed(2)}%`,
        );
      }
    }
  }
}

const defaultFileSystem = { rename: renameFile, unlink: unlinkFile, writeFile };

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function validatePriorBaseline(baseline, source) {
  if (!isRecord(baseline) || baseline.version !== 1 || !isRecord(baseline.areas)) {
    throw new Error(
      `Invalid prior coverage baseline from ${source}: expected version 1 and an areas object`,
    );
  }
  for (const [area, metrics] of Object.entries(baseline.areas)) {
    if (!isRecord(metrics)) {
      throw new Error(
        `Invalid prior coverage baseline from ${source}: ${area} must contain all metrics`,
      );
    }
    for (const metric of METRICS) {
      const counts = metrics[metric];
      if (
        !isRecord(counts) ||
        !Number.isInteger(counts.covered) ||
        !Number.isInteger(counts.total) ||
        counts.covered < 0 ||
        counts.total < 0 ||
        counts.covered > counts.total
      ) {
        throw new Error(
          `Invalid prior coverage baseline from ${source}: ${area} ${metric} must have non-negative integer covered and total counts with covered <= total`,
        );
      }
    }
  }
  return baseline;
}

function gitFailure(args, result) {
  const command = `git ${args.join(" ")}`;
  const spawnError = result.error
    ? `; error.code=${result.error.code}; error.message=${JSON.stringify(result.error.message)}`
    : "";
  return new Error(
    `Failed to inspect prior coverage baseline with ${command}: status=${result.status}; stderr=${JSON.stringify(result.stderr ?? "")}${spawnError}`,
  );
}

function runGit(cwd, args) {
  const result = spawnSync("git", args, { cwd, encoding: "utf8" });
  if (result.error) throw gitFailure(args, result);
  return result;
}

async function readDiskBaseline(path) {
  try {
    const contents = await readFile(path, "utf8");
    let baseline;
    try {
      baseline = JSON.parse(contents);
    } catch (error) {
      throw new Error(`Invalid prior coverage baseline at ${path}: ${error.message}`);
    }
    return { source: path, baseline: validatePriorBaseline(baseline, path) };
  } catch (error) {
    if (error.code === "ENOENT") return { source: null, baseline: null };
    throw error;
  }
}

async function readPriorBaseline(path) {
  const directory = dirname(path);
  const file = basename(path);
  const revParseArgs = ["rev-parse", "--is-inside-work-tree"];
  const revParse = runGit(directory, revParseArgs);
  if (revParse.status !== 0) {
    if (/not a git repository/i.test(revParse.stderr ?? "")) return readDiskBaseline(path);
    throw gitFailure(revParseArgs, revParse);
  }

  const lsTreeArgs = ["ls-tree", "--full-name", "HEAD", "--", file];
  const lsTree = runGit(directory, lsTreeArgs);
  if (lsTree.status !== 0) throw gitFailure(lsTreeArgs, lsTree);
  const entries = (lsTree.stdout ?? "").trimEnd().split("\n").filter(Boolean);
  if (entries.length === 0) return readDiskBaseline(path);
  if (entries.length !== 1 || !entries[0].includes("\t")) {
    throw new Error(
      `Failed to inspect prior coverage baseline with git ${lsTreeArgs.join(" ")}: expected one tracked file entry; stderr=${JSON.stringify(lsTree.stderr ?? "")}`,
    );
  }

  const fullName = entries[0].slice(entries[0].indexOf("\t") + 1);
  const showArgs = ["show", `HEAD:${fullName}`];
  const show = runGit(directory, showArgs);
  if (show.status !== 0) throw gitFailure(showArgs, show);
  let baseline;
  try {
    baseline = JSON.parse(show.stdout);
  } catch (error) {
    throw new Error(
      `Invalid prior coverage baseline from git ${showArgs.join(" ")}: ${error.message}`,
    );
  }
  const source = `git ${showArgs.join(" ")}`;
  return { source, baseline: validatePriorBaseline(baseline, source) };
}

function scopeDiffPaths(before, after, prefix = "scope") {
  if (before === undefined || after === undefined) {
    return before === after ? [] : [prefix];
  }
  if (Array.isArray(before) || Array.isArray(after)) {
    if (!Array.isArray(before) || !Array.isArray(after)) return [prefix];
    const paths = [];
    const length = Math.max(before.length, after.length);
    for (let index = 0; index < length; index += 1) {
      paths.push(...scopeDiffPaths(before[index], after[index], `${prefix}[${index}]`));
    }
    return paths;
  }
  if (isRecord(before) || isRecord(after)) {
    if (!isRecord(before) || !isRecord(after)) return [prefix];
    const paths = [];
    const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])].sort();
    for (const key of keys) {
      const beforeValue = Object.hasOwn(before, key) ? before[key] : undefined;
      const afterValue = Object.hasOwn(after, key) ? after[key] : undefined;
      paths.push(...scopeDiffPaths(beforeValue, afterValue, `${prefix}.${key}`));
    }
    return paths;
  }
  return Object.is(before, after) ? [] : [prefix];
}

function ratioDecreased(after, before) {
  if (before.total === 0) {
    return after.total !== 0 && after.covered < after.total;
  }
  return after.covered * before.total < before.covered * after.total;
}

function formatMetric(counts) {
  return `${counts.covered}/${counts.total} (${percentage(counts).toFixed(2)}%)`;
}

function printBaselineDeltas(report, prior) {
  const deltas = [];
  const priorAreas = prior ? prior.areas : {};
  const areas = [...new Set([...Object.keys(priorAreas), ...Object.keys(report)])].sort();
  for (const area of areas) {
    for (const metric of METRICS) {
      const priorArea = Object.hasOwn(priorAreas, area) ? priorAreas[area] : undefined;
      const reportArea = Object.hasOwn(report, area) ? report[area] : undefined;
      const before = priorArea?.[metric];
      const after = reportArea?.[metric];
      const coveredDecrease = Boolean(before && after && after.covered < before.covered);
      const ratioDecrease = Boolean(before && after && ratioDecreased(after, before));
      const removed = Boolean(before && !after);
      const decreased = coveredDecrease || ratioDecrease || removed;
      const from = before ? formatMetric(before) : "NEW";
      const to = after ? formatMetric(after) : "REMOVED";
      const marks = decreased ? " [DECREASE]" : !before && after ? " [NEW]" : "";
      console.log(`Coverage baseline delta: ${area} ${metric}: ${from} → ${to}${marks}`);
      if (decreased) {
        const reasons = [];
        if (removed) reasons.push("area removed");
        if (coveredDecrease) reasons.push(`covered count ${before.covered} → ${after.covered}`);
        if (ratioDecrease) {
          reasons.push(
            `ratio ${percentage(before).toFixed(2)}% → ${percentage(after).toFixed(2)}%`,
          );
        }
        deltas.push(`${area} ${metric} (${reasons.join(", ")})`);
      }
    }
  }
  return deltas;
}

function governingFinding(decisions, decisionId) {
  const entry = decisions
    .split(/^### /m)
    .map((section) => (section.startsWith("### ") ? section : `### ${section}`))
    .find((section) => section.split("\n", 1)[0].startsWith(`### ${decisionId} —`));
  if (!entry) return null;
  const line = entry.match(/^\* \*\*Governs:\*\*\s*(.*)$/m)?.[1];
  if (!line) return [];
  return line.split(/[^A-Za-z0-9_-]+/).filter(Boolean);
}

async function assertInstrumentChange(decisionId, finding, cwd) {
  const decisionsPath = resolve(cwd, "tasks/decisions.md");
  let decisions;
  try {
    decisions = await readFile(decisionsPath, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") {
      throw new Error(
        `Instrument change authorization requires tasks/decisions.md for decision ${decisionId} governing ${finding}`,
      );
    }
    throw error;
  }
  const governing = governingFinding(decisions, decisionId);
  if (governing === null) {
    throw new Error(
      `No decision entry found for --instrument-change ${decisionId} in tasks/decisions.md`,
    );
  }
  if (!governing.includes(finding)) {
    throw new Error(`Decision ${decisionId} does not govern finding ${finding}`);
  }
}

async function guardBaselineWrite({ areas, scope, path, instrumentChange, finding, cwd }) {
  const priorResult = await readPriorBaseline(path);
  const prior = priorResult.baseline;
  const decreases = printBaselineDeltas(areas, prior);
  const changedScope = prior ? scopeDiffPaths(prior.scope, scope) : [];
  const scopeKeys = changedScope.map((key) =>
    key.startsWith("scope.") ? key.slice("scope.".length) : key,
  );
  const previousAreas = prior ? Object.keys(prior.areas) : [];
  const nextAreas = Object.keys(areas);
  const previousAreaSet = new Set(previousAreas);
  const nextAreaSet = new Set(nextAreas);
  const addedAreas = prior ? nextAreas.filter((area) => !previousAreaSet.has(area)).sort() : [];
  const removedAreas = prior ? previousAreas.filter((area) => !nextAreaSet.has(area)).sort() : [];
  if (changedScope.length > 0) {
    console.log(`Coverage baseline scope changed: ${scopeKeys.join(", ")}`);
  }
  if (addedAreas.length > 0 || removedAreas.length > 0) {
    console.log(
      `Coverage baseline areas changed: added=[${addedAreas.join(", ")}], removed=[${removedAreas.join(", ")}]`,
    );
  }

  const changes = [];
  if (decreases.length > 0) changes.push(`decreases: ${decreases.join("; ")}`);
  if (scopeKeys.length > 0) changes.push(`scope keys changed: ${scopeKeys.join(", ")}`);
  if (addedAreas.length > 0 || removedAreas.length > 0) {
    changes.push(
      `areas changed: added=[${addedAreas.join(", ")}], removed=[${removedAreas.join(", ")}]`,
    );
  }
  if (changes.length === 0) return;
  if (!instrumentChange || !finding) {
    throw new Error(
      `Coverage baseline write refused (${changes.join("; ")}); pass --instrument-change <d-id> --finding <f-id>`,
    );
  }
  await assertInstrumentChange(instrumentChange, finding, cwd);
  console.log(
    `Coverage baseline write authorized by decision ${instrumentChange} for finding ${finding}`,
  );
}

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
  const options = { lcov: [], mappingOnly: false };
  for (let index = 0; index < argumentsList.length; index += 1) {
    const argument = argumentsList[index];
    if (argument === "--write-baseline") options.writeBaseline = true;
    else if (argument === "--mapping-only") options.mappingOnly = true;
    else if (argument === "--instrument-change" || argument === "--finding") {
      const value = argumentsList[++index];
      if (!value || value.startsWith("--")) throw new Error(`Missing value for ${argument}`);
      if (argument === "--instrument-change") options.instrumentChange = value;
      else options.finding = value;
    } else if (["--config", "--baseline", "--lcov"].includes(argument)) {
      const value = argumentsList[++index];
      if (!value) throw new Error(`Missing value for ${argument}`);
      if (argument === "--lcov") options.lcov.push(value);
      else options[argument.slice(2)] = value;
    } else throw new Error(`Unknown argument: ${argument}`);
  }
  if (!options.config || !options.baseline || (!options.mappingOnly && options.lcov.length === 0)) {
    throw new Error(
      "Usage: coverage-report.mjs --config <file> --baseline <file> --lcov <file> [--lcov <file>] [--mapping-only] [--write-baseline [--instrument-change <d-id> --finding <f-id>]]",
    );
  }
  if (options.mappingOnly && options.lcov.length > 0) {
    throw new Error("--mapping-only cannot be combined with --lcov");
  }
  if (options.mappingOnly && options.writeBaseline) {
    throw new Error("--mapping-only cannot be combined with --write-baseline");
  }
  const hasInstrumentChange = options.instrumentChange !== undefined;
  const hasFinding = options.finding !== undefined;
  if ((hasInstrumentChange || hasFinding) && !options.writeBaseline) {
    throw new Error("--instrument-change and --finding require --write-baseline");
  }
  if (hasInstrumentChange !== hasFinding) {
    throw new Error("--instrument-change and --finding must be used together");
  }
  return options;
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const root = process.cwd();
  const config = JSON.parse(await readFile(resolve(root, options.config), "utf8"));
  if (options.mappingOnly) {
    const baseline = JSON.parse(await readFile(resolve(root, options.baseline), "utf8"));
    assertScopeMatchesBaseline(config, baseline);
    const { productionFiles } = await assertCoverageMapping({ config, root });
    console.log(
      `Coverage mapping passed: ${productionFiles.size} production files across ${config.areas.length} areas`,
    );
    return;
  }
  const lcov = (
    await Promise.all(options.lcov.map((file) => readFile(resolve(root, file), "utf8")))
  ).join("\n");
  const areas = await buildCoverageReport({ config, configPath: options.config, lcov, root });
  if (options.writeBaseline) {
    const baselinePath = resolve(root, options.baseline);
    await guardBaselineWrite({
      areas,
      scope: scopeSignature(config),
      path: baselinePath,
      instrumentChange: options.instrumentChange,
      finding: options.finding,
      cwd: root,
    });
    await writeBaseline({
      areas,
      scope: scopeSignature(config),
      path: baselinePath,
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
