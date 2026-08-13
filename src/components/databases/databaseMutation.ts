import type { DatabaseHandle } from "@/bindings";
import type { SuccessDatabaseInfo } from "@/utils/db";
import { databaseHandleKey, sameDatabaseHandle } from "@/utils/db";

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

/** Native deletion is the commit point; renderer state changes only after it succeeds. */
export async function deleteDatabaseAndInvalidate(
    deleted: DatabaseHandle,
    remove: (database: DatabaseHandle) => Promise<unknown>,
    invalidate: (database: DatabaseHandle) => void,
): Promise<void> {
    await remove(deleted);
    invalidate(deleted);
}
