import { readdir, readFile, writeFile } from "node:fs/promises";
import { relative, resolve, sep } from "node:path";

const METRICS = ["lines", "functions", "branches"];

function emptyMetrics() {
  return Object.fromEntries(METRICS.map((metric) => [metric, { covered: 0, total: 0 }]));
}

function globToRegExp(pattern) {
  let expression = "";
  for (let index = 0; index < pattern.length; index += 1) {
    if (pattern.slice(index, index + 3) === "**/") {
      expression += "(?:.*/)?";
      index += 2;
    } else if (pattern.slice(index, index + 2) === "**") {
      expression += ".*";
      index += 1;
    } else if (pattern[index] === "*") {
      expression += "[^/]*";
    } else {
      expression += pattern[index].replace(/[.+^${}()|[\]\\]/g, "\\$&");
    }
  }
  return new RegExp(`^${expression}$`);
}

function matches(path, patterns) {
  return patterns.some((pattern) => globToRegExp(pattern).test(path));
}

function excluded(path, source) {
  return matches(
    path,
    source.exclude.map((entry) => (typeof entry === "string" ? entry : entry.pattern)),
  );
}

function normalisePath(path, root) {
  const absolute = resolve(root, path);
  return relative(root, absolute).split(sep).join("/");
}

async function filesBelow(directory, root) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = resolve(directory, entry.name);
      if (entry.isDirectory()) return filesBelow(fullPath, root);
      return entry.isFile() ? [normalisePath(fullPath, root)] : [];
    }),
  );
  return files.flat(Infinity);
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

export async function buildCoverageReport({ config, lcov, root }) {
  const productionFiles = new Map();
  for (const source of config.sources) {
    const files = await filesBelow(resolve(root, source.root), root);
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
  }

  const missingFiles = [...productionFiles.keys()].filter((file) => !filesWithCoverage.has(file));
  if (missingFiles.length)
    throw new Error(`Coverage data missing for production files: ${missingFiles.join(", ")}`);
  for (const area of config.areas) {
    if (coverageFilesByArea[area.id] === 0)
      throw new Error(`Coverage data missing for area: ${area.id}`);
  }
  return report;
}

/**
 * The globs that decide *what gets measured*. Numbers alone cannot tell deleting
 * an untested file apart from carving one out of the measured set: both leave
 * `covered` unchanged and shrink `total`. Pinning the scope separates them, so
 * the ratchets below can judge coverage without also having to police the
 * denominator.
 */
export function scopeSignature(config) {
  return {
    sources: config.sources.map((source) => ({
      id: source.id,
      root: source.root,
      include: [...source.include].sort(),
      exclude: source.exclude
        .map((entry) => (typeof entry === "string" ? entry : entry.pattern))
        .sort(),
    })),
    areas: config.areas.map((area) => ({
      id: area.id,
      source: area.source,
      paths: [...area.paths].sort(),
    })),
  };
}

export function assertBaseline(report, baseline, config) {
  if (baseline.version !== 1 || !baseline.areas)
    throw new Error("Unsupported coverage baseline format");
  if (config) {
    const actualScope = JSON.stringify(scopeSignature(config));
    if (!baseline.scope) throw new Error("Coverage baseline is missing its recorded scope");
    if (JSON.stringify(baseline.scope) !== actualScope) {
      throw new Error(
        "Coverage measurement scope changed: the include/exclude globs no longer match the " +
          "baseline. Narrowing the measured set hides untested code without changing any " +
          "percentage. Re-record it deliberately with the matching coverage:baseline:* script.",
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
      //   - covered may never drop, so tested code cannot be deleted to win;
      //   - the ratio may never drop, so untested code cannot be added to win
      //     (a growing total with unchanged covered fails here).
      // A *shrinking* total is what deleting dead or untested code looks like.
      // That improves both ratchets and must pass.
      const regressed =
        actual.covered < prior.covered ||
        actual.covered * prior.total < prior.covered * actual.total;
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

export async function writeBaseline({ areas, scope, path }) {
  await writeFile(path, `${JSON.stringify({ version: 1, scope, areas }, null, 2)}\n`);
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
  const areas = await buildCoverageReport({ config, lcov, root });
  if (options.writeBaseline) {
    await writeBaseline({
      areas,
      scope: scopeSignature(config),
      path: resolve(root, options.baseline),
    });
    console.log(`Wrote coverage baseline: ${options.baseline}`);
  } else {
    const baseline = JSON.parse(await readFile(resolve(root, options.baseline), "utf8"));
    assertBaseline(areas, baseline, config);
    assertAreaFloors(areas, config);
    console.log("Coverage ratchet and area floors passed");
  }
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
