import { Slider } from "@mantine/core";
import { type PrimitiveAtom, useAtom } from "jotai";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

export default function PercentagePreferenceSlider({
  atom,
  min,
  max,
  step,
  marks: markValues,
  thumbLabel,
}: {
  atom: PrimitiveAtom<number>;
  min: number;
  max: number;
  step: number;
  marks: readonly number[];
  thumbLabel: string;
}) {
  const { i18n } = useTranslation();
  const [value, setValue] = useAtom(atom);
  const [tempValue, setTempValue] = useState(value);

  useEffect(() => {
    setTempValue(value);
  }, [value]);

  // Percent shaping is locale-dependent (fr-FR writes "70 %"), so it comes from
  // Intl rather than from a hardcoded literal or a catalogue key.
  const marks = useMemo(() => {
    const percent = new Intl.NumberFormat(i18n.language, { style: "percent" });
    return markValues.map((mark) => ({ value: mark, label: percent.format(mark / 100) }));
  }, [i18n.language, markValues]);

  return (
    <Slider
      thumbLabel={thumbLabel}
      min={min}
      max={max}
      step={step}
      value={tempValue}
      w="15rem"
      maw="100%"
      onChange={(next) => {
        setTempValue(next as number);
      }}
      onChangeEnd={setValue}
      marks={marks}
    />
  );
}
