import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

const listeners = new Map<string, ((language: string) => void)[]>();
const i18n = vi.hoisted(() => ({
  resolvedLanguage: "" as string | undefined,
  language: "" as string | undefined,
}));

vi.mock("@/i18n", () => ({
  default: {
    get resolvedLanguage() {
      return i18n.resolvedLanguage;
    },
    get language() {
      return i18n.language;
    },
    on(event: string, handler: (language: string) => void) {
      listeners.set(event, [...(listeners.get(event) ?? []), handler]);
    },
    off(event: string, handler: (language: string) => void) {
      listeners.set(
        event,
        (listeners.get(event) ?? []).filter((entry) => entry !== handler),
      );
    },
  },
}));

import { useDocumentLanguage } from "./useDocumentLanguage";

function Probe() {
  useDocumentLanguage();
  return null;
}

let root: Root;
let container: HTMLDivElement;

async function mount() {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () => root.render(<Probe />));
}

function changeLanguage(language: string) {
  for (const handler of listeners.get("languageChanged") ?? []) handler(language);
}

beforeEach(() => {
  listeners.clear();
  document.documentElement.removeAttribute("lang");
  i18n.resolvedLanguage = "de-DE";
  i18n.language = "de-DE";
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

test("publishes the resolved language on mount", async () => {
  await mount();
  expect(document.documentElement.lang).toBe("de-DE");
});

test("prefers the resolved language over the requested one", async () => {
  // i18next resolves "de" to the "de-DE" bundle; the document must name what is
  // actually being rendered, not what was asked for.
  i18n.resolvedLanguage = "de-DE";
  i18n.language = "de";
  await mount();
  expect(document.documentElement.lang).toBe("de-DE");
});

test("falls back to en-US when nothing is resolved yet", async () => {
  i18n.resolvedLanguage = undefined;
  i18n.language = undefined;
  await mount();
  expect(document.documentElement.lang).toBe("en-US");
});

test("follows a later language switch", async () => {
  await mount();
  await act(async () => changeLanguage("fr-FR"));
  expect(document.documentElement.lang).toBe("fr-FR");
});

test("stops following once unmounted", async () => {
  await mount();
  await act(async () => root.unmount());
  changeLanguage("fr-FR");
  expect(document.documentElement.lang).toBe("de-DE");
  // The afterEach unmount must stay safe.
  container.remove();
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
