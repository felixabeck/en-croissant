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
import { afterEach, expect, test, vi } from "vitest";
import { MissingLocalEngineError, toPlayerConfig } from "@/components/boards/playerConfig";
import i18n, { initializeI18n } from "@/i18n";
import { Route } from "@/routes/engines";
import { enginesAtom } from "@/state/atoms";
import { serializeStorageValue } from "@/state/store/debouncedStorage";
import { installMatchMediaStub } from "@/tests/matchMedia";
import { installResizeObserverStub } from "@/tests/resizeObserver";
import type { LocalEngine } from "@/utils/engines";
import EnginesPage from "./EnginesPage";

const mocks = vi.hoisted(() => ({
  retireEngine: vi.fn(),
  reconcileEngineAttachments: vi.fn(),
}));

vi.mock("@/platform/tauri", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/platform/tauri")>();
  return {
    ...actual,
    tauri: {
      ...actual.tauri,
      fileExists: vi.fn().mockResolvedValue(true),
      getEngineConfig: vi.fn().mockResolvedValue({ name: "Stockfish", options: [] }),
      retireEngine: mocks.retireEngine,
      reconcileEngineAttachments: mocks.reconcileEngineAttachments,
    },
  };
});

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
installMatchMediaStub();
installResizeObserverStub();

let host: HTMLDivElement;
let root: Root;
let finishRetirement: (() => void) | undefined;

afterEach(async () => {
  await act(async () => {
    finishRetirement?.();
    root?.unmount();
  });
  host?.remove();
  localStorage.clear();
  sessionStorage.clear();
  Reflect.deleteProperty(window, "__TAURI_OS_PLUGIN_INTERNALS__");
});

test("a real confirmation drops the default-store engine before pending retirement", async () => {
  const engine: LocalEngine = {
    type: "local",
    id: "engine-removal-real-store",
    legacyAssessment: null,
    name: "Stockfish",
    version: "17",
    handle: { id: { id: "engine-removal-real-binary" }, kind: "engine" },
    filename: "stockfish",
    settings: [],
  };
  mocks.reconcileEngineAttachments.mockResolvedValue(undefined);
  let retirementFinished = false;
  mocks.retireEngine.mockImplementation(
    () =>
      new Promise<void>((resolve) => {
        finishRetirement = () => {
          retirementFinished = true;
          resolve();
        };
      }),
  );
  // The OS plugin reads injected desktop metadata synchronously; no native call is needed.
  Object.defineProperty(window, "__TAURI_OS_PLUGIN_INTERNALS__", {
    configurable: true,
    value: { platform: "linux" },
  });
  await initializeI18n();
  await i18n.changeLanguage("en-US");
  const store = getDefaultStore();
  // Seed through production persistence; removal below is exclusively through the real UI.
  await store.set(enginesAtom, [engine]);
  mocks.reconcileEngineAttachments.mockClear();

  const rootRoute = createRootRoute();
  // Supply the same file-route wiring as the generated tree, without loading the app shell.
  const enginesRoute = Route.update({
    id: "/engines",
    path: "/engines",
    getParentRoute: () => rootRoute,
  } as never).update({ component: EnginesPage });
  const router = createRouter({
    routeTree: rootRoute.addChildren([enginesRoute]),
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

  const removeLabel = i18n.t("Common.Remove");
  const removeButton = [...host.querySelectorAll<HTMLButtonElement>("button")].find(
    (button) => button.textContent === removeLabel,
  );
  expect(removeButton).toBeDefined();
  expect(store.get(enginesAtom)).toEqual([engine]);
  await act(async () => removeButton!.click());
  const dialog = document.querySelector('[role="dialog"]');
  expect(dialog).not.toBeNull();
  const confirmButton = [...dialog!.querySelectorAll<HTMLButtonElement>("button")].find(
    (button) => button.textContent === removeLabel,
  );
  expect(confirmButton).toBeDefined();
  await act(async () => {
    confirmButton!.click();
    await vi.waitFor(() => expect(mocks.retireEngine).toHaveBeenCalledOnce());
  });

  expect(mocks.retireEngine).toHaveBeenCalledWith(engine.id);
  expect(retirementFinished).toBe(false);
  expect(store.get(enginesAtom)).toEqual([]);
  expect(localStorage.getItem("engines")).toBe(serializeStorageValue([]));
  expect(mocks.reconcileEngineAttachments).toHaveBeenNthCalledWith(1, {
    action: "prepare",
    retained_ids: [],
  });
  expect(mocks.reconcileEngineAttachments).toHaveBeenNthCalledWith(2, {
    action: "reconcile",
    retained_ids: [],
    abandoned_ids: [],
    startup: false,
  });
  expect(() =>
    toPlayerConfig(
      { type: "engine", engine, go: { t: "Depth", c: 1 } },
      getDefaultStore().get(enginesAtom),
    ),
  ).toThrow(MissingLocalEngineError);

  await act(async () => finishRetirement!());
  expect(mocks.retireEngine).toHaveBeenCalledExactlyOnceWith(engine.id);
});
