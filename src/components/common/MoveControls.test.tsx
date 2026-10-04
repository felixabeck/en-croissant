import { MantineProvider } from "@mantine/core";
import { Provider } from "jotai";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { createTreeStore, type TreeStore } from "@/state/store/tree";
import { installMatchMediaStub } from "@/tests/matchMedia";
import { installResizeObserverStub } from "@/tests/resizeObserver";
import { fixtureNode } from "@/tests/treeFixtures";
import { defaultTree } from "@/utils/treeReducer";
import { TreeStateContext } from "./TreeStateContext";

const settings = vi.hoisted(() => ({
  chooseVariation: true,
  keys: {
    NEXT_MOVE: "arrowright",
    PREVIOUS_MOVE: "arrowleft",
    GO_TO_BRANCH_START: "arrowup",
    GO_TO_BRANCH_END: "arrowdown",
    GO_TO_START: "shift+arrowup",
    GO_TO_END: "shift+arrowdown",
    NEXT_BRANCH: "c",
    PREVIOUS_BRANCH: "x",
    NEXT_BRANCHING: "shift+arrowright",
    PREVIOUS_BRANCHING: "shift+arrowleft",
    DELETE_MOVE: "delete",
  },
}));

vi.mock("@/state/atoms", async () => {
  const { atom } = await import("jotai");
  return { chooseVariationAtom: atom(() => settings.chooseVariation) };
});
vi.mock("@/state/keybinds", async () => {
  const { atom } = await import("jotai");
  return {
    keyMapAtom: atom(() =>
      Object.fromEntries(
        Object.entries(settings.keys).map(([id, value]) => [id, { name: id, keys: value }]),
      ),
    ),
  };
});
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@/utils/sound", () => ({ playSound: vi.fn() }));

import MoveControls from "./MoveControls";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
installMatchMediaStub();
installResizeObserverStub();

let host: HTMLDivElement;
let root: Root;
let store: TreeStore;

// 1.e4 (1.d4) (1.c4) e5 — a three-way branch at the root, then a single continuation.
function branchingStore() {
  const tree = defaultTree();
  tree.root.children = [
    fixtureNode("e4", { children: [fixtureNode("e5", { halfMoves: 2 })] }),
    fixtureNode("d4"),
    fixtureNode("c4"),
  ];
  return createTreeStore(undefined, tree);
}

function middleGameStore() {
  const tree = defaultTree();
  tree.root.children = [
    fixtureNode("e4", {
      children: [fixtureNode("e5", { halfMoves: 2 }), fixtureNode("c5", { halfMoves: 2 })],
    }),
  ];
  tree.position = [0];
  return createTreeStore(undefined, tree);
}

function press(key: string, { shiftKey = false, ctrlKey = false } = {}) {
  const code = key.length === 1 ? `Key${key.toUpperCase()}` : key;
  act(() => {
    document.dispatchEvent(
      new KeyboardEvent("keydown", { key, code, shiftKey, ctrlKey, bubbles: true }),
    );
    document.dispatchEvent(
      new KeyboardEvent("keyup", { key, code, shiftKey, ctrlKey, bubbles: true }),
    );
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
  settings.keys.GO_TO_BRANCH_START = "arrowup";
  settings.keys.GO_TO_BRANCH_END = "arrowdown";
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
  store = middleGameStore();
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

test("arrow down wraps from the last variation back to the main line", () => {
  render();
  press("ArrowRight");

  press("ArrowDown");
  press("ArrowDown");
  expect(options().map((option) => option.selected)).toEqual([false, false, true]);
  press("ArrowDown");

  expect(options().map((option) => option.selected)).toEqual([true, false, false]);
  expect(store.getState().position).toEqual([]);
});

test.each(["ArrowLeft", "Escape"])(
  "%s closes the list in the middle of a game without moving",
  (key) => {
    store = middleGameStore();
    render();
    press("ArrowRight");
    expect(options()).toHaveLength(2);

    press(key);

    expect(options()).toEqual([]);
    expect(store.getState().position).toEqual([0]);
  },
);

test.each([
  { key: "ArrowUp", shiftKey: true },
  { key: "c", shiftKey: false },
])("$key closes the list even when navigation stays at the branching root", ({ key, shiftKey }) => {
  render();
  press("ArrowRight");
  expect(options()).toHaveLength(3);

  press(key, { shiftKey });

  expect(options()).toEqual([]);
  expect(store.getState().position).toEqual([]);
});

test("navigating away and back to the same node never resurrects the list", () => {
  render();
  press("ArrowRight");
  expect(options()).toHaveLength(3);

  act(() => store.getState().goToMove([0]));
  expect(options()).toEqual([]);
  act(() => store.getState().goToMove([]));

  expect(options()).toEqual([]);
  expect(store.getState().position).toEqual([]);
});

test("a rebound branch-end key closes the list and navigates to the branch end", () => {
  settings.keys.GO_TO_BRANCH_END = "j";
  render();
  press("ArrowRight");
  expect(options()).toHaveLength(3);

  press("j");

  expect(options()).toEqual([]);
  expect(store.getState().position).toEqual([0, 0]);
});

test.each([
  { binding: "k", key: "k", modifiers: undefined },
  { binding: "ctrl+arrowup", key: "ArrowUp", modifiers: { ctrlKey: true } },
])(
  "a branch-start key bound to $binding closes the list and navigates to the branch start",
  ({ binding, key, modifiers }) => {
    settings.keys.GO_TO_BRANCH_START = binding;
    store = middleGameStore();
    render();
    press("ArrowRight");
    expect(options()).toHaveLength(2);
    expect(store.getState().position).toEqual([0]);

    press(key, modifiers);

    expect(options()).toEqual([]);
    expect(store.getState().position).toEqual([]);
  },
);

test("replacing the root closes the list without moving the cursor", () => {
  store = middleGameStore();
  render();
  press("ArrowRight");
  expect(options()).toHaveLength(2);
  const previous = store.getState();

  act(() => store.getState().setComment("x"));

  expect(store.getState().root).not.toBe(previous.root);
  expect(store.getState().position).toBe(previous.position);
  expect(store.getState().position).toEqual([0]);
  expect(options()).toEqual([]);
});

test("a transposed leaf offers every continuation and plays the chosen variation", () => {
  const tree = defaultTree();
  const target = fixtureNode("e4", {
    children: [
      fixtureNode("e5", { halfMoves: 2 }),
      fixtureNode("c5", { halfMoves: 2 }),
      fixtureNode("e6", { halfMoves: 2 }),
    ],
  });
  tree.root.children = [target, fixtureNode("leaf", { fen: target.fen })];
  tree.position = [1];
  store = createTreeStore(undefined, tree);
  render();

  press("ArrowRight");

  expect(store.getState().position).toEqual([1]);
  expect(options()).toEqual([
    { text: "1... e5", selected: true },
    { text: "1... c5", selected: false },
    { text: "1... e6", selected: false },
  ]);
  press("ArrowDown");
  press("ArrowRight");

  expect(options()).toEqual([]);
  expect(store.getState().position).toEqual([0, 1]);
});
