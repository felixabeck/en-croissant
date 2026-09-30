import { createHash } from "node:crypto";
import { describe, expect, test } from "vitest";
import { checkGateInvisibleRegions } from "./check-rust-release-surface.mjs";
import { classifyRustTestOnlySources } from "./rust-test-only.mjs";
import {
  CHECKOUT_MAIN,
  expectCliStatus,
  expectR5Diagnostic,
  r5Violations,
  runCheckerOver,
} from "./rust-release-surface-fixture.mjs";

describe("R5 clippy cfg and gate-invisible regions", () => {
  const profileManifestCases = [
    ["dev profile", '\n[profile.dev]\npanic = "abort"\n'],
    ["dotted profile key", "\nprofile.dev.overflow-checks = false\n"],
    ["quoted profile table", '\n["profile".release]\nopt-level = 3\n'],
    ["literal-quoted profile table", "\n['profile'.dev]\npanic = \"abort\"\n"],
  ];
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
  test.each([
    ['#[cfg(panic = "abort")]', "gate-invisible pinned region"],
    ["#[cfg(not(overflow_checks))]", "gate-invisible pinned region"],
    ["#[cfg(foo)]", "unknown cfg atom foo"],
    ['#[cfg(all(windows, target_arch = "aarch64"))]', "gate-invisible pinned region"],
  ])("O3.12 rejects unknown and never-built target cfg atom %s", (attribute, diagnostic) => {
    expectR5Diagnostic(
      r5Violations("src-tauri/src/probe.rs", `${attribute}\nfn probe(p: &Path) { p.exists(); }\n`),
      diagnostic,
    );
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
  test("O3.12 rejects an added gate-invisible region", () => {
    const added = `${CHECKOUT_MAIN}\n#[cfg(not(debug_assertions))]\nfn added_region() {}\n`;
    expectR5Diagnostic(
      r5Violations("src-tauri/src/main.rs", added),
      "gate-invisible region src-tauri/src/main.rs is not in the pinned shrink-only baseline",
    );
  });

  test("O3.12 rejects an edited gate-invisible region", () => {
    const edited = CHECKOUT_MAIN.replace(
      "#[cfg(not(debug_assertions))]\n    {\n        NATIVE_LOG_SINKS\n    }",
      "#[cfg(not(debug_assertions))]\n    {\n        NATIVE_LOG_SINKS;\n        let _extra = 1;\n    }",
    );
    expect(edited).not.toBe(CHECKOUT_MAIN);
    expectR5Diagnostic(r5Violations("src-tauri/src/main.rs", edited), "pinned gate region");
  });

  test("O3.12 rejects a stale gate-invisible pin", () => {
    const stale = CHECKOUT_MAIN.replace(
      "#[cfg(not(debug_assertions))]\n    {\n        NATIVE_LOG_SINKS\n    }",
      "#[cfg(not(debug_assertions))]\n    {\n        &NATIVE_LOG_SINKS[..1]\n    }",
    );
    expectR5Diagnostic(
      r5Violations("src-tauri/src/main.rs", stale),
      "no longer exists and must be removed",
    );
  });

  test("O3.12 rejects a macro twin of a gate-invisible region", () => {
    const macroTwin = CHECKOUT_MAIN.replace(
      "#[cfg(not(debug_assertions))]\n    {\n        NATIVE_LOG_SINKS\n    }",
      "#[cfg(not(debug_assertions))]\n    macro_rules! native_log_sinks { () => { NATIVE_LOG_SINKS }; }",
    );
    expect(macroTwin).not.toBe(CHECKOUT_MAIN);
    expectR5Diagnostic(r5Violations("src-tauri/src/main.rs", macroTwin), "pinned gate region");
  });

  test("O3.12 rejects a macro input replacement", () => {
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
