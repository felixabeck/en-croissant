import { MantineProvider } from "@mantine/core";
import { Provider, createStore } from "jotai";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeAll, beforeEach, expect, test, vi } from "vitest";
import { INITIAL_FEN } from "chessops/fen";
import type { Key } from "@lichess-org/chessground/types";
import type { Config } from "@lichess-org/chessground/config";
import { TreeStateContext, VariationChooserContext } from "@/components/common/TreeStateContext";
import { createTreeStore } from "@/state/store/tree";
import { createVariationChooserStore } from "@/state/store/variationChooser";
import { jumpToNextPuzzleAtom } from "@/state/atoms";
import { defaultTree } from "@/utils/treeReducer";
import type { Puzzle } from "@/utils/puzzles";
import { installMatchMediaStub } from "@/tests/matchMedia";
import i18n from "@/i18n";
import enUSCatalogue from "@/translation/en-US.json";
import PuzzleBoard from "./PuzzleBoard";

const mocks = vi.hoisted(() => ({
  afterMove: undefined as ((orig: Key, dest: Key) => void) | undefined,
  notify: vi.fn(),
  playSound: vi.fn(),
  board: null as Config | null,
}));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@mantine/notifications", () => ({ notifications: { show: mocks.notify } }));
vi.mock("@/utils/sound", () => ({ playSound: mocks.playSound }));
vi.mock("@/chessground/Chessground", () => ({
  Chessground: (props: Config) => {
    mocks.board = props;
    mocks.afterMove = (orig, dest) =>
      props.movable?.events?.after?.(orig, dest, { premove: false });
    return <div data-testid="board" />;
  },
}));
vi.mock("@/components/boards/BoardFrame", () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
installMatchMediaStub({ matches: () => true, media: (query) => query });
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
Object.defineProperty(window, "ResizeObserver", { writable: true, value: ResizeObserverStub });

let root: Root;
let host: HTMLDivElement;
beforeAll(async () => {
  await i18n.init({
    lng: "en-US",
    fallbackLng: "en-US",
    resources: { "en-US": { translation: enUSCatalogue.translation } },
  });
});
beforeEach(() => {
  vi.resetAllMocks();
  mocks.board = null;
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});

async function renderBoard(moves: string[], jump = false, fen = INITIAL_FEN, initialFen = fen) {
  const store = createTreeStore(undefined, defaultTree(initialFen));
  const atoms = createStore();
  atoms.set(jumpToNextPuzzleAtom, jump);
  const changeCompletion = vi.fn().mockResolvedValue(undefined);
  const generatePuzzle = vi.fn().mockResolvedValue(undefined);
  const puzzle: Puzzle = {
    id: 1,
    fen,
    moves,
    completion: "incomplete",
    rating: 1200,
    rating_deviation: 50,
    popularity: 1,
    nb_plays: 1,
  };
  await act(async () =>
    root.render(
      <MantineProvider>
        <Provider store={atoms}>
          <TreeStateContext.Provider value={store}>
            <VariationChooserContext.Provider value={createVariationChooserStore()}>
              <PuzzleBoard
                puzzles={[puzzle]}
                currentPuzzle={0}
                changeCompletion={changeCompletion}
                generatePuzzle={generatePuzzle}
                db={{ id: "puzzle-db" }}
              />
            </VariationChooserContext.Provider>
          </TreeStateContext.Provider>
        </Provider>
      </MantineProvider>,
    ),
  );
  return { store, changeCompletion, generatePuzzle };
}

test.each(["malformed", "e7e4"])(
  "PuzzleBoard reports rejected reply %s with no partial pair",
  async (reply) => {
    const { store, changeCompletion, generatePuzzle } = await renderBoard(["e2e4", reply]);
    const before = store.getState();
    await act(async () => mocks.afterMove!("e2", "e4"));
    expect(store.getState()).toBe(before);
    expect(store.getState()).toEqual(before);
    expect(mocks.playSound).not.toHaveBeenCalled();
    expect(mocks.notify).toHaveBeenCalledWith(
      expect.objectContaining({
        color: "red",
        title: "Common.Error",
        message: `${enUSCatalogue.translation["MoveInput.InvalidMove"]} (2)`,
      }),
    );
    expect(mocks.notify.mock.calls[0][0].message).not.toContain(reply);
    expect(changeCompletion).not.toHaveBeenCalled();
    expect(generatePuzzle).not.toHaveBeenCalled();
  },
);

test("PuzzleBoard applies a correct pair with one sound and no premature completion", async () => {
  const { store, changeCompletion } = await renderBoard(["e2e4", "e7e5", "g1f3"]);
  await act(async () => mocks.afterMove!("e2", "e4"));
  expect(store.getState().position).toEqual([0, 0]);
  expect(store.getState().currentNode().san).toBe("e5");
  expect(mocks.playSound).toHaveBeenCalledOnce();
  expect(changeCompletion).not.toHaveBeenCalled();
  expect(mocks.notify).not.toHaveBeenCalled();
});

test.each([false, true])(
  "PuzzleBoard completes the final correct move with jump %s",
  async (jump) => {
    const { store, changeCompletion, generatePuzzle } = await renderBoard(["e2e4"], jump);
    await act(async () => mocks.afterMove!("e2", "e4"));
    expect(changeCompletion).toHaveBeenCalledExactlyOnceWith("correct", expect.any(Function));
    expect(store.getState().position).toEqual([0]);
    expect(mocks.playSound).toHaveBeenCalledOnce();
    expect(generatePuzzle).toHaveBeenCalledTimes(jump ? 1 : 0);
    expect(mocks.notify).not.toHaveBeenCalled();
  },
);

test("PuzzleBoard records a wrong move without moving the cursor and marks incorrect once", async () => {
  const { store, changeCompletion } = await renderBoard(["e2e4", "e7e5"]);
  await act(async () => mocks.afterMove!("d2", "d4"));
  expect(store.getState().position).toEqual([]);
  expect(store.getState().root.children[0].san).toBe("d4");
  expect(changeCompletion).toHaveBeenCalledExactlyOnceWith("incorrect", expect.any(Function));
  await act(async () => mocks.afterMove!("d2", "d4"));
  expect(changeCompletion).toHaveBeenCalledOnce();
  expect(mocks.notify).not.toHaveBeenCalled();
});

test("PuzzleBoard ignores stale completion after the live position changes", async () => {
  const { store, changeCompletion } = await renderBoard(["e2e4"]);
  let before = store.getState();
  changeCompletion.mockImplementationOnce(async () => {
    const committed = store.getState();
    expect(committed.currentNode().san).toBe("e4");
    store.getState().makeMove({ payload: "e5" });
    before = store.getState();
    expect(before).not.toBe(committed);
    expect(before.position).toEqual([0, 0]);
    mocks.playSound.mockClear();
  });
  await act(async () => mocks.afterMove!("e2", "e4"));
  expect(store.getState()).toBe(before);
  expect(mocks.playSound).not.toHaveBeenCalled();
  expect(mocks.notify).not.toHaveBeenCalled();
});

test.each([
  ["malformed FEN", "invalid"],
  ["invalid chess setup", "8/8/8/8/8/8/8/8 w - - 0 1"],
  ["unrelated Black-to-move root", "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR b KQkq - 0 23"],
])(
  "PuzzleBoard safely renders %s and refuses an incorrect attempt on the prior tree",
  async (_name, fen) => {
    const { store, changeCompletion, generatePuzzle } = await renderBoard(
      ["e7e5", "g1z3"],
      false,
      fen,
      INITIAL_FEN,
    );
    const before = store.getState();
    expect(mocks.board?.movable?.color).toBeUndefined();
    await act(async () => mocks.afterMove!("e2", "e4"));
    expect(store.getState()).toBe(before);
    expect(store.getState()).toEqual(before);
    expect(changeCompletion).not.toHaveBeenCalled();
    expect(generatePuzzle).not.toHaveBeenCalled();
    expect(mocks.playSound).not.toHaveBeenCalled();
    expect(mocks.notify).not.toHaveBeenCalled();
  },
);

test("PuzzleBoard preserves the valid Black-to-move orientation and legal pair", async () => {
  const fen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR b KQkq - 0 23";
  const { store, changeCompletion } = await renderBoard(["e7e5", "g1f3"], false, fen);
  expect(mocks.board?.orientation).toBe("white");
  expect(mocks.board?.movable?.color).toBe("black");
  await act(async () => mocks.afterMove!("e7", "e5"));
  expect(store.getState().position).toEqual([0, 0]);
  expect(store.getState().currentNode().san).toBe("Nf3");
  expect(changeCompletion).not.toHaveBeenCalled();
  expect(mocks.playSound).toHaveBeenCalledOnce();
  expect(mocks.notify).not.toHaveBeenCalled();
});

test("PuzzleBoard rejects a malformed selected sequence before recording a wrong move", async () => {
  const { store, changeCompletion } = await renderBoard(["e2e4", "g7z5"]);
  const before = store.getState();
  await act(async () => mocks.afterMove!("d2", "d4"));
  expect(store.getState()).toBe(before);
  expect(changeCompletion).not.toHaveBeenCalled();
  expect(mocks.playSound).not.toHaveBeenCalled();
  expect(mocks.notify).toHaveBeenCalledExactlyOnceWith({
    color: "red",
    title: "Common.Error",
    message: `${enUSCatalogue.translation["MoveInput.InvalidMove"]} (2)`,
  });
});
