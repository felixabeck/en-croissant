import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { Provider, createStore } from "jotai";
import { SWRConfig, type State } from "swr";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import type { AppError, AppErrorCategory } from "@/platform/errors";
import type { ArtifactPublication } from "@/bindings";
import english from "@/translation/en-US.json";
import type { ManagedDatabaseInfo } from "@/utils/db";
import { accountDownloadsInFlightAtom, databaseConversionStateAtom } from "@/state/atoms";
import { AccountCard } from "./AccountCard";

const mocks = vi.hoisted(() => {
  let nextDownloadTicket = 0;
  return {
    mintDownloadTicket: () => `opaque-download-ticket-${++nextDownloadTicket}`,
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
  };
});

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
vi.mock("@/utils/chess.com/api", () => ({
  downloadChessCom: (
    ...args: Parameters<typeof import("@/utils/chess.com/api").downloadChessCom>
  ) => {
    args[3](mocks.mintDownloadTicket());
    return mocks.downloadChessCom(...args);
  },
}));
vi.mock("@/utils/lichess/api", () => ({
  downloadLichess: (...args: Parameters<typeof import("@/utils/lichess/api").downloadLichess>) => {
    args[5](mocks.mintDownloadTicket());
    return mocks.downloadLichess(...args);
  },
}));
vi.mock("@/utils/db", async () => {
  const actual = await vi.importActual<typeof import("@/utils/db")>("@/utils/db");
  return { ...actual, getDatabases: mocks.getDatabases };
});
vi.mock("@/platform/errors", async () => {
  const actual = await vi.importActual<typeof import("@/platform/errors")>("@/platform/errors");
  return { ...actual, logFailureSafely: mocks.logFailureSafely };
});
vi.mock("@mantine/notifications", () => ({ notifications: { show: mocks.notify } }));
vi.mock("@/i18n", async (original) => ({
  ...(await original<typeof import("@/i18n")>()),
  default: {
    t: (key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? key,
  },
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) =>
      key === "Home.Accounts.DownloadDurabilityUncertain" ? english.translation[key] : key,
  }),
}));
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
let cache: Map<string, State<ManagedDatabaseInfo[]>>;

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  store = createStore();
  cache = new Map();
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

function cachedDatabases() {
  return cache.get("databases")?.data;
}

async function renderCard(props: Partial<React.ComponentProps<typeof AccountCard>> = {}) {
  await renderCards([props]);
}

async function renderCards(cards: Partial<React.ComponentProps<typeof AccountCard>>[]) {
  await act(async () => {
    root.render(
      <Provider store={store}>
        <SWRConfig value={{ provider: () => cache, dedupingInterval: 0 }}>
          {cards.map((props, index) => (
            <AccountCard
              key={props.title ?? index}
              type="chesscom"
              database={null}
              title="Felix"
              updatedAt={0}
              total={0}
              stats={[]}
              logout={vi.fn()}
              reload={vi.fn()}
              {...props}
            />
          ))}
        </SWRConfig>
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
  const lease = { id: `download:${type}:Felix`, generation: 1n };
  mocks.getLatestGameTimestamp.mockResolvedValue(null);
  const publication: ArtifactPublication = { handle: artifact, durability: "Durable" };
  mocks.downloadChessCom.mockResolvedValue(publication);
  mocks.downloadLichess.mockResolvedValue(publication);
  mocks.getDatabaseWorkspace.mockResolvedValue(root);
  mocks.listWorkspaceDatabases.mockResolvedValue([
    { handle, filename: `Felix_${type}.db3`, availability: "available" },
  ]);
  mocks.startProgress.mockResolvedValue(lease);
  mocks.convertPgn.mockResolvedValue(undefined);
  mocks.setProgressState.mockResolvedValue(undefined);
  mocks.deleteEmptyGames.mockResolvedValue(undefined);
}

test.each([true, false])(
  "account import acquisition preserves the domain presentation with rootFailure=%s",
  async (labelled) => {
    configureSuccessfulDownload("chesscom");
    mocks.issueDownloadDestination.mockResolvedValue({ id: "dest" });
    mocks.getDatabaseWorkspace.mockRejectedValue({
      tag: "backend-error",
      category: "io",
      message: "native failure",
      ...(labelled ? { rootFailure: "missing" } : {}),
    });
    await renderCard();
    await act(async () => downloadButton().click());
    expect(mocks.notify).toHaveBeenCalledExactlyOnceWith({
      color: "red",
      title: "Common.Error",
      message: labelled
        ? "This database folder is no longer available. Choose another."
        : "native failure",
    });
    expect(mocks.convertPgn).not.toHaveBeenCalled();
    expect(downloadButton().disabled).toBe(false);
  },
);

test.each(["lichess", "chesscom"] as const)(
  "an uncertain %s publication warns once before importing its handle",
  async (type) => {
    configureSuccessfulDownload(type);
    const publication: ArtifactPublication = {
      handle: { id: { id: "uncertain-pgn" }, kind: "fileWorkspace" },
      durability: { DurabilityUncertain: "DownloadTargetReplacement" },
    };
    const download = type === "lichess" ? mocks.downloadLichess : mocks.downloadChessCom;
    download.mockResolvedValue(publication);
    mocks.issueDownloadDestination.mockResolvedValue({ id: "dest" });
    await renderCard({ type, accountHandle: "account" });

    await act(async () => downloadButton().click());

    expect(mocks.notify).toHaveBeenCalledExactlyOnceWith({
      message:
        "The games were downloaded, but the save could not be fully confirmed. Do not retry.",
      color: "orange",
    });
    expect(mocks.convertPgn).toHaveBeenCalledExactlyOnceWith(
      expect.stringMatching(/^conversion:[0-9a-f-]{36}$/),
      [publication.handle],
      { id: { id: "database" }, kind: "database" },
      null,
      `Felix ${type === "lichess" ? "Lichess" : "Chess.com"}`,
      null,
    );
    expect(mocks.notify.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.convertPgn.mock.invocationCallOrder[0],
    );
    expect(download).toHaveBeenCalledTimes(1);
  },
);

test.each(["lichess", "chesscom"] as const)(
  "a durable %s publication imports its handle without a warning",
  async (type) => {
    configureSuccessfulDownload(type);
    mocks.issueDownloadDestination.mockResolvedValue({ id: "dest" });
    await renderCard({ type, accountHandle: "account" });

    await act(async () => downloadButton().click());

    expect(mocks.notify).not.toHaveBeenCalled();
    expect(mocks.convertPgn).toHaveBeenCalledExactlyOnceWith(
      expect.stringMatching(/^conversion:[0-9a-f-]{36}$/),
      [{ id: { id: "pgn" }, kind: "fileWorkspace" }],
      { id: { id: "database" }, kind: "database" },
      null,
      `Felix ${type === "lichess" ? "Lichess" : "Chess.com"}`,
      null,
    );
  },
);

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
    const databases = accountDatabases(type);
    mocks.getDatabases.mockResolvedValue(databases);
    await renderCard({ type, accountHandle: "account" });

    await act(async () => downloadButton().click());

    expect(mocks.deleteEmptyGames).toHaveBeenCalledWith({
      id: { id: "database" },
      kind: "database",
    });
    expect(mocks.getDatabases).not.toHaveBeenCalled();
    expect(cachedDatabases()).toBeUndefined();
    expect(downloadButton().disabled).toBe(true);
    expect(downloadButton().getAttribute("data-pending")).toBe("true");

    await act(async () => resolveDeletion());

    expect(mocks.getDatabases).toHaveBeenCalledTimes(1);
    expect(cachedDatabases()).toEqual(databases);
    expect(mocks.notify).not.toHaveBeenCalled();
    expect(downloadButton().disabled).toBe(false);
    expect(downloadButton().getAttribute("data-pending")).toBeNull();
  },
);

test.each(["chesscom", "lichess"] as const)(
  "%s follows its ticket while the download is pending and reuses it for import",
  async (type) => {
    configureSuccessfulDownload(type);
    const download = type === "chesscom" ? mocks.downloadChessCom : mocks.downloadLichess;
    const pendingDownload = deferred<ArtifactPublication>();
    download.mockImplementation(() => {
      mocks.progress.mock.calls[0][0]({
        payload: {
          id: store.get(accountDownloadsInFlightAtom).get(`${type}_Felix`),
          generation: 1n,
          progress: 37,
          finished: false,
          state: "running",
          cleared: false,
        },
      });
      return pendingDownload.promise;
    });
    const destination = deferred<{ id: string }>();
    mocks.issueDownloadDestination.mockReturnValue(destination.promise);
    await renderCard({ type, accountHandle: "account" });

    await act(async () => downloadButton().click());
    expect(store.get(accountDownloadsInFlightAtom).has(`${type}_Felix`)).toBe(true);
    expect(store.get(accountDownloadsInFlightAtom).get(`${type}_Felix`)).toBeNull();
    await act(async () => destination.resolve({ id: "dest" }));
    const ticket = store.get(accountDownloadsInFlightAtom).get(`${type}_Felix`)!;
    expect(ticket).not.toContain("Felix");
    expect(ticket).not.toContain(type);
    expect(ticket).toMatch(/^opaque-download-ticket-\d+$/);
    expect(mocks.convertPgn).not.toHaveBeenCalled();
    expect(host.textContent).toContain("37%");
    const listener = mocks.progress.mock.calls[0][0];
    const emit = (id: string, progress: number) =>
      listener({
        payload: {
          id,
          generation: 1n,
          progress,
          finished: false,
          state: "running",
          cleared: false,
        },
      });
    await act(async () => emit(ticket, 37));
    expect(host.textContent).toContain("37%");
    await act(async () => {
      emit("different-ticket", 88);
      emit(`${type}_Felix`, 91);
    });
    expect(host.textContent).toContain("37%");
    expect(host.textContent).not.toContain("88%");
    expect(host.textContent).not.toContain("91%");
    expect(mocks.startProgress).not.toHaveBeenCalled();

    await act(async () =>
      pendingDownload.resolve({
        handle: { id: { id: "pgn" }, kind: "fileWorkspace" },
        durability: "Durable",
      }),
    );
    expect(mocks.startProgress).toHaveBeenCalledExactlyOnceWith(ticket);
    expect(mocks.startProgress).not.toHaveBeenCalledWith(`${type}_Felix`);
    expect(store.get(accountDownloadsInFlightAtom).size).toBe(0);

    const firstTicket = ticket;
    const secondDownload = deferred<ArtifactPublication>();
    download.mockReturnValue(secondDownload.promise);
    mocks.downloadDestinationIsKnown.mockResolvedValue(true);
    await act(async () => downloadButton().click());
    const secondTicket = store.get(accountDownloadsInFlightAtom).get(`${type}_Felix`)!;
    expect(secondTicket).not.toBe(firstTicket);
    expect(secondTicket).not.toContain("Felix");
    expect(secondTicket).not.toContain(type);
    expect(secondTicket).toMatch(/^opaque-download-ticket-\d+$/);
    await act(async () => emit(firstTicket, 12));
    expect(host.textContent).not.toContain("12%");
    await act(async () => emit(secondTicket, 64));
    expect(host.textContent).toContain("64%");
    await act(async () =>
      secondDownload.resolve({
        handle: { id: { id: "pgn" }, kind: "fileWorkspace" },
        durability: "Durable",
      }),
    );
    expect(store.get(accountDownloadsInFlightAtom).size).toBe(0);
  },
);

test.each(["chesscom", "lichess"] as const)(
  "a refused %s export notifies the conflict and removes its in-flight entry",
  async (type) => {
    configureSuccessfulDownload(type);
    mocks.issueDownloadDestination.mockResolvedValue({ id: "dest" });
    const download = type === "chesscom" ? mocks.downloadChessCom : mocks.downloadLichess;
    download.mockRejectedValue({
      tag: "backend-error",
      category: "conflict",
      message: "download progress is already active",
    });
    await renderCard({ type, accountHandle: "account" });
    await act(async () => downloadButton().click());
    expect(mocks.notify).toHaveBeenCalledExactlyOnceWith({
      color: "red",
      title: "Common.Error",
      message: "download progress is already active",
    });
    expect(mocks.startProgress).not.toHaveBeenCalled();
    expect(mocks.convertPgn).not.toHaveBeenCalled();
    expect(store.get(accountDownloadsInFlightAtom).size).toBe(0);
    expect(downloadButton().disabled).toBe(false);
  },
);

test("a finished progress frame leaves Download pending until cleanup and refresh settle", async () => {
  configureSuccessfulDownload();
  mocks.issueDownloadDestination.mockResolvedValue({ id: "dest" });
  const deletion = deferred<void>();
  const refresh = deferred<ManagedDatabaseInfo[]>();
  mocks.deleteEmptyGames.mockReturnValue(deletion.promise);
  mocks.getDatabases.mockReturnValue(refresh.promise);
  await renderCard();
  await act(async () => downloadButton().click());
  expect(mocks.deleteEmptyGames).toHaveBeenCalledTimes(1);
  const ticket = store.get(accountDownloadsInFlightAtom).get("chesscom_Felix");

  await act(async () => {
    mocks.progress.mock.calls[0][0]({
      payload: {
        id: ticket,
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
  expect(cachedDatabases()).toEqual(databases);
  expect(downloadButton().disabled).toBe(false);
  expect(downloadButton().getAttribute("data-pending")).toBeNull();
  expect(store.get(accountDownloadsInFlightAtom).size).toBe(0);
});

test("concurrent account downloads retain each other's pending state", async () => {
  configureSuccessfulDownload();
  mocks.issueDownloadDestination.mockResolvedValue({ id: "dest" });
  mocks.downloadDestinationIsKnown.mockResolvedValue(true);
  const conversionA = deferred<void>();
  const conversionB = deferred<void>();
  const handleA = { id: { id: "database-a" }, kind: "database" as const };
  const handleB = { id: { id: "database-b" }, kind: "database" as const };
  mocks.listWorkspaceDatabases.mockResolvedValue([
    { handle: handleA, filename: "Felix_chesscom.db3", availability: "available" },
    { handle: handleB, filename: "Alex_chesscom.db3", availability: "available" },
  ]);
  mocks.startProgress.mockImplementation(async (id: string) => ({ id, generation: 1n }));
  mocks.convertPgn
    .mockReturnValueOnce(conversionA.promise)
    .mockReturnValueOnce(conversionB.promise);
  await renderCards([{ title: "Felix" }, { title: "Alex" }]);
  const [buttonA, buttonB] = host.querySelectorAll<HTMLButtonElement>(
    'button[aria-label="Home.Accounts.DownloadGames"]',
  );

  await act(async () => buttonA.click());
  expect(mocks.convertPgn).toHaveBeenCalledTimes(1);
  expect(buttonA.disabled).toBe(true);
  expect(buttonA.getAttribute("data-pending")).toBe("true");
  expect(buttonB.disabled).toBe(false);

  await act(async () => buttonB.click());
  expect(mocks.convertPgn).toHaveBeenCalledTimes(2);
  expect(buttonA.disabled).toBe(true);
  expect(buttonA.getAttribute("data-pending")).toBe("true");
  expect(buttonB.disabled).toBe(true);
  expect(buttonB.getAttribute("data-pending")).toBe("true");
  const downloadsInFlight = store.get(accountDownloadsInFlightAtom);
  const ticketA = downloadsInFlight.get("chesscom_Felix");
  const ticketB = downloadsInFlight.get("chesscom_Alex");
  expect(ticketA).not.toBe(ticketB);
  for (const ticket of [ticketA, ticketB]) {
    expect(ticket).toMatch(/^opaque-download-ticket-\d+$/);
    expect(ticket).not.toBe("download:chesscom:Felix");
    expect(ticket).not.toBe("download:chesscom:Alex");
  }
  expect(store.get(accountDownloadsInFlightAtom)).toEqual(
    new Map([
      ["chesscom_Felix", ticketA],
      ["chesscom_Alex", ticketB],
    ]),
  );

  await act(async () => conversionB.resolve());
  expect(buttonB.disabled).toBe(false);
  expect(buttonB.getAttribute("data-pending")).toBeNull();
  expect(buttonA.disabled).toBe(true);
  expect(buttonA.getAttribute("data-pending")).toBe("true");
  expect(store.get(accountDownloadsInFlightAtom)).toEqual(new Map([["chesscom_Felix", ticketA]]));

  await act(async () => conversionA.resolve());
  expect(buttonA.disabled).toBe(false);
  expect(buttonA.getAttribute("data-pending")).toBeNull();
  expect(buttonB.disabled).toBe(false);
  expect(store.get(accountDownloadsInFlightAtom).size).toBe(0);
  expect(mocks.notify).not.toHaveBeenCalled();
});

test("a remounted account stays pending and cannot start a second download", async () => {
  configureSuccessfulDownload();
  mocks.issueDownloadDestination.mockResolvedValue({ id: "dest" });
  const conversion = deferred<void>();
  mocks.convertPgn.mockReturnValue(conversion.promise);
  await renderCard();
  await act(async () => downloadButton().click());
  expect(mocks.convertPgn).toHaveBeenCalledTimes(1);
  const storedTicket = store.get(accountDownloadsInFlightAtom).get("chesscom_Felix");
  await act(async () => root.unmount());
  root = createRoot(host);
  await renderCard();

  expect(downloadButton().disabled).toBe(true);
  expect(downloadButton().getAttribute("data-pending")).toBe("true");
  await act(async () => downloadButton().click());
  expect(mocks.downloadChessCom).toHaveBeenCalledTimes(1);
  expect(mocks.convertPgn).toHaveBeenCalledTimes(1);

  const ticket = store.get(accountDownloadsInFlightAtom).get("chesscom_Felix");
  expect(ticket).toBe(storedTicket);
  expect(ticket).toMatch(/^opaque-download-ticket-\d+$/);
  await act(async () => {
    mocks.progress.mock.calls.at(-1)![0]({
      payload: {
        id: "download:chesscom:Felix",
        generation: 2n,
        progress: 12,
        finished: false,
        state: "running",
        cleared: false,
      },
    });
  });
  expect(host.textContent).not.toContain("12%");
  await act(async () => {
    mocks.progress.mock.calls.at(-1)![0]({
      payload: {
        id: ticket,
        generation: 2n,
        progress: 64,
        finished: false,
        state: "running",
        cleared: false,
      },
    });
  });
  expect(host.textContent).toContain("64%");

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
  await renderCard();

  await act(async () => downloadButton().click());

  expect(mocks.getDatabases).toHaveBeenCalledTimes(1);
  expect(cachedDatabases()).toEqual(databases);
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
  await renderCard();

  await act(async () => downloadButton().click());

  expect(mocks.createWorkspaceDatabase).toHaveBeenCalledTimes(1);
  expect(mocks.getDatabases).toHaveBeenCalledTimes(1);
  expect(cachedDatabases()).toEqual(databases);
  expect(mocks.deleteEmptyGames).not.toHaveBeenCalled();
  expect(mocks.notify).toHaveBeenCalledExactlyOnceWith({
    color: "red",
    title: "Common.Error",
    message: "convert failed",
  });
  expect(downloadButton().disabled).toBe(false);
  expect(store.get(accountDownloadsInFlightAtom).size).toBe(0);
});

test.each([
  { stage: "conversion", primaryMessage: "convert failed", cleanupCalls: 0 },
  { stage: "cleanup", primaryMessage: "cleanup failed", cleanupCalls: 1 },
])(
  "a refresh failure after failed $stage logs without replacing the primary error",
  async ({ stage, primaryMessage, cleanupCalls }) => {
    configureSuccessfulDownload();
    mocks.issueDownloadDestination.mockResolvedValue({ id: "dest" });
    if (stage === "conversion") mocks.convertPgn.mockRejectedValue(new Error(primaryMessage));
    else mocks.deleteEmptyGames.mockRejectedValue(new Error(primaryMessage));
    mocks.getDatabases.mockRejectedValue(new Error("refresh failed"));
    await renderCard();

    await act(async () => downloadButton().click());

    expect(mocks.getDatabases).toHaveBeenCalledTimes(1);
    expect(cachedDatabases()).toBeUndefined();
    expect(mocks.deleteEmptyGames).toHaveBeenCalledTimes(cleanupCalls);
    expect(mocks.logFailureSafely).toHaveBeenCalledExactlyOnceWith(
      "Account import database refresh failed for chesscom_Felix: refresh failed",
      {
        operation: "account import database refresh",
        primaryFailure: { category: "unexpected", message: "refresh failed" },
      },
      "Account import refresh logging failed for chesscom_Felix",
    );
    expect(mocks.notify).toHaveBeenCalledExactlyOnceWith({
      color: "red",
      title: "Common.Error",
      message: primaryMessage,
    });
    expect(downloadButton().disabled).toBe(false);
    expect(store.get(accountDownloadsInFlightAtom).size).toBe(0);
  },
);

test("a finished progress frame for the card does not refresh databases", async () => {
  await renderCard();
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
  expect(cachedDatabases()).toBeUndefined();
  expect(downloadButton().disabled).toBe(false);
  expect(downloadButton().getAttribute("data-pending")).toBeNull();
});

test("a failed post-import database refresh notifies after deleting empty games", async () => {
  configureSuccessfulDownload();
  mocks.issueDownloadDestination.mockResolvedValue({ id: "dest" });
  mocks.getDatabases.mockRejectedValue(new Error("refresh failed"));
  await renderCard();

  await act(async () => downloadButton().click());

  expect(mocks.deleteEmptyGames).toHaveBeenCalledTimes(1);
  expect(cachedDatabases()).toBeUndefined();
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
    expect.any(Function),
  );
  expect(mocks.downloadChessCom).toHaveBeenCalledWith(fresh, "Felix", null, expect.any(Function));
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
  expect(mocks.downloadChessCom).toHaveBeenCalledWith(
    destination,
    "Felix",
    null,
    expect.any(Function),
  );
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
    expect(mocks.downloadChessCom).toHaveBeenCalledWith(
      destination,
      "Felix",
      null,
      expect.any(Function),
    );
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
  expect(mocks.downloadChessCom).toHaveBeenCalledWith(
    destination,
    "Felix",
    null,
    expect.any(Function),
  );
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
  const lease = { id: "download:chesscom:Felix", generation: 1n };
  mocks.issueDownloadDestination.mockResolvedValue(destination);
  mocks.downloadChessCom.mockResolvedValue({ handle: artifact, durability: "Durable" });
  mocks.getDatabaseWorkspace.mockResolvedValue(root);
  mocks.listWorkspaceDatabases.mockResolvedValue([
    { handle, filename: "Felix_chesscom.db3", availability: "available" },
  ]);
  let ticket!: string;
  mocks.startProgress.mockImplementation(async () => {
    ticket = store.get(accountDownloadsInFlightAtom).get("chesscom_Felix")!;
    return lease;
  });
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
    `Account import progress update (failed) failed for ${ticket} [${mocks.convertPgn.mock.calls[0][0]}]: progress failed`,
    {
      operation: "account import progress update",
      primaryFailure: { category: "unexpected", message: "progress failed" },
    },
    `Account import progress logging failed (failed) for ${ticket} [${mocks.convertPgn.mock.calls[0][0]}]`,
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
  const lease = { id: "download:chesscom:Felix", generation: 1n };
  mocks.issueDownloadDestination.mockResolvedValue(destination);
  mocks.downloadChessCom.mockResolvedValue({ handle: artifact, durability: "Durable" });
  mocks.getDatabaseWorkspace.mockResolvedValue(root);
  mocks.listWorkspaceDatabases.mockResolvedValue([
    { handle, filename: "Felix_chesscom.db3", availability: "available" },
  ]);
  let ticket!: string;
  mocks.startProgress.mockImplementation(async () => {
    ticket = store.get(accountDownloadsInFlightAtom).get("chesscom_Felix")!;
    return lease;
  });
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
    `Account import progress update (succeeded) failed for ${ticket} [${mocks.convertPgn.mock.calls[0][0]}]: progress failed`,
    {
      operation: "account import progress update",
      primaryFailure: { category: "unexpected", message: "progress failed" },
    },
    `Account import progress logging failed (succeeded) for ${ticket} [${mocks.convertPgn.mock.calls[0][0]}]`,
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
