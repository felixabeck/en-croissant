import { act, StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import type { LocalEngine } from "@/utils/engines";
import EngineForm from "./EngineForm";

const mocks = vi.hoisted(() => ({
  issueEngineBinary: vi.fn(),
  getEngineConfig: vi.fn(),
  issueEngineImage: vi.fn(),
  notify: vi.fn(),
  reconcileEngineAttachments: vi.fn(),
}));

vi.mock("@/platform/tauri", () => ({
  tauri: {
    issueEngineBinary: mocks.issueEngineBinary,
    getEngineConfig: mocks.getEngineConfig,
    issueEngineImage: mocks.issueEngineImage,
    reconcileEngineAttachments: mocks.reconcileEngineAttachments,
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
  default: ({
    onClick,
    label,
    error,
  }: {
    onClick: () => void;
    label?: string;
    error?: React.ReactNode;
  }) => (
    <>
      <button type="button" onClick={onClick}>
        {label}
      </button>
      {error && <span role="alert">{error}</span>}
    </>
  ),
}));

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.reconcileEngineAttachments.mockResolvedValue(undefined);
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
  expect(form.setFieldValue).toHaveBeenCalledWith("settings", []);
});

test("ordinary submission preserves existing scalar and resource settings", async () => {
  const settings = [
    { type: "string" as const, name: "Hash", value: "256" },
    {
      type: "resource" as const,
      name: "SyzygyPath",
      resources: [{ id: { id: "tables" }, kind: "directory" as const, displayName: "tables" }],
    },
  ];
  const values = {
    type: "local" as const,
    id: "engine",
    name: "Renamed",
    version: "17",
    handle: { id: { id: "binary" }, kind: "engine" as const },
    filename: "engine",
    settings,
  };
  const submit = vi.fn().mockResolvedValue({
    operationId: "save",
    key: "engines",
    saved: true,
    synchronized: true,
  });
  const form = {
    values,
    getInputProps: () => ({}),
    setFieldValue: vi.fn(),
    onSubmit: (action: (input: LocalEngine) => Promise<void>) => () => action(values),
  };

  await act(async () =>
    root.render(<EngineForm submitLabel="Save" form={form as never} onSubmit={submit} />),
  );
  await act(async () => {
    host
      .querySelector("form")
      ?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await Promise.resolve();
  });
  expect(submit).toHaveBeenCalledWith(expect.objectContaining({ settings }));
});

test("passes the filename validation error to the binary picker", async () => {
  const form = {
    values: { filename: "", imageHandle: undefined },
    errors: { filename: "Common.RequirePath" },
    getInputProps: () => ({}),
    setFieldValue: vi.fn(),
    onSubmit: () => () => undefined,
  };

  await act(async () =>
    root.render(<EngineForm submitLabel="Add" form={form as never} onSubmit={() => undefined} />),
  );

  expect(host.querySelector('[role="alert"]')?.textContent).toBe("Common.RequirePath");
});

test("only the current binary detection applies fields and required defaults", async () => {
  const firstHandle = { id: { id: "first" }, kind: "engine" as const };
  const secondHandle = { id: { id: "second" }, kind: "engine" as const };
  let resolveFirst!: (value: { name: string; options: never[] }) => void;
  let resolveSecond!: (value: { name: string; options: never[] }) => void;
  mocks.issueEngineBinary.mockResolvedValueOnce(firstHandle).mockResolvedValueOnce(secondHandle);
  mocks.getEngineConfig
    .mockReturnValueOnce(new Promise((resolve) => (resolveFirst = resolve)))
    .mockReturnValueOnce(new Promise((resolve) => (resolveSecond = resolve)));
  const form = {
    values: { filename: "", imageHandle: undefined },
    getInputProps: () => ({}),
    setFieldValue: vi.fn(),
    onSubmit: () => () => undefined,
  };
  await act(async () =>
    root.render(<EngineForm submitLabel="Add" form={form as never} onSubmit={() => undefined} />),
  );

  host.querySelectorAll("button")[0]?.click();
  await vi.waitFor(() => expect(mocks.getEngineConfig).toHaveBeenCalledTimes(1));
  host.querySelectorAll("button")[0]?.click();
  await vi.waitFor(() => expect(mocks.getEngineConfig).toHaveBeenCalledTimes(2));
  await act(async () => {
    resolveSecond({ name: "Current", options: [] });
    await Promise.resolve();
    resolveFirst({ name: "Stale", options: [] });
    await Promise.resolve();
  });

  expect(form.setFieldValue).toHaveBeenCalledWith("name", "Current");
  expect(form.setFieldValue).not.toHaveBeenCalledWith("name", "Stale");
  expect(form.setFieldValue).toHaveBeenCalledWith("settings", []);
});

test("adopts a successful image before the saved callback closes the form", async () => {
  const image = { id: { id: "adopt-before-close" }, kind: "engineImage" as const };
  mocks.issueEngineImage.mockResolvedValue(image);
  const values = {
    type: "local" as const,
    id: "engine",
    name: "Engine",
    version: "1",
    handle: { id: { id: "binary" }, kind: "engine" as const },
    filename: "engine",
    imageHandle: image,
  };
  const form = {
    values,
    getInputProps: () => ({}),
    setFieldValue: vi.fn(),
    onSubmit: (action: (input: LocalEngine) => Promise<void>) => () => action(values),
  };
  const onSaved = vi.fn(() => root.unmount());
  await act(async () =>
    root.render(
      <EngineForm
        submitLabel="Add"
        form={form as never}
        onSubmit={async () => ({
          operationId: "save",
          key: "engines",
          saved: true,
          synchronized: true,
        })}
        onSaved={onSaved}
      />,
    ),
  );
  await act(async () => {
    host.querySelectorAll("button")[1]?.click();
    await vi.waitFor(() => expect(form.setFieldValue).toHaveBeenCalledWith("imageHandle", image));
    host
      .querySelector("form")
      ?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await vi.waitFor(() => expect(onSaved).toHaveBeenCalledOnce());
  });
  expect(mocks.reconcileEngineAttachments).not.toHaveBeenCalled();
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

test("abandons an image that resolves after the form unmounts", async () => {
  let resolveImage!: (value: { id: { id: string }; kind: "engineImage" }) => void;
  mocks.issueEngineImage.mockReturnValue(new Promise((resolve) => (resolveImage = resolve)));
  const form = {
    values: { filename: "", imageHandle: undefined },
    getInputProps: () => ({}),
    setFieldValue: vi.fn(),
    onSubmit: () => () => undefined,
  };

  await act(async () => {
    root.render(<EngineForm submitLabel="Add" form={form as never} onSubmit={() => undefined} />);
  });
  host.querySelectorAll("button")[1]?.click();
  await act(async () => root.unmount());
  await act(async () => {
    resolveImage({ id: { id: "late-image" }, kind: "engineImage" });
    await vi.waitFor(() => expect(mocks.reconcileEngineAttachments).toHaveBeenCalledOnce());
  });

  expect(form.setFieldValue).not.toHaveBeenCalled();
  expect(mocks.reconcileEngineAttachments).toHaveBeenCalledWith(
    expect.objectContaining({ abandoned_ids: [{ id: "late-image" }] }),
  );
});

test("StrictMode cleanup is followed by a live draft for image selection", async () => {
  const image = { id: { id: "strict-image" }, kind: "engineImage" as const };
  mocks.issueEngineImage.mockResolvedValue(image);
  const form = {
    values: { filename: "", imageHandle: undefined },
    getInputProps: () => ({}),
    setFieldValue: vi.fn(),
    onSubmit: () => () => undefined,
  };

  await act(async () => {
    root.render(
      <StrictMode>
        <EngineForm submitLabel="Add" form={form as never} onSubmit={() => undefined} />
      </StrictMode>,
    );
  });
  await act(async () => {
    host.querySelectorAll("button")[1]?.click();
    await vi.waitFor(() => expect(form.setFieldValue).toHaveBeenCalledWith("imageHandle", image));
  });
});

test("reports a rejected attachment cleanup during unmount", async () => {
  const image = { id: { id: "cleanup-image" }, kind: "engineImage" as const };
  mocks.issueEngineImage.mockResolvedValue(image);
  mocks.reconcileEngineAttachments.mockRejectedValueOnce(new Error("cleanup failed"));
  const form = {
    values: { filename: "", imageHandle: undefined },
    getInputProps: () => ({}),
    setFieldValue: vi.fn(),
    onSubmit: () => () => undefined,
  };

  await act(async () => {
    root.render(<EngineForm submitLabel="Add" form={form as never} onSubmit={() => undefined} />);
    await Promise.resolve();
  });
  await act(async () => {
    host.querySelectorAll("button")[1]?.click();
    await vi.waitFor(() => expect(form.setFieldValue).toHaveBeenCalledWith("imageHandle", image));
  });
  await act(async () => root.unmount());
  await vi.waitFor(() =>
    expect(mocks.notify).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Common.Error", message: "cleanup failed" }),
    ),
  );
});
