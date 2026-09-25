import { tauri } from "@/platform/tauri";
import { Box, Group, ScrollArea, Text } from "@mantine/core";
import { useToggle } from "@mantine/hooks";
import { IconX } from "@tabler/icons-react";
import { useVirtualizer } from "@tanstack/react-virtual";
import cx from "clsx";
import { useAtomValue } from "jotai";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { FileWorkspaceHandle, StampedGame } from "@/bindings";
import ConfirmModal from "@/components/common/ConfirmModal";
import { IconAction } from "@/components/common/IconAction";
import { useVirtualPageLoader } from "@/hooks/useVirtualPageLoader";
import { fontSizeAtom } from "@/state/atoms";
import { parsePGN } from "@/utils/chess";
import { formatNumber } from "@/utils/format";
import { getGameName } from "@/utils/treeReducer";
import classes from "./GameSelector.module.css";

export type GameSelectorRow = {
  name: string;
  identity?: Pick<StampedGame, "stamp" | "revision">;
};

export type DeleteGameSnapshot = { index: number; stamp: string; revision: string };

type DeleteGame = (snapshot: DeleteGameSnapshot) => void | Promise<void>;

export default function GameSelector({
  games,
  setGames,
  setPage,
  total,
  path,
  activePage,
  deleteGame,
}: {
  games: Map<number, GameSelectorRow>;
  setGames: React.Dispatch<React.SetStateAction<Map<number, GameSelectorRow>>>;
  setPage: (v: number) => void;
  total: number;
  path: FileWorkspaceHandle;
  activePage: number;
  deleteGame?: DeleteGame;
}) {
  const loadPage = useCallback(
    async (startIndex: number, stopIndex: number, options?: { signal?: AbortSignal }) => {
      const data = await tauri.readGames(path, startIndex, stopIndex, options);
      return await Promise.all(
        data.map(async (game, index) => {
          const { headers } = await parsePGN(game.pgn, undefined, options);
          return [
            startIndex + index,
            {
              name: getGameName(headers),
              identity: game.present ? { stamp: game.stamp, revision: game.revision } : undefined,
            },
          ] as const;
        }),
      );
    },
    [path],
  );
  const loadMoreRows = useVirtualPageLoader(path.id.id, loadPage, (startIndex, entries) => {
    setGames((previous) => {
      const next = new Map(previous);
      for (const [index, name] of entries) next.set(index, name);
      return next;
    });
  });

  const fontSize = useAtomValue(fontSizeAtom);

  const parentRef = useRef<HTMLDivElement>(null);
  const rowVirtualizer = useVirtualizer({
    count: total,
    estimateSize: () => 30 * (fontSize / 100),
    getScrollElement: () => parentRef.current!,
  });
  const virtualItems = rowVirtualizer.getVirtualItems();
  // React Virtual returns a fresh array on each read.  Effects depend only on
  // this stable primitive range, not on the ephemeral array/getter result.
  const visibleStart = virtualItems[0]?.index ?? -1;
  const visibleEnd = virtualItems.at(-1)?.index ?? -1;

  useEffect(() => {
    if (games.size === 0) {
      void loadMoreRows(0, Math.min(10, total - 1));
    }
    if (visibleStart >= 0 && visibleEnd >= visibleStart) {
      let hasUnloadedRow = false;
      for (let index = visibleStart; index <= visibleEnd; index += 1) {
        if (!games.has(index)) {
          hasUnloadedRow = true;
          break;
        }
      }
      if (hasUnloadedRow) void loadMoreRows(visibleStart, visibleEnd);
    }
  }, [games, loadMoreRows, total, visibleStart, visibleEnd]);

  return (
    <ScrollArea viewportRef={parentRef} h="100%">
      <Box
        style={{
          height: rowVirtualizer.getTotalSize(),
          width: "100%",
          position: "relative",
        }}
      >
        {rowVirtualizer.getVirtualItems().map((virtualRow) => (
          <GameRow
            key={virtualRow.index}
            index={virtualRow.index}
            game={games.get(virtualRow.index)}
            setPage={setPage}
            deleteGame={deleteGame}
            activePage={activePage}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: virtualRow.size,
              transform: `translateY(${virtualRow.start}px)`,
            }}
          />
        ))}
      </Box>
    </ScrollArea>
  );
}

function GameRow({
  style,
  index,
  game,
  setPage,
  activePage,
  deleteGame,
}: {
  style?: React.CSSProperties;
  index: number;
  game: GameSelectorRow | undefined;
  setPage: (v: number) => void;
  activePage: number;
  deleteGame?: DeleteGame;
}) {
  const { t } = useTranslation();
  const [deleteModal, toggleDelete] = useToggle();
  const [deleteSnapshot, setDeleteSnapshot] = useState<DeleteGameSnapshot | null>(null);
  const canDelete = !!game?.identity?.stamp && !!game.identity.revision;

  return (
    <>
      {deleteGame && (
        <ConfirmModal
          title={t("Files.RemoveGame")}
          description={t("Files.RemoveGameConfirm")}
          opened={deleteModal}
          onClose={() => {
            toggleDelete(false);
            setDeleteSnapshot(null);
          }}
          onConfirm={() => {
            if (!deleteSnapshot) throw new Error("Deletion confirmation has no game snapshot");
            return deleteGame(deleteSnapshot);
          }}
        />
      )}
      <Group
        style={style}
        justify="space-between"
        wrap="nowrap"
        gap="xs"
        className={cx(classes.row, {
          [classes.active]: index === activePage,
        })}
        onClick={() => {
          setPage(index);
        }}
      >
        <Text fz="xs" className={classes.index}>
          {formatNumber(index + 1)}
        </Text>
        <Text fz="sm" truncate flex={1} lh="sm">
          {game?.name || "..."}
        </Text>
        {deleteGame && (
          <IconAction
            label={t("Files.RemoveGame")}
            disabled={!canDelete}
            onClick={(event) => {
              event.stopPropagation();
              if (!game?.identity) return;
              setDeleteSnapshot({ index, ...game.identity });
              toggleDelete(true);
            }}
            variant="subtle"
            color="red"
            size="xs"
            mr="xs"
            className={classes.deleteBtn}
          >
            <IconX size={12} />
          </IconAction>
        )}
      </Group>
    </>
  );
}
