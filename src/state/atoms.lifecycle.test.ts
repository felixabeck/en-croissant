import { createStore, getDefaultStore } from "jotai";
import { afterEach, expect, test, vi } from "vitest";
import { defaultTree } from "@/utils/treeReducer";
import { denyStorageRemoval } from "@/utils/tests/storageMocks";
import {
    activeTabAtom,
    closeWorkspaceTabAtom,
    closingTabsAtom,
    disposeTabAtoms,
    engineMovesFamily,
    engineProgressFamily,
    gameIdFamily,
    pendingGameStartFamily,
    tabsAtom,
    tabEngineSettingsFamily,
    tabFamily,
} from "./atoms";
import { tabStorage } from "./store/tabStorage";
import { closeTreeStore, createTreeStore, type TreeStoreState } from "./store/tree";
import { commitNewTab, createTab, replaceNewTab, type Tab } from "@/utils/tabs";
import {
    loadWorkspace,
    MAX_PENDING_TREE_REMOVALS,
    MAX_PROTECTED_TREE_KEYS,
    readStoredWorkspaceValue,
    WORKSPACE_STORAGE_KEY,
} from "./workspace";
import { serializeStorageValue } from "./store/debouncedStorage";

const persistError = vi.hoisted(() => ({ reportPersistError: vi.fn() }));
vi.mock("./persistError", () => persistError);

const replacementTabIds = new Set<string>();

afterEach(() => {
    persistError.reportPersistError.mockClear();
    vi.restoreAllMocks();
    for (const tabId of replacementTabIds) {
        closeTreeStore(tabId);
        tabStorage.remove(tabId);
    }
    replacementTabIds.clear();
});

function refuseWorkspaceWrites() {
    const originalSetItem = Storage.prototype.setItem;
    return vi
        .spyOn(Storage.prototype, "setItem")
        .mockImplementation(function (this: Storage, key, value) {
            if (key === WORKSPACE_STORAGE_KEY) {
                throw new DOMException("quota", "QuotaExceededError");
            }
            return originalSetItem.call(this, key, value);
        });
}

type ReplacementFixture = {
    store: ReturnType<typeof createStore>;
    owner: Tab;
    second: Tab;
    secondTree: ReturnType<typeof defaultTree>;
    ownerTreeStore: ReturnType<typeof createTreeStore>;
    secondTreeStore: ReturnType<typeof createTreeStore>;
    ownerRoot: TreeStoreState["root"];
    ownerHeaders: TreeStoreState["headers"];
    secondRoot: TreeStoreState["root"];
    secondHeaders: TreeStoreState["headers"];
    ownerAtom: ReturnType<typeof tabFamily>;
    secondAtom: ReturnType<typeof tabFamily>;
    workspaceBytes: string | null;
    ownerDurableBytes: string | null;
    ownerPendingEntry: ReturnType<typeof tabStorage.readTree>;
    secondDurableBytes: string | null;
};

function makeReplacementFixture({
    ownerType = "new",
    ownerActive = true,
}: {
    ownerType?: Tab["type"];
    ownerActive?: boolean;
} = {}): ReplacementFixture {
    sessionStorage.clear();
    const store = createStore();
    const initialTab = store.get(tabsAtom)[0]!;
    const ownerId = crypto.randomUUID();
    const secondId = crypto.randomUUID();
    replacementTabIds.add(ownerId);
    replacementTabIds.add(secondId);
    const owner: Tab = {
        ...initialTab,
        name: "Tab.NewTab",
        value: ownerId,
        type: ownerType,
        gameOrigin: { kind: "none" },
    };
    const second: Tab = {
        ...initialTab,
        name: "Second tab",
        value: secondId,
        type: "analysis",
        gameOrigin: { kind: "none" },
    };
    const ownerTree = defaultTree();
    ownerTree.headers.event = "Owner durable tree";
    const pendingOwnerTree = structuredClone(ownerTree);
    pendingOwnerTree.headers.event = "Owner pending tree";
    const secondTree = defaultTree();
    secondTree.headers.event = "Second tab tree";

    tabStorage.seed(ownerId, ownerTree);
    tabStorage.write(ownerId, { version: 1, state: pendingOwnerTree });
    tabStorage.seed(secondId, secondTree);
    expect(store.set(tabsAtom, [second, owner], ownerActive ? ownerId : secondId)).toBe(true);

    const ownerAtom = tabFamily(ownerId);
    const secondAtom = tabFamily(secondId);
    store.set(ownerAtom, "practice");
    store.set(secondAtom, "info");
    const ownerTreeStore = createTreeStore(ownerId);
    const secondTreeStore = createTreeStore(secondId);
    const ownerPendingEntry = tabStorage.readTree(ownerId);
    expect(ownerPendingEntry.kind).toBe("available");

    return {
        store,
        owner,
        second,
        secondTree,
        ownerTreeStore,
        secondTreeStore,
        ownerRoot: ownerTreeStore.getState().root,
        ownerHeaders: ownerTreeStore.getState().headers,
        secondRoot: secondTreeStore.getState().root,
        secondHeaders: secondTreeStore.getState().headers,
        ownerAtom,
        secondAtom,
        workspaceBytes: sessionStorage.getItem(WORKSPACE_STORAGE_KEY),
        ownerDurableBytes: sessionStorage.getItem(ownerId),
        ownerPendingEntry,
        secondDurableBytes: sessionStorage.getItem(secondId),
    };
}

function expectReplacementOwnerUnchanged(fixture: ReplacementFixture) {
    expect(fixture.store.get(tabsAtom)).toEqual([fixture.second, fixture.owner]);
    expect(sessionStorage.getItem(WORKSPACE_STORAGE_KEY)).toBe(fixture.workspaceBytes);
    expectReplacementResourcesUnchanged(fixture);
}

function availableTree(entry: ReturnType<typeof tabStorage.readTree>) {
    if (entry.kind !== "available")
        throw new Error(`Expected an available tree, got ${entry.kind}.`);
    return entry.value;
}

function expectReplacementResourcesUnchanged(fixture: ReplacementFixture) {
    expect(sessionStorage.getItem(fixture.owner.value)).toBe(fixture.ownerDurableBytes);
    expect(availableTree(tabStorage.readTree(fixture.owner.value))).toBe(
        availableTree(fixture.ownerPendingEntry),
    );
    expect(createTreeStore(fixture.owner.value)).toBe(fixture.ownerTreeStore);
    expect(fixture.ownerTreeStore.getState().root).toBe(fixture.ownerRoot);
    expect(fixture.ownerTreeStore.getState().headers).toBe(fixture.ownerHeaders);
    expect(tabFamily(fixture.owner.value)).toBe(fixture.ownerAtom);
    expect(fixture.store.get(fixture.ownerAtom)).toBe("practice");
    expect(fixture.store.get(fixture.secondAtom)).toBe("info");
    expect(fixture.store.get(tabsAtom)[0]).toStrictEqual(fixture.second);
    expect(sessionStorage.getItem(fixture.second.value)).toBe(fixture.secondDurableBytes);
    expect(tabStorage.read(fixture.second.value)?.state).toEqual(fixture.secondTree);
    expect(createTreeStore(fixture.second.value)).toBe(fixture.secondTreeStore);
    expect(fixture.secondTreeStore.getState().root).toBe(fixture.secondRoot);
    expect(fixture.secondTreeStore.getState().headers).toBe(fixture.secondHeaders);
    expect(tabFamily(fixture.second.value)).toBe(fixture.secondAtom);
}

function makeThrowingCommitStore(
    fixture: ReplacementFixture,
    error: unknown,
    writeBeforeThrow: boolean,
): ReturnType<typeof createStore> {
    return {
        get: fixture.store.get.bind(fixture.store),
        set: (atom: unknown, update?: unknown, activeTab?: string) => {
            if (atom !== tabsAtom) throw new Error("Unexpected atom write in transaction test.");
            if (writeBeforeThrow) {
                fixture.store.set(tabsAtom, update as Tab[] | ((tabs: Tab[]) => Tab[]), activeTab);
            }
            throw error;
        },
    } as unknown as ReturnType<typeof createStore>;
}

test.each([true, false])(
    "replaces the owner in place and preserves selection (owner active: %s)",
    (ownerActive) => {
        const fixture = makeReplacementFixture({ ownerActive });
        const importedTree = defaultTree();
        importedTree.headers.event = "Imported tree";
        const importedTab = {
            name: "Imported game",
            type: "analysis" as const,
            gameOrigin: { kind: "none" as const },
        };
        let workspaceWrites = 0;
        const originalSetItem = Storage.prototype.setItem;
        vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (
            this: Storage,
            key: string,
            value: string,
        ) {
            if (key === WORKSPACE_STORAGE_KEY) workspaceWrites++;
            return originalSetItem.call(this, key, value);
        });

        const result = replaceNewTab({
            store: fixture.store,
            ownerId: fixture.owner.value,
            tab: importedTab,
            tree: importedTree,
        });

        expect(result.kind).toBe("committed");
        if (result.kind !== "committed") throw new Error("Expected the replacement to commit.");
        replacementTabIds.add(result.id);
        expect(workspaceWrites).toBe(1);
        expect(fixture.store.get(tabsAtom)).toHaveLength(2);
        expect(fixture.store.get(tabsAtom)[0]).toStrictEqual(fixture.second);
        expect(fixture.store.get(tabsAtom)[1]).toEqual({ ...importedTab, value: result.id });
        expect(fixture.store.get(activeTabAtom)).toBe(
            ownerActive ? result.id : fixture.second.value,
        );
        expect(tabStorage.read(result.id)?.state).toEqual(importedTree);
        expect(sessionStorage.getItem(fixture.owner.value)).toBeNull();
        expect(tabStorage.readTree(fixture.owner.value).kind).toBe("absent");
        expect(createTreeStore(fixture.owner.value)).not.toBe(fixture.ownerTreeStore);
        expect([...tabFamily.getParams()]).not.toContain(fixture.owner.value);
        expect(fixture.store.get(fixture.secondAtom)).toBe("info");
        expect(sessionStorage.getItem(fixture.second.value)).toBe(fixture.secondDurableBytes);
        expect(tabStorage.read(fixture.second.value)?.state).toEqual(fixture.secondTree);
        expect(createTreeStore(fixture.second.value)).toBe(fixture.secondTreeStore);
        expect(fixture.secondTreeStore.getState().root).toBe(fixture.secondRoot);
        expect(fixture.secondTreeStore.getState().headers).toBe(fixture.secondHeaders);
        expect(tabFamily(fixture.second.value)).toBe(fixture.secondAtom);

        const reloaded = loadWorkspace(sessionStorage, WORKSPACE_STORAGE_KEY);
        expect(reloaded.tabs[1]).toEqual({ ...importedTab, value: result.id });
        expect(tabStorage.read(result.id)?.state).toEqual(importedTree);
    },
);

test.each(["tree", "workspace"] as const)(
    "refuses a %s write without changing the owner and retries successfully",
    (stage) => {
        const fixture = makeReplacementFixture();
        const importedTree = defaultTree();
        importedTree.headers.event = "Imported after retry";
        persistError.reportPersistError.mockClear();
        const quota = new DOMException("full", "QuotaExceededError");
        let stagedId = "";
        const originalSetItem = Storage.prototype.setItem;
        const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (
            this: Storage,
            key: string,
            value: string,
        ) {
            const isWorkspace = key === WORKSPACE_STORAGE_KEY;
            if (!isWorkspace) stagedId = key;
            if (isWorkspace === (stage === "workspace")) throw quota;
            return originalSetItem.call(this, key, value);
        });

        expect(
            replaceNewTab({
                store: fixture.store,
                ownerId: fixture.owner.value,
                tab: { name: "Imported game", type: "analysis", gameOrigin: { kind: "none" } },
                tree: importedTree,
            }),
        ).toEqual({ kind: "refused", stage });
        replacementTabIds.add(stagedId);
        expectReplacementOwnerUnchanged(fixture);
        expect(stagedId).not.toBe("");
        expect(sessionStorage.getItem(stagedId)).toBeNull();
        expect(persistError.reportPersistError).toHaveBeenCalledOnce();
        expect(loadWorkspace(sessionStorage, WORKSPACE_STORAGE_KEY).tabs).toEqual([
            fixture.second,
            fixture.owner,
        ]);

        setItem.mockRestore();
        const retry = replaceNewTab({
            store: fixture.store,
            ownerId: fixture.owner.value,
            tab: { name: "Imported game", type: "analysis", gameOrigin: { kind: "none" } },
            tree: importedTree,
        });
        expect(retry.kind).toBe("committed");
        if (retry.kind === "committed") replacementTabIds.add(retry.id);
    },
);

/** Runs replaceNewTab against a commit that throws, and checks what both outcomes share. */
function replaceWithThrowingCommit(writeBeforeThrow: boolean) {
    const fixture = makeReplacementFixture();
    const dispatchError = new Error("workspace listener failed");
    const importedTree = defaultTree();
    importedTree.headers.event = "Imported tree";
    persistError.reportPersistError.mockClear();
    let stagedId = "";
    const originalSetItem = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (
        this: Storage,
        key: string,
        value: string,
    ) {
        if (key !== WORKSPACE_STORAGE_KEY) stagedId = key;
        return originalSetItem.call(this, key, value);
    });

    expect(() =>
        replaceNewTab({
            store: makeThrowingCommitStore(fixture, dispatchError, writeBeforeThrow),
            ownerId: fixture.owner.value,
            tab: { name: "Imported game", type: "analysis", gameOrigin: { kind: "none" } },
            tree: importedTree,
        }),
    ).toThrow(dispatchError);
    replacementTabIds.add(stagedId);
    expect(stagedId).not.toBe("");
    expect(sessionStorage.getItem(stagedId)).not.toBeNull();
    expect(sessionStorage.getItem(`chessfable:failed-tab-admission:${stagedId}`)).toBeNull();
    expectReplacementResourcesUnchanged(fixture);
    expect(persistError.reportPersistError).not.toHaveBeenCalled();
    return { fixture, stagedId, importedTree };
}

test("preserves staged ownership and owner resources when the commit throws after the write lands", () => {
    const { fixture, stagedId, importedTree } = replaceWithThrowingCommit(true);

    expect(fixture.store.get(tabsAtom)[1]).toEqual({
        name: "Imported game",
        type: "analysis",
        gameOrigin: { kind: "none" },
        value: stagedId,
    });
    const loaded = loadWorkspace(sessionStorage, WORKSPACE_STORAGE_KEY);
    expect(loaded.tabs[1]?.value).toBe(stagedId);
    expect(loaded.treeOwnershipPendingRemovalIds).toContain(fixture.owner.value);
    expect(tabStorage.read(stagedId)?.state).toEqual(importedTree);
});

test("preserves staged ownership and owner resources when the commit throws before the write lands", () => {
    const { fixture, stagedId } = replaceWithThrowingCommit(false);

    expect(fixture.store.get(tabsAtom)).toEqual([fixture.second, fixture.owner]);
    expect(sessionStorage.getItem(WORKSPACE_STORAGE_KEY)).toBe(fixture.workspaceBytes);
    // Loading an authoritative workspace sweeps the unreferenced staged tree.
    const loaded = loadWorkspace(sessionStorage, WORKSPACE_STORAGE_KEY);
    expect(loaded.tabs).toEqual([fixture.second, fixture.owner]);
    expect(sessionStorage.getItem(stagedId)).toBeNull();
});

test("supersedes an owner that is no longer in the workspace without writing", () => {
    const fixture = makeReplacementFixture();
    expect(fixture.store.set(tabsAtom, [fixture.second], fixture.second.value)).toBe(true);
    const workspaceBytes = sessionStorage.getItem(WORKSPACE_STORAGE_KEY);
    const ownerBytes = sessionStorage.getItem(fixture.owner.value);
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    const removeItem = vi.spyOn(Storage.prototype, "removeItem");

    expect(
        replaceNewTab({
            store: fixture.store,
            ownerId: fixture.owner.value,
            tab: { name: "Imported game", type: "analysis", gameOrigin: { kind: "none" } },
            tree: defaultTree(),
        }),
    ).toEqual({ kind: "superseded" });

    expect(sessionStorage.getItem(WORKSPACE_STORAGE_KEY)).toBe(workspaceBytes);
    expect(sessionStorage.getItem(fixture.owner.value)).toBe(ownerBytes);
    expect(setItem).not.toHaveBeenCalled();
    expect(removeItem).not.toHaveBeenCalled();
});

test.each(["not-new", "closing"] as const)(
    "supersedes an existing owner when it is %s without changing its resources",
    (reason) => {
        const fixture = makeReplacementFixture({
            ownerType: reason === "not-new" ? "analysis" : "new",
        });
        if (reason === "closing") {
            fixture.store.set(closingTabsAtom, new Set([fixture.owner.value]));
        }
        const setItem = vi.spyOn(Storage.prototype, "setItem");
        const removeItem = vi.spyOn(Storage.prototype, "removeItem");

        expect(
            replaceNewTab({
                store: fixture.store,
                ownerId: fixture.owner.value,
                tab: { name: "Imported game", type: "analysis", gameOrigin: { kind: "none" } },
                tree: defaultTree(),
            }),
        ).toEqual({ kind: "superseded" });

        expectReplacementOwnerUnchanged(fixture);
        expect(setItem).not.toHaveBeenCalled();
        expect(removeItem).not.toHaveBeenCalled();
    },
);

test("closing a tab removes all cached tab and per-engine atom-family entries", () => {
    const tabId = "closing-tab";
    const store = getDefaultStore();
    store.set(tabFamily(tabId), "practice");
    store.set(gameIdFamily(tabId), "native-game");
    store.set(pendingGameStartFamily(tabId), Promise.resolve());
    store.set(engineMovesFamily({ tab: tabId, engine: "engine" }), new Map());
    store.set(engineProgressFamily({ tab: tabId, engine: "engine" }), 42);
    store.set(
        tabEngineSettingsFamily({
            tab: tabId,
            engineId: "engine",
            defaultSettings: [],
            defaultGo: { t: "Infinite" },
        }),
        { enabled: true, settings: [], go: { t: "Infinite" }, synced: true },
    );

    disposeTabAtoms(tabId);

    expect([...tabFamily.getParams()]).not.toContain(tabId);
    expect([...gameIdFamily.getParams()]).not.toContain(tabId);
    expect([...pendingGameStartFamily.getParams()]).not.toContain(tabId);
    expect([...engineMovesFamily.getParams()]).not.toContainEqual({ tab: tabId, engine: "engine" });
    expect([...engineProgressFamily.getParams()]).not.toContainEqual({
        tab: tabId,
        engine: "engine",
    });
    expect([...tabEngineSettingsFamily.getParams()]).not.toContainEqual(
        expect.objectContaining({ tab: tabId }),
    );
});

test("close intent is transient and explicitly reclaimed", () => {
    const store = createStore();
    sessionStorage.clear();
    const before = { ...sessionStorage };
    store.set(closingTabsAtom, new Set(["closing-tab"]));
    expect(store.get(closingTabsAtom).has("closing-tab")).toBe(true);
    expect({ ...sessionStorage }).toEqual(before);
    store.set(closingTabsAtom, new Set());
    expect(store.get(closingTabsAtom)).toEqual(new Set());
    expect({ ...sessionStorage }).toEqual(before);
});

test("immediate close removes tab metadata and its pending tree in one lifecycle operation", () => {
    const tabId = "immediate-close";
    const store = createStore();
    sessionStorage.clear();
    tabStorage.seed(tabId, defaultTree());
    store.set(tabsAtom, [
        { name: "Close", value: tabId, type: "analysis", gameOrigin: { kind: "none" } },
    ]);
    store.set(activeTabAtom, tabId);

    store.set(closeWorkspaceTabAtom, tabId);

    expect(store.get(tabsAtom)).toEqual([]);
    expect(store.get(activeTabAtom)).toBeNull();
    expect(sessionStorage.getItem(tabId)).toBeNull();
});

test("refuses a 101st tab without changing the active tab or acknowledged workspace", async () => {
    sessionStorage.clear();
    const store = createStore();
    const tabs = Array.from({ length: 100 }, (_, index) => ({
        name: `Tab ${index}`,
        value: crypto.randomUUID(),
        type: "analysis" as const,
        gameOrigin: { kind: "none" as const },
    }));
    store.set(tabsAtom, tabs);
    store.set(activeTabAtom, tabs[0]!.value);

    const result = await createTab({
        tab: { name: "Refused", type: "analysis" },
        setTabs: (update, activeTab) => store.set(tabsAtom, update, activeTab),
        existingTabIds: tabs.map((tab) => tab.value),
    });

    expect(result).toBeNull();
    expect(store.get(tabsAtom)).toEqual(tabs);
    expect(store.get(activeTabAtom)).toBe(tabs[0]!.value);
});

test("returns the admitted tab id and activates it for a valid create", async () => {
    sessionStorage.clear();
    const store = createStore();
    store.set(tabsAtom, []);
    store.set(activeTabAtom, null);

    const result = await createTab({
        tab: { name: "Admitted", type: "analysis" },
        setTabs: (update, activeTab) => store.set(tabsAtom, update, activeTab),
    });

    expect(result).not.toBeNull();
    expect(store.get(tabsAtom)).toEqual([
        expect.objectContaining({ value: result, name: "Admitted", type: "analysis" }),
    ]);
    expect(store.get(activeTabAtom)).toBe(result);
});

test("rolls back a seeded tree when the workspace envelope write is refused", async () => {
    sessionStorage.clear();
    const store = createStore();
    const originalTabs = store.get(tabsAtom);
    const originalActive = store.get(activeTabAtom);
    tabStorage.seed(originalTabs[0]!.value, defaultTree());
    expect(store.set(tabsAtom, originalTabs, originalActive ?? undefined)).toBe(true);
    const durableEnvelope = sessionStorage.getItem("workspace");
    const setItem = refuseWorkspaceWrites();

    let stagedId = "";
    const result = commitNewTab({
        tab: { name: "Seeded", type: "analysis", gameOrigin: { kind: "none" } },
        seed: (id) => {
            stagedId = id;
            tabStorage.seed(id, defaultTree());
        },
        setTabs: (update, activeTab) => store.set(tabsAtom, update, activeTab),
    });

    expect(result).toBeNull();
    expect(store.get(tabsAtom)).toEqual(originalTabs);
    expect(store.get(activeTabAtom)).toBe(originalActive);
    expect(sessionStorage.getItem("workspace")).toBe(durableEnvelope);
    expect(sessionStorage.getItem(stagedId)).toBeNull();
    expect(tabStorage.read(originalTabs[0]!.value)).not.toBeNull();
    expect(tabStorage.pendingCount()).toBe(0);
    expect(persistError.reportPersistError).toHaveBeenCalledOnce();
    expect(loadWorkspace(sessionStorage, WORKSPACE_STORAGE_KEY)).toEqual({
        version: 1,
        tabs: originalTabs,
        activeTab: originalActive,
    });

    setItem.mockRestore();
    const retry = commitNewTab({
        tab: { name: "Seeded", type: "analysis", gameOrigin: { kind: "none" } },
        seed: (id) => tabStorage.seed(id, defaultTree()),
        setTabs: (update, activeTab) => store.set(tabsAtom, update, activeTab),
    });
    expect(retry).not.toBeNull();
    expect(store.get(activeTabAtom)).toBe(retry);
});

test.each(["play", "analysis", "puzzles"] as const)(
    "refuses the immutable %s home conversion without changing acknowledged state",
    (type) => {
        sessionStorage.clear();
        const store = createStore();
        const originalTab = {
            ...store.get(tabsAtom)[0]!,
            value: crypto.randomUUID(),
            name: "Tab.NewTab",
            type: "new" as const,
        };
        expect(store.set(tabsAtom, [originalTab], originalTab.value)).toBe(true);
        const durable = sessionStorage.getItem(WORKSPACE_STORAGE_KEY);
        refuseWorkspaceWrites();

        const receipt = store.set(tabsAtom, (tabs) =>
            tabs.map((tab) =>
                tab.value === originalTab.value ? { ...tab, name: `Home.${type}`, type } : tab,
            ),
        );

        expect(receipt).toBe(false);
        expect(originalTab).toMatchObject({ name: "Tab.NewTab", type: "new" });
        expect(store.get(tabsAtom)).toEqual([originalTab]);
        expect(store.get(activeTabAtom)).toBe(originalTab.value);
        expect(sessionStorage.getItem(WORKSPACE_STORAGE_KEY)).toBe(durable);
    },
);

test("refuses an existing-tab selection durably and succeeds after retry", () => {
    sessionStorage.clear();
    const store = createStore();
    const first = { ...store.get(tabsAtom)[0], value: crypto.randomUUID() };
    const second = { ...first, name: "Second", value: crypto.randomUUID() };
    expect(store.set(tabsAtom, [first, second], first.value)).toBe(true);
    const durable = sessionStorage.getItem("workspace");
    const setItem = refuseWorkspaceWrites();

    expect(store.set(activeTabAtom, second.value)).toBe(false);
    expect(store.get(activeTabAtom)).toBe(first.value);
    expect(sessionStorage.getItem("workspace")).toBe(durable);

    setItem.mockRestore();
    expect(store.set(activeTabAtom, second.value)).toBe(true);
    expect(store.get(activeTabAtom)).toBe(second.value);
});

test("preserves close resources on envelope failure and reclaims them on retry", () => {
    sessionStorage.clear();
    const store = createStore();
    const tabId = crypto.randomUUID();
    const tab = { ...store.get(tabsAtom)[0], value: tabId, type: "analysis" as const };
    const durableTree = defaultTree();
    tabStorage.seed(tabId, durableTree);
    const pendingTree = structuredClone(durableTree);
    pendingTree.headers.event = "Latest pending edit";
    tabStorage.write(tabId, { version: 1, state: pendingTree });
    store.set(tabFamily(tabId), "practice");
    expect(store.set(tabsAtom, [tab], tabId)).toBe(true);
    const setItem = refuseWorkspaceWrites();

    expect(store.set(closeWorkspaceTabAtom, tabId)).toBe(false);
    expect(store.get(tabsAtom)).toEqual([tab]);
    expect(tabStorage.read<ReturnType<typeof defaultTree>>(tabId)?.state.headers.event).toBe(
        "Latest pending edit",
    );
    expect(tabStorage.pendingCount()).toBe(1);
    expect([...tabFamily.getParams()]).toContain(tabId);

    setItem.mockRestore();
    expect(store.set(closeWorkspaceTabAtom, tabId)).toBe(true);
    expect(store.get(tabsAtom)).toEqual([]);
    expect(tabStorage.read(tabId)).toBeNull();
    expect(tabStorage.pendingCount()).toBe(0);
    expect(sessionStorage.getItem(tabId)).toBeNull();
    expect([...tabFamily.getParams()]).not.toContain(tabId);
});

test("keeps committed close metadata and attempts atom cleanup when tree removal fails", () => {
    sessionStorage.clear();
    const store = createStore();
    const tabId = crypto.randomUUID();
    const tab = { ...store.get(tabsAtom)[0]!, value: tabId, type: "analysis" as const };
    tabStorage.seed(tabId, defaultTree());
    store.set(tabFamily(tabId), "practice");
    expect(store.set(tabsAtom, [tab], tabId)).toBe(true);
    const removeItem = denyStorageRemoval(tabId);

    expect(store.set(closeWorkspaceTabAtom, tabId)).toBe(true);
    expect(store.get(tabsAtom)).toEqual([]);
    expect(store.get(activeTabAtom)).toBeNull();
    expect([...tabFamily.getParams()]).not.toContain(tabId);
    expect(persistError.reportPersistError).toHaveBeenCalledOnce();
    expect(sessionStorage.getItem(tabId)).not.toBeNull();
    removeItem.mockRestore();
    tabStorage.remove(tabId);
});

test("a failed close removal is retried after uncertain workspace ownership", async () => {
    sessionStorage.clear();
    const tabId = crypto.randomUUID();
    const tab = {
        name: "Close",
        value: tabId,
        type: "analysis" as const,
        gameOrigin: { kind: "none" as const },
    };
    sessionStorage.setItem(
        WORKSPACE_STORAGE_KEY,
        serializeStorageValue({
            version: 1,
            tabs: [tab],
            activeTab: tabId,
            treeOwnershipUncertain: true,
            treeOwnershipProtectedIds: [tabId],
        }),
    );
    tabStorage.seed(tabId, defaultTree());
    vi.resetModules();
    const freshAtoms = await import("./atoms");
    const store = createStore();
    const deny = denyStorageRemoval(tabId);

    expect(store.set(freshAtoms.closeWorkspaceTabAtom, tabId)).toBe(true);
    expect(sessionStorage.getItem(tabId)).not.toBeNull();
    deny.mockRestore();

    const reloaded = loadWorkspace(sessionStorage, WORKSPACE_STORAGE_KEY);
    expect(reloaded.treeOwnershipProtectedIds).not.toContain(tabId);
    expect(sessionStorage.getItem(tabId)).toBeNull();
});

test("a refused close save preserves protected ownership through reload", async () => {
    sessionStorage.clear();
    const tabId = crypto.randomUUID();
    const tab = {
        name: "Protected",
        value: tabId,
        type: "analysis" as const,
        gameOrigin: { kind: "none" as const },
    };
    sessionStorage.setItem(
        WORKSPACE_STORAGE_KEY,
        serializeStorageValue({
            version: 1,
            tabs: [tab],
            activeTab: tabId,
            treeOwnershipUncertain: true,
            treeOwnershipProtectedIds: [tabId],
        }),
    );
    tabStorage.seed(tabId, defaultTree());
    vi.resetModules();
    const freshAtoms = await import("./atoms");
    const store = createStore();
    const deny = refuseWorkspaceWrites();

    expect(store.set(freshAtoms.closeWorkspaceTabAtom, tabId)).toBe(false);

    deny.mockRestore();
    const reloaded = loadWorkspace(sessionStorage, WORKSPACE_STORAGE_KEY);
    expect(reloaded.tabs).toEqual([tab]);
    expect(reloaded.treeOwnershipProtectedIds).toContain(tabId);
    expect(sessionStorage.getItem(tabId)).not.toBeNull();
});

test("a failed close removal retries even when the ownership snapshot overflows", async () => {
    sessionStorage.clear();
    const tabId = crypto.randomUUID();
    const tab = {
        name: "Close",
        value: tabId,
        type: "analysis" as const,
        gameOrigin: { kind: "none" as const },
    };
    const tree = serializeStorageValue({ version: 1, state: defaultTree() });
    sessionStorage.setItem(tabId, tree);
    for (let index = 0; index < MAX_PROTECTED_TREE_KEYS; index++) {
        sessionStorage.setItem(`other-tree-${index}`, tree);
    }
    sessionStorage.setItem(
        WORKSPACE_STORAGE_KEY,
        serializeStorageValue({
            version: 1,
            tabs: [tab],
            activeTab: tabId,
            treeOwnershipUncertain: true,
        }),
    );
    vi.resetModules();
    const freshAtoms = await import("./atoms");
    const store = createStore();
    const deny = denyStorageRemoval(tabId);

    expect(store.set(freshAtoms.closeWorkspaceTabAtom, tabId)).toBe(true);
    expect(sessionStorage.getItem(tabId)).not.toBeNull();
    deny.mockRestore();

    const reloaded = loadWorkspace(sessionStorage, WORKSPACE_STORAGE_KEY);
    expect(reloaded.treeOwnershipUncertain).toBe(true);
    expect(reloaded).not.toHaveProperty("treeOwnershipProtectedIds");
    expect(reloaded.treeOwnershipPendingRemovalIds).toContain(tabId);
    expect(sessionStorage.getItem(tabId)).toBeNull();
});

test("closing a tab frees capacity from completed removal intents", async () => {
    sessionStorage.clear();
    const tabId = crypto.randomUUID();
    const tab = {
        name: "Close",
        value: tabId,
        type: "analysis" as const,
        gameOrigin: { kind: "none" as const },
    };
    const tree = serializeStorageValue({ version: 1, state: defaultTree() });
    const pendingIds = Array.from(
        { length: MAX_PENDING_TREE_REMOVALS },
        (_, index) => `pending-tree-${index}`,
    );
    for (const id of pendingIds) sessionStorage.setItem(id, tree);
    sessionStorage.setItem(tabId, tree);
    sessionStorage.setItem(
        WORKSPACE_STORAGE_KEY,
        serializeStorageValue({
            version: 1,
            tabs: [tab],
            activeTab: tabId,
            treeOwnershipUncertain: true,
            treeOwnershipProtectedIds: [],
            treeOwnershipPendingRemovalIds: pendingIds,
        }),
    );
    const deny = denyStorageRemoval((id) => id.startsWith("pending-tree-"));
    vi.resetModules();
    const freshAtoms = await import("./atoms");
    const store = createStore();
    persistError.reportPersistError.mockClear();

    expect(store.set(freshAtoms.closeWorkspaceTabAtom, tabId)).toBe(false);
    expect(store.get(freshAtoms.tabsAtom)).toEqual([tab]);
    expect(persistError.reportPersistError).toHaveBeenCalledWith(
        expect.objectContaining({
            cause: expect.objectContaining({
                message: `Pending tree removals exceeded ${MAX_PENDING_TREE_REMOVALS}: 101`,
            }),
        }),
    );
    expect(readStoredWorkspaceValue(sessionStorage, WORKSPACE_STORAGE_KEY)).toMatchObject({
        treeOwnershipPendingRemovalIds: pendingIds,
    });
    deny.mockRestore();

    expect(store.set(freshAtoms.closeWorkspaceTabAtom, tabId)).toBe(true);
    expect(store.get(freshAtoms.tabsAtom)).toEqual([]);
    expect(sessionStorage.getItem(pendingIds[0]!)).toBeNull();
    expect(readStoredWorkspaceValue(sessionStorage, WORKSPACE_STORAGE_KEY)).toMatchObject({
        treeOwnershipPendingRemovalIds: [tabId],
    });
});

test("closes inactive, active, and last tabs and ignores a stale close id", () => {
    sessionStorage.clear();
    const store = createStore();
    const tabs = ["First", "Second", "Third"].map((name) => ({
        ...store.get(tabsAtom)[0]!,
        name,
        value: crypto.randomUUID(),
        type: "analysis" as const,
    }));
    for (const tab of tabs) tabStorage.seed(tab.value, defaultTree());
    expect(store.set(tabsAtom, tabs, tabs[0]!.value)).toBe(true);

    expect(store.set(closeWorkspaceTabAtom, tabs[2]!.value)).toBe(true);
    expect(store.get(tabsAtom)).toEqual(tabs.slice(0, 2));
    expect(store.get(activeTabAtom)).toBe(tabs[0]!.value);
    expect(tabStorage.read(tabs[2]!.value)).toBeNull();

    expect(store.set(closeWorkspaceTabAtom, tabs[0]!.value)).toBe(true);
    expect(store.get(tabsAtom)).toEqual([tabs[1]]);
    expect(store.get(activeTabAtom)).toBe(tabs[1]!.value);
    expect(readStoredWorkspaceValue(sessionStorage, WORKSPACE_STORAGE_KEY)).toMatchObject({
        treeOwnershipPendingRemovalIds: [tabs[0]!.value],
    });
    expect(loadWorkspace(sessionStorage, WORKSPACE_STORAGE_KEY)).toEqual({
        version: 1,
        tabs: [tabs[1]],
        activeTab: tabs[1]!.value,
    });

    const durable = sessionStorage.getItem(WORKSPACE_STORAGE_KEY);
    expect(store.set(closeWorkspaceTabAtom, "stale-id")).toBe(false);
    expect(store.get(tabsAtom)).toEqual([tabs[1]]);
    expect(sessionStorage.getItem(WORKSPACE_STORAGE_KEY)).toBe(durable);

    expect(store.set(closeWorkspaceTabAtom, tabs[1]!.value)).toBe(true);
    expect(store.get(tabsAtom)).toEqual([]);
    expect(store.get(activeTabAtom)).toBeNull();
    expect(tabStorage.read(tabs[1]!.value)).toBeNull();
});
