import { Badge, type BadgeProps } from "@mantine/core";
import type { ReactNode } from "react";

export const wrappingButton = {
  root: { height: "auto", minHeight: "var(--button-height)", minWidth: 0, maxWidth: "100%" },
  label: { whiteSpace: "normal", overflowWrap: "anywhere", minWidth: 0 },
} as const;
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
