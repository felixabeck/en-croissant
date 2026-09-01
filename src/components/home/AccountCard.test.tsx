import { expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getDatabaseWorkspace: vi.fn(),
  createWorkspaceDatabase: vi.fn(),
  listWorkspaceDatabases: vi.fn(),
}));

vi.mock("@/platform/tauri", () => ({
  tauri: mocks,
  tauriSubscriptions: { progress: vi.fn() },
}));

import { ensureAccountDatabaseHandle } from "./AccountCard";

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
