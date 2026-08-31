import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  countPgnGames: vi.fn(),
  notify: vi.fn(),
  setCurrentTab: vi.fn(),
  setGames: vi.fn(),
}));
const currentTabAtom = {};
const currentTab = {
  value: "tab-a",
  gameOrigin: {
    kind: "file" as const,
    gameNumber: 0,
    file: {
      type: "file" as const,
      handle: { id: { id: "workspace-token" }, kind: "fileWorkspace" as const },
      name: "games.pgn",
      numGames: 3,
      metadata: { type: "game" as const, tags: [] },
      lastModified: 1,
    },
  },
};

vi.mock("@/platform/tauri", () => ({ tauri: { countPgnGames: mocks.countPgnGames } }));
vi.mock("@/state/atoms", () => ({ currentTabAtom }));
vi.mock("jotai", () => ({
  useAtom: () => [currentTab, mocks.setCurrentTab],
}));
vi.mock("@mantine/notifications", () => ({ notifications: { show: mocks.notify } }));
vi.mock("@mantine/core", () => {
  const element = ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
    <div {...props}>{children}</div>
  );
  return {
    Code: element,
    Divider: element,
    Group: element,
    Text: element,
    Tooltip: element,
  };
});
vi.mock("@tabler/icons-react", () => ({ IconReload: () => null }));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@/components/common/IconAction", () => ({
  IconAction: ({
    children,
    label,
    onClick,
  }: {
    children: React.ReactNode;
    label: string;
    onClick: () => void;
  }) => (
    <button type="button" aria-label={label} onClick={onClick}>
      {children}
    </button>
  ),
}));
vi.mock("@/utils/format", () => ({ formatNumber: (value: number) => String(value) }));
vi.mock("@/utils/tabs", () => ({
  getTabFile: vi.fn((tab: typeof currentTab) => tab.gameOrigin.file),
}));

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

let container: HTMLDivElement;
let root: Root;

beforeEach(async () => {
  vi.clearAllMocks();
  mocks.countPgnGames.mockRejectedValue(new Error("permission denied"));
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  const FileInfo = (await import("./FileInfo")).default;
  await act(async () => root.render(<FileInfo setGames={mocks.setGames} />));
});

afterEach(async () => {
  currentTab.value = "tab-a";
  currentTab.gameOrigin.file.numGames = 3;
  await act(async () => root.unmount());
  container.remove();
});

async function clickReload() {
  await act(async () => {
    container.querySelector("button")!.click();
    await Promise.resolve();
  });
}

test("notifies when reloading a file fails without clearing its games", async () => {
  await clickReload();

  expect(mocks.notify).toHaveBeenCalledWith({
    color: "red",
    title: "Common.Error",
    message: "permission denied",
  });
  expect(mocks.setGames).not.toHaveBeenCalled();
});

test("reloads the game count after a successful native count", async () => {
  mocks.countPgnGames.mockResolvedValueOnce(7);
  await clickReload();

  expect(mocks.setGames).toHaveBeenCalledWith(new Map());
  expect(mocks.setCurrentTab).toHaveBeenCalledOnce();
  expect(mocks.notify).not.toHaveBeenCalled();
});

test("keeps a cancelled reload silent", async () => {
  mocks.countPgnGames.mockRejectedValueOnce(new Error("Cancellation"));
  await clickReload();

  expect(mocks.notify).not.toHaveBeenCalled();
  expect(mocks.setGames).not.toHaveBeenCalled();
});

test("reload updater leaves a non-file tab unchanged", async () => {
  mocks.countPgnGames.mockResolvedValueOnce(9);
  await clickReload();
  const updater = mocks.setCurrentTab.mock.calls[0][0] as (prev: unknown) => unknown;
  const playTab = { value: "tab-a", gameOrigin: { kind: "play" } };
  expect(updater(playTab)).toBe(playTab);
  const otherTab = { ...currentTab, value: "tab-b" };
  expect(updater(otherTab)).toBe(otherTab);
  const next = updater(currentTab) as typeof currentTab;
  expect(next.gameOrigin.file.numGames).toBe(9);
});

test("reload ignores a count that finished after the tab changed", async () => {
  let resolveCount!: (value: number) => void;
  mocks.countPgnGames.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        resolveCount = resolve;
      }),
  );
  const pending = clickReload();
  currentTab.value = "tab-b";
  const FileInfo = (await import("./FileInfo")).default;
  await act(async () => root.render(<FileInfo setGames={mocks.setGames} />));
  await act(async () => resolveCount(11));
  await pending;
  expect(mocks.setCurrentTab).not.toHaveBeenCalled();
  expect(mocks.setGames).not.toHaveBeenCalled();
});

test("renders nothing when the tab has no file", async () => {
  const { getTabFile } = await import("@/utils/tabs");
  vi.mocked(getTabFile).mockReturnValueOnce(undefined);
  const FileInfo = (await import("./FileInfo")).default;
  await act(async () => root.render(<FileInfo setGames={mocks.setGames} />));
  expect(container.querySelector("button")).toBeNull();
});
