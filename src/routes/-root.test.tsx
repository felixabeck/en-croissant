import { beforeEach, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  ensureMigration: vi.fn(),
  runMigration: vi.fn(),
}));

vi.mock("@/state/practiceStorage", () => ({
  ensurePracticeMigration: mocks.ensureMigration,
  runPracticeMigrationPass: mocks.runMigration,
}));
vi.mock("@/state/atoms", () => ({ nativeBarAtom: {}, tabsAtom: {} }));
vi.mock("@/state/keybinds", () => ({ keyMapAtom: {} }));
vi.mock("@/platform/native", () => ({
  Menu: {},
  MenuItem: {},
  PredefinedMenuItem: {},
  Submenu: {},
  ask: vi.fn(),
  exit: vi.fn(),
  getCurrentWindow: vi.fn(),
  platform: vi.fn(() => "linux"),
}));
vi.mock("@/platform/tauri", () => ({ tauri: { openAppLog: vi.fn(), openDocumentation: vi.fn() } }));
vi.mock("@/components/About", () => ({ default: () => null }));
vi.mock("@/components/Sidebar", () => ({ SideBar: () => null }));
vi.mock("@/components/TopBar", () => ({ default: () => null }));
vi.mock("@/utils/files", () => ({ openFile: vi.fn(), pickPgnFile: vi.fn() }));
vi.mock("@mantine/core", () => ({ AppShell: {} }));
vi.mock("@mantine/notifications", () => ({ notifications: { show: vi.fn() } }));
vi.mock("@tanstack/react-router", () => ({
  Outlet: () => null,
  createRootRouteWithContext: () => (options: unknown) => options,
  useNavigate: () => vi.fn(),
}));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

import { clearSavedDataAfterConfirmation } from "./__root";
import { clearSavedDataFromMenu } from "./-appMenu";

beforeEach(() => {
  mocks.ensureMigration.mockReset().mockResolvedValue({});
  mocks.runMigration.mockReset();
});

async function clearThroughProductionPath(
  result: unknown,
  clear: () => void | Promise<void>,
): Promise<void> {
  mocks.runMigration.mockResolvedValue(result);
  await clearSavedDataFromMenu({
    ask: async () => true,
    confirmMessage: "confirm",
    title: "title",
    clear: () =>
      clearSavedDataAfterConfirmation({
        blockedMessage: (decks) => `blocked: ${decks.join(", ")}`,
        clear,
      }),
  });
}

test("the production clear path refuses after a failed migration", async () => {
  const clear = vi.fn();

  await expect(
    clearThroughProductionPath(
      {
        outcomes: [
          {
            key: "deck-failed-0",
            identity: { file: "failed", game: 0 },
            status: "failed",
          },
        ],
        inventory: { decks: [], anomalies: [] },
        scanTrusted: true,
        inventoryTrusted: true,
      },
      clear,
    ),
  ).rejects.toThrow("failed (0)");
  expect(clear).not.toHaveBeenCalled();
});

test("the production clear path refuses when inventory reports a damaged deck", async () => {
  const clear = vi.fn();

  await expect(
    clearThroughProductionPath(
      {
        outcomes: [],
        inventory: {
          decks: [],
          anomalies: [{ kind: "OrphanShard", leaf: "orphan", fileId: "damaged", game: 2 }],
        },
        scanTrusted: true,
        inventoryTrusted: true,
      },
      clear,
    ),
  ).rejects.toThrow("damaged (2)");
  expect(clear).not.toHaveBeenCalled();
});

test("the production clear path waits for migration and runs a fresh pass before clearing", async () => {
  const migration = deferred<void>();
  const clear = vi.fn();
  mocks.ensureMigration.mockReturnValueOnce(migration.promise);
  mocks.runMigration.mockResolvedValueOnce({
    outcomes: [],
    inventory: { decks: [], anomalies: [] },
    scanTrusted: true,
    inventoryTrusted: true,
  });

  const clearing = clearSavedDataFromMenu({
    ask: async () => true,
    confirmMessage: "confirm",
    title: "title",
    clear: () =>
      clearSavedDataAfterConfirmation({
        blockedMessage: (decks) => `blocked: ${decks.join(", ")}`,
        clear,
      }),
  });
  await Promise.resolve();
  expect(clear).not.toHaveBeenCalled();
  expect(mocks.runMigration).not.toHaveBeenCalled();

  migration.resolve();
  await clearing;
  expect(mocks.runMigration).toHaveBeenCalledOnce();
  expect(clear).toHaveBeenCalledOnce();
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}
