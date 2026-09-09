import { parseUci } from "chessops";
import { expect, test } from "vitest";
import { buildFromTree, syncDeck } from "./opening";
import { createNode, defaultTree, type TreeNode } from "@/utils/treeReducer";

function practiceNode(fen: string, answer: string): TreeNode {
    const position = createNode({
        fen,
        move: parseUci("e2e4")!,
        san: "e4",
        halfMoves: 2,
    });
    position.children.push(
        createNode({
            fen: `${answer} b - - 0 1`,
            move: parseUci("e7e5")!,
            san: answer,
            halfMoves: 3,
        }),
    );
    return position;
}

test("practice collapses clock-only transpositions but retains distinct positions", () => {
    const root = defaultTree().root;
    root.children.push(
        practiceNode("8/8/8/8/8/8/4P3/K6k w - - 0 12", "e5"),
        practiceNode("8/8/8/8/8/8/4P3/K6k w - - 47 99", "e6"),
        practiceNode("8/8/8/8/8/8/3P4/K6k w - - 0 12", "d5"),
    );

    const cards = buildFromTree(root, "white", []);

    expect(cards.map((card) => card.answer)).toEqual(["e5", "d5"]);
});

test("deck synchronization preserves a card across clock-only FEN changes", () => {
    const originalTree = defaultTree().root;
    originalTree.children.push(practiceNode("8/8/8/8/8/8/4P3/K6k w - - 0 12", "e5"));
    const [existing] = buildFromTree(originalTree, "white", []);
    existing.card.reps = 4;

    const refreshedTree = defaultTree().root;
    refreshedTree.children.push(practiceNode("8/8/8/8/8/8/4P3/K6k w - - 30 44", "e6"));
    const result = syncDeck([existing], refreshedTree, "white", []);

    expect(result).toMatchObject({ added: 0, removed: 0 });
    expect(result.positions[0].card.reps).toBe(4);
    expect(result.positions[0].answer).toBe("e6");
});
