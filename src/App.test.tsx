import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mocks = vi.hoisted(() => {
  const referenceDbAtom = {};
  const telemetryEnabledAtom = {};
  const fontSizeAtom = {};
  const pieceSetAtom = {};
  const primaryColorAtom = {};
  const spellCheckAtom = {};

  return {
    createAppTheme: vi.fn(() => ({})),
    useAtomValue: vi.fn((_atom: object): unknown => undefined),
    analytics: {
      capture: vi.fn(),
      enable: vi.fn(),
    },
    attachConsole: vi.fn(),
    useConversionProgress: vi.fn(),
    useDocumentLanguage: vi.fn(),
    closeSplashscreen: vi.fn(),
    getDefaultStore: vi.fn(),
    getMatches: vi.fn(),
    getVersion: vi.fn(),
    info: vi.fn(),
    preloadReferenceDb: vi.fn(),
    reconcileStartupPathOwners: vi.fn(),
    reconcileEngineAttachments: vi.fn(),
    warn: vi.fn(),
    referenceDbAtom,
    telemetryEnabledAtom,
    fontSizeAtom,
    pieceSetAtom,
    primaryColorAtom,
    spellCheckAtom,
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
    reconcileStartupPathOwners: mocks.reconcileStartupPathOwners,
    reconcileEngineAttachments: mocks.reconcileEngineAttachments,
  },
}));
vi.mock("@/platform/analytics", () => ({ analytics: mocks.analytics }));
vi.mock("@/state/atoms", () => ({
  fontSizeAtom: mocks.fontSizeAtom,
  pieceSetAtom: mocks.pieceSetAtom,
  primaryColorAtom: mocks.primaryColorAtom,
  referenceDbAtom: mocks.referenceDbAtom,
  spellCheckAtom: mocks.spellCheckAtom,
  telemetryEnabledAtom: mocks.telemetryEnabledAtom,
}));
vi.mock("jotai", () => ({
  getDefaultStore: mocks.getDefaultStore,
  useAtomValue: mocks.useAtomValue,
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
vi.mock("@/hooks/useConversionProgress", () => ({
  useConversionProgress: mocks.useConversionProgress,
}));
vi.mock("@/hooks/useDocumentLanguage", () => ({
  useDocumentLanguage: mocks.useDocumentLanguage,
}));
vi.mock("./routeTree.gen", () => ({ routeTree: {} }));
vi.mock("./styles/theme", () => ({
  appCssVariablesResolver: {},
  createAppTheme: mocks.createAppTheme,
}));

import App, { useAppStartup } from "./App";
import { resetEngineOwnerCoordinatorForTests } from "./state/engineOwnerStorage";
import { resetPathOwnerInitializationForTests } from "./state/pathOwners";

let root: Root;
let container: HTMLDivElement;
let storeValues: { telemetryEnabled: boolean; referenceDb: string | undefined };
let atomValues: Map<object, unknown>;

function Probe() {
  useAppStartup();
  return null;
}

/** The CLI match shape for a launch without a file argument, which is every case but one. */
const noCliFileArgs = { args: { file: { occurrences: 0, value: "" } } };

/** Wires the two native calls a startup must get past before the branch under test. */
function mockLaunchWithoutCliFile() {
  mocks.attachConsole.mockResolvedValue(vi.fn());
  mocks.getMatches.mockResolvedValue(noCliFileArgs);
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
  mocks.reconcileStartupPathOwners.mockReset().mockResolvedValue(null);
  mocks.reconcileEngineAttachments.mockReset().mockResolvedValue(null);
  resetPathOwnerInitializationForTests();
  resetEngineOwnerCoordinatorForTests();
  mocks.preloadReferenceDb.mockReset();
  mocks.warn.mockReset();

  mocks.createAppTheme.mockReset().mockReturnValue({});
  mocks.useConversionProgress.mockReset();
  mocks.useDocumentLanguage.mockReset();
  mocks.useAtomValue.mockReset();

  storeValues = { telemetryEnabled: false, referenceDb: undefined };
  mocks.getDefaultStore.mockReturnValue({
    get: (atom: object) => {
      if (atom === mocks.telemetryEnabledAtom) return storeValues.telemetryEnabled;
      if (atom === mocks.referenceDbAtom) return storeValues.referenceDb;
      return undefined;
    },
  });
  atomValues = new Map<object, unknown>([
    [mocks.fontSizeAtom, 120],
    [mocks.pieceSetAtom, "staunty"],
    [mocks.primaryColorAtom, "blue"],
    [mocks.spellCheckAtom, true],
  ]);
  mocks.useAtomValue.mockImplementation((atom: object) => atomValues.get(atom));
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
  test("shares path reconciliation across simultaneous and remounted startup callers", async () => {
    let resolveOwners: () => void = () => {};
    mocks.reconcileStartupPathOwners.mockImplementation(
      () =>
        new Promise<null>((resolve) => {
          resolveOwners = () => resolve(null);
        }),
    );

    await act(async () =>
      root.render(
        <>
          <Probe />
          <Probe />
        </>,
      ),
    );
    expect(mocks.reconcileStartupPathOwners).toHaveBeenCalledOnce();
    await act(async () => resolveOwners());
    expect(mocks.reconcileEngineAttachments).toHaveBeenCalledOnce();

    await act(async () => root.unmount());
    root = createRoot(container);
    await act(async () => root.render(<Probe />));
    expect(mocks.reconcileStartupPathOwners).toHaveBeenCalledOnce();
    expect(mocks.reconcileEngineAttachments).toHaveBeenCalledOnce();
  });

  test("reports reconciliation failure and still tears down the splash", async () => {
    mocks.reconcileStartupPathOwners.mockRejectedValue(new Error("registry unavailable"));
    mockLaunchWithoutCliFile();

    await act(async () => root.render(<Probe />));

    expect(mocks.warn).toHaveBeenCalledWith(expect.stringContaining("registry unavailable"));
    expect(mocks.closeSplashscreen).toHaveBeenCalledOnce();
  });

  test("reports attachment reconciliation failure and still tears down the splash", async () => {
    mocks.reconcileEngineAttachments.mockRejectedValue(
      new Error("attachment registry unavailable"),
    );
    mockLaunchWithoutCliFile();

    await act(async () => root.render(<Probe />));

    expect(mocks.warn).toHaveBeenCalledWith(
      expect.stringContaining("attachment registry unavailable"),
    );
    expect(mocks.closeSplashscreen).toHaveBeenCalledOnce();
  });

  test("captures the version through telemetry and logs the CLI file argument", async () => {
    storeValues.telemetryEnabled = true;
    mocks.attachConsole.mockResolvedValue(vi.fn());
    mocks.getVersion.mockResolvedValue("1.2.3");
    mocks.getMatches.mockResolvedValue({
      args: { file: { occurrences: 1, value: "/games/opening.pgn" } },
    });

    await act(async () => root.render(<Probe />));

    expect(mocks.analytics.enable).toHaveBeenCalledOnce();
    expect(mocks.analytics.capture).toHaveBeenCalledWith("app_started", { version: "1.2.3" });
    expect(mocks.info).toHaveBeenCalledWith("Opening file from command line: /games/opening.pgn");
    expect(mocks.closeSplashscreen).toHaveBeenCalledOnce();
  });

  test("leaves optional startup work untouched when nothing is configured", async () => {
    mockLaunchWithoutCliFile();

    await act(async () => root.render(<Probe />));

    expect(mocks.analytics.enable).not.toHaveBeenCalled();
    expect(mocks.analytics.capture).not.toHaveBeenCalled();
    expect(mocks.getVersion).not.toHaveBeenCalled();
    expect(mocks.info).not.toHaveBeenCalledWith(
      expect.stringContaining("Opening file from command line"),
    );
    expect(mocks.preloadReferenceDb).not.toHaveBeenCalled();
    expect(mocks.info).not.toHaveBeenCalledWith(
      expect.stringContaining("Preloading reference database"),
    );
    expect(mocks.closeSplashscreen).toHaveBeenCalledOnce();
  });

  test("preloads the configured reference database", async () => {
    storeValues.referenceDb = "reference.db3";
    mockLaunchWithoutCliFile();

    await act(async () => root.render(<Probe />));

    expect(mocks.preloadReferenceDb).toHaveBeenCalledWith(
      "reference.db3",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(mocks.info).toHaveBeenCalledWith("Preloading reference database: reference.db3");
    expect(mocks.closeSplashscreen).toHaveBeenCalledOnce();
  });

  test("reports a reference database preload failure without failing startup", async () => {
    storeValues.referenceDb = "reference.db3";
    mockLaunchWithoutCliFile();
    mocks.preloadReferenceDb.mockRejectedValue(new Error("database missing"));

    await act(async () => root.render(<Probe />));

    expect(mocks.warn).toHaveBeenCalledWith(
      expect.stringContaining("Failed to preload reference database: Error: database missing"),
    );
    expect(mocks.closeSplashscreen).toHaveBeenCalledOnce();
  });

  test("stays silent when the reference preload rejects because startup was cancelled", async () => {
    storeValues.referenceDb = "reference.db3";
    mockLaunchWithoutCliFile();

    let rejectPreload: (error: Error) => void = () => undefined;
    mocks.preloadReferenceDb.mockImplementation(
      () =>
        new Promise((_resolve, reject) => {
          rejectPreload = reject;
        }),
    );

    await act(async () => root.render(<Probe />));
    expect(mocks.preloadReferenceDb).toHaveBeenCalledOnce();

    await act(async () => root.unmount());
    await act(async () => {
      rejectPreload(new Error("aborted"));
    });

    expect(mocks.warn).not.toHaveBeenCalledWith(
      expect.stringContaining("Failed to preload reference database"),
    );
    expect(mocks.closeSplashscreen).not.toHaveBeenCalled();
  });

  test("skips the reference preload when startup was cancelled before it began", async () => {
    storeValues.referenceDb = "reference.db3";
    mocks.attachConsole.mockResolvedValue(vi.fn());

    let resolveMatches: (matches: {
      args: { file: { occurrences: number; value: string } };
    }) => void = () => undefined;
    mocks.getMatches.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveMatches = resolve;
        }),
    );

    await act(async () => root.render(<Probe />));
    await act(async () => root.unmount());
    await act(async () => {
      resolveMatches(noCliFileArgs);
    });

    expect(mocks.preloadReferenceDb).not.toHaveBeenCalled();
    expect(mocks.closeSplashscreen).not.toHaveBeenCalled();
  });

  test("detaches a console listener that arrives after cancellation", async () => {
    const detach = vi.fn();
    let resolveAttach: (detachFn: () => void) => void = () => undefined;
    mocks.attachConsole.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveAttach = resolve;
        }),
    );
    mocks.getMatches.mockResolvedValue(noCliFileArgs);

    await act(async () => root.render(<Probe />));
    await act(async () => root.unmount());
    await act(async () => {
      resolveAttach(detach);
    });

    expect(detach).toHaveBeenCalledOnce();
    expect(mocks.getMatches).not.toHaveBeenCalled();
    expect(mocks.closeSplashscreen).not.toHaveBeenCalled();
  });

  test("stops before telemetry when startup is cancelled during reconciliation", async () => {
    let resolveOwners: () => void = () => {};
    mocks.reconcileStartupPathOwners.mockImplementation(
      () =>
        new Promise<null>((resolve) => {
          resolveOwners = () => resolve(null);
        }),
    );

    await act(async () => root.render(<Probe />));
    await act(async () => root.unmount());
    await act(async () => resolveOwners());

    expect(mocks.attachConsole).not.toHaveBeenCalled();
    expect(mocks.closeSplashscreen).not.toHaveBeenCalled();
  });

  test("does not report a start when cancellation lands while the version is read", async () => {
    storeValues.telemetryEnabled = true;
    mocks.attachConsole.mockResolvedValue(vi.fn());
    let resolveVersion: (version: string) => void = () => undefined;
    mocks.getVersion.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveVersion = resolve;
        }),
    );

    await act(async () => root.render(<Probe />));
    await act(async () => root.unmount());
    await act(async () => {
      resolveVersion("1.2.3");
    });

    expect(mocks.analytics.enable).toHaveBeenCalledOnce();
    expect(mocks.analytics.capture).not.toHaveBeenCalled();
    expect(mocks.getMatches).not.toHaveBeenCalled();
    expect(mocks.closeSplashscreen).not.toHaveBeenCalled();
  });

  test("reports unreadable CLI arguments and still finishes startup", async () => {
    mocks.attachConsole.mockResolvedValue(vi.fn());
    mocks.getMatches.mockRejectedValue(new Error("argv unavailable"));

    await act(async () => root.render(<Probe />));

    expect(mocks.warn).toHaveBeenCalledWith(
      expect.stringContaining("Failed to parse CLI args: Error: argv unavailable"),
    );
    expect(mocks.closeSplashscreen).toHaveBeenCalledOnce();
  });

  test("reports a startup failure when the splashscreen refuses to close", async () => {
    mockLaunchWithoutCliFile();
    mocks.closeSplashscreen.mockRejectedValue(new Error("splash window gone"));

    await act(async () => root.render(<Probe />));

    expect(mocks.warn).toHaveBeenCalledWith(
      expect.stringContaining("Application startup failed: Error: splash window gone"),
    );
  });

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
      resolveMatches(noCliFileArgs);
    });
  });
});

describe("App", () => {
  test("applies the persisted font size and theme settings", async () => {
    mockLaunchWithoutCliFile();

    await act(async () => root.render(<App />));

    expect(document.documentElement.style.fontSize).toBe("120%");
    expect(mocks.createAppTheme).toHaveBeenCalledWith({ primaryColor: "blue", spellCheck: true });
    expect(mocks.closeSplashscreen).toHaveBeenCalledOnce();
  });

  /** `convert_progress` was lost once because a listener was deleted from this composition file
   * and nothing noticed (`.claude/rules/ipc-events.md`). Coverage cannot see that: a deleted hook
   * call leaves no uncovered line behind. These assertions are what does. */
  test("keeps the renderer-side subscriptions wired", async () => {
    mockLaunchWithoutCliFile();

    await act(async () => root.render(<App />));

    expect(mocks.useConversionProgress).toHaveBeenCalled();
    expect(mocks.useDocumentLanguage).toHaveBeenCalled();
  });
});
