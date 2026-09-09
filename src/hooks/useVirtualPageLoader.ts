import { useCallback, useEffect, useRef } from "react";
import { normalizeError } from "@/platform/errors";

/**
 * Shared virtual-list loading contract. A path change invalidates every
 * outstanding response; concurrent requests for the same range share work.
 */
export function useVirtualPageLoader<T>(
    identity: string,
    load: (start: number, end: number, options?: { signal?: AbortSignal }) => Promise<readonly T[]>,
    merge: (start: number, values: readonly T[]) => void,
) {
    const generation = useRef(0);
    const pending = useRef(new Map<string, Promise<void>>());
    const controllers = useRef(new Map<string, AbortController>());
    const loadRef = useRef(load);
    const mergeRef = useRef(merge);
    loadRef.current = load;
    mergeRef.current = merge;

    useEffect(() => {
        const pendingControllers = controllers.current;
        const pendingRequests = pending.current;
        generation.current += 1;
        for (const controller of pendingControllers.values()) {
            controller.abort();
        }
        pendingControllers.clear();
        pendingRequests.clear();
        return () => {
            generation.current += 1;
            for (const controller of pendingControllers.values()) {
                controller.abort();
            }
            pendingControllers.clear();
            pendingRequests.clear();
        };
    }, [identity]);

    return useCallback((start: number, end: number) => {
        if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end < start) return;
        const key = `${start}:${end}`;
        const existing = pending.current.get(key);
        if (existing) return existing;
        const current = generation.current;
        const controller = new AbortController();
        controllers.current.set(key, controller);
        const request = loadRef
            .current(start, end, { signal: controller.signal })
            .then((values) => {
                if (generation.current === current && !controller.signal.aborted) {
                    mergeRef.current(start, values);
                }
            })
            .catch((error) => {
                const appError = normalizeError(error);
                if (appError.category !== "cancelled") {
                    throw error;
                }
            })
            .finally(() => {
                if (generation.current === current && controllers.current.get(key) === controller) {
                    controllers.current.delete(key);
                }
                if (generation.current === current && pending.current.get(key) === request) {
                    pending.current.delete(key);
                }
            });
        pending.current.set(key, request);
        return request;
    }, []);
}
