import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mocks = vi.hoisted(() => {
  const referenceDbAtom = {};
  const telemetryEnabledAtom = {};

  return {
    analytics: {
      capture: vi.fn(),
      enable: vi.fn(),
    },
    attachConsole: vi.fn(),
    closeSplashscreen: vi.fn(),
    getDefaultStore: vi.fn(),
    getMatches: vi.fn(),
    getVersion: vi.fn(),
    info: vi.fn(),
    initUserAgent: vi.fn(),
    preloadReferenceDb: vi.fn(),
    warn: vi.fn(),
    referenceDbAtom,
    telemetryEnabledAtom,
  };
});

vi.mock("@/platform/native", () => ({
  attachConsole: mocks.attachConsole,
  getMatches: mocks.getMatches,
  getVersion: mocks.getVersion,
  info: mocks.info,
  warn: mocks.warn,
}));
vi.mock("@/platform/tauri", () => ({
  tauri: {
    closeSplashscreen: mocks.closeSplashscreen,
    preloadReferenceDb: mocks.preloadReferenceDb,
  },
}));
vi.mock("@/platform/analytics", () => ({ analytics: mocks.analytics }));
vi.mock("@/utils/http", () => ({ initUserAgent: mocks.initUserAgent }));
vi.mock("@/state/atoms", () => ({
  fontSizeAtom: {},
  pieceSetAtom: {},
  primaryColorAtom: {},
  referenceDbAtom: mocks.referenceDbAtom,
  spellCheckAtom: {},
  telemetryEnabledAtom: mocks.telemetryEnabledAtom,
}));
vi.mock("jotai", () => ({
  getDefaultStore: mocks.getDefaultStore,
  useAtomValue: vi.fn(() => undefined),
}));
vi.mock("@mantine/core", () => ({
  MantineProvider: () => null,
  localStorageColorSchemeManager: vi.fn(() => ({})),
}));
vi.mock("@mantine/notifications", () => ({ Notifications: () => null }));
vi.mock("@tanstack/react-router", () => ({
  RouterProvider: () => null,
  createRouter: vi.fn(() => ({})),
}));
vi.mock("mantine-contextmenu", () => ({ ContextMenuProvider: () => null }));
vi.mock("react-dnd", () => ({ DndProvider: () => null }));
vi.mock("react-dnd-html5-backend", () => ({ HTML5Backend: {} }));
vi.mock("@/components/ErrorComponent", () => ({ default: () => null }));
vi.mock("@/hooks/useConversionProgress", () => ({ useConversionProgress: vi.fn() }));
vi.mock("@/hooks/useDocumentLanguage", () => ({ useDocumentLanguage: vi.fn() }));
vi.mock("./routeTree.gen", () => ({ routeTree: {} }));
vi.mock("./styles/theme", () => ({
  appCssVariablesResolver: {},
  createAppTheme: vi.fn(() => ({})),
}));

import { useAppStartup } from "./App";

let root: Root;
let container: HTMLDivElement;

function Probe() {
  useAppStartup();
  return null;
}

beforeEach(() => {
  mocks.analytics.capture.mockReset();
  mocks.analytics.enable.mockReset();
  mocks.attachConsole.mockReset();
  mocks.closeSplashscreen.mockReset();
  mocks.getDefaultStore.mockReset();
  mocks.getMatches.mockReset();
  mocks.getVersion.mockReset();
  mocks.info.mockReset();
  mocks.initUserAgent.mockReset();
  mocks.preloadReferenceDb.mockReset();
  mocks.warn.mockReset();

  mocks.initUserAgent.mockResolvedValue(undefined);
  mocks.getDefaultStore.mockReturnValue({
    get: (atom: object) => (atom === mocks.telemetryEnabledAtom ? false : undefined),
  });
  mocks.preloadReferenceDb.mockResolvedValue(undefined);

  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

describe("useAppStartup", () => {
  test("detaches the console listener when unmounted during startup", async () => {
    const detach = vi.fn();
    let resolveMatches: (matches: {
      args: { file: { occurrences: number; value: string } };
    }) => void = () => undefined;

    mocks.attachConsole.mockResolvedValue(detach);
    mocks.getMatches.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveMatches = resolve;
        }),
    );

    await act(async () => root.render(<Probe />));
    expect(mocks.getMatches).toHaveBeenCalledOnce();

    await act(async () => root.unmount());

    expect(detach).toHaveBeenCalledOnce();

    await act(async () => {
      resolveMatches({ args: { file: { occurrences: 0, value: "" } } });
    });
  });
});
