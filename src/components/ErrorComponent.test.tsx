import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, test, vi } from "vitest";
import ErrorComponent, { recoverFromError } from "./ErrorComponent";

const mocks = vi.hoisted(() => ({ navigate: vi.fn(), notify: vi.fn() }));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (value: string) => value }),
  Trans: ({ components }: { components: Record<string, React.ReactNode> }) => components.github,
}));
vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => mocks.navigate,
}));
vi.mock("@mantine/notifications", () => ({ notifications: { show: mocks.notify } }));
vi.mock("@mantine/core", () => ({
  Anchor: ({ children, href }: any) => <a href={href}>{children}</a>,
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

test("routes issue reports to the fork", async () => {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(async () => root.render(<ErrorComponent error={new Error("boom")} />));
  expect(host.querySelector("a")?.getAttribute("href")).toBe(
    "https://github.com/felixabeck/en-croissant/issues/new?assignees=&labels=bug&projects=&template=bug.yml",
  );
});

test("successful recovery navigates before reloading", async () => {
  const order: string[] = [];
  await recoverFromError(
    async () => {
      order.push("navigate");
    },
    () => order.push("reload"),
    "Common.Error",
  );
  expect(order).toEqual(["navigate", "reload"]);
});

test("failed recovery surfaces the shared notification and does not reload", async () => {
  const failure = new Error("navigation failed");
  const reload = vi.fn();
  mocks.notify.mockReset();
  await recoverFromError(
    async () => {
      throw failure;
    },
    reload,
    "Common.Error",
  );
  expect(reload).not.toHaveBeenCalled();
  expect(mocks.notify).toHaveBeenCalledWith(
    expect.objectContaining({ title: "Common.Error", message: "navigation failed" }),
  );
});
