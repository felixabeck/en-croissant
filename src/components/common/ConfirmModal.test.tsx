import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { catalogueI18n } from "@/tests/catalogues";
import ConfirmModal from "./ConfirmModal";

const translation = vi.hoisted(() => ({ t: (value: string) => value }));
vi.mock("react-i18next", () => ({ useTranslation: () => translation }));
beforeEach(async () => {
  const instance = await catalogueI18n("de-DE");
  translation.t = instance.t.bind(instance);
});
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
    (item) => item.textContent === "Löschen",
  )!;
  act(() => {
    button.click();
    button.click();
  });
  expect(onConfirm).toHaveBeenCalledTimes(1);
  await act(async () => reject(new Error("native rejected at /private/file.pgn")));
  expect(host.querySelector('[role="dialog"]')?.textContent).toContain(
    "Die Aktion konnte nicht abgeschlossen werden. Bitte versuche es erneut.",
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
    [...host.querySelectorAll("button")].find((item) => item.textContent === "Löschen")!.click(),
  );
  expect(onConfirm).toHaveBeenCalledTimes(1);
  expect(onClose).toHaveBeenCalledTimes(1);
});

test("partially applied failures retain a distinct translated warning", async () => {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  const onClose = vi.fn();
  await act(async () =>
    root.render(
      <ConfirmModal
        title="Delete"
        description="x"
        opened
        onClose={onClose}
        onConfirm={async () => {
          throw { category: "applied-despite-error", message: "private native diagnostic" };
        }}
      />,
    ),
  );
  await act(async () =>
    [...host.querySelectorAll("button")].find((item) => item.textContent === "Löschen")!.click(),
  );
  expect(host.querySelector('[role="alert"]')?.textContent).toBe(
    "Ein Teil des Vorgangs wurde abgeschlossen. Die Anzeige entspricht möglicherweise nicht mehr dem aktuellen Stand.",
  );
  expect(host.textContent).not.toContain("private native diagnostic");
  expect(onClose).not.toHaveBeenCalled();
});
