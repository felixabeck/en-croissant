import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import useSWR, { SWRConfig, unstable_serialize, useSWRConfig } from "swr";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { useNativeRequestOwner } from "@/hooks/useNativeRequestOwner";
import { createFile } from "@/utils/files";
import { TauriCommandError } from "@/platform/tauri";
import { workspaceEntryToEntry } from "./file";
import { workspaceListingKey, type WorkspaceListingCache } from "./workspaceListing";

const native = vi.hoisted(() => ({ createWorkspaceFile: vi.fn(), listFileWorkspace: vi.fn() }));
vi.mock("@/platform/tauri", async (original) => ({
  ...(await original<typeof import("@/platform/tauri")>()),
  tauri: native,
}));

const workspace = { id: { id: "A" }, kind: "fileWorkspace" } as const;
const key = workspaceListingKey(workspace);
const leftover = {
  handle: { id: { id: "leftover" }, kind: "fileWorkspace" },
  kind: "file",
  name: "Created",
  children: [],
  metadata: { type: "game", tags: [] },
  gameCount: 1,
  lastModified: 1,
} as const;
let host: HTMLDivElement;
let root: Root;
let context!: WorkspaceListingCache;
let result: Awaited<ReturnType<typeof createFile>> | undefined;
function Reader({ visible }: { visible: boolean }) {
  context = useSWRConfig();
  const owner = useNativeRequestOwner(visible ? key : null);
  const { data } = useSWR(visible ? key : null, () =>
    owner!.run(async (signal) =>
      (await native.listFileWorkspace(workspace, { signal })).map(workspaceEntryToEntry),
    ),
  );
  return (
    <>
      <output>{data?.map((entry: { name: string }) => entry.name).join(",")}</output>
      <button
        onClick={async () => {
          result = await createFile({
            workspace,
            parent: workspace,
            filename: "Created",
            filetype: "game",
            listingCache: context,
          });
        }}
      >
        Create
      </button>
    </>
  );
}
beforeEach(() => {
  vi.resetAllMocks();
  result = undefined;
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});

test.each([false, true])(
  "createFile keeps typed cleanup error with real SWR, relist failure=%s",
  async (fails) => {
    const cause = new TauriCommandError({
      tag: "backend-error",
      category: "operation-and-cleanup",
      message: "private diagnostic",
    });
    native.createWorkspaceFile.mockRejectedValueOnce(cause);
    native.listFileWorkspace.mockResolvedValueOnce([]);
    if (fails) native.listFileWorkspace.mockRejectedValueOnce(new Error("relist failed"));
    else native.listFileWorkspace.mockResolvedValueOnce([leftover]);
    const cache = new Map();
    await act(async () =>
      root.render(
        <SWRConfig
          value={{ provider: () => cache, shouldRetryOnError: false, revalidateOnFocus: false }}
        >
          <Reader visible />
        </SWRConfig>,
      ),
    );
    await act(async () => host.querySelector("button")!.click());
    expect(result?.isErr).toBe(true);
    if (!result?.isErr) throw new Error("Expected cleanup to remain an error Result");
    expect(result.error).toBe(cause);
    expect((result.error as TauriCommandError).details.backendCategory).toBe(
      "operation-and-cleanup",
    );
    expect(native.listFileWorkspace).toHaveBeenCalledTimes(2);
    expect(native.listFileWorkspace).toHaveBeenLastCalledWith(workspace, {
      signal: expect.any(AbortSignal),
    });
    expect(native.createWorkspaceFile).toHaveBeenCalledOnce();
    expect(host.querySelector("output")?.textContent).toBe(fails ? "" : "Created");
  },
);

test("inactive createFile invalidates only its owning provider and fetches on next mount", async () => {
  const cause = new TauriCommandError({
    tag: "backend-error",
    category: "operation-and-cleanup",
    message: "private diagnostic",
  });
  native.createWorkspaceFile.mockRejectedValueOnce(cause);
  native.listFileWorkspace.mockResolvedValue([leftover]);
  const cache = new Map([[unstable_serialize(key), { data: [{ name: "stale" }] }]]);
  const foreignCache = new Map([[unstable_serialize(key), { data: [{ name: "foreign" }] }]]);
  async function render(visible: boolean) {
    await act(async () =>
      root.render(
        <>
          <SWRConfig
            value={{ provider: () => cache, shouldRetryOnError: false, revalidateOnFocus: false }}
          >
            <Reader visible={visible} />
          </SWRConfig>
          <SWRConfig value={{ provider: () => foreignCache }}>
            <span>Other cache</span>
          </SWRConfig>
        </>,
      ),
    );
  }
  await render(false);
  await act(async () => host.querySelector("button")!.click());
  expect(result?.isErr).toBe(true);
  expect(cache.get(unstable_serialize(key))?.data).toBeUndefined();
  expect(foreignCache.get(unstable_serialize(key))?.data).toEqual([{ name: "foreign" }]);
  expect(native.listFileWorkspace).toHaveBeenCalledOnce();
  await render(true);
  await vi.waitFor(() => expect(host.querySelector("output")?.textContent).toBe("Created"));
  expect(native.listFileWorkspace).toHaveBeenCalledTimes(2);
});

test("inactive cleanup retires SWR's completed pre-mutation fetch before immediate remount", async () => {
  const cause = new TauriCommandError({
    tag: "backend-error",
    category: "operation-and-cleanup",
    message: "private diagnostic",
  });
  native.createWorkspaceFile.mockRejectedValueOnce(cause);
  native.listFileWorkspace.mockResolvedValueOnce([]).mockResolvedValue([leftover]);
  const cache = new Map();
  async function render(visible: boolean) {
    await act(async () =>
      root.render(
        <SWRConfig
          value={{
            provider: () => cache,
            dedupingInterval: 60000,
            revalidateOnFocus: false,
            shouldRetryOnError: false,
          }}
        >
          <Reader visible={visible} />
        </SWRConfig>,
      ),
    );
  }
  await render(true);
  expect(native.listFileWorkspace).toHaveBeenCalledOnce();
  await render(false);
  await act(async () => host.querySelector("button")!.click());
  expect(result?.isErr).toBe(true);
  expect(native.listFileWorkspace).toHaveBeenCalledTimes(2);
  await render(true);
  await vi.waitFor(() => expect(host.querySelector("output")?.textContent).toBe("Created"));
  expect(native.listFileWorkspace).toHaveBeenCalledTimes(3);
});
