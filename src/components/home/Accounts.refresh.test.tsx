import { MantineProvider } from "@mantine/core";
import { Provider, createStore } from "jotai";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { SWRConfig, useSWRConfig } from "swr";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { useNativeRequestOwner } from "@/hooks/useNativeRequestOwner";
import { accountDownloadsInFlightAtom, sessionsAtom } from "@/state/atoms";
import { installMatchMediaStub } from "@/tests/matchMedia";
import { installResizeObserverStub } from "@/tests/resizeObserver";
import Accounts from "./Accounts";

const mocks = vi.hoisted(() => ({
  getDatabaseWorkspace: vi.fn(),
  listWorkspaceDatabases: vi.fn(),
  getDbInfo: vi.fn(),
  getLatestGameTimestamp: vi.fn(),
  issueDownloadDestination: vi.fn(),
  startProgress: vi.fn(),
  convertPgn: vi.fn(),
  setProgressState: vi.fn(),
  deleteEmptyGames: vi.fn(),
  progress: vi.fn(),
  downloadChessCom: vi.fn(),
  notify: vi.fn(),
  warn: vi.fn(),
}));

vi.mock("@/platform/tauri", () => ({
  tauri: mocks,
  tauriSubscriptions: { progress: mocks.progress },
}));
vi.mock("@/utils/chess.com/api", async () => {
  const actual =
    await vi.importActual<typeof import("@/utils/chess.com/api")>("@/utils/chess.com/api");
  return { ...actual, downloadChessCom: mocks.downloadChessCom };
});
vi.mock("@mantine/notifications", () => ({ notifications: { show: mocks.notify } }));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@/platform/native", () => ({ warn: mocks.warn }));

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
installMatchMediaStub();
installResizeObserverStub();

let root: Root;
let host: HTMLDivElement;
let store: ReturnType<typeof createStore>;
let revalidate: ReturnType<typeof useSWRConfig>["mutate"];
let cache: ReturnType<typeof useSWRConfig>["cache"];
let switchRoot: () => Promise<void>;

function RevalidationControl() {
  const config = useSWRConfig();
  const owner = useNativeRequestOwner("databases");
  revalidate = config.mutate;
  cache = config.cache;
  switchRoot = async () => {
    await owner!.supersede();
    await config.mutate("databases");
  };
  return null;
}

const oldInfo = {
  filename: "Felix_chesscom.db3",
  title: "Felix",
  description: "",
  player_count: 2,
  event_count: 1,
  game_count: 3,
  storage_size: 0n,
  indexed: false,
};

const swrConfig = {
  provider: () => new Map(),
  dedupingInterval: 0,
  shouldRetryOnError: false,
};

async function renderAccounts(show = true) {
  await act(async () => {
    root.render(
      <MantineProvider>
        <Provider store={store}>
          <SWRConfig value={swrConfig}>
            {show && <RevalidationControl />}
            {show && <Accounts />}
          </SWRConfig>
        </Provider>
      </MantineProvider>,
    );
  });
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((settle) => {
    resolve = settle;
  });
  return { promise, resolve };
}

function downloadButton() {
  return host.querySelector<HTMLButtonElement>('button[aria-label="Home.Accounts.DownloadGames"]')!;
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  sessionStorage.clear();
  store = createStore();
  store.set(sessionsAtom, [
    {
      player: "Felix",
      updatedAt: 0,
      chessCom: { username: "Felix", stats: {} },
    },
  ]);
  mocks.getDatabaseWorkspace.mockResolvedValue({ id: { id: "root" }, kind: "databaseRoot" });
  const handle = { id: { id: "database" }, kind: "database" };
  mocks.listWorkspaceDatabases.mockResolvedValue([
    { handle, filename: "Felix_chesscom.db3", availability: "available" },
  ]);
  mocks.getLatestGameTimestamp.mockResolvedValue(null);
  mocks.issueDownloadDestination.mockResolvedValue({ id: "destination" });
  mocks.downloadChessCom.mockResolvedValue({
    handle: { id: { id: "pgn" }, kind: "fileWorkspace" },
    durability: "Durable",
  });
  mocks.startProgress.mockResolvedValue({ id: "chesscom_Felix", generation: 1n });
  mocks.convertPgn.mockResolvedValue(undefined);
  mocks.setProgressState.mockResolvedValue(undefined);
  mocks.deleteEmptyGames.mockResolvedValue(undefined);
  mocks.progress.mockResolvedValue(vi.fn());
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});

test("real Accounts retain post-cleanup counts across remount and revalidation of an older listing", async () => {
  const deletion = deferred<void>();
  const listing = deferred<typeof oldInfo>();
  const refresh = deferred<typeof oldInfo>();
  const newInfo = { ...oldInfo, game_count: 8 };
  const newDatabases = [
    { type: "success", ...newInfo, file: { id: { id: "database" }, kind: "database" } },
  ];
  mocks.deleteEmptyGames.mockReturnValue(deletion.promise);
  mocks.getDbInfo
    .mockResolvedValueOnce(oldInfo)
    .mockReturnValueOnce(listing.promise)
    .mockReturnValueOnce(refresh.promise)
    .mockResolvedValue(newInfo);
  await renderAccounts();
  expect(host.textContent).toContain("3 / 3");

  await act(async () => downloadButton().click());
  expect(mocks.deleteEmptyGames).toHaveBeenCalledTimes(1);
  expect(mocks.getDbInfo).toHaveBeenCalledTimes(1);
  expect(mocks.getLatestGameTimestamp).toHaveBeenCalledWith({
    id: { id: "database" },
    kind: "database",
  });

  await renderAccounts(false);
  await renderAccounts();
  await act(async () => {
    await vi.waitFor(() => {
      if (mocks.getDbInfo.mock.calls.length !== 2)
        throw new Error("Remounted Accounts have not started listing L");
    });
  });
  expect(host.textContent).toContain("3 / 3");
  expect(downloadButton().disabled).toBe(true);

  await act(async () => deletion.resolve());
  expect(mocks.getDbInfo).toHaveBeenCalledTimes(3);
  expect(downloadButton().disabled).toBe(true);
  await act(async () => refresh.resolve(newInfo));
  expect(host.textContent).toContain("8 / 8");
  expect(cache.get("databases")?.data).toEqual(newDatabases);
  expect(downloadButton().disabled).toBe(false);

  // DatabasesPage's mutate() must not rejoin L after the cleanup refresh.
  let revalidation!: Promise<unknown>;
  await act(async () => {
    revalidation = revalidate("databases");
  });
  await act(async () => {
    listing.resolve(oldInfo);
    await revalidation;
  });

  expect(host.textContent).toContain("8 / 8");
  expect(host.textContent).not.toContain("3 / 3");
  expect(cache.get("databases")?.data).toEqual(newDatabases);
  expect(mocks.notify).not.toHaveBeenCalled();
  expect(store.get(accountDownloadsInFlightAtom).size).toBe(0);
});

test("a remount that retires a pending import refresh receives the new counts after mutation settles", async () => {
  const refresh = deferred<typeof oldInfo>();
  const listing = deferred<typeof oldInfo>();
  const newInfo = { ...oldInfo, game_count: 8 };
  mocks.getDbInfo
    .mockResolvedValueOnce(oldInfo)
    .mockReturnValueOnce(refresh.promise)
    .mockReturnValueOnce(listing.promise)
    .mockResolvedValue(newInfo);
  const unhandled = vi.fn();
  window.addEventListener("unhandledrejection", unhandled);
  try {
    await renderAccounts();
    expect(host.textContent).toContain("3 / 3");

    await act(async () => downloadButton().click());
    expect(mocks.convertPgn).toHaveBeenCalledTimes(1);
    expect(mocks.deleteEmptyGames).toHaveBeenCalledTimes(1);
    expect(mocks.getDbInfo).toHaveBeenCalledTimes(2);
    expect(downloadButton().disabled).toBe(true);

    await renderAccounts(false);
    // Let the provider's zero-length dedupe interval expire before remounting.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    await renderAccounts();
    await act(async () => {
      await vi.waitFor(() => {
        if (mocks.getDbInfo.mock.calls.length !== 3)
          throw new Error("Remounted Accounts have not started the replacement listing");
      });
    });
    expect(host.textContent).toContain("3 / 3");

    await act(async () => {
      listing.resolve(newInfo);
      refresh.resolve(newInfo);
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(host.textContent).toContain("8 / 8");
    expect(host.textContent).not.toContain("3 / 3");
    expect(cache.get("databases")?.data).toEqual([
      { type: "success", ...newInfo, file: { id: { id: "database" }, kind: "database" } },
    ]);
    expect(downloadButton().disabled).toBe(false);
    expect(store.get(accountDownloadsInFlightAtom).size).toBe(0);
    expect(mocks.notify).not.toHaveBeenCalled();
    expect(unhandled).not.toHaveBeenCalled();
  } finally {
    window.removeEventListener("unhandledrejection", unhandled);
  }
});

test("a root switch retires a pending successful import refresh and keeps root B's counts", async () => {
  const refresh = deferred<typeof oldInfo>();
  const rootAInfo = { ...oldInfo, game_count: 8 };
  const rootBInfo = { ...oldInfo, game_count: 13 };
  const rootB = { id: { id: "root-B" }, kind: "databaseRoot" };
  const rootBHandle = { id: { id: "database-B" }, kind: "database" };
  mocks.getDbInfo
    .mockResolvedValueOnce(oldInfo)
    .mockReturnValueOnce(refresh.promise)
    .mockResolvedValue(rootBInfo);
  const unhandled = vi.fn();
  window.addEventListener("unhandledrejection", unhandled);
  try {
    await renderAccounts();
    expect(host.textContent).toContain("3 / 3");

    await act(async () => downloadButton().click());
    expect(mocks.convertPgn).toHaveBeenCalledTimes(1);
    expect(mocks.deleteEmptyGames).toHaveBeenCalledTimes(1);
    expect(mocks.getDbInfo).toHaveBeenCalledTimes(2);
    expect(downloadButton().disabled).toBe(true);

    mocks.getDatabaseWorkspace.mockResolvedValue(rootB);
    mocks.listWorkspaceDatabases.mockResolvedValue([
      { handle: rootBHandle, filename: "Felix_chesscom.db3", availability: "available" },
    ]);
    // Use DatabasesPage's root-switch sequence in this same SWR provider/cache.
    await act(async () => switchRoot());
    await act(async () => {
      refresh.resolve(rootAInfo);
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(mocks.getDbInfo).toHaveBeenCalledTimes(3);
    expect(mocks.getDbInfo).toHaveBeenLastCalledWith(rootBHandle);
    expect(host.textContent).toContain("13 / 13");
    expect(host.textContent).not.toContain("8 / 8");
    expect(cache.get("databases")?.data).toEqual([
      { type: "success", ...rootBInfo, file: rootBHandle },
    ]);
    expect(downloadButton().disabled).toBe(false);
    expect(store.get(accountDownloadsInFlightAtom).size).toBe(0);
    expect(mocks.notify).not.toHaveBeenCalled();
    expect(mocks.warn).not.toHaveBeenCalled();
    expect(unhandled).not.toHaveBeenCalled();
  } finally {
    window.removeEventListener("unhandledrejection", unhandled);
  }
});
