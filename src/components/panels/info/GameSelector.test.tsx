import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import type { FileWorkspaceHandle, StampedGame } from "@/bindings";
import { normalizeError } from "@/platform/errors";
import { TauriCommandError } from "@/platform/tauri";
import { catalogueI18n } from "@/tests/catalogues";
import GameSelector, { type GameSelectorRow } from "./GameSelector";

const translation = vi.hoisted(() => ({ t: (value: string) => value }));
const mocks = vi.hoisted(() => ({
  useVirtualPageLoader: vi.fn(),
  readGames: vi.fn(),
  parsePGN: vi.fn(),
}));

vi.mock("react-i18next", () => ({ useTranslation: () => translation }));
vi.mock("@/hooks/useVirtualPageLoader", () => ({
  useVirtualPageLoader: mocks.useVirtualPageLoader,
}));
vi.mock("@/platform/tauri", async () => {
  const actual = await vi.importActual<typeof import("@/platform/tauri")>("@/platform/tauri");
  return {
    ...actual,
    tauri: { ...actual.tauri, readGames: mocks.readGames },
  };
});
vi.mock("@/utils/chess", () => ({ parsePGN: mocks.parsePGN }));
vi.mock("@tanstack/react-virtual", () => ({
  useVirtualizer: () => ({
    getTotalSize: () => 30,
    getVirtualItems: () => [{ index: 0, size: 30, start: 0 }],
  }),
}));
vi.mock("@mantine/core", () => ({
  ActionIcon: ({ children, ...props }: any) => <button {...props}>{children}</button>,
  Box: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  Button: ({ children, loading, ...props }: any) => (
    <button {...props} disabled={loading || props.disabled}>
      {children}
    </button>
  ),
  Group: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  Loader: () => null,
  Modal: ({ opened, title, children }: any) =>
    opened ? (
      <div role="dialog" aria-label={title}>
        {children}
      </div>
    ) : null,
  ScrollArea: ({ children, viewportRef }: any) => <div ref={viewportRef}>{children}</div>,
  Stack: ({ children }: any) => <div>{children}</div>,
  Text: ({ children, truncate: _truncate, fz: _fz, flex: _flex, lh: _lh, ...props }: any) => (
    <p {...props}>{children}</p>
  ),
  Tooltip: ({ children }: any) => <>{children}</>,
}));

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (cause: unknown) => void;
};

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (cause: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  void promise.catch(() => undefined);
  return { promise, resolve, reject };
}

const path: FileWorkspaceHandle = {
  id: { id: "test-file" },
  kind: "fileWorkspace",
};

const firstGame: StampedGame = {
  pgn: '[Event "First"]\n\n1. e4 *',
  stamp: "stamp-first",
  revision: "revision-first",
  present: true,
};

let host: HTMLDivElement;
let root: Root;

beforeEach(async () => {
  const instance = await catalogueI18n("de-DE");
  translation.t = instance.t.bind(instance);
  mocks.useVirtualPageLoader.mockReset().mockImplementation((_id, loadPage, onPage) => {
    return async (start: number, end: number, options?: { signal?: AbortSignal }) => {
      const entries = await loadPage(start, end, options);
      onPage(start, entries);
    };
  });
  mocks.readGames.mockReset().mockResolvedValue([firstGame]);
  mocks.parsePGN.mockReset().mockResolvedValue({ headers: { event: "Loaded game" } });
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root?.unmount());
  host?.remove();
});

function renderSelector(
  games: Map<number, GameSelectorRow>,
  deleteGame: (snapshot: {
    index: number;
    stamp: string;
    revision: string;
  }) => void | Promise<void>,
) {
  root.render(
    <GameSelector
      games={games}
      setGames={vi.fn()}
      setPage={vi.fn()}
      total={1}
      path={path}
      activePage={0}
      deleteGame={deleteGame}
    />,
  );
}

function renderPageLoader(
  deleteGame: (snapshot: {
    index: number;
    stamp: string;
    revision: string;
  }) => void | Promise<void>,
) {
  function Harness() {
    const [games, setGames] = useState<Map<number, GameSelectorRow>>(new Map());
    return (
      <GameSelector
        games={games}
        setGames={setGames}
        setPage={vi.fn()}
        total={1}
        path={path}
        activePage={0}
        deleteGame={deleteGame}
      />
    );
  }
  root.render(<Harness />);
}

function deleteButton(): HTMLButtonElement {
  return host.querySelector<HTMLButtonElement>('button[aria-label="Partie entfernen"]')!;
}

function confirmButton(): HTMLButtonElement {
  return [...host.querySelectorAll("button")].find(
    (button) => button.textContent === "Löschen",
  )! as HTMLButtonElement;
}

test("loads the stamped page through the page callback and submits its identity", async () => {
  const deleteGame = vi.fn().mockResolvedValue(undefined);
  await act(async () => renderPageLoader(deleteGame));

  expect(mocks.readGames).toHaveBeenCalledWith(path, 0, 0, undefined);
  expect(host.textContent).toContain("Loaded game");
  await act(async () => deleteButton().click());
  await act(async () => confirmButton().click());

  expect(deleteGame).toHaveBeenCalledWith({
    index: 0,
    stamp: "stamp-first",
    revision: "revision-first",
  });
});

test("keeps the confirmation snapshot when the displayed row changes", async () => {
  const deleteGame = vi.fn().mockResolvedValue(undefined);
  const original = {
    name: "Original row",
    identity: { stamp: "stamp-original", revision: "revision-original" },
  };
  await act(async () => renderSelector(new Map([[0, original]]), deleteGame));
  await act(async () => deleteButton().click());

  await act(async () =>
    renderSelector(
      new Map([
        [
          0,
          {
            name: "Updated row",
            identity: { stamp: "stamp-updated", revision: "revision-updated" },
          },
        ],
      ]),
      deleteGame,
    ),
  );
  expect(host.textContent).toContain("Updated row");
  await act(async () => confirmButton().click());

  expect(deleteGame).toHaveBeenCalledWith({
    index: 0,
    stamp: "stamp-original",
    revision: "revision-original",
  });
});

test("an unloaded row cannot open a delete confirmation", async () => {
  const read = deferred<StampedGame[]>();
  mocks.readGames.mockReturnValue(read.promise);
  const deleteGame = vi.fn();
  await act(async () => renderPageLoader(deleteGame));

  expect(deleteButton().disabled).toBe(true);
  expect(host.querySelector('[role="dialog"]')).toBeNull();
  expect(deleteGame).not.toHaveBeenCalled();

  await act(async () => read.resolve([firstGame]));
});

test("confirmation closes after the owner resolves a typed stale refusal", async () => {
  const stale = new TauriCommandError({
    tag: "backend-error",
    category: "stale-game",
    message: "stale game",
  });
  const deleteGame = vi.fn(async () => {
    try {
      throw stale;
    } catch (error) {
      if (normalizeError(error).backendCategory !== "stale-game") throw error;
    }
  });
  const row = {
    name: "Test game",
    identity: { stamp: "stamp-test", revision: "revision-test" },
  };
  await act(async () => renderSelector(new Map([[0, row]]), deleteGame));
  await act(async () => deleteButton().click());
  await act(async () => confirmButton().click());

  expect(deleteGame).toHaveBeenCalledWith({
    index: 0,
    stamp: "stamp-test",
    revision: "revision-test",
  });
  expect(host.querySelector('[role="dialog"]')).toBeNull();
});

test("keeps an ordinary failure retryable and closes after retry", async () => {
  const firstAttempt = deferred<void>();
  const secondAttempt = deferred<void>();
  const deleteGame = vi
    .fn<(snapshot: { index: number; stamp: string; revision: string }) => Promise<void>>()
    .mockReturnValueOnce(firstAttempt.promise)
    .mockReturnValueOnce(secondAttempt.promise);
  const row = {
    name: "Test game",
    identity: { stamp: "stamp-test", revision: "revision-test" },
  };

  try {
    await act(async () => renderSelector(new Map([[0, row]]), deleteGame));
    await act(async () => deleteButton().click());

    const button = confirmButton();
    await act(async () => {
      button.click();
      button.click();
    });
    expect(deleteGame).toHaveBeenCalledTimes(1);
    expect(host.querySelector('[role="dialog"]')).not.toBeNull();
    expect(button.disabled).toBe(true);

    await act(async () => firstAttempt.reject(new Error("native rejected at /private/file.pgn")));
    expect(host.querySelector('[role="dialog"]')?.textContent).toContain(
      "Die Aktion konnte nicht abgeschlossen werden. Bitte versuche es erneut.",
    );
    expect(host.textContent).not.toContain("native rejected");
    expect(host.textContent).not.toContain("/private/file.pgn");
    expect(button.disabled).toBe(false);

    await act(async () => confirmButton().click());
    expect(deleteGame).toHaveBeenCalledTimes(2);
    expect(host.querySelector('[role="dialog"]')).not.toBeNull();
    expect(confirmButton().disabled).toBe(true);

    await act(async () => secondAttempt.resolve());
    expect(host.querySelector('[role="dialog"]')).toBeNull();
  } finally {
    firstAttempt.resolve();
    secondAttempt.resolve();
  }
});
