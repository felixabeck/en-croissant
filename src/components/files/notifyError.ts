import { notifications } from "@mantine/notifications";
import i18n from "@/i18n";
import { errorUnlessCancelled } from "@/platform/errors";
import { rootFailureMessage, type RootFailureDomain } from "./listingFailure";

export function notifyUnlessCancelled(
    title: string,
    error: unknown,
    domain?: RootFailureDomain,
): void {
    const visible = errorUnlessCancelled(error);
    if (visible) {
        notifications.show({
            color: "red",
            title,
            message: (domain ? rootFailureMessage(domain, visible) : undefined) ?? visible.message,
        });
    }
}

export async function runUnlessCancelled<T>(
    title: string,
    run: () => Promise<T>,
    domain?: RootFailureDomain,
): Promise<T | undefined> {
    try {
        return await run();
    } catch (error) {
        notifyUnlessCancelled(title, error, domain);
        return undefined;
    }
}

export function notifyListenerError(error: unknown): void {
    notifyUnlessCancelled(i18n.t("Common.Error"), error);
}
