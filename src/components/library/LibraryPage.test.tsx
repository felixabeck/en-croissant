import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MantineProvider } from "@mantine/core";
import { createStore, Provider } from "jotai";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { fileWorkspaceAtom, databaseConversionStateAtom } from "@/state/atoms";
import { activeDatabaseViewStore } from "@/state/store/database";
import { workspaceListingToEntries, type Entry } from "@/components/files/file";
import type { ManagedDatabaseInfo } from "@/utils/db";
import { installMatchMediaStub } from "@/tests/matchMedia";
import { installResizeObserverStub } from "@/tests/resizeObserver";
import LibraryPage from "./LibraryPage";

const mocks = vi.hoisted(() => ({
  files: [] as Entry[] | undefined,
  databases: [] as ManagedDatabaseInfo[] | undefined,
  unread: [] as { filename: string; error: string }[],
  fileError: undefined as unknown,
  databaseError: undefined as unknown,
  fileMutate: vi.fn(),
  databaseMutate: vi.fn(),
  createWorkspaceFile: vi.fn(),
  createWorkspaceDirectory: vi.fn(),
  moveWorkspaceEntry: vi.fn(),
  editDbInfo: vi.fn(),
  navigate: vi.fn(),
  openFile: vi.fn(),
}));
vi.mock("swr", async () => ({
  ...(await vi.importActual<typeof import("swr")>("swr")),
  default: (key: unknown) =>
    key === "databases"
      ? {
          data: mocks.databases
            ? {
                databases: mocks.databases,
                unread: mocks.unread,
                root: { id: { id: "library-db-root" }, kind: "databaseRoot" },
              }
            : undefined,
          error: mocks.databaseError,
          mutate: mocks.databaseMutate,
        }
      : { data: key ? mocks.files : undefined, error: mocks.fileError, mutate: mocks.fileMutate },
}));
vi.mock("react-i18next", async () => {
  const catalogue = (await import("@/translation/en-US.json")).default.translation as Record<
    string,
    string
  >;
  return {
    useTranslation: () => ({
      t: (key: string, options?: { defaultValue?: string }) =>
        catalogue[key] ?? options?.defaultValue ?? key,
    }),
  };
});
vi.mock("@/platform/tauri", async () => ({
  ...(await vi.importActual<typeof import("@/platform/tauri")>("@/platform/tauri")),
  tauri: {
    createWorkspaceFile: mocks.createWorkspaceFile,
    createWorkspaceDirectory: mocks.createWorkspaceDirectory,
    moveWorkspaceEntry: mocks.moveWorkspaceEntry,
    editDbInfo: mocks.editDbInfo,
  },
}));
vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => mocks.navigate,
  Link: ({ children }: { children: React.ReactNode }) => (
    <a href="/databases/fixture">{children}</a>
  ),
}));
vi.mock("@/utils/files", async () => ({
  ...(await vi.importActual<typeof import("@/utils/files")>("@/utils/files")),
  openFile: mocks.openFile,
}));
vi.mock("@/components/files/FileCard", () => ({
  default: ({ selected }: { selected: Entry }) => <output data-file-detail>{selected.name}</output>,
}));
vi.mock("@/components/databases/PlayerSearchInput", () => ({ PlayerSearchInput: () => null }));
vi.mock("@/components/databases/AddDatabase", () => ({
  default: ({
    opened,
    disableLocalConversion,
  }: {
    opened: boolean;
    disableLocalConversion: boolean;
  }) => (opened ? <output data-import data-disabled={disableLocalConversion} /> : null),
}));
vi.mock("@/components/common/AppModal", () => ({
  default: ({ opened, children }: { opened: boolean; children: React.ReactNode }) =>
    opened ? <div role="dialog">{children}</div> : null,
}));

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
installMatchMediaStub();
installResizeObserverStub();
const workspace = { id: { id: "workspace" }, kind: "fileWorkspace" as const };
const file: Entry = {
  type: "file",
  handle: { id: { id: "same-id" }, kind: "fileWorkspace" },
  name: "Same name",
  metadata: { type: "repertoire", tags: [] },
  numGames: 2,
  lastModified: 0,
};
const database: ManagedDatabaseInfo = {
  type: "success",
  file: { id: { id: "same-id" }, kind: "database" },
  filename: "same.db3",
  title: "Same name",
  description: "Database description",
  indexed: false,
  game_count: 2,
  player_count: 2,
  event_count: 2,
  storage_size: "0",
};
let root: Root;
let host: HTMLDivElement;
let store: ReturnType<typeof createStore>;
async function render() {
  await act(async () =>
    root.render(
      <Provider store={store}>
        <MantineProvider>
          <LibraryPage />
        </MantineProvider>
      </Provider>,
    ),
  );
}
beforeEach(async () => {
  vi.clearAllMocks();
  mocks.files = [file];
  mocks.databases = [database];
  mocks.unread = [];
  mocks.fileError = undefined;
  mocks.databaseError = undefined;
  mocks.fileMutate.mockResolvedValue(undefined);
  mocks.databaseMutate.mockResolvedValue(undefined);
  store = createStore();
  store.set(fileWorkspaceAtom, workspace);
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await render();
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  activeDatabaseViewStore.getState().clearDatabase();
  localStorage.clear();
  sessionStorage.clear();
});
function rows() {
  return [...host.querySelectorAll<HTMLElement>('[role="treeitem"]')];
}

test("unread peers use root and index keys, show category copy and leave healthy siblings usable", async () => {
  mocks.unread = [
    { filename: "�.db3", error: "ChessFable is not allowed to read this database file" },
    { filename: "�.db3", error: "ChessFable is not allowed to read this database file" },
  ];
  mocks.files = workspaceListingToEntries(
    {
      entries: [],
      unread: [
        { name: "�.pgn", kind: "file", category: "permission", parent: null },
        { name: "�.pgn", kind: "file", category: "permission", parent: null },
      ],
    },
    workspace,
  );
  await render();
  const unreadRows = rows().filter((row) => row.getAttribute("aria-label")?.startsWith("�"));
  expect(unreadRows).toHaveLength(4);
  for (const row of unreadRows) {
    expect(row.draggable).toBe(false);
    expect(row.querySelector("button")).toBeNull();
    await act(async () => {
      row.click();
      row.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
      row.dispatchEvent(new KeyboardEvent("keydown", { key: "m", bubbles: true }));
      row.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
    });
  }
  expect(mocks.openFile).not.toHaveBeenCalled();
  expect(mocks.navigate).not.toHaveBeenCalled();
  expect(host.querySelector('[role="alert"]')).toBeNull();
  expect(host.textContent).not.toContain("Files could not be loaded");
  expect(host.textContent).toContain("The action could not be completed. Please try again.");
  expect(host.textContent).toContain("ChessFable is not allowed to read this database file");
  for (const row of unreadRows) {
    await act(async () => {
      row.focus();
      row.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: rows().at(-1) === row ? "ArrowUp" : "ArrowDown",
          bubbles: true,
        }),
      );
    });
    expect(document.activeElement).not.toBe(row);
  }
  const healthy = rows().find((row) => row.getAttribute("aria-label") === "Same name")!;
  await act(async () =>
    healthy.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })),
  );
  expect(mocks.navigate).toHaveBeenCalledWith({
    to: "/databases/$databaseId",
    params: { databaseId: "same-id" },
  });
});
async function click(element: HTMLElement) {
  await act(async () => element.click());
}
function button(label: string) {
  return [...document.querySelectorAll<HTMLButtonElement>("button")].find(
    (item) => item.textContent === label,
  )!;
}
async function input(element: HTMLInputElement, value: string) {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(element, value);
    element.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

test("one tree distinguishes equal-name and equal-key file/database identities and detail actions", async () => {
  expect(host.querySelectorAll('[role="tree"]')).toHaveLength(1);
  expect(rows()).toHaveLength(2);
  expect(rows().map((row) => row.getAttribute("aria-label"))).toEqual(["Same name", "Same name"]);
  await click(rows()[0]);
  expect(host.querySelector("[data-file-detail]")).not.toBeNull();
  expect(button("Trash")).toBeDefined();
  await click(rows()[1]);
  expect(host.querySelector("[data-file-detail]")).toBeNull();
  expect(button("Trash")).toBeUndefined();
  expect(host.querySelector('input[value="Same name"]')).not.toBeNull();
  expect(button("Add Games")).toBeDefined();
  expect(rows().map((row) => row.getAttribute("aria-selected"))).toEqual(["false", "true"]);
});

test("keyboard focus traverses both kinds and Enter opens the database by capability", async () => {
  await act(async () => {
    rows()[0].focus();
    rows()[0].dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
  });
  expect(document.activeElement).toBe(rows()[1]);
  await act(async () =>
    rows()[1].dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })),
  );
  expect(mocks.navigate).toHaveBeenCalledWith({
    to: "/databases/$databaseId",
    params: { databaseId: "same-id" },
  });
  expect(activeDatabaseViewStore.getState().database?.file).toEqual(database.file);
});

test("search retains a hidden selection and relisting removes only the vanished item", async () => {
  await click(rows()[0]);
  await input(host.querySelector('input[aria-label="Search"]')!, "Database description");
  expect(rows()).toHaveLength(1);
  expect(host.querySelector("[data-file-detail]")).not.toBeNull();
  mocks.databases = [];
  await render();
  expect(host.querySelector("[data-file-detail]")).not.toBeNull();
  mocks.files = [];
  await render();
  expect(host.querySelector("[data-file-detail]")).toBeNull();
  expect(host.textContent).toContain("Select a library item");
  expect(host.textContent).toContain("No results");
});

test("workspace replacement clears its selection while preserving a database selection", async () => {
  await click(rows()[0]);
  await act(async () => store.set(fileWorkspaceAtom, { ...workspace, id: { id: "next-root" } }));
  expect(host.querySelector("[data-file-detail]")).toBeNull();
  await click(rows()[1]);
  await act(async () => store.set(fileWorkspaceAtom, null));
  expect(host.querySelector('input[value="Same name"]')).not.toBeNull();
});

test.each(["files", "databases"])(
  "a %s failure leaves the sibling selectable and exposes source-labelled recovery",
  async (source) => {
    const error = {
      tag: "backend-error",
      category: "io",
      message: "private diagnostic",
      rootFailure: "missing",
    };
    if (source === "files") mocks.fileError = error;
    else mocks.databaseError = error;
    await render();
    expect(host.querySelector(`[data-library-source="${source}"] [role="alert"]`)).not.toBeNull();
    expect(host.textContent).not.toContain("Your library is empty");
    await click(rows()[0]);
    expect(
      source === "files"
        ? host.querySelector('input[value="Same name"]')
        : host.querySelector("[data-file-detail]"),
    ).not.toBeNull();
  },
);

test("conversion hides actions and restores the same database selection after completion", async () => {
  await click(rows()[1]);
  await act(async () =>
    store.set(databaseConversionStateAtom, [
      {
        id: "conversion",
        targetDatabase: database.file,
        targetDatabaseTitle: "Same name",
        totalGames: 0,
        elapsedSeconds: 0,
        sourceFileName: "import.pgn",
      },
    ]),
  );
  expect(button("Add Games")).toBeUndefined();
  expect(host.textContent).toContain("This database is being converted");
  mocks.databases = [];
  await render();
  mocks.databases = [database];
  await render();
  await act(async () => store.set(databaseConversionStateAtom, []));
  expect(button("Add Games")).toBeDefined();
  expect(rows()[1].getAttribute("aria-selected")).toBe("true");
});

test("file creation uses a selected folder, and a database never becomes a file destination", async () => {
  const folder: Entry = {
    type: "directory",
    handle: { ...workspace, id: { id: "folder" } },
    name: "Folder",
    children: [],
    lastModified: 0,
  };
  mocks.files = [folder];
  await render();
  for (const [row, destination] of [
    [0, folder.handle],
    [1, workspace],
  ] as const) {
    await click(rows()[row]);
    await click(button("Create file"));
    await input(document.querySelector('[role="dialog"] input')!, "Created");
    await click(button("Confirm"));
    expect(mocks.createWorkspaceFile).toHaveBeenLastCalledWith(
      workspace,
      destination,
      "Created",
      { type: "game", tags: [] },
      { kind: "text", pgn: "*" },
    );
  }
  await click(button("Import or download database"));
  expect(host.querySelector("[data-import]")).not.toBeNull();
});

test("switching equal-filename database handles resets settings and suppresses pending stale edits", async () => {
  const other = {
    ...database,
    file: { ...database.file, id: { id: "other" } },
    title: "Other title",
  } as ManagedDatabaseInfo;
  mocks.databases = [database, other];
  await render();
  await click(rows()[1]);
  await input(host.querySelector('input[value="Same name"]')!, "Unsubmitted");
  await click(rows()[2]);
  expect(host.querySelector('input[value="Other title"]')).not.toBeNull();
  await act(async () => {
    await new Promise((done) => setTimeout(done, 350));
  });
  expect(mocks.editDbInfo).not.toHaveBeenCalled();
});

test("error metadata remains selectable with delete and without healthy-only operations", async () => {
  mocks.databases = [
    {
      type: "error",
      file: database.file,
      filename: "same.db3",
      indexed: false,
      error: "Corrupt metadata",
    },
  ];
  await render();
  await click(rows()[1]);
  expect(host.textContent).toContain("Corrupt metadata");
  expect(button("Delete")).toBeDefined();
  expect(button("Add Games")).toBeUndefined();
  expect(button("Open database")).toBeUndefined();
});

test("empty success differs from loading and source failure", async () => {
  mocks.files = [];
  mocks.databases = [];
  await render();
  expect(host.textContent).toContain("Your library is empty");
  mocks.databases = undefined;
  await render();
  expect(host.textContent).not.toContain("Your library is empty");
  expect(host.textContent).toContain("Loading games databases");
});

test("database rows cannot request a file move or carry a file drag payload", async () => {
  const databaseRow = rows()[1];
  expect(databaseRow.draggable).toBe(false);
  const setData = vi.fn();
  await act(async () => {
    databaseRow.dispatchEvent(new KeyboardEvent("keydown", { key: "m", bubbles: true }));
    const drag = new Event("dragstart", { bubbles: true });
    Object.assign(drag, { dataTransfer: { setData } });
    databaseRow.dispatchEvent(drag);
    databaseRow.dispatchEvent(new Event("drop", { bubbles: true }));
  });
  expect(document.querySelector('[role="dialog"]')).toBeNull();
  expect(setData).not.toHaveBeenCalled();
  expect(mocks.moveWorkspaceEntry).not.toHaveBeenCalled();
});

test("an unavailable listing retains database identity without claiming conversion, and removal clears it", async () => {
  await click(rows()[1]);
  mocks.databases = undefined;
  await render();
  expect(host.textContent).toContain("Loading games databases");
  expect(host.textContent).not.toContain("This database is being converted");
  mocks.databases = [database];
  await render();
  expect(host.querySelector('input[value="Same name"]')).not.toBeNull();
  mocks.databases = [];
  await render();
  mocks.databases = [database];
  await render();
  expect(host.querySelector('input[value="Same name"]')).toBeNull();
  expect(host.textContent).toContain("Select a library item");
});

test("the clearable type filter hides rows while retaining detail and exposes an accessible reset", async () => {
  await click(rows()[1]);
  await click(host.querySelector<HTMLInputElement>(".mantine-Select-input")!);
  const option = [...document.querySelectorAll<HTMLElement>('[role="option"]')].find(
    (node) => node.textContent === "Repertoire",
  )!;
  await click(option);
  expect(rows()).toHaveLength(1);
  expect(rows()[0].getAttribute("aria-label")).toBe("Same name");
  expect(host.querySelector('input[value="Same name"]')).not.toBeNull();
  const clear = host.querySelector<HTMLButtonElement>('button[aria-label="Clear type filter"]')!;
  expect(clear.getAttribute("aria-hidden")).toBe("false");
  expect(clear.tabIndex).toBe(0);
  await click(clear);
  expect(rows()).toHaveLength(2);
  expect(rows()[1].getAttribute("aria-selected")).toBe("true");
});
