import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { Provider, createStore as createJotaiStore, useAtomValue } from "jotai";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import type { FileMetadata } from "@/components/files/file";
import { TreeStateContext } from "@/components/common/TreeStateContext";
import { activeTabAtom, tabsAtom } from "@/state/atoms";
import {
  closeTreeStore,
  createTreeStore,
  retargetTreeStore,
  type TreeStore,
} from "@/state/store/tree";
import { tabStorage, TabStorageRepository } from "@/state/store/tabStorage";
import { WORKSPACE_STORAGE_KEY } from "@/state/workspace";
import {
  getFileFreshness,
  removeFileFreshness,
  saveFileConflictVersion,
  setFileFreshness,
  startFileRevisionPoll,
} from "@/state/fileFreshness";
import { defaultTree } from "@/utils/treeReducer";
import { getTabTreeKey, saveToFile, serializeStoreTree } from "@/utils/tabs";
import type { Tab } from "@/utils/tabs";
import FileFreshnessGate from "./FileFreshnessGate";
import TreeRecoveryGate from "./TreeRecoveryGate";

const mocks = vi.hoisted(() => ({
  loadFileGame: vi.fn(),
  parsePGN: vi.fn(),
  pickPgnFile: vi.fn(),
  readFileGame: vi.fn(),
  reportPersistError: vi.fn(),
  writeGame: vi.fn(),
  translate: vi.fn((key: string) => key),
}));

vi.mock("@/utils/files", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/utils/files")>()),
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
const sharedTabId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
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
      <TreeRecoveryGate tabId={tab.value} treeKey={getTabTreeKey(tab)}>
        <FileFreshnessGate tab={tab} closeTab={closeTab}>
          <div data-testid="board-and-panels">board and panels</div>
        </FileFreshnessGate>
      </TreeRecoveryGate>
    </TreeStateContext.Provider>
  );
}

function SharedGateHarness({ secondTab, secondStore }: { secondTab: Tab; secondStore: TreeStore }) {
  return (
    <>
      <TreeStateContext.Provider value={treeStore}>
        <FileFreshnessGate tab={fileTab} closeTab={() => undefined}>
          <div data-testid="first-shared-board">first board</div>
        </FileFreshnessGate>
      </TreeStateContext.Provider>
      <TreeStateContext.Provider value={secondStore}>
        <FileFreshnessGate tab={secondTab} closeTab={() => undefined}>
          <div data-testid="second-shared-board">second board</div>
        </FileFreshnessGate>
      </TreeStateContext.Provider>
    </>
  );
}

async function setup({
  treeStamp = originalStamp,
  dirty = false,
  appendAttempted = false,
  freshness = "unverified",
  persisted = false,
  readError,
  readResult,
  tab = fileTab,
}: {
  treeStamp?: string | null;
  dirty?: boolean;
  appendAttempted?: boolean;
  freshness?: "unverified" | "overdue" | "appending" | "verified";
  persisted?: boolean;
  readError?: Error;
  readResult?: (store: TreeStore) => ReturnType<typeof stampedGame>;
  tab?: Tab;
} = {}) {
  const tree = defaultTree();
  tree.sourceStamp = treeStamp;
  tree.dirty = dirty;
  tree.appendAttempted = appendAttempted;
  if (dirty) tree.headers.event = "Unsaved edit";
  if (persisted && tab.treeKey) tabStorage.seed(getTabTreeKey(tab), tree);
  treeStore = createTreeStore(persisted ? tabId : undefined, tree, getTabTreeKey(tab));
  tabStorage.readTree(getTabTreeKey(tab));
  jotaiStore = createJotaiStore();
  jotaiStore.set(tabsAtom, [tab], tabId);
  jotaiStore.set(activeTabAtom, tabId);
  setFileFreshness(tabId, freshness);
  if (readResult)
    mocks.readFileGame.mockImplementation(() => Promise.resolve(readResult(treeStore)));
  else if (readError) mocks.readFileGame.mockRejectedValue(readError);
  else mocks.readFileGame.mockResolvedValue(stampedGame(treeStamp ?? originalStamp));
  mocks.loadFileGame.mockResolvedValue({
    ...stampedGame(changedStamp),
    tree: { ...defaultTree(), sourceStamp: changedStamp },
  });
  mocks.pickPgnFile.mockResolvedValue({ ...file, numGames: 7 });
  mocks.writeGame.mockResolvedValue({ stamp: changedStamp, revision: "new-revision" });
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
  vi.useRealTimers();
  await act(async () => root?.unmount());
  host?.remove();
  tabStorage.flush();
  closeTreeStore(tabId);
  closeTreeStore(sharedTabId);
  removeFileFreshness(tabId);
  removeFileFreshness(sharedTabId);
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

test("file-backed analysis enters normal freshness reconciliation after tree discard", async () => {
  sessionStorage.setItem(tabId, "unreadable file-backed tree");
  tabStorage.readTree(tabId);
  await setup({ persisted: true });

  expect(host.querySelector('[data-tree-recovery="unreadable"]')).not.toBeNull();
  expect(host.querySelector("[data-file-freshness]")).toBeNull();
  expect(mocks.readFileGame).not.toHaveBeenCalled();

  await act(async () => button("TreeRecovery.DiscardValue").click());
  await vi.waitFor(() => expect(mocks.readFileGame).toHaveBeenCalledOnce());
  await vi.waitFor(() => expect(getFileFreshness(tabId).state).toBe("conflict"));

  expect(host.querySelector("[data-tree-recovery]")).toBeNull();
  expect(host.querySelector('[data-file-freshness^="conflict:"]')).not.toBeNull();
  expect(host.querySelector('[data-testid="board-and-panels"]')).toBeNull();
});

test("clean stamped files reload from disk before rendering", async () => {
  mocks.readFileGame.mockResolvedValueOnce(stampedGame(changedStamp, '[Event "Fresh"]\n\n1. d4 *'));
  await setup();

  await vi.waitFor(() =>
    expect(host.querySelector('[data-testid="board-and-panels"]')).not.toBeNull(),
  );
  expect(treeStore.getState().sourceStamp).toBe(changedStamp);
  expect(treeStore.getState().headers.event).toBe("Fresh");
  expect(host.querySelector('[data-file-freshness="verified:1"]')).not.toBeNull();
});

test("a stampless tree matching the present disk text adopts its stamp without clearing dirty", async () => {
  await setup({
    treeStamp: null,
    dirty: true,
    readResult: (store) => stampedGame(changedStamp, serializeStoreTree(store)),
  });

  await vi.waitFor(() => expect(getFileFreshness(tabId).state).toBe("verified"));

  expect(treeStore.getState()).toMatchObject({ dirty: true, sourceStamp: changedStamp });
  expect(host.querySelector('[data-testid="board-and-panels"]')).not.toBeNull();
});

test("a clean stampless tree with different disk text conflicts without replacing the tree", async () => {
  await setup({
    treeStamp: null,
    readResult: () => stampedGame(changedStamp, '[Event "Different on disk"]\n\n1. d4 *'),
  });
  const rootBefore = treeStore.getState().root;

  await vi.waitFor(() => expect(getFileFreshness(tabId).state).toBe("conflict"));

  expect(treeStore.getState().root).toBe(rootBefore);
  expect(treeStore.getState().headers.event).not.toBe("Different on disk");
  expect(host.querySelector('[data-testid="board-and-panels"]')).toBeNull();
});

test("a reopened file tab reconciles the appended game at its refreshed end index", async () => {
  const appendedTab: Tab = {
    ...fileTab,
    gameOrigin: { kind: "file", file: { ...file, numGames: 5 }, gameNumber: 4 },
  };
  await setup({
    freshness: "unverified",
    tab: appendedTab,
    readResult: () => stampedGame(changedStamp, '[Event "New appended game"]\n\n*'),
  });

  await vi.waitFor(() => expect(getFileFreshness(tabId).state).toBe("verified"));

  expect(mocks.readFileGame).toHaveBeenCalledWith(file.handle, 4, expect.any(AbortSignal));
  expect(treeStore.getState()).toMatchObject({
    sourceStamp: changedStamp,
    headers: { event: "New appended game" },
  });
});

test("a stampless tree whose disk game is absent conflicts instead of adopting an empty slot", async () => {
  await setup({
    treeStamp: null,
    readResult: () => stampedGame(emptyStamp, "", false),
  });

  await vi.waitFor(() => expect(getFileFreshness(tabId).state).toBe("conflict"));

  expect(host.textContent).toContain("FileFreshness.Changed");
  expect(host.querySelector('[data-testid="board-and-panels"]')).toBeNull();
});

test("equal stamps render without replacing tree state", async () => {
  await setup();
  const setState = vi.spyOn(treeStore.getState(), "setState");

  await vi.waitFor(() =>
    expect(host.querySelector('[data-testid="board-and-panels"]')).not.toBeNull(),
  );

  expect(setState).not.toHaveBeenCalled();
});

test("a save seeds the poll revision without unmounting the verified board", async () => {
  vi.useFakeTimers();
  await setup({ freshness: "verified" });
  setFileFreshness(tabId, "verified", { verifiedRevision: "old-revision" });
  mocks.writeGame.mockResolvedValueOnce({ stamp: changedStamp, revision: "new-revision" });

  const updateTab = (id: string, update: Tab | ((tab: Tab) => Tab)) => {
    let found = false;
    const committed = jotaiStore.set(
      tabsAtom,
      (tabs) =>
        tabs.map((tab) => {
          if (tab.value !== id) return tab;
          found = true;
          return typeof update === "function" ? update(tab) : update;
        }),
      tabId,
    );
    return committed && found;
  };
  const board = host.querySelector('[data-testid="board-and-panels"]');
  const result = await saveToFile({
    tab: fileTab,
    updateTab,
    getTab: (id) => jotaiStore.get(tabsAtom).find((tab) => tab.value === id),
    store: treeStore,
  });
  const afterSave = getFileFreshness(tabId);
  expect(result).toBe("saved");
  expect(afterSave).toMatchObject({ state: "verified", verifiedRevision: "new-revision" });

  const fileRevision = vi.fn(async () => "new-revision");
  const stop = startFileRevisionPoll({
    getTabs: () => jotaiStore.get(tabsAtom),
    fileRevision,
    subscribeFocus: () => () => undefined,
  });
  await act(async () => vi.advanceTimersByTimeAsync(2_000));

  expect(fileRevision).toHaveBeenCalledOnce();
  expect(getFileFreshness(tabId)).toBe(afterSave);
  expect(getFileFreshness(tabId).epoch).toBe(afterSave.epoch);
  expect(host.querySelector('[data-testid="board-and-panels"]')).toBe(board);
  expect(host.textContent).not.toContain("loader");
  expect(mocks.readFileGame).not.toHaveBeenCalled();
  stop();
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

  await act(async () => button("Tab.Close").click());

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
  const pending = deferred<{ stamp: string | null; revision: string | null }>();
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
  await act(async () => pending.resolve({ stamp: changedStamp, revision: "appended-revision" }));

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
  expect(getFileFreshness(tabId).verifiedRevision).toBe("appended-revision");
});

test("a failed storage flush aborts append, clears its marker, and reports persistence failure", async () => {
  mocks.readFileGame.mockResolvedValueOnce(stampedGame(changedStamp));
  await setup({ dirty: true, persisted: true });
  await vi.waitFor(() => expect(getFileFreshness(tabId).state).toBe("conflict"));
  const storageError = new Error("session storage quota exceeded");
  const flush = vi.spyOn(tabStorage, "flush").mockImplementation(({ notify = false } = {}) => {
    if (notify) mocks.reportPersistError(storageError);
    return [tabId];
  });

  await act(async () => button("FileFreshness.SaveAsNewGame").click());

  expect(mocks.writeGame).not.toHaveBeenCalled();
  expect(treeStore.getState().appendAttempted).toBe(false);
  expect(flush.mock.calls[1]?.[0]).toEqual({ notify: true });
  expect(mocks.reportPersistError).toHaveBeenCalledWith(storageError);
  expect(host.textContent).toContain("FileFreshness.CouldNotPrepareAppend");
  flush.mockRestore();
  tabStorage.flush();
});

test("physical-key marker refusal prevents native append for a distinct logical owner", async () => {
  const treeKey = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
  mocks.readFileGame.mockResolvedValueOnce(stampedGame(changedStamp));
  await setup({ dirty: true, persisted: true, tab: { ...fileTab, treeKey } });
  await vi.waitFor(() => expect(getFileFreshness(tabId).state).toBe("conflict"));
  const set = Storage.prototype.setItem;
  const refuse = vi
    .spyOn(Storage.prototype, "setItem")
    .mockImplementation(function (this: Storage, key, value) {
      if (key === treeKey) throw new DOMException("full", "QuotaExceededError");
      return set.call(this, key, value);
    });
  await act(async () => button("FileFreshness.SaveAsNewGame").click());
  expect(mocks.writeGame).not.toHaveBeenCalled();
  expect(treeStore.getState().appendAttempted).toBe(false);
  expect(host.textContent).toContain("FileFreshness.CouldNotPrepareAppend");
  refuse.mockRestore();
  expect(tabStorage.flush()).toEqual([]);
});

test("an uncertain append stays disabled across a persisted restart marker", async () => {
  mocks.readFileGame.mockResolvedValueOnce(stampedGame(changedStamp));
  await setup({ dirty: true, persisted: true });
  await vi.waitFor(() => expect(getFileFreshness(tabId).state).toBe("conflict"));
  mocks.writeGame.mockResolvedValueOnce({ stamp: null, revision: null });

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

test.each([
  ["reload", "invalid-input", "unavailable"],
  ["append", "invalid-input", "unavailable"],
  ["reload", "io", "conflict"],
  ["append", "io", "conflict"],
] as const)(
  "%s action failures with %s keep the expected freshness panel",
  async (action, category, state) => {
    mocks.readFileGame.mockResolvedValueOnce(stampedGame(changedStamp));
    await setup({ dirty: true });
    await vi.waitFor(() => expect(getFileFreshness(tabId).state).toBe("conflict"));
    const message = `${action} ${category} failure`;
    const failure = { tag: "backend-error", category, message };
    if (action === "reload") mocks.loadFileGame.mockRejectedValueOnce(failure);
    else mocks.writeGame.mockRejectedValueOnce(failure);

    await act(async () =>
      button(
        action === "reload" ? "FileFreshness.ReloadFromDisk" : "FileFreshness.SaveAsNewGame",
      ).click(),
    );

    await vi.waitFor(() => expect(getFileFreshness(tabId).state).toBe(state));
    expect(host.textContent).toContain(message);
    expect(host.querySelector('[data-testid="board-and-panels"]')).toBeNull();
  },
);

test("the appending state withholds children and starts no reconcile", async () => {
  await setup({ freshness: "appending" });
  expect(host.querySelector('[data-testid="board-and-panels"]')).toBeNull();
  expect(host.textContent).toContain("FileFreshness.AddingGame");
  expect(mocks.readFileGame).not.toHaveBeenCalled();
});

test("a changed poll revision reconciles a mounted gate before restoring its board", async () => {
  vi.useFakeTimers();
  await setup({ freshness: "verified" });
  mocks.readFileGame.mockResolvedValueOnce(
    stampedGame(changedStamp, '[Event "Fresh from disk"]\n\n1. d4 *'),
  );
  const fileRevision = vi.fn(async () => "fresh-revision");
  const stop = startFileRevisionPoll({
    getTabs: () => jotaiStore.get(tabsAtom),
    fileRevision,
    subscribeFocus: () => () => undefined,
  });

  await act(async () => vi.advanceTimersByTimeAsync(2_000));

  expect(fileRevision).toHaveBeenCalledOnce();
  expect(mocks.readFileGame).toHaveBeenCalledOnce();
  expect(getFileFreshness(tabId).state).toBe("verified");
  expect(treeStore.getState().sourceStamp).toBe(changedStamp);
  expect(treeStore.getState().headers.event).toBe("Fresh from disk");
  expect(host.querySelector('[data-testid="board-and-panels"]')).not.toBeNull();
  stop();
});

test("one changed shared handle reconciles every mounted tab that references it", async () => {
  vi.useFakeTimers();
  const secondTab: Tab = { ...fileTab, value: sharedTabId, name: "Shared game copy" };
  const firstTree = defaultTree();
  firstTree.sourceStamp = originalStamp;
  const secondTree = defaultTree();
  secondTree.sourceStamp = originalStamp;
  treeStore = createTreeStore(undefined, firstTree);
  const secondStore = createTreeStore(undefined, secondTree);
  jotaiStore = createJotaiStore();
  jotaiStore.set(tabsAtom, [fileTab, secondTab], tabId);
  jotaiStore.set(activeTabAtom, tabId);
  setFileFreshness(tabId, "verified", { verifiedRevision: "old-revision" });
  setFileFreshness(sharedTabId, "verified", { verifiedRevision: "old-revision" });
  mocks.readFileGame.mockResolvedValue(
    stampedGame(changedStamp, '[Event "Shared fresh"]\n\n1. d4 *'),
  );
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(async () =>
    root.render(
      <Provider store={jotaiStore}>
        <SharedGateHarness secondTab={secondTab} secondStore={secondStore} />
      </Provider>,
    ),
  );
  const fileRevision = vi.fn(async () => "new-revision");
  const stop = startFileRevisionPoll({
    getTabs: () => jotaiStore.get(tabsAtom),
    fileRevision,
    subscribeFocus: () => () => undefined,
  });

  await act(async () => vi.advanceTimersByTimeAsync(2_000));

  expect(fileRevision).toHaveBeenCalledOnce();
  expect(mocks.readFileGame).toHaveBeenCalledTimes(2);
  expect(getFileFreshness(tabId).state).toBe("verified");
  expect(getFileFreshness(sharedTabId).state).toBe("verified");
  expect(treeStore.getState().sourceStamp).toBe(changedStamp);
  expect(secondStore.getState().sourceStamp).toBe(changedStamp);
  expect(host.querySelector('[data-testid="first-shared-board"]')).not.toBeNull();
  expect(host.querySelector('[data-testid="second-shared-board"]')).not.toBeNull();
  stop();
});

test("a poll result during a held append is deferred and starts no reconcile read", async () => {
  vi.useFakeTimers();
  await setup({ freshness: "appending" });
  const append = deferred<void>();
  const appendSettled = append.promise.then(() => setFileFreshness(tabId, "unverified"));
  mocks.readFileGame.mockResolvedValueOnce(
    stampedGame(changedStamp, '[Event "Fresh after append"]\n\n1. d4 *'),
  );
  const fileRevision = vi.fn(async () => "new-revision");
  const stop = startFileRevisionPoll({
    getTabs: () => jotaiStore.get(tabsAtom),
    fileRevision,
    subscribeFocus: () => () => undefined,
  });

  await act(async () => vi.advanceTimersByTimeAsync(2_000));
  expect(fileRevision).toHaveBeenCalledOnce();
  expect(getFileFreshness(tabId).state).toBe("appending");
  expect(mocks.readFileGame).not.toHaveBeenCalled();
  expect(host.querySelector('[data-testid="board-and-panels"]')).toBeNull();

  await act(async () => {
    append.resolve();
    await appendSettled;
    for (let turn = 0; turn < 8; turn += 1) await Promise.resolve();
  });

  expect(mocks.readFileGame).toHaveBeenCalledOnce();
  expect(getFileFreshness(tabId).state).toBe("verified");
  expect(treeStore.getState().sourceStamp).toBe(changedStamp);
  expect(host.querySelector('[data-testid="board-and-panels"]')).not.toBeNull();
  stop();
});

test("a generic poll rejection keeps the gate withheld with its message and Retry", async () => {
  vi.useFakeTimers();
  await setup({ freshness: "verified" });
  const pendingRead = deferred<ReturnType<typeof stampedGame>>();
  mocks.readFileGame.mockReturnValueOnce(pendingRead.promise);
  const fileRevision = vi.fn(async () => {
    throw {
      tag: "backend-error",
      category: "io",
      message: "revision access failed",
    };
  });
  const stop = startFileRevisionPoll({
    getTabs: () => jotaiStore.get(tabsAtom),
    fileRevision,
    subscribeFocus: () => () => undefined,
  });

  await act(async () => vi.advanceTimersByTimeAsync(2_000));

  expect(getFileFreshness(tabId)).toMatchObject({
    state: "unverified",
    errorMessage: "revision access failed",
  });
  expect(mocks.readFileGame).toHaveBeenCalledOnce();
  expect(host.textContent).toContain("revision access failed");
  expect(host.textContent).toContain("FileFreshness.Retry");
  expect(host.querySelector('[data-testid="board-and-panels"]')).toBeNull();

  stop();
  await act(async () => {
    pendingRead.reject(new Error("read settled after stop"));
    for (let turn = 0; turn < 8; turn += 1) await Promise.resolve();
  });
});

test("an unverified reconcile completes after five seconds of poll outcomes", async () => {
  vi.useFakeTimers();
  const pendingRead = deferred<ReturnType<typeof stampedGame>>();
  mocks.readFileGame.mockReturnValueOnce(pendingRead.promise);
  await setup({ freshness: "unverified" });
  const initial = getFileFreshness(tabId);
  const fileRevision = vi.fn().mockResolvedValueOnce("poll-revision-1").mockRejectedValueOnce({
    tag: "backend-error",
    category: "io",
    message: "first poll failure",
  });
  const stop = startFileRevisionPoll({
    getTabs: () => jotaiStore.get(tabsAtom),
    fileRevision,
    subscribeFocus: () => () => undefined,
  });

  await act(async () => vi.advanceTimersByTimeAsync(2_000));
  expect(getFileFreshness(tabId)).toMatchObject({ state: "unverified", epoch: initial.epoch });
  expect(mocks.readFileGame).toHaveBeenCalledOnce();

  await act(async () => vi.advanceTimersByTimeAsync(2_000));
  expect(getFileFreshness(tabId)).toMatchObject({
    state: "unverified",
    errorMessage: "first poll failure",
    epoch: initial.epoch,
  });
  expect(mocks.readFileGame).toHaveBeenCalledOnce();

  await act(async () => {
    await vi.advanceTimersByTimeAsync(1_000);
    pendingRead.resolve(stampedGame(originalStamp));
    for (let turn = 0; turn < 12; turn += 1) await Promise.resolve();
  });

  expect(getFileFreshness(tabId)).toMatchObject({
    state: "verified",
    verifiedRevision: "device:inode:revision",
  });
  expect(mocks.readFileGame).toHaveBeenCalledOnce();
  expect(host.querySelector('[data-testid="board-and-panels"]')).not.toBeNull();
  stop();
});

test("an overdue poll withholds without a gate read until a settled request gets a fresh answer", async () => {
  vi.useFakeTimers();
  await setup({ freshness: "verified" });
  const first = deferred<string>();
  const signals: AbortSignal[] = [];
  const fileRevision = vi.fn((_handle, options: { signal: AbortSignal }) => {
    signals.push(options.signal);
    return signals.length === 1 ? first.promise : Promise.resolve("fresh-revision");
  });
  mocks.readFileGame.mockResolvedValueOnce(
    stampedGame(changedStamp, '[Event "Fresh after timeout"]\n\n1. d4 *'),
  );
  const stop = startFileRevisionPoll({
    getTabs: () => jotaiStore.get(tabsAtom),
    fileRevision,
    subscribeFocus: () => () => undefined,
  });

  await act(async () => vi.advanceTimersByTimeAsync(2_000));
  await act(async () => vi.advanceTimersByTimeAsync(2_000));
  expect(signals[0].aborted).toBe(true);
  expect(fileRevision).toHaveBeenCalledOnce();
  expect(getFileFreshness(tabId).state).toBe("overdue");
  expect(host.textContent).toContain("FileFreshness.FileNotResponding");
  expect(host.querySelector('[data-testid="board-and-panels"]')).toBeNull();
  expect(mocks.readFileGame).not.toHaveBeenCalled();

  await act(async () => {
    first.reject(new Error("native cancellation settled"));
    for (let turn = 0; turn < 12; turn += 1) await Promise.resolve();
  });

  expect(fileRevision).toHaveBeenCalledTimes(2);
  expect(mocks.readFileGame).toHaveBeenCalledOnce();
  expect(getFileFreshness(tabId).state).toBe("verified");
  expect(treeStore.getState().sourceStamp).toBe(changedStamp);
  expect(treeStore.getState().headers.event).toBe("Fresh after timeout");
  expect(host.querySelector('[data-testid="board-and-panels"]')).not.toBeNull();
  stop();
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

test("a pending reload cannot overwrite a replacement with only its physical generation changed", async () => {
  mocks.readFileGame.mockResolvedValueOnce(stampedGame(changedStamp));
  await setup({ dirty: true, persisted: true });
  await vi.waitFor(() => expect(getFileFreshness(tabId).state).toBe("conflict"));
  const pendingLoad =
    deferred<Awaited<ReturnType<(typeof import("@/utils/files"))["loadFileGame"]>>>();
  mocks.loadFileGame.mockReturnValueOnce(pendingLoad.promise);
  await act(async () => button("FileFreshness.ReloadFromDisk").click());
  expect(mocks.loadFileGame).toHaveBeenCalledWith(file.handle, 0, expect.any(AbortSignal));
  const signal = mocks.loadFileGame.mock.calls[0]![2] as AbortSignal;
  const originalTab = jotaiStore.get(tabsAtom)[0]!;
  const candidate = defaultTree();
  candidate.headers.event = "Replacement generation";
  candidate.sourceStamp = "c".repeat(64);
  const treeKey = crypto.randomUUID();
  tabStorage.seed(treeKey, candidate);
  await act(async () => {
    expect(
      jotaiStore.set(tabsAtom, [{ ...originalTab, treeKey }], undefined, () =>
        retargetTreeStore(tabId, treeKey, candidate),
      ),
    ).toBe(true);
    setFileFreshness(tabId, "verified", { verifiedRevision: "replacement-generation" });
  });
  expect(signal.aborted).toBe(false);
  expect(createTreeStore(tabId)).toBe(treeStore);
  expect(jotaiStore.get(tabsAtom)[0]?.gameOrigin).toEqual(originalTab.gameOrigin);
  const current = treeStore.getState();
  const freshness = getFileFreshness(tabId);
  const old = defaultTree();
  old.headers.event = "Obsolete reload";
  old.sourceStamp = changedStamp;
  await act(async () => pendingLoad.resolve({ ...stampedGame(changedStamp), tree: old }));
  expect(treeStore.getState()).toBe(current);
  expect(getFileFreshness(tabId)).toBe(freshness);
  expect(treeStore.getState().headers.event).toBe("Replacement generation");
  expect(host.querySelector('[data-testid="board-and-panels"]')).not.toBeNull();
});

const reloadFailures = ["missing-resource", "invalid-input", "conflict", "io"] as const;

async function startPendingReload() {
  mocks.readFileGame.mockResolvedValueOnce(stampedGame(changedStamp));
  await setup({ dirty: true, persisted: true });
  await vi.waitFor(() => expect(getFileFreshness(tabId).state).toBe("conflict"));
  const pendingLoad =
    deferred<Awaited<ReturnType<(typeof import("@/utils/files"))["loadFileGame"]>>>();
  mocks.loadFileGame.mockReturnValueOnce(pendingLoad.promise);
  await act(async () => button("FileFreshness.ReloadFromDisk").click());
  expect(mocks.loadFileGame).toHaveBeenCalledWith(file.handle, 0, expect.any(AbortSignal));
  const signal = mocks.loadFileGame.mock.calls[0]![2] as AbortSignal;
  expect(signal.aborted).toBe(false);
  return { pendingLoad, signal };
}

test.each(reloadFailures)(
  "obsolete physical-generation reload rejection with %s preserves its durable replacement",
  async (category) => {
    const { pendingLoad, signal } = await startPendingReload();
    const originalTab = jotaiStore.get(tabsAtom)[0]!;
    const candidate = defaultTree();
    candidate.headers.event = "Durable rejection replacement";
    candidate.root.comment = "Replacement comment";
    candidate.sourceStamp = "c".repeat(64);
    const treeKey = crypto.randomUUID();
    tabStorage.seed(treeKey, candidate);
    expect(new TabStorageRepository().read(treeKey)?.state).toEqual(candidate);
    await act(async () => {
      expect(
        jotaiStore.set(tabsAtom, [{ ...originalTab, treeKey }], undefined, () =>
          retargetTreeStore(tabId, treeKey, candidate),
        ),
      ).toBe(true);
      setFileFreshness(tabId, "verified", { verifiedRevision: "replacement-generation" });
    });
    expect(treeKey).not.toBe(getTabTreeKey(originalTab));
    expect(jotaiStore.get(tabsAtom)).toEqual([{ ...originalTab, treeKey }]);
    expect(jotaiStore.get(activeTabAtom)).toBe(tabId);
    expect(createTreeStore(tabId)).toBe(treeStore);
    expect(signal.aborted).toBe(false);
    expect(tabStorage.flush()).toEqual([]);
    const durableTree = { ...candidate, practicePath: null };
    expect(new TabStorageRepository().read(treeKey)?.state).toEqual(durableTree);
    const durableBytes = sessionStorage.getItem(treeKey);
    expect(durableBytes).not.toBeNull();
    const current = treeStore.getState();
    const freshness = getFileFreshness(tabId);
    const message = `obsolete reload ${category} failure`;

    await act(async () => pendingLoad.reject({ tag: "backend-error", category, message }));

    expect(signal.aborted).toBe(false);
    expect(treeStore.getState()).toBe(current);
    expect(getFileFreshness(tabId)).toBe(freshness);
    expect(host.querySelector('[data-testid="board-and-panels"]')).not.toBeNull();
    expect(host.textContent).not.toContain(message);
    expect(tabStorage.flush()).toEqual([]);
    expect(sessionStorage.getItem(treeKey)).toBe(durableBytes);
    expect(new TabStorageRepository().read(treeKey)?.state).toEqual(durableTree);
    // A verified board hides the panel, so reveal it to detect a retained stale error.
    await act(async () => setFileFreshness(tabId, "conflict", { conflictReason: "changed" }));
    expect(host.textContent).toContain("FileFreshness.Changed");
    expect(host.textContent).not.toContain(message);
    expect(button("FileFreshness.ReloadFromDisk").disabled).toBe(false);
    expect(treeStore.getState()).toBe(current);
  },
);

test.each(reloadFailures)(
  "current-owner reload rejection with %s surfaces its error",
  async (category) => {
    const { pendingLoad, signal } = await startPendingReload();
    const current = treeStore.getState();
    const message = `current reload ${category} failure`;
    await act(async () => pendingLoad.reject({ tag: "backend-error", category, message }));

    expect(signal.aborted).toBe(false);
    expect(treeStore.getState()).toBe(current);
    expect(getFileFreshness(tabId).state).toBe(category === "io" ? "conflict" : "unavailable");
    expect(host.textContent).toContain(message);
    expect(host.querySelector('[data-testid="board-and-panels"]')).toBeNull();
    expect(button("FileFreshness.SaveAsNewGame").disabled).toBe(false);
  },
);

test("unmount aborts a pending reload and suppresses its late rejection", async () => {
  const { pendingLoad, signal } = await startPendingReload();
  const current = treeStore.getState();
  const freshness = getFileFreshness(tabId);
  await act(async () => root.unmount());
  expect(signal.aborted).toBe(true);

  await act(async () =>
    pendingLoad.reject({
      tag: "backend-error",
      category: "missing-resource",
      message: "late unmounted reload failure",
    }),
  );

  expect(treeStore.getState()).toBe(current);
  expect(getFileFreshness(tabId)).toBe(freshness);
  expect(host.textContent).toBe("");
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

const appendFailures = ["stale-game", ...reloadFailures] as const;
const appendFulfillments = [
  "stamped",
  "unknown-stamp",
  "unknown-revision",
  "unknown-both",
] as const;
const appendOutcomes = [...appendFulfillments, ...appendFailures] as const;
type AppendOutcome = (typeof appendOutcomes)[number];
type AppendResult = { stamp: string | null; revision: string | null };

async function startPendingAppend(registered = false) {
  mocks.readFileGame.mockResolvedValueOnce(stampedGame(changedStamp));
  await setup({ dirty: true, persisted: true });
  await vi.waitFor(() => expect(getFileFreshness(tabId).state).toBe("conflict"));
  const signalGetter = Object.getOwnPropertyDescriptor(AbortController.prototype, "signal")!.get!;
  const signals = new Set<AbortSignal>();
  const capture = vi
    .spyOn(AbortController.prototype, "signal", "get")
    .mockImplementation(function (this: AbortController) {
      const signal = signalGetter.call(this) as AbortSignal;
      signals.add(signal);
      return signal;
    });
  const pending = deferred<AppendResult>();
  mocks.writeGame.mockReturnValueOnce(pending.promise);
  let completion: Promise<{ result: boolean } | { error: unknown }> | undefined;
  await act(async () => {
    if (registered) {
      completion = saveFileConflictVersion(tabId).then(
        (result) => ({ result }),
        (error: unknown) => ({ error }),
      );
    } else button("FileFreshness.SaveAsNewGame").click();
  });
  capture.mockRestore();
  expect(signals.size).toBe(1);
  const signal = [...signals][0]!;
  expect(signal.aborted).toBe(false);
  expect(mocks.writeGame).toHaveBeenCalledWith(file.handle, 7, serializeStoreTree(treeStore), {
    kind: "append",
  });
  expect(new TabStorageRepository().read(tabId)?.state).toMatchObject({
    appendAttempted: true,
    dirty: true,
  });
  return { pending, signal, completion };
}

async function installAppendReplacement(appendAttempted: boolean) {
  const originalTab = jotaiStore.get(tabsAtom)[0]!;
  const candidate = defaultTree();
  candidate.headers.event = "Durable append replacement";
  candidate.root.comment = "Replacement append comment";
  candidate.sourceStamp = "c".repeat(64);
  candidate.appendAttempted = appendAttempted;
  const treeKey = crypto.randomUUID();
  tabStorage.seed(treeKey, candidate);
  expect(new TabStorageRepository().read(treeKey)?.state).toEqual(candidate);
  await act(async () => {
    expect(
      jotaiStore.set(tabsAtom, [{ ...originalTab, treeKey }], undefined, () =>
        retargetTreeStore(tabId, treeKey, candidate),
      ),
    ).toBe(true);
    setFileFreshness(tabId, "verified", { verifiedRevision: "append-replacement-generation" });
  });
  expect(treeKey).not.toBe(getTabTreeKey(originalTab));
  expect(jotaiStore.get(tabsAtom)).toEqual([{ ...originalTab, treeKey }]);
  expect(jotaiStore.get(activeTabAtom)).toBe(tabId);
  expect(createTreeStore(tabId)).toBe(treeStore);
  expect(tabStorage.flush()).toEqual([]);
  const durableTree = { ...candidate, practicePath: null };
  expect(new TabStorageRepository().read(treeKey)?.state).toEqual(durableTree);
  const durableBytes = sessionStorage.getItem(treeKey);
  expect(durableBytes).not.toBeNull();
  return {
    treeKey,
    durableTree,
    durableBytes,
    current: treeStore.getState(),
    freshness: getFileFreshness(tabId),
    tabs: jotaiStore.get(tabsAtom),
    workspaceBytes: sessionStorage.getItem(WORKSPACE_STORAGE_KEY),
  };
}

function settleAppend(pending: ReturnType<typeof deferred<AppendResult>>, outcome: AppendOutcome) {
  if (outcome === "stamped" || outcome.startsWith("unknown-")) {
    pending.resolve({
      stamp: outcome === "unknown-stamp" || outcome === "unknown-both" ? null : changedStamp,
      revision:
        outcome === "unknown-revision" || outcome === "unknown-both" ? null : "obsolete-append",
    });
  } else {
    pending.reject({ tag: "backend-error", category: outcome, message: `late append ${outcome}` });
  }
}

function expectAppendReplacement(
  replacement: Awaited<ReturnType<typeof installAppendReplacement>>,
) {
  expect(treeStore.getState()).toBe(replacement.current);
  expect(getFileFreshness(tabId)).toBe(replacement.freshness);
  expect(jotaiStore.get(tabsAtom)).toBe(replacement.tabs);
  expect(replacement.workspaceBytes).not.toBeNull();
  expect(sessionStorage.getItem(WORKSPACE_STORAGE_KEY)).toBe(replacement.workspaceBytes);
  expect(treeStore.getState()).toMatchObject({
    headers: { event: "Durable append replacement" },
    root: { comment: "Replacement append comment" },
    sourceStamp: "c".repeat(64),
    appendAttempted: replacement.durableTree.appendAttempted,
  });
  expect(tabStorage.flush()).toEqual([]);
  expect(sessionStorage.getItem(replacement.treeKey)).toBe(replacement.durableBytes);
  expect(new TabStorageRepository().read(replacement.treeKey)?.state).toEqual(
    replacement.durableTree,
  );
}

test.each(appendOutcomes)(
  "obsolete physical-generation append outcome %s leaves its durable replacement and later panel intact",
  async (outcome) => {
    const { pending, signal } = await startPendingAppend();
    // A nonempty replacement marker catches stale-count rejection clearing a new owner's uncertainty.
    const replacement = await installAppendReplacement(outcome === "stale-game");
    expect(signal.aborted).toBe(false);

    await act(async () => settleAppend(pending, outcome));

    expect(signal.aborted).toBe(false);
    expectAppendReplacement(replacement);
    expect(host.querySelector('[data-testid="board-and-panels"]')).not.toBeNull();
    await act(async () => setFileFreshness(tabId, "conflict", { conflictReason: "changed" }));
    expect(host.textContent).toContain("FileFreshness.Changed");
    expect(host.textContent).not.toContain(`late append ${outcome}`);
    expect(host.textContent).not.toContain("FileFreshness.AppendChanged");
    const uncertaintyMessages = Array.from(host.querySelectorAll("p")).filter(
      (element) => element.textContent === "FileFreshness.AppendMayHaveBeenAdded",
    );
    expect(uncertaintyMessages).toHaveLength(outcome === "stale-game" ? 1 : 0);
    expect(button("FileFreshness.SaveAsNewGame").disabled).toBe(outcome === "stale-game");
    expect(button("FileFreshness.ReloadFromDisk").disabled).toBe(false);
    expect(treeStore.getState()).toBe(replacement.current);
  },
);

test.each(["stale-game", "io"] as const)(
  "registered append returns false for an obsolete %s rejection without damaging its replacement",
  async (outcome) => {
    const { pending, signal, completion } = await startPendingAppend(true);
    const replacement = await installAppendReplacement(true);
    await act(async () => settleAppend(pending, outcome));
    expect(await completion).toEqual({ result: false });
    expect(signal.aborted).toBe(false);
    expectAppendReplacement(replacement);
  },
);

test.each(appendOutcomes)(
  "unmount cancels a pending registered append and silences its late %s outcome",
  async (outcome) => {
    const { pending, signal, completion } = await startPendingAppend(true);
    expect(tabStorage.flush()).toEqual([]);
    const current = treeStore.getState();
    const freshness = getFileFreshness(tabId);
    new TabStorageRepository().read(tabId);
    const durableBytes = sessionStorage.getItem(tabId);
    await act(async () => root.unmount());
    expect(signal.aborted).toBe(true);

    await act(async () => settleAppend(pending, outcome));

    expect(await completion).toEqual({ result: false });
    expect(treeStore.getState()).toBe(current);
    expect(getFileFreshness(tabId)).toBe(freshness);
    expect(tabStorage.flush()).toEqual([]);
    expect(sessionStorage.getItem(tabId)).toBe(durableBytes);
    expect(host.textContent).toBe("");
  },
);

test.each(appendFailures)(
  "current-owner registered append rejection %s publishes its error and propagates failure",
  async (category) => {
    const { pending, signal, completion } = await startPendingAppend(true);
    await act(async () => settleAppend(pending, category));

    expect(await completion).toMatchObject({
      error: { backendCategory: category, message: `late append ${category}` },
    });
    expect(signal.aborted).toBe(false);
    expect(treeStore.getState().appendAttempted).toBe(category !== "stale-game");
    expect(new TabStorageRepository().read(tabId)?.state).toMatchObject({
      appendAttempted: category !== "stale-game",
      dirty: true,
      sourceStamp: originalStamp,
    });
    expect(getFileFreshness(tabId).state).toBe(
      category === "stale-game" || category === "io" ? "conflict" : "unavailable",
    );
    expect(host.textContent).toContain(
      category === "stale-game" ? "FileFreshness.AppendChanged" : `late append ${category}`,
    );
    expect(button("FileFreshness.SaveAsNewGame").disabled).toBe(category !== "stale-game");
  },
);

test.each(appendFulfillments.slice(1))(
  "current-owner %s append persists retry prohibition through a cold store restart",
  async (outcome) => {
    const { pending, completion } = await startPendingAppend(true);
    await act(async () => settleAppend(pending, outcome));
    expect(await completion).toEqual({ result: false });
    expect(host.textContent).toContain("FileFreshness.AppendMayHaveBeenAdded");
    expect(tabStorage.flush()).toEqual([]);
    expect(new TabStorageRepository().read(tabId)?.state).toMatchObject({ appendAttempted: true });
    const previousStore = treeStore;
    await act(async () => root.unmount());
    closeTreeStore(tabId);
    treeStore = createTreeStore(tabId);
    expect(treeStore).not.toBe(previousStore);
    expect(treeStore.getState()).toMatchObject({
      appendAttempted: true,
      dirty: true,
      headers: { event: "Unsaved edit" },
      sourceStamp: originalStamp,
    });
    root = createRoot(host);
    await act(async () => {
      setFileFreshness(tabId, "unverified");
      root.render(
        <Provider store={jotaiStore}>
          <Harness closeTab={() => undefined} />
        </Provider>,
      );
    });
    expect(host.querySelector('[data-testid="board-and-panels"]')).toBeNull();
    expect(button("FileFreshness.SaveAsNewGame").disabled).toBe(true);
    await act(async () => button("FileFreshness.SaveAsNewGame").click());
    expect(await saveFileConflictVersion(tabId)).toBe(false);
    expect(mocks.writeGame).toHaveBeenCalledOnce();
    expect(new TabStorageRepository().read(tabId)?.state).toMatchObject({ appendAttempted: true });
  },
);

test("current-owner stale-count rejection allows a real second append and verified save", async () => {
  const { pending, completion } = await startPendingAppend(true);
  await act(async () => settleAppend(pending, "stale-game"));
  expect(await completion).toMatchObject({ error: { backendCategory: "stale-game" } });
  expect(button("FileFreshness.SaveAsNewGame").disabled).toBe(false);
  await act(async () => button("FileFreshness.SaveAsNewGame").click());
  expect(mocks.writeGame).toHaveBeenCalledTimes(2);
  expect(treeStore.getState()).toMatchObject({
    appendAttempted: false,
    dirty: false,
    sourceStamp: changedStamp,
  });
  expect(getFileFreshness(tabId)).toMatchObject({
    state: "verified",
    verifiedRevision: "new-revision",
  });
  expect(jotaiStore.get(tabsAtom)[0]?.gameOrigin).toMatchObject({
    gameNumber: 7,
    file: { numGames: 8 },
  });
});

test("registered append propagates a physical marker flush refusal without a native write", async () => {
  const treeKey = crypto.randomUUID();
  mocks.readFileGame.mockResolvedValueOnce(stampedGame(changedStamp));
  await setup({ dirty: true, persisted: true, tab: { ...fileTab, treeKey } });
  const set = Storage.prototype.setItem;
  const refuse = vi
    .spyOn(Storage.prototype, "setItem")
    .mockImplementation(function (this: Storage, key, value) {
      if (key === treeKey) throw new DOMException("append marker refused", "QuotaExceededError");
      return set.call(this, key, value);
    });
  await act(async () => {
    await expect(saveFileConflictVersion(tabId)).rejects.toMatchObject({
      message: "FileFreshness.CouldNotPrepareAppend",
    });
  });
  expect(mocks.writeGame).not.toHaveBeenCalled();
  expect(mocks.reportPersistError).toHaveBeenCalled();
  expect(treeStore.getState().appendAttempted).toBe(false);
  expect(host.textContent).toContain("FileFreshness.CouldNotPrepareAppend");
  expect(button("FileFreshness.SaveAsNewGame").disabled).toBe(false);
  refuse.mockRestore();
  expect(tabStorage.flush()).toEqual([]);
  expect(new TabStorageRepository().read(treeKey)?.state).toMatchObject({ appendAttempted: false });
});

test("shared gate ownership keeps recovery's effective-key fallback and file-kind flexibility", async () => {
  const { pendingLoad, signal } = await startPendingReload();
  const owner = jotaiStore.get(tabsAtom)[0]!;
  if (owner.gameOrigin.kind !== "file") throw new Error("Expected file owner");
  const capturedOrigin = owner.gameOrigin;
  await act(async () => {
    expect(
      jotaiStore.set(tabsAtom, [
        {
          ...owner,
          treeKey: owner.value,
          name: "Current metadata",
          gameOrigin: { ...capturedOrigin, kind: "temp_file" },
        },
      ]),
    ).toBe(true);
  });
  expect(signal.aborted).toBe(false);
  const tree = defaultTree();
  tree.headers.event = "Current recovery";
  tree.sourceStamp = changedStamp;
  await act(async () => pendingLoad.resolve({ ...stampedGame(changedStamp), tree }));
  expect(treeStore.getState()).toMatchObject({
    sourceStamp: changedStamp,
    headers: { event: "Current recovery" },
  });
  expect(jotaiStore.get(tabsAtom)[0]).toMatchObject({
    name: "Current metadata",
    treeKey: owner.value,
    gameOrigin: { kind: "temp_file" },
  });
  expect(getFileFreshness(tabId).state).toBe("verified");
  expect(host.querySelector('[data-testid="board-and-panels"]')).not.toBeNull();
});
