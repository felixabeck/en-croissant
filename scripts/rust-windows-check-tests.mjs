import assert from "node:assert/strict";
import { delimiter, dirname, join, resolve } from "node:path";
import test from "node:test";
import {
  MINGW_COMPILER,
  MINGW_PREPROCESSOR,
  WINDOWS_GNU_TARGET,
  formatMissingCompilerMessage,
  formatMissingRustTargetMessage,
  resolveWindowsGnuCompiler,
  runWindowsGnuCheck,
} from "./rust-windows-check.mjs";
import { findExecutableOnPath } from "./executable-path.mjs";

const repoRoot = "/scratch/chessfable";
const home = "/scratch/home";

function fileSystemFor(paths) {
  const existing = new Set(paths);
  return {
    existsSync: (path) => existing.has(path),
    accessSync(path) {
      if (!existing.has(path)) {
        const error = new Error(`not executable: ${path}`);
        error.code = "EACCES";
        error.path = path;
        throw error;
      }
    },
  };
}

function resolveWithPaths({ env, present = [], repoRoot: root = repoRoot, platform, pathExt }) {
  return resolveWindowsGnuCompiler({
    env,
    fileSystem: fileSystemFor(present),
    repoRoot: root,
    platform,
    pathExt,
  });
}

function installedCompiler(prefix) {
  return join(prefix, "usr", "bin", MINGW_COMPILER);
}

test("resolves an explicit MinGW prefix", () => {
  const prefix = "/scratch/explicit-mingw";
  const compilerPath = installedCompiler(prefix);
  const result = resolveWithPaths({
    env: { CHESSFABLE_MINGW_PREFIX: prefix, PATH: "/empty" },
    present: [compilerPath],
  });

  assert.deepEqual(result, {
    ok: true,
    source: "explicit-prefix",
    prefix: resolve(prefix),
    compilerPath,
  });
});

test("resolves an explicit Windows MinGW prefix with the .exe compiler", () => {
  const prefix = "/scratch/explicit-mingw";
  const compilerPath = `${installedCompiler(prefix)}.exe`;
  const result = resolveWithPaths({
    env: { CHESSFABLE_MINGW_PREFIX: prefix, PATH: "/empty" },
    present: [compilerPath],
    platform: "win32",
  });

  assert.deepEqual(result, {
    ok: true,
    source: "explicit-prefix",
    prefix: resolve(prefix),
    compilerPath,
  });
});

test("refuses a missing explicit prefix without falling back to PATH", () => {
  const prefix = "/scratch/missing-explicit";
  const pathCompiler = "/compiler/bin/x86_64-w64-mingw32-gcc";
  const env = { CHESSFABLE_MINGW_PREFIX: prefix, HOME: home, PATH: "/compiler/bin" };
  const fileSystem = fileSystemFor([pathCompiler]);
  const result = resolveWindowsGnuCompiler({ env, fileSystem, repoRoot });

  assert.equal(result.ok, false);
  assert.equal(result.reason, "explicit-prefix-missing");
  assert.equal(result.prefix, resolve(prefix));
  assert.equal(result.compilerPath, installedCompiler(prefix));
  const message = formatMissingCompilerMessage(result);
  assert.ok(message.includes(resolve(prefix)));
  assert.ok(message.includes(installedCompiler(prefix)));
  assert.match(message, /apt-get download/u);
  assert.ok(message.includes(`mkdir -p '${join(resolve(prefix), "debs")}'`));
  assert.ok(
    message.includes(
      `For non-apt systems, install ${MINGW_COMPILER} and put it on PATH or set CHESSFABLE_MINGW_PREFIX.`,
    ),
  );

  const messageLines = message.split("\n");
  const aptIndex = messageLines.findIndex((line) =>
    line.startsWith("  Apt-based setup for prefix "),
  );
  const nonAptIndex = messageLines.findIndex((line) => line.startsWith("  For non-apt systems"));
  assert.notEqual(aptIndex, -1);
  assert.ok(nonAptIndex > aptIndex);
  const recipe = messageLines.slice(aptIndex + 1, nonAptIndex).map((line) => line.slice(2));
  assert.equal(recipe[0], "(");
  assert.equal(recipe[1], "  set -e");
  const extractionLine = `  for package in '${join(resolve(prefix), "debs")}'/*.deb; do dpkg-deb -x "$package" '${resolve(prefix)}'; done`;
  assert.ok(recipe.includes(extractionLine));
  const extractionIndex = recipe.indexOf(extractionLine);
  const gccLinkIndex = recipe.findIndex((line) =>
    line.startsWith(`  ln -sfn ${MINGW_COMPILER}-posix `),
  );
  const cppLinkIndex = recipe.findIndex((line) =>
    line.startsWith(`  ln -sfn ${MINGW_PREPROCESSOR}-posix `),
  );
  const closingIndex = recipe.indexOf(")");
  assert.ok(extractionIndex < gccLinkIndex && gccLinkIndex < closingIndex);
  assert.ok(extractionIndex < cppLinkIndex && cppLinkIndex < closingIndex);

  const errors = [];
  const exitStatus = runWindowsGnuCheck({
    env,
    fileSystem,
    repoRoot,
    writeError: (line) => errors.push(line),
  });
  assert.equal(exitStatus, 1);
  assert.equal(errors[0], message);
});

test("asks for HOME or an explicit prefix instead of printing a recipe without a prefix", () => {
  for (const homeValue of [undefined, ""]) {
    const env = { PATH: "/scratch/empty" };
    if (homeValue !== undefined) env.HOME = homeValue;
    const errors = [];
    const result = runWindowsGnuCheck({
      env,
      fileSystem: fileSystemFor([]),
      repoRoot,
      writeError: (message) => errors.push(message),
    });

    assert.equal(result, 1);
    assert.equal(errors.length, 1);
    assert.match(
      errors[0],
      /Set CHESSFABLE_MINGW_PREFIX \(or HOME\) and rerun pnpm rust:windows:check to print the apt recipe for that prefix\./u,
    );
    assert.doesNotMatch(errors[0], /Apt-based setup|apt-get download/u);
    assert.ok(errors[0].includes(`For non-apt systems, install ${MINGW_COMPILER}`));
  }
});

test("reports unexpected executable inspection errors distinctly and exits non-zero", () => {
  const compilerPath = "/scratch/bin/x86_64-w64-mingw32-gcc";
  const inspectionError = Object.assign(new Error("synthetic EIO"), {
    code: "EIO",
    path: compilerPath,
  });
  const fileSystem = {
    existsSync: () => false,
    accessSync(path) {
      if (path === compilerPath) throw inspectionError;
      const error = new Error(`not executable: ${path}`);
      error.code = "EACCES";
      throw error;
    },
  };
  const errors = [];
  const result = runWindowsGnuCheck({
    env: { PATH: "/scratch/bin", HOME: home },
    fileSystem,
    repoRoot,
    writeError: (message) => errors.push(message),
  });

  assert.equal(result, 1);
  assert.deepEqual(errors, [
    `Could not inspect ${compilerPath} for ${MINGW_COMPILER}: synthetic EIO`,
  ]);
});

test("treats EACCES during executable inspection as an absent compiler", () => {
  const errors = [];
  const result = runWindowsGnuCheck({
    env: { PATH: "/scratch/empty", HOME: home },
    fileSystem: fileSystemFor([]),
    repoRoot,
    writeError: (message) => errors.push(message),
  });

  assert.equal(result, 1);
  assert.match(errors[0], /Windows GNU cross compiler not found on PATH/u);
  assert.match(errors[0], /Apt-based setup for prefix \/scratch\/home\/\.local\/opt\/mingw/u);
  assert.doesNotMatch(errors[0], /Could not inspect/u);
});

test("resolves MinGW from PATH before checking the default prefix", () => {
  const pathDirectory = "/scratch/path-mingw/bin";
  const compilerPath = join(pathDirectory, MINGW_COMPILER);
  const result = resolveWithPaths({
    env: {
      HOME: home,
      PATH: ["/scratch/other", pathDirectory].join(delimiter),
    },
    present: [compilerPath, installedCompiler(join(home, ".local", "opt", "mingw"))],
  });

  assert.deepEqual(result, { ok: true, source: "path", compilerPath });
});

test("resolves MinGW from the default prefix when PATH has no compiler", () => {
  const prefix = join(home, ".local", "opt", "mingw");
  const compilerPath = installedCompiler(prefix);
  const result = resolveWithPaths({
    env: { HOME: home, PATH: "/scratch/empty" },
    present: [compilerPath],
  });

  assert.deepEqual(result, {
    ok: true,
    source: "default-prefix",
    prefix: resolve(prefix),
    compilerPath,
  });
});

test("resolves the default Windows MinGW prefix with the .exe compiler", () => {
  const prefix = join(home, ".local", "opt", "mingw");
  const compilerPath = `${installedCompiler(prefix)}.exe`;
  const result = resolveWithPaths({
    env: { HOME: home, PATH: "/scratch/empty" },
    present: [compilerPath],
    platform: "win32",
  });

  assert.deepEqual(result, {
    ok: true,
    source: "default-prefix",
    prefix: resolve(prefix),
    compilerPath,
  });
});

test("shared executable lookup resolves a .exe compiler using PATHEXT on win32", () => {
  const compilerPath = "/scratch/bin/x86_64-w64-mingw32-gcc.exe";
  assert.equal(
    findExecutableOnPath(MINGW_COMPILER, {
      pathValue: "/scratch/bin",
      fileSystem: fileSystemFor([compilerPath]),
      cwd: repoRoot,
      platform: "win32",
      pathExt: ".EXE;.CMD;.BAT;.COM",
    }),
    resolve(compilerPath),
  );
});

test("shared executable lookup returns undefined when PATH has no matching executable", () => {
  assert.equal(
    findExecutableOnPath(MINGW_COMPILER, {
      pathValue: "/scratch/bin",
      fileSystem: fileSystemFor([]),
      cwd: repoRoot,
      platform: "win32",
      pathExt: ".EXE;.CMD;.BAT;.COM",
    }),
    undefined,
  );
});

test("reports the resolved default prefix, apt packages, links, and non-apt remedy", () => {
  const prefix = join(home, ".local", "opt", "mingw");
  const env = { HOME: home, PATH: "/scratch/empty" };
  const fileSystem = fileSystemFor([]);
  const result = resolveWindowsGnuCompiler({ env, fileSystem, repoRoot });

  assert.equal(result.ok, false);
  assert.equal(result.reason, "not-found");
  assert.equal(result.prefix, resolve(prefix));
  const message = formatMissingCompilerMessage(result);
  assert.match(message, /Windows GNU cross compiler not found on PATH or in the default prefix/u);
  assert.ok(message.includes(installedCompiler(prefix)));
  for (const packageName of [
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
  ]) {
    assert.ok(message.includes(packageName), `missing apt package ${packageName}`);
  }
  assert.ok(
    message.includes(
      `ln -sfn ${MINGW_COMPILER}-posix '${join(resolve(prefix), "usr", "bin", MINGW_COMPILER)}'`,
    ),
  );
  assert.ok(
    message.includes(
      `ln -sfn ${MINGW_PREPROCESSOR}-posix '${join(resolve(prefix), "usr", "bin", MINGW_PREPROCESSOR)}'`,
    ),
  );
  assert.ok(message.includes(`For non-apt systems, install ${MINGW_COMPILER}`));

  const errors = [];
  const exitStatus = runWindowsGnuCheck({
    env,
    fileSystem,
    repoRoot,
    writeError: (line) => errors.push(line),
  });
  assert.equal(exitStatus, 1);
  assert.equal(errors[0], message);
});

test("reports the rustup target-add remedy and returns a non-zero result when absent", () => {
  const prefix = "/scratch/mingw";
  const errors = [];
  const calls = [];
  const result = runWindowsGnuCheck({
    env: { CHESSFABLE_MINGW_PREFIX: prefix, PATH: "/scratch/bin" },
    fileSystem: fileSystemFor([installedCompiler(prefix)]),
    repoRoot,
    spawn(command, argumentsList, options) {
      calls.push({ command, argumentsList, options });
      return { status: 0, stdout: "x86_64-unknown-linux-gnu\n" };
    },
    writeError: (message) => errors.push(message),
    writeOutput() {},
  });

  assert.notEqual(result, 0);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].command, "rustup");
  assert.match(errors[0], /Rust target x86_64-pc-windows-gnu is not installed/u);
  assert.match(errors[0], /rustup target add x86_64-pc-windows-gnu/u);
  assert.equal(errors[0], formatMissingRustTargetMessage());
});

test("starts clippy with the resolved compiler directory first and propagates cargo status", () => {
  const prefix = "/scratch/mingw";
  const compilerPath = installedCompiler(prefix);
  const output = [];
  const errors = [];
  const calls = [];
  const result = runWindowsGnuCheck({
    env: { CHESSFABLE_MINGW_PREFIX: prefix, PATH: "/scratch/cargo-bin:/usr/bin" },
    fileSystem: fileSystemFor([compilerPath]),
    repoRoot,
    spawn(command, argumentsList, options) {
      calls.push({ command, argumentsList, options });
      return command === "rustup"
        ? { status: 0, stdout: `${WINDOWS_GNU_TARGET}\nx86_64-unknown-linux-gnu\n` }
        : { status: 37 };
    },
    writeOutput: (message) => output.push(message),
    writeError: (message) => errors.push(message),
  });

  assert.equal(result, 37);
  assert.equal(calls.length, 2);
  assert.deepEqual(calls[1].argumentsList, [
    "clippy",
    "--manifest-path",
    "src-tauri/Cargo.toml",
    "--target",
    "x86_64-pc-windows-gnu",
    "--all-targets",
    "--locked",
    "--",
    "-D",
    "warnings",
  ]);
  assert.equal(calls[1].options.cwd, repoRoot);
  assert.equal(calls[1].options.stdio, "inherit");
  assert.equal(
    calls[1].options.env.PATH,
    `${dirname(compilerPath)}${delimiter}/scratch/cargo-bin:/usr/bin`,
  );
  assert.deepEqual(output, [`Windows GNU C compiler: ${compilerPath}`]);
  assert.match(errors[0], /cargo clippy .* failed with exit status 37/u);
});

test("reports distinct rustup and cargo spawn failures", () => {
  const prefix = "/scratch/mingw";
  const compilerPath = installedCompiler(prefix);
  for (const failCommand of ["rustup", "cargo"]) {
    const errors = [];
    const result = runWindowsGnuCheck({
      env: { CHESSFABLE_MINGW_PREFIX: prefix, PATH: "/scratch/bin" },
      fileSystem: fileSystemFor([compilerPath]),
      repoRoot,
      spawn(command) {
        if (command === failCommand) return { error: new Error(`spawn ${command} ENOENT`) };
        return { status: 0, stdout: `${WINDOWS_GNU_TARGET}\n` };
      },
      writeOutput() {},
      writeError: (message) => errors.push(message),
    });

    assert.equal(result, 1);
    assert.equal(errors.length, 1);
    assert.match(
      errors[0],
      new RegExp(`Could not start ${failCommand} .*spawn ${failCommand} ENOENT`, "u"),
    );
  }
});

test("reports rustup and cargo termination by signal as non-zero failures", () => {
  const prefix = "/scratch/mingw";
  const compilerPath = installedCompiler(prefix);

  for (const failCommand of ["rustup", "cargo"]) {
    const errors = [];
    const result = runWindowsGnuCheck({
      env: { CHESSFABLE_MINGW_PREFIX: prefix, PATH: "/scratch/bin" },
      fileSystem: fileSystemFor([compilerPath]),
      repoRoot,
      spawn(command) {
        if (command === failCommand) return { status: null, signal: "SIGTERM" };
        return { status: 0, stdout: `${WINDOWS_GNU_TARGET}\n` };
      },
      writeOutput() {},
      writeError: (message) => errors.push(message),
    });

    assert.notEqual(result, 0);
    assert.equal(errors.length, 1);
    assert.match(errors[0], /was terminated by SIGTERM/u);
  }
});

test("turns a thrown spawn failure into a distinct non-zero result", () => {
  const prefix = "/scratch/mingw";
  const errors = [];
  const result = runWindowsGnuCheck({
    env: { CHESSFABLE_MINGW_PREFIX: prefix, PATH: "/scratch/bin" },
    fileSystem: fileSystemFor([installedCompiler(prefix)]),
    repoRoot,
    spawn() {
      throw new Error("synthetic spawn failure");
    },
    writeOutput() {},
    writeError: (message) => errors.push(message),
  });

  assert.equal(result, 1);
  assert.deepEqual(errors, [
    "Could not start rustup target list --installed: synthetic spawn failure",
  ]);
});

test("reports a non-zero rustup target-list status separately from a missing target", () => {
  const prefix = "/scratch/mingw";
  const errors = [];
  const result = runWindowsGnuCheck({
    env: { CHESSFABLE_MINGW_PREFIX: prefix, PATH: "/scratch/bin" },
    fileSystem: fileSystemFor([installedCompiler(prefix)]),
    repoRoot,
    spawn: () => ({ status: 3, stdout: "" }),
    writeOutput() {},
    writeError: (message) => errors.push(message),
  });

  assert.equal(result, 3);
  assert.equal(errors[0], "rustup target list --installed failed with exit status 3.");
});
