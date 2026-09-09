import { MantineProvider } from "@mantine/core";
import { Provider, createStore } from "jotai";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { TreeStateProvider } from "@/components/common/TreeStateContext";
import { activeTabAtom, referenceDbAtom, tabsAtom } from "@/state/atoms";
import RepertoireInfo from "./RepertoireInfo";

const mocks = vi.hoisted(() => ({
  computeTreeCoverage: vi.fn(),
  fetchPositionMoves: vi.fn(),
  notificationShow: vi.fn(),
}));

vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@mantine/notifications", () => ({
  notifications: { show: mocks.notificationShow },
}));
vi.mock("@/utils/repertoire", async () => {
  const actual = await vi.importActual<typeof import("@/utils/repertoire")>("@/utils/repertoire");
  return {
    ...actual,
    computeTreeCoverage: mocks.computeTreeCoverage,
    fetchPositionMoves: mocks.fetchPositionMoves,
  };
});

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
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
Object.defineProperty(window, "ResizeObserver", {
  writable: true,
  value: ResizeObserverStub,
});

const database = { id: { id: "reference" }, kind: "database" as const };
const emptyCoverage = {
  coverageMap: new Map<string, number>(),
  gamesMap: new Map<string, number>(),
  missingGamesMap: new Map<string, number>(),
  dbMovesMap: new Map(),
};

let root: Root;
let host: HTMLDivElement;

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  sessionStorage.clear();
  mocks.fetchPositionMoves.mockResolvedValue({ moves: [], total: 0 });
  mocks.computeTreeCoverage.mockResolvedValue(emptyCoverage);
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  localStorage.clear();
  sessionStorage.clear();
});

async function renderRepertoireInfo() {
  const store = createStore();
  store.set(tabsAtom, [
    {
      name: "Repertoire",
      value: "tab",
      type: "analysis",
      gameOrigin: { kind: "none" },
    },
  ]);
  store.set(activeTabAtom, "tab");
  await act(async () => {
    root.render(
      <MantineProvider>
        <Provider store={store}>
          <TreeStateProvider id="repertoire-info-test">
            <RepertoireInfo />
          </TreeStateProvider>
        </Provider>
      </MantineProvider>,
    );
    await Promise.resolve();
  });
  await act(async () => store.set(referenceDbAtom, database));
}

test("reports the current-position query failure", async () => {
  mocks.fetchPositionMoves.mockRejectedValue(new Error("position query failed"));
  await renderRepertoireInfo();
  await vi.waitFor(() =>
    expect(mocks.notificationShow).toHaveBeenCalledWith({
      title: "Common.Error",
      message: "position query failed",
      color: "red",
    }),
  );
});

test("reports the current coverage query failure", async () => {
  let rejectCoverage!: (error: unknown) => void;
  let coverageSignal!: AbortSignal;
  mocks.computeTreeCoverage.mockImplementation((...args: unknown[]) => {
    coverageSignal = args[6] as AbortSignal;
    return new Promise((_resolve, reject) => (rejectCoverage = reject));
  });
  await renderRepertoireInfo();
  await vi.waitFor(() => expect(mocks.computeTreeCoverage).toHaveBeenCalledTimes(1));
  expect(coverageSignal.aborted).toBe(false);
  await act(async () => rejectCoverage(new Error("coverage query failed")));
  await vi.waitFor(() =>
    expect(mocks.notificationShow).toHaveBeenCalledWith({
      title: "Common.Error",
      message: "coverage query failed",
      color: "red",
    }),
  );
});
