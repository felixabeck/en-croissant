import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

const native = vi.hoisted(() => ({
  arch: vi.fn(),
  getTauriVersion: vi.fn(),
  getVersion: vi.fn(),
  OSVersion: vi.fn(),
  osType: vi.fn(),
}));

vi.mock("@/platform/native", () => native);
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: { date?: string }) =>
      key === "About.ModificationNotice"
        ? `Modified version of En Croissant, modified by Felix Beck since ${options?.date}. Distributed under the GNU General Public License version 3, with no warranty.`
        : key,
  }),
}));
vi.mock("@mantine/core", () => ({
  Anchor: ({ children }: { children?: React.ReactNode }) => <a>{children}</a>,
  Text: ({ children }: { children?: React.ReactNode }) => <p>{children}</p>,
}));
vi.mock("./common/AppModal", () => ({
  default: ({
    children,
    opened,
    title,
  }: {
    children?: React.ReactNode;
    opened: boolean;
    title: string;
  }) =>
    opened ? (
      <div role="dialog" aria-label={title}>
        {children}
      </div>
    ) : null,
}));

import AboutModal from "./About";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  native.arch.mockResolvedValue("x86_64");
  native.getTauriVersion.mockResolvedValue("2.0.0");
  native.getVersion.mockResolvedValue("1.0.0");
  native.OSVersion.mockResolvedValue("1.0.0");
  native.osType.mockResolvedValue("Linux");
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

test("renders the modification notice inside the opened About dialog", async () => {
  await act(async () => root.render(<AboutModal opened setOpened={vi.fn()} />));

  const dialog = container.querySelector('[role="dialog"]');
  expect(dialog).not.toBeNull();
  expect(dialog?.textContent).toContain("Modified version of En Croissant");
  expect(dialog?.textContent).toContain("Felix Beck");
  expect(dialog?.textContent).toContain("since 2026-08-09");
  expect(dialog?.textContent).toContain("GNU General Public License version 3");
  expect(dialog?.textContent).toContain("no warranty");
});

// The test above renders through a mocked `t`, so it proves the notice is rendered and that the
// date is interpolated, but not that the shipped English string actually says what GPL-3 section
// 5(a) requires. Assert the catalogue itself: a notice that names no modifier does not discharge
// the licence, and that is a defect no rendering test would catch.
test("the shipped en-US notice carries every element section 5(a) requires", async () => {
  const catalogue = (await import("@/translation/en-US.json")).default as {
    translation: Record<string, string>;
  };
  const notice = catalogue.translation["About.ModificationNotice"];

  expect(notice).toBeDefined();
  expect(notice).toContain("{{date}}");
  expect(notice).toMatch(/modified/i);
  expect(notice).toContain("Felix Beck");
  expect(notice).toContain("General Public License");
  expect(notice).toMatch(/no warranty/i);
});
