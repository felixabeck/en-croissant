import { WorkspaceTabScope } from "@/state/tabScope";
import { MantineProvider } from "@mantine/core";
import { Provider, createStore } from "jotai";
import { act, useContext } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, onTestFinished, test, vi } from "vitest";
import { TreeStateProvider } from "@/components/common/TreeStateContext";
import { TreeStateContext } from "@/components/common/TreeStateContext";
import { createTreeStore, type TreeStore } from "@/state/store/tree";
import { tabStorage } from "@/state/store/tabStorage";
import { activeTabAtom, coverageMinGamesAtom, referenceDbAtom, tabsAtom } from "@/state/atoms";
import { createNode, defaultTree, getBoardState } from "@/utils/treeReducer";
import { parseUci } from "chessops";
import { installMatchMediaStub } from "@/tests/matchMedia";
import RepertoireInfo from "./RepertoireInfo";
import { startFileRevisionPoll } from "@/state/fileFreshness";

const mocks = vi.hoisted(() => ({
  computeTreeCoverage: vi.fn(),
  fetchPositionMoves: vi.fn(),
  searchPosition: vi.fn(),
  notificationShow: vi.fn(),
  collection: vi.fn(async () => null as import("@/bindings").CollectionDescriptor | null),
}));

vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@/utils/db", () => ({ searchPosition: mocks.searchPosition }));
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
  return store;
}

async function realCoverageFixture() {
  const builder = createTreeStore();
  expect(builder.getState().makeMoves({ payload: ["e4", "e5", "Nf3"] }).success).toBe(true);
  builder.getState().goToStart();
  builder.getState().makeMove({ payload: "d4", changePosition: false });
  builder.getState().save();
  const initial = builder.getState();
  builder.dispose();

  const e4 = initial.root.children[0];
  const d4 = initial.root.children[1];
  const e5 = e4.children[0];
  const replies = new Map([
    [getBoardState(initial.root.fen), ["e4", "d4"]],
    [getBoardState(e4.fen), ["e5"]],
    [getBoardState(e5.fen), ["Nf3"]],
    [getBoardState(d4.fen), ["d5"]],
  ]);
  const pending: { signal: AbortSignal; release: () => void }[] = [];
  let hold = false;
  mocks.searchPosition.mockImplementation(
    async ({ fen }: { fen: string }, _operation: string, signal: AbortSignal) => {
      if (hold && fen === getBoardState(initial.root.fen)) {
        // Hold the real algorithm at its database boundary, including late obsolete replies.
        await new Promise<void>((release) => pending.push({ signal, release }));
      }
      return [(replies.get(fen) ?? []).map((move) => ({ move, white: 100, draw: 0, black: 0 }))];
    },
  );
  const actual = await vi.importActual<typeof import("@/utils/repertoire")>("@/utils/repertoire");
  mocks.computeTreeCoverage.mockImplementation(actual.computeTreeCoverage);
  return { initial, pending, hold: () => (hold = true) };
}

function moveRow(san: string) {
  const row = [...host.querySelectorAll("button")].find((button) =>
    [...button.querySelectorAll("p")].some((label) => label.textContent === `1. ${san}`),
  );
  expect(row).toBeDefined();
  return row!;
}

function renderedCoverage(san: string) {
  return moveRow(san)
    .querySelectorAll('[role="progressbar"]')
    .item(3)
    ?.getAttribute("aria-valuenow");
}

test.each(["Save", "autosave"])(
  "%s during actual promoted coverage preserves current paths and reaches terminal loading",
  async (saveKind) => {
    const fixture = await realCoverageFixture();
    let tree!: TreeStore;
    await renderRepertoireInfo(fixture.initial, `coverage-promote-${saveKind}`, (value) => {
      tree = value;
    });
    expect(tree.getState().dirty).toBe(false);
    expect(renderedCoverage("e4")).toBe("100");
    expect(renderedCoverage("d4")).toBe("3");
    expect(host.textContent).not.toContain("Board.Practice.Build.Loading");

    fixture.hold();
    await act(async () => tree.getState().promoteVariation([1]));
    expect(fixture.pending).toHaveLength(1);
    expect(tree.getState().root.children.map((node) => node.san)).toEqual(["d4", "e4"]);
    expect(tree.getState().dirty).toBe(true);
    expect(host.textContent).toContain("Board.Practice.Build.Loading");
    await act(async () => {
      // Both saveToFile routes finish through this store action. Autosave supplies the write stamp.
      tree.getState().save(saveKind === "autosave" ? "b".repeat(64) : undefined);
    });
    expect(tree.getState().dirty).toBe(false);
    await act(async () => {
      for (const request of fixture.pending) request.release();
    });

    // Coverage must follow the move's meaning at its newly derived path.
    expect(renderedCoverage("d4")).toBe("3");
    expect(renderedCoverage("e4")).toBe("100");
    expect(host.textContent).not.toContain("Board.Practice.Build.Loading");
    const result = await mocks.computeTreeCoverage.mock.results.at(-1)!.value;
    expect([...result.coverageMap.entries()]).toEqual(
      expect.arrayContaining([
        ["0", 0],
        ["1", 1],
        ["1,0", 1],
        ["1,0,0", 1],
      ]),
    );
    await act(async () => moveRow("e4").click());
    expect(tree.getState().position).toEqual([1]);
    expect(mocks.notificationShow).not.toHaveBeenCalled();
  },
);

test("unchanged coverage inputs preserve completed work across dirty, Save and navigation", async () => {
  const fixture = await realCoverageFixture();
  let tree!: TreeStore;
  tabStorage.seed("coverage-unchanged", fixture.initial);
  await renderRepertoireInfo(defaultTree(), "coverage-unchanged", (value) => {
    tree = value;
  });
  const originalRoot = tree.getState().root;
  expect(renderedCoverage("e4")).toBe("100");
  const computations = mocks.computeTreeCoverage.mock.calls.length;
  await act(async () => {
    tree.getState().setHeaders({ ...tree.getState().headers, event: "Metadata edit" });
  });
  expect(tree.getState().dirty).toBe(true);
  await act(async () => tree.getState().save());
  await act(async () => tree.getState().goToMove([0]));
  await act(async () => tree.getState().goToStart());
  expect(tree.getState().root).toBe(originalRoot);
  expect(mocks.computeTreeCoverage).toHaveBeenCalledTimes(computations);
  expect(renderedCoverage("e4")).toBe("100");
  expect(renderedCoverage("d4")).toBe("3");
  expect(host.textContent).not.toContain("Board.Practice.Build.Loading");
});

test("superseded actual tree computations cannot publish after a newer promotion", async () => {
  const fixture = await realCoverageFixture();
  let tree!: TreeStore;
  await renderRepertoireInfo(fixture.initial, "coverage-superseded", (value) => {
    tree = value;
  });
  fixture.hold();
  await act(async () => tree.getState().promoteVariation([1]));
  const obsolete = fixture.pending[0];
  await act(async () => tree.getState().promoteVariation([1]));
  expect(fixture.pending).toHaveLength(2);
  expect(obsolete.signal.aborted).toBe(true);
  await act(async () => tree.getState().save());
  await act(async () => obsolete.release());
  expect(host.textContent).toContain("Board.Practice.Build.Loading");
  expect(renderedCoverage("e4")).toBe("3");
  await act(async () => fixture.pending[1].release());
  expect(renderedCoverage("e4")).toBe("100");
  expect(renderedCoverage("d4")).toBe("3");
  expect(host.textContent).not.toContain("Board.Practice.Build.Loading");
  expect(mocks.notificationShow).not.toHaveBeenCalled();
});

test("reference loss cancels actual coverage and clean recovery recomputes current paths", async () => {
  const fixture = await realCoverageFixture();
  let tree!: TreeStore;
  const atoms = await renderRepertoireInfo(fixture.initial, "coverage-reference-loss", (value) => {
    tree = value;
  });
  fixture.hold();
  await act(async () => tree.getState().promoteVariation([1]));
  await act(async () => tree.getState().save());
  await act(async () => atoms.set(referenceDbAtom, null));
  expect(fixture.pending[0].signal.aborted).toBe(true);
  await act(async () => fixture.pending[0].release());
  expect(host.textContent).toContain("Board.Practice.Build.NoRefDb");
  await act(async () => atoms.set(referenceDbAtom, database));
  expect(fixture.pending).toHaveLength(2);
  await act(async () => fixture.pending[1].release());
  expect(renderedCoverage("d4")).toBe("3");
  expect(renderedCoverage("e4")).toBe("100");
  expect(host.textContent).not.toContain("Board.Practice.Build.Loading");
  expect(mocks.notificationShow).not.toHaveBeenCalled();
});

test("a new linked generation supersedes actual clean coverage and settles only its own work", async () => {
  const fixture = await realCoverageFixture();
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
    let tree!: TreeStore;
    const atoms = await renderRepertoireInfo(
      fixture.initial,
      "coverage-clean-generation",
      (value) => {
        tree = value;
      },
    );
    expect(renderedCoverage("d4")).toBe("3");
    fixture.hold();
    await act(async () => atoms.set(coverageMinGamesAtom, 101));
    expect(fixture.pending).toHaveLength(1);
    const obsolete = fixture.pending[0];
    mocks.collection.mockResolvedValue({ ...collection, generation: "second" });
    await act(async () => focus());
    expect(fixture.pending).toHaveLength(2);
    expect(obsolete.signal.aborted).toBe(true);
    await act(async () => obsolete.release());
    expect(host.textContent).toContain("Board.Practice.Build.Loading");
    await act(async () => fixture.pending[1].release());
    expect(tree.getState().dirty).toBe(false);
    expect(host.textContent).not.toContain("Board.Practice.Build.Loading");
    const result = await mocks.computeTreeCoverage.mock.results.at(-1)!.value;
    expect(result.coverageMap.get("1")).toBe(1);
    expect(mocks.notificationShow).not.toHaveBeenCalled();
  } finally {
    stop();
  }
});

test.each([
  {
    input: "orientation",
    orientation: "black",
    minGames: 50,
    startPath: [],
    paths: ["", "0", "0,0", "0,0,0", "1"],
    rootIncluded: true,
    d4Coverage: 0,
  },
  {
    input: "minGames",
    orientation: "white",
    minGames: 101,
    startPath: [],
    paths: ["", "0", "0,0", "0,0,0", "1"],
    rootIncluded: true,
    d4Coverage: 1,
  },
  {
    input: "startPath",
    orientation: "white",
    minGames: 50,
    startPath: [0],
    paths: ["0", "0,0", "0,0,0"],
    rootIncluded: false,
    d4Coverage: undefined,
  },
])("clean coverage recomputes after $input changes", async ({ input, ...expected }) => {
  const fixture = await realCoverageFixture();
  let tree!: TreeStore;
  const atoms = await renderRepertoireInfo(fixture.initial, `coverage-input-${input}`, (value) => {
    tree = value;
  });
  const computations = mocks.computeTreeCoverage.mock.calls.length;
  await act(async () => {
    if (input === "orientation") {
      tree.getState().setHeaders({ ...tree.getState().headers, orientation: "black" });
    } else if (input === "minGames") {
      atoms.set(coverageMinGamesAtom, 101);
    } else {
      tree.getState().setStart([0]);
    }
    tree.getState().save();
  });
  expect(tree.getState().dirty).toBe(false);
  expect(mocks.computeTreeCoverage).toHaveBeenCalledTimes(computations + 1);
  const args = mocks.computeTreeCoverage.mock.calls.at(-1)!;
  const result = await mocks.computeTreeCoverage.mock.results.at(-1)!.value;
  expect({
    orientation: args[1],
    minGames: args[3],
    startPath: args[4],
    paths: [...result.coverageMap.keys()],
    rootIncluded: args[5].has(getBoardState(fixture.initial.root.fen)),
    d4Coverage: result.coverageMap.get("1"),
  }).toEqual(expected);
  expect(host.textContent).not.toContain("Board.Practice.Build.Loading");
});

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
