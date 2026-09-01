import { spawnSync } from "node:child_process";
import { readFile, readdir, stat, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { excluded, normalisePath } from "./coverage-scope.mjs";
import { RUST_COVERAGE_TOOLCHAIN } from "./toolchain-versions.mjs";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = resolve(projectRoot, "src-tauri/Cargo.toml");
const coverageTarget = resolve(projectRoot, "src-tauri/target/llvm-cov-target");
const dependencies = resolve(coverageTarget, "debug/deps");
const outputDirectory = resolve(projectRoot, "backend-coverage");
const outputPath = resolve(outputDirectory, "lcov.info");
const profilePath = resolve(outputDirectory, "src-tauri.profdata");
const coverageConfigPath = resolve(projectRoot, "backend-coverage-areas.json");
const toolchain = RUST_COVERAGE_TOOLCHAIN;

function attempt(command, argumentsList, options = {}) {
  return spawnSync(command, argumentsList, {
    cwd: projectRoot,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    ...options,
  });
}

function run(command, argumentsList, options = {}) {
  const result = attempt(command, argumentsList, options);
  if (result.status !== 0) {
    if (result.stderr) process.stderr.write(result.stderr);
    if (result.error) throw result.error;
    // A process killed by a signal reports status null, which on its own names
    // neither the signal nor the command that died.
    if (result.signal)
      throw new Error(
        `${command} died with ${result.signal}: ${command} ${argumentsList.join(" ")}`,
      );
    throw new Error(`${command} exited with status ${result.status}`);
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

/** One argv for both the bulk export and the per-source crash probe. */
export function llvmCovExportArgs(profilePath, executable, sources) {
  return [
    "export",
    "-format=lcov",
    `-instr-profile=${profilePath}`,
    executable,
    "-sources",
    ...sources,
  ];
}

export function probeCrashingSources(runAttempt, llvmCov, profilePath, executable, sources) {
  return sources.filter(
    (source) =>
      runAttempt(llvmCov, llvmCovExportArgs(profilePath, executable, [source])).signal != null,
  );
}

export function formatExportCrashMessage(offenders, toRelativePath) {
  return [
    "llvm-cov segfaulted while exporting these sources:",
    ...offenders.map((source) => `  ${toRelativePath(source)}`),
    "This is the --branch coverage crash in upstream llvm/llvm-project#119558.",
    "Declare them in backend-coverage-areas.json exclude, with a reason.",
  ].join("\n");
}

async function main() {
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

  // Under --branch coverage, llvm-cov segfaults in
  // CoverageMapping::getInstantiationGroups on certain sources, so those have to stay
  // out of the export. Upstream llvm/llvm-project#119558 (open since Dec 2024, still
  // present in LLVM 22.1) is tracking it: it fires only with --branch, and the crashing
  // files there are macro-expanded code (#[async_trait] impls) that carry plenty of
  // coverage records. So do NOT assume the trigger is "a file with no records" — that
  // happens to describe this crate's three, and would not describe a macro-heavy file
  // added later. Measured here: db/schema.rs (a Diesel table! block) crashes any export
  // it takes part in, while engine/mod.rs and infra/mod.rs crash only when exported on
  // their own. All three are declared in backend-coverage-areas.json's exclude list.
  // This is NOT a limit on how many sources one invocation can take: one export over
  // the remaining sources yields byte-identical LCOV to one export per source.
  const coverageConfig = JSON.parse(await readFile(coverageConfigPath, "utf8"));
  const sources = (
    await filesBelow(resolve(projectRoot, "src-tauri/src"), (path) => path.endsWith(".rs"))
  )
    .filter((path) => {
      const relativePath = normalisePath(path, projectRoot);
      return !coverageConfig.sources.some((source) => excluded(relativePath, source));
    })
    .sort();
  if (sources.length === 0) throw new Error("Rust coverage found no sources to export");

  const exportArguments = llvmCovExportArgs(profilePath, executable, sources);
  const exported = attempt(llvmCov, exportArguments);

  // Name the sources that actually crash instead of failing with a bare "exited with
  // status null": re-probing each one costs well under a second and runs only on this
  // path. It reports what crashed, without assuming why.
  if (exported.signal) {
    const offenders = probeCrashingSources(attempt, llvmCov, profilePath, executable, sources);
    if (offenders.length > 0)
      throw new Error(
        formatExportCrashMessage(offenders, (source) => normalisePath(source, projectRoot)),
      );
  }
  if (exported.status !== 0) {
    if (exported.stderr) process.stderr.write(exported.stderr);
    if (exported.error) throw exported.error;
    throw new Error(
      `${llvmCov} died with ${exported.signal ?? `status ${exported.status}`} while exporting LCOV`,
    );
  }

  const lcov = exported.stdout ?? "";
  const sourceCount = lcov.match(/^SF:/gm)?.length ?? 0;
  if (sourceCount === 0) throw new Error("Rust branch coverage export was empty");
  await writeFile(outputPath, `${lcov.trimEnd()}\n`);

  const branchRecords = lcov.match(/^BRDA:/gm)?.length ?? 0;
  if (branchRecords === 0) throw new Error("Rust coverage export contains no branch data");
  console.log(`Rust LCOV: ${sourceCount} sources, ${branchRecords} branch records`);
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  await main();
}
