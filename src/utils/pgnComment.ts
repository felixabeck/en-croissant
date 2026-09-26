import { type CommentShape, type Evaluation, parseComment } from "chessops/pgn";

/** The embedded commands the tree models itself; chessops parses exactly these into fields. */
const MODELED_COMMANDS = new Set(["eval", "clk", "csl", "cal"]);
const COMMAND = /\s?\[%([A-Za-z0-9_]+)(?:\s[^\]]*)?\]\s?/g;

export type SplitComment = {
    /** What a reader sees: the comment without any `[%…]` command. */
    text: string;
    /** Every command the tree does not model, verbatim, for writing back. Never longer than the
     *  comment it came from: the slices are concatenated with the whitespace they had. */
    commands: string;
    evaluation?: Evaluation;
    shapes: CommentShape[];
    clock?: number;
};

function extractCommands(
    comment: string,
    isOpaque: (name: string) => boolean,
): { text: string; commands: string[] } {
    const commands: string[] = [];
    const text = comment.replace(COMMAND, (match, name: string) => {
        if (!isOpaque(name)) return match;
        commands.push(match);
        return " ";
    });
    return { text, commands };
}

/**
 * Splits one PGN comment into its prose and its embedded commands. Commands the tree does not
 * model (`%evp`, `%emt`, `%timestamp`, …) are kept verbatim so a save writes them back; a modeled
 * command chessops refuses as malformed is kept the same way rather than shown as prose.
 */
export function splitPgnComment(comment: string): SplitComment {
    const opaque = extractCommands(comment, (name) => !MODELED_COMMANDS.has(name));
    const parsed = parseComment(opaque.text);
    const malformed = extractCommands(parsed.text, () => true);
    return {
        text: malformed.text.trim(),
        commands: [...opaque.commands, ...malformed.commands].join("").trim(),
        evaluation: parsed.evaluation,
        shapes: parsed.shapes,
        clock: parsed.clock,
    };
}

/** Appends one comment's commands; the space stands in for that comment's two braces. */
export function joinCommands(current: string | undefined, next: string): string | undefined {
    if (!next) return current;
    return current ? `${current} ${next}` : next;
}
