import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { expect, test, vi } from "vitest";
import { cancellationError } from "@/platform/tauri";
import { useVirtualPageLoader } from "./useVirtualPageLoader";

declare global {
    var IS_REACT_ACT_ENVIRONMENT: boolean;
}

test("deduplicates ranges and discards a late response after identity switch", async () => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    let resolve!: (values: readonly string[]) => void;
    const load = vi.fn(
        () =>
            new Promise<readonly string[]>((done) => {
                resolve = done;
            }),
    );
    const merge = vi.fn();
    let request: ((start: number, end: number) => Promise<void> | undefined) | undefined;
    function Harness({ identity }: { identity: string }) {
        request = useVirtualPageLoader(identity, load, merge);
        return null;
    }
    const container = document.createElement("div");
    let root: Root;
    await act(async () => {
        root = createRoot(container);
        root.render(createElement(Harness, { identity: "one" }));
    });
    let first: Promise<void>;
    act(() => {
        first = request!(0, 20)!;
        void request!(0, 20);
        expect(load).toHaveBeenCalledTimes(1);
    });
    await act(async () => {
        root!.render(createElement(Harness, { identity: "two" }));
    });
    await act(async () => {
        resolve(["late"]);
        await first!;
    });
    expect(merge).not.toHaveBeenCalled();
    await act(async () => {
        root!.unmount();
    });
});

test("deduplicates an unchanged visible range while loading a changed range", async () => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    const resolvers = new Map<number, (values: readonly string[]) => void>();
    const load = vi.fn(
        (start: number) =>
            new Promise<readonly string[]>((resolve) => {
                resolvers.set(start, resolve);
            }),
    );
    const merge = vi.fn();
    let request: ((start: number, end: number) => Promise<void> | undefined) | undefined;
    function Harness() {
        request = useVirtualPageLoader("file", load, merge);
        return null;
    }
    const root = createRoot(document.createElement("div"));
    await act(async () => {
        root.render(createElement(Harness));
    });
    let first: Promise<void>;
    let second: Promise<void>;
    act(() => {
        first = request!(0, 20)!;
        void request!(0, 20);
        second = request!(21, 40)!;
    });
    expect(load).toHaveBeenCalledTimes(2);
    await act(async () => {
        resolvers.get(0)!(["game-0"]);
        resolvers.get(21)!(["game-21"]);
        await Promise.all([first!, second!]);
    });
    expect(load).toHaveBeenNthCalledWith(
        1,
        0,
        20,
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(load).toHaveBeenNthCalledWith(
        2,
        21,
        40,
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    await act(async () => {
        root.unmount();
    });
});

test("unmount aborts outstanding request signals", async () => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    let capturedSignal!: AbortSignal;
    const load = vi.fn((_start: number, _end: number, options?: { signal?: AbortSignal }) => {
        if (options?.signal) capturedSignal = options.signal;
        return new Promise<readonly string[]>(() => {});
    });
    const merge = vi.fn();
    let request: ((start: number, end: number) => Promise<void> | undefined) | undefined;
    function Harness() {
        request = useVirtualPageLoader("file-unmount", load, merge);
        return null;
    }
    const root = createRoot(document.createElement("div"));
    await act(async () => {
        root.render(createElement(Harness));
    });
    act(() => {
        void request!(0, 20);
    });
    expect(load).toHaveBeenCalledTimes(1);
    expect(capturedSignal).toBeDefined();
    expect(capturedSignal.aborted).toBe(false);

    await act(async () => {
        root.unmount();
    });
    expect(capturedSignal.aborted).toBe(true);
    expect(merge).not.toHaveBeenCalled();
});

test("rapid identity switch aborts previous signals and rejects publication of stale responses", async () => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    const signals: AbortSignal[] = [];
    const resolvers: Array<(values: readonly string[]) => void> = [];
    const load = vi.fn((_start: number, _end: number, options?: { signal?: AbortSignal }) => {
        if (options?.signal) signals.push(options.signal);
        return new Promise<readonly string[]>((resolve) => {
            resolvers.push(resolve);
        });
    });
    const merge = vi.fn();
    let request: ((start: number, end: number) => Promise<void> | undefined) | undefined;
    function Harness({ identity }: { identity: string }) {
        request = useVirtualPageLoader(identity, load, merge);
        return null;
    }
    const root = createRoot(document.createElement("div"));
    await act(async () => {
        root.render(createElement(Harness, { identity: "file-A" }));
    });
    let first: Promise<void>;
    act(() => {
        first = request!(0, 10)!;
    });
    expect(load).toHaveBeenCalledTimes(1);
    expect(signals[0].aborted).toBe(false);

    // Rapid switch to B
    await act(async () => {
        root.render(createElement(Harness, { identity: "file-B" }));
    });
    expect(signals[0].aborted).toBe(true);

    let second: Promise<void>;
    act(() => {
        second = request!(0, 10)!;
    });
    expect(load).toHaveBeenCalledTimes(2);
    expect(signals[1].aborted).toBe(false);

    // Stale resolve from file-A
    await act(async () => {
        resolvers[0](["stale-game"]);
        await first!;
    });
    expect(merge).not.toHaveBeenCalled();

    // Fresh resolve from file-B
    await act(async () => {
        resolvers[1](["fresh-game"]);
        await second!;
    });
    expect(merge).toHaveBeenCalledWith(0, ["fresh-game"]);

    await act(async () => {
        root.unmount();
    });
});

test("cancelled reads do not throw unhandled rejections or fail silently", async () => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    const load = vi.fn(() => Promise.reject(cancellationError()));
    const merge = vi.fn();
    let request: ((start: number, end: number) => Promise<void> | undefined) | undefined;
    function Harness() {
        request = useVirtualPageLoader("file-cancelled", load, merge);
        return null;
    }
    const root = createRoot(document.createElement("div"));
    await act(async () => {
        root.render(createElement(Harness));
    });

    let promise: Promise<void> | undefined;
    act(() => {
        promise = request!(0, 10);
    });

    // Should resolve cleanly without unhandled rejection
    await expect(promise).resolves.toBeUndefined();
    expect(merge).not.toHaveBeenCalled();

    await act(async () => {
        root.unmount();
    });
});

test("old aborted generation settlement after new same-range dispatch preserves new deduplication and unmount cancellation", async () => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    const signals: AbortSignal[] = [];
    const resolvers: Array<(values: readonly string[]) => void> = [];
    const load = vi.fn((_start: number, _end: number, options?: { signal?: AbortSignal }) => {
        if (options?.signal) signals.push(options.signal);
        return new Promise<readonly string[]>((resolve) => {
            resolvers.push(resolve);
        });
    });
    const merge = vi.fn();
    let request: ((start: number, end: number) => Promise<void> | undefined) | undefined;
    function Harness({ identity }: { identity: string }) {
        request = useVirtualPageLoader(identity, load, merge);
        return null;
    }
    const root = createRoot(document.createElement("div"));
    await act(async () => {
        root.render(createElement(Harness, { identity: "file-A" }));
    });

    let first: Promise<void>;
    act(() => {
        first = request!(0, 10)!;
    });
    expect(load).toHaveBeenCalledTimes(1);
    expect(signals[0].aborted).toBe(false);

    // Switch to file-B, bumping generation and aborting first signal
    await act(async () => {
        root.render(createElement(Harness, { identity: "file-B" }));
    });
    expect(signals[0].aborted).toBe(true);

    // Start same range on file-B
    let second: Promise<void>;
    act(() => {
        second = request!(0, 10)!;
    });
    expect(load).toHaveBeenCalledTimes(2);
    expect(signals[1].aborted).toBe(false);

    // Now old aborted generation 1 settles late
    await act(async () => {
        resolvers[0](["old-game"]);
        await first!;
    });
    expect(merge).not.toHaveBeenCalled();

    // Verify deduplication in generation 2 is preserved: calling same range should NOT call load again
    act(() => {
        const dup = request!(0, 10);
        expect(dup).toBe(second);
    });
    expect(load).toHaveBeenCalledTimes(2);

    // Verify unmount cancellation for generation 2 is preserved
    await act(async () => {
        root.unmount();
    });
    expect(signals[1].aborted).toBe(true);

    // Let second settle cleanly
    await act(async () => {
        resolvers[1](["new-game"]);
        await second!;
    });
});
