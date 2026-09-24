import { act } from "react";
import { useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { Provider, createStore } from "jotai";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { activeTabAtom, currentTabAtom, tabsAtom } from "@/state/atoms";
import { closeTreeStore, createTreeStore, type TreeStore } from "@/state/store/tree";
import type { Tab } from "@/state/workspaceTypes";
import { TreeStateContext } from "../common/TreeStateContext";
import { registerFileConflictSave, setFileFreshness } from "@/state/fileFreshness";
import { defaultTree } from "@/utils/treeReducer";
import ConfirmChangesModal from "./ConfirmChangesModal";

const mocks = vi.hoisted(() => ({
  pickPgnFile: vi.fn(),
  readFileGame: vi.fn(),
  writeGame: vi.fn(),
}));

vi.mock("@/platform/tauri", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/platform/tauri")>();
  return { ...actual, tauri: { ...actual.tauri, writeGame: mocks.writeGame } };
});
vi.mock("@/utils/files", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/utils/files")>()),
  pickPgnFile: mocks.pickPgnFile,
  readFileGame: mocks.readFileGame,
}));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@mantine/core", () => ({
  Button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
  Group: ({ children }: any) => <div>{children}</div>,
  Stack: ({ children }: any) => <div>{children}</div>,
  Text: ({ children, ...props }: any) => <p {...props}>{children}</p>,
}));
vi.mock("../common/AppModal", () => ({
  default: ({ opened, children }: any) => (opened ? <div role="dialog">{children}</div> : null),
}));

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const currentTab: Tab = {
  name: "Current",
  value: "11111111-1111-4111-8111-111111111111",
  type: "analysis",
  gameOrigin: { kind: "none" },
};
const backgroundTab: Tab = {
  ...currentTab,
  name: "Background",
  value: "22222222-2222-4222-8222-222222222222",
};

let host: HTMLDivElement;
let root: Root;
let jotaiStore: ReturnType<typeof createStore>;
let treeStore: TreeStore;

beforeEach(() => {
  sessionStorage.clear();
  vi.clearAllMocks();
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  jotaiStore = createStore();
  jotaiStore.set(tabsAtom, [currentTab, backgroundTab], currentTab.value);
  treeStore = createTreeStore(backgroundTab.value);
  mocks.pickPgnFile.mockResolvedValue({
    type: "file",
    name: "saved.pgn",
    handle: { id: { id: "saved" }, kind: "fileWorkspace" },
    numGames: 1,
    metadata: { type: "game", tags: [] },
    lastModified: 1,
  });
  mocks.readFileGame.mockResolvedValue({
    pgn: "existing game",
    stamp: "a".repeat(64),
    revision: "r1",
    present: true,
  });
  mocks.writeGame.mockResolvedValue({ stamp: "b".repeat(64), revision: "new-revision" });
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  closeTreeStore(currentTab.value);
  closeTreeStore(backgroundTab.value);
  vi.restoreAllMocks();
});

async function saveAndClose() {
  await act(async () => {
    host.querySelector<HTMLButtonElement>("button:last-of-type")!.click();
    await Promise.resolve();
  });
}

test("a successful background save forwards the receipt to the captured pending tab", async () => {
  const updateTab = vi.fn((tabId: string, update: React.SetStateAction<Tab>) =>
    jotaiStore.set(tabsAtom, (tabs) =>
      tabs.map((tab) =>
        tab.value === tabId ? (typeof update === "function" ? update(tab) : update) : tab,
      ),
    ),
  );
  const onSaved = vi.fn();
  await act(async () =>
    root.render(
      <Provider store={jotaiStore}>
        <ConfirmChangesModal
          pendingClose={{ tabId: backgroundTab.value, store: treeStore }}
          tab={backgroundTab}
          updateTab={updateTab}
          onCancel={vi.fn()}
          onDiscard={vi.fn()}
          onSaved={onSaved}
        />
      </Provider>,
    ),
  );

  await saveAndClose();

  expect(updateTab).toHaveBeenCalledWith(backgroundTab.value, expect.any(Function));
  expect(
    jotaiStore.get(tabsAtom).find((tab) => tab.value === backgroundTab.value)?.gameOrigin.kind,
  ).toBe("file");
  expect(onSaved).toHaveBeenCalledOnce();
});

test("a failed background Save-As keeps the captured pending close open", async () => {
  mocks.readFileGame.mockRejectedValueOnce(new Error("destination unavailable"));
  const onSaved = vi.fn();
  const updateTab = (tabId: string, update: React.SetStateAction<Tab>) =>
    jotaiStore.set(tabsAtom, (tabs) =>
      tabs.map((tab) =>
        tab.value === tabId ? (typeof update === "function" ? update(tab) : update) : tab,
      ),
    );
  await act(async () =>
    root.render(
      <Provider store={jotaiStore}>
        <ConfirmChangesModal
          pendingClose={{ tabId: backgroundTab.value, store: treeStore }}
          tab={backgroundTab}
          updateTab={updateTab}
          onCancel={vi.fn()}
          onDiscard={vi.fn()}
          onSaved={onSaved}
        />
      </Provider>,
    ),
  );

  await saveAndClose();

  expect(
    jotaiStore.get(tabsAtom).find((tab) => tab.value === backgroundTab.value)?.gameOrigin,
  ).toEqual({ kind: "none" });
  expect(mocks.writeGame).not.toHaveBeenCalled();
  expect(onSaved).not.toHaveBeenCalled();
  expect(host.querySelector('[role="dialog"]')?.textContent).toContain("destination unavailable");
});

test("a typed current-tab save failure is shown and keeps the modal open", async () => {
  const currentTreeStore = createTreeStore(currentTab.value);
  const save = vi.spyOn(currentTreeStore.getState(), "save");
  mocks.writeGame.mockRejectedValueOnce(new Error("typed write failure"));
  const closeTab = vi.fn();
  const toggle = vi.fn();
  await act(async () =>
    root.render(
      <Provider store={jotaiStore}>
        <TreeStateContext.Provider value={currentTreeStore}>
          <ConfirmChangesModal opened toggle={toggle} closeTab={closeTab} />
        </TreeStateContext.Provider>
      </Provider>,
    ),
  );

  await saveAndClose();

  expect(jotaiStore.get(currentTabAtom)?.gameOrigin).toEqual({ kind: "none" });
  expect(mocks.writeGame).toHaveBeenCalledOnce();
  expect(save).not.toHaveBeenCalled();
  expect(closeTab).not.toHaveBeenCalled();
  expect(toggle).not.toHaveBeenCalled();
  expect(host.querySelector('[role="dialog"]')?.textContent).toContain("typed write failure");
});

function fileBackedTab(value: string): Tab {
  return {
    ...currentTab,
    value,
    gameOrigin: {
      kind: "file",
      gameNumber: 0,
      file: {
        type: "file",
        name: "source.pgn",
        handle: { id: { id: `file-${value}` }, kind: "fileWorkspace" },
        numGames: 1,
        metadata: { type: "game", tags: [] },
        lastModified: 1,
      },
    },
  };
}

test("close-tab conflict closes the dialog, keeps the tab, and activates it", async () => {
  const sourceTab = fileBackedTab(backgroundTab.value);
  jotaiStore.set(tabsAtom, [currentTab, sourceTab], currentTab.value);
  const sourceTree = defaultTree();
  sourceTree.sourceStamp = "a".repeat(64);
  sourceTree.dirty = true;
  treeStore.getState().setState(sourceTree);
  const onCancel = vi.fn();
  const onSaved = vi.fn();
  const updateTab = vi.fn();
  mocks.writeGame.mockRejectedValueOnce({
    tag: "backend-error",
    category: "stale-game",
    message: "The game changed on disk",
  });

  function PendingCloseHarness() {
    const [pendingClose, setPendingClose] = useState<{
      tabId: string;
      store: TreeStore;
    } | null>({ tabId: sourceTab.value, store: treeStore });
    return (
      <Provider store={jotaiStore}>
        <ConfirmChangesModal
          pendingClose={pendingClose}
          tab={sourceTab}
          updateTab={updateTab}
          onCancel={() => {
            onCancel();
            setPendingClose(null);
          }}
          onDiscard={vi.fn()}
          onSaved={onSaved}
        />
      </Provider>
    );
  }

  await act(async () => root.render(<PendingCloseHarness />));
  await saveAndClose();

  expect(onCancel).toHaveBeenCalledOnce();
  expect(onSaved).not.toHaveBeenCalled();
  expect(updateTab).not.toHaveBeenCalled();
  expect(jotaiStore.get(tabsAtom)).toContainEqual(sourceTab);
  expect(jotaiStore.get(activeTabAtom)).toBe(sourceTab.value);
  expect(host.querySelector('[role="dialog"]')).toBeNull();
});

test("page-switch conflict leaves the tree and selected game in place", async () => {
  const sourceTab = fileBackedTab(currentTab.value);
  jotaiStore.set(tabsAtom, [sourceTab], sourceTab.value);
  const currentTree = createTreeStore(currentTab.value);
  const sourceTree = defaultTree();
  sourceTree.sourceStamp = "a".repeat(64);
  sourceTree.dirty = true;
  currentTree.getState().setState(sourceTree);
  mocks.writeGame.mockRejectedValueOnce({
    tag: "backend-error",
    category: "stale-game",
    message: "The game changed on disk",
  });
  const toggle = vi.fn();
  const changePage = vi.fn();

  await act(async () =>
    root.render(
      <Provider store={jotaiStore}>
        <TreeStateContext.Provider value={currentTree}>
          <ConfirmChangesModal
            opened
            toggle={toggle}
            closeTab={changePage}
            tab={sourceTab}
            updateTab={(tabId, update) =>
              jotaiStore.set(tabsAtom, (tabs) =>
                tabs.map((tab) =>
                  tab.value === tabId ? (typeof update === "function" ? update(tab) : update) : tab,
                ),
              )
            }
          />
        </TreeStateContext.Provider>
      </Provider>,
    ),
  );
  await saveAndClose();

  expect(toggle).toHaveBeenCalledOnce();
  expect(changePage).not.toHaveBeenCalled();
  expect(currentTree.getState()).toMatchObject({ dirty: true, sourceStamp: "a".repeat(64) });
  expect(jotaiStore.get(currentTabAtom)?.gameOrigin).toMatchObject({ gameNumber: 0 });
});

test("Save on an unavailable tab runs the registered append action", async () => {
  const action = vi.fn(async () => true);
  const unregister = registerFileConflictSave(backgroundTab.value, action);
  setFileFreshness(backgroundTab.value, "unavailable");
  const onSaved = vi.fn();

  await act(async () =>
    root.render(
      <Provider store={jotaiStore}>
        <ConfirmChangesModal
          pendingClose={{ tabId: backgroundTab.value, store: treeStore }}
          tab={backgroundTab}
          onCancel={vi.fn()}
          onDiscard={vi.fn()}
          onSaved={onSaved}
        />
      </Provider>,
    ),
  );
  await saveAndClose();

  expect(action).toHaveBeenCalledOnce();
  expect(onSaved).toHaveBeenCalledOnce();
  expect(mocks.writeGame).not.toHaveBeenCalled();
  unregister();
});

test("Save shows a typed unavailable-tab append failure inside the modal", async () => {
  registerFileConflictSave(backgroundTab.value, async () => {
    throw {
      tag: "backend-error",
      category: "permission",
      message: "The selected PGN cannot be written",
    };
  });
  setFileFreshness(backgroundTab.value, "unavailable");
  const onSaved = vi.fn();

  await act(async () =>
    root.render(
      <Provider store={jotaiStore}>
        <ConfirmChangesModal
          pendingClose={{ tabId: backgroundTab.value, store: treeStore }}
          tab={backgroundTab}
          onCancel={vi.fn()}
          onDiscard={vi.fn()}
          onSaved={onSaved}
        />
      </Provider>,
    ),
  );
  await saveAndClose();

  expect(onSaved).not.toHaveBeenCalled();
  expect(mocks.writeGame).not.toHaveBeenCalled();
  expect(host.querySelector('[role="dialog"]')?.textContent).toContain(
    "The selected PGN cannot be written",
  );
});
