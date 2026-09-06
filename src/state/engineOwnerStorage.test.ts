import { beforeEach, expect, test, vi } from "vitest";
import { z } from "zod";
import { engineSchema } from "@/utils/engines";
import {
    opponentSettingsSchema,
    switchOpponentType,
    type OpponentSettings,
} from "@/state/opponentSettings";
import { serializeStorageValue } from "./store/debouncedStorage";

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
        const config = toPlayerConfig(hydrated);
        expect(config.type).toBe("engine");
        if (config.type !== "engine") throw new Error("expected engine player config");
        expect(config.options).toEqual([
            { type: "resource", name: "EvalFile", resources: [resourceA] },
        ]);
    }
    expect(toPlayerConfig(hydrated1)).toMatchObject({ go: { t: "Depth", c: 18 } });
    expect(toPlayerConfig(hydrated2)).toMatchObject({ go: { t: "Nodes", c: 1234 } });
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
