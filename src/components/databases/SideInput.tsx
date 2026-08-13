import { Box, Menu, UnstyledButton } from "@mantine/core";
import { useTranslation } from "react-i18next";
import type { Sides } from "@/utils/db";
import classes from "./SideInput.module.css";

export function SideInput({
  role,
  sides,
  setSides,
}: {
  role: "player" | "opponent";
  sides: Sides;
  setSides: (val: Sides) => void;
}) {
  const { t } = useTranslation();
  const data = [
    { label: t("Fen.White"), color: "white" },
    { label: t("Fen.Black"), color: "black" },
    { label: t("Board.Database.Local.Result.Any"), color: "gray" },
  ];
  const selected =
    (sides === "WhiteBlack" && role === "player") || (sides === "BlackWhite" && role === "opponent")
      ? data[0]
      : sides === "Any"
        ? data[2]
        : data[1];
  const setSelected = (item: (typeof data)[number]) => {
    if (
      (item.color === "white" && role === "player") ||
      (item.color === "black" && role === "opponent")
    ) {
      setSides("WhiteBlack");
    } else if (item.color === "gray") {
      setSides("Any");
    } else {
      setSides("BlackWhite");
    }
  };
  const items = data.map((item) => (
    <Menu.Item
      leftSection={
        <Box
          style={{
            width: 18,
            height: 18,
            borderRadius: "50%",
            display: "inline-block",
            backgroundColor: item.color,
          }}
        />
      }
      onClick={() => setSelected(item)}
      key={item.label}
    >
      {item.label}
    </Menu.Item>
  ));

  return (
    <Menu>
      <Menu.Target>
        <UnstyledButton className={classes.control}>
          <Box
            style={{
              width: 18,
              height: 18,
              borderRadius: "50%",
              display: "inline-block",
              backgroundColor: selected.color,
            }}
          />
        </UnstyledButton>
      </Menu.Target>
      <Menu.Dropdown>{items}</Menu.Dropdown>
    </Menu>
  );
}
