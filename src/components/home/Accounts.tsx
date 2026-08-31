import {
  Autocomplete,
  Button,
  Checkbox,
  Group,
  InputWrapper,
  Stack,
  TextInput,
} from "@mantine/core";
import { IconPlus } from "@tabler/icons-react";
import { useAtom, useAtomValue } from "jotai";
import { notifications } from "@mantine/notifications";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { sessionsAtom } from "@/state/atoms";
import { getChessComAccount } from "@/utils/chess.com/api";
import { getDatabases, type ManagedDatabaseInfo } from "@/utils/db";
import { getLichessAccount } from "@/utils/lichess/api";
import { authenticateLichess } from "@/utils/lichess/authentication";
import { type ChessComSession, type LichessSession, upsertLichessSession } from "@/utils/session";
import AccountCards from "../common/AccountCards";
import GenericCard from "../common/GenericCard";
import AppModal from "../common/AppModal";
import LichessLogo from "./LichessLogo";

function Accounts() {
  const { t } = useTranslation();
  const [sessions, setSessions] = useAtom(sessionsAtom);
  const [databases, setDatabases] = useState<ManagedDatabaseInfo[]>([]);
  useEffect(() => {
    let active = true;
    void getDatabases()
      .then((dbs) => {
        if (active) setDatabases(dbs);
      })
      .catch(() => {
        // Account management remains usable without an import destination. The database page
        // owns the visible retry/error state for the shared workspace.
        if (active) setDatabases([]);
      });
    return () => {
      active = false;
    };
  }, []);
  const [open, setOpen] = useState(false);

  const addChessComSession = useCallback(
    (alias: string, session: ChessComSession) => {
      setSessions((sessions) => {
        const newSessions = sessions.filter((s) => s.chessCom?.username !== session.username);
        return [
          ...newSessions,
          {
            chessCom: session,
            player: alias,
            updatedAt: Date.now(),
          },
        ];
      });
    },
    [setSessions],
  );

  const addLichessSession = useCallback(
    (alias: string, session: LichessSession) => {
      setSessions((sessions) => upsertLichessSession(sessions, alias, session));
    },
    [setSessions],
  );

  const showAuthenticationFailed = useCallback(() => {
    notifications.show({
      message: t("Home.Accounts.AuthenticationFailed"),
      color: "red",
    });
  }, [t]);

  const showLinkDurabilityUncertain = useCallback(() => {
    notifications.show({
      message: t("Home.Accounts.LinkDurabilityUncertain", {
        defaultValue:
          "The account is linked, but the save could not be fully confirmed. Do not retry.",
      }),
      color: "orange",
    });
  }, [t]);

  const addChessCom = useCallback(
    async (player: string, username: string): Promise<boolean> => {
      const p = player !== "" ? player : username;
      try {
        const stats = await getChessComAccount(username);
        if (!stats) return false;
        addChessComSession(p, { username, stats });
        return true;
      } catch {
        return false;
      }
    },
    [addChessComSession],
  );

  const addLichessNoLogin = useCallback(
    async (player: string, username: string): Promise<boolean> => {
      const p = player !== "" ? player : username;
      try {
        const account = await getLichessAccount({ username });
        if (!account) return false;
        addLichessSession(p, { username, account });
        return true;
      } catch {
        return false;
      }
    },
    [addLichessSession],
  );

  const addLichess = useCallback(
    async (player: string, username: string, withLogin: boolean): Promise<boolean> => {
      if (withLogin) {
        try {
          const result = await authenticateLichess(player, username);
          if (!result.ok) {
            showAuthenticationFailed();
            return false;
          }
          if (result.durabilityUncertain) showLinkDurabilityUncertain();
          return true;
        } catch {
          // Native errors are intentionally not exposed in the interface.
        }
        showAuthenticationFailed();
        return false;
      }
      return addLichessNoLogin(player, username);
    },
    [addLichessNoLogin, showAuthenticationFailed, showLinkDurabilityUncertain],
  );

  return (
    <>
      <AccountCards
        databases={databases}
        setDatabases={setDatabases}
        onAddAccount={() => setOpen(true)}
      />
      {sessions.length > 0 && (
        <Group>
          <Button
            fullWidth
            variant="light"
            rightSection={<IconPlus size="1rem" />}
            onClick={() => setOpen(true)}
          >
            {t("Home.Accounts.Add")}
          </Button>
        </Group>
      )}
      <AccountModal
        open={open}
        setOpen={setOpen}
        addLichess={addLichess}
        addChessCom={addChessCom}
      />
    </>
  );
}

export default Accounts;

function AccountModal({
  open,
  setOpen,
  addLichess,
  addChessCom,
}: {
  open: boolean;
  setOpen: (open: boolean) => void;
  addLichess: (player: string, username: string, withLogin: boolean) => Promise<boolean>;
  addChessCom: (player: string, username: string) => Promise<boolean>;
}) {
  const { t } = useTranslation();
  const sessions = useAtomValue(sessionsAtom);
  const [username, setUsername] = useState("");
  const [player, setPlayer] = useState<string>("");
  const [website, setWebsite] = useState<"lichess" | "chesscom">("lichess");
  const [withLogin, setWithLogin] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const submitLock = useRef(false);

  const players = new Set(
    sessions.map((s) => s.player || s.lichess?.username || s.chessCom?.username || ""),
  );

  function closeAndClear() {
    setOpen(false);
    setUsername("");
    setPlayer("");
    setWebsite("lichess");
    setWithLogin(false);
  }

  async function addAccount() {
    if (submitLock.current) return;
    submitLock.current = true;
    setIsPending(true);
    try {
      const success =
        website === "lichess"
          ? await addLichess(player, username, withLogin)
          : await addChessCom(player, username);
      if (success) closeAndClear();
    } catch {
      // Account providers own their lookup failure notifications.
    } finally {
      submitLock.current = false;
      setIsPending(false);
    }
  }

  return (
    <AppModal
      opened={open}
      onClose={() => !isPending && setOpen(false)}
      title={t("Home.Accounts.Add")}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          addAccount();
        }}
      >
        <Stack>
          <Autocomplete
            label={t("Home.Accounts.PlayerName")}
            description={t("Home.Accounts.PlayerName.Desc")}
            data={Array.from(players)}
            value={player}
            onChange={(value) => setPlayer(value)}
            placeholder={t("Home.Accounts.SelectPlayer")}
          />
          <InputWrapper label={t("Home.Accounts.Website")} required>
            <Group grow>
              <GenericCard
                id={"lichess"}
                isSelected={website === "lichess"}
                setSelected={() => setWebsite("lichess")}
                Header={
                  <Group>
                    <LichessLogo />
                    Lichess
                  </Group>
                }
              />
              <GenericCard
                id={"chesscom"}
                isSelected={website === "chesscom"}
                setSelected={() => setWebsite("chesscom")}
                Header={
                  <Group>
                    <img width={30} height={30} src="/chesscom.png" alt="chess.com" />
                    Chess.com
                  </Group>
                }
              />
            </Group>
          </InputWrapper>

          <TextInput
            label={t("Home.Accounts.Username")}
            placeholder={t("Home.Accounts.EnterUsername")}
            required
            value={username}
            onChange={(e) => setUsername(e.currentTarget.value)}
          />
          {website === "lichess" && (
            <Checkbox
              label={t("Home.Accounts.LoginWithBrowser")}
              description={t("Home.Accounts.LoginWithBrowser.Desc")}
              checked={withLogin}
              onChange={(e) => setWithLogin(e.currentTarget.checked)}
            />
          )}
          <Button mt="1rem" type="submit" loading={isPending} disabled={isPending}>
            {t("Common.Add")}
          </Button>
          {isPending && (
            <span role="status" aria-live="polite">
              {t("Common.Loading")}
            </span>
          )}
        </Stack>
      </form>
    </AppModal>
  );
}
