import type { SyncStorage, SyncStringStorage } from "jotai/vanilla/utils/atomWithStorage";
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
};

const MAX_WORKSPACE_TABS = 100;
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
    const retainedIds = new Set(retainedTabs.map((tab) => tab.value));
    for (const tab of input.tabs) {
        if (!isRecord(tab) || typeof tab.value !== "string" || retainedIds.has(tab.value)) continue;
        tabStorage.remove(tab.value);
    }
}

export function readStoredWorkspaceValue(storage: SyncStringStorage, key: string): unknown | null {
    const raw = storage.getItem(key);
    if (raw === null) return null;
    return decodeCompressedOrJson(raw);
}

function workspaceFromValue(value: unknown): Workspace {
    const parsed = workspaceInputSchema.safeParse(value);
    if (!parsed.success) return defaultWorkspace();
    const tabs = parsed.data.tabs;
    if (tabs.length === 0) {
        const first = newTab(new Set());
        return { version: WORKSPACE_VERSION, tabs: [first], activeTab: first.value };
    }
    const legacyActive = parsed.data.activeTab;
    const activeTab = resolveActiveTab(tabs, legacyActive);
    return { version: WORKSPACE_VERSION, tabs, activeTab };
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Migrates separate legacy tabs/activeTab keys into one repairable envelope. */
export function createWorkspaceStorage(storage: SyncStringStorage): SyncStorage<Workspace> {
    return {
        getItem(key, _initialValue) {
            const storedWorkspace = storage.getItem(key);
            const current = readStoredWorkspaceValue(storage, key);
            const legacy =
                current ??
                ({
                    tabs: readStoredWorkspaceValue(storage, "tabs"),
                    activeTab: readStoredWorkspaceValue(storage, "activeTab"),
                } as const);
            const plan = planWorkspaceRepair(legacy);
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

            scrubInvalidLegacyTreeKeys(legacy, plan.workspace.tabs);
            storage.removeItem("tabs");
            storage.removeItem("activeTab");
            return plan.workspace;
        },
        setItem(key, value) {
            try {
                storage.setItem(key, serializeStorageValue(workspaceFromValue(value)));
            } catch (error) {
                reportPersistError(persistStorageWriteError(error));
            }
        },
        removeItem(key) {
            storage.removeItem(key);
        },
    };
}
