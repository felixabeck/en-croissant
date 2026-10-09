import { MantineProvider } from "@mantine/core";
import { createStore, Provider } from "jotai";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { fontSizeAtom } from "@/state/atoms";
import { installMatchMediaStub } from "@/tests/matchMedia";
import type { MenuGroup } from "@/routes/-appMenu";

vi.mock("@/state/atoms", async () => {
  const { atom } = await import("jotai");
  return { fontSizeAtom: atom(100) };
});
vi.mock("@/platform/native", () => ({
  getCurrentWebviewWindow: () => ({
    isMaximized: async () => false,
    onResized: async () => () => undefined,
  }),
}));
vi.mock("@/components/files/notifyError", () => ({ notifyUnlessCancelled: vi.fn() }));
vi.mock("react-i18next", () => {
  const t = (key: string) => key;
  return { useTranslation: () => ({ t }) };
});

import TopBar from "./TopBar";

// This 175 ms settling interval exceeds the 150 ms submenu close grace and Mantine 8.3.14's
// 16 ms scheduled focus transfer.
const MENU_KEYBOARD_SETTLE_DELAY_MS = 175;

let root: Root;
let host: HTMLDivElement;
let store: ReturnType<typeof createStore>;
let groups: MenuGroup[];
let actions: ReturnType<typeof vi.fn<() => void>>[];

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  installMatchMediaStub({ matches: (query) => query === "(max-width: 96em)" });
  store = createStore();
  actions = [vi.fn(), vi.fn(), vi.fn()];
  groups = ["File", "View", "Help"].map((label, index) => ({
    label,
    options: [
      { label: `${label} first`, shortcut: `Ctrl+${index}`, action: actions[index] },
      { kind: "separator" },
      { label: `${label} last`, action: actions[index] },
    ],
  }));
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

async function mount(scale: number, controls = true) {
  store.set(fontSizeAtom, scale);
  await act(async () =>
    root.render(
      <Provider store={store}>
        <MantineProvider>
          <TopBar menuActions={groups} showWindowControls={controls} />
        </MantineProvider>
      </Provider>,
    ),
  );
}

function button(label: string) {
  const result = [...document.querySelectorAll<HTMLButtonElement>("button")].find(
    (item) => item.getAttribute("aria-label") === label || item.textContent === label,
  );
  expect(result).toBeDefined();
  return result!;
}

async function click(label: string) {
  await act(async () => button(label).click());
}

async function key(element: HTMLElement, value: string) {
  await act(async () => {
    element.dispatchEvent(new KeyboardEvent("keydown", { key: value, bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, MENU_KEYBOARD_SETTLE_DELAY_MS));
  });
}

test.each([100, 200])(
  "%s%% preserves every action, separator, shortcut and closes the whole tree",
  async (scale) => {
    await mount(scale);
    for (const [index, group] of groups.entries()) {
      for (const suffix of ["first", "last"]) {
        if (scale === 200) await click("Menu.Application.Menu");
        await click(group.label);
        const menu = button(`${group.label} firstCtrl+${index}`).closest('[role="menu"]')!;
        expect(menu.querySelectorAll(".mantine-Menu-divider")).toHaveLength(1);
        expect(menu.textContent).toBe(`${group.label} firstCtrl+${index}${group.label} last`);
        await click(
          suffix === "first" ? `${group.label} firstCtrl+${index}` : `${group.label} last`,
        );
        expect(actions[index]).toHaveBeenCalledTimes(suffix === "first" ? 1 : 2);
        expect(document.querySelectorAll('[role="menu"]')).toHaveLength(0);
      }
    }
  },
);

test("compact groups support Enter, Space, arrow return and Escape", async () => {
  await mount(200);
  await click("Menu.Application.Menu");
  for (const activation of ["Enter", " ", "ArrowRight"]) {
    button("Help").focus();
    await key(button("Help"), activation);
    expect(document.activeElement).toBe(button("Help firstCtrl+2"));
    await key(button("Help firstCtrl+2"), "ArrowLeft");
    expect(document.activeElement).toBe(button("Help"));
    expect(document.querySelectorAll('[role="menu"]')).toHaveLength(1);
  }
  await key(button("Help"), "Escape");
  expect(document.querySelectorAll('[role="menu"]')).toHaveLength(0);
});

test("compact target and all groups remain available without window controls", async () => {
  await mount(200, false);
  expect(host.querySelectorAll("button")).toHaveLength(1);
  await click("Menu.Application.Menu");
  expect(
    [...document.querySelectorAll("[data-sub-menu-item]")].map((item) => item.textContent),
  ).toEqual(["File", "View", "Help"]);
});

test("live scaling closes obsolete popups and transfers only menu-owned focus", async () => {
  await mount(100);
  await click("Help");
  button("Help last").focus();
  await act(async () => store.set(fontSizeAtom, 200));
  expect(document.querySelectorAll('[role="menu"]')).toHaveLength(0);
  expect(document.activeElement).toBe(button("Menu.Application.Menu"));
  await click("Menu.Application.Menu");
  await click("Help");
  button("Help last").focus();
  await act(async () => store.set(fontSizeAtom, 100));
  expect(document.querySelectorAll('[role="menu"]')).toHaveLength(0);
  expect(document.activeElement).toBe(button("File"));
  const elsewhere = document.createElement("input");
  host.append(elsewhere);
  elsewhere.focus();
  await act(async () => store.set(fontSizeAtom, 200));
  expect(document.activeElement).toBe(elsewhere);
});
