import { tauri } from "@/platform/tauri";
import { notifications } from "@mantine/notifications";
import { Accordion, Box, Divider, Group, ScrollArea, Stack, Text } from "@mantine/core";
import { IconPlus } from "@tabler/icons-react";
import { errorUnlessCancelled, normalizeError } from "@/platform/errors";
import { useAtom, useAtomValue, useSetAtom, useStore as useJotaiStore } from "jotai";
import { use, useEffect, useRef, useState } from "react";
import { useHotkeys } from "react-hotkeys-hook";
import { useTranslation } from "react-i18next";
import { useStore } from "zustand";
import { type DatabaseHandle, type FileWorkspaceHandle } from "@/bindings";
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
import GameSelector, { type DeleteGameSnapshot, type GameSelectorRow } from "./GameSelector";
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
import { loadFileGame, withFileWrite } from "@/utils/files";
import { setFileFreshness } from "@/state/fileFreshness";
import type { Tab } from "@/state/workspaceTypes";

type FileBackedTab = Tab & {
  gameOrigin: Extract<Tab["gameOrigin"], { kind: "file" | "temp_file" }>;
};

type FileTabUpdateResult = {
  saved: boolean;
  matched: boolean;
};

function InfoPanel({ addGame }: { addGame?: () => void }) {
  const store = use(TreeStateContext)!;
  const stats = useStore(store, getStats);
  const headers = useStore(store, (s) => s.headers);
  const [games, setGames] = useState<Map<number, GameSelectorRow>>(new Map());
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
                newGames.set(gameNumber, { ...newGames.get(gameNumber), name: title });
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
  games: Map<number, GameSelectorRow>;
  setGames: React.Dispatch<React.SetStateAction<Map<number, GameSelectorRow>>>;
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
  const currentName = games.get(gameNumber)?.name || "Untitled";

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
  const countRefreshAbortRef = useRef<AbortController | null>(null);
  const countRefreshGenerationRef = useRef(0);
  const currentIdentityRef = useRef({ tabId, fileKey, store });
  currentIdentityRef.current = { tabId, fileKey, store };

  useEffect(() => {
    return () => {
      pageGenerationRef.current += 1;
      pageAbortRef.current?.abort();
      pageAbortRef.current = null;
      countRefreshGenerationRef.current += 1;
      countRefreshAbortRef.current?.abort();
      countRefreshAbortRef.current = null;
    };
  }, [tabId, fileKey, store]);

  function isCurrentOwner(ownerId: string, ownerFileKey: string, ownerStore: typeof store) {
    const identity = currentIdentityRef.current;
    if (
      identity.tabId !== ownerId ||
      identity.fileKey !== ownerFileKey ||
      identity.store !== ownerStore
    ) {
      return false;
    }
    const active = jotaiStore.get(currentTabAtom);
    const activeFile = active && getTabFile(active);
    if (
      active?.value !== ownerId ||
      !activeFile ||
      fileWorkspaceKey(activeFile.handle) !== ownerFileKey
    ) {
      return false;
    }
    const owner = jotaiStore.get(tabsAtom).find((tab) => tab.value === ownerId);
    return (
      !!owner &&
      (owner.gameOrigin.kind === "file" || owner.gameOrigin.kind === "temp_file") &&
      fileWorkspaceKey(owner.gameOrigin.file.handle) === ownerFileKey
    );
  }

  function isFileBackedTab(tab: Tab | undefined): tab is FileBackedTab {
    return !!tab && (tab.gameOrigin.kind === "file" || tab.gameOrigin.kind === "temp_file");
  }

  function updateFileTabs(
    ownerFileKey: string,
    updateTab: (tab: FileBackedTab) => FileBackedTab | null,
    ownerCountPrecondition?: { id: string; count: number },
  ): FileTabUpdateResult {
    let matched = false;
    const saved = setTabs((tabs) => {
      if (ownerCountPrecondition) {
        const owner = tabs.find((tab) => tab.value === ownerCountPrecondition.id);
        const ownerMatched =
          isFileBackedTab(owner) &&
          fileWorkspaceKey(owner.gameOrigin.file.handle) === ownerFileKey &&
          owner.gameOrigin.file.numGames === ownerCountPrecondition.count;
        if (!ownerMatched) return tabs;
      }

      return tabs.map((tab) => {
        if (
          !isFileBackedTab(tab) ||
          fileWorkspaceKey(tab.gameOrigin.file.handle) !== ownerFileKey
        ) {
          return tab;
        }
        const updated = updateTab(tab);
        if (updated === null) return tab;
        matched = true;
        return updated;
      });
    });
    return { saved, matched };
  }

  function updateOwnerCount(
    ownerId: string,
    ownerFileKey: string,
    ownerCountPrecondition: number,
    numGames: number,
  ) {
    return updateFileTabs(
      ownerFileKey,
      (tab) => {
        if (tab.value !== ownerId || tab.gameOrigin.file.numGames !== ownerCountPrecondition) {
          return null;
        }
        return {
          ...tab,
          gameOrigin: {
            ...tab.gameOrigin,
            file: { ...tab.gameOrigin.file, numGames },
          },
        };
      },
      { id: ownerId, count: ownerCountPrecondition },
    );
  }

  function workspaceWriteRefusedError() {
    return new Error("Workspace file metadata could not be saved");
  }

  async function refreshOwnerCount(
    ownerId: string,
    handle: FileWorkspaceHandle,
    ownerFileKey: string,
    ownerStore: typeof store,
    ownerCountPrecondition: number,
  ): Promise<"updated" | "superseded" | "refused" | "failed"> {
    countRefreshAbortRef.current?.abort();
    const controller = new AbortController();
    countRefreshAbortRef.current = controller;
    const generation = ++countRefreshGenerationRef.current;
    const initialTabs = jotaiStore.get(tabsAtom);
    const owner = initialTabs.find((tab) => tab.value === ownerId);
    if (
      !isFileBackedTab(owner) ||
      fileWorkspaceKey(owner.gameOrigin.file.handle) !== ownerFileKey ||
      owner.gameOrigin.file.numGames !== ownerCountPrecondition ||
      !isCurrentOwner(ownerId, ownerFileKey, ownerStore)
    ) {
      if (countRefreshAbortRef.current === controller) countRefreshAbortRef.current = null;
      return "superseded";
    }
    const countPreconditions = new Map(
      initialTabs
        .filter(
          (tab): tab is FileBackedTab =>
            isFileBackedTab(tab) && fileWorkspaceKey(tab.gameOrigin.file.handle) === ownerFileKey,
        )
        .map((tab) => [tab.value, tab.gameOrigin.file.numGames]),
    );

    try {
      const numGames = await tauri.countPgnGames(handle, { signal: controller.signal });
      if (
        controller.signal.aborted ||
        generation !== countRefreshGenerationRef.current ||
        !isCurrentOwner(ownerId, ownerFileKey, ownerStore)
      ) {
        return "superseded";
      }

      const update = updateFileTabs(
        ownerFileKey,
        (tab) => {
          const countPrecondition = countPreconditions.get(tab.value);
          if (
            !countPreconditions.has(tab.value) ||
            tab.gameOrigin.file.numGames !== countPrecondition
          ) {
            return null;
          }
          return {
            ...tab,
            gameOrigin: {
              ...tab.gameOrigin,
              file: { ...tab.gameOrigin.file, numGames },
            },
          };
        },
        { id: ownerId, count: ownerCountPrecondition },
      );
      if (!update.matched) return "superseded";
      return update.saved ? "updated" : "refused";
    } catch (error) {
      if (
        controller.signal.aborted ||
        generation !== countRefreshGenerationRef.current ||
        !isCurrentOwner(ownerId, ownerFileKey, ownerStore) ||
        errorUnlessCancelled(error) === null
      ) {
        return "superseded";
      }
      notifyUnlessCancelled(t("Common.Error"), error);
      return "failed";
    } finally {
      if (countRefreshAbortRef.current === controller) countRefreshAbortRef.current = null;
    }
  }

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

  async function deleteGame(snapshot: DeleteGameSnapshot) {
    if (!tabFile || !currentTab) return;
    const { index, stamp, revision } = snapshot;
    const ownerId = currentTab.value;
    const filePath = tabFile.handle;
    const fileKey = fileWorkspaceKey(filePath);
    const ownerStore = store;
    countRefreshGenerationRef.current += 1;
    countRefreshAbortRef.current?.abort();
    countRefreshAbortRef.current = null;
    const originalCount = tabFile.numGames;
    const predictedCount = originalCount - 1;
    const workspaceTabs = jotaiStore.get(tabsAtom);
    const owner = workspaceTabs.find((tab) => tab.value === ownerId);
    if (!isCurrentOwner(ownerId, fileKey, ownerStore) || !isFileBackedTab(owner)) return;

    const showStaleRefusal = () => {
      if (!isCurrentOwner(ownerId, fileKey, ownerStore)) return;
      setGames(new Map());
      notifications.show({
        color: "red",
        title: t("Common.Error"),
        message: t("Files.RemoveGameStale", {
          defaultValue:
            "The file changed, so no game was removed. Refresh the game list before deleting.",
        }),
      });
    };

    if (
      fileWorkspaceKey(owner.gameOrigin.file.handle) !== fileKey ||
      owner.gameOrigin.file.numGames !== originalCount ||
      !Number.isInteger(index) ||
      index < 0 ||
      index >= owner.gameOrigin.file.numGames
    ) {
      showStaleRefusal();
      const refresh = await refreshOwnerCount(
        ownerId,
        filePath,
        fileKey,
        ownerStore,
        owner.gameOrigin.file.numGames,
      );
      if (refresh === "refused") throw workspaceWriteRefusedError();
      return;
    }

    const initialTabMetadata = new Map(
      workspaceTabs
        .filter(
          (tab): tab is FileBackedTab =>
            isFileBackedTab(tab) && fileWorkspaceKey(tab.gameOrigin.file.handle) === fileKey,
        )
        .map((tab) => [
          tab.value,
          {
            numGames: tab.gameOrigin.file.numGames,
            gameNumber: tab.gameOrigin.gameNumber,
          },
        ]),
    );
    const optimistic = updateOwnerCount(ownerId, fileKey, originalCount, predictedCount);
    if (!optimistic.matched) {
      const currentOwner = jotaiStore.get(tabsAtom).find((tab) => tab.value === ownerId);
      if (isFileBackedTab(currentOwner) && isCurrentOwner(ownerId, fileKey, ownerStore)) {
        showStaleRefusal();
        const refresh = await refreshOwnerCount(
          ownerId,
          filePath,
          fileKey,
          ownerStore,
          currentOwner.gameOrigin.file.numGames,
        );
        if (refresh === "refused") throw workspaceWriteRefusedError();
      }
      return;
    }
    if (!optimistic.saved) throw workspaceWriteRefusedError();

    let nativeMutationSucceeded = false;
    try {
      await withFileWrite(filePath, () => tauri.deleteGame(filePath, index, stamp, revision));
      nativeMutationSucceeded = true;

      const update = updateFileTabs(fileKey, (tab) => {
        const currentCount = tab.gameOrigin.file.numGames;
        const startingMetadata = initialTabMetadata.get(tab.value);
        const metadataCanFollowDelete =
          startingMetadata !== undefined &&
          startingMetadata.numGames === originalCount &&
          tab.gameOrigin.gameNumber === startingMetadata.gameNumber &&
          (tab.value === ownerId
            ? currentCount === predictedCount
            : currentCount === startingMetadata.numGames);
        if (!metadataCanFollowDelete) return null;

        const nextGameNumber =
          tab.gameOrigin.gameNumber > index
            ? tab.gameOrigin.gameNumber - 1
            : tab.gameOrigin.gameNumber;
        if (predictedCount === currentCount && nextGameNumber === tab.gameOrigin.gameNumber) {
          return tab;
        }
        return {
          ...tab,
          gameOrigin: {
            ...tab.gameOrigin,
            gameNumber: nextGameNumber,
            file: { ...tab.gameOrigin.file, numGames: predictedCount },
          },
        };
      });
      if (!update.saved && update.matched) {
        for (const tab of jotaiStore.get(tabsAtom)) {
          if (isFileBackedTab(tab) && fileWorkspaceKey(tab.gameOrigin.file.handle) === fileKey) {
            setFileFreshness(tab.value, "conflict", { conflictReason: "changed" });
          }
        }
        if (isCurrentOwner(ownerId, fileKey, ownerStore)) setGames(new Map());
        throw new Error("Committed but durability uncertain: file deletion tab metadata");
      }

      for (const tab of jotaiStore.get(tabsAtom)) {
        if (isFileBackedTab(tab) && fileWorkspaceKey(tab.gameOrigin.file.handle) === fileKey) {
          setFileFreshness(tab.value, "unverified");
        }
      }
      if (isCurrentOwner(ownerId, fileKey, ownerStore)) setGames(new Map());
    } catch (error) {
      if (nativeMutationSucceeded) throw error;
      const errorDetails = normalizeError(error);
      const rollbackCount = () => updateOwnerCount(ownerId, fileKey, predictedCount, originalCount);

      if (errorDetails.backendCategory === "stale-game") {
        const rollback = rollbackCount();
        showStaleRefusal();
        const ownerAfterRollback = jotaiStore.get(tabsAtom).find((tab) => tab.value === ownerId);
        if (isCurrentOwner(ownerId, fileKey, ownerStore) && isFileBackedTab(ownerAfterRollback)) {
          const refresh = await refreshOwnerCount(
            ownerId,
            filePath,
            fileKey,
            ownerStore,
            ownerAfterRollback.gameOrigin.file.numGames,
          );
          if (rollback.matched && !rollback.saved) throw workspaceWriteRefusedError();
          if (refresh === "refused") throw workspaceWriteRefusedError();
        } else if (rollback.matched && !rollback.saved) {
          throw workspaceWriteRefusedError();
        }
        return;
      }

      if (errorDetails.category === "applied-despite-error") {
        if (isCurrentOwner(ownerId, fileKey, ownerStore)) setGames(new Map());
        const ownerNow = jotaiStore.get(tabsAtom).find((tab) => tab.value === ownerId);
        if (isCurrentOwner(ownerId, fileKey, ownerStore) && isFileBackedTab(ownerNow)) {
          const refresh = await refreshOwnerCount(
            ownerId,
            filePath,
            fileKey,
            ownerStore,
            ownerNow.gameOrigin.file.numGames,
          );
          if (refresh === "refused") throw error;
        }
        throw error;
      }

      const rollback = rollbackCount();
      if (rollback.matched && !rollback.saved) throw workspaceWriteRefusedError();
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
