import { notifyUnlessCancelled } from "@/components/files/notifyError";
import i18n from "@/i18n";

export function reportPersistError(error: unknown): void {
    notifyUnlessCancelled(i18n.t("Common.Error"), error);
}
