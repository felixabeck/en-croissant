import { tauri } from "@/platform/tauri";
import {
  Alert,
  Box,
  Button,
  Center,
  Divider,
  Group,
  Loader,
  Paper,
  ScrollArea,
  SimpleGrid,
  Stack,
  Tabs,
  Text,
  TextInput,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { IconAlertCircle } from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import { useSetAtom } from "jotai";
import { type Dispatch, type SetStateAction, useState } from "react";
import { useTranslation } from "react-i18next";
import type { KeyedMutator } from "swr";
import { type DatabaseHandle, type DatabaseInfo, type FileWorkspaceHandle } from "@/bindings";
import { databaseConversionStateAtom } from "@/state/atoms";
import {
  getDatabases,
  manifestDatabaseInstallCard,
  type DownloadableDatabaseInfo,
  useDefaultDatabases,
} from "@/utils/db";
import { capitalize, formatBytes, formatNumber } from "@/utils/format";
import { normalizeError, runWithAppliedRecovery } from "@/platform/errors";
import { runUnlessCancelled } from "@/components/files/notifyError";
import AppModal from "../common/AppModal";
import FileInput from "../common/FileInput";
import ProgressButton from "../common/ProgressButton";

interface AddDatabaseFormValues {
  title: string;
  description: string;
  files: FileWorkspaceHandle[];
  filename: string;
}

export async function convertLocalDatabase(
  paths: FileWorkspaceHandle[],
  title: string,
  description: string | undefined,
  onCreated: (handle: DatabaseHandle) => void,
): Promise<DatabaseHandle> {
  const root = await tauri.getDatabaseWorkspace();
  const filename = `${crypto.randomUUID()}.db3`;
  const dbPath = await runWithAppliedRecovery(
    () => tauri.createWorkspaceDatabase(root, filename),
    async () =>
      (await tauri.listWorkspaceDatabases(root)).find(
        (candidate) => candidate.filename === filename,
      )?.handle,
  );
  onCreated(dbPath);
  await tauri.convertPgn(paths, dbPath, null, title, description ?? null);
  return dbPath;
}

export async function convertLocalDatabaseWithLoading(
  paths: FileWorkspaceHandle[],
  title: string,
  description: string | undefined,
  onCreated: (handle: DatabaseHandle) => void,
  setLoading: Dispatch<SetStateAction<boolean>>,
): Promise<DatabaseHandle> {
  setLoading(true);
  try {
    return await convertLocalDatabase(paths, title, description, onCreated);
  } finally {
    setLoading(false);
  }
}

function AddDatabase({
  databases,
  opened,
  setOpened,
  setLoading,
  disableLocalConversion,
  setDatabases,
}: {
  databases: DatabaseInfo[];
  opened: boolean;
  setOpened: (opened: boolean) => void;
  setLoading: Dispatch<SetStateAction<boolean>>;
  disableLocalConversion: boolean;
  setDatabases: KeyedMutator<DatabaseInfo[]>;
}) {
  const { t } = useTranslation();
  const setConversionState = useSetAtom(databaseConversionStateAtom);

  const { defaultDatabases, error, isLoading } = useDefaultDatabases(opened);

  async function convertDB(paths: FileWorkspaceHandle[], title: string, description?: string) {
    if (paths.length === 0) return;
    try {
      const sourceFileName = "PGN";
      await convertLocalDatabaseWithLoading(
        paths,
        title,
        description,
        (dbPath) => {
          setConversionState((prev) => ({
            ...prev,
            inProgress: true,
            targetDatabasePath: dbPath,
            targetDatabaseTitle: title,
            sourceFileName,
          }));
        },
        setLoading,
      );
      await setDatabases(await getDatabases());
    } catch (cause) {
      notifications.show({
        color: "red",
        title: t("Common.Error"),
        message: normalizeError(cause).message,
      });
    } finally {
      setConversionState((prev) => ({
        ...prev,
        inProgress: false,
        totalGames: 0,
        elapsedSeconds: 0,
        targetDatabasePath: null,
        targetDatabaseTitle: null,
        sourceFileName: null,
      }));
    }
  }

  const form = useForm<AddDatabaseFormValues>({
    initialValues: {
      title: "",
      description: "",
      files: [],
      filename: "",
    },

    validate: {
      // Titles are display metadata, not a stable identity.  Handles keep two
      // identically titled databases distinct and native creation reports only
      // an actual filename collision.
      title: (value) => (!value ? t("Common.RequireName") : undefined),
      files: (value) => {
        if (value.length === 0) return t("Common.RequirePath");
      },
    },
  });

  return (
    <AppModal
      opened={opened}
      onClose={() => setOpened(false)}
      title={t("Databases.Add.Title")}
      size="80%"
    >
      <Tabs defaultValue="web">
        <Tabs.List>
          <Tabs.Tab value="web">{t("Databases.Add.Web")}</Tabs.Tab>
          <Tabs.Tab value="local">{t("Common.Local")}</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="web" pt="xs">
          {isLoading && (
            <Center>
              <Loader />
            </Center>
          )}
          <ScrollArea.Autosize h={500} offsetScrollbars>
            <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="sm">
              {defaultDatabases?.map((db) => {
                const card = manifestDatabaseInstallCard(databases, db);
                return (
                  <DatabaseCard
                    database={db}
                    key={card.progressId}
                    progressId={card.progressId}
                    setDatabases={setDatabases}
                    initInstalled={card.initInstalled}
                  />
                );
              })}
              {error && (
                <Alert icon={<IconAlertCircle size="1rem" />} title={t("Common.Error")} color="red">
                  {t("Databases.Add.ErrorFetch")}
                </Alert>
              )}
            </SimpleGrid>
          </ScrollArea.Autosize>
        </Tabs.Panel>
        <Tabs.Panel value="local" pt="xs">
          <form
            onSubmit={form.onSubmit(async (values) => {
              if (disableLocalConversion) return;
              await convertDB(values.files, values.title, values.description);
              setOpened(false);
            })}
          >
            <TextInput label={t("Common.Name")} withAsterisk {...form.getInputProps("title")} />

            <TextInput label={t("Common.Description")} {...form.getInputProps("description")} />

            <FileInput
              label={t("Common.PGNFile")}
              description={t("Databases.Add.ClickToSelectPGN")}
              onClick={() => {
                void runUnlessCancelled(t("Common.Error"), async () => {
                  const selected = await tauri.issuePgnWorkspace();
                  form.setFieldValue("files", [selected.handle]);
                  const firstFilename = selected.displayName;
                  if (firstFilename) {
                    form.setFieldValue("filename", firstFilename);
                    if (!form.values.title) {
                      form.setFieldValue(
                        "title",
                        capitalize(
                          firstFilename
                            .replaceAll(/[_-]/g, " ")
                            .replace(/\.pgn(\.(zst|bz2))?$/i, ""),
                        ),
                      );
                    }
                  }
                });
              }}
              filename={form.values.filename ?? null}
              error={form.errors.files}
            />

            <Button fullWidth mt="xl" type="submit" disabled={disableLocalConversion}>
              {t("Databases.Add.Convert")}
            </Button>
          </form>
        </Tabs.Panel>
      </Tabs>
    </AppModal>
  );
}

function DatabaseCard({
  setDatabases,
  database,
  progressId,
  initInstalled,
}: {
  setDatabases: KeyedMutator<DatabaseInfo[]>;
  database: DownloadableDatabaseInfo;
  progressId: string;
  initInstalled: boolean;
}) {
  const { t } = useTranslation();
  const [inProgress, setInProgress] = useState<boolean>(false);

  async function downloadDatabase() {
    setInProgress(true);
    try {
      await runUnlessCancelled(t("Common.Error"), async () => {
        const root = await tauri.getDatabaseWorkspace();
        const destination = await tauri.databaseDownloadDestination(root);
        await tauri.downloadFile(
          progressId,
          database.downloadLink,
          destination,
          `${database.title}.db3`,
          null,
          crypto.randomUUID(),
          { sha256: database.sha256, signature: database.signature },
        );
        await setDatabases(await getDatabases());
      });
    } finally {
      setInProgress(false);
    }
  }

  return (
    <Paper withBorder radius="md" p={0} key={database.title}>
      <Group wrap="nowrap" gap={0} grow>
        <Box p="md" flex={1}>
          <Text tt="uppercase" c="dimmed" fw={700} size="xs">
            {t("Board.Tabs.Database")}
          </Text>
          <Text fw="bold" mb="xs">
            {database.title}
          </Text>

          <Text size="xs" c="dimmed">
            {database.description}
          </Text>
          <Divider />
          <Group wrap="nowrap" grow my="md">
            <Stack gap={0} align="center">
              <Text tt="uppercase" c="dimmed" fw={700} size="xs">
                {t("Common.Size")}
              </Text>
              <Text size="xs">{formatBytes(database.storage_size ?? 0)}</Text>
            </Stack>
            <Stack gap={0} align="center">
              <Text tt="uppercase" c="dimmed" fw={700} size="xs">
                {t("Databases.Card.Games")}
              </Text>
              <Text size="xs">{formatNumber(database.game_count)}</Text>
            </Stack>
            <Stack gap={0} align="center">
              <Text tt="uppercase" c="dimmed" fw={700} size="xs">
                {t("Databases.Card.Players")}
              </Text>
              <Text size="xs">{formatNumber(database.player_count)}</Text>
            </Stack>
          </Group>
          <ProgressButton
            id={progressId}
            initInstalled={initInstalled}
            labels={{
              completed: t("Common.Installed"),
              action: t("Common.Install"),
              inProgress: t("Common.Downloading"),
              finalizing: t("Common.Extracting"),
            }}
            onClick={() => {
              void downloadDatabase();
            }}
            inProgress={inProgress}
            setInProgress={setInProgress}
          />
        </Box>
      </Group>
    </Paper>
  );
}

export default AddDatabase;
