import { tauri } from "@/platform/tauri";
import { notifyUnlessCancelled } from "@/components/common/notifyError";
import { Code, Divider, Group, Text, Tooltip } from "@mantine/core";
import { IconReload } from "@tabler/icons-react";
import { useAtom } from "jotai";
import { useRef } from "react";
import { useTranslation } from "react-i18next";
import { currentTabAtom } from "@/state/atoms";
import { IconAction } from "@/components/common/IconAction";
import { formatNumber } from "@/utils/format";
import { getTabFile } from "@/utils/tabs";

function FileInfo({
  setGames,
}: {
  setGames: React.Dispatch<React.SetStateAction<Map<number, string>>>;
}) {
  const { t } = useTranslation();
  const [tab, setCurrentTab] = useAtom(currentTabAtom);
  const tabFile = getTabFile(tab);
  const tabIdRef = useRef(tab?.value);
  tabIdRef.current = tab?.value;

  if (!tab || !tabFile) return null;
  const activeTab = tab;
  const activeFile = tabFile;
  async function reload() {
    const tabId = activeTab.value;
    const handle = activeFile.handle;
    try {
      const numGames = await tauri.countPgnGames(handle);
      if (tabIdRef.current !== tabId) return;
      setCurrentTab((prev) => {
        if (prev.value !== tabId) return prev;
        if (prev.gameOrigin.kind !== "file" && prev.gameOrigin.kind !== "temp_file") {
          return prev;
        }
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
      setGames(new Map());
    } catch (cause) {
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
