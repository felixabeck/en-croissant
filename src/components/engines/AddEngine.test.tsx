import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import type { UseFormReturnType } from "@mantine/form";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { defaultEngineProgressId, type LocalEngine } from "@/utils/engines";
import { DownloadCancelLostError } from "@/hooks/downloadJobs";
import AddEngine from "./AddEngine";

const mocks = vi.hoisted(() => ({
  engines: [] as Array<{
    id: string;
    type: "local";
    name: string;
    downloadLink?: string;
  }>,
  setEngines: vi.fn(),
  saveEngines: vi.fn(),
  submitLocal: undefined as undefined | ((value: unknown) => Promise<unknown>),
  localSaved: undefined as undefined | (() => void),
  form: undefined as UseFormReturnType<LocalEngine> | undefined,
  defaultEngines: [
    {
      type: "local" as const,
      id: "manifest-1",
      name: "Stockfish",
      version: "17",
      path: "stockfish-17/stockfish",
      sha256: "a".repeat(64),
      signature: "sig",
      downloadLink: "https://example.com/engines/stockfish.zip",
    },
  ],
  installDefaultEngine: vi.fn(),
  clearProgress: vi.fn(),
  cancelDownload: vi.fn(),
  withDownloadTicket: vi.fn((run: (ticket: string) => Promise<unknown>) => run("prepared-ticket")),
  notifyUnlessCancelled: vi.fn(),
  progressButtonProps: null as null | {
    id: string;
    initInstalled: boolean;
    completeOnProgressSuccess?: boolean;
    onClick: () => void;
    onCancel?: () => Promise<unknown>;
    clearOnCancel?: boolean;
    inProgress: boolean;
  },
}));

vi.mock("@/state/atoms", () => ({
  enginesAtom: Symbol("enginesAtom"),
}));
vi.mock("jotai", async (importOriginal) => ({
  ...(await importOriginal<typeof import("jotai")>()),
  useAtom: () => [mocks.engines, mocks.saveEngines],
}));
vi.mock("@/utils/engines", async () => {
  const actual = await vi.importActual<typeof import("@/utils/engines")>("@/utils/engines");
  return {
    ...actual,
    useDefaultEngines: () => ({
      defaultEngines: mocks.defaultEngines,
      error: undefined,
      isLoading: false,
    }),
    installDefaultEngine: mocks.installDefaultEngine,
  };
});
vi.mock("@/utils/files", () => ({
  usePlatform: () => ({ os: "linux" }),
}));
vi.mock("@/platform/tauri", () => ({
  tauri: { clearProgress: mocks.clearProgress, cancelDownload: mocks.cancelDownload },
  withDownloadTicket: mocks.withDownloadTicket,
  cancellationError: () => new Error("Cancellation"),
}));
vi.mock("@/components/files/notifyError", () => ({
  notifyUnlessCancelled: mocks.notifyUnlessCancelled,
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) =>
      key.startsWith("Common.Require") || key === "Common.NameAlreadyUsed"
        ? `translated:${key}`
        : key,
  }),
}));
vi.mock("../common/AppModal", () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock("../common/ProgressButton", () => ({
  default: (props: {
    id: string;
    initInstalled: boolean;
    completeOnProgressSuccess?: boolean;
    onClick: () => void;
    onCancel?: () => Promise<unknown>;
    clearOnCancel?: boolean;
    inProgress: boolean;
  }) => {
    mocks.progressButtonProps = props;
    return (
      <button type="button" onClick={props.onClick}>
        progress
      </button>
    );
  },
}));
vi.mock("./EngineForm", () => ({
  default: ({
    onSubmit,
    onSaved,
    form,
  }: {
    onSubmit: (value: unknown) => Promise<unknown>;
    onSaved?: () => void;
    form: UseFormReturnType<LocalEngine>;
  }) => {
    mocks.submitLocal = onSubmit;
    mocks.localSaved = onSaved;
    mocks.form = form;
    return (
      <form onSubmit={form.onSubmit(() => undefined)}>
        <input aria-label="name" {...form.getInputProps("name")} />
        <input aria-label="filename" {...form.getInputProps("filename")} />
        <output data-testid="name-error">{form.errors.name}</output>
        <output data-testid="filename-error">{form.errors.filename}</output>
        <button type="submit">submit</button>
      </form>
    );
  },
}));
vi.mock("@mantine/core", () => ({
  Alert: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Box: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Button: ({ children }: { children: React.ReactNode }) => (
    <button type="button">{children}</button>
  ),
  Center: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Group: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Image: () => null,
  Loader: () => null,
  Paper: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  ScrollArea: { Autosize: ({ children }: { children: React.ReactNode }) => <div>{children}</div> },
  SimpleGrid: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Tabs: Object.assign(({ children }: { children: React.ReactNode }) => <div>{children}</div>, {
    List: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    Tab: ({ children }: { children: React.ReactNode }) => <button type="button">{children}</button>,
    Panel: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  }),
  Text: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));
vi.mock("@tabler/icons-react", () => ({
  IconAlertCircle: () => null,
  IconDatabase: () => null,
  IconTrophy: () => null,
}));

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.engines = [];
  mocks.progressButtonProps = null;
  mocks.submitLocal = undefined;
  mocks.localSaved = undefined;
  mocks.form = undefined;
  mocks.clearProgress.mockResolvedValue(1n);
  mocks.cancelDownload.mockResolvedValue(true);
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});

test("wires installed state and progress id from the download URL", async () => {
  mocks.engines = [
    {
      id: "existing",
      type: "local",
      name: "My Fish",
      downloadLink: mocks.defaultEngines[0].downloadLink,
    },
  ];

  await act(async () => {
    root.render(<AddEngine opened setOpened={() => undefined} />);
  });
  expect(mocks.progressButtonProps?.id).toBe(
    defaultEngineProgressId(mocks.defaultEngines[0].downloadLink),
  );
  expect(mocks.progressButtonProps?.id).not.toBe("engine_0");
  expect(mocks.progressButtonProps?.initInstalled).toBe(true);
  expect(mocks.progressButtonProps?.completeOnProgressSuccess).toBe(false);
});

test("renders translated validation errors from actual local form validation", async () => {
  mocks.engines = [{ id: "existing", type: "local", name: "Stockfish" }];
  await act(async () => root.render(<AddEngine opened setOpened={() => undefined} />));

  const form = host.querySelector("form")!;
  await act(async () => {
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
  expect(host.querySelector('[data-testid="name-error"]')?.textContent).toBe(
    "translated:Common.RequireName",
  );
  expect(host.querySelector('[data-testid="filename-error"]')?.textContent).toBe(
    "translated:Common.RequirePath",
  );

  await act(async () => {
    mocks.form?.setValues({ name: "Stockfish", filename: "stockfish" });
  });
  await act(async () => {
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
  expect(host.querySelector('[data-testid="name-error"]')?.textContent).toBe(
    "translated:Common.NameAlreadyUsed",
  );
  expect(host.querySelector('[data-testid="filename-error"]')?.textContent).toBe("");
});

test("a succeeded download that fails to register is not treated as installed", async () => {
  mocks.installDefaultEngine.mockRejectedValue(new Error("register failed"));
  mocks.clearProgress.mockRejectedValue(new Error("clear failed"));

  await act(async () => {
    root.render(<AddEngine opened setOpened={() => undefined} />);
  });
  expect(mocks.progressButtonProps?.initInstalled).toBe(false);
  expect(mocks.progressButtonProps?.clearOnCancel).toBe(false);
  await act(async () => {
    mocks.progressButtonProps?.onClick();
    await Promise.resolve();
    await Promise.resolve();
  });
  expect(mocks.notifyUnlessCancelled).toHaveBeenCalledWith("Common.Error", expect.any(Error));
  expect(mocks.clearProgress).toHaveBeenCalledWith(
    defaultEngineProgressId(mocks.defaultEngines[0].downloadLink),
  );
  expect(mocks.progressButtonProps?.initInstalled).toBe(false);
});

test("cancelling while engine setup is pending loses the race without clearing or notifying", async () => {
  let finishInstall!: (engine: unknown) => void;
  const installed = { ...mocks.defaultEngines[0], id: "installed" };
  mocks.installDefaultEngine.mockReturnValue(
    new Promise((resolve) => {
      finishInstall = resolve;
    }),
  );

  await act(async () => root.render(<AddEngine opened setOpened={() => undefined} />));
  await act(async () => mocks.progressButtonProps!.onClick());
  await vi.waitFor(() => expect(mocks.progressButtonProps?.onCancel).toEqual(expect.any(Function)));
  const onCancel = mocks.progressButtonProps!.onCancel!;
  mocks.cancelDownload.mockImplementation(async (ticket: string) => {
    expect(ticket).toBe("prepared-ticket");
    finishInstall(installed);
    return false;
  });

  await expect(onCancel()).rejects.toBeInstanceOf(DownloadCancelLostError);
  expect(mocks.installDefaultEngine).toHaveBeenCalledWith(
    mocks.defaultEngines[0],
    defaultEngineProgressId(mocks.defaultEngines[0].downloadLink),
    "prepared-ticket",
  );
  expect(mocks.saveEngines).toHaveBeenCalledOnce();
  expect(mocks.clearProgress).not.toHaveBeenCalled();
  expect(mocks.notifyUnlessCancelled).not.toHaveBeenCalled();
});

test("reports a failed cancellation request once", async () => {
  let finishInstall!: (engine: unknown) => void;
  mocks.installDefaultEngine.mockReturnValue(
    new Promise((resolve) => {
      finishInstall = resolve;
    }),
  );
  await act(async () => root.render(<AddEngine opened setOpened={() => undefined} />));
  await act(async () => mocks.progressButtonProps!.onClick());
  await vi.waitFor(() => expect(mocks.progressButtonProps?.onCancel).toEqual(expect.any(Function)));
  mocks.cancelDownload.mockRejectedValue(new Error("cancel IPC failed"));

  await expect(mocks.progressButtonProps!.onCancel!()).rejects.toThrow("download cancellation");
  expect(mocks.notifyUnlessCancelled).toHaveBeenCalledOnce();
  finishInstall({ ...mocks.defaultEngines[0], id: "installed" });
  await act(async () => Promise.resolve());
});

test("reports a job failure after cancellation once, without a second cancel notification", async () => {
  const failure = new Error("engine configuration failed");
  let rejectInstall!: (error: unknown) => void;
  mocks.installDefaultEngine.mockReturnValue(
    new Promise((_resolve, reject) => {
      rejectInstall = reject;
    }),
  );
  await act(async () => root.render(<AddEngine opened setOpened={() => undefined} />));
  await act(async () => mocks.progressButtonProps!.onClick());
  await vi.waitFor(() => expect(mocks.progressButtonProps?.onCancel).toEqual(expect.any(Function)));
  mocks.cancelDownload.mockImplementation(async () => {
    rejectInstall(failure);
    return true;
  });

  await expect(mocks.progressButtonProps!.onCancel!()).rejects.toBe(failure);
  expect(mocks.notifyUnlessCancelled).toHaveBeenCalledOnce();
});

test("a remounted engine card keeps the cancel action for a registered job", async () => {
  let finishInstall!: (engine: unknown) => void;
  mocks.installDefaultEngine.mockReturnValue(
    new Promise((resolve) => {
      finishInstall = resolve;
    }),
  );
  await act(async () => root.render(<AddEngine opened setOpened={() => undefined} />));
  await act(async () => mocks.progressButtonProps!.onClick());
  await vi.waitFor(() => expect(mocks.progressButtonProps?.onCancel).toEqual(expect.any(Function)));

  await act(async () => root.unmount());
  root = createRoot(host);
  mocks.progressButtonProps = null;
  await act(async () => root.render(<AddEngine opened setOpened={() => undefined} />));
  await vi.waitFor(() => expect(mocks.progressButtonProps?.onCancel).toEqual(expect.any(Function)));
  const remountedProps = mocks.progressButtonProps!;
  expect(remountedProps.clearOnCancel).toBe(false);

  finishInstall({ ...mocks.defaultEngines[0], id: "installed" });
  await act(async () => Promise.resolve());
});

test("local add closes only for the receipt returned by its exact write", async () => {
  const setOpened = vi.fn();
  mocks.saveEngines
    .mockResolvedValueOnce({ saved: false, synchronized: false })
    .mockResolvedValueOnce({ saved: true, synchronized: true });
  await act(async () => root.render(<AddEngine opened setOpened={setOpened} />));
  const local = {
    type: "local",
    id: "draft",
    name: "Stockfish",
    version: "17",
    handle: { id: { id: "binary" }, kind: "engine" },
    filename: "stockfish",
  };

  await act(async () => {
    await mocks.submitLocal?.(local);
  });
  expect(setOpened).not.toHaveBeenCalled();

  await act(async () => {
    await mocks.submitLocal?.(local);
  });
  expect(setOpened).not.toHaveBeenCalled();
  mocks.localSaved?.();
  expect(setOpened).toHaveBeenCalledWith(false);
});
