import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { SWRConfig } from "swr";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { getDefaultStore, Provider, useAtomValue } from "jotai";
import type { DatabaseHandle } from "@/bindings";
import { databaseConversionStateAtom } from "@/state/atoms";
import { activeDatabaseViewStore } from "@/state/store/database";
import { conversionProgressId, databaseHandleKey, type SuccessDatabaseInfo } from "@/utils/db";
import { useConversionProgress } from "@/hooks/useConversionProgress";

const mocks = vi.hoisted(() => ({
  convertPgn: vi.fn(),
  getDatabaseWorkspace: vi.fn(),
  createWorkspaceDatabase: vi.fn(),
  listWorkspaceDatabases: vi.fn(),
  issuePgnWorkspace: vi.fn(),
  getDatabases: vi.fn(),
  pickPgnFile: vi.fn(),
  editDbInfo: vi.fn(),
  issueDownloadDestination: vi.fn(),
  downloadChessCom: vi.fn(),
  startProgress: vi.fn(),
  setProgressState: vi.fn(),
  deleteEmptyGames: vi.fn(),
  deleteDuplicatedGames: vi.fn(),
  mergePlayers: vi.fn(),
  createIndexes: vi.fn(),
  deleteIndexes: vi.fn(),
  convertProgress: vi.fn(),
  progress: vi.fn(),
  notify: vi.fn(),
}));

vi.mock("@/platform/tauri", async () => {
  const actual = await vi.importActual<typeof import("@/platform/tauri")>("@/platform/tauri");
  return {
    ...actual,
    tauri: {
      ...actual.tauri,
      convertPgn: mocks.convertPgn,
      getDatabaseWorkspace: mocks.getDatabaseWorkspace,
      createWorkspaceDatabase: mocks.createWorkspaceDatabase,
      listWorkspaceDatabases: mocks.listWorkspaceDatabases,
      issuePgnWorkspace: mocks.issuePgnWorkspace,
      editDbInfo: mocks.editDbInfo,
      issueDownloadDestination: mocks.issueDownloadDestination,
      startProgress: mocks.startProgress,
      setProgressState: mocks.setProgressState,
      deleteEmptyGames: mocks.deleteEmptyGames,
      deleteDatabase: vi.fn(),
      exportToPgn: vi.fn(),
      issuePgnExportDestination: vi.fn(),
      clearGames: vi.fn(),
      mergePlayers: mocks.mergePlayers,
      deleteDuplicatedGames: mocks.deleteDuplicatedGames,
      createIndexes: mocks.createIndexes,
      deleteIndexes: mocks.deleteIndexes,
      getPlayer: vi.fn(),
    },
    tauriSubscriptions: {
      ...actual.tauriSubscriptions,
      convertProgress: mocks.convertProgress,
      progress: mocks.progress,
    },
  };
});
vi.mock("@/utils/db", async () => {
  const actual = await vi.importActual<typeof import("@/utils/db")>("@/utils/db");
  return { ...actual, getDatabases: mocks.getDatabases };
});
vi.mock("@/utils/files", async () => {
  const actual = await vi.importActual<typeof import("@/utils/files")>("@/utils/files");
  return { ...actual, pickPgnFile: mocks.pickPgnFile };
});
vi.mock("@/utils/chess.com/api", () => ({ downloadChessCom: mocks.downloadChessCom }));
vi.mock("@/utils/lichess/api", () => ({ downloadLichess: vi.fn() }));
vi.mock("@mantine/notifications", () => ({ notifications: { show: mocks.notify } }));
vi.mock("react-i18next", () => {
  const t = (key: string) => key;
  return { useTranslation: () => ({ t }) };
});
vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => vi.fn(),
  Link: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock("../common/AppModal", () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock("../common/FileInput", () => ({
  default: ({ onClick, filename }: { onClick: () => void; filename: string | null }) => (
    <button type="button" onClick={onClick}>
      {filename || "pick-pgn"}
    </button>
  ),
}));
vi.mock("../common/ConfirmModal", () => ({ default: () => null }));
vi.mock("../common/GenericCard", () => ({
  default: ({
    id,
    setSelected,
    Header,
  }: {
    id: string;
    setSelected: (id: string) => void;
    Header: React.ReactNode;
  }) => (
    <button type="button" data-testid={`select-${id}`} onClick={() => setSelected(id)}>
      {Header}
    </button>
  ),
}));
vi.mock("../common/IconAction", () => ({
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
vi.mock("../common/ProgressButton", () => ({
  default: () => null,
}));
vi.mock("./PlayerSearchInput", () => ({
  PlayerSearchInput: ({
    label,
    setValue,
  }: {
    label: string;
    setValue: (value: number | undefined) => void;
  }) => (
    <button type="button" onClick={() => setValue(label === "Databases.Player.One" ? 1 : 2)}>
      {label}
    </button>
  ),
}));
vi.mock("@/components/home/LichessLogo", () => ({ default: () => null }));
vi.mock("@mantine/core", () => ({
  Alert: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Badge: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
  Box: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Button: ({
    children,
    loading,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement> & { loading?: boolean }) => (
    <button type="button" {...props} data-loading={loading ? "true" : undefined}>
      {children}
    </button>
  ),
  Card: Object.assign(({ children }: { children: React.ReactNode }) => <div>{children}</div>, {
    Section: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  }),
  Center: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Checkbox: ({
    label,
    ...props
  }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) => (
    <input type="checkbox" aria-label={label} {...props} />
  ),
  Divider: () => <hr />,
  Group: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
  Loader: () => null,
  Paper: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Progress: () => null,
  Rating: () => null,
  ScrollArea: Object.assign(
    ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    { Autosize: ({ children }: { children: React.ReactNode }) => <div>{children}</div> },
  ),
  SimpleGrid: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Skeleton: () => null,
  Stack: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Tabs: Object.assign(({ children }: { children: React.ReactNode }) => <div>{children}</div>, {
    List: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    Tab: ({ children }: { children: React.ReactNode }) => <button type="button">{children}</button>,
    Panel: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  }),
  Text: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
  Textarea: ({
    label,
    ...props
  }: { label?: string } & React.TextareaHTMLAttributes<HTMLTextAreaElement>) => (
    <label>
      {label}
      <textarea {...props} />
    </label>
  ),
  TextInput: ({
    label,
    ...props
  }: { label?: string } & React.InputHTMLAttributes<HTMLInputElement>) => (
    <label>
      {label}
      <input {...props} />
    </label>
  ),
  ThemeIcon: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Title: ({ children }: { children: React.ReactNode }) => <h1>{children}</h1>,
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock("@tabler/icons-react", () => ({
  IconAlertCircle: () => null,
  IconArrowDownRight: () => null,
  IconArrowRight: () => null,
  IconArrowUpRight: () => null,
  IconCircleCheckFilled: () => null,
  IconDatabase: () => null,
  IconDownload: () => null,
  IconPlus: () => null,
  IconRefresh: () => null,
  IconSearch: () => null,
  IconTrash: () => null,
}));

import DatabasesPage from "./DatabasesPage";
import { AccountCard } from "@/components/home/AccountCard";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

type ConvertProgress = {
  id: string;
  imported_games: number;
  elapsed_ms: number;
  source_file_name: string | null;
};

type ConvertCall = {
  args: unknown[];
  resolve: () => void;
  reject: (error: unknown) => void;
};

const store = getDefaultStore();
const handleA: DatabaseHandle = { id: { id: "new-import" }, kind: "database" };
const handleB: DatabaseHandle = { id: { id: "games-dest" }, kind: "database" };
const accountHandle: DatabaseHandle = { id: { id: "account-db" }, kind: "database" };
const workspaceRoot = { id: { id: "database-root" }, kind: "databaseRoot" as const };
const localPgn = { id: { id: "local-pgn" }, kind: "fileWorkspace" as const };
const addGamesPgn = { id: { id: "add-games-pgn" }, kind: "fileWorkspace" as const };

function successDatabase(file: DatabaseHandle, title: string): SuccessDatabaseInfo {
  return {
    type: "success",
    title,
    description: "",
    player_count: 2,
    event_count: 2,
    game_count: 1,
    // Native JSON represents this counter as a number.
    storage_size: 1 as unknown as bigint,
    filename: `${databaseHandleKey(file)}.db3`,
    indexed: true,
    file,
  };
}

function ConversionProbe() {
  useConversionProgress();
  const state = useAtomValue(databaseConversionStateAtom);
  return (
    <output
      data-in-progress={String(state.inProgress)}
      data-total={String(state.totalGames)}
      data-target={state.targetDatabase ? databaseHandleKey(state.targetDatabase) : "none"}
      data-source={state.sourceFileName ?? "none"}
    />
  );
}

let root: Root;
let host: HTMLDivElement;
let convertCalls: ConvertCall[];
let convertProgressListener: ((event: { payload: ConvertProgress }) => void) | undefined;

function conversionState() {
  return store.get(databaseConversionStateAtom);
}

function buttonByText(text: string) {
  return [...host.querySelectorAll("button")].find((button) => button.textContent === text);
}

async function emitConvertProgress(payload: ConvertProgress) {
  await act(async () => convertProgressListener?.({ payload }));
}

beforeEach(() => {
  vi.clearAllMocks();
  convertCalls = [];
  convertProgressListener = undefined;
  localStorage.clear();
  sessionStorage.clear();
  store.set(databaseConversionStateAtom, {
    inProgress: false,
    totalGames: 0,
    elapsedSeconds: 0,
    targetDatabase: null,
    targetDatabaseTitle: null,
    sourceFileName: null,
  });
  mocks.convertPgn.mockImplementation((...args: unknown[]) => {
    return new Promise<void>((resolve, reject) => {
      convertCalls.push({ args, resolve, reject });
    });
  });
  mocks.convertProgress.mockImplementation(
    async (listener: (event: { payload: ConvertProgress }) => void) => {
      convertProgressListener = listener;
      return () => undefined;
    },
  );
  mocks.progress.mockResolvedValue(() => undefined);
  mocks.getDatabases.mockResolvedValue([successDatabase(handleB, "Existing")]);
  mocks.getDatabaseWorkspace.mockResolvedValue(workspaceRoot);
  mocks.createWorkspaceDatabase.mockResolvedValue(handleA);
  mocks.listWorkspaceDatabases.mockResolvedValue([
    { handle: accountHandle, filename: "Felix_chesscom.db3", availability: "available" },
  ]);
  mocks.issuePgnWorkspace.mockResolvedValue({ handle: localPgn, displayName: "imported.pgn" });
  mocks.pickPgnFile.mockResolvedValue({ handle: addGamesPgn, name: "more.pgn" });
  mocks.editDbInfo.mockResolvedValue(undefined);
  mocks.issueDownloadDestination.mockResolvedValue({ id: "dest" });
  mocks.downloadChessCom.mockResolvedValue({
    id: { id: "account-pgn" },
    kind: "fileWorkspace",
  });
  mocks.startProgress.mockResolvedValue({ id: "chesscom_Felix", generation: 1n });
  mocks.setProgressState.mockResolvedValue(undefined);
  mocks.deleteEmptyGames.mockResolvedValue(undefined);
  mocks.deleteDuplicatedGames.mockResolvedValue(undefined);
  mocks.mergePlayers.mockResolvedValue(undefined);
  mocks.createIndexes.mockResolvedValue(undefined);
  mocks.deleteIndexes.mockResolvedValue(undefined);
  vi.spyOn(crypto, "randomUUID").mockReturnValue("00000000-0000-4000-8000-000000000001");
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  activeDatabaseViewStore.getState().clearDatabase();
  sessionStorage.clear();
});

async function renderRoute(account = false) {
  await act(async () => {
    root.render(
      <Provider store={store}>
        <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
          <ConversionProbe />
          <DatabasesPage />
          {account ? (
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
          ) : null}
        </SWRConfig>
      </Provider>,
    );
  });
}

async function startAddDatabase() {
  const pick = [...host.querySelectorAll("button")].find((button) =>
    button.textContent?.includes("pick-pgn"),
  )!;
  await act(async () => pick.click());
  const convert = buttonByText("Databases.Add.Convert")!;
  await act(async () => convert.click());
  await vi.waitFor(() => expect(convertCalls.length).toBeGreaterThanOrEqual(1));
}

test("the database overview ends the active database session on mount", async () => {
  activeDatabaseViewStore.getState().setDatabase(successDatabase(handleB, "Existing"));
  await renderRoute();
  expect(activeDatabaseViewStore.getState().database).toBeUndefined();
});

test("the database overview preserves a database set after mount", async () => {
  await renderRoute();
  const database = successDatabase(handleB, "Existing");
  await act(async () => activeDatabaseViewStore.getState().setDatabase(database));
  await renderRoute();
  expect(activeDatabaseViewStore.getState().database).toEqual(database);
});

async function selectExistingDatabase() {
  await act(async () => {
    (
      host.querySelector(
        `[data-testid='select-${databaseHandleKey(handleB)}']`,
      ) as HTMLButtonElement
    ).click();
  });
  await vi.waitFor(() => expect(buttonByText("Databases.Settings.AddGames")).toBeTruthy());
}

async function startAddGames() {
  const before = mocks.convertPgn.mock.calls.length;
  await act(async () => buttonByText("Databases.Settings.AddGames")!.click());
  await vi.waitFor(() => expect(mocks.convertPgn.mock.calls.length).toBe(before + 1));
}

async function startAccountDownload() {
  const before = mocks.convertPgn.mock.calls.length;
  const download = host.querySelector(
    'button[aria-label="Home.Accounts.DownloadGames"]',
  ) as HTMLButtonElement;
  await act(async () => download.click());
  await vi.waitFor(() => expect(mocks.convertPgn.mock.calls.length).toBe(before + 1));
}

test("submitting a local conversion disables Add before the workspace handle exists", async () => {
  let resolveCreate!: (handle: DatabaseHandle) => void;
  mocks.createWorkspaceDatabase.mockReturnValue(
    new Promise((resolve) => {
      resolveCreate = resolve;
    }),
  );
  await renderRoute();
  const pick = [...host.querySelectorAll("button")].find((button) =>
    button.textContent?.includes("pick-pgn"),
  )!;
  await act(async () => pick.click());
  await act(async () => buttonByText("Databases.Add.Convert")!.click());

  await vi.waitFor(() => {
    expect(conversionState().inProgress).toBe(true);
    expect(conversionState().targetDatabase).toBeNull();
  });
  expect(
    (host.querySelector('button[aria-label="Common.AddNew"]') as HTMLButtonElement).disabled,
  ).toBe(true);

  await act(async () => resolveCreate(handleA));
});

test("finishing AddDatabase does not wipe a later Add Games conversion or its progress", async () => {
  await renderRoute();
  await startAddDatabase();
  expect(mocks.convertPgn.mock.calls[0]?.[0]).toBe(conversionProgressId(handleA));
  expect(conversionState().targetDatabase).toEqual(handleA);
  expect(conversionState().inProgress).toBe(true);

  await selectExistingDatabase();
  await startAddGames();
  expect(mocks.convertPgn).toHaveBeenCalledWith(
    conversionProgressId(handleB),
    [addGamesPgn],
    handleB,
    null,
    "",
    null,
  );
  expect(conversionState().targetDatabase).toEqual(handleB);
  expect(conversionState().inProgress).toBe(true);

  await act(async () => convertCalls[0]!.resolve());
  await vi.waitFor(() => {
    expect(conversionState().targetDatabase).toEqual(handleB);
    expect(conversionState().inProgress).toBe(true);
  });

  await emitConvertProgress({
    id: conversionProgressId(handleB),
    imported_games: 42,
    elapsed_ms: 2000,
    source_file_name: "more.pgn",
  });
  expect(host.querySelector("output")?.getAttribute("data-total")).toBe("42");
  expect(host.querySelector("output")?.getAttribute("data-target")).toBe(
    databaseHandleKey(handleB),
  );
  expect(host.querySelector("output")?.getAttribute("data-in-progress")).toBe("true");
});

test("AccountCard convert() throw clears the conversion it owns", async () => {
  mocks.convertPgn.mockRejectedValue(new Error("convert failed"));
  await renderRoute(true);
  const download = host.querySelector(
    'button[aria-label="Home.Accounts.DownloadGames"]',
  ) as HTMLButtonElement;
  await act(async () => download.click());
  await vi.waitFor(() => expect(mocks.convertPgn).toHaveBeenCalled());
  await vi.waitFor(() => {
    expect(conversionState().inProgress).toBe(false);
    expect(conversionState().targetDatabase).toBeNull();
  });
  expect(mocks.notify).toHaveBeenCalledWith({
    color: "red",
    title: "Common.Error",
    message: "convert failed",
  });
});

test("AccountCard convert() throw does not wipe a concurrent Add Games conversion", async () => {
  await renderRoute(true);
  await selectExistingDatabase();
  await startAccountDownload();
  expect(conversionState().targetDatabase).toEqual(accountHandle);

  await startAddGames();
  expect(conversionState().targetDatabase).toEqual(handleB);
  expect(conversionState().inProgress).toBe(true);

  const accountCall = convertCalls.find(
    (call) => call.args[0] === conversionProgressId(accountHandle),
  )!;
  await act(async () => accountCall.reject(new Error("convert failed")));
  await vi.waitFor(() => {
    expect(conversionState().targetDatabase).toEqual(handleB);
    expect(conversionState().inProgress).toBe(true);
  });
});

async function waitForSettingsDebounce() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 350));
  });
}

async function editDatabaseSetting(
  labelText: string,
  elementType: "input" | "textarea",
  value: string,
) {
  const label = [...host.querySelectorAll("label")]
    .filter((element) => element.textContent === labelText)
    .at(-1)!;
  const input = label.querySelector(elementType)!;
  const prototype =
    elementType === "input" ? HTMLInputElement.prototype : HTMLTextAreaElement.prototype;
  await act(async () => {
    Object.getOwnPropertyDescriptor(prototype, "value")!.set!.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  expect(input.value).toBe(value);
}

test("selecting an existing database does not write its settings", async () => {
  await renderRoute();
  await selectExistingDatabase();
  await waitForSettingsDebounce();
  expect(mocks.editDbInfo).not.toHaveBeenCalled();
});

test("editing the database name writes once after the debounce and reloads the list", async () => {
  let database = successDatabase(handleB, "Existing");
  mocks.getDatabases.mockImplementation(async () => [database]);
  mocks.editDbInfo.mockImplementation(async (_file: DatabaseHandle, title: string) => {
    database = { ...database, title };
  });
  await renderRoute();
  await selectExistingDatabase();
  await editDatabaseSetting("Common.Name", "input", "Renamed");
  expect(mocks.editDbInfo).not.toHaveBeenCalled();

  await waitForSettingsDebounce();
  expect(mocks.editDbInfo).toHaveBeenCalledExactlyOnceWith(handleB, "Renamed", "");
  expect(mocks.getDatabases).toHaveBeenCalledTimes(2);
});

test("editing only the database description writes once after the debounce with the unchanged title", async () => {
  let database = successDatabase(handleB, "Existing");
  mocks.getDatabases.mockImplementation(async () => [database]);
  mocks.editDbInfo.mockImplementation(
    async (_file: DatabaseHandle, _title: string, description: string) => {
      database = { ...database, description };
    },
  );
  await renderRoute();
  await selectExistingDatabase();
  await editDatabaseSetting("Common.Description", "textarea", "Updated description");
  expect(mocks.editDbInfo).not.toHaveBeenCalled();

  await waitForSettingsDebounce();
  expect(mocks.editDbInfo).toHaveBeenCalledExactlyOnceWith(
    handleB,
    "Existing",
    "Updated description",
  );
  expect(mocks.getDatabases).toHaveBeenCalledTimes(2);
});

test("clearing the database name does not write an empty title", async () => {
  await renderRoute();
  await selectExistingDatabase();
  await editDatabaseSetting("Common.Name", "input", "");
  await waitForSettingsDebounce();
  expect(mocks.editDbInfo).not.toHaveBeenCalled();
});

test("a failed database rename surfaces an error notification", async () => {
  await renderRoute();
  await selectExistingDatabase();
  mocks.editDbInfo.mockRejectedValueOnce(new Error("rename failed"));
  await editDatabaseSetting("Common.Name", "input", "Renamed");
  await waitForSettingsDebounce();
  expect(mocks.notify).toHaveBeenCalledExactlyOnceWith({
    color: "red",
    title: "Common.Error",
    message: "rename failed",
  });
});

test.each(
  (
    [
      ["Databases.Settings.RemoveEmpty", mocks.deleteEmptyGames],
      ["Databases.Settings.RemoveDup", mocks.deleteDuplicatedGames],
    ] as const
  ).flatMap(([label, action]) =>
    (["successful", "failed"] as const).map((outcome) => ({ label, action, outcome })),
  ),
)(
  "a $outcome $label cleanup reloads the list and reports only errors",
  async ({ label, action, outcome }) => {
    let resolveCleanup!: () => void;
    let rejectCleanup!: (error: unknown) => void;
    action.mockReturnValueOnce(
      new Promise<void>((resolve, reject) => {
        resolveCleanup = resolve;
        rejectCleanup = reject;
      }),
    );
    await renderRoute();
    await selectExistingDatabase();
    const reloads = mocks.getDatabases.mock.calls.length;
    const button = buttonByText(label)!;
    await act(async () => button.click());
    expect(action).toHaveBeenCalledExactlyOnceWith(handleB);
    expect(button.getAttribute("data-loading")).toBe("true");
    if (outcome === "failed") {
      await act(async () => rejectCleanup(new Error("cleanup failed")));
    } else {
      await act(async () => resolveCleanup());
    }
    expect(buttonByText(label)?.getAttribute("data-loading")).toBeNull();
    expect(mocks.notify.mock.calls).toEqual(
      outcome === "failed"
        ? [[{ color: "red", title: "Common.Error", message: "cleanup failed" }]]
        : [],
    );
    expect(mocks.getDatabases).toHaveBeenCalledTimes(reloads + 1);
  },
);

test("a failed player merge surfaces an error notification", async () => {
  await renderRoute();
  await selectExistingDatabase();
  await act(async () => {
    buttonByText("Databases.Player.One")!.click();
    buttonByText("Databases.Player.Two")!.click();
  });
  mocks.mergePlayers.mockRejectedValueOnce(new Error("merge failed"));
  await act(async () => buttonByText("Databases.Settings.Merge")!.click());

  expect(mocks.mergePlayers).toHaveBeenCalledExactlyOnceWith(handleB, 1, 2);
  expect(mocks.notify).toHaveBeenCalledExactlyOnceWith({
    color: "red",
    title: "Common.Error",
    message: "merge failed",
  });
});

function indexCheckbox() {
  return host.querySelector<HTMLInputElement>('[aria-label="Databases.Settings.Indexed"]')!;
}

test.each([
  { outcome: "failed", indexed: false },
  { outcome: "successful", indexed: false },
  { outcome: "successful", indexed: true },
] as const)(
  "a $outcome index toggle from indexed=$indexed re-enables the checkbox",
  async ({ outcome, indexed }) => {
    const database = { ...successDatabase(handleB, "Existing"), indexed };
    mocks.getDatabases.mockResolvedValue([database]);
    const action = indexed ? mocks.deleteIndexes : mocks.createIndexes;
    const otherAction = indexed ? mocks.createIndexes : mocks.deleteIndexes;
    let resolveIndex!: () => void;
    let rejectIndex!: (error: unknown) => void;
    action.mockReturnValueOnce(
      new Promise<void>((resolve, reject) => {
        resolveIndex = resolve;
        rejectIndex = reject;
      }),
    );
    await renderRoute();
    await selectExistingDatabase();
    const reloads = mocks.getDatabases.mock.calls.length;
    const checkbox = indexCheckbox();
    expect(checkbox.checked).toBe(indexed);
    expect(checkbox.disabled).toBe(false);
    await act(async () => checkbox.click());
    expect(action).toHaveBeenCalledExactlyOnceWith(handleB);
    expect(otherAction).not.toHaveBeenCalled();
    expect(checkbox.disabled).toBe(true);
    expect(mocks.getDatabases).toHaveBeenCalledTimes(reloads);

    if (outcome === "failed") {
      await act(async () => rejectIndex(new Error("index failed")));
    } else {
      mocks.getDatabases.mockResolvedValue([{ ...database, indexed: !indexed }]);
      await act(async () => resolveIndex());
    }
    expect(mocks.getDatabases).toHaveBeenCalledTimes(reloads + (outcome === "failed" ? 0 : 1));
    const reloadOptions = { signal: expect.any(AbortSignal) };
    expect(mocks.getDatabases.mock.calls.slice(reloads)).toEqual(
      outcome === "failed" ? [] : [[reloadOptions]],
    );
    expect(indexCheckbox().checked).toBe(outcome === "failed" ? indexed : !indexed);
    expect(mocks.notify.mock.calls).toEqual(
      outcome === "failed"
        ? [[{ color: "red", title: "Common.Error", message: "index failed" }]]
        : [],
    );
    expect(indexCheckbox().disabled).toBe(false);
  },
);
