import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { Provider, createStore } from "jotai";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { currentTabAtom, tabsAtom } from "@/state/atoms";
import { closeTreeStore, createTreeStore, type TreeStore } from "@/state/store/tree";
import type { Tab } from "@/state/workspaceTypes";
import { TreeStateContext } from "../common/TreeStateContext";
import ConfirmChangesModal from "./ConfirmChangesModal";

const mocks = vi.hoisted(() => ({ pickPgnFile: vi.fn(), writeGame: vi.fn() }));

vi.mock("@/platform/tauri", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/platform/tauri")>();
  return { ...actual, tauri: { ...actual.tauri, writeGame: mocks.writeGame } };
});
vi.mock("@/utils/files", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/utils/files")>()),
  pickPgnFile: mocks.pickPgnFile,
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
    name: "saved.pgn",
    handle: { id: { id: "saved" }, kind: "fileWorkspace" },
  });
  mocks.writeGame.mockResolvedValue(undefined);
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

test("a refused background origin save keeps the captured pending close open", async () => {
  const originalSetItem = Storage.prototype.setItem;
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, key, value) {
    if (key === "workspace") throw new DOMException("quota", "QuotaExceededError");
    return originalSetItem.call(this, key, value);
  });
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
  expect(host.querySelector('[role="dialog"]')?.textContent).toContain("Tab.SaveFailed");
});

test("a refused current-tab origin save skips native save and keeps the modal open", async () => {
  const currentTreeStore = createTreeStore(currentTab.value);
  const save = vi.spyOn(currentTreeStore.getState(), "save");
  const originalSetItem = Storage.prototype.setItem;
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, key, value) {
    if (key === "workspace") throw new DOMException("quota", "QuotaExceededError");
    return originalSetItem.call(this, key, value);
  });
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
  expect(mocks.writeGame).not.toHaveBeenCalled();
  expect(save).not.toHaveBeenCalled();
  expect(closeTab).not.toHaveBeenCalled();
  expect(toggle).not.toHaveBeenCalled();
  expect(host.querySelector('[role="dialog"]')?.textContent).toContain("Tab.SaveFailed");
});
