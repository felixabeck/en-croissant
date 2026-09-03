import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { defaultEngineProgressId } from "@/utils/engines";
import AddEngine from "./AddEngine";

const mocks = vi.hoisted(() => ({
  engines: [] as Array<{
    type: "local";
    name: string;
    downloadLink?: string;
  }>,
  setEngines: vi.fn(),
  defaultEngines: [
    {
      type: "local" as const,
      id: "manifest-1",
      name: "Stockfish",
      version: "17",
      path: "stockfish-17/stockfish",
      sha256: "a".repeat(64),
      signature: "sig",
      downloadLink: "https://www.encroissant.org/engines/stockfish.zip",
    },
  ],
  installDefaultEngine: vi.fn(),
  clearProgress: vi.fn(),
  notifyUnlessCancelled: vi.fn(),
  progressButtonProps: null as null | {
    id: string;
    initInstalled: boolean;
    completeOnProgressSuccess?: boolean;
    onClick: () => void;
  },
}));

vi.mock("@/state/atoms", () => ({
  enginesAtom: Symbol("enginesAtom"),
}));
vi.mock("jotai", async (importOriginal) => ({
  ...(await importOriginal<typeof import("jotai")>()),
  useAtom: () => [mocks.engines, mocks.setEngines],
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
  tauri: { clearProgress: mocks.clearProgress },
}));
vi.mock("@/components/files/notifyError", () => ({
  notifyUnlessCancelled: mocks.notifyUnlessCancelled,
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
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
  }) => {
    mocks.progressButtonProps = props;
    return (
      <button type="button" onClick={props.onClick}>
        progress
      </button>
    );
  },
}));
vi.mock("./EngineForm", () => ({ default: () => null }));
vi.mock("@mantine/form", () => ({
  useForm: () => ({
    values: {},
    getInputProps: () => ({}),
    setFieldValue: vi.fn(),
    validate: {},
  }),
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
  mocks.clearProgress.mockResolvedValue(1n);
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

test("a succeeded download that fails to register is not treated as installed", async () => {
  mocks.installDefaultEngine.mockRejectedValue(new Error("register failed"));
  mocks.clearProgress.mockRejectedValue(new Error("clear failed"));

  await act(async () => {
    root.render(<AddEngine opened setOpened={() => undefined} />);
  });
  expect(mocks.progressButtonProps?.initInstalled).toBe(false);
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
