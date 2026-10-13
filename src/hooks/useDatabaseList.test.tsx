import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { SWRConfig } from "swr";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { listingFailure } from "@/components/files/listingFailure";
import type { NativeRequestOwner } from "@/hooks/useNativeRequestOwner";
import { getDatabases } from "@/utils/db";
import {
  DATABASE_LIST_MAX_RETRIES,
  DATABASE_LIST_RETRY_BASE_MS,
  useDatabaseList,
} from "./useDatabaseList";

vi.mock("@/utils/db", () => ({ getDatabases: vi.fn() }));

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(Math, "random").mockReturnValue(0.5);
  vi.mocked(getDatabases).mockReset();
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

async function render(ui: ReactNode) {
  await act(async () => {
    root.render(
      <SWRConfig
        value={{
          provider: () => new Map(),
          dedupingInterval: 0,
          errorRetryInterval: DATABASE_LIST_RETRY_BASE_MS,
          revalidateOnFocus: false,
          revalidateOnReconnect: false,
        }}
      >
        {ui}
      </SWRConfig>,
    );
  });
}

async function advance(ms: number) {
  await act(async () => vi.advanceTimersByTimeAsync(ms));
}

function Consumer({ enabled = true }: { enabled?: boolean }) {
  const { data, error } = useDatabaseList(enabled);
  return <output>{error ? "failed" : data ? "loaded" : "pending"}</output>;
}

test("transient failures retry with exponential backoff and stop after three retries", async () => {
  const failure = new Error("Temporary database failure");
  expect(listingFailure(failure)).toBe("retry");
  vi.mocked(getDatabases).mockRejectedValue(failure);
  await render(<Consumer />);
  expect(getDatabases).toHaveBeenCalledTimes(1);

  for (let retryCount = 1; retryCount <= DATABASE_LIST_MAX_RETRIES; retryCount += 1) {
    await advance(DATABASE_LIST_RETRY_BASE_MS * 2 ** retryCount - 1);
    expect(getDatabases).toHaveBeenCalledTimes(retryCount);
    await advance(1);
    expect(getDatabases).toHaveBeenCalledTimes(1 + retryCount);
  }

  await advance(60_000);
  expect(getDatabases).toHaveBeenCalledTimes(1 + DATABASE_LIST_MAX_RETRIES);
  expect(container.textContent).toBe("failed");
});

test.each(["changed", "missing", "unusable", "permission", "too-large"] as const)(
  "a %s root failure is never retried",
  async (rootFailure) => {
    const failure = {
      tag: "backend-error",
      category: "io",
      message: "Database root unavailable",
      rootFailure,
    };
    expect(listingFailure(failure)).toBe(rootFailure === "too-large" ? "tooLarge" : rootFailure);
    vi.mocked(getDatabases).mockRejectedValue(failure);
    await render(<Consumer />);
    expect(getDatabases).toHaveBeenCalledTimes(1);
    await advance(60_000);
    expect(getDatabases).toHaveBeenCalledTimes(1);
  },
);

test.each([
  new DOMException("Cancellation", "AbortError"),
  { tag: "backend-error", category: "cancellation", message: "Cancellation" },
])("cancellation is never retried (%#)", async (failure) => {
  expect(listingFailure(failure)).toBe("silent");
  vi.mocked(getDatabases).mockRejectedValue(failure);
  await render(<Consumer />);
  expect(getDatabases).toHaveBeenCalledTimes(1);
  await advance(60_000);
  expect(getDatabases).toHaveBeenCalledTimes(1);
});

test("superseding a pending listing never retries its cancellation", async () => {
  let owner: NativeRequestOwner | null = null;
  function OwnedConsumer() {
    const swr = useDatabaseList();
    owner = swr.owner;
    return <output>{swr.error ? "superseded" : "pending"}</output>;
  }
  vi.mocked(getDatabases).mockImplementation(() => new Promise(() => {}));
  await render(<OwnedConsumer />);
  expect(getDatabases).toHaveBeenCalledTimes(1);
  const signal = vi.mocked(getDatabases).mock.calls[0][0]?.signal;
  await act(async () => owner!.supersede());
  expect(signal?.aborted).toBe(true);
  expect(container.textContent).toBe("superseded");
  await advance(60_000);
  expect(getDatabases).toHaveBeenCalledTimes(1);
});

test("a disabled subscription makes no request", async () => {
  vi.mocked(getDatabases).mockResolvedValue([]);
  await render(<Consumer enabled={false} />);
  await advance(60_000);
  expect(getDatabases).not.toHaveBeenCalled();
  expect(container.textContent).toBe("pending");
});

test("a consumer reading only isLoading observes completion", async () => {
  let resolve!: (value: Awaited<ReturnType<typeof getDatabases>>) => void;
  vi.mocked(getDatabases).mockImplementation(
    () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  function LoadingConsumer() {
    const { isLoading } = useDatabaseList();
    return <output>{isLoading ? "loading" : "settled"}</output>;
  }
  await render(<LoadingConsumer />);
  expect(container.textContent).toBe("loading");
  await act(async () => resolve([]));
  expect(container.textContent).toBe("settled");
});

test("a consumer reading only error observes failure", async () => {
  let reject!: (reason: unknown) => void;
  vi.mocked(getDatabases).mockImplementation(
    () =>
      new Promise((_done, fail) => {
        reject = fail;
      }),
  );
  function ErrorConsumer() {
    const { error } = useDatabaseList();
    return <output>{error ? "failed" : "pending"}</output>;
  }
  await render(<ErrorConsumer />);
  expect(container.textContent).toBe("pending");
  await act(async () => reject(new Error("Database failure")));
  expect(container.textContent).toBe("failed");
});
