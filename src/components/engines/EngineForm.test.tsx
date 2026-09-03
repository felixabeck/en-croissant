import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import type { LocalEngine } from "@/utils/engines";
import EngineForm from "./EngineForm";

const mocks = vi.hoisted(() => ({
  issueEngineBinary: vi.fn(),
  getEngineConfig: vi.fn(),
  issueEngineImage: vi.fn(),
  notify: vi.fn(),
}));

vi.mock("@/platform/tauri", () => ({
  tauri: {
    issueEngineBinary: mocks.issueEngineBinary,
    getEngineConfig: mocks.getEngineConfig,
    issueEngineImage: mocks.issueEngineImage,
  },
}));
vi.mock("@mantine/notifications", () => ({
  notifications: { show: mocks.notify },
}));
vi.mock("@/i18n", () => ({
  default: { t: (key: string) => key },
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@mantine/core", () => ({
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props}>{children}</button>
  ),
  Input: Object.assign(
    ({ children, onClick }: { children?: React.ReactNode; onClick?: () => void }) => (
      <button type="button" onClick={onClick}>
        {children}
      </button>
    ),
    { Wrapper: ({ children }: { children: React.ReactNode }) => <div>{children}</div> },
  ),
  NumberInput: () => <input type="number" />,
  Text: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
  TextInput: () => <input />,
}));
vi.mock("../common/FileInput", () => ({
  default: ({ onClick, label }: { onClick: () => void; label?: string }) => (
    <button type="button" onClick={onClick}>
      {label}
    </button>
  ),
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

test("keeps the adopted binary handle after a successful picker", async () => {
  const handle = { id: { id: "engine-capability" }, kind: "engine" as const };
  mocks.issueEngineBinary.mockResolvedValue(handle);
  mocks.getEngineConfig.mockResolvedValue({ name: "Stockfish", options: [] });
  const form = {
    values: { filename: "", imageHandle: undefined },
    getInputProps: () => ({}),
    setFieldValue: vi.fn(),
    onSubmit:
      (submit: (values: LocalEngine) => void) => (event?: { preventDefault?: () => void }) => {
        event?.preventDefault?.();
        submit({} as LocalEngine);
      },
  };

  await act(async () => {
    root.render(<EngineForm submitLabel="Add" form={form as never} onSubmit={() => undefined} />);
  });
  await act(async () => {
    host.querySelector("button")?.click();
    await Promise.resolve();
    await Promise.resolve();
  });

  expect(mocks.issueEngineBinary).toHaveBeenCalledOnce();
  expect(form.setFieldValue).toHaveBeenCalledWith("handle", handle);
  expect(form.setFieldValue).toHaveBeenCalledWith("filename", "Stockfish");
  expect(form.setFieldValue).toHaveBeenCalledWith("name", "Stockfish");
});

test("does not attach a handle when the native picker is cancelled", async () => {
  mocks.issueEngineBinary.mockRejectedValue(new Error("Cancellation"));
  const form = {
    values: { filename: "", imageHandle: undefined },
    getInputProps: () => ({}),
    setFieldValue: vi.fn(),
    onSubmit: () => () => undefined,
  };

  await act(async () => {
    root.render(<EngineForm submitLabel="Add" form={form as never} onSubmit={() => undefined} />);
  });
  await act(async () => {
    host.querySelector("button")?.click();
    await Promise.resolve();
    await Promise.resolve();
  });

  expect(form.setFieldValue).not.toHaveBeenCalled();
  expect(mocks.notify).not.toHaveBeenCalled();
});

test("notifies a real binary picker failure without attaching a handle", async () => {
  mocks.issueEngineBinary.mockRejectedValue(new Error("permission denied"));
  const form = {
    values: { filename: "", imageHandle: undefined },
    getInputProps: () => ({}),
    setFieldValue: vi.fn(),
    onSubmit: () => () => undefined,
  };

  await act(async () => {
    root.render(<EngineForm submitLabel="Add" form={form as never} onSubmit={() => undefined} />);
  });
  await act(async () => {
    host.querySelector("button")?.click();
    await Promise.resolve();
    await Promise.resolve();
  });

  expect(form.setFieldValue).not.toHaveBeenCalled();
  expect(mocks.notify).toHaveBeenCalledWith(
    expect.objectContaining({ message: "permission denied" }),
  );
});

test("keeps the adopted binary handle when configuration fails", async () => {
  const handle = { id: { id: "engine-capability" }, kind: "engine" as const };
  mocks.issueEngineBinary.mockResolvedValue(handle);
  mocks.getEngineConfig.mockRejectedValue(new Error("uciok timeout"));
  const form = {
    values: { filename: "", imageHandle: undefined },
    getInputProps: () => ({}),
    setFieldValue: vi.fn(),
    onSubmit: () => () => undefined,
  };

  await act(async () => {
    root.render(<EngineForm submitLabel="Add" form={form as never} onSubmit={() => undefined} />);
  });
  await act(async () => {
    host.querySelector("button")?.click();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });

  expect(form.setFieldValue).toHaveBeenCalledWith("handle", handle);
  expect(form.setFieldValue).not.toHaveBeenCalledWith("filename", expect.anything());
  expect(mocks.notify).toHaveBeenCalledWith(expect.objectContaining({ message: "uciok timeout" }));
});

test("does not attach an image handle when the image picker is cancelled", async () => {
  mocks.issueEngineImage.mockRejectedValue(new Error("Cancellation"));
  const form = {
    values: { filename: "", imageHandle: undefined },
    getInputProps: () => ({}),
    setFieldValue: vi.fn(),
    onSubmit: () => () => undefined,
  };

  await act(async () => {
    root.render(<EngineForm submitLabel="Add" form={form as never} onSubmit={() => undefined} />);
  });
  await act(async () => {
    host.querySelectorAll("button")[1]?.click();
    await Promise.resolve();
    await Promise.resolve();
  });

  expect(mocks.issueEngineImage).toHaveBeenCalledOnce();
  expect(form.setFieldValue).not.toHaveBeenCalled();
  expect(mocks.notify).not.toHaveBeenCalled();
});

test("notifies a real image picker failure without attaching a handle", async () => {
  mocks.issueEngineImage.mockRejectedValue(new Error("permission denied"));
  const form = {
    values: { filename: "", imageHandle: undefined },
    getInputProps: () => ({}),
    setFieldValue: vi.fn(),
    onSubmit: () => () => undefined,
  };

  await act(async () => {
    root.render(<EngineForm submitLabel="Add" form={form as never} onSubmit={() => undefined} />);
  });
  await act(async () => {
    host.querySelectorAll("button")[1]?.click();
    await Promise.resolve();
    await Promise.resolve();
  });

  expect(form.setFieldValue).not.toHaveBeenCalled();
  expect(mocks.notify).toHaveBeenCalledWith(
    expect.objectContaining({ message: "permission denied" }),
  );
});
