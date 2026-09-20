import { Image, type ImageProps } from "@mantine/core";
import { useEffect, useState } from "react";
import type { EngineImageHandle } from "@/bindings";
import { normalizeError } from "@/platform/errors";
import { warn } from "@/platform/native";
import { tauri } from "@/platform/tauri";

// 8192 is deliberately not a multiple of 3: a 3-aligned chunk (for example, 8190) makes
// per-chunk btoa output byte-identical, hiding that regression from output-based tests. An
// invariant enforced by a red test beats one preserved by a coincidence that hides the mistake.
// The naive btoa(String.fromCharCode(...bytes)) dies on a large image via stack depth; roughly
// 100,000 arguments worked in measurement while 200,000 threw RangeError: Maximum call stack size
// exceeded, and the exact boundary is not stable.
const BINARY_CHUNK_SIZE = 8192;

function toDataUrl(bytes: number[], mimeType: string): string {
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += BINARY_CHUNK_SIZE) {
    binary += String.fromCharCode(...bytes.slice(offset, offset + BINARY_CHUNK_SIZE));
  }
  return `data:${mimeType};base64,${btoa(binary)}`;
}

/** Displays a native-managed engine image without ever receiving a file path. */
function LocalImage({ image, ...props }: ImageProps & { image: EngineImageHandle; alt?: string }) {
  const [src, setSrc] = useState<string>();
  const key = image.id.id;

  useEffect(() => {
    let cancelled = false;
    void tauri
      .readEngineImage(image)
      .then(({ bytes, mimeType }) => {
        if (cancelled) return;
        setSrc(toDataUrl(bytes, mimeType));
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setSrc(undefined);
          void warn(normalizeError(error).message).catch(() => undefined);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [image, key]);

  return <Image {...props} src={src} />;
}

export default LocalImage;
