import { tauri, tauriSubscriptions } from "@/platform/tauri";
import { Badge, Card, Group, Progress, SimpleGrid, Stack, Text, Tooltip } from "@mantine/core";
import { notifications } from "@mantine/notifications";
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
import { useAtom, useStore } from "jotai";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useSWRConfig } from "swr";
import { useNativeRequestOwner } from "@/hooks/useNativeRequestOwner";
import type { ArtifactPublication, DatabaseHandle, FileWorkspaceHandle, PathRef } from "@/bindings";
import { IconAction } from "@/components/common/IconAction";
import {
  notifyListenerError,
  notifyUnlessCancelled,
  runUnlessCancelled,
} from "@/components/files/notifyError";
import {
  accountDownloadsInFlightAtom,
  databaseConversionStateAtom,
  downloadDestinationAtom,
  runDatabaseConversion,
} from "@/state/atoms";
import { downloadChessCom } from "@/utils/chess.com/api";
import { getDatabases, type ManagedDatabaseInfo } from "@/utils/db";
import { accountDatabaseFilename } from "./accountDatabase";
import { capitalize } from "@/utils/format";
import { downloadLichess } from "@/utils/lichess/api";
import { useTauriListener } from "@/platform/useTauriListener";
import { logFailureSafely, runWithAppliedRecovery, safeFailureContext } from "@/platform/errors";
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
  reload: () => void | Promise<void>;
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
  const filename = accountDatabaseFilename(title, type);
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

function logProgressUpdateFailure(context: {
  conversionId: string;
  progressId: string;
  state: "failed" | "succeeded";
}): (cause: unknown) => Promise<void> {
  return async (cause) => {
    const primaryFailure = safeFailureContext(cause);
    await logFailureSafely(
      `Account import progress update (${context.state}) failed for ${context.progressId} [${context.conversionId}]: ${primaryFailure.message}`,
      { operation: "account import progress update", primaryFailure },
      `Account import progress logging failed (${context.state}) for ${context.progressId} [${context.conversionId}]`,
    );
  };
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
  authenticated,
  accountHandle,
}: AccountCardProps) {
  const { t } = useTranslation();
  const { mutate } = useSWRConfig();
  const databaseOwner = useNativeRequestOwner("databases");
  const accountKey = `${type}_${title}`;
  const store = useStore();
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
      <Group key={stat.label} justify="space-between" wrap="wrap" miw={0}>
        <Text size="xs" c="dimmed" fw={700} tt="uppercase" miw={0} className="wrap-anywhere">
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
  const [downloadsInFlight, setDownloadsInFlight] = useAtom(accountDownloadsInFlightAtom);
  const pending = downloadsInFlight.has(accountKey);
  const [progress, setProgress] = useState<number | null>(null);
  const [downloadDestination, setDownloadDestination] = useAtom(downloadDestinationAtom);
  const [, setConversionState] = useAtom(databaseConversionStateAtom);

  async function ensureDatabaseHandle(): Promise<DatabaseHandle> {
    return ensureAccountDatabaseHandle(database?.file, title, type);
  }

  async function convert(
    source: FileWorkspaceHandle,
    timestamp: number | null,
    ticket: string,
  ): Promise<DatabaseHandle> {
    const databaseTitle = title + (type === "lichess" ? " Lichess" : " Chess.com");
    return runDatabaseConversion(
      setConversionState,
      {
        targetDatabase: database?.file ?? null,
        targetDatabaseTitle: databaseTitle,
        sourceFileName: `${title}_${type}.pgn`,
      },
      async ({ id, setTarget }) => {
        const databaseHandle = await ensureDatabaseHandle();
        setTarget(databaseHandle);
        const progressLease = await tauri.startProgress(ticket);
        try {
          await tauri.convertPgn(
            id,
            [source],
            databaseHandle,
            timestamp === null ? null : timestamp / 1000,
            databaseTitle,
            null,
          );
        } catch (caught) {
          await tauri.setProgressState(progressLease, 0, "failed").catch(
            logProgressUpdateFailure({
              conversionId: id,
              progressId: ticket,
              state: "failed",
            }),
          );
          throw caught;
        }
        await tauri.setProgressState(progressLease, 100, "succeeded").catch(
          logProgressUpdateFailure({
            conversionId: id,
            progressId: ticket,
            state: "succeeded",
          }),
        );
        return databaseHandle;
      },
    );
  }

  useTauriListener(
    tauriSubscriptions.progress,
    (e) => {
      const ticket = store.get(accountDownloadsInFlightAtom).get(accountKey);
      if (typeof ticket === "string" && e.payload.id === ticket) {
        setProgress(e.payload.progress);
      }
    },
    { onError: notifyListenerError },
  );

  const downloadedGames = database?.type === "success" ? database.game_count : 0;
  const effectiveTotal = Math.max(total, downloadedGames);

  async function getLastGameDate({ database }: { database: ManagedDatabaseInfo }) {
    return await tauri.getLatestGameTimestamp(database.file);
  }

  async function ensureDownloadDestination(): Promise<PathRef> {
    if (isPathRef(downloadDestination)) {
      if (await tauri.downloadDestinationIsKnown(downloadDestination)) {
        return downloadDestination;
      }
      setDownloadDestination(null);
    } else if (downloadDestination !== null) {
      setDownloadDestination(null);
    }
    const result = await tauri.issueDownloadDestination();
    setDownloadDestination(result);
    return result;
  }

  async function refreshDatabases(importFailed: boolean): Promise<void> {
    try {
      // Supersede older listings, publish an owned fresh read, then let SWR revalidate mounted
      // consumers after mutation settles, including a remount that retired the refresh read.
      await databaseOwner!.supersede();
      await mutate(
        "databases",
        databaseOwner!.run((signal) => getDatabases({ signal })),
      );
    } catch (refreshCause) {
      if (!importFailed) throw refreshCause;
      const primaryFailure = safeFailureContext(refreshCause);
      await logFailureSafely(
        `Account import database refresh failed for ${accountKey}: ${primaryFailure.message}`,
        { operation: "account import database refresh", primaryFailure },
        `Account import refresh logging failed for ${accountKey}`,
      );
    }
  }

  return (
    <Card withBorder radius="md" padding="lg">
      <Card.Section withBorder inheritPadding py="xs">
        <Group justify="space-between">
          <Group wrap="wrap" miw={0}>
            {type === "lichess" ? (
              <LichessLogo />
            ) : (
              <img width={30} height={30} src="/chesscom.png" alt="chess.com" />
            )}
            <Text fw={600} size="sm" miw={0} className="wrap-anywhere">
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
              onClick={() =>
                void runUnlessCancelled(t("Common.Error"), async () => {
                  await reload();
                })
              }
            >
              <IconRefresh size="1rem" />
            </IconAction>
            <IconAction
              label={t("Home.Accounts.DownloadGames")}
              variant="subtle"
              color="gray"
              pending={pending}
              disabled={pending || (type === "lichess" && !accountHandle)}
              onClick={async () => {
                if (store.get(accountDownloadsInFlightAtom).has(accountKey)) return;
                setDownloadsInFlight((previous) => new Map(previous).set(accountKey, null));
                try {
                  let ticket!: string;
                  const onTicket = (downloadTicket: string) => {
                    ticket = downloadTicket;
                    setDownloadsInFlight((previous) =>
                      new Map(previous).set(accountKey, downloadTicket),
                    );
                  };
                  const lastGameDate = database ? await getLastGameDate({ database }) : null;
                  let publication: ArtifactPublication;
                  if (type === "lichess") {
                    if (!accountHandle) throw new Error("Authenticated Lichess account required");
                    const destination = await ensureDownloadDestination();
                    publication = await downloadLichess(
                      accountHandle,
                      destination,
                      title,
                      lastGameDate,
                      total - downloadedGames,
                      onTicket,
                    );
                  } else {
                    const destination = await ensureDownloadDestination();
                    publication = await downloadChessCom(
                      destination,
                      title,
                      lastGameDate,
                      onTicket,
                    );
                  }
                  if (publication.durability !== "Durable") {
                    notifications.show({
                      message: t("Home.Accounts.DownloadDurabilityUncertain", {
                        defaultValue:
                          "The games were downloaded, but the save could not be fully confirmed. Do not retry.",
                      }),
                      color: "orange",
                    });
                  }
                  let importFailed = true;
                  try {
                    const databaseHandle = await convert(publication.handle, lastGameDate, ticket);
                    await tauri.deleteEmptyGames(databaseHandle);
                    importFailed = false;
                  } finally {
                    await refreshDatabases(importFailed);
                  }
                } catch (cause) {
                  notifyUnlessCancelled(t("Common.Error"), cause, "database");
                } finally {
                  setDownloadsInFlight((previous) => {
                    if (!previous.has(accountKey)) return previous;
                    const next = new Map(previous);
                    next.delete(accountKey);
                    return next;
                  });
                }
              }}
            >
              <IconDownload size="1rem" />
            </IconAction>
            <IconAction
              label={t("Home.Accounts.RemoveAccount")}
              variant="subtle"
              color="red"
              onClick={() =>
                void runUnlessCancelled(t("Common.Error"), async () => {
                  await logout();
                })
              }
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
            value={pending ? 100 : downloadProgressPercent(downloadedGames, effectiveTotal)}
            // Mantine puts `role="progressbar"` on the inner section and forwards
            // `aria-label` to it, so the bar is named rather than anonymous.
            aria-label={t("Home.Accounts.GamesProgress", {
              downloaded: downloadedGames,
              total: effectiveTotal,
            })}
            size="sm"
            striped={pending}
            animated={pending}
          />
          <Group justify="space-between" mt={4}>
            <Text size="xs" c="dimmed" miw={0} className="wrap-anywhere">
              {t("Home.Accounts.LastUpdate", {
                date: new Date(updatedAt).toLocaleDateString(),
                interpolation: { escapeValue: false },
              })}
            </Text>
            {pending && progress && (
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
