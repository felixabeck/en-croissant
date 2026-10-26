import type { TFunction } from "i18next";
import i18n from "@/i18n";
import {
    isOperationAndCleanup,
    normalizeError,
    runAppliedMutationWithRefresh,
} from "@/platform/errors";

/** Leaves unrelated failures on the caller's existing presentation. */
export function workspaceErrorMessage(
    error: unknown,
    fallback: string,
    t: TFunction = i18n.t,
): string {
    if (isOperationAndCleanup(error)) {
        return t("Files.OperationAndCleanupFailed", {
            defaultValue:
                "The file operation failed, and cleanup also failed. Files or folders may remain. Check the collection before trying again.",
        });
    }
    if (normalizeError(error).nameTaken === true) return t("Common.NameAlreadyUsed");
    return fallback;
}

/** Only the Files create, rename, metadata and move forms opt into this guidance. */
export function filesMutationErrorMessage(error: unknown, fallback: string, t: TFunction): string {
    const failure = normalizeError(error);
    if (isOperationAndCleanup(error) || failure.nameTaken === true)
        return workspaceErrorMessage(error, fallback, t);
    if (failure.category === "cancelled") return "";
    if (failure.backendCategory === "resource-limit")
        return t("Files.Refusal.Limit", {
            defaultValue:
                "The operation reached a limit. Check the file details or try again after other operations finish.",
        });
    if (failure.backendCategory === "conflict")
        return t("Files.Refusal.Changed", {
            defaultValue:
                "The operation could not use the current collection state. Review the current files and choose the item or destination again.",
        });
    if (failure.category === "not-found")
        return t("Files.Refusal.Unavailable", {
            defaultValue:
                "The file or folder is unavailable. Review the current files and choose an available item or destination.",
        });
    if (failure.category === "permission")
        return t("Files.Refusal.Permission", {
            defaultValue: "Check write permission for the file or folder before trying again.",
        });
    if (failure.category === "validation")
        return t("Files.Refusal.Invalid", {
            defaultValue: "Check the name or file details before submitting again.",
        });
    return fallback;
}

/** Preserve the original refusal, including when the captured listing cannot be reconciled. */
export async function runFilesMutationWithRefresh<T>(
    run: () => Promise<T>,
    refresh: (cleanupFailure?: unknown) => unknown | Promise<unknown>,
    reconcile: () => unknown | Promise<unknown>,
): Promise<{ kind: "committed"; value: T | undefined } | { kind: "durability-uncertain" }> {
    let durabilityUncertain = false;
    const value = await runAppliedMutationWithRefresh(async () => {
        try {
            return await run();
        } catch (cause) {
            const failure = normalizeError(cause);
            durabilityUncertain = failure.backendCategory === "durability";
            if (
                failure.nameTaken !== true &&
                (failure.backendCategory === "conflict" || failure.category === "not-found")
            ) {
                try {
                    await reconcile();
                } catch {
                    // The listing owns its own failure surface.
                }
            }
            throw cause;
        }
    }, refresh);
    return durabilityUncertain ? { kind: "durability-uncertain" } : { kind: "committed", value };
}
