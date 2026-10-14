import { Center, Checkbox, Group, Paper, ScrollArea, Stack, Text } from "@mantine/core";
import { IconCloud, IconCpu } from "@tabler/icons-react";
import { Link } from "@tanstack/react-router";
import { useAtom } from "jotai";
import { memo } from "react";
import { Trans, useTranslation } from "react-i18next";
import LocalImage from "@/components/common/LocalImage";
import { notifyUnlessCancelled } from "@/components/files/notifyError";
import { enginesAtom } from "@/state/atoms";
import { type Engine } from "@/utils/engines";

function EngineBox({ engine, toggleLoaded }: { engine: Engine; toggleLoaded: () => void }) {
  return (
    <Paper withBorder p="sm" w="100%" h="3rem" onClick={toggleLoaded} style={{ cursor: "pointer" }}>
      <Group wrap="nowrap">
        <Checkbox checked={!!engine.loaded} onChange={() => {}} />
        {engine.imageHandle ? (
          <LocalImage image={engine.imageHandle} alt={engine.name} w="1.5rem" />
        ) : engine.type !== "local" ? (
          <IconCloud size="1.5rem" />
        ) : (
          <IconCpu size="1.5rem" />
        )}
        <Text lineClamp={1} fz="sm">
          {engine.name}
        </Text>
      </Group>
    </Paper>
  );
}

function EngineSelection() {
  const [engines, setEngines] = useAtom(enginesAtom);
  const { t } = useTranslation();

  if (!engines) return null;

  return (
    <>
      {engines.length === 0 && (
        <Center>
          <Text>
            <Trans
              i18nKey="Engines.Selection.None"
              components={{
                addEngineLink: <Link to="/engines" />,
              }}
            />
          </Text>
        </Center>
      )}

      <ScrollArea h={250} scrollbars="y">
        <Stack gap="xs" align="center" w="100%">
          {engines.map((engine) => (
            <EngineBox
              key={engine.id}
              engine={engine}
              toggleLoaded={() => {
                void setEngines(async (prev) =>
                  (await prev).map((e) => (e.id === engine.id ? { ...e, loaded: !e.loaded } : e)),
                ).catch((error) => notifyUnlessCancelled(t("Common.Error"), error));
              }}
            />
          ))}
        </Stack>
      </ScrollArea>
    </>
  );
}

export default memo(EngineSelection);
