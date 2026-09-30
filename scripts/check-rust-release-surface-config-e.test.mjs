import { describe, expect, test } from "vitest";
import {
  CHECKOUT_FILES,
  expectCliStatus,
  runCheckerOver,
} from "./rust-release-surface-fixture.mjs";

describe("R5 config, test-only scope, and physical source surface", () => {
  const packageManifest = new Map(CHECKOUT_FILES).get("src-tauri/Cargo.toml");
  test("O3.10 accepts the real package manifest", async () => {
    const result = await runCheckerOver([]);
    expectCliStatus(result, 0);
  });
  const buildKeys = [
    ["bare build key", 'build = "other.rs"'],
    ["double-quoted build key", '"build" = "other.rs"'],
    ["single-quoted build key", "'build' = \"other.rs\""],
  ];
  test.each(buildKeys)("O3.13 rejects a package manifest with %s", async (_name, key) => {
    const contents = packageManifest.replace(
      "[build-dependencies]",
      `${key}\n\n[build-dependencies]`,
    );
    const result = await runCheckerOver([{ path: "src-tauri/Cargo.toml", contents }]);
    expectCliStatus(result, 1);
    expect(result.output).toContain(
      "src-tauri/Cargo.toml: R5: src-tauri/Cargo.toml may not select a different build script",
    );
  });
  test("O3.13 pins build.rs by SHA-256", async () => {
    const result = await runCheckerOver([
      {
        path: "src-tauri/build.rs",
        contents: `${new Map(CHECKOUT_FILES).get("src-tauri/build.rs")}\n`,
      },
    ]);
    expectCliStatus(result, 1);
    expect(result.output).toContain(
      "src-tauri/build.rs: R5: build script differs from its pinned SHA-256",
    );
  });
  test("O3.13 accepts build-dependencies, a root build key, and the real build script", async () => {
    const result = await runCheckerOver([{ path: "Cargo.toml", contents: 'build = "other.rs"\n' }]);
    expectCliStatus(result, 0);
    expect(new Map(CHECKOUT_FILES).get("src-tauri/build.rs")).toContain("tauri_build::build()");
  });
});
