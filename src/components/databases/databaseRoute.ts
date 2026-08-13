import type { SuccessDatabaseInfo } from "@/utils/db";
import { databaseHandleKey, sameDatabaseHandle, type ManagedDatabaseInfo } from "@/utils/db";

export type DatabaseRouteResolution =
    | { status: "loading" }
    | { status: "not_found" }
    | { status: "synchronizing"; database: SuccessDatabaseInfo }
    | { status: "ready"; database: SuccessDatabaseInfo };

/**
 * The URL capability key is authoritative. A persisted view store is merely a
 * cache and must finish synchronizing before database children may render.
 */
export function resolveDatabaseRoute(
    databases: readonly ManagedDatabaseInfo[] | undefined,
    routeKey: string,
    active: SuccessDatabaseInfo | undefined,
): DatabaseRouteResolution {
    if (!databases) return { status: "loading" };
    const database = databases.find(
        (candidate): candidate is SuccessDatabaseInfo =>
            candidate.type === "success" && databaseHandleKey(candidate.file) === routeKey,
    );
    if (!database) return { status: "not_found" };
    return sameDatabaseHandle(database.file, active?.file)
        ? { status: "ready", database }
        : { status: "synchronizing", database };
}
