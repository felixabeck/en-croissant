import { tauri } from "@/platform/tauri";
import { Accordion, Box, Divider, Group, ScrollArea, Stack, Text } from "@mantine/core";
import { IconPlus } from "@tabler/icons-react";
import { errorUnlessCancelled } from "@/platform/errors";
import { useAtom, useAtomValue, useSetAtom, useStore as useJotaiStore } from "jotai";
import { use, useEffect, useRef, useState } from "react";
import { useHotkeys } from "react-hotkeys-hook";
import { useTranslation } from "react-i18next";
import { useStore } from "zustand";
import { type DatabaseHandle } from "@/bindings";
import GameInfo from "@/components/common/GameInfo";
import { IconAction } from "@/components/common/IconAction";
import { TreeStateContext } from "@/components/common/TreeStateContext";
import ConfirmChangesModal from "@/components/tabs/ConfirmChangesModal";
import { currentTabAtom, tabsAtom } from "@/state/atoms";
import { keyMapAtom } from "@/state/keybinds";
import { formatNumber } from "@/utils/format";
import { getTabFile, getTabGameNumber } from "@/utils/tabs";
import FenSearch from "./FenSearch";
import FileInfo from "./FileInfo";
import GameSelector from "./GameSelector";
import classes from "./InfoPanel.module.css";
import PgnInput from "./PgnInput";
import { getStats } from "@/utils/repertoire";
import useSWR from "swr";
import { useNativeRequestOwner } from "@/hooks/useNativeRequestOwner";
import { getDatabases, sameDatabaseHandle } from "@/utils/db";
import { databaseHandleKey } from "@/utils/db";
import { useNavigate } from "@tanstack/react-router";
import { useActiveDatabaseViewStore } from "@/state/store/database";
import { notifyUnlessCancelled } from "@/components/files/notifyError";
import { fileWorkspaceKey } from "@/utils/pathCapabilities";
import { loadFileGame } from "@/utils/files";
import { beginFileWrite, setFileFreshness } from "@/state/fileFreshness";

function InfoPanel({ addGame }: { addGame?: () => void }) {
  const store = use(TreeStateContext)!;
  const stats = useStore(store, getStats);
  const headers = useStore(store, (s) => s.headers);
  const [games, setGames] = useState<Map<number, string>>(new Map());
  const currentTab = useAtomValue(currentTabAtom);
  const tabFile = getTabFile(currentTab);
  const gameNumber = getTabGameNumber(currentTab);
  const isReportoire = tabFile?.metadata.type === "repertoire";

  const { t } = useTranslation();

  return (
    <Stack h="100%" gap={0}>
      {currentTab?.gameOrigin.kind === "database" && (
        <DatabaseInfo path={currentTab.gameOrigin.database} id={currentTab.gameOrigin.gameId} />
      )}
      <GameSelectorAccordion games={games} setGames={setGames} addGame={addGame} />
      <ScrollArea pb="sm">
        <FileInfo setGames={setGames} />
        <Stack px="sm">
          <GameInfo
            headers={headers}
            simplified={isReportoire}
            changeTitle={(title: string) => {
              setGames((prev) => {
                const newGames = new Map(prev);
                newGames.set(gameNumber, title);
                return newGames;
              });
            }}
          />
          <FenSearch />
          <PgnInput />

          <Group>
            <Text fz="xs" c="dimmed">
              {t("PgnInput.Variations")}: {stats.leafs}
            </Text>
            <Text fz="xs" c="dimmed">
              {t("PgnInput.MaxDepth")}: {stats.depth}
            </Text>
            <Text fz="xs" c="dimmed">
              {t("PgnInput.TotalMoves")}: {stats.total}
            </Text>
          </Group>
        </Stack>
      </ScrollArea>
    </Stack>
  );
}

function DatabaseInfo({ path, id: _id }: { path: DatabaseHandle; id: number }) {
  const { t } = useTranslation();
  const databaseOwner = useNativeRequestOwner("databases");
  const { data: databases, isLoading } = useSWR("databases", () =>
    databaseOwner!.run((signal) => getDatabases({ signal })),
  );

  const dbInfo = databases?.find((db) => sameDatabaseHandle(db.file, path));
  const navigate = useNavigate();
  const setActiveDatabase = useActiveDatabaseViewStore((store) => store.setDatabase);

  if (isLoading || !dbInfo || dbInfo.type !== "success") {
    return null;
  }
  return (
    <Stack gap={0}>
      <Box
        className={classes.databaseCard}
        onClick={async () => {
          await navigate({
            to: "/databases/$databaseId",
            params: {
              databaseId: databaseHandleKey(dbInfo.file),
            },
          });
          setActiveDatabase(dbInfo);
        }}
      >
        <Text tt="uppercase" c="dimmed" fw={700} size="xs">
          {t("Board.Tabs.Database")}
        </Text>
        <Text fw="bold">{dbInfo.title}</Text>
        <Text size="xs" c="dimmed">
          {dbInfo.description}
        </Text>
      </Box>
      <Divider />
    </Stack>
  );
}

function GameSelectorAccordion({
  games,
  setGames,
  addGame,
}: {
  games: Map<number, string>;
  setGames: React.Dispatch<React.SetStateAction<Map<number, string>>>;
  addGame?: () => void;
}) {
  const store = use(TreeStateContext)!;
  const setState = useStore(store, (s) => s.setState);
  const [currentTab, setCurrentTab] = useAtom(currentTabAtom);
  const setTabs = useSetAtom(tabsAtom);
  const jotaiStore = useJotaiStore();

  const [confirmChanges, setConfirmChanges] = useState(false);
  const toggleConfirmChanges = () => setConfirmChanges((opened) => !opened);
  const [tempPage, setTempPage] = useState(0);

  const tabFile = getTabFile(currentTab);
  const gameNumber = getTabGameNumber(currentTab);
  const currentName = games.get(gameNumber) || "Untitled";

  const keyMap = useAtomValue(keyMapAtom);
  const { t } = useTranslation();

  useHotkeys(
    keyMap.NEXT_GAME.keys,
    () => {
      if (!tabFile?.numGames) return;
      void setPage(Math.min(gameNumber + 1, tabFile.numGames - 1));
    },
    {
      enabled: !!tabFile,
    },
  );

  useHotkeys(keyMap.PREVIOUS_GAME.keys, () => setPage(Math.max(0, gameNumber - 1)), {
    enabled: !!tabFile,
  });

  const tabId = currentTab?.value;
  const fileKey = tabFile ? fileWorkspaceKey(tabFile.handle) : null;
  const pageAbortRef = useRef<AbortController | null>(null);
  const pageGenerationRef = useRef(0);
  const currentIdentityRef = useRef({ tabId, fileKey, store });
  currentIdentityRef.current = { tabId, fileKey, store };

  useEffect(() => {
    return () => {
      pageGenerationRef.current += 1;
      pageAbortRef.current?.abort();
      pageAbortRef.current = null;
    };
  }, [tabId, fileKey, store]);

  async function setPage(page: number, forced?: boolean) {
    if (!tabFile || !currentTab || tabId === undefined || fileKey === null) return;
    if (!forced && store.getState().dirty) {
      setTempPage(page);
      setConfirmChanges(true);
      return;
    }

    pageAbortRef.current?.abort();
    const controller = new AbortController();
    pageAbortRef.current = controller;
    const generation = ++pageGenerationRef.current;
    const activeTabId = tabId;
    const activeFileKey = fileKey;
    const activeStore = store;
    const filePath = tabFile.handle;
    const initialRoot = activeStore.getState().root;

    const isObsolete = () =>
      generation !== pageGenerationRef.current ||
      controller.signal.aborted ||
      currentIdentityRef.current.tabId !== activeTabId ||
      currentIdentityRef.current.fileKey !== activeFileKey ||
      currentIdentityRef.current.store !== activeStore;

    try {
      const loaded = await loadFileGame(filePath, page, controller.signal);
      if (isObsolete()) {
        return;
      }
      if (activeStore.getState().dirty || activeStore.getState().root !== initialRoot) {
        setTempPage(page);
        setConfirmChanges(true);
        return;
      }
      const saved = setCurrentTab((prev) => {
        if (prev.value !== activeTabId) return prev;
        if (prev.gameOrigin.kind !== "file" && prev.gameOrigin.kind !== "temp_file") {
          return prev;
        }
        if (fileWorkspaceKey(prev.gameOrigin.file.handle) !== activeFileKey) {
          return prev;
        }
        return {
          ...prev,
          gameOrigin: {
            ...prev.gameOrigin,
            gameNumber: page,
          },
        };
      });
      if (!saved) return;
      setState(loaded.tree);
      // The tree was just read from disk, so the gate need not read it a second time.
      if (!loaded.present && page < tabFile.numGames) {
        setFileFreshness(activeTabId, "unavailable");
      } else {
        setFileFreshness(activeTabId, "verified", { verifiedRevision: loaded.revision });
      }
    } catch (error) {
      if (isObsolete()) {
        return;
      }
      if (errorUnlessCancelled(error) === null) return;
      notifyUnlessCancelled(t("Common.Error"), error);
    }
  }

  async function deleteGame(index: number) {
    if (!tabFile || !currentTab) return;
    const ownerId = currentTab.value;
    const filePath = tabFile.handle;
    const fileKey = fileWorkspaceKey(filePath);
    const originalCount = tabFile.numGames;
    const predictedCount = originalCount - 1;
    const workspaceTabs = jotaiStore.get(tabsAtom);
    const owner = workspaceTabs.find((tab) => tab.value === ownerId);
    if (!owner) return;
    if (owner.gameOrigin.kind !== "file" && owner.gameOrigin.kind !== "temp_file") return;
    const ownerOrigin = owner.gameOrigin;
    if (
      fileWorkspaceKey(ownerOrigin.file.handle) !== fileKey ||
      ownerOrigin.file.numGames !== originalCount
    ) {
      return;
    }
    const saved = setTabs(
      workspaceTabs.map((tab) => {
        if (tab.value !== ownerId) return tab;
        return {
          ...owner,
          gameOrigin: {
            ...ownerOrigin,
            file: { ...ownerOrigin.file, numGames: predictedCount },
          },
        };
      }),
    );
    if (!saved) return;
    try {
      const endWrite = beginFileWrite(fileKey);
      try {
        await tauri.deleteGame(filePath, index);
      } finally {
        endWrite();
      }
      if (
        currentIdentityRef.current.tabId === ownerId &&
        currentIdentityRef.current.fileKey === fileKey &&
        currentIdentityRef.current.store === store
      ) {
        setGames(new Map());
      }
    } catch (error) {
      setTabs((tabs) =>
        tabs.map((tab) => {
          if (tab.value !== ownerId) return tab;
          if (tab.gameOrigin.kind !== "file" && tab.gameOrigin.kind !== "temp_file") return tab;
          if (
            fileWorkspaceKey(tab.gameOrigin.file.handle) !== fileKey ||
            tab.gameOrigin.file.numGames !== predictedCount
          ) {
            return tab;
          }
          return {
            ...tab,
            gameOrigin: {
              ...tab.gameOrigin,
              file: { ...tab.gameOrigin.file, numGames: originalCount },
            },
          };
        }),
      );
      throw error;
    }
  }

  if (!tabFile) return null;
  const filePath = tabFile.handle;

  return (
    <>
      <ConfirmChangesModal
        opened={confirmChanges}
        toggle={toggleConfirmChanges}
        closeTab={() => {
          void setPage(tempPage, true);
        }}
      />
      <Accordion
        styles={{
          control: {
            borderBottom: "1px solid var(--mantine-color-default-border)",
          },
          content: { padding: 0 },
        }}
      >
        <Accordion.Item value="game">
          <Accordion.Control>
            <Group justify="space-between" wrap="nowrap" w="100%">
              <Text truncate flex={1}>
                {formatNumber(gameNumber + 1)}. {currentName}
              </Text>
              {addGame && (
                <IconAction
                  label={t("Board.Action.AddGame")}
                  size="sm"
                  variant="subtle"
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    addGame();
                  }}
                >
                  <IconPlus size="0.9rem" />
                </IconAction>
              )}
            </Group>
          </Accordion.Control>
          <Accordion.Panel>
            <Box h="10rem">
              <GameSelector
                games={games}
                setGames={setGames}
                setPage={setPage}
                deleteGame={deleteGame}
                path={filePath}
                activePage={gameNumber || 0}
                total={tabFile.numGames}
              />
            </Box>
          </Accordion.Panel>
        </Accordion.Item>
      </Accordion>
    </>
  );
}
export default InfoPanel;
