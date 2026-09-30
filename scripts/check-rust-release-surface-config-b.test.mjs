import { describe, expect, test } from "vitest";
import {
  CHECKOUT_FILES,
  expectCliStatus,
  runCheckerOver,
} from "./rust-release-surface-fixture.mjs";

describe("R5 config, test-only scope, and physical source surface", () => {
  const clippyToml = new Map(CHECKOUT_FILES).get("src-tauri/clippy.toml");
  const packageManifest = new Map(CHECKOUT_FILES).get("src-tauri/Cargo.toml");
  const sourceSymlinkStates = [
    ["tracked", {}],
    ["untracked", { staged: false }],
    ["git-ignored", { staged: false, ignored: true }],
  ];
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
});
