import { expect, test } from "vitest";
import type { EngineOption, GoMode } from "@/bindings";
import type { LocalEngine } from "@/utils/engines";
import type { OpponentSettings } from "./OpponentForm";
import { toPlayerConfig } from "./playerConfig";

const handle = { id: { id: "engine-path-ref" }, kind: "engine" } as LocalEngine["handle"];

const engine: LocalEngine = {
    type: "local",
    id: "engine-application-id",
    name: "Engine",
    version: "17",
    filename: "engine",
    handle,
    settings: [
        { type: "string", name: "MultiPV", value: "4" },
        { type: "string", name: "Threads", value: "2" },
    ],
} as LocalEngine;

function engineOpponent(overrides: Partial<Extract<OpponentSettings, { type: "engine" }>> = {}) {
    return {
        type: "engine",
        engine,
        go: { t: "Depth", c: 20 } satisfies GoMode,
        ...overrides,
    } as OpponentSettings;
}

test("engine player config carries the immutable application engine id and the engine handle", () => {
    expect(toPlayerConfig(engineOpponent())).toEqual({
        type: "engine",
        name: "Engine",
        engineId: "engine-application-id",
        handle,
        options: [{ type: "string", name: "Threads", value: "2" }],
        go: { t: "Depth", c: 20 },
    });
});

test("a human player needs no engine and keeps an explicit name", () => {
    expect(toPlayerConfig({ type: "human", name: "Felix" })).toEqual({
        type: "human",
        name: "Felix",
    });
    expect(toPlayerConfig({ type: "human" })).toEqual({ type: "human", name: "Player" });
});

test("an engine player without a usable local engine is rejected, not sent to the backend", () => {
    const message = "A local engine must be selected for an engine player";
    expect(() => toPlayerConfig(engineOpponent({ engine: null }))).toThrow(message);
    expect(() =>
        toPlayerConfig(engineOpponent({ engine: { type: "chessdb" } as unknown as LocalEngine })),
    ).toThrow(message);
});

test("an engine without a name falls back to a default name", () => {
    expect(
        toPlayerConfig(
            engineOpponent({ engine: { ...engine, name: undefined } as unknown as LocalEngine }),
        ),
    ).toMatchObject({ name: "Engine" });
});

test("per-game engine settings replace the engine's stored settings, and an empty list is honoured", () => {
    expect(
        toPlayerConfig(
            engineOpponent({ engineSettings: [{ type: "string", name: "Threads", value: "8" }] }),
        ),
    ).toMatchObject({ options: [{ type: "string", name: "Threads", value: "8" }] });

    // An explicit empty list is a choice, not a reason to fall back to the engine's settings.
    expect(toPlayerConfig(engineOpponent({ engineSettings: [] }))).toMatchObject({ options: [] });

    // Neither source present is the remaining case the `?? []` tail exists for.
    expect(
        toPlayerConfig(
            engineOpponent({ engine: { ...engine, settings: undefined } as LocalEngine }),
        ),
    ).toMatchObject({ options: [] });
});

test("resource options are passed through untouched while string options are normalised", () => {
    const resource: EngineOption = {
        type: "resource",
        name: "SyzygyPath",
        resources: [{ id: { id: "tablebase-ref" }, kind: "directory", displayName: "tablebases" }],
    };

    expect(
        toPlayerConfig(
            engineOpponent({
                engineSettings: [resource, { type: "string", name: "Hash", value: "1024" }],
            }),
        ),
    ).toMatchObject({
        options: [resource, { type: "string", name: "Hash", value: "1024" }],
    });
});

test("a time control hands the go mode to the backend instead of fixing it here", () => {
    for (const go of [
        { t: "Depth", c: 20 },
        { t: "Nodes", c: 500_000 },
        { t: "Infinite" },
    ] satisfies GoMode[]) {
        expect(toPlayerConfig(engineOpponent({ go }))).toMatchObject({ go });
        expect(
            toPlayerConfig(
                engineOpponent({ go, timeControl: { seconds: 180_000, increment: 2_000 } }),
            ),
        ).toMatchObject({ go: null });
    }
});
