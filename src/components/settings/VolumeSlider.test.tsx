import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import VolumeSlider from "./VolumeSlider";

const language = vi.hoisted(() => ({ current: "en-US" }));
const volume = vi.hoisted(() => ({ current: 0.4, set: vi.fn() }));
const playSound = vi.hoisted(() => vi.fn());

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key.split(".").at(-1) ?? key,
    i18n: { language: language.current },
  }),
}));
vi.mock("jotai", () => ({ useAtom: () => [volume.current, volume.set] }));
vi.mock("@/state/atoms", () => ({ soundVolumeAtom: {} }));
vi.mock("@/utils/sound", () => ({ playSound }));
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
      <button type="button" data-testid="drag" onClick={() => onChange(75)}>
        drag
      </button>
      <button type="button" data-testid="release" onClick={() => onChangeEnd(75)}>
        release
      </button>
    </div>
  ),
}));

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

let root: Root;
let host: HTMLDivElement;

beforeEach(() => {
  language.current = "en-US";
  volume.current = 0.4;
  volume.set = vi.fn();
  playSound.mockClear();
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

test("renders the scale marks as percentages of the active locale", async () => {
  await act(async () => root.render(<VolumeSlider />));

  expect(markLabels()).toEqual(["20%", "50%", "80%"]);
});

test("uses the locale's percent shaping rather than a hardcoded sign position", async () => {
  // fr-FR separates the value from the sign with a narrow no-break space.
  language.current = "fr-FR";
  await act(async () => root.render(<VolumeSlider />));

  const labels = markLabels();
  expect(labels).toHaveLength(3);
  for (const label of labels) expect(label).toMatch(/%/u);
  expect(labels).not.toEqual(["20%", "50%", "80%"]);
});

test("shows the stored volume as a percentage of the slider range", async () => {
  await act(async () => root.render(<VolumeSlider />));

  expect(host.querySelector("[data-testid=value]")?.textContent).toBe("40");
});

test("previews while dragging without persisting, then commits and plays on release", async () => {
  await act(async () => root.render(<VolumeSlider />));

  await act(async () => {
    host.querySelector<HTMLButtonElement>("[data-testid=drag]")!.click();
  });
  expect(host.querySelector("[data-testid=value]")?.textContent).toBe("75");
  expect(volume.set).not.toHaveBeenCalled();
  expect(playSound).not.toHaveBeenCalled();

  await act(async () => {
    host.querySelector<HTMLButtonElement>("[data-testid=release]")!.click();
  });
  expect(volume.set).toHaveBeenCalledWith(0.75);
  expect(playSound).toHaveBeenCalledTimes(1);
});
