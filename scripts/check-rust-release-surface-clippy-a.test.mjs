import { describe, expect, test } from "vitest";

import {
  expectR5Diagnostic,
  pathMethodViolations,
  r5Violations,
} from "./rust-release-surface-fixture.mjs";

describe("R5 clippy cfg and gate-invisible regions", () => {
  const clippyCfgAttributes = [
    "#[cfg(not(clippy))]",
    "#[cfg(clippy)]",
    "#[cfg_attr(not(clippy), inline)]",
    "#[cfg(all(unix, not(clippy)))]",
    "#[cfg_attr(all(), cfg(not(clippy)))]",
  ];
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
});
