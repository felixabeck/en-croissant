import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

vi.mock("@mantine/core", () => ({
  Typography: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

import Comment from "./Comment";

let root: Root;
let container: HTMLDivElement;

beforeEach(() => {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

test("renders Tiptap underline syntax without enabling raw HTML", async () => {
  await act(async () => {
    root.render(<Comment comment={'++critical++ <img src=x onerror="alert(1)">'} />);
  });

  expect(container.querySelector("u")?.textContent).toBe("critical");
  expect(container.querySelector("img")).toBeNull();
  expect(container.textContent).toContain('<img src=x onerror="alert(1)">');
});

test("does not interpret underline markers inside inline code", async () => {
  await act(async () => root.render(<Comment comment={"`++literal++` and ++underlined++"} />));

  expect(container.querySelector("code")?.textContent).toBe("++literal++");
  expect(container.querySelector("u")?.textContent).toBe("underlined");
});
