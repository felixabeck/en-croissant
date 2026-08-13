import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { expect, test, vi } from "vitest";
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
    expect(load).toHaveBeenCalledTimes(2);
    expect(load).toHaveBeenNthCalledWith(1, 0, 20);
    expect(load).toHaveBeenNthCalledWith(2, 21, 40);
    await act(async () => {
        root.unmount();
    });
});
