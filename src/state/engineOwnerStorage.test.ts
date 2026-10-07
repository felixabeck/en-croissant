import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { z } from "zod";
import { engineSchema, type Engine } from "@/utils/engines";
import {
    opponentSettingsSchema,
    switchOpponentType,
    type OpponentSettings,
} from "@/state/opponentSettings";
import { decodeCompressedOrJson, serializeStorageValue } from "./store/debouncedStorage";

const mocks = vi.hoisted(() => ({
    reconcile: vi.fn(),
    report: vi.fn(),
}));
vi.mock("@/platform/tauri", () => ({
    tauri: { reconcileEngineAttachments: mocks.reconcile },
}));
vi.mock("@/platform/native", () => ({ warn: vi.fn() }));
vi.mock("./persistError", () => ({ reportPersistError: mocks.report }));
vi.mock("@/i18n", () => ({
    default: {
        t: (key: string) =>
            key === "Common.StorageQuotaExceeded" ? "translated quota" : "save failed",
    },
}));

import {
    collectAttachmentIds,
    createEngineOwnerStorage,
    reconcileStartupEngineAttachments,
    resetEngineOwnerCoordinatorForTests,
    saveEngineOwnerValue,
} from "./engineOwnerStorage";

const resource = { id: { id: "resource-a" }, kind: "file" as const, displayName: "table" };
const engine = {
    type: "local" as const,
    id: "engine-id",
    name: "Stockfish",
    version: "17",
    handle: { id: { id: "executable" }, kind: "engine" as const },
    filename: "stockfish",
    imageHandle: { id: { id: "image-a" }, kind: "engineImage" as const },
    settings: [{ type: "resource" as const, name: "SyzygyPath", resources: [resource] }],
};

beforeEach(() => {
    localStorage.clear();
    mocks.reconcile.mockReset().mockResolvedValue(undefined);
    mocks.report.mockReset();
    resetEngineOwnerCoordinatorForTests();
});
afterEach(() => vi.restoreAllMocks());

test("collects image and resource attachments without executable capabilities", () => {
    expect(collectAttachmentIds("engines", [engine])).toEqual(["image-a", "resource-a"]);
});

test("prepares before storage and reconciles the shared owner union afterwards", async () => {
    localStorage.setItem(
        "game-player1-settings",
        serializeStorageValue({ type: "engine", engine, go: { t: "Depth", c: 12 } }),
    );
    const order: string[] = [];
    mocks.reconcile.mockImplementation(async (action) => order.push(action.action));
    const originalSetItem = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, key, value) {
        order.push("storage");
        return Reflect.apply(originalSetItem, this, [key, value]);
    });

    const receipt = await saveEngineOwnerValue("engines", serializeStorageValue([]));

    expect(receipt).toEqual(expect.objectContaining({ saved: true, synchronized: true }));
    expect(order).toEqual(["prepare", "storage", "reconcile"]);
    expect(mocks.reconcile.mock.calls[1][0].retained_ids).toEqual([
        { id: "image-a" },
        { id: "resource-a" },
    ]);
    vi.restoreAllMocks();
});

test("quota failure resolves unsuccessful and never retires", async () => {
    mocks.reconcile.mockResolvedValue(undefined);
    const quota = new DOMException(
        "Storage quota exceeded at /home/felix/secret.pgn",
        "QuotaExceededError",
    );
    vi.spyOn(Storage.prototype, "setItem").mockImplementationOnce(() => {
        throw quota;
    });
    const storage = createEngineOwnerStorage("engines", z.array(engineSchema), []);
    const receipt = (await storage.setItem("engines", [engine])) as unknown as {
        saved: boolean;
        synchronized: boolean;
        error?: Error;
    };
    expect(receipt.saved).toBe(false);
    expect(receipt.synchronized).toBe(false);
    expect(localStorage.getItem("engines")).toBeNull();
    expect(mocks.reconcile).toHaveBeenCalledTimes(1);
    expect(mocks.report).toHaveBeenCalledOnce();
    expect((mocks.report.mock.calls[0][0] as Error).message).toContain("translated quota");
    expect((mocks.report.mock.calls[0][0] as Error).message).not.toContain(
        "/home/felix/secret.pgn",
    );
    expect((mocks.report.mock.calls[0][0] as Error).cause).toBe(quota);
    vi.restoreAllMocks();
});

test("native prepare failure preserves typed error and leaves storage unchanged", async () => {
    const typed = Object.assign(new Error("native refused"), {
        details: { tag: "Error", category: "conflict", message: "native refused" },
    });
    mocks.reconcile.mockRejectedValueOnce(typed);
    const receipt = await saveEngineOwnerValue("engines", serializeStorageValue([engine]));
    expect(receipt).toEqual(
        expect.objectContaining({ saved: false, synchronized: false, error: typed }),
    );
    expect(localStorage.getItem("engines")).toBeNull();
    expect(mocks.report).toHaveBeenCalledWith(typed);
});

test("untrusted sibling permits prepare and save but withholds removal", async () => {
    localStorage.setItem("game-player2-settings", "corrupt");
    const receipt = await saveEngineOwnerValue("engines", serializeStorageValue([]));
    expect(receipt).toEqual(expect.objectContaining({ saved: true, synchronized: false }));
    expect(mocks.reconcile).toHaveBeenCalledTimes(1);
    expect(mocks.reconcile.mock.calls[0][0].action).toBe("prepare");
    expect(localStorage.getItem("game-player2-settings")).toBe("corrupt");
});

test("a delayed startup snapshot completes before a newer durable owner save", async () => {
    let releaseStartup!: () => void;
    const prerequisite = new Promise<void>((resolve) => (releaseStartup = resolve));
    const startup = reconcileStartupEngineAttachments([], prerequisite);
    const write = saveEngineOwnerValue("engines", serializeStorageValue([engine]));

    await Promise.resolve();
    expect(mocks.reconcile).not.toHaveBeenCalled();
    releaseStartup();
    await Promise.all([startup, write]);

    expect(mocks.reconcile.mock.calls.map(([action]) => action)).toEqual([
        expect.objectContaining({ action: "reconcile", startup: true, retained_ids: [] }),
        expect.objectContaining({
            action: "prepare",
            retained_ids: [{ id: "image-a" }, { id: "resource-a" }],
        }),
        expect.objectContaining({
            action: "reconcile",
            startup: false,
            retained_ids: [{ id: "image-a" }, { id: "resource-a" }],
        }),
    ]);
});

test("the real engines atom hydrates and restarts duplicate identities", async () => {
    const duplicate = { ...engine, name: "Twin" };
    const raw = serializeStorageValue([engine, duplicate]);
    localStorage.setItem("engines", raw);
    const { createStore } = await import("jotai");
    const { enginesAtom } = await import("./atoms");
    const store = createStore();
    const unsubscribe = store.sub(enginesAtom, () => undefined);

    await vi.waitFor(() => {
        const hydrated = store.get(enginesAtom) ?? [];
        expect(hydrated).toHaveLength(2);
        expect(hydrated.map(({ id }) => id)).toEqual([engine.id, expect.any(String)]);
        expect(hydrated[1].id).not.toBe(engine.id);
    });
    const hydrated = store.get(enginesAtom) ?? [];
    expect(localStorage.getItem("engines")).not.toBe(raw);

    resetEngineOwnerCoordinatorForTests();
    const restarted = createStore();
    const unsubscribeRestarted = restarted.sub(enginesAtom, () => undefined);
    await vi.waitFor(() => expect(restarted.get(enginesAtom)).toEqual(hydrated));
    unsubscribeRestarted();
    unsubscribe();
});

test.each(["after-save", undefined] as const)(
    "real atom append waits for pending storage hydration (%s)",
    async (publication) => {
        const duplicate = { ...engine, name: "Twin" };
        localStorage.setItem("engines", serializeStorageValue([engine, duplicate]));
        let releaseHydration!: () => void;
        mocks.reconcile.mockImplementationOnce(
            () =>
                new Promise<void>((resolve) => {
                    releaseHydration = resolve;
                }),
        );
        const { createStore } = await import("jotai");
        const { enginesAtom } = await import("./atoms");
        const store = createStore();
        const unsubscribe = store.sub(enginesAtom, () => undefined);
        await vi.waitFor(() => expect(releaseHydration).toEqual(expect.any(Function)));
        expect(store.get(enginesAtom)).toBeUndefined();

        const added = { type: "chessdb" as const, id: "remote", name: "Cloud", url: "https://x" };
        const append = vi.fn((current: Engine[]) => [...current, added]);
        let settled = false;
        const saving = store.set(enginesAtom, append, publication).then((receipt) => {
            settled = true;
            return receipt;
        });
        // Let the serialized writer run while the real storage migration remains pending.
        for (let turn = 0; turn < 10; turn++) await Promise.resolve();
        const calculatedBeforeHydration = append.mock.calls.length > 0;
        const settledBeforeHydration = settled;
        releaseHydration();
        try {
            expect((await saving).saved).toBe(true);
            expect(calculatedBeforeHydration).toBe(false);
            expect(settledBeforeHydration).toBe(false);
            const hydrated = append.mock.calls[0][0];
            expect(hydrated).toHaveLength(2);
            expect(hydrated.map(({ name }) => name)).toEqual(["Stockfish", "Twin"]);
            expect(hydrated[1].id).not.toBe(engine.id);
            expect(decodeCompressedOrJson(localStorage.getItem("engines")!)).toEqual([
                ...hydrated,
                added,
            ]);
            expect(store.get(enginesAtom)).toEqual([...hydrated, added]);
        } finally {
            unsubscribe();
        }
    },
);

test("real overlapping atom writes preserve updates and return their own receipts", async () => {
    mocks.reconcile.mockRejectedValueOnce(new Error("ordinary write failed"));
    const { createStore } = await import("jotai");
    const { enginesAtom } = await import("./atoms");
    const store = createStore();
    const remote = { type: "chessdb" as const, id: "remote", name: "Cloud", url: "https://x" };

    const ordinary = store.set(enginesAtom, async (current) => [...current, remote]);
    const correlated = store.set(enginesAtom, async (current) => [...current, engine]);
    const [ordinaryReceipt, correlatedReceipt] = await Promise.all([
        ordinary as unknown as Promise<{ saved: boolean }>,
        correlated,
    ]);

    expect(ordinaryReceipt.saved).toBe(false);
    expect(correlatedReceipt).toEqual(
        expect.objectContaining({ key: "engines", saved: true, synchronized: true }),
    );
    expect((store.get(enginesAtom) ?? []).map(({ id }) => id)).toEqual(["remote", "engine-id"]);
});

test("catalog atom publication waits for its one durable save and serializes with ordinary writes", async () => {
    const { createStore } = await import("jotai");
    const { enginesAtom } = await import("./atoms");
    const store = createStore();
    await store.set(enginesAtom, []);
    const writes = vi.spyOn(Storage.prototype, "setItem");
    let rejectPrepare!: (error: Error) => void;
    mocks.reconcile.mockImplementationOnce(
        () =>
            new Promise((_resolve, reject) => {
                rejectPrepare = reject;
            }),
    );
    const refused = store.set(enginesAtom, [engine], "after-save");
    await vi.waitFor(() => expect(rejectPrepare).toEqual(expect.any(Function)));
    expect(store.get(enginesAtom)).toEqual([]);
    expect(writes).not.toHaveBeenCalled();
    rejectPrepare(new Error("prepare refused"));
    expect((await refused).saved).toBe(false);
    expect(store.get(enginesAtom)).toEqual([]);
    expect(writes).not.toHaveBeenCalled();

    let releasePrepare!: () => void;
    mocks.reconcile.mockImplementationOnce(
        () =>
            new Promise<void>((resolve) => {
                releasePrepare = resolve;
            }),
    );
    const saved = store.set(enginesAtom, (current) => [...current, engine], "after-save");
    let releaseOrdinary!: () => void;
    const ordinary = store.set(enginesAtom, async (current) => {
        await new Promise<void>((resolve) => {
            releaseOrdinary = resolve;
        });
        return [
            ...current,
            { type: "chessdb" as const, id: "remote", name: "Cloud", url: "https://x" },
        ];
    });
    await vi.waitFor(() => expect(releasePrepare).toEqual(expect.any(Function)));
    expect(store.get(enginesAtom)).toEqual([]);
    releasePrepare();
    expect((await saved).saved).toBe(true);
    expect(store.get(enginesAtom)).toEqual([{ ...engine, legacyAssessment: null }]);
    await vi.waitFor(() => expect(releaseOrdinary).toEqual(expect.any(Function)));
    expect(writes.mock.calls.filter(([key]) => key === "engines")).toHaveLength(1);
    releaseOrdinary();
    await ordinary;
    expect((store.get(enginesAtom) ?? []).map(({ id }) => id)).toEqual([engine.id, "remote"]);
    expect(writes.mock.calls.filter(([key]) => key === "engines")).toHaveLength(2);
    writes.mockRestore();
});

test("invalid hydration returns the safe fallback without overwriting raw bytes", async () => {
    const raw = "{broken";
    localStorage.setItem("engines", raw);
    const storage = createEngineOwnerStorage("engines", z.array(engineSchema), []);
    await expect(storage.getItem("engines", [])).resolves.toEqual([]);
    expect(localStorage.getItem("engines")).toBe(raw);
    expect(mocks.reconcile).not.toHaveBeenCalled();
});

test("lossy hydration does not repair or authorize from a filtered record", async () => {
    const rawValue = [{ ...engine, id: undefined }, { broken: true }];
    const raw = serializeStorageValue(rawValue);
    localStorage.setItem("engines", raw);
    const storage = createEngineOwnerStorage("engines", z.array(engineSchema), []);
    await expect(storage.getItem("engines", [])).resolves.toEqual([]);
    expect(localStorage.getItem("engines")).toBe(raw);
    expect(mocks.reconcile).not.toHaveBeenCalled();
});

test("hydrates and durably stabilizes a legacy engine identity across restart", async () => {
    const { id: _legacyId, ...legacyEngine } = engine;
    const raw = serializeStorageValue([legacyEngine]);
    localStorage.setItem("engines", raw);
    const storage = createEngineOwnerStorage("engines", z.array(engineSchema), []);

    const hydrated = (await storage.getItem("engines", [])) as (typeof engine)[];
    expect(hydrated[0].id).toEqual(expect.any(String));
    const migratedRaw = localStorage.getItem("engines");
    expect(migratedRaw).not.toBe(raw);
    expect(mocks.report.mock.calls ?? []).toHaveLength(0);

    resetEngineOwnerCoordinatorForTests();
    const restarted = createEngineOwnerStorage("engines", z.array(engineSchema), []);
    await expect(restarted.getItem("engines", [])).resolves.toEqual(hydrated);
});

test("repairs duplicate legacy engine identities through the real engines schema", async () => {
    const { enginesSchema } = await import("./atoms");
    const duplicate = { ...engine, name: "Twin" };
    const raw = serializeStorageValue([engine, duplicate]);
    localStorage.setItem("engines", raw);
    const storage = createEngineOwnerStorage("engines", enginesSchema, []);

    const hydrated = (await storage.getItem("engines", [])) as (typeof engine)[];
    expect(hydrated.map(({ id }) => id)).toEqual([engine.id, expect.any(String)]);
    expect(hydrated[1].id).not.toBe(engine.id);
    expect(new Set(hydrated.map(({ id }) => id)).size).toBe(2);
    expect(localStorage.getItem("engines")).not.toBe(raw);

    resetEngineOwnerCoordinatorForTests();
    const restarted = createEngineOwnerStorage("engines", enginesSchema, []);
    await expect(restarted.getItem("engines", [])).resolves.toEqual(hydrated);
});

test("stabilizes a legacy identity nested in a player owner", async () => {
    const { id: _legacyId, ...legacyEngine } = engine;
    const legacyPlayer = {
        type: "engine" as const,
        engine: legacyEngine,
        go: { t: "Depth" as const, c: 24 },
    };
    const raw = serializeStorageValue(legacyPlayer);
    localStorage.setItem("game-player1-settings", raw);
    const storage = createEngineOwnerStorage("game-player1-settings", opponentSettingsSchema, {
        type: "human" as const,
    });

    const hydrated = (await storage.getItem("game-player1-settings", { type: "human" })) as Extract<
        OpponentSettings,
        { type: "engine" }
    >;
    expect(hydrated.engine?.id).toEqual(expect.any(String));
    const migratedRaw = localStorage.getItem("game-player1-settings");
    expect(migratedRaw).not.toBe(raw);

    resetEngineOwnerCoordinatorForTests();
    const restarted = createEngineOwnerStorage("game-player1-settings", opponentSettingsSchema, {
        type: "human" as const,
    });
    await expect(restarted.getItem("game-player1-settings", { type: "human" })).resolves.toEqual(
        hydrated,
    );
});

test("legacy identity migration preserves raw bytes and reports a write failure", async () => {
    const { id: _legacyId, ...legacyEngine } = engine;
    const raw = serializeStorageValue([legacyEngine]);
    localStorage.setItem("engines", raw);
    vi.spyOn(Storage.prototype, "setItem").mockImplementationOnce(() => {
        throw new DOMException("Storage quota exceeded", "QuotaExceededError");
    });
    const storage = createEngineOwnerStorage("engines", z.array(engineSchema), []);

    const hydrated = (await storage.getItem("engines", [])) as (typeof engine)[];
    expect(hydrated[0].id).toEqual(expect.any(String));
    expect(localStorage.getItem("engines")).toBe(raw);
    expect(mocks.report).toHaveBeenCalledOnce();
    vi.restoreAllMocks();
});

test("legacy identity migration reloads newer raw bytes instead of overwriting them", async () => {
    const { id: _legacyId, ...legacyEngine } = engine;
    const raw = serializeStorageValue([legacyEngine]);
    const newerRaw = serializeStorageValue([engine]);
    localStorage.setItem("engines", raw);
    mocks.reconcile.mockImplementationOnce(async () => {
        localStorage.setItem("engines", newerRaw);
    });
    const storage = createEngineOwnerStorage("engines", z.array(engineSchema), []);

    await expect(storage.getItem("engines", [])).resolves.toEqual([engine]);
    expect(localStorage.getItem("engines")).toBe(newerRaw);
});

test("a second legacy conflict returns the latest display value without retrying forever", async () => {
    const { id: _legacyId, ...legacyEngine } = engine;
    const latestLegacy = { ...legacyEngine, name: "Latest" };
    const raw = serializeStorageValue([legacyEngine]);
    const latestRaw = serializeStorageValue([latestLegacy]);
    localStorage.setItem("engines", raw);
    mocks.reconcile.mockImplementationOnce(async () => {
        localStorage.setItem("engines", latestRaw);
    });
    const storage = createEngineOwnerStorage("engines", z.array(engineSchema), []);

    await expect(storage.getItem("engines", [])).resolves.toMatchObject([
        { name: "Latest", id: expect.any(String) },
    ]);
    expect(mocks.reconcile).toHaveBeenCalledOnce();
    expect(localStorage.getItem("engines")).toBe(latestRaw);
});

test("owner branch transitions persist exact unions, retain siblings, and report failures", async () => {
    const attachment = { id: { id: "sibling-image" }, kind: "engineImage" as const };
    const siblingEngine = { ...engine, imageHandle: attachment };
    const sibling = {
        type: "engine" as const,
        engine: siblingEngine,
        go: { t: "Depth" as const, c: 18 },
    };
    const human: OpponentSettings = {
        type: "human",
        name: "Former human",
        timeControl: { seconds: 30, increment: 2 },
        timeUnit: "s",
        incrementUnit: "s",
    };
    localStorage.setItem("game-player2-settings", serializeStorageValue(sibling));
    localStorage.setItem("game-player1-settings", serializeStorageValue(human));
    const storage = createEngineOwnerStorage("game-player1-settings", opponentSettingsSchema, {
        type: "human" as const,
    });
    const enginePlayer = switchOpponentType(human, "engine");
    expect(enginePlayer).toEqual({
        type: "engine",
        engine: null,
        go: { t: "Depth", c: 24 },
        timeControl: human.timeControl,
        timeUnit: human.timeUnit,
        incrementUnit: human.incrementUnit,
    });

    const failure = new Error("prepare failed");
    mocks.reconcile.mockRejectedValueOnce(failure);
    const failed = (await storage.setItem("game-player1-settings", enginePlayer)) as unknown as {
        saved: boolean;
        synchronized: boolean;
        error: unknown;
    };
    expect(failed).toEqual(
        expect.objectContaining({ saved: false, synchronized: false, error: failure }),
    );
    expect(localStorage.getItem("game-player1-settings")).toBe(serializeStorageValue(human));

    mocks.reconcile.mockReset().mockResolvedValue(undefined);
    const saved = (await storage.setItem("game-player1-settings", enginePlayer)) as unknown as {
        saved: boolean;
        synchronized: boolean;
    };
    expect(saved).toEqual(expect.objectContaining({ saved: true, synchronized: true }));
    expect(mocks.reconcile.mock.calls[0][0].retained_ids).toContainEqual({ id: "sibling-image" });

    resetEngineOwnerCoordinatorForTests();
    const reloadedEngine = createEngineOwnerStorage(
        "game-player1-settings",
        opponentSettingsSchema,
        { type: "human" as const },
    );
    const hydratedEngine = await reloadedEngine.getItem("game-player1-settings", {
        type: "human",
    });
    expect(hydratedEngine).toEqual(enginePlayer);
    const humanPlayer = switchOpponentType(hydratedEngine, "human");
    expect(humanPlayer).toEqual({
        type: "human",
        name: "Player",
        timeControl: human.timeControl,
        timeUnit: human.timeUnit,
        incrementUnit: human.incrementUnit,
    });
    const humanReceipt = (await reloadedEngine.setItem(
        "game-player1-settings",
        humanPlayer,
    )) as unknown as { saved: boolean; synchronized: boolean };
    expect(humanReceipt).toEqual(expect.objectContaining({ saved: true, synchronized: true }));

    resetEngineOwnerCoordinatorForTests();
    const reloadedHuman = createEngineOwnerStorage(
        "game-player1-settings",
        opponentSettingsSchema,
        { type: "human" as const },
    );
    await expect(
        reloadedHuman.getItem("game-player1-settings", { type: "human" }),
    ).resolves.toEqual(humanPlayer);
});

test("legacy player owner round trip preserves go image and resource settings", async () => {
    const player = {
        type: "engine" as const,
        engine,
        go: { t: "Nodes" as const, c: 1234 },
        engineSettings: [{ type: "resource" as const, name: "EvalFile", resources: [resource] }],
    };
    localStorage.setItem("game-player1-settings", JSON.stringify(player));
    const storage = createEngineOwnerStorage("game-player1-settings", opponentSettingsSchema, {
        type: "human",
    });
    await expect(storage.getItem("game-player1-settings", { type: "human" })).resolves.toEqual(
        player,
    );
    expect(localStorage.getItem("game-player1-settings")).toBe(JSON.stringify(player));
    await storage.setItem("game-player1-settings", player);
    expect(localStorage.getItem("game-player1-settings")).not.toBe(JSON.stringify(player));
    await expect(storage.getItem("game-player1-settings", { type: "human" })).resolves.toEqual(
        player,
    );
});

test("player reset persists the shared default through prepare and reconcile", async () => {
    const fallback = { type: "human" as const, name: "Player" };
    const storage = createEngineOwnerStorage(
        "game-player2-settings",
        opponentSettingsSchema,
        fallback,
    );
    await storage.removeItem("game-player2-settings");
    await expect(storage.getItem("game-player2-settings", fallback)).resolves.toEqual(fallback);
    expect(mocks.reconcile.mock.calls.map(([action]) => action.action)).toEqual([
        "prepare",
        "reconcile",
    ]);
});

test("both player owners retain resource A across engine-list replacement and restart hydration", async () => {
    const { toPlayerConfig } = await import("@/components/boards/playerConfig");
    const resourceA = { id: { id: "resource-a" }, kind: "file" as const, displayName: "A" };
    const resourceB = { id: { id: "resource-b" }, kind: "file" as const, displayName: "B" };
    const imageA = { id: { id: "image-a" }, kind: "engineImage" as const };
    const imageB = { id: { id: "image-b" }, kind: "engineImage" as const };
    const playerEngine = { ...engine, imageHandle: imageA, settings: [] };
    const player1 = {
        type: "engine" as const,
        engine: playerEngine,
        go: { t: "Depth" as const, c: 18 },
        engineSettings: [{ type: "resource" as const, name: "EvalFile", resources: [resourceA] }],
    };
    const player2 = {
        ...player1,
        go: { t: "Nodes" as const, c: 1234 },
    };
    localStorage.setItem("engines", serializeStorageValue([playerEngine]));
    localStorage.setItem("game-player1-settings", serializeStorageValue(player1));
    localStorage.setItem("game-player2-settings", JSON.stringify(player2));

    const replacement = {
        ...engine,
        id: "engine-b",
        imageHandle: imageB,
        settings: [{ type: "resource" as const, name: "EvalFile", resources: [resourceB] }],
    };
    const receipt = await saveEngineOwnerValue("engines", serializeStorageValue([replacement]));
    expect(receipt.saved).toBe(true);
    expect(mocks.reconcile.mock.calls[0][0].retained_ids).toEqual(
        expect.arrayContaining([
            { id: "image-a" },
            { id: "resource-a" },
            { id: "image-b" },
            { id: "resource-b" },
        ]),
    );

    resetEngineOwnerCoordinatorForTests();
    const player1Storage = createEngineOwnerStorage(
        "game-player1-settings",
        opponentSettingsSchema,
        { type: "human" as const },
    );
    const player2Storage = createEngineOwnerStorage(
        "game-player2-settings",
        opponentSettingsSchema,
        { type: "human" as const },
    );
    const [hydrated1, hydrated2] = await Promise.all([
        player1Storage.getItem("game-player1-settings", { type: "human" }),
        player2Storage.getItem("game-player2-settings", { type: "human" }),
    ]);
    for (const hydrated of [hydrated1, hydrated2]) {
        expect(hydrated).toMatchObject({ engine: { imageHandle: imageA } });
        const config = toPlayerConfig(hydrated, [playerEngine]);
        expect(config.type).toBe("engine");
        if (config.type !== "engine") throw new Error("expected engine player config");
        expect(config.options).toEqual([
            { type: "resource", name: "EvalFile", resources: [resourceA] },
        ]);
    }
    expect(toPlayerConfig(hydrated1, [playerEngine])).toMatchObject({ go: { t: "Depth", c: 18 } });
    expect(toPlayerConfig(hydrated2, [playerEngine])).toMatchObject({
        go: { t: "Nodes", c: 1234 },
    });
});

test("post-storage reconciliation failure is truthful and a later save retries successfully", async () => {
    const failure = new Error("reconcile failed");
    mocks.reconcile
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(failure)
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(undefined);
    const encoded = serializeStorageValue([engine]);
    const first = await saveEngineOwnerValue("engines", encoded);
    expect(first).toEqual(
        expect.objectContaining({ saved: true, synchronized: false, error: failure }),
    );
    expect(localStorage.getItem("engines")).toBe(encoded);

    const retry = await saveEngineOwnerValue("engines", encoded);
    expect(retry).toEqual(expect.objectContaining({ saved: true, synchronized: true }));
    expect(mocks.reconcile.mock.calls.map(([action]) => action.action)).toEqual([
        "prepare",
        "reconcile",
        "prepare",
        "reconcile",
    ]);
});

test("a rejected sibling read preserves raw bytes and withholds destructive reconciliation", async () => {
    const raw = serializeStorageValue({ type: "human", name: "Stored" });
    localStorage.setItem("game-player1-settings", raw);
    const originalGetItem = Storage.prototype.getItem;
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(function (this: Storage, key) {
        if (key === "game-player1-settings") throw new Error("read denied");
        return Reflect.apply(originalGetItem, this, [key]);
    });
    const receipt = await saveEngineOwnerValue("engines", serializeStorageValue([]));
    vi.restoreAllMocks();

    expect(receipt).toEqual(expect.objectContaining({ saved: true, synchronized: false }));
    expect(mocks.reconcile).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem("game-player1-settings")).toBe(raw);
});

test("lossy player ownership preserves raw bytes and withholds destructive reconciliation", async () => {
    const lossyPlayer = {
        type: "engine",
        engine,
        go: { t: "Depth", c: 12 },
        futureOwnerMetadata: { retained: true },
    };
    const raw = serializeStorageValue(lossyPlayer);
    localStorage.setItem("game-player2-settings", raw);

    const receipt = await saveEngineOwnerValue("engines", serializeStorageValue([]));

    expect(receipt).toEqual(expect.objectContaining({ saved: true, synchronized: false }));
    expect(mocks.reconcile).toHaveBeenCalledTimes(1);
    expect(mocks.reconcile.mock.calls[0][0].action).toBe("prepare");
    expect(localStorage.getItem("game-player2-settings")).toBe(raw);
});

const { id: _preId, ...preIdEngine } = engine;
const legacyPlayer = (snapshot = preIdEngine) => ({
    type: "engine" as const,
    engine: snapshot,
    go: { t: "Depth" as const, c: 24 },
});
const seedLegacyOwners = (list: unknown[], snapshot = preIdEngine) => {
    localStorage.setItem("engines", serializeStorageValue(list));
    for (const key of ["game-player1-settings", "game-player2-settings"])
        localStorage.setItem(key, serializeStorageValue(legacyPlayer(snapshot)));
};
async function runtime(fresh = false) {
    if (fresh) vi.resetModules();
    const owner = await import("./engineOwnerStorage");
    owner.resetEngineOwnerCoordinatorForTests();
    const atoms = await import("./atoms");
    const { createStore } = await import("jotai");
    const store = createStore();
    return { owner, atoms, store };
}
type Runtime = Awaited<ReturnType<typeof runtime>>;
async function hydrateList(run: Runtime, count: number) {
    const unsubscribe = run.store.sub(run.atoms.enginesAtom, () => undefined);
    try {
        await vi.waitFor(() => expect(run.store.get(run.atoms.enginesAtom)).toHaveLength(count));
        return run.store.get(run.atoms.enginesAtom)!;
    } finally {
        unsubscribe();
    }
}
async function hydratePlayer(run: Runtime, second = false) {
    const atom = second ? run.atoms.gamePlayer2SettingsAtom : run.atoms.gamePlayer1SettingsAtom;
    const unsubscribe = run.store.sub(atom, () => undefined);
    try {
        await vi.waitFor(() => expect(run.store.get(atom).type).toBe("engine"));
        const value = run.store.get(atom);
        if (value.type !== "engine" || !value.engine) throw new Error("missing test engine");
        return value.engine;
    } finally {
        unsubscribe();
    }
}

test.each(["players-first", "engines-first"])(
    "all three real owners agree across drift, order and restart: %s",
    async (order) => {
        seedLegacyOwners([{ ...preIdEngine, loaded: true, settings: [] }]);
        const run = await runtime();
        if (order === "players-first") {
            await hydratePlayer(run);
            await hydratePlayer(run, true);
        }
        const list = await hydrateList(run, 1);
        for (const second of [false, true])
            expect((await hydratePlayer(run, second)).id).toBe(list[0].id);
        expect(list[0]).toMatchObject({ loaded: true, settings: [], legacyAssessment: null });
        const durable = decodeCompressedOrJson(localStorage.getItem("engines")!);
        expect(durable).toEqual(list);
        const restarted = await runtime(true);
        expect(await hydrateList(restarted, 1)).toEqual(list);
        for (const second of [false, true])
            expect((await hydratePlayer(restarted, second)).id).toBe(list[0].id);
    },
);

test.each(["pre-id", "random", "duplicate-random"])(
    "ambiguous twins stay unresolved after failed player write and removal: %s (CR-1b)",
    async (era) => {
        const a = era === "pre-id" ? preIdEngine : { ...engine, id: "a" };
        const b = { ...a, settings: [], ...(era === "random" ? { id: "b" } : {}) };
        seedLegacyOwners([a, b], { ...preIdEngine, settings: [] });
        const run = await runtime();
        const list = await hydrateList(run, 2);
        const write = Storage.prototype.setItem;
        const refused = vi
            .spyOn(Storage.prototype, "setItem")
            .mockImplementation(function (this: Storage, key, value) {
                if (key.startsWith("game-player")) throw new Error("quota");
                write.call(this, key, value);
            });
        const player = await hydratePlayer(run);
        expect(list.some((item) => item.id === player.id)).toBe(false);
        expect(
            (await run.store.set(run.atoms.enginesAtom, list.slice(1), "after-save")).saved,
        ).toBe(true);
        refused.mockRestore();
        const restarted = await runtime(true);
        const remaining = await hydrateList(restarted, 1);
        expect(remaining.some((item) => item.id === player.id)).toBe(false);
        expect((await hydratePlayer(restarted)).id).toBe(player.id);
    },
);

test("unique random-era claims resolve before list hydration; a removed selection cannot use a differently named sibling", async () => {
    seedLegacyOwners([engine, { ...engine, id: "sibling", name: "Other" }]);
    const run = await runtime();
    expect((await hydratePlayer(run)).id).toBe(engine.id);
    const list = await hydrateList(run, 2);
    await run.store.set(run.atoms.enginesAtom, list.slice(1), "after-save");
    localStorage.setItem("game-player1-settings", serializeStorageValue(legacyPlayer()));
    const restarted = await runtime(true);
    expect((await hydratePlayer(restarted)).id).not.toBe("sibling");
});

test("a sibling with the same name and a different handle assessed alone cannot capture a legacy snapshot", async () => {
    seedLegacyOwners([
        { ...engine, id: "sibling", handle: { ...engine.handle, id: { id: "other-executable" } } },
    ]);
    const run = await runtime();
    await hydrateList(run, 1);
    localStorage.setItem("game-player1-settings", serializeStorageValue(legacyPlayer(preIdEngine)));
    const restarted = await runtime(true);
    const selected = await hydratePlayer(restarted);
    expect(selected.id).toMatch(/^legacy-engine-identity:/);
    expect(selected.id).not.toBe("sibling");
    expect((await hydrateList(restarted, 1))[0].id).toBe("sibling");
});

test.each(["quota", "conflict"])(
    "failed engines migration agrees with a durable player in a fresh runtime: %s",
    async (failure) => {
        seedLegacyOwners([preIdEngine]);
        const raw = localStorage.getItem("engines");
        const run = await runtime();
        if (failure === "quota") {
            const write = Storage.prototype.setItem;
            vi.spyOn(Storage.prototype, "setItem").mockImplementation(
                function (this: Storage, key, value) {
                    if (key === "engines") throw new Error("quota");
                    write.call(this, key, value);
                },
            );
        } else {
            mocks.reconcile.mockImplementationOnce(async () => {
                localStorage.setItem(
                    "engines",
                    serializeStorageValue([{ ...preIdEngine, loaded: true }]),
                );
            });
        }
        const list = await hydrateList(run, 1);
        const selected = await hydratePlayer(run);
        expect(selected.id).toBe(list[0].id);
        const enginesBytes = failure === "quota" ? localStorage.getItem("engines") : raw;
        const prepareActions = mocks.reconcile.mock.calls.filter(
            ([action]) => action.action === "prepare",
        );
        const expectedPrepareCount = failure === "conflict" ? 2 : prepareActions.length;
        expect(enginesBytes).toBe(raw);
        expect(prepareActions).toHaveLength(expectedPrepareCount);
        vi.restoreAllMocks();
        const restarted = await runtime(true);
        expect((await hydrateList(restarted, 1))[0].id).toBe(selected.id);
        expect((await hydratePlayer(restarted)).id).toBe(selected.id);
    },
);

test.each([
    ["pre-id", false],
    ["pre-id", true],
    ["random", false],
    ["random", true],
] as const)(
    "failed player migration survives a later handle/name edit: %s, engines failure=%s (CR-1e)",
    async (era, enginesFailure) => {
        seedLegacyOwners([era === "pre-id" ? preIdEngine : engine]);
        const run = await runtime();
        const write = Storage.prototype.setItem;
        const refused = vi
            .spyOn(Storage.prototype, "setItem")
            .mockImplementation(function (this: Storage, key, value) {
                if (enginesFailure || key.startsWith("game-player")) throw new Error("quota");
                write.call(this, key, value);
            });
        const list = await hydrateList(run, 1);
        const player = await hydratePlayer(run);
        const assessment = list[0].type === "local" ? list[0].legacyAssessment : undefined;
        expect(player.id).toBe(list[0].id);
        refused.mockRestore();
        expect(Storage.prototype.setItem).toBe(write);
        const edited = {
            ...list[0],
            name: "Upgraded",
            handle: { id: { id: "new-binary" }, kind: "engine" as const },
        };
        expect((await run.store.set(run.atoms.enginesAtom, [edited], "after-save")).saved).toBe(
            true,
        );
        expect(decodeCompressedOrJson(localStorage.getItem("engines")!)).toMatchObject([
            { legacyAssessment: assessment },
        ]);
        const restarted = await runtime(true);
        const current = await hydrateList(restarted, 1);
        expect(current[0].id).toBe(player.id);
        expect((await hydratePlayer(restarted)).id).toBe(player.id);
    },
);

test.each(["read", "decode", "hydrate", "absent"])(
    "untrusted engines withhold player persistence; absent bytes are trusted: %s",
    async (mode) => {
        localStorage.setItem("game-player1-settings", serializeStorageValue(legacyPlayer()));
        const raw = localStorage.getItem("game-player1-settings");
        if (mode === "decode") localStorage.setItem("engines", "broken");
        if (mode === "hydrate")
            localStorage.setItem("engines", serializeStorageValue([{ ...engine, future: true }]));
        if (mode === "read") {
            const read = Storage.prototype.getItem;
            vi.spyOn(Storage.prototype, "getItem").mockImplementation(
                function (this: Storage, key) {
                    if (key === "engines") throw new Error("unreadable");
                    return read.call(this, key);
                },
            );
        }
        const run = await runtime();
        const selected = await hydratePlayer(run);
        expect(selected.id).toMatch(/^legacy-engine-identity:/);
        expect(localStorage.getItem("game-player1-settings") === raw).toBe(mode !== "absent");
        vi.restoreAllMocks();
        const restarted = await runtime(true);
        expect((await hydratePlayer(restarted)).id).toBe(selected.id);
    },
);

test("real schema repairs deterministically, reserves raw ids, copies input, and keeps remotes assessment-free", async () => {
    const { enginesSchema } = await import("./atoms");
    const identity = enginesSchema.parse([preIdEngine])[0].id;
    const values = [
        engine,
        { ...engine },
        preIdEngine,
        { ...engine, id: identity, name: "Reserved identity" },
        { ...engine, id: "legacy-engine-position:1", name: "Reserved position" },
        { type: "chessdb", name: "Cloud", url: "https://x" },
        { type: "lichess", name: "Cloud 2", url: "https://y" },
    ];
    const copy = structuredClone(values);
    const first = enginesSchema.parse(values);
    expect(enginesSchema.parse(values)).toEqual(first);
    expect(values).toEqual(copy);
    expect(new Set(first.map(({ id }) => id)).size).toBe(first.length);
    expect(first[1].id).not.toBe("legacy-engine-position:1");
    expect(first[2].id).toMatch(/^legacy-engine-position:/);
    for (const item of first.slice(-2)) {
        expect(item.id).toMatch(/^legacy-engine-position:/);
        expect(item).not.toHaveProperty("legacyAssessment");
    }
    const run = await runtime();
    const receipt = await run.store.set(run.atoms.enginesAtom, first.slice(-2), "after-save");
    expect(receipt.saved).toBe(true);
    expect(collectAttachmentIds("engines", first)).not.toBeNull();
    expect(enginesSchema.parse({ invalid: true })).toEqual([]);
    expect(enginesSchema.parse([engine, { invalid: true }])).toHaveLength(1);
});

test("player migration keeps copied assessment inert and never re-resolves an existing id", async () => {
    seedLegacyOwners([engine]);
    const claim = { identity: "snapshot-only", ambiguous: true };
    const snapshot = { ...preIdEngine, legacyAssessment: claim };
    localStorage.setItem("game-player1-settings", serializeStorageValue(legacyPlayer(snapshot)));
    const run = await runtime();
    const selected = await hydratePlayer(run);
    expect(selected).toMatchObject({ id: engine.id, legacyAssessment: claim });
    localStorage.setItem(
        "game-player1-settings",
        serializeStorageValue({
            ...legacyPlayer(),
            engine: { ...preIdEngine, id: "removed-id" },
        }),
    );
    const restarted = await runtime(true);
    expect((await hydratePlayer(restarted)).id).toBe("removed-id");
    expect(await hydrateList(restarted, 1)).toMatchObject([{ id: engine.id }]);
});

test.each(["pre-id", "random"])(
    "copies renamed into an ambiguous identity never acquire claims across restart: %s (CR-1a,c)",
    async (era) => {
        seedLegacyOwners(
            era === "pre-id"
                ? [preIdEngine, { ...preIdEngine, settings: [] }]
                : [
                      { ...engine, id: "a" },
                      { ...engine, id: "b", settings: [] },
                  ],
        );
        const run = await runtime();
        const list = await hydrateList(run, 2);
        const write = Storage.prototype.setItem;
        const refused = vi
            .spyOn(Storage.prototype, "setItem")
            .mockImplementation(function (this: Storage, key, value) {
                if (key.startsWith("game-player")) throw new Error("quota");
                write.call(this, key, value);
            });
        const selected = await hydratePlayer(run);
        const source = list[era === "pre-id" ? 0 : 1];
        const duplicate = { ...source, id: "c", name: "Copy" };
        await run.store.set(run.atoms.enginesAtom, [...list, duplicate], "after-save");
        const copied = run.store.get(run.atoms.enginesAtom)!.at(-1)!;
        expect(copied).toMatchObject({ legacyAssessment: null });
        await run.store.set(
            run.atoms.enginesAtom,
            [...(era === "random" ? [] : list), { ...copied, name: engine.name }],
            "after-save",
        );
        refused.mockRestore();
        const restarted = await runtime(true);
        const current = await hydrateList(restarted, era === "random" ? 1 : 3);
        expect((await hydratePlayer(restarted)).id).toBe(selected.id);
        expect(current.some((item) => item.id === selected.id)).toBe(false);
        expect(current.at(-1)).toMatchObject({ legacyAssessment: null });
    },
);

test.each(["engines-write", "player-read"])(
    "ambiguous assessment survives a refused %s, removal and restart (CR-1d,f)",
    async (failure) => {
        seedLegacyOwners([
            { ...engine, id: "a" },
            { ...engine, id: "b" },
        ]);
        const run = await runtime();
        if (failure === "engines-write") {
            vi.spyOn(Storage.prototype, "setItem").mockImplementationOnce(() => {
                throw new Error("quota");
            });
        } else {
            const read = Storage.prototype.getItem;
            vi.spyOn(Storage.prototype, "getItem").mockImplementation(
                function (this: Storage, key) {
                    if (key.startsWith("game-player")) throw new Error("denied");
                    return read.call(this, key);
                },
            );
        }
        const list = await hydrateList(run, 2);
        expect(list).toMatchObject([
            { legacyAssessment: { ambiguous: true } },
            { legacyAssessment: { ambiguous: true } },
        ]);
        vi.restoreAllMocks();
        expect(
            (await run.store.set(run.atoms.enginesAtom, list.slice(1), "after-save")).saved,
        ).toBe(true);
        expect(decodeCompressedOrJson(localStorage.getItem("engines")!)).toMatchObject([
            { legacyAssessment: { ambiguous: true } },
        ]);
        const restarted = await runtime(true);
        expect((await hydratePlayer(restarted)).id).not.toBe("b");
    },
);

test.each(["after-save", undefined] as const)(
    "assessment is engines-owned for edits, JSON replacements, additions and remotes (%s)",
    async (publication) => {
        const { enginesSchema } = await import("./atoms");
        const derived = enginesSchema.parse([{ ...preIdEngine, name: "Mixed" }])[0];
        const existingClaim = { identity: "older-identity", ambiguous: false };
        seedLegacyOwners([
            engine,
            derived,
            { ...engine, id: "mixed-random", name: "Mixed" },
            { ...engine, id: "already", name: "Assessed", legacyAssessment: existingClaim },
            { ...engine, id: "already-null", name: "Assessed null", legacyAssessment: null },
        ]);
        const run = await runtime();
        const list = await hydrateList(run, 5);
        expect(list).toMatchObject([
            { legacyAssessment: { ambiguous: false } },
            { legacyAssessment: null },
            { legacyAssessment: { ambiguous: true } },
            { legacyAssessment: existingClaim },
            { legacyAssessment: null },
        ]);
        expect(list.every((item) => collectAttachmentIds("engines", [item]) !== null)).toBe(true);
        const changed = list.map((item) => {
            const { legacyAssessment: _ignored, ...fields } = item as typeof engine & {
                legacyAssessment?: unknown;
            };
            return {
                ...fields,
                name: "Edited",
                settings: [],
                handle: { id: { id: "edited" }, kind: "engine" as const },
            };
        });
        const remote = {
            type: "lichess" as const,
            id: "cloud",
            name: "Cloud",
            url: "https://x",
            legacyAssessment: existingClaim,
        };
        const next = [
            ...changed,
            { ...engine, id: "added", legacyAssessment: existingClaim },
            { ...engine, id: "json-other" },
            remote,
        ];
        expect((await run.store.set(run.atoms.enginesAtom, next, publication)).saved).toBe(true);
        const saved = run.store.get(run.atoms.enginesAtom)!;
        for (let index = 0; index < list.length; index++) {
            expect(saved[index]).toMatchObject({
                legacyAssessment: (list[index] as import("@/utils/engines").LocalEngine)
                    .legacyAssessment,
            });
            expect(saved[index].id).toBe(list[index].id);
        }
        expect(saved.slice(5, 7)).toMatchObject([
            { legacyAssessment: null },
            { legacyAssessment: null },
        ]);
        expect(saved[7]).not.toHaveProperty("legacyAssessment");
        expect(decodeCompressedOrJson(localStorage.getItem("engines")!)).toEqual(saved);
    },
);
