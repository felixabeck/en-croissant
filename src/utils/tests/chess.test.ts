import { beforeEach, expect, test, vi } from "vitest";
import { parseUci } from "chessops";
import { INITIAL_FEN } from "chessops/fen";
import type { Token } from "@/bindings";
import { ANNOTATION_INFO, type Annotation, NAG_INFO } from "../annotation";
import {
    getLastMainlinePosition,
    getPGN,
    hasMorePriority,
    parsePGN,
    parseStartHeader,
} from "../chess";
import { createNode, defaultTree, type TreeNode } from "../treeReducer";

const mocks = vi.hoisted(() => ({ lexPgn: vi.fn() }));

vi.mock("@/platform/tauri", () => ({
    cancellationError: () => new Error("cancelled"),
    tauri: { lexPgn: mocks.lexPgn },
}));

function tokens(fen: string, san: string): Token[] {
    return [
        { type: "Header", value: { tag: "FEN", value: fen } },
        { type: "San", value: san },
    ];
}

beforeEach(() => mocks.lexPgn.mockReset());

function addMainlineMove(parent: TreeNode, san: string): TreeNode {
    const child = createNode({
        fen: parent.fen,
        move: parseUci("e2e4")!,
        san,
        halfMoves: parent.halfMoves + 1,
    });
    parent.children.push(child);
    return child;
}

test.each([
    { plies: 0, expected: [] },
    { plies: 1, expected: [0] },
    { plies: 3, expected: [0, 0, 0] },
])("last mainline position resolves the leaf after $plies plies", ({ plies, expected }) => {
    const root = defaultTree().root;
    let node = root;
    for (let i = 0; i < plies; i++) {
        node = addMainlineMove(node, `move-${i}`);
    }

    expect(getLastMainlinePosition(root)).toEqual(expected);
});

test("PGN renders each basic and non-basic annotation once", () => {
    const root = defaultTree().root;
    const move = createNode({
        fen: INITIAL_FEN,
        move: parseUci("e2e4")!,
        san: "e4",
        halfMoves: 1,
    });
    move.annotations = ["!", "??", "∞"];
    root.children.push(move);

    expect(
        getPGN(root, {
            headers: null,
            glyphs: true,
            comments: false,
            variations: false,
            extraMarkups: false,
        }),
    ).toBe("1. e4!?? $13");
});

test("NAGs are consistent", () => {
    for (const k of Object.keys(ANNOTATION_INFO)) {
        if (k === "") continue;
        const nag = ANNOTATION_INFO[k as Annotation].nag!;
        expect(NAG_INFO.get(`$${nag}`)).toBe(k);
    }
});

test("priority comparison", () => {
    expect(hasMorePriority([0, 0], [0])).toBe(false);
    expect(hasMorePriority([0], [0, 0])).toBe(true);
    expect(hasMorePriority([0], [1])).toBe(true);
    expect(hasMorePriority([1], [0])).toBe(false);
    expect(hasMorePriority([0, 0], [0, 1])).toBe(true);
    expect(hasMorePriority([0, 1], [0, 0])).toBe(false);
    expect(hasMorePriority([0, 1], [0, 2])).toBe(true);
    expect(hasMorePriority([0, 2], [0, 1])).toBe(false);
});

test("Start headers accept only bounded existing nonnegative paths", () => {
    const tree = defaultTree();
    tree.root.children.push({ ...tree.root, children: [] });
    expect(parseStartHeader([0], tree.root)).toEqual([0]);
    expect(parseStartHeader([-1], tree.root)).toEqual([]);
    expect(parseStartHeader([1], tree.root)).toEqual([]);
    expect(parseStartHeader("[0]", tree.root)).toEqual([]);
    expect(parseStartHeader(Array(513).fill(0), tree.root)).toEqual([]);
});

test("Start headers reject unresolvable nested paths without returning their valid prefix", () => {
    const root = defaultTree().root;
    root.children.push({ ...root, children: [] });

    expect(parseStartHeader([0, 0], root)).toEqual([]);
    expect(parseStartHeader([0, 1.5], root)).toEqual([]);
});

test("Start headers accept nested paths and enforce the bound on a deep enough tree", () => {
    const root = defaultTree().root;
    const first: TreeNode = { ...root, children: [] };
    first.children.push({ ...first, children: [] }, { ...first, children: [] });
    root.children.push(first);
    expect(parseStartHeader([0, 1], root)).toEqual([0, 1]);

    const deepRoot = defaultTree().root;
    let node = deepRoot;
    for (let depth = 0; depth < 513; depth += 1) {
        const childNode: TreeNode = { ...node, children: [] };
        node.children.push(childNode);
        node = childNode;
    }

    const maximumPath = Array(512).fill(0);
    expect(parseStartHeader(maximumPath, deepRoot)).toEqual(maximumPath);
    expect(parseStartHeader(Array(513).fill(0), deepRoot)).toEqual([]);
});

test.each([
    {
        fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 23",
        san: "e4",
        halfMoves: 45,
        notation: "23. e4",
    },
    {
        fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR b KQkq - 0 23",
        san: "e5",
        halfMoves: 46,
        notation: "23... e5",
    },
])(
    "custom $notation starts retain absolute numbering through parse and PGN output",
    async (entry) => {
        mocks.lexPgn.mockResolvedValueOnce(tokens(entry.fen, entry.san));

        const tree = await parsePGN("ignored by mocked lexer");

        expect(tree.root.children[0].halfMoves).toBe(entry.halfMoves);
        expect(
            getPGN(tree.root, {
                headers: null,
                glyphs: false,
                comments: false,
                variations: false,
                extraMarkups: false,
            }),
        ).toContain(entry.notation);
    },
);

test.each([
    { start: "[0,5]", expected: [] },
    { start: "[0,0]", expected: [0, 0] },
])("an imported Start header $start is stored only as the path that resolves", async (entry) => {
    mocks.lexPgn.mockResolvedValueOnce([
        { type: "Header", value: { tag: "Start", value: entry.start } },
        { type: "San", value: "e4" },
        { type: "San", value: "e5" },
    ]);

    const tree = await parsePGN("ignored by mocked lexer");

    expect(tree.headers.start).toEqual(entry.expected);
    expect(tree.position).toEqual(entry.expected);
});
