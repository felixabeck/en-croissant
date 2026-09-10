import { createStore, getDefaultStore } from "jotai";
import { afterEach, expect, test, vi } from "vitest";
import { defaultTree } from "@/utils/treeReducer";
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
import { createTab, createTabFromSeed } from "@/utils/tabs";
import { createWorkspaceStorage, defaultWorkspace, WORKSPACE_STORAGE_KEY } from "./workspace";

const persistError = vi.hoisted(() => ({ reportPersistError: vi.fn() }));
vi.mock("./persistError", () => persistError);

afterEach(() => {
    persistError.reportPersistError.mockClear();
    vi.restoreAllMocks();
});

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
    const originalSetItem = Storage.prototype.setItem;
    const setItem = vi
        .spyOn(Storage.prototype, "setItem")
        .mockImplementation(function (this: Storage, key, value) {
            if (key === "workspace") throw new DOMException("quota", "QuotaExceededError");
            return originalSetItem.call(this, key, value);
        });

    let stagedId = "";
    const result = createTabFromSeed({
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
    expect(
        createWorkspaceStorage(sessionStorage).getItem(WORKSPACE_STORAGE_KEY, defaultWorkspace()),
    ).toEqual({ version: 1, tabs: originalTabs, activeTab: originalActive });

    setItem.mockRestore();
    const retry = createTabFromSeed({
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
        const originalSetItem = Storage.prototype.setItem;
        vi.spyOn(Storage.prototype, "setItem").mockImplementation(
            function (this: Storage, key, value) {
                if (key === WORKSPACE_STORAGE_KEY) {
                    throw new DOMException("quota", "QuotaExceededError");
                }
                return originalSetItem.call(this, key, value);
            },
        );

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
    const originalSetItem = Storage.prototype.setItem;
    const setItem = vi
        .spyOn(Storage.prototype, "setItem")
        .mockImplementation(function (this: Storage, key, value) {
            if (key === "workspace") throw new DOMException("quota", "QuotaExceededError");
            return originalSetItem.call(this, key, value);
        });

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
    tabStorage.seed(tabId, defaultTree());
    store.set(tabFamily(tabId), "practice");
    expect(store.set(tabsAtom, [tab], tabId)).toBe(true);
    const originalSetItem = Storage.prototype.setItem;
    const setItem = vi
        .spyOn(Storage.prototype, "setItem")
        .mockImplementation(function (this: Storage, key, value) {
            if (key === "workspace") throw new DOMException("quota", "QuotaExceededError");
            return originalSetItem.call(this, key, value);
        });

    expect(store.set(closeWorkspaceTabAtom, tabId)).toBe(false);
    expect(store.get(tabsAtom)).toEqual([tab]);
    expect(tabStorage.read(tabId)).not.toBeNull();
    expect([...tabFamily.getParams()]).toContain(tabId);

    setItem.mockRestore();
    expect(store.set(closeWorkspaceTabAtom, tabId)).toBe(true);
    expect(store.get(tabsAtom)).toEqual([]);
    expect(tabStorage.read(tabId)).toBeNull();
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
    const originalRemoveItem = Storage.prototype.removeItem;
    const removeItem = vi
        .spyOn(Storage.prototype, "removeItem")
        .mockImplementation(function (this: Storage, key) {
            if (key === tabId) throw new DOMException("denied", "SecurityError");
            return originalRemoveItem.call(this, key);
        });

    expect(store.set(closeWorkspaceTabAtom, tabId)).toBe(true);
    expect(store.get(tabsAtom)).toEqual([]);
    expect(store.get(activeTabAtom)).toBeNull();
    expect([...tabFamily.getParams()]).not.toContain(tabId);
    expect(persistError.reportPersistError).toHaveBeenCalledOnce();
    expect(sessionStorage.getItem(tabId)).not.toBeNull();
    removeItem.mockRestore();
    tabStorage.remove(tabId);
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
    expect(
        createWorkspaceStorage(sessionStorage).getItem(WORKSPACE_STORAGE_KEY, defaultWorkspace()),
    ).toEqual({ version: 1, tabs: [tabs[1]], activeTab: tabs[1]!.value });

    const durable = sessionStorage.getItem(WORKSPACE_STORAGE_KEY);
    expect(store.set(closeWorkspaceTabAtom, "stale-id")).toBe(false);
    expect(store.get(tabsAtom)).toEqual([tabs[1]]);
    expect(sessionStorage.getItem(WORKSPACE_STORAGE_KEY)).toBe(durable);

    expect(store.set(closeWorkspaceTabAtom, tabs[1]!.value)).toBe(true);
    expect(store.get(tabsAtom)).toEqual([]);
    expect(store.get(activeTabAtom)).toBeNull();
    expect(tabStorage.read(tabs[1]!.value)).toBeNull();
});
