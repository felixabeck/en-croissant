import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, test, vi } from "vitest";
import ErrorComponent from "./ErrorComponent";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (value: string) => value }),
  Trans: ({ i18nKey }: { i18nKey: string }) => i18nKey,
}));
vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => vi.fn(async () => undefined),
}));
vi.mock("@mantine/core", () => ({
  Anchor: ({ children }: any) => <a>{children}</a>,
  Button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
  Code: ({ children }: any) => <code>{children}</code>,
  CopyButton: ({ children, value }: any) => (
    <div data-copy={value}>{children({ copied: false, copy: () => undefined })}</div>
  ),
  Group: ({ children }: any) => <div>{children}</div>,
  Stack: ({ children }: any) => <div>{children}</div>,
  Text: ({ children }: any) => <p>{children}</p>,
  Title: ({ children }: any) => <h1>{children}</h1>,
}));

let root: ReturnType<typeof createRoot>;
let host: HTMLDivElement;

afterEach(() => {
  root?.unmount();
  host?.remove();
});

test("does not present a duplicate diagnostic", async () => {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(async () => root.render(<ErrorComponent error={new Error("boom")} />));
  expect(host.querySelector("code")).toBeNull();
  expect(host.textContent).not.toContain("Error.CopyStackTrace");
  expect(host.textContent).toContain("Error.Unexpected");
  expect(host.textContent).toContain("boom");
  expect(host.textContent).toContain("Menu.View.Reload");
});

test("hides a diagnostic that only repeats the message", async () => {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(async () =>
    root.render(
      <ErrorComponent
        error={{
          category: "unexpected",
          message: "boom",
          diagnostic: "boom",
        }}
      />,
    ),
  );
  expect(host.querySelector("code")).toBeNull();
  expect(host.textContent).not.toContain("Error.CopyStackTrace");
  expect(host.textContent).toContain("boom");
});

test("renders an extra diagnostic when it differs from the message", async () => {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(async () =>
    root.render(
      <ErrorComponent
        error={{
          category: "unexpected",
          message: "boom",
          diagnostic: "safe-code",
        }}
      />,
    ),
  );
  expect(host.querySelector("code")?.textContent).toBe("safe-code");
  expect(host.textContent).toContain("Error.CopyStackTrace");
});
