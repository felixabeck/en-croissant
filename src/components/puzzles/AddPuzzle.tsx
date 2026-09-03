import { tauri } from "@/platform/tauri";
import { Alert, Box, Button, Divider, Group, Paper, ScrollArea, Stack, Text } from "@mantine/core";
import { IconAlertCircle } from "@tabler/icons-react";
import { type Dispatch, type SetStateAction, useState } from "react";
import { useTranslation } from "react-i18next";
import useSWRImmutable from "swr/immutable";
import { type PuzzleDatabaseInfo } from "@/bindings";
import {
  getDefaultPuzzleDatabases,
  manifestPuzzleDatabaseInstallCard,
  type DownloadablePuzzleDatabase,
} from "@/utils/db";
import { formatBytes, formatNumber } from "@/utils/format";
import { notifyUnlessCancelled, runUnlessCancelled } from "@/components/files/notifyError";
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
      notifyUnlessCancelled(t("Common.Error"), error);
    }
  }

  return (
    <AppModal opened={opened} onClose={() => setOpened(false)} title={t("Databases.Add.Title")}>
      <ScrollArea.Autosize mah={500} offsetScrollbars>
        <Stack>
          <Button variant="default" onClick={() => void chooseLocalWorkspace()}>
            {t("Puzzle.ChooseLocalFolder")}
          </Button>
          {dbs?.map((db) => {
            const card = manifestPuzzleDatabaseInstallCard(puzzleDbs, db);
            return (
              <PuzzleDbCard
                puzzleDb={db}
                key={card.progressId}
                progressId={card.progressId}
                setPuzzleDbs={setPuzzleDbs}
                initInstalled={card.initInstalled}
              />
            );
          })}
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
  progressId,
  initInstalled,
}: {
  setPuzzleDbs: Dispatch<SetStateAction<PuzzleDatabaseInfo[]>>;
  puzzleDb: DownloadablePuzzleDatabase;
  progressId: string;
  initInstalled: boolean;
}) {
  const { t } = useTranslation();
  const [inProgress, setInProgress] = useState<boolean>(false);

  async function downloadDatabase() {
    setInProgress(true);
    try {
      await runUnlessCancelled(t("Common.Error"), async () => {
        const destination = await tauri.issuePuzzleDownloadDestination();
        await tauri.downloadFile(
          progressId,
          puzzleDb.downloadLink,
          destination,
          `${puzzleDb.title}.db3`,
          null,
          crypto.randomUUID(),
          { sha256: puzzleDb.sha256, signature: puzzleDb.signature },
        );
        setPuzzleDbs(await getPuzzleDatabases());
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

export default AddPuzzle;
