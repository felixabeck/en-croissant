import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { TreeStateContext } from "@/components/common/TreeStateContext";
import { createTreeStore, type TreeStore } from "@/state/store/tree";
import { getMainLine } from "@/utils/chess";
import ReportPanel from "./ReportPanel";

const mocks = vi.hoisted(() => ({
  activeTabAtom: Symbol("activeTabAtom"),
  enginesAtom: Symbol("enginesAtom"),
  referenceDbAtom: Symbol("referenceDbAtom"),
  reportModalOpenAtom: Symbol("reportModalOpenAtom"),
  reportSettingsAtom: Symbol("reportSettingsAtom"),
  cancelAnalysis: vi.fn(),
  getProgress: vi.fn(),
  startProgress: vi.fn(),
  analyzeGame: vi.fn(),
  setReportingMode: vi.fn(),
  setReportSettings: vi.fn(),
  reportingMode: false,
  progress: {
    finished: false,
    progress: 0,
    isActive: false,
    item: null as null,
    clear: vi.fn(),
  },
  progressButtonProps: null as null | {
    id: string;
    completeOnProgressSuccess?: boolean;
    onCancel?: () => void;
  },
  reportModalProps: null as null | {
    registerOperation: (id: string) => void;
    isCurrentOperation: (id: string, fingerprint: string) => boolean;
  },
  reportSettings: {
    novelty: false,
    reversed: false,
    variations: true,
    goMode: { t: "Time" as const, c: 500 },
    engine: "engine-id",
  },
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
}));

vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@/hooks/useProgress", () => ({
  useProgress: () => mocks.progress,
}));
vi.mock("@/platform/tauri", () => ({
  tauri: {
    cancelAnalysis: mocks.cancelAnalysis,
    getProgress: mocks.getProgress,
    startProgress: mocks.startProgress,
    analyzeGame: mocks.analyzeGame,
  },
}));
vi.mock("@/state/atoms", () => ({
  activeTabAtom: mocks.activeTabAtom,
  currentReportModalOpenAtom: mocks.reportModalOpenAtom,
  enginesAtom: mocks.enginesAtom,
  referenceDbAtom: mocks.referenceDbAtom,
}));
vi.mock("jotai", async (importOriginal) => ({
  ...(await importOriginal<typeof import("jotai")>()),
  useAtomValue: (atom: symbol) => {
    if (atom === mocks.activeTabAtom) return "tab-1";
    if (atom === mocks.enginesAtom) return mocks.engines;
    if (atom === mocks.referenceDbAtom) return null;
    return undefined;
  },
  useAtom: (atom: symbol) => {
    if (atom === mocks.reportModalOpenAtom) return [mocks.reportingMode, mocks.setReportingMode];
    return [mocks.reportSettings, mocks.setReportSettings];
  },
}));
vi.mock("jotai/utils", () => ({ atomWithStorage: () => mocks.reportSettingsAtom }));
vi.mock("@/components/files/notifyError", () => ({ notifyUnlessCancelled: vi.fn() }));
vi.mock("@/components/common/EvalChart", () => ({ default: () => null }));
vi.mock("@/components/common/ProgressButton", () => ({
  default: (props: { id: string; completeOnProgressSuccess?: boolean; onCancel?: () => void }) => {
    mocks.progressButtonProps = props;
    return (
      <button type="button" onClick={props.onCancel}>
        progress
      </button>
    );
  },
}));
vi.mock("./ReportModal", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./ReportModal")>();
  const Actual = actual.default;
  return {
    default: (props: {
      registerOperation: (id: string) => void;
      isCurrentOperation: (id: string, fingerprint: string) => boolean;
    }) => {
      mocks.reportModalProps = props;
      return <Actual {...(props as any)} />;
    },
  };
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
vi.mock("../../common/AppModal", () => ({
  default: ({ children, opened }: { children: React.ReactNode; opened: boolean }) =>
    opened ? <div>{children}</div> : null,
}));
vi.mock("@mantine/core", () => ({
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props}>{children}</button>
  ),
  Checkbox: () => <input type="checkbox" />,
  Grid: Object.assign(({ children }: { children: React.ReactNode }) => <div>{children}</div>, {
    Col: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  }),
  Group: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  NumberInput: () => <input type="number" />,
  Paper: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  ScrollArea: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Select: () => <select />,
  Stack: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Text: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));
vi.mock("@tabler/icons-react", () => ({ IconZoomCheck: () => null }));

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

type ProgressItem = {
  id: string;
  generation: bigint;
  progress: number;
  finished: boolean;
  state: "running" | "succeeded" | "failed" | "cancelled";
};

function runningItem(id: string): ProgressItem {
  return { id, generation: 1n, progress: 40, finished: false, state: "running" };
}

function finishedItem(id: string): ProgressItem {
  return { id, generation: 2n, progress: 100, finished: true, state: "succeeded" };
}

function fingerprintOf(store: TreeStore) {
  const root = store.getState().root;
  return `${root.fen}\u0000${getMainLine(root).join("\u0000")}`;
}

let host: HTMLDivElement;
let root: Root;
let store: TreeStore;

async function renderPanel() {
  await act(async () => {
    root.render(
      <TreeStateContext.Provider value={store}>
        <ReportPanel />
      </TreeStateContext.Provider>,
    );
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.reportingMode = false;
  mocks.progress.finished = false;
  mocks.progress.progress = 0;
  mocks.progress.isActive = false;
  mocks.progress.item = null;
  mocks.progressButtonProps = null;
  mocks.reportModalProps = null;
  mocks.getProgress.mockResolvedValue(null);
  mocks.analyzeGame.mockResolvedValue([]);
  vi.stubGlobal("crypto", { randomUUID: () => "operation-uuid" });
  store = createTreeStore();
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});

test("ProgressButton subscribes to the registered operation id without treating success as complete", async () => {
  await renderPanel();
  expect(mocks.progressButtonProps?.id).toBe("report_tab-1");
  expect(mocks.progressButtonProps?.completeOnProgressSuccess).toBe(false);

  await act(async () => {
    mocks.reportModalProps!.registerOperation("report_tab-1_uuid");
  });

  expect(mocks.progressButtonProps?.id).toBe("report_tab-1_uuid");
  expect(mocks.progressButtonProps?.completeOnProgressSuccess).toBe(false);
});

test("cancel after remount against the same tree store cancels the registered id", async () => {
  await renderPanel();
  await act(async () => {
    mocks.reportModalProps!.registerOperation("report_tab-1_uuid");
  });

  await act(async () => root.unmount());
  root = createRoot(host);
  await renderPanel();

  expect(mocks.progressButtonProps?.id).toBe("report_tab-1_uuid");
  await act(async () => {
    mocks.progressButtonProps?.onCancel?.();
  });
  expect(mocks.cancelAnalysis).toHaveBeenCalledWith("report_tab-1_uuid");
  expect(store.getState().report.operationId).toBeNull();
  expect(store.getState().report.inProgress).toBe(false);
});

test("isCurrentOperation reads the live store, not a render snapshot", async () => {
  await renderPanel();
  const isCurrent = mocks.reportModalProps!.isCurrentOperation;
  const fingerprint = fingerprintOf(store);

  await act(async () => {
    mocks.reportModalProps!.registerOperation("report_tab-1_uuid");
  });

  expect(isCurrent("report_tab-1_uuid", fingerprint)).toBe(true);
  expect(isCurrent("report_other", fingerprint)).toBe(false);
});

test("a finished progress item clears inProgress while leaving the operation id", async () => {
  await renderPanel();
  await act(async () => {
    mocks.reportModalProps!.registerOperation("op-1");
    store.getState().setReportInProgress(true);
  });

  mocks.progress.finished = true;
  await renderPanel();

  expect(store.getState().report.inProgress).toBe(false);
  expect(store.getState().report.operationId).toBe("op-1");
});

test("inProgress with no operationId is treated as not running", async () => {
  store.getState().setReportInProgress(true);
  await renderPanel();
  await act(async () => {
    await Promise.resolve();
  });

  expect(store.getState().report.inProgress).toBe(false);
  expect(store.getState().report.operationId).toBeNull();
  expect(mocks.getProgress).not.toHaveBeenCalled();
});

test("a finished progress lookup clears inProgress and the operation id", async () => {
  mocks.getProgress.mockResolvedValue(finishedItem("op-1"));
  store.getState().setReportOperationId("op-1");
  store.getState().setReportInProgress(true);

  await renderPanel();
  await act(async () => {
    await Promise.resolve();
  });

  expect(store.getState().report.inProgress).toBe(false);
  expect(store.getState().report.operationId).toBeNull();
});

test("an absent progress lookup leaves a running report intact", async () => {
  mocks.getProgress.mockResolvedValue(null);
  store.getState().setReportOperationId("op-1");
  store.getState().setReportInProgress(true);

  await renderPanel();
  await act(async () => {
    await Promise.resolve();
  });

  expect(store.getState().report.inProgress).toBe(true);
  expect(store.getState().report.operationId).toBe("op-1");
});

test("a running progress lookup leaves a running report intact", async () => {
  mocks.getProgress.mockResolvedValue(runningItem("op-1"));
  store.getState().setReportOperationId("op-1");
  store.getState().setReportInProgress(true);

  await renderPanel();
  await act(async () => {
    await Promise.resolve();
  });

  expect(store.getState().report.inProgress).toBe(true);
  expect(store.getState().report.operationId).toBe("op-1");
});

test("a rejected progress lookup leaves a running report intact", async () => {
  mocks.getProgress.mockRejectedValue(new Error("lookup failed"));
  store.getState().setReportOperationId("op-1");
  store.getState().setReportInProgress(true);

  await renderPanel();
  await act(async () => {
    await Promise.resolve();
  });

  expect(store.getState().report.inProgress).toBe(true);
  expect(store.getState().report.operationId).toBe("op-1");
});

test("a lookup for operation A that resolves after B is current does not clear B", async () => {
  let resolveA: (value: ProgressItem) => void = () => undefined;
  mocks.getProgress.mockImplementation((id: string) => {
    if (id === "op-A") {
      return new Promise<ProgressItem>((resolve) => {
        resolveA = resolve;
      });
    }
    return Promise.resolve(runningItem(id));
  });
  store.getState().setReportOperationId("op-A");
  store.getState().setReportInProgress(true);

  await renderPanel();
  await act(async () => {
    store.getState().setReportOperationId("op-B");
  });
  await act(async () => {
    resolveA(finishedItem("op-A"));
    await Promise.resolve();
  });

  expect(store.getState().report.operationId).toBe("op-B");
  expect(store.getState().report.inProgress).toBe(true);
});

test("ReportModal does not take a progress lease when starting analysis", async () => {
  mocks.reportingMode = true;
  await renderPanel();
  await act(async () => {
    host.querySelector<HTMLButtonElement>("button[type='submit']")!.click();
    await Promise.resolve();
    await Promise.resolve();
  });

  expect(mocks.analyzeGame).toHaveBeenCalled();
  expect(mocks.startProgress).not.toHaveBeenCalled();
  expect(store.getState().report.operationId).toBe("report_tab-1_operation-uuid");
});
