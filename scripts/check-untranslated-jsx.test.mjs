import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { findLiterals, findViolations, sourceFiles } from "./check-untranslated-jsx.mjs";

function workspace() {
  const root = mkdtempSync(join(tmpdir(), "untranslated-jsx-"));
  mkdirSync(join(root, "src", "components"), { recursive: true });
  writeFileSync(join(root, "src", "components", "Tracked.tsx"), "<Text>Tracked copy</Text>;\n");
  writeFileSync(join(root, "src", "components", "Tracked.test.tsx"), "<Text>Test copy</Text>;\n");
  const init = spawnSync("git", ["init", "--quiet", "."], { cwd: root, encoding: "utf8" });
  expect(init.status).toBe(0);
  return root;
}

describe("untranslated UI literal gate", () => {
  test("rejects data, ternary, native-dialog, notification, and dynamic aria literals", () => {
    const source = `
      <Select data={[{ value: "white", label: "White" }]} aria-label={enabled ? "Disable" : "Enable"} />;
      ask("Clear saved data", { title: "Clear data" });
      notifications.show({ title: "Logs", message: \`Opened logs in \${path}\` });
    `;
    expect(findLiterals(source)).toEqual(
      expect.arrayContaining([
        "White",
        "Disable",
        "Enable",
        "Clear saved data",
        "Clear data",
        "Logs",
      ]),
    );
  });

  test("permits translated calls and documented technical notation", () => {
    expect(findLiterals(`<Button aria-label={t("Common.Open")}>PGN</Button>`)).toEqual([]);
  });

  test("rejects proper names outside their dedicated metadata registry", () => {
    expect(findLiterals(`<Text>California</Text>`, "src/components/home/Welcome.tsx")).toEqual([
      "California",
    ]);
  });

  test("rejects additional accessible strings and confirmation props", () => {
    const source = `<Slider aria-valuetext="Engine strength" aria-description="Current strength" confirmLabel="Apply" cancelLabel="Dismiss" />`;
    expect(findLiterals(source)).toEqual(
      expect.arrayContaining(["Engine strength", "Current strength", "Apply", "Dismiss"]),
    );
  });

  test("does not mistake nested configuration for the label copy it styles", () => {
    expect(findLiterals(`const menu = { label: { fontWeight: "normal" } };`)).toEqual([]);
  });

  test("does not treat a UI ternary's state discriminator as copy", () => {
    expect(
      findLiterals(
        `<Modal title={action === "rename" ? t("Files.Rename") : t("Files.CreateFolder")} />`,
      ),
    ).toEqual([]);
  });
});

describe("untranslated UI literal file discovery", () => {
  test("scans untracked and symlinked components and skips test files", async () => {
    const root = workspace();
    writeFileSync(join(root, "Linked.tsx"), "<Text>Linked copy</Text>;\n");
    symlinkSync(join(root, "Linked.tsx"), join(root, "src", "components", "Linked.tsx"));

    expect(sourceFiles(root)).toEqual(["src/components/Linked.tsx", "src/components/Tracked.tsx"]);
    expect(await findViolations(root)).toEqual([
      'src/components/Linked.tsx: "Linked copy"',
      'src/components/Tracked.tsx: "Tracked copy"',
    ]);
  });

  test("fails loudly outside a git repository rather than reporting a clean tree", () => {
    const root = mkdtempSync(join(tmpdir(), "untranslated-jsx-nogit-"));
    mkdirSync(join(root, "src"), { recursive: true });
    writeFileSync(join(root, "src", "Loose.tsx"), "<Text>Loose copy</Text>;\n");
    expect(() => sourceFiles(root)).toThrow(/Cannot enumerate working-tree files/u);
  });
});
