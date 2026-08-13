import { tauri } from "@/platform/tauri";
import { Divider, Group, Paper, ScrollArea, Stack } from "@mantine/core";
import { IconTrash, IconZoomCheck } from "@tabler/icons-react";
import { useNavigate } from "@tanstack/react-router";
import { useAtom, useSetAtom } from "jotai";
import { useTranslation } from "react-i18next";
import { useSWRConfig } from "swr";
import { type DatabaseHandle, type NormalizedGame } from "@/bindings";
import { activeTabAtom, tabsAtom } from "@/state/atoms";
import { IconAction } from "@/components/common/IconAction";
import { createTab } from "@/utils/tabs";
import GameInfo from "../common/GameInfo";
import GamePreview from "./GamePreview";

function GameCard({
  game,
  file,
  mutate,
}: {
  game: NormalizedGame;
  file: DatabaseHandle;
  mutate: () => void;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { mutate: globalMutate } = useSWRConfig();

  const [, setTabs] = useAtom(tabsAtom);
  const setActiveTab = useSetAtom(activeTabAtom);

  return (
    <Paper shadow="sm" p="sm" withBorder h="100%">
      <ScrollArea h="100%">
        <Stack h="100%" gap="xs">
          <GameInfo headers={game} />
          <Divider />
          <Group justify="left">
            <IconAction
              label={t("Board.Action.AnalyzeGame")}
              variant="subtle"
              onClick={() => {
                createTab({
                  tab: {
                    name: `${game.white} - ${game.black}`,
                    type: "analysis",
                  },
                  setTabs,
                  setActiveTab,
                  pgn: game.moves,
                  headers: game,
                  gameOrigin: {
                    kind: "database",
                    database: file,
                    gameId: game.id,
                  },
                });
                navigate({ to: "/" });
              }}
            >
              <IconZoomCheck size="1.2rem" stroke={1.5} />
            </IconAction>

            <IconAction
              label={t("Databases.Game.Delete")}
              variant="subtle"
              color="red"
              onClick={() => {
                void tauri.deleteDbGame(file, game.id).then(() => {
                  mutate();
                  globalMutate(
                    (key) =>
                      Array.isArray(key) && (key[0] === "players" || key[0] === "tournaments"),
                    undefined,
                    { revalidate: true },
                  );
                });
              }}
            >
              <IconTrash size="1.2rem" stroke={1.5} />
            </IconAction>
          </Group>
          <Divider />
          <GamePreview pgn={game.moves} headers={game} showOpening />
        </Stack>
      </ScrollArea>
    </Paper>
  );
}

export default GameCard;
