import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, test, vi } from "vitest";
import AppModal from "./AppModal";

vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (value: string) => value }) }));
vi.mock("@mantine/core", () => ({
  Modal: ({
    withCloseButton = true,
    closeOnEscape,
    closeOnClickOutside,
  }: {
    withCloseButton?: boolean;
    closeOnEscape?: boolean;
    closeOnClickOutside?: boolean;
  }) => (
    <div
      data-testid="modal"
      data-close-on-escape={String(closeOnEscape)}
      data-close-on-click-outside={String(closeOnClickOutside)}
    >
      {withCloseButton ? <button aria-label="close" /> : null}
    </div>
  ),
}));

let root: ReturnType<typeof createRoot>;
let host: HTMLDivElement;

afterEach(() => {
  root?.unmount();
  host?.remove();
});

test("pending work hides the close button regardless of the caller default", async () => {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);

  await act(async () => root.render(<AppModal opened pending onClose={vi.fn()} title="Pending" />));

  expect(host.querySelector('button[aria-label="close"]')).toBeNull();

  await act(async () => root.render(<AppModal opened onClose={vi.fn()} title="Ready" />));
  expect(host.querySelector('button[aria-label="close"]')).not.toBeNull();
});

test("pending work refuses Escape and outside-click dismissal", async () => {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  const modal = () => host.querySelector<HTMLDivElement>('[data-testid="modal"]')!;

  await act(async () => root.render(<AppModal opened pending onClose={vi.fn()} title="Pending" />));
  expect(modal().dataset.closeOnEscape).toBe("false");
  expect(modal().dataset.closeOnClickOutside).toBe("false");

  await act(async () => root.render(<AppModal opened onClose={vi.fn()} title="Ready" />));
  expect(modal().dataset.closeOnEscape).toBe("true");
  expect(modal().dataset.closeOnClickOutside).toBe("true");
});
