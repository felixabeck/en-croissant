import {
  Box,
  Center,
  type MantineColorScheme,
  SegmentedControl,
  useMantineColorScheme,
} from "@mantine/core";
import { IconDeviceDesktop, IconMoon, IconSun } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";

export default function ThemeButton() {
  const { t } = useTranslation();

  const { colorScheme, setColorScheme } = useMantineColorScheme();

  return (
    <Box style={{ overflowX: "auto", maxWidth: "100%" }}>
      <SegmentedControl
        style={{ display: "flex", width: "max-content", marginInline: "auto" }}
        value={colorScheme}
        onChange={(value) => setColorScheme(value as MantineColorScheme)}
        data={[
          {
            value: "auto",
            label: (
              <Center>
                <IconDeviceDesktop size="1rem" stroke={1.5} />
                <Box ml={10}>{t("Settings.Appearance.Theme.Auto")}</Box>
              </Center>
            ),
          },
          {
            value: "light",
            label: (
              <Center>
                <IconSun size="1rem" stroke={1.5} />
                <Box ml={10}>{t("Settings.Appearance.Theme.Light")}</Box>
              </Center>
            ),
          },
          {
            value: "dark",
            label: (
              <Center>
                <IconMoon size="1rem" stroke={1.5} />
                <Box ml={10}>{t("Settings.Appearance.Theme.Dark")}</Box>
              </Center>
            ),
          },
        ]}
      />
    </Box>
  );
}
