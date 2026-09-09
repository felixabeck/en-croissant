import { MantineProvider } from "@mantine/core";
import { Provider, createStore } from "jotai";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import type {
  ErrorCategory,
  Puzzle as NativePuzzle,
  PuzzleDatabaseInfo,
  PuzzleRootDescriptor,
} from "@/bindings";
import { TreeStateProvider } from "@/components/common/TreeStateContext";
import {
  currentPuzzleTimerAtom,
  puzzleRatingRangeAtom,
  puzzleThemeAtom,
  puzzleWorkspaceGenerationAtom,
  selectedPuzzleDbAtom,
  trackPuzzleTimeAtom,
} from "@/state/atoms";
import { TauriCommandError } from "@/platform/tauri";
import Puzzles from "./Puzzles";

const mocks = vi.hoisted(() => ({
  getPuzzleWorkspace: vi.fn(),
  listPuzzleDatabases: vi.fn(),
  getPuzzleThemes: vi.fn(),
  getPuzzle: vi.fn(),
  soundResourcePath: vi.fn(),
  deletePuzzleDatabase: vi.fn(),
  getThemesForPuzzle: vi.fn(),
  notificationShow: vi.fn(),
}));

vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@/platform/tauri", async () => {
  const actual = await vi.importActual<typeof import("@/platform/tauri")>("@/platform/tauri");
  return {
    ...actual,
    tauri: {
      getPuzzleWorkspace: mocks.getPuzzleWorkspace,
      listPuzzleDatabases: mocks.listPuzzleDatabases,
      getPuzzleThemes: mocks.getPuzzleThemes,
      getPuzzle: mocks.getPuzzle,
      soundResourcePath: mocks.soundResourcePath,
      deletePuzzleDatabase: mocks.deletePuzzleDatabase,
      getThemesForPuzzle: mocks.getThemesForPuzzle,
    },
  };
});
vi.mock("@mantine/notifications", () => ({
  notifications: { show: mocks.notificationShow },
}));
vi.mock("./PuzzleBoard", () => ({
  default: ({
    puzzles,
    db,
    changeCompletion,
  }: {
    puzzles: Array<{ themes?: string[] }>;
    db: { id: string } | null;
    changeCompletion: (completion: "correct") => Promise<void>;
  }) => (
    <div
      data-testid="puzzle-state"
      data-count={puzzles.length}
      data-database={db?.id ?? "none"}
      data-themes={(puzzles[0]?.themes ?? []).join(",")}
    >
      <button data-testid="complete-puzzle" onClick={() => void changeCompletion("correct")} />
    </div>
  ),
}));
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
vi.mock("../common/ChallengeHistory", () => ({ default: () => null }));

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: query.includes("prefers-reduced-motion"),
    media: query,
    onchange: null,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
  }),
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

function commandError(category: ErrorCategory, message: string) {
  return new TauriCommandError({
    tag: "backend-error",
    category,
    message,
  });
}

function outdatedAlert() {
  return [...document.querySelectorAll('[role="alert"]')].find((element) =>
    element.textContent?.includes("Puzzle.DatabaseOutdated"),
  );
}

let root: Root;
let host: HTMLDivElement;
let portals: HTMLDivElement;

beforeEach(() => {
  vi.resetAllMocks();
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
  mocks.soundResourcePath.mockRejectedValue(new Error("sound disabled in test"));
  host = document.createElement("div");
  portals = document.createElement("div");
  portals.innerHTML = `<div id="left"></div><div id="topRight"></div><div id="bottomRight"></div>`;
  document.body.append(portals, host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  portals.remove();
  localStorage.clear();
  sessionStorage.clear();
});

async function renderPuzzles() {
  const store = createStore();
  store.set(selectedPuzzleDbAtom, selectedDb);
  await act(async () => {
    root.render(
      <MantineProvider>
        <Provider store={store}>
          <TreeStateProvider>
            <Puzzles id="puzzles-test" />
          </TreeStateProvider>
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
    fen: "8/8/8/8/8/8/8/8 w - - 0 1",
    moves: "e2e4",
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
    document.querySelector<HTMLButtonElement>('[data-testid="complete-puzzle"]')?.click();
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
    JSON.stringify([{ id: "puzzle", fen: "8/8/8/8/8/8/8/K6k w - - 0 1", moves: [] }]),
  );
  const store = await renderPuzzles();
  await act(async () => {
    store.set(trackPuzzleTimeAtom, true);
    store.set(currentPuzzleTimerAtom, 123);
  });

  await openAndConfirmDeletion();

  await vi.waitFor(() => {
    expect(mocks.deletePuzzleDatabase).toHaveBeenCalledWith(selectedDb);
    expect(store.get(selectedPuzzleDbAtom)).toBeNull();
    expect(document.querySelector('[data-testid="puzzle-state"]')?.getAttribute("data-count")).toBe(
      "0",
    );
  });
  expect(store.get(currentPuzzleTimerAtom)).toBeNull();
  expect(document.querySelector('[data-testid="puzzle-database-count"]')?.textContent).toBe("0");
  expect(document.querySelector('[data-testid="confirm-delete"]')).toBeNull();
  expect(mocks.notificationShow).not.toHaveBeenCalled();
});

test("pre-delete failure preserves selection, list, session, timer and modal", async () => {
  const failure = commandError("io", "delete failed before removal");
  mocks.deletePuzzleDatabase.mockRejectedValue(failure);
  sessionStorage.setItem(
    "puzzles-test-puzzles",
    JSON.stringify([{ id: "puzzle", fen: "8/8/8/8/8/8/8/K6k w - - 0 1", moves: [] }]),
  );
  const store = await renderPuzzles();
  await act(async () => {
    store.set(trackPuzzleTimeAtom, true);
    store.set(currentPuzzleTimerAtom, 123);
  });

  await openAndConfirmDeletion();

  await vi.waitFor(() => expect(mocks.notificationShow).toHaveBeenCalled());
  expect(store.get(selectedPuzzleDbAtom)).toEqual(selectedDb);
  expect(store.get(currentPuzzleTimerAtom)).toBe(123);
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
    JSON.stringify([{ id: "puzzle", fen: "8/8/8/8/8/8/8/K6k w - - 0 1", moves: [] }]),
  );
  const store = await renderPuzzles();
  await act(async () => {
    store.set(trackPuzzleTimeAtom, true);
    store.set(currentPuzzleTimerAtom, 123);
  });

  await openAndConfirmDeletion();

  await vi.waitFor(() => {
    expect(store.get(selectedPuzzleDbAtom)).toBeNull();
    expect(mocks.notificationShow).toHaveBeenCalledWith(
      expect.objectContaining({ color: "red", message: applied.message }),
    );
  });
  expect(store.get(currentPuzzleTimerAtom)).toBeNull();
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
