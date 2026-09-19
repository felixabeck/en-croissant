import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

const progress = vi.hoisted(() => ({
  progress: 100,
  finished: true,
  isActive: false,
  clear: vi.fn(),
  fence: vi.fn(),
  discard: vi.fn(),
  item: {
    id: "engine_0",
    generation: 1n,
    progress: 100,
    finished: true,
    state: "failed" as "failed" | "succeeded" | "cancelled" | "running",
  },
}));
const notifyListenerError = vi.hoisted(() => vi.fn());

vi.mock("@/hooks/useProgress", () => ({
  useProgress: () => progress,
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@/components/files/notifyError", () => ({ notifyListenerError }));
vi.mock("./IconAction", () => ({
  default: ({ onClick }: { onClick: () => void }) => (
    <button type="button" data-testid="cancel" onClick={onClick}>
      cancel
    </button>
  ),
}));
import ProgressButton from "./ProgressButton";

vi.mock("@mantine/core", () => ({
  Box: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  Button: ({ children, disabled, onClick }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button type="button" disabled={disabled} onClick={onClick}>
      {children}
    </button>
  ),
  Group: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Progress: () => <div data-testid="progress" />,
}));

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  progress.finished = true;
  progress.progress = 100;
  progress.isActive = false;
  progress.item = {
    id: "engine_0",
    generation: 1n,
    progress: 100,
    finished: true,
    state: "failed",
  };
  progress.clear.mockReset().mockResolvedValue(undefined);
  progress.fence.mockReset();
  progress.discard.mockReset();
  notifyListenerError.mockReset();
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});

test("a failed download does not mark the engine as installed", async () => {
  await act(async () => {
    root.render(
      <ProgressButton
        id="engine_0"
        initInstalled={false}
        onClick={() => undefined}
        labels={{
          completed: "Installed",
          action: "Install",
          inProgress: "Downloading",
          finalizing: "Extracting",
        }}
        inProgress={false}
        setInProgress={() => undefined}
      />,
    );
  });
  const button = host.querySelector("button");
  expect(button?.textContent).toContain("Install");
  expect(button?.disabled).toBe(false);
});

test("cancelled progress does not mark the action completed", async () => {
  progress.item = { ...progress.item, state: "cancelled" };
  await act(async () => {
    root.render(
      <ProgressButton
        id="engine_0"
        initInstalled={false}
        onClick={() => undefined}
        labels={{
          completed: "Installed",
          action: "Install",
          inProgress: "Downloading",
          finalizing: "Extracting",
        }}
        inProgress={false}
        setInProgress={() => undefined}
      />,
    );
  });
  const button = host.querySelector("button");
  expect(button?.textContent).toContain("Install");
  expect(button?.disabled).toBe(false);
});

test("initInstalled marks the action completed even if progress failed", async () => {
  await act(async () => {
    root.render(
      <ProgressButton
        id="engine_0"
        initInstalled
        onClick={() => undefined}
        labels={{
          completed: "Installed",
          action: "Install",
          inProgress: "Downloading",
          finalizing: "Extracting",
        }}
        inProgress={false}
        setInProgress={() => undefined}
      />,
    );
  });
  const button = host.querySelector("button");
  expect(button?.textContent).toContain("Installed");
  expect(button?.disabled).toBe(true);
});

test("completeOnProgressSuccess false ignores a succeeded download job", async () => {
  progress.item = { ...progress.item, state: "succeeded" };
  await act(async () => {
    root.render(
      <ProgressButton
        id="engine_0"
        initInstalled={false}
        completeOnProgressSuccess={false}
        onClick={() => undefined}
        labels={{
          completed: "Installed",
          action: "Install",
          inProgress: "Downloading",
          finalizing: "Extracting",
        }}
        inProgress={false}
        setInProgress={() => undefined}
      />,
    );
  });
  const button = host.querySelector("button");
  expect(button?.textContent).toContain("Install");
  expect(button?.disabled).toBe(false);
});

test("a succeeded download marks the action completed", async () => {
  progress.item = { ...progress.item, state: "succeeded" };
  await act(async () => {
    root.render(
      <ProgressButton
        id="engine_0"
        initInstalled={false}
        onClick={() => undefined}
        labels={{
          completed: "Installed",
          action: "Install",
          inProgress: "Downloading",
          finalizing: "Extracting",
        }}
        inProgress={false}
        setInProgress={() => undefined}
      />,
    );
  });
  const button = host.querySelector("button");
  expect(button?.textContent).toContain("Installed");
  expect(button?.disabled).toBe(true);
});

test("a late clear acknowledgement cannot stop a replacement operation", async () => {
  progress.finished = false;
  progress.item = { ...progress.item, finished: false, state: "running" };
  let resolveClear: () => void = () => undefined;
  progress.clear.mockReturnValueOnce(new Promise<void>((resolve) => (resolveClear = resolve)));
  const setInProgress = vi.fn();
  const render = (id: string) =>
    root.render(
      <ProgressButton
        id={id}
        initInstalled={false}
        onClick={() => undefined}
        onCancel={vi.fn()}
        labels={{ completed: "Done", action: "Run", inProgress: "Running" }}
        inProgress
        setInProgress={setInProgress}
      />,
    );
  await act(async () => render("old"));
  await act(async () => host.querySelector<HTMLButtonElement>("[data-testid='cancel']")!.click());
  await act(async () => render("replacement"));
  await act(async () => resolveClear());
  expect(setInProgress).not.toHaveBeenCalledWith(false);
});

test("reports clear rejection while keeping the running UI", async () => {
  progress.finished = false;
  progress.item = { ...progress.item, finished: false, state: "running" };
  const failure = new Error("clear failed");
  progress.clear.mockRejectedValueOnce(failure);
  const setInProgress = vi.fn();
  await act(async () => {
    root.render(
      <ProgressButton
        id="job"
        initInstalled={false}
        onClick={() => undefined}
        onCancel={vi.fn()}
        labels={{ completed: "Done", action: "Run", inProgress: "Running" }}
        inProgress
        setInProgress={setInProgress}
      />,
    );
  });
  await act(async () => host.querySelector<HTMLButtonElement>("[data-testid='cancel']")!.click());
  expect(notifyListenerError).toHaveBeenCalledWith(failure);
  expect(setInProgress).not.toHaveBeenCalledWith(false);
});

test("a successful non-clearing cancel fences its returned generation", async () => {
  progress.progress = 50;
  progress.finished = false;
  progress.isActive = true;
  progress.item = { ...progress.item, progress: 50, finished: false, state: "running" };
  const onCancel = vi.fn().mockResolvedValue({ clearedGeneration: 4n });
  const setInProgress = vi.fn();

  await act(async () => {
    root.render(
      <ProgressButton
        id="job"
        initInstalled={false}
        onClick={() => undefined}
        onCancel={onCancel}
        clearOnCancel={false}
        labels={{ completed: "Done", action: "Run", inProgress: "Running" }}
        inProgress
        setInProgress={setInProgress}
      />,
    );
  });
  await act(async () => host.querySelector<HTMLButtonElement>("[data-testid='cancel']")!.click());

  expect(onCancel).toHaveBeenCalledOnce();
  expect(progress.clear).not.toHaveBeenCalled();
  expect(progress.fence).toHaveBeenCalledWith(4n);
  expect(progress.discard).not.toHaveBeenCalled();
  expect(setInProgress).toHaveBeenCalledWith(false);
});

test("a successful non-clearing cancel with no generation discards the display", async () => {
  progress.progress = 50;
  progress.finished = false;
  progress.isActive = true;
  progress.item = { ...progress.item, progress: 50, finished: false, state: "running" };
  const onCancel = vi.fn().mockResolvedValue({ clearedGeneration: null });
  const setInProgress = vi.fn();

  await act(async () => {
    root.render(
      <ProgressButton
        id="job"
        initInstalled={false}
        onClick={() => undefined}
        onCancel={onCancel}
        clearOnCancel={false}
        labels={{ completed: "Done", action: "Run", inProgress: "Running" }}
        inProgress
        setInProgress={setInProgress}
      />,
    );
  });
  await act(async () => host.querySelector<HTMLButtonElement>("[data-testid='cancel']")!.click());

  expect(progress.clear).not.toHaveBeenCalled();
  expect(progress.discard).toHaveBeenCalledOnce();
  expect(progress.fence).not.toHaveBeenCalled();
  expect(setInProgress).toHaveBeenCalledWith(false);
});

test("a rejected cancel keeps the running UI and is not reported by the button", async () => {
  progress.progress = 50;
  progress.finished = false;
  progress.isActive = true;
  progress.item = { ...progress.item, progress: 50, finished: false, state: "running" };
  const failure = new Error("cancel failed");
  const setInProgress = vi.fn();
  const onCancel = vi.fn().mockRejectedValue(failure);

  await act(async () => {
    root.render(
      <ProgressButton
        id="job"
        initInstalled={false}
        onClick={() => undefined}
        onCancel={onCancel}
        clearOnCancel={false}
        labels={{ completed: "Done", action: "Run", inProgress: "Running" }}
        inProgress
        setInProgress={setInProgress}
      />,
    );
  });
  await act(async () => host.querySelector<HTMLButtonElement>("[data-testid='cancel']")!.click());

  expect(progress.clear).not.toHaveBeenCalled();
  expect(progress.fence).not.toHaveBeenCalled();
  expect(progress.discard).not.toHaveBeenCalled();
  expect(setInProgress).not.toHaveBeenCalledWith(false);
  expect(notifyListenerError).not.toHaveBeenCalled();
});

test.each([
  ["cancelled", false],
  ["failed", true],
  ["running", true],
] as const)("renders the progress bar for %s according to its state", async (state, hasBar) => {
  progress.progress = 50;
  progress.finished = state !== "running";
  progress.isActive = state === "running";
  progress.item = { ...progress.item, progress: 50, finished: state !== "running", state };

  await act(async () => {
    root.render(
      <ProgressButton
        id="job"
        initInstalled={false}
        onClick={() => undefined}
        labels={{ completed: "Done", action: "Run", inProgress: "Running" }}
        inProgress={false}
        setInProgress={() => undefined}
      />,
    );
  });

  expect(host.querySelector("[data-testid='progress']") !== null).toBe(hasBar);
});

test("a succeeded item still shows progress when success does not complete the action", async () => {
  progress.progress = 50;
  progress.finished = true;
  progress.isActive = false;
  progress.item = { ...progress.item, progress: 50, finished: true, state: "succeeded" };

  await act(async () => {
    root.render(
      <ProgressButton
        id="job"
        initInstalled={false}
        completeOnProgressSuccess={false}
        onClick={() => undefined}
        labels={{ completed: "Done", action: "Run", inProgress: "Running" }}
        inProgress={false}
        setInProgress={() => undefined}
      />,
    );
  });

  expect(host.querySelector("[data-testid='progress']")).not.toBeNull();
  expect(host.querySelector("button")?.textContent).toContain("Run");
});
