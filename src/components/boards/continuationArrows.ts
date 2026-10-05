import type { DrawBrushes, DrawShape } from "@lichess-org/chessground/draw";
import { defaults } from "@lichess-org/chessground/state";
import { makeSquare, type NormalMove } from "chessops";
import type { VariationChoice } from "@/state/store/variationChooser";
import type { TreeNode } from "@/utils/treeReducer";

export const continuationBrushes: DrawBrushes = {
    ...defaults().drawable.brushes,
    variation: { key: "v", color: "#9b59b6", opacity: 0.8, lineWidth: 10 },
    continuationSelected: { key: "cs", color: "#9b59b6", opacity: 1, lineWidth: 11 },
    continuationOther: { key: "co", color: "#9b59b6", opacity: 0.25, lineWidth: 7.5 },
};

export function childMoveArrow(
    child: TreeNode,
    brush: string,
    lineWidth?: number,
): DrawShape | null {
    if (!child.move) return null;
    const move = child.move as NormalMove;
    return {
        orig: makeSquare(move.from),
        dest: makeSquare(move.to),
        brush,
        ...(lineWidth === undefined ? {} : { modifiers: { lineWidth } }),
    };
}

export function chooserArrows(choice: VariationChoice): DrawShape[] {
    return choice
        ? choice.children.flatMap((child, index) => {
              const arrow = childMoveArrow(
                  child,
                  index === choice.selected ? "continuationSelected" : "continuationOther",
              );
              return arrow ? [arrow] : [];
          })
        : [];
}
