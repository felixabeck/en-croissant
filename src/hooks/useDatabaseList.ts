import useSWR, { type ScopedMutator, type SWRConfiguration } from "swr";
import { listingFailure } from "@/components/files/listingFailure";
import { type NativeRequestOwner, useNativeRequestOwner } from "@/hooks/useNativeRequestOwner";
import { getDatabases } from "@/utils/db";
import { getDefaultStore } from "jotai";
import {
    fileWorkspaceAtom,
    referenceDbAtom,
    reconcileReferenceCollectionAtom,
} from "@/state/atoms";

export const DATABASE_LIST_KEY = "databases" as const;
export const DATABASE_LIST_MAX_RETRIES = 3;

let latestReferenceListing: object | undefined;

export function fetchDatabaseList(owner: NativeRequestOwner) {
    return owner.run(async (signal) => {
        const listing = {};
        latestReferenceListing = listing;
        const store = getDefaultStore();
        const workspace = store.get(fileWorkspaceAtom);
        const reference = store.get(referenceDbAtom);
        const result = await getDatabases({ signal });
        if (!signal.aborted && latestReferenceListing === listing && result.collections) {
            store.set(reconcileReferenceCollectionAtom, {
                workspace,
                reference,
                collections: result.collections,
            });
        }
        return result;
    });
}

export async function refreshDatabaseList(owner: NativeRequestOwner, mutate: ScopedMutator) {
    await owner.supersede();
    return mutate(DATABASE_LIST_KEY, fetchDatabaseList(owner));
}

export async function revalidateDatabaseList(owner: NativeRequestOwner, mutate: ScopedMutator) {
    await owner.supersede();
    return mutate(DATABASE_LIST_KEY);
}

export const databaseListRetry: NonNullable<SWRConfiguration["onErrorRetry"]> = (
    error,
    _key,
    config,
    revalidate,
    { retryCount },
) => {
    // Keep SWR's backoff for transient failures and bound it to three retries.
    if (listingFailure(error) !== "retry" || retryCount > DATABASE_LIST_MAX_RETRIES) return;
    const delay =
        ~~((Math.random() + 0.5) * (1 << (retryCount < 8 ? retryCount : 8))) *
        config.errorRetryInterval;
    setTimeout(() => void revalidate({ retryCount }), delay);
};

export function useDatabaseList(enabled = true) {
    const owner = useNativeRequestOwner(enabled ? DATABASE_LIST_KEY : null);
    const swr = useSWR(enabled ? DATABASE_LIST_KEY : null, () => fetchDatabaseList(owner!), {
        onErrorRetry: databaseListRetry,
    });
    return Object.assign(swr, { owner });
}
