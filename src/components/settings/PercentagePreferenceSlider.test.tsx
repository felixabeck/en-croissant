import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import type { PrimitiveAtom } from "jotai";
import PercentagePreferenceSlider from "./PercentagePreferenceSlider";

const language = vi.hoisted(() => ({ current: "en-US" }));
const preference = vi.hoisted(() => ({ current: 100, set: vi.fn() }));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key.split(".").at(-1) ?? key,
    i18n: { language: language.current },
  }),
}));
vi.mock("jotai", () => ({ useAtom: () => [preference.current, preference.set] }));
vi.mock("@mantine/core", () => ({
  Slider: ({ marks, value, onChange, onChangeEnd, thumbLabel }: any) => (
    <div>
      <span data-testid="thumb-label">{thumbLabel}</span>
      <span data-testid="value">{value}</span>
      <ul>
        {marks.map((mark: { value: number; label: string }) => (
          <li key={mark.value}>{mark.label}</li>
        ))}
      </ul>
      <button type="button" data-testid="drag" onClick={() => onChange(70)}>
        drag
      </button>
      <button type="button" data-testid="release" onClick={() => onChangeEnd(70)}>
        release
      </button>
    </div>
  ),
}));

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const MARKS = [70, 85, 100];
const atom = {} as PrimitiveAtom<number>;

let root: Root;
let host: HTMLDivElement;

beforeEach(() => {
  language.current = "en-US";
  preference.current = 100;
  preference.set = vi.fn();
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

function markLabels() {
  return [...host.querySelectorAll("li")].map((item) => item.textContent);
}

async function renderSlider() {
  await act(async () =>
    root.render(
      <PercentagePreferenceSlider
        atom={atom}
        min={70}
        max={100}
        step={5}
        marks={MARKS}
        thumbLabel="Piece Size"
      />,
    ),
  );
}

test("renders the scale marks as percentages of the active locale", async () => {
  await renderSlider();

  expect(markLabels()).toEqual(["70%", "85%", "100%"]);
});

test("uses the locale's percent shaping rather than a hardcoded sign position", async () => {
  // fr-FR separates the value from the sign with a narrow no-break space.
  language.current = "fr-FR";
  await renderSlider();

  const labels = markLabels();
  expect(labels).toHaveLength(3);
  for (const label of labels) expect(label).toMatch(/%/u);
  expect(labels).not.toEqual(["70%", "85%", "100%"]);
});

test("previews while dragging without persisting, then commits on release", async () => {
  await renderSlider();

  await act(async () => {
    host.querySelector<HTMLButtonElement>("[data-testid=drag]")!.click();
  });
  expect(host.querySelector("[data-testid=value]")?.textContent).toBe("70");
  expect(preference.set).not.toHaveBeenCalled();

  await act(async () => {
    host.querySelector<HTMLButtonElement>("[data-testid=release]")!.click();
  });
  expect(preference.set).toHaveBeenCalledWith(70);
});
