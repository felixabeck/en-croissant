import {
  Alert,
  Box,
  Center,
  Group,
  Image,
  Loader,
  Paper,
  ScrollArea,
  SimpleGrid,
  Text,
} from "@mantine/core";
import { IconAlertCircle, IconDatabase, IconTrophy } from "@tabler/icons-react";
import { useSetAtom } from "jotai";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import AppModal from "@/components/common/AppModal";
import ProgressButton from "@/components/common/ProgressButton";
import { notifyUnlessCancelled } from "@/components/files/notifyError";
import { cancelDownloadJob, runDownloadJob, useDownloadJob } from "@/hooks/downloadJobs";
import { cancellationError, tauri } from "@/platform/tauri";
import { enginesAtom, gamePlayer1SettingsAtom, gamePlayer2SettingsAtom } from "@/state/atoms";
import { createEngineOwnerStorage } from "@/state/engineOwnerStorage";
import {
  defaultPlayerSettings,
  opponentSettingsSchema,
  upgradeOpponentEngine,
} from "@/state/opponentSettings";
import {
  EngineCapabilityQueryError,
  EngineCatalogVerificationError,
  installCatalogEngine,
  upgradeEngineFromCatalog,
  useDefaultEngines,
  type DefaultEngine,
  type LocalEngine,
} from "@/utils/engines";
import { usePlatform } from "@/utils/files";
import { formatBytes } from "@/utils/format";

export default function UpgradeEngineModal({
  engine,
  opened,
  setOpened,
}: {
  engine: LocalEngine;
  opened: boolean;
  setOpened: (opened: boolean) => void;
}) {
  const { t } = useTranslation();
  const { os } = usePlatform();
  const { defaultEngines, error, isLoading } = useDefaultEngines(os, opened);
  const saveEngines = useSetAtom(enginesAtom);
  const savePlayer1 = useSetAtom(gamePlayer1SettingsAtom);
  const savePlayer2 = useSetAtom(gamePlayer2SettingsAtom);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [upgradedLink, setUpgradedLink] = useState<string | null>(null);
  const cancelIntent = useRef(false);
  const active = useRef<string | null>(null);
  useEffect(
    () => () => {
      cancelIntent.current = true;
    },
    [],
  );

  async function cancel() {
    // Intent precedes IPC: a failed request must never let the completed artefact be applied.
    cancelIntent.current = true;
    if (active.current) return cancelDownloadJob(active.current, t("Common.Error"));
  }

  async function upgrade(catalog: DefaultEngine, progressId: string) {
    if (active.current) return;
    cancelIntent.current = false;
    active.current = progressId;
    setActiveId(progressId);
    try {
      await runDownloadJob(progressId, async (ticket) => {
        const installed = await installCatalogEngine(catalog, progressId, ticket);
        // Reject inside the job owner so its terminal progress is cleared before idle (CR-1).
        if (cancelIntent.current) throw cancellationError();
        let previous: LocalEngine | undefined;
        const receipt = await saveEngines(
          (current) =>
            current.map((item) => {
              if (item.type !== "local" || item.id !== engine.id) return item;
              previous = item;
              return upgradeEngineFromCatalog(item, catalog, installed);
            }),
          "after-save",
        );
        if (!receipt.saved || !previous) throw new Error(t("Engines.SaveError"));
        setUpgradedLink(catalog.downloadLink ?? null);
        try {
          await tauri.retireEngineBinary(previous.id, previous.handle);
        } catch (cause) {
          notifyUnlessCancelled(t("Common.Error"), cause);
        }
        for (const [key, save] of [
          ["game-player1-settings", savePlayer1],
          ["game-player2-settings", savePlayer2],
        ] as const) {
          try {
            // Await owner hydration rather than reading an unwrap atom's human fallback.
            const storage = createEngineOwnerStorage(
              key,
              opponentSettingsSchema,
              defaultPlayerSettings,
            );
            const snapshot = await storage.getItem(key, defaultPlayerSettings);
            const next = upgradeOpponentEngine(snapshot, engine.id, catalog, installed);
            if (next === snapshot) continue;
            const saved = await save(next);
            if (!saved.saved) throw new Error(t("Engines.Upgrade.SnapshotSaveError"));
          } catch (cause) {
            notifyUnlessCancelled(t("Common.Error"), cause);
          }
        }
      });
    } catch (cause) {
      notifyUnlessCancelled(t("Common.Error"), cause);
    } finally {
      active.current = null;
      setActiveId(null);
    }
  }

  return (
    <AppModal
      opened={opened}
      onClose={() => {
        void cancel()?.catch(() => undefined);
        setOpened(false);
      }}
      title={t("Engines.Upgrade.Title")}
      size="80%"
    >
      {isLoading && (
        <Center>
          <Loader />
        </Center>
      )}
      {error ? (
        <Alert icon={<IconAlertCircle size="1rem" />} title={t("Common.Error")} color="red">
          {t(
            error instanceof EngineCatalogVerificationError
              ? "Engines.Upgrade.ErrorCatalog"
              : error instanceof EngineCapabilityQueryError
                ? "Engines.Upgrade.ErrorCapabilities"
                : "Engines.Upgrade.ErrorLoad",
          )}
        </Alert>
      ) : (
        <ScrollArea.Autosize mah={720} offsetScrollbars>
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
            {defaultEngines?.map((catalog) => {
              if (!catalog.downloadLink) return null;
              const id = `engine-upgrade:${engine.id}:${catalog.downloadLink}`;
              return (
                <UpgradeCard
                  key={id}
                  catalog={catalog}
                  id={id}
                  current={catalog.downloadLink === (upgradedLink ?? engine.downloadLink)}
                  busy={activeId !== null}
                  active={activeId === id}
                  upgrade={() => {
                    void upgrade(catalog, id);
                  }}
                  cancel={cancel}
                />
              );
            })}
          </SimpleGrid>
        </ScrollArea.Autosize>
      )}
    </AppModal>
  );
}

function UpgradeCard({
  catalog,
  id,
  current,
  busy,
  active,
  upgrade,
  cancel,
}: {
  catalog: DefaultEngine;
  id: string;
  current: boolean;
  busy: boolean;
  active: boolean;
  upgrade: () => void;
  cancel: () => Promise<void | { clearedGeneration: bigint | null }>;
}) {
  const { t } = useTranslation();
  const hasJob = useDownloadJob(id);
  return (
    <Paper withBorder radius="md" p={0}>
      <Group wrap="nowrap" gap={0}>
        {catalog.imageUrl && (
          <Box w="4rem" px="xs" style={{ flexShrink: 0 }}>
            <Image src={catalog.imageUrl} alt={catalog.name} fit="contain" />
          </Box>
        )}
        <Box p="sm" flex={1}>
          <Text tt="uppercase" c="dimmed" fw={700} size="xs">
            {t("Common.Engine")}
          </Text>
          <Text fw="bold" size="sm" mb="xs">
            {catalog.name} {catalog.version}
          </Text>
          <Group wrap="nowrap" gap="xs">
            <IconTrophy size="1rem" />
            <Text size="xs">{`${catalog.elo} ELO`}</Text>
          </Group>
          <Group wrap="nowrap" gap="xs" mb="xs">
            <IconDatabase size="1rem" />
            <Text size="xs">{formatBytes(catalog.downloadSize ?? 0)}</Text>
          </Group>
          <ProgressButton
            id={id}
            initInstalled={current}
            completeOnProgressSuccess={false}
            labels={{
              completed: t("Engines.Upgrade.Current"),
              action: t("Common.Install"),
              inProgress: t("Common.Downloading"),
              finalizing: t("Common.Extracting"),
            }}
            onClick={upgrade}
            onCancel={active || hasJob ? cancel : undefined}
            clearOnCancel={false}
            inProgress={active || hasJob}
            setInProgress={() => undefined}
            disabled={busy}
          />
        </Box>
      </Group>
    </Paper>
  );
}
