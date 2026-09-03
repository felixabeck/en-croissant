import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { defaultPuzzleDatabaseProgressId } from "@/utils/db";
import AddPuzzle from "./AddPuzzle";

const mocks = vi.hoisted(() => ({
  choosePuzzleDatabase: vi.fn(),
  getPuzzleDatabases: vi.fn(),
  notify: vi.fn(),
  defaultDatabases: undefined as unknown,
  issueDownloadDestination: vi.fn(),
  downloadFile: vi.fn(),
  progressButtonProps: null as null | {
    id: string;
    initInstalled: boolean;
    onClick: () => void;
  },
}));

vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("swr/immutable", () => ({
  default: () => ({ data: mocks.defaultDatabases, error: undefined }),
}));
vi.mock("@mantine/notifications", () => ({ notifications: { show: mocks.notify } }));
vi.mock("@/utils/puzzles", () => ({
  choosePuzzleDatabase: mocks.choosePuzzleDatabase,
  getPuzzleDatabases: mocks.getPuzzleDatabases,
}));
vi.mock("@/platform/errors", () => ({
  normalizeError: () => ({ category: "unexpected", message: "Safe error" }),
  errorUnlessCancelled: (error: unknown) =>
    error instanceof Error && error.message === "Cancellation"
      ? null
      : { category: "unexpected", message: "Safe error" },
}));
vi.mock("@/platform/tauri", () => ({
  tauri: {
    issuePuzzleDownloadDestination: mocks.issueDownloadDestination,
    downloadFile: mocks.downloadFile,
  },
}));
vi.mock("@/utils/db", async () => {
  const actual = await vi.importActual<typeof import("@/utils/db")>("@/utils/db");
  return {
    ...actual,
    getDefaultPuzzleDatabases: vi.fn(),
  };
});
vi.mock("@/utils/format", () => ({
  formatBytes: (value: number) => `${value} B`,
  formatNumber: String,
}));
vi.mock("@mantine/core", () => ({
  Button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
  ScrollArea: { Autosize: ({ children }: any) => <div>{children}</div> },
  Stack: ({ children }: any) => <div>{children}</div>,
  Alert: ({ children }: any) => <div>{children}</div>,
  Box: ({ children }: any) => <div>{children}</div>,
  Divider: () => <hr />,
  Group: ({ children }: any) => <div>{children}</div>,
  Paper: ({ children }: any) => <div>{children}</div>,
  Text: ({ children }: any) => <span>{children}</span>,
}));
vi.mock("../common/AppModal", () => ({
  default: ({ children, opened }: any) => (opened ? <div>{children}</div> : null),
}));
vi.mock("../common/ProgressButton", () => ({
  default: (props: {
    id: string;
    initInstalled: boolean;
    onClick: () => void;
    labels: { action: string };
  }) => {
    mocks.progressButtonProps = props;
    return (
      <button type="button" onClick={props.onClick}>
        {props.labels.action}
      </button>
    );
  },
}));

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const tacticsManifest = {
  title: "Lichess",
  description: "Tactics",
  storageSize: 42,
  puzzleCount: 3,
  downloadLink: "https://example.test/tactics.db3",
  sha256: "a".repeat(64),
  signature: "signature",
};

let root: Root;
let host: HTMLDivElement;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.defaultDatabases = undefined;
  mocks.progressButtonProps = null;
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});

afterEach(() => {
  root.unmount();
  host.remove();
});

async function render() {
  const setOpened = vi.fn();
  const setPuzzleDbs = vi.fn();
  const onWorkspaceChanged = vi.fn();
  await act(async () =>
    root.render(
      <AddPuzzle
        opened
        setOpened={setOpened}
        puzzleDbs={[]}
        setPuzzleDbs={setPuzzleDbs}
        onWorkspaceChanged={onWorkspaceChanged}
      />,
    ),
  );
  return { setOpened, setPuzzleDbs, onWorkspaceChanged };
}

test("refreshes puzzle databases and closes after choosing a workspace", async () => {
  mocks.choosePuzzleDatabase.mockResolvedValue(undefined);
  mocks.getPuzzleDatabases.mockResolvedValue([{ title: "Tactics.db3" }]);
  const actions = await render();
  await act(async () => host.querySelector("button")!.click());
  expect(mocks.choosePuzzleDatabase).toHaveBeenCalledOnce();
  expect(actions.onWorkspaceChanged).toHaveBeenCalledOnce();
  expect(actions.setPuzzleDbs).toHaveBeenCalledWith([{ title: "Tactics.db3" }]);
  expect(actions.setOpened).toHaveBeenCalledWith(false);
  expect(mocks.notify).not.toHaveBeenCalled();
});

test("keeps the modal open and shows a normalized non-cancelled picker failure", async () => {
  mocks.choosePuzzleDatabase.mockRejectedValue(new Error("native failure"));
  const actions = await render();
  await act(async () => host.querySelector("button")!.click());
  expect(actions.onWorkspaceChanged).not.toHaveBeenCalled();
  expect(actions.setOpened).not.toHaveBeenCalled();
  expect(mocks.notify).toHaveBeenCalledWith({
    color: "red",
    title: "Common.Error",
    message: "Safe error",
  });
});

test("keeps the modal open silently when choosing a workspace is cancelled", async () => {
  mocks.choosePuzzleDatabase.mockRejectedValue(new Error("Cancellation"));
  const actions = await render();
  await act(async () => host.querySelector("button")!.click());
  expect(actions.setOpened).not.toHaveBeenCalled();
  expect(mocks.notify).not.toHaveBeenCalled();
});

test("wires progress id from the download URL, not the manifest index", async () => {
  mocks.defaultDatabases = [tacticsManifest];
  await render();
  expect(mocks.progressButtonProps?.id).toBe(
    defaultPuzzleDatabaseProgressId("https://example.test/tactics.db3"),
  );
  expect(mocks.progressButtonProps?.id).not.toBe("puzzle_db_0");
});

test("keeps a cancelled download destination silent", async () => {
  mocks.defaultDatabases = [tacticsManifest];
  mocks.issueDownloadDestination.mockRejectedValue(new Error("Cancellation"));
  const actions = await render();
  await act(async () => host.querySelectorAll("button")[1].click());
  expect(actions.setPuzzleDbs).not.toHaveBeenCalled();
  expect(mocks.notify).not.toHaveBeenCalled();
});

test("installs a downloaded database and refreshes the visible collection", async () => {
  mocks.defaultDatabases = [tacticsManifest];
  mocks.issueDownloadDestination.mockResolvedValue({ id: { id: "destination" }, kind: "path" });
  mocks.downloadFile.mockResolvedValue(undefined);
  mocks.getPuzzleDatabases.mockResolvedValue([{ title: "Lichess.db3" }]);
  const actions = await render();
  await act(async () => host.querySelectorAll("button")[1].click());
  expect(mocks.downloadFile).toHaveBeenCalledOnce();
  expect(mocks.downloadFile).toHaveBeenCalledWith(
    defaultPuzzleDatabaseProgressId("https://example.test/tactics.db3"),
    tacticsManifest.downloadLink,
    { id: { id: "destination" }, kind: "path" },
    "Lichess.db3",
    null,
    expect.any(String),
    { sha256: tacticsManifest.sha256, signature: tacticsManifest.signature },
  );
  expect(actions.setPuzzleDbs).toHaveBeenCalledWith([{ title: "Lichess.db3" }]);
  expect(mocks.notify).not.toHaveBeenCalled();
});

test("reports a failed download without replacing the installed database list", async () => {
  mocks.defaultDatabases = [tacticsManifest];
  mocks.issueDownloadDestination.mockRejectedValue(new Error("native failure"));
  const actions = await render();
  await act(async () => host.querySelectorAll("button")[1].click());
  expect(actions.setPuzzleDbs).not.toHaveBeenCalled();
  expect(mocks.notify).toHaveBeenCalledWith({
    color: "red",
    title: "Common.Error",
    message: "Safe error",
  });
});
