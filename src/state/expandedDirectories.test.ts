import { createStore } from "jotai";
import type { FileWorkspaceHandle } from "@/bindings";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { expandedDirectoriesAtom, fileWorkspaceAtom } from "./atoms";
import {
    EXPANDED_DIRECTORIES_STORAGE_KEY,
    MAX_EXPANDED_DIRECTORY_IDS,
    MAX_EXPANDED_DIRECTORY_JSON_BYTES,
} from "./expandedDirectories";
import { deserializeStorageValue, serializeStorageValue } from "./store/debouncedStorage";

const persistError = vi.hoisted(() => ({ report: vi.fn() }));
vi.mock("./persistError", () => ({ reportPersistError: persistError.report }));

const workspace = (id: string): FileWorkspaceHandle => ({
    id: { id },
    kind: "fileWorkspace",
});

function activate(store: ReturnType<typeof createStore>, workspaceId: string) {
    store.set(fileWorkspaceAtom, workspace(workspaceId));
    return store.sub(expandedDirectoriesAtom, () => undefined);
}

function readPhysicalRecord() {
    const bytes = sessionStorage.getItem(EXPANDED_DIRECTORIES_STORAGE_KEY);
    expect(bytes).not.toBeNull();
    return deserializeStorageValue<{
        version: number;
        workspaceId: string;
        ids: string[];
    }>(bytes!);
}

function refuseExpansionWrite(message: string) {
    const originalSetItem = Storage.prototype.setItem;
    return vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (
        this: Storage,
        key: string,
        value: string,
    ) {
        if (this === sessionStorage && key === EXPANDED_DIRECTORIES_STORAGE_KEY) {
            throw new Error(message);
        }
        return originalSetItem.call(this, key, value);
    });
}

beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    persistError.report.mockReset();
});

afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    sessionStorage.clear();
    persistError.report.mockReset();
});

test("keeps legacy bytes without a workspace and discards unscoped IDs on activation", () => {
    const legacy = JSON.stringify(["legacy-one", "", "legacy-two", "legacy-one"]);
    sessionStorage.setItem(EXPANDED_DIRECTORIES_STORAGE_KEY, legacy);
    const store = createStore();
    const unsubscribe = store.sub(expandedDirectoriesAtom, () => undefined);

    expect(store.get(expandedDirectoriesAtom)).toEqual([]);
    expect(sessionStorage.getItem(EXPANDED_DIRECTORIES_STORAGE_KEY)).toBe(legacy);
    expect(persistError.report).not.toHaveBeenCalled();

    store.set(fileWorkspaceAtom, workspace("legacy-workspace"));
    expect(store.get(expandedDirectoriesAtom)).toEqual([]);
    expect(readPhysicalRecord()).toEqual({
        version: 1,
        workspaceId: "legacy-workspace",
        ids: [],
    });
    expect(persistError.report).not.toHaveBeenCalled();
    unsubscribe();
});

test("scopes reads and functional updates to the active workspace", () => {
    const store = createStore();
    const unsubscribe = activate(store, "workspace-a");
    store.set(expandedDirectoriesAtom, (ids) => [...ids, "directory-a"]);
    expect(store.get(expandedDirectoriesAtom)).toEqual(["directory-a"]);
    expect(readPhysicalRecord()).toEqual({
        version: 1,
        workspaceId: "workspace-a",
        ids: ["directory-a"],
    });

    store.set(fileWorkspaceAtom, workspace("workspace-b"));
    expect(store.get(expandedDirectoriesAtom)).toEqual([]);
    store.set(expandedDirectoriesAtom, (ids) => [...ids, "directory-b"]);
    expect(store.get(expandedDirectoriesAtom)).toEqual(["directory-b"]);
    expect(readPhysicalRecord()).toEqual({
        version: 1,
        workspaceId: "workspace-b",
        ids: ["directory-b"],
    });

    store.set(fileWorkspaceAtom, workspace("workspace-a"));
    expect(store.get(expandedDirectoriesAtom)).toEqual([]);
    unsubscribe();
});

test("keeps repeated expansion unique and collapse removes the directory", () => {
    const store = createStore();
    const unsubscribe = activate(store, "repeat-workspace");

    store.set(expandedDirectoriesAtom, (ids) => [...ids, "first", "second"]);
    store.set(expandedDirectoriesAtom, (ids) => [...ids, "first"]);
    expect(store.get(expandedDirectoriesAtom)).toEqual(["second", "first"]);

    store.set(expandedDirectoriesAtom, (ids) => ids.filter((id) => id !== "first"));
    expect(store.get(expandedDirectoriesAtom)).toEqual(["second"]);
    expect(readPhysicalRecord()?.ids).toEqual(["second"]);
    unsubscribe();
});

test("applies the count and UTF-8 JSON budgets at their exact limits", () => {
    const store = createStore();
    const unsubscribe = activate(store, "budget-workspace");
    const manyIds = Array.from(
        { length: MAX_EXPANDED_DIRECTORY_IDS + 3 },
        (_, index) => `directory-${index}`,
    );
    store.set(expandedDirectoriesAtom, manyIds);
    expect(store.get(expandedDirectoriesAtom)).toEqual(manyIds.slice(-MAX_EXPANDED_DIRECTORY_IDS));
    expect(readPhysicalRecord()?.ids).toHaveLength(MAX_EXPANDED_DIRECTORY_IDS);

    const envelopeBytes = new TextEncoder().encode(
        JSON.stringify({ version: 1, workspaceId: "budget-workspace", ids: [""] }),
    ).length;
    const availableIdBytes = MAX_EXPANDED_DIRECTORY_JSON_BYTES - envelopeBytes;
    const multibyteUnit = "界";
    const id =
        multibyteUnit.repeat(Math.floor(availableIdBytes / 3)) + "x".repeat(availableIdBytes % 3);
    store.set(expandedDirectoriesAtom, [id]);
    const exactRecord = readPhysicalRecord();
    expect(exactRecord?.ids).toEqual([id]);
    expect(new TextEncoder().encode(JSON.stringify(exactRecord)).length).toBe(
        MAX_EXPANDED_DIRECTORY_JSON_BYTES,
    );

    store.set(expandedDirectoriesAtom, (ids) => [...ids, "newest"]);
    expect(store.get(expandedDirectoriesAtom)).toEqual(["newest"]);
    expect(readPhysicalRecord()?.ids).toEqual(["newest"]);
    unsubscribe();
});

test("repairs a valid oversized stored record during atom hydration", () => {
    const ids = Array.from(
        { length: MAX_EXPANDED_DIRECTORY_IDS + 7 },
        (_, index) => `stored-${index}`,
    );
    sessionStorage.setItem(
        EXPANDED_DIRECTORIES_STORAGE_KEY,
        serializeStorageValue({ version: 1, workspaceId: "repair-workspace", ids }),
    );
    const store = createStore();
    const unsubscribe = activate(store, "repair-workspace");

    expect(store.get(expandedDirectoriesAtom)).toEqual(ids.slice(-MAX_EXPANDED_DIRECTORY_IDS));
    expect(readPhysicalRecord()).toEqual({
        version: 1,
        workspaceId: "repair-workspace",
        ids: ids.slice(-MAX_EXPANDED_DIRECTORY_IDS),
    });
    expect(persistError.report).not.toHaveBeenCalled();
    unsubscribe();
});

test("repairs an oversized record even when another workspace is active", () => {
    const ids = Array.from(
        { length: MAX_EXPANDED_DIRECTORY_IDS + 2 },
        (_, index) => `inactive-${index}`,
    );
    sessionStorage.setItem(
        EXPANDED_DIRECTORIES_STORAGE_KEY,
        serializeStorageValue({ version: 1, workspaceId: "inactive-workspace", ids }),
    );
    const store = createStore();
    const unsubscribe = activate(store, "active-workspace");
    expect(store.get(expandedDirectoriesAtom)).toEqual([]);
    expect(readPhysicalRecord()).toEqual({
        version: 1,
        workspaceId: "inactive-workspace",
        ids: ids.slice(-MAX_EXPANDED_DIRECTORY_IDS),
    });
    unsubscribe();
});

test("rejects an oversized incoming id before evicting prior entries", () => {
    const stored = serializeStorageValue({
        version: 1,
        workspaceId: "oversized-workspace",
        ids: ["prior-one", "prior-two"],
    });
    sessionStorage.setItem(EXPANDED_DIRECTORIES_STORAGE_KEY, stored);
    const store = createStore();
    const unsubscribe = activate(store, "oversized-workspace");
    const oversizedId = "x".repeat(MAX_EXPANDED_DIRECTORY_JSON_BYTES);

    store.set(expandedDirectoriesAtom, (ids) => [...ids, oversizedId]);

    expect(store.get(expandedDirectoriesAtom)).toEqual(["prior-one", "prior-two", oversizedId]);
    expect(sessionStorage.getItem(EXPANDED_DIRECTORIES_STORAGE_KEY)).toBe(stored);
    expect(persistError.report).toHaveBeenCalledOnce();
    const failure = persistError.report.mock.calls[0]?.[0] as Error;
    expect((failure.cause as Error).message).toContain(
        `maximum is ${MAX_EXPANDED_DIRECTORY_JSON_BYTES}`,
    );
    store.set(expandedDirectoriesAtom, (ids) => [...ids, "later-valid"]);
    expect(store.get(expandedDirectoriesAtom)).toEqual([
        "prior-one",
        "prior-two",
        oversizedId,
        "later-valid",
    ]);
    expect(readPhysicalRecord()?.ids).toEqual(["prior-one", "prior-two", "later-valid"]);
    unsubscribe();
});

test("preserves malformed bytes, reports the read failure, and keeps later expansion in memory", () => {
    const malformed = "{broken expanded-directory bytes";
    sessionStorage.setItem(EXPANDED_DIRECTORIES_STORAGE_KEY, malformed);
    const store = createStore();
    const unsubscribe = activate(store, "malformed-workspace");

    expect(store.get(expandedDirectoriesAtom)).toEqual([]);
    store.set(expandedDirectoriesAtom, (ids) => [...ids, "session-only"]);

    expect(store.get(expandedDirectoriesAtom)).toEqual(["session-only"]);
    expect(sessionStorage.getItem(EXPANDED_DIRECTORIES_STORAGE_KEY)).toBe(malformed);
    expect(persistError.report).toHaveBeenCalledOnce();
    unsubscribe();
});

test("preserves a valid JSON value with the wrong record version", () => {
    const invalid = JSON.stringify({ version: 2, workspaceId: "workspace", ids: ["old"] });
    sessionStorage.setItem(EXPANDED_DIRECTORIES_STORAGE_KEY, invalid);
    const store = createStore();
    const unsubscribe = activate(store, "workspace");
    expect(store.get(expandedDirectoriesAtom)).toEqual([]);
    store.set(expandedDirectoriesAtom, ["new"]);
    expect(sessionStorage.getItem(EXPANDED_DIRECTORIES_STORAGE_KEY)).toBe(invalid);
    expect(persistError.report).toHaveBeenCalledOnce();
    unsubscribe();
});

test("reports a storage read exception and keeps updates in memory", () => {
    const originalGetItem = Storage.prototype.getItem;
    const getItem = vi.spyOn(Storage.prototype, "getItem").mockImplementation(function (
        this: Storage,
        key: string,
    ) {
        if (this === sessionStorage && key === EXPANDED_DIRECTORIES_STORAGE_KEY) {
            throw new Error("storage read refused");
        }
        return originalGetItem.call(this, key);
    });
    const store = createStore();
    const unsubscribe = activate(store, "unreadable-workspace");
    expect(store.get(expandedDirectoriesAtom)).toEqual([]);
    store.set(expandedDirectoriesAtom, ["memory-only"]);
    expect(store.get(expandedDirectoriesAtom)).toEqual(["memory-only"]);
    expect(persistError.report).toHaveBeenCalledOnce();
    getItem.mockRestore();
    unsubscribe();
});

test("keeps the last good record when a save fails", () => {
    const stored = serializeStorageValue({
        version: 1,
        workspaceId: "failed-save-workspace",
        ids: ["durable"],
    });
    sessionStorage.setItem(EXPANDED_DIRECTORIES_STORAGE_KEY, stored);
    const setItem = refuseExpansionWrite("storage write refused");
    const store = createStore();
    const unsubscribe = activate(store, "failed-save-workspace");

    store.set(expandedDirectoriesAtom, (ids) => [...ids, "memory-only"]);

    setItem.mockRestore();
    expect(store.get(expandedDirectoriesAtom)).toEqual(["durable", "memory-only"]);
    expect(sessionStorage.getItem(EXPANDED_DIRECTORIES_STORAGE_KEY)).toBe(stored);
    expect(persistError.report).toHaveBeenCalledOnce();
    const saveFailure = persistError.report.mock.calls[0]?.[0] as Error;
    expect((saveFailure.cause as Error).message).toBe("storage write refused");
    unsubscribe();
});

test("keeps legacy bytes when hydration repair fails", () => {
    const legacy = JSON.stringify(["repair-me"]);
    sessionStorage.setItem(EXPANDED_DIRECTORIES_STORAGE_KEY, legacy);
    const setItem = refuseExpansionWrite("repair write refused");
    const store = createStore();
    const unsubscribe = activate(store, "failed-repair-workspace");

    expect(store.get(expandedDirectoriesAtom)).toEqual([]);

    setItem.mockRestore();
    expect(sessionStorage.getItem(EXPANDED_DIRECTORIES_STORAGE_KEY)).toBe(legacy);
    expect(persistError.report).toHaveBeenCalledOnce();
    const repairFailure = persistError.report.mock.calls[0]?.[0] as Error;
    expect((repairFailure.cause as Error).message).toBe("repair write refused");
    unsubscribe();
});
