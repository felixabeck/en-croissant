import { WorkspaceTabScope } from "@/state/tabScope";
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { cancellationError } from "@/platform/tauri";
import { MantineProvider } from "@mantine/core";
import { Provider as JotaiProvider, createStore as createJotaiStore } from "jotai";
import { SWRConfig, useSWRConfig, type ScopedMutator, type SWRConfiguration } from "swr";
import { TreeStateContext } from "@/components/common/TreeStateContext";
import { createTreeStore, type TreeStore } from "@/state/store/tree";
import {
  dbTypeFamily,
  dbTabFamily,
  sessionsAtom,
  tabsAtom,
  activeTabAtom,
  localOptionsFamily,
  referenceDbAtom,
} from "@/state/atoms";
import type { DatabaseHandle } from "@/bindings";
import { type DatabaseList, type ManagedDatabaseInfo } from "@/utils/db";
import { DATABASE_LIST_KEY } from "@/hooks/useDatabaseList";
import { installMatchMediaStub } from "@/tests/matchMedia";

const mocks = vi.hoisted(() => ({
  logError: vi.fn(),
  getLichessGames: vi.fn(),
  getMasterGames: vi.fn(),
  getPublicLichessJson: vi.fn(),
  lexPgn: vi.fn(),
  getDatabases: vi.fn(),
  searchPosition: vi.fn(),
  collectionForDatabase: vi.fn(),
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

vi.mock("@/utils/db", async () => {
  const actual = await vi.importActual<typeof import("@/utils/db")>("@/utils/db");
  return { ...actual, getDatabases: mocks.getDatabases };
});

vi.mock("@/platform/tauri", async () => {
  const actual = await vi.importActual<typeof import("@/platform/tauri")>("@/platform/tauri");
  return {
    ...actual,
    tauri: {
      ...actual.tauri,
      getPublicLichessJson: mocks.getPublicLichessJson,
      lexPgn: mocks.lexPgn,
      searchPosition: mocks.searchPosition,
      collectionForDatabase: mocks.collectionForDatabase,
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

// DataTable checks an empty media query for columns without a visibility restriction.
installMatchMediaStub({ matches: (query) => query === "" });

describe("DatabasePanel", () => {
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
    mocks.getDatabases.mockReset();
    mocks.searchPosition.mockReset().mockResolvedValue([[], []]);
    mocks.collectionForDatabase.mockReset().mockResolvedValue(null);
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

  const reference: DatabaseHandle = { id: { id: "saved-reference" }, kind: "database" };
  const stalePath: DatabaseHandle = { id: { id: "old-tab-reference" }, kind: "database" };
  const readable: ManagedDatabaseInfo = {
    type: "success",
    file: reference,
    title: "Saved reference",
    filename: "reference.db3",
    description: "",
    indexed: false,
    player_count: 2,
    event_count: 1,
    game_count: 1,
    storage_size: "4096",
  };
  const unreadable: ManagedDatabaseInfo = {
    type: "error",
    file: reference,
    filename: "reference.db3",
    indexed: false,
    error: "Database is unreadable",
  };
  const databaseList = (databases: ManagedDatabaseInfo[]): DatabaseList => ({
    databases,
    unread: [],
    root: { id: { id: "database-root" }, kind: "databaseRoot" },
  });

  function deferred<T>() {
    let resolve!: (value: T) => void;
    let reject!: (reason: unknown) => void;
    const promise = new Promise<T>((resolvePromise, rejectPromise) => {
      resolve = resolvePromise;
      reject = rejectPromise;
    });
    return { promise, resolve, reject };
  }

  async function renderPanel(
    store: ReturnType<typeof createJotaiStore>,
    swrConfig: SWRConfiguration,
    children?: ReactNode,
  ) {
    await act(async () => {
      root.render(
        <MantineProvider>
          <JotaiProvider store={store}>
            <TreeStateContext.Provider value={treeStore}>
              <WorkspaceTabScope tabId={tabId}>
                <SWRConfig value={swrConfig}>
                  {children}
                  <DatabasePanel />
                </SWRConfig>
              </WorkspaceTabScope>
            </TreeStateContext.Provider>
          </JotaiProvider>
        </MantineProvider>,
      );
    });
  }

  async function mountLocal() {
    const store = createJotaiStore();
    store.set(tabsAtom, [validTab]);
    store.set(activeTabAtom, tabId);
    store.set(dbTypeFamily(tabId), "local");
    store.set(dbTabFamily(tabId), "stats");
    // Hydrate the real persisted atom and seed an unrelated old per-tab search path.
    localStorage.setItem("reference-database", JSON.stringify(reference));
    store.set(localOptionsFamily(tabId), {
      ...store.get(localOptionsFamily(tabId)),
      path: stalePath,
      fen: treeStore.getState().currentNode().fen,
      result: "draw",
      elo: [1800, 2400],
      exclude_fast_events: true,
    });
    let mutate!: ScopedMutator;
    function CacheControl() {
      mutate = useSWRConfig().mutate;
      return null;
    }
    await renderPanel(
      store,
      {
        provider: () => new Map(),
        dedupingInterval: 0,
        shouldRetryOnError: false,
        revalidateOnFocus: false,
        revalidateOnReconnect: false,
      },
      <CacheControl />,
    );
    return {
      store,
      revalidate: async () => {
        await act(async () => {
          await mutate(DATABASE_LIST_KEY);
        });
      },
    };
  }

  function expectSavedChoice(store: ReturnType<typeof createJotaiStore>) {
    expect(store.get(referenceDbAtom)).toEqual(reference);
    expect(JSON.parse(localStorage.getItem("reference-database")!)).toEqual(reference);
  }

  function expectNoReference(value: "stats" | "games" | "options" = "stats") {
    const labels = { stats: "Stats", games: "Games", options: "Options" };
    const tab = Array.from(container.querySelectorAll('[role="tab"]')).find(
      (element) => element.textContent === `Board.Database.${labels[value]}`,
    );
    expect(tab).toBeDefined();
    expect(tab!.getAttribute("aria-selected")).toBe("true");
    const panelId = tab!.getAttribute("aria-controls");
    expect(panelId).toBeTruthy();
    const panel = document.getElementById(panelId!);
    expect(container.contains(panel)).toBe(true);
    expect(panel!.getAttribute("role")).toBe("tabpanel");
    expect(panel!.getAttribute("aria-labelledby")).toBe(tab!.id);
    expect({ [value]: panel!.textContent }).toEqual({
      [value]: expect.stringContaining("Board.Database.NoReference1"),
    });
    expect({
      [value]: panel!.querySelector<HTMLInputElement>(".mantine-Select-input")?.value,
    }).toEqual({ [value]: "" });
  }

  test("local: readable persisted handle searches with preserved filters and overrides stale tab path", async () => {
    mocks.getDatabases.mockResolvedValue(databaseList([readable]));
    const { store } = await mountLocal();

    expect(mocks.searchPosition).toHaveBeenCalled();
    for (const call of mocks.searchPosition.mock.calls) {
      expect(call).toEqual([
        reference,
        expect.objectContaining({
          wanted_result: "draw",
          range1: [1800, 2400],
          range2: [1800, 2400],
          exclude_fast_events: true,
        }),
        tabId,
        { signal: expect.any(AbortSignal) },
      ]);
    }
    expect(container.querySelector<HTMLInputElement>(".mantine-Select-input")?.value).toBe(
      "Saved reference",
    );
    expect(container.textContent).not.toContain("Board.Database.NoReference1");
    expect(store.get(localOptionsFamily(tabId)).path).toEqual(reference);
    expectSavedChoice(store);
  });

  test.each([
    ["absent", []],
    ["unreadable", [unreadable]],
  ] as const)(
    "local: %s persisted handle never searches a stale tab path",
    async (_name, entries) => {
      mocks.getDatabases.mockResolvedValue(databaseList([...entries]));
      const { store } = await mountLocal();

      expect(mocks.searchPosition).not.toHaveBeenCalled();
      expect(store.get(localOptionsFamily(tabId)).path).toBeNull();
      expectSavedChoice(store);
      for (const value of ["stats", "games", "options"] as const) {
        await act(async () => {
          store.set(dbTabFamily(tabId), value);
        });
        expectNoReference(value);
      }
    },
  );

  test("local: pending list and transient failure preserve the saved choice until successful recovery", async () => {
    const pending = deferred<DatabaseList>();
    mocks.getDatabases.mockReturnValueOnce(pending.promise);
    const { store, revalidate } = await mountLocal();
    expectNoReference();
    expectSavedChoice(store);
    expect(mocks.searchPosition).not.toHaveBeenCalled();

    await act(async () => {
      pending.reject(new Error("Temporary list failure"));
    });
    expectNoReference();
    expectSavedChoice(store);
    expect(mocks.searchPosition).not.toHaveBeenCalled();

    mocks.getDatabases.mockResolvedValue(databaseList([readable]));
    await revalidate();
    expect(mocks.searchPosition).toHaveBeenCalled();
    expect(container.querySelector<HTMLInputElement>(".mantine-Select-input")?.value).toBe(
      "Saved reference",
    );
    expectSavedChoice(store);
  });

  test.each(["absent", "unreadable", "list failure"] as const)(
    "local: becoming %s cancels the pending owner and hides a late result",
    async (unavailable) => {
      const pending = deferred<[import("@/utils/db").Opening[], []]>();
      let signal!: AbortSignal;
      mocks.searchPosition.mockImplementation((_path, _query, _tab, options) => {
        signal = options.signal;
        // Model the native facade's abort guard even when the IPC reply arrives late.
        return pending.promise.then((result) => {
          if (options.signal.aborted) throw cancellationError();
          return result;
        });
      });
      mocks.getDatabases.mockResolvedValue(databaseList([readable]));
      const { store, revalidate } = await mountLocal();
      expect(mocks.searchPosition).toHaveBeenCalledOnce();
      expect(signal.aborted).toBe(false);

      if (unavailable === "list failure")
        mocks.getDatabases.mockRejectedValue(new Error("Temporary list failure"));
      else
        mocks.getDatabases.mockResolvedValue(
          databaseList(unavailable === "absent" ? [] : [unreadable]),
        );
      await revalidate();
      expect(signal.aborted).toBe(true);
      expectNoReference();
      expectSavedChoice(store);
      expect(mocks.searchPosition).toHaveBeenCalledOnce();

      await act(async () => {
        pending.resolve([[{ move: "STALE", white: 999, black: 0, draw: 0 }], []]);
      });
      expectNoReference();
      expect(container.textContent).not.toContain("STALE");
      expect(container.textContent).not.toContain("999");

      mocks.searchPosition.mockResolvedValue([[{ move: "e4", white: 1, black: 0, draw: 0 }], []]);
      mocks.getDatabases.mockResolvedValue(databaseList([readable]));
      await revalidate();
      expect(mocks.searchPosition).toHaveBeenCalledTimes(2);
      await vi.waitFor(() => {
        expect(container.textContent).toContain("e4");
      });
      expect(container.textContent).not.toContain("STALE");
      expectSavedChoice(store);
    },
  );

  test("local: admitted search failures retain their native error presentation", async () => {
    mocks.getDatabases.mockResolvedValue(databaseList([readable]));
    mocks.searchPosition.mockRejectedValue(new Error("Native position search failed"));
    await mountLocal();
    expect(container.textContent).toContain("Native position search failed");
    expect(container.textContent).not.toContain("Board.Database.NoReference1");
  });

  test("local: collection-unavailable presentation yields to the missing effective reference warning", async () => {
    mocks.getDatabases.mockResolvedValue(databaseList([readable]));
    mocks.collectionForDatabase.mockRejectedValue(new Error("Collection unavailable"));
    const { store, revalidate } = await mountLocal();
    expect(container.textContent).toContain("Collections.Unavailable");
    expect(container.textContent).not.toContain("Board.Database.NoReference1");

    mocks.getDatabases.mockResolvedValue(databaseList([unreadable]));
    await revalidate();
    expectNoReference();
    expect(container.textContent).not.toContain("Collections.Unavailable");
    expectSavedChoice(store);
  });

  test("mounted lch_all: unmount during lexing aborts active lexPgn signal without diagnostic", async () => {
    sessionStorage.setItem(
      "workspace",
      JSON.stringify({ version: 1, tabs: [validTab], activeTab: tabId }),
    );
    const jotaiStore = createJotaiStore();
    jotaiStore.set(tabsAtom, [validTab]);
    jotaiStore.set(activeTabAtom, tabId);
    jotaiStore.set(dbTypeFamily(tabId), "lch_all");
    jotaiStore.set(dbTabFamily(tabId), "moves");
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

    await renderPanel(jotaiStore, { provider: () => new Map(), dedupingInterval: 0 });

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
    jotaiStore.set(dbTypeFamily(tabId), "lch_all");
    jotaiStore.set(dbTabFamily(tabId), "moves");
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

    await renderPanel(jotaiStore, { provider: () => new Map(), dedupingInterval: 0 });

    await vi.waitFor(() => {
      expect(mocks.lexPgn).toHaveBeenCalled();
    });
    expect(initialSignal).toBeDefined();
    expect(initialSignal!.aborted).toBe(false);

    await act(async () => {
      jotaiStore.set(dbTypeFamily(tabId), "lch_master");
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
    jotaiStore.set(dbTypeFamily(tabId), "lch_master");
    jotaiStore.set(dbTabFamily(tabId), "moves");
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

    await renderPanel(jotaiStore, { provider: () => new Map(), dedupingInterval: 0 });

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
