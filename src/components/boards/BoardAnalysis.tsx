import { tauri } from "@/platform/tauri";
import { normalizeError } from "@/platform/errors";
import { notifyUnlessCancelled } from "@/components/files/notifyError";
import { Paper, Portal, Stack, Tabs } from "@mantine/core";
import { useHotkeys, useToggle } from "@mantine/hooks";
import {
  IconDatabase,
  IconInfoCircle,
  IconNotes,
  IconTargetArrow,
  IconZoomCheck,
} from "@tabler/icons-react";
import type { Piece } from "chessops";
import { useAtom, useAtomValue, useSetAtom, useStore as useJotaiStore } from "jotai";
import { useCallback, useContext, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useStore } from "zustand";
import {
  allEnabledAtom,
  autoSaveAtom,
  currentAnalysisTabAtom,
  currentPracticeTabAtom,
  currentReportModalOpenAtom,
  currentTabAtom,
  currentTabSelectedAtom,
  enableAllAtom,
  practiceMoveControllerAtom,
  practiceStateAtom,
  tabsAtom,
} from "@/state/atoms";
import { keyMapAtom } from "@/state/keybinds";
import { defaultPGN } from "@/utils/chess";
import { getTabFile, saveToFile, updateTabById } from "@/utils/tabs";
import { fileWorkspaceKey } from "@/utils/pathCapabilities";
import { setFileFreshness } from "@/state/fileFreshness";
import DetachedEval from "../common/DetachedEval";
import GameNotation from "../common/GameNotation";
import MoveControls from "../common/MoveControls";
import { TreeStateContext } from "../common/TreeStateContext";
import AnalysisPanel from "../panels/analysis/AnalysisPanel";
import AnnotationPanel from "../panels/annotation/AnnotationPanel";
import DatabasePanel from "../panels/database/DatabasePanel";
import InfoPanel from "../panels/info/InfoPanel";
import PracticePanel from "../panels/practice/PracticePanel";
import Board from "./Board";
import BoardControls from "./BoardControls";
import EditingCard from "./EditingCard";
import EvalListener from "./EvalListener";
import ConfirmChangesModal from "@/components/tabs/ConfirmChangesModal";

function BoardAnalysis() {
  const { t } = useTranslation();

  const [editingMode, toggleEditingMode] = useToggle();
  const [selectedPiece, setSelectedPiece] = useState<Piece | null>(null);
  const currentTab = useAtomValue(currentTabAtom);
  const setTabs = useSetAtom(tabsAtom);
  const jotaiStore = useJotaiStore();
  const [addGameConfirm, setAddGameConfirm] = useState(false);
  const tabFile = getTabFile(currentTab);
  const hasPersistentOrigin = currentTab?.gameOrigin.kind !== "none";
  const autoSave = useAtomValue(autoSaveAtom);
  const boardRef = useRef(null);

  const store = useContext(TreeStateContext)!;

  const dirty = useStore(store, (s) => s.dirty);

  const clearShapes = useStore(store, (s) => s.clearShapes);
  const setAnnotation = useStore(store, (s) => s.setAnnotation);

  const updateTab = useCallback(
    (tabId: string, update: Parameters<typeof updateTabById>[2]) =>
      updateTabById(setTabs, tabId, update),
    [setTabs],
  );
  const getTab = useCallback(
    (tabId: string) => jotaiStore.get(tabsAtom).find((tab) => tab.value === tabId),
    [jotaiStore],
  );

  const saveFile = useCallback(async () => {
    await saveToFile({
      updateTab,
      getTab,
      tab: currentTab,
      store,
    });
  }, [updateTab, getTab, currentTab, store]);
  const userSaveFile = useCallback(async () => {
    const result = await saveToFile({
      updateTab,
      getTab,
      tab: currentTab,
      store,
      isUserSave: true,
    });
    if (typeof result === "object" && result.status === "failed") {
      notifyUnlessCancelled(t("Common.Error"), result.error);
    } else if (result === "superseded") {
      notifyUnlessCancelled(t("Common.Error"), {
        category: "validation",
        message: t("Tab.SaveSuperseded"),
      });
    }
  }, [updateTab, getTab, currentTab, store, t]);
  useEffect(() => {
    if (hasPersistentOrigin && autoSave && dirty) {
      saveFile();
    }
  }, [hasPersistentOrigin, saveFile, autoSave, dirty]);

  const appendGame = useCallback(async () => {
    if (
      !currentTab ||
      (currentTab.gameOrigin.kind !== "file" && currentTab.gameOrigin.kind !== "temp_file")
    ) {
      return;
    }
    const tabId = currentTab.value;
    const origin = currentTab.gameOrigin;
    const gameNumber = origin.file.numGames;
    setFileFreshness(tabId, "appending");
    try {
      await tauri.writeGame(origin.file.handle, gameNumber, defaultPGN(), { kind: "append" });
      const latest = getTab(tabId);
      if (
        latest &&
        (latest.gameOrigin.kind === "file" || latest.gameOrigin.kind === "temp_file") &&
        latest.gameOrigin.gameNumber === origin.gameNumber &&
        fileWorkspaceKey(latest.gameOrigin.file.handle) === fileWorkspaceKey(origin.file.handle)
      ) {
        updateTab(tabId, (previous) => ({
          ...previous,
          gameOrigin: {
            kind: "file",
            gameNumber,
            file: { ...origin.file, numGames: gameNumber + 1 },
          },
        }));
      }
      if (getTab(tabId)) setFileFreshness(tabId, "unverified");
    } catch (error) {
      const normalized = normalizeError(error);
      const latest = getTab(tabId);
      if (latest && (latest.gameOrigin.kind === "file" || latest.gameOrigin.kind === "temp_file")) {
        try {
          const count = await tauri.countPgnGames(latest.gameOrigin.file.handle);
          updateTab(tabId, (previous) => {
            if (previous.gameOrigin.kind !== "file" && previous.gameOrigin.kind !== "temp_file") {
              return previous;
            }
            return {
              ...previous,
              gameOrigin: {
                ...previous.gameOrigin,
                file: { ...previous.gameOrigin.file, numGames: count },
              },
            };
          });
        } catch {
          // Preserve the typed write failure; a later listing refreshes the count.
        }
      }
      if (getTab(tabId)) setFileFreshness(tabId, "unverified");
      if (normalized.backendCategory === "stale-game") {
        notifyUnlessCancelled(t("Common.Error"), {
          category: "validation",
          message: t("FileFreshness.AddGameChanged"),
        });
      } else {
        notifyUnlessCancelled(t("Common.Error"), {
          ...normalized,
          message: `${t("FileFreshness.AddGameMayHaveBeenAdded")} ${normalized.message}`,
        });
      }
    }
  }, [currentTab, getTab, updateTab, t]);

  const addGame = useCallback(() => {
    if (!tabFile || !currentTab) return;
    if (store.getState().dirty) {
      setAddGameConfirm(true);
      return;
    }
    void appendGame();
  }, [tabFile, currentTab, store, appendGame]);

  const [, enable] = useAtom(enableAllAtom);
  const allEnabled = useAtomValue(allEnabledAtom);

  const keyMap = useAtomValue(keyMapAtom);

  const [, setAnalysisTab] = useAtom(currentAnalysisTabAtom);
  const [currentTabSelected, setCurrentTabSelected] = useAtom(currentTabSelectedAtom);
  const [, setReportModalOpen] = useAtom(currentReportModalOpenAtom);
  const practiceTabSelected = useAtomValue(currentPracticeTabAtom);
  const isRepertoire = tabFile?.metadata.type === "repertoire";
  const practicing = currentTabSelected === "practice" && practiceTabSelected === "train";
  const practiceState = useAtomValue(practiceStateAtom);
  const practiceMoveController = useAtomValue(practiceMoveControllerAtom);
  const isPracticeRating = practicing && practiceState.phase === "correct";

  const setPracticePath = useStore(store, (s) => s.setPracticePath);
  useEffect(() => {
    if (!practicing) {
      setPracticePath(null);
    }
  }, [practicing, setPracticePath]);

  useHotkeys([
    [keyMap.SAVE_FILE.keys, () => userSaveFile()],
    [keyMap.CLEAR_SHAPES.keys, () => clearShapes()],
  ]);
  useHotkeys([
    [keyMap.ANNOTATION_BRILLIANT.keys, () => !isPracticeRating && setAnnotation("!!")],
    [keyMap.ANNOTATION_GOOD.keys, () => !isPracticeRating && setAnnotation("!")],
    [keyMap.ANNOTATION_INTERESTING.keys, () => !isPracticeRating && setAnnotation("!?")],
    [keyMap.ANNOTATION_DUBIOUS.keys, () => !isPracticeRating && setAnnotation("?!")],
    [keyMap.ANNOTATION_MISTAKE.keys, () => !isPracticeRating && setAnnotation("?")],
    [keyMap.ANNOTATION_BLUNDER.keys, () => !isPracticeRating && setAnnotation("??")],
    [
      keyMap.PRACTICE_TAB.keys,
      () => {
        if (isRepertoire) setCurrentTabSelected("practice");
      },
    ],
    [keyMap.ANALYSIS_TAB.keys, () => setCurrentTabSelected("analysis")],
    [
      keyMap.GENERATE_REPORT.keys,
      (e) => {
        setCurrentTabSelected("analysis");
        setAnalysisTab("report");
        setReportModalOpen(true);
        e.preventDefault();
      },
    ],
    [keyMap.DATABASE_TAB.keys, () => setCurrentTabSelected("database")],
    [keyMap.ANNOTATE_TAB.keys, () => setCurrentTabSelected("annotate")],
    [keyMap.INFO_TAB.keys, () => setCurrentTabSelected("info")],
    [
      keyMap.TOGGLE_ALL_ENGINES.keys,
      (e) => {
        enable(!allEnabled);
        e.preventDefault();
      },
    ],
  ]);

  return (
    <>
      <ConfirmChangesModal
        opened={addGameConfirm}
        toggle={() => setAddGameConfirm(false)}
        tab={currentTab}
        updateTab={updateTab}
        preserveChanges
        onSaved={() => {
          setAddGameConfirm(false);
          void appendGame();
        }}
      />
      <EvalListener />
      <Portal target="#left" style={{ height: "100%" }}>
        <Board
          practiceMove={practicing ? (practiceMoveController ?? undefined) : undefined}
          editingMode={editingMode}
          boardRef={boardRef}
          selectedPiece={selectedPiece}
        />
      </Portal>
      <Portal target="#topRight" style={{ height: "100%" }}>
        <Paper
          withBorder
          style={{
            height: "100%",
          }}
          pos="relative"
        >
          <Tabs
            w="100%"
            h="100%"
            value={currentTabSelected}
            onChange={(v) => setCurrentTabSelected(v || "info")}
            keepMounted={false}
            activateTabWithKeyboard={false}
            style={{
              display: "flex",
              flexDirection: "column",
            }}
            styles={{
              tabLabel: {
                flex: 0,
              },
              tab: {
                display: "flex",
                justifyContent: "center",
                gap: "0.3rem",
              },
            }}
          >
            <Tabs.List grow>
              {isRepertoire && (
                <Tabs.Tab value="practice" leftSection={<IconTargetArrow size="1rem" />}>
                  {t("Board.Tabs.Practice")}
                </Tabs.Tab>
              )}
              <Tabs.Tab value="analysis" leftSection={<IconZoomCheck size="1rem" />}>
                {t("Board.Tabs.Analysis")}
              </Tabs.Tab>
              <Tabs.Tab value="database" leftSection={<IconDatabase size="1rem" />}>
                {t("Board.Tabs.Database")}
              </Tabs.Tab>
              <Tabs.Tab value="annotate" leftSection={<IconNotes size="1rem" />}>
                {t("Board.Tabs.Annotate")}
              </Tabs.Tab>
              <Tabs.Tab value="info" leftSection={<IconInfoCircle size="1rem" />}>
                {t("Board.Tabs.Info")}
              </Tabs.Tab>
            </Tabs.List>
            {isRepertoire && (
              <Tabs.Panel value="practice" flex={1} style={{ overflowY: "hidden" }}>
                <PracticePanel />
              </Tabs.Panel>
            )}
            <Tabs.Panel value="info" flex={1} style={{ overflowY: "hidden" }}>
              <InfoPanel addGame={addGame} />
            </Tabs.Panel>
            <Tabs.Panel value="database" flex={1} style={{ overflowY: "hidden" }}>
              <DatabasePanel />
            </Tabs.Panel>
            <Tabs.Panel value="annotate" flex={1} style={{ overflowY: "hidden" }}>
              <AnnotationPanel />
            </Tabs.Panel>
            <Tabs.Panel value="analysis" flex={1} style={{ overflowY: "hidden" }}>
              <AnalysisPanel />
            </Tabs.Panel>
          </Tabs>
        </Paper>
      </Portal>
      <Portal target="#bottomRight" style={{ height: "100%" }}>
        {editingMode ? (
          <EditingCard
            boardRef={boardRef}
            setEditingMode={toggleEditingMode}
            selectedPiece={selectedPiece}
            setSelectedPiece={setSelectedPiece}
          />
        ) : (
          <Stack h="100%" gap="xs">
            <DetachedEval />
            <GameNotation
              topBar
              controls={
                <BoardControls
                  editingMode={editingMode}
                  toggleEditingMode={toggleEditingMode}
                  dirty={dirty}
                  saveFile={userSaveFile}
                />
              }
            />
            <MoveControls />
          </Stack>
        )}
      </Portal>
    </>
  );
}

export default BoardAnalysis;
