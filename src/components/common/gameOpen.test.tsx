import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { gameRowActivation, OpenGameButton, useGameOpen } from "./gameOpen";

const pendingPublications = vi.hoisted(() => ({ enabled: false, record: vi.fn() }));
vi.mock("react", async (importOriginal) => {
  const react = await importOriginal<typeof import("react")>();
  const setters = new WeakMap<object, unknown>();
  return {
    ...react,
    useState<T>(initialState: T | (() => T)) {
      const state = react.useState(initialState);
      if (!pendingPublications.enabled) return state;
      const [value, setValue] = state;
      let observedSetter = setters.get(setValue) as typeof setValue | undefined;
      if (!observedSetter) {
        observedSetter = (update) => {
          pendingPublications.record(update);
          setValue(update);
        };
        setters.set(setValue, observedSetter);
      }
      return [value, observedSetter];
    },
  };
});
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (_key: string, options: any) => options.defaultValue }),
}));
vi.mock("@mantine/core", () => ({
  Button: ({ children, onClick, disabled, "aria-busy": busy }: any) => (
    <button disabled={disabled} onClick={onClick} aria-busy={busy}>
      {children}
    </button>
  ),
}));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  pendingPublications.enabled = false;
  pendingPublications.record.mockClear();
  host.remove();
});

function Harness({
  open,
  onError,
}: {
  open: (target: number) => Promise<unknown>;
  onError: (error: unknown) => void;
}) {
  const { activate, pending } = useGameOpen(open, onError);
  return (
    <>
      <OpenGameButton pending={pending} onOpen={() => activate(0)} />
      <div data-row {...gameRowActivation(1, activate)}>
        <span>Second</span>
        <button>Delete</button>
      </div>
    </>
  );
}

test("all gestures share one synchronous lock and recover after null and rejection", async () => {
  let settle!: (value: null) => void;
  const error = new Error("open failed");
  const open = vi
    .fn()
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          settle = resolve;
        }),
    )
    .mockRejectedValueOnce(error)
    .mockResolvedValueOnce("admitted");
  const onError = vi.fn();
  await act(async () => root.render(<Harness open={open} onError={onError} />));
  const row = host.querySelector<HTMLElement>("[data-row]")!;
  const button = host.querySelector<HTMLButtonElement>("button")!;
  expect(button.textContent).toBe("Open game");
  await act(async () => {
    row.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
    row.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    button.click();
  });
  expect(open.mock.calls).toEqual([[1]]);
  expect(button.disabled).toBe(true);
  await act(async () => settle(null));
  expect(button.disabled).toBe(false);
  await act(async () => button.click());
  expect(onError).toHaveBeenCalledExactlyOnceWith(error);
  expect(button.disabled).toBe(false);
  await act(async () => {
    row.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
  });
  expect(open.mock.calls).toEqual([[1], [0], [1]]);
});

test("Enter ignores descendants and repeat, double-click ignores nested controls", async () => {
  const open = vi.fn().mockResolvedValue(null);
  await act(async () => root.render(<Harness open={open} onError={vi.fn()} />));
  const row = host.querySelector<HTMLElement>("[data-row]")!;
  await act(async () => {
    row.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", repeat: true, bubbles: true }));
    row.dispatchEvent(new KeyboardEvent("keydown", { key: " ", bubbles: true }));
    row
      .querySelector("span")!
      .dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    row
      .querySelector("button")!
      .dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    row.querySelector("button")!.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
  });
  expect(open).not.toHaveBeenCalled();
  expect(row.tabIndex).toBe(0);
  await act(async () => {
    row.querySelector("span")!.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
  });
  expect(open).toHaveBeenCalledExactlyOnceWith(1);
});

test("an admitted operation settles after unmount without publishing pending UI", async () => {
  pendingPublications.enabled = true;
  let settle!: () => void;
  let operation!: Promise<void>;
  const open = vi.fn(
    () =>
      new Promise<void>((resolve) => {
        settle = resolve;
      }),
  );
  const onError = vi.fn();
  function UnmountHarness() {
    const { activate, pending } = useGameOpen(open, onError);
    return (
      <OpenGameButton
        pending={pending}
        onOpen={() => {
          operation = activate(0);
          return operation;
        }}
      />
    );
  }
  await act(async () => root.render(<UnmountHarness />));
  await act(async () => host.querySelector<HTMLButtonElement>("button")!.click());
  expect(open).toHaveBeenCalledExactlyOnceWith(0);
  expect(host.querySelector<HTMLButtonElement>("button")!.disabled).toBe(true);
  expect(pendingPublications.record.mock.calls).toEqual([[true]]);
  await act(async () => root.unmount());
  await act(async () => {
    settle();
    await expect(operation).resolves.toBeUndefined();
  });
  expect(onError).not.toHaveBeenCalled();
  expect(pendingPublications.record.mock.calls).toEqual([[true]]);
});
