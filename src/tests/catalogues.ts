import { createInstance } from "i18next";
import { expect } from "vitest";
import { supportedLocales, type SupportedLocale } from "@/i18n";

const modules = import.meta.glob<{ translation: Record<string, string> }>("../translation/*.json", {
    eager: true,
    import: "default",
});

export function shippedCatalogues() {
    const catalogues = Object.entries(modules).map(([path, { translation }]) => ({
        locale: path.slice(path.lastIndexOf("/") + 1, -".json".length),
        translation,
    }));
    expect(catalogues.map(({ locale }) => locale).sort()).toEqual([...supportedLocales].sort());
    return catalogues;
}

/** Isolated real translations: a missing locale value must not borrow English. */
export async function catalogueI18n(locale: SupportedLocale) {
    const catalogue = shippedCatalogues().find((entry) => entry.locale === locale)!;
    const instance = createInstance();
    await instance.init({
        lng: locale,
        fallbackLng: false,
        keySeparator: false,
        resources: { [locale]: { translation: catalogue.translation } },
        interpolation: { escapeValue: false },
    });
    return instance;
}
