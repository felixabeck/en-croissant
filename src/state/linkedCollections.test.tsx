import { act } from "react";
import { createRoot } from "react-dom/client";
import useSWR, { SWRConfig } from "swr";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import type { CollectionDescriptor, DatabaseHandle } from "@/bindings";
import { registerCollectionCheck, startFileRevisionPoll } from "./fileFreshness";
import {
  isCollectionConsumer,
  useCollectionCurrencies,
  useCollectionCurrency,
} from "./linkedCollections";

const mocks = vi.hoisted(() => ({ read: vi.fn(), rebuild: vi.fn() }));
vi.mock("@/platform/tauri", () => ({
  tauri: { collectionForDatabase: mocks.read, rebuildLinkedCollection: mocks.rebuild },
}));
const handle: DatabaseHandle = { id: { id: "linked-cache" }, kind: "database" };
const collection: CollectionDescriptor = {
  id: "22222222-2222-4222-8222-222222222222",
  name: "Games",
  file: { id: { id: "source" }, kind: "fileWorkspace" },
  database: handle,
  account: null,
  status: "ready",
  generation: "first",
  omitted: 0,
  retiredDatabase: null,
  fetchSinceMs: null,
};
let host: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
let stop: () => void;
let focus: () => void;

function Consumer({ file = handle }: { file?: DatabaseHandle | null }) {
  const state = useCollectionCurrency(file);
  return (
    <output>
      {state.pending
        ? "pending"
        : state.error
          ? "error"
          : (state.collection?.generation ?? "standalone")}
    </output>
  );
}

const dataKeys = [
  "databases",
  ["file-workspace", collection.file],
  ["games", handle, {}],
  ["players", handle, {}],
  ["tournaments", handle, {}],
  ["personalDatabases", []],
  ["personalInfo", "Player", []],
] as const;

function DataConsumer({
  dataKey,
  fetcher,
}: {
  dataKey: (typeof dataKeys)[number];
  fetcher: () => Promise<string>;
}) {
  const { data } = useSWR(dataKey, fetcher);
  return <output data-collection-data>{data ?? "loading"}</output>;
}

function CollectionList({ values }: { values: CollectionDescriptor[] }) {
  useCollectionCurrencies(values);
  return null;
}

test("list summaries and individual references share currency checks and all composed data keys", async () => {
  await act(async () =>
    root.render(
      <>
        <CollectionList values={[collection]} />
        <Consumer />
      </>,
    ),
  );
  await flush();
  expect(mocks.read).toHaveBeenCalledOnce();
  await act(async () =>
    root.render(
      <>
        <CollectionList values={[]} />
        <Consumer />
      </>,
    ),
  );
  for (const key of [
    "databases",
    ["file-workspace"],
    ["games"],
    ["players"],
    ["tournaments"],
    ["personalDatabases"],
    ["personalInfo"],
  ])
    expect(isCollectionConsumer(key)).toBe(true);
  expect(isCollectionConsumer(["unrelated"])).toBe(false);
  expect(isCollectionConsumer(null)).toBe(false);
});

async function flush() {
  await act(async () => {
    for (let i = 0; i < 12; i++) await Promise.resolve();
  });
}
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.useFakeTimers();
  mocks.read.mockReset().mockResolvedValue(collection);
  mocks.rebuild.mockReset().mockResolvedValue(collection);
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  stop = startFileRevisionPoll({
    getTabs: () => [],
    fileRevision: vi.fn(),
    subscribeFocus: (callback) => {
      focus = callback;
      return () => undefined;
    },
  });
});
afterEach(async () => {
  await act(async () => root.unmount());
  stop();
  host.remove();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

test.each(["list", "reference"])(
  "mounted %s currency revalidates displayed SWR data on the root clock and focus",
  async (owner) => {
    let nativeData = "first data";
    const fetcher = vi.fn(async () => nativeData);
    await act(async () =>
      root.render(
        <SWRConfig
          value={{
            provider: () => new Map(),
            shouldRetryOnError: false,
            dedupingInterval: 0,
            revalidateOnFocus: false,
            revalidateOnReconnect: false,
          }}
        >
          {owner === "list" ? (
            <CollectionList values={[collection]} />
          ) : (
            <>
              <Consumer />
              <Consumer />
            </>
          )}
          {dataKeys.map((dataKey, index) => (
            <DataConsumer key={index} dataKey={dataKey} fetcher={fetcher} />
          ))}
        </SWRConfig>,
      ),
    );
    await flush();
    expect(mocks.read).toHaveBeenCalledTimes(1);
    const displayed = () =>
      Array.from(host.querySelectorAll("[data-collection-data]"), (node) => node.textContent);
    expect(displayed()).toEqual(dataKeys.map(() => "first data"));
    nativeData = "second data";
    mocks.read.mockResolvedValue({ ...collection, generation: "second" });
    await act(async () => vi.advanceTimersByTimeAsync(2_000));
    await flush();
    expect(displayed()).toEqual(dataKeys.map(() => "second data"));
    expect(mocks.read).toHaveBeenCalledTimes(2);
    nativeData = "unavailable data";
    mocks.read.mockResolvedValue({ ...collection, status: "unavailable" });
    await act(async () => focus());
    await flush();
    expect(mocks.read).toHaveBeenCalledTimes(3);
    expect(displayed()).toEqual(dataKeys.map(() => "unavailable data"));
  },
);

test("a held read is aborted at the metadata deadline without starting an overlapping read or accepting a late result", async () => {
  let resolve!: (value: CollectionDescriptor) => void;
  mocks.read.mockReturnValueOnce(
    new Promise<CollectionDescriptor>((done) => {
      resolve = done;
    }),
  );
  mocks.read.mockResolvedValue({ ...collection, generation: "recovered" });
  await act(async () => root.render(<Consumer />));
  await flush();
  const signal = mocks.read.mock.calls[0][1].signal as AbortSignal;
  await act(async () => vi.advanceTimersByTimeAsync(6_000));
  expect(signal.aborted).toBe(true);
  expect(mocks.read).toHaveBeenCalledTimes(1);
  expect(host.textContent).toBe("error");
  await act(async () => resolve(collection));
  await flush();
  expect(host.textContent).toBe("recovered");
  expect(mocks.read).toHaveBeenCalledTimes(2);
});

test("ordinary references stay ordinary and rejected collection checks withhold old linked metadata", async () => {
  mocks.read.mockResolvedValue(null);
  await act(async () => root.render(<Consumer />));
  await flush();
  expect(host.textContent).toBe("standalone");
  mocks.read.mockRejectedValue(new Error("metadata unavailable"));
  await act(async () => focus());
  await flush();
  expect(host.textContent).toBe("error");
  await act(async () => root.render(<Consumer file={null} />));
  await flush();
  expect(host.textContent).toBe("standalone");
});

test("the last subscriber aborts a check and observer failures do not strand its owner", async () => {
  const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
  const bad = registerCollectionCheck("observer", {
    read: async () => collection,
    receive: () => {
      throw new Error("observer refused");
    },
  });
  const received = vi.fn();
  const good = registerCollectionCheck("observer", {
    read: async () => collection,
    receive: received,
  });
  await flush();
  expect(received).toHaveBeenCalledWith(collection, undefined);
  expect(error).toHaveBeenCalledOnce();
  bad();
  good();
  const read = vi.fn(
    (signal: AbortSignal) =>
      new Promise<CollectionDescriptor | null>((_resolve, reject) =>
        signal.addEventListener("abort", () => reject(new Error("cancelled")), { once: true }),
      ),
  );
  const release = registerCollectionCheck("retired", { read, receive: vi.fn() });
  await flush();
  release();
  expect(read.mock.calls[0][0].aborted).toBe(true);
  error.mockRestore();
});

test("a slow native rebuild outlives metadata deadlines and stays shared until it settles", async () => {
  let complete!: (value: CollectionDescriptor) => void;
  mocks.read.mockResolvedValue({ ...collection, status: "stale", generation: "second" });
  mocks.rebuild.mockReturnValue(
    new Promise<CollectionDescriptor>((resolve) => {
      complete = resolve;
    }),
  );
  await act(async () =>
    root.render(
      <>
        <Consumer />
        <Consumer />
      </>,
    ),
  );
  await flush();
  expect(mocks.rebuild).toHaveBeenCalledExactlyOnceWith(collection.id, false);
  await act(async () => vi.advanceTimersByTimeAsync(10_000));
  expect(mocks.read).toHaveBeenCalledTimes(6);
  expect(mocks.rebuild).toHaveBeenCalledOnce();
  await act(async () => complete({ ...collection, generation: "second" }));
  await flush();
  expect(host.textContent).toBe("secondsecond");
  expect(mocks.rebuild).toHaveBeenCalledOnce();
});

test("the metadata queue visits every displayed collection and bounds both kinds of native work", async () => {
  const releases: (() => void)[] = [];
  const reads: (() => void)[] = [];
  const builds: (() => void)[] = [];
  let activeReads = 0;
  let activeBuilds = 0;
  let peakReads = 0;
  let peakBuilds = 0;
  const seen = new Set<number>();
  for (let index = 0; index < 150; index++) {
    releases.push(
      registerCollectionCheck(`queue-${index}`, {
        read: () => {
          activeReads++;
          peakReads = Math.max(peakReads, activeReads);
          return new Promise((resolve) =>
            reads.push(() => {
              activeReads--;
              seen.add(index);
              resolve({ ...collection, id: String(index), status: "stale" });
            }),
          );
        },
        rebuild: () => {
          activeBuilds++;
          peakBuilds = Math.max(peakBuilds, activeBuilds);
          return new Promise((resolve) =>
            builds.push(() => {
              activeBuilds--;
              resolve(collection);
            }),
          );
        },
        receive: vi.fn(),
      }),
    );
  }
  try {
    await flush();
    for (let turn = 0; turn < 150; turn++) {
      reads.splice(0).forEach((complete) => complete());
      builds.splice(0).forEach((complete) => complete());
      await flush();
    }
    expect(seen.size).toBe(150);
    expect(peakReads).toBe(8);
    expect(peakBuilds).toBe(4);
    expect(activeBuilds).toBe(0);
    expect(activeReads).toBe(0);
  } finally {
    releases.forEach((release) => release());
  }
});

test.each(["success", "failure"])(
  "a superseded native rebuild %s cannot replace a newer admitted generation",
  async (outcome) => {
    let complete!: (value: CollectionDescriptor) => void;
    let reject!: (error: Error) => void;
    mocks.read.mockResolvedValue({ ...collection, status: "stale" });
    mocks.rebuild.mockReturnValue(
      new Promise<CollectionDescriptor>((resolve, fail) => {
        complete = resolve;
        reject = fail;
      }),
    );
    await act(async () => root.render(<Consumer />));
    await flush();
    expect(mocks.rebuild).toHaveBeenCalledOnce();
    mocks.read.mockResolvedValue({ ...collection, generation: "newer" });
    await act(async () => focus());
    await flush();
    expect(host.textContent).toBe("newer");
    await act(async () => {
      if (outcome === "success") complete(collection);
      else reject(new Error("obsolete index failure"));
    });
    await flush();
    expect(host.textContent).toBe("newer");
  },
);

test("a current rebuild failure is recoverable and a retired observer cannot poison its successor", async () => {
  mocks.read.mockResolvedValue({ ...collection, status: "stale" });
  mocks.rebuild.mockRejectedValueOnce(new Error("index storage refused"));
  await act(async () => root.render(<Consumer />));
  await flush();
  expect(host.textContent).toBe("error");
  mocks.read.mockResolvedValue(collection);
  await act(async () => focus());
  await flush();
  expect(host.textContent).toBe("first");
  let fail!: (error: Error) => void;
  const old = registerCollectionCheck("retired-build", {
    read: async () => ({ ...collection, status: "stale" }),
    rebuild: () =>
      new Promise<CollectionDescriptor>((_resolve, reject) => {
        fail = reject;
      }),
    receive: vi.fn(),
  });
  await flush();
  old();
  const receive = vi.fn();
  const release = registerCollectionCheck("retired-build", {
    read: async () => ({ ...collection, generation: "successor" }),
    receive,
  });
  try {
    await flush();
    expect(receive).toHaveBeenLastCalledWith(
      expect.objectContaining({ generation: "successor" }),
      undefined,
    );
    await act(async () => fail(new Error("retired native failure")));
    await flush();
    expect(receive).toHaveBeenCalledOnce();
  } finally {
    release();
  }
});

test("remount waits for the retired metadata operation to settle and repeated release cannot remove its successor", async () => {
  let complete!: (value: CollectionDescriptor) => void;
  const first = registerCollectionCheck("remount", {
    read: () =>
      new Promise<CollectionDescriptor>((resolve) => {
        complete = resolve;
      }),
    receive: vi.fn(),
  });
  await flush();
  first();
  const read = vi.fn(async () => collection);
  const receive = vi.fn();
  const second = registerCollectionCheck("remount", { read, receive });
  try {
    first();
    await flush();
    expect(read).not.toHaveBeenCalled();
    await act(async () => complete({ ...collection, generation: "obsolete" }));
    await flush();
    expect(read).toHaveBeenCalledOnce();
    expect(receive).toHaveBeenCalledExactlyOnceWith(collection, undefined);
  } finally {
    complete(collection);
    second();
    await flush();
  }
});

test("deadline retries do not starve collections still waiting for their first check", async () => {
  const started: number[] = [];
  const complete: (() => void)[] = [];
  const release = Array.from({ length: 16 }, (_, index) =>
    registerCollectionCheck(`fair-${index}`, {
      read: () => {
        started.push(index);
        return new Promise<CollectionDescriptor>((resolve) =>
          complete.push(() => resolve(collection)),
        );
      },
      receive: vi.fn(),
    }),
  );
  try {
    await flush();
    expect(started).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    await act(async () => vi.advanceTimersByTimeAsync(4_000));
    complete.splice(0).forEach((resolve) => resolve());
    await flush();
    expect(started.slice(8, 16)).toEqual([8, 9, 10, 11, 12, 13, 14, 15]);
  } finally {
    release.forEach((dispose) => dispose());
    complete.splice(0).forEach((resolve) => resolve());
    await flush();
  }
});
