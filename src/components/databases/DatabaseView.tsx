import { Box, Button, Center, Group, Loader, Stack, Tabs, Text, Title } from "@mantine/core";
import { IconArrowBackUp, IconChess, IconTrophy, IconUser } from "@tabler/icons-react";
import { Link, useParams } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import GameTable from "@/components/databases/GameTable";
import { IconAction } from "@/components/common/IconAction";
import PlayerTable from "@/components/databases/PlayerTable";
import {
  activeDatabaseViewStore,
  type DatabaseViewStore,
  useActiveDatabaseViewStore,
} from "@/state/store/database";
import { DatabaseViewStateContext } from "./DatabaseViewStateContext";
import TournamentTable from "./TournamentTable";
import useSWR from "swr";
import { useNativeRequestOwner } from "@/hooks/useNativeRequestOwner";
import { getDatabases } from "@/utils/db";
import { resolveDatabaseRoute } from "./databaseRoute";
import { listingFailure } from "@/components/files/listingFailure";
import { databaseLoadFailureMessage } from "./databaseLoadFailure";
import { useElementSize } from "@mantine/hooks";
import { useAtomValue } from "jotai";
import { fontSizeAtom } from "@/state/atoms";
import { databasePaneGeometry, DatabaseLayoutContext } from "@/state/databaseLayout";
import classes from "./GridLayout.module.css";

function DatabaseView() {
  const { t } = useTranslation();
  const { ref, width } = useElementSize();
  const fontSize = useAtomValue(fontSizeAtom);
  const rootFont =
    Number.parseFloat(getComputedStyle(document.documentElement).fontSize) || (16 * fontSize) / 100;
  const geometry = { ...databasePaneGeometry(width, rootFont), rootFont };
  const { compact } = geometry;
  const database = useActiveDatabaseViewStore((s) => s.database);
  const mode = useActiveDatabaseViewStore((s) => s.activeTab);
  const setActiveTab = useActiveDatabaseViewStore((s) => s.setActiveTab);
  const { databaseId } = useParams({ from: "/databases/$databaseId" });
  const databaseOwner = useNativeRequestOwner("databases");
  const {
    data: databases,
    error,
    mutate,
  } = useSWR("databases", () => databaseOwner!.run((signal) => getDatabases({ signal })));

  const resolution = useMemo(
    () => resolveDatabaseRoute(databases, databaseId, database),
    [databases, databaseId, database],
  );

  useEffect(() => {
    if (resolution.status === "synchronizing") {
      activeDatabaseViewStore.getState().setDatabase(resolution.database);
    } else if (resolution.status === "not_found" && database) {
      activeDatabaseViewStore.getState().clearDatabase();
    }
  }, [database, resolution]);

  if (resolution.status === "loading" || resolution.status === "synchronizing") {
    return (
      <Box p="sm" h="100%">
        <Center ref={ref} h="100%">
          {resolution.status === "loading" && listingFailure(error) !== "silent" ? (
            <Stack role="alert" align="center">
              <Text c="red" className="wrap-anywhere">
                {databaseLoadFailureMessage(error, t)}
              </Text>
              <Button onClick={() => void mutate()}>
                {t("Databases.LoadRetry", { defaultValue: "Retry" })}
              </Button>
              <Link to="/databases">{t("Databases.Title")}</Link>
            </Stack>
          ) : (
            <Loader aria-label={t("Common.Loading")} />
          )}
        </Center>
      </Box>
    );
  }

  if (resolution.status === "not_found") {
    return (
      <Box p="sm" h="100%">
        <Center ref={ref} h="100%">
          <Stack align="center">
            <Text c="dimmed">{t("Databases.NoSelection")}</Text>
            <Link to="/databases">{t("Databases.Title")}</Link>
          </Stack>
        </Center>
      </Box>
    );
  }

  const databaseForRoute = resolution.database;

  return (
    <Box
      p="sm"
      h="100%"
      className={classes.view}
      data-database-view
      data-compact={compact || undefined}
    >
      <DatabaseLayoutContext.Provider value={geometry}>
        <DatabaseViewStateContext.Provider value={activeDatabaseViewStore}>
          <Stack ref={ref} className={classes.viewStack}>
            <Group align="center" style={{ flexShrink: 0 }}>
              <Link to="/databases">
                <IconAction label={t("Common.Back")} variant="default">
                  <IconArrowBackUp size="1rem" />
                </IconAction>
              </Link>
              <Title miw={0} className="wrap-anywhere">
                {databaseForRoute.title}
              </Title>
            </Group>
            <Tabs
              value={mode}
              onChange={(value) =>
                setActiveTab((value ?? "games") as DatabaseViewStore["activeTab"])
              }
              className={classes.tabs}
            >
              <Tabs.List style={{ flexShrink: 0 }}>
                <Tabs.Tab leftSection={<IconChess size="1rem" />} value="games">
                  {t("Common.Games")}
                </Tabs.Tab>
                <Tabs.Tab leftSection={<IconUser size="1rem" />} value="players">
                  {t("Databases.Card.Players")}
                </Tabs.Tab>
                <Tabs.Tab leftSection={<IconTrophy size="1rem" />} value="tournaments">
                  {t("Databases.Settings.Events")}
                </Tabs.Tab>
              </Tabs.List>
              <Tabs.Panel value="games" className={classes.panel} pt="md">
                <GameTable />
              </Tabs.Panel>
              <Tabs.Panel value="players" className={classes.panel} pt="md">
                <PlayerTable />
              </Tabs.Panel>
              <Tabs.Panel value="tournaments" className={classes.panel} pt="md">
                <TournamentTable />
              </Tabs.Panel>
            </Tabs>
          </Stack>
        </DatabaseViewStateContext.Provider>
      </DatabaseLayoutContext.Provider>
    </Box>
  );
}

export default DatabaseView;
