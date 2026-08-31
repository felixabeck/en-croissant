import { notifications } from "@mantine/notifications";
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
