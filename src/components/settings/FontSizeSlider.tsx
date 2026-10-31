import { useTranslation } from "react-i18next";
import { fontSizeAtom } from "@/state/atoms";
import { FONT_SCALE_MAX, FONT_SCALE_MIN, FONT_SCALE_STEP } from "@/state/fontScale";
import PercentagePreferenceSlider from "./PercentagePreferenceSlider";

const FONT_SIZE_MARKS = [50, 100, 150, 200];

export default function FontSizeSlider() {
  const { t } = useTranslation();

  return (
    <PercentagePreferenceSlider
      atom={fontSizeAtom}
      min={FONT_SCALE_MIN}
      max={FONT_SCALE_MAX}
      step={FONT_SCALE_STEP}
      marks={FONT_SIZE_MARKS}
      thumbLabel={t("Settings.Appearance.FontSize")}
    />
  );
}
