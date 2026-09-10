import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { Provider as JotaiProvider, createStore as createJotaiStore } from "jotai";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { createStore as createZustandStore } from "zustand/vanilla";
import { TreeStateContext } from "@/components/common/TreeStateContext";
import { activeTabAtom, currentTabAtom, tabsAtom } from "@/state/atoms";
import type { TreeStore } from "@/state/store/tree";
import type { Tab } from "@/state/workspaceTypes";
import { defaultPGN } from "@/utils/chess";
import { defaultTree } from "@/utils/treeReducer";
import BoardAnalysis from "./BoardAnalysis";

const mocks = vi.hoisted(() => ({
  persistError: vi.fn(),
  writeGame: vi.fn(),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("@mantine/hooks", () => ({
  useHotkeys: vi.fn(),
  useToggle: () => [false, vi.fn()],
}));

vi.mock("@mantine/core", () => {
  const passthrough = ({ children }: { children: ReactNode }) => <div>{children}</div>;
  const Tabs = Object.assign(passthrough, {
    List: passthrough,
    Panel: passthrough,
    Tab: passthrough,
  });
  return { Paper: passthrough, Portal: passthrough, Stack: passthrough, Tabs };
});

vi.mock("@tabler/icons-react", () => ({
  IconDatabase: () => null,
  IconInfoCircle: () => null,
  IconNotes: () => null,
  IconTargetArrow: () => null,
  IconZoomCheck: () => null,
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
    tauri: { ...actual.tauri, writeGame: mocks.writeGame },
  };
});

vi.mock("../panels/info/InfoPanel", () => ({
  default: ({ addGame }: { addGame?: () => void }) => (
    <button type="button" data-testid="add-game" onClick={addGame}>
      Add game
    </button>
  ),
}));

vi.mock("../common/DetachedEval", () => ({ default: () => null }));
vi.mock("../common/GameNotation", () => ({ default: () => null }));
vi.mock("../common/MoveControls", () => ({ default: () => null }));
vi.mock("../panels/analysis/AnalysisPanel", () => ({ default: () => null }));
vi.mock("../panels/annotation/AnnotationPanel", () => ({ default: () => null }));
vi.mock("../panels/database/DatabasePanel", () => ({ default: () => null }));
vi.mock("../panels/practice/PracticePanel", () => ({ default: () => null }));
vi.mock("./Board", () => ({ default: () => null }));
vi.mock("./BoardControls", () => ({ default: () => null }));
vi.mock("./EditingCard", () => ({ default: () => null }));
vi.mock("./EvalListener", () => ({ default: () => null }));

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

describe("BoardAnalysis add game durability", () => {
  const tabId = "11111111-1111-4111-8111-111111111111";
  const fileHandle = { id: { id: "workspace-token" }, kind: "fileWorkspace" } as const;
  const tab: Tab = {
    name: "Games",
    value: tabId,
    type: "analysis",
    gameOrigin: {
      kind: "file",
      gameNumber: 1,
      file: {
        type: "file",
        handle: fileHandle,
        name: "games.pgn",
        numGames: 3,
        metadata: { type: "game", tags: [] },
        lastModified: 1,
      },
    },
  };

  let container: HTMLDivElement;
  let root: Root;
  let jotaiStore: ReturnType<typeof createJotaiStore>;
  let treeStore: TreeStore;
  let reset: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    sessionStorage.clear();
    localStorage.clear();
    mocks.persistError.mockReset();
    mocks.writeGame.mockReset().mockResolvedValue(undefined);

    jotaiStore = createJotaiStore();
    jotaiStore.set(tabsAtom, [tab], tabId);
    jotaiStore.set(activeTabAtom, tabId);

    const initialTree = defaultTree();
    initialTree.headers.event = "Keep this tree";
    reset = vi.fn();
    treeStore = createZustandStore(() => ({
      ...initialTree,
      clearShapes: vi.fn(),
      reset,
      setAnnotation: vi.fn(),
      setPracticePath: vi.fn(),
    })) as unknown as TreeStore;

    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    await act(async () => {
      root.render(
        <JotaiProvider store={jotaiStore}>
          <TreeStateContext.Provider value={treeStore}>
            <BoardAnalysis />
          </TreeStateContext.Provider>
        </JotaiProvider>,
      );
    });
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
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

  test("does not reset or write a game until the workspace increment is durable", async () => {
    const treeBefore = structuredClone(treeStore.getState().root);
    const durableWorkspace = sessionStorage.getItem("workspace");
    const storageFailure = refuseWorkspaceWrites();

    await act(async () => {
      container.querySelector<HTMLButtonElement>('[data-testid="add-game"]')!.click();
    });

    expect(jotaiStore.get(currentTabAtom)?.gameOrigin).toEqual(tab.gameOrigin);
    expect(jotaiStore.get(tabsAtom)).toHaveLength(1);
    expect(treeStore.getState().root).toEqual(treeBefore);
    expect(sessionStorage.getItem("workspace")).toBe(durableWorkspace);
    expect(reset).not.toHaveBeenCalled();
    expect(mocks.writeGame).not.toHaveBeenCalled();

    storageFailure.mockRestore();
    await act(async () => {
      container.querySelector<HTMLButtonElement>('[data-testid="add-game"]')!.click();
    });

    expect(jotaiStore.get(tabsAtom)).toHaveLength(1);
    expect(jotaiStore.get(currentTabAtom)?.gameOrigin).toMatchObject({
      kind: "file",
      gameNumber: 3,
      file: { numGames: 4 },
    });
    expect(reset).toHaveBeenCalledOnce();
    expect(reset).toHaveBeenCalledWith();
    expect(mocks.writeGame).toHaveBeenCalledOnce();
    expect(mocks.writeGame).toHaveBeenCalledWith(fileHandle, 3, defaultPGN());
  });
});
