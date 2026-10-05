import { MantineProvider } from "@mantine/core";
import { INITIAL_FEN } from "chessops/fen";
import { createStore, Provider } from "jotai";
import { act, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import type { BestMoves } from "@/bindings";
import { activeTabAtom, engineMovesFamily, tabEngineSettingsFamily, tabsAtom } from "@/state/atoms";
import { installMatchMediaStub } from "./matchMedia";

export const displayEngine = {
  type: "local" as const,
  id: "display-engine",
  name: "Stockfish",
  version: "19",
  filename: "stockfish",
  handle: { id: { id: "engine-handle" }, kind: "engine" as const },
  loaded: true,
};
export const displayLines: BestMoves[] = [
  {
    depth: 20,
    multipv: 1,
    score: { value: { type: "cp", value: 34 }, wdl: null },
    nodes: 1234n,
    nps: 5678n,
    sanMoves: ["e4", "e5", "Nf3"],
    uciMoves: ["e2e4", "e7e5", "g1f3"],
  },
];

export function engineDisplayHarness() {
  installMatchMediaStub();
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  const store = createStore();
  store.set(
    tabsAtom,
    ["display-tab", "another-tab"].map((value) => ({
      value,
      name: "Analysis",
      type: "analysis" as const,
      gameOrigin: { kind: "none" as const },
    })),
  );
  store.set(activeTabAtom, "display-tab");
  const settingsAtom = tabEngineSettingsFamily({ tab: "display-tab", engineId: displayEngine.id });
  store.set(settingsAtom, { enabled: true, settings: [], go: { t: "Infinite" }, synced: false });
  const memoryAtom = engineMovesFamily({ tab: "display-tab", engine: displayEngine.id });
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  return {
    store,
    settingsAtom,
    memoryAtom,
    host,
    async render(children: ReactNode) {
      await act(async () =>
        root.render(
          <Provider store={store}>
            <MantineProvider env="test">{children}</MantineProvider>
          </Provider>,
        ),
      );
    },
    async remember(lines = displayLines, moves: string[] = []) {
      await act(async () =>
        store.set(memoryAtom, new Map([[`${INITIAL_FEN}:${moves.join(",")}`, lines]])),
      );
    },
    async close() {
      await act(async () => root.unmount());
      host.remove();
    },
  };
}
