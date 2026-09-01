import { notifications } from "@mantine/notifications";
import i18n from "@/i18n";
import { errorUnlessCancelled } from "@/platform/errors";

export function notifyUnlessCancelled(title: string, error: unknown): void {
    const visible = errorUnlessCancelled(error);
    if (visible) {
        notifications.show({
            color: "red",
            title,
            message: visible.message,
        });
    }
}

export async function runUnlessCancelled<T>(
    title: string,
    run: () => Promise<T>,
): Promise<T | undefined> {
    try {
        return await run();
    } catch (error) {
        notifyUnlessCancelled(title, error);
        return undefined;
    }
}

export function notifyListenerError(error: unknown): void {
    notifyUnlessCancelled(i18n.t("Common.Error"), error);
}
