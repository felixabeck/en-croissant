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

test("practice builds 8,000 distinct cards in walk order in under one second", () => {
    const root = defaultTree().root;
    const answers: string[] = [];
    for (let index = 0; index < 8_000; index++) {
        const pawnRanks = index
            .toString(8)
            .padStart(5, "0")
            .split("")
            .map((digit) => {
                const file = Number(digit);
                if (file === 0) return "P7";
                if (file === 7) return "7P";
                return `${file}P${7 - file}`;
            });
        const fen = `k7/${pawnRanks.join("/")}/8/K7 w - - 0 1`;
        const answer = `move-${index}`;
        root.children.push(practiceNode(fen, answer));
        answers.push(answer);
    }

    const startedAt = performance.now();
    const cards = buildFromTree(root, "white", []);
    const elapsedMs = performance.now() - startedAt;

    expect(cards).toHaveLength(8_000);
    expect(cards.map((card) => card.answer)).toEqual(answers);
    expect(elapsedMs).toBeLessThan(1_000);
});

test("deck synchronization preserves a card across clock-only FEN changes", () => {
    const originalTree = defaultTree().root;
    originalTree.children.push(practiceNode("8/8/8/8/8/8/4P3/K6k w - - 0 12", "e5"));
    const [existing] = buildFromTree(originalTree, "white", []);
    existing.card.reps = 4;

    const refreshedTree = defaultTree().root;
    refreshedTree.children.push(practiceNode("8/8/8/8/8/8/4P3/K6k w - - 30 44", "e6"));
    const result = syncDeck([existing], refreshedTree, "white", []);

    expect(result).toMatchObject({ added: 0, removed: 0, updated: 1 });
    expect(result.positions[0].card.reps).toBe(4);
    expect(result.positions[0].answer).toBe("e6");
    expect(result.positions[0].fen).toBe("8/8/8/8/8/8/4P3/K6k w - - 30 44");
});

test("deck synchronization reports a clock-only FEN change as an update", () => {
    const originalTree = defaultTree().root;
    originalTree.children.push(practiceNode("8/8/8/8/8/8/4P3/K6k w - - 0 12", "e5"));
    const [existing] = buildFromTree(originalTree, "white", []);

    const refreshedTree = defaultTree().root;
    refreshedTree.children.push(practiceNode("8/8/8/8/8/8/4P3/K6k w - - 30 44", "e5"));
    const result = syncDeck([existing], refreshedTree, "white", []);

    expect(result).toMatchObject({ added: 0, removed: 0, updated: 1 });
    expect(result.positions[0].fen).toBe("8/8/8/8/8/8/4P3/K6k w - - 30 44");
});

test("deck synchronization reports a reordering of the same cards", () => {
    const originalTree = defaultTree().root;
    originalTree.children.push(
        practiceNode("8/8/8/8/8/8/4P3/K6k w - - 0 12", "e5"),
        practiceNode("8/8/8/8/8/8/3P4/K6k w - - 0 12", "d5"),
    );
    const existing = buildFromTree(originalTree, "white", []);

    const reorderedTree = defaultTree().root;
    reorderedTree.children.push(
        practiceNode("8/8/8/8/8/8/3P4/K6k w - - 0 12", "d5"),
        practiceNode("8/8/8/8/8/8/4P3/K6k w - - 0 12", "e5"),
    );
    const result = syncDeck(existing, reorderedTree, "white", []);

    expect(result).toMatchObject({ added: 0, removed: 0, updated: 0, reordered: true });
    expect(result.positions.map((card) => card.answer)).toEqual(["d5", "e5"]);
    expect(syncDeck(existing, originalTree, "white", []).reordered).toBe(false);
});
