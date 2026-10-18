import type { JSONContent } from "@tiptap/react";
import { createCommentMarkdown, type CommentMarkdownToken } from "./commentMarkdown";

type CommentNotationInline =
    | { type: "text"; text: string }
    | { type: "hardBreak" }
    | { type: "bold" | "italic" | "strike" | "underline"; content: CommentNotationInline[] }
    | {
          type: "link";
          content: CommentNotationInline[];
          attrs: { href: string; title: string | null };
      };

type CommentNotationBlock =
    | { type: "paragraph"; content: CommentNotationInline[] }
    | { type: "space" };

export type CommentNotationNode = CommentNotationInline | CommentNotationBlock;

// This reader owns the instance and never registers anything after creation.
const markdown = createCommentMarkdown();

export function readCommentNotation(source: string): CommentNotationBlock[] {
    const walk = (tokens: CommentMarkdownToken[]): CommentNotationInline[] =>
        tokens.map((token): CommentNotationInline => {
            const type = {
                strong: "bold",
                em: "italic",
                del: "strike",
                underline: "underline",
            }[token.type] as "bold" | "italic" | "strike" | "underline" | undefined;
            if (token.type === "link") {
                if (!/^(?:https?:|mailto:)/i.test(token.href!)) {
                    return { type: "text", text: token.raw };
                }
                return {
                    type: "link",
                    attrs: { href: token.href!, title: token.title ?? null },
                    content: walk(token.tokens!),
                };
            }
            if (type) return { type, content: walk(token.tokens!) };
            if (token.type === "br") return { type: "hardBreak" };
            // Block constructs, HTML and images are disabled by the comment lexer.
            // Its remaining leaves are text and decoded escapes.
            return { type: "text", text: token.text! };
        });
    return markdown
        .lexer(source)
        .map(
            (token): CommentNotationBlock =>
                token.type === "space"
                    ? { type: "space" }
                    : { type: "paragraph", content: walk((token as CommentMarkdownToken).tokens!) },
        );
}

export function parseNotationComment(source: string): JSONContent {
    const inline = (
        nodes: CommentNotationInline[],
        marks: NonNullable<JSONContent["marks"]> = [],
    ): JSONContent[] =>
        nodes.flatMap((node): JSONContent[] => {
            if (node.type === "text") return [{ type: "text", text: node.text, marks }];
            if (node.type === "hardBreak") return [{ type: "hardBreak", marks }];
            const mark =
                node.type === "link" ? { type: "link", attrs: node.attrs } : { type: node.type };
            return inline(node.content, [...marks, mark]);
        });
    return {
        type: "doc",
        // Preserve block spaces in the shared notation for Comment's literal newline,
        // while keeping the editor document's existing paragraph-only shape.
        content: readCommentNotation(source).flatMap((node) =>
            node.type === "space" ? [] : [{ type: "paragraph", content: inline(node.content) }],
        ),
    };
}
