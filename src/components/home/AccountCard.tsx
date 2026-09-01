import { tauri, tauriSubscriptions } from "@/platform/tauri";
import { Badge, Card, Group, Progress, SimpleGrid, Stack, Text, Tooltip } from "@mantine/core";
import {
  IconArrowDownRight,
  IconArrowRight,
  IconArrowUpRight,
  IconCircleCheckFilled,
  IconDownload,
  type IconProps,
  IconRefresh,
  IconTrash,
} from "@tabler/icons-react";
import { useAtom } from "jotai";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { notifications } from "@mantine/notifications";
import type { DatabaseHandle, FileWorkspaceHandle, PathRef } from "@/bindings";
import { IconAction } from "@/components/common/IconAction";
import { databaseConversionStateAtom, downloadDestinationAtom } from "@/state/atoms";
import { downloadChessCom } from "@/utils/chess.com/api";
import { getDatabases, type ManagedDatabaseInfo } from "@/utils/db";
import { capitalize } from "@/utils/format";
import { downloadLichess } from "@/utils/lichess/api";
import { useTauriListener } from "@/platform/useTauriListener";
import { normalizeError, runWithAppliedRecovery } from "@/platform/errors";
import LichessLogo from "./LichessLogo";

interface AccountCardProps {
  type: "lichess" | "chesscom";
  database: ManagedDatabaseInfo | null;
  title: string;
  updatedAt: number;
  total: number;
  stats: {
    value: number;
    label: string;
    diff?: number;
  }[];
  logout: () => void | Promise<void>;
  reload: () => void;
  setDatabases: (databases: ManagedDatabaseInfo[]) => void;
  authenticated?: boolean;
  accountHandle?: string;
}

/**
 * An account with no games at all leaves the total at zero. The unguarded
 * division rendered `aria-valuenow="NaN"` and a `NaN%` bar width, which Axe
 * reports as an invalid ARIA attribute value.
 */
export function downloadProgressPercent(downloaded: number, total: number): number {
  return total === 0 ? 0 : (downloaded / total) * 100;
}

function isPathRef(value: unknown): value is PathRef {
  return (
    typeof value === "object" && value !== null && "id" in value && typeof value.id === "string"
  );
}

export async function ensureAccountDatabaseHandle(
  existing: DatabaseHandle | undefined,
  title: string,
  type: "lichess" | "chesscom",
): Promise<DatabaseHandle> {
  if (existing) return existing;
  const root = await tauri.getDatabaseWorkspace();
  const filename = `${title}_${type}.db3`;
  const registered = (await tauri.listWorkspaceDatabases(root)).find(
    (candidate) => candidate.filename === filename,
  );
  if (registered) return registered.handle;
  return runWithAppliedRecovery(
    () => tauri.createWorkspaceDatabase(root, filename),
    async () =>
      (await tauri.listWorkspaceDatabases(root)).find(
        (candidate) => candidate.filename === filename,
      )?.handle,
  );
}

export function AccountCard({
  type,
  database,
  title,
  updatedAt,
  total,
  stats,
  logout,
  reload,
  setDatabases,
  authenticated,
  accountHandle,
}: AccountCardProps) {
  const { t } = useTranslation();
  const items = stats.map((stat) => {
    let color = "gray.5";
    let DiffIcon: React.FC<IconProps> = IconArrowRight;
    if (stat.diff) {
      const sign = Math.sign(stat.diff);
      if (sign === 1) {
        DiffIcon = IconArrowUpRight;
        color = "green";
      } else {
        DiffIcon = IconArrowDownRight;
        color = "red";
      }
    }
    return (
      <Group key={stat.label} justify="space-between" wrap="nowrap">
        <Text size="xs" c="dimmed" fw={700} tt="uppercase">
          {capitalize(stat.label)}
        </Text>
        <Group gap={4}>
          {stat.diff !== undefined && stat.diff !== 0 && (
            <Badge color={color} variant="light" size="xs" leftSection={<DiffIcon size="0.8rem" />}>
              {Math.abs(stat.diff)}
            </Badge>
          )}
          <Text fw={700} size="sm">
            {stat.value}
          </Text>
        </Group>
      </Group>
    );
  });
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [downloadDestination, setDownloadDestination] = useAtom(downloadDestinationAtom);
  const [, setConversionState] = useAtom(databaseConversionStateAtom);

  async function ensureDatabaseHandle(): Promise<DatabaseHandle> {
    return ensureAccountDatabaseHandle(database?.file, title, type);
  }

  async function convert(
    source: FileWorkspaceHandle,
    timestamp: number | null,
  ): Promise<DatabaseHandle> {
    const filename = title + (type === "lichess" ? " Lichess" : " Chess.com");
    const databaseHandle = await ensureDatabaseHandle();
    const progressLease = await tauri.startProgress(`${type}_${title}`);
    try {
      setConversionState((prev) => ({
        ...prev,
        inProgress: true,
        targetDatabasePath: databaseHandle,
        targetDatabaseTitle: filename,
        sourceFileName: `${title}_${type}.pgn`,
      }));
      await tauri.convertPgn(
        [source],
        databaseHandle,
        timestamp === null ? null : timestamp / 1000,
        filename,
        null,
      );
      await tauri.setProgressState(progressLease, 100, "succeeded");
      return databaseHandle;
    } catch (caught) {
      await tauri.setProgressState(progressLease, 0, "failed");
      throw caught;
    }
  }

  const subscribeProgress = useCallback(
    (listener: Parameters<typeof tauriSubscriptions.progress>[0]) =>
      tauriSubscriptions.progress(listener),
    [],
  );
  useTauriListener(subscribeProgress, async (e) => {
    if (e.payload.id === `${type}_${title}`) {
      setProgress(e.payload.progress);
      if (e.payload.finished) {
        setLoading(false);
        setDatabases(await getDatabases());
      } else {
        setLoading(true);
      }
    }
  });

  const downloadedGames = database?.type === "success" ? database.game_count : 0;
  const effectiveTotal = Math.max(total, downloadedGames);

  async function getLastGameDate({ database }: { database: ManagedDatabaseInfo }) {
    return await tauri.getLatestGameTimestamp(database.file);
  }

  async function ensureDownloadDestination(): Promise<PathRef> {
    if (isPathRef(downloadDestination)) return downloadDestination;
    if (downloadDestination !== null) setDownloadDestination(null);
    const result = await tauri.issueDownloadDestination();
    setDownloadDestination(result);
    return result;
  }

  return (
    <Card withBorder radius="md" padding="lg">
      <Card.Section withBorder inheritPadding py="xs">
        <Group justify="space-between">
          <Group>
            {type === "lichess" ? (
              <LichessLogo />
            ) : (
              <img width={30} height={30} src="/chesscom.png" alt="chess.com" />
            )}
            <Text fw={600} size="sm">
              {title}
            </Text>
            {type === "lichess" && authenticated && (
              <Tooltip label={t("Home.Accounts.Authenticated")}>
                <Text c="green" lh={0} style={{ cursor: "default" }}>
                  <IconCircleCheckFilled size="1.1rem" />
                </Text>
              </Tooltip>
            )}
          </Group>
          <Group gap={4}>
            <IconAction
              label={t("Home.Accounts.UpdateStats")}
              variant="subtle"
              color="gray"
              onClick={() => reload()}
            >
              <IconRefresh size="1rem" />
            </IconAction>
            <IconAction
              label={t("Home.Accounts.DownloadGames")}
              variant="subtle"
              color="gray"
              pending={loading}
              disabled={loading || (type === "lichess" && !accountHandle)}
              onClick={async () => {
                setLoading(true);
                try {
                  const lastGameDate = database ? await getLastGameDate({ database }) : null;
                  if (type === "lichess") {
                    if (!accountHandle) throw new Error("Authenticated Lichess account required");
                    const destination = await ensureDownloadDestination();
                    const artifact = await downloadLichess(
                      accountHandle,
                      destination,
                      title,
                      lastGameDate,
                      total - downloadedGames,
                    );
                    const databaseHandle = await convert(artifact, lastGameDate);
                    await tauri.deleteEmptyGames(databaseHandle);
                  } else {
                    const destination = await ensureDownloadDestination();
                    const artifact = await downloadChessCom(destination, title, lastGameDate);
                    const databaseHandle = await convert(artifact, lastGameDate);
                    await tauri.deleteEmptyGames(databaseHandle);
                  }
                } catch (cause) {
                  notifications.show({
                    color: "red",
                    title: t("Common.Error"),
                    message: normalizeError(cause).message,
                  });
                } finally {
                  setLoading(false);
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
              }}
            >
              <IconDownload size="1rem" />
            </IconAction>
            <IconAction
              label={t("Home.Accounts.RemoveAccount")}
              variant="subtle"
              color="red"
              onClick={() => void logout()}
            >
              <IconTrash size="1rem" />
            </IconAction>
          </Group>
        </Group>
      </Card.Section>

      <Card.Section inheritPadding py="md">
        <SimpleGrid cols={1} spacing="xs">
          {items}
        </SimpleGrid>
      </Card.Section>

      <Card.Section inheritPadding pb="sm">
        <Stack gap={4}>
          <Group justify="space-between">
            <Text size="xs" c="dimmed">
              {t("Common.Games")}
            </Text>
            <Text size="xs" fw={500}>
              {downloadedGames} / {effectiveTotal}
            </Text>
          </Group>
          <Progress
            // An account with no games at all makes `effectiveTotal` zero; the
            // unguarded division rendered `aria-valuenow="NaN"` and a NaN width.
            value={loading ? 100 : downloadProgressPercent(downloadedGames, effectiveTotal)}
            // Mantine puts `role="progressbar"` on the inner section and forwards
            // `aria-label` to it, so the bar is named rather than anonymous.
            aria-label={t("Home.Accounts.GamesProgress", {
              downloaded: downloadedGames,
              total: effectiveTotal,
            })}
            size="sm"
            striped={loading}
            animated={loading}
          />
          <Group justify="space-between" mt={4}>
            <Text size="xs" c="dimmed">
              {t("Home.Accounts.LastUpdate", {
                date: new Date(updatedAt).toLocaleDateString(),
                interpolation: { escapeValue: false },
              })}
            </Text>
            {loading && progress && (
              <Text size="xs" c="dimmed">
                {progress.toFixed(0)}%
              </Text>
            )}
          </Group>
        </Stack>
      </Card.Section>
    </Card>
  );
}
