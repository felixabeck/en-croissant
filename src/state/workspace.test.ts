import { afterEach, expect, test, vi } from "vitest";
import { defaultTree } from "@/utils/treeReducer";
import { deserializeStorageValue, serializeStorageValue } from "./store/debouncedStorage";
import { tabStorage } from "./store/tabStorage";
import {
    createWorkspaceStorage,
    defaultWorkspace,
    readWorkspaceJson,
    scrubInvalidLegacyTreeKeys,
    WORKSPACE_STORAGE_KEY,
} from "./workspace";

const native = vi.hoisted(() => ({ warn: vi.fn() }));
vi.mock("@/platform/native", () => native);

const legacyTab = {
    name: "Legacy",
    value: "42",
    type: "analysis",
    gameOrigin: { kind: "none" },
} as const;

function workspaceStorage() {
    return createWorkspaceStorage(sessionStorage);
}

function readStoredWorkspace() {
    const raw = sessionStorage.getItem(WORKSPACE_STORAGE_KEY)!;
    return deserializeStorageValue<unknown>(raw) ?? JSON.parse(raw);
}

afterEach(() => {
    native.warn.mockClear();
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

    expect(
        fresh
            .createWorkspaceStorage(sessionStorage)
            .getItem(fresh.WORKSPACE_STORAGE_KEY, fresh.defaultWorkspace()),
    ).toEqual({ version: 1, tabs: [valid], activeTab: valid.value });
    expect(sessionStorage.getItem("workspace")).not.toBeNull();

    const second = { ...valid, name: "Second", value: crypto.randomUUID() };
    sessionStorage.setItem(
        "workspace",
        JSON.stringify({ version: 1, tabs: [valid, second], activeTab: second.value }),
    );
    expect(
        fresh
            .createWorkspaceStorage(sessionStorage)
            .getItem(fresh.WORKSPACE_STORAGE_KEY, fresh.defaultWorkspace()).activeTab,
    ).toBe(second.value);

    sessionStorage.setItem(
        "workspace",
        JSON.stringify({ tabs: Array(101).fill(valid), activeTab: "x".repeat(129) }),
    );
    const repaired = fresh
        .createWorkspaceStorage(sessionStorage)
        .getItem(fresh.WORKSPACE_STORAGE_KEY, fresh.defaultWorkspace());
    expect(repaired.tabs).toHaveLength(1);
    expect(repaired.activeTab).toBe(repaired.tabs[0].value);
});

test("migrates separate legacy keys, repairs IDs, and keeps tree state", () => {
    sessionStorage.clear();
    sessionStorage.setItem("tabs", JSON.stringify([legacyTab, legacyTab]));
    sessionStorage.setItem("activeTab", JSON.stringify("42"));
    sessionStorage.setItem("42", serializeStorageValue({ version: 0, state: defaultTree() }));
    const storage = workspaceStorage();

    const workspace = storage.getItem(WORKSPACE_STORAGE_KEY, defaultWorkspace());

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
        .mockImplementation(function (key, value) {
            if (key === WORKSPACE_STORAGE_KEY) {
                throw new DOMException("quota", "QuotaExceededError");
            }
            if (key !== legacyTab.value && key !== "tabs" && key !== "activeTab") {
                stagedCloneIds.push(key);
            }
            return originalSetItem.call(this, key, value);
        });

    try {
        const workspace = workspaceStorage().getItem(WORKSPACE_STORAGE_KEY, defaultWorkspace());

        expect(workspace.tabs).toEqual([legacyTab]);
        expect(workspace.activeTab).toBe(legacyTab.value);
        expect(sessionStorage.getItem("tabs")).not.toBeNull();
        expect(sessionStorage.getItem("activeTab")).not.toBeNull();
        expect(tabStorage.read(legacyTab.value)?.state).toMatchObject({ root: defaultTree().root });
        expect(stagedCloneIds).toHaveLength(1);
        expect(sessionStorage.getItem(stagedCloneIds[0]!)).toBeNull();
        expect(sessionStorage.getItem(WORKSPACE_STORAGE_KEY)).toBeNull();
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
        .mockImplementation(function (key, value) {
            if (key === WORKSPACE_STORAGE_KEY) {
                throw new DOMException("quota", "QuotaExceededError");
            }
            return originalSetItem.call(this, key, value);
        });
    workspaceStorage().getItem(WORKSPACE_STORAGE_KEY, defaultWorkspace());
    failedWrite.mockRestore();

    const workspace = workspaceStorage().getItem(WORKSPACE_STORAGE_KEY, defaultWorkspace());

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

    const result = workspaceStorage().getItem(WORKSPACE_STORAGE_KEY, defaultWorkspace());

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

    expect(workspaceStorage().getItem(WORKSPACE_STORAGE_KEY, defaultWorkspace())).toEqual(
        workspace,
    );
    expect(setItem).not.toHaveBeenCalled();
    setItem.mockRestore();
});

test("corrupt workspace storage recovers to a valid single-tab envelope", () => {
    sessionStorage.clear();
    sessionStorage.setItem("workspace", "{broken");
    const workspace = workspaceStorage().getItem(WORKSPACE_STORAGE_KEY, defaultWorkspace());

    expect(workspace.tabs).toHaveLength(1);
    expect(workspace.activeTab).toBe(workspace.tabs[0].value);
    expect(readStoredWorkspace()).toMatchObject({
        version: 1,
    });
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

    const workspace = workspaceStorage().getItem(WORKSPACE_STORAGE_KEY, defaultWorkspace());

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

    const workspace = workspaceStorage().getItem(WORKSPACE_STORAGE_KEY, defaultWorkspace());
    expect(workspace.activeTab).toBe(second.value);
    expect(sessionStorage.getItem(first.value)).not.toBeNull();

    sessionStorage.setItem(
        WORKSPACE_STORAGE_KEY,
        JSON.stringify({ version: 1, tabs: [first, second], activeTab: "missing" }),
    );
    expect(workspaceStorage().getItem(WORKSPACE_STORAGE_KEY, defaultWorkspace()).activeTab).toBe(
        first.value,
    );
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

    const workspace = workspaceStorage().getItem(WORKSPACE_STORAGE_KEY, defaultWorkspace());
    expect(workspace.tabs).toHaveLength(2);
    expect(workspace.tabs[0].value).toBe(duplicate.value);
    expect(sessionStorage.getItem(duplicate.value)).not.toBeNull();
    expect(tabStorage.read(workspace.tabs[1].value)).not.toBeNull();
});

test("bounds and scrubs malformed workspace shapes without throwing", () => {
    sessionStorage.clear();
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
        const workspace = workspaceStorage().getItem(WORKSPACE_STORAGE_KEY, defaultWorkspace());
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
    const bounded = workspaceStorage().getItem(WORKSPACE_STORAGE_KEY, defaultWorkspace());
    expect(bounded.tabs).toHaveLength(1);
    expect(bounded.activeTab).toBe(bounded.tabs[0].value);
});

test("does not flush a workspace that needs no tab-ID migration", () => {
    sessionStorage.clear();
    const flush = vi.spyOn(tabStorage, "flush");
    const valid = { ...legacyTab, value: crypto.randomUUID() };
    sessionStorage.setItem(
        WORKSPACE_STORAGE_KEY,
        JSON.stringify({ version: 1, tabs: [valid], activeTab: valid.value }),
    );

    workspaceStorage().getItem(WORKSPACE_STORAGE_KEY, defaultWorkspace());
    expect(flush).not.toHaveBeenCalled();
    flush.mockRestore();
});

test("workspace JSON parsing and legacy-tree scrubbing distinguish malformed values", () => {
    sessionStorage.clear();
    sessionStorage.setItem("valid", JSON.stringify({ ok: true }));
    sessionStorage.setItem("invalid", "{");
    expect(readWorkspaceJson(sessionStorage, "missing")).toBeNull();
    expect(readWorkspaceJson(sessionStorage, "valid")).toEqual({ ok: true });
    expect(readWorkspaceJson(sessionStorage, "invalid")).toBeNull();

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

test("setItem repairs IDs and removeItem removes only its requested envelope", () => {
    sessionStorage.clear();
    const storage = workspaceStorage();
    storage.setItem(WORKSPACE_STORAGE_KEY, {
        version: 1,
        tabs: [legacyTab],
        activeTab: legacyTab.value,
    });
    const stored = readStoredWorkspace() as { tabs: Array<{ value: string }>; activeTab: string };
    expect(stored.tabs[0].value).toMatch(/^[0-9a-f]{8}-/i);
    expect(stored.activeTab).toBe(stored.tabs[0].value);

    storage.removeItem(WORKSPACE_STORAGE_KEY);
    expect(sessionStorage.getItem(WORKSPACE_STORAGE_KEY)).toBeNull();
});
