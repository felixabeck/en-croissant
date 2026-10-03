import { StrictMode, act, type ReactNode, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import useSWR, { SWRConfig, type Cache, type KeyedMutator } from "swr";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { useNativeRequestOwner } from "./useNativeRequestOwner";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
}

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

async function render(ui: ReactNode) {
  await act(async () => root.render(ui));
}

async function waitFor(assertion: () => void) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      assertion();
      return;
    } catch {
      await act(async () => Promise.resolve());
    }
  }
  assertion();
}

function Consumer({
  cacheKey,
  fetcher,
  onMutate,
}: {
  cacheKey: string;
  fetcher: (signal: AbortSignal) => Promise<string>;
  onMutate?: (mutate: KeyedMutator<string>) => void;
}) {
  const owner = useNativeRequestOwner(cacheKey);
  const { data, mutate } = useSWR(cacheKey, () => owner!.run(fetcher));
  useEffect(() => onMutate?.(mutate), [mutate, onMutate]);
  return <span>{data ?? "pending"}</span>;
}

function Shared({
  first,
  second,
  fetcher,
  cacheKey,
  onMutateFirst,
}: {
  first: boolean;
  second: boolean;
  fetcher: (signal: AbortSignal) => Promise<string>;
  cacheKey: string;
  onMutateFirst?: (mutate: KeyedMutator<string>) => void;
}) {
  return (
    <>
      {first && <Consumer cacheKey={cacheKey} fetcher={fetcher} onMutate={onMutateFirst} />}
      {second && <Consumer cacheKey={cacheKey} fetcher={fetcher} />}
    </>
  );
}

function CachePair({
  first,
  second,
  firstCache,
  secondCache,
  fetcher,
}: {
  first: boolean;
  second: boolean;
  firstCache: Cache;
  secondCache: Cache;
  fetcher: (signal: AbortSignal) => Promise<string>;
}) {
  return (
    <>
      <SWRConfig value={{ provider: () => firstCache }}>
        {first && <Consumer cacheKey="same-key" fetcher={fetcher} />}
      </SWRConfig>
      <SWRConfig value={{ provider: () => secondCache }}>
        {second && <Consumer cacheKey="same-key" fetcher={fetcher} />}
      </SWRConfig>
    </>
  );
}

describe("native SWR request ownership", () => {
  test.each(["fulfilment", "rejection"])(
    "final-subscriber cleanup preserves the returning subscriber's failure after late %s",
    async (outcome) => {
      const cache = new Map();
      const oldWork = deferred<string>();
      const freshWork = deferred<string>();
      const oldOutcome = vi.fn();
      const freshOutcome = vi.fn();
      const signals: AbortSignal[] = [];
      const fetcher = vi.fn((signal: AbortSignal) => {
        signals.push(signal);
        // Like getDbInfo, this work continues after its owner aborts the signal.
        return signals.length === 1 ? oldWork.promise : freshWork.promise;
      });
      function Subscriber() {
        const owner = useNativeRequestOwner("databases");
        const { data, error } = useSWR("databases", () => {
          const promise = owner!.run(fetcher);
          const observer = fetcher.mock.calls.length === 0 ? oldOutcome : freshOutcome;
          void promise.then(observer, observer);
          return promise;
        });
        return <span>{error?.rootFailure ?? error?.message ?? data ?? "pending"}</span>;
      }
      function Page({ present }: { present: boolean }) {
        return (
          <SWRConfig
            value={{
              provider: () => cache,
              shouldRetryOnError: false,
              revalidateOnFocus: false,
              dedupingInterval: 0,
            }}
          >
            {present && <Subscriber />}
          </SWRConfig>
        );
      }
      await render(<Page present />);
      expect(fetcher).toHaveBeenCalledOnce();
      await render(<Page present={false} />);
      expect(signals[0].aborted).toBe(true);
      expect(oldOutcome).toHaveBeenCalledOnce();
      expect(oldOutcome.mock.calls[0][0]).toBeInstanceOf(DOMException);
      expect(oldOutcome.mock.calls[0][0]).toMatchObject({
        name: "AbortError",
        message: "Cancellation",
      });
      expect(cache.get("databases")?.error).toBe(oldOutcome.mock.calls[0][0]);

      await render(<Page present />);
      expect(fetcher).toHaveBeenCalledTimes(2);
      const freshFailure = {
        tag: "backend-error",
        category: "resource-limit",
        message: "new folder failure",
        rootFailure: "too-large",
      };
      await act(async () => freshWork.reject(freshFailure));
      expect(container.textContent).toBe("too-large");
      expect(freshOutcome).toHaveBeenCalledExactlyOnceWith(freshFailure);
      expect(cache.get("databases")?.error).toBe(freshFailure);
      await act(async () =>
        outcome === "fulfilment"
          ? oldWork.resolve("stale content")
          : oldWork.reject(new DOMException("Cancellation", "AbortError")),
      );
      expect(container.textContent).toBe("too-large");
      expect(cache.get("databases")?.error).toBe(freshFailure);
      expect(cache.get("databases")?.data).toBeUndefined();
      expect(oldOutcome).toHaveBeenCalledOnce();
      expect(freshOutcome).toHaveBeenCalledExactlyOnceWith(freshFailure);
    },
  );

  test.each(["fulfilment", "rejection"])(
    "supersession drains two signal-ignoring subscribers before late %s",
    async (outcome) => {
      const held = deferred<string>();
      const fetcher = vi.fn(() => held.promise);
      const owners: Array<NonNullable<ReturnType<typeof useNativeRequestOwner>>> = [];
      function Subscriber() {
        const owner = useNativeRequestOwner("superseded");
        useEffect(() => {
          owners.push(owner!);
        }, [owner]);
        return null;
      }
      await render(
        <SWRConfig value={{ provider: () => new Map() }}>
          <Subscriber />
          <Subscriber />
        </SWRConfig>,
      );
      let first!: Promise<string>;
      let second!: Promise<string>;
      await act(async () => {
        first = owners[0].run(fetcher);
        second = owners[1].run(fetcher);
      });
      const firstOutcome = vi.fn();
      const secondOutcome = vi.fn();
      const delivered = [
        first.then(firstOutcome, firstOutcome),
        second.then(secondOutcome, secondOutcome),
      ];
      expect(fetcher).toHaveBeenCalledOnce();
      await act(async () => owners[0].supersede());
      await Promise.all(delivered);
      for (const observer of [firstOutcome, secondOutcome]) {
        expect(observer).toHaveBeenCalledOnce();
        const cancellation = observer.mock.calls[0][0];
        expect(cancellation).toBeInstanceOf(DOMException);
        expect(cancellation.name).toBe("AbortError");
        expect(cancellation.message).toBe("Cancellation");
      }
      await expect(owners[1].run(async () => "fresh")).resolves.toBe("fresh");
      await act(async () =>
        outcome === "fulfilment" ? held.resolve("stale") : held.reject(new Error("stale failure")),
      );
      expect(firstOutcome).toHaveBeenCalledOnce();
      expect(secondOutcome).toHaveBeenCalledOnce();
    },
  );

  test("one subscriber leaving preserves the request and publishes to its peer", async () => {
    const held = deferred<string>();
    const aborted = vi.fn();
    const fetcher = vi.fn((signal: AbortSignal) => {
      signal.addEventListener("abort", aborted);
      return held.promise;
    });
    await render(<Shared first second={false} fetcher={fetcher} cacheKey="shared-success" />);
    await waitFor(() => expect(fetcher).toHaveBeenCalledOnce());
    await render(<Shared first second fetcher={fetcher} cacheKey="shared-success" />);
    await render(<Shared first={false} second fetcher={fetcher} cacheKey="shared-success" />);
    expect(aborted).not.toHaveBeenCalled();
    held.resolve("ready");
    await waitFor(() => expect(container.textContent).toContain("ready"));
  });

  test("the final subscriber cancels one pending generation exactly once", async () => {
    const aborted = vi.fn();
    const fetcher = (signal: AbortSignal) => {
      return new Promise<string>((_resolve, reject) => {
        signal.addEventListener(
          "abort",
          () => {
            aborted();
            reject(new DOMException("Cancellation", "AbortError"));
          },
          { once: true },
        );
      });
    };
    await render(<Shared first second fetcher={fetcher} cacheKey="shared-cancel" />);
    await waitFor(() => expect(aborted).not.toHaveBeenCalled());
    await render(<Shared first={false} second fetcher={fetcher} cacheKey="shared-cancel" />);
    await act(async () => Promise.resolve());
    expect(aborted).not.toHaveBeenCalled();
    await render(
      <Shared first={false} second={false} fetcher={fetcher} cacheKey="shared-cancel" />,
    );
    await waitFor(() => expect(aborted).toHaveBeenCalledOnce());
  });

  test("held revalidation is shared with a joining subscriber and cancelled by the final owner", async () => {
    const first = deferred<string>();
    const second = deferred<string>();
    const signals: AbortSignal[] = [];
    const fetcher = vi.fn((signal: AbortSignal) => {
      signals.push(signal);
      if (signals.length === 2) {
        signal.addEventListener(
          "abort",
          () => second.reject(new DOMException("Cancellation", "AbortError")),
          { once: true },
        );
      }
      return signals.length === 1 ? first.promise : second.promise;
    });
    let mutate: KeyedMutator<string> | undefined;
    await render(
      <Shared
        first
        second={false}
        cacheKey="revalidation"
        fetcher={fetcher}
        onMutateFirst={(next) => (mutate = next)}
      />,
    );
    first.resolve("first");
    await waitFor(() => expect(container.textContent).toContain("first"));
    let revalidation!: Promise<string | undefined>;
    await act(async () => {
      revalidation = mutate!();
      await Promise.resolve();
    });
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));
    expect(signals[1]).not.toBe(signals[0]);
    expect(signals[1].aborted).toBe(false);
    await render(
      <Shared
        first
        second
        fetcher={fetcher}
        cacheKey="revalidation"
        onMutateFirst={(next) => (mutate = next)}
      />,
    );
    expect(fetcher).toHaveBeenCalledTimes(2);
    await render(<Shared first={false} second fetcher={fetcher} cacheKey="revalidation" />);
    await act(async () => Promise.resolve());
    expect(signals[1].aborted).toBe(false);
    await render(<Shared first={false} second={false} fetcher={fetcher} cacheKey="revalidation" />);
    await waitFor(() => expect(signals[1].aborted).toBe(true));
    await expect(revalidation).resolves.toBe("first");
  });

  test("StrictMode effect replay does not cancel the committed request", async () => {
    const held = deferred<string>();
    const aborted = vi.fn();
    await render(
      <StrictMode>
        <Consumer
          cacheKey="strict"
          fetcher={(signal) => {
            signal.addEventListener("abort", aborted);
            return held.promise;
          }}
        />
      </StrictMode>,
    );
    await act(async () => undefined);
    expect(aborted).not.toHaveBeenCalled();
    held.resolve("ready");
    await waitFor(() => expect(container.textContent).toContain("ready"));
  });

  test("key replacement cancels only the replaced pending generation", async () => {
    const signals: AbortSignal[] = [];
    const fetcher = (signal: AbortSignal) => {
      signals.push(signal);
      if (signals.length === 2) return Promise.resolve("new");
      return new Promise<string>((_resolve, reject) => {
        signal.addEventListener(
          "abort",
          () => reject(new DOMException("Cancellation", "AbortError")),
          { once: true },
        );
      });
    };
    await render(<Consumer cacheKey="old-key" fetcher={fetcher} />);
    await waitFor(() => expect(signals).toHaveLength(1));
    await render(<Consumer cacheKey="new-key" fetcher={fetcher} />);
    await waitFor(() => expect(signals).toHaveLength(2));
    expect(signals[0].aborted).toBe(true);
    expect(signals[1].aborted).toBe(false);
    await waitFor(() => expect(container.textContent).toContain("new"));
  });

  test("identical keys in distinct SWR caches retain independent native owners", async () => {
    const firstCache = new Map();
    const secondCache = new Map();
    const signals: AbortSignal[] = [];
    const fetcher = (signal: AbortSignal) => {
      signals.push(signal);
      return new Promise<string>((_resolve, reject) => {
        signal.addEventListener(
          "abort",
          () => reject(new DOMException("Cancellation", "AbortError")),
          { once: true },
        );
      });
    };
    await render(
      <CachePair
        first
        second
        firstCache={firstCache}
        secondCache={secondCache}
        fetcher={fetcher}
      />,
    );
    await waitFor(() => expect(signals).toHaveLength(2));
    await render(
      <CachePair
        first={false}
        second
        firstCache={firstCache}
        secondCache={secondCache}
        fetcher={fetcher}
      />,
    );
    await waitFor(() => expect(signals[0].aborted).toBe(true));
    expect(signals[1].aborted).toBe(false);
    await render(
      <CachePair
        first={false}
        second={false}
        firstCache={firstCache}
        secondCache={secondCache}
        fetcher={fetcher}
      />,
    );
    await waitFor(() => expect(signals[1].aborted).toBe(true));
  });
});
