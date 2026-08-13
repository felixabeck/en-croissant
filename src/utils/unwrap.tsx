import { notifications } from "@mantine/notifications";
import { IconX } from "@tabler/icons-react";
import { error } from "@/platform/native";
import i18n from "@/i18n";

const t = i18n.t.bind(i18n);

type Result<T, E> = { status: "ok"; data: T } | { status: "error"; error: E };

export function unwrap<T>(result: Result<T, string> | T): T {
  if (typeof result !== "object" || result === null || !("status" in result)) return result;
  if (result.status !== "ok" && result.status !== "error") return result as T;
  if (result.status === "ok") return result.data;
  error(result.error);
  notifications.show({
    title: t("Common.Error"),
    message: result.error,
    color: "red",
    icon: <IconX />,
  });
  throw new Error(result.error);
}
