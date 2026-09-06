import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { SWRConfig } from "swr";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { Engine, LocalEngine } from "@/utils/engines";

const mocks = vi.hoisted(() => ({
  fileExists: vi.fn(),
  navigate: vi.fn(),
  notifyUnlessCancelled: vi.fn(),
  retireEngine: vi.fn(),
  getEngineConfig: vi.fn(),
  issueEngineImage: vi.fn(),
  issueEngineResource: vi.fn(),
  reconcileEngineAttachments: vi.fn(),
  saveEngines: vi.fn(),
  selected: 0,
}));

vi.mock("@/platform/tauri", () => ({
  tauri: {
    fileExists: mocks.fileExists,
    getEngineConfig: mocks.getEngineConfig,
    retireEngine: mocks.retireEngine,
    issueEngineImage: mocks.issueEngineImage,
    issueEngineResource: mocks.issueEngineResource,
    reconcileEngineAttachments: mocks.reconcileEngineAttachments,
  },
}));
vi.mock("@/components/files/notifyError", () => ({
  notifyUnlessCancelled: mocks.notifyUnlessCancelled,
  runUnlessCancelled: async (title: string, action: () => Promise<unknown>) => {
    try {
      return await action();
    } catch (error) {
      if (!(error instanceof Error && error.message === "Cancellation")) {
        mocks.notifyUnlessCancelled(title, error);
      }
      return undefined;
    }
  },
}));
import EnginesPage, { EngineName } from "./EnginesPage";

vi.mock("@tanstack/react-router", () => ({ useNavigate: () => mocks.navigate }));
vi.mock("@/routes/engines", () => ({
  Route: { useSearch: () => ({ selected: mocks.selected }) },
}));
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
vi.mock("@/components/common/IconAction", () => ({
  IconAction: ({ label, onClick }: { label: string; onClick?: () => void }) => (
    <button type="button" aria-label={label} onClick={onClick} />
  ),
}));

let atomEngines: Engine[] = [];
const setAtomEngines = vi.fn(async (update: (prev: Engine[]) => Engine[] | Promise<Engine[]>) => {
  atomEngines = await update(atomEngines);
  return { operationId: "save", key: "engines", saved: true, synchronized: true };
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
    settings: [
      { type: "string", name: "MultiPV", value: "1" },
      { type: "string", name: "Threads", value: "1" },
      { type: "string", name: "Hash", value: "16" },
    ],
  };
}

let host: HTMLDivElement;
let root: Root;

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

async function renderSettings() {
  await act(async () => {
    root.render(
      <SWRConfig value={{ shouldRetryOnError: false }}>
        <EnginesPage />
      </SWRConfig>,
    );
  });
  await vi.waitFor(() => expect(mocks.getEngineConfig).toHaveBeenCalled());
}

function resource(id: string, kind: "file" | "directory") {
  return { id: { id }, kind, displayName: id } as const;
}

function resourceButton(label: string) {
  return [...host.querySelectorAll<HTMLButtonElement>("button")].find(
    (button) => button.textContent === label,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.reconcileEngineAttachments.mockResolvedValue(undefined);
  mocks.issueEngineResource.mockReset();
  mocks.getEngineConfig.mockResolvedValue({
    name: "Stockfish",
    options: [
      { type: "string", value: { name: "SyzygyPath", default: null } },
      { type: "string", value: { name: "EvalFile", default: null } },
    ],
  });
  mocks.selected = 0;
  mocks.saveEngines.mockImplementation(async (update) => {
    atomEngines = update(atomEngines);
    return { operationId: "save", key: "engines", saved: true, synchronized: true };
  });
  setAtomEngines.mockImplementation(async (update) => {
    atomEngines = await update(atomEngines);
    return { operationId: "save", key: "engines", saved: true, synchronized: true };
  });
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
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

test("directory resource picker stores a real path option", async () => {
  const engine = makeEngine("engine-resource-directory");
  const selected = resource("tables", "directory");
  atomEngines = [engine];
  mocks.issueEngineResource.mockResolvedValue(selected);
  await renderSettings();

  await act(async () => {
    resourceButton("Common.Open")?.click();
    await vi.waitFor(() => expect(mocks.issueEngineResource).toHaveBeenCalledOnce());
  });

  expect(mocks.issueEngineResource).toHaveBeenCalledWith(true);
  expect(atomEngines[0].settings).toEqual(
    expect.arrayContaining([{ type: "resource", name: "SyzygyPath", resources: [selected] }]),
  );
});

test("file resource picker stores a replacement resource", async () => {
  const engine = makeEngine("engine-resource-file");
  const first = resource("eval-a", "file");
  const replacement = resource("eval-b", "file");
  atomEngines = [engine];
  mocks.issueEngineResource.mockResolvedValueOnce(first).mockResolvedValueOnce(replacement);
  await renderSettings();

  await act(async () => {
    resourceButton("EvalFile")?.click();
    await vi.waitFor(() => expect(mocks.issueEngineResource).toHaveBeenCalledOnce());
  });
  await act(async () => {
    root.render(
      <SWRConfig value={{ shouldRetryOnError: false }}>
        <EnginesPage />
      </SWRConfig>,
    );
    await Promise.resolve();
  });
  await act(async () => {
    resourceButton("EvalFile")?.click();
    await vi.waitFor(() => expect(mocks.issueEngineResource).toHaveBeenCalledTimes(2));
  });

  expect(mocks.issueEngineResource).toHaveBeenNthCalledWith(1, false);
  expect(mocks.issueEngineResource).toHaveBeenNthCalledWith(2, false);
  expect(atomEngines[0].settings).toEqual(
    expect.arrayContaining([{ type: "resource", name: "EvalFile", resources: [replacement] }]),
  );
});

test("path resource picker appends multiple directory handles", async () => {
  const engine = makeEngine("engine-resource-append");
  const first = resource("tables-a", "directory");
  const second = resource("tables-b", "directory");
  atomEngines = [engine];
  mocks.issueEngineResource.mockResolvedValueOnce(first).mockResolvedValueOnce(second);
  await renderSettings();

  await act(async () => {
    resourceButton("Common.Open")?.click();
    await vi.waitFor(() => expect(mocks.issueEngineResource).toHaveBeenCalledOnce());
  });
  await act(async () => {
    root.render(
      <SWRConfig value={{ shouldRetryOnError: false }}>
        <EnginesPage />
      </SWRConfig>,
    );
    await Promise.resolve();
  });
  await act(async () => {
    resourceButton("Common.Open")?.click();
    await vi.waitFor(() => expect(mocks.issueEngineResource).toHaveBeenCalledTimes(2));
  });

  expect(mocks.issueEngineResource).toHaveBeenNthCalledWith(1, true);
  expect(mocks.issueEngineResource).toHaveBeenNthCalledWith(2, true);
  expect(atomEngines[0].settings).toEqual(
    expect.arrayContaining([{ type: "resource", name: "SyzygyPath", resources: [first, second] }]),
  );
});

test("resource picker errors and cancellation do not adopt handles", async () => {
  const engine = makeEngine("engine-resource-errors");
  atomEngines = [engine];
  mocks.issueEngineResource.mockRejectedValueOnce(new Error("permission denied"));
  await renderSettings();

  await act(async () => {
    resourceButton("Common.Open")?.click();
    await vi.waitFor(() => expect(mocks.notifyUnlessCancelled).toHaveBeenCalledOnce());
  });
  expect(atomEngines[0].settings).toEqual(
    expect.arrayContaining([
      { type: "string", name: "MultiPV", value: "1" },
      { type: "string", name: "Threads", value: "1" },
      { type: "string", name: "Hash", value: "16" },
    ]),
  );

  mocks.notifyUnlessCancelled.mockReset();
  mocks.issueEngineResource.mockRejectedValueOnce(new Error("Cancellation"));
  await act(async () => {
    resourceButton("Common.Open")?.click();
    await Promise.resolve();
  });
  expect(mocks.notifyUnlessCancelled).not.toHaveBeenCalled();
  expect(atomEngines[0].settings).toEqual(
    expect.arrayContaining([
      { type: "string", name: "MultiPV", value: "1" },
      { type: "string", name: "Threads", value: "1" },
      { type: "string", name: "Hash", value: "16" },
    ]),
  );
});

test("stale directory resource picker result is abandoned after unmount", async () => {
  let resolveResource!: (value: ReturnType<typeof resource>) => void;
  atomEngines = [makeEngine("engine-resource-stale")];
  mocks.issueEngineResource.mockReturnValue(
    new Promise((resolve) => {
      resolveResource = resolve;
    }),
  );
  await renderSettings();
  resourceButton("Common.Open")?.click();
  await vi.waitFor(() => expect(mocks.issueEngineResource).toHaveBeenCalledOnce());

  await act(async () => root.unmount());
  await act(async () => {
    resolveResource(resource("late-directory", "directory"));
    await vi.waitFor(() =>
      expect(mocks.reconcileEngineAttachments).toHaveBeenCalledWith(
        expect.objectContaining({ abandoned_ids: [{ id: "late-directory" }] }),
      ),
    );
  });
  expect(setAtomEngines).not.toHaveBeenCalled();
});

test("local removal retires by id and drops persisted state even when retirement fails", async () => {
  const engine = makeEngine("engine-capability-remove");
  const failure = new Error("retirement failed");
  atomEngines = [engine];
  mocks.retireEngine.mockRejectedValue(failure);

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

test("details picker abandons a result that resolves after unmount without persisting it", async () => {
  let resolveImage!: (value: { id: { id: string }; kind: "engineImage" }) => void;
  atomEngines = [makeEngine("engine-capability")];
  mocks.issueEngineImage.mockReturnValue(new Promise((resolve) => (resolveImage = resolve)));
  mocks.fileExists.mockResolvedValue(true);

  await act(async () => root.render(<EnginesPage />));
  host
    .querySelector<HTMLButtonElement>('button[aria-label="Engines.Settings.SelectImage"]')
    ?.click();
  await act(async () => root.unmount());
  await act(async () => {
    resolveImage({ id: { id: "late-details-image" }, kind: "engineImage" });
    await vi.waitFor(() => expect(mocks.reconcileEngineAttachments).toHaveBeenCalledOnce());
  });

  expect(setAtomEngines).not.toHaveBeenCalled();
  expect(mocks.reconcileEngineAttachments).toHaveBeenCalledWith(
    expect.objectContaining({ abandoned_ids: [{ id: "late-details-image" }] }),
  );
});

test("queued details save rechecks closure after a prior update deletes its target", async () => {
  let releaseDelete!: () => void;
  let queue = Promise.resolve();
  atomEngines = [makeEngine("engine-capability")];
  mocks.issueEngineImage.mockResolvedValue({
    id: { id: "queued-details-image" },
    kind: "engineImage",
  });
  mocks.fileExists.mockResolvedValue(true);
  setAtomEngines.mockImplementation((update) => {
    const run = queue.then(async () => {
      atomEngines = await update(atomEngines);
      return { operationId: "save", key: "engines", saved: true, synchronized: true };
    });
    queue = run.then(() => undefined);
    return run;
  });

  const deletion = setAtomEngines(async () => {
    await new Promise<void>((resolve) => (releaseDelete = resolve));
    return [];
  });
  await act(async () => root.render(<EnginesPage />));
  host
    .querySelector<HTMLButtonElement>('button[aria-label="Engines.Settings.SelectImage"]')
    ?.click();
  await vi.waitFor(() => expect(mocks.issueEngineImage).toHaveBeenCalledOnce());
  await act(async () => root.unmount());
  await vi.waitFor(() => expect(releaseDelete).toBeTypeOf("function"));
  releaseDelete();
  await deletion;
  await vi.waitFor(() =>
    expect(mocks.reconcileEngineAttachments).toHaveBeenCalledWith(
      expect.objectContaining({ abandoned_ids: [{ id: "queued-details-image" }] }),
    ),
  );

  expect(atomEngines).toEqual([]);
});

test("changing the selected engine closes the former immutable-owner draft", async () => {
  let resolveImage!: (value: { id: { id: string }; kind: "engineImage" }) => void;
  atomEngines = [
    makeEngine("first-binary"),
    { ...makeEngine("second-binary"), id: "second-engine", name: "Second" },
  ];
  mocks.issueEngineImage.mockReturnValue(new Promise((resolve) => (resolveImage = resolve)));
  mocks.fileExists.mockResolvedValue(true);
  await act(async () => root.render(<EnginesPage />));
  host
    .querySelector<HTMLButtonElement>('button[aria-label="Engines.Settings.SelectImage"]')
    ?.click();
  await vi.waitFor(() => expect(mocks.issueEngineImage).toHaveBeenCalledOnce());

  mocks.selected = 1;
  await act(async () => root.render(<EnginesPage />));
  await act(async () => {
    resolveImage({ id: { id: "former-owner-image" }, kind: "engineImage" });
    await vi.waitFor(() =>
      expect(mocks.reconcileEngineAttachments).toHaveBeenCalledWith(
        expect.objectContaining({ abandoned_ids: [{ id: "former-owner-image" }] }),
      ),
    );
  });
  expect(setAtomEngines).not.toHaveBeenCalled();
});
