import { act, type ComponentType } from "react";
import { createRoot, type Root } from "react-dom/client";
import { SWRConfig } from "swr";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { Engine, LocalEngine } from "@/utils/engines";

const mocks = vi.hoisted(() => ({
  fileExists: vi.fn(),
  navigate: vi.fn(),
  notifyUnlessCancelled: vi.fn(),
  retireEngine: vi.fn(),
}));

vi.mock("@/platform/tauri", () => ({
  tauri: {
    fileExists: mocks.fileExists,
    getEngineConfig: vi.fn().mockResolvedValue(undefined),
    retireEngine: mocks.retireEngine,
  },
}));
vi.mock("@/components/files/notifyError", () => ({
  notifyUnlessCancelled: mocks.notifyUnlessCancelled,
}));
vi.mock("@tanstack/react-router", () => ({ useNavigate: () => mocks.navigate }));
vi.mock("@/routes/engines", () => ({ Route: { useSearch: () => ({ selected: 0 }) } }));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string }) =>
      options?.defaultValue ??
      { "Common.Error": "Error", "Engines.FileMissing": "(file missing)" }[key] ??
      key,
  }),
}));
vi.mock("@mantine/core", () => ({
  Button: ({ children, onClick, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button type="button" onClick={onClick} {...props}>
      {children}
    </button>
  ),
  Center: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Checkbox: () => <input type="checkbox" />,
  Divider: () => <hr />,
  Group: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Input: () => <input />,
  JsonInput: () => <textarea />,
  NumberInput: () => <input type="number" />,
  Paper: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  ScrollArea: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Select: () => <select />,
  SimpleGrid: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Space: () => null,
  Stack: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Text: ({ children, c }: { children: React.ReactNode; c?: string }) => (
    <span data-color={c}>{children}</span>
  ),
  TextInput: () => <input />,
  ThemeIcon: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Title: ({ children }: { children: React.ReactNode }) => <h1>{children}</h1>,
  UnstyledButton: ({ children }: { children: React.ReactNode }) => <button>{children}</button>,
}));
vi.mock("@tabler/icons-react", () => ({
  IconCloud: () => <svg aria-label="cloud" />,
  IconCopy: () => null,
  IconCpu: () => <svg aria-label="cpu" />,
  IconFolder: () => null,
  IconPhotoPlus: () => null,
  IconPlus: () => null,
  IconSearch: () => null,
}));
vi.mock("../common/LocalImage", () => ({ default: () => <img alt="engine" /> }));
vi.mock("../common/ConfirmModal", () => ({
  default: ({ onConfirm }: { onConfirm: () => void }) => (
    <button type="button" data-testid="confirm-remove" onClick={onConfirm}>
      confirm
    </button>
  ),
}));
vi.mock("../common/AppModal", () => ({ default: () => null }));
vi.mock("../common/GenericCard", () => ({ default: () => null }));
vi.mock("../common/GoModeInput", () => ({ default: () => null }));
vi.mock("../common/OpenFolderButton", () => ({ default: () => null }));
vi.mock("../panels/analysis/LinesSlider", () => ({ default: () => null }));
vi.mock("./AddEngine", () => ({ default: () => null }));
vi.mock("@/components/common/IconAction", () => ({ IconAction: () => null }));

let atomEngines: Engine[] = [];
const setAtomEngines = vi.fn(async (update: (prev: Promise<Engine[]>) => Promise<Engine[]>) => {
  atomEngines = await update(Promise.resolve(atomEngines));
});
vi.mock("jotai", async (importOriginal) => ({
  ...(await importOriginal<typeof import("jotai")>()),
  useAtom: () => [atomEngines, setAtomEngines],
}));

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

test("local removal retires by id and drops persisted state even when retirement fails", async () => {
  const engine = makeEngine("engine-capability-remove");
  const failure = new Error("retirement failed");
  atomEngines = [engine];
  mocks.retireEngine.mockRejectedValue(failure);
  const EnginesPage = (await import("./EnginesPage")).default;

  await act(async () => root.render(<EnginesPage />));
  await act(async () => {
    (host.querySelector('[data-testid="confirm-remove"]') as HTMLButtonElement).click();
    await Promise.resolve();
    await Promise.resolve();
  });

  expect(mocks.retireEngine).toHaveBeenCalledWith("engine-id");
  expect(atomEngines).toEqual([]);
  expect(mocks.notifyUnlessCancelled).toHaveBeenCalledWith("Error", failure);
});
