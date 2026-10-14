import { Slider } from "@mantine/core";
import { useAtom } from "jotai";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { fontSizeAtom } from "@/state/atoms";
import { FONT_SCALE_MAX, FONT_SCALE_MIN, FONT_SCALE_STEP } from "@/state/fontScale";

export default function FontSizeSlider() {
  const { t } = useTranslation();
  const [fontSize, setFontSize] = useAtom(fontSizeAtom);
  const [tempFontSize, setTempFontSize] = useState(fontSize);

  useEffect(() => {
    setTempFontSize(fontSize);
  }, [fontSize]);

  return (
    <Slider
      thumbLabel={t("Settings.Appearance.FontSize")}
      min={FONT_SCALE_MIN}
      max={FONT_SCALE_MAX}
      step={FONT_SCALE_STEP}
      value={tempFontSize}
      w="15rem"
      maw="100%"
      onChange={(value) => {
        setTempFontSize(value as number);
      }}
      onChangeEnd={setFontSize}
      marks={["50%", "100%", "150%", "200%"].map((label) => ({
        value: Number.parseInt(label),
        label,
      }))}
    />
  );
}
