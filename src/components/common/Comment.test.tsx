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
  async ({ input, text, formatting, absent }) => {
    await act(async () => root.render(<Comment comment={input} />));

    expect(container.textContent?.replace(/\s/g, "")).toBe((text ?? input).replace(/\s/g, ""));
    expect(container.querySelector(forbiddenCommentElements)).toBeNull();
    for (const selector of absent ?? []) {
      expect(container.querySelector(selector)).toBeNull();
    }
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

test("wraps formatted siblings together and keeps text outside underline pairs", async () => {
  await act(async () =>
    root.render(
      <Comment comment="before ++a **b** *c* ~~d~~ [e](https://x.y) f++ between ++**g**++ after" />,
    ),
  );

  expect(container.textContent).toBe("before a b c d e f between g after");
  const underlines = container.querySelectorAll("u");
  expect(underlines).toHaveLength(2);
  expect(underlines[0].textContent).toBe("a b c d e f");
  expect(underlines[0].querySelector("strong")?.textContent).toBe("b");
  expect(underlines[0].querySelector("em")?.textContent).toBe("c");
  expect(underlines[0].querySelector("del")?.textContent).toBe("d");
  expect(underlines[0].querySelector('a[href="https://x.y"]')?.textContent).toBe("e");
  expect(underlines[1].querySelector("strong")?.textContent).toBe("g");
});

test.each(["\n", "\n\n"])("does not pair underline delimiters across %j", async (separator) => {
  await act(async () => root.render(<Comment comment={`++a **b**${separator}c++`} />));

  expect(container.textContent?.replace(/\s/g, "")).toBe("++abc++");
  expect(container.querySelector("strong")?.textContent).toBe("b");
  expect(container.querySelector("u")).toBeNull();
});

test("does not pair delimiters in literal tables across a paragraph", async () => {
  const comment =
    "| a | b |\n| --- | --- |\n| ++c | d |\n\noutside **x**\n\n| a | b |\n| --- | --- |\n| c++ | d |";
  await act(async () => root.render(<Comment comment={comment} />));

  expect(container.textContent?.replace(/\s/g, "")).toBe(
    comment.replace("**x**", "x").replace(/\s/g, ""),
  );
  expect(container.querySelector("strong")?.textContent).toBe("x");
  expect(container.querySelector("u")).toBeNull();
  expect(container.querySelector(forbiddenCommentElements)).toBeNull();
});
