import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

vi.mock("@mantine/core", () => ({
  Typography: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

import Comment from "./Comment";
import { commentDialectCases, forbiddenCommentElements } from "./tests/commentDialectCases";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

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

test("keeps backticks literal and underlines the text between them", async () => {
  await act(async () => root.render(<Comment comment={"`++literal++` and ++underlined++"} />));

  expect(container.querySelector("code")).toBeNull();
  expect(container.textContent).toBe("`literal` and underlined");
  expect([...container.querySelectorAll("u")].map((element) => element.textContent)).toEqual([
    "literal",
    "underlined",
  ]);
});

test.each(commentDialectCases)(
  "renders the inline dialect: $name",
  async ({ input, text, formatting }) => {
    await act(async () => root.render(<Comment comment={input} />));

    expect(container.textContent?.replace(/\s/g, "")).toBe((text ?? input).replace(/\s/g, ""));
    expect(container.querySelector(forbiddenCommentElements)).toBeNull();
    for (const expected of formatting ?? []) {
      expect(container.querySelector(expected.selector)?.textContent).toBe(expected.text);
    }
  },
);

test("keeps the move-like prefix as text before strong formatting", async () => {
  await act(async () => root.render(<Comment comment="59. **x**" />));

  expect(container.querySelector("span")?.firstChild?.textContent).toBe("59. ");
  expect(container.querySelector("strong")?.textContent).toBe("x");
  expect(container.querySelector(forbiddenCommentElements)).toBeNull();
});
