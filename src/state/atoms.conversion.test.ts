import { beforeEach, expect, test, vi } from "vitest";
import { createStore } from "jotai";
import {
    databaseConversionStateAtom,
    runDatabaseConversion,
    type DatabaseConversionOperation,
} from "./atoms";

const mocks = vi.hoisted(() => ({ prepare: vi.fn(), cancel: vi.fn() }));
vi.mock("@/platform/tauri", async (original) => ({
    ...(await original<typeof import("@/platform/tauri")>()),
    withConversionTicket: async (run: (ticket: string) => Promise<unknown>) =>
        run(await mocks.prepare()),
    tauri: { cancelConversion: mocks.cancel },
}));

function deferred<T>() {
    let resolve!: (value: T) => void;
    let reject!: (cause: unknown) => void;
    const promise = new Promise<T>((yes, no) => {
        resolve = yes;
        reject = no;
    });
    return { promise, resolve, reject };
}
const target = {
    targetDatabase: null,
    targetDatabaseTitle: "Target",
    sourceFileName: "source.pgn",
};
beforeEach(() => {
    mocks.prepare.mockReset().mockResolvedValue("ticket");
    mocks.cancel.mockReset().mockResolvedValue(true);
});

test("cancel before preparation completes prevents dispatch and retires only after preparation settles", async () => {
    const store = createStore();
    const prepared = deferred<string>();
    mocks.prepare.mockReturnValue(prepared.promise);
    const run = vi.fn();
    const task = runDatabaseConversion(
        (update) => store.set(databaseConversionStateAtom, update),
        target,
        run,
        { onCancelError: vi.fn() },
    );
    const settled = task.catch((cause: unknown) => cause);
    await store.get(databaseConversionStateAtom)[0].cancel!();
    expect(store.get(databaseConversionStateAtom)).toHaveLength(1);
    prepared.resolve("prepared-after-cancel");
    expect(await settled).toMatchObject({ details: { category: "cancelled" } });
    expect(run).not.toHaveBeenCalled();
    expect(mocks.cancel).not.toHaveBeenCalled();
    expect(store.get(databaseConversionStateAtom)).toEqual([]);
});

test("pending cancel is deduplicated, failure is visible once and permits exact-ticket retry", async () => {
    const store = createStore();
    const outcome = deferred<string>();
    const request = deferred<boolean>();
    mocks.cancel.mockReturnValueOnce(request.promise);
    const onCancelError = vi.fn();
    let operation!: DatabaseConversionOperation;
    const task = runDatabaseConversion(
        (update) => store.set(databaseConversionStateAtom, update),
        target,
        async (value) => {
            operation = value;
            return outcome.promise;
        },
        { onCancelError },
    );
    await vi.waitFor(() => expect(operation?.ticket).toBe("ticket"));
    const cancel = store.get(databaseConversionStateAtom)[0].cancel!;
    const first = cancel();
    expect(cancel()).toBe(first);
    expect(mocks.cancel).toHaveBeenCalledExactlyOnceWith("ticket");
    expect(store.get(databaseConversionStateAtom)[0].cancelPending).toBe(true);
    request.reject(new Error("request refused"));
    await first;
    expect(onCancelError).toHaveBeenCalledOnce();
    expect(store.get(databaseConversionStateAtom)[0].cancelPending).toBe(false);
    await cancel();
    expect(mocks.cancel).toHaveBeenCalledTimes(2);
    // The native transaction can still commit after a request is acknowledged.
    outcome.resolve("committed");
    await expect(task).resolves.toBe("committed");
    await cancel();
    expect(mocks.cancel).toHaveBeenCalledTimes(2);
    expect(store.get(databaseConversionStateAtom)).toEqual([]);
});

test("same-target sibling and unticketed account retain independent lifetimes", async () => {
    const store = createStore();
    const setState = (
        update: Parameters<typeof runDatabaseConversion>[0] extends (update: infer U) => void
            ? U
            : never,
    ) => store.set(databaseConversionStateAtom, update);
    const first = deferred<void>();
    const second = deferred<void>();
    let account!: DatabaseConversionOperation;
    const a = runDatabaseConversion(setState, target, () => first.promise, {
        onCancelError: vi.fn(),
    });
    const b = runDatabaseConversion(setState, target, (operation) => {
        account = operation;
        return second.promise;
    });
    await vi.waitFor(() => expect(store.get(databaseConversionStateAtom)).toHaveLength(2));
    const [local, other] = store.get(databaseConversionStateAtom);
    expect(local.id).not.toBe(other.id);
    expect(other.cancel).toBeUndefined();
    expect(account.ticket).toBeNull();
    first.resolve();
    await a;
    expect(store.get(databaseConversionStateAtom)).toEqual([other]);
    second.resolve();
    await b;
    expect(store.get(databaseConversionStateAtom)).toEqual([]);
});

test("committed outcome keeps its row until the pending cancellation request settles", async () => {
    const store = createStore();
    const outcome = deferred<string>();
    const request = deferred<boolean>();
    mocks.cancel.mockReturnValue(request.promise);
    const task = runDatabaseConversion(
        (update) => store.set(databaseConversionStateAtom, update),
        target,
        () => outcome.promise,
        { onCancelError: vi.fn() },
    );
    await vi.waitFor(() => expect(mocks.prepare).toHaveBeenCalledOnce());
    // Allow the prepared callback to enter the native conversion continuation.
    await Promise.resolve();
    const cancel = store.get(databaseConversionStateAtom)[0].cancel!();
    outcome.resolve("committed");
    await Promise.resolve();
    expect(store.get(databaseConversionStateAtom)).toHaveLength(1);
    request.resolve(true);
    await cancel;
    await expect(task).resolves.toBe("committed");
    expect(store.get(databaseConversionStateAtom)).toEqual([]);
});
