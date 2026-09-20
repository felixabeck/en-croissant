import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { performance } from "node:perf_hooks";
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
const VALID_SECURITY_CONFIG = JSON.stringify({
  app: {
    security: {
      csp: "default-src self",
    },
  },
});
const temporaryRoots = [];
const UPDATER_SPECIFIER = "@tauri-apps/plugin-updater";
const B0_ORACLE_FORMS = [
  ["A", `import { check } from "${UPDATER_SPECIFIER}";`, "must-stay-a-violation"],
  ["B", `await import("${UPDATER_SPECIFIER}");`, "must-stay-a-violation"],
  ["C", `await import(\`${UPDATER_SPECIFIER}\`);`, "must-flip"],
  ["D", `await import(/* c */ "${UPDATER_SPECIFIER}");`, "must-flip"],
  ["E", `require(\`${UPDATER_SPECIFIER}\`);`, "must-flip"],
  ["F", `require(/* c */ "${UPDATER_SPECIFIER}");`, "must-flip"],
  ["G", `vi.mock(\`${UPDATER_SPECIFIER}\`);`, "must-flip"],
  ["H", `vi.mock(/* c */ "${UPDATER_SPECIFIER}");`, "must-flip"],
  ["I", `import "${UPDATER_SPECIFIER}";`, "must-stay-a-violation"],
  ["J", 'await import("@tauri-apps/" + "plugin-updater");', "must-stay-silent"],
  ["K", `// we do not use ${UPDATER_SPECIFIER} here`, "must-stay-silent"],
  ["L", `const msg = "install ${UPDATER_SPECIFIER}";`, "must-stay-silent"],
  ["M", `const m = await import(// c\r"${UPDATER_SPECIFIER}");`, "must-be-violation"],
  ["N", `import /* c */ "${UPDATER_SPECIFIER}";`, "must-be-violation"],
  ["O", `import { check } from /* c */ "${UPDATER_SPECIFIER}";`, "must-be-violation"],
  ["P", `const m = require /* c */ ("${UPDATER_SPECIFIER}");`, "must-be-violation"],
  ["Q", `const m = await import /* c */ ("${UPDATER_SPECIFIER}");`, "must-be-violation"],
  ["R", `vi.mock /* c */ ("${UPDATER_SPECIFIER}");`, "must-be-violation"],
  ["S", `const m = await import\n// c\n("${UPDATER_SPECIFIER}");`, "must-be-violation"],
  ["T", `vi /* c */ .mock("${UPDATER_SPECIFIER}");`, "must-be-violation"],
  ["U", `vi . mock("${UPDATER_SPECIFIER}");`, "must-be-violation"],
];
const B0_ORACLE_CASES = B0_ORACLE_FORMS.flatMap(([row, source, expected]) =>
  ["components/probe.ts", "bindings/generated.ts"].map((path) => ({
    row,
    path,
    source,
    expected,
  })),
);

afterAll(() => {
  for (const root of temporaryRoots) rmSync(root, { recursive: true, force: true });
});

function expectViolation(path, source, message, options) {
  expect(inspectSource(path, source, options)).toEqual(
    expect.arrayContaining([expect.stringMatching(message)]),
  );
}

describe("source boundary forms", () => {
  test.each(B0_ORACLE_CASES)("B0 row $row on $path is $expected", ({ path, source, expected }) => {
    const violations = inspectSource(path, source);
    expect(violations.length > 0).toBe(expected !== "must-stay-silent");
  });

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
      "generated binding Tauri imports and event proxy listeners",
      "bindings/generated.ts",
      'import { invoke } from "@tauri-apps/api/core";\n' +
        'import { listen as eventListen } from "@tauri-apps/api/event";\n' +
        'import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";\n' +
        "window.listen(name, arg);\nTAURI_API_EVENT.listen(name, arg);",
    ],
    [
      "a dependency-name string",
      "platform/fork-updater.test.ts",
      'source.includes("@tauri-apps/plugin-updater")',
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

  test("handles long comment gaps without catastrophic backtracking", () => {
    const sources = [
      "from " + "/".repeat(200) + "x",
      "from " + "//x ".repeat(200) + "z",
      "from " + "/*x*/".repeat(200) + "z",
    ];
    const startedAt = performance.now();

    for (const source of sources) {
      expect(inspectSource("components/probe.ts", source)).toEqual([]);
    }
    expect(performance.now() - startedAt).toBeLessThan(1000);
  });
});

describe("native facade contract", () => {
  test("accepts today's exact native facade", () => {
    expect(inspectSource("platform/native.ts", NATIVE_SOURCE)).toEqual([]);
  });

  test("accepts a comment after from in a native re-export", () => {
    const withComment = NATIVE_SOURCE.replace(
      'export { check, type Update } from "@tauri-apps/plugin-updater";',
      'export { check, type Update } from /* c */ "@tauri-apps/plugin-updater";',
    );
    expect(inspectSource("platform/native.ts", withComment)).toEqual([]);
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
      `${NATIVE_SOURCE}\nexport { installUpdate } from "@tauri-apps/plugin-updater";`,
      /not allowlisted.*installUpdate/,
    );
  });

  test("rejects a missing allowlisted export", () => {
    const withoutExit = NATIVE_SOURCE.replace(
      'export { exit, relaunch } from "@tauri-apps/plugin-process";\n',
      'export { relaunch } from "@tauri-apps/plugin-process";\n',
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

  test("rejects updater:default in favour of exact updater permissions", () => {
    expect(inspectCapability({ permissions: ["updater:default"] })).toEqual(
      expect.arrayContaining([expect.stringMatching(/updater:default/)]),
    );
    expect(
      inspectCapability({
        permissions: ["updater:allow-check", "updater:allow-download-and-install"],
      }),
    ).toEqual([]);
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

  test("rejects the asset protocol scheme in any directive", () => {
    expect(inspectCsp("default-src 'self'; img-src asset:")).toEqual([
      expect.stringMatching(/asset protocol/),
    ]);
    expect(inspectCsp("default-src 'self'; media-src 'self' asset: http://127.0.0.1:*")).toEqual([
      expect.stringMatching(/asset protocol/),
    ]);
  });

  test("accepts a CSP without the asset scheme", () => {
    expect(inspectCsp("default-src 'self'; media-src 'self' http://127.0.0.1:*")).toEqual([]);
  });

  test("production CSP keeps loopback media-src for the sound server", () => {
    const config = JSON.parse(
      readFileSync(join(REPOSITORY_ROOT, "src-tauri/tauri.conf.json"), "utf8"),
    );
    expect(config.app.security.csp).toMatch(/media-src[^;]*http:\/\/127\.0\.0\.1:\*/);
    expect(config.app.security.csp).not.toMatch(/www\.encroissant\.org/);
  });
});

describe("native-location and asset-protocol boundaries", () => {
  function fixtureCase({ permissions = [], assetProtocol, csp } = {}) {
    const config = JSON.parse(VALID_SECURITY_CONFIG);
    if (csp !== undefined) config.app.security.csp = csp;
    if (assetProtocol === null) {
      delete config.app.security.assetProtocol;
    } else if (assetProtocol !== undefined) {
      config.app.security.assetProtocol = assetProtocol;
    }
    return () =>
      runTauriBoundaryCheck({
        workspaceRoot: "/fixture",
        listFiles: () => ["src/platform/native.ts"],
        readFile: (path) => {
          if (path.endsWith("native.ts")) return NATIVE_SOURCE;
          if (path.endsWith("main.json")) return JSON.stringify({ permissions });
          return JSON.stringify(config);
        },
      });
  }

  test.each(["core:path:allow-resolve", "core:path:allow-resolve-directory"])(
    "rejects %s through the full boundary runner",
    (permission) => {
      expect(fixtureCase({ permissions: [permission] })).toThrow(
        /renderer native-location authority is forbidden/,
      );
    },
  );

  test("allows core:path:allow-join through the full boundary runner", () => {
    expect(fixtureCase({ permissions: ["core:path:allow-join"] })).not.toThrow();
  });

  test.each([
    ["the old $RESOURCE scope while enabled", { enable: true, scope: ["$RESOURCE/**"] }],
    ["any other scope while enabled", { enable: true, scope: ["$APPDATA/**"] }],
  ])(
    "rejects an enabled asset protocol with %s through the full boundary runner",
    (_name, assetProtocol) => {
      expect(fixtureCase({ assetProtocol })).toThrow(/asset protocol must stay disabled/);
    },
  );

  test("allows an absent asset protocol block through the full boundary runner", () => {
    expect(fixtureCase()).not.toThrow();
    expect(fixtureCase({ assetProtocol: null })).not.toThrow();
  });

  test("allows a disabled asset protocol block through the full boundary runner", () => {
    expect(
      fixtureCase({ assetProtocol: { enable: false, scope: ["$RESOURCE/**"] } }),
    ).not.toThrow();
  });

  test("rejects a fixture CSP that still lists the asset scheme", () => {
    expect(
      fixtureCase({ csp: "default-src 'self'; media-src 'self' asset: http://127.0.0.1:*" }),
    ).toThrow(/asset protocol/);
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
      if (path.endsWith("native.ts")) return NATIVE_SOURCE;
      if (path.endsWith("main.json")) return '{"permissions":[]}';
      return VALID_SECURITY_CONFIG;
    };
    expect(
      runTauriBoundaryCheck({
        workspaceRoot: "/fixture",
        listFiles: () => ["src/missing.ts", "src/platform/native.ts"],
        readFile,
      }),
    ).toEqual(["src/missing.ts", "src/platform/native.ts"]);
  });

  test("rejects a missing native facade even when the listed path is ENOENT", () => {
    expect(() =>
      runTauriBoundaryCheck({
        workspaceRoot: "/fixture",
        listFiles: () => ["src/platform/native.ts"],
        readFile: (path) => {
          if (path.endsWith("native.ts")) {
            throw Object.assign(new Error("gone"), { code: "ENOENT" });
          }
          if (path.endsWith("main.json")) return '{"permissions":[]}';
          return VALID_SECURITY_CONFIG;
        },
      }),
    ).toThrow(/native facade is missing/);
  });

  test("names the file when capability JSON cannot be parsed", () => {
    expect(() =>
      runTauriBoundaryCheck({
        workspaceRoot: "/fixture",
        listFiles: () => ["src/platform/native.ts"],
        readFile: (path) => {
          if (path.endsWith("native.ts")) return NATIVE_SOURCE;
          if (path.endsWith("main.json")) return "{";
          return VALID_SECURITY_CONFIG;
        },
      }),
    ).toThrow(/capabilities\/main\.json/);
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

function createCliWorkspace({ nativeSource, untrackedSource } = {}) {
  const root = mkdtempSync(join(tmpdir(), "tauri-boundary-"));
  temporaryRoots.push(root);
  mkdirSync(join(root, "src/platform"), { recursive: true });
  mkdirSync(join(root, "src-tauri/capabilities"), { recursive: true });
  writeFileSync(join(root, "src/platform/native.ts"), nativeSource);
  writeFileSync(join(root, "src-tauri/capabilities/main.json"), '{"permissions":[]}\n');
  writeFileSync(join(root, "src-tauri/tauri.conf.json"), `${VALID_SECURITY_CONFIG}\n`);
  expect(spawnSync("git", ["init", "--quiet"], { cwd: root }).status).toBe(0);
  expect(
    spawnSync("git", ["add", "src/platform/native.ts", "src-tauri"], { cwd: root }).status,
  ).toBe(0);
  if (untrackedSource) {
    writeFileSync(join(root, "src/leak.ts"), untrackedSource);
  }
  return root;
}

describe("CLI", () => {
  test("rejects a denylisted native re-export through the real CLI", () => {
    const result = spawnSync(process.execPath, [CHECKER], {
      cwd: createCliWorkspace({
        nativeSource: 'export { listen } from "@tauri-apps/api/event";\n',
      }),
      encoding: "utf8",
    });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toMatch(/listen.*api\/event|api\/event.*listen/);
  });

  test("scans untracked source files through the real CLI", () => {
    const result = spawnSync(process.execPath, [CHECKER], {
      cwd: createCliWorkspace({
        nativeSource: NATIVE_SOURCE,
        untrackedSource: 'import { readFile } from "@tauri-apps/plugin-fs";\n',
      }),
      encoding: "utf8",
    });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toMatch(/src\/leak\.ts.*@tauri-apps/);
  });
});
