import {
  CheckIcon,
  ColorSwatch,
  Group,
  Input,
  useComputedColorScheme,
  useMantineTheme,
} from "@mantine/core";
import { useAtom } from "jotai";
import { primaryColorAtom } from "@/state/atoms";
import { useTranslation } from "react-i18next";

export default function ColorControl() {
  const { t } = useTranslation();
  const [primaryColor, setPrimaryColor] = useAtom(primaryColorAtom);
  const theme = useMantineTheme();
  // Mantine's own scheme, not the OS preference: `useColorScheme` from @mantine/hooks reads
  // prefers-color-scheme and ignores the in-app Theme setting, so a dark app on a light
  // desktop resolved to "light" here.
  const colorScheme = useComputedColorScheme("dark");
  const colorLabels = {
    dark: t("Settings.Appearance.AccentColor.dark"),
    gray: t("Settings.Appearance.AccentColor.gray"),
    red: t("Settings.Appearance.AccentColor.red"),
    pink: t("Settings.Appearance.AccentColor.pink"),
    grape: t("Settings.Appearance.AccentColor.grape"),
    violet: t("Settings.Appearance.AccentColor.violet"),
    indigo: t("Settings.Appearance.AccentColor.indigo"),
    blue: t("Settings.Appearance.AccentColor.blue"),
    cyan: t("Settings.Appearance.AccentColor.cyan"),
    teal: t("Settings.Appearance.AccentColor.teal"),
    green: t("Settings.Appearance.AccentColor.green"),
    lime: t("Settings.Appearance.AccentColor.lime"),
    yellow: t("Settings.Appearance.AccentColor.yellow"),
    orange: t("Settings.Appearance.AccentColor.orange"),
  };

  const colorSwatches = Object.entries(colorLabels).map(([color, colorLabel]) => (
    <ColorSwatch
      color={colorScheme === "dark" ? theme.colors[color][7] : theme.colors[color][5]}
      component="button"
      key={color}
      role="radio"
      aria-label={t("Settings.Appearance.AccentColor.Value", {
        color: colorLabel,
      })}
      aria-checked={primaryColor === color}
      onClick={() => setPrimaryColor(color)}
      radius="sm"
      style={{
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: colorScheme === "dark" ? theme.colors[color][2] : theme.white,
        flex: "1 0 calc(15% - 4px)",
      }}
    >
      {primaryColor === color && <CheckIcon width={12} height={12} />}
    </ColorSwatch>
  ));

  return (
    <Input.Wrapper label={t("Settings.Appearance.AccentColor")}>
      <Group gap={2} role="radiogroup" aria-label={t("Settings.Appearance.AccentColor")}>
        {colorSwatches}
      </Group>
    </Input.Wrapper>
  );
}
