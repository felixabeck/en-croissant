import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  activeTab: "tab-1",
  activeTabAtom: Symbol("activeTabAtom"),
  currentThreatAtom: Symbol("currentThreatAtom"),
  enginesAtom: Symbol("enginesAtom"),
  getBestMoves: vi.fn(),
  notifyUnlessCancelled: vi.fn(),
  stopEngine: vi.fn(),
}));

const engine = {
  type: "local" as const,
  id: "engine-1",
  name: "Stockfish",
  version: "17",
  filename: "stockfish",
  handle: { id: { id: "handle-1" }, kind: "engine" as const },
  loaded: true,
};

vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@/components/files/notifyError", () => ({
  notifyListenerError: vi.fn(),
  notifyUnlessCancelled: mocks.notifyUnlessCancelled,
}));
vi.mock("@/utils/engines", () => ({
  getBestMoves: mocks.getBestMoves,
  stopEngine: mocks.stopEngine,
}));
vi.mock("@/utils/chess", () => ({ getVariationLine: () => [] }));
vi.mock("@/utils/chessops", () => ({
  positionFromFen: () => [null],
  swapMove: (fen: string) => fen,
}));
vi.mock("@/utils/chessdb/api", () => ({ getBestMoves: vi.fn() }));
vi.mock("@/utils/lichess/api", () => ({ getBestMoves: vi.fn() }));
vi.mock("@/platform/tauri", () => ({
  tauriSubscriptions: { bestMoves: vi.fn() },
}));
vi.mock("@/platform/useTauriListener", () => ({ useTauriListener: vi.fn() }));
vi.mock("@/utils/misc", async () => {
  const React = await vi.importActual<typeof import("react")>("react");
  return {
    useThrottledEffect: (
      callback: () => void,
      _delay: number,
      dependencies: React.DependencyList,
    ) => React.useEffect(callback, [callback, ...dependencies]),
  };
});
vi.mock("@/state/atoms", () => ({
  activeTabAtom: mocks.activeTabAtom,
  currentThreatAtom: mocks.currentThreatAtom,
  engineMovesFamily: () => Symbol("engineMoves"),
  engineProgressFamily: () => Symbol("engineProgress"),
  enginesAtom: mocks.enginesAtom,
  firstEngineWithLinesFamily: () => Symbol("firstEngineWithLines"),
  tabEngineSettingsFamily: () => Symbol("tabEngineSettings"),
}));
vi.mock("jotai", () => {
  return {
    useAtom: (atom: symbol) => {
      if (atom === mocks.enginesAtom) return [[engine], vi.fn()];
      if (String(atom).includes("tabEngineSettings")) {
        return [{ enabled: true, synced: false, go: { t: "Infinite" }, settings: [] }, vi.fn()];
      }
      return [new Map(), vi.fn()];
    },
    useAtomValue: (atom: symbol) => {
      if (atom === mocks.activeTabAtom) return mocks.activeTab;
      if (atom === mocks.currentThreatAtom) return false;
      return null;
    },
  };
});
vi.mock("zustand", () => ({
  useStore: (_store: unknown, selector: (state: any) => unknown) =>
    selector({ root: { fen: "start-fen" }, position: [], setScore: vi.fn() }),
}));
vi.mock("zustand/react/shallow", () => ({ useShallow: (selector: unknown) => selector }));
vi.mock("@/components/common/TreeStateContext", async () => {
  const React = await vi.importActual<typeof import("react")>("react");
  return { TreeStateContext: React.createContext({}) };
});

import EvalListener from "./EvalListener";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.activeTab = "tab-1";
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});

afterEach(() => {
  host.remove();
});

async function render() {
  await act(async () => root.render(<EvalListener />));
}

test("a rejected stop notifies and does not start a replacement search", async () => {
  const failure = new Error("stop failed");
  mocks.stopEngine.mockRejectedValue(failure);

  await render();
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });

  expect(mocks.getBestMoves).not.toHaveBeenCalled();
  expect(mocks.notifyUnlessCancelled).toHaveBeenCalledWith("Common.Error", failure);
  await act(async () => root.unmount());
});

test("a delayed successful stop cannot start a search after unmount", async () => {
  let resolveStop!: () => void;
  mocks.stopEngine.mockImplementation(
    () => new Promise<void>((resolve) => (resolveStop = resolve)),
  );

  await render();
  await act(async () => root.unmount());
  await act(async () => {
    resolveStop();
    await Promise.resolve();
  });

  expect(mocks.getBestMoves).not.toHaveBeenCalled();
});

test("a successful stop starts a replacement search", async () => {
  mocks.stopEngine.mockResolvedValue(undefined);
  mocks.getBestMoves.mockResolvedValue([0, []]);

  await render();
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });

  expect(mocks.getBestMoves).toHaveBeenCalled();
  await act(async () => root.unmount());
});

test("a delayed stop from a stale request cannot start a replacement search", async () => {
  const resolvers: Array<() => void> = [];
  mocks.stopEngine.mockImplementation(
    () => new Promise<void>((resolve) => resolvers.push(resolve)),
  );

  await render();
  mocks.activeTab = "tab-2";
  await act(async () => root.render(<EvalListener />));
  await act(async () => {
    resolvers[0]();
    await Promise.resolve();
  });

  expect(mocks.getBestMoves).not.toHaveBeenCalled();
  await act(async () => root.unmount());
  await act(async () => {
    resolvers[1]();
    await Promise.resolve();
  });
});
