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

/** A modeled command chessops accepts: parsing it alone leaves no text behind. */
function isWellFormedModeled(command: string): boolean {
    return parseComment(command).text === "";
}

/**
 * Splits one PGN comment into its prose and its embedded commands. Commands the tree does not
 * model (`%evp`, `%emt`, `%timestamp`, …) are kept verbatim so a save writes them back; a modeled
 * command chessops refuses as malformed is kept the same way rather than shown as prose. One pass
 * in source order, so the kept commands keep their order.
 */
export function splitPgnComment(comment: string): SplitComment {
    const commands: string[] = [];
    const rest = comment.replace(COMMAND, (match, name: string) => {
        if (MODELED_COMMANDS.has(name) && isWellFormedModeled(match.trim())) return match;
        commands.push(match);
        return " ";
    });
    const parsed = parseComment(rest);
    return {
        text: parsed.text,
        commands: commands.join("").trim(),
        evaluation: parsed.evaluation,
        shapes: parsed.shapes,
        clock: parsed.clock,
    };
}
