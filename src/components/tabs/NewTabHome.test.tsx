import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

const fixtures = vi.hoisted(() => ({
  atoms: {
    activeTab: Symbol("active-tab"),
    addRecentFile: Symbol("add-recent-file"),
    deckFamily: Symbol("deck-family"),
    recentFiles: Symbol("recent-files"),
    tabFamily: Symbol("tab-family"),
    tabs: Symbol("tabs"),
  },
  countPgnGames: vi.fn(),
  createTab: vi.fn(),
  notify: vi.fn(),
  readGames: vi.fn(),
  recentFiles: [] as Array<{
    name: string;
    handle: { id: { id: string }; kind: "fileWorkspace" };
    type: "game";
    lastOpened: number;
  }>,
  setRecentFiles: vi.fn(),
}));

vi.mock("@/platform/tauri", () => ({
  tauri: {
    countPgnGames: fixtures.countPgnGames,
    readGames: fixtures.readGames,
  },
}));
vi.mock("@mantine/notifications", () => ({ notifications: { show: fixtures.notify } }));
vi.mock("@/state/atoms", () => ({
  activeTabAtom: fixtures.atoms.activeTab,
  addRecentFileAtom: fixtures.atoms.addRecentFile,
  deckAtomFamily: fixtures.atoms.deckFamily,
  recentFilesAtom: fixtures.atoms.recentFiles,
  tabFamily: fixtures.atoms.tabFamily,
  tabsAtom: fixtures.atoms.tabs,
}));
vi.mock("jotai", () => ({
  useAtom: (atom: symbol) =>
    atom === fixtures.atoms.recentFiles
      ? [fixtures.recentFiles, fixtures.setRecentFiles]
      : [[], vi.fn()],
  useSetAtom: () => vi.fn(),
  useStore: () => ({ set: vi.fn() }),
}));
vi.mock("@tanstack/react-router", () => ({ useNavigate: () => vi.fn() }));
vi.mock("@/utils/pathCapabilities", () => ({
  fileWorkspaceKey: (handle: { id: { id: string } }) => handle.id.id,
}));
vi.mock("@/components/files/opening", () => ({ getStats: () => ({ due: 0, unseen: 0 }) }));
vi.mock("@/utils/tabs", () => ({ createTab: fixtures.createTab }));
vi.mock("./CreateRepertoireModal", () => ({ default: () => null }));
vi.mock("./ImportModal", () => ({ default: () => null }));
vi.mock("../icons/Chessboard", () => ({ default: () => null }));
vi.mock("@/components/files/FileIcon", () => ({ FileIcon: () => null }));
vi.mock("@tabler/icons-react", () => ({
  IconChess: () => null,
  IconClock: () => null,
  IconFileImport: () => null,
  IconPuzzle: () => null,
  IconTarget: () => null,
  IconTargetArrow: () => null,
}));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@mantine/core", () => {
  const element = ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
    <div {...props}>{children}</div>
  );
  return {
    Badge: element,
    Box: element,
    Button: element,
    Card: element,
    Group: element,
    ScrollArea: { Autosize: element },
    SimpleGrid: element,
    Stack: element,
    Text: element,
    Tooltip: element,
    UnstyledButton: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
      <button type="button" {...props}>
        {children}
      </button>
    ),
  };
});

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  vi.clearAllMocks();
  fixtures.recentFiles = [
    {
      name: "stale.pgn",
      handle: { id: { id: "stale" }, kind: "fileWorkspace" },
      type: "game",
      lastOpened: 1,
    },
  ];
  fixtures.countPgnGames.mockResolvedValue(1);
  fixtures.createTab.mockResolvedValue("tab-id");
  fixtures.readGames.mockResolvedValue(["*"]);
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

test("does not let an obsolete recent-file check overwrite newer atom state", async () => {
  const NewTabHome = (await import("./NewTabHome")).default;
  let rejectStaleCheck: ((reason?: unknown) => void) | undefined;
  fixtures.countPgnGames.mockImplementation((handle: { id: { id: string } }) => {
    if (handle.id.id === "stale") {
      return new Promise((_, reject) => {
        rejectStaleCheck = reject;
      });
    }
    return Promise.resolve(1);
  });

  await act(async () => {
    root.render(<NewTabHome id="new-tab" />);
  });

  fixtures.recentFiles = [
    {
      name: "current.pgn",
      handle: { id: { id: "current" }, kind: "fileWorkspace" },
      type: "game",
      lastOpened: 2,
    },
  ];
  await act(async () => {
    root.render(<NewTabHome id="new-tab" />);
  });
  await act(async () => rejectStaleCheck?.(new Error("file disappeared")));

  expect(fixtures.setRecentFiles).not.toHaveBeenCalled();
});

test("notifies when opening a recent file is denied without creating a tab", async () => {
  const NewTabHome = (await import("./NewTabHome")).default;
  fixtures.readGames.mockRejectedValueOnce(new Error("permission denied"));

  await act(async () => {
    root.render(<NewTabHome id="new-tab" />);
  });
  const recentFile = [...container.querySelectorAll("button")].find((button) =>
    button.textContent?.includes("stale"),
  )!;
  await act(async () => {
    recentFile.click();
    await Promise.resolve();
  });

  expect(fixtures.notify).toHaveBeenCalledWith({
    color: "red",
    title: "Common.Error",
    message: "permission denied",
  });
  expect(fixtures.createTab).not.toHaveBeenCalled();
});

test("keeps recent-file cancellation silent without creating a tab", async () => {
  const NewTabHome = (await import("./NewTabHome")).default;
  fixtures.readGames.mockRejectedValueOnce(new Error("Cancellation"));

  await act(async () => {
    root.render(<NewTabHome id="new-tab" />);
  });
  const recentFile = [...container.querySelectorAll("button")].find((button) =>
    button.textContent?.includes("stale"),
  )!;
  await act(async () => {
    recentFile.click();
    await Promise.resolve();
  });

  expect(fixtures.notify).not.toHaveBeenCalled();
  expect(fixtures.createTab).not.toHaveBeenCalled();
});
