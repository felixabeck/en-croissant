import { expect, test } from "vitest";
import { runWindowAction, watchMaximized } from "@/routes/-appMenu";

function deferred<T>() {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((res) => {
        resolve = res;
    });
    return { promise, resolve };
}

test("runWindowAction notifies a rejected native call once", async () => {
    const seen: unknown[] = [];
    await runWindowAction(
        async () => {
            throw new Error("minimize failed");
        },
        (error) => {
            seen.push(error);
        },
    );
    expect(seen).toHaveLength(1);
});

test("watchMaximized ignores setState after stop and notifies once", async () => {
    const maximized = deferred<boolean>();
    const seen: boolean[] = [];
    const notified: unknown[] = [];
    const stop = watchMaximized({
        isMaximized: () => maximized.promise,
        onResized: () => () => undefined,
        setMaximized: (value) => {
            seen.push(value);
        },
        notify: (error) => {
            notified.push(error);
        },
    });
    stop();
    maximized.resolve(true);
    await maximized.promise;
    await Promise.resolve();
    expect(seen).toEqual([]);

    let resizeHandler: (() => void) | undefined;
    const stopFail = watchMaximized({
        isMaximized: async () => {
            throw new Error("isMaximized failed");
        },
        onResized: (handler) => {
            resizeHandler = handler;
            return () => {
                resizeHandler = undefined;
            };
        },
        setMaximized: (value) => {
            seen.push(value);
        },
        notify: (error) => {
            notified.push(error);
        },
    });
    await Promise.resolve();
    await Promise.resolve();
    expect(notified).toHaveLength(1);
    expect(resizeHandler).toBeUndefined();
    stopFail();
});
