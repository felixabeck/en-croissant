import { tauri } from "@/platform/tauri";
import { Select, Stack } from "@mantine/core";
import { useAtomValue } from "jotai";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import useSWR from "swr";
import { notifyUnlessCancelled } from "@/components/files/notifyError";
import { activeTabAtom, enginesAtom } from "@/state/atoms";
import type { LocalEngine } from "@/utils/engines";
import EngineLogsView from "../../common/EngineLogsView";

export default function LogsPanel() {
  const { t } = useTranslation();
  const engines = useAtomValue(enginesAtom);
  const localEngines = (engines ?? [])
    .filter((e): e is LocalEngine => e.type === "local")
    .filter((e) => e.loaded);
  const [engine, setEngine] = useState<LocalEngine | undefined>(localEngines[0]);

  const activeTab = useAtomValue(activeTabAtom);
  const { data, error, mutate } = useSWR(
    ["logs", engine?.id, activeTab],
    async () => (engine ? await tauri.getEngineLogs(engine.id, activeTab!) : undefined),
    {
      errorRetryCount: 0,
      onError: (cause) => notifyUnlessCancelled(t("Common.Error"), cause),
    },
  );

  return (
    <Stack flex={1} h="100%">
      {!error && data !== undefined && (
        <EngineLogsView
          logs={data}
          onRefresh={() => mutate()}
          additionalControls={
            <Select
              allowDeselect={false}
              value={engine?.id ?? ""}
              onChange={(id) => setEngine(localEngines.find((e) => e.id === id))}
              data={localEngines.map((e) => ({ value: e.id, label: e.name }))}
            />
          }
        />
      )}
    </Stack>
  );
}
