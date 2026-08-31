import { mkdtemp, mkdir, readFile, rm, unlink, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import {
  checkDeadCodeSurface,
  checkFaultInjectionSurface,
  checkFilesystemSurface,
  checkRustReleaseSurface,
  DEAD_CODE_ALLOWLIST,
  FS_SURFACE_ALLOWLIST,
  INITIAL_FS_SURFACE_COUNTS,
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
    ).toThrow("Cannot enumerate working-tree files");
  });

  test("the checker rejects a failure of the second git ls-files command", () => {
    let calls = 0;
    expect(() =>
      listTrackedRustSources("/fixture", () => {
        calls += 1;
        if (calls === 1) return { status: 0, stdout: "", stderr: "" };
        return { error: new Error("index unavailable"), status: null, stderr: "" };
      }),
    ).toThrow("Cannot enumerate working-tree files");
    expect(calls).toBe(2);
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

describe("Rust filesystem-surface gate", () => {
  const chess = "src-tauri/src/chess.rs";

  function fsHits(source, allowlist = new Set(), counts = {}) {
    return checkFilesystemSurface(sources([chess, source]), allowlist, counts);
  }

  test("R3 rejects std::fs::write in a non-allowlisted production file", () => {
    const violations = fsHits('fn f() { std::fs::write("x", b""); }\n');
    expect(violations.some((line) => line.includes("R3:") && line.includes(chess))).toBe(true);
  });

  test("R3 accepts the same call inside a cfg(test) region", () => {
    expect(
      fsHits(`#[cfg(test)]
mod tests {
    fn f() { std::fs::write("x", b""); }
}
`),
    ).toEqual([]);
  });

  test("multiline cfg(test) does not leak into the next production item", () => {
    const violations = fsHits(`#[cfg(test)]
    pub async fn replace(
        &self,
        key: u8,
    ) -> u8 {
        1
    }

    pub fn replace_handle() {
        std::fs::write("x", b"");
    }
`);
    expect(violations.some((line) => line.includes("R3:") && line.includes(chess))).toBe(true);
  });

  test("statement-level cfg(test) does not leak into the next production statement", () => {
    const violations = fsHits(`fn f() {
    #[cfg(test)]
    let _ = 1;
    std::fs::write("x", b"");
}
`);
    expect(violations.some((line) => line.includes("R3:"))).toBe(true);
  });

  test("R3 accepts a File type import without allowlisting the file", () => {
    expect(fsHits("use std::fs::File;\nfn f(file: File) {}\n")).toEqual([]);
  });

  test("R3 rejects tokio::fs::File::open in production", () => {
    expect(
      fsHits('async fn f() { let _ = tokio::fs::File::open("x").await; }\n').some((line) =>
        line.includes("R3:"),
      ),
    ).toBe(true);
  });

  test("R3 rejects fs::create_dir_all after use std::fs", () => {
    expect(
      fsHits('use std::fs;\nfn f() { fs::create_dir_all("."); }\n').some((line) =>
        line.includes("R3:"),
      ),
    ).toBe(true);
  });

  test("R3 rejects a std::fs module alias and does not flag AccountRecord::metadata", () => {
    expect(
      fsHits('use std::fs::{self as disk};\nfn f() { disk::write("x", b""); }\n').some((line) =>
        line.includes("R3:"),
      ),
    ).toBe(true);
    expect(
      fsHits('use std::fs as disk;\nfn f() { disk::write("x", b""); }\n').some((line) =>
        line.includes("R3:"),
      ),
    ).toBe(true);
    expect(
      fsHits(
        "struct AccountRecord;\nimpl AccountRecord { fn metadata(&self) {}\nfn f(r: AccountRecord) { r.metadata(); } }\n",
      ),
    ).toEqual([]);
  });

  test("R3 rejects std::fs::File::open and imported File::open", () => {
    expect(
      fsHits('fn f() { std::fs::File::open("x"); }\n').some((line) => line.includes("R3:")),
    ).toBe(true);
    expect(
      fsHits('use std::fs::File;\nfn f() { File::open("x"); }\n').some((line) =>
        line.includes("R3:"),
      ),
    ).toBe(true);
  });

  test("R3 does not treat clippy allow as an exemption", () => {
    expect(
      fsHits('#[allow(clippy::disallowed_methods)]\nfn f() { std::fs::write("x", b""); }\n').some(
        (line) => line.includes("R3:"),
      ),
    ).toBe(true);
  });

  test("R4 rejects pathname atomic_replace and not atomic_replace_at", () => {
    expect(
      fsHits("fn f() { atomic_replace(&path, |_| Ok(())); }\n").some((line) =>
        line.includes("R4:"),
      ),
    ).toBe(true);
    expect(fsHits("fn f() { atomic_replace_at(parent, leaf, |_| Ok(())); }\n")).toEqual([]);
  });

  test("R4 rejects atomic_replace_with_precommit and atomic_install_dir", () => {
    expect(
      fsHits("fn f() { atomic_replace_with_precommit(&p, || Ok(()), |_| Ok(())); }\n").some(
        (line) => line.includes("R4:"),
      ),
    ).toBe(true);
    expect(
      fsHits("fn f() { atomic_install_dir(&a, &b); }\n").some((line) => line.includes("R4:")),
    ).toBe(true);
  });

  test("R4 rejects pathname imports, globs, FQN, turbofish and module aliases", () => {
    expect(
      fsHits("use crate::infra::fs::atomic_replace as publish;\n").some((line) =>
        line.includes("R4:"),
      ),
    ).toBe(true);
    expect(fsHits("use crate::infra::fs::*;\n").some((line) => line.includes("R4:"))).toBe(true);
    expect(
      fsHits("fn f() { crate::infra::fs::atomic_replace(&p, |_| Ok(())); }\n").some((line) =>
        line.includes("R4:"),
      ),
    ).toBe(true);
    expect(
      fsHits("fn f() { crate::infra::fs::atomic_replace::<_>(&p, |_| Ok(())); }\n").some((line) =>
        line.includes("R4:"),
      ),
    ).toBe(true);
    expect(
      fsHits(
        "use crate::infra::fs as disk;\nfn f() { disk::atomic_replace::<_>(&p, |_| Ok(())); }\n",
      ).some((line) => line.includes("R4:")),
    ).toBe(true);
  });

  test("R4-only fixtures fail the composer even without std::fs", () => {
    const source = "use crate::infra::fs::atomic_replace;\n";
    const composed = checkRustReleaseSurface(sources([chess, source]));
    expect(composed.some((line) => line.includes("R4:"))).toBe(true);
  });

  test("growing the filesystem allowlist fails", () => {
    const added = "src-tauri/src/chess.rs";
    const violations = checkFilesystemSurface(
      sources([added, 'fn f() { std::fs::write("x", b""); }\n']),
      new Set([...FS_SURFACE_ALLOWLIST, added]),
      { ...INITIAL_FS_SURFACE_COUNTS, [added]: 1 },
    );
    expect(violations).toContain(
      `R3: allowlist entry ${added} is not part of the shrink-only baseline`,
    );
  });

  test("an allowlisted file's production match count is pinned", () => {
    const path = "src-tauri/src/credentials.rs";
    const violations = checkFilesystemSurface(
      sources([
        path,
        `fn f() {
    std::fs::write("x", b"");
    std::fs::read("y");
}
`,
      ]),
      new Set([path]),
      { [path]: 1 },
    );
    expect(
      violations.some((line) =>
        line.includes("has 2 production filesystem reaches, allowlisted for 1"),
      ),
    ).toBe(true);
  });

  test("an untracked leak.rs with std::fs::write fails the CLI with an R3 diagnostic", async () => {
    const fixtureRoot = await mkdtemp(join(tmpdir(), "rust-fs-surface-"));
    try {
      await mkdir(join(fixtureRoot, "src-tauri/src/infra"), { recursive: true });
      await writeFile(
        join(fixtureRoot, "src-tauri/src/infra/path_authority.rs"),
        "#![allow(dead_code)]\n",
      );
      expect(spawnSync("git", ["init", "--quiet"], { cwd: fixtureRoot }).status).toBe(0);
      expect(
        spawnSync("git", ["add", "src-tauri/src/infra/path_authority.rs"], { cwd: fixtureRoot })
          .status,
      ).toBe(0);
      await writeFile(
        join(fixtureRoot, "src-tauri/src/leak.rs"),
        'fn f() { std::fs::write("x", b""); }\n',
      );

      const result = spawnSync(process.execPath, [CHECKER], {
        cwd: fixtureRoot,
        encoding: "utf8",
      });
      expect(result.status).not.toBe(0);
      const output = `${result.stdout}${result.stderr}`;
      expect(output).toContain("src-tauri/src/leak.rs");
      expect(output).toContain("R3:");
    } finally {
      await rm(fixtureRoot, { recursive: true, force: true });
    }
  });
});

async function readFileForWiring(path) {
  return readFile(join(process.cwd(), path), "utf8");
}
