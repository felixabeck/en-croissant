import { tauri } from "@/platform/tauri";
import { notifyUnlessCancelled } from "@/components/files/notifyError";
import { Code, Divider, Group, Text, Tooltip } from "@mantine/core";
import { IconReload } from "@tabler/icons-react";
import { useAtom } from "jotai";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { currentTabAtom } from "@/state/atoms";
import { IconAction } from "@/components/common/IconAction";
import { formatNumber } from "@/utils/format";
import { getTabFile } from "@/utils/tabs";
import { fileWorkspaceKey } from "@/utils/pathCapabilities";

function FileInfo({
  setGames,
}: {
  setGames: React.Dispatch<React.SetStateAction<Map<number, string>>>;
}) {
  const { t } = useTranslation();
  const [tab, setCurrentTab] = useAtom(currentTabAtom);
  const tabFile = getTabFile(tab);
  const tabId = tab?.value;
  const fileKey = tabFile ? fileWorkspaceKey(tabFile.handle) : null;
  const identity = `${tabId}:${fileKey}`;
  const identityRef = useRef(identity);
  identityRef.current = identity;

  const tabAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      tabAbortRef.current?.abort();
      tabAbortRef.current = null;
    };
  }, [tabId, fileKey]);

  if (!tab || !tabFile) return null;
  const activeTab = tab;
  const activeFile = tabFile;
  const activeIdentity = identity;
  const activeFileKey = fileKey;

  async function reload() {
    tabAbortRef.current?.abort();
    const controller = new AbortController();
    tabAbortRef.current = controller;
    const currentTabId = activeTab.value;
    const handle = activeFile.handle;
    try {
      const numGames = await tauri.countPgnGames(handle, { signal: controller.signal });
      if (identityRef.current !== activeIdentity || controller.signal.aborted) return;
      const saved = setCurrentTab((prev) => {
        if (prev.value !== currentTabId) return prev;
        if (prev.gameOrigin.kind !== "file" && prev.gameOrigin.kind !== "temp_file") {
          return prev;
        }
        if (fileWorkspaceKey(prev.gameOrigin.file.handle) !== activeFileKey) return prev;
        return {
          ...prev,
          gameOrigin: {
            ...prev.gameOrigin,
            file: {
              ...prev.gameOrigin.file,
              numGames,
            },
          },
        };
      });
      if (!saved) return;
      setGames(new Map());
    } catch (cause) {
      if (identityRef.current !== activeIdentity || controller.signal.aborted) return;
      notifyUnlessCancelled(t("Common.Error"), cause);
    }
  }

  return (
    <>
      <Group justify="space-between" py="sm" px="md">
        <Text>
          {t("Files.GameCountSuffix", {
            count: tabFile.numGames ?? 0,
            number: formatNumber(tabFile.numGames ?? 0),
          })}
        </Text>
        <Group>
          <Tooltip label={tabFile.name}>
            <Code>{tabFile.name}</Code>
          </Tooltip>

          <IconAction
            label={t("Files.Reload")}
            variant="outline"
            size="sm"
            onClick={() => void reload()}
          >
            <IconReload size="1rem" />
          </IconAction>
        </Group>
      </Group>
      <Divider />
    </>
  );
}

export default FileInfo;
