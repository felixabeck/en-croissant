import { wrappingButton } from "@/components/common/wrappingButton";
import { Badge, Group, Text, type BadgeProps } from "@mantine/core";
import type { ReactNode } from "react";

export const libraryButtonProps = { color: "gold", styles: wrappingButton } as const;

export function LibrarySectionHeading({ children, count }: { children: ReactNode; count: number }) {
  return (
    <Group
      component="h2"
      m={0}
      px="xs"
      py="sm"
      justify="space-between"
      gap="xs"
      role="presentation"
    >
      <Text component="span" size="sm" fw={600}>
        {children}
      </Text>
      <Badge component="span" size="xs" color="gray">
        {count}
      </Badge>
    </Group>
  );
}

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
      color="gold"
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
