import useSWR, { type SWRConfiguration } from "swr";
import { listingFailure } from "@/components/files/listingFailure";
import { type NativeRequestOwner, useNativeRequestOwner } from "@/hooks/useNativeRequestOwner";
import { getDatabases } from "@/utils/db";

export const DATABASE_LIST_KEY = "databases" as const;
export const DATABASE_LIST_MAX_RETRIES = 3;
export const DATABASE_LIST_RETRY_BASE_MS = 1000;

export function fetchDatabaseList(owner: NativeRequestOwner) {
    return owner.run((signal) => getDatabases({ signal }));
}

export const databaseListRetry: NonNullable<SWRConfiguration["onErrorRetry"]> = (
    error,
    _key,
    _config,
    revalidate,
    { retryCount },
) => {
    // Only transient failures retry, at most three times per failed listing.
    if (listingFailure(error) !== "retry" || retryCount > DATABASE_LIST_MAX_RETRIES) return;
    const delay = DATABASE_LIST_RETRY_BASE_MS * 2 ** retryCount;
    setTimeout(() => void revalidate({ retryCount }), delay);
};

export function useDatabaseList(enabled = true) {
    const owner = useNativeRequestOwner(enabled ? DATABASE_LIST_KEY : null);
    const swr = useSWR(enabled ? DATABASE_LIST_KEY : null, () => fetchDatabaseList(owner!), {
        onErrorRetry: databaseListRetry,
    });
    return Object.assign(swr, { owner });
}
