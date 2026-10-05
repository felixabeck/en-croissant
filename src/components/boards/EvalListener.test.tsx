import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { getDefaultStore } from "jotai";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import type { BestMovesPayload } from "@/bindings";
import { INITIAL_FEN } from "chessops/fen";

const fixtures = vi.hoisted(() => ({
  engine: {
    type: "local" as const,
    id: "engine-1",
    name: "Stockfish",
    version: "17",
    filename: "stockfish",
    handle: { id: { id: "handle-1" }, kind: "engine" as const },
    loaded: true,
  },
  chessdbEngine: {
    type: "chessdb" as const,
    id: "chessdb-1",
    name: "ChessDB",
    url: "https://chessdb.cn",
    loaded: true,
  },
  fen: "start-fen",
  moves: [] as string[],
  chessdbGetBestMoves: vi.fn(),
  getBestMoves: vi.fn(),
  prepareEngineSearch: vi.fn(),
  listeners: [] as Array<(event: any) => void>,
  notifyUnlessCancelled: vi.fn(),
  setScore: vi.fn(),
  stopEngine: vi.fn(),
  releaseEngineSearch: vi.fn(),
  scoreOwner: null as string | null,
  t: (key: string) => key,
}));

const engine = fixtures.engine;
const chessdbEngine = fixtures.chessdbEngine;

vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: fixtures.t }) }));
vi.mock("@/components/files/notifyError", () => ({
  notifyListenerError: vi.fn(),
  notifyUnlessCancelled: fixtures.notifyUnlessCancelled,
}));
vi.mock("@/utils/engines", () => ({
  getBestMoves: fixtures.getBestMoves,
  prepareEngineSearch: fixtures.prepareEngineSearch,
  stopEngine: fixtures.stopEngine,
  releaseEngineSearch: fixtures.releaseEngineSearch,
}));
vi.mock("@/utils/chess", () => ({ getVariationLine: () => fixtures.moves }));
vi.mock("@/utils/chessops", () => ({
  positionFromFen: () => [null],
  swapMove: (fen: string) => `threat:${fen}`,
}));
vi.mock("@/utils/chessdb/api", () => ({ getBestMoves: fixtures.chessdbGetBestMoves }));
vi.mock("@/utils/lichess/api", () => ({ getBestMoves: vi.fn() }));
vi.mock("@/platform/tauri", () => ({
  tauriSubscriptions: {
    bestMoves: vi.fn(async (listener: (event: any) => void) => {
      fixtures.listeners.push(listener);
      return () => {
        const index = fixtures.listeners.indexOf(listener);
        if (index >= 0) fixtures.listeners.splice(index, 1);
      };
    }),
  },
}));
vi.mock("@/state/atoms", async () => {
  const { atom } = await vi.importActual<typeof import("jotai")>("jotai");
  const { atomFamily } = await vi.importActual<typeof import("jotai/utils")>("jotai/utils");
  return {
    activeTabAtom: atom<string | null>("tab-1"),
    closingTabsAtom: atom<Set<string>>(new Set<string>()),
    currentThreatAtom: atom(false),
    enginesAtom: atom<any[]>([fixtures.engine]),
    engineMovesFamily: atomFamily(
      ({ tab: _tab, engine: _engine }: { tab: string; engine: string }) =>
        atom<Map<string, any[]>>(new Map()),
      (a, b) => a.tab === b.tab && a.engine === b.engine,
    ),
    engineProgressFamily: atomFamily(
      ({ tab: _tab, engine: _engine }: { tab: string; engine: string }) => atom(0),
      (a, b) => a.tab === b.tab && a.engine === b.engine,
    ),
    firstEngineWithLinesFamily: atomFamily(() => atom(() => fixtures.scoreOwner)),
    tabEngineSettingsFamily: atomFamily(
      ({ defaultSettings, defaultGo }: { defaultSettings?: any[]; defaultGo?: any }) =>
        atom({
          enabled: true,
          synced: true,
          go: defaultGo ?? { t: "Infinite" },
          settings: defaultSettings ?? [],
        }),
      (a: any, b: any) => a.tab === b.tab && a.engineId === b.engineId,
    ),
    tabsAtom: atom<any[]>([{ value: "tab-1" }, { value: "tab-2" }]),
  };
});
vi.mock("zustand", () => ({
  useStore: (_store: unknown, selector: (state: any) => unknown) =>
    selector({ root: { fen: fixtures.fen }, position: [], setScore: fixtures.setScore }),
}));
vi.mock("zustand/react/shallow", () => ({ useShallow: (selector: unknown) => selector }));
vi.mock("@/components/common/TreeStateContext", async () => {
  const React = await vi.importActual<typeof import("react")>("react");
  return { TreeStateContext: React.createContext({}) };
});

import {
  activeTabAtom,
  closingTabsAtom,
  currentThreatAtom,
  engineMovesFamily,
  engineProgressFamily,
  enginesAtom,
  tabEngineSettingsFamily,
  tabsAtom,
} from "@/state/atoms";
import EvalListener from "./EvalListener";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

let host: HTMLDivElement;
let root: Root;
let mounted: boolean;
const store = getDefaultStore();
const settingsAtom = (tab = store.get(activeTabAtom)!, engineId = engine.id) =>
  tabEngineSettingsFamily({
    engineId,
    tab,
    defaultSettings: [],
    defaultGo: { t: "Infinite" },
  });
const movesAtom = (tab = store.get(activeTabAtom)!, engineId = engine.id) =>
  engineMovesFamily({ tab, engine: engineId });
const progressAtom = (tab = store.get(activeTabAtom)!, engineId = engine.id) =>
  engineProgressFamily({ tab, engine: engineId });

async function flush() {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

async function settleTransition() {
  await act(async () => {
    await flush();
    await flush();
  });
}

async function rerender() {
  await act(async () => root.render(<EvalListener />));
}

async function unmount() {
  if (!mounted) return;
  await act(async () => root.unmount());
  mounted = false;
}

async function broadcast(payloadValue: BestMovesPayload) {
  await act(async () => {
    for (const listener of [...fixtures.listeners]) listener({ payload: payloadValue });
    await flush();
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  for (const mock of [
    fixtures.prepareEngineSearch,
    fixtures.getBestMoves,
    fixtures.chessdbGetBestMoves,
    fixtures.stopEngine,
    fixtures.releaseEngineSearch,
  ])
    mock.mockReset();
  fixtures.fen = "start-fen";
  fixtures.moves = [];
  fixtures.scoreOwner = null;
  fixtures.listeners = [];
  fixtures.prepareEngineSearch.mockResolvedValue("generation-1");
  fixtures.stopEngine.mockResolvedValue(true);
  fixtures.releaseEngineSearch.mockResolvedValue(undefined);
  fixtures.getBestMoves.mockImplementation(() => new Promise(() => undefined));
  fixtures.chessdbGetBestMoves.mockImplementation(() => new Promise(() => undefined));
  store.set(activeTabAtom, "tab-1");
  store.set(tabsAtom, [{ value: "tab-1" }, { value: "tab-2" }] as any);
  store.set(closingTabsAtom, new Set());
  store.set(currentThreatAtom, false);
  store.set(enginesAtom, [engine] as any);
  store.set(settingsAtom("tab-1"), {
    enabled: true,
    synced: true,
    go: { t: "Infinite" },
    settings: [],
  });
  store.set(settingsAtom("tab-1", chessdbEngine.id), {
    enabled: true,
    synced: true,
    go: { t: "Infinite" },
    settings: [],
  });
  store.set(movesAtom("tab-1"), new Map([["old", payload("cached").bestLines]]));
  store.set(progressAtom("tab-1"), 73);
  store.set(movesAtom("tab-1", chessdbEngine.id), new Map());
  store.set(progressAtom("tab-1", chessdbEngine.id), 0);
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  mounted = true;
});

afterEach(async () => {
  await unmount();
  host.remove();
  vi.useRealTimers();
});

test("first change starts immediately without advancing timers", async () => {
  await rerender();

  expect(store.get(movesAtom()).size).toBe(0);
  expect(store.get(progressAtom())).toBe(0);
  expect(fixtures.prepareEngineSearch).toHaveBeenCalledWith(engine, "tab-1");
  expect(fixtures.getBestMoves).toHaveBeenCalledWith(
    engine,
    "tab-1",
    { t: "Infinite" },
    { fen: "start-fen", moves: [], extraOptions: [] },
    "generation-1",
  );
});

test("a current ChessDB promise result populates its cache and progress", async () => {
  const result = deferred<ReturnType<typeof remoteResult>>();
  fixtures.chessdbGetBestMoves.mockReturnValueOnce(result.promise);
  store.set(enginesAtom, [chessdbEngine] as any);
  await rerender();
  await settleTransition();

  expect(fixtures.chessdbGetBestMoves).toHaveBeenCalledWith(
    "tab-1",
    { t: "Infinite" },
    { fen: "start-fen", moves: [], extraOptions: [] },
  );
  await act(async () => {
    result.resolve(remoteResult(81));
    await flush();
  });

  expect(store.get(movesAtom("tab-1", chessdbEngine.id)).get("start-fen:")).toEqual(
    remoteResult(81)[1],
  );
  expect(store.get(progressAtom("tab-1", chessdbEngine.id))).toBe(81);
});

test("A to B to A does not let a generation-equivalent remote attempt complete", async () => {
  const results = [
    deferred<ReturnType<typeof remoteResult>>(),
    deferred<ReturnType<typeof remoteResult>>(),
    deferred<ReturnType<typeof remoteResult>>(),
  ];
  fixtures.chessdbGetBestMoves
    .mockReturnValueOnce(results[0].promise)
    .mockReturnValueOnce(results[1].promise)
    .mockReturnValueOnce(results[2].promise);
  store.set(enginesAtom, [chessdbEngine] as any);
  await rerender();
  await settleTransition();

  fixtures.fen = "fen-b";
  await rerender();
  await settleTransition();
  fixtures.fen = "start-fen";
  await rerender();
  await settleTransition();

  await act(async () => {
    results[0].resolve(remoteResult(41));
    await flush();
  });
  expect(store.get(movesAtom("tab-1", chessdbEngine.id)).size).toBe(0);
  expect(store.get(progressAtom("tab-1", chessdbEngine.id))).toBe(0);

  await act(async () => {
    results[2].resolve(remoteResult(82));
    await flush();
  });
  expect(store.get(movesAtom("tab-1", chessdbEngine.id)).get("start-fen:")).toBeDefined();
  expect(store.get(progressAtom("tab-1", chessdbEngine.id))).toBe(82);
});

test("position, settings, and tab changes reject stale ChessDB promise results", async () => {
  const results = Array.from({ length: 4 }, () => deferred<ReturnType<typeof remoteResult>>());
  for (const result of results) {
    fixtures.chessdbGetBestMoves.mockReturnValueOnce(result.promise);
  }
  store.set(enginesAtom, [chessdbEngine] as any);
  await rerender();
  await settleTransition();

  fixtures.fen = "fen-b";
  await rerender();
  await settleTransition();
  await act(async () => {
    results[0].resolve(remoteResult(31));
    await flush();
  });
  expect(store.get(movesAtom("tab-1", chessdbEngine.id)).size).toBe(0);
  expect(store.get(progressAtom("tab-1", chessdbEngine.id))).toBe(0);

  await act(async () => {
    store.set(settingsAtom("tab-1", chessdbEngine.id), {
      enabled: true,
      synced: true,
      go: { t: "Depth", c: 14 },
      settings: [],
    });
    await flush();
  });
  await settleTransition();
  await act(async () => {
    results[1].resolve(remoteResult(32));
    await flush();
  });
  expect(store.get(movesAtom("tab-1", chessdbEngine.id)).size).toBe(0);
  expect(store.get(progressAtom("tab-1", chessdbEngine.id))).toBe(0);

  await act(async () => {
    store.set(activeTabAtom, "tab-2");
    await flush();
  });
  await settleTransition();
  await act(async () => {
    results[2].resolve(remoteResult(33));
    await flush();
  });
  expect(store.get(movesAtom("tab-1", chessdbEngine.id)).size).toBe(0);
  expect(store.get(progressAtom("tab-1", chessdbEngine.id))).toBe(0);
  expect(store.get(movesAtom("tab-2", chessdbEngine.id)).size).toBe(0);
  expect(store.get(progressAtom("tab-2", chessdbEngine.id))).toBe(0);
});

test("close entry clears remote state immediately and a stale result cannot restore it", async () => {
  const result = deferred<ReturnType<typeof remoteResult>>();
  fixtures.chessdbGetBestMoves.mockReturnValueOnce(result.promise);
  store.set(enginesAtom, [chessdbEngine] as any);
  await rerender();
  await settleTransition();
  store.set(movesAtom("tab-1", chessdbEngine.id), new Map([["start-fen:", remoteResult(65)[1]]]));
  store.set(progressAtom("tab-1", chessdbEngine.id), 65);

  await act(async () => {
    store.set(closingTabsAtom, new Set(["tab-1"]));
    expect(store.get(movesAtom("tab-1", chessdbEngine.id)).size).toBe(0);
    expect(store.get(progressAtom("tab-1", chessdbEngine.id))).toBe(0);
  });
  await act(async () => {
    result.resolve(remoteResult(66));
    await flush();
  });

  expect(store.get(movesAtom("tab-1", chessdbEngine.id)).size).toBe(0);
  expect(store.get(progressAtom("tab-1", chessdbEngine.id))).toBe(0);
});

test("a ChessDB promise completing after unmount cannot write state", async () => {
  const result = deferred<ReturnType<typeof remoteResult>>();
  fixtures.chessdbGetBestMoves.mockReturnValueOnce(result.promise);
  store.set(enginesAtom, [chessdbEngine] as any);
  await rerender();
  await settleTransition();
  await unmount();

  await act(async () => {
    result.resolve(remoteResult(67));
    await flush();
  });

  expect(store.get(movesAtom("tab-1", chessdbEngine.id)).size).toBe(0);
  expect(store.get(progressAtom("tab-1", chessdbEngine.id))).toBe(0);
});

test("a result pending while its engine is unloaded is dropped before React unmounts it", async () => {
  const result = deferred<ReturnType<typeof remoteResult>>();
  fixtures.chessdbGetBestMoves.mockReturnValueOnce(result.promise);
  store.set(enginesAtom, [chessdbEngine] as any);
  await rerender();
  await settleTransition();

  // Outside act: the store holds the unloaded engine while the listener is
  // still mounted, which is the window between the store write and React's
  // passive unmount cleanup.
  store.set(enginesAtom, [{ ...chessdbEngine, loaded: false }] as any);
  result.resolve(remoteResult(68));
  await flush();

  expect(store.get(movesAtom("tab-1", chessdbEngine.id)).size).toBe(0);
  expect(store.get(progressAtom("tab-1", chessdbEngine.id))).toBe(0);
});

test("a result pending while its engine's executable is replaced under the same id is dropped", async () => {
  const result = deferred<ReturnType<typeof remoteResult>>();
  fixtures.chessdbGetBestMoves.mockReturnValueOnce(result.promise);
  store.set(enginesAtom, [chessdbEngine] as any);
  await rerender();
  await settleTransition();

  // Outside act, as above: still loaded, same id, different endpoint.
  store.set(enginesAtom, [{ ...chessdbEngine, url: "https://other.example" }] as any);
  result.resolve(remoteResult(69));
  await flush();

  expect(store.get(movesAtom("tab-1", chessdbEngine.id)).size).toBe(0);
  expect(store.get(progressAtom("tab-1", chessdbEngine.id))).toBe(0);
});

test("a native broadcast for an engine unloaded before React unmounts it is dropped", async () => {
  fixtures.prepareEngineSearch.mockResolvedValue("generation-unloaded");
  await rerender();
  await settleTransition();

  store.set(enginesAtom, [{ ...engine, loaded: false }] as any);
  // Not via `broadcast`: its `act` would re-render, unmount the listener and
  // unregister it, so the loop would fire nothing and the test would pass vacuously.
  for (const listener of [...fixtures.listeners]) {
    listener({ payload: payload("generation-unloaded") });
  }
  await flush();

  expect(store.get(movesAtom()).size).toBe(0);
  expect(store.get(progressAtom())).toBe(0);
});

test("settings and go changes reject old events during transition and clear cached state", async () => {
  fixtures.prepareEngineSearch
    .mockResolvedValueOnce("generation-old")
    .mockResolvedValueOnce("generation-new");
  await rerender();
  await settleTransition();
  store.set(movesAtom(), new Map([["start-fen:", payload("old").bestLines]]));
  store.set(progressAtom(), 61);

  await act(async () => {
    store.set(settingsAtom(), {
      enabled: true,
      synced: true,
      go: { t: "Depth", c: 18 },
      settings: [{ type: "string", name: "MultiPV", value: "3" }],
    });
    await flush();
  });

  expect(store.get(movesAtom()).size).toBe(0);
  expect(store.get(progressAtom())).toBe(0);
  await broadcast(payload("generation-old", { progress: 88 }));
  expect(store.get(movesAtom()).size).toBe(0);
  expect(store.get(progressAtom())).toBe(0);
  expect(fixtures.prepareEngineSearch).toHaveBeenCalledTimes(2);

  await settleTransition();
  expect(fixtures.stopEngine).toHaveBeenCalledWith(engine, "tab-1", "generation-old");
  expect(fixtures.getBestMoves).toHaveBeenLastCalledWith(
    engine,
    "tab-1",
    { t: "Depth", c: 18 },
    {
      fen: "start-fen",
      moves: [],
      extraOptions: [{ type: "string", name: "MultiPV", value: "3" }],
    },
    "generation-new",
  );
});

test.each([
  ["Threads option", [{ type: "string" as const, name: "Threads", value: "4" }]],
  ["MultiPV option", [{ type: "string" as const, name: "MultiPV", value: "3" }]],
])(
  "a same-position %s change alone rejects old events during transition",
  async (_name, settings) => {
    fixtures.prepareEngineSearch
      .mockResolvedValueOnce("before-option")
      .mockResolvedValueOnce("after-option");
    await rerender();
    await settleTransition();

    await act(async () => {
      store.set(settingsAtom(), {
        enabled: true,
        synced: true,
        go: { t: "Infinite" },
        settings,
      });
      await flush();
    });
    await broadcast(payload("before-option", { progress: 82 }));
    expect(store.get(movesAtom()).size).toBe(0);
    expect(store.get(progressAtom())).toBe(0);
    expect(fixtures.prepareEngineSearch).toHaveBeenCalledTimes(2);

    await settleTransition();
    expect(fixtures.prepareEngineSearch).toHaveBeenCalledTimes(2);
  },
);

test("a same-position go-only change rejects old events during transition", async () => {
  fixtures.prepareEngineSearch.mockResolvedValueOnce("before-go").mockResolvedValueOnce("after-go");
  await rerender();
  await settleTransition();

  await act(async () => {
    store.set(settingsAtom(), {
      enabled: true,
      synced: true,
      go: { t: "Depth", c: 20 },
      settings: [],
    });
    await flush();
  });
  await broadcast(payload("before-go", { progress: 82 }));
  expect(store.get(movesAtom()).size).toBe(0);
  expect(store.get(progressAtom())).toBe(0);
  expect(fixtures.prepareEngineSearch).toHaveBeenCalledTimes(2);

  await settleTransition();
  expect(fixtures.prepareEngineSearch).toHaveBeenCalledTimes(2);
});

test("an executable change rejects the old owner during transition", async () => {
  fixtures.prepareEngineSearch
    .mockResolvedValueOnce("old-binary-owner")
    .mockResolvedValueOnce("new-binary-owner");
  await rerender();
  await settleTransition();
  store.set(movesAtom(), new Map([["start-fen:", payload("old").bestLines]]));
  store.set(progressAtom(), 64);
  const replacement = {
    ...engine,
    handle: { id: { id: "handle-2" }, kind: "engine" as const },
  };

  await act(async () => {
    store.set(enginesAtom, [replacement] as any);
    await flush();
  });
  expect(store.get(movesAtom()).size).toBe(0);
  expect(store.get(progressAtom())).toBe(0);
  await broadcast(payload("old-binary-owner", { progress: 90 }));
  expect(store.get(progressAtom())).toBe(0);
  expect(fixtures.prepareEngineSearch).toHaveBeenCalledTimes(2);

  await settleTransition();
  expect(fixtures.releaseEngineSearch).toHaveBeenCalledWith(engine, "tab-1", "old-binary-owner");
  expect(fixtures.prepareEngineSearch).toHaveBeenLastCalledWith(replacement, "tab-1");
});

test("accepts current info and terminal results but rejects an old generation", async () => {
  fixtures.prepareEngineSearch.mockResolvedValue("generation-current");
  await rerender();
  await settleTransition();

  await broadcast(payload("generation-old"));
  expect(store.get(movesAtom()).size).toBe(0);
  expect(store.get(progressAtom())).toBe(0);

  await broadcast(payload("generation-current"));
  expect(store.get(movesAtom()).get("start-fen:")).toEqual(payload("generation-current").bestLines);
  expect(store.get(progressAtom())).toBe(50);

  await broadcast(payload("generation-current", { progress: 100 }));
  expect(store.get(progressAtom())).toBe(100);
});

test("A to B to A and unmount/remount never reuse an attempt identity", async () => {
  fixtures.prepareEngineSearch
    .mockResolvedValueOnce("generation-a1")
    .mockResolvedValueOnce("generation-b")
    .mockResolvedValueOnce("generation-a2")
    .mockResolvedValueOnce("generation-a3");
  await rerender();
  await settleTransition();

  fixtures.fen = "fen-b";
  await rerender();
  await settleTransition();
  fixtures.fen = "start-fen";
  await rerender();
  await settleTransition();

  await broadcast(payload("generation-a1"));
  expect(store.get(movesAtom()).size).toBe(0);
  await broadcast(payload("generation-a2"));
  expect(store.get(progressAtom())).toBe(50);

  await unmount();
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  mounted = true;
  await rerender();
  await settleTransition();
  store.set(movesAtom(), new Map());
  await broadcast(payload("generation-a2"));
  expect(store.get(movesAtom()).size).toBe(0);
  await broadcast(payload("generation-a3"));
  expect(store.get(progressAtom())).toBe(50);
});

test("stale and unmounted preparations release exactly their returned owners", async () => {
  const prepares = [deferred<string>(), deferred<string>(), deferred<string>()];
  fixtures.prepareEngineSearch
    .mockReturnValueOnce(prepares[0].promise)
    .mockReturnValueOnce(prepares[1].promise)
    .mockReturnValueOnce(prepares[2].promise);
  await rerender();
  await settleTransition();

  fixtures.fen = "fen-b";
  await rerender();
  await settleTransition();
  await act(async () => {
    prepares[0].resolve("stale-owner");
    await flush();
  });
  expect(fixtures.prepareEngineSearch).toHaveBeenCalledTimes(2);
  await act(async () => {
    prepares[1].resolve("new-owner");
    await flush();
  });
  expect(fixtures.getBestMoves).toHaveBeenCalledWith(
    engine,
    "tab-1",
    { t: "Infinite" },
    expect.anything(),
    "new-owner",
  );
  expect(fixtures.stopEngine).toHaveBeenCalledWith(engine, "tab-1", "stale-owner");
  expect(fixtures.stopEngine).not.toHaveBeenCalledWith(engine, "tab-1", "new-owner");

  await unmount();
  expect(fixtures.releaseEngineSearch).toHaveBeenCalledWith(engine, "tab-1", "new-owner");
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  mounted = true;
  await rerender();
  await settleTransition();
  await unmount();
  await act(async () => {
    prepares[2].resolve("unmounted-owner");
    await flush();
  });
  expect(fixtures.releaseEngineSearch).toHaveBeenCalledWith(engine, "tab-1", "unmounted-owner");
});

test("tab switch and unmount during transition release the captured predecessor", async () => {
  fixtures.prepareEngineSearch
    .mockResolvedValueOnce("tab-1-owner")
    .mockResolvedValueOnce("tab-2-owner");
  await rerender();
  await settleTransition();

  await act(async () => {
    store.set(activeTabAtom, "tab-2");
    await flush();
  });
  expect(fixtures.stopEngine).not.toHaveBeenCalled();
  expect(fixtures.releaseEngineSearch).toHaveBeenCalledWith(engine, "tab-1", "tab-1-owner");
  await settleTransition();
  expect(fixtures.stopEngine).not.toHaveBeenCalled();

  fixtures.fen = "third-fen";
  await rerender();
  await unmount();
  expect(fixtures.releaseEngineSearch).toHaveBeenCalledWith(engine, "tab-2", "tab-2-owner");
});

test("position changes stop the search and keep its actor warm", async () => {
  fixtures.prepareEngineSearch
    .mockResolvedValueOnce("position-a")
    .mockResolvedValueOnce("position-b");
  await rerender();
  await settleTransition();
  fixtures.fen = "fen-b";
  await rerender();
  await settleTransition();
  expect(fixtures.stopEngine).toHaveBeenCalledWith(engine, "tab-1", "position-a");
  expect(fixtures.releaseEngineSearch).not.toHaveBeenCalled();
});

test("pause releases the owner during transition without starting another search", async () => {
  await rerender();
  await settleTransition();
  await act(async () => {
    store.set(settingsAtom(), { ...store.get(settingsAtom()), enabled: false });
    await flush();
  });
  expect(fixtures.releaseEngineSearch).toHaveBeenCalledWith(engine, "tab-1", "generation-1");
  await settleTransition();
  expect(fixtures.prepareEngineSearch).toHaveBeenCalledTimes(1);
  expect(fixtures.stopEngine).not.toHaveBeenCalled();
});

test("unmount during preparation releases the retained warm actor and the late reservation", async () => {
  await rerender();
  await settleTransition();
  const prepare = deferred<string>();
  fixtures.prepareEngineSearch.mockReturnValueOnce(prepare.promise);
  fixtures.fen = "fen-b";
  await rerender();
  await settleTransition();
  await unmount();
  expect(fixtures.releaseEngineSearch).toHaveBeenCalledWith(engine, "tab-1", "generation-1");
  await act(async () => {
    prepare.resolve("pending-owner");
    await flush();
  });
  expect(fixtures.releaseEngineSearch).toHaveBeenCalledWith(engine, "tab-1", "pending-owner");
});

test("a cancelled pending successor preserves the actual warm owner for cleanup", async () => {
  await rerender();
  await settleTransition();
  fixtures.prepareEngineSearch
    .mockResolvedValueOnce("pending-b")
    .mockResolvedValueOnce("pending-c");
  fixtures.fen = "fen-b";
  await rerender();
  await settleTransition();
  fixtures.stopEngine.mockResolvedValueOnce(false);
  fixtures.fen = "fen-c";
  await rerender();
  await settleTransition();
  await unmount();
  expect(fixtures.releaseEngineSearch).toHaveBeenCalledWith(engine, "tab-1", "generation-1");
  expect(fixtures.releaseEngineSearch).toHaveBeenCalledWith(engine, "tab-1", "pending-c");
});

test("a rejected predecessor stop is notified once, retired, and the newest request searches", async () => {
  await rerender();
  await settleTransition();
  const failure = new Error("stop failed");
  fixtures.stopEngine.mockRejectedValueOnce(failure);

  fixtures.fen = "fen-b";
  await rerender();
  await settleTransition();

  expect(fixtures.prepareEngineSearch).toHaveBeenCalledTimes(2);
  expect(fixtures.notifyUnlessCancelled).toHaveBeenCalledWith("Common.Error", failure);
  fixtures.fen = "fen-c";
  await rerender();
  expect(fixtures.prepareEngineSearch).toHaveBeenCalledTimes(3);
  expect(fixtures.notifyUnlessCancelled).toHaveBeenCalledTimes(1);
});

test("stale protocol Conflict is silent while current Conflict is visible", async () => {
  const first = deferred<string>();
  const conflict = new Error("Conflict: invalid or expired reservation");
  const second = deferred<string>();
  fixtures.prepareEngineSearch
    .mockReturnValueOnce(first.promise)
    .mockReturnValueOnce(second.promise);
  await rerender();
  await settleTransition();

  fixtures.fen = "fen-b";
  await rerender();
  await act(async () => {
    first.reject(conflict);
    await flush();
  });
  expect(fixtures.notifyUnlessCancelled).not.toHaveBeenCalled();
  await act(async () => {
    second.reject(conflict);
    await flush();
  });
  expect(fixtures.notifyUnlessCancelled).toHaveBeenCalledWith("Common.Error", conflict);
});

test("live close and tab removal block transitions, preparation, and later starts", async () => {
  store.set(closingTabsAtom, new Set(["tab-1"]));
  await rerender();
  await act(async () => flush());
  await settleTransition();
  expect(fixtures.prepareEngineSearch).not.toHaveBeenCalled();

  const prepare = deferred<string>();
  fixtures.prepareEngineSearch.mockReturnValueOnce(prepare.promise);
  store.set(closingTabsAtom, new Set());
  await act(async () => flush());
  await settleTransition();
  store.set(closingTabsAtom, new Set(["tab-1"]));
  store.set(tabsAtom, [{ value: "tab-2" }] as any);
  await act(async () => {
    prepare.resolve("closing-owner");
    await flush();
  });
  expect(fixtures.stopEngine).toHaveBeenCalledWith(engine, "tab-1", "closing-owner");
  expect(fixtures.getBestMoves).not.toHaveBeenCalled();

  store.set(closingTabsAtom, new Set());
  await act(async () => flush());
  await settleTransition();
  expect(fixtures.prepareEngineSearch).toHaveBeenCalledTimes(1);
});

test("close intent arriving during predecessor stop blocks preparation", async () => {
  await rerender();
  await settleTransition();
  const stop = deferred<void>();
  fixtures.stopEngine.mockReturnValueOnce(stop.promise);

  fixtures.fen = "fen-b";
  await rerender();
  await act(async () => {
    await flush();
    await flush();
  });
  expect(fixtures.stopEngine).toHaveBeenCalledWith(engine, "tab-1", "generation-1");
  store.set(closingTabsAtom, new Set(["tab-1"]));
  await act(async () => {
    stop.resolve();
    await flush();
  });

  expect(fixtures.prepareEngineSearch).toHaveBeenCalledTimes(1);
  expect(fixtures.getBestMoves).toHaveBeenCalledTimes(1);
});

test("a fast failed close permanently cancels the old attempt and starts a fresh one", async () => {
  fixtures.prepareEngineSearch
    .mockResolvedValueOnce("before-close")
    .mockResolvedValueOnce("after-failed-close");
  await rerender();
  await settleTransition();

  await act(async () => {
    store.set(closingTabsAtom, new Set(["tab-1"]));
    store.set(closingTabsAtom, new Set());
    await flush();
  });
  await broadcast(payload("before-close", { progress: 91 }));
  expect(store.get(movesAtom()).size).toBe(0);
  expect(store.get(progressAtom())).toBe(0);

  await settleTransition();
  expect(fixtures.stopEngine).toHaveBeenCalledWith(engine, "tab-1", "before-close");
  expect(fixtures.prepareEngineSearch).toHaveBeenCalledTimes(2);
  expect(fixtures.getBestMoves).toHaveBeenLastCalledWith(
    engine,
    "tab-1",
    { t: "Infinite" },
    expect.anything(),
    "after-failed-close",
  );
});

test("same-name engines retain independent cache, progress, and native owners", async () => {
  const twin = { ...engine, id: "engine-2" };
  fixtures.prepareEngineSearch.mockImplementation(async (candidate: typeof engine) =>
    candidate.id === "engine-1" ? "owner-1" : "owner-2",
  );
  await act(async () => {
    store.set(enginesAtom, [engine, twin] as any);
    await flush();
  });
  await rerender();
  await settleTransition();

  expect(fixtures.listeners).toHaveLength(2);
  expect(fixtures.getBestMoves).toHaveBeenCalledWith(
    engine,
    "tab-1",
    expect.anything(),
    expect.anything(),
    "owner-1",
  );
  expect(fixtures.getBestMoves).toHaveBeenCalledWith(
    twin,
    "tab-1",
    expect.anything(),
    expect.anything(),
    "owner-2",
  );
  await broadcast(payload("owner-1"));
  await broadcast(payload("owner-2", { engine: "engine-2", progress: 75 }));
  expect(store.get(movesAtom("tab-1", "engine-1")).get("start-fen:")).toBeDefined();
  expect(store.get(movesAtom("tab-1", "engine-2")).get("start-fen:")).toBeDefined();
  expect(store.get(progressAtom("tab-1", "engine-1"))).toBe(50);
  expect(store.get(progressAtom("tab-1", "engine-2"))).toBe(75);
});

test("a navigation burst during stop runs only the newest request next", async () => {
  await rerender();
  const stop = deferred<boolean>();
  fixtures.stopEngine.mockReturnValueOnce(stop.promise);
  fixtures.fen = "fen-b";
  await rerender();
  fixtures.fen = "fen-c";
  await rerender();
  fixtures.fen = "fen-d";
  await rerender();
  expect(fixtures.prepareEngineSearch).toHaveBeenCalledTimes(1);
  await broadcast(payload("generation-1"));
  expect(store.get(movesAtom()).size).toBe(0);
  await act(async () => {
    stop.resolve(true);
    await flush();
  });
  expect(fixtures.stopEngine).toHaveBeenCalledTimes(1);
  expect(fixtures.prepareEngineSearch).toHaveBeenCalledTimes(2);
  expect(fixtures.getBestMoves).toHaveBeenCalledTimes(2);
  expect(fixtures.getBestMoves.mock.calls.map((call) => call[3].fen)).toEqual([
    "start-fen",
    "fen-d",
  ]);
});

test("a navigation burst during preparation retires the stale reservation then prepares only the newest", async () => {
  const prepare = deferred<string>();
  fixtures.prepareEngineSearch.mockReturnValueOnce(prepare.promise).mockResolvedValueOnce("newest");
  await rerender();
  fixtures.fen = "fen-b";
  await rerender();
  fixtures.fen = "fen-c";
  await rerender();
  expect(fixtures.prepareEngineSearch).toHaveBeenCalledTimes(1);
  expect(fixtures.getBestMoves).not.toHaveBeenCalled();
  await act(async () => {
    prepare.resolve("stale");
    await flush();
  });
  expect(fixtures.stopEngine).toHaveBeenCalledWith(engine, "tab-1", "stale");
  expect(fixtures.prepareEngineSearch).toHaveBeenCalledTimes(2);
  expect(fixtures.getBestMoves).toHaveBeenCalledTimes(1);
  expect(fixtures.getBestMoves.mock.calls[0][3].fen).toBe("fen-c");
});

test("a stop rejected after navigation is notified once and cannot poison the coalescing slot", async () => {
  await rerender();
  const stop = deferred<boolean>();
  const failure = new Error("stop failed while superseded");
  fixtures.stopEngine.mockReturnValueOnce(stop.promise);
  fixtures.fen = "fen-b";
  await rerender();
  fixtures.fen = "fen-c";
  await rerender();
  await act(async () => {
    stop.reject(failure);
    await flush();
  });
  expect(fixtures.notifyUnlessCancelled).toHaveBeenCalledExactlyOnceWith("Common.Error", failure);
  expect(fixtures.stopEngine).toHaveBeenCalledTimes(1);
  expect(fixtures.prepareEngineSearch).toHaveBeenCalledTimes(2);
  expect(fixtures.getBestMoves.mock.calls[1][3].fen).toBe("fen-c");
  await unmount();
  expect(fixtures.notifyUnlessCancelled).toHaveBeenCalledTimes(1);
});

test("a rejected predecessor release is notified once and the new tab prepares and searches", async () => {
  await rerender();
  const release = deferred<void>();
  const failure = new Error("release failed");
  fixtures.releaseEngineSearch.mockReturnValueOnce(release.promise);
  await act(async () => {
    store.set(activeTabAtom, "tab-2");
    await flush();
  });
  fixtures.fen = "fen-c";
  await rerender();
  expect(fixtures.prepareEngineSearch).toHaveBeenCalledTimes(1);
  await act(async () => {
    release.reject(failure);
    await flush();
  });
  expect(fixtures.notifyUnlessCancelled).toHaveBeenCalledExactlyOnceWith("Common.Error", failure);
  expect(fixtures.releaseEngineSearch).toHaveBeenCalledTimes(1);
  expect(fixtures.prepareEngineSearch).toHaveBeenLastCalledWith(engine, "tab-2");
  expect(fixtures.getBestMoves.mock.calls[1][3].fen).toBe("fen-c");
  expect(fixtures.stopEngine).not.toHaveBeenCalled();
  await unmount();
  expect(fixtures.notifyUnlessCancelled).toHaveBeenCalledTimes(1);
});

test("a failed stop does not retain its actor while the successor prepares", async () => {
  await rerender();
  const prepare = deferred<string>();
  fixtures.stopEngine.mockRejectedValueOnce(new Error("stop failed"));
  fixtures.prepareEngineSearch.mockReturnValueOnce(prepare.promise);
  fixtures.fen = "fen-b";
  await rerender();
  await unmount();
  expect(fixtures.releaseEngineSearch).not.toHaveBeenCalled();
  await act(async () => {
    prepare.resolve("late-owner");
    await flush();
  });
  expect(fixtures.releaseEngineSearch).toHaveBeenCalledExactlyOnceWith(
    engine,
    "tab-1",
    "late-owner",
  );
  expect(fixtures.notifyUnlessCancelled).toHaveBeenCalledTimes(1);
});

test("remembered lines survive A to B to A and restarted shallow output cannot downgrade lines or score", async () => {
  fixtures.prepareEngineSearch
    .mockResolvedValueOnce("a1")
    .mockResolvedValueOnce("b")
    .mockResolvedValueOnce("a2");
  await rerender();
  const deep = payload("a1");
  deep.bestLines[0].depth = 20;
  await broadcast(deep);
  expect(fixtures.setScore).toHaveBeenCalledExactlyOnceWith(deep.bestLines[0].score);
  fixtures.fen = "fen-b";
  await rerender();
  expect(store.get(movesAtom()).get("start-fen:")).toEqual(deep.bestLines);
  fixtures.fen = "start-fen";
  await rerender();
  expect(store.get(movesAtom()).get("start-fen:")).toEqual(deep.bestLines);
  const shallow = payload("a2");
  shallow.bestLines[0].depth = 19;
  shallow.bestLines[0].score.value.value = 2;
  await broadcast(shallow);
  expect(store.get(movesAtom()).get("start-fen:")).toEqual(deep.bestLines);
  expect(fixtures.setScore).toHaveBeenCalledTimes(1);
  const equalDepth = payload("a2");
  equalDepth.bestLines[0].depth = 20;
  equalDepth.bestLines[0].score.value.value = 33;
  await broadcast(equalDepth);
  expect(store.get(movesAtom()).get("start-fen:")).toEqual(equalDepth.bestLines);
  expect(fixtures.setScore).toHaveBeenLastCalledWith(equalDepth.bestLines[0].score);
  expect(fixtures.setScore).toHaveBeenCalledTimes(2);
  // Once this search has written the entry, its own revisions may be shallower.
  await broadcast(shallow);
  expect(store.get(movesAtom()).get("start-fen:")).toEqual(shallow.bestLines);
  expect(fixtures.setScore).toHaveBeenCalledTimes(3);
  expect(fixtures.setScore).toHaveBeenLastCalledWith(shallow.bestLines[0].score);
});

test("normal and threat entries coexist and threat toggles restore lines without writing the node score", async () => {
  fixtures.prepareEngineSearch
    .mockResolvedValueOnce("normal")
    .mockResolvedValueOnce("threat")
    .mockResolvedValueOnce("normal-again")
    .mockResolvedValueOnce("threat-again");
  await rerender();
  const normal = payload("normal");
  await broadcast(normal);
  await act(async () => {
    store.set(currentThreatAtom, true);
    await flush();
  });
  const threat = payload("threat", { fen: `threat:${INITIAL_FEN}` });
  threat.bestLines[0].depth = 30;
  threat.bestLines[0].score.value.value = -50;
  await broadcast(threat);
  expect(store.get(movesAtom()).size).toBe(2);
  expect(store.get(movesAtom()).get("start-fen:")).toEqual(normal.bestLines);
  expect(fixtures.setScore).toHaveBeenCalledExactlyOnceWith(normal.bestLines[0].score);
  await act(async () => {
    store.set(currentThreatAtom, false);
    await flush();
  });
  expect(store.get(movesAtom()).get("start-fen:")).toEqual(normal.bestLines);
  expect(fixtures.setScore).toHaveBeenCalledTimes(1);
  await act(async () => {
    store.set(currentThreatAtom, true);
    await flush();
  });
  expect(store.get(movesAtom()).get(`threat:${INITIAL_FEN}:`)).toEqual(threat.bestLines);
  expect(fixtures.setScore).toHaveBeenCalledTimes(1);
});

test("only the first engine with lines writes the node score", async () => {
  fixtures.scoreOwner = "another-engine";
  await rerender();
  await broadcast(payload("generation-1"));
  expect(store.get(movesAtom()).get("start-fen:")).toBeDefined();
  expect(fixtures.setScore).not.toHaveBeenCalled();
});

test("the current first engine with lines can update its score", async () => {
  fixtures.scoreOwner = engine.id;
  await rerender();
  const result = payload("generation-1");
  await broadcast(result);
  expect(fixtures.setScore).toHaveBeenCalledExactlyOnceWith(result.bestLines[0].score);
});

test("a synchronous launch failure is notified and retires the transition slot", async () => {
  const failure = new Error("launch rejected synchronously");
  fixtures.getBestMoves.mockImplementationOnce(() => {
    throw failure;
  });
  await rerender();
  expect(fixtures.notifyUnlessCancelled).toHaveBeenCalledExactlyOnceWith("Common.Error", failure);
  fixtures.fen = "fen-b";
  await rerender();
  expect(fixtures.prepareEngineSearch).toHaveBeenCalledTimes(2);
  expect(fixtures.getBestMoves).toHaveBeenCalledTimes(2);
});

test("line context survives listener remount and changes only for settings or executable identity", async () => {
  await rerender();
  const result = payload("generation-1");
  await broadcast(result);
  await unmount();
  root = createRoot(host);
  mounted = true;
  await rerender();
  expect(store.get(movesAtom()).get("start-fen:")).toEqual(result.bestLines);
  fixtures.fen = "fen-b";
  await rerender();
  expect(store.get(movesAtom()).get("start-fen:")).toEqual(result.bestLines);
  await act(async () => {
    store.set(settingsAtom(), {
      ...store.get(settingsAtom()),
      settings: [{ type: "string", name: "Hash", value: "256" }],
    });
    await flush();
  });
  expect(store.get(movesAtom()).size).toBe(0);
  await broadcast(payload("generation-1", { fen: "fen-b" }));
  expect(store.get(movesAtom()).size).toBe(1);
  const replacement = {
    ...engine,
    handle: { id: { id: "replaced-handle" }, kind: "engine" as const },
  };
  await act(async () => {
    store.set(enginesAtom, [replacement] as any);
    await flush();
  });
  expect(store.get(movesAtom()).size).toBe(0);
});

test("a payload move list must match by deep equality even when joined strings match", async () => {
  fixtures.moves = ["e2e4", "e7e5"];
  await rerender();
  await broadcast(payload("generation-1", { moves: ["e2e4,e7e5"] }));
  expect(store.get(movesAtom()).size).toBe(0);
  await broadcast(payload("generation-1", { moves: ["e2e4", "e7e5"] }));
  expect(store.get(movesAtom()).get("start-fen:e2e4,e7e5")).toBeDefined();
});

function payload(generation: string, overrides: Partial<BestMovesPayload> = {}): BestMovesPayload {
  return {
    bestLines: [
      {
        score: { value: { type: "cp", value: 10 }, wdl: null },
        nodes: 1n,
        depth: 12,
        multipv: 1,
        nps: 1n,
        uciMoves: ["e2e4"],
        sanMoves: ["e4"],
      },
    ],
    engine: overrides.engine ?? "engine-1",
    tab: "tab-1",
    fen: overrides.fen ?? "start-fen",
    moves: overrides.moves ?? [],
    progress: overrides.progress ?? 50,
    generation,
  };
}

function remoteResult(progress: number): [number, BestMovesPayload["bestLines"]] {
  return [progress, payload("").bestLines];
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}
