import { useCallback, useEffect, useRef } from "react";
import { unstable_serialize, useSWRConfig } from "swr";

type RequestGeneration = { controller: AbortController; promise: Promise<unknown> };
type SharedRequest = {
    subscribers: Set<symbol>;
    generations: Set<RequestGeneration>;
};

const requestsByCache = new WeakMap<object, Map<string, SharedRequest>>();

function requestsFor(cache: object): Map<string, SharedRequest> {
    let requests = requestsByCache.get(cache);
    if (!requests) {
        requests = new Map();
        requestsByCache.set(cache, requests);
    }
    return requests;
}

function requestFor(cache: object, identity: string): SharedRequest {
    const requests = requestsFor(cache);
    let request = requests.get(identity);
    if (!request) {
        request = { subscribers: new Set(), generations: new Set() };
        requests.set(identity, request);
    }
    return request;
}

export type NativeRequestOwner = {
    run: <T>(request: (signal: AbortSignal) => Promise<T>) => Promise<T>;
};

/** Shares each actual SWR fetch generation until its final committed subscriber leaves. */
export function useNativeRequestOwner(key: unknown | null): NativeRequestOwner | null {
    const { cache } = useSWRConfig();
    const identity = key === null ? null : unstable_serialize(key);
    const subscriber = useRef(Symbol("native-request-subscriber"));

    useEffect(() => {
        if (identity === null) return;
        const request = requestFor(cache, identity);
        const subscriberId = subscriber.current;
        request.subscribers.add(subscriberId);
        return () => {
            request.subscribers.delete(subscriberId);
            // StrictMode replays effects synchronously; defer final cancellation so its committed
            // replacement can retain the same in-flight generation.
            queueMicrotask(() => {
                if (request.subscribers.size !== 0) return;
                for (const generation of request.generations) generation.controller.abort();
                request.generations.clear();
                const requests = requestsFor(cache);
                if (requests.get(identity) === request) requests.delete(identity);
            });
        };
    }, [cache, identity]);

    const run = useCallback(
        async <T>(request: (signal: AbortSignal) => Promise<T>): Promise<T> => {
            if (identity === null) throw new DOMException("Cancellation", "AbortError");
            const shared = requestFor(cache, identity);
            const current = shared.generations.values().next().value as
                | RequestGeneration
                | undefined;
            if (current) return current.promise as Promise<T>;
            const controller = new AbortController();
            const generation: RequestGeneration = {
                controller,
                promise: Promise.resolve().then(() => request(controller.signal)),
            };
            shared.generations.add(generation);
            try {
                return (await generation.promise) as T;
            } finally {
                shared.generations.delete(generation);
                if (shared.subscribers.size === 0 && shared.generations.size === 0) {
                    const requests = requestsFor(cache);
                    if (requests.get(identity) === shared) requests.delete(identity);
                }
            }
        },
        [cache, identity],
    );

    return identity === null ? null : { run };
}
