import { useSyncExternalStore } from "react";

export type FileFreshnessState =
    | "unverified"
    | "overdue"
    | "appending"
    | "verified"
    | "conflict"
    | "unavailable";

export type FileConflictReason = "changed" | "save-refused";

export type FileFreshnessEntry = {
    state: FileFreshnessState;
    verifiedRevision: string | null;
    conflictReason: FileConflictReason | null;
    epoch: number;
};

type FreshnessUpdate = {
    verifiedRevision?: string | null;
    conflictReason?: FileConflictReason | null;
};

const initialEntry: FileFreshnessEntry = Object.freeze({
    state: "unverified",
    verifiedRevision: null,
    conflictReason: null,
    epoch: 0,
});

const entries = new Map<string, FileFreshnessEntry>();
const subscribers = new Map<string, Set<() => void>>();

export function getFileFreshness(tabId: string): FileFreshnessEntry {
    return entries.get(tabId) ?? initialEntry;
}

export function subscribeFileFreshness(tabId: string, listener: () => void): () => void {
    let listeners = subscribers.get(tabId);
    if (!listeners) {
        listeners = new Set();
        subscribers.set(tabId, listeners);
    }
    listeners.add(listener);
    return () => {
        listeners?.delete(listener);
        if (listeners?.size === 0) subscribers.delete(tabId);
    };
}

export function setFileFreshness(
    tabId: string,
    state: FileFreshnessState,
    update: FreshnessUpdate = {},
): FileFreshnessEntry {
    const previous = getFileFreshness(tabId);
    const next: FileFreshnessEntry = {
        state,
        verifiedRevision:
            update.verifiedRevision !== undefined
                ? update.verifiedRevision
                : state === "verified"
                  ? previous.verifiedRevision
                  : null,
        conflictReason: state === "conflict" ? (update.conflictReason ?? "changed") : null,
        epoch: previous.epoch + 1,
    };
    entries.set(tabId, next);
    for (const listener of subscribers.get(tabId) ?? []) listener();
    return next;
}

export function removeFileFreshness(tabId: string): void {
    entries.delete(tabId);
    conflictSaveActions.delete(tabId);
    for (const listener of subscribers.get(tabId) ?? []) listener();
}

export function useFileFreshness(tabId: string): FileFreshnessEntry {
    return useSyncExternalStore(
        (listener) => subscribeFileFreshness(tabId, listener),
        () => getFileFreshness(tabId),
        () => initialEntry,
    );
}

type ReconcileFlight = {
    controller: AbortController;
    rerun: (() => void) | null;
};

const reconcileFlights = new Map<string, ReconcileFlight>();
const conflictSaveActions = new Map<string, () => Promise<boolean>>();

export function registerFileConflictSave(
    tabId: string,
    action: () => Promise<boolean>,
): () => void {
    conflictSaveActions.set(tabId, action);
    return () => {
        if (conflictSaveActions.get(tabId) === action) conflictSaveActions.delete(tabId);
    };
}

export async function saveFileConflictVersion(tabId: string): Promise<boolean> {
    const action = conflictSaveActions.get(tabId);
    return action ? action() : false;
}

/** Keeps at most one native reconcile read outstanding for a tab, even after abort. */
export function requestFileReconcile(
    tabId: string,
    reconcile: (signal: AbortSignal) => Promise<void>,
): () => void {
    let active = true;
    let ownedFlight: ReconcileFlight | null = null;

    const request = () => {
        if (!active) return;
        const current = reconcileFlights.get(tabId);
        if (current) {
            current.rerun = request;
            return;
        }

        const flight: ReconcileFlight = {
            controller: new AbortController(),
            rerun: null,
        };
        ownedFlight = flight;
        reconcileFlights.set(tabId, flight);
        void Promise.resolve(reconcile(flight.controller.signal))
            .catch(() => undefined)
            .finally(() => {
                if (reconcileFlights.get(tabId) !== flight) return;
                reconcileFlights.delete(tabId);
                const rerun = flight.rerun;
                if (rerun) queueMicrotask(rerun);
            });
    };

    request();
    return () => {
        active = false;
        const current = reconcileFlights.get(tabId);
        if (current?.rerun === request) current.rerun = null;
        if (ownedFlight && current === ownedFlight) ownedFlight.controller.abort();
    };
}

export function pendingFileReconcileCount(): number {
    return reconcileFlights.size;
}
