import { MantineProvider } from "@mantine/core";
import { Provider, createStore } from "jotai";
import { act, useContext } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { TreeStateProvider } from "@/components/common/TreeStateContext";
import { TreeStateContext } from "@/components/common/TreeStateContext";
import type { TreeStore } from "@/state/store/tree";
import { activeTabAtom, referenceDbAtom, tabsAtom } from "@/state/atoms";
import { createNode, defaultTree, getBoardState } from "@/utils/treeReducer";
import { parseUci } from "chessops";
import { installMatchMediaStub } from "@/tests/matchMedia";
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
installMatchMediaStub();
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

function CaptureStore({
  onStore,
  children,
}: {
  onStore?: (store: TreeStore) => void;
  children: React.ReactNode;
}) {
  const store = useContext(TreeStateContext)!;
  onStore?.(store);
  return children;
}

async function renderRepertoireInfo(
  initial = defaultTree(),
  id = "repertoire-info-test",
  onStore?: (store: TreeStore) => void,
) {
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
          <TreeStateProvider id={id} initial={initial}>
            <CaptureStore onStore={onStore}>
              <RepertoireInfo />
            </CaptureStore>
          </TreeStateProvider>
        </Provider>
      </MantineProvider>,
    );
    await Promise.resolve();
  });
  await act(async () => store.set(referenceDbAtom, database));
}

test("receives the complete memoized board-state map for transposed nodes", async () => {
  const initial = defaultTree();
  const first = createNode({
    fen: "same w - - 0 1",
    move: parseUci("e2e4")!,
    san: "e4",
    halfMoves: 1,
  });
  const second = createNode({
    fen: "same w - - 0 1",
    move: parseUci("d2d4")!,
    san: "d4",
    halfMoves: 1,
  });
  first.children = [
    createNode({
      fen: "after-e4 b - - 0 1",
      move: parseUci("e7e5")!,
      san: "e5",
      halfMoves: 2,
    }),
  ];
  second.children = [
    createNode({
      fen: "after-d4 b - - 0 1",
      move: parseUci("d7d5")!,
      san: "d5",
      halfMoves: 2,
    }),
  ];
  initial.root.children = [first, second];

  await renderRepertoireInfo(initial, "repertoire-info-transpositions");
  await vi.waitFor(() => expect(mocks.computeTreeCoverage).toHaveBeenCalled());

  const stateMoves = mocks.computeTreeCoverage.mock.calls.at(-1)![5] as Map<
    string,
    Map<string, string>
  >;
  expect(stateMoves.get(getBoardState(first.fen))).toEqual(
    new Map([
      ["e5", getBoardState(first.children[0].fen)],
      ["d5", getBoardState(second.children[0].fen)],
    ]),
  );
});

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

test("coverage completion leaves dirty edits dirty", async () => {
  const initial = defaultTree();
  initial.dirty = true;
  initial.headers.event = "Unsaved user edit";
  let store: TreeStore | undefined;
  await renderRepertoireInfo(initial, "coverage-dirty-stays", (captured) => {
    store = captured;
  });
  await vi.waitFor(() => expect(mocks.computeTreeCoverage).toHaveBeenCalledOnce());
  await act(async () => Promise.resolve());

  expect(store?.getState()).toMatchObject({ dirty: true, headers: { event: "Unsaved user edit" } });
});
