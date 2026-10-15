import type { GoMode } from "@/bindings";
import type { Engine, EngineSettings } from "@/utils/engines";

export type AnalysisSettings = {
    enabled: boolean;
    settings: EngineSettings;
    go: GoMode;
    synced: boolean;
};

/** The caller selects committed or draft defaults without changing the tab-owned flags. */
export function projectAnalysisSettings(
    settings: AnalysisSettings,
    engine: Engine | undefined,
): AnalysisSettings {
    if (!settings.synced || !engine) return settings;
    return { ...settings, settings: engine.settings ?? [], go: engine.go ?? { t: "Infinite" } };
}
