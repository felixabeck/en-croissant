import { Typography } from "@mantine/core";
import { memo } from "react";

import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

type MarkdownNode = {
  type: string;
  value?: string;
  children?: MarkdownNode[];
  data?: { hName: string };
  position?: { start: { offset?: number }; end: { offset?: number } };
};

function remarkInlineOnly(this: { data: (key: string, value?: unknown) => unknown }) {
  const extensions = (this.data("micromarkExtensions") || []) as unknown[];
  extensions.push({
    disable: {
      null: [
        "blockQuote",
        "codeFenced",
        "codeIndented",
        "codeText",
        "headingAtx",
        "htmlFlow",
        "list",
        "setextUnderline",
        "thematicBreak",
        "definition",
      ],
    },
  });
  this.data("micromarkExtensions", extensions);

  return (tree: MarkdownNode, file: { value: unknown }) => {
    const source = String(file.value);
    const visit = (node: MarkdownNode) => {
      if (!node.children) return;
      node.children = underlineChildren(
        node.children.map((child) => {
          // GFM tables and footnotes have anonymous constructs, so keep their source after parsing.
          if (["table", "footnoteDefinition", "footnoteReference"].includes(child.type)) {
            const start = child.position?.start.offset;
            const end = child.position?.end.offset;
            if (start !== undefined && end !== undefined) {
              return { type: "text", value: source.slice(start, end) };
            }
          }
          visit(child);
          return child;
        }),
      );
    };
    visit(tree);
  };
}

function underlineChildren(children: MarkdownNode[]): MarkdownNode[] {
  // Synthetic coordinates: text keeps its length, formatted siblings occupy one \0,
  // and paragraphs/breaks one \n. take() consumes those lengths with shared cursors,
  // preserving formatted nodes while splitting only text around delimiter pairs.
  const syntheticText = children
    .map((child) =>
      child.type === "text"
        ? (child.value ?? "")
        : child.type === "paragraph" || child.type === "break"
          ? "\n"
          : "\0",
    )
    .join("");
  const matches = [...syntheticText.matchAll(/\+\+((?!\s)(?:(?!\+\+)[^\n])*?[^\s\n])\+\+/g)];
  if (matches.length === 0) return children;

  let childIndex = 0;
  let textOffset = 0;
  const take = (length: number): MarkdownNode[] => {
    const nodes: MarkdownNode[] = [];
    while (length > 0 && childIndex < children.length) {
      const child = children[childIndex];
      if (child.type === "text") {
        const text = child.value ?? "";
        const count = Math.min(length, text.length - textOffset);
        if (count > 0)
          nodes.push({ type: "text", value: text.slice(textOffset, textOffset + count) });
        textOffset += count;
        length -= count;
        if (textOffset === text.length) {
          childIndex++;
          textOffset = 0;
        }
      } else {
        nodes.push(child);
        childIndex++;
        length--;
      }
    }
    return nodes;
  };

  const nodes: MarkdownNode[] = [];
  let offset = 0;
  for (const match of matches) {
    const index = match.index;
    nodes.push(...take(index - offset));
    take(2);
    const underlined = take(match[0].length - 4);
    take(2);
    nodes.push({
      type: "underline",
      data: { hName: "u" },
      children: underlined,
    });
    offset = index + match[0].length;
  }
  nodes.push(...take(syntheticText.length - offset));
  return nodes;
}

function Comment({ comment }: { comment: string }) {
  const multipleLine = comment.split("\n").filter((v) => v.trim() !== "").length > 1;

  return (
    <Typography
      pl={0}
      mx={4}
      style={{
        display: multipleLine ? "block" : "inline",
      }}
    >
      <Markdown
        components={{
          a: ({ node: _node, ...props }) => <a {...props} target="_blank" rel="noreferrer" />,
          p: ({ node: _node, ...props }) => (multipleLine ? <p {...props} /> : <span {...props} />),
        }}
        remarkPlugins={[remarkGfm, remarkInlineOnly]}
      >
        {comment}
      </Markdown>
    </Typography>
  );
}

export default memo(Comment);
