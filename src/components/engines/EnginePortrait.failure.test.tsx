import { type ImageProps, MantineProvider, UnstyledButton } from "@mantine/core";
import { Brain, ImagePlus } from "lucide-react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { SWRConfig, type Cache } from "swr";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import bundledCatalog from "@/catalogs/engines.json";
import { installMatchMediaStub } from "@/tests/matchMedia";
import type { LocalEngine } from "@/utils/engines";
import EnginePortrait from "./EnginePortrait";
import { cleanupPortraitTest, settlePortraitCatalog } from "./tests/portraitCatalog";

const mocks = vi.hoisted(() => ({ verify: vi.fn(), readImage: vi.fn() }));
vi.mock("@/platform/tauri", () => ({
  tauri: { verifySignedBytes: mocks.verify, readEngineImage: mocks.readImage },
}));

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
installMatchMediaStub();

const first = bundledCatalog[0];
const differentPortrait = bundledCatalog.find((entry) => entry.image !== first.image)!;
const samePortrait = bundledCatalog.find(
  (entry) => entry.image === first.image && entry.downloadLink !== first.downloadLink,
)!;
const label = "Select engine image";
const select = vi.fn();

function installed(overrides: Partial<LocalEngine> = {}): LocalEngine {
  return {
    type: "local",
    id: "installed",
    name: "Same engine name",
    version: "old version",
    handle: { id: { id: "same-binary" }, kind: "engine" },
    filename: "same-engine",
    downloadLink: first.downloadLink,
    settings: [],
    ...overrides,
  };
}

let host: HTMLDivElement;
let root: Root;
let cache: Cache<unknown>;

async function render(engine = installed(), imageProps?: ImageProps) {
  await act(async () => {
    root.render(
      <MantineProvider env="test">
        <SWRConfig value={{ provider: () => cache }}>
          <div data-surface="card">
            <EnginePortrait engine={engine} imageProps={imageProps} fallback={<Brain />} />
          </div>
          <div data-surface="editor">
            <EnginePortrait
              engine={engine}
              imageProps={imageProps}
              selectImage={{ label, onClick: select }}
              fallback={
                <UnstyledButton type="button" aria-label={label} onClick={select}>
                  <ImagePlus />
                </UnstyledButton>
              }
            />
          </div>
        </SWRConfig>
      </MantineProvider>,
    );
  });
  await settlePortraitCatalog();
}

function surface(name: "card" | "editor") {
  return host.querySelector<HTMLDivElement>(`[data-surface="${name}"]`)!;
}

function images() {
  return [...host.querySelectorAll("img")];
}

async function expectPortraits(src: string) {
  await settlePortraitCatalog();
  expect(images()).toHaveLength(2);
  for (const image of images()) {
    expect(image.getAttribute("src")).toBe(src);
    expect(image.alt).toBe("Same engine name");
  }
}

async function fail(failedImages = images()) {
  await act(async () => {
    for (const image of failedImages) image.dispatchEvent(new Event("error"));
  });
}

function expectFallbacks() {
  expect(images()).toHaveLength(0);
  expect(surface("card").querySelector(".lucide-brain")).not.toBeNull();
  expect(surface("editor").querySelector(".lucide-image-plus")).not.toBeNull();
  const buttons = surface("editor").querySelectorAll("button");
  expect(buttons).toHaveLength(1);
  expect(buttons[0].getAttribute("aria-label")).toBe(label);
  expect(buttons[0].querySelector("button")).toBeNull();
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.verify.mockResolvedValue(undefined);
  mocks.readImage.mockResolvedValue({ bytes: [1, 2, 3], mimeType: "image/png" });
  cache = new Map();
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  await cleanupPortraitTest(root, host);
});

test("bundled image errors restore the CPU card fallback and clickable editor fallback", async () => {
  await render();
  await expectPortraits(first.image);
  await fail([surface("card").querySelector("img")!]);
  expect(surface("card").querySelector("img")).toBeNull();
  expect(surface("card").querySelector(".lucide-brain")).not.toBeNull();
  expect(surface("editor").querySelector("img")?.getAttribute("src")).toBe(first.image);
  await fail();
  expectFallbacks();
  await act(async () => surface("editor").querySelector("button")!.click());
  expect(select).toHaveBeenCalledOnce();
  await render();
  expectFallbacks();
  expect(mocks.verify).toHaveBeenCalledOnce();
});

const changes = [
  { change: "engine id with the same name and binary", overrides: { id: "successor" } },
  { change: "portrait source", overrides: { downloadLink: differentPortrait.downloadLink } },
  {
    change: "download source sharing a portrait",
    overrides: { downloadLink: samePortrait.downloadLink },
  },
];

test.each(changes)("a failed image recovers after changing $change", async ({ overrides }) => {
  await render();
  await expectPortraits(first.image);
  await fail();
  expectFallbacks();
  await render(installed(overrides));
  const src =
    overrides.downloadLink === differentPortrait.downloadLink
      ? differentPortrait.image
      : first.image;
  await expectPortraits(src);
  await fail();
  expectFallbacks();
  await render();
  await expectPortraits(first.image);
  expect(mocks.verify).toHaveBeenCalledOnce();
});

test.each(changes)(
  "late errors cannot hide the successor after changing $change",
  async ({ overrides }) => {
    await render();
    await expectPortraits(first.image);
    const retired = images();
    await render(installed(overrides));
    const src =
      overrides.downloadLink === differentPortrait.downloadLink
        ? differentPortrait.image
        : first.image;
    await expectPortraits(src);
    expect(images()[0]).not.toBe(retired[0]);
    expect(retired.every((image) => !image.isConnected)).toBe(true);
    await fail(retired);
    await expectPortraits(src);
    await render();
    await expectPortraits(first.image);
    await fail(retired);
    await expectPortraits(first.image);
  },
);

test("custom images retain precedence and native loading without catalog resolution", async () => {
  const imageHandle = { id: { id: "custom" }, kind: "engineImage" as const };
  await render(installed({ imageHandle }));
  await expectPortraits("data:image/png;base64,AQID");
  expect(mocks.verify).not.toHaveBeenCalled();
  expect(mocks.readImage).toHaveBeenCalledWith(imageHandle);
  await act(async () => surface("editor").querySelector("button")!.click());
  expect(select).toHaveBeenCalledOnce();
});

test("bundled errors preserve the imageProps error callback", async () => {
  const onError = vi.fn<NonNullable<ImageProps["onError"]>>((event) => {
    expect(event.currentTarget.getAttribute("src")).toBe(first.image);
  });
  await render(installed(), { onError });
  await expectPortraits(first.image);
  await fail();
  expectFallbacks();
  expect(onError).toHaveBeenCalledTimes(2);
});

test("a custom image replaces a failed bundled portrait and clearing it retries the bundled source", async () => {
  await render();
  await expectPortraits(first.image);
  const retired = images();
  await fail();
  expectFallbacks();
  await render(installed({ imageHandle: { id: { id: "custom" }, kind: "engineImage" } }));
  await expectPortraits("data:image/png;base64,AQID");
  await fail(retired);
  await expectPortraits("data:image/png;base64,AQID");
  await render();
  await expectPortraits(first.image);
  expect(mocks.verify).toHaveBeenCalledOnce();
});
