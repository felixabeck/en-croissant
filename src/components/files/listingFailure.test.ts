import { createInstance } from "i18next";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { I18nextProvider, useTranslation } from "react-i18next";
import { afterEach, describe, expect, test, vi } from "vitest";
import type { AppErrorCategory } from "@/platform/errors";
import * as errors from "@/platform/errors";
import { listingFailure } from "./listingFailure";

afterEach(() => vi.restoreAllMocks());

describe("listing failure presentation", () => {
    test.each(["changed", "missing", "unusable", "permission", "too-large"] as const)(
        "%s uses only the root label",
        (rootFailure) => {
            expect(
                listingFailure({
                    tag: "backend-error",
                    category: "io",
                    message: "unrelated",
                    rootFailure,
                }),
            ).toBe(rootFailure === "too-large" ? "tooLarge" : rootFailure);
        },
    );
    test.each(["conflict", "missing-resource", "permission", "resource-limit", "io"])(
        "%s without a label retries",
        (category) => {
            expect(
                listingFailure({
                    tag: "backend-error",
                    category,
                    message: "workspace root changed",
                }),
            ).toBe("retry");
        },
    );
    test.each([
        "cancelled",
        "network",
        "not-found",
        "applied-despite-error",
        "permission",
        "validation",
        "unexpected",
    ] satisfies AppErrorCategory[])(
        "renderer category %s without backendCategory retries",
        (category) => {
            expect(listingFailure({ category, message: "visible failure" })).toBe("retry");
            expect(
                listingFailure({ category, message: "visible failure", rootFailure: "changed" }),
            ).toBe("changed");
        },
    );
    test("plain errors retry and cancellation is silent", () => {
        expect(listingFailure(new Error("root changed"))).toBe("retry");
        for (const failure of ["", false, 0]) expect(listingFailure(failure)).toBe("retry");
        for (const error of [
            undefined,
            new Error("Cancellation"),
            new DOMException("Cancellation", "AbortError"),
            {
                tag: "backend-error",
                category: "cancellation",
                message: "Cancellation",
                rootFailure: "changed",
            },
        ]) {
            expect(listingFailure(error)).toBe("silent");
        }
    });
    test("the presentation never reads the normalized message", () => {
        vi.spyOn(errors, "errorUnlessCancelled").mockReturnValue({
            category: "unexpected",
            rootFailure: "permission",
            get message(): string {
                throw new Error("message was read by presentation");
            },
        });
        expect(listingFailure(new Error("input"))).toBe("permission");
    });
});

const keys = [
    "Files.LoadFailed.Changed",
    "Files.LoadFailed.Missing",
    "Files.LoadFailed.Unusable",
    "Files.LoadFailed.Permission",
    "Files.LoadFailed.TooLarge",
    "Databases.LoadError.Changed",
    "Databases.LoadError.RootMissing",
    "Databases.LoadError.Unusable",
    "Databases.LoadError.RootPermission",
    "Databases.LoadError.TooLarge",
    "Databases.ChooseFolder",
];
const catalogues = import.meta.glob<{ translation: Record<string, string> }>(
    "../../translation/*.json",
    { eager: true, import: "default" },
);
function Sentence({ translationKey }: { translationKey: string }) {
    const { t } = useTranslation();
    return createElement("span", null, t(translationKey));
}
test.each(Object.entries(catalogues))(
    "renders every new key from %s without fallback",
    async (path, catalogue) => {
        const values = catalogue.translation;
        const locale = path.split("/").pop()!.replace(".json", "");
        const i18n = createInstance();
        await i18n.init({
            lng: locale,
            fallbackLng: false,
            resources: { [locale]: catalogue },
            interpolation: { escapeValue: false },
        });
        for (const key of keys) {
            const markup = renderToStaticMarkup(
                createElement(
                    I18nextProvider,
                    { i18n },
                    createElement(Sentence, { translationKey: key }),
                ),
            );
            const node = document.createElement("div");
            node.innerHTML = markup;
            expect(node.textContent).toBe(values[key]);
            expect(values[key]).toBeTruthy();
        }
        expect(Object.keys(catalogues)).toHaveLength(16);
    },
);
test.each(Object.entries(catalogues).filter(([path]) => !path.includes("/en-")))(
    "%s translates each new key instead of copying English",
    (_path, catalogue) => {
        for (const key of keys)
            expect(catalogue.translation[key]).not.toBe(
                catalogues["../../translation/en-US.json"].translation[key],
            );
    },
);
