import type { Config } from "@lichess-org/chessground/config";
import { MantineProvider } from "@mantine/core";
import { Provider, createStore as createAtomStore } from "jotai";
import { act, useContext, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import {
  TreeStateContext,
  TreeStateProvider,
  VariationChooserContext,
} from "@/components/common/TreeStateContext";
import MoveControls from "@/components/common/MoveControls";
import PuzzleBoard from "@/components/puzzles/PuzzleBoard";
import {
  activeTabAtom,
  tabsAtom,
  currentEvalOpenAtom,
  showArrowsAtom,
  showVariationArrowsAtom,
} from "@/state/atoms";
import { createTreeStore, type TreeStore } from "@/state/store/tree";
import type { VariationChooserStore } from "@/state/store/variationChooser";
import { press } from "@/tests/keyboard";
import { installMatchMediaStub } from "@/tests/matchMedia";
import { installResizeObserverStub } from "@/tests/resizeObserver";
import { fixtureNode } from "@/tests/treeFixtures";
import { defaultTree, type TreeState } from "@/utils/treeReducer";
import Board from "@/components/boards/Board";
import { childMoveArrow, continuationBrushes } from "@/components/boards/continuationArrows";

const engine = vi.hoisted(() => ({ enabled: false }));
vi.mock("@/state/atoms", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/state/atoms")>();
  const { atom } = await import("jotai");
  const bestMoves = atom(() =>
    engine.enabled
      ? new Map([
          [
            0,
            [
              { pv: ["e2e4"], winChance: 50 },
              { pv: ["g1f3"], winChance: 50 },
            ],
          ],
        ])
      : new Map(),
  );
  return { ...original, bestMovesFamily: () => bestMoves };
});
let boardConfig: Config;
vi.mock("@/chessground/Chessground", () => ({
  Chessground: (props: Config) => {
    boardConfig = props;
    return <div data-chessground />;
  },
}));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@/utils/sound", () => ({ playSound: vi.fn() }));
vi.mock("@/platform/native", () => ({ platform: () => "linux", warn: vi.fn(), error: vi.fn() }));
vi.mock("@/components/common/ShowMaterial", () => ({ default: () => null }));
vi.mock("@/components/databases/FideInfo", () => ({ default: () => null }));
vi.mock("@/components/boards/BoardBar", () => ({
  BoardBar: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock("@/components/boards/EvalBar", () => ({ default: () => null }));
vi.mock("@/components/boards/MoveInput", () => ({ default: () => null }));
vi.mock("@/components/panels/analysis/BestMoves", () => ({
  arrowColors: [{ strong: "blue", pale: "paleBlue" }],
}));

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
installMatchMediaStub();
installResizeObserverStub();
let host: HTMLDivElement;
let root: Root;
let tree: TreeStore;
let chooser: VariationChooserStore;

function Capture() {
  tree = useContext(TreeStateContext)!;
  chooser = useContext(VariationChooserContext)!;
  return null;
}
function initialTree() {
  const store = createTreeStore();
  for (const san of ["e4", "d4", "c4"]) {
    store.getState().makeMove({ payload: san });
    store.getState().goToPrevious();
  }
  return store.getState();
}
function render(initial: TreeState = initialTree(), puzzle = false) {
  const atoms = createAtomStore();
  atoms.set(tabsAtom, [
    { name: "Chooser", value: "chooser-test", type: "analysis", gameOrigin: { kind: "none" } },
  ]);
  atoms.set(activeTabAtom, "chooser-test");
  atoms.set(showVariationArrowsAtom, true);
  atoms.set(showArrowsAtom, true);
  atoms.set(currentEvalOpenAtom, true);
  act(() =>
    root.render(
      <Provider store={atoms}>
        <MantineProvider env="test">
          <TreeStateProvider initial={initial}>
            <Capture />
            {puzzle ? (
              <PuzzleBoard
                puzzles={[]}
                currentPuzzle={0}
                changeCompletion={vi.fn()}
                generatePuzzle={vi.fn()}
                db={null}
              />
            ) : (
              <Board editingMode={false} boardRef={{ current: null }} />
            )}
            <MoveControls />
          </TreeStateProvider>
        </MantineProvider>
      </Provider>,
    ),
  );
}
beforeEach(() => {
  engine.enabled = false;
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

test("rendered arrows give chooser candidates priority over engines and suppress ordinary variations only while open", () => {
  engine.enabled = true;
  render();
  const stored = { orig: "a1", dest: "a3", brush: "green" } as const;
  act(() => tree.getState().setShapes([stored]));
  const closed = boardConfig.drawable!.autoShapes!;
  expect(closed.map((shape) => shape.brush)).toEqual([
    "blue",
    "paleBlue",
    "variation",
    "variation",
    "green",
  ]);
  press("ArrowRight");
  expect(boardConfig.drawable!.autoShapes).toEqual([
    { orig: "e2", dest: "e4", brush: "continuationSelected" },
    { orig: "d2", dest: "d4", brush: "continuationOther" },
    { orig: "c2", dest: "c4", brush: "continuationOther" },
    closed[1],
    stored,
  ]);
  expect(boardConfig.drawable!.brushes).toBe(continuationBrushes);
  expect(continuationBrushes.continuationSelected.opacity).toBe(1);
  expect(continuationBrushes.continuationOther.opacity).toBeLessThan(
    continuationBrushes.continuationSelected.opacity,
  );
  expect(continuationBrushes.continuationOther.lineWidth).toBeLessThan(
    continuationBrushes.continuationSelected.lineWidth,
  );
  press("ArrowDown");
  expect(
    boardConfig.drawable!.autoShapes!.find((shape) => shape.brush === "continuationSelected"),
  ).toEqual({ orig: "d2", dest: "d4", brush: "continuationSelected" });
  press("ArrowUp");
  expect(boardConfig.drawable!.autoShapes![0].brush).toBe("continuationSelected");
  press("Escape");
  expect(boardConfig.drawable!.autoShapes).toEqual(closed);
});

test("arrows use a transposed node's candidate moves rather than the leaf's direct children", () => {
  const initial = initialTree();
  const targetStore = createTreeStore();
  targetStore.getState().makeMove({ payload: "e4" });
  for (const san of ["e5", "c5", "e6"]) {
    targetStore.getState().makeMove({ payload: san });
    targetStore.getState().goToPrevious();
  }
  const target = targetStore.getState().currentNode();
  const rootNode = {
    ...initial.root,
    children: [target, fixtureNode("leaf", { fen: target.fen })],
  };
  render({ ...initial, root: rootNode, position: [1] });
  press("ArrowRight");
  expect(boardConfig.drawable!.autoShapes).toHaveLength(3);
  expect(boardConfig.drawable!.autoShapes![1]).toEqual({
    orig: "c7",
    dest: "c5",
    brush: "continuationOther",
  });
});

test("card is a sibling of the grid, hover selects and click plays without showing follow-ups", () => {
  const initial = initialTree();
  render({
    ...initial,
    root: {
      ...initial.root,
      children: initial.root.children.map((child, index) =>
        index === 0 ? { ...child, children: [fixtureNode("e5", { halfMoves: 2 })] } : child,
      ),
    },
  });
  press("ArrowRight");
  const list = host.querySelector('[role="listbox"]')!;
  expect(list.closest('[role="grid"]')).toBeNull();
  expect(list.parentElement!.parentElement).toBe(
    host.querySelector('[role="grid"]')!.parentElement,
  );
  const options = list.querySelectorAll<HTMLElement>('[role="option"]');
  expect([...options].map((row) => row.textContent)).toEqual(["1. e4", "1. d4", "1. c4"]);
  expect(options[0].querySelector("span")!.getAttribute("style")).toContain("font-weight: 600");
  act(() => options[2].dispatchEvent(new MouseEvent("mouseover", { bubbles: true })));
  expect(chooser.getState().choice?.selected).toBe(2);
  expect(options[2].getAttribute("aria-selected")).toBe("true");
  act(() => options[2].click());
  expect(tree.getState().position).toEqual([2]);
  expect(host.querySelector('[role="listbox"]')).toBeNull();
});

test("puzzle board uses the same frame, card and brushes", () => {
  render(initialTree(), true);
  press("ArrowRight");
  const board = host.querySelector('[class*="chessboard"]')!;
  const list = host.querySelector('[role="listbox"]')!;
  expect(list.parentElement!.parentElement).toBe(board.parentElement);
  expect(boardConfig.drawable!.autoShapes).toHaveLength(3);
  expect(boardConfig.drawable!.brushes).toBe(continuationBrushes);
});

test("a child without a move has no arrow", () => {
  expect(childMoveArrow(defaultTree().root, "variation")).toBeNull();
});
