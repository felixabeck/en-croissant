import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { Provider as JotaiProvider, createStore as createJotaiStore } from "jotai";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { createStore as createZustandStore } from "zustand/vanilla";
import { TreeStateContext } from "@/components/common/TreeStateContext";
import { activeTabAtom, autoSaveAtom, currentTabAtom, tabsAtom } from "@/state/atoms";
import { getFileFreshness } from "@/state/fileFreshness";
import type { TreeStore } from "@/state/store/tree";
import type { Tab } from "@/state/workspaceTypes";
import { defaultPGN } from "@/utils/chess";
import { defaultTree } from "@/utils/treeReducer";
import BoardAnalysis from "./BoardAnalysis";

const mocks = vi.hoisted(() => ({
  notifyUnlessCancelled: vi.fn(),
  writeGame: vi.fn(),
  countPgnGames: vi.fn(),
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
  notifyUnlessCancelled: mocks.notifyUnlessCancelled,
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
    tauri: {
      ...actual.tauri,
      countPgnGames: mocks.countPgnGames,
      writeGame: mocks.writeGame,
    },
  };
});

vi.mock("@/components/tabs/ConfirmChangesModal", () => ({
  default: ({
    opened,
    toggle,
    onSaved,
  }: {
    opened: boolean;
    toggle: () => void;
    onSaved: () => void;
  }) =>
    opened ? (
      <div role="dialog">
        <button type="button" onClick={toggle}>
          Cancel
        </button>
        <button type="button" onClick={onSaved}>
          Save and add game
        </button>
      </div>
    ) : null,
}));

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
    mocks.notifyUnlessCancelled.mockReset();
    mocks.countPgnGames.mockReset().mockResolvedValue(4);
    mocks.writeGame.mockReset().mockResolvedValue({ stamp: "b".repeat(64) });

    jotaiStore = createJotaiStore();
    jotaiStore.set(tabsAtom, [tab], tabId);
    jotaiStore.set(activeTabAtom, tabId);
    jotaiStore.set(autoSaveAtom, false);

    const initialTree = defaultTree();
    initialTree.headers.event = "Keep this tree";
    initialTree.sourceStamp = "a".repeat(64);
    initialTree.dirty = true;
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

  test("dirty Add Game asks first and Cancel keeps the edited tree without writing", async () => {
    const treeBefore = structuredClone(treeStore.getState().root);

    await act(async () => {
      container.querySelector<HTMLButtonElement>('[data-testid="add-game"]')!.click();
    });

    expect(jotaiStore.get(currentTabAtom)?.gameOrigin).toEqual(tab.gameOrigin);
    expect(jotaiStore.get(tabsAtom)).toHaveLength(1);
    expect(treeStore.getState().root).toEqual(treeBefore);
    expect(reset).not.toHaveBeenCalled();
    expect(mocks.writeGame).not.toHaveBeenCalled();
    expect(container.querySelector('[role="dialog"]')?.textContent).toContain("Save and add game");

    await act(async () => {
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent === "Cancel")!
        .click();
    });

    expect(container.querySelector('[role="dialog"]')).toBeNull();
    expect(treeStore.getState().root).toEqual(treeBefore);
    expect(treeStore.getState().dirty).toBe(true);
    expect(jotaiStore.get(currentTabAtom)?.gameOrigin).toEqual(tab.gameOrigin);
    expect(mocks.writeGame).not.toHaveBeenCalled();
  });

  test("Add Game withholds the board during append and moves the origin only after success", async () => {
    let resolveWrite: (value: { stamp: string | null }) => void = () => undefined;
    mocks.writeGame.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveWrite = resolve;
      }),
    );

    await act(async () => {
      container.querySelector<HTMLButtonElement>('[data-testid="add-game"]')!.click();
    });
    await act(async () => {
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent === "Save and add game")!
        .click();
    });

    expect(mocks.writeGame).toHaveBeenCalledWith(fileHandle, 3, defaultPGN(), { kind: "append" });
    expect(jotaiStore.get(currentTabAtom)?.gameOrigin).toEqual(tab.gameOrigin);
    expect(reset).not.toHaveBeenCalled();
    expect(getFileFreshness(tabId).state).toBe("appending");

    await act(async () => resolveWrite({ stamp: "b".repeat(64) }));

    expect(jotaiStore.get(currentTabAtom)?.gameOrigin).toMatchObject({
      kind: "file",
      gameNumber: 3,
      file: { numGames: 4 },
    });
    expect(reset).not.toHaveBeenCalled();
    expect(getFileFreshness(tabId).state).toBe("unverified");
  });

  test("Add Game stale failure refreshes count and leaves the old origin", async () => {
    mocks.writeGame.mockRejectedValueOnce({
      tag: "backend-error",
      category: "stale-game",
      message: "The game changed on disk",
    });
    await act(async () => {
      container.querySelector<HTMLButtonElement>('[data-testid="add-game"]')!.click();
    });
    await act(async () => {
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent === "Save and add game")!
        .click();
    });

    expect(mocks.countPgnGames).toHaveBeenCalledWith(fileHandle);
    expect(jotaiStore.get(currentTabAtom)?.gameOrigin).toMatchObject({
      kind: "file",
      gameNumber: 1,
      file: { numGames: 4 },
    });
    expect(mocks.notifyUnlessCancelled).toHaveBeenCalledWith("Common.Error", {
      category: "validation",
      message: "FileFreshness.AddGameChanged",
    });
  });

  test("uncertain Add Game reports that it may have been added without moving origin", async () => {
    mocks.writeGame.mockRejectedValueOnce(new Error("durability uncertain"));
    await act(async () => {
      container.querySelector<HTMLButtonElement>('[data-testid="add-game"]')!.click();
    });
    await act(async () => {
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent === "Save and add game")!
        .click();
    });

    expect(jotaiStore.get(currentTabAtom)?.gameOrigin).toMatchObject({
      kind: "file",
      gameNumber: tab.gameOrigin.kind === "file" ? tab.gameOrigin.gameNumber : -1,
      file: { numGames: 4 },
    });
    expect(mocks.notifyUnlessCancelled).toHaveBeenCalledWith("Common.Error", {
      category: "unexpected",
      message: "FileFreshness.AddGameMayHaveBeenAdded durability uncertain",
    });
  });
});
