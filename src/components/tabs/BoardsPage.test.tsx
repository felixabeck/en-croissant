import { act, createContext, Suspense, useContext, useState, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

const fixtures = vi.hoisted(() => ({
  abortExactTabGame: vi.fn(),
  atoms: {
    activeTab: Symbol("active-tab"),
    closeWorkspaceTab: Symbol("close-workspace-tab"),
    keyMap: Symbol("key-map"),
    tabs: Symbol("tabs"),
    windowsState: Symbol("windows-state"),
  },
  closeWorkspaceTab: vi.fn((tabId: string) => {
    fixtures.setTabs?.((previous: TabFixture[]) => previous.filter((tab) => tab.value !== tabId));
    fixtures.setActiveTab?.((previous: string | null) => (previous === tabId ? "next" : previous));
  }),
  createTreeStore: vi.fn(() => ({
    dispose: fixtures.dispose,
    getState: () => ({ dirty: false }),
  })),
  dispose: vi.fn(),
  closeHandler: null as (() => unknown) | null,
  hotkeyBindings: null as Array<[string, () => void]> | null,
  killEngines: vi.fn(),
  notifyUnlessCancelled: vi.fn(),
  tabsOnChange: null as ((value: string | null) => void) | null,
  nextPromise: null as Promise<void> | null,
  nextReady: false,
  resolveNext: null as (() => void) | null,
  setActiveTab: null as
    | ((update: string | null | ((previous: string | null) => string | null)) => void)
    | null,
  setTabs: null as
    | ((update: TabFixture[] | ((previous: TabFixture[]) => TabFixture[])) => void)
    | null,
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

vi.mock("@/state/atoms", () => ({
  activeTabAtom: fixtures.atoms.activeTab,
  closeWorkspaceTabAtom: fixtures.atoms.closeWorkspaceTab,
  gameIdFamily: () => Symbol("game-id"),
  gameSessionFamily: () => Symbol("game-session"),
  tabsAtom: fixtures.atoms.tabs,
}));
vi.mock("@/state/keybinds", () => ({ keyMapAtom: fixtures.atoms.keyMap }));
vi.mock("@/platform/native", () => ({ platform: () => "linux" }));
vi.mock("@/platform/tauri", () => ({
  tauri: { abortGame: vi.fn(), killEngines: fixtures.killEngines },
}));
vi.mock("@/state/store/tree", () => ({ createTreeStore: fixtures.createTreeStore }));
vi.mock("@/state/store/tabStorage", () => ({ tabStorage: { clone: vi.fn() } }));
vi.mock("@/utils/tabs", () => ({
  createTab: vi.fn(),
  genID: () => "duplicate",
  isPersistentGameOrigin: () => false,
}));
vi.mock("../boards/gameSession", () => ({ abortExactTabGame: fixtures.abortExactTabGame }));
vi.mock("../files/notifyError", () => ({ notifyUnlessCancelled: fixtures.notifyUnlessCancelled }));
vi.mock("jotai/utils", () => ({ atomWithStorage: () => fixtures.atoms.windowsState }));
vi.mock("jotai", () => ({
  getDefaultStore: () => ({ get: () => null }),
  useAtom: (atom: symbol) => {
    if (atom === fixtures.atoms.tabs) {
      const state = useState(fixtures.tabs);
      fixtures.setTabs = state[1];
      return state;
    }
    if (atom === fixtures.atoms.activeTab) {
      const state = useState<string | null>("current");
      fixtures.setActiveTab = state[1];
      return state;
    }
    return useState({ currentNode: null });
  },
  useAtomValue: () => ({
    CLOSE_TAB: { keys: "mod+w" },
    CYCLE_TABS: { keys: "mod+tab" },
    REVERSE_CYCLE_TABS: { keys: "mod+shift+tab" },
  }),
  useSetAtom: (atom: symbol) =>
    atom === fixtures.atoms.closeWorkspaceTab ? fixtures.closeWorkspaceTab : vi.fn(),
}));
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
vi.mock("./ConfirmChangesModal", () => ({ default: () => null }));
vi.mock("./NewTabHome", () => ({
  default: ({ id }: { id: string }) => {
    if (id === "next" && !fixtures.nextReady) throw fixtures.nextPromise;
    return <div data-testid={`view-${id}`}>{id}</div>;
  },
}));
vi.mock("react-mosaic-component", () => ({ Mosaic: () => null }));

import BoardsPage from "./BoardsPage";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

let container: HTMLDivElement;
let root: Root;

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
  fixtures.nextReady = false;
  fixtures.closeHandler = null;
  fixtures.hotkeyBindings = null;
  fixtures.notifyUnlessCancelled.mockReset();
  fixtures.tabsOnChange = null;
  fixtures.nextPromise = new Promise<void>((resolve) => {
    fixtures.resolveNext = resolve;
  });
  fixtures.killEngines.mockResolvedValue(undefined);
  fixtures.abortExactTabGame.mockResolvedValue(null);
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
  expect(fixtures.notifyUnlessCancelled).toHaveBeenCalledWith("Common.Error", teardownError);
  expect(container.querySelector('[data-testid="view-current"]')).not.toBeNull();
});
