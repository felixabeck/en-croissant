import { WorkspaceTabScope } from "@/state/tabScope";
import { MantineProvider } from "@mantine/core";
import { Provider, createStore } from "jotai";
import { act, useContext } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, onTestFinished, test, vi } from "vitest";
import { TreeStateProvider } from "@/components/common/TreeStateContext";
import { TreeStateContext } from "@/components/common/TreeStateContext";
import type { TreeStore } from "@/state/store/tree";
import { tabStorage } from "@/state/store/tabStorage";
import { activeTabAtom, referenceDbAtom, tabsAtom } from "@/state/atoms";
import { createNode, defaultTree, getBoardState } from "@/utils/treeReducer";
import { parseUci } from "chessops";
import { installMatchMediaStub } from "@/tests/matchMedia";
import RepertoireInfo from "./RepertoireInfo";
import { startFileRevisionPoll } from "@/state/fileFreshness";

const mocks = vi.hoisted(() => ({
  computeTreeCoverage: vi.fn(),
  fetchPositionMoves: vi.fn(),
  notificationShow: vi.fn(),
  collection: vi.fn(async () => null as import("@/bindings").CollectionDescriptor | null),
}));

vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@/platform/tauri", async (original) => {
  const actual = await original<typeof import("@/platform/tauri")>();
  return { ...actual, tauri: { ...actual.tauri, collectionForDatabase: mocks.collection } };
});
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
  vi.resetAllMocks();
  mocks.collection.mockResolvedValue(null);
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
              <WorkspaceTabScope tabId="tab">
                <RepertoireInfo />
              </WorkspaceTabScope>
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

test("renders exact White and Black move labels", async () => {
  const initial = defaultTree();
  const whiteMove = createNode({
    fen: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1",
    move: parseUci("e2e4")!,
    san: "e4",
    halfMoves: 1,
  });
  whiteMove.children = [
    createNode({
      fen: "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2",
      move: parseUci("e7e5")!,
      san: "e5",
      halfMoves: 2,
    }),
  ];
  initial.root.children = [whiteMove];
  let store: TreeStore | undefined;
  await renderRepertoireInfo(initial, "repertoire-info-move-labels", (captured) => {
    store = captured;
  });

  const renderedLabels = () =>
    [...host.querySelectorAll("button p")].map((element) => element.textContent);
  expect(renderedLabels()).toContain("1. e4");

  await act(async () => store?.getState().goToMove([0]));
  expect(renderedLabels()).toContain("1... e5");
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

test("linked reference changes cancel earlier coverage while preserving the live dirty repertoire", async () => {
  const collection: import("@/bindings").CollectionDescriptor = {
    id: "22222222-2222-4222-8222-222222222222",
    name: "Reference",
    file: { id: { id: "source" }, kind: "fileWorkspace" },
    database,
    status: "ready",
    generation: "first",
    omitted: 0,
    account: null,
    retiredDatabase: null,
    fetchSinceMs: null,
  };
  mocks.collection.mockResolvedValue(collection);
  const requests: { signal: AbortSignal; resolve: (value: typeof emptyCoverage) => void }[] = [];
  mocks.computeTreeCoverage.mockImplementation(
    (...args: unknown[]) =>
      new Promise((resolve) => requests.push({ signal: args[6] as AbortSignal, resolve })),
  );
  let focus!: () => void;
  const stop = startFileRevisionPoll({
    getTabs: () => [],
    fileRevision: vi.fn(),
    subscribeFocus: (callback) => {
      focus = callback;
      return () => undefined;
    },
  });
  try {
    const initial = defaultTree();
    initial.dirty = true;
    initial.headers.event = "Live repertoire edits";
    let tree!: TreeStore;
    await renderRepertoireInfo(initial, "linked-coverage-generation", (value) => {
      tree = value;
    });
    await vi.waitFor(() => expect(requests.length).toBeGreaterThan(0));
    const old = requests.at(-1)!;
    expect(old.signal.aborted).toBe(false);
    mocks.collection.mockResolvedValue({ ...collection, generation: "second" });
    await act(async () => {
      focus();
      for (let i = 0; i < 8; i++) await Promise.resolve();
    });
    expect(old.signal.aborted).toBe(true);
    await act(async () => {
      for (const request of requests) request.resolve(emptyCoverage);
    });
    expect(tree.getState()).toMatchObject({
      dirty: true,
      headers: { event: "Live repertoire edits" },
    });
    expect(mocks.notificationShow).not.toHaveBeenCalled();
  } finally {
    stop();
  }
});

test("an unchecked or failed selected reference is unavailable and recovers through the shared focus check without losing dirty edits", async () => {
  let rejectCheck!: (error: unknown) => void;
  mocks.collection.mockReturnValueOnce(
    new Promise((_resolve, reject) => {
      rejectCheck = reject;
    }),
  );
  const initial = defaultTree();
  initial.dirty = true;
  initial.headers.event = "Live unavailable repertoire";
  let tree!: TreeStore;
  let focus!: () => void;
  const stop = startFileRevisionPoll({
    getTabs: () => [],
    fileRevision: vi.fn(),
    subscribeFocus: (callback) => {
      focus = callback;
      return () => undefined;
    },
  });
  try {
    await renderRepertoireInfo(initial, "unavailable-reference", (value) => {
      tree = value;
    });
    // Unverified references must not dispatch coverage.
    expect(mocks.computeTreeCoverage).not.toHaveBeenCalled();
    expect(mocks.fetchPositionMoves).not.toHaveBeenCalled();
    expect(host.textContent).toContain("Collections.Unavailable");
    expect(host.textContent).not.toContain("Board.Practice.Build.NoRefDb");
    await act(async () => rejectCheck(new Error("reference currency failed")));
    expect(host.textContent).toContain("Collections.Unavailable");
    expect(mocks.notificationShow).toHaveBeenCalledWith({
      title: "Common.Error",
      message: "reference currency failed",
      color: "red",
    });
    mocks.collection.mockResolvedValue(null);
    await act(async () => focus());
    expect(host.textContent).not.toContain("Collections.Unavailable");
    expect(mocks.computeTreeCoverage).toHaveBeenCalledOnce();
    expect(tree.getState()).toMatchObject({
      dirty: true,
      headers: { event: "Live unavailable repertoire" },
    });
  } finally {
    stop();
  }
});

test.each(["missing", "preservedOriginal"] as const)(
  "a selected %s reference reports unavailable rather than asking for a new selection",
  async (status) => {
    mocks.collection.mockResolvedValue({
      id: "22222222-2222-4222-8222-222222222222",
      name: "Reference",
      file: { id: { id: "source" }, kind: "fileWorkspace" },
      database,
      status,
      generation: "first",
      omitted: 0,
      account: null,
      retiredDatabase: null,
      fetchSinceMs: null,
    });
    await renderRepertoireInfo();
    expect(host.textContent).toContain("Collections.Unavailable");
    expect(host.textContent).not.toContain("Board.Practice.Build.NoRefDb");
    expect(mocks.computeTreeCoverage).not.toHaveBeenCalled();
  },
);

test("shared teardown clears the debounce scheduled by repertoire edits", async () => {
  let store: TreeStore | undefined;
  await renderRepertoireInfo(defaultTree(), "repertoire-teardown", (captured) => {
    store = captured;
  });
  const schedule = vi.spyOn(globalThis, "setTimeout");
  const clear = vi.spyOn(globalThis, "clearTimeout");
  await act(async () => {
    store!.getState().setHeaders({ ...store!.getState().headers, event: "Edited repertoire" });
  });
  const index = schedule.mock.calls.findLastIndex(([, delay]) => delay === 300);
  expect(index).toBeGreaterThanOrEqual(0);
  const timer = schedule.mock.results[index].value;
  expect(tabStorage.pendingCount()).toBeGreaterThan(0);
  onTestFinished(() => {
    try {
      expect(clear).toHaveBeenCalledWith(timer);
      expect(tabStorage.pendingCount()).toBe(0);
    } finally {
      schedule.mockRestore();
      clear.mockRestore();
    }
  });
});
