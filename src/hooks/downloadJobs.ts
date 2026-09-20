import { useSyncExternalStore } from "react";
import { notifyUnlessCancelled } from "@/components/files/notifyError";
import { errorUnlessCancelled } from "@/platform/errors";
import { cancellationError, tauri, withDownloadTicket } from "@/platform/tauri";
import { warn } from "@/platform/native";

/**
 * Why a cancellation did not take effect. `lost` means the download settled on its own
 * (it finished, or no job was registered), `request` that the cancel IPC itself failed -
 * the card notifies only the latter - and `busy` that a job for this progress id is
 * already running.
 */
export type DownloadCancelReason = "lost" | "request" | "busy";

export type DownloadCancelError = Error & { reason: DownloadCancelReason; cause?: unknown };

/** `reason` is what a caller branches on; the message repeats it so a log line still says why. */
export function downloadCancelError(
    reason: DownloadCancelReason,
    cause?: unknown,
): DownloadCancelError {
    return Object.assign(new Error(reason), { reason, cause });
}

type CancelOutcome = { clearedGeneration: bigint | null };

type DownloadJobEntry = {
    cancelRequested: boolean;
    /** Set once the native ticket exists; before that a cancel needs no native call. */
    ticket: string | null;
    settlement: Promise<unknown>;
    clearedGeneration: bigint | null;
};

const jobs = new Map<string, DownloadJobEntry>();
const subscribers = new Set<() => void>();
const publish = () => subscribers.forEach((subscriber) => subscriber());

/**
 * Clears a job's progress entry, best effort: the result of a download is never a failure to
 * tidy its bar. `warn` itself rejects without a Tauri backend, so its promise is swallowed too.
 */
async function clearDownloadProgress(progressId: string): Promise<bigint | null> {
    try {
        return await tauri.clearProgress(progressId);
    } catch (error) {
        void warn(`clear progress ${progressId}: ${String(error)}`).catch(() => undefined);
        return null;
    }
}

export function runDownloadJob<T>(
    progressId: string,
    run: (ticket: string) => Promise<T>,
): Promise<T> {
    if (jobs.has(progressId)) throw downloadCancelError("busy");

    const entry: DownloadJobEntry = {
        cancelRequested: false,
        ticket: null,
        settlement: Promise.resolve(),
        clearedGeneration: null,
    };
    jobs.set(progressId, entry);
    publish();

    const execution = withDownloadTicket(async (preparedTicket) => {
        // A cancel that arrives before this point never reached native work: the ticket is
        // still unclaimed and `withDownloadTicket` releases it on this rejection.
        if (entry.cancelRequested) throw cancellationError();
        entry.ticket = preparedTicket;
        return run(preparedTicket);
    }).catch((error) => {
        // A preparation that failed while a cancel was pending is that cancel, not an error.
        if (entry.cancelRequested && entry.ticket === null) throw cancellationError();
        throw error;
    });

    entry.settlement = execution
        // A job that did not succeed leaves no bar behind: the store keeps a terminal item at the
        // last percentage it reached (cancelled or failed), which would otherwise still be drawn.
        // Clearing here, before the entry is released below, is what keeps a retry's own bar safe:
        // no start is accepted for this id until the clear has been answered.
        .catch(async (error) => {
            entry.clearedGeneration = await clearDownloadProgress(progressId);
            throw error;
        })
        .finally(() => {
            jobs.delete(progressId);
            publish();
        });
    return entry.settlement as Promise<T>;
}

/**
 * Cancels the running download for `progressId` and answers what the UI may hide: the generation
 * the job's own progress clear returned, or `null` when that clear was refused. It rejects with a
 * `reason` of `lost` when the download settled on its own (or no job is registered) and `request`
 * when the cancellation could not be delivered - only the latter is notified here, because the
 * job's own failure is already reported by the wrapper around `runDownloadJob`.
 */
export async function cancelDownloadJob(
    progressId: string,
    errorTitle?: string,
): Promise<CancelOutcome> {
    const entry = jobs.get(progressId);
    if (!entry) throw downloadCancelError("lost");
    entry.cancelRequested = true;

    if (entry.ticket !== null) {
        try {
            await tauri.cancelDownload(entry.ticket);
        } catch (error) {
            if (errorTitle !== undefined) notifyUnlessCancelled(errorTitle, error);
            throw downloadCancelError("request", error);
        }
    }
    try {
        await entry.settlement;
    } catch (error) {
        if (errorUnlessCancelled(error) === null) {
            return { clearedGeneration: entry.clearedGeneration };
        }
        throw error;
    }
    throw downloadCancelError("lost");
}

export function useDownloadJob(progressId: string): boolean {
    return useSyncExternalStore(
        (listener) => {
            subscribers.add(listener);
            return () => subscribers.delete(listener);
        },
        () => jobs.has(progressId),
    );
}
