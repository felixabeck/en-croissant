import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { AccountCard } from "./AccountCard";

const mocks = vi.hoisted(() => ({
  issueDownloadDestination: vi.fn(),
  getLatestGameTimestamp: vi.fn(),
  getDatabaseWorkspace: vi.fn(),
  listWorkspaceDatabases: vi.fn(),
  createWorkspaceDatabase: vi.fn(),
  startProgress: vi.fn(),
  convertPgn: vi.fn(),
  setProgressState: vi.fn(),
  deleteEmptyGames: vi.fn(),
  notify: vi.fn(),
  downloadChessCom: vi.fn(),
  progress: vi.fn(),
}));

vi.mock("@/platform/tauri", () => ({
  tauri: {
    issueDownloadDestination: mocks.issueDownloadDestination,
    getLatestGameTimestamp: mocks.getLatestGameTimestamp,
    getDatabaseWorkspace: mocks.getDatabaseWorkspace,
    listWorkspaceDatabases: mocks.listWorkspaceDatabases,
    createWorkspaceDatabase: mocks.createWorkspaceDatabase,
    startProgress: mocks.startProgress,
    convertPgn: mocks.convertPgn,
    setProgressState: mocks.setProgressState,
    deleteEmptyGames: mocks.deleteEmptyGames,
  },
  tauriSubscriptions: { progress: mocks.progress },
}));
vi.mock("@/utils/chess.com/api", () => ({ downloadChessCom: mocks.downloadChessCom }));
vi.mock("@/utils/lichess/api", () => ({ downloadLichess: vi.fn() }));
vi.mock("@/utils/db", () => ({ getDatabases: vi.fn() }));
vi.mock("@mantine/notifications", () => ({ notifications: { show: mocks.notify } }));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("jotai", async (importOriginal) => ({
  ...(await importOriginal<typeof import("jotai")>()),
  useAtom: () => [null, vi.fn()],
}));
vi.mock("@/state/atoms", () => ({
  downloadDestinationAtom: Symbol("downloadDestination"),
  databaseConversionStateAtom: Symbol("conversion"),
}));
vi.mock("@/platform/useTauriListener", () => ({
  useTauriListener: () => undefined,
}));
vi.mock("@/components/common/IconAction", () => ({
  IconAction: ({
    label,
    onClick,
    disabled,
  }: {
    label: string;
    onClick?: () => void;
    disabled?: boolean;
  }) => (
    <button type="button" aria-label={label} disabled={disabled} onClick={onClick}>
      {label}
    </button>
  ),
}));
vi.mock("@mantine/core", () => ({
  Badge: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
  Card: Object.assign(({ children }: { children: React.ReactNode }) => <div>{children}</div>, {
    Section: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  }),
  Group: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Progress: () => null,
  SimpleGrid: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Stack: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Text: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock("@tabler/icons-react", () => ({
  IconArrowDownRight: () => null,
  IconArrowRight: () => null,
  IconArrowUpRight: () => null,
  IconCircleCheckFilled: () => null,
  IconDownload: () => null,
  IconRefresh: () => null,
  IconTrash: () => null,
}));
vi.mock("./LichessLogo", () => ({ default: () => null }));

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

let root: Root;
let host: HTMLDivElement;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.progress.mockResolvedValue(vi.fn());
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});

async function renderCard() {
  await act(async () => {
    root.render(
      <AccountCard
        type="chesscom"
        database={null}
        title="Felix"
        updatedAt={0}
        total={0}
        stats={[]}
        logout={vi.fn()}
        reload={vi.fn()}
        setDatabases={vi.fn()}
      />,
    );
  });
}

function downloadButton() {
  return host.querySelector(
    'button[aria-label="Home.Accounts.DownloadGames"]',
  ) as HTMLButtonElement;
}

test("cancelled game-download destination stays silent", async () => {
  mocks.issueDownloadDestination.mockRejectedValue(new Error("Cancellation"));
  await renderCard();
  await act(async () => downloadButton().click());
  expect(mocks.downloadChessCom).not.toHaveBeenCalled();
  expect(mocks.notify).not.toHaveBeenCalled();
  expect(downloadButton().disabled).toBe(false);
});

test("failed game-download destination notifies and re-enables the button", async () => {
  mocks.issueDownloadDestination.mockRejectedValue(new Error("permission denied"));
  await renderCard();
  await act(async () => downloadButton().click());
  expect(mocks.downloadChessCom).not.toHaveBeenCalled();
  expect(mocks.notify).toHaveBeenCalledWith({
    color: "red",
    title: "Common.Error",
    message: "permission denied",
  });
  expect(downloadButton().disabled).toBe(false);
});

test("convertPgn failure is not masked when marking the lease failed also rejects", async () => {
  const destination = { id: "dest" };
  const artifact = { id: { id: "pgn" }, kind: "fileWorkspace" as const };
  const root = { id: { id: "database-root" }, kind: "databaseRoot" };
  const handle = { id: { id: "database" }, kind: "database" };
  const lease = { id: "chesscom_Felix", generation: 1n };
  mocks.issueDownloadDestination.mockResolvedValue(destination);
  mocks.downloadChessCom.mockResolvedValue(artifact);
  mocks.getDatabaseWorkspace.mockResolvedValue(root);
  mocks.listWorkspaceDatabases.mockResolvedValue([
    { handle, filename: "Felix_chesscom.db3", availability: "available" },
  ]);
  mocks.startProgress.mockResolvedValue(lease);
  mocks.convertPgn.mockRejectedValue(new Error("convert failed"));
  mocks.setProgressState.mockRejectedValue(new Error("progress failed"));
  await renderCard();
  await act(async () => downloadButton().click());
  expect(mocks.convertPgn).toHaveBeenCalled();
  expect(mocks.setProgressState).toHaveBeenCalledWith(lease, 0, "failed");
  expect(mocks.deleteEmptyGames).not.toHaveBeenCalled();
  expect(mocks.notify).toHaveBeenCalledWith({
    color: "red",
    title: "Common.Error",
    message: "convert failed",
  });
  expect(mocks.notify).not.toHaveBeenCalledWith(
    expect.objectContaining({ message: "progress failed" }),
  );
  expect(downloadButton().disabled).toBe(false);
});
