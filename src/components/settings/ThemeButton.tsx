import {
  Box,
  Center,
  type MantineColorScheme,
  SegmentedControl,
  useMantineColorScheme,
} from "@mantine/core";
import { Monitor, Moon, Sun } from "lucide-react";
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
                <Monitor size="1rem" strokeWidth={2} />
                <Box ml={10}>{t("Settings.Appearance.Theme.Auto")}</Box>
              </Center>
            ),
          },
          {
            value: "light",
            label: (
              <Center>
                <Sun size="1rem" strokeWidth={2} />
                <Box ml={10}>{t("Settings.Appearance.Theme.Light")}</Box>
              </Center>
            ),
          },
          {
            value: "dark",
            label: (
              <Center>
                <Moon size="1rem" strokeWidth={2} />
                <Box ml={10}>{t("Settings.Appearance.Theme.Dark")}</Box>
              </Center>
            ),
          },
        ]}
      />
    </Box>
  );
}
