import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

vi.mock("@mantine/core", () => ({
  ActionIcon: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props}>{children}</button>
  ),
  Loader: () => <span>Loading</span>,
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

import { IconAction } from "./IconAction";

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

test("exposes a named semantic button and pressed state", async () => {
  await act(async () => {
    root.render(
      <IconAction label="Toggle annotations" pressed>
        <span aria-hidden>Icon</span>
      </IconAction>,
    );
  });

  const button = container.querySelector("button")!;
  expect(button.getAttribute("aria-label")).toBe("Toggle annotations");
  expect(button.getAttribute("aria-pressed")).toBe("true");
});

test("disables and marks a pending action busy", async () => {
  await act(async () => {
    root.render(
      <IconAction label="Save" pending>
        <span aria-hidden>Icon</span>
      </IconAction>,
    );
  });

  const button = container.querySelector("button")!;
  expect(button.disabled).toBe(true);
  expect(button.getAttribute("aria-busy")).toBe("true");
});
