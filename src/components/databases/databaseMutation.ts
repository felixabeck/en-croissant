import type { DatabaseHandle, FileWorkspaceHandle } from "@/bindings";
import type { SuccessDatabaseInfo } from "@/utils/db";
import { databaseHandleKey, sameDatabaseHandle } from "@/utils/db";
import { runDestructiveWithRefresh } from "@/platform/errors";
import { runUnlessCancelled } from "@/components/files/notifyError";

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
    convertPgn: (files: FileWorkspaceHandle[], dest: DatabaseHandle) => Promise<unknown>;
    dest: DatabaseHandle;
    notifyTitle: string;
    begin: (sourceFileName: string) => void;
    finish: () => void;
}): Promise<void> {
    await runUnlessCancelled(args.notifyTitle, async () => {
        const selected = await args.pickPgnFile();
        if (!selected) return;
        args.begin(selected.name);
        try {
            await args.convertPgn([selected.handle], args.dest);
        } finally {
            args.finish();
        }
    });
}
