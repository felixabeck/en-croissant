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
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@/components/files/notifyError", () => ({ notifyListenerError: vi.fn() }));
vi.mock("./PersonalCard", () => ({ default: () => <div>player-card</div> }));
vi.mock("@tabler/icons-react", () => ({ IconDatabaseOff: () => null }));
vi.mock("@mantine/core", () => ({
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
    title: "Magnus Lichess",
    description: "",
    player_count: 1,
    event_count: 1,
    game_count: 2,
    storage_size: 1n,
    filename: "Magnus.db3",
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
  getDefaultStore().set(sessionsAtom, [session]);
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
