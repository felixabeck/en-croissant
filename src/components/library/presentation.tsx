import { wrappingButton } from "@/components/common/wrappingButton";
import { Badge, type BadgeProps } from "@mantine/core";
import type { ReactNode } from "react";

export const libraryButtonProps = { color: "blue.8", styles: wrappingButton } as const;

export function LibraryTypeBadge({
  children,
  size = "xs",
}: {
  children: ReactNode;
  size?: BadgeProps["size"];
}) {
  return (
    <Badge
      size={size}
      color="blue.9"
      maw="100%"
      styles={{
        root: { height: "auto" },
        label: { whiteSpace: "normal", overflowWrap: "anywhere" },
      }}
    >
      {children}
    </Badge>
  );
}
