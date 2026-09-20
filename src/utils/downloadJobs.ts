import { useSyncExternalStore } from "react";
import { notifyUnlessCancelled } from "@/components/files/notifyError";
import { errorUnlessCancelled } from "@/platform/errors";
import { cancellationError, tauri, withDownloadTicket } from "@/platform/tauri";
import { warn } from "@/platform/native";

export class DownloadCancelLostError extends Error {
    constructor() {
        super("the download already completed");
        this.name = "DownloadCancelLostError";
    }
}

export class DownloadCancelRequestError extends Error {
    readonly cause: unknown;

    constructor(cause: unknown) {
        super("download cancellation could not be delivered");
        this.name = "DownloadCancelRequestError";
        this.cause = cause;
    }
}

export class DownloadJobAlreadyRunningError extends Error {
    constructor() {
        super("a download is already running for this progress id");
        this.name = "DownloadJobAlreadyRunningError";
    }
}

type CancelOutcome = { clearedGeneration: bigint | null };

type DownloadJobEntry = {
    cancelRequested: boolean;
    started: boolean;
    ticket: Promise<string>;
    resolveTicket: (ticket: string) => void;
    rejectTicket: (error: unknown) => void;
    settlement: Promise<unknown>;
    clearedGeneration: bigint | null;
};

const jobs = new Map<string, DownloadJobEntry>();
const subscribers = new Set<() => void>();

function publish() {
    for (const subscriber of subscribers) subscriber();
}

function isCancellation(error: unknown): boolean {
    return errorUnlessCancelled(error) === null;
}

export async function clearDownloadProgress(progressId: string): Promise<bigint | null> {
    try {
        return await tauri.clearProgress(progressId);
    } catch (error) {
        try {
            await warn(`download progress cleanup failed (${progressId}): ${String(error)}`);
        } catch {
            // Progress cleanup is best effort and must not replace the download result.
        }
        return null;
    }
}

export function runDownloadJob<T>(
    progressId: string,
    run: (ticket: string) => Promise<T>,
): Promise<T> {
    if (jobs.has(progressId)) throw new DownloadJobAlreadyRunningError();

    let resolveTicket!: (ticket: string) => void;
    let rejectTicket!: (error: unknown) => void;
    const ticket = new Promise<string>((resolve, reject) => {
        resolveTicket = resolve;
        rejectTicket = reject;
    });
    // The ticket is only observed by a concurrent cancellation. Keep a rejected
    // preparation from becoming an unhandled promise rejection when no canceler
    // is waiting for it.
    void ticket.catch(() => undefined);
    const entry: DownloadJobEntry = {
        cancelRequested: false,
        started: false,
        ticket,
        resolveTicket,
        rejectTicket,
        settlement: Promise.resolve(),
        clearedGeneration: null,
    };
    jobs.set(progressId, entry);
    publish();

    const execution = (async () => {
        try {
            return await withDownloadTicket(async (preparedTicket) => {
                entry.resolveTicket(preparedTicket);
                if (entry.cancelRequested) throw cancellationError();
                entry.started = true;
                return run(preparedTicket);
            });
        } catch (error) {
            entry.rejectTicket(error);
            // A cancellation that arrives before preparation completes means the command
            // never started. Preserve the cancellation category even if preparation itself
            // rejected, while leaving failures after invocation untouched.
            if (entry.cancelRequested && !entry.started) throw cancellationError();
            throw error;
        }
    })();

    entry.settlement = execution
        .catch(async (error) => {
            if (isCancellation(error)) {
                entry.clearedGeneration = await clearDownloadProgress(progressId);
            }
            throw error;
        })
        .finally(() => {
            jobs.delete(progressId);
            publish();
        });
    return entry.settlement as Promise<T>;
}

export async function cancelDownloadJob(progressId: string): Promise<CancelOutcome> {
    const entry = jobs.get(progressId);
    if (!entry) throw new DownloadCancelLostError();
    entry.cancelRequested = true;

    let preparedTicket: string;
    try {
        preparedTicket = await entry.ticket;
    } catch {
        return await settleCancellation(entry);
    }

    try {
        await tauri.cancelDownload(preparedTicket);
    } catch (error) {
        throw new DownloadCancelRequestError(error);
    }
    return settleCancellation(entry);
}

async function settleCancellation(entry: DownloadJobEntry): Promise<CancelOutcome> {
    try {
        await entry.settlement;
        throw new DownloadCancelLostError();
    } catch (error) {
        if (isCancellation(error)) {
            return { clearedGeneration: entry.clearedGeneration };
        }
        throw error;
    }
}

export function useDownloadJob(progressId: string): boolean {
    return useSyncExternalStore(
        (listener) => {
            subscribers.add(listener);
            return () => subscribers.delete(listener);
        },
        () => jobs.has(progressId),
        () => false,
    );
}

export async function cancelDownload(
    progressId: string,
    errorTitle: string,
): Promise<CancelOutcome> {
    try {
        return await cancelDownloadJob(progressId);
    } catch (error) {
        if (error instanceof DownloadCancelRequestError) {
            notifyUnlessCancelled(errorTitle, error.cause);
        }
        throw error;
    }
}
