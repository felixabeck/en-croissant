import { tauri } from "@/platform/tauri";
import { normalizeError, type AppError } from "@/platform/errors";
import type { getDefaultStore } from "jotai";
import type { StoreApi } from "zustand";
import { startTransition } from "react";
import type { FileMetadata } from "@/components/files/file";
import type { WriteExpectation } from "@/bindings";
import { persistStorageWriteError, tabStorage } from "@/state/store/tabStorage";
import { reportPersistError } from "@/state/persistError";
import {
    getTabTreeKey,
    newWorkspaceId,
    tabSchema,
    type GameOrigin,
    type Tab,
} from "@/state/workspaceTypes";
import {
    activeTabAtom,
    closingTabsAtom,
    initializeWorkspace,
    reclaimTabLocalState,
    tabsAtom,
} from "@/state/atoms";
import {
    closeTreeStore,
    getCachedTreeStore,
    retargetTreeStore,
    type TreeStore,
    type TreeStoreState,
} from "@/state/store/tree";
import { getPGN, parsePGN } from "./chess";
import { pickPgnFile, readFileGame, writeFileGame } from "./files";
import type { GameHeaders, TreeState } from "./treeReducer";
import { fileWorkspaceKey } from "./pathCapabilities";
import { setFileFreshness } from "@/state/fileFreshness";
export { getTabTreeKey, tabSchema, type GameOrigin, type Tab };

export type FileBackedTab = Tab & {
    gameOrigin: Extract<GameOrigin, { kind: "file" | "temp_file" }>;
};

export function isFileBackedTab(tab?: Tab | null): tab is FileBackedTab {
    return !!tab && (tab.gameOrigin.kind === "file" || tab.gameOrigin.kind === "temp_file");
}

export function matchesFileGameTab(
    tab: Tab | undefined,
    origin: FileBackedTab["gameOrigin"],
): tab is FileBackedTab {
    return isFileBackedTab(tab) && sameFileGameOrigin(tab.gameOrigin, origin);
}

export function getTabFile(tab?: Tab | null): FileMetadata | undefined {
    return isFileBackedTab(tab) ? tab.gameOrigin.file : undefined;
}

export function getTabGameNumber(tab?: Tab | null): number {
    return isFileBackedTab(tab) ? tab.gameOrigin.gameNumber : 0;
}

export function isPersistentGameOrigin(tab?: Tab | null): boolean {
    if (!tab) return false;
    return tab.gameOrigin.kind !== "none";
}

export const genID = newWorkspaceId;

export type SetTabs = (update: Tab[] | ((tabs: Tab[]) => Tab[]), activeTab?: string) => boolean;
export type SetCurrentTab = (update: React.SetStateAction<Tab>) => boolean;
export type UpdateTab = (tabId: string, update: React.SetStateAction<Tab>) => boolean;

export function updateTabById(setTabs: SetTabs, tabId: string, update: React.SetStateAction<Tab>) {
    let found = false;
    const committed = setTabs((tabs) =>
        tabs.map((tab) => {
            if (tab.value !== tabId) return tab;
            found = true;
            return typeof update === "function" ? update(tab) : update;
        }),
    );
    return committed && found;
}

type StagedAdmissionResult =
    | { kind: "committed"; id: string }
    | { kind: "refused"; stage: "tree" | "workspace" };

function stageAndCommitTab({
    seed,
    existingTabIds,
    commit,
}: {
    seed?: (id: string) => void;
    existingTabIds?: Iterable<string>;
    commit: (freshId: string) => boolean;
}): StagedAdmissionResult {
    initializeWorkspace();
    const id = genID(existingTabIds);
    if (seed) {
        try {
            seed(id);
        } catch (error) {
            reportPersistError(persistStorageWriteError(error));
            rollbackCreatedTree(id);
            return { kind: "refused", stage: "tree" };
        }
    }

    let result: StagedAdmissionResult | undefined;
    let admissionError: unknown;
    startTransition(() => {
        try {
            result = commit(id)
                ? { kind: "committed", id }
                : { kind: "refused", stage: "workspace" };
        } catch (error) {
            admissionError = error;
        }
    });
    // A missing result is an application exception, never definite admission refusal.
    if (!result) throw admissionError;
    if (result.kind === "refused") {
        if (seed) rollbackCreatedTree(id);
    }
    return result;
}

export function commitNewTab({
    tab,
    setTabs,
    seed,
    existingTabIds,
}: {
    tab: Omit<Tab, "value">;
    setTabs: SetTabs;
    seed?: (id: string) => void;
    existingTabIds?: Iterable<string>;
}): string | null {
    const result = stageAndCommitTab({
        seed,
        existingTabIds,
        commit: (id) =>
            setTabs((prev) => {
                const nextTab = { ...tab, value: id, treeKey: undefined };
                return prev.length === 0 ||
                    (prev.length === 1 && prev[0].type === "new" && tab.type !== "new")
                    ? [nextTab]
                    : [...prev, nextTab];
            }, id),
    });
    return result.kind === "committed" ? result.id : null;
}

function rollbackCreatedTree(id: string) {
    // Only seed failure or a returned refusal proves that deleting the staged tree is safe.
    if (!tabStorage.removeTreeSafely(id)) {
        tabStorage.recordFailedAdmission(id);
    }
}

export type ReplaceNewTabResult =
    | { kind: "committed"; id: string }
    | { kind: "superseded" }
    | { kind: "refused"; stage: "tree" | "workspace" };

export function replaceNewTab({
    store,
    ownerId,
    tab,
    tree,
}: {
    store: ReturnType<typeof getDefaultStore>;
    ownerId: string;
    tab: Omit<Tab, "value">;
    tree: TreeState;
}): ReplaceNewTabResult {
    const tabs = store.get(tabsAtom);
    const ownerIndex = tabs.findIndex((current) => current.value === ownerId);
    if (
        ownerIndex === -1 ||
        tabs[ownerIndex]?.type !== "new" ||
        store.get(closingTabsAtom).has(ownerId)
    ) {
        return { kind: "superseded" };
    }

    const result = stageAndCommitTab({
        seed: (freshId) => tabStorage.seed(freshId, tree),
        existingTabIds: tabs.flatMap((current) => [current.value, getTabTreeKey(current)]),
        commit: (freshId) => {
            const activeTab = store.get(activeTabAtom);
            const committed = store.set(
                tabsAtom,
                (currentTabs) =>
                    currentTabs.map((current, index) =>
                        index === ownerIndex
                            ? { ...tab, value: freshId, treeKey: undefined }
                            : current,
                    ),
                activeTab === ownerId ? freshId : undefined,
            );
            if (committed) {
                reclaimTabLocalState(ownerId, getTabTreeKey(tabs[ownerIndex]));
                closeTreeStore(ownerId);
            }
            return committed;
        },
    });
    return result;
}

/** Stage a fresh durable generation without changing the logical tab or its runtime owners. */
export function replaceFileGame({
    store,
    owner,
    treeStore,
    snapshot,
    tree,
    page,
    isCurrent,
}: {
    store: ReturnType<typeof getDefaultStore>;
    owner: FileBackedTab;
    treeStore: TreeStore;
    snapshot: Pick<TreeState, "root" | "headers">;
    tree: TreeState;
    page: number;
    isCurrent: () => boolean;
}): ReplaceNewTabResult {
    const oldKey = getTabTreeKey(owner);
    const owns = () => {
        const current = store.get(tabsAtom).find((tab) => tab.value === owner.value);
        const live = treeStore.getState();
        return (
            isCurrent() &&
            !!current &&
            !store.get(closingTabsAtom).has(owner.value) &&
            sameFileGameOrigin(current.gameOrigin, owner.gameOrigin) &&
            getTabTreeKey(current) === oldKey &&
            getCachedTreeStore(owner.value) === treeStore &&
            live.root === snapshot.root &&
            live.headers === snapshot.headers
        );
    };
    if (!owns()) return { kind: "superseded" };
    let superseded = false;
    const result = stageAndCommitTab({
        seed: (id) => tabStorage.seed(id, tree),
        existingTabIds: store.get(tabsAtom).flatMap((tab) => [tab.value, getTabTreeKey(tab)]),
        commit: (id) => {
            if (!owns()) {
                superseded = true;
                return false;
            }
            return store.set(
                tabsAtom,
                (tabs) =>
                    tabs.map((tab) =>
                        tab.value === owner.value
                            ? {
                                  ...tab,
                                  treeKey: id,
                                  gameOrigin: { ...tab.gameOrigin, gameNumber: page },
                              }
                            : tab,
                    ),
                undefined,
                () => retargetTreeStore(owner.value, id, tree),
            );
        },
    });
    if (superseded) return { kind: "superseded" };
    if (result.kind === "committed") tabStorage.removeTreeSafely(oldKey);
    return result;
}

export async function runTabCreation({
    create,
    onSuccess,
    onError,
}: {
    create: () => Promise<string | null> | string | null;
    onSuccess?: (id: string) => void | Promise<void>;
    onError: (error: unknown) => void;
}): Promise<string | null> {
    try {
        const id = await create();
        if (id === null) return null;
        await onSuccess?.(id);
        return id;
    } catch (error) {
        onError(error);
        return null;
    }
}

export async function createTab({
    tab,
    setTabs,
    pgn,
    headers,
    gameOrigin,
    position,
    initialTree,
    existingTabIds,
}: {
    tab: Omit<Tab, "value" | "gameOrigin">;
    setTabs: SetTabs;
    pgn?: string;
    headers?: GameHeaders;
    gameOrigin?: GameOrigin;
    position?: number[];
    initialTree?: TreeState;
    existingTabIds?: Iterable<string>;
}): Promise<string | null> {
    let treeToSeed: TreeState | undefined = initialTree;

    if (!treeToSeed && pgn !== undefined) {
        const tree = await parsePGN(pgn, headers?.fen);
        if (headers) {
            tree.headers = headers;
            if (position) {
                tree.position = position;
            }
        }
        treeToSeed = tree;
    }

    return commitNewTab({
        tab: {
            ...tab,
            gameOrigin: gameOrigin ?? { kind: "none" },
        },
        setTabs,
        seed: treeToSeed ? (id) => tabStorage.seed(id, treeToSeed) : undefined,
        existingTabIds,
    });
}

export type SaveResult =
    | "saved"
    | "cancelled"
    | "conflict"
    | "superseded"
    | { status: "failed"; error: AppError };

export function serializeStoreTree(store: StoreApi<TreeStoreState>): string {
    const state = store.getState();
    return `${getPGN(state.root, {
        headers: state.headers,
        comments: true,
        extraMarkups: true,
        glyphs: true,
        variations: true,
    })}\n\n`;
}

export function sameFileGameOrigin(left: GameOrigin, right: GameOrigin): boolean {
    if (left.kind === "file" || left.kind === "temp_file") {
        return (
            (right.kind === "file" || right.kind === "temp_file") &&
            fileWorkspaceKey(left.file.handle) === fileWorkspaceKey(right.file.handle) &&
            left.gameNumber === right.gameNumber
        );
    }
    return false;
}

function sameOrigin(left: GameOrigin, right: GameOrigin): boolean {
    if (left.kind !== right.kind) return false;
    if (left.kind === "file" || left.kind === "temp_file") {
        return sameFileGameOrigin(left, right);
    }
    if (left.kind === "database") {
        return right.kind === "database" && left.gameId === right.gameId;
    }
    return true;
}

function sourceChanged(tabId: string): SaveResult {
    setFileFreshness(tabId, "conflict", { conflictReason: "save-refused" });
    return "conflict";
}

function failed(error: unknown): SaveResult {
    return { status: "failed", error: normalizeError(error) };
}

function writeExpectation(stamp: string): WriteExpectation {
    return { kind: "game", stamp };
}

export async function saveToFile({
    tab,
    updateTab,
    getTab,
    store,
    isUserSave,
}: {
    tab: Tab | undefined;
    updateTab: UpdateTab;
    getTab: (tabId: string) => Tab | undefined;
    store: StoreApi<TreeStoreState>;
    isUserSave?: boolean;
}): Promise<SaveResult> {
    if (!tab) return failed(new Error("There is no active tab to save."));
    const tabId = tab.value;
    const currentOrigin = tab.gameOrigin;
    const owns = () => {
        const current = getTab(tabId);
        return (
            !!current &&
            getTabTreeKey(current) === getTabTreeKey(tab) &&
            sameOrigin(current.gameOrigin, currentOrigin)
        );
    };
    let currentFileOperation = false;
    let writingCurrentOrigin = false;
    let writingSaveAsDestination = false;
    try {
        if (!owns()) return "superseded";
        const fileOrigin =
            currentOrigin?.kind === "file" || currentOrigin?.kind === "temp_file"
                ? currentOrigin
                : undefined;
        const databaseOrigin = currentOrigin?.kind === "database" ? currentOrigin : undefined;
        const isTempFile = currentOrigin?.kind === "temp_file";
        const sourceStamp = store.getState().sourceStamp;
        const pgn = serializeStoreTree(store);
        const finishWrite = (
            written: Awaited<ReturnType<typeof writeFileGame>>,
            commitOrigin?: () => boolean,
        ): SaveResult => {
            if (!owns()) return "superseded";
            if (written.stamp === null || written.revision === null) {
                if (written.stamp === null) store.getState().setSourceStamp(null);
                setFileFreshness(tabId, "unverified");
                return "conflict";
            }
            if (commitOrigin && !commitOrigin()) return "superseded";
            const unchanged = serializeStoreTree(store) === pgn;
            if (unchanged) store.getState().save(written.stamp);
            else store.getState().setSourceStamp(written.stamp);
            setFileFreshness(tabId, "verified", { verifiedRevision: written.revision });
            return unchanged ? "saved" : "superseded";
        };

        if (databaseOrigin) {
            await tauri.writeDbGame(databaseOrigin.database, databaseOrigin.gameId, pgn);
            store.getState().save();
            return "saved";
        }

        if (fileOrigin && !(isTempFile && isUserSave)) {
            currentFileOperation = true;
            writingCurrentOrigin = true;
            if (sourceStamp === null) return sourceChanged(tabId);
            const written = await writeFileGame(
                fileOrigin.file.handle,
                fileOrigin.gameNumber,
                pgn,
                writeExpectation(sourceStamp),
            );
            return finishWrite(written);
        }

        if (isTempFile && fileOrigin) {
            if (sourceStamp === null) return sourceChanged(tabId);
            currentFileOperation = true;
            const source = await readFileGame(fileOrigin.file.handle, fileOrigin.gameNumber);
            if (source.stamp !== sourceStamp) return sourceChanged(tabId);
            currentFileOperation = false;
        }

        const selected = await pickPgnFile();
        if (!selected) return "cancelled";

        if (isTempFile && fileOrigin) {
            currentFileOperation = true;
            const source = await readFileGame(fileOrigin.file.handle, fileOrigin.gameNumber);
            if (source.stamp !== sourceStamp) return sourceChanged(tabId);
            currentFileOperation = false;
        }

        const gameNumber = fileOrigin?.gameNumber ?? 0;
        const destination = await readFileGame(selected.handle, gameNumber);
        currentFileOperation = true;
        writingSaveAsDestination = true;
        const written = await writeFileGame(
            selected.handle,
            gameNumber,
            pgn,
            writeExpectation(destination.stamp),
        );
        return finishWrite(written, () =>
            updateTab(tabId, (previous) => ({
                ...previous,
                gameOrigin: {
                    kind: "file",
                    gameNumber,
                    file: {
                        ...selected,
                        numGames: Math.max(selected.numGames, gameNumber + 1),
                        metadata: { tags: [], type: "game" as const },
                    },
                },
            })),
        );
    } catch (error) {
        const normalized = normalizeError(error);
        if (tab && normalized.backendCategory === "stale-game") {
            return writingCurrentOrigin ? sourceChanged(tab.value) : failed(error);
        }
        if (tab && writingCurrentOrigin && normalized.category === "applied-despite-error") {
            // The game reached the file but its stamp is unknown: verify it by text, as after a
            // write whose read-back failed.
            if (owns()) {
                store.getState().setSourceStamp(null);
                setFileFreshness(tab.value, "unverified");
            }
            return failed(error);
        }
        if (tab && currentFileOperation && normalized.backendCategory === "conflict") {
            setFileFreshness(tab.value, "unverified", { errorMessage: normalized.message });
            return failed(error);
        }
        // A Save-As destination that vanished or refused the slot was never written, and it is not
        // the tab's game: that is an ordinary failure, not an unavailable source.
        if (
            tab &&
            currentFileOperation &&
            !writingSaveAsDestination &&
            (normalized.backendCategory === "missing-resource" ||
                normalized.backendCategory === "invalid-input")
        ) {
            setFileFreshness(tab.value, "unavailable");
            return "conflict";
        }
        return failed(error);
    }
}
