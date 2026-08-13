import { Slider } from "@mantine/core";
import { useAtom } from "jotai";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { soundVolumeAtom } from "@/state/atoms";
import { playSound } from "@/utils/sound";

const MARK_PERCENTAGES = [20, 50, 80];

export default function VolumeSlider() {
  const { t, i18n } = useTranslation();
  const [volume, setVolume] = useAtom(soundVolumeAtom);
  const [tempVolume, setTempVolume] = useState(volume * 100);

  useEffect(() => {
    setTempVolume(volume * 100);
  }, [volume]);

  // Percent shaping is locale-dependent (fr-FR writes "20 %"), so it comes from
  // Intl rather than from a hardcoded literal or a catalogue key.
  const marks = useMemo(() => {
    const percent = new Intl.NumberFormat(i18n.language, { style: "percent" });
    return MARK_PERCENTAGES.map((value) => ({ value, label: percent.format(value / 100) }));
  }, [i18n.language]);

  return (
    <Slider
      thumbLabel={t("Settings.Sound.Volume")}
      min={0}
      max={100}
      marks={marks}
      w="15rem"
      value={tempVolume}
      onChange={(value) => {
        setTempVolume(value as number);
      }}
      onChangeEnd={(value) => {
        setVolume(value / 100);
        playSound(false, false);
      }}
    />
  );
}
