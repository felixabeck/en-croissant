import { afterEach, expect, test, vi } from "vitest";
import { defaultTree } from "@/utils/treeReducer";
import { deserializeStorageValue, serializeStorageValue } from "./store/debouncedStorage";
import { tabStorage } from "./store/tabStorage";
import {
    defaultWorkspace,
    loadWorkspace,
    readStoredWorkspaceValue,
    saveWorkspace,
    scrubInvalidLegacyTreeKeys,
    WORKSPACE_STORAGE_KEY,
} from "./workspace";

const native = vi.hoisted(() => ({ warn: vi.fn() }));
const persistError = vi.hoisted(() => ({ reportPersistError: vi.fn() }));
vi.mock("@/platform/native", () => native);
vi.mock("./persistError", () => persistError);

const legacyTab = {
    name: "Legacy",
    value: "42",
    type: "analysis",
    gameOrigin: { kind: "none" },
} as const;

function loadStoredWorkspace() {
    return loadWorkspace(sessionStorage, WORKSPACE_STORAGE_KEY);
}

function readStoredWorkspace() {
    const raw = sessionStorage.getItem(WORKSPACE_STORAGE_KEY)!;
    return deserializeStorageValue<unknown>(raw) ?? JSON.parse(raw);
}

afterEach(() => {
    native.warn.mockClear();
    persistError.reportPersistError.mockClear();
    vi.restoreAllMocks();
});

test("default workspace is a complete, current envelope with one active new tab", () => {
    sessionStorage.clear();
    const workspace = defaultWorkspace();

    expect(workspace).toMatchObject({
        version: 1,
        tabs: [{ name: "Tab.NewTab", type: "new", gameOrigin: { kind: "none" } }],
        activeTab: workspace.tabs[0].value,
    });
    expect(workspace.tabs).toHaveLength(1);
    expect(workspace.tabs[0].value).toMatch(/^[0-9a-f]{8}-/i);
});

test("evaluates the complete static workspace schema on a fresh ESM module instance", async () => {
    vi.resetModules();
    const fresh = await import("./workspace");
    const valid = { ...legacyTab, value: crypto.randomUUID() };
    sessionStorage.setItem(
        fresh.WORKSPACE_STORAGE_KEY,
        JSON.stringify({ version: 1, tabs: [valid], activeTab: valid.value }),
    );

    expect(fresh.loadWorkspace(sessionStorage, fresh.WORKSPACE_STORAGE_KEY)).toEqual({
        version: 1,
        tabs: [valid],
        activeTab: valid.value,
    });
    expect(sessionStorage.getItem("workspace")).not.toBeNull();

    const second = { ...valid, name: "Second", value: crypto.randomUUID() };
    sessionStorage.setItem(
        "workspace",
        JSON.stringify({ version: 1, tabs: [valid, second], activeTab: second.value }),
    );
    expect(fresh.loadWorkspace(sessionStorage, fresh.WORKSPACE_STORAGE_KEY).activeTab).toBe(
        second.value,
    );

    sessionStorage.setItem(
        "workspace",
        JSON.stringify({ tabs: Array(101).fill(valid), activeTab: "x".repeat(129) }),
    );
    const repaired = fresh.loadWorkspace(sessionStorage, fresh.WORKSPACE_STORAGE_KEY);
    expect(repaired.tabs).toHaveLength(1);
    expect(repaired.activeTab).toBe(repaired.tabs[0].value);
});

test("migrates separate legacy keys, repairs IDs, and keeps tree state", () => {
    sessionStorage.clear();
    sessionStorage.setItem("tabs", JSON.stringify([legacyTab, legacyTab]));
    sessionStorage.setItem("activeTab", JSON.stringify("42"));
    sessionStorage.setItem("42", serializeStorageValue({ version: 0, state: defaultTree() }));
    const workspace = loadStoredWorkspace();

    expect(workspace.tabs).toHaveLength(2);
    expect(new Set(workspace.tabs.map((tab) => tab.value)).size).toBe(2);
    expect(workspace.tabs.every((tab) => /^[0-9a-f]{8}-/i.test(tab.value))).toBe(true);
    expect(sessionStorage.getItem("tabs")).toBeNull();
    expect(sessionStorage.getItem("activeTab")).toBeNull();
    expect(sessionStorage.getItem("42")).toBeNull();
    expect(workspace.tabs.every((tab) => sessionStorage.getItem(tab.value) !== null)).toBe(true);
    expect(readStoredWorkspace()).toEqual(workspace);
});

test("rolls back staged clones and preserves legacy storage when the envelope write fails", () => {
    sessionStorage.clear();
    sessionStorage.setItem("tabs", JSON.stringify([legacyTab]));
    sessionStorage.setItem("activeTab", JSON.stringify(legacyTab.value));
    const legacyTree = serializeStorageValue({ version: 0, state: defaultTree() });
    sessionStorage.setItem(legacyTab.value, legacyTree);
    const stagedCloneIds: string[] = [];
    const originalSetItem = Storage.prototype.setItem;
    const setItem = vi
        .spyOn(Storage.prototype, "setItem")
        .mockImplementation(function (this: Storage, key, value) {
            if (key === WORKSPACE_STORAGE_KEY) {
                throw new DOMException("quota", "QuotaExceededError");
            }
            if (key !== legacyTab.value && key !== "tabs" && key !== "activeTab") {
                stagedCloneIds.push(key);
            }
            return originalSetItem.call(this, key, value);
        });

    try {
        const workspace = loadStoredWorkspace();

        expect(workspace.tabs).toEqual([legacyTab]);
        expect(workspace.activeTab).toBe(legacyTab.value);
        expect(sessionStorage.getItem("tabs")).not.toBeNull();
        expect(sessionStorage.getItem("activeTab")).not.toBeNull();
        expect(tabStorage.read(legacyTab.value)?.state).toMatchObject({ root: defaultTree().root });
        expect(stagedCloneIds).toHaveLength(1);
        expect(sessionStorage.getItem(stagedCloneIds[0]!)).toBeNull();
        expect(sessionStorage.getItem(WORKSPACE_STORAGE_KEY)).toBeNull();
        expect(persistError.reportPersistError).toHaveBeenCalledOnce();
    } finally {
        setItem.mockRestore();
    }
});

test("successfully retries migration after a failed envelope write", () => {
    sessionStorage.clear();
    sessionStorage.setItem("tabs", JSON.stringify([legacyTab]));
    sessionStorage.setItem("activeTab", JSON.stringify(legacyTab.value));
    sessionStorage.setItem(
        legacyTab.value,
        serializeStorageValue({ version: 0, state: defaultTree() }),
    );
    const originalSetItem = Storage.prototype.setItem;
    const failedWrite = vi
        .spyOn(Storage.prototype, "setItem")
        .mockImplementation(function (this: Storage, key, value) {
            if (key === WORKSPACE_STORAGE_KEY) {
                throw new DOMException("quota", "QuotaExceededError");
            }
            return originalSetItem.call(this, key, value);
        });
    loadStoredWorkspace();
    failedWrite.mockRestore();

    const workspace = loadStoredWorkspace();

    expect(workspace.tabs[0].value).not.toBe(legacyTab.value);
    expect(tabStorage.read(workspace.tabs[0].value)).not.toBeNull();
    expect(sessionStorage.getItem(legacyTab.value)).toBeNull();
    expect(sessionStorage.getItem("tabs")).toBeNull();
    expect(sessionStorage.getItem("activeTab")).toBeNull();
    expect(readStoredWorkspace()).toEqual(workspace);
});

test("rewrites a pretty-printed JSON envelope in compressed form", () => {
    sessionStorage.clear();
    const valid = { ...legacyTab, value: crypto.randomUUID() };
    const workspace = { version: 1, tabs: [valid], activeTab: valid.value } as const;
    const prettyJson = JSON.stringify(workspace, null, 2);
    sessionStorage.setItem(WORKSPACE_STORAGE_KEY, prettyJson);
    const setItem = vi.spyOn(Storage.prototype, "setItem");

    const result = loadStoredWorkspace();

    expect(result).toEqual(workspace);
    expect(sessionStorage.getItem(WORKSPACE_STORAGE_KEY)).toBe(serializeStorageValue(result));
    expect(sessionStorage.getItem(WORKSPACE_STORAGE_KEY)).not.toBe(prettyJson);
    expect(setItem).toHaveBeenCalledWith(WORKSPACE_STORAGE_KEY, serializeStorageValue(result));
    setItem.mockRestore();
});

test("does not rewrite an already matching compressed envelope", () => {
    sessionStorage.clear();
    const valid = { ...legacyTab, value: crypto.randomUUID() };
    const workspace = { version: 1, tabs: [valid], activeTab: valid.value } as const;
    sessionStorage.setItem(WORKSPACE_STORAGE_KEY, serializeStorageValue(workspace));
    const setItem = vi.spyOn(Storage.prototype, "setItem");

    expect(loadStoredWorkspace()).toEqual(workspace);
    expect(setItem).not.toHaveBeenCalled();
    setItem.mockRestore();
});

test.each(["tabs", "activeTab"] as const)(
    "preserves the leftover %s key when cleanup cannot rewrite a matching envelope",
    (leftoverKey) => {
        sessionStorage.clear();
        const valid = { ...legacyTab, value: crypto.randomUUID() };
        const workspace = { version: 1, tabs: [valid], activeTab: valid.value } as const;
        const payload = serializeStorageValue(workspace);
        sessionStorage.setItem(WORKSPACE_STORAGE_KEY, payload);
        sessionStorage.setItem(leftoverKey, JSON.stringify("leftover"));
        const writeError = new DOMException("denied", "SecurityError");
        const originalSetItem = Storage.prototype.setItem;
        const setItem = vi
            .spyOn(Storage.prototype, "setItem")
            .mockImplementation(function (this: Storage, key, value) {
                if (key === WORKSPACE_STORAGE_KEY) throw writeError;
                return originalSetItem.call(this, key, value);
            });

        expect(loadStoredWorkspace()).toEqual(workspace);
        expect(sessionStorage.getItem(leftoverKey)).not.toBeNull();
        expect(sessionStorage.getItem(WORKSPACE_STORAGE_KEY)).toBe(payload);
        expect(persistError.reportPersistError).toHaveBeenCalledWith(writeError);
        setItem.mockRestore();
    },
);

test("cleans leftover legacy keys while leaving a matching envelope unchanged", () => {
    sessionStorage.clear();
    const valid = { ...legacyTab, value: crypto.randomUUID() };
    const workspace = { version: 1, tabs: [valid], activeTab: valid.value } as const;
    const payload = serializeStorageValue(workspace);
    sessionStorage.setItem(WORKSPACE_STORAGE_KEY, payload);
    sessionStorage.setItem("tabs", JSON.stringify([valid]));
    sessionStorage.setItem("activeTab", JSON.stringify(valid.value));

    expect(loadStoredWorkspace()).toEqual(workspace);
    expect(sessionStorage.getItem("tabs")).toBeNull();
    expect(sessionStorage.getItem("activeTab")).toBeNull();
    expect(sessionStorage.getItem(WORKSPACE_STORAGE_KEY)).toBe(payload);
});

test("corrupt workspace storage recovers to a valid single-tab envelope", () => {
    sessionStorage.clear();
    sessionStorage.setItem("workspace", "{broken");
    const clone = vi.spyOn(tabStorage, "clone");
    const workspace = loadStoredWorkspace();

    expect(workspace.tabs).toHaveLength(1);
    expect(workspace.activeTab).toBe(workspace.tabs[0].value);
    expect(readStoredWorkspace()).toMatchObject({
        version: 1,
    });
    expect(clone).not.toHaveBeenCalled();
});

test("scrubs corrupt legacy tab entries without discarding valid neighbouring tabs", () => {
    sessionStorage.clear();
    const validTab = { ...legacyTab, value: crypto.randomUUID() };
    sessionStorage.setItem(
        "workspace",
        JSON.stringify({
            version: 0,
            tabs: [validTab, { value: "orphan-tree", name: 42 }],
            activeTab: "orphan-tree",
        }),
    );
    sessionStorage.setItem(
        "orphan-tree",
        serializeStorageValue({ version: 0, state: defaultTree() }),
    );

    const workspace = loadStoredWorkspace();

    expect(workspace.tabs).toEqual([validTab]);
    expect(workspace.activeTab).toBe(validTab.value);
    expect(sessionStorage.getItem("orphan-tree")).toBeNull();
    expect(readStoredWorkspace()).toEqual({
        version: 1,
        tabs: [validTab],
        activeTab: validTab.value,
    });
});

test("keeps a valid current active ID, repairs stale IDs, and never scrubs retained trees", () => {
    sessionStorage.clear();
    const first = { ...legacyTab, value: crypto.randomUUID() };
    const second = { ...legacyTab, name: "Second", value: crypto.randomUUID() };
    sessionStorage.setItem(
        first.value,
        serializeStorageValue({ version: 0, state: defaultTree() }),
    );
    sessionStorage.setItem(
        WORKSPACE_STORAGE_KEY,
        JSON.stringify({ version: 1, tabs: [first, second], activeTab: second.value }),
    );

    const workspace = loadStoredWorkspace();
    expect(workspace.activeTab).toBe(second.value);
    expect(sessionStorage.getItem(first.value)).not.toBeNull();

    sessionStorage.setItem(
        WORKSPACE_STORAGE_KEY,
        JSON.stringify({ version: 1, tabs: [first, second], activeTab: "missing" }),
    );
    expect(loadStoredWorkspace().activeTab).toBe(first.value);
});

test("duplicate UUID migration retains the original tree and creates a copied tree", () => {
    sessionStorage.clear();
    const duplicate = { ...legacyTab, value: crypto.randomUUID() };
    sessionStorage.setItem(
        duplicate.value,
        serializeStorageValue({ version: 0, state: defaultTree() }),
    );
    sessionStorage.setItem(
        WORKSPACE_STORAGE_KEY,
        JSON.stringify({ version: 1, tabs: [duplicate, duplicate], activeTab: duplicate.value }),
    );

    const workspace = loadStoredWorkspace();
    expect(workspace.tabs).toHaveLength(2);
    expect(workspace.tabs[0].value).toBe(duplicate.value);
    expect(sessionStorage.getItem(duplicate.value)).not.toBeNull();
    expect(tabStorage.read(workspace.tabs[1].value)).not.toBeNull();
});

test("bounds and scrubs malformed workspace shapes without throwing", () => {
    sessionStorage.clear();
    const clone = vi.spyOn(tabStorage, "clone");
    for (const raw of [
        null,
        [],
        "workspace",
        0,
        { tabs: null, activeTab: 1 },
        { tabs: [null], activeTab: null },
        { tabs: [], activeTab: "x".repeat(129) },
    ]) {
        sessionStorage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify(raw));
        const workspace = loadStoredWorkspace();
        expect(workspace.tabs).toHaveLength(1);
        expect(workspace.activeTab).toBe(workspace.tabs[0].value);
    }

    const valid = { ...legacyTab, value: crypto.randomUUID() };
    sessionStorage.setItem(
        WORKSPACE_STORAGE_KEY,
        JSON.stringify({
            version: 1,
            tabs: [...Array(101).fill(valid)],
            activeTab: valid.value,
        }),
    );
    const bounded = loadStoredWorkspace();
    expect(bounded.tabs).toHaveLength(1);
    expect(bounded.activeTab).toBe(bounded.tabs[0].value);
    expect(clone).not.toHaveBeenCalled();
});

test("does not flush a workspace that needs no tab-ID migration", () => {
    sessionStorage.clear();
    const flush = vi.spyOn(tabStorage, "flush");
    const valid = { ...legacyTab, value: crypto.randomUUID() };
    sessionStorage.setItem(
        WORKSPACE_STORAGE_KEY,
        JSON.stringify({ version: 1, tabs: [valid], activeTab: valid.value }),
    );

    loadStoredWorkspace();
    expect(flush).not.toHaveBeenCalled();
    flush.mockRestore();
});

test("workspace JSON parsing and legacy-tree scrubbing distinguish malformed values", () => {
    sessionStorage.clear();
    sessionStorage.setItem("valid", JSON.stringify({ ok: true }));
    sessionStorage.setItem("invalid", "{");
    expect(readStoredWorkspaceValue(sessionStorage, "missing")).toBeNull();
    expect(readStoredWorkspaceValue(sessionStorage, "valid")).toEqual({ ok: true });
    expect(readStoredWorkspaceValue(sessionStorage, "invalid")).toBeNull();

    const retained = { ...legacyTab, value: crypto.randomUUID() };
    const orphan = "orphan";
    const nonStringValue = 42;
    sessionStorage.setItem(retained.value, "retained");
    sessionStorage.setItem(orphan, "orphan");
    sessionStorage.setItem(String(nonStringValue), "must-remain");
    scrubInvalidLegacyTreeKeys(
        {
            tabs: [
                null,
                "not-an-object",
                { value: retained.value },
                { value: orphan },
                { value: nonStringValue },
                {},
            ],
        },
        [retained],
    );
    expect(sessionStorage.getItem(retained.value)).toBe("retained");
    expect(sessionStorage.getItem(orphan)).toBeNull();
    expect(sessionStorage.getItem(String(nonStringValue))).toBe("must-remain");
    expect(() => scrubInvalidLegacyTreeKeys(null, [retained])).not.toThrow();
    const nonRecordWithThrowingTabs = Object.defineProperty(() => undefined, "tabs", {
        get: () => {
            throw new Error("non-record inputs must be ignored before property access");
        },
    });
    expect(() => scrubInvalidLegacyTreeKeys(nonRecordWithThrowingTabs, [retained])).not.toThrow();
});

test("saveWorkspace preserves tab IDs so a failed load migration can retry", () => {
    sessionStorage.clear();
    saveWorkspace(sessionStorage, WORKSPACE_STORAGE_KEY, {
        version: 1,
        tabs: [legacyTab],
        activeTab: legacyTab.value,
    });
    const stored = readStoredWorkspace() as { tabs: Array<{ value: string }>; activeTab: string };
    expect(stored.tabs[0].value).toBe(legacyTab.value);
    expect(stored.activeTab).toBe(legacyTab.value);

    sessionStorage.removeItem(WORKSPACE_STORAGE_KEY);
    expect(sessionStorage.getItem(WORKSPACE_STORAGE_KEY)).toBeNull();
});

test("saveWorkspace reports storage write failures", () => {
    sessionStorage.clear();
    const writeError = new DOMException("denied", "SecurityError");
    const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementationOnce(() => {
        throw writeError;
    });

    saveWorkspace(sessionStorage, WORKSPACE_STORAGE_KEY, defaultWorkspace());

    expect(persistError.reportPersistError).toHaveBeenCalledWith(writeError);
    setItem.mockRestore();
});

test("saveWorkspace refuses invalid and 101-tab live writes while preserving durable tabs", () => {
    sessionStorage.clear();
    const tabs = Array.from({ length: 100 }, (_, index) => ({
        ...legacyTab,
        name: `Tab ${index}`,
        value: crypto.randomUUID(),
    }));
    const durable = { version: 1 as const, tabs, activeTab: tabs[99]!.value };
    const firstTree = serializeStorageValue({ version: 0, state: defaultTree() });
    const lastTree = serializeStorageValue({ version: 0, state: defaultTree() });
    sessionStorage.setItem(tabs[0]!.value, firstTree);
    sessionStorage.setItem(tabs[99]!.value, lastTree);
    saveWorkspace(sessionStorage, WORKSPACE_STORAGE_KEY, durable);
    const storedAtBoundary = sessionStorage.getItem(WORKSPACE_STORAGE_KEY);

    saveWorkspace(sessionStorage, WORKSPACE_STORAGE_KEY, {
        ...durable,
        tabs: [...tabs, { ...legacyTab, value: crypto.randomUUID() }],
    });
    saveWorkspace(sessionStorage, WORKSPACE_STORAGE_KEY, "invalid" as never);
    saveWorkspace(sessionStorage, WORKSPACE_STORAGE_KEY, {
        ...durable,
        tabs: [...tabs.slice(0, 99), { ...legacyTab, name: 42 } as never],
    });

    expect(sessionStorage.getItem(WORKSPACE_STORAGE_KEY)).toBe(storedAtBoundary);
    expect(readStoredWorkspace()).toEqual(durable);
    expect(persistError.reportPersistError).toHaveBeenCalledTimes(3);

    const reloaded = loadStoredWorkspace();
    expect(reloaded).toEqual(durable);
    expect(sessionStorage.getItem(tabs[0]!.value)).toBe(firstTree);
    expect(sessionStorage.getItem(tabs[99]!.value)).toBe(lastTree);
});

test("saveWorkspace preserves an empty live workspace for the replacement-tab effect", () => {
    sessionStorage.clear();

    saveWorkspace(sessionStorage, WORKSPACE_STORAGE_KEY, {
        version: 1,
        tabs: [],
        activeTab: null,
    });

    const stored = readStoredWorkspace() as ReturnType<typeof defaultWorkspace>;
    expect(stored).toEqual({ version: 1, tabs: [], activeTab: null });
});

test("saveWorkspace falls back from a mismatched active tab to the first tab", () => {
    sessionStorage.clear();
    const first = { ...legacyTab, value: crypto.randomUUID() };
    const second = { ...legacyTab, name: "Second", value: crypto.randomUUID() };

    saveWorkspace(sessionStorage, WORKSPACE_STORAGE_KEY, {
        version: 1,
        tabs: [first, second],
        activeTab: crypto.randomUUID(),
    });

    const stored = readStoredWorkspace() as ReturnType<typeof defaultWorkspace>;
    expect(stored.tabs).toEqual([first, second]);
    expect(stored.activeTab).toBe(stored.tabs[0].value);
});

test("rolls back staged clones when clone flush fails and leaves legacy trees", () => {
    sessionStorage.clear();
    const secondLegacyTab = { ...legacyTab, name: "Second", value: "43" } as const;
    sessionStorage.setItem("tabs", JSON.stringify([legacyTab, secondLegacyTab]));
    sessionStorage.setItem("activeTab", JSON.stringify(secondLegacyTab.value));
    sessionStorage.setItem(
        legacyTab.value,
        serializeStorageValue({ version: 0, state: defaultTree() }),
    );
    sessionStorage.setItem(
        secondLegacyTab.value,
        serializeStorageValue({ version: 0, state: defaultTree() }),
    );
    const cloneWriteError = new DOMException("quota", "QuotaExceededError");
    const cloneIds: string[] = [];
    const originalSetItem = Storage.prototype.setItem;
    const setItem = vi
        .spyOn(Storage.prototype, "setItem")
        .mockImplementation(function (this: Storage, key, value) {
            if (
                key !== WORKSPACE_STORAGE_KEY &&
                key !== legacyTab.value &&
                key !== secondLegacyTab.value &&
                key !== "tabs" &&
                key !== "activeTab"
            ) {
                cloneIds.push(key);
                if (cloneIds.length === 2) throw cloneWriteError;
            }
            return originalSetItem.call(this, key, value);
        });

    try {
        const workspace = loadStoredWorkspace();
        expect(workspace.tabs).toEqual([legacyTab, secondLegacyTab]);
        expect(workspace.activeTab).toBe(secondLegacyTab.value);
        expect(tabStorage.read(legacyTab.value)).not.toBeNull();
        expect(tabStorage.read(secondLegacyTab.value)).not.toBeNull();
        expect(cloneIds).toHaveLength(2);
        expect(cloneIds.every((id) => sessionStorage.getItem(id) === null)).toBe(true);
        expect(sessionStorage.getItem("tabs")).not.toBeNull();
        expect(sessionStorage.getItem("activeTab")).not.toBeNull();
        expect(sessionStorage.getItem(WORKSPACE_STORAGE_KEY)).toBeNull();
        expect(persistError.reportPersistError).toHaveBeenCalledWith(
            expect.objectContaining({
                message:
                    "Could not open the game: the browser's session storage is full. Close some open tabs and try again.",
                cause: cloneWriteError,
            }),
        );
    } finally {
        setItem.mockRestore();
    }
});
