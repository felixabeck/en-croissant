import {
  Badge,
  Box,
  Divider,
  Group,
  ScrollArea,
  SegmentedControl,
  Stack,
  Text,
  TextInput,
  Tooltip,
} from "@mantine/core";
import { IconFileExport, IconFilter, IconRefresh, IconTerminal2 } from "@tabler/icons-react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { tauri } from "@/platform/tauri";
import { useAtomValue } from "jotai";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { EngineLog } from "@/bindings";
import { fontSizeAtom } from "@/state/atoms";
import { IconAction } from "./IconAction";

export type LogsFilter = "all" | "gui" | "engine";

export function truncatedLogCount(logs: EngineLog[]) {
  return logs.reduce(
    (count, log) => (log.type === "truncated" ? count + Number(log.value.droppedEntries) : count),
    0,
  );
}

interface EngineLogsViewProps {
  logs: EngineLog[];
  onRefresh?: () => void;
  additionalControls?: React.ReactNode;
}

export default function EngineLogsView({
  logs,
  onRefresh,
  additionalControls,
}: EngineLogsViewProps) {
  const { t } = useTranslation();
  const [filter, setFilter] = useState<LogsFilter>("all");
  const [search, setSearch] = useState("");
  const viewportRef = useRef<HTMLDivElement>(null);
  const fontSize = useAtomValue(fontSizeAtom);

  const filteredLogs = useMemo(
    () =>
      logs.filter((log) => {
        if (log.type === "truncated") return filter === "all";
        if (filter === "gui" && log.type !== "gui") return false;
        if (filter === "engine" && log.type !== "engine") return false;
        if (search && !log.value.toLowerCase().includes(search.toLowerCase())) return false;
        return true;
      }),
    [logs, filter, search],
  );

  useEffect(() => {
    if (viewportRef.current && !search) {
      viewportRef.current.scrollTo({
        top: viewportRef.current.scrollHeight,
      });
    }
  }, [logs.length, search]);

  async function exportLogs() {
    const content = logs
      .map((line) =>
        line.type === "truncated"
          ? `metadata, ${t("Engines.Logs.Truncated", "{{count}} older log entries omitted", {
              count: Number(line.value.droppedEntries),
            })}`
          : `${line.type}, ${line.value.trimEnd()}`,
      )
      .join("\n");
    await tauri.saveEngineLogs(content);
  }

  const rowVirtualizer = useVirtualizer({
    count: filteredLogs.length,
    estimateSize: () => 30 * (fontSize / 100),
    getScrollElement: () => viewportRef.current,
  });

  return (
    <Stack flex={1} h="100%" gap={0}>
      <Group w="100%" gap="xs" wrap="nowrap" pr="sm">
        <Group gap={0} style={{ flexShrink: 0 }}>
          {onRefresh && (
            <IconAction
              label={t("Engines.Logs.Refresh", { defaultValue: "Refresh logs" })}
              size="lg"
              variant="default"
              onClick={onRefresh}
            >
              <IconRefresh size="1.1rem" />
            </IconAction>
          )}
          <IconAction
            label={t("Engines.Logs.Export", { defaultValue: "Export logs" })}
            size="lg"
            variant="default"
            onClick={() => void exportLogs()}
          >
            <IconFileExport size="1.1rem" />
          </IconAction>
        </Group>

        <SegmentedControl
          value={filter}
          onChange={(value) => setFilter(value as LogsFilter)}
          data={[
            { value: "all", label: t("Engines.Logs.Filter.All", { defaultValue: "All" }) },
            { value: "gui", label: t("Engines.Logs.Filter.Gui", { defaultValue: "GUI" }) },
            {
              value: "engine",
              label: t("Engines.Logs.Filter.Engine", { defaultValue: "Engine" }),
            },
          ]}
        />

        <TextInput
          aria-label={t("Engines.Logs.Filter.Label", { defaultValue: "Filter logs" })}
          placeholder={t("Engines.Logs.Filter.Placeholder", { defaultValue: "Filter logs..." })}
          leftSection={<IconFilter size="0.9rem" />}
          value={search}
          onChange={(e) => setSearch(e.currentTarget.value)}
          style={{ flexGrow: 1, minWidth: 0 }}
        />

        {additionalControls}
      </Group>
      <Divider mt="sm" />

      {filteredLogs.length === 0 ? (
        <Stack align="center" justify="center" flex={1} gap="xs">
          <IconTerminal2 size="2.5rem" opacity={0.3} />
          <Text ta="center" c="dimmed" fz="sm">
            {logs.length === 0
              ? t("Engines.Logs.Empty", { defaultValue: "No logs available yet" })
              : t("Engines.Logs.NoMatch", { defaultValue: "No logs match the current filter" })}
          </Text>
        </Stack>
      ) : (
        <ScrollArea flex={1} viewportRef={viewportRef}>
          <Box
            style={{
              height: rowVirtualizer.getTotalSize(),
              width: "100%",
              position: "relative",
              fontFamily: "monospace",
            }}
          >
            {rowVirtualizer.getVirtualItems().map((virtualRow) => (
              <LogLine
                key={virtualRow.index}
                log={filteredLogs[virtualRow.index]}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  height: virtualRow.size,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              />
            ))}
          </Box>
        </ScrollArea>
      )}
    </Stack>
  );
}

function LogLine({ log, style }: { log: EngineLog; style: React.CSSProperties }) {
  const { t } = useTranslation();
  if (log.type === "truncated") {
    const message = t("Engines.Logs.Truncated", "{{count}} older log entries omitted", {
      count: Number(log.value.droppedEntries),
    });
    return (
      <Box
        role="status"
        aria-label={t(
          "Engines.Logs.TruncatedA11y",
          "Log history truncated: {{count}} entries omitted",
          { count: Number(log.value.droppedEntries) },
        )}
        px="xs"
        style={{
          ...style,
          borderBottom: "1px solid var(--mantine-color-dark-5)",
        }}
      >
        <Text fz="xs" c="dimmed" fs="italic">
          {message}
        </Text>
      </Box>
    );
  }
  const isGui = log.type === "gui";
  return (
    <Group
      gap="xs"
      wrap="nowrap"
      align="center"
      px="xs"
      style={{
        ...style,
        borderBottom: "1px solid var(--mantine-color-dark-5)",
      }}
    >
      <Badge variant="light" color={isGui ? "blue" : "teal"} w="3.5rem" style={{ flexShrink: 0 }}>
        {isGui
          ? t("Engines.Logs.Source.Gui", { defaultValue: "GUI" })
          : t("Engines.Logs.Source.Engine", { defaultValue: "ENG" })}
      </Badge>
      <Tooltip
        label={log.value.trim()}
        multiline
        maw={500}
        withArrow
        openDelay={400}
        styles={{ tooltip: { fontFamily: "monospace", fontSize: "0.75rem" } }}
      >
        <Text
          lineClamp={1}
          fz="xs"
          ff="monospace"
          c={isGui ? "blue.3" : "dimmed"}
          style={{ userSelect: "text", cursor: "default" }}
        >
          {log.value.trim()}
        </Text>
      </Tooltip>
    </Group>
  );
}
