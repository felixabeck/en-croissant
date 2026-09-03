import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  activeTabAtom: Symbol("activeTabAtom"),
  enginesAtom: Symbol("enginesAtom"),
  getEngineLogs: vi.fn(),
  notifyUnlessCancelled: vi.fn(),
  renderLogs: vi.fn(),
}));

import LogsPanel from "./LogsPanel";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@/components/files/notifyError", () => ({
  notifyUnlessCancelled: mocks.notifyUnlessCancelled,
}));
vi.mock("@/platform/tauri", () => ({
  tauri: { getEngineLogs: mocks.getEngineLogs },
}));
vi.mock("@/state/atoms", () => ({
  activeTabAtom: mocks.activeTabAtom,
  enginesAtom: mocks.enginesAtom,
}));
vi.mock("jotai", async (importOriginal) => ({
  ...(await importOriginal<typeof import("jotai")>()),
  useAtomValue: (atom: symbol) =>
    atom === mocks.activeTabAtom
      ? "tab-1"
      : [
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
}));
vi.mock("@mantine/core", () => ({
  Select: () => null,
  Stack: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock("../../common/EngineLogsView", () => ({
  default: ({ logs }: { logs: unknown[] }) => {
    mocks.renderLogs(logs);
    return <div data-testid="engine-logs" />;
  },
}));

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

test("a rejected log fetch notifies once and is not rendered as empty success", async () => {
  const failure = new Error("engine disconnected");
  mocks.getEngineLogs.mockRejectedValue(failure);

  await act(async () => {
    root.render(<LogsPanel />);
    await Promise.resolve();
  });
  await vi.waitFor(() => {
    expect(mocks.notifyUnlessCancelled).toHaveBeenCalledTimes(1);
  });

  expect(mocks.notifyUnlessCancelled).toHaveBeenCalledWith("Common.Error", failure);
  expect(mocks.getEngineLogs).toHaveBeenCalledTimes(1);
  expect(mocks.renderLogs).not.toHaveBeenCalled();
});
