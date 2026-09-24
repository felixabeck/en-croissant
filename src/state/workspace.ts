import type { SyncStringStorage } from "jotai/vanilla/utils/atomWithStorage";
import { z } from "zod";
import { decodeCompressedOrJson, serializeStorageValue } from "./store/debouncedStorage";
import { persistStorageWriteError, tabStorage } from "./store/tabStorage";
import { reportPersistError } from "./persistError";
import { newWorkspaceId, tabSchema, type Tab } from "./workspaceTypes";

export const WORKSPACE_STORAGE_KEY = "workspace";
const WORKSPACE_VERSION = 1;
const uuidSchema = z.string().uuid();

export type Workspace = {
    version: typeof WORKSPACE_VERSION;
    tabs: Tab[];
    activeTab: string | null;
    treeOwnershipUncertain?: true;
};

export const MAX_WORKSPACE_TABS = 100;
const workspaceInputSchema = z.object({
    version: z.number().int().nonnegative().optional().catch(undefined),
    // Scrub individual legacy/corrupt tabs while keeping every independently
    // valid tab recoverable. A corrupt entry must not erase its neighbours.
    tabs: z
        .array(tabSchema.nullable().catch(null))
        .max(MAX_WORKSPACE_TABS)
        .transform((tabs) => tabs.filter((tab): tab is Tab => tab !== null)),
    activeTab: z.string().max(128).nullable().catch(null),
});
const liveTabsSchema = z.array(tabSchema).max(MAX_WORKSPACE_TABS);
const workspaceLiveSchema = z.object({
    version: z.literal(WORKSPACE_VERSION),
    tabs: liveTabsSchema,
    activeTab: z.string().max(128).nullable(),
    treeOwnershipUncertain: z.literal(true).optional(),
});

function newTab(used: Iterable<string>): Tab {
    return {
        name: "Tab.NewTab",
        value: newWorkspaceId(used),
        type: "new",
        gameOrigin: { kind: "none" },
    };
}

export function defaultWorkspace(): Workspace {
    const first = newTab(new Set());
    return { version: WORKSPACE_VERSION, tabs: [first], activeTab: first.value };
}

type WorkspaceRepairPlan = {
    workspace: Workspace;
    unrepairedWorkspace: Workspace;
    cloneTargets: Array<{ sourceId: string; targetId: string }>;
};

function resolveActiveTab(tabs: readonly Tab[], legacyActive: string | null): string {
    return tabs.some((tab) => tab.value === legacyActive) ? legacyActive! : tabs[0]!.value;
}

function planWorkspaceRepair(input: unknown): WorkspaceRepairPlan {
    const inputResult = workspaceInputSchema.safeParse(input);
    if (!inputResult.success) {
        const workspace = defaultWorkspace();
        return {
            workspace,
            unrepairedWorkspace: workspace,
            cloneTargets: [],
        };
    }
    const parsed = inputResult.data;
    const candidates = parsed.tabs;
    const ids = new Set<string>();
    const cloneTargets: WorkspaceRepairPlan["cloneTargets"] = [];
    const tabs = candidates.map((tab) => {
        if (uuidSchema.safeParse(tab.value).success && !ids.has(tab.value)) {
            ids.add(tab.value);
            return tab;
        }

        const migratedId = newWorkspaceId(ids);
        cloneTargets.push({ sourceId: tab.value, targetId: migratedId });
        ids.add(migratedId);
        return { ...tab, value: migratedId };
    });

    if (tabs.length === 0) tabs.push(newTab(ids));
    const legacyActive = parsed.activeTab;
    const activeTab = resolveActiveTab(tabs, legacyActive);
    const unrepairedTabs = candidates.length > 0 ? candidates : tabs;
    const unrepairedActiveTab = resolveActiveTab(unrepairedTabs, legacyActive);
    return {
        workspace: { version: WORKSPACE_VERSION, tabs, activeTab },
        unrepairedWorkspace: {
            version: WORKSPACE_VERSION,
            tabs: unrepairedTabs,
            activeTab: unrepairedActiveTab,
        },
        cloneTargets,
    };
}

export function scrubInvalidLegacyTreeKeys(input: unknown, retainedTabs: readonly Tab[]) {
    if (!isRecord(input) || !Array.isArray(input.tabs)) return;
    // Let the shared sweep validate stored trees before removing anything. The
    // legacy metadata alone is not evidence that a storage key contains a tree.
    tabStorage.removeOrphanedTrees(new Set(retainedTabs.map((tab) => tab.value)));
}

export function readStoredWorkspaceValue(storage: SyncStringStorage, key: string): unknown | null {
    return decodeCompressedOrJson(storage.getItem(key));
}

function workspaceFromValue(value: unknown): Workspace | null {
    const parsed = workspaceLiveSchema.safeParse(value);
    if (!parsed.success) return null;
    const tabs = parsed.data.tabs;
    if (tabs.length === 0) {
        return {
            version: WORKSPACE_VERSION,
            tabs: [],
            activeTab: null,
            ...(parsed.data.treeOwnershipUncertain ? { treeOwnershipUncertain: true } : {}),
        };
    }
    const legacyActive = parsed.data.activeTab;
    const activeTab = resolveActiveTab(tabs, legacyActive);
    return {
        version: WORKSPACE_VERSION,
        tabs,
        activeTab,
        ...(parsed.data.treeOwnershipUncertain ? { treeOwnershipUncertain: true } : {}),
    };
}

/** Saves and returns the exact canonical workspace acknowledged by synchronous storage. */
export function saveWorkspace(
    storage: SyncStringStorage,
    key: string,
    value: unknown,
): Workspace | null {
    const workspace = workspaceFromValue(value);
    if (!workspace) {
        reportPersistError(persistStorageWriteError({}));
        return null;
    }
    try {
        storage.setItem(key, serializeStorageValue(workspace));
        return workspace;
    } catch (error) {
        reportPersistError(persistStorageWriteError(error));
        return null;
    }
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isValidLegacyWorkspace(value: unknown): boolean {
    if (!isRecord(value)) return false;
    const version = value.version;
    if (version !== undefined && version !== 0) return false;
    return workspaceInputSchema.safeParse(value).success;
}

function hasUncertainTreeOwnership(value: unknown): boolean {
    return isRecord(value) && value.treeOwnershipUncertain === true;
}

/** Migrates separate legacy tabs/activeTab keys into one repairable envelope. */
export function loadWorkspace(storage: SyncStringStorage, key: string): Workspace {
    const storedWorkspace = storage.getItem(key);
    const current = readStoredWorkspaceValue(storage, key);
    const hasAuthoritativeWorkspace = workspaceLiveSchema.safeParse(current).success;
    const legacy =
        current ??
        ({
            tabs: readStoredWorkspaceValue(storage, "tabs"),
            activeTab: readStoredWorkspaceValue(storage, "activeTab"),
        } as const);
    const validMigrationSource = isValidLegacyWorkspace(
        storedWorkspace === null ? legacy : current,
    );
    const treeOwnershipUncertain =
        hasUncertainTreeOwnership(current) ||
        (storedWorkspace !== null && !hasAuthoritativeWorkspace && !validMigrationSource);
    const plan = planWorkspaceRepair(legacy);
    if (treeOwnershipUncertain) {
        plan.workspace.treeOwnershipUncertain = true;
        plan.unrepairedWorkspace.treeOwnershipUncertain = true;
    }
    const stagedCloneIds = plan.cloneTargets.map(({ targetId }) => targetId);
    for (const { sourceId, targetId } of plan.cloneTargets) {
        tabStorage.clone(sourceId, targetId);
    }
    if (stagedCloneIds.length > 0) {
        const failedIds = new Set(tabStorage.flush({ notify: true }));
        if (stagedCloneIds.some((id) => failedIds.has(id))) {
            for (const id of stagedCloneIds) tabStorage.remove(id);
            return plan.unrepairedWorkspace;
        }
    }

    const payload = serializeStorageValue(plan.workspace);
    const cleanupPending =
        storage.getItem("tabs") !== null || storage.getItem("activeTab") !== null;
    if (storedWorkspace !== payload || cleanupPending) {
        try {
            storage.setItem(key, payload);
        } catch (error) {
            for (const id of stagedCloneIds) tabStorage.remove(id);
            reportPersistError(persistStorageWriteError(error));
            return plan.unrepairedWorkspace;
        }
    }

    // A damaged persisted envelope cannot establish ownership of otherwise valid
    // tree keys. A sound legacy migration can sweep as soon as its new envelope is durable.
    if (!treeOwnershipUncertain && (hasAuthoritativeWorkspace || validMigrationSource)) {
        scrubInvalidLegacyTreeKeys(legacy, plan.workspace.tabs);
    }
    storage.removeItem("tabs");
    storage.removeItem("activeTab");
    return plan.workspace;
}
