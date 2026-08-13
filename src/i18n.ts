import i18n from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { initReactI18next } from "react-i18next";
import enUSCatalogue from "./translation/en-US.json";

export const supportedLocales = [
    "be-BY",
    "de-DE",
    "en-GB",
    "en-US",
    "es-ES",
    "fr-FR",
    "it-IT",
    "ko-KR",
    "nb-NO",
    "pl-PL",
    "pt-PT",
    "ru-RU",
    "tr-TR",
    "uk-UA",
    "zh-CN",
    "zh-TW",
] as const;

export type SupportedLocale = (typeof supportedLocales)[number];

export const fallbackLocale: SupportedLocale = "en-US";

const localeLoaders: Record<SupportedLocale, () => Promise<{ default: unknown }>> = {
    "be-BY": () => import("./translation/be-BY.json"),
    "de-DE": () => import("./translation/de-DE.json"),
    "en-GB": () => import("./translation/en-GB.json"),
    "en-US": () => import("./translation/en-US.json"),
    "es-ES": () => import("./translation/es-ES.json"),
    "fr-FR": () => import("./translation/fr-FR.json"),
    "it-IT": () => import("./translation/it-IT.json"),
    "ko-KR": () => import("./translation/ko-KR.json"),
    "nb-NO": () => import("./translation/nb-NO.json"),
    "pl-PL": () => import("./translation/pl-PL.json"),
    "pt-PT": () => import("./translation/pt-PT.json"),
    "ru-RU": () => import("./translation/ru-RU.json"),
    "tr-TR": () => import("./translation/tr-TR.json"),
    "uk-UA": () => import("./translation/uk-UA.json"),
    "zh-CN": () => import("./translation/zh-CN.json"),
    "zh-TW": () => import("./translation/zh-TW.json"),
};
const loadedLocales = new Set<SupportedLocale>();

/** Resolve browser and persisted language aliases to a catalogue shipped by this release. */
export function resolveSupportedLocale(language?: string | null): SupportedLocale {
    if (!language) return fallbackLocale;

    const normalized = language.replace("_", "-");
    if ((supportedLocales as readonly string[]).includes(normalized))
        return normalized as SupportedLocale;

    const languageCode = normalized.split("-")[0];
    return (
        supportedLocales.find((locale) => locale.split("-")[0] === languageCode) ?? fallbackLocale
    );
}

async function loadLocale(locale: SupportedLocale): Promise<void> {
    if (loadedLocales.has(locale)) return;

    const module = await localeLoaders[locale]();
    const catalogue = module.default as { translation?: unknown };
    i18n.addResourceBundle(locale, "translation", catalogue.translation ?? catalogue, true, true);
    loadedLocales.add(locale);
}

function detectedLocale(): SupportedLocale {
    if (typeof window === "undefined") return fallbackLocale;

    return resolveSupportedLocale(window.localStorage.getItem("i18nextLng") ?? navigator.language);
}

/**
 * Loads exactly the requested release catalogue and the deterministic en-US fallback.
 * The modules remain individual Vite chunks, so languages that were not selected are not
 * downloaded by the renderer.
 */
export async function changeLocale(language?: string | null): Promise<SupportedLocale> {
    const locale = resolveSupportedLocale(language);
    await Promise.all([loadLocale(fallbackLocale), loadLocale(locale)]);
    await i18n.changeLanguage(locale);
    return locale;
}

export async function initializeI18n(): Promise<void> {
    loadedLocales.add(fallbackLocale);
    await i18n
        .use(LanguageDetector)
        .use(initReactI18next)
        .init({
            resources: { [fallbackLocale]: { translation: enUSCatalogue.translation } },
            fallbackLng: fallbackLocale,
            ns: ["translation"],
            defaultNS: "translation",
            supportedLngs: supportedLocales,
            load: "currentOnly",
            detection: {
                order: ["localStorage", "navigator"],
                caches: ["localStorage"],
            },
            returnEmptyString: false,
            interpolation: { escapeValue: false },
        });

    await changeLocale(detectedLocale());
}

export default i18n;
