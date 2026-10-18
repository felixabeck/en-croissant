import { expect, test } from "vitest";
import i18n, { type SupportedLocale } from "@/i18n";
import { normalizeError } from "@/platform/errors";
import { catalogueI18n, shippedCatalogues } from "@/tests/catalogues";
import { TauriCommandError } from "@/platform/tauri";
import { workspaceErrorMessage } from "./workspaceError";

const cleanup = new TauriCommandError({
    tag: "backend-error",
    category: "operation-and-cleanup",
    message: "unrelated diagnostic",
});

test("name-taken copy uses the typed flag and the English catalogue", async () => {
    const translator = await catalogueI18n("en-US");
    const error = new TauriCommandError({
        tag: "backend-error",
        category: "conflict",
        message: "unrelated diagnostic",
        nameTaken: true,
    });
    expect(normalizeError(error).nameTaken).toBe(true);
    expect(workspaceErrorMessage(error, "fallback", translator.t)).toBe("Name already used");
    expect(workspaceErrorMessage(error, "fallback")).toBe(i18n.t("Common.NameAlreadyUsed"));
});

test.each([{}, { nameTaken: undefined }, { nameTaken: false }, { nameTaken: null }])(
    "nameTaken %j is omitted and preserves the fallback",
    async (detail) => {
        const translator = await catalogueI18n("en-US");
        const error = new TauriCommandError({
            tag: "backend-error",
            category: "conflict",
            message: "unrelated diagnostic",
            ...detail,
        });
        expect(normalizeError(error)).not.toHaveProperty("nameTaken");
        expect(workspaceErrorMessage(error, "fallback", translator.t)).toBe("fallback");
    },
);

test.each([
    "Conflict: workspace file already exists",
    "Conflict: source PGN changed",
    "Conflict: workspace destination changed",
])("conflict message %s without the flag preserves the fallback", async (message) => {
    const translator = await catalogueI18n("en-US");
    const error = new TauriCommandError({ tag: "backend-error", category: "conflict", message });
    expect(workspaceErrorMessage(error, "fallback", translator.t)).toBe("fallback");
});

test("cleanup copy takes priority over the name-taken flag", async () => {
    const translator = await catalogueI18n("en-US");
    const error = new TauriCommandError({
        tag: "backend-error",
        category: "operation-and-cleanup",
        message: "unrelated diagnostic",
        nameTaken: true,
    });
    expect(workspaceErrorMessage(error, "fallback", translator.t)).toBe(
        translator.t("Files.OperationAndCleanupFailed"),
    );
});

test.each(shippedCatalogues())(
    "$locale renders cleanup copy without fallback",
    async ({ locale, translation }) => {
        const i18n = await catalogueI18n(locale as SupportedLocale);
        const value = translation["Files.OperationAndCleanupFailed"];
        expect(value).toBeTruthy();
        expect(value).toMatch(
            /cleanup|Bereinigung|nettoyage|limpieza|pulizia|limpeza|oppryddingen|sprzątanie|очистка|очищення|ачыстка|temizleme|정리|清理/,
        );
        expect(workspaceErrorMessage(cleanup, "fallback", i18n.t)).toBe(value);
    },
);

test.each(shippedCatalogues().filter(({ locale }) => !locale.startsWith("en-")))(
    "$locale translates cleanup copy",
    async ({ translation }) => {
        expect(translation["Files.OperationAndCleanupFailed"]).not.toBe(
            (await catalogueI18n("en-US")).t("Files.OperationAndCleanupFailed"),
        );
    },
);

test("classification uses the typed category and preserves unrelated fallbacks", async () => {
    const i18n = await catalogueI18n("en-US");
    expect(workspaceErrorMessage(cleanup, "fallback", i18n.t)).toBe(
        "The file operation failed, and cleanup also failed. Files or folders may remain. Check the collection before trying again.",
    );
    for (const error of [
        new Error("operation-and-cleanup"),
        new Error("cleanup failed"),
        { tag: "backend-error", category: "io", message: cleanup.message },
    ]) {
        expect(workspaceErrorMessage(error, "fallback", i18n.t)).toBe("fallback");
    }
});
