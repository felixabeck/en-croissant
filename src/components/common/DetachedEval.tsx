import { Group, Paper, Text, useMantineTheme } from "@mantine/core";
import { IconPinnedOff, IconPlayerPause, IconPlayerPlay } from "@tabler/icons-react";
import { useAtom, useAtomValue } from "jotai";
import { memo, useContext } from "react";
import { useTranslation } from "react-i18next";
import { useStore } from "zustand";
import { useShallow } from "zustand/react/shallow";
import {
  activeTabAtom,
  currentDetachedEngineAtom,
  enginesAtom,
  tabEngineSettingsFamily,
} from "@/state/atoms";
import { getVariationLine } from "@/utils/chess";
import type { Engine } from "@/utils/engines";
import { useDisplayedEngineLines } from "../panels/analysis/useDisplayedEngineLines";
import ScoreBubble from "../panels/analysis/ScoreBubble";
import IconAction from "./IconAction";
import { TreeStateContext } from "./TreeStateContext";

function DetachedEval() {
  const [detachedEngineId, setDetachedEngineId] = useAtom(currentDetachedEngineAtom);
  const engines = useAtomValue(enginesAtom);

  if (!detachedEngineId || !engines) return null;

  const engine = engines.find((e) => e.id === detachedEngineId);
  if (!engine || !engine.loaded) {
    return null;
  }

  return <DetachedEvalInner engine={engine} onClose={() => setDetachedEngineId(null)} />;
}

const DetachedEvalInner = memo(function DetachedEvalInner({
  engine,
  onClose,
}: {
  engine: Engine;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const activeTab = useAtomValue(activeTabAtom);
  const store = useContext(TreeStateContext)!;
  const rootFen = useStore(store, (s) => s.root.fen);
  const moves = useStore(
    store,
    useShallow((s) => getVariationLine(s.root, s.position)),
  );
  const theme = useMantineTheme();

  const [settings, setSettings] = useAtom(
    tabEngineSettingsFamily({
      engineId: engine.id,
      defaultSettings: engine.settings ?? undefined,
      defaultGo: engine.go ?? undefined,
      tab: activeTab!,
    }),
  );

  const {
    lines: engineVariations,
    dimmed,
    isGameOver,
  } = useDisplayedEngineLines(engine, rootFen, moves);

  const hasData = engineVariations && engineVariations.length > 0 && !isGameOver;
  const topLine = hasData ? engineVariations[0] : null;

  return (
    <Paper withBorder px="sm" py={6}>
      <Group gap="xs" wrap="nowrap" justify="space-between">
        <Group gap="xs" wrap="nowrap" style={{ flex: 1, minWidth: 0 }}>
          <IconAction
            label={t(settings.enabled ? "Engine.PauseAnalysis" : "Engine.StartAnalysis")}
            size="sm"
            variant={settings.enabled ? "filled" : "transparent"}
            color={theme.primaryColor}
            onClick={() => setSettings((s) => ({ ...s, enabled: !s.enabled }))}
            pressed={settings.enabled}
          >
            {settings.enabled ? (
              <IconPlayerPause size="0.875rem" />
            ) : (
              <IconPlayerPlay size="0.875rem" />
            )}
          </IconAction>
          <Text fw={700} fz="sm" style={{ whiteSpace: "nowrap" }}>
            {engine.name}
          </Text>
          {topLine ? (
            <>
              <Group
                gap="xs"
                wrap="nowrap"
                flex={1}
                miw={0}
                opacity={dimmed ? 0.5 : 1}
                inert={dimmed}
              >
                <ScoreBubble size="sm" score={topLine.score} />
                <Text
                  fz="xs"
                  c="dimmed"
                  style={{
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    flex: 1,
                    minWidth: 0,
                  }}
                >
                  {topLine.sanMoves.slice(0, 8).join(" ")}
                </Text>
              </Group>
            </>
          ) : (
            <Text fz="xs" c="dimmed" lh={"1.6rem"}>
              {isGameOver ? t("Board.Analysis.GameOver") : "—"}
            </Text>
          )}
        </Group>
        <IconAction label={t("Engine.Unpin")} size="sm" variant="subtle" onClick={onClose}>
          <IconPinnedOff size="0.875rem" />
        </IconAction>
      </Group>
    </Paper>
  );
});

export default memo(DetachedEval);
