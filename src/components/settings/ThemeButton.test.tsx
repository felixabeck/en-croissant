import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, expect, test, vi } from "vitest";
import { DEFAULT_THEME, MantineProvider, mergeMantineTheme } from "@mantine/core";
import { installMatchMediaStub } from "@/tests/matchMedia";
import { installResizeObserverStub } from "@/tests/resizeObserver";
import { createAppTheme } from "@/styles/theme";
import ThemeButton from "./ThemeButton";

const scheme = vi.hoisted(() => ({
  current: "auto" as "auto" | "light" | "dark",
  set: vi.fn<(value: string) => void>(),
}));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@mantine/core", async () => {
  const actual = await vi.importActual<typeof import("@mantine/core")>("@mantine/core");
  return {
    ...actual,
    useMantineColorScheme: () => ({ colorScheme: scheme.current, setColorScheme: scheme.set }),
  };
});

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
installMatchMediaStub();
installResizeObserverStub();

const theme = mergeMantineTheme(
  DEFAULT_THEME,
  createAppTheme({ primaryColor: "blue", spellCheck: true, fontSize: 100 }),
);

let root: Root | undefined;
let host: HTMLDivElement | undefined;

afterEach(() => {
  if (root) act(() => root?.unmount());
  host?.remove();
  root = undefined;
  host = undefined;
  scheme.set.mockClear();
});

async function renderThemeButton() {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(async () =>
    root!.render(
      <MantineProvider theme={theme}>
        <ThemeButton />
      </MantineProvider>,
    ),
  );
  return host;
}

test("offers the three colour schemes and selects the chosen one", async () => {
  const page = await renderThemeButton();
  const options = [...page.querySelectorAll<HTMLInputElement>('input[type="radio"]')];
  expect(options.map((option) => option.value)).toEqual(["auto", "light", "dark"]);
  expect(options.find((option) => option.checked)?.value).toBe("auto");

  await act(async () => options[2]!.click());
  expect(scheme.set).toHaveBeenLastCalledWith("dark");
});

// At a large font scale the toggle is wider than a compact Settings card (f-20260829-02): it has
// to stay whole and scroll, centred by auto margins so an overflow never runs off the left edge.
test("keeps the toggle whole in its own horizontal scroller", async () => {
  const page = await renderThemeButton();
  const control = page.querySelector<HTMLElement>(".mantine-SegmentedControl-root")!;
  const scroller = control.parentElement!;
  expect(scroller.style.overflowX).toBe("auto");
  expect(scroller.style.maxWidth).toBe("100%");
  expect(control.style.width).toBe("max-content");
  expect(control.style.marginInline).toBe("auto");
});
