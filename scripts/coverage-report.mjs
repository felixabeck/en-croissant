/**
 * The failure matrix for this artefact.
 *
 * `push-review-policy.md:211-219` asks that a verification artefact whose output is read as
 * evidence outside a test run carry, in its own header, the message and exit status each of its
 * assertions was *seen* to produce; `:221-243` asks that the enumeration be complete, every path
 * staged or argued. This script is such an artefact — `package.json:37,40` and
 * `.github/workflows/test.yml:157,230` cite its exit status for both coverage ratchets and both
 * area-floor gates — and until 2026-09-22 it had no matrix at all (`f-20260921-02`).
 *
 * **Every row below was run.** The enumeration was rebuilt from this source rather than copied
 * from the finding: two `grep` passes — `throw new Error|process.exitCode|stderr.write`, then
 * `await |spawnSync` for the rejections that reach `main().catch` — plus a reading of every entry
 * point's parameters for the class neither pattern can see, a property access on unvalidated input
 * before it is checked. Five consecutive review rounds corrected a matrix that had been assembled
 * from the previous matrix, and each inherited the last one's errors; that is why this one starts
 * from the file.
 *
 * **42 distinct failure paths**, plus one swallowed cleanup path that deliberately produces no
 * failure of its own (row 32) and one shared sink (row 41). No row is *argued*: every one is
 * staged. "Argued" is reserved for a path that could only be reached by editing the verifier,
 * doing harm that outlives the run, or touching something the run may not modify, and none of
 * these is. Rows are staged against scratch directories and scratch configs; nothing here names
 * `coverage-baselines.json` or `backend-coverage-baselines.json` as a target.
 *
 * Module-level rows are reached by calling the exported function directly, which is a real caller:
 * `scripts/coverage-report-tests.mjs` does the same. Their exit status is the CLI's only when they
 * are reached through it, and row 41 records what that is. `TypeError` rows are the wrong-shape
 * class and are recorded as what they are, not dressed up as diagnostics.
 *
 *  #  site                what fails                          message (to its distinguishing part)
 * --- ------------------- ---------------------------------- ------------------------------------
 *  1  :254    assignArea   no area claims a production file   `Unmapped production file: src/other.ts`
 *  2  :254    assignArea   two areas claim the same file      `Production file belongs to multiple
 *                                                             coverage areas: src/utils/a.ts
 *                                                             (utilities, second)`
 *  3  :293                 an area's declared source is not   `Coverage area utilities has the
 *                          the source the file came from      wrong source for src/utils/example.ts`
 *  4  :313                 a production file has no LCOV      `Coverage data missing for production
 *                          record at all                      files: src/utils/example.ts`
 *  5  :329                 an undeclared blank record         `Coverage measurement is blank for
 *                          (condition 1)                      production files: src/utils/blank.ts.`
 *  6  :339                 a declared path outside the        `Coverage statementFree declarations
 *                          measured set (condition 2)         are outside the measured production
 *                                                             set: src/gone.ts.`
 *  7  :349                 a declared path that is measured   `Coverage statementFree declarations
 *                          and not blank (condition 3)        are no longer blank:
 *                                                             src/utils/example.ts.`
 *  8  :355                 a configured area with no          `Coverage data missing for area:
 *                          measured file at all               empty`
 *  9  :273    ->           the source root is unreadable      `EACCES: permission denied, scandir
 *      files-below.mjs:5   (readdir at the root)              '<root>/src'`
 * 10  files-below.mjs:5    a directory *below* the source     `EACCES: permission denied, scandir
 *      via :9 recursion    root is unreadable                 '<root>/src/locked'`
 * 11  :312                 config of the wrong shape: `{}`    TypeError: `config.sources is not
 *                                                             iterable`
 * 12  :336                 `{"sources":[],"areas":null}`      TypeError: `Cannot read properties of
 *                                                             null (reading 'map')`
 * 13  :317    ->           a source with no `include` list    TypeError: `Cannot read properties of
 *      coverage-scope.mjs:34                                   undefined (reading 'some')`
 * 14  :317    ->           a source with no `exclude` list    TypeError: `Cannot read properties of
 *      coverage-scope.mjs:39                                   undefined (reading 'map')`
 * 14a :361                 a `statementFree` that is not an    TypeError: `(source.statementFree ??
 *                          array: `{}`                        []).map is not a function`
 * 14b :361                 a `statementFree` entry that is     TypeError: `Cannot destructure
 *                          not an object: `[null]`            property 'path' of 'object null' as
 *                                                             it is null.`
 * 15  :211    parseLcov    given something not a string       TypeError: `Cannot read properties of
 *                                                             null (reading 'replaceAll')`
 * 16  :431                 the baseline's version is not 1    `Unsupported coverage baseline format`
 *                          or it carries no `areas`
 * 17  :434                 no recorded scope, checked         `Coverage baseline is missing its
 *                          against a config                   recorded scope`
 * 18  :437                 the recorded scope no longer       `Coverage measurement scope changed:
 *                          matches the config                 source ids and roots, include globs,
 *                                                             exclude globs, statementFree
 *                                                             declarations, or area ids, sources,
 *                                                             and paths ... Re-record the scope
 *                                                             subtree by hand ...`
 * 19  :448                 a measured area the baseline       `Missing baseline for area: utilities`
 *                          does not carry
 * 20  :453                 a baseline area missing one        `Missing functions baseline for area:
 *                          metric                             utilities`
 * 21  :486                 a covered count or ratio           `utilities lines regressed: 1/2,
 *                          regressed                          baseline 2/2`
 * 22  :492                 a baseline area absent from the    `Baseline references unknown area:
 *                          report                             ghost`
 * 23  :430                 a baseline of the wrong shape:     TypeError: `Cannot read properties of
 *                          `null`                             null (reading 'version')`
 * 24  :500                 an area with no                    `Missing minimum coverage for area:
 *                          `minimumCoverage`                  utilities`
 * 25  :502                 an area with no entry in the       `Missing coverage report for area:
 *                          report. Reachable through the      utilities`
 *                          exported API, not through the
 *                          CLI, and it stays for that
 * 26  :506                 a minimum that is not a            `Invalid lines minimum coverage for
 *                          percentage                         area: utilities`
 * 27  :512                 a measured area below its floor    `utilities lines is below minimum
 *                                                             coverage: 50.00% < 80.00%`
 * 28  :532                 the temporary write rejects        the rejection, unchanged:
 *                                                             `writeFile refused`
 * 29  :550                 the formatter exits non-zero       `Failed to format coverage baseline
 *                                                             with <path>: status=23; signal=null;
 *                                                             stderr="rejected"`
 * 29b :550                 the formatter is killed by a       `... status=null; signal=SIGTERM;
 *                          signal                             stderr=""` -- `status !== 0` is true
 *                                                             for `null`, so a kill is caught
 *                                                             rather than reported as success
 * 30  :550                 the formatter binary is missing    `... status=null; signal=null;
 *                                                             stderr=""; error.code=ENOENT;
 *                                                             error.message="spawnSync <path>
 *                                                             ENOENT"`
 * 31  :554                 the rename into place rejects      the rejection, unchanged:
 *                                                             `rename refused`
 * 32  :523                 cleanup's unlink rejects after a   **no failure of its own**: the
 *                          failure. Deliberately swallowed    primary error is rethrown unchanged
 *                          so it cannot replace the           (`rename refused`) and the temporary
 *                          actionable error                   file survives as evidence
 * 33  :568                 an option with no value            `Missing value for --config`
 *                                                             — exit 1
 * 34  :571                 an unknown argument                `Unknown argument: --nope` — exit 1
 * 35  :575                 a required option omitted          `Usage: coverage-report.mjs --config
 *                                                             <file> ...` — exit 1
 * 36  :584                 the config file does not exist     `ENOENT: no such file or directory,
 *                                                             open '<root>/missing.json'` — exit 1
 * 37  :584                 the config file is not JSON        SyntaxError: `Expected property name
 *                                                             or '}' in JSON at position 2` — exit 1
 * 38  :586                 an LCOV file does not exist        `ENOENT: ... '<root>/missing.info'`
 *                                                             — exit 1
 * 39  :597                 the baseline file does not exist   `ENOENT: ... '<root>/missing.json'`
 *                                                             — exit 1
 * 40  :597                 the baseline file is not JSON      SyntaxError, as row 37 — exit 1
 * 41  :611                 `main().catch` — the shared sink,  every throw above, reached through
 *                          **not an independent failure**     the CLI, prints `error.message` on
 *                                                             stderr and exits **1**. Measured with
 *                                                             row 17's throw: exit 1, message on
 *                                                             stderr, nothing on stdout
 *
 * **The rows the blank-measurement work added or changed were also staged against the real
 * frontend LCOV**, not only against fixtures, because that is the artefact an operator runs. Rows
 * 5 and 7 were run twice there, once with one offender and once with two, since a message naming
 * only the first offender passes every single-offender run; row 6 four times, because a dead
 * declaration has two distinct shapes and each got both offender counts; row 18 once, a scope
 * mismatch having no offender list to aggregate. Nine runs, one record each, all exit 1:
 *
 *   row 5   staged by raw-importing one never-imported production file, then two:
 *           `... files: src/components/boards/EditingCard.tsx.` and
 *           `... files: src/components/boards/AnnotationHint.tsx,
 *           src/components/boards/EditingCard.tsx.` — one message, both paths, sorted. The gate
 *           was measured green before and green again after the throwaway test was deleted.
 *   row 6   scratch config declaring `src/does-not-exist.ts`, then it and `src/also-missing.ts`;
 *           and separately `src/routeTree.gen.ts`, then it and `src/vite-env.d.ts` — files that
 *           exist on disk and are excluded, because condition 2 is measured-set membership and
 *           not filesystem existence.
 *   row 7   scratch config declaring `src/utils/format.ts`, then it and `src/utils/chess.ts`.
 *   row 18  a scratch baseline whose recorded scope was one `statementFree` entry stale — and the
 *           message does **not** name `coverage:baseline:*`, which is the route this repository
 *           denies.
 *
 * What this matrix does **not** cover, stated rather than implied: `parseLcov`'s tolerance of
 * malformed counter lines, which fail no assertion and are merged as written; and the behaviour of
 * any consumer of this script beyond its exit status and `error.message`.
 */
import { spawnSync } from "node:child_process";
import { readFile, rename as renameFile, unlink as unlinkFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { excluded, excludePatterns, matches, normalisePath } from "./coverage-scope.mjs";
import { isEntrypoint } from "./entrypoint.mjs";
import { filesBelow } from "./files-below.mjs";

const METRICS = ["lines", "functions", "branches"];

// Counter identities are built from LCOV field values, which are unvalidated text that may itself
// contain a colon. Joining them on a character no field can hold keeps two different declarations
// from colliding on one identity -- `FN:1:f,f` and `FN:1,f` are two functions, and a colon-joined
// key made the second one look like a repeat of the first.
const FIELD = "\u0000";

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
export function parseLcov(lcov, identify = (file) => file) {
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
    if (!report) continue;
    if (key === "DA") {
      const [line, hits, checksum = ""] = value.split(",");
      addCounter(report.lines, `${line}${FIELD}${checksum}`, Number(hits));
    } else if (key === "FN") {
      // The occurrence index counts same-named declarations *on the same line*, not same-named
      // declarations anywhere in the file. Both spellings disambiguate the only case that needs
      // it -- two functions sharing a name and a line -- but only this one is independent of
      // declaration order, and two records for one file need not list their functions in the same
      // order. Counting per name made `FN:10,f; FN:20,f` and `FN:20,f; FN:10,f` four distinct
      // functions instead of two. `functionIdsByName` keeps declaration order regardless, because
      // that is what pairs an `FNDA` line with its `FN`.
      const [line, name] = value.split(",");
      const functionsWithName = report.functionIdsByName.get(name) ?? [];
      const declarationKey = `${line}${FIELD}${name}`;
      const sameLine = report.functionsByDeclaration.get(declarationKey) ?? 0;
      const identity = `${declarationKey}${FIELD}${sameLine}`;
      report.functionsByDeclaration.set(declarationKey, sameLine + 1);
      report.functions.set(identity, 0);
      functionsWithName.push(identity);
      report.functionIdsByName.set(name, functionsWithName);
    } else if (key === "FNDA") {
      const [hits, name] = value.split(",");
      const occurrence = report.functionDataOccurrences.get(name) ?? 0;
      const identity =
        report.functionIdsByName.get(name)?.[occurrence] ??
        `${FIELD}unmatched${FIELD}${name}${FIELD}${occurrence}`;
      report.functionDataOccurrences.set(name, occurrence + 1);
      addCounter(report.functions, identity, Number(hits));
    } else if (key === "BRDA") {
      const [line, block, branch, hits] = value.split(",");
      addCounter(
        report.branches,
        `${line}${FIELD}${block}${FIELD}${branch}`,
        hits === "-" ? 0 : Number(hits),
      );
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

  // Every production file's area must belong to the source the file came from. This is the only
  // place that is checked, and the LCOV loop below deliberately does not repeat it: it reaches a
  // record only when `productionFiles` already holds the file, this loop has run the identical
  // comparison over every entry of that map, and neither the map nor `assignArea` -- a pure
  // function of (path, config) -- changes in between. The duplicate copy was therefore dead for
  // every input and unreachable by any caller, being interior to this function, and was removed
  // (`f-20260921-02`). `assertAreaFloors`' similar-looking branch is a different case: it is
  // exported and the tests call it directly, so it stays.
  for (const [file, sourceId] of productionFiles) {
    const area = assignArea(file, config);
    if (area.source !== sourceId)
      throw new Error(`Coverage area ${area.id} has the wrong source for ${file}`);
  }

  const report = Object.fromEntries(config.areas.map((area) => [area.id, emptyMetrics()]));
  const coverageFilesByArea = Object.fromEntries(config.areas.map((area) => [area.id, 0]));
  // `parseLcov` is given the normaliser, so every spelling of one file arrives as ONE record with
  // its counters unioned. Doing it here instead would be too late twice over: the area totals
  // below would add the same file's records once each, and the blank check further down would see
  // whichever record happened to come last.
  const coverageMetricsByFile = new Map();
  for (const record of parseLcov(lcov, (file) => normalisePath(file, root))) {
    const file = record.file;
    const sourceId = productionFiles.get(file);
    if (!sourceId) continue;
    const area = assignArea(file, config);
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
