import type { TFunction } from "i18next";
import i18n from "@/i18n";
import { isOperationAndCleanup, normalizeError } from "@/platform/errors";

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
