import type { SyncStringStorage } from "jotai/vanilla/utils/atomWithStorage";
import { z } from "zod";
import { decodeCompressedOrJson, serializeStorageValue } from "./store/debouncedStorage";
import { persistStorageWriteError, tabStorage } from "./store/tabStorage";
import { reportPersistError } from "./persistError";
import { newWorkspaceId, tabSchema, type Tab } from "./workspaceTypes";

export const WORKSPACE_STORAGE_KEY = "workspace";
const WORKSPACE_VERSION = 1;
export const LEGACY_WORKSPACE_VERSION = 0;
const uuidSchema = z.string().uuid();

/**
 * Ownership snapshots persist at most 1,024 tree keys, each no longer than 128 characters.
 * Larger snapshots fail closed: the uncertainty marker remains and orphan sweeping is skipped.
 */
export const MAX_PROTECTED_TREE_KEYS = 1_024;
export const MAX_PROTECTED_TREE_KEY_LENGTH = 128;
const protectedTreeKeysSchema = z
    .array(z.string().min(1).max(MAX_PROTECTED_TREE_KEY_LENGTH))
    .max(MAX_PROTECTED_TREE_KEYS)
    .optional();

export type Workspace = {
    version: typeof WORKSPACE_VERSION;
    tabs: Tab[];
    activeTab: string | null;
    treeOwnershipUncertain?: true;
    treeOwnershipProtectedIds?: string[];
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
    treeOwnershipProtectedIds: protectedTreeKeysSchema,
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

export function sweepOrphanedTreeKeys(
    retainedTabs: readonly Tab[],
    protectedTreeIds: readonly string[] = [],
    failedSourceRemovals: ReadonlySet<string> = new Set(),
) {
    const retainedIds = new Set([
        ...retainedTabs.map((tab) => tab.value),
        ...protectedTreeIds,
        ...failedSourceRemovals,
    ]);
    tabStorage.removeOrphanedTrees(retainedIds);
}

export function readStoredWorkspaceValue(storage: SyncStringStorage, key: string): unknown | null {
    return decodeCompressedOrJson(storage.getItem(key));
}

function workspaceFromValue(value: unknown): Workspace | null {
    const parsed = workspaceLiveSchema.safeParse(value);
    if (!parsed.success) return null;
    const tabs = parsed.data.tabs;
    const workspace: Workspace = {
        version: WORKSPACE_VERSION,
        tabs,
        activeTab: tabs.length === 0 ? null : resolveActiveTab(tabs, parsed.data.activeTab),
    };
    if (parsed.data.treeOwnershipUncertain) {
        workspace.treeOwnershipUncertain = true;
        if (parsed.data.treeOwnershipProtectedIds !== undefined) {
            workspace.treeOwnershipProtectedIds = parsed.data.treeOwnershipProtectedIds;
        }
    }
    return workspace;
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
    if (version !== undefined && version !== LEGACY_WORKSPACE_VERSION) return false;
    if (!workspaceInputSchema.safeParse(value).success) return false;
    return Array.isArray(value.tabs) && value.tabs.every((tab) => tabSchema.safeParse(tab).success);
}

/** Migrates separate legacy tabs/activeTab keys into one repairable envelope. */
export function loadWorkspace(storage: SyncStringStorage, key: string): Workspace {
    const storedWorkspace = storage.getItem(key);
    const current = readStoredWorkspaceValue(storage, key);
    const currentResult = workspaceLiveSchema.safeParse(current);
    const hasAuthoritativeWorkspace = currentResult.success;
    const persistedProtectedTreeIds =
        currentResult.success && currentResult.data.treeOwnershipUncertain
            ? currentResult.data.treeOwnershipProtectedIds
            : undefined;
    const legacy =
        current ??
        ({
            tabs: readStoredWorkspaceValue(storage, "tabs"),
            activeTab: readStoredWorkspaceValue(storage, "activeTab"),
        } as const);
    const validMigrationSource = isValidLegacyWorkspace(
        storedWorkspace === null ? legacy : current,
    );
    const legacyStoragePresent =
        storage.getItem("tabs") !== null || storage.getItem("activeTab") !== null;
    const treeOwnershipUncertain =
        (isRecord(current) && current.treeOwnershipUncertain === true) ||
        (storedWorkspace !== null && !hasAuthoritativeWorkspace && !validMigrationSource) ||
        (storedWorkspace === null &&
            !validMigrationSource &&
            (legacyStoragePresent || tabStorage.hasStoredTrees()));
    const plan = planWorkspaceRepair(legacy);
    const takingFreshOwnershipSnapshot =
        treeOwnershipUncertain && persistedProtectedTreeIds === undefined;
    if (treeOwnershipUncertain) {
        plan.workspace.treeOwnershipUncertain = true;
        plan.unrepairedWorkspace.treeOwnershipUncertain = true;
        const protectedTreeIds =
            persistedProtectedTreeIds ??
            tabStorage.snapshotStoredTreeKeys(
                MAX_PROTECTED_TREE_KEYS,
                MAX_PROTECTED_TREE_KEY_LENGTH,
            ) ??
            undefined;
        if (protectedTreeIds !== undefined) {
            plan.workspace.treeOwnershipProtectedIds = [...protectedTreeIds];
            plan.unrepairedWorkspace.treeOwnershipProtectedIds = [...protectedTreeIds];
        }
    }
    const stagedCloneIds = plan.cloneTargets.map(({ targetId }) => targetId);
    for (const { sourceId, targetId } of plan.cloneTargets) {
        tabStorage.clone(sourceId, targetId);
    }
    if (stagedCloneIds.length > 0) {
        const failedIds = new Set(tabStorage.flush({ notify: true }));
        if (stagedCloneIds.some((id) => failedIds.has(id))) {
            for (const id of stagedCloneIds) tabStorage.removeTreeSafely(id);
            return plan.unrepairedWorkspace;
        }
    }

    const retainedIds = new Set(plan.workspace.tabs.map((tab) => tab.value));
    const durableMigratedSources = new Set<string>();
    for (const sourceId of new Set(plan.cloneTargets.map(({ sourceId }) => sourceId))) {
        if (retainedIds.has(sourceId)) continue;
        const sourceTargets = plan.cloneTargets.filter((target) => target.sourceId === sourceId);
        if (
            sourceTargets.length > 0 &&
            sourceTargets.every(({ targetId }) => tabStorage.read(targetId))
        ) {
            durableMigratedSources.add(sourceId);
        }
    }
    if (plan.workspace.treeOwnershipProtectedIds) {
        plan.workspace.treeOwnershipProtectedIds = plan.workspace.treeOwnershipProtectedIds.filter(
            (id) => !durableMigratedSources.has(id),
        );
    }

    const payload = serializeStorageValue(plan.workspace);
    const cleanupPending =
        storage.getItem("tabs") !== null || storage.getItem("activeTab") !== null;
    if (storedWorkspace !== payload || cleanupPending) {
        try {
            storage.setItem(key, payload);
        } catch (error) {
            reportPersistError(persistStorageWriteError(error));
            for (const id of stagedCloneIds) tabStorage.removeTreeSafely(id);
            return plan.unrepairedWorkspace;
        }
    }

    const failedSourceRemovals = new Set<string>();
    for (const sourceId of durableMigratedSources) {
        if (!tabStorage.removeTreeSafely(sourceId)) failedSourceRemovals.add(sourceId);
    }

    // A representable fresh snapshot protects every valid tree from before clone staging. Later
    // loads sweep against that durable set; known migrated sources are reclaimed explicitly above.
    if (!treeOwnershipUncertain && (hasAuthoritativeWorkspace || validMigrationSource)) {
        sweepOrphanedTreeKeys(plan.workspace.tabs, [], failedSourceRemovals);
    } else if (treeOwnershipUncertain && !takingFreshOwnershipSnapshot) {
        const protectedTreeIds = plan.workspace.treeOwnershipProtectedIds;
        if (protectedTreeIds !== undefined) {
            sweepOrphanedTreeKeys(plan.workspace.tabs, protectedTreeIds, failedSourceRemovals);
        }
    }
    storage.removeItem("tabs");
    storage.removeItem("activeTab");
    return plan.workspace;
}
