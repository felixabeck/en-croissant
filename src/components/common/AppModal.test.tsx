import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, test, vi } from "vitest";
import AppModal from "./AppModal";

vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (value: string) => value }) }));
vi.mock("@mantine/core", () => ({
  Modal: ({ withCloseButton = true }: { withCloseButton?: boolean }) =>
    withCloseButton ? <button aria-label="close" /> : null,
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
