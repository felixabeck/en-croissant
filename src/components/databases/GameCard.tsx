import { tauri } from "@/platform/tauri";
import { Box, Divider, Group, Paper, Stack, Text } from "@mantine/core";
import { IconTrash } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { useContext } from "react";
import { DatabaseLayoutContext } from "@/state/databaseLayout";
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
  const { compact } = useContext(DatabaseLayoutContext);
  const { mutate: globalMutate } = useSWRConfig();

  return (
    <Paper shadow="sm" p="sm" withBorder h={compact ? "auto" : "100%"} className={classes.gameCard}>
      <Stack gap="xs" className={classes.gameCardStack}>
        <Group justify="left" className={classes.gameActions}>
          <OpenGameButton disabled={!game} pending={pending} onOpen={() => game && onOpen(game)} />

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
                  (key) => Array.isArray(key) && (key[0] === "players" || key[0] === "tournaments"),
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
            <Box className={classes.gameMetadata}>
              <GameInfo headers={game} />
            </Box>
            <Divider />
            <GamePreview pgn={game.moves} headers={game} showOpening adaptive />
          </>
        ) : (
          <Text>{t("Databases.Game.NoSelection")}</Text>
        )}
      </Stack>
    </Paper>
  );
}

export default GameCard;
