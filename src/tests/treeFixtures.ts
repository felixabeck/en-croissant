import { parseUci } from "chessops";
import { createNode, type TreeNode } from "@/utils/treeReducer";

export function fixtureNode(
    san: string,
    {
        halfMoves = 1,
        children = [],
        fen = `${san} w - - 0 1`,
    }: { halfMoves?: number; children?: TreeNode[]; fen?: string } = {},
): TreeNode {
    const node = createNode({ fen, move: parseUci("e2e4")!, san, halfMoves });
    node.children = children;
    return node;
}
