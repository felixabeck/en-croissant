import { MantineProvider } from "@mantine/core";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import useSWR, { SWRConfig, unstable_serialize, type State } from "swr";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { DatabaseHandle, NormalizedGame } from "@/bindings";
import { cancellationError, TauriCommandError } from "@/platform/tauri";
import english from "@/translation/en-US.json";
import { installMatchMediaStub } from "@/tests/matchMedia";
import GameCard from "./GameCard";

const mocks = vi.hoisted(() => ({ deleteDbGame: vi.fn(), notification: vi.fn() }));
vi.mock("@/platform/tauri", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/platform/tauri")>();
  return { ...actual, tauri: { ...actual.tauri, deleteDbGame: mocks.deleteDbGame } };
});
vi.mock("@mantine/notifications", () => ({ notifications: { show: mocks.notification } }));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string }) =>
      (english.translation as Record<string, string>)[key] ?? options?.defaultValue ?? key,
  }),
}));
vi.mock("../common/GameInfo", () => ({ default: () => null }));
vi.mock("./GamePreview", () => ({ default: () => null }));
installMatchMediaStub();
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
globalThis.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

function deferred<T = void>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

describe("database game deletion with real SWR revalidation", () => {
  let host: HTMLDivElement;
  let root: Root;
  let cache: Map<string, State>;
  let fetchers: Map<string, ReturnType<typeof vi.fn<() => Promise<unknown>>>>;
  const file: DatabaseHandle = { id: { id: "database" }, kind: "database" };
  const otherFile: DatabaseHandle = { id: { id: "other-database" }, kind: "database" };
  const views = ["games", "players", "tournaments"] as const;
  const queryKeys = [file, otherFile].flatMap((database) =>
    views.map((view) => [view, database, { limit: 10 }] as const),
  );
  const keys = [...queryKeys, "databases", ["engines", file]];
  const game = { id: 42, white: "Alice", black: "Bob", moves: "1. e4 *" } as NormalizedGame;
  const refreshTitle = "The game was deleted, but the database view could not be refreshed.";

  function fetcher(view: (typeof views)[number], database = file) {
    const key = queryKeys.find((key) => key[0] === view && key[1] === database)!;
    return fetchers.get(unstable_serialize(key))!;
  }

  function Subscriber({ queryKey }: { queryKey: (typeof keys)[number] }) {
    const id = unstable_serialize(queryKey);
    const { data, error, isValidating } = useSWR(queryKey, fetchers.get(id)!);
    return (
      <output data-key={id} data-error={error?.message} data-validating={isValidating}>
        {JSON.stringify(data)}
      </output>
    );
  }

  beforeEach(() => {
    mocks.deleteDbGame.mockReset().mockResolvedValue(undefined);
    mocks.notification.mockReset();
    cache = new Map();
    fetchers = new Map(
      keys.map((key) => {
        const id = unstable_serialize(key);
        return [
          id,
          vi
            .fn<() => Promise<unknown>>()
            .mockResolvedValueOnce({ phase: "initial", id })
            .mockResolvedValue({ phase: "refreshed", id }),
        ];
      }),
    );
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
  });

  async function render(
    selected: NormalizedGame | null = game,
    selectedFile = file,
    showCard = true,
    pending = false,
    onOpen = vi.fn(),
  ) {
    await act(async () =>
      root.render(
        <MantineProvider>
          <SWRConfig
            value={{
              provider: () => cache,
              shouldRetryOnError: false,
              revalidateOnFocus: false,
              revalidateOnReconnect: false,
            }}
          >
            {keys.map((key) => (
              <Subscriber key={unstable_serialize(key)} queryKey={key} />
            ))}
            {showCard && (
              <GameCard
                game={selected ?? undefined}
                file={selectedFile}
                pending={pending}
                onOpen={onOpen}
              />
            )}
          </SWRConfig>
        </MantineProvider>,
      ),
    );
    await vi.waitFor(() => {
      for (const key of keys) expect(cache.get(unstable_serialize(key))?.data).toBeDefined();
    });
  }

  function deleteButton() {
    return host.querySelector('button[aria-label="Delete game"]') as HTMLButtonElement;
  }

  async function clickDelete() {
    await act(async () => deleteButton().click());
  }

  function expectRefreshes(database = file, calls = 2) {
    for (const view of views) expect(fetcher(view, database)).toHaveBeenCalledTimes(calls);
  }

  function expectOtherQueriesUntouched() {
    expectRefreshes(otherFile, 1);
    expect(fetchers.get(unstable_serialize("databases"))).toHaveBeenCalledOnce();
    expect(fetchers.get(unstable_serialize(["engines", file]))).toHaveBeenCalledOnce();
    for (const key of keys.filter(
      (key) => !Array.isArray(key) || key[1] !== file || key[0] === "engines",
    )) {
      expect(cache.get(unstable_serialize(key))?.data).toMatchObject({ phase: "initial" });
    }
  }

  test("visible game action delegates its exact record and remains allocated without selection", async () => {
    const onOpen = vi.fn();
    await render(null, file, true, false, onOpen);
    const button = [...host.querySelectorAll("button")].find(
      (item) => item.textContent === "Open game",
    )!;
    expect(button.disabled).toBe(true);
    await render(game, file, true, false, onOpen);
    expect(host.contains(button)).toBe(true);
    expect(button.disabled).toBe(false);
    await act(async () => button.click());
    expect(onOpen).toHaveBeenCalledExactlyOnceWith(game);
    await render(game, file, true, true, onOpen);
    expect(button.disabled).toBe(true);
  });

  test("native refusal reports failure, refreshes nothing and releases pending for retry", async () => {
    mocks.deleteDbGame.mockRejectedValueOnce(
      new TauriCommandError({
        tag: "backend-error",
        category: "permission",
        message: "Deletion refused",
      }),
    );
    await render();
    await clickDelete();
    expect(mocks.notification).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ title: "Error", message: "Deletion refused" }),
    );
    expectRefreshes(file, 1);
    expectOtherQueriesUntouched();
    expect(deleteButton().disabled).toBe(false);
    await clickDelete();
    expect(mocks.deleteDbGame).toHaveBeenCalledTimes(2);
    expectRefreshes();
    expect(deleteButton().disabled).toBe(false);
  });

  test("real native cancellation is silent and terminal, while connection aborted is visible", async () => {
    mocks.deleteDbGame.mockRejectedValueOnce(cancellationError());
    await render();
    await clickDelete();
    expect(mocks.notification).not.toHaveBeenCalled();
    expectRefreshes(file, 1);
    expect(deleteButton().disabled).toBe(false);
    mocks.deleteDbGame.mockRejectedValueOnce(
      new TauriCommandError({
        tag: "backend-error",
        category: "network",
        message: "connection aborted",
      }),
    );
    await clickDelete();
    expect(mocks.notification).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ title: "Error", message: "connection aborted" }),
    );
    expect(deleteButton().disabled).toBe(false);
  });

  test("success suppresses duplicate clicks and waits for the real related fetch to complete", async () => {
    const native = deferred();
    const related = deferred<unknown>();
    mocks.deleteDbGame.mockReturnValueOnce(native.promise);
    await render();
    fetcher("tournaments").mockReturnValueOnce(related.promise);
    await act(async () => {
      deleteButton().click();
      deleteButton().click();
    });
    expect(mocks.deleteDbGame).toHaveBeenCalledExactlyOnceWith(file, game.id);
    expect(deleteButton().disabled).toBe(true);
    expectRefreshes(file, 1);
    await act(async () => native.resolve());
    expectRefreshes();
    expectOtherQueriesUntouched();
    const pendingThroughFetch = deleteButton().disabled;
    await clickDelete();
    await act(async () => related.resolve({ phase: "refreshed" }));
    expect(pendingThroughFetch).toBe(true);
    expect(mocks.deleteDbGame).toHaveBeenCalledOnce();
    expect(deleteButton().disabled).toBe(false);
    expect(mocks.notification).not.toHaveBeenCalled();
  });

  test.each(["games", "players", "both"] as const)(
    "real %s fetch rejection surfaces committed-deletion failure after all siblings settle",
    async (failure) => {
      await render();
      const related = deferred<unknown>();
      const errors =
        failure === "both"
          ? [new Error("Games refresh failed"), new Error("Players refresh failed")]
          : [new Error(`${failure} refresh failed`)];
      if (failure === "both") {
        fetcher("games").mockRejectedValueOnce(errors[0]);
        fetcher("players").mockRejectedValueOnce(errors[1]);
      } else fetcher(failure).mockRejectedValueOnce(errors[0]);
      fetcher("tournaments").mockReturnValueOnce(related.promise);
      const unhandled = vi.fn();
      window.addEventListener("unhandledrejection", unhandled);
      try {
        await clickDelete();
        expectRefreshes();
        const failedViews = failure === "both" ? ["games", "players"] : [failure];
        for (const [index, view] of failedViews.entries()) {
          const key = queryKeys.find((key) => key[0] === view && key[1] === file)!;
          const state = cache.get(unstable_serialize(key));
          expect(state?.error).toBe(errors[index]);
          expect(state?.data).toMatchObject({ phase: "initial" });
        }
        const pendingThroughFetch = deleteButton().disabled;
        await act(async () => related.resolve({ phase: "refreshed" }));
        // These assertions measure SWR's real semantics, including swallowed fetch rejection.
        expect(mocks.notification.mock.calls.map(([notice]) => notice.message)).toEqual(
          errors.map((error) => error.message),
        );
        for (const [notice] of mocks.notification.mock.calls)
          expect(notice.title).toBe(refreshTitle);
        expect(pendingThroughFetch).toBe(true);
        expect(deleteButton().disabled).toBe(false);
        expectOtherQueriesUntouched();
        expect(mocks.deleteDbGame).toHaveBeenCalledOnce();
        expect(unhandled).not.toHaveBeenCalled();
        await clickDelete();
        expect(mocks.deleteDbGame).toHaveBeenCalledTimes(2);
        expect(deleteButton().disabled).toBe(false);
      } finally {
        window.removeEventListener("unhandledrejection", unhandled);
      }
    },
  );

  test("cancellation from real revalidation stays silent through real normalization", async () => {
    await render();
    for (const view of views) fetcher(view).mockRejectedValueOnce(cancellationError());
    await clickDelete();
    expectRefreshes();
    expectOtherQueriesUntouched();
    expect(mocks.notification).not.toHaveBeenCalled();
    expect(deleteButton().disabled).toBe(false);
  });

  test("changing the selected row during deletion still refreshes the same games query", async () => {
    const native = deferred();
    mocks.deleteDbGame.mockReturnValueOnce(native.promise);
    await render();
    await clickDelete();
    await render({ ...game, id: 99 });
    await act(async () => native.resolve());
    expect(mocks.deleteDbGame).toHaveBeenCalledExactlyOnceWith(file, 42);
    expectRefreshes();
    expectOtherQueriesUntouched();
    expect(deleteButton().disabled).toBe(false);
  });

  test("database replacement preserves captured native target and original refresh keys", async () => {
    const native = deferred();
    mocks.deleteDbGame.mockReturnValueOnce(native.promise);
    await render();
    await clickDelete();
    await render({ ...game, id: 99 }, otherFile);
    await act(async () => native.resolve());
    expect(mocks.deleteDbGame).toHaveBeenCalledExactlyOnceWith(file, 42);
    expectRefreshes();
    expectOtherQueriesUntouched();
    expect(deleteButton().disabled).toBe(false);
  });

  test.each(["success", "failure"])(
    "card unmount during native %s retains refresh identity without notification",
    async (outcome) => {
      const native = deferred();
      mocks.deleteDbGame.mockReturnValueOnce(native.promise);
      await render();
      await clickDelete();
      await render({ ...game, id: 99 }, otherFile, false);
      await act(async () => {
        if (outcome === "success") native.resolve();
        else native.reject(new Error("Deletion refused"));
      });
      expectRefreshes(file, outcome === "success" ? 2 : 1);
      expectOtherQueriesUntouched();
      expect(mocks.notification).not.toHaveBeenCalled();
    },
  );

  test("card unmount during refresh owns late real fetch failures without notification", async () => {
    await render();
    const related = deferred<unknown>();
    fetcher("tournaments").mockReturnValueOnce(related.promise);
    await clickDelete();
    await render(game, file, false);
    await act(async () => related.reject(new Error("Related refresh failed")));
    expectRefreshes();
    expectOtherQueriesUntouched();
    expect(mocks.notification).not.toHaveBeenCalled();
    expect(mocks.deleteDbGame).toHaveBeenCalledOnce();
  });
});
