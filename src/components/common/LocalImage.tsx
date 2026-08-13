import { Image, type ImageProps } from "@mantine/core";
import { useEffect, useState } from "react";
import type { EngineImageHandle } from "@/bindings";
import { tauri } from "@/platform/tauri";

/** Displays a native-managed engine image without ever receiving a file path. */
function LocalImage({ image, ...props }: ImageProps & { image: EngineImageHandle; alt?: string }) {
  const [src, setSrc] = useState<string>();
  const key = image.id.id;

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | undefined;
    void tauri
      .readEngineImage(image)
      .then(({ bytes, mimeType }) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: mimeType }));
        setSrc(objectUrl);
      })
      .catch(() => {
        if (!cancelled) setSrc(undefined);
      });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [image, key]);

  return <Image {...props} src={src} />;
}

export default LocalImage;
