import { mkdirSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, describe, expect, test } from "vitest";
import { gitInit, gitTrack } from "./test-git-init.mjs";
import { testTempRoots } from "./test-temp-root.mjs";
import { listWorkingTreeFiles } from "./working-tree-files.mjs";

const temporaryRoot = testTempRoots(afterAll);

/**
 * The walker is the single enumeration primitive every gate checker now shares,
 * so its two queries are proven here once rather than re-derived in each
 * checker's suite (`f-20260901-16`).
 */
async function workspace() {
  const root = await temporaryRoot("working-tree-files-");
  mkdirSync(join(root, "src", "nested"), { recursive: true });
  writeFileSync(join(root, "src", "tracked.ts"), "export const tracked = 1;\n");
  writeFileSync(join(root, "src", "nested", "untracked.ts"), "export const untracked = 2;\n");
  writeFileSync(join(root, "src", "ignored.ts"), "export const ignored = 3;\n");
  writeFileSync(join(root, ".gitignore"), "src/ignored.ts\n");
  writeFileSync(join(root, "outside.ts"), "export const outside = 4;\n");
  gitInit(root);
  gitTrack(root, "src/tracked.ts");
  return root;
}

describe("working-tree file enumeration", () => {
  test("reports tracked and untracked files, and ignores what git ignores", async () => {
    const root = await workspace();
    expect(listWorkingTreeFiles({ workspaceRoot: root, pathspec: "src" })).toEqual([
      "src/nested/untracked.ts",
      "src/tracked.ts",
    ]);
  });

  test("includes git-ignored entries only when explicitly requested", async () => {
    const root = await workspace();
    expect(listWorkingTreeFiles({ workspaceRoot: root, pathspec: "src" })).not.toContain(
      "src/ignored.ts",
    );
    expect(
      listWorkingTreeFiles({ workspaceRoot: root, pathspec: "src", includeIgnored: true }),
    ).toContain("src/ignored.ts");
  });

  test("the default call keeps its two NUL-delimited git queries", () => {
    const calls = [];
    listWorkingTreeFiles({
      workspaceRoot: "/fixture",
      pathspec: "src",
      runGit: (_command, args) => {
        calls.push(args);
        const records = ["src/foo.ts", "src/shared.ts"];
        const stdout = args.includes("-z") ? `${records.join("\0")}\0` : `${records.join("\n")}\n`;
        return { status: 0, stdout, stderr: "" };
      },
    });
    expect(calls).toEqual([
      ["ls-files", "--others", "--exclude-standard", "-z", "--", "src"],
      ["ls-files", "-z", "--", "src"],
    ]);
  });

  test("reports a tracked file whose only sibling is ignored", async () => {
    const root = await workspace();
    // Deleting the untracked file leaves the tracked query as the sole source,
    // so an enumeration that dropped it would report an empty tree here.
    writeFileSync(join(root, ".gitignore"), "src/ignored.ts\nsrc/nested/\n");
    expect(listWorkingTreeFiles({ workspaceRoot: root, pathspec: "src" })).toEqual([
      "src/tracked.ts",
    ]);
  });

  test("reports a symlink, which a readdir walk skips as not a file", async () => {
    const root = await workspace();
    symlinkSync(join(root, "outside.ts"), join(root, "src", "linked.ts"));
    expect(listWorkingTreeFiles({ workspaceRoot: root, pathspec: "src" })).toContain(
      "src/linked.ts",
    );
  });

  test("confines the result to the pathspec", async () => {
    const root = await workspace();
    expect(listWorkingTreeFiles({ workspaceRoot: root, pathspec: "." })).toContain("outside.ts");
  });

  test("fails loudly outside a git repository rather than reporting an empty tree", async () => {
    const root = await temporaryRoot("working-tree-files-nogit-");
    mkdirSync(join(root, "src"), { recursive: true });
    writeFileSync(join(root, "src", "loose.ts"), "export const loose = 5;\n");
    expect(() => listWorkingTreeFiles({ workspaceRoot: root, pathspec: "src" })).toThrow(
      /Cannot enumerate working-tree files/u,
    );
  });

  test("names the failing query when git reports an error", async () => {
    const root = await workspace();
    expect(() =>
      listWorkingTreeFiles({
        workspaceRoot: root,
        pathspec: "src",
        runGit: () => ({ status: 128, stderr: "fatal: bad pathspec" }),
      }),
    ).toThrow(/git ls-files.*fatal: bad pathspec/u);
  });
});
