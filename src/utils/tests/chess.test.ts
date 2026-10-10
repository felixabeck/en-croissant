import { beforeEach, expect, test, vi } from "vitest";
import { parseUci } from "chessops";
import { INITIAL_FEN } from "chessops/fen";
import type { Token } from "@/bindings";
import { ANNOTATION_INFO, type Annotation, NAG_INFO, nagGlyphs } from "../annotation";
import {
    getLastMainlinePosition,
    getGameStats,
    getPGN,
    hasMorePriority,
    parsePGN,
    parseStartHeader,
} from "../chess";
import { createNode, defaultTree, treeIteratorMainLine, type TreeNode } from "../treeReducer";

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

beforeEach(() => {
    mocks.lexPgn.mockReset();
});

test.each([
    {
        name: "initial three-square pawn advance",
        fen: INITIAL_FEN,
        illegal: "e2e5",
        legal: "e2e4",
        san: "e4",
    },
    { name: "wrong side", fen: INITIAL_FEN, illegal: "e7e5", legal: "g1f3", san: "Nf3" },
    {
        name: "exposed king",
        fen: "k3r3/8/8/8/8/8/4R3/4K3 w - - 0 1",
        illegal: "e2f2",
        legal: "e2e3",
        san: "Re3",
    },
    {
        name: "custom Black target",
        fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR b KQkq - 0 23",
        illegal: "e2e4",
        legal: "e7e5",
        san: "e5",
    },
])(
    "parsePGN skips illegal UCI at $name and continues from the same position",
    async ({ fen, illegal, legal, san }) => {
        mocks.lexPgn.mockResolvedValueOnce(tokens(fen, illegal));
        const rejected = await parsePGN(`1. ${illegal} *`);
        expect(rejected.root.fen).toBe(fen);
        expect(rejected.root.children).toEqual([]);
        expect(rejected.position).toEqual([]);

        mocks.lexPgn.mockResolvedValueOnce([
            ...tokens(fen, illegal),
            { type: "San", value: "not-a-move" },
            { type: "San", value: legal },
        ] satisfies Token[]);
        const continued = await parsePGN(`1. ${illegal} not-a-move ${legal} *`);
        expect(continued.root.children).toHaveLength(1);
        expect(continued.root.children[0]).toMatchObject({
            san,
            move: parseUci(legal),
            halfMoves: rejected.root.halfMoves + 1,
            children: [],
        });
    },
);

test("parsePGN tests UCI legality at the evolving target rather than the initial root", async () => {
    mocks.lexPgn.mockResolvedValueOnce([
        { type: "San", value: "e2e4" },
        { type: "San", value: "g1f3" },
        { type: "San", value: "e7e5" },
    ] satisfies Token[]);
    const tree = await parsePGN("1. e2e4 g1f3 e7e5 *");
    const first = tree.root.children[0];
    expect(first.san).toBe("e4");
    expect(first.children).toHaveLength(1);
    expect(first.children[0]).toMatchObject({ san: "e5", halfMoves: 2, children: [] });
    expect(first.children[0].fen).toBe(
        "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2",
    );
});

test("parsePGN initialFen override governs legality instead of a conflicting FEN header", async () => {
    const blackFen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR b KQkq - 0 23";
    mocks.lexPgn.mockResolvedValueOnce([
        ...tokens(INITIAL_FEN, "e2e4"),
        { type: "San", value: "e7e5" },
    ] satisfies Token[]);
    const tree = await parsePGN("1. e2e4 e7e5 *", blackFen);
    expect(tree.root.fen).toBe(blackFen);
    expect(tree.root.children).toHaveLength(1);
    expect(tree.root.children[0]).toMatchObject({ san: "e5", halfMoves: 46, children: [] });
});

test.each([
    {
        name: "SAN",
        fen: INITIAL_FEN,
        value: "e4",
        san: "e4",
        after: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1",
    },
    {
        name: "UCI",
        fen: INITIAL_FEN,
        value: "e2e4",
        san: "e4",
        after: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1",
    },
    {
        name: "SAN castling",
        fen: "4k3/8/8/8/8/8/8/R3K2R w KQ - 0 1",
        value: "O-O",
        san: "O-O",
        after: "4k3/8/8/8/8/8/8/R4RK1 b - - 1 1",
    },
    {
        name: "UCI king-destination castling",
        fen: "4k3/8/8/8/8/8/8/R3K2R w KQ - 0 1",
        value: "e1g1",
        san: "O-O",
        after: "4k3/8/8/8/8/8/8/R4RK1 b - - 1 1",
    },
    {
        name: "UCI king-to-rook castling",
        fen: "4k3/8/8/8/8/8/8/R3K2R w KQ - 0 1",
        value: "e1a1",
        san: "O-O-O",
        after: "4k3/8/8/8/8/8/8/2KR3R b - - 1 1",
    },
    {
        name: "Chess960 kingside castling",
        fen: "4k3/8/8/8/8/8/8/1R1K1R2 w KQ - 0 1",
        value: "d1f1",
        san: "O-O",
        after: "4k3/8/8/8/8/8/8/1R3RK1 b - - 1 1",
    },
    {
        name: "Chess960 queenside castling",
        fen: "4k3/8/8/8/8/8/8/1R1K1R2 w KQ - 0 1",
        value: "d1b1",
        san: "O-O-O",
        after: "4k3/8/8/8/8/8/8/2KR1R2 b - - 1 1",
    },
    {
        name: "promotion",
        fen: "7k/P7/8/8/8/8/8/4K3 w - - 0 1",
        value: "a7a8q",
        san: "a8=Q+",
        after: "Q6k/8/8/8/8/8/8/4K3 b - - 0 1",
    },
    {
        name: "SAN underpromotion",
        fen: "7k/P7/8/8/8/8/8/4K3 w - - 0 1",
        value: "a8=N",
        san: "a8=N",
        after: "N6k/8/8/8/8/8/8/4K3 b - - 0 1",
    },
])("parsePGN preserves legal $name", async ({ fen, value, san, after }) => {
    // The renderer receives source-square notation as San tokens from the native lexer.
    mocks.lexPgn.mockResolvedValueOnce(tokens(fen, value));
    const tree = await parsePGN(value);
    expect(tree.root.children).toHaveLength(1);
    expect(tree.root.children[0]).toMatchObject({ san, fen: after, children: [] });
});

test("parsePGN applies legality independently inside SAN/UCI variations", async () => {
    mocks.lexPgn.mockResolvedValueOnce([
        { type: "San", value: "e4" },
        { type: "ParenOpen" },
        { type: "San", value: "e2e5" },
        { type: "San", value: "d2d4" },
        { type: "San", value: "d5" },
        { type: "ParenClose" },
        { type: "San", value: "e7e5" },
    ] satisfies Token[]);
    const tree = await parsePGN("1. e4 (1. e2e5 d2d4 d5) e7e5 *");
    expect(tree.root.children.map((node) => node.san)).toEqual(["e4", "d4"]);
    expect(tree.root.children[0].children.map((node) => node.san)).toEqual(["e5"]);
    expect(tree.root.children[1].children.map((node) => node.san)).toEqual(["d5"]);
    expect(tree.root.children[1].children[0].fen).toBe(
        "rnbqkbnr/ppp1pppp/8/3p4/3P4/8/PPP1PPPP/RNBQKBNR w KQkq - 0 2",
    );
});

test("lossless NAG round trip preserves every code and multiplicity", async () => {
    const pgn =
        "1. e4 $8 $8 c6 $11 2. d4 $1 $2 d5 $14 $1 3. Nc3 $220 dxe4 $6 $146 4. Nxe4 $0 Bf5 $255";
    // Token shapes are pinned by Rust's lexer::tests::test_lex_pgn_sync_lossless_nags.
    mocks.lexPgn.mockImplementation(async (source: string) => {
        const result: Token[] = [];
        for (const word of source.split(/\s+/)) {
            if (word.startsWith("$")) result.push({ type: "Nag", value: word });
            else if (/^[a-zA-Z]/.test(word)) {
                const suffix = word.match(/[!?]+$/)?.[0];
                result.push({ type: "San", value: suffix ? word.slice(0, -suffix.length) : word });
                if (suffix)
                    result.push({
                        type: "Nag",
                        value: `$${ANNOTATION_INFO[suffix as Annotation].nag}`,
                    });
            }
        }
        return result;
    });
    const parsed = await parsePGN(pgn);
    const codes = (root: TreeNode) =>
        [...treeIteratorMainLine(root)].slice(1).map(({ node }) => node.nags);
    const expected = [[8, 8], [11], [1, 2], [14, 1], [220], [6, 146], [0], [255]];
    expect(codes(parsed.root)).toEqual(expected);
    const written = getPGN(parsed.root, {
        headers: null,
        glyphs: true,
        comments: true,
        variations: true,
        extraMarkups: true,
    });
    for (const text of [
        "e4 $8 $8",
        "c6 $11",
        "d4! $2",
        "d5! $14",
        "Nc3 $220",
        "dxe4?! $146",
        "Nxe4 $0",
        "Bf5 $255",
    ]) {
        expect(written).toContain(text);
    }
    for (const text of ["d4!?", "$7", "$10"]) expect(written).not.toContain(text);
    expect(codes(parsed.root)).toEqual(expected);
    const reparsed = await parsePGN(written);
    expect(codes(reparsed.root)).toEqual(expected.map((nags) => [...nags].sort((a, b) => a - b)));
    expect(
        getPGN(parsed.root, {
            headers: null,
            glyphs: false,
            comments: false,
            variations: false,
            extraMarkups: false,
        }),
    ).not.toMatch(/\$|[!?]/);
    expect(mocks.lexPgn).toHaveBeenCalledWith(pgn, undefined);
});

test("NAG parser ignores malformed and out-of-range tokens", async () => {
    mocks.lexPgn.mockResolvedValueOnce([
        { type: "San", value: "e4" },
        ...["$256", "$-1", "$1.5", "$", "$1junk", "1", "$NaN", "$0", "$255"].map(
            (value): Token => ({ type: "Nag", value }),
        ),
    ]);
    expect((await parsePGN("tokens from native lexer")).root.children[0].nags).toEqual([0, 255]);
});

test.each([
    [[8], ["□"]],
    [[11], ["="]],
    [
        [14, 8],
        ["□", "⩲"],
    ],
    [[8, 8], ["□"]],
    [[7, 8], ["□"]],
    [[10, 11], ["="]],
    [[220], []],
    [[220, 1], ["!"]],
])("NAG display projection %j yields %j", (nags, glyphs) => {
    expect(nagGlyphs(nags as number[])).toEqual(glyphs);
});

test("game stats count every basic NAG including duplicates", () => {
    const root = defaultTree().root;
    let parent = root;
    for (const nags of [[1, 1, 220], [2], [6, 8], []]) {
        parent = addMainlineMove(parent, "move");
        parent.nags = nags;
    }
    expect(getGameStats(root)).toMatchObject({
        whiteAnnotations: { "!": 2, "?!": 1, "?": 0, "??": 0, "!!": 0, "!?": 0 },
        blackAnnotations: { "!": 0, "?!": 0, "?": 1, "??": 0, "!!": 0, "!?": 0 },
    });
});

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
    move.nags = [1, 4, 13];
    root.children.push(move);

    expect(
        getPGN(root, {
            headers: null,
            glyphs: true,
            comments: false,
            variations: false,
            extraMarkups: false,
        }),
    ).toBe("1. e4! $4 $13");
});

test("NAGs are consistent", () => {
    for (const k of Object.keys(ANNOTATION_INFO)) {
        if (k === "") continue;
        const nag = ANNOTATION_INFO[k as Annotation].nag!;
        expect(NAG_INFO.get(nag)).toBe(k);
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

function mockCommentLexer() {
    // Match the native Visitor's tokens for these fixtures, including separate brace comments.
    // Only lexing is replaced. parsePGN, splitPgnComment and getPGN stay real on both passes.
    mocks.lexPgn.mockImplementation(async (source: string): Promise<Token[]> => {
        const result: Token[] = [];
        const words = source.matchAll(/\[([\w]+) "([^"]*)"\]|\{([^}]*)\}|[^\s(){}]+|[()]/g);
        for (const [word, tag, value, text] of words) {
            if (tag) result.push({ type: "Header", value: { tag, value } });
            else if (text !== undefined) result.push(comment(text));
            else if (word === "(") result.push({ type: "ParenOpen" });
            else if (word === ")") result.push({ type: "ParenClose" });
            else if (/^\$\d+$/.test(word)) result.push({ type: "Nag", value: word });
            else if (["*", "1-0", "0-1", "1/2-1/2"].includes(word)) {
                result.push({ type: "Outcome", value: word });
            } else if (!/^\d+\.(?:\.\.)?$/.test(word)) result.push(san(word));
        }
        return result;
    });
}

test.each([
    { command: "[%clk 0:05:00]", annotation: { clock: 300 } },
    {
        command: "[%eval 0.34,61]",
        annotation: { score: { value: { type: "cp", value: 34 }, wdl: null }, depth: 61 },
    },
    { command: "[%csl Ga1]", annotation: { shapes: [{ orig: "a1", dest: "a1", brush: "green" }] } },
    { command: "[%cal Re2e4]", annotation: { shapes: [{ orig: "e2", dest: "e4", brush: "red" }] } },
    { command: "[%evp 0,34,61]", annotation: { commands: "[%evp 0,34,61]" } },
    { command: "", annotation: {} },
])(
    "prose survives a later command-only comment $command through save and reparse",
    async ({ command, annotation }) => {
        mockCommentLexer();
        const source = `1. e4 {Keep this explanation} {${command}} e5 *`;
        const parsed = await parsePGN(source);
        const e4 = parsed.root.children[0];

        expect(e4.comment).toBe("Keep this explanation");
        expect(e4).toMatchObject(annotation);
        const written = getPGN(parsed.root, { ...ALL_MARKUPS, headers: null });
        expect(written).toContain("Keep this explanation");
        const reparsed = await parsePGN(written);
        expect(reparsed.root.children[0].comment).toBe("Keep this explanation");
        expect(reparsed.root).toEqual(parsed.root);
        expect(mocks.lexPgn).toHaveBeenNthCalledWith(1, source, undefined);
        expect(mocks.lexPgn).toHaveBeenNthCalledWith(2, written, undefined);
    },
);

test("multiple prose comments and annotations retain their placement through save and reparse", async () => {
    mockCommentLexer();
    const source = `[Event "Comment round trip"]
[Site "Fixture"]
[Date "2026.10.10"]
[Annotator "Fixture"]
[Start "[0,1]"]

{Root first} {Root second} 1. e4 $8 {First explanation} {[%clk 0:05:00]}
{Second explanation [%evp 1,2]} {[%eval 0.34,61]} {[%csl Ga1]} {[%cal Re2e4]}
{Third explanation [%emt 0:00:01]} e5 {Reply first} {Reply second}
( {Variation first} {[%evp 0,34] second} 1... c5 {Sicilian first} {Sicilian second} {[%clk 0:04:59]} ) *`;
    const parsed = await parsePGN(source);
    const e4 = parsed.root.children[0];
    expect(parsed.root.comment).toBe("Root first Root second");
    expect(e4.comment).toBe("First explanation Second explanation Third explanation");
    expect(e4).toMatchObject({
        clock: 300,
        score: { value: { type: "cp", value: 34 }, wdl: null },
        depth: 61,
        shapes: [
            { orig: "a1", dest: "a1", brush: "green" },
            { orig: "e2", dest: "e4", brush: "red" },
        ],
        commands: "[%evp 1,2] [%emt 0:00:01]",
        nags: [8],
    });
    expect(e4.children[0].comment).toBe("Reply first Reply second");
    expect(e4.children[1]).toMatchObject({
        san: "c5",
        startingComment: "Variation first [%evp 0,34] second",
        comment: "Sicilian first Sicilian second",
        clock: 299,
    });
    expect(parsed.position).toEqual([0, 1]);
    expect(parsed.headers).toMatchObject({
        event: "Comment round trip",
        other: { Annotator: "Fixture" },
    });

    const written = getPGN(parsed.root, { ...ALL_MARKUPS, headers: parsed.headers });
    expect(written).toContain("First explanation Second explanation Third explanation");
    expect(written).toContain("{Variation first [%evp 0,34] second} 1... c5");
    const reparsed = await parsePGN(written);
    expect(reparsed.root).toEqual(parsed.root);
    expect(reparsed.headers).toEqual(parsed.headers);
    expect(reparsed.position).toEqual(parsed.position);
});

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

    expect(e4.comment).toBe("first second");
    expect(e4.commands).toBe("[%evp 1,2] [%emt 0:00:01]");
});

test("commands survive a later plain prose comment on one move", async () => {
    const { root } = await parseTokens([san("e4"), comment("[%evp 1,2] first"), comment("second")]);
    const e4 = root.children[0];

    expect(e4.comment).toBe("first second");
    expect(e4.commands).toBe("[%evp 1,2]");
    expect(getPGN(root, { ...ALL_MARKUPS, headers: null })).toContain("{[%evp 1,2] first second}");
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
    const pgn = getPGN(root, { ...ALL_MARKUPS, headers: null });

    expect(pgn).toMatch(/\{\[%evp 0,34,61,53\]\s*\}/);
    expect(pgn).not.toContain("{}");
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

test("kept commands keep their source order through a save", async () => {
    const { root } = await parseTokens([
        san("e4"),
        comment("[%eval abc] [%evp 1] note [%emt 0:00:02]"),
    ]);

    expect(getPGN(root, { ...ALL_MARKUPS, headers: null })).toBe(
        "1. e4 {[%eval abc] [%evp 1]  [%emt 0:00:02] note}",
    );
});

test("several comments before a variation's first move all survive a save", async () => {
    const { root } = await parseTokens([
        san("e4"),
        { type: "ParenOpen" },
        comment("First"),
        comment("[%evp 0,34] second"),
        san("d4"),
        { type: "ParenClose" },
    ]);

    expect(root.children[1].startingComment).toBe("First [%evp 0,34] second");
    expect(getPGN(root, { ...ALL_MARKUPS, headers: null })).toContain(
        "({First [%evp 0,34] second} 1. d4",
    );
});

test("mixed adjacent opaque and malformed commands stay in order and within their source", async () => {
    const source = "[%evp 1][%eval bad][%evp 2][%eval bad]";
    const { root } = await parseTokens([san("e4"), comment(source)]);

    expect(root.children[0].commands).toBe(source);
});
