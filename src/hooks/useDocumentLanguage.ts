import { useEffect } from "react";
import i18n from "@/i18n";

/**
 * Keeps `<html lang>` in step with the active locale.
 *
 * Screen readers pick pronunciation from this attribute, so it has to follow a
 * language switch and not only the initial render. It lives here rather than in
 * `App.tsx` because it is a self-contained effect with an observable result,
 * which is exactly what can be tested; `App.tsx` is composition.
 */
export function useDocumentLanguage() {
    useEffect(() => {
        const updateLanguage = (language: string) => {
            document.documentElement.lang = language;
        };
        updateLanguage(i18n.resolvedLanguage || i18n.language || "en-US");
        i18n.on("languageChanged", updateLanguage);
        return () => i18n.off("languageChanged", updateLanguage);
    }, []);
}
