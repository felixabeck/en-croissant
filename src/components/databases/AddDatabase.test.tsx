import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { defaultDatabaseProgressId } from "@/utils/db";

const mocks = vi.hoisted(() => ({
  getDatabaseWorkspace: vi.fn(),
  createWorkspaceDatabase: vi.fn(),
  listWorkspaceDatabases: vi.fn(),
  convertPgn: vi.fn(),
  issuePgnWorkspace: vi.fn(),
  databaseDownloadDestination: vi.fn(),
  downloadFile: vi.fn(),
  getDatabases: vi.fn(),
  notify: vi.fn(),
  defaultDatabases: [] as Array<{
    title: string;
    description: string;
    player_count: number;
    game_count: number;
    storage_size: number;
    downloadLink: string;
    sha256: string;
    signature: string;
  }>,
  progressButtonProps: null as null | {
    id: string;
    initInstalled: boolean;
    onClick: () => void;
  },
}));

vi.mock("@/platform/tauri", () => ({ tauri: mocks }));
vi.mock("@/utils/db", async () => {
  const actual = await vi.importActual<typeof import("@/utils/db")>("@/utils/db");
  return {
    ...actual,
    getDatabases: mocks.getDatabases,
    useDefaultDatabases: () => ({
      defaultDatabases: mocks.defaultDatabases,
      error: undefined,
      isLoading: false,
    }),
  };
});
vi.mock("@mantine/notifications", () => ({ notifications: { show: mocks.notify } }));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("jotai", async (importOriginal) => ({
  ...(await importOriginal<typeof import("jotai")>()),
  useSetAtom: () => vi.fn(),
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
vi.mock("../common/ProgressButton", () => ({
  default: (props: { id: string; initInstalled: boolean; onClick: () => void }) => {
    mocks.progressButtonProps = props;
    return (
      <button type="button" onClick={props.onClick}>
        progress
      </button>
    );
  },
}));
vi.mock("@mantine/core", () => ({
  Alert: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Box: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button type="button" {...props}>
      {children}
    </button>
  ),
  Center: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Divider: () => <hr />,
  Group: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Loader: () => null,
  Paper: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  ScrollArea: { Autosize: ({ children }: { children: React.ReactNode }) => <div>{children}</div> },
  SimpleGrid: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Stack: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Tabs: Object.assign(({ children }: { children: React.ReactNode }) => <div>{children}</div>, {
    List: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    Tab: ({ children }: { children: React.ReactNode }) => <button type="button">{children}</button>,
    Panel: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  }),
  Text: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
  TextInput: ({
    label,
    ...props
  }: { label?: string } & React.InputHTMLAttributes<HTMLInputElement>) => (
    <label>
      {label}
      <input {...props} />
    </label>
  ),
}));
vi.mock("@tabler/icons-react", () => ({ IconAlertCircle: () => null }));

import { convertLocalDatabaseWithLoading } from "./AddDatabase";
import AddDatabase from "./AddDatabase";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const manifestDb = {
  title: "Lichess",
  description: "Games",
  player_count: 1,
  game_count: 2,
  storage_size: 3,
  downloadLink: "https://db.encroissant.org/lichess.db3",
  sha256: "a".repeat(64),
  signature: "sig",
};

let root: Root;
let host: HTMLDivElement;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.defaultDatabases = [];
  mocks.progressButtonProps = null;
  vi.spyOn(crypto, "randomUUID").mockReturnValue("00000000-0000-4000-8000-000000000001");
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});

async function renderAddDatabase(databases: Array<{ type: "success"; title: string }> = []) {
  await act(async () => {
    root.render(
      <AddDatabase
        databases={databases as never}
        opened
        setOpened={() => undefined}
        setLoading={() => undefined}
        disableLocalConversion={false}
        setDatabases={vi.fn()}
      />,
    );
  });
}

test("continues conversion with a handle recovered after an uncertain create", async () => {
  const root = { id: { id: "database-root" }, kind: "databaseRoot" };
  const handle = { id: { id: "database" }, kind: "database" };
  const source = { id: { id: "source" }, kind: "fileWorkspace" } as const;
  mocks.getDatabaseWorkspace.mockResolvedValue(root);
  mocks.createWorkspaceDatabase.mockRejectedValue(
    new Error("Committed but durability uncertain: registry replacement"),
  );
  mocks.listWorkspaceDatabases.mockResolvedValue([
    {
      handle,
      filename: "00000000-0000-4000-8000-000000000001.db3",
      availability: "available",
    },
  ]);
  mocks.convertPgn.mockResolvedValue(undefined);
  const onCreated = vi.fn();
  const loading: boolean[] = [];

  await expect(
    convertLocalDatabaseWithLoading([source], "Imported", "notes", onCreated, (value) =>
      loading.push(value as boolean),
    ),
  ).resolves.toBe(handle);
  expect(loading).toEqual([true, false]);
  expect(onCreated).toHaveBeenCalledWith(handle);
  expect(mocks.convertPgn).toHaveBeenCalledWith([source], handle, null, "Imported", "notes");
});

test("wires installed state and progress id from the download URL", async () => {
  mocks.defaultDatabases = [manifestDb];
  await renderAddDatabase([{ type: "success", title: "Lichess" }]);
  expect(mocks.progressButtonProps?.id).toBe(defaultDatabaseProgressId(manifestDb.downloadLink));
  expect(mocks.progressButtonProps?.id).not.toBe("db_0");
  expect(mocks.progressButtonProps?.initInstalled).toBe(true);
});

test("keeps the PGN picker silent on Cancellation and notifies a real failure", async () => {
  await renderAddDatabase();
  const pick = [...host.querySelectorAll("button")].find((button) =>
    button.textContent?.includes("pick-pgn"),
  )!;

  mocks.issuePgnWorkspace.mockRejectedValueOnce(new Error("Cancellation"));
  await act(async () => pick.click());
  expect(mocks.notify).not.toHaveBeenCalled();

  mocks.issuePgnWorkspace.mockRejectedValueOnce(new Error("permission denied"));
  await act(async () => pick.click());
  expect(mocks.notify).toHaveBeenCalledWith({
    color: "red",
    title: "Common.Error",
    message: "permission denied",
  });
});

test("commits a selected PGN workspace into the form", async () => {
  await renderAddDatabase();
  mocks.issuePgnWorkspace.mockResolvedValue({
    handle: { id: { id: "pgn" }, kind: "fileWorkspace" },
    displayName: "games.pgn",
  });
  const pick = [...host.querySelectorAll("button")].find((button) =>
    button.textContent?.includes("pick-pgn"),
  )!;
  await act(async () => pick.click());
  expect(host.textContent).toContain("games.pgn");
  expect(mocks.notify).not.toHaveBeenCalled();
});
