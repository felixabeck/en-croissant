import { createInstance } from "i18next";
import type { i18n as I18n } from "i18next";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { I18nextProvider } from "react-i18next";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { installMatchMediaStub } from "@/tests/matchMedia";
import { appCssVariablesResolver, createAppTheme } from "@/styles/theme";
import enUS from "@/translation/en-US.json";
import { StartupStorageFailure } from "./StartupStorageFailure";

vi.mock("@/styles/theme", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/styles/theme")>();
  return { ...actual, createAppTheme: vi.fn(actual.createAppTheme) };
});
vi.mock("@mantine/core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@mantine/core")>();
  return { ...actual, MantineProvider: vi.fn(actual.MantineProvider) };
});

let root: ReturnType<typeof createRoot>;
let host: HTMLDivElement;

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  installMatchMediaStub();
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});

const states = [
  {
    legacySignInFound: false,
    allRevoked: true,
    explanation:
      "ChessFable could not update its saved account data and did not start. Try again to retry the update.",
  },
  {
    legacySignInFound: true,
    allRevoked: true,
    explanation:
      "A saved Lichess sign-in could not be removed from local storage, so ChessFable signed it out at Lichess. You can sign in again once ChessFable starts. Try again to retry removing the saved sign-in and signing it out at Lichess.",
  },
  {
    legacySignInFound: true,
    allRevoked: false,
    explanation:
      "A saved Lichess sign-in could not be removed from local storage. Signing it out at Lichess also failed, for example because there is no connection. Try again to retry removing the saved sign-in and signing it out at Lichess.",
  },
];

const catalogues = import.meta.glob<{ translation: Record<string, string> }>(
  "../../translation/*.json",
  { eager: true, import: "default" },
);

test.each(Object.entries(catalogues))(
  "uses the shipped %s catalogue with fallback disabled",
  async (path, catalogue) => {
    const i18n = createInstance();
    const locale = path.split("/").at(-1)?.replace(".json", "") ?? "";
    await i18n.init({
      lng: locale,
      fallbackLng: false,
      keySeparator: false,
      resources: { [locale]: catalogue },
    });
    for (const [state, key] of [
      [states[0], "Startup.StorageFailure.NoLegacySignIn"],
      [states[1], "Startup.StorageFailure.Revoked"],
      [states[2], "Startup.StorageFailure.NotRevoked"],
    ] as const) {
      if (!state) throw new Error("Missing test state");
      await renderFailure(i18n, state.legacySignInFound, state.allRevoked);
      expect(catalogue.translation[key]).toBeTruthy();
      expect(host.querySelector("p")?.textContent).toBe(catalogue.translation[key]);
      expect(host.querySelector("h1")?.textContent).toBe(
        catalogue.translation["Startup.StorageFailure.Title"],
      );
      expect(host.querySelector("button")?.textContent).toBe(
        catalogue.translation["Startup.StorageFailure.TryAgain"],
      );
    }
  },
);

async function renderFailure(i18n: I18n, legacySignInFound: boolean, allRevoked: boolean) {
  await act(async () =>
    root.render(
      <I18nextProvider i18n={i18n}>
        <StartupStorageFailure legacySignInFound={legacySignInFound} allRevoked={allRevoked} />
      </I18nextProvider>,
    ),
  );
}

test.each(states)(
  "renders exactly the explanation for $legacySignInFound/$allRevoked and retries",
  async ({ legacySignInFound, allRevoked, explanation }) => {
    const i18n = createInstance();
    await i18n.init({
      lng: "en-US",
      fallbackLng: false,
      keySeparator: false,
      resources: { "en-US": enUS },
    });
    await renderFailure(i18n, legacySignInFound, allRevoked);
    // Exercise the React compiler's cached render as well as its initial render.
    await renderFailure(i18n, legacySignInFound, allRevoked);
    expect(host.querySelector("h1")?.textContent).toBe("ChessFable could not start");
    expect(host.querySelectorAll("p")).toHaveLength(1);
    expect(host.querySelector("p")?.textContent).toBe(explanation);
    const container = host.querySelector<HTMLElement>(".mantine-Container-root");
    expect(container?.style.getPropertyValue("--container-size")).toBe("var(--container-size-sm)");
    expect(container?.className).toContain("mantine-Container-root");
    expect(container?.style.paddingBlock).toBe("var(--mantine-spacing-xl)");
    const stack = host.querySelector<HTMLElement>(".mantine-Stack-root");
    expect(stack?.style.getPropertyValue("--stack-align")).toBe("flex-start");
    expect(stack?.style.getPropertyValue("--stack-gap")).toBe("var(--mantine-spacing-md)");
    expect(host.querySelectorAll("button")).toHaveLength(1);
    const button = host.querySelector("button");
    expect(button?.textContent).toBe("Try again");
    expect(createAppTheme).toHaveBeenCalledExactlyOnceWith({
      primaryColor: "blue",
      spellCheck: false,
      fontSize: 100,
    });
    const { MantineProvider } = await import("@mantine/core");
    expect(MantineProvider).toHaveBeenLastCalledWith(
      expect.objectContaining({
        cssVariablesResolver: appCssVariablesResolver,
        defaultColorScheme: "dark",
        theme: vi.mocked(createAppTheme).mock.results[0]?.value,
      }),
      undefined,
    );
    // jsdom's native Location methods are non-configurable; spy on a replacement for the click only.
    const location = { reload: () => undefined };
    const reload = vi.spyOn(location, "reload");
    vi.stubGlobal("window", { location });
    await act(async () => button?.click());
    expect(reload).toHaveBeenCalledExactlyOnceWith();
    vi.unstubAllGlobals();
  },
);

test.each(states)(
  "renders fallback copy without suspending before i18n has initialized: $legacySignInFound/$allRevoked",
  async ({ legacySignInFound, allRevoked, explanation }) => {
    const i18n = createInstance();
    await renderFailure(i18n, legacySignInFound, allRevoked);
    await renderFailure(i18n, legacySignInFound, allRevoked);
    expect(host.querySelector("h1")?.textContent).toBe("ChessFable could not start");
    expect(host.querySelector("p")?.textContent).toBe(explanation);
    expect(host.querySelector("button")?.textContent).toBe("Try again");
  },
);
