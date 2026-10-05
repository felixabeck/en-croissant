import { Paper, Stack, Text, UnstyledButton } from "@mantine/core";
import { useContext, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { TreeStateContext, useVariationChooser } from "@/components/common/TreeStateContext";
import { formatMoveNumber } from "@/utils/format";
import classes from "@/components/boards/BoardFrame.module.css";

export default function VariationChooserCard() {
  const { t } = useTranslation();
  const tree = useContext(TreeStateContext)!;
  const { choice, selectIndex, close } = useVariationChooser();
  const rows = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const list = rows.current;
    const selected = list?.querySelector<HTMLElement>('[aria-selected="true"]');
    if (!list || !selected) return;
    // Scroll only the row list, leaving the board and its ancestors in place.
    if (selected.offsetTop < list.scrollTop) list.scrollTop = selected.offsetTop;
    else if (selected.offsetTop + selected.offsetHeight > list.scrollTop + list.clientHeight) {
      list.scrollTop = selected.offsetTop + selected.offsetHeight - list.clientHeight;
    }
  }, [choice]);

  if (!choice) return null;
  return (
    <Paper className={classes.card} p={4} shadow="md" withBorder>
      <Stack
        ref={rows}
        className={classes.rows}
        pos="relative"
        gap={2}
        role="listbox"
        tabIndex={0}
        aria-label={t("Common.MoveControls.ChooseVariation", {
          defaultValue: "Choose a continuation",
        })}
      >
        {choice.children.map((child, index) => (
          <UnstyledButton
            key={index}
            role="option"
            aria-selected={index === choice.selected}
            tabIndex={-1}
            px="sm"
            py={4}
            bg={index === choice.selected ? "var(--mantine-primary-color-light)" : undefined}
            style={{ borderRadius: "var(--mantine-radius-sm)", flexShrink: 0 }}
            onMouseEnter={() => selectIndex(index)}
            onClick={() => {
              close();
              tree.getState().goToContinuation(index);
            }}
          >
            <Text component="span" size="sm" fw={index === 0 ? 600 : undefined}>
              {formatMoveNumber(child.halfMoves)} {child.san}
            </Text>
          </UnstyledButton>
        ))}
      </Stack>
      <Text className={classes.hint} size="xs" px="sm" pt={2}>
        {t("Common.MoveControls.ChooseVariationHint", {
          defaultValue: "↑ ↓ choose · → play · ← close",
        })}
      </Text>
    </Paper>
  );
}
