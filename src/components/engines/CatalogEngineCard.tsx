import { Box, Group, Image, Paper, Text } from "@mantine/core";
import { IconDatabase, IconTrophy } from "@tabler/icons-react";
import type { ComponentProps } from "react";
import { useTranslation } from "react-i18next";
import type { DefaultEngine } from "@/utils/engines";
import { formatBytes } from "@/utils/format";
import ProgressButton from "../common/ProgressButton";

type Props = Omit<
  ComponentProps<typeof ProgressButton>,
  "id" | "completeOnProgressSuccess" | "clearOnCancel" | "leftIcon" | "redoable"
> & {
  engine: DefaultEngine;
  progressId: string | null;
  layout: "add" | "upgrade";
};

export default function CatalogEngineCard({ engine, progressId, layout, ...progressProps }: Props) {
  const { t } = useTranslation();
  const adding = layout === "add";

  return (
    <Paper withBorder radius="md" p={0}>
      <Group wrap="nowrap" gap={0} grow={adding || undefined}>
        {engine.imageUrl && (
          <Box
            w={adding ? "1.75rem" : "4rem"}
            px="xs"
            style={adding ? undefined : { flexShrink: 0 }}
          >
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
          <Group wrap="nowrap" gap="xs" fz={adding ? "xs" : undefined}>
            <IconTrophy size="1rem" />
            <Text size="xs">{`${engine.elo} ELO`}</Text>
          </Group>
          <Group wrap="nowrap" gap="xs" mb="xs" fz={adding ? "xs" : undefined}>
            <IconDatabase size="1rem" />
            <Text size="xs">{formatBytes(engine.downloadSize ?? 0)}</Text>
          </Group>
          {progressId && (
            <ProgressButton
              {...progressProps}
              id={progressId}
              completeOnProgressSuccess={false}
              clearOnCancel={false}
            />
          )}
        </Box>
      </Group>
    </Paper>
  );
}
