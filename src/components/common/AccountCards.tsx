import { tauri } from "@/platform/tauri";
import { Divider, Group, ScrollArea, Stack, Text, TextInput } from "@mantine/core";
import { IconCheck, IconEdit, IconX } from "@tabler/icons-react";
import { useAtom, useAtomValue } from "jotai";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { sessionsAtom } from "@/state/atoms";
import { getChessComAccount, getStats } from "@/utils/chess.com/api";
import type { ManagedDatabaseInfo } from "@/utils/db";
import { getLichessAccount } from "@/utils/lichess/api";
import type { Session } from "@/utils/session";
import { AccountCard } from "../home/AccountCard";
import { EmptyAccounts } from "../home/EmptyAccounts";
import IconAction from "./IconAction";

function AccountCards({
  databases,
  setDatabases,
  onAddAccount,
}: {
  databases: ManagedDatabaseInfo[];
  setDatabases: React.Dispatch<React.SetStateAction<ManagedDatabaseInfo[]>>;
  onAddAccount: () => void;
}) {
  const sessions = useAtomValue(sessionsAtom);
  const playerNames = Array.from(
    new Set(sessions.map((s) => s.player ?? s.lichess?.username ?? s.chessCom?.username)),
  );

  const playerSessions = playerNames.map((name) => ({
    name,
    sessions: sessions.filter(
      (s) => s.player === name || s.lichess?.username === name || s.chessCom?.username === name,
    ),
  }));

  if (sessions.length === 0) {
    return <EmptyAccounts onAddAccount={onAddAccount} />;
  }

  return (
    <ScrollArea offsetScrollbars>
      <Stack>
        {playerSessions.map(({ name, sessions }) => (
          <PlayerSession
            key={name}
            name={name!}
            sessions={sessions}
            databases={databases}
            setDatabases={setDatabases}
          />
        ))}
      </Stack>
    </ScrollArea>
  );
}

function PlayerSession({
  name,
  sessions,
  databases,
  setDatabases,
}: {
  name: string;
  sessions: Session[];
  databases: ManagedDatabaseInfo[];
  setDatabases: React.Dispatch<React.SetStateAction<ManagedDatabaseInfo[]>>;
}) {
  const { t } = useTranslation();
  const [, setSessions] = useAtom(sessionsAtom);
  const [edit, setEdit] = useState(false);
  const [text, setText] = useState(name);
  useEffect(() => {
    setText(name);
  }, [name]);
  const ref = useRef(null);

  return (
    <Stack mt="sm">
      <Group justify="space-between" align="center">
        {edit ? (
          <TextInput
            ref={ref}
            variant="unstyled"
            fw="bold"
            value={text}
            onChange={(e) => setText(e.currentTarget.value)}
            styles={{
              input: {
                fontSize: "1.1rem",
                textDecoration: "underline",
              },
            }}
            autoFocus
          />
        ) : (
          <Text fz="lg" fw="bold">
            {name}
          </Text>
        )}
        <Group>
          {edit ? (
            <IconAction
              label={t("Accounts.SaveName", { defaultValue: "Save player name" })}
              size="sm"
              variant="subtle"
              color="green"
              onClick={() => {
                setEdit(false);
                setSessions((prev) =>
                  prev.map((s) => {
                    if (sessions.includes(s)) {
                      return {
                        ...s,
                        player: text,
                      };
                    }
                    return s;
                  }),
                );
              }}
            >
              <IconCheck />
            </IconAction>
          ) : (
            <IconAction
              label={t("Accounts.EditName", { defaultValue: "Edit player name" })}
              size="sm"
              variant="subtle"
              color="gray"
              onClick={() => {
                setEdit(true);
              }}
            >
              <IconEdit />
            </IconAction>
          )}
          <IconAction
            label={t("Accounts.Remove", { defaultValue: "Remove account" })}
            size="sm"
            variant="subtle"
            color="red"
            onClick={() =>
              setSessions((sessions) =>
                sessions.filter(
                  (s) =>
                    s.player !== name &&
                    s.lichess?.username !== name &&
                    s.chessCom?.username !== name,
                ),
              )
            }
          >
            <IconX />
          </IconAction>
        </Group>
      </Group>
      <Divider />
      <Group>
        {sessions.map((session, i) => (
          <LichessOrChessCom
            key={i}
            session={session}
            databases={databases}
            setDatabases={setDatabases}
            setSessions={setSessions}
          />
        ))}
      </Group>
    </Stack>
  );
}

function LichessOrChessCom({
  session,
  databases,
  setDatabases,
  setSessions,
}: {
  session: Session;
  databases: ManagedDatabaseInfo[];
  setDatabases: React.Dispatch<React.SetStateAction<ManagedDatabaseInfo[]>>;
  setSessions: React.Dispatch<React.SetStateAction<Session[]>>;
}) {
  if (session.lichess?.account) {
    const account = session.lichess.account;
    const lichessSession = session.lichess;
    const totalGames =
      (account.perfs?.ultraBullet?.games ?? 0) +
      (account.perfs?.bullet?.games ?? 0) +
      (account.perfs?.blitz?.games ?? 0) +
      (account.perfs?.rapid?.games ?? 0) +
      (account.perfs?.classical?.games ?? 0) +
      (account.perfs?.correspondence?.games ?? 0);

    const stats = [];
    const speeds = ["bullet", "blitz", "rapid", "classical"] as const;

    if (account.perfs) {
      for (const speed of speeds) {
        const perf = account.perfs[speed];
        if (perf) {
          stats.push({
            value: perf.rating,
            label: speed,
            diff: perf.prog,
          });
        }
      }
    }

    return (
      <AccountCard
        key={account.id}
        authenticated={Boolean(lichessSession.handle)}
        accountHandle={lichessSession.handle}
        type="lichess"
        database={databases.find((db) => db.filename === `${account.username}_lichess.db3`) ?? null}
        title={account.username}
        updatedAt={session.updatedAt}
        total={totalGames}
        logout={async () => {
          if (lichessSession.handle) {
            const removal = await tauri.removeLichessAccount(lichessSession.handle);
            // Do not claim a logout that the native credential manager could not commit.  A
            // `removed_revocation_pending` result is still locally logged out truthfully.
            if (removal === "not_found") return;
          }
          setSessions((sessions) => sessions.filter((s) => s.lichess?.account.id !== account.id));
        }}
        setDatabases={setDatabases}
        reload={async () => {
          const account = await getLichessAccount(
            lichessSession.handle
              ? { handle: lichessSession.handle }
              : { username: lichessSession.username },
          );
          if (!account) return;
          setSessions((sessions) =>
            sessions.map((s) =>
              s.lichess?.account.id === account.id
                ? {
                    ...s,
                    lichess: {
                      account: account,
                      username: lichessSession.username,
                      handle: lichessSession.handle,
                    },
                    updatedAt: Date.now(),
                  }
                : s,
            ),
          );
        }}
        stats={stats}
      />
    );
  }
  if (session.chessCom?.stats) {
    let totalGames = 0;
    for (const stat of Object.values(session.chessCom.stats)) {
      if (stat.record) {
        totalGames += stat.record.win + stat.record.loss + stat.record.draw;
      }
    }
    return (
      <AccountCard
        key={session.chessCom.username}
        type="chesscom"
        title={session.chessCom.username}
        database={
          databases.find((db) => db.filename === `${session.chessCom?.username}_chesscom.db3`) ??
          null
        }
        updatedAt={session.updatedAt}
        total={totalGames}
        stats={getStats(session.chessCom.stats)}
        logout={() => {
          setSessions((sessions) =>
            sessions.filter((s) => s.chessCom?.username !== session.chessCom?.username),
          );
        }}
        reload={async () => {
          if (!session.chessCom) return;
          const stats = await getChessComAccount(session.chessCom?.username);
          if (!stats) return;
          setSessions((sessions) =>
            sessions.map((s) =>
              session.chessCom && s.chessCom?.username === session.chessCom?.username
                ? {
                    ...s,
                    chessCom: {
                      username: session.chessCom?.username,
                      stats,
                    },
                    updatedAt: Date.now(),
                  }
                : s,
            ),
          );
        }}
        setDatabases={setDatabases}
      />
    );
  }
}

export default AccountCards;
