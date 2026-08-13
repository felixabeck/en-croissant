import { gzipSync } from "node:zlib";
import { readFile } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";

const BUNDLE_ASSET = /\.(?:css|js)$/u;

function isContained(path, root) {
  const pathFromRoot = relative(root, path);
  return pathFromRoot && !pathFromRoot.startsWith("..") && !isAbsolute(pathFromRoot);
}

function formatBytes(bytes) {
  return `${(bytes / 1024).toFixed(1)} KiB`;
}

function assetPath(outputDirectory, asset) {
  if (typeof asset !== "string" || !BUNDLE_ASSET.test(asset)) return undefined;
  const path = resolve(outputDirectory, asset);
  if (!isContained(path, outputDirectory)) {
    throw new Error(`Manifest asset escapes output directory: ${asset}`);
  }
  return path;
}

function collectRecordAssets(manifest, recordId, visitedRecords = new Set(), assets = new Set()) {
  if (visitedRecords.has(recordId)) return assets;
  visitedRecords.add(recordId);

  const record = manifest[recordId];
  if (!record) throw new Error(`Manifest references missing chunk: ${recordId}`);
  if (record.file) assets.add(record.file);
  for (const css of record.css ?? []) assets.add(css);
  for (const imported of record.imports ?? []) {
    collectRecordAssets(manifest, imported, visitedRecords, assets);
  }
  return assets;
}

async function gzipSize(outputDirectory, assets) {
  const sizes = await Promise.all(
    [...assets].map(async (asset) => {
      const path = assetPath(outputDirectory, asset);
      return path ? gzipSync(await readFile(path)).byteLength : 0;
    }),
  );
  return sizes.reduce((total, size) => total + size, 0);
}

function entryRecord(manifest) {
  const entries = Object.entries(manifest).filter(([, record]) => record.isEntry);
  if (entries.length !== 1) {
    throw new Error(`Expected exactly one manifest entry, found ${entries.length}`);
  }
  return entries[0];
}

/**
 * Measures transfer bytes from Vite's manifest graph. `largestLazy` is the greatest incremental
 * route/lazy import after the entry closure is cached; `total` counts every emitted JS/CSS asset once.
 */
export async function buildBundleReport({ manifest, outputDirectory }) {
  const [entryId, entry] = entryRecord(manifest);
  const entryAssets = collectRecordAssets(manifest, entryId);
  const entryBytes = await gzipSize(outputDirectory, entryAssets);

  const lazyMeasurements = await Promise.all(
    (entry.dynamicImports ?? []).map(async (lazyId) => {
      const assets = collectRecordAssets(manifest, lazyId);
      for (const cachedAsset of entryAssets) assets.delete(cachedAsset);
      return {
        id: lazyId,
        bytes: await gzipSize(outputDirectory, assets),
      };
    }),
  );
  const largestLazy = lazyMeasurements.reduce(
    (largest, measurement) => (measurement.bytes > largest.bytes ? measurement : largest),
    { id: "none", bytes: 0 },
  );

  const totalAssets = new Set();
  for (const recordId of Object.keys(manifest)) {
    collectRecordAssets(manifest, recordId, new Set(), totalAssets);
  }

  return {
    entry: entryBytes,
    largestLazy: largestLazy.bytes,
    largestLazyId: largestLazy.id,
    total: await gzipSize(outputDirectory, totalAssets),
  };
}

export function assertBundleBudget(report, budget) {
  if (budget.version !== 1 || budget.unit !== "gzipBytes" || !budget.limits) {
    throw new Error("Unsupported bundle budget format");
  }
  for (const metric of ["entry", "largestLazy", "total"]) {
    const limit = budget.limits[metric];
    if (!Number.isInteger(limit) || limit <= 0) {
      throw new Error(`Missing positive ${metric} budget limit`);
    }
    if (report[metric] > limit) {
      throw new Error(
        `${metric} bundle budget exceeded: ${formatBytes(report[metric])}, limit ${formatBytes(limit)}`,
      );
    }
  }
}

export function formatBundleReport(report, budget) {
  const line = (metric, suffix = "") =>
    `${metric}: ${formatBytes(report[metric])} / ${formatBytes(budget.limits[metric])}${suffix}`;
  return [
    "Bundle transfer budget (gzip):",
    line("entry"),
    line("largestLazy", ` (${report.largestLazyId})`),
    line("total"),
  ].join("\n");
}

function parseArguments(argumentsList) {
  const options = { budget: "bundle-budgets.json", outputDirectory: "dist" };
  for (let index = 0; index < argumentsList.length; index += 1) {
    const argument = argumentsList[index];
    if (argument === "--budget") options.budget = argumentsList[++index];
    else if (argument === "--out-dir") options.outputDirectory = argumentsList[++index];
    else throw new Error(`Unknown argument: ${argument}`);
    if (!options.budget || !options.outputDirectory)
      throw new Error(`Missing value for ${argument}`);
  }
  return options;
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const root = process.cwd();
  const outputDirectory = resolve(root, options.outputDirectory);
  const [manifestText, budgetText] = await Promise.all([
    readFile(resolve(outputDirectory, ".vite/manifest.json"), "utf8"),
    readFile(resolve(root, options.budget), "utf8"),
  ]);
  const report = await buildBundleReport({
    manifest: JSON.parse(manifestText),
    outputDirectory,
  });
  const budget = JSON.parse(budgetText);
  assertBundleBudget(report, budget);
  console.log(formatBundleReport(report, budget));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
