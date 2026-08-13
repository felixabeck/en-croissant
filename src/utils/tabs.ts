import { tauri } from "@/platform/tauri";
import type { StoreApi } from "zustand";
import type { FileMetadata } from "@/components/files/file";
import { tabStorage } from "@/state/store/tabStorage";
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

export async function createTab({
    tab,
    setTabs,
    setActiveTab,
    pgn,
    headers,
    gameOrigin,
    position,
    existingTabIds,
}: {
    tab: Omit<Tab, "value" | "gameOrigin">;
    setTabs: React.Dispatch<React.SetStateAction<Tab[]>>;
    setActiveTab: React.Dispatch<React.SetStateAction<string | null>>;
    pgn?: string;
    headers?: GameHeaders;
    gameOrigin?: GameOrigin;
    position?: number[];
    existingTabIds?: Iterable<string>;
}) {
    const id = genID(existingTabIds);

    if (pgn !== undefined) {
        const tree = await parsePGN(pgn, headers?.fen);
        if (headers) {
            tree.headers = headers;
            if (position) {
                tree.position = position;
            }
        }
        tabStorage.seed(id, tree);
    }

    setTabs((prev) => {
        const nextTab = {
            ...tab,
            value: id,
            gameOrigin: gameOrigin ?? { kind: "none" },
        };
        if (
            prev.length === 0 ||
            (prev.length === 1 && prev[0].type === "new" && tab.type !== "new")
        ) {
            return [nextTab];
        }
        return [...prev, nextTab];
    });
    setActiveTab(id);
    return id;
}

export type SaveResult = "saved" | "cancelled" | "failed";

export async function saveToFile({
    tab,
    setCurrentTab,
    store,
    isUserSave,
}: {
    tab: Tab | undefined;
    setCurrentTab: React.Dispatch<React.SetStateAction<Tab>>;
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
            setCurrentTab((prev) => {
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
            await tauri.writeGame(selected.handle, fileOrigin?.gameNumber ?? 0, pgn);
            store.getState().save();
            return "saved";
        }
    } catch {
        return "failed";
    }
}
