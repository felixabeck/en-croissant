import { expect, test } from "vitest";
import { inspectEngineOwnerValue } from "@/state/engineOwnerStorage";
import { upgradeOpponentEngine, type OpponentSettings } from "@/state/opponentSettings";
import { toPlayerConfig } from "@/components/boards/playerConfig";
import {
    upgradeEngineFromCatalog,
    upgradeEngineSettings,
    type DefaultEngine,
    type LocalEngine,
} from "./engines";
import type { EngineConfig } from "@/bindings";

const oldEngine: LocalEngine = {
    type: "local",
    id: "26b262cb",
    name: "Stockfish 18",
    version: "18",
    handle: { id: { id: "ba059fcc" }, kind: "engine" },
    filename: "Stockfish 18",
    imageHandle: { id: { id: "101907e6" }, kind: "engineImage" },
    elo: 3650,
    loaded: true,
    enabled: true,
    go: { t: "Infinite" },
    settings: [
        { type: "string", name: "Threads", value: "20" },
        { type: "string", name: "Hash", value: "8192" },
        { type: "string", name: "MultiPV", value: "4" },
        { type: "string", name: "UCI_ShowWDL", value: "true" },
        {
            type: "resource",
            name: "EvalFileSmall",
            resources: [{ id: { id: "small-net" }, kind: "file", displayName: "small.nnue" }],
        },
    ],
};
const catalog: DefaultEngine = {
    type: "local",
    id: "catalog",
    name: "Stockfish",
    version: "19",
    elo: 3635,
    path: "stockfish/stockfish-linux-x86-64-universal",
    os: "linux",
    bmi2: false,
    sha256: "a".repeat(64),
    signature: "signature",
    downloadSize: 81388977,
    downloadLink: "https://example.com/stockfish.tar.gz",
};
const config: EngineConfig = {
    name: "Stockfish 19",
    options: [
        ...["Threads", "Hash", "MultiPV"].map((name) => ({
            type: "spin" as const,
            value: { name, default: 1n, min: 1n, max: 33554432n },
        })),
        { type: "check", value: { name: "UCI_ShowWDL", default: false } },
        { type: "string", value: { name: "SyzygyPath", default: "" } },
    ],
};
const installed = {
    handle: { id: { id: "sf19-binary" }, kind: "engine" as const },
    config,
    filename: "stockfish-linux-x86-64-universal",
};

test("upgrades Felix's entry without changing identity, preferences, or image", () => {
    const before = structuredClone(oldEngine);
    const upgraded = upgradeEngineFromCatalog(oldEngine, catalog, installed);
    expect(upgraded).toEqual({
        ...oldEngine,
        handle: installed.handle,
        filename: installed.filename,
        name: "Stockfish 19",
        version: "19",
        elo: 3635,
        downloadLink: catalog.downloadLink,
        downloadSize: catalog.downloadSize,
        settings: oldEngine.settings!.filter((option) => option.name !== "EvalFileSmall"),
    });
    expect(oldEngine).toEqual(before);
    expect(inspectEngineOwnerValue("engines", [upgraded])).not.toBeNull();
});

test("adds missing required defaults and retains advertised resource preferences", () => {
    const resource = {
        type: "resource" as const,
        name: "SyzygyPath",
        resources: [{ id: { id: "syzygy" }, kind: "directory" as const, displayName: "Syzygy" }],
    };
    expect(upgradeEngineSettings([resource], config)).toEqual([
        resource,
        ...["Threads", "Hash", "MultiPV"].map((name) => ({ type: "string", name, value: "1" })),
    ]);
    expect(
        inspectEngineOwnerValue("engines", [
            upgradeEngineFromCatalog({ ...oldEngine, settings: [resource] }, catalog, installed),
        ]),
    ).not.toBeNull();
});

test("rewrites same-id player engine and its overrides, retaining player go and time", () => {
    const snapshot: OpponentSettings = {
        type: "engine",
        engine: oldEngine,
        go: { t: "Depth", c: 12 },
        timeControl: { seconds: 3000 },
        engineSettings: oldEngine.settings!.filter((option) => option.name !== "Hash"),
    };
    const next = upgradeOpponentEngine(snapshot, oldEngine.id, catalog, installed);
    expect(next).toMatchObject({
        go: snapshot.go,
        timeControl: snapshot.timeControl,
        engine: { handle: installed.handle },
    });
    if (next.type !== "engine") throw new Error("expected engine player");
    expect(next.engineSettings).toEqual([
        ...snapshot.engineSettings!.filter((option) => option.name !== "EvalFileSmall"),
        { type: "string", name: "Hash", value: "1" },
    ]);
    expect(inspectEngineOwnerValue("game-player1-settings", next)).not.toBeNull();
    expect(upgradeOpponentEngine(snapshot, "another-id", catalog, installed)).toBe(snapshot);
});

test.each([
    ["absent", {}],
    ["undefined", { engineSettings: undefined }],
    ["null", { engineSettings: null }],
] as const)(
    "preserves %s player overrides so game configuration uses the upgraded live settings",
    (_label, overrides) => {
        // Null is a legacy runtime value, outside the current storage schema; preserve it too.
        const snapshot = {
            type: "engine",
            engine: oldEngine,
            go: { t: "Infinite" },
            ...overrides,
        } as unknown as OpponentSettings;
        const upgradedInstall = {
            ...installed,
            config: {
                ...config,
                options: config.options.map((option) =>
                    option.type === "spin" && option.value.name === "Hash"
                        ? { ...option, value: { ...option.value, default: 16n } }
                        : option,
                ),
            },
        };
        const live = upgradeEngineFromCatalog(oldEngine, catalog, upgradedInstall);
        const next = upgradeOpponentEngine(snapshot, oldEngine.id, catalog, upgradedInstall);
        if (next.type !== "engine" || snapshot.type !== "engine")
            throw new Error("expected engine player");
        expect
            .soft(Object.hasOwn(next, "engineSettings"))
            .toBe(Object.hasOwn(snapshot, "engineSettings"));
        expect.soft(next.engineSettings).toBe(snapshot.engineSettings);
        expect(toPlayerConfig(next, [live])).toMatchObject({
            type: "engine",
            options: expect.arrayContaining([
                { type: "string", name: "Threads", value: "20" },
                { type: "string", name: "Hash", value: "8192" },
            ]),
        });
    },
);
