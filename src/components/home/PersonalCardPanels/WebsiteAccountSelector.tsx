import { Group, Select } from "@mantine/core";
import { useAtomValue } from "jotai";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { sessionsAtom } from "@/state/atoms";

const ALL_ACCOUNTS = "All accounts";

interface WebsiteAccountSelectorProps {
  playerName: string;
  onWebsiteChange: (website: string | null) => void;
  onAccountChange: (account: string | null) => void;
  allowAll: boolean;
}

const WebsiteAccountSelector = ({
  playerName,
  onWebsiteChange,
  onAccountChange,
  allowAll,
}: WebsiteAccountSelectorProps) => {
  const { t } = useTranslation();
  const sessions = useAtomValue(sessionsAtom);

  const websites = useMemo(() => {
    const availableWebsites = [];
    if (sessions.some((s) => s.player === playerName && s.chessCom?.username)) {
      availableWebsites.push({ value: "Chess.com", label: "Chess.com" });
    }
    if (sessions.some((s) => s.player === playerName && s.lichess?.username)) {
      availableWebsites.push({ value: "Lichess", label: "Lichess" });
    }
    if (allowAll) {
      availableWebsites.unshift({ value: "All websites", label: t("Home.Accounts.AllWebsites") });
    }
    return availableWebsites;
  }, [allowAll, playerName, sessions, t]);

  const [website, setWebsite] = useState<string | null>(websites[0]?.value);
  const [account, setAccount] = useState<string | null>(ALL_ACCOUNTS);

  useEffect(() => {
    onWebsiteChange(website);
  }, [onWebsiteChange, website]);

  useEffect(() => {
    onAccountChange(account);
  }, [account, onAccountChange]);

  const accounts = useMemo(
    () =>
      [ALL_ACCOUNTS].concat(
        sessions
          .filter(
            (s) =>
              s.player === playerName &&
              ((website === "Chess.com" && s.chessCom?.username) ||
                (website === "Lichess" && s.lichess?.username)),
          )
          .map((s) => s.chessCom?.username || s.lichess?.username)
          .filter((username): username is string => username !== undefined && username !== null),
      ),
    [playerName, sessions, website],
  );

  return (
    <Group grow>
      <Select
        pt="lg"
        label={t("Home.Accounts.Website")}
        value={website}
        onChange={(value) => {
          setWebsite(value);
          setAccount(ALL_ACCOUNTS);
        }}
        data={websites}
        allowDeselect={false}
      />
      {website !== "All websites" && accounts.filter((a) => a !== ALL_ACCOUNTS).length > 1 && (
        <Select
          pt="lg"
          label={t("Home.Accounts.Account")}
          value={account}
          onChange={(value) => setAccount(value)}
          data={accounts.map((value) => ({
            value,
            label: value === ALL_ACCOUNTS ? t("Home.Accounts.AllAccounts") : value,
          }))}
          allowDeselect={false}
        />
      )}
    </Group>
  );
};

export default WebsiteAccountSelector;
