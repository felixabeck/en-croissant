import { mkdtemp, mkdir, readFile, rm, unlink, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import {
  checkDeadCodeSurface,
  checkFaultInjectionSurface,
  checkRustReleaseSurface,
  DEAD_CODE_ALLOWLIST,
  listTrackedRustSources,
} from "./check-rust-release-surface.mjs";

const ALLOWED_FILE = "src-tauri/src/infra/path_authority.rs";
const CHECKER = join(process.cwd(), "scripts/check-rust-release-surface.mjs");

function sources(...entries) {
  return new Map(entries);
}

function allowedSource() {
  return "#![allow(dead_code)]\n";
}

describe("Rust release-surface gate", () => {
  test("R1 rejects a new file-level dead-code suppression", () => {
    const violations = checkDeadCodeSurface(
      sources(
        [ALLOWED_FILE, allowedSource()],
        ["src-tauri/src/infra/new_authority.rs", allowedSource()],
      ),
    );

    expect(violations).toContain(
      "R1: src-tauri/src/infra/new_authority.rs carries file-level #![allow(dead_code)] but is not allowlisted",
    );
  });

  test("R1 rejects an added allowlist entry", () => {
    const added = "src-tauri/src/infra/new_authority.rs";
    const violations = checkDeadCodeSurface(
      sources([ALLOWED_FILE, allowedSource()], [added, allowedSource()]),
      new Set([...DEAD_CODE_ALLOWLIST, added]),
    );

    expect(violations).toContain(
      `R1: allowlist entry ${added} is not part of the shrink-only baseline`,
    );
  });

  test("R1 rejects an allowlist entry whose file no longer carries the attribute", () => {
    const violations = checkDeadCodeSurface(sources([ALLOWED_FILE, "pub struct PathAuthority;"]));

    expect(violations).toContain(
      `R1: allowlist entry ${ALLOWED_FILE} no longer carries #![allow(dead_code)]`,
    );
  });

  test("R2 rejects an ungated public fault-injection item", () => {
    const violations = checkFaultInjectionSurface(
      "src-tauri/src/infra/fs.rs",
      "pub(crate) struct FaultPoint;\n",
    );

    expect(violations).toContain(
      "src-tauri/src/infra/fs.rs:1: R2: public fault-injection item FaultPoint must be inside #[cfg(test)]",
    );
  });

  test("R2 accepts fault-injection items inside an item cfg region and crate cfg region", () => {
    expect(
      checkFaultInjectionSurface(
        "src-tauri/src/infra/fs.rs",
        `#[cfg(test)]
mod tests {
    pub(crate) struct FaultPoint;
    pub(crate) fn remove_with_injector() {}
}
`,
      ),
    ).toEqual([]);
    expect(
      checkFaultInjectionSurface(
        "src-tauri/src/infra/fs.rs",
        "#[cfg(all(test, unix))] pub(crate) struct FaultPoint;\n",
      ),
    ).toEqual([]);
    expect(
      checkFaultInjectionSurface(
        "src-tauri/src/infra/fs.rs",
        `#![cfg(test)]
pub(crate) trait AtomicWriterInjector {}
`,
      ),
    ).toEqual([]);
  });

  test("R2 rejects an ungated use importing a fault-injection name", () => {
    const violations = checkFaultInjectionSurface(
      "src-tauri/src/infra/file_workspace.rs",
      "use crate::infra::AtomicWriterInjector;\n",
    );

    expect(violations).toContain(
      "src-tauri/src/infra/file_workspace.rs:1: R2: use importing a fault-injection name must be inside #[cfg(test)]",
    );
  });

  test("the complete fixture surface accepts test-only fault seams and the sole suppression", () => {
    expect(
      checkRustReleaseSurface(
        sources(
          [ALLOWED_FILE, allowedSource()],
          [
            "src-tauri/src/infra/fs.rs",
            `#[cfg(test)]
pub(crate) enum AtomicFileFaultPoint { Write }
#[cfg(test)]
pub(crate) trait AtomicWriterInjector {}
`,
          ],
        ),
      ),
    ).toEqual([]);
  });

  test("the checker exits non-zero when a tracked Rust input cannot be read", async () => {
    const fixtureRoot = await mkdtemp(join(tmpdir(), "rust-release-surface-"));
    try {
      await mkdir(join(fixtureRoot, "src-tauri/src"), { recursive: true });
      const missing = join(fixtureRoot, "src-tauri/src/missing.rs");
      await writeFile(missing, "pub struct Gone;\n");
      expect(spawnSync("git", ["init", "--quiet"], { cwd: fixtureRoot }).status).toBe(0);
      expect(
        spawnSync("git", ["add", "src-tauri/src/missing.rs"], { cwd: fixtureRoot }).status,
      ).toBe(0);
      await unlink(missing);

      const result = spawnSync(process.execPath, [CHECKER], {
        cwd: fixtureRoot,
        encoding: "utf8",
      });
      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain("Cannot read tracked Rust source src-tauri/src/missing.rs");
    } finally {
      await rm(fixtureRoot, { recursive: true, force: true });
    }
  });

  test("the checker rejects a failing git ls-files command", () => {
    expect(() =>
      listTrackedRustSources("/fixture", () => ({
        error: new Error("git unavailable"),
        status: null,
        stderr: "",
      })),
    ).toThrow("Cannot enumerate tracked Rust sources: git ls-files failed (git unavailable)");
  });

  test("the release script is wired into package.json", async () => {
    const packageJson = JSON.parse(await readFileForWiring("package.json"));
    expect(packageJson.scripts["rust:surface:check"]).toBe(
      "node scripts/check-rust-release-surface.mjs",
    );
  });

  test("the release script is invoked by the test workflow", async () => {
    const workflow = await readFileForWiring(".github/workflows/test.yml");
    expect(workflow).toMatch(/run:\s*pnpm rust:surface:check/);
  });

  test("the Rust/Tauri push gate list names the release script", async () => {
    const skill = await readFileForWiring(".claude/skills/push/SKILL.md");
    const rustSection = skill.slice(
      skill.indexOf("### Rust/Tauri backend"),
      skill.indexOf("### TypeScript/React frontend"),
    );
    expect(rustSection).toContain("pnpm rust:surface:check");
  });
});

async function readFileForWiring(path) {
  return readFile(join(process.cwd(), path), "utf8");
}
