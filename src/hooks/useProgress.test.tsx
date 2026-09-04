import { act } from "react";
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

import { useProgress } from "./useProgress";

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

function Probe({ id }: { id: string }) {
  const state = useProgress(id);
  return (
    <>
      <output data-generation={state.item?.generation.toString() ?? "none"}>
        {state.progress}:{String(state.finished)}
      </output>
      <button onClick={() => void state.clear()}>clear</button>
    </>
  );
}

beforeEach(() => {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  eventHandler = undefined;
  mocks.clearProgress.mockReset();
  mocks.clearProgress.mockResolvedValue({ status: "ok", data: BigInt(0) });
  mocks.getProgress.mockReset();
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

describe("useProgress", () => {
  test("keeps the newest generation when the initial lookup resolves late", async () => {
    let resolveInitial: (value: Progress) => void = () => undefined;
    mocks.getProgress.mockReturnValue(
      new Promise<Progress>((resolve) => {
        resolveInitial = resolve;
      }),
    );

    await act(async () => root.render(<Probe id="job" />));
    await act(async () => {
      eventHandler?.({
        payload: {
          id: "job",
          generation: BigInt(2),
          progress: 60,
          finished: false,
          state: "running",
          cleared: false,
        },
      });
    });
    await act(async () => {
      resolveInitial({
        id: "job",
        generation: BigInt(1),
        progress: 100,
        finished: true,
        state: "succeeded",
        cleared: false,
      });
    });

    expect(container.querySelector("output")?.textContent).toBe("60:false");
    expect(container.querySelector("output")?.dataset.generation).toBe("2");
  });

  test("rejects regressing events within the same generation", async () => {
    mocks.getProgress.mockResolvedValue(null);
    await act(async () => root.render(<Probe id="job" />));

    await act(async () => {
      eventHandler?.({
        payload: {
          id: "job",
          generation: BigInt(4),
          progress: 80,
          finished: true,
          state: "succeeded",
          cleared: false,
        },
      });
      eventHandler?.({
        payload: {
          id: "job",
          generation: BigInt(4),
          progress: 40,
          finished: false,
          state: "running",
          cleared: false,
        },
      });
    });

    expect(container.querySelector("output")?.textContent).toBe("80:true");
  });

  test("clear establishes a generation floor that ignores an old producer", async () => {
    mocks.getProgress.mockResolvedValue(null);
    mocks.clearProgress.mockResolvedValue({ status: "ok", data: BigInt(8) });
    await act(async () => root.render(<Probe id="job" />));
    await act(async () => {
      container.querySelector("button")?.click();
    });
    await act(async () => {
      eventHandler?.({
        payload: {
          id: "job",
          generation: BigInt(7),
          progress: 100,
          finished: true,
          state: "succeeded",
          cleared: false,
        },
      });
    });
    expect(container.querySelector("output")?.dataset.generation).toBe("none");
  });

  test("a clear event from another window removes state and rejects its old producer", async () => {
    mocks.getProgress.mockResolvedValue(null);
    await act(async () => root.render(<Probe id="job" />));
    await act(async () => {
      eventHandler?.({
        payload: {
          id: "job",
          generation: BigInt(4),
          progress: 50,
          finished: false,
          state: "running",
          cleared: false,
        },
      });
      eventHandler?.({
        payload: {
          id: "job",
          generation: BigInt(5),
          progress: 0,
          finished: true,
          state: "cancelled",
          cleared: true,
        },
      });
      eventHandler?.({
        payload: {
          id: "job",
          generation: BigInt(4),
          progress: 100,
          finished: true,
          state: "succeeded",
          cleared: false,
        },
      });
    });
    expect(container.querySelector("output")?.dataset.generation).toBe("none");
  });

  test("drops a progress event whose id does not match the subscription", async () => {
    mocks.getProgress.mockResolvedValue(null);
    await act(async () => root.render(<Probe id="job" />));

    await act(async () => {
      eventHandler?.({
        payload: {
          id: "job",
          generation: BigInt(1),
          progress: 40,
          finished: false,
          state: "running",
          cleared: false,
        },
      });
      eventHandler?.({
        payload: {
          id: "other-job",
          generation: BigInt(2),
          progress: 90,
          finished: true,
          state: "succeeded",
          cleared: false,
        },
      });
    });

    expect(container.querySelector("output")?.textContent).toBe("40:false");
    expect(container.querySelector("output")?.dataset.generation).toBe("1");
  });

  test("changing IDs resets the generation floor and visible item", async () => {
    mocks.getProgress.mockImplementation(async (id: string) =>
      id === "first"
        ? {
            id,
            generation: BigInt(8),
            progress: 50,
            finished: false,
            state: "running",
          }
        : {
            id,
            generation: BigInt(1),
            progress: 25,
            finished: false,
            state: "running",
          },
    );
    await act(async () => root.render(<Probe id="first" />));
    expect(container.querySelector("output")?.dataset.generation).toBe("8");
    await act(async () => root.render(<Probe id="second" />));
    expect(container.querySelector("output")?.dataset.generation).toBe("1");
  });
});
