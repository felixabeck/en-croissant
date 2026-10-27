import { Text } from "@mantine/core";
import { useTranslation } from "react-i18next";
import enUS from "@/translation/en-US.json";
import { StartupFailureLayout } from "./StartupStorageFailure";

export function WorkspaceReadFailure() {
  const { t } = useTranslation(undefined, { useSuspense: false });
  return (
    <StartupFailureLayout>
      <Text>
        {t("Startup.WorkspaceReadFailure.Explanation", {}) ||
          enUS.translation["Startup.WorkspaceReadFailure.Explanation"]}
      </Text>
    </StartupFailureLayout>
  );
}
