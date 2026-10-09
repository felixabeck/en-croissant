import { createStore } from "jotai";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { deserializeStorageValue, serializeStorageValue } from "./store/debouncedStorage";
import type { TabStorageRepository } from "./store/tabStorage";
import type { Tab } from "./workspaceTypes";

const repositories = new Set<TabStorageRepository>();

beforeEach(() => {
    vi.resetModules();
    sessionStorage.clear();
    localStorage.clear();
});

afterEach(() => {
    vi.restoreAllMocks();
    for (const repository of repositories) {
        for (const id of repository.flush()) repository.remove(id);
    }
    repositories.clear();
    sessionStorage.clear();
    localStorage.clear();
});

async function importAtoms() {
    const workspace = await import("./workspace");
    const load = vi.spyOn(workspace, "loadWorkspace");
    const atoms = await import("./atoms");
    repositories.add((await import("./store/tabStorage")).tabStorage);
    return { atoms, load };
}

function seedWorkspace() {
    const tabs: Tab[] = ["First", "Second"].map((name) => ({
        name,
        value: crypto.randomUUID(),
        type: "new",
        gameOrigin: { kind: "none" },
    }));
    const workspace = { version: 1, tabs, activeTab: tabs[1]!.value };
    const bytes = serializeStorageValue(workspace);
    sessionStorage.setItem("workspace", bytes);
    return { workspace, bytes };
}

test("import leaves workspace hydration for the first synchronous atom read", async () => {
    const { workspace, bytes } = seedWorkspace();
    const { atoms, load } = await importAtoms();

    expect(load).not.toHaveBeenCalled();
    expect(sessionStorage.getItem("workspace")).toBe(bytes);

    const store = createStore();
    expect(store.get(atoms.activeTabAtom)).toBe(workspace.activeTab);
    expect(store.get(atoms.tabsAtom)).toEqual(workspace.tabs);
    expect(load).toHaveBeenCalledExactlyOnceWith(sessionStorage, "workspace");
    expect(atoms.initializeWorkspace()).toEqual(workspace);
    expect(load).toHaveBeenCalledOnce();
});

test("new stores share the original snapshot while later edits and empty state stay local", async () => {
    const { workspace } = seedWorkspace();
    const { atoms, load } = await importAtoms();
    const initial = atoms.initializeWorkspace();
    const first = createStore();
    const second = createStore();
    expect(first.get(atoms.tabsAtom)).toBe(initial.tabs);
    expect(second.get(atoms.tabsAtom)).toBe(initial.tabs);

    expect(
        first.set(atoms.tabsAtom, (tabs) => tabs.map((tab) => ({ ...tab, name: "Edited" }))),
    ).toBe(true);
    expect(first.set(atoms.activeTabAtom, workspace.tabs[0]!.value)).toBe(true);
    expect(second.get(atoms.tabsAtom)).toBe(initial.tabs);
    expect(second.get(atoms.activeTabAtom)).toBe(workspace.activeTab);
    expect(atoms.initializeWorkspace()).toBe(initial);
    expect(first.get(atoms.tabsAtom).every((tab) => tab.name === "Edited")).toBe(true);

    expect(first.set(atoms.tabsAtom, [])).toBe(true);
    expect(first.get(atoms.tabsAtom)).toEqual([]);
    expect(first.get(atoms.activeTabAtom)).toBeNull();
    expect(atoms.initializeWorkspace()).toBe(initial);
    expect(first.get(atoms.tabsAtom)).toEqual([]);
    expect(deserializeStorageValue(sessionStorage.getItem("workspace")!)).toMatchObject({
        tabs: [],
        activeTab: null,
    });
    const third = createStore();
    expect(third.get(atoms.tabsAtom)).toBe(initial.tabs);
    expect(third.get(atoms.activeTabAtom)).toBe(workspace.activeTab);
    expect(load).toHaveBeenCalledOnce();
});

test("the first atom write hydrates and persists selection in the same call", async () => {
    const { workspace } = seedWorkspace();
    const { atoms, load } = await importAtoms();
    const store = createStore();
    const originalSetItem = Storage.prototype.setItem;
    const save = vi
        .spyOn(Storage.prototype, "setItem")
        .mockImplementation(function (this: Storage, key, value) {
            if (this === sessionStorage && key === "workspace") {
                expect(store.get(atoms.activeTabAtom)).toBe(workspace.activeTab);
            }
            return originalSetItem.call(this, key, value);
        });

    expect(store.set(atoms.activeTabAtom, workspace.tabs[0]!.value)).toBe(true);

    expect(store.get(atoms.tabsAtom)).toEqual(workspace.tabs);
    expect(store.get(atoms.activeTabAtom)).toBe(workspace.tabs[0]!.value);
    expect(deserializeStorageValue(sessionStorage.getItem("workspace")!)).toEqual({
        ...workspace,
        activeTab: workspace.tabs[0]!.value,
    });
    expect(load).toHaveBeenCalledOnce();
    expect(save).toHaveBeenCalledOnce();
});

test("failed initialization propagates without caching a successful default", async () => {
    const { workspace, bytes } = seedWorkspace();
    const { atoms, load } = await importAtoms();
    const failure = new DOMException("workspace read refused", "SecurityError");
    const originalGetItem = Storage.prototype.getItem;
    const refusal = vi
        .spyOn(Storage.prototype, "getItem")
        .mockImplementation(function (this: Storage, key) {
            if (this === sessionStorage && key === "workspace") throw failure;
            return originalGetItem.call(this, key);
        });

    expect(() => atoms.initializeWorkspace()).toThrow(failure);
    expect(() => atoms.initializeWorkspace()).toThrow(failure);
    expect(() => createStore().set(atoms.tabsAtom, [])).toThrow(failure);
    expect(load).toHaveBeenCalledTimes(3);
    refusal.mockRestore();
    expect(sessionStorage.getItem("workspace")).toBe(bytes);

    const initial = atoms.initializeWorkspace();
    expect(initial).toEqual(workspace);
    expect(createStore().get(atoms.tabsAtom)).toBe(initial.tabs);
    expect(atoms.initializeWorkspace()).toBe(initial);
    expect(load).toHaveBeenCalledTimes(4);
});

test("original path owners are captured before direct atom access repairs legacy storage", async () => {
    const fileTab: Tab = {
        name: "Legacy file",
        value: "legacy-file",
        type: "analysis",
        gameOrigin: {
            kind: "file",
            gameNumber: 0,
            file: {
                type: "file",
                handle: { id: { id: "original-file-owner" }, kind: "fileWorkspace" },
                name: "game.pgn",
                numGames: 1,
                lastModified: 0,
                metadata: { type: "game", tags: [] },
            },
        },
    };
    const legacyBytes = serializeStorageValue([fileTab]);
    sessionStorage.setItem("tabs", legacyBytes);
    sessionStorage.setItem("activeTab", serializeStorageValue(fileTab.value));
    const { atoms, load } = await importAtoms();
    const { originalPathOwnersSnapshot } = await import("./pathOwners");
    expect(load).not.toHaveBeenCalled();
    expect(sessionStorage.getItem("tabs")).toBe(legacyBytes);
    expect(originalPathOwnersSnapshot.retainedIds).toContainEqual({ id: "original-file-owner" });

    const tabs = createStore().get(atoms.tabsAtom);

    expect(tabs[0]!.value).not.toBe(fileTab.value);
    expect(tabs[0]!.gameOrigin).toEqual(fileTab.gameOrigin);
    expect(sessionStorage.getItem("tabs")).toBeNull();
    expect(originalPathOwnersSnapshot.retainedIds).toContainEqual({ id: "original-file-owner" });
    expect(load).toHaveBeenCalledOnce();
});
