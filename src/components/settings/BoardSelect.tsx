import { Box, Group, Text } from "@mantine/core";
import { useAtom } from "jotai";
import { useTranslation } from "react-i18next";
import { boardImageAtom } from "@/state/atoms";
import { SettingsCombobox } from "./SettingsCombobox";

const boardImages: string[] = [
  "blue.png",
  "blue2.jpg",
  "blue3.jpg",
  "blue-marble.jpg",
  "canvas2.jpg",
  "wood.jpg",
  "wood2.jpg",
  "wood3.jpg",
  "wood4.jpg",
  "maple.jpg",
  "maple2.jpg",
  "leather.jpg",
  "green.png",
  "brown.png",
  "pink-pyramid.png",
  "marble.jpg",
  "green-plastic.png",
  "grey.jpg",
  "metal.jpg",
  "olive.jpg",
  "newspaper.svg",
  "purple.png",
  "purple-diag.png",
  "ic.png",
  "horsey.jpg",
  "gray.svg",
];

function SelectOption({ label }: { label: string }) {
  let image = label;
  if (!label.endsWith(".svg")) {
    image = label.replace(".", ".thumbnail.");
  }

  return (
    <Group wrap="nowrap">
      <Box
        style={{
          width: "64px",
          height: "32px",
          backgroundImage: `url(/board/${image})`,
          flexShrink: 0,
          backgroundSize: label.endsWith(".svg") ? "256px" : undefined,
        }}
      />
      <Text fz="sm" fw={500}>
        {label.split(".")[0]}
      </Text>
    </Group>
  );
}

export default function BoardSelect() {
  const { t } = useTranslation();
  const [board, setBoard] = useAtom(boardImageAtom);

  return (
    <SettingsCombobox
      ariaLabel={t("Settings.Appearance.BoardImage")}
      value={board}
      data={boardImages.map((item) => ({
        value: item,
        label: <SelectOption label={item} />,
        preview: <SelectOption label={item} />,
      }))}
      onCommit={setBoard}
    />
  );
}
