import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { checkUntranslatedJsx, findLiterals, listSourceFiles } from "./check-untranslated-jsx.mjs";
import { gitInit, gitTrack } from "./test-git-init.mjs";

// Vitest serves this module from a non-file URL, so `import.meta.dirname` is
// the only stable way to name the checker for a subprocess run.
const checkerPath = join(import.meta.dirname, "check-untranslated-jsx.mjs");

function assertCli(result, status, stderr) {
  expect(result.error).toBeUndefined();
  expect(result.status).toBe(status);
  expect(result.stderr.trim()).toMatch(stderr);
}

function workspace() {
  const root = mkdtempSync(join(tmpdir(), "untranslated-jsx-"));
  mkdirSync(join(root, "src", "components"), { recursive: true });
  writeFileSync(join(root, "src", "components", "Tracked.tsx"), "<Text>Tracked copy</Text>;\n");
  writeFileSync(join(root, "src", "components", "Tracked.test.tsx"), "<Text>Test copy</Text>;\n");
  writeFileSync(join(root, "src", "components", "Untracked.tsx"), '<Text>{t("a")}</Text>;\n');
  gitInit(root);
  gitTrack(root, "src/components/Tracked.tsx", "src/components/Tracked.test.tsx");
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
  test("scans tracked, untracked and symlinked components and skips test files", async () => {
    const root = workspace();
    writeFileSync(join(root, "Linked.tsx"), "<Text>Linked copy</Text>;\n");
    symlinkSync(join(root, "Linked.tsx"), join(root, "src", "components", "Linked.tsx"));

    expect(listSourceFiles(root)).toEqual([
      "src/components/Linked.tsx",
      "src/components/Tracked.tsx",
      "src/components/Untracked.tsx",
    ]);
    expect(await checkUntranslatedJsx(root)).toEqual([
      'src/components/Linked.tsx: "Linked copy"',
      'src/components/Tracked.tsx: "Tracked copy"',
    ]);
  });

  test("the CLI reports violations as exit 1 and an enumeration failure as exit 2", () => {
    const clean = workspace();
    writeFileSync(join(clean, "src", "components", "Tracked.tsx"), '<Text>{t("a")}</Text>;\n');
    const green = spawnSync(process.execPath, [checkerPath], { cwd: clean, encoding: "utf8" });
    assertCli(green, 0, /^$/u);

    const root = workspace();
    writeFileSync(join(root, "src", "components", "Loud.tsx"), "<Text>Loud copy</Text>;\n");
    const red = spawnSync(process.execPath, [checkerPath], { cwd: root, encoding: "utf8" });
    assertCli(red, 1, /Loud\.tsx: "Loud copy"/u);

    const outside = mkdtempSync(join(tmpdir(), "untranslated-jsx-nogit-"));
    mkdirSync(join(outside, "src"), { recursive: true });
    const broken = spawnSync(process.execPath, [checkerPath], { cwd: outside, encoding: "utf8" });
    assertCli(broken, 2, /Cannot enumerate working-tree files/u);
  });
});
