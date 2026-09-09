import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { cancellationError } from "@/platform/tauri";
import { MantineProvider } from "@mantine/core";
import { Provider as JotaiProvider, createStore as createJotaiStore } from "jotai";
import { SWRConfig } from "swr";
import { TreeStateContext } from "@/components/common/TreeStateContext";
import { createTreeStore, type TreeStore } from "@/state/store/tree";
import {
  currentDbTypeAtom,
  currentDbTabAtom,
  sessionsAtom,
  tabsAtom,
  activeTabAtom,
} from "@/state/atoms";

const mocks = vi.hoisted(() => ({
  logError: vi.fn(),
  getLichessGames: vi.fn(),
  getMasterGames: vi.fn(),
  getPublicLichessJson: vi.fn(),
  lexPgn: vi.fn(),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a {...props}>{children}</a>
  ),
  useRouter: () => ({}),
  useNavigate: () => vi.fn(),
}));

vi.mock("@/platform/native", () => ({
  error: mocks.logError,
  warn: vi.fn(),
  info: vi.fn(),
  debug: vi.fn(),
  trace: vi.fn(),
}));

vi.mock("@/utils/lichess/api", async () => {
  const actual = await vi.importActual<typeof import("@/utils/lichess/api")>("@/utils/lichess/api");
  return {
    ...actual,
    getLichessGames: mocks.getLichessGames,
    getMasterGames: mocks.getMasterGames,
  };
});

vi.mock("@/platform/tauri", async () => {
  const actual = await vi.importActual<typeof import("@/platform/tauri")>("@/platform/tauri");
  return {
    ...actual,
    tauri: {
      ...actual.tauri,
      getPublicLichessJson: mocks.getPublicLichessJson,
      lexPgn: mocks.lexPgn,
    },
  };
});

import DatabasePanel, { fetchOpening } from "./DatabasePanel";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
class MockResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver = MockResizeObserver;

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

describe("DatabasePanel online explorer branches", () => {
  let container: HTMLDivElement;
  let root: Root;
  let treeStore: TreeStore;

  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    treeStore = createTreeStore();
    mocks.logError.mockReset().mockResolvedValue(undefined);
    mocks.getLichessGames.mockReset();
    mocks.getMasterGames.mockReset();
    mocks.getPublicLichessJson.mockReset();
    mocks.lexPgn.mockReset();
  });

  afterEach(async () => {
    await act(async () => {
      root?.unmount();
    });
    container?.remove();
  });

  const mockExplorerData = {
    white: 100,
    black: 80,
    draws: 20,
    moves: [{ uci: "e2e4", san: "e4", averageRating: 2000, white: 50, black: 40, draws: 10 }],
    topGames: [
      {
        id: "g0",
        white: { name: "W0", rating: 2200 },
        black: { name: "B0", rating: 2200 },
        year: 2024,
        month: "01",
      },
      {
        id: "g1",
        white: { name: "W1", rating: 2300 },
        black: { name: "B1", rating: 2300 },
        year: 2024,
        month: "02",
      },
    ],
  };

  test("lch_all: checkpoint 1 stops after explorer fetch before normalization when signal is aborted", async () => {
    const controller = new AbortController();
    mocks.getLichessGames.mockImplementation(async () => {
      controller.abort();
      return mockExplorerData;
    });

    const promise = fetchOpening(
      { type: "lch_all", fen: "startpos", options: {} as any, handle: "token-1" },
      "tab-1",
      controller.signal,
    );

    await expect(promise).rejects.toMatchObject({ name: "AbortError" });
    expect(mocks.getPublicLichessJson).not.toHaveBeenCalled();
    expect(mocks.lexPgn).not.toHaveBeenCalled();
    expect(mocks.logError).not.toHaveBeenCalled();
  });

  test("lch_all: cancellation during lexing rejects without diagnostic and publishes no partial results", async () => {
    const controller = new AbortController();
    mocks.getLichessGames.mockResolvedValue(mockExplorerData);
    mocks.getPublicLichessJson.mockResolvedValue(`[White "W"]\n[Black "B"]\n\n1. e4 e5 *`);

    mocks.lexPgn.mockImplementation(async () => {
      controller.abort();
      throw cancellationError();
    });

    const promise = fetchOpening(
      { type: "lch_all", fen: "startpos", options: {} as any, handle: "token-1" },
      "tab-1",
      controller.signal,
    );

    await expect(promise).rejects.toThrow("Cancellation");
    expect(mocks.logError).not.toHaveBeenCalled();
  });

  test("lch_master: checkpoint 1 stops after explorer fetch before normalization when signal is aborted", async () => {
    const controller = new AbortController();
    mocks.getMasterGames.mockImplementation(async () => {
      controller.abort();
      return mockExplorerData;
    });

    const promise = fetchOpening(
      { type: "lch_master", fen: "startpos", options: {} as any, handle: "token-1" },
      "tab-1",
      controller.signal,
    );

    await expect(promise).rejects.toMatchObject({ name: "AbortError" });
    expect(mocks.getPublicLichessJson).not.toHaveBeenCalled();
    expect(mocks.lexPgn).not.toHaveBeenCalled();
    expect(mocks.logError).not.toHaveBeenCalled();
  });

  test("lch_master: cancellation during lexing rejects without diagnostic and publishes no partial results", async () => {
    const controller = new AbortController();
    mocks.getMasterGames.mockResolvedValue(mockExplorerData);
    mocks.getPublicLichessJson.mockResolvedValue(`[White "W"]\n[Black "B"]\n\n1. e4 e5 *`);

    mocks.lexPgn.mockImplementation(async () => {
      controller.abort();
      throw cancellationError();
    });

    const promise = fetchOpening(
      { type: "lch_master", fen: "startpos", options: {} as any, handle: "token-1" },
      "tab-1",
      controller.signal,
    );

    await expect(promise).rejects.toThrow("Cancellation");
    expect(mocks.logError).not.toHaveBeenCalled();
  });

  test("ordinary network/parser failure retains successful siblings and produces diagnostic", async () => {
    mocks.getLichessGames.mockResolvedValue(mockExplorerData);
    mocks.getPublicLichessJson.mockImplementation(async ({ game_id }: { game_id: string }) => {
      if (game_id === "g0") throw new Error("Connection failed");
      return `[White "W1"]\n[Black "B1"]\n\n1. d4 d5 *`;
    });
    mocks.lexPgn.mockResolvedValue([]);

    const result = await fetchOpening(
      { type: "lch_all", fen: "startpos", options: {} as any, handle: "token-1" },
      "tab-1",
    );

    expect(result.openings).toHaveLength(1);
    expect(result.games).toHaveLength(1);
    expect(result.games[0].id).toBe(1);
    expect(mocks.logError).toHaveBeenCalledOnce();
    expect(mocks.logError).toHaveBeenCalledWith(expect.stringContaining("item 0 failed"));
  });

  const validSession = {
    lichess: {
      handle: "token-1",
      username: "player1",
      account: { id: "p1" } as any,
    },
    updatedAt: 12345,
  };

  const tabId = "11111111-1111-4111-8111-111111111111";
  const validTab = {
    name: "Tab 1",
    value: tabId,
    type: "analysis" as const,
    gameOrigin: { kind: "none" as const },
  };

  test("mounted lch_all: unmount during lexing aborts active lexPgn signal without diagnostic", async () => {
    sessionStorage.setItem(
      "workspace",
      JSON.stringify({ version: 1, tabs: [validTab], activeTab: tabId }),
    );
    const jotaiStore = createJotaiStore();
    jotaiStore.set(tabsAtom, [validTab]);
    jotaiStore.set(activeTabAtom, tabId);
    jotaiStore.set(currentDbTypeAtom, "lch_all");
    jotaiStore.set(currentDbTabAtom, "moves");
    jotaiStore.set(sessionsAtom, [validSession]);

    mocks.getLichessGames.mockResolvedValue(mockExplorerData);
    mocks.getPublicLichessJson.mockResolvedValue(`[White "W"]\n[Black "B"]\n\n1. e4 e5 *`);

    let observedSignal: AbortSignal | undefined;

    mocks.lexPgn.mockImplementation(async (_pgn: string, options?: { signal?: AbortSignal }) => {
      observedSignal = options?.signal;
      return new Promise((_, reject) => {
        if (options?.signal?.aborted) {
          reject(cancellationError());
          return;
        }
        options?.signal?.addEventListener("abort", () => {
          reject(cancellationError());
        });
      });
    });

    await act(async () => {
      root.render(
        <MantineProvider>
          <JotaiProvider store={jotaiStore}>
            <TreeStateContext.Provider value={treeStore}>
              <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
                <DatabasePanel />
              </SWRConfig>
            </TreeStateContext.Provider>
          </JotaiProvider>
        </MantineProvider>,
      );
    });

    await vi.waitFor(() => {
      expect(mocks.getLichessGames).toHaveBeenCalled();
      expect(mocks.getPublicLichessJson).toHaveBeenCalled();
      expect(mocks.lexPgn).toHaveBeenCalled();
    });
    expect(observedSignal).toBeDefined();
    expect(observedSignal!.aborted).toBe(false);

    await act(async () => {
      root.unmount();
    });

    expect(observedSignal!.aborted).toBe(true);
    expect(mocks.logError).not.toHaveBeenCalled();
  });

  test("mounted lch_all: replacement to lch_master during lexing aborts active lexPgn signal without diagnostic", async () => {
    sessionStorage.setItem(
      "workspace",
      JSON.stringify({ version: 1, tabs: [validTab], activeTab: tabId }),
    );
    const jotaiStore = createJotaiStore();
    jotaiStore.set(tabsAtom, [validTab]);
    jotaiStore.set(activeTabAtom, tabId);
    jotaiStore.set(currentDbTypeAtom, "lch_all");
    jotaiStore.set(currentDbTabAtom, "moves");
    jotaiStore.set(sessionsAtom, [validSession]);

    mocks.getLichessGames.mockResolvedValue(mockExplorerData);
    mocks.getMasterGames.mockResolvedValue(mockExplorerData);
    mocks.getPublicLichessJson.mockResolvedValue(`[White "W"]\n[Black "B"]\n\n1. e4 e5 *`);

    let initialSignal: AbortSignal | undefined;

    mocks.lexPgn.mockImplementation(async (_pgn: string, options?: { signal?: AbortSignal }) => {
      if (!initialSignal) {
        initialSignal = options?.signal;
      }
      return new Promise((_, reject) => {
        if (options?.signal?.aborted) {
          reject(cancellationError());
          return;
        }
        options?.signal?.addEventListener("abort", () => {
          reject(cancellationError());
        });
      });
    });

    await act(async () => {
      root.render(
        <MantineProvider>
          <JotaiProvider store={jotaiStore}>
            <TreeStateContext.Provider value={treeStore}>
              <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
                <DatabasePanel />
              </SWRConfig>
            </TreeStateContext.Provider>
          </JotaiProvider>
        </MantineProvider>,
      );
    });

    await vi.waitFor(() => {
      expect(mocks.lexPgn).toHaveBeenCalled();
    });
    expect(initialSignal).toBeDefined();
    expect(initialSignal!.aborted).toBe(false);

    await act(async () => {
      jotaiStore.set(currentDbTypeAtom, "lch_master");
    });

    await vi.waitFor(() => {
      expect(initialSignal!.aborted).toBe(true);
    });
    expect(mocks.logError).not.toHaveBeenCalled();
  });

  test("mounted lch_master: unmount during lexing aborts active lexPgn signal without diagnostic", async () => {
    sessionStorage.setItem(
      "workspace",
      JSON.stringify({ version: 1, tabs: [validTab], activeTab: tabId }),
    );
    const jotaiStore = createJotaiStore();
    jotaiStore.set(tabsAtom, [validTab]);
    jotaiStore.set(activeTabAtom, tabId);
    jotaiStore.set(currentDbTypeAtom, "lch_master");
    jotaiStore.set(currentDbTabAtom, "moves");
    jotaiStore.set(sessionsAtom, [validSession]);

    mocks.getMasterGames.mockResolvedValue(mockExplorerData);
    mocks.getPublicLichessJson.mockResolvedValue(`[White "W"]\n[Black "B"]\n\n1. e4 e5 *`);

    let observedSignal: AbortSignal | undefined;

    mocks.lexPgn.mockImplementation(async (_pgn: string, options?: { signal?: AbortSignal }) => {
      observedSignal = options?.signal;
      return new Promise((_, reject) => {
        if (options?.signal?.aborted) {
          reject(cancellationError());
          return;
        }
        options?.signal?.addEventListener("abort", () => {
          reject(cancellationError());
        });
      });
    });

    await act(async () => {
      root.render(
        <MantineProvider>
          <JotaiProvider store={jotaiStore}>
            <TreeStateContext.Provider value={treeStore}>
              <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
                <DatabasePanel />
              </SWRConfig>
            </TreeStateContext.Provider>
          </JotaiProvider>
        </MantineProvider>,
      );
    });

    await vi.waitFor(() => {
      expect(mocks.lexPgn).toHaveBeenCalled();
    });
    expect(observedSignal).toBeDefined();
    expect(observedSignal!.aborted).toBe(false);

    await act(async () => {
      root.unmount();
    });

    expect(observedSignal!.aborted).toBe(true);
    expect(mocks.logError).not.toHaveBeenCalled();
  });
});
