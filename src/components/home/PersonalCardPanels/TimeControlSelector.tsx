import { Select } from "@mantine/core";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

const LICHESS_TIME_CONTROLS = [
  { value: "ultra_bullet", labelKey: "TimeControl.UltraBullet" },
  { value: "bullet", labelKey: "TimeControl.Bullet" },
  { value: "blitz", labelKey: "TimeControl.Blitz" },
  { value: "rapid", labelKey: "TimeControl.Rapid" },
  { value: "classical", labelKey: "TimeControl.Classical" },
  { value: "correspondence", labelKey: "TimeControl.Correspondence" },
];

const CHESSCOM_TIME_CONTROLS = [
  { value: "bullet", labelKey: "TimeControl.Bullet" },
  { value: "blitz", labelKey: "TimeControl.Blitz" },
  { value: "rapid", labelKey: "TimeControl.Rapid" },
  { value: "daily", labelKey: "TimeControl.Daily" },
];

interface TimeControlSelectorProps {
  onTimeControlChange: (value: string | null) => void;
  website: string | null;
  allowAll: boolean;
}

const TimeControlSelector = ({
  onTimeControlChange,
  website,
  allowAll,
}: TimeControlSelectorProps) => {
  const { t } = useTranslation();
  const timeControls = useMemo(
    () =>
      website === "Chess.com"
        ? [
            ...(allowAll ? [{ value: "any", label: t("Board.Database.Local.Result.Any") }] : []),
            ...CHESSCOM_TIME_CONTROLS.map((control) => ({
              ...control,
              label: t(control.labelKey),
            })),
          ]
        : [
            ...(allowAll ? [{ value: "any", label: t("Board.Database.Local.Result.Any") }] : []),
            ...LICHESS_TIME_CONTROLS.map((control) => ({
              ...control,
              label: t(control.labelKey),
            })),
          ],
    [allowAll, t, website],
  );

  const defaultTimeControl = allowAll ? "any" : "rapid";
  const [timeControl, setTimeControl] = useState<string | null>(defaultTimeControl);

  useEffect(() => {
    onTimeControlChange(timeControl);
  }, [onTimeControlChange, timeControl]);

  useEffect(() => {
    if (!timeControls.some((control) => control.value === timeControl)) {
      setTimeControl(defaultTimeControl);
    }
  }, [defaultTimeControl, timeControl, timeControls]);

  return (
    <Select
      pt="lg"
      label={t("Board.Database.TimeControl")}
      value={timeControl}
      onChange={(value) => setTimeControl(value)}
      data={timeControls}
      allowDeselect={false}
    />
  );
};

export default TimeControlSelector;
