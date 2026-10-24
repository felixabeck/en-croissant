import { Image, type ImageProps } from "@mantine/core";
import { type SyntheticEvent, useEffect, useRef, useState } from "react";
import type { EngineImageHandle } from "@/bindings";
import { normalizeError, warnSafely } from "@/platform/errors";
import { tauri } from "@/platform/tauri";

// 8192 is deliberately not a multiple of 3: a 3-aligned chunk (for example, 8190) makes
// per-chunk btoa output byte-identical, hiding that regression from output-based tests. An
// invariant enforced by a red test beats one preserved by a coincidence that hides the mistake.
// The naive btoa(String.fromCharCode(...bytes)) dies on a large image via stack depth; roughly
// 100,000 arguments worked in measurement while 200,000 threw RangeError: Maximum call stack size
// exceeded, and the exact boundary is not stable.
const BINARY_CHUNK_SIZE = 8192;
const DECODE_FAILURE_MESSAGE = "engine image failed to decode";

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
  const srcRef = useRef<string | undefined>(undefined);
  const key = image.id.id;

  useEffect(() => {
    let cancelled = false;
    void tauri
      .readEngineImage({ id: { id: key }, kind: "engineImage" })
      .then(({ bytes, mimeType }) => {
        if (cancelled) return;
        const nextSrc = toDataUrl(bytes, mimeType);
        srcRef.current = nextSrc;
        setSrc(nextSrc);
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          srcRef.current = undefined;
          setSrc(undefined);
          warnSafely(normalizeError(error).message);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [key]);

  function onDecodeError(event: SyntheticEvent<HTMLImageElement>) {
    const failedSrc = event.currentTarget.getAttribute("src");
    if (!failedSrc || failedSrc !== srcRef.current) return;
    srcRef.current = undefined;
    setSrc(undefined);
    warnSafely(DECODE_FAILURE_MESSAGE);
  }

  return <Image {...props} onError={onDecodeError} src={src} />;
}

export default LocalImage;
