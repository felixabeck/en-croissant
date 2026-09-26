import { tauri } from "@/platform/tauri";
import { Badge, Box, Divider, Group, Stack, Text } from "@mantine/core";
import { IconZoomCheck } from "@tabler/icons-react";
import { useNavigate } from "@tanstack/react-router";
import { useAtom } from "jotai";
import { useEffect, useRef, useState } from "react";
import { useElementSize } from "@mantine/hooks";
import { useTranslation } from "react-i18next";
import { errorUnlessCancelled } from "@/platform/errors";
import { notifyUnlessCancelled } from "@/components/files/notifyError";
import { tabsAtom } from "@/state/atoms";
import { IconAction } from "@/components/common/IconAction";
import { openFile } from "@/utils/files";
import { runTabCreation } from "@/utils/tabs";
import { capitalize, formatNumber } from "@/utils/format";
import { fileWorkspaceKey } from "@/utils/pathCapabilities";
import GamePreview from "../databases/GamePreview";
import GameSelector, { type GameSelectorRow } from "../panels/info/GameSelector";
import type { FileMetadata } from "./file";

// Below this card width the preview's move list has no room beside the board. In rem, because the
// list's needs grow with the font scale while a window width in px does not.
const PREVIEW_CONTROLS_MIN_WIDTH_REM = 26;
const GAME_LIST_MIN_HEIGHT = "8rem";

function rootFontSizePx() {
  return Number.parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
}

// The parent keys this card by the handle key, so a different file remounts it (resetting the
// page and the game-name cache) while a relisted copy of the same file keeps both.
function FileCard({ selected }: { selected: FileMetadata }) {
  const { t } = useTranslation();

  const [, setTabs] = useAtom(tabsAtom);
  const navigate = useNavigate();

  const [selectedGame, setSelectedGame] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [games, setGames] = useState<Map<number, GameSelectorRow>>(new Map());
  // Two handles with the same key are the same file, so a new handle object must not retrigger the read.
  const handleRef = useRef(selected.handle);
  handleRef.current = selected.handle;
  const handleKey = fileWorkspaceKey(selected.handle);
  const { ref: cardRef, width: cardWidth } = useElementSize();
  const narrow = cardWidth < PREVIEW_CONTROLS_MIN_WIDTH_REM * rootFontSizePx();

  // Keyed by the handle, not the entry object: a relisting must not re-read the same file.
  useEffect(() => {
    const controller = new AbortController();
    async function loadGames() {
      try {
        const data = await tauri.readGames(handleRef.current, page, page, {
          signal: controller.signal,
        });
        if (!controller.signal.aborted) {
          setSelectedGame(data[0]?.pgn ?? null);
        }
      } catch (error) {
        if (controller.signal.aborted) return;
        if (errorUnlessCancelled(error) === null) return;
        notifyUnlessCancelled(t("Common.Error"), error);
      }
    }
    void loadGames();
    return () => {
      controller.abort();
    };
  }, [handleKey, page, t]);

  function openGame() {
    void runTabCreation({
      create: () =>
        openFile(selected, setTabs, {
          gameNumber: page,
        }),
      onSuccess: () => navigate({ to: "/" }),
      onError: (error) => notifyUnlessCancelled(t("Common.Error"), error),
    });
  }

  return (
    <Stack h="100%" ref={cardRef}>
      <Stack align="center">
        <Text ta="center" fz="xl" fw="bold" miw={0} style={{ overflowWrap: "anywhere" }}>
          {selected?.name}
        </Text>
        <Badge>{t(`Files.FileType.${capitalize(selected.metadata.type)}`)}</Badge>
      </Stack>
      <Divider />

      {/* Not `grow`: equal thirds leave each part 17px wide at 320px and a 200% font scale. */}
      <Group align="center" justify="space-between" wrap="wrap" px="xs" miw={0}>
        <IconAction label={t("Common.Open")} size="sm" onClick={openGame}>
          <IconZoomCheck />
        </IconAction>
        <Text ta="center" c="dimmed" miw={0}>
          {t("Files.GameCountSuffix", {
            count: selected.numGames,
            number: formatNumber(selected.numGames),
          })}
        </Text>
      </Group>

      {selectedGame && (
        <>
          {/* Both parts share what the header leaves, by ratio, from a zero basis: a fixed preview
              share once left the list two rows in a short window. The floor keeps ~4 rows. */}
          <Box flex="2 1 0" mih={GAME_LIST_MIN_HEIGHT}>
            <Divider />
            <GameSelector
              setGames={setGames}
              games={games}
              activePage={page}
              path={selected.handle}
              setPage={setPage}
              total={selected.numGames}
            />
            <Divider />
          </Box>
          <Box flex="3 1 0" mih={0} px="xs" pb="xs">
            <GamePreview pgn={selectedGame} hideControls={narrow} fitHeight />
          </Box>
        </>
      )}
    </Stack>
  );
}

export default FileCard;
