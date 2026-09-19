import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    cancelDownload: vi.fn(),
    clearProgress: vi.fn(),
    notifyUnlessCancelled: vi.fn(),
    warn: vi.fn(),
    withDownloadTicket: vi.fn(),
}));

vi.mock("@/components/files/notifyError", () => ({
    notifyUnlessCancelled: mocks.notifyUnlessCancelled,
}));

vi.mock("@/platform/native", () => ({ warn: mocks.warn }));

vi.mock("@/platform/tauri", async () => {
    const actual = await vi.importActual<typeof import("@/platform/tauri")>("@/platform/tauri");
    return {
        ...actual,
        tauri: {
            ...actual.tauri,
            cancelDownload: mocks.cancelDownload,
            clearProgress: mocks.clearProgress,
        },
        withDownloadTicket: mocks.withDownloadTicket,
    };
});

import { cancellationError } from "@/platform/tauri";
import {
    cancelDownload,
    cancelDownloadJob,
    DownloadCancelLostError,
    DownloadCancelRequestError,
    DownloadJobAlreadyRunningError,
    runDownloadJob,
} from "./downloadJobs";

beforeEach(() => {
    mocks.cancelDownload.mockReset().mockResolvedValue(true);
    mocks.clearProgress.mockReset().mockResolvedValue(42n);
    mocks.notifyUnlessCancelled.mockReset();
    mocks.warn.mockReset().mockResolvedValue(undefined);
    mocks.withDownloadTicket
        .mockReset()
        .mockImplementation(async (run: (ticket: string) => Promise<unknown>) =>
            run("prepared-ticket"),
        );
});

describe("download jobs", () => {
    test("passes the prepared ticket to the download and removes the entry", async () => {
        const result = await runDownloadJob("job", async (ticket) => ticket);

        expect(result).toBe("prepared-ticket");
        await expect(cancelDownloadJob("job")).rejects.toBeInstanceOf(DownloadCancelLostError);
    });

    test("refuses a second job while the first one is registered", async () => {
        let finish!: () => void;
        const running = runDownloadJob(
            "job",
            () =>
                new Promise<void>((resolve) => {
                    finish = resolve;
                }),
        );

        expect(() => runDownloadJob("job", async () => undefined)).toThrow(
            DownloadJobAlreadyRunningError,
        );
        finish();
        await running;
    });

    test("cancels a running job and clears progress before releasing it", async () => {
        let rejectRun!: (error: unknown) => void;
        const running = runDownloadJob(
            "job",
            () =>
                new Promise<never>((_resolve, reject) => {
                    rejectRun = reject;
                }),
        );
        const cancel = cancelDownloadJob("job");

        await Promise.resolve();
        expect(mocks.cancelDownload).toHaveBeenCalledWith("prepared-ticket");
        rejectRun(cancellationError());
        await expect(running).rejects.toMatchObject({ message: "Cancellation" });
        await expect(cancel).resolves.toEqual({ clearedGeneration: 42n });
        expect(mocks.clearProgress).toHaveBeenCalledWith("job");
    });

    test("keeps cancellation pending while native preparation is delayed", async () => {
        let resolvePreparation!: (ticket: string) => void;
        mocks.withDownloadTicket.mockImplementation(
            (run: (ticket: string) => Promise<unknown>) =>
                new Promise((resolve, reject) => {
                    resolvePreparation = (ticket) => {
                        void run(ticket).then(resolve, reject);
                    };
                }),
        );
        const run = vi.fn(async () => undefined);
        const running = runDownloadJob("job", run);
        const cancel = cancelDownloadJob("job");

        resolvePreparation("prepared-after-cancel");
        await expect(running).rejects.toMatchObject({ message: "Cancellation" });
        await expect(cancel).resolves.toEqual({ clearedGeneration: 42n });
        expect(run).not.toHaveBeenCalled();
        expect(mocks.cancelDownload).toHaveBeenCalledWith("prepared-after-cancel");
    });

    test("turns a pending cancellation with failed preparation into cancellation", async () => {
        mocks.withDownloadTicket.mockRejectedValue(new Error("prepare failed"));
        const run = vi.fn(async () => undefined);
        const running = runDownloadJob("job", run);
        const cancel = cancelDownloadJob("job");

        await expect(running).rejects.toMatchObject({ message: "Cancellation" });
        await expect(cancel).resolves.toEqual({ clearedGeneration: 42n });
        expect(run).not.toHaveBeenCalled();
        expect(mocks.cancelDownload).not.toHaveBeenCalled();
    });

    test("reports a lost cancellation race when the job succeeds", async () => {
        let finish!: () => void;
        const running = runDownloadJob(
            "job",
            () =>
                new Promise<void>((resolve) => {
                    finish = resolve;
                }),
        );
        const cancel = cancelDownloadJob("job");

        await Promise.resolve();
        finish();
        await running;
        await expect(cancel).rejects.toBeInstanceOf(DownloadCancelLostError);
        expect(mocks.clearProgress).not.toHaveBeenCalled();
    });

    test("distinguishes a failed cancellation request from the job result", async () => {
        const requestFailure = new Error("cancel IPC failed");
        mocks.cancelDownload.mockRejectedValue(requestFailure);
        let rejectRun!: (error: unknown) => void;
        const running = runDownloadJob(
            "job",
            () =>
                new Promise<never>((_resolve, reject) => {
                    rejectRun = reject;
                }),
        );
        const cancel = cancelDownloadJob("job");

        await expect(cancel).rejects.toMatchObject({
            constructor: DownloadCancelRequestError,
            cause: requestFailure,
        });
        rejectRun(cancellationError());
        await expect(running).rejects.toMatchObject({ message: "Cancellation" });
    });

    test("preserves a non-cancellation job failure when cancellation was requested", async () => {
        const failure = new Error("download failed");
        const running = runDownloadJob("job", async () => {
            throw failure;
        });
        const cancel = cancelDownloadJob("job");

        await expect(running).rejects.toBe(failure);
        await expect(cancel).rejects.toBe(failure);
        expect(mocks.clearProgress).not.toHaveBeenCalled();
    });

    test("notifies only when the cancellation request itself fails", async () => {
        const requestFailure = new Error("cancel IPC failed");
        mocks.cancelDownload.mockRejectedValue(requestFailure);
        let rejectRun!: (error: unknown) => void;
        const running = runDownloadJob(
            "job",
            () =>
                new Promise<never>((_resolve, reject) => {
                    rejectRun = reject;
                }),
        );

        await expect(cancelDownload("job", "Download failed")).rejects.toBeInstanceOf(
            DownloadCancelRequestError,
        );
        expect(mocks.notifyUnlessCancelled).toHaveBeenCalledWith("Download failed", requestFailure);
        rejectRun(cancellationError());
        await expect(running).rejects.toMatchObject({ message: "Cancellation" });
    });

    test("has no cancellation target after the job leaves the registry", async () => {
        await runDownloadJob("job", async () => undefined);

        await expect(cancelDownloadJob("job")).rejects.toBeInstanceOf(DownloadCancelLostError);
    });
});
