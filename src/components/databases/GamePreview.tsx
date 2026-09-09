import { Box, Group, Stack } from "@mantine/core";
import { useElementSize } from "@mantine/hooks";
import { useContext } from "react";
import useSWRImmutable from "swr/immutable";
import { useStore } from "zustand";
import { Chessground } from "@/chessground/Chessground";
import { useTranslation } from "react-i18next";
import { notifyUnlessCancelled } from "@/components/files/notifyError";
import { useNativeRequestOwner } from "@/hooks/useNativeRequestOwner";
import { parsePGN } from "@/utils/chess";
import { type GameHeaders, getNodeAtPath, type TreeState } from "@/utils/treeReducer";
import GameNotation from "../common/GameNotation";
import MoveControls from "../common/MoveControls";
import OpeningName from "../common/OpeningName";
import { TreeStateContext, TreeStateProvider } from "../common/TreeStateContext";

function GamePreviewWrapper({
  pgn,
  headers,
  hideControls,
  showOpening,
}: {
  pgn: string;
  headers?: GameHeaders;
  hideControls?: boolean;
  showOpening?: boolean;
}) {
  const { t } = useTranslation();
  const requestKey = [pgn, headers?.fen] as const;
  const requestOwner = useNativeRequestOwner(requestKey);
  const { data: parsedGame } = useSWRImmutable(requestKey, async ([p, fen]) => {
    return await requestOwner!.run(async (signal) => {
      try {
        return await parsePGN(p, fen, { signal });
      } catch (error) {
        if (!signal.aborted) {
          notifyUnlessCancelled(t("Common.Error"), error);
        }
        throw error;
      }
    });
  });

  return (
    <>
      {parsedGame && (
        <GamePreview
          key={pgn}
          game={parsedGame}
          hideControls={hideControls}
          showOpening={showOpening}
        />
      )}
    </>
  );
}

function GamePreview({
  game,
  hideControls,
  showOpening,
}: {
  game: TreeState;
  hideControls?: boolean;
  showOpening?: boolean;
}) {
  const { ref: boardRef, height } = useElementSize();

  return (
    <TreeStateProvider initial={game}>
      {showOpening && <OpeningName />}
      <Group align="end" grow style={{ overflow: "hidden", height: "100%" }}>
        <Box ref={boardRef}>
          <PreviewBoard />
        </Box>
        {!hideControls && (
          <Stack style={{ height }} gap="xs">
            <GameNotation />
            <MoveControls readOnly />
          </Stack>
        )}
      </Group>
    </TreeStateProvider>
  );
}

function PreviewBoard() {
  const store = useContext(TreeStateContext)!;
  const goToNext = useStore(store, (s) => s.goToNext);
  const goToPrevious = useStore(store, (s) => s.goToPrevious);
  const root = useStore(store, (s) => s.root);
  const position = useStore(store, (s) => s.position);
  const headers = useStore(store, (s) => s.headers);
  const node = getNodeAtPath(root, position);
  const fen = node.fen;

  return (
    <Box
      onWheel={(e) => {
        if (e.deltaY > 0) {
          goToNext();
        } else {
          goToPrevious();
        }
      }}
    >
      <Chessground
        coordinates={false}
        viewOnly={true}
        fen={fen}
        orientation={headers.orientation || "white"}
      />
    </Box>
  );
}

export default GamePreviewWrapper;
