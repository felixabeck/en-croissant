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

const ALL_MARKUPS = { glyphs: true, comments: true, variations: true, extraMarkups: true };

async function parseTokens(value: Token[]) {
    mocks.lexPgn.mockResolvedValueOnce(value);
    return await parsePGN("ignored by the mocked lexer");
}

function comment(value: string): Token {
    return { type: "Comment", value };
}

function san(value: string): Token {
    return { type: "San", value };
}

test("an unmodeled command is hidden from the comment and written back on save", async () => {
    const { root } = await parseTokens([comment("[%evp 0,34,61] sofort vertreiben"), san("e4")]);

    expect(root.comment).toBe("sofort vertreiben");
    expect(root.commands).toBe("[%evp 0,34,61]");
    expect(getPGN(root, { ...ALL_MARKUPS, headers: null })).toBe(
        "{[%evp 0,34,61] sofort vertreiben} 1. e4",
    );
    // They were comment text before the tree modeled them, so they travel with the comments:
    // PgnInput's "Update" from a PGN without extra markups must not drop them.
    expect(getPGN(root, { ...ALL_MARKUPS, extraMarkups: false, headers: null })).toBe(
        "{[%evp 0,34,61] sofort vertreiben} 1. e4",
    );
    expect(getPGN(root, { ...ALL_MARKUPS, comments: false, headers: null })).toBe("1. e4");
});

test("emt and timestamp commands are preserved instead of dropped", async () => {
    const { root } = await parseTokens([san("e4"), comment("[%emt 0:00:05] ok [%timestamp 12]")]);
    const e4 = root.children[0];

    expect(e4.comment).toBe("ok");
    // Concatenated with the whitespace they had, so the result is never longer than its source.
    expect(e4.commands).toBe("[%emt 0:00:05]  [%timestamp 12]");
    expect(getPGN(root, { ...ALL_MARKUPS, headers: null })).toBe(
        "1. e4 {[%emt 0:00:05]  [%timestamp 12] ok}",
    );
});

test("a malformed modeled command is kept as a command, never shown as prose", async () => {
    const { root } = await parseTokens([san("e4"), comment("[%eval abc] note")]);
    const e4 = root.children[0];

    expect(e4.comment).toBe("note");
    expect(e4.commands).toBe("[%eval abc]");
    expect(e4.score).toBeNull();
});

test("commands from several comments on one move accumulate in order", async () => {
    const { root } = await parseTokens([
        san("e4"),
        comment("[%evp 1,2] first"),
        comment("second [%emt 0:00:01]"),
    ]);
    const e4 = root.children[0];

    expect(e4.comment).toBe("second");
    expect(e4.commands).toBe("[%evp 1,2] [%emt 0:00:01]");
});

test("modeled commands still parse into the score, clock and shapes", async () => {
    const { root } = await parseTokens([
        san("e4"),
        comment("[%eval 0.34] [%clk 0:05:00] [%csl Ga1] [%cal Re2e4]"),
    ]);
    const e4 = root.children[0];

    expect(e4.score).toEqual({ value: { type: "cp", value: 34 }, wdl: null });
    expect(e4.depth).toBeNull();
    expect(e4.clock).toBe(300);
    expect(e4.shapes).toEqual([
        { orig: "a1", dest: "a1", brush: "green" },
        { orig: "e2", dest: "e4", brush: "red" },
    ]);
    expect(e4.commands).toBeUndefined();
    expect(e4.comment).toBe("");
});

test("an evaluation depth round-trips with its score", async () => {
    const { root } = await parseTokens([san("e4"), comment("[%eval 0.34,61]")]);
    const e4 = root.children[0];

    expect(e4.depth).toBe(61);
    expect(getPGN(root, { ...ALL_MARKUPS, headers: null })).toBe("1. e4 {[%eval +0.34,61] }");
});

test("a comment before a variation's first move stays in front of that move", async () => {
    const { root } = await parseTokens([
        san("e4"),
        { type: "ParenOpen" },
        comment("Also good: [%evp 0,34]"),
        san("d4"),
        san("d5"),
        { type: "ParenClose" },
        san("e5"),
    ]);
    const d4 = root.children[1];

    expect(d4.san).toBe("d4");
    expect(d4.startingComment).toBe("Also good: [%evp 0,34]");
    expect(root.comment).toBe("");
    expect(getPGN(root, { ...ALL_MARKUPS, headers: null })).toBe(
        "1. e4  ({Also good: [%evp 0,34]} 1. d4  d5) e5",
    );
});

test("a comment of only commands leaves no prose to show", async () => {
    const { root } = await parseTokens([comment("[%evp 0,34,61,53]"), san("e4")]);

    expect(root.comment).toBe("");
    expect(root.commands).toBe("[%evp 0,34,61,53]");
});

test("adjacent commands are kept without growing past their source", async () => {
    const source = "[%timestamp 1][%timestamp 2]";
    const { root } = await parseTokens([san("e4"), comment(source)]);

    expect(root.children[0].commands).toBe(source);
});

test("a mate evaluation keeps its depth", async () => {
    const { root } = await parseTokens([san("e4"), comment("[%eval #-3,24]")]);

    expect(root.children[0].score).toEqual({ value: { type: "mate", value: -3 }, wdl: null });
    expect(getPGN(root, { ...ALL_MARKUPS, headers: null })).toBe("1. e4 {[%eval #-3,24] }");
});

test("a variation nested at a variation's first move is kept with its starting comment", async () => {
    // 1. e4 e5 (1... c5 ({[%evp 0,34]} 1... e6) 2. Nf3) *
    const { root } = await parseTokens([
        san("e4"),
        san("e5"),
        { type: "ParenOpen" },
        san("c5"),
        { type: "ParenOpen" },
        comment("[%evp 0,34]"),
        san("e6"),
        { type: "ParenClose" },
        san("Nf3"),
        { type: "ParenClose" },
    ]);
    const afterE4 = root.children[0];

    expect(afterE4.children.map((node) => node.san)).toEqual(["e5", "c5", "e6"]);
    expect(afterE4.children[2].startingComment).toBe("[%evp 0,34]");
    expect(getPGN(root, { ...ALL_MARKUPS, headers: null })).toContain("({[%evp 0,34]} 1... e6");
});
