import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

vi.mock("@mantine/core", () => ({
  Box: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
    <div {...props}>{children}</div>
  ),
  Menu: Object.assign(({ children }: { children: React.ReactNode }) => <div>{children}</div>, {
    Item: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
      <button {...props}>{children}</button>
    ),
    Target: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    Dropdown: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  }),
  UnstyledButton: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props}>{children}</button>
  ),
}));

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

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

test("derives selection from the current side and label without an effect write", async () => {
  const SideInput = (await import("./SideInput")).SideInput;
  const setSides = vi.fn();

  await act(async () => {
    root.render(<SideInput role="opponent" sides="WhiteBlack" setSides={setSides} />);
  });
  expect(setSides).not.toHaveBeenCalled();
  expect(container.querySelector("div[style*='background-color: black']")).not.toBeNull();

  await act(async () => {
    root.render(<SideInput role="player" sides="WhiteBlack" setSides={setSides} />);
  });
  expect(setSides).not.toHaveBeenCalled();
  expect(container.querySelector("div[style*='background-color: white']")).not.toBeNull();

  await act(async () => {
    Array.from(container.querySelectorAll<HTMLButtonElement>("button"))
      .find((button) => button.textContent === "Board.Database.Local.Result.Any")
      ?.click();
  });
  expect(setSides).toHaveBeenCalledWith("Any");
});
