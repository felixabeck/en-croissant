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

  const colors = Object.keys(theme.colors).map((color) => (
    <ColorSwatch
      color={colorScheme === "dark" ? theme.colors[color][7] : theme.colors[color][5]}
      component="button"
      key={color}
      role="radio"
      aria-label={t("Settings.Appearance.AccentColor.Value", {
        color: t(`Settings.Appearance.AccentColor.${color}`),
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
        {colors}
      </Group>
    </Input.Wrapper>
  );
}
