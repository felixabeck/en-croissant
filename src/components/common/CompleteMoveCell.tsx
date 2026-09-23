import { Box, Menu, Portal, Text } from "@mantine/core";
import { useClickOutside } from "@mantine/hooks";
import {
  IconArrowsJoin,
  IconChevronsUp,
  IconChevronUp,
  IconCopy,
  IconFlag,
  IconX,
} from "@tabler/icons-react";
import equal from "fast-deep-equal";
import { useAtomValue } from "jotai";
import { memo, useContext, useMemo, useState, type MouseEvent } from "react";
import { useTranslation } from "react-i18next";
import Comment from "@/components/common/Comment";
import IconAction from "@/components/common/IconAction";
import { currentTabAtom } from "@/state/atoms";
import type { Annotation } from "@/utils/annotation";
import { hasMorePriority, stripClock } from "@/utils/chess";
import { getTabFile } from "@/utils/tabs";
import type { TreeNode } from "@/utils/treeReducer";
import type { NotationNodeIndex } from "./notationRows";
import { pathForNotationNode } from "./notationRows";
import MoveCell from "./MoveCell";
import { TreeStateContext } from "./TreeStateContext";

const transpositionCache = new WeakMap<TreeNode, Map<string, TreeNode[]>>();

function getTranspositionMap(root: TreeNode) {
  const cached = transpositionCache.get(root);
  if (cached) return cached;

  const map = new Map<string, TreeNode[]>();
  const stack: TreeNode[] = [root];
  while (stack.length > 0) {
    const node = stack.pop()!;
    const strippedFen = stripClock(node.fen);
    const matchingNodes = map.get(strippedFen);
    if (matchingNodes) matchingNodes.push(node);
    else map.set(strippedFen, [node]);
    for (let index = node.children.length - 1; index >= 0; index -= 1) {
      stack.push(node.children[index]);
    }
  }

  transpositionCache.set(root, map);
  return map;
}

function getTranspositions(
  fen: string,
  node: TreeNode,
  position: number[],
  root: TreeNode,
  index: NotationNodeIndex,
) {
  if (position.length === 0 || position.every((value) => value === 0)) return [];

  const matchingNodes = getTranspositionMap(root).get(stripClock(fen)) || [];
  const paths: number[][] = [];
  for (const targetNode of matchingNodes) {
    const targetPath = pathForNotationNode(index, targetNode);
    if (targetPath && targetNode !== node && !hasMorePriority(position, targetPath)) {
      paths.push(targetPath);
    }
  }
  return paths;
}

type CompleteMoveCellProps = {
  halfMoves: number;
  comment: string;
  annotations: Annotation[];
  showComments: boolean;
  move?: string | null;
  fen?: string;
  first?: boolean;
  node: TreeNode;
  nodeIndex: NotationNodeIndex;
  tableLayout?: boolean;
  scoreText?: string;
  isStart?: boolean;
  isCurrentVariation?: boolean;
  root: TreeNode;
};

function CompleteMoveCell({
  halfMoves,
  comment,
  annotations,
  showComments,
  move,
  fen,
  first,
  node,
  nodeIndex,
  tableLayout,
  scoreText,
  isStart: providedIsStart,
  isCurrentVariation: providedIsCurrentVariation,
  root,
}: CompleteMoveCellProps) {
  const store = useContext(TreeStateContext)!;
  const state = store.getState();
  const path = useMemo(() => pathForNotationNode(nodeIndex, node) ?? [], [node, nodeIndex]);
  const isCurrentVariation = providedIsCurrentVariation ?? node === state.currentNode();
  const isStart = providedIsStart ?? equal(path, state.headers.start || []);
  const transpositions = useMemo(
    () => (fen && nodeIndex && node ? getTranspositions(fen, node, path, root, nodeIndex) : []),
    [fen, node, nodeIndex, path, root],
  );
  const [open, setOpen] = useState(false);

  const moveNumber = Math.ceil(halfMoves / 2);
  const isWhite = halfMoves % 2 === 1;
  const hasNumber = !tableLayout && halfMoves > 0 && (first || isWhite);

  const onContextMenu = (event: MouseEvent) => {
    event.preventDefault();
    setOpen(true);
  };

  const rightAccessory =
    tableLayout && scoreText ? (
      <Text component="span" size="xs" c="dimmed">
        {scoreText}
      </Text>
    ) : undefined;

  const moveCell = move ? (
    <MoveCell
      move={move}
      annotations={annotations}
      isStart={isStart}
      isCurrentVariation={isCurrentVariation}
      onClick={() => store.getState().goToMove(path)}
      onContextMenu={onContextMenu}
      fullWidth={tableLayout}
      rightAccessory={rightAccessory}
    />
  ) : null;

  return (
    <>
      <Box
        component="span"
        style={{
          display: tableLayout ? "block" : "inline-block",
          marginLeft: hasNumber ? 6 : 0,
          fontSize: "80%",
          width: tableLayout ? "100%" : undefined,
        }}
      >
        {hasNumber && `${moveNumber.toString()}${isWhite ? "." : "..."}`}
        {open && move ? (
          <OpenMoveMenu
            store={store}
            path={path}
            move={move}
            annotations={annotations}
            isStart={isStart}
            isCurrentVariation={isCurrentVariation}
            fullWidth={tableLayout}
            rightAccessory={rightAccessory}
            onClose={() => setOpen(false)}
          />
        ) : (
          moveCell
        )}
        {transpositions.length > 0 && (
          <TranspositionAction onClick={() => store.getState().goToMove(transpositions[0])} />
        )}
      </Box>
      {showComments && !tableLayout && comment && <Comment comment={comment} />}
    </>
  );
}

function TranspositionAction({ onClick }: { onClick: () => void }) {
  const { t } = useTranslation();
  return (
    <IconAction
      label={t("Notation.Transposition", { defaultValue: "Transposition" })}
      size="xs"
      onClick={onClick}
    >
      <IconArrowsJoin size="0.875rem" />
    </IconAction>
  );
}

function OpenMoveMenu({
  store,
  path,
  move,
  annotations,
  isStart,
  isCurrentVariation,
  fullWidth,
  rightAccessory,
  onClose,
}: {
  store: NonNullable<React.ContextType<typeof TreeStateContext>>;
  path: number[];
  move: string;
  annotations: Annotation[];
  isStart: boolean;
  isCurrentVariation: boolean;
  fullWidth?: boolean;
  rightAccessory?: React.ReactNode;
  onClose: () => void;
}) {
  const ref = useClickOutside(onClose);
  const currentTab = useAtomValue(currentTabAtom);
  const tabFile = getTabFile(currentTab);
  const { t } = useTranslation();
  const actions = store.getState();

  return (
    <Menu opened width={200}>
      <Menu.Target>
        <MoveCell
          ref={ref}
          move={move}
          annotations={annotations}
          isStart={isStart}
          isCurrentVariation={isCurrentVariation}
          onClick={() => actions.goToMove(path)}
          onContextMenu={(event) => {
            event.preventDefault();
            onClose();
          }}
          fullWidth={fullWidth}
          rightAccessory={rightAccessory}
        />
      </Menu.Target>
      <Portal>
        <Menu.Dropdown>
          {tabFile?.metadata.type === "repertoire" && (
            <Menu.Item
              leftSection={<IconFlag size="0.875rem" />}
              onClick={() => {
                actions.setStart(path);
                onClose();
              }}
            >
              {t("Menu.MarkAsStart")}
            </Menu.Item>
          )}
          <Menu.Item
            leftSection={<IconChevronsUp size="0.875rem" />}
            onClick={() => {
              actions.promoteToMainline(path);
              onClose();
            }}
          >
            {t("Menu.PromoteToMainLine")}
          </Menu.Item>
          <Menu.Item
            leftSection={<IconChevronUp size="0.875rem" />}
            onClick={() => {
              actions.promoteVariation(path);
              onClose();
            }}
          >
            {t("Menu.PromoteVariation")}
          </Menu.Item>
          <Menu.Item
            leftSection={<IconCopy size="0.875rem" />}
            onClick={() => {
              actions.copyVariationPgn(path);
              onClose();
            }}
          >
            {t("Menu.CopyVariationPGN")}
          </Menu.Item>
          <Menu.Item
            color="red"
            leftSection={<IconX size="0.875rem" />}
            onClick={() => {
              actions.deleteMove(path);
              onClose();
            }}
          >
            {t("Menu.DeleteMove")}
          </Menu.Item>
        </Menu.Dropdown>
      </Portal>
    </Menu>
  );
}

export default memo(CompleteMoveCell, (prev, next) => {
  return (
    prev.node === next.node &&
    prev.move === next.move &&
    prev.fen === next.fen &&
    prev.comment === next.comment &&
    equal(prev.annotations, next.annotations) &&
    prev.showComments === next.showComments &&
    prev.first === next.first &&
    prev.root === next.root &&
    prev.nodeIndex === next.nodeIndex &&
    prev.halfMoves === next.halfMoves &&
    prev.tableLayout === next.tableLayout &&
    prev.scoreText === next.scoreText &&
    prev.isStart === next.isStart &&
    prev.isCurrentVariation === next.isCurrentVariation
  );
});
