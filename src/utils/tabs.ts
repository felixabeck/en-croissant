import { tauri } from "@/platform/tauri";
import { normalizeError, type AppError } from "@/platform/errors";
import { useSetAtom, useStore, type getDefaultStore } from "jotai";
import type { StoreApi } from "zustand";
import { createContext, startTransition, useCallback } from "react";
import type { FileMetadata } from "@/components/files/file";
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
import { defaultPGN, getPGN, parsePGN } from "./chess";
import { pickPgnFile, readFileGame, writeFileGame } from "./files";
import type { GameHeaders, TreeState } from "./treeReducer";
import { fileWorkspaceKey } from "./pathCapabilities";
import { getFileFreshness, setFileFreshness } from "@/state/fileFreshness";
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

/** Live access stays inside the caller's workspace provider, including durable refusal. */
export function useTabActions() {
    const workspace = useStore();
    const setTabs = useSetAtom(tabsAtom);
    const getTab = useCallback(
        (id: string) => workspace.get(tabsAtom).find((tab) => tab.value === id),
        [workspace],
    );
    const updateTab = useCallback(
        (id: string, update: React.SetStateAction<Tab>) => updateTabById(setTabs, id, update),
        [setTabs],
    );
    return { workspace, getTab, updateTab };
}

export function sameTabOwner(current: Tab | undefined, captured: Tab): current is Tab {
    return (
        !!current &&
        current.value === captured.value &&
        getTabTreeKey(current) === getTabTreeKey(captured)
    );
}

export const AddGameContext = createContext<((owner: Tab | undefined) => Promise<void>) | null>(
    null,
);

type AddGameLease = { owner: FileBackedTab };
type AddGameAdmission = { lease: AddGameLease | null; listeners: Set<() => void> };
// One pending Add Game per live store/generation. Weak keys retain no retired store, and an
// empty admission is removed after its last view unsubscribes. Recovery append has its own owner.
const addGameAdmissions = new WeakMap<TreeStore, AddGameAdmission>();

function addGameAdmission(store: TreeStore): AddGameAdmission {
    let admission = addGameAdmissions.get(store);
    if (!admission) {
        admission = { lease: null, listeners: new Set() };
        addGameAdmissions.set(store, admission);
    }
    return admission;
}

function publishAddGameAdmission(store: TreeStore, admission: AddGameAdmission) {
    for (const listener of admission.listeners) listener();
    if (!admission.lease && !admission.listeners.size) addGameAdmissions.delete(store);
}

export function getAddGameLease(store: TreeStore) {
    return addGameAdmissions.get(store)?.lease ?? null;
}

export function subscribeAddGame(store: TreeStore, listener: () => void) {
    const admission = addGameAdmission(store);
    admission.listeners.add(listener);
    return () => {
        admission.listeners.delete(listener);
        publishAddGameAdmission(store, admission);
    };
}

/** Add Game completion belongs to the captured workspace and cached store, not a view. */
export async function appendBlankGame({
    captured,
    store,
    workspace,
    getTab,
    updateTab,
    onError,
    uncertainMessage,
    changedMessage,
}: {
    captured: Tab | undefined;
    store: TreeStore;
    workspace: ReturnType<typeof getDefaultStore>;
    getTab: (id: string) => Tab | undefined;
    updateTab: UpdateTab;
    onError: (error: unknown) => void;
    uncertainMessage: string;
    changedMessage: string;
}): Promise<void> {
    if (!isFileBackedTab(captured)) return;
    const ownerId = captured.value;
    let completionOwner = captured;
    const owns = () => {
        const current = getTab(ownerId);
        return (
            sameTabOwner(current, completionOwner) &&
            matchesFileGameTab(current, completionOwner.gameOrigin) &&
            getCachedTreeStore(ownerId) === store
        );
    };
    if (!owns()) return;
    const admission = addGameAdmission(store);
    if (
        admission.lease &&
        sameTabOwner(captured, admission.lease.owner) &&
        matchesFileGameTab(captured, admission.lease.owner.gameOrigin)
    )
        return;
    const lease = { owner: captured };
    admission.lease = lease;
    publishAddGameAdmission(store, admission);
    const before = getFileFreshness(ownerId);
    const claimed = setFileFreshness(ownerId, "appending");
    const notifyError = (error: unknown) => {
        if (owns()) onError(error);
    };
    const unverified = () =>
        setFileFreshness(ownerId, "unverified", {
            errorMessage: getFileFreshness(ownerId).errorMessage,
        });
    let writeAttempted = false;
    let replacementAttempted = false;
    const refreshFileCount = async () => {
        try {
            const count = await tauri.countPgnGames(captured.gameOrigin.file.handle);
            if (!owns()) return { ok: true as const };
            const committed = updateTab(ownerId, (previous) => {
                return {
                    ...previous,
                    gameOrigin: {
                        ...(previous as FileBackedTab).gameOrigin,
                        file: { ...(previous as FileBackedTab).gameOrigin.file, numGames: count },
                    },
                };
            });
            return { ok: committed };
        } catch (error) {
            return { ok: false as const, error };
        }
    };
    try {
        const pgn = defaultPGN();
        const newGame = await parsePGN(pgn);
        if (!owns()) return;
        const latest = getTab(ownerId)! as FileBackedTab;
        const origin = latest.gameOrigin;
        const gameNumber = origin.file.numGames;
        writeAttempted = true;
        const written = await writeFileGame(origin.file.handle, gameNumber, pgn, {
            kind: "append",
        });
        if (!owns()) return;
        if (written.stamp === null || written.revision === null) {
            const countRefresh = await refreshFileCount();
            if (!owns()) return;
            unverified();
            notifyError({
                category: "applied-despite-error",
                message: uncertainMessage,
            });
            if (!countRefresh.ok && "error" in countRefresh) notifyError(countRefresh.error);
            return;
        }
        // Once replacement starts, an exception can follow durable workspace admission.
        // Count repair would publish the old owner over that admitted candidate.
        replacementAttempted = true;
        const replacement = replaceFileGame({
            store: workspace,
            owner: captured,
            treeStore: store,
            snapshot: store.getState(),
            tree: { ...newGame, sourceStamp: written.stamp },
            page: gameNumber,
            appendCount: gameNumber + 1,
            isCurrent: owns,
        });
        if (replacement.kind === "committed") {
            completionOwner = {
                ...captured,
                treeKey: replacement.treeKey,
                gameOrigin: { ...origin, kind: "file", gameNumber },
            };
            if (owns())
                setFileFreshness(ownerId, "verified", { verifiedRevision: written.revision });
        } else if (owns()) unverified();
    } catch (error) {
        if (!owns()) return;
        const normalized = normalizeError(error);
        const countRefresh =
            writeAttempted && !replacementAttempted
                ? await refreshFileCount()
                : { ok: true as const };
        if (!owns()) return;
        if (writeAttempted) unverified();
        let visibleError: unknown = normalized;
        if (writeAttempted && normalized.backendCategory === "stale-game") {
            if (!countRefresh.ok && !("error" in countRefresh)) return;
            visibleError = countRefresh.ok
                ? { category: "validation", message: changedMessage }
                : countRefresh.error;
        } else if (writeAttempted) {
            visibleError = {
                ...normalized,
                message: `${uncertainMessage} ${normalized.message}`,
            };
        }
        notifyError(visibleError);
    } finally {
        // A parse failure may restore only its own presentation claim, never a newer Save result.
        if (owns() && getFileFreshness(ownerId) === claimed) {
            setFileFreshness(ownerId, before.state, before);
        }
        if (admission.lease === lease) {
            admission.lease = null;
            publishAddGameAdmission(store, admission);
        }
    }
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

export type ReplaceFileGameResult =
    | { kind: "committed"; treeKey: string }
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
    appendCount,
    isCurrent,
}: {
    store: ReturnType<typeof getDefaultStore>;
    owner: FileBackedTab;
    treeStore: TreeStore;
    snapshot: Pick<TreeState, "root" | "headers">;
    tree: TreeState;
    page: number;
    appendCount?: number;
    isCurrent: () => boolean;
}): ReplaceFileGameResult {
    const oldKey = getTabTreeKey(owner);
    const owns = () => {
        const current = store.get(tabsAtom).find((tab) => tab.value === owner.value);
        const live = treeStore.getState();
        return (
            isCurrent() &&
            sameTabOwner(current, owner) &&
            !store.get(closingTabsAtom).has(owner.value) &&
            sameFileGameOrigin(current.gameOrigin, owner.gameOrigin) &&
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
                                  gameOrigin:
                                      appendCount === undefined
                                          ? { ...tab.gameOrigin, gameNumber: page }
                                          : {
                                                kind: "file" as const,
                                                gameNumber: page,
                                                file: {
                                                    ...(tab as FileBackedTab).gameOrigin.file,
                                                    numGames: appendCount,
                                                },
                                            },
                              }
                            : tab,
                    ),
                undefined,
                () => retargetTreeStore(owner.value, id, tree),
            );
        },
    });
    if (superseded) return { kind: "superseded" };
    if (result.kind === "committed") {
        tabStorage.removeTreeSafely(oldKey);
        return { kind: "committed", treeKey: result.id };
    }
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

function failed(error: unknown): Extract<SaveResult, { status: "failed" }> {
    return { status: "failed", error: normalizeError(error) };
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
        return sameTabOwner(current, tab) && sameOrigin(current.gameOrigin, currentOrigin);
    };
    let currentFileOperation = false;
    let writingCurrentOrigin = false;
    let writingSaveAsDestination = false;
    try {
        if (!owns()) return "superseded";
        const fileOrigin = isFileBackedTab(tab) ? tab.gameOrigin : undefined;
        const databaseOrigin = currentOrigin?.kind === "database" ? currentOrigin : undefined;
        const isTempFile = currentOrigin?.kind === "temp_file";
        const sourceStamp = store.getState().sourceStamp;
        const pgn = serializeStoreTree(store);
        const gameNumber = fileOrigin?.gameNumber ?? 0;
        const write = (file: FileMetadata, stamp: string) =>
            writeFileGame(file.handle, gameNumber, pgn, { kind: "game", stamp });
        const validateSource = async (origin: NonNullable<typeof fileOrigin>) => {
            currentFileOperation = true;
            const source = await readFileGame(origin.file.handle, origin.gameNumber);
            if (!owns()) return "superseded";
            if (source.stamp !== sourceStamp) return sourceChanged(tabId);
            currentFileOperation = false;
        };
        const finishWrite = (
            written?: Awaited<ReturnType<typeof writeFileGame>>,
            commitOrigin?: () => boolean,
        ): SaveResult => {
            if (!owns()) return "superseded";
            if (written && (written.stamp === null || written.revision === null)) {
                if (written.stamp === null) store.getState().setSourceStamp(null);
                setFileFreshness(tabId, "unverified");
                return "conflict";
            }
            if (commitOrigin && !commitOrigin()) return "superseded";
            const unchanged = serializeStoreTree(store) === pgn;
            if (unchanged) store.getState().save(written?.stamp ?? undefined);
            else if (written) store.getState().setSourceStamp(written.stamp);
            if (written)
                setFileFreshness(tabId, "verified", {
                    verifiedRevision: written.revision ?? undefined,
                });
            return unchanged ? "saved" : "superseded";
        };

        if (databaseOrigin) {
            await tauri.writeDbGame(databaseOrigin.database, databaseOrigin.gameId, pgn);
            return finishWrite();
        }

        if (fileOrigin && !(isTempFile && isUserSave)) {
            currentFileOperation = true;
            writingCurrentOrigin = true;
            if (sourceStamp === null) return sourceChanged(tabId);
            const written = await write(fileOrigin.file, sourceStamp);
            return finishWrite(written);
        }

        if (isTempFile && fileOrigin) {
            if (sourceStamp === null) return sourceChanged(tabId);
            const result = await validateSource(fileOrigin);
            if (result) return result;
        }

        const selected = await pickPgnFile();
        if (!owns()) return "superseded";
        if (!selected) return "cancelled";

        if (isTempFile && fileOrigin) {
            const result = await validateSource(fileOrigin);
            if (result) return result;
        }

        const destination = await readFileGame(selected.handle, gameNumber);
        if (!owns()) return "superseded";
        currentFileOperation = true;
        writingSaveAsDestination = true;
        const written = await write(selected, destination.stamp);
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
        if (!owns()) return "superseded";
        const failure = failed(error);
        const normalized = failure.error;
        if (normalized.backendCategory === "stale-game") {
            return writingCurrentOrigin ? sourceChanged(tabId) : failure;
        }
        if (writingCurrentOrigin && normalized.category === "applied-despite-error") {
            // The game reached the file but its stamp is unknown: verify it by text, as after a
            // write whose read-back failed.
            store.getState().setSourceStamp(null);
            setFileFreshness(tabId, "unverified");
            return failure;
        }
        if (currentFileOperation && normalized.backendCategory === "conflict") {
            setFileFreshness(tabId, "unverified", { errorMessage: normalized.message });
            return failure;
        }
        // A Save-As destination that vanished or refused the slot was never written, and it is not
        // the tab's game: that is an ordinary failure, not an unavailable source.
        if (
            currentFileOperation &&
            !writingSaveAsDestination &&
            (normalized.backendCategory === "missing-resource" ||
                normalized.backendCategory === "invalid-input")
        ) {
            setFileFreshness(tabId, "unavailable");
            return "conflict";
        }
        return failure;
    }
}
