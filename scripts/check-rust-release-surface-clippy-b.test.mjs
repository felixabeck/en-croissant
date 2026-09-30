import { describe, expect, test } from "vitest";
import {
  CHECKOUT_FILES,
  expectCliStatus,
  expectR5Diagnostic,
  r5Violations,
  runCheckerOver,
} from "./rust-release-surface-fixture.mjs";

describe("R5 clippy cfg and gate-invisible regions", () => {
  const packageManifest = new Map(CHECKOUT_FILES).get("src-tauri/Cargo.toml");
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
});
