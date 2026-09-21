import { Select } from "@mantine/core";
import { useAtomValue } from "jotai";
import { useEffect, useMemo } from "react";
import { enginesAtom } from "@/state/atoms";
import type { LocalEngine } from "@/utils/engines";

export function EnginesSelect({
  engine,
  setEngine,
}: {
  engine: LocalEngine | null;
  setEngine: (engine: LocalEngine | null) => void;
}) {
  const allEngines = useAtomValue(enginesAtom);
  const engines = useMemo(
    () => (allEngines ?? []).filter((e): e is LocalEngine => e.type === "local"),
    [allEngines],
  );

  useEffect(() => {
    // `enginesAtom` unwraps an async store, so `undefined` means "not hydrated yet". That is
    // not the same as "no engines left", and reconciling against it would drop a valid
    // selection on every mount.
    if (allEngines === undefined) return;
    if (engine === null) {
      if (engines.length > 0) {
        setEngine(engines[0]);
      }
      return;
    }
    const updatedEngine = engines.find((e) => e.id === engine.id);
    if (!updatedEngine) {
      // Removing an engine permanently retires its application id (d-20260901-17), so a
      // selection that outlives the removal can only configure a game the supervisor refuses
      // to start. `null` reaches the already-handled `missing-local-engine` command error.
      setEngine(engines[0] ?? null);
      return;
    }
    if (updatedEngine !== engine) {
      setEngine(updatedEngine);
    }
  }, [allEngines, engine, engines, setEngine]);

  return (
    <Select
      allowDeselect={false}
      data={engines.map((engine) => ({
        label: engine.name,
        value: engine.id,
      }))}
      value={engine?.id ?? ""}
      onChange={(e) => {
        setEngine(engines.find((engine) => engine.id === e) ?? null);
      }}
    />
  );
}
