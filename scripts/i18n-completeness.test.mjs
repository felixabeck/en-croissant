import { describe, expect, test } from "vitest";
import { checkCatalogues, supportedLocales } from "./i18n-completeness.mjs";

function completeCatalogues() {
  return Object.fromEntries(
    supportedLocales.map((locale) => [
      locale,
      { translation: { "Common.Cancel": locale === "en-US" ? "Cancel" : "Abbrechen" } },
    ]),
  );
}

describe("i18n completeness gate", () => {
  test("accepts an exact, populated release contract", () => {
    expect(checkCatalogues(completeCatalogues())).toEqual([]);
  });

  test("fails when a shipped locale loses one extracted key", () => {
    const catalogues = completeCatalogues();
    delete catalogues["de-DE"].translation["Common.Cancel"];

    expect(checkCatalogues(catalogues)).toContain("de-DE:Common.Cancel: missing translation");
  });

  test("fails when a locale loses interpolation or rich-text contracts", () => {
    const catalogues = Object.fromEntries(
      supportedLocales.map((locale) => [
        locale,
        {
          translation: {
            "Common.Count_one": "{{count}} <1>item</1>",
            "Common.Count_other": "{{count}} <1>items</1>",
          },
        },
      ]),
    );
    catalogues["de-DE"].translation["Common.Count_one"] = "Eintrag";

    expect(checkCatalogues(catalogues)).toContain(
      "de-DE:Common.Count_one: placeholder/tag contract differs from en-US:Common.Count_one",
    );
  });

  test("uses the en-US plural stem contract for locale-specific plural categories", () => {
    const catalogues = Object.fromEntries(
      supportedLocales.map((locale) => [
        locale,
        {
          translation: {
            "Common.Count_one": "{{count}} item",
            "Common.Count_other": "{{count}} items",
            ...(locale === "pl-PL" ? { "Common.Count_few": "kilka" } : {}),
          },
        },
      ]),
    );

    expect(checkCatalogues(catalogues)).toContain(
      "pl-PL:Common.Count_few: placeholder/tag contract differs from en-US:Common.Count_other",
    );
  });
});
