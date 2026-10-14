import { WorkspaceTabScope } from "@/state/tabScope";
import { MantineProvider } from "@mantine/core";
import { Provider, createStore } from "jotai";
import { act, useContext, type ComponentProps } from "react";
import type { Config } from "@lichess-org/chessground/config";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import type {
  ErrorCategory,
  Puzzle as NativePuzzle,
  PuzzleDatabaseInfo,
  PuzzleRootDescriptor,
} from "@/bindings";
import { TreeStateContext, TreeStateProvider } from "@/components/common/TreeStateContext";
import type { TreeStore } from "@/state/store/tree";
import { INITIAL_FEN } from "chessops/fen";
import type { Puzzle } from "@/utils/puzzles";
import type { TreeState } from "@/utils/treeReducer";
import {
  puzzleTimerFamily,
  currentPuzzleFamily,
  jumpToNextPuzzleAtom,
  puzzleRatingRangeAtom,
  puzzleThemeAtom,
  puzzleWorkspaceGenerationAtom,
  selectedPuzzleDbAtom,
  trackPuzzleTimeAtom,
} from "@/state/atoms";
import { TauriCommandError } from "@/platform/tauri";
import { installMatchMediaStub } from "@/tests/matchMedia";
import Puzzles from "./Puzzles";

const mocks = vi.hoisted(() => ({
  getPuzzleWorkspace: vi.fn(),
  listPuzzleDatabases: vi.fn(),
  getPuzzleThemes: vi.fn(),
  getPuzzle: vi.fn(),
  getSoundServerPort: vi.fn(),
  deletePuzzleDatabase: vi.fn(),
  getThemesForPuzzle: vi.fn(),
  notificationShow: vi.fn(),
  playSound: vi.fn(),
  board: null as Config | null,
  selectedDatabase: null as string | null,
}));

vi.mock("@/utils/sound", () => ({ playSound: mocks.playSound }));

vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@/i18n", async (original) => ({
  ...(await original<typeof import("@/i18n")>()),
  default: {
    t: (key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? key,
  },
}));
vi.mock("@/platform/tauri", async () => {
  const actual = await vi.importActual<typeof import("@/platform/tauri")>("@/platform/tauri");
  return {
    ...actual,
    tauri: {
      getPuzzleWorkspace: mocks.getPuzzleWorkspace,
      listPuzzleDatabases: mocks.listPuzzleDatabases,
      getPuzzleThemes: mocks.getPuzzleThemes,
      getPuzzle: mocks.getPuzzle,
      getSoundServerPort: mocks.getSoundServerPort,
      deletePuzzleDatabase: mocks.deletePuzzleDatabase,
      getThemesForPuzzle: mocks.getThemesForPuzzle,
    },
  };
});
vi.mock("@mantine/notifications", () => ({
  notifications: { show: mocks.notificationShow },
}));
vi.mock("@/chessground/Chessground", () => ({
  Chessground: (props: Config) => {
    mocks.board = props;
    return (
      <div
        data-testid="actual-puzzle-board"
        data-fen={props.fen}
        data-orientation={props.orientation}
      />
    );
  },
}));
vi.mock("@/components/boards/BoardFrame", () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock("@mantine/core", async (original) => {
  const actual = await original<typeof import("@mantine/core")>();
  return {
    ...actual,
    Select: (props: ComponentProps<typeof actual.Select>) => {
      if (props.placeholder === "Puzzle.SelectDatabase")
        mocks.selectedDatabase = props.value ?? null;
      return <actual.Select {...props} />;
    },
  };
});
vi.mock("./AddPuzzle", () => ({
  default: ({ puzzleDbs }: { puzzleDbs: unknown[] }) => (
    <div data-testid="puzzle-database-count">{puzzleDbs.length}</div>
  ),
}));
vi.mock("../common/ConfirmModal", () => ({
  default: ({ opened, onConfirm }: { opened: boolean; onConfirm: () => Promise<void> }) =>
    opened ? (
      <button type="button" data-testid="confirm-delete" onClick={() => void onConfirm()}>
        confirm
      </button>
    ) : null,
}));
vi.mock("../common/GameNotation", () => ({ default: () => null }));
vi.mock("../common/MoveControls", () => ({ default: () => null }));
vi.mock("../common/ChallengeHistory", async (original) => {
  const actual = await original<typeof import("../common/ChallengeHistory")>();
  return {
    default: (props: ComponentProps<typeof actual.default>) => (
      <div
        data-testid="puzzle-state"
        data-count={props.challenges.length}
        data-current={props.current}
        data-database={mocks.selectedDatabase ?? "none"}
        data-themes={((props.challenges[0] as Puzzle | undefined)?.themes ?? []).join(",")}
      >
        <actual.default {...props} />
      </div>
    ),
  };
});

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
installMatchMediaStub({
  matches: (query) => query.includes("prefers-reduced-motion"),
  media: (query) => query,
});
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
Object.defineProperty(window, "ResizeObserver", {
  writable: true,
  value: ResizeObserverStub,
});
Object.defineProperty(Element.prototype, "scrollIntoView", {
  configurable: true,
  value: () => undefined,
});

const selectedDb = { id: "puzzle-db-1" };
const selectedDatabase: PuzzleDatabaseInfo = {
  title: "Tactics.db3",
  description: "Tactics",
  puzzleCount: 1,
  storageSize: 1n,
  path: selectedDb,
};
const otherDb = { id: "puzzle-db-2" };
const otherDatabase: PuzzleDatabaseInfo = {
  ...selectedDatabase,
  title: "Other.db3",
  path: otherDb,
};
const workspace: PuzzleRootDescriptor = {
  root: { id: { id: "puzzle-root" }, kind: "puzzleRoot" },
  displayName: "Puzzles",
};
const otherWorkspace: PuzzleRootDescriptor = {
  root: { id: { id: "other-puzzle-root" }, kind: "puzzleRoot" },
  displayName: "Other puzzles",
};

function solutionButton() {
  return [...document.querySelectorAll<HTMLButtonElement>("button")].find(
    (button) => button.textContent === "Puzzle.ViewSolution",
  )!;
}

function hintButton() {
  return [...document.querySelectorAll<HTMLButtonElement>("button")].find(
    (button) => button.textContent === "Puzzle.GetAHint",
  )!;
}

function puzzleRow(overrides: Partial<Puzzle> = {}): Puzzle {
  return {
    id: 10,
    fen: INITIAL_FEN,
    moves: ["e2e4", "e7e5"],
    completion: "incomplete",
    rating: 1200,
    rating_deviation: 50,
    popularity: 1,
    nb_plays: 1,
    ...overrides,
  };
}

function storedPuzzles(): Puzzle[] {
  return JSON.parse(sessionStorage.getItem("puzzles-test-puzzles") ?? "[]");
}

async function newPuzzle() {
  await act(async () => {
    document.querySelector<HTMLButtonElement>('[aria-label="Puzzle.NewPuzzle"]')!.click();
  });
}

async function loadPlaybackPuzzle(moves = "e2e4 e7e5 g1f3") {
  mocks.getPuzzle.mockResolvedValue({
    id: 10,
    fen: INITIAL_FEN,
    moves,
    rating: 1200,
    rating_deviation: 50,
    popularity: 1,
    nb_plays: 1,
  });
  const atoms = await renderPuzzles();
  await act(async () => atoms.set(trackPuzzleTimeAtom, false));
  await act(async () => {
    document.querySelector<HTMLButtonElement>('[aria-label="Puzzle.NewPuzzle"]')!.click();
  });
  expect(document.querySelector('[data-testid="puzzle-state"]')?.getAttribute("data-count")).toBe(
    "1",
  );
  return atoms;
}

test.each([
  ["malformed middle", "e2e4 g7z5 g1f3", 2, "g7z5"],
  ["malformed suffix", "e2e4 e7e5 g1z3", 3, "g1z3"],
  ["illegal middle", "e2e4 e7e4 g1f3", 2, "e7e4"],
  ["illegal suffix", "e2e4 e7e5 g1g3", 3, "g1g3"],
] as const)(
  "View solution rejects persisted %s without mutation or sound",
  async (_name, moves, index, token) => {
    sessionStorage.setItem(
      "puzzles-test-puzzles",
      JSON.stringify([puzzleRow({ moves: moves.split(" ") })]),
    );
    await renderPuzzles();
    expect(mocks.notificationShow).not.toHaveBeenCalled();
    expect(treeStore.getState().root.children).toEqual([]);
    expect(treeStore.getState().dirty).toBe(false);
    const before = treeStore.getState();
    mocks.notificationShow.mockClear();
    mocks.playSound.mockClear();
    await act(async () => solutionButton().click());
    expect(treeStore.getState()).toBe(before);
    expect(treeStore.getState()).toEqual(before);
    expect(mocks.playSound).not.toHaveBeenCalled();
    expect(mocks.notificationShow).toHaveBeenCalledOnce();
    expect(mocks.notificationShow).toHaveBeenCalledWith(
      expect.objectContaining({
        message: `MoveInput.InvalidMove (${index})`,
      }),
    );
    expect(mocks.notificationShow.mock.calls[0][0].message).not.toContain(token);
    expect(mocks.getThemesForPuzzle).not.toHaveBeenCalled();
    await act(async () => solutionButton().click());
    expect(mocks.notificationShow).toHaveBeenCalledTimes(2);
    expect(treeStore.getState()).toBe(before);
  },
);

test("View solution preserves 500 ms playback and normal completion", async () => {
  await loadPlaybackPuzzle();
  vi.useFakeTimers();
  mocks.playSound.mockClear();
  await act(async () => solutionButton().click());
  expect(treeStore.getState().position).toEqual([0]);
  expect(hintButton().disabled).toBe(true);
  expect(mocks.getThemesForPuzzle).toHaveBeenCalledOnce();
  await act(async () => vi.advanceTimersByTimeAsync(499));
  expect(treeStore.getState().position).toEqual([0]);
  await act(async () => vi.advanceTimersByTimeAsync(1));
  expect(treeStore.getState().position).toEqual([0, 0]);
  await act(async () => vi.advanceTimersByTimeAsync(1000));
  expect(treeStore.getState().position).toEqual([0, 0, 0]);
  expect(treeStore.getState().currentNode().san).toBe("Nf3");
  expect(mocks.playSound).toHaveBeenCalledTimes(3);
  expect(mocks.notificationShow).not.toHaveBeenCalled();
  expect(vi.getTimerCount()).toBe(0);
});

test("View solution reports a thrown store subscriber and releases playing ownership", async () => {
  await loadPlaybackPuzzle();
  const unsubscribe = treeStore.subscribe((state) => {
    if (state.currentNode().move) throw new Error("playback subscriber failed");
  });
  try {
    await act(async () => solutionButton().click());
    expect(mocks.notificationShow).toHaveBeenCalledWith(
      expect.objectContaining({
        color: "red",
        message: "playback subscriber failed",
      }),
    );
    expect(hintButton().disabled).toBe(false);
  } finally {
    unsubscribe();
  }
});

test("a superseded View solution cannot clear or advance its successor", async () => {
  await loadPlaybackPuzzle();
  vi.useFakeTimers();
  await act(async () => solutionButton().click());
  await act(async () => vi.advanceTimersByTimeAsync(250));
  await act(async () => solutionButton().click());
  const successor = treeStore.getState();
  mocks.playSound.mockClear();
  await act(async () => vi.advanceTimersByTimeAsync(250));
  expect(treeStore.getState()).toBe(successor);
  expect(mocks.playSound).not.toHaveBeenCalled();
  expect(hintButton().disabled).toBe(true);
  await act(async () => vi.advanceTimersByTimeAsync(250));
  expect(treeStore.getState().position).toEqual([0, 0]);
  expect(hintButton().disabled).toBe(true);
  await act(async () => vi.advanceTimersByTimeAsync(1000));
  expect(treeStore.getState().position).toEqual([0, 0, 0]);
  expect(mocks.notificationShow).not.toHaveBeenCalled();
});

test("a stale thrown playback cannot notify or clear its replacement's playing state", async () => {
  await loadPlaybackPuzzle();
  vi.useFakeTimers();
  let replaced = false;
  const unsubscribe = treeStore.subscribe((state) => {
    if (!replaced && state.position.length === 1) {
      replaced = true;
      solutionButton().dispatchEvent(new MouseEvent("click", { bubbles: true }));
      throw new Error("stale playback subscriber failed");
    }
  });
  try {
    await act(async () => solutionButton().click());
    expect(replaced).toBe(true);
    expect(hintButton().disabled).toBe(true);
    expect(mocks.notificationShow).not.toHaveBeenCalled();
    await act(async () => vi.advanceTimersByTimeAsync(500));
    expect(treeStore.getState().position).toEqual([0, 0]);
    expect(hintButton().disabled).toBe(true);
    await act(async () => vi.advanceTimersByTimeAsync(1000));
    expect(treeStore.getState().position).toEqual([0, 0, 0]);
    expect(mocks.notificationShow).not.toHaveBeenCalled();
  } finally {
    unsubscribe();
  }
});

test.each(["new puzzle", "database", "unmount"] as const)(
  "%s cancels View solution without late moves or errors",
  async (replacement) => {
    const atoms = await loadPlaybackPuzzle();
    vi.useFakeTimers();
    await act(async () => solutionButton().click());
    await act(async () => {
      if (replacement === "new puzzle") {
        document.querySelector<HTMLButtonElement>('[aria-label="Puzzle.NewPuzzle"]')!.click();
      } else if (replacement === "database") {
        atoms.set(selectedPuzzleDbAtom, otherDb);
      } else {
        root.unmount();
      }
    });
    const before = treeStore.getState();
    mocks.playSound.mockClear();
    mocks.notificationShow.mockClear();
    await act(async () => vi.advanceTimersByTimeAsync(2000));
    expect(treeStore.getState()).toBe(before);
    expect(mocks.playSound).not.toHaveBeenCalled();
    expect(mocks.notificationShow).not.toHaveBeenCalled();
  },
);

function commandError(category: ErrorCategory, message: string) {
  return new TauriCommandError({
    tag: "backend-error",
    category,
    message,
  });
}

const blackPuzzleFen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR b KQkq - 0 23";
const rejectedCandidates = [
  ["malformed FEN", { fen: "invalid", moves: ["e2e4"] }, "Board.Analysis.InvalidPosition"],
  [
    "invalid setup",
    { fen: "8/8/8/8/8/8/8/8 w - - 0 1", moves: ["e2e4"] },
    "Board.Analysis.InvalidPosition",
  ],
  [
    "Black-to-move illegal suffix",
    { fen: blackPuzzleFen, moves: ["e7e5", "g1g3"] },
    "MoveInput.InvalidMove (2)",
  ],
  [
    "Black-to-move malformed suffix",
    { fen: blackPuzzleFen, moves: ["e7e5", "g1z3"] },
    "MoveInput.InvalidMove (2)",
  ],
] as const;

async function renderPriorPuzzle(rows: Puzzle[], index = 0, line = ["e4", "e5", "Nf3"]) {
  sessionStorage.setItem("puzzles-test-puzzles", JSON.stringify(rows));
  const atoms = await renderPuzzles();
  await act(async () => {
    atoms.set(currentPuzzleFamily("puzzles-test"), index);
    treeStore.getState().makeMoves({ payload: line });
    treeStore.getState().goToMove([0]);
    treeStore.getState().setStart([0]);
    treeStore.getState().setPracticePath(line.length > 1 ? [0, 0] : [0]);
    treeStore.getState().setResult("1-0");
    treeStore.getState().save();
    atoms.set(puzzleTimerFamily("puzzles-test"), 1234);
  });
  mocks.playSound.mockClear();
  mocks.notificationShow.mockClear();
  return atoms;
}

test.each(rejectedCandidates)(
  "admission rejects fetched %s before any publication with the real PuzzleBoard",
  async (_name, candidate, message) => {
    const rows = [
      puzzleRow({ id: 1, completion: "correct" }),
      puzzleRow({ id: 2, completion: "correct" }),
    ];
    const atoms = await renderPriorPuzzle(rows, 1);
    const before = treeStore.getState();
    const previousRows = sessionStorage.getItem("puzzles-test-puzzles");
    const previousBoard = mocks.board;
    const treeChanged = vi.fn();
    const indexChanged = vi.fn();
    const timerChanged = vi.fn();
    const unsubscribeTree = treeStore.subscribe(treeChanged);
    const unsubscribeIndex = atoms.sub(currentPuzzleFamily("puzzles-test"), indexChanged);
    const unsubscribeTimer = atoms.sub(puzzleTimerFamily("puzzles-test"), timerChanged);
    const write = vi.spyOn(Storage.prototype, "setItem");
    mocks.getPuzzle.mockResolvedValue({
      ...puzzleRow(),
      ...candidate,
      moves: candidate.moves.join(" "),
    });
    try {
      await newPuzzle();
      expect(sessionStorage.getItem("puzzles-test-puzzles")).toBe(previousRows);
      expect(atoms.get(currentPuzzleFamily("puzzles-test"))).toBe(1);
      expect(atoms.get(puzzleTimerFamily("puzzles-test"))).toBe(1234);
      expect(treeStore.getState()).toBe(before);
      expect(treeStore.getState()).toEqual(before);
      expect(treeChanged).not.toHaveBeenCalled();
      expect(indexChanged).not.toHaveBeenCalled();
      expect(timerChanged).not.toHaveBeenCalled();
      expect(write.mock.calls.filter(([key]) => key === "puzzles-test-puzzles")).toEqual([]);
      expect(mocks.board?.fen).toBe(previousBoard?.fen);
      expect(mocks.board?.orientation).toBe(previousBoard?.orientation);
      expect(mocks.playSound).not.toHaveBeenCalled();
      expect(mocks.getThemesForPuzzle).not.toHaveBeenCalled();
      expect(mocks.notificationShow).toHaveBeenCalledExactlyOnceWith({
        color: "red",
        title: "Common.Error",
        message,
      });
      await act(async () => Promise.resolve());
      expect(mocks.notificationShow).toHaveBeenCalledOnce();
    } finally {
      unsubscribeTree();
      unsubscribeIndex();
      unsubscribeTimer();
      write.mockRestore();
    }
  },
);

test.each(rejectedCandidates)(
  "admission rejects history %s without selecting or installing it",
  async (_name, candidate, message) => {
    const rows = [
      puzzleRow({ completion: "correct" }),
      puzzleRow({ ...candidate, moves: [...candidate.moves], id: 99 }),
    ];
    const atoms = await renderPriorPuzzle(rows);
    const before = treeStore.getState();
    const previousRows = sessionStorage.getItem("puzzles-test-puzzles");
    await act(async () => {
      document
        .querySelector<HTMLButtonElement>('[aria-label="ChallengeHistory.Incomplete"]')!
        .click();
    });
    expect(atoms.get(currentPuzzleFamily("puzzles-test"))).toBe(0);
    expect(atoms.get(puzzleTimerFamily("puzzles-test"))).toBe(1234);
    expect(sessionStorage.getItem("puzzles-test-puzzles")).toBe(previousRows);
    expect(treeStore.getState()).toBe(before);
    expect(mocks.board?.orientation).toBe("black");
    expect(mocks.board?.movable?.color).toBeUndefined();
    await act(async () => mocks.board!.movable!.events!.after!("e7", "e5", { premove: false }));
    expect(treeStore.getState()).toBe(before);
    expect(storedPuzzles()).toEqual(rows);
    expect(mocks.playSound).not.toHaveBeenCalled();
    expect(mocks.getThemesForPuzzle).not.toHaveBeenCalled();
    expect(mocks.notificationShow).toHaveBeenCalledExactlyOnceWith({
      color: "red",
      title: "Common.Error",
      message,
    });
  },
);

test.each(rejectedCandidates)(
  "admission rejects cached next %s after normal current completion",
  async (_name, candidate, message) => {
    const active = puzzleRow();
    const cached = puzzleRow({ ...candidate, moves: [...candidate.moves], id: 99 });
    const atoms = await renderPriorPuzzle([active, cached], 0, ["e4"]);
    await act(async () => atoms.set(jumpToNextPuzzleAtom, true));
    const before = treeStore.getState();
    await act(async () => mocks.board!.movable!.events!.after!("e7", "e5", { premove: false }));
    expect(atoms.get(currentPuzzleFamily("puzzles-test"))).toBe(0);
    expect(atoms.get(puzzleTimerFamily("puzzles-test"))).toBeNull();
    expect(treeStore.getState()).toBe(before);
    expect(storedPuzzles()).toHaveLength(2);
    expect(storedPuzzles()[0].completion).toBe("correct");
    expect(storedPuzzles()[1]).toEqual(cached);
    expect(mocks.getThemesForPuzzle).toHaveBeenCalledOnce();
    expect(mocks.getPuzzle).not.toHaveBeenCalled();
    expect(mocks.playSound).not.toHaveBeenCalled();
    expect(mocks.board?.movable?.color).toBeUndefined();
    expect(mocks.notificationShow).toHaveBeenCalledExactlyOnceWith({
      color: "red",
      title: "Common.Error",
      message,
    });
  },
);

test("admission suppresses a stale malformed fetched row after valid history selection", async () => {
  const valid = puzzleRow({ id: 99, fen: blackPuzzleFen, moves: ["e7e5", "g1f3"] });
  const atoms = await renderPriorPuzzle([puzzleRow({ completion: "correct" }), valid]);
  let resolvePuzzle!: (puzzle: NativePuzzle) => void;
  let signal!: AbortSignal;
  mocks.getPuzzle.mockImplementation(
    (
      _db: unknown,
      _min: unknown,
      _max: unknown,
      _theme: unknown,
      options: { signal: AbortSignal },
    ) => {
      signal = options.signal;
      return new Promise<NativePuzzle>((resolve) => {
        resolvePuzzle = resolve;
      });
    },
  );
  await newPuzzle();
  await act(async () =>
    document
      .querySelector<HTMLButtonElement>('[aria-label="ChallengeHistory.Incomplete"]')!
      .click(),
  );
  expect(signal.aborted).toBe(true);
  expect(atoms.get(currentPuzzleFamily("puzzles-test"))).toBe(1);
  expect(treeStore.getState().root.fen).toBe(blackPuzzleFen);
  expect(treeStore.getState().currentNode().san).toBe("e5");
  expect(mocks.board?.orientation).toBe("white");
  expect(mocks.board?.movable?.color).toBe("white");
  const before = treeStore.getState();
  const previousRows = sessionStorage.getItem("puzzles-test-puzzles");
  mocks.playSound.mockClear();
  await act(async () => resolvePuzzle({ ...valid, fen: "invalid", moves: "e2e4" }));
  expect(treeStore.getState()).toBe(before);
  expect(sessionStorage.getItem("puzzles-test-puzzles")).toBe(previousRows);
  expect(mocks.playSound).not.toHaveBeenCalled();
  expect(mocks.notificationShow).not.toHaveBeenCalled();
});

test("database dropdown cancels a fetched malformed candidate without stale notification", async () => {
  mocks.listPuzzleDatabases.mockResolvedValue([selectedDatabase, otherDatabase]);
  const atoms = await renderPriorPuzzle([puzzleRow({ completion: "correct" })]);
  let resolvePuzzle!: (puzzle: NativePuzzle) => void;
  let signal!: AbortSignal;
  mocks.getPuzzle.mockImplementation(
    (
      _db: unknown,
      _min: unknown,
      _max: unknown,
      _theme: unknown,
      options: { signal: AbortSignal },
    ) => {
      signal = options.signal;
      return new Promise<NativePuzzle>((resolve) => {
        resolvePuzzle = resolve;
      });
    },
  );
  await newPuzzle();
  await act(async () =>
    document.querySelector<HTMLInputElement>('[placeholder="Puzzle.SelectDatabase"]')!.click(),
  );
  await act(async () => {
    [...document.querySelectorAll<HTMLElement>('[role="option"]')]
      .find((option) => option.textContent === "Other")!
      .click();
  });
  expect(atoms.get(selectedPuzzleDbAtom)).toEqual(otherDb);
  expect(signal.aborted).toBe(true);
  const before = treeStore.getState();
  const previousRows = sessionStorage.getItem("puzzles-test-puzzles");
  await act(async () => resolvePuzzle({ ...puzzleRow(), fen: "invalid", moves: "e2e4" }));
  expect(atoms.get(currentPuzzleFamily("puzzles-test"))).toBe(0);
  expect(atoms.get(puzzleTimerFamily("puzzles-test"))).toBe(1234);
  expect(treeStore.getState()).toBe(before);
  expect(sessionStorage.getItem("puzzles-test-puzzles")).toBe(previousRows);
  expect(mocks.playSound).not.toHaveBeenCalled();
  expect(mocks.notificationShow).not.toHaveBeenCalled();
});

test("admission installs a valid fetched Black-to-move puzzle and preserves normal completion", async () => {
  const atoms = await renderPriorPuzzle([puzzleRow({ completion: "correct" })]);
  await act(async () => atoms.set(jumpToNextPuzzleAtom, false));
  const candidate = puzzleRow({ id: 99, fen: blackPuzzleFen, moves: ["e7e5", "g1f3"] });
  mocks.getPuzzle.mockResolvedValue({ ...candidate, moves: candidate.moves.join(" ") });
  await newPuzzle();
  expect(storedPuzzles()).toHaveLength(2);
  expect(storedPuzzles()[1]).toEqual(candidate);
  expect(atoms.get(currentPuzzleFamily("puzzles-test"))).toBe(1);
  expect(treeStore.getState().root.fen).toBe(blackPuzzleFen);
  expect(treeStore.getState().root.halfMoves).toBe(45);
  expect(treeStore.getState().currentNode().halfMoves).toBe(46);
  expect(treeStore.getState().currentNode().san).toBe("e5");
  expect(treeStore.getState().position).toEqual([0]);
  expect(mocks.board?.orientation).toBe("white");
  expect(mocks.board?.movable?.color).toBe("white");
  expect(mocks.playSound).toHaveBeenCalledOnce();
  await act(async () => mocks.board!.movable!.events!.after!("g1", "f3", { premove: false }));
  expect(storedPuzzles()[1].completion).toBe("correct");
  expect(atoms.get(currentPuzzleFamily("puzzles-test"))).toBe(1);
  expect(treeStore.getState().position).toEqual([0, 0]);
  expect(treeStore.getState().currentNode().san).toBe("Nf3");
  expect(mocks.playSound).toHaveBeenCalledTimes(2);
  expect(mocks.notificationShow).not.toHaveBeenCalled();
});

test("admission installs a valid cached next puzzle through immediate advance", async () => {
  const cached = puzzleRow({ id: 99, fen: blackPuzzleFen, moves: ["e7e5", "g1f3"] });
  const atoms = await renderPriorPuzzle([puzzleRow(), cached], 0, ["e4"]);
  await act(async () => atoms.set(jumpToNextPuzzleAtom, true));
  await act(async () => mocks.board!.movable!.events!.after!("e7", "e5", { premove: false }));
  expect(atoms.get(currentPuzzleFamily("puzzles-test"))).toBe(1);
  expect(storedPuzzles()[0].completion).toBe("correct");
  expect(storedPuzzles()[1]).toEqual(cached);
  expect(treeStore.getState().root.fen).toBe(blackPuzzleFen);
  expect(treeStore.getState().currentNode().san).toBe("e5");
  expect(treeStore.getState().position).toEqual([0]);
  expect(mocks.board?.orientation).toBe("white");
  expect(mocks.playSound).toHaveBeenCalledOnce();
  expect(mocks.getPuzzle).not.toHaveBeenCalled();
  expect(mocks.notificationShow).not.toHaveBeenCalled();
});

test("a malformed persisted FEN renders safely and cannot record an incorrect attempt", async () => {
  const row = puzzleRow({ fen: "invalid", moves: ["e7e5", "g1z3"] });
  const atoms = await renderPriorPuzzle([row], 0, ["e4"]);
  const before = treeStore.getState();
  const previousRows = sessionStorage.getItem("puzzles-test-puzzles");
  expect(mocks.board?.movable?.color).toBeUndefined();
  expect(
    document.querySelector<HTMLButtonElement>('[aria-label="Puzzle.AnalyzePosition"]')?.disabled,
  ).toBe(true);
  await act(async () => mocks.board!.movable!.events!.after!("e7", "e5", { premove: false }));
  expect(treeStore.getState()).toBe(before);
  expect(sessionStorage.getItem("puzzles-test-puzzles")).toBe(previousRows);
  expect(atoms.get(puzzleTimerFamily("puzzles-test"))).toBe(1234);
  expect(mocks.getThemesForPuzzle).not.toHaveBeenCalled();
  expect(mocks.playSound).not.toHaveBeenCalled();
  expect(mocks.notificationShow).not.toHaveBeenCalled();
  await act(async () => hintButton().click());
  expect(treeStore.getState()).toBe(before);
  expect(sessionStorage.getItem("puzzles-test-puzzles")).toBe(previousRows);
  expect(atoms.get(puzzleTimerFamily("puzzles-test"))).toBe(1234);
  expect(mocks.getThemesForPuzzle).not.toHaveBeenCalled();
  expect(mocks.notificationShow).toHaveBeenCalledExactlyOnceWith({
    color: "red",
    title: "Common.Error",
    message: "Board.Analysis.InvalidPosition",
  });
});

function outdatedAlert() {
  return [...document.querySelectorAll('[role="alert"]')].find((element) =>
    element.textContent?.includes("Puzzle.DatabaseOutdated"),
  );
}

let treeStore: TreeStore;
function CaptureTreeStore() {
  treeStore = useContext(TreeStateContext)!;
  return null;
}

let root: Root;
let host: HTMLDivElement;
let portals: HTMLDivElement;

beforeEach(() => {
  vi.resetAllMocks();
  mocks.board = null;
  mocks.selectedDatabase = null;
  localStorage.clear();
  sessionStorage.clear();
  localStorage.setItem("puzzle-db", JSON.stringify(selectedDb));
  mocks.getPuzzleWorkspace.mockResolvedValue(workspace);
  mocks.listPuzzleDatabases.mockResolvedValue([selectedDatabase]);
  mocks.getPuzzleThemes.mockResolvedValue([]);
  mocks.getPuzzle.mockResolvedValue({
    id: 1,
    fen: "8/8/8/8/8/8/8/K6k w - - 0 1",
    moves: "a1a2",
    rating: 1200,
    rating_deviation: 50,
    popularity: 1,
    nb_plays: 1,
  });
  mocks.getThemesForPuzzle.mockResolvedValue([]);
  mocks.deletePuzzleDatabase.mockResolvedValue(undefined);
  mocks.getSoundServerPort.mockRejectedValue(new Error("sound disabled in test"));
  host = document.createElement("div");
  portals = document.createElement("div");
  portals.innerHTML = `<div id="left"></div><div id="topRight"></div><div id="bottomRight"></div>`;
  document.body.append(portals, host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  vi.useRealTimers();
  host.remove();
  portals.remove();
  localStorage.clear();
  sessionStorage.clear();
});

async function renderPuzzles({
  initial,
  trackTime = false,
}: { initial?: TreeState; trackTime?: boolean } = {}) {
  const store = createStore();
  store.set(selectedPuzzleDbAtom, selectedDb);
  store.set(trackPuzzleTimeAtom, trackTime);
  await act(async () => {
    root.render(
      <MantineProvider>
        <Provider store={store}>
          <WorkspaceTabScope tabId="puzzles-test">
            <TreeStateProvider initial={initial}>
              <CaptureTreeStore />
              <Puzzles id="puzzles-test" />
            </TreeStateProvider>
          </WorkspaceTabScope>
        </Provider>
      </MantineProvider>,
    );
    await Promise.resolve();
  });
  await act(async () => {
    const settings = document.querySelector<HTMLButtonElement>('[aria-label="SideBar.Settings"]');
    settings?.click();
  });
  return store;
}

async function openAndConfirmDeletion() {
  await act(async () => {
    document.querySelector<HTMLButtonElement>('[aria-label="Puzzle.DeleteDatabase"]')?.click();
  });
  await act(async () => {
    document.querySelector<HTMLButtonElement>('[data-testid="confirm-delete"]')?.click();
    await Promise.resolve();
  });
}

test.each(["workspace", "listing"] as const)(
  "%s refusal clears the puzzle list and preserves unlabelled diagnostics",
  async (surface) => {
    const store = await renderPuzzles();
    await vi.waitFor(() =>
      expect(document.querySelector('[data-testid="puzzle-database-count"]')?.textContent).toBe(
        "1",
      ),
    );
    for (const labelled of [true, false]) {
      const failure = new TauriCommandError({
        tag: "backend-error",
        category: "io",
        message: "native failure",
        ...(labelled ? { rootFailure: "missing" as const } : {}),
      });
      mocks[
        surface === "workspace" ? "getPuzzleWorkspace" : "listPuzzleDatabases"
      ].mockRejectedValue(failure);
      mocks.notificationShow.mockClear();
      await act(async () =>
        store.set(puzzleWorkspaceGenerationAtom, (generation) => generation + 1),
      );
      await vi.waitFor(() =>
        expect(mocks.notificationShow).toHaveBeenCalledWith({
          color: "red",
          title: "Common.Error",
          message: labelled
            ? "This puzzle folder is no longer available. Choose another in Settings."
            : "native failure",
        }),
      );
      expect(document.querySelector('[data-testid="puzzle-database-count"]')?.textContent).toBe(
        "0",
      );
    }
  },
);

test("shows the outdated-database alert for puzzle-themes-unavailable", async () => {
  // Message is neither the old Diesel substring nor the variant Display.
  mocks.getPuzzleThemes.mockRejectedValue(
    commandError("puzzle-themes-unavailable", "native failed"),
  );
  await renderPuzzles();
  await vi.waitFor(() => {
    expect(outdatedAlert()).toBeTruthy();
  });
  expect(mocks.notificationShow).not.toHaveBeenCalled();
});

test("reports a current theme database failure without showing the unavailable alert", async () => {
  mocks.getPuzzleThemes.mockRejectedValue(commandError("database", "no such table: themes"));
  await renderPuzzles();
  await vi.waitFor(() => {
    expect(mocks.notificationShow).toHaveBeenCalledWith(
      expect.objectContaining({ color: "red", message: "no such table: themes" }),
    );
  });
  expect(outdatedAlert()).toBeUndefined();
});

test("reports an ordinary missing-resource theme failure without the unavailable alert", async () => {
  mocks.getPuzzleThemes.mockRejectedValue(commandError("missing-resource", "native failed"));
  await renderPuzzles();
  await vi.waitFor(() => {
    expect(mocks.notificationShow).toHaveBeenCalledWith(
      expect.objectContaining({ color: "red", message: "native failed" }),
    );
  });
  expect(outdatedAlert()).toBeUndefined();
});

test("keeps a current cancelled theme request quiet", async () => {
  mocks.getPuzzleThemes.mockRejectedValue(commandError("cancellation", "Cancellation"));
  await renderPuzzles();
  await vi.waitFor(() => expect(mocks.getPuzzleThemes).toHaveBeenCalled());
  expect(mocks.notificationShow).not.toHaveBeenCalled();
  expect(outdatedAlert()).toBeUndefined();
});

test("does not show the alert when puzzle themes load", async () => {
  mocks.getPuzzleThemes.mockResolvedValue(["fork"]);
  await renderPuzzles();
  await vi.waitFor(() => {
    expect(mocks.getPuzzleThemes).toHaveBeenCalled();
  });
  expect(outdatedAlert()).toBeUndefined();
});

test("successful puzzle requests retain the saved theme and rating range", async () => {
  mocks.getPuzzleThemes.mockResolvedValue(["fork"]);
  const store = await renderPuzzles();
  await act(async () => {
    store.set(puzzleThemeAtom, "fork");
    store.set(puzzleRatingRangeAtom, [1000, 1400]);
  });
  await vi.waitFor(() => expect(mocks.getPuzzleThemes).toHaveBeenCalled());
  await act(async () => {
    document.querySelector<HTMLButtonElement>('[aria-label="Puzzle.NewPuzzle"]')?.click();
  });
  await vi.waitFor(() =>
    expect(mocks.getPuzzle).toHaveBeenCalledWith(
      selectedDb,
      1000,
      1400,
      "fork",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    ),
  );
  expect(document.querySelector('[data-testid="puzzle-state"]')?.getAttribute("data-count")).toBe(
    "1",
  );
});

test("reports a current puzzle request failure", async () => {
  mocks.getPuzzleThemes.mockResolvedValue(["fork"]);
  mocks.getPuzzle.mockRejectedValue(commandError("database", "puzzle query failed"));
  await renderPuzzles();
  await vi.waitFor(() => expect(mocks.getPuzzleThemes).toHaveBeenCalled());
  await act(async () => {
    document.querySelector<HTMLButtonElement>('[aria-label="Puzzle.NewPuzzle"]')?.click();
  });
  await vi.waitFor(() =>
    expect(mocks.notificationShow).toHaveBeenCalledWith(
      expect.objectContaining({ color: "red", message: "puzzle query failed" }),
    ),
  );
  expect(document.querySelector('[data-testid="puzzle-state"]')?.getAttribute("data-count")).toBe(
    "0",
  );
});

test("keeps a stale puzzle request failure quiet after database replacement", async () => {
  mocks.getPuzzleThemes.mockResolvedValue(["fork"]);
  let rejectPuzzle!: (error: unknown) => void;
  mocks.getPuzzle.mockImplementation(
    () => new Promise((_resolve, reject) => (rejectPuzzle = reject)),
  );
  const store = await renderPuzzles();
  await vi.waitFor(() => expect(mocks.getPuzzleThemes).toHaveBeenCalled());
  await act(async () => {
    document.querySelector<HTMLButtonElement>('[aria-label="Puzzle.NewPuzzle"]')?.click();
  });
  await vi.waitFor(() => expect(mocks.getPuzzle).toHaveBeenCalled());
  await act(async () => store.set(selectedPuzzleDbAtom, otherDb));
  await act(async () => rejectPuzzle(commandError("database", "stale puzzle failure")));
  expect(mocks.notificationShow).not.toHaveBeenCalled();
});

test("keeps a stale theme failure quiet after database replacement", async () => {
  let rejectThemes!: (error: unknown) => void;
  mocks.getPuzzleThemes.mockImplementation(
    () => new Promise((_resolve, reject) => (rejectThemes = reject)),
  );
  const store = await renderPuzzles();
  await vi.waitFor(() => expect(mocks.getPuzzleThemes).toHaveBeenCalled());
  await act(async () => store.set(selectedPuzzleDbAtom, otherDb));
  await act(async () => rejectThemes(commandError("database", "stale theme failure")));
  expect(mocks.notificationShow).not.toHaveBeenCalled();
  expect(outdatedAlert()).toBeUndefined();
});

test("unmount cancels the held native puzzle database listing", async () => {
  let signal!: AbortSignal;
  mocks.listPuzzleDatabases.mockImplementation(
    ({ signal: next }: { signal: AbortSignal }) =>
      new Promise((_resolve, reject) => {
        signal = next;
        next.addEventListener("abort", () => reject(commandError("cancellation", "cancelled")), {
          once: true,
        });
      }),
  );
  await renderPuzzles();
  await vi.waitFor(() => expect(mocks.listPuzzleDatabases).toHaveBeenCalledOnce());
  await act(async () => root.unmount());
  expect(signal.aborted).toBe(true);
  expect(mocks.notificationShow).not.toHaveBeenCalled();
});

test("database replacement cancels held theme and puzzle requests and rejects stale publication", async () => {
  let themeSignal!: AbortSignal;
  let puzzleSignal!: AbortSignal;
  let resolvePuzzle!: (value: NativePuzzle) => void;
  mocks.getPuzzleThemes.mockImplementation(
    (_database: unknown, { signal }: { signal: AbortSignal }) => {
      themeSignal = signal;
      return new Promise(() => undefined);
    },
  );
  mocks.getPuzzle.mockImplementation(
    (
      _database: unknown,
      _min: unknown,
      _max: unknown,
      _theme: unknown,
      { signal }: { signal: AbortSignal },
    ) => {
      puzzleSignal = signal;
      return new Promise((done) => {
        resolvePuzzle = done;
      });
    },
  );
  const store = await renderPuzzles();
  await vi.waitFor(() => expect(mocks.getPuzzleThemes).toHaveBeenCalledOnce());
  await act(async () => {
    document.querySelector<HTMLButtonElement>('[aria-label="Puzzle.NewPuzzle"]')?.click();
  });
  await vi.waitFor(() => expect(mocks.getPuzzle).toHaveBeenCalledOnce());
  await act(async () => store.set(selectedPuzzleDbAtom, otherDb));
  expect(themeSignal.aborted).toBe(true);
  expect(puzzleSignal.aborted).toBe(true);
  resolvePuzzle({
    id: 99,
    fen: "8/8/8/8/8/8/8/8 w - - 0 1",
    moves: "e2e4",
    rating: 1200,
    rating_deviation: 10,
    popularity: 1,
    nb_plays: 1,
  });
  await act(async () => Promise.resolve());
  expect(document.querySelector('[data-testid="puzzle-state"]')?.getAttribute("data-count")).toBe(
    "0",
  );
  expect(mocks.notificationShow).not.toHaveBeenCalled();
});

test("puzzle or database replacement cancels completed-theme ownership and refuses stale themes", async () => {
  mocks.getPuzzleThemes.mockResolvedValue(["fork"]);
  mocks.getPuzzle.mockResolvedValue({
    id: 1,
    fen: INITIAL_FEN,
    moves: "e2e4 e7e5",
    rating: 1200,
    rating_deviation: 10,
    popularity: 1,
    nb_plays: 1,
  });
  let completedSignal!: AbortSignal;
  let resolveThemes!: (value: string[]) => void;
  mocks.getThemesForPuzzle.mockImplementation(
    (_database: unknown, _id: unknown, { signal }: { signal: AbortSignal }) =>
      new Promise((done) => {
        completedSignal = signal;
        resolveThemes = done;
      }),
  );
  const store = await renderPuzzles();
  await vi.waitFor(() => expect(mocks.getPuzzleThemes).toHaveBeenCalledOnce());
  await act(async () => {
    document.querySelector<HTMLButtonElement>('[aria-label="Puzzle.NewPuzzle"]')?.click();
  });
  await vi.waitFor(() =>
    expect(document.querySelector('[data-testid="puzzle-state"]')?.getAttribute("data-count")).toBe(
      "1",
    ),
  );
  await act(async () => {
    mocks.board!.movable!.events!.after!("e7", "e5", { premove: false });
  });
  await vi.waitFor(() => expect(mocks.getThemesForPuzzle).toHaveBeenCalledOnce());
  await act(async () => store.set(selectedPuzzleDbAtom, otherDb));
  expect(completedSignal.aborted).toBe(true);
  resolveThemes(["stale-theme"]);
  await act(async () => Promise.resolve());
  expect(document.querySelector('[data-testid="puzzle-state"]')?.getAttribute("data-themes")).toBe(
    "",
  );
  expect(mocks.notificationShow).not.toHaveBeenCalled();
});

test("retains a stored database across workspace switches and restores it on return", async () => {
  const store = await renderPuzzles();
  await vi.waitFor(() => {
    expect(
      document.querySelector('[data-testid="puzzle-state"]')?.getAttribute("data-database"),
    ).toBe(selectedDb.id);
  });

  mocks.getPuzzleWorkspace.mockResolvedValue(otherWorkspace);
  mocks.listPuzzleDatabases.mockResolvedValue([otherDatabase]);
  await act(async () => {
    store.set(puzzleWorkspaceGenerationAtom, store.get(puzzleWorkspaceGenerationAtom) + 1);
  });

  expect(
    document.querySelector('[data-testid="puzzle-state"]')?.getAttribute("data-database"),
  ).toBe("none");
  await vi.waitFor(() => {
    expect(document.querySelector('[data-testid="puzzle-database-count"]')?.textContent).toBe("1");
  });
  expect(store.get(selectedPuzzleDbAtom)).toEqual(selectedDb);
  expect(mocks.getPuzzleThemes).toHaveBeenCalledTimes(1);

  mocks.getPuzzleWorkspace.mockResolvedValue(workspace);
  mocks.listPuzzleDatabases.mockResolvedValue([selectedDatabase]);
  await act(async () => {
    store.set(puzzleWorkspaceGenerationAtom, store.get(puzzleWorkspaceGenerationAtom) + 1);
  });

  await vi.waitFor(() => {
    expect(
      document.querySelector('[data-testid="puzzle-state"]')?.getAttribute("data-database"),
    ).toBe(selectedDb.id);
  });
  expect(store.get(selectedPuzzleDbAtom)).toEqual(selectedDb);
  expect(mocks.getPuzzleThemes).toHaveBeenCalledTimes(2);
});

test.each([
  ["missing", () => mocks.listPuzzleDatabases.mockResolvedValue([])],
  ["offline", () => mocks.listPuzzleDatabases.mockRejectedValue(new Error("offline"))],
])("keeps the stored database but does not use it when the listing is %s", async (_case, setup) => {
  setup();
  const store = await renderPuzzles();

  await vi.waitFor(() => expect(mocks.listPuzzleDatabases).toHaveBeenCalled());
  expect(store.get(selectedPuzzleDbAtom)).toEqual(selectedDb);
  expect(
    document.querySelector('[data-testid="puzzle-state"]')?.getAttribute("data-database"),
  ).toBe("none");
  expect(mocks.getPuzzleThemes).not.toHaveBeenCalled();
  expect(
    document.querySelector<HTMLButtonElement>('[aria-label="Puzzle.NewPuzzle"]')?.disabled,
  ).toBe(true);
});

test("ignores a stale workspace listing after a newer generation restores the selection", async () => {
  const store = await renderPuzzles();
  await vi.waitFor(() => expect(mocks.getPuzzleThemes).toHaveBeenCalledTimes(1));

  let finishStaleListing: (databases: PuzzleDatabaseInfo[]) => void = () => undefined;
  mocks.getPuzzleWorkspace.mockResolvedValue(otherWorkspace);
  mocks.listPuzzleDatabases.mockImplementation(
    () =>
      new Promise<PuzzleDatabaseInfo[]>((resolve) => {
        finishStaleListing = resolve;
      }),
  );
  await act(async () => {
    store.set(puzzleWorkspaceGenerationAtom, store.get(puzzleWorkspaceGenerationAtom) + 1);
  });
  expect(
    document.querySelector('[data-testid="puzzle-state"]')?.getAttribute("data-database"),
  ).toBe("none");

  mocks.getPuzzleWorkspace.mockResolvedValue(workspace);
  mocks.listPuzzleDatabases.mockResolvedValue([selectedDatabase]);
  await act(async () => {
    store.set(puzzleWorkspaceGenerationAtom, store.get(puzzleWorkspaceGenerationAtom) + 1);
  });
  await vi.waitFor(() => {
    expect(
      document.querySelector('[data-testid="puzzle-state"]')?.getAttribute("data-database"),
    ).toBe(selectedDb.id);
  });

  await act(async () => finishStaleListing([otherDatabase]));
  expect(
    document.querySelector('[data-testid="puzzle-state"]')?.getAttribute("data-database"),
  ).toBe(selectedDb.id);
  expect(store.get(selectedPuzzleDbAtom)).toEqual(selectedDb);
});

test("successful deletion clears the selected puzzle session and closes the modal", async () => {
  sessionStorage.setItem(
    "puzzles-test-puzzles",
    JSON.stringify([
      puzzleRow({ fen: "8/8/8/8/8/8/8/K6k w - - 0 1", moves: [], completion: "correct" }),
    ]),
  );
  const store = await renderPuzzles();
  await act(async () => {
    store.set(trackPuzzleTimeAtom, true);
    store.set(puzzleTimerFamily("puzzles-test"), 123);
  });

  await openAndConfirmDeletion();

  await vi.waitFor(() => {
    expect(mocks.deletePuzzleDatabase).toHaveBeenCalledWith(selectedDb);
    expect(store.get(selectedPuzzleDbAtom)).toBeNull();
    expect(document.querySelector('[data-testid="puzzle-state"]')?.getAttribute("data-count")).toBe(
      "0",
    );
  });
  expect(store.get(puzzleTimerFamily("puzzles-test"))).toBeNull();
  expect(document.querySelector('[data-testid="puzzle-database-count"]')?.textContent).toBe("0");
  expect(document.querySelector('[data-testid="confirm-delete"]')).toBeNull();
  expect(mocks.notificationShow).not.toHaveBeenCalled();
});

test("pre-delete failure preserves selection, list, session, timer and modal", async () => {
  const failure = commandError("io", "delete failed before removal");
  mocks.deletePuzzleDatabase.mockRejectedValue(failure);
  sessionStorage.setItem(
    "puzzles-test-puzzles",
    JSON.stringify([
      puzzleRow({ fen: "8/8/8/8/8/8/8/K6k w - - 0 1", moves: [], completion: "correct" }),
    ]),
  );
  const store = await renderPuzzles();
  await act(async () => {
    store.set(trackPuzzleTimeAtom, true);
    store.set(puzzleTimerFamily("puzzles-test"), 123);
  });

  await openAndConfirmDeletion();

  await vi.waitFor(() => expect(mocks.notificationShow).toHaveBeenCalled());
  expect(store.get(selectedPuzzleDbAtom)).toEqual(selectedDb);
  expect(store.get(puzzleTimerFamily("puzzles-test"))).toBe(123);
  expect(document.querySelector('[data-testid="puzzle-state"]')?.getAttribute("data-count")).toBe(
    "1",
  );
  expect(document.querySelector('[data-testid="puzzle-database-count"]')?.textContent).toBe("1");
  expect(document.querySelector('[data-testid="confirm-delete"]')).toBeTruthy();
});

test("applied deletion converges state, closes the modal and still reports cleanup failure", async () => {
  const applied = commandError(
    "partial-removal",
    "Partially removed: 1 entries were deleted before failing: conflict",
  );
  mocks.deletePuzzleDatabase.mockRejectedValue(applied);
  sessionStorage.setItem(
    "puzzles-test-puzzles",
    JSON.stringify([
      puzzleRow({ fen: "8/8/8/8/8/8/8/K6k w - - 0 1", moves: [], completion: "correct" }),
    ]),
  );
  const store = await renderPuzzles();
  await act(async () => {
    store.set(trackPuzzleTimeAtom, true);
    store.set(puzzleTimerFamily("puzzles-test"), 123);
  });

  await openAndConfirmDeletion();

  await vi.waitFor(() => {
    expect(store.get(selectedPuzzleDbAtom)).toBeNull();
    expect(mocks.notificationShow).toHaveBeenCalledWith(
      expect.objectContaining({ color: "red", message: applied.message }),
    );
  });
  expect(store.get(puzzleTimerFamily("puzzles-test"))).toBeNull();
  expect(document.querySelector('[data-testid="puzzle-state"]')?.getAttribute("data-count")).toBe(
    "0",
  );
  expect(document.querySelector('[data-testid="puzzle-database-count"]')?.textContent).toBe("0");
  expect(document.querySelector('[data-testid="confirm-delete"]')).toBeNull();
});

test("landed deletion does not clear a concurrently selected different database", async () => {
  mocks.listPuzzleDatabases.mockResolvedValue([selectedDatabase, otherDatabase]);
  let finishDeletion: () => void = () => undefined;
  mocks.deletePuzzleDatabase.mockImplementation(
    () =>
      new Promise<void>((resolve) => {
        finishDeletion = resolve;
      }),
  );
  const store = await renderPuzzles();

  await openAndConfirmDeletion();
  await act(async () => store.set(selectedPuzzleDbAtom, otherDb));
  await vi.waitFor(() => {
    expect(
      document.querySelector('[data-testid="puzzle-state"]')?.getAttribute("data-database"),
    ).toBe(otherDb.id);
  });

  let finishPuzzle: (puzzle: NativePuzzle) => void = () => undefined;
  mocks.getPuzzle.mockImplementation(
    () =>
      new Promise<NativePuzzle>((resolve) => {
        finishPuzzle = (puzzle) => resolve(puzzle);
      }),
  );
  await act(async () => {
    document.querySelector<HTMLButtonElement>('[aria-label="Puzzle.NewPuzzle"]')?.click();
  });
  await vi.waitFor(() =>
    expect(mocks.getPuzzle).toHaveBeenCalledWith(
      otherDb,
      expect.any(Number),
      expect.any(Number),
      null,
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    ),
  );

  await act(async () => {
    finishDeletion();
    finishPuzzle({
      id: 7,
      fen: "8/8/8/8/8/8/8/K6k w - - 0 1",
      moves: "a1a2",
      rating: 1200,
      rating_deviation: 50,
      popularity: 1,
      nb_plays: 1,
    });
    await Promise.resolve();
  });

  await vi.waitFor(() => {
    expect(store.get(selectedPuzzleDbAtom)).toEqual(otherDb);
    expect(document.querySelector('[data-testid="puzzle-state"]')?.getAttribute("data-count")).toBe(
      "1",
    );
  });
  expect(
    document.querySelector('[data-testid="puzzle-state"]')?.getAttribute("data-database"),
  ).toBe(otherDb.id);
  expect(document.querySelector('[data-testid="puzzle-database-count"]')?.textContent).toBe("1");
  expect(document.querySelector('[data-testid="confirm-delete"]')).toBeNull();
});

test("landed deletion clears its retained selection after the workspace view switches", async () => {
  let finishDeletion: () => void = () => undefined;
  mocks.deletePuzzleDatabase.mockImplementation(
    () =>
      new Promise<void>((resolve) => {
        finishDeletion = resolve;
      }),
  );
  const store = await renderPuzzles();
  await openAndConfirmDeletion();

  mocks.getPuzzleWorkspace.mockResolvedValue(otherWorkspace);
  mocks.listPuzzleDatabases.mockResolvedValue([otherDatabase]);
  await act(async () => {
    store.set(puzzleWorkspaceGenerationAtom, store.get(puzzleWorkspaceGenerationAtom) + 1);
  });
  await vi.waitFor(() => {
    expect(store.get(selectedPuzzleDbAtom)).toEqual(selectedDb);
    expect(
      document.querySelector('[data-testid="puzzle-state"]')?.getAttribute("data-database"),
    ).toBe("none");
  });

  await act(async () => finishDeletion());

  await vi.waitFor(() => expect(store.get(selectedPuzzleDbAtom)).toBeNull());
  expect(document.querySelector('[data-testid="puzzle-database-count"]')?.textContent).toBe("1");
  expect(document.querySelector('[data-testid="confirm-delete"]')).toBeNull();
});
