import { MantineProvider } from "@mantine/core";
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { getDefaultStore } from "jotai";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { SWRConfig } from "swr";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import i18n, { initializeI18n } from "@/i18n";
import { Route } from "@/routes/engines";
import { enginesAtom } from "@/state/atoms";
import { decodeCompressedOrJson } from "@/state/store/debouncedStorage";
import { resetEngineOwnerCoordinatorForTests } from "@/state/engineOwnerStorage";
import { installMatchMediaStub } from "@/tests/matchMedia";
import { installResizeObserverStub } from "@/tests/resizeObserver";
import type { Engine, LocalEngine } from "@/utils/engines";
import EnginesPage from "./EnginesPage";

const mocks = vi.hoisted(() => ({
  reconcile: vi.fn(),
  retire: vi.fn(),
  report: vi.fn(),
  image: vi.fn(),
  config: vi.fn(),
}));
vi.mock("@/state/persistError", () => ({ reportPersistError: mocks.report }));
vi.mock("@/platform/tauri", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/platform/tauri")>();
  return {
    ...actual,
    tauri: {
      ...actual.tauri,
      fileExists: vi.fn().mockResolvedValue(true),
      getEngineConfig: mocks.config,
      reconcileEngineAttachments: mocks.reconcile,
      retireEngine: mocks.retire,
      issueEngineImage: mocks.image,
    },
  };
});

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
installMatchMediaStub();
installResizeObserverStub();
const engine: LocalEngine = {
  type: "local",
  id: "publication",
  legacyAssessment: null,
  name: "Stockfish",
  version: "18",
  filename: "stockfish",
  handle: { id: { id: "same-path" }, kind: "engine" },
  settings: [],
};
const twin: LocalEngine = { ...engine, id: "twin" };
const store = getDefaultStore();
let host: HTMLDivElement;
let root: Root;
let router: ReturnType<typeof createRouter>;

beforeEach(async () => {
  localStorage.clear();
  sessionStorage.clear();
  resetEngineOwnerCoordinatorForTests();
  vi.clearAllMocks();
  mocks.reconcile.mockReset().mockResolvedValue(undefined);
  mocks.retire.mockReset().mockResolvedValue(undefined);
  mocks.config.mockReset().mockResolvedValue({ name: "Stockfish", options: [] });
  await initializeI18n();
  await i18n.changeLanguage("en-US");
  Object.defineProperty(window, "__TAURI_OS_PLUGIN_INTERNALS__", {
    configurable: true,
    value: { platform: "linux" },
  });
});
afterEach(async () => {
  await act(async () => root?.unmount());
  host?.remove();
  vi.restoreAllMocks();
  Reflect.deleteProperty(window, "__TAURI_OS_PLUGIN_INTERNALS__");
});

async function mount(records: Engine[] = [engine, twin]) {
  expect((await store.set(enginesAtom, records)).saved).toBe(true);
  const route = createRootRoute();
  const child = Route.update({
    id: "/engines",
    path: "/engines",
    getParentRoute: () => route,
  } as never).update({ component: EnginesPage });
  router = createRouter({
    routeTree: route.addChildren([child]),
    history: createMemoryHistory({ initialEntries: ["/engines?selected=0"] }),
  });
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(async () => {
    await router.load();
    root.render(
      <MantineProvider env="test">
        <SWRConfig value={{ provider: () => new Map(), shouldRetryOnError: false }}>
          <RouterProvider router={router} />
        </SWRConfig>
      </MantineProvider>,
    );
  });
}
function button(label: string, scope: ParentNode = host) {
  const result = [...scope.querySelectorAll<HTMLButtonElement>("button")].find(
    (node) => node.textContent === label,
  );
  if (!result) throw new Error(`missing button: ${label}`);
  return result!;
}
function input(label: string): HTMLInputElement {
  const node = [...host.querySelectorAll("label")].find((node) => node.textContent === label);
  if (!node) throw new Error(`missing input label: ${label}`);
  return document.getElementById(node!.htmlFor) as HTMLInputElement;
}
async function type(node: HTMLInputElement | HTMLTextAreaElement, value: string) {
  await act(async () => {
    Object.getOwnPropertyDescriptor(
      node instanceof HTMLTextAreaElement
        ? HTMLTextAreaElement.prototype
        : HTMLInputElement.prototype,
      "value",
    )!.set!.call(node, value);
    node.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
function refuseStorage() {
  const original = Storage.prototype.setItem;
  return vi
    .spyOn(Storage.prototype, "setItem")
    .mockImplementation(function (this: Storage, key, value) {
      if (key === "engines") throw new DOMException("Quota", "QuotaExceededError");
      return original.call(this, key, value);
    });
}

test("routed rapid drafts stay responsive, failed name does not contaminate version, newest edit survives reload", async () => {
  await mount();
  const bytes = localStorage.getItem("engines");
  let reject!: (error: Error) => void;
  mocks.reconcile.mockImplementationOnce(
    () =>
      new Promise((_resolve, refuse) => {
        reject = refuse;
      }),
  );
  await type(input("Name"), "Refused name");
  await vi.waitFor(() => expect(reject).toBeTypeOf("function"));
  await type(input("Version"), "19");
  expect(input("Name").value).toBe("Refused name");
  expect(input("Version").value).toBe("19");
  expect(store.get(enginesAtom)).toEqual([engine, twin]);
  expect(host.textContent).not.toContain("Refused name");
  expect(localStorage.getItem("engines")).toBe(bytes);
  await act(async () => {
    reject(new Error("refused"));
  });
  await vi.waitFor(() => expect(input("Name").value).toBe("Stockfish"));
  await vi.waitFor(() =>
    expect(store.get(enginesAtom)?.[0]).toMatchObject({ name: "Stockfish", version: "19" }),
  );
  let release!: () => void;
  mocks.reconcile.mockImplementationOnce(
    () =>
      new Promise<void>((resolve) => {
        release = resolve;
      }),
  );
  await type(input("Name"), "Older");
  await vi.waitFor(() => expect(release).toBeTypeOf("function"));
  await type(input("Name"), "Newest");
  await act(async () => {
    release();
  });
  await vi.waitFor(() => expect(store.get(enginesAtom)?.[0].name).toBe("Newest"));
  expect(input("Name").value).toBe("Newest");
  expect(decodeCompressedOrJson(localStorage.getItem("engines")!)).toEqual(store.get(enginesAtom));
  const { createEngineOwnerStorage } = await import("@/state/engineOwnerStorage");
  const { enginesSchema } = await import("@/state/engineOwnerStorage");
  expect(
    await createEngineOwnerStorage("engines", enginesSchema, []).getItem("engines", []),
  ).toEqual(store.get(enginesAtom));
});

test("accepted edits merge upgraded metadata and cannot resurrect a permanently removed target", async () => {
  await mount();
  let release!: () => void;
  mocks.reconcile.mockImplementationOnce(
    () =>
      new Promise<void>((resolve) => {
        release = resolve;
      }),
  );
  await type(input("Name"), "First");
  await vi.waitFor(() => expect(release).toBeTypeOf("function"));
  const upgrade = store.set(enginesAtom, (current) =>
    current.map((item) =>
      item.id === engine.id
        ? {
            ...item,
            handle: { id: { id: "upgrade" }, kind: "engine" as const },
            downloadLink: "catalog-19",
          }
        : item,
    ),
  );
  await type(input("Version"), "19");
  await act(async () => {
    release();
    await upgrade;
  });
  await vi.waitFor(() =>
    expect(store.get(enginesAtom)?.[0]).toMatchObject({
      name: "First",
      version: "19",
      handle: { id: { id: "upgrade" } },
      downloadLink: "catalog-19",
    }),
  );
  const removal = store.set(enginesAtom, { removeLocalId: engine.id });
  await type(input("Name"), "Late");
  await act(async () => {
    await removal;
  });
  await vi.waitFor(() =>
    expect(store.get(enginesAtom)?.some((item) => item.id === engine.id)).toBe(false),
  );
  expect(store.get(enginesAtom)).toEqual([twin]);
});

test("duplicate refusal preserves selection and a saved duplicate selects its immutable identity", async () => {
  await mount();
  const refusal = refuseStorage();
  await act(async () => button("Duplicate").click());
  await vi.waitFor(() => expect(mocks.report).toHaveBeenCalledOnce());
  expect(store.get(enginesAtom)).toEqual([engine, twin]);
  expect(router.state.location.search).toMatchObject({ selected: 0 });
  refusal.mockRestore();
  await act(async () => button("Duplicate").click());
  await vi.waitFor(() => expect(store.get(enginesAtom)).toHaveLength(3));
  await vi.waitFor(() => expect(router.state.location.search).toMatchObject({ selected: 1 }));
  const created = store.get(enginesAtom)![1];
  expect(created.id).not.toBe(engine.id);
  expect(created.id).not.toBe(twin.id);
  expect(created.name).toBe("Stockfish (Copy)");
});

test("duplicate completion after navigation cannot steal selection", async () => {
  await mount();
  let release!: () => void;
  mocks.reconcile.mockImplementationOnce(
    () =>
      new Promise<void>((resolve) => {
        release = resolve;
      }),
  );
  await act(async () => button("Duplicate").click());
  await vi.waitFor(() => expect(release).toBeTypeOf("function"));
  await act(async () => {
    await router.navigate({ to: "/engines", search: { selected: 1 } });
  });
  await act(async () => {
    release();
  });
  await vi.waitFor(() => expect(store.get(enginesAtom)).toHaveLength(3));
  expect(router.state.location.search).toMatchObject({ selected: 1 });
});

test("local removal remains absent through preparation, storage refusal and pending retirement", async () => {
  await mount();
  const bytes = localStorage.getItem("engines");
  let release!: () => void;
  let retire!: () => void;
  mocks.reconcile.mockImplementationOnce(
    () =>
      new Promise<void>((resolve) => {
        release = resolve;
      }),
  );
  mocks.retire.mockImplementationOnce(
    () =>
      new Promise<void>((resolve) => {
        retire = resolve;
      }),
  );
  const refusal = refuseStorage();
  await act(async () => button("Remove").click());
  await act(async () => button("Remove", document.querySelector('[role="dialog"]')!).click());
  await vi.waitFor(() => expect(release).toBeTypeOf("function"));
  expect(store.get(enginesAtom)).toEqual([twin]);
  expect(mocks.retire).not.toHaveBeenCalled();
  expect(localStorage.getItem("engines")).toBe(bytes);
  await act(async () => {
    release();
  });
  await vi.waitFor(() => expect(retire).toBeTypeOf("function"));
  expect(store.get(enginesAtom)).toEqual([twin]);
  expect(localStorage.getItem("engines")).toBe(bytes);
  expect(mocks.retire).toHaveBeenCalledWith(engine.id);
  refusal.mockRestore();
  await act(async () => {
    retire();
  });
});

test("cloud admission is bounded during delayed save and refused admission permits retry", async () => {
  await mount([]);
  await act(async () =>
    host.querySelector<HTMLButtonElement>('button[aria-label="Add New"]')!.click(),
  );
  const dialog = document.querySelector('[role="dialog"]')!;
  await act(async () =>
    [...dialog.querySelectorAll<HTMLButtonElement>('button[role="tab"]')]
      .find((node) => node.textContent === "Cloud")!
      .click(),
  );
  const add = [...dialog.querySelectorAll<HTMLButtonElement>("button")].filter(
    (node) => node.textContent === "Add",
  )[1];
  let reject!: (error: Error) => void;
  mocks.reconcile.mockImplementationOnce(
    () =>
      new Promise((_resolve, refuse) => {
        reject = refuse;
      }),
  );
  await act(async () => {
    add.click();
    add.click();
  });
  await vi.waitFor(() => expect(reject).toBeTypeOf("function"));
  expect(add.disabled).toBe(true);
  expect(store.get(enginesAtom)).toEqual([]);
  await act(async () => {
    reject(new Error("refused"));
  });
  await vi.waitFor(() => expect(add.disabled).toBe(false));
  await act(async () => {
    add.click();
    add.click();
  });
  await vi.waitFor(() =>
    expect(store.get(enginesAtom)?.filter((item) => item.type === "lichess")).toHaveLength(1),
  );
  expect(add.disabled).toBe(true);
});

test("JSON submission retains its editor on refusal, preserves identity, and closes after its saved receipt", async () => {
  await mount();
  await act(async () => button("Edit JSON").click());
  const dialog = document.querySelector('[role="dialog"]')!;
  await type(
    dialog.querySelector("textarea")!,
    JSON.stringify({ ...engine, id: "submitted-other-id", name: "JSON name" }),
  );
  const refusal = refuseStorage();
  await act(async () => button("Save", dialog).click());
  await vi.waitFor(() => expect(mocks.report).toHaveBeenCalledOnce());
  expect(document.querySelector('[role="dialog"]')).not.toBeNull();
  expect(store.get(enginesAtom)).toEqual([engine, twin]);
  refusal.mockRestore();
  await act(async () => button("Save", dialog).click());
  await vi.waitFor(() =>
    expect(store.get(enginesAtom)?.[0]).toMatchObject({
      id: engine.id,
      name: "JSON name",
      legacyAssessment: null,
    }),
  );
  await vi.waitFor(() => expect(document.querySelector('[role="dialog"]')).toBeNull());
});

test.each(["valid", "invalid"] as const)(
  "JSON open owner preserves newer %s raw draft after an older inline receipt and reseeds on reopen",
  async (configuration) => {
    await mount();
    let release!: () => void;
    mocks.reconcile.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    );
    await type(input("Name"), "Older inline receipt");
    await vi.waitFor(() => expect(release).toBeTypeOf("function"));
    expect(store.get(enginesAtom)?.[0].name).toBe("Stockfish");
    await act(async () => button("Edit JSON").click());
    const dialog = document.querySelector('[role="dialog"]')!;
    const textarea = dialog.querySelector("textarea")!;
    const entered = JSON.stringify({
      ...engine,
      name: "Newer JSON draft",
      ...(configuration === "invalid" ? { type: "invalid" } : {}),
    });
    await type(textarea, entered);
    expect(textarea.value).toBe(entered);
    if (configuration === "invalid") {
      await act(async () => button("Save", dialog).click());
    }
    expect(dialog.textContent?.includes("Invalid Configuration")).toBe(configuration === "invalid");
    await act(async () => {
      release();
    });
    await vi.waitFor(() => expect(store.get(enginesAtom)?.[0].name).toBe("Older inline receipt"));
    expect(textarea.value).toBe(entered);
    expect(dialog.textContent?.includes("Invalid Configuration")).toBe(configuration === "invalid");
    await act(async () =>
      dialog
        .querySelector<HTMLButtonElement>(`button[aria-label="${i18n.t("Common.Close")}"]`)!
        .click(),
    );
    await vi.waitFor(() => expect(document.querySelector('[role="dialog"]')).toBeNull());
    await act(async () => button("Edit JSON").click());
    const reopened = document.querySelector('[role="dialog"]')!;
    expect(JSON.parse(reopened.querySelector("textarea")!.value)).toEqual(
      store.get(enginesAtom)![0],
    );
    expect(reopened.textContent).not.toContain("Invalid Configuration");
  },
);

test("refused inline attachment keeps authoritative image and cleans up its issued draft on unmount", async () => {
  await mount();
  const image = { id: { id: "issued-image" }, kind: "engineImage" };
  mocks.image.mockResolvedValueOnce(image);
  const refusal = refuseStorage();
  await act(async () =>
    host.querySelector<HTMLButtonElement>('button[aria-label="Select image"]')!.click(),
  );
  await vi.waitFor(() => expect(mocks.report).toHaveBeenCalledOnce());
  expect(store.get(enginesAtom)?.[0].imageHandle).toBeUndefined();
  refusal.mockRestore();
  await act(async () => {
    await router.navigate({ to: "/engines", search: {} });
  });
  await vi.waitFor(() =>
    expect(mocks.reconcile).toHaveBeenCalledWith(
      expect.objectContaining({ abandoned_ids: [{ id: "issued-image" }] }),
    ),
  );
});

test("refused defaults are attempted once and Reset settles its options through its own receipt", async () => {
  mocks.config.mockImplementation(async () => {
    mocks.reconcile.mockRejectedValueOnce(new Error("defaults refused"));
    return {
      name: "Stockfish",
      options: [{ type: "spin", value: { name: "Threads", default: 1, min: 1, max: 64 } }],
    };
  });
  await mount([engine]);
  await vi.waitFor(() => expect(mocks.report).toHaveBeenCalledOnce());
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
  expect(mocks.report).toHaveBeenCalledOnce();
  expect(store.get(enginesAtom)?.[0].settings).toEqual([]);
  await type(input("Version"), "19");
  await vi.waitFor(() =>
    expect(store.get(enginesAtom)?.[0]).toMatchObject({ version: "19", settings: [] }),
  );
  expect(mocks.report).toHaveBeenCalledOnce();
  const refusal = refuseStorage();
  await act(async () => button(i18n.t("Engines.Settings.Reset")).click());
  await vi.waitFor(() => expect(mocks.report).toHaveBeenCalledTimes(2));
  expect(store.get(enginesAtom)?.[0].settings).toEqual([]);
  refusal.mockRestore();
  await act(async () => button(i18n.t("Engines.Settings.Reset")).click());
  await vi.waitFor(() =>
    expect(store.get(enginesAtom)?.[0].settings).toEqual([
      { type: "string", name: "Threads", value: "1" },
    ]),
  );
});
