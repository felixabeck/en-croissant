import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { Provider as JotaiProvider, createStore as createJotaiStore } from "jotai";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { TreeStateContext } from "@/components/common/TreeStateContext";
import {
  activeTabAtom,
  currentGameStateAtom,
  currentTabAtom,
  gameStateFamily,
  tabsAtom,
} from "@/state/atoms";
import { closeTreeStore, createTreeStore, type TreeStore } from "@/state/store/tree";
import type { Tab } from "@/state/workspaceTypes";
import BoardControls from "./BoardControls";

const mocks = vi.hoisted(() => ({
  persistError: vi.fn(),
  saveBoardSnapshot: vi.fn(),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("@mantine/core", () => ({
  Stack: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@tabler/icons-react", () => ({
  IconArrowBack: () => null,
  IconCamera: () => null,
  IconDeviceFloppy: () => null,
  IconEdit: () => null,
  IconEditOff: () => null,
  IconEraser: () => null,
  IconSwitchVertical: () => null,
  IconTarget: () => null,
  IconZoomCheck: () => null,
}));

vi.mock("@/components/common/IconAction", () => ({
  default: ({ label, onClick }: { label: string; onClick?: () => void }) => (
    <button type="button" aria-label={label} onClick={onClick}>
      {label}
    </button>
  ),
}));

vi.mock("@/components/files/notifyError", () => ({
  notifyListenerError: mocks.persistError,
}));

vi.mock("@/platform/native", () => ({
  platform: () => "linux",
  error: vi.fn(),
  warn: vi.fn(),
  info: vi.fn(),
  debug: vi.fn(),
  trace: vi.fn(),
}));

vi.mock("@/platform/tauri", async () => {
  const actual = await vi.importActual<typeof import("@/platform/tauri")>("@/platform/tauri");
  return {
    ...actual,
    tauri: { ...actual.tauri, saveBoardSnapshot: mocks.saveBoardSnapshot },
  };
});

vi.mock("dom-to-image", () => ({
  default: { toBlob: vi.fn() },
}));

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

describe("BoardControls tab type durability", () => {
  const tabId = "22222222-2222-4222-8222-222222222222";
  const tab: Tab = {
    name: "Analysis",
    value: tabId,
    type: "analysis",
    gameOrigin: { kind: "none" },
  };

  let container: HTMLDivElement;
  let root: Root;
  let jotaiStore: ReturnType<typeof createJotaiStore>;
  let treeStore: TreeStore;

  beforeEach(async () => {
    sessionStorage.clear();
    localStorage.clear();
    mocks.persistError.mockReset();
    mocks.saveBoardSnapshot.mockReset();

    jotaiStore = createJotaiStore();
    jotaiStore.set(tabsAtom, [tab], tabId);
    jotaiStore.set(activeTabAtom, tabId);
    jotaiStore.set(gameStateFamily(tabId), "playing");
    treeStore = createTreeStore(tabId);

    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    await act(async () => {
      root.render(
        <JotaiProvider store={jotaiStore}>
          <TreeStateContext.Provider value={treeStore}>
            <BoardControls editingMode={false} toggleEditingMode={vi.fn()} dirty={false} />
          </TreeStateContext.Provider>
        </JotaiProvider>,
      );
    });
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    closeTreeStore(tabId);
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

  test("starts a game only after the analysis-to-play change is durable", async () => {
    const durableWorkspace = sessionStorage.getItem("workspace");
    const storageFailure = refuseWorkspaceWrites();

    await act(async () => {
      container
        .querySelector<HTMLButtonElement>('[aria-label="Board.Action.PlayFromHere"]')!
        .click();
    });

    expect(jotaiStore.get(currentTabAtom)?.type).toBe("analysis");
    expect(jotaiStore.get(currentGameStateAtom)).toBe("playing");
    expect(sessionStorage.getItem("workspace")).toBe(durableWorkspace);

    storageFailure.mockRestore();
    await act(async () => {
      container
        .querySelector<HTMLButtonElement>('[aria-label="Board.Action.PlayFromHere"]')!
        .click();
    });

    expect(jotaiStore.get(currentTabAtom)?.type).toBe("play");
    expect(jotaiStore.get(currentGameStateAtom)).toBe("settingUp");
  });
});
