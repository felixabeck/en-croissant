import { Checkbox, Group, type MantineColor, Stack, Text } from "@mantine/core";
import { IconPlayerStopFilled, IconSettings } from "@tabler/icons-react";
import { useNavigate } from "@tanstack/react-router";
import { useAtomValue } from "jotai";
import { memo, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { GoMode } from "@/bindings";
import GoModeInput from "@/components/common/GoModeInput";
import { IconAction } from "@/components/common/IconAction";
import { activeTabAtom, enginesAtom } from "@/state/atoms";
import { type Engine, type EngineSettings, killEngine } from "@/utils/engines";
import CoresSlider from "./CoresSlider";
import HashSlider from "./HashSlider";
import LinesSlider from "./LinesSlider";

export type Settings = {
  enabled: boolean;
  go: GoMode;
  settings: EngineSettings;
  synced: boolean;
};

interface EngineSettingsProps {
  engine: Engine;
  settings: Settings;
  setSettings: (fn: (prev: Settings) => Settings) => void;
  color?: MantineColor;
  minimal?: boolean;
  remote: boolean;
  gameMode?: boolean;
}

function EngineSettingsForm({
  engine,
  settings,
  setSettings,
  color,
  minimal,
  remote,
  gameMode,
}: EngineSettingsProps) {
  const { t } = useTranslation();

  const multipv = settings.settings.find((o) => o.name === "MultiPV");
  const threads = settings.settings.find((o) => o.name === "Threads");
  const hash = settings.settings.find((o) => o.name === "Hash");
  const activeTab = useAtomValue(activeTabAtom);

  const setGoMode = useCallback(
    (v: GoMode) => {
      setSettings((prev) => ({
        ...prev,
        go: v,
      }));
    },
    [setSettings],
  );

  return (
    <Stack>
      {!remote && !minimal && (
        <GoModeInput gameMode={gameMode} goMode={settings.go} setGoMode={setGoMode} />
      )}

      {!minimal && multipv && (
        <Group grow>
          <Text size="sm" fw="bold">
            {t("Engines.Settings.NumOfLines")}
          </Text>
          <LinesSlider
            value={Number(multipv.type === "string" ? multipv.value || 1 : 1)}
            setValue={(v) =>
              setSettings((prev) => {
                return {
                  ...prev,
                  settings: prev.settings.map((o) =>
                    o.name === "MultiPV" && o.type === "string"
                      ? { ...o, value: String(v || 1) }
                      : o,
                  ),
                };
              })
            }
            color={color}
          />
        </Group>
      )}

      {!remote && threads && (
        <>
          <Group grow>
            <Text size="sm" fw="bold">
              {t("Engines.Settings.NumOfCores")}
            </Text>
            <CoresSlider
              value={Number(threads.type === "string" ? threads.value || 1 : 1)}
              setValue={(v) =>
                setSettings((prev) => ({
                  ...prev,
                  settings: prev.settings.map((o) =>
                    o.name === "Threads" && o.type === "string"
                      ? { ...o, value: String(v || 1) }
                      : o,
                  ),
                }))
              }
              color={color}
            />
          </Group>

          {hash && (
            <Group grow>
              <Text size="sm" fw="bold">
                {t("Engines.Settings.SizeOfHash")}
              </Text>
              <HashSlider
                value={Number(hash.type === "string" ? hash.value || 1 : 1)}
                setValue={(v) =>
                  setSettings((prev) => ({
                    ...prev,
                    settings: prev.settings.map((o) =>
                      o.name === "Hash" && o.type === "string"
                        ? { ...o, value: String(v || 1) }
                        : o,
                    ),
                  }))
                }
                color={color}
              />
            </Group>
          )}
        </>
      )}
      {!minimal && (
        <Group>
          <SyncSettings settings={settings} engine={engine.name} setSettings={setSettings} />
          <Group gap={0}>
            {engine.type === "local" && (
              <IconAction
                label={t("Board.Analysis.KillEngine")}
                variant="default"
                onClick={() => {
                  killEngine(engine, activeTab!);
                  setSettings((prev) => ({
                    ...prev,
                    enabled: false,
                  }));
                }}
              >
                <IconPlayerStopFilled size="1rem" />
              </IconAction>
            )}
            <AdvancedSettings engineName={engine.name} />
          </Group>
        </Group>
      )}
    </Stack>
  );
}

function SyncSettings({
  engine,
  settings,
  setSettings,
}: {
  engine: string;
  settings: Settings;
  setSettings: (fn: (prev: Settings) => Settings) => void;
}) {
  const { t } = useTranslation();

  const engines = useAtomValue(enginesAtom);
  const engineDefault = useMemo(
    () => (engines ?? []).find((o) => o.name === engine)!,
    [engines, engine],
  );

  return (
    <Checkbox
      label={t("Board.Analysis.SyncGlobally")}
      checked={settings.synced}
      onChange={(e) => {
        if (e.currentTarget.checked) {
          setSettings((prev) => ({
            ...prev,
            go: engineDefault.go || prev.go,
            settings: engineDefault.settings || prev.settings,
            synced: true,
          }));
        } else {
          setSettings((prev) => ({
            ...prev,
            synced: false,
          }));
        }
      }}
    />
  );
}

function AdvancedSettings({ engineName }: { engineName: string }) {
  const { t } = useTranslation();

  const navigate = useNavigate();
  const engines = useAtomValue(enginesAtom);

  return (
    <IconAction
      label={t("Engines.Settings.AdvancedSettings")}
      variant="default"
      onClick={() =>
        navigate({
          to: "/engines",
          search: {
            selected: (engines ?? []).findIndex((o) => o.name === engineName),
          },
        })
      }
    >
      <IconSettings size="1rem" />
    </IconAction>
  );
}

export default memo(EngineSettingsForm);
