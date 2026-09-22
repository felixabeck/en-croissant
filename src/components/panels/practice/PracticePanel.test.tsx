import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

const fixtures = vi.hoisted(() => ({
  atoms: {
    currentEvalOpen: Symbol("current-eval-open"),
    currentInvisible: Symbol("current-invisible"),
    currentPracticeTab: Symbol("current-practice-tab"),
    currentShowComments: Symbol("current-show-comments"),
    currentTab: Symbol("current-tab"),
    deck: Symbol("deck"),
    practiceAutoDifficulty: Symbol("practice-auto-difficulty"),
    practiceCardStartTime: Symbol("practice-card-start-time"),
    practiceCompletedSummary: Symbol("practice-completed-summary"),
    practiceMoveController: Symbol("practice-move-controller"),
    practiceSessionStats: Symbol("practice-session-stats"),
    practiceState: Symbol("practice-state"),
  },
  deck: null as any,
  setDeck: vi.fn(),
  buildFromTree: vi.fn(() => []),
  loadPracticeReviews: vi.fn(),
  tree: {
    currentNode: () => ({ fen: "root" }),
    goToMove: vi.fn(),
    goToNext: vi.fn(),
    headers: { orientation: "white", start: [] },
    makeMove: vi.fn(),
    root: {},
    setPracticePath: vi.fn(),
  },
  currentTab: { value: "practice-tab" },
}));

vi.mock("@/state/atoms", () => ({
  currentEvalOpenAtom: fixtures.atoms.currentEvalOpen,
  currentInvisibleAtom: fixtures.atoms.currentInvisible,
  currentPracticeTabAtom: fixtures.atoms.currentPracticeTab,
  currentShowCommentsAtom: fixtures.atoms.currentShowComments,
  currentTabAtom: fixtures.atoms.currentTab,
  deckAtomFamily: () => fixtures.atoms.deck,
  practiceAutoDifficultyAtom: fixtures.atoms.practiceAutoDifficulty,
  practiceCardStartTimeAtom: fixtures.atoms.practiceCardStartTime,
  practiceCompletedSummaryAtom: fixtures.atoms.practiceCompletedSummary,
  practiceMoveControllerAtom: fixtures.atoms.practiceMoveController,
  practiceSessionStatsAtom: fixtures.atoms.practiceSessionStats,
  practiceStateAtom: fixtures.atoms.practiceState,
}));
vi.mock("jotai", () => ({
  useAtom: (atom: symbol) => {
    if (atom === fixtures.atoms.deck) return [fixtures.deck, fixtures.setDeck];
    if (atom === fixtures.atoms.currentPracticeTab) return ["train", vi.fn()];
    if (atom === fixtures.atoms.practiceState) {
      return [{ phase: "idle" }, vi.fn()];
    }
    if (atom === fixtures.atoms.practiceSessionStats) {
      return [
        {
          mode: "anki",
          remainingPositions: [],
          correct: 0,
          incorrect: 0,
          streak: 0,
          bestStreak: 0,
        },
        vi.fn(),
      ];
    }
    if (atom === fixtures.atoms.practiceCompletedSummary) return [null, vi.fn()];
    return [false, vi.fn()];
  },
  useAtomValue: (atom: symbol) => {
    if (atom === fixtures.atoms.currentTab) return fixtures.currentTab;
    if (atom === fixtures.atoms.practiceAutoDifficulty) return "none";
    if (atom === fixtures.atoms.practiceCardStartTime) return 0;
    return false;
  },
  useSetAtom: () => vi.fn(),
}));
vi.mock("zustand", () => ({
  useStore: (_store: unknown, selector: (value: typeof fixtures.tree) => unknown) =>
    selector(fixtures.tree),
}));
vi.mock("react-hotkeys-hook", () => ({ useHotkeys: vi.fn() }));
vi.mock("@/state/practiceStorage", () => ({
  PRACTICE_LOG_PAGE_SIZE: 100,
  loadPracticeReviews: fixtures.loadPracticeReviews,
}));
vi.mock("@/components/files/opening", () => ({
  buildFromTree: fixtures.buildFromTree,
  formatReviewInterval: () => "",
  getCardForReview: () => null,
  getNextReviewTimes: () => null,
  getStats: () => ({ due: 1, nextDue: null, practiced: 0, total: 1, unseen: 1 }),
  syncDeck: () => ({ added: 0, positions: [], removed: 0 }),
  updateCardPerformance: vi.fn(),
}));
vi.mock("@/utils/tabs", () => ({
  getTabFile: () => ({ handle: { id: { id: "file-a" } }, name: "opening.pgn" }),
  getTabGameNumber: () => 0,
}));
vi.mock("@/utils/pathCapabilities", () => ({ fileWorkspaceKey: () => "file-a" }));
vi.mock("@/utils/treeReducer", () => ({
  findFen: (fen: string) => (fen === "in-repertoire" ? [0] : null),
  getNodeAtPath: () => ({ halfMoves: 0, san: "e4" }),
}));
vi.mock("@/components/common/AppModal", () => ({
  default: ({ opened, onClose, title, children }: any) =>
    opened ? (
      <div role="dialog">
        <h2>{title}</h2>
        <button type="button" aria-label="close" onClick={onClose}>
          close
        </button>
        {children}
      </div>
    ) : null,
}));
vi.mock("@/components/common/ConfirmModal", () => ({
  default: ({ opened, title, description, onConfirm }: any) =>
    opened ? (
      <div role="alertdialog">
        <div>{title}</div>
        <div>{description}</div>
        <button type="button" onClick={onConfirm}>
          confirm
        </button>
      </div>
    ) : null,
}));
vi.mock("@/components/common/IconAction", () => ({
  IconAction: ({ children, ...props }: any) => (
    <button type="button" {...props}>
      {children}
    </button>
  ),
}));
vi.mock("./RepertoireInfo", () => ({ default: () => null }));
vi.mock("@tabler/icons-react", () => {
  const Icon = () => null;
  return {
    IconArrowBack: Icon,
    IconArrowRight: Icon,
    IconBook: Icon,
    IconCheck: Icon,
    IconFlame: Icon,
    IconInfoCircle: Icon,
    IconTarget: Icon,
    IconX: Icon,
  };
});
vi.mock("@mantine/core", () => {
  const element = ({ children, ...props }: any) => <div {...props}>{children}</div>;
  const button = ({ children, ...props }: any) => (
    <button type="button" {...props}>
      {children}
    </button>
  );
  const Tabs = ({ children, ...props }: any) => <div {...props}>{children}</div>;
  Tabs.List = element;
  Tabs.Panel = element;
  Tabs.Tab = button;
  return {
    Alert: ({ title, children, ...props }: any) => (
      <div {...props}>
        {title}
        {children}
      </div>
    ),
    Badge: element,
    Button: button,
    Card: element,
    Divider: element,
    Group: element,
    Paper: element,
    Progress: { Root: element, Section: element },
    SimpleGrid: element,
    Stack: element,
    Tabs,
    Text: element,
    ThemeIcon: element,
    Tooltip: element,
  };
});
vi.mock("@mantine/hooks", async () => {
  const actual = await vi.importActual<typeof import("@mantine/hooks")>("@mantine/hooks");
  return actual;
});
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: { count?: number; cause?: string }) =>
      options?.count === undefined ? key : `${key}:${options.count}`,
  }),
}));
vi.mock("ts-fsrs", () => ({
  formatDate: () => "date",
  formatReviewLog: () => "",
}));

import { TreeStateContext } from "@/components/common/TreeStateContext";
import PracticePanel from "./PracticePanel";

const position = (fen: string) => ({
  fen,
  answer: "e4",
  card: { due: "2026-09-22T00:00:00.000Z", reps: 0 },
});

function deck(overrides: Record<string, unknown> = {}) {
  return {
    positions: [position("in-repertoire")],
    revision: 1,
    generation: 0,
    unappliedReviews: 0,
    orphansAcknowledged: true,
    status: "ready",
    ...overrides,
  };
}

function renderPanel() {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  act(() => {
    root.render(
      <TreeStateContext.Provider value={fixtures.tree as any}>
        <PracticePanel />
      </TreeStateContext.Provider>,
    );
  });
  return { container, root };
}

let root: Root | undefined;
let container: HTMLDivElement | undefined;

beforeEach(() => {
  vi.clearAllMocks();
  fixtures.deck = deck();
  fixtures.loadPracticeReviews.mockResolvedValue({ entries: [], nextCursor: null });
  ({ root, container } = renderPanel());
});

afterEach(async () => {
  await act(async () => root?.unmount());
  container?.remove();
  root = undefined;
  container = undefined;
});

test("shows loading without an empty deck, reset, or session start", async () => {
  fixtures.deck = deck({ positions: [], status: "loading" });
  await act(async () =>
    root?.render(
      <TreeStateContext.Provider value={fixtures.tree as any}>
        <PracticePanel />
      </TreeStateContext.Provider>,
    ),
  );

  expect(container?.textContent).toContain("Board.Practice.Loading");
  expect(container?.textContent).not.toContain("Board.Practice.StartPractice");
  expect(container?.textContent).not.toContain("Common.Reset");
  expect(fixtures.setDeck).not.toHaveBeenCalled();
});

test("shows a read failure with repair, no empty deck, and blocked controls", async () => {
  fixtures.deck = deck({ positions: [], status: "read-failed", error: { message: "read failed" } });
  await act(async () =>
    root?.render(
      <TreeStateContext.Provider value={fixtures.tree as any}>
        <PracticePanel />
      </TreeStateContext.Provider>,
    ),
  );

  expect(container?.textContent).toContain("Board.Practice.ReadFailed");
  expect(container?.textContent).toContain("Board.Practice.Repair");
  expect(container?.textContent).not.toContain("Board.Practice.StartPractice");
  expect(container?.textContent).not.toContain("Common.Reset");
  expect(fixtures.setDeck).not.toHaveBeenCalled();
});

test("does not create a native deck when an empty tree yields no positions", async () => {
  fixtures.setDeck.mockClear();
  fixtures.buildFromTree.mockClear();
  fixtures.deck = deck({ positions: [] });
  fixtures.tree.root = {};
  await act(async () =>
    root?.render(
      <TreeStateContext.Provider value={fixtures.tree as any}>
        <PracticePanel />
      </TreeStateContext.Provider>,
    ),
  );

  expect(fixtures.buildFromTree).toHaveBeenCalledOnce();
  expect(fixtures.setDeck).not.toHaveBeenCalled();
});

test("renders and dismisses only unacknowledged unapplied reviews", async () => {
  fixtures.deck = deck({ unappliedReviews: 2, orphansAcknowledged: false });
  await act(async () =>
    root?.render(
      <TreeStateContext.Provider value={fixtures.tree as any}>
        <PracticePanel />
      </TreeStateContext.Provider>,
    ),
  );
  expect(container?.textContent).toContain("Board.Practice.UnappliedReviews:2");
  const dismiss = [...(container?.querySelectorAll("button") ?? [])].find((button) =>
    button.textContent?.includes("Board.Practice.DismissUnappliedReviews"),
  );
  await act(async () => dismiss?.click());
  expect(fixtures.setDeck).toHaveBeenCalledWith({ type: "acknowledge" });

  fixtures.deck = deck({ unappliedReviews: 0, orphansAcknowledged: false });
  await act(async () =>
    root?.render(
      <TreeStateContext.Provider value={fixtures.tree as any}>
        <PracticePanel />
      </TreeStateContext.Provider>,
    ),
  );
  expect(container?.textContent).not.toContain("Board.Practice.UnappliedReviews");
});

test("pages logs in backend order until the cursor is exhausted and keeps off-repertoire FENs", async () => {
  const entry = (id: string, fen: string) => ({
    id,
    entry: JSON.stringify({ due: "2026-09-22", fen, rating: 3 }),
  });
  fixtures.loadPracticeReviews
    .mockResolvedValueOnce({
      entries: [entry("one", "in-repertoire"), entry("two", "gone")],
      nextCursor: "next",
    })
    .mockResolvedValueOnce({ entries: [entry("three", "in-repertoire")], nextCursor: null });
  const showLogs = [...(container?.querySelectorAll("button") ?? [])].find((button) =>
    button.textContent?.includes("Board.Practice.ShowLogs"),
  );
  await act(async () => showLogs?.click());
  await vi.waitFor(() =>
    expect(container?.querySelectorAll("[data-practice-entry-id]")).toHaveLength(2),
  );
  expect(
    [...container!.querySelectorAll<HTMLElement>("[data-practice-entry-id]")].map(
      (node) => node.dataset.practiceEntryId,
    ),
  ).toEqual(["one", "two"]);
  expect(container?.textContent).toContain("gone");

  const loadMore = [...(container?.querySelectorAll("button") ?? [])].find((button) =>
    button.textContent?.includes("Board.Practice.LoadMore"),
  );
  await act(async () => loadMore?.click());
  await vi.waitFor(() =>
    expect(container?.querySelectorAll("[data-practice-entry-id]")).toHaveLength(3),
  );
  expect(
    [...container!.querySelectorAll<HTMLElement>("[data-practice-entry-id]")].map(
      (node) => node.dataset.practiceEntryId,
    ),
  ).toEqual(["one", "two", "three"]);
  expect(container?.textContent).not.toContain("Board.Practice.LoadMore");
});

test("keeps existing logs and cursor after a failed page", async () => {
  fixtures.loadPracticeReviews
    .mockResolvedValueOnce({
      entries: [
        {
          id: "kept",
          entry: JSON.stringify({ due: "2026-09-22", fen: "in-repertoire", rating: 3 }),
        },
      ],
      nextCursor: "retry",
    })
    .mockRejectedValueOnce(new Error("page failed"));
  const showLogs = [...(container?.querySelectorAll("button") ?? [])].find((button) =>
    button.textContent?.includes("Board.Practice.ShowLogs"),
  );
  await act(async () => showLogs?.click());
  await vi.waitFor(() =>
    expect(container?.querySelectorAll("[data-practice-entry-id]")).toHaveLength(1),
  );
  const loadMore = [...(container?.querySelectorAll("button") ?? [])].find((button) =>
    button.textContent?.includes("Board.Practice.LoadMore"),
  );
  await act(async () => loadMore?.click());
  await vi.waitFor(() => expect(container?.textContent).toContain("Board.Practice.LogsLoadFailed"));
  expect(container?.querySelectorAll("[data-practice-entry-id]")).toHaveLength(1);
  expect(container?.textContent).toContain("Board.Practice.LoadMore");
});

test("drops a late log page after the modal closes", async () => {
  let release!: (value: { entries: any[]; nextCursor: null }) => void;
  fixtures.loadPracticeReviews.mockImplementationOnce(
    () => new Promise((resolve) => (release = resolve)),
  );
  const showLogs = [...(container?.querySelectorAll("button") ?? [])].find((button) =>
    button.textContent?.includes("Board.Practice.ShowLogs"),
  );
  await act(async () => showLogs?.click());
  const close = container?.querySelector<HTMLButtonElement>('button[aria-label="close"]');
  await act(async () => close?.click());
  release({
    entries: [{ id: "late", entry: JSON.stringify({ due: "2026-09-22", fen: "gone", rating: 3 }) }],
    nextCursor: null,
  });
  await act(async () => Promise.resolve());
  expect(container?.textContent).not.toContain("late");
});
