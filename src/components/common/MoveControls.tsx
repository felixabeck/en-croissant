import { Group, Popover, Stack, Text, UnstyledButton } from "@mantine/core";
import {
  IconChevronLeft,
  IconChevronRight,
  IconChevronsLeft,
  IconChevronsRight,
} from "@tabler/icons-react";
import { useAtomValue } from "jotai";
import { memo, useContext, useEffect, useState } from "react";
import { useHotkeys } from "react-hotkeys-hook";
import { useTranslation } from "react-i18next";
import { useStore } from "zustand";
import { chooseVariationAtom } from "@/state/atoms";
import { keyMapAtom } from "@/state/keybinds";
import { nextContinuation } from "@/state/store/tree";
import { formatMoveNumber } from "@/utils/format";
import type { TreeNode } from "@/utils/treeReducer";
import { TreeStateContext } from "./TreeStateContext";
import IconAction from "./IconAction";

function isBareVerticalArrow(event: KeyboardEvent) {
  return (
    (event.key === "ArrowUp" || event.key === "ArrowDown") &&
    !event.ctrlKey &&
    !event.shiftKey &&
    !event.altKey &&
    !event.metaKey
  );
}

function MoveControls({ readOnly }: { readOnly?: boolean }) {
  const store = useContext(TreeStateContext)!;
  const { t } = useTranslation();
  const goToNext = useStore(store, (s) => s.goToNext);
  const goToContinuation = useStore(store, (s) => s.goToContinuation);
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
  const chooseVariation = useAtomValue(chooseVariationAtom);

  const [choice, setChoice] = useState<{
    children: TreeNode[];
    selected: number;
  } | null>(null);

  useEffect(
    () =>
      store.subscribe((state, previous) => {
        if (state.position !== previous.position || state.root !== previous.root) setChoice(null);
      }),
    [store],
  );

  const navigate = (action: () => void) => () => {
    setChoice(null);
    action();
  };
  const branchNavigation = (action: () => void) => (event: KeyboardEvent) => {
    if (choice && isBareVerticalArrow(event)) return;
    navigate(action)();
  };

  const next = () => {
    if (choice) {
      setChoice(null);
      goToContinuation(choice.selected);
    } else {
      const state = store.getState();
      const c = nextContinuation(state);
      if (chooseVariation && state.practicePath === null && c && c.children.length > 1) {
        setChoice({ children: c.children, selected: 0 });
      } else {
        goToNext();
      }
    }
  };
  const previous = () => (choice ? setChoice(null) : goToPrevious());
  const select = (step: number) =>
    choice &&
    setChoice({
      ...choice,
      selected: (choice.selected + step + choice.children.length) % choice.children.length,
    });

  const keyMap = useAtomValue(keyMapAtom);
  useHotkeys(keyMap.PREVIOUS_MOVE.keys, previous);
  useHotkeys(keyMap.NEXT_MOVE.keys, next);
  useHotkeys(keyMap.GO_TO_START.keys, navigate(start));
  useHotkeys(keyMap.GO_TO_END.keys, navigate(end));
  useHotkeys(keyMap.DELETE_MOVE.keys, navigate(readOnly ? () => {} : () => deleteMove()));
  // While the list is open, only bare ArrowUp/ArrowDown select, whatever the branch key bindings.
  useHotkeys(keyMap.GO_TO_BRANCH_START.keys, branchNavigation(startBranch));
  useHotkeys(keyMap.GO_TO_BRANCH_END.keys, branchNavigation(endBranch));
  useHotkeys("arrowup", () => select(-1), { enabled: choice !== null, preventDefault: true });
  useHotkeys("arrowdown", () => select(1), { enabled: choice !== null, preventDefault: true });
  useHotkeys("escape", () => setChoice(null), { enabled: choice !== null });
  useHotkeys(keyMap.NEXT_BRANCH.keys, navigate(nextBranch));
  useHotkeys(keyMap.PREVIOUS_BRANCH.keys, navigate(previousBranch));
  useHotkeys(keyMap.NEXT_BRANCHING.keys, navigate(nextBranching));
  useHotkeys(keyMap.PREVIOUS_BRANCHING.keys, navigate(previousBranching));

  return (
    <Popover
      opened={choice !== null}
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
            onClick={navigate(start)}
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
            onClick={navigate(end)}
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
          {choice?.children.map((child, index) => (
            <UnstyledButton
              key={index}
              role="option"
              aria-selected={index === choice.selected}
              tabIndex={-1}
              px="sm"
              py={4}
              bg={index === choice.selected ? "var(--mantine-primary-color-light)" : undefined}
              style={{ borderRadius: "var(--mantine-radius-sm)" }}
              onMouseEnter={() => setChoice({ ...choice, selected: index })}
              onClick={() => {
                setChoice(null);
                goToContinuation(index);
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
