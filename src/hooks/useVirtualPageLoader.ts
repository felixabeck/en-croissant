import { useCallback, useEffect, useRef } from "react";

/**
 * Shared virtual-list loading contract.  A path change invalidates every
 * outstanding response; concurrent requests for the same range share work.
 */
export function useVirtualPageLoader<T>(
    identity: string,
    load: (start: number, end: number) => Promise<readonly T[]>,
    merge: (start: number, values: readonly T[]) => void,
) {
    const generation = useRef(0);
    const pending = useRef(new Map<string, Promise<void>>());
    const loadRef = useRef(load);
    const mergeRef = useRef(merge);
    loadRef.current = load;
    mergeRef.current = merge;

    useEffect(() => {
        const pendingRequests = pending.current;
        generation.current += 1;
        pendingRequests.clear();
        return () => {
            // Native PGN reads do not expose an AbortSignal yet.  This invalidates
            // their completion at the UI boundary on both a path switch and unmount.
            generation.current += 1;
            pendingRequests.clear();
        };
    }, [identity]);

    return useCallback(async (start: number, end: number) => {
        if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end < start) return;
        const key = `${generation.current}:${start}:${end}`;
        const existing = pending.current.get(key);
        if (existing) return existing;
        const current = generation.current;
        const request = loadRef
            .current(start, end)
            .then((values) => {
                if (generation.current === current) mergeRef.current(start, values);
            })
            .finally(() => pending.current.delete(key));
        pending.current.set(key, request);
        return request;
    }, []);
}
