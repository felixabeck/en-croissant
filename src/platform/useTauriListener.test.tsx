import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { useTauriListener } from "./useTauriListener";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

let root: Root;
let host: HTMLDivElement;

function Probe({
  subscribe,
  onEvent,
  onError,
}: {
  subscribe: (callback: (value: string) => void) => Promise<() => void>;
  onEvent: (value: string, signal: AbortSignal) => void | Promise<void>;
  onError: (error: { message: string }) => void;
}) {
  useTauriListener(subscribe, onEvent, { onError });
  return null;
}

beforeEach(() => {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});

describe("useTauriListener", () => {
  test("cleans a registration that resolves after unmount", async () => {
    let resolve!: (unlisten: () => void) => void;
    const cleaned = vi.fn();
    const subscribe = vi.fn(
      () =>
        new Promise<() => void>((done) => {
          resolve = done;
        }),
    );
    await act(async () =>
      root.render(<Probe subscribe={subscribe} onEvent={vi.fn()} onError={vi.fn()} />),
    );
    await act(async () => root.unmount());
    await act(async () => resolve(cleaned));
    expect(cleaned).toHaveBeenCalledOnce();
  });

  test("uses the current callback without duplicate subscriptions", async () => {
    let listener!: (value: string) => void;
    const cleaned = vi.fn();
    const subscribe = vi.fn(async (callback: (value: string) => void) => {
      listener = callback;
      return cleaned;
    });
    const first = vi.fn();
    const second = vi.fn();
    await act(async () =>
      root.render(<Probe subscribe={subscribe} onEvent={first} onError={vi.fn()} />),
    );
    await act(async () =>
      root.render(<Probe subscribe={subscribe} onEvent={second} onError={vi.fn()} />),
    );
    await act(async () => listener("event"));
    expect(subscribe).toHaveBeenCalledOnce();
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledWith("event", expect.any(AbortSignal));
  });

  test("reports a rejected registration while the owner is mounted", async () => {
    const onError = vi.fn();
    const subscribe = vi.fn(async () => Promise.reject(new Error("listener unavailable")));
    await act(async () =>
      root.render(<Probe subscribe={subscribe} onEvent={vi.fn()} onError={onError} />),
    );
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ message: "listener unavailable" }),
    );
  });

  test("silences a registration rejection that arrives after unmount", async () => {
    let reject!: (reason: unknown) => void;
    const onError = vi.fn();
    const subscribe = vi.fn(
      () =>
        new Promise<() => void>((_resolve, fail) => {
          reject = fail;
        }),
    );
    await act(async () =>
      root.render(<Probe subscribe={subscribe} onEvent={vi.fn()} onError={onError} />),
    );
    await act(async () => root.unmount());
    await act(async () => reject(new Error("late listener failure")));
    expect(onError).not.toHaveBeenCalled();
  });

  test("reports an async callback rejection while the owner is mounted", async () => {
    let listener!: (value: string) => void;
    const onError = vi.fn();
    const subscribe = vi.fn(async (callback: (value: string) => void) => {
      listener = callback;
      return vi.fn();
    });
    await act(async () =>
      root.render(
        <Probe
          subscribe={subscribe}
          onEvent={async () => Promise.reject(new Error("callback failed"))}
          onError={onError}
        />,
      ),
    );

    await act(async () => listener("event"));

    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: "callback failed" }));
  });

  test("silences an async callback rejection after abort", async () => {
    let listener!: (value: string) => void;
    let reject!: (reason: unknown) => void;
    const onError = vi.fn();
    const subscribe = vi.fn(async (callback: (value: string) => void) => {
      listener = callback;
      return vi.fn();
    });
    const onEvent = vi.fn(
      () =>
        new Promise<void>((_resolve, fail) => {
          reject = fail;
        }),
    );
    await act(async () =>
      root.render(<Probe subscribe={subscribe} onEvent={onEvent} onError={onError} />),
    );
    act(() => listener("event"));
    await act(async () => root.unmount());

    await act(async () => reject(new Error("late callback failure")));

    expect(onError).not.toHaveBeenCalled();
  });

  test("aborts the callback signal on unmount", async () => {
    let listener!: (value: string) => void;
    let signal: AbortSignal | undefined;
    const subscribe = vi.fn(async (callback: (value: string) => void) => {
      listener = callback;
      return vi.fn();
    });
    await act(async () =>
      root.render(
        <Probe
          subscribe={subscribe}
          onEvent={(_event, callbackSignal) => {
            signal = callbackSignal;
          }}
          onError={vi.fn()}
        />,
      ),
    );
    act(() => listener("event"));

    await act(async () => root.unmount());

    expect(signal?.aborted).toBe(true);
  });

  test("does not dispatch a late event after unmount", async () => {
    let listener!: (value: string) => void;
    const onEvent = vi.fn();
    const subscribe = vi.fn(async (callback: (value: string) => void) => {
      listener = callback;
      return vi.fn();
    });
    await act(async () =>
      root.render(<Probe subscribe={subscribe} onEvent={onEvent} onError={vi.fn()} />),
    );
    await act(async () => root.unmount());
    await act(async () => listener("late"));
    expect(onEvent).not.toHaveBeenCalled();
  });
});
