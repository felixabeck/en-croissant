#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { delimiter, dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { isEntrypoint } from "./entrypoint.mjs";
import { DEFAULT_WINDOWS_PATHEXT, findExecutableOnPath } from "./executable-path.mjs";

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
//     Re-run on the fail-closed subshell form: recipe exit 0 into a second empty prefix, `x86_64-w64-mingw32-gcc (GCC) 13-posix`, gate exit 0.
// (g) scratch PATH without rustup: `Could not start rustup target list --installed: spawnSync rustup ENOENT`; exit 1.
// (h) scratch rustup exited 7: `rustup target list --installed failed with exit status 7.`; exit 7.
// (i) scratch PATH had rustup but no cargo: `Could not start cargo clippy --manifest-path src-tauri/Cargo.toml --target x86_64-pc-windows-gnu --all-targets --locked -- -D warnings: spawnSync cargo ENOENT`; exit 1.
// (j) scratch cargo was terminated: `cargo clippy --manifest-path src-tauri/Cargo.toml --target x86_64-pc-windows-gnu --all-targets --locked -- -D warnings was terminated by SIGTERM.`; exit 1.
// (k) injected spawn function threw: `Could not start rustup target list --installed: synthetic spawn failure`; exit 1.
// (l) scratch rustup was terminated: `rustup target list --installed was terminated by SIGTERM.`; exit 1.
// (m) scratch prefix was `/proc/chessfable-no-such-prefix`: `mkdir: cannot create directory ‘/proc/chessfable-no-such-prefix’: No such file or directory`; recipe exit 1; no compiler link was created.
// (n) `env -u HOME -u CHESSFABLE_MINGW_PREFIX PATH=/tmp/chessfable-rust-windows-n.BpGIh5 node scripts/rust-windows-check.mjs`: `Windows GNU cross compiler not found on PATH or in the default prefix`; `  Set CHESSFABLE_MINGW_PREFIX (or HOME) and rerun pnpm rust:windows:check to print the apt recipe for that prefix.`; exit 1; no apt recipe was printed.
// (o) unit-test staged: injected EIO from PATH inspection printed `Could not inspect /scratch/bin/x86_64-w64-mingw32-gcc for x86_64-w64-mingw32-gcc: synthetic EIO`; exit 1. A real EIO cannot be staged harmlessly through the host filesystem.

export const WINDOWS_GNU_TARGET = "x86_64-pc-windows-gnu";
export const MINGW_COMPILER = "x86_64-w64-mingw32-gcc";
export const MINGW_PREPROCESSOR = "x86_64-w64-mingw32-cpp";
export const DEFAULT_MINGW_PREFIX_RELATIVE_TO_HOME = ".local/opt/mingw";
const MINGW_POSIX_SUFFIX = "-posix";
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

function resolvePrefix(pathValue, repoRoot) {
  return isAbsolute(pathValue) ? resolve(pathValue) : resolve(repoRoot, pathValue);
}

function compilerAtPrefix(prefix, platform) {
  const executable = platform === "win32" ? `${MINGW_COMPILER}.exe` : MINGW_COMPILER;
  return join(prefix, "usr", "bin", executable);
}

function compilerInPrefix(prefix, options) {
  return findExecutableOnPath(MINGW_COMPILER, {
    pathValue: join(prefix, "usr", "bin"),
    ...options,
  });
}

/** Resolve the GNU cross compiler without starting a process or changing the environment. */
export function resolveWindowsGnuCompiler({
  env = process.env,
  fileSystem,
  repoRoot = process.cwd(),
  platform = process.platform,
  pathExt = env.PATHEXT ?? DEFAULT_WINDOWS_PATHEXT,
} = {}) {
  const pathOptions = {
    fileSystem,
    cwd: repoRoot,
    platform,
    pathExt,
  };

  if (env.CHESSFABLE_MINGW_PREFIX !== undefined) {
    const prefix = resolvePrefix(env.CHESSFABLE_MINGW_PREFIX, repoRoot);
    const expectedCompilerPath = compilerAtPrefix(prefix, platform);
    const compilerPath = compilerInPrefix(prefix, pathOptions);
    return compilerPath
      ? { ok: true, source: "explicit-prefix", prefix, compilerPath }
      : {
          ok: false,
          reason: "explicit-prefix-missing",
          prefix,
          compilerPath: expectedCompilerPath,
        };
  }

  const pathCompiler = findExecutableOnPath(MINGW_COMPILER, {
    pathValue: env.PATH,
    fileSystem,
    cwd: repoRoot,
    platform,
    pathExt,
  });
  if (pathCompiler) {
    return { ok: true, source: "path", compilerPath: resolve(pathCompiler) };
  }

  const prefix =
    typeof env.HOME === "string" && env.HOME.length > 0
      ? resolvePrefix(join(env.HOME, DEFAULT_MINGW_PREFIX_RELATIVE_TO_HOME), repoRoot)
      : undefined;
  const expectedCompilerPath = prefix ? compilerAtPrefix(prefix, platform) : undefined;
  const compilerPath = prefix ? compilerInPrefix(prefix, pathOptions) : undefined;
  if (compilerPath) {
    return { ok: true, source: "default-prefix", prefix, compilerPath };
  }

  return {
    ok: false,
    reason: "not-found",
    pathValue: env.PATH,
    prefix,
    compilerPath: expectedCompilerPath,
  };
}

function shellQuote(value) {
  return `'${value.replaceAll("'", "'\\''")}'`;
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
  const setupInstructions = targetPrefix
    ? [
        `  Apt-based setup for prefix ${targetPrefix}:`,
        "  (",
        "    set -e",
        `    mkdir -p ${shellQuote(join(targetPrefix, "debs"))}`,
        `    cd ${shellQuote(join(targetPrefix, "debs"))}`,
        `    apt-get download ${APT_MINGW_PACKAGES.join(" ")}`,
        `    for package in ${shellQuote(join(targetPrefix, "debs"))}/*.deb; do dpkg-deb -x "$package" ${shellQuote(targetPrefix)}; done`,
        `    ln -sfn ${MINGW_COMPILER}${MINGW_POSIX_SUFFIX} ${shellQuote(join(targetPrefix, "usr", "bin", MINGW_COMPILER))}`,
        `    ln -sfn ${MINGW_PREPROCESSOR}${MINGW_POSIX_SUFFIX} ${shellQuote(join(targetPrefix, "usr", "bin", MINGW_PREPROCESSOR))}`,
        "  )",
      ]
    : [
        "  Set CHESSFABLE_MINGW_PREFIX (or HOME) and rerun pnpm rust:windows:check to print the apt recipe for that prefix.",
      ];
  return [
    firstLine,
    `  Attempted compiler path: ${compilerPath}`,
    resolution.reason === "not-found"
      ? `  PATH searched: ${resolution.pathValue ?? "<unset>"}`
      : undefined,
    ...setupInstructions,
    `  For non-apt systems, install ${MINGW_COMPILER} and put it on PATH or set CHESSFABLE_MINGW_PREFIX.`,
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
  fileSystem,
  spawn = spawnSync,
  repoRoot = projectRoot,
  writeOutput = console.log,
  writeError = console.error,
} = {}) {
  let resolution;
  try {
    resolution = resolveWindowsGnuCompiler({ env, fileSystem, repoRoot });
  } catch (error) {
    const inspectedPath = typeof error?.path === "string" ? error.path : "PATH";
    const detail = error instanceof Error ? error.message : String(error);
    writeError(`Could not inspect ${inspectedPath} for ${MINGW_COMPILER}: ${detail}`);
    return 1;
  }

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

if (isEntrypoint(import.meta.url)) {
  process.exitCode = runWindowsGnuCheck();
}
