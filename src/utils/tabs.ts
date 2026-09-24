import { tauri } from "@/platform/tauri";
import { normalizeError, type AppError } from "@/platform/errors";
import type { StoreApi } from "zustand";
import { startTransition } from "react";
import type { FileMetadata } from "@/components/files/file";
import type { WriteExpectation } from "@/bindings";
import { persistStorageWriteError, tabStorage } from "@/state/store/tabStorage";
import { reportPersistError } from "@/state/persistError";
import { newWorkspaceId, tabSchema, type GameOrigin, type Tab } from "@/state/workspaceTypes";
import type { TreeStoreState } from "@/state/store/tree";
import { getPGN, parsePGN } from "./chess";
import { pickPgnFile, readFileGame } from "./files";
import type { GameHeaders, TreeState } from "./treeReducer";
import { fileWorkspaceKey } from "./pathCapabilities";
import { beginFileWrite, setFileFreshness } from "@/state/fileFreshness";
export { tabSchema, type GameOrigin, type Tab };

export function getTabFile(tab?: Tab | null): FileMetadata | undefined {
    if (!tab) return undefined;
    if (tab.gameOrigin.kind === "file" || tab.gameOrigin.kind === "temp_file") {
        return tab.gameOrigin.file;
    }
    return undefined;
}

export function getTabGameNumber(tab?: Tab | null): number {
    if (!tab) return 0;
    if (tab.gameOrigin.kind === "file" || tab.gameOrigin.kind === "temp_file") {
        return tab.gameOrigin.gameNumber;
    }
    return 0;
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
    const id = genID(existingTabIds);
    if (seed) {
        try {
            seed(id);
        } catch (error) {
            reportPersistError(persistStorageWriteError(error));
            return null;
        }
    }

    let admitted = false;
    try {
        startTransition(() => {
            admitted = setTabs((prev) => {
                const nextTab = { ...tab, value: id };
                return prev.length === 0 ||
                    (prev.length === 1 && prev[0].type === "new" && tab.type !== "new")
                    ? [nextTab]
                    : [...prev, nextTab];
            }, id);
        });
    } catch (error) {
        if (seed) rollbackCreatedTree(id);
        throw error;
    }
    if (!admitted) {
        if (seed) rollbackCreatedTree(id);
        return null;
    }
    return id;
}

function rollbackCreatedTree(id: string) {
    try {
        tabStorage.remove(id);
    } catch (error) {
        reportPersistError(persistStorageWriteError(error));
    }
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
    let currentFileOperation = false;
    let writingCurrentOrigin = false;
    try {
        const tabId = tab.value;
        const currentOrigin = tab.gameOrigin;
        const currentTabAtStart = getTab(tabId);
        if (!currentTabAtStart || !sameOrigin(currentTabAtStart.gameOrigin, currentOrigin)) {
            return "superseded";
        }
        const fileOrigin =
            currentOrigin?.kind === "file" || currentOrigin?.kind === "temp_file"
                ? currentOrigin
                : undefined;
        const databaseOrigin = currentOrigin?.kind === "database" ? currentOrigin : undefined;
        const isTempFile = currentOrigin?.kind === "temp_file";
        const sourceStamp = store.getState().sourceStamp;
        const pgn = serializeStoreTree(store);

        if (databaseOrigin) {
            await tauri.writeDbGame(databaseOrigin.database, databaseOrigin.gameId, pgn);
            store.getState().save();
            return "saved";
        }

        if (fileOrigin && !(isTempFile && isUserSave)) {
            currentFileOperation = true;
            writingCurrentOrigin = true;
            if (sourceStamp === null) return sourceChanged(tabId);
            const endWrite = beginFileWrite(fileWorkspaceKey(fileOrigin.file.handle));
            let written: Awaited<ReturnType<typeof tauri.writeGame>>;
            try {
                written = await tauri.writeGame(
                    fileOrigin.file.handle,
                    fileOrigin.gameNumber,
                    pgn,
                    writeExpectation(sourceStamp),
                );
            } finally {
                endWrite();
            }
            const currentTab = getTab(tabId);
            if (!currentTab || !sameOrigin(currentTab.gameOrigin, currentOrigin))
                return "superseded";
            if (written.stamp === null || written.revision === null) {
                if (written.stamp === null) store.getState().setSourceStamp(null);
                setFileFreshness(tabId, "unverified");
                return "conflict";
            }
            const unchanged = serializeStoreTree(store) === pgn;
            if (unchanged) {
                store.getState().save(written.stamp);
            } else {
                store.getState().setSourceStamp(written.stamp);
            }
            setFileFreshness(tabId, "verified", { verifiedRevision: written.revision });
            return unchanged ? "saved" : "superseded";
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
        const endWrite = beginFileWrite(fileWorkspaceKey(selected.handle));
        let written: Awaited<ReturnType<typeof tauri.writeGame>>;
        try {
            written = await tauri.writeGame(
                selected.handle,
                gameNumber,
                pgn,
                writeExpectation(destination.stamp),
            );
        } finally {
            endWrite();
        }
        const currentTab = getTab(tabId);
        if (!currentTab || !sameOrigin(currentTab.gameOrigin, currentOrigin)) return "superseded";
        if (written.stamp === null || written.revision === null) {
            if (written.stamp === null) store.getState().setSourceStamp(null);
            setFileFreshness(tabId, "unverified");
            return "conflict";
        }

        const savedOrigin = updateTab(tabId, (previous) => ({
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
        }));
        if (!savedOrigin) return "superseded";
        const unchanged = serializeStoreTree(store) === pgn;
        if (unchanged) {
            store.getState().save(written.stamp);
        } else {
            store.getState().setSourceStamp(written.stamp);
        }
        setFileFreshness(tabId, "verified", { verifiedRevision: written.revision });
        return unchanged ? "saved" : "superseded";
    } catch (error) {
        const normalized = normalizeError(error);
        if (tab && normalized.backendCategory === "stale-game") {
            return writingCurrentOrigin ? sourceChanged(tab.value) : failed(error);
        }
        if (tab && currentFileOperation && normalized.backendCategory === "conflict") {
            setFileFreshness(tab.value, "unverified", { errorMessage: normalized.message });
            return failed(error);
        }
        if (
            tab &&
            currentFileOperation &&
            (normalized.backendCategory === "missing-resource" ||
                normalized.backendCategory === "invalid-input")
        ) {
            setFileFreshness(tab.value, "unavailable");
            return "conflict";
        }
        return failed(error);
    }
}
