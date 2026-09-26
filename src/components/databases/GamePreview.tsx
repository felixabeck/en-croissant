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

type PreviewLayout = {
  hideControls?: boolean;
  showOpening?: boolean;
  /** The parent gives the preview a definite height and the board must fit inside it. */
  fitHeight?: boolean;
};

function GamePreviewWrapper({
  pgn,
  headers,
  ...layout
}: {
  pgn: string;
  headers?: GameHeaders;
} & PreviewLayout) {
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

  return <>{parsedGame && <GamePreview key={pgn} game={parsedGame} {...layout} />}</>;
}

function GamePreview({
  game,
  hideControls,
  showOpening,
  fitHeight,
}: { game: TreeState } & PreviewLayout) {
  const { ref: boardRef, height } = useElementSize();
  const { ref: frameRef, width: frameWidth, height: frameHeight } = useElementSize();
  // The board is square, so sized by its width alone it overflows a short frame, and the frame's
  // `overflow: hidden` then cuts off the lower ranks and the move controls beside it.
  const boardSide = Math.min(frameHeight, hideControls ? frameWidth : frameWidth / 2);

  return (
    <TreeStateProvider initial={game}>
      {showOpening && <OpeningName />}
      <Group
        ref={frameRef}
        // Top-aligned when fitting: a board limited by a narrow width then sits under the list
        // instead of below an empty band.
        align={fitHeight ? "start" : "end"}
        grow={!fitHeight}
        wrap={fitHeight ? "nowrap" : undefined}
        style={{ overflow: "hidden", height: "100%" }}
      >
        <Box
          ref={boardRef}
          // A measured px width, not Mantine's `w`, which reads a number as rem and so doubles it
          // at a 200% font scale.
          style={fitHeight ? { width: boardSide, flex: "none" } : undefined}
        >
          <PreviewBoard />
        </Box>
        {!hideControls && (
          <Stack
            style={{ height }}
            gap="xs"
            flex={fitHeight ? 1 : undefined}
            miw={fitHeight ? 0 : undefined}
          >
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
