import { Box, Flex, Text } from "@mantine/core";
import { useAtom } from "jotai";
import { useTranslation } from "react-i18next";
import { pieceSetAtom } from "@/state/atoms";
import PieceComponent from "../common/Piece";
import { SettingsCombobox } from "./SettingsCombobox";

type Item = {
  label: string;
  value: string;
};

const pieceSets: Item[] = [
  { label: "Alpha", value: "alpha" },
  { label: "Anarcandy", value: "anarcandy" },
  { label: "California", value: "california" },
  { label: "Cardinal", value: "cardinal" },
  { label: "Cburnett", value: "cburnett" },
  { label: "Chess7", value: "chess7" },
  { label: "Chessnut", value: "chessnut" },
  { label: "Companion", value: "companion" },
  { label: "Disguised", value: "disguised" },
  { label: "Dubrovny", value: "dubrovny" },
  { label: "Fantasy", value: "fantasy" },
  { label: "Fresca", value: "fresca" },
  { label: "Gioco", value: "gioco" },
  { label: "Governor", value: "governor" },
  { label: "Horsey", value: "horsey" },
  { label: "ICpieces", value: "icpieces" },
  { label: "Kosal", value: "kosal" },
  { label: "Leipzig", value: "leipzig" },
  { label: "Letter", value: "letter" },
  { label: "Libra", value: "libra" },
  { label: "Maestro", value: "maestro" },
  { label: "Merida", value: "merida" },
  { label: "Pirouetti", value: "pirouetti" },
  { label: "Pixel", value: "pixel" },
  { label: "Reillycraig", value: "reillycraig" },
  { label: "Riohacha", value: "riohacha" },
  { label: "Shapes", value: "shapes" },
  { label: "Spatial", value: "spatial" },
  { label: "Staunty", value: "staunty" },
  { label: "Tatiana", value: "tatiana" },
];

function DisplayPieces() {
  const pieces = ["rook", "knight", "bishop", "queen", "king", "pawn"] as const;
  return (
    <Flex gap="xs">
      {pieces.map((role, index) => (
        <Box key={index} h="2.5rem" w="2.5rem">
          <PieceComponent piece={{ color: "white", role }} />
        </Box>
      ))}
    </Flex>
  );
}

export default function PiecesSelect() {
  const { t } = useTranslation();
  const [pieceSet, setPieceSet] = useAtom(pieceSetAtom);

  return (
    <Flex justify="space-between" align="center" gap="md" wrap="wrap">
      <DisplayPieces />
      <SettingsCombobox
        ariaLabel={t("Settings.Appearance.PieceSet")}
        value={pieceSet}
        width="10rem"
        data={pieceSets.map((item) => ({
          value: item.value,
          label: (
            <Text fz="sm" fw={500}>
              {item.label}
            </Text>
          ),
        }))}
        onPreview={setPieceSet}
        onCommit={setPieceSet}
      />
    </Flex>
  );
}
