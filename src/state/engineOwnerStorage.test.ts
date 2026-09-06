import { beforeEach, expect, test, vi } from "vitest";
import { z } from "zod";
import { engineSchema } from "@/utils/engines";
import { opponentSettingsSchema } from "@/utils/opponentSettings";
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
vi.mock("@/i18n", () => ({ default: { t: () => "save failed" } }));

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
    vi.spyOn(Storage.prototype, "setItem").mockImplementationOnce(() => {
        throw new DOMException("full", "QuotaExceededError");
    });
    const receipt = await saveEngineOwnerValue("engines", serializeStorageValue([engine]));
    expect(receipt.saved).toBe(false);
    expect(mocks.reconcile).toHaveBeenCalledTimes(1);
    expect(mocks.report).toHaveBeenCalledOnce();
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
