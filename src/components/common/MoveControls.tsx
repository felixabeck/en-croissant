import { Group, Popover, Stack, Text, UnstyledButton } from "@mantine/core";
import {
  IconChevronLeft,
  IconChevronRight,
  IconChevronsLeft,
  IconChevronsRight,
} from "@tabler/icons-react";
import { useAtomValue } from "jotai";
import { memo, useContext, useState } from "react";
import { useHotkeys } from "react-hotkeys-hook";
import { useTranslation } from "react-i18next";
import { useStore } from "zustand";
import { chooseVariationAtom } from "@/state/atoms";
import { keyMapAtom } from "@/state/keybinds";
import { formatMoveNumber } from "@/utils/format";
import type { TreeNode } from "@/utils/treeReducer";
import { TreeStateContext } from "./TreeStateContext";
import IconAction from "./IconAction";

function MoveControls({ readOnly }: { readOnly?: boolean }) {
  const store = useContext(TreeStateContext)!;
  const { t } = useTranslation();
  const goToNext = useStore(store, (s) => s.goToNext);
  const goToChild = useStore(store, (s) => s.goToChild);
  const goToPrevious = useStore(store, (s) => s.goToPrevious);
  const start = useStore(store, (s) => s.goToStart);
  const end = useStore(store, (s) => s.goToEnd);
  const deleteMove = useStore(store, (s) => s.deleteMove);
  const startBranch = useStore(store, (s) => s.goToBranchStart);
  const endBranch = useStore(store, (s) => s.goToBranchEnd);
  const nextBranch = useStore(store, (s) => s.nextBranch);
  const previousBranch = useStore(store, (s) => s.previousBranch);
  const nextBranching = useStore(store, (s) => s.nextBranching);
  const previousBranching = useStore(store, (s) => s.previousBranching);
  const currentNode = useStore(store, (s) => s.currentNode());
  const practicing = useStore(store, (s) => s.practicePath !== null);
  const chooseVariation = useAtomValue(chooseVariationAtom);

  // A choice belongs to the node it was opened at: any other navigation, or an edit that replaces
  // that node (and so its children), abandons it without an effect having to notice.
  const [choice, setChoice] = useState<{ node: TreeNode; selected: number } | null>(null);
  const open = choice !== null && choice.node === currentNode ? choice : null;
  const continuations = open ? currentNode.children : [];

  const next = () => {
    if (open) {
      setChoice(null);
      goToChild(open.selected);
    } else if (chooseVariation && !practicing && currentNode.children.length > 1) {
      setChoice({ node: currentNode, selected: 0 });
    } else {
      goToNext();
    }
  };
  const previous = () => (open ? setChoice(null) : goToPrevious());
  const select = (step: number) =>
    open &&
    setChoice({
      node: open.node,
      selected: (open.selected + step + continuations.length) % continuations.length,
    });

  const keyMap = useAtomValue(keyMapAtom);
  useHotkeys(keyMap.PREVIOUS_MOVE.keys, previous);
  useHotkeys(keyMap.NEXT_MOVE.keys, next);
  useHotkeys(keyMap.GO_TO_START.keys, start);
  useHotkeys(keyMap.GO_TO_END.keys, end);
  useHotkeys(keyMap.DELETE_MOVE.keys, readOnly ? () => {} : () => deleteMove());
  // While the list is open the arrow keys move its selection, whatever the branch keys are bound to.
  useHotkeys(keyMap.GO_TO_BRANCH_START.keys, () => open || startBranch());
  useHotkeys(keyMap.GO_TO_BRANCH_END.keys, () => open || endBranch());
  useHotkeys("arrowup", () => select(-1), { enabled: open !== null, preventDefault: true });
  useHotkeys("arrowdown", () => select(1), { enabled: open !== null, preventDefault: true });
  useHotkeys("escape", () => setChoice(null), { enabled: open !== null });
  useHotkeys(keyMap.NEXT_BRANCH.keys, nextBranch);
  useHotkeys(keyMap.PREVIOUS_BRANCH.keys, previousBranch);
  useHotkeys(keyMap.NEXT_BRANCHING.keys, nextBranching);
  useHotkeys(keyMap.PREVIOUS_BRANCHING.keys, previousBranching);

  return (
    <Popover
      opened={open !== null}
      onClose={() => setChoice(null)}
      position="top"
      withArrow
      shadow="md"
      returnFocus={false}
      // The dropdown is a listbox of its own; dialog roles on the button row fail aria-allowed-attr.
      withRoles={false}
    >
      <Popover.Target>
        <Group grow gap="xs">
          <IconAction
            label={t("Common.MoveControls.GoToStart", { defaultValue: "Go to start" })}
            variant="default"
            size="lg"
            onClick={start}
          >
            <IconChevronsLeft />
          </IconAction>
          <IconAction
            label={t("Common.MoveControls.Previous", { defaultValue: "Previous move" })}
            variant="default"
            size="lg"
            onClick={previous}
          >
            <IconChevronLeft />
          </IconAction>
          <IconAction
            label={t("Common.MoveControls.Next", { defaultValue: "Next move" })}
            variant="default"
            size="lg"
            onClick={next}
          >
            <IconChevronRight />
          </IconAction>
          <IconAction
            label={t("Common.MoveControls.GoToEnd", { defaultValue: "Go to end" })}
            variant="default"
            size="lg"
            onClick={end}
          >
            <IconChevronsRight />
          </IconAction>
        </Group>
      </Popover.Target>
      <Popover.Dropdown p={4}>
        <Stack
          gap={2}
          role="listbox"
          aria-label={t("Common.MoveControls.ChooseVariation", {
            defaultValue: "Choose a continuation",
          })}
        >
          {continuations.map((child, index) => (
            <UnstyledButton
              key={index}
              role="option"
              aria-selected={index === open?.selected}
              tabIndex={-1}
              px="sm"
              py={4}
              bg={index === open?.selected ? "var(--mantine-primary-color-light)" : undefined}
              style={{ borderRadius: "var(--mantine-radius-sm)" }}
              onMouseEnter={() => open && setChoice({ node: open.node, selected: index })}
              onClick={() => {
                setChoice(null);
                goToChild(index);
              }}
            >
              <Text component="span" size="sm" fw={index === 0 ? 600 : undefined}>
                {formatMoveNumber(child.halfMoves)} {child.san}
              </Text>
            </UnstyledButton>
          ))}
        </Stack>
        <Text size="xs" px="sm" pt={2}>
          {t("Common.MoveControls.ChooseVariationHint", {
            defaultValue: "↑ ↓ choose · → play · ← close",
          })}
        </Text>
      </Popover.Dropdown>
    </Popover>
  );
}

export default memo(MoveControls);
