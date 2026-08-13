import { tauri } from "@/platform/tauri";
import { Alert, Box, Button, Divider, Group, Paper, ScrollArea, Stack, Text } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconAlertCircle } from "@tabler/icons-react";
import { type Dispatch, type SetStateAction, useState } from "react";
import { useTranslation } from "react-i18next";
import useSWRImmutable from "swr/immutable";
import { type PuzzleDatabaseInfo } from "@/bindings";
import { getDefaultPuzzleDatabases, type DownloadablePuzzleDatabase } from "@/utils/db";
import { formatBytes, formatNumber } from "@/utils/format";
import { normalizeError } from "@/platform/errors";
import { choosePuzzleDatabase, getPuzzleDatabases } from "@/utils/puzzles";
import ProgressButton from "../common/ProgressButton";
import AppModal from "../common/AppModal";

function AddPuzzle({
  puzzleDbs,
  opened,
  setOpened,
  setPuzzleDbs,
  onWorkspaceChanged,
}: {
  puzzleDbs: PuzzleDatabaseInfo[];
  opened: boolean;
  setOpened: (opened: boolean) => void;
  setPuzzleDbs: Dispatch<SetStateAction<PuzzleDatabaseInfo[]>>;
  onWorkspaceChanged: () => void;
}) {
  const { t } = useTranslation();
  const { data: dbs, error } = useSWRImmutable(
    "default_puzzle_databases",
    getDefaultPuzzleDatabases,
  );
  async function chooseLocalWorkspace() {
    try {
      await choosePuzzleDatabase();
      onWorkspaceChanged();
      setPuzzleDbs(await getPuzzleDatabases());
      setOpened(false);
    } catch (error) {
      const normalized = normalizeError(error);
      if (normalized.category !== "cancelled") {
        notifications.show({ color: "red", title: t("Common.Error"), message: normalized.message });
      }
    }
  }

  return (
    <AppModal opened={opened} onClose={() => setOpened(false)} title={t("Databases.Add.Title")}>
      <ScrollArea.Autosize mah={500} offsetScrollbars>
        <Stack>
          <Button variant="default" onClick={() => void chooseLocalWorkspace()}>
            {t("Puzzle.ChooseLocalFolder")}
          </Button>
          {dbs?.map((db, i) => (
            <PuzzleDbCard
              puzzleDb={db}
              databaseId={i}
              key={i}
              setPuzzleDbs={setPuzzleDbs}
              initInstalled={puzzleDbs.some((e) => e.title.replace(".db3", "") === db.title)}
            />
          ))}
          {error && (
            <Alert icon={<IconAlertCircle size="1rem" />} title={t("Common.Error")} color="red">
              {t("Databases.Add.ErrorFetch")}
            </Alert>
          )}
        </Stack>
      </ScrollArea.Autosize>
    </AppModal>
  );
}

function PuzzleDbCard({
  setPuzzleDbs,
  puzzleDb,
  databaseId,
  initInstalled,
}: {
  setPuzzleDbs: Dispatch<SetStateAction<PuzzleDatabaseInfo[]>>;
  puzzleDb: DownloadablePuzzleDatabase;
  databaseId: number;
  initInstalled: boolean;
}) {
  const { t } = useTranslation();
  const [inProgress, setInProgress] = useState<boolean>(false);

  async function downloadDatabase(id: number, database: DownloadablePuzzleDatabase) {
    setInProgress(true);
    try {
      const destination = await tauri.issuePuzzleDownloadDestination();
      await tauri.downloadFile(
        `puzzle_db_${id}`,
        database.downloadLink,
        destination,
        `${database.title}.db3`,
        null,
        crypto.randomUUID(),
        { sha256: database.sha256, signature: database.signature },
      );
      setPuzzleDbs(await getPuzzleDatabases());
    } catch (error) {
      notifications.show({
        color: "red",
        title: t("Common.Error"),
        message: normalizeError(error).message,
      });
    } finally {
      setInProgress(false);
    }
  }

  return (
    <Paper withBorder radius="md" p={0} key={puzzleDb.title}>
      <Group wrap="nowrap" gap={0} grow>
        <Box p="md" flex={1}>
          <Text tt="uppercase" c="dimmed" fw={700} size="xs">
            {t("Puzzle.Database")}
          </Text>
          <Text fw="bold" mb="xs">
            {puzzleDb.title}
          </Text>

          <Text size="xs" c="dimmed">
            {puzzleDb.description}
          </Text>
          <Divider />
          <Group wrap="nowrap" grow my="md">
            <Stack gap={0} align="center">
              <Text tt="uppercase" c="dimmed" fw={700} size="xs">
                {t("Common.Size")}
              </Text>
              <Text size="xs">{formatBytes(puzzleDb.storageSize)}</Text>
            </Stack>
            <Stack gap={0} align="center">
              <Text tt="uppercase" c="dimmed" fw={700} size="xs">
                {t("Puzzle.Puzzles")}
              </Text>
              <Text size="xs">{formatNumber(puzzleDb.puzzleCount)}</Text>
            </Stack>
          </Group>
          <ProgressButton
            id={`puzzle_db_${databaseId}`}
            initInstalled={initInstalled}
            labels={{
              completed: t("Common.Installed"),
              action: t("Common.Install"),
              inProgress: t("Common.Downloading"),
              finalizing: t("Common.Extracting"),
            }}
            onClick={() => {
              downloadDatabase(databaseId, puzzleDb);
            }}
            inProgress={inProgress}
            setInProgress={setInProgress}
          />
        </Box>
      </Group>
    </Paper>
  );
}

export default AddPuzzle;
