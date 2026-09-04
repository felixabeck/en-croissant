import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { SWRConfig } from "swr";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { getDefaultStore, Provider, useAtomValue } from "jotai";
import type { DatabaseHandle } from "@/bindings";
import { databaseConversionStateAtom } from "@/state/atoms";
import { conversionProgressId, databaseHandleKey, type ManagedDatabaseInfo } from "@/utils/db";
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
      mergePlayers: vi.fn(),
      deleteDuplicatedGames: vi.fn(),
      createIndexes: vi.fn(),
      deleteIndexes: vi.fn(),
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
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => vi.fn(),
  Link: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock("@mantine/hooks", () => ({
  useDebouncedValue: (value: unknown) => [value],
  useToggle: () => [false, vi.fn()],
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
vi.mock("./PlayerSearchInput", () => ({ PlayerSearchInput: () => null }));
vi.mock("@/components/home/LichessLogo", () => ({ default: () => null }));
vi.mock("@mantine/core", () => ({
  Alert: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Badge: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
  Box: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button type="button" {...props}>
      {children}
    </button>
  ),
  Card: Object.assign(({ children }: { children: React.ReactNode }) => <div>{children}</div>, {
    Section: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  }),
  Center: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Checkbox: () => null,
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
  Textarea: () => null,
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

function successDatabase(file: DatabaseHandle, title: string): ManagedDatabaseInfo {
  return {
    type: "success",
    title,
    description: "",
    player_count: 2,
    event_count: 2,
    game_count: 1,
    storage_size: 1n,
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
      data-target={state.targetDatabasePath ? databaseHandleKey(state.targetDatabasePath) : "none"}
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
    targetDatabasePath: null,
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
  vi.spyOn(crypto, "randomUUID").mockReturnValue("00000000-0000-4000-8000-000000000001");
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
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
    expect(conversionState().targetDatabasePath).toBeNull();
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
  expect(conversionState().targetDatabasePath).toEqual(handleA);
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
  expect(conversionState().targetDatabasePath).toEqual(handleB);
  expect(conversionState().inProgress).toBe(true);

  await act(async () => convertCalls[0]!.resolve());
  await vi.waitFor(() => {
    expect(conversionState().targetDatabasePath).toEqual(handleB);
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
    expect(conversionState().targetDatabasePath).toBeNull();
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
  expect(conversionState().targetDatabasePath).toEqual(accountHandle);

  await startAddGames();
  expect(conversionState().targetDatabasePath).toEqual(handleB);
  expect(conversionState().inProgress).toBe(true);

  const accountCall = convertCalls.find(
    (call) => call.args[0] === conversionProgressId(accountHandle),
  )!;
  await act(async () => accountCall.reject(new Error("convert failed")));
  await vi.waitFor(() => {
    expect(conversionState().targetDatabasePath).toEqual(handleB);
    expect(conversionState().inProgress).toBe(true);
  });
});
