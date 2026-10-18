import { act, useEffect, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import useSWR, { SWRConfig } from "swr";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { useNativeRequestOwner } from "@/hooks/useNativeRequestOwner";
import { installResizeObserverStub } from "@/tests/resizeObserver";
import type { SuccessDatabaseInfo } from "@/utils/db";

installResizeObserverStub();

const mocks = vi.hoisted(() => ({
  getDatabases: vi.fn(),
  setDatabase: vi.fn(),
  clearDatabase: vi.fn(),
  database: undefined as SuccessDatabaseInfo | undefined,
}));

vi.mock("@/utils/db", async () => {
  const actual = await vi.importActual<typeof import("@/utils/db")>("@/utils/db");
  return { ...actual, getDatabases: mocks.getDatabases };
});
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: { children: ReactNode; to: string }) => <a href={to}>{children}</a>,
  useParams: () => ({ databaseId: "db-1" }),
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? key,
  }),
}));
vi.mock("@tabler/icons-react", () => ({
  IconArrowBackUp: () => null,
  IconChess: () => null,
  IconTrophy: () => null,
  IconUser: () => null,
}));
vi.mock("@mantine/core", () => ({
  Box: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Button: ({ children, onClick }: { children: ReactNode; onClick: () => void }) => (
    <button onClick={onClick}>{children}</button>
  ),
  Center: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Group: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Loader: () => <span>loading</span>,
  Stack: ({ children, role }: { children: ReactNode; role?: string }) => (
    <div role={role}>{children}</div>
  ),
  Tabs: Object.assign(({ children }: { children: ReactNode }) => <div>{children}</div>, {
    List: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    Tab: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    Panel: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  }),
  Text: ({ children }: { children: ReactNode }) => <span>{children}</span>,
  Title: ({ children }: { children: ReactNode }) => <h1>{children}</h1>,
}));
vi.mock("@/components/common/IconAction", () => ({
  IconAction: ({ children }: { children: ReactNode }) => <button>{children}</button>,
}));
vi.mock("./GameTable", () => ({ default: () => <div>games table</div> }));
vi.mock("./PlayerTable", () => ({ default: () => <div>players table</div> }));
vi.mock("./TournamentTable", () => ({ default: () => <div>tournaments table</div> }));
vi.mock("@/state/store/database", () => {
  const state = {
    get database() {
      return mocks.database;
    },
    activeTab: "games",
    clearDatabase: mocks.clearDatabase,
    setActiveTab: vi.fn(),
    setDatabase: mocks.setDatabase,
  };
  return {
    activeDatabaseViewStore: { getState: () => state },
    useActiveDatabaseViewStore: (selector: (value: typeof state) => unknown) => selector(state),
  };
});

import DatabaseView from "./DatabaseView";

function Peer({ onData }: { onData: (value: unknown) => void }) {
  const owner = useNativeRequestOwner("databases");
  const { data } = useSWR("databases", () =>
    owner!.run((signal) => mocks.getDatabases({ signal })),
  );
  useEffect(() => {
    if (data) onData(data);
  }, [data, onData]);
  return null;
}

function Tree({
  view,
  peer,
  onData,
}: {
  view: boolean;
  peer: boolean;
  onData: (v: unknown) => void;
}) {
  return (
    <SWRConfig value={{ provider: () => cache, shouldRetryOnError: false }}>
      {view && <DatabaseView />}
      {peer && <Peer onData={onData} />}
    </SWRConfig>
  );
}

const cache = new Map();
let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  cache.clear();
  mocks.getDatabases.mockReset();
  mocks.setDatabase.mockReset();
  mocks.clearDatabase.mockReset();
  mocks.database = undefined;
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

async function render(view: boolean, peer: boolean, onData = vi.fn()) {
  await act(async () => root.render(<Tree view={view} peer={peer} onData={onData} />));
}

const selectedDatabase: SuccessDatabaseInfo = {
  type: "success",
  file: { id: { id: "db-1" }, kind: "database" },
  filename: "selected.db3",
  title: "Selected database",
  description: "",
  player_count: 0,
  event_count: 0,
  game_count: 0,
  storage_size: "0",
  indexed: false,
};

test.each([
  {
    unread: [{ filename: "selected.db3", error: "Unread permission sentence" }],
    message: "Unread permission sentence",
  },
  {
    unread: [
      { filename: "selected.db3", error: "First unread error" },
      { filename: "selected.db3", error: "Second unread error" },
    ],
    message: "Databases.LoadError.Title",
  },
])("preserves the selected unread database and shows $message", async ({ unread, message }) => {
  mocks.database = selectedDatabase;
  mocks.getDatabases.mockResolvedValue({ databases: [], unread });
  await render(true, false);

  expect(mocks.clearDatabase).not.toHaveBeenCalled();
  expect(mocks.setDatabase).not.toHaveBeenCalled();
  expect(container.querySelector('[role="alert"]')?.textContent).toContain(message);
  expect(container.querySelector("a")?.getAttribute("href")).toBe("/library");
  expect(container.textContent).not.toMatch(/games table|players table|tournaments table/);
  expect(container.textContent).not.toContain("Databases.NoSelection");
});

test.each([
  { filename: "another.db3", handleId: "db-1" },
  { filename: "selected.db3", handleId: "other-database" },
])(
  "clears a selection without both the route and unread filename match: %j",
  async ({ filename, handleId }) => {
    mocks.database = { ...selectedDatabase, file: { id: { id: handleId }, kind: "database" } };
    mocks.getDatabases.mockResolvedValue({
      databases: [],
      unread: [{ filename, error: "Unread error" }],
    });
    await render(true, false);

    expect(mocks.clearDatabase).toHaveBeenCalledOnce();
    expect(container.textContent).toContain("Databases.NoSelection");
    expect(container.querySelector('[role="alert"]')).toBeNull();
  },
);

test("a whole-list failure preserves the selection and uses the listing failure path", async () => {
  mocks.database = selectedDatabase;
  mocks.getDatabases.mockRejectedValue(new Error("listing failed"));
  await render(true, false);

  expect(mocks.clearDatabase).not.toHaveBeenCalled();
  expect(container.querySelector('[role="alert"]')?.textContent).toContain(
    "Could not load databases. Please try again.",
  );
  expect(container.querySelector('[role="alert"] button')?.textContent).toBe("Retry");
});

test.each([
  {
    error: new Error("database listing failed"),
    message: "Could not load databases. Please try again.",
  },
  {
    error: { category: "not-found", message: "missing root", rootFailure: "missing" },
    message: "This database folder is no longer available. Choose another.",
  },
])(
  "database listing failure shows an alert with $message and retry",
  async ({ error, message }) => {
    mocks.getDatabases.mockRejectedValue(error);
    await render(true, false);

    const alert = container.querySelector('[role="alert"]');
    expect(alert?.textContent).toContain(message);
    expect(alert?.querySelector("button")?.textContent).toBe("Retry");
    expect(alert?.querySelector("a")?.getAttribute("href")).toBe("/library");
    expect(container.textContent).not.toContain("loading");
  },
);

test("retry reloads a matching database and leaves the failure state", async () => {
  mocks.getDatabases.mockRejectedValueOnce(new Error("database listing failed"));
  await render(true, false);
  const retry = container.querySelector<HTMLButtonElement>('[role="alert"] button');
  expect(retry).not.toBeNull();

  const database = {
    type: "success",
    file: { id: { id: "db-1" }, kind: "database" },
    filename: "db-1.db3",
    title: "Recovered database",
    description: "",
    player_count: 0,
    event_count: 0,
    game_count: 0,
    storage_size: "0",
    indexed: false,
  };
  mocks.getDatabases.mockResolvedValueOnce({
    databases: [database],
    unread: [],
    root: { id: { id: "listing-test-root" }, kind: "databaseRoot" as const },
  });
  await act(async () => retry!.click());

  expect(mocks.getDatabases).toHaveBeenCalledTimes(2);
  expect(mocks.setDatabase).toHaveBeenCalledWith(database);
  expect(container.querySelector('[role="alert"]')).toBeNull();
});

test("cancelled database listing keeps the loader without an alert or retry", async () => {
  const error = new DOMException("Cancellation", "AbortError");
  mocks.getDatabases.mockRejectedValue(error);
  await render(true, false);

  expect(cache.get("databases")?.error).toBe(error);
  expect(container.textContent).toBe("loading");
  expect(container.querySelector('[role="alert"]')).toBeNull();
  expect(container.querySelector("button")).toBeNull();
});

test("real DatabaseView unsubscribe preserves its shared request and peer publication", async () => {
  let resolve!: (value: unknown[]) => void;
  let signal!: AbortSignal;
  mocks.getDatabases.mockImplementation(
    ({ signal: next }: { signal: AbortSignal }) =>
      new Promise((done) => {
        signal = next;
        resolve = done;
      }),
  );
  const onData = vi.fn();
  await render(true, true, onData);
  await vi.waitFor(() => expect(mocks.getDatabases).toHaveBeenCalledOnce());
  await render(false, true, onData);
  await act(async () => Promise.resolve());
  expect(signal.aborted).toBe(false);
  resolve([]);
  await vi.waitFor(() => expect(onData).toHaveBeenCalledWith([]));
});

test("real DatabaseView shared request cancels exactly once after sequential final unsubscribe", async () => {
  const cancelled = vi.fn();
  mocks.getDatabases.mockImplementation(
    ({ signal }: { signal: AbortSignal }) =>
      new Promise((_resolve, reject) => {
        signal.addEventListener(
          "abort",
          () => {
            cancelled();
            reject(new DOMException("Cancellation", "AbortError"));
          },
          { once: true },
        );
      }),
  );
  await render(true, true);
  await vi.waitFor(() => expect(mocks.getDatabases).toHaveBeenCalledOnce());
  await render(false, true);
  await act(async () => Promise.resolve());
  expect(cancelled).not.toHaveBeenCalled();
  await render(false, false);
  await vi.waitFor(() => expect(cancelled).toHaveBeenCalledOnce());
});
