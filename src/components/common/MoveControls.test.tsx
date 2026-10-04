import { MantineProvider } from "@mantine/core";
import { parseUci } from "chessops";
import { Provider } from "jotai";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { createTreeStore, type TreeStore } from "@/state/store/tree";
import { installMatchMediaStub } from "@/tests/matchMedia";
import { createNode, defaultTree, type TreeNode } from "@/utils/treeReducer";
import { TreeStateContext } from "./TreeStateContext";

const settings = vi.hoisted(() => ({ chooseVariation: true }));

vi.mock("@/state/atoms", async () => {
  const { atom } = await import("jotai");
  return { chooseVariationAtom: atom(() => settings.chooseVariation) };
});
vi.mock("@/state/keybinds", async () => {
  const { atom } = await import("jotai");
  const keys = {
    NEXT_MOVE: "arrowright",
    PREVIOUS_MOVE: "arrowleft",
    GO_TO_BRANCH_START: "arrowup",
    GO_TO_BRANCH_END: "arrowdown",
    GO_TO_START: "shift+arrowup",
    GO_TO_END: "shift+down",
    NEXT_BRANCH: "c",
    PREVIOUS_BRANCH: "x",
    NEXT_BRANCHING: "shift+arrowright",
    PREVIOUS_BRANCHING: "shift+arrowleft",
    DELETE_MOVE: "delete",
  };
  return {
    keyMapAtom: atom(
      Object.fromEntries(
        Object.entries(keys).map(([id, value]) => [id, { name: id, keys: value }]),
      ),
    ),
  };
});
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@/utils/sound", () => ({ playSound: vi.fn() }));

import MoveControls from "./MoveControls";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
installMatchMediaStub();
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

let host: HTMLDivElement;
let root: Root;
let store: TreeStore;

function node(san: string, halfMoves: number, children: TreeNode[] = []): TreeNode {
  const result = createNode({
    fen: `${san} w - - 0 1`,
    move: parseUci("e2e4")!,
    san,
    halfMoves,
  });
  result.children = children;
  return result;
}

// 1.e4 (1.d4) (1.c4) e5 — a three-way branch at the root, then a single continuation.
function branchingStore() {
  const tree = defaultTree();
  tree.root.children = [node("e4", 1, [node("e5", 2)]), node("d4", 1), node("c4", 1)];
  return createTreeStore(undefined, tree);
}

function press(key: string) {
  act(() => {
    document.dispatchEvent(new KeyboardEvent("keydown", { key, code: key, bubbles: true }));
    document.dispatchEvent(new KeyboardEvent("keyup", { key, code: key, bubbles: true }));
  });
}

function options() {
  return [...document.querySelectorAll('[role="option"]')].map((option) => ({
    text: option.textContent,
    selected: option.getAttribute("aria-selected") === "true",
  }));
}

function render() {
  act(() => {
    root.render(
      // A fresh jotai store per render, so the setting is read anew in every case.
      <Provider>
        <MantineProvider env="test">
          <TreeStateContext.Provider value={store}>
            <MoveControls />
          </TreeStateContext.Provider>
        </MantineProvider>
      </Provider>,
    );
  });
}

beforeEach(() => {
  settings.chooseVariation = true;
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  store = branchingStore();
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

test("next move at a branch lists every continuation, main line first, without moving", () => {
  render();

  press("ArrowRight");

  expect(store.getState().position).toEqual([]);
  expect(options()).toEqual([
    { text: "1. e4", selected: true },
    { text: "1. d4", selected: false },
    { text: "1. c4", selected: false },
  ]);
});

test("arrow down then next move plays the selected variation and closes the list", () => {
  render();

  press("ArrowRight");
  press("ArrowDown");
  press("ArrowDown");
  expect(options().map((option) => option.selected)).toEqual([false, false, true]);
  press("ArrowRight");

  expect(store.getState().position).toEqual([2]);
  expect(options()).toEqual([]);
});

test("arrow up wraps to the last variation and never jumps to the branch start", () => {
  const tree = defaultTree();
  tree.root.children = [node("e4", 1, [node("e5", 2), node("c5", 2)])];
  store = createTreeStore(undefined, tree);
  store.getState().goToMove([0]);
  render();

  press("ArrowRight");
  press("ArrowUp");
  expect(store.getState().position).toEqual([0]);
  press("ArrowRight");

  expect(store.getState().position).toEqual([0, 1]);
});

test("previous move closes the list without moving, and a single continuation never opens it", () => {
  render();

  press("ArrowRight");
  press("ArrowLeft");
  expect(options()).toEqual([]);
  expect(store.getState().position).toEqual([]);

  press("ArrowRight");
  press("ArrowRight");
  press("ArrowRight");
  expect(store.getState().position).toEqual([0, 0]);
  expect(options()).toEqual([]);
});

test("with the setting off, next move follows the main line as before", () => {
  settings.chooseVariation = false;
  render();

  press("ArrowRight");

  expect(store.getState().position).toEqual([0]);
  expect(options()).toEqual([]);
});

test("a practice drill keeps following its own path", () => {
  store.getState().setPracticePath([1]);
  render();

  press("ArrowRight");

  expect(store.getState().position).toEqual([1]);
  expect(options()).toEqual([]);
});
