import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { createTreeStore } from "@/state/store/tree";
import { createNode, defaultTree } from "@/utils/treeReducer";
import { TreeStateContext } from "./TreeStateContext";
import { createNotationNodeIndex } from "./notationRows";

const { currentTabAtom } = vi.hoisted(() => ({ currentTabAtom: Symbol("current-tab") }));

vi.mock("@/state/atoms", () => ({ currentTabAtom }));
vi.mock("jotai", () => ({
  useAtomValue: () => ({ value: "tab" }),
}));
vi.mock("@/utils/tabs", () => ({
  getTabFile: () => ({ metadata: { type: "repertoire" } }),
}));
vi.mock("@mantine/hooks", () => ({ useClickOutside: () => undefined }));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@tabler/icons-react", () => {
  const Icon = () => null;
  return {
    IconArrowsJoin: Icon,
    IconChevronsUp: Icon,
    IconChevronUp: Icon,
    IconCopy: Icon,
    IconFlag: Icon,
    IconX: Icon,
  };
});
vi.mock("@/components/common/Comment", () => ({ default: () => null }));
vi.mock("@/components/common/IconAction", () => ({
  default: ({ children, label, onClick }: any) => (
    <button type="button" aria-label={label} onClick={onClick}>
      {children}
    </button>
  ),
}));
vi.mock("./MoveCell", () => ({
  default: ({ move, onClick, onContextMenu }: any) => (
    <button type="button" data-move={move} onClick={onClick} onContextMenu={onContextMenu}>
      {move}
    </button>
  ),
}));
vi.mock("@mantine/core", () => {
  const Menu = ({ children }: any) => <div>{children}</div>;
  Menu.Target = ({ children }: any) => <>{children}</>;
  Menu.Dropdown = ({ children }: any) => <div data-menu="true">{children}</div>;
  Menu.Item = ({ children, onClick }: any) => (
    <button type="button" data-menu-item="true" onClick={onClick}>
      {children}
    </button>
  );
  return {
    Box: ({ children, ...props }: any) => <span {...props}>{children}</span>,
    Menu,
    Portal: ({ children }: any) => <>{children}</>,
    Text: ({ children }: any) => <span>{children}</span>,
  };
});

import CompleteMoveCell from "./CompleteMoveCell";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});

test("opens one context menu and sends every action the identity-derived path", async () => {
  const tree = defaultTree();
  const first = createNode({
    fen: "first w - - 0 1",
    move: { from: 12, to: 28 },
    san: "e4",
    halfMoves: 1,
  });
  const second = createNode({
    fen: "second b - - 0 1",
    move: { from: 51, to: 35 },
    san: "e5",
    halfMoves: 2,
  });
  tree.root.children = [first, second];
  const store = createTreeStore();
  const state = store.getState();
  const actions = {
    deleteMove: vi.fn(),
    promoteVariation: vi.fn(),
    promoteToMainline: vi.fn(),
    copyVariationPgn: vi.fn(),
    setStart: vi.fn(),
  };
  store.setState({ ...state, ...actions, root: tree.root });
  const index = createNotationNodeIndex(tree.root);

  await act(async () => {
    root.render(
      <TreeStateContext.Provider value={store}>
        <CompleteMoveCell
          node={first}
          nodeIndex={index}
          root={tree.root}
          halfMoves={first.halfMoves}
          move={first.san}
          fen={first.fen}
          comment=""
          annotations={[]}
          showComments={false}
          isStart={false}
          isCurrentVariation={false}
        />
        <CompleteMoveCell
          node={second}
          nodeIndex={index}
          root={tree.root}
          halfMoves={second.halfMoves}
          move={second.san}
          fen={second.fen}
          comment=""
          annotations={[]}
          showComments={false}
          isStart={false}
          isCurrentVariation={false}
        />
      </TreeStateContext.Provider>,
    );
  });

  const moves = () => [...host.querySelectorAll<HTMLButtonElement>("[data-move]")];
  expect(host.querySelectorAll('[data-menu="true"]').length).toBe(0);
  await act(async () => {
    moves()[0].dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true }));
  });
  expect(host.querySelectorAll('[data-menu="true"]').length).toBe(1);
  expect(host.querySelectorAll('[data-menu-item="true"]').length).toBe(5);

  const expectedPath = [0];
  const clickAction = async (label: string, action: ReturnType<typeof vi.fn>) => {
    await act(async () => {
      [...host.querySelectorAll<HTMLButtonElement>('[data-menu-item="true"]')]
        .find((button) => button.textContent === label)!
        .click();
    });
    expect(action).toHaveBeenCalledWith(expectedPath);
    await act(async () => {
      moves()[0].dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true }));
    });
  };

  await clickAction("Menu.MarkAsStart", actions.setStart);
  await clickAction("Menu.PromoteToMainLine", actions.promoteToMainline);
  await clickAction("Menu.PromoteVariation", actions.promoteVariation);
  await clickAction("Menu.CopyVariationPGN", actions.copyVariationPgn);
  await act(async () => {
    [...host.querySelectorAll<HTMLButtonElement>('[data-menu-item="true"]')]
      .find((button) => button.textContent === "Menu.DeleteMove")!
      .click();
  });
  expect(actions.deleteMove).toHaveBeenCalledWith(expectedPath);
  expect(actions.setStart).not.toHaveBeenCalledWith([1]);
});
