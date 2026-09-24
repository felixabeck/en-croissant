import { Button, Group, Loader, Stack, Text } from "@mantine/core";
import { useStore as useJotaiStore, useSetAtom } from "jotai";
import { useCallback, useContext, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useStore } from "zustand";
import { normalizeError } from "@/platform/errors";
import { TreeStateContext } from "@/components/common/TreeStateContext";
import { tabsAtom } from "@/state/atoms";
import { tabStorage } from "@/state/store/tabStorage";
import { parsePGN } from "@/utils/chess";
import { loadFileGame, pickPgnFile, readFileGame, writeFileGame } from "@/utils/files";
import { sameFileGameOrigin, serializeStoreTree, updateTabById } from "@/utils/tabs";
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

type Props = {
  tab: Tab;
  closeTab: (tabId: string) => void;
  children: React.ReactNode;
};

function isFileOrigin(
  tab: Tab,
): tab is Tab & { gameOrigin: Extract<Tab["gameOrigin"], { kind: "file" | "temp_file" }> } {
  return tab.gameOrigin.kind === "file" || tab.gameOrigin.kind === "temp_file";
}

function FileResolutionPanel({
  title,
  uncertainMessage,
  errorMessage,
  disabled,
  appendDisabled,
  showReload,
  onReload,
  onAppend,
  onClose,
  labels,
}: {
  title: string;
  uncertainMessage: string | null;
  errorMessage: string | null;
  disabled: boolean;
  appendDisabled: boolean;
  showReload: boolean;
  onReload: () => void;
  onAppend: () => void;
  onClose?: () => void;
  labels: {
    reload: string;
    append: string;
    close: string;
  };
}) {
  return (
    <Stack className={classes.panel} align="center" justify="center" h="100%" gap="sm">
      <Text>{title}</Text>
      {uncertainMessage && <Text c="dimmed">{uncertainMessage}</Text>}
      {errorMessage && <Text c="red">{errorMessage}</Text>}
      <Group>
        {showReload && (
          <Button onClick={onReload} disabled={disabled}>
            {labels.reload}
          </Button>
        )}
        <Button onClick={onAppend} disabled={disabled || appendDisabled}>
          {labels.append}
        </Button>
        {onClose && (
          <Button variant="default" onClick={onClose} disabled={disabled}>
            {labels.close}
          </Button>
        )}
      </Group>
    </Stack>
  );
}

export default function FileFreshnessGate({ tab, closeTab, children }: Props) {
  if (!isFileOrigin(tab)) return <>{children}</>;
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
  tab: Tab & { gameOrigin: Extract<Tab["gameOrigin"], { kind: "file" | "temp_file" }> };
}) {
  const { t } = useTranslation();
  const tabId = tab.value;
  const origin = tab.gameOrigin;
  const handle = origin.file.handle;
  const fileKey = fileWorkspaceKey(handle);
  const gameNumber = origin.gameNumber;
  const store = useContext(TreeStateContext)!;
  const setTabs = useSetAtom(tabsAtom);
  const jotaiStore = useJotaiStore();
  const freshness = useFileFreshness(tabId);
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

  const getTab = useCallback(
    (id: string) => jotaiStore.get(tabsAtom).find((candidate) => candidate.value === id),
    [jotaiStore],
  );
  const updateTab = useCallback(
    (id: string, update: Parameters<typeof updateTabById>[2]) => updateTabById(setTabs, id, update),
    [setTabs],
  );

  useEffect(() => {
    return () => {
      actionControllerRef.current?.abort();
      actionControllerRef.current = null;
    };
  }, [tabId, fileKey, gameNumber, store]);

  useEffect(() => {
    if (freshness.state !== "unverified") return;
    const capturedEpoch = freshness.epoch;
    const capturedRoot = store.getState().root;
    const capturedStamp = store.getState().sourceStamp;
    setPanelError(freshnessErrorMessageRef.current);
    return requestFileReconcile(tabId, async (signal) => {
      const isObsolete = () =>
        signal.aborted ||
        getFileFreshness(tabId).epoch !== capturedEpoch ||
        actionIdentityRef.current.tabId !== tabId ||
        actionIdentityRef.current.fileKey !== fileKey ||
        actionIdentityRef.current.gameNumber !== gameNumber ||
        actionIdentityRef.current.store !== store ||
        !sameFileGameOrigin((getTab(tabId) ?? tab).gameOrigin, tab.gameOrigin);
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
        store.getState().setState(tree);
        setReloadCount((count) => count + 1);
        setFileFreshness(tabId, "verified", { verifiedRevision: current.revision });
      } catch (error) {
        if (isObsolete()) return;
        const normalized = normalizeError(error);
        if (
          normalized.backendCategory === "invalid-input" ||
          normalized.backendCategory === "missing-resource" ||
          normalized.backendCategory === "conflict"
        ) {
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
    retryCount,
    tabId,
    fileKey,
    gameNumber,
    store,
    handle,
    tab,
    sourceStamp,
    getTab,
    t,
  ]);

  const beginAction = useCallback((action: "reload" | "append") => {
    if (pendingActionRef.current) return null;
    pendingActionRef.current = true;
    const controller = new AbortController();
    actionControllerRef.current = controller;
    setPendingAction(action);
    setPanelError(null);
    return controller;
  }, []);

  const endAction = useCallback((controller: AbortController) => {
    pendingActionRef.current = false;
    if (actionControllerRef.current === controller) actionControllerRef.current = null;
    if (!controller.signal.aborted) setPendingAction(null);
  }, []);

  const actionIsCurrent = useCallback(
    (controller: AbortController) => {
      if (controller.signal.aborted) return false;
      const currentTab = getTab(tabId);
      return (
        actionIdentityRef.current.tabId === tabId &&
        actionIdentityRef.current.fileKey === fileKey &&
        actionIdentityRef.current.gameNumber === gameNumber &&
        actionIdentityRef.current.store === store &&
        !!currentTab &&
        sameFileGameOrigin(currentTab.gameOrigin, tab.gameOrigin)
      );
    },
    [getTab, tabId, fileKey, gameNumber, store, tab],
  );

  const reloadFromDisk = useCallback(async (): Promise<boolean> => {
    const controller = beginAction("reload");
    if (!controller) return false;
    try {
      const loaded = await loadFileGame(handle, gameNumber, controller.signal);
      if (!actionIsCurrent(controller)) return false;
      if (!loaded.present && gameNumber < origin.file.numGames) {
        setFileFreshness(tabId, "unavailable");
        setPanelError(t("FileFreshness.GameNoLongerInFile"));
        return false;
      }
      store.getState().setState(loaded.tree);
      setReloadCount((count) => count + 1);
      setPanelError(null);
      setFileFreshness(tabId, "verified", { verifiedRevision: loaded.revision });
      return true;
    } catch (error) {
      if (!controller.signal.aborted) {
        const normalized = normalizeError(error);
        if (
          normalized.backendCategory === "invalid-input" ||
          normalized.backendCategory === "missing-resource" ||
          normalized.backendCategory === "conflict"
        ) {
          setFileFreshness(tabId, "unavailable");
        }
        setPanelError(normalized.message);
      }
      return false;
    } finally {
      endAction(controller);
    }
  }, [
    beginAction,
    endAction,
    actionIsCurrent,
    handle,
    gameNumber,
    origin.file.numGames,
    tabId,
    store,
    t,
  ]);

  const appendAsNewGame = useCallback(
    async (throwOnFailure = false): Promise<boolean> => {
      if (appendAttempted) return false;
      const controller = beginAction("append");
      if (!controller) return false;
      try {
        const selected = await pickPgnFile();
        if (!selected || !actionIsCurrent(controller)) return false;

        store.getState().setAppendAttempted(true);
        const failedTabs = tabStorage.flush();
        if (failedTabs.includes(tabId)) {
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
        if (!actionIsCurrent(controller) || written.stamp === null || written.revision === null) {
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
        const normalized = normalizeError(error);
        if (normalized.backendCategory === "stale-game") {
          store.getState().setAppendAttempted(false);
          tabStorage.flush();
          setPanelError(t("FileFreshness.AppendChanged"));
        } else {
          if (
            normalized.backendCategory === "invalid-input" ||
            normalized.backendCategory === "missing-resource" ||
            normalized.backendCategory === "conflict"
          ) {
            setFileFreshness(tabId, "unavailable");
          }
          setPanelError(normalized.message);
        }
        if (throwOnFailure) throw normalized;
        return false;
      } finally {
        endAction(controller);
      }
    },
    [appendAttempted, beginAction, endAction, actionIsCurrent, store, tabId, t, updateTab],
  );

  useEffect(
    () => registerFileConflictSave(tabId, () => appendAsNewGame(true)),
    [tabId, appendAsNewGame],
  );

  const state = freshness.state;
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

  if (state === "verified") return wrapper(children);
  if (state === "appending") {
    return wrapper(
      <Stack align="center" justify="center" h="100%" gap="sm">
        <Loader />
        <Text>{t("FileFreshness.AddingGame")}</Text>
      </Stack>,
    );
  }
  if (state === "unverified") {
    return wrapper(
      <Stack align="center" justify="center" h="100%" gap="sm">
        {errorMessage ? (
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
  if (state === "overdue") {
    return wrapper(
      <Stack align="center" justify="center" h="100%" gap="sm">
        <Text>{t("FileFreshness.FileNotResponding")}</Text>
      </Stack>,
    );
  }

  if (state === "conflict") {
    const uncertainMessage = appendAttempted ? t("FileFreshness.AppendMayHaveBeenAdded") : null;
    return wrapper(
      <FileResolutionPanel
        title={t("FileFreshness.Changed")}
        uncertainMessage={uncertainMessage}
        errorMessage={errorMessage}
        disabled={disabled}
        appendDisabled={appendAttempted}
        showReload
        onReload={() => void reloadFromDisk()}
        onAppend={() => void appendAsNewGame()}
        labels={{
          reload: t("FileFreshness.ReloadFromDisk"),
          append: t("FileFreshness.SaveAsNewGame"),
          close: t("FileFreshness.CloseTab"),
        }}
      />,
    );
  }

  const uncertainMessage = appendAttempted ? t("FileFreshness.AppendMayHaveBeenAdded") : null;
  return wrapper(
    <FileResolutionPanel
      title={t("FileFreshness.Unavailable")}
      uncertainMessage={uncertainMessage}
      errorMessage={errorMessage}
      disabled={disabled}
      appendDisabled={appendAttempted}
      showReload={appendAttempted}
      onReload={() => void reloadFromDisk()}
      onAppend={() => void appendAsNewGame()}
      onClose={() => closeTab(tabId)}
      labels={{
        reload: t("FileFreshness.ReloadFromDisk"),
        append: t("FileFreshness.SaveAsNewGame"),
        close: t("FileFreshness.CloseTab"),
      }}
    />,
  );
}
