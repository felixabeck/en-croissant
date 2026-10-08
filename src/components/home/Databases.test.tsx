import { getDefaultStore } from "jotai";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { SWRConfig } from "swr";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { sessionsAtom } from "@/state/atoms";
import type { ProgressEvent } from "@/bindings";

const mocks = vi.hoisted(() => ({
  getDatabases: vi.fn(),
  query_players: vi.fn(),
  getPlayersGameInfo: vi.fn(),
  progress: vi.fn(),
  logError: vi.fn(),
  personalCardInfo: vi.fn(),
  personalCardNotice: vi.fn(),
}));

vi.mock("@/platform/tauri", async () => {
  const actual = await vi.importActual<typeof import("@/platform/tauri")>("@/platform/tauri");
  return {
    ...actual,
    tauri: { getPlayersGameInfo: mocks.getPlayersGameInfo },
    tauriSubscriptions: { progress: mocks.progress },
  };
});
vi.mock("@/utils/db", async () => {
  const actual = await vi.importActual<typeof import("@/utils/db")>("@/utils/db");
  return {
    ...actual,
    getDatabases: mocks.getDatabases,
    query_players: mocks.query_players,
  };
});
vi.mock("@/platform/native", () => ({ error: mocks.logError }));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: { databases?: string }) =>
      options?.databases ? `${key}: ${options.databases}` : key,
  }),
}));
vi.mock("@/components/files/notifyError", () => ({ notifyListenerError: vi.fn() }));
vi.mock("./PersonalCard", () => ({
  default: ({ info, notice }: { info: unknown; notice?: React.ReactNode }) => {
    mocks.personalCardInfo(info);
    mocks.personalCardNotice(notice);
    return <div>player-card{notice}</div>;
  },
}));
vi.mock("@tabler/icons-react", () => ({ IconDatabaseOff: () => null }));
vi.mock("@mantine/core", () => ({
  Alert: ({ children, title }: { children: React.ReactNode; title?: React.ReactNode }) => (
    <div role="alert">
      {title}
      {children}
    </div>
  ),
  Center: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Loader: () => null,
  Paper: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Progress: ({ value }: { value: number }) => <div data-testid="progress">{value}</div>,
  Select: () => null,
  Stack: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Text: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
  ThemeIcon: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Title: ({ children }: { children: React.ReactNode }) => <h3>{children}</h3>,
}));

import Databases from "./Databases";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const session = {
  player: "Magnus",
  updatedAt: 1,
  lichess: {
    username: "Magnus",
    account: { id: "magnus", username: "Magnus" },
  },
};

function database(id: string) {
  return {
    type: "success" as const,
    title: id === "db-2" ? "Magnus Chess.com" : "Magnus Lichess",
    description: "",
    player_count: 1,
    event_count: 1,
    game_count: 2,
    storage_size: 1n,
    filename: id === "db-2" ? "Magnus_chesscom.db3" : "Magnus_lichess.db3",
    indexed: true,
    file: { id: { id }, kind: "database" as const },
  };
}

function progressEvent(id: string, progress: number): { payload: ProgressEvent } {
  return {
    payload: {
      id,
      generation: 1n,
      progress,
      finished: false,
      state: "running",
      cleared: false,
    },
  };
}

let container: HTMLDivElement;
let root: Root;
let progressListener: (event: { payload: ProgressEvent }) => void;

async function renderDatabases() {
  await act(async () => {
    root.render(
      <SWRConfig value={{ provider: () => new Map() }}>
        <Databases />
      </SWRConfig>,
    );
  });
}

function displayedProgress() {
  return container.textContent ?? "";
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  getDefaultStore().set(sessionsAtom, [
    session,
    { player: "Magnus", updatedAt: 1, chessCom: { username: "Magnus", stats: {} } },
  ]);
  mocks.getDatabases.mockResolvedValue([database("db-1")]);
  mocks.query_players.mockResolvedValue({
    data: [{ id: 7, name: "Magnus", elo: null }],
    count: 1,
  });
  mocks.getPlayersGameInfo.mockReturnValue(new Promise(() => undefined));
  mocks.progress.mockImplementation(async (listener: typeof progressListener) => {
    progressListener = listener;
    return () => undefined;
  });
  mocks.logError.mockResolvedValue(undefined);
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

test("a ProgressEvent under the id passed to getPlayersGameInfo moves the bar", async () => {
  await renderDatabases();
  await vi.waitFor(() => expect(mocks.getPlayersGameInfo).toHaveBeenCalled());
  const ownedId = mocks.getPlayersGameInfo.mock.calls[0][0] as string;
  expect(ownedId).toEqual(expect.any(String));

  await act(async () => {
    progressListener(progressEvent(ownedId, 40));
  });

  expect(displayedProgress()).toContain("40%");
  expect(container.querySelector("[data-testid='progress']")?.textContent).toBe("40");
});

test("a ProgressEvent under a foreign PlayerCard id does not move the bar", async () => {
  await renderDatabases();
  await vi.waitFor(() => expect(mocks.getPlayersGameInfo).toHaveBeenCalled());
  const ownedId = mocks.getPlayersGameInfo.mock.calls[0][0] as string;

  await act(async () => {
    progressListener(progressEvent("player-card-foreign", 90));
  });
  expect(displayedProgress()).toContain("0%");
  expect(displayedProgress()).not.toContain("90%");

  await act(async () => {
    progressListener(progressEvent(ownedId, 40));
  });
  expect(displayedProgress()).toContain("40%");
});

test("two owned ids average", async () => {
  mocks.getDatabases.mockResolvedValue([database("db-1"), database("db-2")]);
  mocks.getPlayersGameInfo
    .mockResolvedValueOnce({ site_stats_data: [] })
    .mockReturnValueOnce(new Promise(() => undefined));
  await renderDatabases();
  await vi.waitFor(() => expect(mocks.getPlayersGameInfo).toHaveBeenCalledTimes(2));
  const firstId = mocks.getPlayersGameInfo.mock.calls[0][0] as string;
  const secondId = mocks.getPlayersGameInfo.mock.calls[1][0] as string;
  expect(firstId).not.toBe(secondId);

  await act(async () => {
    progressListener(progressEvent(firstId, 20));
    progressListener(progressEvent(secondId, 80));
  });

  expect(displayedProgress()).toContain("50%");
});

test("merges aggregate records from two databases without dropping duplicate keys", async () => {
  const firstRecord = {
    site: "Lichess",
    player: "Magnus",
    daily: [
      {
        date: "2026.09.01",
        time_control: "600+0",
        won: 2,
        drawn: 1,
        lost: 0,
        max_player_elo: 2_850,
      },
    ],
    openings: [
      {
        time_control: "600+0",
        is_player_white: true,
        opening: "Sicilian Defense",
        won: 2,
        drawn: 1,
        lost: 0,
      },
    ],
  };
  const secondRecord = {
    site: "Lichess",
    player: "Magnus",
    daily: [
      {
        date: "2026.09.01",
        time_control: "600+0",
        won: 1,
        drawn: 0,
        lost: 2,
        max_player_elo: 2_860,
      },
    ],
    openings: [
      {
        time_control: "600+0",
        is_player_white: true,
        opening: "Sicilian Defense",
        won: 1,
        drawn: 0,
        lost: 2,
      },
    ],
  };
  mocks.getDatabases.mockResolvedValue([database("db-1"), database("db-2")]);
  mocks.getPlayersGameInfo
    .mockResolvedValueOnce({ site_stats_data: [firstRecord] })
    .mockResolvedValueOnce({ site_stats_data: [secondRecord] });

  await renderDatabases();
  await vi.waitFor(() => expect(mocks.personalCardInfo).toHaveBeenCalled());

  expect(mocks.personalCardInfo).toHaveBeenLastCalledWith({
    site_stats_data: [firstRecord, secondRecord],
  });
  expect(mocks.personalCardNotice).toHaveBeenLastCalledWith(undefined);
  expect(container.querySelector("[role='alert']")).toBeNull();
});

test("a ProgressEvent under an id registered by the original fetcher still moves the bar after unmount and remount", async () => {
  const cache = new Map();
  const swrConfig = { provider: () => cache };

  async function renderDatabasesMounted(mounted: boolean) {
    await act(async () => {
      root.render(<SWRConfig value={swrConfig}>{mounted ? <Databases /> : null}</SWRConfig>);
    });
  }

  await renderDatabasesMounted(true);
  await vi.waitFor(() => expect(mocks.getPlayersGameInfo).toHaveBeenCalled());
  const ownedId = mocks.getPlayersGameInfo.mock.calls[0][0] as string;

  await renderDatabasesMounted(false);
  await renderDatabasesMounted(true);

  expect(mocks.getPlayersGameInfo).toHaveBeenCalledTimes(1);
  await vi.waitFor(() => expect(displayedProgress()).toContain("0%"));

  await act(async () => {
    progressListener(progressEvent(ownedId, 40));
  });

  expect(displayedProgress()).toContain("40%");
  expect(container.querySelector("[data-testid='progress']")?.textContent).toBe("40");
});

test("a foreign event arriving before any id is registered renders 0% not NaN%", async () => {
  let resolvePlayers!: (value: {
    data: Array<{ id: number; name: string; elo: null }>;
    count: number;
  }) => void;
  mocks.query_players.mockReturnValue(
    new Promise((resolve) => {
      resolvePlayers = resolve;
    }),
  );
  await renderDatabases();
  await vi.waitFor(() => expect(mocks.query_players).toHaveBeenCalled());
  expect(mocks.getPlayersGameInfo).not.toHaveBeenCalled();

  await act(async () => {
    progressListener(progressEvent("player-card-foreign", 75));
  });

  expect(displayedProgress()).toContain("0%");
  expect(displayedProgress()).not.toContain("NaN");
  expect(displayedProgress()).not.toContain("75%");

  resolvePlayers({ data: [{ id: 7, name: "Magnus", elo: null }], count: 1 });
});

test("unmount while query_players is held cancels it and admits no info or later pair", async () => {
  mocks.getDatabases.mockResolvedValue([database("db-1"), database("db-2")]);
  let querySignal!: AbortSignal;
  mocks.query_players.mockImplementation(
    (_file: unknown, _query: unknown, options: { signal: AbortSignal }) =>
      new Promise((_resolve, reject) => {
        querySignal = options.signal;
        querySignal.addEventListener(
          "abort",
          () => reject(new DOMException("Cancellation", "AbortError")),
          { once: true },
        );
      }),
  );
  await renderDatabases();
  await vi.waitFor(() => expect(mocks.query_players).toHaveBeenCalledOnce());
  await act(async () => root.render(null));
  await vi.waitFor(() => expect(querySignal.aborted).toBe(true));
  expect(mocks.getPlayersGameInfo).not.toHaveBeenCalled();
  expect(mocks.query_players).toHaveBeenCalledOnce();
  expect(mocks.logError).not.toHaveBeenCalled();
});

test("unmount while getPlayersGameInfo is held cancels it and admits no subsequent pair", async () => {
  mocks.getDatabases.mockResolvedValue([database("db-1"), database("db-2")]);
  mocks.query_players.mockResolvedValue({
    data: [{ id: 7, name: "Magnus", elo: null }],
    count: 1,
  });
  let infoSignal!: AbortSignal;
  mocks.getPlayersGameInfo.mockImplementation(
    (_progress: unknown, _file: unknown, _id: unknown, options: { signal: AbortSignal }) =>
      new Promise((_resolve, reject) => {
        infoSignal = options.signal;
        infoSignal.addEventListener(
          "abort",
          () => reject(new DOMException("Cancellation", "AbortError")),
          { once: true },
        );
      }),
  );
  await renderDatabases();
  await vi.waitFor(() => expect(mocks.getPlayersGameInfo).toHaveBeenCalledOnce());
  await act(async () => root.render(null));
  await vi.waitFor(() => expect(infoSignal.aborted).toBe(true));
  expect(mocks.query_players).toHaveBeenCalledOnce();
  expect(mocks.getPlayersGameInfo).toHaveBeenCalledOnce();
  expect(mocks.logError).not.toHaveBeenCalled();
});

test("ordinary failed personal item retains successful sibling and reports a diagnostic", async () => {
  mocks.getDatabases.mockResolvedValue([database("db-1"), database("db-2")]);
  mocks.query_players
    .mockRejectedValueOnce(new Error("player lookup failed"))
    .mockResolvedValueOnce({ data: [{ id: 8, name: "Magnus", elo: null }], count: 1 });
  mocks.getPlayersGameInfo.mockResolvedValue({ site_stats_data: [] });
  await renderDatabases();
  await vi.waitFor(() => expect(mocks.query_players).toHaveBeenCalledTimes(2));
  await vi.waitFor(() => expect(mocks.getPlayersGameInfo).toHaveBeenCalledOnce());
  expect(mocks.logError).toHaveBeenCalledOnce();
  expect(container.textContent).toContain("Home.Databases.Incomplete.Title");
  expect(container.textContent).toContain("Magnus Lichess");
  expect(mocks.logError).toHaveBeenCalledWith(expect.stringContaining("(Magnus Lichess)"));
});

test("a failed statistics read visibly marks partial statistics and retains only the healthy records", async () => {
  const firstRecord = { site: "Lichess", player: "Magnus", daily: [], openings: [] };
  mocks.getDatabases.mockResolvedValue([
    Object.freeze(database("db-1")),
    Object.freeze(database("db-2")),
  ]);
  mocks.getPlayersGameInfo
    .mockResolvedValueOnce({ site_stats_data: [firstRecord] })
    .mockRejectedValueOnce(new Error("statistics unreadable"));
  await renderDatabases();
  await vi.waitFor(() =>
    expect(container.textContent).toContain("Home.Databases.Incomplete.Title"),
  );
  expect(container.textContent).toContain("Magnus Chess.com");
  expect(mocks.personalCardInfo).toHaveBeenLastCalledWith({ site_stats_data: [firstRecord] });
  expect(mocks.personalCardNotice).toHaveBeenLastCalledWith(expect.anything());
  expect(mocks.logError).toHaveBeenCalledOnce();
  expect(mocks.logError).toHaveBeenCalledWith(
    "personal database summary item 1 (Magnus Chess.com) failed: statistics unreadable",
  );
});

test("all failed statistics reads render every failed name instead of no games", async () => {
  mocks.getDatabases.mockResolvedValue([database("db-1"), database("db-2")]);
  mocks.getPlayersGameInfo.mockRejectedValue(new Error("statistics unreadable"));
  await renderDatabases();
  await vi.waitFor(() => expect(container.textContent).toContain("Home.Databases.Failed.Title"));
  expect(container.textContent).toContain("Magnus Lichess, Magnus Chess.com");
  expect(container.textContent).not.toContain("Home.Databases.Empty.Title");
  expect(mocks.personalCardInfo).not.toHaveBeenCalled();
  expect(mocks.logError).toHaveBeenCalledTimes(2);
});

test("a missing player is an empty contribution without a notice or diagnostic", async () => {
  mocks.query_players.mockResolvedValue({ data: [], count: 0 });
  await renderDatabases();
  await vi.waitFor(() => expect(container.textContent).toContain("Home.Databases.Empty.Title"));
  expect(container.querySelector("[role='alert']")).toBeNull();
  expect(mocks.getPlayersGameInfo).not.toHaveBeenCalled();
  expect(mocks.logError).not.toHaveBeenCalled();
});

function metadataError(id: string) {
  const { file, filename } = database(id);
  return { type: "error" as const, file, filename, indexed: false, error: "unreadable" };
}

test("a metadata failure names its filename beside the healthy statistics without another log", async () => {
  const firstRecord = { site: "Lichess", player: "Magnus", daily: [], openings: [] };
  mocks.getDatabases.mockResolvedValue([database("db-1"), metadataError("db-2")]);
  mocks.getPlayersGameInfo.mockResolvedValue({ site_stats_data: [firstRecord] });
  await renderDatabases();
  await vi.waitFor(() =>
    expect(container.textContent).toContain("Home.Databases.Incomplete.Title"),
  );
  expect(container.textContent).toContain("Magnus_chesscom.db3");
  expect(mocks.personalCardInfo).toHaveBeenLastCalledWith({ site_stats_data: [firstRecord] });
  expect(mocks.getPlayersGameInfo).toHaveBeenCalledOnce();
  expect(mocks.logError).not.toHaveBeenCalled();
});

test("only metadata failures render the failed state and every filename without another log", async () => {
  mocks.getDatabases.mockResolvedValue([metadataError("db-1"), metadataError("db-2")]);
  await renderDatabases();
  await vi.waitFor(() => expect(container.textContent).toContain("Home.Databases.Failed.Title"));
  expect(container.textContent).toContain("Magnus_lichess.db3, Magnus_chesscom.db3");
  expect(container.textContent).not.toContain("Home.Databases.Empty.Title");
  expect(mocks.query_players).not.toHaveBeenCalled();
  expect(mocks.getPlayersGameInfo).not.toHaveBeenCalled();
  expect(mocks.logError).not.toHaveBeenCalled();
});

test("an imported database with an account title or username substring is excluded", async () => {
  mocks.getDatabases.mockResolvedValue([
    { ...database("db-1"), filename: "OtherMagnus_lichess.db3" },
  ]);
  await renderDatabases();
  await vi.waitFor(() => expect(container.textContent).toContain("Home.Databases.Empty.Title"));
  expect(mocks.query_players).not.toHaveBeenCalled();
  expect(mocks.logError).not.toHaveBeenCalled();
});

test("a renamed account database remains included by filename with the owning username", async () => {
  getDefaultStore().set(sessionsAtom, [
    { ...session, player: "Player alias", lichess: { ...session.lichess, username: "magnus" } },
  ]);
  mocks.getDatabases.mockResolvedValue([
    Object.freeze({ ...database("db-1"), title: "My downloaded games" }),
  ]);
  mocks.getPlayersGameInfo.mockResolvedValue({ site_stats_data: [] });
  await renderDatabases();
  await vi.waitFor(() => expect(mocks.personalCardInfo).toHaveBeenCalled());
  expect(mocks.query_players).toHaveBeenCalledWith(
    database("db-1").file,
    expect.objectContaining({ name: "Magnus" }),
    expect.anything(),
  );
  expect(container.querySelector("[role='alert']")).toBeNull();
});

test("a username-less session does not prevent a healthy account summary from loading", async () => {
  getDefaultStore().set(sessionsAtom, [{ player: "Magnus", updatedAt: 1 }, session]);
  const record = { site: "Lichess", player: "Magnus", daily: [], openings: [] };
  mocks.getPlayersGameInfo.mockResolvedValue({ site_stats_data: [record] });

  await renderDatabases();
  await vi.waitFor(() => expect(mocks.personalCardInfo).toHaveBeenCalled());

  expect(container.textContent).toContain("player-card");
  expect(mocks.personalCardInfo).toHaveBeenLastCalledWith({ site_stats_data: [record] });
  expect(mocks.query_players).toHaveBeenCalledWith(
    database("db-1").file,
    expect.objectContaining({ name: "Magnus" }),
    expect.anything(),
  );
  expect(mocks.logError).not.toHaveBeenCalled();
});
