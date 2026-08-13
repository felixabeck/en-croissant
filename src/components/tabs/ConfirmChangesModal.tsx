import { Button, Group, Stack, Text } from "@mantine/core";
import { useAtom } from "jotai";
import { type SetStateAction, useContext, useState } from "react";
import { useTranslation } from "react-i18next";
import { currentTabAtom } from "@/state/atoms";
import type { TreeStore } from "@/state/store/tree";
import { saveToFile, type Tab } from "@/utils/tabs";
import { TreeStateContext } from "../common/TreeStateContext";
import AppModal from "../common/AppModal";

function ConfirmChangesModal({
  pendingClose,
  tab,
  updateTab,
  onCancel,
  onDiscard,
  onSaved,
  opened,
  toggle,
  closeTab,
}: {
  pendingClose?: { tabId: string; store: TreeStore } | null;
  tab?: Tab;
  updateTab?: (tabId: string, update: SetStateAction<Tab>) => void;
  onCancel?: () => void;
  onDiscard?: () => void;
  onSaved?: () => void;
  /** Compatibility for save-before-navigation flows; tab close uses pendingClose. */
  opened?: boolean;
  toggle?: () => void;
  closeTab?: () => void;
}) {
  const { t } = useTranslation();
  const [currentTab, setCurrentTab] = useAtom(currentTabAtom);
  const contextStore = useContext(TreeStateContext);
  const [saveFailed, setSaveFailed] = useState(false);
  const targetTab = tab ?? currentTab;
  const targetStore = pendingClose?.store ?? contextStore;
  const modalOpen = pendingClose !== undefined ? pendingClose !== null : (opened ?? false);

  const cancel = () => {
    if (pendingClose !== undefined) onCancel?.();
    else toggle?.();
  };

  const discard = () => {
    if (pendingClose !== undefined) onDiscard?.();
    else {
      closeTab?.();
      toggle?.();
    }
  };

  async function save() {
    if (!targetTab || !targetStore) return;
    setSaveFailed(false);
    const result = await saveToFile({
      setCurrentTab: (update) => {
        if (pendingClose && updateTab) {
          updateTab(pendingClose.tabId, update);
        } else {
          setCurrentTab(update);
        }
      },
      tab: targetTab,
      store: targetStore,
      isUserSave: true,
    });
    if (result === "saved") {
      if (pendingClose !== undefined) onSaved?.();
      else {
        closeTab?.();
        toggle?.();
      }
    }
    if (result === "failed") setSaveFailed(true);
  }

  return (
    <AppModal withCloseButton={false} opened={modalOpen} onClose={cancel}>
      <Stack>
        <div>
          <Text fz="lg" fw="bold" mb={10}>
            {t("Tab.UnsavedChanges")}
          </Text>
          <Text>{t("Tab.UnsavedChangesConfirm")}</Text>
          {saveFailed && <Text c="red">{t("Tab.SaveFailed")}</Text>}
        </div>

        <Group justify="right">
          <Button variant="default" onClick={discard}>
            {t("Tab.CloseWithoutSaving")}
          </Button>
          <Button onClick={() => void save()}>{t("Tab.SaveAndClose")}</Button>
        </Group>
      </Stack>
    </AppModal>
  );
}

export default ConfirmChangesModal;
