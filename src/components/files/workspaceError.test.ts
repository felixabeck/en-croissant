import { expect, test, vi } from "vitest";
import i18n, { type SupportedLocale } from "@/i18n";
import { normalizeError } from "@/platform/errors";
import { catalogueI18n, shippedCatalogues } from "@/tests/catalogues";
import { TauriCommandError } from "@/platform/tauri";
import {
    filesMutationErrorMessage,
    runFilesMutationWithRefresh,
    workspaceErrorMessage,
} from "./workspaceError";
import type { ErrorCategory } from "@/bindings";

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

test.each([
    {},
    { nameTaken: undefined },
    { nameTaken: false },
    { nameTaken: null },
    { nameTaken: 1 as unknown as boolean },
    { nameTaken: "true" as unknown as boolean },
])("nameTaken %j is omitted and preserves the fallback", async (detail) => {
    const translator = await catalogueI18n("en-US");
    const error = new TauriCommandError({
        tag: "backend-error",
        category: "conflict",
        message: "unrelated diagnostic",
        ...detail,
    });
    expect(normalizeError(error)).not.toHaveProperty("nameTaken");
    expect(workspaceErrorMessage(error, "fallback", translator.t)).toBe("fallback");
});

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

const refusals = [
    ["invalid-input", "Files.Refusal.Invalid"],
    ["parsing", "Files.Refusal.Invalid"],
    ["resource-limit", "Files.Refusal.Limit"],
    ["permission", "Files.Refusal.Permission"],
    ["conflict", "Files.Refusal.Changed"],
    ["missing-resource", "Files.Refusal.Unavailable"],
] as const;

test.each(shippedCatalogues())(
    "$locale has translated Files refusal guidance without fallback",
    async ({ locale, translation }) => {
        const translator = await catalogueI18n(locale as SupportedLocale);
        const english = await catalogueI18n("en-US");
        for (const [category, key] of refusals) {
            const cause = new TauriCommandError({
                tag: "backend-error",
                category,
                message: "private diagnostic",
            });
            const value = translation[key];
            expect(value).toBeTruthy();
            expect(filesMutationErrorMessage(cause, "fallback", translator.t)).toBe(value);
            expect(workspaceErrorMessage(cause, "fallback", translator.t)).toBe("fallback");
            expect(value).not.toContain("private diagnostic");
            expect(value === english.t(key)).toBe(locale.startsWith("en-"));
        }
    },
);

test.each(["metadata exceeds size bound", "native operation capacity reached"])(
    "resource-limit guidance covers %s without diagnosing the producer",
    async (message) => {
        const translator = await catalogueI18n("en-US");
        expect(
            filesMutationErrorMessage(
                { tag: "backend-error", category: "resource-limit", message },
                "fallback",
                translator.t,
            ),
        ).toBe(
            "The operation reached a limit. Check the file details or try again after other operations finish.",
        );
    },
);

test.each(["io", "network", "cancellation", "operation-and-cleanup", "conflict"] as const)(
    "Files guidance preserves special %s behavior",
    async (category) => {
        const translator = await catalogueI18n("en-US");
        const cause = {
            tag: "backend-error",
            category,
            message: "private diagnostic",
            ...(category === "conflict" ? { nameTaken: true } : {}),
        };
        expect(filesMutationErrorMessage(cause, "fallback", translator.t)).toBe(
            category === "cancellation"
                ? ""
                : category === "operation-and-cleanup"
                  ? translator.t("Files.OperationAndCleanupFailed")
                  : category === "conflict"
                    ? "Name already used"
                    : "fallback",
        );
    },
);

test.each([false, true])(
    "Files refusal reconciliation preserves original identity, secondary failure=%s",
    async (fails) => {
        for (const category of ["conflict", "missing-resource"] as const) {
            const cause = new TauriCommandError({
                tag: "backend-error",
                category,
                message: "private diagnostic",
            });
            const run = vi.fn().mockRejectedValue(cause);
            const refresh = vi.fn();
            const reconcile = vi.fn(async () => {
                if (fails) throw new Error("secondary list error");
            });
            await expect(runFilesMutationWithRefresh(run, refresh, reconcile)).rejects.toBe(cause);
            expect(run).toHaveBeenCalledOnce();
            expect(reconcile).toHaveBeenCalledOnce();
            expect(refresh).not.toHaveBeenCalled();
        }
    },
);

test.each([
    "invalid-input",
    "resource-limit",
    "permission",
    "io",
    "network",
    "cancellation",
    "conflict",
] as const)("Files %s refusal does not relist or retry", async (category: ErrorCategory) => {
    const cause = {
        tag: "backend-error",
        category,
        message: "private diagnostic",
        ...(category === "conflict" ? { nameTaken: true } : {}),
    };
    const run = vi.fn().mockRejectedValue(cause);
    const refresh = vi.fn();
    const reconcile = vi.fn();
    await expect(runFilesMutationWithRefresh(run, refresh, reconcile)).rejects.toBe(cause);
    expect(run).toHaveBeenCalledOnce();
    expect(refresh).not.toHaveBeenCalled();
    expect(reconcile).not.toHaveBeenCalled();
});

test("Files durable commit preserves the command value after refresh", async () => {
    const value = { id: "created file" };
    const refresh = vi.fn();
    const reconcile = vi.fn();
    await expect(
        runFilesMutationWithRefresh(async () => value, refresh, reconcile),
    ).resolves.toEqual({ kind: "committed", value });
    expect(refresh).toHaveBeenCalledOnce();
    expect(reconcile).not.toHaveBeenCalled();
});

test.each([false, true])(
    "Files durability outcome awaits refresh and retains the original cause on failure=%s",
    async (fails) => {
        const cause = new TauriCommandError({
            tag: "backend-error",
            category: "durability",
            message: "private diagnostic",
        });
        let finish!: () => void;
        const refresh = vi.fn(
            () =>
                new Promise<void>((resolve, reject) => {
                    finish = () => (fails ? reject(new Error("list failed")) : resolve());
                }),
        );
        const reconcile = vi.fn();
        let settled = false;
        let settledResult:
            | { status: "fulfilled"; value: unknown }
            | { status: "rejected"; reason: unknown }
            | undefined;
        const outcome = runFilesMutationWithRefresh(
            async () => {
                throw cause;
            },
            refresh,
            reconcile,
        );
        void outcome.then(
            (value) => {
                settled = true;
                settledResult = { status: "fulfilled", value };
            },
            (reason) => {
                settled = true;
                settledResult = { status: "rejected", reason };
            },
        );
        await vi.waitFor(() => expect(refresh).toHaveBeenCalledOnce());
        expect(settled).toBe(false);
        finish();
        await vi.waitFor(() => expect(settled).toBe(true));
        expect(settledResult).toEqual(
            fails
                ? { status: "rejected", reason: cause }
                : { status: "fulfilled", value: { kind: "durability-uncertain" } },
        );
        expect(reconcile).not.toHaveBeenCalled();
    },
);

test.each([
    { category: "applied-despite-error", message: "private diagnostic" },
    { tag: "backend-error", category: "partial-removal", message: "private diagnostic" },
    new Error("Committed but durability uncertain: fallback diagnostic"),
])("a swallowed applied error without typed durability remains a commit", async (cause) => {
    const refresh = vi.fn();
    await expect(
        runFilesMutationWithRefresh(
            async () => {
                throw cause;
            },
            refresh,
            vi.fn(),
        ),
    ).resolves.toEqual({ kind: "committed", value: undefined });
    expect(refresh).toHaveBeenCalledOnce();
});
