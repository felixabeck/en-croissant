import { mkdtemp, mkdir, readFile, rm, symlink, unlink, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, expect, test } from "vitest";
import {
  checkDeadCodeSurface,
  checkFaultInjectionSurface,
  checkAllowlistResidency,
  checkFilesystemSurface,
  checkPathMethodExpectations,
  checkGateInvisibleRegions,
  checkRustReleaseSurface,
  DEAD_CODE_ALLOWLIST,
  EXPECTED_CLIPPY_TOML,
  FS_SURFACE_ALLOWLIST,
  INITIAL_FS_SURFACE_COUNTS,
  listRustSources,
  PATH_METHODS,
} from "./check-rust-release-surface.mjs";
import { classifyRustTestOnlySources } from "./rust-test-only.mjs";

const LEGACY_ALLOWED_FILE = "src-tauri/src/infra/path_authority.rs";
const CHECKER = join(process.cwd(), "scripts/check-rust-release-surface.mjs");
const BASELINE_RUST_FILES = [
  "src-tauri/src/main.rs",
  "src-tauri/src/fs.rs",
  "src-tauri/src/file_workspace.rs",
];
const FIXED_INPUTS = [
  "Cargo.toml",
  "src-tauri/Cargo.toml",
  "src-tauri/build.rs",
  "src-tauri/clippy.toml",
];
const CHECKOUT_FILES = await (async () => {
  const rustFiles = await Promise.all(
    BASELINE_RUST_FILES.map(async (path) => [
      path,
      await readFile(join(process.cwd(), path), "utf8"),
    ]),
  );
  const inputs = [];
  for (const path of FIXED_INPUTS) {
    try {
      inputs.push([path, await readFile(join(process.cwd(), path), "utf8")]);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }
  return [...rustFiles, ...inputs];
})();

function sources(...entries) {
  return new Map(entries);
}

function allowedSource() {
  return "#![allow(dead_code)]\n";
}

// Spawns the checker over a throwaway git repository built from `files`. Each entry is
// { path, contents, staged = true, removeAfterStage = false }: `staged` keeps untracked fixtures
// untracked, and `removeAfterStage` leaves a tracked-but-absent file behind.
async function runCheckerOver(
  files,
  args = [],
  { seedBase = true, omitPrefixes = [], prepare } = {},
) {
  const fixtureRoot = await mkdtemp(join(tmpdir(), "rust-release-surface-"));
  try {
    const fixtureFiles = new Map();
    if (seedBase) {
      for (const [path, contents] of CHECKOUT_FILES) {
        if (!omitPrefixes.some((prefix) => path.startsWith(prefix))) {
          fixtureFiles.set(path, { path, contents, staged: true });
        }
      }
    }
    for (const file of files) fixtureFiles.set(file.path, { ...file });

    const staged = [];
    const stagedSymlinks = [];
    const removed = [];
    for (const {
      path,
      contents,
      symlinkTo,
      staged: isStaged = true,
      removeAfterStage = false,
    } of fixtureFiles.values()) {
      const absolutePath = join(fixtureRoot, path);
      await mkdir(dirname(absolutePath), { recursive: true });
      if (symlinkTo) await symlink(symlinkTo, absolutePath);
      else await writeFile(absolutePath, contents ?? "");
      if (isStaged) (symlinkTo ? stagedSymlinks : staged).push(path);
      if (removeAfterStage) removed.push(absolutePath);
    }
    expect(spawnSync("git", ["init", "--quiet"], { cwd: fixtureRoot }).status).toBe(0);
    const stagePaths = (paths) => {
      const add = spawnSync("git", ["add", "--", ...paths], {
        cwd: fixtureRoot,
        encoding: "utf8",
      });
      expect(add.status).toBe(0);
      expect(add.error).toBeUndefined();
    };
    if (staged.length) stagePaths(staged);
    for (const path of stagedSymlinks) stagePaths([path]);
    if (prepare) await prepare(fixtureRoot, "before-remove");
    for (const absolutePath of removed) await unlink(absolutePath);
    if (prepare) await prepare(fixtureRoot, "after-remove");

    const result = spawnSync(process.execPath, [CHECKER, ...args], {
      cwd: fixtureRoot,
      encoding: "utf8",
    });
    return {
      error: result.error,
      status: result.status,
      stdout: result.stdout,
      stderr: result.stderr,
      output: `${result.stdout}${result.stderr}`,
    };
  } finally {
    await rm(fixtureRoot, { recursive: true, force: true });
  }
}

function expectCliStatus(result, expectedStatus) {
  expect(result.status).toBe(expectedStatus);
  expect(result.error).toBeUndefined();
}

const CHECKOUT_MAIN = new Map(CHECKOUT_FILES).get("src-tauri/src/main.rs");

function pathMethodViolations(contents, path = "src-tauri/src/probe.rs", options = {}) {
  return checkPathMethodExpectations(new Map([[path, contents]]), options);
}

function r5Violations(path, contents, extraSources = []) {
  const entries = new Map([["src-tauri/src/main.rs", CHECKOUT_MAIN]]);
  if (path === "src-tauri/src/main.rs") entries.set(path, contents);
  else entries.set(path, contents);
  for (const [extraPath, extraContents] of extraSources) entries.set(extraPath, extraContents);
  return checkRustReleaseSurface(entries, DEAD_CODE_ALLOWLIST, { includeR5: true }).filter((line) =>
    line.includes("R5:"),
  );
}

function customExpectBaseline(path, contents, functionName, methods) {
  const analysis = classifyRustTestOnlySources(new Map([[path, contents]]), undefined, {
    includeAnalysis: true,
  }).analysis.get(path);
  const item = analysis.functionItems.find((candidate) => candidate.name === functionName);
  const normalised = item.text.replace(/\r\n?/g, "\n").replace(/\s+/g, " ").trim();
  return {
    path,
    function: functionName,
    sha256: createHash("sha256").update(normalised).digest("hex"),
    methods,
  };
}

function expectR5Diagnostic(violations, diagnostic) {
  expect(violations.some((line) => line.includes("R5:") && line.includes(diagnostic))).toBe(true);
}

describe("Rust release-surface gate", () => {
  test("R1 rejects a new file-level dead-code suppression", () => {
    const violations = checkDeadCodeSurface(
      sources(
        [LEGACY_ALLOWED_FILE, allowedSource()],
        ["src-tauri/src/infra/new_authority.rs", allowedSource()],
      ),
      new Set([...DEAD_CODE_ALLOWLIST, LEGACY_ALLOWED_FILE]),
    );

    expect(violations).toContain(
      "R1: src-tauri/src/infra/new_authority.rs carries file-level #![allow(dead_code)] but is not allowlisted",
    );
  });

  test("R1 rejects an added allowlist entry", () => {
    const added = "src-tauri/src/infra/new_authority.rs";
    const violations = checkDeadCodeSurface(
      sources([LEGACY_ALLOWED_FILE, allowedSource()], [added, allowedSource()]),
      new Set([...DEAD_CODE_ALLOWLIST, LEGACY_ALLOWED_FILE, added]),
    );

    expect(violations).toContain(
      `R1: allowlist entry ${added} is not part of the shrink-only baseline`,
    );
  });

  test("R1 rejects an allowlist entry whose file no longer carries the attribute", () => {
    const violations = checkDeadCodeSurface(
      sources([LEGACY_ALLOWED_FILE, "pub struct PathAuthority;"]),
      new Set([...DEAD_CODE_ALLOWLIST, LEGACY_ALLOWED_FILE]),
    );

    expect(violations).toContain(
      `R1: allowlist entry ${LEGACY_ALLOWED_FILE} no longer carries #![allow(dead_code)]`,
    );
  });

  test("R2 rejects an ungated public fault-injection item", () => {
    const violations = checkFaultInjectionSurface(
      "src-tauri/src/infra/fs.rs",
      "pub(crate) struct FaultPoint;\n",
    );

    expect(violations).toContain(
      "src-tauri/src/infra/fs.rs:1: R2: public fault-injection item FaultPoint must be inside #[cfg(test)]",
    );
  });

  test("R2 accepts fault-injection items inside an item cfg region and crate cfg region", () => {
    expect(
      checkFaultInjectionSurface(
        "src-tauri/src/infra/fs.rs",
        `#[cfg(test)]
mod tests {
    pub(crate) struct FaultPoint;
    pub(crate) fn remove_with_injector() {}
}
`,
      ),
    ).toEqual([]);
    expect(
      checkFaultInjectionSurface(
        "src-tauri/src/infra/fs.rs",
        "#[cfg(all(test, unix))] pub(crate) struct FaultPoint;\n",
      ),
    ).toEqual([]);
    expect(
      checkFaultInjectionSurface(
        "src-tauri/src/infra/fs.rs",
        `#![cfg(test)]
pub(crate) trait AtomicWriterInjector {}
`,
      ),
    ).toEqual([]);
  });

  test("R2 uses the shared classifier for attributed items", () => {
    expect(
      checkFaultInjectionSurface(
        "src-tauri/src/infra/fs.rs",
        '#[cfg(all(feature = "x", any(test, feature = "x")))]\npub struct FaultPoint;\n',
      ),
    ).toContain(
      "src-tauri/src/infra/fs.rs:2: R2: public fault-injection item FaultPoint must be inside #[cfg(test)]",
    );
    expect(
      checkFaultInjectionSurface(
        "src-tauri/src/infra/fs.rs",
        "#[cfg(all(unix, not(not(test))))]\npub struct FaultPoint;\n",
      ),
    ).toEqual([]);
  });

  test("R2 rejects an ungated use importing a fault-injection name", () => {
    const violations = checkFaultInjectionSurface(
      "src-tauri/src/infra/file_workspace.rs",
      "use crate::infra::AtomicWriterInjector;\n",
    );

    expect(violations).toContain(
      "src-tauri/src/infra/file_workspace.rs:1: R2: use importing a fault-injection name must be inside #[cfg(test)]",
    );
  });

  test("the complete fixture surface accepts test-only fault seams", () => {
    expect(
      checkRustReleaseSurface(
        sources([
          "src-tauri/src/infra/fs.rs",
          `#[cfg(test)]
pub(crate) enum AtomicFileFaultPoint { Write }
#[cfg(test)]
pub(crate) trait AtomicWriterInjector {}
`,
        ]),
      ),
    ).toEqual([]);
  });

  test("the checker exits non-zero when a tracked Rust input cannot be read", async () => {
    const result = await runCheckerOver([
      { path: "src-tauri/src/missing.rs", contents: "pub struct Gone;\n", removeAfterStage: true },
    ]);

    expectCliStatus(result, 1);
    expect(result.stderr).toContain("Cannot read Rust source src-tauri/src/missing.rs");
  });

  test("the CLI reports unparseable cfg predicates as R5 violations", async () => {
    const result = await runCheckerOver([
      {
        path: "src-tauri/src/invalid_cfg.rs",
        contents: "#[cfg(not(test, unix))]\nfn production() {}\n",
      },
    ]);

    expectCliStatus(result, 1);
    expect(result.output).toContain(
      "src-tauri/src/invalid_cfg.rs:1: R5: unclassifiable cfg (unparseable cfg predicate (not() requires one cfg predicate))",
    );
  });

  test("the checker rejects a failing git ls-files command", () => {
    expect(() =>
      listRustSources("/fixture", () => ({
        error: new Error("git unavailable"),
        status: null,
        stderr: "",
      })),
    ).toThrow("Cannot enumerate working-tree files");
  });

  test("the checker rejects a failure of the second git ls-files command", () => {
    let calls = 0;
    expect(() =>
      listRustSources("/fixture", () => {
        calls += 1;
        if (calls === 1) return { status: 0, stdout: "", stderr: "" };
        return { error: new Error("index unavailable"), status: null, stderr: "" };
      }),
    ).toThrow("Cannot enumerate working-tree files");
    expect(calls).toBe(2);
  });

  test("the release script is wired into package.json", async () => {
    const packageJson = JSON.parse(await readFileForWiring("package.json"));
    expect(packageJson.scripts["rust:surface:check"]).toBe(
      "node scripts/check-rust-release-surface.mjs --check-allowlist-residency",
    );
  });

  // The wiring pin lives in check-gate-routing-tests.mjs, "the live repository pins one shared contract-gate list".
});

describe("Rust filesystem-surface gate", () => {
  test("a hash-less raw string ending in a backslash does not hide the production reach after it", () => {
    // `r"...\\"` is a raw string whose last character is a backslash. Read as an ordinary
    // string, its closing quote looks escaped and the masker never leaves the literal, so every
    // following line is blanked: the brace depth drifts, `#[cfg(test)]` region boundaries move,
    // and a real production filesystem reach after it is reported by nothing at all. The
    // false-negative is why this matters more than the noisy false-positives it also causes.
    const source = [
      "fn windows_prefix(path: &str) -> Option<&str> {",
      '    path.strip_prefix(r"\\\\?\\UNC\\")',
      "}",
      "",
      "fn reads_a_file() {",
      '    let _ = std::fs::read("probe");',
      "}",
      "",
    ].join("\n");

    expect(checkFilesystemSurface(sources(["src-tauri/src/db/probe.rs", source]))).toEqual([
      "src-tauri/src/db/probe.rs:6: R3: production filesystem reach (qualified) must be inside infra/, #[cfg(test)], or the shrink-only allowlist",
    ]);
  });

  const chess = "src-tauri/src/chess.rs";
  const LEAK_FIXTURE = [
    { path: "src-tauri/src/infra/path_authority.rs", contents: "#![allow(dead_code)]\n" },
    {
      path: "src-tauri/src/leak.rs",
      contents: 'fn f() { std::fs::write("x", b""); }\n',
      staged: false,
    },
  ];

  function fsHits(source, allowlist = new Set(), counts = {}) {
    return checkFilesystemSurface(sources([chess, source]), allowlist, counts);
  }

  test("R3 rejects std::fs::write in a non-allowlisted production file", () => {
    const violations = fsHits('fn f() { std::fs::write("x", b""); }\n');
    expect(violations.some((line) => line.includes("R3:") && line.includes(chess))).toBe(true);
  });

  test("R3 accepts the same call inside a cfg(test) region", () => {
    expect(
      fsHits(`#[cfg(test)]
mod tests {
    fn f() { std::fs::write("x", b""); }
}
`),
    ).toEqual([]);
  });

  test.each([
    '#[cfg(all(feature = "x", any(test, feature = "x")))]',
    "#[cfg(any(test, unix))]",
    "#[cfg(all(unix, not(any(test, windows))))]",
    "#[cfg(not(test))]",
  ])("R3 counts filesystem calls under production cfg %s", (attribute) => {
    expect(fsHits(`${attribute}\nfn f() { std::fs::write("x", b""); }\n`)).toContain(
      `${chess}:2: R3: production filesystem reach (qualified) must be inside infra/, #[cfg(test)], or the shrink-only allowlist`,
    );
  });

  test.each([
    "#[cfg(all(test, unix))]",
    '#[cfg(all(test, target_os = "macos"))]',
    "#[cfg(all(unix, all(test, windows)))]",
    "#[cfg(all(unix, not(not(test))))]",
    "#[cfg(not(any(not(test), windows)))]",
  ])("R3 excludes filesystem calls under test-only cfg %s", (attribute) => {
    expect(fsHits(`${attribute}\nfn f() { std::fs::write("x", b""); }\n`)).toEqual([]);
  });

  test("multiline cfg(test) does not leak into the next production item", () => {
    const violations = fsHits(`#[cfg(test)]
    pub async fn replace(
        &self,
        key: u8,
    ) -> u8 {
        1
    }

    pub fn replace_handle() {
        std::fs::write("x", b"");
    }
`);
    expect(violations.some((line) => line.includes("R3:") && line.includes(chess))).toBe(true);
  });

  test("statement-level cfg(test) does not leak into the next production statement", () => {
    const violations = fsHits(`fn f() {
    #[cfg(test)]
    let _ = 1;
    std::fs::write("x", b"");
}
`);
    expect(violations.some((line) => line.includes("R3:"))).toBe(true);
  });

  test("R3 accepts a File type import without allowlisting the file", () => {
    expect(fsHits("use std::fs::File;\nfn f(file: File) {}\n")).toEqual([]);
  });

  test("R3 rejects tokio::fs::File::open in production", () => {
    expect(
      fsHits('async fn f() { let _ = tokio::fs::File::open("x").await; }\n').some((line) =>
        line.includes("R3:"),
      ),
    ).toBe(true);
  });

  test("R3 rejects fs::create_dir_all after use std::fs", () => {
    expect(
      fsHits('use std::fs;\nfn f() { fs::create_dir_all("."); }\n').some((line) =>
        line.includes("R3:"),
      ),
    ).toBe(true);
  });

  test("R3 rejects a std::fs module alias and does not flag AccountRecord::metadata", () => {
    expect(
      fsHits('use std::fs::{self as disk};\nfn f() { disk::write("x", b""); }\n').some((line) =>
        line.includes("R3:"),
      ),
    ).toBe(true);
    expect(
      fsHits('use std::fs as disk;\nfn f() { disk::write("x", b""); }\n').some((line) =>
        line.includes("R3:"),
      ),
    ).toBe(true);
    expect(
      fsHits(
        "struct AccountRecord;\nimpl AccountRecord { fn metadata(&self) {}\nfn f(r: AccountRecord) { r.metadata(); } }\n",
      ),
    ).toEqual([]);
  });

  test("R3 rejects std::fs::File::open and imported File::open", () => {
    expect(
      fsHits('fn f() { std::fs::File::open("x"); }\n').some((line) => line.includes("R3:")),
    ).toBe(true);
    expect(
      fsHits('use std::fs::File;\nfn f() { File::open("x"); }\n').some((line) =>
        line.includes("R3:"),
      ),
    ).toBe(true);
  });

  test("R3 does not treat clippy allow as an exemption", () => {
    expect(
      fsHits('#[allow(clippy::disallowed_methods)]\nfn f() { std::fs::write("x", b""); }\n').some(
        (line) => line.includes("R3:"),
      ),
    ).toBe(true);
  });

  test("R4 rejects pathname atomic_replace and not atomic_replace_at", () => {
    expect(
      fsHits("fn f() { atomic_replace(&path, |_| Ok(())); }\n").some((line) =>
        line.includes("R4:"),
      ),
    ).toBe(true);
    expect(fsHits("fn f() { atomic_replace_at(parent, leaf, |_| Ok(())); }\n")).toEqual([]);
  });

  test("R4 rejects atomic_replace_with_precommit and atomic_install_dir", () => {
    expect(
      fsHits("fn f() { atomic_replace_with_precommit(&p, || Ok(()), |_| Ok(())); }\n").some(
        (line) => line.includes("R4:"),
      ),
    ).toBe(true);
    expect(
      fsHits("fn f() { atomic_install_dir(&a, &b); }\n").some((line) => line.includes("R4:")),
    ).toBe(true);
  });

  test("R4 rejects pathname imports, globs, FQN, turbofish and module aliases", () => {
    expect(
      fsHits("use crate::infra::fs::atomic_replace as publish;\n").some((line) =>
        line.includes("R4:"),
      ),
    ).toBe(true);
    expect(fsHits("use crate::infra::fs::*;\n").some((line) => line.includes("R4:"))).toBe(true);
    expect(
      fsHits("fn f() { crate::infra::fs::atomic_replace(&p, |_| Ok(())); }\n").some((line) =>
        line.includes("R4:"),
      ),
    ).toBe(true);
    expect(
      fsHits("fn f() { crate::infra::fs::atomic_replace::<_>(&p, |_| Ok(())); }\n").some((line) =>
        line.includes("R4:"),
      ),
    ).toBe(true);
    expect(
      fsHits(
        "use crate::infra::fs as disk;\nfn f() { disk::atomic_replace::<_>(&p, |_| Ok(())); }\n",
      ).some((line) => line.includes("R4:")),
    ).toBe(true);
  });

  test("R4-only fixtures fail the composer even without std::fs", () => {
    const source = "use crate::infra::fs::atomic_replace;\n";
    const composed = checkRustReleaseSurface(sources([chess, source]));
    expect(composed.some((line) => line.includes("R4:"))).toBe(true);
  });

  test("growing the filesystem allowlist fails", () => {
    const added = "src-tauri/src/chess.rs";
    const violations = checkFilesystemSurface(
      sources([added, 'fn f() { std::fs::write("x", b""); }\n']),
      new Set([...FS_SURFACE_ALLOWLIST, added]),
      { ...INITIAL_FS_SURFACE_COUNTS, [added]: 1 },
    );
    expect(violations).toContain(
      `R3: allowlist entry ${added} is not part of the shrink-only baseline`,
    );
  });

  test("filesystem-surface counts have no stale keys outside the allowlist", () => {
    expect(
      Object.keys(INITIAL_FS_SURFACE_COUNTS).filter((path) => !FS_SURFACE_ALLOWLIST.has(path)),
    ).toEqual([]);
  });

  // The allowlist may only shrink, and the shrink-only check compares a supplied allowlist
  // against the baseline rather than the baseline against itself. Re-adding a path to both
  // constants would therefore restore its exemption silently. f-20260905-02 emptied
  // credentials.rs; this pins that it stays empty.
  test("credentials.rs has left the filesystem-surface baseline for good", () => {
    const path = "src-tauri/src/credentials.rs";
    expect(FS_SURFACE_ALLOWLIST.has(path)).toBe(false);
    expect(Object.keys(INITIAL_FS_SURFACE_COUNTS)).not.toContain(path);
  });

  test("an allowlisted file's production match count is pinned", () => {
    const path = "src-tauri/src/fs.rs";
    const violations = checkFilesystemSurface(
      sources([
        path,
        `fn f() {
    std::fs::write("x", b"");
    std::fs::read("y");
}
`,
      ]),
      new Set([path]),
      { [path]: 1 },
    );
    expect(
      violations.some((line) =>
        line.includes("has 2 production filesystem reaches, allowlisted for 1"),
      ),
    ).toBe(true);
  });

  test("R3 rejects use std::fs::{self} then fs::write", () => {
    expect(
      fsHits('use std::fs::{self};\nfn f() { fs::write("x", b""); }\n').some((line) =>
        line.includes("R3:"),
      ),
    ).toBe(true);
  });

  test("R3 rejects File imported under an alias", () => {
    expect(
      fsHits('use std::fs::File as F;\nfn f() { F::open("x"); }\n').some((line) =>
        line.includes("R3:"),
      ),
    ).toBe(true);
  });

  test("R3 sees a module-level use that follows the call", () => {
    expect(
      fsHits('fn f() { disk::write("x", b""); }\nuse std::fs as disk;\n').some((line) =>
        line.includes("R3:"),
      ),
    ).toBe(true);
  });

  test("R3 rejects std::fs::read_link", () => {
    expect(
      fsHits('fn f() { std::fs::read_link("x"); }\n').some((line) => line.includes("R3:")),
    ).toBe(true);
  });

  test("same-line cfg(test) item does not leak into the next production item", () => {
    expect(
      fsHits('#[cfg(test)] pub struct Fixture;\nfn f() { std::fs::write("x", b""); }\n').some(
        (line) => line.includes("R3:"),
      ),
    ).toBe(true);
  });

  test("R3 rejects use std::fs::write then write()", () => {
    expect(
      fsHits('use std::fs::write;\nfn f() { write("x", b""); }\n').some((line) =>
        line.includes("R3:"),
      ),
    ).toBe(true);
  });

  test("R3 counts a filesystem call reached through a production-attributed import", () => {
    const violations = fsHits(
      '#[cfg(all(feature = "x", any(test, feature = "x")))]\n' +
        'use std::fs::write;\nfn f() { write("x", b""); }\n',
    );

    expect(violations).toContain(
      `${chess}:3: R3: production filesystem reach (imported-fn) must be inside infra/, #[cfg(test)], or the shrink-only allowlist`,
    );
  });

  test("R4 counts a production-attributed pathname import", () => {
    expect(fsHits("#[cfg(any(test, unix))]\nuse crate::infra::fs::atomic_replace;\n")).toContain(
      `${chess}:2: R4: production filesystem reach (import) must be inside infra/, #[cfg(test)], or the shrink-only allowlist`,
    );
  });

  test("R2 counts a fault-injection import under a production cfg", () => {
    expect(
      checkFaultInjectionSurface(
        "src-tauri/src/infra/fs.rs",
        "#[cfg(any(test, unix))]\nuse crate::probe::FaultPoint;\n",
      ),
    ).toContain(
      "src-tauri/src/infra/fs.rs:2: R2: use importing a fault-injection name must be inside #[cfg(test)]",
    );
  });

  test("R2, R3, and R4 ignore test-only imports and preserve multiline use assembly", () => {
    const testOnly = "#[cfg(all(unix, not(not(test))))]\n";
    expect(
      checkFaultInjectionSurface(
        "src-tauri/src/infra/fs.rs",
        `${testOnly}use crate::probe::FaultPoint;\n`,
      ),
    ).toEqual([]);
    expect(fsHits(`${testOnly}use crate::infra::fs::atomic_replace;\n`)).toEqual([]);
    expect(
      fsHits(
        `${testOnly}use std::fs::write;\n#[cfg(test)]\nmod t { fn f() { write("x", b""); } }\n`,
      ),
    ).toEqual([]);
    expect(
      fsHits('#[cfg(test)]\nuse std::{\n    fs::write,\n};\nfn f() { write("x", b""); }\n'),
    ).toEqual([]);
  });

  test("whole-file test modules are excluded by the shared classifier", () => {
    expect(
      checkFilesystemSurface(
        sources(
          ["src-tauri/src/lib.rs", "#[cfg(test)]\nmod support;\n"],
          ["src-tauri/src/support.rs", 'fn f() { std::fs::write("x", b""); }\n'],
        ),
      ),
    ).toEqual([]);
  });

  test("a production line after a test-only parameter remains an R3 reach", () => {
    const violations = fsHits(
      "fn production(\n    #[cfg(test)]\n    _test: (),\n) {\n" +
        '    std::fs::write("x", b"");\n}\n',
    );

    expect(violations).toContain(
      `${chess}:5: R3: production filesystem reach (qualified) must be inside infra/, #[cfg(test)], or the shrink-only allowlist`,
    );
  });

  test("R3-only fixtures fail the composer even without pathname primitives", () => {
    const composed = checkRustReleaseSurface(
      sources([chess, 'fn f() { std::fs::write("x", b""); }\n']),
    );
    expect(composed.some((line) => line.includes("R3:"))).toBe(true);
  });

  test("an untracked leak.rs with std::fs::write fails the CLI with an R3 diagnostic", async () => {
    const result = await runCheckerOver(LEAK_FIXTURE);

    expectCliStatus(result, 1);
    expect(result.output).toContain("src-tauri/src/leak.rs");
    expect(result.output).toContain("R3:");
  });

  test("an allowlisted path with zero production matches must leave the allowlist", () => {
    const path = "src-tauri/src/fs.rs";
    const violations = checkFilesystemSurface(
      sources([path, "pub struct Credentials;\n"]),
      new Set([path]),
      { [path]: 3 },
    );

    expect(violations).toContain(
      `R3: allowlist entry ${path} has no production filesystem reaches and must be removed from the allowlist`,
    );
  });

  test("checkAllowlistResidency names an allowlisted path that left the working tree", () => {
    const violations = checkAllowlistResidency(
      ["src-tauri/src/main.rs"],
      new Set(["src-tauri/src/main.rs", "src-tauri/src/gone.rs"]),
    );

    expect(violations).toContain(
      "R3: allowlist entry src-tauri/src/gone.rs is not present in the working tree and must be removed from the allowlist",
    );
  });

  test("checkAllowlistResidency stays silent about a path that is present", () => {
    const violations = checkAllowlistResidency(
      ["src-tauri/src/main.rs"],
      new Set(["src-tauri/src/main.rs", "src-tauri/src/gone.rs"]),
    );

    expect(violations).not.toContain(
      "R3: allowlist entry src-tauri/src/main.rs is not present in the working tree and must be removed from the allowlist",
    );
  });

  test("an allowlisted path at its exact expected count raises neither stale-entry violation", () => {
    const path = "src-tauri/src/fs.rs";
    const violations = checkFilesystemSurface(
      sources([path, 'fn f() { std::fs::write("x", b""); }\n']),
      new Set([path]),
      { [path]: 1 },
    );

    expect(violations).not.toContain(
      `R3: allowlist entry ${path} has no production filesystem reaches and must be removed from the allowlist`,
    );
    expect(violations).not.toContain(
      `R3: allowlist entry ${path} is not present in the working tree and must be removed from the allowlist`,
    );
  });

  test("an allowlisted file measuring fewer reaches than allowlisted fails", () => {
    const path = "src-tauri/src/fs.rs";
    const violations = checkFilesystemSurface(
      sources([path, 'fn f() { std::fs::write("x", b""); }\n']),
      new Set([path]),
      { [path]: 2 },
    );

    expect(
      violations.some((line) =>
        line.includes("has 1 production filesystem reaches, allowlisted for 2"),
      ),
    ).toBe(true);
  });

  test("the residency arm alone fails the CLI with no surface violation present", async () => {
    const result = await runCheckerOver(
      [{ path: "src-tauri/src/infra/path_authority.rs", contents: "#![allow(dead_code)]\n" }],
      ["--check-allowlist-residency"],
      { seedBase: false },
    );

    expectCliStatus(result, 1);
    expect(result.output).toContain(
      "R3: allowlist entry src-tauri/src/fs.rs is not present in the working tree and must be removed from the allowlist",
    );
  });

  test("the residency flag reports an absent allowlist entry alongside an R3 leak", async () => {
    const result = await runCheckerOver(LEAK_FIXTURE, ["--check-allowlist-residency"], {
      seedBase: false,
    });

    expectCliStatus(result, 1);
    expect(result.output).toContain(
      "R3: allowlist entry src-tauri/src/fs.rs is not present in the working tree and must be removed from the allowlist",
    );
    expect(result.output).toContain("src-tauri/src/leak.rs");
    expect(result.output).toContain("R3:");
  });
});

async function readFileForWiring(path) {
  return readFile(join(process.cwd(), path), "utf8");
}

describe("R5 suppression containment and counted statements", () => {
  const suppressionCases = [
    ["method allow", "#[allow(clippy::disallowed_methods)]\nfn probe() {}\n"],
    ["inner style allow", "#![allow(clippy::style)]\nfn probe() {}\n"],
    ["lint-group expect", "#[expect(clippy::all)]\nfn probe() {}\n"],
    ["warnings allow", "#[allow(warnings)]\nfn probe() {}\n"],
    [
      "conditional allow",
      "#[cfg_attr(not(test), allow(clippy::disallowed_methods))]\nfn probe() {}\n",
    ],
    ["multiline allow", "#[allow(\n    clippy::disallowed_methods\n)]\nfn probe() {}\n"],
  ];

  test.each(suppressionCases)("O3.1 rejects a production %s", (_name, contents) => {
    expectR5Diagnostic(pathMethodViolations(contents), "can suppress disallowed Path methods");
  });

  test("O3.1 accepts suppressions in test-only source and inside infra", () => {
    const testOnly = pathMethodViolations(
      "#[cfg(test)]\n#[allow(clippy::disallowed_methods)]\nfn probe() {}\n",
    );
    const infra = pathMethodViolations(
      "#[allow(clippy::disallowed_methods)]\nfn probe() {}\n",
      "src-tauri/src/infra/probe.rs",
    );
    expect(testOnly.some((line) => line.includes("can suppress disallowed Path methods"))).toBe(
      false,
    );
    expect(infra.some((line) => line.includes("can suppress disallowed Path methods"))).toBe(false);
  });

  test("O3.1 permits only the exact main crate-root test allowance", () => {
    expect(pathMethodViolations(CHECKOUT_MAIN, "src-tauri/src/main.rs")).toEqual([]);
    const altered = CHECKOUT_MAIN.replace(
      "#![cfg_attr(test, allow(clippy::disallowed_methods))]",
      "#![cfg_attr(test, allow(clippy::style))]",
    );
    expectR5Diagnostic(
      pathMethodViolations(altered, "src-tauri/src/main.rs"),
      "inner allow(clippy::style) can suppress disallowed Path methods",
    );
  });

  test("O3.1 does not count a main-file allow or an inner expect as a pinned site", () => {
    const source = CHECKOUT_MAIN.replace(
      "#![cfg_attr(test, allow(clippy::disallowed_methods))]",
      "#![cfg_attr(test, allow(clippy::disallowed_methods))]\n#![expect(clippy::disallowed_methods)]",
    ).replace("fn main() {", "#[allow(clippy::disallowed_methods)]\nfn main() {");
    const violations = pathMethodViolations(source, "src-tauri/src/main.rs");
    expectR5Diagnostic(violations, "inner expect(clippy::disallowed_methods)");
    expect(violations.some((line) => line.includes("pinned expect entry"))).toBe(false);
  });

  const malformedStatements = [
    [
      "function item",
      "fn for_database(p: &Path) {\n    #[expect(clippy::disallowed_methods)]\n    fn nested() { let _ = p.exists(); }\n}\n",
    ],
    [
      "two method tokens",
      "fn for_database(p: &Path) {\n    #[expect(clippy::disallowed_methods)]\n    let _ = p.exists() && p.is_file();\n}\n",
    ],
    [
      "multiline two method tokens",
      "fn for_database(p: &Path) {\n    #[expect(clippy::disallowed_methods)]\n    let _ = p.exists()\n        && p.is_file();\n}\n",
    ],
    [
      "UFCS beside a method call",
      "fn for_database(p: &Path) {\n    #[expect(clippy::disallowed_methods)]\n    let _ = p.exists() && Path::exists(p);\n}\n",
    ],
    [
      "macro invocation",
      "fn for_database(p: &Path) {\n    #[expect(clippy::disallowed_methods)]\n    let _ = probe!(p.exists());\n}\n",
    ],
    [
      "method bound as a value",
      "fn for_database(_p: &Path) {\n    #[expect(clippy::disallowed_methods)]\n    let check = Path::exists;\n}\n",
    ],
  ];

  test.each(malformedStatements)(
    "O3.2 rejects a counted expect followed by %s",
    (_name, contents) => {
      const entry = customExpectBaseline("src-tauri/src/main.rs", contents, "for_database", {
        exists: 1,
      });
      const violations = pathMethodViolations(contents, "src-tauri/src/main.rs", {
        initialBaseline: [entry],
        baseline: [entry],
      });
      expectR5Diagnostic(
        violations,
        "counted expect must annotate one direct Path method call in a single let statement without a macro",
      );
    },
  );

  test("O3.2 rejects a method swap against the counted multiset", () => {
    const contents =
      "fn for_database(p: &Path) {\n    #[expect(clippy::disallowed_methods)]\n    let _ = p.is_dir();\n}\n";
    const entry = customExpectBaseline("src-tauri/src/main.rs", contents, "for_database", {
      exists: 1,
    });
    expectR5Diagnostic(
      pathMethodViolations(contents, "src-tauri/src/main.rs", {
        initialBaseline: [entry],
        baseline: [entry],
      }),
      "counted expect methods",
    );
  });

  test("O3.2 accepts the multiline invalidate_entries single-reach statement", () => {
    const contents =
      "fn invalidate_entries(database: &Path) {\n" +
      "    #[expect(clippy::disallowed_methods)]\n" +
      "    let database = database\n" +
      "        .canonicalize()\n" +
      "        .unwrap_or_else(|_| database.to_path_buf());\n" +
      "}\n";
    const entry = customExpectBaseline("src-tauri/src/main.rs", contents, "invalidate_entries", {
      canonicalize: 1,
    });
    expect(
      pathMethodViolations(contents, "src-tauri/src/main.rs", {
        initialBaseline: [entry],
        baseline: [entry],
      }),
    ).toEqual([]);
  });

  test("O3.2 pins each counted function and rejects an expectation outside its function", () => {
    const relocated = CHECKOUT_MAIN.replace(
      /        #\[expect\(\s*clippy::disallowed_methods,\s*reason = "[^"]*SearchIndexIdentity::for_database database\.canonicalize"\s*\)\]\n        let database = database\.canonicalize\(\)\?;/,
      "        let database = database.canonicalize()?;",
    );
    const movedSite = `${relocated}\nfn moved_site(path: &Path) {\n    #[expect(clippy::disallowed_methods)]\n    let _ = path.canonicalize();\n}\n`;
    expectR5Diagnostic(
      pathMethodViolations(movedSite, "src-tauri/src/main.rs"),
      "pinned function for_database changed from its recorded text",
    );

    const elsewhere =
      "fn for_database(p: &Path) {\n" +
      "    #[expect(clippy::disallowed_methods)]\n    let _ = p.exists();\n}\n" +
      "fn another(p: &Path) {\n" +
      "    #[expect(clippy::disallowed_methods)]\n    let _ = p.exists();\n}\n";
    expectR5Diagnostic(
      pathMethodViolations(elsewhere, "src-tauri/src/main.rs"),
      "counted expect in another has no pinned baseline entry",
    );
  });

  test("O3.2 CLI rejects a one-byte edit to a pinned function", async () => {
    const edited = CHECKOUT_MAIN.replace(
      "SearchIndexIdentity::for_database index.metadata",
      "SearchIndexIdentity::for_database index.metadatA",
    );
    expect(edited).not.toBe(CHECKOUT_MAIN);
    const result = await runCheckerOver([{ path: "src-tauri/src/main.rs", contents: edited }]);
    expectCliStatus(result, 1);
    expect(result.output).toContain(
      "R5: pinned function for_database changed from its recorded text",
    );
  });

  test("O3.2 CLI rejects relocating a counted expectation into another function", async () => {
    const withoutOriginal = CHECKOUT_MAIN.replace(
      '        #[expect(\n            clippy::disallowed_methods,\n            reason = "f-20260927-07: SearchIndexIdentity::for_database database.canonicalize"\n        )]\n        let database = database.canonicalize()?;',
      "        let database = database.canonicalize()?;",
    );
    const moved = `${withoutOriginal}\nfn moved_site(path: &Path) {\n    #[expect(clippy::disallowed_methods)]\n    let _ = path.canonicalize();\n}\n`;
    const result = await runCheckerOver([{ path: "src-tauri/src/main.rs", contents: moved }]);
    expectCliStatus(result, 1);
    expect(result.output).toContain(
      "R5: counted expect in moved_site has no pinned baseline entry",
    );
  });

  test("O3.3 shares count, addition, empty-entry, and residency validation for R5", () => {
    const path = "src-tauri/src/main.rs";
    const contents =
      "fn for_database(p: &Path) {\n    #[expect(clippy::disallowed_methods)]\n    let _ = p.exists();\n}\n";
    const entry = customExpectBaseline(path, contents, "for_database", { exists: 1 });
    expectR5Diagnostic(
      pathMethodViolations(contents, path, {
        initialBaseline: [entry],
        baseline: [{ ...entry, methods: { exists: 2 } }],
      }),
      "has 1 counted reaches, baseline 2",
    );

    const added = { ...entry, function: "not_initially_pinned", methods: { exists: 1 } };
    expectR5Diagnostic(
      pathMethodViolations(contents, path, {
        initialBaseline: [entry],
        baseline: [entry, added],
      }),
      "is not part of the shrink-only baseline",
    );

    const empty = { ...entry, function: "empty_entry", methods: {} };
    expectR5Diagnostic(
      pathMethodViolations(contents, path, {
        initialBaseline: [entry, empty],
        baseline: [entry, empty],
      }),
      "has no counted reaches and must be removed",
    );

    expectR5Diagnostic(
      pathMethodViolations(contents, path, {
        initialBaseline: [entry],
        baseline: [entry],
        presentPaths: [],
      }),
      "pinned expect path src-tauri/src/main.rs is not present",
    );
  });
});

describe("R5 config, test-only scope, and physical source surface", () => {
  const clippyToml = new Map(CHECKOUT_FILES).get("src-tauri/clippy.toml");
  const packageManifest = new Map(CHECKOUT_FILES).get("src-tauri/Cargo.toml");

  test("O3.4 renders the committed ten-method configuration byte for byte", async () => {
    expect(PATH_METHODS).toEqual([
      "canonicalize",
      "metadata",
      "symlink_metadata",
      "read_dir",
      "read_link",
      "exists",
      "try_exists",
      "is_file",
      "is_dir",
      "is_symlink",
    ]);
    expect(await readFile(join(process.cwd(), "src-tauri/clippy.toml"), "utf8")).toBe(
      EXPECTED_CLIPPY_TOML,
    );
    expect(clippyToml).toBe(EXPECTED_CLIPPY_TOML);
  });

  const clippyMutations = [
    [
      "commented method",
      clippyToml.replace(/^  \{ path = "std::path::Path::canonicalize".*\n/mu, ""),
    ],
    ["reordered entries", clippyToml.split("\n").reverse().join("\n")],
    ["allow-invalid option", `${clippyToml}allow-invalid = true\n`],
    ["extra byte", `${clippyToml}x`],
  ];

  test.each(clippyMutations)("O3.4 rejects a clippy config with %s", async (_name, contents) => {
    const result = await runCheckerOver([{ path: "src-tauri/clippy.toml", contents }]);
    expectCliStatus(result, 1);
    expect(result.output).toContain(
      "src-tauri/clippy.toml: R5: clippy configuration differs from the pinned text",
    );
  });

  test("O3.4 rejects a missing clippy config", async () => {
    const result = await runCheckerOver([
      { path: "src-tauri/clippy.toml", contents: clippyToml, removeAfterStage: true },
    ]);
    expectCliStatus(result, 1);
    expect(result.output).toContain(
      "src-tauri/clippy.toml: R5: cannot read pinned clippy configuration",
    );
  });

  test.each([
    ["tracked", [{ path: "src-tauri/.clippy.toml", contents: "" }]],
    [
      "git-ignored",
      [
        { path: ".gitignore", contents: "src-tauri/.clippy.toml\n" },
        { path: "src-tauri/.clippy.toml", contents: "", staged: false },
      ],
    ],
  ])("O3.4 rejects a %s shadow clippy config", async (_name, files) => {
    const result = await runCheckerOver(files);
    expectCliStatus(result, 1);
    expect(result.output).toContain(
      "src-tauri/.clippy.toml: R5: shadowing clippy configuration is not allowed",
    );
  });

  const productionPredicates = [
    'all(feature = "x", any(test, feature = "x"))',
    "any(test, unix)",
    "all(unix, not(any(test, windows)))",
    "not(test)",
  ];
  test.each(productionPredicates)(
    "O3.6 does not exempt a production suppression under cfg(%s)",
    (predicate) => {
      expectR5Diagnostic(
        pathMethodViolations(
          `#[cfg(${predicate})]\n#[allow(clippy::disallowed_methods)]\nfn probe() {}\n`,
        ),
        "can suppress disallowed Path methods",
      );
    },
  );

  const testOnlyPredicates = [
    "all(test, unix)",
    'all(test, target_os = "macos")',
    "all(unix, all(test, windows))",
    "all(unix, not(not(test)))",
    "not(any(not(test), windows))",
  ];
  test.each(testOnlyPredicates)(
    "O3.6 exempts a suppression under test-only cfg(%s)",
    (predicate) => {
      const violations = pathMethodViolations(
        `#[cfg(${predicate})]\n#[allow(clippy::disallowed_methods)]\nfn probe() {}\n`,
      );
      expect(violations.some((line) => line.includes("can suppress disallowed Path methods"))).toBe(
        false,
      );
    },
  );
  test("O3.6 exempts a suppression under stacked unix and test cfg attributes", () => {
    const violations = pathMethodViolations(
      "#[cfg(unix)]\n#[cfg(test)]\n#[allow(clippy::disallowed_methods)]\nfn probe() {}\n",
    );
    expect(violations.some((line) => line.includes("can suppress disallowed Path methods"))).toBe(
      false,
    );
  });

  test.each([
    [
      "bare path",
      '#[path = "external.rs"]\nmod external;\n',
      "production source may not use a #[path] attribute",
    ],
    [
      "cfg_attr path",
      '#[cfg_attr(test, path = "external.rs")]\nmod external;\n',
      "production source may not use a #[path] attribute",
    ],
    [
      "infra path",
      '#[path = "external.rs"]\nmod external;\n',
      "production source may not use a #[path] attribute",
      "src-tauri/src/infra/probe.rs",
    ],
    [
      "include macro",
      'include!("external.rs");\n',
      "production source may not name the include macro",
    ],
    [
      "qualified include",
      'std::include!("external.rs");\n',
      "production source may not name the include macro",
    ],
    [
      "aliased include",
      'use std::include as inject;\nfn probe() { inject!("external.rs"); }\n',
      "production source may not name the include macro",
    ],
    [
      "include re-export",
      "pub use core::include;\n",
      "production source may not name the include macro",
    ],
  ])("O3.7 rejects production source with %s", (_name, contents, diagnostic, path) => {
    expectR5Diagnostic(pathMethodViolations(contents, path), diagnostic);
  });

  test("O3.7 accepts test-only path/include, include_str, and the word in comments or strings", () => {
    const accepted = [
      '#[cfg(test)]\n#[path = "test.rs"]\nmod test_module;\n',
      '#[cfg(test)]\nfn probe() { include!("test.rs"); }\n',
      '#[cfg(test)]\nfn probe() { std::include!("test.rs"); }\n',
      '#[cfg(test)]\nuse std::include as inject;\n#[cfg(test)]\nfn probe() { inject!("test.rs"); }\n',
      "#[cfg(test)]\npub use core::include;\n",
      'include_str!("data.txt");\n',
      '// include!("comment.rs")\nfn probe() { let text = "include!(\\"string.rs\\")"; }\n',
    ];
    for (const contents of accepted) {
      expect(
        pathMethodViolations(contents).some((line) =>
          line.includes("production source may not name the include macro"),
        ),
      ).toBe(false);
    }
  });

  test("O3.7 reports a test-only #[path] module as unclassifiable cfg", () => {
    expectR5Diagnostic(
      pathMethodViolations('#[cfg(test)]\n#[path = "test.rs"]\nmod test_module;\n'),
      "unclassifiable cfg (unsupported #[path] on a test-only module declaration)",
    );
  });

  test.each([
    ["#[$m] item", "macro_rules! m { ($item:item) => { #[$m] $item }; }\n"],
    [
      "allow metavariable",
      "macro_rules! m { ($lint:meta) => { #[allow($lint)] fn probe() {} }; }\n",
    ],
    [
      "level and lint metavariables",
      "macro_rules! m { ($level:ident, $lint:meta) => { #[$level($lint)] fn probe() {} }; }\n",
    ],
    [
      "cfg_attr metavariable",
      "macro_rules! m { ($cfg:meta) => { #[cfg_attr($cfg, allow(clippy::disallowed_methods))] fn probe() {} }; }\n",
    ],
  ])("O3.8 rejects %s in every source directory", (_name, contents) => {
    for (const path of ["src-tauri/src/probe.rs", "src-tauri/src/infra/probe.rs"]) {
      expectR5Diagnostic(
        pathMethodViolations(contents, path),
        "attribute metavariable can generate",
      );
    }
  });

  test("O3.8 rejects a suppression in an infra macro template", () => {
    const contents =
      "macro_rules! emit { ($item:item) => { #[allow(clippy::disallowed_methods)] $item }; }\n";
    expectR5Diagnostic(
      pathMethodViolations(contents, "src-tauri/src/infra/probe.rs"),
      "can suppress disallowed Path methods",
    );
  });

  test("O3.8 exempts a suppression macro defined under cfg(test)", () => {
    const contents =
      "#[cfg(test)]\nmod tests {\n" +
      "    macro_rules! emit { ($item:item) => { #[allow(clippy::disallowed_methods)] $item }; }\n" +
      "}\n";
    expect(
      pathMethodViolations(contents).some((line) =>
        line.includes("can suppress disallowed Path methods"),
      ),
    ).toBe(false);
  });

  test.each([
    "macro_rules! m { ($item:item) => { #[$m] $item }; }",
    "macro_rules! m { ($lint:meta) => { #[allow($lint)] fn probe() {} }; }",
    "macro_rules! m { ($level:ident, $lint:meta) => { #[$level($lint)] fn probe() {} }; }",
    "macro_rules! m { ($cfg:meta) => { #[cfg_attr($cfg, allow(clippy::disallowed_methods))] fn probe() {} }; }",
  ])("O3.8 accepts a macro-generated attribute in test-only code: %s", (macroDefinition) => {
    const violations = pathMethodViolations(
      `#[cfg(test)]\nmod tests {\n    ${macroDefinition}\n}\n`,
    );
    expect(
      violations.some(
        (line) =>
          line.includes("attribute metavariable can generate") ||
          line.includes("can suppress disallowed Path methods"),
      ),
    ).toBe(false);
  });

  test("O3.7 CLI enumerates a git-ignored production Rust source", async () => {
    const result = await runCheckerOver([
      { path: ".gitignore", contents: "src-tauri/src/ignored.rs\n" },
      {
        path: "src-tauri/src/ignored.rs",
        contents: "#[allow(clippy::disallowed_methods)]\nfn probe() {}\n",
        staged: false,
      },
    ]);
    expectCliStatus(result, 1);
    expect(result.output).toContain(
      "src-tauri/src/ignored.rs:1: R5: allow(clippy::disallowed_methods) can suppress disallowed Path methods",
    );
  });

  const sourceSymlinkStates = [
    ["tracked", {}],
    ["untracked", { staged: false }],
    ["git-ignored", { staged: false, ignored: true }],
  ];

  test.each(sourceSymlinkStates)(
    "O3.7 rejects a %s symlink to a Rust source file",
    async (_state, state) => {
      const files = [
        { path: "src-tauri/src/target.rs", contents: "pub fn target() {}\n" },
        {
          path: "src-tauri/src/probe.rs",
          symlinkTo: "target.rs",
          ...Object.fromEntries(Object.entries(state).filter(([key]) => key !== "ignored")),
        },
      ];
      if (state.ignored)
        files.unshift({ path: ".gitignore", contents: "src-tauri/src/probe.rs\n" });
      const result = await runCheckerOver(files);
      expectCliStatus(result, 1);
      expect(result.output).toContain(
        "src-tauri/src/probe.rs: R5: symbolic links to Rust source files or directories are not allowed",
      );
    },
  );

  test.each(sourceSymlinkStates)(
    "O3.7 rejects a %s symlink to a source directory",
    async (_state, state) => {
      const files = [
        { path: "src-tauri/src/overlay/mod.rs", contents: "pub fn overlay() {}\n" },
        {
          path: "src-tauri/src/linked",
          symlinkTo: "overlay",
          ...Object.fromEntries(Object.entries(state).filter(([key]) => key !== "ignored")),
        },
      ];
      if (state.ignored) files.unshift({ path: ".gitignore", contents: "src-tauri/src/linked\n" });
      const result = await runCheckerOver(files);
      expectCliStatus(result, 1);
      expect(result.output).toContain(
        "src-tauri/src/linked: R5: symbolic links to Rust source files or directories are not allowed",
      );
    },
  );

  test.each(sourceSymlinkStates)(
    "O3.7 rejects a %s symlink for the infra module root",
    async (_state, state) => {
      const files = [
        {
          path: "src-tauri/src/infra",
          symlinkTo: "../../infra-overlay",
          ...Object.fromEntries(Object.entries(state).filter(([key]) => key !== "ignored")),
        },
        {
          path: "infra-overlay/mod.rs",
          contents: "pub fn hidden(p: &std::path::Path) { p.exists(); }\n",
        },
      ];
      if (state.ignored) files.unshift({ path: ".gitignore", contents: "src-tauri/src/infra\n" });
      const result = await runCheckerOver(files, [], { omitPrefixes: ["src-tauri/src/infra/"] });
      expectCliStatus(result, 1);
      expect(result.output).toContain(
        "src-tauri/src/infra: R5: symbolic links to Rust source files or directories are not allowed",
      );
    },
  );

  test.each(sourceSymlinkStates)(
    "O3.7 rejects a %s symlinked infra Rust module",
    async (_state, state) => {
      const files = [
        { path: "src-tauri/src/infra/mod.rs", contents: "#[cfg(test)]\nmod probe;\n" },
        { path: "src-tauri/src/infra/target.rs", contents: "pub fn target() {}\n" },
        {
          path: "src-tauri/src/infra/probe.rs",
          symlinkTo: "target.rs",
          ...Object.fromEntries(Object.entries(state).filter(([key]) => key !== "ignored")),
        },
      ];
      if (state.ignored)
        files.unshift({ path: ".gitignore", contents: "src-tauri/src/infra/probe.rs\n" });
      const result = await runCheckerOver(files);
      expectCliStatus(result, 1);
      expect(result.output).toContain(
        "src-tauri/src/infra/probe.rs: R5: symbolic links to Rust source files or directories are not allowed",
      );
    },
  );

  const fixedRootSymlinks = [
    ["src-tauri/Cargo.toml", packageManifest],
    ["src-tauri/build.rs", new Map(CHECKOUT_FILES).get("src-tauri/build.rs")],
    ["src-tauri/clippy.toml", clippyToml],
  ];
  test.each(
    fixedRootSymlinks.flatMap(([path, contents]) =>
      sourceSymlinkStates.map(([stateName, state]) => [path, stateName, contents, state]),
    ),
  )(
    "O3.7 rejects a symlinked %s input in the %s state",
    async (path, _stateName, contents, state) => {
      const targetPath = `${path}.target`;
      const files = [
        { path: targetPath, contents },
        {
          path,
          symlinkTo: `${path.split("/").at(-1)}.target`,
          ...Object.fromEntries(Object.entries(state).filter(([key]) => key !== "ignored")),
        },
      ];
      if (state.ignored) files.unshift({ path: ".gitignore", contents: `${path}\n` });
      const result = await runCheckerOver(files);
      expectCliStatus(result, 1);
      expect(result.output).toContain(
        `${path}: R5: pinned Rust roots and inputs may not be symbolic links`,
      );
    },
  );

  const sourceRootSymlinks = [
    ["src-tauri", "src-tauri/", "overlay/src-tauri", "/src-tauri/", "overlay/src-tauri/src"],
    ["src-tauri/src", "src-tauri/src/", "../overlay/src", "/src-tauri/src/", "overlay/src"],
  ];
  test.each(
    sourceRootSymlinks.flatMap((row) =>
      sourceSymlinkStates.map(([name, state]) => [...row, name, state]),
    ),
  )(
    "O3.7 rejects the %s root symlink when %s",
    async (
      path,
      omittedPrefix,
      symlinkTarget,
      ignorePattern,
      overlaySourceRoot,
      _stateName,
      state,
    ) => {
      const files = [
        { path: `${overlaySourceRoot}/main.rs`, contents: "mod db;\nfn main() {}\n" },
        {
          path: `${overlaySourceRoot}/db/mod.rs`,
          contents:
            '#![allow(clippy::disallowed_methods)]\nfn hidden() { std::path::Path::new(".").exists(); }\n',
        },
        ...(path === "src-tauri"
          ? [
              { path: "overlay/src-tauri/Cargo.toml", contents: packageManifest },
              {
                path: "overlay/src-tauri/build.rs",
                contents: new Map(CHECKOUT_FILES).get("src-tauri/build.rs"),
              },
              { path: "overlay/src-tauri/clippy.toml", contents: clippyToml },
            ]
          : []),
        {
          path,
          symlinkTo: symlinkTarget,
          ...Object.fromEntries(Object.entries(state).filter(([key]) => key !== "ignored")),
        },
      ];
      if (state.ignored) files.unshift({ path: ".gitignore", contents: `${ignorePattern}\n` });
      const result = await runCheckerOver(files, [], { omitPrefixes: [omittedPrefix] });
      expectCliStatus(result, 1);
      expect(result.output).toContain(
        `${path}: R5: pinned Rust roots and inputs may not be symbolic links`,
      );
    },
  );

  test.each(sourceSymlinkStates)(
    "O3.7 accepts a %s symlink to a non-Rust data file",
    async (_state, state) => {
      const files = [
        { path: "src-tauri/src/payload.dat", contents: "asset" },
        {
          path: "src-tauri/src/payload-link",
          symlinkTo: "payload.dat",
          ...Object.fromEntries(Object.entries(state).filter(([key]) => key !== "ignored")),
        },
      ];
      if (state.ignored)
        files.unshift({ path: ".gitignore", contents: "src-tauri/src/payload-link\n" });
      const result = await runCheckerOver(files);
      expectCliStatus(result, 0);
    },
  );

  test.each([
    ["source child", "src-tauri/src/hidden", "src-tauri/src/hidden/"],
    ["src root", "src-tauri/src", "src-tauri/src/"],
    ["package root", "src-tauri", "src-tauri/"],
  ])("O3.7 rejects a tracked gitlink at %s", async (_name, path, _entry) => {
    const result = await runCheckerOver([], [], {
      prepare: (root, phase) => {
        if (phase !== "after-remove") return;
        const remove = spawnSync(
          "git",
          ["rm", "-r", "--cached", "--quiet", "--ignore-unmatch", "--", path],
          { cwd: root, encoding: "utf8" },
        );
        expect(remove.status).toBe(0);
        expect(remove.error).toBeUndefined();
        const add = spawnSync(
          "git",
          ["update-index", "--add", "--cacheinfo", `160000,${"1".repeat(40)},${path}`],
          { cwd: root, encoding: "utf8" },
        );
        expect(add.status).toBe(0);
        expect(add.error).toBeUndefined();
      },
    });
    expectCliStatus(result, 1);
    expect(result.output).toContain(`${path}: R5: gitlink source trees are not allowed`);
  });

  test.each([
    ["source child", "src-tauri/src/hidden"],
    ["src root", "src-tauri/src"],
    ["package root", "src-tauri"],
  ])("O3.7 rejects an untracked nested repository at the %s", async (_name, path) => {
    const result = await runCheckerOver([], [], {
      prepare: async (root, phase) => {
        if (phase !== "after-remove") return;
        const remove = spawnSync(
          "git",
          ["rm", "-r", "--cached", "--quiet", "--ignore-unmatch", "--", path],
          {
            cwd: root,
            encoding: "utf8",
          },
        );
        expect(remove.status).toBe(0);
        expect(remove.error).toBeUndefined();
        const directory = join(root, path);
        await mkdir(directory, { recursive: true });
        const init = spawnSync("git", ["init", "--quiet"], { cwd: directory, encoding: "utf8" });
        expect(init.status).toBe(0);
        const sourcePath =
          path === "src-tauri" ? "src/main.rs" : path === "src-tauri/src" ? "main.rs" : "mod.rs";
        const source =
          path === "src-tauri/src/hidden"
            ? "pub fn hidden() {}\n"
            : '#![allow(clippy::disallowed_methods)]\nfn main() { std::path::Path::new(".").exists(); }\n';
        await mkdir(dirname(join(directory, sourcePath)), { recursive: true });
        await writeFile(join(directory, sourcePath), source);
      },
    });
    expectCliStatus(result, 1);
    expect(result.output).toContain(
      `${path}: R5: untracked nested git repositories are not allowed in the Rust source tree`,
    );
  });

  test("O3.7 rejects an ignored nested repository in the Rust source tree", async () => {
    const result = await runCheckerOver(
      [{ path: ".gitignore", contents: "src-tauri/src/hidden/\n" }],
      [],
      {
        prepare: async (root, phase) => {
          if (phase !== "after-remove") return;
          const directory = join(root, "src-tauri/src/hidden");
          await mkdir(directory, { recursive: true });
          const init = spawnSync("git", ["init", "--quiet"], {
            cwd: directory,
            encoding: "utf8",
          });
          expect(init.status).toBe(0);
          expect(init.error).toBeUndefined();
          await writeFile(
            join(directory, "mod.rs"),
            'use std::path::Path;\npub fn hidden() { Path::new(".").exists(); }\n',
          );
        },
      },
    );
    expectCliStatus(result, 1);
    expect(result.output).toContain(
      "src-tauri/src/hidden: R5: untracked nested git repositories are not allowed in the Rust source tree",
    );
  });

  const cargoConfigCases = [
    [".cargo/config", "tracked", [{ path: ".cargo/config", contents: "[build]\njobs = 2\n" }]],
    [
      ".cargo/config",
      "untracked",
      [{ path: ".cargo/config", contents: "[build]\njobs = 2\n", staged: false }],
    ],
    [
      ".cargo/config",
      "git-ignored",
      [
        { path: ".gitignore", contents: ".cargo/config\n" },
        { path: ".cargo/config", contents: "[build]\njobs = 2\n", staged: false },
      ],
    ],
    [
      ".cargo/config.toml",
      "tracked",
      [{ path: ".cargo/config.toml", contents: "[build]\njobs = 2\n" }],
    ],
    [
      ".cargo/config.toml",
      "untracked",
      [{ path: ".cargo/config.toml", contents: "[build]\njobs = 2\n", staged: false }],
    ],
    [
      ".cargo/config.toml",
      "git-ignored",
      [
        { path: ".gitignore", contents: ".cargo/config.toml\n" },
        { path: ".cargo/config.toml", contents: "[build]\njobs = 2\n", staged: false },
      ],
    ],
  ];

  test.each(cargoConfigCases)("O3.9 rejects %s when %s", async (path, _state, files) => {
    const result = await runCheckerOver(files);
    expectCliStatus(result, 1);
    expect(result.output).toContain(`${path}: R5: repository Cargo configuration is not allowed`);
  });

  test("O3.9 accepts Cargo config files below src-tauri", async () => {
    const result = await runCheckerOver([
      { path: "src-tauri/.cargo/config.toml", contents: "[build]\njobs = 2\n" },
      { path: "src-tauri/.cargo/mutants.toml", contents: "[mutants]\ntimeout = 20\n" },
    ]);
    expectCliStatus(result, 0);
  });

  const packageLintManifests = [
    ["lints.clippy table", '\n[lints.clippy]\ndisallowed_methods = "allow"\n'],
    ["workspace lints table", '\n[workspace.lints.rust]\nwarnings = "allow"\n'],
    ["inline lints table", '\nlints = { clippy = { all = "allow" } }\n'],
    ["dotted lints key", '\nlints.clippy.extra = "allow"\n'],
    ["double-quoted header key", '\n["lints".clippy]\ndisallowed_methods = "allow"\n'],
    ["single-quoted header key", "\n['lints'.clippy]\ndisallowed_methods = \"allow\"\n"],
    ["single-quoted dotted key", "\n'lints'.clippy.extra = \"allow\"\n"],
    ["lints table header", '\n["lints"]\n'],
    ["basic string escape", '\nprobe = "a\\\\b"\n'],
    ["cargo-features key", '\ncargo-features = ["different"]\n'],
    ["quoted cargo-features key", '\n"cargo-features" = ["different"]\n'],
  ];

  test.each(packageLintManifests)(
    "O3.10 rejects %s in the package manifest",
    async (_name, suffix) => {
      const result = await runCheckerOver([
        { path: "src-tauri/Cargo.toml", contents: `${packageManifest}${suffix}` },
      ]);
      expectCliStatus(result, 1);
      expect(result.output).toContain(
        "src-tauri/Cargo.toml: R5: Cargo manifests may not define lint levels or cargo-features",
      );
    },
  );

  test("O3.10 rejects workspace lint levels in the root manifest", async () => {
    const result = await runCheckerOver([
      { path: "Cargo.toml", contents: '[workspace.lints.clippy]\nall = "allow"\n' },
    ]);
    expectCliStatus(result, 1);
    expect(result.output).toContain(
      "Cargo.toml: R5: Cargo manifests may not define lint levels or cargo-features",
    );
  });

  test.each([
    [
      "ordinary description",
      packageManifest.replace(
        'description = "A Modern Chess Database"',
        'description = "no lints here"',
      ),
    ],
    [
      "description value",
      packageManifest.replace('description = "A Modern Chess Database"', 'description = "lints"'),
    ],
    [
      "multiline description value",
      packageManifest.replace(
        'description = "A Modern Chess Database"',
        'description = """\nno lints here\n"""',
      ),
    ],
    [
      "keyword value",
      packageManifest.replace(
        "[build-dependencies]",
        'keywords = ["lints"]\n\n[build-dependencies]',
      ),
    ],
    ["comment", `${packageManifest}\n# lints\n`],
  ])("O3.10 accepts %s without a key-position violation", async (_name, contents) => {
    const result = await runCheckerOver([{ path: "src-tauri/Cargo.toml", contents }]);
    expectCliStatus(result, 0);
  });

  test("O3.10 accepts the real package manifest", async () => {
    const result = await runCheckerOver([]);
    expectCliStatus(result, 0);
  });

  const buildKeys = [
    ["bare build key", 'build = "other.rs"'],
    ["double-quoted build key", '"build" = "other.rs"'],
    ["single-quoted build key", "'build' = \"other.rs\""],
  ];
  test.each(buildKeys)("O3.13 rejects a package manifest with %s", async (_name, key) => {
    const contents = packageManifest.replace(
      "[build-dependencies]",
      `${key}\n\n[build-dependencies]`,
    );
    const result = await runCheckerOver([{ path: "src-tauri/Cargo.toml", contents }]);
    expectCliStatus(result, 1);
    expect(result.output).toContain(
      "src-tauri/Cargo.toml: R5: src-tauri/Cargo.toml may not select a different build script",
    );
  });

  test("O3.13 pins build.rs by SHA-256", async () => {
    const result = await runCheckerOver([
      {
        path: "src-tauri/build.rs",
        contents: `${new Map(CHECKOUT_FILES).get("src-tauri/build.rs")}\n`,
      },
    ]);
    expectCliStatus(result, 1);
    expect(result.output).toContain(
      "src-tauri/build.rs: R5: build script differs from its pinned SHA-256",
    );
  });

  test("O3.13 accepts build-dependencies, a root build key, and the real build script", async () => {
    const result = await runCheckerOver([{ path: "Cargo.toml", contents: 'build = "other.rs"\n' }]);
    expectCliStatus(result, 0);
    expect(new Map(CHECKOUT_FILES).get("src-tauri/build.rs")).toContain("tauri_build::build()");
  });

  const packageTargetRoots = [
    [
      "bin target path",
      '\n[[bin]]\nname = "chessfable"\npath = "release_main.rs"\nautobins = false\n',
      "Cargo manifest path keys may add Rust code",
    ],
    [
      "lib target path",
      '\n[lib]\npath = "../lib.rs"\n',
      "Cargo manifest path keys may add Rust code",
    ],
    ["autobins key", "\nautobins = false\n", "may not change the production target roots"],
    ["quoted bin table", "\n['bin']\n", "may not change the production target roots"],
    [
      "inline local path dependency",
      '\nhelper = { path = "../helper" }\n',
      "Cargo manifest path keys may add Rust code",
    ],
    [
      "dotted local path dependency",
      '\nhelper.path = "../helper"\n',
      "Cargo manifest path keys may add Rust code",
    ],
    [
      "patch path dependency",
      "\n[patch.crates-io]\nserde = { 'path' = \"../serde\" }\n",
      "Cargo manifest path keys may add Rust code",
    ],
    [
      "package workspace key",
      '\nworkspace = "../cargo-workspace"\n',
      "may not change the production target roots",
    ],
    ["quoted workspace table", "\n['workspace']\n", "may not change the production target roots"],
  ];
  test.each(packageTargetRoots)("O3.15 rejects %s", async (_name, suffix, diagnostic) => {
    const result = await runCheckerOver([
      { path: "src-tauri/Cargo.toml", contents: `${packageManifest}${suffix}` },
    ]);
    expectCliStatus(result, 1);
    expect(result.output).toContain(`src-tauri/Cargo.toml: R5: ${diagnostic}`);
  });

  test("O3.15 rejects a root-manifest patch path", async () => {
    const result = await runCheckerOver([
      { path: "Cargo.toml", contents: '[patch.crates-io]\nserde = { path = "../serde" }\n' },
    ]);
    expectCliStatus(result, 1);
    expect(result.output).toContain("Cargo.toml: R5: Cargo manifest path keys may add Rust code");
  });

  test("O3.15 accepts a path value and the real package manifest", async () => {
    const withDescription = packageManifest.replace(
      'description = "A Modern Chess Database"',
      'description = "a path"',
    );
    const result = await runCheckerOver([
      { path: "src-tauri/Cargo.toml", contents: withDescription },
    ]);
    expectCliStatus(result, 0);
  });
});

describe("R5 clippy cfg and gate-invisible regions", () => {
  const clippyCfgAttributes = [
    "#[cfg(not(clippy))]",
    "#[cfg(clippy)]",
    "#[cfg_attr(not(clippy), inline)]",
    "#[cfg(all(unix, not(clippy)))]",
    "#[cfg_attr(all(), cfg(not(clippy)))]",
  ];
  const packageManifest = new Map(CHECKOUT_FILES).get("src-tauri/Cargo.toml");

  test.each(clippyCfgAttributes)("O3.11 rejects a production %s", (attribute) => {
    expectR5Diagnostic(
      pathMethodViolations(`${attribute}\nfn probe() {}\n`),
      "production cfg attribute may not use the clippy cfg atom",
    );
  });

  test.each(clippyCfgAttributes)("O3.11 exempts %s inside a test-only region", (attribute) => {
    const violations = pathMethodViolations(
      `#[cfg(test)]\nmod tests {\n    ${attribute}\n    fn probe() {}\n}\n`,
    );
    expect(
      violations.some((line) =>
        line.includes("production cfg attribute may not use the clippy cfg atom"),
      ),
    ).toBe(false);
  });

  test("O3.11 does not reject a lint path containing clippy::", () => {
    expect(
      pathMethodViolations("#[allow(clippy::too_many_arguments)]\nfn probe() {}\n").some((line) =>
        line.includes("production cfg attribute may not use the clippy cfg atom"),
      ),
    ).toBe(false);
  });

  const allMethods = [
    "canonicalize",
    "metadata",
    "symlink_metadata",
    "read_dir",
    "read_link",
    "exists",
    "try_exists",
    "is_file",
    "is_dir",
    "is_symlink",
  ];

  test.each(allMethods)("O3.12 pins a gate-invisible direct %s call", (method) => {
    const contents = `fn probe(p: &Path) {\n    #[cfg(not(debug_assertions))]\n    { p.${method}(); }\n}\n`;
    expectR5Diagnostic(
      r5Violations("src-tauri/src/probe.rs", contents),
      `gate-invisible pinned region contains Path method name(s): ${method}`,
    );
  });

  test.each(allMethods)("O3.12 pins a gate-invisible UFCS %s call", (method) => {
    const contents = `fn probe(p: &Path) {\n    #[cfg(not(debug_assertions))]\n    { std::path::Path::${method}(p); }\n}\n`;
    expectR5Diagnostic(
      r5Violations("src-tauri/src/probe.rs", contents),
      `gate-invisible pinned region contains Path method name(s): ${method}`,
    );
  });

  test.each(allMethods)("O3.12 pins a gate-invisible %s method value", (method) => {
    const contents = `fn probe() {\n    #[cfg(not(debug_assertions))]\n    { let check = std::path::Path::${method}; }\n}\n`;
    expectR5Diagnostic(
      r5Violations("src-tauri/src/probe.rs", contents),
      `gate-invisible pinned region contains Path method name(s): ${method}`,
    );
  });

  const invisibleContexts = [
    ["function item", "#[cfg(not(debug_assertions))]\nfn probe(p: &Path) { p.exists(); }\n"],
    [
      "block expression",
      "fn outer(p: &Path) {\n    #[cfg(not(debug_assertions))]\n    { p.exists(); }\n}\n",
    ],
    [
      "let statement",
      "fn outer(p: &Path) {\n    #[cfg(not(debug_assertions))]\n    let _ = p.exists();\n}\n",
    ],
    [
      "conjoined predicate",
      "#[cfg(all(not(debug_assertions), windows))]\nfn probe(p: &Path) { p.exists(); }\n",
    ],
    ["default-disabled feature", '#[cfg(feature = "extra")]\nfn probe(p: &Path) { p.exists(); }\n'],
  ];
  test.each(invisibleContexts)(
    "O3.12 detects a Path reach inside a gate-invisible %s",
    (_name, contents) => {
      expectR5Diagnostic(
        r5Violations("src-tauri/src/probe.rs", contents),
        "gate-invisible pinned region contains Path method name(s): exists",
      );
    },
  );

  const visibleContexts = [
    ["debug assertion", "#[cfg(debug_assertions)]\nfn probe(p: &Path) { p.exists(); }\n"],
    ["debug or test", "#[cfg(any(debug_assertions, test))]\nfn probe(p: &Path) { p.exists(); }\n"],
    [
      "default feature",
      '#[cfg(feature = "custom-protocol")]\nfn probe(p: &Path) { p.exists(); }\n',
    ],
    ["macOS target", '#[cfg(target_os = "macos")]\nfn probe(p: &Path) { p.exists(); }\n'],
    ["overflow checks", "#[cfg(overflow_checks)]\nfn probe(p: &Path) { p.exists(); }\n"],
    ["desktop target", "#[cfg(desktop)]\nfn probe(p: &Path) { p.exists(); }\n"],
    ["Linux target", '#[cfg(target_os = "linux")]\nfn probe(p: &Path) { p.exists(); }\n'],
  ];
  test.each(visibleContexts)("O3.12 accepts a reach in visible %s", (_name, contents) => {
    expect(r5Violations("src-tauri/src/probe.rs", contents)).toEqual([]);
  });

  test.each([
    ["function-valued local", "let check = Path::exists; check(p);"],
    ["parenthesized method value", "(std::path::Path::exists)(p);"],
  ])("O3.12 catches %s inside a release-only block", (_name, expression) => {
    const contents = `fn probe(p: &Path) {\n    #[cfg(not(debug_assertions))]\n    { ${expression} }\n}\n`;
    expectR5Diagnostic(
      r5Violations("src-tauri/src/probe.rs", contents),
      "gate-invisible pinned region contains Path method name(s): exists",
    );
  });

  test("O3.12 follows gate-invisible out-of-line modules into their child source", () => {
    const parent = "#[cfg(not(debug_assertions))]\nmod release_paths;\n";
    const child = "fn probe(p: &Path) { p.exists(); }\n";
    expectR5Diagnostic(
      r5Violations("src-tauri/src/probe.rs", parent, [
        ["src-tauri/src/probe/release_paths.rs", child],
      ]),
      "gate-invisible pinned region contains Path method name(s): exists",
    );
  });

  test.each([
    [
      "stacked attributes",
      '#[cfg(target_os = "linux")]\n#[cfg(target_arch = "aarch64")]\nfn probe(p: &Path) { p.exists(); }\n',
      [],
    ],
    [
      "an enclosing block",
      '#[cfg(target_os = "linux")]\nfn outer(p: &Path) {\n    #[cfg(target_arch = "aarch64")]\n    { p.exists(); }\n}\n',
      [],
    ],
    [
      "an inline module",
      '#[cfg(target_os = "linux")]\nmod outer {\n    #[cfg(target_arch = "aarch64")]\n    fn probe(p: &Path) { p.exists(); }\n}\n',
      [],
    ],
    [
      "an out-of-line module",
      '#[cfg(target_os = "linux")]\nmod harmony;\n',
      [
        [
          "src-tauri/src/probe/harmony.rs",
          '#[cfg(target_arch = "aarch64")]\nfn probe(p: &Path) { p.exists(); }\n',
        ],
      ],
    ],
    [
      "two inherited module edges",
      '#[cfg(target_os = "linux")]\nmod a;\n',
      [
        ["src-tauri/src/probe/a.rs", '#[cfg(target_arch = "aarch64")]\nmod b;\n'],
        ["src-tauri/src/probe/a/b.rs", "fn probe(p: &Path) { p.exists(); }\n"],
      ],
    ],
  ])("O3.12 intersects gate cfg across %s", (_name, contents, extraSources) => {
    expectR5Diagnostic(
      r5Violations("src-tauri/src/probe.rs", contents, extraSources),
      "gate-invisible pinned region contains Path method name(s): exists",
    );
  });

  test("O3.12 reads default feature gates from the fixture manifest", async () => {
    const manifest = packageManifest.replace('default = ["custom-protocol"]', "default = []");
    const result = await runCheckerOver([
      { path: "src-tauri/Cargo.toml", contents: manifest },
      {
        path: "src-tauri/src/feature_probe.rs",
        contents: '#[cfg(feature = "extra")]\nfn probe(p: &Path) { p.exists(); }\n',
      },
    ]);
    expectCliStatus(result, 1);
    expect(result.output).toContain(
      "src-tauri/src/feature_probe.rs:1: R5: gate-invisible pinned region contains Path method name(s): exists",
    );
  });

  const profileManifestCases = [
    ["dev profile", '\n[profile.dev]\npanic = "abort"\n'],
    ["dotted profile key", "\nprofile.dev.overflow-checks = false\n"],
    ["quoted profile table", '\n["profile".release]\nopt-level = 3\n'],
    ["literal-quoted profile table", "\n['profile'.dev]\npanic = \"abort\"\n"],
  ];
  test.each(profileManifestCases)(
    "O3.12 rejects a %s in the package manifest",
    async (_name, suffix) => {
      const result = await runCheckerOver([
        { path: "src-tauri/Cargo.toml", contents: `${packageManifest}${suffix}` },
      ]);
      expectCliStatus(result, 1);
      expect(result.output).toContain(
        "src-tauri/Cargo.toml: R5: Cargo manifests may not override the gate compilation profile",
      );
    },
  );
  test.each(profileManifestCases)(
    "O3.12 rejects a %s in the workspace manifest",
    async (_name, suffix) => {
      const result = await runCheckerOver([{ path: "Cargo.toml", contents: suffix }]);
      expectCliStatus(result, 1);
      expect(result.output).toContain(
        "Cargo.toml: R5: Cargo manifests may not override the gate compilation profile",
      );
    },
  );

  test.each([
    [
      "nested cfg_attr payload",
      "#[cfg_attr(debug_assertions, cfg(not(debug_assertions)))]\nfn probe() {}\n",
    ],
    [
      "cfg_attr payload under macro_rules",
      "macro_rules! m { () => { #[cfg_attr(debug_assertions, cfg(not(debug_assertions)))] fn probe() {} }; }\n",
    ],
  ])("O3.12 rejects a %s", (_name, contents) => {
    expectR5Diagnostic(
      r5Violations("src-tauri/src/probe.rs", contents),
      "cfg_attr payload may not introduce a nested cfg predicate",
    );
  });

  test("O3.12 rejects a macro_rules cfg region that hides a Path call", () => {
    const contents =
      "#[cfg(not(debug_assertions))]\n" +
      "macro_rules! hidden { ($p:expr) => { $p.exists() }; }\n" +
      "#[cfg(debug_assertions)]\nmacro_rules! hidden_debug { ($p:expr) => { $p }; }\n";
    expectR5Diagnostic(
      r5Violations("src-tauri/src/probe.rs", contents),
      "gate-invisible pinned region contains Path method name(s): exists",
    );
  });

  test("O3.12 rejects a cfg-gated macro expansion body and a return statement", () => {
    const macroTemplate =
      "macro_rules! release_only {\n" +
      "    ($item:item) => {\n" +
      "        #[cfg(not(debug_assertions))]\n" +
      "        $item\n" +
      "    };\n" +
      "}\n" +
      "release_only!(fn probe(p: &Path) { p.exists(); });\n";
    expectR5Diagnostic(
      r5Violations("src-tauri/src/probe.rs", macroTemplate),
      "R5: unclassifiable cfg",
    );

    const returnStatement =
      "fn probe(p: &Path) -> bool {\n" +
      "    #[cfg(not(debug_assertions))]\n" +
      '    return Path::new(".").exists();\n' +
      "    true\n" +
      "}\n";
    expectR5Diagnostic(
      r5Violations("src-tauri/src/probe.rs", returnStatement),
      "gate-invisible pinned region contains Path method name(s): exists",
    );
  });

  test("O3.12 rejects a macro template that declares an out-of-line module", () => {
    const contents =
      "#[cfg(not(debug_assertions))]\n" +
      "macro_rules! release_module { () => { mod release_paths; }; }\n";
    expectR5Diagnostic(
      r5Violations("src-tauri/src/probe.rs", contents),
      "gate-invisible pinned region may not declare an out-of-line module",
    );
  });

  test.each([
    ["module passed as macro input", "wrap!(#[cfg(not(debug_assertions))] mod release_paths;)\n"],
    [
      "block passed as macro input",
      "fail_analysis_progress!({ #[cfg(not(debug_assertions))] { p.exists(); }; e })\n",
    ],
  ])("O3.12 reports a cfg attribute in a %s as unclassifiable", (_name, expression) => {
    const contents = `fn probe(p: &Path) { ${expression} }\n`;
    expectR5Diagnostic(
      r5Violations("src-tauri/src/probe.rs", contents),
      "unclassifiable cfg (unsupported cfg attribute inside a macro input)",
    );
  });

  test("O3.12 rejects unknown and never-built target cfg atoms", () => {
    for (const [attribute, diagnostic] of [
      ['#[cfg(panic = "abort")]', "gate-invisible pinned region"],
      ["#[cfg(not(overflow_checks))]", "gate-invisible pinned region"],
      ["#[cfg(foo)]", "unknown cfg atom foo"],
      ['#[cfg(all(windows, target_arch = "aarch64"))]', "gate-invisible pinned region"],
    ]) {
      expectR5Diagnostic(
        r5Violations(
          "src-tauri/src/probe.rs",
          `${attribute}\nfn probe(p: &Path) { p.exists(); }\n`,
        ),
        diagnostic,
      );
    }
  });

  test("O3.12 rejects gate-invisible attributes at mid-line positions", () => {
    expectR5Diagnostic(
      r5Violations(
        "src-tauri/src/probe.rs",
        "fn probe(p: &Path) { { #[cfg(not(debug_assertions))] { p.exists(); } } }\n",
      ),
      "R5: unclassifiable cfg",
    );
  });

  test("O3.12 accepts a test-only block and the real fail-analysis macro shape", () => {
    expect(
      r5Violations(
        "src-tauri/src/probe.rs",
        "fn probe(p: &Path) {\n    #[cfg(test)]\n    { p.exists(); }\n}\n",
      ),
    ).toEqual([]);
    expect(r5Violations("src-tauri/src/main.rs", CHECKOUT_MAIN)).toEqual([]);
  });

  test("O3.12 rejects added and edited gate-invisible regions and catches stale pins", () => {
    const added = `${CHECKOUT_MAIN}\n#[cfg(not(debug_assertions))]\nfn added_region() {}\n`;
    expectR5Diagnostic(
      r5Violations("src-tauri/src/main.rs", added),
      "gate-invisible region src-tauri/src/main.rs is not in the pinned shrink-only baseline",
    );

    const edited = CHECKOUT_MAIN.replace(
      "#[cfg(not(debug_assertions))]\n    {\n        NATIVE_LOG_SINKS\n    }",
      "#[cfg(not(debug_assertions))]\n    {\n        NATIVE_LOG_SINKS;\n        let _extra = 1;\n    }",
    );
    expect(edited).not.toBe(CHECKOUT_MAIN);
    expectR5Diagnostic(r5Violations("src-tauri/src/main.rs", edited), "pinned gate region");

    const stale = CHECKOUT_MAIN.replace(
      "#[cfg(not(debug_assertions))]\n    {\n        NATIVE_LOG_SINKS\n    }",
      "#[cfg(not(debug_assertions))]\n    {\n        &NATIVE_LOG_SINKS[..1]\n    }",
    );
    expectR5Diagnostic(
      r5Violations("src-tauri/src/main.rs", stale),
      "no longer exists and must be removed",
    );

    const macroTwin = CHECKOUT_MAIN.replace(
      "#[cfg(not(debug_assertions))]\n    {\n        NATIVE_LOG_SINKS\n    }",
      "#[cfg(not(debug_assertions))]\n    macro_rules! native_log_sinks { () => { NATIVE_LOG_SINKS }; }",
    );
    expect(macroTwin).not.toBe(CHECKOUT_MAIN);
    expectR5Diagnostic(r5Violations("src-tauri/src/main.rs", macroTwin), "pinned gate region");

    const macroInputReplacement = CHECKOUT_MAIN.replace(
      "#[cfg(not(debug_assertions))]\n    {\n        NATIVE_LOG_SINKS\n    }",
      "wrap!(#[cfg(not(debug_assertions))] mod release_paths;);",
    );
    expect(macroInputReplacement).not.toBe(CHECKOUT_MAIN);
    expectR5Diagnostic(
      r5Violations("src-tauri/src/main.rs", macroInputReplacement, [
        ["src-tauri/src/main/release_paths.rs", "fn hidden(p: &Path) { p.exists(); }\n"],
      ]),
      "R5: unclassifiable cfg",
    );
  });

  function customPinnedRegion(contents) {
    const path = "src-tauri/src/probe.rs";
    const sources = new Map([[path, contents]]);
    const classification = classifyRustTestOnlySources(sources, undefined, {
      includeAnalysis: true,
    });
    const region = classification.analysis
      .get(path)
      .sourceRegions.find((candidate) =>
        candidate.attributes.some((attribute) => attribute.details?.kind === "cfg"),
      );
    const regionText = contents.slice(region.range.start, region.range.end);
    const normalised = regionText.replace(/\r\n?/g, "\n").replace(/\s+/g, " ").trim();
    const entry = {
      path,
      key: "probe-region",
      attribute: region.text,
      regionSha256: createHash("sha256").update(normalised).digest("hex"),
    };
    return {
      path,
      sources,
      classification,
      entry,
      violations: checkGateInvisibleRegions(sources, classification, {
        initialBaseline: [entry],
        baseline: [entry],
      }),
    };
  }

  test("O3.12 checks region contents independently from the region pin", () => {
    const pathReach = customPinnedRegion(
      "fn probe(p: &Path) {\n    #[cfg(not(debug_assertions))]\n    { p.exists(); }\n}\n",
    );
    expectR5Diagnostic(
      pathReach.violations,
      "gate-invisible pinned region contains Path method name(s): exists",
    );

    const macro = customPinnedRegion(
      "fn probe(p: &Path) {\n    #[cfg(not(debug_assertions))]\n    { probe!(p); }\n}\n",
    );
    expectR5Diagnostic(
      macro.violations,
      "gate-invisible pinned region may not contain a macro invocation",
    );

    const outOfLineModule = customPinnedRegion(
      "fn probe() {\n    #[cfg(not(debug_assertions))]\n    { mod release_paths; }\n}\n",
    );
    expectR5Diagnostic(
      outOfLineModule.violations,
      "gate-invisible pinned region may not declare an out-of-line module",
    );

    const ordinaryMethod = customPinnedRegion(
      "fn probe(values: &[u8]) {\n    #[cfg(not(debug_assertions))]\n    { values.len(); }\n}\n",
    );
    expect(ordinaryMethod.violations).toEqual([]);
  });

  test("O3.12 excludes ordinary infra regions from the gate pin scope", () => {
    expect(
      r5Violations(
        "src-tauri/src/infra/probe.rs",
        "#[cfg(not(debug_assertions))]\nfn probe(p: &Path) { p.exists(); }\n",
      ),
    ).toEqual([]);
  });

  test("O3.12 pins an invisible infra macro definition and leaves its debug twin visible", () => {
    const contents =
      "#[cfg(not(debug_assertions))]\n" +
      "macro_rules! hidden { ($p:expr) => { $p.exists() }; }\n" +
      "#[cfg(debug_assertions)]\nmacro_rules! hidden_debug { ($p:expr) => { $p }; }\n";
    expectR5Diagnostic(
      r5Violations("src-tauri/src/infra/probe.rs", contents),
      "gate-invisible pinned region contains Path method name(s): exists",
    );
  });

  test("O3.12 analyzes cfg_attr payloads in infra macro templates", () => {
    const contents =
      "macro_rules! m {\n" +
      "    () => {\n" +
      "        #[cfg_attr(debug_assertions, cfg(not(debug_assertions)))]\n" +
      "        fn probe() {}\n" +
      "    };\n" +
      "}\n";
    expectR5Diagnostic(
      r5Violations("src-tauri/src/infra/probe.rs", contents),
      "cfg_attr payload may not introduce a nested cfg predicate",
    );
  });
});
