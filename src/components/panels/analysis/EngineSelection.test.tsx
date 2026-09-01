import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  activeTabAtom: Symbol("activeTabAtom"),
  enginesAtom: Symbol("enginesAtom"),
  notifyUnlessCancelled: vi.fn(),
  setEngines: vi.fn(),
  stopEngine: vi.fn(),
}));

vi.mock("react-i18next", () => ({
  Trans: ({ i18nKey }: { i18nKey: string }) => i18nKey,
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@tanstack/react-router", () => ({ Link: () => <a /> }));
vi.mock("@/components/files/notifyError", () => ({
  notifyUnlessCancelled: mocks.notifyUnlessCancelled,
}));
vi.mock("@/utils/engines", () => ({ stopEngine: mocks.stopEngine }));
vi.mock("@/state/atoms", () => ({
  activeTabAtom: mocks.activeTabAtom,
  enginesAtom: mocks.enginesAtom,
}));
vi.mock("jotai", async (importOriginal) => {
  return {
    ...(await importOriginal<typeof import("jotai")>()),
    useAtomValue: (atom: symbol) => (atom === mocks.activeTabAtom ? "tab-1" : undefined),
    useAtom: () => [
      [
        {
          type: "local",
          id: "engine-1",
          name: "Stockfish",
          loaded: true,
          handle: { id: { id: "handle-1" }, kind: "engine" },
          filename: "stockfish",
          version: "17",
        },
      ],
      mocks.setEngines,
    ],
  };
});
vi.mock("@mantine/core", () => ({
  Center: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Checkbox: ({ checked }: { checked: boolean }) => (
    <input type="checkbox" checked={checked} readOnly />
  ),
  Group: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Paper: ({ children, onClick }: { children: React.ReactNode; onClick: () => void }) => (
    <button type="button" onClick={onClick}>
      {children}
    </button>
  ),
  ScrollArea: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Stack: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Text: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));
vi.mock("@tabler/icons-react", () => ({ IconCloud: () => null, IconCpu: () => null }));
vi.mock("@/components/common/LocalImage", () => ({ default: () => null }));

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  vi.clearAllMocks();
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});

test("a rejected stop leaves the engine loaded and notifies", async () => {
  const failure = new Error("stop failed");
  mocks.stopEngine.mockRejectedValue(failure);
  const EngineSelection = (await import("./EngineSelection")).default;

  await act(async () => root.render(<EngineSelection />));
  await act(async () => {
    host.querySelector("button")!.click();
    await Promise.resolve();
  });

  expect(mocks.stopEngine).toHaveBeenCalledWith(
    expect.objectContaining({ id: "engine-1" }),
    "tab-1",
  );
  expect(mocks.setEngines).not.toHaveBeenCalled();
  expect(mocks.notifyUnlessCancelled).toHaveBeenCalledWith("Common.Error", failure);
});

test("a successful stop flips loaded state", async () => {
  mocks.stopEngine.mockResolvedValue(undefined);
  const EngineSelection = (await import("./EngineSelection")).default;

  await act(async () => root.render(<EngineSelection />));
  await act(async () => {
    host.querySelector("button")!.click();
    await Promise.resolve();
  });

  expect(mocks.setEngines).toHaveBeenCalled();
});
