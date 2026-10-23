import { afterEach, beforeEach, expect, test, vi } from "vitest";
import type { EngineCompletion } from "@/bindings";
import type { LocalEngine } from "@/utils/engines";
import { decodeCompressedOrJson, serializeStorageValue } from "./store/debouncedStorage";

const native = vi.hoisted(() => ({
    records: new Map<string, EngineCompletion>(),
    pending: vi.fn(),
    ack: vi.fn(),
    retire: vi.fn(),
    install: vi.fn(),
    reconcile: vi.fn(),
    clear: vi.fn(),
    notify: vi.fn(),
    dispose: vi.fn(),
    changed: undefined as (() => void) | undefined,
}));
vi.mock("@/platform/tauri", () => ({
    tauri: {
        pendingEngineCompletions: native.pending,
        acknowledgeEngineCompletion: native.ack,
        retireEngineCompletion: native.retire,
        installEngineWorkflow: native.install,
        reconcileEngineAttachments: native.reconcile,
        clearProgress: native.clear,
    },
    tauriSubscriptions: {
        completionChanged: async (callback: () => void) => {
            native.changed = callback;
            return native.dispose;
        },
    },
}));
vi.mock("@/components/files/notifyError", () => ({ notifyUnlessCancelled: native.notify }));
vi.mock("@/platform/native", () => ({ warn: vi.fn(), error: vi.fn() }));
vi.mock("./persistError", () => ({ reportPersistError: vi.fn() }));
vi.mock("@/i18n", () => ({ default: { t: (key: string) => key } }));

const a: LocalEngine = {
    id: "logical-engine",
    type: "local",
    name: "A",
    version: "1",
    filename: "a",
    legacyAssessment: null,
    handle: { id: { id: "binary-a" }, kind: "engine" },
    settings: [{ type: "string", name: "Threads", value: "20" }],
};
const root = { id: { id: "root" }, kind: "engineRoot" as const };
const player = (engine = a) => ({
    type: "engine" as const,
    engine,
    go: { t: "Depth" as const, c: 12 },
    engineSettings: engine.settings,
});
function workflow(upgrade = false, expected = a, binary = "binary-b"): EngineCompletion {
    return {
        id: crypto.randomUUID(),
        retired: false,
        request: {
            intent: upgrade
                ? { kind: "upgrade", engine_id: expected.id, expected: expected.handle }
                : { kind: "add", engine_id: "add-engine" },
            root,
            progressId: upgrade ? `engine-upgrade:${expected.id}:catalog` : "engine:catalog",
            url: "https://example.com/engine.zip",
            sha256: "a".repeat(64),
            signature: "signature",
            relativePath: "engine",
            name: "B",
            version: "2",
            elo: null,
            downloadSize: null,
        },
        outcome: {
            state: "succeeded",
            result: {
                handle: { id: { id: binary }, kind: "engine" },
                filename: "b",
                config: {
                    name: "B",
                    options: [
                        {
                            type: "spin",
                            value: { name: "Threads", default: 1n, min: 1n, max: 64n },
                        },
                    ],
                },
            },
        },
    };
}

async function documentRuntime() {
    vi.resetModules();
    const [{ createStore }, atoms, completions, owners, catalog] = await Promise.all([
        import("jotai"),
        import("./atoms"),
        import("./engineCompletions"),
        import("./engineOwnerStorage"),
        import("./catalogEngineCompletion"),
    ]);
    return { store: createStore(), atoms, completions: { ...completions, ...catalog }, owners };
}
function durable(key: string) {
    const decoded = decodeCompressedOrJson(localStorage.getItem(key)!);
    return decoded as { version: number; value: unknown; receipts: Record<string, string> };
}
function retain(completion: EngineCompletion) {
    native.records.set(completion.id, completion);
}
let runtimes: Awaited<ReturnType<typeof documentRuntime>>[];
async function runtime() {
    const run = await documentRuntime();
    runtimes.push(run);
    return run;
}

beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    native.records.clear();
    runtimes = [];
    native.pending
        .mockReset()
        .mockImplementation(async () => structuredClone([...native.records.values()]));
    native.ack.mockReset().mockImplementation(async (id: string) => {
        native.records.delete(id);
    });
    native.retire.mockReset().mockImplementation(async (id: string) => {
        native.records.get(id)!.retired = true;
    });
    native.install.mockReset();
    native.notify.mockReset();
    native.dispose.mockReset();
    native.reconcile.mockReset().mockResolvedValue(undefined);
    native.clear.mockReset().mockResolvedValue(1n);
    native.changed = undefined;
});
afterEach(() => {
    for (const run of runtimes) run.completions.disposeEngineCompletions();
    vi.restoreAllMocks();
});

test("reload completion Add replays after save/ack loss without duplicating or restoring a later deletion", async () => {
    const completion = workflow();
    retain(completion);
    native.ack.mockRejectedValueOnce(new Error("receiver lost"));
    const first = await runtime();
    await expect(first.completions.applyEngineCompletion(completion, first.store)).rejects.toThrow(
        "receiver lost",
    );
    expect(durable("engines")).toMatchObject({
        version: 1,
        value: [{ id: "add-engine" }],
        receipts: { [completion.id]: "applied" },
    });
    expect((await first.store.set(first.atoms.enginesAtom, [])).saved).toBe(true);
    expect(durable("engines").receipts[completion.id]).toBe("applied");
    first.completions.disposeEngineCompletions();
    const replacement = await runtime();
    await replacement.completions.initializeEngineCompletions(replacement.store);
    expect(replacement.store.get(replacement.atoms.enginesAtom)).toEqual([]);
    expect(native.records.size).toBe(0);
    expect(native.install).not.toHaveBeenCalled();
    expect(native.ack).toHaveBeenCalledTimes(2);
});

test.each(["engines", "game-player1-settings", "game-player2-settings", "ack"])(
    "reload completion upgrade resumes after the %s boundary with one UUID and all owners converged",
    async (boundary) => {
        localStorage.setItem("engines", serializeStorageValue([a]));
        for (const key of ["game-player1-settings", "game-player2-settings"])
            localStorage.setItem(key, serializeStorageValue(player()));
        const completion = workflow(true);
        retain(completion);
        const write = Storage.prototype.setItem;
        let refused = false;
        vi.spyOn(Storage.prototype, "setItem").mockImplementation(
            function (this: Storage, key, value) {
                if (!refused && key === boundary) {
                    refused = true;
                    throw new DOMException("quota", "QuotaExceededError");
                }
                write.call(this, key, value);
            },
        );
        if (boundary === "ack") native.ack.mockRejectedValueOnce(new Error("lost acknowledgement"));
        const first = await runtime();
        await expect(
            first.completions.applyEngineCompletion(completion, first.store),
        ).rejects.toThrow(/Engines\.(SaveError|Upgrade\.SnapshotSaveError)|lost acknowledgement/);
        expect(native.records.has(completion.id)).toBe(true);
        first.completions.disposeEngineCompletions();
        vi.restoreAllMocks();
        const replacement = await runtime();
        await replacement.completions.initializeEngineCompletions(replacement.store);
        expect(replacement.store.get(replacement.atoms.enginesAtom)).toMatchObject([
            { id: a.id, handle: { id: { id: "binary-b" } }, settings: [{ value: "20" }] },
        ]);
        for (const key of ["game-player1-settings", "game-player2-settings"]) {
            expect(durable(key)).toMatchObject({
                value: {
                    engine: { id: a.id, handle: { id: { id: "binary-b" } } },
                    go: { c: 12 },
                    engineSettings: [{ value: "20" }],
                },
                receipts: { [completion.id]: "applied" },
            });
        }
        expect(native.records.size).toBe(0);
        expect(native.install).not.toHaveBeenCalled();
    },
);

test("reload completion partial A to B application cannot be overtaken and explicit retry rejoins it", async () => {
    localStorage.setItem("engines", serializeStorageValue([a]));
    for (const key of ["game-player1-settings", "game-player2-settings"])
        localStorage.setItem(key, serializeStorageValue(player()));
    const ab = workflow(true);
    retain(ab);
    const original = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, key, value) {
        if (key === "game-player2-settings") throw new Error("refused second player");
        original.call(this, key, value);
    });
    const first = await runtime();
    await expect(first.completions.applyEngineCompletion(ab, first.store)).rejects.toThrow(
        "Engines.Upgrade.SnapshotSaveError",
    );
    expect(durable("game-player1-settings").value).toMatchObject({
        engine: { handle: { id: { id: "binary-b" } } },
    });
    const b = first.store.get(first.atoms.enginesAtom)![0] as LocalEngine;
    await expect(
        first.completions.completeCatalogEngine(
            { downloadLink: "https://example.com/c.zip" } as never,
            "another-catalog",
            "ticket",
            b,
            first.store,
        ),
    ).rejects.toThrow("Engines.Upgrade.SnapshotSaveError");
    expect(native.install).not.toHaveBeenCalled();
    vi.restoreAllMocks();
    first.completions.disposeEngineCompletions();
    const second = await runtime();
    await second.completions.initializeEngineCompletions(second.store);
    const bc = workflow(true, b, "binary-c");
    retain(bc);
    await second.completions.applyEngineCompletion(bc, second.store);
    expect(second.store.get(second.atoms.enginesAtom)).toMatchObject([
        { id: a.id, handle: { id: { id: "binary-c" } } },
    ]);
    for (const key of ["game-player1-settings", "game-player2-settings"])
        expect(durable(key).value).toMatchObject({
            engine: { id: a.id, handle: { id: { id: "binary-c" } } },
        });
    expect(native.records.size).toBe(0);
});

test.each(["deleted", "new binary", "new player", "new settings"])(
    "reload completion preserves a newer %s choice between owner commits",
    async (choice) => {
        localStorage.setItem("engines", serializeStorageValue([a]));
        localStorage.setItem("game-player1-settings", serializeStorageValue(player()));
        const completion = workflow(true);
        retain(completion);
        native.retire.mockRejectedValueOnce(new Error("cleanup failed"));
        const first = await runtime();
        await expect(
            first.completions.applyEngineCompletion(completion, first.store),
        ).rejects.toThrow("cleanup failed");
        if (choice === "deleted") await first.store.set(first.atoms.enginesAtom, []);
        if (choice === "new binary")
            await first.store.set(first.atoms.enginesAtom, [
                { ...a, handle: { id: { id: "binary-c" }, kind: "engine" } },
            ]);
        if (choice === "new player")
            await first.store.set(first.atoms.gamePlayer1SettingsAtom, {
                type: "human",
                name: "New human",
            });
        if (choice === "new settings")
            await first.store.set(first.atoms.gamePlayer1SettingsAtom, {
                ...player(),
                engineSettings: [{ type: "string", name: "Threads", value: "7" }],
            });
        first.completions.disposeEngineCompletions();
        const replacement = await runtime();
        await replacement.completions.initializeEngineCompletions(replacement.store);
        const expectedEngines =
            choice === "deleted"
                ? []
                : [
                      {
                          id: a.id,
                          handle: { id: { id: choice === "new binary" ? "binary-c" : "binary-b" } },
                      },
                  ];
        expect(replacement.store.get(replacement.atoms.enginesAtom)).toMatchObject(expectedEngines);
        const snapshot = durable("game-player1-settings");
        const expectedPlayer =
            choice === "new player"
                ? { type: "human", name: "New human" }
                : choice === "new settings"
                  ? {
                        engine: { handle: { id: { id: "binary-b" } } },
                        engineSettings: [{ value: "7" }],
                    }
                  : { engine: { handle: { id: { id: "binary-a" } } } };
        expect(snapshot.value).toMatchObject(expectedPlayer);
        expect(snapshot.receipts[completion.id]).toBe(
            choice === "new settings" ? "applied" : "skipped",
        );
        expect(native.records.size).toBe(0);
    },
);

test.each(["malformed", "unreadable"])(
    "reload completion refuses %s owner writes and keeps native work",
    async (mode) => {
        const completion = workflow();
        retain(completion);
        localStorage.setItem("engines", "corrupt original bytes");
        if (mode === "unreadable") {
            const read = Storage.prototype.getItem;
            vi.spyOn(Storage.prototype, "getItem").mockImplementation(
                function (this: Storage, key) {
                    if (key === "engines") throw new Error("unreadable");
                    return read.call(this, key);
                },
            );
        }
        const run = await runtime();
        await expect(run.completions.applyEngineCompletion(completion, run.store)).rejects.toThrow(
            "Engines.SaveError",
        );
        expect(native.ack).not.toHaveBeenCalled();
        expect(native.records.has(completion.id)).toBe(true);
        vi.restoreAllMocks();
        expect(localStorage.getItem("engines")).toBe("corrupt original bytes");
    },
);

test("reload completion snapshots after subscribing, observes running work without delaying startup and disposes stale callbacks", async () => {
    const completion = workflow();
    completion.outcome = { state: "running" };
    retain(completion);
    const run = await runtime();
    await run.completions.initializeEngineCompletions(run.store);
    expect(native.changed).toBeTypeOf("function");
    expect(native.ack).not.toHaveBeenCalled();
    completion.outcome = workflow().outcome;
    native.changed!();
    await vi.waitFor(() => expect(native.ack).toHaveBeenCalledWith(completion.id));
    expect(run.store.get(run.atoms.enginesAtom)).toMatchObject([{ id: "add-engine" }]);
    run.completions.disposeEngineCompletions();
    expect(native.dispose).toHaveBeenCalledOnce();
    const next = workflow();
    retain(next);
    native.changed!();
    await Promise.resolve();
    expect(native.records.has(next.id)).toBe(true);
});

test("reload completion pruning requires a native pending snapshot and retains receipts through ordinary edits", async () => {
    const completion = workflow();
    retain(completion);
    native.ack.mockRejectedValueOnce(new Error("lost"));
    const run = await runtime();
    await expect(run.completions.applyEngineCompletion(completion, run.store)).rejects.toThrow(
        "lost",
    );
    await run.store.set(run.atoms.enginesAtom, (current) =>
        current.map((engine) => ({ ...engine, name: "Renamed" })),
    );
    expect(durable("engines").receipts[completion.id]).toBe("applied");
    await run.owners.pruneEngineCompletionReceipts(new Set([completion.id]));
    expect(durable("engines").receipts[completion.id]).toBe("applied");
    await run.completions.applyEngineCompletion(completion, run.store);
    const replacement = await runtime();
    await replacement.completions.initializeEngineCompletions(replacement.store);
    expect(durable("engines").receipts).toEqual({});
    expect(durable("engines").value).toMatchObject([{ name: "Renamed" }]);
});

test("reload completion reads a retained failure through the localized error path and acknowledges no native effect", async () => {
    const completion = workflow();
    completion.outcome = { state: "failed", result: { category: "network", rootFailure: null } };
    retain(completion);
    const run = await runtime();
    await run.completions.initializeEngineCompletions(run.store);
    expect(native.notify).toHaveBeenCalledWith(
        "Common.Error",
        expect.objectContaining({ category: "network" }),
        "engine",
    );
    expect(native.records.size).toBe(0);
    expect(native.retire).not.toHaveBeenCalled();
    expect(localStorage.getItem("engines")).toBeNull();
});

test("reload completion keeps safe root failure guidance across document loss", async () => {
    const completion = workflow();
    completion.outcome = {
        state: "failed",
        result: { category: "permission", rootFailure: "permission" },
    };
    retain(completion);
    const run = await runtime();
    await run.completions.initializeEngineCompletions(run.store);
    expect(native.notify).toHaveBeenCalledWith(
        "Common.Error",
        expect.objectContaining({ category: "permission", rootFailure: "permission" }),
        "engine",
    );
    expect(native.records.size).toBe(0);
});

test.each(["path", "name"])(
    "reload completion keeps a different UUID with the same %s independent",
    async (shared) => {
        const neighbor: LocalEngine = {
            ...a,
            id: "neighbor",
            name: shared === "name" ? a.name : "Neighbor",
            handle: shared === "path" ? a.handle : { id: { id: "other-binary" }, kind: "engine" },
        };
        localStorage.setItem("engines", serializeStorageValue([a, neighbor]));
        localStorage.setItem("game-player1-settings", serializeStorageValue(player()));
        localStorage.setItem("game-player2-settings", serializeStorageValue(player(neighbor)));
        const completion = workflow(true);
        retain(completion);
        const run = await runtime();
        await run.completions.applyEngineCompletion(completion, run.store);
        expect(run.store.get(run.atoms.enginesAtom)).toMatchObject([
            { id: a.id, handle: { id: { id: "binary-b" } } },
            neighbor,
        ]);
        expect(durable("game-player2-settings")).toMatchObject({
            value: player(neighbor),
            receipts: { [completion.id]: "skipped" },
        });
        expect(native.records.size).toBe(0);
    },
);

test("reload completion reports refused startup recovery and retries retained failures after owner repair", async () => {
    const completion = workflow();
    completion.outcome = { state: "failed", result: { category: "network", rootFailure: null } };
    retain(completion);
    localStorage.setItem("engines", "invalid original owner");
    const run = await runtime();
    await expect(run.completions.initializeEngineCompletions(run.store)).rejects.toThrow(
        "Engines.SaveError",
    );
    expect(native.records.has(completion.id)).toBe(true);
    expect(native.notify).toHaveBeenCalledWith(
        "Common.Error",
        expect.objectContaining({ message: expect.stringContaining("Engines.SaveError") }),
        "engine",
    );
    localStorage.setItem("engines", serializeStorageValue([]));
    await run.completions.initializeEngineCompletions(run.store);
    expect(native.notify).toHaveBeenCalledWith(
        "Common.Error",
        expect.objectContaining({ category: "network" }),
        "engine",
    );
    expect(native.records.size).toBe(0);
});
