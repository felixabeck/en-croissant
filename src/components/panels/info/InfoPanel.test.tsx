import { getFileFreshness } from "@/state/fileFreshness";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { Provider as JotaiProvider, createStore as createJotaiStore } from "jotai";
import { MantineProvider } from "@mantine/core";
import { TreeStateContext } from "@/components/common/TreeStateContext";
import { closeTreeStore, createTreeStore, type TreeStore } from "@/state/store/tree";
import { activeTabAtom, currentTabAtom, tabsAtom } from "@/state/atoms";
import { cancellationError, TauriCommandError } from "@/platform/tauri";
import type { Tab } from "@/state/workspaceTypes";
import { defaultTree } from "@/utils/treeReducer";
import InfoPanel from "./InfoPanel";

const mocks = vi.hoisted(() => ({
  deleteGame: vi.fn(),
  deleteRejected: vi.fn(),
  loadFileGame: vi.fn(),
  readGames: vi.fn(),
  countPgnGames: vi.fn(),
  parsePGN: vi.fn(),
  notify: vi.fn(),
  logError: vi.fn(),
  beforeDelete: vi.fn(),
  useActualGameSelector: false,
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
      countPgnGames: mocks.countPgnGames,
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
vi.mock("@/utils/files", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/utils/files")>()),
  loadFileGame: mocks.loadFileGame,
}));

vi.mock("./GameSelector", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./GameSelector")>();
  return {
    ...actual,
    default: ({
      games,
      setGames,
      setPage,
      deleteGame,
      ...actualProps
    }: {
      games: Map<number, { name: string; identity?: { stamp: string; revision: string } }>;
      setGames: React.Dispatch<
        React.SetStateAction<
          Map<number, { name: string; identity?: { stamp: string; revision: string } }>
        >
      >;
      setPage: (page: number) => Promise<void>;
      deleteGame: (snapshot: { index: number; stamp: string; revision: string }) => Promise<void>;
      path: { id: { id: string }; kind: "fileWorkspace" };
      activePage: number;
      total: number;
    }) => {
      if (mocks.useActualGameSelector) {
        return (
          <actual.default
            games={games}
            setGames={setGames}
            setPage={setPage}
            deleteGame={deleteGame}
            {...actualProps}
          />
        );
      }
      return (
        <>
          <span data-testid="game-cache-size">{games.size}</span>
          <button type="button" data-testid="set-page" onClick={() => void setPage(1)}>
            Set Page
          </button>
          <button
            type="button"
            data-testid="prime-games"
            onClick={() =>
              setGames(
                new Map([
                  [
                    1,
                    {
                      name: "Cached",
                      identity: { stamp: "selected-stamp", revision: "selected-revision" },
                    },
                  ],
                ]),
              )
            }
          >
            Prime games
          </button>
          <button
            type="button"
            data-testid="delete-game"
            onClick={() => {
              mocks.beforeDelete();
              void deleteGame({
                index: 1,
                stamp: "selected-stamp",
                revision: "selected-revision",
              }).catch(mocks.deleteRejected);
            }}
          >
            Delete game
          </button>
        </>
      );
    },
  };
});

vi.mock("@tanstack/react-virtual", () => ({
  useVirtualizer: ({ count }: { count: number }) => ({
    getTotalSize: () => count * 30,
    getVirtualItems: () => (count > 0 ? [{ index: 0, size: 30, start: 0 }] : []),
  }),
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
    treeStore = createTreeStore(undefined, defaultTree());
    jotaiStore = createJotaiStore();
    jotaiStore.set(tabsAtom, [tabA, tabB]);
    jotaiStore.set(activeTabAtom, tabAId);

    mocks.readGames.mockReset();
    mocks.readGames.mockResolvedValue([]);
    mocks.countPgnGames.mockReset().mockResolvedValue(5);
    mocks.loadFileGame.mockReset();
    mocks.loadFileGame.mockImplementation(async () => {
      const tree = defaultTree();
      tree.sourceStamp = "b".repeat(64);
      return { pgn: "fresh", stamp: tree.sourceStamp, revision: "r1", present: true, tree };
    });
    mocks.deleteGame.mockReset();
    mocks.deleteRejected.mockReset();
    mocks.parsePGN.mockReset();
    mocks.notify.mockReset();
    mocks.logError.mockReset().mockResolvedValue(undefined);
    mocks.beforeDelete.mockReset();
    mocks.useActualGameSelector = false;
  });

  afterEach(async () => {
    await act(async () => {
      root?.unmount();
    });
    container?.remove();
    closeTreeStore(tabAId);
    closeTreeStore(tabBId);
    mocks.useActualGameSelector = false;
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

  function refuseSecondWorkspaceWrite() {
    let workspaceWrites = 0;
    const originalSetItem = Storage.prototype.setItem;
    return vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(function (this: Storage, key, value) {
        if (key === "workspace" && ++workspaceWrites === 2) {
          throw new DOMException("quota", "QuotaExceededError");
        }
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

  async function openActualDeleteModal() {
    mocks.useActualGameSelector = true;
    mocks.readGames.mockResolvedValue([
      {
        pgn: '[Event "Selected game"]\n\n1. e4 *',
        stamp: "selected-stamp",
        revision: "selected-revision",
        present: true,
      },
    ]);
    mocks.parsePGN.mockResolvedValue({ headers: { event: "Selected game" } });
    await act(async () => root.render(renderPanel()));
    await vi.waitFor(() =>
      expect(container.querySelector('[aria-label="Files.RemoveGame"]')).not.toBeNull(),
    );
    await act(async () => {
      container.querySelector<HTMLButtonElement>('[aria-label="Files.RemoveGame"]')!.click();
    });
    await vi.waitFor(() => expect(document.body.querySelector('[role="dialog"]')).not.toBeNull());
  }

  function actualDeleteConfirmButton() {
    return [...document.body.querySelectorAll("button")].find(
      (button) => button.textContent?.trim() === "Common.Delete",
    ) as HTMLButtonElement;
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
    const mockTree = defaultTree();
    mockTree.sourceStamp = "b".repeat(64);
    mocks.loadFileGame.mockResolvedValueOnce({
      pgn: "1. e4 e5 *",
      stamp: mockTree.sourceStamp,
      revision: "r2",
      present: true,
      tree: mockTree,
    });

    await act(async () => {
      root.render(renderPanel());
    });

    const setPageBtn = container.querySelector<HTMLButtonElement>('[data-testid="set-page"]')!;
    await act(async () => {
      setPageBtn.click();
    });

    const fileAHandle = tabA.gameOrigin.kind === "file" ? tabA.gameOrigin.file.handle : null;
    expect(mocks.loadFileGame).toHaveBeenCalledWith(fileAHandle, 1, expect.any(AbortSignal));

    const updatedTab = jotaiStore.get(currentTabAtom);
    expect(updatedTab?.gameOrigin).toMatchObject({ kind: "file", gameNumber: 1 });
    expect(mocks.notify).not.toHaveBeenCalled();
    // The page was just read, so the tab starts verified at that revision without a second read.
    expect(getFileFreshness(tabA.value)).toMatchObject({
      state: "verified",
      verifiedRevision: "r2",
    });
  });

  test("setPage leaves metadata and tree unchanged when the workspace write is refused", async () => {
    const setState = vi.spyOn(treeStore.getState(), "setState");
    const nextTree = defaultTree();
    nextTree.headers.event = "Next tree";
    nextTree.sourceStamp = "b".repeat(64);
    mocks.loadFileGame.mockResolvedValueOnce({
      pgn: "1. e4 e5 *",
      stamp: nextTree.sourceStamp,
      revision: "r2",
      present: true,
      tree: nextTree,
    });
    refuseWorkspaceWrites();
    await act(async () => root.render(renderPanel()));

    await act(async () => {
      container.querySelector<HTMLButtonElement>('[data-testid="set-page"]')!.click();
    });

    expect(jotaiStore.get(currentTabAtom)?.gameOrigin).toMatchObject({ gameNumber: 0 });
    expect(setState).not.toHaveBeenCalled();
  });

  test("setPage does not replace an edit made while the fresh file read is pending", async () => {
    let resolveLoad!: (value: {
      pgn: string;
      stamp: string;
      revision: string;
      present: boolean;
      tree: ReturnType<typeof defaultTree>;
    }) => void;
    mocks.loadFileGame.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveLoad = resolve;
      }),
    );
    await act(async () => root.render(renderPanel()));

    await act(async () => {
      container.querySelector<HTMLButtonElement>('[data-testid="set-page"]')!.click();
    });
    await act(async () => {
      treeStore.getState().setComment("Edit made during file read");
    });
    const loadedTree = defaultTree();
    loadedTree.headers.event = "Disk version";
    const loadedStamp = "d".repeat(64);
    loadedTree.sourceStamp = loadedStamp;
    await act(async () => {
      resolveLoad({
        pgn: "fresh disk game",
        stamp: loadedStamp,
        revision: "r5",
        present: true,
        tree: loadedTree,
      });
    });

    expect(jotaiStore.get(currentTabAtom)?.gameOrigin).toMatchObject({ gameNumber: 0 });
    expect(treeStore.getState()).toMatchObject({ dirty: true, sourceStamp: null });
    expect(treeStore.getState().root.comment).toBe("Edit made during file read");
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

  test("a local count mismatch clears cached rows and refreshes without invoking native delete", async () => {
    mocks.countPgnGames.mockResolvedValueOnce(7);
    mocks.beforeDelete.mockImplementation(() => {
      jotaiStore.set(tabsAtom, (tabs) =>
        tabs.map((tab) =>
          tab.value === tabAId && tab.gameOrigin.kind === "file"
            ? {
                ...tab,
                gameOrigin: {
                  ...tab.gameOrigin,
                  file: { ...tab.gameOrigin.file, numGames: 6 },
                },
              }
            : tab,
        ),
      );
    });
    await act(async () => root.render(renderPanel()));

    await primeAndDelete();
    await vi.waitFor(() =>
      expect(jotaiStore.get(currentTabAtom)?.gameOrigin).toMatchObject({
        file: { numGames: 7 },
      }),
    );

    const handle = tabA.gameOrigin.kind === "file" ? tabA.gameOrigin.file.handle : null;
    expect(mocks.deleteGame).not.toHaveBeenCalled();
    expect(mocks.countPgnGames).toHaveBeenCalledWith(handle, { signal: expect.any(AbortSignal) });
    expect(container.querySelector('[data-testid="game-cache-size"]')?.textContent).toBe("0");
    expect(mocks.notify).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Common.Error", message: "Files.RemoveGameStale" }),
    );
    expect(mocks.deleteRejected).not.toHaveBeenCalled();
  });

  test("a workspace write refusal stays visible in the real delete confirmation modal", async () => {
    await openActualDeleteModal();
    refuseWorkspaceWrites();

    await act(async () => actualDeleteConfirmButton().click());

    expect(mocks.deleteGame).not.toHaveBeenCalled();
    expect(document.body.querySelector('[role="dialog"]')).not.toBeNull();
    expect(document.body.querySelector('[role="alert"]')?.textContent).toBe(
      "Common.ConfirmationError.unexpected",
    );
    expect(jotaiStore.get(currentTabAtom)?.gameOrigin).toMatchObject({ file: { numGames: 5 } });
  });

  test("a post-delete workspace write refusal reports an applied outcome in the real modal", async () => {
    mocks.deleteGame.mockResolvedValueOnce(undefined);
    await openActualDeleteModal();
    const storageWrites = refuseSecondWorkspaceWrite();
    const readsBeforeDelete = mocks.readGames.mock.calls.length;

    await act(async () => actualDeleteConfirmButton().click());
    await vi.waitFor(() =>
      expect(document.body.querySelector('[role="alert"]')?.textContent).toBe(
        "Common.ConfirmationError.applied-despite-error",
      ),
    );
    await vi.waitFor(() =>
      expect(mocks.readGames.mock.calls.length).toBeGreaterThan(readsBeforeDelete),
    );

    expect(mocks.deleteGame).toHaveBeenCalledOnce();
    expect(storageWrites.mock.calls.filter(([key]) => key === "workspace")).toHaveLength(2);
    expect(document.body.querySelector('[role="dialog"]')).not.toBeNull();
    expect(document.body.querySelector('[role="alert"]')?.textContent).not.toMatch(/try again/i);
    expect(jotaiStore.get(currentTabAtom)?.gameOrigin).toMatchObject({ file: { numGames: 4 } });
  });

  test("the real confirmation modal handles InfoPanel's native stale refusal", async () => {
    const stale = new TauriCommandError({
      tag: "backend-error",
      category: "stale-game",
      message: "stale game",
    });
    mocks.deleteGame.mockRejectedValueOnce(stale);
    mocks.countPgnGames.mockResolvedValueOnce(6);
    await openActualDeleteModal();

    await act(async () => actualDeleteConfirmButton().click());
    await vi.waitFor(() => expect(document.body.querySelector('[role="dialog"]')).toBeNull());
    await vi.waitFor(() =>
      expect(jotaiStore.get(currentTabAtom)?.gameOrigin).toMatchObject({ file: { numGames: 6 } }),
    );

    const handle = tabA.gameOrigin.kind === "file" ? tabA.gameOrigin.file.handle : null;
    expect(mocks.deleteGame).toHaveBeenCalledWith(handle, 0, "selected-stamp", "selected-revision");
    expect(mocks.notify).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Common.Error", message: "Files.RemoveGameStale" }),
    );
    expect(mocks.deleteRejected).not.toHaveBeenCalled();
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

  test("typed stale delete refusal rolls back, clears rows, notifies, and refreshes the count", async () => {
    const stale = new TauriCommandError({
      tag: "backend-error",
      category: "stale-game",
      message: "stale game",
    });
    mocks.deleteGame.mockRejectedValueOnce(stale);
    mocks.countPgnGames.mockImplementationOnce(async () => {
      expect(jotaiStore.get(currentTabAtom)?.gameOrigin).toMatchObject({
        file: { numGames: 5 },
      });
      return 6;
    });
    await act(async () => root.render(renderPanel()));

    await primeAndDelete();
    await act(async () => Promise.resolve());

    const handle = tabA.gameOrigin.kind === "file" ? tabA.gameOrigin.file.handle : null;
    expect(mocks.deleteGame).toHaveBeenCalledWith(handle, 1, "selected-stamp", "selected-revision");
    expect(mocks.deleteRejected).not.toHaveBeenCalled();
    expect(jotaiStore.get(currentTabAtom)?.gameOrigin).toMatchObject({
      file: { numGames: 6 },
    });
    expect(container.querySelector('[data-testid="game-cache-size"]')?.textContent).toBe("0");
    expect(mocks.notify).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Common.Error", message: "Files.RemoveGameStale" }),
    );
  });

  test("failed stale count refresh keeps the rollback count and reports its error", async () => {
    const stale = new TauriCommandError({
      tag: "backend-error",
      category: "stale-game",
      message: "stale game",
    });
    mocks.deleteGame.mockRejectedValueOnce(stale);
    mocks.countPgnGames.mockRejectedValueOnce(new Error("count refresh failed"));
    await act(async () => root.render(renderPanel()));

    await primeAndDelete();
    await vi.waitFor(() => expect(mocks.notify).toHaveBeenCalledTimes(2));

    expect(jotaiStore.get(currentTabAtom)?.gameOrigin).toMatchObject({
      file: { numGames: 5 },
    });
    expect(mocks.notify).toHaveBeenLastCalledWith(
      expect.objectContaining({ title: "Common.Error", message: "count refresh failed" }),
    );
    expect(mocks.deleteRejected).not.toHaveBeenCalled();
  });

  test("committed but uncertain deletion keeps the predicted count and refreshes without hiding the error", async () => {
    const uncertain = new TauriCommandError({
      tag: "backend-error",
      category: "durability",
      message: "Committed but durability uncertain: PGN edit",
    });
    mocks.deleteGame.mockRejectedValueOnce(uncertain);
    mocks.countPgnGames.mockResolvedValueOnce(4);
    await act(async () => root.render(renderPanel()));

    await primeAndDelete();
    await vi.waitFor(() =>
      expect(jotaiStore.get(currentTabAtom)?.gameOrigin).toMatchObject({
        file: { numGames: 4 },
      }),
    );

    expect(container.querySelector('[data-testid="game-cache-size"]')?.textContent).toBe("0");
    expect(mocks.deleteRejected).toHaveBeenCalledWith(uncertain);
  });

  test("stale count refresh cannot update an owner after switching tabs", async () => {
    const stale = new TauriCommandError({
      tag: "backend-error",
      category: "stale-game",
      message: "stale game",
    });
    let resolveCount!: (count: number) => void;
    mocks.deleteGame.mockRejectedValueOnce(stale);
    mocks.countPgnGames.mockImplementationOnce(
      (_handle: unknown, options?: { signal?: AbortSignal }) => {
        return new Promise<number>((resolve) => {
          resolveCount = resolve;
          expect(options?.signal).toBeInstanceOf(AbortSignal);
        });
      },
    );
    await act(async () => root.render(renderPanel()));
    await primeAndDelete();

    const treeStoreB = createTreeStore(undefined, defaultTree());
    await act(async () => {
      jotaiStore.set(activeTabAtom, tabBId);
      root.render(renderPanel(treeStoreB));
    });
    await act(async () => {
      resolveCount(99);
      await Promise.resolve();
    });

    expect(jotaiStore.get(tabsAtom)).toMatchObject([
      { value: tabAId, gameOrigin: { file: { numGames: 5 } } },
      { value: tabBId, gameOrigin: { file: { numGames: 5 } } },
    ]);
    expect(jotaiStore.get(activeTabAtom)).toBe(tabBId);
  });

  test("stale count refresh cannot update an owner closed while the count is pending", async () => {
    const stale = new TauriCommandError({
      tag: "backend-error",
      category: "stale-game",
      message: "stale game",
    });
    let resolveCount!: (count: number) => void;
    let capturedSignal!: AbortSignal;
    mocks.deleteGame.mockRejectedValueOnce(stale);
    mocks.countPgnGames.mockImplementationOnce(
      (_handle: unknown, options?: { signal?: AbortSignal }) => {
        capturedSignal = options!.signal!;
        return new Promise<number>((resolve) => {
          resolveCount = resolve;
        });
      },
    );
    await act(async () => root.render(renderPanel()));
    await primeAndDelete();

    await act(async () => {
      jotaiStore.set(tabsAtom, [tabB], tabBId);
      root.render(renderPanel(createTreeStore(undefined, defaultTree())));
    });
    expect(capturedSignal.aborted).toBe(true);
    await act(async () => {
      resolveCount(99);
      await Promise.resolve();
    });

    expect(jotaiStore.get(tabsAtom)).toEqual([tabB]);
    expect(jotaiStore.get(activeTabAtom)).toBe(tabBId);
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
      root.render(renderPanel(createTreeStore(undefined, defaultTree())));
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

  test("successful delete updates same-file tabs and shifts only later game numbers", async () => {
    const ownerOrigin = tabA.gameOrigin;
    if (ownerOrigin.kind !== "file") throw new Error("Test tab must be file-backed");
    const owner = {
      ...tabA,
      gameOrigin: { ...ownerOrigin, gameNumber: 4 },
    } as Tab;
    const siblingAfter: Tab = {
      ...owner,
      value: "33333333-3333-4333-8333-333333333333",
      gameOrigin: { ...ownerOrigin, gameNumber: 2 },
    };
    const siblingAtRemovedIndex: Tab = {
      ...owner,
      value: "44444444-4444-4444-8444-444444444444",
      gameOrigin: { ...ownerOrigin, gameNumber: 1 },
    };
    const siblingBefore: Tab = {
      ...owner,
      value: "55555555-5555-4555-8555-555555555555",
      gameOrigin: { ...ownerOrigin, gameNumber: 0 },
    };
    mocks.deleteGame.mockResolvedValueOnce(undefined);
    jotaiStore.set(tabsAtom, [owner, siblingAfter, siblingAtRemovedIndex, siblingBefore, tabB]);
    jotaiStore.set(activeTabAtom, tabAId);
    await act(async () => root.render(renderPanel()));

    await primeAndDelete();

    const tabs = jotaiStore.get(tabsAtom);
    expect(tabs.map((tab) => tab.gameOrigin)).toMatchObject([
      { kind: "file", gameNumber: 3, file: { numGames: 4 } },
      { kind: "file", gameNumber: 1, file: { numGames: 4 } },
      { kind: "file", gameNumber: 1, file: { numGames: 4 } },
      { kind: "file", gameNumber: 0, file: { numGames: 4 } },
      { kind: "file", gameNumber: 0, file: { numGames: 5 } },
    ]);
  });

  test("successful delete leaves a same-file tab opened during the native call at its current index", async () => {
    const ownerOrigin = tabA.gameOrigin;
    if (ownerOrigin.kind !== "file") throw new Error("Test tab must be file-backed");
    let resolveDelete!: () => void;
    mocks.deleteGame.mockReturnValueOnce(
      new Promise<void>((resolve) => {
        resolveDelete = resolve;
      }),
    );
    await act(async () => root.render(renderPanel()));
    await primeAndDelete();

    const openedDuringDeleteId = "66666666-6666-4666-8666-666666666666";
    const openedDuringDelete: Tab = {
      ...tabA,
      value: openedDuringDeleteId,
      gameOrigin: {
        ...ownerOrigin,
        gameNumber: 3,
        file: { ...ownerOrigin.file, numGames: 4 },
      },
    };
    await act(async () => {
      jotaiStore.set(tabsAtom, (tabs) => [...tabs, openedDuringDelete]);
    });
    await act(async () => {
      resolveDelete();
      await Promise.resolve();
    });

    const openedTab = jotaiStore.get(tabsAtom).find((tab) => tab.value === openedDuringDeleteId);
    expect(openedTab?.gameOrigin).toMatchObject({ gameNumber: 3, file: { numGames: 4 } });
    expect(getFileFreshness(openedDuringDeleteId)).toMatchObject({ state: "unverified" });
  });

  test("successful delete does not shift a same-file sibling whose count changed while pending", async () => {
    const ownerOrigin = tabA.gameOrigin;
    if (ownerOrigin.kind !== "file") throw new Error("Test tab must be file-backed");
    const siblingId = "77777777-7777-4777-8777-777777777777";
    const sibling: Tab = {
      ...tabA,
      value: siblingId,
      gameOrigin: { ...ownerOrigin, gameNumber: 3 },
    };
    let resolveDelete!: () => void;
    mocks.deleteGame.mockReturnValueOnce(
      new Promise<void>((resolve) => {
        resolveDelete = resolve;
      }),
    );
    jotaiStore.set(tabsAtom, [tabA, sibling, tabB]);
    await act(async () => root.render(renderPanel()));
    await primeAndDelete();

    await act(async () => {
      jotaiStore.set(tabsAtom, (tabs) =>
        tabs.map((tab) =>
          tab.value === siblingId && tab.gameOrigin.kind === "file"
            ? {
                ...tab,
                gameOrigin: {
                  ...tab.gameOrigin,
                  file: { ...tab.gameOrigin.file, numGames: 6 },
                },
              }
            : tab,
        ),
      );
      resolveDelete();
      await Promise.resolve();
    });

    const updatedSibling = jotaiStore.get(tabsAtom).find((tab) => tab.value === siblingId);
    expect(updatedSibling?.gameOrigin).toMatchObject({ gameNumber: 3, file: { numGames: 6 } });
  });

  test("successful delete leaves initially stale same-file siblings for freshness reconciliation", async () => {
    const ownerOrigin = tabA.gameOrigin;
    if (ownerOrigin.kind !== "file") throw new Error("Test tab must be file-backed");
    const siblingId = "88888888-8888-4888-8888-888888888888";
    const sibling: Tab = {
      ...tabA,
      value: siblingId,
      gameOrigin: {
        ...ownerOrigin,
        gameNumber: 3,
        file: { ...ownerOrigin.file, numGames: 4 },
      },
    };
    mocks.deleteGame.mockResolvedValueOnce(undefined);
    jotaiStore.set(tabsAtom, [tabA, sibling, tabB]);
    await act(async () => root.render(renderPanel()));

    await primeAndDelete();

    const updatedSibling = jotaiStore.get(tabsAtom).find((tab) => tab.value === siblingId);
    expect(updatedSibling?.gameOrigin).toMatchObject({ gameNumber: 3, file: { numGames: 4 } });
    expect(getFileFreshness(siblingId)).toMatchObject({ state: "unverified" });
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

    const treeStoreB = createTreeStore(undefined, defaultTree());
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
    let resolveLoad!: (data: Awaited<ReturnType<typeof mocks.loadFileGame>>) => void;

    mocks.loadFileGame.mockImplementation(
      (_handle: unknown, _page: number, signal?: AbortSignal) => {
        if (signal) capturedSignal = signal;
        return new Promise((resolve) => {
          resolveLoad = resolve;
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
    const treeStoreB = createTreeStore(undefined, defaultTree());
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

    // Resolve the stale loaded game
    await act(async () => {
      const tree = defaultTree();
      tree.headers.event = "Stale result";
      tree.sourceStamp = "c".repeat(64);
      resolveLoad({
        pgn: "1. d4 d5 *",
        stamp: tree.sourceStamp,
        revision: "r3",
        present: true,
        tree,
      });
    });

    // The stale result is ignored and tab A gameNumber remains 0.
    const tabAState = jotaiStore.get(tabsAtom).find((t) => t.value === tabAId);
    expect(tabAState?.gameOrigin.kind === "file" && tabAState.gameOrigin.gameNumber).toBe(0);
    expect(mocks.notify).not.toHaveBeenCalled();
  });

  test("shared peer survival: tab B page load succeeds independently after tab A was replaced", async () => {
    let signalA!: AbortSignal;
    mocks.loadFileGame.mockImplementationOnce(
      (_handle: unknown, _page: number, signal?: AbortSignal) => {
        if (signal) signalA = signal;
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
    const treeStoreB = createTreeStore(undefined, defaultTree());
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
    mockTreeB.sourceStamp = "d".repeat(64);
    mocks.loadFileGame.mockImplementationOnce(
      (_handle: unknown, _page: number, signal?: AbortSignal) => {
        if (signal) signalB = signal;
        return Promise.resolve({
          pgn: "1. c4 e5 *",
          stamp: mockTreeB.sourceStamp,
          revision: "r4",
          present: true,
          tree: mockTreeB,
        });
      },
    );

    const setPageBtnB = container.querySelector<HTMLButtonElement>('[data-testid="set-page"]')!;
    await act(async () => {
      setPageBtnB.click();
    });

    expect(signalB).toBeDefined();
    expect(signalB.aborted).toBe(false);
    const fileBHandle = tabB.gameOrigin.kind === "file" ? tabB.gameOrigin.file.handle : null;
    expect(mocks.loadFileGame).toHaveBeenCalledWith(fileBHandle, 1, signalB);

    const activeTab = jotaiStore.get(currentTabAtom);
    expect(activeTab?.value).toBe(tabBId);
    expect(activeTab?.gameOrigin.kind === "file" && activeTab.gameOrigin.gameNumber).toBe(1);
    expect(mocks.notify).not.toHaveBeenCalled();
  });

  test("unmount during pending loadFileGame aborts signal and stays silent", async () => {
    let capturedSignal!: AbortSignal;

    mocks.loadFileGame.mockImplementation(
      (_handle: unknown, _page: number, signal?: AbortSignal) => {
        if (signal) capturedSignal = signal;
        return new Promise((_, reject) => {
          signal?.addEventListener("abort", () => {
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
