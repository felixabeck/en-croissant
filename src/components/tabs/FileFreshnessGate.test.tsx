import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { Provider, createStore as createJotaiStore, useAtomValue } from "jotai";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import type { FileMetadata } from "@/components/files/file";
import { TreeStateContext } from "@/components/common/TreeStateContext";
import { activeTabAtom, tabsAtom } from "@/state/atoms";
import { closeTreeStore, createTreeStore, type TreeStore } from "@/state/store/tree";
import { tabStorage } from "@/state/store/tabStorage";
import { getFileFreshness, removeFileFreshness, setFileFreshness } from "@/state/fileFreshness";
import { defaultTree } from "@/utils/treeReducer";
import { serializeStoreTree } from "@/utils/tabs";
import type { Tab } from "@/utils/tabs";
import FileFreshnessGate from "./FileFreshnessGate";

const mocks = vi.hoisted(() => ({
  loadFileGame: vi.fn(),
  parsePGN: vi.fn(),
  pickPgnFile: vi.fn(),
  readFileGame: vi.fn(),
  reportPersistError: vi.fn(),
  writeGame: vi.fn(),
  translate: vi.fn((key: string) => key),
}));

vi.mock("@/utils/files", () => ({
  loadFileGame: mocks.loadFileGame,
  pickPgnFile: mocks.pickPgnFile,
  readFileGame: mocks.readFileGame,
}));
vi.mock("@/platform/tauri", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/platform/tauri")>();
  return { ...actual, tauri: { ...actual.tauri, writeGame: mocks.writeGame } };
});
vi.mock("@/utils/chess", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/utils/chess")>()),
  parsePGN: mocks.parsePGN,
}));
vi.mock("@/state/persistError", () => ({ reportPersistError: mocks.reportPersistError }));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: mocks.translate }) }));
vi.mock("@mantine/core", () => ({
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props}>{children}</button>
  ),
  Group: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Loader: () => <span>loader</span>,
  Stack: ({ children, ...props }: { children: React.ReactNode; className?: string }) => (
    <div {...props}>{children}</div>
  ),
  Text: ({ children, ...props }: { children: React.ReactNode; className?: string }) => (
    <p {...props}>{children}</p>
  ),
}));

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const tabId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const originalStamp = "a".repeat(64);
const changedStamp = "b".repeat(64);
const emptyStamp = "e".repeat(64);
const file: FileMetadata = {
  type: "file",
  handle: { id: { id: "file-handle" }, kind: "fileWorkspace" },
  name: "games.pgn",
  numGames: 2,
  metadata: { type: "game", tags: [] },
  lastModified: 1,
};
const fileTab: Tab = {
  value: tabId,
  name: "Game",
  type: "analysis",
  gameOrigin: { kind: "file", file, gameNumber: 0 },
};

let host: HTMLDivElement;
let root: Root;
let jotaiStore: ReturnType<typeof createJotaiStore>;
let treeStore: TreeStore;

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
}

function stampedGame(stamp = originalStamp, pgn = '[Event "Game"]\n\n1. e4 *', present = true) {
  return { pgn, stamp, revision: "device:inode:revision", present };
}

function button(label: string): HTMLButtonElement {
  const result = Array.from(host.querySelectorAll("button")).find(
    (candidate) => candidate.textContent === label,
  );
  if (!(result instanceof HTMLButtonElement)) throw new Error(`Missing button ${label}`);
  return result;
}

function Harness({ closeTab }: { closeTab: (id: string) => void }) {
  const tabs = useAtomValue(tabsAtom);
  const tab = tabs.find((candidate) => candidate.value === tabId);
  return tab ? <GateForTab tab={tab} closeTab={closeTab} /> : null;
}

function GateForTab({ tab, closeTab }: { tab: Tab; closeTab: (id: string) => void }) {
  return (
    <TreeStateContext.Provider value={treeStore}>
      <FileFreshnessGate tab={tab} closeTab={closeTab}>
        <div data-testid="board-and-panels">board and panels</div>
      </FileFreshnessGate>
    </TreeStateContext.Provider>
  );
}

async function setup({
  treeStamp = originalStamp,
  dirty = false,
  appendAttempted = false,
  freshness = "unverified",
  persisted = false,
  readError,
}: {
  treeStamp?: string | null;
  dirty?: boolean;
  appendAttempted?: boolean;
  freshness?: "unverified" | "appending";
  persisted?: boolean;
  readError?: Error;
} = {}) {
  const tree = defaultTree();
  tree.sourceStamp = treeStamp;
  tree.dirty = dirty;
  tree.appendAttempted = appendAttempted;
  if (dirty) tree.headers.event = "Unsaved edit";
  treeStore = createTreeStore(persisted ? tabId : undefined, tree);
  jotaiStore = createJotaiStore();
  jotaiStore.set(tabsAtom, [fileTab], tabId);
  jotaiStore.set(activeTabAtom, tabId);
  setFileFreshness(tabId, freshness);
  if (readError) mocks.readFileGame.mockRejectedValue(readError);
  else mocks.readFileGame.mockResolvedValue(stampedGame(treeStamp ?? originalStamp));
  mocks.loadFileGame.mockResolvedValue({
    ...stampedGame(changedStamp),
    tree: { ...defaultTree(), sourceStamp: changedStamp },
  });
  mocks.pickPgnFile.mockResolvedValue({ ...file, numGames: 7 });
  mocks.writeGame.mockResolvedValue({ stamp: changedStamp });
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  const closeTab = vi.fn();
  await act(async () =>
    root.render(
      <Provider store={jotaiStore}>
        <Harness closeTab={closeTab} />
      </Provider>,
    ),
  );
  return closeTab;
}

beforeEach(() => {
  sessionStorage.clear();
  vi.clearAllMocks();
  mocks.parsePGN.mockImplementation(async (pgn: string) => {
    const tree = defaultTree();
    const event = pgn.match(/\[Event "([^"]+)"\]/)?.[1];
    if (event) tree.headers.event = event;
    return tree;
  });
  removeFileFreshness(tabId);
});

afterEach(async () => {
  await act(async () => root?.unmount());
  host?.remove();
  tabStorage.flush();
  closeTreeStore(tabId);
  removeFileFreshness(tabId);
  vi.restoreAllMocks();
});

test("unverified files withhold the board until an equal stamp verifies", async () => {
  const read = deferred<ReturnType<typeof stampedGame>>();
  mocks.readFileGame.mockReturnValueOnce(read.promise);
  await setup();

  expect(host.querySelector('[data-testid="board-and-panels"]')).toBeNull();
  expect(host.textContent).toContain("FileFreshness.CheckingFile");

  await act(async () => read.resolve(stampedGame(originalStamp)));

  expect(host.querySelector('[data-testid="board-and-panels"]')).not.toBeNull();
  expect(getFileFreshness(tabId)).toMatchObject({
    state: "verified",
    verifiedRevision: "device:inode:revision",
  });
  expect(treeStore.getState().sourceStamp).toBe(originalStamp);
});

test("clean changed files reload from disk before rendering and clean stampless trees reconcile", async () => {
  mocks.readFileGame.mockResolvedValueOnce(stampedGame(changedStamp, '[Event "Fresh"]\n\n1. d4 *'));
  await setup({ treeStamp: null });

  await vi.waitFor(() =>
    expect(host.querySelector('[data-testid="board-and-panels"]')).not.toBeNull(),
  );
  expect(treeStore.getState().sourceStamp).toBe(changedStamp);
  expect(treeStore.getState().headers.event).toBe("Fresh");
  expect(host.querySelector('[data-file-freshness="verified:1"]')).not.toBeNull();
});

test("equal stamps render without replacing tree state", async () => {
  await setup();
  const setState = vi.spyOn(treeStore.getState(), "setState");

  await vi.waitFor(() =>
    expect(host.querySelector('[data-testid="board-and-panels"]')).not.toBeNull(),
  );

  expect(setState).not.toHaveBeenCalled();
});

test("dirty changed trees show conflict without mounting board or practice children", async () => {
  mocks.readFileGame.mockResolvedValueOnce(stampedGame(changedStamp));
  await setup({ dirty: true });

  await vi.waitFor(() => expect(getFileFreshness(tabId).state).toBe("conflict"));

  expect(host.querySelector('[data-testid="board-and-panels"]')).toBeNull();
  expect(host.textContent).toContain("FileFreshness.Changed");
  expect(host.textContent).toContain("FileFreshness.ReloadFromDisk");
  expect(host.textContent).toContain("FileFreshness.SaveAsNewGame");
  expect(treeStore.getState().headers.event).toBe("Unsaved edit");
});

test("an edit made during reconcile becomes a conflict instead of being replaced", async () => {
  const read = deferred<ReturnType<typeof stampedGame>>();
  mocks.readFileGame.mockReturnValueOnce(read.promise);
  await setup();
  await act(async () => {
    treeStore.getState().setHeaders({ ...treeStore.getState().headers, event: "Edited in flight" });
  });

  await act(async () => read.resolve(stampedGame(changedStamp, '[Event "Disk"]\n\n1. d4 *')));

  expect(getFileFreshness(tabId).state).toBe("conflict");
  expect(treeStore.getState().headers.event).toBe("Edited in flight");
  expect(host.querySelector('[data-testid="board-and-panels"]')).toBeNull();
});

test.each([
  ["invalid-input", "FileFreshness.GameNoLongerInFile"],
  ["missing-resource", "FileFreshness.Unavailable"],
  ["conflict", "FileFreshness.Unavailable"],
] as const)("routes %s reads to the unavailable panel", async (category, expectedText) => {
  mocks.readFileGame.mockRejectedValueOnce({
    tag: "backend-error",
    category,
    message: "file unavailable",
  });
  await setup();

  await vi.waitFor(() => expect(getFileFreshness(tabId).state).toBe("unavailable"));

  expect(host.textContent).toContain(expectedText);
  expect(host.querySelector('[data-testid="board-and-panels"]')).toBeNull();
});

test("a deleted game is unavailable, while a matching empty slot remains verified", async () => {
  mocks.readFileGame.mockResolvedValueOnce(stampedGame(emptyStamp, "", false));
  await setup({ treeStamp: emptyStamp });

  await vi.waitFor(() => expect(getFileFreshness(tabId).state).toBe("verified"));
  expect(host.querySelector('[data-testid="board-and-panels"]')).not.toBeNull();
});

test("a missing game with a prior non-empty stamp is unavailable", async () => {
  mocks.readFileGame.mockResolvedValueOnce(stampedGame(emptyStamp, "", false));
  await setup({ treeStamp: originalStamp });

  await vi.waitFor(() => expect(getFileFreshness(tabId).state).toBe("unavailable"));
  expect(host.querySelector('[data-testid="board-and-panels"]')).toBeNull();
});

test("an unavailable panel close request is routed through the tab close flow", async () => {
  mocks.readFileGame.mockRejectedValueOnce({
    tag: "backend-error",
    category: "missing-resource",
    message: "file missing",
  });
  const closeTab = await setup({ dirty: true });
  await vi.waitFor(() => expect(getFileFreshness(tabId).state).toBe("unavailable"));

  await act(async () => button("FileFreshness.CloseTab").click());

  expect(closeTab).toHaveBeenCalledWith(tabId);
  expect(treeStore.getState().dirty).toBe(true);
});

test("generic read failures keep the board withheld and offer retry", async () => {
  await setup({ readError: new Error("network offline") });

  expect(mocks.readFileGame).toHaveBeenCalled();
  await vi.waitFor(() => expect(host.textContent).toContain("network offline"), {
    timeout: 500,
  });
  expect(getFileFreshness(tabId).state).toBe("unverified");
  expect(host.querySelector('[data-testid="board-and-panels"]')).toBeNull();
  expect(host.textContent).toContain("FileFreshness.Retry");
});

test("append resolution flushes uncertainty first and moves the tab only after a stamped append", async () => {
  mocks.readFileGame.mockResolvedValueOnce(stampedGame(changedStamp));
  await setup({ dirty: true, persisted: true });
  await vi.waitFor(() => expect(getFileFreshness(tabId).state).toBe("conflict"));
  const serializedTree = serializeStoreTree(treeStore);
  const pending = deferred<{ stamp: string | null }>();
  mocks.writeGame.mockImplementationOnce(async () => {
    expect(tabStorage.read(tabId)?.state).toMatchObject({ appendAttempted: true });
    return pending.promise;
  });

  await act(async () => button("FileFreshness.SaveAsNewGame").click());

  expect(mocks.writeGame).toHaveBeenCalledWith(file.handle, 7, expect.any(String), {
    kind: "append",
  });
  expect(mocks.writeGame.mock.calls[0][2]).toBe(serializedTree);
  await vi.waitFor(() => expect(button("FileFreshness.ReloadFromDisk").disabled).toBe(true));
  expect(button("FileFreshness.SaveAsNewGame").disabled).toBe(true);
  await act(async () => pending.resolve({ stamp: changedStamp }));

  expect(jotaiStore.get(tabsAtom)[0].gameOrigin).toMatchObject({
    kind: "file",
    gameNumber: 7,
    file: { numGames: 8 },
  });
  expect(treeStore.getState()).toMatchObject({
    dirty: false,
    sourceStamp: changedStamp,
    appendAttempted: false,
  });
  expect(getFileFreshness(tabId).state).toBe("verified");
});

test("an uncertain append stays disabled across a persisted restart marker", async () => {
  mocks.readFileGame.mockResolvedValueOnce(stampedGame(changedStamp));
  await setup({ dirty: true, persisted: true });
  await vi.waitFor(() => expect(getFileFreshness(tabId).state).toBe("conflict"));
  mocks.writeGame.mockResolvedValueOnce({ stamp: null });

  await act(async () => button("FileFreshness.SaveAsNewGame").click());

  expect(treeStore.getState().appendAttempted).toBe(true);
  expect(tabStorage.read(tabId)?.state).toMatchObject({ appendAttempted: true, dirty: true });
  expect(button("FileFreshness.SaveAsNewGame").disabled).toBe(true);
  expect(host.textContent).toContain("FileFreshness.AppendMayHaveBeenAdded");
  expect(mocks.writeGame).toHaveBeenCalledOnce();
});

test("a persisted uncertain append marker keeps the board withheld even when the source stamp matches", async () => {
  await setup({ dirty: true, appendAttempted: true });

  await vi.waitFor(() => expect(getFileFreshness(tabId).state).toBe("conflict"));

  expect(host.querySelector('[data-testid="board-and-panels"]')).toBeNull();
  expect(host.textContent).toContain("FileFreshness.AppendMayHaveBeenAdded");
  expect(button("FileFreshness.SaveAsNewGame").disabled).toBe(true);
  expect(button("FileFreshness.ReloadFromDisk").disabled).toBe(false);
});

test("Reload from disk clears append uncertainty and restores verified children", async () => {
  mocks.readFileGame.mockResolvedValueOnce(stampedGame(changedStamp));
  await setup({ dirty: true, appendAttempted: true });
  await vi.waitFor(() => expect(getFileFreshness(tabId).state).toBe("conflict"));

  await act(async () => button("FileFreshness.ReloadFromDisk").click());

  expect(treeStore.getState()).toMatchObject({
    dirty: false,
    sourceStamp: changedStamp,
    appendAttempted: false,
  });
  expect(getFileFreshness(tabId).state).toBe("verified");
  expect(host.querySelector('[data-testid="board-and-panels"]')).not.toBeNull();
});

test("cancelled and stale appends leave the conflicting tree available for retry", async () => {
  mocks.readFileGame.mockResolvedValueOnce(stampedGame(changedStamp));
  await setup({ dirty: true });
  await vi.waitFor(() => expect(getFileFreshness(tabId).state).toBe("conflict"));
  mocks.pickPgnFile.mockResolvedValueOnce(null);

  await act(async () => button("FileFreshness.SaveAsNewGame").click());
  expect(getFileFreshness(tabId).state).toBe("conflict");
  expect(treeStore.getState().headers.event).toBe("Unsaved edit");
  expect(mocks.writeGame).not.toHaveBeenCalled();

  const stale = new Error("The game changed on disk");
  Object.assign(stale, {
    details: { category: "validation", backendCategory: "stale-game", message: stale.message },
  });
  mocks.writeGame.mockRejectedValueOnce(stale);
  await act(async () => button("FileFreshness.SaveAsNewGame").click());
  expect(treeStore.getState().appendAttempted).toBe(false);
  expect(button("FileFreshness.SaveAsNewGame").disabled).toBe(false);
  expect(host.textContent).toContain("FileFreshness.AppendChanged");
});

test("the appending state withholds children and starts no reconcile", async () => {
  await setup({ freshness: "appending" });
  expect(host.querySelector('[data-testid="board-and-panels"]')).toBeNull();
  expect(host.textContent).toContain("FileFreshness.AddingGame");
  expect(mocks.readFileGame).not.toHaveBeenCalled();
});

test("a pending reload disables append until the reload settles", async () => {
  mocks.readFileGame.mockResolvedValueOnce(stampedGame(changedStamp));
  await setup({ dirty: true });
  await vi.waitFor(() => expect(getFileFreshness(tabId).state).toBe("conflict"));
  const pendingLoad = deferred<{
    pgn: string;
    stamp: string;
    revision: string;
    present: boolean;
    tree: ReturnType<typeof defaultTree>;
  }>();
  mocks.loadFileGame.mockReturnValueOnce(pendingLoad.promise);

  await act(async () => button("FileFreshness.ReloadFromDisk").click());

  expect(button("FileFreshness.SaveAsNewGame").disabled).toBe(true);
  await act(async () => button("FileFreshness.SaveAsNewGame").click());
  expect(mocks.pickPgnFile).not.toHaveBeenCalled();
  const tree = defaultTree();
  tree.sourceStamp = changedStamp;
  await act(async () =>
    pendingLoad.resolve({
      pgn: "fresh",
      stamp: changedStamp,
      revision: "reload",
      present: true,
      tree,
    }),
  );
  expect(getFileFreshness(tabId).state).toBe("verified");
});

test("a reconcile invalidated by a newer epoch cannot release stale children", async () => {
  const read = deferred<ReturnType<typeof stampedGame>>();
  mocks.readFileGame.mockReturnValueOnce(read.promise);
  await setup();
  setFileFreshness(tabId, "conflict", { conflictReason: "changed" });

  await act(async () => read.resolve(stampedGame(originalStamp)));

  expect(getFileFreshness(tabId).state).toBe("conflict");
  expect(host.querySelector('[data-testid="board-and-panels"]')).toBeNull();
});
