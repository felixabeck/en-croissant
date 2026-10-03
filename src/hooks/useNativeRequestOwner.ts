import { useCallback, useEffect, useRef } from "react";
import { type Key, unstable_serialize, useSWRConfig } from "swr";

type RequestGeneration = {
    controller: AbortController;
    superseded: AbortController;
    abandoned: boolean;
    promise: Promise<unknown>;
};
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
    supersede: () => Promise<void>;
};

/** Drain the SWR-facing promises before a new root can start revalidating. */
async function supersedeRequest(cache: object, identity: string): Promise<void> {
    const shared = requestsByCache.get(cache)?.get(identity);
    if (!shared) return;
    const generations = Array.from(shared.generations);
    shared.generations.clear();
    for (const generation of generations) {
        generation.controller.abort();
        generation.superseded.abort();
    }
    await Promise.allSettled(generations.map((generation) => generation.promise));
}

/** Observes only live generations without starting or sharing a revalidation fetch. */
export function runningNativeRequest(cache: object, key: Key): Promise<void> | undefined {
    const shared = requestsByCache.get(cache)?.get(unstable_serialize(key));
    if (!shared) return undefined;
    const live = Array.from(shared.generations).filter((generation) => !generation.abandoned);
    if (live.length === 0) return undefined;
    return Promise.allSettled(live.map((generation) => generation.promise)).then(() => undefined);
}

export function hasNativeRequestSubscribers(cache: object, key: Key): boolean {
    return (requestsByCache.get(cache)?.get(unstable_serialize(key))?.subscribers.size ?? 0) > 0;
}

/**
 * Shares live generations. When the final committed subscriber leaves, cooperative work is
 * aborted and generations are marked abandoned; SWR can still rejoin their original promises
 * on remount. A new run never joins abandoned work: before starting a fresh generation it
 * retires abandoned generations, rejecting their subscribers with cancellation at once and
 * dropping later outcomes. Explicit supersession does the same for every generation.
 *
 * On explicit revalidation, SWR's unchecked catch can record the retired generation's silent
 * cancellation while the fresh fetch is pending. It cannot follow the fresh outcome because
 * retirement happens before fresh work starts.
 *
 * Abandoned generations are retained per identity only until they settle, a new generation
 * starts, or the identity is superseded: at most the generations running when the final
 * subscriber left. Identities are the request keys of the session. Entries are deleted when
 * both their subscribers and generations are gone.
 */
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
                for (const generation of request.generations) {
                    generation.abandoned = true;
                    generation.controller.abort();
                }
                if (request.generations.size === 0) {
                    const requests = requestsFor(cache);
                    if (requests.get(identity) === request) requests.delete(identity);
                }
            });
        };
    }, [cache, identity]);

    const run = useCallback(
        <T>(request: (signal: AbortSignal) => Promise<T>): Promise<T> => {
            if (identity === null)
                return Promise.reject(new DOMException("Cancellation", "AbortError"));
            const shared = requestFor(cache, identity);
            const current = Array.from(shared.generations).find(
                (generation) => !generation.abandoned,
            );
            if (current) return current.promise as Promise<T>;
            for (const generation of shared.generations) {
                generation.superseded.abort();
                shared.generations.delete(generation);
            }
            const controller = new AbortController();
            // Supersession and retirement before a new run settle deliveries at once. Final-owner
            // cleanup only aborts cooperative work so SWR can rejoin its promise on remount.
            const superseded = new AbortController();
            let onAbort!: () => void;
            const cancelled = new Promise<never>((_resolve, reject) => {
                onAbort = () => reject(new DOMException("Cancellation", "AbortError"));
                superseded.signal.addEventListener("abort", onAbort, { once: true });
            });
            const work = Promise.resolve().then(() => request(controller.signal));
            const generation: RequestGeneration = {
                controller,
                superseded,
                abandoned: false,
                promise: Promise.race([work, cancelled]).finally(() => {
                    superseded.signal.removeEventListener("abort", onAbort);
                    shared.generations.delete(generation);
                    if (shared.subscribers.size === 0 && shared.generations.size === 0) {
                        const requests = requestsFor(cache);
                        if (requests.get(identity) === shared) requests.delete(identity);
                    }
                }),
            };
            shared.generations.add(generation);
            return generation.promise as Promise<T>;
        },
        [cache, identity],
    );

    const supersede = useCallback(async () => {
        if (identity !== null) await supersedeRequest(cache, identity);
    }, [cache, identity]);
    return identity === null ? null : { run, supersede };
}
