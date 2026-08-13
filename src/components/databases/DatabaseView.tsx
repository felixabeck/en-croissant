import { Box, Center, Group, Loader, Stack, Tabs, Text, Title } from "@mantine/core";
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
import { getDatabases } from "@/utils/db";
import { resolveDatabaseRoute } from "./databaseRoute";

function DatabaseView() {
  const { t } = useTranslation();
  const database = useActiveDatabaseViewStore((s) => s.database);
  const mode = useActiveDatabaseViewStore((s) => s.activeTab);
  const clearDatabase = useActiveDatabaseViewStore((s) => s.clearDatabase);
  const setActiveTab = useActiveDatabaseViewStore((s) => s.setActiveTab);
  const { databaseId } = useParams({ from: "/databases/$databaseId" });
  const { data: databases } = useSWR("databases", getDatabases);

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
        <Center h="100%">
          <Loader aria-label={t("Common.Loading")} />
        </Center>
      </Box>
    );
  }

  if (resolution.status === "not_found") {
    return (
      <Box p="sm" h="100%">
        <Center h="100%">
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
    <Box p="sm" h="100%">
      <DatabaseViewStateContext.Provider value={activeDatabaseViewStore}>
        <Stack h="100%" style={{ overflow: "hidden" }}>
          <Group align="center">
            <Link onClick={() => clearDatabase()} to={"/databases"}>
              <IconAction label={t("Common.Back")} variant="default">
                <IconArrowBackUp size="1rem" />
              </IconAction>
            </Link>
            <Title>{databaseForRoute.title}</Title>
          </Group>
          <Tabs
            value={mode}
            onChange={(value) => setActiveTab((value ?? "games") as DatabaseViewStore["activeTab"])}
            flex={1}
            style={{
              display: "flex",
              overflow: "hidden",
              flexDirection: "column",
            }}
          >
            <Tabs.List>
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
            <Tabs.Panel value="games" flex={1} style={{ overflow: "hidden" }} pt="md">
              <GameTable />
            </Tabs.Panel>
            <Tabs.Panel value="players" flex={1} style={{ overflow: "hidden" }} pt="md">
              <PlayerTable />
            </Tabs.Panel>
            <Tabs.Panel value="tournaments" flex={1} style={{ overflow: "hidden" }} pt="md">
              <TournamentTable />
            </Tabs.Panel>
          </Tabs>
        </Stack>
      </DatabaseViewStateContext.Provider>
    </Box>
  );
}

export default DatabaseView;
