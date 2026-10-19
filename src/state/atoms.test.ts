import { createStore } from "jotai";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { deserializeStorageValue, serializeStorageValue } from "./store/debouncedStorage";
import type { Tab } from "./workspaceTypes";

vi.mock("@/platform/native", () => ({ warn: vi.fn() }));
const sessionNative = vi.hoisted(() => ({
    listLichessAccounts: vi.fn(),
    migrateLegacyLichessToken: vi.fn(),
    revokeLegacyLichessToken: vi.fn(),
}));
vi.mock("@/platform/tauri", () => ({ tauri: sessionNative }));

beforeEach(() => {
    vi.resetModules();
    sessionStorage.clear();
    localStorage.clear();
});

afterEach(() => {
    vi.restoreAllMocks();
    sessionStorage.clear();
    localStorage.clear();
});

async function importAtoms() {
    const workspace = await import("./workspace");
    const load = vi.spyOn(workspace, "loadWorkspace");
    const atoms = await import("./atoms");
    return { atoms, load };
}

test.each([
    [null, true],
    ["false", false],
    ["true", true],
    ['"invalid"', true],
    ["{", true],
] as const)("drawing click preference hydrates %s as %s", async (stored, expected) => {
    if (stored !== null) localStorage.setItem("erase-drawables-on-click", stored);
    const { atoms } = await importAtoms();
    const store = createStore();
    const unsubscribe = store.sub(atoms.eraseDrawablesOnClickAtom, () => {});
    try {
        expect(store.get(atoms.eraseDrawablesOnClickAtom)).toBe(expected);
    } finally {
        unsubscribe();
    }
});

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

test("real bootstrap retains the latest safe sessions through atom mount, remount and save recovery", async () => {
    const token = "private-bootstrap-token-sentinel";
    const publicSessions = [
        {
            player: "Lichess alias",
            updatedAt: 123,
            lichess: {
                username: "Player",
                handle: "old-handle",
                account: {
                    id: "player",
                    username: "Player",
                    perfs: { blitz: { rating: 1800, games: 8, rd: 40, prog: 0, prov: false } },
                },
            },
        },
        { player: "Chess.com alias", updatedAt: 456, chessCom: { username: "Other", stats: {} } },
    ] as const;
    localStorage.setItem(
        "sessions",
        JSON.stringify([
            { ...publicSessions[0], lichess: { ...publicSessions[0].lichess, accessToken: token } },
            publicSessions[1],
        ]),
    );
    const write = Storage.prototype.setItem;
    const refusal = vi
        .spyOn(Storage.prototype, "setItem")
        .mockImplementation(function (this: Storage, key, value) {
            if (key === "sessions") throw new DOMException(token, "QuotaExceededError");
            return write.call(this, key, value);
        });
    const diagnostics = vi.spyOn(console, "warn");
    sessionNative.migrateLegacyLichessToken.mockResolvedValue({
        account: { username: "Player", handle: "migrated-handle" },
    });
    sessionNative.listLichessAccounts.mockResolvedValue([
        { username: "PLAYER", handle: "current-handle" },
    ]);
    const { atoms } = await importAtoms();
    const session = await import("../utils/session");
    const startup = await session.initializePersistedSessions();
    const expected = [
        {
            ...publicSessions[0],
            lichess: { ...publicSessions[0].lichess, handle: "current-handle" },
        },
        publicSessions[1],
    ];
    expect(startup).toEqual({ status: "unsaved", sessions: expected });
    expect(localStorage.getItem("sessions")).toBeNull();
    const store = createStore();
    expect(store.get(atoms.sessionsAtom)).toEqual(expected);
    const secondStore = createStore();
    expect(secondStore.get(atoms.sessionsAtom)).toEqual(expected);
    const listener = vi.fn();
    let unmount = store.sub(atoms.sessionsAtom, listener);
    expect(store.get(atoms.sessionsAtom)).toEqual(expected);
    unmount();
    // A stale public key must not replace the document's admitted list on remount.
    write.call(localStorage, "sessions", JSON.stringify([publicSessions[1]]));
    unmount = store.sub(atoms.sessionsAtom, listener);
    expect(store.get(atoms.sessionsAtom)).toEqual(expected);
    store.set(atoms.sessionsAtom, (sessions) =>
        sessions.map((s, index) => (index === 0 ? { ...s, player: "New alias" } : s)),
    );
    store.set(atoms.sessionsAtom, (sessions) => sessions.filter((s) => !s.chessCom));
    const latest = [{ ...expected[0], player: "New alias" }];
    expect(session.retrySessionPersistence()).toEqual({ status: "unsaved", sessions: latest });
    expect(store.get(atoms.sessionsAtom)).toEqual(latest);
    const nativeCalls = sessionNative.listLichessAccounts.mock.calls.length;
    unmount();
    secondStore.set(atoms.sessionsAtom, (sessions) =>
        sessions.map((s) => ({ ...s, player: "Edited while unmounted" })),
    );
    unmount = store.sub(atoms.sessionsAtom, listener);
    expect(store.get(atoms.sessionsAtom)[0]?.player).toBe("Edited while unmounted");
    expect(store.get(atoms.sessionsAtom)).toHaveLength(1);
    refusal.mockRestore();
    const recovered = session.retrySessionPersistence();
    expect(recovered.status).toBe("saved");
    expect(deserializeStorageValue(localStorage.getItem("sessions")!)).toEqual(recovered.sessions);
    expect(sessionNative.listLichessAccounts).toHaveBeenCalledTimes(nativeCalls);
    expect(sessionNative.migrateLegacyLichessToken).toHaveBeenCalledExactlyOnceWith(
        "Player",
        token,
    );
    expect(sessionNative.revokeLegacyLichessToken).not.toHaveBeenCalled();
    for (const value of [
        startup,
        recovered,
        session.getSessionPersistenceSnapshot(),
        diagnostics.mock.calls,
    ]) {
        expect(JSON.stringify(value)).not.toContain(token);
    }
    expect(localStorage.getItem("sessions")).not.toContain(token);
    unmount();
    listener.mockClear();
    session.retrySessionPersistence();
    expect(listener).not.toHaveBeenCalled();
    // Re-executing real bootstrap reads the canonical encoding via the production decoder.
    expect(await session.initializePersistedSessions()).toEqual(recovered);
    const reloadedStore = createStore();
    const unmountReload = reloadedStore.sub(atoms.sessionsAtom, () => {});
    expect(reloadedStore.get(atoms.sessionsAtom)).toEqual(recovered.sessions);
    unmountReload();
});
