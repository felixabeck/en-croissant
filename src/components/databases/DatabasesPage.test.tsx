import { act, useEffect, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { SWRConfig, useSWRConfig } from "swr";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { RootFailure } from "@/bindings";
import DatabasesPage from "./DatabasesPage";

const mocks = vi.hoisted(() => ({
  getDatabaseWorkspace: vi.fn(),
  listWorkspaceDatabases: vi.fn(),
  getDbInfo: vi.fn(),
  issueDatabaseWorkspace: vi.fn(),
  notify: vi.fn(),
}));
vi.mock("@/platform/tauri", async () => ({
  ...(await vi.importActual<typeof import("@/platform/tauri")>("@/platform/tauri")),
  tauri: mocks,
}));
vi.mock("@mantine/notifications", () => ({ notifications: { show: mocks.notify } }));
vi.mock("@/i18n", () => ({
  default: {
    t: (key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? key,
  },
}));
vi.mock("react-i18next", async () => {
  const catalogue = (await import("@/translation/en-US.json")).default.translation as Record<
    string,
    string
  >;
  return {
    useTranslation: () => ({
      t: (key: string, options?: { defaultValue?: string }) =>
        options?.defaultValue ?? catalogue[key] ?? key,
    }),
  };
});
vi.mock("@tanstack/react-router", () => ({ Link: () => null, useNavigate: () => vi.fn() }));
vi.mock("@/state/store/database", () => ({
  activeDatabaseViewStore: { getState: () => ({ database: null }) },
  useActiveDatabaseViewStore: () => vi.fn(),
}));
vi.mock("@/components/common/ConfirmModal", () => ({ default: () => null }));
vi.mock("@/components/common/GenericCard", () => ({
  default: ({ Header }: { Header: ReactNode }) => <article>{Header}</article>,
}));
vi.mock("./AddDatabase", () => ({ default: () => null }));
vi.mock("./PlayerSearchInput", () => ({ PlayerSearchInput: () => null }));
vi.mock("@/components/common/IconAction", () => ({
  IconAction: () => <button type="button">Add New</button>,
}));
vi.mock("@mantine/core", () => {
  const box = ({ children, role }: { children?: ReactNode; role?: string }) => (
    <div role={role}>{children}</div>
  );
  return {
    Box: box,
    Center: box,
    Divider: () => null,
    Group: box,
    Paper: box,
    Rating: () => null,
    ScrollArea: box,
    SimpleGrid: box,
    Stack: box,
    Text: box,
    ThemeIcon: box,
    Title: box,
    Tooltip: box,
    Skeleton: () => <span data-testid="loading">Loading</span>,
    Loader: () => null,
    Button: ({
      children,
      disabled,
      onClick,
    }: {
      children: ReactNode;
      disabled?: boolean;
      onClick?: () => void;
    }) => (
      <button type="button" disabled={disabled} onClick={onClick}>
        {children}
      </button>
    ),
    Input: ({
      value,
      onChange,
    }: {
      value: string;
      onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
    }) => <input value={value} onChange={onChange} />,
    Checkbox: () => null,
    Textarea: () => null,
    TextInput: () => null,
  };
});

const folder = (id: string) => ({ id: { id }, kind: "databaseWorkspace" });
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const entry = {
  handle: { id: { id: "new-db" }, kind: "database" },
  filename: "new.db3",
  availability: "available",
};
function failure(rootFailure?: RootFailure, category = "io") {
  return {
    tag: "backend-error",
    category,
    message: "native listing failure",
    ...(rootFailure ? { rootFailure } : {}),
  };
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
}
let host: HTMLDivElement;
let root: Root;
let cache: Map<string, any>;
let revalidate!: () => Promise<unknown>;
function Capture() {
  const { mutate } = useSWRConfig();
  useEffect(() => {
    revalidate = () => mutate("databases");
  }, [mutate]);
  return null;
}
async function render() {
  await act(async () =>
    root.render(
      <SWRConfig
        value={{
          provider: () => cache,
          shouldRetryOnError: false,
          revalidateOnFocus: false,
          dedupingInterval: 0,
        }}
      >
        <Capture />
        <DatabasesPage />
      </SWRConfig>,
    ),
  );
}
async function flush() {
  await act(async () => {
    for (let i = 0; i < 12; i++) await Promise.resolve();
  });
}
function choose() {
  return Array.from(host.querySelectorAll("button")).find(
    (button) => button.textContent === "Choose database folder",
  );
}
async function clickChoose() {
  await act(async () => choose()!.click());
}
function alert() {
  return host.querySelector('[role="alert"]');
}

test.each([true, false])(
  "workspace acquisition refusal renders recovery with rootFailure=%s",
  async (labelled) => {
    mocks.getDatabaseWorkspace.mockRejectedValue(failure(labelled ? "missing" : undefined));
    await render();
    expect(alert()?.textContent).toContain(
      labelled
        ? "This database folder is no longer available. Choose another."
        : "Could not load databases. Please try again.",
    );
    expect(choose() !== undefined).toBe(labelled);
    expect(mocks.listWorkspaceDatabases).not.toHaveBeenCalled();
    expect(host.textContent).not.toContain("No databases installed");
  },
);

beforeEach(() => {
  vi.resetAllMocks();
  cache = new Map();
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  mocks.getDatabaseWorkspace.mockResolvedValue(folder("old"));
  mocks.listWorkspaceDatabases.mockResolvedValue([]);
  mocks.getDbInfo.mockResolvedValue({
    title: "New root content",
    filename: "new.db3",
    description: "",
    game_count: 0,
    player_count: 0,
    event_count: 0,
    indexed: false,
  });
  mocks.issueDatabaseWorkspace.mockResolvedValue(folder("new"));
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});

describe("listing failure copy and state", () => {
  test.each([
    ["changed", "This database folder changed. Choose another."],
    ["missing", "This database folder is no longer available. Choose another."],
    ["unusable", "This database folder cannot be opened. Choose another."],
    ["permission", "ChessFable is not allowed to read this database folder. Choose another."],
    ["too-large", "This database folder is too large to list. Choose another."],
  ])("%s renders its sentence and chooser", async (reason, sentence) => {
    mocks.listWorkspaceDatabases.mockRejectedValue(failure(reason as RootFailure));
    await render();
    expect(alert()?.textContent).toContain(sentence);
    expect(choose()).toBeDefined();
    expect(host.textContent).not.toContain("No databases installed");
    expect(host.textContent).not.toContain("Add a database to get started");
  });
  test.each(["conflict", "missing-resource", "permission", "resource-limit", "io", "plain"])(
    "%s without rootFailure retries without chooser",
    async (category) => {
      mocks.listWorkspaceDatabases.mockRejectedValue(
        category === "plain" ? new Error("failure") : failure(undefined, category),
      );
      await render();
      expect(alert()?.textContent).toBe("Could not load databases. Please try again.");
      expect(choose()).toBeUndefined();
      expect(host.textContent).not.toContain("No databases installed");
      expect(host.textContent).not.toContain("Add a database to get started");
    },
  );
  test("successful empty listing preserves the empty state", async () => {
    await render();
    expect(host.textContent).toContain("No databases installed");
    expect(host.textContent).toContain("Add a database to get started");
    expect(alert()).toBeNull();
  });
  test.each(["cancellation", "visible failure"])(
    "%s over a cached empty listing shows only its appropriate state",
    async (outcome) => {
      await render();
      expect(cache.get("databases")?.data).toEqual([]);
      mocks.listWorkspaceDatabases.mockRejectedValue(
        outcome === "cancellation"
          ? new DOMException("Cancellation", "AbortError")
          : failure("too-large"),
      );
      await act(async () => revalidate());
      expect(cache.get("databases")?.data).toEqual([]);
      expect(host.textContent?.includes("No databases installed")).toBe(outcome === "cancellation");
      expect(host.textContent?.includes("Add a database to get started")).toBe(
        outcome === "cancellation",
      );
      const expectedAlert =
        outcome === "cancellation"
          ? null
          : "This database folder is too large to list. Choose another.Choose database folder";
      expect(alert()?.textContent ?? null).toBe(expectedAlert);
      expect(choose() !== undefined).toBe(outcome !== "cancellation");
    },
  );
  test.each([false, true])(
    "cancellation retains cached content=%s and never shows empty success",
    async (cached) => {
      mocks.listWorkspaceDatabases.mockRejectedValue(
        new DOMException("Cancellation", "AbortError"),
      );
      if (cached)
        cache.set("databases", {
          data: [
            { type: "success", file: entry.handle, title: "Cached database", filename: "old.db3" },
          ],
        });
      await render();
      if (cached) await act(async () => revalidate());
      expect(alert()).toBeNull();
      expect(choose()).toBeUndefined();
      expect(host.textContent).not.toContain("No databases installed");
      expect(host.textContent).not.toContain("Add a database to get started");
      expect(host.textContent?.includes("Cached database")).toBe(cached);
      expect(host.querySelector('[data-testid="loading"]') !== null).toBe(!cached);
    },
  );
  test("failure keeps cached data next to its alert", async () => {
    cache.set("databases", {
      data: [
        { type: "success", file: entry.handle, title: "Cached database", filename: "old.db3" },
      ],
    });
    mocks.listWorkspaceDatabases.mockRejectedValue(failure("permission"));
    await render();
    await act(async () => revalidate());
    expect(host.textContent).toContain("Cached database");
    expect(alert()?.textContent).toContain(
      "ChessFable is not allowed to read this database folder. Choose another.",
    );
    expect(host.textContent).not.toContain("No databases installed");
  });
});

describe("database folder recovery", () => {
  async function failedListing() {
    mocks.listWorkspaceDatabases.mockRejectedValueOnce(failure("missing"));
    await render();
    expect(choose()).toBeDefined();
  }
  function newListing() {
    mocks.listWorkspaceDatabases.mockResolvedValue([entry]);
  }
  test("click issues a folder, relists its root and clears the alert", async () => {
    await failedListing();
    mocks.issueDatabaseWorkspace.mockImplementation(async () => {
      mocks.getDatabaseWorkspace.mockResolvedValue(folder("new"));
      return folder("new");
    });
    newListing();
    await clickChoose();
    expect(mocks.issueDatabaseWorkspace).toHaveBeenCalledOnce();
    expect(mocks.listWorkspaceDatabases).toHaveBeenLastCalledWith(
      folder("new"),
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(host.textContent).toContain("New root content");
    expect(alert()).toBeNull();
  });
  test.each(
    [
      "never",
      "late success",
      "late rejection",
      "new failure then late success",
      "new failure then late rejection",
    ].flatMap((outcome) => ["root acquisition", "listing"].map((stage) => [outcome, stage])),
  )("old root cannot win: %s during %s", async (outcome, stage) => {
    await failedListing();
    const old = deferred<unknown>();
    if (stage === "root acquisition")
      mocks.getDatabaseWorkspace.mockImplementationOnce(() => old.promise);
    else mocks.listWorkspaceDatabases.mockImplementationOnce(() => old.promise);
    let oldRevalidation!: Promise<unknown>;
    await act(async () => {
      oldRevalidation = revalidate();
      await Promise.resolve();
    });
    expect(mocks.getDatabaseWorkspace).toHaveBeenCalledTimes(2);
    mocks.issueDatabaseWorkspace.mockImplementation(async () => {
      mocks.getDatabaseWorkspace.mockResolvedValue(folder("new"));
      return folder("new");
    });
    const newFailure = outcome.startsWith("new failure");
    if (newFailure) mocks.listWorkspaceDatabases.mockRejectedValue(failure("too-large"));
    else newListing();
    await clickChoose();
    await oldRevalidation;
    expect(mocks.getDatabaseWorkspace).toHaveBeenCalledTimes(3);
    const expectedAlert = newFailure
      ? "This database folder is too large to list. Choose another.Choose database folder"
      : null;
    expect(alert()?.textContent ?? null).toBe(expectedAlert);
    expect(choose() !== undefined).toBe(newFailure);
    expect(host.textContent?.includes("New root content")).toBe(!newFailure);
    if (outcome !== "never") {
      await act(async () =>
        outcome.endsWith("rejection")
          ? old.reject(new Error("late native failure"))
          : old.resolve(stage === "root acquisition" ? folder("old") : [entry]),
      );
      await flush();
    }
    expect(alert()?.textContent ?? null).toBe(expectedAlert);
    expect(choose() !== undefined).toBe(newFailure);
    expect(host.textContent?.includes("New root content")).toBe(!newFailure);
  });
  test.each(["Cancellation", "native refusal"])(
    "%s does not relist and releases the guard",
    async (message) => {
      await failedListing();
      mocks.issueDatabaseWorkspace
        .mockRejectedValueOnce(new Error(message))
        .mockRejectedValueOnce(new Error("Cancellation"));
      const calls = mocks.getDatabaseWorkspace.mock.calls.length;
      await clickChoose();
      expect(mocks.getDatabaseWorkspace).toHaveBeenCalledTimes(calls);
      expect(mocks.notify.mock.calls).toEqual(
        message === "Cancellation" ? [] : [[{ color: "red", title: "Error", message }]],
      );
      await clickChoose();
      expect(mocks.issueDatabaseWorkspace).toHaveBeenCalledTimes(2);
      expect(mocks.getDatabaseWorkspace).toHaveBeenCalledTimes(calls);
    },
  );
  test("changed picker rejection uses the changed sentence and does not relist", async () => {
    await failedListing();
    mocks.issueDatabaseWorkspace.mockRejectedValueOnce(failure("changed", "conflict"));
    await clickChoose();
    expect(mocks.notify).toHaveBeenCalledWith({
      color: "red",
      title: "Error",
      message: "This database folder changed. Choose another.",
    });
    expect(mocks.getDatabaseWorkspace).toHaveBeenCalledOnce();
  });
  test("a pending chooser admits only one activation", async () => {
    await failedListing();
    const pick = deferred<ReturnType<typeof folder>>();
    mocks.issueDatabaseWorkspace.mockReturnValue(pick.promise);
    const button = choose()!;
    await act(async () => {
      button.click();
      button.click();
    });
    expect(mocks.issueDatabaseWorkspace).toHaveBeenCalledOnce();
    expect(button.disabled).toBe(true);
    newListing();
    await act(async () => pick.resolve(folder("new")));
    expect(host.textContent).toContain("New root content");
    expect(alert()).toBeNull();
  });
});
