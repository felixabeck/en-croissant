import { expect, test } from "vitest";
import type { Engine } from "@/utils/engines";
import { projectAnalysisSettings, type AnalysisSettings } from "./analysisSettings";

test("projection preserves local and missing-owner settings and uses only the supplied synced source", () => {
    const local: AnalysisSettings = {
        enabled: false,
        synced: false,
        settings: [{ type: "string", name: "Hash", value: "16" }],
        go: { t: "Depth", c: 7 },
    };
    const engine: Engine = {
        type: "lichess",
        id: "source",
        name: "Source",
        url: "https://example.com",
        settings: [{ type: "string", name: "Hash", value: "64" }],
        go: { t: "Depth", c: 12 },
    };
    const synced = { ...local, synced: true };
    expect(projectAnalysisSettings(local, engine)).toBe(local);
    expect(projectAnalysisSettings(synced, undefined)).toBe(synced);
    const committed = projectAnalysisSettings(synced, engine);
    const draft = projectAnalysisSettings(synced, { ...engine, go: { t: "Depth", c: 20 } });
    expect(committed).toEqual({ ...synced, go: engine.go, settings: engine.settings });
    expect(draft).toEqual({ ...committed, go: { t: "Depth", c: 20 } });
    expect(
        projectAnalysisSettings(synced, { ...engine, settings: undefined, go: undefined }),
    ).toEqual({ ...synced, settings: [], go: { t: "Infinite" } });
    expect(local.go).toEqual({ t: "Depth", c: 7 });
    expect(engine.go).toEqual({ t: "Depth", c: 12 });
});
