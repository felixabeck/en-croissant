import { act, useEffect, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import useSWR, { SWRConfig } from "swr";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { useNativeRequestOwner } from "@/hooks/useNativeRequestOwner";
import { installResizeObserverStub } from "@/tests/resizeObserver";

installResizeObserverStub();

const mocks = vi.hoisted(() => ({ getDatabases: vi.fn(), setDatabase: vi.fn() }));

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
vi.mock("./GameTable", () => ({ default: () => null }));
vi.mock("./PlayerTable", () => ({ default: () => null }));
vi.mock("./TournamentTable", () => ({ default: () => null }));
vi.mock("@/state/store/database", () => {
  const state = {
    database: null,
    activeTab: "games",
    clearDatabase: vi.fn(),
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
    expect(alert?.querySelector("a")?.getAttribute("href")).toBe("/databases");
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
    storage_size: BigInt(0),
    indexed: false,
  };
  mocks.getDatabases.mockResolvedValueOnce([database]);
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
