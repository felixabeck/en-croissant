import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, expect, test, vi } from "vitest";
import { DEFAULT_THEME, MantineProvider, mergeMantineTheme } from "@mantine/core";
import { supportedLocales } from "@/i18n";
import { createAppTheme } from "@/styles/theme";
import { catalogueI18n } from "@/tests/catalogues";
import ColorControl from "./ColorControl";

const colorScheme = vi.hoisted(() => ({ current: "light" as "light" | "dark" }));
const primaryColor = vi.hoisted(() => {
  const state = { value: "blue", set: vi.fn<(color: string) => void>() };
  state.set.mockImplementation((color) => {
    state.value = color;
  });
  return state;
});
const translation = vi.hoisted(() => ({
  t: (key: string, options?: { color?: string }) => options?.color ?? key,
}));
vi.mock("react-i18next", () => ({ useTranslation: () => translation }));
vi.mock("jotai", () => ({ useAtom: () => [primaryColor.value, primaryColor.set] }));
vi.mock("@/state/atoms", () => ({ primaryColorAtom: {} }));
vi.mock("@mantine/core", async () => {
  const actual = await vi.importActual<typeof import("@mantine/core")>("@mantine/core");
  return {
    ...actual,
    useComputedColorScheme: () => colorScheme.current,
    ColorSwatch: ({ children, color, ...props }: any) => (
      <button {...props} data-swatch-color={color}>
        {children}
      </button>
    ),
  };
});

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockReturnValue({
    matches: false,
    media: "",
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }),
});

const theme = mergeMantineTheme(
  DEFAULT_THEME,
  createAppTheme({ primaryColor: "blue", spellCheck: true }),
);

let root: Root | undefined;
let host: HTMLDivElement | undefined;

afterEach(() => {
  if (root) act(() => root?.unmount());
  host?.remove();
  root = undefined;
  host = undefined;
});

async function clickEveryColour(scheme: "light" | "dark", themeColors: string[]) {
  for (const [index, color] of themeColors.entries()) {
    const swatches = [...host!.querySelectorAll<HTMLElement>('[role="radio"]')];
    await act(async () => swatches[index]?.click());
    expect(primaryColor.set).toHaveBeenLastCalledWith(color);

    await act(async () =>
      root!.render(
        <MantineProvider theme={theme} forceColorScheme={scheme}>
          <ColorControl />
        </MantineProvider>,
      ),
    );

    const rerenderedSwatches = [...host!.querySelectorAll<HTMLElement>('[role="radio"]')];
    expect(
      rerenderedSwatches.filter((swatch) => swatch.getAttribute("aria-checked") === "true"),
    ).toHaveLength(1);
    expect(rerenderedSwatches[index]?.getAttribute("aria-checked")).toBe("true");
    expect(
      rerenderedSwatches.filter(
        (swatch, selectedIndex) =>
          selectedIndex !== index && swatch.getAttribute("aria-checked") === "true",
      ),
    ).toHaveLength(0);
  }
}

test("gives every current theme colour a translated accessible name in every locale", async () => {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  const themeColors = Object.keys(theme.colors);
  expect(themeColors).toHaveLength(14);

  for (const locale of supportedLocales) {
    const localeI18n = await catalogueI18n(locale);
    translation.t = localeI18n.t.bind(localeI18n);

    for (const scheme of ["light", "dark"] as const) {
      colorScheme.current = scheme;
      await act(async () =>
        root!.render(
          <MantineProvider theme={theme} forceColorScheme={scheme}>
            <ColorControl />
          </MantineProvider>,
        ),
      );

      const swatches = [...host.querySelectorAll<HTMLElement>('[role="radio"]')];
      expect(swatches).toHaveLength(themeColors.length);

      for (const [index, color] of themeColors.entries()) {
        const colorKey = `Settings.Appearance.AccentColor.${color}`;
        const translatedColor = localeI18n.t(colorKey);
        expect(translatedColor).not.toBe(colorKey);
        expect(translatedColor).not.toBe("");
        expect(swatches[index]?.getAttribute("aria-label")).toBe(
          localeI18n.t("Settings.Appearance.AccentColor.Value", {
            color: translatedColor,
          }),
        );
        expect(swatches[index]?.getAttribute("data-swatch-color")).toBe(
          theme.colors[color][scheme === "dark" ? 7 : 5],
        );
        expect(swatches[index]?.getAttribute("aria-checked")).toBe(
          String(color === primaryColor.value),
        );
      }

      if (locale === supportedLocales[0]) {
        await clickEveryColour(scheme, themeColors);
      }
    }
  }
});
