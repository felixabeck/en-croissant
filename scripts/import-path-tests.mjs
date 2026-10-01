import assert from "node:assert/strict";
import test from "node:test";
import { importSpecifierBasePath } from "./import-path.mjs";

test("import base mapping handles aliases and normalized relative paths", () => {
  assert.equal(
    importSpecifierBasePath("src/state/test.test.ts", "@/state/workspace"),
    "src/state/workspace",
  );
  assert.equal(
    importSpecifierBasePath("src/state/test.test.ts", "../utils/../workspace"),
    "src/workspace",
  );
});

test("source-root imports are opt-in and non-local specifiers are ignored", () => {
  assert.equal(importSpecifierBasePath("src/test.ts", "src/state/workspace"), undefined);
  assert.equal(
    importSpecifierBasePath("src/test.ts", "src/state/workspace", { allowSourceRoot: true }),
    "src/state/workspace",
  );
  assert.equal(importSpecifierBasePath("src/test.ts", "react"), undefined);
  assert.equal(importSpecifierBasePath("src/test.ts", undefined), undefined);
});

test("the IPC caller can preserve its broader dot-relative spelling", () => {
  assert.equal(
    importSpecifierBasePath("src/platform/test.ts", ".module", { allowAnyDotRelative: true }),
    "src/platform/.module",
  );
  assert.equal(importSpecifierBasePath("src/platform/test.ts", ".module"), undefined);
});
