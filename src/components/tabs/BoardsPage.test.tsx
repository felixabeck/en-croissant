import { act, createContext, Suspense, useContext, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { getDefaultStore } from "jotai";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

const fixtures = vi.hoisted(() => ({
  abortGame: vi.fn(),
  closeWorkspaceTab: vi.fn(),
  closeTreeStore: vi.fn(),
  confirm: null as null | {
    pendingClose: { tabId: string } | null;
    onCancel: () => void;
    onDiscard: () => void;
  },
  createTreeStore: vi.fn(() => ({
    dispose: fixtures.dispose,
    getState: () => ({
      dirty: fixtures.dirty,
      setReportInProgress: fixtures.setReportInProgress,
      setReportOperationId: fixtures.setReportOperationId,
    }),
  })),
  createTab: vi.fn(),
  cloneDurable: vi.fn(),
  dispose: vi.fn(),
  dirty: false,
  closeHandler: null as (() => unknown) | null,
  closeReceipt: true,
  commitReceipt: true,
  hotkeyBindings: null as Array<[string, () => void]> | null,
  killEngines: vi.fn(),
  invalidateReportOwner: vi.fn(),
  restoreReportOwner: vi.fn(),
  notifyUnlessCancelled: vi.fn(),
  tabsOnChange: null as ((value: string | null) => void) | null,
  nextPromise: null as Promise<void> | null,
  nextReady: false,
  resolveNext: null as (() => void) | null,
  persistent: false,
  setReportInProgress: vi.fn(),
  setReportOperationId: vi.fn(),
  tabs: [
    { value: "current", name: "Current", type: "new", gameOrigin: { kind: "none" } },
    { value: "next", name: "Next", type: "new", gameOrigin: { kind: "none" } },
  ] as TabFixture[],
}));

type TabFixture = {
  gameOrigin: { kind: "none" };
  name: string;
  type: "new";
  value: string;
};

const TabsContext = createContext<string | null>(null);

vi.mock("@/state/atoms", async () => {
  const { atom } = await vi.importActual<typeof import("jotai")>("jotai");
  const { atomFamily } = await vi.importActual<typeof import("jotai/utils")>("jotai/utils");
  const activeTabAtom = atom<string | null>("current");
  const tabsStateAtom = atom<TabFixture[]>(fixtures.tabs);
  const tabsAtom = atom(
    (get) => get(tabsStateAtom),
    (get, set, update: TabFixture[] | ((tabs: TabFixture[]) => TabFixture[]), active?: string) => {
      if (!fixtures.commitReceipt) return false;
      const tabs = typeof update === "function" ? update(get(tabsStateAtom)) : update;
      set(tabsStateAtom, tabs);
      if (active !== undefined) set(activeTabAtom, active);
      return true;
    },
  );
  return {
    activeTabAtom,
    closeWorkspaceTabAtom: atom(null, (get, set, tabId: string) => {
      if (!fixtures.closeReceipt) return false;
      const tabs = get(tabsAtom).filter((tab) => tab.value !== tabId);
      set(tabsAtom, tabs);
      if (get(activeTabAtom) === tabId) set(activeTabAtom, tabs[0]?.value ?? null);
      fixtures.closeWorkspaceTab(tabId);
      return true;
    }),
    closingTabsAtom: atom<Set<string>>(new Set<string>()),
    gameIdFamily: atomFamily(() => atom<string | null>(null)),
    gameSessionFamily: atomFamily(() => atom<bigint | null>(null)),
    gameStateFamily: atomFamily(() => atom<"settingUp" | "playing" | "gameOver">("settingUp")),
    pendingGameStartFamily: atomFamily(() => atom<Promise<void> | null>(null)),
    tabsAtom,
  };
});
vi.mock("@/state/keybinds", async () => {
  const { atom } = await vi.importActual<typeof import("jotai")>("jotai");
  return {
    keyMapAtom: atom({
      CLOSE_TAB: { keys: "mod+w" },
      CYCLE_TABS: { keys: "mod+tab" },
      REVERSE_CYCLE_TABS: { keys: "mod+shift+tab" },
    }),
  };
});
vi.mock("@/platform/native", () => ({ platform: () => "linux" }));
vi.mock("@/platform/tauri", () => ({
  tauri: { abortGame: fixtures.abortGame, killEngines: fixtures.killEngines },
}));
vi.mock("@/state/store/tree", () => ({
  closeTreeStore: fixtures.closeTreeStore,
  createTreeStore: fixtures.createTreeStore,
  invalidateReportOwner: fixtures.invalidateReportOwner,
  restoreReportOwner: fixtures.restoreReportOwner,
}));
vi.mock("@/state/store/tabStorage", () => ({
  tabStorage: { cloneDurable: fixtures.cloneDurable },
}));
vi.mock("@/utils/tabs", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/utils/tabs")>()),
  createTab: fixtures.createTab,
  isPersistentGameOrigin: () => fixtures.persistent,
}));
vi.mock("../files/notifyError", () => ({ notifyUnlessCancelled: fixtures.notifyUnlessCancelled }));
vi.mock("jotai/utils", async () => {
  const actual = await vi.importActual<typeof import("jotai/utils")>("jotai/utils");
  const { atom } = await vi.importActual<typeof import("jotai")>("jotai");
  return { ...actual, atomWithStorage: (_key: string, initial: unknown) => atom(initial) };
});
vi.mock("@mantine/hooks", () => ({
  useHotkeys: vi.fn((bindings: Array<[string, () => void]>) => {
    fixtures.hotkeyBindings = bindings;
  }),
}));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@hello-pangea/dnd", () => ({
  DragDropContext: ({ children }: { children: ReactNode }) => children,
  Draggable: ({ children }: { children: (provided: Record<string, unknown>) => ReactNode }) =>
    children({ dragHandleProps: null, draggableProps: {}, innerRef: vi.fn() }),
  Droppable: ({ children }: { children: (provided: Record<string, unknown>) => ReactNode }) =>
    children({ droppableProps: {}, innerRef: vi.fn(), placeholder: null }),
}));
vi.mock("@mantine/core", () => {
  const Tabs = Object.assign(
    ({
      children,
      onChange,
      value,
    }: {
      children: ReactNode;
      onChange?: (value: string | null) => void;
      value: string | null;
    }) => {
      fixtures.tabsOnChange = onChange ?? null;
      return (
        <TabsContext.Provider value={value}>
          <div>{children}</div>
        </TabsContext.Provider>
      );
    },
    {
      List: ({ children }: { children: ReactNode }) => <div>{children}</div>,
      Panel: ({ children, value }: { children: ReactNode; value: string }) =>
        useContext(TabsContext) === value ? (
          <div data-testid={`panel-${value}`}>{children}</div>
        ) : null,
      Tab: ({ children, onClick }: { children: ReactNode; onClick?: () => void }) => (
        <button type="button" onClick={onClick}>
          {children}
        </button>
      ),
    },
  );

  const passthrough = ({ children }: { children: ReactNode }) => <div>{children}</div>;
  return {
    Button: passthrough,
    Group: passthrough,
    Menu: Object.assign(passthrough, {
      Dropdown: passthrough,
      Item: ({ children, onClick }: { children: ReactNode; onClick?: () => void }) => (
        <button type="button" onClick={onClick}>
          {children}
        </button>
      ),
      Target: passthrough,
    }),
    ScrollArea: passthrough,
    Tabs,
    TextInput: passthrough,
  };
});
vi.mock("@tabler/icons-react", () => ({
  IconCopy: () => null,
  IconDots: () => null,
  IconEdit: () => null,
  IconPlus: () => null,
  IconX: () => null,
}));
vi.mock("../boards/BoardAnalysis", () => ({ default: () => null }));
vi.mock("../boards/BoardGame", () => ({ default: () => null }));
vi.mock("../common/AppModal", () => ({ default: () => null }));
vi.mock("../common/IconAction", () => ({
  IconAction: ({ children, disabled, label, onClick }: any) => {
    if (label === "Tab.Close") fixtures.closeHandler = onClick;
    return (
      <button type="button" aria-label={label} disabled={disabled} onClick={onClick}>
        {children}
      </button>
    );
  },
}));
vi.mock("../common/TreeStateContext", () => ({
  TreeStateProvider: ({ children }: any) => children,
}));
vi.mock("../puzzles/Puzzles", () => ({ default: () => null }));
vi.mock("./BoardTab", () => ({
  BoardTab: ({ tab, setActiveTab }: { tab: TabFixture; setActiveTab: (value: string) => void }) => (
    <button type="button" data-testid={`tab-${tab.value}`} onClick={() => setActiveTab(tab.value)}>
      {tab.name}
    </button>
  ),
}));
vi.mock("./ConfirmChangesModal", () => ({
  default: (props: any) => {
    fixtures.confirm = props;
    return null;
  },
}));
vi.mock("./NewTabHome", () => ({
  default: ({ id }: { id: string }) => {
    if (id === "next" && !fixtures.nextReady) throw fixtures.nextPromise;
    return <div data-testid={`view-${id}`}>{id}</div>;
  },
}));
vi.mock("react-mosaic-component", () => ({ Mosaic: () => null }));

import BoardsPage from "./BoardsPage";
import {
  activeTabAtom,
  closingTabsAtom,
  gameIdFamily,
  gameSessionFamily,
  gameStateFamily,
  pendingGameStartFamily,
  tabsAtom,
} from "@/state/atoms";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

let container: HTMLDivElement;
let root: Root;
const store = getDefaultStore();

function deferred<T>() {
  let resolve: (value: T | PromiseLike<T>) => void = () => undefined;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

function renderPage() {
  return act(async () => {
    root.render(
      <Suspense fallback={<div data-testid="fallback">Loading</div>}>
        <BoardsPage />
      </Suspense>,
    );
  });
}

function invokeHotkey(keys: string) {
  const binding = fixtures.hotkeyBindings?.find(([shortcut]) => shortcut === keys);
  if (!binding) throw new Error(`Missing hotkey binding: ${keys}`);
  binding[1]();
}

beforeEach(() => {
  vi.clearAllMocks();
  fixtures.tabs = [
    { value: "current", name: "Current", type: "new", gameOrigin: { kind: "none" } },
    { value: "next", name: "Next", type: "new", gameOrigin: { kind: "none" } },
  ];
  store.set(tabsAtom, fixtures.tabs);
  store.set(activeTabAtom, "current");
  store.set(closingTabsAtom, new Set());
  for (const tabId of ["current", "next"]) {
    store.set(gameIdFamily(tabId), null);
    store.set(gameSessionFamily(tabId), null);
    store.set(pendingGameStartFamily(tabId), null);
  }
  fixtures.confirm = null;
  fixtures.dirty = false;
  fixtures.persistent = false;
  fixtures.nextReady = false;
  fixtures.closeHandler = null;
  fixtures.closeReceipt = true;
  fixtures.commitReceipt = true;
  fixtures.createTab.mockResolvedValue("created");
  fixtures.cloneDurable.mockReset();
  fixtures.hotkeyBindings = null;
  fixtures.notifyUnlessCancelled.mockReset();
  fixtures.tabsOnChange = null;
  fixtures.nextPromise = new Promise<void>((resolve) => {
    fixtures.resolveNext = resolve;
  });
  fixtures.killEngines.mockResolvedValue(undefined);
  fixtures.invalidateReportOwner.mockReturnValue({ previous: {}, invalidated: {} });
  fixtures.abortGame.mockResolvedValue(undefined);
  fixtures.createTreeStore.mockImplementation(() => ({
    dispose: fixtures.dispose,
    getState: () => ({
      dirty: fixtures.dirty,
      setReportInProgress: fixtures.setReportInProgress,
      setReportOperationId: fixtures.setReportOperationId,
    }),
  }));
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

test("keeps the current view while closing into a suspending next tab", async () => {
  await renderPage();
  expect(container.querySelector('[data-testid="view-current"]')).not.toBeNull();

  const close = fixtures.closeHandler!;
  const teardown = deferred<void>();
  fixtures.killEngines.mockReturnValueOnce(teardown.promise);
  const closePromise = close();

  await act(async () => {
    await Promise.resolve();
  });
  expect(fixtures.closeWorkspaceTab).not.toHaveBeenCalled();

  await act(async () => {
    teardown.resolve();
    await closePromise;
  });
  expect(fixtures.closeWorkspaceTab).toHaveBeenCalledWith("current");
  expect(fixtures.abortGame).not.toHaveBeenCalled();
  expect(container.querySelector('[data-testid="fallback"]')).toBeNull();
  expect(container.querySelector('[data-testid="view-current"]')).not.toBeNull();
  expect(container.querySelector('[data-testid="view-next"]')).toBeNull();

  await act(async () => {
    fixtures.nextReady = true;
    fixtures.resolveNext?.();
    await Promise.resolve();
  });
  expect(container.querySelector('[data-testid="view-next"]')).not.toBeNull();
});

test("restores the report owner and tree store when durable close is refused", async () => {
  await renderPage();
  fixtures.closeReceipt = false;

  await act(async () => {
    await fixtures.closeHandler!();
  });

  expect(fixtures.restoreReportOwner).toHaveBeenCalledOnce();
  expect(fixtures.closeTreeStore).not.toHaveBeenCalled();
  expect(fixtures.dispose).not.toHaveBeenCalled();
  expect(store.get(tabsAtom).some((tab) => tab.value === "current")).toBe(true);
  expect(store.get(closingTabsAtom)).toEqual(new Set());
});

test("does not loop when replacement creation after the last close is refused", async () => {
  const onlyTab = fixtures.tabs[0]!;
  store.set(tabsAtom, [onlyTab]);
  store.set(activeTabAtom, onlyTab.value);
  fixtures.createTab.mockResolvedValue(null);
  await renderPage();

  await act(async () => {
    await fixtures.closeHandler!();
    await Promise.resolve();
  });

  expect(store.get(tabsAtom)).toEqual([]);
  expect(fixtures.createTab).toHaveBeenCalledOnce();
  expect(fixtures.notifyUnlessCancelled).not.toHaveBeenCalled();
});

test("duplicate clones the requested tab and preserves metadata and selection on refusal", async () => {
  fixtures.commitReceipt = false;
  await renderPage();
  const before = store.get(tabsAtom);
  const duplicate = [...container.querySelectorAll<HTMLButtonElement>("button")].find(
    (button) => button.textContent === "Tab.Duplicate",
  )!;

  await act(async () => {
    duplicate.click();
    await Promise.resolve();
  });

  expect(fixtures.cloneDurable).toHaveBeenCalledOnce();
  expect(fixtures.cloneDurable.mock.calls[0]![0]).toBe("current");
  expect(fixtures.cloneDurable.mock.calls[0]![1]).not.toBe("current");
  expect(store.get(tabsAtom)).toEqual(before);
  expect(store.get(activeTabAtom)).toBe("current");
});

const suspendedNavigationCases = [
  {
    name: "a BoardTab click",
    navigate: () => container.querySelector<HTMLButtonElement>('[data-testid="tab-next"]')?.click(),
  },
  { name: "the Mantine tab selection", navigate: () => fixtures.tabsOnChange?.("next") },
  { name: "the forward cycle hotkey", navigate: () => invokeHotkey("mod+tab") },
  { name: "the reverse cycle hotkey", navigate: () => invokeHotkey("mod+shift+tab") },
  { name: "the numbered selection hotkey", navigate: () => invokeHotkey("alt+2") },
] as const;

test.each(suspendedNavigationCases)(
  "transitions $name before showing a suspending tab",
  async ({ navigate }) => {
    await renderPage();

    await act(async () => {
      navigate();
      await Promise.resolve();
    });

    expect(container.querySelector('[data-testid="fallback"]')).toBeNull();
    expect(container.querySelector('[data-testid="view-current"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="view-next"]')).toBeNull();

    await act(async () => {
      fixtures.nextReady = true;
      fixtures.resolveNext?.();
      await Promise.resolve();
    });
    expect(container.querySelector('[data-testid="view-next"]')).not.toBeNull();
  },
);

test("keeps the tab when engine teardown rejects", async () => {
  await renderPage();
  const teardownError = new Error("engine shutdown failed");
  fixtures.killEngines.mockRejectedValueOnce(teardownError);

  await act(async () => {
    fixtures.closeHandler!();
    await Promise.resolve();
  });

  expect(fixtures.closeWorkspaceTab).not.toHaveBeenCalled();
  expect(fixtures.restoreReportOwner).toHaveBeenCalledWith(
    "current",
    fixtures.invalidateReportOwner.mock.results[0].value,
  );
  expect(fixtures.setReportOperationId).not.toHaveBeenCalled();
  expect(fixtures.setReportInProgress).not.toHaveBeenCalled();
  expect(fixtures.notifyUnlessCancelled).toHaveBeenCalledWith("Common.Error", teardownError);
  expect(container.querySelector('[data-testid="view-current"]')).not.toBeNull();
});

test("deduplicates close teardown and holds intent until completion", async () => {
  await renderPage();
  const teardown = deferred<void>();
  fixtures.killEngines.mockReturnValue(teardown.promise);

  const first = fixtures.closeHandler!();
  const second = fixtures.closeHandler!();
  await act(async () => Promise.resolve());
  expect(fixtures.killEngines).toHaveBeenCalledTimes(1);
  expect(store.get(closingTabsAtom).has("current")).toBe(true);

  await act(async () => {
    teardown.resolve();
    await first;
    await second;
  });
  expect(store.get(closingTabsAtom).has("current")).toBe(false);
  expect(fixtures.closeWorkspaceTab).toHaveBeenCalledTimes(1);
});

test("failed teardown releases close intent and permits a fresh close", async () => {
  await renderPage();
  fixtures.killEngines.mockRejectedValueOnce(new Error("failed"));
  await act(async () => fixtures.closeHandler!());
  expect(store.get(closingTabsAtom).has("current")).toBe(false);

  await act(async () => fixtures.closeHandler!());
  expect(fixtures.killEngines).toHaveBeenCalledTimes(2);
});

test("close waits for a pending start before exact cleanup and removal", async () => {
  await renderPage();
  const start = deferred<void>();
  store.set(pendingGameStartFamily("current"), start.promise);
  fixtures.closeHandler!();
  await act(async () => Promise.resolve());
  expect(fixtures.killEngines).not.toHaveBeenCalled();
  expect(fixtures.closeWorkspaceTab).not.toHaveBeenCalled();

  store.set(gameIdFamily("current"), "late-game");
  store.set(gameSessionFamily("current"), 9n);
  await act(async () => {
    start.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
  expect(fixtures.abortGame).toHaveBeenCalledWith("late-game", 9n);
  expect(fixtures.closeWorkspaceTab).toHaveBeenCalledWith("current");
});

test("closing a terminal tab with relinquished ownership does not abort", async () => {
  await renderPage();
  store.set(gameStateFamily("current"), "gameOver");
  store.set(gameIdFamily("current"), null);
  store.set(gameSessionFamily("current"), null);
  await act(async () => fixtures.closeHandler!());
  expect(fixtures.abortGame).not.toHaveBeenCalled();
  expect(fixtures.closeWorkspaceTab).toHaveBeenCalledWith("current");
});

test("typed missing game permits close while genuine abort failure retains the tab", async () => {
  await renderPage();
  store.set(gameIdFamily("current"), "native-game");
  store.set(gameSessionFamily("current"), 3n);
  fixtures.abortGame.mockRejectedValueOnce({
    tag: "backend-error",
    category: "missing-resource",
    message: "gone",
  });
  await act(async () => fixtures.closeHandler!());
  expect(fixtures.closeWorkspaceTab).toHaveBeenCalledWith("current");

  store.set(tabsAtom, fixtures.tabs);
  store.set(activeTabAtom, "current");
  store.set(gameIdFamily("current"), "native-game-2");
  store.set(gameSessionFamily("current"), 4n);
  fixtures.abortGame.mockRejectedValueOnce(new Error("abort failed"));
  await renderPage();
  await act(async () => fixtures.closeHandler!());
  expect(store.get(tabsAtom).some((tab) => tab.value === "current")).toBe(true);
  expect(store.get(gameIdFamily("current"))).toBe("native-game-2");
  expect(fixtures.notifyUnlessCancelled).toHaveBeenCalledWith(
    "Common.Error",
    expect.objectContaining({ message: "abort failed" }),
  );
});

test("holds close intent through kill and game abort, then removes metadata before release", async () => {
  await renderPage();
  const kill = deferred<void>();
  const abort = deferred<null>();
  fixtures.killEngines.mockReturnValueOnce(kill.promise);
  store.set(gameIdFamily("current"), "native-game");
  store.set(gameSessionFamily("current"), 7n);
  fixtures.abortGame.mockReturnValueOnce(abort.promise);
  let markerAtMetadataRemoval = false;
  let tabPresentAtMetadataRemoval = true;
  fixtures.closeWorkspaceTab.mockImplementationOnce(() => {
    markerAtMetadataRemoval = store.get(closingTabsAtom).has("current");
    tabPresentAtMetadataRemoval = store
      .get(tabsAtom)
      .some((candidate) => candidate.value === "current");
  });

  fixtures.closeHandler!();
  expect(store.get(closingTabsAtom).has("current")).toBe(true);
  expect(fixtures.abortGame).not.toHaveBeenCalled();

  await act(async () => {
    kill.resolve();
    await Promise.resolve();
  });
  expect(fixtures.abortGame).toHaveBeenCalledWith("native-game", 7n);
  expect(store.get(closingTabsAtom).has("current")).toBe(true);
  expect(store.get(gameIdFamily("current"))).toBe("native-game");
  expect(store.get(gameSessionFamily("current"))).toBe(7n);

  await act(async () => {
    abort.resolve(null);
    await Promise.resolve();
    await Promise.resolve();
  });
  expect(markerAtMetadataRemoval).toBe(true);
  expect(tabPresentAtMetadataRemoval).toBe(false);
  expect(store.get(closingTabsAtom).has("current")).toBe(false);
  expect(store.get(tabsAtom).some((candidate) => candidate.value === "current")).toBe(false);
});

test("dirty confirmation leaves analysis eligible until discard establishes close intent", async () => {
  fixtures.persistent = true;
  fixtures.dirty = true;
  await renderPage();

  await act(async () => {
    fixtures.closeHandler!();
    await Promise.resolve();
  });
  expect(fixtures.confirm?.pendingClose?.tabId).toBe("current");
  expect(store.get(closingTabsAtom).has("current")).toBe(false);
  expect(store.get(tabsAtom).some((candidate) => candidate.value === "current")).toBe(true);
  expect(fixtures.killEngines).not.toHaveBeenCalled();

  await act(async () => fixtures.confirm?.onCancel());
  expect(store.get(closingTabsAtom).has("current")).toBe(false);
  expect(store.get(tabsAtom).some((candidate) => candidate.value === "current")).toBe(true);

  await act(async () => {
    fixtures.closeHandler!();
    await Promise.resolve();
  });
  let markerAtKill = false;
  fixtures.killEngines.mockImplementationOnce(async () => {
    markerAtKill = store.get(closingTabsAtom).has("current");
  });
  await act(async () => {
    fixtures.confirm?.onDiscard();
    await Promise.resolve();
    await Promise.resolve();
  });
  expect(markerAtKill).toBe(true);
  expect(store.get(closingTabsAtom).has("current")).toBe(false);
  expect(store.get(tabsAtom).some((candidate) => candidate.value === "current")).toBe(false);
});
