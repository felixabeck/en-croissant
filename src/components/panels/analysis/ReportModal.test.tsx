import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import ReportModal from "./ReportModal";

const mocks = vi.hoisted(() => ({
  addAnalysis: vi.fn(),
  analyzeGame: vi.fn(),
  enginesAtom: Symbol("enginesAtom"),
  referenceDbAtom: Symbol("referenceDbAtom"),
  notifyUnlessCancelled: vi.fn(),
  setReportSettings: vi.fn(),
  store: {},
  reportSettings: {
    novelty: false,
    reversed: false,
    variations: true,
    goMode: { t: "Time", c: 500 },
    engine: "engine-id",
  },
}));

vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@/platform/tauri", () => ({ tauri: { analyzeGame: mocks.analyzeGame } }));
vi.mock("@/components/files/notifyError", () => ({
  notifyUnlessCancelled: mocks.notifyUnlessCancelled,
}));
vi.mock("@/state/atoms", () => ({
  enginesAtom: mocks.enginesAtom,
  referenceDbAtom: mocks.referenceDbAtom,
}));
vi.mock("jotai", () => ({
  useAtomValue: (atom: symbol) =>
    atom === mocks.enginesAtom
      ? [
          {
            type: "local",
            id: "engine-id",
            name: "Stockfish",
            version: "17",
            filename: "stockfish",
            handle: { id: { id: "engine-handle" }, kind: "engine" },
            settings: [],
          },
        ]
      : null,
  useAtom: () => [mocks.reportSettings, mocks.setReportSettings],
}));
vi.mock("jotai/utils", () => ({ atomWithStorage: () => Symbol("reportSettingsAtom") }));
vi.mock("zustand", () => ({
  useStore: (
    _store: unknown,
    selector: (state: { addAnalysis: typeof mocks.addAnalysis }) => unknown,
  ) => selector({ addAnalysis: mocks.addAnalysis }),
}));
vi.mock("@/components/common/TreeStateContext", async () => {
  const React = await vi.importActual<typeof import("react")>("react");
  return { TreeStateContext: React.createContext(mocks.store) };
});
vi.mock("@mantine/form", () => ({
  useForm: () => ({
    values: mocks.reportSettings,
    setValues: vi.fn(),
    setFieldValue: vi.fn(),
    getInputProps: () => ({}),
    onSubmit: (submit: () => void) => (event: React.FormEvent) => {
      event.preventDefault();
      submit();
    },
  }),
}));
vi.mock("@mantine/core", () => ({
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props}>{children}</button>
  ),
  Checkbox: () => <input type="checkbox" />,
  Group: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  NumberInput: () => <input type="number" />,
  Select: () => <select />,
  Stack: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock("../../common/AppModal", () => ({
  default: ({ children, opened }: { children: React.ReactNode; opened: boolean }) =>
    opened ? <div>{children}</div> : null,
}));

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("crypto", { randomUUID: () => "operation-uuid" });
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});

test("passes the immutable engine id and catches analysis rejection", async () => {
  const failure = new Error("analysis failed");
  mocks.analyzeGame.mockRejectedValue(failure);

  await act(async () => {
    root.render(
      <ReportModal
        tab="tab-id"
        initialFen="start-fen"
        moves={["e2e4"]}
        reportingMode
        closeReportingMode={vi.fn()}
        setInProgress={vi.fn()}
        registerOperation={vi.fn()}
        isCurrentOperation={() => true}
      />,
    );
  });
  await act(async () => {
    host.querySelector("button")!.click();
    await Promise.resolve();
    await Promise.resolve();
  });

  expect(mocks.analyzeGame).toHaveBeenCalledWith(
    "report_tab-id_operation-uuid",
    { id: { id: "engine-handle" }, kind: "engine" },
    "engine-id",
    { t: "Time", c: 500 },
    expect.objectContaining({ fen: "start-fen", moves: ["e2e4"] }),
    [],
  );
  expect(mocks.notifyUnlessCancelled).toHaveBeenCalledWith("Common.Error", failure);
});
