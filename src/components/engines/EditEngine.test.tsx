import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import type { UseFormReturnType } from "@mantine/form";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import type { LocalEngine } from "@/utils/engines";

const mocks = vi.hoisted(() => ({
  engines: [] as LocalEngine[],
  saveEngines: vi.fn(),
  submit: undefined as undefined | ((value: LocalEngine) => Promise<unknown>),
  formReceipt: undefined as unknown,
  form: undefined as UseFormReturnType<LocalEngine> | undefined,
}));
vi.mock("jotai", () => ({
  useAtom: () => [mocks.engines, mocks.saveEngines],
}));
vi.mock("@/state/atoms", () => ({ enginesAtom: {} }));
vi.mock("./EngineForm", () => ({
  default: ({
    onSubmit,
    form,
  }: {
    onSubmit: (value: LocalEngine) => Promise<unknown>;
    form: UseFormReturnType<LocalEngine>;
  }) => {
    mocks.submit = onSubmit;
    mocks.form = form;
    return (
      <form
        onSubmit={form.onSubmit(async (values) => {
          mocks.formReceipt = await onSubmit(values);
        })}
      >
        <input aria-label="name" {...form.getInputProps("name")} />
        <input aria-label="filename" {...form.getInputProps("filename")} />
        <output data-testid="name-error">{form.errors.name}</output>
        <output data-testid="filename-error">{form.errors.filename}</output>
        <button type="submit">submit</button>
      </form>
    );
  },
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) =>
      key.startsWith("Common.Require") || key === "Common.NameAlreadyUsed"
        ? `translated:${key}`
        : key,
  }),
}));

import EditEngine from "./EditEngine";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const original: LocalEngine = {
  type: "local",
  id: "target",
  name: "Original",
  version: "1",
  filename: "engine",
  handle: { id: { id: "binary" }, kind: "engine" },
};

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  mocks.engines = [original];
  mocks.formReceipt = undefined;
  mocks.form = undefined;
  mocks.saveEngines.mockImplementation(async (update) => {
    mocks.engines = update(mocks.engines);
    return { operationId: "operation", key: "engines", saved: true, synchronized: true };
  });
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.clearAllMocks();
});

test("resolves the immutable target id against latest state and preserves it", async () => {
  await act(async () => root.render(<EditEngine initialEngine={original} />));
  mocks.engines = [
    { ...original, id: "inserted", name: "Inserted" },
    { ...original, name: "Latest" },
  ];
  await act(async () => {
    await mocks.submit?.({ ...original, id: "json-injected", name: "Edited" });
  });
  expect(mocks.engines.map(({ id, name }) => ({ id, name }))).toEqual([
    { id: "inserted", name: "Inserted" },
    { id: "target", name: "Edited" },
  ]);
  expect(mocks.saveEngines).toHaveBeenCalledOnce();
});

test("renders translated validation errors from actual form validation", async () => {
  await act(async () =>
    root.render(<EditEngine initialEngine={{ ...original, name: "", filename: "" }} />),
  );

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
    mocks.form?.setValues({ name: "Original", filename: "engine" });
  });
  await act(async () => {
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
  expect(host.querySelector('[data-testid="name-error"]')?.textContent).toBe("");
  expect(host.querySelector('[data-testid="filename-error"]')?.textContent).toBe("");
});

test("accepts a copied current engine with the same immutable id and name", async () => {
  const initial = { ...original, name: "Copied" };
  mocks.engines = [{ ...initial }];
  await act(async () => root.render(<EditEngine initialEngine={initial} />));

  await act(async () => {
    host
      .querySelector("form")!
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
  expect(host.querySelector('[data-testid="name-error"]')?.textContent).toBe("");
  expect(host.querySelector('[data-testid="filename-error"]')?.textContent).toBe("");
});

test("rejects a same-name engine with another immutable id", async () => {
  const copied = { ...original, name: "Copied" };
  mocks.engines = [copied, { ...copied, id: "other" }];
  await act(async () => root.render(<EditEngine initialEngine={copied} />));

  await act(async () => {
    host
      .querySelector("form")!
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
  expect(host.querySelector('[data-testid="name-error"]')?.textContent).toBe(
    "translated:Common.NameAlreadyUsed",
  );
  expect(host.querySelector('[data-testid="filename-error"]')?.textContent).toBe("");
});

test("does not resurrect a target deleted while the editor was open", async () => {
  await act(async () => root.render(<EditEngine initialEngine={original} />));
  mocks.engines = [];
  await act(async () => {
    host
      .querySelector("form")!
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
  expect(mocks.engines).toEqual([]);
  expect(mocks.formReceipt).toEqual(
    expect.objectContaining({
      operationId: "operation",
      key: "engines",
      saved: false,
      synchronized: false,
    }),
  );
});
