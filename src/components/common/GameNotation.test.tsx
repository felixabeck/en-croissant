import { parseUci } from "chessops";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { createTreeStore, type TreeStore } from "@/state/store/tree";
import { TreeStateContext } from "./TreeStateContext";
import { defaultTree, type TreeNode } from "@/utils/treeReducer";
import { NOTATION_ROW_MAX_MOVES, pathForNotationNode } from "./notationRows";

const atoms = vi.hoisted(() => ({
  invisible: Symbol("invisible"),
  comments: Symbol("comments"),
  variations: Symbol("variations"),
  table: Symbol("table"),
  keyMap: Symbol("key-map"),
}));
const virtualizerMock = vi.hoisted(() => ({ current: null as null | { count: number } }));

vi.mock("@/state/atoms", () => ({
  currentInvisibleAtom: atoms.invisible,
  currentShowCommentsAtom: atoms.comments,
  currentShowVariationsAtom: atoms.variations,
  tableViewAtom: atoms.table,
}));
vi.mock("@/state/keybinds", () => ({ keyMapAtom: atoms.keyMap }));
vi.mock("jotai", () => ({
  useAtom: (atom: symbol) => {
    if (atom === atoms.table) return [false, vi.fn()];
    return [false, vi.fn()];
  },
  useAtomValue: (atom: symbol) => {
    if (atom === atoms.variations) return true;
    if (atom === atoms.keyMap) {
      return { TOGGLE_BLUR: { keys: "ctrl+b" }, COPY_PGN: { keys: "ctrl+k" } };
    }
    return false;
  },
}));
vi.mock("react-hotkeys-hook", () => ({ useHotkeys: vi.fn() }));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@tabler/icons-react", () => {
  const Icon = () => null;
  return {
    IconArrowRight: Icon,
    IconArrowsSplit: Icon,
    IconArticle: Icon,
    IconArticleOff: Icon,
    IconEye: Icon,
    IconEyeOff: Icon,
    IconLayoutList: Icon,
    IconList: Icon,
    IconMinus: Icon,
    IconPlus: Icon,
  };
});
vi.mock("@/components/common/Comment", () => ({ default: () => null }));
vi.mock("@/components/common/IconAction", () => ({
  default: ({ children, label, ...props }: any) => (
    <button type="button" aria-label={label} {...props}>
      {children}
    </button>
  ),
}));
vi.mock("./OpeningName", () => ({ default: () => null }));
vi.mock("./CompleteMoveCell", () => ({
  default: (props: any) => {
    const store = React.useContext(TreeStateContext)!;
    const path = pathForNotationNode(props.nodeIndex, props.node)!;
    return (
      <button
        type="button"
        data-move-cell="true"
        data-node={props.node.san}
        data-current={props.isCurrentVariation ? "true" : "false"}
        onClick={() => store.getState().goToMove(path)}
      >
        {props.move}
      </button>
    );
  },
}));
vi.mock("@mantine/core", () => {
  const element = ({ children, ...props }: any) => <div {...props}>{children}</div>;
  const table = ({ children, ...props }: any) => <table {...props}>{children}</table>;
  table.Tbody = element;
  table.Tr = ({ children, ...props }: any) => <tr {...props}>{children}</tr>;
  table.Td = ({ children, ...props }: any) => <td {...props}>{children}</td>;
  return {
    Box: element,
    Divider: element,
    Group: element,
    Overlay: element,
    Paper: element,
    ScrollArea: ({ children, viewportRef }: any) => <div ref={viewportRef}>{children}</div>,
    Stack: element,
    Table: table,
    Text: ({ children, ...props }: any) => <span {...props}>{children}</span>,
    useComputedColorScheme: () => "light",
  };
});
vi.mock("@tanstack/react-virtual", () => ({
  useVirtualizer: (options: { count: number }) => {
    virtualizerMock.current = { count: options.count };
    return {
      getTotalSize: () => options.count * 30,
      getVirtualItems: () =>
        Array.from({ length: Math.min(options.count, 20) }, (_, index) => ({
          index,
          size: 30,
          start: index * 30,
        })),
      measureElement: () => undefined,
      scrollToIndex: () => undefined,
    };
  },
}));

import React from "react";
import GameNotation from "./GameNotation";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

let host: HTMLDivElement;
let root: Root;
let store: TreeStore;

beforeEach(() => {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  store = createTreeStore();
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});

test("virtualizes a 20,000-node line and navigates/highlights mounted moves", async () => {
  const state = defaultTree();
  let parent = state.root;
  const sharedMove = parseUci("e2e4")!;
  const sharedAnnotations: [] = [];
  const sharedShapes: [] = [];
  for (let index = 1; index <= 20_000; index += 1) {
    const child: TreeNode = {
      fen: "line w - - 0 1",
      move: sharedMove,
      san: `m${index}`,
      children: [],
      score: null,
      depth: null,
      halfMoves: index,
      shapes: sharedShapes,
      annotations: sharedAnnotations,
      comment: "",
    };
    parent.children = [child];
    parent = child;
  }
  store.getState().setState(state);

  await act(async () => {
    root.render(
      <TreeStateContext.Provider value={store}>
        <GameNotation />
      </TreeStateContext.Provider>,
    );
  });

  const mounted = () => [...host.querySelectorAll<HTMLButtonElement>("[data-move-cell]")];
  expect(virtualizerMock.current?.count).toBeGreaterThan(600);
  expect(mounted().length).toBeLessThanOrEqual(20 * NOTATION_ROW_MAX_MOVES);
  expect(host.querySelector('[data-node="m1"][data-current="false"]')).not.toBeNull();

  await act(async () => mounted()[1].click());
  expect(store.getState().position).toEqual([0, 0]);
  expect(host.querySelector('[data-node="m2"][data-current="true"]')).not.toBeNull();
});
