import { tauri, tauriSubscriptions } from "@/platform/tauri";
import {
  Center,
  Loader,
  Paper,
  Progress,
  Select,
  Stack,
  Text,
  ThemeIcon,
  Title,
} from "@mantine/core";
import { IconDatabaseOff } from "@tabler/icons-react";
import { useAtomValue } from "jotai";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import useSWRImmutable from "swr/immutable";
import type { DatabaseInfo as PlainDatabaseInfo, PlayerGameInfo } from "@/bindings";
import { notifyListenerError } from "@/components/files/notifyError";
import { sessionsAtom } from "@/state/atoms";
import { useTauriListener } from "@/platform/useTauriListener";
import { activeDatabaseViewStore } from "@/state/store/database";
import { databaseHandleKey, getDatabases, query_players } from "@/utils/db";
import type { Session } from "@/utils/session";
import { DatabaseViewStateContext } from "../databases/DatabaseViewStateContext";
import PersonalPlayerCard from "./PersonalCard";

type DatabaseInfo = PlainDatabaseInfo & {
  username?: string;
};

function getSessionUsername(session: Session): string {
  const username = session.lichess?.account.username || session.chessCom?.username;
  if (username === undefined) {
    throw new Error("Session does not have a username");
  }
  return username;
}

function isDatabaseFromSession(db: DatabaseInfo, sessions: Session[]) {
  const session = sessions.find((session) => db.filename.includes(getSessionUsername(session)));

  if (session !== undefined) {
    db.username = getSessionUsername(session);
  }
  return session !== undefined;
}

interface PersonalInfo {
  db: DatabaseInfo;
  info: PlayerGameInfo;
}

/** Stable identity matching the `["personalInfo", name, databases]` SWR key. */
function personalInfoProgressKey(name: string, databases: DatabaseInfo[]): string {
  return JSON.stringify(["personalInfo", name, databases.map((db) => databaseHandleKey(db.file))]);
}

/**
 * Owned progress ids for an in-flight personalInfo fetch. Module-scoped so a remount
 * can still match ProgressEvents while SWR reuses the original fetcher. The entry is
 * replaced at the start of each fetch so the map cannot grow without bound.
 */
const ownedProgressByKey = new Map<string, Map<string, number>>();

function Databases() {
  const { t } = useTranslation();
  const sessions = useAtomValue(sessionsAtom);

  const players = Array.from(
    new Set(sessions.map((s) => s.player || s.lichess?.username || s.chessCom?.username || "")),
  );
  const playerDbNames = players.map((name) => ({
    name,
    databases: sessions
      .filter(
        (s) => s.player === name || s.lichess?.username === name || s.chessCom?.username === name,
      )
      .map((s) =>
        s.chessCom ? `${s.chessCom.username} Chess.com` : `${s.lichess?.username} Lichess`,
      ),
  }));

  const [name, setName] = useState("");
  useEffect(() => {
    if (sessions.length > 0) {
      setName(sessions[0].player || getSessionUsername(sessions[0]));
    }
  }, [sessions]);

  const { data: databases } = useSWRImmutable<DatabaseInfo[]>(
    sessions.length === 0 ? null : ["personalDatabases", sessions],
    async () => {
      const dbs = (await getDatabases()).filter((db) => db.type === "success");
      return dbs.filter((db) => isDatabaseFromSession(db, sessions));
    },
  );

  const {
    data: personalInfo,
    isLoading,
    error,
  } = useSWRImmutable<PersonalInfo[]>(
    databases && name ? ["personalInfo", name, databases] : null,
    async ([, playerName, playerDatabases]: [string, string, DatabaseInfo[]]) => {
      const progressKey = personalInfoProgressKey(playerName, playerDatabases);
      const map = new Map<string, number>();
      ownedProgressByKey.clear();
      ownedProgressByKey.set(progressKey, map);
      const playerDbs = playerDbNames.find((p) => p.name === playerName)?.databases;
      if (!playerDbs) return [];
      const results = await Promise.allSettled(
        playerDatabases
          .filter((db) => playerDbs.includes((db.type === "success" && db.title) || ""))
          .map(async (db) => {
            const players = await query_players(db.file, {
              name: db.username,
              options: {
                pageSize: 1,
                direction: "asc",
                sort: "id",
                skipCount: false,
              },
            });
            if (players.data.length === 0) {
              throw new Error("Player not found in database");
            }
            const player = players.data[0];
            const progressId = crypto.randomUUID();
            map.set(progressId, 0);
            const info = await tauri.getPlayersGameInfo(progressId, db.file, player.id);
            return { db, info };
          }),
      );
      return results
        .filter((r) => r.status === "fulfilled")
        .map((r) => (r as PromiseFulfilledResult<PersonalInfo>).value);
    },
  );

  const [progress, setProgress] = useState(0);
  const subscribeProgress = useCallback(
    (listener: Parameters<typeof tauriSubscriptions.progress>[0]) =>
      tauriSubscriptions.progress(listener),
    [],
  );
  useTauriListener(
    subscribeProgress,
    (e) => {
      if (!databases || !name) {
        return;
      }
      const map = ownedProgressByKey.get(personalInfoProgressKey(name, databases));
      if (!map?.has(e.payload.id)) {
        return;
      }
      map.set(e.payload.id, e.payload.progress);
      const values = [...map.values()];
      setProgress(values.reduce((sum, value) => sum + value, 0) / values.length);
    },
    { onError: notifyListenerError },
  );

  return (
    <>
      {isLoading && databases && (
        <Paper
          h="100%"
          shadow="sm"
          p="md"
          withBorder
          style={{
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <Center h="100%">
            <Stack w="100%" maw={400} align="center" gap="md">
              <ThemeIcon size={80} radius="100%" variant="light" color="blue">
                <Loader color="blue" type="bars" />
              </ThemeIcon>
              <Title order={3}>{t("Home.Databases.ProcessingGames")}</Title>
              <Progress w="100%" value={progress} animated striped size="md" radius="xl" />
              <Text fw="bold" fz="sm" c="dimmed">
                {Math.round(progress)}%
              </Text>
            </Stack>
          </Center>
        </Paper>
      )}
      {error && <Text ta="center">{t("Home.Databases.ErrorLoading", { error })}</Text>}
      {personalInfo &&
        (personalInfo.length === 0 ? (
          <Paper
            h="100%"
            shadow="sm"
            p="md"
            withBorder
            style={{
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <Center h="100%">
              <Stack align="center" gap="md">
                <ThemeIcon size={80} radius="100%" variant="light" color="blue">
                  <IconDatabaseOff size={40} />
                </ThemeIcon>
                <Title order={3}>{t("Home.Databases.Empty.Title")}</Title>
                <Text c="dimmed" ta="center" maw={400}>
                  {t("Home.Databases.Empty.Description")}
                </Text>

                <Select
                  value={name}
                  data={players}
                  onChange={(e) => setName(e || "")}
                  clearable={false}
                  allowDeselect={false}
                  fw="bold"
                  styles={{
                    input: {
                      textAlign: "center",
                      fontSize: "1.25rem",
                    },
                  }}
                  mt="md"
                />
              </Stack>
            </Center>
          </Paper>
        ) : (
          <DatabaseViewStateContext.Provider value={activeDatabaseViewStore}>
            <PersonalPlayerCard
              name={name}
              setName={setName}
              info={{
                site_stats_data: personalInfo.flatMap((i) => i.info.site_stats_data),
              }}
            />
          </DatabaseViewStateContext.Provider>
        ))}
    </>
  );
}

export default Databases;
