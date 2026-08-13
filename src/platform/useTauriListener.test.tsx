import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { useTauriListener } from "./useTauriListener";

let root: Root;
let host: HTMLDivElement;

function Probe({
  subscribe,
  onEvent,
  onError,
}: {
  subscribe: (callback: (value: string) => void) => Promise<() => void>;
  onEvent: (value: string) => void;
  onError?: (error: { message: string }) => void;
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
    await act(async () => root.render(<Probe subscribe={subscribe} onEvent={vi.fn()} />));
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
    await act(async () => root.render(<Probe subscribe={subscribe} onEvent={first} />));
    await act(async () => root.render(<Probe subscribe={subscribe} onEvent={second} />));
    await act(async () => listener("event"));
    expect(subscribe).toHaveBeenCalledOnce();
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledWith("event");
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
});
