import { Stack } from "@mantine/core";
import {
  IconArrowBack,
  IconCamera,
  IconDeviceFloppy,
  IconEdit,
  IconEditOff,
  IconEraser,
  IconSwitchVertical,
  IconTarget,
  IconZoomCheck,
} from "@tabler/icons-react";
import { tauri } from "@/platform/tauri";
import domtoimage from "dom-to-image";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { memo, useContext } from "react";
import { useTranslation } from "react-i18next";
import { useStore } from "zustand";
import { TreeStateContext } from "@/components/common/TreeStateContext";
import IconAction from "@/components/common/IconAction";
import {
  autoSaveAtom,
  currentGameStateAtom,
  currentTabAtom,
  eraseDrawablesOnClickAtom,
} from "@/state/atoms";
import { keyMapAtom } from "@/state/keybinds";

interface BoardControlsProps {
  editingMode: boolean;
  toggleEditingMode: () => void;
  dirty: boolean;
  saveFile?: () => void;
  canTakeBack?: boolean;
  onTakeBack?: () => void;
  takeBackPending?: boolean;
  disableVariations?: boolean;
  allowEditing?: boolean;
}

function BoardControls({
  editingMode,
  toggleEditingMode,
  dirty,
  saveFile,
  canTakeBack,
  onTakeBack,
  takeBackPending,
  disableVariations,
  allowEditing,
}: BoardControlsProps) {
  const { t } = useTranslation();
  const store = useContext(TreeStateContext)!;
  const headers = useStore(store, (s) => s.headers);
  const root = useStore(store, (s) => s.root);
  const setHeaders = useStore(store, (s) => s.setHeaders);
  const clearShapes = useStore(store, (s) => s.clearShapes);

  const keyMap = useAtomValue(keyMapAtom);
  const [currentTab, setCurrentTab] = useAtom(currentTabAtom);
  const setGameState = useSetAtom(currentGameStateAtom);
  const autoSave = useAtomValue(autoSaveAtom);
  const eraseDrawablesOnClick = useAtomValue(eraseDrawablesOnClickAtom);

  const orientation = headers.orientation || "white";
  const toggleOrientation = () =>
    setHeaders({
      ...headers,
      fen: root.fen,
      orientation: orientation === "black" ? "white" : "black",
    });

  function changeTabType() {
    setCurrentTab((t) => {
      if (t.type === "analysis") {
        setGameState("settingUp");
      }
      return {
        ...t,
        type: t.type === "analysis" ? "play" : "analysis",
      };
    });
  }

  const takeSnapshot = async () => {
    const snapshotTarget = document.querySelector(".cg-wrap") as HTMLElement | null;
    if (!snapshotTarget) return;

    domtoimage.toBlob(snapshotTarget).then(async (blob) => {
      if (blob == null) return;

      const arrayBuffer = await blob.arrayBuffer();
      await tauri.saveBoardSnapshot(Array.from(new Uint8Array(arrayBuffer)));
    });
  };

  return (
    <Stack gap={4} align="center">
      <IconAction label={t("Board.Action.TakeSnapshot")} onClick={() => takeSnapshot()}>
        <IconCamera size="1.2rem" />
      </IconAction>
      {canTakeBack && onTakeBack && (
        <IconAction
          label={t("Board.Action.TakeBack", { defaultValue: "Take back" })}
          onClick={() => onTakeBack()}
          pending={takeBackPending}
        >
          <IconArrowBack />
        </IconAction>
      )}
      <IconAction
        label={t(
          currentTab?.type === "analysis"
            ? "Board.Action.PlayFromHere"
            : "Board.Action.AnalyzeGame",
        )}
        onClick={changeTabType}
      >
        {currentTab?.type === "analysis" ? (
          <IconTarget size="1.2rem" />
        ) : (
          <IconZoomCheck size="1.2rem" />
        )}
      </IconAction>
      {!eraseDrawablesOnClick && (
        <IconAction label={t("Board.Action.ClearDrawings")} onClick={() => clearShapes()}>
          <IconEraser size="1.2rem" />
        </IconAction>
      )}
      {(!disableVariations || allowEditing) && (
        <IconAction
          label={t("Board.Action.EditPosition")}
          onClick={() => toggleEditingMode()}
          pressed={editingMode}
        >
          {editingMode ? <IconEditOff size="1.2rem" /> : <IconEdit size="1.2rem" />}
        </IconAction>
      )}

      {saveFile && (
        <IconAction
          label={t("Board.Action.SavePGN", { key: keyMap.SAVE_FILE.keys })}
          onClick={() => saveFile()}
          variant={dirty && !autoSave ? "default" : "transparent"}
        >
          <IconDeviceFloppy size="1.2rem" />
        </IconAction>
      )}
      <IconAction
        label={t("Board.Action.FlipBoard", {
          key: keyMap.SWAP_ORIENTATION.keys,
        })}
        onClick={() => toggleOrientation()}
      >
        <IconSwitchVertical size="1.2rem" />
      </IconAction>
    </Stack>
  );
}

export default memo(BoardControls);
