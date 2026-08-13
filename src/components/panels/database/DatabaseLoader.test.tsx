import { act } from "react";
import { MantineProvider } from "@mantine/core";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  clearProgress: vi.fn(),
  getProgress: vi.fn(),
  listen: vi.fn(),
}));

vi.mock("@/bindings/generated", () => ({
  commands: {
    clearProgress: mocks.clearProgress,
    getProgress: mocks.getProgress,
  },
  events: {
    progressEvent: { listen: mocks.listen },
  },
}));

import DatabaseLoader from "./DatabaseLoader";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: () => ({
    matches: false,
    media: "",
    onchange: null,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
  }),
});

function renderLoader(isLoading: boolean, tab: string | null) {
  return act(async () => {
    root.render(
      <MantineProvider>
        <DatabaseLoader isLoading={isLoading} tab={tab} />
      </MantineProvider>,
    );
  });
}

type Progress = {
  id: string;
  generation: bigint;
  progress: number;
  finished: boolean;
  state: "running" | "succeeded" | "failed" | "cancelled";
  cleared: boolean;
};

let eventHandler: ((event: { payload: Progress }) => void) | undefined;
let root: Root;
let container: HTMLDivElement;

function barValue(): number | null {
  const bar = container.querySelector<HTMLElement>("[role='progressbar']");
  const value = bar?.getAttribute("aria-valuenow");
  return value === null || value === undefined ? null : Number.parseFloat(value);
}

async function emit(payload: Partial<Progress> & { progress: number }) {
  await act(async () => {
    eventHandler?.({
      payload: {
        id: "tab-1",
        generation: BigInt(1),
        finished: false,
        state: "running",
        cleared: false,
        ...payload,
      },
    });
  });
}

beforeEach(() => {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  eventHandler = undefined;
  mocks.clearProgress.mockReset();
  mocks.getProgress.mockReset();
  mocks.getProgress.mockResolvedValue(null);
  mocks.listen.mockReset();
  mocks.listen.mockImplementation(async (handler: (event: { payload: Progress }) => void) => {
    eventHandler = handler;
    return vi.fn();
  });
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

describe("DatabaseLoader", () => {
  test("shows the reported percentage while a search is running", async () => {
    await renderLoader(true, "tab-1");
    await emit({ progress: 75 });

    expect(barValue()).toBe(75);
  });

  test("empties the bar when a search fails partway through", async () => {
    await renderLoader(true, "tab-1");
    await emit({ progress: 75 });
    await emit({ progress: 75, finished: true, state: "failed" });
    await renderLoader(false, "tab-1");

    // Progress is monotonic in the store, so the failed run still reports 75.
    // The bar must not keep showing it.
    expect(barValue()).toBe(0);
  });

  test("empties the bar when a search is cancelled partway through", async () => {
    await renderLoader(true, "tab-1");
    await emit({ progress: 40 });
    await emit({ progress: 40, finished: true, state: "cancelled" });
    await renderLoader(false, "tab-1");

    expect(barValue()).toBe(0);
  });

  test("keeps the bar full after a successful search", async () => {
    await renderLoader(true, "tab-1");
    await emit({ progress: 100, finished: true, state: "succeeded" });
    await renderLoader(false, "tab-1");

    expect(barValue()).toBe(100);
  });
});
