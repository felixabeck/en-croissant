import { tauri, tauriSubscriptions } from "@/platform/tauri";
import {
  Alert,
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
import type { PlayerGameInfo } from "@/bindings";
import { notifyListenerError } from "@/components/files/notifyError";
import { useNativeRequestOwner } from "@/hooks/useNativeRequestOwner";
import { sessionsAtom } from "@/state/atoms";
import { useTauriListener } from "@/platform/useTauriListener";
import { activeDatabaseViewStore } from "@/state/store/database";
import {
  databaseHandleKey,
  getDatabases,
  query_players,
  type ManagedDatabaseInfo,
} from "@/utils/db";
import { accountDatabaseFilename } from "./accountDatabase";
import { collectSequential } from "@/utils/collectSequential";
import type { Session } from "@/utils/session";
import { DatabaseViewStateContext } from "../databases/DatabaseViewStateContext";
import PersonalPlayerCard from "./PersonalCard";

type PersonalDatabase = {
  db: ManagedDatabaseInfo;
  username: string;
};

function sessionPlayerName(session: Session): string {
  return session.player || session.lichess?.username || session.chessCom?.username || "";
}

function databaseLabel(db: ManagedDatabaseInfo): string {
  return db.type === "success" ? db.title || db.filename : db.filename;
}

function sessionAccountDatabase(
  session: Session,
): { filename: string; username: string } | undefined {
  const lichessUsername = session.lichess?.account?.username;
  if (typeof lichessUsername === "string" && lichessUsername.length > 0) {
    return {
      username: lichessUsername,
      filename: accountDatabaseFilename(lichessUsername, "lichess"),
    };
  }
  const chessComUsername = session.chessCom?.username;
  if (typeof chessComUsername === "string" && chessComUsername.length > 0) {
    return {
      username: chessComUsername,
      filename: accountDatabaseFilename(chessComUsername, "chesscom"),
    };
  }
  return undefined;
}

interface PersonalInfo {
  db: ManagedDatabaseInfo;
  info: PlayerGameInfo;
}

interface PersonalSummary {
  entries: PersonalInfo[];
  failed: ManagedDatabaseInfo[];
}

function StatisticsNotice({
  failed,
  incomplete = false,
}: {
  failed: ManagedDatabaseInfo[];
  incomplete?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <Alert
      color="yellow"
      mt="xs"
      title={
        incomplete
          ? t("Home.Databases.Incomplete.Title", { defaultValue: "Statistics are incomplete" })
          : undefined
      }
      style={{ flexShrink: 0 }}
    >
      {t("Home.Databases.Incomplete.Description", {
        defaultValue: "These databases could not be read: {{databases}}",
        databases: failed.map(databaseLabel).join(", "),
      })}
    </Alert>
  );
}

/** Stable identity matching the `["personalInfo", name, databases]` SWR key. */
function personalInfoProgressKey(name: string, databases: PersonalDatabase[]): string {
  return JSON.stringify([
    "personalInfo",
    name,
    databases.map(({ db }) => databaseHandleKey(db.file)),
  ]);
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

  const players = Array.from(new Set(sessions.map(sessionPlayerName)));
  const playerDbNames = players.map((name) => ({
    name,
    databases: sessions
      .filter((s) => sessionPlayerName(s) === name)
      .flatMap((s) => {
        const account = sessionAccountDatabase(s);
        return account ? [account.filename] : [];
      }),
  }));

  const [name, setName] = useState("");
  useEffect(() => {
    if (sessions.length > 0) {
      setName(sessionPlayerName(sessions[0]));
    }
  }, [sessions]);

  const databasesKey = sessions.length === 0 ? null : ["personalDatabases", sessions];
  const databasesOwner = useNativeRequestOwner(databasesKey);
  const { data: databases, error: databasesError } = useSWRImmutable<PersonalDatabase[]>(
    databasesKey,
    () =>
      databasesOwner!.run(async (signal) => {
        const dbs = await getDatabases({ signal });
        return dbs.flatMap((db) => {
          const account = sessions
            .map(sessionAccountDatabase)
            .find((account) => db.filename === account?.filename);
          return account ? [{ db, username: account.username }] : [];
        });
      }),
  );

  const personalKey = databases && name ? ["personalInfo", name, databases] : null;
  const personalOwner = useNativeRequestOwner(personalKey);
  const {
    data: personalInfo,
    isLoading,
    error,
  } = useSWRImmutable<PersonalSummary>(
    personalKey,
    ([, playerName, playerDatabases]: [string, string, PersonalDatabase[]]) =>
      personalOwner!.run(async (signal) => {
        const progressKey = personalInfoProgressKey(playerName, playerDatabases);
        const map = new Map<string, number>();
        ownedProgressByKey.clear();
        ownedProgressByKey.set(progressKey, map);
        const playerDbs = playerDbNames.find((p) => p.name === playerName)?.databases;
        if (!playerDbs) return { entries: [], failed: [] };
        const candidates = playerDatabases.filter(({ db }) => playerDbs.includes(db.filename));
        const { values, failures } = await collectSequential(
          candidates.filter(({ db }) => db.type === "success"),
          async ({ db, username }) => {
            const players = await query_players(
              db.file,
              {
                name: username,
                options: {
                  pageSize: 1,
                  direction: "asc",
                  sort: "id",
                  skipCount: false,
                },
              },
              { signal },
            );
            if (players.data.length === 0) {
              return null;
            }
            const player = players.data[0];
            const progressId = crypto.randomUUID();
            map.set(progressId, 0);
            const info = await tauri.getPlayersGameInfo(progressId, db.file, player.id, {
              signal,
            });
            return { db, info };
          },
          {
            signal,
            operation: "personal database summary",
            describe: ({ db }) => databaseLabel(db),
          },
        );
        const failedItems = new Set(failures.map(({ item }) => item));
        return {
          entries: values.filter((entry): entry is PersonalInfo => entry !== null),
          failed: candidates
            .filter((item) => item.db.type === "error" || failedItems.has(item))
            .map(({ db }) => db),
        };
      }),
  );

  const loadError = databasesError ?? error;
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
      {loadError && (
        <Text ta="center">{t("Home.Databases.ErrorLoading", { error: loadError })}</Text>
      )}
      {personalInfo &&
        (personalInfo.entries.length === 0 ? (
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
                <Title order={3}>
                  {personalInfo.failed.length > 0
                    ? t("Home.Databases.Failed.Title", {
                        defaultValue: "Could not load statistics",
                      })
                    : t("Home.Databases.Empty.Title")}
                </Title>
                {personalInfo.failed.length > 0 ? (
                  <StatisticsNotice failed={personalInfo.failed} />
                ) : (
                  <Text c="dimmed" ta="center" maw={400}>
                    {t("Home.Databases.Empty.Description")}
                  </Text>
                )}

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
                site_stats_data: personalInfo.entries.flatMap((i) => i.info.site_stats_data),
              }}
              notice={
                personalInfo.failed.length > 0 ? (
                  <StatisticsNotice failed={personalInfo.failed} incomplete />
                ) : undefined
              }
            />
          </DatabaseViewStateContext.Provider>
        ))}
    </>
  );
}

export default Databases;
