import { tauri } from "@/platform/tauri";
import { remoteHttp } from "@/platform/http";
import { z } from "zod";
import useSWR from "swr";
import {
    type DatabaseInfo,
    type DatabaseHandle,
    type GameQuery,
    type NormalizedGame,
    type Player,
    type PlayerQuery,
    type PuzzleDatabaseInfo,
    type QueryResponse,
} from "@/bindings";
import type { LocalOptions } from "@/components/panels/database/DatabasePanel";
import { capabilityKey } from "@/utils/pathCapabilities";

export type SuccessDatabaseInfo = Extract<DatabaseInfo, { type: "success" }>;
export type ManagedDatabaseInfo = DatabaseInfo & { file: DatabaseHandle };
export type DownloadableDatabaseInfo = {
    title: string;
    description: string;
    player_count: number;
    game_count: number;
    storage_size: number;
    downloadLink: string;
    sha256: string;
    signature: string;
};

/** A puzzle database advertised by the signed remote manifest.
 *
 * Unlike locally installed puzzle databases, a remote entry has no path
 * capability. It becomes a local database only after the native download has
 * verified and installed it.
 */
export type DownloadablePuzzleDatabase = Pick<
    PuzzleDatabaseInfo,
    "title" | "description" | "puzzleCount"
> & {
    /** JSON cannot represent the native bigint storage size. */
    storageSize: number;
    downloadLink: string;
    sha256: string;
    signature: string;
};

const downloadableDatabaseSchema: z.ZodType<DownloadableDatabaseInfo, z.ZodTypeDef, unknown> = z
    .object({
        title: z.string().min(1),
        description: z.string().default(""),
        player_count: z.number(),
        game_count: z.number(),
        storage_size: z.number(),
        downloadLink: z.string().url(),
        sha256: z.string().regex(/^[a-fA-F0-9]{64}$/),
        signature: z.string().min(1),
    })
    .passthrough();
const downloadableDatabaseManifestSchema: z.ZodType<
    DownloadableDatabaseInfo[],
    z.ZodTypeDef,
    unknown
> = z.array(downloadableDatabaseSchema);

const downloadablePuzzleDatabaseSchema: z.ZodType<DownloadablePuzzleDatabase> = z
    .object({
        title: z.string().min(1),
        description: z.string(),
        puzzleCount: z.number().int().nonnegative(),
        storageSize: z.number().int().nonnegative(),
        downloadLink: z.string().url(),
        sha256: z.string().regex(/^[a-fA-F0-9]{64}$/),
        signature: z.string().min(1),
    })
    .strict();

/** Stable renderer identity for an opaque database capability.
 *
 * Handles are values, not strings: UI controls need a string key while native
 * commands must keep the original branded object. Keep that conversion at the
 * boundary instead of leaking path-shaped values through state.
 */
export function databaseHandleKey(handle: DatabaseHandle): string {
    return capabilityKey(handle);
}

export function sameDatabaseHandle(
    left: DatabaseHandle | null | undefined,
    right: DatabaseHandle | null | undefined,
): boolean {
    return left !== undefined && left !== null && right !== undefined && right !== null
        ? databaseHandleKey(left) === databaseHandleKey(right)
        : left === right;
}

export function databaseHandleFromKey(
    databases: readonly ManagedDatabaseInfo[],
    key: string | null,
): DatabaseHandle | null {
    if (!key) return null;
    return databases.find((database) => databaseHandleKey(database.file) === key)?.file ?? null;
}

export type Sides = "WhiteBlack" | "BlackWhite" | "Any";

export interface CompleteGame {
    game: NormalizedGame;
    currentMove: number[];
}

export type Speed =
    | "UltraBullet"
    | "Bullet"
    | "Blitz"
    | "Rapid"
    | "Classical"
    | "Correspondence"
    | "Unknown";

function normalizeRange(range?: [number, number] | null): [number, number] | undefined {
    if (!range || range[1] - range[0] === 3000) {
        return undefined;
    }
    return range;
}

export async function query_games(
    db: DatabaseHandle,
    query: GameQuery,
): Promise<QueryResponse<NormalizedGame[]>> {
    return await tauri.getGames(db, {
        player1: query.player1,
        range1: normalizeRange(query.range1),
        player2: query.player2,
        range2: normalizeRange(query.range2),
        tournament_id: query.tournament_id,
        sides: query.sides,
        outcome: query.outcome,
        start_date: query.start_date,
        end_date: query.end_date,
        position: null,
        options: {
            skipCount: query.options?.skipCount ?? false,
            page: query.options?.page,
            pageSize: query.options?.pageSize,
            sort: query.options?.sort || "id",
            direction: query.options?.direction || "desc",
        },
    });
}

export async function query_players(
    db: DatabaseHandle,
    query: PlayerQuery,
): Promise<QueryResponse<Player[]>> {
    return await tauri.getPlayers(db, {
        options: {
            skipCount: query.options.skipCount || false,
            page: query.options.page,
            pageSize: query.options.pageSize,
            sort: query.options.sort,
            direction: query.options.direction,
        },
        name: query.name,
        range: normalizeRange(query.range),
    });
}

export async function getDatabases(): Promise<ManagedDatabaseInfo[]> {
    const root = await tauri.getDatabaseWorkspace();
    const databases = await tauri.listWorkspaceDatabases(root);
    const results = await Promise.allSettled(
        databases.map((database) => getDatabase(database.handle, database.filename)),
    );
    return results.flatMap((result) => (result.status === "fulfilled" ? [result.value] : []));
}

async function getDatabase(file: DatabaseHandle, _filename: string): Promise<ManagedDatabaseInfo> {
    return { type: "success", ...(await tauri.getDbInfo(file)), file };
}

export function useDefaultDatabases(opened: boolean) {
    const { data, error, isLoading } = useSWR(opened ? "default-dbs" : null, async () => {
        return await getDefaultDatabases();
    });
    return {
        defaultDatabases: data,
        error,
        isLoading,
    };
}

export async function getDefaultDatabases(): Promise<DownloadableDatabaseInfo[]> {
    return await remoteHttp.get("https://www.encroissant.org/databases", {
        schema: downloadableDatabaseManifestSchema,
    });
}

export async function getDefaultPuzzleDatabases(): Promise<DownloadablePuzzleDatabase[]> {
    return await remoteHttp.get("https://www.encroissant.org/puzzle_databases", {
        schema: z.array(downloadablePuzzleDatabaseSchema),
    });
}

export interface Opening {
    move: string;
    white: number;
    black: number;
    draw: number;
}

export async function getTournamentGames(file: DatabaseHandle, id: number) {
    return await query_games(file, {
        options: {
            direction: "asc",
            sort: "id",
            skipCount: true,
        },
        tournament_id: id,
    });
}

export async function searchPosition(options: LocalOptions, tab: string) {
    return await tauri.searchPosition(
        options.path!,
        {
            player1: options.color === "white" ? options.player : undefined,
            player2: options.color === "black" ? options.player : undefined,
            position: {
                fen: options.fen,
                type_: options.type,
            },
            start_date: options.start_date,
            end_date: options.end_date,
            wanted_result: options.result,
        },
        tab,
    );
}
