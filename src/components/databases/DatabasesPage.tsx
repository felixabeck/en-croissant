import { tauri } from "@/platform/tauri";
import {
  Box,
  Button,
  Center,
  Checkbox,
  Divider,
  Group,
  Input,
  Loader,
  Paper,
  Rating,
  ScrollArea,
  SimpleGrid,
  Skeleton,
  Stack,
  Text,
  Textarea,
  TextInput,
  ThemeIcon,
  Title,
  Tooltip,
} from "@mantine/core";
import { useDebouncedValue, useToggle } from "@mantine/hooks";
import { IconArrowRight, IconDatabase, IconPlus, IconSearch } from "@tabler/icons-react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useAtom } from "jotai";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import useSWR, { useSWRConfig } from "swr";
import type { DatabaseHandle, DatabaseInfo } from "@/bindings";
import { IconAction } from "@/components/common/IconAction";
import { databaseConversionStateAtom, referenceDbAtom } from "@/state/atoms";
import { activeDatabaseViewStore, useActiveDatabaseViewStore } from "@/state/store/database";
import {
  conversionProgressId,
  databaseHandleKey,
  getDatabases,
  sameDatabaseHandle,
  type SuccessDatabaseInfo,
} from "@/utils/db";
import { pickPgnFile } from "@/utils/files";
import { formatBytes, formatNumber } from "@/utils/format";
import ConfirmModal from "../common/ConfirmModal";
import GenericCard from "../common/GenericCard";
import AddDatabase from "./AddDatabase";
import {
  deleteDatabaseAndInvalidate,
  invalidateDeletedDatabase,
  runAddGamesToDatabase,
  runPgnExport,
} from "./databaseMutation";
import { PlayerSearchInput } from "./PlayerSearchInput";

export default function DatabasesPage() {
  const { t } = useTranslation();

  const { data: databases, error, isLoading, mutate } = useSWR("databases", () => getDatabases());
  const { mutate: mutateCache } = useSWRConfig();

  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [referenceDatabase, setReferenceDatabase] = useAtom(referenceDbAtom);
  const [conversionState, setConversionState] = useAtom(databaseConversionStateAtom);
  const selectedDatabase = useMemo(
    () => (databases ?? []).find((db) => databaseHandleKey(db.file) === selected) ?? null,
    [databases, selected],
  );
  const visibleDatabases = useMemo(() => {
    return (databases ?? []).filter((item) => {
      if (!conversionState.inProgress || !conversionState.targetDatabasePath) {
        return true;
      }

      return !sameDatabaseHandle(item.file, conversionState.targetDatabasePath);
    });
  }, [databases, conversionState.inProgress, conversionState.targetDatabasePath]);
  const filteredDatabases = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    if (!normalizedSearch) {
      return visibleDatabases;
    }

    return visibleDatabases.filter((item) => {
      const values = [
        item.filename,
        item.type === "success" ? item.title : item.error,
        item.type === "success" ? item.description : "",
      ];

      return values.some((value) => value.toLowerCase().includes(normalizedSearch));
    });
  }, [visibleDatabases, search]);
  const hasSearch = search.trim().length > 0;
  // const [, setStorageSelected] = useAtom(selectedDatabaseAtom);
  const setActiveDatabase = useActiveDatabaseViewStore((store) => store.setDatabase);

  const isReference = sameDatabaseHandle(referenceDatabase, selectedDatabase?.file);

  const [deleteModal, setDeleteModal] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);

  function invalidateDeletedDatabaseState(deleted: DatabaseHandle) {
    setSelected(
      (currentSelected) =>
        invalidateDeletedDatabase(deleted, {
          selected: currentSelected,
          reference: referenceDatabase,
          active: activeDatabaseViewStore.getState().database,
        }).selected,
    );
    if (sameDatabaseHandle(referenceDatabase, deleted)) {
      setReferenceDatabase(null);
      void tauri.clearGames();
    }
    if (sameDatabaseHandle(activeDatabaseViewStore.getState().database?.file, deleted)) {
      activeDatabaseViewStore.getState().clearDatabase();
    }
    // Clear every result-set cache bound to this exact opaque handle. A later
    // revalidation must never resurrect data belonging to the deleted database.
    void mutateCache(
      (key) =>
        Array.isArray(key) &&
        key.length > 1 &&
        typeof key[1] === "object" &&
        key[1] !== null &&
        "id" in key[1] &&
        "kind" in key[1] &&
        key[1].kind === "database" &&
        sameDatabaseHandle(key[1] as DatabaseHandle, deleted),
      undefined,
      { revalidate: false },
    );
    void mutate();
  }

  function changeReferenceDatabase(file: DatabaseHandle) {
    void tauri.clearGames();
    if (sameDatabaseHandle(file, referenceDatabase)) {
      setReferenceDatabase(null);
    } else {
      setReferenceDatabase(file);
    }
  }
  const navigate = useNavigate();

  return (
    <Stack h="100%" style={{ overflow: "auto" }}>
      <ConfirmModal
        title={t("Databases.Delete.Title")}
        description={t("Databases.Delete.Message")}
        opened={deleteModal}
        onClose={() => setDeleteModal(false)}
        onConfirm={async () => {
          if (!selectedDatabase) return;
          await deleteDatabaseAndInvalidate(
            selectedDatabase.file,
            tauri.deleteDatabase,
            invalidateDeletedDatabaseState,
          );
        }}
      />

      <AddDatabase
        databases={databases ?? []}
        opened={open}
        setOpened={setOpen}
        disableLocalConversion={conversionState.inProgress}
        setDatabases={mutate}
      />

      <Group align="baseline" pl="lg" py="sm">
        <Title>{t("Databases.Title")}</Title>
      </Group>

      <SimpleGrid
        cols={{ base: 1, sm: 2 }}
        flex={1}
        px="md"
        pb="md"
        mih={0}
        style={{ minWidth: 0 }}
      >
        <Paper
          withBorder
          style={{ borderWidth: 2 }}
          miw={0}
          mih={{ base: "20rem", sm: 0 }}
          h={{ sm: "100%" }}
        >
          <Stack gap={0} h="100%" style={{ overflow: "hidden" }}>
            <Group p="xs" gap="xs">
              <Input
                size="sm"
                style={{ flexGrow: 1 }}
                leftSection={<IconSearch size="1rem" />}
                placeholder={t("Common.Search")}
                value={search}
                onChange={(e) => setSearch(e.currentTarget.value)}
              />
              <IconAction
                label={t("Common.AddNew")}
                variant="default"
                size="lg"
                onClick={() => setOpen(true)}
                disabled={conversionState.inProgress}
              >
                <IconPlus size="1rem" />
              </IconAction>
            </Group>
            <Divider />
            {conversionState.inProgress && (
              <>
                <Group px="xs" py={6} gap="xs" justify="space-between">
                  <Group gap={6}>
                    <Loader size="xs" />
                    <Text size="sm">
                      {conversionState.sourceFileName || conversionState.targetDatabaseTitle
                        ? `${t("Databases.Add.Convert")}: ${conversionState.sourceFileName ?? conversionState.targetDatabaseTitle}`
                        : t("Databases.Add.Convert")}
                    </Text>
                  </Group>
                  {conversionState.totalGames > 0 && (
                    <Text size="xs" c="dimmed">
                      {t("Files.GameCountSuffix", { number: conversionState.totalGames })}
                      {conversionState.elapsedSeconds > 0
                        ? ` • ${(conversionState.totalGames / conversionState.elapsedSeconds).toFixed(1)} games/s`
                        : ""}
                    </Text>
                  )}
                </Group>
                <Divider />
              </>
            )}
            <ScrollArea
              flex={1}
              viewportProps={{ tabIndex: 0, "aria-label": t("Databases.Title") }}
            >
              {error && (
                <Text role="alert" c="red" p="md">
                  {t("Databases.LoadError", {
                    defaultValue: "Could not load databases. Please try again.",
                  })}
                </Text>
              )}
              <SimpleGrid cols={{ base: 1, md: 2 }} spacing={{ base: "md", md: "sm" }} p="xs">
                {isLoading && (
                  <>
                    <Skeleton h="8rem" />
                    <Skeleton h="8rem" />
                    <Skeleton h="8rem" />
                  </>
                )}
                {!isLoading &&
                  filteredDatabases?.map((item) => (
                    <GenericCard
                      id={databaseHandleKey(item.file)}
                      key={databaseHandleKey(item.file)}
                      isSelected={sameDatabaseHandle(selectedDatabase?.file, item.file)}
                      setSelected={setSelected}
                      error={item.type === "error" ? item.error : ""}
                      onDoubleClick={() => {
                        if (item.type === "error") return;
                        navigate({
                          to: "/databases/$databaseId",
                          params: {
                            databaseId: databaseHandleKey(item.file),
                          },
                        });
                        setActiveDatabase(item);
                        //setStorageSelected(item);
                      }}
                      Header={
                        <Group wrap="nowrap" justify="space-between">
                          <Group wrap="nowrap" miw={0}>
                            <IconDatabase size="1.5rem" />
                            <Box miw={0}>
                              <Text fw={500} fz="sm">
                                {item.type === "success" ? item.title : item.error}
                              </Text>
                              <Text size="xs" c="dimmed" style={{ wordWrap: "break-word" }}>
                                {item.type === "error" ? item.filename : item.description}
                              </Text>
                            </Box>
                          </Group>
                          <Rating
                            value={sameDatabaseHandle(referenceDatabase, item.file) ? 1 : 0}
                            count={1}
                            onChange={() => {
                              changeReferenceDatabase(item.file);
                            }}
                          />
                        </Group>
                      }
                      stats={[
                        {
                          label: t("Databases.Card.Games"),
                          value: item.type === "success" ? formatNumber(item.game_count) : "???",
                        },
                        {
                          label: t("Databases.Card.Storage"),
                          value:
                            item.type === "success" ? formatBytes(item.storage_size ?? 0) : "???",
                        },
                      ]}
                    />
                  ))}
              </SimpleGrid>
            </ScrollArea>
            {!isLoading && filteredDatabases.length === 0 && (
              <Center h="100%">
                <Stack align="center" gap="sm">
                  <ThemeIcon size={64} radius="100%" variant="light" color="gray">
                    <IconDatabase size={32} />
                  </ThemeIcon>
                  <Text c="dimmed" fw={500} ta="center">
                    {hasSearch ? t("Common.NoResults") : t("Databases.Empty.NoInstalled")}
                  </Text>
                  {!hasSearch && (
                    <Text c="dimmed" size="sm" ta="center">
                      {t("Databases.Empty.AddHint")}
                    </Text>
                  )}
                </Stack>
              </Center>
            )}
          </Stack>
        </Paper>

        {selectedDatabase === null ? (
          <Paper
            withBorder
            style={{ borderWidth: 2 }}
            p="md"
            miw={0}
            mih={{ base: "20rem", sm: 0 }}
            h={{ sm: "100%" }}
          >
            <Center h="100%">
              <Stack align="center" gap="sm">
                <ThemeIcon size={80} radius="100%" variant="light" color="gray">
                  <IconDatabase size={40} />
                </ThemeIcon>
                <Text c="dimmed" fw={500} size="lg">
                  {t("Databases.NoSelection")}
                </Text>
              </Stack>
            </Center>
          </Paper>
        ) : (
          <Paper
            withBorder
            style={{ borderWidth: 2 }}
            p="md"
            miw={0}
            mih={{ base: "20rem", sm: 0 }}
            h={{ sm: "100%" }}
          >
            <ScrollArea h="100%" offsetScrollbars>
              <Stack>
                {selectedDatabase.type === "error" ? (
                  <>
                    <Text fz="lg" fw="bold">
                      {t("Databases.LoadError.Title")}
                    </Text>

                    <Text>
                      <Text td="underline" span>
                        {t("Common.Reason")}:
                      </Text>
                      {` ${selectedDatabase.error}`}
                    </Text>

                    <Text>{t("Databases.LoadError.Description")}</Text>
                  </>
                ) : (
                  <>
                    <Divider variant="dashed" label={t("Common.GeneralSettings")} />
                    <GeneralSettings
                      key={selectedDatabase.filename}
                      selectedDatabase={selectedDatabase}
                      mutate={mutate}
                    />
                    <Checkbox
                      label={t("Databases.Settings.ReferenceDatabase")}
                      checked={isReference}
                      onChange={() => {
                        changeReferenceDatabase(selectedDatabase.file);
                      }}
                    />
                    <IndexInput
                      indexed={selectedDatabase.indexed}
                      file={selectedDatabase.file}
                      setDatabases={mutate}
                    />

                    <Divider variant="dashed" label={t("Common.Data")} />
                    <Group grow>
                      <Stack gap={0} justify="center" ta="center">
                        <Text size="md" tt="uppercase" fw="bold" c="dimmed">
                          {t("Databases.Card.Games")}
                        </Text>
                        <Text fw={700} size="lg">
                          {formatNumber(selectedDatabase.game_count)}
                        </Text>
                      </Stack>
                      <Stack gap={0} justify="center" ta="center">
                        <Text size="md" tt="uppercase" fw="bold" c="dimmed">
                          {t("Databases.Card.Players")}
                        </Text>
                        <Text fw={700} size="lg">
                          {formatNumber(selectedDatabase.player_count - 1)}
                        </Text>
                      </Stack>
                      <Stack gap={0} justify="center" ta="center">
                        <Text size="md" tt="uppercase" fw="bold" c="dimmed">
                          {t("Databases.Settings.Events")}
                        </Text>
                        <Text fw={700} size="lg">
                          {formatNumber(selectedDatabase.event_count - 1)}
                        </Text>
                      </Stack>
                    </Group>

                    <div>
                      {selectedDatabase.type === "success" && (
                        <Button
                          component={Link}
                          to={`/databases/${databaseHandleKey(selectedDatabase.file)}`}
                          onClick={() => setActiveDatabase(selectedDatabase)}
                          fullWidth
                          variant="default"
                          size="lg"
                          rightSection={<IconArrowRight size="1rem" />}
                        >
                          {t("Databases.Settings.Explore")}
                        </Button>
                      )}
                    </div>
                  </>
                )}

                <Divider variant="dashed" label={t("Databases.Settings.AdvancedTools")} />

                {selectedDatabase.type === "success" && (
                  <AdvancedSettings selectedDatabase={selectedDatabase} reload={mutate} />
                )}

                <Divider variant="dashed" label={t("Databases.Settings.Actions")} />
                <Group justify="space-between">
                  {selectedDatabase.type === "success" && (
                    <Group>
                      <Button
                        variant="default"
                        rightSection={<IconPlus size="1rem" />}
                        onClick={() => {
                          const dest = selectedDatabase.file;
                          void runAddGamesToDatabase({
                            pickPgnFile,
                            convertPgn: async (files, destination) => {
                              await tauri.convertPgn(
                                conversionProgressId(destination),
                                files,
                                destination,
                                null,
                                "",
                                null,
                              );
                              await mutate();
                            },
                            dest,
                            notifyTitle: t("Common.Error"),
                            begin: (sourceFileName) => {
                              setConversionState((prev) => ({
                                ...prev,
                                inProgress: true,
                                targetDatabasePath: dest,
                                targetDatabaseTitle: selectedDatabase.title,
                                sourceFileName,
                              }));
                            },
                            finish: () => {
                              setConversionState((previous) =>
                                sameDatabaseHandle(previous.targetDatabasePath, dest)
                                  ? {
                                      ...previous,
                                      inProgress: false,
                                      totalGames: 0,
                                      elapsedSeconds: 0,
                                      targetDatabasePath: null,
                                      targetDatabaseTitle: null,
                                      sourceFileName: null,
                                    }
                                  : previous,
                              );
                            },
                          });
                        }}
                      >
                        {t("Databases.Settings.AddGames")}
                      </Button>
                      <Button
                        rightSection={<IconArrowRight size="1rem" />}
                        variant="default"
                        loading={exportLoading}
                        onClick={() => {
                          void runPgnExport({
                            issueDestination: () => tauri.issuePgnExportDestination(),
                            exportToPgn: (file, handle) => tauri.exportToPgn(file, handle),
                            file: selectedDatabase.file,
                            notifyTitle: t("Common.Error"),
                            setLoading: setExportLoading,
                          });
                        }}
                      >
                        {t("Databases.Settings.ExportPGN")}
                      </Button>
                    </Group>
                  )}
                  <Button onClick={() => setDeleteModal(true)} color="red">
                    {t("Common.Delete")}
                  </Button>
                </Group>
              </Stack>
            </ScrollArea>
          </Paper>
        )}
      </SimpleGrid>
    </Stack>
  );
}

function GeneralSettings({
  selectedDatabase,
  mutate,
}: {
  selectedDatabase: SuccessDatabaseInfo;
  mutate: () => void;
}) {
  const { t } = useTranslation();

  const [title, setTitle] = useState(selectedDatabase.title);
  const [description, setDescription] = useState(selectedDatabase.description);

  const [debouncedTitle] = useDebouncedValue(title, 300);
  const [debouncedDescription] = useDebouncedValue(description, 300);

  useEffect(() => {
    tauri
      .editDbInfo(selectedDatabase.file, debouncedTitle ?? null, debouncedDescription ?? null)
      .then(() => mutate());
  }, [debouncedTitle, debouncedDescription, mutate, selectedDatabase.file]);

  return (
    <>
      <TextInput
        label={t("Common.Name")}
        value={title}
        onChange={(e) => setTitle(e.currentTarget.value)}
        error={title === "" && t("Common.RequireName")}
      />
      <Textarea
        label={t("Common.Description")}
        value={description}
        onChange={(e) => setDescription(e.currentTarget.value)}
      />
    </>
  );
}

function AdvancedSettings({
  selectedDatabase,
  reload,
}: {
  selectedDatabase: DatabaseInfo;
  reload: () => void;
}) {
  return (
    <Stack>
      <PlayerMerger selectedDatabase={selectedDatabase} />
      <DuplicateRemover selectedDatabase={selectedDatabase} reload={reload} />
    </Stack>
  );
}

function PlayerMerger({ selectedDatabase }: { selectedDatabase: DatabaseInfo }) {
  const { t } = useTranslation();

  const [player1, setPlayer1] = useState<number | undefined>(undefined);
  const [player2, setPlayer2] = useState<number | undefined>(undefined);
  const [loading, setLoading] = useState(false);

  async function mergePlayers() {
    if (player1 === undefined || player2 === undefined) {
      return;
    }
    setLoading(true);
    try {
      await tauri.mergePlayers(selectedDatabase.file, player1, player2);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Stack>
      <Text fz="lg" fw="bold">
        {t("Databases.Settings.MergePlayers")}
      </Text>
      <Text fz="sm">{t("Databases.Settings.MergePlayers.Desc")}</Text>
      <Group grow>
        <PlayerSearchInput
          label={t("Databases.Player.One")}
          file={selectedDatabase.file}
          setValue={setPlayer1}
        />
        <Button
          loading={loading}
          onClick={mergePlayers}
          rightSection={<IconArrowRight size="1rem" />}
        >
          {t("Databases.Settings.Merge")}
        </Button>
        <PlayerSearchInput
          label={t("Databases.Player.Two")}
          file={selectedDatabase.file}
          setValue={setPlayer2}
        />
      </Group>
    </Stack>
  );
}

function DuplicateRemover({
  selectedDatabase,
  reload,
}: {
  selectedDatabase: DatabaseInfo;
  reload: () => void;
}) {
  const { t } = useTranslation();

  const [loading, setLoading] = useState(false);
  return (
    <Stack>
      <Text fz="lg" fw="bold">
        {t("Databases.Settings.BatchDelete")}
      </Text>
      <Text fz="sm">{t("Databases.Settings.BatchDelete.Desc")}</Text>
      <Group>
        <Button
          loading={loading}
          onClick={async () => {
            setLoading(true);
            void tauri
              .deleteDuplicatedGames(selectedDatabase.file)
              .then(() => {
                setLoading(false);
                reload();
              })
              .catch(() => {
                setLoading(false);
                reload();
              });
          }}
        >
          {t("Databases.Settings.RemoveDup")}
        </Button>

        <Button
          loading={loading}
          onClick={async () => {
            setLoading(true);
            void tauri
              .deleteEmptyGames(selectedDatabase.file)
              .then(() => {
                setLoading(false);
                reload();
              })
              .catch(() => {
                setLoading(false);
                reload();
              });
          }}
        >
          {t("Databases.Settings.RemoveEmpty")}
        </Button>
      </Group>
    </Stack>
  );
}

function IndexInput({
  indexed,
  file,
  setDatabases,
}: {
  indexed: boolean;
  file: DatabaseHandle;
  setDatabases: (dbs: DatabaseInfo[]) => void;
}) {
  const { t } = useTranslation();

  const [loading, setLoading] = useToggle();
  return (
    <Group>
      <Tooltip label={t("Databases.Settings.Indexed.Desc")}>
        <Checkbox
          label={t("Databases.Settings.Indexed")}
          disabled={loading}
          checked={indexed}
          onChange={(e) => {
            setLoading(true);
            const fn = e.currentTarget.checked ? tauri.createIndexes : tauri.deleteIndexes;
            void fn(file).then(() => {
              getDatabases().then((dbs) => {
                setDatabases(dbs);
                setLoading(false);
              });
            });
          }}
        />
      </Tooltip>
      {loading && <Loader size="sm" />}
    </Group>
  );
}
