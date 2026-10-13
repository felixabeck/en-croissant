import type { DatabaseHandle, FileWorkspaceHandle } from "@/bindings";
import type { SuccessDatabaseInfo } from "@/utils/db";
import { databaseHandleKey, sameDatabaseHandle } from "@/utils/db";
import { runDestructiveWithRefresh } from "@/platform/errors";
import { runUnlessCancelled } from "@/components/files/notifyError";
import { type Arguments, type Cache, type ScopedMutator, unstable_serialize } from "swr";

/** Refresh the admitted database's game, player and tournament queries after a game mutation.
 * Results are bounded by the original keys collected from this cache for this operation. */
export async function refreshDatabaseGameQueries(
    file: DatabaseHandle,
    cache: Cache,
    mutate: ScopedMutator,
): Promise<PromiseSettledResult<unknown>[]> {
    const keys: Arguments[] = [];
    // The public matcher exposes original keys. Returning false only observes the cache.
    await mutate((key) => {
        if (
            Array.isArray(key) &&
            (key[0] === "games" || key[0] === "players" || key[0] === "tournaments") &&
            sameDatabaseHandle(key[1] as DatabaseHandle, file)
        ) {
            keys.push(key);
        }
        return false;
    });
    return Promise.allSettled(
        keys.map(async (key) => {
            // With no data argument, mutate awaits revalidation. Fetch errors live in cache
            // state even when mutate resolves with the previous data.
            const data = await mutate(key);
            const error = cache.get(unstable_serialize(key))?.error;
            if (error !== undefined) throw error;
            return data;
        }),
    );
}

export type DatabaseRemovalState = {
    selected: string | null;
    reference: DatabaseHandle | null;
    active?: SuccessDatabaseInfo;
};

/** Clears every renderer state slot that could still target a deleted capability. */
export function invalidateDeletedDatabase(
    deleted: DatabaseHandle,
    state: DatabaseRemovalState,
): DatabaseRemovalState {
    return {
        selected: state.selected === databaseHandleKey(deleted) ? null : state.selected,
        reference: sameDatabaseHandle(state.reference, deleted) ? null : state.reference,
        active: sameDatabaseHandle(state.active?.file, deleted) ? undefined : state.active,
    };
}

/** Native deletion is the commit point. Renderer state is cleared after success
 * and after `applied-despite-error`, because that category means the primary
 * was already destroyed even though the command rejected. */
export async function deleteDatabaseAndInvalidate(
    deleted: DatabaseHandle,
    remove: (database: DatabaseHandle) => Promise<unknown>,
    invalidate: (database: DatabaseHandle) => void,
): Promise<void> {
    await runDestructiveWithRefresh(
        () => remove(deleted),
        () => invalidate(deleted),
    );
}

export async function runPgnExport(args: {
    issueDestination: () => Promise<{ handle: FileWorkspaceHandle }>;
    exportToPgn: (file: DatabaseHandle, handle: FileWorkspaceHandle) => Promise<unknown>;
    file: DatabaseHandle;
    notifyTitle: string;
    setLoading: (loading: boolean) => void;
}): Promise<void> {
    args.setLoading(true);
    try {
        await runUnlessCancelled(args.notifyTitle, async () => {
            const destination = await args.issueDestination();
            await args.exportToPgn(args.file, destination.handle);
        });
    } finally {
        args.setLoading(false);
    }
}

export async function runAddGamesToDatabase(args: {
    pickPgnFile: () => Promise<{ handle: FileWorkspaceHandle; name: string } | null>;
    convertPgn: (
        progressId: string,
        files: FileWorkspaceHandle[],
        dest: DatabaseHandle,
    ) => Promise<unknown>;
    dest: DatabaseHandle;
    notifyTitle: string;
    runConversion: (
        sourceFileName: string,
        convert: (progressId: string) => Promise<void>,
    ) => Promise<void>;
}): Promise<void> {
    await runUnlessCancelled(args.notifyTitle, async () => {
        const selected = await args.pickPgnFile();
        if (!selected) return;
        await args.runConversion(selected.name, async (progressId) => {
            await args.convertPgn(progressId, [selected.handle], args.dest);
        });
    });
}
