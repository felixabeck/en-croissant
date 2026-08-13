import { Group, Text } from "@mantine/core";
import { useAtom } from "jotai";
import { useTranslation } from "react-i18next";
import { soundCollectionAtom } from "@/state/atoms";
import { playSound } from "@/utils/sound";
import { SettingsCombobox } from "./SettingsCombobox";

type Item = {
  label: string;
  value: string;
};

const soundCollections: Item[] = [
  { label: "Futuristic", value: "futuristic" },
  { label: "Lisp", value: "lisp" },
  { label: "NES", value: "nes" },
  { label: "Piano", value: "piano" },
  { label: "Robot", value: "robot" },
  { label: "SFX", value: "sfx" },
  { label: "Standard", value: "standard" },
  { label: "WoodLand", value: "woodland" },
];

function SelectOption({ label }: { label: string }) {
  return (
    <Group wrap="nowrap">
      <Text fz="sm" fw={500}>
        {label}
      </Text>
    </Group>
  );
}

export default function SoundSelect() {
  const { t } = useTranslation();
  const [soundCollection, setSoundCollection] = useAtom(soundCollectionAtom);

  return (
    <SettingsCombobox
      ariaLabel={t("Settings.Sound.Collection")}
      value={soundCollection}
      width="10rem"
      withinPortal
      data={soundCollections.map((item) => ({
        value: item.value,
        label: <SelectOption label={item.label} />,
        preview: <SelectOption label={item.label} />,
      }))}
      onCommit={(next) => {
        setSoundCollection(next);
        playSound(false, false);
      }}
    />
  );
}
