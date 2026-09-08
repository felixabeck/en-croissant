import { createStore, getDefaultStore } from "jotai";
import { expect, test } from "vitest";
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
