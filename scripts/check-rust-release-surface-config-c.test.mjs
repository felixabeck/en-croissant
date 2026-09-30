import { mkdir, writeFile } from "node:fs/promises";

import { spawnSync } from "node:child_process";

import { dirname, join } from "node:path";

import { describe, expect, test } from "vitest";

import { expectCliStatus, runCheckerOver } from "./rust-release-surface-fixture.mjs";

describe("R5 config, test-only scope, and physical source surface", () => {
  const sourceSymlinkStates = [
    ["tracked", {}],
    ["untracked", { staged: false }],
    ["git-ignored", { staged: false, ignored: true }],
  ];
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
  const nestedRepositoryCases = [
    ["source child", "src-tauri/src", ["hidden"], 1, null, "mod.rs", "pub fn hidden() {}\n"],
    [
      "src root",
      "src-tauri",
      ["src"],
      1,
      null,
      "main.rs",
      '#![allow(clippy::disallowed_methods)]\nfn main() { std::path::Path::new(".").exists(); }\n',
    ],
    [
      "package root",
      ".",
      ["src-tauri"],
      1,
      null,
      "src/main.rs",
      '#![allow(clippy::disallowed_methods)]\nfn main() { std::path::Path::new(".").exists(); }\n',
    ],
    [
      "ignored source child",
      "src-tauri/src",
      ["hidden"],
      1,
      "src-tauri/src/hidden/\n",
      "mod.rs",
      'use std::path::Path;\npub fn hidden() { Path::new(".").exists(); }\n',
    ],
    [
      "ignored nested child",
      "src-tauri/src",
      ["hidden", "child"],
      2,
      "src-tauri/src/hidden/\n",
      "mod.rs",
      'use std::path::Path;\npub fn hidden() { Path::new(".").exists(); }\n',
    ],
    [
      "untracked nested child",
      "src-tauri/src",
      ["hidden", "child"],
      2,
      null,
      "mod.rs",
      'use std::path::Path;\npub fn hidden() { Path::new(".").exists(); }\n',
    ],
  ];
  test.each(nestedRepositoryCases)(
    "O3.7 rejects a nested repository in the %s",
    async (_name, parentPath, pathSegments, depth, gitignoreSeed, sourcePath, source) => {
      const path = join(parentPath, ...pathSegments.slice(0, depth));
      const files = gitignoreSeed ? [{ path: ".gitignore", contents: gitignoreSeed }] : [];
      const result = await runCheckerOver(files, [], {
        prepare: async (root, phase) => {
          if (phase !== "after-remove") return;
          const remove = spawnSync(
            "git",
            ["rm", "-r", "--cached", "--quiet", "--ignore-unmatch", "--", path],
            { cwd: root, encoding: "utf8" },
          );
          expect(remove.status).toBe(0);
          expect(remove.error).toBeUndefined();
          const directory = join(root, path);
          await mkdir(directory, { recursive: true });
          const init = spawnSync("git", ["init", "--quiet"], {
            cwd: directory,
            encoding: "utf8",
          });
          expect(init.status).toBe(0);
          expect(init.error).toBeUndefined();
          await mkdir(dirname(join(directory, sourcePath)), { recursive: true });
          await writeFile(join(directory, sourcePath), source);
        },
      });
      expectCliStatus(result, 1);
      expect(result.output).toContain(
        `${path}: R5: untracked nested git repositories are not allowed in the Rust source tree`,
      );
    },
  );
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
});
