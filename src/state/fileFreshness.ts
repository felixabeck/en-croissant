import { useSyncExternalStore } from "react";
import type { FileWorkspaceHandle } from "@/bindings";
import { normalizeError } from "@/platform/errors";
import { fileWorkspaceKey } from "@/utils/pathCapabilities";
import type { Tab } from "@/utils/tabs";

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
    errorMessage: string | null;
    epoch: number;
};

type FreshnessUpdate = {
    verifiedRevision?: string | null;
    conflictReason?: FileConflictReason | null;
    errorMessage?: string | null;
};

const initialEntry: FileFreshnessEntry = Object.freeze({
    state: "unverified",
    verifiedRevision: null,
    conflictReason: null,
    errorMessage: null,
    epoch: 0,
});

const entries = new Map<string, FileFreshnessEntry>();
const subscribers = new Map<string, Set<() => void>>();
type FilePollOutcome =
    | { kind: "revision"; revision: string }
    | { kind: "rejected"; unavailable: boolean; message: string }
    | { kind: "overdue" };

const pendingPollOutcomes = new Map<string, FilePollOutcome>();

const FILE_REVISION_INTERVAL_MS = 2_000;
const FILE_REVISION_DEADLINE_MS = 2_000;

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
    const settledAppend = previous.state === "appending" && state !== "appending";
    const next: FileFreshnessEntry = {
        state,
        verifiedRevision:
            update.verifiedRevision !== undefined
                ? update.verifiedRevision
                : state === "verified"
                  ? previous.verifiedRevision
                  : null,
        conflictReason: state === "conflict" ? (update.conflictReason ?? "changed") : null,
        errorMessage: update.errorMessage ?? null,
        epoch: previous.epoch + 1,
    };
    entries.set(tabId, next);
    for (const listener of subscribers.get(tabId) ?? []) listener();
    if (settledAppend) {
        const pending = pendingPollOutcomes.get(tabId);
        pendingPollOutcomes.delete(tabId);
        if (pending) return applyFilePollOutcome(tabId, pending);
    }
    return next;
}

function setFileFreshnessErrorMessage(tabId: string, errorMessage: string): FileFreshnessEntry {
    const previous = getFileFreshness(tabId);
    if (previous.errorMessage === errorMessage) return previous;
    const next = { ...previous, errorMessage };
    entries.set(tabId, next);
    for (const listener of subscribers.get(tabId) ?? []) listener();
    return next;
}

export function removeFileFreshness(tabId: string): void {
    entries.delete(tabId);
    pendingPollOutcomes.delete(tabId);
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

type FileRevisionPollDependencies = {
    getTabs: () => readonly Tab[];
    fileRevision: (
        handle: FileWorkspaceHandle,
        options: { signal: AbortSignal },
    ) => Promise<string>;
    subscribeFocus: (callback: () => void) => Promise<() => void> | (() => void);
};

type FileRevisionFlight = {
    controller: AbortController;
    deadline: ReturnType<typeof setTimeout> | null;
    rerunAfterSettle: boolean;
    timedOut: boolean;
};

/** Starts the one app-level file revision poll. The returned owner clears every timer and
 * aborts each outstanding native read when the root route unmounts. */
export function startFileRevisionPoll(dependencies: FileRevisionPollDependencies): () => void {
    let running = true;
    let focusCleanup: (() => void) | null = null;
    const flights = new Map<string, FileRevisionFlight>();

    const fileTabs = () =>
        dependencies.getTabs().flatMap((tab) => {
            const origin = tab.gameOrigin;
            if (origin.kind !== "file" && origin.kind !== "temp_file") return [];
            return [
                {
                    tabId: tab.value,
                    handle: origin.file.handle,
                    key: fileWorkspaceKey(origin.file.handle),
                },
            ];
        });

    const applyOutcome = (key: string, outcome: FilePollOutcome) => {
        for (const tab of fileTabs()) {
            if (tab.key !== key) continue;
            applyFilePollOutcome(tab.tabId, outcome);
        }
    };

    const runForHandle = (key: string, handle: FileWorkspaceHandle) => {
        if (!running) return;
        const existing = flights.get(key);
        if (existing) {
            existing.rerunAfterSettle = true;
            return;
        }
        const flight: FileRevisionFlight = {
            controller: new AbortController(),
            deadline: null,
            rerunAfterSettle: false,
            timedOut: false,
        };
        flights.set(key, flight);
        flight.deadline = setTimeout(() => {
            if (!running || flights.get(key) !== flight || flight.timedOut) return;
            flight.timedOut = true;
            flight.controller.abort();
            flight.deadline = null;
            applyOutcome(key, { kind: "overdue" });
        }, FILE_REVISION_DEADLINE_MS);

        void Promise.resolve()
            .then(() => dependencies.fileRevision(handle, { signal: flight.controller.signal }))
            .then((revision) => {
                if (!flight.timedOut) applyOutcome(key, { kind: "revision", revision });
            })
            .catch((error: unknown) => {
                if (flight.timedOut) return;
                const normalized = normalizeError(error);
                applyOutcome(key, {
                    kind: "rejected",
                    unavailable:
                        normalized.backendCategory === "missing-resource" ||
                        normalized.backendCategory === "conflict",
                    message: normalized.message,
                });
            })
            .finally(() => {
                if (flight.deadline !== null) clearTimeout(flight.deadline);
                if (flights.get(key) === flight) flights.delete(key);
                if (!running || (!flight.timedOut && !flight.rerunAfterSettle)) return;
                const nextHandle = fileTabs().find((tab) => tab.key === key)?.handle;
                if (nextHandle) runForHandle(key, nextHandle);
            });
    };

    const tick = () => {
        if (!running) return;
        const handles = new Map<string, FileWorkspaceHandle>();
        for (const tab of fileTabs()) handles.set(tab.key, tab.handle);
        for (const [key, handle] of handles) runForHandle(key, handle);
    };

    const interval = setInterval(tick, FILE_REVISION_INTERVAL_MS);
    try {
        void Promise.resolve(dependencies.subscribeFocus(tick))
            .then((unsubscribe) => {
                if (running) focusCleanup = unsubscribe;
                else unsubscribe();
            })
            .catch((error: unknown) => {
                console.error("File freshness focus listener failed", normalizeError(error));
            });
    } catch (error) {
        console.error("File freshness focus listener failed", normalizeError(error));
    }

    return () => {
        if (!running) return;
        running = false;
        clearInterval(interval);
        focusCleanup?.();
        focusCleanup = null;
        for (const flight of flights.values()) {
            if (flight.deadline !== null) clearTimeout(flight.deadline);
            flight.deadline = null;
            flight.controller.abort();
        }
        pendingPollOutcomes.clear();
    };
}

function applyFilePollOutcome(tabId: string, outcome: FilePollOutcome): FileFreshnessEntry {
    const current = getFileFreshness(tabId);
    if (current.state === "appending") {
        pendingPollOutcomes.set(tabId, outcome);
        return current;
    }
    if (outcome.kind === "overdue") {
        if (current.state === "verified" || current.state === "unverified") {
            return setFileFreshness(tabId, "overdue");
        }
        return current;
    }
    if (outcome.kind === "rejected") {
        if (outcome.unavailable) {
            if (current.state === "unavailable") return current;
            return setFileFreshness(tabId, "unavailable", { errorMessage: outcome.message });
        }
        if (current.state === "verified" || current.state === "overdue") {
            return setFileFreshness(tabId, "unverified", { errorMessage: outcome.message });
        }
        if (current.state === "unverified") {
            return setFileFreshnessErrorMessage(tabId, outcome.message);
        }
        return current;
    }
    if (current.state === "verified") {
        if (outcome.revision === current.verifiedRevision) return current;
        return setFileFreshness(tabId, "unverified");
    }
    if (current.state === "overdue") return setFileFreshness(tabId, "unverified");
    return current;
}
