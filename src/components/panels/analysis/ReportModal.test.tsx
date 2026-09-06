import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import ReportModal from "./ReportModal";

const mocks = vi.hoisted(() => ({
  addAnalysis: vi.fn(),
  analyzeGame: vi.fn(),
  startProgress: vi.fn(),
  enginesAtom: Symbol("enginesAtom"),
  referenceDbAtom: Symbol("referenceDbAtom"),
  engines: [
    {
      type: "local" as const,
      id: "engine-id",
      name: "Stockfish",
      version: "17",
      filename: "stockfish",
      handle: { id: { id: "engine-handle" }, kind: "engine" as const },
      settings: [],
    },
  ],
  notifyUnlessCancelled: vi.fn(),
  reportPersistError: vi.fn(),
  store: {},
}));

vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@/platform/tauri", () => ({
  tauri: { analyzeGame: mocks.analyzeGame, startProgress: mocks.startProgress },
}));
vi.mock("@/components/files/notifyError", () => ({
  notifyUnlessCancelled: mocks.notifyUnlessCancelled,
}));
vi.mock("@/i18n", () => ({
  default: {
    t: (key: string, options?: { cause?: string }) =>
      options?.cause === undefined ? key : `${key}: ${options.cause}`,
  },
}));
vi.mock("@/state/persistError", () => ({ reportPersistError: mocks.reportPersistError }));
vi.mock("@/state/atoms", () => ({
  enginesAtom: mocks.enginesAtom,
  referenceDbAtom: mocks.referenceDbAtom,
}));
vi.mock("jotai", () => ({
  useAtom: (atom: {
    key: string;
    initialValue: unknown;
    storage: {
      getItem: (key: string, initialValue: unknown) => unknown;
      setItem: (key: string, value: unknown) => void;
    };
  }) => [
    atom.storage.getItem(atom.key, atom.initialValue),
    (nextValue: unknown) => atom.storage.setItem(atom.key, nextValue),
  ],
  useAtomValue: (atom: symbol) => (atom === mocks.enginesAtom ? mocks.engines : null),
}));
vi.mock("jotai/utils", () => ({
  atomWithStorage: (key: string, initialValue: unknown, storage: unknown) => ({
    key,
    initialValue,
    storage,
  }),
}));
vi.mock("@mantine/form", () => ({
  useForm: ({ initialValues }: { initialValues: Record<string, unknown> }) => ({
    values: initialValues,
    setValues: vi.fn(),
    setFieldValue: vi.fn(),
    getInputProps: () => ({}),
    onSubmit: (submit: () => void) => (event: React.FormEvent) => {
      event.preventDefault();
      submit();
    },
  }),
}));
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
  localStorage.removeItem("report-settings");
  localStorage.setItem(
    "report-settings",
    JSON.stringify({
      novelty: true,
      reversed: true,
      variations: true,
      goMode: { t: "Time", c: 500 },
      engine: "engine-id",
    }),
  );
  vi.stubGlobal("crypto", { randomUUID: () => "operation-uuid" });
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  localStorage.removeItem("report-settings");
  vi.unstubAllGlobals();
});

async function renderReportModal() {
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
    await Promise.resolve();
    await Promise.resolve();
  });
}

test("passes the immutable engine id and catches analysis rejection", async () => {
  const failure = new Error("analysis failed");
  mocks.analyzeGame.mockRejectedValue(failure);

  await renderReportModal();
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
  expect(mocks.startProgress).not.toHaveBeenCalled();
});

test("hydrates missing goMode with the default while preserving the selected engine", async () => {
  localStorage.setItem(
    "report-settings",
    JSON.stringify({ novelty: false, reversed: false, variations: true, engine: "engine-id" }),
  );
  mocks.analyzeGame.mockResolvedValue([]);

  await renderReportModal();
  await act(async () => {
    host.querySelector("button")!.click();
    await Promise.resolve();
    await Promise.resolve();
  });

  expect(mocks.analyzeGame).toHaveBeenCalledWith(
    "report_tab-id_operation-uuid",
    expect.anything(),
    "engine-id",
    { t: "Time", c: 500 },
    expect.anything(),
    [],
  );
  expect(JSON.parse(localStorage.getItem("report-settings")!)).toEqual({
    novelty: false,
    reversed: false,
    variations: true,
    goMode: { t: "Time", c: 500 },
    engine: "engine-id",
  });
});

test("defaults an invalid goMode during hydration instead of crashing render", async () => {
  localStorage.setItem(
    "report-settings",
    JSON.stringify({
      novelty: false,
      reversed: true,
      variations: false,
      goMode: { t: "Unsupported", c: 500 },
      engine: "engine-id",
    }),
  );
  mocks.analyzeGame.mockResolvedValue([]);

  await renderReportModal();
  expect(host.textContent).not.toContain("Cannot read properties");
  await act(async () => {
    host.querySelector("button")!.click();
    await Promise.resolve();
    await Promise.resolve();
  });

  expect(mocks.analyzeGame).toHaveBeenCalledWith(
    expect.any(String),
    expect.anything(),
    "engine-id",
    { t: "Time", c: 500 },
    expect.anything(),
    [],
  );
});

test("reports a quota-failed settings save while still starting the report", async () => {
  const quota = new DOMException("Storage quota exceeded", "QuotaExceededError");
  const originalSetItem = Storage.prototype.setItem;
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, key, value) {
    if (key === "report-settings") throw quota;
    return Reflect.apply(originalSetItem, this, [key, value]);
  });
  mocks.analyzeGame.mockResolvedValue([]);

  await renderReportModal();
  await act(async () => {
    host.querySelector("button")!.click();
    await Promise.resolve();
    await Promise.resolve();
  });

  expect(mocks.analyzeGame).toHaveBeenCalledOnce();
  expect(mocks.reportPersistError).toHaveBeenCalledWith(
    expect.objectContaining({
      message: "Common.PreferenceSaveFailed: Common.StorageQuotaExceeded",
      cause: quota,
    }),
  );
});
