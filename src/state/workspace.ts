import type { SyncStorage, SyncStringStorage } from "jotai/vanilla/utils/atomWithStorage";
import { z } from "zod";
import { tabStorage } from "./store/tabStorage";
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

function repairWorkspace(input: unknown): Workspace {
    const inputResult = workspaceInputSchema.safeParse(input);
    if (!inputResult.success) return defaultWorkspace();
    const parsed = inputResult.data;
    const candidates = parsed.tabs;
    const ids = new Set<string>();
    const oldIdsToRemove = new Set<string>();
    const tabs = candidates.map((tab) => {
        if (uuidSchema.safeParse(tab.value).success && !ids.has(tab.value)) {
            ids.add(tab.value);
            return tab;
        }

        const migratedId = newWorkspaceId(ids);
        // Tree state is keyed by tab ID. Copy first so a failed storage write never
        // destroys a recoverable legacy tree; only uniquely-owned old IDs are removed.
        tabStorage.clone(tab.value, migratedId);
        if (!ids.has(tab.value)) oldIdsToRemove.add(tab.value);
        ids.add(migratedId);
        return { ...tab, value: migratedId };
    });

    // ID migration is startup work, not an edit: commit copied trees before removing
    // their legacy keys so a restart cannot lose a tab between the two operations.
    if (oldIdsToRemove.size > 0) tabStorage.flush();
    for (const id of oldIdsToRemove) tabStorage.remove(id);
    if (tabs.length === 0) tabs.push(newTab(ids));

    const legacyActive = parsed.activeTab;
    const activeTab = tabs.some((tab) => tab.value === legacyActive)
        ? legacyActive
        : tabs[0]!.value;
    return { version: WORKSPACE_VERSION, tabs, activeTab };
}

export function scrubInvalidLegacyTreeKeys(input: unknown, retainedTabs: readonly Tab[]) {
    if (!isRecord(input) || !Array.isArray(input.tabs)) return;
    const retainedIds = new Set(retainedTabs.map((tab) => tab.value));
    for (const tab of input.tabs) {
        if (!isRecord(tab) || typeof tab.value !== "string" || retainedIds.has(tab.value)) continue;
        tabStorage.remove(tab.value);
    }
}

export function readWorkspaceJson(storage: SyncStringStorage, key: string): unknown | null {
    const raw = storage.getItem(key);
    try {
        return JSON.parse(raw ?? "null") as unknown;
    } catch {
        return null;
    }
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Migrates separate legacy tabs/activeTab keys into one repairable envelope. */
export function createWorkspaceStorage(storage: SyncStringStorage): SyncStorage<Workspace> {
    return {
        getItem(key, _initialValue) {
            const current = readWorkspaceJson(storage, key);
            const legacy =
                current ??
                ({
                    tabs: readWorkspaceJson(storage, "tabs"),
                    activeTab: readWorkspaceJson(storage, "activeTab"),
                } as const);
            const workspace = repairWorkspace(legacy);
            const result = workspace;
            scrubInvalidLegacyTreeKeys(legacy, result.tabs);
            storage.setItem(key, JSON.stringify(result));
            storage.removeItem("tabs");
            storage.removeItem("activeTab");
            return result;
        },
        setItem(key, value) {
            storage.setItem(key, JSON.stringify(repairWorkspace(value)));
        },
        removeItem(key) {
            storage.removeItem(key);
        },
    };
}
