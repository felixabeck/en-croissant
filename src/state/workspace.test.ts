import { afterEach, expect, test, vi } from "vitest";
import { denyStorageRemoval } from "@/utils/tests/storageMocks";
import { defaultTree } from "@/utils/treeReducer";
import { deserializeStorageValue, serializeStorageValue } from "./store/debouncedStorage";
import { tabStorage } from "./store/tabStorage";
import {
    defaultWorkspace,
    LEGACY_WORKSPACE_VERSION,
    loadWorkspace,
    readStoredWorkspaceValue,
    saveWorkspace,
    sweepOrphanedTreeKeys,
    MAX_PROTECTED_TREE_KEYS,
    MAX_PROTECTED_TREE_KEY_LENGTH,
    MAX_PENDING_TREE_REMOVALS,
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

function storeUnownedDirtyTree() {
    const treeId = crypto.randomUUID();
    const tree = defaultTree();
    tree.dirty = true;
    tree.headers.event = "Recoverable edits";
    const storedTree = serializeStorageValue({ version: 1, state: tree });
    sessionStorage.setItem(treeId, storedTree);
    return { treeId, storedTree };
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
    expect(workspace).not.toHaveProperty("treeOwnershipUncertain");
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

test("a denied corrupt legacy-tree removal does not abort workspace loading", () => {
    sessionStorage.clear();
    sessionStorage.setItem("tabs", serializeStorageValue([legacyTab]));
    sessionStorage.setItem("activeTab", serializeStorageValue(legacyTab.value));
    sessionStorage.setItem(legacyTab.value, "{broken");
    const deny = denyStorageRemoval(legacyTab.value);

    const workspace = loadStoredWorkspace();

    deny.mockRestore();
    expect(workspace.tabs).toHaveLength(1);
    expect(workspace.tabs[0]!.value).not.toBe(legacyTab.value);
    expect(sessionStorage.getItem(legacyTab.value)).toBe("{broken");
    expect(persistError.reportPersistError).toHaveBeenCalled();
});

test("keeps the active tab selected when its legacy ID is migrated", () => {
    sessionStorage.clear();
    const first = { ...legacyTab, value: crypto.randomUUID() };
    const second = { ...legacyTab, name: "Active", value: "old-active" };
    sessionStorage.setItem(
        WORKSPACE_STORAGE_KEY,
        serializeStorageValue({ version: 0, tabs: [first, second], activeTab: second.value }),
    );
    sessionStorage.setItem(
        second.value,
        serializeStorageValue({ version: 0, state: defaultTree() }),
    );

    const workspace = loadStoredWorkspace();

    expect(workspace.tabs[0]).toEqual(first);
    expect(workspace.tabs[1]!.value).not.toBe(second.value);
    expect(workspace.activeTab).toBe(workspace.tabs[1]!.value);
});

test("sweeps valid orphan trees during the first successful legacy migration", () => {
    sessionStorage.clear();
    sessionStorage.setItem("tabs", JSON.stringify([legacyTab]));
    sessionStorage.setItem("activeTab", JSON.stringify(legacyTab.value));
    sessionStorage.setItem(
        legacyTab.value,
        serializeStorageValue({ version: 0, state: defaultTree() }),
    );
    const orphanTreeKey = "unowned-legacy-tree";
    const unrelatedKey = "app-preference";
    sessionStorage.setItem(
        orphanTreeKey,
        serializeStorageValue({ version: 1, state: defaultTree() }),
    );
    sessionStorage.setItem(unrelatedKey, "keep this value");

    const workspace = loadStoredWorkspace();

    expect(workspace.tabs[0]!.value).not.toBe(legacyTab.value);
    expect(sessionStorage.getItem(legacyTab.value)).toBeNull();
    expect(sessionStorage.getItem(orphanTreeKey)).toBeNull();
    expect(sessionStorage.getItem(unrelatedKey)).toBe("keep this value");
    expect(sessionStorage.getItem(workspace.tabs[0]!.value)).not.toBeNull();
});

test("a failed removal of a legacy non-UUID tree does not abort startup and retries", () => {
    sessionStorage.clear();
    sessionStorage.setItem("tabs", JSON.stringify([legacyTab]));
    sessionStorage.setItem("activeTab", JSON.stringify(legacyTab.value));
    sessionStorage.setItem(
        legacyTab.value,
        serializeStorageValue({ version: 0, state: defaultTree() }),
    );
    const refused = denyStorageRemoval(legacyTab.value);

    let migrated: ReturnType<typeof loadStoredWorkspace> | undefined;
    expect(() => {
        migrated = loadStoredWorkspace();
    }).not.toThrow();
    expect(migrated?.tabs[0]!.value).not.toBe(legacyTab.value);
    expect(sessionStorage.getItem(legacyTab.value)).not.toBeNull();
    expect(persistError.reportPersistError).toHaveBeenCalledOnce();
    refused.mockRestore();

    loadStoredWorkspace();

    expect(sessionStorage.getItem(legacyTab.value)).toBeNull();
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

test("reclaims an orphaned durable tree while retaining tabs and unrelated UUID keys", () => {
    sessionStorage.clear();
    const retained = { ...legacyTab, value: crypto.randomUUID() };
    const orphan = crypto.randomUUID();
    const unrelated = crypto.randomUUID();
    const tree = serializeStorageValue({ version: 1, state: defaultTree() });
    const workspace = { version: 1, tabs: [retained], activeTab: retained.value };
    sessionStorage.setItem(WORKSPACE_STORAGE_KEY, serializeStorageValue(workspace));
    sessionStorage.setItem(retained.value, tree);
    sessionStorage.setItem(orphan, tree);
    sessionStorage.setItem(unrelated, serializeStorageValue({ other: true }));

    expect(loadStoredWorkspace()).toEqual(workspace);
    expect(sessionStorage.getItem(orphan)).toBeNull();
    expect(sessionStorage.getItem(retained.value)).toBe(tree);
    expect(sessionStorage.getItem(unrelated)).not.toBeNull();
});

test("a stale refused-admission marker never deletes a retained tab tree", () => {
    sessionStorage.clear();
    const retained = { ...legacyTab, value: crypto.randomUUID() };
    const tree = serializeStorageValue({ version: 1, state: defaultTree() });
    const marker = `chessfable:failed-tab-admission:${retained.value}`;
    sessionStorage.setItem(
        WORKSPACE_STORAGE_KEY,
        serializeStorageValue({ version: 1, tabs: [retained], activeTab: retained.value }),
    );
    sessionStorage.setItem(retained.value, tree);
    sessionStorage.setItem(marker, "1");

    expect(loadStoredWorkspace().tabs).toEqual([retained]);
    expect(sessionStorage.getItem(retained.value)).toBe(tree);
    expect(sessionStorage.getItem(marker)).toBeNull();
});

test("a refused-admission marker cannot delete a non-tree session value", () => {
    sessionStorage.clear();
    const retained = { ...legacyTab, value: crypto.randomUUID() };
    const unrelatedId = crypto.randomUUID();
    const marker = `chessfable:failed-tab-admission:${unrelatedId}`;
    sessionStorage.setItem(
        WORKSPACE_STORAGE_KEY,
        serializeStorageValue({ version: 1, tabs: [retained], activeTab: retained.value }),
    );
    sessionStorage.setItem(unrelatedId, "keep me");
    sessionStorage.setItem(marker, "1");

    loadStoredWorkspace();

    expect(sessionStorage.getItem(unrelatedId)).toBe("keep me");
    expect(sessionStorage.getItem(marker)).toBeNull();
});

test("one refused marker cleanup failure does not block later markers", () => {
    sessionStorage.clear();
    const retained = { ...legacyTab, value: crypto.randomUUID() };
    const firstMarker = `chessfable:failed-tab-admission:${crypto.randomUUID()}`;
    const secondMarker = `chessfable:failed-tab-admission:${crypto.randomUUID()}`;
    sessionStorage.setItem(
        WORKSPACE_STORAGE_KEY,
        serializeStorageValue({ version: 1, tabs: [retained], activeTab: retained.value }),
    );
    sessionStorage.setItem(firstMarker, "1");
    sessionStorage.setItem(secondMarker, "1");
    const deny = denyStorageRemoval(firstMarker);

    loadStoredWorkspace();

    deny.mockRestore();
    expect(sessionStorage.getItem(firstMarker)).toBe("1");
    expect(sessionStorage.getItem(secondMarker)).toBeNull();
    expect(persistError.reportPersistError).toHaveBeenCalledOnce();
});

test("malformed refused-admission markers are removed without touching session values", () => {
    sessionStorage.clear();
    const retained = { ...legacyTab, value: crypto.randomUUID() };
    const unrelatedId = crypto.randomUUID();
    const badIdMarker = "chessfable:failed-tab-admission:not-a-uuid";
    const badValueMarker = `chessfable:failed-tab-admission:${unrelatedId}`;
    sessionStorage.setItem(
        WORKSPACE_STORAGE_KEY,
        serializeStorageValue({ version: 1, tabs: [retained], activeTab: retained.value }),
    );
    sessionStorage.setItem(unrelatedId, "keep me");
    sessionStorage.setItem(badIdMarker, "1");
    sessionStorage.setItem(badValueMarker, "unexpected");

    loadStoredWorkspace();

    expect(sessionStorage.getItem(unrelatedId)).toBe("keep me");
    expect(sessionStorage.getItem(badIdMarker)).toBeNull();
    expect(sessionStorage.getItem(badValueMarker)).toBeNull();
});

test("retries orphan cleanup on the next load after storage refuses removal", () => {
    sessionStorage.clear();
    const retained = { ...legacyTab, value: crypto.randomUUID() };
    const orphan = crypto.randomUUID();
    const workspace = { version: 1, tabs: [retained], activeTab: retained.value };
    sessionStorage.setItem(WORKSPACE_STORAGE_KEY, serializeStorageValue(workspace));
    sessionStorage.setItem(orphan, serializeStorageValue({ version: 1, state: defaultTree() }));
    const refused = denyStorageRemoval(orphan);

    expect(loadStoredWorkspace()).toEqual(workspace);
    expect(sessionStorage.getItem(orphan)).not.toBeNull();
    expect(persistError.reportPersistError).toHaveBeenCalledOnce();
    refused.mockRestore();

    expect(loadStoredWorkspace()).toEqual(workspace);
    expect(sessionStorage.getItem(orphan)).toBeNull();
});

test("preserves valid tree keys through repair, a second load, and a subsequent save", () => {
    sessionStorage.clear();
    const treeId = crypto.randomUUID();
    const tree = serializeStorageValue({ version: 1, state: defaultTree() });
    sessionStorage.setItem(WORKSPACE_STORAGE_KEY, "{broken");
    sessionStorage.setItem(treeId, tree);

    const repaired = loadStoredWorkspace();
    expect(repaired.treeOwnershipUncertain).toBe(true);
    expect(sessionStorage.getItem(treeId)).toBe(tree);

    const secondLoad = loadStoredWorkspace();
    expect(secondLoad.treeOwnershipUncertain).toBe(true);
    expect(sessionStorage.getItem(treeId)).toBe(tree);

    const saved = saveWorkspace(sessionStorage, WORKSPACE_STORAGE_KEY, {
        ...secondLoad,
        activeTab: secondLoad.tabs[0]!.value,
    });
    expect(saved?.treeOwnershipUncertain).toBe(true);
    expect(loadStoredWorkspace().treeOwnershipUncertain).toBe(true);

    expect(sessionStorage.getItem(treeId)).toBe(tree);
});

test("preserves a protected old tree and reclaims a later orphan", () => {
    sessionStorage.clear();
    const retained = { ...legacyTab, value: crypto.randomUUID() };
    sessionStorage.setItem(
        WORKSPACE_STORAGE_KEY,
        serializeStorageValue({
            version: 1,
            tabs: [retained],
            activeTab: retained.value,
            treeOwnershipUncertain: true,
        }),
    );
    const { treeId, storedTree } = storeUnownedDirtyTree();

    const firstLoad = loadStoredWorkspace();
    expect(firstLoad.treeOwnershipUncertain).toBe(true);
    expect(firstLoad.treeOwnershipProtectedIds).toContain(treeId);

    const laterOrphanId = crypto.randomUUID();
    const laterOrphan = serializeStorageValue({ version: 1, state: defaultTree() });
    sessionStorage.setItem(laterOrphanId, laterOrphan);

    const secondLoad = loadStoredWorkspace();

    expect(secondLoad.treeOwnershipUncertain).toBe(true);
    expect(secondLoad.treeOwnershipProtectedIds).toContain(treeId);
    expect(sessionStorage.getItem(treeId)).toBe(storedTree);
    expect(sessionStorage.getItem(laterOrphanId)).toBeNull();
});

test("persists an ownership snapshot after an envelope repair write fails", () => {
    sessionStorage.clear();
    sessionStorage.setItem(WORKSPACE_STORAGE_KEY, "{broken");
    const { treeId, storedTree } = storeUnownedDirtyTree();
    const writeError = new DOMException("denied", "SecurityError");
    const originalSetItem = Storage.prototype.setItem;
    const setItem = vi
        .spyOn(Storage.prototype, "setItem")
        .mockImplementationOnce(function (this: Storage, key, value) {
            if (key === WORKSPACE_STORAGE_KEY) throw writeError;
            return originalSetItem.call(this, key, value);
        });

    const repaired = loadStoredWorkspace();

    setItem.mockRestore();
    expect(repaired.treeOwnershipUncertain).toBe(true);
    expect(repaired.treeOwnershipProtectedIds).toContain(treeId);
    expect(saveWorkspace(sessionStorage, WORKSPACE_STORAGE_KEY, repaired)).toMatchObject({
        treeOwnershipUncertain: true,
        treeOwnershipProtectedIds: [treeId],
    });

    const reloaded = loadStoredWorkspace();
    expect(reloaded.treeOwnershipUncertain).toBe(true);
    expect(reloaded.treeOwnershipProtectedIds).toContain(treeId);
    expect(sessionStorage.getItem(treeId)).toBe(storedTree);
    expect(persistError.reportPersistError).toHaveBeenCalledWith(writeError);
});

test("preserves unowned stored trees across loads when the workspace key is absent", () => {
    sessionStorage.clear();
    const { treeId } = storeUnownedDirtyTree();

    const firstLoad = loadStoredWorkspace();
    expect(firstLoad.treeOwnershipUncertain).toBe(true);
    expect(readStoredWorkspace()).toMatchObject({ treeOwnershipUncertain: true });
    expect(tabStorage.read(treeId)?.state).toMatchObject({
        dirty: true,
        headers: { event: "Recoverable edits" },
    });
    const recoveredTree = sessionStorage.getItem(treeId);
    expect(recoveredTree).not.toBeNull();

    const secondLoad = loadStoredWorkspace();
    expect(secondLoad.treeOwnershipUncertain).toBe(true);
    expect(sessionStorage.getItem(treeId)).toBe(recoveredTree);
});

test("preserves unowned stored trees across loads for a parseable unsupported version", () => {
    sessionStorage.clear();
    const { treeId, storedTree } = storeUnownedDirtyTree();
    sessionStorage.setItem(
        WORKSPACE_STORAGE_KEY,
        serializeStorageValue({ version: 2, tabs: [], activeTab: null }),
    );
    expect(readStoredWorkspaceValue(sessionStorage, WORKSPACE_STORAGE_KEY)).toEqual({
        version: 2,
        tabs: [],
        activeTab: null,
    });

    const firstLoad = loadStoredWorkspace();
    expect(firstLoad.treeOwnershipUncertain).toBe(true);
    expect(readStoredWorkspace()).toMatchObject({ treeOwnershipUncertain: true });
    expect(sessionStorage.getItem(treeId)).toBe(storedTree);

    const secondLoad = loadStoredWorkspace();
    expect(secondLoad.treeOwnershipUncertain).toBe(true);
    expect(sessionStorage.getItem(treeId)).toBe(storedTree);
});

test("leaves a genuinely empty first workspace load without an ownership marker", () => {
    sessionStorage.clear();

    const workspace = loadStoredWorkspace();

    expect(workspace).not.toHaveProperty("treeOwnershipUncertain");
    expect(readStoredWorkspace()).not.toHaveProperty("treeOwnershipUncertain");
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

test("returns the durable workspace when a legacy-key removal fails and retries later", () => {
    sessionStorage.clear();
    const valid = { ...legacyTab, value: crypto.randomUUID() };
    sessionStorage.setItem("tabs", JSON.stringify([valid]));
    sessionStorage.setItem("activeTab", JSON.stringify(valid.value));
    const deny = denyStorageRemoval("tabs");

    const workspace = loadStoredWorkspace();

    expect(workspace.tabs).toEqual([valid]);
    expect(readStoredWorkspace()).toEqual(workspace);
    expect(sessionStorage.getItem("tabs")).not.toBeNull();
    expect(sessionStorage.getItem("activeTab")).toBeNull();
    expect(persistError.reportPersistError).toHaveBeenCalledOnce();
    deny.mockRestore();
    expect(loadStoredWorkspace()).toEqual(workspace);
    expect(sessionStorage.getItem("tabs")).toBeNull();
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

test("salvages valid version-0 tabs while retaining a dirty tree from a malformed row", () => {
    sessionStorage.clear();
    const validTab = { ...legacyTab, value: crypto.randomUUID() };
    const dirtyTree = defaultTree();
    dirtyTree.dirty = true;
    dirtyTree.headers.event = "Recoverable edits";
    const storedTree = serializeStorageValue({ version: 0, state: dirtyTree });
    sessionStorage.setItem(
        WORKSPACE_STORAGE_KEY,
        serializeStorageValue({
            version: LEGACY_WORKSPACE_VERSION,
            tabs: [validTab, { value: "orphan-tree", name: 42 }],
            activeTab: "orphan-tree",
        }),
    );
    sessionStorage.setItem("orphan-tree", storedTree);

    const workspace = loadStoredWorkspace();

    expect(workspace.tabs).toEqual([validTab]);
    expect(workspace.activeTab).toBe(validTab.value);
    expect(workspace.treeOwnershipUncertain).toBe(true);
    expect(workspace.treeOwnershipProtectedIds).toContain("orphan-tree");
    expect(tabStorage.read("orphan-tree")?.state).toMatchObject({
        dirty: true,
        headers: { event: "Recoverable edits" },
    });
    expect(sessionStorage.getItem("orphan-tree")).not.toBeNull();
    expect(readStoredWorkspace()).toEqual(workspace);
});

test("treats a fully valid version-0 envelope as authority for orphan cleanup", () => {
    sessionStorage.clear();
    const validTab = { ...legacyTab, value: crypto.randomUUID() };
    const { treeId } = storeUnownedDirtyTree();
    sessionStorage.setItem(
        WORKSPACE_STORAGE_KEY,
        serializeStorageValue({
            version: LEGACY_WORKSPACE_VERSION,
            tabs: [validTab],
            activeTab: validTab.value,
        }),
    );

    const workspace = loadStoredWorkspace();

    expect(workspace.tabs).toEqual([validTab]);
    expect(workspace).not.toHaveProperty("treeOwnershipUncertain");
    expect(sessionStorage.getItem(treeId)).toBeNull();
});

test("reclaims a migrated source tree after its copy and uncertain envelope are durable", () => {
    sessionStorage.clear();
    sessionStorage.setItem(WORKSPACE_STORAGE_KEY, "{broken");
    sessionStorage.setItem("tabs", serializeStorageValue([legacyTab]));
    sessionStorage.setItem("activeTab", serializeStorageValue(legacyTab.value));
    const sourceTree = serializeStorageValue({ version: 0, state: defaultTree() });
    sessionStorage.setItem(legacyTab.value, sourceTree);
    const { treeId: recoverableId, storedTree: recoverableTree } = storeUnownedDirtyTree();

    const workspace = loadStoredWorkspace();

    expect(workspace.treeOwnershipUncertain).toBe(true);
    expect(workspace.tabs[0]!.value).not.toBe(legacyTab.value);
    expect(tabStorage.read(workspace.tabs[0]!.value)).not.toBeNull();
    expect(sessionStorage.getItem(legacyTab.value)).toBeNull();
    expect(workspace.treeOwnershipProtectedIds).not.toContain(legacyTab.value);
    expect(workspace.treeOwnershipProtectedIds).toContain(recoverableId);
    expect(sessionStorage.getItem(recoverableId)).toBe(recoverableTree);
});

test("retries a failed migrated-source removal even when the ownership snapshot overflows", () => {
    sessionStorage.clear();
    sessionStorage.setItem(WORKSPACE_STORAGE_KEY, "{broken");
    sessionStorage.setItem("tabs", serializeStorageValue([legacyTab]));
    sessionStorage.setItem("activeTab", serializeStorageValue(legacyTab.value));
    const tree = serializeStorageValue({ version: 1, state: defaultTree() });
    sessionStorage.setItem(legacyTab.value, tree);
    for (let index = 0; index < MAX_PROTECTED_TREE_KEYS; index++) {
        sessionStorage.setItem(`other-tree-${index}`, tree);
    }
    const deny = denyStorageRemoval(legacyTab.value);

    const first = loadStoredWorkspace();

    expect(first.treeOwnershipUncertain).toBe(true);
    expect(first).not.toHaveProperty("treeOwnershipProtectedIds");
    expect(first.treeOwnershipPendingRemovalIds).toContain(legacyTab.value);
    expect(sessionStorage.getItem(legacyTab.value)).not.toBeNull();
    deny.mockRestore();

    const second = loadStoredWorkspace();
    expect(sessionStorage.getItem(legacyTab.value)).toBeNull();
    expect(second.treeOwnershipPendingRemovalIds).toContain(legacyTab.value);
    expect(loadStoredWorkspace()).not.toHaveProperty("treeOwnershipPendingRemovalIds");
});

test("does not persist an over-capacity retry list during legacy ID migration", () => {
    sessionStorage.clear();
    const tree = serializeStorageValue({ version: 1, state: defaultTree() });
    const pendingIds = Array.from(
        { length: MAX_PENDING_TREE_REMOVALS },
        (_, index) => `pending-tree-${index}`,
    );
    for (const id of pendingIds) sessionStorage.setItem(id, tree);
    sessionStorage.setItem(legacyTab.value, tree);
    const originalEnvelope = serializeStorageValue({
        version: 1,
        tabs: [legacyTab],
        activeTab: legacyTab.value,
        treeOwnershipPendingRemovalIds: pendingIds,
    });
    sessionStorage.setItem(WORKSPACE_STORAGE_KEY, originalEnvelope);
    const deny = denyStorageRemoval((id) => id.startsWith("pending-tree-"));

    const first = loadStoredWorkspace();

    expect(first.tabs[0]!.value).toBe(legacyTab.value);
    expect(first.treeOwnershipPendingRemovalIds).toEqual(pendingIds);
    expect(sessionStorage.getItem(WORKSPACE_STORAGE_KEY)).toBe(originalEnvelope);
    expect(persistError.reportPersistError).toHaveBeenCalled();
    deny.mockRestore();

    const repaired = loadStoredWorkspace();
    expect(repaired.tabs[0]!.value).not.toBe(legacyTab.value);
    expect(sessionStorage.getItem(pendingIds[0]!)).toBeNull();
    expect(loadStoredWorkspace().treeOwnershipPendingRemovalIds).toBeUndefined();
});

test("does not delete a non-tree session value named by a persisted retry", () => {
    sessionStorage.clear();
    const validTab = { ...legacyTab, value: crypto.randomUUID() };
    sessionStorage.setItem("other-session-value", "keep me");
    sessionStorage.setItem(
        WORKSPACE_STORAGE_KEY,
        serializeStorageValue({
            version: 1,
            tabs: [validTab],
            activeTab: validTab.value,
            treeOwnershipPendingRemovalIds: ["other-session-value"],
        }),
    );

    const workspace = loadStoredWorkspace();

    expect(sessionStorage.getItem("other-session-value")).toBe("keep me");
    expect(workspace).not.toHaveProperty("treeOwnershipPendingRemovalIds");
});

test("fails closed when the protected tree snapshot exceeds its documented bound", () => {
    sessionStorage.clear();
    sessionStorage.setItem(WORKSPACE_STORAGE_KEY, "{broken");
    const tree = serializeStorageValue({ version: 1, state: defaultTree() });
    const treeIds = Array.from(
        { length: MAX_PROTECTED_TREE_KEYS + 1 },
        (_, index) => `tree-${index}`,
    );
    for (const treeId of treeIds) sessionStorage.setItem(treeId, tree);

    const workspace = loadStoredWorkspace();

    expect(workspace.treeOwnershipUncertain).toBe(true);
    expect(workspace).not.toHaveProperty("treeOwnershipProtectedIds");
    expect(sessionStorage.getItem(treeIds[0]!)).toBe(tree);
    expect(sessionStorage.getItem(treeIds.at(-1)!)).toBe(tree);
    expect(readStoredWorkspace()).toMatchObject({ treeOwnershipUncertain: true });
    expect(loadStoredWorkspace().treeOwnershipUncertain).toBe(true);
    expect(sessionStorage.getItem(treeIds[0]!)).toBe(tree);
});

test("fails closed when a protected tree key exceeds the length bound", () => {
    sessionStorage.clear();
    sessionStorage.setItem(WORKSPACE_STORAGE_KEY, "{broken");
    const longId = "x".repeat(MAX_PROTECTED_TREE_KEY_LENGTH + 1);
    const tree = serializeStorageValue({ version: 1, state: defaultTree() });
    sessionStorage.setItem(longId, tree);

    const workspace = loadStoredWorkspace();

    expect(workspace.treeOwnershipUncertain).toBe(true);
    expect(workspace).not.toHaveProperty("treeOwnershipProtectedIds");
    expect(sessionStorage.getItem(longId)).toBe(tree);
    expect(readStoredWorkspace()).toMatchObject({ treeOwnershipUncertain: true });
    expect(loadStoredWorkspace().treeOwnershipUncertain).toBe(true);
    expect(sessionStorage.getItem(longId)).toBe(tree);
});

test("fails closed when stored tree enumeration throws", () => {
    sessionStorage.clear();
    sessionStorage.setItem(WORKSPACE_STORAGE_KEY, "{broken");
    const { treeId, storedTree } = storeUnownedDirtyTree();
    const scanError = new DOMException("denied", "SecurityError");
    const key = vi.spyOn(Storage.prototype, "key").mockImplementation(() => {
        throw scanError;
    });

    const workspace = loadStoredWorkspace();

    key.mockRestore();
    expect(workspace.treeOwnershipUncertain).toBe(true);
    expect(workspace).not.toHaveProperty("treeOwnershipProtectedIds");
    expect(sessionStorage.getItem(treeId)).toBe(storedTree);
    expect(persistError.reportPersistError).toHaveBeenCalledWith(scanError);
    expect(readStoredWorkspace()).toMatchObject({ treeOwnershipUncertain: true });
    expect(loadStoredWorkspace().treeOwnershipUncertain).toBe(true);
    expect(sessionStorage.getItem(treeId)).toBe(storedTree);
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

test("workspace JSON parsing and orphan-tree sweeping distinguish malformed values", () => {
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
    sessionStorage.setItem(orphan, serializeStorageValue({ version: 0, state: defaultTree() }));
    const unrelated = "not-a-tree";
    sessionStorage.setItem(unrelated, "orphan");
    sessionStorage.setItem(String(nonStringValue), "must-remain");
    sweepOrphanedTreeKeys([retained]);
    expect(sessionStorage.getItem(retained.value)).toBe("retained");
    expect(sessionStorage.getItem(orphan)).toBeNull();
    expect(sessionStorage.getItem(unrelated)).toBe("orphan");
    expect(sessionStorage.getItem(String(nonStringValue))).toBe("must-remain");
});

test("a stored-key enumeration failure does not abort authoritative workspace loading", () => {
    sessionStorage.clear();
    const retained = { ...legacyTab, value: crypto.randomUUID() };
    sessionStorage.setItem(
        WORKSPACE_STORAGE_KEY,
        serializeStorageValue({ version: 1, tabs: [retained], activeTab: retained.value }),
    );
    const { treeId, storedTree } = storeUnownedDirtyTree();
    const scanError = new DOMException("denied", "SecurityError");
    const key = vi.spyOn(Storage.prototype, "key").mockImplementation(() => {
        throw scanError;
    });

    expect(loadStoredWorkspace().tabs).toEqual([retained]);

    key.mockRestore();
    expect(sessionStorage.getItem(treeId)).toBe(storedTree);
    expect(persistError.reportPersistError).toHaveBeenCalledWith(scanError);
});

test("orphan sweeping continues after a denied removal and reports once", () => {
    sessionStorage.clear();
    const tree = serializeStorageValue({ version: 1, state: defaultTree() });
    sessionStorage.setItem("orphan-one", tree);
    sessionStorage.setItem("orphan-two", tree);
    const remove = denyStorageRemoval("orphan-one");

    sweepOrphanedTreeKeys([]);

    remove.mockRestore();
    expect(sessionStorage.getItem("orphan-one")).toBe(tree);
    expect(sessionStorage.getItem("orphan-two")).toBeNull();
    expect(persistError.reportPersistError).toHaveBeenCalledOnce();
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

test("reports clone persistence while a failed rollback removal leaves startup running", () => {
    sessionStorage.clear();
    sessionStorage.setItem("tabs", serializeStorageValue([legacyTab]));
    sessionStorage.setItem("activeTab", serializeStorageValue(legacyTab.value));
    sessionStorage.setItem(
        legacyTab.value,
        serializeStorageValue({ version: 0, state: defaultTree() }),
    );
    const cloneWriteError = new DOMException("quota", "QuotaExceededError");
    const stagedCloneIds: string[] = [];
    const originalSetItem = Storage.prototype.setItem;
    const setItem = vi
        .spyOn(Storage.prototype, "setItem")
        .mockImplementation(function (this: Storage, key, value) {
            if (key !== legacyTab.value && key !== "tabs" && key !== "activeTab") {
                stagedCloneIds.push(key);
                throw cloneWriteError;
            }
            return originalSetItem.call(this, key, value);
        });
    const refused = denyStorageRemoval(() => stagedCloneIds[0] ?? "");

    try {
        expect(() => loadStoredWorkspace()).not.toThrow();
        expect(stagedCloneIds).toHaveLength(1);
        expect(sessionStorage.getItem(WORKSPACE_STORAGE_KEY)).toBeNull();
        expect(persistError.reportPersistError).toHaveBeenCalledWith(
            expect.objectContaining({ cause: cloneWriteError }),
        );
        expect(persistError.reportPersistError).toHaveBeenCalledWith(
            expect.objectContaining({ name: "SecurityError" }),
        );
    } finally {
        refused.mockRestore();
        setItem.mockRestore();
    }
});

test("reports an envelope failure before a denied staged-clone rollback", () => {
    sessionStorage.clear();
    sessionStorage.setItem("tabs", serializeStorageValue([legacyTab]));
    sessionStorage.setItem("activeTab", serializeStorageValue(legacyTab.value));
    sessionStorage.setItem(
        legacyTab.value,
        serializeStorageValue({ version: 0, state: defaultTree() }),
    );
    const envelopeWriteError = new DOMException("quota", "QuotaExceededError");
    const stagedCloneIds: string[] = [];
    const originalSetItem = Storage.prototype.setItem;
    const setItem = vi
        .spyOn(Storage.prototype, "setItem")
        .mockImplementation(function (this: Storage, key, value) {
            if (key === WORKSPACE_STORAGE_KEY) throw envelopeWriteError;
            if (key !== legacyTab.value && key !== "tabs" && key !== "activeTab") {
                stagedCloneIds.push(key);
            }
            return originalSetItem.call(this, key, value);
        });
    const refused = denyStorageRemoval(() => stagedCloneIds[0] ?? "");

    try {
        expect(() => loadStoredWorkspace()).not.toThrow();
        expect(stagedCloneIds).toHaveLength(1);
        expect(sessionStorage.getItem(stagedCloneIds[0]!)).not.toBeNull();
        expect(sessionStorage.getItem(WORKSPACE_STORAGE_KEY)).toBeNull();
        expect(persistError.reportPersistError).toHaveBeenCalledWith(
            expect.objectContaining({ cause: envelopeWriteError }),
        );
        expect(persistError.reportPersistError).toHaveBeenCalledWith(
            expect.objectContaining({ name: "SecurityError" }),
        );
    } finally {
        refused.mockRestore();
        setItem.mockRestore();
    }
});
