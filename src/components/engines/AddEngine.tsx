import { tauri } from "@/platform/tauri";
import {
  Alert,
  Box,
  Button,
  Center,
  Group,
  Image,
  Loader,
  Paper,
  ScrollArea,
  SimpleGrid,
  Tabs,
  Text,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { IconAlertCircle, IconDatabase, IconTrophy } from "@tabler/icons-react";
import { useAtom } from "jotai";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { notifyUnlessCancelled } from "@/components/files/notifyError";
import { enginesAtom } from "@/state/atoms";
import AppModal from "../common/AppModal";
import {
  type LocalEngine,
  type DefaultEngine,
  type RemoteEngine,
  installDefaultEngine,
  manifestEngineInstallCard,
  useDefaultEngines,
} from "@/utils/engines";
import { usePlatform } from "@/utils/files";
import { formatBytes } from "@/utils/format";
import ProgressButton from "../common/ProgressButton";
import EngineForm from "./EngineForm";

function AddEngine({
  opened,
  setOpened,
}: {
  opened: boolean;
  setOpened: (opened: boolean) => void;
}) {
  const { t } = useTranslation();

  const [allEngines, setEngines] = useAtom(enginesAtom);
  const engines = (allEngines ?? []).filter((e): e is LocalEngine => e.type === "local");

  const { os } = usePlatform();

  const { defaultEngines, error, isLoading } = useDefaultEngines(os, opened);

  const form = useForm<LocalEngine>({
    initialValues: {
      type: "local",
      id: crypto.randomUUID(),
      version: "",
      name: "",
      handle: undefined as unknown as LocalEngine["handle"],
      filename: "",
      imageHandle: undefined,
      elo: undefined,
    },

    validate: {
      name: (value) => {
        if (!value) return t("Common.RequireName");
        if (engines.find((e) => e.name === value)) return t("Common.NameAlreadyUsed");
      },
      filename: (value) => {
        if (!value) return t("Common.RequirePath");
      },
    },
  });

  return (
    <AppModal
      opened={opened}
      onClose={() => setOpened(false)}
      title={t("Engines.Add.Title")}
      size="80%"
    >
      <Tabs defaultValue="download">
        <Tabs.List>
          <Tabs.Tab value="download">{t("Common.Download")}</Tabs.Tab>
          <Tabs.Tab value="cloud">{t("Engines.Add.Cloud")}</Tabs.Tab>
          <Tabs.Tab value="local">{t("Common.Local")}</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="download" pt="xs">
          {isLoading && (
            <Center>
              <Loader />
            </Center>
          )}
          <ScrollArea.Autosize mah={720} offsetScrollbars>
            <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="sm">
              {defaultEngines?.map((engine) => {
                const card = manifestEngineInstallCard(engines, engine);
                return (
                  <EngineCard
                    engine={engine}
                    key={card.progressId ?? engine.path}
                    progressId={card.progressId}
                    initInstalled={card.initInstalled}
                  />
                );
              })}
              {error && (
                <Alert icon={<IconAlertCircle size="1rem" />} title={t("Common.Error")} color="red">
                  {t("Engines.Add.ErrorFetch")}
                </Alert>
              )}
            </SimpleGrid>
          </ScrollArea.Autosize>
        </Tabs.Panel>
        <Tabs.Panel value="cloud" pt="xs">
          <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="sm">
            <CloudCard
              engine={{
                id: crypto.randomUUID(),
                name: "ChessDB",
                type: "chessdb",
                url: "https://chessdb.cn",
              }}
            />
            <CloudCard
              engine={{
                id: crypto.randomUUID(),
                name: "Lichess Cloud",
                type: "lichess",
                url: "https://lichess.org",
              }}
            />
          </SimpleGrid>
        </Tabs.Panel>
        <Tabs.Panel value="local" pt="xs">
          <EngineForm
            submitLabel={t("Common.Add")}
            form={form}
            onSubmit={(values: LocalEngine) => {
              setEngines(async (prev) => [
                ...(await prev),
                {
                  ...values,
                  id: crypto.randomUUID(),
                },
              ]);
              form.setFieldValue("id", crypto.randomUUID());
              setOpened(false);
            }}
          />
        </Tabs.Panel>
      </Tabs>
    </AppModal>
  );
}

function CloudCard({ engine }: { engine: RemoteEngine }) {
  const { t } = useTranslation();

  const [engines, setEngines] = useAtom(enginesAtom);
  return (
    <Paper withBorder radius="md" p={0} key={engine.name}>
      <Group wrap="nowrap" gap={0} grow>
        <Box p="sm" flex={1}>
          <Text tt="uppercase" c="dimmed" fw={700} size="xs">
            {t("Common.Engine")}
          </Text>
          <Text fw="bold" size="sm">
            {engine.name}
          </Text>
          <Text size="xs" c="dimmed" mb="xs">
            {engine.url}
          </Text>
          <Button
            disabled={(engines ?? []).find((e) => e.type === engine.type) !== undefined}
            fullWidth
            size="xs"
            onClick={() => {
              setEngines(async (prev) => [
                ...(await prev),
                {
                  ...engine,
                  id: crypto.randomUUID(),
                  type: engine.type,
                  loaded: true,
                  settings: [
                    {
                      type: "string",
                      name: "MultiPV",
                      value: "1",
                    },
                  ],
                },
              ]);
            }}
          >
            {t("Common.Add")}
          </Button>
        </Box>
      </Group>
    </Paper>
  );
}

function EngineCard({
  engine,
  progressId,
  initInstalled,
}: {
  engine: DefaultEngine;
  progressId: string | null;
  initInstalled: boolean;
}) {
  const { t } = useTranslation();

  const [inProgress, setInProgress] = useState<boolean>(false);
  const [installedThisSession, setInstalledThisSession] = useState(false);
  const [, setEngines] = useAtom(enginesAtom);
  const downloadEngine = useCallback(async () => {
    if (!progressId) return;
    setInProgress(true);
    try {
      const installed = await installDefaultEngine(engine, progressId);
      setEngines(async (prev) => [...(await prev), installed]);
      setInstalledThisSession(true);
    } catch (error) {
      notifyUnlessCancelled(t("Common.Error"), error);
      try {
        await tauri.clearProgress(progressId);
      } catch {
        // Installed state comes from the engine list, not from download success.
      }
    } finally {
      setInProgress(false);
    }
  }, [engine, progressId, setEngines, t]);

  return (
    <Paper withBorder radius="md" p={0} key={engine.name}>
      <Group wrap="nowrap" gap={0} grow>
        {engine.imageUrl && (
          <Box w="1.75rem" px="xs">
            <Image src={engine.imageUrl} alt={engine.name} fit="contain" />
          </Box>
        )}
        <Box p="sm" flex={1}>
          <Text tt="uppercase" c="dimmed" fw={700} size="xs">
            {t("Common.Engine")}
          </Text>
          <Text fw="bold" size="sm" mb="xs">
            {engine.name} {engine.version}
          </Text>
          <Group wrap="nowrap" gap="xs" fz="xs">
            <IconTrophy size="1rem" />
            <Text size="xs">{`${engine.elo} ELO`}</Text>
          </Group>
          <Group wrap="nowrap" gap="xs" mb="xs" fz="xs">
            <IconDatabase size="1rem" />
            <Text size="xs">{formatBytes(engine.downloadSize ?? 0)}</Text>
          </Group>
          {progressId && (
            <ProgressButton
              id={progressId}
              initInstalled={initInstalled || installedThisSession}
              completeOnProgressSuccess={false}
              labels={{
                completed: t("Common.Installed"),
                action: t("Common.Install"),
                inProgress: t("Common.Downloading"),
                finalizing: t("Common.Extracting"),
              }}
              onClick={() => {
                void downloadEngine();
              }}
              inProgress={inProgress}
              setInProgress={setInProgress}
            />
          )}
        </Box>
      </Group>
    </Paper>
  );
}

export default AddEngine;
