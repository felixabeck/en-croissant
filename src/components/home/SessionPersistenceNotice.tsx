import { Alert, Button, Stack, Text } from "@mantine/core";
import { useSyncExternalStore } from "react";
import { useTranslation } from "react-i18next";
import enUS from "@/translation/en-US.json";
import {
  getSessionPersistenceSnapshot,
  retrySessionPersistence,
  subscribeSessionPersistence,
} from "@/utils/session";

export function SessionPersistenceNotice() {
  const { t } = useTranslation(undefined, { useSuspense: false });
  const { status } = useSyncExternalStore(
    subscribeSessionPersistence,
    getSessionPersistenceSnapshot,
  );
  if (status === "saved") return null;

  return (
    <Alert
      color="orange"
      title={
        t("Accounts.Persistence.Title", {
          defaultValue: enUS.translation["Accounts.Persistence.Title"],
        }) || enUS.translation["Accounts.Persistence.Title"]
      }
      role="alert"
      pos="fixed"
      bottom="xs"
      right="xs"
      w="36rem"
      style={{
        zIndex: 200,
        maxWidth: "calc(100vw - 2rem)",
        maxHeight: "calc(100dvh - 2rem)",
        overflowY: "auto",
        overflowWrap: "anywhere",
      }}
    >
      <Stack align="flex-start" gap="sm">
        <Text>
          {t("Accounts.Persistence.Unsaved", {
            defaultValue: enUS.translation["Accounts.Persistence.Unsaved"],
          }) || enUS.translation["Accounts.Persistence.Unsaved"]}
        </Text>
        <Button className="wrap-button" maw="100%" onClick={() => retrySessionPersistence()}>
          {t("Accounts.Persistence.TryAgain", {
            defaultValue: enUS.translation["Accounts.Persistence.TryAgain"],
          }) || enUS.translation["Accounts.Persistence.TryAgain"]}
        </Button>
      </Stack>
    </Alert>
  );
}
