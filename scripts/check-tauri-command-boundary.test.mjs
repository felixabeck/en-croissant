import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, test } from "vitest";
import {
  NATIVE_EXPORT_ALLOWLIST,
  inspectCapability,
  inspectCsp,
  inspectSource,
  runTauriBoundaryCheck,
} from "./check-tauri-command-boundary.mjs";
import { listWorkingTreeFiles } from "./working-tree-files.mjs";

const REPOSITORY_ROOT = process.cwd();
const CHECKER = join(REPOSITORY_ROOT, "scripts/check-tauri-command-boundary.mjs");
const NATIVE_SOURCE = readFileSync(join(REPOSITORY_ROOT, "src/platform/native.ts"), "utf8");
const temporaryRoots = [];

afterAll(() => {
  for (const root of temporaryRoots) rmSync(root, { recursive: true, force: true });
});

function expectViolation(path, source, message, options) {
  expect(inspectSource(path, source, options)).toEqual(
    expect.arrayContaining([expect.stringMatching(message)]),
  );
}

describe("source boundary forms", () => {
  test.each([
    ["from a plugin", "foo.ts", 'import { platform } from "@tauri-apps/plugin-os"', /@tauri-apps/],
    ["from the root API", "foo.ts", 'import { event } from "@tauri-apps/api"', /@tauri-apps/],
    ["dynamic import", "foo.ts", 'await import("@tauri-apps/api/core")', /@tauri-apps/],
    ["require", "foo.ts", 'require("@tauri-apps/api/event")', /@tauri-apps/],
    ["side-effect import", "foo.ts", 'import "@tauri-apps/plugin-os"', /@tauri-apps/],
    ["Vitest mock", "foo.test.ts", 'vi.mock("@tauri-apps/plugin-os", () => ({}))', /@tauri-apps/],
    [
      "generated type import",
      "foo.ts",
      'import type { Score } from "@/bindings/generated"',
      /bindings\/generated/,
    ],
    [
      "generated dynamic import",
      "foo.ts",
      'await import("@/bindings/generated")',
      /bindings\/generated/,
    ],
    [
      "generated side-effect import",
      "foo.ts",
      'import "@/bindings/generated"',
      /bindings\/generated/,
    ],
    ["generated require", "foo.ts", 'require("@/bindings/generated")', /bindings\/generated/],
    [
      "commands barrel import",
      "foo.ts",
      'import { commands } from "@/bindings"',
      /commands\/events/,
    ],
    [
      "mixed commands barrel import",
      "foo.ts",
      'import { commands, type events } from "@/bindings"',
      /commands\/events/,
    ],
    ["bare listen", "foo.ts", 'listen("x", cb)', /raw listen/],
    ["object listen", "foo.ts", "events.foo.listen(cb)", /raw \.listen/],
    ["tauriEvents", "foo.ts", "tauriEvents.foo", /tauriEvents/],
    [
      "Tauri facade native import",
      "platform/tauri.ts",
      'import { anything } from "@tauri-apps/plugin-fs"',
      /@tauri-apps/,
    ],
  ])("rejects %s", (_name, path, source, message) => {
    expectViolation(path, source, message);
  });

  test.each([
    [
      "Tauri facade generated bindings and listeners",
      "platform/tauri.ts",
      'import { commands, events } from "@/bindings/generated"; events.foo.listen(cb)',
    ],
    [
      "generated binding Tauri imports",
      "bindings/generated.ts",
      'import { invoke } from "@tauri-apps/api/core"',
    ],
    [
      "a dependency-name string",
      "platform/no-updater.test.ts",
      'hasDependency(packageJson, "@tauri-apps/plugin-updater")',
    ],
    ["a type-only barrel import", "foo.ts", 'import type { Score } from "@/bindings"'],
    ["a WebviewWindow listener", "components/TopBar.tsx", "appWindow.onResized(() => {})"],
    ["a variable dynamic import", "foo.ts", 'const p = "@tauri-apps/api/event"; import(p)'],
    [
      "a generated-bindings mock",
      "foo.test.ts",
      'vi.mock("@/bindings/generated", () => ({ commands: {}, events: {} }))',
    ],
  ])("allows %s", (_name, path, source) => {
    expect(inspectSource(path, source)).toEqual([]);
  });
});

describe("native facade contract", () => {
  test("accepts today's exact native facade", () => {
    expect(inspectSource("platform/native.ts", NATIVE_SOURCE)).toEqual([]);
  });

  test.each([
    ["listen re-export", 'export { listen } from "@tauri-apps/api/event"', /denylist.*listen/],
    ["dynamic import", 'await import("@tauri-apps/api/event")', /named Tauri re-exports/],
    ["require", 'require("@tauri-apps/api/event")', /named Tauri re-exports/],
    ["Vitest mock", 'vi.mock("@tauri-apps/plugin-os", () => ({}))', /named Tauri re-exports/],
    [
      "root API export",
      'export { event as tauriEvents } from "@tauri-apps/api"',
      /denylist.*event as tauriEvents/,
    ],
    ["export star", 'export * from "@tauri-apps/plugin-fs"', /export star.*plugin-fs/],
    [
      "namespaced export star",
      'export * as fs from "@tauri-apps/plugin-fs"',
      /export star.*plugin-fs/,
    ],
    [
      "aliased invoke",
      'export { invoke as convertFileSrc } from "@tauri-apps/api/core"',
      /denylist.*invoke as convertFileSrc/,
    ],
    [
      "invoke beside the allowed export",
      'export { invoke, convertFileSrc } from "@tauri-apps/api/core"',
      /denylist.*invoke/,
    ],
  ])("rejects %s", (_name, source, message) => {
    expectViolation("platform/native.ts", source, message);
  });

  test("keeps the denylist independent from the allowlist", () => {
    const listen = {
      specifier: "@tauri-apps/api/event",
      exported: "listen",
      local: "listen",
    };
    expectViolation(
      "platform/native.ts",
      'export { listen } from "@tauri-apps/api/event"',
      /denylist.*listen/,
      { allowlist: [listen] },
    );
  });

  test("rejects a non-denylisted extra export", () => {
    expectViolation(
      "platform/native.ts",
      `${NATIVE_SOURCE}\nexport { relaunch } from "@tauri-apps/plugin-process";`,
      /not allowlisted.*relaunch/,
    );
  });

  test("rejects a missing allowlisted export", () => {
    const withoutExit = NATIVE_SOURCE.replace(
      'export { exit } from "@tauri-apps/plugin-process";\n',
      "",
    );
    expectViolation("platform/native.ts", withoutExit, /missing.*plugin-process:exit/);
  });

  test("parses type-as and renamed type exports exactly", () => {
    const osEntries = NATIVE_EXPORT_ALLOWLIST.filter(
      ({ specifier }) => specifier === "@tauri-apps/plugin-os",
    );
    expect(osEntries).toEqual(
      expect.arrayContaining([
        { specifier: "@tauri-apps/plugin-os", exported: "type", local: "osType" },
        { specifier: "@tauri-apps/plugin-os", exported: "version", local: "OSVersion" },
      ]),
    );
    expect(inspectSource("platform/native.ts", NATIVE_SOURCE)).toEqual([]);
  });
});

describe("capability and CSP boundaries", () => {
  test("rejects broad capability permissions", () => {
    expect(inspectCapability({ permissions: ["core:default", "fs:write-all"] })).toEqual(
      expect.arrayContaining([expect.stringMatching(/core:default.*fs:write-all/)]),
    );
  });

  test("rejects renderer filesystem permissions", () => {
    expect(inspectCapability({ permissions: ["fs:allow-read"] })).toEqual(
      expect.arrayContaining([expect.stringMatching(/fs:allow-read/)]),
    );
  });

  test("rejects wildcard HTTPS origins", () => {
    expect(inspectCsp("default-src 'self'; connect-src https://*")).toEqual([
      expect.stringMatching(/exact remote origins/),
    ]);
  });
});

describe("working-tree enumeration and reads", () => {
  test("uses the exact tracked and untracked git argv and deduplicates", () => {
    const calls = [];
    const runGit = (command, args, options) => {
      calls.push([command, args, options]);
      return { status: 0, stdout: "src/foo.ts\nsrc/shared.ts\n" };
    };
    expect(listWorkingTreeFiles({ workspaceRoot: "/fixture", runGit })).toEqual([
      "src/foo.ts",
      "src/shared.ts",
    ]);
    expect(calls.map(([, args]) => args)).toEqual([
      ["ls-files", "--others", "--exclude-standard", "--", "src"],
      ["ls-files", "--", "src"],
    ]);
  });

  test("fails closed when git cannot start", () => {
    expect(() =>
      listWorkingTreeFiles({
        workspaceRoot: "/fixture",
        runGit: () => ({ error: new Error("git unavailable") }),
      }),
    ).toThrow(/git unavailable/);
  });

  test("fails closed when git exits non-zero", () => {
    expect(() =>
      listWorkingTreeFiles({
        workspaceRoot: "/fixture",
        runGit: () => ({ status: 1, stderr: "boom" }),
      }),
    ).toThrow(/boom/);
  });

  test("skips only an ENOENT working-tree source", () => {
    const readFile = (path) => {
      if (path.endsWith("missing.ts")) throw Object.assign(new Error("gone"), { code: "ENOENT" });
      if (path.endsWith("main.json")) return '{"permissions":[]}';
      return '{"app":{"security":{"csp":"default-src self"}}}';
    };
    expect(
      runTauriBoundaryCheck({
        workspaceRoot: "/fixture",
        listFiles: () => ["src/missing.ts"],
        readFile,
      }),
    ).toEqual(["src/missing.ts"]);
  });

  test("rethrows a non-ENOENT working-tree read failure", () => {
    const failure = Object.assign(new Error("is a directory"), { code: "EISDIR" });
    expect(() =>
      runTauriBoundaryCheck({
        workspaceRoot: "/fixture",
        listFiles: () => ["src/unreadable.ts"],
        readFile: () => {
          throw failure;
        },
      }),
    ).toThrow(/is a directory/);
  });
});

function createCliWorkspace({ untrackedLeak = false }) {
  const root = mkdtempSync(join(tmpdir(), "tauri-boundary-"));
  temporaryRoots.push(root);
  mkdirSync(join(root, "src/platform"), { recursive: true });
  mkdirSync(join(root, "src-tauri/capabilities"), { recursive: true });
  writeFileSync(
    join(root, "src/platform/native.ts"),
    untrackedLeak ? NATIVE_SOURCE : 'export { listen } from "@tauri-apps/api/event";\n',
  );
  writeFileSync(join(root, "src-tauri/capabilities/main.json"), '{"permissions":[]}\n');
  writeFileSync(
    join(root, "src-tauri/tauri.conf.json"),
    '{"app":{"security":{"csp":"default-src self"}}}\n',
  );
  expect(spawnSync("git", ["init", "--quiet"], { cwd: root }).status).toBe(0);
  expect(
    spawnSync("git", ["add", "src/platform/native.ts", "src-tauri"], { cwd: root }).status,
  ).toBe(0);
  if (untrackedLeak) {
    writeFileSync(join(root, "src/leak.ts"), 'import { readFile } from "@tauri-apps/plugin-fs";\n');
  }
  return root;
}

describe("CLI", () => {
  test("rejects a denylisted native re-export through the real CLI", () => {
    const result = spawnSync(process.execPath, [CHECKER], {
      cwd: createCliWorkspace({ untrackedLeak: false }),
      encoding: "utf8",
    });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toMatch(/listen.*api\/event|api\/event.*listen/);
  });

  test("scans untracked source files through the real CLI", () => {
    const result = spawnSync(process.execPath, [CHECKER], {
      cwd: createCliWorkspace({ untrackedLeak: true }),
      encoding: "utf8",
    });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toMatch(/src\/leak\.ts.*@tauri-apps/);
  });
});
