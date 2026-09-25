import type { SyncStringStorage } from "jotai/vanilla/utils/atomWithStorage";
import { z } from "zod";
import i18n from "@/i18n";
import enUSCatalogue from "@/translation/en-US.json";
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
    treeOwnershipPendingRemovalIds?: string[];
};

export const MAX_WORKSPACE_TABS = 100;
export const MAX_PENDING_TREE_REMOVALS = 100;
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
    treeOwnershipPendingRemovalIds: z
        .array(z.string().min(1))
        .max(MAX_PENDING_TREE_REMOVALS)
        .optional(),
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
    const legacyActiveIndex = candidates.findIndex((tab) => tab.value === legacyActive);
    const activeTab = legacyActiveIndex === -1 ? tabs[0]!.value : tabs[legacyActiveIndex]!.value;
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

/** Failed removals remain excluded from this load's sweep so they are not retried twice. */
export function sweepOrphanedTreeKeys(
    retainedTabs: readonly Tab[],
    protectedTreeIds: readonly string[] = [],
    failedKnownRemovals: ReadonlySet<string> = new Set(),
) {
    const retainedIds = new Set([
        ...retainedTabs.map((tab) => tab.value),
        ...protectedTreeIds,
        ...failedKnownRemovals,
    ]);
    tabStorage.removeOrphanedTrees(retainedIds);
}

/** Reconcile durable deletion intents before a workspace write can exceed its schema bound. */
export function reconcilePendingTreeRemovals(
    priorIds: readonly string[],
    newIds: Iterable<string>,
    retainedIds: ReadonlySet<string>,
): { ids: string[]; overflowCount: null } | { ids: null; overflowCount: number } {
    let prior = priorIds.filter((id) => !retainedIds.has(id) && tabStorage.isStoredTree(id));
    const additions = [...newIds].filter((id) => !retainedIds.has(id));
    let pending = new Set([...prior, ...additions]);
    if (pending.size > MAX_PENDING_TREE_REMOVALS) {
        const failedPriorRemovals = tabStorage.removeKnownTreesSafely(prior);
        prior = prior.filter((id) => failedPriorRemovals.has(id));
        pending = new Set([...prior, ...additions]);
    }
    return pending.size <= MAX_PENDING_TREE_REMOVALS
        ? { ids: [...pending], overflowCount: null }
        : { ids: null, overflowCount: pending.size };
}

const workspaceErrorKey = "Common.ConfirmationError.unexpected";

function workspaceActionError(cause: Error): Error {
    // Workspace hydration can report an error before index.tsx initializes i18next.
    return new Error(i18n.t(workspaceErrorKey) || enUSCatalogue.translation[workspaceErrorKey], {
        cause,
    });
}

export function pendingTreeRemovalCapacityError(count: number): Error {
    return workspaceActionError(
        new Error(`Pending tree removals exceeded ${MAX_PENDING_TREE_REMOVALS}: ${count}`),
    );
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
    if (parsed.data.treeOwnershipPendingRemovalIds !== undefined) {
        workspace.treeOwnershipPendingRemovalIds = parsed.data.treeOwnershipPendingRemovalIds;
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
        reportPersistError(
            workspaceActionError(new Error("Workspace failed live schema validation")),
        );
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
    // A direct true fault makes the fresh-module workspace test fail on null metadata.
    // Stryker disable next-line ConditionalExpression: static mutant is not activated.
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
    const persistedPendingRemovals = currentResult.success
        ? (currentResult.data.treeOwnershipPendingRemovalIds ?? [])
        : [];
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
    const plan = planWorkspaceRepair(legacy);
    const repairedRetainedIds = new Set(plan.workspace.tabs.map((tab) => tab.value));
    const failedAdmissions = tabStorage.replayFailedAdmissions(repairedRetainedIds);
    const missingWorkspaceTreeSnapshot =
        storedWorkspace === null && !validMigrationSource
            ? tabStorage.snapshotStoredTreeKeys(
                  MAX_PROTECTED_TREE_KEYS,
                  MAX_PROTECTED_TREE_KEY_LENGTH,
                  failedAdmissions.markedIds,
              )
            : undefined;
    const treeOwnershipUncertain =
        (isRecord(current) && current.treeOwnershipUncertain === true) ||
        (storedWorkspace !== null && !hasAuthoritativeWorkspace && !validMigrationSource) ||
        (storedWorkspace === null &&
            !validMigrationSource &&
            (legacyStoragePresent ||
                missingWorkspaceTreeSnapshot === null ||
                missingWorkspaceTreeSnapshot!.length > 0));
    if (persistedPendingRemovals.length > 0) {
        plan.unrepairedWorkspace.treeOwnershipPendingRemovalIds = [...persistedPendingRemovals];
    }
    const takingFreshOwnershipSnapshot =
        treeOwnershipUncertain && persistedProtectedTreeIds === undefined;
    if (treeOwnershipUncertain) {
        plan.workspace.treeOwnershipUncertain = true;
        plan.unrepairedWorkspace.treeOwnershipUncertain = true;
        const protectedTreeIds =
            persistedProtectedTreeIds ??
            (missingWorkspaceTreeSnapshot !== undefined
                ? missingWorkspaceTreeSnapshot
                : tabStorage.snapshotStoredTreeKeys(
                      MAX_PROTECTED_TREE_KEYS,
                      MAX_PROTECTED_TREE_KEY_LENGTH,
                      failedAdmissions.markedIds,
                  )) ??
            undefined;
        if (protectedTreeIds !== undefined) {
            const protectedWithoutFailedAdmissions = protectedTreeIds.filter(
                (id) => !failedAdmissions.markedIds.has(id),
            );
            plan.workspace.treeOwnershipProtectedIds = [...protectedWithoutFailedAdmissions];
            plan.unrepairedWorkspace.treeOwnershipProtectedIds = [
                ...protectedWithoutFailedAdmissions,
            ];
        }
    }
    const stagedCloneIds: string[] = [];
    const cloneKinds = new Map<string, "copied" | "copied-unreadable">();
    for (const { sourceId, targetId } of plan.cloneTargets) {
        const result = tabStorage.clone(sourceId, targetId);
        if (result.kind === "unavailable" || result.kind === "copy-failed") {
            reportPersistError(persistStorageWriteError(result.error));
            tabStorage.removeKnownTreesSafely(stagedCloneIds);
            return plan.unrepairedWorkspace;
        }
        if (result.kind === "unreadable") {
            try {
                tabStorage.copyUnreadableForWorkspaceRepair(targetId, result.rawValue);
            } catch (error) {
                reportPersistError(persistStorageWriteError(error));
                tabStorage.removeKnownTreesSafely(stagedCloneIds);
                return plan.unrepairedWorkspace;
            }
            stagedCloneIds.push(targetId);
            cloneKinds.set(targetId, "copied-unreadable");
            continue;
        }
        if (result.kind === "copied") {
            stagedCloneIds.push(targetId);
            cloneKinds.set(targetId, "copied");
        }
    }
    if (stagedCloneIds.length > 0) {
        const failedIds = new Set(tabStorage.flush({ notify: true }));
        if (stagedCloneIds.some((id) => failedIds.has(id))) {
            tabStorage.removeKnownTreesSafely(stagedCloneIds);
            return plan.unrepairedWorkspace;
        }
    }

    const durableMigratedSources = new Set<string>();
    for (const sourceId of new Set(plan.cloneTargets.map(({ sourceId }) => sourceId))) {
        const sourceTargets = plan.cloneTargets.filter((target) => target.sourceId === sourceId);
        const copiedReadableTargets = sourceTargets.filter(
            ({ targetId }) => cloneKinds.get(targetId) === "copied",
        );
        for (const { targetId } of copiedReadableTargets) {
            const result = tabStorage.readTree(targetId);
            if (result.kind === "available") continue;
            const error =
                result.kind === "unavailable"
                    ? result.error
                    : new Error(`Could not verify the migrated tree at ${targetId}.`);
            reportPersistError(persistStorageWriteError(error));
            tabStorage.removeKnownTreesSafely(stagedCloneIds);
            return plan.unrepairedWorkspace;
        }
        const allTargetsCopied = sourceTargets.every(({ targetId }) => {
            const kind = cloneKinds.get(targetId);
            return kind === "copied" || kind === "copied-unreadable";
        });
        if (allTargetsCopied) {
            durableMigratedSources.add(sourceId);
        }
    }
    const pendingRemovalResult = reconcilePendingTreeRemovals(
        persistedPendingRemovals,
        durableMigratedSources,
        repairedRetainedIds,
    );
    if (pendingRemovalResult.ids === null) {
        reportPersistError(pendingTreeRemovalCapacityError(pendingRemovalResult.overflowCount));
        tabStorage.removeKnownTreesSafely(stagedCloneIds);
        return plan.unrepairedWorkspace;
    }
    const pendingRemovalIds = pendingRemovalResult.ids;
    if (pendingRemovalIds.length > 0) {
        plan.workspace.treeOwnershipPendingRemovalIds = pendingRemovalIds;
    }
    if (plan.workspace.treeOwnershipProtectedIds) {
        plan.workspace.treeOwnershipProtectedIds = plan.workspace.treeOwnershipProtectedIds.filter(
            (id) => !durableMigratedSources.has(id),
        );
    }

    const payload = serializeStorageValue(plan.workspace);
    if (storedWorkspace !== payload || legacyStoragePresent) {
        try {
            storage.setItem(key, payload);
        } catch (error) {
            reportPersistError(persistStorageWriteError(error));
            tabStorage.removeKnownTreesSafely(stagedCloneIds);
            return plan.unrepairedWorkspace;
        }
    }

    // Every migrated source is in the published pending-removal list. This also reclaims
    // unreadable bytes, which ordinary orphan sweeps cannot decode.
    const failedKnownRemovals = tabStorage.removeKnownTreesSafely(pendingRemovalIds);
    for (const id of failedAdmissions.failedIds) failedKnownRemovals.add(id);

    // A direct true fault deletes the unowned tree in the fresh-module workspace test.
    // Stryker disable next-line ConditionalExpression: static mutant is not activated.
    if (!treeOwnershipUncertain && (hasAuthoritativeWorkspace || validMigrationSource)) {
        sweepOrphanedTreeKeys(plan.workspace.tabs, [], failedKnownRemovals);
    } else if (treeOwnershipUncertain && !takingFreshOwnershipSnapshot) {
        // The first snapshot protects prior trees; later loads sweep only outside that set.
        // A non-fresh uncertain load has a persisted protected set by construction.
        sweepOrphanedTreeKeys(
            plan.workspace.tabs,
            plan.workspace.treeOwnershipProtectedIds!,
            failedKnownRemovals,
        );
    }
    for (const legacyKey of ["tabs", "activeTab"]) {
        try {
            storage.removeItem(legacyKey);
        } catch (error) {
            reportPersistError(persistStorageWriteError(error));
        }
    }
    return plan.workspace;
}
