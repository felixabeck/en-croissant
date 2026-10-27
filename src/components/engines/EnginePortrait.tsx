import { Image, type ImageProps, UnstyledButton } from "@mantine/core";
import { type ReactNode, useState } from "react";
import useSWRImmutable from "swr/immutable";
import { type Engine, loadDefaultEngineCatalog } from "@/utils/engines";
import LocalImage from "../common/LocalImage";

type EnginePortraitProps = {
  engine: Engine;
  imageProps?: ImageProps;
  fallback: ReactNode;
  selectImage?: { label: string; onClick: () => void };
};

export default function EnginePortrait(props: EnginePortraitProps) {
  const { engine } = props;
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
  return (
    <PortraitContent
      // A retired image can only fail its unmounted child, never the next portrait.
      key={engine.imageHandle ? "custom" : JSON.stringify([engine.id, downloadLink, imageUrl])}
      {...props}
      imageUrl={imageUrl}
    />
  );
}

function PortraitContent({
  engine,
  imageProps,
  fallback,
  selectImage,
  imageUrl,
}: EnginePortraitProps & { imageUrl?: string }) {
  const [failed, setFailed] = useState(false);
  const portrait = engine.imageHandle ? (
    <LocalImage {...imageProps} image={engine.imageHandle} alt={engine.name} />
  ) : imageUrl && !failed ? (
    <Image
      {...imageProps}
      src={imageUrl}
      alt={engine.name}
      onError={(event) => {
        setFailed(true);
        imageProps?.onError?.(event);
      }}
    />
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
