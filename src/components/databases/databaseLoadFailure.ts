import type { TFunction } from "i18next";
import { rootFailureMessage } from "@/components/files/listingFailure";

export function databaseLoadFailureMessage(error: unknown, t: TFunction): string {
    return (
        rootFailureMessage("database", error, t) ??
        t("Databases.LoadError", {
            defaultValue: "Could not load databases. Please try again.",
        })
    );
}
