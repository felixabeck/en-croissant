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
    ({
      children,
      onClick,
      disabled,
    }: {
      children?: React.ReactNode;
      onClick?: () => void;
      disabled?: boolean;
    }) => (
      <button type="button" onClick={onClick} disabled={disabled}>
        {children}
      </button>
    ),
    { Wrapper: ({ children }: { children: React.ReactNode }) => <div>{children}</div> },
  ),
  NumberInput: ({ disabled }: { disabled?: boolean }) => (
    <input type="number" disabled={disabled} />
  ),
  Text: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
  TextInput: ({ disabled }: { disabled?: boolean }) => <input disabled={disabled} />,
}));
vi.mock("../common/FileInput", () => ({
  default: ({
    onClick,
    label,
    error,
    disabled,
  }: {
    onClick: () => void;
    label?: string;
    error?: React.ReactNode;
    disabled?: boolean;
  }) => (
    <>
      <button type="button" onClick={onClick} disabled={disabled}>
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
    setValues: vi.fn(),
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
  expect(form.setValues).toHaveBeenCalledExactlyOnceWith({
    handle,
    filename: "Stockfish",
    name: "Stockfish",
    settings: [],
  });
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
    setValues: vi.fn(),
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

test("binary detection blocks submission and adopts handle, fields and defaults as one coherent value", async () => {
  const previous = {
    type: "local" as const,
    id: "coherent",
    name: "Binary A",
    filename: "Binary A",
    version: "1",
    handle: { id: { id: "binary-a" }, kind: "engine" as const },
    settings: [{ type: "string" as const, name: "Hash", value: "64" }],
  };
  const handle = { id: { id: "binary-b" }, kind: "engine" as const };
  let complete!: (config: unknown) => void;
  mocks.issueEngineBinary.mockResolvedValue(handle);
  mocks.getEngineConfig.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        complete = resolve;
      }),
  );
  let submit!: (values: LocalEngine) => Promise<void>;
  const form = {
    values: { ...previous },
    getInputProps: () => ({}),
    setFieldValue: vi.fn((field: string, value: unknown) =>
      Object.assign(form.values, { [field]: value }),
    ),
    setValues: vi.fn((value: Partial<LocalEngine>) => Object.assign(form.values, value)),
    onSubmit: (action: typeof submit) => {
      submit = action;
      return () => undefined;
    },
  };
  const save = vi.fn();
  await act(async () =>
    root.render(<EngineForm form={form as never} submitLabel="Add" onSubmit={save} />),
  );
  await act(async () => host.querySelector("button")!.click());
  await vi.waitFor(() => expect(complete).toBeTypeOf("function"));
  expect(form.values).toEqual(previous);
  await act(async () => submit(form.values));
  expect(save).not.toHaveBeenCalled();
  expect(host.querySelector<HTMLButtonElement>('button[type="submit"]')!.disabled).toBe(true);
  expect([...host.querySelectorAll("input")].every((input) => input.disabled)).toBe(true);
  await act(async () =>
    complete({
      name: "Binary B",
      options: [{ type: "spin", value: { name: "Hash", default: 128, min: 1, max: 1024 } }],
    }),
  );
  expect(form.setValues).toHaveBeenCalledExactlyOnceWith({
    handle,
    name: "Binary B",
    filename: "Binary B",
    settings: [{ type: "string", name: "Hash", value: "128" }],
  });
  expect(form.values).toMatchObject({ handle, name: "Binary B", filename: "Binary B" });
  await act(async () => submit(form.values));
  expect(save).toHaveBeenCalledExactlyOnceWith(
    expect.objectContaining({ handle, name: "Binary B" }),
  );
});

test("a failed current detection preserves binary A and releases admission for retry", async () => {
  const previous: LocalEngine = {
    type: "local",
    id: "a",
    name: "A",
    version: "1",
    filename: "A",
    handle: { id: { id: "a" }, kind: "engine" },
    settings: [],
  };
  mocks.issueEngineBinary.mockResolvedValue({ id: { id: "b" }, kind: "engine" });
  mocks.getEngineConfig.mockRejectedValueOnce(new Error("Detection failed"));
  const form = {
    values: { ...previous },
    getInputProps: () => ({}),
    setFieldValue: vi.fn((field: string, value: unknown) =>
      Object.assign(form.values, { [field]: value }),
    ),
    setValues: vi.fn((value: Partial<LocalEngine>) => Object.assign(form.values, value)),
    onSubmit: () => () => undefined,
  };
  await act(async () =>
    root.render(<EngineForm form={form as never} submitLabel="Add" onSubmit={() => undefined} />),
  );
  await act(async () => host.querySelector("button")!.click());
  await vi.waitFor(() => expect(mocks.notify).toHaveBeenCalledOnce());
  expect(form.values).toEqual(previous);
  expect(host.querySelector<HTMLButtonElement>('button[type="submit"]')!.disabled).toBe(false);
  mocks.getEngineConfig.mockResolvedValueOnce({ name: "B", options: [] });
  await act(async () => host.querySelector("button")!.click());
  await vi.waitFor(() => expect(form.values.name).toBe("B"));
});

test("rejected submission releases admission and picker controls for deliberate retry", async () => {
  let submit!: (values: LocalEngine) => Promise<void>;
  let refuse!: (error: Error) => void;
  const save = vi
    .fn()
    .mockImplementationOnce(
      () =>
        new Promise((_resolve, reject) => {
          refuse = reject;
        }),
    )
    .mockResolvedValue(undefined);
  const form = {
    values: {} as LocalEngine,
    getInputProps: () => ({}),
    setFieldValue: vi.fn(),
    setValues: vi.fn(),
    onSubmit: (action: typeof submit) => {
      submit = action;
      return () => undefined;
    },
  };
  await act(async () =>
    root.render(<EngineForm form={form as never} submitLabel="Add" onSubmit={save} />),
  );
  let pending!: Promise<void>;
  await act(async () => {
    pending = submit(form.values);
    void submit(form.values);
    host.querySelectorAll("button")[0]!.click();
    host.querySelectorAll("button")[1]!.click();
  });
  expect(save).toHaveBeenCalledOnce();
  expect(mocks.issueEngineBinary).not.toHaveBeenCalled();
  expect(mocks.issueEngineImage).not.toHaveBeenCalled();
  expect([...host.querySelectorAll("button")].every((button) => button.disabled)).toBe(true);
  await act(async () => {
    refuse(new Error("Unexpected rejection"));
    await pending;
  });
  expect(mocks.notify).toHaveBeenCalledOnce();
  await act(async () => submit(form.values));
  expect(save).toHaveBeenCalledTimes(2);
  expect([...host.querySelectorAll("button")].every((button) => !button.disabled)).toBe(true);
});

test("unmounted binary detection cannot write into a reopened form owner", async () => {
  let complete!: (config: unknown) => void;
  mocks.issueEngineBinary.mockResolvedValue({ id: { id: "old" }, kind: "engine" });
  mocks.getEngineConfig.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        complete = resolve;
      }),
  );
  const form = {
    values: {} as LocalEngine,
    getInputProps: () => ({}),
    setFieldValue: vi.fn(),
    setValues: vi.fn(),
    onSubmit: () => () => undefined,
  };
  await act(async () =>
    root.render(<EngineForm form={form as never} submitLabel="Add" onSubmit={() => undefined} />),
  );
  await act(async () => host.querySelector("button")!.click());
  await vi.waitFor(() => expect(complete).toBeTypeOf("function"));
  await act(async () => root.unmount());
  form.setFieldValue.mockClear();
  root = createRoot(host);
  await act(async () =>
    root.render(<EngineForm form={form as never} submitLabel="Add" onSubmit={() => undefined} />),
  );
  await act(async () => complete({ name: "Obsolete", options: [] }));
  expect(form.setValues).not.toHaveBeenCalled();
  expect(form.setFieldValue).not.toHaveBeenCalled();
});

test("passes the filename validation error to the binary picker", async () => {
  const form = {
    values: { filename: "", imageHandle: undefined },
    errors: { filename: "Common.RequirePath" },
    getInputProps: () => ({}),
    setFieldValue: vi.fn(),
    setValues: vi.fn(),
    onSubmit: () => () => undefined,
  };

  await act(async () =>
    root.render(<EngineForm submitLabel="Add" form={form as never} onSubmit={() => undefined} />),
  );

  expect(host.querySelector('[role="alert"]')?.textContent).toBe("Common.RequirePath");
});

test("binary detection admits one picker and releases admission for a deliberate new selection", async () => {
  const firstHandle = { id: { id: "first" }, kind: "engine" as const };
  const secondHandle = { id: { id: "second" }, kind: "engine" as const };
  let resolveFirst!: (value: { name: string; options: never[] }) => void;
  mocks.issueEngineBinary.mockResolvedValueOnce(firstHandle).mockResolvedValueOnce(secondHandle);
  mocks.getEngineConfig
    .mockReturnValueOnce(new Promise((resolve) => (resolveFirst = resolve)))
    .mockResolvedValueOnce({ name: "Second", options: [] });
  const form = {
    values: { filename: "", imageHandle: undefined },
    getInputProps: () => ({}),
    setFieldValue: vi.fn(),
    setValues: vi.fn(),
    onSubmit: () => () => undefined,
  };
  await act(async () =>
    root.render(<EngineForm submitLabel="Add" form={form as never} onSubmit={() => undefined} />),
  );
  await act(async () => {
    host.querySelector("button")!.click();
    host.querySelector("button")!.click();
  });
  await vi.waitFor(() => expect(mocks.getEngineConfig).toHaveBeenCalledOnce());
  expect(mocks.issueEngineBinary).toHaveBeenCalledOnce();
  expect(form.setValues).not.toHaveBeenCalled();
  await act(async () => resolveFirst({ name: "First", options: [] }));
  expect(form.setValues).toHaveBeenCalledExactlyOnceWith({
    handle: firstHandle,
    name: "First",
    filename: "First",
    settings: [],
  });
  await act(async () => host.querySelector("button")!.click());
  expect(form.setValues).toHaveBeenLastCalledWith({
    handle: secondHandle,
    name: "Second",
    filename: "Second",
    settings: [],
  });
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
    setValues: vi.fn(),
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

test("real owner receipts keep a refused form open and adopt its image only on saved retry", async () => {
  const { getDefaultStore } = await import("jotai");
  const { enginesAtom } = await import("@/state/atoms");
  const store = getDefaultStore();
  const image = { id: { id: "real-form-image" }, kind: "engineImage" as const };
  const values: LocalEngine = {
    type: "local",
    id: "real-form",
    name: "Real form",
    version: "1",
    filename: "engine",
    handle: { id: { id: "real-binary" }, kind: "engine" },
    imageHandle: image,
  };
  localStorage.clear();
  await store.set(enginesAtom, []);
  let submit!: (values: LocalEngine) => Promise<void>;
  const form = {
    values,
    getInputProps: () => ({}),
    setFieldValue: vi.fn(),
    setValues: vi.fn(),
    onSubmit: (action: typeof submit) => {
      submit = action;
      return () => undefined;
    },
  };
  const saved = vi.fn();
  mocks.issueEngineImage.mockResolvedValueOnce(image);
  await act(async () =>
    root.render(
      <EngineForm
        submitLabel="Add"
        form={form as never}
        onSubmit={(record) => store.set(enginesAtom, (current) => [...current, record])}
        onSaved={saved}
      />,
    ),
  );
  await act(async () => host.querySelectorAll<HTMLButtonElement>("button")[1].click());
  mocks.reconcileEngineAttachments.mockRejectedValueOnce(new Error("prepare refused"));
  await act(async () => submit(values));
  expect(saved).not.toHaveBeenCalled();
  expect(store.get(enginesAtom)).toEqual([]);
  expect(host.querySelector("form")).not.toBeNull();
  await act(async () => submit(values));
  expect(saved).toHaveBeenCalledOnce();
  expect(store.get(enginesAtom)?.[0].imageHandle).toEqual(image);
  mocks.reconcileEngineAttachments.mockClear();
  await act(async () => root.unmount());
  expect(mocks.reconcileEngineAttachments).not.toHaveBeenCalled();
});

test("a pending form receipt after unmount cannot close another editor", async () => {
  let submit!: (values: LocalEngine) => Promise<void>;
  const values = {} as LocalEngine;
  const form = {
    values,
    getInputProps: () => ({}),
    setFieldValue: vi.fn(),
    setValues: vi.fn(),
    onSubmit: (action: typeof submit) => {
      submit = action;
      return () => undefined;
    },
  };
  const onSaved = vi.fn();
  let finish!: () => void;
  await act(async () =>
    root.render(
      <EngineForm
        submitLabel="Add"
        form={form as never}
        onSaved={onSaved}
        onSubmit={async () => {
          await new Promise<void>((resolve) => {
            finish = resolve;
          });
          return { operationId: "late", key: "engines", saved: true, synchronized: true };
        }}
      />,
    ),
  );
  const pending = submit(values);
  await act(async () => root.unmount());
  await act(async () => {
    finish();
    await pending;
  });
  expect(onSaved).not.toHaveBeenCalled();
});

test("unexpected form submission rejection is contained and reported", async () => {
  let submit!: (values: LocalEngine) => Promise<void>;
  const values = {} as LocalEngine;
  const form = {
    values,
    getInputProps: () => ({}),
    setFieldValue: vi.fn(),
    setValues: vi.fn(),
    onSubmit: (action: typeof submit) => {
      submit = action;
      return () => undefined;
    },
  };
  await act(async () =>
    root.render(
      <EngineForm
        submitLabel="Add"
        form={form as never}
        onSubmit={async () => {
          throw new Error("save rejected");
        }}
      />,
    ),
  );
  await expect(submit(values)).resolves.toBeUndefined();
  expect(mocks.notify).toHaveBeenCalledOnce();
});

test("does not attach a handle when the native picker is cancelled", async () => {
  mocks.issueEngineBinary.mockRejectedValue(new Error("Cancellation"));
  const form = {
    values: { filename: "", imageHandle: undefined },
    getInputProps: () => ({}),
    setFieldValue: vi.fn(),
    setValues: vi.fn(),
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
    setValues: vi.fn(),
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

test("configuration failure preserves the previous coherent form without adopting a partial handle", async () => {
  const handle = { id: { id: "engine-capability" }, kind: "engine" as const };
  mocks.issueEngineBinary.mockResolvedValue(handle);
  mocks.getEngineConfig.mockRejectedValue(new Error("uciok timeout"));
  const form = {
    values: { filename: "", imageHandle: undefined },
    getInputProps: () => ({}),
    setFieldValue: vi.fn(),
    setValues: vi.fn(),
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

  expect(form.setFieldValue).not.toHaveBeenCalled();
  expect(form.setFieldValue).not.toHaveBeenCalledWith("filename", expect.anything());
  expect(mocks.notify).toHaveBeenCalledWith(expect.objectContaining({ message: "uciok timeout" }));
});

test("does not attach an image handle when the image picker is cancelled", async () => {
  mocks.issueEngineImage.mockRejectedValue(new Error("Cancellation"));
  const form = {
    values: { filename: "", imageHandle: undefined },
    getInputProps: () => ({}),
    setFieldValue: vi.fn(),
    setValues: vi.fn(),
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
    setValues: vi.fn(),
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
    setValues: vi.fn(),
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
    setValues: vi.fn(),
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
    setValues: vi.fn(),
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
