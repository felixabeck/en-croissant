import { act, type ComponentType } from "react";
import { createRoot, type Root } from "react-dom/client";
import { SWRConfig } from "swr";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { Engine, LocalEngine } from "@/utils/engines";

const mocks = vi.hoisted(() => ({ fileExists: vi.fn() }));

vi.mock("@/platform/tauri", () => ({ tauri: { fileExists: mocks.fileExists } }));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string }) =>
      options?.defaultValue ??
      { "Common.Error": "Error", "Engines.FileMissing": "(file missing)" }[key] ??
      key,
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

function makeEngine(handleId: string): LocalEngine {
  return {
    type: "local",
    id: "engine-id",
    name: "Stockfish",
    version: "17",
    handle: { id: { id: handleId }, kind: "engine" },
    filename: "stockfish",
  };
}

let host: HTMLDivElement;
let root: Root;
let EngineName: ComponentType<{ engine: Engine }>;

async function render(engine: Engine) {
  await act(async () => {
    root.render(
      <SWRConfig value={{ shouldRetryOnError: false }}>
        <EngineName engine={engine} />
      </SWRConfig>,
    );
    await Promise.resolve();
    await Promise.resolve();
  });
}

beforeEach(async () => {
  vi.clearAllMocks();
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
    const engine = makeEngine("engine-capability-present");
    mocks.fileExists.mockResolvedValue(true);
    await render(engine);

    expect(mocks.fileExists).toHaveBeenCalledWith(engine.handle.id);
    expect(host.textContent).toContain("Stockfish");
    expect(host.textContent).not.toContain("(file missing)");
    expect(host.textContent).not.toContain("(Error)");
    expect(host.querySelector('[data-color="red"]')).toBeNull();
  });

  test("renders the existing missing-file copy when the engine file is absent", async () => {
    const engine = makeEngine("engine-capability-missing");
    mocks.fileExists.mockResolvedValue(false);
    await render(engine);

    expect(mocks.fileExists).toHaveBeenCalledWith(engine.handle.id);
    expect(host.textContent).toContain("Stockfish (file missing)");
    expect(host.querySelector('[data-color="red"]')).not.toBeNull();
  });

  test("renders Error without claiming the file is missing when inspection rejects", async () => {
    const engine = makeEngine("engine-capability-denied");
    mocks.fileExists.mockRejectedValue(new Error("denied"));
    await render(engine);

    expect(mocks.fileExists).toHaveBeenCalledWith(engine.handle.id);
    expect(mocks.fileExists).toHaveBeenCalledTimes(1);
    expect(host.textContent).toContain("Stockfish (Error)");
    expect(host.textContent).not.toContain("(file missing)");
    expect(host.querySelector('[data-color="red"]')).not.toBeNull();
  });
});
