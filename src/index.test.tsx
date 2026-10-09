import type { ReactElement } from "react";
import { beforeEach, expect, test, vi } from "vitest";
import App from "./App";
import { StartupStorageFailure } from "./components/home/StartupStorageFailure";
import i18n from "./i18n";

const {
  render,
  createRoot,
  logFailureSafely,
  closeSplashscreen,
  initializeI18n,
  releasePreviousDocumentOperations,
  initializeWorkspace,
} = vi.hoisted(() => {
  const render = vi.fn();
  return {
    render,
    createRoot: vi.fn(() => ({ render })),
    logFailureSafely: vi.fn().mockResolvedValue(undefined),
    closeSplashscreen: vi.fn().mockResolvedValue(undefined),
    initializeI18n: vi.fn().mockResolvedValue(undefined),
    releasePreviousDocumentOperations: vi.fn().mockResolvedValue(null),
    initializeWorkspace: vi.fn(),
  };
});

vi.mock("react-dom/client", () => ({ createRoot }));
vi.mock("./App", () => ({ default: () => null }));
vi.mock("./state/atoms", () => ({ initializeWorkspace }));
vi.mock("./components/home/StartupStorageFailure", () => ({ StartupStorageFailure: () => null }));
vi.mock("./platform/errors", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./platform/errors")>()),
  logFailureSafely,
}));
vi.mock("./platform/tauri", () => ({
  tauri: { closeSplashscreen, releasePreviousDocumentOperations },
}));
// Only the bootstrap call is stubbed. `SessionSanitizationError` stays the real
// class so the terminal branch is pinned to the error the product actually throws.
vi.mock("./utils/session", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./utils/session")>()),
  initializePersistedSessions: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("./i18n", () => ({ default: {}, initializeI18n }));
vi.mock("react-i18next", () => ({
  I18nextProvider: ({ children }: { children: React.ReactNode }) => children,
}));

beforeEach(() => {
  document.body.innerHTML = '<div id="app"></div>';
  createRoot.mockClear();
  render.mockClear();
  initializeI18n.mockClear();
  logFailureSafely.mockClear();
  closeSplashscreen.mockClear();
  releasePreviousDocumentOperations.mockReset().mockResolvedValue(null);
  initializeWorkspace.mockReset();
  localStorage.clear();
  vi.resetModules();
});

test("awaits the previous-document sweep before sessions, i18n and rendering", async () => {
  const sessions = await import("./utils/session");
  vi.mocked(sessions.initializePersistedSessions).mockClear();
  let finishSweep!: () => void;
  releasePreviousDocumentOperations.mockReturnValueOnce(
    new Promise<void>((resolve) => {
      finishSweep = resolve;
    }),
  );
  const { applicationStartup } = await import("./index");
  expect(initializeWorkspace).toHaveBeenCalledExactlyOnceWith();
  expect(initializeWorkspace.mock.invocationCallOrder[0]).toBeLessThan(
    releasePreviousDocumentOperations.mock.invocationCallOrder[0] ?? 0,
  );
  expect(releasePreviousDocumentOperations).toHaveBeenCalledExactlyOnceWith();
  expect(sessions.initializePersistedSessions).not.toHaveBeenCalled();
  expect(initializeI18n).not.toHaveBeenCalled();
  expect(render).not.toHaveBeenCalled();
  finishSweep();
  await applicationStartup;
  expect(sessions.initializePersistedSessions).toHaveBeenCalledTimes(1);
  expect(initializeI18n).toHaveBeenCalledTimes(1);
  expect(renderedChild().type).toBe(App);
});

test("a refused synchronous workspace initialization prevents bootstrap and rendering", async () => {
  const failure = new DOMException("workspace read refused", "SecurityError");
  initializeWorkspace.mockImplementationOnce(() => {
    throw failure;
  });
  const sessions = await import("./utils/session");
  vi.mocked(sessions.initializePersistedSessions).mockClear();

  await expect(import("./index")).rejects.toBe(failure);

  expect(releasePreviousDocumentOperations).not.toHaveBeenCalled();
  expect(sessions.initializePersistedSessions).not.toHaveBeenCalled();
  expect(initializeI18n).not.toHaveBeenCalled();
  expect(createRoot).not.toHaveBeenCalled();
  expect(render).not.toHaveBeenCalled();
});

test("logs a rejected previous-document sweep and still renders the application", async () => {
  releasePreviousDocumentOperations.mockRejectedValueOnce({
    tag: "backend-error",
    category: "network",
    message: "native registry request failed at /home/private/registry token=secret-registry-token",
  });
  const { applicationStartup } = await import("./index");
  await expect(applicationStartup).resolves.toBeUndefined();
  expect(logFailureSafely).toHaveBeenCalledExactlyOnceWith(
    "StartupReservationReleaseError: network: native registry request failed at [path] token=[redacted]",
    {
      operation: "releasePreviousDocumentOperations",
      primaryFailure: {
        category: "network",
        message: "native registry request failed at [path] token=[redacted]",
      },
    },
    "Startup reservation release failed",
  );
  expect(initializeI18n).toHaveBeenCalledTimes(1);
  expect(render).toHaveBeenCalledTimes(1);
  expect(renderedChild().type).toBe(App);
});

test("initialises the browser application root", async () => {
  const { applicationStartup } = await import("./index");
  await applicationStartup;

  expect(createRoot).toHaveBeenCalledWith(document.getElementById("app"));
  expect(render).toHaveBeenCalledTimes(1);
  expect(initializeI18n).toHaveBeenCalledTimes(1);
  expect(renderedChild().type).toBe(App);
  expect(closeSplashscreen).not.toHaveBeenCalled();
  expect(logFailureSafely).not.toHaveBeenCalled();
});

function renderedChild() {
  const provider = render.mock.calls[0]?.[0] as ReactElement<{
    i18n: unknown;
    children: ReactElement;
  }>;
  expect(provider.props.i18n).toBe(i18n);
  return provider.props.children;
}

test.each([
  [false, true],
  [true, true],
  [true, false],
])(
  "renders the terminal view for summary %s/%s without exposing credentials",
  async (legacySignInFound, allRevoked) => {
    const sessions = await import("./utils/session");
    const token = "secret-legacy-bearer-token";
    const username = "private-account-name";
    localStorage.setItem(
      "sessions",
      JSON.stringify([{ lichess: { accessToken: token, username } }]),
    );
    const error = new sessions.SessionSanitizationError(legacySignInFound, allRevoked);
    error.message = `${token} ${username}`;
    vi.mocked(sessions.initializePersistedSessions).mockRejectedValueOnce(error);

    const { applicationStartup } = await import("./index");

    await expect(applicationStartup).resolves.toBeUndefined();
    expect(initializeI18n).toHaveBeenCalledTimes(1);
    expect(render).toHaveBeenCalledTimes(1);
    expect(renderedChild().type).toBe(StartupStorageFailure);
    expect(renderedChild().type).not.toBe(App);
    expect(renderedChild().props).toEqual({ legacySignInFound, allRevoked });
    expect(closeSplashscreen).toHaveBeenCalledExactlyOnceWith();
    expect(logFailureSafely).toHaveBeenCalledTimes(1);
    const diagnostic = `SessionSanitizationError: legacySignInFound=${legacySignInFound}, allRevoked=${allRevoked}`;
    expect(logFailureSafely).toHaveBeenCalledWith(
      diagnostic,
      {
        operation: "initializePersistedSessions",
        primaryFailure: { category: "unexpected", message: diagnostic },
      },
      "Session sanitization failed",
    );
    expect(JSON.stringify(logFailureSafely.mock.calls)).not.toContain(token);
    expect(JSON.stringify(logFailureSafely.mock.calls)).not.toContain(username);
    expect(initializeI18n.mock.invocationCallOrder[0]).toBeLessThan(
      render.mock.invocationCallOrder[0] ?? 0,
    );
    expect(render.mock.invocationCallOrder[0]).toBeLessThan(
      closeSplashscreen.mock.invocationCallOrder[0] ?? 0,
    );
    expect(closeSplashscreen.mock.invocationCallOrder[0]).toBeLessThan(
      logFailureSafely.mock.invocationCallOrder[0] ?? 0,
    );
  },
);

test("renders and reveals the terminal view even when i18n initialization rejects", async () => {
  const sessions = await import("./utils/session");
  vi.mocked(sessions.initializePersistedSessions).mockRejectedValueOnce(
    new sessions.SessionSanitizationError(true, false),
  );
  initializeI18n.mockRejectedValueOnce(new Error("locale load failed"));
  const { applicationStartup } = await import("./index");
  await expect(applicationStartup).resolves.toBeUndefined();
  expect(initializeI18n).toHaveBeenCalledTimes(1);
  expect(render).toHaveBeenCalledTimes(1);
  expect(renderedChild().type).toBe(StartupStorageFailure);
  expect(renderedChild().props).toEqual({ legacySignInFound: true, allRevoked: false });
  expect(closeSplashscreen).toHaveBeenCalledExactlyOnceWith();
  expect(logFailureSafely).toHaveBeenCalledTimes(1);
});

test("logs a sanitized reveal failure and resolves startup", async () => {
  const sessions = await import("./utils/session");
  vi.mocked(sessions.initializePersistedSessions).mockRejectedValueOnce(
    new sessions.SessionSanitizationError(),
  );
  closeSplashscreen.mockRejectedValueOnce(new Error("token=secret username=private"));
  const { applicationStartup } = await import("./index");
  await expect(applicationStartup).resolves.toBeUndefined();
  expect(render).toHaveBeenCalledTimes(1);
  expect(renderedChild().type).toBe(StartupStorageFailure);
  expect(closeSplashscreen).toHaveBeenCalledExactlyOnceWith();
  expect(logFailureSafely).toHaveBeenCalledTimes(2);
  expect(logFailureSafely).toHaveBeenNthCalledWith(
    1,
    "StartupWindowRevealError",
    {
      operation: "closeSplashscreen",
      primaryFailure: { category: "unexpected", message: "StartupWindowRevealError" },
    },
    "Startup window reveal failed",
  );
  const diagnostic = "SessionSanitizationError: legacySignInFound=false, allRevoked=true";
  expect(logFailureSafely).toHaveBeenNthCalledWith(
    2,
    diagnostic,
    {
      operation: "initializePersistedSessions",
      primaryFailure: { category: "unexpected", message: diagnostic },
    },
    "Session sanitization failed",
  );
  expect(closeSplashscreen.mock.invocationCallOrder[0]).toBeLessThan(
    logFailureSafely.mock.invocationCallOrder[0] ?? 0,
  );
});

test("mounts after a non-sensitive reconciliation failure", async () => {
  const sessions = await import("./utils/session");
  vi.mocked(sessions.initializePersistedSessions).mockRejectedValueOnce(
    new Error("native account lookup failed"),
  );

  const { applicationStartup } = await import("./index");
  await applicationStartup;

  expect(initializeI18n).toHaveBeenCalledTimes(1);
  expect(render).toHaveBeenCalledTimes(1);
  expect(renderedChild().type).toBe(App);
  expect(closeSplashscreen).not.toHaveBeenCalled();
  expect(logFailureSafely).not.toHaveBeenCalled();
});
