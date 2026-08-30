import { act, type ComponentType } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  mutate: vi.fn(),
  listFileWorkspace: vi.fn(),
  trashWorkspaceEntry: vi.fn(),
  restoreWorkspaceEntry: vi.fn(),
  permanentlyDeleteWorkspaceEntry: vi.fn(),
  moveWorkspaceEntry: vi.fn(),
  issueFileWorkspace: vi.fn(),
  setWorkspace: vi.fn(),
  setWorkspaceDisplayName: vi.fn(),
  data: [] as Array<unknown>,
}));
const stateAtoms = vi.hoisted(() => ({ fileWorkspaceAtom: {}, fileWorkspaceDisplayNameAtom: {} }));

vi.mock("@/platform/tauri", () => ({
  tauri: {
    listFileWorkspace: mocks.listFileWorkspace,
    trashWorkspaceEntry: mocks.trashWorkspaceEntry,
    restoreWorkspaceEntry: mocks.restoreWorkspaceEntry,
    permanentlyDeleteWorkspaceEntry: mocks.permanentlyDeleteWorkspaceEntry,
    moveWorkspaceEntry: mocks.moveWorkspaceEntry,
    issueFileWorkspace: mocks.issueFileWorkspace,
  },
}));
vi.mock("jotai", () => ({
  useAtom: (atom: object) =>
    atom === stateAtoms.fileWorkspaceAtom
      ? [workspace, mocks.setWorkspace]
      : ["", mocks.setWorkspaceDisplayName],
}));
vi.mock("@/state/atoms", () => stateAtoms);
vi.mock("swr", () => ({ default: () => ({ data: mocks.data, mutate: mocks.mutate }) }));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string; name?: string }) =>
      options?.defaultValue?.replace("{{name}}", options.name || "") || key,
  }),
}));
vi.mock("@mantine/core", () => ({
  Button: ({
    children,
    loading,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement> & { loading?: boolean }) => (
    <button {...props} disabled={props.disabled || loading}>
      {children}
    </button>
  ),
  Center: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Group: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Modal: ({
    opened,
    title,
    children,
  }: {
    opened: boolean;
    title: string;
    children: React.ReactNode;
  }) =>
    opened ? (
      <div role="dialog" aria-label={title}>
        {children}
      </div>
    ) : null,
  Paper: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Select: () => null,
  Stack: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Text: ({ children, ...props }: React.HTMLAttributes<HTMLParagraphElement>) => (
    <p {...props}>{children}</p>
  ),
  TextInput: () => null,
  Title: ({ children }: { children: React.ReactNode }) => <h1>{children}</h1>,
}));
vi.mock("./DirectoryTree", () => ({
  default: ({
    files,
    setSelectedFile,
    selectedFile,
    onRequestMove,
    onMove,
  }: {
    files: Array<unknown>;
    setSelectedFile: (entry: unknown) => void;
    selectedFile: { name?: string } | null;
    onRequestMove?: (entry: unknown) => void;
    onMove?: (entry: unknown, destination: unknown) => Promise<void> | void;
  }) => (
    <>
      <output>{selectedFile?.name || "No selection"}</output>
      <button type="button" onClick={() => setSelectedFile(files[0])}>
        Select sample file
      </button>
      <button type="button" onClick={() => onRequestMove?.(files[0])}>
        Context Move
      </button>
      <button type="button" onClick={() => onRequestMove?.(files[0])}>
        Keyboard M
      </button>
      <button type="button" onClick={() => onMove?.(files[0], files[1])}>
        Drag to folder
      </button>
      <button
        type="button"
        onClick={() => {
          void onMove?.(files[0], files[1]);
          void onMove?.(files[0], files[1]);
        }}
      >
        Drag twice
      </button>
    </>
  ),
}));

const workspace = { id: { id: "workspace-token" }, kind: "fileWorkspace" };
const entry = {
  type: "file",
  handle: { id: { id: "entry-token" }, kind: "fileWorkspace" },
  name: "sample.pgn",
  numGames: 2,
  metadata: { type: "game", tags: [] },
  lastModified: 1,
};
const destination = {
  type: "directory",
  handle: { id: { id: "destination-token" }, kind: "fileWorkspace" },
  name: "Destination",
  children: [],
  lastModified: 1,
};

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

let container: HTMLDivElement;
let root: Root;
let FilesPage: ComponentType;

function button(name: string) {
  return [...container.querySelectorAll("button")].find((element) => element.textContent === name)!;
}

function click(name: string) {
  act(() => button(name).click());
}

function dialogButton(name: string) {
  return [...container.querySelector('[role="dialog"]')!.querySelectorAll("button")].find(
    (element) => element.textContent === name,
  )!;
}

async function settle() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

async function completeTrash() {
  click("Select sample file");
  click("Trash");
  await act(async () => button("Common.Delete").click());
  expect(mocks.trashWorkspaceEntry).toHaveBeenCalledWith(workspace, entry.handle);
  expect(container.textContent).toContain("Moved sample.pgn to trash.");
}

beforeEach(async () => {
  vi.clearAllMocks();
  mocks.data = [entry, destination];
  mocks.mutate.mockResolvedValue(undefined);
  mocks.trashWorkspaceEntry.mockResolvedValue(undefined);
  mocks.restoreWorkspaceEntry.mockResolvedValue(undefined);
  mocks.permanentlyDeleteWorkspaceEntry.mockResolvedValue(undefined);
  mocks.moveWorkspaceEntry.mockResolvedValue(undefined);
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  FilesPage = (await import("./FilesPage")).default;
  await act(async () => root.render(<FilesPage />));
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

describe("trash confirmations", () => {
  test("duplicate permanent-delete submits invoke native once", async () => {
    await completeTrash();
    mocks.mutate.mockClear();
    let resolve!: () => void;
    mocks.permanentlyDeleteWorkspaceEntry.mockImplementationOnce(
      () =>
        new Promise<void>((done) => {
          resolve = done;
        }),
    );
    click("Delete permanently");
    act(() => {
      button("Common.Delete").click();
      button("Common.Delete").click();
    });
    expect(mocks.permanentlyDeleteWorkspaceEntry).toHaveBeenCalledTimes(1);
    await act(async () => resolve());
    expect(mocks.mutate).toHaveBeenCalledTimes(1);
  });

  test("partial permanent-delete rejection clears the banner, relists, and shows specific copy", async () => {
    await completeTrash();
    mocks.mutate.mockClear();
    mocks.permanentlyDeleteWorkspaceEntry.mockRejectedValueOnce(
      new Error("Partially removed: 1 entries were deleted before failing: child not found"),
    );
    click("Delete permanently");
    await act(async () => button("Common.Delete").click());
    expect(mocks.mutate).toHaveBeenCalledTimes(1);
    expect(container.textContent).not.toContain("Moved sample.pgn to trash.");
    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      "Part of the operation was completed, and what is shown may no longer match.",
    );
  });

  test("successful permanent-delete is not reported as failed when relisting fails", async () => {
    await completeTrash();
    mocks.mutate.mockClear();
    mocks.mutate.mockRejectedValueOnce(new Error("list unavailable"));
    click("Delete permanently");
    await act(async () => button("Common.Delete").click());
    expect(mocks.permanentlyDeleteWorkspaceEntry).toHaveBeenCalledTimes(1);
    expect(mocks.mutate).toHaveBeenCalledTimes(1);
    expect(container.querySelector('[role="dialog"]')).toBeNull();
    expect(container.textContent).not.toContain("The action could not be completed");
    expect(container.textContent).not.toContain("list unavailable");
  });

  test("partial permanent-delete keeps its error when relisting fails", async () => {
    await completeTrash();
    mocks.mutate.mockClear();
    mocks.permanentlyDeleteWorkspaceEntry.mockRejectedValueOnce(
      new Error("Committed but durability uncertain: parent not found"),
    );
    mocks.mutate.mockRejectedValueOnce(new Error("list unavailable"));
    click("Delete permanently");
    await act(async () => button("Common.Delete").click());
    expect(mocks.mutate).toHaveBeenCalledTimes(1);
    expect(container.textContent).not.toContain("Moved sample.pgn to trash.");
    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      "Part of the operation was completed, and what is shown may no longer match.",
    );
    expect(container.textContent).not.toContain("list unavailable");
  });

  test.each([
    ["restore", "Undo", "Restore file", "Restore", "restoreWorkspaceEntry"],
    [
      "purge",
      "Delete permanently",
      "Delete permanently",
      "Common.Delete",
      "permanentlyDeleteWorkspaceEntry",
    ],
  ])(
    "%s rejection leaves the trashed item recoverable",
    async (_action, trigger, title, confirm, command) => {
      await completeTrash();
      mocks.mutate.mockClear();
      mocks[
        command as "restoreWorkspaceEntry" | "permanentlyDeleteWorkspaceEntry"
      ].mockRejectedValueOnce(new Error(`${_action} denied`));
      click(trigger);
      await act(async () => button(confirm).click());
      expect(mocks.mutate).not.toHaveBeenCalled();
      expect(container.textContent).toContain("Moved sample.pgn to trash.");
      expect(container.querySelector('[role="dialog"]')?.getAttribute("aria-label")).toBe(title);
      expect(container.textContent).toContain(
        "The action could not be completed. Please try again.",
      );
    },
  );

  test.each([
    ["restore", "Undo", "Restore file", "Restore", "restoreWorkspaceEntry"],
    [
      "purge",
      "Delete permanently",
      "Delete permanently",
      "Common.Delete",
      "permanentlyDeleteWorkspaceEntry",
    ],
  ])(
    "%s success closes and relists exactly once",
    async (_action, trigger, _title, confirm, command) => {
      await completeTrash();
      mocks.mutate.mockClear();
      click(trigger);
      await act(async () => button(confirm).click());
      expect(
        mocks[command as "restoreWorkspaceEntry" | "permanentlyDeleteWorkspaceEntry"],
      ).toHaveBeenCalledWith(workspace, entry.handle);
      expect(mocks.mutate).toHaveBeenCalledTimes(1);
      expect(container.querySelector('[role="dialog"]')).toBeNull();
      expect(container.textContent).not.toContain("Moved sample.pgn to trash.");
    },
  );
});

test("collection selection keeps the native opaque handle and only display metadata", async () => {
  const nextWorkspace = { id: { id: "new-workspace-token" }, kind: "fileWorkspace" };
  mocks.issueFileWorkspace.mockResolvedValue({ handle: nextWorkspace, displayName: "Games" });

  click("Change collection");
  await settle();

  expect(mocks.setWorkspace).toHaveBeenCalledWith(nextWorkspace);
  expect(mocks.setWorkspaceDisplayName).toHaveBeenCalledWith("Games");
});

describe("move controller", () => {
  test.each(["Context Move", "Keyboard M"])(
    "%s moves the exact selected handle to the collection root",
    async (trigger) => {
      mocks.mutate.mockClear();
      click(trigger);
      expect(container.querySelector('[role="dialog"]')?.getAttribute("aria-label")).toBe(
        "Move file",
      );
      await act(async () => dialogButton("Move").click());
      expect(mocks.moveWorkspaceEntry).toHaveBeenCalledTimes(1);
      expect(mocks.moveWorkspaceEntry).toHaveBeenCalledWith(workspace, entry.handle, workspace);
      expect(mocks.mutate).toHaveBeenCalledTimes(1);
      expect(container.querySelector('[role="dialog"]')).toBeNull();
      expect(container.querySelector("output")?.textContent).toBe("sample.pgn");
    },
  );

  test("native move rejection keeps the dialog error and focused source", async () => {
    mocks.moveWorkspaceEntry.mockRejectedValueOnce(new Error("native move denied"));
    click("Context Move");
    const move = dialogButton("Move");
    act(() => {
      move.focus();
      move.click();
    });
    await act(async () => undefined);
    expect(mocks.moveWorkspaceEntry).toHaveBeenCalledWith(workspace, entry.handle, workspace);
    expect(container.querySelector('[role="dialog"]')?.textContent).toContain(
      "The file operation could not be completed. Please try again.",
    );
    expect(container.querySelector("output")?.textContent).toBe("sample.pgn");
    expect(document.activeElement).toBe(move);
    expect(mocks.mutate).not.toHaveBeenCalled();
  });

  test("drag move shares the guarded controller and relists once", async () => {
    mocks.mutate.mockClear();
    click("Drag to folder");
    await settle();
    expect(mocks.moveWorkspaceEntry).toHaveBeenCalledWith(
      workspace,
      entry.handle,
      destination.handle,
    );
    expect(mocks.mutate).toHaveBeenCalledTimes(1);
    expect(container.querySelector("output")?.textContent).toBe("sample.pgn");
  });

  test("duplicate drag submits call native once and preserve focus on rejection", async () => {
    let reject!: (error: Error) => void;
    mocks.moveWorkspaceEntry.mockImplementationOnce(
      () =>
        new Promise<void>((_resolve, fail) => {
          reject = fail;
        }),
    );
    const drag = button("Drag twice");
    act(() => {
      drag.focus();
      drag.click();
    });
    expect(mocks.moveWorkspaceEntry).toHaveBeenCalledTimes(1);
    await act(async () => reject(new Error("native drag denied")));
    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      "The file operation could not be completed. Please try again.",
    );
    expect(container.querySelector("output")?.textContent).toBe("sample.pgn");
    expect(document.activeElement).toBe(drag);
    expect(mocks.mutate).not.toHaveBeenCalled();
  });
});
