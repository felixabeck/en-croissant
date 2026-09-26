#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { constants, accessSync, existsSync } from "node:fs";
import { delimiter, dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { isEntrypoint } from "./entrypoint.mjs";

// Staged failure matrix (push-review-policy §2; scratch Rust edits were reverted):
// (a) unguarded test called existing Unix-only authority_at: `error[E0425]: cannot find function `authority_at` in this scope`; exit 101.
//     Gate line: `cargo clippy --manifest-path src-tauri/Cargo.toml --target x86_64-pc-windows-gnu --all-targets --locked -- -D warnings failed with exit status 101.`
// (b) private helper used only by a Unix-gated test: `error: function `windows_cross_gate_staged_unix_only_use` is never used`; Linux clippy exit 0; Windows gate exit 101.
//     Gate line: `cargo clippy --manifest-path src-tauri/Cargo.toml --target x86_64-pc-windows-gnu --all-targets --locked -- -D warnings failed with exit status 101.`
// (c) empty explicit prefix: `Windows GNU cross compiler missing from CHESSFABLE_MINGW_PREFIX: /tmp/chessfable-windows-cross.wlDKqQ/empty-prefix`; exit 1.
// (d) unset prefix, scratch HOME, PATH without MinGW: `Windows GNU cross compiler not found on PATH or in the default prefix`; exit 1.
// (e) rustup shim omitted the target: `Rust target x86_64-pc-windows-gnu is not installed.`; `  Run: rustup target add x86_64-pc-windows-gnu`; exit 1.
// (f) printed apt recipe run verbatim for an empty scratch CHESSFABLE_MINGW_PREFIX: before, `Windows GNU cross compiler missing from CHESSFABLE_MINGW_PREFIX: <prefix>`, exit 1;
//     recipe exit 0; then the gate with a scratch CARGO_TARGET_DIR compiled 260 crates, zstd-sys's C build included, and exited 0.
// (g) scratch PATH without rustup: `Could not start rustup target list --installed: spawnSync rustup ENOENT`; exit 1.
// (h) scratch rustup exited 7: `rustup target list --installed failed with exit status 7.`; exit 7.
// (i) scratch PATH had rustup but no cargo: `Could not start cargo clippy --manifest-path src-tauri/Cargo.toml --target x86_64-pc-windows-gnu --all-targets --locked -- -D warnings: spawnSync cargo ENOENT`; exit 1.
// (j) scratch cargo was terminated: `cargo clippy --manifest-path src-tauri/Cargo.toml --target x86_64-pc-windows-gnu --all-targets --locked -- -D warnings was terminated by SIGTERM.`; exit 1.
// (k) injected spawn function threw: `Could not start rustup target list --installed: synthetic spawn failure`; exit 1.
// (l) scratch rustup was terminated: `rustup target list --installed was terminated by SIGTERM.`; exit 1.

export const WINDOWS_GNU_TARGET = "x86_64-pc-windows-gnu";
export const MINGW_COMPILER = "x86_64-w64-mingw32-gcc";
export const CARGO_CLIPPY_ARGUMENTS = Object.freeze([
  "clippy",
  "--manifest-path",
  "src-tauri/Cargo.toml",
  "--target",
  WINDOWS_GNU_TARGET,
  "--all-targets",
  "--locked",
  "--",
  "-D",
  "warnings",
]);

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const APT_MINGW_PACKAGES = Object.freeze([
  "binutils-common",
  "binutils-mingw-w64-x86-64",
  "gcc-mingw-w64-base",
  "gcc-mingw-w64-x86-64",
  "gcc-mingw-w64-x86-64-posix",
  "gcc-mingw-w64-x86-64-posix-runtime",
  "gcc-mingw-w64-x86-64-win32",
  "gcc-mingw-w64-x86-64-win32-runtime",
  "mingw-w64-common",
  "mingw-w64-x86-64-dev",
]);

const defaultFileSystem = Object.freeze({ existsSync, accessSync });

function executableExists(path, fileSystem) {
  try {
    if (typeof fileSystem.accessSync === "function") {
      fileSystem.accessSync(path, constants.X_OK);
      return true;
    }
    return fileSystem.existsSync(path);
  } catch {
    return false;
  }
}

export function probeExecutableOnPath(
  executable,
  { pathValue, fileSystem = defaultFileSystem, cwd = process.cwd() } = {},
) {
  if (typeof pathValue !== "string" || pathValue.length === 0) return undefined;
  for (const directory of pathValue.split(delimiter)) {
    const candidate = resolve(cwd, directory || ".", executable);
    if (executableExists(candidate, fileSystem)) return candidate;
  }
  return undefined;
}

function resolvePrefix(pathValue, repoRoot) {
  return isAbsolute(pathValue) ? resolve(pathValue) : resolve(repoRoot, pathValue);
}

function compilerAtPrefix(prefix) {
  return join(prefix, "usr", "bin", MINGW_COMPILER);
}

/** Resolve the GNU cross compiler without starting a process or changing the environment. */
export function resolveWindowsGnuCompiler({
  env = process.env,
  fileSystem = defaultFileSystem,
  probeOnPath = probeExecutableOnPath,
  repoRoot = process.cwd(),
} = {}) {
  if (env.CHESSFABLE_MINGW_PREFIX !== undefined) {
    const prefix = resolvePrefix(env.CHESSFABLE_MINGW_PREFIX, repoRoot);
    const compilerPath = compilerAtPrefix(prefix);
    return executableExists(compilerPath, fileSystem)
      ? { ok: true, source: "explicit-prefix", prefix, compilerPath }
      : { ok: false, reason: "explicit-prefix-missing", prefix, compilerPath };
  }

  const pathCompiler = probeOnPath(MINGW_COMPILER, {
    pathValue: env.PATH,
    fileSystem,
    cwd: repoRoot,
  });
  if (pathCompiler) {
    return { ok: true, source: "path", compilerPath: resolve(pathCompiler) };
  }

  const prefix =
    typeof env.HOME === "string" && env.HOME.length > 0
      ? resolvePrefix(join(env.HOME, ".local", "opt", "mingw"), repoRoot)
      : undefined;
  const compilerPath = prefix ? compilerAtPrefix(prefix) : undefined;
  if (compilerPath && executableExists(compilerPath, fileSystem)) {
    return { ok: true, source: "default-prefix", prefix, compilerPath };
  }

  return {
    ok: false,
    reason: "not-found",
    pathValue: env.PATH,
    prefix,
    compilerPath,
  };
}

function shellQuote(value) {
  return `'${value.replaceAll("'", "'\\''")}'`;
}

function defaultPrefixExpression() {
  return '"$HOME/.local/opt/mingw"';
}

function childPathExpression(prefix, suffix) {
  if (prefix) return shellQuote(join(prefix, suffix));
  return `"$HOME/.local/opt/mingw/${suffix}"`;
}

/** Format the actionable compiler setup message for a failed resolution. */
export function formatMissingCompilerMessage(resolution) {
  const targetPrefix = resolution.prefix;
  const compilerPath =
    resolution.compilerPath ?? "<HOME is unset; default prefix cannot be resolved>";
  const firstLine =
    resolution.reason === "explicit-prefix-missing"
      ? `Windows GNU cross compiler missing from CHESSFABLE_MINGW_PREFIX: ${targetPrefix}`
      : "Windows GNU cross compiler not found on PATH or in the default prefix";
  const debs = childPathExpression(targetPrefix, "debs");
  const destination = targetPrefix ? shellQuote(targetPrefix) : defaultPrefixExpression();
  const bin = targetPrefix
    ? shellQuote(join(targetPrefix, "usr", "bin"))
    : '"$HOME/.local/opt/mingw/usr/bin"';
  const gccLink = targetPrefix
    ? shellQuote(join(targetPrefix, "usr", "bin", MINGW_COMPILER))
    : `${bin}/x86_64-w64-mingw32-gcc`;
  const cppLink = targetPrefix
    ? shellQuote(join(targetPrefix, "usr", "bin", "x86_64-w64-mingw32-cpp"))
    : `${bin}/x86_64-w64-mingw32-cpp`;
  const packageDownload = `apt-get download ${APT_MINGW_PACKAGES.join(" ")}`;
  return [
    firstLine,
    `  Attempted compiler path: ${compilerPath}`,
    resolution.reason === "not-found"
      ? `  PATH searched: ${resolution.pathValue ?? "<unset>"}`
      : undefined,
    `  Apt-based setup for prefix ${targetPrefix ?? "$HOME/.local/opt/mingw"}:`,
    `  mkdir -p ${debs} && cd ${debs} && ${packageDownload}`,
    `  for package in ${debs}/*.deb; do dpkg-deb -x "$package" ${destination}; done`,
    `  ln -sfn x86_64-w64-mingw32-gcc-posix ${gccLink}`,
    `  ln -sfn x86_64-w64-mingw32-cpp-posix ${cppLink}`,
    "  For non-apt systems, install x86_64-w64-mingw32-gcc and put it on PATH or set CHESSFABLE_MINGW_PREFIX.",
  ]
    .filter(Boolean)
    .join("\n");
}

/** Format the missing rustup target remedy. */
export function formatMissingRustTargetMessage() {
  return [
    `Rust target ${WINDOWS_GNU_TARGET} is not installed.`,
    `  Run: rustup target add ${WINDOWS_GNU_TARGET}`,
  ].join("\n");
}

/** Format a spawn failure with the command that could not be started. */
export function formatSpawnErrorMessage(command, error) {
  const detail = error instanceof Error ? error.message : String(error);
  return `Could not start ${command}: ${detail}`;
}

/** Format a process failure that returned a non-zero status or signal. */
export function formatProcessFailureMessage(command, result) {
  if (result.status !== null && result.status !== undefined) {
    return `${command} failed with exit status ${result.status}.`;
  }
  return `${command} was terminated${result.signal ? ` by ${result.signal}` : " without an exit status"}.`;
}

function startProcess(spawn, command, argumentsList, options) {
  try {
    return spawn(command, argumentsList, options);
  } catch (error) {
    return { error };
  }
}

/** Run the cross-target prerequisite checks and clippy; dependencies are injectable for tests. */
export function runWindowsGnuCheck({
  env = process.env,
  fileSystem = defaultFileSystem,
  probeOnPath = probeExecutableOnPath,
  spawn = spawnSync,
  repoRoot = projectRoot,
  writeOutput = console.log,
  writeError = console.error,
} = {}) {
  const resolution = resolveWindowsGnuCompiler({ env, fileSystem, probeOnPath, repoRoot });
  if (!resolution.ok) {
    writeError(formatMissingCompilerMessage(resolution));
    return 1;
  }

  const rustupArguments = ["target", "list", "--installed"];
  const rustupCommand = "rustup target list --installed";
  const rustupResult = startProcess(spawn, "rustup", rustupArguments, {
    cwd: repoRoot,
    env,
    encoding: "utf8",
    stdio: ["inherit", "pipe", "inherit"],
  });
  if (rustupResult.error) {
    writeError(formatSpawnErrorMessage(rustupCommand, rustupResult.error));
    return 1;
  }
  if (rustupResult.status !== 0) {
    writeError(formatProcessFailureMessage(rustupCommand, rustupResult));
    return rustupResult.status ?? 1;
  }
  const installedTargets = String(rustupResult.stdout ?? "")
    .split(/\r?\n/u)
    .map((target) => target.trim());
  if (!installedTargets.includes(WINDOWS_GNU_TARGET)) {
    writeError(formatMissingRustTargetMessage());
    return 1;
  }

  writeOutput(`Windows GNU C compiler: ${resolution.compilerPath}`);
  const compilerDirectory = dirname(resolution.compilerPath);
  const existingPath = env.PATH ?? "";
  const cargoEnvironment = {
    ...env,
    PATH: existingPath ? `${compilerDirectory}${delimiter}${existingPath}` : compilerDirectory,
  };
  const cargoCommand = `cargo ${CARGO_CLIPPY_ARGUMENTS.join(" ")}`;
  const cargoResult = startProcess(spawn, "cargo", CARGO_CLIPPY_ARGUMENTS, {
    cwd: repoRoot,
    env: cargoEnvironment,
    stdio: "inherit",
  });
  if (cargoResult.error) {
    writeError(formatSpawnErrorMessage(cargoCommand, cargoResult.error));
    return 1;
  }
  if (cargoResult.status !== 0) {
    writeError(formatProcessFailureMessage(cargoCommand, cargoResult));
    return cargoResult.status ?? 1;
  }
  return 0;
}

export function main() {
  return runWindowsGnuCheck();
}

if (isEntrypoint(import.meta.url)) {
  process.exitCode = main();
}
