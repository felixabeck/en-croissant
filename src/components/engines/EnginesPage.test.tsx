import { act, type ComponentType } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { Engine } from "@/utils/engines";

const mocks = vi.hoisted(() => ({
  fileExists: vi.fn(),
  swr: { data: undefined as boolean | undefined, error: undefined as Error | undefined },
}));

vi.mock("@/platform/tauri", () => ({ tauri: { fileExists: mocks.fileExists } }));
vi.mock("swr/immutable", () => ({ default: () => mocks.swr }));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string }) =>
      options?.defaultValue ?? (key === "Common.Error" ? "Error" : key),
  }),
}));
vi.mock("@mantine/core", () => ({
  Group: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Stack: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Text: ({ children, c }: { children: React.ReactNode; c?: string }) => (
    <span data-color={c}>{children}</span>
  ),
}));
vi.mock("@tabler/icons-react", () => ({
  IconCloud: () => <svg aria-label="cloud" />,
  IconCpu: () => <svg aria-label="cpu" />,
}));
vi.mock("../common/LocalImage", () => ({ default: () => <img alt="engine" /> }));

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const engine: Engine = {
  type: "local",
  id: "engine-id",
  name: "Stockfish",
  version: "17",
  handle: { id: { id: "engine-capability" }, kind: "engine" },
  filename: "stockfish",
};

let host: HTMLDivElement;
let root: Root;
let EngineName: ComponentType<{ engine: Engine }>;

async function render() {
  await act(async () => root.render(<EngineName engine={engine} />));
}

beforeEach(async () => {
  vi.clearAllMocks();
  mocks.swr = { data: undefined, error: undefined };
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  EngineName = (await import("./EnginesPage")).EngineName;
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});

describe("EngineName binary inspection state", () => {
  test("renders no status when the engine file is present", async () => {
    mocks.swr = { data: true, error: undefined };
    await render();

    expect(host.textContent).toContain("Stockfish");
    expect(host.textContent).not.toContain("(file missing)");
    expect(host.textContent).not.toContain("(Error)");
    expect(host.querySelector('[data-color="red"]')).toBeNull();
  });

  test("renders the existing missing-file copy when the engine file is absent", async () => {
    mocks.swr = { data: false, error: undefined };
    await render();

    expect(host.textContent).toContain("Stockfish (file missing)");
    expect(host.querySelector('[data-color="red"]')).not.toBeNull();
  });

  test("renders Error without claiming the file is missing when inspection rejects", async () => {
    mocks.swr = { data: undefined, error: new Error("denied") };
    await render();

    expect(host.textContent).toContain("Stockfish (Error)");
    expect(host.textContent).not.toContain("(file missing)");
    expect(host.querySelector('[data-color="red"]')).not.toBeNull();
  });
});
