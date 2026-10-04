import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { Provider, createStore } from "jotai";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import type { AppError, AppErrorCategory } from "@/platform/errors";
import type { ManagedDatabaseInfo } from "@/utils/db";
import { accountDownloadsInFlightAtom, databaseConversionStateAtom } from "@/state/atoms";
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
  getDatabases: vi.fn(),
  logFailureSafely: vi.fn(),
  notify: vi.fn(),
  warn: vi.fn(),
  downloadChessCom: vi.fn(),
  downloadLichess: vi.fn(),
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
vi.mock("@/utils/lichess/api", () => ({ downloadLichess: mocks.downloadLichess }));
vi.mock("@/utils/db", async () => {
  const actual = await vi.importActual<typeof import("@/utils/db")>("@/utils/db");
  return { ...actual, getDatabases: mocks.getDatabases };
});
vi.mock("@/platform/errors", async () => {
  const actual = await vi.importActual<typeof import("@/platform/errors")>("@/platform/errors");
  return { ...actual, logFailureSafely: mocks.logFailureSafely };
});
vi.mock("@mantine/notifications", () => ({ notifications: { show: mocks.notify } }));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@/platform/native", () => ({ warn: mocks.warn }));
vi.mock("@/components/common/IconAction", () => ({
  IconAction: ({
    label,
    onClick,
    disabled,
    pending,
  }: {
    label: string;
    onClick?: () => void;
    disabled?: boolean;
    pending?: boolean;
  }) => (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      data-pending={pending ? "true" : undefined}
      onClick={onClick}
    >
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
  mocks.getDatabases.mockResolvedValue([]);
  mocks.logFailureSafely.mockResolvedValue(undefined);
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});

async function renderCard(props: Partial<React.ComponentProps<typeof AccountCard>> = {}) {
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
          {...props}
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

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((settle) => {
    resolve = settle;
  });
  return { promise, resolve };
}

function accountDatabases(type: "chesscom" | "lichess" = "chesscom"): ManagedDatabaseInfo[] {
  return [
    {
      type: "success",
      file: { id: { id: "database" }, kind: "database" },
      filename: `Felix_${type}.db3`,
      title: "Felix",
      description: "",
      player_count: 2,
      event_count: 1,
      game_count: 3,
      storage_size: 0n,
      indexed: false,
    },
  ];
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

function configureSuccessfulDownload(type: "chesscom" | "lichess" = "chesscom") {
  const artifact = { id: { id: "pgn" }, kind: "fileWorkspace" as const };
  const root = { id: { id: "database-root" }, kind: "databaseRoot" as const };
  const handle = { id: { id: "database" }, kind: "database" as const };
  const lease = { id: `${type}_Felix`, generation: 1n };
  mocks.getLatestGameTimestamp.mockResolvedValue(null);
  mocks.downloadChessCom.mockResolvedValue(artifact);
  mocks.downloadLichess.mockResolvedValue(artifact);
  mocks.getDatabaseWorkspace.mockResolvedValue(root);
  mocks.listWorkspaceDatabases.mockResolvedValue([
    { handle, filename: `Felix_${type}.db3`, availability: "available" },
  ]);
  mocks.startProgress.mockResolvedValue(lease);
  mocks.convertPgn.mockResolvedValue(undefined);
  mocks.setProgressState.mockResolvedValue(undefined);
  mocks.deleteEmptyGames.mockResolvedValue(undefined);
}

test.each(["chesscom", "lichess"] as const)(
  "a successful %s download refreshes databases after deleting empty games without a finished frame",
  async (type) => {
    configureSuccessfulDownload(type);
    let resolveDeletion!: () => void;
    mocks.deleteEmptyGames.mockReturnValue(
      new Promise<void>((resolve) => {
        resolveDeletion = resolve;
      }),
    );
    mocks.issueDownloadDestination.mockResolvedValue({ id: "dest" });
    const setDatabases = vi.fn();
    const databases = accountDatabases(type);
    mocks.getDatabases.mockResolvedValue(databases);
    await renderCard({ type, accountHandle: "account", setDatabases });

    await act(async () => downloadButton().click());

    expect(mocks.deleteEmptyGames).toHaveBeenCalledWith({
      id: { id: "database" },
      kind: "database",
    });
    expect(mocks.getDatabases).not.toHaveBeenCalled();
    expect(setDatabases).not.toHaveBeenCalled();
    expect(downloadButton().disabled).toBe(true);
    expect(downloadButton().getAttribute("data-pending")).toBe("true");

    await act(async () => resolveDeletion());

    expect(mocks.getDatabases).toHaveBeenCalledTimes(1);
    expect(setDatabases).toHaveBeenCalledWith(databases);
    expect(mocks.notify).not.toHaveBeenCalled();
    expect(downloadButton().disabled).toBe(false);
    expect(downloadButton().getAttribute("data-pending")).toBeNull();
  },
);

test("a finished progress frame leaves Download pending until cleanup and refresh settle", async () => {
  configureSuccessfulDownload();
  mocks.issueDownloadDestination.mockResolvedValue({ id: "dest" });
  const deletion = deferred<void>();
  const refresh = deferred<ManagedDatabaseInfo[]>();
  mocks.deleteEmptyGames.mockReturnValue(deletion.promise);
  mocks.getDatabases.mockReturnValue(refresh.promise);
  const setDatabases = vi.fn();
  await renderCard({ setDatabases });
  await act(async () => downloadButton().click());
  expect(mocks.deleteEmptyGames).toHaveBeenCalledTimes(1);

  await act(async () => {
    mocks.progress.mock.calls[0][0]({
      payload: {
        id: "chesscom_Felix",
        generation: 1n,
        progress: 100,
        finished: true,
        state: "succeeded",
        cleared: false,
      },
    });
  });

  expect(downloadButton().disabled).toBe(true);
  expect(downloadButton().getAttribute("data-pending")).toBe("true");
  expect(store.get(accountDownloadsInFlightAtom).has("chesscom_Felix")).toBe(true);
  expect(mocks.getDatabases).not.toHaveBeenCalled();
  await act(async () => deletion.resolve());
  expect(mocks.getDatabases).toHaveBeenCalledTimes(1);
  expect(downloadButton().disabled).toBe(true);
  expect(downloadButton().getAttribute("data-pending")).toBe("true");
  const databases = accountDatabases();
  await act(async () => refresh.resolve(databases));
  expect(setDatabases).toHaveBeenCalledWith(databases);
  expect(downloadButton().disabled).toBe(false);
  expect(downloadButton().getAttribute("data-pending")).toBeNull();
  expect(store.get(accountDownloadsInFlightAtom).size).toBe(0);
});

test("a remounted account stays pending and cannot start a second download", async () => {
  configureSuccessfulDownload();
  mocks.issueDownloadDestination.mockResolvedValue({ id: "dest" });
  const conversion = deferred<void>();
  mocks.convertPgn.mockReturnValue(conversion.promise);
  const props = { setDatabases: vi.fn() };
  await renderCard(props);
  await act(async () => downloadButton().click());
  expect(mocks.convertPgn).toHaveBeenCalledTimes(1);
  await act(async () => root.unmount());
  root = createRoot(host);
  await renderCard(props);

  expect(downloadButton().disabled).toBe(true);
  expect(downloadButton().getAttribute("data-pending")).toBe("true");
  await act(async () => downloadButton().click());
  expect(mocks.downloadChessCom).toHaveBeenCalledTimes(1);
  expect(mocks.convertPgn).toHaveBeenCalledTimes(1);

  await act(async () => conversion.resolve());
  expect(downloadButton().disabled).toBe(false);
  expect(downloadButton().getAttribute("data-pending")).toBeNull();
  expect(store.get(accountDownloadsInFlightAtom).size).toBe(0);
});

test("a failed deleteEmptyGames refreshes databases and notifies the cleanup error", async () => {
  configureSuccessfulDownload();
  mocks.issueDownloadDestination.mockResolvedValue({ id: "dest" });
  mocks.deleteEmptyGames.mockRejectedValue(new Error("cleanup failed"));
  const databases = accountDatabases();
  mocks.getDatabases.mockResolvedValue(databases);
  const setDatabases = vi.fn();
  await renderCard({ setDatabases });

  await act(async () => downloadButton().click());

  expect(mocks.getDatabases).toHaveBeenCalledTimes(1);
  expect(setDatabases).toHaveBeenCalledExactlyOnceWith(databases);
  expect(mocks.notify).toHaveBeenCalledExactlyOnceWith({
    color: "red",
    title: "Common.Error",
    message: "cleanup failed",
  });
  expect(downloadButton().disabled).toBe(false);
  expect(store.get(accountDownloadsInFlightAtom).size).toBe(0);
});

test("a failed convertPgn refreshes the newly created database and skips cleanup", async () => {
  configureSuccessfulDownload();
  mocks.issueDownloadDestination.mockResolvedValue({ id: "dest" });
  mocks.listWorkspaceDatabases.mockResolvedValue([]);
  mocks.createWorkspaceDatabase.mockResolvedValue({
    id: { id: "database" },
    kind: "database",
  });
  mocks.convertPgn.mockRejectedValue(new Error("convert failed"));
  const databases = accountDatabases();
  mocks.getDatabases.mockResolvedValue(databases);
  const setDatabases = vi.fn();
  await renderCard({ setDatabases });

  await act(async () => downloadButton().click());

  expect(mocks.createWorkspaceDatabase).toHaveBeenCalledTimes(1);
  expect(mocks.getDatabases).toHaveBeenCalledTimes(1);
  expect(setDatabases).toHaveBeenCalledExactlyOnceWith(databases);
  expect(mocks.deleteEmptyGames).not.toHaveBeenCalled();
  expect(mocks.notify).toHaveBeenCalledExactlyOnceWith({
    color: "red",
    title: "Common.Error",
    message: "convert failed",
  });
  expect(downloadButton().disabled).toBe(false);
  expect(store.get(accountDownloadsInFlightAtom).size).toBe(0);
});

test("a refresh failure after failed conversion logs without replacing the conversion error", async () => {
  configureSuccessfulDownload();
  mocks.issueDownloadDestination.mockResolvedValue({ id: "dest" });
  mocks.convertPgn.mockRejectedValue(new Error("convert failed"));
  mocks.getDatabases.mockRejectedValue(new Error("refresh failed"));
  const setDatabases = vi.fn();
  await renderCard({ setDatabases });

  await act(async () => downloadButton().click());

  expect(mocks.getDatabases).toHaveBeenCalledTimes(1);
  expect(setDatabases).not.toHaveBeenCalled();
  expect(mocks.deleteEmptyGames).not.toHaveBeenCalled();
  expect(mocks.logFailureSafely).toHaveBeenCalledExactlyOnceWith(
    "Account import database refresh failed: refresh failed",
    {
      operation: "account import database refresh",
      primaryFailure: { category: "unexpected", message: "refresh failed" },
    },
    "Account import refresh logging failed",
  );
  expect(mocks.notify).toHaveBeenCalledExactlyOnceWith({
    color: "red",
    title: "Common.Error",
    message: "convert failed",
  });
  expect(downloadButton().disabled).toBe(false);
  expect(store.get(accountDownloadsInFlightAtom).size).toBe(0);
});

test("a finished progress frame for the card does not refresh databases", async () => {
  const setDatabases = vi.fn();
  await renderCard({ setDatabases });
  const progressListener = mocks.progress.mock.calls[0][0];

  await act(async () => {
    progressListener({
      payload: {
        id: "chesscom_Felix",
        generation: 1n,
        progress: 100,
        finished: true,
        state: "succeeded",
        cleared: false,
      },
    });
  });

  expect(mocks.getDatabases).not.toHaveBeenCalled();
  expect(setDatabases).not.toHaveBeenCalled();
  expect(downloadButton().disabled).toBe(false);
  expect(downloadButton().getAttribute("data-pending")).toBeNull();
});

test("a failed post-import database refresh notifies after deleting empty games", async () => {
  configureSuccessfulDownload();
  mocks.issueDownloadDestination.mockResolvedValue({ id: "dest" });
  mocks.getDatabases.mockRejectedValue(new Error("refresh failed"));
  const setDatabases = vi.fn();
  await renderCard({ setDatabases });

  await act(async () => downloadButton().click());

  expect(mocks.deleteEmptyGames).toHaveBeenCalledTimes(1);
  expect(setDatabases).not.toHaveBeenCalled();
  expect(mocks.getDatabases).toHaveBeenCalledTimes(1);
  expect(mocks.notify).toHaveBeenCalledExactlyOnceWith({
    color: "red",
    title: "Common.Error",
    message: "refresh failed",
  });
  expect(downloadButton().disabled).toBe(false);
});

test.each([
  { label: "Home.Accounts.UpdateStats", prop: "reload" },
  { label: "Home.Accounts.RemoveAccount", prop: "logout" },
] as const)(
  "a rejecting $prop notifies without an unhandled rejection",
  async ({ label, prop }) => {
    const callback = vi.fn().mockRejectedValue(new Error(`${prop} failed`));
    await renderCard({ type: prop === "logout" ? "lichess" : "chesscom", [prop]: callback });

    await act(async () => {
      host.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)!.click();
    });

    expect(callback).toHaveBeenCalledTimes(1);
    expect(mocks.notify).toHaveBeenCalledWith({
      color: "red",
      title: "Common.Error",
      message: `${prop} failed`,
    });
  },
);

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
  let destinationAtPicker: string | null | undefined;
  mocks.issueDownloadDestination.mockImplementation(() => {
    destinationAtPicker = localStorage.getItem(DOWNLOAD_DESTINATION_KEY);
    return Promise.reject(new Error("picker failed"));
  });
  await renderCard();

  await act(async () => downloadButton().click());

  expect(destinationAtPicker).toBe("null");
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
    expect.stringMatching(/^conversion:[0-9a-f-]{36}$/),
    [artifact],
    handle,
    null,
    "Felix Chess.com",
    null,
  );
  expect(mocks.setProgressState).toHaveBeenCalledWith(lease, 0, "failed");
  expect(mocks.logFailureSafely).toHaveBeenCalledWith(
    `Account import progress update (failed) failed for ${lease.id} [${mocks.convertPgn.mock.calls[0][0]}]: progress failed`,
    {
      operation: "account import progress update",
      primaryFailure: { category: "unexpected", message: "progress failed" },
    },
    `Account import progress logging failed (failed) for ${lease.id} [${mocks.convertPgn.mock.calls[0][0]}]`,
  );
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
  expect(store.get(databaseConversionStateAtom)).toEqual([]);
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
    expect.stringMatching(/^conversion:[0-9a-f-]{36}$/),
    [artifact],
    handle,
    null,
    "Felix Chess.com",
    null,
  );
  expect(mocks.setProgressState).toHaveBeenCalledWith(lease, 100, "succeeded");
  expect(mocks.logFailureSafely).toHaveBeenCalledWith(
    `Account import progress update (succeeded) failed for ${lease.id} [${mocks.convertPgn.mock.calls[0][0]}]: progress failed`,
    {
      operation: "account import progress update",
      primaryFailure: { category: "unexpected", message: "progress failed" },
    },
    `Account import progress logging failed (succeeded) for ${lease.id} [${mocks.convertPgn.mock.calls[0][0]}]`,
  );
  expect(mocks.deleteEmptyGames).toHaveBeenCalledWith(handle);
  expect(mocks.notify).not.toHaveBeenCalled();
  expect(downloadButton().disabled).toBe(false);
  expect(store.get(databaseConversionStateAtom)).toEqual([]);
});

test("startProgress failure removes the registered conversion before convertPgn", async () => {
  configureSuccessfulDownload();
  mocks.issueDownloadDestination.mockResolvedValue({ id: "dest" });
  mocks.convertPgn.mockClear();
  let registeredAtStart: unknown;
  mocks.startProgress.mockImplementation(async () => {
    registeredAtStart = store.get(databaseConversionStateAtom);
    throw new Error("start failed");
  });
  await renderCard();
  await act(async () => downloadButton().click());
  expect(registeredAtStart).toEqual([
    expect.objectContaining({
      id: expect.stringMatching(/^conversion:[0-9a-f-]{36}$/),
      targetDatabase: { id: { id: "database" }, kind: "database" },
      targetDatabaseTitle: "Felix Chess.com",
    }),
  ]);
  expect(mocks.convertPgn).not.toHaveBeenCalled();
  expect(store.get(databaseConversionStateAtom)).toEqual([]);
  expect(mocks.notify).toHaveBeenCalledWith({
    color: "red",
    title: "Common.Error",
    message: "start failed",
  });
  expect(downloadButton().disabled).toBe(false);
});
