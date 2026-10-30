import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { initializeI18n } from "@/i18n";
import { createStore } from "jotai";
import type { CollectionDescriptor } from "@/bindings";
import { tabsAtom, updateTabById } from "@/state/atoms";
import { collectOriginalPathOwners } from "@/state/pathOwners";
import { loadWorkspace, saveWorkspace, WORKSPACE_STORAGE_KEY } from "@/state/workspace";
import { closeTreeStore, createTreeStore } from "@/state/store/tree";
import { tabStorage } from "@/state/store/tabStorage";
import { serializeStorageValue } from "@/state/store/debouncedStorage";
import { defaultTree } from "./treeReducer";
import {
    createTab,
    commitNewTab,
    saveToDatabase,
    saveToFile,
    serializeStoreTree,
    type GameOrigin,
    type Tab,
} from "./tabs";

const native = vi.hoisted(() => ({
    collectionForDatabase: vi.fn(),
    insertDbGame: vi.fn(),
    writeDbGame: vi.fn(),
    writeGame: vi.fn(),
    countPgnGames: vi.fn(),
    resolveLinkedGame: vi.fn(),
}));
vi.mock("@/platform/tauri", () => ({ tauri: native }));
vi.mock("@/utils/sound", () => ({ playSound: vi.fn() }));
vi.mock("@/state/persistError", () => ({ reportPersistError: vi.fn() }));

const database = { id: { id: "draft-database" }, kind: "database" } as const;
const otherDatabase = { id: { id: "other-database" }, kind: "database" } as const;
const file = { id: { id: "linked-file" }, kind: "fileWorkspace" } as const;
const ids: string[] = [];
function deferred<T>() {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((done) => {
        resolve = done;
    });
    return { promise, resolve };
}
function fixture(origin: GameOrigin = { kind: "databaseDraft", database }, moves = true) {
    const id = crypto.randomUUID();
    ids.push(id);
    const workspace = createStore();
    const tab: Tab = { value: id, type: "analysis", name: "Draft", gameOrigin: origin };
    workspace.set(tabsAtom, [tab], id);
    const store = createTreeStore(id, defaultTree());
    if (moves) store.getState().makeMove({ payload: "e4" });
    const getTab = (key: string) => workspace.get(tabsAtom).find((item) => item.value === key);
    const updateTab: Parameters<typeof saveToFile>[0]["updateTab"] = (key, update, acknowledge) =>
        updateTabById((...args) => workspace.set(tabsAtom, ...args), key, update, acknowledge);
    return {
        id,
        workspace,
        store,
        getTab,
        updateTab,
        args: () => ({ tab: getTab(id), store, getTab, updateTab, isUserSave: true }),
    };
}
beforeEach(async () => {
    await initializeI18n();
    native.collectionForDatabase.mockReset().mockResolvedValue(null);
    native.insertDbGame.mockReset().mockResolvedValue(42);
    native.writeDbGame.mockReset().mockResolvedValue(undefined);
    native.writeGame.mockReset().mockResolvedValue({ stamp: "b".repeat(64), revision: "saved" });
    native.countPgnGames.mockReset().mockResolvedValue(3);
});
afterEach(() => {
    ids.splice(0).forEach(closeTreeStore);
    tabStorage.flush();
    sessionStorage.clear();
    localStorage.clear();
    vi.restoreAllMocks();
});

test("draft workspace round-trips, retains its handle and scrubs only a corrupt neighbour", () => {
    const f = fixture();
    const valid = f.getTab(f.id)!;
    saveWorkspace(sessionStorage, WORKSPACE_STORAGE_KEY, {
        version: 1,
        tabs: [valid],
        activeTab: f.id,
    });
    expect(loadWorkspace(sessionStorage, WORKSPACE_STORAGE_KEY).tabs).toEqual([valid]);
    expect(collectOriginalPathOwners(localStorage, sessionStorage).retainedIds).toContainEqual(
        database.id,
    );
    sessionStorage.setItem(
        WORKSPACE_STORAGE_KEY,
        serializeStorageValue({
            version: 1,
            tabs: [
                valid,
                {
                    ...valid,
                    value: crypto.randomUUID(),
                    gameOrigin: { kind: "databaseDraft", database: { kind: "database" } },
                },
            ],
            activeTab: f.id,
        }),
    );
    expect(loadWorkspace(sessionStorage, WORKSPACE_STORAGE_KEY).tabs).toEqual([valid]);
});

test("creating and duplicating a draft admits no database row", async () => {
    const f = fixture();
    const setTabs: Parameters<typeof createTab>[0]["setTabs"] = (...args) =>
        f.workspace.set(tabsAtom, ...args);
    const id = await createTab({
        tab: { name: "Draft", type: "analysis" },
        gameOrigin: { kind: "databaseDraft", database },
        setTabs,
    });
    expect(f.getTab(id!)?.gameOrigin).toEqual({ kind: "databaseDraft", database });
    const duplicate = commitNewTab({
        tab: { ...f.getTab(f.id)! },
        setTabs,
        seed: (target) => tabStorage.cloneDurable(f.id, target),
        existingTabIds: f.workspace.get(tabsAtom).map((tab) => tab.value),
    });
    expect(f.getTab(duplicate!)?.gameOrigin).toEqual({ kind: "databaseDraft", database });
    const copied = createTreeStore(duplicate!);
    ids.push(duplicate!);
    expect(serializeStoreTree(copied)).toEqual(serializeStoreTree(f.store));
    expect(native.insertDbGame).not.toHaveBeenCalled();
});

test("explicit draft save inserts once and subsequent edited save updates the returned ID", async () => {
    const f = fixture();
    expect(await saveToFile({ ...f.args(), isUserSave: false })).toBe("cancelled");
    expect(native.collectionForDatabase).not.toHaveBeenCalled();
    expect(native.insertDbGame).not.toHaveBeenCalled();
    expect(await saveToFile(f.args())).toBe("saved");
    expect(f.getTab(f.id)?.gameOrigin).toEqual({ kind: "database", database, gameId: 42 });
    f.store.getState().makeMove({ payload: "e5" });
    expect(await saveToFile(f.args())).toBe("saved");
    expect(native.insertDbGame).toHaveBeenCalledOnce();
    expect(native.writeDbGame).toHaveBeenCalledWith(database, 42, expect.stringContaining("e5"));
});

test("linked draft appends at the current file count and adopts the file origin", async () => {
    const f = fixture();
    native.collectionForDatabase.mockResolvedValue({
        file,
        name: "Linked",
        status: "ready",
    } as CollectionDescriptor);
    expect(await saveToFile(f.args())).toBe("saved");
    expect(native.writeGame).toHaveBeenCalledWith(file, 3, expect.stringContaining("e4"), {
        kind: "append",
    });
    expect(native.insertDbGame).not.toHaveBeenCalled();
    expect(f.getTab(f.id)?.gameOrigin).toMatchObject({
        kind: "file",
        gameNumber: 3,
        file: { handle: file },
    });
    expect(f.store.getState().storeAttempts).toEqual([]);
});

test("empty-board and confirmed native no-write rejection permit a corrected save", async () => {
    const f = fixture(undefined, false);
    expect(await saveToFile(f.args())).toMatchObject({ status: "failed" });
    expect(f.store.getState().storeAttempts ?? []).toEqual([]);
    f.store.getState().makeMove({ payload: "e4" });
    native.insertDbGame.mockRejectedValueOnce({
        tag: "backend-error",
        category: "chess-data",
        message: "No moves found",
    });
    expect(await saveToFile(f.args())).toMatchObject({ status: "failed" });
    expect(f.store.getState().storeAttempts).toEqual([]);
    expect(await saveToFile(f.args())).toBe("saved");
    expect(native.insertDbGame).toHaveBeenCalledTimes(2);
});

test("uncertain store survives ordinary saves and rehydration and refuses the same destination", async () => {
    const f = fixture({ kind: "database", database, gameId: 7 });
    native.insertDbGame.mockRejectedValueOnce(new Error("IPC disconnected"));
    expect(await saveToDatabase({ ...f.args(), database: otherDatabase })).toMatchObject({
        status: "failed",
    });
    const attempts = f.store.getState().storeAttempts;
    expect(attempts).toEqual(["database:other-database"]);
    expect(await saveToFile(f.args())).toBe("saved");
    expect(f.store.getState().storeAttempts).toEqual(attempts);
    tabStorage.flush();
    closeTreeStore(f.id);
    const cold = createTreeStore(f.id);
    expect(cold.getState().storeAttempts).toEqual(attempts);
    expect(
        await saveToDatabase({ ...f.args(), store: cold, database: otherDatabase }),
    ).toMatchObject({ status: "failed", error: { category: "applied-despite-error" } });
    expect(native.insertDbGame).toHaveBeenCalledOnce();
    expect(await saveToDatabase({ ...f.args(), store: cold, database })).toBe("saved");
    expect(cold.getState().storeAttempts).toEqual(attempts);
});

test("overlapping store submissions perform exactly one native insert and rebind", async () => {
    const f = fixture({ kind: "database", database, gameId: 7 });
    const pending = deferred<number>();
    native.insertDbGame.mockReturnValueOnce(pending.promise);
    const first = saveToDatabase({ ...f.args(), database: otherDatabase });
    const second = saveToDatabase({ ...f.args(), database: otherDatabase });
    await vi.waitFor(() => expect(native.insertDbGame).toHaveBeenCalledOnce());
    pending.resolve(99);
    expect(await first).toBe("saved");
    expect(await second).toBe("saved");
    expect(f.getTab(f.id)?.gameOrigin).toEqual({
        kind: "database",
        database: otherDatabase,
        gameId: 99,
    });
    f.store.getState().setComment("Later edit");
    await saveToFile(f.args());
    expect(native.writeDbGame).toHaveBeenLastCalledWith(
        otherDatabase,
        99,
        expect.stringContaining("Later edit"),
    );
});

test.each([true, false])(
    "store waits for an ordinary save and blocks a subsequent user-save=%s",
    async (isUserSave) => {
        const f = fixture({ kind: "database", database, gameId: 7 });
        const order: string[] = [];
        const ordinary = deferred<void>();
        const insertion = deferred<number>();
        native.writeDbGame.mockImplementationOnce(() => {
            order.push("old-save");
            return ordinary.promise;
        });
        native.insertDbGame.mockImplementationOnce(() => {
            order.push("insert");
            return insertion.promise;
        });
        const saving = saveToFile(f.args());
        const storing = saveToDatabase({ ...f.args(), database: otherDatabase });
        const queued = saveToFile({ ...f.args(), isUserSave });
        await vi.waitFor(() => expect(order).toEqual(["old-save"]));
        expect(native.insertDbGame).not.toHaveBeenCalled();
        ordinary.resolve();
        await saving;
        await vi.waitFor(() => expect(order).toEqual(["old-save", "insert"]));
        expect(native.writeDbGame).toHaveBeenCalledOnce();
        insertion.resolve(99);
        await storing;
        expect(await queued).toBe("saved");
        expect(native.writeDbGame).toHaveBeenCalledTimes(2);
        expect(native.writeDbGame).toHaveBeenLastCalledWith(otherDatabase, 99, expect.any(String));
    },
);

test("ownership loss after native commit retains the destination marker", async () => {
    const f = fixture();
    native.insertDbGame.mockImplementationOnce(async () => {
        f.updateTab(f.id, (previous) => ({ ...previous, gameOrigin: { kind: "none" } }));
        return 99;
    });
    expect(await saveToFile(f.args())).toBe("superseded");
    expect(f.store.getState().storeAttempts).toEqual(["database:draft-database"]);
});

test("autosave queued during a draft insert preserves later edits and updates the admitted row", async () => {
    const f = fixture();
    const insertion = deferred<number>();
    native.insertDbGame.mockReturnValueOnce(insertion.promise);
    const storing = saveToFile(f.args());
    await vi.waitFor(() => expect(native.insertDbGame).toHaveBeenCalledOnce());
    f.store.getState().makeMove({ payload: "e5" });
    const saving = saveToFile({ ...f.args(), isUserSave: false });
    expect(native.writeDbGame).not.toHaveBeenCalled();
    insertion.resolve(42);
    expect(await storing).toBe("superseded");
    expect(await saving).toBe("saved");
    expect(native.writeDbGame).toHaveBeenCalledWith(database, 42, expect.stringContaining("e5"));
    expect(f.store.getState().dirty).toBe(false);
});

test("concurrent different destinations wait for one another and each rebinds to its own target", async () => {
    const f = fixture();
    const insertion = deferred<number>();
    native.insertDbGame.mockReturnValueOnce(insertion.promise).mockResolvedValueOnce(99);
    const first = saveToDatabase({ ...f.args(), database });
    const second = saveToDatabase({ ...f.args(), database: otherDatabase });
    await vi.waitFor(() => expect(native.insertDbGame).toHaveBeenCalledOnce());
    insertion.resolve(42);
    expect(await first).toBe("saved");
    expect(await second).toBe("saved");
    expect(native.insertDbGame).toHaveBeenNthCalledWith(2, otherDatabase, expect.any(String));
    expect(f.getTab(f.id)?.gameOrigin).toEqual({
        kind: "database",
        database: otherDatabase,
        gameId: 99,
    });
});

test("acknowledged insert finalizes its exact successor before a workspace observer throws", async () => {
    const f = fixture();
    const failure = new Error("workspace observer failed");
    const unsubscribe = f.workspace.sub(tabsAtom, () => {
        throw failure;
    });
    const pgn = serializeStoreTree(f.store);
    const result = await saveToFile(f.args());
    unsubscribe();
    expect(result).toMatchObject({
        status: "failed",
        error: { message: expect.stringContaining("workspace observer failed") },
    });
    expect(f.getTab(f.id)?.gameOrigin).toEqual({ kind: "database", database, gameId: 42 });
    expect(f.store.getState().dirty).toBe(false);
    expect(f.store.getState().storeAttempts).toEqual([]);
    expect(serializeStoreTree(f.store)).toBe(pgn);
});
