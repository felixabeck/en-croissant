import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

const progress = vi.hoisted(() => ({
  progress: 100,
  finished: true,
  isActive: false,
  clear: vi.fn(),
  item: {
    id: "engine_0",
    generation: 1n,
    progress: 100,
    finished: true,
    state: "failed" as "failed" | "succeeded" | "cancelled" | "running",
  },
}));

vi.mock("@/hooks/useProgress", () => ({
  useProgress: () => progress,
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("./IconAction", () => ({ default: () => null }));
vi.mock("@mantine/core", () => ({
  Box: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  Button: ({ children, disabled, onClick }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button type="button" disabled={disabled} onClick={onClick}>
      {children}
    </button>
  ),
  Group: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Progress: () => null,
}));

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  progress.finished = true;
  progress.isActive = false;
  progress.item = {
    id: "engine_0",
    generation: 1n,
    progress: 100,
    finished: true,
    state: "failed",
  };
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});

test("a failed download does not mark the engine as installed", async () => {
  const ProgressButton = (await import("./ProgressButton")).default;
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

test("a succeeded download marks the action completed", async () => {
  progress.item = { ...progress.item, state: "succeeded" };
  const ProgressButton = (await import("./ProgressButton")).default;
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
