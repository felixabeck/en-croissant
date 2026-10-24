import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import type { EngineImageData, EngineImageHandle } from "@/bindings";

const mocks = vi.hoisted(() => ({
  readEngineImage: vi.fn(),
  warn: vi.fn(),
}));

vi.mock("@mantine/core", () => ({
  Image: ({ ...props }: React.ImgHTMLAttributes<HTMLImageElement>) => <img {...props} />,
}));
vi.mock("@/platform/tauri", () => ({ tauri: { readEngineImage: mocks.readEngineImage } }));
vi.mock("@/platform/native", () => ({
  warn: mocks.warn,
}));

import LocalImage from "./LocalImage";

// This deliberately mirrors LocalImage's chunk size without importing it: the payload must span
// more than one chunk, and a non-multiple of 3 exposes per-chunk btoa instead of hiding it. At
// 8190, a per-chunk btoa regression leaves every test green; at 8192, this case reds it.
const INDEPENDENT_CHUNK_SIZE = 8192;

let container: HTMLDivElement;
let root: Root;

function imageHandle(id: string): EngineImageHandle {
  return { id: { id }, kind: "engineImage" };
}

function renderImage(id: string) {
  root.render(<LocalImage image={imageHandle(id)} alt={id} />);
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function renderedSrc() {
  return container.querySelector("img")?.getAttribute("src");
}

function independentBase64(bytes: number[]) {
  return btoa(bytes.map((byte) => String.fromCharCode(byte)).join(""));
}

beforeEach(() => {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  mocks.readEngineImage.mockReset();
  mocks.warn.mockReset().mockResolvedValue(undefined);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.restoreAllMocks();
});

test("renders a resolved PNG as an independently encoded data URL", async () => {
  const bytes = [0, 1, 2, 250, 251, 252];
  mocks.readEngineImage.mockResolvedValue({ bytes, mimeType: "image/png" });

  await act(async () => renderImage("png-image"));

  expect(renderedSrc()).toBe(`data:image/png;base64,${independentBase64(bytes)}`);
});

test("reads an engine image once when a new handle has the same id", async () => {
  const bytes = [1, 2, 3];
  mocks.readEngineImage.mockResolvedValue({ bytes, mimeType: "image/png" });

  await act(async () => renderImage("same-image"));

  expect(mocks.readEngineImage).toHaveBeenCalledExactlyOnceWith({
    id: { id: "same-image" },
    kind: "engineImage",
  });

  await act(async () => {
    root.render(
      <LocalImage image={{ id: { id: "same-image" }, kind: "engineImage" }} alt="updated alt" />,
    );
  });

  expect(mocks.readEngineImage).toHaveBeenCalledTimes(1);
  expect(renderedSrc()).toBe(`data:image/png;base64,${independentBase64(bytes)}`);
});

test("clears the image and logs one warning when decoding fails", async () => {
  const id = "123e4567-e89b-12d3-a456-426614174000";
  const bytes = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0xff];
  mocks.readEngineImage.mockResolvedValue({ bytes, mimeType: "image/png" });

  await act(async () => renderImage(id));

  expect(renderedSrc()).toBe(`data:image/png;base64,${independentBase64(bytes)}`);
  const img = container.querySelector("img")!;
  await act(async () => {
    img.dispatchEvent(new Event("error"));
  });

  expect(renderedSrc()).toBeNull();
  expect(mocks.warn).toHaveBeenCalledExactlyOnceWith("engine image failed to decode");
  expect(JSON.stringify(mocks.warn.mock.calls)).not.toContain(id);
  expect(JSON.stringify(mocks.warn.mock.calls)).not.toContain("data:image");

  await act(async () => {
    img.dispatchEvent(new Event("error"));
  });

  expect(mocks.warn).toHaveBeenCalledTimes(1);
});

test("ignores a decode error for a different nonempty image source", async () => {
  const bytes = [1, 2, 3];
  mocks.readEngineImage.mockResolvedValue({ bytes, mimeType: "image/png" });

  await act(async () => renderImage("png-image"));

  expect(renderedSrc()).toBe(`data:image/png;base64,${independentBase64(bytes)}`);
  const img = container.querySelector("img")!;
  const foreignSrc = "data:image/png;base64,QQ==";
  img.setAttribute("src", foreignSrc);
  await act(async () => {
    img.dispatchEvent(new Event("error"));
  });

  expect(mocks.warn).not.toHaveBeenCalled();
  expect(renderedSrc()).toBe(foreignSrc);
});

test("preserves exact base64 across the non-aligned chunk boundary", async () => {
  const bytes = Array.from({ length: INDEPENDENT_CHUNK_SIZE * 2 + 1 }, (_, index) => index % 256);
  mocks.readEngineImage.mockResolvedValue({ bytes, mimeType: "image/png" });

  await act(async () => renderImage("chunked-image"));

  expect(renderedSrc()).toBe(`data:image/png;base64,${independentBase64(bytes)}`);
});

test("encodes a payload large enough to reject a naive spread", async () => {
  const bytes = Array.from({ length: 200_000 }, (_, index) => index % 256);
  mocks.readEngineImage.mockResolvedValue({ bytes, mimeType: "image/png" });

  await act(async () => renderImage("large-image"));

  expect(renderedSrc()).toBe(`data:image/png;base64,${independentBase64(bytes)}`);
});

test("uses the native MIME type in the data URL", async () => {
  const bytes = [255, 216, 255, 224, 0, 16];
  mocks.readEngineImage.mockResolvedValue({ bytes, mimeType: "image/jpeg" });

  await act(async () => renderImage("jpeg-image"));

  expect(renderedSrc()).toBe(`data:image/jpeg;base64,${independentBase64(bytes)}`);
});

test("keeps a settled image visible while a different image read is pending", async () => {
  const first = deferred<EngineImageData>();
  const second = deferred<EngineImageData>();
  const firstBytes = [1, 2, 3];
  const secondBytes = [4, 5, 6];
  mocks.readEngineImage.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);

  await act(async () => renderImage("first-image"));
  await act(async () => {
    first.resolve({ bytes: firstBytes, mimeType: "image/png" });
    await first.promise;
  });

  expect(renderedSrc()).toBe(`data:image/png;base64,${independentBase64(firstBytes)}`);

  await act(async () => renderImage("second-image"));

  expect(renderedSrc()).toBe(`data:image/png;base64,${independentBase64(firstBytes)}`);
  expect(mocks.warn).not.toHaveBeenCalled();

  await act(async () => {
    second.resolve({ bytes: secondBytes, mimeType: "image/png" });
    await second.promise;
  });

  expect(renderedSrc()).toBe(`data:image/png;base64,${independentBase64(secondBytes)}`);
});

test("clears a stale image and logs a normalized read failure", async () => {
  const bytes = [1, 2, 3];
  const failure = new Error("read failed at /private/engine-image.png");
  mocks.readEngineImage
    .mockResolvedValueOnce({ bytes, mimeType: "image/png" })
    .mockRejectedValueOnce(failure);

  await act(async () => renderImage("first-image"));
  expect(renderedSrc()).toContain("data:image/png;base64,");

  await act(async () => renderImage("second-image"));

  expect(renderedSrc()).toBeNull();
  expect(mocks.warn).toHaveBeenCalledTimes(1);
  expect(mocks.warn).toHaveBeenCalledWith("read failed at [path]");
});

test("never logs the persisted image id, including a UUID-shaped secret", async () => {
  const secret = "123e4567-e89b-12d3-a456-426614174000";
  mocks.readEngineImage.mockRejectedValue(new Error("read failed"));

  await act(async () => renderImage(secret));

  expect(mocks.warn).toHaveBeenCalledWith("read failed");
  for (const call of mocks.warn.mock.calls) {
    for (const argument of call) {
      expect(typeof argument === "string" ? argument.includes(secret) : false).toBe(false);
    }
  }
});

test("falls back to console with safe logger-failure context when image read and logger both reject", async () => {
  const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
  const secret = "123e4567-e89b-12d3-a456-426614174000";
  mocks.readEngineImage
    .mockResolvedValueOnce({ bytes: [1, 2, 3], mimeType: "image/png" })
    .mockRejectedValueOnce(new Error("read failed at /private/engine-image.png"));
  mocks.warn.mockRejectedValueOnce(new Error("logger failed at /private/logger.log token=secret"));

  await act(async () => renderImage("first-image"));
  expect(renderedSrc()).toContain("data:image/png;base64,");
  await act(async () => renderImage(secret));

  expect(renderedSrc()).toBeNull();
  expect(mocks.warn).toHaveBeenCalledExactlyOnceWith("read failed at [path]");
  expect(consoleWarn).toHaveBeenCalledExactlyOnceWith("read failed at [path]", {
    loggerFailure: {
      category: "unexpected",
      message: "logger failed at [path] token=[redacted]",
    },
  });
  expect(JSON.stringify(consoleWarn.mock.calls)).not.toContain(secret);
});

async function settleSecondRead(secondBytes: number[]) {
  const first = deferred<EngineImageData>();
  const second = deferred<EngineImageData>();
  mocks.readEngineImage.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);

  await act(async () => renderImage("first-image"));
  await act(async () => renderImage("second-image"));

  await act(async () => {
    second.resolve({ bytes: secondBytes, mimeType: "image/png" });
    await second.promise;
  });
  const secondSrc = `data:image/png;base64,${independentBase64(secondBytes)}`;
  expect(renderedSrc()).toBe(secondSrc);

  return { first, secondSrc };
}

test("ignores a stale successful read", async () => {
  const { first, secondSrc } = await settleSecondRead([4, 5, 6]);

  const firstBytes = [7, 8, 9];
  await act(async () => {
    first.resolve({ bytes: firstBytes, mimeType: "image/png" });
    await first.promise;
  });

  expect(renderedSrc()).toBe(secondSrc);
});

test("ignores a stale rejected read", async () => {
  const { first, secondSrc } = await settleSecondRead([10, 11, 12]);

  await act(async () => {
    first.reject(new Error("stale read failed"));
    await first.promise.catch(() => undefined);
  });

  expect(renderedSrc()).toBe(secondSrc);
  expect(mocks.warn).not.toHaveBeenCalled();
});
