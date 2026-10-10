import { Button, Group, Loader, Stack, Text } from "@mantine/core";
import { useCallback, useContext, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useTranslation } from "react-i18next";
import { useStore } from "zustand";
import { normalizeError } from "@/platform/errors";
import { notifyUnlessCancelled } from "@/components/files/notifyError";
import { TreeStateContext } from "@/components/common/TreeStateContext";
import type { TreeStore } from "@/state/store/tree";
import { tabStorage } from "@/state/store/tabStorage";
import { parsePGN } from "@/utils/chess";
import { loadFileGame, pickPgnFile, readFileGame, writeFileGame } from "@/utils/files";
import {
  AddGameContext,
  appendBlankGame,
  getAddGameLease,
  subscribeAddGame,
  getTabTreeKey,
  isFileBackedTab,
  matchesFileGameTab,
  serializeStoreTree,
  sameTabOwner,
  useTabActions,
  type FileBackedTab,
} from "@/utils/tabs";
import type { Tab } from "@/utils/tabs";
import { fileWorkspaceKey } from "@/utils/pathCapabilities";
import {
  getFileFreshness,
  registerFileConflictSave,
  requestFileReconcile,
  setFileFreshness,
  useFileFreshness,
} from "@/state/fileFreshness";
import classes from "./FileFreshnessGate.module.css";

function useAddGameLease(store: TreeStore) {
  return useSyncExternalStore(
    useCallback((listener) => subscribeAddGame(store, listener), [store]),
    useCallback(() => getAddGameLease(store), [store]),
  );
}

type Props = {
  tab: Tab;
  closeTab: (tabId: string) => void;
  children: React.ReactNode;
};

function isUnavailableFileError(error: ReturnType<typeof normalizeError>) {
  return (
    error.backendCategory === "invalid-input" ||
    error.backendCategory === "missing-resource" ||
    error.backendCategory === "conflict"
  );
}

export default function FileFreshnessGate({ tab, closeTab, children }: Props) {
  if (!isFileBackedTab(tab)) return <>{children}</>;
  return (
    <FileBackedGate tab={tab} closeTab={closeTab}>
      {children}
    </FileBackedGate>
  );
}

function FileBackedGate({
  tab,
  closeTab,
  children,
}: Props & {
  tab: FileBackedTab;
}) {
  const { t } = useTranslation();
  const tabId = tab.value;
  const origin = tab.gameOrigin;
  const handle = origin.file.handle;
  const fileKey = fileWorkspaceKey(handle);
  const gameNumber = origin.gameNumber;
  const store = useContext(TreeStateContext)!;
  const { workspace, getTab, updateTab } = useTabActions();
  const freshness = useFileFreshness(tabId);
  const addGameLease = useAddGameLease(store);
  const addingGame =
    !!addGameLease &&
    sameTabOwner(tab, addGameLease.owner) &&
    matchesFileGameTab(tab, addGameLease.owner.gameOrigin);
  const viewMountedRef = useRef(true);
  const sourceStamp = useStore(store, (state) => state.sourceStamp);
  const appendAttempted = useStore(store, (state) => state.appendAttempted);
  const [retryCount, setRetryCount] = useState(0);
  const [reloadCount, setReloadCount] = useState(0);
  const [panelError, setPanelError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<"reload" | "append" | null>(null);
  const freshnessErrorMessageRef = useRef(freshness.errorMessage);
  freshnessErrorMessageRef.current = freshness.errorMessage;
  const pendingActionRef = useRef(false);
  const actionControllerRef = useRef<AbortController | null>(null);
  const actionIdentity = { tabId, fileKey, gameNumber, store };
  const actionIdentityRef = useRef(actionIdentity);
  actionIdentityRef.current = actionIdentity;

  const installDiskTree = useCallback(
    (tree: Parameters<ReturnType<typeof store.getState>["setState"]>[0], revision: string) => {
      store.getState().setState(tree);
      setReloadCount((count) => count + 1);
      setFileFreshness(tabId, "verified", { verifiedRevision: revision });
    },
    [store, tabId],
  );

  const actionIsCurrent = useCallback(
    (signal: AbortSignal) => {
      if (signal.aborted) return false;
      const currentTab = getTab(tabId);
      return (
        actionIdentityRef.current.tabId === tabId &&
        actionIdentityRef.current.fileKey === fileKey &&
        actionIdentityRef.current.gameNumber === gameNumber &&
        actionIdentityRef.current.store === store &&
        matchesFileGameTab(currentTab, tab.gameOrigin) &&
        sameTabOwner(currentTab, tab)
      );
    },
    [getTab, tabId, fileKey, gameNumber, store, tab],
  );

  useEffect(() => {
    viewMountedRef.current = true;
    return () => {
      viewMountedRef.current = false;
      actionControllerRef.current?.abort();
      actionControllerRef.current = null;
    };
  }, [tabId, fileKey, gameNumber, store]);

  useEffect(() => {
    if (addingGame || freshness.state !== "unverified") return;
    const capturedEpoch = freshness.epoch;
    const capturedRoot = store.getState().root;
    const capturedStamp = store.getState().sourceStamp;
    setPanelError(freshnessErrorMessageRef.current);
    return requestFileReconcile(tabId, async (signal) => {
      const isObsolete = () =>
        !actionIsCurrent(signal) || getFileFreshness(tabId).epoch !== capturedEpoch;
      try {
        const current = await readFileGame(handle, gameNumber, signal);
        if (isObsolete()) return;
        const latestTree = store.getState();
        if (latestTree.appendAttempted) {
          setFileFreshness(tabId, "conflict", { conflictReason: "changed" });
          return;
        }
        if (latestTree.sourceStamp === null) {
          if (!current.present || current.pgn.trim() !== serializeStoreTree(store).trim()) {
            setFileFreshness(tabId, "conflict", { conflictReason: "changed" });
            return;
          }
          store.getState().setSourceStamp(current.stamp);
          setFileFreshness(tabId, "verified", { verifiedRevision: current.revision });
          return;
        }
        if (!current.present && current.stamp !== capturedStamp) {
          setFileFreshness(tabId, "unavailable");
          setPanelError(t("FileFreshness.GameNoLongerInFile"));
          return;
        }
        if (current.stamp === latestTree.sourceStamp) {
          setFileFreshness(tabId, "verified", { verifiedRevision: current.revision });
          return;
        }
        if (latestTree.dirty || latestTree.root !== capturedRoot) {
          setFileFreshness(tabId, "conflict", { conflictReason: "changed" });
          return;
        }
        const tree = await parsePGN(current.pgn, undefined, { signal });
        if (isObsolete()) return;
        const beforeReplace = store.getState();
        if (beforeReplace.dirty || beforeReplace.root !== capturedRoot) {
          setFileFreshness(tabId, "conflict", { conflictReason: "changed" });
          return;
        }
        tree.sourceStamp = current.stamp;
        installDiskTree(tree, current.revision);
      } catch (error) {
        if (isObsolete()) return;
        const normalized = normalizeError(error);
        if (isUnavailableFileError(normalized)) {
          setFileFreshness(tabId, "unavailable");
          if (normalized.backendCategory === "invalid-input") {
            setPanelError(t("FileFreshness.GameNoLongerInFile"));
          }
          return;
        }
        setPanelError(normalized.message);
      }
    });
  }, [
    freshness.state,
    freshness.epoch,
    addingGame,
    retryCount,
    tabId,
    gameNumber,
    store,
    handle,
    sourceStamp,
    actionIsCurrent,
    installDiskTree,
    t,
  ]);

  const appendGame = useCallback(
    (captured: Tab | undefined) =>
      appendBlankGame({
        captured,
        store,
        workspace,
        getTab,
        updateTab,
        uncertainMessage: t("FileFreshness.AddGameMayHaveBeenAdded"),
        changedMessage: t("FileFreshness.AddGameChanged"),
        onError: (error) => {
          if (viewMountedRef.current) notifyUnlessCancelled(t("Common.Error"), error);
        },
      }),
    [workspace, getTab, updateTab, store, t],
  );

  const runAction = useCallback(
    async (action: "reload" | "append", run: (signal: AbortSignal) => Promise<boolean>) => {
      if (pendingActionRef.current) return false;
      pendingActionRef.current = true;
      const controller = new AbortController();
      actionControllerRef.current = controller;
      setPendingAction(action);
      setPanelError(null);
      try {
        return await run(controller.signal);
      } finally {
        pendingActionRef.current = false;
        if (actionControllerRef.current === controller) actionControllerRef.current = null;
        if (!controller.signal.aborted) setPendingAction(null);
      }
    },
    [],
  );

  const reloadFromDisk = useCallback(async (): Promise<boolean> => {
    return runAction("reload", async (signal) => {
      try {
        const loaded = await loadFileGame(handle, gameNumber, signal);
        if (!actionIsCurrent(signal)) return false;
        if (!loaded.present && gameNumber < origin.file.numGames) {
          setFileFreshness(tabId, "unavailable");
          setPanelError(t("FileFreshness.GameNoLongerInFile"));
          return false;
        }
        installDiskTree(loaded.tree, loaded.revision);
        setPanelError(null);
        return true;
      } catch (error) {
        if (actionIsCurrent(signal)) {
          const normalized = normalizeError(error);
          if (isUnavailableFileError(normalized)) {
            setFileFreshness(tabId, "unavailable");
          }
          setPanelError(normalized.message);
        }
        return false;
      }
    });
  }, [
    runAction,
    actionIsCurrent,
    handle,
    gameNumber,
    origin.file.numGames,
    tabId,
    installDiskTree,
    t,
  ]);

  const appendAsNewGame = useCallback(
    async (throwOnFailure = false): Promise<boolean> => {
      if (appendAttempted) return false;
      return runAction("append", async (signal) => {
        try {
          const selected = await pickPgnFile();
          if (!selected || !actionIsCurrent(signal)) return false;

          store.getState().setAppendAttempted(true);
          const failedTabs = tabStorage.flush();
          if (failedTabs.includes(getTabTreeKey(tab))) {
            store.getState().setAppendAttempted(false);
            tabStorage.flush({ notify: true });
            setPanelError(t("FileFreshness.CouldNotPrepareAppend"));
            if (throwOnFailure) {
              throw {
                category: "unexpected",
                message: t("FileFreshness.CouldNotPrepareAppend"),
              };
            }
            return false;
          }

          const pgn = serializeStoreTree(store);
          const written = await writeFileGame(selected.handle, selected.numGames, pgn, {
            kind: "append",
          });
          if (!actionIsCurrent(signal)) return false;
          if (written.stamp === null || written.revision === null) {
            setPanelError(t("FileFreshness.AppendMayHaveBeenAdded"));
            return false;
          }
          const originSaved = updateTab(tabId, (previous) => ({
            ...previous,
            gameOrigin: {
              kind: "file",
              gameNumber: selected.numGames,
              file: {
                ...selected,
                numGames: selected.numGames + 1,
                metadata: { tags: [], type: "game" },
              },
            },
          }));
          if (!originSaved) return false;
          store.getState().save(written.stamp);
          setFileFreshness(tabId, "verified", { verifiedRevision: written.revision });
          return true;
        } catch (error) {
          if (!actionIsCurrent(signal)) return false;
          const normalized = normalizeError(error);
          if (normalized.backendCategory === "stale-game") {
            store.getState().setAppendAttempted(false);
            tabStorage.flush();
            setPanelError(t("FileFreshness.AppendChanged"));
          } else {
            if (isUnavailableFileError(normalized)) {
              setFileFreshness(tabId, "unavailable");
            }
            setPanelError(normalized.message);
          }
          if (throwOnFailure) throw normalized;
          return false;
        }
      });
    },
    [appendAttempted, runAction, actionIsCurrent, store, tabId, tab, t, updateTab],
  );

  useEffect(
    () => registerFileConflictSave(tabId, () => appendAsNewGame(true)),
    [tabId, appendAsNewGame],
  );

  const state = addingGame ? "appending" : freshness.state;
  const errorMessage = panelError ?? freshness.errorMessage;
  const disabled = pendingAction !== null;
  const wrapper = (content: React.ReactNode) => (
    <div
      className={classes.gate}
      data-file-freshness={`${state}:${reloadCount}`}
      data-tab-id={tabId}
    >
      {content}
    </div>
  );

  if (state === "verified")
    return wrapper(
      <AddGameContext.Provider value={appendGame}>{children}</AddGameContext.Provider>,
    );
  if (state === "appending" || state === "unverified" || state === "overdue") {
    return wrapper(
      <Stack align="center" justify="center" h="100%" gap="sm">
        {state === "appending" ? (
          <>
            <Loader />
            <Text>{t("FileFreshness.AddingGame")}</Text>
          </>
        ) : state === "overdue" ? (
          <Text>{t("FileFreshness.FileNotResponding")}</Text>
        ) : errorMessage ? (
          <>
            <Text>{errorMessage}</Text>
            <Button onClick={() => setRetryCount((count) => count + 1)}>
              {t("FileFreshness.Retry")}
            </Button>
          </>
        ) : (
          <>
            <Loader />
            <Text>{t("FileFreshness.CheckingFile")}</Text>
          </>
        )}
      </Stack>,
    );
  }

  const conflict = state === "conflict";
  const uncertainMessage = appendAttempted ? t("FileFreshness.AppendMayHaveBeenAdded") : null;
  return wrapper(
    <Stack className={classes.panel} align="center" justify="center" h="100%" gap="sm">
      <Text>{t(conflict ? "FileFreshness.Changed" : "FileFreshness.Unavailable")}</Text>
      {uncertainMessage && <Text c="dimmed">{uncertainMessage}</Text>}
      {errorMessage && <Text c="red">{errorMessage}</Text>}
      <Group>
        {(conflict || appendAttempted) && (
          <Button onClick={() => void reloadFromDisk()} disabled={disabled}>
            {t("FileFreshness.ReloadFromDisk")}
          </Button>
        )}
        <Button onClick={() => void appendAsNewGame()} disabled={disabled || appendAttempted}>
          {t("FileFreshness.SaveAsNewGame")}
        </Button>
        {!conflict && (
          <Button variant="default" onClick={() => closeTab(tabId)} disabled={disabled}>
            {t("Tab.Close")}
          </Button>
        )}
      </Group>
    </Stack>,
  );
}
