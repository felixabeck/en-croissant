import type { useSWRConfig } from "swr";
import type { FileWorkspaceHandle } from "@/bindings";
import { hasNativeRequestSubscribers, supersedeNativeRequest } from "@/hooks/useNativeRequestOwner";
import { tauri } from "@/platform/tauri";

export type WorkspaceListingCache = Pick<ReturnType<typeof useSWRConfig>, "cache" | "mutate">;

export function workspaceListingKey(workspace: FileWorkspaceHandle) {
    return ["file-workspace", workspace] as const;
}

/** Reconcile once in the submitting workspace's cache without recovering a created object. */
export async function reconcileWorkspaceListing(
    workspace: FileWorkspaceHandle,
    { cache, mutate }: WorkspaceListingCache,
): Promise<void> {
    const key = workspaceListingKey(workspace);
    await supersedeNativeRequest(cache, key);
    const active = hasNativeRequestSubscribers(cache, key);
    // Public revalidation clears SWR's deduplication slot as well as fencing old deliveries.
    // Active readers run their native fetcher once. Inactive keys remain empty for next mount.
    await mutate(key, undefined, { revalidate: true });
    if (!active) await tauri.listFileWorkspace(workspace);
}
