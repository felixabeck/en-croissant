import { expect, test } from "vitest";
import type { SupportedLocale } from "@/i18n";
import type { AppErrorCategory } from "@/platform/errors";
import { catalogueI18n, shippedCatalogues } from "@/tests/catalogues";
import { confirmationErrorMessage } from "./ConfirmModal";

// Lookup data, never literal t calls: tests must not seed the extractor for production.
const messageKeys = {
    cancelled: "Common.ConfirmationError.unexpected",
    network: "Common.ConfirmationError.unexpected",
    "not-found": "Common.ConfirmationError.unexpected",
    "applied-despite-error": "Common.ConfirmationError.applied-despite-error",
    permission: "Common.ConfirmationError.unexpected",
    validation: "Common.ConfirmationError.unexpected",
    unexpected: "Common.ConfirmationError.unexpected",
} satisfies Record<AppErrorCategory, string>;

test("all confirmation outcomes use their own shipped translations without fallback", async () => {
    const catalogues = shippedCatalogues();
    const english = catalogues.find(({ locale }) => locale === "en-US")!.translation;
    for (const { locale, translation } of catalogues) {
        const instance = await catalogueI18n(locale as SupportedLocale);
        for (const [category, key] of Object.entries(messageKeys)) {
            const expected = translation[key];
            expect(expected).toBeTypeOf("string");
            expect(expected.trim()).not.toBe("");
            const message = confirmationErrorMessage(
                { category, message: "private native diagnostic at /private/file.pgn" },
                instance.t.bind(instance),
            );
            expect(message).toBe(expected);
            expect(message).not.toContain("private");
        }
        expect(translation[messageKeys["applied-despite-error"]]).not.toBe(
            translation[messageKeys.unexpected],
        );
    }
    for (const { translation } of catalogues.filter(({ locale }) => !locale.startsWith("en-"))) {
        for (const key of Object.values(messageKeys)) {
            expect(translation[key]).not.toBe(english[key]);
        }
    }
});

test("an unknown native failure uses the localized generic message", async () => {
    const instance = await catalogueI18n("de-DE");
    expect(
        confirmationErrorMessage(
            new Error("opaque diagnostic /private/file.pgn"),
            instance.t.bind(instance),
        ),
    ).toBe("Die Aktion konnte nicht abgeschlossen werden. Bitte versuche es erneut.");
});
