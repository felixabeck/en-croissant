import { beforeEach, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getDatabaseWorkspace: vi.fn(),
  createWorkspaceDatabase: vi.fn(),
  listWorkspaceDatabases: vi.fn(),
  convertPgn: vi.fn(),
}));

vi.mock("@/platform/tauri", () => ({ tauri: mocks }));

import { convertLocalDatabaseWithLoading } from "./AddDatabase";

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(crypto, "randomUUID").mockReturnValue("00000000-0000-4000-8000-000000000001");
});

test("continues conversion with a handle recovered after an uncertain create", async () => {
  const root = { id: { id: "database-root" }, kind: "databaseRoot" };
  const handle = { id: { id: "database" }, kind: "database" };
  const source = { id: { id: "source" }, kind: "fileWorkspace" } as const;
  mocks.getDatabaseWorkspace.mockResolvedValue(root);
  mocks.createWorkspaceDatabase.mockRejectedValue(
    new Error("Committed but durability uncertain: registry replacement"),
  );
  mocks.listWorkspaceDatabases.mockResolvedValue([
    {
      handle,
      filename: "00000000-0000-4000-8000-000000000001.db3",
      availability: "available",
    },
  ]);
  mocks.convertPgn.mockResolvedValue(undefined);
  const onCreated = vi.fn();
  const loading: boolean[] = [];

  await expect(
    convertLocalDatabaseWithLoading([source], "Imported", "notes", onCreated, (value) =>
      loading.push(value as boolean),
    ),
  ).resolves.toBe(handle);
  expect(loading).toEqual([true, false]);
  expect(onCreated).toHaveBeenCalledWith(handle);
  expect(mocks.convertPgn).toHaveBeenCalledWith([source], handle, null, "Imported", "notes");
});
