import { afterEach, expect, test, vi } from "vitest";
import { tabStorage } from "@/state/store/tabStorage";
import { defaultTree } from "./treeReducer";

const mocks = vi.hoisted(() => ({
    parsePGN: vi.fn(),
    pickPgnFile: vi.fn(),
    reportPersistError: vi.fn(),
    writeGame: vi.fn(),
}));
vi.mock("@/platform/tauri", () => ({ tauri: { writeGame: mocks.writeGame } }));
vi.mock("@/state/persistError", () => ({ reportPersistError: mocks.reportPersistError }));
vi.mock("./files", () => ({ pickPgnFile: mocks.pickPgnFile }));
vi.mock("./chess", async (importOriginal) => ({
    ...(await importOriginal<typeof import("./chess")>()),
    parsePGN: mocks.parsePGN,
}));
import {
    getTabFile,
    getTabGameNumber,
    isPersistentGameOrigin,
    createTabFromSeed,
    createTab,
    runTabCreation,
    saveToFile,
    type Tab,
} from "./tabs";

afterEach(() => {
    sessionStorage.clear();
    vi.clearAllMocks();
    vi.restoreAllMocks();
});

const fileTab = {
    value: "tab-1",
    name: "games.pgn",
    type: "analysis",
    gameOrigin: {
        kind: "file",
        gameNumber: 2,
        file: { name: "games.pgn", numGames: 4 },
    },
} as Tab;

test("getTabFile returns the file metadata only for file-backed tabs", () => {
    expect(getTabFile(undefined)).toBeUndefined();
    expect(getTabFile(fileTab)?.name).toBe("games.pgn");
    expect(getTabFile({ ...fileTab, gameOrigin: { kind: "none" } } as Tab)).toBeUndefined();
});

test("getTabGameNumber and persistence follow the game origin kind", () => {
    expect(getTabGameNumber(undefined)).toBe(0);
    expect(getTabGameNumber(fileTab)).toBe(2);
    expect(isPersistentGameOrigin(undefined)).toBe(false);
    expect(isPersistentGameOrigin(fileTab)).toBe(true);
    expect(isPersistentGameOrigin({ ...fileTab, gameOrigin: { kind: "none" } } as Tab)).toBe(false);
});

test("runTabCreation waits, ignores refusal, reports rejection, and completes admitted tabs", async () => {
    let resolve: (value: string | null) => void = () => undefined;
    const pendingCreation = new Promise<string | null>((done) => {
        resolve = done;
    });
    const onSuccess = vi.fn();
    const onError = vi.fn();
    const pending = runTabCreation({ create: () => pendingCreation, onSuccess, onError });
    await Promise.resolve();
    expect(onSuccess).not.toHaveBeenCalled();
    resolve("created");
    await expect(pending).resolves.toBe("created");
    expect(onSuccess).toHaveBeenCalledWith("created");
    expect(onError).not.toHaveBeenCalled();

    onSuccess.mockClear();
    await expect(
        runTabCreation({ create: async () => null, onSuccess, onError }),
    ).resolves.toBeNull();
    expect(onSuccess).not.toHaveBeenCalled();

    const failure = new Error("parse failed");
    await expect(
        runTabCreation({
            create: async () => {
                throw failure;
            },
            onSuccess,
            onError,
        }),
    ).resolves.toBeNull();
    expect(onError).toHaveBeenCalledWith(failure);
});

test("createTabFromSeed commits tab and selection together", () => {
    const previous: Tab[] = [];
    const setTabs = vi.fn((update, activeTab) => {
        expect(typeof update === "function" ? update(previous) : update).toEqual([
            expect.objectContaining({ name: "Created", type: "analysis" }),
        ]);
        expect(activeTab).toMatch(/^[0-9a-f-]+$/i);
        return true;
    });

    const id = createTabFromSeed({
        tab: { name: "Created", type: "analysis", gameOrigin: { kind: "none" } },
        setTabs,
    });
    expect(id).not.toBeNull();
    expect(setTabs).toHaveBeenCalledOnce();
});

test("createTabFromSeed reports a seed failure once without attempting admission", () => {
    const setTabs = vi.fn(() => true);
    const failure = new Error("seed failed");

    const result = createTabFromSeed({
        tab: { name: "Failed", type: "analysis", gameOrigin: { kind: "none" } },
        seed: () => {
            throw failure;
        },
        setTabs,
    });

    expect(result).toBeNull();
    expect(setTabs).not.toHaveBeenCalled();
    expect(mocks.reportPersistError).toHaveBeenCalledOnce();
    expect(mocks.reportPersistError).toHaveBeenCalledWith(failure);
});

test("createTabFromSeed rolls back only its staged tree on refused admission", () => {
    sessionStorage.setItem("existing", "keep");
    let stagedId = "";
    const result = createTabFromSeed({
        tab: { name: "Refused", type: "analysis", gameOrigin: { kind: "none" } },
        seed: (id) => {
            stagedId = id;
            tabStorage.seed(id, defaultTree());
        },
        setTabs: () => false,
    });

    expect(result).toBeNull();
    expect(sessionStorage.getItem(stagedId)).toBeNull();
    expect(sessionStorage.getItem("existing")).toBe("keep");
});

test("createTabFromSeed admits a duplicate whose blank source has no stored tree", () => {
    const setTabs = vi.fn(() => true);
    const result = createTabFromSeed({
        tab: { name: "Blank copy", type: "new", gameOrigin: { kind: "none" } },
        seed: (id) => {
            expect(tabStorage.cloneDurable("blank-source", id)).toBe(false);
        },
        setTabs,
    });

    expect(result).not.toBeNull();
    expect(setTabs).toHaveBeenCalledOnce();
});

test("refused duplicate preserves its pending source and removes the durable target", () => {
    const source = defaultTree();
    source.dirty = true;
    tabStorage.write("source", { version: 0, state: source });
    let target = "";

    const result = createTabFromSeed({
        tab: { name: "Copy", type: "analysis", gameOrigin: { kind: "none" } },
        seed: (id) => {
            target = id;
            tabStorage.cloneDurable("source", id);
        },
        setTabs: () => false,
    });

    expect(result).toBeNull();
    expect(tabStorage.read("source")?.state).toMatchObject({ dirty: true });
    expect(tabStorage.read(target)).toBeNull();
    expect(tabStorage.pendingCount()).toBe(1);
    tabStorage.remove("source");
    expect(tabStorage.pendingCount()).toBe(0);
});

test("keeps a refused creation unacknowledged when rollback removal is rejected", () => {
    let stagedId = "";
    const originalRemoveItem = Storage.prototype.removeItem;
    const removeItem = vi
        .spyOn(Storage.prototype, "removeItem")
        .mockImplementation(function (this: Storage, key) {
            if (key === stagedId) throw new DOMException("denied", "SecurityError");
            return originalRemoveItem.call(this, key);
        });

    const result = createTabFromSeed({
        tab: { name: "Refused", type: "analysis", gameOrigin: { kind: "none" } },
        seed: (id) => {
            stagedId = id;
            tabStorage.seed(id, defaultTree());
        },
        setTabs: () => false,
    });

    expect(result).toBeNull();
    expect(sessionStorage.getItem("workspace")).toBeNull();
    expect(sessionStorage.getItem(stagedId)).not.toBeNull();
    expect(mocks.reportPersistError).toHaveBeenCalledOnce();
    removeItem.mockRestore();
    tabStorage.remove(stagedId);
});

test("saveToFile refuses the native write when the selected origin was not durable", async () => {
    const save = vi.fn();
    const tree = defaultTree();
    mocks.pickPgnFile.mockResolvedValueOnce({
        type: "file",
        name: "saved",
        handle: { id: { id: "saved" }, kind: "fileWorkspace" },
        numGames: 1,
        metadata: { type: "game", tags: [] },
        lastModified: 1,
    });
    const store = {
        getState: () => ({ ...tree, save }),
    } as never;

    await expect(
        saveToFile({
            tab: undefined,
            setCurrentTab: () => false,
            store,
            isUserSave: true,
        }),
    ).resolves.toBe("failed");
    expect(mocks.writeGame).not.toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
});

test("concurrent parses commit against the latest tabs when they finish out of order", async () => {
    let resolveFirst: (tree: ReturnType<typeof defaultTree>) => void = () => undefined;
    let resolveSecond: (tree: ReturnType<typeof defaultTree>) => void = () => undefined;
    mocks.parsePGN
        .mockReturnValueOnce(new Promise((resolve) => (resolveFirst = resolve)))
        .mockReturnValueOnce(new Promise((resolve) => (resolveSecond = resolve)));
    let tabs: Tab[] = [];
    const setTabs = (update: Tab[] | ((previous: Tab[]) => Tab[])) => {
        tabs = typeof update === "function" ? update(tabs) : update;
        return true;
    };
    const first = createTab({ tab: { name: "First", type: "analysis" }, pgn: "first", setTabs });
    const second = createTab({
        tab: { name: "Second", type: "analysis" },
        pgn: "second",
        setTabs,
    });

    resolveSecond(defaultTree());
    await second;
    resolveFirst(defaultTree());
    await first;

    expect(tabs.map((tab) => tab.name)).toEqual(["Second", "First"]);
});
