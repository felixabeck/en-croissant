import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import useSWR, { SWRConfig, unstable_serialize } from "swr";
import useSWRImmutable from "swr/immutable";
import { afterEach, expect, test, vi } from "vitest";
import type { DatabaseContentFailure } from "@/bindings";

const mocks = vi.hoisted(() => ({ listen: vi.fn(), notify: vi.fn() }));
vi.mock("@/platform/tauri", () => ({
  tauriSubscriptions: { databaseContentFailure: mocks.listen },
}));
vi.mock("@/components/files/notifyError", () => ({ notifyListenerError: mocks.notify }));

import { useDatabaseContentValidation } from "./useDatabaseContentValidation";
import { useNativeRequestOwner } from "./useNativeRequestOwner";

let root: Root;
let container: HTMLDivElement;
let listener: ((event: { payload: DatabaseContentFailure }) => void) | undefined;
const personalKey = ["personalDatabases", [{ player: "Alice" }]];
const otherPersonalKey = ["personalDatabases", [{ player: "Bob" }]];

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

async function mount(
  pending?: "databases" | "personalDatabases",
  dedupingInterval = 0,
  observeUnmountedRevalidation = false,
) {
  const cache = new Map();
  const gate = deferred();
  let failedStamp = false;
  const reads = { databases: 0, personalDatabases: 0, other: 0 };
  const fetch = (name: keyof typeof reads) => async () => {
    const failedAtRead = failedStamp;
    reads[name] += 1;
    if (name === pending && reads[name] === 1) await gate.promise;
    if (observeUnmountedRevalidation && name === "personalDatabases" && reads[name] === 2) {
      await gate.promise;
    }
    return failedAtRead ? "SQLite integrity_check failed" : "stored title";
  };
  const databaseFetch = fetch("databases");
  const personalFetch = fetch("personalDatabases");
  const otherFetch = fetch("other");
  function Home() {
    const homeOwner = useNativeRequestOwner(personalKey);
    const otherOwner = useNativeRequestOwner(otherPersonalKey);
    const home = useSWRImmutable(personalKey, () => homeOwner!.run(personalFetch));
    const other = useSWRImmutable(otherPersonalKey, () => otherOwner!.run(otherFetch));
    return <output data-personal={home.data} data-other={other.data} />;
  }
  // Keep SWR's fetcher mounted without a native request owner so public mutate
  // can be paused while Home has no committed subscriber.
  function CacheRevalidator() {
    useSWRImmutable(personalKey, personalFetch);
    return null;
  }
  function ValidationListener() {
    useDatabaseContentValidation();
    return null;
  }
  let setHomeMounted: (mounted: boolean) => void;
  let setListenerMounted: (mounted: boolean) => void;
  function Probe() {
    const [homeMounted, setMounted] = useState(true);
    const [listenerMounted, setListening] = useState(true);
    setHomeMounted = setMounted;
    setListenerMounted = setListening;
    const dbOwner = useNativeRequestOwner("databases");
    const databases = useSWR("databases", () => dbOwner!.run(databaseFetch));
    return (
      <>
        {listenerMounted && <ValidationListener />}
        <output data-databases={databases.data} />
        {homeMounted && <Home />}
        {observeUnmountedRevalidation && <CacheRevalidator />}
      </>
    );
  }
  mocks.listen.mockImplementation((handler: typeof listener) => {
    listener = handler;
    return Promise.resolve(() => {});
  });
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () =>
    root.render(
      <SWRConfig value={{ provider: () => cache, dedupingInterval }}>
        <Probe />
      </SWRConfig>,
    ),
  );
  return {
    reads,
    gate,
    cache,
    showHome: async (mounted: boolean) => {
      await act(async () => setHomeMounted(mounted));
    },
    showListener: async (mounted: boolean) => {
      await act(async () => setListenerMounted(mounted));
    },
    fail: async () => {
      failedStamp = true;
      await act(async () =>
        listener?.({
          payload: { filename: "games.db3", message: "SQLite integrity_check failed" },
        }),
      );
    },
  };
}

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  listener = undefined;
  mocks.listen.mockReset();
});

test("failure revalidates databases and every personalDatabases cache", async () => {
  const { reads, fail } = await mount();
  await fail();
  expect(reads).toEqual({ databases: 2, personalDatabases: 2, other: 2 });
  for (const attribute of ["data-databases", "data-personal", "data-other"]) {
    expect(container.querySelector(`output[${attribute}]`)?.getAttribute(attribute)).toBe(
      "SQLite integrity_check failed",
    );
  }
});

test.each(["databases", "personalDatabases"] as const)(
  "failure during the in-flight %s fetch starts one follow-up read of the failed stamp",
  async (pending) => {
    const { reads, gate, fail } = await mount(pending);
    expect(reads[pending]).toBe(1);
    await fail();
    expect(reads[pending]).toBe(1);
    await act(async () => gate.resolve());
    expect(reads[pending]).toBe(2);
    const attribute = pending === "databases" ? "data-databases" : "data-personal";
    expect(container.querySelector(`output[${attribute}]`)?.getAttribute(attribute)).toBe(
      "SQLite integrity_check failed",
    );
  },
);

test("a passed scan emits no failure and does not revalidate", async () => {
  const { reads } = await mount();
  await act(async () => Promise.resolve());
  expect(reads).toEqual({ databases: 1, personalDatabases: 1, other: 1 });
  expect(mocks.listen).toHaveBeenCalledTimes(1);
});

test("failure while Home is unmounted evicts its immutable cache so remount reads the failed stamp", async () => {
  const { reads, fail, showHome, cache } = await mount(undefined, 60000);
  expect(reads).toEqual({ databases: 1, personalDatabases: 1, other: 1 });
  await showHome(false);
  await fail();
  expect(reads).toEqual({ databases: 2, personalDatabases: 1, other: 1 });
  expect(cache.has(unstable_serialize(personalKey))).toBe(false);
  await showHome(true);
  expect(reads).toEqual({ databases: 2, personalDatabases: 2, other: 2 });
  for (const attribute of ["data-personal", "data-other"]) {
    expect(container.querySelector(`output[${attribute}]`)?.getAttribute(attribute)).toBe(
      "SQLite integrity_check failed",
    );
  }
});

test("Home subscribing during unmounted revalidation preserves its cache key", async () => {
  const { reads, fail, showHome, gate, cache } = await mount(undefined, 60000, true);
  await showHome(false);
  await fail();
  expect(reads.personalDatabases).toBe(2);
  await showHome(true);
  await act(async () => gate.resolve());
  expect(reads.personalDatabases).toBe(2);
  expect(cache.has(unstable_serialize(personalKey))).toBe(true);
  expect(container.querySelector("output[data-personal]")?.getAttribute("data-personal")).toBe(
    "SQLite integrity_check failed",
  );
});

test("aborting the failure listener during unmounted revalidation preserves the cache key", async () => {
  const { reads, fail, showHome, showListener, gate, cache } = await mount(undefined, 60000, true);
  await showHome(false);
  await fail();
  expect(reads.personalDatabases).toBe(2);
  await showListener(false);
  await act(async () => gate.resolve());
  expect(reads.personalDatabases).toBe(2);
  expect(cache.has(unstable_serialize(personalKey))).toBe(true);
});
