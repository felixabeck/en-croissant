import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, test, vi } from "vitest";
import ConfirmModal from "./ConfirmModal";

vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (value: string) => value }) }));
vi.mock("@mantine/core", () => ({
  Button: ({ children, loading, ...props }: any) => (
    <button {...props} disabled={loading || props.disabled}>
      {children}
    </button>
  ),
  Group: ({ children }: any) => <div>{children}</div>,
  Modal: ({ opened, title, children }: any) =>
    opened ? (
      <div role="dialog" aria-label={title}>
        {children}
      </div>
    ) : null,
  Stack: ({ children }: any) => <div>{children}</div>,
  Text: ({ children, ...props }: any) => <p {...props}>{children}</p>,
}));

let root: ReturnType<typeof createRoot>;
let host: HTMLDivElement;
afterEach(() => {
  root?.unmount();
  host?.remove();
});
test("reject keeps confirmation open and locks duplicate submits", async () => {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  let reject!: (error: Error) => void;
  const onConfirm = vi.fn(
    () =>
      new Promise<void>((_, fail) => {
        reject = fail;
      }),
  );
  await act(async () =>
    root.render(
      <ConfirmModal
        title="Delete"
        description="x"
        opened
        onClose={vi.fn()}
        onConfirm={onConfirm}
      />,
    ),
  );
  const button = [...host.querySelectorAll("button")].find(
    (item) => item.textContent === "Common.Delete",
  )!;
  act(() => {
    button.click();
    button.click();
  });
  expect(onConfirm).toHaveBeenCalledTimes(1);
  await act(async () => reject(new Error("native rejected at /private/file.pgn")));
  expect(host.querySelector('[role="dialog"]')?.textContent).toContain(
    "Common.ConfirmationError.unexpected",
  );
  expect(host.textContent).not.toContain("native rejected");
  expect(host.textContent).not.toContain("/private/file.pgn");
  expect(button.disabled).toBe(false);
});

test("successful confirmation closes once after the native action resolves", async () => {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  const onConfirm = vi.fn().mockResolvedValue(undefined);
  const onClose = vi.fn();
  await act(async () =>
    root.render(
      <ConfirmModal
        title="Delete"
        description="x"
        opened
        onClose={onClose}
        onConfirm={onConfirm}
      />,
    ),
  );
  await act(async () =>
    [...host.querySelectorAll("button")]
      .find((item) => item.textContent === "Common.Delete")!
      .click(),
  );
  expect(onConfirm).toHaveBeenCalledTimes(1);
  expect(onClose).toHaveBeenCalledTimes(1);
});
