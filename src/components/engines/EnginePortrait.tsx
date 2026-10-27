import { Image, type ImageProps, UnstyledButton } from "@mantine/core";
import type { ReactNode } from "react";
import useSWRImmutable from "swr/immutable";
import { type Engine, loadDefaultEngineCatalog } from "@/utils/engines";
import LocalImage from "../common/LocalImage";

export default function EnginePortrait({
  engine,
  imageProps,
  fallback,
  selectImage,
}: {
  engine: Engine;
  imageProps?: ImageProps;
  fallback: ReactNode;
  selectImage?: { label: string; onClick: () => void };
}) {
  const downloadLink = engine.type === "local" ? engine.downloadLink : null;
  const { data: catalog } = useSWRImmutable(
    !engine.imageHandle && downloadLink ? "installed-engine-portrait-catalog" : null,
    () => loadDefaultEngineCatalog(),
    { shouldRetryOnError: false },
  );
  // Derive from the current record, including while another selection's catalog load is pending.
  const imageUrl = downloadLink
    ? catalog?.find((entry) => entry.downloadLink === downloadLink)?.imageUrl
    : undefined;
  const portrait = engine.imageHandle ? (
    <LocalImage {...imageProps} image={engine.imageHandle} alt={engine.name} />
  ) : imageUrl ? (
    <Image {...imageProps} src={imageUrl} alt={engine.name} />
  ) : null;

  if (!portrait) return fallback;
  return selectImage ? (
    <UnstyledButton type="button" onClick={selectImage.onClick} aria-label={selectImage.label}>
      {portrait}
    </UnstyledButton>
  ) : (
    portrait
  );
}
