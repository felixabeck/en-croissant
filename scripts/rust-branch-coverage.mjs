import { spawnSync } from "node:child_process";
import { readFile, readdir, stat, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = resolve(projectRoot, "src-tauri/Cargo.toml");
const coverageTarget = resolve(projectRoot, "src-tauri/target/llvm-cov-target");
const dependencies = resolve(coverageTarget, "debug/deps");
const outputDirectory = resolve(projectRoot, "backend-coverage");
const outputPath = resolve(outputDirectory, "lcov.info");
const profilePath = resolve(outputDirectory, "src-tauri.profdata");
const coverageConfigPath = resolve(projectRoot, "backend-coverage-areas.json");
const toolchain = "nightly-2025-06-01";

function run(command, argumentsList, options = {}) {
  const result = spawnSync(command, argumentsList, {
    cwd: projectRoot,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    ...options,
  });
  if (result.status !== 0) {
    if (result.stderr) process.stderr.write(result.stderr);
    throw result.error ?? new Error(`${command} exited with status ${result.status}`);
  }
  return result.stdout ?? "";
}

async function filesBelow(directory, predicate) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const path = resolve(directory, entry.name);
      if (entry.isDirectory()) return filesBelow(path, predicate);
      return entry.isFile() && predicate(path) ? [path] : [];
    }),
  );
  return files.flat();
}

run(
  "cargo",
  [
    `+${toolchain}`,
    "llvm-cov",
    "--manifest-path",
    manifestPath,
    "--bin",
    "en-croissant",
    "--locked",
    "--branch",
    "--no-report",
  ],
  { stdio: "inherit" },
);

const sysroot = run("rustup", ["run", toolchain, "rustc", "--print", "sysroot"]).trim();
const llvmTools = resolve(sysroot, "lib/rustlib/x86_64-unknown-linux-gnu/bin");
const llvmProfdata = resolve(llvmTools, "llvm-profdata");
const llvmCov = resolve(llvmTools, "llvm-cov");

const profiles = await filesBelow(coverageTarget, (path) => path.endsWith(".profraw"));
if (profiles.length === 0) throw new Error("Rust coverage produced no raw profiles");
run(llvmProfdata, ["merge", "-sparse", "-o", profilePath, ...profiles]);

const executableCandidates = [];
for (const entry of await readdir(dependencies)) {
  if (!/^en_croissant-[0-9a-f]+$/.test(entry)) continue;
  const path = resolve(dependencies, entry);
  const details = await stat(path);
  if (details.isFile() && (details.mode & 0o111) !== 0)
    executableCandidates.push({ path, modified: details.mtimeMs });
}
if (executableCandidates.length === 0)
  throw new Error("Rust coverage test executable was not found");
executableCandidates.sort((left, right) => right.modified - left.modified);
const executable = executableCandidates[0].path;

// LLVM currently crashes while exporting this crate's complete branch map in one
// invocation. Per-source exports consume the identical instrumented profile and
// preserve exact LCOV branch counters without dropping the branch gate.
const coverageConfig = JSON.parse(await readFile(coverageConfigPath, "utf8"));
const excludedSources = new Set(
  coverageConfig.sources.flatMap((source) =>
    source.exclude.map((entry) =>
      resolve(projectRoot, typeof entry === "string" ? entry : entry.pattern),
    ),
  ),
);
const sources = await filesBelow(
  resolve(projectRoot, "src-tauri/src"),
  (path) => path.endsWith(".rs") && !excludedSources.has(path),
);
const records = [];
for (const source of sources.sort()) {
  const lcov = run(llvmCov, [
    "export",
    "-format=lcov",
    `-instr-profile=${profilePath}`,
    executable,
    "-sources",
    source,
  ]);
  if (lcov.includes("SF:")) records.push(lcov.trimEnd());
}
if (records.length === 0) throw new Error("Rust branch coverage export was empty");
await writeFile(outputPath, `${records.join("\n")}\n`);

const branchRecords = records.reduce(
  (total, record) => total + (record.match(/^BRDA:/gm)?.length ?? 0),
  0,
);
if (branchRecords === 0) throw new Error("Rust coverage export contains no branch data");
console.log(`Rust LCOV: ${records.length} sources, ${branchRecords} branch records`);
