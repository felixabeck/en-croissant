import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { EXPECTED_CLIPPY_TOML, PATH_METHODS } from "./check-rust-release-surface.mjs";
import {
  CHECKOUT_FILES,
  expectCliStatus,
  expectR5Diagnostic,
  pathMethodViolations,
  runCheckerOver,
} from "./rust-release-surface-fixture.mjs";

describe("R5 config, test-only scope, and physical source surface", () => {
  const clippyToml = new Map(CHECKOUT_FILES).get("src-tauri/clippy.toml");
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
});
