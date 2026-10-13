import { Marked, Tokenizer, type Tokens } from "marked";
import { COMMENT_UNDERLINE } from "./pgnComment";

export type CommentMarkdownToken = {
    type: string;
    raw: string;
    text?: string;
    href?: string;
    title?: string | null;
    tokens?: CommentMarkdownToken[];
};

const UNDERLINE_AT_START = new RegExp(`^${COMMENT_UNDERLINE.source}`);

/** Each editor owns its lexer because Tiptap registers tokenizers during creation. */
export function createCommentMarkdown() {
    return new Marked({
        gfm: true,
        tokenizer: {
            heading: () => undefined,
            lheading: () => undefined,
            blockquote: () => undefined,
            hr: () => undefined,
            list: () => undefined,
            code: () => undefined,
            fences: () => undefined,
            html: () => undefined,
            def: () => undefined,
            table: () => undefined,
            codespan: () => undefined,
            link(source) {
                const token = Tokenizer.prototype.link.call(this, source);
                if (token?.type !== "image") return token;
                return { type: "text", raw: token.raw, text: token.raw } as unknown as Tokens.Link;
            },
            tag(source) {
                const match = this.rules.inline.tag.exec(source);
                if (!match) return undefined;
                // Recognize tags without changing the lexer's inLink/inRawBlock state.
                // Marked's override type is narrower than the token its lexer accepts.
                return { type: "text", raw: match[0], text: match[0] } as unknown as Tokens.Tag;
            },
        },
        extensions: [
            {
                name: "underline",
                level: "inline",
                start: (source) => source.indexOf("++"),
                tokenizer(source) {
                    const match = UNDERLINE_AT_START.exec(source);
                    if (!match) return undefined;
                    return {
                        type: "underline",
                        raw: match[0],
                        text: match[1],
                        tokens: this.lexer.inlineTokens(match[1]),
                    };
                },
            },
        ],
    });
}
