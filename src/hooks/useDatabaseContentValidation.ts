import { useCallback } from "react";
import { type Arguments, unstable_serialize, useSWRConfig } from "swr";
import type { DatabaseContentFailure } from "@/bindings";
import { notifyListenerError } from "@/components/files/notifyError";
import { hasNativeRequestSubscribers, runningNativeRequest } from "@/hooks/useNativeRequestOwner";
import { tauriSubscriptions } from "@/platform/tauri";
import { useTauriListener } from "@/platform/useTauriListener";

export function useDatabaseContentValidation() {
    const { cache, mutate } = useSWRConfig();
    const subscribe = useCallback(
        (listener: (event: { payload: DatabaseContentFailure }) => void) =>
            tauriSubscriptions.databaseContentFailure(listener),
        [],
    );
    useTauriListener(
        subscribe,
        async (_event, signal) => {
            // SWR's public matcher supplies original keys, including every Home session key.
            // Matching nothing observes keys without mutating or revalidating them.
            const keys: Arguments[] = ["databases"];
            await mutate((key) => {
                if (Array.isArray(key) && key[0] === "personalDatabases") keys.push(key);
                return false;
            });
            await Promise.all(
                keys.map(async (key) => {
                    await runningNativeRequest(cache, key);
                    if (signal.aborted) return;
                    if (hasNativeRequestSubscribers(cache, key)) {
                        await mutate(key);
                    } else {
                        // Public revalidation clears SWR's completed-fetch dedupe marker.
                        await mutate(key);
                        if (!signal.aborted && !hasNativeRequestSubscribers(cache, key)) {
                            cache.delete(unstable_serialize(key));
                        }
                    }
                }),
            );
        },
        { onError: notifyListenerError },
    );
}
