import { act, useState } from "react";
import { createStore } from "jotai";
import { createDatabaseSplitAtoms, DATABASE_SPLIT_KEY } from "@/state/databaseLayout";
import { createRoot, type Root } from "react-dom/client";
import { Mosaic, type MosaicNode } from "react-mosaic-component";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let container: HTMLDivElement;
let root: Root;
const changes: number[] = [];
const releases: number[] = [];
let store: ReturnType<typeof createStore>;
let preference: ReturnType<typeof createDatabaseSplitAtoms>;

function Layout({ enabled = true }: { enabled?: boolean }) {
  const [value, setValue] = useState<MosaicNode<string>>({
    direction: "row",
    first: "table",
    second: "preview",
    splitPercentage: 50,
  });
  return (
    <Mosaic
      value={value}
      resize={enabled ? { minimumPaneSizePercentage: 20 } : "DISABLED"}
      renderTile={(id) => <div>{id}</div>}
      onChange={(node) => {
        if (node && typeof node !== "string") {
          changes.push(node.splitPercentage!);
          store.set(preference.transient, node.splitPercentage!);
        }
        setValue(node!);
      }}
      onRelease={(node) => {
        if (node && typeof node !== "string") {
          releases.push(node.splitPercentage!);
          store.set(preference.commit, node.splitPercentage!);
        }
      }}
    />
  );
}

beforeEach(async () => {
  vi.useFakeTimers();
  changes.length = 0;
  releases.length = 0;
  localStorage.clear();
  store = createStore();
  preference = createDatabaseSplitAtoms(localStorage);
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
    x: 0,
    y: 0,
    left: 0,
    top: 0,
    right: 1000,
    bottom: 800,
    width: 1000,
    height: 800,
    toJSON: () => ({}),
  });
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () => root.render(<Layout />));
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

async function mouse(type: string, x: number, target: Element | Document = document) {
  await act(async () =>
    target.dispatchEvent(
      new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, button: 0 }),
    ),
  );
}

async function queueMoves() {
  await mouse("mousedown", 500, container.querySelector(".mosaic-split")!);
  await mouse("mousemove", 300);
  await mouse("mousemove", 400);
  expect(changes).toEqual([30]);
  expect(localStorage.getItem(DATABASE_SPLIT_KEY)).toBeNull();
}

test("release cancels queued movement and final controlled and saved percentages agree", async () => {
  await queueMoves();
  await mouse("mouseup", 600);
  await act(async () => vi.advanceTimersByTime(100));
  expect(changes).toEqual([30, 60]);
  expect(releases).toEqual([60]);
  expect(store.get(preference.displayed)).toBe(60);
  expect(localStorage.getItem(DATABASE_SPLIT_KEY)).toBe("60");
  expect((container.querySelector(".mosaic-split") as HTMLElement).style.left).toBe("60%");
});

test.each(["compact reflow", "owner removal"])(
  "%s cancels queued movement without a release or cleared-ref access",
  async (reason) => {
    await queueMoves();
    const divider = container.querySelector(".mosaic-split")!;
    const remove = vi.spyOn(divider, "removeEventListener");
    await act(async () =>
      root.render(reason === "compact reflow" ? <Layout enabled={false} /> : null),
    );
    expect(remove).toHaveBeenCalledWith("touchstart", expect.any(Function), {
      capture: true,
      passive: false,
    });
    await act(async () => vi.advanceTimersByTime(100));
    await mouse("mousemove", 700);
    await mouse("mouseup", 700);
    expect(changes).toEqual([30]);
    expect(releases).toEqual([]);
    expect(localStorage.getItem(DATABASE_SPLIT_KEY)).toBeNull();
  },
);

test("mounted touchcancel discards pending movement, detaches listeners and allows a new gesture", async () => {
  const divider = container.querySelector(".mosaic-split")!;
  const touch = async (type: string, x: number, target: Element | Document = document) => {
    const event = new Event(type, { bubbles: true, cancelable: true });
    Object.defineProperty(event, "changedTouches", { value: [{ clientX: x, clientY: 0 }] });
    await act(async () => target.dispatchEvent(event));
  };
  const remove = vi.spyOn(document, "removeEventListener");
  await touch("touchstart", 500, divider);
  await touch("touchmove", 300);
  await touch("touchmove", 400);
  await touch("touchcancel", 400);
  await act(async () => vi.advanceTimersByTime(100));
  for (const type of ["mousemove", "touchmove", "mouseup", "touchend", "touchcancel"]) {
    expect(remove.mock.calls.some(([event]) => event === type)).toBe(true);
  }
  await mouse("mousemove", 700);
  await mouse("mouseup", 700);
  await touch("touchmove", 700);
  await touch("touchend", 700);
  expect(changes).toEqual([30]);
  expect(releases).toEqual([]);
  expect(store.get(preference.preferred)).toBe(50);
  expect(store.get(preference.displayed)).toBe(30);
  expect(localStorage.getItem(DATABASE_SPLIT_KEY)).toBeNull();
  expect((divider as HTMLElement).style.left).toBe("30%");
  await touch("touchstart", 300, divider);
  await touch("touchmove", 450);
  await touch("touchend", 600);
  await act(async () => vi.advanceTimersByTime(100));
  expect(changes).toEqual([30, 45, 60]);
  expect(releases).toEqual([60]);
  expect(store.get(preference.displayed)).toBe(60);
  expect(localStorage.getItem(DATABASE_SPLIT_KEY)).toBe("60");
});
