import { ask, check, message, relaunch } from "./native";
import i18n from "@/i18n";
import { normalizeError, type AppError } from "./errors";

export type UpdateOutcome = "cancelled" | "failed" | "installed" | "not-available" | "declined";

export type UpdateCheckOptions = {
    /** Manual checks tell the user that their installed version is current. */
    interactive?: boolean;
    signal?: AbortSignal;
    onError?: (error: AppError) => void;
};

function cancelled(signal: AbortSignal | undefined): boolean {
    return signal?.aborted ?? false;
}

/**
 * The sole renderer owner for updater lifecycle. Every result is awaited and
 * cancellation is intentionally silent: an unmounted owner must never prompt,
 * relaunch, or surface an error after it has gone away.
 */
export async function checkForUpdates({
    interactive = false,
    signal,
    onError,
}: UpdateCheckOptions = {}): Promise<UpdateOutcome> {
    if (cancelled(signal)) return "cancelled";

    try {
        const update = await check();
        if (cancelled(signal)) return "cancelled";

        if (!update) {
            if (interactive && !cancelled(signal)) await message(i18n.t("Update.NoUpdate"));
            return cancelled(signal) ? "cancelled" : "not-available";
        }

        const approved = await ask(i18n.t("Update.InstallPrompt"), {
            title: i18n.t("Update.InstallTitle"),
        });
        if (cancelled(signal)) return "cancelled";
        if (!approved) return "declined";

        await update.downloadAndInstall();
        if (cancelled(signal)) return "cancelled";
        await relaunch();
        return "installed";
    } catch (error) {
        if (cancelled(signal)) return "cancelled";
        onError?.(normalizeError(error));
        return "failed";
    }
}
