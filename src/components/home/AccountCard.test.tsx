import { MantineProvider } from "@mantine/core";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getDatabaseWorkspace: vi.fn(),
  createWorkspaceDatabase: vi.fn(),
  listWorkspaceDatabases: vi.fn(),
  getDatabases: vi.fn(),
  progress: vi.fn(),
}));

vi.mock("@/platform/tauri", () => ({
  tauri: mocks,
  tauriSubscriptions: { progress: mocks.progress },
}));
vi.mock("@/utils/db", () => ({ getDatabases: mocks.getDatabases }));
vi.mock("@mantine/notifications", () => ({ notifications: { show: vi.fn() } }));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: () => ({
    matches: false,
    media: "",
    onchange: null,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
  }),
});

import { AccountCard, ensureAccountDatabaseHandle } from "./AccountCard";

test("recovers an account database handle after an uncertain create", async () => {
  const root = { id: { id: "database-root" }, kind: "databaseRoot" };
  const handle = { id: { id: "database" }, kind: "database" };
  mocks.getDatabaseWorkspace.mockResolvedValue(root);
  mocks.listWorkspaceDatabases
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([{ handle, filename: "Felix_lichess.db3", availability: "available" }]);
  mocks.createWorkspaceDatabase.mockRejectedValue(
    new Error("Committed but durability uncertain: registry replacement"),
  );

  await expect(ensureAccountDatabaseHandle(undefined, "Felix", "lichess")).resolves.toBe(handle);
  expect(mocks.createWorkspaceDatabase).toHaveBeenCalledWith(root, "Felix_lichess.db3");
  expect(mocks.listWorkspaceDatabases).toHaveBeenCalledTimes(2);
});

test("does not refresh databases after unmount", async () => {
  let progressListener!: (event: {
    payload: { id: string; progress: number; finished: boolean };
  }) => void;
  let resolveDatabases!: (databases: []) => void;
  const setDatabases = vi.fn();
  mocks.progress.mockImplementation(async (listener) => {
    progressListener = listener;
    return vi.fn();
  });
  mocks.getDatabases.mockReturnValue(
    new Promise<[]>((resolve) => {
      resolveDatabases = resolve;
    }),
  );
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  await act(async () => {
    root.render(
      <MantineProvider>
        <AccountCard
          type="lichess"
          database={null}
          title="Felix"
          updatedAt={0}
          total={0}
          stats={[]}
          logout={vi.fn()}
          reload={vi.fn()}
          setDatabases={setDatabases}
        />
      </MantineProvider>,
    );
  });
  act(() => {
    progressListener({ payload: { id: "lichess_Felix", progress: 100, finished: true } });
  });

  await act(async () => root.unmount());
  await act(async () => resolveDatabases([]));

  expect(setDatabases).not.toHaveBeenCalled();
  host.remove();
});
