import { execFileSync, spawnSync } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test, vi } from "vitest";
import { gitInit, gitTrack } from "./test-git-init.mjs";

const seam = vi.hoisted(() => ({ followsAlias: null, resolveChain: null }));

vi.mock("./parse-ts-source.mjs", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    followsAlias(...args) {
      return seam.followsAlias ? seam.followsAlias(...args) : actual.followsAlias(...args);
    },
    resolveChain(...args) {
      return seam.resolveChain ? seam.resolveChain(...args) : actual.resolveChain(...args);
    },
  };
});

const { enumerateCommands, runIpcCommandConsumerCheck } =
  await import("./check-ipc-command-consumers.mjs");
const { parseTsSource } = await import("./parse-ts-source.mjs");

const ROOT = "/fixture";
const checkerPath = join(import.meta.dirname, "check-ipc-command-consumers.mjs");
const VALID_FINDING = { id: "f-20260906-11", status: "open", body: "Owns X." };

function generated(names = ["X"]) {
  return `export const commands = { ${names.map((name) => `async ${name}() {}`).join(", ")} };`;
}

function check(sources, { names = ["X"], allowlist = [], ledger = [VALID_FINDING] } = {}) {
  const paths = Object.keys(sources);
  const files = new Map([["src/bindings/generated.ts", generated(names)]]);
  for (const [path, source] of Object.entries(sources)) files.set(path, source);
  return runIpcCommandConsumerCheck({
    workspaceRoot: ROOT,
    listFiles: () => paths,
    readFile: (path) => {
      const relative = path.slice(`${ROOT}/`.length);
      if (relative === "tasks/findings.md") return "# fixture findings\n";
      if (files.has(relative) && files.get(relative) !== undefined) return files.get(relative);
      throw Object.assign(new Error(`missing ${relative}`), { code: "ENOENT" });
    },
    allowlist,
    readLedger: () => ledger,
  });
}

function c1(name) {
  return `C1: command ${name} has no production consumer`;
}

function c5(path, line, text) {
  return `C5: ${path}:${line}: facade reach is not statically resolvable: ${text}`;
}

function facadeResult() {
  return {
    node: {
      type: "ImportSpecifier",
      importKind: "value",
      imported: { type: "Identifier", name: "tauri" },
    },
    binding: {
      path: {
        parentPath: {
          node: {
            type: "ImportDeclaration",
            importKind: "value",
            source: { value: "@/platform/tauri" },
          },
        },
      },
    },
  };
}

function expectSet(actual, expected) {
  expect(actual).toEqual([...expected].sort());
}

function expectExactError(callback, message) {
  let thrown;
  try {
    callback();
  } catch (error) {
    thrown = error;
  }
  expect(thrown?.message).toBe(message);
}

function shellQuote(value) {
  return `'${value.replaceAll("'", "'\\''")}'`;
}

function cliWorkspace({
  bindings = generated(),
  allowlist = "[]",
  ledger = "# fixture findings\n",
  source,
  findingsOutput = "[]",
  findingsStatus = 0,
  findingsStderr = "",
  findingsScript = true,
  git = true,
} = {}) {
  const root = mkdtempSync(join(tmpdir(), "ipc-consumers-"));
  mkdirSync(join(root, "src", "bindings"), { recursive: true });
  mkdirSync(join(root, "tasks"), { recursive: true });
  mkdirSync(join(root, "scripts"), { recursive: true });
  writeFileSync(join(root, "src", "bindings", "generated.ts"), bindings);
  if (allowlist !== null)
    writeFileSync(join(root, "ipc-command-consumer-allowlist.json"), allowlist);
  if (ledger !== null) writeFileSync(join(root, "tasks", "findings.md"), ledger);
  if (source !== undefined) {
    writeFileSync(join(root, "src", "consumer.ts"), source);
  }
  if (findingsScript) {
    const stderr = findingsStderr ? `printf '%s' ${shellQuote(findingsStderr)} >&2\n` : "";
    writeFileSync(
      join(root, "scripts", "findings.py"),
      `#!/bin/sh\n${stderr}printf '%s' ${shellQuote(findingsOutput)}\nexit ${findingsStatus}\n`,
    );
    chmodSync(join(root, "scripts", "findings.py"), 0o755);
  }
  if (git) {
    gitInit(root);
    const sourcePaths = source === undefined ? [] : ["src/consumer.ts"];
    gitTrack(root, "src/bindings/generated.ts", ...sourcePaths);
  }
  return root;
}

function runCli(root, env = {}) {
  return spawnSync(process.execPath, [checkerPath], {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, ...env },
  });
}

function assertCli(root, expected, { status = 1, env = {} } = {}) {
  const result = runCli(root, env);
  expect(result.error).toBeUndefined();
  expect(result.status).toBe(status);
  expect(result.stdout).toBe("");
  expect(result.stderr).toBe(expected ? `${expected}\n` : "");
}

function nodeReadError(path) {
  try {
    readFileSync(path, "utf8");
  } catch (error) {
    return error.message;
  }
  throw new Error(`Expected ${path} to be unreadable`);
}

function jsonParseError(source) {
  try {
    JSON.parse(source);
  } catch (error) {
    return error.message;
  }
  throw new Error("Expected malformed JSON");
}

describe("command enumeration", () => {
  test("matches the real async method oracle", () => {
    const path = join(process.cwd(), "src/bindings/generated.ts");
    const source = readFileSync(path, "utf8");
    const ast = parseTsSource(source, path);
    const parsed = enumerateCommands(ast, "src/bindings/generated.ts").sort();
    const oracle = execFileSync("grep", ["-oP", "^async \\K[A-Za-z0-9_]+(?=\\()", path], {
      encoding: "utf8",
    })
      .trim()
      .split("\n")
      .sort();
    expect(parsed).toEqual(oracle);
  });

  test("selects only the exported commands object and only async methods", () => {
    const ast = parseTsSource(
      `{ const commands = { async stale() {} }; }\n// async fake() {}\nexport const commands = { async live() {}, stale() {}, sync() {} };`,
      "fixture.ts",
    );
    expect(enumerateCommands(ast, "fixture.ts")).toEqual(["live"]);
  });

  test.each([
    [
      "missing export",
      "const commands = {};",
      "src/bindings/generated.ts: exported commands declaration is missing",
    ],
    [
      "non-object initializer",
      "export const commands = factory();",
      "src/bindings/generated.ts: exported commands initializer is not an ObjectExpression",
    ],
    [
      "non-method member",
      "export const commands = { X: async () => {} };",
      "src/bindings/generated.ts: commands object member 0 is not an ObjectMethod with a plain Identifier key",
    ],
    [
      "computed key",
      "export const commands = { async [key]() {} };",
      "src/bindings/generated.ts: commands object member 0 is not an ObjectMethod with a plain Identifier key",
    ],
    [
      "string key",
      'export const commands = { async "X"() {} };',
      "src/bindings/generated.ts: commands object member 0 is not an ObjectMethod with a plain Identifier key",
    ],
  ])("throws for an unsupported %s", (_name, source, message) => {
    expectExactError(
      () =>
        enumerateCommands(
          parseTsSource(source, "src/bindings/generated.ts"),
          "src/bindings/generated.ts",
        ),
      message,
    );
  });
});

describe("resolved facade consumers", () => {
  test.each([
    ["comment", "// tauri.X()", [c1("X")]],
    ["string", 'const text = "tauri.X()";', [c1("X")]],
    ["mock key", "const mock = { X: vi.fn() };", [c1("X")]],
    ["type position", 'type T = "X";', [c1("X")]],
  ])("does not count a %s mention", (_name, source, expected) => {
    expectSet(check({ "src/consumer.ts": source }), expected);
  });

  test.each([
    ["tauri.X", 'import { tauri } from "@/platform/tauri"; tauri.X;', []],
    ["value reference", 'import { tauri } from "@/platform/tauri"; const fn = tauri.X;', []],
    ["split lines", 'import { tauri } from "@/platform/tauri";\ntauri\n  .X();', []],
    ["aliased import", 'import { tauri as facade } from "@/platform/tauri"; facade.X();', []],
    [
      "identifier destructure",
      'import { tauri } from "@/platform/tauri"; const { X } = tauri;',
      [],
    ],
    [
      "renamed destructure",
      'import { tauri } from "@/platform/tauri"; const { X: fn } = tauri;',
      [],
    ],
    [
      "string destructure",
      'import { tauri } from "@/platform/tauri"; const { "X": fn } = tauri;',
      [],
    ],
    ["optional member", 'import { tauri } from "@/platform/tauri"; tauri?.X();', []],
    [
      "optional commands member",
      'import { commands } from "@/bindings/generated"; commands?.X();',
      [],
      "src/platform/consumer.ts",
    ],
    [
      "aliased commands import",
      'import { commands as c } from "@/bindings/generated"; c.X();',
      [],
      "src/platform/consumer.ts",
    ],
    ["dot-normalized import", 'import { tauri } from "@/foo/../platform/tauri"; tauri.X();', []],
    ["relative import", 'import { tauri } from "../platform/tauri"; tauri.X();', []],
  ])("counts %s as a consumer", (_name, source, expected, path = "src/components/consumer.ts") => {
    expectSet(check({ [path]: source }), expected);
  });

  test("counts commands only in platform files", () => {
    expectSet(
      check({
        "src/platform/consumer.ts":
          'import { commands } from "@/bindings/generated"; commands.X();',
      }),
      [],
    );
    expectSet(
      check({
        "src/components/consumer.ts":
          'import { commands } from "@/bindings/generated"; commands.X();',
      }),
      [c1("X")],
    );
  });

  test.each([
    ["unrelated object", "editor.commands.X();", [c1("X")]],
    [
      "shadowed parameter",
      'import { tauri } from "@/platform/tauri"; function f(tauri) { tauri.X(); }',
      [c1("X")],
    ],
    [
      "shadowed block local",
      'import { tauri } from "@/platform/tauri"; { const tauri = editor; tauri.X(); }',
      [c1("X")],
    ],
    [
      "shadowed commands parameter",
      'import { commands } from "@/bindings/generated"; function f(commands) { commands.X(); }',
      [c1("X")],
      "src/platform/consumer.ts",
    ],
    [
      "shadowed commands block local",
      'import { commands } from "@/bindings/generated"; { const commands = editor; commands.X(); }',
      [c1("X")],
      "src/platform/consumer.ts",
    ],
    [
      "wrong imported member",
      'import { withDownloadTicket as tauri } from "@/platform/tauri"; tauri.X();',
      [c1("X")],
    ],
    [
      "wrong commands member",
      'import { events as commands } from "@/bindings/generated"; commands.X();',
      [c1("X")],
      "src/platform/consumer.ts",
    ],
    ["wrong source", 'import { tauri } from "./unrelated/tauri"; tauri.X();', [c1("X")]],
  ])("does not credit %s", (_name, source, expected, path = "src/components/consumer.ts") => {
    expectSet(check({ [path]: source }), expected);
  });

  test("does not credit an unrelated module beside the real facade", () => {
    expectSet(
      check({
        "src/components/consumer.ts":
          'import { tauri } from "@/platform/tauri"; import { tauri as other } from "./unrelated/tauri"; other.X();',
      }),
      [c1("X")],
    );
  });

  test("handles commands aliases, nested shadowing and every value wrapper", () => {
    const sources = {
      "src/components/consumer.ts": `
        import { tauri } from "@/platform/tauri";
        const facade = tauri; const deeper = facade; deeper.X();
        const a = tauri; function f() { const b = a; { const a = b; a.X(); } }
        const w1 = tauri as typeof tauri; w1.X();
        const w2 = tauri satisfies typeof tauri; w2.X();
        const w3 = tauri!; w3.X();
        const run = (api = tauri) => api.X();
        const run2 = ({ X } = tauri) => X();
      `,
      "src/components/assertion.ts": `import { tauri } from "@/platform/tauri"; const w4 = <typeof tauri>tauri; w4.X(); const w5 = tauri<typeof tauri>; w5.X(); const w6 = (tauri); w6.X();`,
    };
    expectSet(check(sources), []);
  });

  test("resolves wrapper member objects and assignment destructuring", () => {
    expectSet(
      check({
        "src/components/consumer.ts": `import { tauri } from "@/platform/tauri"; (tauri as typeof tauri).X(); let g; ({ X: g } = tauri);`,
      }),
      [],
    );
  });

  test("keeps an unresolved alias loud and does not follow a non-facade alias", () => {
    expectSet(
      check({
        "src/components/consumer.ts": `import { tauri } from "@/platform/tauri"; let facade = tauri; facade = editor; facade.X();`,
      }),
      [c1("X"), c5("src/components/consumer.ts", 1, "tauri")],
    );
    expectSet(
      check({
        "src/components/consumer.ts": `import { tauri } from "@/platform/tauri"; const facade = editor; facade.X();`,
      }),
      [c1("X")],
    );
  });

  test("reports unresolvable computed and escaped facade references", () => {
    const source = `import { tauri } from "@/platform/tauri"; const key = "X"; tauri[key](); use(tauri); const copy = { ...tauri }; returnValue(tauri); const arr = [tauri];`;
    expectSet(check({ "src/components/consumer.ts": source }), [
      c1("X"),
      c5("src/components/consumer.ts", 1, "tauri[key]"),
      c5("src/components/consumer.ts", 1, "tauri"),
      c5("src/components/consumer.ts", 1, "tauri"),
      c5("src/components/consumer.ts", 1, "tauri"),
      c5("src/components/consumer.ts", 1, "tauri"),
    ]);
  });

  test("allows static destructures but rejects computed keys, rest, and defaults", () => {
    const source = `import { tauri } from "@/platform/tauri"; const key = "X"; const { [key]: fn } = tauri; const { ...X } = tauri; const { facade = tauri } = editor; facade.X();`;
    expectSet(check({ "src/components/consumer.ts": source }), [
      c1("X"),
      c5("src/components/consumer.ts", 1, "[key]: fn"),
      c5("src/components/consumer.ts", 1, "...X"),
      c5("src/components/consumer.ts", 1, "tauri"),
    ]);
  });

  test("recurses through aliases to classify later escapes", () => {
    expectSet(
      check({
        "src/components/consumer.ts":
          'import { tauri } from "@/platform/tauri"; const facade = tauri; use(facade); const copy = { ...facade };',
      }),
      [
        c1("X"),
        c5("src/components/consumer.ts", 1, "facade"),
        c5("src/components/consumer.ts", 1, "facade"),
      ],
    );
  });

  test("composes alias and destructuring classification", () => {
    expectSet(
      check(
        {
          "src/components/consumer.ts":
            'import { tauri } from "@/platform/tauri"; const facade = tauri; const { [key]: fn } = facade;',
        },
        { allowlist: [{ command: "X", finding: "f-20260906-11" }] },
      ),
      [c5("src/components/consumer.ts", 1, "[key]: fn")],
    );
  });
});

describe("C5 side surfaces and dynamic imports", () => {
  test.each([
    [
      "computed optional tauri",
      'import { tauri } from "@/platform/tauri"; tauri?.[key]();',
      "src/components/consumer.ts",
      "tauri?.[key]",
    ],
    [
      "computed optional commands",
      'import { commands } from "@/bindings/generated"; commands?.[key]();',
      "src/platform/consumer.ts",
      "commands?.[key]",
    ],
    [
      "namespace import",
      'import * as ns from "@/platform/tauri"; ns.tauri.X();',
      "src/components/consumer.ts",
      "ns",
    ],
    [
      "namespace export",
      'export * as ns from "@/platform/tauri";',
      "src/components/consumer.ts",
      "* as ns",
    ],
    [
      "named re-export",
      'export { tauri as t } from "@/platform/tauri";',
      "src/components/consumer.ts",
      "tauri as t",
    ],
    [
      "export star",
      'export * from "@/platform/tauri";',
      "src/components/consumer.ts",
      'export * from "@/platform/tauri";',
    ],
    [
      "string-literal named re-export",
      'export { "tauri" as t } from "@/platform/tauri";',
      "src/components/consumer.ts",
      '"tauri" as t',
    ],
  ])("reports %s", (_name, source, path, text) => {
    expectSet(
      check({ [path]: source }, { allowlist: [{ command: "X", finding: "f-20260906-11" }] }),
      [c5(path, 1, text)],
    );
  });

  test.each([
    [
      "used static tauri",
      'const m = await import("@/platform/tauri"); m.tauri.X();',
      "src/components/consumer.ts",
      'import("@/platform/tauri")',
    ],
    [
      "used relative tauri",
      'const m = await import("../platform/tauri"); m.tauri.X();',
      "src/components/consumer.ts",
      'import("../platform/tauri")',
    ],
    [
      "used static commands",
      'const m = await import("@/bindings/generated"); m.commands.X();',
      "src/platform/consumer.ts",
      'import("@/bindings/generated")',
    ],
    [
      "used relative commands",
      'const m = await import("../bindings/generated"); m.commands.X();',
      "src/platform/consumer.ts",
      'import("../bindings/generated")',
    ],
    [
      "constant-bound",
      'const spec = "@/platform/tauri"; const m = await import(spec); m.tauri.X();',
      "src/components/consumer.ts",
      "import(spec)",
    ],
    [
      "constant-bound as const",
      'const spec = "@/platform/tauri" as const; const m = await import(spec); m.tauri.X();',
      "src/components/consumer.ts",
      "import(spec)",
    ],
    [
      "destructured module",
      'const { tauri: f } = await import("@/platform/tauri"); f.X();',
      "src/components/consumer.ts",
      'import("@/platform/tauri")',
    ],
    [
      "direct awaited module member",
      '(await import("@/platform/tauri")).tauri.X();',
      "src/components/consumer.ts",
      'import("@/platform/tauri")',
    ],
    [
      "call argument",
      'use(await import("@/platform/tauri"));',
      "src/components/consumer.ts",
      'import("@/platform/tauri")',
    ],
    [
      "parameter default specifier",
      'const run = (spec = "@/platform/tauri") => import(spec); run();',
      "src/components/consumer.ts",
      "import(spec)",
    ],
    [
      "multi-hop specifier",
      'const a = "@/platform/tauri" as const; const spec = a; const m = await import(spec); m.tauri.X();',
      "src/components/consumer.ts",
      "import(spec)",
    ],
    [
      "constant template",
      "const m = await import(`@/platform/tauri`); m.tauri.X();",
      "src/components/consumer.ts",
      "import(`@/platform/tauri`)",
    ],
    ["bare discarded", 'await import("@/platform/tauri");', "src/components/consumer.ts", null],
    [
      "void discarded",
      'void (await import("@/platform/tauri"));',
      "src/components/consumer.ts",
      null,
    ],
    [
      "substituting template",
      "await import(`@/platform/${name}`);",
      "src/components/consumer.ts",
      null,
    ],
  ])("handles %s dynamic imports", (_name, source, path, importText) => {
    const expected = importText ? [c5(path, 1, importText)] : [];
    expectSet(
      check({ [path]: source }, { allowlist: [{ command: "X", finding: "f-20260906-11" }] }),
      expected,
    );
  });

  test("cycles are unresolvable input rather than C5", () => {
    for (const declaration of ["const a = b; const b = a;", "let a = b; let b = a;"]) {
      expectSet(
        check(
          { "src/components/consumer.ts": `${declaration} await import(a);` },
          { allowlist: [{ command: "X", finding: "f-20260906-11" }] },
        ),
        [],
      );
      expectSet(check({ "src/components/consumer.ts": `${declaration} a.X();` }), [c1("X")]);
    }
  });

  test("recognizes the narrow Proxy wholesale hold", () => {
    expectSet(
      check({
        "src/platform/tauri.ts":
          'import { commands } from "@/bindings/generated"; export const tauri = new Proxy(commands, {});',
      }),
      [c1("X")],
    );
    expectSet(
      check({
        "src/platform/other.ts":
          'import { commands } from "@/bindings/generated"; new Proxy(commands, {});',
      }),
      [c1("X"), c5("src/platform/other.ts", 1, "commands")],
    );
    expectSet(
      check({
        "src/platform/tauri.ts":
          'import { commands } from "@/bindings/generated"; new Factory(commands);',
      }),
      [c1("X"), c5("src/platform/tauri.ts", 1, "commands")],
    );
    expectSet(
      check({
        "src/platform/tauri.ts":
          'import { commands } from "@/bindings/generated"; const Proxy = Factory; new Proxy(commands, {});',
      }),
      [c1("X"), c5("src/platform/tauri.ts", 1, "commands")],
    );
  });

  test("does not treat type-only imports and exports as consumers or C5", () => {
    expectSet(
      check({
        "src/components/consumer.ts": `import type { tauri } from "@/platform/tauri"; import * as ns from "@/platform/tauri"; import { type tauri as tt } from "@/platform/tauri"; type A = typeof tauri; type B = tauri; type C = import("@/platform/tauri").tauri; type D = typeof ns; type E = ns.TauriCommands; export { type tauri as f } from "@/platform/tauri"; export type { tauri as f2 } from "@/platform/tauri"; export type * from "@/platform/tauri"; type F = typeof tt;`,
      }),
      [c1("X")],
    );
  });

  test("does not count an unreferenced namespace import", () => {
    expectSet(check({ "src/components/consumer.ts": 'import * as ns from "@/platform/tauri";' }), [
      c1("X"),
    ]);
  });

  test("ignores type-only namespace re-exports", () => {
    expectSet(
      check(
        { "src/components/consumer.ts": 'export type * as ns from "@/platform/tauri";' },
        { allowlist: [{ command: "X", finding: "f-20260906-11" }] },
      ),
      [],
    );
  });

  test("does not credit a wrong local named re-export", () => {
    expectSet(
      check(
        {
          "src/components/consumer.ts":
            'export { withDownloadTicket as tauri } from "@/platform/tauri";',
        },
        { allowlist: [{ command: "X", finding: "f-20260906-11" }] },
      ),
      [],
    );
  });
});

describe("allowlist, inputs, and real-tree boundaries", () => {
  test("enforces C2 and C3", () => {
    expectSet(
      check(
        { "src/components/consumer.ts": 'import { tauri } from "@/platform/tauri"; tauri.X();' },
        {
          allowlist: [
            { command: "X", finding: "f-20260906-11" },
            { command: "gone", finding: "f-20260906-11" },
          ],
          ledger: [{ id: "f-20260906-11", status: "open", body: "X and gone." }],
        },
      ),
      [
        "C2: allowlist entry X has a production consumer; remove the allowlist entry",
        "C3: allowlist entry gone names a command that is not exported",
      ],
    );
  });

  test.each([
    [
      "invalid id",
      [{ command: "X", finding: "not-a-finding" }],
      [VALID_FINDING],
      "C4.1: allowlist entry X has invalid finding id not-a-finding",
    ],
    [
      "missing unfenced finding",
      [{ command: "X", finding: "f-20260906-12" }],
      [VALID_FINDING],
      "C4.2: finding f-20260906-12 for allowlisted command X does not exist as an unfenced ledger entry",
    ],
    [
      "handled finding",
      [{ command: "X", finding: "f-20260906-12" }],
      [{ id: "f-20260906-12", status: "handled", body: "Owns X." }],
      "C4.3: finding f-20260906-12 for allowlisted command X is not open (status: handled)",
    ],
    [
      "rejected finding",
      [{ command: "X", finding: "f-20260906-12" }],
      [{ id: "f-20260906-12", status: "rejected", body: "Owns X." }],
      "C4.3: finding f-20260906-12 for allowlisted command X is not open (status: rejected)",
    ],
    [
      "finding does not name command",
      [{ command: "X", finding: "f-20260906-12" }],
      [{ id: "f-20260906-12", status: "open", body: "Owns Y." }],
      "C4.4: finding f-20260906-12 for allowlisted command X does not name X or _x",
    ],
  ])("reports its own C4 condition for %s", (_name, allowlist, ledger, expected) => {
    expectSet(check({}, { allowlist, ledger }), [expected]);
  });

  test("requires whole-token ownership in either spelling", () => {
    expectSet(
      check(
        {},
        {
          names: ["getPuzzleDbInfo"],
          allowlist: [{ command: "getPuzzle", finding: "f-20260906-12" }],
          ledger: [{ id: "f-20260906-12", status: "open", body: "getPuzzleDbInfo" }],
        },
      ),
      [
        c1("getPuzzleDbInfo"),
        "C3: allowlist entry getPuzzle names a command that is not exported",
        "C4.4: finding f-20260906-12 for allowlisted command getPuzzle does not name getPuzzle or get_puzzle",
      ],
    );
    expectSet(
      check(
        {},
        {
          names: ["getPuzzleDbInfo"],
          allowlist: [{ command: "getPuzzleDbInfo", finding: "f-20260906-12" }],
          ledger: [{ id: "f-20260906-12", status: "open", body: "get_puzzle" }],
        },
      ),
      [
        "C4.4: finding f-20260906-12 for allowlisted command getPuzzleDbInfo does not name getPuzzleDbInfo or get_puzzle_db_info",
      ],
    );
    expectSet(
      check(
        {},
        {
          names: ["getPuzzleDbInfo"],
          allowlist: [{ command: "get_puzzle", finding: "f-20260906-12" }],
          ledger: [{ id: "f-20260906-12", status: "open", body: "get_puzzle_db_info" }],
        },
      ),
      [
        c1("getPuzzleDbInfo"),
        "C3: allowlist entry get_puzzle names a command that is not exported",
        "C4.4: finding f-20260906-12 for allowlisted command get_puzzle does not name get_puzzle or get_puzzle",
      ],
    );
  });

  test("accepts snake_case ownership", () => {
    expectSet(
      check(
        {},
        {
          names: ["getPuzzleDbInfo"],
          allowlist: [{ command: "getPuzzleDbInfo", finding: "f-20260906-12" }],
          ledger: [{ id: "f-20260906-12", status: "open", body: "get_puzzle_db_info" }],
        },
      ),
      [],
    );
  });

  test("counts untracked sources and skips deleted tracked sources", () => {
    expectSet(
      check({
        "src/untracked.ts": 'import { tauri } from "@/platform/tauri"; tauri.X();',
        "src/deleted.ts": undefined,
      }),
      [],
    );
  });

  test("skips all five project test shapes", () => {
    const files = Object.fromEntries(
      ["src/a.test.ts", "src/b.test.tsx", "src/c.spec.ts", "src/d.spec.tsx", "src/tests/e.ts"].map(
        (path) => [path, 'import { tauri } from "@/platform/tauri"; tauri.X();'],
      ),
    );
    expectSet(check(files), [c1("X")]);
  });

  // One full scan of the real tree; measured at about 1 s here and past Vitest's 5 s default
  // on the CI runner. The oracle was `dead === allowlisted` while f-20260906-11 was open, so
  // that it held whichever of the two landed first, and it therefore also held on the tree
  // where all three commands were still registered. That finding has landed: every exported
  // command now has a production consumer, so the allowlist is the empty list and the tree
  // state itself is the assertion. Both expectations were staged, each printing a payload only
  // it can produce: the first (violation strings) against this tree with a one-entry allowlist
  // naming the no-longer-exported `getFileMetadata`, which yields the C3 and C4.3 pair; the
  // second (allowlist objects) against the reverted tree `26833df3`, where the scan is green
  // because the allowlist still covers all three commands and the file parses to three
  // entries — the case the old oracle accepted. An allowlist regrowth is caught by the second
  // expectation even when its entry is
  // valid enough for C2-C4 to stay silent, which is why no third `allowlist: []` scan is
  // asserted here — with the file empty it is the first expectation, and with the file
  // non-empty the second has already gone red.
  test("is green on the real tree with nothing suppressed by the allowlist", () => {
    expect(runIpcCommandConsumerCheck()).toEqual([]);
    expect(
      JSON.parse(readFileSync(join(process.cwd(), "ipc-command-consumer-allowlist.json"), "utf8")),
    ).toEqual([]);
  }, 60_000);

  test("stays green after the exported commands are removed", () => {
    expect(check({}, { names: [], allowlist: [] })).toEqual([]);
  });

  test("fails closed for parse, read, enumeration, allowlist, and ledger inputs", () => {
    expectExactError(
      () => check({ "src/bad.ts": "const = ;" }),
      "Cannot parse src/bad.ts: Unexpected token (1:6)\n\n> 1 | const = ;\n    |       ^",
    );
    expectExactError(
      () =>
        runIpcCommandConsumerCheck({
          workspaceRoot: ROOT,
          listFiles: () => ["src/consumer.ts"],
          readFile: () => {
            throw new Error("EISDIR");
          },
          allowlist: [],
        }),
      "Cannot read src/bindings/generated.ts: EISDIR",
    );
    expectExactError(
      () =>
        runIpcCommandConsumerCheck({
          workspaceRoot: ROOT,
          listFiles: () => [],
          readFile: (path) => (path.endsWith("generated.ts") ? generated() : "{}"),
          allowlist: {},
        }),
      "Invalid ipc-command-consumer-allowlist.json: expected an array",
    );
    expectExactError(
      () =>
        check(
          {},
          {
            allowlist: [{ command: "X", finding: "f-20260906-11" }],
            ledger: [{ id: "f-20260906-11", status: "open", body: null }],
          },
        ),
      "Invalid findings projection: entry 0 must contain string id, status and body",
    );
    expectExactError(
      () => check({}, { allowlist: [null] }),
      "Invalid ipc-command-consumer-allowlist.json: entry 0 must contain string command and finding",
    );
    expectExactError(
      () =>
        runIpcCommandConsumerCheck({
          workspaceRoot: ROOT,
          listFiles: () => [],
          readFile: (path) => {
            if (path.endsWith("generated.ts")) return generated();
            throw Object.assign(new Error("ENOENT"), { code: "ENOENT" });
          },
          allowlist: [],
        }),
      "Cannot read tasks/findings.md: ENOENT",
    );
  });
});

describe("CLI failure matrix", () => {
  test("clean input exits zero and prints nothing", () => {
    const root = cliWorkspace({
      source: 'import { tauri } from "@/platform/tauri"; tauri.X();',
    });
    try {
      assertCli(root, "", { status: 0 });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test.each([
    ["C1", () => ({ root: cliWorkspace(), expected: c1("X") })],
    [
      "C2",
      () => ({
        root: cliWorkspace({
          source: 'import { tauri } from "@/platform/tauri"; tauri.X();',
          allowlist: JSON.stringify([{ command: "X", finding: "f-20260906-11" }]),
          findingsOutput: JSON.stringify([VALID_FINDING]),
        }),
        expected: "C2: allowlist entry X has a production consumer; remove the allowlist entry",
      }),
    ],
    [
      "C3",
      () => ({
        root: cliWorkspace({
          bindings: generated([]),
          allowlist: JSON.stringify([{ command: "gone", finding: "f-20260906-11" }]),
          findingsOutput: JSON.stringify([{ id: "f-20260906-11", status: "open", body: "gone" }]),
        }),
        expected: "C3: allowlist entry gone names a command that is not exported",
      }),
    ],
    [
      "C4.1",
      () => ({
        root: cliWorkspace({
          allowlist: JSON.stringify([{ command: "X", finding: "not-a-finding" }]),
        }),
        expected: "C4.1: allowlist entry X has invalid finding id not-a-finding",
      }),
    ],
    [
      "C4.2",
      () => ({
        root: cliWorkspace({
          allowlist: JSON.stringify([{ command: "X", finding: "f-20990101-99" }]),
        }),
        expected:
          "C4.2: finding f-20990101-99 for allowlisted command X does not exist as an unfenced ledger entry",
      }),
    ],
    [
      "C4.3",
      () => ({
        root: cliWorkspace({
          bindings: generated(["coverage"]),
          allowlist: JSON.stringify([{ command: "coverage", finding: "f-20260829-01" }]),
          findingsOutput: JSON.stringify([
            { id: "f-20260829-01", status: "handled", body: "coverage" },
          ]),
        }),
        expected:
          "C4.3: finding f-20260829-01 for allowlisted command coverage is not open (status: handled)",
      }),
    ],
    [
      "C4.4",
      () => ({
        root: cliWorkspace({
          bindings: generated(["getMagicThing"]),
          allowlist: JSON.stringify([{ command: "getMagicThing", finding: "f-20260829-02" }]),
          findingsOutput: JSON.stringify([
            { id: "f-20260829-02", status: "open", body: "getMagicThings" },
          ]),
        }),
        expected:
          "C4.4: finding f-20260829-02 for allowlisted command getMagicThing does not name getMagicThing or get_magic_thing",
      }),
    ],
    [
      "C5",
      () => ({
        root: cliWorkspace({
          source: 'import { tauri } from "@/platform/tauri"; tauri[key]();',
          allowlist: JSON.stringify([{ command: "X", finding: "f-20260906-11" }]),
          findingsOutput: JSON.stringify([VALID_FINDING]),
        }),
        expected: c5("src/consumer.ts", 1, "tauri[key]"),
      }),
    ],
    [
      "missing export",
      () => ({
        root: cliWorkspace({ bindings: "const commands = {};" }),
        expected: "src/bindings/generated.ts: exported commands declaration is missing",
      }),
    ],
    [
      "non-object initializer",
      () => ({
        root: cliWorkspace({ bindings: "export const commands = factory();" }),
        expected:
          "src/bindings/generated.ts: exported commands initializer is not an ObjectExpression",
      }),
    ],
    [
      "non-method member",
      () => ({
        root: cliWorkspace({ bindings: "export const commands = { X: async () => {} };" }),
        expected:
          "src/bindings/generated.ts: commands object member 0 is not an ObjectMethod with a plain Identifier key",
      }),
    ],
    [
      "allowlist malformed JSON",
      () => {
        const malformed = "{,";
        return {
          root: cliWorkspace({ allowlist: malformed }),
          expected: `Cannot parse ipc-command-consumer-allowlist.json: ${jsonParseError(malformed)}`,
        };
      },
    ],
    [
      "allowlist wrong root shape",
      () => ({
        root: cliWorkspace({ allowlist: "{}" }),
        expected: "Invalid ipc-command-consumer-allowlist.json: expected an array",
      }),
    ],
    [
      "allowlist invalid entry shape",
      () => ({
        root: cliWorkspace({ allowlist: '[{"command":"X"}]' }),
        expected:
          "Invalid ipc-command-consumer-allowlist.json: entry 0 must contain string command and finding",
      }),
    ],
    [
      "source parse failure",
      () => ({
        root: cliWorkspace({ source: "const = ;" }),
        expected:
          "Cannot parse src/consumer.ts: Unexpected token (1:6)\n\n> 1 | const = ;\n    |       ^",
      }),
    ],
    [
      "missing generated binding",
      () => {
        const root = cliWorkspace();
        rmSync(join(root, "src", "bindings", "generated.ts"));
        return {
          root,
          expected: `Cannot read src/bindings/generated.ts: ENOENT: no such file or directory, open '${join(root, "src", "bindings", "generated.ts")}'`,
        };
      },
    ],
    [
      "generated binding read failure",
      () => {
        const root = cliWorkspace();
        const path = join(root, "src", "bindings", "generated.ts");
        chmodSync(path, 0);
        return {
          root,
          expected: `Cannot read src/bindings/generated.ts: ${nodeReadError(path)}`,
          restore: () => chmodSync(path, 0o644),
        };
      },
    ],
    [
      "missing allowlist",
      () => {
        const root = cliWorkspace({ allowlist: null });
        return {
          root,
          expected: `Cannot read ipc-command-consumer-allowlist.json: ENOENT: no such file or directory, open '${join(root, "ipc-command-consumer-allowlist.json")}'`,
        };
      },
    ],
    [
      "allowlist read failure",
      () => {
        const root = cliWorkspace();
        const path = join(root, "ipc-command-consumer-allowlist.json");
        chmodSync(path, 0);
        return {
          root,
          expected: `Cannot read ipc-command-consumer-allowlist.json: ${nodeReadError(path)}`,
          restore: () => chmodSync(path, 0o644),
        };
      },
    ],
    [
      "missing ledger with empty allowlist",
      () => {
        const root = cliWorkspace();
        const path = join(root, "tasks", "findings.md");
        rmSync(path);
        return {
          root,
          expected: `Cannot read tasks/findings.md: ENOENT: no such file or directory, open '${path}'`,
        };
      },
    ],
    [
      "ledger read failure",
      () => {
        const root = cliWorkspace();
        const path = join(root, "tasks", "findings.md");
        chmodSync(path, 0);
        return {
          root,
          expected: `Cannot read tasks/findings.md: ${nodeReadError(path)}`,
          restore: () => chmodSync(path, 0o644),
        };
      },
    ],
    [
      "renderer source read failure",
      () => {
        const root = cliWorkspace({ source: "const value = 1;" });
        const path = join(root, "src", "consumer.ts");
        chmodSync(path, 0);
        return {
          root,
          expected: `Cannot read src/consumer.ts: ${nodeReadError(path)}`,
          restore: () => chmodSync(path, 0o644),
        };
      },
    ],
    [
      "ledger projection invalid JSON",
      () => {
        const output = "not-json\n";
        const root = cliWorkspace({ findingsOutput: output });
        return {
          root,
          expected: `Cannot parse findings projection for ${join(root, "scripts/findings.py")} list --json --body --strict: ${jsonParseError(output)}`,
        };
      },
    ],
    [
      "ledger projection non-array",
      () => {
        const root = cliWorkspace({ findingsOutput: "{}" });
        return {
          root,
          expected: `Invalid ${join(root, "scripts/findings.py")} list --json --body --strict: expected an array`,
        };
      },
    ],
    [
      "ledger projection invalid entry shape",
      () => {
        const root = cliWorkspace({ findingsOutput: '[{"id":"f-1","status":"open","body":null}]' });
        return {
          root,
          expected: `Invalid ${join(root, "scripts/findings.py")} list --json --body --strict: entry 0 must contain string id, status and body`,
        };
      },
    ],
    [
      "ledger projection non-zero",
      () => {
        const root = cliWorkspace({
          findingsStatus: 1,
          findingsStderr: "REFUSING: malformed ledger",
        });
        return {
          root,
          expected: `Cannot read findings projection for ${join(root, "scripts/findings.py")} list --json --body --strict: REFUSING: malformed ledger`,
        };
      },
    ],
    [
      "ledger projection spawn failure",
      () => {
        const root = cliWorkspace({ findingsScript: false });
        return {
          root,
          expected: `Cannot read findings projection for ${join(root, "scripts/findings.py")} list --json --body --strict: spawnSync ${join(root, "scripts/findings.py")} ENOENT`,
        };
      },
    ],
    [
      "working-tree enumeration non-zero",
      () => ({
        root: cliWorkspace({ git: false }),
        expected:
          "Cannot enumerate working-tree files: git ls-files --others --exclude-standard -- src failed (fatal: not a git repository (or any of the parent directories): .git)",
      }),
    ],
    [
      "working-tree enumeration spawn failure",
      () => ({
        root: cliWorkspace(),
        env: { PATH: "" },
        expected:
          "Cannot enumerate working-tree files: git ls-files --others --exclude-standard -- src failed (spawnSync git ENOENT)",
      }),
    ],
  ])("stages the %s failure through the CLI", (_name, build) => {
    const fixture = build();
    try {
      assertCli(fixture.root, fixture.expected, { env: fixture.env });
    } finally {
      fixture.restore?.();
      rmSync(fixture.root, { recursive: true, force: true });
    }
  });
});

describe("resolver interception seam", () => {
  test("resolveChain controls a member classification", () => {
    seam.resolveChain = () => facadeResult();
    seam.followsAlias = null;
    expect(check({ "src/consumer.ts": "const unrelated = 1; unrelated.X();" })).toEqual([]);
  });

  test("the classifier follows mocked followsAlias while the walk keeps its private predicate", () => {
    seam.resolveChain = null;
    seam.followsAlias = () => true;
    expectSet(
      check({
        "src/consumer.ts":
          'import { tauri } from "@/platform/tauri"; let facade = tauri; facade = editor; facade.X();',
      }),
      [c1("X")],
    );
  });

  test("resolveChain controls dynamic module identity", () => {
    seam.resolveChain = () => ({ node: { type: "StringLiteral", value: "@/platform/tauri" } });
    seam.followsAlias = null;
    expect(
      check(
        {
          "src/consumer.ts":
            "const spec = unrelated; const mod = await import(spec); mod.tauri.X();",
        },
        { allowlist: [{ command: "X", finding: "f-20260906-11" }] },
      ),
    ).toEqual([c5("src/consumer.ts", 1, "import(spec)")]);
  });
});
