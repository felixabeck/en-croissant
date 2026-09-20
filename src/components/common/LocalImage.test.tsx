import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import type { EngineImageHandle } from "@/bindings";

const mocks = vi.hoisted(() => ({
  readEngineImage: vi.fn(),
  warn: vi.fn(),
  logError: vi.fn(),
}));

vi.mock("@mantine/core", () => ({
  Image: ({ ...props }: React.ImgHTMLAttributes<HTMLImageElement>) => <img {...props} />,
}));
vi.mock("@/platform/tauri", () => ({ tauri: { readEngineImage: mocks.readEngineImage } }));
vi.mock("@/platform/native", () => ({
  error: mocks.logError,
  warn: mocks.warn,
}));

import LocalImage from "./LocalImage";

type ImageData = { bytes: number[]; mimeType: string };

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
});

test("renders a resolved PNG as an independently encoded data URL", async () => {
  const bytes = [0, 1, 2, 250, 251, 252];
  mocks.readEngineImage.mockResolvedValue({ bytes, mimeType: "image/png" });

  await act(async () => renderImage("png-image"));

  expect(renderedSrc()).toBe(`data:image/png;base64,${independentBase64(bytes)}`);
});

test("preserves exact base64 across the non-aligned chunk boundary", async () => {
  const bytes = Array.from({ length: 8192 * 2 + 1 }, (_, index) => index % 256);
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

test("swallows a logger rejection", async () => {
  mocks.readEngineImage.mockRejectedValue(new Error("read failed"));
  let catchAttached = false;
  mocks.warn.mockImplementationOnce(() => {
    const rejection = Promise.reject(new Error("Tauri logger unavailable"));
    const originalCatch = rejection.catch.bind(rejection);
    rejection.catch = ((onRejected) => {
      catchAttached = true;
      return originalCatch(onRejected);
    }) as typeof rejection.catch;
    return rejection;
  });

  await act(async () => renderImage("logger-test"));
  await new Promise((resolve) => setTimeout(resolve, 0));

  expect(catchAttached).toBe(true);
  expect(mocks.warn).toHaveBeenCalledTimes(1);
});

test("ignores a stale successful read", async () => {
  const first = deferred<ImageData>();
  const second = deferred<ImageData>();
  mocks.readEngineImage.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);

  await act(async () => renderImage("first-image"));
  await act(async () => renderImage("second-image"));

  const secondBytes = [4, 5, 6];
  await act(async () => {
    second.resolve({ bytes: secondBytes, mimeType: "image/png" });
    await second.promise;
  });
  const secondSrc = `data:image/png;base64,${independentBase64(secondBytes)}`;
  expect(renderedSrc()).toBe(secondSrc);

  const firstBytes = [7, 8, 9];
  await act(async () => {
    first.resolve({ bytes: firstBytes, mimeType: "image/png" });
    await first.promise;
  });

  expect(renderedSrc()).toBe(secondSrc);
});

test("ignores a stale rejected read", async () => {
  const first = deferred<ImageData>();
  const second = deferred<ImageData>();
  mocks.readEngineImage.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);

  await act(async () => renderImage("first-image"));
  await act(async () => renderImage("second-image"));

  const secondBytes = [10, 11, 12];
  await act(async () => {
    second.resolve({ bytes: secondBytes, mimeType: "image/png" });
    await second.promise;
  });
  const secondSrc = `data:image/png;base64,${independentBase64(secondBytes)}`;
  expect(renderedSrc()).toBe(secondSrc);

  await act(async () => {
    first.reject(new Error("stale read failed"));
    await first.promise.catch(() => undefined);
  });

  expect(renderedSrc()).toBe(secondSrc);
  expect(mocks.warn).not.toHaveBeenCalled();
});
