import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { Provider, createStore } from "jotai";
import { afterEach, expect, test, vi } from "vitest";
import { TreeStateContext } from "@/components/common/TreeStateContext";
import { createTreeStore } from "@/state/store/tree";
import { defaultTree } from "@/utils/treeReducer";
import PgnInput from "./PgnInput";

const mocks = vi.hoisted(() => ({ parsePGN: vi.fn() }));

vi.mock("@/utils/chess", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/utils/chess")>()),
  parsePGN: mocks.parsePGN,
}));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@mantine/core", () => ({
  Box: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
    <div {...props}>{children}</div>
  ),
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props}>{children}</button>
  ),
  Checkbox: () => null,
  CopyButton: () => null,
  Group: ({ children }: React.HTMLAttributes<HTMLDivElement>) => <div>{children}</div>,
  rem: (value: number) => `${value}rem`,
  Stack: ({ children }: React.HTMLAttributes<HTMLDivElement>) => <div>{children}</div>,
  Text: ({ children, ...props }: React.HTMLAttributes<HTMLElement>) => (
    <label {...props}>{children}</label>
  ),
  Textarea: ({
    autosize: _autosize,
    ...props
  }: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { autosize?: boolean }) => (
    <textarea {...props} />
  ),
}));
vi.mock("@/components/common/IconAction", () => ({
  IconAction: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props}>{children}</button>
  ),
}));

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

let host: HTMLDivElement;
let root: Root;

afterEach(async () => {
  await act(async () => root?.unmount());
  host?.remove();
  vi.restoreAllMocks();
});

test("PGN editor replacement keeps the same game's source stamp and append marker", async () => {
  const initial = defaultTree();
  initial.sourceStamp = "a".repeat(64);
  initial.appendAttempted = true;
  const store = createTreeStore(undefined, initial);
  const parsed = defaultTree();
  parsed.headers.event = "Updated PGN";
  parsed.sourceStamp = null;
  parsed.appendAttempted = false;
  mocks.parsePGN.mockResolvedValueOnce(parsed);
  const jotaiStore = createStore();
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);

  await act(async () =>
    root.render(
      <Provider store={jotaiStore}>
        <TreeStateContext.Provider value={store}>
          <PgnInput />
        </TreeStateContext.Provider>
      </Provider>,
    ),
  );

  const textarea = host.querySelector("textarea")!;
  const valueSetter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!;
  await act(async () => {
    valueSetter.call(textarea, '[Event "Edited"]\n\n1. d4 *');
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
    textarea.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await act(async () => {
    host.querySelector<HTMLButtonElement>("button")!.click();
  });

  expect(store.getState()).toMatchObject({
    dirty: true,
    sourceStamp: "a".repeat(64),
    appendAttempted: true,
    headers: { event: "Updated PGN" },
  });
});
