import { createStore, Provider } from "jotai";
import { act, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { fontSizeAtom } from "@/state/atoms";
import { installMatchMediaStub } from "@/tests/matchMedia";
import { useScaledMaxWidth } from "./useScaledMaxWidth";

vi.mock("@/state/atoms", async () => {
  const { atom } = await import("jotai");
  return { fontSizeAtom: atom(100) };
});

let root: Root;
let host: HTMLDivElement;
let store: ReturnType<typeof createStore>;
const mounted = vi.fn();

function Probe({ widthEm }: { widthEm: number }) {
  const compact = useScaledMaxWidth(widthEm);
  useEffect(() => {
    mounted();
  }, []);
  return <output>{String(compact)}</output>;
}

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  installMatchMediaStub();
  mounted.mockClear();
  store = createStore();
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

async function mount(widthEm: number) {
  await act(async () =>
    root.render(
      <Provider store={store}>
        <Probe widthEm={widthEm} />
      </Provider>,
    ),
  );
}

test.each([
  [50, 100, "(max-width: 50em)"],
  [50, 200, "(max-width: 100em)"],
  [50, 50, "(max-width: 25em)"],
  [30, 100, "(max-width: 30em)"],
  [30, 200, "(max-width: 60em)"],
  [30, 50, "(max-width: 15em)"],
])("queries %sem at %s%% as %s", async (widthEm, fontSize, expected) => {
  store.set(fontSizeAtom, fontSize);
  const matchMedia = vi.spyOn(window, "matchMedia");
  await mount(widthEm);
  expect(matchMedia).toHaveBeenCalledExactlyOnceWith(expected);
});

test("resamples the scaled query without remounting and cleans up each subscription", async () => {
  const initialQuery = {
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  };
  const scaledQuery = {
    matches: true,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  };
  const matchMedia = vi.spyOn(window, "matchMedia").mockImplementation((query) => ({
    ...(query === "(max-width: 100em)" ? scaledQuery : initialQuery),
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: () => false,
  }));

  await mount(50);
  expect(host.textContent).toBe("false");
  await act(async () => store.set(fontSizeAtom, 200));
  expect(host.textContent).toBe("true");
  expect(mounted).toHaveBeenCalledOnce();
  expect(matchMedia.mock.calls).toEqual([["(max-width: 50em)"], ["(max-width: 100em)"]]);
  expect(initialQuery.removeEventListener).toHaveBeenCalledExactlyOnceWith(
    "change",
    initialQuery.addEventListener.mock.calls[0]?.[1],
  );
  await act(async () => root.unmount());
  expect(scaledQuery.removeEventListener).toHaveBeenCalledExactlyOnceWith(
    "change",
    scaledQuery.addEventListener.mock.calls[0]?.[1],
  );
});
