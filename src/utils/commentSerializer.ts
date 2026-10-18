import type { JSONContent } from "@tiptap/react";

export type CommentFormatting = {
    text: string;
    marks: string[][];
};

export type CommentReparseAdapter = (source: string) => JSONContent;

export type CommentComparison = { saved: true; source: string } | { saved: false };

type Character = {
    text: string;
    marks: string[];
    hardBreak: boolean;
};

const DELIMITERS = { bold: "**", italic: "*", strike: "~~", underline: "++" };

function markKey(mark: NonNullable<JSONContent["marks"]>[number]): string {
    if (mark.type === "link") {
        if (typeof mark.attrs?.href !== "string") throw new Error("Invalid comment link");
        const title = mark.attrs.title ?? null;
        if (title !== null && typeof title !== "string") throw new Error("Invalid comment title");
        return JSON.stringify(["link", mark.attrs.href, title]);
    }
    if (!Object.hasOwn(DELIMITERS, mark.type)) throw new Error("Unsupported comment mark");
    return mark.type;
}

function paragraphs(document: JSONContent): Character[][] {
    if (document.type !== "doc") throw new Error("Expected a comment document");
    return (document.content ?? [])
        .map((paragraph) => {
            if (paragraph.type !== "paragraph") throw new Error("Unsupported comment block");
            return (paragraph.content ?? []).flatMap((node): Character[] => {
                const marks = [...new Set((node.marks ?? []).map(markKey))].sort();
                if (node.type === "hardBreak") return [{ text: "\n", marks, hardBreak: true }];
                if (node.type !== "text" || typeof node.text !== "string") {
                    throw new Error("Unsupported comment node");
                }
                return Array.from(node.text, (text) => ({
                    text,
                    marks: [...marks],
                    hardBreak: false,
                }));
            });
        })
        .filter((paragraph) => paragraph.length > 0);
}

function runs(characters: Character[], mark: string): [number, number][] {
    const result: [number, number][] = [];
    for (let start = 0; start < characters.length; start++) {
        if (!characters[start].marks.includes(mark)) continue;
        let end = start + 1;
        while (end < characters.length && characters[end].marks.includes(mark)) end++;
        result.push([start, end]);
        start = end - 1;
    }
    return result;
}

function normalize(paragraph: Character[]): Character[] {
    const characters = paragraph.map((character) => ({
        ...character,
        marks: [...character.marks],
    }));
    const remove = (index: number, mark: string) => {
        characters[index].marks = characters[index].marks.filter((candidate) => candidate !== mark);
    };
    for (const mark of ["bold", "italic", "strike", "underline"]) {
        if (mark === "underline") {
            characters.forEach((character, index) => {
                if (character.text === "\n") remove(index, mark);
            });
        }
        for (const [start, end] of runs(characters, mark)) {
            const canKeepSpace = (index: number) =>
                mark === "underline" &&
                characters[index].marks.some(
                    (candidate) =>
                        candidate.startsWith('["link",') &&
                        runs(characters, candidate).some(
                            ([first, last]) =>
                                first <= index &&
                                index < last &&
                                !characters
                                    .slice(first, last)
                                    .some((character) => character.text === "\n"),
                        ),
                );
            let first = start;
            let last = end - 1;
            while (
                first <= last &&
                /[^\S\n]/u.test(characters[first].text) &&
                !canKeepSpace(first)
            ) {
                remove(first++, mark);
            }
            while (last >= first && /[^\S\n]/u.test(characters[last].text) && !canKeepSpace(last)) {
                remove(last--, mark);
            }
        }
    }
    return characters;
}

function formatting(paragraphs: Character[][]): CommentFormatting {
    const characters = paragraphs.flatMap((paragraph, index): Character[] =>
        index === 0
            ? paragraph
            : [
                  { text: "\n", marks: [], hardBreak: false },
                  { text: "\n", marks: [], hardBreak: false },
                  ...paragraph,
              ],
    );
    return {
        text: characters.map((character) => character.text).join(""),
        marks: characters.map((character) => character.marks),
    };
}

export function flattenCommentDocument(document: JSONContent): CommentFormatting {
    return formatting(paragraphs(document));
}

export function normalizeCommentDocument(document: JSONContent): JSONContent {
    return {
        type: "doc",
        content: paragraphs(document).map((paragraph) => ({
            type: "paragraph",
            content: normalize(paragraph).map((character) => ({
                type: character.hardBreak ? "hardBreak" : "text",
                ...(character.hardBreak ? {} : { text: character.text }),
                marks: character.marks.map((key) => {
                    if (!key.startsWith('["link",')) return { type: key };
                    const [, href, title] = JSON.parse(key) as [string, string, string | null];
                    return { type: "link", attrs: { href, title } };
                }),
            })),
        })),
    };
}

function literal(character: Character, index: number, characters: Character[]): string {
    if (character.hardBreak) return "  \n";
    if (
        /[\\*_[\]~<>:()]/u.test(character.text) ||
        (character.text === "+" &&
            [characters[index - 1], characters[index + 1]].some(
                (neighbor) => neighbor?.text === "+" && !neighbor.hardBreak,
            )) ||
        (character.text === "!" && characters[index + 1]?.text === "[")
    )
        return `\\${character.text}`;
    if (
        character.text === "." &&
        characters
            .slice(Math.max(0, index - 3), index)
            .map((item) => item.text)
            .join("")
            .toLowerCase() === "www"
    ) {
        return "\\.";
    }
    return character.text;
}

function wrap(mark: string, content: string): string {
    if (!mark.startsWith('["link",')) {
        const delimiter = DELIMITERS[mark as keyof typeof DELIMITERS];
        return delimiter + content + delimiter;
    }
    const [, href, title] = JSON.parse(mark) as [string, string, string | null];
    const destination = /[()]/u.test(href) ? `<${href}>` : href;
    const suffix = title === null ? "" : ` "${title.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
    return `[${content}](${destination}${suffix})`;
}

function render(characters: Character[]): string {
    const marks = [...new Set(characters.flatMap((character) => character.marks))];
    const priority = (mark: string) => {
        if (mark === "underline") return 1;
        if (mark.startsWith('["link",')) return 2;
        return ["italic", "bold", "strike"].indexOf(mark) + 3;
    };
    const candidates = marks
        .flatMap((mark) =>
            runs(characters, mark).map(([start, end]) => ({
                mark,
                start,
                end,
                priority:
                    priority(mark) -
                    (characters.slice(start, end).some((character) => character.text === "\n")
                        ? 10
                        : 0),
            })),
        )
        .sort((left, right) => left.priority - right.priority || left.start - right.start);
    for (const candidate of candidates) {
        if (
            (candidate.mark === "bold" || candidate.mark === "italic") &&
            candidates.some(
                (other) =>
                    (other.mark === "bold" || other.mark === "italic") &&
                    other.mark !== candidate.mark &&
                    other.start < candidate.start &&
                    candidate.start < other.end &&
                    other.end < candidate.end,
            )
        ) {
            candidate.priority -= 1.5;
        }
        if (!["bold", "italic", "strike"].includes(candidate.mark)) continue;
        const splitsWhitespace = candidates.some((other) =>
            [other.start, other.end].some(
                (boundary) =>
                    candidate.start < boundary &&
                    boundary < candidate.end &&
                    /\s/u.test(characters[boundary - 1].text + characters[boundary].text),
            ),
        );
        if (splitsWhitespace) candidate.priority -= 6;
    }
    candidates.sort((left, right) => left.priority - right.priority || left.start - right.start);
    const selected = candidates.find(
        (candidate) =>
            !candidates.some(
                (other) =>
                    other.start <= candidate.start &&
                    candidate.end <= other.end &&
                    (other.start < candidate.start || candidate.end < other.end),
            ),
    );
    if (!selected) return characters.map(literal).join("");
    const { mark, start, end } = selected;
    const content = render(
        characters.slice(start, end).map((character) => ({
            ...character,
            marks: character.marks.filter((candidate) => candidate !== mark),
        })),
    );
    return render(characters.slice(0, start)) + wrap(mark, content) + render(characters.slice(end));
}

export function serializeComment(document: JSONContent): string {
    return paragraphs(normalizeCommentDocument(document)).map(render).join("\n\n");
}

export function compareCommentDocument(
    document: JSONContent,
    adapters: readonly CommentReparseAdapter[],
): CommentComparison {
    try {
        if (adapters.length === 0) return { saved: false };
        const normalized = normalizeCommentDocument(document);
        const expected = flattenCommentDocument(normalized);
        const source = serializeComment(normalized);
        for (const adapter of adapters) {
            const actual = flattenCommentDocument(adapter(source));
            if (
                actual.text !== expected.text ||
                JSON.stringify(actual.marks) !== JSON.stringify(expected.marks)
            ) {
                return { saved: false };
            }
        }
        return { saved: true, source };
    } catch {
        return { saved: false };
    }
}
