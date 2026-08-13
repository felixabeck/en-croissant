import { tauri } from "@/platform/tauri";
import { Box, Group, ScrollArea, Text } from "@mantine/core";
import { useToggle } from "@mantine/hooks";
import { IconX } from "@tabler/icons-react";
import { useVirtualizer } from "@tanstack/react-virtual";
import cx from "clsx";
import { useAtomValue } from "jotai";
import { useCallback, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import type { FileWorkspaceHandle } from "@/bindings";
import ConfirmModal from "@/components/common/ConfirmModal";
import { IconAction } from "@/components/common/IconAction";
import { useVirtualPageLoader } from "@/hooks/useVirtualPageLoader";
import { fontSizeAtom } from "@/state/atoms";
import { parsePGN } from "@/utils/chess";
import { formatNumber } from "@/utils/format";
import { getGameName } from "@/utils/treeReducer";
import classes from "./GameSelector.module.css";

export default function GameSelector({
  games,
  setGames,
  setPage,
  total,
  path,
  activePage,
  deleteGame,
}: {
  games: Map<number, string>;
  setGames: React.Dispatch<React.SetStateAction<Map<number, string>>>;
  setPage: (v: number) => void;
  total: number;
  path: FileWorkspaceHandle;
  activePage: number;
  deleteGame?: (index: number) => void;
}) {
  const loadPage = useCallback(
    async (startIndex: number, stopIndex: number) => {
      const data = await tauri.readGames(path, startIndex, stopIndex);
      return await Promise.all(
        data.map(async (game, index) => {
          const { headers } = await parsePGN(game);
          return [startIndex + index, getGameName(headers)] as const;
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
            setGames={setGames}
            setPage={setPage}
            deleteGame={deleteGame}
            activePage={activePage}
            path={path}
            total={total}
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
  game: string | undefined;
  setGames: (v: Map<number, string>) => void;
  setPage: (v: number) => void;
  path: FileWorkspaceHandle;
  total: number;
  activePage: number;
  deleteGame?: (indxe: number) => void;
}) {
  const { t } = useTranslation();
  const [deleteModal, toggleDelete] = useToggle();

  return (
    <>
      {deleteGame && (
        <ConfirmModal
          title={t("Files.RemoveGame")}
          description={t("Files.RemoveGameConfirm")}
          opened={deleteModal}
          onClose={toggleDelete}
          onConfirm={() => {
            deleteGame(index);
            toggleDelete();
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
          {game || "..."}
        </Text>
        {deleteGame && (
          <IconAction
            label={t("Files.RemoveGame")}
            onClick={(e) => {
              e.stopPropagation();
              toggleDelete();
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
