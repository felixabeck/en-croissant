import { afterEach, expect, test, vi } from "vitest";
import { denyStorageRemoval } from "@/utils/tests/storageMocks";
import type { FileWorkspaceHandle } from "@/bindings";
import { tabStorage } from "@/state/store/tabStorage";
import { serializeStorageValue } from "@/state/store/debouncedStorage";
import { loadWorkspace, MAX_PROTECTED_TREE_KEYS, WORKSPACE_STORAGE_KEY } from "@/state/workspace";
import { closeTreeStore, createTreeStore } from "@/state/store/tree";
import {
    getFileFreshness,
    removeFileFreshness,
    setFileFreshness,
    startFileRevisionPoll,
} from "@/state/fileFreshness";
import { defaultTree } from "./treeReducer";

const mocks = vi.hoisted(() => ({
    parsePGN: vi.fn(),
    pickPgnFile: vi.fn(),
    reportPersistError: vi.fn(),
    readFileGame: vi.fn(),
    writeGame: vi.fn(),
}));

function deferred<T>() {
    let resolve!: (value: T) => void;
    let reject!: (reason?: unknown) => void;
    const promise = new Promise<T>((done, fail) => {
        resolve = done;
        reject = fail;
    });
    return { promise, resolve, reject };
}

vi.mock("@/platform/tauri", () => ({ tauri: { writeGame: mocks.writeGame } }));
vi.mock("@/state/persistError", () => ({ reportPersistError: mocks.reportPersistError }));
vi.mock("./files", async (importOriginal) => ({
    ...(await importOriginal<typeof import("./files")>()),
    pickPgnFile: mocks.pickPgnFile,
    readFileGame: mocks.readFileGame,
}));
vi.mock("./chess", async (importOriginal) => ({
    ...(await importOriginal<typeof import("./chess")>()),
    parsePGN: mocks.parsePGN,
}));
import {
    getTabFile,
    getTabGameNumber,
    isPersistentGameOrigin,
    commitNewTab,
    createTab,
    runTabCreation,
    saveToFile,
    type Tab,
} from "./tabs";

afterEach(() => {
    sessionStorage.clear();
    closeTreeStore("save-test");
    closeTreeStore("save-as-test");
    removeFileFreshness("save-test");
    removeFileFreshness("save-as-test");
    vi.clearAllMocks();
    vi.restoreAllMocks();
    vi.useRealTimers();
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

test("commitNewTab commits tab and selection together", () => {
    const previous: Tab[] = [];
    const setTabs = vi.fn((update, activeTab) => {
        expect(typeof update === "function" ? update(previous) : update).toEqual([
            expect.objectContaining({ name: "Created", type: "analysis" }),
        ]);
        expect(activeTab).toMatch(/^[0-9a-f-]+$/i);
        return true;
    });

    const id = commitNewTab({
        tab: { name: "Created", type: "analysis", gameOrigin: { kind: "none" } },
        setTabs,
    });
    expect(id).not.toBeNull();
    expect(setTabs).toHaveBeenCalledOnce();
});

test("commitNewTab reports a seed failure once without attempting admission", () => {
    const setTabs = vi.fn(() => true);
    const failure = new Error("seed failed");

    const result = commitNewTab({
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

test("commitNewTab rolls back only its staged tree on refused admission", () => {
    sessionStorage.setItem("existing", "keep");
    let stagedId = "";
    const result = commitNewTab({
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

test("commitNewTab admits a duplicate whose blank source has no stored tree", () => {
    const setTabs = vi.fn(() => true);
    const result = commitNewTab({
        tab: { name: "Blank copy", type: "new", gameOrigin: { kind: "none" } },
        seed: (id) => {
            tabStorage.cloneDurable("blank-source", id);
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

    const result = commitNewTab({
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
    const retained: Tab = {
        name: "Retained",
        value: crypto.randomUUID(),
        type: "analysis",
        gameOrigin: { kind: "none" },
    };
    sessionStorage.setItem(
        WORKSPACE_STORAGE_KEY,
        serializeStorageValue({ version: 1, tabs: [retained], activeTab: retained.value }),
    );
    let stagedId = "";
    const removeItem = denyStorageRemoval(() => stagedId);

    const result = commitNewTab({
        tab: { name: "Refused", type: "analysis", gameOrigin: { kind: "none" } },
        seed: (id) => {
            stagedId = id;
            tabStorage.seed(id, defaultTree());
        },
        setTabs: () => false,
    });

    expect(result).toBeNull();
    expect(sessionStorage.getItem(WORKSPACE_STORAGE_KEY)).not.toBeNull();
    expect(sessionStorage.getItem(stagedId)).not.toBeNull();
    expect(mocks.reportPersistError).toHaveBeenCalledOnce();
    removeItem.mockRestore();
    expect(loadWorkspace(sessionStorage, WORKSPACE_STORAGE_KEY).tabs).toEqual([retained]);
    expect(sessionStorage.getItem(stagedId)).toBeNull();
});

test("retries a refused seed rollback through snapshot overflow", () => {
    sessionStorage.setItem(WORKSPACE_STORAGE_KEY, "{broken");
    const tree = serializeStorageValue({ version: 1, state: defaultTree() });
    for (let index = 0; index < MAX_PROTECTED_TREE_KEYS; index++) {
        sessionStorage.setItem(`older-tree-${index}`, tree);
    }
    let stagedId = "";
    const deny = denyStorageRemoval(() => stagedId);

    expect(
        commitNewTab({
            tab: { name: "Refused", type: "analysis", gameOrigin: { kind: "none" } },
            seed: (id) => {
                stagedId = id;
                tabStorage.seed(id, defaultTree());
            },
            setTabs: () => false,
        }),
    ).toBeNull();
    const marker = `chessfable:failed-tab-admission:${stagedId}`;
    expect(sessionStorage.getItem(marker)).toBe("1");

    mocks.reportPersistError.mockClear();
    const first = loadWorkspace(sessionStorage, WORKSPACE_STORAGE_KEY);
    expect(first.treeOwnershipUncertain).toBe(true);
    expect(first.treeOwnershipProtectedIds).toHaveLength(MAX_PROTECTED_TREE_KEYS);
    expect(first.treeOwnershipProtectedIds).not.toContain(stagedId);
    expect(mocks.reportPersistError).toHaveBeenCalledOnce();
    expect(sessionStorage.getItem(stagedId)).not.toBeNull();
    expect(sessionStorage.getItem(marker)).toBe("1");
    deny.mockRestore();

    expect(loadWorkspace(sessionStorage, WORKSPACE_STORAGE_KEY).treeOwnershipUncertain).toBe(true);
    expect(sessionStorage.getItem(stagedId)).toBeNull();
    expect(sessionStorage.getItem(marker)).toBeNull();
    expect(sessionStorage.getItem("older-tree-0")).toBe(tree);
});

test("a throwing admission can have committed, so its failed rollback is not journaled", () => {
    let stagedId = "";
    const deny = denyStorageRemoval(() => stagedId);
    const dispatchError = new Error("listener failed after commit");

    expect(() =>
        commitNewTab({
            tab: { name: "Committed", type: "analysis", gameOrigin: { kind: "none" } },
            seed: (id) => {
                stagedId = id;
                tabStorage.seed(id, defaultTree());
            },
            setTabs: (update) => {
                const tabs = typeof update === "function" ? update([]) : update;
                sessionStorage.setItem(
                    WORKSPACE_STORAGE_KEY,
                    serializeStorageValue({ version: 1, tabs, activeTab: stagedId }),
                );
                throw dispatchError;
            },
        }),
    ).toThrow(dispatchError);

    expect(sessionStorage.getItem(`chessfable:failed-tab-admission:${stagedId}`)).toBeNull();
    deny.mockRestore();
    expect(loadWorkspace(sessionStorage, WORKSPACE_STORAGE_KEY).tabs[0]!.value).toBe(stagedId);
    expect(sessionStorage.getItem(stagedId)).not.toBeNull();
});

test("a full storage origin reports that a failed rollback marker could not be written", () => {
    let stagedId = "";
    const deny = denyStorageRemoval(() => stagedId);
    const originalSetItem = Storage.prototype.setItem;
    const quota = new DOMException("full", "QuotaExceededError");
    const setItem = vi
        .spyOn(Storage.prototype, "setItem")
        .mockImplementation(function (this: Storage, key, value) {
            if (key.startsWith("chessfable:failed-tab-admission:")) throw quota;
            return originalSetItem.call(this, key, value);
        });

    expect(
        commitNewTab({
            tab: { name: "Refused", type: "analysis", gameOrigin: { kind: "none" } },
            seed: (id) => {
                stagedId = id;
                tabStorage.seed(id, defaultTree());
            },
            setTabs: () => false,
        }),
    ).toBeNull();

    setItem.mockRestore();
    deny.mockRestore();
    expect(sessionStorage.getItem(`chessfable:failed-tab-admission:${stagedId}`)).toBeNull();
    expect(sessionStorage.getItem(stagedId)).not.toBeNull();
    expect(mocks.reportPersistError).toHaveBeenCalledWith(
        expect.objectContaining({ cause: quota }),
    );
});

test("saveToFile refuses the native write when the selected origin was not durable", async () => {
    const save = vi.fn();
    const store = {
        getState: () => ({ ...defaultTree(), save }),
    } as never;

    await expect(
        saveToFile({
            tab: undefined,
            updateTab: () => false,
            getTab: () => undefined,
            store,
            isUserSave: true,
        }),
    ).resolves.toMatchObject({
        status: "failed",
        error: { message: "There is no active tab to save." },
    });
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

const fileHandle = { id: { id: "save-file" }, kind: "fileWorkspace" } as const;
const destinationHandle = { id: { id: "save-destination" }, kind: "fileWorkspace" } as const;
const stampA = "a".repeat(64);
const stampB = "b".repeat(64);
const stampC = "c".repeat(64);

function saveFixture({
    id = "save-test",
    kind = "file",
    stamp = stampA,
}: {
    id?: string;
    kind?: "file" | "temp_file" | "none";
    stamp?: string | null;
} = {}) {
    const tree = { ...defaultTree(), dirty: true, sourceStamp: stamp };
    tree.headers.event = "Unsaved version";
    const store = createTreeStore(undefined, tree);
    let tabs: Tab[] = [
        {
            value: id,
            name: "Save game",
            type: "analysis",
            gameOrigin:
                kind === "none"
                    ? { kind: "none" }
                    : {
                          kind,
                          gameNumber: 2,
                          file: {
                              type: "file",
                              handle: fileHandle,
                              name: "source.pgn",
                              numGames: 4,
                              metadata: { type: "game", tags: [] },
                              lastModified: 1,
                          },
                      },
        } as Tab,
    ];
    const updateTab = (tabId: string, update: React.SetStateAction<Tab>) => {
        const found = tabs.some((tab) => tab.value === tabId);
        tabs = tabs.map((tab) =>
            tab.value === tabId ? (typeof update === "function" ? update(tab) : update) : tab,
        );
        return found;
    };
    const getTab = (tabId: string) => tabs.find((tab) => tab.value === tabId);
    return {
        get tabs() {
            return tabs;
        },
        getTab,
        updateTab,
        store,
        tree,
    };
}

function targetFile() {
    return {
        type: "file" as const,
        handle: destinationHandle,
        name: "destination.pgn",
        numGames: 8,
        metadata: { type: "game" as const, tags: [] },
        lastModified: 1,
    };
}

test("file saves send the source stamp as a required CAS and persist the returned stamp", async () => {
    const fixture = saveFixture();
    mocks.writeGame.mockResolvedValueOnce({ stamp: stampB, revision: "r-new" });

    await expect(
        saveToFile({
            tab: fixture.tabs[0],
            updateTab: fixture.updateTab,
            getTab: fixture.getTab,
            store: fixture.store,
        }),
    ).resolves.toBe("saved");

    expect(mocks.writeGame).toHaveBeenCalledWith(fileHandle, 2, expect.any(String), {
        kind: "game",
        stamp: stampA,
    });
    expect(fixture.store.getState()).toMatchObject({ dirty: false, sourceStamp: stampB });
    expect(getFileFreshness("save-test")).toMatchObject({
        state: "verified",
        verifiedRevision: "r-new",
    });
});

test("a save ignores a conflicting poll outcome that resolves during its write", async () => {
    vi.useFakeTimers();
    const fixture = saveFixture();
    setFileFreshness("save-test", "verified", { verifiedRevision: "r-old" });
    const epoch = getFileFreshness("save-test").epoch;
    const pollOutcome = deferred<string>();
    const pendingWrite = deferred<{ stamp: string | null; revision: string | null }>();
    let revisionCalls = 0;
    const fileRevision = vi.fn((_handle: FileWorkspaceHandle, _options: { signal: AbortSignal }) =>
        ++revisionCalls === 1 ? pollOutcome.promise : Promise.resolve("r-written"),
    );
    let focus!: () => void;
    const stop = startFileRevisionPoll({
        getTabs: () => fixture.tabs,
        fileRevision,
        subscribeFocus: (callback) => {
            focus = callback;
            return () => undefined;
        },
    });

    try {
        focus();
        for (let turn = 0; turn < 10; turn += 1) await Promise.resolve();
        expect(fileRevision).toHaveBeenCalledOnce();

        mocks.writeGame.mockReturnValueOnce(pendingWrite.promise);
        const saving = saveToFile({
            tab: fixture.tabs[0],
            updateTab: fixture.updateTab,
            getTab: fixture.getTab,
            store: fixture.store,
        });
        await Promise.resolve();
        pollOutcome.reject({
            tag: "backend-error",
            category: "conflict",
            message: "path authority changed during the poll",
        });
        for (let turn = 0; turn < 10; turn += 1) await Promise.resolve();

        expect(getFileFreshness("save-test")).toMatchObject({
            state: "verified",
            verifiedRevision: "r-old",
            epoch,
        });

        pendingWrite.resolve({ stamp: stampB, revision: "r-written" });
        await expect(saving).resolves.toBe("saved");
        for (let turn = 0; turn < 10; turn += 1) await Promise.resolve();

        expect(fileRevision).toHaveBeenCalledTimes(2);
        expect(getFileFreshness("save-test")).toMatchObject({
            state: "verified",
            verifiedRevision: "r-written",
        });
    } finally {
        stop();
    }
});

test("a save without a read-back stamp stays unverified", async () => {
    const fixture = saveFixture();
    mocks.writeGame.mockResolvedValueOnce({ stamp: null, revision: null });

    await expect(
        saveToFile({
            tab: fixture.tabs[0],
            updateTab: fixture.updateTab,
            getTab: fixture.getTab,
            store: fixture.store,
        }),
    ).resolves.toBe("conflict");

    expect(fixture.store.getState()).toMatchObject({ dirty: true, sourceStamp: null });
    expect(getFileFreshness("save-test").state).toBe("unverified");
});

test("file saves with a missing stamp conflict without calling the native writer", async () => {
    const fixture = saveFixture({ stamp: null });

    await expect(
        saveToFile({
            tab: fixture.tabs[0],
            updateTab: fixture.updateTab,
            getTab: fixture.getTab,
            store: fixture.store,
        }),
    ).resolves.toBe("conflict");

    expect(mocks.writeGame).not.toHaveBeenCalled();
    expect(fixture.store.getState().dirty).toBe(true);
});

test("a stale-game rejection becomes a conflict without clearing edits", async () => {
    const fixture = saveFixture();
    const stale = Object.assign(new Error("The game changed on disk"), {
        details: {
            category: "validation",
            backendCategory: "stale-game",
            message: "The game changed on disk",
        },
    });
    mocks.writeGame.mockRejectedValueOnce(stale);

    await expect(
        saveToFile({
            tab: fixture.tabs[0],
            updateTab: fixture.updateTab,
            getTab: fixture.getTab,
            store: fixture.store,
        }),
    ).resolves.toBe("conflict");

    expect(fixture.store.getState()).toMatchObject({ dirty: true, sourceStamp: stampA });
    expect((await import("@/state/fileFreshness")).getFileFreshness("save-test").state).toBe(
        "conflict",
    );
});

test("a committed save whose follow-up failed is verified by text instead of by its old stamp", async () => {
    const fixture = saveFixture();
    setFileFreshness("save-test", "verified", { verifiedRevision: "r1" });
    mocks.writeGame.mockRejectedValueOnce({
        tag: "backend-error",
        category: "durability",
        message:
            "Committed but durability uncertain: PGN file capability rebind after a committed edit",
    });

    const result = await saveToFile({
        tab: fixture.tabs[0],
        updateTab: fixture.updateTab,
        getTab: fixture.getTab,
        store: fixture.store,
    });

    expect(result).toMatchObject({
        status: "failed",
        error: { category: "applied-despite-error", backendCategory: "durability" },
    });
    expect(fixture.store.getState()).toMatchObject({ dirty: true, sourceStamp: null });
    expect(getFileFreshness("save-test").state).toBe("unverified");
});

test("a generic native conflict stays unverified and returns its typed save failure", async () => {
    const fixture = saveFixture();
    mocks.writeGame.mockRejectedValueOnce({
        tag: "backend-error",
        category: "conflict",
        message: "Conflict: PGN changed after scan",
    });

    const result = await saveToFile({
        tab: fixture.tabs[0],
        updateTab: fixture.updateTab,
        getTab: fixture.getTab,
        store: fixture.store,
    });

    expect(result).toMatchObject({
        status: "failed",
        error: {
            backendCategory: "conflict",
            message: "Conflict: PGN changed after scan",
        },
    });
    expect((await import("@/state/fileFreshness")).getFileFreshness("save-test")).toMatchObject({
        state: "unverified",
        errorMessage: "Conflict: PGN changed after scan",
    });
    expect(fixture.store.getState()).toMatchObject({ dirty: true, sourceStamp: stampA });
});

test.each(["header-only edit", "tree edit"] as const)(
    "an in-flight save with a %s stores the new stamp but stays dirty",
    async (edit) => {
        const fixture = saveFixture();
        let resolveWrite: (result: {
            stamp: string | null;
            revision: string | null;
        }) => void = () => undefined;
        mocks.writeGame.mockReturnValueOnce(
            new Promise((resolve) => {
                resolveWrite = resolve;
            }),
        );
        const pending = saveToFile({
            tab: fixture.tabs[0],
            updateTab: fixture.updateTab,
            getTab: fixture.getTab,
            store: fixture.store,
        });
        await Promise.resolve();
        fixture.store.getState().setHeaders({
            ...fixture.store.getState().headers,
            event:
                edit === "header-only edit" ? "Header changed during save" : "Changed during save",
        });
        if (edit === "tree edit") {
            fixture.store.getState().setComment("Move comment changed during save");
        }
        resolveWrite({ stamp: stampB, revision: "r-new" });

        await expect(pending).resolves.toBe("superseded");
        expect(fixture.store.getState()).toMatchObject({ dirty: true, sourceStamp: stampB });
    },
);

test("a save completing after a game switch applies nothing and returns superseded", async () => {
    const fixture = saveFixture();
    let resolveWrite: (result: { stamp: string | null; revision: string | null }) => void = () =>
        undefined;
    mocks.writeGame.mockReturnValueOnce(
        new Promise((resolve) => {
            resolveWrite = resolve;
        }),
    );
    const pending = saveToFile({
        tab: fixture.tabs[0],
        updateTab: fixture.updateTab,
        getTab: fixture.getTab,
        store: fixture.store,
    });
    await Promise.resolve();
    fixture.updateTab("save-test", (tab) => ({
        ...tab,
        gameOrigin:
            tab.gameOrigin.kind === "file" ? { ...tab.gameOrigin, gameNumber: 3 } : tab.gameOrigin,
    }));
    resolveWrite({ stamp: stampB, revision: "r-new" });

    await expect(pending).resolves.toBe("superseded");
    expect(fixture.tabs[0].gameOrigin).toMatchObject({ gameNumber: 3 });
    expect(fixture.store.getState()).toMatchObject({ dirty: true, sourceStamp: stampA });
});

test("temp-file Save-As rechecks the source and CAS-writes the same target slot", async () => {
    const fixture = saveFixture({ kind: "temp_file" });
    mocks.pickPgnFile.mockResolvedValueOnce(targetFile());
    mocks.readFileGame
        .mockResolvedValueOnce({ stamp: stampA, pgn: "source", revision: "r1", present: true })
        .mockResolvedValueOnce({ stamp: stampA, pgn: "source", revision: "r1", present: true })
        .mockResolvedValueOnce({
            stamp: stampC,
            pgn: "existing destination",
            revision: "r2",
            present: true,
        });
    mocks.writeGame.mockResolvedValueOnce({ stamp: stampB, revision: "r-new" });

    await expect(
        saveToFile({
            tab: fixture.tabs[0],
            updateTab: fixture.updateTab,
            getTab: fixture.getTab,
            store: fixture.store,
            isUserSave: true,
        }),
    ).resolves.toBe("saved");

    expect(mocks.writeGame).toHaveBeenCalledWith(destinationHandle, 2, expect.any(String), {
        kind: "game",
        stamp: stampC,
    });
    expect(fixture.tabs[0].gameOrigin).toMatchObject({
        kind: "file",
        gameNumber: 2,
        file: { handle: destinationHandle },
    });
    expect(getFileFreshness("save-test")).toMatchObject({
        state: "verified",
        verifiedRevision: "r-new",
    });
});

test("temp-file user Save refuses a missing source stamp before opening the picker", async () => {
    const fixture = saveFixture({ kind: "temp_file", stamp: null });

    await expect(
        saveToFile({
            tab: fixture.tabs[0],
            updateTab: fixture.updateTab,
            getTab: fixture.getTab,
            store: fixture.store,
            isUserSave: true,
        }),
    ).resolves.toBe("conflict");

    expect(mocks.pickPgnFile).not.toHaveBeenCalled();
    expect(mocks.writeGame).not.toHaveBeenCalled();
});

test("a temp-file source changed while its Save-As picker was open is not written", async () => {
    const fixture = saveFixture({ kind: "temp_file" });
    const selected = deferred<ReturnType<typeof targetFile> | null>();
    mocks.pickPgnFile.mockReturnValueOnce(selected.promise);
    mocks.readFileGame
        .mockResolvedValueOnce({ stamp: stampA, pgn: "source", revision: "r1", present: true })
        .mockResolvedValueOnce({
            stamp: stampB,
            pgn: "changed source",
            revision: "r2",
            present: true,
        });
    const pending = saveToFile({
        tab: fixture.tabs[0],
        updateTab: fixture.updateTab,
        getTab: fixture.getTab,
        store: fixture.store,
        isUserSave: true,
    });
    await Promise.resolve();
    selected.resolve(targetFile());

    await expect(pending).resolves.toBe("conflict");
    expect(mocks.writeGame).not.toHaveBeenCalled();
    expect(fixture.tabs[0].gameOrigin.kind).toBe("temp_file");
});

test("a failed Save-As leaves the tab origin and tree stamp untouched", async () => {
    const fixture = saveFixture({ kind: "temp_file" });
    mocks.pickPgnFile.mockResolvedValueOnce(targetFile());
    mocks.readFileGame
        .mockResolvedValueOnce({ stamp: stampA, pgn: "source", revision: "r1", present: true })
        .mockResolvedValueOnce({ stamp: stampA, pgn: "source", revision: "r1", present: true })
        .mockResolvedValueOnce({ stamp: stampC, pgn: "target", revision: "r2", present: true });
    mocks.writeGame.mockRejectedValueOnce(new Error("write failed"));

    const result = await saveToFile({
        tab: fixture.tabs[0],
        updateTab: fixture.updateTab,
        getTab: fixture.getTab,
        store: fixture.store,
        isUserSave: true,
    });

    expect(result).toMatchObject({ status: "failed" });
    expect(fixture.tabs[0].gameOrigin.kind).toBe("temp_file");
    expect(fixture.store.getState()).toMatchObject({ dirty: true, sourceStamp: stampA });
});

test.each([
    ["none", "missing-resource"],
    ["none", "invalid-input"],
    ["temp_file", "missing-resource"],
    ["temp_file", "invalid-input"],
] as const)(
    "a %s tab whose Save-As destination write fails with %s is an ordinary failure, not an unavailable source",
    async (kind, backendCategory) => {
        const fixture = saveFixture({ kind });
        mocks.pickPgnFile.mockResolvedValueOnce(targetFile());
        if (kind === "temp_file") {
            mocks.readFileGame
                .mockResolvedValueOnce({
                    stamp: stampA,
                    pgn: "source",
                    revision: "r1",
                    present: true,
                })
                .mockResolvedValueOnce({
                    stamp: stampA,
                    pgn: "source",
                    revision: "r1",
                    present: true,
                });
        }
        mocks.readFileGame.mockResolvedValueOnce({
            stamp: stampC,
            pgn: "destination game",
            revision: "r2",
            present: true,
        });
        mocks.writeGame.mockRejectedValueOnce({
            tag: "backend-error",
            category: backendCategory,
            message: "The destination is gone",
        });

        const result = await saveToFile({
            tab: fixture.tabs[0],
            updateTab: fixture.updateTab,
            getTab: fixture.getTab,
            store: fixture.store,
            isUserSave: true,
        });

        expect(result).toMatchObject({ status: "failed", error: { backendCategory } });
        expect(getFileFreshness("save-test").state).not.toBe("unavailable");
        expect(fixture.tabs[0].gameOrigin.kind).toBe(kind);
        expect(fixture.store.getState()).toMatchObject({ dirty: true, sourceStamp: stampA });
    },
);

test("a stale Save-As destination is a visible typed failure without changing the tab origin", async () => {
    const fixture = saveFixture({ id: "save-as-test", kind: "none" });
    mocks.pickPgnFile.mockResolvedValueOnce(targetFile());
    mocks.readFileGame.mockResolvedValueOnce({
        stamp: stampC,
        pgn: "destination game",
        revision: "r2",
        present: true,
    });
    mocks.writeGame.mockRejectedValueOnce(
        Object.assign(new Error("The game changed on disk"), {
            details: {
                category: "validation",
                backendCategory: "stale-game",
                message: "The game changed on disk",
            },
        }),
    );

    const result = await saveToFile({
        tab: fixture.tabs[0],
        updateTab: fixture.updateTab,
        getTab: fixture.getTab,
        store: fixture.store,
        isUserSave: true,
    });

    expect(result).toMatchObject({
        status: "failed",
        error: { backendCategory: "stale-game", message: "The game changed on disk" },
    });
    expect(fixture.tabs[0].gameOrigin).toEqual({ kind: "none" });
    expect(fixture.store.getState()).toMatchObject({ dirty: true, sourceStamp: stampA });
});
