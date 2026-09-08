import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { getDefaultStore } from "jotai";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import type { BestMovesPayload } from "@/bindings";

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
  fen: "start-fen",
  moves: [] as string[],
  getBestMoves: vi.fn(),
  prepareEngineSearch: vi.fn(),
  listeners: [] as Array<(event: any) => void>,
  notifyUnlessCancelled: vi.fn(),
  setScore: vi.fn(),
  stopEngine: vi.fn(),
  t: (key: string) => key,
}));

const engine = fixtures.engine;

vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: fixtures.t }) }));
vi.mock("@/components/files/notifyError", () => ({
  notifyListenerError: vi.fn(),
  notifyUnlessCancelled: fixtures.notifyUnlessCancelled,
}));
vi.mock("@/utils/engines", () => ({
  getBestMoves: fixtures.getBestMoves,
  prepareEngineSearch: fixtures.prepareEngineSearch,
  stopEngine: fixtures.stopEngine,
}));
vi.mock("@/utils/chess", () => ({ getVariationLine: () => fixtures.moves }));
vi.mock("@/utils/chessops", () => ({
  positionFromFen: () => [null],
  swapMove: (fen: string) => fen,
}));
vi.mock("@/utils/chessdb/api", () => ({ getBestMoves: vi.fn() }));
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
    firstEngineWithLinesFamily: atomFamily(() => atom<string | null>(null)),
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
const settingsAtom = (tab = store.get(activeTabAtom)!) =>
  tabEngineSettingsFamily({
    engineId: engine.id,
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

async function advanceDebounce() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(50);
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
  fixtures.fen = "start-fen";
  fixtures.moves = [];
  fixtures.listeners = [];
  fixtures.prepareEngineSearch.mockResolvedValue("generation-1");
  fixtures.stopEngine.mockResolvedValue(undefined);
  fixtures.getBestMoves.mockImplementation(() => new Promise(() => undefined));
  store.set(activeTabAtom, "tab-1");
  store.set(tabsAtom, [{ value: "tab-1" }, { value: "tab-2" }] as any);
  store.set(closingTabsAtom, new Set());
  store.set(enginesAtom, [engine] as any);
  store.set(settingsAtom("tab-1"), {
    enabled: true,
    synced: true,
    go: { t: "Infinite" },
    settings: [],
  });
  store.set(movesAtom("tab-1"), new Map([["old", payload("cached").bestLines]]));
  store.set(progressAtom("tab-1"), 73);
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

test("clears cached analysis immediately and waits for the real 50 ms debounce", async () => {
  await rerender();

  expect(store.get(movesAtom())).toEqual(new Map());
  expect(store.get(progressAtom())).toBe(0);
  expect(fixtures.prepareEngineSearch).not.toHaveBeenCalled();
  await act(async () => vi.advanceTimersByTimeAsync(49));
  expect(fixtures.prepareEngineSearch).not.toHaveBeenCalled();

  await act(async () => {
    await vi.advanceTimersByTimeAsync(1);
    await flush();
  });
  expect(fixtures.prepareEngineSearch).toHaveBeenCalledWith(engine, "tab-1");
  expect(fixtures.getBestMoves).toHaveBeenCalledWith(
    engine,
    "tab-1",
    { t: "Infinite" },
    { fen: "start-fen", moves: [], extraOptions: [] },
    "generation-1",
  );
});

test("settings and go changes reject old events before debounce and clear cached state", async () => {
  fixtures.prepareEngineSearch
    .mockResolvedValueOnce("generation-old")
    .mockResolvedValueOnce("generation-new");
  await rerender();
  await advanceDebounce();
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

  expect(store.get(movesAtom())).toEqual(new Map());
  expect(store.get(progressAtom())).toBe(0);
  await broadcast(payload("generation-old", { progress: 88 }));
  expect(store.get(movesAtom())).toEqual(new Map());
  expect(store.get(progressAtom())).toBe(0);
  expect(fixtures.prepareEngineSearch).toHaveBeenCalledTimes(1);

  await advanceDebounce();
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
  "a same-position %s change alone rejects old events before debounce",
  async (_name, settings) => {
    fixtures.prepareEngineSearch
      .mockResolvedValueOnce("before-option")
      .mockResolvedValueOnce("after-option");
    await rerender();
    await advanceDebounce();

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
    expect(store.get(movesAtom())).toEqual(new Map());
    expect(store.get(progressAtom())).toBe(0);
    expect(fixtures.prepareEngineSearch).toHaveBeenCalledTimes(1);

    await advanceDebounce();
    expect(fixtures.prepareEngineSearch).toHaveBeenCalledTimes(2);
  },
);

test("a same-position go-only change rejects old events before debounce", async () => {
  fixtures.prepareEngineSearch.mockResolvedValueOnce("before-go").mockResolvedValueOnce("after-go");
  await rerender();
  await advanceDebounce();

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
  expect(store.get(movesAtom())).toEqual(new Map());
  expect(store.get(progressAtom())).toBe(0);
  expect(fixtures.prepareEngineSearch).toHaveBeenCalledTimes(1);

  await advanceDebounce();
  expect(fixtures.prepareEngineSearch).toHaveBeenCalledTimes(2);
});

test("an executable change rejects the old owner before debounce", async () => {
  fixtures.prepareEngineSearch
    .mockResolvedValueOnce("old-binary-owner")
    .mockResolvedValueOnce("new-binary-owner");
  await rerender();
  await advanceDebounce();
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
  expect(store.get(movesAtom())).toEqual(new Map());
  expect(store.get(progressAtom())).toBe(0);
  await broadcast(payload("old-binary-owner", { progress: 90 }));
  expect(store.get(progressAtom())).toBe(0);
  expect(fixtures.prepareEngineSearch).toHaveBeenCalledTimes(1);

  await advanceDebounce();
  expect(fixtures.stopEngine).toHaveBeenCalledWith(engine, "tab-1", "old-binary-owner");
  expect(fixtures.prepareEngineSearch).toHaveBeenLastCalledWith(replacement, "tab-1");
});

test("accepts current info and terminal results but rejects an old generation", async () => {
  fixtures.prepareEngineSearch.mockResolvedValue("generation-current");
  await rerender();
  await advanceDebounce();

  await broadcast(payload("generation-old"));
  expect(store.get(movesAtom())).toEqual(new Map());
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
  await advanceDebounce();

  fixtures.fen = "fen-b";
  await rerender();
  await advanceDebounce();
  fixtures.fen = "start-fen";
  await rerender();
  await advanceDebounce();

  await broadcast(payload("generation-a1"));
  expect(store.get(movesAtom())).toEqual(new Map());
  await broadcast(payload("generation-a2"));
  expect(store.get(progressAtom())).toBe(50);

  await unmount();
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  mounted = true;
  await rerender();
  await advanceDebounce();
  store.set(movesAtom(), new Map());
  await broadcast(payload("generation-a2"));
  expect(store.get(movesAtom())).toEqual(new Map());
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
  await advanceDebounce();

  fixtures.fen = "fen-b";
  await rerender();
  await advanceDebounce();
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
  await act(async () => {
    prepares[0].resolve("stale-owner");
    await flush();
  });
  expect(fixtures.stopEngine).toHaveBeenCalledWith(engine, "tab-1", "stale-owner");
  expect(fixtures.stopEngine).not.toHaveBeenCalledWith(engine, "tab-1", "new-owner");

  await unmount();
  expect(fixtures.stopEngine).toHaveBeenCalledWith(engine, "tab-1", "new-owner");
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  mounted = true;
  await rerender();
  await advanceDebounce();
  await unmount();
  await act(async () => {
    prepares[2].resolve("unmounted-owner");
    await flush();
  });
  expect(fixtures.stopEngine).toHaveBeenCalledWith(engine, "tab-1", "unmounted-owner");
});

test("tab switch and unmount before debounce stop the captured predecessor", async () => {
  fixtures.prepareEngineSearch
    .mockResolvedValueOnce("tab-1-owner")
    .mockResolvedValueOnce("tab-2-owner");
  await rerender();
  await advanceDebounce();

  await act(async () => {
    store.set(activeTabAtom, "tab-2");
    await flush();
  });
  expect(fixtures.stopEngine).not.toHaveBeenCalled();
  await advanceDebounce();
  expect(fixtures.stopEngine).toHaveBeenCalledWith(engine, "tab-1", "tab-1-owner");

  fixtures.fen = "third-fen";
  await rerender();
  await unmount();
  expect(fixtures.stopEngine).toHaveBeenCalledWith(engine, "tab-2", "tab-2-owner");
});

test("a stop failure is visible and blocks preparation of a replacement", async () => {
  await rerender();
  await advanceDebounce();
  const failure = new Error("stop failed");
  fixtures.stopEngine.mockRejectedValueOnce(failure);

  fixtures.fen = "fen-b";
  await rerender();
  await advanceDebounce();

  expect(fixtures.prepareEngineSearch).toHaveBeenCalledTimes(1);
  expect(fixtures.notifyUnlessCancelled).toHaveBeenCalledWith("Common.Error", failure);
});

test("stale protocol Conflict is silent while current Conflict is visible", async () => {
  const first = deferred<string>();
  const conflict = new Error("Conflict: invalid or expired reservation");
  fixtures.prepareEngineSearch.mockReturnValueOnce(first.promise).mockRejectedValueOnce(conflict);
  await rerender();
  await advanceDebounce();

  fixtures.fen = "fen-b";
  await rerender();
  await act(async () => {
    first.reject(conflict);
    await flush();
  });
  expect(fixtures.notifyUnlessCancelled).not.toHaveBeenCalled();

  await advanceDebounce();
  expect(fixtures.notifyUnlessCancelled).toHaveBeenCalledWith("Common.Error", conflict);
});

test("live close and tab removal block debounce, preparation, and later starts", async () => {
  await rerender();
  store.set(closingTabsAtom, new Set(["tab-1"]));
  await act(async () => flush());
  await advanceDebounce();
  expect(fixtures.prepareEngineSearch).not.toHaveBeenCalled();

  store.set(closingTabsAtom, new Set());
  await act(async () => flush());
  const prepare = deferred<string>();
  fixtures.prepareEngineSearch.mockReturnValueOnce(prepare.promise);
  await advanceDebounce();
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
  await advanceDebounce();
  expect(fixtures.prepareEngineSearch).toHaveBeenCalledTimes(1);
});

test("close intent arriving during predecessor stop blocks preparation", async () => {
  await rerender();
  await advanceDebounce();
  const stop = deferred<void>();
  fixtures.stopEngine.mockReturnValueOnce(stop.promise);

  fixtures.fen = "fen-b";
  await rerender();
  await act(async () => {
    await vi.advanceTimersByTimeAsync(50);
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
  await advanceDebounce();

  await act(async () => {
    store.set(closingTabsAtom, new Set(["tab-1"]));
    store.set(closingTabsAtom, new Set());
    await flush();
  });
  await broadcast(payload("before-close", { progress: 91 }));
  expect(store.get(movesAtom())).toEqual(new Map());
  expect(store.get(progressAtom())).toBe(0);

  await advanceDebounce();
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
  await advanceDebounce();

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

function payload(
  generation: string,
  overrides: Partial<{ engine: string; fen: string; moves: string[]; progress: number }> = {},
): BestMovesPayload {
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

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}
