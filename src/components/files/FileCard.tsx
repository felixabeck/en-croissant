import { tauri } from "@/platform/tauri";
import { Badge, Box, Divider, Group, Stack, Text } from "@mantine/core";
import { IconZoomCheck } from "@tabler/icons-react";
import { useNavigate } from "@tanstack/react-router";
import { useAtom } from "jotai";
import { useEffect, useRef, useState } from "react";
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
import GameSelector from "../panels/info/GameSelector";
import type { FileMetadata } from "./file";

// The parent keys this card by the handle key, so a different file remounts it (resetting the
// page and the game-name cache) while a relisted copy of the same file keeps both.
function FileCard({ selected }: { selected: FileMetadata }) {
  const { t } = useTranslation();

  const [, setTabs] = useAtom(tabsAtom);
  const navigate = useNavigate();

  const [selectedGame, setSelectedGame] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [games, setGames] = useState<Map<number, string>>(new Map());
  // Two handles with the same key are the same file, so a new handle object must not retrigger the read.
  const handleRef = useRef(selected.handle);
  handleRef.current = selected.handle;
  const handleKey = fileWorkspaceKey(selected.handle);

  useEffect(() => {
    setPage(0);
    setGames(new Map());
  }, [handleKey]);

  // Keyed by the handle, not the entry object: a relisting must not re-read the same file.
  useEffect(() => {
    const controller = new AbortController();
    async function loadGames() {
      try {
        const data = await tauri.readGames(handleRef.current, page, page, {
          signal: controller.signal,
        });
        if (!controller.signal.aborted) {
          setSelectedGame(data[0]);
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
          pgn: selectedGame || "",
        }),
      onSuccess: () => navigate({ to: "/" }),
      onError: (error) => notifyUnlessCancelled(t("Common.Error"), error),
    });
  }

  return (
    <Stack h="100%">
      <Stack align="center">
        <Text ta="center" fz="xl" fw="bold">
          {selected?.name}
        </Text>
        <Badge>{t(`Files.FileType.${capitalize(selected.metadata.type)}`)}</Badge>
      </Stack>
      <Divider />

      <Group align="center" grow px="xs">
        <Group>
          <IconAction label={t("Common.Open")} size="sm" onClick={openGame}>
            <IconZoomCheck />
          </IconAction>
        </Group>
        <Text ta="center" c="dimmed">
          {t("Files.GameCountSuffix", {
            count: selected.numGames,
            number: formatNumber(selected.numGames),
          })}
        </Text>
        <div />
      </Group>

      {selectedGame && (
        <>
          <Box h={0} flex={1}>
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
          <Box h="55%" px="xs" pb="xs">
            <GamePreview pgn={selectedGame} />
          </Box>
        </>
      )}
    </Stack>
  );
}

export default FileCard;
