import type { JSONContent } from "@tiptap/react";
import { expect, test } from "vitest";
import { createCommentMarkdown, type CommentMarkdownToken } from "./commentMarkdown";
import {
    compareCommentDocument,
    flattenCommentDocument,
    normalizeCommentDocument,
    serializeComment,
    type CommentFormatting,
} from "./commentSerializer";

type Span = { text: string; marks?: string[]; hardBreak?: boolean };

const link = (href: string, title: string | null = null) => JSON.stringify(["link", href, title]);
const url = link("https://x.y");

function mark(key: string) {
    if (!key.startsWith("[")) return { type: key };
    const [, href, title] = JSON.parse(key);
    return { type: "link", attrs: { href, title } };
}

function document(spans: Span[]): JSONContent {
    return {
        type: "doc",
        content: [
            {
                type: "paragraph",
                content: spans.map((span) => ({
                    type: span.hardBreak ? "hardBreak" : "text",
                    ...(span.hardBreak ? {} : { text: span.text }),
                    marks: (span.marks ?? []).map(mark),
                })),
            },
        ],
    };
}

function expected(spans: Span[]): CommentFormatting {
    return {
        text: spans.map((span) => span.text).join(""),
        marks: spans.flatMap((span) =>
            Array.from(span.text, () => [...new Set(span.marks ?? [])].sort()),
        ),
    };
}

function reparse(source: string): JSONContent {
    const inline = (tokens: CommentMarkdownToken[], marks: string[] = []): JSONContent[] =>
        tokens.flatMap((token) => {
            const type = { strong: "bold", em: "italic", del: "strike", underline: "underline" }[
                token.type
            ];
            if (type || token.type === "link") {
                return inline(token.tokens ?? [], [
                    ...marks,
                    type ?? link(token.href!, token.title ?? null),
                ]);
            }
            if (token.type === "br") return [{ type: "hardBreak", marks: marks.map(mark) }];
            if (token.tokens) return inline(token.tokens, marks);
            if (token.type !== "text" && token.type !== "escape")
                throw new Error(`Unexpected token ${token.type}`);
            return [{ type: "text", text: token.text ?? "", marks: marks.map(mark) }];
        });
    return {
        type: "doc",
        content: (createCommentMarkdown().lexer(source) as CommentMarkdownToken[])
            .filter((token) => token.type !== "space")
            .map((token) => {
                if (token.type !== "paragraph") throw new Error(`Unexpected block ${token.type}`);
                return { type: "paragraph", content: inline(token.tokens ?? []) };
            }),
    };
}

function roundTrip(input: Span[], wanted: Span[] = input, source?: string) {
    const oracle = expected(wanted);
    const json = document(input);
    const serialized = serializeComment(json);
    const anySource = expect.any(String);
    expect(serialized).toEqual(source ?? anySource);
    expect(flattenCommentDocument(reparse(serialized))).toEqual(oracle);
    expect(compareCommentDocument(json, [reparse])).toEqual({ saved: true, source: serialized });
    return serialized;
}

test("escapes literal delimiters independently of authored formatting", () => {
    expect.hasAssertions();
    roundTrip([{ text: "a++b" }, { text: "c", marks: ["underline"] }], undefined, "a\\+\\+b++c++");
    roundTrip([{ text: "**x**" }], undefined, "\\*\\*x\\*\\*");
    roundTrip([{ text: "a++b", marks: ["underline"] }], undefined, "++a\\+\\+b++");
    roundTrip(
        [
            { text: "a", marks: ["underline"] },
            { text: "b", marks: ["underline"] },
        ],
        undefined,
        "++ab++",
    );
});

test("keeps an isolated underlined plus before an unmarked edit", () => {
    expect.hasAssertions();
    roundTrip([{ text: "+", marks: ["underline"] }, { text: "!" }], undefined, "+++++!");
});

test("refuses an underline ending in a plus after another character", () => {
    const input = document([{ text: "x+", marks: ["underline"] }]);
    expect(compareCommentDocument(input, [reparse])).toEqual({ saved: false });
});

test("keeps adjacent link destinations and titles distinct beside unmarked edits", () => {
    expect.hasAssertions();
    for (const edit of ["", "!"]) {
        roundTrip(
            [
                { text: "a", marks: [link("https://a.test")] },
                { text: "b", marks: [link("https://b.test")] },
                ...(edit ? [{ text: edit }] : []),
            ],
            undefined,
            `[a](https://a.test)[b](https://b.test)${edit}`,
        );
    }
    roundTrip(
        [
            { text: "a", marks: [link("https://x.y", "first")] },
            { text: "b", marks: [link("https://x.y", "second")] },
        ],
        undefined,
        '[a](https://x.y "first")[b](https://x.y "second")',
    );
    roundTrip(
        [{ text: "a", marks: [link("https://x.y/a(b)", 'a "quote" and \\ slash')] }],
        undefined,
        '[a](<https://x.y/a(b)> "a \\"quote\\" and \\\\ slash")',
    );
});

test("prevents autolinking after a URL link is removed", () => {
    expect.hasAssertions();
    roundTrip([{ text: "https://a.test" }], undefined, "https\\://a.test");
    roundTrip([{ text: "www.a.test" }], undefined, "www\\.a.test");
});

test("keeps underline on linked edge spaces and moves plain flanking whitespace out", () => {
    expect.hasAssertions();
    roundTrip(
        [{ text: " x ", marks: ["underline", link("https://a.test")] }],
        undefined,
        "++[ x ](https://a.test)++",
    );
    roundTrip([{ text: "   ", marks: ["underline", url] }], undefined, "++[   ](https://x.y)++");
    roundTrip(
        [{ text: "a" }, { text: "   ", marks: ["underline"] }, { text: "b" }],
        [{ text: "a   b" }],
        "a   b",
    );
    for (const type of ["underline", "bold", "italic", "strike"]) {
        const delimiter = { underline: "++", bold: "**", italic: "*", strike: "~~" }[type];
        roundTrip(
            [{ text: " x ", marks: [type] }],
            [{ text: " " }, { text: "x", marks: [type] }, { text: " " }],
            ` ${delimiter}x${delimiter} `,
        );
    }
});

test("keeps expressible whitespace inside a crossing emphasis run", () => {
    expect.hasAssertions();
    roundTrip(
        [
            { text: "a ", marks: ["bold"] },
            { text: "b", marks: ["bold", "underline"] },
        ],
        undefined,
        "**a ++b++**",
    );
    roundTrip(
        [
            { text: "a", marks: ["bold", "underline"] },
            { text: " b", marks: ["bold"] },
        ],
        undefined,
        "**++a++ b**",
    );
});

test("refuses a whitespace-only paragraph when the lexer discards its text", () => {
    const input = document([{ text: "   ", marks: ["underline"] }]);
    const oracle = expected([{ text: "   " }]);
    expect(flattenCommentDocument(normalizeCommentDocument(input))).toEqual(oracle);
    expect(serializeComment(input)).toBe("   ");
    expect(compareCommentDocument(input, [reparse])).toEqual({ saved: false });
});

test("refuses an empty title when the lexer changes it to null", () => {
    const input = document([{ text: "a", marks: [link("https://x.y", "")] }]);
    expect(serializeComment(input)).toBe('[a](https://x.y "")');
    expect(compareCommentDocument(input, [reparse])).toEqual({ saved: false });
});

test.each([false, true])(
    "closes underline at a break and preserves each spanning mark, hard=%s",
    (hardBreak) => {
        expect.hasAssertions();
        const newline = hardBreak ? "  \n" : "\n";
        roundTrip(
            [
                { text: "a", marks: ["underline"] },
                { text: "\n", hardBreak, marks: ["underline"] },
                { text: "b", marks: ["underline"] },
            ],
            [
                { text: "a", marks: ["underline"] },
                { text: "\n" },
                { text: "b", marks: ["underline"] },
            ],
            `++a++${newline}++b++`,
        );
        for (const type of ["bold", "italic", "strike", url]) {
            const input = [
                { text: "a", marks: [type, "underline"] },
                { text: "\n", hardBreak, marks: [type, "underline"] },
                { text: "b", marks: [type, "underline"] },
            ];
            const wanted = [input[0], { text: "\n", marks: [type] }, input[2]];
            const delimiter = { bold: "**", italic: "*", strike: "~~" }[type];
            const source =
                type === url
                    ? `[++a++${newline}++b++](https://x.y)`
                    : `${delimiter}++a++${newline}++b++${delimiter}`;
            roundTrip(input, wanted, source);
        }
        const marks = [url, "bold", "italic", "strike"];
        roundTrip(
            [
                { text: "a", marks: [...marks, "underline"] },
                { text: "\n", hardBreak, marks: [...marks, "underline"] },
                { text: "b", marks: [...marks, "underline"] },
            ],
            [
                { text: "a", marks: [...marks, "underline"] },
                { text: "\n", marks },
                { text: "b", marks: [...marks, "underline"] },
            ],
        );
    },
);

test("uses decoded escape text as the expectation before serializing an edit", () => {
    for (const [source, decoded] of [
        ["1\\. escaped", "1. escaped"],
        ["\\+\\+x\\+\\+", "++x++"],
    ]) {
        const oracle = expected([{ text: decoded }]);
        expect(flattenCommentDocument(reparse(source))).toEqual(oracle);
        roundTrip([{ text: `${decoded}!` }]);
    }
});

test("omits empty paragraphs and joins nonempty paragraphs with one boundary", () => {
    const oracle = expected([{ text: "a\n\nb" }]);
    const json: JSONContent = {
        type: "doc",
        content: [
            { type: "paragraph" },
            document([{ text: "a" }]).content![0],
            { type: "paragraph", content: [] },
            document([{ text: "b" }]).content![0],
            { type: "paragraph" },
        ],
    };
    expect(serializeComment(json)).toBe("a\n\nb");
    expect(flattenCommentDocument(reparse(serializeComment(json)))).toEqual(oracle);
    expect(compareCommentDocument(json, [reparse])).toEqual({ saved: true, source: "a\n\nb" });
    expect(
        compareCommentDocument({ type: "doc", content: [{ type: "paragraph" }] }, [reparse]),
    ).toEqual({ saved: true, source: "" });
});

test("semantic comparison ignores mark order, node splits and absent versus null titles", () => {
    const oracle = expected([{ text: "ab", marks: ["bold", url] }]);
    const input = document([{ text: "ab", marks: [url, "bold"] }]);
    const adapter = () => ({
        type: "doc",
        content: [
            {
                type: "paragraph",
                content: ["a", "b"].map((text) => ({
                    type: "text",
                    text,
                    marks: [{ type: "bold" }, { type: "link", attrs: { href: "https://x.y" } }],
                })),
            },
        ],
    });
    expect(flattenCommentDocument(adapter())).toEqual(oracle);
    expect(compareCommentDocument(input, [reparse, adapter])).toEqual({
        saved: true,
        source: serializeComment(input),
    });
});

test("refuses text, formatting and link attribute mismatches from any adapter", () => {
    const input = document([{ text: "a", marks: [url] }]);
    for (const mismatch of [
        document([{ text: "b", marks: [url] }]),
        document([{ text: "a" }]),
        document([{ text: "a", marks: [link("https://other.test")] }]),
        document([{ text: "a", marks: [link("https://x.y", "changed")] }]),
    ]) {
        expect(compareCommentDocument(input, [reparse, () => mismatch])).toEqual({ saved: false });
    }
    expect(compareCommentDocument(input, [])).toEqual({ saved: false });
    expect(
        compareCommentDocument(document([{ text: "a\nb", marks: [url, "underline"] }]), [
            () => reparse("++[a](https://x.y)++\n++[b](https://x.y)++"),
        ]),
    ).toEqual({ saved: false });
});

test("refuses adapter and serialization exceptions without throwing or returning saved source", () => {
    const input = document([{ text: "draft" }]);
    const before = structuredClone(input);
    expect(
        compareCommentDocument(input, [
            reparse,
            () => {
                throw new Error("Reparse failed");
            },
        ]),
    ).toEqual({ saved: false });
    expect(input).toEqual(before);
    expect(
        compareCommentDocument({ type: "doc", content: [{ type: "unsupported" }] }, [reparse]),
    ).toEqual({ saved: false });
    expect(
        compareCommentDocument(document([{ text: "x", marks: ["unsupported"] }]), [reparse]),
    ).toEqual({ saved: false });
});

test("fixed-seed strings and overlapping layouts survive independently of text node splits", () => {
    let state = 0x20261018;
    const random = (limit: number) => {
        state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
        return (state >>> 8) % limit;
    };
    const atoms = [
        "++",
        "**",
        "*",
        "~~",
        "_",
        "!?.,:;()[]",
        " ",
        "\n",
        "\\",
        "&nbsp;",
        "&amp;",
        "https://a.test",
        "www.a.test",
        "<b>",
        "![x](https://i.test)",
    ];
    for (let iteration = 0; iteration < 160; iteration++) {
        const text = `a${atoms[iteration % atoms.length]}b${atoms[random(atoms.length)]}c`;
        const spanning = ["bold", "italic", "strike", url].filter(() => random(2) === 0);
        const underlined = random(2) === 0;
        const input = [{ text, marks: [...spanning, ...(underlined ? ["underline"] : [])] }];
        const wanted = Array.from(text, (character) => ({
            text: character,
            marks: [...spanning, ...(underlined && character !== "\n" ? ["underline"] : [])],
        }));
        const source = roundTrip(input, wanted);
        expect(
            serializeComment(
                document(
                    Array.from(text, (character) => ({ text: character, marks: input[0].marks })),
                ),
            ),
        ).toBe(source);

        const overlap = [
            { text: "a", marks: ["bold"] },
            { text: `b${atoms[iteration % atoms.length]}c`, marks: ["bold", "italic"] },
            { text: "d", marks: ["italic", "strike"] },
            { text: "e", marks: ["strike", url] },
            { text: "f", marks: [url] },
        ];
        roundTrip(overlap);
    }
});

test("normalization keeps the input document intact", () => {
    const input = document([{ text: " x\ny ", marks: ["underline", "bold"] }]);
    const before = structuredClone(input);
    const oracle = expected([
        { text: " " },
        { text: "x", marks: ["underline", "bold"] },
        { text: "\n", marks: ["bold"] },
        { text: "y", marks: ["underline", "bold"] },
        { text: " " },
    ]);
    expect(flattenCommentDocument(normalizeCommentDocument(input))).toEqual(oracle);
    expect(input).toEqual(before);
});

test("normalization never drops emphasis or link coverage on a break", () => {
    for (const hardBreak of [false, true]) {
        const marks = ["bold", "italic", "strike", url];
        const oracle = expected([{ text: "\n", marks }]);
        const input = document([{ text: "\n", hardBreak, marks: [...marks, "underline"] }]);
        expect(flattenCommentDocument(normalizeCommentDocument(input))).toEqual(oracle);
    }
});
