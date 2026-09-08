import { act, StrictMode, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { getDefaultStore } from "jotai";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const fixtures = vi.hoisted(() => ({
  abortGame: vi.fn(),
  appendMove: vi.fn(),
  getGameEngineLogs: vi.fn(),
  getGameState: vi.fn(),
  listeners: new Map<string, (event: any) => void>(),
  listenerErrors: new Map<string, (error: unknown, event: any) => void>(),
  makeGameMove: vi.fn(),
  notify: vi.fn(),
  logRefresh: null as null | (() => Promise<void>),
  logColorChange: null as null | ((value: string) => void),
  onMove: null as null | ((uci: string) => Promise<boolean>),
  onTakeBack: null as null | (() => Promise<void>),
  boardProps: null as any,
  playPremove: vi.fn(),
  queuePremove: vi.fn(),
  resignGame: vi.fn(),
  resetTree: vi.fn(),
  setEngineLogs: [] as unknown[],
  setHeaders: vi.fn(),
  setResult: vi.fn(),
  startGame: vi.fn(),
  takeBackGameMove: vi.fn(),
  tree: null as any,
  treeStore: null as any,
}));

vi.mock("@/state/atoms", async () => {
  const { atom } = await vi.importActual<typeof import("jotai")>("jotai");
  const { atomFamily } = await vi.importActual<typeof import("jotai/utils")>("jotai/utils");
  return {
    activeTabAtom: atom<string | null>("tab-a"),
    closingTabsAtom: atom<Set<string>>(new Set<string>()),
    flipBoardAfterMoveAtom: atom(false),
    gameIdFamily: atomFamily(() => atom<string | null>(null)),
    gameSessionFamily: atomFamily(() => atom<bigint | null>(null)),
    gameStateFamily: atomFamily(() => atom<"settingUp" | "playing" | "gameOver">("settingUp")),
    pendingGameStartFamily: atomFamily(() => atom<Promise<void> | null>(null)),
    playersFamily: atomFamily(() =>
      atom({ white: { type: "human", name: "White" }, black: { type: "human", name: "Black" } }),
    ),
    gameInputColorAtom: atom<"white" | "black" | "random">("white"),
    gamePlayer1SettingsAtom: atom<any>({ type: "human", name: "Alice" }),
    gamePlayer2SettingsAtom: atom<any>({ type: "human", name: "Bob" }),
    gameOpeningBookHandleAtom: atom<any>(null),
    gameOpeningBookEnabledAtom: atom(false),
    gameOpeningBookMaxPlyAtom: atom(20),
    gameSameTimeControlAtom: atom(true),
    tabsAtom: atom<any[]>([]),
  };
});

vi.mock("zustand", () => ({
  useStore: (_store: unknown, selector: (state: unknown) => unknown) => selector(fixtures.tree),
}));
vi.mock("@/utils/chessops", () => ({ positionFromFen: () => [{ turn: "white" }, null] }));
vi.mock("@/platform/tauri", () => {
  const subscribe = (name: string) =>
    vi.fn(async (listener, onError) => {
      fixtures.listeners.set(name, listener);
      fixtures.listenerErrors.set(name, onError);
      return vi.fn();
    });
  return {
    tauri: {
      abortGame: fixtures.abortGame,
      getGameEngineLogs: fixtures.getGameEngineLogs,
      getGameState: fixtures.getGameState,
      makeGameMove: fixtures.makeGameMove,
      resignGame: fixtures.resignGame,
      startGame: fixtures.startGame,
      takeBackGameMove: fixtures.takeBackGameMove,
    },
    tauriSubscriptions: {
      gameMove: subscribe("gameMove"),
      clockUpdate: subscribe("clockUpdate"),
      gameOver: subscribe("gameOver"),
    },
  };
});
vi.mock("@/components/files/notifyError", () => ({
  notifyListenerError: fixtures.notify,
  notifyUnlessCancelled: fixtures.notify,
  runUnlessCancelled: async (_title: string, run: () => Promise<unknown>) => run(),
}));
vi.mock("@mantine/hooks", () => ({
  useToggle: () => {
    const [value, setValue] = useState(false);
    return [value, () => setValue((current) => !current)] as const;
  },
}));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@mantine/core", () => {
  const Box = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>;
  return {
    Box,
    Button: ({ children, onClick, disabled, loading }: any) => (
      <button
        type="button"
        onClick={onClick}
        disabled={disabled || loading}
        data-loading={loading ? "true" : "false"}
      >
        {children}
      </button>
    ),
    Checkbox: () => null,
    Divider: () => null,
    Group: Box,
    NumberInput: () => null,
    Paper: Box,
    Portal: Box,
    ScrollArea: Box,
    SegmentedControl: ({ data, value, onChange }: any) => {
      fixtures.logColorChange = onChange;
      return (
        <div>
          {data.map((item: any) => {
            const option = typeof item === "string" ? item : item.value;
            return (
              <button
                type="button"
                key={option}
                aria-pressed={value === option}
                onClick={() => onChange(option)}
              >
                {option}
              </button>
            );
          })}
        </div>
      );
    },
    Stack: Box,
    Text: ({ children, role }: any) => <div role={role}>{children}</div>,
  };
});
vi.mock("./OpponentForm", () => ({ OpponentForm: () => null }));
vi.mock("./Board", () => ({
  default: (props: { onMove: (uci: string) => Promise<boolean> }) => {
    const { onMove } = props;
    fixtures.onMove = onMove;
    fixtures.boardProps = props;
    if ((props as any).cgRef) {
      (props as any).cgRef.current = {
        playPremove: fixtures.playPremove,
        queuePremove: fixtures.queuePremove,
      };
    }
    return null;
  },
}));
vi.mock("./BoardControls", () => ({
  default: ({ onTakeBack }: { onTakeBack: () => Promise<void> }) => {
    fixtures.onTakeBack = onTakeBack;
    return null;
  },
}));
vi.mock("./EditingCard", () => ({ default: () => null }));
vi.mock("../common/EngineLogsView", () => ({
  default: ({ logs, onRefresh, additionalControls }: any) => {
    fixtures.setEngineLogs = logs;
    fixtures.logRefresh = onRefresh;
    return <>{additionalControls}</>;
  },
}));
vi.mock("../common/FileInput", () => ({ default: () => null }));
vi.mock("../common/GameInfo", () => ({ default: () => null }));
vi.mock("../common/GameNotation", () => ({
  default: ({ controls }: { controls?: React.ReactNode }) => <>{controls}</>,
}));
vi.mock("../common/MoveControls", () => ({ default: () => null }));
vi.mock("../common/IconAction", () => ({
  default: ({ label, onClick }: any) => (
    <button type="button" onClick={onClick}>
      {label}
    </button>
  ),
}));

import {
  closingTabsAtom,
  flipBoardAfterMoveAtom,
  gameIdFamily,
  gamePlayer1SettingsAtom,
  gamePlayer2SettingsAtom,
  gameSessionFamily,
  gameStateFamily,
  pendingGameStartFamily,
} from "@/state/atoms";
import BoardGame from "./BoardGame";
import { INITIAL_FEN } from "chessops/fen";
import { TreeStateContext } from "../common/TreeStateContext";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const store = getDefaultStore();
let host: HTMLDivElement;
let root: Root;

function state(overrides: Record<string, unknown> = {}) {
  return {
    gameId: "game",
    session: 1n,
    revision: 0n,
    status: "playing",
    initialFen: INITIAL_FEN,
    currentFen: INITIAL_FEN,
    moves: [],
    ply: 0,
    turn: "white",
    whitePlayer: "Alice",
    blackPlayer: "Bob",
    whiteTime: null,
    blackTime: null,
    ...overrides,
  };
}

function engine(id: string) {
  return {
    type: "local" as const,
    id,
    name: `Engine ${id}`,
    version: "1",
    filename: id,
    handle: { id: { id }, kind: "engine" as const },
    settings: [],
  };
}

function button(label: string) {
  const found = [...host.querySelectorAll("button")].find((item) => item.textContent === label);
  if (!found) throw new Error(`Missing button ${label}`);
  return found;
}

function treeMoves() {
  const moves: any[] = [];
  let node = fixtures.tree.root;
  while (node.children.length) {
    node = node.children[0];
    moves.push(node.move);
  }
  return moves;
}

async function render(tabId = "tab-a") {
  await act(async () =>
    root.render(
      <TreeStateContext.Provider value={fixtures.treeStore}>
        <BoardGame tabId={tabId} />
      </TreeStateContext.Provider>,
    ),
  );
}

async function start() {
  await act(async () => button("Board.Opponent.StartGame").click());
  const pending = store.get(pendingGameStartFamily("tab-a"));
  if (pending) await act(async () => pending);
}

beforeEach(() => {
  vi.clearAllMocks();
  fixtures.listeners.clear();
  fixtures.listenerErrors.clear();
  fixtures.onMove = null;
  fixtures.onTakeBack = null;
  fixtures.logRefresh = null;
  fixtures.logColorChange = null;
  fixtures.boardProps = null;
  fixtures.queuePremove.mockReturnValue(true);
  fixtures.setEngineLogs = [];
  const rootNode = () => ({ fen: INITIAL_FEN, children: [] as any[] });
  fixtures.tree = {
    root: rootNode(),
    headers: {} as Record<string, unknown>,
    setFen: vi.fn((fen: string) => {
      fixtures.tree.root = { fen, children: [] };
    }),
    setHeaders: vi.fn((headers: Record<string, unknown>) => {
      fixtures.tree.headers = headers;
      fixtures.setHeaders(headers);
    }),
    setResult: vi.fn((result: string) => {
      fixtures.tree.headers = { ...fixtures.tree.headers, result };
      fixtures.setResult(result);
    }),
    appendMove: vi.fn(({ payload, clock }: any) => {
      let node = fixtures.tree.root;
      while (node.children.length) node = node.children[0];
      const child = { fen: node.fen, move: payload, clock, children: [] };
      node.children.push(child);
      fixtures.appendMove({ payload, clock });
    }),
    reset: vi.fn(() => {
      fixtures.tree.root = rootNode();
      fixtures.tree.headers = {};
      fixtures.resetTree();
    }),
  };
  fixtures.treeStore = {
    getState: () => fixtures.tree,
    setState: vi.fn(),
    subscribe: vi.fn(() => vi.fn()),
  };
  store.set(closingTabsAtom, new Set());
  store.set(flipBoardAfterMoveAtom, false);
  for (const tabId of ["tab-a", "tab-b"]) {
    store.set(gameIdFamily(tabId), null);
    store.set(gameSessionFamily(tabId), null);
    store.set(gameStateFamily(tabId), "settingUp");
    store.set(pendingGameStartFamily(tabId), null);
  }
  store.set(gamePlayer1SettingsAtom, { type: "human", name: "Alice" });
  store.set(gamePlayer2SettingsAtom, { type: "human", name: "Bob" });
  fixtures.abortGame.mockResolvedValue(undefined);
  fixtures.getGameEngineLogs.mockResolvedValue([]);
  fixtures.getGameState.mockImplementation(async (gameId, session) => state({ gameId, session }));
  fixtures.startGame.mockImplementation(async (gameId) => state({ gameId }));
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});

test("starting a human game sends numeric configuration and records ChessFable as the PGN Site", async () => {
  await render();
  await start();
  expect(fixtures.startGame).toHaveBeenCalledOnce();
  expect(fixtures.startGame.mock.calls[0][1]).toMatchObject({
    white: { type: "human", name: "Alice" },
    whiteTimeControl: null,
    openingBook: null,
  });
  expect(() => JSON.stringify(fixtures.startGame.mock.calls[0][1])).not.toThrow();
  expect(fixtures.setHeaders).toHaveBeenCalledWith(expect.objectContaining({ site: "ChessFable" }));
});

test("a deferred start keeps real loading and disabled semantics until admission settles", async () => {
  const reply = Promise.withResolvers<any>();
  fixtures.startGame.mockReturnValue(reply.promise);
  await render();
  await act(async () => button("Board.Opponent.StartGame").click());
  const startButton = button("Board.Opponent.StartGame") as HTMLButtonElement;
  expect(startButton.disabled).toBe(true);
  expect(startButton.dataset.loading).toBe("true");
  expect(store.get(pendingGameStartFamily("tab-a"))).not.toBeNull();
  const gameId = fixtures.startGame.mock.calls[0][0];
  await act(async () => reply.resolve(state({ gameId })));
  expect(store.get(pendingGameStartFamily("tab-a"))).toBeNull();
});

test("auto-flip after a terminal human move preserves live result and headers", async () => {
  const mateFen = "7k/8/5KQ1/8/8/8/8/8 w - - 0 1";
  fixtures.tree.root = { fen: mateFen, children: [] };
  store.set(flipBoardAfterMoveAtom, true);
  fixtures.startGame.mockImplementationOnce(async (gameId) =>
    state({ gameId, initialFen: mateFen, currentFen: mateFen }),
  );
  fixtures.makeGameMove.mockImplementationOnce(async (gameId, session) =>
    state({
      gameId,
      session,
      initialFen: mateFen,
      currentFen: "7k/6Q1/5K2/8/8/8/8/8 b - - 1 1",
      revision: 1n,
      status: {
        finished: { result: { type: "whiteWins", reason: "checkmate" } },
      },
      moves: [{ uci: "g6g7", clock: null }],
    }),
  );
  await render();
  await start();
  fixtures.tree.setHeaders({ ...fixtures.tree.headers, event: "Concurrent header edit" });
  await act(async () => fixtures.onMove!("g6g7"));
  expect(fixtures.tree.headers).toEqual(
    expect.objectContaining({
      result: "1-0",
      orientation: "black",
      site: "ChessFable",
      event: "Concurrent header edit",
    }),
  );
});

test("start remains loading through prior cleanup and native admission", async () => {
  const cleanup = Promise.withResolvers<void>();
  const reply = Promise.withResolvers<any>();
  await render();
  store.set(gameIdFamily("tab-a"), "retained");
  store.set(gameSessionFamily("tab-a"), 7n);
  await act(async () => Promise.resolve());
  fixtures.abortGame.mockReturnValueOnce(cleanup.promise);
  fixtures.startGame.mockReturnValueOnce(reply.promise);
  await act(async () => button("Board.Opponent.StartGame").click());
  expect((button("Board.Opponent.StartGame") as HTMLButtonElement).dataset.loading).toBe("true");
  expect(fixtures.startGame).not.toHaveBeenCalled();
  await act(async () => cleanup.resolve());
  expect(fixtures.startGame).toHaveBeenCalledOnce();
  expect((button("Board.Opponent.StartGame") as HTMLButtonElement).dataset.loading).toBe("true");
  const gameId = fixtures.startGame.mock.calls[0][0];
  await act(async () => reply.resolve(state({ gameId })));
  expect(store.get(pendingGameStartFamily("tab-a"))).toBeNull();
});

test("automatic initial log open applies its successful response", async () => {
  const logs = Promise.withResolvers<any>();
  fixtures.getGameEngineLogs.mockReturnValue(logs.promise);
  store.set(gamePlayer1SettingsAtom, {
    type: "engine",
    engine: engine("automatic-logs"),
    go: { t: "Infinite" },
  });
  await render();
  await start();
  await act(async () => button("Board.Analysis.Logs").click());
  await act(async () => logs.resolve([{ type: "gui", value: "automatic" }]));
  expect(fixtures.setEngineLogs).toEqual([{ type: "gui", value: "automatic" }]);
});

test("automatic initial log open reports its current failure", async () => {
  const logs = Promise.withResolvers<any>();
  fixtures.getGameEngineLogs.mockReturnValue(logs.promise);
  store.set(gamePlayer1SettingsAtom, {
    type: "engine",
    engine: engine("automatic-log-error"),
    go: { t: "Infinite" },
  });
  await render();
  await start();
  await act(async () => button("Board.Analysis.Logs").click());
  await act(async () => logs.reject(new Error("initial logs failed")));
  expect(fixtures.notify).toHaveBeenCalledWith("Common.Error", expect.any(Error));
});

test.each(["success", "failure"] as const)(
  "an effective log colour switch applies its current %s",
  async (outcome) => {
    const initial = Promise.withResolvers<any>();
    const switched = Promise.withResolvers<any>();
    fixtures.getGameEngineLogs
      .mockReset()
      .mockReturnValueOnce(initial.promise)
      .mockReturnValueOnce(switched.promise);
    store.set(gamePlayer1SettingsAtom, {
      type: "engine",
      engine: engine("white-logs"),
      go: { t: "Infinite" },
    });
    store.set(gamePlayer2SettingsAtom, {
      type: "engine",
      engine: engine("black-logs"),
      go: { t: "Infinite" },
    });
    await render();
    await start();
    await act(async () => button("Board.Analysis.Logs").click());
    await act(async () => initial.resolve([{ type: "gui", value: "white" }]));
    expect(fixtures.getGameEngineLogs).toHaveBeenLastCalledWith(expect.any(String), 1n, "white");
    await act(async () => fixtures.logColorChange!("black"));
    expect(fixtures.getGameEngineLogs).toHaveBeenCalledTimes(2);
    expect(fixtures.getGameEngineLogs).toHaveBeenLastCalledWith(expect.any(String), 1n, "black");
    fixtures.notify.mockClear();
    if (outcome === "success") {
      await act(async () => switched.resolve([{ type: "gui", value: "black" }]));
      expect(fixtures.setEngineLogs).toEqual([{ type: "gui", value: "black" }]);
      expect(fixtures.notify).not.toHaveBeenCalled();
    } else {
      await act(async () => switched.reject(new Error("black logs failed")));
      expect(fixtures.notify).toHaveBeenCalledWith("Common.Error", expect.any(Error));
    }
  },
);

test.each(["resolve", "reject"] as const)(
  "colour intent synchronously invalidates an old log request that will %s",
  async (outcome) => {
    const oldWhite = Promise.withResolvers<any>();
    const currentBlack = Promise.withResolvers<any>();
    fixtures.getGameEngineLogs
      .mockReset()
      .mockReturnValueOnce(oldWhite.promise)
      .mockReturnValueOnce(currentBlack.promise);
    store.set(gamePlayer1SettingsAtom, {
      type: "engine",
      engine: engine("intent-white"),
      go: { t: "Infinite" },
    });
    store.set(gamePlayer2SettingsAtom, {
      type: "engine",
      engine: engine("intent-black"),
      go: { t: "Infinite" },
    });
    await render();
    await start();
    await act(async () => button("Board.Analysis.Logs").click());
    fixtures.notify.mockClear();
    await act(async () => {
      fixtures.logColorChange!("black");
      if (outcome === "resolve") {
        oldWhite.resolve([{ type: "gui", value: "stale white" }]);
      } else {
        oldWhite.reject(new Error("stale white failure"));
      }
      await Promise.resolve();
    });
    expect(fixtures.setEngineLogs).toEqual([]);
    expect(fixtures.notify).not.toHaveBeenCalled();
    await act(async () => currentBlack.resolve([{ type: "gui", value: "current black" }]));
    expect(fixtures.setEngineLogs).toEqual([{ type: "gui", value: "current black" }]);
  },
);

test.each(["resolve", "reject"] as const)(
  "close intent synchronously invalidates an old log request that will %s",
  async (outcome) => {
    const oldRefresh = Promise.withResolvers<any>();
    fixtures.getGameEngineLogs
      .mockReset()
      .mockResolvedValueOnce([{ type: "gui", value: "initial" }])
      .mockReturnValueOnce(oldRefresh.promise);
    store.set(gamePlayer1SettingsAtom, {
      type: "engine",
      engine: engine("close-intent"),
      go: { t: "Infinite" },
    });
    await render();
    await start();
    await act(async () => button("Board.Analysis.Logs").click());
    expect(fixtures.setEngineLogs).toEqual([{ type: "gui", value: "initial" }]);
    act(() => void fixtures.logRefresh!());
    fixtures.notify.mockClear();
    await act(async () => {
      button("EngineLogs.Close").click();
      if (outcome === "resolve") {
        oldRefresh.resolve([{ type: "gui", value: "stale closed" }]);
      } else {
        oldRefresh.reject(new Error("stale closed failure"));
      }
      await Promise.resolve();
    });
    expect(fixtures.setEngineLogs).toEqual([{ type: "gui", value: "initial" }]);
    expect(fixtures.notify).not.toHaveBeenCalled();
  },
);

const terminalStarts = [
  {
    name: "checkmate",
    result: { type: "whiteWins", reason: "checkmate" },
    outcome: "1-0",
    initialFen: "7k/8/5KQ1/8/8/8/8/8 w - - 0 1",
    moves: [{ uci: "g6g7", clock: null }],
    expectedMoves: [expect.objectContaining({ from: 46, to: 54 })],
  },
  {
    name: "stalemate",
    result: { type: "draw", reason: "stalemate" },
    outcome: "1/2-1/2",
    initialFen: "7k/5K2/6Q1/8/8/8/8/8 b - - 0 1",
    moves: [],
    expectedMoves: [],
  },
] as const;

test.each(terminalStarts)(
  "a terminal $name start completes without any event and relinquishes ownership",
  async ({ result, outcome, initialFen, moves, expectedMoves }) => {
    fixtures.startGame.mockImplementation(async (gameId) =>
      state({ gameId, initialFen, status: { finished: { result } }, moves }),
    );
    await render();
    await start();
    expect(store.get(gameStateFamily("tab-a"))).toBe("gameOver");
    expect(store.get(gameIdFamily("tab-a"))).toBeNull();
    expect(store.get(gameSessionFamily("tab-a"))).toBeNull();
    expect(fixtures.tree.headers.result).toBe(outcome);
    expect(treeMoves()).toEqual(expectedMoves);
    await act(async () => button("Home.NewGame").click());
    expect(fixtures.abortGame).not.toHaveBeenCalled();
  },
);

test.each(terminalStarts)(
  "GameOver before $name start adoption converges on the terminal response",
  async ({ result, outcome, initialFen, moves, expectedMoves }) => {
    const startReply = Promise.withResolvers<any>();
    fixtures.startGame.mockReturnValue(startReply.promise);
    await render();
    act(() => button("Board.Opponent.StartGame").click());
    const gameId = fixtures.startGame.mock.calls[0][0];
    fixtures.listeners.get("gameOver")?.({
      payload: { gameId, session: 1n, revision: 1n, result, moves },
    });
    await act(async () =>
      startReply.resolve(
        state({ gameId, initialFen, revision: 1n, status: { finished: { result } }, moves }),
      ),
    );
    expect(store.get(gameStateFamily("tab-a"))).toBe("gameOver");
    expect(store.get(gameIdFamily("tab-a"))).toBeNull();
    expect(store.get(gameSessionFamily("tab-a"))).toBeNull();
    expect(fixtures.tree.headers.result).toBe(outcome);
    expect(treeMoves()).toEqual(expectedMoves);
    expect(fixtures.abortGame).not.toHaveBeenCalled();
  },
);

test("a post-adoption query reconciles a terminal event that raced a live start", async () => {
  const poll = Promise.withResolvers<any>();
  fixtures.getGameState.mockReturnValueOnce(poll.promise);
  await render();
  await start();
  const gameId = store.get(gameIdFamily("tab-a"));
  await act(async () =>
    poll.resolve(
      state({
        gameId,
        revision: 2n,
        status: { finished: { result: { type: "whiteWins", reason: "checkmate" } } },
      }),
    ),
  );
  expect(store.get(gameStateFamily("tab-a"))).toBe("gameOver");
  expect(store.get(gameIdFamily("tab-a"))).toBeNull();
});

test("an authoritative reply with the current game id but another session is ignored", async () => {
  const poll = Promise.withResolvers<any>();
  fixtures.getGameState.mockReturnValueOnce(poll.promise);
  await render();
  await start();
  fixtures.appendMove.mockClear();
  fixtures.setResult.mockClear();
  const gameId = store.get(gameIdFamily("tab-a"));
  await act(async () =>
    poll.resolve(
      state({
        gameId,
        session: 2n,
        revision: 9n,
        whiteTime: 1n,
        blackTime: 2n,
        moves: [{ uci: "e2e4", clock: 1n }],
        status: { finished: { result: { type: "whiteWins", reason: "checkmate" } } },
      }),
    ),
  );
  expect(fixtures.appendMove).not.toHaveBeenCalled();
  expect(fixtures.setResult).not.toHaveBeenCalled();
  expect(store.get(gameStateFamily("tab-a"))).toBe("playing");
  expect(fixtures.boardProps.whiteTime).toBeUndefined();
  expect(fixtures.boardProps.blackTime).toBeUndefined();
});

test("natural GameOver is terminal against later clock and command rejection", async () => {
  const move = Promise.withResolvers<any>();
  fixtures.makeGameMove.mockReturnValue(move.promise);
  await render();
  await start();
  const gameId = store.get(gameIdFamily("tab-a"));
  let movePromise!: Promise<boolean>;
  act(() => {
    movePromise = fixtures.onMove!("e2e4");
  });
  await act(async () =>
    fixtures.listeners.get("gameOver")?.({
      payload: {
        gameId,
        session: 1n,
        revision: 3n,
        result: { type: "draw", reason: "stalemate" },
        moves: [],
      },
    }),
  );
  await act(async () =>
    fixtures.listeners.get("clockUpdate")?.({
      payload: { gameId, session: 1n, revision: 4n, whiteTime: 1n, blackTime: 1n },
    }),
  );
  await act(async () => move.reject(new Error("late move failure")));
  await movePromise;
  expect(store.get(gameStateFamily("tab-a"))).toBe("gameOver");
  expect(host.querySelector('[role="alert"]')).toBeNull();
  await act(async () => root.unmount());
  expect(fixtures.abortGame).not.toHaveBeenCalled();
  root = createRoot(host);
});

test("a resignation response applies terminal moves and clears abortable ownership", async () => {
  fixtures.resignGame.mockImplementation(async (gameId, session) =>
    state({
      gameId,
      session,
      revision: 1n,
      status: { finished: { result: { type: "blackWins", reason: "resignation" } } },
    }),
  );
  await render();
  await start();
  await act(async () => button("Board.Opponent.Resign").click());
  expect(store.get(gameStateFamily("tab-a"))).toBe("gameOver");
  expect(store.get(gameIdFamily("tab-a"))).toBeNull();
  expect(store.get(gameSessionFamily("tab-a"))).toBeNull();
});

test("abort success clears ownership and reset or unmount cannot abort it twice", async () => {
  store.set(gamePlayer1SettingsAtom, {
    type: "engine",
    engine: engine("white"),
    go: { t: "Infinite" },
  });
  store.set(gamePlayer2SettingsAtom, {
    type: "engine",
    engine: engine("black"),
    go: { t: "Infinite" },
  });
  await render();
  await start();
  fixtures.abortGame.mockClear();
  await act(async () => button("Board.Opponent.Abort").click());
  expect(fixtures.abortGame).toHaveBeenCalledOnce();
  expect(store.get(gameStateFamily("tab-a"))).toBe("gameOver");
  expect(store.get(gameIdFamily("tab-a"))).toBeNull();
  await act(async () => button("Home.NewGame").click());
  await act(async () => root.unmount());
  expect(fixtures.abortGame).toHaveBeenCalledOnce();
  root = createRoot(host);
});

test("terminal handoff makes a late takeback catch and finally silent", async () => {
  const takeback = Promise.withResolvers<any>();
  fixtures.takeBackGameMove.mockReturnValue(takeback.promise);
  await render();
  await start();
  const gameId = store.get(gameIdFamily("tab-a"));
  act(() => void fixtures.onTakeBack!());
  await act(async () =>
    fixtures.listeners.get("gameOver")?.({
      payload: {
        gameId,
        session: 1n,
        revision: 2n,
        result: { type: "draw", reason: "stalemate" },
        moves: [],
      },
    }),
  );
  await act(async () => takeback.reject(new Error("late takeback")));
  expect(store.get(gameStateFamily("tab-a"))).toBe("gameOver");
  expect(host.querySelector('[role="alert"]')).toBeNull();
});

test.each(["move", "takeback", "abort", "resign"] as const)(
  "stale %s catch and finally cannot clear a replacement start token",
  async (command) => {
    if (command === "abort") {
      store.set(gamePlayer1SettingsAtom, {
        type: "engine",
        engine: engine("abort-white"),
        go: { t: "Infinite" },
      });
      store.set(gamePlayer2SettingsAtom, {
        type: "engine",
        engine: engine("abort-black"),
        go: { t: "Infinite" },
      });
    }
    const oldCommand = Promise.withResolvers<any>();
    if (command === "move") fixtures.makeGameMove.mockReturnValueOnce(oldCommand.promise);
    if (command === "takeback") fixtures.takeBackGameMove.mockReturnValueOnce(oldCommand.promise);
    if (command === "abort") fixtures.abortGame.mockReturnValueOnce(oldCommand.promise);
    if (command === "resign") fixtures.resignGame.mockReturnValueOnce(oldCommand.promise);
    await render();
    await start();
    const oldGameId = store.get(gameIdFamily("tab-a"));
    if (command === "move") act(() => void fixtures.onMove!("e2e4"));
    if (command === "takeback") act(() => void fixtures.onTakeBack!());
    if (command === "abort") act(() => button("Board.Opponent.Abort").click());
    if (command === "resign") act(() => button("Board.Opponent.Resign").click());
    await act(async () => Promise.resolve());
    await act(async () =>
      fixtures.listeners.get("gameOver")?.({
        payload: {
          gameId: oldGameId,
          session: 1n,
          revision: 2n,
          result: { type: "draw", reason: "stalemate" },
          moves: [],
        },
      }),
    );
    await act(async () => button("Home.NewGame").click());
    const replacement = Promise.withResolvers<any>();
    fixtures.startGame.mockReturnValueOnce(replacement.promise);
    await act(async () => button("Board.Opponent.StartGame").click());
    expect((button("Board.Opponent.StartGame") as HTMLButtonElement).dataset.loading).toBe("true");
    fixtures.notify.mockClear();
    await act(async () => oldCommand.reject(new Error(`late ${command}`)));
    const replacementButton = button("Board.Opponent.StartGame") as HTMLButtonElement;
    expect(replacementButton.disabled).toBe(true);
    expect(replacementButton.dataset.loading).toBe("true");
    expect(store.get(pendingGameStartFamily("tab-a"))).not.toBeNull();
    expect(host.querySelector('[role="alert"]')).toBeNull();
    expect(fixtures.notify).not.toHaveBeenCalled();
    const replacementGameId = fixtures.startGame.mock.calls[1][0];
    await act(async () => replacement.resolve(state({ gameId: replacementGameId, session: 2n })));
  },
);

test.each(["takeback", "abort", "resign"] as const)(
  "current %s rejection remains visible and retains ownership",
  async (command) => {
    if (command === "abort") {
      store.set(gamePlayer1SettingsAtom, {
        type: "engine",
        engine: engine("current-abort-white"),
        go: { t: "Infinite" },
      });
      store.set(gamePlayer2SettingsAtom, {
        type: "engine",
        engine: engine("current-abort-black"),
        go: { t: "Infinite" },
      });
    }
    await render();
    await start();
    const gameId = store.get(gameIdFamily("tab-a"));
    const failure = new Error(`${command} rejected`);
    if (command === "takeback") {
      fixtures.takeBackGameMove.mockRejectedValueOnce(failure);
      await act(async () => fixtures.onTakeBack!());
    }
    if (command === "abort") {
      fixtures.abortGame.mockRejectedValueOnce(failure);
      await act(async () => button("Board.Opponent.Abort").click());
    }
    if (command === "resign") {
      fixtures.resignGame.mockRejectedValueOnce(failure);
      await act(async () => button("Board.Opponent.Resign").click());
    }
    expect(host.querySelector('[role="alert"]')?.textContent).toContain(`${command} rejected`);
    expect(store.get(gameIdFamily("tab-a"))).toBe(gameId);
    expect(store.get(gameSessionFamily("tab-a"))).toBe(1n);
  },
);

test("current move and recovery rejections are visible and fully handled", async () => {
  fixtures.makeGameMove.mockRejectedValueOnce(new Error("move rejected"));
  fixtures.getGameState
    .mockResolvedValueOnce(state())
    .mockRejectedValueOnce(new Error("poll failed"));
  await render();
  await start();
  await act(async () => fixtures.onMove!("e2e4"));
  expect(host.querySelector('[role="alert"]')?.textContent).toContain("move rejected");
  expect(fixtures.notify).toHaveBeenCalledWith("Common.Error", expect.any(Error));
});

test("current move recovery success applies the authoritative board", async () => {
  fixtures.makeGameMove.mockRejectedValueOnce(new Error("move rejected"));
  await render();
  await start();
  fixtures.getGameState.mockClear();
  const gameId = store.get(gameIdFamily("tab-a"));
  fixtures.getGameState.mockResolvedValueOnce(
    state({ gameId, revision: 2n, moves: [{ uci: "e2e4", clock: null }] }),
  );
  await act(async () => fixtures.onMove!("e2e4"));
  expect(fixtures.appendMove).toHaveBeenCalledWith(
    expect.objectContaining({ payload: expect.objectContaining({ from: 12, to: 28 }) }),
  );
});

test.each(["current", "stale"] as const)(
  "%s playing-state poll rejection is handled with ownership guards",
  async (mode) => {
    const poll = Promise.withResolvers<any>();
    fixtures.getGameState.mockReset().mockReturnValueOnce(poll.promise);
    await render();
    await start();
    expect(fixtures.getGameState).toHaveBeenCalledOnce();
    if (mode === "stale") {
      const gameId = store.get(gameIdFamily("tab-a"));
      await act(async () =>
        fixtures.listeners.get("gameOver")?.({
          payload: {
            gameId,
            session: 1n,
            revision: 2n,
            result: { type: "draw", reason: "stalemate" },
            moves: [],
          },
        }),
      );
    }
    fixtures.notify.mockClear();
    await act(async () => {
      poll.reject(new Error("playing poll failed"));
      await Promise.resolve();
    });
    expect(fixtures.notify).toHaveBeenCalledTimes(mode === "current" ? 1 : 0);
  },
);

test.each(["resolve", "reject"] as const)(
  "a stale move recovery that %s is silent and fully handled",
  async (outcome) => {
    const recovery = Promise.withResolvers<any>();
    fixtures.makeGameMove.mockRejectedValueOnce(new Error("move rejected"));
    fixtures.getGameState
      .mockReset()
      .mockResolvedValueOnce(state())
      .mockReturnValueOnce(recovery.promise);
    await render();
    await start();
    const gameId = store.get(gameIdFamily("tab-a"));
    let movePromise!: Promise<boolean>;
    act(() => {
      movePromise = fixtures.onMove!("e2e4");
    });
    await act(async () => Promise.resolve());
    expect(fixtures.getGameState).toHaveBeenCalledTimes(2);
    await act(async () =>
      fixtures.listeners.get("gameOver")?.({
        payload: {
          gameId,
          session: 1n,
          revision: 2n,
          result: { type: "draw", reason: "stalemate" },
          moves: [],
        },
      }),
    );
    fixtures.notify.mockClear();
    fixtures.appendMove.mockClear();
    if (outcome === "resolve") {
      await act(async () =>
        recovery.resolve(state({ gameId, revision: 3n, moves: [{ uci: "e2e4", clock: null }] })),
      );
    } else {
      await act(async () => recovery.reject(new Error("stale recovery")));
    }
    await movePromise;
    expect(fixtures.notify).not.toHaveBeenCalled();
    expect(fixtures.appendMove).not.toHaveBeenCalled();
    expect(host.querySelector('[role="alert"]')).toBeNull();
  },
);

test.each(["clock-before-move", "move-before-clock"] as const)(
  "%s preserves the actual move and newest clocks",
  async (order) => {
    vi.useFakeTimers();
    await render();
    await start();
    const gameId = store.get(gameIdFamily("tab-a"));
    const moveEvent = () =>
      fixtures.listeners.get("gameMove")?.({
        payload: {
          gameId,
          session: 1n,
          revision: 1n,
          moves: [{ uci: "e2e4", clock: 111n }],
          whiteTime: 100n,
          blackTime: 200n,
        },
      });
    const clockEvent = () =>
      fixtures.listeners.get("clockUpdate")?.({
        payload: { gameId, session: 1n, revision: 2n, whiteTime: 300n, blackTime: 400n },
      });
    await act(async () => {
      if (order === "clock-before-move") {
        clockEvent();
        moveEvent();
      } else {
        moveEvent();
        clockEvent();
      }
      await vi.advanceTimersByTimeAsync(200);
    });
    expect(treeMoves()).toEqual([expect.objectContaining({ from: 12, to: 28 })]);
    expect(fixtures.boardProps.whiteTime).toBe(300);
    expect(fixtures.boardProps.blackTime).toBe(400);
    vi.useRealTimers();
  },
);

test.each(["clock-before-terminal", "terminal-before-clock"] as const)(
  "%s cannot reopen or overwrite terminal moves and result",
  async (order) => {
    await render();
    await start();
    const gameId = store.get(gameIdFamily("tab-a"));
    const terminal = () =>
      fixtures.listeners.get("gameOver")?.({
        payload: {
          gameId,
          session: 1n,
          revision: 2n,
          result: { type: "whiteWins", reason: "checkmate" },
          moves: [{ uci: "e2e4", clock: 111n }],
        },
      });
    const clock = () =>
      fixtures.listeners.get("clockUpdate")?.({
        payload: { gameId, session: 1n, revision: 3n, whiteTime: 1n, blackTime: 2n },
      });
    await act(async () => {
      if (order === "clock-before-terminal") {
        clock();
        terminal();
      } else {
        terminal();
        clock();
      }
    });
    expect(store.get(gameStateFamily("tab-a"))).toBe("gameOver");
    expect(fixtures.tree.headers.result).toBe("1-0");
    expect(treeMoves()).toEqual([expect.objectContaining({ from: 12, to: 28 })]);
  },
);

test("terminal completion cancels the queued premove callback", async () => {
  vi.useFakeTimers();
  await render();
  await start();
  const gameId = store.get(gameIdFamily("tab-a"));
  expect(fixtures.boardProps.onKeyboardPremove("e2", "e4")).toBe(true);
  act(() =>
    fixtures.listeners.get("gameMove")?.({
      payload: {
        gameId,
        session: 1n,
        revision: 1n,
        moves: [{ uci: "e2e4", clock: null }],
        whiteTime: null,
        blackTime: null,
      },
    }),
  );
  await act(async () => vi.advanceTimersByTimeAsync(150));
  await act(async () =>
    fixtures.listeners.get("gameOver")?.({
      payload: {
        gameId,
        session: 1n,
        revision: 2n,
        result: { type: "draw", reason: "stalemate" },
        moves: [{ uci: "e2e4", clock: null }],
      },
    }),
  );
  await act(async () => vi.runAllTimersAsync());
  expect(fixtures.playPremove).not.toHaveBeenCalled();
  vi.useRealTimers();
});

test("queued older move data cannot overwrite a newer command snapshot", async () => {
  vi.useFakeTimers();
  fixtures.makeGameMove.mockImplementation(async (gameId, session) =>
    state({
      gameId,
      session,
      revision: 2n,
      moves: [{ uci: "e2e4", clock: null }],
      whiteTime: 300n,
      blackTime: 400n,
    }),
  );
  await render();
  await start();
  const gameId = store.get(gameIdFamily("tab-a"));
  act(() =>
    fixtures.listeners.get("gameMove")?.({
      payload: {
        gameId,
        session: 1n,
        revision: 1n,
        moves: [{ uci: "d2d4", clock: null }],
        whiteTime: 100n,
        blackTime: 200n,
      },
    }),
  );
  await act(async () => fixtures.onMove!("e2e4"));
  await act(async () => vi.advanceTimersByTimeAsync(200));
  expect(fixtures.appendMove).toHaveBeenCalledWith(
    expect.objectContaining({ payload: expect.objectContaining({ from: 12, to: 28 }) }),
  );
  expect(fixtures.appendMove).not.toHaveBeenCalledWith(
    expect.objectContaining({ payload: expect.objectContaining({ from: 11, to: 27 }) }),
  );
  expect(fixtures.boardProps.whiteTime).toBe(300);
  expect(fixtures.boardProps.blackTime).toBe(400);
  vi.useRealTimers();
});

test.each(["resolve", "reject"] as const)(
  "a log request that %s after terminal completion is silent",
  async (outcome) => {
    const logs = Promise.withResolvers<any>();
    fixtures.getGameEngineLogs.mockReturnValue(logs.promise);
    const engine = {
      type: "local" as const,
      id: "engine-id",
      name: "Engine",
      version: "1",
      filename: "engine",
      handle: { id: { id: "engine" }, kind: "engine" as const },
      settings: [],
    };
    store.set(gamePlayer1SettingsAtom, { type: "engine", engine, go: { t: "Infinite" } });
    await render();
    await start();
    const gameId = store.get(gameIdFamily("tab-a"));
    await act(async () => button("Board.Analysis.Logs").click());
    await act(async () =>
      fixtures.listeners.get("gameOver")?.({
        payload: {
          gameId,
          session: 1n,
          revision: 2n,
          result: { type: "draw", reason: "stalemate" },
          moves: [],
        },
      }),
    );
    fixtures.notify.mockClear();
    if (outcome === "resolve")
      await act(async () => logs.resolve([{ type: "gui", value: "late" }]));
    else await act(async () => logs.reject(new Error("late logs")));
    expect(fixtures.setEngineLogs).toEqual([]);
    expect(fixtures.notify).not.toHaveBeenCalled();
  },
);

test("overlapping log refreshes keep the latest result and panel close silences failure", async () => {
  const first = Promise.withResolvers<any>();
  const second = Promise.withResolvers<any>();
  const afterClose = Promise.withResolvers<any>();
  fixtures.getGameEngineLogs
    .mockReset()
    .mockReturnValueOnce(first.promise)
    .mockReturnValueOnce(second.promise)
    .mockReturnValueOnce(afterClose.promise);
  store.set(gamePlayer1SettingsAtom, {
    type: "engine",
    engine: engine("logs"),
    go: { t: "Infinite" },
  });
  await render();
  await start();
  await act(async () => button("Board.Analysis.Logs").click());
  act(() => void fixtures.logRefresh!());
  await act(async () => second.resolve([{ type: "gui", value: "new" }]));
  await act(async () => first.resolve([{ type: "gui", value: "old" }]));
  expect(fixtures.setEngineLogs).toEqual([{ type: "gui", value: "new" }]);
  act(() => void fixtures.logRefresh!());
  await act(async () => button("EngineLogs.Close").click());
  fixtures.notify.mockClear();
  await act(async () => afterClose.reject(new Error("closed logs")));
  expect(fixtures.notify).not.toHaveBeenCalled();
});

test("malformed event errors report only for the current unique game", async () => {
  await render();
  await start();
  const gameId = store.get(gameIdFamily("tab-a"));
  const report = fixtures.listenerErrors.get("gameMove")!;
  report(new Error("bad"), { payload: { gameId: "other", session: "bad" } });
  report(new Error("bad"), { payload: { gameId, session: 2 } });
  expect(fixtures.notify).not.toHaveBeenCalled();
  report(new Error("bad"), { payload: { gameId, session: "bad" } });
  expect(fixtures.notify).toHaveBeenCalledOnce();
  await act(async () =>
    fixtures.listeners.get("gameOver")?.({
      payload: {
        gameId,
        session: 1n,
        revision: 2n,
        result: { type: "draw", reason: "stalemate" },
        moves: [],
      },
    }),
  );
  report(new Error("completed"), { payload: { gameId, session: "bad" } });
  expect(fixtures.notify).toHaveBeenCalledOnce();
});

test("listener registration failure reports only while mounted without an event", async () => {
  await render();
  const report = fixtures.listenerErrors.get("gameMove")!;
  report(new Error("registration failed"), undefined);
  expect(fixtures.notify).toHaveBeenCalledOnce();
  await act(async () => root.unmount());
  report(new Error("registration after unmount"), undefined);
  expect(fixtures.notify).toHaveBeenCalledOnce();
  root = createRoot(host);
});

test.each(["resolve", "reject"] as const)(
  "a log request that %s after owner handoff cannot write to the replacement",
  async (outcome) => {
    const logs = Promise.withResolvers<any>();
    fixtures.getGameEngineLogs.mockReturnValue(logs.promise);
    store.set(gamePlayer1SettingsAtom, {
      type: "engine",
      engine: engine("handoff-logs"),
      go: { t: "Infinite" },
    });
    await render("tab-a");
    await start();
    await act(async () => button("Board.Analysis.Logs").click());
    await act(async () => root.unmount());
    root = createRoot(host);
    store.set(gamePlayer1SettingsAtom, { type: "human", name: "Alice" });
    await render("tab-b");
    fixtures.notify.mockClear();
    if (outcome === "resolve") {
      await act(async () => logs.resolve([{ type: "gui", value: "old owner" }]));
      expect(fixtures.setEngineLogs).toEqual([]);
    } else {
      await act(async () => logs.reject(new Error("old owner logs")));
    }
    expect(fixtures.notify).not.toHaveBeenCalled();
  },
);

test("retained ownership blocks replacement after teardown failure and permits retry", async () => {
  await render();
  store.set(gameIdFamily("tab-a"), "retained");
  store.set(gameSessionFamily("tab-a"), 7n);
  await act(async () => Promise.resolve());
  fixtures.abortGame.mockRejectedValueOnce(new Error("cleanup failed"));
  await start();
  expect(fixtures.startGame).not.toHaveBeenCalled();
  expect(store.get(gameIdFamily("tab-a"))).toBe("retained");
  expect(host.querySelector('[role="alert"]')?.textContent).toContain("cleanup failed");
  await start();
  expect(fixtures.abortGame).toHaveBeenCalledWith("retained", 7n);
  expect(fixtures.startGame).toHaveBeenCalledOnce();
});

test("unmount and remount cannot admit a second unresolved start", async () => {
  const reply = Promise.withResolvers<any>();
  fixtures.startGame.mockReturnValue(reply.promise);
  await render();
  act(() => button("Board.Opponent.StartGame").click());
  await act(async () => root.unmount());
  root = createRoot(host);
  await render();
  await act(async () => button("Board.Opponent.StartGame").click());
  expect(fixtures.startGame).toHaveBeenCalledOnce();
  const admittedGameId = fixtures.startGame.mock.calls[0][0];
  await act(async () => reply.resolve(state({ gameId: admittedGameId })));
  expect(fixtures.abortGame).toHaveBeenCalledWith(admittedGameId, 1n);
});

test("stale-start cleanup failure retains exact identity and a remount retries it", async () => {
  const staleStart = Promise.withResolvers<any>();
  fixtures.startGame.mockReturnValueOnce(staleStart.promise);
  await render();
  act(() => button("Board.Opponent.StartGame").click());
  const staleGameId = fixtures.startGame.mock.calls[0][0];
  await act(async () => root.unmount());
  fixtures.abortGame.mockRejectedValueOnce(new Error("stale cleanup failed"));
  await act(async () => staleStart.resolve(state({ gameId: staleGameId })));
  expect(store.get(gameIdFamily("tab-a"))).toBe(staleGameId);
  expect(store.get(gameSessionFamily("tab-a"))).toBe(1n);
  expect(fixtures.notify).toHaveBeenCalledWith("Common.Error", expect.any(Error));

  root = createRoot(host);
  await render();
  fixtures.startGame.mockImplementationOnce(async (gameId) => state({ gameId, session: 2n }));
  await start();
  expect(fixtures.abortGame).toHaveBeenLastCalledWith(staleGameId, 1n);
  expect(fixtures.startGame).toHaveBeenCalledTimes(2);
  expect(store.get(gameSessionFamily("tab-a"))).toBe(2n);
});

test("old deferred cleanup cannot clear a newer same-tab native identity", async () => {
  await render();
  await start();
  const oldAbort = Promise.withResolvers<void>();
  fixtures.abortGame.mockReturnValueOnce(oldAbort.promise);
  await act(async () => root.unmount());
  store.set(gameIdFamily("tab-a"), "replacement");
  store.set(gameSessionFamily("tab-a"), 2n);
  store.set(gameStateFamily("tab-a"), "playing");
  await act(async () => oldAbort.resolve());
  expect(store.get(gameIdFamily("tab-a"))).toBe("replacement");
  expect(store.get(gameSessionFamily("tab-a"))).toBe(2n);
  expect(store.get(gameStateFamily("tab-a"))).toBe("playing");
  root = createRoot(host);
});

test("successful unmount retires ownership as gameOver and remount can reset", async () => {
  await render();
  await start();
  await act(async () => root.unmount());
  expect(store.get(gameIdFamily("tab-a"))).toBeNull();
  expect(store.get(gameSessionFamily("tab-a"))).toBeNull();
  expect(store.get(gameStateFamily("tab-a"))).toBe("gameOver");
  root = createRoot(host);
  await render();
  await act(async () => button("Home.NewGame").click());
  expect(store.get(gameStateFamily("tab-a"))).toBe("settingUp");
});

test("StrictMode setup replay restores the mounted owner", async () => {
  await act(async () =>
    root.render(
      <StrictMode>
        <TreeStateContext.Provider value={fixtures.treeStore}>
          <BoardGame tabId="tab-a" />
        </TreeStateContext.Provider>
      </StrictMode>,
    ),
  );
  await start();
  expect(fixtures.startGame).toHaveBeenCalledOnce();
  expect(store.get(gameStateFamily("tab-a"))).toBe("playing");
  expect(store.get(gameIdFamily("tab-a"))).not.toBeNull();
});

test("terminal start stores the final result and rebuilds moves from the live tree", async () => {
  fixtures.startGame.mockImplementationOnce(async (gameId) =>
    state({
      gameId,
      initialFen: "7k/8/5KQ1/8/8/8/8/8 w - - 0 1",
      currentFen: "7k/6Q1/5K2/8/8/8/8/8 b - - 1 1",
      revision: 1n,
      status: { finished: { result: { type: "whiteWins", reason: "checkmate" } } },
      moves: [{ uci: "g6g7", clock: null }],
    }),
  );
  await render();
  await start();
  expect(fixtures.tree.headers.result).toBe("1-0");
  const moves: any[] = [];
  let node = fixtures.tree.root;
  while (node.children.length) {
    node = node.children[0];
    moves.push(node.move);
  }
  expect(moves).toEqual([expect.objectContaining({ from: 46, to: 54 })]);
});

test("initialization restores setup moves into the reset live tree and keeps metadata", async () => {
  fixtures.tree.root.children.push({
    fen: INITIAL_FEN,
    move: { from: 12, to: 28 },
    children: [],
  });
  fixtures.startGame.mockImplementationOnce(async (gameId) =>
    state({ gameId, revision: 1n, moves: [{ uci: "e2e4", clock: null }] }),
  );
  await render();
  await start();
  expect(treeMoves()).toEqual([expect.objectContaining({ from: 12, to: 28 })]);
  expect(fixtures.tree.headers).toEqual(expect.objectContaining({ site: "ChessFable" }));
});

test("consecutive authoritative snapshots extend the live tree before React rerenders", async () => {
  const poll = Promise.withResolvers<any>();
  const move = Promise.withResolvers<any>();
  fixtures.getGameState.mockReturnValueOnce(poll.promise);
  fixtures.makeGameMove.mockReturnValueOnce(move.promise);
  await render();
  await start();
  const gameId = store.get(gameIdFamily("tab-a"));
  let movePromise!: Promise<boolean>;
  act(() => {
    movePromise = fixtures.onMove!("e2e4");
  });
  await act(async () => {
    move.resolve(state({ gameId, revision: 1n, moves: [{ uci: "e2e4", clock: null }] }));
    await Promise.resolve();
    poll.resolve(
      state({
        gameId,
        revision: 2n,
        moves: [
          { uci: "e2e4", clock: null },
          { uci: "e7e5", clock: null },
        ],
      }),
    );
  });
  await movePromise;
  expect(treeMoves()).toEqual([
    expect.objectContaining({ from: 12, to: 28 }),
    expect.objectContaining({ from: 52, to: 36 }),
  ]);
});

test("delayed tab A command writes cannot mutate tab B after handoff", async () => {
  const move = Promise.withResolvers<any>();
  fixtures.makeGameMove.mockReturnValue(move.promise);
  await render("tab-a");
  await start();
  let moveResult!: Promise<boolean>;
  act(() => {
    moveResult = fixtures.onMove!("e2e4");
  });
  await act(async () => root.unmount());
  fixtures.startGame.mockImplementationOnce(async (gameId) => state({ gameId, session: 2n }));
  fixtures.getGameState.mockImplementation(async (gameId, session) => state({ gameId, session }));
  root = createRoot(host);
  await render("tab-b");
  await start();
  const gameB = store.get(gameIdFamily("tab-b"));
  fixtures.notify.mockClear();
  await act(async () => move.reject(new Error("late A move")));
  await moveResult;
  expect(store.get(gameIdFamily("tab-b"))).toBe(gameB);
  expect(store.get(gameSessionFamily("tab-b"))).toBe(2n);
  expect(fixtures.notify).not.toHaveBeenCalled();
});

test("synchronous player conversion failure clears pending start and permits retry", async () => {
  store.set(gamePlayer1SettingsAtom, { type: "engine", engine: null, go: { t: "Infinite" } });
  await render();
  await start();
  expect(fixtures.startGame).not.toHaveBeenCalled();
  expect(store.get(pendingGameStartFamily("tab-a"))).toBeNull();
  expect(host.querySelector('[role="alert"]')).not.toBeNull();
  store.set(gamePlayer1SettingsAtom, { type: "human", name: "Alice" });
  await act(async () => Promise.resolve());
  await start();
  expect(fixtures.startGame).toHaveBeenCalledOnce();
});

test("close intent refuses start without pending work and release permits retry", async () => {
  store.set(closingTabsAtom, new Set(["tab-a"]));
  await render();
  await start();
  expect(fixtures.startGame).not.toHaveBeenCalled();
  expect(store.get(pendingGameStartFamily("tab-a"))).toBeNull();
  store.set(closingTabsAtom, new Set());
  await act(async () => Promise.resolve());
  await start();
  expect(fixtures.startGame).toHaveBeenCalledOnce();
});

describe("cleanup ownership", () => {
  test("unmount retains exact ownership and reports cleanup failure", async () => {
    await render();
    await start();
    const gameId = store.get(gameIdFamily("tab-a"));
    fixtures.abortGame.mockRejectedValueOnce(new Error("unmount cleanup failed"));
    await act(async () => root.unmount());
    expect(store.get(gameIdFamily("tab-a"))).toBe(gameId);
    expect(store.get(gameSessionFamily("tab-a"))).toBe(1n);
    expect(fixtures.notify).toHaveBeenCalledWith("Common.Error", expect.any(Error));
    root = createRoot(host);
    await render();
    fixtures.notify.mockClear();
    await act(async () => root.unmount());
    expect(fixtures.abortGame).toHaveBeenLastCalledWith(gameId, 1n);
    expect(store.get(gameIdFamily("tab-a"))).toBeNull();
    expect(store.get(gameSessionFamily("tab-a"))).toBeNull();
    expect(store.get(gameStateFamily("tab-a"))).toBe("gameOver");
    expect(fixtures.notify).not.toHaveBeenCalled();
    root = createRoot(host);
  });
});
