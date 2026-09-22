import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { Provider, createStore } from "jotai";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import type { AppError, AppErrorCategory } from "@/platform/errors";
import { conversionProgressId } from "@/utils/db";
import { AccountCard } from "./AccountCard";

const mocks = vi.hoisted(() => ({
  issueDownloadDestination: vi.fn(),
  downloadDestinationIsKnown: vi.fn(),
  getLatestGameTimestamp: vi.fn(),
  getDatabaseWorkspace: vi.fn(),
  listWorkspaceDatabases: vi.fn(),
  createWorkspaceDatabase: vi.fn(),
  startProgress: vi.fn(),
  convertPgn: vi.fn(),
  setProgressState: vi.fn(),
  deleteEmptyGames: vi.fn(),
  notify: vi.fn(),
  warn: vi.fn(),
  downloadChessCom: vi.fn(),
  progress: vi.fn(),
}));

vi.mock("@/platform/tauri", () => ({
  tauri: {
    issueDownloadDestination: mocks.issueDownloadDestination,
    downloadDestinationIsKnown: mocks.downloadDestinationIsKnown,
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
vi.mock("@/utils/db", async () => {
  const actual = await vi.importActual<typeof import("@/utils/db")>("@/utils/db");
  return { ...actual, getDatabases: vi.fn() };
});
vi.mock("@mantine/notifications", () => ({ notifications: { show: mocks.notify } }));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@/platform/native", () => ({ warn: mocks.warn }));
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
let store: ReturnType<typeof createStore>;

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  store = createStore();
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
      <Provider store={store}>
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
        />
      </Provider>,
    );
  });
}

function downloadButton() {
  return host.querySelector(
    'button[aria-label="Home.Accounts.DownloadGames"]',
  ) as HTMLButtonElement;
}

const DOWNLOAD_DESTINATION_KEY = "download-destination-capability";
const CATEGORY_CASES = {
  cancelled: { message: "cancelled download failed" },
  network: { message: "network download failed" },
  "not-found": { message: "not-found download failed" },
  "applied-despite-error": { message: "applied-despite-error download failed" },
  permission: { message: "permission download failed" },
  validation: { message: "validation download failed" },
  unexpected: { message: "unexpected download failed" },
} satisfies Record<AppErrorCategory, { message: string }>;

function configureSuccessfulDownload() {
  const artifact = { id: { id: "pgn" }, kind: "fileWorkspace" as const };
  const root = { id: { id: "database-root" }, kind: "databaseRoot" as const };
  const handle = { id: { id: "database" }, kind: "database" as const };
  const lease = { id: "chesscom_Felix", generation: 1n };
  mocks.getLatestGameTimestamp.mockResolvedValue(null);
  mocks.downloadChessCom.mockResolvedValue(artifact);
  mocks.getDatabaseWorkspace.mockResolvedValue(root);
  mocks.listWorkspaceDatabases.mockResolvedValue([
    { handle, filename: "Felix_chesscom.db3", availability: "available" },
  ]);
  mocks.startProgress.mockResolvedValue(lease);
  mocks.convertPgn.mockResolvedValue(undefined);
  mocks.setProgressState.mockResolvedValue(undefined);
  mocks.deleteEmptyGames.mockResolvedValue(undefined);
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

test("an unknown persisted destination is replaced before downloading", async () => {
  const stale = { id: "stale" };
  const fresh = { id: "fresh" };
  localStorage.setItem(DOWNLOAD_DESTINATION_KEY, JSON.stringify(stale));
  mocks.downloadDestinationIsKnown.mockResolvedValue(false);
  mocks.issueDownloadDestination.mockResolvedValue(fresh);
  configureSuccessfulDownload();
  await renderCard();

  await act(async () => downloadButton().click());

  expect(mocks.downloadDestinationIsKnown).toHaveBeenCalledTimes(1);
  expect(mocks.downloadDestinationIsKnown).toHaveBeenCalledWith(stale);
  expect(mocks.issueDownloadDestination).toHaveBeenCalledTimes(1);
  expect(mocks.downloadChessCom).toHaveBeenCalledTimes(1);
  expect(mocks.downloadChessCom).not.toHaveBeenCalledWith(
    stale,
    expect.anything(),
    expect.anything(),
  );
  expect(mocks.downloadChessCom).toHaveBeenCalledWith(fresh, "Felix", null);
  expect(localStorage.getItem(DOWNLOAD_DESTINATION_KEY)).toBe(JSON.stringify(fresh));
});

test("a known persisted destination is preserved", async () => {
  const destination = { id: "kept" };
  localStorage.setItem(DOWNLOAD_DESTINATION_KEY, JSON.stringify(destination));
  mocks.downloadDestinationIsKnown.mockResolvedValue(true);
  configureSuccessfulDownload();
  await renderCard();

  await act(async () => downloadButton().click());

  expect(mocks.downloadDestinationIsKnown).toHaveBeenCalledTimes(1);
  expect(mocks.downloadDestinationIsKnown).toHaveBeenCalledWith(destination);
  expect(mocks.issueDownloadDestination).not.toHaveBeenCalled();
  expect(mocks.downloadChessCom).toHaveBeenCalledWith(destination, "Felix", null);
  expect(localStorage.getItem(DOWNLOAD_DESTINATION_KEY)).toBe(JSON.stringify(destination));
});

test.each(Object.entries(CATEGORY_CASES) as Array<[AppErrorCategory, { message: string }]>)(
  "a known destination survives a %s download failure",
  async (category, { message }) => {
    const destination = { id: "kept" };
    const error: AppError = { category, message };
    localStorage.setItem(DOWNLOAD_DESTINATION_KEY, JSON.stringify(destination));
    mocks.downloadDestinationIsKnown.mockResolvedValue(true);
    mocks.downloadChessCom.mockRejectedValue(error);
    await renderCard();

    await act(async () => downloadButton().click());

    expect(mocks.downloadDestinationIsKnown).toHaveBeenCalledTimes(1);
    expect(mocks.downloadDestinationIsKnown).toHaveBeenCalledWith(destination);
    expect(mocks.issueDownloadDestination).not.toHaveBeenCalled();
    expect(mocks.downloadChessCom).toHaveBeenCalledWith(destination, "Felix", null);
    expect(localStorage.getItem(DOWNLOAD_DESTINATION_KEY)).toBe(JSON.stringify(destination));
    expect(mocks.notify).toHaveBeenCalledTimes(1);
    expect(mocks.notify).toHaveBeenCalledWith({
      color: "red",
      title: "Common.Error",
      message,
    });
  },
);

test("a cancelled download preserves the destination and stays silent", async () => {
  const destination = { id: "kept" };
  localStorage.setItem(DOWNLOAD_DESTINATION_KEY, JSON.stringify(destination));
  mocks.downloadDestinationIsKnown.mockResolvedValue(true);
  mocks.downloadChessCom.mockRejectedValue(new Error("Cancellation"));
  await renderCard();

  await act(async () => downloadButton().click());

  expect(mocks.downloadDestinationIsKnown).toHaveBeenCalledTimes(1);
  expect(mocks.downloadDestinationIsKnown).toHaveBeenCalledWith(destination);
  expect(mocks.issueDownloadDestination).not.toHaveBeenCalled();
  expect(mocks.downloadChessCom).toHaveBeenCalledWith(destination, "Felix", null);
  expect(localStorage.getItem(DOWNLOAD_DESTINATION_KEY)).toBe(JSON.stringify(destination));
  expect(mocks.notify).not.toHaveBeenCalled();
});

test("a rejecting destination query does not re-open the picker", async () => {
  const destination = { id: "kept" };
  localStorage.setItem(DOWNLOAD_DESTINATION_KEY, JSON.stringify(destination));
  mocks.downloadDestinationIsKnown.mockRejectedValue(new Error("query failed"));
  await renderCard();

  await act(async () => downloadButton().click());

  expect(mocks.downloadDestinationIsKnown).toHaveBeenCalledTimes(1);
  expect(mocks.downloadDestinationIsKnown).toHaveBeenCalledWith(destination);
  expect(mocks.issueDownloadDestination).not.toHaveBeenCalled();
  expect(mocks.downloadChessCom).not.toHaveBeenCalled();
  expect(mocks.notify).toHaveBeenCalledTimes(1);
  expect(localStorage.getItem(DOWNLOAD_DESTINATION_KEY)).toBe(JSON.stringify(destination));
});

test("a rejected replacement picker is not retried and clears the stale destination first", async () => {
  const stale = { id: "stale" };
  localStorage.setItem(DOWNLOAD_DESTINATION_KEY, JSON.stringify(stale));
  mocks.downloadDestinationIsKnown.mockResolvedValue(false);
  mocks.issueDownloadDestination.mockImplementation(() => {
    expect(localStorage.getItem(DOWNLOAD_DESTINATION_KEY)).toBe("null");
    return Promise.reject(new Error("picker failed"));
  });
  await renderCard();

  await act(async () => downloadButton().click());

  expect(mocks.downloadDestinationIsKnown).toHaveBeenCalledTimes(1);
  expect(mocks.issueDownloadDestination).toHaveBeenCalledTimes(1);
  expect(mocks.downloadChessCom).not.toHaveBeenCalled();
  expect(mocks.notify).toHaveBeenCalledTimes(1);
  expect(localStorage.getItem(DOWNLOAD_DESTINATION_KEY)).toBe("null");
});

test("invalid persisted destination storage is repaired without querying native state", async () => {
  localStorage.setItem(DOWNLOAD_DESTINATION_KEY, "not-json");
  mocks.issueDownloadDestination.mockRejectedValue(new Error("picker failed"));
  await renderCard();

  await act(async () => downloadButton().click());

  expect(mocks.downloadDestinationIsKnown).toHaveBeenCalledTimes(0);
  expect(mocks.issueDownloadDestination).toHaveBeenCalledTimes(1);
  expect(localStorage.getItem(DOWNLOAD_DESTINATION_KEY)).toBe("null");
});

test("convertPgn failure is not masked when marking the lease failed also rejects", async () => {
  const destination = { id: "dest" };
  const artifact = { id: { id: "pgn" }, kind: "fileWorkspace" as const };
  const root = { id: { id: "database-root" }, kind: "databaseRoot" };
  const handle = { id: { id: "database" }, kind: "database" as const };
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
  expect(mocks.convertPgn).toHaveBeenCalledWith(
    conversionProgressId(handle),
    [artifact],
    handle,
    null,
    "Felix Chess.com",
    null,
  );
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

test("a rejecting setProgressState after a successful convert still runs the post-import step", async () => {
  const destination = { id: "dest" };
  const artifact = { id: { id: "pgn" }, kind: "fileWorkspace" as const };
  const root = { id: { id: "database-root" }, kind: "databaseRoot" };
  const handle = { id: { id: "database" }, kind: "database" as const };
  const lease = { id: "chesscom_Felix", generation: 1n };
  mocks.issueDownloadDestination.mockResolvedValue(destination);
  mocks.downloadChessCom.mockResolvedValue(artifact);
  mocks.getDatabaseWorkspace.mockResolvedValue(root);
  mocks.listWorkspaceDatabases.mockResolvedValue([
    { handle, filename: "Felix_chesscom.db3", availability: "available" },
  ]);
  mocks.startProgress.mockResolvedValue(lease);
  mocks.convertPgn.mockResolvedValue(undefined);
  mocks.setProgressState.mockRejectedValue(new Error("progress failed"));
  mocks.deleteEmptyGames.mockResolvedValue(undefined);
  await renderCard();
  await act(async () => downloadButton().click());
  expect(mocks.convertPgn).toHaveBeenCalledWith(
    conversionProgressId(handle),
    [artifact],
    handle,
    null,
    "Felix Chess.com",
    null,
  );
  expect(mocks.setProgressState).toHaveBeenCalledWith(lease, 100, "succeeded");
  expect(mocks.deleteEmptyGames).toHaveBeenCalledWith(handle);
  expect(mocks.notify).not.toHaveBeenCalled();
  expect(downloadButton().disabled).toBe(false);
});
