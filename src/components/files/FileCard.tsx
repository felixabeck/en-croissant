import { tauri } from "@/platform/tauri";
import { Badge, Box, Divider, Group, Stack, Text } from "@mantine/core";
import { IconEdit, IconZoomCheck } from "@tabler/icons-react";
import { useNavigate } from "@tanstack/react-router";
import { useAtom } from "jotai";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { errorUnlessCancelled } from "@/platform/errors";
import { notifyUnlessCancelled } from "@/components/files/notifyError";
import { tabsAtom } from "@/state/atoms";
import { IconAction } from "@/components/common/IconAction";
import { openFile } from "@/utils/files";
import { runTabCreation } from "@/utils/tabs";
import { capitalize } from "@/utils/format";
import GamePreview from "../databases/GamePreview";
import GameSelector from "../panels/info/GameSelector";
import type { FileMetadata } from "./file";

function FileCard({
  selected,
  games,
  setGames,
  toggleEditModal,
}: {
  selected: FileMetadata;
  games: Map<number, string>;
  setGames: React.Dispatch<React.SetStateAction<Map<number, string>>>;
  toggleEditModal: () => void;
}) {
  const { t } = useTranslation();

  const [, setTabs] = useAtom(tabsAtom);
  const navigate = useNavigate();

  const [selectedGame, setSelectedGame] = useState<string | null>(null);
  const [page, setPage] = useState(0);

  useEffect(() => {
    setPage(0);
  }, [selected]);

  useEffect(() => {
    const controller = new AbortController();
    async function loadGames() {
      try {
        const data = await tauri.readGames(selected.handle, page, page, {
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
  }, [selected, page, t]);

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
          <IconAction label={t("Files.EditMetadata")} size="sm" onClick={() => toggleEditModal()}>
            <IconEdit />
          </IconAction>
        </Group>
        <Text ta="center" c="dimmed">
          {selected?.numGames} {t("Common.Games")}
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
