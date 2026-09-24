import { afterEach, expect, test, vi } from "vitest";
import {
    getFileFreshness,
    pendingFileReconcileCount,
    registerFileConflictSave,
    removeFileFreshness,
    requestFileReconcile,
    saveFileConflictVersion,
    setFileFreshness,
} from "./fileFreshness";

const ids = ["freshness-a", "freshness-b"];

afterEach(() => {
    ids.forEach(removeFileFreshness);
    vi.restoreAllMocks();
});

function deferred<T>() {
    let resolve!: (value: T | PromiseLike<T>) => void;
    const promise = new Promise<T>((done) => {
        resolve = done;
    });
    return { promise, resolve };
}

test("freshness transitions advance the epoch and retain only verified metadata", () => {
    expect(getFileFreshness(ids[0])).toMatchObject({
        state: "unverified",
        verifiedRevision: null,
        conflictReason: null,
        epoch: 0,
    });

    const verified = setFileFreshness(ids[0], "verified", { verifiedRevision: "r1" });
    expect(verified).toMatchObject({ state: "verified", verifiedRevision: "r1", epoch: 1 });
    const conflict = setFileFreshness(ids[0], "conflict", { conflictReason: "save-refused" });
    expect(conflict).toMatchObject({
        state: "conflict",
        verifiedRevision: null,
        conflictReason: "save-refused",
        epoch: 2,
    });
    expect(setFileFreshness(ids[0], "unavailable")).toMatchObject({
        state: "unavailable",
        conflictReason: null,
        epoch: 3,
    });
});

test("a tab admits one reconcile and runs exactly one queued invalidation after it settles", async () => {
    const first = deferred<void>();
    const second = deferred<void>();
    const signals: AbortSignal[] = [];
    const reconcile = vi
        .fn<(signal: AbortSignal) => Promise<void>>()
        .mockImplementationOnce((signal) => {
            signals.push(signal);
            return first.promise;
        })
        .mockImplementationOnce((signal) => {
            signals.push(signal);
            return second.promise;
        });

    requestFileReconcile(ids[0], reconcile);
    requestFileReconcile(ids[0], reconcile);
    requestFileReconcile(ids[0], reconcile);
    expect(reconcile).toHaveBeenCalledOnce();
    expect(pendingFileReconcileCount()).toBe(1);

    first.resolve();
    await vi.waitFor(() => expect(reconcile).toHaveBeenCalledTimes(2));
    expect(signals[0].aborted).toBe(false);
    expect(pendingFileReconcileCount()).toBe(1);
    second.resolve();
    await vi.waitFor(() => expect(pendingFileReconcileCount()).toBe(0));
});

test("aborting a running reconcile queues a replacement without overlapping native reads", async () => {
    const first = deferred<void>();
    const second = deferred<void>();
    const signals: AbortSignal[] = [];
    const reconcile = vi
        .fn<(signal: AbortSignal) => Promise<void>>()
        .mockImplementationOnce((signal) => {
            signals.push(signal);
            return first.promise;
        })
        .mockImplementationOnce((signal) => {
            signals.push(signal);
            return second.promise;
        });

    const cancel = requestFileReconcile(ids[0], reconcile);
    cancel();
    requestFileReconcile(ids[0], reconcile);
    expect(signals[0].aborted).toBe(true);
    expect(reconcile).toHaveBeenCalledOnce();

    first.resolve();
    await vi.waitFor(() => expect(reconcile).toHaveBeenCalledTimes(2));
    expect(signals[1].aborted).toBe(false);
    second.resolve();
    await vi.waitFor(() => expect(pendingFileReconcileCount()).toBe(0));
});

test("conflict save registration is tab-scoped and removed with the tab", async () => {
    const save = vi.fn(async () => true);
    const unregister = registerFileConflictSave(ids[0], save);

    await expect(saveFileConflictVersion(ids[0])).resolves.toBe(true);
    expect(save).toHaveBeenCalledOnce();
    await expect(saveFileConflictVersion(ids[1])).resolves.toBe(false);

    unregister();
    await expect(saveFileConflictVersion(ids[0])).resolves.toBe(false);

    registerFileConflictSave(ids[0], save);
    removeFileFreshness(ids[0]);
    await expect(saveFileConflictVersion(ids[0])).resolves.toBe(false);
});
