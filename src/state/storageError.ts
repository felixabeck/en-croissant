import i18n from "@/i18n";
import { normalizeError } from "@/platform/errors";

function hasQuotaExceededName(cause: unknown): boolean {
    return (
        typeof cause === "object" &&
        cause !== null &&
        "name" in cause &&
        String((cause as { name: unknown }).name) === "QuotaExceededError"
    );
}

function withMessage(cause: unknown): unknown {
    if (typeof cause !== "object" || cause === null || !("message" in cause)) {
        return cause;
    }
    return new Error(String((cause as { message: unknown }).message), { cause });
}

/** Returns a safe display cause while leaving the original failure for diagnostics. */
export function storageErrorCause(cause: unknown): string {
    if (hasQuotaExceededName(cause)) {
        return i18n.t("Common.StorageQuotaExceeded");
    }

    const normalizedCause = normalizeError(withMessage(cause)).message;
    return normalizedCause && normalizedCause !== "{}"
        ? normalizedCause
        : i18n.t("Common.StorageRejected");
}
