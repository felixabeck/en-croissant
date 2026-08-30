import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { useOperation, type OperationState } from "./operation";

type OperationApi = ReturnType<typeof useOperation<string>>;

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

let root: Root;
let host: HTMLDivElement;
let operation: OperationApi | undefined;

function Probe() {
  operation = useOperation<string>();
  const { state } = operation;
  const generation = state.status === "idle" ? undefined : String(state.generation);
  const value = state.status === "success" ? state.value : undefined;
  const errorCategory = state.status === "error" ? state.error.category : undefined;
  const errorMessage = state.status === "error" ? state.error.message : undefined;
  const errorDiagnostic = state.status === "error" ? state.error.diagnostic : undefined;
  return (
    <output
      data-status={state.status}
      data-generation={generation}
      data-value={value}
      data-error-category={errorCategory}
      data-error-message={errorMessage}
      data-error-diagnostic={errorDiagnostic}
    >
      {state.status}
    </output>
  );
}

function getOperation(): OperationApi {
  if (!operation) throw new Error("operation probe is not mounted");
  return operation;
}

function getOutput(): HTMLOutputElement {
  const output = host.querySelector("output");
  if (!output) throw new Error("operation probe output is not mounted");
  return output;
}

function state(): OperationState<string> {
  return getOperation().state;
}

beforeEach(() => {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  operation = undefined;
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  operation = undefined;
});

describe("useOperation", () => {
  test("starts idle", async () => {
    await act(async () => root.render(<Probe />));

    expect(state()).toEqual({ status: "idle" });
    expect(getOutput().dataset.status).toBe("idle");
  });

  test("moves from pending to success and returns the resolved value", async () => {
    const pending = deferred<string>();
    let run!: Promise<string>;

    await act(async () => root.render(<Probe />));
    await act(async () => {
      run = getOperation().run(() => pending.promise);
    });

    expect(state()).toEqual({ status: "pending", generation: 1 });
    expect(getOutput().dataset.status).toBe("pending");

    await act(async () => {
      pending.resolve("finished");
      await expect(run).resolves.toBe("finished");
    });

    expect(state()).toEqual({ status: "success", generation: 1, value: "finished" });
    expect(getOutput().dataset.value).toBe("finished");
  });

  test("normalizes an operation error and rethrows it", async () => {
    const thrown = new Error("request timeout");
    let run!: Promise<string>;

    await act(async () => root.render(<Probe />));
    await act(async () => {
      run = getOperation().run(async () => {
        throw thrown;
      });
      void run.catch(() => undefined);
    });
    await act(async () => {
      await expect(run).rejects.toBe(thrown);
    });

    expect(state()).toEqual({
      status: "error",
      generation: 1,
      error: {
        category: "network",
        message: "request timeout",
        diagnostic: "request timeout",
      },
    });
    expect(getOutput().dataset.errorCategory).toBe("network");
    expect(getOutput().dataset.errorMessage).toBe("request timeout");
  });

  test("ignores a stale result from an earlier generation", async () => {
    const first = deferred<string>();
    const second = deferred<string>();
    let firstRun!: Promise<string>;
    let secondRun!: Promise<string>;

    await act(async () => root.render(<Probe />));
    await act(async () => {
      firstRun = getOperation().run(() => first.promise);
    });
    await act(async () => {
      secondRun = getOperation().run(() => second.promise);
    });

    expect(state()).toEqual({ status: "pending", generation: 2 });

    await act(async () => {
      first.resolve("stale");
      await expect(firstRun).resolves.toBe("stale");
    });
    expect(state()).toEqual({ status: "pending", generation: 2 });

    await act(async () => {
      second.resolve("current");
      await expect(secondRun).resolves.toBe("current");
    });
    expect(state()).toEqual({ status: "success", generation: 2, value: "current" });
  });

  test("aborts the previous run when a new run starts", async () => {
    const abortError = new Error("operation aborted");
    const second = deferred<string>();
    let firstSignal!: AbortSignal;
    let firstRun!: Promise<string>;
    let secondRun!: Promise<string>;

    await act(async () => root.render(<Probe />));
    await act(async () => {
      firstRun = getOperation().run(
        (signal) =>
          new Promise<string>((_resolve, reject) => {
            firstSignal = signal;
            signal.addEventListener("abort", () => reject(abortError), { once: true });
          }),
      );
      void firstRun.catch(() => undefined);
    });
    await act(async () => {
      secondRun = getOperation().run(() => second.promise);
    });

    expect(firstSignal.aborted).toBe(true);
    await act(async () => {
      await expect(firstRun).rejects.toBe(abortError);
    });
    expect(state()).toEqual({ status: "pending", generation: 2 });

    await act(async () => {
      second.resolve("current");
      await expect(secondRun).resolves.toBe("current");
    });
  });

  test("treats an abort rejection from the current run as cancelled", async () => {
    const abortError = new Error("operation aborted");
    let signal!: AbortSignal;
    let run!: Promise<string>;

    await act(async () => root.render(<Probe />));
    await act(async () => {
      run = getOperation().run(
        (activeSignal) =>
          new Promise<string>((_resolve, reject) => {
            signal = activeSignal;
            activeSignal.addEventListener("abort", () => reject(abortError), { once: true });
          }),
      );
      void run.catch(() => undefined);
    });

    await act(async () => {
      getOperation().cancel();
    });
    expect(signal.aborted).toBe(true);
    expect(state()).toEqual({ status: "cancelled", generation: 1 });

    await act(async () => {
      await expect(run).rejects.toBe(abortError);
    });
    expect(state()).toEqual({ status: "cancelled", generation: 1 });
  });

  test("cancel aborts in-flight work and leaves the state cancelled", async () => {
    const pending = deferred<string>();
    let signal!: AbortSignal;
    let run!: Promise<string>;

    await act(async () => root.render(<Probe />));
    await act(async () => {
      run = getOperation().run((activeSignal) => {
        signal = activeSignal;
        return pending.promise;
      });
    });

    await act(async () => {
      getOperation().cancel();
    });
    expect(signal.aborted).toBe(true);
    expect(state()).toEqual({ status: "cancelled", generation: 1 });

    await act(async () => {
      pending.resolve("late");
      await expect(run).resolves.toBe("late");
    });
    expect(state()).toEqual({ status: "cancelled", generation: 1 });
  });

  test("aborts in-flight work on unmount and ignores its late result", async () => {
    const pending = deferred<string>();
    let signal!: AbortSignal;
    let run!: Promise<string>;

    await act(async () => root.render(<Probe />));
    await act(async () => {
      run = getOperation().run((activeSignal) => {
        signal = activeSignal;
        return pending.promise;
      });
    });

    await act(async () => root.unmount());
    expect(signal.aborted).toBe(true);

    await act(async () => {
      pending.resolve("late");
      await expect(run).resolves.toBe("late");
    });
    expect(host.querySelector("output")).toBeNull();
  });
});
