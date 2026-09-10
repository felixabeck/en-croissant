import { tauri } from "@/platform/tauri";
import type { StoreApi } from "zustand";
import { startTransition } from "react";
import type { FileMetadata } from "@/components/files/file";
import { persistStorageWriteError, tabStorage } from "@/state/store/tabStorage";
import { reportPersistError } from "@/state/persistError";
import { newWorkspaceId, tabSchema, type GameOrigin, type Tab } from "@/state/workspaceTypes";
import type { TreeStoreState } from "@/state/store/tree";
import { getPGN, parsePGN } from "./chess";
import { pickPgnFile } from "./files";
import type { GameHeaders } from "./treeReducer";
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
    existingTabIds,
}: {
    tab: Omit<Tab, "value" | "gameOrigin">;
    setTabs: SetTabs;
    pgn?: string;
    headers?: GameHeaders;
    gameOrigin?: GameOrigin;
    position?: number[];
    existingTabIds?: Iterable<string>;
}): Promise<string | null> {
    let treeToSeed: Awaited<ReturnType<typeof parsePGN>> | undefined;

    if (pgn !== undefined) {
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

export type SaveResult = "saved" | "cancelled" | "failed";

export async function saveToFile({
    tab,
    setCurrentTab,
    store,
    isUserSave,
}: {
    tab: Tab | undefined;
    setCurrentTab: SetCurrentTab;
    store: StoreApi<TreeStoreState>;
    isUserSave?: boolean;
}): Promise<SaveResult> {
    try {
        const currentOrigin = tab?.gameOrigin;
        const fileOrigin =
            currentOrigin?.kind === "file" || currentOrigin?.kind === "temp_file"
                ? currentOrigin
                : undefined;
        const databaseOrigin = currentOrigin?.kind === "database" ? currentOrigin : undefined;
        const isTempFile = currentOrigin?.kind === "temp_file";
        const pgn = `${getPGN(store.getState().root, {
            headers: store.getState().headers,
            comments: true,
            extraMarkups: true,
            glyphs: true,
            variations: true,
        })}\n\n`;

        if (databaseOrigin) {
            await tauri.writeDbGame(databaseOrigin.database, databaseOrigin.gameId, pgn);
            store.getState().save();
            return "saved";
        }

        if (fileOrigin && !(isTempFile && isUserSave)) {
            await tauri.writeGame(fileOrigin.file.handle, fileOrigin.gameNumber, pgn);
            store.getState().save();
            return "saved";
        } else {
            const selected = await pickPgnFile();
            if (!selected) return "cancelled";

            const numGames = isTempFile && fileOrigin ? fileOrigin.file.numGames : 1;
            const gameNumber = fileOrigin?.gameNumber ?? 0;
            const originSaved = setCurrentTab((prev) => {
                return {
                    ...prev,
                    gameOrigin: {
                        kind: "file",
                        gameNumber,
                        file: {
                            type: "file",
                            name: selected.name,
                            handle: selected.handle,
                            numGames,
                            metadata: {
                                tags: [],
                                type: "game",
                            },
                            lastModified: Date.now(),
                        },
                    },
                };
            });
            if (!originSaved) return "failed";
            await tauri.writeGame(selected.handle, fileOrigin?.gameNumber ?? 0, pgn);
            store.getState().save();
            return "saved";
        }
    } catch {
        return "failed";
    }
}
