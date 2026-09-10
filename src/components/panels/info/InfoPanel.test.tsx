import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { Provider as JotaiProvider, createStore as createJotaiStore } from "jotai";
import { MantineProvider } from "@mantine/core";
import { TreeStateContext } from "@/components/common/TreeStateContext";
import { closeTreeStore, createTreeStore, type TreeStore } from "@/state/store/tree";
import { activeTabAtom, currentTabAtom, tabsAtom } from "@/state/atoms";
import { cancellationError } from "@/platform/tauri";
import type { Tab } from "@/state/workspaceTypes";
import { defaultTree } from "@/utils/treeReducer";
import InfoPanel from "./InfoPanel";

const mocks = vi.hoisted(() => ({
  deleteGame: vi.fn(),
  deleteRejected: vi.fn(),
  readGames: vi.fn(),
  parsePGN: vi.fn(),
  notify: vi.fn(),
  logError: vi.fn(),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => vi.fn(),
}));

vi.mock("@mantine/notifications", () => ({
  notifications: { show: mocks.notify },
}));

vi.mock("@/platform/native", () => ({
  platform: () => "linux",
  error: mocks.logError,
  warn: vi.fn(),
  info: vi.fn(),
  debug: vi.fn(),
  trace: vi.fn(),
}));

vi.mock("@/platform/tauri", async () => {
  const actual = await vi.importActual<typeof import("@/platform/tauri")>("@/platform/tauri");
  return {
    ...actual,
    tauri: {
      ...actual.tauri,
      deleteGame: mocks.deleteGame,
      readGames: mocks.readGames,
    },
  };
});

vi.mock("@/utils/chess", async () => {
  const actual = await vi.importActual<typeof import("@/utils/chess")>("@/utils/chess");
  return {
    ...actual,
    parsePGN: mocks.parsePGN,
  };
});

vi.mock("./GameSelector", () => ({
  default: ({
    games,
    setGames,
    setPage,
    deleteGame,
  }: {
    games: Map<number, string>;
    setGames: (games: Map<number, string>) => void;
    setPage: (page: number) => Promise<void>;
    deleteGame: (index: number) => Promise<void>;
  }) => (
    <>
      <span data-testid="game-cache-size">{games.size}</span>
      <button type="button" data-testid="set-page" onClick={() => void setPage(1)}>
        Set Page
      </button>
      <button
        type="button"
        data-testid="prime-games"
        onClick={() => setGames(new Map([[0, "Cached"]]))}
      >
        Prime games
      </button>
      <button
        type="button"
        data-testid="delete-game"
        onClick={() => void deleteGame(1).catch(mocks.deleteRejected)}
      >
        Delete game
      </button>
    </>
  ),
}));

vi.mock("./FileInfo", () => ({
  default: () => <div data-testid="file-info" />,
}));

vi.mock("./FenSearch", () => ({
  default: () => <div data-testid="fen-search" />,
}));

vi.mock("./PgnInput", () => ({
  default: () => <div data-testid="pgn-input" />,
}));

vi.mock("@/components/common/GameInfo", () => ({
  default: () => <div data-testid="game-info" />,
}));

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

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

class MockResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver = MockResizeObserver;

describe("InfoPanel game loading and cancellation", () => {
  let container: HTMLDivElement;
  let root: Root;
  let treeStore: TreeStore;
  let jotaiStore: ReturnType<typeof createJotaiStore>;

  const tabAId = "11111111-1111-4111-8111-111111111111";
  const tabA: Tab = {
    name: "Tab A",
    value: tabAId,
    type: "analysis",
    gameOrigin: {
      kind: "file",
      gameNumber: 0,
      file: {
        type: "file",
        handle: { id: { id: "workspace-token-a" }, kind: "fileWorkspace" },
        name: "games_a.pgn",
        numGames: 5,
        metadata: { type: "game", tags: [] },
        lastModified: 1,
      },
    },
  };

  const tabBId = "22222222-2222-4222-8222-222222222222";
  const tabB: Tab = {
    name: "Tab B",
    value: tabBId,
    type: "analysis",
    gameOrigin: {
      kind: "file",
      gameNumber: 0,
      file: {
        type: "file",
        handle: { id: { id: "workspace-token-b" }, kind: "fileWorkspace" },
        name: "games_b.pgn",
        numGames: 5,
        metadata: { type: "game", tags: [] },
        lastModified: 1,
      },
    },
  };

  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    sessionStorage.setItem(
      "workspace",
      JSON.stringify({ version: 1, tabs: [tabA, tabB], activeTab: tabAId }),
    );

    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    treeStore = createTreeStore(tabAId);
    jotaiStore = createJotaiStore();
    jotaiStore.set(tabsAtom, [tabA, tabB]);
    jotaiStore.set(activeTabAtom, tabAId);

    mocks.readGames.mockReset();
    mocks.deleteGame.mockReset();
    mocks.deleteRejected.mockReset();
    mocks.parsePGN.mockReset();
    mocks.notify.mockReset();
    mocks.logError.mockReset().mockResolvedValue(undefined);
  });

  afterEach(async () => {
    await act(async () => {
      root?.unmount();
    });
    container?.remove();
    closeTreeStore(tabAId);
    closeTreeStore(tabBId);
    vi.restoreAllMocks();
  });

  function refuseWorkspaceWrites() {
    const originalSetItem = Storage.prototype.setItem;
    return vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(function (this: Storage, key, value) {
        if (key === "workspace") throw new DOMException("quota", "QuotaExceededError");
        return originalSetItem.call(this, key, value);
      });
  }

  async function primeAndDelete() {
    await act(async () => {
      container.querySelector<HTMLButtonElement>('[data-testid="prime-games"]')!.click();
    });
    expect(container.querySelector('[data-testid="game-cache-size"]')?.textContent).toBe("1");
    await act(async () => {
      container.querySelector<HTMLButtonElement>('[data-testid="delete-game"]')!.click();
      await Promise.resolve();
    });
  }

  function renderPanel(store: TreeStore = treeStore) {
    return (
      <MantineProvider>
        <JotaiProvider store={jotaiStore}>
          <TreeStateContext.Provider value={store}>
            <InfoPanel />
          </TreeStateContext.Provider>
        </JotaiProvider>
      </MantineProvider>
    );
  }

  test("successful setPage loads game and updates tab and tree state", async () => {
    mocks.readGames.mockResolvedValueOnce(["1. e4 e5 *"]);
    const mockTree = defaultTree();
    mocks.parsePGN.mockResolvedValueOnce(mockTree);

    await act(async () => {
      root.render(renderPanel());
    });

    const setPageBtn = container.querySelector<HTMLButtonElement>('[data-testid="set-page"]')!;
    await act(async () => {
      setPageBtn.click();
    });

    const fileAHandle = tabA.gameOrigin.kind === "file" ? tabA.gameOrigin.file.handle : null;
    expect(mocks.readGames).toHaveBeenCalledWith(
      fileAHandle,
      1,
      1,
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(mocks.parsePGN).toHaveBeenCalledWith(
      "1. e4 e5 *",
      undefined,
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );

    const updatedTab = jotaiStore.get(currentTabAtom);
    expect(updatedTab?.gameOrigin).toMatchObject({ kind: "file", gameNumber: 1 });
    expect(mocks.notify).not.toHaveBeenCalled();
  });

  test("setPage leaves metadata and tree unchanged when the workspace write is refused", async () => {
    const setState = vi.spyOn(treeStore.getState(), "setState");
    const nextTree = defaultTree();
    nextTree.headers.event = "Next tree";
    mocks.readGames.mockResolvedValueOnce(["1. e4 e5 *"]);
    mocks.parsePGN.mockResolvedValueOnce(nextTree);
    refuseWorkspaceWrites();
    await act(async () => root.render(renderPanel()));

    await act(async () => {
      container.querySelector<HTMLButtonElement>('[data-testid="set-page"]')!.click();
    });

    expect(jotaiStore.get(currentTabAtom)?.gameOrigin).toMatchObject({ gameNumber: 0 });
    expect(setState).not.toHaveBeenCalled();
  });

  test("delete refuses native mutation and cache clearing when metadata cannot be saved", async () => {
    mocks.deleteGame.mockResolvedValue(undefined);
    await act(async () => root.render(renderPanel()));
    refuseWorkspaceWrites();

    await primeAndDelete();

    expect(mocks.deleteGame).not.toHaveBeenCalled();
    expect(container.querySelector('[data-testid="game-cache-size"]')?.textContent).toBe("1");
    expect(jotaiStore.get(currentTabAtom)?.gameOrigin).toMatchObject({
      file: { numGames: 5 },
    });
  });

  test("delete restores the captured count and retains cache when native deletion rejects", async () => {
    const failure = new Error("delete failed");
    let rejectDelete!: (error: unknown) => void;
    mocks.deleteGame.mockReturnValueOnce(
      new Promise((_, reject) => {
        rejectDelete = reject;
      }),
    );
    await act(async () => root.render(renderPanel()));

    await primeAndDelete();
    await act(async () => {
      jotaiStore.set(tabsAtom, (tabs) =>
        tabs.map((tab) =>
          tab.value === tabAId && tab.gameOrigin.kind === "file"
            ? { ...tab, name: "Concurrent title", gameOrigin: { ...tab.gameOrigin, gameNumber: 2 } }
            : tab,
        ),
      );
      rejectDelete(failure);
      await Promise.resolve();
    });

    expect(mocks.deleteGame).toHaveBeenCalledOnce();
    expect(jotaiStore.get(currentTabAtom)).toMatchObject({
      name: "Concurrent title",
      gameOrigin: { gameNumber: 2, file: { numGames: 5 } },
    });
    expect(container.querySelector('[data-testid="game-cache-size"]')?.textContent).toBe("1");
    expect(mocks.deleteRejected).toHaveBeenCalledWith(failure);
  });

  test("delete does not resurrect a captured owner closed before native rejection", async () => {
    let rejectDelete!: (error: unknown) => void;
    mocks.deleteGame.mockReturnValueOnce(
      new Promise((_, reject) => {
        rejectDelete = reject;
      }),
    );
    await act(async () => root.render(renderPanel()));
    await primeAndDelete();

    await act(async () => {
      jotaiStore.set(tabsAtom, [tabB], tabBId);
      root.render(renderPanel(createTreeStore(tabBId)));
      rejectDelete(new Error("delete failed"));
      await Promise.resolve();
    });

    expect(jotaiStore.get(tabsAtom)).toEqual([tabB]);
    expect(jotaiStore.get(activeTabAtom)).toBe(tabBId);
    expect(mocks.deleteRejected).toHaveBeenCalledOnce();
  });

  test("successful delete keeps the decremented count and clears its cache", async () => {
    mocks.deleteGame.mockResolvedValueOnce(undefined);
    await act(async () => root.render(renderPanel()));

    await primeAndDelete();

    expect(jotaiStore.get(currentTabAtom)?.gameOrigin).toMatchObject({
      file: { numGames: 4 },
    });
    expect(container.querySelector('[data-testid="game-cache-size"]')?.textContent).toBe("0");
    expect(mocks.deleteRejected).not.toHaveBeenCalled();
  });

  test("successful delete does not clear the cache after the active owner changes", async () => {
    let resolveDelete!: () => void;
    mocks.deleteGame.mockReturnValueOnce(
      new Promise<void>((resolve) => {
        resolveDelete = resolve;
      }),
    );
    await act(async () => root.render(renderPanel()));
    await primeAndDelete();

    const treeStoreB = createTreeStore(tabBId);
    await act(async () => {
      jotaiStore.set(activeTabAtom, tabBId);
      root.render(renderPanel(treeStoreB));
    });
    await act(async () => {
      container.querySelector<HTMLButtonElement>('[data-testid="prime-games"]')!.click();
    });
    await act(async () => {
      resolveDelete();
      await Promise.resolve();
    });

    expect(container.querySelector('[data-testid="game-cache-size"]')?.textContent).toBe("1");
  });

  test("rapid tab replacement while readGames is pending aborts signal and ignores stale resolve", async () => {
    let capturedSignal!: AbortSignal;
    let resolveReadGames!: (data: string[]) => void;

    mocks.readGames.mockImplementation(
      (_handle: unknown, _p1: number, _p2: number, options?: { signal?: AbortSignal }) => {
        if (options?.signal) capturedSignal = options.signal;
        return new Promise((resolve) => {
          resolveReadGames = resolve;
        });
      },
    );

    await act(async () => {
      root.render(renderPanel());
    });

    const setPageBtn = container.querySelector<HTMLButtonElement>('[data-testid="set-page"]')!;
    act(() => {
      setPageBtn.click();
    });

    expect(capturedSignal).toBeDefined();
    expect(capturedSignal.aborted).toBe(false);

    // Switch active tab to tab B
    const treeStoreB = createTreeStore(tabBId);
    await act(async () => {
      sessionStorage.setItem(
        "workspace",
        JSON.stringify({ version: 1, tabs: [tabA, tabB], activeTab: tabBId }),
      );
      jotaiStore.set(activeTabAtom, tabBId);
      root.render(renderPanel(treeStoreB));
    });

    // The effect cleanup on [tabId, fileKey, store] must have aborted the in-flight read
    expect(capturedSignal.aborted).toBe(true);

    // Resolve the stale readGames
    await act(async () => {
      resolveReadGames(["1. d4 d5 *"]);
    });

    // parsePGN should not be invoked for obsolete generation, and tab A gameNumber should remain 0
    expect(mocks.parsePGN).not.toHaveBeenCalled();
    const tabAState = jotaiStore.get(tabsAtom).find((t) => t.value === tabAId);
    expect(tabAState?.gameOrigin.kind === "file" && tabAState.gameOrigin.gameNumber).toBe(0);
    expect(mocks.notify).not.toHaveBeenCalled();
  });

  test("shared peer survival: tab B page load succeeds independently after tab A was replaced", async () => {
    let signalA!: AbortSignal;
    mocks.readGames.mockImplementationOnce(
      (_handle: unknown, _p1: number, _p2: number, options?: { signal?: AbortSignal }) => {
        if (options?.signal) signalA = options.signal;
        return new Promise(() => {}); // never resolves
      },
    );

    await act(async () => {
      root.render(renderPanel());
    });

    const setPageBtn = container.querySelector<HTMLButtonElement>('[data-testid="set-page"]')!;
    act(() => {
      setPageBtn.click();
    });

    expect(signalA.aborted).toBe(false);

    // Switch to tab B
    const treeStoreB = createTreeStore(tabBId);
    await act(async () => {
      sessionStorage.setItem(
        "workspace",
        JSON.stringify({ version: 1, tabs: [tabA, tabB], activeTab: tabBId }),
      );
      jotaiStore.set(activeTabAtom, tabBId);
      root.render(renderPanel(treeStoreB));
    });

    expect(signalA.aborted).toBe(true);

    // Tab B now calls setPage
    let signalB!: AbortSignal;
    const mockTreeB = defaultTree();
    mocks.readGames.mockImplementationOnce(
      (_handle: unknown, _p1: number, _p2: number, options?: { signal?: AbortSignal }) => {
        if (options?.signal) signalB = options.signal;
        return Promise.resolve(["1. c4 e5 *"]);
      },
    );
    mocks.parsePGN.mockResolvedValueOnce(mockTreeB);

    const setPageBtnB = container.querySelector<HTMLButtonElement>('[data-testid="set-page"]')!;
    await act(async () => {
      setPageBtnB.click();
    });

    expect(signalB).toBeDefined();
    expect(signalB.aborted).toBe(false);
    const fileBHandle = tabB.gameOrigin.kind === "file" ? tabB.gameOrigin.file.handle : null;
    expect(mocks.readGames).toHaveBeenCalledWith(
      fileBHandle,
      1,
      1,
      expect.objectContaining({ signal: signalB }),
    );
    expect(mocks.parsePGN).toHaveBeenCalledWith(
      "1. c4 e5 *",
      undefined,
      expect.objectContaining({ signal: signalB }),
    );

    const activeTab = jotaiStore.get(currentTabAtom);
    expect(activeTab?.value).toBe(tabBId);
    expect(activeTab?.gameOrigin.kind === "file" && activeTab.gameOrigin.gameNumber).toBe(1);
    expect(mocks.notify).not.toHaveBeenCalled();
  });

  test("unmount during pending readGames aborts signal and stays silent", async () => {
    let capturedSignal!: AbortSignal;

    mocks.readGames.mockImplementation(
      (_handle: unknown, _p1: number, _p2: number, options?: { signal?: AbortSignal }) => {
        if (options?.signal) capturedSignal = options.signal;
        return new Promise((_, reject) => {
          options?.signal?.addEventListener("abort", () => {
            reject(cancellationError());
          });
        });
      },
    );

    await act(async () => {
      root.render(renderPanel());
    });

    const setPageBtn = container.querySelector<HTMLButtonElement>('[data-testid="set-page"]')!;
    act(() => {
      setPageBtn.click();
    });

    expect(capturedSignal).toBeDefined();
    expect(capturedSignal.aborted).toBe(false);

    await act(async () => {
      root.unmount();
    });

    expect(capturedSignal.aborted).toBe(true);
    expect(mocks.notify).not.toHaveBeenCalled();
    expect(mocks.logError).not.toHaveBeenCalled();
  });
});
