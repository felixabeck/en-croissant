import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { tabStorage } from "@/state/store/tabStorage";
import { defaultTree } from "@/utils/treeReducer";

const fixtures = vi.hoisted(() => ({
  atoms: {
    currentTab: Symbol("current-tab"),
    addRecentFile: Symbol("add-recent-file"),
  },
  currentTab: {
    value: "import-tab",
    name: "New tab",
    type: "new",
    gameOrigin: { kind: "none" },
  },
  file: {
    type: "file",
    handle: { id: { id: "selected-pgn" }, kind: "fileWorkspace" },
    name: "selected.pgn",
    numGames: 2,
    metadata: { type: "game", tags: [] },
    lastModified: 1,
  },
  createFile: vi.fn(),
  ensureFileWorkspace: vi.fn(),
  loadFileGame: vi.fn(),
  pickPgnFile: vi.fn(),
  readGames: vi.fn(),
  setCurrentTab: vi.fn(),
  setTabs: vi.fn(),
  storeSet: vi.fn(),
}));

vi.mock("@/state/atoms", () => ({
  addRecentFileAtom: fixtures.atoms.addRecentFile,
  currentTabAtom: fixtures.atoms.currentTab,
}));
vi.mock("jotai", () => ({
  useAtom: (atom: symbol) =>
    atom === fixtures.atoms.currentTab
      ? [fixtures.currentTab, fixtures.setCurrentTab]
      : [null, vi.fn()],
  useStore: () => ({ set: fixtures.storeSet }),
}));
vi.mock("@/platform/tauri", () => ({
  tauri: { readGames: fixtures.readGames },
}));
vi.mock("@/utils/files", () => ({
  createFile: fixtures.createFile,
  ensureFileWorkspace: fixtures.ensureFileWorkspace,
  loadFileGame: fixtures.loadFileGame,
  openFile: vi.fn(),
  pickPgnFile: fixtures.pickPgnFile,
}));
vi.mock("@/components/files/notifyError", () => ({
  runUnlessCancelled: async (_title: string, action: () => Promise<void>) => action(),
}));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("../common/AppModal", () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock("../common/GenericCard", () => ({
  default: ({ Header }: { Header: React.ReactNode }) => <div>{Header}</div>,
}));
vi.mock("@mantine/core", () => ({
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props}>{children}</button>
  ),
  Checkbox: ({
    checked,
    onChange,
  }: {
    checked: boolean;
    onChange: React.ChangeEventHandler<HTMLInputElement>;
  }) => (
    <input type="checkbox" data-testid="save-to-collection" checked={checked} onChange={onChange} />
  ),
  Divider: () => <hr />,
  FileInput: ({ onClick }: { onClick: () => void }) => (
    <button type="button" data-testid="choose-file" onClick={onClick}>
      Choose file
    </button>
  ),
  Group: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SimpleGrid: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Stack: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Text: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
  Textarea: () => null,
  TextInput: () => null,
}));

import ImportModal from "./ImportModal";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  sessionStorage.clear();
  vi.clearAllMocks();
  fixtures.currentTab = {
    value: "import-tab",
    name: "New tab",
    type: "new",
    gameOrigin: { kind: "none" },
  };
  fixtures.setCurrentTab.mockImplementation(
    (update: (previous: typeof fixtures.currentTab) => typeof fixtures.currentTab) => {
      fixtures.currentTab = update(fixtures.currentTab);
    },
  );
  fixtures.pickPgnFile.mockResolvedValue(fixtures.file);
  fixtures.readGames.mockResolvedValue([
    {
      pgn: '[Event "Old preview"]\n\n1. e4 *',
      stamp: "preview-stamp",
      revision: "preview-revision",
      present: true,
    },
    {
      pgn: '[Event "Second PGN"]\n\n1. d4 *',
      stamp: "second-stamp",
      revision: "preview-revision",
      present: true,
    },
  ]);
  fixtures.loadFileGame.mockImplementation(async () => {
    const tree = defaultTree();
    tree.headers.event = "Fresh from disk";
    tree.sourceStamp = "f".repeat(64);
    return {
      pgn: '[Event "Fresh from disk"]\n\n1. d4 *',
      stamp: tree.sourceStamp,
      revision: "r-fresh",
      present: true,
      tree,
    };
  });
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});

test("file import seeds a file-backed tab from the fresh game and its stamp", async () => {
  const seed = vi.spyOn(tabStorage, "seed");
  const setOpenModal = vi.fn();
  await act(async () =>
    root.render(<ImportModal openModal setOpenModal={setOpenModal} setTabs={fixtures.setTabs} />),
  );

  await act(async () => {
    host.querySelector<HTMLButtonElement>('[data-testid="choose-file"]')!.click();
    await Promise.resolve();
  });
  await vi.waitFor(() => expect(fixtures.pickPgnFile).toHaveBeenCalledOnce());
  await vi.waitFor(() => {
    expect(
      Array.from(host.querySelectorAll("button")).find(
        (button) => button.textContent === "Home.Card.ImportGame.Button",
      )?.disabled,
    ).toBe(false);
  });
  await act(async () => {
    Array.from(host.querySelectorAll("button"))
      .find((button) => button.textContent === "Home.Card.ImportGame.Button")!
      .click();
  });

  expect(fixtures.loadFileGame).toHaveBeenCalledWith(fixtures.file.handle, 0);
  expect(fixtures.readGames).toHaveBeenCalledWith(fixtures.file.handle, 0, 1);
  expect(fixtures.currentTab).toMatchObject({
    name: "Fresh from disk",
    type: "analysis",
    gameOrigin: { kind: "file", gameNumber: 0, file: { handle: fixtures.file.handle } },
  });
  expect(seed).toHaveBeenCalledWith(
    "import-tab",
    expect.objectContaining({
      sourceStamp: "f".repeat(64),
      headers: expect.objectContaining({ event: "Fresh from disk" }),
    }),
  );
  expect(fixtures.storeSet).toHaveBeenCalledWith(
    fixtures.atoms.addRecentFile,
    expect.objectContaining({ handle: fixtures.file.handle }),
  );
});

test("saving an imported PGN joins the text from stamped page rows", async () => {
  const workspace = { id: { id: "workspace" }, kind: "fileWorkspace" } as const;
  const savedFile = {
    ...fixtures.file,
    handle: { id: { id: "saved-pgn" }, kind: "fileWorkspace" },
  };
  fixtures.ensureFileWorkspace.mockResolvedValue(workspace);
  fixtures.createFile.mockResolvedValue({ isErr: false, value: savedFile });
  await act(async () =>
    root.render(<ImportModal openModal setOpenModal={vi.fn()} setTabs={fixtures.setTabs} />),
  );

  await act(async () => {
    host.querySelector<HTMLButtonElement>('[data-testid="choose-file"]')!.click();
    await Promise.resolve();
  });
  await vi.waitFor(() => expect(fixtures.pickPgnFile).toHaveBeenCalledOnce());
  await act(async () => {
    host.querySelector<HTMLInputElement>('[data-testid="save-to-collection"]')!.click();
  });
  await act(async () => {
    Array.from(host.querySelectorAll("button"))
      .find((button) => button.textContent === "Home.Card.ImportGame.Button")!
      .click();
  });

  expect(fixtures.createFile).toHaveBeenCalledWith({
    filename: "selected.pgn",
    filetype: "game",
    pgn: '[Event "Old preview"]\n\n1. e4 *\n\n[Event "Second PGN"]\n\n1. d4 *',
    workspace,
    parent: workspace,
  });
  expect(fixtures.loadFileGame).toHaveBeenCalledWith(savedFile.handle, 0);
  expect(fixtures.currentTab).toMatchObject({
    gameOrigin: { kind: "file", file: { handle: savedFile.handle }, gameNumber: 0 },
  });
});
