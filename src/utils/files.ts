import { tauri } from "@/platform/tauri";
import { Result } from "@badrap/result";
import { platform } from "@/platform/native";
import { errorUnlessCancelled, runWithAppliedRecovery } from "@/platform/errors";
import { defaultGame, makePgn } from "chessops/pgn";
import { getDefaultStore } from "jotai";
import useSWR from "swr";
import type { FileMetadata, FileType } from "@/components/files/file";
import type { FileWorkspaceHandle } from "@/bindings";
import {
    addRecentFileAtom,
    fileWorkspaceAtom,
    fileWorkspaceDisplayNameAtom,
    tabFamily,
} from "@/state/atoms";
import { parsePGN } from "./chess";
import { createTab, type Tab } from "./tabs";
import { getGameName } from "./treeReducer";

export function usePlatform() {
    const r = useSWR("os", async () => {
        return platform();
    });
    return { os: r.data, ...r };
}

export async function pickPgnFile(): Promise<FileMetadata | null> {
    let descriptor;
    try {
        descriptor = await tauri.issuePgnWorkspace();
    } catch (error) {
        if (errorUnlessCancelled(error) === null) return null;
        throw error;
    }
    const count = await tauri.countPgnGames(descriptor.handle);
    return {
        type: "file",
        handle: descriptor.handle,
        name: descriptor.displayName.replace(/\.pgn$/i, ""),
        numGames: count,
        metadata: { type: "game", tags: [] },
        lastModified: Date.now(),
    };
}

export async function ensureFileWorkspace(): Promise<FileWorkspaceHandle | null> {
    const store = getDefaultStore();
    const existing = store.get(fileWorkspaceAtom);
    if (existing) return existing;
    try {
        const result = await tauri.issueFileWorkspace();
        store.set(fileWorkspaceAtom, result.handle);
        store.set(fileWorkspaceDisplayNameAtom, result.displayName);
        return result.handle;
    } catch (error) {
        if (errorUnlessCancelled(error) === null) return null;
        throw error;
    }
}

export async function openFile(
    file: FileMetadata,
    setTabs: React.Dispatch<React.SetStateAction<Tab[]>>,
    setActiveTab: React.Dispatch<React.SetStateAction<string | null>>,
    options?: {
        gameNumber?: number;
        pgn?: string;
    },
) {
    const store = getDefaultStore();
    const gameNumber = options?.gameNumber ?? 0;
    let fileInfo: FileMetadata;
    let pgn = options?.pgn;
    fileInfo = file;
    if (pgn === undefined) pgn = (await tauri.readGames(file.handle, gameNumber, gameNumber))[0];
    let tabName = file.name || "Untitled";
    if (pgn) tabName = getGameName((await parsePGN(pgn)).headers);

    const id = await createTab({
        tab: {
            name: tabName,
            type: "analysis",
        },
        setTabs,
        setActiveTab,
        pgn: pgn || "",
        gameOrigin: {
            kind: "file",
            file: fileInfo,
            gameNumber,
        },
    });

    if (fileInfo.metadata.type === "repertoire") {
        store.set(tabFamily(id), "practice");
    }

    store.set(addRecentFileAtom, {
        name: tabName,
        handle: fileInfo.handle,
        type: fileInfo.metadata.type,
    });

    return id;
}

export async function createFile({
    filename,
    filetype,
    pgn,
    workspace,
    parent,
}: {
    filename: string;
    filetype: FileType;
    pgn?: string;
    workspace: FileWorkspaceHandle;
    parent: FileWorkspaceHandle;
}): Promise<Result<FileMetadata>> {
    try {
        const expected = filename.toLowerCase();
        const withoutPgn = expected.replace(/\.pgn$/i, "");
        const entry = await runWithAppliedRecovery(
            () =>
                tauri.createWorkspaceFile(
                    workspace,
                    parent,
                    filename,
                    { type: filetype, tags: [] },
                    pgn || makePgn(defaultGame()),
                ),
            async () =>
                (await tauri.listFileWorkspace(parent)).find((candidate) => {
                    const actual = candidate.name.toLowerCase();
                    return actual === expected || actual === withoutPgn;
                }),
        );
        if (!entry.metadata || entry.gameCount === null)
            return Result.err(Error("Native workspace returned incomplete file metadata"));
        return Result.ok({
            type: "file",
            handle: entry.handle,
            name: entry.name,
            numGames: entry.gameCount,
            metadata: { type: entry.metadata.type, tags: entry.metadata.tags },
            lastModified: Number(entry.lastModified),
        });
    } catch (error) {
        return Result.err(error instanceof Error ? error : Error(String(error)));
    }
}
