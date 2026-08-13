import { parseUci } from "chessops";
import { describe, expect, test } from "vitest";
import {
    buildTranspositionMaps,
    countMainPly,
    createNode,
    defaultTree,
    findFen,
    getBoardState,
    getGameName,
    getNodeAtPath,
    treeIterator,
    treeIteratorMainLine,
    type TreeNode,
} from "@/utils/treeReducer";

const child = (fen: string, halfMoves: number): TreeNode =>
    createNode({
        fen,
        move: parseUci("e2e4")!,
        san: "e4",
        halfMoves,
    });

test("findFen distinguishes the root from a removed practice card", () => {
    const tree = defaultTree().root;
    expect(findFen(tree.fen, tree)).toEqual([]);
    expect(findFen("removed-card", tree)).toBeUndefined();
});

test("preserves a zero [%clk 0:00:00] clock as a numeric zero", () => {
    const node = createNode({
        fen: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1",
        move: parseUci("e2e4")!,
        san: "e4",
        halfMoves: 1,
        clock: 0,
    });
    expect(node.clock).toBe(0);
});

test("converts nonzero clocks from milliseconds and omits an absent clock", () => {
    expect(
        createNode({
            fen: "clocked",
            move: parseUci("e2e4")!,
            san: "e4",
            halfMoves: 1,
            clock: 5_000,
        }).clock,
    ).toBe(5);
    expect(child("without-clock", 1).clock).toBeUndefined();
});

test("tree iterators preserve depth-first sibling positions and the exact main line", () => {
    const root = defaultTree().root;
    const first = child("first", 1);
    const firstReply = child("first-reply", 2);
    const second = child("second", 1);
    first.children.push(firstReply);
    root.children.push(first, second);

    expect([...treeIterator(root)].map(({ position, node }) => [position, node.fen])).toEqual([
        [[], root.fen],
        [[0], "first"],
        [[0, 0], "first-reply"],
        [[1], "second"],
    ]);
    expect(
        [...treeIteratorMainLine(root)].map(({ position, node }) => [position, node.fen]),
    ).toEqual([
        [[], root.fen],
        [[0], "first"],
        [[0, 0], "first-reply"],
    ]);
    expect(countMainPly(root)).toBe(2);
    expect(countMainPly(second)).toBe(0);
});

test("defaultTree normalizes the root while preserving complete deterministic defaults", () => {
    const fen = "  4k3/8/8/8/8/8/8/4K3 b - - 0 1  ";
    const tree = defaultTree(fen);
    expect(tree).toMatchObject({
        dirty: false,
        position: [],
        report: { inProgress: false },
        boardStateMap: {},
        headers: {
            id: 0,
            fen: fen.trim(),
            white: "",
            black: "",
            result: "*",
            event: "",
            site: "",
        },
        root: {
            fen: fen.trim(),
            halfMoves: 1,
            children: [],
            shapes: [],
            annotations: [],
            comment: "",
        },
    });
    expect(defaultTree().root.halfMoves).toBe(0);
});

describe("game display name", () => {
    const headers = defaultTree().headers;

    test("uses player names when either real player is present", () => {
        expect(getGameName({ ...headers, white: "Alice", black: "Bob" })).toBe("Alice - Bob");
        expect(getGameName({ ...headers, white: "Alice", black: "" })).toBe("Alice - ");
        expect(getGameName({ ...headers, white: "?", black: "Bob" })).toBe("? - Bob");
    });

    test("falls back to event and then Unknown for placeholder players", () => {
        expect(getGameName({ ...headers, white: "?", black: "?", event: "Candidates" })).toBe(
            "Candidates",
        );
        expect(getGameName({ ...headers, white: "?", black: "?", event: "" })).toBe("Unknown");
    });
});

test("path lookup stops at the last valid node instead of crossing a missing child", () => {
    const root = defaultTree().root;
    const first = child("first", 1);
    const reply = child("reply", 2);
    first.children.push(reply);
    root.children.push(first);
    expect(getNodeAtPath(root, [0, 0])).toBe(reply);
    expect(getNodeAtPath(root, [0, 1])).toBe(first);
    expect(getNodeAtPath(root, [1])).toBe(root);
});

test("transposition maps retain duplicate paths and respect a non-root start path", () => {
    const root = defaultTree("root w - - 0 1").root;
    const first = child("same b - - 0 1", 1);
    const duplicate = child("same b - - 7 9", 1);
    const reply = child("reply w - - 0 2", 2);
    first.children.push(reply);
    root.children.push(first, duplicate);

    const complete = buildTranspositionMaps(root);
    expect(complete["same b - -"].map(({ path }) => path)).toEqual([[0], [1]]);
    expect(complete["root w - -"][0].path).toEqual([]);

    const subtree = buildTranspositionMaps(root, [0]);
    expect(Object.keys(subtree).sort()).toEqual(["reply w - -", "same b - -"]);
    expect(subtree["same b - -"][0].path).toEqual([0]);
    expect(subtree["reply w - -"][0].path).toEqual([0, 0]);
});

test("board-state identity uses exactly the first four FEN fields", () => {
    expect(getBoardState("8/8/8/8/8/8/8/8 w - - 17 42")).toBe("8/8/8/8/8/8/8/8 w - -");
});
