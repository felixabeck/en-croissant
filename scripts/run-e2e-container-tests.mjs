import assert from "node:assert/strict";
import test from "node:test";
import { playwrightArguments } from "./run-e2e-container.mjs";

// pnpm retains a caller's `--` (measured 2026-09-27, pnpm 10.34.5); these are the argv tails
// the two package scripts actually receive, not hypothetical inputs (`f-20260910-07`).
test("the separator pnpm retains is dropped so selection reaches Playwright as options", () => {
  assert.deepEqual(
    playwrightArguments(["--update-snapshots", "--", "--project=async-errors", "--grep=trash"]),
    ["--update-snapshots", "--project=async-errors", "--grep=trash"],
  );
  assert.deepEqual(playwrightArguments(["--", "--project=async-errors"]), [
    "--project=async-errors",
  ]);
});

test("a separator-free invocation is forwarded unchanged", () => {
  const forwarded = ["--update-snapshots", "--project=async-errors", "--grep=trash"];
  assert.deepEqual(playwrightArguments(forwarded), forwarded);
  assert.deepEqual(playwrightArguments([]), []);
});

test("only the first separator is pnpm's; a later one is the caller's own", () => {
  assert.deepEqual(playwrightArguments(["--", "--project=a", "--", "spec.ts"]), [
    "--project=a",
    "--",
    "spec.ts",
  ]);
});
