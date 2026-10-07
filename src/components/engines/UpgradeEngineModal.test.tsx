import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { createStore, Provider } from "jotai";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { enginesAtom } from "@/state/atoms";
import { resetEngineOwnerCoordinatorForTests } from "@/state/engineOwnerStorage";
import { serializeStorageValue, decodeCompressedOrJson } from "@/state/store/debouncedStorage";
import {
  EngineCapabilityQueryError,
  EngineCatalogVerificationError,
  type DefaultEngine,
  type LocalEngine,
} from "@/utils/engines";
import type { EngineConfig } from "@/bindings";
import UpgradeEngineModal from "./UpgradeEngineModal";

const mocks = vi.hoisted(() => ({
  download: vi.fn(),
  register: vi.fn(),
  config: vi.fn(),
  retire: vi.fn(),
  reconcile: vi.fn(),
  cancel: vi.fn(),
  cancelDownloadForProgress: vi.fn(),
  clear: vi.fn(),
  report: vi.fn(),
  notify: vi.fn(),
  notificationShow: vi.fn(),
  getEngineWorkspace: vi.fn(),
  close: undefined as (() => void) | undefined,
  catalogError: undefined as unknown,
  progress: new Map<string, number>(),
}));
vi.mock("@/platform/tauri", async (original) => ({
  ...(await original<typeof import("@/platform/tauri")>()),
  withDownloadTicket: (run: (ticket: string) => Promise<unknown>) => run("ticket"),
  tauri: {
    getEngineWorkspace: mocks.getEngineWorkspace,
    engineArchiveDestination: async () => ({ id: "destination" }),
    downloadEngineArchive: mocks.download,
    registerInstalledEngine: mocks.register,
    getEngineConfig: mocks.config,
    retireEngineBinary: mocks.retire,
    reconcileEngineAttachments: mocks.reconcile,
    cancelDownload: mocks.cancel,
    cancelDownloadForProgress: mocks.cancelDownloadForProgress,
    clearProgress: mocks.clear,
  },
}));
vi.mock("@/utils/engines", async (original) => ({
  ...(await original<typeof import("@/utils/engines")>()),
  useDefaultEngines: () => ({
    defaultEngines: [catalog],
    error: mocks.catalogError,
    isLoading: false,
  }),
}));
vi.mock("@/utils/files", () => ({ usePlatform: () => ({ os: "linux" }) }));
vi.mock("@/state/persistError", () => ({ reportPersistError: mocks.report }));
vi.mock("@/platform/native", () => ({
  warn: vi.fn().mockResolvedValue(undefined),
  error: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/components/files/notifyError", async (original) => {
  const actual = await original<typeof import("@/components/files/notifyError")>();
  const { errorUnlessCancelled } = await import("@/platform/errors");
  return {
    ...actual,
    notifyUnlessCancelled: (
      title: string,
      cause: unknown,
      domain?: import("@/components/files/listingFailure").RootFailureDomain,
    ) => {
      if (errorUnlessCancelled(cause) !== null) mocks.notify(title, cause);
      actual.notifyUnlessCancelled(title, cause, domain);
    },
  };
});
vi.mock("@mantine/notifications", () => ({ notifications: { show: mocks.notificationShow } }));
vi.mock("@/i18n", async (original) => ({
  ...(await original<typeof import("@/i18n")>()),
  default: {
    t: (key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? key,
  },
}));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@/hooks/useProgress", () => ({
  useProgress: (id: string) => ({
    progress: mocks.progress.get(id) ?? 0,
    finished: mocks.progress.get(id) === 100,
    isActive: mocks.progress.has(id) && mocks.progress.get(id) !== 100,
    item: mocks.progress.has(id)
      ? { generation: 1n, state: mocks.progress.get(id) === 100 ? "succeeded" : "running" }
      : null,
    clear: () => mocks.clear(id),
    fence: vi.fn(),
  }),
}));
vi.mock("../common/AppModal", () => ({
  default: ({ children, onClose }: { children: React.ReactNode; onClose: () => void }) => {
    mocks.close = onClose;
    return <div>{children}</div>;
  },
}));
vi.mock("../common/IconAction", () => ({
  default: ({ label, onClick }: { label: string; onClick: () => void }) => (
    <button onClick={onClick}>{label}</button>
  ),
}));
vi.mock("@mantine/core", () => {
  const Container = ({ children }: { children: React.ReactNode }) => <div>{children}</div>;
  return {
    Alert: Container,
    Box: Container,
    Center: Container,
    Group: Container,
    Image: () => null,
    Loader: () => null,
    Paper: Container,
    SimpleGrid: Container,
    Text: Container,
    ScrollArea: { Autosize: Container },
    Button: ({
      children,
      onClick,
      disabled,
    }: {
      children: React.ReactNode;
      onClick: () => void;
      disabled?: boolean;
    }) => (
      <button onClick={onClick} disabled={disabled}>
        {children}
      </button>
    ),
    Progress: ({ value }: { value: number }) => <output data-progress>{value}</output>,
  };
});

const old: LocalEngine = {
  id: "same-id",
  legacyAssessment: null,
  type: "local",
  name: "Stockfish 18",
  version: "18",
  filename: "old",
  handle: { id: { id: "old" }, kind: "engine" },
  go: { t: "Infinite" },
  settings: [
    { type: "string", name: "Threads", value: "20" },
    { type: "string", name: "Hash", value: "8192" },
    { type: "string", name: "MultiPV", value: "4" },
    {
      type: "resource",
      name: "EvalFileSmall",
      resources: [{ id: { id: "small" }, kind: "file", displayName: "small.nnue" }],
    },
  ],
};
const catalog: DefaultEngine = {
  type: "local",
  id: "catalog",
  name: "Stockfish",
  version: "19",
  path: "stockfish/sf19",
  os: "linux",
  bmi2: false,
  sha256: "a".repeat(64),
  signature: "sig",
  downloadLink: "https://example.com/sf19.tar.gz",
};
const config: EngineConfig = {
  name: "Stockfish 19",
  options: ["Threads", "Hash", "MultiPV"].map((name) => ({
    type: "spin",
    value: { name, default: 1n, min: 1n, max: 10000n },
  })),
};
let host: HTMLDivElement;
let root: Root;
let store: ReturnType<typeof createStore>;
const click = async (label: string) => {
  const button = [...host.querySelectorAll("button")].find((item) => item.textContent === label);
  expect(button).toBeDefined();
  await act(async () => button!.click());
};
const render = async (engine = old) => {
  await act(async () =>
    root.render(
      <Provider store={store}>
        <UpgradeEngineModal engine={engine} opened setOpened={() => undefined} />
      </Provider>,
    ),
  );
};
beforeEach(async () => {
  localStorage.clear();
  resetEngineOwnerCoordinatorForTests();
  vi.clearAllMocks();
  mocks.catalogError = undefined;
  mocks.getEngineWorkspace
    .mockReset()
    .mockResolvedValue({ id: { id: "root" }, kind: "engineRoot" });
  mocks.close = undefined;
  mocks.progress.clear();
  mocks.reconcile.mockReset().mockResolvedValue(undefined);
  mocks.download.mockReset().mockResolvedValue(undefined);
  mocks.register.mockReset().mockResolvedValue({ id: { id: "new" }, kind: "engine" });
  mocks.config.mockReset().mockResolvedValue(config);
  mocks.retire.mockReset().mockResolvedValue(undefined);
  mocks.cancel.mockReset().mockResolvedValue(true);
  mocks.cancelDownloadForProgress.mockReset().mockResolvedValue(true);
  mocks.clear.mockReset().mockImplementation(async (id: string) => {
    mocks.progress.delete(id);
    return 1n;
  });
  store = createStore();
  await store.set(enginesAtom, [old], "after-save");
  vi.clearAllMocks();
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.restoreAllMocks();
});

test("success saves once before retiring the old pair and keeps the same list position", async () => {
  const first: LocalEngine = { ...old, id: "first", name: "First engine" };
  const last: LocalEngine = { ...old, id: "last", name: "Last engine" };
  await store.set(enginesAtom, [first, old, last], "after-save");
  const events: string[] = [];
  const write = Storage.prototype.setItem;
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, key, value) {
    if (key === "engines") events.push("saved");
    write.call(this, key, value);
  });
  mocks.retire.mockImplementation(async () => {
    events.push("retired");
    expect(store.get(enginesAtom)?.[1]).toMatchObject({ handle: { id: { id: "new" } } });
  });
  await render();
  await click("Common.Install");
  expect(events).toEqual(["saved", "retired"]);
  expect(mocks.retire).toHaveBeenCalledWith(old.id, old.handle, {
    id: { id: "new" },
    kind: "engine",
  });
  const engines = store.get(enginesAtom)!;
  expect(engines).toHaveLength(3);
  expect(engines[0]).toEqual(first);
  expect(engines[1]).toMatchObject({ id: old.id, name: "Stockfish 19" });
  expect(engines[2]).toEqual(last);
  expect(mocks.notify).not.toHaveBeenCalled();
});

test("a running upgrade with no local job renders Cancel and calls native lookup", async () => {
  const id = `engine-upgrade:${old.id}:${catalog.downloadLink}`;
  await render();
  expect(host.textContent).not.toContain("Common.Cancel");
  mocks.progress.set(id, 45);
  await render();
  expect(host.querySelector("[data-progress]")?.textContent).toBe("45");
  await click("Common.Cancel");
  expect(mocks.cancelDownloadForProgress).toHaveBeenCalledExactlyOnceWith(id);
  expect(mocks.cancel).not.toHaveBeenCalled();
  expect(mocks.clear).not.toHaveBeenCalled();
  expect(mocks.download).not.toHaveBeenCalled();
  expect(store.get(enginesAtom)).toEqual([old]);
});

test.each([true, false])(
  "upgrade root acquisition displays engine errors with rootFailure=%s",
  async (labelled) => {
    mocks.getEngineWorkspace.mockRejectedValue({
      tag: "backend-error",
      category: "io",
      message: "native failure",
      ...(labelled ? { rootFailure: "missing" } : {}),
    });
    await render();
    await click("Common.Install");
    expect(mocks.notificationShow).toHaveBeenCalledExactlyOnceWith({
      color: "red",
      title: "Common.Error",
      message: labelled
        ? "This engine folder is no longer available. Choose another in Settings."
        : "native failure",
    });
    expect(mocks.download).not.toHaveBeenCalled();
    expect(store.get(enginesAtom)?.[0]).toMatchObject({ handle: old.handle });
  },
);

test("committing withdraws cancel and ignores cancellation while save, retirement and snapshot save are pending", async () => {
  const snapshotKey = "game-player1-settings";
  localStorage.setItem(
    snapshotKey,
    serializeStorageValue({ type: "engine", engine: old, go: { t: "Infinite" } }),
  );
  const oldSnapshot = localStorage.getItem(snapshotKey);
  let finishSave!: () => void;
  let finishRetirement!: () => void;
  let finishSnapshotSave!: () => void;
  mocks.reconcile
    .mockImplementationOnce(() => {
      // Invoke cancel in the save's first tick, before React can render the committing state.
      mocks.close!();
      return new Promise<void>((resolve) => {
        finishSave = resolve;
      });
    })
    .mockResolvedValueOnce(undefined)
    .mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finishSnapshotSave = resolve;
        }),
    );
  mocks.retire.mockImplementationOnce(
    () =>
      new Promise<void>((resolve) => {
        finishRetirement = resolve;
      }),
  );
  await render();
  await click("Common.Install");
  expect(finishSave).toEqual(expect.any(Function));
  expect(host.textContent).not.toContain("Common.Cancel");
  expect(host.textContent).toContain("Common.Extracting");
  expect(store.get(enginesAtom)).toEqual([old]);
  expect(mocks.retire).not.toHaveBeenCalled();
  await act(async () => mocks.close!());
  expect(mocks.cancel).not.toHaveBeenCalled();
  expect(mocks.cancelDownloadForProgress).not.toHaveBeenCalled();
  expect(mocks.clear).not.toHaveBeenCalled();

  await act(async () => finishSave());
  expect(store.get(enginesAtom)?.[0]).toMatchObject({ handle: { id: { id: "new" } } });
  expect(decodeCompressedOrJson(localStorage.getItem("engines")!)).toMatchObject([
    { id: old.id, handle: { id: { id: "new" } } },
  ]);
  expect(mocks.retire).toHaveBeenCalledWith(old.id, old.handle, {
    id: { id: "new" },
    kind: "engine",
  });
  expect(host.textContent).not.toContain("Common.Cancel");
  expect(host.textContent).not.toContain("Engines.Upgrade.Current");
  expect(host.textContent).toContain("Common.Extracting");
  await act(async () => mocks.close!());
  expect(mocks.cancel).not.toHaveBeenCalled();

  await act(async () => finishRetirement());
  expect(finishSnapshotSave).toEqual(expect.any(Function));
  expect(mocks.reconcile).toHaveBeenNthCalledWith(
    3,
    expect.objectContaining({ action: "prepare" }),
  );
  expect(localStorage.getItem(snapshotKey)).toBe(oldSnapshot);
  expect(host.textContent).not.toContain("Common.Cancel");
  expect(host.textContent).not.toContain("Engines.Upgrade.Current");
  expect(host.textContent).toContain("Common.Extracting");
  await act(async () => mocks.close!());
  expect(mocks.cancel).not.toHaveBeenCalled();
  expect(mocks.clear).not.toHaveBeenCalled();

  await act(async () => finishSnapshotSave());
  expect(decodeCompressedOrJson(localStorage.getItem(snapshotKey)!)).toMatchObject({
    engine: { id: old.id, handle: { id: { id: "new" } } },
  });
  expect(host.textContent).toContain("Engines.Upgrade.Current");
  expect(host.textContent).not.toContain("Common.Extracting");
  expect(mocks.clear).not.toHaveBeenCalled();
  expect(mocks.notify).not.toHaveBeenCalled();
});

test("refused save leaves the real atom and durable handle old and never retires", async () => {
  const bytes = localStorage.getItem("engines");
  mocks.reconcile.mockRejectedValueOnce(new Error("prepare refused"));
  await render();
  await click("Common.Install");
  expect(store.get(enginesAtom)).toEqual([old]);
  expect(localStorage.getItem("engines")).toBe(bytes);
  expect(mocks.retire).not.toHaveBeenCalled();
  expect(mocks.notify).toHaveBeenCalled();
  expect(mocks.clear).toHaveBeenCalled();
  expect(host.textContent).toContain("Common.Install");
});

test.each(["download", "register", "config"] as const)(
  "%s failure shows an error and saves no upgrade",
  async (step) => {
    mocks[step].mockRejectedValueOnce(new Error(`${step} failed`));
    await render();
    await click("Common.Install");
    expect(store.get(enginesAtom)).toEqual([old]);
    expect(mocks.retire).not.toHaveBeenCalled();
    expect(mocks.notify).toHaveBeenCalled();
    expect(mocks.clear).toHaveBeenCalled();
  },
);

test("retirement failure reports an error and leaves the saved upgrade applied", async () => {
  mocks.retire.mockRejectedValueOnce(new Error("retirement failed"));
  await render();
  await click("Common.Install");
  expect(store.get(enginesAtom)?.[0]).toMatchObject({ handle: { id: { id: "new" } } });
  expect(mocks.notify).toHaveBeenCalled();
});

test.each([
  [() => new EngineCatalogVerificationError("signature"), "Engines.Upgrade.ErrorCatalog"],
  [() => new EngineCapabilityQueryError("IPC"), "Engines.Upgrade.ErrorCapabilities"],
  [() => new Error("other"), "Engines.Upgrade.ErrorLoad"],
] as const)(
  "catalog failures fail closed with a truthful per-cause message (%s)",
  async (error, message) => {
    mocks.catalogError = error();
    await render();
    expect(host.textContent).toContain(message);
    expect(host.querySelectorAll("button")).toHaveLength(0);
  },
);

test("current downloadLink is marked current and cannot install", async () => {
  await render({ ...old, downloadLink: catalog.downloadLink });
  const button = host.querySelector("button")!;
  expect(button.textContent).toBe("Engines.Upgrade.Current");
  expect(button.disabled).toBe(true);
});

test("rewrites both same-id durable player snapshots and filters their own settings", async () => {
  for (const key of ["game-player1-settings", "game-player2-settings"])
    localStorage.setItem(
      key,
      serializeStorageValue({
        type: "engine",
        engine: old,
        go: { t: "Depth", c: 12 },
        engineSettings: old.settings!.filter((item) => item.name !== "Hash"),
      }),
    );
  await render();
  await click("Common.Install");
  for (const key of ["game-player1-settings", "game-player2-settings"]) {
    const snapshot = decodeCompressedOrJson(localStorage.getItem(key)!);
    expect(snapshot).toMatchObject({
      engine: { id: old.id, handle: { id: { id: "new" } } },
      go: { t: "Depth", c: 12 },
      engineSettings: [
        { name: "Threads", value: "20" },
        { name: "MultiPV", value: "4" },
        { name: "Hash", value: "1" },
      ],
    });
  }
  expect(mocks.notify).not.toHaveBeenCalled();
});

test.each(["pre-id", "random-era"])(
  "upgrade resolves a never-hydrated pre-id player after changing the %s engine's identity fields",
  async (era) => {
    const { id: _id, legacyAssessment: _assessment, ...snapshot } = old;
    localStorage.setItem(
      "engines",
      serializeStorageValue([era === "pre-id" ? snapshot : { ...snapshot, id: old.id }]),
    );
    for (const key of ["game-player1-settings", "game-player2-settings"]) {
      localStorage.setItem(
        key,
        serializeStorageValue({
          type: "engine",
          engine: snapshot,
          go: { t: "Depth", c: 12 },
          engineSettings: snapshot.settings,
        }),
      );
    }
    const untouched = localStorage.getItem("game-player1-settings");
    store = createStore();
    const unsubscribe = store.sub(enginesAtom, () => undefined);
    try {
      await vi.waitFor(() => expect(store.get(enginesAtom)).toHaveLength(1));
      const current = store.get(enginesAtom)![0] as LocalEngine;
      expect(localStorage.getItem("game-player1-settings")).toBe(untouched);
      await render(current);
      await click("Common.Install");
      for (const key of ["game-player1-settings", "game-player2-settings"]) {
        expect(decodeCompressedOrJson(localStorage.getItem(key)!)).toMatchObject({
          engine: { id: current.id, name: "Stockfish 19", handle: { id: { id: "new" } } },
          go: { t: "Depth", c: 12 },
          engineSettings: [
            { name: "Threads", value: "20" },
            { name: "Hash", value: "8192" },
            { name: "MultiPV", value: "4" },
          ],
        });
      }
      expect(store.get(enginesAtom)![0]).toMatchObject({
        id: current.id,
        handle: { id: { id: "new" } },
      });
      expect(mocks.retire).toHaveBeenCalledWith(current.id, current.handle, {
        id: { id: "new" },
        kind: "engine",
      });
      expect(mocks.notify).not.toHaveBeenCalled();
    } finally {
      unsubscribe();
    }
  },
);

test("a refused player receipt reports an error without undoing the entry", async () => {
  const key = "game-player1-settings";
  localStorage.setItem(
    key,
    serializeStorageValue({ type: "engine", engine: old, go: { t: "Infinite" } }),
  );
  const write = Storage.prototype.setItem;
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, name, value) {
    if (name === key) throw new Error("quota");
    write.call(this, name, value);
  });
  await render();
  await click("Common.Install");
  expect(store.get(enginesAtom)?.[0]).toMatchObject({ handle: { id: { id: "new" } } });
  expect(mocks.notify).toHaveBeenCalledWith(
    "Common.Error",
    expect.objectContaining({ message: "Engines.Upgrade.SnapshotSaveError" }),
  );
});

test.each([false, true])(
  "cancel intent keeps the old entry when request fails=%s; discarded completion clears progress to idle",
  async (fails) => {
    const progressId = `engine-upgrade:${old.id}:${catalog.downloadLink}`;
    const otherProgressId = "another-download";
    mocks.progress.set(otherProgressId, 73);
    let complete!: () => void;
    mocks.download.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          complete = resolve;
        }),
    );
    if (fails) mocks.cancel.mockRejectedValueOnce(new Error("cancel IPC failed"));
    else
      mocks.cancel.mockImplementation(async () => {
        complete();
        return true;
      });
    await render();
    await click("Common.Install");
    await vi.waitFor(() => expect(complete).toEqual(expect.any(Function)));
    await click("Common.Cancel");
    expect(mocks.cancel).toHaveBeenCalledExactlyOnceWith("ticket");
    expect(mocks.cancelDownloadForProgress).not.toHaveBeenCalled();
    expect(mocks.notify).toHaveBeenCalledTimes(fails ? 1 : 0);
    if (fails) {
      mocks.progress.set(progressId, 100);
      await act(async () => complete());
    }
    await vi.waitFor(() => expect(mocks.clear).toHaveBeenCalledWith(progressId));
    expect(mocks.clear).toHaveBeenCalledTimes(1);
    expect(mocks.progress.has(progressId)).toBe(false);
    expect(mocks.progress.get(otherProgressId)).toBe(73);
    expect(store.get(enginesAtom)).toEqual([old]);
    expect(mocks.retire).not.toHaveBeenCalled();
    expect(mocks.reconcile).not.toHaveBeenCalled();
    const button = host.querySelector("button")!;
    expect(button.textContent).toBe("Common.Install");
    expect(button.disabled).toBe(false);
    expect(host.querySelector("[data-progress]")).toBeNull();
    expect(host.textContent).not.toContain("Common.Downloading");
    expect(host.textContent).not.toContain("Common.Extracting");
  },
);
