import { describe, expect, test } from "vitest";
import { findLiterals } from "./check-untranslated-jsx.mjs";

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
