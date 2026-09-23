import { parseUci } from "chessops";
import { describe, expect, test, vi } from "vitest";
import {
    boardStateMapBuilder,
    countMainPly,
    createNode,
    defaultTree,
    findFen,
    getBoardState,
    getGameName,
    getMemoizedBoardStateMap,
    getNodeAtPath,
    getResolvedPathLength,
    normalizeTreeHalfMoves,
    rootHalfMoves,
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

test("root move numbering derives from the FEN fullmove and side to move", () => {
    const white = "8/8/8/8/8/8/8/K6k w - - 0 23";
    const black = "8/8/8/8/8/8/8/K6k b - - 0 23";

    expect(rootHalfMoves(white)).toBe(44);
    expect(rootHalfMoves(black)).toBe(45);
    expect(defaultTree(white).root.halfMoves).toBe(44);
    expect(defaultTree(black).root.halfMoves).toBe(45);
});

test("root move numbering has a deterministic fallback for a malformed FEN", () => {
    expect(rootHalfMoves("not a FEN")).toBe(0);
    expect(defaultTree("not a FEN").root.halfMoves).toBe(0);
});

test("normalizing a branched tree completes and derives every ply from its depth", () => {
    const root = defaultTree("8/8/8/8/8/8/8/K6k b - - 0 23").root;
    const first = child("first", 1);
    const reply = child("reply", 2);
    const sibling = child("sibling", 99);
    first.children.push(reply);
    root.children.push(first, sibling);

    expect(() => normalizeTreeHalfMoves(root)).not.toThrow();
    expect([root.halfMoves, first.halfMoves, reply.halfMoves, sibling.halfMoves]).toEqual([
        45, 46, 47, 46,
    ]);
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

test.each([
    { description: "a fully resolved path", path: [0, 0], expected: 2 },
    { description: "an index equal to the child count", path: [2], expected: 0 },
    { description: "an index past the child count", path: [3], expected: 0 },
    { description: "a negative index", path: [-1], expected: 0 },
    { description: "a fractional index", path: [1.5], expected: 0 },
    { description: "a non-number index", path: ["0"], expected: 0 },
    { description: "an empty path", path: [], expected: 0 },
    { description: "an invalid index in the middle", path: [0, 1, 0], expected: 1 },
])("counts resolved indices for $description", ({ path, expected }) => {
    const root = defaultTree().root;
    const first = child("first", 1);
    first.children.push(child("reply", 2));
    root.children.push(first, child("second", 1));

    expect(getResolvedPathLength(root, path)).toBe(expected);
});

test("transposition maps retain duplicate paths and respect a non-root start path", () => {
    const root = defaultTree("root w - - 0 1").root;
    const first = child("same b - - 0 1", 1);
    const duplicate = child("same b - - 7 9", 1);
    const reply = child("reply w - - 0 2", 2);
    first.children.push(reply);
    root.children.push(first, duplicate);

    const complete = getMemoizedBoardStateMap(root);
    expect(complete["same b - -"].map(({ path }) => path)).toEqual([[0], [1]]);
    expect(complete["root w - -"][0].path).toEqual([]);

    const subtree = getMemoizedBoardStateMap(root, [0]);
    expect(Object.keys(subtree).sort()).toEqual(["reply w - -", "same b - -"]);
    expect(subtree["same b - -"][0].path).toEqual([0]);
    expect(subtree["reply w - -"][0].path).toEqual([0, 0]);
});

test("the memoized map is keyed by the whole start path, not its concatenated digits", () => {
    const root = defaultTree().root;
    const build = vi
        .spyOn(boardStateMapBuilder, "build")
        .mockImplementation(() => ({}) as ReturnType<typeof boardStateMapBuilder.build>);
    try {
        const nested = getMemoizedBoardStateMap(root, [1, 1]);
        const eleventh = getMemoizedBoardStateMap(root, [11]);

        expect(eleventh).not.toBe(nested);
        expect(build.mock.calls.map(([, start]) => start)).toEqual([[1, 1], [11]]);
    } finally {
        build.mockRestore();
    }
});

test("board-state identity uses exactly the first four FEN fields", () => {
    expect(getBoardState("8/8/8/8/8/8/8/8 w - - 17 42")).toBe("8/8/8/8/8/8/8/8 w - -");
});
