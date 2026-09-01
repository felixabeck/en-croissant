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

export function notifyListenerError(error: unknown): void {
    notifyUnlessCancelled(i18n.t("Common.Error"), error);
}
