import { beforeEach, expect, test, vi } from "vitest";

const render = vi.fn();
const createRoot = vi.fn(() => ({ render }));

vi.mock("react-dom/client", () => ({ createRoot }));
vi.mock("./App", () => ({ default: () => null }));
// Only the bootstrap call is stubbed. `SessionSanitizationError` stays the real
// class so the fail-closed assertion below is pinned to the message the product
// actually throws; a hand-written double silently made that assertion vacuous.
vi.mock("./utils/session", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./utils/session")>()),
  initializePersistedSessions: vi.fn().mockResolvedValue(undefined),
}));
const initializeI18n = vi.fn().mockResolvedValue(undefined);
vi.mock("./i18n", () => ({ default: {}, initializeI18n }));
vi.mock("react-i18next", () => ({
  I18nextProvider: ({ children }: { children: React.ReactNode }) => children,
}));

beforeEach(() => {
  document.body.innerHTML = '<div id="app"></div>';
  createRoot.mockClear();
  render.mockClear();
  initializeI18n.mockClear();
  vi.resetModules();
});

test("initialises the browser application root", async () => {
  const { applicationStartup } = await import("./index");
  await applicationStartup;

  expect(createRoot).toHaveBeenCalledWith(document.getElementById("app"));
  expect(render).toHaveBeenCalledTimes(1);
  expect(initializeI18n).toHaveBeenCalledTimes(1);
});

test("fails closed before mounting when credential sanitization cannot be persisted", async () => {
  const sessions = await import("./utils/session");
  vi.mocked(sessions.initializePersistedSessions).mockRejectedValueOnce(
    new sessions.SessionSanitizationError(),
  );

  const { applicationStartup } = await import("./index");

  await expect(applicationStartup).rejects.toThrow("account storage could not be sanitized");
  expect(initializeI18n).not.toHaveBeenCalled();
  expect(render).not.toHaveBeenCalled();
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
});
