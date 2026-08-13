import { Group, Text } from "@mantine/core";
import { createContext, type ReactNode } from "react";
import classes from "./SettingsPage.module.css";

export const SettingLabelContext = createContext<string | undefined>(undefined);

export function SettingRow({
  title,
  description,
  children,
  highlight = false,
}: {
  title: string;
  description: string;
  children: ReactNode;
  highlight?: boolean;
}) {
  return (
    <Group
      justify="space-between"
      gap="xl"
      className={classes.item}
      data-highlighted={highlight || undefined}
    >
      <div className={classes.settingCopy}>
        <Text>{title}</Text>
        <Text size="xs" c="dimmed">
          {description}
        </Text>
      </div>
      <div className={classes.settingControl} aria-label={title}>
        <SettingLabelContext.Provider value={title}>{children}</SettingLabelContext.Provider>
      </div>
    </Group>
  );
}
