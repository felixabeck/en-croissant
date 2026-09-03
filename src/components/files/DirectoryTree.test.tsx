import { act, forwardRef, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { Provider, createStore } from "jotai";
import { afterEach, expect, test, vi } from "vitest";
import { activeTabAtom, expandedDirectoriesAtom, tabsAtom } from "@/state/atoms";
import type { Entry } from "./file";
import DirectoryTree from "./DirectoryTree";

const mocks = vi.hoisted(() => ({ navigate: vi.fn(), openFile: vi.fn() }));

vi.mock("@mantine/core", () => ({
  Badge: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
  Box: forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement> & { pl?: number }>(
    ({ children, pl: _pl, ...props }, ref) => (
      <div ref={ref} {...props}>
        {children}
      </div>
    ),
  ),
  Group: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Text: ({ children, ...props }: React.HTMLAttributes<HTMLSpanElement>) => (
    <span {...props}>{children}</span>
  ),
}));
vi.mock("@tabler/icons-react", () => ({
  IconFileDescription: () => null,
  IconFolder: () => null,
  IconFolderOpen: () => null,
  IconTrash: () => null,
}));
vi.mock("@tanstack/react-router", () => ({ useNavigate: () => mocks.navigate }));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@/components/common/IconAction", () => ({
  IconAction: ({
    label,
    children,
    color: _color,
    variant: _variant,
    size: _size,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement> & {
    label: string;
    color?: string;
    variant?: string;
    size?: string | number;
  }) => (
    <button aria-label={label} {...props}>
      {children}
    </button>
  ),
}));
vi.mock("@/utils/files", () => ({ openFile: mocks.openFile }));

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const handle = (id: string) => ({ id: { id }, kind: "fileWorkspace" }) as Entry["handle"];
const directory: Entry = {
  type: "directory",
  handle: handle("opaque-folder"),
  name: "Folder",
  lastModified: 1,
  children: [
    {
      type: "file",
      handle: handle("opaque-child"),
      name: "Child",
      numGames: 1,
      metadata: { type: "game", tags: [] },
      lastModified: 1,
    },
  ],
};
const rootFile: Entry = {
  type: "file",
  handle: handle("opaque-root-file"),
  name: "Root",
  numGames: 3,
  metadata: { type: "game", tags: [] },
  lastModified: 1,
};

let root: Root;
let container: HTMLDivElement;

function treeitems() {
  return [...container.querySelectorAll<HTMLElement>('[role="treeitem"]')];
}
function item(name: string) {
  return treeitems().find((element) => element.getAttribute("aria-label") === name)!;
}
async function key(element: HTMLElement, value: string) {
  await act(async () => {
    element.dispatchEvent(new KeyboardEvent("keydown", { key: value, bubbles: true }));
  });
}

afterEach(async () => {
  vi.clearAllMocks();
  await act(async () => root?.unmount());
  container?.remove();
});

test("supports ARIA-tree roving focus, keyboard expansion, selection, and opaque handles", async () => {
  const store = createStore();
  store.set(expandedDirectoriesAtom, []);
  store.set(tabsAtom, []);
  store.set(activeTabAtom, null);
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);

  const onRequestDelete = vi.fn();
  function Harness() {
    const [selected, setSelected] = useState<Entry | null>(null);
    return (
      <Provider store={store}>
        <DirectoryTree
          files={[directory, rootFile]}
          refreshDirectory={async () => undefined}
          selectedFile={selected}
          setSelectedFile={setSelected}
          onRequestDelete={onRequestDelete}
          search=""
          filter=""
        />
      </Provider>
    );
  }
  await act(async () => root.render(<Harness />));

  expect(treeitems()).toHaveLength(2);
  expect(treeitems().map((element) => element.tabIndex)).toEqual([0, -1]);
  expect(container.querySelector('[role="tree"]')?.getAttribute("aria-label")).toBe("Files.Title");
  expect(container.querySelectorAll('button[aria-label="Common.Delete"]')).toHaveLength(2);
  act(() => {
    container.querySelectorAll<HTMLButtonElement>('button[aria-label="Common.Delete"]')[1].click();
  });
  expect(onRequestDelete).toHaveBeenCalledWith(rootFile);
  onRequestDelete.mockClear();
  const folderDelete = container.querySelectorAll<HTMLButtonElement>(
    'button[aria-label="Common.Delete"]',
  )[0];
  for (const keyName of ["Enter", " "]) {
    await key(folderDelete, keyName);
    act(() => folderDelete.click());
  }
  expect(onRequestDelete).toHaveBeenCalledTimes(2);
  expect(onRequestDelete).toHaveBeenLastCalledWith(directory);
  expect(item("Folder").getAttribute("aria-expanded")).toBe("false");
  expect(mocks.openFile).not.toHaveBeenCalled();
  expect(container.textContent).not.toContain("opaque-folder");
  expect(container.textContent).not.toContain("opaque-child");

  let folder = item("Folder");
  act(() => folder.focus());
  await key(folder, "ArrowRight");
  folder = item("Folder");
  expect(folder.getAttribute("aria-expanded")).toBe("true");
  expect(treeitems()).toHaveLength(3);
  await key(folder, "ArrowRight");
  expect(document.activeElement).toBe(item("Child"));
  await key(item("Child"), "ArrowDown");
  expect(treeitems().map((element) => element.tabIndex)).toEqual([-1, -1, 0]);
  expect(document.activeElement).toBe(item("Root"));
  await key(item("Root"), "ArrowUp");
  expect(document.activeElement).toBe(item("Child"));
  await key(item("Child"), "ArrowLeft");
  expect(document.activeElement).toBe(item("Folder"));
  await key(item("Folder"), "ArrowLeft");
  expect(folder.getAttribute("aria-expanded")).toBe("false");
  await key(folder, "End");
  expect(document.activeElement).toBe(item("Root"));
  await key(item("Root"), "Home");
  expect(document.activeElement).toBe(item("Folder"));
  await key(folder, "Enter");
  expect(folder.getAttribute("aria-selected")).toBe("true");
  expect(folder.getAttribute("aria-expanded")).toBe("true");
  await key(folder, " ");
  expect(folder.getAttribute("aria-expanded")).toBe("false");
  expect(treeitems().filter((element) => element.tabIndex === 0)).toHaveLength(1);
});

test("filters the visible navigation model and opens a filtered file with Enter", async () => {
  const store = createStore();
  store.set(expandedDirectoriesAtom, []);
  store.set(tabsAtom, []);
  store.set(activeTabAtom, null);
  mocks.openFile.mockResolvedValue(undefined);
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);

  function Harness() {
    const [selected, setSelected] = useState<Entry | null>(null);
    return (
      <Provider store={store}>
        <DirectoryTree
          files={[directory, rootFile]}
          refreshDirectory={async () => undefined}
          selectedFile={selected}
          setSelectedFile={setSelected}
          onRequestDelete={vi.fn()}
          search="child"
          filter="game"
        />
      </Provider>
    );
  }
  await act(async () => root.render(<Harness />));

  expect(treeitems().map((element) => element.getAttribute("aria-label"))).toEqual(["Folder"]);
  const folder = item("Folder");
  act(() => folder.focus());
  await key(folder, "ArrowRight");
  await key(item("Folder"), "ArrowRight");
  expect(treeitems().map((element) => element.getAttribute("aria-label"))).toEqual([
    "Folder",
    "Child",
  ]);
  expect(document.activeElement).toBe(item("Child"));

  await key(item("Child"), "Enter");
  expect(mocks.openFile).toHaveBeenCalledTimes(1);
  expect(mocks.openFile).toHaveBeenCalledWith(
    directory.children[0],
    expect.anything(),
    expect.anything(),
  );
  expect(mocks.navigate).toHaveBeenCalledWith({ to: "/" });

  mocks.openFile.mockClear();
  mocks.navigate.mockClear();
  await act(async () => {
    item("Child").dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
  });
  expect(mocks.openFile).toHaveBeenCalledWith(
    directory.children[0],
    expect.anything(),
    expect.anything(),
  );
  expect(mocks.navigate).toHaveBeenCalledWith({ to: "/" });
});

test("routes context, M, and drag move intents with opaque entry handles", async () => {
  const store = createStore();
  store.set(expandedDirectoriesAtom, []);
  store.set(tabsAtom, []);
  store.set(activeTabAtom, null);
  const onRequestMove = vi.fn();
  const onMove = vi.fn();
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);

  function Harness() {
    const [selected, setSelected] = useState<Entry | null>(null);
    return (
      <Provider store={store}>
        <DirectoryTree
          files={[directory, rootFile]}
          refreshDirectory={async () => undefined}
          selectedFile={selected}
          setSelectedFile={setSelected}
          onRequestDelete={vi.fn()}
          onRequestMove={onRequestMove}
          onMove={onMove}
          search=""
          filter=""
        />
      </Provider>
    );
  }
  await act(async () => root.render(<Harness />));

  const rootMove = item("Root").querySelector<HTMLButtonElement>('button[aria-label="Files.Move"]');
  expect(rootMove).not.toBeNull();
  act(() => rootMove?.click());
  expect(onRequestMove).toHaveBeenCalledWith(rootFile);
  onRequestMove.mockClear();
  const source = item("Root");
  act(() => source.focus());
  await key(source, "m");
  expect(onRequestMove).toHaveBeenCalledWith(rootFile);

  const payload = new Map<string, string>();
  const dataTransfer = {
    setData: (type: string, value: string) => payload.set(type, value),
    getData: (type: string) => payload.get(type) || "",
  };
  const drag = (type: string) => {
    const event = new Event(type, { bubbles: true, cancelable: true });
    Object.defineProperty(event, "dataTransfer", { value: dataTransfer });
    return event;
  };
  act(() => source.dispatchEvent(drag("dragstart")));
  act(() => item("Folder").dispatchEvent(drag("drop")));
  expect(onMove).toHaveBeenCalledTimes(1);
  expect(onMove).toHaveBeenCalledWith(rootFile, directory);
});
