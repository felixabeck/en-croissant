import { tauri } from "@/platform/tauri";
import { Divider, Group, Paper, ScrollArea, Stack, Text } from "@mantine/core";
import { IconTrash } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { useSWRConfig } from "swr";
import { type DatabaseHandle, type NormalizedGame } from "@/bindings";
import { OpenGameButton } from "@/components/common/gameOpen";
import { IconAction } from "@/components/common/IconAction";
import GameInfo from "../common/GameInfo";
import GamePreview from "./GamePreview";
import classes from "./GridLayout.module.css";

function GameCard({
  game,
  file,
  mutate,
  onOpen,
  pending,
}: {
  game?: NormalizedGame;
  file: DatabaseHandle;
  mutate: () => void;
  onOpen: (game: NormalizedGame) => void | Promise<void>;
  pending: boolean;
}) {
  const { t } = useTranslation();
  const { mutate: globalMutate } = useSWRConfig();

  return (
    <Paper shadow="sm" p="sm" withBorder h="100%">
      <ScrollArea h="100%">
        <Stack h="100%" gap="xs">
          <Group justify="left" className={classes.gameActions}>
            <OpenGameButton
              disabled={!game}
              pending={pending}
              onOpen={() => game && onOpen(game)}
            />

            <IconAction
              label={t("Databases.Game.Delete")}
              variant="subtle"
              color="red"
              disabled={!game}
              onClick={() => {
                if (!game) return;
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
          {game ? (
            <>
              <GameInfo headers={game} />
              <Divider />
              <GamePreview pgn={game.moves} headers={game} showOpening />
            </>
          ) : (
            <Text>{t("Databases.Game.NoSelection")}</Text>
          )}
        </Stack>
      </ScrollArea>
    </Paper>
  );
}

export default GameCard;
