import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import type { FileWorkspaceHandle } from "@/bindings";
import { catalogueI18n } from "@/tests/catalogues";
import GameSelector from "./GameSelector";

const translation = vi.hoisted(() => ({ t: (value: string) => value }));
const mocks = vi.hoisted(() => ({ useVirtualPageLoader: vi.fn(() => vi.fn()) }));

vi.mock("react-i18next", () => ({ useTranslation: () => translation }));
vi.mock("@/hooks/useVirtualPageLoader", () => ({
  useVirtualPageLoader: mocks.useVirtualPageLoader,
}));
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

type Deferred = {
  promise: Promise<void>;
  resolve: () => void;
  reject: (cause: unknown) => void;
};

function deferred(): Deferred {
  let resolve!: () => void;
  let reject!: (cause: unknown) => void;
  const promise = new Promise<void>((promiseResolve, promiseReject) => {
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

let host: HTMLDivElement;
let root: Root;

beforeEach(async () => {
  const instance = await catalogueI18n("de-DE");
  translation.t = instance.t.bind(instance);
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root?.unmount());
  host?.remove();
});

function renderSelector(deleteGame: (index: number) => void | Promise<void>) {
  root.render(
    <GameSelector
      games={new Map([[0, "Test game"]])}
      setGames={vi.fn()}
      setPage={vi.fn()}
      total={1}
      path={path}
      activePage={0}
      deleteGame={deleteGame}
    />,
  );
}

function deleteButton(): HTMLButtonElement {
  return host.querySelector<HTMLButtonElement>('button[aria-label="Partie entfernen"]')!;
}

function confirmButton(): HTMLButtonElement {
  return [...host.querySelectorAll("button")].find(
    (button) => button.textContent === "Löschen",
  )! as HTMLButtonElement;
}

test("keeps the real deletion confirmation pending, reports failure, and closes after retry", async () => {
  const firstAttempt = deferred();
  const secondAttempt = deferred();
  const deleteGame = vi
    .fn<(index: number) => Promise<void>>()
    .mockReturnValueOnce(firstAttempt.promise)
    .mockReturnValueOnce(secondAttempt.promise);

  try {
    await act(async () => renderSelector(deleteGame));
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

test("closes exactly once for an ordinary successful deletion", async () => {
  const deleteGame = vi.fn().mockResolvedValue(undefined);

  try {
    await act(async () => renderSelector(deleteGame));
    await act(async () => deleteButton().click());
    await act(async () => confirmButton().click());

    expect(deleteGame).toHaveBeenCalledTimes(1);
    expect(host.querySelector('[role="dialog"]')).toBeNull();
  } finally {
    await act(async () => root.unmount());
  }
});
